"""흰양이와 공부하기 — 서버 (Python 표준 라이브러리만)"""

import json
import os
import re
import socket
import sys
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import packs

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DATA = ROOT / "data"
CONTENT = ROOT / "content"
PROBLEMS = CONTENT / "problems"
PROFILES = DATA / "profiles"
BACKUPS = DATA / "backups"
SETTINGS_PATH = DATA / "settings.json"

ID_RE = re.compile(r"^[가-힣a-zA-Z0-9_-]{1,20}$")
MAX_BODY = 1024 * 1024
KEEP_BACKUPS = 30
DEFAULT_SETTINGS = {
    "parentPin": "0000", "speedModeEnabled": False, "defaultGoal": 20, "port": 8770,
    # 용돈 — 기본 꺼짐. 주 1회 정해진 요일에만 바꾼다.
    # 매일 환전되면 임금이 되고, 임금이 되면 놀이가 노동이 된다(원칙 2.5).
    "allowance": {"on": False, "per": 100, "won": 200, "day": 6, "max": 500},
}

def decode_path(raw):
    """브라우저는 퍼센트 인코딩으로, curl 등은 원문 바이트로 보낸다"""
    path = urlparse(raw).path.encode("latin-1", "replace").decode("utf-8", "replace")
    return unquote(path)


MIME = {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
    ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
    ".png": "image/png", ".ico": "image/x-icon",
}


# ── 파일 입출력 ──────────────────────────────────────────

def read_json(path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    """임시 파일에 쓰고 교체 — 중간에 PC가 꺼져도 파일이 깨지지 않는다"""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def load_packs():
    """요청마다 스캔한다 — 파일을 저장하면 서버를 껐다 켤 필요가 없다"""
    return packs.scan(PROBLEMS) if PROBLEMS.exists() else []


def load_messages():
    return packs.scan_messages(CONTENT / "messages.csv")


def load_wishes():
    """소원권 — 파일이 없으면 빈 목록. 그러면 아이 화면에 기능이 안 나타난다"""
    return packs.scan_wishes(CONTENT / "wishes.csv")


def load_settings():
    return {**DEFAULT_SETTINGS, **(read_json(SETTINGS_PATH) or {})}


# ── 프로필 ──────────────────────────────────────────────

def profile_path(pid):
    return PROFILES / f"{pid}.json"


def list_profiles():
    return [
        {"id": p.stem, "displayName": read_json(p)["displayName"]}
        for p in sorted(PROFILES.glob("*.json"))
    ]


def new_profile(pid, goal):
    today = str(date.today())
    return {
        "schemaVersion": 2,
        "id": pid,
        "displayName": pid,
        "createdAt": today,
        "characters": {
            "active": "sheep",
            "unlocked": ["sheep"],
            "names": {},
            "equipped": {"sheep": {"hat": None, "neck": None, "prop": None}},
        },
        "wallet": {"grass": 0, "star": 0},
        "inventory": {"items": [], "backgrounds": ["day"], "activeBackground": "day"},
        "facts": {},
        "daily": {"day": today, "solved": 0, "goal": goal, "speedRuns": 0},
        "totals": {"daysPlayed": 0, "solved": 0, "mastered": 0},
        "history": [],
        "collection": {"stickers": [], "boardsCompleted": 0},
        "records": {"speed": {}},
        "progress": {},   # 부모가 켠 단원 목록 {units: [...], deep: bool} (기획서 16.3)
        "gifts": [],      # 부모가 직접 준 풀·별 기록 (구현-현황 28.6)
        "shopTier": 1,
        "settings": {"goal": goal, "reduceMotion": False},
    }


def save_profile(pid, data):
    path = profile_path(pid)
    previous = read_json(path)
    if previous:
        backup_daily(pid, previous)
    write_json(path, data)


def backup_daily(pid, data):
    """하루 첫 저장에만 직전 상태를 남긴다"""
    path = BACKUPS / f"{pid}-{date.today()}.json"
    if path.exists():
        return
    write_json(path, data)
    for old in sorted(BACKUPS.glob(f"{pid}-*.json"))[:-KEEP_BACKUPS]:
        old.unlink()


# ── HTTP ────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = decode_path(self.path)
        if path == "/api/bootstrap":
            self.send_json({
                "profiles": list_profiles(),
                "settings": self.public_settings(),
                "packs": [{k: p[k] for k in ("id", "name", "subject", "unit", "order", "count", "deep")}
                          for p in load_packs() if p["count"]],
                "messages": load_messages()[0],
                "wishes": load_wishes()[0],
            })
        elif path.startswith("/api/pack/"):
            self.get_pack(path.rsplit("/", 1)[1])
        elif path == "/api/parent/packs":
            self.get_parent_packs()
        elif path.startswith("/api/profile/"):
            self.get_profile(path.rsplit("/", 1)[1])
        elif path.startswith("/api/"):
            self.send_error(404)
        else:
            self.serve_static(path)

    def do_POST(self):
        path = decode_path(self.path)
        if path == "/api/profile":
            self.create_profile()
        elif path.startswith("/api/profile/"):
            self.put_profile(path.rsplit("/", 1)[1])  # sendBeacon은 POST만 보낸다
        else:
            self.send_error(404)

    def do_PUT(self):
        path = decode_path(self.path)
        if path.startswith("/api/profile/"):
            self.put_profile(path.rsplit("/", 1)[1])
        elif path == "/api/parent/settings":
            self.put_settings()
        else:
            self.send_error(404)

    # ── 핸들러 ──

    def get_pack(self, pack_id):
        pack = next((p for p in load_packs() if p["id"] == pack_id), None)
        self.send_json({k: pack[k] for k in ("id", "name", "subject", "unit", "order", "problems")}) \
            if pack else self.send_error(404)

    def get_parent_packs(self):
        if not self.parent_ok():
            return self.send_json({"error": "PIN이 다릅니다"}, 403)
        wishes, wish_warnings = load_wishes()
        self.send_json({
            "packs": [{k: p[k] for k in ("id", "name", "subject", "unit", "order", "file", "count", "deep", "warnings")}
                      for p in load_packs()],
            "messages": {"file": "messages.csv", "warnings": load_messages()[1]},
            "wishes": {"file": "wishes.csv", "list": wishes, "warnings": wish_warnings},
        })

    def get_profile(self, pid):
        data = read_json(profile_path(pid)) if ID_RE.match(pid) else None
        self.send_json(data) if data else self.send_error(404)

    def create_profile(self):
        pid = (self.read_body().get("id") or "").strip()
        if not ID_RE.match(pid) or profile_path(pid).exists():
            return self.send_json({"error": "이름을 쓸 수 없습니다"}, 400)
        data = new_profile(pid, load_settings()["defaultGoal"])
        write_json(profile_path(pid), data)
        self.send_json(data, 201)

    def put_profile(self, pid):
        if not ID_RE.match(pid):
            return self.send_error(400)
        save_profile(pid, self.read_body())
        self.send_json({"saved": True})

    def put_settings(self):
        if not self.parent_ok():
            return self.send_json({"error": "PIN이 다릅니다"}, 403)
        write_json(SETTINGS_PATH, {**load_settings(), **self.read_body()})
        self.send_json({"saved": True})

    def serve_static(self, path):
        rel = {"/": "index.html", "/parent": "parent.html"}.get(path, path.lstrip("/"))
        target = (WEB / rel).resolve()
        if WEB not in target.parents or not target.is_file():
            return self.send_error(404)
        self.send_bytes(200, MIME.get(target.suffix, "application/octet-stream"), target.read_bytes())

    # ── 유틸 ──

    def parent_ok(self):
        return self.headers.get("X-Parent-Pin") == load_settings()["parentPin"]

    def public_settings(self):
        """아이 화면으로 나가는 것만 골라 담는다. 전개(**s)로 바꾸지 말 것 —
           나중에 API 키 같은 것이 들어오면 그날 바로 새어 나간다."""
        s = load_settings()
        return {
            "speedModeEnabled": s["speedModeEnabled"],
            "defaultGoal": s["defaultGoal"],
            "allowance": {**DEFAULT_SETTINGS["allowance"], **(s.get("allowance") or {})},
        }

    def read_body(self):
        length = min(int(self.headers.get("Content-Length") or 0), MAX_BODY)
        return json.loads(self.rfile.read(length) or b"{}")

    TEXTY = ("text/", "application/json", "application/manifest+json", "image/svg+xml")

    def send_bytes(self, code, ctype, body):
        self.send_response(code)
        # 아이콘 같은 이진 파일에 charset을 붙이면 안 된다
        texty = any(ctype.startswith(k) for k in self.TEXTY)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8" if texty else ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, data, code=200):
        self.send_bytes(code, "application/json", json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, *args):
        pass  # 부모 화면(콘솔)을 접속 주소만 보이게 유지


# ── 실행 ────────────────────────────────────────────────

def local_ips():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))  # 실제 전송 없음
    primary = s.getsockname()[0]
    s.close()
    others = [ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")]
    return list(dict.fromkeys([primary] + others))


def print_banner(port):
    line = "─" * 44
    print(f"\n{line}\n  흰양이와 공부하기가 켜졌습니다\n")
    print("  아이패드에서 아래 주소로 들어가세요")
    for ip in local_ips():
        print(f"      http://{ip}:{port}")
    print(f"\n  부모 화면\n      http://{local_ips()[0]}:{port}/parent")
    print(f"\n  끄려면 이 창에서 Ctrl+C\n{line}\n")


def main():
    PROFILES.mkdir(parents=True, exist_ok=True)
    BACKUPS.mkdir(parents=True, exist_ok=True)
    if not SETTINGS_PATH.exists():
        write_json(SETTINGS_PATH, DEFAULT_SETTINGS)

    port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else load_settings()["port"]
    print_banner(port)

    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  껐습니다. 내일 또 만나요.\n")


if __name__ == "__main__":
    main()
