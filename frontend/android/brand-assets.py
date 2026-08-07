"""从现有鹰羽勾形矢量路径（ic_launcher_foreground.xml）栅格化 Android 品牌 PNG。

仅使用环境已有图像能力（Pillow），不安装或下载任何工具。
品牌色：莓果 #B33B5A、信任翡翠 #26756F、白灰背景 #F7F7FA。
"""
import math
import os
import re
from PIL import Image, ImageDraw

BRAND = "#B33B5A"
TRUST = "#26756F"
WHITE = "#FFFFFF"
CANVAS = "#F7F7FA"

FEATHER = "M26,83V28h14c22,0 37,12 42,33c-8,-5 -16,-7 -25,-5c6,4 10,9 12,15c-15,-2 -27,3 -35,12H26Z"
ARC = "M42,78c2,-21 12,-35 31,-43"
CHECK = "M38,74l10,10l28,-33"

TOKEN = re.compile(r"[MmLlHhVvCcZz]|-?\d+(?:\.\d+)?|\.\d+|-\.\d+")

def tokenize(path):
    parts = TOKEN.findall(path)
    if not parts:
        return []
    commands, current = [], None
    for part in parts:
        if part in "MmLlHhVvCcZz":
            current = part
            commands.append([part])
        elif current:
            commands[-1].append(float(part))
    return commands

def flatten(path, samples=48):
    """将 SVG 路径拍平为折线点列表（支持本品牌路径用到的 M/V/H/L/C 与相对形式）。"""
    points = []
    x = y = 0.0
    start = None
    for cmd in tokenize(path):
        op = cmd[0]
        args = cmd[1:]
        if op in ("M", "m"):
            dx, dy = (args[0], args[1]) if op == "M" else (args[0], args[1])
            if op == "m":
                x, y = x + dx, y + dy
            else:
                x, y = dx, dy
            start = (x, y)
            points.append((x, y))
        elif op in ("L", "l"):
            nx = args[0] if op == "L" else x + args[0]
            ny = args[1] if op == "L" else y + args[1]
            x, y = nx, ny
            points.append((x, y))
        elif op in ("H", "h"):
            x = args[0] if op == "H" else x + args[0]
            points.append((x, y))
        elif op in ("V", "v"):
            y = args[0] if op == "V" else y + args[0]
            points.append((x, y))
        elif op in ("C", "c"):
            c1x, c1y, c2x, c2y, ex, ey = args
            if op == "c":
                c1x, c1y = x + c1x, y + c1y
                c2x, c2y = x + c2x, y + c2y
                ex, ey = x + ex, y + ey
            p0 = (x, y)
            p1, p2, p3 = (c1x, c1y), (c2x, c2y), (ex, ey)
            for i in range(1, samples + 1):
                t = i / samples
                mt = 1 - t
                px = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
                py = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
                points.append((px, py))
            x, y = ex, ey
        elif op == "Z":
            points.append(start)
    return points

FEATHER_POINTS = flatten(FEATHER)
ARC_POINTS = flatten(ARC)
CHECK_POINTS = flatten(CHECK)

def bbox(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)

def stroke_polyline(draw, points, width, color, canvas_size, scale):
    """按品牌 strokeWidth=7（108 viewBox 内）绘制折线，圆头端点。"""
    w = max(1, round(width / 108 * canvas_size * scale))
    draw.line([(p[0] * scale, p[1] * scale) for p in points], fill=color, width=w, joint="curve")
    r = w / 2
    for p in (points[0], points[-1]):
        cx, cy = p[0] * scale, p[1] * scale
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

def render_mark(size, scale, offset):
    """在透明画布上绘制品牌标记（鹰羽勾形），返回 RGBA 图像。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    feather = [(x * scale + offset[0], y * scale + offset[1]) for x, y in FEATHER_POINTS]
    draw.polygon(feather, fill=BRAND)
    stroke_polyline(draw, ARC_POINTS, 7, TRUST, size, scale)
    stroke_polyline(draw, CHECK_POINTS, 7, WHITE, size, scale)
    return img

def centered_mark(size, content_fraction):
    """content_fraction：标记宽度（57 viewBox 单位）占画布的比例。"""
    scale = size * content_fraction / 57
    fx = bbox(FEATHER_POINTS)
    cx = (fx[0] + fx[2]) / 2
    cy = (fx[1] + fx[3]) / 2
    offset = (size / 2 - cx * scale, size / 2 - cy * scale)
    return render_mark(size, scale, offset)

def launcher_icon(path, size, round_icon=False):
    img = Image.new("RGBA", (size, size), CANVAS)
    mark = centered_mark(size, 0.62)
    img.alpha_composite(mark)
    if round_icon:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
        img.putalpha(mask)
    img.save(path)

def launcher_foreground(path, size):
    """自适应图标前景：透明底，标记位于中央安全区。"""
    img = centered_mark(size, 0.62)
    img.save(path)

def splash(path, width, height):
    img = Image.new("RGB", (width, height), CANVAS)
    mark = centered_mark(int(min(width, height)), 0.22)
    img.paste(mark, ((width - mark.width) // 2, (height - mark.height) // 2), mark)
    img.save(path)

def main():
    base = os.path.join(os.path.dirname(__file__), "app", "src", "main", "res")
    # 旧版密度图标
    for density, size in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        mipmap = os.path.join(base, f"mipmap-{density}")
        launcher_icon(os.path.join(mipmap, "ic_launcher.png"), size)
        launcher_icon(os.path.join(mipmap, "ic_launcher_round.png"), size, round_icon=True)
        fg_size = size * 3  # 与现有 foreground 尺寸比例一致（mdpi 108 / 48 = 2.25，这里统一 2.25）
        launcher_foreground(os.path.join(mipmap, "ic_launcher_foreground.png"), round(size * 2.25))
    # 启动画面（保持各密度现有尺寸）
    splash(os.path.join(base, "drawable", "splash.png"), 480, 320)
    for name, width, height in (
        ("drawable-land-mdpi", 480, 320), ("drawable-land-hdpi", 800, 480),
        ("drawable-land-xhdpi", 1280, 720), ("drawable-land-xxhdpi", 1600, 960),
        ("drawable-land-xxxhdpi", 1920, 1280),
        ("drawable-port-mdpi", 320, 480), ("drawable-port-hdpi", 480, 800),
        ("drawable-port-xhdpi", 720, 1280), ("drawable-port-xxhdpi", 960, 1600),
        ("drawable-port-xxxhdpi", 1280, 1920),
    ):
        splash(os.path.join(base, name, "splash.png"), width, height)
    print("brand PNG assets generated")

if __name__ == "__main__":
    main()
