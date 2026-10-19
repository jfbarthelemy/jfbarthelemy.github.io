"""Generate the charcoal textures of the site theme into images/charcoal/.

Every texture is drawn from seeded noise, so a run is reproducible. The tiled
ones (the paper, the rail) are built in Fourier space, which makes them
periodic: they repeat without a seam. The others are masks, alpha only: the
stylesheet paints them with a theme color (`mask-image` + `background-color`),
so one file serves both the light and the dark theme.

    python3 _scripts/build_charcoal_textures.py

Needs numpy and Pillow.
"""
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "images" / "charcoal"
RNG = np.random.default_rng(20261019)


def periodic_noise(h, w, sx, sy=None, angle=0.0):
    """Gaussian-filtered white noise, periodic on (h, w), unit variance.

    sx, sy are the correlation lengths in pixels along and across `angle`
    (radians): a long sx and a short sy give streaks."""
    sy = sx if sy is None else sy
    n = RNG.standard_normal((h, w))
    ky = np.fft.fftfreq(h)[:, None]
    kx = np.fft.fftfreq(w)[None, :]
    ku = kx * np.cos(angle) + ky * np.sin(angle)
    kv = -kx * np.sin(angle) + ky * np.cos(angle)
    g = np.exp(-2.0 * np.pi ** 2 * ((sx * ku) ** 2 + (sy * kv) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(n) * g))
    return (out - out.mean()) / out.std()


def periodic_blur(a, sigma):
    """Gaussian blur of a periodic image, done in Fourier space so that it
    stays periodic (and a band's ends stay what they were, near enough)."""
    h, w = a.shape
    ky = np.fft.fftfreq(h)[:, None]
    kx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2.0 * np.pi ** 2 * sigma ** 2 * (kx ** 2 + ky ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def stumped(a, sigma=3.0, contrast=0.75):
    """The same marks gone over with the stump: blurred, and flatter."""
    b = periodic_blur(a, sigma)
    return b.mean() + contrast * (b - b.mean())


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def save_rgba(path, rgb, alpha):
    """Written as lossless WebP: a third lighter than PNG on these noises."""
    a = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    img = np.dstack([np.broadcast_to(np.asarray(rgb, np.uint8), a.shape + (3,)), a])
    Image.fromarray(img, "RGBA").save(path, "WEBP", lossless=True, method=6)


def save_alpha(path, alpha):
    """A mask: white, the shape in the alpha channel."""
    save_rgba(path, (255, 255, 255), alpha)


def paper(path, dark_specks, light_specks, mottle):
    """Drawing paper seen up close: the tooth (fine grain), a few fibers and a
    faint mottle; dark and light specks over the theme's background color."""
    s = 512
    t = (periodic_noise(s, s, 0.7) + 0.55 * periodic_noise(s, s, 1.8)
         + 0.35 * periodic_noise(s, s, 14.0, 0.9, 0.5) + 0.35 * periodic_noise(s, s, 14.0, 0.9, 2.1))
    t = (t - t.mean()) / t.std()
    m = mottle * periodic_noise(s, s, 40.0)
    dark = dark_specks * smoothstep(0.6, 2.6, t + m)
    light = light_specks * smoothstep(0.6, 2.6, -t - m)
    # one RGBA image: black specks where the tooth stands up, white elsewhere
    rgb = np.where((dark >= light)[..., None], 0, 255).astype(np.uint8)
    save_rgba(path, rgb, np.maximum(dark, light))


# The four large masks below are soft at the scale they are shown, and the
# paper gives the tooth: they are drawn at half the size they are displayed at,
# without grain of their own, which keeps them light to download.

def rub_band(path):
    """Charcoal rubbed across a band with the side of the stick: streaks along
    one direction, uneven pressure, heavier toward the right and the bottom."""
    h, w = 180, 800
    streak = periodic_noise(h, w, 30.0, 0.8, -0.22)
    pressure = periodic_noise(h, w, 60.0)
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    base = 0.25 + 0.75 * smoothstep(-0.1, 1.0, x)
    a = base * (0.35 + 0.65 * smoothstep(-1.6, 1.8, 0.6 * streak + 0.8 * pressure))
    a *= 0.55 + 0.45 * smoothstep(0.0, 1.0, y)
    save_alpha(path, np.clip(a, 0, 1))
    # the light theme's version, softened with the stump
    save_alpha(path.with_name(path.stem + "-soft" + path.suffix), np.clip(stumped(a), 0, 1))


def rub_tile(path):
    """The same rubbing without its gradients, so that it tiles: the texture
    of the dark edges of the view."""
    h, w = 256, 512
    streak = periodic_noise(h, w, 30.0, 0.8, -0.22)
    pressure = periodic_noise(h, w, 60.0)
    a = 0.35 + 0.65 * smoothstep(-1.6, 1.8, 0.6 * streak + 0.8 * pressure)
    save_alpha(path, np.clip(a, 0, 1))
    # the light theme's version, softened with the stump
    save_alpha(path.with_name(path.stem + "-soft" + path.suffix), np.clip(stumped(a), 0, 1))


def smudges(path):
    """Two stump-blended smudges, where the hero had its two soft washes."""
    h, w = 350, 700
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    warp_x = 20 * periodic_noise(h, w, 45.0)
    warp_y = 20 * periodic_noise(h, w, 45.0)
    a = np.zeros((h, w))
    for cx, cy, rx, ry, wt in ((0.16, 0.30, 0.30, 0.42, 1.0), (0.80, 0.16, 0.26, 0.34, 0.8)):
        r = np.sqrt(((xx + warp_x - cx * w) / (rx * w)) ** 2 + ((yy + warp_y - cy * h) / (ry * h)) ** 2)
        a = np.maximum(a, wt * smoothstep(1.0, 0.15, r))
    # nothing reaches the sides of the box, where it would be cut straight
    a *= smoothstep(0.0, 0.1, xx / w) * smoothstep(1.0, 0.9, xx / w)
    streak = periodic_noise(h, w, 25.0, 0.9, -0.3)
    a *= 0.68 + 0.32 * smoothstep(-1.8, 1.6, 0.7 * streak)
    save_alpha(path, np.clip(a, 0, 1))
    # the light theme's version, softened with the stump
    save_alpha(path.with_name(path.stem + "-soft" + path.suffix), np.clip(stumped(a), 0, 1))


def stroke_h(path):
    """One long charcoal line drawn freehand: a slight wave, a second fainter
    pass, pressure that varies, tapered ends, the paper's tooth showing through."""
    h, w = 28, 1600
    x = np.arange(w)[None, :]
    y = np.arange(h)[:, None].astype(float)
    wave = 1.3 * np.sin(2 * np.pi * x / w * 1.3 + 0.4) + 0.6 * np.sin(2 * np.pi * x / w * 4.1)
    tooth = periodic_noise(h, w, 0.7)
    a = np.zeros((h, w))
    for off, width, wt in ((0.0, 2.0, 1.0), (2.4, 1.3, 0.45)):
        c = h / 2 + off + wave
        a = np.maximum(a, wt * np.exp(-((y - c) / width) ** 2))
    press = 0.75 + 0.25 * periodic_noise(1, w, 80.0)[0][None, :]
    ends = smoothstep(0.0, 0.05, x / w) * smoothstep(1.0, 0.95, x / w)
    a *= press * ends * (0.55 + 0.45 * smoothstep(-2.6, -0.2, tooth))
    save_alpha(path, np.clip(a * 1.2, 0, 1))


def stroke_v(path):
    """The publications rail: a vertical charcoal line that tiles vertically."""
    h, w = 1200, 16
    y = np.arange(h)[:, None]
    x = np.arange(w)[None, :].astype(float)
    wave = 0.9 * np.sin(2 * np.pi * y / h * 3) + 0.4 * np.sin(2 * np.pi * y / h * 11)
    tooth = periodic_noise(h, w, 0.7)
    a = np.exp(-((x - w / 2 - wave) / 1.7) ** 2)
    press = 0.7 + 0.3 * periodic_noise(h, 1, 60.0)
    a *= press * (0.55 + 0.45 * smoothstep(-2.6, -0.2, tooth))
    save_alpha(path, np.clip(a * 1.15, 0, 1))


def dot(path):
    """A charcoal dot, pressed and turned: not quite round, grainy at its rim."""
    s = 48
    yy, xx = np.mgrid[0:s, 0:s].astype(float) - (s - 1) / 2
    ang = np.arctan2(yy, xx)
    r = np.hypot(xx, yy) / (s * 0.36 * (1 + 0.08 * np.sin(3 * ang + 0.7) + 0.05 * np.sin(5 * ang)))
    tooth = periodic_noise(s, s, 0.7)
    a = smoothstep(1.0, 0.72, r) * (0.7 + 0.3 * smoothstep(-2.4, 0.0, tooth - 3.0 * (r - 0.75).clip(0)))
    save_alpha(path, np.clip(a, 0, 1))


def smoke(path):
    """Drifting smoke, tiled over the whole page: soft clouds of charcoal dust
    with a little streak in them, periodic so the tiles never show."""
    s = 384
    clouds = periodic_noise(s, s, 35.0) + 0.6 * periodic_noise(s, s, 14.0)
    wisps = periodic_noise(s, s, 20.0, 1.5, -0.35)
    a = smoothstep(-0.2, 2.0, clouds + 0.45 * wisps)
    save_alpha(path, np.clip(a, 0, 1))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    paper(OUT / "paper-light.webp", dark_specks=0.055, light_specks=0.28, mottle=0.3)
    paper(OUT / "paper-dark.webp", dark_specks=0.30, light_specks=0.06, mottle=0.45)
    rub_band(OUT / "rub-band.webp")
    rub_tile(OUT / "rub-tile.webp")
    smudges(OUT / "smudges.webp")
    stroke_h(OUT / "stroke-h.webp")
    stroke_v(OUT / "stroke-v.webp")
    dot(OUT / "dot.webp")
    smoke(OUT / "smoke.webp")
    for p in sorted(OUT.iterdir()):
        print(f"{p.name:16s} {p.stat().st_size / 1024:7.1f} KiB")


if __name__ == "__main__":
    main()
