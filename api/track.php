<?php
/* POST /api/track.php — where are my orders? The shop sends the codes it
   holds plus the phone they were placed with; an order only answers to its
   own phone number, so codes cannot be fished for. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
tf_same_origin();
tf_throttle('track:' . tf_ip_key(), 240, 3600);
$in = tf_input();
$phone = tf_phone($in['phone'] ?? '');
$codes = array_values(array_filter(array_slice((array) ($in['codes'] ?? []), 0, 50),
    static fn ($c) => is_string($c) && preg_match('/^TF-\d{5}$/', $c)));
if ($phone === '' || !$codes) {
    tf_json(['ok' => true, 'orders' => new stdClass()]);
}
$marks = implode(',', array_fill(0, count($codes), '?'));
$st = db()->prepare("SELECT code, status, updated_at, pay, pay_state, paid, post_code FROM orders WHERE phone = ? AND code IN ($marks)");
$st->execute(array_merge([$phone], $codes));
$out = [];
foreach ($st->fetchAll() as $r) {
    $out[$r['code']] = ['status' => $r['status'], 'updated_at' => (int) $r['updated_at'],
        'pay' => $r['pay'], 'pay_state' => $r['pay_state'], 'paid' => (int) $r['paid'] === 1,
        'post_code' => (string) $r['post_code']];
}
tf_json(['ok' => true, 'orders' => $out ?: new stdClass()]);
