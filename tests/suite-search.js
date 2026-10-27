async page => {
  // Search ranking and Start over (from the v0.21 evaluation)
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  const fresh = async () => { await page.goto('http://localhost:4173/'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(3000); };
  const box = () => page.getByRole('combobox', { name: 'Search for a place' }).first();
  for (const [q, want] of [['Paris', /Paris.*France|Île-de-France/], ['Dahka', /Dhaka/], ["Saint Martin's Island", /Martin.*Bangladesh/], ['Lake Victoria', /Lake Victoria/], ['Gazipur', /Gazipur/]]) {
    await fresh();
    await box().fill(q);
    await page.waitForTimeout(6000);
    const rows = (await page.locator('[role=option]').allInnerTexts()).map((t) => t.split('\n').join(' / '));
    const dup = rows.length - new Set(rows).size;
    log.push(`${want.test(rows[0] ?? '') && dup === 0 ? 'PASS' : 'FAIL'} "${q}" first: ${rows[0] ?? 'none'}; identical rows: ${dup}; next: ${rows.slice(1, 4).join(' | ')}`);
  }
  // Start over clears title and search
  await fresh();
  await box().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(7000);
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.waitForTimeout(3500);
  const title = await page.locator('header .title input').inputValue();
  const q = await box().inputValue();
  log.push(`${title === 'Untitled map' && q === '' ? 'PASS' : 'FAIL'} Start over: title "${title}", search box "${q}"`);
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
