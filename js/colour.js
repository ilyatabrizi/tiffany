/* The colour rule, for phones.

   On a pointer device hover does the work and CSS handles all of it. A phone
   has no hover, so colour arrives a different way: whatever photograph is in
   the middle third of the screen is in colour, and it drains again as it
   leaves. Scrolling the shop paints it.

   Honours the profile setting — Always and Never both switch this off, since
   CSS already forces those. */
import { state } from './store.js';

const BAND = '-36% 0px -36% 0px';

export function applyColourPref() {
  document.documentElement.dataset.colour = state.prefs.colour || 'touch';
}

export function mountColour(root, signal) {
  applyColourPref();
  if (state.prefs.colour !== 'touch') return;
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('lit', e.isIntersecting));
  }, { rootMargin: BAND, threshold: 0 });

  const watch = () => root.querySelectorAll('.shot:not(.full-colour)')
    .forEach((s) => io.observe(s));
  watch();

  /* Views append cards after mount (filters, load more); pick those up too. */
  const mo = new MutationObserver(watch);
  mo.observe(root, { childList: true, subtree: true });

  signal?.addEventListener('abort', () => { io.disconnect(); mo.disconnect(); });
}
