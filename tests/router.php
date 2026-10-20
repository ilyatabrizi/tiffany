<?php
/* The host's .htaccess, for PHP's own little server, so the crawlable
   addresses (/p/…, /c/…, /shop, /sitemap.xml, /llms.txt) and the /join
   redirect work on a laptop:

     TIFFANY_DATA=/tmp/tf php -S 127.0.0.1:8150 tests/router.php

   The rules are read from .htaccess itself (every «RewriteRule … seo.php?…»
   line, and every redirect line with [R=…]), so the tests run the rules the
   host runs, not a copy of them. */
$root = dirname(__DIR__);
$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

foreach (file($root . '/.htaccess', FILE_IGNORE_NEW_LINES) as $line) {
    /* Redirects to a page of this site (the https and www ones go to
       another host under conditions, and are not for a laptop). */
    if (preg_match('~^\s*RewriteRule\s+(\S+)\s+(/\S*)\s+\[R=(30[1278])(?:,[A-Z]+)*\]\s*$~', $line, $r)) {
        if (preg_match('~' . str_replace('~', '\~', $r[1]) . '~', ltrim($path, '/'))) {
            header('Location: ' . $r[2], true, (int) $r[3]);
            return true;
        }
        continue;
    }
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
