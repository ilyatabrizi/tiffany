<?php
/* GET /api/pay.php — the shop's side of card-to-card («تأیید شد»).

     a=state             may this checkout offer card-to-card? (and is it a test key)
     a=status&o=&k=      one order's payment, looked up fresh at tayidshod (JSON)
     a=go&o=&k=          to the order's payment page while it still has a use,
                         otherwise to the Orders tab
     a=back&o=&k=        where tayidshod's «برگشت به فروشگاه» lands: looks
                         again, then the Orders tab shows the answer

   o is the order code and k the order's own payment token (tz_token), which
   only the phone that placed the order holds; a wrong pair learns nothing.
   The money itself is only ever marked by tayidshod's signed webhook or by
   this server asking tayidshod, never by anything in these links. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    tf_fail(405, 'method');
}
$a = (string) ($_GET['a'] ?? '');

if ($a === 'state') {
    $on = tz_available();
    tf_json(['ok' => true, 'c2c' => $on, 'test' => $on && tz_mode() === 'test']);
}
if (!in_array($a, ['status', 'go', 'back'], true)) {
    tf_fail(400, 'unknown_action');
}

/** Back into the shop, on the Orders tab, with the order and its token for
    the page to ask about (in the fragment: it never reaches a server log or
    another site's Referer). */
function to_orders(?array $o): void
{
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    $to = '/#/orders';
    if ($o) {
        $to .= '?pay=' . rawurlencode((string) $o['code']) . '&k=' . tz_token((string) $o['code']);
    }
    header('Location: ' . $to, true, 302);
    exit;
}

$code = (string) ($_GET['o'] ?? '');
$k = (string) ($_GET['k'] ?? '');
if (tf_too_many('pay:' . tf_ip_key(), 120, 3600)) {
    $a === 'status' ? tf_fail(429, 'too_many') : to_orders(null);
}
tf_note_attempt('pay:' . tf_ip_key());
$o = preg_match('/^TF-\d{5}$/', $code) && preg_match('/^[a-f0-9]{24}$/', $k) && hash_equals(tz_token($code), $k)
    ? tz_order($code) : null;

if ($a === 'status') {
    if (!$o) {
        tf_fail(404, 'not_found');
    }
    tf_json(['ok' => true, 'order' => tz_public(tz_refresh($o))]);
}

if (!$o) {
    to_orders(null);
}
$o = tz_refresh($o);
if ($a === 'go' && tz_public($o)['page']) {
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    header('Location: ' . $o['pay_url'], true, 302);
    exit;
}
to_orders($o);
