/* The campaign film.

   Autoplay-muted-inline is allowed on iOS, but not in Low Power Mode and not
   under prefers-reduced-motion — in both cases the poster is the hero and
   nothing looks broken. The clip is paused whenever it scrolls out of view or
   the tab is hidden, because a looping video behind five screens of content is
   pure battery. */
import { icon } from './icons.js';

export function mountHero(root, signal) {
  const hero = root.querySelector('.hero');
  const vid = root.querySelector('.hero video');
  if (!hero || !vid) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const btn = root.querySelector('.hero-sound');

  if (reduce.matches) {
    vid.remove();
    if (btn) btn.hidden = true;
    return;
  }

  let wanted = true;
  const tryPlay = () => { if (wanted) vid.play().catch(() => { /* poster carries it */ }); };
  vid.addEventListener('playing', () => vid.classList.add('ready'), { once: true });
  tryPlay();

  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) tryPlay(); else vid.pause();
  }, { threshold: 0.08 });
  io.observe(hero);

  const onVis = () => (document.hidden ? vid.pause() : tryPlay());
  document.addEventListener('visibilitychange', onVis, { signal });

  /* One tap anywhere wakes a clip a strict autoplay policy refused. */
  const kick = () => tryPlay();
  document.addEventListener('touchstart', kick, { once: true, passive: true, signal });
  document.addEventListener('click', kick, { once: true, signal });

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    wanted = !wanted;
    if (wanted) { tryPlay(); } else { vid.pause(); }
    btn.innerHTML = icon(wanted ? 'pause' : 'play', 16);
    btn.setAttribute('aria-label', wanted ? 'Pause the film' : 'Play the film');
    btn.setAttribute('aria-pressed', String(!wanted));
  }, { signal });

  signal?.addEventListener('abort', () => { io.disconnect(); vid.pause(); });
}
