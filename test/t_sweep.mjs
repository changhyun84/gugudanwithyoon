/* 한 바퀴 훑기 검사 — node test/t_sweep.mjs

   «단어시험 보기 전에 전체를 훑고 싶다»에서 나온 화면입니다.

   평소 출제는 아직 안 연 문제를 빼둡니다. 그래서 한 판을 20문제로 하든 30문제로 하든
   서로 다른 문제는 열대여섯 개뿐입니다 — 판을 늘리는 것으로는 안 됩니다.
   훑기는 **뽑지 않고** 순서대로 냅니다. 여기서 지켜야 할 것은 하나입니다.

     그 단원의 문제가 **하나도 안 빠지고 한 번씩** 나온다. */

import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'gugudan-sweep-'));
writeFileSync(join(tmp, 'engine.mjs'), readFileSync(join(ROOT, 'web/engine.js')));
const E = await import('file://' + join(tmp, 'engine.mjs'));

const SRC = readFileSync(join(ROOT, 'web/app.js'), 'utf8');
const CSS = readFileSync(join(ROOT, 'web/styles.css'), 'utf8');

function grab(name) {
  const at = SRC.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`app.js에 ${name}이(가) 없습니다`);
  let depth = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}' && --depth === 0) return SRC.slice(at, i + 1);
  }
}

let INDEX = {};
const { sweepKeys } = new Function('getIndex', `
  ${grab('sweepKeys').replace(/\bINDEX\b/g, 'getIndex()')}
  return { sweepKeys };
`)(() => INDEX);

const PACKS = JSON.parse(execFileSync('python3', ['-c', `
import json, pathlib, packs
print(json.dumps(packs.scan(pathlib.Path('content/problems')), ensure_ascii=False, default=str))`],
  { cwd: ROOT, encoding: 'utf8' }));

let pass = 0, fail = 0;
const group = t => console.log(`\n${t}`);
const ok = (t, c) => { c ? (pass++, console.log('  ✓ ' + t)) : (fail++, console.log('  ✗ ' + t)); };

const BOOK = PACKS.find(p => p.subject === '영어' && p.unit === '13');
const prog = id => ({ units: [id], level: '섞어' });

group('한 단원을 통째로 — 하나도 안 빠지는가');

INDEX = E.buildIndex(PACKS, null, prog(BOOK.id));
let keys = sweepKeys(BOOK.id);
ok(`${BOOK.name} ${BOOK.problems.length}문제가 전부 들어온다`, keys.length === BOOK.problems.length);
ok('같은 문제가 두 번 들어오지 않는다', new Set(keys).size === keys.length);
ok('색인에 있는 그 팩의 문제와 정확히 같다',
  new Set(keys).size === Object.values(INDEX).filter(e => e.packId === BOOK.id).length);
ok('order 순서대로다 — 대각선 순서를 그대로 따른다',
  keys.every((k, i) => !i || INDEX[keys[i - 1]].order <= INDEX[k].order));
ok('다른 단원은 안 섞인다', keys.every(k => INDEX[k].packId === BOOK.id));

group('한 바퀴를 실제로 돌려본다');

/* 이게 «전체 문제가 다 나올 수 있나»에 대한 답이다. 평소 출제로는 안 되는 것을
   여기서는 되는지, 실제로 questionOf를 56번 불러 확인한다. */
const facts = {}; E.seedFacts(INDEX, facts);
const asked = keys.map(k => E.questionOf(INDEX, k));
ok(`${asked.length}문제를 다 냈다`, asked.length === BOOK.problems.length);
ok('서로 다른 문제다', new Set(asked.map(q => q.key)).size === asked.length);
ok('전부 보기 4개와 힌트가 있다',
  asked.every(q => q.choices.length === 4 && new Set(q.choices).size === 4 && q.hint));
ok('정답이 보기 안에 있다', asked.every(q => q.choices.includes(q.answer)));

/* 견줌 — 평소 출제로 같은 수만큼 뽑으면 몇 가지나 나오나 */
const rec = [], drawn = new Set();
const f2 = {}; E.seedFacts(INDEX, f2);
for (let i = 0; i < BOOK.problems.length; i++) {
  const k = E.pickKey(INDEX, f2, rec, '2026-09-02');
  drawn.add(k);
  E.applyResult(INDEX[k], f2[k], Math.random() < 0.8, false, '2026-09-02', 4000);
  rec.push(k); if (rec.length > 19) rec.shift();
}
ok(`평소 출제로 ${BOOK.problems.length}문제를 풀면 ${drawn.size}가지뿐 — 훑기가 필요한 이유`,
  drawn.size < BOOK.problems.length * 0.6);

group('부모가 정한 것은 그대로 지킨다');

INDEX = E.buildIndex(PACKS, { problems: [BOOK.problems[0].key, BOOK.problems[1].key] }, prog(BOOK.id));
keys = sweepKeys(BOOK.id);
ok('부모가 끈 문제는 훑기에도 안 나온다',
  keys.length === BOOK.problems.length - 2 &&
  !keys.includes(BOOK.problems[0].key) && !keys.includes(BOOK.problems[1].key));

INDEX = E.buildIndex(PACKS, null, { units: [BOOK.id], level: '기본' });
keys = sweepKeys(BOOK.id);
ok('난이도를 기본으로 두면 심화는 안 나온다',
  keys.length && keys.every(k => !INDEX[k].deep));

INDEX = E.buildIndex(PACKS, null, { units: [BOOK.id], level: '심화' });
ok('심화로 두면 심화만 나온다', sweepKeys(BOOK.id).every(k => INDEX[k].deep));

group('배선 (app.js)');

ok('훑는 동안에는 뽑지 않는다',
  /quiz = sweep \? questionOf\(INDEX, sweep\.keys\[sweep\.i\+\+\]\)/.test(SRC));
ok('끝까지 가면 결과 화면으로 간다', /sweep\.i >= sweep\.keys\.length \? go\('swept'\)/.test(SRC));
ok('한 판이 끝나도 훑기는 안 끊긴다 — 목표 20문제에서 멈추지 않는다',
  SRC.indexOf("if (sweep) return sweep.i") < SRC.indexOf('P.daily.solved >= goal()'));
ok('화면을 벗어나면 훑기가 끝난다',
  /if \(v !== 'quiz' && v !== 'swept'\) sweep = null;/.test(SRC));
ok('단원 화면에 «한 바퀴» 버튼이 있다', /data-sweep="\$\{esc\(p\.id\)\}"/.test(SRC));
ok('그 버튼이 startSweep을 부른다', /data-sweep\]'\)\.forEach\(b => b\.onclick = \(\) => startSweep/.test(SRC));
ok('틀린 것만 다시 볼 수 있다', /startSweep\(packId, wrong\)/.test(SRC));
ok('훑기도 하루 몫에 센다 — 문제를 푼 것은 푼 것이다',
  SRC.indexOf('if (sweep) { if (right') > SRC.indexOf('P.daily.solved++'));
ok('훑은 문제도 마스터리에 반영된다', /if \(sweep\)[\s\S]{0,200}applyResult\(INDEX\[q\.key\]/.test(SRC));
ok('빈 단원을 훑으려 하면 알려준다', /if \(!list\.length\) return toast/.test(SRC));
ok('줄 배치 스타일이 있다', /\.btnrow \.btn\.wide\{/.test(CSS) && /\.btnrow \.btn\.narrow\{/.test(CSS));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
