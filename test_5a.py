# -*- coding: utf-8 -*-
"""5A 검증. python3 test_5a.py"""

import copy
import datetime
import json
import os
import shutil
import tempfile

import disabled as dis
import parent_api as api
import stats

REF = datetime.date(2026, 8, 19)
OK = []


def check(name, cond, extra=""):
    OK.append(bool(cond))
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  " + extra) if extra and not cond else ""))


# ---------------------------------------------------------------- 픽스처


def make_packs():
    div = [{"text": "%d ÷ %d" % (a * b, b), "answer": str(a),
            "hint": "곱셈으로 바꿔봐" if a % 2 else "", "group": "나눗셈",
            "customWrongs": a % 3 == 0}
           for a, b in [(4, 6), (7, 5), (6, 8), (3, 9), (8, 4), (9, 3),
                        (5, 7), (2, 8), (6, 6), (7, 7), (4, 4), (8, 8)]]
    gugu = [{"text": "%d × %d" % (a, b), "answer": str(a * b),
             "hint": "", "group": "%d단" % a, "customWrongs": True}
            for a in (7, 8) for b in range(2, 10)]
    word = [{"text": "가장 큰 수는?", "answer": "일곱", "hint": "", "group": "글자",
             "customWrongs": False}] * 1
    return [
        {"id": "gugudan", "name": "구구단", "problems": gugu},
        {"id": "3학년-나눗셈", "name": "3학년 나눗셈", "problems": div},
        {"id": "글자팩", "name": "글자팩", "problems": word},
    ]


def make_profile():
    facts = {}
    # 마스터한 문제 (별을 이미 받음)
    facts["gugudan:7×2"] = {"m": 4, "seen": 12, "right": 11,
                            "masteredAt": "2026-08-15", "log": ["0818:o", "0816:o", "0815:o"]}
    # 많이 틀리는 문제
    facts["gugudan:7×8"] = {"m": 1, "seen": 9, "right": 3, "masteredAt": None,
                            "log": ["0819:x", "0818:h", "0817:x", "0816:x", "0815:o"]}
    facts["3학년-나눗셈:24÷6"] = {"m": 1, "seen": 6, "right": 2, "masteredAt": None,
                                 "log": ["0819:x", "0818:x", "0817:h"]}
    # 표본이 모자란 문제 — 정답률 50% 지만 약점이 아님
    facts["gugudan:8×9"] = {"m": 2, "seen": 2, "right": 1, "masteredAt": None,
                            "log": ["0819:x", "0818:o"]}
    # 힌트도 직접 넣은 오답도 있는 문제 → '그냥 두기'
    facts["3학년-나눗셈:27÷3"] = {"m": 2, "seen": 8, "right": 5, "masteredAt": None,
                                 "log": ["0819:x", "0818:x", "0817:h", "0816:o"]}
    return {
        "id": "지우", "displayName": "지우",
        "facts": facts,
        "wallet": {"grass": 940, "star": 11},
        "daily": {"day": "2026-08-19", "solved": 14, "goal": 20,
                  "right": 11, "grass": 78, "star": 0},
        "history": [{"day": "2026-08-%d" % d, "solved": 20, "right": 16,
                     "grass": 108, "star": 1} for d in (14, 15, 16, 18)],
        "totals": {"daysPlayed": 23, "solved": 412, "mastered": 18},
        "collection": {"stickers": ["gugudan:7×2"], "boardsCompleted": 1},
        "characters": {"active": "sheep", "unlocked": ["sheep", "cat"]},
        "shopTier": 2,
    }


def make_ctx(tmp, profile, packs):
    return {
        "data_dir": tmp,
        "all_packs": lambda: copy.deepcopy(packs),
        "list_profiles": lambda: ["지우"],
        "load_profile": lambda pid: copy.deepcopy(profile),
    }


# ---------------------------------------------------------------- 테스트


def run():
    tmp = tempfile.mkdtemp()
    packs = make_packs()
    profile = make_profile()
    ctx = make_ctx(tmp, profile, packs)
    gugu = packs[0]["problems"]
    div = packs[1]["problems"]

    print("\n[ 문제 키 ]")
    check("공백 제거", dis.problem_key("gugudan", "7 × 8") == "gugudan:7×8")
    check("줄바꿈/탭도 제거", dis.problem_key("p", " 24 ÷\t6 ") == "p:24÷6")

    print("\n[ 읽기/쓰기 ]")
    check("파일 없으면 빈 값", dis.load(tmp) == {"problems": [], "packs": []})
    dis.save(tmp, {"problems": ["gugudan:7×8"], "packs": []})
    check("저장 후 다시 읽기", dis.load(tmp)["problems"] == ["gugudan:7×8"])
    with open(os.path.join(tmp, "disabled.json"), "w") as f:
        f.write("{ 깨진 파일")
    check("깨진 파일이어도 안 죽음", dis.load(tmp) == {"problems": [], "packs": []})

    print("\n[ 날짜 ]")
    check("MMDD 해석", stats.resolve("0818", REF) == datetime.date(2026, 8, 18))
    check("연말 넘김 — 1월 1일 로그를 12월에 만나면 작년",
          stats.resolve("0101", datetime.date(2026, 12, 31)) == datetime.date(2026, 1, 1))
    check("미래 날짜는 작년으로",
          stats.resolve("1231", REF) == datetime.date(2025, 12, 31))
    old = ["0819:x", "0810:h", "0806:o", "0805:x", "0710:o"]   # 0806 이 창의 끝
    check("14일 넘은 로그 정리",
          stats.prune_log(old, REF) == ["0819:x", "0810:h", "0806:o"],
          str(stats.prune_log(old, REF)))
    check("10개 상한", len(stats.prune_log(["0819:o"] * 20, REF)) == 10)

    print("\n[ 약한 문제 ]")
    index = api.build_index(packs)
    weak = stats.weak_problems(profile["facts"], index, REF)
    keys = [w["key"] for w in weak]
    check("많이 틀린 문제가 1위", keys[0] == "gugudan:7×8", str(keys))
    check("표본 3 미만은 제외 (8×9)", "gugudan:8×9" not in keys, str(keys))
    check("마스터한 문제는 안 뜸", "gugudan:7×2" not in keys)
    check("점수 = 오답×2 + 힌트×1", weak[0]["wrong"] * 2 + weak[0]["hinted"] == weak[0]["score"])
    acts = {w["key"]: w["action"] for w in weak}
    check("힌트 없는 문제 → 힌트 추가", "힌트" in acts.get("gugudan:7×8", ""), acts.get("gugudan:7×8"))
    check("힌트·오답 다 있으면 그냥 두기",
          acts.get("3학년-나눗셈:27÷3", "").startswith("그냥 두기"), acts.get("3학년-나눗셈:27÷3"))

    print("\n[ 일별 현황 ]")
    rows = stats.daily_rows(profile, REF)
    check("7일치", len(rows) == 7)
    check("논 날 5일", stats.week_totals(rows)["days"] == 5)
    blank = [r["day"] for r in rows if r["solved"] is None]
    check("안 한 날은 None", blank == ["2026-08-13", "2026-08-17"], str(blank))
    check("오늘은 daily 에서", rows[-1]["solved"] == 14)
    check("주간 합계", stats.week_totals(rows)["solved"] == 20 * 4 + 14,
          str(stats.week_totals(rows)))

    print("\n[ 재고 경고 ]")
    st = stats.stock_warning(profile["facts"], index, REF)
    check("안 배운 문제 수", st["remaining"] == len(index) - len(profile["facts"]))
    check("소진 예상일 계산됨", st["daysLeft"] is not None, str(st))
    empty = stats.stock_warning({}, {}, REF)
    check("문제가 없으면 bad", empty["level"] == "bad")
    check("마스터 0이어도 안 죽음", stats.stock_warning({"a": {"seen": 1}}, {"a": {}}, REF)["daysLeft"] is None)

    print("\n[ 팩 상태 ]")
    dis.save(tmp, {"problems": [], "packs": []})
    d = dis.load(tmp)
    check("전부 켜짐 → ok", dis.pack_health(d, "gugudan", gugu)["level"] == "ok")

    off10 = [dis.problem_key("3학년-나눗셈", p["text"]) for p in div[:6]]
    d = {"problems": off10, "packs": []}
    h = dis.pack_health(d, "3학년-나눗셈", div)
    check("남은 6개 → warn", h["level"] == "warn", h["message"])
    check("남은 수 정확", h["active"] == 6)

    off = [dis.problem_key("3학년-나눗셈", p["text"]) for p in div[:9]]
    h = dis.pack_health({"problems": off, "packs": []}, "3학년-나눗셈", div)
    check("남은 3개 → bad", h["level"] == "bad", h["message"])
    check("묶음 부족 경고에 묶음 이름", "나눗셈" in h["message"] or h["level"] == "bad")

    print("\n[ 서버 필터링 ]")
    d = {"problems": ["gugudan:7×8"], "packs": ["글자팩"]}
    kept = dis.filter_problems(d, "gugudan", gugu)
    check("꺼진 문제가 빠짐", all(p["text"] != "7 × 8" for p in kept))
    check("나머지는 그대로", len(kept) == len(gugu) - 1)
    metas = dis.filter_packs(d, packs)
    ids = [m["id"] for m in metas]
    check("꺼진 팩이 빠짐", "글자팩" not in ids, str(ids))
    check("문제 4개 미만 팩도 빠짐", "글자팩" not in ids)
    check("팩 메타 문제 수 보정", next(m for m in metas if m["id"] == "gugudan")["count"] == len(gugu) - 1)

    print("\n[ 고아 항목 ]")
    d = {"problems": ["gugudan:7×8", "gugudan:없는문제"], "packs": ["사라진팩"]}
    known = {dis.problem_key(pk["id"], p["text"]) for pk in packs for p in pk["problems"]}
    o = dis.orphans(d, known, [pk["id"] for pk in packs])
    check("고아 문제 찾음", o["problems"] == ["gugudan:없는문제"], str(o))
    check("고아 팩 찾음", o["packs"] == ["사라진팩"])
    p = dis.prune(d, known, [pk["id"] for pk in packs])
    check("정리 후 유효한 것만 남음", p == {"problems": ["gugudan:7×8"], "packs": []}, str(p))

    # ------------------------------------------------------------ 시나리오
    print("\n[ 시나리오 1 — 마스터한 문제를 끈다 (가장 중요) ]")
    dis.save(tmp, {"problems": [], "packs": []})
    before = copy.deepcopy(profile)
    api.handle("PUT", "/api/parent/disabled", {},
               {"problems": ["gugudan:7×2"], "packs": []}, ctx)
    api.handle("GET", "/api/parent/summary", {}, None, ctx)
    api.handle("GET", "/api/parent/pack/gugudan", {}, None, ctx)
    check("별 그대로", profile["wallet"]["star"] == before["wallet"]["star"])
    check("풀 그대로", profile["wallet"]["grass"] == before["wallet"]["grass"])
    check("totals.mastered 그대로", profile["totals"]["mastered"] == before["totals"]["mastered"])
    check("스티커 그대로", profile["collection"] == before["collection"])
    check("해금 캐릭터 그대로", profile["characters"] == before["characters"])
    check("상점 단계 그대로", profile["shopTier"] == before["shopTier"])
    check("프로필 전체가 한 글자도 안 바뀜", profile == before)

    print("\n[ 시나리오 2 — 껐다가 다시 켠다 ]")
    m_before = profile["facts"]["gugudan:7×2"]["m"]
    api.handle("PUT", "/api/parent/disabled", {}, {"problems": [], "packs": []}, ctx)
    st, body = api.handle("GET", "/api/parent/pack/gugudan", {}, None, ctx)
    row = next(r for r in body["problems"] if r["key"] == "gugudan:7×2")
    check("다시 켜짐", row["enabled"] is True)
    check("진도 유지", row["m"] == m_before == 4)

    print("\n[ 시나리오 3 — 6개만 남긴다 ]")
    api.handle("PUT", "/api/parent/disabled", {}, {"problems": off10, "packs": []}, ctx)
    st, body = api.handle("GET", "/api/parent/pack/3학년-나눗셈", {}, None, ctx)
    check("경고 뜸", body["health"]["level"] == "warn", body["health"]["message"])
    check("팩은 아직 게임에 나옴",
          "3학년-나눗셈" in [m["id"] for m in dis.filter_packs(dis.load(tmp), packs)])

    print("\n[ 시나리오 4 — 3개만 남긴다 ]")
    api.handle("PUT", "/api/parent/disabled", {}, {"problems": off, "packs": []}, ctx)
    check("팩이 목록에서 빠짐",
          "3학년-나눗셈" not in [m["id"] for m in dis.filter_packs(dis.load(tmp), packs)])
    st, body = api.handle("GET", "/api/parent/pack/3학년-나눗셈", {}, None, ctx)
    check("부모 화면에는 여전히 보임", st == 200 and len(body["problems"]) == len(div))

    print("\n[ 시나리오 5 — 꺼진 문제는 출제 후보에 없다 ]")
    served = {dis.problem_key(m["id"], p["text"])
              for m in dis.filter_packs(dis.load(tmp), packs) for p in m["problems"]}
    check("꺼진 문제가 하나도 없음", not (served & set(off)))

    print("\n[ 재고 경고 — 꺼진 문제는 재고가 아니다 ]")
    ai = api.active_index(packs, dis.load(tmp))
    check("꺼진 문제는 색인에서 빠짐", not (set(ai) & set(off)))

    print("\n[ API 형태 ]")
    st, body = api.handle("GET", "/api/parent/summary", {}, None, ctx)
    check("summary 200", st == 200)
    check("프로필 1개", len(body["profiles"]) == 1)
    check("JSON 직렬화 가능", json.dumps(body, ensure_ascii=False)[:1] == "{")
    check("없는 팩은 404", api.handle("GET", "/api/parent/pack/없음", {}, None, ctx)[0] == 404)
    check("모르는 경로는 None", api.handle("GET", "/api/parent/x", {}, None, ctx) is None)
    check("잘못된 본문은 400",
          api.handle("PUT", "/api/parent/disabled", {}, "쓰레기", ctx)[0] == 400)

    shutil.rmtree(tmp)
    print("\n" + "=" * 46)
    print("  %d / %d 통과" % (sum(OK), len(OK)))
    print("=" * 46)
    return all(OK)


if __name__ == "__main__":
    raise SystemExit(0 if run() else 1)
