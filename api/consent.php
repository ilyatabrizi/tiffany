<?php
/* POST /api/consent.php — the answer from the shop's cookie sheet.

   {c: "yes" | "no", d?: {type, os, brand, browser, app, lang}}

   Sets one small first-party cookie, tf_c, that remembers the answer: 1 for
   yes (kept a year), 0 for no (kept six months, then the sheet may ask
   again). It is set here, by the server, rather than by the page's script:
   Safari cuts script-written cookies to seven days, which would bring the
   sheet back every week.

   On yes, today's device line is counted straight away (the page view that
   opened the site was counted before the answer existed). Both answers add
   one to a plain daily counter, so the panel can show how many say yes. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
tf_same_origin();
$in = tf_input();
$c = (string) ($in['c'] ?? '');
if ($c !== 'yes' && $c !== 'no') {
    tf_fail(422, 'invalid', ['field' => 'c']);
}
$yes = $c === 'yes';

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['SERVER_PORT'] ?? '') === '443');
setcookie(TF_CONSENT_COOKIE, $yes ? '1' : '0', [
    'expires' => time() + ($yes ? 365 : 182) * 86400,
    'path' => '/',
    'secure' => $https,
    'httponly' => false,          // the page reads it to know not to ask again
    'samesite' => 'Lax',
]);

$ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
if (!tf_is_bot($ua) && !tf_too_many('consent:' . tf_ip(), 30, 3600)) {
    tf_note_attempt('consent:' . tf_ip());
    [$day, $vid] = tf_visitor($ua);
    $db = db();
    $db->exec('BEGIN IMMEDIATE');
    tf_consent_note($day, $yes);
    $dev = $yes ? tf_device_clean($in['d'] ?? null) : null;
    if ($dev) {
        tf_device_note($day, $vid, $dev);
    }
    $db->exec('COMMIT');
}
tf_json(['ok' => true, 'c' => $c]);
