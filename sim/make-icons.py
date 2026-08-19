"""홈 화면 아이콘 굽기 — python3 sim/make-icons.py

   파이썬 표준 라이브러리만 씁니다(zlib + struct). 외부 패키지 없음이 이 프로젝트의 조건입니다.
   양 얼굴을 직접 픽셀로 그립니다 — SVG를 래스터화할 방법이 없어서입니다.

   아이콘을 바꾸고 싶으면 draw()의 도형 좌표만 고치세요. 비율(0~1)로 그리므로 크기는 자동입니다."""

import struct
import zlib
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / 'web' / 'icons'

MEADOW = (0x6F, 0xA3, 0x49)   # 목장 초록
WOOL   = (0xFD, 0xFA, 0xF3)   # 양털
FACE   = (0xCD, 0xBB, 0xA5)
EYE    = (0x3A, 0x31, 0x29)
BLUSH  = (0xE8, 0xA9, 0xA0)

SS = 3   # 3×3로 크게 그린 뒤 줄인다 — 가장자리가 부드러워진다


def blend(dst, src, a):
    return tuple(round(d + (s - d) * a) for d, s in zip(dst, src))


def draw(n):
    """0~1 비율로 그린다. n은 확대된 변 길이."""
    px = [[MEADOW] * n for _ in range(n)]

    def circle(cx, cy, r, color):
        x0, y0, rr = cx * n, cy * n, r * n
        lo, hi = max(0, int(y0 - rr - 1)), min(n, int(y0 + rr + 2))
        for y in range(lo, hi):
            for x in range(max(0, int(x0 - rr - 1)), min(n, int(x0 + rr + 2))):
                d = ((x + .5 - x0) ** 2 + (y + .5 - y0) ** 2) ** .5
                if d <= rr:
                    px[y][x] = color

    def ellipse(cx, cy, rx, ry, color):
        x0, y0, ax, by = cx * n, cy * n, rx * n, ry * n
        for y in range(max(0, int(y0 - by - 1)), min(n, int(y0 + by + 2))):
            for x in range(max(0, int(x0 - ax - 1)), min(n, int(x0 + ax + 2))):
                if ((x + .5 - x0) / ax) ** 2 + ((y + .5 - y0) / by) ** 2 <= 1:
                    px[y][x] = color

    # 양털 — 얼굴 둘레로 뭉게뭉게
    for cx, cy in [(.26, .40), (.30, .22), (.50, .15), (.70, .22), (.74, .40),
                   (.72, .62), (.50, .70), (.28, .62)]:
        circle(cx, cy, .16, WOOL)
    circle(.50, .44, .27, WOOL)

    # 귀 · 얼굴
    ellipse(.20, .40, .09, .05, FACE)
    ellipse(.80, .40, .09, .05, FACE)
    ellipse(.50, .47, .21, .22, FACE)

    # 눈 · 볼 · 입
    circle(.42, .43, .045, EYE)
    circle(.58, .43, .045, EYE)
    circle(.435, .415, .016, WOOL)
    circle(.595, .415, .016, WOOL)
    for cx in (.335, .665):
        px_blush = ellipse(cx, .53, .05, .03, blend(FACE, BLUSH, .55))
    ellipse(.50, .565, .035, .018, blend(FACE, EYE, .35))
    return px


def write_png(path, size):
    n = size * SS
    big = draw(n)

    rows = []
    for y in range(size):
        row = bytearray([0])   # filter 0
        for x in range(size):
            acc = [0, 0, 0]
            for dy in range(SS):
                for dx in range(SS):
                    p = big[y * SS + dy][x * SS + dx]
                    for i in range(3):
                        acc[i] += p[i]
            row += bytes(v // (SS * SS) for v in acc)
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b'\x89PNG\r\n\x1a\n' +
           chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) +
           chunk(b'IDAT', zlib.compress(raw, 9)) +
           chunk(b'IEND', b''))
    path.write_bytes(png)
    return len(png)


if __name__ == '__main__':
    WEB.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        n = write_png(WEB / f'icon-{size}.png', size)
        print(f'  icon-{size}.png  {n:,} bytes')
