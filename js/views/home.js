/* Home — the film, the three collections, what is new, and the looks. */
import { BRAND } from '../config.js';
import { COLLECTIONS, LOOKS, newIn } from '../data.js';
import { icon } from '../icons.js';
import { collectionCard, productCard, lookTile, secHead, moreLink, shot } from '../ui.js';
import { mountHero } from '../hero.js';

const hero = () => `
<section class="hero">
  <div class="hero-media full-colour">
    <img src="media/hero-poster.webp" alt="" width="576" height="1024" fetchpriority="high">
    <video src="media/hero.mp4" poster="media/hero-poster.webp" muted playsinline
           loop preload="metadata" aria-label="Campaign film"></video>
  </div>
  <div class="hero-body">
    <h1 class="hero-mark" aria-label="${BRAND.name} ${BRAND.sub}"></h1>
    <p class="hero-lede">${BRAND.lede}</p>
    <div class="hero-cta">
      <button class="btn btn-ink" data-act="nav" data-to="/shop" type="button">Shop the season</button>
      <button class="btn btn-line" data-act="look" data-i="0" type="button">Looks</button>
    </div>
  </div>
</section>`;

const collections = () => `
<section class="sec">
  ${secHead('Collections')}
  <div class="rail rail-c">
    ${COLLECTIONS.map((c) => collectionCard(c)).join('')}
  </div>
</section>`;

const fresh = () => `
<section class="sec">
  ${secHead('New in', moreLink('/shop'))}
  <div class="rail rail-p">
    ${newIn().map((p) => productCard(p, { sizes: '(max-width:520px) 63vw, 250px' })).join('')}
  </div>
</section>`;

const looks = () => `
<section class="sec">
  ${secHead('The looks', moreLink('/shop', 'Shop all'))}
  <div class="looks-strip">
    ${LOOKS.map((l, i) => lookTile(l, i)).join('')}
  </div>
</section>`;

const editorial = () => `
<section class="sec">
  <article class="ed">
    <span class="shot">
      <img ${shot('ed-noir', '(max-width:520px) 92vw, 470px')} alt="Lace Noir, campaign"
           loading="lazy" decoding="async" width="480" height="300">
    </span>
    <div class="ed-body">
      <p class="eyebrow">The house line</p>
      <h3 class="serif">Lace Noir</h3>
      <p class="lede">Black, white, and the lace that argues with both. Remade
        every year because it never stops selling.</p>
      <div style="height:16px"></div>
      <button class="btn btn-line btn-s" data-act="collection" data-id="noir"
              type="button">See the collection</button>
    </div>
  </article>
</section>`;

const quote = () => `
<section class="quote">
  <p>Colour belongs to the clothes, not the page.</p>
  <cite class="swap" data-touch="Touch a piece to see it"
        data-hover="Hover a piece to see it"></cite>
</section>`;

const footer = () => `
<footer class="footer">
  <div class="footer-mark"></div>
  <p>${BRAND.tagline}</p>
  <p>Free delivery over 3,500,000 Toman.</p>
  <a class="ig" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
    ${icon('instagram', 17)}@${BRAND.instagram}</a>
  <div class="notice">Preview build. Photography is the studio’s own; every
    price, name, fabric and delivery time on this site is placeholder copy.</div>
</footer>`;

export default {
  tab: 'home',
  title: BRAND.name,
  topbarAt: 320,
  render: () => hero() + collections() + fresh() + looks() + editorial() + quote() + footer(),
  mount: (app, signal) => mountHero(app, signal),
};
