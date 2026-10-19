<?php
/* A stand-in for tayidshod.ir (API v1), for the test suites only (never deployed):
     TZ_MOCK_STATE=/tmp/tz.json php -S 127.0.0.1:8141 tests/tayidshod_mock.php

   The real API, as its docs describe it:
     GET  /api/v1/account             shop_name, mode, live_orders {open, reason}
     POST /api/v1/orders              unique pay_amount (amount + 11..999), pay_url, status pending
     GET  /api/v1/orders/{id}
     POST /api/v1/orders/{id}/cancel
   A key starting sk_live_REVOKED is refused (401). Every request is logged.

   Test controls (POST JSON):
     /mock/set   {id, status?, mode?, pay_amount?, deposit?}   change an order as tayidshod would
     /mock/hook  {id, event, secret, sig?, body?}             send a signed webhook to the
                 order's callback_url; answers with the shop's status and body
     /mock/next  {fail?: code, http?: n, pay_amount_delta?: n, pay_url?: url, mode?: m,
                  closed?: reason}                            how the next calls misbehave
     /mock/log                                                every request so far
   /p/{id} is a plain payment page. */
declare(strict_types=1);

$file = (string) getenv('TZ_MOCK_STATE');
$S = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
$S += ['orders' => [], 'log' => [], 'next' => []];
$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$raw = (string) file_get_contents('php://input');
$body = json_decode($raw, true);
$auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

$save = static function () use (&$S, $file): void {
    file_put_contents($file, json_encode($S, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
};
$out = static function (int $code, $data) use (&$S, $save): void {
    $save();
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
};
$err = static function (int $code, string $c, string $m) use ($out): void {
    $out($code, ['error' => ['code' => $c, 'message' => $m]]);
};
$base = 'http://' . ($_SERVER['HTTP_HOST'] ?? '127.0.0.1:8141');

if (strpos($path, '/mock/') !== 0) {
    $S['log'][] = ['method' => $method, 'path' => $path, 'auth' => $auth, 'body' => $body, 'at' => time()];
}

if (preg_match('#^/p/(ord_\w+)$#', $path, $m)) {
    $save();
    header('Content-Type: text/html; charset=utf-8');
    $o = $S['orders'][$m[1]] ?? null;
    echo '<!doctype html><meta charset="utf-8"><title>tayidshod mock</title><h1>پرداخت ' . ($o ? $o['pay_amount'] : '?') . '</h1>';
    if ($o && $o['return_url']) {
        echo '<a id="back" href="' . htmlspecialchars($o['return_url']) . '">برگشت به فروشگاه</a>';
    }
    exit;
}

/* ------------------------------------------------------------ controls */
if ($path === '/mock/log') {
    $out(200, $S['log']);
}
if ($path === '/mock/next') {
    $S['next'] = is_array($body) ? $body : [];
    $out(200, ['ok' => true]);
}
if ($path === '/mock/set') {
    $id = (string) ($body['id'] ?? '');
    if (!isset($S['orders'][$id])) {
        $out(404, ['ok' => false]);
    }
    foreach (['status', 'mode', 'pay_amount', 'deposit'] as $f) {
        if (array_key_exists($f, $body)) {
            $S['orders'][$id][$f] = $body[$f];
        }
    }
    $out(200, $S['orders'][$id]);
}
if ($path === '/mock/hook') {
    $id = (string) ($body['id'] ?? '');
    $o = $S['orders'][$id] ?? ['id' => $id];
    $event = (string) ($body['event'] ?? 'ping');
    $payload = $body['body'] ?? ['id' => 'evt_' . bin2hex(random_bytes(6)), 'event' => $event,
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'), 'mode' => $o['mode'] ?? 'live', 'order' => $o];
    $json = is_string($payload) ? $payload : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $sig = $body['sig'] ?? ('sha256=' . hash_hmac('sha256', $json, (string) ($body['secret'] ?? '')));
    $to = (string) ($body['to'] ?? ($o['callback_url'] ?? ''));
    $ch = curl_init($to);
    $h = ['Content-Type: application/json', 'X-Tayidshod-Event: ' . $event, 'X-Tayidshod-Delivery: evt_x'];
    if ($sig !== null && $sig !== '') {
        $h[] = 'X-Tayidshod-Signature: ' . $sig;
    }
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_HTTPHEADER => $h,
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $out(200, ['status' => $code, 'body' => json_decode((string) $res, true) ?? $res]);
}

/* ------------------------------------------------------------------ API */
if (!preg_match('/^Bearer (sk_(live|test)_\w+)$/', $auth, $km) || strpos($km[1], 'sk_live_REVOKED') === 0) {
    $err(401, 'unauthorized', 'کلید API درست نیست.');
}
$mode = $km[2];
$next = $S['next'];
if (!empty($next['fail'])) {
    $S['next'] = [];
    $err((int) ($next['http'] ?? 402), (string) $next['fail'], 'خطای آزمایشی ' . $next['fail']);
}

if ($path === '/api/v1/account' && $method === 'GET') {
    $closed = (string) ($next['closed'] ?? '');
    $out(200, ['shop_name' => 'تیفانی (آزمایشی)', 'mode' => $mode,
        'live_orders' => ['open' => $closed === '', 'reason' => $closed ?: null], 'cards' => []]);
}

if ($path === '/api/v1/orders' && $method === 'POST') {
    $amount = (int) ($body['amount'] ?? 0);
    if ($amount < 1000) {
        $err(422, 'invalid_amount', 'مبلغ کمتر از ۱٬۰۰۰ تومان است.');
    }
    $oid = (string) ($body['order_id'] ?? '');
    foreach ($S['orders'] as $o) {
        if ($oid !== '' && $o['order_id'] === $oid && $o['key_mode'] === $mode) {
            if ($o['amount'] !== $amount) {
                $err(409, 'duplicate_order_id', 'شناسه‌ی سفارش تکراری است.');
            }
            if (in_array($o['status'], ['pending', 'claimed', 'mismatch'], true)) {
                $out(200, $o);
            }
        }
    }
    $id = 'ord_' . bin2hex(random_bytes(7));
    $pay = $amount + random_int(11, 999) + (int) ($next['pay_amount_delta'] ?? 0);
    $o = ['id' => $id, 'order_id' => $oid, 'mode' => $next['mode'] ?? $mode, 'key_mode' => $mode, 'status' => 'pending',
        'amount' => $amount, 'pay_amount' => $pay, 'pay_amount_rial' => $pay * 10, 'currency' => 'IRT',
        'pay_url' => $next['pay_url'] ?? ($base . '/p/' . $id),
        'card' => ['number' => '6219861000001239', 'holder' => 'تیفانی', 'bank' => 'سامان', 'sheba' => null],
        'description' => $body['description'] ?? null, 'customer' => $body['customer'] ?? null,
        'callback_url' => $body['callback_url'] ?? null, 'return_url' => $body['return_url'] ?? null,
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'), 'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 60 * (int) ($body['expires_in'] ?? 30)),
        'paid_at' => null, 'claimed_at' => null, 'decided_at' => null, 'deposit' => null];
    $S['orders'][$id] = $o;
    $S['next'] = [];
    $out(201, $o);
}

if (preg_match('#^/api/v1/orders/(ord_\w+)(/cancel)?$#', $path, $m)) {
    $o = $S['orders'][$m[1]] ?? null;
    if (!$o || $o['key_mode'] !== $mode) {
        $err(404, 'not_found', 'سفارش پیدا نشد.');
    }
    if (!empty($m[2])) {
        if (!in_array($o['status'], ['pending', 'claimed', 'mismatch', 'rejected'], true)) {
            $err(409, 'not_cancelable', 'سفارش دیگر باز نیست.');
        }
        $S['orders'][$m[1]]['status'] = 'canceled';
        $out(200, $S['orders'][$m[1]]);
    }
    $out(200, $o);
}

$err(404, 'not_found', 'مسیر پیدا نشد.');
