<?php
/* POST /api/hit.php — one page view, for the panel's "site visits".

   No cookies and no IP addresses are stored. A visitor is a hash of the
   address, the browser and a salt that is thrown away every day, so the
   same person counts once a day and can never be followed across days. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
$ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
$in = tf_input();
$k = (string) ($in['k'] ?? '');
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse/i', $ua)
    || !preg_match('/^[a-z]{1,12}(:[a-z0-9-]{1,60})?$/', $k)) {
    http_response_code(204);
    exit;
}

$db = db();
$day = date('Y-m-d');
$salt = setting('salt:' . $day);
if ($salt === '') {
    $salt = bin2hex(random_bytes(16));
    $db->prepare('INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)')->execute(['salt:' . $day, $salt]);
    $salt = setting('salt:' . $day);
    $db->prepare("DELETE FROM settings WHERE k LIKE 'salt:%' AND k < ?")->execute(['salt:' . date('Y-m-d', strtotime('-2 days'))]);
    $db->prepare('DELETE FROM seen WHERE day < ?')->execute([date('Y-m-d', strtotime('-2 days'))]);
}
$vid = substr(hash('sha256', $salt . '|' . tf_ip() . '|' . $ua), 0, 24);

$db->exec('BEGIN IMMEDIATE');
$st = $db->prepare('INSERT OR IGNORE INTO seen (day, vid) VALUES (?, ?)');
$st->execute([$day, $vid]);
$isNew = $st->rowCount() > 0 ? 1 : 0;
$db->prepare('INSERT INTO daily (day, views, visitors) VALUES (?, 1, ?)
              ON CONFLICT(day) DO UPDATE SET views = views + 1, visitors = visitors + excluded.visitors')
    ->execute([$day, $isNew]);
$db->prepare('INSERT INTO pageviews (day, page, n) VALUES (?, ?, 1)
              ON CONFLICT(day, page) DO UPDATE SET n = n + 1')->execute([$day, $k]);
$db->exec('COMMIT');
http_response_code(204);
