# -*- coding: utf-8 -*-
"""
부모 화면에 보여줄 숫자를 만듭니다. 표준 라이브러리만 씁니다.

읽기 전용입니다. 이 모듈은 프로필을 절대 수정하지 않습니다.

facts[key].log 형식:  ["0818:x", "0818:h", "0817:o"]  (최신이 앞)
    o = 힌트 없이 정답 / h = 힌트 쓰고 정답 / x = 오답
"""

import datetime

WINDOW = 7        # 부모 화면이 보는 기간
KEEP_DAYS = 14    # rollDay() 가 로그를 잘라내는 기준
LOG_MAX = 10      # 문제당 보관 개수
MIN_SEEN = 3      # 이만큼 안 나온 문제는 '약하다'고 부르지 않습니다
TOP_WEAK = 5


# ---------------------------------------------------------------- 날짜


def today():
    return datetime.date.today()


def mmdd(d):
    return "%02d%02d" % (d.month, d.day)


def resolve(tag, ref):
    """'0818' 을 실제 날짜로. 연도가 없으므로 ref 보다 미래면 작년으로 봅니다.

    12월 31일에 '0101' 로그를 만나면 내년이 아니라 작년입니다.
    """
    try:
        m, d = int(tag[:2]), int(tag[2:4])
        cand = datetime.date(ref.year, m, d)
    except ValueError:
        return None
    if cand > ref:
        try:
            cand = datetime.date(ref.year - 1, m, d)
        except ValueError:
            return None
    return cand


def parse_log(log, ref=None, days=WINDOW):
    """최근 days 일 안의 항목만 세어 돌려줍니다."""
    ref = ref or today()
    floor = ref - datetime.timedelta(days=days - 1)
    out = {"o": 0, "h": 0, "x": 0, "seen": 0, "recent": []}
    for item in (log or []):
        try:
            tag, code = str(item).split(":", 1)
        except ValueError:
            continue
        if code not in ("o", "h", "x"):
            continue
        d = resolve(tag, ref)
        if d is None or d < floor:
            continue
        out[code] += 1
        out["seen"] += 1
        out["recent"].append(code)
    return out


def prune_log(log, ref=None, keep_days=KEEP_DAYS, limit=LOG_MAX):
    """rollDay() 에서 쓰는 것과 같은 규칙. 파이썬 쪽 검증용입니다."""
    ref = ref or today()
    floor = ref - datetime.timedelta(days=keep_days - 1)
    out = []
    for item in (log or []):
        try:
            tag, code = str(item).split(":", 1)
        except ValueError:
            continue
        d = resolve(tag, ref)
        if d is None or d < floor:
            continue
        out.append(item)
    return out[:limit]


# ---------------------------------------------------------------- 약한 문제


def weakness(counts):
    """오답 2점, 힌트정답 1점. 혼자 맞힌 건 0점."""
    return counts["x"] * 2 + counts["h"]


def action_hint(meta, counts):
    """부모가 할 것. 기본값은 '그냥 두기' 입니다.

    이 열의 존재 이유는 부모가 목록을 보고 아이에게 물어보는 것을 막기 위함입니다.
    부모의 지렛대는 질문이 아니라 파일 수정입니다.
    """
    if not meta.get("hint"):
        return "힌트가 없음 → 힌트 추가"
    if not meta.get("customWrongs"):
        return "오답 보기를 직접 지정"
    return "그냥 두기 (며칠 뒤 자동 재등장)"


def weak_problems(facts, index, ref=None, days=WINDOW, top=TOP_WEAK,
                  min_seen=MIN_SEEN):
    """최근 days 일 기준 약한 문제 상위 top 개.

    min_seen 을 빼면 '두 번 나와서 한 번 틀림'이 1위로 올라옵니다.
    표본이 모자란 문제를 약점이라고 부르면 부모가 엉뚱한 데를 고칩니다.
    """
    ref = ref or today()
    rows = []
    for key, meta in index.items():
        f = facts.get(key)
        if not f:
            continue
        c = parse_log(f.get("log"), ref, days)
        if c["seen"] < min_seen:
            continue
        w = weakness(c)
        if w <= 0:
            continue
        rows.append({
            "key": key,
            "pack": meta.get("pack"),
            "packName": meta.get("packName"),
            "text": meta.get("text"),
            "answer": meta.get("answer"),
            "m": f.get("m", 0),
            "seen": c["seen"],
            "wrong": c["x"],
            "hinted": c["h"],
            "solo": c["o"],
            "recent": c["recent"],
            "score": w,
            "action": action_hint(meta, c),
        })
    rows.sort(key=lambda r: (-r["score"], -r["seen"], r["key"]))
    return rows[:top]


# ---------------------------------------------------------------- 일별 현황


def daily_rows(profile, ref=None, days=WINDOW):
    """최근 days 일. 안 한 날은 solved=None 으로 남깁니다 (0 과 구분).

    연속 일수는 계산하지 않습니다. 부모가 연속 일수를 보면 끊길 때 말이 나오고,
    그게 원칙 2.1 이 막으려던 실패 경험입니다.
    """
    ref = ref or today()
    by_day = {}
    for row in (profile.get("history") or []):
        if row.get("day"):
            by_day[row["day"]] = row

    d = profile.get("daily") or {}
    if d.get("day"):
        by_day[d["day"]] = d

    out = []
    for i in range(days - 1, -1, -1):
        day = (ref - datetime.timedelta(days=i)).isoformat()
        row = by_day.get(day)
        out.append({
            "day": day,
            "solved": row.get("solved") if row else None,
            "right": (row or {}).get("right", 0),
            "grass": (row or {}).get("grass", 0),
            "star": (row or {}).get("star", 0),
        })
    return out


def week_totals(rows):
    played = [r for r in rows if r["solved"] is not None]
    return {
        "days": len(played),
        "solved": sum(r["solved"] or 0 for r in played),
        "right": sum(r["right"] or 0 for r in played),
        "grass": sum(r["grass"] or 0 for r in played),
        "star": sum(r["star"] or 0 for r in played),
    }


# ---------------------------------------------------------------- 재고 경고


def mastered_since(facts, ref=None, days=WINDOW):
    ref = ref or today()
    floor = ref - datetime.timedelta(days=days - 1)
    n = 0
    for f in facts.values():
        at = f.get("masteredAt")
        if not at:
            continue
        try:
            d = datetime.date.fromisoformat(str(at)[:10])
        except ValueError:
            continue
        if d >= floor:
            n += 1
    return n


def stock_warning(facts, index, ref=None, days=WINDOW):
    """아직 안 배운 문제가 얼마나 남았는지.

    보상 페이싱 전체가 '부모가 문제를 계속 넣는다'는 전제 위에 있습니다.
    구구단만 쓰면 60일 시뮬레이션에서 별이 15에서 멈춥니다 (구현-현황 6장).
    이 경고가 이 화면에서 제일 중요합니다.
    """
    ref = ref or today()
    unseen = 0
    for key in index:
        f = facts.get(key)
        if not f or not f.get("seen"):
            unseen += 1

    rate = mastered_since(facts, ref, days) / float(days)
    days_left = int(unseen / rate) if rate > 0 else None

    level = "ok"
    if unseen == 0:
        level = "bad"
    elif days_left is not None and days_left <= 14:
        level = "warn"

    return {
        "level": level,
        "remaining": unseen,
        "perDay": round(rate, 2),
        "daysLeft": days_left,
        "total": len(index),
    }


# ---------------------------------------------------------------- 조립


def build_summary(profile, index, ref=None):
    ref = ref or today()
    facts = profile.get("facts") or {}
    rows = daily_rows(profile, ref)
    d = profile.get("daily") or {}
    goal = d.get("goal") or (profile.get("settings") or {}).get("goal") or 20

    return {
        "id": profile.get("id"),
        "displayName": profile.get("displayName") or profile.get("id"),
        "today": {
            "day": d.get("day"),
            "solved": d.get("solved", 0),
            "goal": goal,
            "grass": d.get("grass", 0),
            "star": d.get("star", 0),
        },
        "wallet": profile.get("wallet") or {},
        "week": {"rows": rows, "totals": week_totals(rows)},
        "totals": profile.get("totals") or {},
        "weak": weak_problems(facts, index, ref),
        "stock": stock_warning(facts, index, ref),
    }
