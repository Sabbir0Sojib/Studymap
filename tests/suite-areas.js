async page => {
  // v0.25: several areas on one map (Dhaka and Gazipur together), shown as one merged area, separate or coloured;
  // removing one; mixing an official unit with another level; recent places; Design / Map parts tabs; scale designs.
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, t) => log.push(`${c ? 'PASS' : 'FAIL'} ${t}`);
  try {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
  const doc = async () => { await page.waitForTimeout(3500); return page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc); };
  const go = async (name) => { const b = page.locator('.rail').getByRole('button', { name, exact: true }); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); await page.waitForTimeout(500); };
  // study outlines drawn on the main map (one per area unless merged)
  const outlines = async () => page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc;
    const st = d.layers.find((l) => l.kind === 'study').style.stroke;
    return [...document.querySelectorAll('svg.figure path')].filter((p) => p.getAttribute('fill') === 'none' && (p.getAttribute('stroke') || '').toLowerCase() === st.toLowerCase() && (p.getAttribute('d') || '').length > 200).length;
  });
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  await page.getByRole('button', { name: 'Add another area' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Gazipur');
  await page.waitForTimeout(3000);
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  let d = await doc();
  ok(d.study.unitNames.length === 2 && /Dhaka/.test(d.study.name) && /Gazipur/.test(d.study.name), `two areas: "${d.study.name}"`);
  ok(d.study.merge === true && (await outlines()) === 1, `"One area": one merged outline (${await outlines()})`);
  await page.getByRole('button', { name: 'Separate', exact: true }).click();
  await page.waitForTimeout(2000);
  ok((await outlines()) === 2, `"Separate": two outlines (${await outlines()})`);
  await page.getByRole('button', { name: 'Coloured', exact: true }).click();
  await page.waitForTimeout(2000);
  const legend = await page.locator('svg.figure text').evaluateAll((ns) => ns.map((n) => n.textContent || ''));
  ok(legend.some((t) => /Dhaka/.test(t)) && legend.some((t) => /Gazipur/.test(t)), 'Coloured: each area has its own legend line');
  // a city from search (a different kind of area) joins too
  await page.getByRole('button', { name: 'One area', exact: true }).click();
  await page.getByRole('button', { name: 'Add another area' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Narsingdi');
  await page.waitForTimeout(3500);
  const opt = page.locator('[role=option]').first();
  const label = (await opt.innerText()).split('\n')[0];
  await opt.click();
  await page.waitForTimeout(9000);
  d = await doc();
  ok(d.study.unitNames.length === 3, `a third area of another kind joins: ${d.study.unitNames.join(' | ')} (picked "${label}")`);
  // take one off
  await page.getByRole('button', { name: /Take .*Gazipur.* off the map/ }).click();
  d = await doc();
  ok(d.study.unitNames.length === 2 && !d.study.unitNames.some((n) => /Gazipur/.test(n)), `× removes an area: ${d.study.unitNames.join(' | ')}`);
  // recent places
  await page.getByRole('button', { name: 'Add another area' }).click();
  await page.waitForTimeout(400);
  const recent = await page.locator('.recent button').allInnerTexts();
  ok(recent.length >= 2, `recent places listed: ${recent.join(', ')}`);
  await page.getByRole('button', { name: 'Add another area' }).click();
  /* Design tabs: one section at a time */
  await go('Design');
  const tabs = await page.getByRole('tab').allInnerTexts();
  ok(tabs.length >= 5, `Design tabs: ${tabs.map((t) => t.trim()).join(', ')}`);
  await page.getByRole('tab', { name: 'Text', exact: true }).click();
  ok((await page.locator('.fontpanel').count()) === 1 && (await page.locator('.theme').count()) === 0, 'Text tab shows fonts only');
  /* scale bar designs */
  d = await doc();
  const sc = d.items.find((i) => i.kind === 'scale');
  const b = await page.locator('svg.overlay').boundingBox();
  const k = b.width / d.widthMm;
  await page.mouse.click(b.x + (sc.x + 3) * k, b.y + (sc.y + sc.h / 2) * k);
  await page.locator('.toolbar').getByRole('button', { name: /Settings/ }).click();
  await page.waitForTimeout(500);
  let designs = 0;
  for (const n of ['Ticks', 'Double', 'Hollow', 'Line', 'Blocks']) {
    const bt = page.getByRole('button', { name: `Scale bar design: ${n}` });
    if (await bt.count()) { await bt.click(); designs++; await page.waitForTimeout(300); }
  }
  ok(designs === 5 && errors.length === 0, `all 5 scale bar designs draw without errors (${designs})`);
  } catch (e) { log.push('STOPPED: ' + String(e.message).split('\n')[0]); }
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
