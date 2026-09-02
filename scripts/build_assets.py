#!/usr/bin/env python3
"""Everything the studio sent -> everything the app ships.

Six campaign frames, one transparent wordmark and a 22-second studio film
arrive from TIFFANY. The app has to open on a phone in Iran, on mobile data,
first try. So:

  photos  -> WebP at 480/960 (cards) and 720/1080 (full-bleed looks)
  hero    -> a trimmed, silent, 576-wide H.264 loop that fades through white
             at the seam, plus a WebP poster
  brand   -> the wordmark in white and in ink, trimmed to its own ink
  icons   -> the wordmark on black at 180/192/512/1024 + a maskable
  og      -> a 1200x630 share card

    python3 scripts/build_assets.py           # everything
    python3 scripts/build_assets.py hero      # or one stage

Needs Pillow and imageio-ffmpeg. Nothing else.
"""

import pathlib
import subprocess
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "media" / "raw"
IMG = ROOT / "assets" / "img"
BRAND = ROOT / "assets" / "brand"
ICONS = ROOT / "assets" / "icons"
MEDIA = ROOT / "media"

INK = (10, 10, 10)

# The studio film opens and closes on black flash frames; this is the clean
# middle, and it fades through the white cyc at both ends so the loop seam
# reads as a breath rather than a cut.
HERO_START = 6.75
HERO_LEN = 13.8
HERO_W = 576
HERO_FADE = 0.55


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def crop_frac(im, box):
    """Crop by fractions of the source, so the numbers stay readable."""
    w, h = im.size
    x0, y0, x1, y1 = box
    return im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))


def fit_ratio(im, ratio, bias=0.5):
    """Centre-crop to an aspect ratio; bias moves the vertical window."""
    tw, th = ratio
    w, h = im.size
    if w * th > h * tw:
        nw = round(h * tw / th)
        left = round((w - nw) * 0.5)
        return im.crop((left, 0, left + nw, h))
    nh = round(w * th / tw)
    top = round((h - nh) * bias)
    return im.crop((0, top, w, top + nh))


def emit(im, name, widths, quality=82):
    IMG.mkdir(parents=True, exist_ok=True)
    for wpx in widths:
        if im.width < wpx:
            out = im.copy()
            if wpx == widths[0]:
                print(f"  ! {name} is only {im.width}px wide (asked {wpx})")
        else:
            out = im.resize((wpx, round(im.height * wpx / im.width)), Image.LANCZOS)
        p = IMG / f"{name}-{wpx}.webp"
        out.save(p, "WEBP", quality=quality, method=6)
        print(f"  {p.name:34s} {out.width}x{out.height}  {p.stat().st_size // 1024}KB")


# ---------------------------------------------------------------- photos
# (source, crop box in fractions, aspect ratio, vertical bias, widths)
SHOTS = {
    # collections + editorial ------------------------------------------
    "col-pastel":    ("campaign-cars", (0.00, 0.05, 1.00, 0.98), (3, 4), 0.5, (480, 960)),
    "col-noir":      ("duo-mono",      (0.00, 0.00, 1.00, 0.84), (3, 4), 0.22, (480, 960)),
    "col-desert":    ("western-duo",   (0.00, 0.11, 1.00, 1.00), (3, 4), 0.22, (480, 960)),
    "ed-pastel":     ("trio-pastel",   (0.00, 0.00, 1.00, 1.00), (16, 10), 0.30, (480, 960)),
    "ed-noir":       ("lace-solo",     (0.00, 0.00, 1.00, 1.00), (16, 10), 0.28, (480, 960)),

    # looks — full bleed, story ratio ----------------------------------
    "look-1": ("campaign-cars", (0.00, 0.02, 1.00, 1.00), (9, 16), 0.5, (720, 1080)),
    "look-2": ("trio-pastel",   (0.00, 0.00, 1.00, 1.00), (9, 16), 0.5, (720, 1080)),
    "look-3": ("duo-pink",      (0.00, 0.00, 1.00, 1.00), (9, 16), 0.5, (720, 1080)),
    "look-4": ("lace-solo",     (0.00, 0.00, 1.00, 1.00), (9, 16), 0.5, (720, 1080)),
    "look-5": ("duo-mono",      (0.00, 0.00, 1.00, 0.93), (9, 16), 0.5, (720, 1080)),
    "look-6": ("western-duo",   (0.00, 0.00, 1.00, 1.00), (9, 16), 0.5, (720, 1080)),

    # products — PASTEL PLAY -------------------------------------------
    "p-alphabet-tee":  ("trio-pastel",   (0.00, 0.26, 0.58, 0.74), (4, 5), 0.5, (480, 960)),
    "p-organza-skirt": ("campaign-cars", (0.26, 0.52, 0.76, 0.99), (4, 5), 0.5, (480, 960)),
    "p-heart-belt":    ("trio-pastel",   (0.02, 0.52, 0.56, 0.90), (4, 5), 0.5, (480, 960)),
    "p-crinkle-shirt": ("duo-pink",      (0.34, 0.26, 1.00, 0.80), (4, 5), 0.5, (480, 960)),
    "p-pleat-trouser": ("trio-pastel",   (0.44, 0.48, 0.88, 0.98), (4, 5), 0.5, (480, 960)),
    "p-polka-skirt":   ("trio-pastel",   (0.60, 0.52, 1.00, 1.00), (4, 5), 0.5, (480, 960)),
    "p-rib-tee":       ("duo-pink",      (0.34, 0.26, 0.88, 0.68), (4, 5), 0.5, (480, 960)),

    # products — LACE NOIR ---------------------------------------------
    "p-lace-bandeau":  ("lace-solo",     (0.24, 0.26, 1.00, 0.74), (4, 5), 0.5, (480, 960)),
    "p-mesh-cami":     ("duo-mono",      (0.52, 0.22, 0.96, 0.70), (4, 5), 0.5, (480, 960)),
    "p-linen-trouser": ("lace-solo",     (0.30, 0.60, 1.00, 1.00), (4, 5), 0.5, (480, 960)),
    "p-pearl-cap":     ("lace-solo",     (0.28, 0.00, 0.96, 0.40), (4, 5), 0.5, (480, 960)),
    "p-tinted-shades": ("duo-mono",      (0.02, 0.00, 0.78, 0.38), (4, 5), 0.5, (480, 960)),

    # products — DESERT HOURS ------------------------------------------
    "p-prairie-blouse":("western-duo",   (0.00, 0.28, 0.60, 0.78), (4, 5), 0.5, (480, 960)),
    "p-concho-belt":   ("western-duo",   (0.06, 0.50, 0.58, 0.90), (4, 5), 0.5, (480, 960)),
    "p-brim-hat":      ("western-duo",   (0.00, 0.00, 0.70, 0.38), (4, 5), 0.5, (480, 960)),
    "p-print-skirt":   ("western-duo",   (0.52, 0.60, 1.00, 1.00), (4, 5), 0.5, (480, 960)),
    "p-sheer-blouse":  ("western-duo",   (0.52, 0.26, 1.00, 0.76), (4, 5), 0.5, (480, 960)),
}


def build_photos():
    print("photos")
    for name, (src, box, ratio, bias, widths) in SHOTS.items():
        p = RAW / f"{src}.jpg"
        if not p.exists():
            print(f"  ! missing {p.name}")
            continue
        im = Image.open(p).convert("RGB")
        emit(fit_ratio(crop_frac(im, box), ratio, bias), name, widths)


# ----------------------------------------------------------------- brand
def build_brand():
    print("brand")
    BRAND.mkdir(parents=True, exist_ok=True)
    src = Image.open(RAW / "logo-white.png").convert("RGBA")
    src = src.crop(src.getchannel("A").getbbox())

    for name, rgb in (("wordmark-white", (255, 255, 255)), ("wordmark-ink", INK)):
        tint = Image.new("RGBA", src.size, rgb + (0,))
        tint.putalpha(src.getchannel("A"))
        for wpx in (600, 1200):
            out = tint.resize((wpx, round(tint.height * wpx / tint.width)), Image.LANCZOS)
            p = BRAND / f"{name}-{wpx}.png"
            out.save(p, "PNG", optimize=True)
            print(f"  {p.name:34s} {out.width}x{out.height}  {p.stat().st_size // 1024}KB")
    return src


# ----------------------------------------------------------------- icons
def build_icons():
    print("icons")
    ICONS.mkdir(parents=True, exist_ok=True)
    src = Image.open(RAW / "logo-white.png").convert("RGBA")
    src = src.crop(src.getchannel("A").getbbox())

    def square(size, inset, ground=INK):
        canvas = Image.new("RGBA", (size, size), ground + (255,))
        w = round(size * inset)
        mark = src.resize((w, round(src.height * w / src.width)), Image.LANCZOS)
        canvas.alpha_composite(mark, ((size - w) // 2, (size - mark.height) // 2))
        return canvas.convert("RGB")

    for size in (180, 192, 512, 1024):
        p = ICONS / f"icon-{size}.png"
        square(size, 0.78).save(p, "PNG", optimize=True)
        print(f"  {p.name:34s} {size}x{size}  {p.stat().st_size // 1024}KB")

    # maskable keeps everything inside the 80% safe circle
    p = ICONS / "maskable-512.png"
    square(512, 0.56).save(p, "PNG", optimize=True)
    print(f"  {p.name:34s} 512x512  {p.stat().st_size // 1024}KB")

    p = ICONS / "favicon-32.png"
    square(32, 0.86).save(p, "PNG", optimize=True)
    print(f"  {p.name:34s} 32x32")


# ------------------------------------------------------------------- og
def build_og():
    print("og")
    im = Image.open(RAW / "campaign-cars.jpg").convert("RGB")
    card = fit_ratio(im, (1200, 630), 0.28).resize((1200, 630), Image.LANCZOS)

    mark = Image.open(RAW / "logo-white.png").convert("RGBA")
    mark = mark.crop(mark.getchannel("A").getbbox())
    w = 420
    mark = mark.resize((w, round(mark.height * w / mark.width)), Image.LANCZOS)

    scrim = Image.new("RGBA", card.size, (0, 0, 0, 0))
    for y in range(card.height):
        a = int(150 * max(0, (y - card.height * 0.45) / (card.height * 0.55)) ** 1.4)
        for_row = Image.new("RGBA", (card.width, 1), (10, 10, 10, a))
        scrim.paste(for_row, (0, y))
    out = Image.alpha_composite(card.convert("RGBA"), scrim)
    out.alpha_composite(mark, ((1200 - w) // 2, 630 - mark.height - 64))

    p = IMG / "og.jpg"
    out.convert("RGB").save(p, "JPEG", quality=86, optimize=True)
    print(f"  {p.name:34s} 1200x630  {p.stat().st_size // 1024}KB")


# ------------------------------------------------------------------ hero
def build_hero():
    print("hero")
    MEDIA.mkdir(parents=True, exist_ok=True)
    ff = ffmpeg()
    src = str(RAW / "campaign-film.mp4")
    out = MEDIA / "hero.mp4"
    fade_out = HERO_LEN - HERO_FADE

    subprocess.run([
        ff, "-v", "error", "-y",
        "-ss", str(HERO_START), "-t", str(HERO_LEN), "-i", src,
        "-vf", (f"scale={HERO_W}:-2,"
                f"fade=t=in:st=0:d={HERO_FADE}:color=white,"
                f"fade=t=out:st={fade_out}:d={HERO_FADE}:color=white"),
        "-an", "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
        "-crf", "27", "-preset", "slow", "-g", "60",
        "-movflags", "+faststart", str(out),
    ], check=True)
    print(f"  {out.name:34s} {out.stat().st_size // 1024}KB")

    # poster: a frame far enough in that the white fade has cleared
    tmp = MEDIA / "_poster.png"
    subprocess.run([
        ff, "-v", "error", "-y", "-ss", str(HERO_START + 2.4), "-i", src,
        "-frames:v", "1", "-vf", f"scale={HERO_W}:-2", str(tmp),
    ], check=True)
    poster = Image.open(tmp).convert("RGB")
    p = MEDIA / "hero-poster.webp"
    poster.save(p, "WEBP", quality=80, method=6)
    tmp.unlink()
    print(f"  {p.name:34s} {poster.width}x{poster.height}  {p.stat().st_size // 1024}KB")


# --------------------------------------------------------------- contact
def contact_sheet():
    """One grid of every crop, so the framing gets checked instead of hoped."""
    names = sorted(p.stem for p in IMG.glob("*-480.webp"))
    names += sorted(p.stem for p in IMG.glob("*-720.webp"))
    cell, cols = 190, 6
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), (245, 245, 245))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        im = Image.open(IMG / f"{n}.webp").convert("RGB")
        im.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
        x, y = (i % cols) * cell, (i // cols) * (cell + 18)
        sheet.paste(im, (x + 4, y + 4))
        d.text((x + 4, y + cell + 2), n.replace("-480", "").replace("-720", ""),
               fill=(20, 20, 20))
    out = ROOT / "docs" / "contact-sheet.png"
    out.parent.mkdir(exist_ok=True)
    sheet.save(out)
    print(f"contact sheet -> {out}")


STAGES = {"photos": build_photos, "brand": build_brand, "icons": build_icons,
          "og": build_og, "hero": build_hero, "sheet": contact_sheet}

if __name__ == "__main__":
    want = sys.argv[1:] or ["photos", "brand", "icons", "og", "hero", "sheet"]
    for s in want:
        STAGES[s]()
