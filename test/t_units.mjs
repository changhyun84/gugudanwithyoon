/* 과목·단원 스캔 검사 — node test/t_units.mjs

   `packs.py`를 임시 폴더에 만든 가짜 문제 파일들로 돌립니다.

   가장 중요한 것은 **팩 id가 파일명 슬러그 그대로인 것**입니다.
   과목을 id에 넣으면 파일을 폴더로 옮기는 것만으로 문제 키가 바뀌고,
   아이가 몇 달 쌓은 진도·마스터·스티커가 통째로 새 문제가 됩니다 (기술설계서 5.4). */

import { execFileSync } from 'node:child_process';

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

const real = JSON.parse(execFileSync('python3', ['-c',
  `import json,packs,pathlib
print(json.dumps([{'id':p['id'],'count':p['count'],'subject':p['subject']}
                  for p in packs.scan(pathlib.Path('content/problems'))], ensure_ascii=False))`],
  { cwd: ROOT, encoding: 'utf8' }));
ok('지금 저장소의 파일 3개가 그대로 읽힌다', real.length === 3 && real.every(p => p.count > 0));
ok('지금 파일은 전부 과목 없음 (옮기지 않아도 된다)', real.every(p => p.subject === null));

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
  opened(null) === 'extra,flat,h1,m1');
ok('폴더 밖은 늘 열려 있다', E.openPacks(PACKS, null).has('flat'));
ok('단원 번호가 없으면 진도 관리 대상이 아니다', E.openPacks(PACKS, null).has('extra'));

ok('수학 1-3까지', opened({ 수학: '1-3' }) === 'extra,flat,h1,m1,m2,m3');
ok('1-3에서는 1-10이 안 열린다 — 자연 정렬',
  !E.openPacks(PACKS, { 수학: '1-3' }).has('m10'));
ok('1-10까지 열면 1-2·1-3도 같이', opened({ 수학: '1-10' }) === 'extra,flat,h1,m1,m10,m2,m3');
ok('과목마다 따로', opened({ 한국사: '1-2' }) === 'extra,flat,h1,h2,m1');
ok('진도를 되돌리면 다시 닫힌다 — 사라지는 것은 없다(16.4)',
  opened({ 수학: '1-1' }) === 'extra,flat,h1,m1');

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

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
