/* 부모 화면을 **실제로 실행해본다** — node test/t_parentrun.mjs

   왜 필요한가: 부모 화면은 ES 모듈이라 최상위에서 에러가 나면 **그 아래가 통째로 안 돕니다.**
   에러는 화면 어디에도 안 뜨고 모든 칸이 "불러오는 중…"에서 얼어붙습니다.
   글자만 훑는 검사(t_parent.mjs)로는 이걸 절대 못 잡습니다 — 실제로 한 번 놓쳤습니다(29장).

   jsdom은 못 씁니다(외부 패키지 금지). 그래서 이 파일이 **아주 작은 DOM을 흉내 냅니다.**
   완전하지 않아도 됩니다. 필요한 것은 "최상위가 끝까지 도는가"와
   "칸들이 불러오는 중에서 벗어나는가" 둘뿐입니다. */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HTML = readFileSync(join(ROOT, 'web/parent.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => cond
  ? (pass++, console.log('  ✓', name))
  : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

/* ── 아주 작은 DOM ── */
function makeDom() {
  const ids = [...HTML.matchAll(/id="([A-Za-z0-9]+)"/g)].map(m => m[1]);
  const mk = id => {
    let html = '';
    const el = {
      id, value: '', textContent: '', checked: false, disabled: false,
      className: '', style: {}, dataset: {}, files: [],
      querySelectorAll: () => [], querySelector: () => null,
      addEventListener() {}, removeEventListener() {}, click() {}, focus() {},
    };
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      // 진짜 select는 innerHTML을 넣으면 첫 option이 골라진다. 그것만 흉내 낸다.
      set(v) { html = v; const o = /<option value="([^"]*)"/.exec(v); if (o) el.value = o[1]; },
    });
    return el;
  };
  const els = new Map(ids.map(i => [i, mk(i)]));
  for (const m of HTML.matchAll(/id="([A-Za-z0-9]+)"[^>]*value="([^"]*)"/g))
    if (els.has(m[1])) els.get(m[1]).value = m[2];

  globalThis.document = { getElementById: id => els.get(id) ?? null,
                          querySelectorAll: () => [], querySelector: () => null,
                          createElement: () => mk('tmp'), body: mk('body') };
  globalThis.addEventListener = () => {};
  globalThis.confirm = () => true;
  globalThis.CSS = { escape: s => s };
  globalThis.window = globalThis;
  globalThis.GUGUDAN_STATIC = true;
  const store = {};
  globalThis.localStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  return { els, store };
}

async function run(seedProfile, mode = 'static') {
  const { els, store } = makeDom();
  const content = JSON.parse(readFileSync(join(ROOT, 'dist/content.json'), 'utf8'));
  globalThis.GUGUDAN_STATIC = mode === 'static';

  if (mode === 'static') {
    globalThis.fetch = async () => ({ ok: true, json: async () => content });
    if (seedProfile) {
      store['gugudan-profiles'] = JSON.stringify([seedProfile.id]);
      store[`gugudan-profile-${seedProfile.id}`] = JSON.stringify(seedProfile);
    }
  } else {
    // 집 서버 모드 — /api/* 를 흉내 낸다. 두 모드가 갈라지면 여기서 잡힌다.
    globalThis.fetch = async (url) => {
      const body =
        url === '/api/bootstrap'
          ? { profiles: seedProfile ? [{ id: seedProfile.id, displayName: seedProfile.displayName }] : [],
              settings: content.settings, packs: content.packs.map(p => ({ ...p, problems: undefined })),
              messages: content.messages, wishes: content.wishes }
        : url.startsWith('/api/pack/')
          ? content.packs.find(p => p.id === decodeURIComponent(url.slice('/api/pack/'.length))) || null
        : url.startsWith('/api/profile/') ? seedProfile
        : url === '/api/parent/packs'
          ? { packs: content.packs.map(p => ({ ...p, problems: undefined })),
              messages: { file: 'messages.csv', warnings: content.messageWarnings },
              wishes: { file: 'wishes.csv', list: content.wishes, warnings: content.wishWarnings } }
        : {};
      return { ok: true, json: async () => body };
    };
  }

  const tmp = mkdtempSync(join(tmpdir(), 'gugudan-parentrun-'));
  for (const f of ['engine.js', 'store.js'])
    writeFileSync(join(tmp, f.replace('.js', '.mjs')), readFileSync(join(ROOT, 'web', f)));
  let js = HTML.slice(HTML.indexOf('<script type="module">') + 22, HTML.lastIndexOf('</script>'));
  js = js.replace(/from '\/([a-z]+)\.js'/g, (_, n) => `from '${join(tmp, n + '.mjs')}'`);
  // 같은 모듈을 두 번 돌려야 하므로 캐시를 피한다
  const file = join(tmp, `run-${mode}-${seedProfile ? 'p' : 'e'}.mjs`);
  writeFileSync(file, js);

  let err = null;
  const quiet = console.error;
  console.error = () => {};
  try { await import('file://' + file); } catch (e) { err = e; }
  console.error = quiet;
  const text = id => (els.get(id).innerHTML || els.get(id).textContent || '');
  return { err, text };
}

/* 실제 문제로 돌려야 의미가 있습니다. 없으면 만들어 씁니다 —
   테스트가 빌드보다 먼저 도는 CI에서도 이 파일 하나로 완결되게. */
if (!existsSync(join(ROOT, 'dist/content.json')))
  execFileSync('python3', ['sim/build-static.py'], { cwd: ROOT, stdio: 'ignore' });

/* ── 아이가 있을 때 ── */
group('부모 화면이 끝까지 도는가 — 아이가 있을 때');

const PROFILE = {
  schemaVersion: 2, id: '테스트', displayName: '테스트', createdAt: '2026-01-01',
  characters: { unlocked: ['sheep'], active: 'sheep', names: {}, equipped: { sheep: {} } },
  wallet: { grass: 10, star: 1 },
  inventory: { items: [], backgrounds: ['day'], activeBackground: 'day' },
  facts: {}, daily: { day: '2026-08-25', solved: 0, goal: 20 },
  totals: { daysPlayed: 1, solved: 0, mastered: 0 }, history: [],
  collection: { stickers: [], boardsCompleted: 0 }, records: { speed: {} },
  progress: {}, gifts: [], shopTier: 1, settings: { goal: 20, reduceMotion: false },
  disabled: { problems: [], packs: [] }, wishes: [], allowance: [], seenPacks: [],
};

const A = await run(PROFILE);
ok('최상위가 에러 없이 끝까지 돈다', !A.err);
if (A.err) console.log('     ', A.err.constructor.name, '—', A.err.message);

for (const id of ['stat', 'progress', 'weak', 'wishes'])
  ok(`#${id}이(가) "불러오는 중…"에서 벗어난다`, !A.text(id).includes('불러오는 중'));

ok('진도에 단원 체크박스가 그려진다', /data-unit=/.test(A.text('progress')));
ok('난이도 세 가지가 그려진다',
  ['기본', '섞어', '심화'].every(v => A.text('levels').includes(`data-level="${v}"`)));
ok('고른 난이도가 표시된다', /class="soft on" data-level="섞어"/.test(A.text('levels')));
ok('난이도가 무엇을 뜻하는지 적혀 있다', A.text('levelWhy').length > 10);
ok('낼 수 있는 문제 수를 보여준다', /낼 수 있는 문제|낼 문제가 하나도/.test(A.text('pool')));
ok('진도에 과목 이름이 나온다', /수학|한국사/.test(A.text('progress')));
ok('현황에 아이 정보가 채워진다', A.text('stat').includes('양 이름'));
ok('소원권 목록이 그려진다', A.text('wishes').length > 0);

/* ── 아이가 없을 때 ── */
group('부모 화면이 끝까지 도는가 — 아이가 하나도 없을 때');

const B = await run(null);
ok('최상위가 에러 없이 끝까지 돈다', !B.err);
if (B.err) console.log('     ', B.err.constructor.name, '—', B.err.message);
for (const id of ['stat', 'progress', 'weak'])
  ok(`#${id}이(가) "불러오는 중…"에서 벗어난다`, !B.text(id).includes('불러오는 중'));
ok('기록이 어디 있는지 알려준다 — 와이파이가 아니라 브라우저 기준',
  B.text('progress').includes('브라우저'));
ok('정적 배포에서는 열자마자 위에 적어둔다', A.text('where').includes('이 브라우저 안'));

/* ── 집 서버 모드 ── */
group('집 서버 모드에서도 도는가 — 두 모드가 갈라지면 안 됩니다');

const C = await run(PROFILE, 'server');
ok('최상위가 에러 없이 끝까지 돈다', !C.err);
if (C.err) console.log('     ', C.err.constructor.name, '—', C.err.message);
for (const id of ['stat', 'progress', 'weak', 'wishes'])
  ok(`#${id}이(가) "불러오는 중…"에서 벗어난다`, !C.text(id).includes('불러오는 중'));
ok('진도에 단원 체크박스가 그려진다', /data-unit=/.test(C.text('progress')));
ok('집 서버 모드에서는 브라우저 안내가 안 뜬다 — 그때는 기기끼리 같은 기록이다',
  !C.text('where').includes('이 브라우저 안'));

/* ── 선언 순서 ── */
group('모듈 최상위 상태는 한 곳에 모여 있는가 (29장)');

const body = HTML.slice(HTML.indexOf('<script type="module">'), HTML.lastIndexOf('</script>'));
const bootAt = body.indexOf('await showStat()');
const late = [...body.matchAll(/^(let|const) ([A-Z][A-Za-z0-9_]*|dirty[A-Za-z]*) =/gm)]
  .filter(m => m.index > bootAt).map(m => m[2]);
ok(`화면을 그리기 시작한 뒤에 선언되는 상태가 없다${late.length ? ` — ${late.join(', ')}` : ''}`,
  !late.length);

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
