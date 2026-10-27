async page => {
  // Navigation and shell: one rail (Place, Design, Map parts, Export, Help) with step ticks and aria-current, Layers as a part of
  // Map parts, the Next button walking the four steps, the 56 px foot, the colour-blind preview in the Journal check menu, the folded
  // groups of Add, My maps (open, copy, versions, a new map without a question), "Text for your paper", and the phone sheet.
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/504|Failed to load resource|overpass/i.test(m.text())) errors.push(m.text().slice(0, 150)); });
  const ok = (c, t) => log.push(`${c ? 'PASS' : 'FAIL'} ${t}`);
  // clear the saved maps from a page that is not the app (the app saves again when its own page is left)
  const fresh = async () => {
    await page.goto('http://localhost:4173/favicon.svg');
    await page.evaluate(() => new Promise((res) => { localStorage.clear(); const r = indexedDB.deleteDatabase('studymap-library'); r.onsuccess = r.onerror = r.onblocked = () => res(); }));
    await page.goto('http://localhost:4173/');
    await page.waitForTimeout(2500);
  };
  const rail = (name) => page.locator('.rail').getByRole('button', { name, exact: true });
  const tab = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(300); };
  const foot = () => page.locator('.side .foot .btn').first();
  try {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.setViewportSize({ width: 1366, height: 768 });
  await fresh();

  // ---- the rail is the only navigation
  const names = await page.locator('nav.rail button').allInnerTexts();
  ok(names.join('|') === 'Place|Design|Map parts|Export|Help', `rail: ${names.join(', ')}`);
  ok((await page.locator('nav.rail').getAttribute('aria-label')) === 'Steps to make your map', 'the rail is a labelled navigation landmark');
  ok((await page.locator('ol.steps, .side .steps').count()) === 0, 'no second row of steps in the panel');
  ok((await rail('Place').getAttribute('aria-current')) === 'step' && (await page.locator('nav.rail [aria-current]').count()) === 1, 'Place is the current step (aria-current)');
  ok((await page.locator('.rail .tab[title]').count()) === 5, 'every rail button has a tooltip');
  ok(/Choose a place first/.test(await foot().innerText()) && (await foot().isDisabled()), 'Next waits for a place');
  const fb = await page.locator('.side .foot').evaluate((el) => ({ h: el.getBoundingClientRect().height, b: el.querySelector('.btn').getBoundingClientRect().height }));
  ok(Math.round(fb.h) === 56 && Math.round(fb.b) === 40, `foot is 56 px tall with a 40 px button (${fb.h} / ${fb.b})`);

  // ---- a place, then the Next button walks Place, Design, Map parts, Export
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Dhaka');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(9000);
  ok((await page.locator('.rail .badge').count()) === 0, 'no tick on the step you are on');
  const walk = [];
  for (let i = 0; i < 3; i++) { walk.push((await foot().innerText()).trim()); await foot().click(); await page.waitForTimeout(500); }
  ok(walk.join(' > ') === 'Next: layout and colours > Next: what is on the map > Next: check and download', `Next walks the steps: ${walk.join(' > ')}`);
  ok((await rail('Export').getAttribute('aria-current')) === 'step' && /Download PDF/.test(await foot().innerText()), 'Export is current, with Download in the foot');
  const ticks = await page.locator('.rail .tab:has(.badge)').evaluateAll((ns) => ns.map((n) => n.getAttribute('data-step')));
  ok(ticks.join(',') === 'place,templates,elements', `done steps carry a tick: ${ticks.join(', ')}`);
  await page.screenshot({ path: S + 'shots/nav-rail-export.png' });
  await rail('Help').click(); await page.waitForTimeout(400);
  ok((await rail('Help').getAttribute('aria-current')) === 'page' && (await page.locator('.rail .badge').count()) === 3, 'Help is the current page and the ticks stay');
  await rail('Place').click(); await page.waitForTimeout(400);
  ok((await rail('Place').getAttribute('aria-current')) === 'step', 'the rail goes back to Place');
  await rail('Place').click(); await page.waitForTimeout(400);
  ok((await page.locator('.side').count()) === 0, 'the current step button hides the panel');
  await rail('Design').click(); await page.waitForTimeout(500);

  // ---- Design, Colours: the colour-blind check moved to the Journal check menu
  ok((await page.getByText('Check for colour-blind readers').count()) === 0, 'Colours has no colour-blind accordion any more');
  await page.locator('header').getByRole('button', { name: /Ready|to check|to fix/ }).first().click();
  const cvd = page.locator('#menu-check select');
  ok((await cvd.count()) === 1 && /On screen only/.test(await page.locator('#menu-check').innerText()), 'the Journal check menu has the colour-blind select and its note');
  await cvd.selectOption('deutan');
  await page.waitForTimeout(400);
  ok((await page.locator('.cvdnote').count()) === 1, 'choosing red-green shows the preview note on the page');
  await rail('Map parts').click(); await page.waitForTimeout(400);
  ok((await page.locator('.cvdnote').count()) === 1, 'the preview stays on while you change step');
  await page.locator('.cvdnote button').click();
  await page.keyboard.press('Escape');

  // ---- Map parts: five parts, Layers inside, no "On the page"
  const sub = await page.getByRole('tab').allInnerTexts();
  ok(sub.join('|') === 'Essentials|On the map|Inset maps|Add|Layers', `Map parts tabs: ${sub.join(', ')}`);
  await tab('Essentials');
  const arrows = await page.locator('.tile span').allInnerTexts();
  ok(arrows.join('|') === 'Arrow|Rose|Star|Compass|Simple', `five named north arrows: ${arrows.join(', ')}`);
  const cut = await page.locator('.tile span').evaluateAll((ns) => ns.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent));
  ok(cut.length === 0, `no arrow name is cut short (${cut.join(', ') || 'none'})`);
  await page.getByRole('button', { name: 'North arrow, Simple' }).click(); await page.waitForTimeout(2000);
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc.items.find((i) => i.kind === 'north').style)) === 'simple', 'Simple north arrow picked');
  await page.getByRole('button', { name: /^Main map settings/ }).click(); await page.waitForTimeout(500);
  ok((await page.locator('aside').innerText()).length > 50 && (await page.locator('.rail [aria-current]').count()) === 0, 'Main map settings opens the map settings');
  await rail('Map parts').click(); await page.waitForTimeout(500);
  await tab('Inset maps');
  ok((await page.getByRole('tab', { name: 'Inset maps', selected: true }).count()) === 1 && (await page.getByRole('switch', { name: /Country inset/ }).count()) === 1, 'Inset maps tab has the country and globe insets');
  await tab('Add');
  const accs = await page.locator('.side details.acc').evaluateAll((ns) => ns.map((n) => `${n.querySelector('summary').textContent.trim()}:${n.open}`));
  ok(accs.join('|') === 'Add your own:false|Add detail from OpenStreetMap:false', `Add keeps two groups folded: ${accs.join(', ')}`);
  await tab('Layers');
  ok((await page.getByRole('heading', { name: 'On the page' }).count()) === 0 && (await page.getByRole('button', { name: 'Main map', exact: true }).count()) === 0, 'Layers has no "On the page" list');
  ok((await page.getByRole('button', { name: 'Your area', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Countries', exact: true }).count()) === 1, 'Layers still lists the map layers');
  await page.screenshot({ path: S + 'shots/nav-layers.png' });
  // "Your own file or points" in the Add a layer menu opens Add with the group unfolded
  await page.locator('select[aria-label="Add a layer"]').selectOption('file'); await page.waitForTimeout(700);
  ok((await page.getByRole('tab', { name: 'Add', selected: true }).count()) === 1 && (await page.getByRole('button', { name: /Sample points/ }).isVisible()), '"Your own file or points" opens Add with Add your own unfolded');
  await tab('Layers');

  // ---- scrolling left at 1366x768
  const left = async () => page.evaluate(() => { const b = document.querySelector('.side .body'); return b.scrollHeight - b.clientHeight; });
  await rail('Design').click(); await page.waitForTimeout(400); await tab('Colours');
  const colours = await left();
  ok(colours <= 130, `Colours scrolls ${colours} px at 1366x768 (was 232)`);

  // ---- My maps: File menu, a new map without a question, Your maps on the empty Place panel
  await page.waitForTimeout(3000);
  page.on('dialog', async (d) => { errors.push('native dialog: ' + d.message().slice(0, 60)); await d.dismiss(); });
  await page.getByRole('button', { name: /^File/ }).click();
  const fileItems = await page.locator('#menu-file button').allInnerTexts();
  ok(fileItems[0] === 'My maps…' && fileItems.includes('New map'), `File menu: ${fileItems.join(', ')}`);
  await page.getByRole('button', { name: 'New map', exact: true }).click();
  await page.waitForTimeout(1500);
  ok((await page.locator('.toast span').innerText()) === 'New map started. The one before is in File, My maps.', 'New map starts at once with a note');
  ok((await page.locator('.side .kept li').count()) === 1 && /Dhaka/.test(await page.locator('.side .kept li').first().innerText()), 'the empty Place panel offers the map just left (Your maps)');
  await page.screenshot({ path: S + 'shots/nav-place-yourmaps.png' });
  ok((await page.locator('.rail .badge').count()) === 0, 'the ticks start again on a new map');
  // a second map
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Sylhet');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(8000);
  // My maps dialog: both maps, open the first, copy, keep a version, go back to it
  await page.getByRole('button', { name: /^File/ }).click();
  await page.getByRole('button', { name: 'My maps…' }).click(); await page.waitForTimeout(800);
  ok((await page.locator('dialog.maps[open]').count()) === 1 && (await page.locator('dialog.maps article.card').count()) === 2, 'My maps opens with two maps');
  await page.screenshot({ path: S + 'shots/nav-mymaps.png' });
  await page.getByRole('button', { name: /Open Dhaka/ }).first().click(); await page.waitForTimeout(1500);
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('studymap.autosave.v1')).doc.study.name)).includes('Dhaka'), 'opening another map brings it to the page');
  await page.getByRole('button', { name: /^File/ }).click();
  await page.getByRole('button', { name: 'My maps…' }).click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Make a copy of/ }).first().click(); await page.waitForTimeout(600);
  ok((await page.locator('dialog.maps article.card').count()) === 3, 'copying a map adds a card');
  await page.getByLabel('Version name').fill('Before reviewer 2');
  await page.getByRole('button', { name: 'Keep this version' }).click(); await page.waitForTimeout(600);
  ok((await page.locator('dialog.maps .vlist li').count()) === 1, 'a version is kept');
  await page.getByRole('button', { name: 'Close My maps' }).click(); await page.waitForTimeout(400);
  ok((await page.locator('dialog.maps[open]').count()) === 0 && (await page.evaluate(() => document.activeElement?.textContent?.trim().startsWith('File'))), 'closing My maps returns to the File button');
  await page.getByRole('button', { name: /^File/ }).click();
  await page.getByRole('button', { name: 'My maps…' }).click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Go back to it' }).click(); await page.waitForTimeout(1200);
  ok((await page.locator('dialog.maps[open]').count()) === 0 && /Back to "Before reviewer 2"/.test(await page.locator('.toast span').innerText()), 'going back to a version closes the window and says so');

  // ---- Export: text for your paper
  await rail('Export').click(); await page.waitForTimeout(500);
  const paper = page.locator('.side details.acc', { hasText: 'Text for your paper' });
  ok((await paper.count()) === 1 && !(await paper.evaluate((n) => n.open)), '"Text for your paper" is folded by default');
  await paper.locator('summary').click(); await page.waitForTimeout(400);
  const copyBtn = paper.getByRole('button', { name: 'Copy' }).first();
  await copyBtn.scrollIntoViewIfNeeded();
  await copyBtn.click(); await page.waitForTimeout(400);
  ok(/Copied/.test(await paper.innerText()), 'a sentence for the paper copies');
  await page.screenshot({ path: S + 'shots/nav-paper.png' });

  // ---- a phone: the sheet is about 40 % once a place exists; close and expand still work; nothing runs sideways
  for (const [w, h] of [[390, 844], [360, 732]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    await rail('Design').click().catch(() => {});
    await page.waitForTimeout(500);
    if ((await page.locator('.side').count()) === 0) { await rail('Design').click(); await page.waitForTimeout(500); }
    const r = await page.evaluate(() => ({ sheet: document.querySelector('.side').getBoundingClientRect().height, vh: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth, canvas: document.querySelector('.center').getBoundingClientRect().height }));
    ok(r.sheet <= r.vh * 0.4 + 2 && r.sheet >= r.vh * 0.3, `${w}x${h}: sheet ${Math.round(r.sheet)} px = ${Math.round((r.sheet / r.vh) * 100)}% of the screen, map ${Math.round(r.canvas)} px tall`);
    ok(r.overflow <= 0, `${w}x${h}: nothing runs sideways (${r.overflow}px)`);
    await page.screenshot({ path: S + `shots/nav-phone-${w}.png` });
    await page.getByRole('button', { name: 'Make the panel taller' }).click(); await page.waitForTimeout(500);
    const tall = await page.evaluate(() => document.querySelector('.side').getBoundingClientRect().height);
    ok(tall > r.sheet + 80, `${w}x${h}: the handle makes the sheet taller (${Math.round(r.sheet)} to ${Math.round(tall)} px)`);
    await page.getByRole('button', { name: 'Show more of the map' }).click(); await page.waitForTimeout(400);
    const cl = await page.getByRole('button', { name: 'Close panel' }).boundingBox();
    ok(cl && cl.width >= 40 && cl.height >= 40, `${w}x${h}: the close button is on show and finger sized (${cl && Math.round(cl.width)}x${cl && Math.round(cl.height)})`);
    await page.getByRole('button', { name: 'Close panel' }).click(); await page.waitForTimeout(500);
    ok((await page.locator('.side').count()) === 0, `${w}x${h}: Close hides the sheet`);
    await rail('Map parts').click(); await page.waitForTimeout(400);
    const names2 = await page.locator('nav.rail button').allInnerTexts();
    ok(names2.length === 5, `${w}x${h}: five rail buttons fit (${names2.join(', ')})`);
  }
  } catch (e) { log.push('STOPPED: ' + String(e.message).split('\n')[0]); }
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
