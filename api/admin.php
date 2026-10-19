<?php
/* /api/admin.php — everything the panel does, one action per request.

   Request: POST JSON {"a": "<action>", ...} (photo uploads are multipart with
   a=upload). Every action except state/setup/login/recover needs a signed-in
   user, the same origin and the X-CSRF token handed out at sign-in.

   Two roles:
     ceo   — everything: money and income reports, settings, the team
     admin — products, orders, customers, stories and tickets; never totals
             of money, never settings or other people's accounts */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
tf_same_origin();
/* No session is opened here: tf_user() opens one only for a request that
   carries the panel's cookie, and signing in opens its own. */

$type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
$isForm = strpos($type, 'multipart/form-data') === 0 || strpos($type, 'application/x-www-form-urlencoded') === 0;
if ($isForm) {
    tf_refuse_oversize();
}
$in = $isForm ? $_POST : tf_input();
$a = (string) ($in['a'] ?? '');

function ok(array $data = []): void
{
    tf_json(['ok' => true] + $data);
}

function no_users(): bool
{
    return (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0;
}

function valid_email(string $e): string
{
    $e = strtolower(tf_line($e, 120));
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) {
        throw new TfInvalid('email', 'ایمیل درست نیست.');
    }
    return $e;
}

function valid_password(string $p, string $field = 'password'): string
{
    if (mb_strlen($p) < 8) {
        throw new TfInvalid($field, 'رمز باید حداقل ۸ کاراکتر باشه.');
    }
    if (mb_strlen($p) > 200) {
        throw new TfInvalid($field, 'رمز خیلی بلنده.');
    }
    return $p;
}

function me_out(array $u): array
{
    return ['user' => tf_user_public($u), 'csrf' => $_SESSION['csrf'] ?? ''];
}

/* ===================================================== no sign-in needed */
switch ($a) {
    case 'state':
        $u = tf_user();
        if (no_users()) {
            tf_key_ensure();
        }
        ok(['setup' => no_users(), 'user' => $u ? tf_user_public($u) : null,
            'csrf' => $u ? ($_SESSION['csrf'] ?? '') : '']);

    case 'setup':
        if (!no_users()) {
            tf_fail(409, 'already_setup');
        }
        tf_throttle('key:' . tf_ip_key(), 10, 3600);
        if (!tf_key_matches((string) ($in['key'] ?? ''))) {
            throw new TfInvalid('key', 'کلید راه‌اندازی درست نیست.');
        }
        $name = tf_line($in['name'] ?? '', 60);
        if (mb_strlen($name) < 2) {
            throw new TfInvalid('name', 'اسمت رو بنویس.');
        }
        $email = valid_email((string) ($in['email'] ?? ''));
        $pass = valid_password((string) ($in['password'] ?? ''));
        db()->prepare('INSERT INTO users (name, email, pass, role, sv, created_at) VALUES (?, ?, ?, \'ceo\', ?, ?)')
            ->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), tf_new_sv(), time()]);
        tf_key_rotate();
        $u = db()->query('SELECT * FROM users ORDER BY id DESC LIMIT 1')->fetch();
        tf_sign_in($u);
        tf_log($name, 'setup', 'CEO account created');
        ok(me_out($u));

    case 'login':
        $email = strtolower(tf_line($in['email'] ?? '', 120));
        $pass = (string) ($in['password'] ?? '');
        /* Three counters: this address (20 tries in 15 minutes), this address
           on this email (6), and this email from anywhere (30). The tight one
           is per address, so a stranger guessing at someone's email cannot
           lock the real person out from their own phone. */
        $ipKey = 'login:ip:' . tf_ip_key();
        $pairKey = 'login:em:' . $email . '|' . tf_ip_key();
        $emKey = 'login:any:' . $email;
        /* Counted before the password is checked, in one locked step, so
           tries sent together cannot all get past the limit; a right password
           gives its count back. */
        if (!tf_spend([[$ipKey, 20, 900], [$pairKey, 6, 900], [$emKey, 30, 900]])) {
            tf_fail(429, 'too_many');
        }
        $st = db()->prepare('SELECT * FROM users WHERE email = ? AND active = 1');
        $st->execute([$email]);
        $u = $st->fetch();
        $st->closeCursor();             // an open read would make the writes below fail under load
        if (!$u || !password_verify($pass, $u['pass'])) {
            if (!$u) {
                password_verify($pass, tf_dummy_hash());   // same work as a real check
            }
            tf_fail(401, 'wrong');
        }
        tf_unspend($ipKey);
        if (password_needs_rehash($u['pass'], PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE users SET pass = ? WHERE id = ?')
                ->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        }
        tf_clear_attempts($pairKey);
        tf_clear_attempts($emKey);
        tf_sign_in($u);
        tf_log($u['name'], 'login');
        ok(me_out($u));

    case 'recover':
        tf_throttle('key:' . tf_ip_key(), 10, 3600);
        if (!tf_key_matches((string) ($in['key'] ?? ''))) {
            throw new TfInvalid('key', 'کلید درست نیست.');
        }
        $email = valid_email((string) ($in['email'] ?? ''));
        $pass = valid_password((string) ($in['password'] ?? ''));
        $st = db()->prepare("SELECT * FROM users WHERE email = ? AND role = 'ceo' AND active = 1");
        $st->execute([$email]);
        $u = $st->fetch();
        $st->closeCursor();
        if (!$u) {
            throw new TfInvalid('email', 'مدیرعاملی با این ایمیل نداریم.');
        }
        db()->prepare('UPDATE users SET pass = ?, sv = sv + 1 WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        tf_key_rotate();
        $st->execute([$email]);
        $u = $st->fetch();
        $st->closeCursor();
        tf_sign_in($u);
        tf_log($u['name'], 'recover', 'password reset with the setup key');
        ok(me_out($u));
}

/* ======================================================== signed-in only */
$me = tf_user();
if (!$me) {
    tf_fail(401, 'signin');
}
tf_require_csrf();
$ceo = $me['role'] === 'ceo';

function ceo_only(bool $ceo): void
{
    if (!$ceo) {
        tf_fail(403, 'role');
    }
}

switch ($a) {
    case 'logout':
        tf_sign_out();
        ok();

    case 'ping':                        // the badges on «سفارش‌ها» and «تیکت‌ها», every minute or so
        tf_after('tz_sweep');           // unpaid card-to-card orders past their time go back on the shelf
        ok(['pending' => (int) db()->query("SELECT COUNT(*) FROM orders WHERE status = 'new'")->fetchColumn(),
            'tickets' => (int) db()->query("SELECT COUNT(*) FROM tickets WHERE status = 'open'")->fetchColumn()]);

    case 'password':
        tf_throttle('cpass:a:' . $me['id'], 10, 3600);   // a stolen session cannot guess its way to the password
        if (!password_verify((string) ($in['current'] ?? ''), $me['pass'])) {
            throw new TfInvalid('current', 'رمز فعلی درست نیست.');
        }
        $pass = valid_password((string) ($in['password'] ?? ''));
        db()->prepare('UPDATE users SET pass = ?, sv = sv + 1 WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_DEFAULT), $me['id']]);
        $st = db()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$me['id']]);
        $fresh = $st->fetch();
        $st->closeCursor();
        tf_sign_in($fresh);                 // this device stays in, every other one is out
        tf_log($me['name'], 'password');
        ok(['csrf' => $_SESSION['csrf']]);

    /* ------------------------------------------------------- dashboard */
    case 'dashboard':
        ok(dashboard(days_of($in), $ceo));

    case 'traffic':
        ok(traffic(days_of($in)));

    /* -------------------------------------------------------- products */
    case 'products':
        ok(['products' => tf_products(false)]);

    case 'product':
        $p = tf_product((string) ($in['id'] ?? ''));
        if (!$p) {
            tf_fail(404, 'not_found');
        }
        ok(['product' => $p]);

    case 'product_save':
        $raw = (array) ($in['product'] ?? []);
        $id = (string) ($raw['id'] ?? '');
        $db = db();
        /* Read, check and write in one locked step, so nothing can land in
           between. The panel sends the stock it opened with (stock_base) and
           the change is applied on top of today's shelf; a caller that sends
           no base but an older version (updated_at) is refused instead. */
        $db->exec('BEGIN IMMEDIATE');
        try {
            $old = $id !== '' ? tf_product($id) : null;
            if ($id !== '' && !$old) {
                $db->exec('ROLLBACK');
                tf_fail(404, 'not_found');
            }
            $base = isset($raw['stock_base']) && is_array($raw['stock_base']) ? $raw['stock_base'] : null;
            if ($old && $base === null && isset($raw['updated_at'])
                && (int) $raw['updated_at'] !== $old['updated_at']) {
                $db->exec('ROLLBACK');
                tf_fail(409, 'stale');
            }
            $p = tf_product_clean($raw, $old ? $old['id'] : null);
            /* Stock moves by what was changed in the editor, on top of what the
               shelf holds now: an order placed while the editor was open keeps
               its pieces, and a typo fix does not put them back. */
            if ($old && $base !== null && is_array($p['stock']) && is_array($old['stock'] ?? null)) {
                foreach ($p['stock'] as $s => $n) {
                    if (array_key_exists($s, $old['stock']) && array_key_exists($s, $base)) {
                        $p['stock'][$s] = max(0, min(99999, (int) $old['stock'][$s] + $n - tf_int($base[$s])));
                    }
                }
            }
        } catch (Throwable $e) {
            $db->exec('ROLLBACK');
            throw $e;
        }
        $now = time();
        if ($old) {
            tf_product_store($p);
            $db->exec('COMMIT');
            tf_log($me['name'], 'product_edit', $p['name']['fa']);
        } else {
            db()->prepare('INSERT INTO products (id, data, cat, price, visible, sort, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
                ->execute([$p['id'], json_encode($p, JSON_UNESCAPED_UNICODE), $p['cat'], $p['price'],
                    $p['visible'] ? 1 : 0, $now, $now]);
            $db->exec('COMMIT');
            tf_log($me['name'], 'product_add', $p['name']['fa']);
        }
        ok(['product' => tf_product($p['id'])]);

    case 'product_visible':
        $db = db();
        $db->exec('BEGIN IMMEDIATE');
        $p = tf_product((string) ($in['id'] ?? ''));
        if (!$p) {
            $db->exec('ROLLBACK');
            tf_fail(404, 'not_found');
        }
        $p['visible'] = !empty($in['visible']);
        tf_product_store($p);
        $db->exec('COMMIT');
        tf_log($me['name'], $p['visible'] ? 'product_show' : 'product_hide', $p['name']['fa']);
        ok(['product' => tf_product($p['id'])]);

    case 'product_delete':
        $p = tf_product((string) ($in['id'] ?? ''));
        if (!$p) {
            tf_fail(404, 'not_found');
        }
        db()->prepare('DELETE FROM products WHERE id = ?')->execute([$p['id']]);
        tf_log($me['name'], 'product_delete', $p['name']['fa']);
        ok();

    case 'upload':
        ok(['image' => save_photo($_FILES['photo'] ?? null)]);

    /* ---------------------------------------------------------- orders */
    case 'orders':
        $status = (string) ($in['status'] ?? '');
        $q = tf_line($in['q'] ?? '', 60);
        $where = [];
        $args = [];
        if (in_array($status, TF_STATUSES, true)) {
            $where[] = 'status = ?';
            $args[] = $status;
        }
        if ($q !== '') {
            $digits = tf_digits($q);
            $where[] = '(code LIKE ? OR name LIKE ? OR phone LIKE ?)';
            array_push($args, "%$digits%", "%$q%", "%$digits%");
        }
        $sql = 'SELECT * FROM orders' . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
            . ' ORDER BY created_at DESC LIMIT 300';
        $st = db()->prepare($sql);
        $st->execute($args);
        $counts = [];
        foreach (db()->query('SELECT status, COUNT(*) n FROM orders GROUP BY status') as $r) {
            $counts[$r['status']] = (int) $r['n'];
        }
        ok(['orders' => array_map('tf_order_public', $st->fetchAll()), 'counts' => $counts]);

    case 'order':
        ok(['order' => order_or_404((string) ($in['code'] ?? ''))]);

    case 'order_status':
        $o = order_or_404((string) ($in['code'] ?? ''));
        $to = (string) ($in['status'] ?? '');
        if (!in_array($to, TF_STATUSES, true)) {
            throw new TfInvalid('status', 'وضعیت نامعتبره.');
        }
        if ($o['status'] === 'cancelled') {
            throw new TfInvalid('status', 'سفارش لغوشده رو نمی‌شه برگردوند.');
        }
        if ($to !== $o['status']) {
            $db = db();
            $db->exec('BEGIN IMMEDIATE');
            /* Only moves the order if it is still where this person saw it:
               two people cancelling at once must not restock it twice. */
            $up = $db->prepare('UPDATE orders SET status = ?, updated_at = ? WHERE code = ? AND status = ?');
            $up->execute([$to, time(), $o['code'], $o['status']]);
            if ($up->rowCount() !== 1) {
                $db->exec('ROLLBACK');
                tf_fail(409, 'stale');
            }
            if ($to === 'cancelled') {
                tf_restock($o['items']);
            }
            $db->exec('COMMIT');
            tf_log($me['name'], 'order_status', $o['code'] . ' → ' . $to);
            if ($to !== 'new') {                 // the customer hears that their order moved
                tf_after(static function () use ($o): void {
                    tf_sms_order_moved($o);
                });
            }
            if ($to === 'cancelled' && $o['pay'] === 'c2c' && !$o['paid']) {
                tf_after(static function () use ($o): void {
                    tz_cancel($o['code']);       // nobody can pay for it any more
                });
            }
        }
        ok(['order' => order_or_404($o['code'])]);

    case 'order_pay_check':             // ask «تأیید شد» now, when a webhook seems late
        $o = order_or_404((string) ($in['code'] ?? ''));
        $row = $o['pay'] === 'c2c' ? tz_order($o['code']) : null;
        if (!$row || $row['pay_ref'] === '') {
            throw new TfInvalid('pay', 'این سفارش کارت‌به‌کارت «تأیید شد» نیست.');
        }
        tf_throttle('paycheck:' . $me['id'], 60, 3600);
        tz_refresh($row, true);
        ok(['order' => order_or_404($o['code'])]);

    case 'order_note':
        $o = order_or_404((string) ($in['code'] ?? ''));
        db()->prepare('UPDATE orders SET admin_note = ?, updated_at = ? WHERE code = ?')
            ->execute([tf_text($in['note'] ?? '', 500), time(), $o['code']]);
        tf_log($me['name'], 'order_note', $o['code']);
        ok(['order' => order_or_404($o['code'])]);

    /* ------------------------------------------------------- customers */
    case 'customers':
        ok(['customers' => customers(tf_line($in['q'] ?? '', 60), $ceo)]);

    case 'customer':
        $phone = tf_phone($in['phone'] ?? '');
        $st = db()->prepare('SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC');
        $st->execute([$phone]);
        $orders = array_map('tf_order_public', $st->fetchAll());
        ok(['orders' => $orders]);

    /* -------------------------------------------------------- settings */
    case 'settings':
        ok(['settings' => tf_public_settings()] + ($ceo ? ['sms' => sms_state(), 'pay' => tz_panel()] : []));

    /* Card-to-card («تأیید شد»): the CEO pastes the API key and the webhook
       secret; each is kept only when a new one is typed, and only its last
       four characters ever come back. */
    case 'pay_save':
        ceo_only($ceo);
        $key = trim((string) ($in['key'] ?? ''));
        $secret = trim((string) ($in['secret'] ?? ''));
        if ($key !== '' && !preg_match('/^sk_(live|test)_[A-Za-z0-9_-]{16,128}$/', $key)) {
            throw new TfInvalid('key', 'کلید API با sk_live_ یا sk_test_ شروع می‌شه؛ همون رو از داشبورد «تأیید شد»، بخش «API و ووکامرس» کپی کن.');
        }
        if ($secret !== '' && !preg_match('/^whsec_[A-Za-z0-9_-]{16,128}$/', $secret)) {
            throw new TfInvalid('secret', 'رمز امضای وب‌هوک با whsec_ شروع می‌شه.');
        }
        if ($key === '' && $secret === '') {
            throw new TfInvalid('key', 'کلید یا رمز جدید رو وارد کن.');
        }
        if ($key !== '') {
            setting_set('tz_key', $key);
            setting_set('tz_pause_until', '0');
            tf_log($me['name'], 'pay_key', tz_mode($key) . ' ····' . substr($key, -4));
        }
        if ($secret !== '') {
            setting_set('tz_secret', $secret);
            tf_log($me['name'], 'pay_secret', '····' . substr($secret, -4));
        }
        tz_account(true);
        ok(['pay' => tz_panel()]);

    case 'pay_check':                   // «بررسی اتصال»: tayidshod's /account, asked now
        ceo_only($ceo);
        tf_throttle('paytest:' . $me['id'], 30, 3600);
        if (tz_mode() !== '') {
            tz_account(true);
        }
        ok(['pay' => tz_panel()]);

    case 'settings_save':
        ceo_only($ceo);
        if (array_key_exists('store_open', $in)) {
            $open = !empty($in['store_open']);
            setting_set('store_open', $open ? '1' : '0');
            tf_log($me['name'], $open ? 'store_open' : 'store_close');
        }
        if (array_key_exists('tz_on', $in)) {
            $on = !empty($in['tz_on']);
            if ($on && (tz_mode() === '' || tz_whsec() === '')) {
                throw new TfInvalid('tz_on', 'اول کلید API و رمز امضای وب‌هوک رو ذخیره کن.');
            }
            setting_set('tz_on', $on ? '1' : '0');
            tf_log($me['name'], $on ? 'pay_on' : 'pay_off');
        }
        if (array_key_exists('sms_on', $in)) {
            $on = !empty($in['sms_on']);
            setting_set('sms_on', $on ? '1' : '0');
            tf_log($me['name'], $on ? 'sms_on' : 'sms_off');
        }
        foreach (['sms_tpl_otp' => 'otp', 'sms_tpl_ticket' => 'ticket'] as $key => $which) {
            if (!array_key_exists($key, $in)) {
                continue;
            }
            $raw = tf_line($in[$key] ?? '', 20);
            $id = tf_int($raw);
            if ($raw !== '' && ($id < 1 || $id > 2147483647)) {
                throw new TfInvalid($key, 'شماره‌ی قالب فقط عدده، همون که sms.ir بعد از تأیید نشون می‌ده.');
            }
            setting_set($key, (string) $id);
            tf_log($me['name'], 'sms_template', $which . ' → ' . ($id ?: '—'));
        }
        if (array_key_exists('sms_owner', $in)) {
            $raw = tf_line($in['sms_owner'] ?? '', 30);
            $mob = tf_phone($raw);
            if ($raw !== '' && $mob === '') {
                throw new TfInvalid('sms_owner', 'شماره موبایل درست نیست.');
            }
            setting_set('sms_owner', $mob === '' ? '-' : $mob);
            tf_log($me['name'], 'sms_owner', $mob);
        }
        ok(['settings' => tf_public_settings(), 'sms' => sms_state(), 'pay' => tz_panel()]);

    case 'sms_credit':                  // the SMS balance at sms.ir, on the settings page
        ceo_only($ceo);
        [$good, $data] = tf_sms_call('GET', 'credit');
        ok(['credit' => $good ? (int) $data : null]);

    case 'sms_test':                    // one real «new order» SMS to the owner's mobile
        ceo_only($ceo);
        $to = tf_sms_owner();
        if (!tf_sms_config() || $to === '') {
            throw new TfInvalid('sms_owner', 'اول پیامک و شماره‌ی خبر سفارش رو تنظیم کن.');
        }
        tf_throttle('smstest:' . $me['id'], 5, 3600);
        $sent = tf_sms_send($to, 'owner', ['CODE' => 'TF-00000', 'AMOUNT' => '0']);
        tf_log($me['name'], 'sms_test', $sent ? 'ok' : 'failed');
        if (!$sent) {
            tf_fail(502, 'sms');
        }
        ok(['sent' => true]);

    /* --------------------------------------------------------- stories */
    case 'stories':
        $now = time();
        $live = db()->prepare('SELECT * FROM stories WHERE expires_at > ? ORDER BY created_at DESC, id DESC');
        $live->execute([$now]);
        $old = db()->prepare('SELECT * FROM stories WHERE expires_at <= ? ORDER BY created_at DESC, id DESC LIMIT 120');
        $old->execute([$now]);
        ok(['live' => array_map('staff_story', $live->fetchAll()), 'archive' => array_map('staff_story', $old->fetchAll()),
            'now' => $now, 'cap' => tf_upload_cap(TF_STORY_CAP), 'looks' => (object) tf_looks_edits()]);

    case 'story_add':                   // multipart: media (+ poster for a video), caption_*, items, link
        $f = $_FILES['media'] ?? null;
        $cap = tf_upload_cap(TF_STORY_CAP);
        $err = is_array($f) ? (int) ($f['error'] ?? UPLOAD_ERR_NO_FILE) : UPLOAD_ERR_NO_FILE;
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE || (is_array($f) && (int) $f['size'] > $cap)) {
            throw new TfInvalid('media', 'فایل بزرگ‌تر از ' . tf_mb($cap) . 'ه.');
        }
        if ($err !== UPLOAD_ERR_OK || !is_uploaded_file((string) $f['tmp_name'])) {
            throw new TfInvalid('media', 'فایل آپلود نشد؛ دوباره امتحان کن.');
        }
        $type = tf_sniff((string) $f['tmp_name'], (string) ($f['name'] ?? ''), false);
        if (!$type || !in_array($type[0], ['image', 'video'], true) || $type[1] === 'image/gif') {
            throw new TfInvalid('media', 'فقط عکس (JPG، PNG، WebP) یا ویدیو (MP4).');
        }
        $caption = story_caption($in);
        $items = story_items($in['items'] ?? '[]');
        $link = tf_link_clean($in['link'] ?? '');
        $poster = '';
        if ($type[0] === 'image') {
            [$media, $w, $h] = tf_story_image((string) $f['tmp_name']);
            $kind = 'image';
        } else {
            $media = story_video($f, $type);
            $kind = 'video';
            $w = max(0, min(8000, tf_int($in['w'] ?? 0)));
            $h = max(0, min(8000, tf_int($in['h'] ?? 0)));
            $pf = $_FILES['poster'] ?? null;
            if (is_array($pf) && (int) ($pf['error'] ?? 4) === UPLOAD_ERR_OK && is_uploaded_file((string) $pf['tmp_name'])) {
                try {
                    [$poster] = tf_story_image((string) $pf['tmp_name']);
                } catch (TfInvalid $e) {
                    $poster = '';                   // a video without a cover still plays
                }
            }
        }
        $now = time();
        db()->prepare('INSERT INTO stories (kind, media, poster, w, h, caption, items, link, by_name, created_at, expires_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$kind, $media, $poster, $w, $h, json_encode($caption, JSON_UNESCAPED_UNICODE),
                json_encode($items), $link ? json_encode($link, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
                $me['name'], $now, $now + TF_STORY_SECS]);
        $sid = (int) db()->lastInsertId();
        tf_log($me['name'], 'story_add', $kind === 'video' ? 'ویدیو' : 'عکس');
        ok(['story' => staff_story(story_or_404($sid))]);

    case 'story_edit':
        $s = story_or_404((int) ($in['id'] ?? 0));
        $link = tf_link_clean($in['link'] ?? []);
        db()->prepare('UPDATE stories SET caption = ?, items = ?, link = ? WHERE id = ?')
            ->execute([json_encode(story_caption($in), JSON_UNESCAPED_UNICODE), json_encode(story_items($in['items'] ?? [])),
                $link ? json_encode($link, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '', $s['id']]);
        tf_log($me['name'], 'story_edit', '#' . $s['id']);
        ok(['story' => staff_story(story_or_404((int) $s['id']))]);

    /* The studio's outfit stories (js/data.js): only the panel's changes are
       kept, one entry per story; «look_reset» drops a story's changes. */
    case 'look_save':
        $lid = (string) ($in['id'] ?? '');
        if (!preg_match('/^[a-z0-9-]{1,24}$/', $lid)) {
            tf_fail(400, 'invalid');
        }
        $edit = tf_look_clean(is_array($in['look'] ?? null) ? $in['look'] : []);
        $all = tf_looks_change(static function (array $all) use ($lid, $edit): array {
            if ($edit) {
                $all[$lid] = $edit;
            } else {
                unset($all[$lid]);
            }
            return $all;
        });
        tf_log($me['name'], 'look_save', $lid);
        ok(['looks' => (object) $all]);

    case 'look_reset':
        $lid = (string) ($in['id'] ?? '');
        $all = tf_looks_change(static function (array $all) use ($lid): array {
            unset($all[$lid]);
            return $all;
        });
        tf_log($me['name'], 'look_reset', preg_match('/^[a-z0-9-]{1,24}$/', $lid) ? $lid : '');
        ok(['looks' => (object) $all]);

    case 'story_repost':                // back on the site for another 24 hours, at the front
        $s = story_or_404((int) ($in['id'] ?? 0));
        $now = time();
        db()->prepare('UPDATE stories SET created_at = ?, expires_at = ? WHERE id = ?')->execute([$now, $now + TF_STORY_SECS, $s['id']]);
        tf_log($me['name'], 'story_repost', '#' . $s['id']);
        ok(['story' => staff_story(story_or_404((int) $s['id']))]);

    case 'story_end':                   // off the site now, kept in the archive
        $s = story_or_404((int) ($in['id'] ?? 0));
        db()->prepare('UPDATE stories SET expires_at = ? WHERE id = ? AND expires_at > ?')->execute([time(), $s['id'], time()]);
        tf_log($me['name'], 'story_end', '#' . $s['id']);
        ok(['story' => staff_story(story_or_404((int) $s['id']))]);

    case 'story_delete':
        $s = story_or_404((int) ($in['id'] ?? 0));
        db()->prepare('DELETE FROM stories WHERE id = ?')->execute([$s['id']]);
        foreach (tf_story_files($s) as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }
        tf_log($me['name'], 'story_delete', '#' . $s['id']);
        ok();

    /* --------------------------------------------------------- tickets */
    case 'tickets':
        $status = in_array($in['status'] ?? '', TF_TICKET_STATUSES, true) ? (string) $in['status'] : '';
        $q = tf_line($in['q'] ?? '', 60);
        $where = ['1 = 1'];
        $args = [];
        if ($status !== '') {
            $where[] = 't.status = ?';
            $args[] = $status;
        }
        if ($q !== '') {
            $d = tf_digits($q);
            $where[] = '(t.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR t.subject LIKE ?)';
            array_push($args, "%$d%", "%$q%", "%$d%", "%$q%");
        }
        $counts = array_fill_keys(TF_TICKET_STATUSES, 0);
        foreach (db()->query('SELECT status, COUNT(*) n FROM tickets GROUP BY status') as $r) {
            $counts[$r['status']] = (int) $r['n'];
        }
        ok(['tickets' => tf_tickets_list(implode(' AND ', $where), $args, 's', 300), 'counts' => $counts,
            'caps' => ['file' => tf_upload_cap(TF_FILE_CAP), 'files' => TF_FILES_PER_MSG]]);

    case 'ticket':
        $t = staff_ticket((string) ($in['code'] ?? ''));
        tf_ticket_seen($t, 's');
        ok(staff_thread($t) + ['caps' => ['file' => tf_upload_cap(TF_FILE_CAP), 'files' => TF_FILES_PER_MSG]]);

    case 'ticket_reply':                // multipart: code, body, product, files[], voice, voice_secs
        $t = staff_ticket((string) ($in['code'] ?? ''));
        $files = tf_intake(tf_files_list($_FILES['files'] ?? null), $_FILES['voice'] ?? null, (int) ($in['voice_secs'] ?? 0));
        [$body, $product] = tf_message_in($in, $files);
        tf_ticket_post($t, 's', $me['name'], $body, $product, $files);
        tf_log($me['name'], 'ticket_reply', $t['code']);
        /* One «you have an answer» SMS per ticket every 15 minutes, however
           many messages the team sends in a row. */
        $mark = db()->prepare('UPDATE tickets SET sms_at = ? WHERE id = ? AND sms_at < ?');
        $mark->execute([time(), $t['id'], time() - 900]);
        if ($mark->rowCount() === 1) {
            $st = db()->prepare('SELECT name, phone FROM customers WHERE id = ?');
            $st->execute([$t['customer_id']]);
            $c = $st->fetch();
            $st->closeCursor();
            if ($c) {
                tf_after(static function () use ($c, $t): void {
                    tf_sms_ticket_answered((string) $c['phone'], (string) $c['name'], (string) $t['code']);
                });
            }
        }
        ok(staff_thread(staff_ticket($t['code'])));

    case 'ticket_status':               // close a ticket, or open it again
        $t = staff_ticket((string) ($in['code'] ?? ''));
        $to = (string) ($in['status'] ?? '');
        if (!in_array($to, ['open', 'closed'], true)) {
            throw new TfInvalid('status', 'وضعیت نامعتبره.');
        }
        if ($to === 'open') {
            $to = $t['last_from'] === 's' ? 'answered' : 'open';
        }
        db()->prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?')->execute([$to, time(), $t['id']]);
        tf_log($me['name'], $to === 'closed' ? 'ticket_close' : 'ticket_open', $t['code']);
        ok(staff_thread(staff_ticket($t['code'])));

    /* ------------------------------------------------------------ team */
    case 'team':
        ceo_only($ceo);
        $rows = db()->query('SELECT id, name, email, role, active, created_at, last_login FROM users ORDER BY id')->fetchAll();
        ok(['team' => array_map(static fn ($r) => [
            'id' => (int) $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'role' => $r['role'],
            'active' => (bool) $r['active'], 'created_at' => (int) $r['created_at'],
            'last_login' => $r['last_login'] ? (int) $r['last_login'] : null,
        ], $rows), 'me' => (int) $me['id']]);

    case 'team_save':
        ceo_only($ceo);
        $id = (int) ($in['id'] ?? 0);
        $name = tf_line($in['name'] ?? '', 60);
        if (mb_strlen($name) < 2) {
            throw new TfInvalid('name', 'اسم رو بنویس.');
        }
        $email = valid_email((string) ($in['email'] ?? ''));
        $role = in_array($in['role'] ?? '', TF_ROLES, true) ? $in['role'] : 'admin';
        $active = !array_key_exists('active', $in) || !empty($in['active']);
        $dupe = db()->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $dupe->execute([$email, $id]);
        $taken = $dupe->fetchColumn();
        $dupe->closeCursor();
        if ($taken) {
            throw new TfInvalid('email', 'این ایمیل قبلاً ثبت شده.');
        }
        if ($id) {
            if ($id === (int) $me['id'] && ($role !== 'ceo' || !$active)) {
                throw new TfInvalid('role', 'نقش یا وضعیت خودت رو نمی‌تونی عوض کنی.');
            }
            $sets = 'name = ?, email = ?, role = ?, active = ?, sv = sv + ?';
            $args = [$name, $email, $role, $active ? 1 : 0, 1];
            if ((string) ($in['password'] ?? '') !== '') {
                $sets .= ', pass = ?';
                $args[] = password_hash(valid_password((string) $in['password']), PASSWORD_DEFAULT);
            }
            $args[] = $id;
            db()->prepare("UPDATE users SET $sets WHERE id = ?")->execute($args);
            if ($id === (int) $me['id']) {
                $st = db()->prepare('SELECT * FROM users WHERE id = ?');
                $st->execute([$id]);
                $fresh = $st->fetch();
                $st->closeCursor();
                tf_sign_in($fresh);
            }
            tf_log($me['name'], 'team_edit', $email);
        } else {
            $pass = valid_password((string) ($in['password'] ?? ''));
            db()->prepare('INSERT INTO users (name, email, pass, role, active, sv, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                ->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), $role, $active ? 1 : 0, tf_new_sv(), time()]);
            tf_log($me['name'], 'team_add', $email . ' (' . $role . ')');
        }
        ok(['csrf' => $_SESSION['csrf']]);

    case 'team_delete':
        ceo_only($ceo);
        $id = (int) ($in['id'] ?? 0);
        if ($id === (int) $me['id']) {
            throw new TfInvalid('id', 'خودت رو نمی‌تونی حذف کنی.');
        }
        $st = db()->prepare('SELECT email FROM users WHERE id = ?');
        $st->execute([$id]);
        $email = $st->fetchColumn();
        $st->closeCursor();
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        tf_log($me['name'], 'team_delete', (string) $email);
        ok();

    case 'log':
        ceo_only($ceo);
        ok(['log' => db()->query('SELECT at, who, action, detail FROM log ORDER BY id DESC LIMIT 150')->fetchAll()]);
}

tf_fail(400, 'unknown_action');

/* ====================================================================== */

/** What the settings page shows about SMS (never the key itself). */
function sms_state(): array
{
    return ['configured' => tf_sms_config() !== null, 'on' => setting('sms_on', '1') === '1', 'owner' => tf_sms_owner(),
        'otp' => tf_sms_template('otp'), 'ticket' => tf_sms_template('ticket')];
}

/* --------------------------------------------------------------- stories */
/** Up to six pieces a story points at, each one a product that exists. */
function story_items($raw): array
{
    if (is_string($raw)) {
        $raw = json_decode($raw, true);
    }
    $out = [];
    foreach (array_slice(is_array($raw) ? $raw : [], 0, 12) as $id) {
        $id = (string) $id;
        if (preg_match('/^[a-z0-9][a-z0-9-]{1,60}$/', $id) && tf_product($id) && !in_array($id, $out, true)) {
            $out[] = $id;
        }
    }
    if (count($out) > 6) {
        throw new TfInvalid('items', 'هر استوری حداکثر ۶ محصول.');
    }
    return $out;
}

function story_caption(array $in): array
{
    $c = is_array($in['caption'] ?? null) ? $in['caption']
        : ['fa' => $in['caption_fa'] ?? '', 'en' => $in['caption_en'] ?? '', 'tr' => $in['caption_tr'] ?? ''];
    return tf_i18n($c, 140);
}

/** A story as the panel sees it: the public one plus who on the team posted it. */
function staff_story(array $r): array
{
    return tf_story_out($r) + ['by' => $r['by_name']];
}

function story_or_404(int $id): array
{
    $st = db()->prepare('SELECT * FROM stories WHERE id = ?');
    $st->execute([$id]);
    $s = $st->fetch();
    $st->closeCursor();
    if (!$s) {
        tf_fail(404, 'not_found');
    }
    return $s;
}

/** A video for a story: MP4 (H.264) or WebM, kept as it came. HEVC is
    refused with the way out, because most Android phones show it black. */
function story_video(array $f, array $type): string
{
    if (!in_array($type[1], ['video/mp4', 'video/quicktime', 'video/webm'], true)) {
        throw new TfInvalid('media', 'ویدیو باید MP4 باشه.');
    }
    if ($type[1] !== 'video/webm' && tf_video_codec((string) $f['tmp_name']) === 'hevc') {
        throw new TfInvalid('media', 'این ویدیو با فرمت HEVC ضبط شده و روی بیشتر گوشی‌های اندروید پخش نمی‌شه. '
            . 'توی آیفون: Settings ← Camera ← Formats ← Most Compatible، و دوباره ضبط کن؛ '
            . 'یا ویدیو رو با اینستاگرام یا CapCut به MP4 خروجی بگیر.');
    }
    $dir = tf_web_root() . '/uploads/s';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $ext = $type[1] === 'video/webm' ? 'webm' : 'mp4';
    $rel = 'uploads/s/' . bin2hex(random_bytes(10)) . '.' . $ext;
    if (!move_uploaded_file((string) $f['tmp_name'], tf_web_root() . '/' . $rel)) {
        throw new RuntimeException('could not keep the story video');
    }
    @chmod(tf_web_root() . '/' . $rel, 0644);
    return $rel;
}

/* --------------------------------------------------------------- tickets */
function staff_ticket(string $code): array
{
    $t = tf_ticket_by_code($code);
    if (!$t) {
        tf_fail(404, 'not_found');
    }
    return $t;
}

/** A thread as the team sees it: who the customer is, how many orders they
    placed, and who on the team wrote each answer. */
function staff_thread(array $t): array
{
    $st = db()->prepare('SELECT name, phone, created_at FROM customers WHERE id = ?');
    $st->execute([$t['customer_id']]);
    $c = $st->fetch() ?: ['name' => '', 'phone' => '', 'created_at' => 0];
    $st->closeCursor();
    $n = db()->prepare('SELECT COUNT(*) FROM orders WHERE phone = ?');
    $n->execute([$c['phone']]);
    return ['ticket' => [
        'code' => $t['code'], 'subject' => $t['subject'], 'status' => $t['status'],
        'created_at' => (int) $t['created_at'], 'updated_at' => (int) $t['updated_at'],
    ], 'customer' => ['name' => $c['name'], 'phone' => $c['phone'], 'since' => (int) $c['created_at'],
        'orders' => (int) $n->fetchColumn()],
        'notify' => tf_sms_on() && tf_sms_template('ticket') > 0] + tf_ticket_thread($t, true);
}

/** 7, 30 or 90 days; anything else (or nothing) is 30. */
function days_of(array $in): int
{
    $d = (int) ($in['days'] ?? 30);
    return in_array($d, [7, 30, 90], true) ? $d : 30;
}

function order_or_404(string $code): array
{
    $st = db()->prepare('SELECT * FROM orders WHERE code = ?');
    $st->execute([$code]);
    $o = $st->fetch();
    $st->closeCursor();
    if (!$o) {
        tf_fail(404, 'not_found');
    }
    return tf_order_public($o);
}

/** Money and orders over the last N days, against the N days before. */
function dashboard(int $days, bool $money): array
{
    $db = db();
    $range = tf_days($days);
    $from = $range[0];
    $prevFrom = date('Y-m-d', strtotime($from . " -$days days"));
    $today = date('Y-m-d');

    $st = $db->prepare('SELECT * FROM orders WHERE day >= ? ORDER BY created_at');
    $st->execute([$prevFrom]);
    $rows = $st->fetchAll();

    $byDay = array_fill_keys($range, ['orders' => 0, 'revenue' => 0]);
    $tot = ['orders' => 0, 'revenue' => 0, 'cancelled' => 0, 'items' => 0];
    $prev = ['orders' => 0, 'revenue' => 0];
    $todayT = ['orders' => 0, 'revenue' => 0];
    $products = [];
    $cats = [];
    $statuses = array_fill_keys(TF_STATUSES, 0);
    foreach ($rows as $o) {
        $live = $o['status'] !== 'cancelled';
        $total = $live ? (int) $o['total'] : 0;
        if ($o['day'] < $from) {
            $prev['orders'] += $live ? 1 : 0;
            $prev['revenue'] += $total;
            continue;
        }
        $statuses[$o['status']]++;
        if (!$live) {
            $tot['cancelled']++;
            continue;
        }
        $byDay[$o['day']]['orders']++;
        $byDay[$o['day']]['revenue'] += $total;
        $tot['orders']++;
        $tot['revenue'] += $total;
        if ($o['day'] === $today) {
            $todayT['orders']++;
            $todayT['revenue'] += $total;
        }
        foreach (json_decode((string) $o['items'], true) ?: [] as $it) {
            $id = (string) $it['id'];
            $products[$id] ??= ['id' => $id, 'name' => $it['name'], 'img' => $it['img'] ?? '', 'qty' => 0, 'revenue' => 0];
            $products[$id]['qty'] += (int) $it['qty'];
            $products[$id]['revenue'] += (int) $it['line'];
            $cats[$it['cat']] = ($cats[$it['cat']] ?? 0) + (int) $it['line'];
            $tot['items'] += (int) $it['qty'];
        }
    }

    $visits = $db->prepare('SELECT day, views, visitors FROM daily WHERE day >= ?');
    $visits->execute([$from]);
    $v = array_fill_keys($range, ['views' => 0, 'visitors' => 0]);
    foreach ($visits->fetchAll() as $r) {
        if (isset($v[$r['day']])) {
            $v[$r['day']] = ['views' => (int) $r['views'], 'visitors' => (int) $r['visitors']];
        }
    }
    $visitors = array_sum(array_column($v, 'visitors'));

    usort($products, static fn ($a, $b) => [$b['qty'], $b['revenue']] <=> [$a['qty'], $a['revenue']]);
    arsort($cats);

    $pending = (int) $db->query("SELECT COUNT(*) FROM orders WHERE status = 'new'")->fetchColumn();
    $toShip = (int) $db->query("SELECT COUNT(*) FROM orders WHERE status = 'confirmed'")->fetchColumn();

    $low = [];
    $hidden = 0;
    foreach (tf_products(false) as $p) {
        if (!$p['visible']) {
            $hidden++;
        }
        if (is_array($p['stock'] ?? null)) {
            $out = array_keys(array_filter($p['stock'], static fn ($n) => (int) $n <= 0));
            $few = array_keys(array_filter($p['stock'], static fn ($n) => (int) $n > 0 && (int) $n <= 2));
            if ($out || $few) {
                $low[] = ['id' => $p['id'], 'name' => $p['name']['fa'], 'img' => $p['images'][0] ?? '',
                    'out' => $out, 'few' => $few];
            }
        }
    }

    $series = [];
    foreach ($range as $d) {
        $series[] = ['day' => $d, 'orders' => $byDay[$d]['orders'],
            'revenue' => $money ? $byDay[$d]['revenue'] : null,
            'visitors' => $v[$d]['visitors'], 'views' => $v[$d]['views']];
    }

    $out = [
        'days' => $days,
        'today' => [
            'orders' => $todayT['orders'],
            'revenue' => $money ? $todayT['revenue'] : null,
            'visitors' => $v[$today]['visitors'] ?? 0,
            'views' => $v[$today]['views'] ?? 0,
        ],
        'pending' => $pending,
        'to_ship' => $toShip,
        'totals' => [
            'orders' => $tot['orders'],
            'items' => $tot['items'],
            'cancelled' => $tot['cancelled'],
            'visitors' => $visitors,
            'conversion' => $visitors ? round($tot['orders'] / $visitors * 100, 1) : null,
            'revenue' => $money ? $tot['revenue'] : null,
            'average' => $money && $tot['orders'] ? (int) round($tot['revenue'] / $tot['orders']) : null,
            'prev_orders' => $prev['orders'],
            'prev_revenue' => $money ? $prev['revenue'] : null,
        ],
        'series' => $series,
        'statuses' => $statuses,
        'top' => array_map(static function ($p) use ($money) {
            if (!$money) {
                $p['revenue'] = null;
            }
            return $p;
        }, array_slice($products, 0, 8)),
        'categories' => $money ? $cats : null,
        'low_stock' => array_slice($low, 0, 12),
        'hidden' => $hidden,
        'money' => $money,
        'store_open' => setting('store_open', '0') === '1',
    ];
    return $out;
}

/** What people look at, day by day. */
function traffic(int $days): array
{
    $db = db();
    $range = tf_days($days);
    $from = $range[0];
    $st = $db->prepare('SELECT day, views, visitors FROM daily WHERE day >= ?');
    $st->execute([$from]);
    $by = array_fill_keys($range, ['views' => 0, 'visitors' => 0]);
    foreach ($st->fetchAll() as $r) {
        if (isset($by[$r['day']])) {
            $by[$r['day']] = ['views' => (int) $r['views'], 'visitors' => (int) $r['visitors']];
        }
    }
    $pages = $db->prepare('SELECT page, SUM(n) n FROM pageviews WHERE day >= ? GROUP BY page ORDER BY n DESC');
    $pages->execute([$from]);
    $names = [];
    foreach (tf_products(false) as $p) {
        $names[$p['id']] = ['name' => $p['name']['fa'], 'img' => $p['images'][0] ?? ''];
    }
    $top = [];
    $prods = [];
    foreach ($pages->fetchAll() as $r) {
        [$kind, $id] = array_pad(explode(':', $r['page'], 2), 2, '');
        if ($kind === 'p') {
            if (isset($names[$id])) {
                $prods[] = ['id' => $id, 'n' => (int) $r['n']] + $names[$id];
            }
            continue;
        }
        $top[] = ['page' => $r['page'], 'n' => (int) $r['n']];
    }
    $series = [];
    foreach ($range as $d) {
        $series[] = ['day' => $d] + $by[$d];
    }
    return [
        'days' => $days,
        'series' => $series,
        'views' => array_sum(array_column($by, 'views')),
        'visitors' => array_sum(array_column($by, 'visitors')),
        'pages' => array_slice($top, 0, 12),
        'products' => array_slice($prods, 0, 12),
        'devices' => devices($from),
    ];
}

/** The cookie sheet's tallies since $from: per dimension, values by count,
    plus how many visitors those counts cover and how many said yes or no. */
function devices(string $from): array
{
    $st = db()->prepare('SELECT dim, val, SUM(n) n FROM devices WHERE day >= ? GROUP BY dim, val ORDER BY n DESC');
    $st->execute([$from]);
    $out = ['known' => 0, 'consent' => ['yes' => 0, 'no' => 0]];
    foreach (array_keys(TF_DEV) as $dim) {
        $out[$dim] = [];
    }
    foreach ($st->fetchAll() as $r) {
        $n = (int) $r['n'];
        if ($r['dim'] === 'consent') {
            if (isset($out['consent'][$r['val']])) {
                $out['consent'][$r['val']] = $n;
            }
            continue;
        }
        if (isset(TF_DEV[$r['dim']])) {
            $out[$r['dim']][] = ['v' => $r['val'], 'n' => $n];
        }
    }
    // every counted visitor has a type, so the type total is the head count
    $out['known'] = array_sum(array_column($out['type'], 'n'));
    return $out;
}

/** People who ordered, newest first, one row per phone number. */
function customers(string $q, bool $money): array
{
    $rows = db()->query('SELECT name, phone, city, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5000')->fetchAll();
    $by = [];
    foreach ($rows as $r) {
        $k = $r['phone'];
        if (!isset($by[$k])) {
            $by[$k] = ['name' => $r['name'], 'phone' => $r['phone'], 'city' => $r['city'],
                'orders' => 0, 'spent' => 0, 'last' => (int) $r['created_at'], 'first' => (int) $r['created_at']];
        }
        $by[$k]['orders']++;
        $by[$k]['first'] = (int) $r['created_at'];
        if ($r['status'] !== 'cancelled') {
            $by[$k]['spent'] += (int) $r['total'];
        }
    }
    $list = array_values($by);
    if ($q !== '') {
        $d = tf_digits($q);
        $list = array_values(array_filter($list, static fn ($c) =>
            mb_stripos($c['name'], $q) !== false || strpos($c['phone'], $d) !== false
            || mb_stripos($c['city'], $q) !== false));
    }
    if (!$money) {
        foreach ($list as &$c) {
            $c['spent'] = null;
        }
        unset($c);
    }
    return $list;
}

/* ---------------------------------------------------------------- photos */
/** Store one product photo: upright, cropped to 4:5, 960 and 480 wide, WebP. */
function save_photo($f): string
{
    if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
        throw new TfInvalid('photo', 'عکس آپلود نشد.');
    }
    if ($f['size'] > 25 * 1024 * 1024) {
        throw new TfInvalid('photo', 'عکس بزرگ‌تر از ۲۵ مگابایته.');
    }
    $info = @getimagesize($f['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
        throw new TfInvalid('photo', 'فقط عکس JPG، PNG یا WebP.');
    }
    if ($info[0] * $info[1] > 60000000) {
        throw new TfInvalid('photo', 'ابعاد عکس خیلی بزرگه.');
    }
    $bytes = (string) file_get_contents($f['tmp_name']);
    $src = @imagecreatefromstring($bytes);
    if (!$src) {
        throw new TfInvalid('photo', 'این عکس باز نشد.');
    }
    if ($info[2] === IMAGETYPE_JPEG) {
        $o = jpeg_orientation($bytes);
        if (in_array($o, [2, 4, 5, 7], true)) {
            imageflip($src, $o === 4 ? IMG_FLIP_VERTICAL : IMG_FLIP_HORIZONTAL);
        }
        $turn = [3 => 180, 5 => 90, 6 => -90, 7 => -90, 8 => 90][$o] ?? 0;
        if ($turn) {
            $r = imagerotate($src, $turn, 0);
            imagedestroy($src);
            $src = $r;
        }
    }
    $w = imagesx($src);
    $h = imagesy($src);
    if ($w / $h > 0.8) {
        $cw = (int) round($h * 0.8);
        $ch = $h;
    } else {
        $cw = $w;
        $ch = (int) round($w / 0.8);
    }
    $x = (int) floor(($w - $cw) / 2);
    $y = (int) floor(($h - $ch) / 2);

    $dir = tf_web_root() . '/uploads/p';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $guard = tf_web_root() . '/uploads/.htaccess';
    if (!is_file($guard)) {
        file_put_contents($guard, "# Photos only: nothing in here ever runs.\nOptions -Indexes -ExecCGI\n"
            . "<FilesMatch \"\\.(php[0-9]?|phtml|phar|pl|py|cgi|sh|html?)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    $name = bin2hex(random_bytes(10));
    foreach ([960, 480] as $tw) {
        $tw2 = min($tw, $cw);
        $th = (int) round($tw2 * 1.25);
        $dst = imagecreatetruecolor($tw2, $th);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, $x, $y, $tw2, $th, $cw, $ch);
        if (!imagewebp($dst, "$dir/$name-$tw.webp", 82)) {
            throw new RuntimeException('webp write failed');
        }
        @chmod("$dir/$name-$tw.webp", 0644);
        imagedestroy($dst);
    }
    imagedestroy($src);
    return 'uploads/p/' . $name;
}
