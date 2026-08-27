import { ALL_ITEMS, CHARACTERS, GRASS_ICON, ITEMS, STAR_ICON, charById, charSVG, itemById, slotOf, tierOf } from './characters.js';
import { BACKGROUNDS, bgById, decoSVG, lookOf } from './backgrounds.js';
import * as store from './store.js';
import { TARGETS, factKey, buildIndex, packList, pruneLogs, seedFacts, makeQuestion, applyResult } from './engine.js';

const BASE_REWARD = 3;    // 풀어보기만 해도
const BONUS_REWARD = 3;   // 맞추면 조금 더
const BOARD_SIZE = 12;    // 도감 한 판
const BOARD_STAR = 3;     // 한 판을 다 채우면
const PENDING = 'gugudan-pending';
const LAST_ID = 'gugudan-last-profile';

const app = document.getElementById('app');
let P = null;             // 프로필
let INDEX = {};           // 문제 전체 (내장 구구단 + 부모 팩) — 부모가 끈 것은 빠져 있다
let PACKS = [];           // 서버에서 받은 팩 원본. 프로필마다 제외 목록이 달라 다시 짓는다
let MESSAGES = {};        // content/messages.csv
let WISHES = [];          // content/wishes.csv — 파일이 없으면 소원권 기능이 안 나타난다
let ALLOW = null;         // 용돈 설정 (data/settings.json). 부모가 켜야 나타난다
const recent = [];        // 최근 쓴 응원 5개 — 바로 반복되면 금방 질린다
/* 최근 낸 문제 — 여기 있는 것은 다시 안 낸다.
   3이었는데 12로 늘렸습니다 (2026-08-24). 3이면 다섯 문제 만에 같은 게 돌아옵니다.
   12면 최소 간격이 13문제라, 한 판(20문제) 안에서는 거의 안 겹칩니다. */
const RECENT_KEYS = 12;
const recentKeys = [];
let view = 'home', quiz = null, shopTab = 'hat', askedAt = 0, sinceSave = 0;
let pick = null;          // 자유 모드 — null(전부) / {pack} / {subject}
let pickSubject = null;   // 과목을 고른 뒤 단원 화면에 머무는 동안

const today = () => new Date().toLocaleDateString('sv-SE');   // 2026-08-16
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
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
  try {
    await store.saveProfile(P);
    localStorage.removeItem(PENDING);
  } catch {
    localStorage.setItem(PENDING, JSON.stringify(P));   // Wi-Fi가 끊겨도 진행이 날아가면 안 된다
  }
}

function saveSoon() {
  if (++sinceSave >= 5) save();
}

/* 같은 브라우저의 다른 탭(부모 화면)이 저장하면 브라우저가 알려준다.
   정적 배포에서는 부모 화면이 늘 같은 브라우저에 있으므로, 새로고침 없이 바로 반영된다.
   **문제를 푸는 중에는 화면을 갈아엎지 않는다** — 답을 고르려던 손이 헛돈다.
   지금 문제만 끝나면 홈으로 돌아갈 때 반영된다. */
addEventListener('storage', e => {
  if (!P || !e.key || !e.key.endsWith(P.id)) return;
  const stored = store.readStored(P.id);
  if (!stored) return;

  const before = JSON.stringify([P.progress, P.disabled, P.gifts]);
  P.progress = stored.progress;
  P.disabled = stored.disabled;
  P.gifts = stored.gifts;
  if (stored.settings?.goal) { P.settings.goal = stored.settings.goal; P.daily.goal = stored.settings.goal; }
  if (JSON.stringify([P.progress, P.disabled, P.gifts]) === before) return;

  INDEX = buildIndex(PACKS, P.disabled, P.progress);
  seedFacts(INDEX, P.facts);
  catchUpUnits();
  const gift = takeGift();
  save();
  if (gift) toast(gift);
  if (view !== 'quiz') render();   // 문제 푸는 중이면 건드리지 않는다
});

addEventListener('pagehide', () => { if (P) store.saveOnExit(P); });
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
  P = await store.loadProfile(id);
  localStorage.setItem(LAST_ID, id);
  P.disabled ||= { problems: [], packs: [] };
  P.progress ||= {};                                         // 과목마다 여기까지 열림 (기획서 16.3)
  P.seenPacks ||= [];                                        // 새 단원 알림용
  P.settings ||= { goal: 20, reduceMotion: false };          // v1에서 옮겨온 프로필 대비
  P.collection ||= { stickers: [], boardsCompleted: 0 };
  P.inventory.backgrounds ||= ['day'];
  P.inventory.activeBackground ||= 'day';
  P.wishes ||= [];                                           // 받은 소원권. 지우지 않는다
  P.allowance ||= [];                                        // 바꾼 용돈 기록. 지우지 않는다
  P.gifts ||= [];                                            // 엄마 아빠가 직접 준 풀·별 (부모 몫)
  P.appliedGifts ||= [];                                     // 그중 지갑에 더한 것 (아이 몫)
  INDEX = buildIndex(PACKS, P.disabled, P.progress);   // 부모가 끈 것과 아직 안 연 단원이 여기서 빠진다
  seedFacts(INDEX, P.facts);
  rollDay();
  const owed = catchUpBoards();   // 도감 보상은 5B에서 생겼다 — 그 전에 모은 것도 준다
  catchUpTier();
  catchUpUnits();
  const gift = takeGift();
  await save();
  go('home');
  if (gift) toast(gift);
  else if (owed) toast(`도감을 다 채운 판이 있었어! 별 ${owed}개`);
}

async function start() {
  const pending = localStorage.getItem(PENDING);
  if (pending) {
    try {
      await store.saveProfile(JSON.parse(pending));
      localStorage.removeItem(PENDING);
    } catch { /* 다음에 다시 밀어 올린다 */ }
  }

  const boot = await store.bootstrap();
  const { profiles, packs, messages, wishes } = boot;
  MESSAGES = messages || {};
  WISHES = wishes || [];
  ALLOW = boot.settings?.allowance || null;
  const loaded = await Promise.all((packs || []).map(p => store.loadPack(p.id)));
  PACKS = loaded.filter(Boolean);
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
    const made = await store.createProfile(id);
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
  applyBG();
  if (!P.characters.names.sheep) renderNaming();
  else if (view === 'pick') renderPick();
  else if (view === 'friends') renderFriends();
  else if (view === 'quiz') renderQuiz();
  else if (view === 'shop') renderShop();
  else if (view === 'closet') renderCloset();
  else if (view === 'book') renderCollection();
  else if (view === 'wish') renderWishes();
  else if (view === 'money') renderAllowance();
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

/* 홈 화면에 추가하면 아이패드가 앱처럼 열고, **사파리가 저장한 기록을 안 지웁니다.**
   iOS는 설치 버튼을 띄울 방법이 없어서 방법을 글로 알려주는 수밖에 없습니다.
   아이에게는 이유를 말하지 않습니다 — 데이터가 날아갈 수 있다는 건 부모가 알 일입니다. */
const HOME_HINT = 'gugudan-homehint';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const installed = () => navigator.standalone ||
  (matchMedia && matchMedia('(display-mode: standalone)').matches);

function homeHint() {
  if (installed() || !isIOS() || localStorage.getItem(HOME_HINT)) return '';
  return '<div class="hint2 mt2"><p>홈 화면에 넣어두면 앱처럼 바로 열려.<br>' +
    '위쪽 <b>공유 버튼</b>을 누르고 <b>홈 화면에 추가</b>를 고르면 돼.</p>' +
    '<button id="hinthide">알겠어</button></div>';
}

/* ============ 홈 ============ */

function renderHome() {
  const done = P.daily.solved, pct = Math.min(100, done / goal() * 100);
  const finished = done >= goal();
  /* 부모가 난이도를 '심화'로 두면 구구단이 색인에서 빠진다. 그러면 이 fact들도 없다 —
     새로 시작한 아이는 `.m`을 읽는 순간 홈 화면이 통째로 안 그려진다. */
  const learned = TARGETS.filter(f => (P.facts[factKey(f[0], f[1])]?.m ?? 0) >= 3).length;
  const guguOn = TARGETS.some(f => factKey(f[0], f[1]) in INDEX);
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
    (P.settings.newUnits?.length
      ? `<button class="btn sun mt" id="newunit">새로운 문제가 왔어! ${esc(P.settings.newUnits[0])}</button>` : '') +
    (P.settings.newTier ? '<button class="btn sun mt" data-go="shop">가게에 새로운 게 들어왔어!</button>' : '') +
    (nextFriend() && P.wallet.star >= nextFriend().star
      ? `<button class="btn sun mt" data-go="friends">${nextFriend().nm}가 기다리고 있어</button>` : '') +
    '<div class="btnrow">' +
      '<button class="btn soft" data-go="shop">가게</button>' +
      '<button class="btn soft" data-go="closet">옷장</button>' +
    '</div>' +
    '<div class="btnrow">' +
      '<button class="btn soft" data-go="friends">친구들</button>' +
      '<button class="btn soft" data-go="book">도감</button>' +
    '</div>' +
    (WISHES.length ? '<button class="btn soft mt" data-go="wish">소원권</button>' : '') +
    (allowanceDay() ? '<button class="btn sun mt" data-go="money">오늘 용돈 바꾸는 날!</button>' : '') +
    `<p class="sub center mt2">${guguOn ? `구구단 ${learned} / ${TARGETS.length}${extra} &nbsp;·&nbsp; ` : ''}함께한 날 ${P.totals.daysPlayed}일</p>` +
    homeHint();

  const hide = app.querySelector('#hinthide');
  if (hide) hide.onclick = () => { localStorage.setItem(HOME_HINT, '1'); render(); };

  const play = () => { pickSubject = null; packList(INDEX).length > 1 ? go('pick') : startQuiz(); };
  app.querySelector('#play').onclick = play;
  const nu = app.querySelector('#newunit');
  if (nu) nu.onclick = play;
}

/* ============ 무엇을 풀까 (자유 모드) ============ */

/* 열린 것만 보인다. 아직 안 배운 단원을 회색으로 보여주지 않는다 —
   목장의 다음 친구는 아이가 별을 모아 여는 것이지만, 단원은 학교가 여는 것이라
   눈앞에 두면 목표가 아니라 압박이 된다 (기획서 16.5). */
function renderPick() {
  P.settings.newUnits = [];   // 여기까지 왔으면 알림은 지운다

  const packs = packList(INDEX);
  const subjects = [...new Set(packs.map(p => p.subject).filter(Boolean))];
  const head = (title, sub) =>
    '<div class="card stage">' + me('happy', 'pop') +
      `<h1 class="sheepname">${esc(title)}</h1><p class="sub">${esc(sub)}</p></div>`;

  // 2단계 — 과목 안에서 단원 고르기
  if (pickSubject) {
    const units = packs.filter(p => p.subject === pickSubject);
    app.innerHTML = topbar(true) + head(pickSubject, '단원을 골라도 되고, 다 섞어도 돼') +
      `<button class="btn go mt2" data-sub="${esc(pickSubject)}">${esc(pickSubject)} 다 섞어서</button>` +
      units.map(p => `<button class="btn soft mt" data-pack="${esc(p.id)}">${esc(p.name)}</button>`).join('') +
      '<button class="btn soft mt2" id="othersub">다른 것 고르기</button>';
    app.querySelector('#othersub').onclick = () => { pickSubject = null; renderPick(); bind(); };
  } else {
    // 1단계 — 과목이 있으면 과목부터. 과목 없는 팩은 그대로 나열한다
    const loose = packs.filter(p => !p.subject);
    app.innerHTML = topbar(true) + head('무엇을 풀까?', '골라도 되고, 다 섞어도 돼') +
      '<button class="btn go mt2" data-pack="">다 섞어서</button>' +
      subjects.map(s => `<button class="btn soft mt" data-into="${esc(s)}">${esc(s)}</button>`).join('') +
      loose.map(p => `<button class="btn soft mt" data-pack="${esc(p.id)}">${esc(p.name)}</button>`).join('');
  }

  app.querySelectorAll('[data-into]').forEach(b => b.onclick = () => {
    pickSubject = b.dataset.into;
    renderPick();
    bind();
  });
  app.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => {
    pick = { subject: b.dataset.sub };
    startQuiz();
  });
  app.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => {
    pick = b.dataset.pack ? { pack: b.dataset.pack } : null;
    startQuiz();
  });
}

/* ============ 퀴즈 ============ */

function startQuiz() { P.settings.newUnits = []; nextQ(); go('quiz'); }

function nextQ() {
  quiz = makeQuestion(INDEX, P.facts, recentKeys, today(), pick);
  recentKeys.push(quiz.key);
  if (recentKeys.length > RECENT_KEYS) recentKeys.shift();
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
    const board = catchUpBoards();
    const tier = catchUpTier();
    // 토스트는 하나만 띄운다 — 더 큰 소식이 이긴다
    setTimeout(() => toast(tier ? '가게에 새로운 게 들어왔어!'
                                : board ? `도감 한 판을 다 채웠어! 별 ${board}개`
                                : (say('마스터') || '이건 이제 완전히 외웠어!')), 400);
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

/* 부모가 진도를 올리면 아이에게는 사건이 된다 (기획서 16.6).
   처음 들어온 아이에게는 알리지 않는다 — 그건 새로 열린 게 아니라 원래 있던 것이다. */
function catchUpUnits() {
  const now = [...new Set(Object.values(INDEX).map(e => e.packId))];
  if (!P.seenPacks.length) { P.seenPacks = now; return; }

  const fresh = now.filter(id => !P.seenPacks.includes(id));
  if (!fresh.length) return;

  P.seenPacks = now;
  const nameOf = id => Object.values(INDEX).find(e => e.packId === id)?.packName || '';
  P.settings.newUnits = fresh.map(nameOf).filter(Boolean);   // 무엇을 풀까 화면에서 지운다
}

/* ============ 배경 ============ */

/* 배경은 CSS 변수 세 개만 바꾼다. 카드는 늘 흰색이라 카드 안 글자색은 건드리지 않는다.
   무료 배경은 계절·시간에 따라 저절로 바뀌므로 화면을 그릴 때마다 다시 계산한다. */
function applyBG() {
  const look = lookOf(P.inventory.activeBackground || 'day');
  const root = document.documentElement.style;
  root.setProperty('--meadow', look.sky);
  root.setProperty('--meadow-deep', look.deep);
  root.setProperty('--onpage', look.onpage);

  let layer = document.getElementById('sky');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'sky';
    layer.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(layer, document.body.firstChild);
  }
  const deco = decoSVG(look.deco);
  layer.innerHTML = deco ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${deco}</svg>` : '';
}

function bgGrid() {
  let html = '<div class="grid">';
  BACKGROUNDS.forEach(b => {
    const own = P.inventory.backgrounds.includes(b.id);
    const on = P.inventory.activeBackground === b.id;
    const can = P.wallet.star >= b.star;
    const look = lookOf(b.id);
    html += `<div class="item ${on ? 'worn' : ''} ${own || can ? '' : 'locked'}" data-bg="${b.id}">` +
      `<div class="swatch" style="background:linear-gradient(180deg,${look.sky},${look.deep})">` +
        (look.deco ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${decoSVG(look.deco)}</svg>` : '') +
      '</div>' +
      `<div class="nm">${esc(b.nm)}</div>` +
      (b.auto ? '<div class="st">계절 따라 바뀌어</div>'
       : own ? `<div class="st">${on ? '지금 이거야' : '이걸로 바꾸기'}</div>`
       : `<div class="pr ${can ? '' : 'cant'}">${STAR_ICON} ${b.star}</div>`) +
    '</div>';
  });
  return html + '</div>';
}

function pickBG(id) {
  const b = bgById(id);
  if (!P.inventory.backgrounds.includes(id)) {
    if (P.wallet.star < b.star) return toast(`별이 ${b.star - P.wallet.star}개 더 필요해`);
    P.wallet.star -= b.star;
    P.inventory.backgrounds.push(id);
    toast(say('새아이템') || `${b.nm} 배경을 얻었어!`);
  }
  P.inventory.activeBackground = id;
  save();
  renderShop();
  bind();
}

/* ============ 소원권 ============ */

/* 받은 소원권은 목록에 남는다. "썼다"고 지우지 않는다 —
   사라지는 것은 회수처럼 느껴지고, 이 게임에서 사라지는 것은 만들지 않는다 (원칙 2.1).
   부모는 이 목록을 보고 실물로 들어준다. */
function renderWishes() {
  const got = [...(P.wishes || [])].reverse();

  let html = topbar(true) +
    '<div class="card stage">' + me('happy', 'pop') +
      '<h1 class="sheepname">소원권</h1>' +
      '<p class="sub">별을 모으면 진짜 소원을 하나 빌 수 있어</p>' +
    '</div>';

  html += '<div class="wishes">' + WISHES.map(w => {
    const can = P.wallet.star >= w.star;
    const mine = got.filter(g => g.id === w.id).length;
    return `<div class="wish ${can ? '' : 'far'}" data-wish="${esc(w.id)}">` +
      `<div class="wtext"><div class="wnm">${esc(w.nm)}</div>` +
      (w.note ? `<div class="wnote">${esc(w.note)}</div>` : '') +
      (mine ? `<div class="wnote">이미 ${mine}번 받았어</div>` : '') + '</div>' +
      `<div class="wstar">${STAR_ICON}<span>${w.star}</span></div></div>`;
  }).join('') + '</div>';

  if (got.length) {
    html += '<h2 class="center mt2" style="font-size:20px;margin-bottom:2px">받은 소원권</h2>' +
      '<p class="sub center">엄마 아빠한테 보여주면 돼</p><div class="wishes mt">' +
      got.map(g => `<div class="wish done"><div class="wtext"><div class="wnm">${esc(g.nm)}</div>` +
        `<div class="wnote">${esc(g.day)}</div></div><div class="wstar">🎟️</div></div>`).join('') +
      '</div>';
  }

  app.innerHTML = html + `<p class="sub center mt2">지금 가진 별 ${P.wallet.star}개</p>`;
  app.querySelectorAll('[data-wish]').forEach(b => b.onclick = () => useWish(b.dataset.wish));
}

function useWish(id) {
  const w = WISHES.find(x => x.id === id);
  if (!w) return;
  if (P.wallet.star < w.star) return toast(`별이 ${w.star - P.wallet.star}개 더 필요해`);

  P.wallet.star -= w.star;
  P.wishes.push({ id: w.id, nm: w.nm, star: w.star, day: today() });
  save();
  renderWishes();
  bind();
  toast('소원권을 받았어! 엄마 아빠한테 보여줘');
}

/* ============ 용돈 ============ */

/* 풀 🌿로 바꾼다. 별이 아니다 —
   별은 마스터(=정답)에만 붙으므로 "틀리면 돈을 못 번다"가 된다.
   풀은 '푼 것'에 주므로 틀려도 용돈이 나온다 (원칙 2.2).

   주 1회 정해진 요일에만. 매일 환전되면 임금이 되고,
   임금이 되면 놀이가 노동이 된다 (원칙 2.5). */

const DAYNAMES = ['일', '월', '화', '수', '목', '금', '토'];

/* 오늘이 바꾸는 날인가 — 켜져 있고, 요일이 맞고, 아직 안 바꿨을 때 */
function allowanceDay() {
  if (!ALLOW?.on) return false;
  if (new Date().getDay() !== ALLOW.day) return false;
  const last = P.allowance?.[P.allowance.length - 1];
  return !last || last.day !== today();
}

/* 바꿀 수 있는 양 — 상한 안에서, 가진 풀 안에서 */
function allowanceSteps() {
  const { per, max } = ALLOW;
  return [1, 3, 5, 10]
    .map(n => n * per)
    .filter(g => g <= max && g <= P.wallet.grass);
}

function renderAllowance() {
  const got = [...(P.allowance || [])].reverse();
  const steps = allowanceSteps();
  const open = allowanceDay();

  let html = topbar(true) +
    '<div class="card stage">' + me('happy', 'pop') +
      '<h1 class="sheepname">용돈</h1>' +
      `<p class="sub">${DAYNAMES[ALLOW.day]}요일마다 풀을 용돈으로 바꿀 수 있어</p>` +
      `<p class="sub mt">지금 가진 풀 ${P.wallet.grass}개</p>` +
    '</div>';

  if (!open) {
    const why = new Date().getDay() !== ALLOW.day
      ? `${DAYNAMES[ALLOW.day]}요일에 다시 오면 돼`
      : '오늘 몫은 벌써 바꿨어. 다음 주에 또 보자!';
    html += `<p class="sub center mt2">${why}</p>`;
  } else if (!steps.length) {
    html += `<p class="sub center mt2">풀이 ${ALLOW.per}개는 있어야 바꿀 수 있어</p>`;
  } else {
    html += '<div class="wishes">' + steps.map(g =>
      `<div class="wish" data-money="${g}">` +
        `<div class="wtext"><div class="wnm">풀 ${g}개</div></div>` +
        `<div class="wstar"><span>${(g / ALLOW.per * ALLOW.won).toLocaleString()}원</span></div></div>`
    ).join('') + '</div>' +
    '<p class="sub center mt2">한 주에 한 번만 바꿀 수 있어</p>';
  }

  if (got.length) {
    html += '<h2 class="center mt2" style="font-size:20px;margin-bottom:2px">받은 용돈</h2>' +
      '<p class="sub center">엄마 아빠한테 보여주면 돼</p><div class="wishes mt">' +
      got.map(a => `<div class="wish done"><div class="wtext"><div class="wnm">${a.won.toLocaleString()}원</div>` +
        `<div class="wnote">${esc(a.day)} · 풀 ${a.grass}개</div></div><div class="wstar">🎟️</div></div>`).join('') +
      '</div>';
  }

  app.innerHTML = html;
  app.querySelectorAll('[data-money]').forEach(b => b.onclick = () => exchange(Number(b.dataset.money)));
}

function exchange(grass) {
  if (!allowanceDay()) return toast(`${DAYNAMES[ALLOW.day]}요일에 바꿀 수 있어`);
  if (grass > ALLOW.max || grass > P.wallet.grass) return;

  const won = grass / ALLOW.per * ALLOW.won;
  P.wallet.grass -= grass;
  P.allowance.push({ day: today(), grass, won });
  save();
  renderAllowance();
  bind();
  toast(`${won.toLocaleString()}원! 엄마 아빠한테 보여줘`);
}

/* ============ 도감 ============ */

/* 판 보상은 더하기만 한다. 이미 받은 것을 다시 계산해 줄이는 코드를 만들지 마세요 —
   상점 단계와 별이 같이 줄어들고, 어제까지 살 수 있던 물건이 사라집니다 (원칙 2.1). */
function catchUpBoards() {
  const done = Math.floor(P.collection.stickers.length / BOARD_SIZE);
  const due = done - (P.collection.boardsCompleted || 0);
  if (due <= 0) return 0;

  P.collection.boardsCompleted = done;
  const star = due * BOARD_STAR;
  P.wallet.star += star;
  P.daily.star = (P.daily.star || 0) + star;
  return star;
}

/* 상점 단계도 더하기만 한다. facts에서 다시 세는 코드를 만들면
   부모가 문제를 끈 날 선반이 닫히고, 어제까지 살 수 있던 물건이 사라진다 (원칙 2.1 / 구현-현황 2.9). */
/* 부모가 직접 준 풀·별.

   **지갑에 더하는 것은 부모가 아니라 여기서 한다.** 부모 화면이 지갑을 직접 고치면
   아이가 지금 풀고 있는 사이에 서로 덮어씁니다 (구현-현황 34.3). 부모는 `gifts`에
   기록만 남기고, 받았는지 여부(`appliedGifts`)는 아이 몫이라 덮일 일이 없다.

   **얼마를 받았는지는 말하되 왜 받았는지는 말하지 않는다.** 이유 칸은 부모의 메모지
   아이에게 하는 말이 아니다. "심부름을 해서 줬어" 는 보상이 조건이 되는 순간이다. */
function takeGift() {
  const done = new Set(P.appliedGifts || []);
  const fresh = (P.gifts || []).filter(g => g.id && !done.has(g.id));
  if (!fresh.length) return '';

  let grass = 0, star = 0;
  for (const g of fresh) {
    grass += g.grass || 0;
    star += g.star || 0;
    (P.appliedGifts ||= []).push(g.id);
  }
  P.wallet.grass = Math.max(0, P.wallet.grass + grass);
  P.wallet.star = Math.max(0, P.wallet.star + star);

  const bits = [];
  if (grass > 0) bits.push(`풀 ${grass}개`);
  if (star > 0) bits.push(`별 ${star}개`);
  return bits.length ? `엄마 아빠가 ${bits.join('하고 ')}를 줬어!` : '';
}

function catchUpTier() {
  const before = P.shopTier || 1;
  const now = Math.max(before, tierOf(P.totals.mastered));
  if (now === before) return 0;
  P.shopTier = now;
  P.settings.newTier = now;   // 가게에 들어가면 지운다
  return now;
}

/* 부모가 문제를 꺼도 스티커는 남는다(원칙 2.9). 그래서 색인에 없는 키도 읽을 수 있어야 한다. */
function stickerLabel(key) {
  const gugu = /^gugudan:(\d+)x(\d+)$/.exec(key);
  if (gugu) return `${gugu[1]}×${gugu[2]}`;

  const e = INDEX[key];
  const text = (e ? e.prompt : key.slice(key.indexOf(':') + 1)).replace(/\s+/g, ' ').trim();
  if (text.length <= 8) return text;
  return (e && e.answer && e.answer.length <= 8) ? e.answer : text.slice(0, 7) + '…';
}

/* 스티커 색과 기울기는 문제마다 고정 — 다시 열어도 같은 자리에 같은 스티커가 있어야 한다 */
function hashOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function boardHTML(keys, n, complete) {
  let cells = '';
  for (let i = 0; i < BOARD_SIZE; i++) {
    const key = keys[i];
    if (!key) { cells += '<div class="sticker empty"></div>'; continue; }
    const label = stickerLabel(key), h = hashOf(key);
    const size = label.length > 5 ? ' tiny' : label.length > 3 ? ' small' : '';
    cells += `<div class="sticker c${h % 6}${size}" style="--tilt:${h % 7 - 3}deg">${esc(label)}</div>`;
  }
  return `<div class="board ${complete ? 'done' : ''} mt">` +
    `<div class="bhead"><span>${n}번째 판</span>` +
    (complete ? `<span class="got">${STAR_ICON} ${BOARD_STAR}</span>`
              : `<span>${BOARD_SIZE - keys.length}칸 남았어</span>`) +
    `</div><div class="cells">${cells}</div></div>`;
}

function renderCollection() {
  const list = P.collection.stickers || [];
  const done = Math.floor(list.length / BOARD_SIZE);
  const here = list.length % BOARD_SIZE;

  let html = topbar(true) +
    '<div class="card stage">' + me('happy', 'pop') +
      '<h1 class="sheepname">도감</h1>' +
      `<p class="sub">${list.length ? '완전히 외운 것마다 스티커가 한 장씩 붙어'
                                    : '문제를 완전히 외우면 스티커가 한 장 붙어'}</p>` +
      (list.length ? '<div class="prog">' +
        `<div class="lbl"><span>이번 판</span><span>${here} / ${BOARD_SIZE}</span></div>` +
        `<div class="track"><div class="fill" style="width:${here / BOARD_SIZE * 100}%"></div></div>` +
      '</div>' : '') +
    '</div>';

  // 채우는 중인 판이 맨 위 — 매번 아래로 스크롤하지 않게
  html += boardHTML(list.slice(done * BOARD_SIZE), done + 1, false);
  for (let b = done - 1; b >= 0; b--)
    html += boardHTML(list.slice(b * BOARD_SIZE, (b + 1) * BOARD_SIZE), b + 1, true);

  app.innerHTML = html +
    `<p class="sub center mt2">한 판 ${BOARD_SIZE}칸을 채우면 별 ${BOARD_STAR}개를 받아` +
    (done ? ` &nbsp;·&nbsp; 다 채운 판 ${done}개` : '') + '</p>';
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
  P.settings.newTier = 0;   // 들어왔으면 알림은 지운다

  const tabs = Object.entries(ITEMS)
    .map(([slot, list]) => [slot, list.filter(it => buyable(it) || peekable(it))])
    .filter(([, list]) => list.length);
  tabs.push(['bg', null]);   // 배경은 별로 사므로 재고 조건이 없다
  if (!tabs.some(([slot]) => slot === shopTab)) shopTab = tabs[0][0];

  const label = { hat: '모자', neck: '목도리', prop: '소품', bg: '배경' };
  const list = tabs.find(([slot]) => slot === shopTab)[1];

  let html = topbar(true) + '<h2 class="center" style="margin:2px 0 0">가게</h2>' +
    `<p class="sub center" style="margin:2px 0 0">${shopTab === 'bg' ? '배경은 별로 살 수 있어' : '문제를 풀면 풀이 쌓여'}</p>` +
    '<div class="tabs">' +
      tabs.map(([slot]) => `<button class="tab ${slot === shopTab ? 'on' : ''}" data-tab="${slot}">${label[slot]}</button>`).join('') +
    '</div>';

  if (shopTab === 'bg') {
    app.innerHTML = html + bgGrid();
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; renderShop(); bind(); });
    app.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => pickBG(b.dataset.bg));
    return;
  }

  html += '<div class="grid">';
  list.forEach(it => {
    const own = P.inventory.items.includes(it.id);
    const can = P.wallet.grass >= it.price;
    const soon = !buyable(it);   // 다음 선반에 있는 것 — 보이지만 아직 못 산다
    // 전용은 그 친구에게 씌워서 보여준다 — 활동 캐릭터에 씌우면 못 입는 걸 입은 것처럼 보인다
    const on = it.only || active();
    const mini = charSVG(on, { ...worn(on), [slotOf(it.id)]: it.id }, 'happy');
    html += `<div class="item ${own || (can && !soon) ? '' : 'locked'}${soon ? ' soon' : ''}"` +
      `${soon ? '' : ` data-buy="${it.id}"`}>${mini}` +
      `<div class="nm">${esc(it.nm)}</div>` +
      (it.only ? `<div class="only">${esc(charName(it.only))}만</div>` : '') +
      (soon ? `<div class="st">${nextNeed()}개 더 외우면</div>`
            : own ? '<div class="st">가지고 있어</div>'
                  : `<div class="pr ${can ? '' : 'cant'}">${GRASS_ICON} ${it.price}</div>`) +
    '</div>';
  });
  app.innerHTML = html + '</div>' + nextShelf();

  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; renderShop(); bind(); });
  app.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(b.dataset.buy));
}

/* 살 수 있는 것 — 선반이 열렸고, 전용이면 그 친구를 이미 만났을 때.
   아직 못 만난 친구의 물건은 보여주지 않는다. 다음 목표는 목장의 회색 실루엣이 이미 하고 있고,
   두 곳에서 같은 일을 하면 가게가 잠긴 물건 창고가 된다 (기획서 8.7). */
const buyable = it => (it.tier || 1) <= (P.shopTier || 1) &&
                      (!it.only || P.characters.unlocked.includes(it.only));

/* 이 캐릭터가 입을 수 있는 것 */
const wearable = (it, id) => !it.only || it.only === id;

/* **다음 단계 것만** 회색으로 미리 보여준다 (부모 요청, 2026-08-24).
   전부 보여주면 가게가 잠긴 물건 창고가 된다 — 그게 5B에서 안 보이게 한 이유였다(기획서 8.7).
   한 단계만 보여주면 "조금만 더 하면 저게 열린다"가 되고, 그건 목표다.

   아직 못 만난 친구의 전용 아이템은 **여전히 안 보인다.** 그 목표는 홈 화면의
   회색 실루엣이 이미 맡고 있어서, 여기서 또 하면 같은 일을 두 곳에서 하는 것이 된다. */
const peekable = it => (it.tier || 1) === (P.shopTier || 1) + 1 &&
                       (!it.only || P.characters.unlocked.includes(it.only));

/* 다음 선반까지 몇 개 남았나 */
const nextNeed = () => Math.max(0, ([10, 25, 50, 65][(P.shopTier || 1) - 1] || 0) - P.totals.mastered);

/* 다음 선반이 언제 열리는지 — 목표가 보이면 다음에 할 일이 생긴다 (기획서 8.3) */
function nextShelf() {
  const open = P.shopTier || 1;
  if (open >= 5) return '';
  const left = [10, 25, 50, 65][open - 1] - P.totals.mastered;
  return `<p class="sub center mt2">${left > 0
    ? `${left}개를 더 완전히 외우면 새로운 게 들어와`
    : '새로운 게 곧 들어와'}</p>`;
}

function buy(id) {
  const it = itemById(id);
  if (P.inventory.items.includes(id)) return go('closet');
  if (P.wallet.grass < it.price) return toast(`풀이 ${it.price - P.wallet.grass}개 더 필요해`);

  P.wallet.grass -= it.price;
  P.inventory.items.push(id);
  worn(it.only || active())[slotOf(id)] = id;   // 전용은 주인에게 바로 입혀둔다
  save();
  toast(it.only && it.only !== active()
    ? `${charName(it.only)}한테 입혀뒀어!`
    : (say('새아이템') || `${it.nm} 샀어!`));
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
    const id = b.dataset.wear, slot = slotOf(id);
    worn()[slot] = worn()[slot] === id ? null : id;
    save();
    render();
  });
}

function wearGrid() {
  // 다른 친구 전용은 여기 안 나온다. 사라진 게 아니라 그 친구한테 가면 있다.
  const mine = ALL_ITEMS.filter(it => P.inventory.items.includes(it.id) && wearable(it, active()));
  if (!mine.length) {
    const has = P.inventory.items.length;
    return `<p class="sub center mt2">${has
      ? `${esc(charName())}가 입을 수 있는 건 아직 없어. 다른 친구한테 가보면 있을지도!`
      : '아직 가진 게 없어. 가게에서 사보자!'}</p>` +
      '<button class="btn sun mt" data-go="shop">가게로 가기</button>';
  }

  let html = '<div class="grid">';
  mine.forEach(it => {
    const slot = slotOf(it.id);
    const on = worn()[slot] === it.id;
    const mini = charSVG(active(), { ...worn(), [slot]: it.id }, 'happy');
    html += `<div class="item ${on ? 'worn' : ''}" data-wear="${it.id}">${mini}` +
      `<div class="nm">${esc(it.nm)}</div><div class="st">${on ? '입고 있어' : '입히기'}</div></div>`;
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
