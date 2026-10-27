async page => {
  // More than one map on a page: a detail map (a second frame with the same layers at its own place and scale) with its zoom box and
  // lines on the main map. Dhaka District: add it, give the page room, choose its area by dragging a box on the main map, move and
  // zoom it (drag, wheel, buttons, the scale field), pick a name inside it, its label, scale text and grid, the scale bar measuring it,
  // duplicate, hide and bring back, a new place, a reload, undo, and the SVG, PDF and PNG exports.
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/504|Failed to load resource|overpass/i.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 160)); });
  await page.setViewportSize({ width: 1366, height: 900 });
  const doc = async () => { await page.waitForTimeout(1600); return page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1') || '{}').doc); };
  const items = async (kind) => (await doc()).items.filter((i) => i.kind === kind);
  const crashed = () => page.getByText('Something went wrong').count();
  /** the texts drawn in one map frame (the main map's id or a detail map's): its names, grid numbers, label and scale text */
  const frameTexts = (id) => page.evaluate((id) => { const g = document.querySelector(`svg.figure [clip-path="url(#clip-${id})"]`)?.parentElement; return g ? [...g.querySelectorAll('text')].map((t) => t.textContent || '') : []; }, id);
  const figTexts = () => page.evaluate(() => [...document.querySelectorAll('svg.figure text')].map((t) => t.textContent || ''));
  /** zoom boxes on the main map (paths with the box's faint fill inside the main frame) and the zoom lines to a detail map (a path of two segments straight under the figure) */
  const zoomBoxes = (mainId) => page.evaluate((id) => [...document.querySelectorAll(`svg.figure [clip-path="url(#clip-${id})"] path[fill-opacity="0.07"]`)].map((p) => { const b = p.getBBox(); return { d: p.getAttribute('d'), stroke: p.getAttribute('stroke'), w: b.width, h: b.height }; }), mainId);
  const zoomLines = () => page.evaluate(() => [...document.querySelectorAll('svg.figure > path[fill="none"]')].map((p) => p.getAttribute('d') || '').filter((d) => /^M[-\d.,]+L[-\d.,]+M[-\d.,]+L[-\d.,]+$/.test(d)));
  const start = async (place) => {
    // cleared from a page that is not the app, or the app keeps its map and writes it back as it closes
    await page.goto('http://localhost:4173/favicon.svg');
    await page.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name); });
    await page.goto('http://localhost:4173/');
    await page.waitForTimeout(3000);
    await page.getByRole('combobox', { name: 'Search for a place' }).first().fill(place);
    await page.locator('[role=option]', { hasText: 'District' }).first().waitFor({ timeout: 30000 });
    await page.locator('[role=option]', { hasText: 'District' }).first().click();
    await page.waitForTimeout(10000);
  };
  const openPart = async (name) => {
    if ((await page.locator('aside').getByRole('tab', { name, exact: true }).count()) === 0) await page.locator('nav.rail button', { hasText: 'Map parts' }).first().click();
    await page.locator('aside').getByRole('tab', { name, exact: true }).click();
    await page.waitForTimeout(500);
  };
  const settings = async () => { await page.getByRole('button', { name: 'Settings' }).first().click(); await page.waitForTimeout(600); };
  const back = async () => { await page.getByRole('button', { name: 'Back to the map parts' }).click().catch(() => {}); await page.waitForTimeout(300); };
  const title = () => page.locator('aside h2.panel-title').first().innerText();
  /** page mm to screen px */
  const px = async (mx, my) => { const ov = await page.locator('svg.overlay').boundingBox(); const d = (await doc()); return [ov.x + (mx / d.widthMm) * ov.width, ov.y + (my / d.heightMm) * ov.height]; };
  const pxPerMm = async () => { const ov = await page.locator('svg.overlay').boundingBox(); const d = await doc(); return ov.width / d.widthMm; };
  const click = async (it) => { await page.mouse.click(...(await px(it.x + it.w / 2, it.y + it.h / 2))); await page.waitForTimeout(500); };
  const setBox = async (vals) => { for (const [k, v] of Object.entries(vals)) { const inp = page.locator(`aside input[aria-label^="${k}"]`).first(); await inp.fill(String(v)); await inp.press('Enter'); await inp.blur(); } await page.waitForTimeout(500); };
  const exportAs = async (fmt, file) => {
    await page.getByRole('button', { name: 'Export' }).first().click();
    await page.waitForTimeout(600);
    await page.locator('aside').getByRole('button', { name: new RegExp('^' + fmt) }).first().click();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }).catch(() => null), page.getByRole('button', { name: new RegExp('^Download ' + fmt) }).click()]);
    if (!dl) return { size: 0, text: '' };
    await dl.saveAs(S + 'out/' + file);
    let n = 0, text = '';
    for await (const chunk of await dl.createReadStream()) { n += chunk.length; if (fmt === 'SVG') text += chunk.toString('utf8'); }
    return { size: n, text };
  };
  const findings = async () => {
    await page.locator('header button', { hasText: /to check|Ready|Checking|Journal check/ }).first().click();
    await page.waitForTimeout(500);
    const t = await page.locator('#menu-check').innerText().catch(() => '');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    return t;
  };
  const scaleBox = async () => Number(((await page.locator('#map-scale').inputValue()) || '').replace(/[^\d]/g, ''));

  try {
  /* ---------- a map of one frame is as it was ---------- */
  await start('Dhaka');
  let d = await doc();
  const main = d.items.find((i) => i.kind === 'map');
  const mainScale = await scaleBox();
  ok('a new map has one map frame and no detail map', d.items.filter((i) => i.kind === 'map').length === 1 && d.items.filter((i) => i.kind === 'detail').length === 0 && mainScale > 100000, `main scale 1:${mainScale}`);
  ok('no zoom box or zoom lines are drawn', (await zoomBoxes(main.id)).length === 0 && (await zoomLines()).length === 0);

  /* ---------- adding one ---------- */
  await openPart('Add');
  ok('Add has a group "More maps" with a tile "Detail map"', (await page.getByRole('heading', { name: 'More maps' }).count()) === 1 && (await page.locator('aside button.tile', { hasText: 'Detail map' }).count()) === 1);
  await page.locator('aside button.tile', { hasText: 'Detail map' }).click();
  await page.waitForTimeout(2500);
  d = await doc();
  let det = d.items.find((i) => i.kind === 'detail');
  ok('a detail map is added, on show, with its zoom box and lines on, a grid off and no letter', !!det && det.visible && det.showBox && det.connect && !det.grid.show && det.label === '', JSON.stringify({ x: det?.x, y: det?.y, w: det?.w, h: det?.h }));
  ok('it starts 3 times closer than the main map (1:' + Math.round(mainScale / 3) + ')', Math.abs(det.scale * 3 / mainScale - 1) < 0.03, `1:${det.scale}`);
  ok('at the middle of the study area (Dhaka District)', det.centre[0] > 90 && det.centre[0] < 90.7 && det.centre[1] > 23.5 && det.centre[1] < 24.1, JSON.stringify(det.centre));
  const mi = d.items.findIndex((i) => i.kind === 'map');
  ok('it sits right after the main map in the stacking order (parts on the main map stay over its lines)', d.items[mi + 1].id === det.id);
  ok('the page shows it as a frame of its own: a clip group, the same layers, its own names', (await frameTexts(det.id)).length > 0 && (await page.locator(`svg.figure [clip-path="url(#clip-${det.id})"]`).count()) === 1);
  let boxes = await zoomBoxes(main.id), lines = await zoomLines();
  ok('the main map shows its zoom box, and two lines run from the box to the frame', boxes.length === 1 && lines.length === 1, `${boxes.length} box, ${lines.length} line path`);
  ok('the box has the colour of the other zoom boxes (the locator\'s marker)', boxes[0]?.stroke?.toLowerCase() === (d.items.find((i) => i.kind === 'inset' && i.visible)?.extentColor ?? '').toLowerCase(), boxes[0]?.stroke);
  ok('the toolbar names it and offers zoom, fit and the grid', (await page.locator('.toolbar').first().innerText()).includes('Detail map') && (await page.getByRole('button', { name: 'Zoom detail map in' }).count()) === 1 && (await page.getByRole('button', { name: /^Fit to area/ }).count()) >= 1 && (await page.locator('.toolbar .gridbtn').count()) === 1);
  ok('and no turn handle (a map frame is not turned)', (await page.locator('svg.overlay [data-rotate]').count()) === 0);
  ok('the scale box now shows the detail map\'s scale', /Detail scale/.test(await page.locator('.scalebox label').innerText()) && Math.abs((await scaleBox()) - det.scale) <= det.scale * 0.01, `${await scaleBox()}`);

  /* ---------- its settings ---------- */
  await settings();
  ok('settings open with the title "Detail map"', (await title()) === 'Detail map');
  const side = await page.locator('aside').innerText();
  ok('they say it draws the same layers and styles as the main map', /same layers and styles as the main map/.test(side) && /one layer list/.test(side));
  ok('they have what it shows, the zoom box, a label, a frame and the grid, and the usual position and size', ['What it shows', 'Zoom box on the main map', 'Label', 'Frame', 'Coordinate grid', 'Position and size'].every((t) => side.includes(t)));
  ok('but no "Box, see-through and turn" (a map frame has none)', !side.includes('Box, see-through and turn'));
  ok('its scale field says 1 : ' + det.scale.toLocaleString('en-US'), (await page.getByLabel('Detail map scale').inputValue()) === det.scale.toLocaleString('en-US'));

  /* ---------- room on the page: the main map narrower, the detail map beside it ---------- */
  await back();
  await click(main);
  await settings();
  await setBox({ 'W, Width': 100 });
  await back();
  d = await doc();
  ok('the main map is 100 mm wide now', d.items.find((i) => i.kind === 'map').w === 100);
  det = d.items.find((i) => i.kind === 'detail');
  await click(det);
  await settings();
  await setBox({ 'X, Left': 108, 'Y, Top': 72, 'W, Width': 76, 'H, Height': 44 });
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  ok('the detail map is placed beside the main map (x 108, y 72, 76 × 44 mm)', det.x === 108 && det.y === 72 && det.w === 76 && det.h === 44 && det.pinned !== false);
  const sizeBefore = (await zoomBoxes(main.id))[0];
  ok('resizing the frame keeps its scale and shows more ground: the box on the main map grew', Math.abs(det.scale * 3 / mainScale - 1) < 0.03 && sizeBefore.w > 0);
  const f0 = await findings();
  ok('the journal check has nothing to say about the detail map beside the main map', !/Detail map|detail map/.test(f0), f0.replace(/\s+/g, ' ').slice(0, 800));

  /* ---------- its scale ---------- */
  const scaleIn = page.getByLabel('Detail map scale');
  await scaleIn.fill('60,000');
  await scaleIn.press('Enter');
  await scaleIn.blur();
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  const sizeAfter = (await zoomBoxes(main.id))[0];
  ok('a typed scale 1:60,000 is kept', det.scale === 60000, `${det.scale}`);
  ok('the zoom box on the main map shrinks to the smaller ground', sizeAfter.w < sizeBefore.w * 0.6 && sizeAfter.h < sizeBefore.h * 0.6, `${sizeBefore.w.toFixed(1)} → ${sizeAfter.w.toFixed(1)}`);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  ok('Zoom in makes it 1.25 times closer', Math.abs(det.scale - 48000) < 200, `${det.scale}`);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  d = await doc();
  ok('Zoom out undoes it', Math.abs(d.items.find((i) => i.kind === 'detail').scale - 60000) < 200);
  await page.getByRole('button', { name: 'Fit to the study area' }).click();
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  // the frame (76 × 46 mm) is smaller than the main map's (100 × 140 mm), so the whole district needs a smaller scale than the main map's
  const whole = (await zoomBoxes(main.id))[0];
  ok('"Fit to the study area" shows the whole district (a second panel of the same ground)', det.scale > mainScale && whole.w >= 80 && whole.h >= 90, `1:${det.scale} against the main map 1:${mainScale}; its box is ${whole.w.toFixed(0)} × ${whole.h.toFixed(0)} mm on the main map`);

  /* ---------- choosing its area by dragging a box on the main map ---------- */
  await page.getByRole('button', { name: 'Choose on the main map' }).click();
  await page.waitForTimeout(400);
  ok('the toolbar asks for a box on the main map', /Drag a box on the main map/.test(await page.locator('.toolbar').first().innerText()));
  const M = (fx, fy) => px(main.x + fx * 100, main.y + fy * main.h);
  // the city (Mohammadpur, Lalbagh, Hazaribagh) lies in the east-south-east of the district
  await page.mouse.move(...(await M(0.64, 0.5)));
  await page.mouse.down();
  await page.mouse.move(...(await M(0.72, 0.56)), { steps: 5 });
  await page.mouse.move(...(await M(0.82, 0.63)), { steps: 5 });
  await page.mouse.up();
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  ok('the detail map now shows the city: its middle is on the dragged box', det.centre[0] > 90.33 && det.centre[0] < 90.5 && det.centre[1] > 23.65 && det.centre[1] < 23.85, JSON.stringify(det.centre) + ' 1:' + det.scale);
  ok('and the box is gone from the toolbar', !/Drag a box on the main map/.test(await page.locator('.toolbar').first().innerText()));
  let names = await frameTexts(det.id);
  const city = ['Mohammadpur', 'Lalbagh', 'Hazaribagh', 'Dhanmondi', 'Kotwali', 'Ramna', 'Sutrapur', 'Kamrangir Char', 'Kadamtali', 'Demra', 'Khilgaon'].filter((n) => names.includes(n));
  ok('the thana names of the city are drawn in the detail map by its own label placement', city.length >= 2, city.join(', '));
  ok('the main map keeps its own view (a detail map never moves it)', (await doc()).view.zoom === d.view.zoom && (await doc()).view.panX === d.view.panX);
  await page.screenshot({ path: S + 'shots/maps-city.png' });

  /* ---------- drag inside it, scroll on it ---------- */
  await click(det); // selected already; a click on it keeps it selected
  const k = await pxPerMm();
  const c0 = det.centre, sc0 = det.scale;
  const [cx, cy] = await px(det.x + det.w / 2, det.y + det.h / 2);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 15, cy + 8, { steps: 4 });
  await page.mouse.move(cx + 30, cy + 15, { steps: 4 });
  await page.waitForTimeout(150);
  const previewing = await page.evaluate((id) => { const g = document.querySelector(`svg.figure [clip-path="url(#clip-${id})"] > g`); return g?.getAttribute('transform') || ''; }, det.id);
  await page.mouse.up();
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  const mmMoved = 30 / k, expectDeg = (mmMoved * sc0 / 1000) / (111320 * Math.cos((c0[1] * Math.PI) / 180));
  ok('dragging inside the selected detail map moves what it shows while the frame stays', det.x === 108 && det.y === 72 && det.centre[0] < c0[0] && det.centre[1] > c0[1], `${c0} → ${det.centre}`);
  ok('by about as far as the pointer travelled', Math.abs((c0[0] - det.centre[0]) / expectDeg - 1) < 0.3, `${((c0[0] - det.centre[0]) / expectDeg).toFixed(2)} of ${expectDeg.toFixed(5)}°`);
  ok('while dragging, its content followed the pointer at once (a preview, no rebuild)', /translate\(/.test(previewing), previewing);
  ok('and the main map was not panned', (await doc()).view.panX === d.view.panX && d.view.panX === 0);
  const sc1 = det.scale;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(700);
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  ok('the wheel over it zooms it (closer)', det.scale < sc1 * 0.7 && det.scale > sc1 * 0.4, `1:${sc1} → 1:${Math.round(det.scale)}`);
  ok('and the main map keeps its zoom', d.view.zoom === 1);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(700);
  d = await doc();
  ok('the wheel the other way zooms out again', Math.abs(d.items.find((i) => i.kind === 'detail').scale / sc1 - 1) < 0.1);
  // the wheel on the main map zooms the main map only
  const mainSpot = await M(0.2, 0.3);
  await page.mouse.move(...mainSpot);
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(700);
  d = await doc();
  ok('the wheel on the main map zooms the main map only', d.view.zoom > 1.3 && Math.abs(d.items.find((i) => i.kind === 'detail').scale / sc1 - 1) < 0.1, `main zoom ${d.view.zoom.toFixed(2)}`);
  await page.getByRole('button', { name: 'Zoom map out' }).first().click().catch(() => {});
  // back to the first view of the main map, so later checks start from it
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(800);
  d = await doc();
  if (d.view.zoom !== 1) { await page.locator('.mapzoom button[aria-label="Fit map to the area"]').click().catch(() => {}); await page.waitForTimeout(800); d = await doc(); }

  /* ---------- picking inside it ---------- */
  det = d.items.find((i) => i.kind === 'detail');
  await click(det);
  const spot = await page.evaluate((id) => {
    const g = document.querySelector(`svg.figure [clip-path="url(#clip-${id})"]`);
    const t = [...(g?.querySelectorAll('text[data-pick]') ?? [])].find((x) => /^(Lalbagh|Mohammadpur|Hazaribagh|Dhanmondi|Kotwali|Kadamtali)$/.test(x.textContent || ''));
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, name: t.textContent };
  }, det.id);
  ok('a name is drawn in the detail map to pick', !!spot, spot?.name);
  if (spot) {
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(700);
    ok('clicking a name inside the selected detail map picks it: its layer\'s settings open with the "this feature" card', /Sub-areas|Sub-/.test(await title()) && (await page.locator('aside').innerText()).includes(spot.name), await title());
    ok('and the pick box is drawn on the detail map, not on the main map', await page.evaluate((id) => { const b = document.querySelector('svg.overlay rect.picked'); const fr = document.querySelector(`svg.figure [clip-path="url(#clip-${id})"]`)?.getBoundingClientRect(); if (!b || !fr) return false; const r = b.getBoundingClientRect(); return r.x >= fr.x - 4 && r.right <= fr.right + 4 && r.y >= fr.y - 4 && r.bottom <= fr.bottom + 4; }, det.id));
    await page.getByRole('button', { name: 'Back to the map parts' }).click().catch(() => {});
    await page.waitForTimeout(300);
  }

  /* ---------- the zoom box and lines are switchable ---------- */
  await click(det);
  await settings();
  await page.getByRole('switch', { name: 'Lines to this map' }).click();
  await page.waitForTimeout(500);
  ok('the lines switch off, the box stays', (await zoomLines()).length === 0 && (await zoomBoxes(main.id)).length === 1 && (await items('detail'))[0].connect === false);
  await page.getByRole('switch', { name: 'Lines to this map' }).click();
  await page.waitForTimeout(500);
  ok('and on again', (await zoomLines()).length === 1);
  await page.getByRole('switch', { name: 'Mark this area on the main map' }).click();
  await page.waitForTimeout(500);
  ok('the box switches off, and with it the lines', (await zoomBoxes(main.id)).length === 0 && (await zoomLines()).length === 0 && (await items('detail'))[0].showBox === false);
  await page.getByRole('switch', { name: 'Mark this area on the main map' }).click();
  await page.waitForTimeout(400);
  await page.locator('aside details.acc.quiet', { hasText: 'More options' }).first().locator('summary').click();
  ok('More options: box line, box fill, line width and dashed lines', (await page.locator('aside').innerText()).includes('Zoom box line') && (await page.locator('aside').innerText()).includes('Zoom box fill') && (await page.getByRole('switch', { name: 'Dashed zoom lines' }).count()) === 1);
  await page.getByRole('switch', { name: 'Dashed zoom lines' }).click();
  await page.waitForTimeout(500);
  ok('dashed lines are written as a dash pattern', await page.evaluate(() => [...document.querySelectorAll('svg.figure > path[fill="none"]')].some((p) => (p.getAttribute('stroke-dasharray') || '') !== '' && /^M[-\d.,]+L[-\d.,]+M/.test(p.getAttribute('d') || ''))));
  await page.getByRole('switch', { name: 'Dashed zoom lines' }).click();

  /* ---------- label, scale text, frame, grid ---------- */
  await page.getByLabel('Letter or caption (optional)').fill('(b)');
  await page.waitForTimeout(500);
  ok('a panel letter is written on a small white tab in the frame', (await frameTexts(det.id)).includes('(b)'));
  await page.getByRole('switch', { name: /Write the scale in the corner/ }).click();
  await page.waitForTimeout(500);
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  ok('the scale is written in the corner (1:' + Math.round(det.scale).toLocaleString('en-US') + ')', (await frameTexts(det.id)).includes(`1:${Math.round(det.scale).toLocaleString('en-US')}`));
  const f1 = await findings();
  ok('the journal check reads the label size', !/Detail map [\d.]+ pt: below/.test(f1));
  await page.locator('aside details.acc.quiet', { hasText: 'Frame' }).first().locator('summary').click();
  const fr = page.locator('aside details.acc.quiet', { hasText: 'Frame colour' }).first().locator('input[type=range]').first();
  await fr.fill('1.5');
  await page.waitForTimeout(500);
  ok('the frame line has its own width', (await items('detail'))[0].framePt === 1.5);
  await page.getByRole('switch', { name: 'Show the coordinate grid' }).click();
  await page.waitForTimeout(700);
  const gridTexts = (await frameTexts(det.id)).filter((t) => /°/.test(t));
  ok('its own coordinate grid draws degrees round the frame (the main map\'s is separate)', gridTexts.length >= 2 && (await items('detail'))[0].grid.show === true && (await items('map'))[0].grid.show === true, gridTexts.slice(0, 3).join(' '));
  await page.getByRole('switch', { name: 'Show the coordinate grid' }).click();
  await page.waitForTimeout(500);
  ok('and off again', (await frameTexts(det.id)).filter((t) => /°/.test(t)).length === 0);
  await page.screenshot({ path: S + 'shots/maps-settings.png' });

  /* ---------- the scale bar measures it ---------- */
  await back();
  d = await doc();
  const sb = d.items.find((i) => i.kind === 'scale');
  const barBefore = (await figTexts()).filter((t) => /^\d+$/.test(t) || t === 'km').join(' ');
  await click(sb);
  await settings();
  ok('the scale bar can say which map it measures', (await page.getByLabel('Measures').count()) === 1 && (await page.getByLabel('Measures').locator('option').allInnerTexts()).join('|').includes('Detail map'));
  await page.getByLabel('Measures').selectOption({ label: 'Detail map' });
  await page.waitForTimeout(700);
  d = await doc();
  ok('"Measures: Detail map" is kept', d.items.find((i) => i.kind === 'scale').of === det.id);
  const barAfter = (await figTexts()).filter((t) => /^\d+$/.test(t) || t === 'km').join(' ');
  ok('the bar now reads the detail map\'s scale (other numbers or units)', barAfter !== barBefore, `${barBefore} → ${barAfter}`);
  await page.getByLabel('Measures').selectOption({ label: 'The main map' });
  await page.waitForTimeout(500);
  ok('and back to the main map', (await items('scale'))[0].of === undefined);
  await back();

  /* ---------- the check, a second detail map, hide and bring back, delete ---------- */
  await click(det);
  await page.keyboard.press('Control+d');
  await page.waitForTimeout(900);
  d = await doc();
  ok('Ctrl+D copies the detail map (two on the page, the copy 4 mm down and right)', d.items.filter((i) => i.kind === 'detail').length === 2);
  await settings();
  ok('with two on the page the settings call them "Detail map 1" and "Detail map 2" (this is the copy)', (await title()) === 'Detail map 2', await title());
  await back();
  const copy = (await items('detail')).find((i) => i.id !== det.id);
  await click(copy); // the keyboard goes back to the page
  await page.keyboard.press('Delete');
  await page.waitForTimeout(800);
  ok('Delete removes the selected copy', (await items('detail')).length === 1 && (await items('detail'))[0].id === det.id);
  await click(det);
  await page.locator('.toolbar').getByRole('button', { name: 'Hide' }).click();
  await page.waitForTimeout(700);
  ok('Hide takes the detail map off the page, its box and lines with it', !(await items('detail'))[0].visible && (await zoomBoxes(main.id)).length === 0 && (await zoomLines()).length === 0);
  await openPart('Inset maps');
  const sw = page.getByRole('switch', { name: /^Detail map/ });
  ok('Map parts, Inset maps lists it with its scale, off', (await sw.count()) === 1 && !(await sw.isChecked()));
  await sw.click();
  await page.waitForTimeout(800);
  ok('switched on, it comes back', (await items('detail'))[0].visible && (await zoomBoxes(main.id)).length === 1);
  ok('Inset maps also has a "Detail" tile', (await page.locator('aside button.tile', { hasText: 'Detail' }).count()) >= 1);

  /* ---------- the check says when a detail map is not closer ---------- */
  await click((await items('detail'))[0]);
  await settings();
  const sIn = page.getByLabel('Detail map scale');
  await sIn.fill(String(mainScale * 2));
  await sIn.press('Enter');
  await sIn.blur();
  await page.waitForTimeout(500);
  const f2 = await findings();
  ok('a detail map more zoomed out than the main map is told so', /not closer than the main map/.test(f2), f2.replace(/\s+/g, ' ').slice(0, 200));
  await sIn.fill('60000');
  await sIn.press('Enter');
  await sIn.blur();
  await back();

  /* ---------- exports show what the screen shows ---------- */
  d = await doc();
  det = d.items.find((i) => i.kind === 'detail');
  const svg = await exportAs('SVG', 'maps-test.svg');
  ok('SVG export holds the detail map: its letter, scale text, box and lines', svg.size > 150000 && svg.text.includes('(b)') && svg.text.includes('1:60,000'), svg.size + ' bytes');
  ok('SVG: the frame\'s clip path has its own id and the editor\'s click tags are gone', new RegExp(`id="clip-${det.id}"`).test(svg.text) && !/data-pick/.test(svg.text) && !/dominant-baseline/.test(svg.text));
  const ids = [...svg.text.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  ok('SVG: every id is unique (the frames\' clip paths never share one)', new Set(ids).size === ids.length, `${ids.length} ids`);
  const pdf = await exportAs('PDF', 'maps-test.pdf');
  ok('PDF export works', pdf.size > 150000, pdf.size + ' bytes');
  const png = await exportAs('PNG', 'maps-test.png');
  ok('PNG export works', png.size > 400000, png.size + ' bytes');
  ok('no crash after the exports', (await crashed()) === 0);

  /* ---------- reload, undo ---------- */
  await page.reload();
  await page.waitForTimeout(6000);
  d = await doc();
  const again = d.items.find((i) => i.kind === 'detail');
  ok('after a reload the detail map is as it was (place, scale, label)', !!again && again.scale === 60000 && again.label === '(b)' && Math.abs(again.centre[0] - det.centre[0]) < 1e-6, JSON.stringify(again?.centre));
  ok('and drawn again with its box on the main map and its names', (await zoomBoxes(main.id)).length === 1 && (await frameTexts(again.id)).length > 3);
  await click(again);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(800);
  ok('delete removes it, with its box and lines', (await items('detail')).length === 0 && (await zoomBoxes(main.id)).length === 0 && (await zoomLines()).length === 0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(1500);
  ok('Undo brings it back', (await items('detail')).length === 1 && (await zoomBoxes(main.id)).length === 1);

  /* ---------- a new place: the detail map looks at the new area ---------- */
  if (!(await page.getByRole('button', { name: 'Change area' }).count())) await page.locator('nav.rail button', { hasText: 'Place' }).first().click(); // the rail button closes a panel that is already on show
  await page.getByRole('button', { name: 'Change area' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Sylhet');
  await page.locator('[role=option]', { hasText: 'District' }).first().waitFor({ timeout: 30000 });
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(10000);
  d = await doc();
  const moved = d.items.find((i) => i.kind === 'detail');
  ok('after choosing Sylhet the detail map was still Dhaka\'s: it now looks at the middle of Sylhet', !!moved && moved.centre[0] > 91.3 && moved.centre[0] < 92.4 && moved.centre[1] > 24.4 && moved.centre[1] < 25.3, JSON.stringify(moved?.centre));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const newMain = await scaleBox();
  ok('and 3 times closer than the new main map', Math.abs(moved.scale * 3 / newMain - 1) < 0.05, `1:${moved?.scale} against the main map 1:${newMain}`);
  ok('no crash at the end', (await crashed()) === 0);
  } catch (e) { await page.screenshot({ path: S + 'shots/maps-stopped.png' }).catch(() => {}); log.push('STOPPED ' + String(e.message).replace(/\s+/g, ' ').slice(0, 300)); }
  log.push('errors: ' + (errors.slice(0, 5).join(' | ') || 'none'));
  return log;
}
