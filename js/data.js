/* The catalogue.

   Every name, price, fabric and measurement below is PLACEHOLDER copy written
   to make the preview read like a real shop. Swap the lot for the studio's own
   line sheet before this goes anywhere near a customer. The photography is
   real — cropped from the campaign frames the studio sent. */

export const COLLECTIONS = [
  {
    id: 'pastel',
    name: 'Pastel Play',
    season: 'Spring / Summer',
    accent: '#EF8FAB',
    accent2: '#78B4E0',
    img: 'col-pastel',
    lede: 'Sugar blues and blown-glass pinks, cut loose enough to run in.',
    body: 'The campaign that started the season: organza over cotton, lace let '
      + 'in where a seam would normally be, and a palette borrowed from a '
      + 'confectioner. Everything here is made to be worn with trainers.',
  },
  {
    id: 'noir',
    name: 'Lace Noir',
    season: 'Core / All year',
    accent: '#E03127',
    accent2: '#8E8E93',
    img: 'col-noir',
    lede: 'Black, white, and the lace that argues with both.',
    body: 'The house line — the pieces the studio remakes every year because '
      + 'they never stop selling. Jersey cut close, lace cut wide, and nothing '
      + 'in between that needs explaining.',
  },
  {
    id: 'desert',
    name: 'Desert Hours',
    season: 'Autumn / Winter',
    accent: '#B2603A',
    accent2: '#C9A87C',
    img: 'col-desert',
    lede: 'Dust, silver and a long sleeve for the drive home.',
    body: 'Crushed silk, hand-set conchos and a brim wide enough to mean it. '
      + 'Made for late light and long roads, and heavy enough to hold a shape '
      + 'through a whole winter.',
  },
];

export const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'tops', name: 'Tops' },
  { id: 'skirts', name: 'Skirts' },
  { id: 'trousers', name: 'Trousers' },
  { id: 'outerwear', name: 'Outerwear' },
  { id: 'accessories', name: 'Accessories' },
];

/* Sizes the studio actually cuts, and the body they are cut for (cm). */
export const SIZES = [
  { id: 'XS', bust: [78, 83], waist: [60, 65], hip: [86, 91] },
  { id: 'S', bust: [83, 88], waist: [65, 70], hip: [91, 96] },
  { id: 'M', bust: [88, 94], waist: [70, 76], hip: [96, 102] },
  { id: 'L', bust: [94, 100], waist: [76, 82], hip: [102, 108] },
  { id: 'XL', bust: [100, 107], waist: [82, 89], hip: [108, 115] },
];
const RTW = ['XS', 'S', 'M', 'L', 'XL'];
const ONE = ['One size'];

export const PRODUCTS = [
  /* ------------------------------------------------------ PASTEL PLAY */
  {
    id: 'alphabet-tee', name: 'Alphabet Lace Tee', col: 'pastel', cat: 'tops',
    price: 1680000, img: 'p-alphabet-tee', sizes: RTW, fit: 'relaxed', badge: 'New',
    colours: [{ name: 'Sky', hex: '#A9C9E8' }, { name: 'Ivory', hex: '#F2EFE9' }],
    note: 'Heavy cotton jersey with a broderie panel appliquéd by hand.',
    fabric: '100% cotton, 220gsm. Lace trim 60% cotton / 40% nylon.',
    care: 'Cold wash, inside out. Do not tumble. Warm iron, never on the lace.',
    detail: 'Drop shoulder, boxy body, ribbed neck. The panel is stitched on '
      + 'after the tee is made, so no two sit in exactly the same place.',
  },
  {
    id: 'organza-skirt', name: 'Organza Cloud Skirt', col: 'pastel', cat: 'skirts',
    price: 2950000, img: 'p-organza-skirt', sizes: RTW, fit: 'true', badge: 'Campaign',
    colours: [{ name: 'Blush', hex: '#EF8FAB' }, { name: 'Chalk', hex: '#EDEAE4' }],
    note: 'Two layers of crushed organza over a cotton slip.',
    fabric: 'Shell 100% polyester organza. Lining 100% cotton.',
    care: 'Hand wash cold, hang to dry. Steam only — a hot iron will flatten it.',
    detail: 'Elasticated back waist, flat front. Falls mid-calf on 168cm and '
      + 'moves like it is a size larger than it is.',
  },
  {
    id: 'heart-belt', name: 'Heart Chain Belt', col: 'pastel', cat: 'accessories',
    price: 1150000, img: 'p-heart-belt', sizes: ONE, fit: 'true',
    colours: [{ name: 'Silver', hex: '#C6C8CC' }],
    note: 'Cast hearts on a beaded chain, hook clasp.',
    fabric: 'Zinc alloy, brushed and lacquered.',
    care: 'Keep dry. Wipe with a soft cloth.',
    detail: 'Adjustable 68–96cm. Heavy enough to hold a gathered waist in place.',
  },
  {
    id: 'crinkle-shirt', name: 'Crinkle Overshirt', col: 'pastel', cat: 'outerwear',
    price: 2380000, img: 'p-crinkle-shirt', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'Bubblegum', hex: '#F49CB6' }, { name: 'Sky', hex: '#A9C9E8' }],
    note: 'Featherweight crinkle nylon — the one you tie at the shoulders.',
    fabric: '100% nylon, crinkle finish.',
    care: 'Cold machine wash. Do not iron; the crinkle is the point.',
    detail: 'Cut long in the back, cropped in front. Packs to the size of a fist.',
  },
  {
    id: 'pleat-trouser', name: 'Wide Pleat Trouser', col: 'pastel', cat: 'trousers',
    price: 2180000, img: 'p-pleat-trouser', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'Sky', hex: '#A9C9E8' }, { name: 'Ink', hex: '#22232A' }],
    note: 'Elastic waist, deep pockets, a leg that keeps going.',
    fabric: '55% viscose / 45% linen.',
    care: 'Cold wash on gentle. Line dry. Iron damp.',
    detail: 'Sits at the natural waist. 74cm inseam on M, hemmable without '
      + 'losing the drape.',
  },
  {
    id: 'polka-skirt', name: 'Polka Midi Skirt', col: 'pastel', cat: 'skirts',
    price: 2290000, img: 'p-polka-skirt', sizes: RTW, fit: 'true',
    colours: [{ name: 'Chalk', hex: '#EDEAE4' }],
    note: 'Printed cotton voile, bias panels, a hem that swings.',
    fabric: '100% cotton voile, screen printed.',
    care: 'Cold wash. Line dry in shade. Warm iron.',
    detail: 'Six panels cut on the bias so it hangs without a single dart.',
  },
  {
    id: 'rib-tee', name: 'Essential Rib Tee', col: 'pastel', cat: 'tops',
    price: 890000, img: 'p-rib-tee', sizes: RTW, fit: 'small', badge: 'Restocked',
    colours: [{ name: 'White', hex: '#FFFFFF' }, { name: 'Black', hex: '#111114' },
      { name: 'Blush', hex: '#EF8FAB' }],
    note: 'The base layer under everything else in this shop.',
    fabric: '95% cotton / 5% elastane, 2x2 rib.',
    care: 'Machine wash cold. Reshape while damp.',
    detail: 'Cut close and short. Take a size up if you want it to skim.',
  },

  /* -------------------------------------------------------- LACE NOIR */
  {
    id: 'lace-bandeau', name: 'Lace Bandeau Tee', col: 'noir', cat: 'tops',
    price: 1890000, img: 'p-lace-bandeau', sizes: RTW, fit: 'true', badge: 'Best seller',
    colours: [{ name: 'Black / Ivory', hex: '#141417' }],
    note: 'A cotton tee with a lace bandeau sewn straight onto it.',
    fabric: 'Body 100% cotton. Bandeau 65% nylon / 35% cotton lace.',
    care: 'Hand wash cold, dry flat. Do not wring the lace.',
    detail: 'Two garments, one seam. Straps are decorative — the whole thing '
      + 'comes on and off over the head.',
  },
  {
    id: 'mesh-cami', name: 'Mesh Slip Cami', col: 'noir', cat: 'tops',
    price: 1450000, img: 'p-mesh-cami', sizes: RTW, fit: 'true',
    colours: [{ name: 'Smoke', hex: '#7C7C82' }, { name: 'Black', hex: '#111114' }],
    note: 'Sheer mesh with a ruffled edge, worn over a tee.',
    fabric: '100% polyester mesh, picot trim.',
    care: 'Hand wash cold. Hang to dry. Do not iron.',
    detail: 'Adjustable straps. Layer it — it is not built to be worn alone.',
  },
  {
    id: 'linen-trouser', name: 'Linen Wide Trouser', col: 'noir', cat: 'trousers',
    price: 2480000, img: 'p-linen-trouser', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'Chalk', hex: '#EDEAE4' }, { name: 'Black', hex: '#111114' }],
    note: 'Crushed linen, pleated front, belt loops that take a real belt.',
    fabric: '100% washed linen.',
    care: 'Machine wash cold. Tumble low to soften. Creases are correct.',
    detail: 'High waist, wide straight leg, side pockets deep enough for a phone.',
  },
  {
    id: 'pearl-cap', name: 'Pearl Crochet Cap', col: 'noir', cat: 'accessories',
    price: 980000, img: 'p-pearl-cap', sizes: ONE, fit: 'true',
    colours: [{ name: 'Ivory', hex: '#F2EFE9' }],
    note: 'Open-stitch crochet, glass pearls set along the brim.',
    fabric: '100% cotton yarn, glass pearl trim.',
    care: 'Hand wash cold, dry flat away from sun.',
    detail: 'Stretches to 58cm. Sits back on the head, not down over the ears.',
  },
  {
    id: 'tinted-shades', name: 'Tinted Aviator', col: 'noir', cat: 'accessories',
    price: 1650000, img: 'p-tinted-shades', sizes: ONE, fit: 'true', badge: 'New',
    colours: [{ name: 'Amber / Violet', hex: '#B4762F' },
      { name: 'Black / Grey', hex: '#111114' }],
    note: 'Acetate frame, graduated violet lens.',
    fabric: 'Italian acetate, CR-39 lens, UV400.',
    care: 'Keep in the pouch. Clean with the cloth, never a shirt.',
    detail: 'Wide bridge, flat top bar. Suits a round face better than a long one.',
  },

  /* ----------------------------------------------------- DESERT HOURS */
  {
    id: 'prairie-blouse', name: 'Prairie Silk Blouse', col: 'desert', cat: 'tops',
    price: 3150000, img: 'p-prairie-blouse', sizes: RTW, fit: 'true', badge: 'Last pieces',
    colours: [{ name: 'Dust', hex: '#8E8189' }, { name: 'Umber', hex: '#5C4038' }],
    note: 'Crushed silk with a deep V and a peplum that flares off the waist.',
    fabric: '100% silk, sand-washed. Metallic braid trim.',
    care: 'Dry clean. Cool iron through a cloth.',
    detail: 'Blouson sleeve, elasticated cuff, self-tie inside. Wear the V with '
      + 'a cami or without.',
  },
  {
    id: 'concho-belt', name: 'Concho Leather Belt', col: 'desert', cat: 'accessories',
    price: 2450000, img: 'p-concho-belt', sizes: ONE, fit: 'true',
    colours: [{ name: 'Saddle', hex: '#7A4B2E' }],
    note: 'Hand-set silver conchos on vegetable-tanned leather.',
    fabric: 'Full-grain leather, nickel silver conchos.',
    care: 'Condition twice a year. Keep out of standing water.',
    detail: 'Three fit positions, 76–96cm. The drop panel hangs to mid-thigh.',
  },
  {
    id: 'brim-hat', name: 'Suede Brim Hat', col: 'desert', cat: 'accessories',
    price: 2280000, img: 'p-brim-hat', sizes: ONE, fit: 'true',
    colours: [{ name: 'Cocoa', hex: '#5A3A2A' }, { name: 'Sand', hex: '#B99168' }],
    note: 'Stitched suede, 9cm brim, whipstitched crown.',
    fabric: 'Goat suede, cotton sweatband.',
    care: 'Brush with the grain. Never wet.',
    detail: 'Internal band adjusts 56–59cm. Holds its shape packed flat.',
  },
  {
    id: 'print-skirt', name: 'Desert Print Skirt', col: 'desert', cat: 'skirts',
    price: 2690000, img: 'p-print-skirt', sizes: RTW, fit: 'true',
    colours: [{ name: 'Stone print', hex: '#B7AFA6' }],
    note: 'Tiered chiffon over a short slip, printed from a photograph.',
    fabric: '100% polyester chiffon. Lining 100% viscose.',
    care: 'Hand wash cold. Line dry. Cool iron.',
    detail: 'Three tiers, elastic waist. Lining sits 20cm above the hem.',
  },
  {
    id: 'sheer-blouse', name: 'Sheer Stripe Blouse', col: 'desert', cat: 'tops',
    price: 2890000, img: 'p-sheer-blouse', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'Umber', hex: '#4A3730' }],
    note: 'Woven stripe in a sheer ground, gathered at the waist.',
    fabric: '70% viscose / 30% silk.',
    care: 'Hand wash cold, hang to dry. Cool iron.',
    detail: 'Wrap front with an inner tie. Sheer — the studio sells it with a '
      + 'matching cami.',
  },
];

/* The looks: full-bleed campaign frames, each one shoppable. */
export const LOOKS = [
  { id: 'l1', img: 'look-1', col: 'pastel', title: 'Three of us, two cars',
    caption: 'Pastel Play, opening frame.', items: ['organza-skirt', 'alphabet-tee', 'heart-belt'] },
  { id: 'l2', img: 'look-2', col: 'pastel', title: 'Alphabet',
    caption: 'Lace panel over heavy cotton.', items: ['alphabet-tee', 'pleat-trouser', 'polka-skirt'] },
  { id: 'l3', img: 'look-3', col: 'pastel', title: 'Tied at the shoulder',
    caption: 'The crinkle overshirt, worn the only correct way.', items: ['crinkle-shirt', 'rib-tee'] },
  { id: 'l4', img: 'look-4', col: 'noir', title: 'Lace over black',
    caption: 'Lace Noir, the house uniform.', items: ['lace-bandeau', 'linen-trouser', 'pearl-cap'] },
  { id: 'l5', img: 'look-5', col: 'noir', title: 'Cherries',
    caption: 'Mesh over a white tee, silver at the waist.', items: ['mesh-cami', 'tinted-shades'] },
  { id: 'l6', img: 'look-6', col: 'desert', title: 'Long light',
    caption: 'Desert Hours, shot at the end of the day.', items: ['prairie-blouse', 'concho-belt', 'brim-hat'] },
];

/* ------------------------------------------------------------- lookups */
export const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
export const colById = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]));
export const getProduct = (id) => byId[id] || null;
export const getCollection = (id) => colById[id] || null;
export const inCollection = (id) => PRODUCTS.filter((p) => p.col === id);
export const inCategory = (id) => (id === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === id));

/** New In: the badged pieces first, then the rest, stable order. */
export const newIn = () => [...PRODUCTS].sort(
  (a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0)).slice(0, 8);
