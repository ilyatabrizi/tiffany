/* Home — the film, the three collections, what is new, and the looks. */
import { BRAND } from '../config.js';
import { COLLECTIONS, LOOKS, newIn } from '../data.js';
import { icon } from '../icons.js';
import {
  collectionCard, productCard, lookTile, secHead, moreLink, shot, alphaSig,
} from '../ui.js';
import { mountHero } from '../hero.js';

const hero = () => `
<section class="hero">
  <div class="hero-media full-colour">
    <img src="media/hero-poster.webp" alt="" width="576" height="1024" fetchpriority="high">
    <video src="media/hero.mp4" poster="media/hero-poster.webp" muted playsinline
           loop preload="metadata" aria-label="فیلم کمپین"></video>
  </div>
  <div class="hero-body">
    <h1 class="hero-mark" aria-label="${BRAND.name} ${BRAND.sub}"></h1>
    <p class="hero-lede">${BRAND.lede}</p>
    <div class="hero-cta">
      <button class="btn btn-ink" data-act="nav" data-to="/shop" type="button">خرید کالکشن</button>
      <button class="btn btn-line" data-act="look" data-i="0" type="button">لوک‌ها</button>
    </div>
  </div>
</section>`;

const collections = () => `
<section class="sec">
  ${secHead('کالکشن‌ها')}
  <div class="rail rail-c">
    ${COLLECTIONS.map((c) => collectionCard(c)).join('')}
  </div>
</section>`;

const fresh = () => `
<section class="sec">
  ${secHead('تازه‌رسیده‌ها', moreLink('/shop'))}
  <div class="rail rail-p">
    ${newIn().map((p) => productCard(p, { sizes: '(max-width:520px) 63vw, 250px' })).join('')}
  </div>
</section>`;

const looks = () => `
<section class="sec">
  ${secHead('لوک‌ها', moreLink('/shop', 'همه رو ببین'))}
  <div class="looks-strip">
    ${LOOKS.map((l, i) => lookTile(l, i)).join('')}
  </div>
</section>`;

const editorial = () => `
<section class="sec">
  <article class="ed">
    <span class="shot">
      <img ${shot('ed-noir', '(max-width:520px) 92vw, 470px')} alt="کمپین Lace Noir"
           loading="lazy" decoding="async" width="480" height="300">
    </span>
    <div class="ed-body">
      <p class="eyebrow">خط اصلی برند</p>
      <h3 class="serif" dir="ltr">Lace Noir</h3>
      <p class="lede">مشکی، سفید، و دانتلی که با هر دوشان بحث می‌کند. هر سال
        دوباره دوخته می‌شود، چون هیچ‌وقت فروشش تمام نمی‌شود.</p>
      <div style="height:16px"></div>
      <button class="btn btn-line btn-s" data-act="collection" data-id="noir"
              type="button">دیدن کالکشن</button>
    </div>
  </article>
</section>`;

const quote = () => `
<section class="quote">
  <p>رنگ مال لباس‌هاست، نه صفحه.</p>
  <cite class="swap" data-touch="یکی رو لمس کن تا رنگش بیاد"
        data-hover="نشانگر رو روی یکی ببر تا رنگش بیاد"></cite>
</section>`;

const footer = () => `
<footer class="footer">
  <div class="footer-mark"></div>
  <p>${BRAND.tagline}</p>
  <p>ارسال رایگان برای خرید بالای ۳٬۵۰۰٬۰۰۰ تومان.</p>
  <a class="ig" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
    ${icon('instagram', 17)}@${BRAND.instagram}</a>

  <div class="footer-rule"></div>
  ${alphaSig()}
  <p class="footer-legal" dir="ltr">© ${new Date().getFullYear()} ${BRAND.full}</p>

  <div class="notice">نسخهٔ پیش‌نمایش. عکس‌ها مال خود برند است؛ قیمت‌ها، اسم‌ها،
    جنس پارچه و زمان ارسال روی این سایت همگی نمونه‌اند.</div>
</footer>`;

export default {
  tab: 'home',
  title: BRAND.name,
  topbarAt: 320,
  render: () => hero() + collections() + fresh() + looks() + editorial() + quote() + footer(),
  mount: (app, signal) => mountHero(app, signal),
};
