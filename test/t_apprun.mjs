/* 아이 화면을 **실제로 실행**한다 — node test/t_apprun.mjs

   `app.js`는 ES 모듈이라 최상위에서 한 줄만 터져도 그 아래가 통째로 안 돌고
   화면에는 **아무것도 안 남습니다.** 부모 화면에서 이걸 두 번 당했습니다 (구현-현황 29·34장).
   그래서 아이 화면도 진짜로 켜서 눌러봅니다.

   여기서 확인하는 것은 «한 바퀴 훑기»가 그 단원의 문제를 **하나도 안 빼고** 내는가입니다.
   단어시험 전에 전체를 훑겠다는 요구라, 하나라도 빠지면 그 낱말만 시험에서 틀립니다. */

import { readFileSync, mkdtempSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
if (!existsSync(join(ROOT, 'dist/content.json')))
  execFileSync('python3', ['sim/build-static.py'], { cwd: ROOT, stdio: 'ignore' });

let pass = 0, fail = 0;
const group = t => console.log(`\n${t}`);
const ok = (t, c) => { c ? (pass++, console.log('  ✓ ' + t)) : (fail++, console.log('  ✗ ' + t)); };

/* ── 버튼과 입력칸만 아는 아주 작은 DOM ──
   innerHTML을 넣을 때마다 <button>·<input>을 훑어 눌러보고 써볼 수 있는 것으로 만든다. */
function makeEl(id) {
  let html = '';
  let buttons = [];
  const attrsOf = (el, attrs) => {
    for (const a of attrs.matchAll(/data-([a-z]+)="([^"]*)"/g)) el.dataset[a[1]] = a[2];
    const i = /\bid="([^"]*)"/.exec(attrs); if (i) el.id = i[1];
    el._attrs = attrs;
    return el;
  };
  const parse = v => {
    buttons = [...v.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => {
      const attrs = m[1], text = m[2].replace(/<[^>]*>/g, '').trim();
      return attrsOf({ textContent: text, dataset: {}, id: '', disabled: /\bdisabled\b/.test(attrs),
                       onclick: null, addEventListener() {}, focus() {},
                       classList: { add() {}, remove() {} } }, attrs);
    });
    // 입력칸도 같은 목록에 넣는다 — 화면은 둘을 나란히 내놓고, 검사도 나란히 눌러본다
    buttons.push(...[...v.matchAll(/<input\b([^>]*?)>/g)].map(m => {
      const attrs = m[1];
      const val = /\bvalue="([^"]*)"/.exec(attrs);
      return attrsOf({ tag: 'input', textContent: '', value: val ? val[1] : '', dataset: {}, id: '',
                       disabled: /\bdisabled\b/.test(attrs), onclick: null, onkeydown: null,
                       addEventListener() {}, focus() {},
                       classList: { add() {}, remove() {} } }, attrs);
    }));
  };
  const match = (el, sel) => {
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    const d = /^\[data-([a-z]+)\]$/.exec(sel);
    return d ? d[1] in el.dataset : false;
  };
  const el = {
    id, textContent: '', value: '', dataset: {}, style: {},
    classList: { add() {}, remove() {} },
    addEventListener() {}, focus() {}, click() {},
    setAttribute() {}, removeAttribute() {}, remove() {}, appendChild() {}, insertBefore() {},
    querySelectorAll: sel => buttons.filter(b => match(b, sel)),
    querySelector: sel => buttons.find(b => match(b, sel)) ?? null,
    _buttons: () => buttons,
  };
  Object.defineProperty(el, 'innerHTML', { get: () => html, set(v) { html = v; parse(v); } });
  return el;
}

/* **`globalThis.X = ...` 로 쓰지 마세요.**

   node 21부터 `navigator`가 **setter 없는 getter**로 전역에 있습니다. 모듈은 strict라
   대입이 조용히 무시되지 않고 `TypeError`로 터집니다. 손에서는(node 18) 멀쩡하고
   **CI에서만(node 22) 터집니다** (구현-현황 40장). defineProperty는 양쪽 다 됩니다. */
const def = (name, value) =>
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

async function boot(profile) {
  const app = makeEl('app'), toast = makeEl('toast');
  const els = { app, toast };
  const root = makeEl('html');
  root.style = new Proxy({}, { get: (t, k) => (k === 'setProperty' ? () => {} : t[k]), set: () => true });
  def('document', { getElementById: id => els[id] ?? null,
                    querySelectorAll: () => [], querySelector: () => null,
                    createElement: () => makeEl('tmp'),
                    documentElement: root, body: makeEl('body') });
  def('addEventListener', () => {});
  def('navigator', { standalone: false, sendBeacon: () => true, userAgent: 'node' });
  def('matchMedia', () => ({ matches: false, addEventListener() {}, addListener() {} }));
  def('scrollTo', () => {});
  def('confirm', () => true);
  def('window', globalThis);
  def('GUGUDAN_STATIC', true);
  const bag = {};
  def('localStorage', { getItem: k => bag[k] ?? null,
                        setItem: (k, v) => { bag[k] = String(v); },
                        removeItem: k => { delete bag[k]; } });
  const content = JSON.parse(readFileSync(join(ROOT, 'dist/content.json'), 'utf8'));
  def('fetch', async () => ({ ok: true, json: async () => content }));
  bag['gugudan-profiles'] = JSON.stringify([profile.id]);
  bag[`gugudan-profile-${profile.id}`] = JSON.stringify(profile);

  const tmp = mkdtempSync(join(tmpdir(), 'gugudan-apprun-'));
  for (const f of ['app.js', 'engine.js', 'store.js', 'characters.js', 'backgrounds.js'])
    cpSync(join(ROOT, 'web', f), join(tmp, f.replace('.js', '.mjs')));
  const src = readFileSync(join(tmp, 'app.mjs'), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.mjs'");
  writeFileSync(join(tmp, 'app.mjs'), src);
  for (const f of ['engine', 'store', 'characters', 'backgrounds']) {
    const p = join(tmp, f + '.mjs');
    writeFileSync(p, readFileSync(p, 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.mjs'"));
  }
  await import('file://' + join(tmp, 'app.mjs') + '?t=' + Date.now());
  for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r));
  return { app, toast, bag, profile };
}

const click = (app, sel) => {
  const b = app.querySelector(sel);
  if (!b || !b.onclick) throw new Error(`누를 것이 없습니다: ${sel}\n${app.innerHTML.slice(0, 400)}`);
  b.onclick();
};
const has = (app, sel) => !!app.querySelector(sel);

/* 프로필 모양은 server.py가 정한다 — 여기서 손으로 쓰면 실제와 어긋난다 */
const seed = JSON.parse(execFileSync('python3', ['-c',
  "import json, server; print(json.dumps(server.new_profile('test', '테스트'), ensure_ascii=False))"],
  { cwd: ROOT, encoding: 'utf8' }));
seed.characters.names.sheep = '흰양이';      // 이름을 지어야 홈이 나온다
seed.seenPacks = ['x'];                      // 처음 온 아이가 아니어야 «새 단원» 알림이 안 뜬다
seed.progress = { units: ['12-단어장', '13-단어장'], level: '섞어' };

group('아이 화면이 켜지는가');

const { app, bag } = await boot(structuredClone(seed));
/* 흉내가 걸렸는지 먼저 본다. node 버전에 따라 대입이 막히면 여기서 바로 드러난다. */
ok('전역 흉내가 실제로 걸렸다 — node 버전이 달라도',
  globalThis.navigator.standalone === false && globalThis.window === globalThis &&
  typeof globalThis.localStorage.getItem === 'function');
ok('홈 화면이 그려진다 — 모듈이 조용히 죽지 않았다', app.innerHTML.length > 200);
ok('문제 풀러 가기 버튼이 있다', has(app, '#play'));

group('한 바퀴 훑기 — 56문제가 하나도 안 빠지는가');

click(app, '#play');
ok('과목 고르기가 나온다', has(app, '[data-into]') || has(app, '[data-pack]'));
if (has(app, '[data-into]')) click(app, '[data-into]');
ok('단원마다 «한 바퀴» 버튼이 있다', has(app, '[data-sweep]'));

const sweepBtn = app.querySelectorAll('[data-sweep]').find(b => b.dataset.sweep === '13-단어장');
ok('13 단어장에도 «한 바퀴»가 붙어 있다', !!sweepBtn);
sweepBtn.onclick();
ok('훑기가 시작된다 — 머리글에 «한 바퀴»가 있다', /한 바퀴 1 \/ \d+/.test(app.innerHTML));
const total = Number(/한 바퀴 1 \/ (\d+)/.exec(app.innerHTML)[1]);
ok(`13 단어장 ${total}문제를 훑는다`, total === 56);

/* **일부러 전부 틀린다.** 맞히면 1.1초 뒤에 자동으로 넘어가므로 타이머를 56번 기다려야
   합니다. 틀리면 «알겠어»가 나오니 타이머 없이 끝까지 걸어갈 수 있습니다.
   덤으로 «다시 볼 것» 목록도 같이 검사됩니다. */
const CONTENT = JSON.parse(readFileSync(join(ROOT, 'dist/content.json'), 'utf8'));
const BOOK = CONTENT.packs.find(p => p.id === '13-단어장');
const answerOf = {};
for (const q of BOOK.problems) answerOf[q.prompt] = String(q.answer);
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const seen = [], heads = [];
for (let n = 0; n < total + 5; n++) {
  const m = /class="question[^"]*">([\s\S]*?)<\/div>/.exec(app.innerHTML);
  if (!m) break;
  const prompt = unesc(m[1].trim());
  seen.push(prompt);
  heads.push(Number(/한 바퀴 (\d+) \/ /.exec(app.innerHTML)[1]));
  const picks = app.querySelectorAll('[data-pick]');
  const wrong = picks.find(b => unesc(b.textContent) !== answerOf[prompt]);
  if (!wrong) { fail++; console.log('  ✗ 오답 보기를 못 찾았다: ' + prompt); break; }
  wrong.onclick();
  if (!has(app, '#next')) { fail++; console.log('  ✗ 틀렸는데 «알겠어»가 없다'); break; }
  click(app, '#next');
}

ok(`${seen.length}문제를 걸어갔다 — 한 판(20문제)에서 안 멈춘다`, seen.length === total);
ok('같은 문제가 두 번 안 나온다', new Set(seen).size === seen.length);
ok('그 단원의 문제를 하나도 안 빼고 다 냈다',
  new Set(seen).size === BOOK.problems.length &&
  BOOK.problems.every(q => seen.includes(q.prompt)));
ok('머리글이 1부터 하나씩 올라간다', heads.every((h, i) => h === i + 1));

group('한 바퀴를 다 돌면');

ok('결과 화면이 나온다', /한 바퀴 끝!/.test(app.innerHTML));
ok('다시 볼 것을 보여준다', /다시 볼 것/.test(app.innerHTML));
ok('«틀린 것만 다시»가 있다', has(app, '#again'));
ok('«한 바퀴 더»가 있다', has(app, '#round'));

click(app, '#again');
ok(`틀린 것만 다시 훑는다 — 일부러 다 틀렸으니 ${total}개 그대로다`,
  /한 바퀴 1 \/ (\d+)/.test(app.innerHTML) &&
  Number(/한 바퀴 1 \/ (\d+)/.exec(app.innerHTML)[1]) === total);

/* 훑기는 «오늘 몫»에도 센다. 56문제를 풀었으니 하루 목표(20)를 넘었고 별을 받았어야 한다. */
const saved = JSON.parse(bag['gugudan-profile-test']);
ok('훑은 것도 오늘 몫에 센다', saved.daily.solved >= total);
ok('그래서 오늘 몫 별을 받았다', saved.daily.goalStar === true && saved.wallet.star >= 1);
ok('다 틀렸으니 마스터는 없다', saved.totals.mastered === 0);
ok('틀려도 풀은 받는다 — 틀려서 손해 보면 아이가 안 한다', saved.wallet.grass >= total * 3);

group('단원을 하나만 켜뒀을 때도 훑을 수 있는가');

/* 시험 주간에는 그 챕터만 켜둘 가능성이 큽니다. 예전에는 단원이 하나면
   «무엇을 풀까»를 건너뛰고 바로 문제로 갔습니다 — 훑기 버튼에 갈 길이 없었습니다. */
const one = structuredClone(seed);
one.id = 'one'; one.progress = { units: ['13-단어장'], level: '섞어' };
const solo = await boot(one);
click(solo.app, '#play');
ok('단원이 하나여도 «무엇을 풀까»로 간다', has(solo.app, '[data-sweep]'));
ok('과목 고르는 단계는 건너뛴다 — 고를 게 하나인 화면은 헛걸음이다',
  !has(solo.app, '[data-into]'));
ok('그냥 풀기도 그대로 된다', has(solo.app, '[data-pack]'));

group('직접 써서 답하기 (6A 단답형)');

/* 수학 심화만 켜면 화면에 나오는 것이 **전부 단답**입니다. 그 상태로 끝까지 눌러봅니다.
   여기서 보는 것은 채점이 아니라 **막힌 아이가 누를 것이 화면에 있는가**입니다 (기획서 12.1). */
const CIRCLE = CONTENT.packs.find(p => p.id === '2-3-원');
const ansOf = {};
for (const q of CIRCLE.problems) ansOf[q.prompt] = String(q.answer);

const promptNow = a => unesc(/class="question[^"]*">([\s\S]*?)<\/div>/.exec(a.innerHTML)[1].trim());

const mathSeed = structuredClone(seed);
mathSeed.id = 'short'; mathSeed.progress = { units: ['2-3-원'], level: '심화' };
const W = await boot(mathSeed);
click(W.app, '#play');
click(W.app, '[data-pack]');

ok('문제가 나온다', /class="question/.test(W.app.innerHTML));
ok('보기 버튼이 없다 — 골라서 맞히는 문제가 아니다', !has(W.app, '[data-pick]'));
ok('입력칸이 있다', !!W.app.querySelector('#typed'));
ok('빨간 밑줄이 안 그어진다 — spellcheck=false (원칙 2.1)',
  /spellcheck="false"/.test(W.app.innerHTML));
ok('자동 고침·자동 대문자·자동 완성이 다 꺼져 있다',
  ['autocorrect="off"', 'autocapitalize="off"', 'autocomplete="off"']
    .every(s => W.app.innerHTML.includes(s)));
ok('답이 숫자뿐이면 숫자판이 뜬다', /inputmode="numeric"/.test(W.app.innerHTML));
ok('「보기 보여줘」가 같은 화면에 있다 — 막히면 누를 것이 있어야 한다', has(W.app, '#show'));
ok('「모르겠어」도 같은 화면에 있다', has(W.app, '#dunno'));
ok('힌트는 그대로 있다', has(W.app, '#hint'));

/* 프로필 저장은 다섯 문제마다 한 번이다(saveSoon). 그래서 보상은 **화면에 보이는 값**으로 본다 —
   아이가 실제로 읽는 줄이기도 하다. */
const type = (t, text) => { t.app.querySelector('#typed').value = text; click(t.app, '#ok'); };
const settle = () => new Promise(r => setTimeout(r, 1300));   // 맞히면 잠시 뒤 저절로 넘어간다

/* ① 직접 써서 맞히기 */
type(W, ansOf[promptNow(W.app)]);
ok('직접 써서 맞히면 «맞았어»가 나온다', /맞았어/.test(W.app.innerHTML));
ok('보너스까지 그대로 받는다 — 쓰는 것에 손해가 없다 (기획서 12.1)',
  /풀 \+6 받았어/.test(W.app.innerHTML));

/* ② 「보기 보여줘」 — 언제든 4지선다로 내려올 수 있다 */
await settle();
ok('맞히면 다음 문제로 넘어간다', !!W.app.querySelector('#typed'));
const shownPrompt = promptNow(W.app);
click(W.app, '#show');
ok('「보기 보여줘」를 누르면 보기 넷이 나온다', W.app.querySelectorAll('[data-pick]').length === 4);
ok('그때는 입력칸이 사라진다', !W.app.querySelector('#typed'));
W.app.querySelectorAll('[data-pick]').find(b => unesc(b.textContent) === ansOf[shownPrompt]).onclick();
ok('보기로 맞혀도 풀은 받는다 — 다만 힌트와 같은 취급이라 보너스는 아니다 (+4)',
  /풀 \+4 받았어/.test(W.app.innerHTML));
ok('화면에 «포기»라는 말은 없다', !/포기/.test(W.app.innerHTML));

/* ③ 「모르겠어」 — 빈칸으로도 넘어갈 수 있고, 푼 것으로 센다 */
await settle();
click(W.app, '#dunno');
ok('빈칸으로 넘어가도 기본 보상은 나간다 (원칙 2.2)', /풀 \+3 받았어/.test(W.app.innerHTML));
ok('그러면서 정답을 알려준다', /class="feedback tell/.test(W.app.innerHTML));
ok('«알겠어»로 다음으로 간다', has(W.app, '#next'));

/* ④ 저장된 것으로 마스터리를 본다. 다섯 문제를 채워야 저장된다. */
click(W.app, '#next');
for (let i = 0; i < 2; i++) { click(W.app, '#dunno'); click(W.app, '#next'); }
const done = JSON.parse(W.bag['gugudan-profile-short']);
ok('푼 것으로 다 센다 — 「모르겠어」도 포함해 5문제', done.daily.solved === 5);
ok('직접 써서 맞힌 것은 마스터리가 올라간다',
  Object.values(done.facts).filter(f => f.m === 1).length === 2);
ok('틀린 것은 «어려워하는 문제»에 남는다 — 부모가 본다',
  Object.values(done.facts).some(f => (f.log || []).some(x => x.endsWith(':x'))));

group('다시는 이렇게 터지지 않게');

/* 이 검사는 «검사에 대한 검사»입니다. node 21이 `navigator`를 전역에 들이면서
   `globalThis.navigator = ...` 가 CI에서만 터졌습니다. 손에는 node 18, CI에는 node 22.
   다음에 어떤 이름이 전역이 될지는 모르지만, **대입 대신 defineProperty**면 안 터집니다. */
const { readdirSync } = await import('node:fs');
const offenders = readdirSync(join(ROOT, 'test'))
  .filter(f => f.endsWith('.mjs'))
  .filter(f => /^\s*globalThis\.\w+\s*=[^=]/m.test(readFileSync(join(ROOT, 'test', f), 'utf8')))
  .map(f => 'test/' + f);
ok('어떤 검사도 globalThis에 **대입**하지 않는다 — defineProperty를 쓴다',
  !offenders.length);
if (offenders.length) console.log('     ', offenders.join(' / '));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
