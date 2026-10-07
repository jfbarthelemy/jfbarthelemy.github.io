#!/usr/bin/env python3
"""Recover the echoes logo scene from Asymptote's WebGL export.

The echoes logo is a 3D Asymptote scene (`img/cover.asy` in the echoes manual,
seed 1949): a translucent sphere holding 100 ellipsoids and 100 superspheres.
Asymptote's WebGL export of it, `img/cover.html`, weighs 16 MB because it ships
every Bézier control point of 27,648 patches. Yet each inclusion is fully
described by thirteen numbers:

    x(t) = c + M · g_p(u(t)),   u(t) = (sin t₁ cos t₂, sin t₁ sin t₂, cos t₁),
    g_p(u)ᵢ = sgn(uᵢ) |uᵢ|^(1/p),

with p = 1 for an ellipsoid. This script recovers c, M and p for every inclusion
and writes them, with the diffuse colors, to `images/echoes_scene.json`, which
the viewer in `_config/echoes-viewer.html` turns back into meshes.

How the fit works. `surface(f, a, b, 8, 16, Spline)` interpolates f on a 9×17
grid of parameters, so the patch corners are exact samples x(tᵢⱼ) — but the
export reorders the patches, and the same grid node is not always printed with
the same digits (at a pole, sin π ≈ 1e-16 raised to the power 1/p is noise of
order 1e-5). Nodes are therefore never merged by position. Instead, two patches
are neighbors when they share a whole edge — four control points — which gives
the patch grid: the sixteen patches with a collapsed edge ring a pole, and each
ring of patches follows from the previous one. Every corner then gets its
(t₁, t₂), c and M follow by linear least squares, and for a supersphere p is
found by a scan and a golden-section refinement of the residual. Asymptote's
view transform is affine, so it is absorbed into c and M.

The script refuses to write anything if a surface does not have that grid, or
if any corner is farther from its fitted surface than the precision the
coordinates were printed with.

numpy only:

    python3 _scripts/build_echoes_scene.py ~/echoes/echoes/img/cover.html
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "images" / "echoes_scene.json"

NUM = r"[-+0-9.eE]+"
POINT = rf"\[({NUM}),({NUM}),({NUM})\]"
PATCH_RE = re.compile(r"patch\(\[\s*((?:" + POINT + r",?\s*){16})\],(\d+),(\d+),")
MATERIAL_RE = re.compile(
    r"material\(\s*\[([^\]]*)\],\s*\[([^\]]*)\],\s*\[([^\]]*)\],\s*([^,]+),\s*([^,]+),\s*([^)]+)\)"
)
LIGHT_RE = re.compile(r"Lights=\[new Light\(\s*\[([^\]]*)\]")

# The four boundary curves of a bicubic patch (row-major 4×4 control net), in
# order: t₁ = low, t₂ = high, t₁ = high, t₂ = low — up to the orientation of
# the patch, which the grid walk below works out.
EDGES = ((0, 1, 2, 3), (3, 7, 11, 15), (12, 13, 14, 15), (0, 4, 8, 12))

# Edges. The four control points of an edge shared by two patches agree to
# 1e-4 at worst (the pole noise again), but two distinct edges can come within
# 7e-4 of each other near the tip of a supersphere: an edge is therefore matched
# with its nearest edge only when that choice is mutual. A collapsed edge — the
# side of a pole patch — is at most 2e-4 long, a real one at least 3e-2.
SAME = 1e-3
# A fitted surface may miss a corner by no more than this.
TOLERANCE = 2e-3


def parse(html: str):
    patches, owner = [], []
    for m in PATCH_RE.finditer(html):
        patches.append(np.array(re.findall(POINT, m.group(1)), float))
        owner.append(int(m.group(6)))
    materials = [tuple(float(v) for v in m.group(1).split(",")) for m in MATERIAL_RE.finditer(html)]
    light = LIGHT_RE.search(html)
    if not patches or not materials or light is None:
        sys.exit("error: no patch, material or light found — is this an Asymptote WebGL file?")
    return (
        np.array(patches),
        np.array(owner),
        materials,
        [float(v) for v in light.group(1).split(",")],
    )


def samples_of(patches: np.ndarray):
    """Every patch corner of one surface with its grid parameters (i, j).

    Returns (nu, nv, i, j, x) with one row per corner (duplicates included:
    they are independent samples of the same node, and the fit averages them).
    """
    n = len(patches)
    E = patches[:, EDGES, :]  # (n, 4 edges, 4 points, 3)
    length = np.linalg.norm(E[:, :, 0] - E[:, :, 3], axis=-1) + np.linalg.norm(
        E[:, :, 1] - E[:, :, 2], axis=-1
    )
    collapsed = length < SAME

    # Edge matching: all four control points, in either direction, mutual nearest.
    flat = E.reshape(n * 4, 4, 3)
    fwd = np.abs(flat[:, None] - flat[None, :]).max(axis=(-1, -2))
    rev = np.abs(flat[:, None] - flat[None, :, ::-1]).max(axis=(-1, -2))
    D = np.minimum(fwd, rev)
    owner = np.arange(n * 4) // 4
    D[owner[:, None] == owner[None, :]] = np.inf
    off = collapsed.reshape(-1)
    D[off, :] = np.inf
    D[:, off] = np.inf
    nearest = D.argmin(axis=1)
    # neighbor[q][e] = patch across edge e of patch q, or -1
    neighbor = -np.ones((n, 4), int)
    for a in np.nonzero(~off)[0]:
        b = nearest[a]
        if nearest[b] == a and D[a, b] < SAME:
            neighbor[a // 4, a % 4] = b // 4

    pole = collapsed.any(axis=1)
    if not ((neighbor[~pole] >= 0).all() and (neighbor[pole] >= 0).sum(axis=1).tolist() == [3] * pole.sum()):
        raise ValueError("patches do not tile a closed grid")

    # Ring 0: the patches around one pole, walked in order.
    first = int(np.nonzero(pole)[0][0])
    ring = [first]
    while True:
        nxt = [m for m in neighbor[ring[-1]] if m >= 0 and pole[m] and m not in ring]
        if not nxt:
            break
        ring.append(nxt[0])
    nv = len(ring)
    if nv < 4 or nv % 4:
        raise ValueError(f"pole ring of {nv} patches")
    rings = [ring]
    seen = set(ring)
    while len(seen) < n:
        prev = rings[-1]
        nxt = []
        for q in prev:
            out = [m for m in neighbor[q] if m >= 0 and m not in seen and m not in prev]
            if len(out) != 1:
                raise ValueError("cannot follow a meridian")
            nxt.append(out[0])
        rings.append(nxt)
        seen.update(nxt)
    nu = len(rings)
    if nu * nv != n:
        raise ValueError(f"{n} patches do not form a {nu}×{nv} grid")

    position = {q: (i, j) for i, row in enumerate(rings) for j, q in enumerate(row)}
    I, J, X = [], [], []
    for q in range(n):
        i, j = position[q]
        inward = rings[i - 1][j] if i else None
        lateral = rings[i][(j + 1) % nv]
        # The edge at t₁ = i: collapsed on the pole ring, else shared inward.
        low = int(np.nonzero(collapsed[q])[0][0]) if i == 0 else list(neighbor[q]).index(inward)
        high_t2 = list(neighbor[q]).index(lateral)
        for corner in (0, 3, 12, 15):
            I.append(i if corner in EDGES[low] else i + 1)
            J.append(j + 1 if corner in EDGES[high_t2] else j)
            X.append(patches[q, corner])
    return nu, nv, np.array(I), np.array(J), np.array(X)


def g(p: float, u: np.ndarray) -> np.ndarray:
    return np.sign(u) * np.abs(u) ** (1.0 / p)


def fit_affine(p: float, u: np.ndarray, x: np.ndarray):
    """Least-squares c, M with x ≈ c + M g_p(u); returns (c, M, max residual)."""
    A = np.hstack([np.ones((len(u), 1)), g(p, u)])
    B, *_ = np.linalg.lstsq(A, x, rcond=None)
    resid = np.linalg.norm(A @ B - x, axis=1).max()
    return B[0], B[1:].T, resid


def fit_inclusion(nu: int, nv: int, I: np.ndarray, J: np.ndarray, x: np.ndarray):
    best = None
    t1 = I * math.pi / nu
    # Rotations by a multiple of π/2 about the polar axis are symmetries of g_p,
    # so only the first nv/4 offsets of the meridian origin are distinct.
    for k in range(nv // 4):
        t2 = (J + k) * 2 * math.pi / nv
        u = np.column_stack([np.sin(t1) * np.cos(t2), np.sin(t1) * np.sin(t2), np.cos(t1)])

        def cost(logp: float) -> float:
            return fit_affine(math.exp(logp), u, x)[2]

        scan = np.linspace(math.log(0.25), math.log(4.0), 61)
        m = int(np.argmin([cost(s) for s in scan]))
        lo, hi = scan[max(m - 1, 0)], scan[min(m + 1, len(scan) - 1)]
        phi = (math.sqrt(5) - 1) / 2
        a, b = hi - phi * (hi - lo), lo + phi * (hi - lo)
        for _ in range(60):
            if cost(a) < cost(b):
                hi, b = b, a
                a = hi - phi * (hi - lo)
            else:
                lo, a = a, b
                b = lo + phi * (hi - lo)
        p = math.exp((lo + hi) / 2)
        # An ellipsoid is a supersphere with p = 1: snap when that is as good.
        if fit_affine(1.0, u, x)[2] < TOLERANCE:
            p = 1.0
        c, M, resid = fit_affine(p, u, x)
        if best is None or resid < best[3]:
            best = (c, M, p, resid)
    return best


def fit_sphere(patches: np.ndarray):
    """Algebraic fit |x|² = 2 c·x + (R² − |c|²) on the patch corners."""
    x = patches[:, (0, 3, 12, 15), :].reshape(-1, 3)
    A = np.hstack([2 * x, np.ones((len(x), 1))])
    sol, *_ = np.linalg.lstsq(A, (x**2).sum(axis=1), rcond=None)
    c = sol[:3]
    R = math.sqrt(sol[3] + c @ c)
    resid = np.abs(np.linalg.norm(x - c, axis=1) - R).max()
    return c, R, resid


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("cover", type=Path, help="Asymptote WebGL export (echoes img/cover.html)")
    ap.add_argument("-o", "--output", type=Path, default=OUT)
    args = ap.parse_args()

    patches, owner, materials, light = parse(args.cover.read_text())

    # Surface 0 is the container sphere: it sets the origin and the unit length.
    c0, R0, worst = fit_sphere(patches[owner == 0])
    if worst > TOLERANCE:
        sys.exit(f"error: the container is not a sphere (residual {worst:.2e})")

    inclusions = []
    for s in range(1, owner.max() + 1):
        try:
            nu, nv, I, J, x = samples_of(patches[owner == s])
        except ValueError as err:
            sys.exit(f"error: surface {s}: {err}")
        c, M, p, resid = fit_inclusion(nu, nv, I, J, x)
        if resid > TOLERANCE:
            sys.exit(f"error: surface {s} fits to {resid:.2e} only (tolerance {TOLERANCE:.0e})")
        worst = max(worst, resid)
        cn, Mn = (c - c0) / R0, M / R0
        inclusions.append(
            [round(v, 4) for v in cn]
            + [round(v, 4) for v in Mn.ravel()]
            + [round(p, 4)]
            + [round(v, 3) for v in materials[s][:3]]
        )

    scene = {
        "source": "echoes manual, img/cover.asy (Asymptote, seed 1949), recovered from img/cover.html "
        "by _scripts/build_echoes_scene.py",
        "layout": "each inclusion: center[3], M[3x3 row-major], p, rgb[3]; x = center + M g_p(u), "
        "container = unit sphere at the origin, view coordinates (y up, z toward the viewer)",
        "light": [round(v, 4) for v in light],
        "material": {"specular": 0.75, "shininess": 0.7, "metallic": 0.0, "fresnel0": 0.04},
        "sphere_opacity": materials[0][3],
        "inclusions": inclusions,
    }
    args.output.write_text(json.dumps(scene, separators=(",", ":")) + "\n")
    n_super = sum(1 for inc in inclusions if inc[12] != 1.0)
    print(
        f"{len(inclusions)} inclusions ({len(inclusions) - n_super} ellipsoids, {n_super} superspheres), "
        f"worst corner residual {worst:.1e} for a container of radius {R0:.2f} -> "
        f"{args.output} ({args.output.stat().st_size / 1024:.1f} kB)"
    )


if __name__ == "__main__":
    main()
