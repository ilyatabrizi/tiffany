/* لوک‌ها — the look viewer: full-bleed campaign frames you swipe through, each
   one carrying the pieces it was shot in. Always in colour — this is the one
   place the shop stops holding back.

   The track scrolls horizontally inside an RTL page, which is the one piece of
   geometry a direction flip genuinely breaks. Engines disagree about the sign
   of scrollLeft in RTL, so nothing below assumes one: the sign is measured off
   the live element once and every read and write goes through it. */
import { LOOKS, getProduct } from './data.js';
import { icon } from './icons.js';
import { esc, toman } from './util.js';
import { bigShot } from './ui.js';
import { $ } from './util.js';
import { go } from './router.js';

let wired = false;

const slide = (l) => {
  const items = l.items.map(getProduct).filter(Boolean);
  return `
  <section class="viewer-slide">
    <img ${bigShot(l.img, '100vw')} alt="${esc(l.title)}" decoding="async"
         width="720" height="1280">
    <div class="viewer-cap">
      <h3>${esc(l.title)}</h3>
      <p>${esc(l.caption)}</p>
      <div class="viewer-items">
        ${items.map((p) => `
          <button class="vitem" data-vitem="${p.id}" type="button">
            <img src="assets/img/${p.img}-480.webp" alt="" loading="lazy" decoding="async"
                 width="34" height="42">
            <span><b>${esc(p.name)}</b><span>${toman(p.price)}</span></span>
          </button>`).join('')}
      </div>
    </div>
  </section>`;
};

export function openLooks(index = 0) {
  const v = $('#viewer');
  if (!v) return;

  v.innerHTML = `
    <div class="viewer-bars" aria-hidden="true">
      ${LOOKS.map(() => '<i></i>').join('')}
    </div>
    <button class="viewer-close" data-act="viewer-close" type="button"
            aria-label="بستن لوک‌ها">${icon('close', 19)}</button>
    <div class="viewer-track" id="viewerTrack" tabindex="-1">
      ${LOOKS.map(slide).join('')}
    </div>`;

  v.classList.add('open');
  document.body.classList.add('locked');

  const track = v.querySelector('#viewerTrack');
  const bars = [...v.querySelectorAll('.viewer-bars i')];
  const mark = (i) => bars.forEach((b, n) => b.classList.toggle('on', n === i));

  /* Layout has to settle before scrollLeft means anything. */
  void track.offsetWidth;

  /* Probe the engine rather than trusting it. In an RTL track some browsers
     count scrollLeft up from the left edge and others count it DOWN from zero
     at the right; writing 1 and reading it back says which, because the
     negative convention clamps straight back to 0. */
  track.scrollLeft = 1;
  const sign = track.scrollLeft > 0 ? 1 : -1;
  track.scrollLeft = 0;

  const page = () => Math.max(1, track.clientWidth);
  const goTo = (i) => { track.scrollLeft = sign * page() * i; };
  const at = () => Math.round(Math.abs(track.scrollLeft) / page());

  goTo(index);
  mark(index);

  track.addEventListener('scroll', () => mark(at()), { passive: true });

  track.focus({ preventScroll: true });

  if (!wired) {
    wired = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isLooksOpen()) closeLooks();
    });
  }
}

export function closeLooks() {
  const v = $('#viewer');
  if (!v || !v.classList.contains('open')) return;
  v.classList.remove('open');
  document.body.classList.remove('locked');
  v.innerHTML = '';
}

export const isLooksOpen = () => $('#viewer')?.classList.contains('open');

/** A chip in the viewer goes straight to the piece. */
export function looksItemTo(id) {
  closeLooks();
  go('/p/' + id);
}
