/* 배경과 소원권 검사 — node test/t_wish.mjs

   `backgrounds.js`는 그대로 import하고, `app.js`에서는 별을 쓰는 두 함수만 떼어
   바깥 것들을 가짜로 채워 넣습니다.

   가장 중요한 것은 **받은 소원권이 목록에서 사라지지 않는 것**입니다.
   사라지는 것은 회수처럼 느껴집니다 (기획서 원칙 2.1). */

import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'gugudan-wish-'));
writeFileSync(join(tmp, 'backgrounds.mjs'), readFileSync(new URL('../web/backgrounds.js', import.meta.url)));
const B = await import('file://' + join(tmp, 'backgrounds.mjs'));

const SRC = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
function grab(name) {
  const at = SRC.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`app.js에 ${name}()가 없습니다`);
  let depth = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}' && --depth === 0) return SRC.slice(at, i + 1);
  }
}

let P = null, WISHES = [], toasts = [];
const noop = () => {};
const body = ['useWish', 'pickBG'].map(grab).join('\n');
const app = new Function(
  'getWISHES', 'getP', 'bgById', 'toast', 'save', 'renderWishes', 'renderShop', 'bind', 'today', 'say', `
  ${body.replace(/\bP\./g, 'getP().').replace(/\bWISHES\b/g, 'getWISHES()')}
  return { useWish, pickBG };
`)(() => WISHES, () => P, B.bgById, m => toasts.push(m), noop, noop, noop, noop, () => '2026-09-01', () => '');

let pass = 0, fail = 0;
const ok = (name, cond) => cond ? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

const profile = (star = 0, wishes = [], bgs = ['day'], active = 'day') => ({
  wallet: { grass: 0, star },
  wishes,
  inventory: { items: [], backgrounds: bgs, activeBackground: active },
});

/* ── 배경 데이터 ── */
group('배경 데이터 (기획서 8.5)');

ok('11종 (무료 1 + 별 10)', B.BACKGROUNDS.length === 11);
ok('무료는 하나뿐', B.BACKGROUNDS.filter(b => !b.star).length === 1);
ok('첫 칸이 무료이고 저절로 바뀜', B.BACKGROUNDS[0].star === 0 && B.BACKGROUNDS[0].auto);
ok('별 합계 83', B.BACKGROUNDS.reduce((s, b) => s + b.star, 0) === 83);
ok('값은 5~12', B.BACKGROUNDS.filter(b => b.star).every(b => b.star >= 5 && b.star <= 12));
ok('id 중복 없음', new Set(B.BACKGROUNDS.map(b => b.id)).size === 11);
ok('산 배경은 색 세 가지가 다 있음',
  B.BACKGROUNDS.filter(b => !b.auto).every(b => /^#[0-9A-F]{6}$/i.test(b.sky) &&
    /^#[0-9A-F]{6}$/i.test(b.deep) && /^#[0-9A-F]{6}$/i.test(b.onpage)));

/* ── 무료 배경은 저절로 바뀐다 ── */
group('무료 배경 — 계절과 시간');

const looks = [];
for (const mo of [1, 4, 7, 10]) for (const h of [3, 7, 12, 18, 21])
  looks.push(B.autoLook(new Date(2026, mo - 1, 15, h)));
ok('언제 봐도 색 세 가지가 다 나옴',
  looks.every(l => l.sky && l.deep && l.onpage));
ok('시간대가 다르면 색도 다름',
  B.autoLook(new Date(2026, 3, 15, 12)).sky !== B.autoLook(new Date(2026, 3, 15, 21)).sky);
ok('계절이 다르면 낮 색도 다름',
  B.autoLook(new Date(2026, 3, 15, 12)).sky !== B.autoLook(new Date(2026, 9, 15, 12)).sky);
ok('lookOf가 무료 배경을 계산해 줌', B.lookOf('day', new Date(2026, 3, 15, 21)).sky === B.autoLook(new Date(2026, 3, 15, 21)).sky);
ok('lookOf가 산 배경은 그대로 줌', B.lookOf('night').sky === B.bgById('night').sky);
ok('모르는 id는 무료 배경으로', B.bgById('없는배경').id === 'day');

/* ── 장식 ── */
group('장식');
ok('있는 것만 그린다', B.decoSVG('night').length > 100 && B.decoSVG('없음') === '');
ok('장식이 붙은 배경은 전부 그려짐',
  B.BACKGROUNDS.filter(b => b.deco).every(b => B.decoSVG(b.deco).length > 100));
ok('장식은 고정 배치 (다시 불러도 같음)', B.decoSVG('snow') === B.decoSVG('snow'));

/* ── 배경 사기 ── */
group('배경 사기');

P = profile(3);
toasts = [];
app.pickBG('night');
ok('별이 모자라면 안 사짐', !P.inventory.backgrounds.includes('night') && P.wallet.star === 3);
ok('얼마 더 필요한지 알려줌', toasts[0].includes('3개'));

P = profile(10);
app.pickBG('night');
ok('사면 별이 빠지고 목록에 들어감',
  P.wallet.star === 4 && P.inventory.backgrounds.includes('night'));
ok('사면 바로 그 배경이 됨', P.inventory.activeBackground === 'night');

app.pickBG('day');
ok('가진 배경으로 바꾸는 건 공짜', P.wallet.star === 4 && P.inventory.activeBackground === 'day');
app.pickBG('night');
ok('다시 바꿔도 또 안 냄', P.wallet.star === 4);

/* ── 소원권 ── */
group('소원권');

WISHES = [
  { id: 'w2', nm: '아이스크림', star: 8, note: '' },
  { id: 'w9', nm: '영화 보기', star: 20, note: '팝콘도' },
];

P = profile(5);
toasts = [];
app.useWish('w2');
ok('별이 모자라면 안 바뀜', !P.wishes.length && P.wallet.star === 5);

P = profile(30);
app.useWish('w2');
ok('바꾸면 별이 빠짐', P.wallet.star === 22);
ok('목록에 남음', P.wishes.length === 1 && P.wishes[0].nm === '아이스크림');
ok('날짜가 적힘', P.wishes[0].day === '2026-09-01');

app.useWish('w2');
ok('같은 소원을 또 바꿀 수 있음', P.wishes.length === 2 && P.wallet.star === 14);

app.useWish('없는소원');
ok('없는 소원은 조용히 무시', P.wishes.length === 2 && P.wallet.star === 14);

/* ── 받은 소원권은 사라지지 않는다 ── */
group('받은 소원권은 사라지지 않는다 — 사라지는 것은 회수처럼 느껴집니다');

const before = P.wishes.length;
app.useWish('w9');   // 별 14 < 20 이라 실패
ok('못 바꿔도 이미 받은 것은 그대로', P.wishes.length === before);
ok('app.js에 소원권을 지우는 코드가 없다',
  !/wishes\s*\.\s*(splice|shift|pop|filter)/.test(SRC) && !/wishes\s*=\s*\[\]/.test(SRC.replace(/wishes \|\|= \[\]/g, '')));

/* ── 파일 파서 (python) ── */
group('wishes.csv 파서');

const py = code => execFileSync('python3', ['-c', code],
  { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim();

ok('파일이 없으면 빈 목록 — 기능이 안 나타난다',
  py(`import packs,pathlib;print(packs.scan_wishes(pathlib.Path('content/없는파일.csv')))`) === '([], [])');
ok('예시 파일이 읽힘',
  Number(py(`import packs,pathlib;print(len(packs.scan_wishes(pathlib.Path('content/wishes.csv'))[0]))`)) > 0);
ok('별이 숫자가 아닌 줄만 건너뛴다',
  py(`
import packs, pathlib, tempfile, os
p = pathlib.Path(tempfile.mkdtemp()) / 'w.csv'
p.write_text('소원,별\\n좋은거,10\\n망가진거,없음\\n또좋은거,5\\n', encoding='utf-8')
out, warn = packs.scan_wishes(p)
print(len(out), len(warn))`) === '2 1');

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
