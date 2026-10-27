async page => {
  // v0.24: bold / italic / colour on every text, the toolbar text buttons and shortcuts, "all text at once",
  // Shift+click groups (move, align, space evenly, delete), My styles (save, apply, default for new maps).
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ok = (c, t) => log.push(`${c ? 'PASS' : 'FAIL'} ${t}`);
  try {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(3000);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  const doc = async () => { await page.waitForTimeout(3500); return page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc); };
  // Design shows one tab at a time (v0.24): open the one that holds the control
  const tab = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(300); };
  const go = async (name) => { const b = page.locator('.rail').getByRole('button', { name, exact: true }); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); await page.waitForTimeout(500); };
  let d = await doc();
  let b = await page.locator('svg.overlay').boundingBox();
  let k = b.width / d.widthMm;
  const P = (x, y) => [b.x + x * k, b.y + y * k];
  const center = (it) => P(it.x + it.w / 2, it.y + it.h / 2);
  const weights = (sel) => page.locator(sel).evaluateAll((ns) => ns.map((n) => `${n.getAttribute('font-weight') ?? ''}/${n.getAttribute('font-style') ?? ''}`));

  /* toolbar B / I and size on the legend */
  const lg = d.items.find((i) => i.kind === 'legend');
  await page.mouse.click(...P(lg.x + 3, lg.y + lg.h - 2));
  await page.waitForTimeout(300);
  await page.locator('.toolbar').getByRole('button', { name: 'Bold', exact: true }).click();
  await page.locator('.toolbar').getByRole('button', { name: 'Italic', exact: true }).click();
  await page.locator('.toolbar').getByRole('button', { name: 'Larger text' }).click();
  d = await doc();
  const lg2 = d.items.find((i) => i.kind === 'legend');
  ok(lg2.text?.bold && lg2.text?.italic && lg2.labelPt === lg.labelPt + 0.5, `legend entries from the toolbar: bold ${lg2.text?.bold}, italic ${lg2.text?.italic}, size ${lg.labelPt} -> ${lg2.labelPt} pt`);
  /* Ctrl+B / Ctrl+I on the scale bar */
  const sc = d.items.find((i) => i.kind === 'scale');
  await page.mouse.click(...P(sc.x + 3, sc.y + sc.h / 2));
  await page.keyboard.press('Control+b');
  d = await doc();
  ok(d.items.find((i) => i.kind === 'scale').text?.bold === true, 'Ctrl+B makes the scale bar numbers bold');
  /* settings rows: names on the map, grid coordinates, north arrow letter */
  await go('Map parts');
  await tab('Layers'); // Layers is a part of Map parts
  await page.locator('aside').getByRole('button', { name: 'Boundaries', exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  const nameRow = page.locator('aside [role=group][aria-label="Name style"]');
  if (await nameRow.count()) { await nameRow.getByRole('button', { name: 'Bold' }).click(); }
  d = await doc();
  const admin = d.layers.find((l) => l.kind === 'admin');
  ok(admin?.style.labelStyle?.bold === true, `neighbour names bold from their settings (${await nameRow.count() ? 'row found' : 'no Name style row'})`);
  // the main map: grid coordinates italic
  const m = d.items.find((i) => i.kind === 'map');
  await page.keyboard.press('Escape');
  await page.mouse.click(...P(m.x + 1, m.y + 30));
  const sb = page.locator('.toolbar').getByRole('button', { name: /Settings/ });
  await sb.first().click();
  await page.waitForTimeout(500);
  const coordRow = page.locator('aside [role=group][aria-label="Coordinate style"]').first();
  await coordRow.evaluate((el) => { let d = el.closest('details'); while (d) { d.open = true; d = d.parentElement?.closest('details') ?? null; } }).catch(() => {}); // it sits in the grid's Labels section
  await coordRow.scrollIntoViewIfNeeded().catch(() => {});
  if (await coordRow.count()) await coordRow.getByRole('button', { name: 'Italic' }).click();
  d = await doc();
  ok(d.items.find((i) => i.kind === 'map').grid.text?.italic === true, 'grid coordinates italic from Grid settings');
  const gridTexts = await weights('svg.figure text');
  ok(gridTexts.some((w) => w.endsWith('/italic')), `figure draws italic text (${gridTexts.filter((w) => w.endsWith('/italic')).length} italic texts)`);

  /* all text at once */
  await go('Design');
  await tab('Text');
  await page.locator('.alltext').getByRole('button', { name: 'Bold' }).click();
  await page.waitForTimeout(800);
  const all = await weights('svg.figure text');
  const bold = all.filter((w) => w.startsWith('700')).length;
  ok(bold >= all.length * 0.9, `"All text at once: Bold": ${bold} of ${all.length} texts bold`);
  await page.locator('.alltext').getByRole('button', { name: 'Regular' }).click();
  await page.waitForTimeout(800);
  const reg = await weights('svg.figure text');
  ok(reg.filter((w) => w.startsWith('700')).length <= 2, `"Regular" makes the text regular again (${reg.filter((w) => w.startsWith('700')).length} bold left)`);

  /* PDF carries bold and italic faces */
  await page.locator('.alltext').getByRole('button', { name: 'Bold' }).click();
  await page.getByRole('button', { name: 'Export' }).first().click();
  await page.waitForTimeout(600);
  await page.locator('aside').getByRole('button', { name: /^PDF/ }).first().click();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }).catch(() => null), page.getByRole('button', { name: /^Download (PDF|SVG|PNG|TIFF)/ }).click()]);
  if (dl) await dl.saveAs(S + 'out/pro-bold.pdf');
  ok(!!dl, 'PDF with bold text saved as out/pro-bold.pdf');
  await go('Design');
  await tab('Text');
  await page.locator('.alltext').getByRole('button', { name: 'Regular' }).click();

  /* Shift+click group: legend, north arrow, scale bar */
  d = await doc();
  b = await page.locator('svg.overlay').boundingBox(); k = b.width / d.widthMm;
  const L = d.items.find((i) => i.kind === 'legend'), N = d.items.find((i) => i.kind === 'north'), Sc = d.items.find((i) => i.kind === 'scale');
  await page.keyboard.press('Escape');
  await page.mouse.click(...P(L.x + 3, L.y + L.h - 2));
  await page.keyboard.down('Shift');
  await page.mouse.click(...center(N));
  await page.mouse.click(...P(Sc.x + 3, Sc.y + Sc.h / 2));
  await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
  const label = await page.locator('.toolbar .tb-label.strong').innerText().catch(() => '');
  ok(/3 parts/.test(label), `Shift+click selects three parts (toolbar: "${label}")`);
  await page.locator('.toolbar .arrbtn').click();
  await page.getByRole('menuitem', { name: 'Left', exact: true }).click();
  d = await doc();
  const xs = ['legend', 'north', 'scale'].map((kd) => d.items.find((i) => i.kind === kd).x);
  ok(new Set(xs).size === 1, `Arrange, Left lines them up: x = ${xs.join(', ')}`);
  if ((await page.locator('.toolbar .arrbtn').getAttribute('aria-expanded')) !== 'true') await page.locator('.toolbar .arrbtn').click();
  await page.getByRole('menuitem', { name: 'Down' }).click();
  d = await doc();
  const parts = ['legend', 'north', 'scale'].map((kd) => d.items.find((i) => i.kind === kd)).sort((a, c) => a.y - c.y);
  const gaps = [parts[1].y - (parts[0].y + parts[0].h), parts[2].y - (parts[1].y + parts[1].h)].map((g) => Math.round(g * 10) / 10);
  ok(Math.abs(gaps[0] - gaps[1]) <= 0.2, `Equal spaces down: gaps ${gaps.join(' and ')} mm`);
  await page.keyboard.press('Escape');
  // dragging one moves all three
  const before = parts.map((p) => [p.x, p.y]);
  await page.mouse.click(...P(parts[0].x + 2, parts[0].y + 2));
  await page.keyboard.down('Shift');
  await page.mouse.click(...P(parts[1].x + 2, parts[1].y + 2));
  await page.mouse.click(...P(parts[2].x + 2, parts[2].y + 2));
  await page.keyboard.up('Shift');
  await page.mouse.move(...P(parts[1].x + 2, parts[1].y + 2)); await page.mouse.down(); await page.mouse.move(...P(parts[1].x - 8, parts[1].y + 2), { steps: 6 }); await page.mouse.up();
  d = await doc();
  const moved = parts.map((p) => d.items.find((i) => i.id === p.id)).map((p, i) => Math.round((p.x - before[i][0]) * 10) / 10);
  ok(moved.every((dx) => Math.abs(dx + 10) <= 2), `dragging one part moves the whole group: dx = ${moved.join(', ')}`);
  await page.keyboard.press('Delete');
  d = await doc();
  ok(!d.items.some((i) => parts.some((p) => p.id === i.id)), 'Delete removes the whole group');
  await page.keyboard.press('Control+z');
  d = await doc();
  ok(parts.every((p) => d.items.some((i) => i.id === p.id)), 'Ctrl+Z brings the group back');

  /* My styles: save, change, apply, default for new maps */
  await go('Design');
  await tab('Text');
  await page.locator('.fontpanel').getByRole('radio', { name: /Times New Roman/ }).click();
  await page.waitForTimeout(600);
  await tab('My styles');
  const nameInput = page.locator('[data-jump="mine"] input[type=text], [data-jump="mine"] input:not([type])').first();
  await nameInput.fill('Thesis maps');
  await page.locator('[data-jump="mine"]').getByRole('button', { name: /Save this look/ }).click();
  await page.waitForTimeout(500);
  ok(await page.locator('[data-jump="mine"]').getByText('Thesis maps').count() > 0, 'a saved style appears in My styles');
  await tab('Text');
  await page.locator('.fontpanel').getByRole('radio', { name: /Arial/ }).click();
  await page.waitForTimeout(400);
  await tab('My styles');
  await page.locator('[data-jump="mine"]').getByRole('button', { name: /^Apply/ }).first().click();
  d = await doc();
  ok(d.font === 'Tinos', `Apply brings the saved look back (font ${d.font})`);
  const star = page.locator('[data-jump="mine"]').getByRole('button', { name: /new maps/i }).first();
  await star.click();
  await page.waitForTimeout(300);
  // a new map gets the default style
  await page.getByRole('button', { name: /^File/ }).click(); // New map asks nothing: the map on screen is already kept in My maps
  await page.locator('header').getByRole('button', { name: 'New map', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Sylhet');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  d = await doc();
  ok(d.font === 'Tinos', `a new map starts with the default style (font ${d.font})`);
  } catch (e) { log.push('STOPPED: ' + String(e.message).split('\n')[0]); }
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
