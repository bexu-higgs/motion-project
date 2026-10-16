"""Prepare every image the video needs from the real screenshots in assets/source.

  * copies the screenshots to public/screens (served to Remotion via staticFile)
  * exports every named region in src/regions.json as a PNG cut-out to assets/cutouts
  * builds public/img/site-backdrop.jpg: blurred pricing page used behind the final recap
  * builds public/img/explore-feed.jpg: an out-of-focus stand-in for the Explore feed that sits
    behind the closed menu (no screenshot of the closed page exists, so the feed is shown blurred,
    built only from the real page pixels visible at the right edge of the menu screenshots)

Run:  python3 scripts/prepare_assets.py
"""
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "source"
CUTOUTS = ROOT / "assets" / "cutouts"
PUBLIC = ROOT / "public"


def copy_screens(cfg):
    (PUBLIC / "screens").mkdir(parents=True, exist_ok=True)
    for s in cfg["sources"].values():
        shutil.copy2(SRC / s["file"], PUBLIC / "screens" / s["file"])


def export_cutouts(cfg):
    CUTOUTS.mkdir(parents=True, exist_ok=True)
    for name, r in cfg["regions"].items():
        s = cfg["sources"][r["src"]]
        x, y, w, h = r["box"]
        Image.open(SRC / s["file"]).convert("RGB").crop((x, y, x + w, y + h)).save(CUTOUTS / f"{name}.png")


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius, fill=255)
    out = Image.new("RGBA", img.size)
    out.paste(img, (0, 0), mask)
    return out


def build_feed():
    """Page area below the header (source px 0..1080 x 400..2354) as blurred feed cards."""
    strips = [Image.open(SRC / f).convert("RGB") for f in
              ("01-menu-logged-out.jpg", "03-menu-logged-in.jpg", "04-profile-popup.jpg")]
    W, H = 1080, 1954
    feed = Image.new("RGB", (W, H), (8, 8, 8))
    # (strip index, strip y0, strip y1, card box in feed coords)
    cards = [
        (0, 415, 948, (36, 20, 1044, 560)),
        (1, 1095, 1255, (36, 600, 530, 1000)),
        (2, 1370, 1570, (550, 600, 1044, 1000)),
        (1, 1630, 1930, (36, 1040, 530, 1500)),
        (0, 1880, 2260, (550, 1040, 1044, 1500)),
        (2, 1830, 2100, (36, 1540, 1044, 1954)),
    ]
    for idx, y0, y1, (bx0, by0, bx1, by1) in cards:
        tex = strips[idx].crop((956, y0, 1040, y1)).resize((bx1 - bx0, by1 - by0), Image.BICUBIC)
        tex = ImageEnhance.Brightness(tex).enhance(2.1)
        tex = ImageEnhance.Color(tex).enhance(1.15)
        tex = tex.filter(ImageFilter.GaussianBlur(26))
        feed.paste(rounded(tex, 36), (bx0, by0), rounded(tex, 36))
    feed = feed.filter(ImageFilter.GaussianBlur(6))
    feed.save(PUBLIC / "img" / "explore-feed.jpg", quality=90)


def build_site_backdrop():
    """Soft, dimmed full-frame backdrop of the real pricing page for the recap scene."""
    im = Image.open(SRC / "06-landscape-billing-toggle.jpg").convert("RGB").crop((96, 251, 2400, 1035))
    im = im.resize((1920, 653), Image.LANCZOS)
    canvas = Image.new("RGB", (1920, 1080), (8, 9, 11))
    canvas.paste(im, (0, 214))
    canvas = canvas.filter(ImageFilter.GaussianBlur(18))
    canvas = ImageEnhance.Brightness(canvas).enhance(0.55)
    canvas.save(PUBLIC / "img" / "site-backdrop.jpg", quality=88)


if __name__ == "__main__":
    cfg = json.loads((ROOT / "src" / "regions.json").read_text())
    copy_screens(cfg)
    export_cutouts(cfg)
    build_feed()
    build_site_backdrop()
    print("screens:", len(cfg["sources"]), "cutouts:", len(cfg["regions"]))
