<?php
/* The host's .htaccess, for PHP's own little server, so the crawlable
   addresses (/p/…, /c/…, /shop, /sitemap.xml, /llms.txt) work on a laptop:

     TIFFANY_DATA=/tmp/tf php -S 127.0.0.1:8150 tests/router.php

   The rules are read from .htaccess itself (every «RewriteRule … seo.php?…»
   line), so seo_test.py tests the rules the host runs, not a copy of them. */
$root = dirname(__DIR__);
$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

foreach (file($root . '/.htaccess', FILE_IGNORE_NEW_LINES) as $line) {
    if (!preg_match('~^\s*RewriteRule\s+(\S+)\s+seo\.php\?(\S+)\s+\[L\]\s*$~', $line, $r)) {
        continue;
    }
    if (!preg_match('~' . str_replace('~', '\~', $r[1]) . '~', ltrim($path, '/'), $m)) {
        continue;
    }
    parse_str(preg_replace_callback('~\$(\d)~', static fn ($d) => $m[(int) $d[1]] ?? '', $r[2]), $q);
    $_GET = $q;
    chdir($root);
    require $root . '/seo.php';
    return true;
}
return false;
