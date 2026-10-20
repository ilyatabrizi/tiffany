<?php
/* Crawlable pages for search engines and AI answers.

   The shop is one page that draws itself in the browser (hash routes like
   #/p/white-leather-bag), and a hash is invisible to a search engine. So
   every piece, every collection and the shop list also have a real address
   (.htaccess sends them here):

     /p/<id>        one piece: its name, price, fabric, colours, sizes, photos
     /c/<id>        one collection and its pieces
     /shop          every piece
     /sitemap.xml   every address above, with its photos
     /llms.txt      the whole shop in plain words, for AI assistants

   Each page is index.html itself with its own title, description, canonical
   address, share card and schema.org data, and the same facts written out in
   the page, so a reader without JavaScript (a crawler) gets them. In a
   browser the shop starts as usual and opens the same page (js/router.js
   reads the address), so a visitor from a search result lands on the piece. */
declare(strict_types=1);

require __DIR__ . '/api/lib/boot.php';
require_once __DIR__ . '/api/lib/site.php';

/* boot.php answers errors in JSON; a page answers with the plain shop. */
set_exception_handler(static function (Throwable $e): void {
    tf_log_error($e);
    seo_shell(503, ['title' => TF_BRAND, 'robots' => 'noindex']);
});

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** schema.org data, safe inside a script tag. */
function ld(array $data): string
{
    return '<script type="application/ld+json">'
        . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP)
        . "</script>\n";
}

function abs_img(string $img, int $w = 960): string
{
    $base = strpos($img, '/') !== false ? $img : 'assets/img/' . $img;
    return TF_SITE . '/' . $base . '-' . $w . '.webp';
}

/** A product's own large photo: the 1440 frames exist only for the studio's r-… photos. */
function product_img(string $img): string
{
    return abs_img($img, preg_match('~^assets/img/r-~', $img) ? 1440 : 960);
}

/** index.html with this page's head and content. $p: title, desc, canonical,
    image, robots, ld (string of scripts), body (html for #app). */
function seo_shell(int $status, array $p): void
{
    $html = (string) file_get_contents(__DIR__ . '/index.html');
    $head = '<base href="/">' . "\n";
    $head .= '<link rel="canonical" href="' . h($p['canonical'] ?? TF_SITE . '/') . "\">\n";
    if (!empty($p['robots'])) {
        $head .= '<meta name="robots" content="' . h($p['robots']) . "\">\n";
    }
    $head .= '<meta name="twitter:title" content="' . h($p['title']) . "\">\n";
    $head .= '<meta name="twitter:description" content="' . h($p['desc'] ?? '') . "\">\n";
    if (!empty($p['image'])) {
        $head .= '<meta name="twitter:image" content="' . h($p['image']) . "\">\n";
    }
    $head .= $p['ld'] ?? '';

    /* index.html's own lines for these are replaced, not repeated. The new
       text goes in as it is: a «$1» or «\1» in a product's words is text,
       never a back-reference. */
    $put = static fn (string $re, string $with, string $in, int $n = 1): string
        => (string) preg_replace_callback($re, static fn () => $with, $in, $n);
    $html = $put('~<title>.*?</title>~s', '<title>' . h($p['title']) . '</title>', $html);
    $html = $put('~<meta name="description" content="[^"]*">~', '<meta name="description" content="' . h($p['desc'] ?? '') . '">', $html);
    $html = $put('~<meta property="og:title" content="[^"]*">~', '<meta property="og:title" content="' . h($p['title']) . '">', $html);
    if (!empty($p['ogtype'])) {
        $html = $put('~<meta property="og:type" content="[^"]*">~', '<meta property="og:type" content="' . h($p['ogtype']) . '">', $html);
    }
    $html = $put('~<meta property="og:url" content="[^"]*">~', '<meta property="og:url" content="' . h($p['canonical'] ?? TF_SITE . '/') . '">', $html);
    $html = $put('~<meta property="og:description" content="[^"]*">~', '<meta property="og:description" content="' . h($p['desc'] ?? '') . '">', $html);
    if (!empty($p['image'])) {
        $html = $put('~<meta property="og:image" content="[^"]*">~', '<meta property="og:image" content="' . h($p['image']) . '">', $html);
        $html = $put('~<meta property="og:image:(width|height)" content="[^"]*">\s*~', '', $html, -1);
    }
    $html = $put('~<link rel="canonical" href="[^"]*">\s*~', '', $html, -1);
    $html = $put('~<script type="application/ld\+json">.*?</script>\s*~s', '', $html, -1);
    $html = $put('~<meta charset="utf-8">~', "<meta charset=\"utf-8\">\n" . $head, $html);
    if (!empty($p['body'])) {
        $body = (string) $p['body'];
        $html = (string) preg_replace_callback('~<main id="app"[^>]*>~', static fn ($m) => $m[0] . $body, $html, 1);
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    echo $html;
    exit;
}

function not_found(): void
{
    seo_shell(404, ['title' => 'پیدا نشد | ' . TF_BRAND, 'desc' => 'این صفحه توی فروشگاه تیفانی نیست.',
        'robots' => 'noindex', 'canonical' => TF_SITE . '/']);
}

/** Where a piece sits: its collection, and the words for its colours. */
function piece_facts(array $p): array
{
    $cols = implode('، ', array_map(static fn ($c) => (string) $c['fa'], $p['colours'] ?? []));
    $colsEn = implode(', ', array_map(static fn ($c) => (string) ($c['en'] ?: $c['fa']), $p['colours'] ?? []));
    $fab = (string) ($p['fabric']['fa'] ?? '');
    $col = TF_COLLECTIONS[$p['col']] ?? null;
    return [$cols, $colsEn, $fab, $col];
}

function breadcrumb(array $items): array
{
    $list = [];
    foreach ($items as $i => [$name, $url]) {
        $list[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => $url];
    }
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $list];
}

/** A piece as a line in a list of pieces (collection and shop pages). */
function piece_card(array $p): string
{
    return '<li><a href="/p/' . h($p['id']) . '">' . h($p['name']['fa']) . '</a> — '
        . h(tf_toman_fa((int) $p['price'])) . '</li>';
}

function item_list(array $products): array
{
    $out = [];
    foreach (array_values($products) as $i => $p) {
        $out[] = ['@type' => 'ListItem', 'position' => $i + 1, 'url' => TF_SITE . '/p/' . $p['id'], 'name' => $p['name']['fa']];
    }
    return ['@type' => 'ItemList', 'numberOfItems' => count($out), 'itemListElement' => $out];
}

$kind = (string) ($_GET['k'] ?? '');
$id = (string) ($_GET['id'] ?? '');

/* ------------------------------------------------------------- a piece */
if ($kind === 'p') {
    if (!preg_match('/^[a-z0-9][a-z0-9-]{1,60}$/', $id)) {
        not_found();
    }
    $p = tf_product($id);
    if (!$p || empty($p['visible']) || empty($p['images'])) {
        not_found();
    }
    [$cols, $colsEn, $fab, $col] = piece_facts($p);
    $name = (string) $p['name']['fa'];
    $nameEn = (string) ($p['name']['en'] ?? '');
    $price = (int) $p['price'];
    $url = TF_SITE . '/p/' . $p['id'];
    $soldout = is_array($p['stock'] ?? null) && array_sum(array_map('intval', $p['stock'])) <= 0;
    $desc = $name . ($fab !== '' ? '؛ جنس ' . $fab : '') . '، رنگ: ' . $cols . '، سایز: ' . tf_sizes_fa($p['sizes'])
        . '. قیمت ' . tf_toman_fa($price) . ($col ? '. از کالکشن ' . $col[0] . ' (' . TF_SEASON_FA . ')' : '')
        . ' تیفانی؛ ارسال رایگان با پست به سراسر ایران.';
    $images = array_map('product_img', $p['images']);
    $ldp = [
        '@context' => 'https://schema.org', '@type' => 'Product',
        'name' => $name, 'alternateName' => $nameEn,
        'description' => $desc, 'sku' => $p['id'], 'url' => $url, 'image' => $images,
        'brand' => ['@type' => 'Brand', 'name' => TF_BRAND],
        'category' => TF_CAT_FA[$p['cat']] ?? '',
        'color' => $cols,
        'size' => tf_sizes_fa($p['sizes']),
        'offers' => [
            '@type' => 'Offer', 'url' => $url, 'priceCurrency' => 'IRR', 'price' => $price * 10,
            'availability' => $soldout ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            'itemCondition' => 'https://schema.org/NewCondition',
            'seller' => ['@type' => 'Organization', 'name' => TF_BRAND, 'url' => TF_SITE],
            'shippingDetails' => [
                '@type' => 'OfferShippingDetails',
                'shippingRate' => ['@type' => 'MonetaryAmount', 'value' => 0, 'currency' => 'IRR'],
                'shippingDestination' => ['@type' => 'DefinedRegion', 'addressCountry' => 'IR'],
                'deliveryTime' => ['@type' => 'ShippingDeliveryTime',
                    'handlingTime' => ['@type' => 'QuantitativeValue', 'minValue' => 0, 'maxValue' => 1, 'unitCode' => 'DAY'],
                    'transitTime' => ['@type' => 'QuantitativeValue', 'minValue' => 1, 'maxValue' => 3, 'unitCode' => 'DAY']],
            ],
        ],
    ];
    if ($fab !== '') {
        $ldp['material'] = $fab;
    }
    $crumbs = [[TF_BRAND, TF_SITE . '/']];
    if ($col) {
        $crumbs[] = [$col[0], TF_SITE . '/c/' . $p['col']];
    }
    $crumbs[] = [$name, $url];
    $note = (string) ($p['note']['fa'] ?? '');
    $body = '<article class="ssr" dir="rtl" lang="fa">'
        . '<nav aria-label="مسیر"><a href="/">TIFFANY</a>'
        . ($col ? ' › <a href="/c/' . h($p['col']) . '">' . h($col[0]) . '</a>' : '') . ' › ' . h($name) . '</nav>'
        . '<h1>' . h($name) . '</h1>'
        . '<p lang="en" dir="ltr">' . h($nameEn) . ' — ' . h(TF_BRAND) . '</p>'
        . '<img src="' . h(abs_img($p['images'][0])) . '" alt="' . h($name) . '" width="960" height="1200">'
        . '<p>قیمت: ' . h(tf_toman_fa($price)) . '</p>'
        . '<ul>'
        . ($fab !== '' ? '<li>جنس: ' . h($fab) . '</li>' : '')
        . '<li>رنگ: ' . h($cols) . '</li>'
        . '<li>سایز: ' . h(tf_sizes_fa($p['sizes'])) . '</li>'
        . '<li>دسته: ' . h(TF_CAT_FA[$p['cat']] ?? '') . '</li>'
        . ($col ? '<li>کالکشن: <a href="/c/' . h($p['col']) . '">' . h($col[0]) . '</a> (' . h(TF_SEASON_FA) . ')</li>' : '')
        . '</ul>'
        . ($note !== '' ? '<p>' . h($note) . '</p>' : '')
        . '<p>ارسال رایگان با پست به سراسر ایران، حداکثر سه روز کاری. استعلام از واتساپ: <span dir="ltr">' . h(TF_WHATSAPP) . '</span></p>'
        . '</article>';
    seo_shell(200, [
        'title' => $name . ' | ' . TF_BRAND, 'desc' => $desc, 'canonical' => $url, 'ogtype' => 'product',
        'image' => abs_img($p['images'][0]), 'ld' => ld($ldp) . ld(breadcrumb($crumbs)), 'body' => $body,
    ]);
}

/* -------------------------------------------------------- a collection */
if ($kind === 'c') {
    $col = TF_COLLECTIONS[$id] ?? null;
    if (!$col) {
        not_found();
    }
    $all = tf_products(true);
    $own = array_values(array_filter($all, static fn ($p) => $p['col'] === $id && !empty($p['images'])));
    $url = TF_SITE . '/c/' . $id;
    $title = $col[0] . ' — کالکشن ' . TF_SEASON_FA . ' | ' . TF_BRAND;
    $desc = 'کالکشن ' . $col[0] . ' تیفانی (' . TF_SEASON_FA . '): ' . $col[2] . ' ' . tf_fa_num((string) count($own))
        . ' محصول، ارسال رایگان با پست به سراسر ایران.';
    $ldc = ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => $col[0] . ' — ' . TF_BRAND,
        'description' => $desc, 'url' => $url, 'image' => abs_img($col[1]), 'inLanguage' => 'fa',
        'isPartOf' => ['@type' => 'WebSite', 'name' => TF_BRAND, 'url' => TF_SITE], 'mainEntity' => item_list($own)];
    $body = '<article class="ssr" dir="rtl" lang="fa">'
        . '<nav aria-label="مسیر"><a href="/">TIFFANY</a> › <a href="/shop">فروشگاه</a> › ' . h($col[0]) . '</nav>'
        . '<h1 lang="en" dir="ltr">' . h($col[0]) . '</h1>'
        . '<p>' . h(TF_SEASON_FA) . ' — ' . h($col[2]) . '</p>'
        . '<p lang="en" dir="ltr">' . h($col[3]) . '</p>'
        . '<img src="' . h(abs_img($col[1])) . '" alt="' . h($col[0]) . '" width="960" height="1280">'
        . '<ul>' . implode('', array_map('piece_card', $own)) . '</ul></article>';
    seo_shell(200, [
        'title' => $title, 'desc' => $desc, 'canonical' => $url, 'image' => abs_img($col[1]),
        'ld' => ld($ldc) . ld(breadcrumb([[TF_BRAND, TF_SITE . '/'], ['فروشگاه', TF_SITE . '/shop'], [$col[0], $url]])),
        'body' => $body,
    ]);
}

/* --------------------------------------------------------- every piece */
if ($kind === 'shop') {
    $all = array_values(array_filter(tf_products(true), static fn ($p) => !empty($p['images'])));
    $url = TF_SITE . '/shop';
    $desc = 'همه‌ی محصول‌های تیفانی (' . TF_SEASON_FA . '): کاپشن و بارونی چرم، پالتو، بافت پشمی، شومیز، شلوار جین و اویشو، دامن، کیف، کلاه و باندانا. '
        . tf_fa_num((string) count($all)) . ' محصول، ارسال رایگان با پست به سراسر ایران.';
    $body = '<article class="ssr" dir="rtl" lang="fa"><nav aria-label="مسیر"><a href="/">TIFFANY</a> › فروشگاه</nav>'
        . '<h1>فروشگاه تیفانی</h1><p>' . h($desc) . '</p><h2>کالکشن‌ها</h2><ul>';
    foreach (TF_COLLECTIONS as $cid => $c) {
        $body .= '<li><a href="/c/' . h($cid) . '">' . h($c[0]) . '</a> — ' . h($c[2]) . '</li>';
    }
    $body .= '</ul><h2>محصول‌ها</h2><ul>' . implode('', array_map('piece_card', $all)) . '</ul></article>';
    $lds = ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => 'فروشگاه ' . TF_BRAND,
        'description' => $desc, 'url' => $url, 'inLanguage' => 'fa', 'mainEntity' => item_list($all)];
    seo_shell(200, [
        'title' => 'فروشگاه | ' . TF_BRAND, 'desc' => $desc, 'canonical' => $url,
        'ld' => ld($lds) . ld(breadcrumb([[TF_BRAND, TF_SITE . '/'], ['فروشگاه', $url]])), 'body' => $body,
    ]);
}

/* -------------------------------------------------------------- sitemap */
if ($kind === 'sitemap') {
    $all = array_values(array_filter(tf_products(true), static fn ($p) => !empty($p['images'])));
    $x = static fn (string $s) => htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $lastAll = 0;
    foreach ($all as $p) {
        $lastAll = max($lastAll, (int) ($p['updated_at'] ?? 0));
    }
    $day = static fn (int $t) => $t > 0 ? gmdate('Y-m-d', $t) : gmdate('Y-m-d');
    $out = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
    $url = static function (string $loc, int $t, array $imgs = []) use ($x, $day): string {
        $s = '<url><loc>' . $x($loc) . '</loc><lastmod>' . $day($t) . '</lastmod>';
        foreach ($imgs as $i) {
            $s .= '<image:image><image:loc>' . $x($i) . '</image:loc></image:image>';
        }
        return $s . "</url>\n";
    };
    $out .= $url(TF_SITE . '/', $lastAll, [TF_SITE . '/media/hero-3-poster.webp']);
    $out .= $url(TF_SITE . '/shop', $lastAll);
    foreach (TF_COLLECTIONS as $cid => $c) {
        $out .= $url(TF_SITE . '/c/' . $cid, $lastAll, [abs_img($c[1])]);
    }
    foreach ($all as $p) {
        $out .= $url(TF_SITE . '/p/' . $p['id'], (int) ($p['updated_at'] ?? 0), array_map('product_img', $p['images']));
    }
    $out .= "</urlset>\n";
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo $out;
    exit;
}

/* ------------------------------------------------------------- llms.txt */
/* The shop in plain words for AI assistants (llmstxt.org): what TIFFANY is,
   the collections, every piece with its price, the shops, how to reach us. */
if ($kind === 'llms') {
    $all = array_values(array_filter(tf_products(true), static fn ($p) => !empty($p['images'])));
    $cb = tf_cashback_rule();
    $t = "# TIFFANY by Vanda\n\n"
        . "> TIFFANY by Vanda (تیفانی) is an Iranian womenswear brand with a modern, young, city style, founded in 2020 (1399). "
        . "It has shops in Tehran and Tabriz and sells online at " . TF_SITE . ". Prices are in Iranian toman. Orders are sent by "
        . "Iran Post, free to anywhere in Iran, and arrive within three working days at most. "
        . ($cb['on'] ? 'Orders of ' . number_format($cb['min']) . ' toman or more earn ' . $cb['pct']
            . '% of the amount paid as TIFFANY credit for later orders (with an account). ' : '')
        . "The current collection is Autumn / Winter 2027.\n\n"
        . "- Shop: " . TF_SITE . "/shop\n- Instagram: " . TF_INSTAGRAM . "\n- WhatsApp (questions about a piece): " . TF_WHATSAPP
        . "\n- Email: " . TF_EMAIL . "\n\n## Collections (Autumn / Winter 2027)\n\n";
    foreach (TF_COLLECTIONS as $cid => $c) {
        $t .= '- [' . $c[0] . '](' . TF_SITE . '/c/' . $cid . '): ' . $c[3] . "\n";
    }
    $t .= "\n## Pieces\n\n";
    foreach ($all as $p) {
        [$cols, $colsEn, $fab] = piece_facts($p);
        $fabEn = (string) ($p['fabric']['en'] ?? '');
        $t .= '- [' . $p['name']['en'] . ' / ' . $p['name']['fa'] . '](' . TF_SITE . '/p/' . $p['id'] . '): '
            . number_format((int) $p['price']) . ' toman; ' . (TF_CAT_EN[$p['cat']] ?? $p['cat'])
            . ($fabEn !== '' ? '; ' . $fabEn : '') . '; colours: ' . $colsEn . '; sizes: ' . tf_sizes_en($p['sizes'])
            . (isset(TF_COLLECTIONS[$p['col']]) ? '; collection: ' . TF_COLLECTIONS[$p['col']][0] : '') . "\n";
    }
    $t .= "\n## Shops\n\n";
    foreach (TF_STORES as $s) {
        $t .= '- ' . $s[1] . ' (' . $s[3] . '): ' . $s[5] . ($s[6] !== '' ? '; phone ' . $s[6] : '') . "\n";
    }
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo $t;
    exit;
}

not_found();
