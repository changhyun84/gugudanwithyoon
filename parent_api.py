# -*- coding: utf-8 -*-
"""
5A 에서 늘어나는 부모 API 3개.

server.py 를 크게 고치지 않으려고 분리했습니다. server.py 에서는
PIN 을 확인한 뒤 handle() 에 넘기기만 하면 됩니다. 적용 방법은 5A-적용안내.md.

ctx 는 server.py / packs.py 의 실제 함수 이름을 모르기 위해 두는 어댑터입니다:

    ctx = {
        "data_dir":      "data",
        "all_packs":     lambda: [...],      # 꺼진 것 포함 전체
        "list_profiles": lambda: ["지우"],
        "load_profile":  lambda pid: {...},
    }

all_packs() 가 돌려주는 팩 하나의 모양:

    {"id": "3학년-나눗셈", "name": "3학년 나눗셈",
     "problems": [{"text": "24 ÷ 6", "answer": "4", "hint": "...",
                   "wrongs": ["3","5","8"], "group": "나눗셈"}, ...]}

wrongs 가 부모가 직접 적은 값인지 자동 생성인지 구분이 필요합니다.
packs.py 가 그 구분을 안 갖고 있으면 파서에 'customWrongs' 불리언을 하나 추가하세요.
"""

import json

import disabled as dis
import stats


# ---------------------------------------------------------------- 색인


def build_index(packs, only_active=None):
    """{문제키: 메타} 전체 색인. 부모 화면과 통계가 같이 씁니다."""
    index = {}
    for pack in packs:
        pid = pack.get("id")
        for p in pack.get("problems", []):
            key = dis.problem_key(pid, p.get("text", ""))
            if only_active is not None and key not in only_active:
                continue
            index[key] = {
                "pack": pid,
                "packName": pack.get("name") or pid,
                "text": p.get("text"),
                "answer": p.get("answer"),
                "group": p.get("group") or "",
                "hint": bool(p.get("hint")),
                "customWrongs": bool(p.get("customWrongs") or p.get("wrongs")),
            }
    return index


def active_index(packs, d):
    """꺼진 것을 뺀 색인. 재고 경고는 이걸 기준으로 세야 맞습니다."""
    keys = set()
    for pack in packs:
        pid = pack.get("id")
        if dis.pack_off(d, pid):
            continue
        for p in dis.filter_problems(d, pid, pack.get("problems", [])):
            keys.add(dis.problem_key(pid, p.get("text", "")))
    return build_index(packs, only_active=keys)


# ---------------------------------------------------------------- 라우트


def _summary(ctx):
    packs = ctx["all_packs"]()
    d = dis.load(ctx["data_dir"])
    index = active_index(packs, d)

    out = []
    for pid in ctx["list_profiles"]():
        try:
            profile = ctx["load_profile"](pid)
        except Exception:
            continue
        if profile:
            out.append(stats.build_summary(profile, index))

    # 팩 목록도 같이 내려줍니다. 부모 화면이 기존 /api/parent/packs 응답 모양에
    # 의존하지 않게 하려는 것입니다.
    pack_rows = []
    for pack in packs:
        h = dis.pack_health(d, pack.get("id"), pack.get("problems", []))
        pack_rows.append({
            "id": pack.get("id"),
            "name": pack.get("name") or pack.get("id"),
            "enabled": not dis.pack_off(d, pack.get("id")),
            "active": h["active"],
            "total": h["total"],
            "level": h["level"],
            "message": h["message"],
        })

    return 200, {"profiles": out, "packs": pack_rows}


def _pack_detail(ctx, pack_id, profile_id=None):
    packs = ctx["all_packs"]()
    pack = next((p for p in packs if p.get("id") == pack_id), None)
    if pack is None:
        return 404, {"error": "그런 팩이 없습니다: %s" % pack_id}

    d = dis.load(ctx["data_dir"])
    off = set(d.get("problems", []))

    ids = ctx["list_profiles"]()
    if profile_id not in ids:
        profile_id = ids[0] if ids else None
    facts = {}
    if profile_id:
        try:
            facts = (ctx["load_profile"](profile_id) or {}).get("facts") or {}
        except Exception:
            facts = {}

    rows = []
    for p in pack.get("problems", []):
        key = dis.problem_key(pack_id, p.get("text", ""))
        f = facts.get(key) or {}
        c = stats.parse_log(f.get("log"))
        rows.append({
            "key": key,
            "text": p.get("text"),
            "answer": p.get("answer"),
            "group": p.get("group") or "",
            "hint": bool(p.get("hint")),
            "customWrongs": bool(p.get("customWrongs") or p.get("wrongs")),
            "enabled": key not in off,
            "m": f.get("m", 0),
            "seen": f.get("seen", 0),
            "recent": c["recent"],
            "action": stats.action_hint(
                {"hint": bool(p.get("hint")),
                 "customWrongs": bool(p.get("customWrongs") or p.get("wrongs"))}, c)
            if stats.weakness(c) > 0 else "",
        })

    known = set()
    for pk in packs:
        for p in pk.get("problems", []):
            known.add(dis.problem_key(pk.get("id"), p.get("text", "")))

    return 200, {
        "id": pack_id,
        "name": pack.get("name") or pack_id,
        "packEnabled": not dis.pack_off(d, pack_id),
        "profile": profile_id,
        "profiles": ids,
        "problems": rows,
        "health": dis.pack_health(d, pack_id, pack.get("problems", [])),
        "orphans": dis.orphans(d, known, [pk.get("id") for pk in packs]),
    }


def _save_disabled(ctx, body):
    if not isinstance(body, dict):
        return 400, {"error": "형식이 올바르지 않습니다."}
    saved = dis.save(ctx["data_dir"], {
        "problems": body.get("problems") or [],
        "packs": body.get("packs") or [],
    })
    return 200, {"ok": True, "disabled": saved}


def _prune(ctx):
    packs = ctx["all_packs"]()
    known, pids = set(), []
    for pk in packs:
        pids.append(pk.get("id"))
        for p in pk.get("problems", []):
            known.add(dis.problem_key(pk.get("id"), p.get("text", "")))
    cleaned = dis.prune(dis.load(ctx["data_dir"]), known, pids)
    return 200, {"ok": True, "disabled": dis.save(ctx["data_dir"], cleaned)}


# ---------------------------------------------------------------- 진입점


def handle(method, path, query, body, ctx):
    """우리 것이 아니면 None 을 돌려줍니다. PIN 확인은 server.py 몫입니다."""
    if path == "/api/parent/summary" and method == "GET":
        return _summary(ctx)

    if path.startswith("/api/parent/pack/") and method == "GET":
        pack_id = path[len("/api/parent/pack/"):]
        return _pack_detail(ctx, pack_id, (query or {}).get("profile"))

    if path == "/api/parent/disabled":
        if method == "GET":
            return 200, dis.load(ctx["data_dir"])
        if method == "PUT":
            return _save_disabled(ctx, body)

    if path == "/api/parent/prune" and method == "POST":
        return _prune(ctx)

    return None
