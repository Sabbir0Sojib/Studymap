async page => {
  // Text editing on the page and the Grid menu (v0.21: typing went nowhere, the Grid button seemed dead)
  const log = [];
  page.on('pageerror', (e) => log.push('PAGEERROR ' + e.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc);
  const texts = async () => (await doc()).items.filter((i) => i.kind === 'title').map((i) => `${i.text}@${i.x},${i.y}`).join(' | ');
  const b = await page.locator('svg.overlay').boundingBox();
  let d = await doc();
  const k = b.width / d.widthMm;
  const P = (x, y) => [b.x + x * k, b.y + y * k];
  // 1. drag-add a text, then type straight away after double-click
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.mouse.move(...P(30, 20)); await page.mouse.down(); await page.mouse.move(...P(80, 30), { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(800);
  await page.mouse.dblclick(...P(55, 25));
  await page.waitForTimeout(400);
  await page.keyboard.type('Hello');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  let t = await texts();
  log.push(`${/Hello@/.test(t) && !/Text/.test(t) ? 'PASS' : 'FAIL'} type after double-click: ${t}`);
  // 2. arrow nudge after Enter
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(3500);
  t = await texts();
  log.push(`${/Hello@30\.5,20/.test(t) ? 'PASS' : 'FAIL'} arrow nudges text after Enter: ${t}`);
  // 3. a second text by single click
  await page.getByRole('button', { name: 'Add text' }).click();
  log.push('Add text armed: ' + (await page.getByRole('button', { name: 'Add text' }).getAttribute('aria-pressed')));
  await page.mouse.click(...P(60, 60));
  await page.waitForTimeout(400);
  await page.keyboard.type('Second');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  t = await texts();
  log.push(`${t.split('|').length === 2 && /Second@/.test(t) ? 'PASS' : 'FAIL'} second text by click, typed at once: ${t}`);
  // 4. Escape reverts
  const second = (await doc()).items.filter((i) => i.kind === 'title')[1];
  await page.mouse.dblclick(...P(second.x + second.w / 2, second.y + second.h / 2));
  await page.waitForTimeout(400);
  await page.keyboard.type('Wrong');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3500);
  t = await texts();
  log.push(`${!/Wrong/.test(t) ? 'PASS' : 'FAIL'} Esc cancels: ${t}`);
  // 5. Edit text button in toolbar
  await page.getByRole('button', { name: 'Edit text' }).click();
  await page.waitForTimeout(400);
  await page.keyboard.type('Study area');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  t = await texts();
  log.push(`${/Study area@/.test(t) ? 'PASS' : 'FAIL'} Edit text button: ${t}`);
  // 6. Grid: select main map, click Grid
  await page.mouse.click(...P(d.items.find((i) => i.kind === 'map').x + 20, d.items.find((i) => i.kind === 'map').y + 40));
  await page.waitForTimeout(500);
  await page.locator('.gridbtn').click();
  await page.waitForTimeout(600);
  const pop = page.locator('.gridpop');
  const vis = await pop.isVisible().catch(() => false);
  const box = vis ? await pop.boundingBox() : null;
  log.push(`${vis ? 'PASS' : 'FAIL'} Grid popover opens: ${vis ? JSON.stringify(box) : 'not visible'}`);
  if (vis) {
    const cb = pop.getByRole('switch').first(); // the grid on/off is a switch
    const before = await cb.isChecked().catch(() => null);
    await cb.click().catch((e) => log.push('click err ' + e.message.split('\n')[0]));
    await page.waitForTimeout(3500);
    const m = (await doc()).items.find((i) => i.kind === 'map');
    log.push(`${before !== (await cb.isChecked().catch(() => null)) ? 'PASS' : 'FAIL'} grid checkbox ${before} -> ${await cb.isChecked().catch(() => null)}; map.grid.show=${m.grid?.show}; grid lines drawn=${await page.locator('svg .grid line, svg g.grid path, [class*=grid] line').count()}`);
  }
  return log;
}
