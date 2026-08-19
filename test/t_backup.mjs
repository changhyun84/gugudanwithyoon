/* 내보내기·되돌리기와 홈 화면 추가 검사 — node test/t_backup.mjs

   되돌리기는 **덮어쓰기**입니다. 잘못 누르면 아이가 몇 주 모은 별·아이템·도감이
   사라지고 다시 만들 수 없습니다. 이 파일은 그 앞을 지키는 검사들입니다. */

import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PARENT = readFileSync(new URL('../web/parent.html', import.meta.url), 'utf8');
const APP = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

/* parent.html의 순수 함수만 떼어낸다 */
function grab(src, name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${name}()이 없습니다`);
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
}
const back = new Function(`${['summarize', 'readBackup'].map(n => grab(PARENT, n)).join('\n')}
  return { summarize, readBackup };`)();

let pass = 0, fail = 0;
const ok = (name, cond) => cond ? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

const profile = (over = {}) => ({
  schemaVersion: 2, id: '지우', displayName: '지우', createdAt: '2026-03-02',
  wallet: { grass: 240, star: 11 }, facts: { 'gugudan:7x8': { m: 4 } },
  totals: { daysPlayed: 23, solved: 412, mastered: 18 },
  collection: { stickers: ['a', 'b', 'c'], boardsCompleted: 0 },
  inventory: { items: ['crown'], backgrounds: ['day'], activeBackground: 'day' },
  characters: { unlocked: ['sheep', 'cat'], active: 'sheep', names: {}, equipped: {} },
  ...over,
});

/* ── 무엇이 바뀌는지 먼저 보여준다 ── */
group('되돌리기 전에 무엇이 바뀌는지 보여준다');

const s = back.summarize(profile());
ok('이름·별·풀·마스터·스티커가 다 있다',
  s.이름 === '지우' && s.별 === 11 && s.풀 === 240 &&
  s['완전히 외운 것'] === 18 && s.스티커 === 3);
ok('아이템·친구 수도 보여준다', s.아이템 === 1 && s.친구 === 2);
ok('함께한 날도', s.함께한날 === '23일');
ok('빈 프로필도 죽지 않는다', back.summarize({}).별 === 0);
ok('null이면 null', back.summarize(null) === null);

/* ── 아무 파일이나 받으면 안 된다 ── */
group('엉뚱한 파일로 아이 기록을 덮어쓰면 되돌릴 수 없다');

ok('올바른 기록은 통과', !!back.readBackup(JSON.stringify(profile())).data);
ok('JSON이 아니면 거절', !!back.readBackup('그냥 글자').error);
ok('빈 값도 거절', !!back.readBackup('null').error);
ok('배열도 거절', !!back.readBackup('[1,2,3]').error);

for (const key of ['wallet', 'facts', 'totals']) {
  const bad = profile(); delete bad[key];
  const r = back.readBackup(JSON.stringify(bad));
  ok(`${key}가 없으면 거절하고 이유를 알려준다`, r.error?.includes(key));
}

/* ── 화면이 지키는 것 ── */
group('화면이 지키는 것');

ok('되돌리기 전에 confirm으로 한 번 더 묻는다',
  /impGo['"]\)\.onclick[\s\S]{0,200}confirm\(/.test(PARENT));
ok('"지금 기록은 덮어써집니다"를 알려준다', PARENT.includes('지금 기록은 덮어써집니다'));
ok('먼저 내보내라고 권한다', PARENT.includes('내보내기'));
ok('다른 아이 기록이면 경고한다', PARENT.includes('정말 되돌릴까요'));
ok('되돌릴 때 id를 지금 아이로 맞춘다 — 파일 이름과 어긋나면 안 된다',
  /\{ \.\.\.data, id: PROFILE\.id \}/.test(PARENT));
ok('내보내기는 방금 상태를 다시 받는다 — 아이가 놀고 있을 수 있다',
  /expBtn['"]\)\.onclick[\s\S]{0,300}await api\(`\/api\/profile\//.test(PARENT));
ok('아이 화면에는 되돌리기가 없다 (원칙 2.7)',
  !APP.includes('되돌리기') && !APP.includes('impGo'));

/* ── 홈 화면 추가 ── */
group('홈 화면에 추가 — 사파리가 기록을 지우지 않는 조건');

ok('이미 넣었으면 안 띄운다', /installed\(\)/.test(APP) && APP.includes('navigator.standalone'));
ok('iOS에서만 띄운다', APP.includes('isIOS'));
ok('한 번 닫으면 다시 안 띄운다', APP.includes('HOME_HINT') && APP.includes('localStorage.setItem(HOME_HINT'));
ok('아이에게 이유(데이터가 날아간다)를 말하지 않는다',
  !/날아|사라|지워집니다/.test(APP.slice(APP.indexOf('function homeHint'), APP.indexOf('function homeHint') + 600)));

/* ── manifest와 아이콘 ── */
group('manifest와 아이콘');

const mf = JSON.parse(readFileSync(new URL('../web/manifest.json', import.meta.url), 'utf8'));
ok('standalone으로 열린다', mf.display === 'standalone');
ok('start_url이 있다', !!mf.start_url);
ok('아이콘 192·512가 있다',
  [192, 512].every(n => mf.icons.some(i => i.sizes === `${n}x${n}`)));
ok('maskable 아이콘이 있다', mf.icons.some(i => i.purpose === 'maskable'));

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
ok('index.html이 manifest를 건다', html.includes('rel="manifest"'));
ok('apple-touch-icon이 있다 — iOS는 이것만 본다', html.includes('apple-touch-icon'));
ok('앱처럼 뜨는 설정이 있다', html.includes('apple-mobile-web-app-capable'));

for (const n of [180, 192, 512]) {
  const png = readFileSync(new URL(`../web/icons/icon-${n}.png`, import.meta.url));
  const sig = png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  ok(`icon-${n}.png가 진짜 PNG이고 ${n}×${n}이다`, sig && w === n && h === n);
}

ok('아이콘을 다시 구울 수 있다',
  execFileSync('python3', ['sim/make-icons.py'], { cwd: ROOT, encoding: 'utf8' }).includes('icon-512.png'));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
