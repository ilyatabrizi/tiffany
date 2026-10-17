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
tf_same_origin();
$ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
$in = tf_input();
$k = (string) ($in['k'] ?? '');
if (tf_is_bot($ua) || !hit_page_ok($k)) {
    http_response_code(204);
    exit;
}

/* A page view is worth nothing next to an order: if the database is busy
   (a burst, or the host slowing this account down), the view is simply not
   counted — no wait, no 500, nothing in error.log. */
try {
    [$day, $vid] = tf_visitor($ua);
    $dev = tf_consented() ? tf_device_clean($in['d'] ?? null) : null;

    $db = db();
    $db->exec('PRAGMA busy_timeout = 2000');
    $db->exec('BEGIN IMMEDIATE');
    /* A flood from one address stops counting (the shop never notices). */
    if (tf_too_many('hit:' . tf_ip_key(), 1500, 3600)) {
        $db->exec('ROLLBACK');
        http_response_code(204);
        exit;
    }
    tf_note_attempt('hit:' . tf_ip_key());
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
} catch (PDOException $e) {
    if (stripos($e->getMessage(), 'locked') === false && stripos($e->getMessage(), 'busy') === false) {
        throw $e;
    }
    try {
        db()->exec('ROLLBACK');
    } catch (Throwable $ignored) {
        // nothing was open
    }
}
http_response_code(204);

/** Only the shop's own pages are counted: its tabs and pages, a product that
    exists, a collection that exists. Anything else would be a new row a day. */
function hit_page_ok(string $k): bool
{
    if (in_array($k, ['home', 'shop', 'bag', 'orders', 'profile', 'saved', 'about', 'contact', 'terms'], true)) {
        return true;
    }
    if (!preg_match('/^([pc]):([a-z0-9][a-z0-9-]{0,60})$/', $k, $m)) {
        return false;
    }
    if ($m[1] === 'c') {
        return $m[2] !== '' && in_array($m[2], TF_COLS, true);
    }
    $st = db()->prepare('SELECT 1 FROM products WHERE id = ? AND visible = 1');
    $st->execute([$m[2]]);
    $ok = (bool) $st->fetchColumn();
    $st->closeCursor();
    return $ok;
}
