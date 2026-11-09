"""Turn the environment art in art/source/ into game-ready files in assets/env/.

 * dirt_tile.webp  -> dirt.jpg          (seamless fill texture, 512x512)
 * grass_strip.png -> grass_strip.png   (seamless strip, white removed, resized)
 * background.png  -> background.jpg    (seamless parallax backdrop)
 * ramp.png        -> ramp.png + src/rampProfile.js (the plank's top curve)
 * decorations.png -> tuft/mushroom/rocks/flower/bush.png
 * props.png       -> fence/tree/tires/finish_gate.png

The white-background sheets get a real alpha channel: white connected to the
image border becomes transparent, and the anti-aliased edge pixels next to it
are turned into a soft dark outline (no white fringe).

Run from the repo root:  python tools/slice_env.py
Needs: pip install pillow numpy scipy
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "assets" / "env"

GRASS_HEIGHT = 112  # strip height in game px (the art is resized so the game uses it 1:1)

DECOR = {  # name: crop box (x0, y0, x1, y1) in decorations.png
    "tuft": (85, 80, 562, 331),
    "mushroom": (690, 94, 928, 340),
    "rocks": (318, 390, 706, 633),
    "flower": (143, 660, 352, 954),
    "bush": (532, 672, 962, 959),
}
PROPS = {  # in props.png
    "fence": (37, 30, 562, 229),
    "tree": (24, 239, 331, 559),
    "tires": (374, 277, 664, 557),
    "finish_gate": (682, 24, 1001, 562),
}


def cut_white(rgb, hole_min=2500):
    """RGB uint8 array on white -> RGBA with the outside white made transparent."""
    rgb = rgb.astype(np.int16)
    whitish = rgb.min(axis=2) > 222
    lab, n = ndimage.label(whitish)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    # big white areas fully enclosed by outlines (gaps in a fence, under a banner)
    # are background too; small ones (mushroom spots, flag squares) are art
    if n:
        sizes = ndimage.sum(whitish, lab, range(1, n + 1))
        bg |= np.isin(lab, np.where(sizes > hole_min)[0] + 1)
    fg = ~bg
    out = np.zeros((*rgb.shape[:2], 4), dtype=np.uint8)
    out[..., :3] = rgb
    out[..., 3] = fg * 255
    # edge ring: pixels of the foreground touching the background are blends of
    # outline-black and white; turn their lightness into transparency instead
    ring = fg & ndimage.binary_dilation(bg, iterations=2)
    light = rgb.min(axis=2).astype(np.float32)
    a = np.clip((255 - light) / 200.0, 0, 1)
    out[ring, 3] = (a[ring] * 255).astype(np.uint8)
    out[ring, :3] = (22, 22, 24)
    return out


def trim(rgba, pad=2):
    ys, xs = np.where(rgba[..., 3] > 8)
    return rgba[max(ys.min() - pad, 0) : ys.max() + pad + 1, max(xs.min() - pad, 0) : xs.max() + pad + 1]


def load(name):
    return np.array(Image.open(SRC / name).convert("RGB"))


def save(arr, name):
    Image.fromarray(arr).save(OUT / name)
    print(f"{name}: {arr.shape[1]}x{arr.shape[0]}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # dirt: already seamless, just shrink it
    Image.open(SRC / "dirt_tile.webp").convert("RGB").resize((512, 512), Image.LANCZOS).save(
        OUT / "dirt.jpg", quality=90
    )
    print("dirt.jpg: 512x512")

    # background: already seamless left-right
    Image.open(SRC / "background.png").convert("RGB").save(OUT / "background.jpg", quality=90)
    print("background.jpg")

    # grass strip: keep the full width so it still tiles, crop the rows, resize
    g = load("grass_strip.png")
    rows = np.where((g.min(axis=2) < 225).any(axis=1))[0]
    y0, y1 = rows.min() - 2, rows.max() + 1
    strip = cut_white(g[y0:y1])
    # columns on the far left/right edges are part of the strip, not background
    strip[..., 3] = np.maximum(strip[..., 3], 0)
    h = y1 - y0
    w = round(1024 * GRASS_HEIGHT / h)
    img = Image.fromarray(strip).resize((w, GRASS_HEIGHT), Image.LANCZOS)
    img.save(OUT / "grass_strip.png")
    # the row where the grass body starts (wheels drive on this line)
    tops = []
    for c in range(g.shape[1]):
        col = np.where(g[y0:y1, c].min(axis=1) < 225)[0]
        if len(col):
            tops.append(col.min())
    contact = float(np.percentile(tops, 80)) / h
    print(f"grass_strip.png: {w}x{GRASS_HEIGHT}, contact line at {contact:.3f} of height")

    # ramp
    r = trim(cut_white(load("ramp.png"), hole_min=60), pad=0)  # the ramp has no white details
    Image.fromarray(r).save(OUT / "ramp.png")
    alpha = r[..., 3] > 128
    H, W = alpha.shape
    tops = np.array([np.where(alpha[:, x])[0].min() if alpha[:, x].any() else H for x in range(W)])
    lip = int(np.argmin(tops[: int(W * 0.95)]))
    lip_h = H - tops[lip]
    samples = 48
    profile = [round(float(H - tops[int(i * lip / samples)]) / lip_h, 4) for i in range(samples + 1)]
    profile[-1] = 1.0
    back = int(np.where(alpha[H - 4])[0].max())  # where the steel frame meets the ground
    meta = {
        "width": W,
        "height": H,
        "lipX": lip,
        "lipHeight": int(lip_h),
        "backX": back,
        "profile": profile,
    }
    (ROOT / "src" / "rampProfile.js").write_text(
        "// Generated by tools/slice_env.py from art/source/ramp.png. Do not edit by hand.\n"
        "// profile[i] = plank height (0..1 of the lip height) at i/(n-1) of the way to the lip.\n"
        f"export const RAMP_ART = {json.dumps(meta)};\n"
    )
    print(f"ramp.png: {W}x{H}, lip at x={lip} (height {lip_h}), back at x={back}")

    for sheet, boxes in (("decorations.png", DECOR), ("props.png", PROPS)):
        src = load(sheet)
        for name, (x0, y0, x1, y1) in boxes.items():
            save(trim(cut_white(src[y0:y1, x0:x1])), f"{name}.png")


if __name__ == "__main__":
    main()
