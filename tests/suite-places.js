async page => {
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/504|Failed to load resource|overpass/i.test(m.text())) errors.push(m.text().slice(0, 150)); });
  await page.setViewportSize({ width: 1366, height: 768 });
  const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1') || '{}').doc);
  // clear the saved map from a page that is not the app: the app saves its map again when its own page is left (pagehide), which would bring the old map back
  const fresh = async () => { await page.goto('http://localhost:4173/favicon.svg'); await page.evaluate(() => localStorage.clear()); await page.goto('http://localhost:4173/'); await page.waitForTimeout(2500); };
  const cases = [
    ['Dhaka', 'District', 'Dhaka District'],
    ['Chittagong', 'District', 'Chittagong District'],
    ["Saint Martin's Island", 'Martin', "St. Martin's Island"],
    ['Sylhet', 'District', 'Sylhet District'],
    ['Sundarbans', 'Khulna', 'Sundarbans'],
    ['Bangladesh', 'Country', 'Bangladesh'],
    ['Kathmandu', 'District', 'Kathmandu District'],
    ['Nairobi', 'Kenya', ''],
    ['Lake Victoria', 'Lake', 'Lake Victoria'],
    ['Lyon', 'France', 'Lyon'],
  ];
  for (const [q, has, want] of cases) {
    await fresh();
    const t0 = Date.now();
    await page.getByRole('combobox', { name: 'Search for a place' }).first().fill(q);
    const opt = page.locator('[role=option]', { hasText: has }).first();
    // official boundaries of another country arrive once its name lists are downloaded (slow when GitHub is busy)
    try { await opt.waitFor({ timeout: 40000 }); } catch { log.push(`FAIL ${q}: no result containing "${has}"`); continue; }
    const first = (await page.locator('[role=option]').first().innerText()).split('\n').join(' / ');
    await opt.click();
    await page.waitForTimeout(9000);
    const d = await doc();
    const labels = await page.locator('svg.figure text').count();
    const pill = (await page.locator('header button.check').innerText()).split('\n').join(' ');
    const good = d.study.source !== 'none' && (!want || d.study.name === want) && labels > 8;
    log.push(`${good ? 'PASS' : 'FAIL'} ${q} → ${d.study.name} [${d.study.source}] ${Math.round((Date.now() - t0) / 1000)} s, ${labels} texts, check: ${pill}; first result: ${first}`);
    await page.mouse.move(2, 2);
    await page.evaluate(() => document.querySelectorAll('.sel, .handle, .hit, .grip, .mapzoom').forEach((x) => x.remove()));
    await page.locator('div.page').screenshot({ path: S + 'shots/place-' + q.replace(/\W+/g, '_') + '.png' });
  }
  // shapefile from a file (loose parts) and CSV points
  await fresh();
  await page.getByRole('button', { name: 'Your file', exact: true }).click();
  await page.locator('input[type=file][multiple]').setInputFiles(['shp', 'dbf', 'shx', 'prj', 'cpg'].map((e) => S + 'data/npl2.' + e));
  await page.waitForTimeout(3000);
  const info = await page.locator('aside').innerText();
  const m = info.match(/(\d+) areas/);
  log.push(`${m ? 'PASS' : 'FAIL'} shapefile read: ${m ? m[0] : 'no count'}`);
  await page.getByRole('button', { name: /Use the whole file/ }).click();
  await page.waitForTimeout(7000);
  const d2 = await doc();
  log.push(`${d2.study.source === 'layer' ? 'PASS' : 'FAIL'} shapefile as study area → ${d2.study.name}, country ${d2.study.countryName}`);
  const parts = page.locator('nav.rail button', { hasText: 'Map parts' }).first();
  if ((await parts.getAttribute('aria-pressed')) !== 'true') await parts.click();
  await page.getByRole('tab', { name: 'Layers', exact: true }).click(); // Layers is a part of Map parts
  await page.locator('select[aria-label="Add a layer"]').selectOption('file'); // opens Add, with "Add your own" unfolded
  await page.waitForTimeout(500);
  const pts = page.getByRole('button', { name: /Sample points/ });
  if (await pts.count()) {
    await pts.first().click();
    await page.waitForTimeout(500);
    const csvInput = page.locator('aside input[type=file]').first();
    await csvInput.setInputFiles(S + 'data/points.csv');
    await page.waitForTimeout(2500);
    const msg = await page.locator('aside').innerText();
    log.push(`${/Loaded 4 features|Added 4 points/.test(msg) ? 'PASS' : 'FAIL'} CSV points: ${(msg.match(/(Loaded|Added)[^\n]*/) || ['no message'])[0]}`);
  } else log.push('SKIP CSV points: button not found');
  await page.screenshot({ path: S + 'shots/file-nepal.png' });
  log.push('errors: ' + (errors.slice(0, 5).join(' | ') || 'none'));
  return log;
}
