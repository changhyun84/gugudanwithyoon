import { CHARACTERS, GRASS_ICON, HATS, SCARVES, STAR_ICON, charById, charSVG, isHat, itemById } from './characters.js';
import { TARGETS, factKey, buildIndex, packList, pruneLogs, seedFacts, makeQuestion, applyResult } from './engine.js';

const BASE_REWARD = 3;    // 풀어보기만 해도
const BONUS_REWARD = 3;   // 맞추면 조금 더
const PENDING = 'gugudan-pending';
const LAST_ID = 'gugudan-last-profile';

const app = document.getElementById('app');
let P = null;             // 프로필
let INDEX = {};           // 문제 전체 (내장 구구단 + 부모 팩) — 부모가 끈 것은 빠져 있다
let PACKS = [];           // 서버에서 받은 팩 원본. 프로필마다 제외 목록이 달라 다시 짓는다
let MESSAGES = {};        // content/messages.csv
const recent = [];        // 최근 쓴 응원 5개 — 바로 반복되면 금방 질린다
const recentKeys = [];    // 최근 낸 문제 3개 — 같은 문제가 연달아 나오지 않게
let view = 'home', quiz = null, shopTab = 'hat', askedAt = 0, sinceSave = 0, packId = null;

const today = () => new Date().toLocaleDateString('sv-SE');   // 2026-08-16
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const api = (url, opt) => fetch(url, opt).then(r => r.json());
const goal = () => P.daily.goal || 20;

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), 1800);
}

/* ============ 저장 ============ */

async function save() {
  sinceSave = 0;
  const body = JSON.stringify(P);
  try {
    await fetch(`/api/profile/${encodeURIComponent(P.id)}`, { method: 'PUT', body });
    localStorage.removeItem(PENDING);
  } catch {
    localStorage.setItem(PENDING, body);   // Wi-Fi가 끊겨도 진행이 날아가면 안 된다
  }
}

function saveSoon() {
  if (++sinceSave >= 5) save();
}

addEventListener('pagehide', () => {
  if (P) navigator.sendBeacon(`/api/profile/${encodeURIComponent(P.id)}`, JSON.stringify(P));
});
addEventListener('visibilitychange', () => {
  if (P && document.visibilityState === 'hidden') save();
});

/* ============ 프로필 ============ */

function rollDay() {
  if (P.daily.day === today()) return;
  if (P.daily.solved > 0) {
    P.history.push({ day: P.daily.day, solved: P.daily.solved, right: P.daily.right || 0,
                     grass: P.daily.grass || 0, star: P.daily.star || 0 });
    P.history = P.history.slice(-90);
    P.totals.daysPlayed++;
  }
  P.daily = { day: today(), solved: 0, goal: goal(), speedRuns: 0, right: 0, grass: 0, star: 0 };
  pruneLogs(P.facts);   // 14일 지난 기록은 버린다 — 부모 화면은 7일만 본다
}

async function enter(id) {
  P = await api(`/api/profile/${encodeURIComponent(id)}`);
  localStorage.setItem(LAST_ID, id);
  P.disabled ||= { problems: [], packs: [] };
  INDEX = buildIndex(PACKS, P.disabled);   // 부모가 끈 문제는 여기서 빠진다
  seedFacts(INDEX, P.facts);
  rollDay();
  await save();
  go('home');
}

async function start() {
  const pending = localStorage.getItem(PENDING);
  if (pending) {
    const stale = JSON.parse(pending);
    await fetch(`/api/profile/${encodeURIComponent(stale.id)}`, { method: 'PUT', body: pending });
    localStorage.removeItem(PENDING);
  }

  const { profiles, packs, messages } = await api('/api/bootstrap');
  MESSAGES = messages || {};
  const loaded = await Promise.all((packs || []).map(p => api(`/api/pack/${encodeURIComponent(p.id)}`)));
  PACKS = loaded;
  INDEX = buildIndex(loaded);   // 프로필을 고르면 그 아이의 제외 목록으로 다시 짓는다

  const last = localStorage.getItem(LAST_ID);
  if (profiles.length === 1) return enter(profiles[0].id);
  if (profiles.length && profiles.some(p => p.id === last)) return renderWho(profiles, last);
  renderWho(profiles);
}

function renderWho(profiles, last) {
  app.innerHTML =
    '<div class="card stage mt2">' + charSVG('sheep', {}, 'happy', 'pop') +
      '<h1 class="sheepname">누구야?</h1>' +
      '<p class="sub">천천히 해도 괜찮아</p>' +
      '<div class="who">' +
        profiles.map(p => `<button class="btn ${p.id === last ? 'go' : 'soft'}" data-id="${esc(p.id)}">${esc(p.displayName)}</button>`).join('') +
      '</div>' +
      '<div class="mt"><input type="text" id="nm" maxlength="20" placeholder="새로 시작할 이름" autocomplete="off"></div>' +
      '<button class="btn soft mt" id="make">새로 시작하기</button>' +
    '</div>';

  app.querySelectorAll('[data-id]').forEach(b => b.onclick = () => enter(b.dataset.id));
  app.querySelector('#make').onclick = async () => {
    const id = app.querySelector('#nm').value.trim();
    if (!id) return toast('이름을 적어줘');
    const made = await api('/api/profile', { method: 'POST', body: JSON.stringify({ id }) });
    made.error ? toast(made.error) : enter(id);
  };
}

/* ============ 공통 ============ */

const active = () => P.characters.active || 'sheep';
const charName = (id = active()) => P.characters.names[id] || charById(id).nm;
const worn = (id = active()) => (P.characters.equipped[id] ||= { hat: null, neck: null, prop: null });
const unlocked = () => CHARACTERS.filter(c => P.characters.unlocked.includes(c.id));
const me = (mood = '', cls = '') => charSVG(active(), worn(), mood, cls);

/* 응원 한마디 — 캐릭터 것이 없으면 공통, 그것도 없으면 조용히 넘어간다 */
function say(situation, vars = {}) {
  const pool = [...(MESSAGES[active()]?.[situation] || []), ...(MESSAGES.all?.[situation] || [])];
  const fresh = pool.filter(m => !recent.includes(m));
  const from = fresh.length ? fresh : pool;
  const pick = from[Math.floor(Math.random() * from.length)];
  if (!pick) return '';
  recent.push(pick);
  if (recent.length > 5) recent.shift();
  const filled = pick.replace('{이름}', P.displayName)
                     .replace('{정답}', vars.answer ?? '')
                     .replace('{문제}', vars.prompt ?? '');
  return fixJosa(filled);
}

/* 받침에 맞춰 조사를 고른다 — "12이구나"가 아니라 "12구나" */
function hasFinal(text) {
  const last = text.trim().slice(-1);
  if (/[0-9]/.test(last)) return '013678'.includes(last);   // 영·일·삼·육·칠·팔·십
  const code = last.charCodeAt(0) - 0xAC00;
  return code >= 0 && code <= 11171 ? (code % 28) !== 0 : true;
}

function fixJosa(text) {
  return text
    .replace(/(\S)(이야|이래|이구나|이거든|이네|이지)/g, (m, ch, tail) =>
      hasFinal(ch) ? m : ch + tail.slice(1))
    .replace(/(\S)이었/g, (m, ch) => hasFinal(ch) ? m : ch + '였')
    .replace(/(\S)(이|가)\s/g, (m, ch, j) => ch + (hasFinal(ch) ? '이 ' : '가 '))
    .replace(/(\S)(을|를)\s/g, (m, ch, j) => ch + (hasFinal(ch) ? '을 ' : '를 '));
}

function bubble(text) {
  return text ? `<div class="says pop"><div class="mini">${me('happy')}</div><p>${esc(text)}</p></div>` : '';
}

/* 목장에 함께 사는 식구들 + 다음에 만날 친구 */
const nextFriend = () => CHARACTERS.find(c => !P.characters.unlocked.includes(c.id));

function herd() {
  const others = unlocked().filter(c => c.id !== active());
  const next = nextFriend();
  if (!others.length && !next) return '';

  let html = '<div class="herd">' +
    others.map(c => `<div class="herdone" data-swap="${c.id}">${charSVG(c.id, worn(c.id), 'happy')}</div>`).join('');
  if (next) html += `<div class="herdone soon" data-go="friends">${charSVG(next.id, {}, 'happy')}</div>`;
  html += '</div>';

  if (next) {
    const left = next.star - P.wallet.star;
    html += `<p class="sub soonline">${left > 0
      ? `별 ${left}개를 모으면 ${next.nm}를 만날 수 있어`
      : `${next.nm}를 데려올 수 있어!`}</p>`;
  }
  return html;
}

function topbar(back) {
  const backBtn = '<button class="iconbtn" data-go="home" aria-label="돌아가기"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#33453A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>';
  const whoBtn = '<button class="iconbtn" data-who="1" aria-label="다른 사람"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#33453A" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="9" r="3.4"/><path d="M5.5 19c1.2-3 3.6-4.4 6.5-4.4s5.3 1.4 6.5 4.4"/></svg></button>';
  return '<div class="topbar">' +
    (back ? backBtn : '<span style="width:46px"></span>') +
    `<div class="purse">${GRASS_ICON}<span class="n">${P.wallet.grass}</span>` +
      (P.wallet.star ? `<span class="sep"></span>${STAR_ICON}<span class="n">${P.wallet.star}</span>` : '') +
    '</div>' +
    (back ? '<span style="width:46px"></span>' : whoBtn) +
  '</div>';
}

function bind() {
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  app.querySelectorAll('[data-who]').forEach(b => b.onclick = async () => { await save(); start(); });
  app.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => {
    P.characters.active = b.dataset.swap;
    save();
    render();
  });
}

function go(v) {
  if (P) save();
  view = v;
  render();
  scrollTo(0, 0);
}

function render() {
  if (!P.characters.names.sheep) renderNaming();
  else if (view === 'pick') renderPick();
  else if (view === 'friends') renderFriends();
  else if (view === 'quiz') renderQuiz();
  else if (view === 'shop') renderShop();
  else if (view === 'closet') renderCloset();
  else if (view === 'done') renderDone();
  else renderHome();
  bind();
}

/* ============ 이름 짓기 ============ */

function renderNaming() {
  app.innerHTML =
    '<div class="card stage mt2">' + charSVG('sheep', {}, 'happy', 'pop') +
      '<h1 class="sheepname">안녕! 나는 양이야</h1>' +
      '<p class="sub">내 이름을 지어줄래?</p>' +
      '<div class="mt"><input type="text" id="nm" maxlength="8" placeholder="예: 뭉치" autocomplete="off"></div>' +
      '<button class="btn go mt" id="ok">이 이름으로 할래</button>' +
    '</div>';

  const done = () => {
    const v = app.querySelector('#nm').value.trim();
    if (!v) return toast('이름을 적어줘');
    P.characters.names.sheep = v.slice(0, 8);
    save();
    go('home');
  };
  app.querySelector('#ok').onclick = done;
  app.querySelector('#nm').addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
}

/* ============ 홈 ============ */

function renderHome() {
  const done = P.daily.solved, pct = Math.min(100, done / goal() * 100);
  const finished = done >= goal();
  const learned = TARGETS.filter(f => P.facts[factKey(f[0], f[1])].m >= 3).length;
  const extra = P.totals.mastered > learned ? ` &nbsp;·&nbsp; 완전히 외운 것 ${P.totals.mastered}` : '';

  app.innerHTML = topbar(false) +
    '<div class="card stage">' +
      me(finished ? 'happy' : '', 'hop') + herd() +
      `<h1 class="sheepname">${esc(charName())}</h1>` +
      `<p class="sub">${finished ? '오늘 몫은 다 했어. 내일 또 보자!'
        : done > 0 ? '조금만 더 하면 오늘 끝이야' : esc(say('시작') || '오늘도 같이 해볼까?')}</p>` +
      '<div class="prog">' +
        `<div class="lbl"><span>오늘</span><span>${done} / ${goal()}</span></div>` +
        `<div class="track"><div class="fill" style="width:${pct}%"></div></div>` +
      '</div>' +
    '</div>' +
    `<button class="btn go mt2" id="play">${finished ? '조금 더 해볼래' : '문제 풀러 가기'}</button>` +
    (nextFriend() && P.wallet.star >= nextFriend().star
      ? `<button class="btn sun mt" data-go="friends">${nextFriend().nm}가 기다리고 있어</button>` : '') +
    '<div class="btnrow">' +
      '<button class="btn soft" data-go="shop">가게</button>' +
      '<button class="btn soft" data-go="closet">옷장</button>' +
      '<button class="btn soft" data-go="friends">친구들</button>' +
    '</div>' +
    `<p class="sub center mt2">구구단 ${learned} / ${TARGETS.length}${extra} &nbsp;·&nbsp; 함께한 날 ${P.totals.daysPlayed}일</p>`;

  app.querySelector('#play').onclick = () => packList(INDEX).length > 1 ? go('pick') : startQuiz();
}

/* ============ 무엇을 풀까 (자유 모드) ============ */

function renderPick() {
  const packs = packList(INDEX);
  app.innerHTML = topbar(true) +
    '<div class="card stage">' + me('happy', 'pop') +
      '<h1 class="sheepname">무엇을 풀까?</h1>' +
      '<p class="sub">골라도 되고, 다 섞어도 돼</p>' +
    '</div>' +
    '<button class="btn go mt2" data-pack="">다 섞어서</button>' +
    packs.map(p => `<button class="btn soft mt" data-pack="${esc(p.id)}">${esc(p.name)}</button>`).join('');

  app.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => {
    packId = b.dataset.pack || null;
    startQuiz();
  });
}

/* ============ 퀴즈 ============ */

function startQuiz() { nextQ(); go('quiz'); }

function nextQ() {
  quiz = makeQuestion(INDEX, P.facts, recentKeys, today(), packId);
  recentKeys.push(quiz.key);
  if (recentKeys.length > 3) recentKeys.shift();
  askedAt = Date.now();
}

function renderQuiz() {
  const q = quiz;
  const long = q.prompt.length > 12;
  let body = topbar(true) + '<div class="card">' +
    `<div class="qhead"><span>오늘 ${P.daily.solved} / ${goal()}</span><span>천천히 해도 괜찮아</span></div>` +
    `<div class="question ${long ? 'long' : ''}">${esc(q.prompt)}</div><div class="choices">`;

  q.choices.forEach(c => {
    let cls = 'choice' + (c.length > 3 ? ' word' : '');
    if (q.state !== 'ask') cls += (c === q.answer && q.picked === q.answer) ? ' ok' : c === q.answer ? ' show' : ' dim';
    body += `<button class="${cls}" ${q.state === 'ask' ? `data-pick="${esc(c)}"` : 'disabled'}>${esc(c)}</button>`;
  });
  body += '</div>';

  if (q.state === 'ask') {
    if (q.hinted) body += `<div class="hintbox pop"><strong>이렇게 하면 쉬워</strong><br>${esc(q.hint)}</div>`;
    else if (q.hint) body += '<button class="hintbtn" id="hint">힌트 보기 (풀은 그대로 받아)</button>';
  } else if (q.state === 'right') {
    body += `<div class="feedback good pop"><span class="big">맞았어!</span><span class="reward">풀 +${q.gain} 받았어</span></div>` +
      bubble(q.says);
  } else {
    const tell = q.equation ? `${esc(q.prompt)} = ${esc(q.answer)}` : esc(q.answer);
    body += `<div class="feedback tell pop"><span class="big">${tell}</span>${q.hint ? esc(q.hint) : ''}` +
      `<br><span class="reward">풀 +${q.gain} 받았어</span></div>` +
      bubble(q.says) +
      '<button class="btn soft mt" id="next">알겠어</button>';
  }
  app.innerHTML = body + '</div>';

  app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => answer(b.textContent));
  const hint = app.querySelector('#hint');
  if (hint) hint.onclick = () => { quiz.hinted = true; renderQuiz(); bind(); };
  const next = app.querySelector('#next');
  if (next) next.onclick = advance;
}

function answer(picked) {
  const q = quiz;
  const right = picked === q.answer;
  q.picked = picked;
  q.gain = BASE_REWARD + (right && !q.hinted ? BONUS_REWARD : right ? 1 : 0);
  q.state = right ? 'right' : 'wrong';
  q.says = say(right ? (q.hinted ? '힌트정답' : '정답') : '오답', { answer: q.answer, prompt: q.prompt });

  P.wallet.grass += q.gain;
  P.daily.solved++;
  P.daily.grass = (P.daily.grass || 0) + q.gain;
  if (right) P.daily.right = (P.daily.right || 0) + 1;
  P.totals.solved++;

  const mastered = applyResult(INDEX[q.key], P.facts[q.key], right, q.hinted, today(), Date.now() - askedAt);
  if (mastered) {
    P.wallet.star++;
    P.daily.star = (P.daily.star || 0) + 1;
    P.totals.mastered++;
    P.collection.stickers.push(q.key);
    setTimeout(() => toast(say('마스터') || '이건 이제 완전히 외웠어!'), 400);
  }

  saveSoon();
  renderQuiz();
  bind();
  if (right) setTimeout(() => { if (quiz.state === 'right') advance(); }, 1100);
}

function advance() {
  if (P.daily.solved >= goal() && P.daily.solved % goal() === 0) return go('done');
  nextQ();
  renderQuiz();
  bind();
}

/* ============ 오늘 끝 ============ */

function renderDone() {
  app.innerHTML = topbar(true) +
    '<div class="card stage">' +
      me('happy', 'hop') +
      '<h1 class="sheepname">오늘 끝!</h1>' +
      `<p class="sub">${esc(say('끝') || goal() + '문제 다 했어. 잘했어!')}</p>` +
      `<p class="mt" style="font-family:Jua,sans-serif;font-size:22px;color:var(--grass-deep)">지금까지 모은 풀 ${P.wallet.grass}</p>` +
    '</div>' +
    '<button class="btn sun mt2" data-go="shop">가게 구경하기</button>' +
    '<div class="btnrow">' +
      '<button class="btn soft" data-go="home">집으로</button>' +
      '<button class="btn soft" id="more">더 풀래</button>' +
    '</div>';

  app.querySelector('#more').onclick = startQuiz;
}

/* ============ 가게 ============ */

function renderShop() {
  const list = shopTab === 'hat' ? HATS : SCARVES;
  let html = topbar(true) + '<h2 class="center" style="margin:2px 0 0">가게</h2>' +
    '<p class="sub center" style="margin:2px 0 0">문제를 풀면 풀이 쌓여</p>' +
    '<div class="tabs">' +
      `<button class="tab ${shopTab === 'hat' ? 'on' : ''}" data-tab="hat">모자</button>` +
      `<button class="tab ${shopTab === 'scarf' ? 'on' : ''}" data-tab="scarf">목도리</button>` +
    '</div><div class="grid">';

  list.forEach(it => {
    const own = P.inventory.items.includes(it.id);
    const can = P.wallet.grass >= it.price;
    const mini = charSVG(active(), shopTab === 'hat' ? { ...worn(), hat: it.id } : { ...worn(), neck: it.id }, 'happy');
    html += `<div class="item ${own ? '' : can ? '' : 'locked'}" data-buy="${it.id}">${mini}<div class="nm">${it.nm}</div>` +
      (own ? '<div class="st">가지고 있어</div>' : `<div class="pr ${can ? '' : 'cant'}">${GRASS_ICON} ${it.price}</div>`) +
    '</div>';
  });
  app.innerHTML = html + '</div>';

  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; renderShop(); bind(); });
  app.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(b.dataset.buy));
}

function buy(id) {
  const it = itemById(id);
  if (P.inventory.items.includes(id)) return go('closet');
  if (P.wallet.grass < it.price) return toast(`풀이 ${it.price - P.wallet.grass}개 더 필요해`);

  P.wallet.grass -= it.price;
  P.inventory.items.push(id);
  worn()[isHat(id) ? 'hat' : 'neck'] = id;
  save();
  toast(say('새아이템') || `${it.nm} 샀어!`);
  renderShop();
  bind();
}

/* ============ 옷장 ============ */

function renderFriends() {
  app.innerHTML = topbar(true) +
    '<div class="card stage">' + me('happy', 'pop') +
    `<h2 class="sheepname">${esc(charName())}</h2>` +
    '<p class="sub">누르면 같이 다닐 친구를 바꿀 수 있어</p></div>' +
    friendGrid();

  app.querySelectorAll('[data-pickchar]').forEach(b => b.onclick = () => pickChar(b.dataset.pickchar));
}

function renderCloset() {
  app.innerHTML = topbar(true) +
    '<div class="card stage">' + me('happy', 'pop') +
    `<h2 class="sheepname">${esc(charName())}</h2>` +
    '<button class="btn soft mt" id="rename">이름 바꾸기</button></div>' +
    wearGrid();

  app.querySelector('#rename').onclick = renameChar;
  app.querySelectorAll('[data-wear]').forEach(b => b.onclick = () => {
    const id = b.dataset.wear;
    const slot = isHat(id) ? 'hat' : 'neck';
    worn()[slot] = worn()[slot] === id ? null : id;
    save();
    render();
  });
}

function wearGrid() {
  const owned = P.inventory.items;
  if (!owned.length) {
    return '<p class="sub center mt2">아직 가진 게 없어. 가게에서 사보자!</p>' +
      '<button class="btn sun mt" data-go="shop">가게로 가기</button>';
  }
  let html = '<div class="grid">';
  HATS.concat(SCARVES).forEach(it => {
    if (!owned.includes(it.id)) return;
    const hat = isHat(it.id);
    const on = hat ? worn().hat === it.id : worn().neck === it.id;
    const mini = charSVG(active(), hat ? { ...worn(), hat: it.id } : { ...worn(), neck: it.id }, 'happy');
    html += `<div class="item ${on ? 'worn' : ''}" data-wear="${it.id}">${mini}` +
      `<div class="nm">${it.nm}</div><div class="st">${on ? '입고 있어' : '입히기'}</div></div>`;
  });
  return html + '</div>';
}

function friendGrid() {
  let html = '<div class="grid">';
  CHARACTERS.forEach(c => {
    const have = P.characters.unlocked.includes(c.id);
    const now = c.id === active();
    const can = P.wallet.star >= c.star;
    html += `<div class="item ${now ? 'worn' : ''} ${have || can ? '' : 'locked'}" data-pickchar="${c.id}">` +
      charSVG(c.id, have ? worn(c.id) : {}, 'happy') +
      `<div class="nm">${esc(P.characters.names[c.id] || c.nm)}</div>` +
      (have ? `<div class="st">${now ? '같이 있어' : '바꾸기'}</div>`
            : `<div class="pr ${can ? '' : 'cant'}">${STAR_ICON} ${c.star}</div>`) +
    '</div>';
  });
  return html + '</div>' +
    '<p class="sub center mt2">별은 문제를 완전히 외울 때마다 하나씩 생겨.</p>';
}

function pickChar(id) {
  const c = charById(id);
  if (P.characters.unlocked.includes(id)) {
    P.characters.active = id;
    save();
    return render();
  }
  if (P.wallet.star < c.star) return toast(`별이 ${c.star - P.wallet.star}개 더 필요해`);

  P.wallet.star -= c.star;
  P.characters.unlocked.push(id);
  P.characters.active = id;
  worn(id);
  save();
  view = 'friends';
  render();
  toast(`${c.nm}가 목장에 왔어!`);
}

function renameChar() {
  app.innerHTML = topbar(true) +
    '<div class="card stage mt2">' + me('happy', 'pop') +
    '<h2 class="sheepname">뭐라고 부를까?</h2>' +
    `<div class="mt"><input type="text" id="nm" maxlength="8" value="${esc(P.characters.names[active()] || '')}" autocomplete="off"></div>` +
    '<button class="btn go mt" id="ok">이걸로 할래</button></div>';

  app.querySelector('#ok').onclick = () => {
    const v = app.querySelector('#nm').value.trim();
    if (!v) return toast('이름을 적어줘');
    P.characters.names[active()] = v.slice(0, 8);
    save();
    render();
  };
  bind();
}

start();
