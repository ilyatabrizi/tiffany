<?php
/* /api/tickets.php — a signed-in customer's support tickets.

     list                      my tickets, newest activity first
     get     code              one thread (marks the team's answers as read)
     create  subject, body, product, files[], voice, voice_secs   (multipart)
     reply   code, body, product, files[], voice, voice_secs      (multipart)
     close   code              «my question is answered»

   Every request needs the shop's sign-in cookie and its X-CSRF token. Only
   the team answers, from the panel (api/admin.php). A customer only ever
   sees their own tickets: every lookup is by code AND by their account. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
tf_same_origin();
$type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
$isForm = strpos($type, 'multipart/form-data') === 0 || strpos($type, 'application/x-www-form-urlencoded') === 0;
if ($isForm) {
    tf_refuse_oversize();
}
$in = $isForm ? $_POST : tf_input();
$a = (string) ($in['a'] ?? '');

$me = tf_customer();
if (!$me) {
    tf_fail(401, 'signin');
}
tf_require_csrf();
$cid = (int) $me['id'];

/* What one customer may upload in a day (files of every message together),
   so one account cannot fill the host's disk. */
const TF_CUSTOMER_DAY_BYTES = 300 * 1024 * 1024;
if ($isForm && in_array($a, ['create', 'reply'], true)) {
    $st = db()->prepare("SELECT COALESCE(SUM(f.size), 0) FROM ticket_files f JOIN ticket_msgs m ON m.id = f.msg_id
                         JOIN tickets t ON t.id = f.ticket_id WHERE t.customer_id = ? AND m.side = 'c' AND f.created_at > ?");
    $st->execute([$cid, time() - 86400]);
    $used = (int) $st->fetchColumn();
    $st->closeCursor();                 // an open read would make the message's write fail under load
    if ($used + (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > TF_CUSTOMER_DAY_BYTES) {
        tf_fail(429, 'quota');
    }
}

/** One of my tickets, or a 404 (someone else's ticket does not exist for me). */
function mine(string $code, int $cid): array
{
    $t = tf_ticket_by_code($code);
    if (!$t || (int) $t['customer_id'] !== $cid) {
        tf_fail(404, 'not_found');
    }
    return $t;
}

function thread_out(array $t): array
{
    return ['ok' => true, 'ticket' => [
        'code' => $t['code'], 'subject' => $t['subject'], 'status' => $t['status'],
        'created_at' => (int) $t['created_at'], 'updated_at' => (int) $t['updated_at'],
    ]] + tf_ticket_thread($t, false);
}

switch ($a) {
    case 'list':
        tf_json(['ok' => true, 'tickets' => tf_tickets_list('t.customer_id = ?', [$cid], 'c', 100)]);

    case 'get':
        $t = mine((string) ($in['code'] ?? ''), $cid);
        tf_ticket_seen($t, 'c');
        tf_json(thread_out($t));

    case 'create':
        /* Ten new tickets a day per account and five open at once; twenty an
           hour per address, for anyone making accounts to flood the team. */
        $open = db()->prepare("SELECT COUNT(*) FROM tickets WHERE customer_id = ? AND status != 'closed'");
        $open->execute([$cid]);
        $openNow = (int) $open->fetchColumn();
        $open->closeCursor();
        if ($openNow >= 5) {
            tf_bad('subject', 'open', 'پنج تا تیکت باز داری؛ تا یکی‌شون جواب بگیره یا بسته بشه، توی همون‌ها بنویس.');
        }
        if (tf_too_many('tnew:' . $cid, 10, 86400) || tf_too_many('tnew:ip:' . tf_ip_key(), 20, 3600)) {
            tf_fail(429, 'too_many');
        }
        $files = tf_intake(tf_files_list($_FILES['files'] ?? null), $_FILES['voice'] ?? null, (int) ($in['voice_secs'] ?? 0));
        [$body, $product] = tf_message_in($in, $files);
        $subject = tf_line($in['subject'] ?? '', 80);
        if ($subject === '') {
            $subject = $body !== '' ? mb_substr(tf_line($body, 200), 0, 60)
                : ($product !== '' ? 'سؤال درباره‌ی یه محصول' : 'پیام بدون متن');
        }
        tf_note_attempt('tnew:' . $cid);
        tf_note_attempt('tnew:ip:' . tf_ip_key());
        $now = time();
        $code = tf_ticket_new_code();
        db()->prepare('INSERT INTO tickets (code, customer_id, subject, status, last_from, created_at, updated_at)
                       VALUES (?, ?, ?, \'open\', \'c\', ?, ?)')->execute([$code, $cid, $subject, $now, $now]);
        $t = tf_ticket_by_code($code);
        try {
            tf_ticket_post($t, 'c', '', $body, $product, $files);
        } catch (Throwable $e) {
            db()->prepare('DELETE FROM tickets WHERE id = ?')->execute([$t['id']]);   // no empty ticket left behind
            throw $e;
        }
        tf_json(thread_out(tf_ticket_by_code($code)));

    case 'reply':
        $t = mine((string) ($in['code'] ?? ''), $cid);
        tf_throttle('treply:' . $cid, 60, 3600);
        $files = tf_intake(tf_files_list($_FILES['files'] ?? null), $_FILES['voice'] ?? null, (int) ($in['voice_secs'] ?? 0));
        [$body, $product] = tf_message_in($in, $files);
        tf_ticket_post($t, 'c', '', $body, $product, $files);
        tf_json(thread_out(tf_ticket_by_code($t['code'])));

    case 'close':
        $t = mine((string) ($in['code'] ?? ''), $cid);
        db()->prepare("UPDATE tickets SET status = 'closed', updated_at = ? WHERE id = ?")->execute([time(), $t['id']]);
        tf_json(thread_out(tf_ticket_by_code($t['code'])));
}

tf_fail(400, 'unknown_action');
