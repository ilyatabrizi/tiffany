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
import { LOOK_DEFS } from './looks-data.js';

const T = L;
/** A colour: hex is the key, the three names are labels. */
const C = (hex, fa, en, tr) => ({ hex, name: L(fa, en, tr), all: [fa, en, tr] });

/* The studio's Autumn / Winter 2027 collections: one per photo set the studio
   posted in the «Tiffany products» Telegram group (2026-10-19), named for
   what is in it. A piece belongs to the set it first appears in; a
   collection's page also shows every piece worn in its stories. */
const SEASON = T('پاییز و زمستون ۲۰۲۷', 'Autumn / Winter 2027', 'Sonbahar / Kış 2027');
export const COLLECTIONS = [
  {
    id: 'aw27-pink-mohair',
    name: 'Pink Mohair',
    season: SEASON,
    accent: '#C2577E',
    accent2: '#F3D3DE',
    img: 'r-col-pink-mohair',
    lede: T('رویه موهر صورتی، بافت پشم دکمه‌دار و کیف چرمی سفید.',
      'A pink mohair top, a buttoned wool knit and a white leather bag.',
      'Pembe tiftik üst, düğmeli yün triko ve beyaz deri çanta.'),
    body: T('رویه و شلوار موهر پنبه، بافت پشم دکمه‌دار با شال گردن هم‌رنگش، شلوار جین سفید، کپ کتان سفید و صورتی پاستیلی و کیف چرمی سفید.',
      'Mohair-cotton top and trousers, a buttoned wool knit with its matching scarf, white jeans, a white or pastel-pink cotton cap and a white leather bag.',
      'Tiftik-pamuk üst ve pantolon, eşleşen atkısıyla düğmeli yün triko, beyaz kot, beyaz ya da pastel pembe pamuklu şapka ve beyaz deri çanta.'),
  },
  {
    id: 'aw27-pink-fleece',
    name: 'Pink Fleece',
    season: SEASON,
    accent: '#D9467A',
    accent2: '#F6CFDB',
    img: 'r-col-pink-fleece',
    lede: T('ست سوشرت و شلوار سه‌نخ توکرک، با کت پوست مصنوعی یا کت تدی.',
      'A fleece-lined sweatshirt set, worn with a faux fur or a teddy coat.',
      'Suni kürk ya da teddy ceketle giyilen içi polarlı sweatshirt takımı.'),
    body: T('سوشرت و شلوار سه‌نخ توکرک توی آبی، صورتی و قهوه‌ای، کت پوست مصنوعی، کت تدی پشمی و باندانای ساتن ابریشمی.',
      'A fleece-lined sweatshirt and trousers in blue, pink and brown, a faux fur coat, a wool teddy coat and a silk satin bandana.',
      'Mavi, pembe ve kahverengi içi polarlı sweatshirt ve pantolon, suni kürk ceket, yün teddy ceket ve ipek saten bandana.'),
  },
  {
    id: 'aw27-black-leather',
    name: 'Black Leather',
    season: SEASON,
    accent: '#1C1C1E',
    accent2: '#E3D5BC',
    img: 'r-col-black-leather',
    lede: T('کاپشن و بارونی چرم روغنی مشکی، با ست اویشو کرم.',
      'A black oiled leather jacket and trench coat, with a cream Avishu set.',
      'Siyah yağlı deri mont ve trençkot, krem Avishu takımla.'),
    body: T('کاپشن و بارونی چرم روغنی، بافت زیره پشم راه‌راه، بافت زیره یقه‌سفید، یقه‌اسکی نخی، رویه و شلوار اویشو، شلوار جین شکلاتی، کپ کتان، فولار نخی و کیف KARL LAGERFELD.',
      'An oiled leather jacket and trench coat, a striped wool underknit, a white-collar underknit, a cotton turtleneck, an Avishu top and trousers, chocolate jeans, a cotton cap, a cotton foulard and a KARL LAGERFELD bag.',
      'Yağlı deri mont ve trençkot, çizgili yün içlik triko, beyaz yakalı içlik triko, pamuklu balıkçı yaka, Avishu üst ve pantolon, çikolata rengi kot, pamuklu şapka, pamuklu fular ve KARL LAGERFELD çanta.'),
  },
  {
    id: 'aw27-denim-red',
    name: 'Denim & Red',
    season: SEASON,
    accent: '#1F2A44',
    accent2: '#C62828',
    img: 'r-col-denim-red',
    lede: T('کت و شلوار جین، بارانی گاباردین سرمه‌ای و بافت‌های قرمز.',
      'Denim on denim, a navy gabardine trench coat and red knits.',
      'Kot üstüne kot, lacivert gabardin trençkot ve kırmızı trikolar.'),
    body: T('کت جین، شلوار جین تیره، بافت پشم یقه‌بلند، بارانی گاباردین پنبه، بافت کبریتی، شومیز نخی، باندانای نخی و کانورس.',
      'A denim jacket, dark jeans, a high-neck wool knit, a cotton gabardine trench coat, a ribbed knit, a cotton shirt, cotton bandanas and high-top sneakers.',
      'Kot ceket, koyu kot pantolon, dik yaka yün triko, pamuklu gabardin trençkot, fitilli triko, pamuklu gömlek, pamuklu bandanalar ve bilekli spor ayakkabı.'),
  },
  {
    id: 'aw27-aubergine',
    name: 'Aubergine',
    season: SEASON,
    accent: '#4A2545',
    accent2: '#EFE8D8',
    img: 'r-col-aubergine',
    lede: T('کت پوست کوتاه شیری، بافت‌های بادمجانی و ست سوشرت.',
      'A milky short-pile fur jacket, aubergine knits and a sweatshirt set.',
      'Süt beyazı kısa tüylü kürk ceket, patlıcan moru trikolar ve sweatshirt takımı.'),
    body: T('کت پوست کوتاه، بافت زیره پشم خالص، شومیز ساده، شلوار جین سبز و کرم، بافت پشم راه‌راه، سوشرت و شلوار ستش، و باندانای گل‌دار.',
      'A short-pile fur jacket, a pure wool underknit, a plain shirt, green and cream jeans, a striped wool knit, a sweatshirt with its trousers and a floral bandana.',
      'Kısa tüylü kürk ceket, saf yün içlik triko, düz gömlek, yeşil ve krem kot, çizgili yün triko, takım pantolonuyla sweatshirt ve çiçekli bandana.'),
  },
  {
    id: 'aw27-brown-leather',
    name: 'Brown Leather',
    season: SEASON,
    accent: '#4A3326',
    accent2: '#BFD3E6',
    img: 'r-col-brown-leather',
    lede: T('کاپشن و کت چرم واترپروف قهوه‌ای با جین روشن.',
      'Brown waterproof leather jackets with light jeans.',
      'Açık kotla kahverengi su geçirmez deri ceketler.'),
    body: T('کاپشن چرم واترپروف، کت چرم واترپروف، بافت‌های پشمی دورنگ، شومیز نخی، شلوار جین روشن، شلوار سه‌نخ توکرک، کلاه کپ و باندانا.',
      'A waterproof leather jacket and a waterproof leather coat, two-tone wool knits, a cotton shirt, light jeans, fleece-lined trousers, a baseball cap and a bandana.',
      'Su geçirmez deri mont ve deri ceket, iki renkli yün trikolar, pamuklu gömlek, açık kot, içi polarlı pantolon, beyzbol şapkası ve bandana.'),
  },
  {
    id: 'aw27-grey-pink',
    name: 'Grey & Pink',
    season: SEASON,
    accent: '#4A4A4D',
    accent2: '#F2A7C3',
    img: 'r-col-grey-pink',
    lede: T('وست و شلوار اویشو خاکستری تیره، بامبر سفید و بافت‌های صورتی.',
      'A dark grey Avishu vest and trousers, a white bomber and pink knits.',
      'Koyu gri Avishu yelek ve pantolon, beyaz bomber ve pembe trikolar.'),
    body: T('وست و شلوار اویشو، بافت پشم خالص طرح‌دار، بامبر، شلوار دورس، بافت پشمی راه‌راه صورتی، شومیز نخی، کلاه کپ لوگودار، باندانا و کانورس.',
      'An Avishu vest and trousers, a patterned pure wool knit, a bomber, dors trousers, a pink striped wool knit, a cotton shirt, a logo cap, a bandana and high-top sneakers.',
      'Avishu yelek ve pantolon, desenli saf yün triko, bomber, dors pantolon, pembe çizgili yün triko, pamuklu gömlek, logolu şapka, bandana ve bilekli spor ayakkabı.'),
  },
  {
    id: 'aw27-grey-red',
    name: 'Grey & Red',
    season: SEASON,
    accent: '#5F6368',
    accent2: '#D3202F',
    img: 'r-col-grey-red',
    lede: T('کت پوست کوتاه کلاه‌دار، پالتو اورسایز طوسی و دورس قرمز.',
      'A hooded short-pile fur jacket, a grey oversize coat and a red crew sweatshirt.',
      'Kapüşonlu kısa tüylü kürk ceket, gri oversize palto ve kırmızı sweatshirt.'),
    body: T('کت پوست کوتاه کلاه‌دار، پالتو اورسایز، دورس، بافت پشمی سفید، شومیز نخ پنبه، شلوار جین گشاد، شلوار نخ پنبه، باندانا و کیف چرمی سفید.',
      'A hooded short-pile fur jacket, an oversize coat, a crew sweatshirt, a white wool knit, a cotton shirt, wide jeans, cotton trousers, bandanas and a white leather bag.',
      'Kapüşonlu kısa tüylü kürk ceket, oversize palto, sweatshirt, beyaz yün triko, pamuklu gömlek, bol kot, pamuklu pantolon, bandanalar ve beyaz deri çanta.'),
  },
  {
    id: 'aw27-olive-brown',
    name: 'Olive & Brown',
    season: SEASON,
    accent: '#5C6343',
    accent2: '#7A4E33',
    img: 'r-col-olive-brown',
    lede: T('بارانی شمعی، پالتو اورسایز قهوه‌ای و ست اویشو سبز زیتونی.',
      'A waxed trench coat, a brown oversize coat and an olive Avishu set.',
      'Mumlu trençkot, kahverengi oversize palto ve zeytin yeşili Avishu takım.'),
    body: T('بارانی شمعی، سوشرت و شلوار اویشو، پالتو اورسایز، بافت پشمی نازک، شلوار شمعی ضدآب، شومیز نخی، باندانا، کیف MARC JACOBS و کیف زارا.',
      'A waxed trench coat, an Avishu sweatshirt and trousers, an oversize coat, a fine wool knit, waterproof waxed trousers, a cotton shirt, a bandana, a MARC JACOBS bag and a Zara bag.',
      'Mumlu trençkot, Avishu sweatshirt ve pantolon, oversize palto, ince yün triko, su geçirmez mumlu pantolon, pamuklu gömlek, bandana, MARC JACOBS çanta ve Zara çanta.'),
  },
  {
    id: 'aw27-chocolate-wool',
    name: 'Chocolate Wool',
    season: SEASON,
    accent: '#4E3226',
    accent2: '#E3D5BC',
    img: 'r-col-chocolate-wool',
    lede: T('رویه و کت پشم خالص، دامن ترنچ و یقه‌اسکی سفید.',
      'A pure wool cardigan and jacket, a trench skirt and a white turtleneck.',
      'Saf yün hırka ve ceket, trençkot kumaşı etek ve beyaz balıkçı yaka.'),
    body: T('رویه پشم خالص، کت پشم خالص، دامن ترنچ، یقه‌اسکی، شلوار گاباردین، باندانا و کیف زارا.',
      'A pure wool cardigan, a pure wool jacket, a trench skirt, a turtleneck, gabardine trousers, bandanas and a Zara bag.',
      'Saf yün hırka, saf yün ceket, trençkot kumaşı etek, balıkçı yaka, gabardin pantolon, bandanalar ve Zara çanta.'),
  },
  {
    id: 'aw27-olive-khaki',
    name: 'Olive & Khaki',
    season: SEASON,
    accent: '#5E6B3E',
    accent2: '#8B7D5B',
    img: 'r-col-olive-khaki',
    lede: T('وست شمعی، بارانی کوتاه یقه‌دار و جین طوسی و سبز.',
      'A waxed vest, a short collared trench and grey and green jeans.',
      'Mumlu yelek, kısa yakalı trençkot, gri ve yeşil kot.'),
    body: T('وست شمعی، بارانی کوتاه یقه‌دار، بافت پشمی کرم، شلوار جین طوسی، شلوار جین سبز و کرم، کلاه برزنتی و کیف MARC JACOBS.',
      'A waxed vest, a short collared trench, a cream wool knit, grey jeans, green and cream jeans, a canvas cap and a MARC JACOBS bag.',
      'Mumlu yelek, kısa yakalı trençkot, krem yün triko, gri kot, yeşil ve krem kot, kanvas şapka ve MARC JACOBS çanta.'),
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
   carrying the pieces worn in it (catalog/real/catalog.py builds the frames).
   The panel can change a story's title, text, pieces and link, or hide it;
   those changes arrive with the catalogue (api/catalog.php → looks) and are
   laid over these defaults by setLookEdits. LOOK_DEFS stays as written, for
   the panel to start from. */
const AW = T('کالکشن جدید پاییز و زمستون.', 'The new autumn and winter collection.', 'Yeni sonbahar ve kış koleksiyonu.');
export { LOOK_DEFS };
/** A story's button, as the shop shows it: a page of the shop or an https address. */
const linkOf = (k) => (k && typeof k.url === 'string' && /^(#\/|https?:\/\/)/i.test(k.url)
  ? { url: k.url, label: pick(k.label) } : null);
export const LOOKS = [];
export function setLookEdits(edits) {
  const e = edits && typeof edits === 'object' ? edits : {};
  LOOKS.length = 0;
  for (const d of LOOK_DEFS) {
    const x = e[d.id] || {};
    if (x.hidden) continue;
    LOOKS.push({
      id: d.id, img: d.img, col: d.col,
      title: x.title ? pick(x.title) : T(...d.t),
      caption: x.caption ? pick(x.caption) : AW,
      items: Array.isArray(x.items) ? x.items : d.items,
      link: linkOf(x.link),
    });
  }
}
setLookEdits();

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
      link: linkOf(r.link),
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
