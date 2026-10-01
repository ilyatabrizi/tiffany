You are replacing the live website at **tiffanybv.com** with a new Persian
version. I have cPanel and its File Manager already open in Chrome. Do the
whole thing yourself; only stop where something is ambiguous or destructive.

## What is happening

tiffanybv.com is already live and working — it currently serves the **English**
build of the TIFFANY by Vanda storefront. You are replacing it with the same
site **translated into Persian and flipped right-to-left**. Same design, same
photography, same structure; the language and the direction change.

The exact bundle to deploy:

  https://github.com/ilyatabrizi/tiffany/releases/download/v2.0.0/tiffanybv-com.zip

100 files, 5.11 MB. **Every file sits at the root of the archive** — there is no
wrapper folder — so it extracts directly into the document root.

The reference build, which the live site must end up matching exactly:

  https://ilyatabrizi.github.io/tiffany/

Open that first so you know what correct looks like: a Persian, right-to-left
shop — tabs reading خانه / فروشگاه / سبد / سفارش‌ها / پروفایل from the right,
the TIFFANY wordmark in Latin over a *playing* fashion film, prices in Persian
numerals (۱٬۶۸۰٬۰۰۰ تومان), product photos greyscale until touched.

## Before you touch anything

1. In cPanel → *Domains*, read the **Document Root** for tiffanybv.com and show
   it to me. It is already serving a working site, so this path is known-good —
   do not guess it, read it.
2. **Turn on "Show Hidden Files (dotfiles)"** in File Manager → Settings. The
   bundle contains a `.htaccess` that is doing real work on the live site right
   now, and without this setting you cannot see whether it survived.
3. List the document root and show me what is there.
4. Select everything in it and **Compress → zip** as
   `backup-english-<today's date>.zip`, then **move that zip one level above
   the document root** so it is not served to the public and not overwritten.
   Confirm the backup exists before going further.

## Replace the files

The old build and the new one are the same shape, so extracting over the top
mostly works — but it would leave orphans behind (the English build ships
`assets/fonts/inter.woff2`, which the Persian one does not use). Remove the old
app files first, then extract clean.

**Delete exactly these, and nothing else**, from the document root:

    index.html   404.html   sw.js   manifest.webmanifest   .htaccess
    assets/      css/       js/     media/

Leave anything else alone — in particular `cgi-bin`, `.well-known` (AutoSSL
lives there) and any folder belonging to another domain.

### Preferred — cPanel Terminal

If this cPanel has *Terminal* under Advanced, use it. One command, no clicking:

    cd ~/public_html          # or the real document root you read in step 1
    rm -rf index.html 404.html sw.js manifest.webmanifest .htaccess assets css js media
    curl -L -o tiffany-fa.zip https://github.com/ilyatabrizi/tiffany/releases/download/v2.0.0/tiffanybv-com.zip
    unzip -o tiffany-fa.zip
    rm tiffany-fa.zip
    ls -la

### Fallback — File Manager

1. Delete the paths listed above (hidden files visible, so `.htaccess` goes too).
2. Download the zip: open the release URL in a browser tab so it lands in Downloads.
3. File Manager → **Upload** → choose that zip → wait for 100%.
4. Back in the document root, right-click the zip → **Extract** → extract **into
   the document root itself**, not into a new folder. The result must be
   `index.html` sitting directly in the document root — not
   `tiffanybv-com/index.html`.
5. Delete the zip.

Then set permissions: files `644`, directories `755`, `.htaccess` `644`.

## Verify — by actually looking, not by assuming

Do not tell me it is done until each of these has returned what it should. If
one fails, say which and stop.

1. The document root's top level holds `index.html`, `404.html`, `.htaccess`,
   `sw.js`, `manifest.webmanifest` and the folders `assets`, `css`, `js`, `media`.
2. `https://tiffanybv.com/` returns **200** and the page source starts with
   `<html lang="fa" dir="rtl"`. If it still says `lang="en"`, the old file is
   still there or your browser is showing you a cached copy — hard-reload.
3. The page renders **Persian, right to left**: the tab bar reads خانه on the
   right through پروفایل on the left, and the film behind the wordmark is
   **moving**. A frozen still means `media/hero.mp4` did not upload fully
   (~1.4 MB).
4. `https://tiffanybv.com/assets/fonts/iranyekanx-fanum.woff2` returns **200**.
   This is the Persian typeface; a 404 here means the whole site falls back to a
   system font and the design is wrong.
5. `https://tiffanybv.com/assets/fonts/inter.woff2` returns **404** — proof the
   old files were actually removed rather than buried.
6. `https://tiffanybv.com/sw.js` returns 200 and contains `tiffany-fa-v1`.
7. `https://tiffanybv.com/manifest.webmanifest` is served as
   `application/manifest+json`, not `text/plain`. If it is wrong the `.htaccess`
   did not extract — check it is there and is `644`.
8. Click through the live site: all five tabs load, a product page opens,
   «افزودن به سبد» works, the bag shows a total in Persian numerals, and the
   footer carries the Alpha Agency signature.
9. Browser console is clean — no errors.
10. Prices read as Persian numerals with the ٬ separator (۱٬۶۸۰٬۰۰۰ تومان), not
    Latin digits.

## About the old version in people's browsers

The site installs a service worker, so anyone who already opened the English
version is holding it. The English worker fetched markup and code from the
network first, so their next load picks up the new page and the new worker by
itself, and the new worker deletes the old cache on activation. **No action
needed** — but if *you* still see English after deploying, that is your own
cached worker, not the server. Hard-reload, or check in a private window, before
reporting a problem.

## Rules

- **Apply this build exactly.** Do not edit, retranslate, reformat, "improve" or
  regenerate any file in the bundle. It is tested; changing it breaks it.
- Do not touch any other domain, folder or account on this cPanel.
- Do not delete anything beyond the list above without showing me first.
- Report only what you actually ran and actually saw. If a step did not happen,
  say so — do not summarise it as done.

## Two things to tell me at the end

1. **All commercial copy on this site is placeholder** — every product name,
   price, fabric, measurement and delivery promise is written copy, now in
   Persian, which makes it read *more* convincingly and not less. The
   photography is the client's own; nothing else is. Remind me of this when you
   are done.
2. The site links Instagram **@tiffanyiran**. The client's own carrier bag
   prints **@tiffanybyvanda**. I still have not resolved which is live. Do not
   change it — just remind me.
