async page => {
  // v0.27: a click on an empty part of the page (or the grey desk) selects the page and shows its size tools
  const S = (globalThis.STUDYMAP_TESTS ?? '') + 'shots/'; // set by tests/run.mjs
  const log = []; const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, t) => log.push(`${c ? 'PASS' : 'FAIL'} ${t}`);
  const doc = async () => { await page.waitForTimeout(800); return page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc); };
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(2500);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  let d = await doc();
  // click an empty part of the page: below the legend in the right column
  const b = await page.locator('svg.overlay').boundingBox();
  const k = b.width / d.widthMm;
  await page.mouse.click(b.x + (d.widthMm - 4) * k, b.y + (d.heightMm - 3) * k);
  await page.waitForTimeout(400);
  const bar = page.getByRole('group', { name: 'Page tools' });
  ok(await bar.count() === 1, 'click on an empty part of the page shows the page tools');
  await page.screenshot({ path: S + 'pg-tools.png' });
  const w0 = d.widthMm, h0 = d.heightMm;
  await bar.getByRole('button', { name: 'Wider by 10 mm' }).click();
  await bar.getByRole('button', { name: 'Taller by 10 mm' }).click();
  d = await doc();
  ok(d.widthMm === w0 + 10 && d.heightMm === h0 + 10, `wider and taller: ${w0}x${h0} → ${d.widthMm}x${d.heightMm}`);
  await bar.getByRole('button', { name: 'Narrower by 10 mm' }).click();
  await bar.getByRole('button', { name: 'Shorter by 10 mm' }).click();
  d = await doc();
  ok(d.widthMm === w0 && d.heightMm === h0, `narrower and shorter: back to ${d.widthMm}x${d.heightMm}`);
  await bar.getByRole('button', { name: /Fit to contents/ }).click();
  d = await doc();
  ok(d.widthMm <= w0, `fit to contents: ${d.widthMm}x${d.heightMm}`);
  // the grey desk beside the page also selects the page
  await page.keyboard.press('Escape');
  await page.mouse.click(b.x + b.width + 60, b.y + 40);
  await page.waitForTimeout(400);
  ok(await bar.count() === 1, 'click on the grey desk shows the page tools');
  // selecting a part replaces them
  await page.mouse.click(b.x + 40 * k, b.y + 40 * k);
  await page.waitForTimeout(400);
  ok(await bar.count() === 0, 'clicking the map swaps to the map tools');
  await page.mouse.click(b.x + b.width + 60, b.y + 40);
  await bar.getByRole('button', { name: /Page settings/ }).click();
  await page.waitForTimeout(500);
  ok(await page.getByRole('tab', { name: 'Page', exact: true, selected: true }).count() === 1, 'Page settings opens Design, Page');
  // phone
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const pb = await page.locator('svg.overlay').boundingBox();
  await page.mouse.click(pb.x + pb.width - 3, pb.y + pb.height - 2);
  await page.waitForTimeout(400);
  ok(await bar.count() === 1, 'phone: tapping the page shows the page tools');
  await page.screenshot({ path: S + 'pg-phone.png' });
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
