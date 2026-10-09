<?php
/* POST /api/hit.php — one page view, for the panel's "site visits".

   No IP address is stored. A visitor is a hash of the address, the browser
   and a salt that is thrown away every day (tf_visitor), so the same person
   counts once a day and can never be followed across days.

   The device line (type, system, brand, browser…) is counted only when this
   browser carries the yes cookie from the cookie sheet, and only as a daily
   tally per value — never per person. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
$ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
$in = tf_input();
$k = (string) ($in['k'] ?? '');
if (tf_is_bot($ua) || !preg_match('/^[a-z]{1,12}(:[a-z0-9-]{1,60})?$/', $k)) {
    http_response_code(204);
    exit;
}

[$day, $vid] = tf_visitor($ua);
$dev = tf_consented() ? tf_device_clean($in['d'] ?? null) : null;

$db = db();
$db->exec('BEGIN IMMEDIATE');
$st = $db->prepare('INSERT OR IGNORE INTO seen (day, vid) VALUES (?, ?)');
$st->execute([$day, $vid]);
$isNew = $st->rowCount() > 0 ? 1 : 0;
$db->prepare('INSERT INTO daily (day, views, visitors) VALUES (?, 1, ?)
              ON CONFLICT(day) DO UPDATE SET views = views + 1, visitors = visitors + excluded.visitors')
    ->execute([$day, $isNew]);
$db->prepare('INSERT INTO pageviews (day, page, n) VALUES (?, ?, 1)
              ON CONFLICT(day, page) DO UPDATE SET n = n + 1')->execute([$day, $k]);
if ($dev) {
    tf_device_note($day, $vid, $dev);
}
$db->exec('COMMIT');
http_response_code(204);
