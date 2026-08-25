/* 부모 화면 정리와 풀·별 주기 검사 — node test/t_parent.mjs

   부모 화면은 jsdom 없이 검사합니다. `parent.html`에서 순수 함수와 표시 문자열만 떼어
   확인하고, 나머지는 **있어야 할 것이 있고 지운 것이 안 남았는지**를 봅니다.

   ES 모듈이라 이름 하나가 어긋나면 부모 화면 스크립트가 통째로 조용히 죽습니다(2.12).
   그래서 import 이름 검사가 여기서 가장 중요합니다. */

import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HTML = readFileSync(new URL('../web/parent.html', import.meta.url), 'utf8');
const APP = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'gugudan-parent-'));
writeFileSync(join(tmp, 'engine.mjs'), readFileSync(new URL('../web/engine.js', import.meta.url)));
const E = await import('file://' + join(tmp, 'engine.mjs'));

let pass = 0, fail = 0;
const ok = (name, cond) => cond
  ? (pass++, console.log('  ✓', name))
  : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

/* ── 지운 것 ── */
group('과감히 지운 것 — 남아 있으면 부모가 또 헷갈립니다');

for (const [what, mark] of [
  ['v1 기록 가져오기', 'fromV1'],
  ['v1 붙여넣기 칸', "id=\"v1\""],
  ['따로 있던 문제 팩 칸', '<h2>문제 팩</h2>'],
  ['따로 있던 PIN 칸', '<h2>PIN</h2>'],
  ['"여기까지" 고르는 상자', 'data-sel='],
]) ok(`${what}이(가) 없다`, !HTML.includes(mark));

ok('지운 함수를 부르는 곳이 안 남았다', !HTML.includes('saveProgress(') && !HTML.includes("$('packs')"));
ok('지운 import가 안 남았다', !/isRewardable/.test(HTML));

/* ── 남긴 것 ── */
group('남긴 것');

for (const [what, mark] of [
  ['학습 진도', '<h2>학습 진도'],
  ['풀·별 주기', '<h2>풀 · 별 주기</h2>'],
  ['소원권', '<h2>소원권</h2>'],
  ['요즘 어려워하는 문제', '<h2>요즘 어려워하는 문제</h2>'],
  ['기록 내보내기', '기록 내보내기'],
  ['문제 하나씩 끄기', '문제 하나씩 끄기'],
]) ok(`${what}이(가) 있다`, HTML.includes(mark));

ok('문제 하나씩 끄기는 접혀 있다 — 자주 쓰는 것이 아니다',
  /<details>[\s\S]{0,400}문제 하나씩 끄기/.test(HTML));

/* ── import ── */
group('engine.js에서 가져오는 이름 (이게 어긋나면 화면 전체가 조용히 죽습니다)');

const imported = (/import\s*\{([^}]+)\}\s*from\s*'\/engine\.js'/.exec(HTML)?.[1] || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const missing = imported.filter(n => !(n in E));
ok(`가져오는 이름이 전부 있다 (${imported.join(', ')})`, imported.length && !missing.length);
if (missing.length) console.log('     없는 이름:', missing.join(', '));

const idUsed = [...HTML.matchAll(/\$\('([A-Za-z0-9]+)'\)/g)].map(m => m[1]);
const noId = [...new Set(idUsed)].filter(i => !HTML.includes(`id="${i}"`));
ok('쓰는 id가 전부 화면에 있다', !noId.length);
if (noId.length) console.log('     없는 id:', noId.join(', '));

/* ── 진도 저장 ── */
group('진도 저장');

ok('고른 단원 목록으로 저장한다', /fresh\.progress = \{ units/.test(HTML));
ok('난이도도 같이 저장한다', /fresh\.progress = \{ units, level \}/.test(HTML));
ok('난이도 세 가지를 engine.js에서 받아 쓴다 — 이름을 두 곳에 두면 어긋난다',
  /import \{[^}]*\bLEVELS\b/.test(HTML) && HTML.includes('LEVELS.map'));
ok('심화만 고르면 무엇이 빠지는지 말해준다', HTML.includes('구구단은 안 나옵니다'));
ok('낼 수 있는 문제가 적으면 알려준다', /같은 문제가 자주 돌아옵니다/.test(HTML));
ok('저장할 때 프로필을 다시 받아 얹는다 (2.11)',
  /store\.loadProfile\(PROFILE\.id\)[\s\S]{0,400}saveProfile\(fresh\)/.test(HTML));
ok('팩 단위 끄기는 진도로 합쳐졌다 — 겹치면 부모가 이유를 알 수 없다',
  /fresh\.disabled\.packs = \[\]/.test(HTML));
ok('하나도 안 켜면 한 번 더 묻는다', /단원을 하나도 안 켜면/.test(HTML));
ok('부모 화면과 엔진이 같은 openPacks를 쓴다',
  imported.includes('openPacks') && HTML.includes('openPacks(PACKS'));
ok('부모는 안 연 단원도 본다', HTML.includes('buildIndexAll(loaded)'));

/* ── 풀·별 주기 ── */
group('풀 · 별 주기');

ok('풀과 별을 따로 준다', HTML.includes("id=\"giveGrass\"") && HTML.includes("id=\"giveStar\""));
ok('기록이 남는다', /\(fresh\.gifts \|\|= \[\]\)\.push/.test(HTML));
ok('아이 상태 위에 얹는다 — 지금 놀고 있을 수 있다',
  /store\.loadProfile\(PROFILE\.id\)[\s\S]{0,600}fresh\.wallet\.grass/.test(HTML));
ok('0 아래로는 안 내려간다', /Math\.max\(0, \(fresh\.wallet\.grass/.test(HTML));
ok('뺄 때는 한 번 더 묻는다 (원칙 2.1)', /grass < 0 \|\| star < 0[\s\S]{0,200}confirm/.test(HTML));
ok('이유 칸은 부모 메모다 — 아이에게 안 보인다고 적혀 있다',
  HTML.includes('아이에게는 안 보입니다'));

/* 아이 화면 쪽 */
ok('아이 화면이 받은 것을 한 번만 알린다', /function takeGift\(\)/.test(APP));
ok('알린 것은 표시해 둔다', /g\.seen = true/.test(APP));
ok('받은 금액은 말하되 이유는 말하지 않는다',
  /엄마 아빠가 \$\{bits/.test(APP) && !/g\.why/.test(APP.slice(APP.indexOf('function takeGift'), APP.indexOf('function catchUpTier'))));

/* ── 이름 ── */
group('이름');

const files = ['../web/index.html', '../web/manifest.json', '../web/parent.html', '../sim/build-static.py']
  .map(f => readFileSync(new URL(f, import.meta.url), 'utf8'));
ok('네 곳 모두 "흰양이와 공부하기"', files.every(t => t.includes('흰양이와 공부하기')));
ok('예전 이름이 안 남았다', !files.some(t => t.includes('양이랑 구구단')));

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
