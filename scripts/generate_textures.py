"""Generate 8 procedural texture PNGs (pure stdlib, zero external deps) for 4d8 Worlds.

New 1-8 checkerboard order:
  1: Prismatic (Dark Violet Iridescent)
  2: Sepia     (Light Aged Parchment)
  3: Neon      (Dark Electric Magenta/Cyan Glow)
  4: Pastel    (Light Mint-Sage Cotton Paper)
  5: Bright    (Light Sunlit Ivory & Gold)
  6: Dark      (Deep Midnight Indigo Vignette)
  7: Chrome    (Brushed Metallic Cobalt-Blue Steel)
  8: Rust      (Pitted Oxidized Iron-Red)
"""

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
W, H = 360, 240


def clamp(v, lo=0.0, hi=255.0):
    if v < lo:
        return lo
    if v > hi:
        return hi
    return v


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(edge0, edge1, x):
    t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def hash2(ix, iy, seed=0):
    n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def value_noise(x, y, seed=0):
    ix = math.floor(x)
    iy = math.floor(y)
    fx = x - ix
    fy = y - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    a = hash2(ix, iy, seed)
    b = hash2(ix + 1, iy, seed)
    c = hash2(ix, iy + 1, seed)
    d = hash2(ix + 1, iy + 1, seed)
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy)


def fbm(x, y, octaves=4, seed=0):
    val = 0.0
    amp = 0.5
    freq = 1.0
    norm = 0.0
    for o in range(octaves):
        val += amp * value_noise(x * freq, y * freq, seed + o * 17)
        norm += amp
        amp *= 0.5
        freq *= 2.03
    return val / norm


def write_png(path, width, height, rgb_bytes):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        start = y * stride
        raw.extend(rgb_bytes[start : start + stride])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 6)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def render_texture(name, fn):
    buf = bytearray(W * H * 3)
    idx = 0
    for y in range(H):
        v = y / (H - 1)
        for x in range(W):
            u = x / (W - 1)
            r, g, b = fn(u, v, x, y)
            buf[idx] = int(clamp(r))
            buf[idx + 1] = int(clamp(g))
            buf[idx + 2] = int(clamp(b))
            idx += 3
    path = os.path.join(OUT_DIR, name)
    write_png(path, W, H, buf)
    print(f"Wrote {name} ({W}x{H})")


# 1 · Prismatic — deep obsidian-indigo + smooth diagonal iridescent prism spectrum
def tex_prismatic(u, v, x, y):
    r, g, b = lerp(24, 16, v), lerp(16, 12, v), lerp(40, 28, v)
    d = u * 0.72 + v * 0.52  # diagonal axis ~0..1.24
    # Smooth Gaussian spectral bands: violet -> cyan -> magenta -> gold
    w_v = math.exp(-((d - 0.34) / 0.16) ** 2)
    w_c = math.exp(-((d - 0.54) / 0.14) ** 2)
    w_m = math.exp(-((d - 0.74) / 0.16) ** 2)
    w_g = math.exp(-((d - 0.94) / 0.14) ** 2)
    r += w_v * 92 + w_c * 8 + w_m * 145 + w_g * 95
    g += w_v * 22 + w_c * 112 + w_m * 16 + w_g * 68
    b += w_v * 155 + w_c * 135 + w_m * 82 + w_g * 12
    grain = (hash2(x, y, 11) - 0.5) * 9.0
    return r + grain, g + grain, b + grain


# 2 · Sepia — warm aged parchment with subtle paper mottling & antique edge
def tex_sepia(u, v, x, y):
    t = u * 0.45 + v * 0.55
    r = lerp(236, 206, t)
    g = lerp(222, 180, t)
    b = lerp(194, 138, t)
    mottle = (fbm(u * 5.0, v * 5.0, 4, seed=21) - 0.5) * 26.0
    tooth = (hash2(x, y, 29) - 0.5) * 14.0
    # Warm darkened parchment edge
    ex = abs(u - 0.5) * 2.0
    ey = abs(v - 0.5) * 2.0
    vig = smoothstep(0.58, 1.15, math.hypot(ex, ey)) * 28.0
    return r + mottle + tooth - vig, g + mottle * 0.85 + tooth - vig * 1.15, b + mottle * 0.65 + tooth - vig * 1.35


# 3 · Neon — wet dark midnight + electric hot-magenta & cyan radial blooms
def tex_neon(u, v, x, y):
    r, g, b = 15.0, 9.0, 22.0
    d1 = math.hypot((u - 0.20) * 1.2, (v - 0.20) * 1.35)
    d2 = math.hypot((u - 0.86) * 1.25, (v - 0.82) * 1.3)
    glow_m = math.exp(-(d1 / 0.52) ** 2)
    glow_c = math.exp(-(d2 / 0.48) ** 2)
    r += glow_m * 175 + glow_c * 12
    g += glow_m * 18 + glow_c * 138
    b += glow_m * 98 + glow_c * 168
    scan = 5.0 if (y % 3 == 0) else 0.0
    grain = (hash2(x, y, 31) - 0.5) * 6.0
    return r + scan + grain, g + scan + grain, b + scan + grain


# 4 · Pastel — unmistakably soft mint-sage green cotton paper
def tex_pastel(u, v, x, y):
    t = u * 0.5 + v * 0.5
    r = lerp(208, 224, t)
    g = lerp(238, 240, t)
    b = lerp(224, 232, t)
    # Gentle soft mint bloom top-left, soft warm cream-blush bottom-right
    d1 = math.hypot(u - 0.22, v - 0.22)
    d2 = math.hypot(u - 0.84, v - 0.80)
    mint = math.exp(-(d1 / 0.55) ** 2)
    blush = math.exp(-(d2 / 0.52) ** 2)
    r += -mint * 18 + blush * 14
    g += mint * 8 - blush * 6
    b += mint * 2 + blush * 4
    tooth = (fbm(u * 14.0, v * 14.0, 3, seed=41) - 0.5) * 12.0 + (hash2(x, y, 43) - 0.5) * 7.0
    return r + tooth, g + tooth, b + tooth


# 5 · Bright — crisp sun-drenched ivory stock with clean golden sunbeam cut
def tex_bright(u, v, x, y):
    r = lerp(255, 249, v)
    g = lerp(252, 241, v)
    b = lerp(242, 222, v)
    d = u * 0.78 + v * 0.34
    sun = 1.0 - smoothstep(0.32, 0.35, d)
    rim = math.exp(-((d - 0.37) / 0.025) ** 2)
    r = lerp(r, 250, sun * 0.85) + rim * 4
    g = lerp(g, 222, sun * 0.85) + rim * 2
    b = lerp(b, 146, sun * 0.85)
    grain = (hash2(x, y, 53) - 0.5) * 4.0
    return r + grain, g + grain, b + grain


# 6 · Dark — clean deep midnight indigo-slate vignette (zero brown!)
def tex_dark(u, v, x, y):
    ex = (u - 0.48) * 1.7
    ey = (v - 0.42) * 1.7
    vig = smoothstep(0.15, 1.35, math.hypot(ex, ey))
    r = lerp(28, 10, vig)
    g = lerp(34, 12, vig)
    b = lerp(56, 20, vig)
    grain = (hash2(x, y, 61) - 0.5) * 8.0
    return r + grain, g + grain, b + grain


# 7 · Chrome — brushed metallic cobalt-blue steel with luminous specular sheen
def tex_chrome(u, v, x, y):
    r = lerp(26, 16, v)
    g = lerp(56, 36, v)
    b = lerp(92, 62, v)
    d = u * 0.75 + v * 0.38
    band1 = math.exp(-((d - 0.44) / 0.075) ** 2)
    band2 = math.exp(-((d - 0.58) / 0.030) ** 2)
    sheen = band1 * 0.65 + band2 * 0.95
    r += sheen * 96
    g += sheen * 124
    b += sheen * 145
    # Fine horizontal brushed-metal lines
    brush = (hash2(0, y, 71) - 0.5) * 11.0 + (hash2(x, y, 73) - 0.5) * 4.0
    return r + brush, g + brush, b + brush


# 8 · Rust — rich pitted oxidized iron-red (multi-octave mineral corrosion, zero triangles)
def tex_rust(u, v, x, y):
    t = u * 0.45 + v * 0.55
    r = lerp(108, 44, t)
    g = lerp(46, 20, t)
    b = lerp(20, 10, t)
    n_macro = fbm(u * 4.5, v * 4.5, 4, seed=81)
    n_micro = fbm(u * 18.0, v * 18.0, 3, seed=89)
    # Oxidized orange-rust blooms + dark iron pits
    rust_patch = smoothstep(0.46, 0.76, n_macro)
    iron_pit = smoothstep(0.52, 0.24, n_macro)
    r += rust_patch * 56 - iron_pit * 28
    g += rust_patch * 22 - iron_pit * 14
    b += rust_patch * 6 - iron_pit * 7
    grit = (n_micro - 0.5) * 34.0 + (hash2(x, y, 97) - 0.5) * 18.0
    # Weathered dark edge
    ex = abs(u - 0.5) * 2.0
    ey = abs(v - 0.5) * 2.0
    vig = smoothstep(0.55, 1.15, math.hypot(ex, ey)) * 28.0
    return r + grit - vig, g + grit * 0.65 - vig * 0.85, b + grit * 0.45 - vig * 0.7


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    render_texture("p1_prismatic.png", tex_prismatic)
    render_texture("p2_sepia.png", tex_sepia)
    render_texture("p3_neon.png", tex_neon)
    render_texture("p4_pastel.png", tex_pastel)
    render_texture("p5_bright.png", tex_bright)
    render_texture("p6_dark.png", tex_dark)
    render_texture("p7_chrome.png", tex_chrome)
    render_texture("p8_rust.png", tex_rust)


if __name__ == "__main__":
    main()
