/* 하루 목표 별 검사 — node test/t_daily.mjs

   «오늘 몫을 다 하면 별 1개». 마스터 별과 달리 **맞고 틀리고를 안 보는** 유일한 별이라
   규칙이 하나만 어긋나도 아이가 이유를 모르게 됩니다. 지켜야 할 것은 셋입니다.

     · 하루에 한 번뿐 — 더 푼다고 또 주지 않는다
     · 날이 바뀌면 다시 받는다
     · **한 번 준 것은 도로 빼지 않는다** — 부모가 목표를 올려도 (원칙 2.1) */

import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const SPEC = readFileSync(new URL('../docs/기획서.md', import.meta.url), 'utf8');
const SIM = readFileSync(new URL('../sim/60days.mjs', import.meta.url), 'utf8');

function grab(name) {
  const at = SRC.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`app.js에 ${name}이(가) 없습니다`);
  let depth = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}' && --depth === 0) return SRC.slice(at, i + 1);
  }
}

const GOAL_STAR = Number(/const GOAL_STAR = (\d+)/.exec(SRC)[1]);

let P = null, DAY = '2026-09-02';
const body = [grab('catchUpGoal'), grab('rollDay')].join('\n');
const M = new Function('getP', 'getDay', 'setP', `
  const today = () => getDay();
  const goal = () => getP().daily.goal || 20;
  const GOAL_STAR = ${GOAL_STAR};
  const pruneLogs = () => {};
  ${body.replace(/\bP\.daily = (\{.*\});/, 'setP($1);').replace(/pruneLogs\(P\.facts\);/, 'pruneLogs();').replace(/\bP\./g, 'getP().')}
  return { catchUpGoal, rollDay };
`)(() => P, () => DAY, d => { P.daily = d; });

/* `P.daily = {...};` 한 줄을 통째로 setP(...)로 바꾼다. 대입만 바꾸면 닫는 괄호가
   안 맞아 new Function이 그 자리에서 터진다 — 조용히 통과하는 것보다 그게 낫다. */

let pass = 0, fail = 0;
const group = t => console.log(`\n${t}`);
const ok = (t, c) => { c ? (pass++, console.log('  ✓ ' + t)) : (fail++, console.log('  ✗ ' + t)); };

const fresh = (goal = 20) => ({
  wallet: { grass: 0, star: 0 },
  daily: { day: DAY, solved: 0, goal, right: 0, grass: 0, star: 0 },
  history: [], totals: { solved: 0, mastered: 0, daysPlayed: 0 },
  collection: { stickers: [], boardsCompleted: 0 }, facts: {},
});
const solve = n => { for (let i = 0; i < n; i++) { P.daily.solved++; M.catchUpGoal(); } };

group('오늘 몫을 다 하면 별 1개');

P = fresh(); solve(19);
ok('목표에 못 미치면 안 준다', P.wallet.star === 0 && !P.daily.goalStar);

solve(1);
ok(`목표를 채우면 별 ${GOAL_STAR}개`, P.wallet.star === GOAL_STAR && P.daily.goalStar === true);

solve(40);
ok('더 풀어도 두 번 주지 않는다 — 하루 한 번뿐', P.wallet.star === GOAL_STAR);

ok('하루 통계에도 잡힌다 — 부모 화면이 이 별을 본다', P.daily.star === GOAL_STAR);

ok('도감 스티커는 안 늘어난다 — 이건 마스터가 아니다',
  P.collection.stickers.length === 0);

group('날이 바뀌면');

const before = P.wallet.star;
DAY = '2026-09-03'; M.rollDay();
ok('goalStar 표시가 지워진다', !P.daily.goalStar && P.daily.solved === 0);
ok('어제 받은 별은 그대로 있다', P.wallet.star === before);
ok('어제 기록이 history에 남는다', P.history.at(-1)?.star === GOAL_STAR);
solve(20);
ok('오늘 것을 다시 받는다', P.wallet.star === before + GOAL_STAR);

group('부모가 목표를 바꿔도 (원칙 2.1)');

P = fresh(20); solve(20);
P.daily.goal = 30;                                  // 다 한 뒤에 목표를 올렸다
solve(5);
ok('목표를 올려도 이미 받은 별을 빼앗지 않는다', P.wallet.star === GOAL_STAR);
solve(10);                                          // 새 목표 30도 넘겼다
ok('올린 목표를 다시 채워도 또 주지는 않는다 — 그날 몫은 하나다',
  P.wallet.star === GOAL_STAR);

P = fresh(30); solve(20);
ok('목표 30이면 20문제로는 못 받는다', P.wallet.star === 0);
P.daily.goal = 20;                                  // 부모가 목표를 내렸다
solve(1);
ok('목표를 내리면 다음 문제에서 받는다', P.wallet.star === GOAL_STAR);

group('한 군데서만 정한다');

ok('기획서 8.2에 하루 목표 별이 적혀 있다',
  /\|\s*\*\*오늘 몫\(하루 목표\)을 다 함\*\*[^|]*\|\s*1\s*\|/.test(SPEC));
ok('60일 시뮬이 app.js에서 GOAL_STAR를 읽는다 — 값을 두 곳에 두지 않는다',
  /GOAL_STAR = num\(/.test(SIM) && /star \+= GOAL_STAR;/.test(SIM));
ok('시뮬의 상수 읽기가 0을 기본값으로 되살리지 않는다 — `|| d`는 안 된다',
  !/Number\(re\.exec\(APP\)\?\.\[1\]\) \|\| d/.test(SIM));
ok('시뮬이 RECENT_KEYS도 app.js에서 읽는다',
  /RECENT_KEYS = num\(/.test(SIM) && !/recent\.length > 3\b/.test(SIM));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
