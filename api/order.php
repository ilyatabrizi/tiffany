<?php
/* POST /api/order.php — a customer places an order.

   Only while the CEO has switched ordering on (Settings in the panel).
   Prices, names and stock come from the database, never from the browser:
   the bag only says which piece, which size, which colour and how many. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
tf_same_origin();
$in = tf_input();

if (!empty($in['website'])) {          // honeypot: people never fill this in
    tf_fail(400, 'invalid');
}
if (setting('store_open', '0') !== '1') {
    tf_fail(403, 'closed');
}
tf_throttle('order:' . tf_ip(), 8, 3600);

$name = tf_line($in['name'] ?? '', 60);
$phone = tf_phone($in['phone'] ?? '');
$city = tf_line($in['city'] ?? '', 40);
$address = tf_text($in['address'] ?? '', 300);
$postal = preg_replace('/[^0-9]/', '', tf_digits((string) ($in['postal'] ?? ''))) ?? '';
$note = tf_text($in['note'] ?? '', 300);
$pay = 'card';                          // online payment arrives with the gateway

if (mb_strlen($name) < 2) {
    throw new TfInvalid('name', 'اسم و فامیل رو بنویس.');
}
if ($phone === '') {
    throw new TfInvalid('phone', 'شماره موبایل درست نیست.');
}
if (mb_strlen($city) < 2) {
    throw new TfInvalid('city', 'شهر رو بنویس.');
}
if (mb_strlen($address) < 8) {
    throw new TfInvalid('address', 'آدرس کامل رو بنویس.');
}
if ($postal !== '' && strlen($postal) !== 10) {
    throw new TfInvalid('postal', 'کد پستی ۱۰ رقمیه.');
}

/* One line per piece/size/colour, quantities merged. */
$want = [];
foreach (array_slice((array) ($in['items'] ?? []), 0, 40) as $it) {
    if (!is_array($it)) {
        continue;
    }
    $id = (string) ($it['id'] ?? '');
    $size = (string) ($it['size'] ?? '');
    $colour = strtoupper((string) ($it['colour'] ?? ''));
    $qty = (int) ($it['qty'] ?? 0);
    if ($qty < 1 || $qty > 9) {
        continue;
    }
    $key = "$id|$size|$colour";
    $want[$key] = ['id' => $id, 'size' => $size, 'colour' => $colour,
        'qty' => min(9, ($want[$key]['qty'] ?? 0) + $qty)];
}
if (!$want) {
    throw new TfInvalid('items', 'سبدت خالیه.');
}

$db = db();
$db->exec('BEGIN IMMEDIATE');
try {
    $items = [];
    $subtotal = 0;
    $touched = [];
    foreach ($want as $w) {
        $p = $touched[$w['id']] ?? tf_product($w['id']);
        if (!$p || !$p['visible']) {
            throw new TfInvalid('items', 'یکی از محصول‌های سبدت دیگه موجود نیست.');
        }
        if (!in_array($w['size'], $p['sizes'], true)) {
            throw new TfInvalid('items', 'سایز یکی از محصول‌ها درست نیست.');
        }
        $colour = null;
        foreach ($p['colours'] as $c) {
            if ($c['hex'] === $w['colour']) {
                $colour = $c;
            }
        }
        if ($p['colours'] && !$colour) {
            throw new TfInvalid('items', 'رنگ یکی از محصول‌ها درست نیست.');
        }
        if (is_array($p['stock'] ?? null)) {
            $left = (int) ($p['stock'][$w['size']] ?? 0);
            if ($left < $w['qty']) {
                throw new TfInvalid('items', $p['name']['fa'] . ' سایز ' . $w['size']
                    . ($left > 0 ? " فقط $left تا مونده." : ' تموم شده.'));
            }
            $p['stock'][$w['size']] = $left - $w['qty'];
            $touched[$p['id']] = $p;
        }
        $line = (int) $p['price'] * $w['qty'];
        $subtotal += $line;
        $items[] = [
            'id' => $p['id'], 'name' => $p['name']['fa'], 'cat' => $p['cat'],
            'img' => $p['images'][0] ?? '', 'size' => $w['size'],
            'colour' => $colour ? $colour['hex'] : '', 'colour_name' => $colour ? $colour['fa'] : '',
            'qty' => $w['qty'], 'price' => (int) $p['price'], 'line' => $line,
        ];
    }
    foreach ($touched as $p) {
        tf_product_store($p);
    }

    $shipping = (int) tf_public_settings()['shipping'];
    $total = $subtotal + $shipping;
    $exists = $db->prepare('SELECT 1 FROM orders WHERE code = ?');
    do {
        $code = 'TF-' . random_int(10000, 99999);
        $exists->execute([$code]);
    } while ($exists->fetchColumn());

    $now = time();
    $db->prepare('INSERT INTO orders (code, status, name, phone, city, address, postal, pay, items,
                  subtotal, shipping, total, note, day, created_at, updated_at)
                  VALUES (?, \'new\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$code, $name, $phone, $city, $address, $postal, $pay,
            json_encode($items, JSON_UNESCAPED_UNICODE), $subtotal, $shipping, $total, $note,
            date('Y-m-d', $now), $now, $now]);
    $db->exec('COMMIT');
} catch (Throwable $e) {
    $db->exec('ROLLBACK');
    throw $e;
}

tf_json(['ok' => true, 'code' => $code, 'status' => 'new', 'total' => $total,
    'subtotal' => $subtotal, 'shipping' => $shipping, 'created_at' => $now]);
