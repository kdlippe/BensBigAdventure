"""Cut individual sprites out of art/source/truck_sheet.jpg.

The sheet has a painted-in dark checkerboard instead of real transparency,
so we rebuild an alpha mask for each piece:
  * colourful / bright pixels are kept,
  * enclosed holes (windows, wheel wells) are filled in,
  * a ring of `outline` px around that is kept and painted solid black,
    which recreates the thick cartoon outline cleanly.
The wheel is masked with a perfect circle instead.

Run from the repo root:  python tools/slice_sprites.py
Needs: pip install pillow numpy scipy
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source" / "truck_sheet.jpg"
OUT = ROOT / "assets" / "sprites"

# name: (x0, y0, x1, y1, outline_px)
PIECES = {
    "truck_body": (130, 130, 1465, 655, 7),
    "strut": (925, 855, 1065, 1345, 6),
    "puff": (1300, 955, 1440, 1070, 6),
    "puff2": (1455, 955, 1580, 1070, 6),
    "pebble": (1695, 975, 1775, 1045, 4),
    "dust": (1285, 1160, 1600, 1395, 6),
    "sparkle": (1700, 1175, 1910, 1375, 3),
}
WHEEL = (90, 810, 705, 1405)


def is_foreground(rgb):
    v = rgb.max(axis=2)
    s = v - rgb.min(axis=2)
    return (v > 62) | (s > 28)


def cut(rgb, outline):
    fg = is_foreground(rgb)
    fg = ndimage.binary_opening(fg, iterations=1)
    # keep only sizeable blobs (drops JPEG speckle and stray label bits)
    lab, n = ndimage.label(fg)
    if n:
        sizes = ndimage.sum(fg, lab, range(1, n + 1))
        keep = np.isin(lab, np.where(sizes >= max(60, sizes.max() * 0.01))[0] + 1)
    else:
        keep = fg
    filled = ndimage.binary_fill_holes(ndimage.binary_closing(keep, iterations=3))
    full = ndimage.binary_dilation(filled, iterations=outline)
    ring = full & ~filled
    out = np.zeros((*rgb.shape[:2], 4), dtype=np.uint8)
    out[..., :3] = rgb
    out[ring, :3] = (14, 14, 18)
    # soften the very outer edge a little
    alpha = full.astype(np.float32)
    alpha = ndimage.gaussian_filter(alpha, 0.7)
    alpha[filled] = 1.0
    out[..., 3] = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    return out


def trim(rgba, pad=2):
    ys, xs = np.where(rgba[..., 3] > 8)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, rgba.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, rgba.shape[1])
    return rgba[y0:y1, x0:x1]


def cut_wheel(rgb):
    fg = is_foreground(rgb)
    # the tyre is dark, so find it from everything that is not checkerboard-flat
    v = rgb.max(axis=2).astype(np.float32)
    tex = ndimage.generic_filter(v, np.std, size=5) > 4
    blob = ndimage.binary_fill_holes(ndimage.binary_closing(fg | tex, iterations=4))
    lab, n = ndimage.label(blob)
    sizes = ndimage.sum(blob, lab, range(1, n + 1))
    blob = lab == (np.argmax(sizes) + 1)
    ys, xs = np.where(blob)
    cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
    r = min(ys.max() - ys.min(), xs.max() - xs.min()) / 2 - 2
    yy, xx = np.mgrid[: rgb.shape[0], : rgb.shape[1]]
    d = np.hypot(yy - cy, xx - cx)
    out = np.zeros((*rgb.shape[:2], 4), dtype=np.uint8)
    out[..., :3] = rgb
    out[(d > r - 6) & (d <= r), :3] = (14, 14, 18)
    out[..., 3] = (np.clip(r + 0.5 - d, 0, 1) * 255).astype(np.uint8)
    return trim(out, 1)


def main():
    sheet = np.array(Image.open(SRC).convert("RGB")).astype(np.int16)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (x0, y0, x1, y1, outline) in PIECES.items():
        rgba = trim(cut(sheet[y0:y1, x0:x1], outline))
        Image.fromarray(rgba).save(OUT / f"{name}.png")
        print(f"{name}: {rgba.shape[1]}x{rgba.shape[0]}")
    x0, y0, x1, y1 = WHEEL
    rgba = cut_wheel(sheet[y0:y1, x0:x1])
    Image.fromarray(rgba).save(OUT / "wheel.png")
    print(f"wheel: {rgba.shape[1]}x{rgba.shape[0]}")


if __name__ == "__main__":
    main()
