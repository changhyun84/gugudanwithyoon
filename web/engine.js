/* 출제·마스터리 엔진.
   내장 구구단(계산으로 만드는 문제)과 부모 팩(파일에서 읽은 문제)을 한 인덱스로 다룬다. */

export const GUGUDAN = 'gugudan';
export const GUGUDAN_SUBJECT = '수학';   // 이 이름의 폴더가 있으면 구구단이 그 과목에 들어간다

/* 진짜 외워야 하는 15개 — 앞에서부터 3개씩 열린다 */
export const TARGETS = [[3,3],[3,4],[3,6],[4,4],[3,7],[4,6],[3,8],[4,7],[6,6],[4,8],[6,7],[7,7],[6,8],[7,8],[8,8]];

/* 자신감용 — 이미 규칙이 있어 쉬운 것들 */
export const EASY = [];
[2, 5, 9].forEach(a => [2, 3, 4, 5, 6, 7, 8, 9].forEach(b => {
  const k = a < b ? [a, b] : [b, a];
  if (!EASY.some(f => f[0] === k[0] && f[1] === k[1])) EASY.push(k);
}));

export const factKey = (a, b) => `${GUGUDAN}:${Math.min(a, b)}x${Math.max(a, b)}`;

/* 쉬운 구구단은 마스터로 세지 않는다 — 별·스티커·통계 기준을 한 곳에서 결정한다.
   parent.html의 v1 이관도 이 함수를 쓴다. */
const EASY_KEYS = new Set(EASY.map(([a, b]) => factKey(a, b)));
export const isRewardable = key => !EASY_KEYS.has(key);

/* ── 학습 진도 (기획서 16장) ───────────────────────
   폴더 = 과목, 파일명 앞의 1-1 = 단원. 과목마다 "여기까지"만 연다. */

/* packs.py의 natural()과 같은 규칙. 1-10이 1-2보다 앞에 오면 안 된다. */
function natKey(s) {
  return String(s).split(/(\d+)/).filter(Boolean).map(x => /^\d+$/.test(x) ? +x : x);
}

function natCmp(a, b) {
  const x = natKey(a), y = natKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i], q = y[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (typeof p === typeof q) return p < q ? -1 : 1;
    return typeof p === 'number' ? -1 : 1;   // 숫자가 글자보다 앞
  }
  return 0;
}

const EVERY = Symbol('모든 단원');

/* 심화 문제를 기본 뒤로 미는 폭. 한 단원에 기본이 이만큼 있을 리 없는 값이면 된다. */
const DEEP_OFFSET = 10000;

/* 지금 열려 있는 팩 id들.

   `progress`는 두 가지 모양을 받는다.
     { units: ['1-3-나눗셈', 'gugudan'] }   ← 지금 방식. 부모가 고른 단원만 열린다
     { 수학: '1-4' }                        ← 예전 방식. "여기까지" 한 줄로 끊었다

   예전 방식을 남겨둔 이유는 **이미 저장된 프로필 때문**이다. 지우면 부모가 정해둔 진도가
   사라지고 아이 화면이 갑자기 첫 단원으로 되돌아간다. 부모 화면이 한 번 저장하면
   자동으로 새 방식으로 바뀐다(migrateProgress).

   과목이나 단원 번호가 없는 팩(폴더 밖 파일)은 진도 관리 대상이 아니라 늘 열려 있다.
   내장 구구단(id: gugudan)은 단원 번호가 없지만 **부모가 끌 수 있어야 해서** 예외로 다룬다. */
export function openPacks(packs = [], progress = null) {
  if (progress === EVERY) return new Set([GUGUDAN, ...packs.map(p => p.id)]);

  if (Array.isArray(progress?.units)) {
    const want = new Set(progress.units);
    const open = new Set();
    for (const p of packs) {
      if (!p.subject || !p.unit) open.add(p.id);      // 진도 관리 대상이 아님
      else if (want.has(p.id)) open.add(p.id);
    }
    if (want.has(GUGUDAN)) open.add(GUGUDAN);
    return open;
  }

  const open = new Set([GUGUDAN]);                     // 예전 방식에서는 구구단이 늘 열려 있었다
  const bySubject = {};
  for (const p of packs) {
    if (!p.subject || !p.unit) { open.add(p.id); continue; }
    (bySubject[p.subject] ||= []).push(p);
  }

  for (const [subject, list] of Object.entries(bySubject)) {
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    const upto = progress?.[subject];
    if (!upto) { open.add(list[0].id); continue; }
    for (const p of list) if (natCmp(p.unit, upto) <= 0) open.add(p.id);
  }
  return open;
}

/* 예전 진도("여기까지")를 지금 방식(고른 단원만)으로 바꾼다.
   **열려 있던 것은 하나도 닫지 않는다** — 부모 화면이 저장할 때 한 번 부른다. */
export function migrateProgress(packs = [], progress = null) {
  if (Array.isArray(progress?.units)) return progress;
  return { units: [...openPacks(packs, progress)] };
}

/* 문제 하나의 정의:
   packId, order, gated(앞 3개 규칙 적용), rewardable(마스터 시 별), start(처음 마스터리)
   mul이 있으면 계산으로 만들고, 없으면 파일에서 온 고정 문제다. */
export function buildIndex(packs = [], disabled = null, progress = null) {
  const offQ = new Set(disabled?.problems || []);
  const offP = new Set(disabled?.packs || []);
  const open = openPacks(packs, progress);
  const index = {};

  /* 내장 구구단은 수학 폴더가 있으면 그 과목 안에 들어간다 — 자유 모드에서 따로 떨어져 있으면
     아이 눈에 이상하다. 단원 번호가 없으므로 진도와 상관없이 **늘 열려 있다**(openPacks). */
  const guguSubject = packs.some(p => p.subject === GUGUDAN_SUBJECT) ? GUGUDAN_SUBJECT : null;

  if (!offP.has(GUGUDAN) && open.has(GUGUDAN)) {
    TARGETS.forEach(([a, b], i) => {
      const key = factKey(a, b);
      if (offQ.has(key)) return;
      index[key] = { packId: GUGUDAN, packName: '구구단', subject: guguSubject, unit: null, order: i,
                     mul: [a, b], gated: true, rewardable: true, start: 0 };
    });
    EASY.forEach(([a, b], i) => {
      const key = factKey(a, b);
      if (offQ.has(key)) return;
      index[key] = { packId: GUGUDAN, packName: '구구단', subject: guguSubject, unit: null, order: 100 + i,
                     mul: [a, b], gated: false, rewardable: false, start: 2 };
    });
  }

  // 부모가 심화를 껐으면 심화 문제는 아예 색인에 안 들어간다. 기본만 남는다.
  const noDeep = progress?.deep === false;

  packs.forEach(pack => {
    if (offP.has(pack.id) || !open.has(pack.id)) return;
    pack.problems.forEach(q => {
      if (offQ.has(q.key)) return;
      if (noDeep && q.deep) return;
      /* 심화는 그 팩의 기본을 다 지나간 뒤에 열린다. 순서만 뒤로 밀면
         NEW_AT_ONCE가 이미 하고 있는 일이 그대로 적용된다 — 규칙을 새로 만들지 않는다. */
      index[q.key] = { packId: pack.id, packName: pack.name,
                       subject: pack.subject || null, unit: pack.unit || null,
                       order: q.order + (q.deep ? DEEP_OFFSET : 0), deep: !!q.deep,
                       prompt: q.prompt, answer: q.answer, choices: q.choices, hint: q.hint,
                       gated: true, rewardable: true, start: 0 };
    });
  });

  // 부모가 실수로 전부 꺼도 아이 화면이 빈 채로 멈추면 안 된다 — 전부 무시하고 다시 짓는다.
  // 무언가를 실제로 걸렀을 때만. 안 그러면 buildIndexAll이 자기를 다시 불러 무한히 돈다.
  const filtered = offQ.size || offP.size || open.size < packs.length;
  if (!Object.keys(index).length && filtered) return buildIndexAll(packs);

  return index;
}

/* 진도와 제외를 전부 무시한 색인. 부모 화면이 쓴다 —
   부모는 아직 안 연 단원도 봐야 진도를 정할 수 있다. */
export const buildIndexAll = (packs = []) => buildIndex(packs, null, EVERY);

export function packList(index) {
  const seen = new Map();
  for (const e of Object.values(index))
    if (!seen.has(e.packId))
      seen.set(e.packId, { id: e.packId, name: e.packName, subject: e.subject, unit: e.unit });
  return [...seen.values()];
}

/* 없는 문제만 채운다 — 이미 푼 진도는 건드리지 않는다 */
export function seedFacts(index, facts) {
  for (const [key, entry] of Object.entries(index)) {
    if (!facts[key]) facts[key] = { m: entry.start, seen: 0, right: 0, lastSeenDay: null, masteredAt: null, bestMs: null };
  }
}

/* 한 번에 새로 배우는 것은 팩마다 5개.
   다만 출제 후보가 이만큼도 안 되면 같은 문제가 반복되므로 다음 문제를 미리 연다.

   3이었는데 5로 올렸습니다 (2026-08-24). 실제 프로필로 300문제를 뽑아보니
   **서로 다른 문제가 30개뿐**이고 상위 8개가 57%를 차지했습니다 — 부모가 먼저 알아챘습니다.
   숫자는 sim/repeat.mjs 로 재봅니다. 올릴 때는 "한 번에 배우는 게 너무 많지 않은가"를
   같이 보세요. 반복을 줄이는 가장 큰 손잡이는 이 값이 아니라 **부모가 단원을 여는 것**입니다. */
const NEW_AT_ONCE = 5;
const MIN_POOL = 12;

/* 자유 모드에서 무엇을 낼지 — 팩 하나이거나 과목 전체다.
   문자열을 넘기면 팩 하나로 본다(예전 호출부와 호환). */
const asPick = p => (typeof p === 'string' ? { pack: p } : p) || null;

const inPick = (entry, pick) =>
  !pick ? true : pick.subject ? entry.subject === pick.subject : entry.packId === pick.pack;

function openKeys(index, facts, pick) {
  const byPack = {};
  for (const [key, e] of Object.entries(index)) {
    if (!e.gated || !inPick(e, pick)) continue;
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

  let pool = poolSize(index, facts, pick, open);
  while (pool < MIN_POOL && waiting.length) { open.add(waiting.shift()); pool++; }
  return open;
}

function poolSize(index, facts, pick, open) {
  let n = 0;
  for (const [key, e] of Object.entries(index)) {
    if (!inPick(e, pick)) continue;
    if (!e.gated || facts[key].m > 0 || open.has(key)) n++;
  }
  return n;
}

/* 모르는 것을 더 자주 내되, 차이가 너무 크면 아는 문제가 영영 안 나온다.
   14:0.8(17.5배)이었는데 8:2.5(3.2배)로 완만하게 했습니다 (2026-08-24).
   17.5배에서는 새로 연 몇 개가 화면을 독차지해서 "같은 문제만 나온다"가 됩니다. */
const WEIGHT = { 0: 8, 1: 6, 2: 4.5, 3: 3.5, 4: 2.5 };

function weightOf(key, entry, fact, open, today) {
  if (entry.gated && fact.m === 0 && !open.has(key)) return 0;   // 아직 안 연 것은 잠금
  const base = WEIGHT[fact.m];
  const rested = fact.lastSeenDay && daysBetween(fact.lastSeenDay, today) >= 3;
  return rested ? base * 1.5 : base;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function pickKey(index, facts, recent, today, want = null) {
  const pick = asPick(want);
  const open = openKeys(index, facts, pick);

  const build = skip => {
    const pool = [];
    let total = 0;
    for (const [key, entry] of Object.entries(index)) {
      if (skip.includes(key)) continue;
      if (!inPick(entry, pick)) continue;
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

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeQuestion(index, facts, recent, today, want = null) {
  const key = pickKey(index, facts, [].concat(recent || []), today, want);
  const e = index[key];

  if (e.mul) {
    let [a, b] = e.mul;
    if (Math.random() < .5) [a, b] = [b, a];
    return { key, prompt: `${a} × ${b}`, answer: String(a * b), choices: makeChoices(a, b),
             hint: bridge(a, b), equation: true, state: 'ask', hinted: false, picked: null };
  }
  // 보기는 낼 때마다 섞는다. 파일에서 온 순서를 그대로 쓰면 아이가 자리를 외운다 —
  // 정적 배포에서는 파일이 한 번 구워지므로 안 섞으면 영영 같은 자리다.
  return { key, prompt: e.prompt, answer: e.answer, choices: shuffle(e.choices), hint: e.hint,
           equation: !e.prompt.trim().endsWith('?'), state: 'ask', hinted: false, picked: null };
}

/* ============ 최근 기록 ============
   부모 화면이 "요즘 어려워하는 문제"를 알려면 창(window)이 필요하다.
   seen·right는 누적값이라 못 쓴다. 문제마다 최근 결과를 짧게 남긴다.

   "0819:x"  →  x 오답 / h 힌트 쓰고 정답 / o 혼자 정답        (최신이 앞) */

export const LOG_MAX = 10;
export const LOG_KEEP_DAYS = 14;

const stampOf = today => String(today).slice(5, 7) + String(today).slice(8, 10);

/* MMDD에는 연도가 없다. 오늘보다 미래로 읽히면 작년 것이다 —
   이 보정을 빼면 12월 31일에 1월 기록을 내년으로 보고 영영 안 지운다. */
function tagDate(tag, ref) {
  const m = +tag.slice(0, 2), d = +tag.slice(2, 4);
  if (!m || !d) return null;
  let when = new Date(ref.getFullYear(), m - 1, d);
  if (when > ref) when = new Date(ref.getFullYear() - 1, m - 1, d);
  return when;
}

export function readLog(log, days = 7, ref = new Date()) {
  const floor = new Date(ref);
  floor.setDate(floor.getDate() - (days - 1));
  floor.setHours(0, 0, 0, 0);

  const out = { o: 0, h: 0, x: 0, seen: 0, recent: [] };
  for (const item of log || []) {
    const [tag, code] = String(item).split(':');
    if (code !== 'o' && code !== 'h' && code !== 'x') continue;
    const when = tagDate(tag, ref);
    if (!when || when < floor) continue;
    out[code]++;
    out.seen++;
    out.recent.push(code);
  }
  return out;
}

/* 오답 2점, 힌트 쓰고 정답 1점. 혼자 맞힌 것은 0점. */
export const weakness = c => c.x * 2 + c.h;

export function pruneLogs(facts, ref = new Date()) {
  const floor = new Date(ref);
  floor.setDate(floor.getDate() - (LOG_KEEP_DAYS - 1));
  floor.setHours(0, 0, 0, 0);

  for (const fact of Object.values(facts)) {
    if (!fact.log) continue;
    fact.log = fact.log.filter(item => {
      const when = tagDate(String(item).slice(0, 4), ref);
      return when && when >= floor;
    }).slice(0, LOG_MAX);
  }
}

/* 마스터리 갱신 — 방금 마스터했으면 true.
   쉬운 문제는 마스터로 세지 않는다(별·스티커·통계 기준을 한 곳에서 결정). */
export function applyResult(entry, fact, right, usedHint, today, elapsedMs) {
  fact.seen++;
  fact.lastSeenDay = today;

  // rewardable 판정 바깥이다. 쉬운 문제는 별을 안 주지만
  // 부모는 아이가 그걸 틀리는지 알아야 한다. 보상과 계측은 다른 문제다.
  fact.log = [`${stampOf(today)}:${!right ? 'x' : usedHint ? 'h' : 'o'}`,
              ...(fact.log || [])].slice(0, LOG_MAX);
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
