/* The product page. One real photograph per piece, plus the look it was shot
   in and the collection frame — which is how a lookbook shop actually reads. */
import { LOOKS, PRODUCTS, SIZES, colById, getProduct } from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, tap } from '../util.js';
import { addToBag, isWished } from '../store.js';
import {
  shot, bigShot, productCard, openSheet, closeSheet, toast, recommendSize,
} from '../ui.js';

/* Chosen size and colour live for as long as the page does. */
let pick = { id: null, size: null, colour: 0 };

const galleryFor = (p) => {
  const look = LOOKS.find((l) => l.items.includes(p.id));
  const col = colById[p.col];
  return [
    { img: p.img, wide: false, alt: p.name },
    ...(look ? [{ img: look.img, wide: true, alt: `${p.name} — ${look.title}` }] : []),
    { img: col.img, wide: false, alt: `${col.name} collection` },
  ];
};

const sizeGuideSheet = () => openSheet(`
  <h2>راهنمای سایز</h2>
  <p class="lede">اندازه‌های بدن به سانتی‌متر — نه اندازهٔ لباس. روی همان چیزی
    که معمولاً زیرش می‌پوشی اندازه بگیر.</p>
  <div class="guide">
    <div class="guide-row guide-head"><b>سایز</b><span>سینه</span><span>کمر</span><span>باسن</span></div>
    ${SIZES.map((s) => `<div class="guide-row"><b>${s.id}</b>
      <span>${s.bust[0]}–${s.bust[1]}</span>
      <span>${s.waist[0]}–${s.waist[1]}</span>
      <span>${s.hip[0]}–${s.hip[1]}</span></div>`).join('')}
  </div>
  <div style="height:20px"></div>
  <button class="btn btn-ink btn-block" data-act="fit" type="button">
    ${icon('ruler', 18)}ثبت اندازه‌های من</button>
  <div style="height:9px"></div>
  <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">بستن</button>`,
{ label: 'راهنمای سایز' });

function addSheet(p) {
  const rec = recommendSize(p);
  openSheet(`
    <h2>سایزت را انتخاب کن</h2>
    <p class="lede">${esc(p.name)} — ${toman(p.price)}</p>
    <div class="sizes" id="sheetSizes">
      ${p.sizes.map((s) => `<button class="size ${rec?.size === s ? 'rec' : ''}"
        data-size="${s}" type="button"><span dir="ltr">${esc(s)}</span></button>`).join('')}
    </div>
    ${rec ? `<p class="tiny" style="margin-top:12px">سایزی که نقطه دارد،
      پیشنهاد ما بر اساس اندازه‌های توست.</p>` : ''}`,
  {
    label: 'انتخاب سایز',
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
  addToBag(p.id, pick.size, colour.name);
  tap(12);
  toast(`به سبد اضافه شد — ${p.name}، ${pick.size}`, 'bag');
  document.dispatchEvent(new CustomEvent('bag:changed'));
}

export function addToBagFlow(id) {
  const p = getProduct(id);
  if (!p) return;
  if (pick.id !== id) pick = { id, size: null, colour: 0 };
  if (!pick.size) {
    if (p.sizes.length === 1) pick.size = p.sizes[0];
    else { addSheet(p); return; }
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
    return { title: p ? p.name : 'قطعه', wishId: p ? p.id : null };
  },

  render(parts) {
    const p = getProduct(parts[1]);
    if (!p) {
      return `<div class="empty"><h3 class="serif">توی کالکشن نیست</h3>
        <p>این قطعه در این فصل دوخته نشده.</p>
        <button class="btn btn-line btn-s" data-act="nav" data-to="/shop" type="button">
          برگرد به فروشگاه</button></div>`;
    }
    if (pick.id !== p.id) pick = { id: p.id, size: p.sizes.length === 1 ? p.sizes[0] : null, colour: 0 };

    const col = colById[p.col];
    const rec = recommendSize(p);
    const also = PRODUCTS.filter((x) => x.col === p.col && x.id !== p.id).slice(0, 6);
    const wished = isWished(p.id);

    return `
    <article style="--accent:${col.accent};--dot:${col.accent}">
      <button class="pdp-back" data-act="back" type="button" aria-label="برگشت">
        ${icon('chev', 20)}</button>

      <div class="pdp-gallery rail" style="grid-auto-columns:100%;padding:0">
        ${galleryFor(p).map((g, i) => `
          <span class="shot">
            <img ${g.wide ? bigShot(g.img, '100vw') : shot(g.img, '100vw')}
                 alt="${esc(g.alt)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
                 decoding="async" width="480" height="600">
          </span>`).join('')}
      </div>

      <header class="pdp-head">
        <button class="pdp-col" data-act="collection" data-id="${col.id}" type="button">
          <i class="chip-sw" style="--dot:${col.accent}"></i><span dir="ltr">${esc(col.name)}</span></button>
        <h1 class="pdp-title serif">${esc(p.name)}</h1>
        <div class="pdp-price">${toman(p.price)}</div>
        <p class="pdp-note">${esc(p.note)}</p>
      </header>

      ${p.colours.length > 1 ? `
      <div class="opt">
        <div class="opt-head"><span class="eyebrow">رنگ</span>
          <span class="tiny" id="colourName">${esc(p.colours[pick.colour].name)}</span></div>
        <div class="swatches">
          ${p.colours.map((c, i) => `
            <button class="swatch ${i === pick.colour ? 'on' : ''}" data-swatch="${i}"
              type="button" style="--dot:${c.hex}"><i></i>${esc(c.name)}</button>`).join('')}
        </div>
      </div>` : ''}

      <div class="opt">
        <div class="opt-head"><span class="eyebrow">سایز</span>
          <button class="link-more" data-act="guide" type="button">
            ${icon('ruler', 14)}راهنمای سایز</button></div>
        <div class="sizes" id="pdpSizes">
          ${p.sizes.map((s) => `<button class="size ${pick.size === s ? 'on' : ''}
            ${rec?.size === s ? 'rec' : ''}" data-size="${s}" type="button"><span
            dir="ltr">${esc(s)}</span></button>`).join('')}
        </div>
      </div>

      ${rec ? `<div class="fitbox">${icon('ruler', 19)}
        <div><b>سایزت احتمالاً <span dir="ltr">${esc(rec.size)}</span> است</b>
        <p>${esc(rec.why)}</p></div></div>`
      : `<div class="fitbox">${icon('ruler', 19)}
        <div><b>سایزت را نمی‌دانی؟</b>
        <p>یک بار سه تا اندازه را ثبت کن، بعد هر صفحه خودش می‌گوید چه سایزی بگیری.</p>
        <div style="height:9px"></div>
        <button class="btn btn-line btn-s" data-act="fit" type="button">ثبت اندازه‌ها</button>
        </div></div>`}

      <div class="spec">
        <details open><summary>جزئیات${icon('chevD', 17)}</summary>
          <div class="body">${esc(p.detail)}</div></details>
        <details><summary>جنس${icon('chevD', 17)}</summary>
          <div class="body">${esc(p.fabric)}</div></details>
        <details><summary>نگهداری${icon('chevD', 17)}</summary>
          <div class="body">${esc(p.care)}</div></details>
        <details><summary>ارسال و مرجوعی${icon('chevD', 17)}</summary>
          <div class="body">یک تا دو روز کاری بعد ارسال می‌شود. بالای
            ۳٬۵۰۰٬۰۰۰ تومان رایگان. تا ۷ روز، نپوشیده و با برچسب، قابل تعویض.</div></details>
      </div>

      <section class="sec">
        <div class="sec-head"><h2 class="serif">با این‌ها بپوش</h2></div>
        <div class="rail rail-p">${also.map((x) => productCard(x,
          { sizes: '(max-width:520px) 63vw, 250px' })).join('')}</div>
      </section>

      <div style="height:40px"></div>
    </article>

    <div class="buybar">
      <button class="icon-btn ${wished ? 'on' : ''}" data-act="wish" data-id="${p.id}"
        type="button" aria-pressed="${wished}" aria-label="ذخیرهٔ ${esc(p.name)}">
        ${icon('heart', 19)}</button>
      <button class="btn btn-ink btn-block" data-act="add" data-id="${p.id}" type="button">
        افزودن به سبد — ${toman(p.price)}</button>
    </div>`;
  },

  mount(app, signal) {
    const p = getProduct(location.hash.split('/')[2]?.split('?')[0]);

    app.addEventListener('click', (e) => {
      const size = e.target.closest('#pdpSizes [data-size]');
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
