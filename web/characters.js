/* 캐릭터와 아이템 그리기.
   아이템 SVG는 양 기준 좌표(모자 100,30 / 목 100,96)로 한 벌만 그리고,
   캐릭터마다 앵커 차이만큼 옮겨서 붙인다. */

export const GRASS_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21c0-5 0-8 0-8" stroke="#527B34" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M12 14c-1-5-4-7-8-8 1 6 4 8 8 8z" fill="#6FA349"/><path d="M12 14c1-5 4-7 8-8-1 6-4 8-8 8z" fill="#8CBF63"/><path d="M12 17c-.6-3-2.4-4.4-5-5 .6 3.6 2.4 5 5 5z" fill="#7FB456"/></svg>';

export const STAR_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3l2.6 6.1 6.6.6-5 4.3 1.5 6.4L12 17l-5.7 3.4L7.8 14l-5-4.3 6.6-.6z" fill="#EFC047" stroke="#CE9C22" stroke-width="1.4" stroke-linejoin="round"/></svg>';

export const HATS = [
  { id: 'leaf',   nm: '나뭇잎',   price: 60 },
  { id: 'straw',  nm: '밀짚모자', price: 90 },
  { id: 'ribbon', nm: '분홍리본', price: 120 },
  { id: 'beanie', nm: '털모자',   price: 170 },
  { id: 'party',  nm: '파티고깔', price: 220 },
  { id: 'star',   nm: '별모자',   price: 300 },
  { id: 'crown',  nm: '왕관',     price: 450 }
];

export const SCARVES = [
  { id: 'sred',  nm: '빨간 목도리',   price: 70 },
  { id: 'sblue', nm: '파란 목도리',   price: 70 },
  { id: 'syel',  nm: '노란 목도리',   price: 110 },
  { id: 'bow',   nm: '나비넥타이',    price: 160 },
  { id: 'bell',  nm: '방울목걸이',    price: 230 },
  { id: 'rain',  nm: '무지개 목도리', price: 380 }
];

export const isHat = id => HATS.some(h => h.id === id);
export const itemById = id => HATS.concat(SCARVES).find(x => x.id === id);

/* 캐릭터 — 해금 순서대로 */
export const CHARACTERS = [
  { id: 'sheep',    nm: '양',       star: 0,  anchor: { hat: [100, 30], neck: [100, 96] } },
  { id: 'cat',      nm: '고양이',   star: 8,  anchor: { hat: [100, 24], neck: [100, 100] } },
  { id: 'rabbit',   nm: '토끼',     star: 15, anchor: { hat: [100, 44], neck: [100, 106] } },
  { id: 'koala',    nm: '코알라',   star: 25, anchor: { hat: [100, 28], neck: [100, 100] } },
  { id: 'capybara', nm: '카피바라', star: 40, anchor: { hat: [100, 34], neck: [100, 104] } }
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
  }
  return '';
}

/* 양 앵커와의 차이만큼 아이템을 옮긴다 */
function place(svg, anchor, base) {
  if (!svg) return '';
  const dx = anchor[0] - base[0], dy = anchor[1] - base[1];
  return dx || dy ? `<g transform="translate(${dx},${dy})">${svg}</g>` : svg;
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

/* 졸린 눈 (코알라·카피바라) */
const sleepyEyes = (y = 68) =>
  `<path d="M82 ${y} q6 5 12 0" stroke="#3A3129" stroke-width="3.6" stroke-linecap="round" fill="none"/>` +
  `<path d="M106 ${y} q6 5 12 0" stroke="#3A3129" stroke-width="3.6" stroke-linecap="round" fill="none"/>`;

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

  cat(mood) {
    const fur = '#AEB5C0', line = '#8D95A3', belly = '#EDEFF3', ear = '#E8A9B4';
    const stripes = '<path d="M78 96 q10 -5 0 -10 M78 116 q10 -5 0 -10 M122 96 q-10 -5 0 -10 M122 116 q-10 -5 0 -10" ' +
      `stroke="${line}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    return shadow + legs('#9AA2AE') +
      `<path d="M148 150 q22 -6 16 -30 q-4 -16 -18 -14" stroke="${fur}" stroke-width="13" stroke-linecap="round" fill="none"/>` +
      `<ellipse cx="100" cy="112" rx="46" ry="40" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="100" cy="122" rx="26" ry="27" fill="${belly}"/>` + stripes +
      `<path d="M74 44 L70 12 L96 30 Z" fill="${fur}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M126 44 L130 12 L104 30 Z" fill="${fur}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M77 40 L75 22 L91 33 Z" fill="${ear}"/><path d="M123 40 L125 22 L109 33 Z" fill="${ear}"/>` +
      `<ellipse cx="100" cy="62" rx="36" ry="31" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<path d="M72 46 q8 6 14 3 M128 46 q-8 6 -14 3" stroke="${line}" stroke-width="2.4" fill="none"/>` +
      (mood === 'happy' ? eyes('happy', 62)
        : '<ellipse cx="87" cy="62" rx="5.4" ry="7" fill="#3A3129"/><ellipse cx="113" cy="62" rx="5.4" ry="7" fill="#3A3129"/>' +
          '<circle cx="88.6" cy="59" r="1.9" fill="#fff"/><circle cx="114.6" cy="59" r="1.9" fill="#fff"/>') +
      '<path d="M100 72 l-5 4 h10 z" fill="#E88FA0"/>' +
      '<path d="M100 76 v3 M100 79 q-5 5 -10 1 M100 79 q5 5 10 1" stroke="#6B5A48" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
      '<path d="M64 66 h-18 M64 72 h-16 M136 66 h18 M136 72 h16" stroke="#8D95A3" stroke-width="1.8" stroke-linecap="round"/>';
  },

  rabbit(mood) {
    const fur = '#FBF4EF', line = '#E3D6CC', inner = '#F3C0CC';
    return shadow + legs('#E0D2C6') +
      `<ellipse cx="100" cy="112" rx="46" ry="40" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="152" cy="128" r="14" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="82" cy="26" rx="11" ry="32" fill="${fur}" stroke="${line}" stroke-width="2" transform="rotate(-9 82 26)"/>` +
      `<ellipse cx="118" cy="26" rx="11" ry="32" fill="${fur}" stroke="${line}" stroke-width="2" transform="rotate(9 118 26)"/>` +
      `<ellipse cx="82" cy="28" rx="5" ry="22" fill="${inner}" transform="rotate(-9 82 28)"/>` +
      `<ellipse cx="118" cy="28" rx="5" ry="22" fill="${inner}" transform="rotate(9 118 28)"/>` +
      `<ellipse cx="100" cy="70" rx="34" ry="30" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      eyes(mood, 68) + blush(82) +
      '<path d="M100 78 l-5 4 h10 z" fill="#E88FA0"/>' +
      '<path d="M100 82 v3 M100 85 q-5 5 -9 1 M100 85 q5 5 9 1" stroke="#8A7566" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
      '<rect x="94" y="88" width="5" height="7" rx="2" fill="#fff" stroke="#E3D6CC" stroke-width="1"/>' +
      '<rect x="101" y="88" width="5" height="7" rx="2" fill="#fff" stroke="#E3D6CC" stroke-width="1"/>';
  },

  koala(mood) {
    const fur = '#A7B0BA', line = '#8A939E', ear = '#C9D2DA', belly = '#DFE5EA';
    return shadow + legs('#959EA9') +
      `<circle cx="58" cy="58" r="26" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="142" cy="58" r="26" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<circle cx="58" cy="58" r="16" fill="${ear}"/><circle cx="142" cy="58" r="16" fill="${ear}"/>` +
      `<ellipse cx="100" cy="116" rx="46" ry="38" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="100" cy="124" rx="27" ry="26" fill="${belly}"/>` +
      `<ellipse cx="100" cy="66" rx="37" ry="33" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      (mood === 'happy' ? eyes('happy', 64) : sleepyEyes(64)) +
      '<ellipse cx="100" cy="80" rx="13" ry="15" fill="#4A4038"/>' +
      '<ellipse cx="96" cy="76" rx="3.4" ry="4" fill="#6E6157" opacity=".8"/>' +
      '<path d="M92 98 q8 5 16 0" stroke="#6B5A48" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
      (mood === 'happy' ? '' : '<text x="140" y="34" font-size="17" fill="#8A939E" opacity=".75">z</text>' +
        '<text x="152" y="20" font-size="13" fill="#8A939E" opacity=".55">z</text>');
  },

  capybara(mood) {
    const fur = '#B98A5E', line = '#9A7049', muzzle = '#CBA179';
    return shadow + legs('#A5794F') +
      `<ellipse cx="100" cy="114" rx="50" ry="38" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="72" cy="40" rx="9" ry="7" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<ellipse cx="128" cy="40" rx="9" ry="7" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<rect x="64" y="42" width="72" height="52" rx="24" fill="${fur}" stroke="${line}" stroke-width="2"/>` +
      `<rect x="78" y="70" width="44" height="26" rx="13" fill="${muzzle}"/>` +
      (mood === 'happy' ? eyes('happy', 60) : sleepyEyes(60)) +
      '<ellipse cx="100" cy="78" rx="8" ry="5" fill="#5C4634"/>' +
      '<path d="M100 83 v4 M100 87 q-6 4 -11 0 M100 87 q6 4 11 0" stroke="#6B5A48" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
      '<path d="M64 60 h-14 M136 60 h14" stroke="#9A7049" stroke-width="1.8" stroke-linecap="round"/>';
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
  '</svg>';
}
