/* The look viewer: full-bleed campaign frames you swipe through, each one
   carrying the pieces it was shot in. Always in colour — this is the one place
   the shop stops holding back. */
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
            aria-label="Close looks">${icon('close', 19)}</button>
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
  track.scrollLeft = track.clientWidth * index;
  mark(index);

  track.addEventListener('scroll', () => {
    mark(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
  }, { passive: true });

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
