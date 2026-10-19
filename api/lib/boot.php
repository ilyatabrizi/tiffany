<?php
/* TIFFANY's back office — the one file every endpoint starts with.

   Storage is a single SQLite file OUTSIDE the web root
   (/home/tiffany1/tiffany-data on the host), next to the setup key and the
   admin sessions. Nothing in that folder can ever be fetched over HTTP.

   Security, in one place:
   - passwords: password_hash() (bcrypt); never stored or logged in clear
   - sessions: own save path, HttpOnly + Secure + SameSite=Strict cookie
     scoped to /api/, id regenerated on login, a per-user "session version"
     that logs every device out when the password changes
   - every admin write carries an X-CSRF token and must be same-origin
   - logins, the setup key, orders and tracking are rate-limited per IP
   - every query is a prepared statement; every input is validated here
   - the first CEO account can only be created with the setup key, which
     sits in a file only someone with cPanel access can read */
declare(strict_types=1);

ini_set('display_errors', '0');      // errors go to tiffany-data/error.log, never to the page
date_default_timezone_set('Asia/Tehran');
mb_internal_encoding('UTF-8');

const TF_ROLES    = ['ceo', 'admin'];
const TF_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const TF_CATS     = ['knit', 'tee', 'top', 'hoodie', 'vest', 'shirt', 'trousers', 'skirts',
                     'jacket', 'cardigan', 'accessories', 'shoes'];
/* The Autumn / Winter 2027 collections, one per photo set (js/data.js has their names). */
const TF_COLS     = ['',
                     'aw27-pink-mohair',
                     'aw27-pink-fleece',
                     'aw27-black-leather',
                     'aw27-denim-red',
                     'aw27-aubergine',
                     'aw27-brown-leather',
                     'aw27-grey-pink',
                     'aw27-grey-red',
                     'aw27-olive-brown',
                     'aw27-chocolate-wool',
                     'aw27-olive-khaki'];
/* Letter sizes, then trouser waist (34–42) and shoe sizes (37–40), then one size. */
const TF_SIZES    = ['XS', 'S', 'M', 'L', 'XL', '34', '36', '37', '38', '39', '40', '42', 'OS'];
const TF_FITS     = ['small', 'true', 'relaxed'];
const TF_BADGES   = ['', 'new', 'campaign', 'bestseller', 'restock', 'last'];
const TF_LANGS    = ['fa', 'en', 'tr'];
const TF_SESSION_DAYS = 30;
const TF_CUSTOMER_DAYS = 90;
/* One order: at most 5 of the same piece, size and colour, 20 pieces in all.
   The shop's bag stops at the same numbers (js/store.js). */
const TF_LINE_MAX = 5;
const TF_ORDER_MAX = 20;

/* --------------------------------------------------------------- output */
function tf_json(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
    $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $after = $GLOBALS['tf_after'] ?? [];
    if (!$after) {
        echo $body;
        exit;
    }
    /* Work queued with tf_after (an SMS) runs once the answer has gone out,
       so nobody waits on another company's server. */
    $GLOBALS['tf_after'] = [];
    header('Content-Length: ' . strlen($body));
    header('Connection: close');
    echo $body;
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    if (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
    } elseif (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        @ob_end_flush();
        flush();
    }
    ignore_user_abort(true);
    foreach ($after as $fn) {
        try {
            $fn();
        } catch (Throwable $e) {
            tf_log_error($e);
        }
    }
    exit;
}

/** Run $fn after this request's answer has been sent (see tf_json). */
function tf_after(callable $fn): void
{
    $GLOBALS['tf_after'][] = $fn;
}

function tf_fail(int $code, string $error, array $extra = []): void
{
    tf_json(['ok' => false, 'error' => $error] + $extra, $code);
}

/** A validation problem the panel can show next to the field it names. */
final class TfInvalid extends RuntimeException
{
    public string $field;
    public function __construct(string $field, string $message)
    {
        parent::__construct($message);
        $this->field = $field;
    }
}

/** A refusal deep inside a step (a quota found full under the lock): thrown,
    so the caller can clean up on the way out, then answered as status+word. */
final class TfRefuse extends RuntimeException
{
    public int $status;
    public string $word;
    public function __construct(int $status, string $word)
    {
        parent::__construct($word);
        $this->status = $status;
        $this->word = $word;
    }
}

set_exception_handler(static function (Throwable $e): void {
    if ($e instanceof TfRefuse) {
        tf_fail($e->status, $e->word);
    }
    if ($e instanceof TfInvalid) {
        tf_fail(422, 'invalid', ['field' => $e->field, 'message' => $e->getMessage()]);
    }
    tf_log_error($e);
    tf_fail(500, 'server');
});

function tf_log_error(Throwable $e): void
{
    try {
        $line = date('c') . ' ' . get_class($e) . ': ' . $e->getMessage()
            . ' @ ' . basename($e->getFile()) . ':' . $e->getLine() . "\n";
        @file_put_contents(tf_data_dir() . '/error.log', $line, FILE_APPEND | LOCK_EX);
    } catch (Throwable $ignored) {
        // nowhere left to write; the 500 still goes out
    }
}

function tf_input(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 2000000);
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

/* --------------------------------------------------------------- storage */
function tf_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $want = getenv('TIFFANY_DATA') ?: dirname(__DIR__, 3) . '/tiffany-data';
    /* The database, the sessions and the setup key must never be fetchable:
       a data folder inside the web root is refused before anything is made. */
    $web = rtrim((string) realpath(dirname(__DIR__, 2)), '/');
    $parent = realpath(dirname($want));
    $full = $parent !== false ? rtrim($parent, '/') . '/' . basename($want) : $want;
    $inside = $web !== '' && ($full === $web || strpos($full . '/', $web . '/') === 0);
    if (!$inside && !is_dir($want)) {
        @mkdir($want, 0700, true);
    }
    if ($inside || !is_dir($want) || !is_writable($want)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo '{"ok":false,"error":"storage"}';
        exit;
    }
    $dir = rtrim((string) realpath($want), '/');
    return $dir;
}

/** The public web root (public_html on the host). */
function tf_web_root(): string
{
    return dirname(__DIR__, 2);
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . tf_data_dir() . '/tiffany.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 8,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 8000');
    $pdo->exec('PRAGMA foreign_keys = ON');
    tf_migrate($pdo);
    tf_import_catalog($pdo);
    return $pdo;
}

/* A whole catalogue, dropped into tiffany-data/catalog-import.json (outside
   the web root, so only someone with cPanel can put it there), replaces every
   product once. Its hash is remembered: the same file never imports twice, a
   changed one imports again. Every piece is validated before anything is
   touched; one bad piece and nothing changes (the reason goes to error.log). */
function tf_import_catalog(PDO $db): void
{
    $file = tf_data_dir() . '/catalog-import.json';
    if (!is_file($file)) {
        return;
    }
    /* Size and modification time first: an unchanged file is not even read,
       so leaving it in the folder costs every request nothing. */
    $st = stat($file);
    $stamp = $st['size'] . ':' . $st['mtime'] . ':' . $st['ino'] . ':' . $st['ctime'];
    $seen = $db->query("SELECT v FROM settings WHERE k = 'import_stamp'")->fetchColumn();
    if ($seen === $stamp) {
        return;
    }
    $raw = (string) file_get_contents($file);
    $sha = hash('sha256', $raw);
    $done = $db->query("SELECT v FROM settings WHERE k = 'import_sha'")->fetchColumn();
    if ($done === $sha) {
        $db->prepare("INSERT INTO settings (k, v) VALUES ('import_stamp', ?)
                      ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([$stamp]);
        return;
    }
    $db->exec('BEGIN IMMEDIATE');
    try {
        $again = $db->query("SELECT v FROM settings WHERE k = 'import_sha'")->fetchColumn();
        if ($again === $sha) {
            $db->exec('COMMIT');
            return;
        }
        $list = json_decode($raw, true);
        $clean = [];
        $ids = [];
        foreach (is_array($list) ? $list : [] as $i => $p) {
            /* Every piece names its own id, once: an id made up here could
               clash with one about to be deleted or with another piece. */
            $pid = is_array($p) ? (string) ($p['id'] ?? '') : '';
            if ($pid === '' || isset($ids[$pid])) {
                throw new RuntimeException("catalog-import piece #$i: missing or repeated id '$pid'");
            }
            $ids[$pid] = true;
            try {
                $clean[] = tf_product_clean((array) $p, $pid);
            } catch (TfInvalid $e) {
                throw new RuntimeException("catalog-import piece #$i: {$e->field}: {$e->getMessage()}");
            }
        }
        if (!$clean) {
            throw new RuntimeException('catalog-import: no pieces');
        }
        $db->exec('DELETE FROM products');
        $ins = $db->prepare('INSERT INTO products (id, data, cat, price, visible, sort, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $now = time();
        foreach ($clean as $i => $c) {
            $ins->execute([$c['id'], json_encode($c, JSON_UNESCAPED_UNICODE), $c['cat'], $c['price'],
                !empty($c['visible']) ? 1 : 0, $i, $now, $now]);
        }
        $mark = $db->prepare("INSERT INTO settings (k, v) VALUES (?, ?)
                              ON CONFLICT(k) DO UPDATE SET v = excluded.v");
        $mark->execute(['import_sha', $sha]);
        $mark->execute(['import_stamp', $stamp]);
        $db->prepare('INSERT INTO log (at, who, action, detail) VALUES (?, ?, ?, ?)')
            ->execute([$now, 'سیستم', 'catalog_import', count($clean) . ' محصول']);
        $db->exec('COMMIT');
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        // remember the failure so a broken file is not retried on every request
        $mark = $db->prepare("INSERT INTO settings (k, v) VALUES (?, ?)
                              ON CONFLICT(k) DO UPDATE SET v = excluded.v");
        $mark->execute(['import_sha', $sha]);
        $mark->execute(['import_stamp', $stamp]);
        tf_log_error($e);
    }
}

function tf_migrate(PDO $db): void
{
    $version = (int) $db->query('PRAGMA user_version')->fetchColumn();
    if ($version < 1) {
        tf_migrate_1($db);
    }
    if ($version < 2) {
        /* Device counts, only for visitors who said yes to the cookie sheet.
           One row per day and value, never one per person: devseen keeps the
           same day-salted hash as `seen` so a visitor counts once a day, and
           it is thrown away after two days like `seen`. */
        $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS devices (day TEXT NOT NULL, dim TEXT NOT NULL, val TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, dim, val));
CREATE TABLE IF NOT EXISTS devseen (day TEXT NOT NULL, vid TEXT NOT NULL, PRIMARY KEY (day, vid));
PRAGMA user_version = 2;
SQL);
    }
    if ($version < 3) {
        /* The old-attempt sweep runs inside page-view writes; without this it
           reads the whole table. */
        $db->exec('CREATE INDEX IF NOT EXISTS attempts_at ON attempts(at); PRAGMA user_version = 3;');
    }
    if ($version < 4) {
        tf_migrate_4($db);
    }
    if ($version < 5) {
        tf_migrate_5($db);
    }
    if ($version < 6) {
        tf_migrate_6($db);
    }
    if ($version < 7) {
        tf_migrate_7($db);
    }
}

/* 2026-10-20: the season, one collection («aw27») until now, is eleven, one
   per photo set. Each piece the studio's import put in «aw27» moves to its
   set; nothing else about it changes (price, stock, sizes, photos, shown or
   hidden: whatever the panel has made of it stays). A piece not on this list
   leaves «aw27», which no longer exists, for no collection. */
const TF_COLS_2026_10 = [
    'aw27-pink-mohair' => ['white-leather-bag', 'pastel-cotton-cap', 'mohair-top', 'mohair-trousers', 'buttoned-wool-knit', 'wool-scarf', 'white-jeans'],
    'aw27-pink-fleece' => ['silk-satin-bandana', 'fleece-sweatshirt', 'fleece-trousers', 'faux-fur-coat', 'wool-teddy-coat'],
    'aw27-black-leather' => ['oiled-leather-jacket', 'wool-underknit', 'cotton-cap', 'chocolate-jeans', 'cotton-foulard', 'oiled-leather-trench', 'white-collar-underknit', 'avishu-top', 'avishu-trousers', 'karl-lagerfeld-bag', 'cotton-turtleneck'],
    'aw27-denim-red' => ['denim-jacket', 'dark-jeans', 'high-neck-wool-knit', 'patchwork-bandana', 'gabardine-trench', 'ribbed-knit', 'cotton-shirt', 'red-bandana', 'waterproof-sneakers'],
    'aw27-aubergine' => ['short-fur-jacket', 'pure-wool-underknit', 'plain-shirt', 'green-cream-jeans', 'print-bandana', 'striped-wool-knit', 'collared-sweatshirt', 'sweat-trousers'],
    'aw27-brown-leather' => ['brown-paisley-bandana', 'waterproof-leather-bomber', 'two-tone-wool-knit', 'baseball-cap', 'waterproof-leather-jacket', 'two-tone-stripe-knit', 'light-ripped-jeans'],
    'aw27-grey-pink' => ['logo-cap', 'patterned-wool-knit', 'avishu-vest', 'avishu-trousers-grey', 'black-white-bandana', 'striped-pink-knit', 'bomber-jacket', 'dors-trousers'],
    'aw27-grey-red' => ['cotton-shirt-white', 'white-wool-knit', 'light-wide-jeans', 'hooded-fur-jacket', 'cotton-trousers', 'dors-sweatshirt', 'oversize-coat'],
    'aw27-olive-brown' => ['marc-jacobs-bag', 'waxed-trench', 'avishu-sweatshirt', 'avishu-trousers-olive', 'floral-bandana', 'fine-wool-knit', 'waxed-trousers', 'zara-bag'],
    'aw27-chocolate-wool' => ['gabardine-trousers', 'pure-wool-cardigan', 'turtleneck', 'satin-paisley-bandana', 'pure-wool-jacket', 'trench-skirt', 'four-colour-bandana'],
    'aw27-olive-khaki' => ['canvas-cap', 'cream-wool-knit', 'waxed-vest', 'grey-jeans', 'short-trench'],
];

function tf_migrate_7(PDO $db): void
{
    $db->exec('BEGIN IMMEDIATE');
    try {
        if ((int) $db->query('PRAGMA user_version')->fetchColumn() < 7) {
            $to = [];
            foreach (TF_COLS_2026_10 as $col => $ids) {
                foreach ($ids as $id) {
                    $to[$id] = $col;
                }
            }
            $set = $db->prepare('UPDATE products SET data = ?, updated_at = ? WHERE id = ?');
            $now = time();
            foreach ($db->query('SELECT id, data FROM products')->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $d = json_decode((string) $r['data'], true);
                if (!is_array($d)) {
                    continue;
                }
                $was = $d;
                if (($d['col'] ?? '') === 'aw27') {
                    $d['col'] = $to[$r['id']] ?? '';
                }
                /* The second crop of this knit showed the bag more than the
                   knit; it goes, unless the panel has changed the photos. */
                if ($r['id'] === 'white-wool-knit'
                    && ($d['images'] ?? null) === ['assets/img/r-white-wool-knit', 'assets/img/r-white-wool-knit-2']) {
                    $d['images'] = ['assets/img/r-white-wool-knit'];
                }
                if ($d !== $was) {
                    $set->execute([json_encode($d, JSON_UNESCAPED_UNICODE), $now, $r['id']]);
                }
            }
            $db->exec('PRAGMA user_version = 7');
        }
        $db->exec('COMMIT');
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
}

/** 2026-10-20: a story can carry one link (a button on the story: a page of
    the shop or any https address, with its own words). */
function tf_migrate_6(PDO $db): void
{
    $db->exec('BEGIN IMMEDIATE');
    try {
        if ((int) $db->query('PRAGMA user_version')->fetchColumn() < 6) {
            $have = array_column($db->query('PRAGMA table_info(stories)')->fetchAll(PDO::FETCH_ASSOC), 'name');
            if (!in_array('link', $have, true)) {
                $db->exec("ALTER TABLE stories ADD COLUMN link TEXT NOT NULL DEFAULT ''");
            }
            $db->exec('PRAGMA user_version = 6');
        }
        $db->exec('COMMIT');
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
}

/** 2026-10-19: card-to-card through «تأیید شد» (api/lib/pay.php). Each
    order keeps its tayidshod payment: the state, tayidshod's id, the unique
    amount, the payment page, test or live, and whether the money is in.
    Columns are added one by one inside a lock, so two requests opening the
    database at the same moment cannot both add the same one. */
function tf_migrate_5(PDO $db): void
{
    $db->exec('BEGIN IMMEDIATE');
    try {
        if ((int) $db->query('PRAGMA user_version')->fetchColumn() < 5) {
            $have = array_column($db->query('PRAGMA table_info(orders)')->fetchAll(PDO::FETCH_ASSOC), 'name');
            $cols = [
                'pay_state' => "TEXT NOT NULL DEFAULT ''", 'pay_ref' => "TEXT NOT NULL DEFAULT ''",
                'pay_amount' => 'INTEGER NOT NULL DEFAULT 0', 'pay_url' => "TEXT NOT NULL DEFAULT ''",
                'pay_mode' => "TEXT NOT NULL DEFAULT ''", 'paid' => 'INTEGER NOT NULL DEFAULT 0',
                'paid_at' => 'INTEGER',
            ];
            foreach ($cols as $name => $def) {
                if (!in_array($name, $have, true)) {
                    $db->exec("ALTER TABLE orders ADD COLUMN $name $def");
                }
            }
            $db->exec('CREATE INDEX IF NOT EXISTS orders_pay_ref ON orders(pay_ref)');
            $db->exec('PRAGMA user_version = 5');
        }
        $db->exec('COMMIT');
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
}

/** 2026-10-18: customer accounts (phone checked by an SMS code), support
    tickets with their messages and private files, and the panel's 24-hour
    stories. */
function tf_migrate_4(PDO $db): void
{
    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pass TEXT NOT NULL,
  sv INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_login INTEGER
);
CREATE TABLE IF NOT EXISTS otps (
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (phone, purpose)
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  last_from TEXT NOT NULL DEFAULT 'c',
  seen_c INTEGER NOT NULL DEFAULT 0,
  seen_s INTEGER NOT NULL DEFAULT 0,
  sms_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_customer ON tickets(customer_id, updated_at);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets(status, updated_at);
CREATE TABLE IF NOT EXISTS ticket_msgs (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  product TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_msgs_t ON ticket_msgs(ticket_id, id);
CREATE TABLE IF NOT EXISTS ticket_files (
  id TEXT PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  msg_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  ext TEXT NOT NULL,
  size INTEGER NOT NULL,
  voice INTEGER NOT NULL DEFAULT 0,
  secs INTEGER NOT NULL DEFAULT 0,
  w INTEGER NOT NULL DEFAULT 0,
  h INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_files_msg ON ticket_files(msg_id);
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  media TEXT NOT NULL,
  poster TEXT NOT NULL DEFAULT '',
  w INTEGER NOT NULL DEFAULT 0,
  h INTEGER NOT NULL DEFAULT 0,
  caption TEXT NOT NULL DEFAULT '{}',
  items TEXT NOT NULL DEFAULT '[]',
  by_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS stories_exp ON stories(expires_at);
PRAGMA user_version = 4;
SQL);
}

function tf_migrate_1(PDO $db): void
{
    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sv INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_login INTEGER
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  cat TEXT NOT NULL,
  price INTEGER NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'new',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  postal TEXT NOT NULL DEFAULT '',
  pay TEXT NOT NULL,
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_day ON orders(day);
CREATE INDEX IF NOT EXISTS orders_phone ON orders(phone);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (k TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS attempts_k ON attempts(k, at);
CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS seen (day TEXT NOT NULL, vid TEXT NOT NULL, PRIMARY KEY (day, vid));
CREATE TABLE IF NOT EXISTS pageviews (day TEXT NOT NULL, page TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, page));
CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, who TEXT NOT NULL,
  action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
PRAGMA user_version = 1;
SQL);
    tf_seed($db);
}

/** First run only: the catalogue that was on the site before the panel. */
function tf_seed(PDO $db): void
{
    $have = $db->query("SELECT v FROM settings WHERE k = 'seeded'")->fetchColumn();
    if ($have) {
        return;
    }
    $file = __DIR__ . '/seed.json';
    $list = is_file($file) ? json_decode((string) file_get_contents($file), true) : [];
    $now = time();
    $ins = $db->prepare('INSERT OR IGNORE INTO products (id, data, cat, price, visible, sort, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $db->beginTransaction();
    foreach ((array) $list as $i => $p) {
        $clean = tf_product_clean($p, (string) $p['id']);
        $ins->execute([$clean['id'], json_encode($clean, JSON_UNESCAPED_UNICODE), $clean['cat'],
            $clean['price'], $clean['visible'] ? 1 : 0, $i, $now - $i, $now]);
    }
    $db->prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)')->execute(['seeded', (string) $now]);
    $db->commit();
}

function setting(string $k, string $default = ''): string
{
    $st = db()->prepare('SELECT v FROM settings WHERE k = ?');
    $st->execute([$k]);
    $v = $st->fetchColumn();
    return $v === false ? $default : (string) $v;
}

function setting_set(string $k, string $v): void
{
    db()->prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)')->execute([$k, $v]);
}

/** What the storefront needs to know besides the products. */
function tf_public_settings(): array
{
    return [
        'store_open' => setting('store_open', '0') === '1',
        'shipping' => 0,
        'delivery_days' => 3,
    ];
}

/* --------------------------------------------------------------- helpers */
function tf_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 64);
}

/** The address a rate limit counts against. One IPv6 subscriber holds a whole
    /64 and can hop inside it freely, so IPv6 is counted per /64. */
function tf_ip_key(): string
{
    $ip = tf_ip();
    if (stripos($ip, '::ffff:') === 0 && strpos($ip, '.') !== false) {
        return substr($ip, 7);          // an IPv4 visitor written the IPv6 way
    }
    if (strpos($ip, ':') !== false) {
        $bin = @inet_pton($ip);
        if ($bin !== false && strlen($bin) === 16) {
            return bin2hex(substr($bin, 0, 8)) . '::/64';
        }
    }
    return $ip;
}

/** Persian and Arabic digits typed on a phone become ASCII. */
function tf_digits(string $s): string
{
    return strtr($s, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ]);
}

/** One line of text: trimmed, no control characters, capped. */
function tf_line($v, int $max): string
{
    $s = is_scalar($v) ? (string) $v : '';
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max);
}

/** A paragraph: line breaks kept, everything else as tf_line. */
function tf_text($v, int $max): string
{
    $s = is_scalar($v) ? (string) $v : '';
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = preg_replace("/\n{3,}/", "\n\n", $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

function tf_int($v): int
{
    $s = preg_replace('/[^0-9]/', '', tf_digits(is_scalar($v) ? (string) $v : '')) ?? '';
    return $s === '' ? 0 : (int) substr($s, 0, 12);
}

/** Iranian mobile, normalised to 09xxxxxxxxx; '' when it is not one. */
function tf_phone($v): string
{
    $s = preg_replace('/[^0-9]/', '', tf_digits(is_scalar($v) ? (string) $v : '')) ?? '';
    if (strpos($s, '0098') === 0) {
        $s = '0' . substr($s, 4);
    } elseif (strpos($s, '98') === 0 && strlen($s) === 12) {
        $s = '0' . substr($s, 2);
    } elseif (strlen($s) === 10 && $s[0] === '9') {
        $s = '0' . $s;
    }
    return preg_match('/^09\d{9}$/', $s) ? $s : '';
}

function tf_log(string $who, string $action, string $detail = ''): void
{
    db()->prepare('INSERT INTO log (at, who, action, detail) VALUES (?, ?, ?, ?)')
        ->execute([time(), mb_substr($who, 0, 80), $action, mb_substr($detail, 0, 300)]);
}

/* ---------------------------------------------------------- rate limits */
function tf_too_many(string $key, int $max, int $window): bool
{
    $st = db()->prepare('SELECT COUNT(*) FROM attempts WHERE k = ? AND at > ?');
    $st->execute([$key, time() - $window]);
    return (int) $st->fetchColumn() >= $max;
}

function tf_note_attempt(string $key): void
{
    db()->prepare('INSERT INTO attempts (k, at) VALUES (?, ?)')->execute([$key, time()]);
    if (random_int(1, 50) === 1) {
        db()->prepare('DELETE FROM attempts WHERE at < ?')->execute([time() - 86400]);
    }
}

function tf_clear_attempts(string $key): void
{
    db()->prepare('DELETE FROM attempts WHERE k = ?')->execute([$key]);
}

/** Count a try first, then decide, in one locked step, so requests arriving
    together cannot all slip in under a limit. $limits: [[key, max, window],
    …]. False (and nothing counted) when any of them is already full. Not to
    be called inside another transaction. */
function tf_spend(array $limits): bool
{
    $db = db();
    $now = time();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $st = $db->prepare('SELECT COUNT(*) FROM attempts WHERE k = ? AND at > ?');
        foreach ($limits as [$k, $max, $win]) {
            $st->execute([$k, $now - $win]);
            $n = (int) $st->fetchColumn();
            $st->closeCursor();
            if ($n >= $max) {
                $db->exec('COMMIT');
                return false;
            }
        }
        $ins = $db->prepare('INSERT INTO attempts (k, at) VALUES (?, ?)');
        foreach ($limits as [$k]) {
            $ins->execute([$k, $now]);
        }
        $db->exec('COMMIT');
        return true;
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
}

/** Give one counted try back (it turned out to be the right password). */
function tf_unspend(string $key): void
{
    db()->prepare('DELETE FROM attempts WHERE rowid = (SELECT rowid FROM attempts WHERE k = ? ORDER BY at DESC LIMIT 1)')
        ->execute([$key]);
}

/** The address a DAILY limit counts against: an IPv6 subscriber usually holds
    a whole /48, so it counts as one; IPv4 as it is. */
function tf_ip_wide(): string
{
    $k = tf_ip_key();
    return substr($k, -5) === '::/64' ? substr($k, 0, 12) . '::/48' : $k;
}

function tf_throttle(string $key, int $max, int $window): void
{
    if (tf_too_many($key, $max, $window)) {
        tf_fail(429, 'too_many');
    }
    tf_note_attempt($key);
}

/* ------------------------------------------------------------ setup key */
function tf_key_file(): string
{
    return tf_data_dir() . '/SETUP-KEY.txt';
}

function tf_key_rotate(): void
{
    $abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $groups = [];
    for ($g = 0; $g < 4; $g++) {
        $chunk = '';
        for ($i = 0; $i < 4; $i++) {
            $chunk .= $abc[random_int(0, strlen($abc) - 1)];
        }
        $groups[] = $chunk;
    }
    $key = implode('-', $groups);
    $text = "TIFFANY admin panel — setup / recovery key\n"
        . "کلید راه‌اندازی و بازیابی پنل مدیریت تیفانی\n\n"
        . $key . "\n\n"
        . "Use it at https://tiffanybv.com/admin to create the first CEO account,\n"
        . "or to set a new CEO password if it is forgotten.\n"
        . "It changes by itself after every use. Never send it to anyone.\n";
    file_put_contents(tf_key_file(), $text, LOCK_EX);
    @chmod(tf_key_file(), 0600);
}

function tf_key_ensure(): void
{
    if (!is_file(tf_key_file())) {
        tf_key_rotate();
    }
}

function tf_key_matches(string $typed): bool
{
    tf_key_ensure();
    if (!preg_match('/\b([A-Z2-9]{4}(?:-[A-Z2-9]{4}){3})\b/', (string) file_get_contents(tf_key_file()), $m)) {
        return false;
    }
    $want = str_replace('-', '', $m[1]);
    $got = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', tf_digits($typed)) ?? '');
    return strlen($got) === 16 && hash_equals($want, $got);
}

/* ------------------------------------------------------------- sessions */
/** Two kinds of session, never open in the same request: the panel's
    (cookie tf_admin, 30 days) and a shop customer's (tf_shop, 90 days), each
    in its own folder so their clean-up lifetimes never mix. */
function tf_session(string $kind = 'admin'): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $shop = $kind === 'shop';
    $days = $shop ? TF_CUSTOMER_DAYS : TF_SESSION_DAYS;
    $dir = tf_data_dir() . ($shop ? '/sessions-shop' : '/sessions');
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    session_save_path($dir);
    ini_set('session.gc_maxlifetime', (string) ($days * 86400));
    /* This folder is our own, so the host's cleanup cron never visits it:
       PHP sweeps expired sessions itself, on about one start in a hundred. */
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '100');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name($shop ? 'tf_shop' : 'tf_admin');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    session_set_cookie_params([
        'lifetime' => $days * 86400,
        'path' => '/api/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function tf_user_public(array $u): array
{
    return ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role']];
}

/** The signed-in admin, or null. A password change bumps sv and ends every other session. */
function tf_user(): ?array
{
    /* No cookie, no session: an anonymous request must not leave a session
       file behind (thousands of them would eat the host's file quota). */
    if (session_status() !== PHP_SESSION_ACTIVE && !isset($_COOKIE['tf_admin'])) {
        return null;
    }
    tf_session();
    $id = (int) ($_SESSION['uid'] ?? 0);
    if (!$id) {
        // a stale or made-up cookie: drop the empty session it just opened
        session_destroy();
        return null;
    }
    $st = db()->prepare('SELECT * FROM users WHERE id = ? AND active = 1');
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u || (int) $u['sv'] !== (int) ($_SESSION['sv'] ?? -1)) {
        $_SESSION = [];
        return null;
    }
    return $u;
}

/** A new account's first session version. Random, not 1: SQLite hands a
    deleted user's id to the next account, and an old cookie holding that id
    and version 1 must not wake up as the new person. */
function tf_new_sv(): int
{
    return random_int(1000, 2000000000);
}

/** A hash to check unknown emails against, made the way real ones are made
    here, so a wrong email costs the same time as a wrong password. */
function tf_dummy_hash(): string
{
    $h = setting('dummy_hash');
    if ($h === '' || password_needs_rehash($h, PASSWORD_DEFAULT)) {
        $h = password_hash(bin2hex(random_bytes(12)), PASSWORD_DEFAULT);
        setting_set('dummy_hash', $h);
    }
    return $h;
}

function tf_sign_in(array $u): void
{
    tf_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $u['id'];
    $_SESSION['sv'] = (int) $u['sv'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    db()->prepare('UPDATE users SET last_login = ? WHERE id = ?')->execute([time(), $u['id']]);
}

function tf_sign_out(string $kind = 'admin'): void
{
    tf_session($kind);
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000, 'path' => $p['path'], 'secure' => $p['secure'],
            'httponly' => true, 'samesite' => 'Strict',
        ]);
    }
    session_destroy();
}

/** Writes must come from this site: same origin, and with the session's token. */
function tf_same_origin(): void
{
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($site !== '' && $site !== 'same-origin' && $site !== 'none') {
        tf_fail(403, 'origin');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
        if (strcasecmp($host, (string) ($_SERVER['HTTP_HOST'] ?? '')) !== 0) {
            tf_fail(403, 'origin');
        }
    }
}

function tf_require_csrf(): void
{
    $sent = (string) ($_SERVER['HTTP_X_CSRF'] ?? '');
    $want = (string) ($_SESSION['csrf'] ?? '');
    if ($want === '' || !hash_equals($want, $sent)) {
        tf_fail(403, 'csrf');
    }
}

/* -------------------------------------------------------------- catalog */
/** The three-language text block every product field uses. */
function tf_i18n($v, int $max, bool $multiline = false): array
{
    $v = is_array($v) ? $v : ['fa' => $v];
    $out = [];
    foreach (TF_LANGS as $l) {
        $out[$l] = $multiline ? tf_text($v[$l] ?? '', $max) : tf_line($v[$l] ?? '', $max);
    }
    return $out;
}

function tf_slug(string $s): string
{
    $s = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $s) ?? '', '-'));
    return substr($s, 0, 48);
}

/** Validate and normalise one product. Throws TfInvalid naming the field. */
function tf_product_clean(array $in, ?string $id = null): array
{
    $name = tf_i18n($in['name'] ?? [], 80);
    if ($name['fa'] === '') {
        throw new TfInvalid('name', 'اسم محصول رو بنویس.');
    }
    $cat = (string) ($in['cat'] ?? '');
    if (!in_array($cat, TF_CATS, true)) {
        throw new TfInvalid('cat', 'یه دسته‌بندی انتخاب کن.');
    }
    $col = (string) ($in['col'] ?? '');
    if (!in_array($col, TF_COLS, true)) {
        $col = '';
    }
    $price = tf_int($in['price'] ?? 0);
    if ($price < 1000 || $price > 100000000000) {
        throw new TfInvalid('price', 'قیمت رو به تومان بنویس.');
    }

    $sizes = array_values(array_unique(array_filter((array) ($in['sizes'] ?? []),
        static fn ($s) => in_array($s, TF_SIZES, true))));
    usort($sizes, static fn ($a, $b) => array_search($a, TF_SIZES, true) <=> array_search($b, TF_SIZES, true));
    if (!$sizes) {
        throw new TfInvalid('sizes', 'حداقل یه سایز انتخاب کن.');
    }
    if (in_array('OS', $sizes, true)) {
        $sizes = ['OS'];
    }

    $stock = null;
    if (isset($in['stock']) && is_array($in['stock'])) {
        $stock = [];
        foreach ($sizes as $s) {
            $stock[$s] = max(0, min(99999, tf_int($in['stock'][$s] ?? 0)));
        }
    }

    $colours = [];
    foreach (array_slice((array) ($in['colours'] ?? []), 0, 12) as $c) {
        if (!is_array($c)) {
            continue;
        }
        $hex = strtoupper((string) ($c['hex'] ?? ''));
        if (!preg_match('/^#[0-9A-F]{6}$/', $hex)) {
            throw new TfInvalid('colours', 'کد یکی از رنگ‌ها درست نیست.');
        }
        $names = tf_i18n($c, 30);
        if ($names['fa'] === '') {
            throw new TfInvalid('colours', 'برای هر رنگ یه اسم بنویس.');
        }
        foreach ($colours as $prev) {
            if ($prev['hex'] === $hex) {
                throw new TfInvalid('colours', 'یه رنگ دو بار اضافه شده.');
            }
        }
        $colours[] = ['hex' => $hex] + $names;
    }
    if (!$colours) {
        throw new TfInvalid('colours', 'حداقل یه رنگ اضافه کن.');
    }

    $images = [];
    foreach (array_slice((array) ($in['images'] ?? []), 0, 10) as $img) {
        $img = (string) $img;
        if (preg_match('#^assets/img/[a-z0-9-]{2,60}$#', $img)) {
            $images[] = $img;
        } elseif (preg_match('#^uploads/p/[a-f0-9]{20}$#', $img)
            && is_file(tf_web_root() . '/' . $img . '-480.webp')) {
            $images[] = $img;
        }
    }
    $images = array_values(array_unique($images));
    if (!$images) {
        throw new TfInvalid('images', 'حداقل یه عکس بذار.');
    }

    $fit = in_array($in['fit'] ?? '', TF_FITS, true) ? $in['fit'] : 'true';
    $badge = in_array($in['badge'] ?? '', TF_BADGES, true) ? (string) ($in['badge'] ?? '') : '';

    if ($id === null || $id === '') {
        $id = tf_slug((string) ($name['en'] ?: ''));
        if (strlen($id) < 3) {
            $id = 'p-' . bin2hex(random_bytes(3));
        }
        $base = $id;
        $n = 2;
        $st = db()->prepare('SELECT 1 FROM products WHERE id = ?');
        while (true) {
            $st->execute([$id]);
            if (!$st->fetchColumn()) {
                break;
            }
            $id = $base . '-' . $n++;
        }
    }
    if (!preg_match('/^[a-z0-9][a-z0-9-]{1,60}$/', $id)) {
        throw new TfInvalid('id', 'bad id');
    }

    return [
        'id' => $id,
        'name' => $name,
        'cat' => $cat,
        'col' => $col,
        'price' => $price,
        'images' => $images,
        'sizes' => $sizes,
        'stock' => $stock,
        'fit' => $fit,
        'badge' => $badge,
        'colours' => $colours,
        'note' => tf_i18n($in['note'] ?? [], 300, true),
        'detail' => tf_i18n($in['detail'] ?? [], 1200, true),
        'fabric' => tf_i18n($in['fabric'] ?? [], 600, true),
        'care' => tf_i18n($in['care'] ?? [], 600, true),
        'visible' => !empty($in['visible']),
    ];
}

function tf_product_row(array $row): array
{
    $p = json_decode((string) $row['data'], true) ?: [];
    $p['id'] = $row['id'];
    $p['visible'] = (bool) $row['visible'];
    $p['sort'] = (int) $row['sort'];
    $p['updated_at'] = (int) $row['updated_at'];
    $p['created_at'] = (int) $row['created_at'];
    return $p;
}

function tf_products(bool $onlyVisible): array
{
    $sql = 'SELECT * FROM products' . ($onlyVisible ? ' WHERE visible = 1' : '')
        . ' ORDER BY sort ASC, created_at DESC';
    return array_map('tf_product_row', db()->query($sql)->fetchAll());
}

function tf_product(string $id): ?array
{
    $st = db()->prepare('SELECT * FROM products WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    return $row ? tf_product_row($row) : null;
}

/* --------------------------------------------------------------- orders */
/* card: by card on delivery. c2c: card-to-card at checkout through «تأیید شد»
   (api/lib/pay.php). online: reserved for a bank gateway. */
const TF_PAY = ['card', 'c2c', 'online'];

function tf_order_public(array $o): array
{
    return [
        'code' => $o['code'],
        'status' => $o['status'],
        'name' => $o['name'],
        'phone' => $o['phone'],
        'city' => $o['city'],
        'address' => $o['address'],
        'postal' => $o['postal'],
        'pay' => $o['pay'],
        'pay_state' => (string) ($o['pay_state'] ?? ''),
        'pay_ref' => (string) ($o['pay_ref'] ?? ''),
        'pay_amount' => (int) ($o['pay_amount'] ?? 0),
        'pay_mode' => (string) ($o['pay_mode'] ?? ''),
        'pay_url' => (string) ($o['pay_url'] ?? ''),
        'paid' => (int) ($o['paid'] ?? 0) === 1,
        'paid_at' => (int) ($o['paid_at'] ?? 0),
        'items' => json_decode((string) $o['items'], true) ?: [],
        'subtotal' => (int) $o['subtotal'],
        'shipping' => (int) $o['shipping'],
        'total' => (int) $o['total'],
        'note' => $o['note'],
        'admin_note' => $o['admin_note'],
        'created_at' => (int) $o['created_at'],
        'updated_at' => (int) $o['updated_at'],
    ];
}

/** Put the pieces of an order back on the shelf (when it is cancelled). */
function tf_restock(array $items): void
{
    foreach ($items as $it) {
        $p = tf_product((string) ($it['id'] ?? ''));
        if (!$p || !is_array($p['stock'] ?? null) || !array_key_exists($it['size'], $p['stock'])) {
            continue;
        }
        $p['stock'][$it['size']] += (int) $it['qty'];
        tf_product_store($p);
    }
}

/** Write a product back. updated_at moves, so the shop's catalogue ETag moves too. */
function tf_product_store(array $p): void
{
    $data = $p;
    unset($data['sort'], $data['updated_at'], $data['created_at']);
    db()->prepare('UPDATE products SET data = ?, cat = ?, price = ?, visible = ?, updated_at = ? WHERE id = ?')
        ->execute([json_encode($data, JSON_UNESCAPED_UNICODE), $p['cat'], $p['price'],
            !empty($p['visible']) ? 1 : 0, time(), $p['id']]);
}

/* --------------------------------------------------------------- stats */
/** Days back from today, oldest first, as Y-m-d in Tehran time. */
function tf_days(int $n): array
{
    $out = [];
    for ($i = $n - 1; $i >= 0; $i--) {
        $out[] = date('Y-m-d', strtotime("-$i days"));
    }
    return $out;
}

/* -------------------------------------------------------------- visitors */
/** Today's anonymous visitor id: a hash of address, browser and a salt that
    is replaced every day, so the same person counts once a day and can never
    be followed from one day to the next. Nothing here is ever stored as is. */
function tf_visitor(string $ua): array
{
    $db = db();
    $day = date('Y-m-d');
    $salt = setting('salt:' . $day);
    if ($salt === '') {
        $db->prepare('INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)')
            ->execute(['salt:' . $day, bin2hex(random_bytes(16))]);
        $salt = setting('salt:' . $day);
        $old = date('Y-m-d', strtotime('-2 days'));
        $db->prepare("DELETE FROM settings WHERE k LIKE 'salt:%' AND k < ?")->execute(['salt:' . $old]);
        $db->prepare('DELETE FROM seen WHERE day < ?')->execute([$old]);
        $db->prepare('DELETE FROM devseen WHERE day < ?')->execute([$old]);
    }
    return [$day, substr(hash('sha256', $salt . '|' . tf_ip() . '|' . $ua), 0, 24)];
}

function tf_is_bot(string $ua): bool
{
    return $ua === '' || (bool) preg_match('/bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse/i', $ua);
}

require_once __DIR__ . '/sms.php';
require_once __DIR__ . '/shop.php';
require_once __DIR__ . '/pay.php';

/* --------------------------------------------------------------- devices */
/* What the cookie sheet asks for, and the only values that are ever kept.
   The shop works these out in the browser (js/device.js); anything not on
   this list is dropped, so the table can only ever hold these words. */
const TF_DEV = [
    'type'    => ['mobile', 'tablet', 'desktop'],
    'os'      => ['ios', 'android', 'windows', 'macos', 'linux', 'chromeos', 'other'],
    'brand'   => ['apple', 'samsung', 'xiaomi', 'huawei', 'honor', 'google', 'oppo', 'realme',
                  'vivo', 'oneplus', 'nokia', 'motorola', 'lg', 'tecno', 'other'],
    'browser' => ['chrome', 'safari', 'samsung', 'firefox', 'edge', 'opera', 'yandex',
                  'instagram', 'facebook', 'telegram', 'other'],
    'app'     => ['app', 'web'],
    'lang'    => ['fa', 'en', 'tr'],
];
const TF_CONSENT_COOKIE = 'tf_c';

/** Did this browser say yes on the cookie sheet? Read from its own cookie. */
function tf_consented(): bool
{
    return ($_COOKIE[TF_CONSENT_COOKIE] ?? '') === '1';
}

/** Keep only allow-listed values; null when there is nothing usable. */
function tf_device_clean($d): ?array
{
    if (!is_array($d)) {
        return null;
    }
    $out = [];
    foreach (TF_DEV as $dim => $allowed) {
        $v = $d[$dim] ?? null;
        if (is_string($v) && in_array($v, $allowed, true)) {
            $out[$dim] = $v;
        }
    }
    return isset($out['type'], $out['os']) ? $out : null;
}

/** Count one consenting visitor's device, at most once per visitor per day. */
function tf_device_note(string $day, string $vid, array $dev): void
{
    $db = db();
    $st = $db->prepare('INSERT OR IGNORE INTO devseen (day, vid) VALUES (?, ?)');
    $st->execute([$day, $vid]);
    if ($st->rowCount() === 0) {
        return;
    }
    $up = $db->prepare('INSERT INTO devices (day, dim, val, n) VALUES (?, ?, ?, 1)
                        ON CONFLICT(day, dim, val) DO UPDATE SET n = n + 1');
    foreach ($dev as $dim => $val) {
        $up->execute([$day, $dim, $val]);
    }
}

/** Yes and no on the cookie sheet, as two plain daily counters. */
function tf_consent_note(string $day, bool $yes): void
{
    db()->prepare('INSERT INTO devices (day, dim, val, n) VALUES (?, \'consent\', ?, 1)
                   ON CONFLICT(day, dim, val) DO UPDATE SET n = n + 1')
        ->execute([$day, $yes ? 'yes' : 'no']);
}
