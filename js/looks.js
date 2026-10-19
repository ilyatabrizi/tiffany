/* استوری‌ها — the story viewer: full-bleed frames you swipe through. First
   the stories the team posted from the panel (each one up for 24 hours, a
   photo or a video), then the studio's campaign looks. Each one can
   carry the pieces it shows. Always in colour — this is the one place the
   shop stops holding back.

   Videos start muted (no browser lets a page start sound on its own); the
   speaker button turns sound on for every video in the viewer. A video plays
   only while its slide is the one on screen.

   The track scrolls horizontally inside an RTL page (and an LTR one when the
   visitor switches language), which is the one piece of geometry a direction
   flip genuinely breaks. Engines disagree about the sign
   of scrollLeft in RTL, so nothing below assumes one: the sign is measured off
   the live element once and every read and write goes through it. */
import { storyList, getProduct } from './data.js';
import { icon } from './icons.js';
import { esc, toman, num } from './util.js';
import { imgSrc, storyShot } from './ui.js';
import { $ } from './util.js';
import { go } from './router.js';
import { state, save } from './store.js';
import { L } from './i18n.js';

let wired = false;
let muted = true;
let list = [];

function ago(ms) {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (m < 60) return L(`${num(m)} دقیقه پیش`, `${m} min ago`, `${m} dk önce`);
  const h = Math.round(m / 60);
  return L(`${num(h)} ساعت پیش`, `${h} h ago`, `${h} sa önce`);
}

const slide = (l) => {
  const items = l.items.map(getProduct).filter(Boolean);
  const media = l.kind === 'video'
    ? `<video src="${esc(l.video)}" ${l.img ? `poster="${esc(l.img)}-1080.webp"` : ''} muted playsinline loop
         preload="metadata" aria-label="${esc(l.title || L('ویدیو', 'Video', 'Video'))}"></video>`
    : `<img ${storyShot(l, '100vw')} alt="${esc(l.title)}" decoding="async" width="720" height="1280">`;
  return `
  <section class="viewer-slide" data-story="${esc(l.id)}">
    ${media}
    <div class="viewer-cap">
      ${l.live ? `<span class="viewer-ago">${esc(ago(l.at))}</span>` : ''}
      ${l.title ? `<h3>${esc(l.title)}</h3>` : ''}
      ${l.caption ? `<p>${esc(l.caption)}</p>` : ''}
      ${items.length ? `<div class="viewer-items">
        ${items.map((p) => `
          <button class="vitem" data-vitem="${p.id}" type="button">
            <img src="${imgSrc(p.img, 480)}" alt="" loading="lazy" decoding="async"
                 width="34" height="42">
            <span><b>${esc(p.name)}</b><span>${toman(p.price)}</span></span>
          </button>`).join('')}
      </div>` : ''}
    </div>
  </section>`;
};

export function openLooks(index = 0) {
  const v = $('#viewer');
  if (!v) return;
  list = storyList();
  if (!list.length) return;
  index = Math.max(0, Math.min(list.length - 1, index));

  v.innerHTML = `
    <div class="viewer-bars" aria-hidden="true">
      ${list.map(() => '<i></i>').join('')}
    </div>
    <button class="viewer-sound" type="button" hidden aria-pressed="${!muted}"
            aria-label="${L('صدای ویدیو', 'Video sound', 'Video sesi')}">${icon(muted ? 'mute' : 'sound', 19)}</button>
    <button class="viewer-close" data-act="viewer-close" type="button"
            aria-label="${L('بستن استوری‌ها', 'Close stories', 'Hikâyeleri kapat')}">${icon('close', 19)}</button>
    <div class="viewer-track" id="viewerTrack" tabindex="-1">
      ${list.map(slide).join('')}
    </div>`;

  v.classList.add('open');
  document.body.classList.add('locked');

  const track = v.querySelector('#viewerTrack');
  const bars = [...v.querySelectorAll('.viewer-bars i')];
  const slides = [...v.querySelectorAll('.viewer-slide')];
  const sound = v.querySelector('.viewer-sound');
  let current = -1;
  const mark = (i) => {
    bars.forEach((b, n) => b.classList.toggle('on', n === i));
    if (i === current) return;
    current = i;
    slides.forEach((s, n) => {
      const vid = s.querySelector('video');
      if (!vid) return;
      if (n === i) {
        vid.muted = muted;
        vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
      } else {
        vid.pause();
      }
    });
    sound.hidden = !slides[i]?.querySelector('video');
    /* A story of the panel's, once seen, loses its ring in the strip. */
    const l = list[i];
    if (l?.live) {
      const seen = state.seen.stories || (state.seen.stories = []);
      if (!seen.includes(l.id)) {
        seen.unshift(l.id);
        seen.length = Math.min(seen.length, 120);
        save();
        document.querySelector(`.look-tile[data-i="${i}"]`)?.classList.remove('unseen');
      }
    }
  };

  sound.addEventListener('click', () => {
    muted = !muted;
    sound.setAttribute('aria-pressed', String(!muted));
    sound.innerHTML = icon(muted ? 'mute' : 'sound', 19);
    const vid = slides[current]?.querySelector('video');
    if (vid) { vid.muted = muted; vid.play().catch(() => {}); }
  });

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
  v.querySelectorAll('video').forEach((x) => x.pause());
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
