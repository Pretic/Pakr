import io
import os
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ICON_MODE = os.environ.get("ICON_MODE", "generated").strip().lower()
ICON_URL = os.environ.get("ICON_URL", "").strip()
ICON_COLOR = os.environ.get("ICON_COLOR", "#BF3EFF").strip()
APP_NAME = os.environ.get("APP_NAME", "").strip()
PACKAGE_NAME = os.environ.get("PACKAGE_NAME", "").strip()
DEFAULT_LOGO_NAMES = ("logo.jpg", "logo.jpeg", "logo.png")


def normalize_color(value):
    match = re.fullmatch(r"#?([0-9a-fA-F]{6})", value or "")
    return "#" + match.group(1).upper() if match else "#BF3EFF"


def icon_letter(app_name, package_name):
    match = re.search(r"[A-Za-z]", app_name or "")
    if match:
        return match.group(0).upper()

    package = package_name or ""
    package_tail = package[4:] if package.startswith("com.") else package
    match = re.search(r"[A-Za-z]", package_tail)
    return match.group(0).upper() if match else "A"


def load_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def valid_icon_url(url):
    return bool(re.match(r"^https?://", url or "", re.I))


def default_logo_icon():
    search_dirs = [
        Path.cwd(),
        Path(__file__).resolve().parent.parent,
    ]
    for base in search_dirs:
        for name in DEFAULT_LOGO_NAMES:
            path = base / name
            if path.exists():
                print(f"Default logo icon: {path}")
                return Image.open(path).convert("RGBA")
    raise FileNotFoundError("Default logo.jpg was not found in repository root.")


def download_icon(url):
    if not valid_icon_url(url):
        print("Image icon URL is empty or invalid; using default logo.")
        return default_logo_icon()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read()
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
        print(f"Image OK: {img.format} {img.size}")
        return img
    except Exception as exc:
        print(f"Image icon download/open failed: {exc}; using default logo.")
        return default_logo_icon()


def generated_icon():
    size = 1024
    color = normalize_color(ICON_COLOR)
    letter = icon_letter(APP_NAME, PACKAGE_NAME)
    img = Image.new("RGBA", (size, size), color)
    draw = ImageDraw.Draw(img)
    font = load_font(560)
    bbox = draw.textbbox((0, 0), letter, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = (size - width) / 2 - bbox[0]
    y = (size - height) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), letter, font=font, fill="#FFFFFF")
    print(f"Text icon: {letter} on {color}")
    return img


def write_icons(img):
    for density, size in [
        ("mdpi", 48),
        ("hdpi", 72),
        ("xhdpi", 96),
        ("xxhdpi", 144),
        ("xxxhdpi", 192),
    ]:
        out = img.resize((size, size), Image.LANCZOS)
        base = Path(f"app/src/main/res/mipmap-{density}")
        base.mkdir(parents=True, exist_ok=True)
        out.save(base / "ic_launcher.png")

        mask = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=(255, 255, 255, 255))
        result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        result.paste(out, mask=mask)
        result.save(base / "ic_launcher_round.png")
    print("Icon ALL OK")


if __name__ == "__main__":
    image = download_icon(ICON_URL) if ICON_MODE == "url" else generated_icon()
    write_icons(image)
