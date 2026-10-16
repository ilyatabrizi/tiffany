/* کاتالوگ — collections, categories, sizes and the stories, in Persian,
   English and Turkish.

   The PIECES themselves are not in this file any more: they live in the
   shop's database, are edited in the back office (/admin) and arrive from
   /api/catalog.php when the shop opens (see live.js → setCatalogue below).
   The database's first catalogue was the one that used to sit here; it is
   kept in api/lib/seed.json.

   Persian is written the way people talk (خودمونی), not the way a form reads.
   Collection names stay in Latin on purpose — they are names.

   A colour's identity is its hex and a size's is its code — the bag stores
   those, never a translated label, so a bag filled in Persian still reads
   right after switching to English. */
import { L } from './i18n.js';

const T = L;
/** A colour: hex is the key, the three names are labels. */
const C = (hex, fa, en, tr) => ({ hex, name: L(fa, en, tr), all: [fa, en, tr] });

/* The studio's first real collection (photos and pieces sent 2026-10-14).
   The three made-up preview collections are gone with the preview pieces. */
export const COLLECTIONS = [
  {
    id: 'aw27',
    name: 'Autumn / Winter 2027',
    season: T('پاییز و زمستون', 'Autumn / Winter', 'Sonbahar / Kış'),
    accent: '#7A4A2E',
    accent2: '#C9B49A',
    img: 'aw27-col',
    lede: T('کالکشن جدید پاییز و زمستون تیفانی.',
      'TIFFANY\'s new autumn and winter collection.',
      'TIFFANY\'nin yeni sonbahar ve kış koleksiyonu.'),
    body: T('کاپشن و بارونی چرم، بافت‌های پشمی، شومیزهای نخی، شلوارهای جین و اویشو، و کپ و کانورس و کیف برای کامل کردن هر ست.',
      'Leather jackets and trench coats, wool knits, cotton shirts, denim and Avishu trousers, plus caps, sneakers and a bag to finish each look.',
      'Deri montlar ve trençkotlar, yün trikolar, pamuklu gömlekler, kot ve Avishu pantolonlar; her kombini tamamlamak için şapka, spor ayakkabı ve çanta.'),
  },
];

/* The studio's own twelve, in the order they sent them (2026-10-07). The
   labels are theirs word for word; empty ones stay listed and say so. */
export const CATEGORIES = [
  { id: 'all', name: T('همه', 'All', 'Tümü') },
  { id: 'knit', name: T('بافت', 'Knitwear', 'Triko') },
  { id: 'tee', name: T('تیشرت', 'T-shirts', 'Tişört') },
  { id: 'top', name: T('تاپ', 'Tops', 'Top') },
  { id: 'hoodie', name: T('هودی و سوشرت', 'Hoodies & sweatshirts', 'Kapüşonlu & sweatshirt') },
  { id: 'vest', name: T('وست', 'Vests', 'Yelek') },
  { id: 'shirt', name: T('شومیز', 'Shirts & blouses', 'Gömlek & bluz') },
  { id: 'trousers', name: T('شلوار', 'Trousers', 'Pantolon') },
  { id: 'skirts', name: T('دامن', 'Skirts', 'Etek') },
  { id: 'jacket', name: T('کاپشن', 'Jackets', 'Mont') },
  { id: 'cardigan', name: T('ژاکت', 'Cardigans', 'Hırka') },
  { id: 'accessories', name: T('اکسسوری', 'Accessories', 'Aksesuar') },
  { id: 'shoes', name: T('کفش', 'Shoes', 'Ayakkabı') },
];

/* سایزهایی که واقعاً دوخته می‌شن، و اندازه‌ی بدنی که براش دوخته شده (سانتی‌متر) */
export const SIZES = [
  { id: 'XS', bust: [78, 83], waist: [60, 65], hip: [86, 91] },
  { id: 'S', bust: [83, 88], waist: [65, 70], hip: [91, 96] },
  { id: 'M', bust: [88, 94], waist: [70, 76], hip: [96, 102] },
  { id: 'L', bust: [94, 100], waist: [76, 82], hip: [102, 108] },
  { id: 'XL', bust: [100, 107], waist: [82, 89], hip: [108, 115] },
];
/* One size is stored as OS. Bags saved before the switch hold its old
   Persian or English label, so those read as OS too. */
const OS_NAMES = ['OS', 'فری‌سایز', 'One size', 'Standart beden'];
export const isOneSize = (s) => OS_NAMES.includes(s);
export const sizeLabel = (s) => (isOneSize(s) ? T('فری‌سایز', 'One size', 'Standart beden') : s);

/* -------------------------------------------------------------- pieces */
export const PRODUCTS = [];

const BADGES = {
  new: T('جدید', 'New', 'Yeni'),
  campaign: T('کمپین', 'Campaign', 'Kampanya'),
  bestseller: T('پرفروش', 'Best seller', 'Çok satan'),
  restock: T('دوباره موجود', 'Restocked', 'Yeniden stokta'),
  last: T('آخرین‌ها', 'Last pieces', 'Son parçalar'),
};
/** A {fa, en, tr} block in this page's language; an empty translation falls back. */
const pick = (o) => {
  if (!o || typeof o !== 'object') return String(o || '');
  const fa = o.fa || '';
  return L(fa, o.en || fa, o.tr || o.en || fa);
};

/** Fill the shop from the catalogue the API sent (see live.js). */
export function setCatalogue(list) {
  PRODUCTS.length = 0;
  Object.keys(byId).forEach((k) => delete byId[k]);
  for (const r of list || []) {
    if (!r || !r.id || !Array.isArray(r.images) || !r.images.length) continue;
    const p = {
      id: r.id,
      name: pick(r.name),
      col: colById[r.col] ? r.col : '',
      cat: r.cat,
      price: Number(r.price) || 0,
      img: r.images[0],
      images: r.images,
      sizes: r.sizes?.length ? r.sizes : ['OS'],
      soldout: r.soldout || [],
      fit: r.fit || 'true',
      badge: r.badge ? BADGES[r.badge] : '',
      colours: (r.colours || []).map((c) => C(c.hex, c.fa, c.en || c.fa, c.tr || c.en || c.fa)),
      note: pick(r.note),
      detail: pick(r.detail),
      fabric: pick(r.fabric),
      care: pick(r.care),
    };
    if (!p.colours.length) p.colours = [C('#111111', 'مشکی', 'Black', 'Siyah')];
    PRODUCTS.push(p);
    byId[p.id] = p;
  }
}

/** Every size of this piece is sold out. */
export const soldOut = (p) => Boolean(p && p.sizes.every((s) => p.soldout.includes(s)));

/* استوری‌ها — the stories: the studio's seven looks for the new collection,
   each one carrying the pieces worn in it. */
const AW = T('کالکشن جدید پاییز و زمستون.', 'The new autumn and winter collection.', 'Yeni sonbahar ve kış koleksiyonu.');
export const LOOKS = [
  { id: 'aw1', img: 'aw27-look-1', col: 'aw27', caption: AW,
    title: T('کاپشن چرم و بافت راه‌راه', 'Leather jacket, striped knit', 'Deri mont, çizgili triko'),
    items: ['leather-jacket', 'striped-knit', 'chocolate-jeans', 'cotton-cap', 'silk-scarf'] },
  { id: 'aw2', img: 'aw27-look-2', col: 'aw27', caption: AW,
    title: T('بارونی چرم و ست اویشو', 'Leather trench, Avishu set', 'Deri trençkot, Avishu takım'),
    items: ['leather-trench', 'avishu-set', 'karl-lagerfeld-bag', 'white-collar-knit', 'cotton-turtleneck'] },
  { id: 'aw3', img: 'aw27-look-3', col: 'aw27', caption: AW,
    title: T('کت و شلوار جین', 'Denim on denim', 'Kot üstüne kot'),
    items: ['denim-jacket', 'dark-jeans', 'high-neck-knit'] },
  { id: 'aw4', img: 'aw27-look-4', col: 'aw27', caption: AW,
    title: T('بارانی گاباردین', 'Gabardine trench', 'Gabardin trençkot'),
    items: ['gabardine-trench', 'ribbed-knit', 'cotton-shirt', 'bandana', 'waterproof-sneakers'] },
  { id: 'aw5', img: 'aw27-look-5', col: 'aw27', caption: AW,
    title: T('وست و شلوار اویشو', 'Avishu vest and trousers', 'Avishu yelek ve pantolon'),
    items: ['avishu-vest', 'avishu-trousers', 'jacquard-knit', 'cotton-shirt', 'logo-cap', 'waterproof-sneakers'] },
  { id: 'aw6', img: 'aw27-look-6', col: 'aw27', caption: AW,
    title: T('بامبر و شلوار تو کرک', 'Bomber and fleece-lined trousers', 'Bomber ve içi polarlı pantolon'),
    items: ['bomber-jacket', 'fleece-trousers', 'wide-stripe-knit', 'cotton-shirt', 'karl-lagerfeld-bag', 'bandana', 'cotton-cap'] },
  { id: 'aw7', img: 'aw27-look-7', col: 'aw27', caption: AW,
    title: T('کت چرم و جین روشن', 'Leather jacket, light jeans', 'Deri ceket, açık kot'),
    items: ['waterproof-leather-jacket', 'light-jeans', 'two-tone-knit', 'cotton-shirt', 'cotton-cap'] },
];

/* ------------------------------------------------------------- lookups */
/* Prototype-free maps: an id such as «constructor» or «__proto__» typed into
   the address bar finds nothing instead of a built-in. */
export const byId = Object.create(null);
export const colById = Object.assign(Object.create(null), Object.fromEntries(COLLECTIONS.map((c) => [c.id, c])));
/** What a piece outside every collection borrows: a neutral dot, no frame. */
export const NO_COL = { id: '', name: '', accent: '#8E8E93', accent2: '#8E8E93', img: '' };
export const getProduct = (id) => byId[id] || null;
export const getCollection = (id) => colById[id] || null;
export const inCollection = (id) => PRODUCTS.filter((p) => p.col === id);
export const inCategory = (id) => (id === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === id));
export const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || null;

/** The colour a bag line or an order holds, in this page's language. A line
    saved before the switch holds a translated name rather than a hex; any of
    the three names finds it. */
export function colourLabel(p, stored) {
  const c = p?.colours.find((x) => x.hex === stored || x.all.includes(stored));
  return c ? c.name : stored;
}

/** جدید: the badged pieces first, then the rest, stable order. */
export const newIn = () => [...PRODUCTS].sort(
  (a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0)).slice(0, 8);
