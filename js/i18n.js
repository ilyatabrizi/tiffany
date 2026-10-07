/* Three languages, one page load each.

   Persian is the shop's own language and every visit starts there. A visitor
   who picks English or Türkçe from the hero keeps it for the rest of that
   visit — the choice lives in sessionStorage, so a fresh visit opens in
   Persian again, which is what the studio asked for.

   Switching reloads the page. Every module reads the language once, at load:
   the number and date formatters, the catalogue, the tab bar. A reload keeps
   all of them honest without threading a re-render through each one.

   Usage everywhere: L('فارسی', 'English', 'Türkçe') — the three strings sit
   side by side at the place they are shown, so nothing drifts out of step. */
const KEY = 'tiffany.lang';

export const LANGS = {
  fa: { dir: 'rtl', name: 'فارسی', locale: 'fa-IR' },
  en: { dir: 'ltr', name: 'English', locale: 'en-GB' },
  tr: { dir: 'ltr', name: 'Türkçe', locale: 'tr-TR' },
};
export const ORDER = ['fa', 'en', 'tr'];

function read() {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v && LANGS[v]) return v;
  } catch { /* storage blocked — Persian it is */ }
  return 'fa';
}

export const lang = read();
export const dir = LANGS[lang].dir;
export const locale = LANGS[lang].locale;
export const isFa = lang === 'fa';

/** Pick the string for the language this page loaded in. */
export const L = (fa, en, tr) => (lang === 'en' ? en : lang === 'tr' ? tr : fa);

/** A list separator that reads right in each script: «، » in Persian. */
export const COMMA = isFa ? '، ' : ', ';

export function setLang(next) {
  if (!LANGS[next] || next === lang) return;
  try {
    if (next === 'fa') sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, next);
  } catch { return; }
  location.reload();
}

/* The head script already set these before the first paint; this is the
   belt to its braces for anything that loads the module without it. */
const root = document.documentElement;
root.lang = lang;
root.dir = dir;
