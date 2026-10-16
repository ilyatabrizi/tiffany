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
/* Many Iranian phones share one public address behind the carrier, so tries
   are counted loosely (60 an hour) and placed orders a little tighter (15 an
   hour per address, 3 still unconfirmed per phone number). */
tf_throttle('order:try:' . tf_ip_key(), 60, 3600);
if (tf_too_many('order:ok:' . tf_ip_key(), 15, 3600)) {
    tf_fail(429, 'too_many');
}

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

/* One line per piece/size/colour, quantities merged: at most TF_LINE_MAX of
   one line and TF_ORDER_MAX pieces in one order, so a single order cannot
   empty the shelves. */
$want = [];
$units = 0;
foreach (array_slice((array) ($in['items'] ?? []), 0, 40) as $it) {
    if (!is_array($it)) {
        continue;
    }
    $id = (string) ($it['id'] ?? '');
    $size = (string) ($it['size'] ?? '');
    $colour = strtoupper((string) ($it['colour'] ?? ''));
    $qty = (int) ($it['qty'] ?? 0);
    if ($qty < 1) {
        continue;
    }
    $key = "$id|$size|$colour";
    $want[$key] = ['id' => $id, 'size' => $size, 'colour' => $colour,
        'qty' => ($want[$key]['qty'] ?? 0) + $qty];
    if ($want[$key]['qty'] > TF_LINE_MAX) {
        throw new TfInvalid('count', 'از هر قطعه حداکثر ' . TF_LINE_MAX . ' تا می‌شه گرفت.');
    }
}
foreach ($want as $w) {
    $units += $w['qty'];
}
if (!$want) {
    throw new TfInvalid('items', 'سبدت خالیه.');
}
if ($units > TF_ORDER_MAX) {
    throw new TfInvalid('count', 'توی هر سفارش حداکثر ' . TF_ORDER_MAX . ' قطعه می‌شه گرفت.');
}
$open = db()->prepare("SELECT COUNT(*) FROM orders WHERE phone = ? AND status = 'new'");
$open->execute([$phone]);
$pending = (int) $open->fetchColumn();
$open->closeCursor();
if ($pending >= 3) {
    throw new TfInvalid('pending', 'برای این شماره چند سفارش منتظر تأییده؛ تیم تیفانی به‌زودی باهات تماس می‌گیره.');
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
    $tries = 0;
    do {
        if (++$tries > 60) {
            throw new RuntimeException('no free order code');
        }
        $code = 'TF-' . random_int(10000, 99999);
        $exists->execute([$code]);
        $taken = $exists->fetchColumn();
        $exists->closeCursor();
    } while ($taken);

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
tf_note_attempt('order:ok:' . tf_ip_key());

tf_json(['ok' => true, 'code' => $code, 'status' => 'new', 'total' => $total,
    'subtotal' => $subtotal, 'shipping' => $shipping, 'created_at' => $now,
    'items' => array_map(static fn ($i) => ['id' => $i['id'], 'size' => $i['size'], 'colour' => $i['colour'],
        'qty' => $i['qty'], 'price' => $i['price']], $items)]);
