"""정적 배포 만들기 — python3 sim/build-static.py

   `web/`과 `content/`를 합쳐 `dist/`를 만듭니다. GitHub Pages는 정적 파일만 서빙하므로
   서버가 하던 일 가운데 **프로필 저장만** 브라우저(localStorage)로 옮기고,
   나머지(팩·메시지·소원권·설정)는 여기서 미리 JSON으로 구워둡니다.

   `web/`은 건드리지 않습니다. 집 서버는 지금 그대로 돕니다."""

import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import packs                                    # noqa: E402
import server                                   # noqa: E402

DIST = ROOT / 'dist'
FLAG = '<script>window.GUGUDAN_STATIC = true;</script>'


def build_content():
    """서버의 /api/* 응답을 한 파일에 미리 담는다."""
    scanned = packs.scan(ROOT / 'content' / 'problems')
    messages, msg_warn = packs.scan_messages(ROOT / 'content' / 'messages.csv')
    wishes, wish_warn = packs.scan_wishes(ROOT / 'content' / 'wishes.csv')

    return {
        'builtAt': str(date.today()),
        # 문제가 없는 팩은 아이 화면에 안 보내지만, 부모 화면은 경고를 봐야 하므로 다 싣는다
        'packs': [{k: p[k] for k in
                   ('id', 'name', 'subject', 'unit', 'order', 'file', 'count', 'problems', 'warnings')}
                  for p in scanned],
        'messages': messages,
        'messageWarnings': msg_warn,
        'wishes': wishes,
        'wishWarnings': wish_warn,
        'settings': {k: server.DEFAULT_SETTINGS[k]
                     for k in ('speedModeEnabled', 'defaultGoal', 'allowance')},
        # 새 프로필의 모양은 server.py가 정한다. 두 곳에 두면 반드시 어긋난다.
        'newProfile': server.new_profile('', server.DEFAULT_SETTINGS['defaultGoal']),
    }


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / 'web', DIST)

    content = build_content()
    (DIST / 'content.json').write_text(
        json.dumps(content, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # GitHub Pages는 https://아이디.github.io/저장소/ 아래에 올라간다.
    # 절대 경로(/app.js)는 도메인 뿌리를 가리켜 전부 깨진다. 상대 경로로 바꾼다.
    for name in ('index.html', 'parent.html'):
        path = DIST / name
        html = path.read_text(encoding='utf-8')
        assert FLAG not in html
        html = re.sub(r'(href|src)="/(?!/)', r'\1="./', html)
        html = html.replace("from '/", "from './")
        html = html.replace('</head>', f'{FLAG}\n</head>', 1)
        path.write_text(html, encoding='utf-8')

    mf = json.loads((DIST / 'manifest.json').read_text(encoding='utf-8'))
    mf['start_url'] = './'
    mf['scope'] = './'
    for icon in mf['icons']:
        icon['src'] = '.' + icon['src']
    (DIST / 'manifest.json').write_text(json.dumps(mf, ensure_ascii=False, indent=2), encoding='utf-8')

    # GitHub Pages가 _로 시작하는 경로를 Jekyll로 처리하지 않게
    (DIST / '.nojekyll').write_text('', encoding='utf-8')

    # 404는 자산을 안 부르는 한 장짜리로. 상대 경로가 어디서 걸릴지 모르기 때문이다.
    (DIST / '404.html').write_text(
        '<!doctype html><html lang="ko"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>양이랑 구구단</title>'
        '<body style="margin:0;display:grid;place-items:center;min-height:100vh;'
        'background:#E9F2EA;color:#33453A;font-family:sans-serif;text-align:center">'
        '<div><p style="font-size:20px">여기는 아무것도 없어</p>'
        '<p><a href="./" style="color:#527B34">목장으로 돌아가기</a></p></div>',
        encoding='utf-8')

    size = sum(f.stat().st_size for f in DIST.rglob('*') if f.is_file())
    problems = sum(p['count'] for p in content['packs'])
    warn = sum(len(p['warnings']) for p in content['packs']) + len(content['messageWarnings'])
    print(f'  dist/  파일 {len(list(DIST.rglob("*")))}개 · {size/1024:.0f}KB')
    print(f'  문제 {problems}개 · 팩 {len(content["packs"])}개 · 소원권 {len(content["wishes"])}개 · 경고 {warn}개')
    if warn:
        print('  ⚠ 경고가 있습니다. 부모 화면에서 확인하세요.')


if __name__ == '__main__':
    main()
