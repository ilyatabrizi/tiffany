/* کاتالوگ — the catalogue, in Persian, English and Turkish.

   Every name, price, fabric and measurement below is PLACEHOLDER copy written
   to make the preview read like a real shop. Swap the lot for the studio's own
   line sheet before this goes anywhere near a customer. The photography is
   real — cropped from the campaign frames the studio sent.

   Persian is written the way people talk (خودمونی), not the way a form reads.

   The three collection names stay in Latin on purpose. They are names, the way
   the wordmark is a name, and every Iranian fashion house keeps them that way.

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
const RTW = ['XS', 'S', 'M', 'L', 'XL'];
/* One size is stored as OS. Bags saved before the switch hold its old
   Persian or English label, so those read as OS too. */
const ONE = ['OS'];
const OS_NAMES = ['OS', 'فری‌سایز', 'One size', 'Standart beden'];
export const isOneSize = (s) => OS_NAMES.includes(s);
export const sizeLabel = (s) => (isOneSize(s) ? T('فری‌سایز', 'One size', 'Standart beden') : s);

export const PRODUCTS = [
  /* ------------------------------------------------------ PASTEL PLAY */
  {
    id: 'alphabet-tee', name: T('تی‌شرت الفبا', 'Alphabet Lace Tee', 'Alfabe Dantel Tişört'),
    col: 'pastel', cat: 'tee',
    price: 1680000, img: 'p-alphabet-tee', sizes: RTW, fit: 'relaxed',
    badge: T('جدید', 'New', 'Yeni'),
    colours: [C('#A9C9E8', 'آبی آسمونی', 'Sky', 'Gök mavisi'),
      C('#F2EFE9', 'شیری', 'Ivory', 'Fildişi')],
    note: T('تریکوی نخی ضخیم با یه تیکه گیپور که دستی روش دوخته شده.',
      'Heavy cotton jersey with a broderie panel appliquéd by hand.',
      'Elle aplike edilmiş brode panelli, kalın pamuklu süprem.'),
    fabric: T('۱۰۰٪ نخ، ۲۲۰ گرم. حاشیه‌ی دانتل ۶۰٪ نخ و ۴۰٪ نایلون.',
      '100% cotton, 220gsm. Lace trim 60% cotton / 40% nylon.',
      '%100 pamuk, 220 g/m². Dantel şerit %60 pamuk / %40 naylon.'),
    care: T('با آب سرد و پشت‌ورو بشورش. خشک‌کن نه. اتوی ملایم، ولی هیچ‌وقت روی دانتل.',
      'Cold wash, inside out. Do not tumble. Warm iron, never on the lace.',
      'Ters çevirip soğuk suda yıka. Kurutma makinesine atma. Ilık ütü; ama dantelin üstüne asla.'),
    detail: T('سرشونه افتاده، تن جعبه‌ای، یقه کبریتی. تیکه‌ی رویی بعد از دوخت تی‌شرت '
      + 'اضافه می‌شه، واسه همین جای هیچ دو تاش دقیقاً یکی نیست.',
    'Drop shoulder, boxy body, ribbed neck. The panel is stitched on '
      + 'after the tee is made, so no two sit in exactly the same place.',
    'Düşük omuz, kutu kesim, ribanalı yaka. Panel tişört dikildikten sonra '
      + 'eklenir; bu yüzden hiçbiri tam aynı yerde durmaz.'),
  },
  {
    id: 'organza-skirt', name: T('دامن ابری ارگانزا', 'Organza Cloud Skirt', 'Organze Bulut Etek'),
    col: 'pastel', cat: 'skirts',
    price: 2950000, img: 'p-organza-skirt', sizes: RTW, fit: 'true',
    badge: T('کمپین', 'Campaign', 'Kampanya'),
    colours: [C('#EF8FAB', 'صورتی', 'Blush', 'Pudra pembe'),
      C('#EDEAE4', 'گچی', 'Chalk', 'Tebeşir beyazı')],
    note: T('دو لایه ارگانزای مچاله روی یه زیرپوش نخی.',
      'Two layers of crushed organza over a cotton slip.',
      'Pamuklu bir astarın üzerinde iki kat buruşuk organze.'),
    fabric: T('رویه ۱۰۰٪ ارگانزای پلی‌استر. آستر ۱۰۰٪ نخ.',
      'Shell 100% polyester organza. Lining 100% cotton.',
      'Dış kumaş %100 polyester organze. Astar %100 pamuk.'),
    care: T('با دست و آب سرد بشور، آویزون خشکش کن. فقط بخار؛ اتوی داغ خوابش می‌کنه.',
      'Hand wash cold, hang to dry. Steam only — a hot iron will flatten it.',
      'Elde soğuk suda yıka, asarak kurut. Sadece buhar; sıcak ütü onu yassılaştırır.'),
    detail: T('کمرش از پشت کش‌داره و جلوش صاف. روی قد ۱۶۸ تا وسط ساق میاد و جوری '
      + 'تکون می‌خوره که انگار یه سایز بزرگ‌تره.',
    'Elasticated back waist, flat front. Falls mid-calf on 168cm and '
      + 'moves like it is a size larger than it is.',
    'Arkası lastikli, önü düz bel. 168 cm boyda baldır ortasına iner ve '
      + 'olduğundan bir beden büyükmüş gibi hareket eder.'),
  },
  {
    id: 'heart-belt', name: T('کمربند زنجیری قلب', 'Heart Chain Belt', 'Kalpli Zincir Kemer'),
    col: 'pastel', cat: 'accessories',
    price: 1150000, img: 'p-heart-belt', sizes: ONE, fit: 'true',
    colours: [C('#C6C8CC', 'نقره‌ای', 'Silver', 'Gümüş')],
    note: T('قلب‌های ریخته‌گری روی زنجیر مهره‌ای، با قلاب.',
      'Cast hearts on a beaded chain, hook clasp.',
      'Boncuklu zincir üzerinde döküm kalpler, kancalı kopça.'),
    fabric: T('آلیاژ روی، براش‌خورده و لاک‌خورده.',
      'Zinc alloy, brushed and lacquered.',
      'Çinko alaşım, fırçalanmış ve cilalı.'),
    care: T('خشک نگهش دار. با یه پارچه‌ی نرم پاکش کن.',
      'Keep dry. Wipe with a soft cloth.',
      'Kuru tut. Yumuşak bir bezle sil.'),
    detail: T('از ۶۸ تا ۹۶ سانتی‌متر تنظیم می‌شه. اون‌قدر سنگین هست که کمر چین‌دار رو سر جاش نگه داره.',
      'Adjustable 68–96cm. Heavy enough to hold a gathered waist in place.',
      '68–96 cm arası ayarlanır. Büzgülü bir beli yerinde tutacak kadar ağır.'),
  },
  {
    id: 'crinkle-shirt', name: T('رویی چین‌خورده', 'Crinkle Overshirt', 'Kırışık Gömlek Ceket'),
    col: 'pastel', cat: 'shirt',
    price: 2380000, img: 'p-crinkle-shirt', sizes: RTW, fit: 'relaxed',
    colours: [C('#F49CB6', 'صورتی آدامسی', 'Bubblegum', 'Sakız pembesi'),
      C('#A9C9E8', 'آبی آسمونی', 'Sky', 'Gök mavisi')],
    note: T('نایلون چین‌خورده و پَرمانند؛ همونی که دور شونه گره‌ش می‌زنی.',
      'Featherweight crinkle nylon — the one you tie at the shoulders.',
      'Tüy hafifliğinde kırışık naylon; omuzlara bağladığın o parça.'),
    fabric: T('۱۰۰٪ نایلون با پرداخت چین‌خورده.',
      '100% nylon, crinkle finish.',
      '%100 naylon, kırışık bitiş.'),
    care: T('ماشین، آب سرد. اتوش نکن؛ چین‌هاش خودِ ماجراست.',
      'Cold machine wash. Do not iron; the crinkle is the point.',
      'Makinede soğuk yıka. Ütüleme; kırışıklık işin ta kendisi.'),
    detail: T('پشتش بلنده، جلوش کوتاه. تا اندازه‌ی یه مشت جمع می‌شه.',
      'Cut long in the back, cropped in front. Packs to the size of a fist.',
      'Arkası uzun, önü kısa kesim. Bir yumruk boyutuna kadar katlanır.'),
  },
  {
    id: 'pleat-trouser', name: T('شلوار پیلی‌دار گشاد', 'Wide Pleat Trouser', 'Pileli Bol Pantolon'),
    col: 'pastel', cat: 'trousers',
    price: 2180000, img: 'p-pleat-trouser', sizes: RTW, fit: 'relaxed',
    colours: [C('#A9C9E8', 'آبی آسمونی', 'Sky', 'Gök mavisi'),
      C('#22232A', 'سرمه‌ای', 'Ink', 'Lacivert')],
    note: T('کمر کش‌دار، جیب‌های گود، پاچه‌ای که تمومی نداره.',
      'Elastic waist, deep pockets, a leg that keeps going.',
      'Lastikli bel, derin cepler, bitmek bilmeyen paçalar.'),
    fabric: T('۵۵٪ ویسکوز و ۴۵٪ کتان.',
      '55% viscose / 45% linen.',
      '%55 viskon / %45 keten.'),
    care: T('آب سرد، برنامه‌ی ملایم. آویزون خشکش کن. نم‌دار اتوش کن.',
      'Cold wash on gentle. Line dry. Iron damp.',
      'Hassas programda soğuk yıka. Asarak kurut. Nemliyken ütüle.'),
    detail: T('روی گودی کمر می‌شینه. قد داخل پا توی سایز M ۷۴ سانته و می‌شه '
      + 'کوتاهش کرد بدون این‌که ریزشش از بین بره.',
    'Sits at the natural waist. 74cm inseam on M, hemmable without '
      + 'losing the drape.',
    'Doğal bel hizasında durur. M bedende iç boy 74 cm; dökümü bozulmadan '
      + 'kısaltılabilir.'),
  },
  {
    id: 'polka-skirt', name: T('دامن میدی خال‌خالی', 'Polka Midi Skirt', 'Puantiyeli Midi Etek'),
    col: 'pastel', cat: 'skirts',
    price: 2290000, img: 'p-polka-skirt', sizes: RTW, fit: 'true',
    colours: [C('#EDEAE4', 'گچی', 'Chalk', 'Tebeşir beyazı')],
    note: T('وال نخی چاپی، ترک‌های اریب، و دامنی که تاب می‌خوره.',
      'Printed cotton voile, bias panels, a hem that swings.',
      'Baskılı pamuklu vual, verev parçalar, salınan bir etek ucu.'),
    fabric: T('۱۰۰٪ وال نخی، چاپ سیلک.',
      '100% cotton voile, screen printed.',
      '%100 pamuklu vual, serigrafi baskı.'),
    care: T('آب سرد. توی سایه خشکش کن. اتوی ملایم.',
      'Cold wash. Line dry in shade. Warm iron.',
      'Soğuk yıka. Gölgede asarak kurut. Ilık ütü.'),
    detail: T('شش تا ترک اریب بریده شده تا بدون حتی یه پنس بیفته.',
      'Six panels cut on the bias so it hangs without a single dart.',
      'Tek bir pens olmadan dökülsün diye verevden kesilmiş altı parça.'),
  },
  {
    id: 'rib-tee', name: T('تی‌شرت کبریتی ساده', 'Essential Rib Tee', 'Basic Fitilli Tişört'),
    col: 'pastel', cat: 'tee',
    price: 890000, img: 'p-rib-tee', sizes: RTW, fit: 'small',
    badge: T('دوباره موجود', 'Restocked', 'Yeniden stokta'),
    colours: [C('#FFFFFF', 'سفید', 'White', 'Beyaz'), C('#111114', 'مشکی', 'Black', 'Siyah'),
      C('#EF8FAB', 'صورتی', 'Blush', 'Pudra pembe')],
    note: T('لایه‌ی زیرِ هر چیز دیگه‌ای که توی این فروشگاه هست.',
      'The base layer under everything else in this shop.',
      'Bu mağazadaki her şeyin altına giyilen temel katman.'),
    fabric: T('۹۵٪ نخ و ۵٪ الاستان، کبریتی ۲×۲.',
      '95% cotton / 5% elastane, 2x2 rib.',
      '%95 pamuk / %5 elastan, 2x2 ribana.'),
    care: T('ماشین، آب سرد. تا نم داره فرمش رو درست کن.',
      'Machine wash cold. Reshape while damp.',
      'Makinede soğuk yıka. Nemliyken şeklini düzelt.'),
    detail: T('تنگ و کوتاه دوخته شده. اگه می‌خوای راحت روی تنت بشینه، یه سایز بزرگ‌تر بگیر.',
      'Cut close and short. Take a size up if you want it to skim.',
      'Dar ve kısa kesim. Vücuduna hafifçe değsin istiyorsan bir beden büyük al.'),
  },

  /* -------------------------------------------------------- LACE NOIR */
  {
    id: 'lace-bandeau', name: T('تی‌شرت با بالاتنه‌ی دانتل', 'Lace Bandeau Tee', 'Dantel Bandolu Tişört'),
    col: 'noir', cat: 'tee',
    price: 1890000, img: 'p-lace-bandeau', sizes: RTW, fit: 'true',
    badge: T('پرفروش', 'Best seller', 'Çok satan'),
    colours: [C('#141417', 'مشکی و شیری', 'Black / Ivory', 'Siyah / Fildişi')],
    note: T('یه تی‌شرت نخی که یه بالاتنه‌ی دانتل مستقیم روش دوخته شده.',
      'A cotton tee with a lace bandeau sewn straight onto it.',
      'Üstüne doğrudan dantel bando dikilmiş pamuklu bir tişört.'),
    fabric: T('تنه ۱۰۰٪ نخ. بالاتنه دانتل ۶۵٪ نایلون و ۳۵٪ نخ.',
      'Body 100% cotton. Bandeau 65% nylon / 35% cotton lace.',
      'Gövde %100 pamuk. Bando %65 naylon / %35 pamuk dantel.'),
    care: T('با دست و آب سرد بشور، خوابیده خشکش کن. دانتل رو نچلون.',
      'Hand wash cold, dry flat. Do not wring the lace.',
      'Elde soğuk suda yıka, sererek kurut. Danteli sıkma.'),
    detail: T('دو تا لباس، یه درز. بندهاش تزئینیه؛ کل لباس از سر رد می‌شه.',
      'Two garments, one seam. Straps are decorative — the whole thing '
        + 'comes on and off over the head.',
      'İki giysi, tek dikiş. Askılar süs; hepsi baştan giyilip çıkarılır.'),
  },
  {
    id: 'mesh-cami', name: T('تاپ توری', 'Mesh Slip Cami', 'File Askılı Bluz'),
    col: 'noir', cat: 'top',
    price: 1450000, img: 'p-mesh-cami', sizes: RTW, fit: 'true',
    colours: [C('#7C7C82', 'دودی', 'Smoke', 'Füme'), C('#111114', 'مشکی', 'Black', 'Siyah')],
    note: T('توری نازک با لبه‌ی چین‌دار، که روی تی‌شرت پوشیده می‌شه.',
      'Sheer mesh with a ruffled edge, worn over a tee.',
      'Tişört üstüne giyilen, fırfırlı kenarlı ince file.'),
    fabric: T('۱۰۰٪ توری پلی‌استر با حاشیه‌ی پیکو.',
      '100% polyester mesh, picot trim.',
      '%100 polyester file, pikot şerit.'),
    care: T('با دست و آب سرد بشور. آویزون خشکش کن. اتو نکن.',
      'Hand wash cold. Hang to dry. Do not iron.',
      'Elde soğuk suda yıka. Asarak kurut. Ütüleme.'),
    detail: T('بندهاش تنظیم می‌شه. لایه‌ای بپوشش؛ برای تنها پوشیدن ساخته نشده.',
      'Adjustable straps. Layer it — it is not built to be worn alone.',
      'Ayarlanabilir askılar. Katmanlı giy; tek başına giyilmek için yapılmadı.'),
  },
  {
    id: 'linen-trouser', name: T('شلوار کتان گشاد', 'Linen Wide Trouser', 'Bol Keten Pantolon'),
    col: 'noir', cat: 'trousers',
    price: 2480000, img: 'p-linen-trouser', sizes: RTW, fit: 'relaxed',
    colours: [C('#EDEAE4', 'گچی', 'Chalk', 'Tebeşir beyazı'), C('#111114', 'مشکی', 'Black', 'Siyah')],
    note: T('کتان مچاله، پیلی جلو، و جاکمربندی‌هایی که یه کمربند واقعی رو جا می‌دن.',
      'Crushed linen, pleated front, belt loops that take a real belt.',
      'Buruşuk keten, önden pileli, gerçek bir kemer alan kemer köprüleri.'),
    fabric: T('۱۰۰٪ کتان شسته.',
      '100% washed linen.',
      '%100 yıkanmış keten.'),
    care: T('ماشین، آب سرد. برای نرم شدن، خشک‌کن ملایم. چروک‌هاش طبیعیه.',
      'Machine wash cold. Tumble low to soften. Creases are correct.',
      'Makinede soğuk yıka. Yumuşasın diye düşük ısıda kurut. Kırışıklar olması gerektiği gibi.'),
    detail: T('فاق بلند، پاچه‌ی گشاد و صاف، جیب بغلی اون‌قدر گود که گوشی توش جا بشه.',
      'High waist, wide straight leg, side pockets deep enough for a phone.',
      'Yüksek bel, geniş düz paça, telefon sığacak kadar derin yan cepler.'),
  },
  {
    id: 'pearl-cap', name: T('کلاه قلاب‌بافی مرواریدی', 'Pearl Crochet Cap', 'İncili Tığ İşi Şapka'),
    col: 'noir', cat: 'accessories',
    price: 980000, img: 'p-pearl-cap', sizes: ONE, fit: 'true',
    colours: [C('#F2EFE9', 'شیری', 'Ivory', 'Fildişi')],
    note: T('بافت باز قلاب‌بافی، با مرواریدهای شیشه‌ای روی لبه.',
      'Open-stitch crochet, glass pearls set along the brim.',
      'Açık örgü tığ işi, kenarı boyunca cam inciler.'),
    fabric: T('۱۰۰٪ نخ کاموا، مروارید شیشه‌ای.',
      '100% cotton yarn, glass pearl trim.',
      '%100 pamuk ip, cam inci süsleme.'),
    care: T('با دست و آب سرد بشور، دور از آفتاب و خوابیده خشکش کن.',
      'Hand wash cold, dry flat away from sun.',
      'Elde soğuk suda yıka, güneşten uzakta sererek kurut.'),
    detail: T('تا دور سر ۵۸ باز می‌شه. عقب سر می‌شینه، نه پایین روی گوش‌ها.',
      'Stretches to 58cm. Sits back on the head, not down over the ears.',
      '58 cm’ye kadar esner. Kulakların üstüne değil, başın arkasına oturur.'),
  },
  {
    id: 'tinted-shades', name: T('عینک دودی رنگی', 'Tinted Aviator', 'Renkli Aviator Gözlük'),
    col: 'noir', cat: 'accessories',
    price: 1650000, img: 'p-tinted-shades', sizes: ONE, fit: 'true',
    badge: T('جدید', 'New', 'Yeni'),
    colours: [C('#B4762F', 'کهربایی و بنفش', 'Amber / Violet', 'Kehribar / Mor'),
      C('#111114', 'مشکی و طوسی', 'Black / Grey', 'Siyah / Gri')],
    note: T('فریم استات با عدسی بنفش سایه‌دار.',
      'Acetate frame, graduated violet lens.',
      'Asetat çerçeve, renk geçişli mor cam.'),
    fabric: T('استات ایتالیایی، عدسی CR-39، محافظ UV400.',
      'Italian acetate, CR-39 lens, UV400.',
      'İtalyan asetat, CR-39 cam, UV400.'),
    care: T('توی کیفش بمونه. با دستمال مخصوص تمیزش کن، نه با لباس.',
      'Keep in the pouch. Clean with the cloth, never a shirt.',
      'Kılıfında sakla. Tişörtünle değil, beziyle temizle.'),
    detail: T('پل پهن، میله‌ی بالایی صاف. روی صورت گرد بهتر می‌شینه تا صورت کشیده.',
      'Wide bridge, flat top bar. Suits a round face better than a long one.',
      'Geniş köprü, düz üst çubuk. Uzun yüzden çok yuvarlak yüze yakışır.'),
  },

  /* ----------------------------------------------------- DESERT HOURS */
  {
    id: 'prairie-blouse', name: T('بلوز ابریشمی چین‌دار', 'Prairie Silk Blouse', 'Fırfırlı İpek Bluz'),
    col: 'desert', cat: 'shirt',
    price: 3150000, img: 'p-prairie-blouse', sizes: RTW, fit: 'true',
    badge: T('آخرین‌ها', 'Last pieces', 'Son parçalar'),
    colours: [C('#8E8189', 'خاکی', 'Dust', 'Toz'),
      C('#5C4038', 'قهوه‌ای سوخته', 'Umber', 'Toprak kahve')],
    note: T('ابریشم مچاله با یقه‌ی هفتِ باز و دامنی که از کمر باز می‌شه.',
      'Crushed silk with a deep V and a peplum that flares off the waist.',
      'Derin V yakalı, belden açılan peplumlu buruşuk ipek.'),
    fabric: T('۱۰۰٪ ابریشم شسته با شن. حاشیه‌ی قیطان فلزی.',
      '100% silk, sand-washed. Metallic braid trim.',
      '%100 ipek, kum yıkamalı. Metalik kordon şerit.'),
    care: T('خشک‌شویی. اتوی خنک، از روی یه پارچه.',
      'Dry clean. Cool iron through a cloth.',
      'Kuru temizleme. Bir bez üstünden serin ütü.'),
    detail: T('آستین پفی، مچ کش‌دار، بند داخلی. یقه رو با تاپ بپوش یا بدونش.',
      'Blouson sleeve, elasticated cuff, self-tie inside. Wear the V with '
        + 'a cami or without.',
      'Balon kol, lastikli manşet, içten bağlama. V yakayı askılıyla ya da onsuz giy.'),
  },
  {
    id: 'concho-belt', name: T('کمربند چرم سکه‌دار', 'Concho Leather Belt', 'Konçolu Deri Kemer'),
    col: 'desert', cat: 'accessories',
    price: 2450000, img: 'p-concho-belt', sizes: ONE, fit: 'true',
    colours: [C('#7A4B2E', 'عسلی', 'Saddle', 'Bal rengi')],
    note: T('سکه‌های نقره‌ای که دستی روی چرم گیاهی نشونده شدن.',
      'Hand-set silver conchos on vegetable-tanned leather.',
      'Bitkisel tabaklanmış deri üzerine elle çakılmış gümüş konçolar.'),
    fabric: T('چرم طبیعی، سکه‌ی نقره‌ی نیکلی.',
      'Full-grain leather, nickel silver conchos.',
      'Tam damarlı deri, nikel gümüş konçolar.'),
    care: T('سالی دو بار واکسش بزن. از آب دورش نگه دار.',
      'Condition twice a year. Keep out of standing water.',
      'Yılda iki kez bakım yap. Sudan uzak tut.'),
    detail: T('سه حالت بستن، از ۷۶ تا ۹۶ سانتی‌متر. تیکه‌ی آویزش تا وسط ران می‌رسه.',
      'Three fit positions, 76–96cm. The drop panel hangs to mid-thigh.',
      'Üç ayar, 76–96 cm. Sarkan parça uyluk ortasına iner.'),
  },
  {
    id: 'brim-hat', name: T('کلاه جیر لبه‌دار', 'Suede Brim Hat', 'Geniş Kenarlı Süet Şapka'),
    col: 'desert', cat: 'accessories',
    price: 2280000, img: 'p-brim-hat', sizes: ONE, fit: 'true',
    colours: [C('#5A3A2A', 'قهوه‌ای', 'Cocoa', 'Kakao'), C('#B99168', 'شنی', 'Sand', 'Kum')],
    note: T('جیر دوخته‌شده، لبه‌ی ۹ سانتی، تاج با بخیه‌ی دورپیچ.',
      'Stitched suede, 9cm brim, whipstitched crown.',
      'Dikişli süet, 9 cm kenar, kırma dikişli tepe.'),
    fabric: T('جیر بز با نوار عرق‌گیر نخی.',
      'Goat suede, cotton sweatband.',
      'Keçi süeti, pamuklu ter bandı.'),
    care: T('در جهت پرزش برس بکش. هیچ‌وقت خیسش نکن.',
      'Brush with the grain. Never wet.',
      'Tüy yönünde fırçala. Asla ıslatma.'),
    detail: T('نوار داخلیش از ۵۶ تا ۵۹ تنظیم می‌شه. حتی خوابیده هم فرمش رو نگه می‌داره.',
      'Internal band adjusts 56–59cm. Holds its shape packed flat.',
      'İç bant 56–59 cm arası ayarlanır. Düz katlansa da formunu korur.'),
  },
  {
    id: 'print-skirt', name: T('دامن طرح‌دار کویری', 'Desert Print Skirt', 'Çöl Desenli Etek'),
    col: 'desert', cat: 'skirts',
    price: 2690000, img: 'p-print-skirt', sizes: RTW, fit: 'true',
    colours: [C('#B7AFA6', 'طرح سنگ', 'Stone print', 'Taş desen')],
    note: T('حریر طبقه‌طبقه روی یه زیرپوش کوتاه، با طرحی که از یه عکس چاپ شده.',
      'Tiered chiffon over a short slip, printed from a photograph.',
      'Kısa bir astar üzerinde katlı şifon; desen bir fotoğraftan basıldı.'),
    fabric: T('۱۰۰٪ حریر پلی‌استر. آستر ۱۰۰٪ ویسکوز.',
      '100% polyester chiffon. Lining 100% viscose.',
      '%100 polyester şifon. Astar %100 viskon.'),
    care: T('با دست و آب سرد بشور. آویزون خشکش کن. اتوی خنک.',
      'Hand wash cold. Line dry. Cool iron.',
      'Elde soğuk yıka. Asarak kurut. Serin ütü.'),
    detail: T('سه طبقه، کمر کش‌دار. آسترش ۲۰ سانت بالاتر از لبه تموم می‌شه.',
      'Three tiers, elastic waist. Lining sits 20cm above the hem.',
      'Üç kat, lastikli bel. Astar etek ucunun 20 cm yukarısında biter.'),
  },
  {
    id: 'sheer-blouse', name: T('بلوز راه‌راه توری', 'Sheer Stripe Blouse', 'Transparan Çizgili Bluz'),
    col: 'desert', cat: 'shirt',
    price: 2890000, img: 'p-sheer-blouse', sizes: RTW, fit: 'relaxed',
    colours: [C('#4A3730', 'قهوه‌ای سوخته', 'Umber', 'Toprak kahve')],
    note: T('راه‌راه بافته‌شده روی زمینه‌ی توری، که توی کمر جمع شده.',
      'Woven stripe in a sheer ground, gathered at the waist.',
      'Transparan zemin üzerine dokuma çizgiler, belden büzgülü.'),
    fabric: T('۷۰٪ ویسکوز و ۳۰٪ ابریشم.',
      '70% viscose / 30% silk.',
      '%70 viskon / %30 ipek.'),
    care: T('با دست و آب سرد بشور، آویزون خشکش کن. اتوی خنک.',
      'Hand wash cold, hang to dry. Cool iron.',
      'Elde soğuk suda yıka, asarak kurut. Serin ütü.'),
    detail: T('جلوش بندداره با یه بند داخلی. توریه؛ برند با یه تاپ ستش می‌فروشه.',
      'Wrap front with an inner tie. Sheer — the studio sells it with a '
        + 'matching cami.',
      'İç bağlamalı kruvaze ön. Transparan; atölye onu takım bir askılıyla satıyor.'),
  },
];

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
export const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
export const colById = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]));
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
