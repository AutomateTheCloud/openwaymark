# Copyright 2026 Automate the Cloud Inc.
# SPDX-License-Identifier: Apache-2.0
"""Draws the images used by the example bundles in examples/.

Every image is drawn here from scratch, so the examples contain only original
artwork that can be licensed under Apache 2.0 with the rest of the repository.
No image carries Exif or other metadata.

Requires Python 3.10+ and Pillow with WebP support. Fonts are Noto Sans and
Noto Sans Mono from the system (Debian/Ubuntu: fonts-noto-core). Run from the
repository root:

    python3 tools/generate-example-images.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path("/usr/share/fonts/truetype/noto")
INK = (33, 37, 41)
MUTED = (96, 104, 112)
LINE = (173, 181, 189)
PANEL = (241, 243, 245)
WHITE = (255, 255, 255)
BLUE = (37, 99, 235)
RED = (185, 28, 28)
REDS = [(254, 226, 226), (252, 165, 165), (254, 202, 202), (248, 113, 113)]


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    name = "NotoSansMono-Regular.ttf" if mono else "NotoSans-Bold.ttf" if bold else "NotoSans-Regular.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size)


def centered(draw: ImageDraw.ImageDraw, box, text: str, fnt, fill=INK) -> None:
    left, top, right, bottom = box
    draw.multiline_text(((left + right) / 2, (top + bottom) / 2), text, font=fnt, fill=fill, anchor="mm", align="center")


def arrow(draw: ImageDraw.ImageDraw, start, end, fill=MUTED, width=4) -> None:
    draw.line([start, end], fill=fill, width=width)
    (x0, y0), (x1, y1) = start, end
    direction = 1 if x1 > x0 else -1
    draw.polygon([(x1, y1), (x1 - 16 * direction, y1 - 9), (x1 - 16 * direction, y1 + 9)], fill=fill)


def save(image: Image.Image, path: Path, **options) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, **options)
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def dns_lookup(path: Path) -> None:
    image = Image.new("RGB", (1000, 380), WHITE)
    draw = ImageDraw.Draw(image)
    boxes = {"Client": (40, 140, 260, 260), "Resolver": (390, 140, 610, 260), "Name server": (740, 140, 960, 260)}
    for label, box in boxes.items():
        draw.rounded_rectangle(box, radius=18, fill=PANEL, outline=LINE, width=3)
        centered(draw, box, label, font(30, bold=True))
    small = font(22, mono=True)
    arrow(draw, (262, 180), (388, 180))
    arrow(draw, (612, 180), (738, 180))
    arrow(draw, (738, 228), (612, 228), fill=BLUE)
    arrow(draw, (388, 228), (262, 228), fill=BLUE)
    draw.text((325, 120), "example.com A?", font=small, fill=MUTED, anchor="mm")
    draw.text((675, 120), "example.com A?", font=small, fill=MUTED, anchor="mm")
    draw.text((675, 290), "192.0.2.10", font=small, fill=BLUE, anchor="mm")
    draw.text((325, 290), "192.0.2.10", font=small, fill=BLUE, anchor="mm")
    draw.text((500, 50), "A DNS lookup", font=font(32, bold=True), fill=INK, anchor="mm")
    save(image, path, optimize=True)


def aaaa_record(path: Path) -> None:
    image = Image.new("RGB", (1000, 240), WHITE)
    draw = ImageDraw.Draw(image)
    headers = ["Name", "TTL", "Class", "Type", "Value"]
    columns = [40, 330, 450, 580, 700]
    for x, header in zip(columns, headers):
        draw.text((x, 50), header, font=font(26, bold=True), fill=INK)
    draw.line([(40, 100), (960, 100)], fill=LINE, width=3)
    for x, value in zip(columns, ["example.com.", "3600", "IN", "AAAA", "2001:db8::10"]):
        draw.text((x, 130), value, font=font(26, mono=True), fill=BLUE if value == "AAAA" else INK)
    save(image, path, optimize=True)


def heart_chambers(path: Path) -> None:
    image = Image.new("RGB", (800, 860), WHITE)
    draw = ImageDraw.Draw(image)
    cells = [(60, 60, 390, 330), (410, 60, 740, 330), (60, 350, 390, 760), (410, 350, 740, 760)]
    for number, (cell, fill) in enumerate(zip(cells, REDS), start=1):
        draw.rounded_rectangle(cell, radius=40, fill=fill, outline=RED, width=4)
        centered(draw, cell, str(number), font(96, bold=True))
    draw.line([(400, 40), (400, 780)], fill=RED, width=6)
    draw.text((400, 815), "Schematic front view. The heart's right side is on the viewer's left.", font=font(22), fill=MUTED, anchor="mm")
    save(image, path, optimize=True)


def blood_flow(path: Path) -> None:
    steps = ["Body", "Right atrium", "Right ventricle", "Lungs", "Left atrium", "Left ventricle", "Aorta"]
    image = Image.new("RGB", (1200, 420), WHITE)
    draw = ImageDraw.Draw(image)
    width, gap, top = 150, 18, 150
    for index, step in enumerate(steps):
        left = 30 + index * (width + gap)
        box = (left, top, left + width, top + 120)
        draw.rounded_rectangle(box, radius=16, fill=PANEL, outline=LINE, width=3)
        centered(draw, box, step.replace(" ", "\n"), font(24, bold=True))
        if index < len(steps) - 1:
            arrow(draw, (left + width + 1, top + 60), (left + width + gap - 1, top + 60), width=3)
    draw.text((600, 70), "Path of blood through the heart", font=font(32, bold=True), fill=INK, anchor="mm")
    draw.text((600, 340), "Blood returns to the body from the aorta, and the cycle repeats.", font=font(22), fill=MUTED, anchor="mm")
    save(image, path, lossless=True, quality=100, method=6)


def shape(path: Path, kind: str) -> None:
    image = Image.new("RGB", (400, 400), WHITE)
    draw = ImageDraw.Draw(image)
    if kind == "triangle":
        draw.polygon([(200, 60), (350, 330), (50, 330)], fill=BLUE)
    elif kind == "square":
        draw.rectangle((80, 80, 320, 320), fill=BLUE)
    else:
        draw.ellipse((70, 70, 330, 330), fill=BLUE)
    save(image, path, quality=90, optimize=True)


def divider(path: Path) -> None:
    image = Image.new("RGBA", (1000, 40), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.line([(40, 20), (960, 20)], fill=LINE + (255,), width=3)
    for x in (480, 500, 520):
        draw.ellipse((x - 6, 14, x + 6, 26), fill=MUTED + (255,))
    save(image, path, optimize=True)


def main() -> None:
    root = Path("examples")
    dns_lookup(root / "networking-fundamentals/assets/dns-lookup.png")
    aaaa_record(root / "networking-fundamentals/assets/aaaa-record.png")
    heart_chambers(root / "anatomy-basics/assets/heart-chambers.png")
    blood_flow(root / "anatomy-basics/assets/blood-flow.webp")
    for kind in ("triangle", "square", "circle"):
        shape(root / f"rendering-showcase/assets/shapes/{kind}.jpg", kind)
    divider(root / "rendering-showcase/assets/divider.png")


if __name__ == "__main__":
    main()
