/* The campaign film.

   Autoplay-muted-inline is allowed on iOS, but not in Low Power Mode and not
   under prefers-reduced-motion — in both cases the poster is the hero and
   nothing looks broken. The clip is paused whenever it scrolls out of view or
   the tab is hidden, because a looping video behind five screens of content is
   pure battery. */
export function mountHero(root, signal) {
  const hero = root.querySelector('.hero');
  const vid = root.querySelector('.hero video');
  if (!hero || !vid) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    vid.remove();
    return;
  }

  const tryPlay = () => vid.play().catch(() => { /* the poster carries it */ });
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

  signal?.addEventListener('abort', () => { io.disconnect(); vid.pause(); });
}
