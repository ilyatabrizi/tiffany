<?php
/* POST /api/order.php — a customer places an order.

   Only while the CEO has switched ordering on (Settings in the panel).
   Prices, names and stock come from the database, never from the browser:
   the bag only says which piece, which size, which colour and how many, and
   how it will be paid (pay: card on delivery, or c2c — card-to-card now
   through «تأیید شد»; the answer then carries the payment page), and whether
   to spend the account's cashback credit (use_credit). */
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
$province = tf_line($in['province'] ?? '', 40);
$city = tf_line($in['city'] ?? '', 40);
$address = tf_text($in['address'] ?? '', 300);
$postal = preg_replace('/[^0-9]/', '', tf_digits((string) ($in['postal'] ?? ''))) ?? '';
$note = tf_text($in['note'] ?? '', 300);
/* card: by card on delivery. c2c: card-to-card now, through «تأیید شد»
   (api/lib/pay.php), only while the CEO has it switched on and it works. */
$pay = ($in['pay'] ?? 'card') === 'c2c' ? 'c2c' : 'card';
/* Signed in, the order is the account's: it earns cashback (api/lib/shop.php)
   and may spend the account's credit — which only the account itself can ask
   for, so that needs its CSRF token too. */
$me = tf_customer();
$useCredit = !empty($in['use_credit']);
/* The balance the phone showed; if the account's balance has moved since
   (spent on another phone, a return), the order is refused and the phone
   shows the new one, rather than charging something the customer never saw. */
$expectBalance = array_key_exists('expect_balance', $in) ? max(0, tf_int($in['expect_balance'])) : null;
if ($useCredit) {
    if (!$me) {
        throw new TfInvalid('credit', 'برای استفاده از اعتبار اول وارد حسابت شو.');
    }
    tf_require_csrf();
}

/* What Iran Post needs on the parcel: the full name (first and last), a
   mobile number, the province and city, the full address, and the ten-digit
   postal code. */
if (mb_strlen($name) < 4 || count(preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY)) < 2) {
    throw new TfInvalid('name', 'اسم و فامیل رو کامل بنویس.');
}
if ($phone === '') {
    throw new TfInvalid('phone', 'شماره موبایل درست نیست.');
}
if (!in_array($province, TF_PROVINCES, true)) {
    throw new TfInvalid('province', 'استان رو انتخاب کن.');
}
if (mb_strlen($city) < 2) {
    throw new TfInvalid('city', 'شهر رو بنویس.');
}
if (mb_strlen($address) < 10) {
    throw new TfInvalid('address', 'آدرس کامل رو بنویس: خیابون، کوچه، پلاک و واحد.');
}
if (strlen($postal) !== 10 || preg_match('/^(\d)\1{9}$/', $postal)) {
    throw new TfInvalid('postal', 'کد پستی ۱۰ رقمی رو درست بنویس.');
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
/* A card-to-card order whose payment page ran out (or was closed or
   refused) does not hold the number back; tz_sweep cancels it in time. */
$open = db()->prepare("SELECT COUNT(*) FROM orders WHERE phone = ? AND status = 'new'
                       AND NOT (pay = 'c2c' AND paid = 0 AND pay_state IN ('expired', 'canceled', 'rejected'))");
$open->execute([$phone]);
$pending = (int) $open->fetchColumn();
$open->closeCursor();
if ($pending >= 3) {
    throw new TfInvalid('pending', 'برای این شماره چند سفارش منتظر تأییده؛ تیم تیفانی به‌زودی باهات تماس می‌گیره.');
}
/* Asked here, before the lock (it may ask tayidshod); refused below, once it
   is known whether anything is left to pay after the credit. */
$c2cOff = $pay === 'c2c' && !tz_available(true);

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
    $gross = $subtotal + $shipping;
    /* The balance is read inside this lock: two orders sent together cannot
       both spend the same credit. Credit covering everything leaves nothing
       to pay, and the order is marked paid by credit. */
    $cid = $me ? (int) $me['id'] : 0;
    $balance = $useCredit && $cid ? max(0, tf_credit($cid)['balance']) : 0;
    if ($useCredit && $expectBalance !== null && $balance !== $expectBalance) {
        throw new TfInvalid('credit_changed', 'اعتبار حسابت همین الان تغییر کرده؛ مبلغ جدید رو ببین و دوباره ثبت کن.');
    }
    $credit = min($balance, $gross);
    $total = $gross - $credit;
    /* Card-to-card takes 1,000 toman at least: a few hundred left after the
       credit would fall back to paying at the door, so a little less credit
       is spent and 1,000 is paid now. */
    if ($pay === 'c2c' && $total > 0 && $total < 1000 && $gross >= 1000) {
        $credit = $gross - 1000;
        $total = 1000;
    }
    if ($total === 0) {
        $pay = 'credit';
    } elseif ($c2cOff) {
        throw new TfInvalid('pay', 'کارت‌به‌کارت همین الان در دسترس نیست؛ «کارت، موقع تحویل» رو انتخاب کن.');
    }
    $cashback = tf_cashback_for($gross, $total, $cid);
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
    $db->prepare('INSERT INTO orders (code, status, name, phone, province, city, address, postal, pay, items,
                  subtotal, shipping, total, note, day, created_at, updated_at, customer_id, credit, cashback)
                  VALUES (?, \'new\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$code, $name, $phone, $province, $city, $address, $postal, $pay,
            json_encode($items, JSON_UNESCAPED_UNICODE), $subtotal, $shipping, $total, $note,
            date('Y-m-d', $now), $now, $now, $cid, $credit, $cashback]);
    $db->exec('COMMIT');
} catch (Throwable $e) {
    $db->exec('ROLLBACK');
    throw $e;
}
tf_note_attempt('order:ok:' . tf_ip_key());
tf_after(static function () use ($code, $name, $phone, $total): void {
    tf_sms_order_placed($code, $name, $phone, $total);
    tz_sweep();                         // unpaid card-to-card orders past their time, put back (at most every 10 min)
});

$out = ['ok' => true, 'code' => $code, 'status' => 'new', 'total' => $total,
    'subtotal' => $subtotal, 'shipping' => $shipping, 'created_at' => $now, 'pay' => $pay,
    'credit' => $credit, 'cashback' => $cashback,
    'balance' => $cid ? tf_credit_public($cid) : null,
    'items' => array_map(static fn ($i) => ['id' => $i['id'], 'size' => $i['size'], 'colour' => $i['colour'],
        'qty' => $i['qty'], 'price' => $i['price']], $items)];
/* The order is in; now its payment page. If tayidshod cannot make one, the
   order stays and is paid on delivery, and the customer is told so. */
if ($pay === 'c2c') {
    $row = tz_order($code);
    $started = $row ? tz_start($row) : ['ok' => false];
    if ($started['ok']) {
        $out += ['pay_url' => $started['pay_url'], 'pay_key' => tz_token($code), 'pay_state' => 'pending'];
    } else {
        $out['pay'] = 'card';
        if (empty($started['gone'])) {
            $out['pay_note'] = 'fallback';
        }
    }
}
tf_json($out);
