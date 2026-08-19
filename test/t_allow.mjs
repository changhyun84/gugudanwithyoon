/* 용돈 검사 — node test/t_allow.mjs

   가장 중요한 것은 **화폐가 풀이라는 것**입니다 (기획서 원칙 2.2).
   별로 바꾸게 하면 별은 마스터(=정답)에만 붙으므로 "틀리면 돈을 못 번다"가 되고,
   이 게임이 통한 이유가 정확히 그 반대입니다.

   그 다음은 **주 1회**입니다. 매일 환전되면 임금이 되고, 임금이 되면 놀이가 노동이 됩니다(원칙 2.5). */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

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

let P = null, ALLOW = null, NOW = new Date(2026, 8, 5), toasts = [];
const noop = () => {};
const body = ['allowanceDay', 'allowanceSteps', 'exchange'].map(grab).join('\n');
const money = new Function('getALLOW', 'getP', 'getToday', 'toast', 'save', 'renderAllowance', 'bind', 'DateRef', 'DAYNAMES', `
  const today = getToday;
  const Date = DateRef;
  ${body.replace(/\bP\./g, 'getP().').replace(/\bALLOW\b/g, 'getALLOW()').replace(/ALLOW\(\)\?\./g, 'ALLOW()?.')}
  return { allowanceDay, allowanceSteps, exchange };
`)(() => ALLOW, () => P, () => NOW.toLocaleDateString('sv-SE'), m => toasts.push(m), noop, noop, noop,
   class extends Date { constructor(...a) { return a.length ? super(...a) : super(NOW.getTime()); } },
   ['일', '월', '화', '수', '목', '금', '토']);

let pass = 0, fail = 0;
const ok = (name, cond) => cond ? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

const ON = { on: true, per: 100, won: 200, day: 6, max: 500 };
const profile = (grass = 0, log = []) => ({ wallet: { grass, star: 0 }, allowance: log });
const sat = new Date(2026, 8, 5);    // 2026-09-05 토요일
const wed = new Date(2026, 8, 2);    // 수요일
console.assert(sat.getDay() === 6 && wed.getDay() === 3);

/* ── 화폐 ── */
group('화폐는 풀이다 — 별로 바꾸면 "틀리면 돈을 못 번다"가 됩니다');

const ex = grab('exchange');
ok('exchange가 wallet.grass를 뺀다', /wallet\.grass\s*-=/.test(ex));
ok('exchange가 wallet.star를 건드리지 않는다', !/wallet\.star/.test(ex));

/* ── 바꿀 수 있는 날 ── */
group('주 1회, 정한 요일에만');

NOW = sat; ALLOW = { ...ON, on: false }; P = profile(1000);
ok('꺼져 있으면 안 열림', !money.allowanceDay());

ALLOW = ON;
ok('토요일이면 열림', money.allowanceDay());

NOW = wed;
ok('다른 요일이면 안 열림', !money.allowanceDay());

NOW = sat;
P = profile(1000, [{ day: '2026-09-05', grass: 100, won: 200 }]);
ok('오늘 이미 바꿨으면 안 열림', !money.allowanceDay());
P = profile(1000, [{ day: '2026-08-29', grass: 100, won: 200 }]);
ok('지난주에 바꾼 건 상관없음', money.allowanceDay());

/* ── 바꿀 수 있는 양 ── */
group('바꿀 수 있는 양');

ALLOW = ON; P = profile(1000);
ok('상한(500) 안의 단위만', money.allowanceSteps().every(g => g <= 500));
ok('100·300·500', money.allowanceSteps().join(',') === '100,300,500');

P = profile(250);
ok('가진 풀보다 많은 건 안 나옴', money.allowanceSteps().join(',') === '100');

P = profile(50);
ok('한 단위도 안 되면 비어 있음', !money.allowanceSteps().length);

/* ── 바꾸기 ── */
group('바꾸기');

NOW = sat; ALLOW = ON; P = profile(700); toasts = [];
money.exchange(300);
ok('풀이 빠짐', P.wallet.grass === 400);
ok('기록이 남음', P.allowance.length === 1 && P.allowance[0].won === 600);
ok('날짜가 적힘', P.allowance[0].day === '2026-09-05');
ok('얼마인지 알려줌', toasts[0].includes('600'));

money.exchange(100);
ok('같은 날 두 번은 안 됨', P.wallet.grass === 400 && P.allowance.length === 1);

NOW = wed; P = profile(700); toasts = [];
money.exchange(300);
ok('다른 요일엔 안 바뀜', P.wallet.grass === 700 && !P.allowance.length);
ok('언제 오면 되는지 알려줌', toasts[0].includes('토'));

NOW = sat; P = profile(700);
money.exchange(600);
ok('상한을 넘으면 안 바뀜', P.wallet.grass === 700);
money.exchange(900);
ok('가진 것보다 많으면 안 바뀜', P.wallet.grass === 700);

/* ── 기록은 지워지지 않는다 ── */
group('기록은 지워지지 않는다');
ok('app.js에 용돈 기록을 지우는 코드가 없다',
  !/allowance\s*\.\s*(splice|shift|pop|filter)/.test(SRC) &&
  !/allowance\s*=\s*\[\]/.test(SRC.replace(/allowance \|\|= \[\]/g, '')));

/* ── 기본값 ── */
group('서버 기본값');

const py = code => execFileSync('python3', ['-c', code],
  { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim();

ok('기본은 꺼짐', py(`import server;print(server.DEFAULT_SETTINGS['allowance']['on'])`) === 'False');
ok('아이 화면으로 내려감',
  py(`import server;print('allowance' in server.DEFAULT_SETTINGS)`) === 'True');
ok('PIN은 아이 화면으로 안 내려간다',
  !py(`import server,inspect;print(inspect.getsource(server.Handler.public_settings))`).includes('parentPin'));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
