async page => {
  // Two page parts that read the map: the table of sample sites (Sylhet District, a CSV of 8 sites) and the elevation profile
  // (a line drawn across the hills to the north, heights read from the terrain tiles). Each is checked on screen, in the
  // SVG and PNG exports and the PDF, and kept over a reload.
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/504|Failed to load resource|overpass/i.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 160)); });
  await page.setViewportSize({ width: 1366, height: 800 });
  const doc = async () => { await page.waitForTimeout(1600); return page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1') || '{}')); };
  const items = async (kind) => (await doc()).doc.items.filter((i) => i.kind === kind);
  const crashed = () => page.getByText('Something went wrong').count();
  const figTexts = () => page.evaluate(() => [...document.querySelectorAll('svg.figure text')].map((t) => t.textContent || ''));
  const start = async (place) => {
    // cleared from a page that is not the app, or the app keeps its map and writes it back as it closes
    await page.goto('http://localhost:4173/favicon.svg');
    await page.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name); });
    await page.goto('http://localhost:4173/');
    await page.waitForTimeout(3000);
    await page.getByRole('combobox', { name: 'Search for a place' }).first().fill(place);
    await page.locator('[role=option]', { hasText: 'District' }).first().waitFor({ timeout: 20000 });
    await page.locator('[role=option]', { hasText: 'District' }).first().click();
    await page.waitForTimeout(10000);
  };
  // a part of Map parts: the rail button only when its tabs are not on show (it closes the panel when they are)
  const openPart = async (name) => {
    if ((await page.locator('aside').getByRole('tab', { name, exact: true }).count()) === 0) await page.locator('nav.rail button', { hasText: 'Map parts' }).first().click();
    await page.locator('aside').getByRole('tab', { name, exact: true }).click();
    await page.waitForTimeout(500);
  };
  const openAdd = () => openPart('Add');
  const tile = (n) => page.locator('aside button.tile', { hasText: n });
  const csv = (text) => ({ name: 'sites.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
  /** pick a part by clicking its middle on the page (positions come from the saved map) */
  const pick = async (it) => {
    const ov = await page.locator('svg.overlay').boundingBox();
    const d = (await doc()).doc;
    await page.mouse.click(ov.x + ((it.x + it.w / 2) / d.widthMm) * ov.width, ov.y + ((it.y + it.h / 2) / d.heightMm) * ov.height);
    await page.waitForTimeout(500);
  };
  const settings = async () => { await page.getByRole('button', { name: 'Settings' }).first().click(); await page.waitForTimeout(600); };
  const back = async () => { await page.getByRole('button', { name: 'Back to the map parts' }).click().catch(() => {}); await page.waitForTimeout(300); };
  const exportAs = async (fmt, file) => {
    await page.getByRole('button', { name: 'Export' }).first().click();
    await page.waitForTimeout(600);
    await page.locator('aside').getByRole('button', { name: new RegExp('^' + fmt) }).first().click();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }).catch(() => null), page.getByRole('button', { name: new RegExp('^Download ' + fmt) }).click()]);
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

  try {
  /* ---------- nothing to make them from yet ---------- */
  await start('Sylhet');
  await page.locator('button.pal.has-menu[aria-label="Map parts"]').click();
  await page.waitForTimeout(400);
  const tIt = page.locator('.flyout [role=menuitem]', { hasText: 'Table of sites' }), pIt = page.locator('.flyout [role=menuitem]', { hasText: 'Elevation profile' });
  ok('tool strip, Map parts: a table and an elevation profile are listed', (await tIt.count()) === 1 && (await pIt.count()) === 1);
  ok('both wait (aria-disabled, with the reason as tooltip) until there are sites and a line', (await tIt.getAttribute('aria-disabled')) === 'true' && (await pIt.getAttribute('aria-disabled')) === 'true' && /sample points/.test((await tIt.getAttribute('title')) || '') && /line/.test((await pIt.getAttribute('title')) || ''));
  await page.keyboard.press('Escape');
  await openAdd();
  ok('Add: a group "Tables and charts" with two tiles', (await page.getByRole('heading', { name: 'Tables and charts' }).count()) === 1 && (await tile('Table of sites').count()) === 1 && (await tile('Elevation profile').count()) === 1);
  ok('both tiles are off with nothing to use', (await tile('Table of sites').isDisabled()) && (await tile('Elevation profile').isDisabled()));
  ok('a hint says why', /sample points/.test(await page.locator('aside').innerText()) && /line drawn on the map/.test(await page.locator('aside').innerText()));

  /* ---------- the table of sites ---------- */
  const own = page.locator('aside details.acc', { hasText: 'Add your own' });
  if (!(await own.getAttribute('open'))) await own.locator('summary').click();
  await page.getByRole('button', { name: /Sample points/ }).first().click();
  await page.waitForTimeout(400);
  await page.locator('aside input[type=file]').first().setInputFiles(csv('site,lat,lon,type,nitrate\nS1,24.9045,91.8611,River water,3.2\nS2,24.8733,91.9248,River water,18.5\nS3,24.9561,91.7984,Groundwater,41\nS4,25.0412,91.9873,Groundwater,7.7\nS5,24.8126,92.0427,River water,118.7\nS6,25.1068,92.1652,Soil,26.4\nS7,24.9877,92.2389,Soil,64\nS8,24.7651,91.7342,Groundwater,1.1\n'));
  await page.waitForTimeout(2000);
  await openAdd();
  ok('the table tile is on once there are sample points; the profile still waits', !(await tile('Table of sites').isDisabled()) && (await tile('Elevation profile').isDisabled()));
  await tile('Table of sites').click();
  await page.waitForTimeout(1500);
  let tb = (await items('table'))[0];
  ok('a table part is added', !!tb && tb.visible, JSON.stringify(tb?.cols));
  ok('it shows the label column, then latitude and longitude', JSON.stringify(tb.cols) === JSON.stringify(['site', '#lat', '#lon']));
  let tx = await figTexts();
  // the names S1 to S8 are also written on the map, so the rows are told apart by their latitudes
  const lat1 = '24°54′16″N', lat8 = '24°45′54″N';
  const latCells = (list) => list.filter((t) => /^\d\d°\d\d′\d\d″N$/.test(t)).length;
  ok('header row and all 8 rows are drawn', ['site', 'Latitude', 'Longitude', lat1, lat8].every((t) => tx.includes(t)) && latCells(tx) === 8);
  ok('latitude and longitude in degrees, minutes, seconds', tx.includes('24°54′16″N') && tx.includes('91°51′40″E'));
  const cell = await page.evaluate(() => { const t = [...document.querySelectorAll('svg.figure text')].find((x) => x.textContent === '24°54′16″N'); const h = [...document.querySelectorAll('svg.figure text')].find((x) => x.textContent === 'Latitude'); return { cell: t?.getAttribute('text-anchor'), head: h?.getAttribute('text-anchor'), weight: h?.getAttribute('font-weight'), baseline: t?.getAttribute('dominant-baseline') }; });
  ok('numbers sit against the right edge, the header is bold, no dominant-baseline (the PDF ignores it)', cell.cell === 'end' && cell.head === 'end' && cell.weight === '700' && !cell.baseline, JSON.stringify(cell));
  const rowH = 1.55 * (tb.labelPt * 25.4) / 72;
  ok('the box is as tall as its rows (header and 8 rows)', Math.abs(tb.h - (9 * rowH + 0.4)) < 0.4, `${tb.h} mm, wanted about ${(9 * rowH + 0.4).toFixed(1)}`);
  ok('text size starts at the journal minimum or 7 pt', tb.labelPt >= 7);

  await settings();
  ok('settings open with the title "Table of sites"', (await page.locator('aside h2.panel-title').first().innerText()) === 'Table of sites');
  await page.getByRole('switch', { name: 'Show the column nitrate' }).click();
  await page.waitForTimeout(500);
  tx = await figTexts();
  tb = (await items('table'))[0];
  ok('a column of the table is switched on: header and values', tx.includes('nitrate') && tx.includes('118.7') && tb.cols.includes('nitrate'));
  ok('the box grows sideways to hold it', tb.w > 38, tb.w + ' mm');
  const numCell = await page.evaluate(() => [...document.querySelectorAll('svg.figure text')].find((x) => x.textContent === '118.7')?.getAttribute('text-anchor'));
  ok('a column of numbers is right-aligned', numCell === 'end');
  await page.getByRole('button', { name: 'Move nitrate left' }).click();
  await page.waitForTimeout(400);
  tb = (await items('table'))[0];
  ok('a column moves with the arrows', JSON.stringify(tb.cols) === JSON.stringify(['site', '#lat', 'nitrate', '#lon']), JSON.stringify(tb.cols));
  await page.getByRole('switch', { name: 'Show the column nitrate' }).click();
  await page.getByRole('button', { name: /^24\.9045°N$/ }).click();
  await page.waitForTimeout(500);
  tx = await figTexts();
  ok('decimal coordinates with four places', tx.includes('24.9045°N') && tx.includes('91.8611°E'));
  await page.getByRole('button', { name: /^24°54′16″N$/ }).click();
  await page.getByRole('switch', { name: 'Show the column No.' }).click();
  await page.waitForTimeout(400);
  tx = await figTexts();
  ok('the No. column counts the sites', tx.includes('No.') && ['1', '2', '8'].every((t) => tx.includes(t)));
  await page.getByRole('switch', { name: 'Show the column No.' }).click();
  await page.getByRole('switch', { name: /Light bands/ }).click();
  await page.getByRole('switch', { name: /^Frame/ }).click();
  await page.getByLabel('Caption above the table (optional)').fill('Table 1. Sampling sites');
  await page.waitForTimeout(600);
  tx = await figTexts();
  const decor = await page.evaluate(() => ({ bands: document.querySelectorAll('svg.figure rect[fill="#EFEFEC"]').length, frames: [...document.querySelectorAll('svg.figure rect')].filter((r) => r.getAttribute('fill') === 'none' && r.getAttribute('stroke') === '#1B1F1D' && !r.closest('[clip-path]')).length }));
  ok('light bands on every second row (4 of 8)', decor.bands === 4, decor.bands + '');
  ok('a hairline frame', decor.frames >= 1);
  ok('a caption above the table', tx.includes('Table 1. Sampling sites'));
  tb = (await items('table'))[0];
  ok('the box is taller by the caption', Math.abs(tb.h - (9 * rowH + 1.4 * rowH + 0.4)) < 0.5, tb.h + ' mm');
  await page.locator('aside input[type=range]').first().fill('10');
  await page.waitForTimeout(600);
  tb = (await items('table'))[0];
  ok('a larger text size makes the box larger', tb.labelPt === 10 && tb.h > 9 * rowH + 4, `${tb.labelPt} pt, ${tb.h} mm`);
  await page.locator('aside input[type=range]').first().fill('7');
  await page.waitForTimeout(600);

  // a box too short for the rows: rows are left out and the check says so
  await page.getByRole('button', { name: 'Back to the map parts' }).click().catch(() => {});
  tb = (await items('table'))[0];
  await pick(tb);
  await settings();
  const hBox = page.locator('aside input[aria-label^="H, Height"]');
  await hBox.fill('16');
  await hBox.press('Tab');
  await page.waitForTimeout(700);
  tb = (await items('table'))[0];
  tx = await figTexts();
  ok('sized by hand: the box keeps its size', tb.fit === false && Math.abs(tb.h - 16) < 0.2, `fit ${tb.fit}, h ${tb.h}`);
  ok('rows that do not fit are left out', tx.includes(lat1) && !tx.includes(lat8) && latCells(tx) === 1);
  const f1 = await findings();
  ok('the check says the table has more rows than fit', /more rows than fit/.test(f1), f1.split('\n').find((l) => /more rows/.test(l)) || '');
  await page.getByText('More options').last().click().catch(() => {});
  await page.getByRole('switch', { name: /Fit the box to the table/ }).click();
  await page.waitForTimeout(700);
  tx = await figTexts();
  ok('"Fit the box to the table" brings every row back', latCells(tx) === 8 && (await items('table'))[0].fit === undefined);
  const f2 = await findings();
  ok('and the warning goes', !/more rows than fit/.test(f2));
  await back();

  // numbers inside the markers: a new table starts with the same numbers
  await openPart('Layers');
  await page.locator('ul[aria-label=Layers] button.name', { hasText: 'sites' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Numbers inside' }).click();
  await page.waitForTimeout(600);
  await openAdd();
  await tile('Table of sites').click();
  await page.waitForTimeout(1500);
  const tables = await items('table');
  ok('with numbered markers a new table starts with the No. column', tables.length === 2 && tables[1].cols[0] === '#no', JSON.stringify(tables[1]?.cols));
  tx = await figTexts();
  ok('its numbers are the numbers on the markers (1 to 8)', ['1', '2', '3', '4', '5', '6', '7', '8'].every((n) => tx.filter((t) => t === n).length >= 2));
  await pick(tables[1]);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(700);
  ok('the second table can be deleted', (await items('table')).length === 1);

  /* ---------- the elevation profile ---------- */
  await openAdd();
  await page.getByRole('button', { name: 'Draw a line on the map' }).click();
  await page.waitForTimeout(500);
  const ov = await page.locator('svg.overlay').boundingBox();
  const P = (fx, fy) => [ov.x + ov.width * fx, ov.y + ov.height * fy];
  await page.mouse.click(...P(0.43, 0.76));
  await page.mouse.click(...P(0.42, 0.58));
  await page.mouse.click(...P(0.46, 0.43));
  await page.mouse.dblclick(...P(0.5, 0.27));
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.count()) await done.first().click();
  await page.waitForTimeout(500);
  await openAdd();
  ok('the profile tile is on once a line is drawn', !(await tile('Elevation profile').isDisabled()));
  await tile('Elevation profile').scrollIntoViewIfNeeded();
  await tile('Elevation profile').click();
  let pr;
  for (let i = 0; i < 40; i++) { pr = (await items('profile'))[0]; if (pr?.data) break; await page.waitForTimeout(2500); }
  ok('an elevation profile part is added', !!pr && pr.visible);
  ok('its heights were read from the terrain tiles: 200 points along the line, zoom about 30 m', !!pr?.data && pr.data.km.length === 200 && pr.data.m.length === 200 && pr.data.z >= 9 && pr.data.z <= 12, pr?.data ? `${pr.data.lenKm} km, z${pr.data.z}, ${Math.min(...pr.data.m)} to ${Math.max(...pr.data.m)} m` : 'no data');
  ok('distance runs from 0 to the great-circle length (a line this long is 20 to 120 km)', !!pr?.data && pr.data.km[0] === 0 && Math.abs(pr.data.km[199] - pr.data.lenKm) < 0.01 && pr.data.lenKm > 20 && pr.data.lenKm < 120);
  ok('the ground rises to the hills in the north (over 150 m)', !!pr?.data && Math.max(...pr.data.m) > 150, pr?.data ? 'max ' + Math.max(...pr.data.m) : '');
  tx = await figTexts();
  ok('axes titled and ends marked', tx.includes('Distance (km)') && tx.includes('Elevation (m)') && tx.filter((t) => t === 'A').length >= 2 && tx.filter((t) => t === 'B').length >= 2, tx.filter((t) => /^[AB]$/.test(t)).join(','));
  ok('"Vertical exaggeration" is written as text', tx.some((t) => /^Vertical exaggeration \d+(\.\d)?×$/.test(t)), tx.find((t) => /exaggeration/.test(t)));
  const onMap = await page.evaluate(() => [...document.querySelectorAll('svg.figure g[clip-path] text')].map((t) => t.textContent).filter((t) => t === 'A' || t === 'B'));
  ok('A and B are also written on the map at the line\'s ends', onMap.includes('A') && onMap.includes('B'), onMap.join(','));
  // the names of every layer come after the drawing of every layer, so a layer drawn later (the drawn line, a lake) never cuts a name below it
  const layerIds = (await doc()).doc.layers.filter((l) => l.kind !== 'study').map((l) => l.id);
  const order = await page.evaluate((ids) => {
    const names = [...document.querySelectorAll('svg.figure text[data-pick*="|label|"]')];
    const shapes = [...document.querySelectorAll('svg.figure [data-pick*="|area|"], svg.figure [data-pick*="|line|"], svg.figure [data-pick*="|point|"]')].filter((e) => ids.includes(e.getAttribute('data-pick').split('|')[0]));
    return { names: names.length, shapes: shapes.length, ok: names.every((n) => shapes.every((s) => !!(s.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING))) };
  }, layerIds);
  ok('map names are drawn after the shapes of every layer', order.names > 5 && order.shapes > 5 && order.ok, `${order.names} names, ${order.shapes} shapes`);
  const ticks = tx.filter((t) => /^\d+$/.test(t));
  ok('the axes have round tick numbers', ticks.includes('0') && ticks.some((t) => ['20', '10', '25', '50'].includes(t)));
  ok('the check does not warn about the profile', !/elevation profile/i.test(await findings()));

  await settings();
  ok('settings open with the title "Elevation profile"', (await page.locator('aside h2.panel-title').first().innerText()) === 'Elevation profile');
  ok('the line list names the layer and the line, with its length', /My drawing, line 1 \(/.test(await page.locator('aside select').first().evaluate((s) => s.options[s.selectedIndex].text)));
  await page.getByRole('switch', { name: /Show the lowest and highest points/ }).click();
  await page.waitForTimeout(500);
  tx = await figTexts();
  ok('the lowest and highest points are written (in metres)', new Set(tx.filter((t) => /^[\d,]+ m$/.test(t))).size === 2, tx.filter((t) => / m$/.test(t)).join(' | '));
  await page.getByRole('switch', { name: /Mark the ends A and B/ }).click();
  await page.waitForTimeout(400);
  tx = await figTexts();
  ok('A and B go off on the chart and on the map', !tx.includes('A') && !tx.includes('B'));
  await page.getByRole('switch', { name: /Mark the ends A and B/ }).click();
  await page.getByRole('switch', { name: /Show the vertical exaggeration/ }).click();
  await page.waitForTimeout(400);
  ok('the exaggeration text goes off', !(await figTexts()).some((t) => /exaggeration/.test(t)));
  await page.getByRole('switch', { name: /Show the vertical exaggeration/ }).click();
  const before = await page.evaluate(() => [...document.querySelectorAll('svg.figure path')].filter((p) => p.getAttribute('fill-opacity') === '0.22').length);
  await page.getByRole('button', { name: 'Use vermillion' }).click();
  await page.getByRole('switch', { name: 'Fill under the line' }).click();
  await page.waitForTimeout(500);
  const look2 = await page.evaluate(() => ({ line: [...document.querySelectorAll('svg.figure path')].some((p) => p.getAttribute('stroke') === '#D55E00' && p.getAttribute('fill') === 'none' && (p.getAttribute('d') || '').length > 800), fill: [...document.querySelectorAll('svg.figure path')].filter((p) => p.getAttribute('fill-opacity') === '0.22').length }));
  ok('line colour changes; the fill can be switched off', before >= 1 && look2.line && look2.fill === 0, `${before} fills before, ${look2.fill} after`);
  await page.getByRole('switch', { name: 'Fill under the line' }).click();
  pr = (await items('profile'))[0];
  ok('the profile keeps its heights with the part (saved with the map)', !!pr.data && pr.data.km.length === 200);

  /* ---------- exports ---------- */
  await back();
  const svg = await exportAs('SVG', 'parts-test.svg');
  ok('SVG export holds both parts as text', svg.size > 100000 && /Distance \(km\)/.test(svg.text) && /Table 1\. Sampling sites/.test(svg.text) && /Vertical exaggeration/.test(svg.text), svg.size + ' bytes');
  ok('SVG: plain attributes only (no dominant-baseline, no data-pick)', !/dominant-baseline/.test(svg.text) && !/data-pick/.test(svg.text));
  const pdf = await exportAs('PDF', 'parts-test.pdf');
  ok('PDF export works', pdf.size > 150000, pdf.size + ' bytes');
  const png = await exportAs('PNG', 'parts-test.png');
  ok('PNG export works', png.size > 500000, png.size + ' bytes');
  ok('no crash', (await crashed()) === 0);

  /* ---------- kept over a reload, undo ---------- */
  await page.reload();
  await page.waitForTimeout(5000);
  tx = await figTexts();
  ok('both parts come back after a reload, the chart without waiting for the network', tx.includes('Distance (km)') && tx.includes('Table 1. Sampling sites') && latCells(tx) === 8);
  await pick((await items('profile'))[0]);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(700);
  ok('a profile can be deleted', (await items('profile')).length === 0 && !(await figTexts()).includes('Distance (km)'));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(1500);
  ok('and Undo brings it back with its heights', (await items('profile')).length === 1 && !!(await items('profile'))[0].data && (await figTexts()).includes('Distance (km)'));
  ok('no crash at the end', (await crashed()) === 0);
  } catch (e) { log.push('STOPPED ' + String(e.message).replace(/\s+/g, ' ').slice(0, 300)); }
  log.push('errors: ' + (errors.slice(0, 5).join(' | ') || 'none'));
  return log;
}
