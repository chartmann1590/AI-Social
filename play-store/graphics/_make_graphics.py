"""Generate Play Store graphics from the existing app icon.

Produces:
  - icon-512.png        512x512 (Play listing icon)
  - feature-graphic.png 1024x500 (Play feature graphic, solid gradient w/ icon + wordmark)
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ICON_SRC = HERE / "icon-source.png"


def linear_gradient(size, top, bottom):
    img = Image.new("RGB", size, top)
    draw = ImageDraw.Draw(img)
    w, h = size
    tr, tg, tb = top
    br, bg, bb = bottom
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(tr + (br - tr) * t)
        g = int(tg + (bg - tg) * t)
        b = int(tb + (bb - tb) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def diagonal_gradient(size, a, b):
    w, h = size
    img = Image.new("RGB", size, a)
    px = img.load()
    ar, ag, ab = a
    br, bg, bb = b
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            px[x, y] = (
                int(ar + (br - ar) * t),
                int(ag + (bg - ag) * t),
                int(ab + (bb - ab) * t),
            )
    return img


def load_font(size):
    for cand in [
        "C:/Windows/Fonts/seguisb.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]:
        try:
            return ImageFont.truetype(cand, size)
        except Exception:
            pass
    return ImageFont.load_default()


def make_icon_512():
    src = Image.open(ICON_SRC).convert("RGBA")
    out = src.resize((512, 512), Image.LANCZOS)
    out.save(HERE / "icon-512.png", "PNG", optimize=True)
    print("wrote", HERE / "icon-512.png")


def make_feature_graphic():
    W, H = 1024, 500
    bg = diagonal_gradient((W, H), (23, 10, 52), (85, 24, 140))
    # subtle spotlight
    spot = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spot)
    sd.ellipse([-100, -200, 700, 700], fill=(255, 255, 255, 28))
    spot = spot.filter(ImageFilter.GaussianBlur(60))
    canvas = Image.alpha_composite(bg.convert("RGBA"), spot)

    # icon
    icon = Image.open(ICON_SRC).convert("RGBA").resize((360, 360), Image.LANCZOS)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = ImageDraw.Draw(shadow)
    sh.rounded_rectangle([62, 78, 62 + 360, 78 + 360], radius=72, fill=(0, 0, 0, 160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(icon, (60, 70))

    d = ImageDraw.Draw(canvas)
    title = "AISocial"
    subtitle = "On-device AI social feed"
    tag = "Gemma 4 · Qwen 2.5 · DeepSeek R1 — all running on your phone"

    title_font = load_font(108)
    sub_font = load_font(38)
    tag_font = load_font(26)

    d.text((470, 110), title, font=title_font, fill=(255, 255, 255))
    d.text((472, 240), subtitle, font=sub_font, fill=(230, 216, 255))
    d.text((472, 300), tag, font=tag_font, fill=(178, 150, 228))

    # accent bar
    d.rounded_rectangle([472, 360, 630, 372], radius=6, fill=(255, 170, 220))

    canvas.convert("RGB").save(HERE / "feature-graphic.png", "PNG", optimize=True)
    print("wrote", HERE / "feature-graphic.png")


if __name__ == "__main__":
    make_icon_512()
    make_feature_graphic()
