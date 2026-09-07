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

/* ── 버튼만 아는 아주 작은 DOM ──
   innerHTML을 넣을 때마다 <button>을 훑어 눌러볼 수 있는 것으로 만든다. */
function makeEl(id) {
  let html = '';
  let buttons = [];
  const parse = v => {
    buttons = [...v.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => {
      const attrs = m[1], text = m[2].replace(/<[^>]*>/g, '').trim();
      const el = { textContent: text, dataset: {}, id: '', disabled: /\bdisabled\b/.test(attrs),
                   onclick: null, addEventListener() {}, focus() {}, classList: { add() {}, remove() {} } };
      for (const a of attrs.matchAll(/data-([a-z]+)="([^"]*)"/g)) el.dataset[a[1]] = a[2];
      const i = /\bid="([^"]*)"/.exec(attrs); if (i) el.id = i[1];
      el._attrs = attrs;
      return el;
    });
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

async function boot(profile) {
  const app = makeEl('app'), toast = makeEl('toast');
  const els = { app, toast };
  const root = makeEl('html');
  root.style = new Proxy({}, { get: (t, k) => (k === 'setProperty' ? () => {} : t[k]), set: () => true });
  globalThis.document = { getElementById: id => els[id] ?? null,
                          querySelectorAll: () => [], querySelector: () => null,
                          createElement: () => makeEl('tmp'),
                          documentElement: root, body: makeEl('body') };
  globalThis.addEventListener = () => {};
  globalThis.navigator = { standalone: false, sendBeacon: () => true, userAgent: 'node' };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  globalThis.scrollTo = () => {};
  globalThis.confirm = () => true;
  globalThis.window = globalThis;
  globalThis.GUGUDAN_STATIC = true;
  const bag = {};
  globalThis.localStorage = { getItem: k => bag[k] ?? null,
                              setItem: (k, v) => { bag[k] = String(v); },
                              removeItem: k => { delete bag[k]; } };
  const content = JSON.parse(readFileSync(join(ROOT, 'dist/content.json'), 'utf8'));
  globalThis.fetch = async () => ({ ok: true, json: async () => content });
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

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
