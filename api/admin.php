<?php
/* /api/admin.php — everything the panel does, one action per request.

   Request: POST JSON {"a": "<action>", ...} (photo uploads are multipart with
   a=upload). Every action except state/setup/login/recover needs a signed-in
   user, the same origin and the X-CSRF token handed out at sign-in.

   Two roles:
     ceo   — everything: money and income reports, settings, the team
     admin — products, orders and customers; never totals of money,
             never settings or other people's accounts */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    tf_fail(405, 'method');
}
tf_same_origin();
tf_session();

$isMultipart = stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') === 0;
$in = $isMultipart ? $_POST : tf_input();
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
        tf_throttle('key:' . tf_ip(), 10, 3600);
        if (!tf_key_matches((string) ($in['key'] ?? ''))) {
            throw new TfInvalid('key', 'کلید راه‌اندازی درست نیست.');
        }
        $name = tf_line($in['name'] ?? '', 60);
        if (mb_strlen($name) < 2) {
            throw new TfInvalid('name', 'اسمت رو بنویس.');
        }
        $email = valid_email((string) ($in['email'] ?? ''));
        $pass = valid_password((string) ($in['password'] ?? ''));
        db()->prepare('INSERT INTO users (name, email, pass, role, created_at) VALUES (?, ?, ?, \'ceo\', ?)')
            ->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), time()]);
        tf_key_rotate();
        $u = db()->query('SELECT * FROM users ORDER BY id DESC LIMIT 1')->fetch();
        tf_sign_in($u);
        tf_log($name, 'setup', 'CEO account created');
        ok(me_out($u));

    case 'login':
        $email = strtolower(tf_line($in['email'] ?? '', 120));
        $pass = (string) ($in['password'] ?? '');
        $ipKey = 'login:ip:' . tf_ip();
        $emKey = 'login:em:' . $email;
        if (tf_too_many($ipKey, 20, 900) || tf_too_many($emKey, 6, 900)) {
            tf_fail(429, 'too_many');
        }
        $st = db()->prepare('SELECT * FROM users WHERE email = ? AND active = 1');
        $st->execute([$email]);
        $u = $st->fetch();
        if (!$u || !password_verify($pass, $u['pass'])) {
            if (!$u) {
                password_verify($pass, '$2y$12$M388vkOYIwdvG5OuPSrCtOrmnPS7w52kJS9wW68fm6RWoEkbWcm9W'); // same work as a real check
            }
            tf_note_attempt($ipKey);
            tf_note_attempt($emKey);
            tf_fail(401, 'wrong');
        }
        if (password_needs_rehash($u['pass'], PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE users SET pass = ? WHERE id = ?')
                ->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        }
        tf_clear_attempts($emKey);
        tf_sign_in($u);
        tf_log($u['name'], 'login');
        ok(me_out($u));

    case 'recover':
        tf_throttle('key:' . tf_ip(), 10, 3600);
        if (!tf_key_matches((string) ($in['key'] ?? ''))) {
            throw new TfInvalid('key', 'کلید درست نیست.');
        }
        $email = valid_email((string) ($in['email'] ?? ''));
        $pass = valid_password((string) ($in['password'] ?? ''));
        $st = db()->prepare("SELECT * FROM users WHERE email = ? AND role = 'ceo' AND active = 1");
        $st->execute([$email]);
        $u = $st->fetch();
        if (!$u) {
            throw new TfInvalid('email', 'مدیرعاملی با این ایمیل نداریم.');
        }
        db()->prepare('UPDATE users SET pass = ?, sv = sv + 1 WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        tf_key_rotate();
        $st->execute([$email]);
        $u = $st->fetch();
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

    case 'ping':                        // the badge on «سفارش‌ها», every minute or so
        ok(['pending' => (int) db()->query("SELECT COUNT(*) FROM orders WHERE status = 'new'")->fetchColumn()]);

    case 'password':
        if (!password_verify((string) ($in['current'] ?? ''), $me['pass'])) {
            throw new TfInvalid('current', 'رمز فعلی درست نیست.');
        }
        $pass = valid_password((string) ($in['password'] ?? ''));
        db()->prepare('UPDATE users SET pass = ?, sv = sv + 1 WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_DEFAULT), $me['id']]);
        $st = db()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$me['id']]);
        tf_sign_in($st->fetch());           // this device stays in, every other one is out
        tf_log($me['name'], 'password');
        ok(['csrf' => $_SESSION['csrf']]);

    /* ------------------------------------------------------- dashboard */
    case 'dashboard':
        $days = in_array((int) ($in['days'] ?? 30), [7, 30, 90], true) ? (int) $in['days'] : 30;
        ok(dashboard($days, $ceo));

    case 'traffic':
        $days = in_array((int) ($in['days'] ?? 30), [7, 30, 90], true) ? (int) $in['days'] : 30;
        ok(traffic($days));

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
        $old = $id !== '' ? tf_product($id) : null;
        if ($id !== '' && !$old) {
            tf_fail(404, 'not_found');
        }
        $p = tf_product_clean($raw, $old ? $old['id'] : null);
        $now = time();
        if ($old) {
            tf_product_store($p);
            tf_log($me['name'], 'product_edit', $p['name']['fa']);
        } else {
            db()->prepare('INSERT INTO products (id, data, cat, price, visible, sort, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
                ->execute([$p['id'], json_encode($p, JSON_UNESCAPED_UNICODE), $p['cat'], $p['price'],
                    $p['visible'] ? 1 : 0, $now, $now]);
            tf_log($me['name'], 'product_add', $p['name']['fa']);
        }
        ok(['product' => tf_product($p['id'])]);

    case 'product_visible':
        $p = tf_product((string) ($in['id'] ?? ''));
        if (!$p) {
            tf_fail(404, 'not_found');
        }
        $p['visible'] = !empty($in['visible']);
        tf_product_store($p);
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
            if ($to === 'cancelled') {
                tf_restock($o['items']);
            }
            $db->prepare('UPDATE orders SET status = ?, updated_at = ? WHERE code = ?')
                ->execute([$to, time(), $o['code']]);
            $db->exec('COMMIT');
            tf_log($me['name'], 'order_status', $o['code'] . ' → ' . $to);
        }
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
        ok(['settings' => tf_public_settings()]);

    case 'settings_save':
        ceo_only($ceo);
        $open = !empty($in['store_open']);
        setting_set('store_open', $open ? '1' : '0');
        tf_log($me['name'], $open ? 'store_open' : 'store_close');
        ok(['settings' => tf_public_settings()]);

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
        if ($dupe->fetchColumn()) {
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
                tf_sign_in($st->fetch());
            }
            tf_log($me['name'], 'team_edit', $email);
        } else {
            $pass = valid_password((string) ($in['password'] ?? ''));
            db()->prepare('INSERT INTO users (name, email, pass, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), $role, $active ? 1 : 0, time()]);
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
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        tf_log($me['name'], 'team_delete', (string) $email);
        ok();

    case 'log':
        ceo_only($ceo);
        ok(['log' => db()->query('SELECT at, who, action, detail FROM log ORDER BY id DESC LIMIT 150')->fetchAll()]);
}

tf_fail(400, 'unknown_action');

/* ====================================================================== */

function order_or_404(string $code): array
{
    $st = db()->prepare('SELECT * FROM orders WHERE code = ?');
    $st->execute([$code]);
    $o = $st->fetch();
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
    ];
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
/** JPEG orientation (1–8) from the EXIF block, read by hand: no extension needed. */
function jpeg_orientation(string $b): int
{
    if (strncmp($b, "\xFF\xD8", 2) !== 0) {
        return 1;
    }
    $len = strlen($b);
    $i = 2;
    while ($i + 4 < $len && $b[$i] === "\xFF") {
        $marker = ord($b[$i + 1]);
        if ($marker === 0xDA || $marker === 0xD9) {
            break;
        }
        $seg = unpack('n', substr($b, $i + 2, 2))[1];
        if ($marker === 0xE1 && substr($b, $i + 4, 6) === "Exif\0\0") {
            $t = $i + 10;
            $le = substr($b, $t, 2) === 'II';
            $u16 = static fn (int $o) => unpack($le ? 'v' : 'n', substr($b, $o, 2))[1];
            $u32 = static fn (int $o) => unpack($le ? 'V' : 'N', substr($b, $o, 4))[1];
            $ifd = $t + $u32($t + 4);
            if ($ifd + 2 > $len) {
                return 1;
            }
            $n = $u16($ifd);
            for ($k = 0; $k < $n; $k++) {
                $e = $ifd + 2 + $k * 12;
                if ($e + 12 > $len) {
                    break;
                }
                if ($u16($e) === 0x0112) {
                    $o = $u16($e + 8);
                    return $o >= 1 && $o <= 8 ? $o : 1;
                }
            }
            return 1;
        }
        $i += 2 + $seg;
    }
    return 1;
}

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
