/* A hash router with a scroll memory. Five tabs, three detail routes, and a
   back stack that behaves the way the phone's own back gesture expects.

   Every history entry the shop owns carries its place in the stack
   (history.state.tf: 0 for the page the visitor landed on, then 1, 2, …).
   That answers two questions a hash change cannot: was this a step back,
   and is the entry behind this one still the shop? */

const listeners = new Set();
const scrollMem = new Map();      // hash → scrollY when that page was left
let at = 0;                       // the stack place of the entry on screen

const placeOf = () => (history.state && Number.isInteger(history.state.tf) ? history.state.tf : null);

export const parse = () => {
  const raw = (location.hash || '#/').slice(1);
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts, q: new URLSearchParams(query || '') };
};

export function go(to, { replace = false } = {}) {
  const next = to.startsWith('#') ? to : '#' + to;
  if (location.hash === next) return;
  if (replace) { history.replaceState({ tf: at }, '', next); emit('replace'); }
  else location.hash = next;     // the hashchange below tags the new entry
}

/** The in-page back arrow: one step back while the step behind is the shop's,
    otherwise home. It never walks the visitor off to another site. */
export const back = () => (at > 0 ? history.back() : go('/', { replace: true }));

/** Where to put the page after a render: the remembered spot on a step back. */
export const savedScroll = (hash) => scrollMem.get(hash);
export const keepScroll = (hash, y) => { if (hash) scrollMem.set(hash, y); };

export const onRoute = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (how) => listeners.forEach((fn) => fn(parse(), how));

export function start() {
  /* The shop restores scroll itself; the browser's own restoration would
     jump the old page before the new one is drawn. */
  try { history.scrollRestoration = 'manual'; } catch { /* old browser */ }
  if (!location.hash) history.replaceState({ tf: 0 }, '', '#/');
  else if (placeOf() === null) history.replaceState({ tf: 0 }, '');
  at = placeOf() ?? 0;

  addEventListener('hashchange', () => {
    let place = placeOf();
    let how;
    if (place === null) {
      // a brand-new entry, from go() or a plain #link: one step deeper
      place = at + 1;
      history.replaceState({ tf: place }, '');
      how = 'push';
    } else {
      how = place < at ? 'back' : 'forward';
    }
    at = place;
    emit(how);
  });
  emit('start');
}
