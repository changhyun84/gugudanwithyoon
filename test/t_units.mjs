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

console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
