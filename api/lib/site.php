<?php
/* What the crawlable pages (seo.php) and llms.txt say about the shop besides
   the products: the collections and the shops. The same words the shop's
   own code uses (js/data.js COLLECTIONS, js/config.js BRAND and STORES) —
   seo_test.py fails if the two ever disagree. */
declare(strict_types=1);

const TF_SITE = 'https://tiffanybv.com';
const TF_BRAND = 'TIFFANY by Vanda';
const TF_INSTAGRAM = 'https://instagram.com/tiffanyiran';
const TF_WHATSAPP = '+989352118977';
const TF_EMAIL = 'Ameervanda@gmail.com';
const TF_SEASON_FA = 'پاییز و زمستون ۲۰۲۷';

/** id => [name, img, fa lede, en lede] */
const TF_COLLECTIONS = [
    'aw27-pink-mohair' => ['Pink Mohair', 'r-col-pink-mohair',
        'رویه موهر صورتی، بافت پشم دکمه‌دار و کیف چرمی سفید.',
        'A pink mohair top, a buttoned wool knit and a white leather bag.'],
    'aw27-pink-fleece' => ['Pink Fleece', 'r-col-pink-fleece',
        'ست سوشرت و شلوار سه‌نخ توکرک، با کت پوست مصنوعی یا کت تدی.',
        'A fleece-lined sweatshirt set, worn with a faux fur or a teddy coat.'],
    'aw27-black-leather' => ['Black Leather', 'r-col-black-leather',
        'کاپشن و بارونی چرم روغنی مشکی، با ست اویشو کرم.',
        'A black oiled leather jacket and trench coat, with a cream Avishu set.'],
    'aw27-denim-red' => ['Denim & Red', 'r-col-denim-red',
        'کت و شلوار جین، بارانی گاباردین سرمه‌ای و بافت‌های قرمز.',
        'Denim on denim, a navy gabardine trench coat and red knits.'],
    'aw27-aubergine' => ['Aubergine', 'r-col-aubergine',
        'کت پوست کوتاه شیری، بافت‌های بادمجانی و ست سوشرت.',
        'A milky short-pile fur jacket, aubergine knits and a sweatshirt set.'],
    'aw27-brown-leather' => ['Brown Leather', 'r-col-brown-leather',
        'کاپشن و کت چرم واترپروف قهوه‌ای با جین روشن.',
        'Brown waterproof leather jackets with light jeans.'],
    'aw27-grey-pink' => ['Grey & Pink', 'r-col-grey-pink',
        'وست و شلوار اویشو خاکستری تیره، بامبر سفید و بافت‌های صورتی.',
        'A dark grey Avishu vest and trousers, a white bomber and pink knits.'],
    'aw27-grey-red' => ['Grey & Red', 'r-col-grey-red',
        'کت پوست کوتاه کلاه‌دار، پالتو اورسایز طوسی و دورس قرمز.',
        'A hooded short-pile fur jacket, a grey oversize coat and a red crew sweatshirt.'],
    'aw27-olive-brown' => ['Olive & Brown', 'r-col-olive-brown',
        'بارانی شمعی، پالتو اورسایز قهوه‌ای و ست اویشو سبز زیتونی.',
        'A waxed trench coat, a brown oversize coat and an olive Avishu set.'],
    'aw27-chocolate-wool' => ['Chocolate Wool', 'r-col-chocolate-wool',
        'رویه و کت پشم خالص، دامن ترنچ و یقه‌اسکی سفید.',
        'A pure wool cardigan and jacket, a trench skirt and a white turtleneck.'],
    'aw27-olive-khaki' => ['Olive & Khaki', 'r-col-olive-khaki',
        'وست شمعی، بارانی کوتاه یقه‌دار و جین طوسی و سبز.',
        'A waxed vest, a short collared trench and grey and green jeans.'],
];

/** The shops: name fa/en, city fa/en, street address fa/en, phone, postcode. */
const TF_STORES = [
    ['تراس سنتر', 'Terrace Center', 'تهران', 'Tehran',
        'تهران، سعادت‌آباد، میدان کتاب، مجتمع تجاری تراس سنتر، طبقه‌ی دوم',
        'Terrace Center Mall, 2nd floor, Ketab Square, Saadat Abad, Tehran', '', ''],
    ['لاله پارک', 'Laleh Park', 'تبریز', 'Tabriz',
        'تبریز، میدان فهمیده، مجتمع تجاری لاله پارک، طبقه‌ی اول',
        'Laleh Park Mall, 1st floor, Fahmideh Square, Tabriz', '+984136600185', '5158489885'],
    ['اطلس', 'Atlas', 'تبریز', 'Tabriz',
        'تبریز، ولیعصر، نگین پارک، مجتمع تجاری اطلس، طبقه‌ی دوم',
        'Atlas Mall, 2nd floor, Negin Park, Valiasr, Tabriz', '+984133249176', '5157638919'],
    ['ولیعصر', 'Valiasr', 'تبریز', 'Tabriz',
        'تبریز، ولیعصر، فلکه‌ی بزرگ، نرسیده به بانک صادرات',
        'Valiasr, Falakeh Bozorg roundabout, just before Bank Saderat, Tabriz', '', '5157933511'],
];

/** The shop's category words (js/data.js CATEGORIES). */
const TF_CAT_FA = ['knit' => 'بافت', 'tee' => 'تیشرت', 'top' => 'تاپ', 'hoodie' => 'هودی و سوشرت', 'vest' => 'وست',
    'shirt' => 'شومیز', 'trousers' => 'شلوار', 'skirts' => 'دامن', 'jacket' => 'کاپشن', 'cardigan' => 'ژاکت',
    'accessories' => 'اکسسوری', 'shoes' => 'کفش'];
const TF_CAT_EN = ['knit' => 'Knitwear', 'tee' => 'T-shirts', 'top' => 'Tops', 'hoodie' => 'Hoodies & sweatshirts',
    'vest' => 'Vests', 'shirt' => 'Shirts & blouses', 'trousers' => 'Trousers', 'skirts' => 'Skirts', 'jacket' => 'Jackets',
    'cardigan' => 'Cardigans', 'accessories' => 'Accessories', 'shoes' => 'Shoes'];

/** Persian digits, the way the shop writes numbers. */
function tf_fa_num(string $s): string
{
    return strtr($s, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
}

function tf_toman_fa(int $n): string
{
    return tf_fa_num(number_format($n, 0, '.', '٬')) . ' تومان';
}

/** Sizes as words: one size reads «فری‌سایز». */
function tf_sizes_fa(array $sizes): string
{
    return implode('، ', array_map(static fn ($s) => $s === 'OS' ? 'فری‌سایز' : (string) $s, $sizes));
}

function tf_sizes_en(array $sizes): string
{
    return implode(', ', array_map(static fn ($s) => $s === 'OS' ? 'one size' : (string) $s, $sizes));
}
