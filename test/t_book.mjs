/* 도감 검사 — node test/t_book.mjs

   jsdom 없이 돌아갑니다. `app.js`에서 순수 함수 네 개를 꺼내
   `INDEX`와 `P`만 흉내내서 검사합니다.

   가장 중요한 것은 **"회수 없음"** 묶음입니다 (기획서 원칙 2.1 / 구현-현황 2.9).
   판 보상이 줄어드는 경로가 생기면 별이 줄고 → 상점 단계가 닫히고 →
   어제까지 살 수 있던 물건이 아이 화면에서 사라집니다. */

import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

/* app.js는 모듈이라 그냥 import하면 DOM을 찾는다. 함수 본문만 떼어 쓴다. */
function grab(name) {
  const at = SRC.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`app.js에 ${name}()가 없습니다`);
  let depth = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}' && --depth === 0) return SRC.slice(at, i + 1);
  }
  throw new Error(`${name}()의 끝을 못 찾았습니다`);
}

const BOARD_SIZE = 12, BOARD_STAR = 3;
const STAR_ICON = '<svg data-star></svg>';
const esc = s => String(s).replace(/[<>&"]/g, c =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

let INDEX = {}, P = null;

const body = ['catchUpBoards', 'stickerLabel', 'hashOf', 'boardHTML'].map(grab).join('\n');
const book = new Function('BOARD_SIZE', 'BOARD_STAR', 'esc', 'STAR_ICON', 'getP', 'getINDEX', `
  ${body.replace(/\bP\./g, 'getP().').replace(/\bINDEX\[/g, 'getINDEX()[')}
  return { catchUpBoards, stickerLabel, hashOf, boardHTML };
`)(BOARD_SIZE, BOARD_STAR, esc, STAR_ICON, () => P, () => INDEX);

let pass = 0, fail = 0;
const ok = (name, cond) => cond
  ? (pass++, console.log('  ✓', name))
  : (fail++, console.log('  ✗', name));
const group = name => console.log(`\n${name}`);

const profile = (stickers = [], boards = 0, star = 0) => ({
  wallet: { grass: 0, star },
  daily: { star: 0 },
  collection: { stickers, boardsCompleted: boards },
});
const many = n => Array.from({ length: n }, (_, i) => `팩:문제${i}`);

/* ── 판 완성 보상 ── */
group('판 완성 보상');

P = profile([]);
ok('스티커가 없으면 보상 없음', book.catchUpBoards() === 0);

P = profile(many(11));
ok('11장은 아직 아님', book.catchUpBoards() === 0);

P = profile(many(12));
const first = book.catchUpBoards();
ok('12장에 별 3', first === 3 && P.wallet.star === 3);
ok('boardsCompleted가 1로', P.collection.boardsCompleted === 1);
ok('daily.star에도 들어감', P.daily.star === 3);
ok('다시 불러도 안 줌', book.catchUpBoards() === 0 && P.wallet.star === 3);

P = profile(many(37));
ok('5B 이전에 모은 37장 소급 → 별 9', book.catchUpBoards() === 9);
ok('소급 뒤 판 수 3', P.collection.boardsCompleted === 3);

/* ── 회수 없음 (원칙 2.9) ── */
group('회수 없음 — 이 묶음이 깨지면 아이 화면에서 물건이 사라집니다');

P = profile(many(12), 5, 99);   // 기록이 스티커보다 앞서 있는 경우
ok('boardsCompleted를 줄이지 않음', book.catchUpBoards() === 0 && P.collection.boardsCompleted === 5);
ok('별을 뺏지 않음', P.wallet.star === 99);

P = profile(many(60), 5, 15);   // 부모가 문제를 꺼서 스티커가 안 늘어난 상태
const more = book.catchUpBoards();
ok('앞선 기록이 있어도 새 판은 정상 지급', more === 0 && P.wallet.star === 15);

/* ── 스티커 라벨 ── */
group('스티커 라벨');

INDEX = {
  '나눗셈:24÷6': { prompt: '24 ÷ 6', answer: '4' },
  '과학:q1': { prompt: '식물이 물을 빨아들이는 곳은 어디일까?', answer: '뿌리' },
  '한국사:q2': { prompt: '아주 긴 문제인데 정답도 길어서 둘 다 못 쓰는 경우', answer: '정답이아주아주길어요' },
};
ok('구구단은 × 기호로', book.stickerLabel('gugudan:7x8') === '7×8');
ok('짧은 문제는 문제 그대로', book.stickerLabel('나눗셈:24÷6') === '24 ÷ 6');
ok('긴 문제는 정답으로', book.stickerLabel('과학:q1') === '뿌리');
ok('둘 다 길면 잘라서 …', book.stickerLabel('한국사:q2').endsWith('…'));
ok('라벨은 8자 이하', ['gugudan:7x8', '나눗셈:24÷6', '과학:q1', '한국사:q2']
  .every(k => book.stickerLabel(k).length <= 8));

INDEX = {};   // 부모가 전부 꺼서 색인이 비었을 때 — 스티커는 그대로 남아야 한다
ok('꺼진 구구단도 읽힘', book.stickerLabel('gugudan:3x4') === '3×4');
ok('색인에 없는 팩 문제도 읽힘', book.stickerLabel('지운팩:없는문제') === '없는문제');

/* ── 색과 기울기 ── */
group('색과 기울기는 문제마다 고정');

ok('같은 키는 같은 해시', book.hashOf('gugudan:7x8') === book.hashOf('gugudan:7x8'));
ok('다른 키는 다른 해시', new Set('abcdef'.split('').map(book.hashOf)).size === 6);

/* ── 판 그리기 ── */
group('판 그리기');

INDEX = {};
const empty = book.boardHTML([], 1, false);
ok('빈 판도 칸은 12개', (empty.match(/class="sticker/g) || []).length === BOARD_SIZE);
ok('빈 판은 "12칸 남았어"', empty.includes('12칸 남았어'));
ok('빈 판에는 별이 없음', !empty.includes(STAR_ICON));

const full = book.boardHTML(many(12), 2, true);
ok('채운 판도 칸은 12개', (full.match(/class="sticker/g) || []).length === BOARD_SIZE);
ok('채운 판에 빈칸 없음', !full.includes('sticker empty'));
ok('완성한 판에 별 3 표시', full.includes(STAR_ICON) && full.includes('done'));

const part = book.boardHTML(many(2), 3, false);
ok('2장이면 10칸 남았어', part.includes('10칸 남았어'));
ok('빈칸이 정확히 10개', (part.match(/sticker empty/g) || []).length === 10);
ok('기울기가 붙음', /--tilt:-?\d+deg/.test(part));

INDEX = { 'x:q': { prompt: '<b>', answer: '<b>' } };
ok('HTML 이스케이프', book.boardHTML(['x:q'], 1, false).includes('&lt;b&gt;'));

/* ── 결과 ── */
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
