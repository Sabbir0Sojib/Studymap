// The editor in English or in Bangla. Every word on the screen goes through t(), keyed by its English text, so an
// untranslated phrase simply shows in English. The figure itself (names, legend, credits) is the user's own text and
// stays as written: journals want English, and the PDF writer cannot join Bangla letters correctly.

export type Lang = 'en' | 'bn';
const KEY = 'studymap.lang';

// the editor is in English only (the owner did not ask for Bangla); t() keeps every text as written
function stored(): Lang {
  void KEY;
  return 'en';
}

// the Bangla words load only when Bangla is chosen, so the English editor does not download them
let BN: Record<string, string> = {};

class I18n {
  lang = $state<Lang>(stored());
  async set(l: Lang) {
    if (l === 'bn' && !Object.keys(BN).length) {
      const [a, b, c] = await Promise.all([import('./i18n/bn-shell'), import('./i18n/bn-panels'), import('./i18n/bn-parts')]);
      BN = { ...a.BN_SHELL, ...b.BN_PANELS, ...c.BN_PARTS };
    }
    this.lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* a private window keeps it for this visit */ }
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  }
}
export const i18n = new I18n();
if (typeof document !== 'undefined') document.documentElement.lang = i18n.lang;

/**
 * The text in the chosen language. `vars` fill {name} slots, in either language:
 * t('Downloaded {file}.', { file: 'map.pdf' }).
 */
export function t(en: string, vars?: Record<string, string | number>): string {
  let s = i18n.lang === 'bn' ? BN[en] ?? en : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(i18n.lang === 'bn' && typeof v === 'number' ? bnDigits(v) : String(v));
  return s;
}

/** Numbers in Bangla digits (০১২৩৪৫৬৭৮৯) when the editor is in Bangla; the figure keeps Latin digits. */
export function bnDigits(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
}
