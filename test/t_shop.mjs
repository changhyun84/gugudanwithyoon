/* 상점 단계·전용 아이템 검사 — node test/t_shop.mjs

   `characters.js`는 그대로 import하고, `app.js`에서는 순수 함수만 떼어 씁니다.

   가장 중요한 것은 **단계가 내려가지 않는 것**입니다 (기획서 원칙 2.1 / 구현-현황 2.9).
   `P.totals.mastered`가 줄어드는 상황(부모가 문제를 끄는 등)에서도 선반은 닫히면 안 됩니다. */

import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* node가 .js를 CJS로 읽으므로 확장자만 바꿔 임시 폴더에서 import한다 */
const tmp = mkdtempSync(join(tmpdir(), 'gugudan-shop-'));
writeFileSync(join(tmp, 'characters.mjs'), readFileSync(new URL('../web/characters.js', import.meta.url)));
const C = await import('file://' + join(tmp, 'characters.mjs'));

const SRC = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

function grab(name) {
  let at = SRC.indexOf(`function ${name}(`);
  if (at >= 0) {
    let depth = 0;
    for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
      if (SRC[i] === '{') depth++;
      else if (SRC[i] === '}' && --depth === 0) return SRC.slice(at, i + 1);
    }
  }
  at = SRC.indexOf(`const ${name} = `);          // 화살표 함수도 떼어낸다
  if (at >= 0) {
    let depth = 0;
    for (let i = at; i < SRC.length; i++) {
      if ('([{'.includes(SRC[i])) depth++;
      else if (')]}'.includes(SRC[i])) depth--;
      else if (SRC[i] === ';' && depth === 0) return SRC.slice(at, i + 1);
    }
  }
  throw new Error(`app.js에 ${name}이(가) 없습니다`);
}

let P = null;
const body = ['catchUpTier', 'buyable', 'wearable', 'nextShelf'].map(grab).join('\n');
const shop = new Function('tierOf', 'getP', `
  ${body.replace(/\bP\./g, 'getP().')}
  return { catchUpTier, buyable, wearable, nextShelf };
`)(C.tierOf, () => P);

let pass = 0, fail = 0;
const ok = (name, cond) => cond
  ? (pass++, console.log('  ✓', name))
  : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

const profile = (mastered = 0, tier = 1, unlocked = ['sheep'], grass = 0) => ({
  totals: { mastered }, shopTier: tier, settings: {},
  wallet: { grass, star: 0 }, characters: { unlocked },
  inventory: { items: [] },
});

/* ── 단계 경계 ── */
group('단계 경계 (기획서 8.3)');
const at = [[0, 1], [9, 1], [10, 2], [24, 2], [25, 3], [49, 3], [50, 4], [64, 4], [65, 5], [999, 5]];
ok('0·10·25·50·65에서 열림', at.every(([m, t]) => C.tierOf(m) === t));
ok('5단계 조건이 별을 주는 문제 수 안', C.TIER_NEED[4] <= 75);

/* ── 단계는 내려가지 않는다 (원칙 2.9) ── */
group('단계는 내려가지 않는다 — 이게 깨지면 어제 살 수 있던 물건이 사라집니다');

P = profile(25, 1);
ok('마스터 25 → 3단계로 열림', shop.catchUpTier() === 3 && P.shopTier === 3);
ok('열린 단계는 알림이 남음', P.settings.newTier === 3);
ok('같은 상태 재호출 → 0', shop.catchUpTier() === 0);

P = profile(0, 4);            // 부모가 문제를 꺼서 마스터 수가 줄어든 상황
ok('마스터가 0이어도 4단계 유지', shop.catchUpTier() === 0 && P.shopTier === 4);

P = profile(65, 2);
ok('건너뛴 단계도 한 번에 5로', shop.catchUpTier() === 5 && P.shopTier === 5);

/* ── 살 수 있는 것 ── */
group('살 수 있는 것');

P = profile(0, 1, ['sheep']);
ok('1단계에는 tier 1만', C.ALL_ITEMS.filter(shop.buyable).every(i => (i.tier || 1) === 1));

/* 첫 선반이 얇으면 아이는 이틀 만에 다 사고 살 게 없어집니다 — 실제로 그랬습니다(구현-현황 26장).
   v1은 13종이 처음부터 다 보였습니다. 그 아래로 내려가지 않게 못을 박습니다. */
const shelf1 = C.ALL_ITEMS.filter(shop.buyable);
ok(`1단계 ${shelf1.length}종 — v1의 13종 이상`, shelf1.length >= 13);
ok('1단계에 세 슬롯이 다 있다', new Set(shelf1.map(i => C.slotOf(i.id))).size === 3);

/* 선반은 단계마다 넓어져야 합니다. 어느 단계에서 0개가 늘면 그 단계는 보상이 아닙니다 */
const shelfAt = t => C.ALL_ITEMS.filter(i => !i.only && (i.tier || 1) <= t).length;
ok('단계마다 공용이 늘어난다', [1, 2, 3, 4].every(t => shelfAt(t + 1) > shelfAt(t)));

P = profile(65, 5, ['sheep']);
ok('양만 있으면 남의 전용은 안 보임',
  C.ALL_ITEMS.filter(shop.buyable).every(i => !i.only || i.only === 'sheep'));
const soloCount = C.ALL_ITEMS.filter(shop.buyable).length;

P = profile(65, 5, ['sheep', 'cat', 'rabbit', 'koala', 'capybara']);
ok('다 만나면 전부 보임', C.ALL_ITEMS.filter(shop.buyable).length === C.ALL_ITEMS.length);
ok('친구를 만나면 살 게 늘어난다', C.ALL_ITEMS.length > soloCount);

/* ── 입을 수 있는 것 ── */
group('입을 수 있는 것');
const rbow = C.ALL_ITEMS.find(i => i.id === 'hrbow');
ok('토끼 전용은 토끼만', shop.wearable(rbow, 'rabbit') && !shop.wearable(rbow, 'sheep'));
ok('공용은 누구나', C.ALL_ITEMS.filter(i => !i.only).every(i => shop.wearable(i, 'koala')));

/* ── 다음 선반 안내 ── */
group('다음 선반 안내');
P = profile(3, 1);
ok('1단계에서 7개 남음', shop.nextShelf().includes('7개'));
P = profile(65, 5);
ok('5단계에서는 안내 없음', shop.nextShelf() === '');
P = profile(12, 2);
ok('열릴 때가 됐으면 다른 문구', shop.nextShelf().includes('13개'));

/* ── 아이템 데이터 ── */
group('아이템 데이터');

const ids = C.ALL_ITEMS.map(i => i.id);
ok('id 중복 없음', new Set(ids).size === ids.length);
ok('모든 아이템에 슬롯이 있음', C.ALL_ITEMS.every(i => C.slotOf(i.id)));
ok('가격이 전부 양수', C.ALL_ITEMS.every(i => i.price > 0));
ok('tier는 1~5', C.ALL_ITEMS.every(i => (i.tier || 1) >= 1 && (i.tier || 1) <= 5));

const charIds = C.CHARACTERS.map(c => c.id);
ok('only는 실재하는 캐릭터', C.ALL_ITEMS.every(i => !i.only || charIds.includes(i.only)));
ok('캐릭터마다 전용 3개', charIds.every(id => C.ALL_ITEMS.filter(i => i.only === id).length === 3));
ok('전용은 슬롯마다 하나씩', charIds.every(id =>
  new Set(C.ALL_ITEMS.filter(i => i.only === id).map(i => C.slotOf(i.id))).size === 3));
ok('전용 15종', C.ALL_ITEMS.filter(i => i.only).length === 15);

const total = C.ALL_ITEMS.reduce((s, i) => s + i.price, 0);
ok(`총액 ${total}풀 — 60일 수입(약 6,000)보다 많음`, total > 6000);
ok(`${C.ALL_ITEMS.length}종`, C.ALL_ITEMS.length === 48);

/* 값과 단계는 **내리는 것만** 안전합니다 (원칙 2.1). 올리면 어제 살 수 있던 게 오늘 사라집니다.
   이미 나간 아이템의 값·단계를 여기 박아둡니다. 이 표를 고쳐야 통과한다면, 고치기 전에 왜인지 보세요. */
const SHIPPED = {
  leaf: [60, 1], straw: [90, 1], ribbon: [120, 1], beanie: [170, 2], party: [220, 2],
  star: [300, 2], crown: [450, 2], sred: [70, 1], sblue: [70, 1], syel: [110, 1],
  bow: [160, 2], bell: [230, 2], rain: [380, 2], pballoon: [180, 2], pbook: [260, 2],
  hflower: [220, 3], hmoon: [250, 3], hrbow: [280, 3], hleaf: [310, 3], horange: [340, 3],
  nknit: [360, 4], nfish: [400, 4], ncarrot: [430, 4], neuca: [460, 4], ntowel: [500, 4],
  pbell: [520, 5], pwand: [570, 5], pclover: [600, 5], pbranch: [640, 5], pduck: [700, 5],
};
const raised = Object.entries(SHIPPED).filter(([id, [pr, ti]]) => {
  const it = C.itemById(id);
  return !it || it.price > pr || (it.tier || 1) > ti;
});
ok('나간 아이템의 값·단계가 오르지 않음', !raised.length);
if (raised.length) console.log('     올랐거나 사라짐:', raised.map(([id]) => id).join(', '));

/* ── 앵커 ── */
group('앵커');
ok('모든 캐릭터에 세 슬롯 앵커', C.CHARACTERS.every(c => c.anchor.hat && c.anchor.neck && c.anchor.prop));
ok('양은 배율이 없다 (v1 그대로)', C.CHARACTERS[0].anchor.hat.length === 2);

/* ── 그리기 ── */
group('그리기 — 캐릭터 × 아이템 전 조합');

/* 아이템이 실제로 그려지는지부터 본다. 정의만 있고 그림이 없으면
   화면에는 아무 일도 안 일어나면서 풀만 빠져나간다 — 조용히 통과하면 안 되는 사고다. */
const naked = C.charSVG('sheep', {}, '').length;
const undrawn = C.ALL_ITEMS.filter(it =>
  C.charSVG('sheep', { [C.slotOf(it.id)]: it.id }, '').length <= naked);
ok(`${C.ALL_ITEMS.length}종이 전부 그려짐`, !undrawn.length);
if (undrawn.length) console.log('     그림 없음:', undrawn.map(i => i.id).join(', '));

let bad = [];
for (const c of C.CHARACTERS)
  for (const it of C.ALL_ITEMS) {
    const svg = C.charSVG(c.id, { [C.slotOf(it.id)]: it.id }, 'happy');
    if (!svg.startsWith('<svg') || svg.includes('NaN') || svg.includes('undefined')) bad.push(`${c.id}/${it.id}`);
  }
ok(`${C.CHARACTERS.length * C.ALL_ITEMS.length}개 조합 전부 정상`, !bad.length);
if (bad.length) console.log('    ', bad.slice(0, 8).join(', '));

const all3 = C.charSVG('cat', { hat: 'hmoon', neck: 'nfish', prop: 'pwand' }, '');
ok('세 슬롯 동시 착용', (all3.match(/<g transform="translate/g) || []).length === 3);

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
