/* 같은 문제와 같은 유형이 얼마나 반복되는지 재본다 — node sim/repeat.mjs [문제수]

   부모가 "같은 문제가 너무 자주 나온다"고 했을 때 짐작하지 말고 이걸 돌리세요.
   실제 문제 파일과 실제 프로필로 뽑아봅니다. 프로필이 없으면 새로 시작한 아이로 봅니다.

   손잡이는 셋입니다.
     engine.js  NEW_AT_ONCE      한 팩에서 한 번에 여는 새 문제 수
     engine.js  DEEP_AT_ONCE     섞어 모드에서 같이 여는 심화 수
     engine.js  WEIGHT           마스터리별 출제 가중치
     engine.js  SAME/NEAR_GROUP  같은 유형이 연달아 나올 때 누르는 정도
     engine.js  EASY_DAMP        쉬운 구구단을 누르는 정도
     app.js     RECENT_KEYS      최근 낸 문제를 몇 개나 빼둘지
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

  // 같은 **유형**(묶음)이 연달아 나오는 정도. 아이가 '또 이거'라고 느끼는 것의 절반이 이것이다.
  let same = 0, run = 1, maxRun = 1;
  for (let i = 1; i < seq.length; i++) {
    if (idx[seq[i - 1]].group === idx[seq[i]].group) { same++; run++; maxRun = Math.max(maxRun, run); }
    else run = 1;
  }
  let kinds = 0, rounds = 0;
  for (let i = 0; i + 20 <= seq.length; i += 20) {
    kinds += new Set(seq.slice(i, i + 20).map(k => idx[k].group)).size; rounds++;
  }

  rows.push({
    '설정': label,
    '색인': Object.keys(idx).length,
    '서로 다른 문제': top.length,
    '상위 8개': Math.round(top.slice(0, 8).reduce((a, b) => a + b, 0) / N * 100) + '%',
    '다시 나올 때까지': gap === Infinity ? '-' : gap,
    '심화': Math.round(seq.filter(k => idx[k].deep).length / N * 100) + '%',
    '쉬운 구구단': Math.round(seq.filter(k => !idx[k].rewardable).length / N * 100) + '%',
    '연달아 같은 유형': Math.round(same / (seq.length - 1) * 100) + '%',
    '최대 연속': maxRun,
    '한 판 유형 수': (kinds / rounds).toFixed(1),
  });
}
console.table(rows);
console.log('상위 8개가 40%를 넘으면 아이가 "또 이 문제"라고 느낍니다.');
console.log('다시 나올 때까지가 한 판(20문제)보다 작으면 한 판 안에서 같은 문제를 두 번 봅니다.');
console.log('연달아 같은 유형이 20%를 넘거나 한 판 유형 수가 4가지 아래면 다 비슷한 문제로 느낍니다.');

function cases() {
  const units = {};
  for (const p of packs) if (p.subject && p.unit) (units[p.subject] ||= []).push(p.id);
  const take = n => ['gugudan', ...Object.values(units).flatMap(l => l.slice(0, n))];
  return [
    ['지금 이 아이', base.progress],
    ['1단원 · 기본', { units: take(1), level: '기본' }],
    ['1단원 · 섞어', { units: take(1), level: '섞어' }],
    ['1단원 · 심화', { units: take(1), level: '심화' }],
    ['3단원 · 섞어', { units: take(3), level: '섞어' }],
    ['전부 · 섞어', { units: take(99), level: '섞어' }],
    ['전부 · 심화', { units: take(99), level: '심화' }],
  ];
}
