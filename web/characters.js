/* 캐릭터와 아이템 그리기.
   아이템 SVG는 양 기준 좌표(모자 100,30 / 목 100,96)로 한 벌만 그리고,
   캐릭터마다 앵커 차이만큼 옮기고 배율만큼 키워서 붙인다.

   양은 v1부터 아이가 좋아한 그림이라 손대지 않았다.
   나머지 넷은 '아기 비례'로 다시 그렸다 — 머리가 몸보다 크고,
   눈이 얼굴 한가운데보다 아래에 크고 멀리 벌어져 있는 것. 이 셋이 귀여움의 대부분이다. */

export const GRASS_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21c0-5 0-8 0-8" stroke="#527B34" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M12 14c-1-5-4-7-8-8 1 6 4 8 8 8z" fill="#6FA349"/><path d="M12 14c1-5 4-7 8-8-1 6-4 8-8 8z" fill="#8CBF63"/><path d="M12 17c-.6-3-2.4-4.4-5-5 .6 3.6 2.4 5 5 5z" fill="#7FB456"/></svg>';

export const STAR_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3l2.6 6.1 6.6.6-5 4.3 1.5 6.4L12 17l-5.7 3.4L7.8 14l-5-4.3 6.6-.6z" fill="#EFC047" stroke="#CE9C22" stroke-width="1.4" stroke-linejoin="round"/></svg>';

/* 아이템
     tier — 몇 단계에서 열리는지 (기획서 8.3). 없으면 1
     only — 이 캐릭터만 쓸 수 있음. 없으면 공용

   **값을 올리지 마세요.** 가격이 오르면 그걸 모으던 아이에게는 손해입니다(원칙 2.1).
   단계 조건도 내리는 것만 안전합니다 — 올리면 이미 열린 선반이 닫힙니다. */

export const HATS = [
  { id: 'leaf',   nm: '나뭇잎',   price: 60 },
  { id: 'straw',  nm: '밀짚모자', price: 90 },
  { id: 'ribbon', nm: '분홍리본', price: 120 },
  { id: 'beanie', nm: '털모자',   price: 170, tier: 2 },
  { id: 'party',  nm: '파티고깔', price: 220, tier: 2 },
  { id: 'star',   nm: '별모자',   price: 300, tier: 2 },
  { id: 'crown',  nm: '왕관',     price: 450, tier: 2 },
  { id: 'hflower', nm: '꽃 화관',    price: 220, tier: 3, only: 'sheep' },
  { id: 'hmoon',   nm: '달 모자',    price: 250, tier: 3, only: 'cat' },
  { id: 'hrbow',   nm: '귀 리본',    price: 280, tier: 3, only: 'rabbit' },
  { id: 'hleaf',   nm: '나뭇잎 왕관', price: 310, tier: 3, only: 'koala' },
  { id: 'horange', nm: '귤',         price: 340, tier: 3, only: 'capybara' }
];

export const SCARVES = [
  { id: 'sred',  nm: '빨간 목도리',   price: 70 },
  { id: 'sblue', nm: '파란 목도리',   price: 70 },
  { id: 'syel',  nm: '노란 목도리',   price: 110 },
  { id: 'bow',   nm: '나비넥타이',    price: 160, tier: 2 },
  { id: 'bell',  nm: '방울목걸이',    price: 230, tier: 2 },
  { id: 'rain',  nm: '무지개 목도리', price: 380, tier: 2 },
  { id: 'nknit',   nm: '뜨개 목도리',     price: 360, tier: 4, only: 'sheep' },
  { id: 'nfish',   nm: '생선 목걸이',     price: 400, tier: 4, only: 'cat' },
  { id: 'ncarrot', nm: '당근 목걸이',     price: 430, tier: 4, only: 'rabbit' },
  { id: 'neuca',   nm: '유칼립투스 목도리', price: 460, tier: 4, only: 'koala' },
  { id: 'ntowel',  nm: '온천 수건',       price: 500, tier: 4, only: 'capybara' }
];

/* 소품 — 5B에서 새로 연 슬롯. equipped.prop에 들어간다 */
export const PROPS = [
  { id: 'pballoon', nm: '풍선',       price: 180, tier: 2 },
  { id: 'pbook',    nm: '그림책',     price: 260, tier: 2 },
  { id: 'pbell',    nm: '작은 종',     price: 520, tier: 5, only: 'sheep' },
  { id: 'pwand',    nm: '요술 지팡이', price: 570, tier: 5, only: 'cat' },
  { id: 'pclover',  nm: '네잎클로버',  price: 600, tier: 5, only: 'rabbit' },
  { id: 'pbranch',  nm: '나뭇가지',    price: 640, tier: 5, only: 'koala' },
  { id: 'pduck',    nm: '오리 튜브',   price: 700, tier: 5, only: 'capybara' }
];

export const ITEMS = { hat: HATS, neck: SCARVES, prop: PROPS };
export const ALL_ITEMS = [...HATS, ...SCARVES, ...PROPS];

/* 슬롯 판정은 여기 한 곳에만 있다. 슬롯을 또 늘려도 고칠 곳이 하나다. */
export function slotOf(id) {
  for (const [slot, list] of Object.entries(ITEMS)) if (list.some(x => x.id === id)) return slot;
  return null;
}

export const isHat = id => slotOf(id) === 'hat';
export const itemById = id => ALL_ITEMS.find(x => x.id === id);

/* 상점 단계 — 기획서 8.3. 5단계가 65인 이유는 구현-현황 13.1 */
export const TIER_NEED = [0, 10, 25, 50, 65];
export const tierOf = mastered => {
  let t = 1;
  for (let i = 1; i < TIER_NEED.length; i++) if (mastered >= TIER_NEED[i]) t = i + 1;
  return t;
};

/* 캐릭터 — 해금 순서대로 */
/* anchor: [x, y, 배율] — 배율은 생략하면 1.
   넷은 머리가 커진 만큼 아이템도 같이 커져야 한다. 배율이 없으면 왕관이 모자처럼 보인다. */
export const CHARACTERS = [
  { id: 'sheep',    nm: '양',       star: 0,  anchor: { hat: [100, 30],       neck: [100, 96],       prop: [148, 146] } },
  { id: 'cat',      nm: '고양이',   star: 8,  anchor: { hat: [100, 46, 1.28], neck: [100, 111, 1.26], prop: [144, 152, 1.05] } },
  { id: 'rabbit',   nm: '토끼',     star: 15, anchor: { hat: [100, 51, 1.22], neck: [100, 112, 1.24], prop: [150, 157, 1.00] } },
  { id: 'koala',    nm: '코알라',   star: 25, anchor: { hat: [100, 47, 1.30], neck: [100, 110, 1.28], prop: [146, 152, 1.05] } },
  { id: 'capybara', nm: '카피바라', star: 40, anchor: { hat: [100, 50, 1.32], neck: [100, 115, 1.30], prop: [150, 152, 1.05] } }
];

export const charById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];

/* ── 아이템 (양 기준 좌표) ────────────────────────── */

function hatSVG(id) {
  switch (id) {
    case 'straw': return '<ellipse cx="100" cy="30" rx="54" ry="13" fill="#E0B45C" stroke="#C08F3C" stroke-width="2.5"/>' +
      '<path d="M74 30 A26 25 0 0 1 126 30 Z" fill="#EAC578" stroke="#C08F3C" stroke-width="2.5"/>' +
      '<rect x="74" y="22" width="52" height="9" rx="4" fill="#C0714A"/>';
    case 'beanie': return '<path d="M71 38 A29 28 0 0 1 129 38 Z" fill="#D9534F"/>' +
      '<path d="M71 38 A29 28 0 0 1 129 38" fill="none" stroke="#B8413E" stroke-width="2"/>' +
      '<rect x="97" y="8" width="6" height="10" fill="#D9534F"/>' +
      '<circle cx="100" cy="7" r="10" fill="#FBF7EE" stroke="#E0D8C6" stroke-width="2"/>' +
      '<rect x="66" y="32" width="68" height="13" rx="6.5" fill="#FBF7EE" stroke="#E0D8C6" stroke-width="2"/>';
    case 'crown': return '<path d="M70 42 L70 12 L85 26 L100 6 L115 26 L130 12 L130 42 Z" fill="#EFC047" stroke="#CE9C22" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<rect x="70" y="34" width="60" height="9" rx="3" fill="#DCA92C"/>' +
      '<circle cx="100" cy="16" r="4.5" fill="#E8615D"/><circle cx="80" cy="38" r="3" fill="#7FA9D4"/><circle cx="120" cy="38" r="3" fill="#7FA9D4"/>';
    case 'party': return '<path d="M100 -6 L125 40 L75 40 Z" fill="#E8709A" stroke="#CB5480" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="93" cy="20" r="4" fill="#FBF7EE"/><circle cx="107" cy="31" r="4" fill="#FBF7EE"/><circle cx="100" cy="8" r="3.5" fill="#FBF7EE"/>' +
      '<circle cx="100" cy="-8" r="8" fill="#EFC047" stroke="#CE9C22" stroke-width="2"/>';
    case 'ribbon': return '<g transform="translate(28,0) rotate(-12 100 30)">' +
      '<path d="M100 30 L81 17 L81 43 Z" fill="#F08BAE" stroke="#D46A90" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M100 30 L119 17 L119 43 Z" fill="#F08BAE" stroke="#D46A90" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="100" cy="30" r="7" fill="#E8779E" stroke="#D46A90" stroke-width="2"/></g>';
    case 'leaf': return '<g transform="rotate(-14 100 22)">' +
      '<path d="M100 38 C81 29 81 7 100 4 C119 7 119 29 100 38 Z" fill="#8CBF63" stroke="#5F9040" stroke-width="2.5"/>' +
      '<path d="M100 37 L100 7" stroke="#5F9040" stroke-width="2" fill="none"/>' +
      '<path d="M100 26 L108 20 M100 19 L92 13" stroke="#5F9040" stroke-width="1.6" fill="none"/></g>';
    case 'star': return '<ellipse cx="100" cy="40" rx="42" ry="9" fill="#5C6FB0" stroke="#3F4F87" stroke-width="2.5"/>' +
      '<path d="M100 -10 L124 40 L76 40 Z" fill="#4A5B9E" stroke="#3F4F87" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="92" cy="24" r="2.6" fill="#EFC047"/><circle cx="108" cy="33" r="2.6" fill="#EFC047"/>' +
      '<polygon points="100,-22 103.5,-13.5 112,-13.5 105,-8 108,0 100,-5 92,0 95,-8 88,-13.5 96.5,-13.5" fill="#EFC047" stroke="#CE9C22" stroke-width="1.6" stroke-linejoin="round"/>';

    /* ── 캐릭터 전용 (3단계) ──
       한 캐릭터에만 붙으므로, 그 캐릭터의 앵커·배율을 거친 뒤 제자리에 오도록 좌표를 잡았다.
       다른 캐릭터에 씌워보면 어긋난다 — 그게 전용인 이유다. */

    case 'hflower':   // 양 — 꽃 화관
      return '<path d="M68 44 Q100 18 132 44" fill="none" stroke="#6FA349" stroke-width="4.5" stroke-linecap="round"/>' +
        [[72, 42, '#F2A2BE', '#D9799C'], [86, 32, '#FBEAA0', '#DFC259'], [100, 28, '#F2A2BE', '#D9799C'],
         [114, 32, '#FBEAA0', '#DFC259'], [128, 42, '#F2A2BE', '#D9799C']]
          .map(([x, y, f, s]) => `<circle cx="${x}" cy="${y}" r="8" fill="${f}" stroke="${s}" stroke-width="1.8"/>` +
                                 `<circle cx="${x}" cy="${y}" r="2.8" fill="#F6D46A"/>`).join('');

    case 'hmoon':     // 고양이 — 달 모자 (늘어진 수면모자)
      return '<path d="M126 16 q26 -2 29 15 q2 11 -9 13" fill="none" stroke="#4A5B9E" stroke-width="9" stroke-linecap="round"/>' +
        '<circle cx="146" cy="46" r="8" fill="#FBF7EE" stroke="#E0D8C6" stroke-width="2"/>' +
        '<path d="M72 33 Q74 7 100 7 Q126 7 128 33 Z" fill="#4A5B9E" stroke="#3A4880" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<path d="M100 12 Q88 20 100 28 Q94 20 100 12 Z" fill="#F6D46A"/>' +
        '<rect x="69" y="28" width="62" height="10" rx="5" fill="#6274C0"/>';

    case 'hrbow':     // 토끼 — 귀 사이에 묶는 리본
      return '<g transform="rotate(-8 100 25)">' +
        '<path d="M100 25 L80 12 L80 38 Z" fill="#F2809F" stroke="#D4658A" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M100 25 L120 12 L120 38 Z" fill="#F2809F" stroke="#D4658A" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M96 36 L90 50 M104 36 L110 50" stroke="#D4658A" stroke-width="3" stroke-linecap="round" fill="none"/>' +
        '<circle cx="100" cy="25" r="7" fill="#E86D91" stroke="#D4658A" stroke-width="2"/></g>';

    case 'hleaf':     // 코알라 — 나뭇잎 왕관
      return '<path d="M74 34 Q100 22 126 34" fill="none" stroke="#7A9E52" stroke-width="4" stroke-linecap="round"/>' +
        [[78, 32, -38], [90, 26, -20], [100, 23, 0], [110, 26, 20], [122, 32, 38]]
          .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y - 6}" rx="6" ry="10" fill="#8CBF63" stroke="#5F9040" ` +
                              `stroke-width="1.8" transform="rotate(${r} ${x} ${y})"/>`).join('');

    case 'horange':   // 카피바라 — 머리 위의 귤
      return '<circle cx="100" cy="19" r="13.5" fill="#F0983C" stroke="#CE7621" stroke-width="2.5"/>' +
        '<path d="M92 13 q4 -4 9 -2" stroke="#F7BC7C" stroke-width="3" stroke-linecap="round" fill="none"/>' +
        '<path d="M100 6 q9 -7 15 -1 q-8 5 -15 1 Z" fill="#7FB456" stroke="#5F9040" stroke-width="1.6"/>' +
        '<rect x="98.6" y="3" width="2.8" height="6" rx="1.4" fill="#7A5A2A"/>';
  }
  return '';
}

function scarfSVG(id) {
  const band = 'M70 90 Q100 105 130 90 L130 103 Q100 118 70 103 Z';
  const tail = 'M113 100 L124 131 L109 133 L105 102 Z';
  const plain = (c, d) => `<path d="${tail}" fill="${d}"/><path d="${band}" fill="${c}"/>`;
  switch (id) {
    case 'sred':  return plain('#D9534F', '#B8413E');
    case 'sblue': return plain('#5A8FC4', '#4472A0');
    case 'syel':  return plain('#EFC047', '#CE9C22');
    case 'rain': {
      const cols = ['#E8615D', '#EFA13C', '#EFC047', '#7FB456', '#5A8FC4', '#9B79C4'];
      const uid = 'rb' + Math.random().toString(36).slice(2, 7);
      let out = `<defs><clipPath id="${uid}"><path d="${tail}"/><path d="${band}"/></clipPath></defs><g clip-path="url(#${uid})">`;
      for (let i = 0; i < 8; i++) out += `<rect x="${64 + i * 11}" y="84" width="11" height="56" fill="${cols[i % 6]}"/>`;
      return out + '</g>';
    }
    case 'bow': return '<g transform="translate(0,-5)">' +
      '<path d="M100 106 L79 93 L79 119 Z" fill="#5A8FC4" stroke="#42709F" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M100 106 L121 93 L121 119 Z" fill="#5A8FC4" stroke="#42709F" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="93" y="98" width="14" height="16" rx="5" fill="#42709F"/></g>';
    case 'bell': return '<path d="M70 90 Q100 104 130 90 L130 98 Q100 112 70 98 Z" fill="#C0714A" stroke="#A25B39" stroke-width="2"/>' +
      '<path d="M100 106 a10 10 0 1 0 .1 0" fill="#EFC047" stroke="#CE9C22" stroke-width="2.2"/>' +
      '<path d="M92 112 h16" stroke="#CE9C22" stroke-width="2.2" fill="none"/>' +
      '<circle cx="100" cy="116" r="2" fill="#CE9C22"/>';

    /* ── 캐릭터 전용 (4단계) ── */

    case 'nknit':     // 양 — 뜨개 목도리
      return `<path d="${tail}" fill="#B8845E"/><path d="${band}" fill="#CE9B70"/>` +
        '<path d="M74 95 v13 M86 99 v13 M100 101 v13 M114 99 v13 M126 95 v13" ' +
        'stroke="#B8845E" stroke-width="3" stroke-linecap="round" fill="none"/>' +
        '<path d="M107 108 l3 22 M117 106 l3 22" stroke="#B8845E" stroke-width="3" stroke-linecap="round" fill="none"/>';

    case 'nfish':     // 고양이 — 생선 목걸이
      return '<path d="M72 92 Q100 108 128 92" fill="none" stroke="#8D6E4F" stroke-width="4" stroke-linecap="round"/>' +
        '<ellipse cx="100" cy="118" rx="17" ry="9" fill="#9FC6E8" stroke="#6E9BC4" stroke-width="2"/>' +
        '<path d="M117 118 l11 -7 v14 z" fill="#9FC6E8" stroke="#6E9BC4" stroke-width="2" stroke-linejoin="round"/>' +
        '<circle cx="92" cy="115" r="2.4" fill="#3A3129"/>';

    case 'ncarrot':   // 토끼 — 당근 목걸이
      return '<path d="M72 92 Q100 108 128 92" fill="none" stroke="#C9A98A" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M100 106 l9 4 l-9 24 l-9 -24 z" fill="#F0983C" stroke="#CE7621" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M94 112 h11 M96 120 h8" stroke="#CE7621" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M100 106 q-8 -9 -13 -5 q4 7 13 5 M100 106 q8 -9 13 -5 q-4 7 -13 5" fill="#7FB456" stroke="#5F9040" stroke-width="1.5"/>';

    case 'neuca':     // 코알라 — 유칼립투스 목도리
      return '<path d="M70 92 Q100 110 130 92" fill="none" stroke="#7A9E52" stroke-width="5" stroke-linecap="round"/>' +
        [[76, 96, -40], [88, 103, -20], [100, 106, 0], [112, 103, 20], [124, 96, 40], [108, 116, 35]]
          .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="11" fill="#9DC77E" stroke="#5F9040" ` +
                              `stroke-width="1.8" transform="rotate(${r} ${x} ${y})"/>`).join('');

    case 'ntowel':    // 카피바라 — 온천 수건
      return '<path d="M68 90 Q100 106 132 90 L132 104 Q100 120 68 104 Z" fill="#FBF7EE" stroke="#DED6C4" stroke-width="2"/>' +
        '<path d="M110 102 L124 134 L108 137 L102 104 Z" fill="#F2EDE0" stroke="#DED6C4" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M70 97 Q100 113 130 97" fill="none" stroke="#7FA9D4" stroke-width="3"/>' +
        '<path d="M104 116 l14 0" stroke="#7FA9D4" stroke-width="3" stroke-linecap="round"/>';
  }
  return '';
}

/* ── 소품 (양 기준 [148,146]) ────────────────────────
   캐릭터 옆에 놓이는 물건. 몸 위에 그려지므로 마지막에 붙인다. */

function propSVG(id) {
  switch (id) {
    case 'pballoon':  // 공용 — 풍선
      return '<path d="M148 170 q-9 -16 1 -30" fill="none" stroke="#B9A98C" stroke-width="2" stroke-linecap="round"/>' +
        '<ellipse cx="148" cy="128" rx="16" ry="19" fill="#E8709A" stroke="#CB5480" stroke-width="2.5"/>' +
        '<path d="M143 121 q3 -5 8 -3" stroke="#F6B6CC" stroke-width="3.5" stroke-linecap="round" fill="none"/>' +
        '<path d="M148 147 l-4 6 h8 z" fill="#CB5480"/>';

    case 'pbook':     // 공용 — 그림책
      return '<g transform="rotate(-9 148 150)">' +
        '<rect x="127" y="130" width="42" height="36" rx="4" fill="#5A8FC4" stroke="#42709F" stroke-width="2.5"/>' +
        '<rect x="132" y="135" width="32" height="26" rx="2" fill="#FBF7EE" stroke="#DED6C4" stroke-width="1.6"/>' +
        '<path d="M137 143 h22 M137 149 h22 M137 155 h14" stroke="#C3D3C6" stroke-width="2" stroke-linecap="round"/></g>';

    /* ── 캐릭터 전용 (5단계) ── */

    case 'pbell':     // 양 — 작은 종
      return '<path d="M148 122 v8" stroke="#8D6E4F" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M148 128 q-15 6 -17 26 h34 q-2 -20 -17 -26 z" fill="#EFC047" stroke="#CE9C22" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<rect x="128" y="152" width="40" height="7" rx="3.5" fill="#DCA92C"/>' +
        '<circle cx="148" cy="164" r="5" fill="#CE9C22"/>';

    case 'pwand':     // 고양이 — 요술 지팡이
      return '<path d="M138 170 L156 130" stroke="#8D6E4F" stroke-width="5" stroke-linecap="round"/>' +
        '<polygon points="158,110 163,124 178,124 166,132 171,146 158,137 145,146 150,132 138,124 153,124" ' +
        'fill="#EFC047" stroke="#CE9C22" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<circle cx="134" cy="140" r="3" fill="#F6D46A"/><circle cx="176" cy="152" r="2.4" fill="#F6D46A"/>';

    case 'pclover':   // 토끼 — 네잎클로버
      return '<path d="M148 170 q-4 -14 0 -24" fill="none" stroke="#5F9040" stroke-width="3" stroke-linecap="round"/>' +
        [[136, 134], [160, 134], [136, 152], [160, 152]]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#8CBF63" stroke="#5F9040" stroke-width="2"/>`).join('') +
        '<circle cx="148" cy="143" r="4" fill="#7FB456"/>';

    case 'pbranch':   // 코알라 — 유칼립투스 가지
      return '<path d="M140 172 Q150 146 152 122" fill="none" stroke="#8D6E4F" stroke-width="4" stroke-linecap="round"/>' +
        [[136, 152, -50], [164, 146, 50], [138, 136, -40], [166, 128, 45], [148, 122, -10]]
          .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="12" fill="#9DC77E" stroke="#5F9040" ` +
                              `stroke-width="1.8" transform="rotate(${r} ${x} ${y})"/>`).join('');

    case 'pduck':     // 카피바라 — 오리 튜브
      return '<ellipse cx="148" cy="152" rx="24" ry="19" fill="#F6D46A" stroke="#D3A93A" stroke-width="2.5"/>' +
        '<ellipse cx="148" cy="152" rx="9" ry="7" fill="#E9F2EA" stroke="#D3A93A" stroke-width="2"/>' +
        '<circle cx="152" cy="126" r="12" fill="#F6D46A" stroke="#D3A93A" stroke-width="2.5"/>' +
        '<path d="M163 126 l10 3 l-10 4 z" fill="#F0983C" stroke="#CE7621" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<circle cx="156" cy="123" r="2.2" fill="#3A3129"/>';
  }
  return '';
}

/* 양 기준으로 그린 아이템을 그 캐릭터의 앵커점으로 옮기고, 앵커점을 중심으로 키운다.
   translate(a) scale(s) translate(-b) 는 b점을 a로 보내면서 a를 중심으로 s배 하는 것과 같다. */
function place(svg, anchor, base) {
  if (!svg) return '';
  const [ax, ay, s = 1] = anchor, [bx, by] = base;
  if (ax === bx && ay === by && s === 1) return svg;
  return `<g transform="translate(${ax},${ay}) scale(${s}) translate(${-bx},${-by})">${svg}</g>`;
}

/* ── 공통 파츠 ─────────────────────────────────────── */

const shadow = '<ellipse cx="100" cy="176" rx="58" ry="9" fill="#C3DCC7" opacity=".7"/>';

const legs = c => `<rect x="68" y="140" width="15" height="34" rx="7.5" fill="${c}"/>` +
  `<rect x="90" y="144" width="15" height="30" rx="7.5" fill="${c}"/>` +
  `<rect x="112" y="140" width="15" height="34" rx="7.5" fill="${c}"/>` +
  `<rect x="130" y="144" width="15" height="30" rx="7.5" fill="${c}"/>`;

const blush = (y = 79) => `<ellipse cx="76" cy="${y}" rx="7" ry="4.2" fill="#E8A9A0" opacity=".55"/>` +
  `<ellipse cx="124" cy="${y}" rx="7" ry="4.2" fill="#E8A9A0" opacity=".55"/>`;

/* 눈: happy면 웃는 곡선, 아니면 동그란 눈 */
function eyes(mood, y = 66, r = 5.6) {
  if (mood === 'happy')
    return `<path d="M${82} ${y} q6 -8 12 0" stroke="#3A3129" stroke-width="4" stroke-linecap="round" fill="none"/>` +
           `<path d="M${106} ${y} q6 -8 12 0" stroke="#3A3129" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  return `<circle cx="88" cy="${y}" r="${r}" fill="#3A3129"/><circle cx="112" cy="${y}" r="${r}" fill="#3A3129"/>` +
         `<circle cx="89.8" cy="${y - 2}" r="1.9" fill="#fff"/><circle cx="113.8" cy="${y - 2}" r="1.9" fill="#fff"/>`;
}

/* ── 아기 비례 파츠 (양 외 4종) ──────────────────────
   다리 넷을 세우지 않고 앞발 둘만 둔다. 넷은 어른 동물, 둘은 아기처럼 보인다. */

const paws = (fill, line) =>
  `<ellipse cx="78" cy="162" rx="14" ry="11.5" fill="${fill}" stroke="${line}" stroke-width="2"/>` +
  `<ellipse cx="122" cy="162" rx="14" ry="11.5" fill="${fill}" stroke="${line}" stroke-width="2"/>`;

/* 크고 동그란 눈. 하이라이트 두 개(큰 것 + 작은 것)가 귀여움의 절반이다.
   sx는 눈 사이 벌어짐 — 클수록 어리게 보인다. 코가 큰 코알라는 더 벌린다. */
function bigEyes(mood, y = 84, r = 9, sx = 16) {
  const l = 100 - sx, rt = 100 + sx;
  if (mood === 'happy')
    return `<path d="M${l - 10} ${y + 1} q10 -13 20 0" stroke="#3A3129" stroke-width="4.6" stroke-linecap="round" fill="none"/>` +
           `<path d="M${rt - 10} ${y + 1} q10 -13 20 0" stroke="#3A3129" stroke-width="4.6" stroke-linecap="round" fill="none"/>`;
  return `<ellipse cx="${l}" cy="${y}" rx="${r}" ry="${r + 1.2}" fill="#3A3129"/>` +
         `<ellipse cx="${rt}" cy="${y}" rx="${r}" ry="${r + 1.2}" fill="#3A3129"/>` +
         `<circle cx="${l - 3.2}" cy="${y - 3.4}" r="3.3" fill="#fff"/>` +
         `<circle cx="${rt - 3.2}" cy="${y - 3.4}" r="3.3" fill="#fff"/>` +
         `<circle cx="${l + 3.4}" cy="${y + 3.8}" r="1.7" fill="#fff" opacity=".85"/>` +
         `<circle cx="${rt + 3.4}" cy="${y + 3.8}" r="1.7" fill="#fff" opacity=".85"/>`;
}

/* 졸린 눈 (코알라·카피바라) — 감은 눈도 크게 그려야 얼굴에 묻히지 않는다 */
const sleepyBig = (y = 84, sx = 16) =>
  `<path d="M${90 - sx} ${y} q10 9 20 0" stroke="#3A3129" stroke-width="4.2" stroke-linecap="round" fill="none"/>` +
  `<path d="M${90 + sx} ${y} q10 9 20 0" stroke="#3A3129" stroke-width="4.2" stroke-linecap="round" fill="none"/>`;

const cheeks = (y = 97, c = '#F0A6A0', sx = 34) =>
  `<ellipse cx="${100 - sx}" cy="${y}" rx="9.5" ry="5.8" fill="${c}" opacity=".6"/>` +
  `<ellipse cx="${100 + sx}" cy="${y}" rx="9.5" ry="5.8" fill="${c}" opacity=".6"/>`;

const smile = (y = 101, c = '#6B5A48') =>
  `<path d="M100 ${y - 5} v4" stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
  `<path d="M100 ${y} q-6 6 -11 1 M100 ${y} q6 6 11 1" stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;

/* ── 캐릭터별 그리기 ───────────────────────────────── */

const DRAW = {
  sheep(mood) {
    const wool = '#FDFAF3', line = '#E4DBCB', face = '#CDBBA5', fl = '#B39F87';
    const bumps = [[54,102],[62,78],[84,64],[116,64],[138,78],[146,102],[140,128],[60,128]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="${wool}" stroke="${line}" stroke-width="2"/>`).join('');
    return shadow + legs('#A08D77') + bumps +
      `<ellipse cx="100" cy="106" rx="52" ry="42" fill="${wool}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="68" cy="58" rx="14" ry="8.5" fill="${face}" stroke="${fl}" stroke-width="2" transform="rotate(-22 68 58)"/>` +
      `<ellipse cx="132" cy="58" rx="14" ry="8.5" fill="${face}" stroke="${fl}" stroke-width="2" transform="rotate(22 132 58)"/>` +
      `<ellipse cx="100" cy="66" rx="31" ry="33" fill="${face}" stroke="${fl}" stroke-width="2"/>` +
      `<circle cx="80" cy="40" r="15" fill="${wool}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="120" cy="40" r="15" fill="${wool}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="100" cy="33" r="17" fill="${wool}" stroke="${line}" stroke-width="2"/>` +
      eyes(mood) + blush() +
      '<path d="M94 80 q6 6 12 0" stroke="#6B5A48" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
  },

  /* 시크한 츤데레 — 눈은 크게, 볼터치로 차가움을 덜어낸다 */
  cat(mood) {
    const fur = '#C7CFDE', line = '#A3ACC0', belly = '#F2F5FA', inner = '#F2AFBD';
    const tail = 'M136 146 q34 2 34 -25 q0 -20 -16 -20';
    return shadow +
      `<path d="${tail}" fill="none" stroke="${line}" stroke-width="15" stroke-linecap="round"/>` +
      `<path d="${tail}" fill="none" stroke="${fur}" stroke-width="11" stroke-linecap="round"/>` +
      `<ellipse cx="100" cy="137" rx="37" ry="31" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="100" cy="143" rx="21" ry="21" fill="${belly}"/>` +
      paws(fur, line) +
      `<path d="M68 54 L77 18 L100 40 Z" fill="${fur}" stroke="${line}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M132 54 L123 18 L100 40 Z" fill="${fur}" stroke="${line}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M75 49 L80 29 L94 42 Z" fill="${inner}"/>` +
      `<path d="M125 49 L120 29 L106 42 Z" fill="${inner}"/>` +
      `<ellipse cx="100" cy="78" rx="41" ry="37" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<path d="M85 55 q15 -7 30 0" stroke="${line}" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
      bigEyes(mood, 86, 9, 17) + cheeks(99, '#EFA6A8') +
      '<path d="M100 94 l-6.5 5.5 h13 z" fill="#EE93A6"/>' +
      smile(103) +
      `<path d="M60 86 h-17 M60 93 h-15 M140 86 h17 M140 93 h15" stroke="${line}" stroke-width="2" stroke-linecap="round"/>`;
  },

  /* 활발하고 신남 — 귀를 살짝 벌려 세우면 표정이 밝아진다 */
  rabbit(mood) {
    const fur = '#FFF8F3', line = '#E7D6CA', inner = '#F7B7C6';
    return shadow +
      `<ellipse cx="100" cy="137" rx="36" ry="31" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="140" cy="152" r="15" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      paws(fur, line) +
      `<ellipse cx="79" cy="27" rx="13" ry="31" fill="${fur}" stroke="${line}" stroke-width="2" transform="rotate(-13 79 27)"/>` +
      `<ellipse cx="121" cy="27" rx="13" ry="31" fill="${fur}" stroke="${line}" stroke-width="2" transform="rotate(13 121 27)"/>` +
      `<ellipse cx="79" cy="29" rx="6" ry="21" fill="${inner}" transform="rotate(-13 79 29)"/>` +
      `<ellipse cx="121" cy="29" rx="6" ry="21" fill="${inner}" transform="rotate(13 121 29)"/>` +
      `<ellipse cx="100" cy="80" rx="40" ry="36" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      bigEyes(mood, 87, 9, 17) + cheeks(101, '#F4A8B4', 33) +
      '<path d="M100 97 l-6.5 5.5 h13 z" fill="#EE93A6"/>' +
      smile(106, '#8A7566') +
      `<rect x="93" y="110" width="6.6" height="9.5" rx="2.8" fill="#fff" stroke="${line}" stroke-width="1.2"/>` +
      `<rect x="100.4" y="110" width="6.6" height="9.5" rx="2.8" fill="#fff" stroke="${line}" stroke-width="1.2"/>`;
  },

  /* 늘 졸림 — 큰 코가 정체성이라 눈을 더 벌려 자리를 만든다 */
  koala(mood) {
    const fur = '#BAC4D2', line = '#97A2B2', ear = '#DEE5EE', belly = '#E5EBF1';
    return shadow +
      `<circle cx="55" cy="66" r="28" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="145" cy="66" r="28" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="55" cy="66" r="17.5" fill="${ear}"/><circle cx="145" cy="66" r="17.5" fill="${ear}"/>` +
      `<ellipse cx="100" cy="138" rx="37" ry="30" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="100" cy="144" rx="22" ry="21" fill="${belly}"/>` +
      paws(fur, line) +
      `<ellipse cx="100" cy="78" rx="40" ry="36" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      (mood === 'happy' ? bigEyes('happy', 82, 9, 24) : sleepyBig(82, 24)) +
      '<ellipse cx="100" cy="96" rx="13.5" ry="14.5" fill="#4A4038"/>' +
      '<ellipse cx="95.5" cy="91" rx="3.6" ry="4.2" fill="#7A6C60" opacity=".7"/>' +
      cheeks(92, '#E9A6A8', 32) +
      '<path d="M92 114 q8 6 16 0" stroke="#6B5A48" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
      (mood === 'happy' ? '' :
        `<text x="148" y="24" font-size="20" fill="${line}" opacity=".7">z</text>` +
        `<text x="163" y="8" font-size="14" fill="${line}" opacity=".5">z</text>`);
  },

  /* 초연하고 태평 — 네모난 얼굴이 정체성이라 없애지 않고, 모서리만 아주 둥글게 굴린다 */
  capybara(mood) {
    const fur = '#C89A6E', line = '#A67A50', muzzle = '#DCB68F', belly = '#D8B189';
    return shadow +
      `<ellipse cx="100" cy="140" rx="40" ry="30" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="100" cy="146" rx="23" ry="20" fill="${belly}" opacity=".55"/>` +
      paws(fur, line) +
      `<ellipse cx="69" cy="45" rx="11" ry="9" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="131" cy="45" rx="11" ry="9" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<rect x="58" y="44" width="84" height="70" rx="31" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      (mood === 'happy' ? bigEyes('happy', 76, 9, 21) : sleepyBig(76, 21)) +
      `<rect x="76" y="86" width="48" height="28" rx="14" fill="${muzzle}"/>` +
      '<ellipse cx="100" cy="96" rx="9" ry="6" fill="#5C4634"/>' +
      cheeks(88, '#DFA07E', 33) +
      '<path d="M100 103 v4 M100 107 q-7 5 -12 0 M100 107 q7 5 12 0" stroke="#6B5A48" stroke-width="2.5" stroke-linecap="round" fill="none"/>' +
      `<path d="M58 78 h-14 M142 78 h14" stroke="${line}" stroke-width="2" stroke-linecap="round"/>`;
  }
};

/* 캐릭터 하나 그리기 */
export function charSVG(charId, wear = {}, mood = '', cls = '') {
  const c = charById(charId);
  const base = CHARACTERS[0].anchor;
  return `<svg class="sheepbox ${cls}" viewBox="0 -30 200 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.nm}">` +
    DRAW[c.id](mood) +
    place(wear.neck ? scarfSVG(wear.neck) : '', c.anchor.neck, base.neck) +
    place(wear.hat ? hatSVG(wear.hat) : '', c.anchor.hat, base.hat) +
    place(wear.prop ? propSVG(wear.prop) : '', c.anchor.prop, base.prop) +
  '</svg>';
}
