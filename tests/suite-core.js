async page => {
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/504|Failed to load resource|overpass/i.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 160)); });
  await page.setViewportSize({ width: 1366, height: 768 });
  const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1') || '{}').doc);
  const crashed = () => page.getByText('Something went wrong').count();
  // the tool strip keeps Select, Hand, Text and Picture as buttons; Map parts and Shapes open a menu first (v0.35)
  const FAMILY = { 'Add legend': 'Map parts', 'Add scale bar': 'Map parts', 'Add north arrow': 'Map parts', 'Add inset map': 'Map parts', 'Add rectangle': 'Shapes', 'Add ellipse': 'Shapes', 'Add line': 'Shapes', 'Add arrow': 'Shapes' };
  const pickTool = async (name) => { const f = FAMILY[name]; if (f) { await page.locator('.palette').getByRole('button', { name: f, exact: true }).click(); await page.getByRole('menuitem', { name }).click(); } else await page.getByRole('button', { name }).click(); };
  // open a side tab without toggling it closed when it is already open
  const go = async (name) => { const b = page.locator('nav.rail button', { hasText: name }).first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); await page.waitForTimeout(400); };
  // Design and Map parts show one tab at a time (v0.24): open the one that holds the control
  const tab = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(300); };
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
  ok('start page loads with world map', (await page.locator('svg.figure path').count()) > 50);
  ok('Next is disabled before a place', await page.getByRole('button', { name: /Choose a place first/ }).isDisabled());

  // search speed
  const box0 = page.getByRole('combobox', { name: 'Search for a place' }).first();
  let t = Date.now();
  await box0.fill('Dhaka');
  await page.locator('[role=option].official').first().waitFor({ timeout: 10000 });
  const tAdmin = Date.now() - t;
  ok('official boundary result appears fast', tAdmin < 3000, tAdmin + ' ms'); // includes the public search service's own answer time
  t = Date.now();
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc.study.name === 'Dhaka District'; } catch { return false; } }, null, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('svg.figure text').length > 20, null, { timeout: 20000 });
  ok('Dhaka District drawn', true, (Date.now() - t) + ' ms to map');
  await page.waitForTimeout(4000);
  const pill = await page.locator('header button.check').innerText();
  ok('journal check says Ready', /Ready/.test(pill), pill.replace(/\n/g, ' '));
  ok('search list closed after pick', (await page.locator('[role=option]:visible').count()) === 0);

  // pan / zoom smoothness
  await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); });
  const box = await page.locator('svg.overlay').boundingBox();
  const cx = box.x + box.width * 0.35, cy = box.y + box.height * 0.55;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
  await page.waitForTimeout(1200);
  await page.mouse.down(); for (let i = 0; i < 25; i++) await page.mouse.move(cx + i * 5, cy + i * 2); await page.mouse.up();
  await page.waitForTimeout(1200);
  const lt = await page.evaluate(() => window.__lt);
  ok('zoom and pan stay smooth (no task > 200 ms)', !lt.some((x) => x > 200), JSON.stringify(lt));

  // scale box
  await page.locator('#map-scale').click();
  await page.locator('#map-scale').fill('1:250,000');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  ok('scale box 1:250,000', (await page.locator('#map-scale').inputValue()) === '250,000', await page.locator('#map-scale').inputValue());
  await go('Place');
  await page.getByRole('button', { name: 'Zoom to it' }).click();
  await page.waitForTimeout(1000);

  // every layout + style
  await go('Design');
  await tab('Layout');
  await page.waitForTimeout(400);
  const nT = await page.locator('button.tpl').count();
  for (let i = 0; i < nT; i++) { await page.locator('button.tpl').nth(i).click(); await page.waitForTimeout(1500); }
  ok('all layouts apply', nT === 8 && (await crashed()) === 0, nT + ' layouts');
  await tab('Colours');
  for (const st of ['Terrain', 'Atlas', 'Soft grey', 'Black & white', 'Field green', 'Classic']) { await page.getByRole('button', { name: new RegExp('^' + st) }).first().click(); await page.waitForTimeout(1200); }
  await tab('Layout');
  await page.locator('button.tpl').first().click();
  await page.waitForTimeout(2500);
  ok('all styles apply', (await crashed()) === 0);

  // overlap check after layouts
  const pill2 = await page.locator('header button.check').innerText();
  ok('no overlaps reported in Classic layout', /Ready/.test(pill2), pill2.replace(/\n/g, ' '));

  // switches on/off
  await go('Map parts');
  let nSw = 0; // the switches are spread over three tabs
  for (const t of ['Essentials', 'On the map', 'Inset maps']) {
    await tab(t);
    const sw = await page.getByRole('switch').all();
    for (const s of sw) { await s.click(); await page.waitForTimeout(100); await s.click(); await page.waitForTimeout(100); }
    nSw += sw.length;
  }
  ok('every switch toggles', nSw >= 14 && (await crashed()) === 0, nSw + ' switches');

  // palette tools
  const tools = ['Add text', 'Add legend', 'Add scale bar', 'Add north arrow', 'Add inset map', 'Add rectangle', 'Add ellipse', 'Add line', 'Add arrow'];
  const before = (await doc()).items.length;
  let k = 0;
  for (const tool of tools) {
    await pickTool(tool);
    const x = box.x + 80 + (k % 3) * 110, y = box.y + 70 + Math.floor(k / 3) * 80;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 50, y + 30, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(250); k++;
  }
  await page.waitForTimeout(3500);
  const after = (await doc()).items.length;
  ok('palette adds new items', after > before, `${before} → ${after} items`);
  // align and order live in the toolbar's Arrange menu (v0.23)
  let used = 0;
  for (const b of ['Left', 'Centre', 'Right', 'Top', 'Middle', 'Bottom', 'To front', 'To back']) {
    if ((await page.locator('.arrbtn').getAttribute('aria-expanded')) !== 'true') await page.locator('.arrbtn').click();
    await page.waitForTimeout(150);
    const bt = page.getByRole('menuitem', { name: b, exact: true });
    if (await bt.count()) { await bt.click(); used++; }
    await page.waitForTimeout(80);
  }
  ok('align/order buttons work', used === 8 && (await crashed()) === 0, `${used} of 8 from the Arrange menu`);

  // undo / redo many
  await page.locator('svg.overlay').focus();
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(60); }
  await page.waitForTimeout(3500);
  const afterUndo = (await doc()).items.length;
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Control+y'); await page.waitForTimeout(60); }
  await page.waitForTimeout(3500);
  const afterRedo = (await doc()).items.length;
  ok('undo removes added items, redo brings them back', afterUndo < after && afterRedo === after, `undo ${afterUndo}, redo ${afterRedo}`);
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(40); }
  await page.waitForTimeout(1200);

  // map settings
  // the main map's settings: Map parts, Essentials, "Main map settings" (Layers lists only the map's layers now)
  await go('Map parts');
  await tab('Essentials');
  await page.getByRole('button', { name: /^Main map settings/ }).click();
  await page.waitForTimeout(400);
  for (const p of ['Journal', 'All four sides', 'Zebra frame', 'Crosses', 'UTM metres', 'Journal']) { await page.getByRole('group', { name: 'Grid looks' }).first().getByRole('button', { name: p, exact: true }).click(); await page.waitForTimeout(600); }
  await page.getByRole('spinbutton', { name: 'Map rotation in degrees' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Map rotation in degrees' }).press('Enter');
  await page.waitForTimeout(1500);
  await page.getByRole('spinbutton', { name: 'Map rotation in degrees' }).fill('0');
  await page.getByRole('spinbutton', { name: 'Map rotation in degrees' }).press('Enter');
  await page.waitForTimeout(800);
  ok('grid presets and rotation', (await crashed()) === 0);

  // exports
  await page.getByRole('button', { name: 'Export' }).first().click();
  await page.waitForTimeout(600);
  const files = [];
  for (const fmt of ['PDF', 'SVG', 'PNG', 'TIFF']) {
    await page.locator('aside').getByRole('button', { name: new RegExp('^' + fmt) }).first().click();
    await page.waitForTimeout(300);
    if (fmt === 'PNG') { const inp = page.locator('.custom-dpi input'); await inp.fill('300'); await inp.press('Enter'); await page.waitForTimeout(300); }
    if (fmt === 'TIFF') { const inp = page.locator('.custom-dpi input'); await inp.fill('600'); await inp.press('Enter'); await page.waitForTimeout(300); }
    const t0 = Date.now();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }).catch(() => null), page.getByRole('button', { name: /^Download (PDF|SVG|PNG|TIFF)/ }).click()]);
    if (dl) { const name = dl.suggestedFilename(); await dl.saveAs(S + 'out/' + name); files.push(name); ok(fmt + ' export', true, name + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s'); }
    else ok(fmt + ' export', false);
    await page.waitForTimeout(500);
  }
  // caption
  const cap = await page.locator('.caption').innerText().catch(() => '');
  ok('caption with credits', /geoBoundaries/.test(cap) && /Natural Earth/.test(cap), cap.slice(0, 120));

  // reload keeps map
  await page.reload();
  await page.waitForTimeout(6000);
  ok('reload keeps the map', (await doc()).study.name === 'Dhaka District' && (await page.locator('svg.figure text').count()) > 20);
  ok('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  return log;
}
