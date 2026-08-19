/* 60일 시뮬레이션 — 보상 규칙을 건드리기 전에 반드시 먼저 돌린다 (구현-현황 6장)

   확인하는 것 두 가지
     1) 별 잔고가 0에 닿는 날이 90일 이후인가   ← 소비처가 언제 마르는가
     2) 풀 잔고가 계속 증가하기만 하지 않는가

   실행:  node sim/60days.mjs [일수]
   문제 팩이 바뀌면 결과도 바뀐다. 부모가 팩을 넣은 뒤에도 다시 돌려볼 것. */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* engine.js를 그대로 쓴다. node가 .js를 CJS로 읽으므로 확장자만 바꿔 임시 폴더에 둔다. */
const tmp = mkdtempSync(join(tmpdir(), 'gugudan-sim-'));
writeFileSync(join(tmp, 'engine.mjs'), readFileSync(new URL('../web/engine.js', import.meta.url)));
const { buildIndex, seedFacts, makeQuestion, applyResult } =
  await import('file://' + join(tmp, 'engine.mjs'));

/* content/problems를 packs.py로 읽는다 — 게임과 똑같은 파서를 써야 의미가 있다 */
const PACKS = JSON.parse(execFileSync('python3', ['-c', `
import packs, json, pathlib
ps = packs.scan(pathlib.Path('content/problems'))
print(json.dumps([{'id':p['id'],'name':p['name'],'problems':p['problems']}
                  for p in ps if p['count']], ensure_ascii=False))`],
  { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }));

const DAYS = Number(process.argv[2] || 60);
const GOAL = 20;

/* 마스터리별 정답률·힌트 사용률 — 모르는 것일수록 힌트를 더 쓴다 */
const P_RIGHT = [0.45, 0.62, 0.78, 0.88, 0.95];
const P_HINT  = [0.45, 0.30, 0.15, 0.06, 0.02];

/* 상점 재고는 characters.js에서 그대로 읽는다 — 가격표를 두 곳에 두면 반드시 어긋난다 */
writeFileSync(join(tmp, 'characters.mjs'), readFileSync(new URL('../web/characters.js', import.meta.url)));
const { ALL_ITEMS, CHARACTERS, TIER_NEED } = await import('file://' + join(tmp, 'characters.mjs'));

/* 캐릭터는 만날 때마다 **전액**을 낸다 (app.js pickChar: wallet.star -= c.star).
   차액으로 계산하면 별 소비가 절반으로 줄어 시뮬레이션이 낙관적으로 나온다. */
const FRIENDS = CHARACTERS.filter(c => c.star);   // 8+15+25+40 = 88
writeFileSync(join(tmp, 'backgrounds.mjs'), readFileSync(new URL('../web/backgrounds.js', import.meta.url)));
const { BACKGROUNDS: BG_LIST } = await import('file://' + join(tmp, 'backgrounds.mjs'));
const BACKGROUNDS = BG_LIST.filter(b => b.star).map(b => b.star);   // 무료 배경 제외 (누적 83)

const WISH_COST = 12;      // content/wishes.csv 평균
const ALLOW_PER_WEEK = 500;   // 용돈 상한 (data/settings.json 기본값). 주 1회

function simulate({ story = false, wishes = true, allowance = true, days = DAYS } = {}) {
  const index = buildIndex(PACKS);
  const facts = {};
  seedFacts(index, facts);

  const keysOf = {};
  for (const [k, e] of Object.entries(index)) if (e.rewardable) (keysOf[e.packId] ||= []).push(k);

  let grass = 0, star = 0, mastered = 0, stickers = 0, story12 = 0;
  let starSpent = 0, grassSpent = 0, friends = 0, bg = 0, dryDay = null, wishCount = 0;
  const recent = [], packDone = new Set(), bought = new Set(), rows = [];
  const met = new Set(['sheep']);
  let allowWon = 0;

  for (let d = 0; d < days; d++) {
    const today = new Date(Date.UTC(2026, 8, 1) + d * 86400000).toISOString().slice(0, 10);

    for (let i = 0; i < GOAL; i++) {
      const q = makeQuestion(index, facts, recent, today);
      recent.push(q.key); if (recent.length > 3) recent.shift();
      const f = facts[q.key];
      const hint  = Math.random() < P_HINT[f.m];
      const right = Math.random() < P_RIGHT[f.m] + (hint ? 0.12 : 0);

      grass += 3 + (right && !hint ? 3 : right ? 1 : 0);          // 기본 3 + 정답 보너스
      if (applyResult(index[q.key], f, right, hint, today, 4000)) {
        mastered++; star++; stickers++;
        if (stickers % 12 === 0) star += 3;                        // 도감 한 판
      }
    }

    if (story) { story12 += 2; while (story12 >= 12) { story12 -= 12; star += 3; } }  // 이야기 판 (6C)
    if ((d + 1) % 7 === 0) star += 3;                              // 7일 누적 출석
    for (const [pid, ks] of Object.entries(keysOf))                // 팩 전체 마스터
      if (!packDone.has(pid) && ks.every(k => facts[k].m === 4)) { packDone.add(pid); star += 5; }

    while (friends < FRIENDS.length && star - starSpent >= FRIENDS[friends].star)
      { starSpent += FRIENDS[friends].star; met.add(FRIENDS[friends].id); friends++; }
    while (bg < BACKGROUNDS.length && star - starSpent >= BACKGROUNDS[bg])
      { starSpent += BACKGROUNDS[bg]; bg++; }
    // 소원권 — 고갈되지 않는 소비처. 친구·배경을 다 산 뒤 남는 별을 여기서 쓴다
    if (wishes && friends === FRIENDS.length && bg === BACKGROUNDS.length)
      while (star - starSpent >= WISH_COST) { starSpent += WISH_COST; wishCount++; }

    if (dryDay === null && friends === FRIENDS.length && bg === BACKGROUNDS.length && !wishes) dryDay = d + 1;

    /* 용돈 — 주 1회, 아이템을 사고 남은 풀에서. 고갈되지 않는 풀 소비처 (구현-현황 17) */
    if (allowance && d % 7 === 6) {
      const spare = Math.min(ALLOW_PER_WEEK, Math.floor((grass - grassSpent) / 100) * 100);
      if (spare > 0) { grassSpent += spare; allowWon += spare / 100 * 200; }
    }

    // 열린 선반에서 살 수 있는 것을 싼 것부터. 전용은 그 친구를 만났을 때만
    const tier = TIER_NEED.reduce((t, need, i) => mastered >= need ? i + 1 : t, 1);
    for (const it of ALL_ITEMS) {
      if (bought.has(it.id) || (it.tier || 1) > tier) continue;
      if (it.only && !met.has(it.only)) continue;   // 아직 못 만난 친구의 전용은 못 산다
      if (grass - grassSpent < it.price) continue;
      grassSpent += it.price; bought.add(it.id);
    }

    if ([13, 29, 44, 59, 89, 119, 179].includes(d) && d < days)
      rows.push({ 일: d + 1, 마스터: mastered, 별번: star, 별잔고: star - starSpent,
                  친구: 1 + friends, 배경: 1 + bg,
                  풀번: grass, 풀잔고: grass - grassSpent, 소원권: wishCount, 용돈: allowWon, 산것: bought.size + '/' + ALL_ITEMS.length });
  }
  return { rows, dryDay, mastered, wishCount, allowWon };
}

const total = Object.values(buildIndex(PACKS)).filter(e => e.rewardable).length;
console.log(`별을 주는 문제 ${total}개 (쉬운 구구단 24개는 제외 — 구현-현황 2.1)`);
console.log(`아이템 ${ALL_ITEMS.length}종 · 총액 ${ALL_ITEMS.reduce((s, i) => s + i.price, 0)}풀`);
TIER_NEED.forEach((need, i) => {
  if (need > total) console.log(`  ⚠ 상점 ${i + 1}단계 조건 ${need}문제 마스터는 **도달 불가**`);
});

const bare = simulate({ wishes: false, allowance: false, days: Math.max(DAYS, 90) });
console.log(`\n■ 소원권·용돈 없이 — 별 소비처가 마르는 날: ${bare.dryDay ?? '안 마름'}`);
console.table(bare.rows);

for (const story of [false, true]) {
  const r = simulate({ story, days: Math.max(DAYS, 90) });
  console.log(`\n■ 5B 전부 ${story ? '+ 6C 이야기 판까지' : '(지금 상태)'}` +
    `  — 소원권 ${r.wishCount}장 · 용돈 ${r.allowWon.toLocaleString()}원`);
  console.table(r.rows);
}
