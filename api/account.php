<?php
/* /api/account.php — a customer's account. POST JSON {"a": "<action>", ...}.

     state    who is signed in, whether sign-up codes can be sent, unread answers
     otp      text a code: purpose signup (number not registered yet) or reset
     signup   phone + code + name + password → account, signed in
     login    phone + password
     reset    phone + code + new password → signed in, every other device out
     logout / profile / password   (signed in; X-CSRF)

   The phone number is the account: it is proven once by a five-digit SMS
   code (api/lib/shop.php), and it is the number orders and ticket answers
   go to. Passwords are bcrypt; logins are rate-limited per address, per
   number and per pair, like the panel's. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
tf_same_origin();
$in = tf_input();
$a = (string) ($in['a'] ?? '');

function me_out(array $c): array
{
    return ['ok' => true, 'user' => tf_customer_public($c), 'csrf' => $_SESSION['csrf'] ?? '',
        'unread' => unread_answers((int) $c['id'])];
}

function unread_answers(int $cid): int
{
    $st = db()->prepare("SELECT COUNT(*) FROM tickets t WHERE t.customer_id = ? AND EXISTS
        (SELECT 1 FROM ticket_msgs m WHERE m.ticket_id = t.id AND m.side = 's' AND m.id > t.seen_c)");
    $st->execute([$cid]);
    return (int) $st->fetchColumn();
}

function phone_in(array $in): string
{
    $p = tf_phone($in['phone'] ?? '');
    if ($p === '') {
        tf_bad('phone', 'phone', 'شماره موبایل درست نیست.');
    }
    return $p;
}

function name_in(array $in): string
{
    $n = tf_line($in['name'] ?? '', 60);
    if (mb_strlen($n) < 2) {
        tf_bad('name', 'name', 'اسم و فامیلت رو بنویس.');
    }
    return $n;
}

switch ($a) {
    case 'state':
        $c = tf_customer();
        tf_json(['ok' => true, 'user' => $c ? tf_customer_public($c) : null,
            'csrf' => $c ? ($_SESSION['csrf'] ?? '') : '', 'otp' => tf_otp_ready(),
            'unread' => $c ? unread_answers((int) $c['id']) : 0,
            'caps' => ['file' => tf_upload_cap(TF_FILE_CAP), 'files' => TF_FILES_PER_MSG]]);

    case 'otp':
        $purpose = in_array($in['purpose'] ?? '', TF_PURPOSES, true) ? $in['purpose'] : '';
        if ($purpose === '') {
            tf_fail(400, 'purpose');
        }
        if (!tf_otp_ready()) {
            tf_fail(503, 'otp_off');
        }
        $phone = phone_in($in);
        $have = tf_customer_by_phone($phone);
        if ($purpose === 'signup') {
            if (array_key_exists('name', $in)) {
                name_in($in);
            }
            if (array_key_exists('password', $in)) {
                tf_customer_password((string) $in['password']);
            }
            if ($have) {
                tf_bad('phone', 'taken', 'با این شماره قبلاً ثبت‌نام شده؛ وارد شو، یا اگه رمز یادت نیست بازیابیش کن.');
            }
        } elseif (!$have || !$have['active']) {
            tf_bad('phone', 'unknown', 'با این شماره حسابی نداریم؛ اول ثبت‌نام کن.');
        }
        tf_otp_send($phone, $purpose);
        tf_json(['ok' => true, 'wait' => TF_OTP_GAP, 'ttl' => TF_OTP_TTL]);

    case 'signup':
        $phone = phone_in($in);
        $name = name_in($in);
        $pass = tf_customer_password((string) ($in['password'] ?? ''));
        if (tf_customer_by_phone($phone)) {
            tf_bad('phone', 'taken', 'با این شماره قبلاً ثبت‌نام شده؛ وارد شو.');
        }
        tf_otp_check($phone, 'signup', (string) ($in['code'] ?? ''));
        try {
            db()->prepare('INSERT INTO customers (phone, name, pass, sv, created_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([$phone, $name, password_hash($pass, PASSWORD_DEFAULT), tf_new_sv(), time()]);
        } catch (PDOException $e) {
            if (stripos($e->getMessage(), 'UNIQUE') === false) {
                throw $e;
            }
            tf_bad('phone', 'taken', 'با این شماره قبلاً ثبت‌نام شده؛ وارد شو.');
        }
        $c = tf_customer_by_phone($phone);
        tf_customer_sign_in($c);
        tf_json(me_out($c));

    case 'login':
        $phone = tf_phone($in['phone'] ?? '');
        $pass = (string) ($in['password'] ?? '');
        $ipKey = 'clogin:ip:' . tf_ip_key();
        $pairKey = 'clogin:ph:' . $phone . '|' . tf_ip_key();
        $phKey = 'clogin:any:' . $phone;
        if (tf_too_many($ipKey, 20, 900) || tf_too_many($pairKey, 6, 900) || tf_too_many($phKey, 30, 900)) {
            tf_fail(429, 'too_many');
        }
        $c = $phone !== '' ? tf_customer_by_phone($phone) : null;
        if (!$c || !$c['active'] || !password_verify($pass, $c['pass'])) {
            if (!$c) {
                password_verify($pass, tf_dummy_hash());      // the same work as a real check
            }
            tf_note_attempt($ipKey);
            tf_note_attempt($pairKey);
            tf_note_attempt($phKey);
            tf_fail(401, 'wrong');
        }
        if (password_needs_rehash($c['pass'], PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE customers SET pass = ? WHERE id = ?')
                ->execute([password_hash($pass, PASSWORD_DEFAULT), $c['id']]);
        }
        tf_clear_attempts($pairKey);
        tf_clear_attempts($phKey);
        tf_customer_sign_in($c);
        tf_json(me_out($c));

    case 'reset':
        $phone = phone_in($in);
        $pass = tf_customer_password((string) ($in['password'] ?? ''));
        $c = tf_customer_by_phone($phone);
        if (!$c || !$c['active']) {
            tf_bad('phone', 'unknown', 'با این شماره حسابی نداریم.');
        }
        tf_otp_check($phone, 'reset', (string) ($in['code'] ?? ''));
        db()->prepare('UPDATE customers SET pass = ?, sv = sv + 1 WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_DEFAULT), $c['id']]);
        tf_clear_attempts('clogin:any:' . $phone);
        $c = tf_customer_by_phone($phone);
        tf_customer_sign_in($c);
        tf_json(me_out($c));
}

/* ======================================================== signed-in only */
$me = tf_customer();
if (!$me) {
    tf_fail(401, 'signin');
}
tf_require_csrf();

switch ($a) {
    case 'logout':
        tf_sign_out('shop');
        tf_json(['ok' => true]);

    case 'profile':
        $name = name_in($in);
        db()->prepare('UPDATE customers SET name = ? WHERE id = ?')->execute([$name, $me['id']]);
        $me['name'] = $name;
        tf_json(me_out($me));

    case 'password':
        if (!password_verify((string) ($in['current'] ?? ''), $me['pass'])) {
            tf_bad('current', 'wrong', 'رمز فعلی درست نیست.');
        }
        $pass = tf_customer_password((string) ($in['password'] ?? ''));
        db()->prepare('UPDATE customers SET pass = ?, sv = sv + 1 WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_DEFAULT), $me['id']]);
        $c = tf_customer_by_phone($me['phone']);
        tf_customer_sign_in($c);                     // this phone stays in, every other one is out
        tf_json(me_out($c));
}

tf_fail(400, 'unknown_action');
