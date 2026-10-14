/* The product page. One real photograph per piece, plus the story it was shot
   in and the collection frame — which is how a lookbook shop actually reads. */
import {
  LOOKS, PRODUCTS, SIZES, colById, getProduct, sizeLabel, isOneSize, NO_COL, soldOut,
} from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, tap, COMMA } from '../util.js';
import { addToBag, isWished } from '../store.js';
import {
  shot, bigShot, productCard, openSheet, closeSheet, toast, recommendSize,
} from '../ui.js';
import { L } from '../i18n.js';

/* Chosen size and colour live for as long as the page does. */
let pick = { id: null, size: null, colour: 0 };

/* A size code is a name and stays Latin; one-size reads in the page's language. */
const sizeTag = (s) => (isOneSize(s) ? esc(sizeLabel(s)) : `<span dir="ltr">${esc(s)}</span>`);

/* Every photo the back office holds for the piece, then the story it was shot
   in, then its collection's frame (a piece outside every collection has none). */
const galleryFor = (p) => {
  const look = LOOKS.find((l) => l.items.includes(p.id));
  const col = colById[p.col];
  return [
    ...p.images.map((im, i) => ({ img: im, wide: false, alt: i ? `${p.name} — ${i + 1}` : p.name })),
    ...(look ? [{ img: look.img, wide: true, alt: `${p.name} — ${look.title}` }] : []),
    ...(col ? [{ img: col.img, wide: false, alt: L(`کالکشن ${col.name}`, `${col.name} collection`, `${col.name} koleksiyonu`) }] : []),
  ];
};
const isOut = (p, s) => p.soldout.includes(s);
const sizeBtn = (p, s, cls = '') => `<button class="size ${cls} ${isOut(p, s) ? 'out' : ''}"
  data-size="${s}" type="button" ${isOut(p, s) ? `disabled aria-disabled="true" title="${esc(L('تموم شد', 'Sold out', 'Tükendi'))}"` : ''}>${sizeTag(s)}</button>`;
const firstSize = (p) => {
  const open = p.sizes.filter((s) => !isOut(p, s));
  return open.length === 1 && p.sizes.length === 1 ? open[0] : null;
};

const sizeGuideSheet = () => openSheet(`
  <h2>${esc(L('راهنمای سایز', 'Size guide', 'Beden rehberi'))}</h2>
  <p class="lede">${esc(L(
    'اندازه‌های بدن به سانتی‌متره، نه اندازه‌ی لباس. روی همون چیزی که معمولاً زیرش می‌پوشی اندازه بگیر.',
    'Body measurements in centimetres — not garment measurements. Measure over what you usually wear underneath.',
    'Ölçüler santimetre cinsinden vücut ölçüsüdür, giysi ölçüsü değil. Genelde altına giydiğin şeyin üstünden ölç.'))}</p>
  <div class="guide">
    <div class="guide-row guide-head"><b>${esc(L('سایز', 'Size', 'Beden'))}</b><span>${esc(L('سینه', 'Bust', 'Göğüs'))}</span><span>${esc(L('کمر', 'Waist', 'Bel'))}</span><span>${esc(L('باسن', 'Hip', 'Kalça'))}</span></div>
    ${SIZES.map((s) => `<div class="guide-row"><b>${s.id}</b>
      <span>${s.bust[0]}–${s.bust[1]}</span>
      <span>${s.waist[0]}–${s.waist[1]}</span>
      <span>${s.hip[0]}–${s.hip[1]}</span></div>`).join('')}
  </div>
  <div style="height:20px"></div>
  <button class="btn btn-ink btn-block" data-act="fit" type="button">
    ${icon('ruler', 18)}${esc(L('ثبت اندازه‌هام', 'Save my measurements', 'Ölçülerimi kaydet'))}</button>
  <div style="height:9px"></div>
  <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('بستن', 'Close', 'Kapat'))}</button>`,
{ label: L('راهنمای سایز', 'Size guide', 'Beden rehberi') });

function addSheet(p) {
  const rec = recommendSize(p);
  openSheet(`
    <h2>${esc(L('سایزت رو انتخاب کن', 'Choose your size', 'Bedenini seç'))}</h2>
    <p class="lede">${esc(p.name)} — ${toman(p.price)}</p>
    <div class="sizes" id="sheetSizes">
      ${p.sizes.map((s) => sizeBtn(p, s, rec?.size === s ? 'rec' : '')).join('')}
    </div>
    ${rec ? `<p class="tiny" style="margin-top:12px">${esc(L(
      'سایزی که نقطه داره، پیشنهاد ما بر اساس اندازه‌های خودته.',
      'The dotted size is our pick, based on your measurements.',
      'Noktalı beden, ölçülerine göre bizim önerimiz.'))}</p>` : ''}`,
  {
    label: L('انتخاب سایز', 'Choose a size', 'Beden seç'),
    onMount(sheet) {
      sheet.addEventListener('click', (e) => {
        const b = e.target.closest('[data-size]');
        if (!b) return;
        pick.size = b.dataset.size;
        closeSheet();
        commit(p);
      });
    },
  });
}

function commit(p) {
  const colour = p.colours[pick.colour] || p.colours[0];
  /* The bag keeps the hex, not the label — labels change with the language. */
  addToBag(p.id, pick.size, colour.hex);
  tap(12);
  const what = `${p.name}${COMMA}${sizeLabel(pick.size)}`;
  toast(L(`به سبد اضافه شد — ${what}`, `Added — ${what}`, `Sepete eklendi — ${what}`), 'bag');
  document.dispatchEvent(new CustomEvent('bag:changed'));
}

export function addToBagFlow(id) {
  const p = getProduct(id);
  if (!p) return;
  if (soldOut(p)) {
    toast(L('این قطعه تموم شده.', 'This piece has sold out.', 'Bu parça tükendi.'), 'info');
    return;
  }
  if (pick.id !== id) pick = { id, size: null, colour: 0 };
  if (pick.size && isOut(p, pick.size)) pick.size = null;
  if (!pick.size) {
    pick.size = firstSize(p);
    if (!pick.size) { addSheet(p); return; }
  }
  commit(p);
}

export default {
  tab: '',
  back: true,
  hideTabs: true,
  topbarAt: 260,

  meta(parts) {
    const p = getProduct(parts[1]);
    return { title: p ? p.name : L('قطعه', 'Piece', 'Parça'), wishId: p ? p.id : null };
  },

  render(parts) {
    const p = getProduct(parts[1]);
    if (!p) {
      return `<div class="empty"><h3 class="serif">${esc(L('توی کالکشن نیست', 'Not in the collection', 'Koleksiyonda yok'))}</h3>
        <p>${esc(L('این قطعه این فصل دوخته نشده.', 'This piece was not made this season.', 'Bu parça bu sezon dikilmedi.'))}</p>
        <button class="btn btn-line btn-s" data-act="nav" data-to="/shop" type="button">
          ${esc(L('برگرد به فروشگاه', 'Back to the shop', 'Mağazaya dön'))}</button></div>`;
    }
    if (pick.id !== p.id) pick = { id: p.id, size: firstSize(p), colour: 0 };

    const col = colById[p.col] || NO_COL;
    const rec = recommendSize(p);
    /* Letter sizes have a body chart; trouser waists and shoe sizes do not. */
    const lettered = p.sizes.some((s) => SIZES.some((z) => z.id === s));
    /* Wear it with: what it was shot with first, then the rest of its collection. */
    const mates = [...new Set(LOOKS.filter((l) => l.items.includes(p.id)).flatMap((l) => l.items))]
      .map(getProduct).filter((x) => x && x.id !== p.id);
    const rest = PRODUCTS.filter((x) => (col.id ? x.col === p.col : x.cat === p.cat)
      && x.id !== p.id && !mates.includes(x));
    const also = [...mates, ...rest].slice(0, 6);
    const spec = [
      [L('جزئیات', 'Details', 'Detaylar'), p.detail],
      [L('جنس', 'Fabric', 'Kumaş'), p.fabric],
      [L('نگهداری', 'Care', 'Bakım'), p.care],
    ].filter(([, body]) => body);
    const wished = isWished(p.id);
    const out = soldOut(p);

    return `
    <article style="--accent:${col.accent};--dot:${col.accent}">
      <button class="pdp-back" data-act="back" type="button" aria-label="${esc(L('برگشت', 'Back', 'Geri'))}">
        ${icon('chev', 20, 'back-ico')}</button>

      <div class="pdp-gallery rail" style="grid-auto-columns:100%;padding:0">
        ${galleryFor(p).map((g, i) => `
          <span class="shot">
            <img ${g.wide ? bigShot(g.img, '100vw') : shot(g.img, '100vw')}
                 alt="${esc(g.alt)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
                 decoding="async" width="480" height="600">
          </span>`).join('')}
      </div>

      <header class="pdp-head">
        ${col.id ? `<button class="pdp-col" data-act="collection" data-id="${col.id}" type="button">
          <i class="chip-sw" style="--dot:${col.accent}"></i><span class="latin" dir="ltr">${esc(col.name)}</span></button>` : ''}
        <h1 class="pdp-title serif">${esc(p.name)}</h1>
        <div class="pdp-price">${toman(p.price)}</div>
        <p class="pdp-note">${esc(p.note)}</p>
      </header>

      ${p.colours.length > 1 ? `
      <div class="opt">
        <div class="opt-head"><span class="eyebrow">${esc(L('رنگ', 'Colour', 'Renk'))}</span>
          <span class="tiny" id="colourName">${esc(p.colours[pick.colour].name)}</span></div>
        <div class="swatches">
          ${p.colours.map((c, i) => `
            <button class="swatch ${i === pick.colour ? 'on' : ''}" data-swatch="${i}"
              type="button" style="--dot:${c.hex}"><i></i>${esc(c.name)}</button>`).join('')}
        </div>
      </div>` : ''}

      <div class="opt">
        <div class="opt-head"><span class="eyebrow">${esc(L('سایز', 'Size', 'Beden'))}</span>
          ${lettered ? `<button class="link-more" data-act="guide" type="button">
            ${icon('ruler', 14)}${esc(L('راهنمای سایز', 'Size guide', 'Beden rehberi'))}</button>` : ''}</div>
        <div class="sizes" id="pdpSizes">
          ${p.sizes.map((s) => sizeBtn(p, s, `${pick.size === s ? 'on' : ''} ${rec?.size === s ? 'rec' : ''}`)).join('')}
        </div>
      </div>

      ${!lettered ? '' : rec ? `<div class="fitbox">${icon('ruler', 19)}
        <div><b>${L(
          `احتمالاً سایزت <span dir="ltr">${esc(rec.size)}</span> باشه`,
          `You are probably a ${esc(rec.size)}`,
          `Bedenin büyük ihtimalle ${esc(rec.size)}`)}</b>
        <p>${esc(rec.why)}</p></div></div>`
      : `<div class="fitbox">${icon('ruler', 19)}
        <div><b>${esc(L('سایزت رو نمی‌دونی؟', 'Not sure of your size?', 'Bedeninden emin değil misin?'))}</b>
        <p>${esc(L(
          'یه بار سه تا اندازه ثبت کن، بعدش هر صفحه خودش بهت می‌گه چه سایزی بگیری.',
          'Save three measurements once and every product page names your size.',
          'Üç ölçünü bir kez kaydet, sonra her ürün sayfası sana hangi bedeni alacağını söylesin.'))}</p>
        <div style="height:9px"></div>
        <button class="btn btn-line btn-s" data-act="fit" type="button">${esc(L('ثبت اندازه‌ها', 'Add measurements', 'Ölçü ekle'))}</button>
        </div></div>`}

      <div class="spec">
        ${spec.map(([head, body], i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(head)}${icon('chevD', 17)}</summary>
          <div class="body">${esc(body)}</div></details>`).join('')}
        <details><summary>${esc(L('ارسال و مرجوعی', 'Delivery and returns', 'Teslimat ve iade'))}${icon('chevD', 17)}</summary>
          <div class="body">${esc(L(
            'ارسال رایگانه و نهایتاً ۳ روز کاری طول می‌کشه. تا ۷ روز بعد از تحویل، اگه نپوشیده باشی و برچسبش سالم باشه، عوض یا مرجوعش می‌کنیم.',
            'Free delivery, within 3 working days at most. Exchange or return within 7 days of delivery, unworn with tags intact.',
            'Ücretsiz teslimat, en geç 3 iş günü içinde. Teslimattan sonraki 7 gün içinde, giyilmemiş ve etiketi sağlamsa değişim ya da iade.'))}
            <a class="more-link" href="#/terms">${esc(L('قوانین کامل', 'Full terms', 'Tüm koşullar'))}</a></div></details>
      </div>

      ${also.length ? `<section class="sec">
        <div class="sec-head"><h2 class="serif">${esc(L('با اینا بپوش', 'Wear it with', 'Bununla giy'))}</h2></div>
        <div class="rail rail-p">${also.map((x) => productCard(x,
          { sizes: '(max-width:520px) 63vw, 250px' })).join('')}</div>
      </section>` : ''}

      <div style="height:40px"></div>
    </article>

    <div class="buybar">
      <button class="icon-btn ${wished ? 'on' : ''}" data-act="wish" data-id="${p.id}"
        type="button" aria-pressed="${wished}"
        aria-label="${esc(L(`ذخیره کردن ${p.name}`, `Save ${p.name}`, `${p.name} kaydet`))}">
        ${icon('heart', 19)}</button>
      <button class="btn btn-ink btn-block" data-act="add" data-id="${p.id}" type="button" ${out ? 'disabled' : ''}>
        ${out ? esc(L('تموم شد', 'Sold out', 'Tükendi'))
    : `${esc(L('افزودن به سبد', 'Add to bag', 'Sepete ekle'))} — ${toman(p.price)}`}</button>
    </div>`;
  },

  mount(app, signal) {
    const p = getProduct(location.hash.split('/')[2]?.split('?')[0]);

    app.addEventListener('click', (e) => {
      const size = e.target.closest('#pdpSizes [data-size]:not(.out)');
      if (size) {
        pick.size = size.dataset.size;
        app.querySelectorAll('#pdpSizes .size').forEach((b) =>
          b.classList.toggle('on', b === size));
        tap();
        return;
      }
      /* Deliberately not [data-colour]: the <html> element carries that for
         the colour preference, and closest() would match it on every click. */
      const sw = e.target.closest('[data-swatch]');
      if (sw) {
        pick.colour = Number(sw.dataset.swatch);
        app.querySelectorAll('[data-swatch]').forEach((b) =>
          b.classList.toggle('on', b === sw));
        const label = app.querySelector('#colourName');
        if (label && p) label.textContent = p.colours[pick.colour].name;
        return;
      }
      if (e.target.closest('[data-act="guide"]')) sizeGuideSheet();
    }, { signal });

    /* The floating back button is only useful while the top bar is hidden. */
    const back = app.querySelector('.pdp-back');
    const onScroll = () => back?.classList.toggle('gone', window.scrollY > 240);
    addEventListener('scroll', onScroll, { passive: true, signal });
    onScroll();
  },
};
