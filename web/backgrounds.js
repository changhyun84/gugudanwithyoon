/* 목장 배경 — 별로 사는 소비처 (기획서 8.5).

   배경은 CSS 변수 세 개만 바꾼다.
     --meadow       하늘 쪽 (위)
     --meadow-deep  땅 쪽 (아래)
     --onpage       카드 바깥 글자색 — 밤 배경에서 글씨가 안 보이면 안 된다

   카드는 항상 흰색이라 안쪽 글자색(--ink)은 건드리지 않는다. */

/* 하늘에 뿌리는 장식. 몇 개만 둔다 — 많으면 아이패드에서 무거워지고 글자를 가린다. */
function specks(n, make) {
  let out = '';
  for (let i = 0; i < n; i++) {
    // 무작위가 아니라 고정 배치. 화면을 다시 열 때마다 별자리가 바뀌면 산만하다.
    const x = (i * 37 + 11) % 100, y = (i * 23 + 7) % 60;
    out += make(x, y, i);
  }
  return out;
}

const DECO = {
  night: () => specks(22, (x, y, i) =>
    `<circle cx="${x}%" cy="${y}%" r="${1 + (i % 3) * .6}" fill="#FBF7EE" opacity="${.5 + (i % 4) * .12}"/>`),

  firefly: () => specks(14, (x, y, i) =>
    `<circle cx="${x}%" cy="${y + 20}%" r="${2.4 + (i % 2)}" fill="#F6E27A" opacity=".55"/>` +
    `<circle cx="${x}%" cy="${y + 20}%" r="1.2" fill="#FFFDF0" opacity=".9"/>`),

  snow: () => specks(20, (x, y, i) =>
    `<circle cx="${x}%" cy="${y + 5}%" r="${2 + (i % 3)}" fill="#FFFFFF" opacity="${.55 + (i % 3) * .15}"/>`),

  blossom: () => specks(16, (x, y, i) =>
    `<ellipse cx="${x}%" cy="${y + 8}%" rx="${3 + (i % 2)}" ry="${5 + (i % 2)}" fill="#F6BDD1" ` +
    `opacity=".7" transform="rotate(${i * 27 % 90 - 45} 0 0)" transform-origin="${x}% ${y + 8}%"/>`),

  aurora: () =>
    '<path d="M-5,18 C25,6 45,26 75,12 C95,4 105,16 105,16 L105,30 C80,40 55,20 30,32 C12,40 -5,32 -5,32 Z" ' +
    'fill="#6FD9C0" opacity=".22" vector-effect="non-scaling-stroke"/>' +
    '<path d="M-5,26 C20,16 50,34 80,22 C95,16 105,24 105,24 L105,38 C75,48 45,30 20,40 C6,45 -5,40 -5,40 Z" ' +
    'fill="#A88FE0" opacity=".18"/>',

  rain: () => specks(18, (x, y, i) =>
    `<line x1="${x}%" y1="${y}%" x2="${x - 1}%" y2="${y + 7}%" stroke="#9FB6C4" stroke-width="1.6" ` +
    `stroke-linecap="round" opacity=".5"/>`),
};

/* 첫 칸은 무료이고 계절·시간에 따라 저절로 바뀐다 (기획서 8.5).
   나머지 10종 = 별 83. 값을 올리지 마세요 — 모으던 아이에게는 손해입니다(원칙 2.1). */
export const BACKGROUNDS = [
  { id: 'day',      nm: '오늘의 목장', star: 0,  auto: true },
  { id: 'sunset',   nm: '노을',       star: 5,  sky: '#FBE3D0', deep: '#F0C4A0', onpage: '#5A3E2E' },
  { id: 'dawn',     nm: '새벽',       star: 5,  sky: '#E9E5F4', deep: '#CBC6E2', onpage: '#3D3A55' },
  { id: 'night',    nm: '밤하늘',     star: 6,  sky: '#2C3555', deep: '#1B2138', onpage: '#DCE3F5', deco: 'night' },
  { id: 'rain',     nm: '비 오는 날',  star: 7,  sky: '#DBE4EA', deep: '#B8C7D2', onpage: '#35454F', deco: 'rain' },
  { id: 'summer',   nm: '한여름',     star: 8,  sky: '#DFF3E4', deep: '#B2E0C1', onpage: '#23503A' },
  { id: 'autumn',   nm: '가을',       star: 8,  sky: '#FBEBD2', deep: '#EDCB9F', onpage: '#5E3F22' },
  { id: 'snow',     nm: '눈 오는 날',  star: 10, sky: '#EFF4F8', deep: '#D4E2ED', onpage: '#37474F', deco: 'snow' },
  { id: 'blossom',  nm: '벚꽃',       star: 10, sky: '#FCEAF0', deep: '#F4CCDA', onpage: '#5E3348', deco: 'blossom' },
  { id: 'aurora',   nm: '오로라',     star: 12, sky: '#23384A', deep: '#152738', onpage: '#CFE9E4', deco: 'aurora' },
  { id: 'firefly',  nm: '반딧불이',   star: 12, sky: '#2E3A2E', deep: '#1C271E', onpage: '#DBE8CE', deco: 'firefly' },
];

export const bgById = id => BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];

/* 무료 배경은 계절과 시간을 따라간다. 아무것도 안 사도 화면이 늘 같지는 않게. */
export function autoLook(now = new Date()) {
  const h = now.getHours(), m = now.getMonth() + 1;

  if (h < 6)  return { sky: '#252C46', deep: '#171D31', onpage: '#D6DCF0', deco: 'night', nm: '한밤' };
  if (h < 8)  return { sky: '#E9E5F4', deep: '#CBC6E2', onpage: '#3D3A55', nm: '이른 아침' };
  if (h >= 19) return { sky: '#2C3555', deep: '#1B2138', onpage: '#DCE3F5', deco: 'night', nm: '밤' };
  if (h >= 17) return { sky: '#FBE3D0', deep: '#F0C4A0', onpage: '#5A3E2E', nm: '해질녘' };

  // 한낮 — 계절
  if (m >= 3 && m <= 5)   return { sky: '#EDF4E8', deep: '#D9E9D5', onpage: '#33453A', deco: 'blossom', nm: '봄낮' };
  if (m >= 6 && m <= 8)   return { sky: '#E4F4E7', deep: '#BFE5CB', onpage: '#23503A', nm: '여름낮' };
  if (m >= 9 && m <= 11)  return { sky: '#F7F0DE', deep: '#E7D5B4', onpage: '#5E3F22', nm: '가을낮' };
  return { sky: '#EEF3F6', deep: '#DAE5EC', onpage: '#37474F', deco: 'snow', nm: '겨울낮' };
}

/* 화면에 실제로 쓸 값 — 무료 배경이면 지금 시각으로 계산한다 */
export function lookOf(id, now = new Date()) {
  const b = bgById(id);
  return b.auto ? { ...autoLook(now), id: b.id, star: 0, auto: true } : b;
}

export const decoSVG = name => DECO[name] ? DECO[name]() : '';
