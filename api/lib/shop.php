<?php
/* The shop's own side of the back office (2026-10-18):

   - customer accounts: a phone number proven by an SMS code, a password,
     a session of its own (cookie tf_shop, 90 days, separate from the panel)
   - support tickets: a thread per question, text, photos, files, voice
     notes and a product from the catalogue; only the team answers
   - the panel's stories, each one public for 24 hours

   Ticket files are private. They live in tiffany-data/files (outside the web
   root) and are only ever handed out through api/file.php with a signed,
   expiring link that the thread itself gives to its own customer or to the
   team. Every file is identified by its first bytes, never by its name or
   by what the browser calls it; photos are redrawn, which drops their EXIF
   (a phone's photo carries where it was taken). */
declare(strict_types=1);

const TF_OTP_TTL = 180;            // a code works for three minutes
const TF_OTP_GAP = 60;             // a new one can be asked for after one
const TF_OTP_TRIES = 5;            // five guesses per code, then it is spent
const TF_PURPOSES = ['signup', 'reset'];
const TF_TICKET_STATUSES = ['open', 'answered', 'closed'];
const TF_FILES_PER_MSG = 6;        // plus one voice note
const TF_FILE_CAP = 25 * 1024 * 1024;
const TF_STORY_CAP = 60 * 1024 * 1024;
const TF_STORY_SECS = 86400;       // a story is public for 24 hours

/* ---------------------------------------------------------------- basics */
/** A long random value kept in settings, made once (signing codes and links). */
function tf_secret(string $name): string
{
    $v = setting($name);
    if ($v === '') {
        db()->prepare('INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)')
            ->execute([$name, bin2hex(random_bytes(32))]);
        $v = setting($name);
    }
    return $v;
}

/** A field-level refusal the shop can translate: `why` is a fixed word, the
    message is the Persian the panel shows as it is. */
function tf_bad(string $field, string $why, string $message): void
{
    tf_fail(422, 'invalid', ['field' => $field, 'why' => $why, 'message' => $message]);
}

/** PHP's own size settings in bytes ('8M' → 8388608; 0 or empty = no limit). */
function tf_ini_bytes(string $key): int
{
    $v = trim((string) ini_get($key));
    $n = (int) $v;
    if ($v === '' || $n <= 0) {
        return PHP_INT_MAX;
    }
    $unit = strtolower(substr($v, -1));
    $mul = ['k' => 1024, 'm' => 1048576, 'g' => 1073741824][$unit] ?? 1;
    return $n * $mul;
}

/** The biggest single file this host will take, never more than $want. */
function tf_upload_cap(int $want): int
{
    return max(0, min($want, tf_ini_bytes('upload_max_filesize'), tf_ini_bytes('post_max_size')));
}

/** A multipart request bigger than post_max_size arrives with $_POST and
    $_FILES silently empty; say so instead of «unknown action». */
function tf_refuse_oversize(): void
{
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > 0 && $len > tf_ini_bytes('post_max_size')) {
        tf_fail(413, 'too_big', ['max' => tf_upload_cap(PHP_INT_MAX)]);
    }
}

/** «5 مگابایت» */
function tf_mb(int $bytes): string
{
    return (string) max(1, (int) floor($bytes / 1048576)) . ' مگابایت';
}

/* -------------------------------------------------------------- customers */
/** The signed-in customer, or null. A password change bumps sv and signs out every other device. */
function tf_customer(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE && !isset($_COOKIE['tf_shop'])) {
        return null;
    }
    tf_session('shop');
    $id = (int) ($_SESSION['cid'] ?? 0);
    if (!$id) {
        session_destroy();
        return null;
    }
    $st = db()->prepare('SELECT * FROM customers WHERE id = ? AND active = 1');
    $st->execute([$id]);
    $c = $st->fetch();
    $st->closeCursor();
    if (!$c || (int) $c['sv'] !== (int) ($_SESSION['sv'] ?? -1)) {
        $_SESSION = [];
        return null;
    }
    return $c;
}

function tf_customer_public(array $c): array
{
    return ['name' => $c['name'], 'phone' => $c['phone'], 'since' => (int) $c['created_at']];
}

function tf_customer_by_phone(string $phone): ?array
{
    $st = db()->prepare('SELECT * FROM customers WHERE phone = ?');
    $st->execute([$phone]);
    $c = $st->fetch();
    $st->closeCursor();
    return $c ?: null;
}

function tf_customer_sign_in(array $c): void
{
    tf_session('shop');
    session_regenerate_id(true);
    $_SESSION['cid'] = (int) $c['id'];
    $_SESSION['sv'] = (int) $c['sv'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    db()->prepare('UPDATE customers SET last_login = ? WHERE id = ?')->execute([time(), $c['id']]);
}

function tf_customer_password(string $p): string
{
    if (mb_strlen($p) < 6) {
        tf_bad('password', 'short', 'رمز باید حداقل ۶ کاراکتر باشه.');
    }
    if (mb_strlen($p) > 200) {
        tf_bad('password', 'long', 'رمز خیلی بلنده.');
    }
    return $p;
}

/* ------------------------------------------------------------- SMS codes */
function tf_otp_hash(string $phone, string $purpose, string $code): string
{
    return hash_hmac('sha256', "$purpose|$phone|$code", tf_secret('otp_secret'));
}

/** Text a fresh six-digit code. While the last one is under a minute old
    the answer is 429 with `wait` (seconds). A failed SMS is a 502 and leaves
    no code behind.

    The gap, every counter and the new code are decided in one locked step,
    so requests sent together cannot each get a code (review 2026-10-19).
    Limits: five an hour and ten a day per number; twenty an hour per address
    (a carrier puts many phones behind one) and forty a day per wider address
    (an IPv6 /48); and for the whole shop 150 sign-up codes and 60 reset codes
    an hour — separate, so someone texting random numbers to «sign up» uses
    up the sign-up budget, never the real customers' password resets. Every
    code is paid for out of the studio's SMS credit. */
function tf_otp_send(string $phone, string $purpose): void
{
    $db = db();
    $now = time();
    $ip = tf_ip_key();
    $wide = tf_ip_wide();
    $all = 'otp:all:' . $purpose;
    $code = (string) random_int(100000, 999999);
    $refuse = null;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $st = $db->prepare('SELECT sent_at FROM otps WHERE phone = ? AND purpose = ?');
        $st->execute([$phone, $purpose]);
        $last = (int) $st->fetchColumn();
        $st->closeCursor();
        if ($last && $now - $last < TF_OTP_GAP) {
            $refuse = [429, 'wait', ['wait' => TF_OTP_GAP - ($now - $last)]];
        } elseif (tf_too_many('otp:ph:' . $phone, 5, 3600) || tf_too_many('otp:day:' . $phone, 10, 86400)
            || tf_too_many('otp:ip:' . $ip, 20, 3600) || tf_too_many('otp:ipday:' . $wide, 40, 86400)) {
            $refuse = [429, 'too_many', []];
        } elseif (tf_too_many($all, $purpose === 'reset' ? 60 : 150, 3600)) {
            if (!tf_too_many($all . '-noted', 1, 3600)) {      // one line in error.log an hour, not one per try
                tf_note_attempt($all . '-noted');
                tf_log_error(new RuntimeException("sms codes ($purpose): the hour's budget is used up, holding the rest"));
            }
            $refuse = [429, 'too_many', []];
        } else {
            foreach (['otp:ph:' . $phone, 'otp:day:' . $phone, 'otp:ip:' . $ip, 'otp:ipday:' . $wide, $all] as $k) {
                tf_note_attempt($k);
            }
            $db->prepare('INSERT INTO otps (phone, purpose, hash, expires_at, tries, sent_at) VALUES (?, ?, ?, ?, 0, ?)
                          ON CONFLICT(phone, purpose) DO UPDATE SET hash = excluded.hash,
                            expires_at = excluded.expires_at, tries = 0, sent_at = excluded.sent_at')
                ->execute([$phone, $purpose, tf_otp_hash($phone, $purpose, $code), $now + TF_OTP_TTL, $now]);
        }
        $db->exec('COMMIT');
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
    if ($refuse) {
        tf_fail(...$refuse);
    }
    if (!tf_sms_otp($phone, $code)) {
        $db->prepare('DELETE FROM otps WHERE phone = ? AND purpose = ?')->execute([$phone, $purpose]);
        tf_fail(502, 'sms');
    }
}

/** The code typed back. A try is spent before the check (one atomic step),
    so parallel guesses cannot get past the five. A good code is used up. */
function tf_otp_check(string $phone, string $purpose, string $typed): void
{
    $db = db();
    tf_throttle('otpv:ip:' . tf_ip_key(), 60, 3600);
    $code = preg_replace('/\D/', '', tf_digits($typed)) ?? '';
    $st = $db->prepare('SELECT hash, expires_at FROM otps WHERE phone = ? AND purpose = ?');
    $st->execute([$phone, $purpose]);
    $row = $st->fetch();
    $st->closeCursor();
    if (!$row || (int) $row['expires_at'] < time()) {
        tf_bad('code', 'expired', 'کد منقضی شده؛ یه کد تازه بگیر.');
    }
    $use = $db->prepare('UPDATE otps SET tries = tries + 1 WHERE phone = ? AND purpose = ? AND tries < ?');
    $use->execute([$phone, $purpose, TF_OTP_TRIES]);
    if ($use->rowCount() !== 1) {
        tf_bad('code', 'spent', 'این کد چند بار اشتباه زده شد؛ یه کد تازه بگیر.');
    }
    /* Six digits since 2026-10-19 (five before: a code sent just before the
       change still works for its three minutes). */
    if (strlen($code) < 5 || strlen($code) > 6 || !hash_equals((string) $row['hash'], tf_otp_hash($phone, $purpose, $code))) {
        tf_bad('code', 'wrong', 'کد درست نیست.');
    }
    $db->prepare('DELETE FROM otps WHERE phone = ? AND purpose = ?')->execute([$phone, $purpose]);
}

/* ----------------------------------------------------------------- photos */
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

/** Open a photo upright. [image, width, height] or null if GD cannot read it. */
function tf_image_open(string $path, int $maxPixels = 60000000): ?array
{
    $info = @getimagesize($path);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)
        || $info[0] * $info[1] > $maxPixels) {
        return null;
    }
    $bytes = (string) file_get_contents($path);
    $src = @imagecreatefromstring($bytes);
    if (!$src) {
        return null;
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
    return [$src, imagesx($src), imagesy($src)];
}

/** The same picture, no wider or taller than the box (never enlarged). */
function tf_image_fit($src, int $maxW, int $maxH, bool $keepAlpha = false)
{
    $w = imagesx($src);
    $h = imagesy($src);
    $k = min(1, $maxW / $w, $maxH / $h);
    $tw = max(1, (int) round($w * $k));
    $th = max(1, (int) round($h * $k));
    $dst = imagecreatetruecolor($tw, $th);
    if ($keepAlpha) {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
    } else {
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    }
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $tw, $th, $w, $h);
    return $dst;
}

/* ------------------------------------------------------------------ files */
/** What a file really is, from its first bytes: [kind, mime, ext], or null
    for anything the shop does not take. kind is image, audio, video or file
    (a download). Office files and plain text also need the matching name. */
function tf_sniff(string $path, string $name, bool $voice): ?array
{
    $h = (string) @file_get_contents($path, false, null, 0, 64);
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $b0 = ord($h[0] ?? "\0");
    $b1 = ord($h[1] ?? "\0");
    if (strncmp($h, "\xFF\xD8\xFF", 3) === 0) {
        return ['image', 'image/jpeg', 'jpg'];
    }
    if (strncmp($h, "\x89PNG\r\n\x1A\n", 8) === 0) {
        return ['image', 'image/png', 'png'];
    }
    if (strncmp($h, 'GIF87a', 6) === 0 || strncmp($h, 'GIF89a', 6) === 0) {
        return ['image', 'image/gif', 'gif'];
    }
    if (strncmp($h, 'RIFF', 4) === 0 && substr($h, 8, 4) === 'WEBP') {
        return ['image', 'image/webp', 'webp'];
    }
    if (strncmp($h, 'RIFF', 4) === 0 && substr($h, 8, 4) === 'WAVE') {
        return ['audio', 'audio/wav', 'wav'];
    }
    if (strncmp($h, '%PDF-', 5) === 0) {
        return ['file', 'application/pdf', 'pdf'];
    }
    if (strncmp($h, "\x1A\x45\xDF\xA3", 4) === 0) {       // WebM / Matroska
        return $voice || in_array($ext, ['weba', 'opus'], true)
            ? ['audio', 'audio/webm', 'webm'] : ['video', 'video/webm', 'webm'];
    }
    if (strncmp($h, 'OggS', 4) === 0) {
        return ['audio', 'audio/ogg', 'ogg'];
    }
    if (strncmp($h, 'ID3', 3) === 0) {
        return ['audio', 'audio/mpeg', 'mp3'];
    }
    if ($b0 === 0xFF && ($b1 & 0xE0) === 0xE0) {        // an MPEG audio frame
        return ($b1 & 0x06) === 0 ? ['audio', 'audio/aac', 'aac'] : ['audio', 'audio/mpeg', 'mp3'];
    }
    if (substr($h, 4, 4) === 'ftyp') {                  // the MP4 family
        $brand = substr($h, 8, 4);
        if ($brand === 'avif' || $brand === 'avis') {
            return ['file', 'image/avif', 'avif'];
        }
        if (in_array($brand, ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'], true)) {
            return ['file', 'image/heic', 'heic'];
        }
        if ($voice || in_array($brand, ['M4A ', 'M4B '], true) || $ext === 'm4a') {
            return ['audio', 'audio/mp4', 'm4a'];
        }
        if ($brand === 'qt  ') {
            return ['video', 'video/quicktime', 'mov'];
        }
        if (strncmp($brand, '3gp', 3) === 0 || strncmp($brand, '3g2', 3) === 0) {
            return ['video', 'video/3gpp', '3gp'];
        }
        return ['video', 'video/mp4', 'mp4'];
    }
    if (strncmp($h, "PK\x03\x04", 4) === 0) {
        $office = [
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ];
        return isset($office[$ext]) ? ['file', $office[$ext], $ext] : null;
    }
    if (strncmp($h, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1", 8) === 0) {
        $old = ['doc' => 'application/msword', 'xls' => 'application/vnd.ms-excel',
            'ppt' => 'application/vnd.ms-powerpoint'];
        return isset($old[$ext]) ? ['file', $old[$ext], $ext] : null;
    }
    if ($ext === 'txt') {
        $all = (string) @file_get_contents($path, false, null, 0, 300000);
        if ($all !== '' && strpos($all, "\0") === false && mb_check_encoding($all, 'UTF-8')) {
            return ['file', 'text/plain; charset=utf-8', 'txt'];
        }
    }
    return null;
}

/** $_FILES['x'] as a plain list (PHP hands several files over sideways). */
function tf_files_list($f): array
{
    if (!is_array($f) || !isset($f['name'])) {
        return [];
    }
    if (!is_array($f['name'])) {
        return [$f];
    }
    $out = [];
    foreach ($f['name'] as $i => $n) {
        $out[] = ['name' => $n, 'tmp_name' => $f['tmp_name'][$i] ?? '', 'error' => $f['error'][$i] ?? UPLOAD_ERR_NO_FILE,
            'size' => $f['size'][$i] ?? 0];
    }
    return $out;
}

/** A name that is safe to show and to hand back in a download. */
function tf_file_name($n, string $fallback): string
{
    $n = basename(str_replace('\\', '/', (string) $n));
    $n = tf_line(preg_replace('/[\x00-\x1F\x7F"<>|:*?\/\\\\]+/u', '', $n) ?? '', 90);
    return $n === '' || $n === '.' ? $fallback : $n;
}

/* Photos redrawn for a ticket go to temporary files first; whatever is left
   when the request ends (a refused message) is cleaned up. */
function tf_temp(string $prefix): string
{
    $dir = tf_data_dir() . '/tmp';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $p = tempnam($dir, $prefix);
    if ($p === false) {
        throw new RuntimeException('no temp file');
    }
    static $wired = false;
    if (!$wired) {
        $wired = true;
        register_shutdown_function(static function (): void {
            foreach ($GLOBALS['tf_temps'] ?? [] as $t) {
                if (is_file($t)) {
                    @unlink($t);
                }
            }
        });
    }
    $GLOBALS['tf_temps'][] = $p;
    return $p;
}

/** Check every file of one message before anything is kept: one bad file and
    the whole message is refused, naming that file. Returns what tf_ticket_post
    stores. Photos are redrawn here (upright, at most 2560 px, no EXIF). */
function tf_intake(array $files, ?array $voice, int $voiceSecs): array
{
    $cap = tf_upload_cap(TF_FILE_CAP);
    $list = [];
    foreach ($files as $f) {
        if ((int) ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            $list[] = [$f, false];
        }
    }
    if (count($list) > TF_FILES_PER_MSG) {
        tf_bad('files', 'count', 'هر پیام حداکثر ' . TF_FILES_PER_MSG . ' فایل.');
    }
    if ($voice && (int) ($voice['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $list[] = [$voice, true];
    }
    $out = [];
    foreach ($list as [$f, $isVoice]) {
        $name = $isVoice ? 'voice' : tf_file_name($f['name'] ?? '', 'file');
        $err = (int) ($f['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE || (int) ($f['size'] ?? 0) > $cap) {
            tf_bad($isVoice ? 'voice' : 'files', 'big',
                ($isVoice ? 'پیام صوتی' : "«{$name}»") . ' بزرگ‌تر از ' . tf_mb($cap) . 'ه.');
        }
        if ($err !== UPLOAD_ERR_OK || !is_uploaded_file((string) $f['tmp_name'])) {
            tf_bad($isVoice ? 'voice' : 'files', 'upload', ($isVoice ? 'پیام صوتی' : "«{$name}»") . ' آپلود نشد.');
        }
        $t = tf_sniff((string) $f['tmp_name'], $name, $isVoice);
        if (!$t || ($isVoice && $t[0] !== 'audio')) {
            tf_bad($isVoice ? 'voice' : 'files', 'type', $isVoice ? 'پیام صوتی خونده نشد.'
                : "«{$name}» از نوع فایل‌هایی نیست که می‌شه فرستاد.");
        }
        [$kind, $mime, $ext] = $t;
        $item = ['path' => (string) $f['tmp_name'], 'uploaded' => true, 'kind' => $kind, 'mime' => $mime,
            'ext' => $ext, 'size' => (int) $f['size'], 'voice' => $isVoice, 'w' => 0, 'h' => 0,
            'secs' => $isVoice ? max(0, min(600, $voiceSecs)) : 0,
            'name' => $isVoice ? 'voice.' . $ext : $name];
        if ($kind === 'image' && $mime !== 'image/gif') {
            /* 20 MP at most: a photo is decoded whole (plus a turned copy), and
               the shop already shrinks big ones to 2400 px before sending. */
            $img = tf_image_open($item['path'], 20000000);
            if (!$img) {
                tf_bad('files', 'type', "«{$name}» باز نشد؛ یه عکس دیگه بفرست.");
            }
            $png = $mime === 'image/png';
            $out1 = tf_image_fit($img[0], 2560, 2560, $png);
            imagedestroy($img[0]);
            $tmp = tf_temp('img');
            $ok = $png ? imagepng($out1, $tmp, 6) : imagejpeg($out1, $tmp, 86);
            $item['w'] = imagesx($out1);
            $item['h'] = imagesy($out1);
            imagedestroy($out1);
            if (!$ok) {
                throw new RuntimeException('image write failed');
            }
            clearstatcache(true, $tmp);
            $item['path'] = $tmp;
            $item['uploaded'] = false;
            $item['mime'] = $png ? 'image/png' : 'image/jpeg';
            $item['ext'] = $png ? 'png' : 'jpg';
            $item['size'] = (int) filesize($tmp);
        }
        /* The name ends in what the file really is (its first bytes), never in
           what the sender called it: «receipt.hta» that is a PDF is kept and
           handed to the team as «receipt.pdf». */
        if (!$isVoice) {
            $base = preg_replace('/\.[A-Za-z0-9]{1,5}$/', '', $item['name']) ?: 'file';
            $item['name'] = mb_substr($base, 0, 90) . '.' . $item['ext'];
        }
        $out[] = $item;
    }
    return $out;
}

function tf_file_path(string $id, string $ext): string
{
    return tf_data_dir() . '/files/' . substr($id, 0, 2) . '/' . $id . '.' . $ext;
}

/** A link to one ticket file that works for six to seven hours. The hour is
    rounded, so a thread opened twice in an hour hands out the same links and
    the browser's cache keeps working. */
function tf_file_url(string $id): string
{
    $e = (intdiv(time(), 3600) + 7) * 3600;
    return '/api/file.php?f=' . $id . '&e=' . $e . '&s=' . tf_file_sig($id, $e);
}

function tf_file_sig(string $id, int $e): string
{
    return substr(hash_hmac('sha256', "$id|$e", tf_secret('file_secret')), 0, 32);
}

/* ---------------------------------------------------------------- tickets */
function tf_ticket_by_code(string $code): ?array
{
    if (!preg_match('/^T-\d{5}$/', $code)) {
        return null;
    }
    $st = db()->prepare('SELECT * FROM tickets WHERE code = ?');
    $st->execute([$code]);
    $t = $st->fetch();
    $st->closeCursor();
    return $t ?: null;
}

function tf_ticket_new_code(): string
{
    $st = db()->prepare('SELECT 1 FROM tickets WHERE code = ?');
    for ($i = 0; $i < 80; $i++) {
        $code = 'T-' . random_int(10000, 99999);
        $st->execute([$code]);
        $taken = $st->fetchColumn();
        $st->closeCursor();
        if (!$taken) {
            return $code;
        }
    }
    throw new RuntimeException('no free ticket code');
}

/** The list rows, for the customer ($side 'c') or the team ('s'): unread is
    what the other side wrote since this side last opened the thread. */
function tf_tickets_list(string $where, array $args, string $side, int $limit = 200): array
{
    $seen = $side === 'c' ? 'seen_c' : 'seen_s';
    $other = $side === 'c' ? 's' : 'c';
    $sql = "SELECT t.*, c.name AS c_name, c.phone AS c_phone,
              (SELECT COUNT(*) FROM ticket_msgs m WHERE m.ticket_id = t.id AND m.side = '$other' AND m.id > t.$seen) AS unread,
              (SELECT m.body FROM ticket_msgs m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
              (SELECT m.id FROM ticket_msgs m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_id
            FROM tickets t JOIN customers c ON c.id = t.customer_id
            WHERE $where ORDER BY t.updated_at DESC, t.id DESC LIMIT " . (int) $limit;
    $st = db()->prepare($sql);
    $st->execute($args);
    $rows = $st->fetchAll();
    $kinds = [];
    $ids = array_filter(array_map(static fn ($r) => (int) $r['last_id'], $rows));
    if ($ids) {
        $q = db()->query('SELECT msg_id, kind, voice FROM ticket_files WHERE msg_id IN (' . implode(',', $ids) . ')');
        foreach ($q->fetchAll() as $f) {
            $kinds[(int) $f['msg_id']] ??= $f['voice'] ? 'voice' : $f['kind'];
        }
    }
    return array_map(static function (array $r) use ($side, $kinds): array {
        $out = [
            'code' => $r['code'],
            'subject' => $r['subject'],
            'status' => $r['status'],
            'last_from' => $r['last_from'],
            'unread' => (int) $r['unread'],
            'last' => mb_substr((string) $r['last_body'], 0, 90),
            'last_kind' => $kinds[(int) $r['last_id']] ?? '',
            'created_at' => (int) $r['created_at'],
            'updated_at' => (int) $r['updated_at'],
        ];
        if ($side === 's') {
            $out['name'] = $r['c_name'];
            $out['phone'] = $r['c_phone'];
        }
        return $out;
    }, $rows);
}

/** One thread: every message with its files (signed links) and a short card
    for each product mentioned. The team sees who answered; a customer sees
    «the TIFFANY team». */
function tf_ticket_thread(array $t, bool $forStaff): array
{
    $db = db();
    $st = $db->prepare('SELECT * FROM ticket_msgs WHERE ticket_id = ? ORDER BY id');
    $st->execute([$t['id']]);
    $msgs = $st->fetchAll();
    $fs = $db->prepare('SELECT * FROM ticket_files WHERE ticket_id = ? ORDER BY rowid');
    $fs->execute([$t['id']]);
    $files = [];
    foreach ($fs->fetchAll() as $f) {
        $files[(int) $f['msg_id']][] = [
            'kind' => $f['kind'], 'name' => $f['name'], 'mime' => $f['mime'], 'size' => (int) $f['size'],
            'voice' => (bool) $f['voice'], 'secs' => (int) $f['secs'], 'w' => (int) $f['w'], 'h' => (int) $f['h'],
            'url' => tf_file_url($f['id']),
        ];
    }
    $products = [];
    $out = [];
    foreach ($msgs as $m) {
        $pid = (string) $m['product'];
        if ($pid !== '' && !isset($products[$pid])) {
            $p = tf_product($pid);
            $products[$pid] = $p ? ['id' => $p['id'], 'name' => $p['name'], 'img' => $p['images'][0] ?? '',
                'price' => (int) $p['price'], 'visible' => (bool) $p['visible']] : null;
        }
        $out[] = [
            'id' => (int) $m['id'],
            'side' => $m['side'],
            'author' => $m['side'] === 's' ? ($forStaff ? $m['author'] : '') : '',
            'body' => $m['body'],
            'product' => $pid,
            'files' => $files[(int) $m['id']] ?? [],
            'at' => (int) $m['created_at'],
        ];
    }
    return ['messages' => $out, 'products' => array_filter($products)];
}

/* What one customer may upload in a day (files of every message together),
   so one account cannot fill the host's disk. */
const TF_CUSTOMER_DAY_BYTES = 300 * 1024 * 1024;

/** Bytes one customer sent in the last 24 hours. */
function tf_customer_bytes_today(int $cid): int
{
    $st = db()->prepare("SELECT COALESCE(SUM(f.size), 0) FROM ticket_files f JOIN ticket_msgs m ON m.id = f.msg_id
                         JOIN tickets t ON t.id = f.ticket_id WHERE t.customer_id = ? AND m.side = 'c' AND f.created_at > ?");
    $st->execute([$cid, time() - 86400]);
    $used = (int) $st->fetchColumn();
    $st->closeCursor();                 // an open read would make the next write fail under load
    return $used;
}

/** Add one message (and its files) to a thread. A customer's message opens
    the ticket again; the team's marks it answered. Returns the new message id.

    The files are moved into place first, OUTSIDE the database lock (copying a
    big file can take a while and every other write would wait); only the rows
    are written under it. A customer's message is held to the daily quota
    there too, so messages sent together cannot all squeeze under it. */
function tf_ticket_post(array $t, string $side, string $author, string $body, string $product, array $files): int
{
    $db = db();
    $now = time();
    $moved = [];
    $kept = [];
    try {
        foreach ($files as $f) {
            $id = bin2hex(random_bytes(10));
            $dest = tf_file_path($id, $f['ext']);
            if (!is_dir(dirname($dest))) {
                @mkdir(dirname($dest), 0700, true);
            }
            $ok = $f['uploaded'] ? move_uploaded_file($f['path'], $dest) : rename($f['path'], $dest);
            if (!$ok) {
                throw new RuntimeException('could not keep a ticket file');
            }
            $moved[] = $dest;
            @chmod($dest, 0600);
            $kept[] = [$id, $f];
        }
        $db->exec('BEGIN IMMEDIATE');
    } catch (Throwable $e) {
        foreach ($moved as $m) {
            @unlink($m);
        }
        throw $e;
    }
    try {
        if ($side === 'c' && $files
            && tf_customer_bytes_today((int) $t['customer_id']) + array_sum(array_column($files, 'size')) > TF_CUSTOMER_DAY_BYTES) {
            throw new TfRefuse(429, 'quota');
        }
        $db->prepare('INSERT INTO ticket_msgs (ticket_id, side, author, body, product, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$t['id'], $side, $author, $body, $product, $now]);
        $mid = (int) $db->lastInsertId();
        $ins = $db->prepare('INSERT INTO ticket_files (id, ticket_id, msg_id, kind, name, mime, ext, size, voice, secs, w, h, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($kept as [$id, $f]) {
            $ins->execute([$id, $t['id'], $mid, $f['kind'], $f['name'], $f['mime'], $f['ext'], $f['size'],
                $f['voice'] ? 1 : 0, $f['secs'], $f['w'], $f['h'], $now]);
        }
        $status = $side === 'c' ? 'open' : 'answered';
        $seen = $side === 'c' ? 'seen_c' : 'seen_s';
        $db->prepare("UPDATE tickets SET status = ?, last_from = ?, updated_at = ?, $seen = ? WHERE id = ?")
            ->execute([$status, $side, $now, $mid, $t['id']]);
        $db->exec('COMMIT');
        return $mid;
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        foreach ($moved as $m) {
            @unlink($m);
        }
        throw $e;
    }
}

/** Mark everything in a thread as read by one side. */
function tf_ticket_seen(array $t, string $side): void
{
    $col = $side === 'c' ? 'seen_c' : 'seen_s';
    db()->prepare("UPDATE tickets SET $col = (SELECT COALESCE(MAX(id), 0) FROM ticket_msgs WHERE ticket_id = ?) WHERE id = ?")
        ->execute([$t['id'], $t['id']]);
}

/** A message needs words, a file, a voice note or a product. */
function tf_message_in(array $in, array $files): array
{
    $body = tf_text($in['body'] ?? '', 3000);
    $product = (string) ($in['product'] ?? '');
    if ($product !== '') {
        $p = preg_match('/^[a-z0-9][a-z0-9-]{1,60}$/', $product) ? tf_product($product) : null;
        if (!$p || !$p['visible']) {
            tf_bad('product', 'gone', 'این محصول توی سایت نیست.');
        }
    }
    if ($body === '' && !$files && $product === '') {
        tf_bad('body', 'empty', 'یه چیزی بنویس، یا فایل یا پیام صوتی بفرست.');
    }
    return [$body, $product];
}

/* ---------------------------------------------------------------- stories */
function tf_story_out(array $r): array
{
    return [
        'id' => (int) $r['id'],
        'kind' => $r['kind'],
        'media' => $r['media'],
        'poster' => $r['poster'],
        'w' => (int) $r['w'],
        'h' => (int) $r['h'],
        'caption' => json_decode((string) $r['caption'], true) ?: ['fa' => '', 'en' => '', 'tr' => ''],
        'items' => json_decode((string) $r['items'], true) ?: [],
        'link' => tf_link_out((string) ($r['link'] ?? '')),
        'created_at' => (int) $r['created_at'],
        'expires_at' => (int) $r['expires_at'],
    ];
}

/* ------------------------------------------------------ story links */
/** A story's button: a page of the shop (#/p/…, #/c/…, #/shop…) or an
    http(s) address, and the words on it (empty words: the shop says «ببین»).
    Anything else — javascript:, data:, a bare word — is refused, never
    guessed at. An empty address means no button. */
function tf_link_clean($raw): array
{
    if (is_string($raw)) {
        $raw = $raw === '' ? [] : (json_decode($raw, true) ?: []);
    }
    $raw = is_array($raw) ? $raw : [];
    $url = trim((string) ($raw['url'] ?? ''));
    if ($url === '') {
        return [];
    }
    $ok = strlen($url) <= 300 && (
        preg_match('~^#/(p|c)/[a-z0-9][a-z0-9-]{1,60}$~', $url)
        || preg_match('~^#/shop(\?[a-z0-9=&_-]{0,80})?$~', $url)
        || (preg_match('~^https?://~i', $url) && filter_var($url, FILTER_VALIDATE_URL)
            && !preg_match('~[\s"\'<>`]~', $url)));
    if (!$ok) {
        throw new TfInvalid('link', 'لینک درست نیست؛ یه آدرس کامل با https:// بنویس، یا یه محصول یا کالکشن انتخاب کن.');
    }
    $label = is_array($raw['label'] ?? null) ? $raw['label'] : ['fa' => (string) ($raw['label'] ?? '')];
    return ['url' => $url, 'label' => tf_i18n($label, 30)];
}

/** A stored link as the shop gets it; a broken one is simply left off. */
function tf_link_out(string $stored): array
{
    try {
        return tf_link_clean($stored);
    } catch (Throwable $e) {
        return [];
    }
}

/* ------------------------------------------------- campaign stories */
/* The studio's outfit stories live in the shop's code (js/data.js, LOOKS).
   The panel can change, per story, its title, its text, the pieces it
   points at, its link, and hide it; only those changes are kept here
   (settings 'looks_edit', one entry per story id). */
const TF_LOOK_ITEMS = 8;

function tf_look_clean(array $in): array
{
    $out = [];
    foreach (['title' => 60, 'caption' => 140] as $k => $max) {
        if (isset($in[$k]) && is_array($in[$k])) {
            $t = tf_i18n($in[$k], $max);
            if ($t['fa'] !== '' || $t['en'] !== '' || $t['tr'] !== '') {
                $out[$k] = $t;
            }
        }
    }
    if (array_key_exists('items', $in) && is_array($in['items'])) {
        $items = [];
        foreach (array_slice($in['items'], 0, 20) as $id) {
            $id = (string) $id;
            if (preg_match('/^[a-z0-9][a-z0-9-]{1,60}$/', $id) && tf_product($id) && !in_array($id, $items, true)) {
                $items[] = $id;
            }
        }
        if (count($items) > TF_LOOK_ITEMS) {
            throw new TfInvalid('items', 'هر استوری حداکثر ' . TF_LOOK_ITEMS . ' محصول.');
        }
        $out['items'] = $items;
    }
    $link = tf_link_clean($in['link'] ?? []);
    if ($link) {
        $out['link'] = $link;
    }
    if (!empty($in['hidden'])) {
        $out['hidden'] = true;
    }
    return $out;
}

/** Change the saved story edits in one locked step, so two people saving
    different stories at the same moment both keep their change. */
function tf_looks_change(callable $change): array
{
    $db = db();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $all = $change(tf_looks_edits());
        if (count($all) > 80) {
            throw new TfInvalid('look', 'بیشتر از این نمی‌شه استوری کمپین رو تغییر داد.');
        }
        setting_set('looks_edit', json_encode((object) $all, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $db->exec('COMMIT');
        return $all;
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
}

/** Every saved change, keyed by story id; a bad entry is dropped, not served. */
function tf_looks_edits(): array
{
    $all = json_decode(setting('looks_edit', '{}'), true);
    $out = [];
    foreach (is_array($all) ? $all : [] as $id => $e) {
        if (is_string($id) && preg_match('/^[a-z0-9-]{1,24}$/', $id) && is_array($e)) {
            $out[$id] = $e;
        }
    }
    return $out;
}

/** The stories that are public right now, newest first. */
function tf_stories_live(): array
{
    $st = db()->prepare('SELECT * FROM stories WHERE expires_at > ? ORDER BY created_at DESC, id DESC LIMIT 40');
    $st->execute([time()]);
    return array_map('tf_story_out', $st->fetchAll());
}

/** Is this an H.264 video, an HEVC one (which most Android phones cannot
    play), or something else? Each track's sample description (the 'stsd'
    box) names its codec; read in pieces, so a big file never sits in
    memory whole. */
function tf_video_codec(string $path): string
{
    $fh = @fopen($path, 'rb');
    if (!$fh) {
        return 'other';
    }
    $found = 'other';
    $tail = '';
    while (!feof($fh)) {
        $chunk = $tail . (string) fread($fh, 1048576);
        $at = 0;
        while (($p = strpos($chunk, 'stsd', $at)) !== false) {
            $type = substr($chunk, $p + 16, 4);
            if ($type === 'avc1' || $type === 'avc3') {
                fclose($fh);
                return 'h264';
            }
            if ($type === 'hvc1' || $type === 'hev1') {
                $found = 'hevc';
            }
            $at = $p + 4;
        }
        $tail = substr($chunk, -32);
    }
    fclose($fh);
    return $found;
}

/** A story photo (or a video's first frame): upright, at most 1080 × 1920,
    as WebP at 1080 and 540 wide. Returns the base path, uploads/s/<name>. */
function tf_story_image(string $path): array
{
    $img = tf_image_open($path, 30000000);         // the panel shrinks big photos first
    if (!$img) {
        throw new TfInvalid('media', 'این عکس باز نشد؛ JPG، PNG یا WebP بفرست.');
    }
    [$src, $w, $h] = $img;
    $dir = tf_web_root() . '/uploads/s';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $guard = tf_web_root() . '/uploads/.htaccess';
    if (!is_file($guard)) {
        file_put_contents($guard, "# Photos only: nothing in here ever runs.\nOptions -Indexes -ExecCGI\n"
            . "<FilesMatch \"\\.(php[0-9]?|phtml|phar|pl|py|cgi|sh|html?)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    $name = bin2hex(random_bytes(10));
    $big = tf_image_fit($src, 1080, 1920);
    $small = tf_image_fit($big, 540, 960);
    $bw = imagesx($big);
    $bh = imagesy($big);
    foreach ([1080 => $big, 540 => $small] as $tw => $im) {
        if (!imagewebp($im, "$dir/$name-$tw.webp", 82)) {
            throw new RuntimeException('webp write failed');
        }
        @chmod("$dir/$name-$tw.webp", 0644);
        imagedestroy($im);
    }
    imagedestroy($src);
    return ['uploads/s/' . $name, $bw, $bh];
}

/** Every file a story put in uploads/s. */
function tf_story_files(array $s): array
{
    $root = tf_web_root() . '/';
    $out = [];
    foreach ([$s['media'], $s['poster']] as $m) {
        if ($m === '' || !preg_match('#^uploads/s/[a-f0-9]{20}(\.(mp4|webm))?$#', $m)) {
            continue;
        }
        if (preg_match('/\.(mp4|webm)$/', $m)) {
            $out[] = $root . $m;
        } else {
            $out[] = $root . $m . '-1080.webp';
            $out[] = $root . $m . '-540.webp';
        }
    }
    return $out;
}
