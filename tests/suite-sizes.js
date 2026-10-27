async page => {
  const S = globalThis.STUDYMAP_TESTS ?? ''; // the tests folder, set by tests/run.mjs
  const log = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(2500);
  await page.getByRole('combobox', { name: 'Search for a place' }).first().fill('Chittagong');
  await page.locator('[role=option]', { hasText: 'District' }).first().click();
  await page.waitForTimeout(9000);
  for (const [w, h, name] of [[360, 740, 'phone-small'], [390, 844, 'phone'], [768, 1024, 'tablet'], [1024, 768, 'laptop-small'], [1366, 768, 'laptop'], [1920, 1080, 'desktop']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth, iw = innerWidth;
      const page = document.querySelector('div.page')?.getBoundingClientRect();
      const desk = document.querySelector('.desk')?.getBoundingClientRect();
      // small tap targets among visible buttons
      const small = [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24); }).length;
      return { overflow: sw - iw, pageFits: page && desk ? page.right <= desk.right + 1 && page.left >= desk.left - 1 : null, small };
    });
    log.push(`${r.overflow <= 0 ? 'PASS' : 'FAIL'} ${name} ${w}x${h}: horizontal overflow ${r.overflow}px, page fits ${r.pageFits}, buttons under 24px ${r.small}`);
    await page.screenshot({ path: S + 'shots/size-' + name + '.png' });
  }
  // keyboard: Tab reaches the search, the rail, the Next button
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(600);
  const seen = new Set();
  await page.locator('body').click({ position: { x: 5, y: 300 } }).catch(() => {});
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const t = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return '(page)'; const has = (el) => { const s = getComputedStyle(el); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; }; const ring = has(a) || (a.parentElement && has(a.parentElement)); /* a field may show its ring on the box around it (:focus-within) */ return (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 30) + (ring ? '' : ' [NO FOCUS RING]'); });
    seen.add(t);
  }
  const noRing = [...seen].filter((s) => s.includes('NO FOCUS RING'));
  log.push(`${noRing.length === 0 ? 'PASS' : 'WARN'} keyboard: ${seen.size} stops reached; without visible focus ring: ${noRing.slice(0, 6).join(', ') || 'none'}`);
  log.push('errors: ' + (errors.join(' | ') || 'none'));
  return log;
}
