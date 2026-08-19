"""문제 팩 파서 — content/problems/*.csv, *.md 를 읽어 문제 목록으로 바꾼다.
   틀린 줄이 있어도 팩 전체를 버리지 않고, 읽은 것만 싣고 경고를 모은다."""

import csv
import io
import random
import re

HEADERS = {
    'question': ['문제', 'question'],
    'answer':   ['정답', 'answer'],
    'wrong1':   ['오답1', 'wrong1'],
    'wrong2':   ['오답2', 'wrong2'],
    'wrong3':   ['오답3', 'wrong3'],
    'hint':     ['힌트', 'hint'],
    'group':    ['묶음', 'group'],
}


UNIT_RE = re.compile(r'^\d+(?:[-.]\d+)*')
PACK_SUFFIX = ('.csv', '.md')


def natural(name):
    """1-10이 1-2보다 앞에 오지 않게 한다. 숫자 조각은 숫자로 비교한다.
       이 정렬은 화면 순서일 뿐 아니라 문제 order로 이어져 **출제 순서**까지 정한다."""
    return [(0, int(s)) if s.isdigit() else (1, s)
            for s in re.split(r'(\d+)', name) if s]


def by_name(path):
    return natural(path.name)


def scan(folder):
    """폴더 = 과목, 파일명 앞의 1-1 = 단원 (기획서 16장).

       한 단계만 내려간다 — 과목·단원 두 단계면 충분하고, 깊어지면 부모가 헷갈린다.
       폴더 밖의 파일은 과목 없이 지금처럼 동작한다. 기존 파일을 옮기지 않아도 된다."""
    packs, taken = [], {}

    def add(path, subject, order):
        pid = slug(path.stem)
        if pid in taken:
            # 팩 id를 바꾸면 아이 진도가 통째로 날아간다. 뒤엣것을 버리고 알린다.
            packs[taken[pid]]['warnings'].append(
                f'{path.name} — 이름이 {packs[taken[pid]]["file"]}와 겹쳐서 읽지 않았습니다. '
                f'파일 이름을 다르게 해주세요.')
            return
        taken[pid] = len(packs)
        packs.append(read_pack(path, pid, subject, order))

    if not folder.exists():
        return packs

    for path in sorted(folder.iterdir(), key=by_name):
        if path.is_dir():
            files = [f for f in sorted(path.iterdir(), key=by_name)
                     if f.is_file() and f.suffix.lower() in PACK_SUFFIX]
            for order, f in enumerate(files):
                add(f, path.name, order)
        elif path.is_file() and path.suffix.lower() in PACK_SUFFIX:
            add(path, None, 0)
    return packs


def read_pack(path, pid, subject, order):
    """팩 id는 **파일명 슬러그만** 쓴다. 과목을 id에 넣으면 파일을 폴더로 옮기는 것만으로
       문제 키가 바뀌어 아이가 몇 달 쌓은 진도·마스터·스티커가 통째로 날아간다."""
    text, enc_warning = read_text(path)
    parse = parse_csv if path.suffix.lower() == '.csv' else parse_md
    name, rows, warnings = parse(text, path.stem)
    problems, more = build_problems(rows, pid)
    unit = UNIT_RE.match(path.stem)
    return {
        'id': pid,
        'name': name,
        'subject': subject,                 # 폴더 이름. 폴더 밖이면 None
        'unit': unit.group(0) if unit else None,
        'order': order,                     # 과목 안에서의 자연 정렬 순서
        'file': f'{subject}/{path.name}' if subject else path.name,
        'count': len(problems),
        'problems': problems,
        'warnings': ([enc_warning] if enc_warning else []) + warnings + more,
    }


CHAR_NAMES = {'양': 'sheep', '고양이': 'cat', '토끼': 'rabbit', '코알라': 'koala',
               '카피바라': 'capybara', '공통': 'all'}
SITUATIONS = ['정답', '힌트정답', '오답', '시작', '끝', '새아이템', '오랜만', '마스터']


def scan_messages(path):
    """응원 메시지 CSV — 없거나 깨져도 게임이 멈추면 안 되므로 읽은 것만 돌려준다"""
    if not path.exists():
        return {}, []

    text, enc_warning = read_text(path)
    reader = csv.reader(io.StringIO(text))
    next(reader, None)

    out, warnings = {}, ([enc_warning] if enc_warning else [])
    for n, row in enumerate(reader, start=2):
        if len(row) < 3 or not any(c.strip() for c in row):
            continue
        char, situation, message = (c.strip() for c in row[:3])
        if char not in CHAR_NAMES or situation not in SITUATIONS or not message:
            warnings.append(f'{n}번째 줄 — 캐릭터나 상황 이름이 목록에 없어 건너뛰었습니다.')
            continue
        out.setdefault(CHAR_NAMES[char], {}).setdefault(situation, []).append(message)
    return out, warnings


WISH_HEADERS = {'nm': ['소원', 'wish'], 'star': ['별', 'star'], 'note': ['설명', 'note']}


def scan_wishes(path):
    """소원권 — content/wishes.csv. 파일이 없으면 기능 자체가 안 나타난다(기획서 13.1.1과 같은 방식).
       별 값이 없거나 숫자가 아니면 그 줄만 건너뛴다 — 게임이 멈추면 안 된다."""
    if not path.exists():
        return [], []

    text, enc_warning = read_text(path)
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    warnings = [enc_warning] if enc_warning else []
    if not header:
        return [], warnings + ['wishes.csv — 파일이 비어 있습니다.']

    col = {}
    for i, cell in enumerate(header):
        key = next((k for k, names in WISH_HEADERS.items() if cell.strip().lower() in names), None)
        if key:
            col[key] = i
    if 'nm' not in col or 'star' not in col:
        return [], warnings + ['wishes.csv — 첫 줄에 "소원"과 "별" 칸이 필요합니다.']

    get = lambda row, key: row[col[key]].strip() if key in col and col[key] < len(row) else ''
    out = []
    for n, row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in row):
            continue
        nm, star = get(row, 'nm'), get(row, 'star')
        if not nm or not star.isdigit() or not int(star):
            warnings.append(f'{n}번째 줄 — 소원 이름이 없거나 별이 숫자가 아니어서 건너뛰었습니다.')
            continue
        out.append({'id': f'w{n}', 'nm': nm, 'star': int(star), 'note': get(row, 'note')})
    return out, warnings


def slug(stem):
    return re.sub(r'[^가-힣a-zA-Z0-9_-]', '', stem.replace(' ', '-'))[:40] or 'pack'


def read_text(path):
    """엑셀에서 그냥 'CSV'로 저장하면 cp949로 나온다 — 읽어는 주되 알려준다"""
    raw = path.read_bytes()
    try:
        return raw.decode('utf-8-sig'), None
    except UnicodeDecodeError:
        return raw.decode('cp949', errors='replace'), \
            f'{path.name} — 한글 인코딩이 UTF-8이 아닙니다. 엑셀에서 "CSV UTF-8"로 다시 저장하면 안전합니다.'


# ── 파일 형식별 파싱 ────────────────────────────────────

def parse_csv(text, stem):
    reader = csv.reader(io.StringIO(text))
    rows, warnings = [], []

    header = next(reader, None)
    if not header:
        return stem, [], [f'{stem} — 파일이 비어 있습니다.']

    col = {}
    for i, cell in enumerate(header):
        key = next((k for k, names in HEADERS.items() if cell.strip().lower() in names), None)
        if key:
            col[key] = i
    if 'question' not in col or 'answer' not in col:
        return stem, [], [f'{stem} — 첫 줄에 "문제"와 "정답" 칸이 필요합니다.']

    get = lambda row, key: row[col[key]].strip() if key in col and col[key] < len(row) else ''
    for n, row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in row):
            continue
        question, answer = get(row, 'question'), get(row, 'answer')
        if not question or not answer:
            warnings.append(f'{n}번째 줄 — 문제나 정답이 비어 있어 건너뛰었습니다.')
            continue
        rows.append({
            'question': question, 'answer': answer,
            'wrongs': [w for w in (get(row, 'wrong1'), get(row, 'wrong2'), get(row, 'wrong3')) if w],
            'hint': get(row, 'hint'), 'group': get(row, 'group'),
        })
    return stem, rows, warnings


def parse_md(text, stem):
    name, group = stem, ''
    rows, warnings = [], []

    for n, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if line.startswith('#'):
            name = line.lstrip('#').strip() or stem
        elif line.startswith('묶음:'):
            group = line.split(':', 1)[1].strip()
        elif line.startswith('-'):
            body, _, hint = line[1:].partition('//')
            parts = re.split(r'->|→', body, maxsplit=1)
            if len(parts) < 2 or not parts[1].strip():
                warnings.append(f'{n}번째 줄 — 정답을 찾을 수 없어 건너뛰었습니다. (-> 가 빠졌습니다)')
                continue
            question, answer = parts[0].strip(), parts[1].strip()
            if not question:
                warnings.append(f'{n}번째 줄 — 문제가 비어 있어 건너뛰었습니다.')
                continue
            rows.append({'question': question, 'answer': answer, 'wrongs': [],
                         'hint': hint.strip(), 'group': group})
    return name, rows, warnings


# ── 문제 만들기 ────────────────────────────────────────

def build_problems(rows, pack_id):
    warnings = []
    problems = []
    answers_by_group = {}
    for r in rows:
        answers_by_group.setdefault(r['group'], []).append(r['answer'])
    all_answers = [r['answer'] for r in rows]

    for order, r in enumerate(rows):
        choices = r['wrongs'][:3]
        if len(choices) < 3:
            choices += auto_wrongs(r['answer'], 3 - len(choices), choices, r['question'],
                                   answers_by_group.get(r['group'], []), all_answers)
        if len(choices) < 3:
            warnings.append(f'"{r["question"]}" — 보기를 4개로 만들 수 없어 뺐습니다. '
                            f'오답 칸을 채우거나 같은 묶음에 문제를 더 넣어주세요.')
            continue

        problems.append({
            'key': f'{pack_id}:{normalize(r["question"])}',
            'order': order,
            'prompt': r['question'],
            'answer': r['answer'],
            'choices': shuffled([r['answer']] + choices[:3]),
            'hint': r['hint'] or auto_hint(r['question'], r['answer']),
            'group': r['group'],
        })
    return problems, warnings


def normalize(text):
    return re.sub(r'\s+', '', text).lower()


def shuffled(items):
    out = list(items)
    random.shuffle(out)
    return out


def auto_wrongs(answer, need, taken, question, group_answers, all_answers):
    """숫자면 헷갈릴 만한 값, 글자면 같은 묶음의 다른 정답을 보기로 쓴다.
       문제에 이미 보이는 숫자는 답처럼 느껴지므로 보기에서 뺀다."""
    used = {answer, *taken, *re.findall(r'\d+', question)}
    picks = []

    if re.fullmatch(r'-?\d+', answer):
        n = int(answer)
        cands = [n + 1, n - 1, n + 2, n - 2]
        if n >= 10:   # 한 자리 답에 30, 40 같은 보기가 나오면 너무 티가 난다
            cands += [n + 10, n - 10, swap_digits(n)]
            cands += [n + d for d in divisors(n)] + [n - d for d in divisors(n)]
        cands = [str(c) for c in cands if c > 0]
        random.shuffle(cands)
        while len(picks) < need:
            spare = [c for c in cands if c not in used]
            if not spare:
                spare = [str(n + random.randint(1, 9))]
            pick = spare[0]
            used.add(pick)
            picks.append(pick)
        return picks

    pool = [a for a in group_answers if a not in used] or [a for a in all_answers if a not in used]
    random.shuffle(pool)
    for a in pool[:need]:
        picks.append(a)
    return picks


def swap_digits(n):
    s = str(n)
    return int(s[::-1]) if len(s) > 1 else n * 10


def divisors(n):
    return [d for d in range(2, min(abs(n), 10) + 1) if n % d == 0] or [3]


def auto_hint(question, answer):
    """나눗셈은 곱셈으로 뒤집어 준다 — 외운 구구단을 그대로 쓰게"""
    m = re.search(r'(\d+)\s*[÷/]\s*(\d+)', question)
    if m and re.fullmatch(r'\d+', answer):
        big, small = m.group(1), m.group(2)
        return f'곱셈으로 바꿔봐. {small} × ? = {big}'
    return ''
