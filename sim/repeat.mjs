/* 같은 문제가 얼마나 반복되는지 재본다 — node sim/repeat.mjs [문제수]

   부모가 "같은 문제가 너무 자주 나온다"고 했을 때 짐작하지 말고 이걸 돌리세요.
   실제 문제 파일과 실제 프로필로 뽑아봅니다. 프로필이 없으면 새로 시작한 아이로 봅니다.

   손잡이는 셋입니다.
     engine.js  NEW_AT_ONCE   한 팩에서 한 번에 여는 새 문제 수
     engine.js  WEIGHT        마스터리별 출제 가중치
     app.js     RECENT_KEYS   최근 낸 문제를 몇 개나 빼둘지
   가장 큰 손잡이는 이 셋이 아니라 **부모가 단원을 몇 개 켰는가**입니다. */

import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const N = Number(process.argv[2]) || 300;

const tmp = mkdtempSync(join(tmpdir(), 'gugudan-repeat-'));
writeFileSync(join(tmp, 'engine.mjs'), readFileSync(join(ROOT, 'web/engine.js')));
const E = await import('file://' + join(tmp, 'engine.mjs'));

const contentPath = join(ROOT, 'dist/content.json');
if (!existsSync(contentPath)) {
  console.log('먼저 python3 sim/build-static.py 를 돌려주세요.');
  process.exit(1);
}
const packs = JSON.parse(readFileSync(contentPath, 'utf8')).packs;

const RECENT = Number(/const RECENT_KEYS = (\d+)/.exec(readFileSync(join(ROOT, 'web/app.js'), 'utf8'))?.[1]) || 3;

const dir = join(ROOT, 'data/profiles');
const file = existsSync(dir) ? readdirSync(dir).find(f => f.endsWith('.json')) : null;
const base = file ? JSON.parse(readFileSync(join(dir, file), 'utf8')) : { facts: {}, disabled: null, progress: null };
console.log(file ? `프로필: ${file.replace('.json', '')}` : '프로필 없음 — 새로 시작한 아이로 봅니다');
console.log(`최근 목록 ${RECENT}개 · ${N}문제씩 뽑음\n`);

const rows = [];
for (const [label, progress] of cases()) {
  const idx = E.buildIndex(packs, base.disabled, progress);
  const facts = JSON.parse(JSON.stringify(base.facts || {}));
  E.seedFacts(idx, facts);

  const recent = [], cnt = {}, seq = [];
  for (let i = 0; i < N; i++) {
    const k = E.pickKey(idx, facts, recent, '2026-08-24');
    cnt[k] = (cnt[k] || 0) + 1; seq.push(k);
    recent.push(k); if (recent.length > RECENT) recent.shift();
  }
  const top = Object.values(cnt).sort((a, b) => b - a);
  let gap = Infinity; const last = {};
  seq.forEach((k, i) => { if (last[k] !== undefined) gap = Math.min(gap, i - last[k]); last[k] = i; });

  rows.push({
    '켠 단원': label,
    '색인': Object.keys(idx).length,
    '서로 다른 문제': top.length,
    '가장 자주': top[0],
    '상위 8개 비중': Math.round(top.slice(0, 8).reduce((a, b) => a + b, 0) / N * 100) + '%',
    '다시 나오는 최소 간격': gap === Infinity ? '—' : gap,
  });
}
console.table(rows);
console.log('상위 8개 비중이 40%를 넘으면 아이가 "또 이 문제"라고 느낍니다.');
console.log('최소 간격이 한 판(20문제)보다 작으면 한 판 안에서 같은 문제를 두 번 봅니다.');

function cases() {
  const units = {};
  for (const p of packs) if (p.subject && p.unit) (units[p.subject] ||= []).push(p.id);
  const take = n => ['gugudan', ...Object.values(units).flatMap(l => l.slice(0, n))];
  return [
    ['지금 이 아이', base.progress],
    ['과목마다 1단원', { units: take(1) }],
    ['과목마다 3단원', { units: take(3) }],
    ['전부', { units: take(99) }],
    ['전부 · 심화 끔', { units: take(99), deep: false }],
  ];
}
