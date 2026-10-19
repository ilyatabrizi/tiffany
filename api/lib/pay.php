<?php
/* Card-to-card through «تأیید شد» (tayidshod.ir, API v1) — added 2026-10-19.

   The customer picks «کارت‌به‌کارت» at checkout. The order is saved first,
   exactly like a card-on-delivery order (stock taken, SMS sent). Then a
   tayidshod order is made for the total: tayidshod answers with a unique
   amount (the total plus 11–999 toman, so a deposit matches only this order)
   and its own payment page, and the shop sends the customer there. They
   transfer from their bank app and tap «واریز کردم»; TIFFANY taps «رسید» in
   the tayidshod Bale bot; tayidshod tells this site with a signed webhook
   (api/pay-hook.php) and the order shows «پرداخت شد» in the panel. The
   «برگشت به فروشگاه» link (api/pay.php?a=back) asks again, so a late
   webhook never leaves the customer looking at a wrong answer.

   The API key and the webhook secret are pasted by the CEO in the panel's
   Settings, stay in the database (outside the web root) and never leave the
   server: the panel only ever sees their last four characters. With a test
   key (sk_test_) the option shows only to someone signed in to the panel, so
   a real customer can never pay a test order. If tayidshod cannot make the
   payment page when the order is placed, the order is kept and becomes
   «کارت موقع تحویل» — the customer is told so on the spot. */
declare(strict_types=1);

/* tayidshod refuses new live orders for these until something is fixed on
   its side; the option is hidden for a few minutes instead of failing every
   checkout. */
const TZ_PAUSE = ['subscription_required', 'payment_overdue', 'bale_required', 'cards_full'];
const TZ_STATES = ['pending', 'claimed', 'paid', 'rejected', 'mismatch', 'expired', 'canceled', 'failed', 'short', 'odd'];
/* The payment page still has something to say to the customer. (Expired
   too: for 24 hours they can still tap «واریز کرده بودم» there.) */
const TZ_PAGE = ['pending', 'claimed', 'rejected', 'mismatch', 'expired'];
/* An unpaid card-to-card order that nobody paid for is cancelled (and its
   pieces go back on the shelf) this long after it was placed: the payment
   page lasts 30 minutes and the customer may still say «واریز کرده بودم» for
   24 hours after that. Claimed, rejected or odd payments wait for a person. */
const TZ_RELEASE = 26 * 3600;

function tz_base(): string
{
    return rtrim(getenv('TIFFANY_TZ_BASE') ?: 'https://tayidshod.ir', '/');
}

function tz_key(): string
{
    return setting('tz_key');
}

function tz_whsec(): string
{
    return setting('tz_secret');
}

/** 'live', 'test', or '' when there is no usable key. */
function tz_mode(?string $key = null): string
{
    $k = $key ?? tz_key();
    return strpos($k, 'sk_live_') === 0 ? 'live' : (strpos($k, 'sk_test_') === 0 ? 'test' : '');
}

/** The CEO's switch is on and both the key and the webhook secret are in. */
function tz_ready(): bool
{
    return setting('tz_on', '0') === '1' && tz_mode() !== '' && tz_whsec() !== '';
}

/** This shop's address for tayidshod to call and send customers back to.
    Fixed on the host (a forged Host header cannot move it); a copy running
    on this computer keeps its own port, for the tests. */
function tz_site(): string
{
    $h = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if (PHP_SAPI === 'cli-server' && preg_match('/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/', $h)) {
        return 'http://' . $h;
    }
    return 'https://tiffanybv.com';
}

/** The order's own payment token: only the phone that placed it holds it. */
function tz_token(string $code): string
{
    return substr(hash_hmac('sha256', 'pay|' . $code, tf_secret('pay_salt')), 0, 24);
}

/** One server-to-server call: ['ok' => true, 'data' => …] or
    ['ok' => false, 'code' => …, 'msg' => …] (tayidshod's own error code and
    its Persian message when it gave one). */
function tz_call(string $method, string $path, ?array $body = null, int $timeout = 15): array
{
    $url = tz_base() . '/api/v1' . $path;
    $headers = ['Authorization: Bearer ' . tz_key(), 'Accept: application/json',
        'User-Agent: tiffany-shop/1 (+https://tiffanybv.com)'];
    /* An empty body is sent as {} (an object), never [] */
    $json = $body !== null ? json_encode($body === [] ? new stdClass() : $body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
    if ($json !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    $code = 0;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => false,
        ] + ($json !== null ? [CURLOPT_POSTFIELDS => $json] : []));
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
    } else {                            // a host without cURL: PHP's own HTTP client
        $raw = @file_get_contents($url, false, stream_context_create(['http' => [
            'method' => $method, 'header' => implode("\r\n", $headers), 'content' => $json ?? '',
            'timeout' => $timeout, 'ignore_errors' => true, 'follow_location' => 0,
        ]]));
        $err = $raw === false ? 'no answer' : '';
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                $code = (int) $m[1];
            }
        }
    }
    $j = json_decode((string) $raw, true);
    if (!is_array($j)) {
        return ['ok' => false, 'http' => $code, 'code' => 'no_response', 'msg' => $err !== '' ? $err : "HTTP $code"];
    }
    if ($code >= 400 || $code === 0) {
        $e = is_array($j['error'] ?? null) ? $j['error'] : [];
        return ['ok' => false, 'http' => $code, 'code' => tf_line($e['code'] ?? 'error', 40),
            'msg' => tf_line($e['message'] ?? "HTTP $code", 200)];
    }
    return ['ok' => true, 'http' => $code, 'data' => $j];
}

/** The tayidshod account as last checked: kept 10 minutes (2 after a failed
    check), and only for the key it was checked with. */
function tz_account(bool $fresh = false): array
{
    $tag = substr(hash('sha256', tz_key()), 0, 12);
    $c = json_decode(setting('tz_acct'), true);
    $c = is_array($c) ? $c : [];
    if (!$fresh && $c && ($c['tag'] ?? '') === $tag
        && time() - (int) ($c['ts'] ?? 0) < (!empty($c['ok']) ? 600 : 120)) {
        return $c;
    }
    if (tz_mode() === '') {
        return ['ok' => false, 'open' => false, 'code' => 'no_key', 'msg' => ''];
    }
    $r = tz_call('GET', '/account', null, $fresh ? 12 : 6);
    $c = ['ts' => time(), 'tag' => $tag, 'ok' => $r['ok']];
    if ($r['ok']) {
        $d = $r['data'];
        $mode = (string) ($d['mode'] ?? tz_mode());
        $lo = is_array($d['live_orders'] ?? null) ? $d['live_orders'] : [];
        $c += ['shop' => tf_line($d['shop_name'] ?? '', 80), 'mode' => $mode,
            'open' => $mode === 'test' || !empty($lo['open']), 'reason' => tf_line($lo['reason'] ?? '', 200)];
    } else {
        $c += ['open' => false, 'code' => $r['code'], 'msg' => $r['msg']];
    }
    setting_set('tz_acct', json_encode($c, JSON_UNESCAPED_UNICODE));
    return $c;
}

/** Offer card-to-card in this visitor's checkout? $quick (placing an order):
    an account check from the last hour is good enough, so the customer never
    waits on tayidshod twice in one order. */
function tz_available(bool $quick = false): bool
{
    if (!tz_ready()) {
        return false;
    }
    if (tz_mode() === 'test' && tf_user() === null) {
        return false;
    }
    if ((int) setting('tz_pause_until', '0') > time()) {
        return false;
    }
    if ($quick) {
        $c = json_decode(setting('tz_acct'), true);
        if (is_array($c) && ($c['tag'] ?? '') === substr(hash('sha256', tz_key()), 0, 12)
            && time() - (int) ($c['ts'] ?? 0) < 3600) {
            return !empty($c['open']);
        }
    }
    return !empty(tz_account()['open']);
}

/** Make the tayidshod payment for an order just saved (its database row).
    ['ok' => true, 'pay_url' => …], or ['ok' => false] after turning the
    order into «کارت موقع تحویل» with the reason in the team's note. */
function tz_start(array $o): array
{
    $code = (string) $o['code'];
    $amount = (int) $o['total'];
    $fail = static function (string $why) use ($o, $code): array {
        db()->prepare("UPDATE orders SET pay = 'card', pay_state = 'failed', pay_url = '',
                       admin_note = TRIM(admin_note || ?), updated_at = ? WHERE id = ?")
            ->execute(["\nکارت‌به‌کارت ساخته نشد (" . mb_substr($why, 0, 160) . ')؛ پرداخت موقع تحویل.', time(), $o['id']]);
        tf_log('سیستم', 'pay_failed', $code . ' · ' . mb_substr($why, 0, 160));
        return ['ok' => false];
    };
    if ($amount < 1000) {
        return $fail('مبلغ کمتر از ۱٬۰۰۰ تومان');
    }
    $site = tz_site();
    $req = [
        'amount' => $amount,
        'order_id' => $code,
        'callback_url' => $site . '/api/pay-hook.php',
        'return_url' => $site . '/api/pay.php?a=back&o=' . rawurlencode($code) . '&k=' . tz_token($code),
        'expires_in' => 30,
        'description' => 'سفارش ' . $code . '، TIFFANY by Vanda',
        'customer' => ['name' => mb_substr((string) $o['name'], 0, 60), 'mobile' => (string) $o['phone']],
    ];
    /* No answer in time: ask once more. The same order_id and amount give
       back the same open order at tayidshod, never a second one. */
    $r = tz_call('POST', '/orders', $req, 8);
    if (!$r['ok'] && $r['code'] === 'no_response') {
        $r = tz_call('POST', '/orders', $req, 6);
    }
    if (!$r['ok']) {
        if (in_array($r['code'], TZ_PAUSE, true)) {
            setting_set('tz_pause_until', (string) (time() + ($r['code'] === 'cards_full' ? 900 : 600)));
        }
        return $fail($r['code'] . ': ' . $r['msg']);
    }
    $d = $r['data'];
    $url = (string) ($d['pay_url'] ?? '');
    $ref = (string) ($d['id'] ?? '');
    $payAmount = (int) ($d['pay_amount'] ?? 0);
    $mode = (string) ($d['mode'] ?? '');
    $okRef = (bool) preg_match('/^[A-Za-z0-9_]{4,64}$/', $ref);
    /* A payment made at tayidshod that this shop will not use is closed
       there at once, so nobody can pay into it. */
    $drop = static function (string $why) use ($fail, $okRef, $ref): array {
        if ($okRef) {
            tz_call('POST', '/orders/' . rawurlencode($ref) . '/cancel', [], 6);
        }
        return $fail($why);
    };
    /* The page must be tayidshod's own, the amount the total plus at most
       999 toman (never less), and the mode the key's. */
    if (!$okRef) {
        return $fail('شناسه‌ی پرداخت نیامد');
    }
    if (strpos($url, tz_base() . '/') !== 0 || preg_match('/[\s"\'<>\\\\]/', $url)) {
        return $drop('نشانی پرداخت نامعتبر');
    }
    if ($payAmount < $amount || $payAmount > $amount + 999) {
        return $drop('مبلغ پرداخت نامعتبر');
    }
    if ($mode !== tz_mode()) {
        return $drop('حالت کلید با سفارش جور نیست');
    }
    $state = in_array((string) ($d['status'] ?? ''), TZ_STATES, true) ? (string) $d['status'] : 'pending';
    /* Only while the order is still standing: the team may have cancelled it
       while tayidshod was answering. */
    $up = db()->prepare("UPDATE orders SET pay_state = ?, pay_ref = ?, pay_amount = ?, pay_url = ?, pay_mode = ?, updated_at = ?
                         WHERE id = ? AND status != 'cancelled'");
    $up->execute([$state, $ref, $payAmount, $url, $mode, time(), $o['id']]);
    if ($up->rowCount() !== 1) {
        tz_call('POST', '/orders/' . rawurlencode($ref) . '/cancel', [], 6);
        return ['ok' => false, 'gone' => true];
    }
    return ['ok' => true, 'pay_url' => $url];
}

/** Apply one tayidshod order state to ours (a webhook, or a fresh look).
    Returns a short word for the webhook's answer and the log. A paid order
    never goes back; money is only counted when the mode and the unique
    amount are the ones this order was made with. */
function tz_apply(array $ps, string $event): string
{
    $ref = (string) ($ps['id'] ?? '');
    if ($ref === '') {
        return 'no id';
    }
    $db = db();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $st = $db->prepare("SELECT * FROM orders WHERE pay_ref = ? AND pay = 'c2c'");
        $st->execute([$ref]);
        $o = $st->fetch();
        $st->closeCursor();
        if (!$o) {
            $db->exec('COMMIT');
            return tz_stray($ps, $event);
        }
        $set = static function (string $state, bool $paid = false) use ($db, $o): void {
            if ($paid) {
                $db->prepare('UPDATE orders SET pay_state = ?, paid = 1, paid_at = ?, updated_at = ? WHERE id = ?')
                    ->execute([$state, time(), time(), $o['id']]);
            } else {
                $db->prepare('UPDATE orders SET pay_state = ?, updated_at = ? WHERE id = ?')
                    ->execute([$state, time(), $o['id']]);
            }
        };
        $paid = (int) $o['paid'] === 1;
        $word = 'ok';
        switch ($event) {
            case 'order.paid':
                if ($paid) {
                    $word = 'already paid';
                    break;
                }
                $mode = (string) ($ps['mode'] ?? '');
                $dep = is_array($ps['deposit'] ?? null) ? $ps['deposit'] : [];
                if ($mode !== $o['pay_mode'] || $mode !== tz_mode()) {
                    // an old test order paid after the shop moved to a live key: never real money
                    $set('odd');
                    $word = 'mode mismatch';
                } elseif ((int) ($ps['pay_amount'] ?? 0) !== (int) $o['pay_amount']) {
                    $set('odd');
                    $word = 'amount mismatch';
                } elseif (isset($dep['amount']) && is_numeric($dep['amount']) && (int) $dep['amount'] < (int) $o['total']) {
                    // TIFFANY confirmed a deposit smaller than the order: a person looks before it ships
                    $set('short');
                    $word = 'short deposit';
                } else {
                    $set('paid', true);
                    $word = 'paid';
                }
                tf_log('تأیید شد', $word === 'paid' ? 'order_paid' : 'order_pay_odd',
                    $o['code'] . ($word === 'paid' ? '' : ' · ' . $word)
                    . ($o['status'] === 'cancelled' ? ' · سفارش لغو شده بود' : ''));
                break;
            case 'order.claimed':
            case 'order.rejected':
            case 'order.mismatch':
            case 'order.expired':
            case 'order.canceled':
                $to = substr($event, 6);
                if ($paid) {
                    $word = 'already paid';
                } elseif (in_array($o['pay_state'], ['short', 'odd'], true)) {
                    $word = 'kept for review';          // the warning stays until a person has looked
                } elseif ($o['pay_state'] !== $to) {
                    $set($to);
                } else {
                    $word = 'same';
                }
                break;
            default:
                $word = 'ignored';
        }
        $db->exec('COMMIT');
        return $word;
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
}

/** tayidshod reports money for an id this shop never kept: a payment page
    made for an order that then fell back to card on delivery (no answer in
    time). Never silent: the order is flagged «بررسی کن» for the team, and
    nothing is counted as paid. */
function tz_stray(array $ps, string $event): string
{
    $code = (string) ($ps['order_id'] ?? '');
    if ($event !== 'order.paid' && $event !== 'order.claimed') {
        return 'unknown order';
    }
    if (!preg_match('/^TF-\d{5}$/', $code)) {
        tf_log('تأیید شد', 'order_pay_odd', 'پرداختی برای سفارشی که پیدا نشد · ' . mb_substr((string) ($ps['id'] ?? ''), 0, 40));
        return 'unknown order';
    }
    $up = db()->prepare("UPDATE orders SET pay_state = 'odd', updated_at = ? WHERE code = ? AND pay_ref = '' AND paid = 0");
    $up->execute([time(), $code]);
    if ($up->rowCount() === 1) {
        tf_log('تأیید شد', 'order_pay_odd', $code . ' · ' . ($event === 'order.paid' ? 'پرداخت' : 'اعلام واریز')
            . ' برای سفارشی که کارت‌به‌کارت ساخته نشده بود');
        return 'flagged';
    }
    return 'unknown order';
}

/** Unpaid card-to-card orders nobody paid for, cancelled and put back on the
    shelf (TZ_RELEASE after they were placed). Runs at most every ten
    minutes, after an answer has gone out (tf_after), from order.php and the
    panel's ping. A payment that may still be on its way is asked about
    first; one a person needs to look at is left alone. */
function tz_sweep(): void
{
    if (time() - (int) setting('tz_swept', '0') < 600) {
        return;
    }
    setting_set('tz_swept', (string) time());
    $st = db()->prepare("SELECT * FROM orders WHERE pay = 'c2c' AND paid = 0 AND status = 'new' AND created_at < ?
                         AND pay_state IN ('', 'pending', 'expired', 'canceled') ORDER BY id LIMIT 20");
    $st->execute([time() - TZ_RELEASE]);
    $rows = $st->fetchAll();
    $db = db();
    foreach ($rows as $o) {
        if ($o['pay_state'] === 'pending' && $o['pay_ref'] !== '') {
            $o = tz_refresh($o, true);              // a webhook that never came
        }
        if ((int) $o['paid'] === 1 || !in_array($o['pay_state'], ['', 'pending', 'expired', 'canceled'], true)) {
            continue;
        }
        $db->exec('BEGIN IMMEDIATE');
        try {
            $up = $db->prepare("UPDATE orders SET status = 'cancelled', updated_at = ?, admin_note = TRIM(admin_note || ?)
                                WHERE id = ? AND status = 'new' AND paid = 0");
            $up->execute([time(), "\nخودکار لغو شد: کارت‌به‌کارتش پرداخت نشد.", $o['id']]);
            $done = $up->rowCount() === 1;
            if ($done) {
                tf_restock(json_decode((string) $o['items'], true) ?: []);
            }
            $db->exec('COMMIT');
        } catch (Throwable $e) {
            $db->exec('ROLLBACK');
            throw $e;
        }
        if ($done) {
            tf_log('سیستم', 'order_status', $o['code'] . ' → cancelled (پرداخت نشد)');
            tz_cancel((string) $o['code']);
            tf_sms_order_moved($o);
        }
    }
}

/** An order that went card-to-card (or tried to), by its code. */
function tz_order(string $code): ?array
{
    $st = db()->prepare("SELECT * FROM orders WHERE code = ? AND (pay = 'c2c' OR pay_state != '')");
    $st->execute([$code]);
    $o = $st->fetch();
    $st->closeCursor();
    return $o ?: null;
}

/** Ask tayidshod where an unpaid order stands (at most once every 5 seconds
    per order) and return its row as it is now. */
function tz_refresh(array $o, bool $force = false): array
{
    if ((int) $o['paid'] === 1 || $o['pay'] !== 'c2c' || $o['pay_ref'] === '' || tz_mode() === '') {
        return $o;
    }
    $k = 'tzcheck:' . $o['code'];
    if (!$force && tf_too_many($k, 1, 5)) {
        return $o;
    }
    tf_note_attempt($k);
    $r = tz_call('GET', '/orders/' . rawurlencode((string) $o['pay_ref']), null, 8);
    if ($r['ok']) {
        $d = $r['data'];
        $s = (string) ($d['status'] ?? '');
        if (in_array($s, ['paid', 'claimed', 'rejected', 'mismatch', 'expired', 'canceled'], true)) {
            tz_apply($d, 'order.' . $s);
        }
    }
    return tz_order((string) $o['code']) ?? $o;
}

/** The team cancelled an unpaid card-to-card order: close its payment page
    too, so nobody pays for an order that is gone (best effort). */
function tz_cancel(string $code): void
{
    $o = tz_order($code);
    if (!$o || $o['pay'] !== 'c2c' || (int) $o['paid'] === 1 || $o['pay_ref'] === ''
        || !in_array($o['pay_state'], ['pending', 'mismatch', 'rejected', 'claimed'], true) || tz_mode() === '') {
        return;
    }
    $r = tz_call('POST', '/orders/' . rawurlencode((string) $o['pay_ref']) . '/cancel', [], 8);
    if ($r['ok']) {
        db()->prepare("UPDATE orders SET pay_state = 'canceled', updated_at = ? WHERE id = ? AND paid = 0")
            ->execute([time(), $o['id']]);
    }
}

/** What the customer's phone may know about its own order's payment. */
function tz_public(array $o): array
{
    $state = (string) $o['pay_state'];
    return [
        'code' => $o['code'], 'status' => $o['status'], 'pay' => $o['pay'], 'pay_state' => $state,
        'paid' => (int) $o['paid'] === 1, 'page' => (int) $o['paid'] !== 1 && $o['pay'] === 'c2c'
            && $o['status'] !== 'cancelled' && in_array($state, TZ_PAGE, true) && $o['pay_url'] !== '',
        'pay_amount' => (int) $o['pay_amount'], 'total' => (int) $o['total'],
        'subtotal' => (int) $o['subtotal'], 'shipping' => (int) $o['shipping'], 'created_at' => (int) $o['created_at'],
        /* The phone (for tracking) but not the address: this link sits inside
           the payment page's «back to the shop» button. */
        'phone' => $o['phone'],
        'items' => array_map(static fn ($i) => [
            'id' => $i['id'] ?? '', 'name' => $i['name'] ?? '', 'img' => $i['img'] ?? '', 'size' => $i['size'] ?? '',
            'colour' => $i['colour'] ?? '', 'colour_name' => $i['colour_name'] ?? '',
            'qty' => (int) ($i['qty'] ?? 0), 'price' => (int) ($i['price'] ?? 0),
        ], json_decode((string) $o['items'], true) ?: []),
    ];
}

/** What the panel's settings show (never the key or the secret themselves). */
function tz_panel(): array
{
    $key = tz_key();
    $sec = tz_whsec();
    $acct = json_decode(setting('tz_acct'), true);
    $fresh = is_array($acct) && ($acct['tag'] ?? '') === substr(hash('sha256', $key), 0, 12);
    $pause = (int) setting('tz_pause_until', '0');
    return [
        'on' => setting('tz_on', '0') === '1',
        'mode' => tz_mode(),
        'key_tail' => $key !== '' ? substr($key, -4) : '',
        'secret_tail' => $sec !== '' ? substr($sec, -4) : '',
        'hook' => tz_site() . '/api/pay-hook.php',
        'paused_until' => $pause > time() ? $pause : 0,
        'ping' => (int) setting('tz_ping', '0'),          // the dashboard's last test webhook that arrived signed
        'account' => $fresh && $key !== '' ? array_intersect_key($acct,
            array_flip(['ts', 'ok', 'shop', 'mode', 'open', 'reason', 'code', 'msg'])) : null,
    ];
}
