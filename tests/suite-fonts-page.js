async page => {
  // Fonts (journal look-alikes, your own font, per-text font, PDF embedding), the page (drag edges, sides, trim,
  // colour) and the v0.22 editor fixes (north arrow / scale bar drag, top item wins, line hit, multi-line text).
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
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
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  const doc = async () => { await page.waitForTimeout(3500); return page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc); };
  // Design shows one tab at a time (v0.24): open the one that holds the control
  const tab = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(300); };
  const go = async (name) => { const b = page.locator('.rail').getByRole('button', { name, exact: true }); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); await page.waitForTimeout(500); };
  const box = async () => page.locator('svg.overlay').boundingBox();
  // the tool strip keeps Select, Hand, Text and Picture as buttons; Map parts and Shapes open a menu first (v0.35)
  const FAMILY = { 'Add legend': 'Map parts', 'Add scale bar': 'Map parts', 'Add north arrow': 'Map parts', 'Add inset map': 'Map parts', 'Add rectangle': 'Shapes', 'Add ellipse': 'Shapes', 'Add line': 'Shapes', 'Add arrow': 'Shapes' };
  const pickTool = async (name) => { const f = FAMILY[name]; if (f) { await page.locator('.palette').getByRole('button', { name: f, exact: true }).click(); await page.getByRole('menuitem', { name }).click(); } else await page.getByRole('button', { name }).click(); };
  let d = await doc();
  let b = await box();
  let k = b.width / d.widthMm;
  const P = (x, y) => [b.x + x * k, b.y + y * k];
  const drag = async (from, to) => { await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(...to, { steps: 6 }); await page.mouse.up(); };

  /* ---------- editor fixes ---------- */
  const north = d.items.find((i) => i.kind === 'north');
  await drag(P(north.x + north.w / 2, north.y + north.h / 2), P(north.x + north.w / 2 - 20, north.y + north.h / 2 + 10));
  let n2 = (await doc()).items.find((i) => i.kind === 'north');
  ok(Math.abs(n2.x - (north.x - 20)) < 2 && n2.pinned, `north arrow drags: ${north.x},${north.y} -> ${n2.x},${n2.y}`);
  const sc = d.items.find((i) => i.kind === 'scale');
  await page.mouse.click(...P(sc.x + 3, sc.y + sc.h / 2));
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  let sc2 = (await doc()).items.find((i) => i.kind === 'scale');
  ok(Math.abs(sc2.y - (sc.y - 1)) < 0.05, `scale bar nudges with arrows: y ${sc.y} -> ${sc2.y}`);
  await drag(P(sc2.x + 3, sc2.y + sc2.h / 2), P(sc2.x + 13, sc2.y + sc2.h / 2 - 15));
  sc2 = (await doc()).items.find((i) => i.kind === 'scale');
  ok(Math.abs(sc2.x - (sc.x + 10)) < 2, `scale bar drags: x ${sc.x} -> ${sc2.x}`);
  // rectangle + duplicate: dragging the overlap moves the copy (the one on top)
  await pickTool('Add rectangle');
  await drag(P(20, 30), P(50, 50));
  await page.keyboard.press('Control+d');
  d = await doc();
  const rects = d.items.filter((i) => i.kind === 'shape' && i.shape === 'rect');
  await drag(P(40, 45), P(60, 70));
  d = await doc();
  const r2 = d.items.filter((i) => i.kind === 'shape' && i.shape === 'rect');
  ok(rects.length === 2 && r2[0].x === rects[0].x && r2[1].x !== rects[1].x, `Ctrl+D copies; drag in the overlap moves the copy on top: original ${rects[0]?.x}->${r2[0]?.x}, copy ${rects[1]?.x}->${r2[1]?.x}`);
  // a long arrow is only picked near the line
  await pickTool('Add arrow');
  await drag(P(20, 20), P(110, 120));
  await page.keyboard.press('Escape');
  await page.mouse.click(...P(100, 30));
  const selKind = await page.locator('.status').innerText().catch(() => '');
  ok(!/Shape/.test(selKind), `click far from a diagonal arrow does not pick it (status: ${selKind.replace(/\s+/g, ' ').slice(0, 60)})`);
  // multi-line text: Shift+Enter, and the box grows
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.mouse.click(...P(140, 140));
  await page.waitForTimeout(400);
  await page.keyboard.type('First line');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Second line');
  await page.keyboard.press('Enter');
  d = await doc();
  let tx = d.items.find((i) => i.kind === 'title' && i.text.startsWith('First'));
  const lines = await page.locator('svg.figure text', { hasText: /First line|Second line/ }).count();
  ok(tx && tx.text === 'First line\nSecond line' && lines === 2 && tx.h > 6, `two-line text: ${JSON.stringify(tx?.text)}, ${lines} lines drawn, box h ${tx?.h}`);
  // Esc on a brand-new text removes it
  const before = d.items.filter((i) => i.kind === 'title').length;
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.mouse.click(...P(140, 100));
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  d = await doc();
  ok(d.items.filter((i) => i.kind === 'title').length === before, `Esc on a new text leaves no empty box (${before} -> ${d.items.filter((i) => i.kind === 'title').length})`);
  // the grey desk deselects
  await page.mouse.click(...P(sc2.x + 3, sc2.y + sc2.h / 2));
  await page.mouse.click(b.x + b.width + 20, b.y + 40);
  ok((await page.locator('.toolbar').count()) === 0 || !(await page.locator('.toolbar').innerText()).includes('Scale bar'), 'clicking the grey desk deselects');

  /* ---------- fonts ---------- */
  await go('Design');
  await tab('Text');
  ok(await page.getByRole('radio', { name: /Times New Roman/ }).count() === 1, 'Design shows the font list');
  await page.getByRole('radio', { name: /Times New Roman/ }).click();
  await page.waitForTimeout(1500);
  d = await doc();
  const ff = await page.locator('svg.figure').getAttribute('font-family');
  const loaded = await page.evaluate(() => document.fonts.check('12px Tinos'));
  ok(d.font === 'Tinos' && /^Tinos/.test(ff) && loaded, `Times New Roman look-alike for all text: doc.font=${d.font}, figure font-family="${ff}", loaded=${loaded}`);
  // journal rule: Springer asks for Arial / Helvetica
  await page.evaluate(() => {}); // no-op
  await tab('Page');
  await page.locator('select[aria-label="Journal size"]').selectOption('springer-2');
  await page.waitForTimeout(800);
  await page.locator('header').getByRole('button', { name: /to check|to fix|Ready/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const findText = await page.locator('.findings').innerText().catch(() => '');
  const fixBtn = page.locator('.findings .fixbtn', { hasText: /Arial/ });
  ok(/Springer asks for Arial or Helvetica/.test(findText) && (await fixBtn.count()) === 1, `checker: ${findText.split('\n').find((l) => /asks for/.test(l)) ?? 'no font finding'}`);
  await page.keyboard.press('Escape');
  // your own font (a TrueType file from the project's node_modules)
  await go('Design');
  await tab('Text');
  await page.locator('.fontpanel input[type=file]').setInputFiles(S + '../node_modules/mapshaper/www/assets/SourceSans3-VariableFont_wght.ttf');
  await page.waitForTimeout(2000);
  d = await doc();
  const custom = await page.locator('.fontpanel .font.custom').count();
  ok(custom === 1 && /Source Sans/.test(d.font), `own font added and used: ${d.font}`);
  // per-text font
  const t1 = d.items.find((i) => i.kind === 'title' && i.text.startsWith('First'));
  b = await box(); k = b.width / d.widthMm; // the Springer page is narrower, so the page was refitted
  await page.mouse.click(...P(t1.x + 2, t1.y + 1.5));
  await page.waitForTimeout(300);
  ok(t1.y + t1.h <= d.heightMm + 0.01, `a text stays on the page when the journal size changes (text bottom ${Math.round((t1.y + t1.h) * 10) / 10}, page ${d.heightMm})`);
  await page.locator('.toolbar').getByRole('button', { name: /Settings/ }).click();
  await page.waitForTimeout(400);
  await page.locator('select', { has: page.locator('option', { hasText: 'Same as the map' }) }).selectOption('Cousine');
  d = await doc();
  ok(d.items.find((i) => i.id === t1.id)?.font === 'Cousine', 'a text can have its own font (Courier New look-alike)');
  // PDF embeds every font used
  await go('Map parts'); // leave settings
  await page.getByRole('button', { name: 'Export' }).first().click();
  await page.waitForTimeout(600);
  await page.locator('aside').getByRole('button', { name: /^PDF/ }).first().click();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }).catch(() => null), page.getByRole('button', { name: /^Download (PDF|SVG|PNG|TIFF)/ }).click()]);
  if (dl) await dl.saveAs(S + 'out/fonts-test.pdf');
  ok(!!dl, 'PDF saved as out/fonts-test.pdf (the fonts inside are listed by the shell step in the README)');

  /* ---------- the page ---------- */
  await go('Design');
  await tab('Page');
  d = await doc();
  const W0 = d.widthMm, H0 = d.heightMm, map0 = d.items.find((i) => i.kind === 'map');
  b = await box(); k = b.width / d.widthMm;
  const grip = page.locator('.pagegrip.right');
  const gb = await grip.boundingBox();
  await drag([gb.x + gb.width / 2, gb.y + gb.height / 2], [gb.x + gb.width / 2 + 20 * k, gb.y + gb.height / 2]);
  d = await doc();
  ok(Math.abs(d.widthMm - (W0 + 20)) <= 1, `drag the right edge: width ${W0} -> ${d.widthMm}`);
  const lg = page.locator('.pagegrip.left');
  const lb = await lg.boundingBox();
  await drag([lb.x + lb.width / 2, lb.y + lb.height / 2], [lb.x + lb.width / 2 - 10 * k, lb.y + lb.height / 2]);
  d = await doc();
  const map1 = d.items.find((i) => i.kind === 'map');
  ok(Math.abs(d.widthMm - (W0 + 30)) <= 1 && Math.abs(map1.x - (map0.x + 10)) <= 1, `drag the left edge: width ${d.widthMm}, map moved with the paper ${map0.x} -> ${map1.x}`);
  // the page drawing with its minus / plus buttons sits in the closed "Fine-tune one side" section: open it first
  const fine = page.locator('details', { has: page.locator('summary', { hasText: 'Fine-tune one side' }) });
  if (!(await fine.evaluate((el) => el.open))) await fine.locator('summary').click();
  await page.getByRole('button', { name: /Shrink bottom side by 10 mm/ }).click();
  d = await doc();
  ok(d.heightMm === H0 - 10, `Bottom − 10: height ${H0} -> ${d.heightMm}`);
  const outside = d.items.filter((i) => i.visible && i.kind !== 'shape' && (i.x < -0.01 || i.y < -0.01 || i.x + i.w > d.widthMm + 0.01 || i.y + i.h > d.heightMm + 0.01));
  ok(outside.length === 0, `nothing left hanging off the page (${outside.map((i) => i.kind).join(', ') || 'none'})`);
  await page.getByRole('button', { name: 'Trim page to its contents' }).click();
  d = await doc();
  ok(d.widthMm < W0 + 30, `Trim page to its contents: ${d.widthMm} × ${d.heightMm}`);
  await page.getByRole('radio', { name: 'None' }).click();
  d = await doc();
  ok(d.pageColor === 'none' && (await page.locator('.page.clear').count()) === 1, 'page colour None shows a see-through page');
  await page.getByRole('radio', { name: 'White' }).click();

  } catch (e) { log.push('STOPPED: ' + String(e.message).split('\n')[0]); }
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
