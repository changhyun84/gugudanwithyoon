/* 과목·단원 스캔 검사 — node test/t_units.mjs

   `packs.py`를 임시 폴더에 만든 가짜 문제 파일들로 돌립니다.

   가장 중요한 것은 **팩 id가 파일명 슬러그 그대로인 것**입니다.
   과목을 id에 넣으면 파일을 폴더로 옮기는 것만으로 문제 키가 바뀌고,
   아이가 몇 달 쌓은 진도·마스터·스티커가 통째로 새 문제가 됩니다 (기술설계서 5.4). */

import { execFileSync } from 'node:child_process';
import { readFileSync as read } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;

/* 파이썬으로 가짜 문제 폴더를 만들고 scan() 결과를 JSON으로 받는다 */
function scan(tree) {
  const code = `
import json, packs, pathlib, tempfile
root = pathlib.Path(tempfile.mkdtemp()) / 'problems'
for rel, body in json.loads(${JSON.stringify(JSON.stringify(tree))}).items():
    f = root / rel
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(body, encoding='utf-8')
out = packs.scan(root)
print(json.dumps([{k: p[k] for k in ('id','name','subject','unit','order','file','count','warnings')}
                  + [] for p in out], ensure_ascii=False))
`.replace("+ []", "");
  return JSON.parse(execFileSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8' }));
}

const CSV = (...qs) => '문제,정답\n' + qs.map((q, i) => `${q},${i + 1}\n`).join('');
const FOUR = CSV('가', '나', '다', '라');   // 보기 4개를 만들려면 정답이 4개는 있어야 한다

let pass = 0, fail = 0;
const ok = (name, cond) => cond ? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

/* ── 자연 정렬 ── */
group('자연 정렬 — 1-10이 1-2보다 앞에 오면 출제 순서가 뒤집힙니다');

const sorted = scan({
  '수학/1-1 구구단.csv': FOUR,
  '수학/1-2 곱셈.csv': FOUR,
  '수학/1-10 심화.csv': FOUR,
  '수학/1-3 나눗셈.csv': FOUR,
  '수학/2-1 분수.csv': FOUR,
});
ok('1-1 · 1-2 · 1-3 · 1-10 · 2-1 순',
  sorted.map(p => p.unit).join(' ') === '1-1 1-2 1-3 1-10 2-1');
ok('order가 그 순서대로 0..4', sorted.map(p => p.order).join('') === '01234');

/* ── 폴더가 과목 ── */
group('폴더가 과목');

const mixed = scan({
  '수학/1-1 구구단.csv': FOUR,
  '수학/1-2 곱셈.csv': FOUR,
  '한국사/1-1 구석기.csv': FOUR,
  '나눗셈.csv': FOUR,
});
const by = id => mixed.find(p => p.id === id);
ok('폴더 이름이 과목이 됨', by('1-1-구구단').subject === '수학');
ok('다른 폴더는 다른 과목', by('1-1-구석기').subject === '한국사');
ok('폴더 밖은 과목이 없음', by('나눗셈').subject === null);
ok('폴더 밖은 단원도 없음', by('나눗셈').unit === null);
ok('order는 과목 안에서만 센다',
  by('1-1-구구단').order === 0 && by('1-2-곱셈').order === 1 && by('1-1-구석기').order === 0);
ok('file에 과목이 붙어 부모가 찾기 쉬움', by('1-1-구구단').file === '수학/1-1 구구단.csv');

/* ── 팩 id는 파일명 슬러그만 ── */
group('팩 id는 파일명 슬러그만 — 폴더로 옮겨도 아이 진도가 유지됩니다');

const flat = scan({ '1-1 구구단.csv': FOUR });
const nested = scan({ '수학/1-1 구구단.csv': FOUR });
ok('폴더 밖과 폴더 안의 id가 같다', flat[0].id === nested[0].id);
ok('id에 과목이 안 들어간다', !nested[0].id.includes('수학'));

const keyOf = ps => ps[0].id;   // 문제 키는 {팩id}:{문제}
ok('그래서 문제 키도 그대로다', keyOf(flat) === keyOf(nested));

/* ── 단원 번호 ── */
group('단원 번호 읽기');

const units = scan({
  '수학/1-1 구구단.csv': FOUR,
  '수학/2 분수.csv': FOUR,
  '수학/3.1 소수.csv': FOUR,
  '수학/구구단 복습.csv': FOUR,
});
const u = nm => units.find(p => p.file.includes(nm)).unit;
ok('1-1 형식', u('1-1') === '1-1');
ok('숫자 하나도 단원', u('2 분수') === '2');
ok('점 구분도 받는다', u('3.1') === '3.1');
ok('번호가 없으면 null — 진도 관리 대상이 아니다', u('구구단 복습') === null);

/* ── 이름 충돌 ── */
group('이름이 겹칠 때');

const clash = scan({ '수학/1-1.csv': FOUR, '한국사/1-1.csv': FOUR });
ok('하나만 읽는다', clash.length === 1);
ok('버린 쪽을 알려준다', clash[0].warnings.some(w => w.includes('겹쳐서')));
ok('먼저 온 쪽이 남는다', clash[0].subject === '수학');

/* ── 한 단계만 ── */
group('한 단계만 내려간다');

const deep = scan({ '수학/1학기/1-1 구구단.csv': FOUR, '수학/1-2 곱셈.csv': FOUR });
ok('두 단계 아래는 안 읽는다', deep.length === 1 && deep[0].id === '1-2-곱셈');

/* ── 기존 동작 ── */
group('기존 파일은 그대로');

const legacy = scan({ '나눗셈.csv': FOUR, '과학-식물.csv': FOUR });
ok('폴더 없이도 읽힌다', legacy.length === 2);
ok('과목·단원 없이 항상 열린다', legacy.every(p => p.subject === null && p.unit === null));
ok('문제가 그대로 실린다', legacy.every(p => p.count === 4));

/* ── 저장소의 진짜 문제 파일 ── */
group('저장소의 문제 파일 (수학 · 한국사)');

const real = JSON.parse(execFileSync('python3', ['-c',
  `import json,packs,pathlib
print(json.dumps([{k: p[k] for k in ('id','name','subject','unit','order','count','warnings')}
                  for p in packs.scan(pathlib.Path('content/problems'))], ensure_ascii=False))`],
  { cwd: ROOT, encoding: 'utf8' }));

const bySub = s => real.filter(p => p.subject === s);
ok('수학 9단원', bySub('수학').length === 9);
ok('한국사 8단원', bySub('한국사').length === 8);
ok('전부 단원 번호가 있다 — 진도 관리 대상이다',
  real.every(p => p.subject && p.unit));
ok('문제가 하나도 안 빠졌다 (경고 0)', real.every(p => !p.warnings.length));
ok(`문제 ${real.reduce((s, p) => s + p.count, 0)}개`, real.reduce((s, p) => s + p.count, 0) > 400);
ok('수학이 1-3부터 2-5까지 순서대로',
  bySub('수학').map(p => p.unit).join(' ') === '1-3 1-4 1-5 1-6 2-1 2-2 2-3 2-4 2-5');
ok('한국사가 1-1부터 2-3까지 순서대로',
  bySub('한국사').map(p => p.unit).join(' ') === '1-1 1-2 1-3 1-4 1-5 2-1 2-2 2-3');

/* 수학은 손으로 쓰지 않고 계산해서 만든다. 답이 틀리면 아이가 맞게 답하고 틀린 것이 된다. */
const mathCheck = execFileSync('python3', ['-c', `
import csv, pathlib, re
bad = 0
for f in pathlib.Path('content/problems/수학').glob('*.csv'):
    for r in csv.DictReader(f.open(encoding='utf-8')):
        q, a = r['문제'], r['정답']
        for pat, fn in [
            (r'(\\d+) × (\\d+)', lambda x, y: x * y),
            (r'(\\d+) ÷ (\\d+)$', lambda x, y: x // y if x % y == 0 else None),
            (r'(\\d+) ÷ (\\d+)의 몫', lambda x, y: x // y),
            (r'(\\d+) ÷ (\\d+)의 나머지', lambda x, y: x % y),
        ]:
            m = re.fullmatch(pat, q)
            if m:
                want = fn(int(m.group(1)), int(m.group(2)))
                if want is None or str(want) != a: bad += 1
print(bad)`], { cwd: ROOT, encoding: 'utf8' }).trim();
ok('수학 계산이 전부 맞다 (독립으로 다시 계산)', mathCheck === '0');

/* ── 보기 품질 (2026-08-24) ── */
group('보기 넷이 같은 모양인가 — 계산 안 하고 고를 수 있으면 안 됩니다');

const shape = execFileSync('python3', ['-c', `
import json, packs, pathlib, re
def z(x):
    return len(re.search(r'0*$', x).group(0)) if re.fullmatch(r'\\d+', x) else -1
bad, tot, dup, short = 0, 0, 0, 0
for p in packs.scan(pathlib.Path('content/problems')):
    for q in p['problems']:
        if len(set(q['choices'])) != 4: dup += 1
        if len(q['choices']) != 4: short += 1
        if not re.fullmatch(r'\\d+', q['answer']): continue
        tot += 1
        zs = [z(c) for c in q['choices']]
        # 정답만 유일하게 0으로 끝나면 계산 없이 고를 수 있다
        if z(q['answer']) > 0 and sum(1 for v in zs if v > 0) == 1: bad += 1
print(json.dumps([bad, tot, dup, short]))`], { cwd: ROOT, encoding: 'utf8' });
const [giveaway, numTotal, dupChoices, shortChoices] = JSON.parse(shape);

ok(`보기가 전부 4개 (겹침 ${dupChoices} · 모자람 ${shortChoices})`, !dupChoices && !shortChoices);
ok(`"딱 떨어지는 수만 고르면 맞는" 문제 0개 (${numTotal}개 중 ${giveaway})`, giveaway === 0);

/* ── 기본과 심화 (파일) ── */
group('기본과 심화');

const deepCount = execFileSync('python3', ['-c', `
import json, packs, pathlib
ps = packs.scan(pathlib.Path('content/problems'))
print(json.dumps({p['name']: [p['count'] - p['deep'], p['deep']] for p in ps}))`],
  { cwd: ROOT, encoding: 'utf8' });
const deepBy = JSON.parse(deepCount);
ok('모든 단원에 심화가 있다',
  Object.values(deepBy).every(([, d]) => d > 0));
ok('심화가 기본보다 많지는 않다 — 기본이 먼저다',
  Object.values(deepBy).every(([b, d]) => d <= b));
ok(`심화 ${Object.values(deepBy).reduce((s, [, d]) => s + d, 0)}문제`,
  Object.values(deepBy).reduce((s, [, d]) => s + d, 0) >= 150);

/* ── 반복 (engine.js + app.js) ── */
group('같은 문제가 너무 자주 나오지 않는가');

const appTxt = read(new URL('../web/app.js', import.meta.url), 'utf8');
const recentN = Number(/const RECENT_KEYS = (\d+)/.exec(appTxt)?.[1]);
ok(`최근 낸 문제를 ${recentN}개 빼둔다 — 한 판(20문제) 안에서 안 겹치려면 10 이상`, recentN >= 10);
ok('빼둔 목록을 실제로 그만큼 유지한다', appTxt.includes('recentKeys.length > RECENT_KEYS'));

const engSrc = read(new URL('../web/engine.js', import.meta.url), 'utf8');
const w = JSON.parse((/const WEIGHT = (\{[^}]+\})/.exec(engSrc)?.[1] || '{}').replace(/(\d):/g, '"$1":'));
ok('가중치가 있다', Object.keys(w).length === 5);
ok('모르는 것이 아는 것보다 자주 나온다', w[0] > w[4]);
ok(`가장 센 것과 약한 것의 차이가 5배 이하 (${(w[0] / w[4]).toFixed(1)}배)`, w[0] / w[4] <= 5);
ok('마스터한 문제도 계속 나온다 — 잊어버리면 안 된다', w[4] > 0);

/* ── 진도 (engine.js) ── */
group('진도 — 과목마다 "여기까지"');

const { mkdtempSync, writeFileSync, readFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const tmp = mkdtempSync(join(tmpdir(), 'gugudan-units-'));
writeFileSync(join(tmp, 'engine.mjs'), readFileSync(new URL('../web/engine.js', import.meta.url)));
const E = await import('file://' + join(tmp, 'engine.mjs'));

const pack = (id, subject, unit, order) => ({
  id, subject, unit, order, name: id,
  problems: [{ key: `${id}:q`, order: 0, prompt: 'q', answer: '1', choices: ['1', '2', '3', '4'], hint: '' }],
});
const PACKS = [
  pack('m1', '수학', '1-1', 0), pack('m2', '수학', '1-2', 1),
  pack('m3', '수학', '1-3', 2), pack('m10', '수학', '1-10', 3),
  pack('h1', '한국사', '1-1', 0), pack('h2', '한국사', '1-2', 1),
  pack('flat', null, null, 0),          // 폴더 밖
  pack('extra', '수학', null, 4),        // 폴더 안이지만 단원 번호 없음
];
const opened = (progress) => [...E.openPacks(PACKS, progress)].sort().join(',');

ok('진도를 안 정하면 과목마다 첫 단원만',
  opened(null) === 'extra,flat,gugudan,h1,m1');
ok('폴더 밖은 늘 열려 있다', E.openPacks(PACKS, null).has('flat'));
ok('단원 번호가 없으면 진도 관리 대상이 아니다', E.openPacks(PACKS, null).has('extra'));

ok('수학 1-3까지', opened({ 수학: '1-3' }) === 'extra,flat,gugudan,h1,m1,m2,m3');
ok('1-3에서는 1-10이 안 열린다 — 자연 정렬',
  !E.openPacks(PACKS, { 수학: '1-3' }).has('m10'));
ok('1-10까지 열면 1-2·1-3도 같이', opened({ 수학: '1-10' }) === 'extra,flat,gugudan,h1,m1,m10,m2,m3');
ok('과목마다 따로', opened({ 한국사: '1-2' }) === 'extra,flat,gugudan,h1,h2,m1');
ok('진도를 되돌리면 다시 닫힌다 — 사라지는 것은 없다(16.4)',
  opened({ 수학: '1-1' }) === 'extra,flat,gugudan,h1,m1');

/* ── 고른 단원만 켜기 (2026-08-24) ── */
group('진도 — 고른 단원만 켜기');

ok('고른 것만 열린다', opened({ units: ['m2', 'h2'] }) === 'extra,flat,h2,m2');
ok('순서를 건너뛰어도 된다 — 2학기만 먼저 열 수 있다',
  E.openPacks(PACKS, { units: ['m10'] }).has('m10'));
ok('폴더 밖은 여기서도 늘 열려 있다', E.openPacks(PACKS, { units: [] }).has('flat'));
ok('구구단도 끌 수 있다', !E.openPacks(PACKS, { units: ['m1'] }).has('gugudan'));
ok('구구단을 켜면 열린다', E.openPacks(PACKS, { units: ['gugudan'] }).has('gugudan'));
ok('하나도 안 켜도 폴더 밖만 남고 멈추지 않는다',
  opened({ units: [] }) === 'extra,flat');

/* 예전 프로필을 열 때 열려 있던 단원이 하나라도 닫히면 아이 화면이 갑자기 줄어든다 */
for (const legacy of [null, { 수학: '1-3' }, { 한국사: '1-2' }, { 수학: '1-10' }]) {
  const before = [...E.openPacks(PACKS, legacy)].sort().join(',');
  const after = [...E.openPacks(PACKS, E.migrateProgress(PACKS, legacy))].sort().join(',');
  ok(`예전 진도를 옮겨도 열린 것이 그대로 (${JSON.stringify(legacy)})`, before === after);
}
ok('이미 옮긴 것은 그대로 둔다',
  E.migrateProgress(PACKS, { units: ['m2'] }).units.join() === 'm2');

/* ── 기본과 심화 ── */
group('기본과 심화');

const DEEPPACKS = [{
  id: 'd1', subject: '수학', unit: '1-1', order: 0, name: 'd1',
  problems: [
    { key: 'd1:a', order: 0, prompt: 'a', answer: '1', choices: ['1','2','3','4'], hint: '' },
    { key: 'd1:b', order: 1, prompt: 'b', answer: '1', choices: ['1','2','3','4'], hint: '', deep: true },
  ],
}];
const dIdx = E.buildIndex(DEEPPACKS, null, { units: ['d1'] });
ok('기본값(섞어)에서는 둘 다 색인에 들어간다', 'd1:a' in dIdx && 'd1:b' in dIdx);
ok('부모 화면 목록에서는 심화가 뒤에 온다', dIdx['d1:b'].order > dIdx['d1:a'].order);
ok('심화 표시가 남는다', dIdx['d1:b'].deep === true && !dIdx['d1:a'].deep);

/* ── 난이도 세 가지 (2026-08-25) ── */
group('난이도 — 기본 · 섞어 · 심화');

const at = lv => E.buildIndex(DEEPPACKS, null, { units: ['d1'], level: lv });
ok('기본을 고르면 심화가 빠진다', !('d1:b' in at('기본')) && ('d1:a' in at('기본')));
ok('심화를 고르면 기본이 빠진다', ('d1:b' in at('심화')) && !('d1:a' in at('심화')));
ok('섞어를 고르면 둘 다 나온다', ('d1:a' in at('섞어')) && ('d1:b' in at('섞어')));

const withGugu = lv => E.buildIndex(DEEPPACKS, null, { units: ['d1', 'gugudan'], level: lv });
ok('구구단은 심화가 없어서 심화 모드에서 통째로 빠진다',
  !Object.keys(withGugu('심화')).some(k => k.startsWith('gugudan:')) &&
  Object.keys(withGugu('섞어')).some(k => k.startsWith('gugudan:')));

ok('예전 프로필의 deep:false는 기본으로 읽는다', E.levelOf({ deep: false }) === '기본');
ok('아무것도 안 정했으면 섞어', E.levelOf(null) === '섞어' && E.levelOf({}) === '섞어');
ok('모르는 값이 들어와도 섞어로 떨어진다', E.levelOf({ level: '어려움' }) === '섞어');
ok('이름 세 가지를 밖으로 내보낸다', E.LEVELS.join() === '기본,섞어,심화');

/* 섞어에서 심화가 **기본을 다 마치기 전에도** 나와야 한다.
   예전에는 순서에서 뒤로 밀기만 해서 초반에 한 문제도 안 나왔다 — 그게 "초반이 쉽다"였다. */
const MANY = [{
  id: 'm', subject: '수학', unit: '1-1', order: 0, name: 'm',
  problems: [
    ...Array.from({ length: 20 }, (_, i) => ({ key: `m:b${i}`, order: i, prompt: `b${i}`,
      answer: '1', choices: ['1', '2', '3', '4'], hint: '', group: `g${i % 4}` })),
    ...Array.from({ length: 10 }, (_, i) => ({ key: `m:d${i}`, order: i, deep: true, prompt: `d${i}`,
      answer: '1', choices: ['1', '2', '3', '4'], hint: '', group: `h${i % 3}` })),
  ],
}];
const mIdx = E.buildIndex(MANY, { problems: [], packs: ['gugudan'] }, { units: ['m'], level: '섞어' });
const mFacts = {}; E.seedFacts(mIdx, mFacts);
const early = new Set();
{
  const recent = [];
  for (let i = 0; i < 200; i++) {
    const k = E.pickKey(mIdx, mFacts, recent, '2026-08-25');
    early.add(k); recent.push(k); if (recent.length > 12) recent.shift();
  }
}
ok('섞어에서 심화가 처음부터 나온다', [...early].some(k => k.startsWith('m:d')));
ok('그래도 기본이 더 많이 열린다',
  [...early].filter(k => k.startsWith('m:b')).length > [...early].filter(k => k.startsWith('m:d')).length);

/* ── 유형이 연달아 나오지 않는가 ── */
group('같은 유형이 연달아 나오지 않는가 (묶음)');

ok('묶음이 색인에 실린다', mIdx['m:b0'].group === 'g0');
ok('구구단에도 묶음이 있다',
  Object.values(E.buildIndex([], null, null)).every(e => e.group));

{
  const facts = {}; E.seedFacts(mIdx, facts);
  const recent = [], seq = [];
  for (let i = 0; i < 300; i++) {
    const k = E.pickKey(mIdx, facts, recent, '2026-08-25');
    seq.push(k); recent.push(k); if (recent.length > 12) recent.shift();
  }
  let same = 0, run = 1, maxRun = 1;
  for (let i = 1; i < seq.length; i++) {
    if (mIdx[seq[i - 1]].group === mIdx[seq[i]].group) { same++; run++; maxRun = Math.max(maxRun, run); }
    else run = 1;
  }
  const pct = Math.round(same / (seq.length - 1) * 100);
  ok(`앞 문제와 같은 유형이 ${pct}% — 20% 아래`, pct < 20);
  ok(`같은 유형이 이어지는 길이 ${maxRun} — 4 아래`, maxRun < 4);
}

/* ── 색인 ── */
group('색인');

const count = idx => Object.keys(idx).filter(k => !k.startsWith('gugudan:')).length;
ok('진도 없으면 첫 단원의 문제만', count(E.buildIndex(PACKS)) === 4);
ok('1-3까지 열면 늘어난다', count(E.buildIndex(PACKS, null, { 수학: '1-3' })) === 6);
ok('부모 화면은 전부 본다', count(E.buildIndexAll(PACKS)) === 8);

ok('제외와 진도는 따로 논다',
  count(E.buildIndex(PACKS, { problems: [], packs: ['m1'] }, { 수학: '1-3' })) === 5);

ok('내장 구구단은 진도와 상관없다',
  Object.keys(E.buildIndex(PACKS)).some(k => k.startsWith('gugudan:')));

/* ── 멈추지 않는다 ── */
group('아이 화면이 빈 채로 멈추지 않는다');

ok('팩이 없어도 구구단은 나온다', Object.keys(E.buildIndex([])).length > 0);
ok('전부 꺼도 복구된다',
  Object.keys(E.buildIndex([], { problems: [], packs: ['gugudan'] })).length > 0);
ok('무한히 돌지 않는다', Object.keys(E.buildIndexAll([])).length > 0);

/* ── 부모 화면이 조용히 죽지 않는가 ── */
group('부모 화면 import — 이게 어긋나면 부모 화면 전체가 조용히 죽습니다 (2.12)');

const parentSrc = readFileSync(new URL('../web/parent.html', import.meta.url), 'utf8');
const imported = (/import\s*\{([^}]+)\}\s*from\s*'\/engine\.js'/.exec(parentSrc)?.[1] || '')
  .split(',').map(s => s.trim()).filter(Boolean);
ok('engine.js에서 무언가를 가져온다', imported.length > 0);
const missing = imported.filter(n => !(n in E));
ok(`가져오는 이름이 전부 engine.js에 있다 (${imported.join(', ')})`, !missing.length);
if (missing.length) console.log('     없는 이름:', missing.join(', '));

ok('부모 화면은 buildIndexAll을 쓴다 — 안 연 단원도 봐야 진도를 정한다',
  parentSrc.includes('buildIndexAll(loaded)'));
ok('부모 화면과 엔진이 같은 openPacks를 쓴다 — 규칙을 두 곳에 두면 어긋난다',
  imported.includes('openPacks') && parentSrc.includes('openPacks(PACKS'));
ok('진도를 저장할 때 프로필을 다시 받아 얹는다 (2.11)',
  /const fresh = await store\.loadProfile\(/.test(parentSrc) && parentSrc.includes('fresh.progress'));
ok('진도를 내릴 때 사라지는 것이 없다고 알려준다',
  parentSrc.includes('그대로 남습니다') || parentSrc.includes('사라지는 것은 없습니다'));

/* ── 자유 모드 필터 ── */
group('자유 모드 — 과목 전체 / 단원 하나');

const idx = E.buildIndex(PACKS, null, { 수학: '1-3', 한국사: '1-2' });
const facts = {};
E.seedFacts(idx, facts);

const list = E.packList(idx);
ok('packList에 과목·단원이 실린다',
  list.every(p => 'subject' in p && 'unit' in p));
ok('안 열린 단원은 목록에 없다 — 회색으로도 안 보여준다(16.5)',
  !list.some(p => p.id === 'm10'));
ok('열린 것만 있다',
  list.filter(p => p.subject && p.id !== 'gugudan').map(p => p.id).sort().join(',') === 'extra,h1,h2,m1,m2,m3');
ok('수학 폴더가 있으면 구구단도 수학에 들어간다',
  list.find(p => p.id === 'gugudan')?.subject === E.GUGUDAN_SUBJECT);
ok('구구단은 단원 번호가 없어 진도와 상관없이 늘 열린다',
  list.find(p => p.id === 'gugudan')?.unit == null);
ok('수학 폴더가 없으면 구구단은 과목 없이 남는다',
  E.packList(E.buildIndex([pack('h9', '한국사', '1-1', 0)])).find(p => p.id === 'gugudan').subject === null);

const drawn = (want, n = 200) => {
  const seen = new Set();
  for (let i = 0; i < n; i++) seen.add(idx[E.pickKey(idx, facts, [], '2026-09-05', want)].packId);
  return [...seen].sort().join(',');
};
ok('과목 전체를 고르면 그 과목만', drawn({ subject: '한국사' }) === 'h1,h2');
ok('단원 하나를 고르면 그것만', drawn({ pack: 'm2' }) === 'm2');
ok('아무것도 안 고르면 구구단까지 섞인다', drawn(null).includes('gugudan'));
ok('문자열을 넘기면 팩 하나로 본다 (예전 호출부 호환)', drawn('m3') === 'm3');
ok('과목을 골라도 MIN_POOL 보정이 돈다 — 같은 문제만 반복되지 않는다',
  new Set(Array.from({ length: 200 }, () =>
    E.pickKey(idx, facts, [], '2026-09-05', { subject: '수학' }))).size >= 4);

/* ── 아이 화면 ── */
group('아이 화면 (app.js)');

const appSrc = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
ok('안 열린 단원을 회색으로 그리는 코드가 없다', !/locked.*data-(pack|into)|data-(pack|into).*locked/.test(appSrc));
ok('진도를 buildIndex에 넘긴다', /buildIndex\(PACKS, P\.disabled, P\.progress\)/.test(appSrc));
ok('새 단원 알림이 있다', appSrc.includes('새로운 문제가 왔어'));
ok('처음 들어온 아이에게는 안 알린다',
  /if \(!P\.seenPacks\.length\)[\s\S]{0,80}return;/.test(appSrc));
ok('문제를 풀러 가면 알림이 지워진다',
  (appSrc.match(/P\.settings\.newUnits = \[\]/g) || []).length >= 2);

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
