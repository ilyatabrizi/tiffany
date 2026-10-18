<?php
/* GET /api/file.php?f=<id>&e=<expiry>&s=<signature> — one ticket file.

   The links come only from a ticket thread (api/tickets.php for its own
   customer, api/admin.php for the team) and stop working after six to seven
   hours, so a link that leaks does not stay open. The file is sent as what
   it was identified as when it arrived, never sniffed by the browser, and in
   a sandbox: nothing in it can run on this site. Audio and video answer
   Range requests, which Safari needs to play them at all. */
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
    tf_fail(405, 'method');
}
$id = (string) ($_GET['f'] ?? '');
$e = (int) ($_GET['e'] ?? 0);
$s = (string) ($_GET['s'] ?? '');
if (!preg_match('/^[a-f0-9]{20}$/', $id) || !preg_match('/^[a-f0-9]{32}$/', $s)
    || !hash_equals(tf_file_sig($id, $e), $s)) {
    tf_fail(404, 'not_found');
}
if ($e < time()) {
    tf_fail(410, 'expired');
}
$st = db()->prepare('SELECT * FROM ticket_files WHERE id = ?');
$st->execute([$id]);
$f = $st->fetch();
$st->closeCursor();
$path = $f ? tf_file_path($f['id'], $f['ext']) : '';
if (!$f || !is_file($path)) {
    tf_fail(404, 'not_found');
}

$size = (int) filesize($path);
$inline = in_array($f['kind'], ['image', 'audio', 'video'], true);
$name = (string) $f['name'];
$ascii = preg_replace('/[^A-Za-z0-9._-]+/', '_', $name) ?: 'file';
header('Content-Type: ' . $f['mime']);
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; media-src 'self'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
header('Cache-Control: private, max-age=21600');
header('X-Robots-Tag: noindex, nofollow');
header('Accept-Ranges: bytes');
header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($name));

$from = 0;
$to = $size - 1;
$range = (string) ($_SERVER['HTTP_RANGE'] ?? '');
if ($range !== '' && $size > 0) {
    if (!preg_match('/^bytes=(\d*)-(\d*)$/', trim($range), $m) || ($m[1] === '' && $m[2] === '')) {
        http_response_code(416);
        header("Content-Range: bytes */$size");
        exit;
    }
    if ($m[1] === '') {                       // the last N bytes
        $from = max(0, $size - (int) $m[2]);
    } else {
        $from = (int) $m[1];
        $to = $m[2] === '' ? $size - 1 : min($size - 1, (int) $m[2]);
    }
    if ($from > $to || $from >= $size) {
        http_response_code(416);
        header("Content-Range: bytes */$size");
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes $from-$to/$size");
}
header('Content-Length: ' . ($to - $from + 1));
if ($method === 'HEAD') {
    exit;
}
$fh = fopen($path, 'rb');
fseek($fh, $from);
$left = $to - $from + 1;
while ($left > 0 && !feof($fh)) {
    $chunk = fread($fh, (int) min(262144, $left));
    if ($chunk === false) {
        break;
    }
    echo $chunk;
    $left -= strlen($chunk);
    flush();
}
fclose($fh);
