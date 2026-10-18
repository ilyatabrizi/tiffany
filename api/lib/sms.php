<?php
/* Order SMS through sms.ir's fast-send ("verify") API.

   The key and the two approved templates live in tiffany-data/sms.json,
   outside the web root and never in git:

     {"api_key": "…", "customer_template": 807432, "owner_template": 307865,
      "owner_mobile": "09…"}

   customer_template (approved 2026-10-14):
     تیفانی / #NAME# عزیز، سفارش #CODE# شما وضعیت جدیدی دارد. / …
   owner_template:
     تیفانی / سفارش جدید با کد #CODE# به مبلغ #AMOUNT# تومان ثبت شد. / …

   Two more templates arrived on 2026-10-18 and are optional until sms.ir
   approves them: the sign-up / password code (otp, #CODE#) and «your ticket
   has an answer» (ticket, #NAME# #CODE#). Their ids come from the panel
   (Settings → SMS, saved as sms_tpl_otp / sms_tpl_ticket) or from the file
   (otp_template / ticket_template); the panel wins.

   The panel's settings decide whether order and ticket SMS go out at all
   (sms_on) and which mobile hears about new orders (sms_owner; owner_mobile
   in the file until the CEO sets one). Sign-in codes ignore that switch: a
   customer cannot sign up without one. Order and ticket SMS never hold
   anyone up: they run after the answer has gone out (tf_after), and a
   failure only goes to error.log. Each value is cut to sms.ir's 25
   characters. */
declare(strict_types=1);

const TF_SMS_API = 'https://api.sms.ir/v1/';

/** The file's settings, or null while SMS is not set up. */
function tf_sms_config(): ?array
{
    static $c = false;
    if ($c !== false) {
        return $c;
    }
    $f = tf_data_dir() . '/sms.json';
    $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    $c = is_array($j) && !empty($j['api_key']) && !empty($j['customer_template']) && !empty($j['owner_template'])
        ? $j : null;
    return $c;
}

function tf_sms_on(): bool
{
    return tf_sms_config() !== null && setting('sms_on', '1') === '1';
}

/** The sms.ir template id for one kind of message; 0 when there is none yet. */
function tf_sms_template(string $which): int
{
    $c = tf_sms_config();
    if (!$c) {
        return 0;
    }
    if ($which === 'otp' || $which === 'ticket') {
        $set = (int) setting('sms_tpl_' . $which, '0');
        if ($set > 0) {
            return $set;
        }
    }
    return (int) ($c[$which . '_template'] ?? 0);
}

/** Can the shop text a sign-up or password code right now? */
function tf_otp_ready(): bool
{
    return tf_sms_template('otp') > 0;
}

/** Who hears about new orders: the panel's number, else the file's. */
function tf_sms_owner(): string
{
    $set = setting('sms_owner');
    if ($set !== '') {
        return $set === '-' ? '' : $set;           // '-' = the CEO cleared it on purpose
    }
    return tf_phone((tf_sms_config() ?? [])['owner_mobile'] ?? '');
}

/** One call to sms.ir: [ok, data or message]. */
function tf_sms_call(string $method, string $path, ?array $body = null): array
{
    $c = tf_sms_config();
    if (!$c) {
        return [false, 'not configured'];
    }
    $url = rtrim((string) ($c['endpoint'] ?? TF_SMS_API), '/') . '/' . ltrim($path, '/');
    $headers = ['X-API-KEY: ' . $c['api_key'], 'Accept: application/json'];
    $json = $body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE) : null;
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
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 12,
        ] + ($json !== null ? [CURLOPT_POSTFIELDS => $json] : []));
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
    } else {                            // a host without cURL: PHP's own HTTP client
        $raw = @file_get_contents($url, false, stream_context_create(['http' => [
            'method' => $method, 'header' => implode("\r\n", $headers), 'content' => $json ?? '',
            'timeout' => 12, 'ignore_errors' => true,
        ]]));
        $err = $raw === false ? 'no answer' : '';
    }
    if ($raw === false) {
        return [false, 'network: ' . $err];
    }
    $j = json_decode((string) $raw, true);
    if (!is_array($j)) {
        return [false, "http $code"];
    }
    $ok = (int) ($j['status'] ?? 0) === 1;
    return [$ok, $ok ? ($j['data'] ?? null) : (string) ($j['message'] ?? "http $code")];
}

/** Send one template. $which is 'customer' or 'owner'. */
function tf_sms_send(string $mobile, string $which, array $vars): bool
{
    $tpl = tf_sms_template($which);
    $mobile = tf_phone($mobile);
    if (!$tpl || $mobile === '') {
        return false;
    }
    $params = [];
    foreach ($vars as $k => $v) {
        $params[] = ['name' => $k, 'value' => mb_substr(trim((string) $v), 0, 25)];
    }
    [$ok, $info] = tf_sms_call('POST', 'send/verify', ['mobile' => $mobile, 'templateId' => $tpl, 'parameters' => $params]);
    if (!$ok) {
        // the number is half hidden: error.log is not the place for customers' phones
        tf_log_error(new RuntimeException("sms $which to " . substr($mobile, 0, 4) . '…' . substr($mobile, -2)
            . ': ' . (is_string($info) ? $info : json_encode($info, JSON_UNESCAPED_UNICODE))));
    }
    return $ok;
}

/** «مریم احمدی» → «مریم»: the template reads «#NAME# عزیز». */
function tf_sms_first_name(string $name): string
{
    $first = preg_split('/\s+/u', trim($name))[0] ?? '';
    return $first !== '' ? $first : 'مشتری';
}

/** A new order: the customer hears it was placed, the owner hears it came in. */
function tf_sms_order_placed(string $code, string $name, string $phone, int $total): void
{
    if (!tf_sms_on()) {
        return;
    }
    tf_sms_send($phone, 'customer', ['NAME' => tf_sms_first_name($name), 'CODE' => $code]);
    $owner = tf_sms_owner();
    if ($owner !== '') {
        tf_sms_send($owner, 'owner', ['CODE' => $code, 'AMOUNT' => number_format($total)]);
    }
}

/** The team moved an order (confirmed, sent, delivered, cancelled). */
function tf_sms_order_moved(array $o): void
{
    if (!tf_sms_on()) {
        return;
    }
    tf_sms_send((string) $o['phone'], 'customer', ['NAME' => tf_sms_first_name((string) $o['name']), 'CODE' => $o['code']]);
}

/** A sign-up or password code. Sent while the customer waits: they need to
    know at once if it did not go. */
function tf_sms_otp(string $phone, string $code): bool
{
    return tf_sms_send($phone, 'otp', ['CODE' => $code]);
}

/** The team answered a ticket: «#NAME# عزیز، به درخواست پشتیبانی #CODE# شما پاسخ داده شد». */
function tf_sms_ticket_answered(string $phone, string $name, string $code): void
{
    if (!tf_sms_on() || tf_sms_template('ticket') <= 0) {
        return;
    }
    tf_sms_send($phone, 'ticket', ['NAME' => tf_sms_first_name($name), 'CODE' => $code]);
}
