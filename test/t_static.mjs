/* 정적 배포 검사 — node test/t_static.mjs

   집 서버와 GitHub Pages 두 곳에서 **같은 코드**가 돌아야 합니다.
   갈라지면 한쪽만 고치는 날이 오고, 그날 친구들 화면이 조용히 멈춥니다.

   여기서는 정적 모드를 node 안에서 흉내내 `dist/content.json`으로 실제 왕복을 시킵니다. */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

let pass = 0, fail = 0;
const ok = (name, cond) => cond ? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

/* ── 빌드 ── */
group('빌드');

const out = execFileSync('python3', ['sim/build-static.py'], { cwd: ROOT, encoding: 'utf8' });
ok('빌드가 돈다', out.includes('dist/'));
ok('경고 0개', out.includes('경고 0개'));

const DIST = join(ROOT, 'dist');
for (const f of ['index.html', 'parent.html', 'content.json', 'app.js', 'store.js',
                 'engine.js', 'characters.js', 'backgrounds.js', 'styles.css',
                 'manifest.json', '.nojekyll', '404.html', 'icons/icon-192.png'])
  ok(`${f}가 있다`, existsSync(join(DIST, f)));

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const phtml = readFileSync(join(DIST, 'parent.html'), 'utf8');

/* ── GitHub Pages는 /저장소/ 아래에 올라간다 ── */
group('경로 — Pages는 도메인 뿌리가 아니다');

for (const [name, src] of [['index.html', html], ['parent.html', phtml]]) {
  ok(`${name}에 절대 경로가 없다`, !/(href|src)="\/(?!\/)/.test(src) && !src.includes("from '/"));
}
ok('정적이라는 표시가 심겨 있다', html.includes('GUGUDAN_STATIC') && phtml.includes('GUGUDAN_STATIC'));
ok('web/에는 그 표시가 없다 — 집 서버는 서버 모드다',
  !readFileSync(join(ROOT, 'web/index.html'), 'utf8').includes('GUGUDAN_STATIC'));

const mf = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
ok('manifest의 start_url이 상대 경로', mf.start_url === './');
ok('manifest의 아이콘도 상대 경로', mf.icons.every(i => i.src.startsWith('./')));
ok('404는 자산을 안 부른다', !/(src|href)="\.\/(app|styles|content)/.test(readFileSync(join(DIST, '404.html'), 'utf8')));

/* ── content.json ── */
group('content.json');

const C = JSON.parse(readFileSync(join(DIST, 'content.json'), 'utf8'));
ok('팩이 실려 있다', C.packs.length >= 17);
ok('문제까지 같이 실려 있다 — 정적에는 /api/pack이 없다',
  C.packs.every(p => Array.isArray(p.problems)));
ok('과목·단원이 실려 있다', C.packs.every(p => 'subject' in p && 'unit' in p));
ok('응원 메시지가 실려 있다', Object.keys(C.messages).length > 0);
ok('소원권이 실려 있다', C.wishes.length > 0);
ok('용돈 설정이 실려 있다', C.settings.allowance && C.settings.allowance.on === false);
ok('새 프로필 모양이 실려 있다 — server.py가 정한 그대로',
  C.newProfile && C.newProfile.wallet && C.newProfile.collection && C.newProfile.progress);
ok('빌드 날짜가 있다', !!C.builtAt);

/* ── 정적 모드로 실제 왕복 ── */
group('정적 모드 — 브라우저 없이 왕복시킨다');

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
globalThis.window = { GUGUDAN_STATIC: true };
globalThis.fetch = async url =>
  ({ json: async () => JSON.parse(readFileSync(join(DIST, String(url).replace(/^\.\//, '')), 'utf8')) });

const tmp = mkdtempSync(join(tmpdir(), 'gugudan-static-'));
writeFileSync(join(tmp, 'store.mjs'), readFileSync(join(ROOT, 'web/store.js')));
const store = await import('file://' + join(tmp, 'store.mjs'));

ok('정적 모드로 잡힌다', store.STATIC === true);

const boot = await store.bootstrap();
ok('처음엔 프로필이 없다', boot.profiles.length === 0);
ok('문제가 없는 팩은 아이에게 안 보낸다', boot.packs.every(p => p.count > 0));
ok('팩 메타에 과목·단원이 있다', boot.packs.every(p => 'subject' in p));

const made = await store.createProfile('지우');
ok('프로필을 만든다', made.id === '지우' && made.displayName === '지우');
ok('만든 날이 찍힌다', /^\d{4}-\d{2}-\d{2}$/.test(made.createdAt));
ok('서버가 정한 모양 그대로다', made.wallet.grass === 0 && made.shopTier === 1);

ok('같은 이름은 두 번 못 만든다', (await store.createProfile('지우')).error);
ok('이상한 이름은 거절한다', (await store.createProfile('../etc')).error);

made.wallet.star = 7;
made.collection.stickers.push('gugudan:7x8');
await store.saveProfile(made);
const back = await store.loadProfile('지우');
ok('저장한 것이 그대로 돌아온다', back.wallet.star === 7 && back.collection.stickers.length === 1);

const boot2 = await store.bootstrap();
ok('프로필 목록에 뜬다', boot2.profiles.length === 1 && boot2.profiles[0].displayName === '지우');

ok('나가는 순간에도 저장된다', store.saveOnExit(back) === true);

const pack = await store.loadPack(boot.packs[0].id);
ok('팩 하나를 문제까지 읽어온다', pack && pack.problems.length > 0);
ok('없는 팩은 null', (await store.loadPack('없는팩')) === null);

/* ── 부모 화면 ── */
group('부모 화면도 같은 저장소를 쓴다');

ok('PIN이 틀리면 거절', (await store.parentPacks('9999')).error);
const pp = await store.parentPacks('0000');
ok('기본 PIN 0000으로 열린다', !!pp.packs);
ok('경고까지 실려 온다 — 부모는 빠진 문제를 알아야 한다', pp.packs.every(p => Array.isArray(p.warnings)));
ok('소원권 경고도 온다', !!pp.wishes && Array.isArray(pp.wishes.warnings));

ok('설정이 저장된다', (await store.saveSettings('0000', { defaultGoal: 25 })).saved);
ok('저장한 설정이 bootstrap에 반영된다', (await store.bootstrap()).settings.defaultGoal === 25);
ok('PIN을 바꾸면 그게 적용된다',
  (await store.saveSettings('0000', { parentPin: '1234' })).saved &&
  !!(await store.parentPacks('0000')).error &&
  !!(await store.parentPacks('1234')).packs);

/* ── 두 모드가 갈라지지 않았나 ── */
group('두 모드가 갈라지지 않았나');

const appSrc = readFileSync(join(ROOT, 'web/app.js'), 'utf8');
ok('app.js가 /api/를 직접 부르지 않는다', !appSrc.includes('/api/'));
ok('parent.html이 /api/를 직접 부르지 않는다',
  !readFileSync(join(ROOT, 'web/parent.html'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('//') && !l.includes('/* ')).join('\n')
    .replace(/\/\/.*$/gm, '').includes("api('/api/"));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
