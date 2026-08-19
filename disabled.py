# -*- coding: utf-8 -*-
"""
문제/팩 켜고 끄기.  data/disabled.json 을 읽고 씁니다.
표준 라이브러리만 씁니다.

핵심 규칙 (5A 작업지시 2.3):
    끄기는 '앞으로 출제되지 않는다'는 뜻일 뿐입니다.
    별·스티커·마스터 수·해금은 이 모듈이 절대 건드리지 않습니다.
    이 파일에 profile 을 수정하는 코드가 있으면 잘못된 것입니다.
"""

import json
import os
import re

FILENAME = "disabled.json"

# 팩이 게임에 나오려면 최소 이만큼 남아야 합니다.
MIN_POOL = 8   # engine.js 의 MIN_POOL 과 같은 값 (구현-현황 2.7)
MIN_GROUP = 4  # 글자 정답의 오답 보기를 뽑으려면 같은 묶음에 4개 (구현-현황 2.2)


# ---------------------------------------------------------------- 문제 키

_WS = re.compile(r"\s+")


def problem_key(pack_id, text):
    """설계서 5.4 / 구현-현황 3장.  {팩id}:{공백 제거한 문제 텍스트}

    packs.py 에 이미 같은 일을 하는 함수가 있으면 그것을 쓰세요.
    두 곳에서 다르게 정규화하면 키가 어긋나 진도가 날아갑니다.
    """
    return "%s:%s" % (pack_id, _WS.sub("", str(text)))


# ---------------------------------------------------------------- 읽기/쓰기


def _path(data_dir):
    return os.path.join(data_dir, FILENAME)


def load(data_dir):
    """없거나 깨졌으면 빈 값으로 돌려줍니다. 여기서 예외를 올리면 게임이 멈춥니다."""
    try:
        with open(_path(data_dir), "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (IOError, OSError, ValueError):
        return {"problems": [], "packs": []}

    if not isinstance(raw, dict):
        return {"problems": [], "packs": []}

    def _list(v):
        return [str(x) for x in v] if isinstance(v, list) else []

    return {"problems": _list(raw.get("problems")), "packs": _list(raw.get("packs"))}


def save(data_dir, d):
    """원자적 쓰기 (설계서 3.4). 중간에 PC가 꺼져도 파일이 깨지지 않습니다."""
    os.makedirs(data_dir, exist_ok=True)
    out = {
        "problems": sorted(set(str(x) for x in d.get("problems", []))),
        "packs": sorted(set(str(x) for x in d.get("packs", []))),
    }
    tmp = _path(data_dir) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, _path(data_dir))
    return out


# ---------------------------------------------------------------- 판정


def pack_off(d, pack_id):
    return pack_id in set(d.get("packs", []))


def problem_off(d, key):
    return key in set(d.get("problems", []))


def filter_problems(d, pack_id, problems):
    """아이에게 내보낼 문제만 남깁니다.

    problems 는 packs.py 가 만든 dict 리스트이고 'text' 키를 가진다고 가정합니다.
    (키 이름이 다르면 아래 한 줄만 고치세요)
    """
    if pack_off(d, pack_id):
        return []
    off = set(d.get("problems", []))
    return [p for p in problems if problem_key(pack_id, p.get("text", "")) not in off]


def filter_packs(d, packs):
    """/api/bootstrap 용.  꺼진 팩을 빼고, 남은 팩의 문제 수를 실제 값으로 고칩니다."""
    out = []
    for pack in packs:
        pid = pack.get("id")
        if pack_off(d, pid):
            continue
        kept = filter_problems(d, pid, pack.get("problems", []))
        if len(kept) < MIN_GROUP:
            # 오답 보기를 만들 수 없는 팩은 아예 내보내지 않습니다.
            # 아이 화면에 오류를 노출하지 않기 위해 조용히 뺍니다 (설계서 5.5).
            continue
        meta = dict(pack)
        meta["problems"] = kept
        meta["count"] = len(kept)
        out.append(meta)
    return out


# ---------------------------------------------------------------- 상태 점검


def pack_health(d, pack_id, problems):
    """부모 화면에 보여줄 경고. 끄는 순간 계산해서 되돌려줍니다."""
    off = set(d.get("problems", []))
    active = [p for p in problems if problem_key(pack_id, p.get("text", "")) not in off]

    groups = {}
    for p in active:
        g = (p.get("group") or "").strip()
        if g:
            groups[g] = groups.get(g, 0) + 1

    thin = sorted(g for g, n in groups.items() if n < MIN_GROUP)

    n = len(active)
    if pack_off(d, pack_id):
        level, msg = "off", "이 팩 전체가 꺼져 있습니다."
    elif n < MIN_GROUP:
        level, msg = "bad", "남은 문제가 %d개라 이 팩은 게임에 나오지 않습니다." % n
    elif n < MIN_POOL:
        level, msg = "warn", "남은 문제가 %d개라 같은 문제가 자주 반복될 수 있습니다." % n
    else:
        level, msg = "ok", ""

    if level in ("ok", "warn") and thin:
        level = "warn" if level == "ok" else level
        msg = (msg + " " if msg else "") + \
            "묶음 '%s'에 %d개 미만이 남아 글자 문제가 빠질 수 있습니다." % (
                ", ".join(thin), MIN_GROUP)

    return {
        "level": level,
        "message": msg.strip(),
        "active": n,
        "total": len(problems),
        "thinGroups": thin,
        "groups": groups,
    }


# ---------------------------------------------------------------- 고아 항목


def orphans(d, known_keys, known_pack_ids):
    """문제 텍스트를 고치면 키가 바뀌어 목록에 남는 항목들.

    자동 삭제하지 않습니다. 파일을 잠깐 옮겼을 뿐인데 설정이 날아가면 안 됩니다.
    """
    known = set(known_keys)
    packs = set(known_pack_ids)
    return {
        "problems": sorted(k for k in d.get("problems", []) if k not in known),
        "packs": sorted(p for p in d.get("packs", []) if p not in packs),
    }


def prune(d, known_keys, known_pack_ids):
    """부모가 [정리] 를 눌렀을 때만 호출합니다."""
    known = set(known_keys)
    packs = set(known_pack_ids)
    return {
        "problems": [k for k in d.get("problems", []) if k in known],
        "packs": [p for p in d.get("packs", []) if p in packs],
    }
