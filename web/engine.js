/* 출제·마스터리 엔진.
   내장 구구단(계산으로 만드는 문제)과 부모 팩(파일에서 읽은 문제)을 한 인덱스로 다룬다. */

export const GUGUDAN = 'gugudan';

/* 진짜 외워야 하는 15개 — 앞에서부터 3개씩 열린다 */
export const TARGETS = [[3,3],[3,4],[3,6],[4,4],[3,7],[4,6],[3,8],[4,7],[6,6],[4,8],[6,7],[7,7],[6,8],[7,8],[8,8]];

/* 자신감용 — 이미 규칙이 있어 쉬운 것들 */
export const EASY = [];
[2, 5, 9].forEach(a => [2, 3, 4, 5, 6, 7, 8, 9].forEach(b => {
  const k = a < b ? [a, b] : [b, a];
  if (!EASY.some(f => f[0] === k[0] && f[1] === k[1])) EASY.push(k);
}));

export const factKey = (a, b) => `${GUGUDAN}:${Math.min(a, b)}x${Math.max(a, b)}`;

/* 문제 하나의 정의:
   packId, order, gated(앞 3개 규칙 적용), rewardable(마스터 시 별), start(처음 마스터리)
   mul이 있으면 계산으로 만들고, 없으면 파일에서 온 고정 문제다. */
export function buildIndex(packs = []) {
  const index = {};

  TARGETS.forEach(([a, b], i) => {
    index[factKey(a, b)] = { packId: GUGUDAN, packName: '구구단', order: i,
                             mul: [a, b], gated: true, rewardable: true, start: 0 };
  });
  EASY.forEach(([a, b], i) => {
    index[factKey(a, b)] = { packId: GUGUDAN, packName: '구구단', order: 100 + i,
                             mul: [a, b], gated: false, rewardable: false, start: 2 };
  });

  packs.forEach(pack => pack.problems.forEach(q => {
    index[q.key] = { packId: pack.id, packName: pack.name, order: q.order,
                     prompt: q.prompt, answer: q.answer, choices: q.choices, hint: q.hint,
                     gated: true, rewardable: true, start: 0 };
  }));

  return index;
}

export function packList(index) {
  const seen = new Map();
  for (const e of Object.values(index)) if (!seen.has(e.packId)) seen.set(e.packId, e.packName);
  return [...seen].map(([id, name]) => ({ id, name }));
}

/* 없는 문제만 채운다 — 이미 푼 진도는 건드리지 않는다 */
export function seedFacts(index, facts) {
  for (const [key, entry] of Object.entries(index)) {
    if (!facts[key]) facts[key] = { m: entry.start, seen: 0, right: 0, lastSeenDay: null, masteredAt: null, bestMs: null };
  }
}

/* 한 번에 새로 배우는 것은 팩마다 3개.
   다만 출제 후보가 이만큼도 안 되면 같은 문제가 반복되므로 다음 문제를 미리 연다. */
const NEW_AT_ONCE = 3;
const MIN_POOL = 8;

function openKeys(index, facts, packId) {
  const byPack = {};
  for (const [key, e] of Object.entries(index)) {
    if (!e.gated || (packId && e.packId !== packId)) continue;
    (byPack[e.packId] ||= []).push([key, e.order]);
  }

  const open = new Set();
  const waiting = [];   // 아직 안 연 문제 — 풀이 모자랄 때 순서대로 꺼낸다
  for (const list of Object.values(byPack)) {
    list.sort((x, y) => x[1] - y[1]);
    let n = 0;
    for (const [key] of list) {
      if (facts[key].m >= 3) continue;
      if (n < NEW_AT_ONCE) { open.add(key); n++; }
      else if (facts[key].m === 0) waiting.push(key);
    }
  }

  let pool = poolSize(index, facts, packId, open);
  while (pool < MIN_POOL && waiting.length) { open.add(waiting.shift()); pool++; }
  return open;
}

function poolSize(index, facts, packId, open) {
  let n = 0;
  for (const [key, e] of Object.entries(index)) {
    if (packId && e.packId !== packId) continue;
    if (!e.gated || facts[key].m > 0 || open.has(key)) n++;
  }
  return n;
}

function weightOf(key, entry, fact, open, today) {
  if (entry.gated && fact.m === 0 && !open.has(key)) return 0;   // 아직 안 연 것은 잠금
  const base = { 0: 14, 1: 8, 2: 3.5, 3: 1.6, 4: 0.8 }[fact.m];
  const rested = fact.lastSeenDay && daysBetween(fact.lastSeenDay, today) >= 3;
  return rested ? base * 1.5 : base;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function pickKey(index, facts, recent, today, packId = null) {
  const open = openKeys(index, facts, packId);

  const build = skip => {
    const pool = [];
    let total = 0;
    for (const [key, entry] of Object.entries(index)) {
      if (skip.includes(key)) continue;
      if (packId && entry.packId !== packId) continue;
      const w = weightOf(key, entry, facts[key], open, today);
      if (w > 0) { pool.push([key, w]); total += w; }
    }
    return { pool, total };
  };

  // 최근에 나온 것은 빼되, 그러면 낼 게 없어지는 경우에는 직전 문제만 뺀다
  let { pool, total } = build(recent);
  if (!pool.length) ({ pool, total } = build(recent.slice(-1)));
  if (!pool.length) return recent[recent.length - 1] || Object.keys(index)[0];

  let r = Math.random() * total;
  for (const [key, w] of pool) { r -= w; if (r <= 0) return key; }
  return pool[0][0];
}

/* 힌트: 세지 않고 건너뛰는 방법 */
export function bridge(a, b) {
  const pri = { 2: 1, 5: 2, 9: 3, 4: 4, 8: 5, 3: 6, 6: 7, 7: 8 };
  let x = a, y = b;
  if (pri[a] < pri[b]) { x = b; y = a; }
  switch (y) {
    case 2: return `${x}을(를) 두 번 더하면 돼. ${x} + ${x} = ?`;
    case 5: return `${x}×10 = ${x * 10}. 그 반이 답이야.`;
    case 9: return `${x}×10 = ${x * 10}. 거기서 ${x}을(를) 빼면 돼.`;
    case 4: return `${x}×2 = ${x * 2}. 그걸 한 번 더 두 배 하면 돼.`;
    case 8: return `${x}×4 = ${x * 4}. 그걸 두 배 하면 돼.`;
    case 6: return `${x}×3 = ${x * 3}. 그걸 두 배 하면 돼.`;
    case 3: return `${x}×2 = ${x * 2}. 거기에 ${x}을(를) 더하면 돼.`;
    case 7: return `${x}×5 = ${x * 5} 하고 ${x}×2 = ${x * 2}. 둘을 더하면 돼.`;
  }
  return `${x}을(를) ${y}번 더한 값이야.`;
}

/* 아이가 실제로 헷갈리는 값으로 오답을 만든다 */
export function makeChoices(a, b) {
  const ans = a * b;
  const set = [ans];
  const cands = [a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b, ans + 2, ans - 2, ans + 10, ans - 10, (a + 1) * (b - 1)];
  cands.sort(() => Math.random() - .5);
  for (const c of cands) {
    if (set.length >= 4) break;
    if (c > 0 && !set.includes(c)) set.push(c);
  }
  while (set.length < 4) {
    const g = ans + Math.ceil(Math.random() * 9);
    if (!set.includes(g)) set.push(g);
  }
  return set.sort(() => Math.random() - .5).map(String);
}

export function makeQuestion(index, facts, recent, today, packId = null) {
  const key = pickKey(index, facts, [].concat(recent || []), today, packId);
  const e = index[key];

  if (e.mul) {
    let [a, b] = e.mul;
    if (Math.random() < .5) [a, b] = [b, a];
    return { key, prompt: `${a} × ${b}`, answer: String(a * b), choices: makeChoices(a, b),
             hint: bridge(a, b), equation: true, state: 'ask', hinted: false, picked: null };
  }
  return { key, prompt: e.prompt, answer: e.answer, choices: [...e.choices], hint: e.hint,
           equation: !e.prompt.trim().endsWith('?'), state: 'ask', hinted: false, picked: null };
}

/* 마스터리 갱신 — 방금 마스터했으면 true.
   쉬운 문제는 마스터로 세지 않는다(별·스티커·통계 기준을 한 곳에서 결정). */
export function applyResult(entry, fact, right, usedHint, today, elapsedMs) {
  fact.seen++;
  fact.lastSeenDay = today;
  if (right) {
    fact.right++;
    if (!fact.bestMs || elapsedMs < fact.bestMs) fact.bestMs = elapsedMs;
  }

  const before = fact.m;
  if (right && !usedHint) fact.m = Math.min(4, before + 1);
  else if (!right) fact.m = Math.max(0, before - 1);
  else fact.m = Math.max(before, 1);

  if (fact.m === 4 && !fact.masteredAt && entry.rewardable) { fact.masteredAt = today; return true; }
  return false;
}
