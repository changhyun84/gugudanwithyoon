/* 부모와 아이가 동시에 쓸 때 — node test/t_race.mjs

   이 게임에서 프로필은 **통째로** 저장됩니다. 아이 화면은 게임을 연 순간의 사본을 들고
   있다가 문제 다섯 개마다·화면을 내릴 때·탭을 닫을 때 그걸 그대로 씁니다.
   그래서 그 사이에 부모가 진도를 바꾸면 **몇 초 뒤에 지워집니다.**

   부모는 "저장해도 아이 화면에 반영이 안 된다"고 느끼지만, 사실은 반영됐다가
   덮인 것입니다. 실제로 그랬습니다 (구현-현황 34장).

   여기서는 그 순서를 그대로 재현합니다. 두 화면을 다 띄우지 않고, 각 화면이
   실제로 부르는 store.js 함수만 순서대로 부릅니다. */

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

let pass = 0, fail = 0;
const ok = (name, cond) => cond
  ? (pass++, console.log('  ✓', name))
  : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

/* ── 정적 모드 (GitHub Pages) ── */
const bag = {};
globalThis.window = globalThis;
globalThis.GUGUDAN_STATIC = true;
globalThis.localStorage = {
  getItem: k => bag[k] ?? null,
  setItem: (k, v) => { bag[k] = String(v); },
  removeItem: k => { delete bag[k]; },
};
const content = JSON.parse(readFileSync(join(ROOT, 'dist/content.json'), 'utf8'));
globalThis.fetch = async () => ({ ok: true, json: async () => content });

const tmp = mkdtempSync(join(tmpdir(), 'gugudan-race-'));
for (const f of ['store.js', 'engine.js'])
  writeFileSync(join(tmp, f.replace('.js', '.mjs')), readFileSync(join(ROOT, 'web', f)));
const S = await import('file://' + join(tmp, 'store.mjs'));
const E = await import('file://' + join(tmp, 'engine.mjs'));

const seed = () => {
  const p = { ...structuredClone(content.newProfile), id: '테스트', displayName: '테스트' };
  bag['gugudan-profiles'] = JSON.stringify(['테스트']);
  bag['gugudan-profile-테스트'] = JSON.stringify(p);
  return p;
};
const openN = p => E.openPacks(content.packs, p.progress).size;

/* ── 부모가 바꾼 것이 아이 화면 저장에 덮이지 않는가 ── */
group('부모가 진도를 바꾼 뒤 아이 화면이 저장해도 남는가');

seed();
const child = await S.loadProfile('테스트');              // ① 아이가 게임을 연다
const WANT = { units: ['gugudan', '2-3-원'], level: '심화' };
await S.saveParent('테스트', { progress: WANT });         // ② 부모가 바꾼다

let now = await S.loadProfile('테스트');
ok('저장 직후 저장소에 남는다', E.levelOf(now.progress) === '심화' && openN(now) === 2);

child.wallet.grass += 30;
await S.saveProfile(child);                               // ③ 아이가 자동 저장
now = await S.loadProfile('테스트');
ok('아이가 저장해도 부모 진도가 그대로다', E.levelOf(now.progress) === '심화' && openN(now) === 2);
ok('아이가 푼 것도 그대로다', now.wallet.grass === 30);

S.saveOnExit(child);                                      // ④ 탭을 닫는다
now = await S.loadProfile('테스트');
ok('탭을 닫을 때 저장해도 부모 진도가 그대로다', E.levelOf(now.progress) === '심화');

/* ── 거꾸로도 안 되어야 한다 ── */
group('부모가 저장할 때 아이가 푼 것을 되돌리지 않는가');

seed();
const playing = await S.loadProfile('테스트');
playing.wallet.grass = 500;
playing.totals.solved = 40;
await S.saveProfile(playing);                             // 아이가 한참 풀었다
await S.saveParent('테스트', { progress: { units: ['gugudan'], level: '기본' } });
now = await S.loadProfile('테스트');
ok('아이가 모은 풀이 안 줄어든다', now.wallet.grass === 500);
ok('푼 문제 수가 안 줄어든다', now.totals.solved === 40);
ok('부모가 바꾼 것은 들어갔다', E.levelOf(now.progress) === '기본');

/* ── 부모는 자기 몫만 건드린다 ── */
group('부모 화면은 프로필 전체를 쓰지 않는다');

const parentSrc = readFileSync(join(ROOT, 'web/parent.html'), 'utf8');
ok('부모 화면에 saveProfile 호출이 없다', !/store\.saveProfile\(/.test(parentSrc));
ok('진도·끄기·주기가 전부 saveParent를 쓴다',
  (parentSrc.match(/store\.saveParent\(/g) || []).length === 3);
ok('되돌리기만 통째로 쓴다', /store\.restoreProfile\(/.test(parentSrc));

const appSrc = readFileSync(join(ROOT, 'web/app.js'), 'utf8');
ok('아이 화면은 saveParent를 안 쓴다', !/saveParent/.test(appSrc));

/* ── 되돌리기는 그 시점 그대로 ── */
group('되돌리기는 파일에 있는 그대로');

seed();
await S.saveParent('테스트', { progress: { units: ['gugudan'], level: '기본' } });
const backup = { ...structuredClone(content.newProfile), id: '테스트', displayName: '테스트',
                 progress: { units: ['gugudan', '2-3-원', '2-4-분수'], level: '섞어' },
                 wallet: { grass: 99, star: 9 } };
await S.restoreProfile(backup);
now = await S.loadProfile('테스트');
ok('백업 안의 진도까지 돌아간다', openN(now) === 3 && E.levelOf(now.progress) === '섞어');
ok('백업 안의 지갑도 돌아간다', now.wallet.grass === 99);

/* ── 선물은 아이가 지갑에 더한다 ── */
group('풀·별 주기 — 지갑은 아이 화면이 더한다');

seed();
const kid = await S.loadProfile('테스트');
kid.wallet.grass = 100;
await S.saveProfile(kid);
await S.saveParent('테스트', { gifts: [{ id: 'g1', at: '2026-08-27', grass: 50, star: 2, why: '심부름' }] });

now = await S.loadProfile('테스트');
ok('부모는 지갑을 안 건드린다 — 아직 100', now.wallet.grass === 100);
ok('준 기록은 남는다', now.gifts.length === 1);

/* 아이 화면의 takeGift()를 app.js에서 그대로 떼어 온다 */
const grab = (src, name) => {
  const at = src.indexOf(`function ${name}(`);
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
};
let P = now;
const take = new Function('getP', `${grab(appSrc, 'takeGift').replace(/\bP\./g, 'getP().')}
  return takeGift;`)(() => P);

const said = take();
ok('아이 화면이 지갑에 더한다', P.wallet.grass === 150 && P.wallet.star === 2);
ok('받았다고 알려준다', said.includes('풀 50개') && said.includes('별 2개'));
ok('왜 받았는지는 말하지 않는다', !said.includes('심부름'));
ok('두 번 더하지 않는다', take() === '' && P.wallet.grass === 150);
await S.saveProfile(P);
now = await S.loadProfile('테스트');
ok('저장 뒤에도 한 번만 받은 것으로 남는다', now.appliedGifts.length === 1 && now.wallet.grass === 150);

/* 부모가 또 주면 또 받는다 */
await S.saveParent('테스트', { gifts: [...now.gifts, { id: 'g2', at: '2026-08-27', grass: 10, star: 0, why: '' }] });
P = await S.loadProfile('테스트');
take();
ok('새로 준 것은 또 받는다', P.wallet.grass === 160);

/* ── 두 곳의 규칙이 같은가 ── */
group('store.js와 server.py의 부모 몫 목록이 같은가');

const py = execFileSync('python3', ['-c',
  'import json, server; print(json.dumps(list(server.PARENT_FIELDS)))'],
  { cwd: ROOT, encoding: 'utf8' });
ok(`같은 목록이다 — ${S.PARENT_FIELDS.join(', ')}`,
  JSON.parse(py).join(',') === S.PARENT_FIELDS.join(','));

const serverSrc = readFileSync(join(ROOT, 'server.py'), 'utf8');
ok('서버도 아이 화면의 저장에 부모 몫을 얹는다', /adopt_parent\(data, previous\)/.test(serverSrc));
ok('서버에 부모 전용 길이 있다', /def put_parent/.test(serverSrc));
ok('되돌리기만 그대로 쓴다', /restore=1/.test(serverSrc));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
