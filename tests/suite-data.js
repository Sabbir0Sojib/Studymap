async page => {
  // Styling by a table: sample sites coloured, sized and numbered by their columns (Sylhet), areas coloured from a table (Dhaka),
  // names for drawn shapes; each checked on screen and in the PDF, and kept over a reload.
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/504|Failed to load resource|overpass/i.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 160)); });
  await page.setViewportSize({ width: 1366, height: 800 });
  const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1') || '{}'));
  const crashed = () => page.getByText('Something went wrong').count();
  const figTexts = () => page.evaluate(() => [...document.querySelectorAll('svg.figure text')].map((t) => t.textContent || ''));
  const start = async (place) => {
    // cleared from a page that is not the app, or the app keeps its map and writes it back as it closes
    await page.goto('http://localhost:4173/favicon.svg');
    await page.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name); });
    await page.goto('http://localhost:4173/');
    await page.waitForTimeout(3000);
    await page.getByRole('combobox', { name: 'Search for a place' }).first().fill(place);
    await page.locator('[role=option]', { hasText: 'District' }).first().waitFor({ timeout: 15000 });
    await page.locator('[role=option]', { hasText: 'District' }).first().click();
    await page.waitForTimeout(9000);
  };
  const openLayers = async () => {
    const parts = page.locator('nav.rail button', { hasText: 'Map parts' }).first();
    if ((await parts.getAttribute('aria-pressed')) !== 'true') await parts.click();
    await page.getByRole('tab', { name: 'Layers', exact: true }).click();
    await page.waitForTimeout(300);
  };
  const csv = (text, name = 'data.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });
  const exportPdf = async () => {
    await page.getByRole('button', { name: 'Export' }).first().click();
    await page.waitForTimeout(600);
    await page.locator('aside').getByRole('button', { name: /^PDF/ }).first().click();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }).catch(() => null), page.getByRole('button', { name: /^Download PDF/ }).click()]);
    if (!dl) return 0;
    await dl.saveAs(S + 'out/data-test.pdf');
    let n = 0;
    for await (const chunk of await dl.createReadStream()) n += chunk.length;
    return n;
  };

  /* ---------- sample sites ---------- */
  await start('Sylhet');
  await openLayers();
  await page.locator('select[aria-label="Add a layer"]').selectOption('file');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Sample points/ }).first().click();
  await page.waitForTimeout(400);
  await page.locator('aside input[type=file]').first().setInputFiles(csv(
    'site,lat,lon,type,nitrate\nS1,24.9045,91.8611,River water,3.2\nS2,24.8733,91.9248,River water,18.5\nS3,24.9561,91.7984,Groundwater,41\nS4,25.0412,91.9873,Groundwater,7.7\nS5,24.8126,92.0427,River water,118.7\nS6,25.1068,92.1652,Soil,26.4\nS7,24.9877,92.2389,Soil,64\nS8,24.7651,91.7342,Groundwater,1.1\nS9,24.91,92.08,Soil,\n'));
  await page.waitForTimeout(2000);
  await page.getByRole('heading', { name: 'Style by a column' }).scrollIntoViewIfNeeded();
  ok('Style by a column is offered for a points layer', true);
  const dotsFill = () => page.evaluate(() => [...document.querySelectorAll('svg.figure path[data-pick*="|point|"]')].map((p) => p.getAttribute('fill')));
  const before = await dotsFill();
  ok('one colour for all by default', new Set(before).size === 1, before[0]);

  await page.getByLabel('Colour by').selectOption('type');
  await page.waitForTimeout(700);
  const colours = await dotsFill();
  ok('each type gets its own colour', new Set(colours).size === 3, [...new Set(colours)].join(' '));
  let tx = await figTexts();
  ok('legend has one line per type', ['River water', 'Groundwater', 'Soil'].every((t) => tx.includes(t)));
  ok('"Sample site" line is replaced by the types', !tx.includes('Sample site'));
  // a category's legend text and colour can be changed
  await page.getByLabel('Legend text for Soil').fill('Soil (0–15 cm)');
  await page.waitForTimeout(400);
  tx = await figTexts();
  ok('legend text of one type edited', tx.includes('Soil (0–15 cm)'));

  await page.getByLabel('Symbol by').selectOption('type');
  await page.waitForTimeout(500);
  // a circle, a triangle and a square are told apart by the commands of their outlines
  const shapes = await page.evaluate(() => new Set([...document.querySelectorAll('svg.figure path[data-pick*="|point|"]')].map((p) => (p.getAttribute('d') || '').replace(/[-\d.e]+/g, ''))).size);
  ok('symbol by type gives different shapes', shapes >= 3, shapes + ' shapes');

  await page.getByLabel('Size by').selectOption('nitrate');
  await page.waitForTimeout(600);
  const radii = await page.evaluate(() => [...document.querySelectorAll('svg.figure path[data-pick*="|point|"]')].map((p) => (p.getAttribute('d') || '').length));
  tx = await figTexts();
  ok('size key in the legend: heading and three values', tx.includes('nitrate') && tx.includes('2') && tx.includes('50') && tx.includes('100'), tx.filter((t) => /^(nitrate|2|50|100)$/.test(t)).join(','));
  await page.getByRole('button', { name: 'Area (square root)' }).click();
  await page.waitForTimeout(400);
  ok('sizes follow the column (circle widths differ)', await page.evaluate(() => new Set([...document.querySelectorAll('svg.figure path[data-pick*="|point|"]')].map((p) => Math.round(Math.abs(Number((p.getAttribute('d') || '').match(/^M(-?[\d.]+)/)?.[1] ?? 0)) * 100))).size) >= 5);
  let d = await doc();
  const pts = d.doc.layers.find((l) => l.kind === 'points');
  ok('style kept on the layer', pts.pointsBy?.colorField === 'type' && pts.pointsBy?.sizeField === 'nitrate' && pts.pointsBy?.sizeScale === 'sqrt', JSON.stringify(pts.pointsBy));

  // numbered markers
  await page.getByLabel('Colour by').selectOption('');
  await page.getByRole('button', { name: 'Numbers inside' }).click();
  await page.waitForTimeout(700);
  tx = await figTexts();
  ok('numbers 1 to 9 inside the markers', ['1', '2', '3', '4', '5', '6', '7', '8', '9'].every((n) => tx.includes(n)));
  ok('numbered legend entry "1–9 Sampling sites"', tx.includes('1–9 Sampling sites'), tx.filter((t) => /Sampling/.test(t)).join('|'));
  const pdf1 = await exportPdf();
  ok('PDF with numbered markers exports', pdf1 > 20000, pdf1 + ' bytes');
  ok('no crash', (await crashed()) === 0);

  // kept over a reload
  await page.reload();
  await page.waitForTimeout(5000);
  tx = await figTexts();
  ok('numbers and legend come back after a reload', tx.includes('1–9 Sampling sites') && tx.includes('9'));

  /* ---------- drawn shapes: symbol and name ---------- */
  await openLayers();
  await page.locator('select[aria-label="Add a layer"]').selectOption('custom');
  await page.waitForTimeout(700);
  const ov = await page.locator('svg.overlay').boundingBox();
  await page.locator('.draw-tools button', { hasText: 'Point' }).click();
  await page.mouse.click(ov.x + ov.width * 0.3, ov.y + ov.height * 0.62);
  await page.mouse.click(ov.x + ov.width * 0.55, ov.y + ov.height * 0.4);
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.count()) await done.first().click();
  await page.waitForTimeout(500);
  await page.getByRole('heading', { name: 'Symbols' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Triangle' }).click();
  await page.waitForTimeout(400);
  const tri = await page.evaluate(() => [...document.querySelectorAll('svg.figure path[data-pick*="|point|"]')].filter((p) => /^M0,-/.test(p.getAttribute('d') || '')).length);
  ok('a drawn point can be a triangle', tri >= 2, tri + ' triangles');
  await page.mouse.click(ov.x + ov.width * 0.3, ov.y + ov.height * 0.62);
  await page.waitForTimeout(300);
  await page.mouse.click(ov.x + ov.width * 0.3, ov.y + ov.height * 0.62);
  await page.waitForTimeout(600);
  const nameBox = page.locator('section.feature input[type=text]').first();
  ok('the "this feature" card has a Name field for a drawn point', (await nameBox.count()) === 1);
  await nameBox.fill('Pond A');
  await nameBox.press('Enter');
  await page.waitForTimeout(700);
  tx = await figTexts();
  ok('the name is printed on the map', tx.includes('Pond A'));
  d = await doc();
  ok('the name is the shape\'s properties.name', JSON.stringify(Object.values(d.geoms).flatMap((g) => g.features.map((f) => f.properties.name))).includes('Pond A'));

  /* ---------- colour areas by a table ---------- */
  await start('Dhaka');
  await openLayers();
  await page.locator('ul[aria-label=Layers] button.name', { hasText: 'Sub-areas' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('heading', { name: 'Colour areas by a value' }).scrollIntoViewIfNeeded();
  await page.locator('aside textarea').fill('Upazila,Population\nSavar,1370000\nDhamrai Upazila,430000\nKeranigonj,1100000\nNawabgonj,370000\nDohar,260000\nBadda,520000\nDemra,610000\nKafrul,330000\nDhanmondee,300000\nChittagong Road,100\n');
  await page.getByRole('button', { name: 'Colour the areas' }).click();
  await page.waitForTimeout(1200);
  ok('names matched in spite of spelling, case and "Upazila"', /Matched 8 of 10/.test(await page.locator('aside').innerText()), (await page.locator('aside .msg').first().innerText()).replace(/\n/g, ' '));
  const unm = await page.locator('.unm .un').allInnerTexts();
  ok('unmatched names are listed to fix', unm.length === 2 && unm.includes('Dhanmondee'), unm.join(', '));
  tx = await figTexts();
  ok('legend: heading, classes with separators, No data', tx.includes('Population') && tx.some((t) => /\d–\d/.test(t) && /,/.test(t)) && tx.includes('No data'), tx.filter((t) => /–|No data|^Population/.test(t)).join(' | '));
  const fills = await page.evaluate(() => new Set([...document.querySelectorAll('svg.figure path[data-pick*="|area|"]')].map((p) => p.getAttribute('fill'))).size);
  ok('areas coloured by class (several colours)', fills >= 4, fills + ' fills');
  // fix one name by hand
  await page.getByLabel('Area for Dhanmondee').selectOption({ label: 'Dhanmondi' }).catch(() => {});
  await page.waitForTimeout(700);
  ok('one name fixed by hand', /Matched 9 of 10/.test(await page.locator('aside').innerText()), (await page.locator('aside .msg').first().innerText()).replace(/\n/g, ' '));
  // method and palette
  for (const m of ['Equal intervals', 'Quantiles', 'Natural breaks']) { await page.getByRole('button', { name: m, exact: true }).click(); await page.waitForTimeout(300); }
  await page.getByRole('button', { name: 'Blues' }).click();
  await page.getByRole('switch', { name: /Reverse the colours/ }).click();
  await page.waitForTimeout(400);
  ok('palette, reverse and methods apply without a crash', (await crashed()) === 0);
  d = await doc();
  const sub = d.doc.layers.find((l) => l.kind === 'subunits');
  ok('table kept on the layer, not written into the areas', !!sub.choro?.table && sub.choro.palette === 'blues' && sub.choro.reverse === true && !sub.featureStyle, `${sub.choro?.method} ${sub.choro?.palette}`);
  await page.getByLabel('Legend title').fill('People (2022)');
  await page.waitForTimeout(400);
  tx = await figTexts();
  ok('legend title is editable', tx.includes('People (2022)'));
  const pdf2 = await exportPdf();
  ok('PDF with the colours exports', pdf2 > 50000, pdf2 + ' bytes');
  await page.reload();
  await page.waitForTimeout(5000);
  tx = await figTexts();
  ok('colours and legend come back after a reload', tx.includes('People (2022)') && tx.includes('No data'));
  ok('no crash', (await crashed()) === 0);
  log.push('errors: ' + (errors.slice(0, 5).join(' | ') || 'none'));
  return log;
}
