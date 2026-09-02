/* One collection: the frame it was shot in, the story, then the pieces. */
import { COLLECTIONS, getCollection, inCollection, LOOKS } from '../data.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';
import { shot, bigShot, productCard, collectionCard, empty } from '../ui.js';

export default {
  tab: '',
  back: true,
  topbarAt: 220,

  meta(parts) {
    const c = getCollection(parts[1]);
    return { title: c ? c.name : 'Collection' };
  },

  render(parts) {
    const c = getCollection(parts[1]);
    if (!c) {
      return empty('search', 'No such collection', 'It may have sold through.',
        '<button class="btn btn-line btn-s" data-act="nav" data-to="/shop" type="button">Shop everything</button>');
    }
    const items = inCollection(c.id);
    const looks = LOOKS.filter((l) => l.col === c.id);
    const others = COLLECTIONS.filter((x) => x.id !== c.id);

    return `
    <article style="--accent:${c.accent};--dot:${c.accent}">
      <button class="pdp-back" data-act="back" type="button" aria-label="Back">
        ${icon('chevL', 20)}</button>
      <span class="shot full-colour" style="border-radius:0;display:block;aspect-ratio:3/4">
        <img ${shot(c.img, '100vw')} alt="${esc(c.name)}" fetchpriority="high"
             decoding="async" width="480" height="640">
      </span>

      <header class="wrap" style="padding-top:24px">
        <p class="eyebrow">${esc(c.season)}</p>
        <h1 class="display" style="font-size:clamp(38px,12vw,54px);margin:8px 0 12px">
          ${esc(c.name)}</h1>
        <p class="lede" style="font-size:15.5px">${esc(c.lede)}</p>
        <div style="height:14px"></div>
        <p class="lede">${esc(c.body)}</p>
      </header>

      ${looks.length ? `
      <section class="sec">
        <div class="sec-head"><h2 class="serif">Shot in</h2></div>
        <div class="rail" style="grid-auto-columns:74vw">
          ${looks.map((l) => `
            <figure style="margin:0">
              <span class="shot full-colour" style="aspect-ratio:9/16">
                <img ${bigShot(l.img, '74vw')} alt="${esc(l.title)}" loading="lazy"
                     decoding="async" width="720" height="1280">
              </span>
              <figcaption class="tiny" style="margin-top:8px">${esc(l.caption)}</figcaption>
            </figure>`).join('')}
        </div>
      </section>` : ''}

      <section class="sec">
        <div class="sec-head"><h2 class="serif">The pieces</h2>
          <span class="tiny">${items.length}</span></div>
        <div class="grid-p">${items.map((p) => productCard(p)).join('')}</div>
      </section>

      <section class="sec">
        <div class="sec-head"><h2 class="serif">Also this year</h2></div>
        <div class="rail rail-c">${others.map((x) => collectionCard(x)).join('')}</div>
      </section>

      <div style="height:44px"></div>
    </article>`;
  },

  /* The floating back button is only useful while the top bar is hidden. */
  mount(app, signal) {
    const back = app.querySelector('.pdp-back');
    const onScroll = () => back?.classList.toggle('gone', window.scrollY > 200);
    addEventListener('scroll', onScroll, { passive: true, signal });
    onScroll();
  },
};
