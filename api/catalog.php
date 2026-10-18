<?php
/* GET /api/catalog.php — the shop's live catalogue: every visible product in
   all three languages, plus whether ordering is switched on. Revalidated on
   every visit (ETag), so a price changed in the panel shows up at once. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    tf_fail(405, 'method');
}

$products = array_map(static function (array $p): array {
    // Sold-out sizes are public; exact stock counts are not.
    $soldout = [];
    if (is_array($p['stock'] ?? null)) {
        foreach ($p['stock'] as $size => $n) {
            if ((int) $n <= 0) {
                $soldout[] = $size;
            }
        }
    }
    unset($p['stock'], $p['visible'], $p['sort'], $p['created_at'], $p['updated_at']);
    $p['soldout'] = $soldout;
    return $p;
}, tf_products(true));

/* The panel's stories that are still inside their 24 hours. The answer
   changes the moment one runs out, so the ETag moves with it. */
$body = json_encode(['ok' => true, 'products' => $products, 'settings' => tf_public_settings(),
    'stories' => tf_stories_live()],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$etag = '"' . substr(hash('sha256', $body), 0, 24) . '"';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
header('ETag: ' . $etag);
header('X-Content-Type-Options: nosniff');
if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
    http_response_code(304);
    exit;
}
echo $body;
