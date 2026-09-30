#!/usr/bin/env python3
"""Build the upload bundle for a real domain.

    python3 scripts/make_deploy.py tiffanybv.com

Produces dist/<domain>.zip with every file at the ROOT of the archive — a
wrapper folder is the classic cPanel trap: Extract drops a directory into
public_html and the site 404s while every file is plainly there.

What changes between GitHub Pages and a domain of one's own:
  * og:url, og:image and a canonical link become absolute, because a share
    card cannot resolve a relative path
  * .htaccess ships (MIME types, canonical host, cache policy)
  * nothing from docs/, scripts/, media/raw/ or the test harness goes near it
"""

import pathlib
import re
import shutil
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# Everything the browser asks for, and nothing else.
INCLUDE_FILES = ["index.html", "404.html", ".htaccess",
                 "manifest.webmanifest", "sw.js"]
INCLUDE_DIRS = ["css", "js", "assets/fonts", "assets/brand", "assets/icons",
                "assets/img"]
INCLUDE_GLOBS = [("media", "hero.mp4"), ("media", "hero-poster.webp")]
SKIP_NAMES = {".DS_Store"}


def production_html(html, domain):
    base = f"https://{domain}/"
    html = html.replace('<meta property="og:image" content="assets/img/og.jpg">',
                        f'<meta property="og:image" content="{base}assets/img/og.jpg">')
    if 'property="og:url"' not in html:
        html = html.replace('<meta property="og:type" content="website">',
                            '<meta property="og:type" content="website">\n'
                            f'<meta property="og:url" content="{base}">')
    if 'rel="canonical"' not in html:
        html = html.replace('<link rel="manifest" href="manifest.webmanifest">',
                            f'<link rel="canonical" href="{base}">\n'
                            '<link rel="manifest" href="manifest.webmanifest">')
    return html


def collect(domain):
    if DIST.exists():
        shutil.rmtree(DIST)
    stage = DIST / "site"
    stage.mkdir(parents=True)

    for name in INCLUDE_FILES:
        src = ROOT / name
        if not src.exists():
            print(f"  ! missing {name}")
            continue
        if name == "index.html":
            (stage / name).write_text(production_html(src.read_text(), domain))
        else:
            shutil.copy2(src, stage / name)

    for d in INCLUDE_DIRS:
        src = ROOT / d
        if not src.exists():
            print(f"  ! missing {d}/")
            continue
        for f in sorted(src.rglob("*")):
            if f.is_dir() or f.name in SKIP_NAMES:
                continue
            rel = f.relative_to(ROOT)
            out = stage / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, out)

    for d, name in INCLUDE_GLOBS:
        src = ROOT / d / name
        if not src.exists():
            print(f"  ! missing {d}/{name}")
            continue
        out = stage / d / name
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, out)

    return stage


def pack(stage, domain):
    out = DIST / f"{domain.replace('.', '-')}.zip"
    files = sorted(p for p in stage.rglob("*") if p.is_file())
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(f, f.relative_to(stage))      # relative to stage = root of zip
    return out, files


if __name__ == "__main__":
    domain = sys.argv[1] if len(sys.argv) > 1 else "tiffanybv.com"
    print(f"building for {domain}")
    stage = collect(domain)
    out, files = pack(stage, domain)

    total = sum(f.stat().st_size for f in files)
    print(f"\n  {len(files)} files, {total / 1048576:.2f}MB uncompressed")
    print(f"  {out.relative_to(ROOT)}  {out.stat().st_size / 1048576:.2f}MB")

    with zipfile.ZipFile(out) as z:
        names = z.namelist()
    top = sorted({n.split('/')[0] for n in names})
    print(f"  archive root: {', '.join(top)}")
    assert "index.html" in names, "index.html is not at the archive root"
    print("  index.html sits at the root — Extract will not strand it")
