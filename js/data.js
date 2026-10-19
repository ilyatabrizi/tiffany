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

/* The studio's first real collection: its pieces, prices and photos come
   from the «Tiffany products» Telegram group (2026-10-19). */
export const COLLECTIONS = [
  {
    id: 'aw27',
    name: 'Autumn / Winter 2027',
    season: T('پاییز و زمستون', 'Autumn / Winter', 'Sonbahar / Kış'),
    accent: '#7A4A2E',
    accent2: '#C9B49A',
    img: 'r-col',
    lede: T('کالکشن جدید پاییز و زمستون تیفانی.',
      'TIFFANY\'s new autumn and winter collection.',
      'TIFFANY\'nin yeni sonbahar ve kış koleksiyonu.'),
    body: T('کاپشن و بارونی چرم، پالتو و بارانی، کت پوست و تدی، بافت‌های پشمی، شومیز، سوشرت و شلوارهای جین و اویشو، دامن، و کلاه و باندانا و کانورس و کیف برای کامل کردن هر ست.',
      'Leather jackets and trench coats, overcoats and raincoats, fur and teddy coats, wool knits, shirts, sweatshirts, denim and Avishu trousers, a skirt, plus caps, bandanas, sneakers and bags to finish each look.',
      'Deri montlar ve trençkotlar, paltolar ve yağmurluklar, kürk ve teddy ceketler, yün trikolar, gömlekler, sweatshirtler, kot ve Avishu pantolonlar, etek; her kombini tamamlamak için şapka, bandana, spor ayakkabı ve çanta.'),
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

/* استوری‌ها — the stories: the studio's outfits for the new collection, one
   per captioned post in the «Tiffany products» group (2026-10-19), each one
   carrying the pieces worn in it (catalog/real/catalog.py builds the frames). */
const AW = T('کالکشن جدید پاییز و زمستون.', 'The new autumn and winter collection.', 'Yeni sonbahar ve kış koleksiyonu.');
export const LOOKS = [
  { id: 'r1', img: 'r-look-1', col: 'aw27', caption: AW,
    title: T('کپ و رویه موهر', 'Cap and mohair top', 'Şapka ve tiftik üst'),
    items: ['pastel-cotton-cap', 'mohair-top', 'mohair-trousers', 'white-leather-bag'] },
  { id: 'r2', img: 'r-look-2', col: 'aw27', caption: AW,
    title: T('بافت دکمه‌دار و جین سفید', 'Buttoned knit, white jeans', 'Düğmeli triko, beyaz kot'),
    items: ['buttoned-wool-knit', 'wool-scarf', 'white-jeans', 'pastel-cotton-cap'] },
  { id: 'r3', img: 'r-look-3', col: 'aw27', caption: AW,
    title: T('کت پوست مصنوعی و ست سوشرت', 'Faux fur coat, sweatshirt set', 'Suni kürk ceket, sweatshirt takımı'),
    items: ['faux-fur-coat', 'fleece-sweatshirt', 'fleece-trousers', 'silk-satin-bandana'] },
  { id: 'r4', img: 'r-look-4', col: 'aw27', caption: AW,
    title: T('کت تدی و ست سوشرت', 'Teddy coat, sweatshirt set', 'Teddy ceket, sweatshirt takımı'),
    items: ['wool-teddy-coat', 'fleece-sweatshirt', 'fleece-trousers', 'silk-satin-bandana'] },
  { id: 'r5', img: 'r-look-5', col: 'aw27', caption: AW,
    title: T('کاپشن چرم روغنی', 'Oiled leather jacket', 'Yağlı deri mont'),
    items: ['oiled-leather-jacket', 'wool-underknit', 'chocolate-jeans', 'cotton-cap', 'cotton-foulard'] },
  { id: 'r6', img: 'r-look-6', col: 'aw27', caption: AW,
    title: T('بارونی چرم و ست اویشو', 'Leather trench, Avishu set', 'Deri trençkot, Avishu takım'),
    items: ['oiled-leather-trench', 'avishu-top', 'avishu-trousers', 'white-collar-underknit', 'cotton-turtleneck', 'karl-lagerfeld-bag', 'pastel-cotton-cap'] },
  { id: 'r7', img: 'r-look-7', col: 'aw27', caption: AW,
    title: T('کت و شلوار جین', 'Denim on denim', 'Kot üstüne kot'),
    items: ['denim-jacket', 'dark-jeans', 'high-neck-wool-knit', 'patchwork-bandana'] },
  { id: 'r8', img: 'r-look-8', col: 'aw27', caption: AW,
    title: T('بارانی گاباردین', 'Gabardine trench', 'Gabardin trençkot'),
    items: ['gabardine-trench', 'ribbed-knit', 'cotton-shirt', 'red-bandana', 'waterproof-sneakers'] },
  { id: 'r9', img: 'r-look-9', col: 'aw27', caption: AW,
    title: T('کت پوست کوتاه و جین کرم', 'Short-pile fur jacket, cream jeans', 'Kısa tüylü kürk ceket, krem kot'),
    items: ['short-fur-jacket', 'pure-wool-underknit', 'plain-shirt', 'green-cream-jeans'] },
  { id: 'r10', img: 'r-look-10', col: 'aw27', caption: AW,
    title: T('ست سوشرت بادمجانی', 'Aubergine sweatshirt set', 'Patlıcan moru sweatshirt takımı'),
    items: ['collared-sweatshirt', 'sweat-trousers', 'striped-wool-knit', 'print-bandana'] },
  { id: 'r11', img: 'r-look-11', col: 'aw27', caption: AW,
    title: T('کاپشن چرم واترپروف', 'Waterproof leather jacket', 'Su geçirmez deri mont'),
    items: ['waterproof-leather-bomber', 'two-tone-wool-knit', 'fleece-trousers', 'brown-paisley-bandana'] },
  { id: 'r12', img: 'r-look-12', col: 'aw27', caption: AW,
    title: T('کت چرم و جین روشن', 'Leather jacket, light jeans', 'Deri ceket, açık kot'),
    items: ['waterproof-leather-jacket', 'light-ripped-jeans', 'cotton-shirt', 'two-tone-stripe-knit', 'baseball-cap'] },
  { id: 'r13', img: 'r-look-13', col: 'aw27', caption: AW,
    title: T('وست و شلوار اویشو', 'Avishu vest and trousers', 'Avishu yelek ve pantolon'),
    items: ['avishu-vest', 'avishu-trousers-grey', 'patterned-wool-knit', 'cotton-shirt', 'logo-cap', 'waterproof-sneakers'] },
  { id: 'r14', img: 'r-look-14', col: 'aw27', caption: AW,
    title: T('بامبر و شلوار دورس', 'Bomber, dors trousers', 'Bomber, dors pantolon'),
    items: ['bomber-jacket', 'dors-trousers', 'striped-pink-knit', 'cotton-shirt', 'black-white-bandana', 'baseball-cap', 'karl-lagerfeld-bag'] },
  { id: 'r15', img: 'r-look-15', col: 'aw27', caption: AW,
    title: T('کت پوست کوتاه کلاه‌دار', 'Hooded short-pile fur jacket', 'Kapüşonlu kısa tüylü kürk ceket'),
    items: ['hooded-fur-jacket', 'white-wool-knit', 'cotton-shirt-white', 'light-wide-jeans', 'red-bandana', 'white-leather-bag'] },
  { id: 'r16', img: 'r-look-16', col: 'aw27', caption: AW,
    title: T('پالتو اورسایز و دورس', 'Oversize coat, crew sweatshirt', 'Oversize palto, sweatshirt'),
    items: ['oversize-coat', 'dors-sweatshirt', 'cotton-trousers', 'patchwork-bandana'] },
  { id: 'r17', img: 'r-look-17', col: 'aw27', caption: AW,
    title: T('بارانی شمعی و ست اویشو', 'Waxed trench, Avishu set', 'Mumlu trençkot, Avishu takım'),
    items: ['waxed-trench', 'avishu-sweatshirt', 'avishu-trousers-olive', 'marc-jacobs-bag'] },
  { id: 'r18', img: 'r-look-18', col: 'aw27', caption: AW,
    title: T('پالتو اورسایز و بافت نازک', 'Oversize coat, fine knit', 'Oversize palto, ince triko'),
    items: ['oversize-coat', 'fine-wool-knit', 'cotton-shirt', 'waxed-trousers', 'floral-bandana', 'zara-bag'] },
  { id: 'r19', img: 'r-look-19', col: 'aw27', caption: AW,
    title: T('رویه پشم خالص و یقه‌اسکی', 'Pure wool cardigan, turtleneck', 'Saf yün hırka, balıkçı yaka'),
    items: ['pure-wool-cardigan', 'turtleneck', 'gabardine-trousers', 'satin-paisley-bandana', 'zara-bag'] },
  { id: 'r20', img: 'r-look-20', col: 'aw27', caption: AW,
    title: T('کت پشم خالص و دامن ترنچ', 'Pure wool jacket, trench skirt', 'Saf yün ceket, trençkot kumaşı etek'),
    items: ['pure-wool-jacket', 'trench-skirt', 'four-colour-bandana', 'zara-bag'] },
  { id: 'r21', img: 'r-look-21', col: 'aw27', caption: AW,
    title: T('وست شمعی و جین طوسی', 'Waxed vest, grey jeans', 'Mumlu yelek, gri kot'),
    items: ['waxed-vest', 'cream-wool-knit', 'grey-jeans', 'canvas-cap'] },
  { id: 'r22', img: 'r-look-22', col: 'aw27', caption: AW,
    title: T('بارانی کوتاه و جین سبز', 'Short trench, green jeans', 'Kısa trençkot, yeşil kot'),
    items: ['short-trench', 'green-cream-jeans', 'marc-jacobs-bag', 'canvas-cap'] },
];

/* The panel's own stories (api/catalog.php → stories), each one public for
   24 hours from when it went up, newest first, ahead of the looks.
   `ends` is on this phone's clock: the server's Date header corrects for a
   phone that is set wrong (see live.js). */
export const STORIES = [];
export function setStories(list, skew = 0) {
  STORIES.length = 0;
  for (const r of list || []) {
    if (!r || !r.id || !r.media || !['image', 'video'].includes(r.kind)) continue;
    STORIES.push({
      id: `s${r.id}`,
      sid: r.id,
      live: true,
      kind: r.kind,
      img: r.kind === 'image' ? r.media : r.poster,
      video: r.kind === 'video' ? r.media : '',
      title: pick(r.caption),
      caption: '',
      items: Array.isArray(r.items) ? r.items : [],
      at: r.created_at * 1000 - skew,
      ends: r.expires_at * 1000 - skew,
    });
  }
}
/** What the strip and the viewer show: live stories first, then the looks. */
export const storyList = () => [...STORIES.filter((s) => s.ends > Date.now()), ...LOOKS];

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
