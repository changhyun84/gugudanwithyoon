"""수학 문제 팩 만들기 — python3 sim/seed-math.py [--force]

   **손으로 쓰지 않고 계산해서 만듭니다.** 275문제를 손으로 적으면 반드시 계산 실수가 나고,
   아이가 맞게 답하고 틀린 것으로 처리되는 것이 이 게임에서 가장 나쁜 결과입니다.

   이미 있는 파일은 덮어쓰지 않습니다(--force). 부모가 손으로 고친 것을 날리면 안 됩니다."""

import csv
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'content' / 'problems' / '수학'
HEAD = ['문제', '정답', '오답1', '오답2', '오답3', '힌트', '묶음', '난이도']


def q(prompt, answer, hint='', group='', wrongs=('', '', '')):
    return [prompt, str(answer), *wrongs, hint, group, '']


def d(prompt, answer, hint='', group='', wrongs=('', '', '')):
    """심화 — 그 단원의 기본을 지나간 뒤에 열린다.

       계산을 어렵게 만드는 것이 아니라 **묻는 방식을 바꾼다.** 같은 12 ÷ 3을
       문장으로 묻고, 거꾸로 묻고, 두 단계로 묻는다. 아이가 "또 이 문제"라고
       느끼는 것은 수가 같아서가 아니라 **묻는 방식이 같아서**다."""
    return [prompt, str(answer), *wrongs, hint, group, '심화']


# ── 1학기 ─────────────────────────────────────────────

def div_basic():
    """1-3 나눗셈 — 똑같이 나누기, 곱셈과의 관계, 몫. 구구단 범위 안에서만."""
    rows = []
    for a, b in [(3,4),(3,6),(4,4),(3,7),(4,6),(3,8),(4,7),(6,6),(4,8),(6,7),(7,7),(6,8),(7,8),(8,8),(5,6)]:
        rows.append(q(f'{a*b} ÷ {a}', b, f'곱셈으로 바꿔봐. {a} × ? = {a*b}', '나눗셈'))
    for a, b in [(6,3),(8,4),(9,3),(12,4),(15,5),(16,8),(18,6),(20,5),(24,8),(28,7)]:
        rows.append(q(f'{a} ÷ {b}', a // b, f'{b}씩 몇 번 덜어낼 수 있어?', '나눗셈'))
    for a, b in [(4,24),(6,42),(7,35),(8,56),(9,54)]:
        rows.append(q(f'{a} × ? = {b}', b // a, f'{b}를 {a}로 나누면 돼', '곱셈과 나눗셈'))
    return rows


def mul_2x1():
    """1-4 곱셈 — (두 자리) × (한 자리). 올림 없는 것부터 있는 것으로."""
    rows = []
    easy = [(12,3),(21,4),(31,3),(23,2),(32,3),(11,7),(41,2),(13,3),(22,4),(24,2)]
    hard = [(17,3),(26,4),(38,2),(45,3),(27,6),(49,2),(56,3),(34,5),(63,4),(78,2),
            (19,5),(28,7),(36,6),(47,4),(52,8),(64,3),(73,5),(85,2),(96,4),(58,6)]
    for a, b in easy:
        rows.append(q(f'{a} × {b}', a * b, f'{a//10*10}×{b} 하고 {a%10}×{b} 해서 더해봐', '올림 없는 곱셈'))
    for a, b in hard:
        rows.append(q(f'{a} × {b}', a * b, f'{a%10}×{b}부터. 십의 자리로 올려주는 거 잊지 마', '올림 있는 곱셈'))
    return rows


def length_time():
    """1-5 길이와 시간 — 단위 바꾸기. 답이 숫자라 오답이 저절로 만들어진다."""
    rows = []
    for cm in [3, 7, 12, 25, 40]:
        rows.append(q(f'{cm}cm는 몇 mm일까?', cm * 10, '1cm는 10mm야', '길이 바꾸기'))
    for mm in [50, 80, 120, 300, 460]:
        rows.append(q(f'{mm}mm는 몇 cm일까?', mm // 10, '10mm가 1cm야', '길이 바꾸기'))
    for m in [2, 5, 9, 14, 30]:
        rows.append(q(f'{m}m는 몇 cm일까?', m * 100, '1m는 100cm야', '길이 바꾸기'))
    for km in [1, 3, 6, 12]:
        rows.append(q(f'{km}km는 몇 m일까?', km * 1000, '1km는 1000m야', '길이 바꾸기'))
    for mi, se in [(1,0),(2,0),(1,30),(2,15),(3,40),(5,0)]:
        total = mi * 60 + se
        tail = f' {se}초' if se else ''
        rows.append(q(f'{mi}분{tail}는 몇 초일까?', total, '1분은 60초야', '시간 바꾸기'))
    for se in [120, 180, 240, 300, 420]:
        rows.append(q(f'{se}초는 몇 분일까?', se // 60, '60초가 1분이야', '시간 바꾸기'))
    return rows


def frac_dec_1():
    """1-6 분수와 소수 — 답이 소수·분수라 글자로 다뤄진다. 묶음마다 답이 4종 넘게 있어야 한다."""
    rows = []
    for n in [3, 5, 7, 9, 2, 6]:
        rows.append(q(f'0.1이 {n}개면 얼마일까?', f'0.{n}', '0.1을 그만큼 모은 거야', '소수 읽기'))
    # 같은 묶음 안에서 정답이 겹치면 오답 보기를 만들 수 없다. 답이 다 다르게 고른다.
    for a, b in [(1,2),(2,3),(4,2),(5,3),(6,3),(7,4)]:
        s = a + b
        rows.append(q(f'0.{a} + 0.{b}', f'{s//10}.{s%10}' if s >= 10 else f'0.{s}',
                      f'0.1이 {a}개하고 {b}개야', '소수 더하기'))
    for a, b in [(9,8),(7,5),(8,5),(9,5),(6,1),(8,2)]:
        rows.append(q(f'0.{a} − 0.{b}', f'0.{a-b}', f'0.1이 {a}개에서 {b}개를 빼면?', '소수 빼기'))
    pairs = [('1/2','1/3'),('1/4','1/5'),('2/5','1/5'),('3/7','2/7'),('1/6','1/8'),('5/9','4/9')]
    for x, y in pairs:
        nx, dx = map(int, x.split('/')); ny, dy = map(int, y.split('/'))
        big = x if nx * dy > ny * dx else y
        rows.append(q(f'{x}와 {y} 중 더 큰 것은?', big,
                      '똑같은 것을 몇 조각으로 나눴는지 생각해봐', '분수 크기'))
    for d in [2, 3, 4, 5, 6, 8]:
        rows.append(q(f'전체를 똑같이 {d}로 나눈 것 중 1을 뭐라고 쓸까?', f'1/{d}',
                      '아래에 나눈 수, 위에 가진 수', '분수 쓰기'))
    return rows


# ── 2학기 ─────────────────────────────────────────────

def mul_big():
    """2-1 곱셈 — (세 자리)×(한 자리), (두 자리)×(두 자리)."""
    rows = []
    for a, b in [(123,2),(214,3),(312,3),(132,4),(203,4),(341,2),(412,2),(230,3),(104,5),(321,3),
                 (247,3),(358,2),(469,4),(576,3),(683,5),(794,2),(825,4),(937,3),(158,6),(269,7)]:
        rows.append(q(f'{a} × {b}', a * b, f'일의 자리부터. {a%10}×{b}가 먼저야', '세 자리 × 한 자리'))
    for a, b in [(12,13),(21,14),(23,12),(31,23),(42,11),(15,22),(24,31),(33,12),(16,21),(25,13),
                 (34,26),(47,35),(58,24),(63,47),(72,38),(86,25),(94,17),(55,44),(67,53),(78,62)]:
        rows.append(q(f'{a} × {b}', a * b, f'{a}×{b%10} 하고 {a}×{b//10*10} 해서 더해봐', '두 자리 × 두 자리'))
    return rows


def div_remainder():
    """2-2 나머지가 있는 나눗셈 — 몫과 나머지를 **따로** 묻는다.
       한 문제에 둘을 물으면 4지선다로 만들 수 없다."""
    rows = []
    cases = [(17,5),(23,4),(30,7),(19,6),(25,3),(38,8),(41,9),(29,6),(34,5),(47,7),
             (52,8),(45,6),(61,9),(37,4),(58,7)]
    for a, b in cases:
        rows.append(q(f'{a} ÷ {b}의 몫', a // b, f'{b}×{a//b}={b*(a//b)}. 한 번 더 하면 {a}보다 커져', '몫'))
        rows.append(q(f'{a} ÷ {b}의 나머지', a % b, f'{b} × {a//b} = {b*(a//b)}. {a}에서 그걸 빼면?', '나머지'))
    return rows


def circle():
    """2-3 원 — 지름 = 반지름 × 2. 답은 숫자만 두어 오답이 저절로 만들어지게 한다."""
    rows = []
    for r in [3, 5, 7, 8, 12, 15, 20]:
        rows.append(q(f'반지름이 {r}cm인 원의 지름은 몇 cm일까?', r * 2,
                      '지름은 반지름의 두 배야', '반지름과 지름'))
    for d in [6, 10, 14, 18, 24, 30]:
        rows.append(q(f'지름이 {d}cm인 원의 반지름은 몇 cm일까?', d // 2,
                      '반지름은 지름의 반이야', '반지름과 지름'))
    rows.append(q('원의 한가운데 점을 뭐라고 할까?', '원의 중심', '가운데에 있는 점이야', '원의 이름',
                  ('반지름', '지름', '원주')))
    rows.append(q('원의 중심에서 원 위의 한 점까지 그은 선은?', '반지름', '중심에서 가장자리까지야', '원의 이름',
                  ('지름', '원의 중심', '둘레')))
    return rows


def frac_2():
    """2-4 분수 — 진분수·가분수·대분수. 답이 글자라 묶음마다 4종 넘게 있어야 한다."""
    rows = []
    for f in ['2/3', '1/5', '4/7', '3/8', '5/6', '7/9']:
        rows.append(q(f'{f}은(는) 어떤 분수일까?', '진분수', '위가 아래보다 작아', '분수의 종류',
                      ('가분수', '대분수', '자연수')))
    for f in ['5/3', '7/4', '9/5', '8/8', '11/6', '6/5']:
        rows.append(q(f'{f}은(는) 어떤 분수일까?', '가분수', '위가 아래와 같거나 커', '분수의 종류',
                      ('진분수', '대분수', '자연수')))
    for f in ['1과 2/3', '2와 1/4', '3과 3/5', '1과 5/6']:
        rows.append(q(f'{f}은(는) 어떤 분수일까?', '대분수', '자연수와 분수가 붙어 있어', '분수의 종류',
                      ('진분수', '가분수', '소수')))
    for n, d in [(7,3),(9,4),(11,5),(13,6),(8,3),(10,4)]:
        rows.append(q(f'{n}/{d}을(를) 대분수로 바꾸면?', f'{n//d}과 {n%d}/{d}',
                      f'{d}가 {n//d}번 들어가고 {n%d}이 남아', '가분수를 대분수로'))
    for w, n, d in [(1,1,2),(2,2,3),(1,3,4),(3,1,5)]:
        rows.append(q(f'{w}과 {n}/{d}을(를) 가분수로 바꾸면?', f'{w*d+n}/{d}',
                      f'{d}가 {w}번이면 {w*d}/{d}. 거기에 {n}/{d}을 더해', '대분수를 가분수로'))
    return rows


def volume_weight():
    """2-5 들이와 무게 — 1L=1000mL, 1kg=1000g."""
    rows = []
    for l in [1, 2, 3, 5, 8]:
        rows.append(q(f'{l}L는 몇 mL일까?', l * 1000, '1L는 1000mL야', '들이 바꾸기'))
    for ml in [2000, 4000, 6000, 9000]:
        rows.append(q(f'{ml}mL는 몇 L일까?', ml // 1000, '1000mL가 1L야', '들이 바꾸기'))
    for kg in [1, 2, 4, 7, 10]:
        rows.append(q(f'{kg}kg은 몇 g일까?', kg * 1000, '1kg은 1000g이야', '무게 바꾸기'))
    for g in [3000, 5000, 8000, 12000]:
        rows.append(q(f'{g}g은 몇 kg일까?', g // 1000, '1000g이 1kg이야', '무게 바꾸기'))
    for a, b in [(300,400),(250,150),(600,300),(1200,800)]:
        rows.append(q(f'{a}mL + {b}mL는 몇 mL일까?', a + b, '그냥 더하면 돼', '들이 더하기'))
    for a, b in [(900,400),(750,250),(1500,600),(2200,700)]:
        rows.append(q(f'{a}g − {b}g은 몇 g일까?', a - b, '그냥 빼면 돼', '무게 빼기'))
    return rows


# ── 심화 ──────────────────────────────────────────────
# 기본과 같은 내용을 **다르게 묻는다**: 문장제 · 거꾸로 · 두 단계 · 비교.

def deep_div_basic():
    rows = []
    things = [('사탕', 24, 4), ('색연필', 18, 3), ('딱지', 35, 5), ('구슬', 42, 6), ('스티커', 56, 7)]
    for nm, tot, ppl in things:
        rows.append(d(f'{nm} {tot}개를 {ppl}명이 똑같이 나누면 한 명이 몇 개일까?', tot // ppl,
                      f'{ppl}명에게 하나씩 돌리면 몇 바퀴 돌 수 있을까?', '나눗셈 문장제'))
    for tot, each in [(28, 4), (36, 6), (45, 9), (32, 8), (54, 6)]:
        rows.append(d(f'연필 {tot}자루를 한 명에게 {each}자루씩 주면 몇 명에게 줄 수 있을까?', tot // each,
                      f'{each}씩 몇 번 덜어낼 수 있어?', '나눗셈 문장제'))
    for a, b in [(4, 6), (3, 9), (7, 5), (6, 8), (9, 4)]:
        rows.append(d(f'? ÷ {a} = {b} 일 때 ?는 얼마일까?', a * b,
                      f'{a}가 {b}번 모인 수야', '거꾸로 나눗셈'))
    for a, b, c in [(24, 4, 3), (36, 6, 2), (40, 5, 4), (48, 8, 5), (63, 9, 6)]:
        rows.append(d(f'{a} ÷ {b}을(를) 구한 다음 {c}을(를) 곱하면?', a // b * c,
                      f'먼저 {a} ÷ {b}부터 하고, 그 답에 {c}을(를) 곱해', '두 단계'))
    return rows


def deep_mul_2x1():
    rows = []
    for each, box in [(24, 3), (36, 4), (18, 5), (45, 2), (27, 6)]:
        rows.append(d(f'한 상자에 {each}개씩 {box}상자가 있어. 모두 몇 개일까?', each * box,
                      f'{each}이(가) {box}번 모인 거야', '곱셈 문장제'))
    for won, n in [(35, 4), (48, 3), (25, 6), (60, 5), (72, 2)]:
        rows.append(d(f'{won}원짜리 사탕 {n}개를 사면 얼마일까?', won * n,
                      f'{won}×{n}을(를) 하면 돼', '곱셈 문장제'))
    for a, b in [(3, 72), (4, 96), (5, 85), (6, 78), (7, 91)]:
        rows.append(d(f'? × {a} = {b} 일 때 ?는 얼마일까?', b // a,
                      f'{b}을(를) {a}(으)로 나누면 돼', '거꾸로 곱셈'))
    for a, b, c in [(15, 4, 20), (23, 3, 9), (18, 5, 30), (26, 4, 14), (34, 3, 42)]:
        rows.append(d(f'{a} × {b}에서 {c}을(를) 빼면 얼마일까?', a * b - c,
                      f'먼저 {a}×{b}부터 하고 {c}을(를) 빼', '두 단계'))
    return rows


def deep_length_time():
    rows = []
    for m, cm in [(1, 20), (2, 45), (3, 8), (1, 75), (4, 30)]:
        rows.append(d(f'{m}m {cm}cm는 몇 cm일까?', m * 100 + cm, f'{m}m가 {m*100}cm야. 거기에 {cm}을(를) 더해', '섞인 단위'))
    for cm, mm in [(5, 4), (12, 7), (8, 2), (20, 6)]:
        rows.append(d(f'{cm}cm {mm}mm는 몇 mm일까?', cm * 10 + mm, f'{cm}cm가 {cm*10}mm야', '섞인 단위'))
    for a, b in [(150, 140), (208, 230), (95, 105), (312, 290)]:
        rows.append(d(f'{a}cm와 {b//100}m {b%100}cm 중 더 긴 것은 몇 cm일까?', max(a, b),
                      '둘 다 cm로 바꿔서 비교해봐', '길이 비교'))
    for h, mi, add in [(3, 20, 45), (1, 50, 30), (4, 35, 40), (2, 10, 55), (5, 45, 25)]:
        t = h * 60 + mi + add
        rows.append(d(f'{h}시 {mi}분에서 {add}분이 지나면 몇 시 몇 분일까?', f'{t//60}시 {t%60}분',
                      f'{mi}분에 {add}분을 더하면 60분이 넘어', '시간 계산'))
    return rows


def deep_frac_dec_1():
    rows = []
    for a, b in [('0.7', '0.5'), ('0.3', '0.8'), ('0.9', '0.4'), ('0.2', '0.6')]:
        rows.append(d(f'{a}와(과) {b} 중 더 큰 것은?', max(a, b, key=float),
                      '0.1이 몇 개인지 세어봐', '소수 비교'))
    for n, dn in [(1, 2), (1, 4), (3, 4), (1, 5), (2, 5)]:
        rows.append(d(f'{n}/{dn}을(를) 소수로 쓰면?', f'{n/dn:.2f}'.rstrip('0').rstrip('.'),
                      f'{dn}조각 중 {n}조각이야', '분수를 소수로'))
    for a, b, c in [(3, 5, 2), (4, 2, 6), (7, 1, 3), (2, 8, 4)]:
        tot = a + b - c
        rows.append(d(f'0.{a} + 0.{b} − 0.{c}는 얼마일까?', f'{tot//10}.{tot%10}' if tot >= 10 else f'0.{tot}',
                      '앞에서부터 차례로 계산해', '두 단계'))
    # 세 보기 중 답이 하나뿐이라 같은 묶음에서 오답을 못 만든다 — 나머지 둘을 그대로 오답으로 쓴다
    for x, y, z in [('1/2', '1/3', '1/4'), ('2/5', '3/5', '1/5'), ('1/6', '1/3', '1/2'),
                    ('3/8', '5/8', '1/8'), ('1/9', '4/9', '2/9')]:
        val = lambda f: int(f.split('/')[0]) / int(f.split('/')[1])
        big = max([x, y, z], key=val)
        rest = [f for f in (x, y, z) if f != big]
        extra = f'{big.split("/")[0]}/{int(big.split("/")[1]) + 3}'
        rows.append(d(f'{x}, {y}, {z} 중 가장 큰 것은?', big, '조각이 클수록 나눈 수가 작아', '분수 비교',
                      (rest[0], rest[1], extra)))
    return rows


def deep_mul_big():
    rows = []
    for each, n in [(125, 4), (238, 3), (146, 5), (307, 6), (219, 7)]:
        rows.append(d(f'한 상자에 {each}개씩 {n}상자면 모두 몇 개일까?', each * n,
                      f'{each}×{n}을(를) 하면 돼', '곱셈 문장제'))
    for won, n in [(24, 15), (36, 12), (45, 23), (58, 14), (27, 32)]:
        rows.append(d(f'{won}쪽짜리 책을 {n}권 읽으면 모두 몇 쪽일까?', won * n,
                      f'{won}×{n%10} 하고 {won}×{n//10*10} 해서 더해', '곱셈 문장제'))
    for a, b in [(4, 268), (3, 219), (6, 342), (5, 285), (7, 371)]:
        rows.append(d(f'? × {a} = {b} 일 때 ?는 얼마일까?', b // a, f'{b}을(를) {a}(으)로 나누면 돼', '거꾸로 곱셈'))
    return rows


def deep_div_remainder():
    rows = []
    for tot, ppl in [(23, 4), (34, 5), (47, 6), (29, 3), (52, 7)]:
        rows.append(d(f'사탕 {tot}개를 {ppl}명에게 똑같이 나눠주면 몇 개가 남을까?', tot % ppl,
                      f'{ppl}×{tot//ppl}={ppl*(tot//ppl)}. {tot}에서 그걸 빼', '나머지 문장제'))
    for tot, box in [(30, 4), (45, 7), (38, 5), (53, 6), (26, 3)]:
        rows.append(d(f'귤 {tot}개를 한 상자에 {box}개씩 담으면 몇 상자가 될까?', tot // box,
                      '다 못 채운 상자는 세지 않아', '나머지 문장제'))
    for a, b in [(17, 5), (23, 4), (30, 7), (41, 9), (58, 7)]:
        rows.append(d(f'{a} ÷ {b}에서 몫과 나머지를 더하면 얼마일까?', a // b + a % b,
                      f'몫은 {a//b}, 나머지는 {a%b}야', '두 단계'))
    return rows


def deep_circle():
    rows = []
    for r in [4, 6, 9, 11, 14]:
        rows.append(d(f'반지름이 {r}cm인 원 두 개를 나란히 붙이면 가로 길이는 몇 cm일까?', r * 4,
                      '지름 두 개를 이어 붙인 거야', '원 두 개'))
    for dd in [8, 12, 16, 20, 26]:
        rows.append(d(f'지름이 {dd}cm인 원 안에 반지름을 세 번 그으면 모두 몇 cm일까?', dd // 2 * 3,
                      f'반지름은 {dd//2}cm야', '두 단계'))
    for r in [5, 7, 10, 13]:
        rows.append(d(f'반지름이 {r}cm인 원의 지름보다 3cm 긴 길이는 몇 cm일까?', r * 2 + 3,
                      f'지름은 {r*2}cm야. 거기에 3을 더해', '두 단계'))
    return rows


def deep_frac_2():
    rows = []
    for a, b in [('5/3', '4/3'), ('7/4', '9/4'), ('8/5', '6/5'), ('11/6', '13/6')]:
        big = max([a, b], key=lambda f: int(f.split('/')[0]))
        rows.append(d(f'{a}와(과) {b} 중 더 큰 것은?', big, '아래가 같으면 위가 큰 쪽이 커', '가분수 비교'))
    for w, n, dn in [(2, 1, 3), (1, 3, 5), (3, 2, 7), (2, 5, 6), (4, 1, 4)]:
        rows.append(d(f'{w}과 {n}/{dn}보다 1/{dn} 큰 수를 가분수로 쓰면?', f'{w*dn+n+1}/{dn}',
                      f'{w}과 {n}/{dn}은 {w*dn+n}/{dn}이야', '두 단계'))
    for n, dn in [(9, 2), (13, 4), (17, 5), (11, 3)]:
        rows.append(d(f'{n}/{dn}을(를) 대분수로 바꾸면 자연수 부분은 얼마일까?', n // dn,
                      f'{dn}이 몇 번 들어가는지 세어봐', '자연수 부분'))
    return rows


def deep_volume_weight():
    rows = []
    for l, ml in [(1, 500), (2, 300), (3, 750), (1, 250), (4, 100)]:
        rows.append(d(f'{l}L {ml}mL는 몇 mL일까?', l * 1000 + ml, f'{l}L가 {l*1000}mL야', '섞인 단위'))
    for kg, g in [(2, 400), (1, 800), (3, 250), (5, 600)]:
        rows.append(d(f'{kg}kg {g}g은 몇 g일까?', kg * 1000 + g, f'{kg}kg이 {kg*1000}g이야', '섞인 단위'))
    for a, b in [(1200, 900), (2500, 2050), (750, 800), (3100, 2900)]:
        rows.append(d(f'{a}mL와(과) {b}mL 중 더 많은 것은 몇 mL일까?', max(a, b), '큰 수를 고르면 돼', '들이 비교'))
    for a, b, c in [(500, 300, 150), (1200, 400, 300), (800, 250, 150), (2000, 600, 500)]:
        rows.append(d(f'{a}g에서 {b}g을 쓰고 {c}g을 더 쓰면 몇 g이 남을까?', a - b - c,
                      '두 번 빼면 돼', '두 단계'))
    return rows


DEEP = {
    '1-3 나눗셈': deep_div_basic,
    '1-4 곱셈': deep_mul_2x1,
    '1-5 길이와 시간': deep_length_time,
    '1-6 분수와 소수': deep_frac_dec_1,
    '2-1 곱셈': deep_mul_big,
    '2-2 나머지가 있는 나눗셈': deep_div_remainder,
    '2-3 원': deep_circle,
    '2-4 분수': deep_frac_2,
    '2-5 들이와 무게': deep_volume_weight,
}


PACKS = {
    '1-3 나눗셈':            div_basic,
    '1-4 곱셈':              mul_2x1,
    '1-5 길이와 시간':        length_time,
    '1-6 분수와 소수':        frac_dec_1,
    '2-1 곱셈':              mul_big,
    '2-2 나머지가 있는 나눗셈': div_remainder,
    '2-3 원':                circle,
    '2-4 분수':              frac_2,
    '2-5 들이와 무게':        volume_weight,
}

if __name__ == '__main__':
    force = '--force' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    for name, build in PACKS.items():
        path = OUT / f'{name}.csv'
        if path.exists() and not force:
            print(f'  건너뜀 (이미 있음): {path.name}')
            continue
        rows = build() + DEEP[name]()
        with path.open('w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(HEAD)
            w.writerows(rows)
        deep_n = sum(1 for r in rows if r[-1] == '심화')
        print(f'  {path.name:28} {len(rows):3}문제 (기본 {len(rows)-deep_n} · 심화 {deep_n})')
