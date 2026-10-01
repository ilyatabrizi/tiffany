/* کاتالوگ — the catalogue.

   Every name, price, fabric and measurement below is PLACEHOLDER copy written
   to make the preview read like a real shop. Swap the lot for the studio's own
   line sheet before this goes anywhere near a customer. The photography is
   real — cropped from the campaign frames the studio sent.

   The three collection names stay in Latin on purpose. They are names, the way
   the wordmark is a name, and every Iranian fashion house keeps them that way. */

export const COLLECTIONS = [
  {
    id: 'pastel',
    name: 'Pastel Play',
    season: 'بهار / تابستان',
    accent: '#EF8FAB',
    accent2: '#78B4E0',
    img: 'col-pastel',
    lede: 'آبی‌های شیرین و صورتی‌های شیشه‌ای، به اندازه‌ای گشاد که بشه باهاش دوید.',
    body: 'کمپینی که فصل را شروع کرد: ارگانزا روی نخ، دانتل جای درز، و رنگ‌هایی '
      + 'که انگار از یک قنادی آمده‌اند. همه‌چیز اینجا برای پوشیدن با کتانی '
      + 'دوخته شده.',
  },
  {
    id: 'noir',
    name: 'Lace Noir',
    season: 'همیشگی',
    accent: '#E03127',
    accent2: '#8E8E93',
    img: 'col-noir',
    lede: 'مشکی، سفید، و دانتلی که با هر دوشان بحث می‌کند.',
    body: 'خط اصلی برند — قطعه‌هایی که هر سال دوباره دوخته می‌شوند، چون هیچ‌وقت '
      + 'فروششان تمام نمی‌شود. تریکوی تنگ، دانتل گشاد، و هیچ‌چیز میانه‌ای که '
      + 'لازم باشد توضیح داده شود.',
  },
  {
    id: 'desert',
    name: 'Desert Hours',
    season: 'پاییز / زمستان',
    accent: '#B2603A',
    accent2: '#C9A87C',
    img: 'col-desert',
    lede: 'خاک، نقره، و یک آستین بلند برای راه برگشت.',
    body: 'ابریشم مچاله، سکه‌های دست‌دوز و لبه‌ای که واقعاً پهن است. برای نور '
      + 'آخر روز و جاده‌های طولانی، و آن‌قدر سنگین که یک زمستان کامل فرمش را '
      + 'نگه دارد.',
  },
];

export const CATEGORIES = [
  { id: 'all', name: 'همه' },
  { id: 'tops', name: 'بالاتنه' },
  { id: 'skirts', name: 'دامن' },
  { id: 'trousers', name: 'شلوار' },
  { id: 'outerwear', name: 'رویی' },
  { id: 'accessories', name: 'اکسسوری' },
];

/* سایزهایی که واقعاً دوخته می‌شوند، و اندازهٔ بدنی که برایش دوخته شده (سانتی‌متر) */
export const SIZES = [
  { id: 'XS', bust: [78, 83], waist: [60, 65], hip: [86, 91] },
  { id: 'S', bust: [83, 88], waist: [65, 70], hip: [91, 96] },
  { id: 'M', bust: [88, 94], waist: [70, 76], hip: [96, 102] },
  { id: 'L', bust: [94, 100], waist: [76, 82], hip: [102, 108] },
  { id: 'XL', bust: [100, 107], waist: [82, 89], hip: [108, 115] },
];
const RTW = ['XS', 'S', 'M', 'L', 'XL'];
const ONE = ['فری‌سایز'];

export const PRODUCTS = [
  /* ------------------------------------------------------ PASTEL PLAY */
  {
    id: 'alphabet-tee', name: 'تی‌شرت الفبا', col: 'pastel', cat: 'tops',
    price: 1680000, img: 'p-alphabet-tee', sizes: RTW, fit: 'relaxed', badge: 'جدید',
    colours: [{ name: 'آبی آسمانی', hex: '#A9C9E8' }, { name: 'شیری', hex: '#F2EFE9' }],
    note: 'تریکوی نخی ضخیم با یک تکهٔ گیپور که دستی رویش دوخته شده.',
    fabric: '۱۰۰٪ نخ، ۲۲۰ گرم. حاشیهٔ دانتل ۶۰٪ نخ و ۴۰٪ نایلون.',
    care: 'شست‌وشو با آب سرد و پشت‌ورو. خشک‌کن نه. اتوی ملایم، هیچ‌وقت روی دانتل.',
    detail: 'سرشانهٔ افتاده، تن جعبه‌ای، یقهٔ کبریتی. تکهٔ رویی بعد از دوخت تی‌شرت '
      + 'اضافه می‌شود، برای همین جای دو تا از آن‌ها دقیقاً یکی نیست.',
  },
  {
    id: 'organza-skirt', name: 'دامن ابری ارگانزا', col: 'pastel', cat: 'skirts',
    price: 2950000, img: 'p-organza-skirt', sizes: RTW, fit: 'true', badge: 'کمپین',
    colours: [{ name: 'صورتی', hex: '#EF8FAB' }, { name: 'گچی', hex: '#EDEAE4' }],
    note: 'دو لایه ارگانزای مچاله روی یک زیرپوش نخی.',
    fabric: 'رویه ۱۰۰٪ ارگانزای پلی‌استر. آستر ۱۰۰٪ نخ.',
    care: 'شست‌وشوی دستی با آب سرد، آویزان خشک شود. فقط بخار — اتوی داغ خوابش می‌کند.',
    detail: 'کمر پشت کش‌دار و جلو صاف. روی قد ۱۶۸ تا وسط ساق می‌افتد و طوری '
      + 'حرکت می‌کند که انگار یک سایز بزرگ‌تر است.',
  },
  {
    id: 'heart-belt', name: 'کمربند زنجیری قلب', col: 'pastel', cat: 'accessories',
    price: 1150000, img: 'p-heart-belt', sizes: ONE, fit: 'true',
    colours: [{ name: 'نقره‌ای', hex: '#C6C8CC' }],
    note: 'قلب‌های ریخته‌گری روی زنجیر مهره‌ای، با قلاب.',
    fabric: 'آلیاژ روی، براش‌خورده و لاک‌خورده.',
    care: 'خشک نگهش دار. با پارچهٔ نرم پاک شود.',
    detail: 'قابل تنظیم از ۶۸ تا ۹۶ سانتی‌متر. آن‌قدر سنگین هست که کمر چین‌دار را سر جایش نگه دارد.',
  },
  {
    id: 'crinkle-shirt', name: 'رویی چین‌خورده', col: 'pastel', cat: 'outerwear',
    price: 2380000, img: 'p-crinkle-shirt', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'صورتی آدامسی', hex: '#F49CB6' }, { name: 'آبی آسمانی', hex: '#A9C9E8' }],
    note: 'نایلون چین‌خوردهٔ پَر-سبک — همانی که دور شانه گره می‌زنی.',
    fabric: '۱۰۰٪ نایلون با پرداخت چین‌خورده.',
    care: 'ماشین، آب سرد. اتو نکن؛ چین‌هایش خودِ ماجراست.',
    detail: 'پشت بلند، جلو کوتاه. تا اندازهٔ یک مشت جمع می‌شود.',
  },
  {
    id: 'pleat-trouser', name: 'شلوار پیلی‌دار گشاد', col: 'pastel', cat: 'trousers',
    price: 2180000, img: 'p-pleat-trouser', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'آبی آسمانی', hex: '#A9C9E8' }, { name: 'سرمه‌ای', hex: '#22232A' }],
    note: 'کمر کش‌دار، جیب‌های گود، پاچه‌ای که تمامی ندارد.',
    fabric: '۵۵٪ ویسکوز و ۴۵٪ کتان.',
    care: 'آب سرد، برنامهٔ ملایم. آویزان خشک شود. نمدار اتو شود.',
    detail: 'روی گودی کمر می‌نشیند. قد داخل پا در سایز M برابر ۷۴ سانتی‌متر است '
      + 'و می‌شود کوتاهش کرد بدون این‌که ریزشش از بین برود.',
  },
  {
    id: 'polka-skirt', name: 'دامن میدی خال‌خالی', col: 'pastel', cat: 'skirts',
    price: 2290000, img: 'p-polka-skirt', sizes: RTW, fit: 'true',
    colours: [{ name: 'گچی', hex: '#EDEAE4' }],
    note: 'وال نخی چاپی، ترک‌های اریب، و دامنی که تاب می‌خورد.',
    fabric: '۱۰۰٪ وال نخی، چاپ سیلک.',
    care: 'آب سرد. در سایه خشک شود. اتوی ملایم.',
    detail: 'شش ترک اریب بریده شده تا بدون حتی یک پنس بیفتد.',
  },
  {
    id: 'rib-tee', name: 'تی‌شرت کبریتی پایه', col: 'pastel', cat: 'tops',
    price: 890000, img: 'p-rib-tee', sizes: RTW, fit: 'small', badge: 'دوباره موجود',
    colours: [{ name: 'سفید', hex: '#FFFFFF' }, { name: 'مشکی', hex: '#111114' },
      { name: 'صورتی', hex: '#EF8FAB' }],
    note: 'لایهٔ زیرِ هر چیز دیگری که در این فروشگاه هست.',
    fabric: '۹۵٪ نخ و ۵٪ الاستان، کبریتی ۲×۲.',
    care: 'ماشین، آب سرد. نمدار فرمش را درست کن.',
    detail: 'تنگ و کوتاه دوخته شده. اگر می‌خواهی روی تن بایستد، یک سایز بالاتر بگیر.',
  },

  /* -------------------------------------------------------- LACE NOIR */
  {
    id: 'lace-bandeau', name: 'تی‌شرت با بالاتنهٔ دانتل', col: 'noir', cat: 'tops',
    price: 1890000, img: 'p-lace-bandeau', sizes: RTW, fit: 'true', badge: 'پرفروش',
    colours: [{ name: 'مشکی / شیری', hex: '#141417' }],
    note: 'یک تی‌شرت نخی که یک بالاتنهٔ دانتل مستقیم رویش دوخته شده.',
    fabric: 'تن ۱۰۰٪ نخ. بالاتنه دانتل ۶۵٪ نایلون و ۳۵٪ نخ.',
    care: 'شست‌وشوی دستی با آب سرد، خوابیده خشک شود. دانتل را نچلان.',
    detail: 'دو لباس، یک درز. بندها تزئینی‌اند — کل لباس از سر رد می‌شود.',
  },
  {
    id: 'mesh-cami', name: 'تاپ توری', col: 'noir', cat: 'tops',
    price: 1450000, img: 'p-mesh-cami', sizes: RTW, fit: 'true',
    colours: [{ name: 'دودی', hex: '#7C7C82' }, { name: 'مشکی', hex: '#111114' }],
    note: 'توری نازک با لبهٔ چین‌دار، روی تی‌شرت.',
    fabric: '۱۰۰٪ توری پلی‌استر با حاشیهٔ پیکو.',
    care: 'شست‌وشوی دستی با آب سرد. آویزان خشک شود. اتو نشود.',
    detail: 'بندهای قابل تنظیم. لایه‌اش کن — برای تنها پوشیدن ساخته نشده.',
  },
  {
    id: 'linen-trouser', name: 'شلوار کتان گشاد', col: 'noir', cat: 'trousers',
    price: 2480000, img: 'p-linen-trouser', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'گچی', hex: '#EDEAE4' }, { name: 'مشکی', hex: '#111114' }],
    note: 'کتان مچاله، پیلی جلو، و جادکمه‌هایی که کمربند واقعی را قبول می‌کنند.',
    fabric: '۱۰۰٪ کتان شسته.',
    care: 'ماشین، آب سرد. برای نرم شدن، خشک‌کن ملایم. چروک‌هایش درست است.',
    detail: 'کمر بلند، پاچهٔ گشاد و راست، جیب بغل به اندازه‌ای گود که موبایل جا شود.',
  },
  {
    id: 'pearl-cap', name: 'کلاه قلاب‌بافی مرواریدی', col: 'noir', cat: 'accessories',
    price: 980000, img: 'p-pearl-cap', sizes: ONE, fit: 'true',
    colours: [{ name: 'شیری', hex: '#F2EFE9' }],
    note: 'بافت باز قلاب، با مرواریدهای شیشه‌ای روی لبه.',
    fabric: '۱۰۰٪ نخ کاموا، مروارید شیشه‌ای.',
    care: 'شست‌وشوی دستی با آب سرد، دور از آفتاب و خوابیده خشک شود.',
    detail: 'تا دور سر ۵۸ باز می‌شود. عقب سر می‌نشیند، نه پایین روی گوش‌ها.',
  },
  {
    id: 'tinted-shades', name: 'عینک دودی رنگی', col: 'noir', cat: 'accessories',
    price: 1650000, img: 'p-tinted-shades', sizes: ONE, fit: 'true', badge: 'جدید',
    colours: [{ name: 'کهربایی / بنفش', hex: '#B4762F' },
      { name: 'مشکی / طوسی', hex: '#111114' }],
    note: 'فریم استات با عدسی بنفش سایه‌دار.',
    fabric: 'استات ایتالیایی، عدسی CR-39، محافظ UV400.',
    care: 'توی کیفش بماند. با دستمال مخصوص تمیز شود، نه با لباس.',
    detail: 'پل پهن، میلهٔ بالایی صاف. روی صورت گرد بهتر می‌نشیند تا صورت کشیده.',
  },

  /* ----------------------------------------------------- DESERT HOURS */
  {
    id: 'prairie-blouse', name: 'بلوز ابریشمی چین‌دار', col: 'desert', cat: 'tops',
    price: 3150000, img: 'p-prairie-blouse', sizes: RTW, fit: 'true', badge: 'آخرین‌ها',
    colours: [{ name: 'خاکی', hex: '#8E8189' }, { name: 'قهوه‌ای سوخته', hex: '#5C4038' }],
    note: 'ابریشم مچاله با یقهٔ هفتِ باز و دامنی که از کمر باز می‌شود.',
    fabric: '۱۰۰٪ ابریشم شسته با شن. حاشیهٔ قیطان فلزی.',
    care: 'خشک‌شویی. اتوی خنک از روی پارچه.',
    detail: 'آستین پفی، مچ کش‌دار، بند داخلی. یقه را با تاپ بپوش یا بدون آن.',
  },
  {
    id: 'concho-belt', name: 'کمربند چرم سکه‌دار', col: 'desert', cat: 'accessories',
    price: 2450000, img: 'p-concho-belt', sizes: ONE, fit: 'true',
    colours: [{ name: 'عسلی', hex: '#7A4B2E' }],
    note: 'سکه‌های نقره‌ای که دستی روی چرم گیاهی نشانده شده‌اند.',
    fabric: 'چرم طبیعی، سکهٔ نقرهٔ نیکلی.',
    care: 'سالی دو بار واکس بخورد. از آب دور بماند.',
    detail: 'سه حالت بستن، از ۷۶ تا ۹۶ سانتی‌متر. تکهٔ آویز تا وسط ران می‌رسد.',
  },
  {
    id: 'brim-hat', name: 'کلاه جیر لبه‌دار', col: 'desert', cat: 'accessories',
    price: 2280000, img: 'p-brim-hat', sizes: ONE, fit: 'true',
    colours: [{ name: 'قهوه‌ای', hex: '#5A3A2A' }, { name: 'شنی', hex: '#B99168' }],
    note: 'جیر دوخته‌شده، لبهٔ ۹ سانتی، تاج با بخیهٔ دورپیچ.',
    fabric: 'جیر بز با نوار عرق‌گیر نخی.',
    care: 'در جهت پرز برس بخورد. هیچ‌وقت خیس نشود.',
    detail: 'نوار داخلی از ۵۶ تا ۵۹ تنظیم می‌شود. خوابیده هم فرمش را نگه می‌دارد.',
  },
  {
    id: 'print-skirt', name: 'دامن طرح‌دار کویری', col: 'desert', cat: 'skirts',
    price: 2690000, img: 'p-print-skirt', sizes: RTW, fit: 'true',
    colours: [{ name: 'طرح سنگ', hex: '#B7AFA6' }],
    note: 'حریر طبقه‌طبقه روی یک زیرپوش کوتاه، با طرحی که از یک عکس چاپ شده.',
    fabric: '۱۰۰٪ حریر پلی‌استر. آستر ۱۰۰٪ ویسکوز.',
    care: 'شست‌وشوی دستی با آب سرد. آویزان خشک شود. اتوی خنک.',
    detail: 'سه طبقه، کمر کش‌دار. آستر ۲۰ سانتی بالاتر از لبه تمام می‌شود.',
  },
  {
    id: 'sheer-blouse', name: 'بلوز راه‌راه توری', col: 'desert', cat: 'tops',
    price: 2890000, img: 'p-sheer-blouse', sizes: RTW, fit: 'relaxed',
    colours: [{ name: 'قهوه‌ای سوخته', hex: '#4A3730' }],
    note: 'راه‌راه بافته‌شده روی زمینهٔ توری، جمع‌شده در کمر.',
    fabric: '۷۰٪ ویسکوز و ۳۰٪ ابریشم.',
    care: 'شست‌وشوی دستی با آب سرد، آویزان خشک شود. اتوی خنک.',
    detail: 'جلو بنددار با بند داخلی. توری است — برند با یک تاپ ست می‌فروشدش.',
  },
];

/* لوک‌ها — the looks: full-bleed campaign frames, each one shoppable. */
export const LOOKS = [
  { id: 'l1', img: 'look-1', col: 'pastel', title: 'سه تا ما، دو تا ماشین',
    caption: 'کالکشن Pastel Play، فریم اول.', items: ['organza-skirt', 'alphabet-tee', 'heart-belt'] },
  { id: 'l2', img: 'look-2', col: 'pastel', title: 'الفبا',
    caption: 'گیپور روی تریکوی ضخیم.', items: ['alphabet-tee', 'pleat-trouser', 'polka-skirt'] },
  { id: 'l3', img: 'look-3', col: 'pastel', title: 'گره روی شانه',
    caption: 'رویی چین‌خورده، به تنها شکل درستش.', items: ['crinkle-shirt', 'rib-tee'] },
  { id: 'l4', img: 'look-4', col: 'noir', title: 'دانتل روی مشکی',
    caption: 'کالکشن Lace Noir، لباس همیشگی برند.', items: ['lace-bandeau', 'linen-trouser', 'pearl-cap'] },
  { id: 'l5', img: 'look-5', col: 'noir', title: 'گیلاس‌ها',
    caption: 'توری روی تی‌شرت سفید، نقره روی کمر.', items: ['mesh-cami', 'tinted-shades'] },
  { id: 'l6', img: 'look-6', col: 'desert', title: 'نور بلند',
    caption: 'کالکشن Desert Hours، آخر روز گرفته شده.', items: ['prairie-blouse', 'concho-belt', 'brim-hat'] },
];

/* ------------------------------------------------------------- lookups */
export const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
export const colById = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]));
export const getProduct = (id) => byId[id] || null;
export const getCollection = (id) => colById[id] || null;
export const inCollection = (id) => PRODUCTS.filter((p) => p.col === id);
export const inCategory = (id) => (id === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === id));

/** تازه‌رسیده‌ها: the badged pieces first, then the rest, stable order. */
export const newIn = () => [...PRODUCTS].sort(
  (a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0)).slice(0, 8);
