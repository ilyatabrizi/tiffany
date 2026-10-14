/* Shop — every piece, filtered. Categories live in the sticky bar; collection,
   size and sort live in a sheet so the bar stays one line on a phone. */
import { CATEGORIES, COLLECTIONS, PRODUCTS, SIZES, inCategory, getCategory } from '../data.js';
import { icon } from '../icons.js';
import { productCard, empty, openSheet, closeSheet } from '../ui.js';
import { esc, num } from '../util.js';
import { go } from '../router.js';
import { L } from '../i18n.js';
import { live } from '../live.js';

const SORTS = [
  { id: 'new', name: L('جدیدترین', 'Newest', 'En yeni') },
  { id: 'low', name: L('ارزون‌ترین', 'Lowest price', 'En düşük fiyat') },
  { id: 'high', name: L('گرون‌ترین', 'Highest price', 'En yüksek fiyat') },
];

function read(q) {
  return {
    cat: q.get('c') || 'all',
    col: q.get('col') || '',
    size: q.get('size') || '',
    sort: q.get('sort') || 'new',
  };
}

const toQuery = (f) => {
  const p = new URLSearchParams();
  if (f.cat && f.cat !== 'all') p.set('c', f.cat);
  if (f.col) p.set('col', f.col);
  if (f.size) p.set('size', f.size);
  if (f.sort && f.sort !== 'new') p.set('sort', f.sort);
  const s = p.toString();
  return '/shop' + (s ? `?${s}` : '');
};

function select(f) {
  let list = PRODUCTS.filter((p) => (f.cat === 'all' || p.cat === f.cat)
    && (!f.col || p.col === f.col)
    && (!f.size || p.sizes.includes(f.size)));
  if (f.sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
  if (f.sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
  if (f.sort === 'new') list = [...list].sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0));
  return list;
}

/* A category the studio listed but has not stocked yet says so, rather than
   blaming the visitor's filters. */
const soon = (f) => f.cat !== 'all' && Boolean(getCategory(f.cat)) && !inCategory(f.cat).length;

const activeCount = (f) => (f.col ? 1 : 0) + (f.size ? 1 : 0) + (f.sort !== 'new' ? 1 : 0);

function filterSheet(f) {
  const chip = (on, act, val, label, style = '') =>
    `<button class="chip ${on ? 'on' : ''}" data-fset="${act}" data-val="${val}"
       type="button" ${style}>${label}</button>`;

  openSheet(`
    <h2>${esc(L('فیلتر', 'Filter', 'Filtre'))}</h2>
    <p class="lede">${esc(L('هر فصل فقط یه تیراژ کم دوخته می‌شه.', 'Every season is cut in one small run.',
      'Her sezon tek ve küçük bir seri halinde dikilir.'))}</p>

    <p class="eyebrow" style="margin:20px 0 10px">${esc(L('کالکشن', 'Collection', 'Koleksiyon'))}</p>
    <div class="sizes">
      ${chip(!f.col, 'col', '', esc(L('همه', 'All', 'Tümü')))}
      ${COLLECTIONS.map((c) => chip(f.col === c.id, 'col', c.id,
        `<i class="chip-sw" style="--dot:${c.accent}"></i><span class="latin" dir="ltr">${esc(c.name)}</span>`)).join('')}
    </div>

    <p class="eyebrow" style="margin:22px 0 10px">${esc(L('سایز', 'Size', 'Beden'))}</p>
    <div class="sizes">
      ${chip(!f.size, 'size', '', esc(L('فرقی نداره', 'Any', 'Fark etmez')))}
      ${SIZES.map((s) => chip(f.size === s.id, 'size', s.id, s.id)).join('')}
    </div>

    <p class="eyebrow" style="margin:22px 0 10px">${esc(L('ترتیب', 'Sort', 'Sırala'))}</p>
    <div class="sizes">
      ${SORTS.map((s) => chip(f.sort === s.id, 'sort', s.id, esc(s.name))).join('')}
    </div>

    <div style="height:24px"></div>
    <button class="btn btn-ink btn-block" data-act="sheet-close" type="button">${esc(L('نشونم بده', 'Show results', 'Sonuçları göster'))}</button>
    <div style="height:9px"></div>
    <button class="btn btn-quiet btn-block" data-fset="clear" type="button">${esc(L('پاک کردن همه', 'Clear all', 'Hepsini temizle'))}</button>`,
  {
    label: L('فیلتر', 'Filter', 'Filtre'),
    onMount(sheet) {
      sheet.addEventListener('click', (e) => {
        const b = e.target.closest('[data-fset]');
        if (!b) return;
        const key = b.dataset.fset;
        if (key === 'clear') { closeSheet(); go('/shop'); return; }
        const next = { ...f, [key]: b.dataset.val };
        go(toQuery(next));
        closeSheet();
      });
    },
  });
}

export default {
  tab: 'shop',
  title: L('فروشگاه', 'Shop', 'Mağaza'),
  topbarAt: 30,

  /* No piece count in the bar — the studio asked for it gone. A collection
     filter still names itself, so a filtered grid says what it is. */
  render(parts, q) {
    const f = read(q);
    const list = select(f);
    const n = activeCount(f);
    const colName = f.col ? COLLECTIONS.find((c) => c.id === f.col)?.name || '' : '';
    return `
    <div class="topgap-bar"></div>
    <div class="shopbar">
      <div class="shopbar-row">
        <span class="count">${colName ? `<span dir="ltr">${esc(colName)}</span>` : ''}</span>
        <button class="chip ${n ? 'on' : ''}" data-act="filters" type="button">
          ${icon('sliders', 15)}${esc(L('فیلتر', 'Filter', 'Filtre'))}${n ? ` ${num(n)}` : ''}</button>
      </div>
      <div class="seg">
        ${CATEGORIES.map((c) => `
          <button class="chip ${f.cat === c.id ? 'on' : ''}" data-act="cat"
                  data-c="${c.id}" type="button">${esc(c.name)}</button>`).join('')}
      </div>
    </div>

    <div style="height:16px"></div>
    ${list.length ? `<div class="grid-p">${list.map((p) => productCard(p)).join('')}</div>`
      : !live.loaded ? empty('search', L('فروشگاه بارگذاری نشد', 'The shop did not load', 'Mağaza yüklenemedi'),
        L('اینترنت رو چک کن و دوباره امتحان کن.', 'Check your connection and try again.', 'Bağlantını kontrol edip tekrar dene.'),
        `<button class="btn btn-line btn-s" type="button" onclick="location.reload()">${esc(L('دوباره', 'Try again', 'Tekrar dene'))}</button>`)
      : soon(f) ? empty('hanger', L(`${getCategory(f.cat).name} به‌زودی میاد`,
        `${getCategory(f.cat).name} — coming soon`, `${getCategory(f.cat).name} çok yakında`),
        L('هنوز چیزی توی این دسته نذاشتیم. یه سر به بقیه‌ی دسته‌ها بزن.',
          'Nothing in this one yet. Have a look round the others.',
          'Bu kategoride henüz bir şey yok. Diğerlerine bir göz at.'),
        `<button class="btn btn-line btn-s" data-act="nav" data-to="/shop" type="button">${esc(L('دیدن همه', 'Shop everything', 'Hepsini gör'))}</button>`)
      : empty('search', L('با این فیلترها چیزی پیدا نشد', 'Nothing matches those filters', 'Bu filtrelere uyan bir şey yok'),
        L('یه سایز دیگه رو امتحان کن یا فیلترها رو پاک کن.', 'Try another size or clear the filters.',
          'Başka bir beden dene ya da filtreleri temizle.'),
        `<button class="btn btn-line btn-s" data-act="nav" data-to="/shop" type="button">${esc(L('پاک کردن فیلترها', 'Clear filters', 'Filtreleri temizle'))}</button>`)}
    <div style="height:26px"></div>`;
  },

  mount(app, signal) {
    app.addEventListener('click', (e) => {
      const cat = e.target.closest('[data-act="cat"]');
      if (cat) {
        const f = read(new URLSearchParams(location.hash.split('?')[1] || ''));
        go(toQuery({ ...f, cat: cat.dataset.c }));
        return;
      }
      if (e.target.closest('[data-act="filters"]')) {
        filterSheet(read(new URLSearchParams(location.hash.split('?')[1] || '')));
      }
    }, { signal });
  },
};
