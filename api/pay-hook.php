<?php
/* POST /api/pay-hook.php — «تأیید شد» telling this site that a payment moved.

   Every call is signed: X-Tayidshod-Signature is sha256=HMAC-SHA256 of the
   raw body with the webhook secret the CEO pasted in the panel (whsec_…).
   Unsigned, wrongly signed or with no secret set yet, nothing is read.
   Events: order.claimed / paid / rejected / mismatch / expired / canceled,
   and ping (the dashboard's test). Any 2xx ends the delivery; tayidshod
   tries again later on anything else, and may send the same event twice —
   tz_apply only ever moves an order forward, so a repeat changes nothing. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

function hook_reply(int $code, string $msg): void
{
    tf_json(['result' => $msg], $code);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    hook_reply(405, 'post only');
}
$raw = (string) file_get_contents('php://input', false, null, 0, 100001);
if (strlen($raw) > 100000) {
    hook_reply(413, 'too big');
}
$secret = tz_whsec();
if ($secret === '') {
    hook_reply(503, 'webhook secret is not set');
}
$sig = (string) ($_SERVER['HTTP_X_TAYIDSHOD_SIGNATURE'] ?? '');
/* Nothing counts bad signatures: a secret cannot be guessed this way, and a
   limit would also shut out tayidshod's real calls from the same address
   (say, while a new secret is being pasted into the panel). */
if (!hash_equals('sha256=' . hash_hmac('sha256', $raw, $secret), $sig)) {
    hook_reply(401, 'bad signature');
}
$d = json_decode($raw, true);
if (!is_array($d) || !is_string($d['event'] ?? null)) {
    hook_reply(400, 'bad payload');
}
if ($d['event'] === 'ping') {
    setting_set('tz_ping', (string) time());
    hook_reply(200, 'pong');
}
$ps = is_array($d['order'] ?? null) ? $d['order'] : [];
if (!isset($ps['mode']) && is_string($d['mode'] ?? null)) {
    $ps['mode'] = $d['mode'];
}
hook_reply(200, tz_apply($ps, $d['event']));
