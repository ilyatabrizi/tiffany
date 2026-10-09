/* کاتالوگ — collections, categories, sizes and the stories, in Persian,
   English and Turkish.

   The PIECES themselves are not in this file any more: they live in the
   shop's database, are edited in the back office (/admin) and arrive from
   /api/catalog.php when the shop opens (see live.js → setCatalogue below).
   The database's first catalogue was the one that used to sit here; it is
   kept in api/lib/seed.json.

   Persian is written the way people talk (خودمونی), not the way a form reads.
   The three collection names stay in Latin on purpose — they are names.

   A colour's identity is its hex and a size's is its code — the bag stores
   those, never a translated label, so a bag filled in Persian still reads
   right after switching to English. */
import { L } from './i18n.js';

const T = L;
/** A colour: hex is the key, the three names are labels. */
const C = (hex, fa, en, tr) => ({ hex, name: L(fa, en, tr), all: [fa, en, tr] });

export const COLLECTIONS = [
  {
    id: 'pastel',
    name: 'Pastel Play',
    season: T('بهار و تابستون', 'Spring / Summer', 'İlkbahar / Yaz'),
    accent: '#EF8FAB',
    accent2: '#78B4E0',
    img: 'col-pastel',
    lede: T('آبی‌های شیرین و صورتی‌های شیشه‌ای، اون‌قدر گشاد که باهاش بشه دوید.',
      'Sugar blues and blown-glass pinks, cut loose enough to run in.',
      'Şeker maviler ve cam pembeler; içinde koşabileceğin kadar bol kesim.'),
    body: T('کمپینی که فصل رو باهاش شروع کردیم: ارگانزا روی نخ، دانتل جای درز، و رنگ‌هایی '
      + 'که انگار از یه قنادی اومدن. همه چیزش رو دوختیم که با کتونی بپوشی.',
    'The campaign that started the season: organza over cotton, lace let '
      + 'in where a seam would normally be, and a palette borrowed from a '
      + 'confectioner. Everything here is made to be worn with trainers.',
    'Sezonu başlatan kampanya: pamuk üstüne organze, dikiş yerine dantel ve '
      + 'sanki bir şekerciden ödünç alınmış renkler. Buradaki her parça spor '
      + 'ayakkabıyla giyilsin diye dikildi.'),
  },
  {
    id: 'noir',
    name: 'Lace Noir',
    season: T('همیشگی', 'Core / All year', 'Her mevsim'),
    accent: '#E03127',
    accent2: '#8E8E93',
    img: 'col-noir',
    lede: T('مشکی، سفید، و دانتلی که با جفتشون کل‌کل می‌کنه.',
      'Black, white, and the lace that argues with both.',
      'Siyah, beyaz ve ikisiyle de atışan dantel.'),
    body: T('خط اصلی برند؛ قطعه‌هایی که هر سال دوباره می‌دوزیمشون، چون فروششون هیچ‌وقت '
      + 'تموم نمی‌شه. تریکوی تنگ، دانتل گشاد، و هیچ چیزِ وسطی که لازم باشه توضیحش بدیم.',
    'The house line — the pieces the studio remakes every year because '
      + 'they never stop selling. Jersey cut close, lace cut wide, and nothing '
      + 'in between that needs explaining.',
    'Markanın ana serisi: satışı hiç bitmediği için her yıl yeniden dikilen '
      + 'parçalar. Vücudu saran triko, bol kesim dantel ve arada açıklama '
      + 'gerektiren hiçbir şey.'),
  },
  {
    id: 'desert',
    name: 'Desert Hours',
    season: T('پاییز و زمستون', 'Autumn / Winter', 'Sonbahar / Kış'),
    accent: '#B2603A',
    accent2: '#C9A87C',
    img: 'col-desert',
    lede: T('خاک، نقره، و یه آستین بلند برای راه برگشت.',
      'Dust, silver and a long sleeve for the drive home.',
      'Toz, gümüş ve eve dönüş yolu için uzun bir kol.'),
    body: T('ابریشم مچاله، سکه‌های دست‌دوز و لبه‌ای که واقعاً پهنه. برای نور آخر روز و '
      + 'جاده‌های طولانی، و اون‌قدر سنگین که یه زمستون کامل فرمش رو نگه داره.',
    'Crushed silk, hand-set conchos and a brim wide enough to mean it. '
      + 'Made for late light and long roads, and heavy enough to hold a shape '
      + 'through a whole winter.',
    'Buruşuk ipek, elle çakılmış konçolar ve gerçekten geniş bir kenar. Günün '
      + 'son ışığı ve uzun yollar için; bütün bir kış formunu koruyacak kadar ağır.'),
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

/* استوری‌ها — the stories: full-bleed campaign frames, each one shoppable. */
export const LOOKS = [
  { id: 'l1', img: 'look-1', col: 'pastel',
    title: T('سه تا ما، دو تا ماشین', 'Three of us, two cars', 'Üçümüz, iki araba'),
    caption: T('کالکشن Pastel Play، فریم اول.', 'Pastel Play, opening frame.', 'Pastel Play, açılış karesi.'),
    items: ['organza-skirt', 'alphabet-tee', 'heart-belt'] },
  { id: 'l2', img: 'look-2', col: 'pastel',
    title: T('الفبا', 'Alphabet', 'Alfabe'),
    caption: T('گیپور روی تریکوی ضخیم.', 'Lace panel over heavy cotton.', 'Kalın pamuk üstüne dantel panel.'),
    items: ['alphabet-tee', 'pleat-trouser', 'polka-skirt'] },
  { id: 'l3', img: 'look-3', col: 'pastel',
    title: T('گره روی شونه', 'Tied at the shoulder', 'Omuzda düğüm'),
    caption: T('رویی چین‌خورده، به تنها مدل درستش.',
      'The crinkle overshirt, worn the only correct way.',
      'Kırışık gömlek ceket, tek doğru şekliyle.'),
    items: ['crinkle-shirt', 'rib-tee'] },
  { id: 'l4', img: 'look-4', col: 'noir',
    title: T('دانتل روی مشکی', 'Lace over black', 'Siyah üstüne dantel'),
    caption: T('کالکشن Lace Noir، لباس همیشگی برند.', 'Lace Noir, the house uniform.',
      'Lace Noir, markanın üniforması.'),
    items: ['lace-bandeau', 'linen-trouser', 'pearl-cap'] },
  { id: 'l5', img: 'look-5', col: 'noir',
    title: T('گیلاس‌ها', 'Cherries', 'Kirazlar'),
    caption: T('توری روی تی‌شرت سفید، نقره روی کمر.', 'Mesh over a white tee, silver at the waist.',
      'Beyaz tişört üstüne file, belde gümüş.'),
    items: ['mesh-cami', 'tinted-shades'] },
  { id: 'l6', img: 'look-6', col: 'desert',
    title: T('نور بلند', 'Long light', 'Uzun ışık'),
    caption: T('کالکشن Desert Hours، آخرای روز عکاسی شده.', 'Desert Hours, shot at the end of the day.',
      'Desert Hours, günün sonunda çekildi.'),
    items: ['prairie-blouse', 'concho-belt', 'brim-hat'] },
];

/* ------------------------------------------------------------- lookups */
export const byId = {};
export const colById = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]));
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
