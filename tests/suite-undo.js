async page => {
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1') || '{}').doc);
  const settle = () => page.waitForTimeout(3500);
  // the tool strip keeps Select, Hand, Text and Picture as buttons; Map parts and Shapes open a menu first (v0.35)
  const FAMILY = { 'Add legend': 'Map parts', 'Add scale bar': 'Map parts', 'Add north arrow': 'Map parts', 'Add inset map': 'Map parts', 'Add rectangle': 'Shapes', 'Add ellipse': 'Shapes', 'Add line': 'Shapes', 'Add arrow': 'Shapes' };
  const pickTool = async (name) => { const f = FAMILY[name]; if (f) { await page.locator('.palette').getByRole('button', { name: f, exact: true }).click(); await page.getByRole('menuitem', { name }).click(); } else await page.getByRole('button', { name }).click(); };
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  const box = await page.locator('svg.overlay').boundingBox();
  const n0 = (await doc()).items.length;
  const counts = [n0];
  for (const [i, tool] of ['Add rectangle', 'Add ellipse', 'Add text'].entries()) {
    await pickTool(tool);
    const x = box.x + 100 + i * 120, y = box.y + 100;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y + 40, { steps: 4 }); await page.mouse.up();
    if (tool === 'Add text') { await page.waitForTimeout(300); await page.keyboard.press('Enter'); } // a new text opens for typing; Esc would cancel it
    await page.keyboard.press('Escape');
    await settle();
    counts.push((await doc()).items.length);
  }
  log.push('after each add: ' + counts.join(' → '));
  await page.locator('svg.overlay').focus();
  const und = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+z'); await settle(); und.push((await doc()).items.length); }
  log.push('after each undo: ' + und.join(' → '));
  const red = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+y'); await settle(); red.push((await doc()).items.length); }
  log.push('after each redo: ' + red.join(' → '));
  // draw an area, undo returns Dhaka with its outline
  await page.locator('nav.rail button', { hasText: 'Place' }).first().getAttribute('aria-pressed').then(async (p) => { if (p !== 'true') await page.locator('nav.rail button', { hasText: 'Place' }).first().click(); });
  if (!(await page.getByRole('button', { name: 'Draw', exact: true }).count())) await page.getByRole('button', { name: 'Change area' }).click(); // v0.23: the chooser folds away once an area exists
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 330, box.y + 300, { steps: 5 }); await page.mouse.up();
  await settle();
  const drawn = (await doc()).study.source;
  await page.locator('svg.overlay').focus();
  await page.keyboard.press('Control+z');
  await settle();
  const back = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('studymap.autosave.v1')); return s.doc.study.source + ' / ' + s.doc.study.name; });
  log.push(`draw then undo: ${drawn} → ${back}`);
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
