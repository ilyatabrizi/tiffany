/* Shop — every piece, filtered. Categories live in the sticky bar; collection,
   size and sort live in a sheet so the bar stays one line on a phone. */
import { CATEGORIES, COLLECTIONS, PRODUCTS, SIZES } from '../data.js';
import { icon } from '../icons.js';
import { productCard, empty, openSheet, closeSheet } from '../ui.js';
import { esc, num } from '../util.js';
import { go } from '../router.js';

const SORTS = [
  { id: 'new', name: 'جدیدترین' },
  { id: 'low', name: 'ارزان‌ترین' },
  { id: 'high', name: 'گران‌ترین' },
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

const activeCount = (f) => (f.col ? 1 : 0) + (f.size ? 1 : 0) + (f.sort !== 'new' ? 1 : 0);

function filterSheet(f) {
  const chip = (on, act, val, label, style = '') =>
    `<button class="chip ${on ? 'on' : ''}" data-fset="${act}" data-val="${val}"
       type="button" ${style}>${label}</button>`;

  openSheet(`
    <h2>فیلتر</h2>
    <p class="lede">هر فصل یک تیراژ کم دوخته می‌شود.</p>

    <p class="eyebrow" style="margin:20px 0 10px">کالکشن</p>
    <div class="sizes">
      ${chip(!f.col, 'col', '', 'همه')}
      ${COLLECTIONS.map((c) => chip(f.col === c.id, 'col', c.id,
        `<i class="chip-sw" style="--dot:${c.accent}"></i><span dir="ltr">${esc(c.name)}</span>`)).join('')}
    </div>

    <p class="eyebrow" style="margin:22px 0 10px">سایز</p>
    <div class="sizes">
      ${chip(!f.size, 'size', '', 'فرقی نداره')}
      ${SIZES.map((s) => chip(f.size === s.id, 'size', s.id, s.id)).join('')}
    </div>

    <p class="eyebrow" style="margin:22px 0 10px">ترتیب</p>
    <div class="sizes">
      ${SORTS.map((s) => chip(f.sort === s.id, 'sort', s.id, esc(s.name))).join('')}
    </div>

    <div style="height:24px"></div>
    <button class="btn btn-ink btn-block" data-act="sheet-close" type="button">نمایش نتیجه‌ها</button>
    <div style="height:9px"></div>
    <button class="btn btn-quiet btn-block" data-fset="clear" type="button">پاک کردن همه</button>`,
  {
    label: 'فیلتر',
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
  title: 'فروشگاه',
  topbarAt: 30,

  render(parts, q) {
    const f = read(q);
    const list = select(f);
    const n = activeCount(f);
    return `
    <div class="topgap-bar"></div>
    <div class="shopbar">
      <div class="shopbar-row">
        <span class="count">${num(list.length)} قطعه${
          f.col ? ` — <span dir="ltr">${esc(COLLECTIONS.find((c) => c.id === f.col)?.name || '')}</span>` : ''}</span>
        <button class="chip ${n ? 'on' : ''}" data-act="filters" type="button">
          ${icon('sliders', 15)}فیلتر${n ? ` ${num(n)}` : ''}</button>
      </div>
      <div class="seg">
        ${CATEGORIES.map((c) => `
          <button class="chip ${f.cat === c.id ? 'on' : ''}" data-act="cat"
                  data-c="${c.id}" type="button">${esc(c.name)}</button>`).join('')}
      </div>
    </div>

    <div style="height:16px"></div>
    ${list.length ? `<div class="grid-p">${list.map((p) => productCard(p)).join('')}</div>`
      : empty('search', 'با این فیلترها چیزی نیست',
        'یک سایز دیگر را امتحان کن یا فیلترها را پاک کن.',
        '<button class="btn btn-line btn-s" data-act="nav" data-to="/shop" type="button">پاک کردن فیلترها</button>')}
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
