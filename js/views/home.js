/* Home — the film, the three collections, what is new, and the stories. */
import { BRAND } from '../config.js';
import { COLLECTIONS, LOOKS, newIn } from '../data.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';
import {
  collectionCard, productCard, lookTile, secHead, moreLink, shot, alphaSig,
} from '../ui.js';
import { mountHero } from '../hero.js';
import { L, LANGS, ORDER, lang, setLang } from '../i18n.js';

/* The language switch: one small glass pill in the hero's top corner, a menu
   of three under it. Every option is written in its own language, so a
   visitor who reads none of the other two still finds theirs. */
const langSwitch = () => `
  <div class="lang" id="langSwitch">
    <button class="lang-btn" data-act="lang-menu" type="button" aria-haspopup="menu"
            aria-expanded="false" aria-controls="langMenu"
            aria-label="${esc(L('زبان', 'Language', 'Dil'))}">
      ${icon('globe', 16)}<span>${esc(LANGS[lang].name)}</span></button>
    <div class="lang-menu" id="langMenu" role="menu" hidden>
      ${ORDER.map((k) => `
        <button class="lang-opt ${k === lang ? 'on' : ''}" role="menuitemradio"
                aria-checked="${k === lang}" data-lang="${k}" type="button"
                lang="${k}" dir="${LANGS[k].dir}">
          <span>${esc(LANGS[k].name)}</span>${k === lang ? icon('check', 15) : ''}</button>`).join('')}
    </div>
  </div>`;

const hero = () => `
<section class="hero">
  <div class="hero-media full-colour">
    <img src="media/hero-poster.webp" alt="" width="576" height="1024" fetchpriority="high">
    <video src="media/hero.mp4" poster="media/hero-poster.webp" muted playsinline
           loop preload="metadata" aria-label="${esc(L('فیلم کمپین', 'Campaign film', 'Kampanya filmi'))}"></video>
  </div>
  ${langSwitch()}
  <div class="hero-body">
    <h1 class="hero-mark" aria-label="${BRAND.name} ${BRAND.sub}"></h1>
    <div class="hero-cta">
      <button class="btn btn-ink" data-act="nav" data-to="/shop" type="button">${esc(L('خرید', 'Shop', 'Alışveriş'))}</button>
      <button class="btn btn-line" data-act="look" data-i="0" type="button">${esc(L('استوری‌ها', 'Stories', 'Hikâyeler'))}</button>
    </div>
  </div>
</section>`;

const collections = () => `
<section class="sec">
  ${secHead(L('کالکشن‌ها', 'Collections', 'Koleksiyonlar'))}
  <div class="rail rail-c">
    ${COLLECTIONS.map((c) => collectionCard(c)).join('')}
  </div>
</section>`;

const fresh = () => `
<section class="sec">
  ${secHead(L('جدید', 'New', 'Yeni'), moreLink('/shop'))}
  <div class="rail rail-p">
    ${newIn().map((p) => productCard(p, { sizes: '(max-width:520px) 63vw, 250px' })).join('')}
  </div>
</section>`;

const looks = () => `
<section class="sec">
  ${secHead(L('استوری‌ها', 'Stories', 'Hikâyeler'),
    moreLink('/shop', L('همه رو ببین', 'Shop all', 'Hepsini gör')))}
  <div class="looks-strip">
    ${LOOKS.map((l, i) => lookTile(l, i)).join('')}
  </div>
</section>`;

const editorial = () => `
<section class="sec">
  <article class="ed">
    <span class="shot">
      <img ${shot('aw27-ed', '(max-width:520px) 92vw, 470px')}
           alt="${esc(L('کالکشن Autumn / Winter 2027', 'Autumn / Winter 2027 collection', 'Autumn / Winter 2027 koleksiyonu'))}"
           loading="lazy" decoding="async" width="480" height="300">
    </span>
    <div class="ed-body">
      <p class="eyebrow">${esc(L('کالکشن جدید', 'New collection', 'Yeni koleksiyon'))}</p>
      <h3 class="serif" dir="ltr">Autumn / Winter 2027</h3>
      <p class="lede">${esc(L(
        'هفت ست برای پاییز و زمستون: کاپشن و بارونی چرم، بافت‌های پشمی، شومیزهای نخی و جین.',
        'Seven looks for autumn and winter: leather jackets and trench coats, wool knits, cotton shirts and denim.',
        'Sonbahar ve kış için yedi kombin: deri montlar ve trençkotlar, yün trikolar, pamuklu gömlekler ve kot.'))}</p>
      <div style="height:16px"></div>
      <button class="btn btn-line btn-s" data-act="collection" data-id="aw27"
              type="button">${esc(L('دیدن کالکشن', 'See the collection', 'Koleksiyonu gör'))}</button>
    </div>
  </article>
</section>`;

/* What used to be a quote is just the hint now: how the colour works. */
const hint = () => `
<section class="quote quote-hint">
  <cite class="swap"
        data-touch="${esc(L('یکی رو لمس کن تا رنگش بیاد', 'Touch a piece to see its colour', 'Rengini görmek için bir parçaya dokun'))}"
        data-hover="${esc(L('نشانگر رو ببر روی یکی تا رنگش بیاد', 'Hover a piece to see its colour', 'Rengini görmek için imleci bir parçanın üstüne getir'))}"></cite>
</section>`;

const footer = () => `
<footer class="footer">
  <div class="footer-mark"></div>
  <a class="ig" href="${BRAND.instagramUrl}" target="_blank" rel="noopener" dir="ltr">
    ${icon('instagram', 17)}<span>@${BRAND.instagram}</span></a>
  <nav class="footer-links" aria-label="${esc(L('اطلاعات فروشگاه', 'Shop information', 'Mağaza bilgileri'))}">
    <a href="#/about">${esc(L('درباره‌ی ما', 'About us', 'Hakkımızda'))}</a>
    <a href="#/contact">${esc(L('شعبه‌ها و تماس', 'Stores & contact', 'Mağazalar ve iletişim'))}</a>
    <a href="#/terms">${esc(L('قوانین و شرایط', 'Terms & policies', 'Koşullar ve politikalar'))}</a>
  </nav>

  <div class="footer-rule"></div>
  ${alphaSig()}
  <p class="footer-legal" dir="ltr">© ${new Date().getFullYear()} ${BRAND.full}</p>
</footer>`;

/* The menu opens and closes here; the pick itself reloads the page. */
function mountLang(app, signal) {
  const box = app.querySelector('#langSwitch');
  if (!box) return;
  const btn = box.querySelector('.lang-btn');
  const menu = box.querySelector('.lang-menu');
  const set = (open) => {
    menu.hidden = !open;
    box.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('.lang-opt.on')?.focus({ preventScroll: true });
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(menu.hidden); }, { signal });
  menu.addEventListener('click', (e) => {
    const o = e.target.closest('[data-lang]');
    if (!o) return;
    e.stopPropagation();
    if (o.dataset.lang === lang) { set(false); return; }
    setLang(o.dataset.lang);
  }, { signal });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !box.contains(e.target)) set(false);
  }, { signal });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); }
  }, { signal });
}

export default {
  tab: 'home',
  title: BRAND.name,
  topbarAt: 320,
  render: () => hero() + collections() + fresh() + looks() + editorial() + hint() + footer(),
  mount: (app, signal) => { mountHero(app, signal); mountLang(app, signal); },
};
