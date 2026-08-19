/* 부모 화면 5A — 현황 패널과 문제 패널.
 *
 * parent.html 에 컨테이너 두 개와 script 태그 하나만 추가하면 됩니다.
 * 자세한 것은 5A-적용안내.md.
 *
 *   import { init } from './parent-5a.js';
 *   init({ pin: () => document.querySelector('#pin').value });
 *
 * 스타일은 p5a- 로 시작하는 클래스만 씁니다. parent.html 의 기존 CSS 와
 * 부딪히지 않게 하려는 것이고, 색은 되도록 상속받습니다.
 */

const MIN_POOL = 8;   // engine.js 와 같은 값
const MIN_GROUP = 4;  // 같은 묶음에 이만큼 있어야 글자 오답을 뽑습니다

let getPin = () => '';
let cache = null;      // 마지막 summary
let editing = null;    // { id, rows, packEnabled, dirty }

/* ------------------------------------------------------------------ 유틸 */

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

async function call(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Parent-Pin': getPin(), ...(opts.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) throw new Error('PIN이 맞지 않습니다.');
  if (!res.ok) throw new Error('불러오지 못했습니다 (' + res.status + ')');
  return res.json();
}

function fail(host, err, retry) {
  host.textContent = '';
  const box = el('div', 'p5a-empty');
  box.appendChild(el('p', null, err.message || String(err)));
  if (retry) {
    const b = el('button', 'p5a-btn', '다시 불러오기');
    b.onclick = retry;
    box.appendChild(b);
  }
  host.appendChild(box);
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/* ------------------------------------------------------------ 현황 패널 */

function progressBar(done, goal) {
  const wrap = el('div', 'p5a-bar');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', goal + '문제 중 ' + done + '문제');
  const fill = el('div', 'p5a-bar-fill');
  fill.style.width = Math.min(100, goal ? (done / goal) * 100 : 0) + '%';
  wrap.appendChild(fill);
  return wrap;
}

function weekStrip(rows) {
  const strip = el('div', 'p5a-week');
  rows.forEach((r) => {
    const d = new Date(r.day + 'T00:00:00');
    const cell = el('div', 'p5a-day' + (r.solved == null ? ' p5a-day-off' : ''));
    cell.appendChild(el('span', 'p5a-day-name', WEEKDAY[d.getDay()]));
    cell.appendChild(el('span', 'p5a-day-n', r.solved == null ? '–' : String(r.solved)));
    cell.title = r.day + (r.solved == null ? ' · 안 함' : ' · ' + r.solved + '문제');
    strip.appendChild(cell);
  });
  return strip;
}

function stockBox(stock) {
  if (stock.level === 'ok') return null;
  const box = el('div', 'p5a-note p5a-' + stock.level);
  if (stock.remaining === 0) {
    box.appendChild(el('p', null, '아이가 아직 안 배운 문제가 없습니다. 새 문제를 넣지 않으면 별이 더 이상 늘지 않습니다.'));
  } else {
    box.appendChild(el('p', null,
      '아직 안 배운 문제가 ' + stock.remaining + '개 남았습니다. 지금 속도면 ' +
      stock.daysLeft + '일 뒤에 소진됩니다.'));
  }
  box.appendChild(el('p', 'p5a-sub', 'content/problems 폴더에 파일을 추가하세요.'));
  return box;
}

function chips(recent) {
  const wrap = el('span', 'p5a-chips');
  recent.slice(0, 8).forEach((c) => {
    const label = c === 'x' ? '틀림' : c === 'h' ? '힌트 쓰고 맞힘' : '혼자 맞힘';
    const chip = el('span', 'p5a-chip p5a-chip-' + c, c === 'x' ? '×' : c === 'h' ? 'h' : '○');
    chip.title = label;
    wrap.appendChild(chip);
  });
  return wrap;
}

function weakTable(weak) {
  if (!weak.length) {
    const box = el('div', 'p5a-empty');
    box.appendChild(el('p', null, '최근 7일 동안 눈에 띄게 어려워한 문제가 없습니다.'));
    return box;
  }
  const t = el('table', 'p5a-table');
  const head = el('tr');
  ['문제', '답', '최근 7일', '할 것'].forEach((h) => head.appendChild(el('th', null, h)));
  t.appendChild(head);
  weak.forEach((w) => {
    const tr = el('tr');
    tr.appendChild(el('td', 'p5a-q', w.text));
    tr.appendChild(el('td', 'p5a-a', String(w.answer)));
    const td = el('td');
    td.appendChild(chips(w.recent));
    tr.appendChild(td);
    tr.appendChild(el('td', 'p5a-do', w.action));
    t.appendChild(tr);
  });
  return t;
}

function renderSummary(host, data) {
  host.textContent = '';
  cache = data;

  const warn = el('p', 'p5a-rule',
    '이 목록을 아이에게 직접 묻지 마세요. 약한 문제는 게임이 알아서 다시 냅니다.');
  host.appendChild(warn);

  data.profiles.forEach((p) => {
    const card = el('section', 'p5a-card');
    card.appendChild(el('h3', null, p.displayName));

    const today = el('div', 'p5a-today');
    today.appendChild(el('span', 'p5a-big', p.today.solved + ' / ' + p.today.goal));
    today.appendChild(el('span', 'p5a-sub', '오늘'));
    card.appendChild(today);
    card.appendChild(progressBar(p.today.solved, p.today.goal));

    card.appendChild(el('p', 'p5a-wallet',
      '🌿 ' + (p.wallet.grass ?? 0) + '   ⭐ ' + (p.wallet.star ?? 0)));

    card.appendChild(el('h4', null, '최근 7일'));
    card.appendChild(weekStrip(p.week.rows));
    const w = p.week.totals;
    card.appendChild(el('p', 'p5a-sub',
      '논 날 ' + w.days + '일 · 푼 문제 ' + w.solved + ' · 혼자 맞힘 ' + w.right +
      ' · 별 ' + w.star));

    const t = p.totals || {};
    card.appendChild(el('p', 'p5a-sub',
      '누적 ' + (t.daysPlayed ?? 0) + '일 · ' + (t.solved ?? 0) + '문제 · 마스터 ' +
      (t.mastered ?? 0) + '개'));

    const stock = stockBox(p.stock);
    if (stock) card.appendChild(stock);

    card.appendChild(el('h4', null, '최근 7일 동안 어려워한 문제'));
    card.appendChild(weakTable(p.weak));

    host.appendChild(card);
  });
}

/* ------------------------------------------------------------ 문제 패널 */

function health(rows, packEnabled) {
  const active = rows.filter((r) => r.enabled);
  const groups = {};
  active.forEach((r) => { if (r.group) groups[r.group] = (groups[r.group] || 0) + 1; });
  const thin = Object.keys(groups).filter((g) => groups[g] < MIN_GROUP).sort();

  if (!packEnabled) return { level: 'off', message: '이 팩 전체가 꺼져 있습니다.', active: active.length };
  if (active.length < MIN_GROUP) {
    return { level: 'bad', active: active.length,
      message: '남은 문제가 ' + active.length + '개라 이 팩은 게임에 나오지 않습니다.' };
  }
  if (active.length < MIN_POOL) {
    return { level: 'warn', active: active.length,
      message: '남은 문제가 ' + active.length + '개라 같은 문제가 자주 반복될 수 있습니다.' };
  }
  if (thin.length) {
    return { level: 'warn', active: active.length,
      message: '묶음 ‘' + thin.join(', ') + '’에 ' + MIN_GROUP +
        '개 미만이 남아 글자 문제가 빠질 수 있습니다.' };
  }
  return { level: 'ok', active: active.length, message: '' };
}

function dots(m) {
  const wrap = el('span', 'p5a-dots');
  wrap.title = '진도 ' + m + ' / 4';
  for (let i = 0; i < 4; i += 1) wrap.appendChild(el('span', i < m ? 'p5a-dot-on' : 'p5a-dot'));
  return wrap;
}

function renderPackEditor(host, data) {
  host.textContent = '';
  editing = { id: data.id, rows: data.problems.map((r) => ({ ...r })),
    packEnabled: data.packEnabled, dirty: false };

  const head = el('div', 'p5a-head');
  head.appendChild(el('h3', null, data.name));
  const count = el('span', 'p5a-sub');
  head.appendChild(count);
  host.appendChild(head);

  host.appendChild(el('p', 'p5a-rule',
    '끈 문제도 지금까지 모은 별과 스티커는 그대로 남습니다. 다시 켜면 진도도 이어집니다.'));

  const bar = el('div', 'p5a-actions');
  const packToggle = el('label', 'p5a-toggle');
  const packBox = el('input');
  packBox.type = 'checkbox';
  packBox.checked = data.packEnabled;
  packToggle.appendChild(packBox);
  packToggle.appendChild(el('span', null, '이 팩을 게임에 낸다'));
  bar.appendChild(packToggle);

  const allOn = el('button', 'p5a-btn', '문제 전체 켜기');
  bar.appendChild(allOn);
  host.appendChild(bar);

  const note = el('div', 'p5a-note');
  host.appendChild(note);

  const table = el('table', 'p5a-table p5a-edit');
  const hr = el('tr');
  ['낸다', '문제', '답', '진도', '최근 7일', '할 것'].forEach((h) => hr.appendChild(el('th', null, h)));
  table.appendChild(hr);

  editing.rows.forEach((r) => {
    const tr = el('tr');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = r.enabled;
    cb.setAttribute('aria-label', r.text + ' 내기');
    cb.onchange = () => { r.enabled = cb.checked; mark(); };
    const td = el('td');
    td.appendChild(cb);
    tr.appendChild(td);
    tr.appendChild(el('td', 'p5a-q', r.text));
    tr.appendChild(el('td', 'p5a-a', String(r.answer)));
    const dtd = el('td');
    dtd.appendChild(dots(r.m || 0));
    tr.appendChild(dtd);
    const ctd = el('td');
    ctd.appendChild(chips(r.recent || []));
    tr.appendChild(ctd);
    tr.appendChild(el('td', 'p5a-do', r.action || ''));
    table.appendChild(tr);
  });
  host.appendChild(table);

  const orph = [...(data.orphans.problems || []), ...(data.orphans.packs || [])];
  if (orph.length) {
    const det = el('details', 'p5a-orphan');
    det.appendChild(el('summary', null, '지금 팩에 없는 항목 ' + orph.length + '개'));
    det.appendChild(el('p', 'p5a-sub',
      '문제 글자를 고치면 예전 항목이 남습니다. 파일을 잠깐 옮긴 것뿐이라면 그대로 두세요.'));
    const ul = el('ul');
    orph.forEach((k) => ul.appendChild(el('li', null, k)));
    det.appendChild(ul);
    const clean = el('button', 'p5a-btn', '정리하기');
    clean.onclick = async () => {
      clean.disabled = true;
      try { await call('/api/parent/prune', { method: 'POST' }); await openPack(host, data.id); }
      catch (e) { fail(host, e, () => openPack(host, data.id)); }
    };
    det.appendChild(clean);
    host.appendChild(det);
  }

  const foot = el('div', 'p5a-actions p5a-foot');
  const save = el('button', 'p5a-btn p5a-primary', '저장');
  save.disabled = true;
  foot.appendChild(save);
  const state = el('span', 'p5a-sub');
  foot.appendChild(state);
  host.appendChild(foot);

  function mark() {
    editing.dirty = true;
    save.disabled = false;
    state.textContent = '저장하지 않은 변경이 있습니다';
    paint();
  }

  function paint() {
    const h = health(editing.rows, editing.packEnabled);
    count.textContent = '사용 ' + h.active + ' / 전체 ' + editing.rows.length;
    note.className = 'p5a-note' + (h.message ? ' p5a-' + h.level : '');
    note.textContent = h.message;
  }

  packBox.onchange = () => { editing.packEnabled = packBox.checked; mark(); };
  allOn.onclick = () => {
    editing.rows.forEach((r) => { r.enabled = true; });
    table.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = true; });
    mark();
  };

  save.onclick = async () => {
    save.disabled = true;
    state.textContent = '저장 중…';
    try {
      const cur = await call('/api/parent/disabled');
      const mine = new Set(editing.rows.map((r) => r.key));
      const problems = (cur.problems || []).filter((k) => !mine.has(k))
        .concat(editing.rows.filter((r) => !r.enabled).map((r) => r.key));
      const packs = new Set(cur.packs || []);
      if (editing.packEnabled) packs.delete(editing.id); else packs.add(editing.id);
      await call('/api/parent/disabled', {
        method: 'PUT',
        body: JSON.stringify({ problems, packs: [...packs] }),
      });
      editing.dirty = false;
      state.textContent = '저장했습니다. 아이패드에서 새로고침하면 반영됩니다.';
    } catch (e) {
      save.disabled = false;
      state.textContent = e.message;
    }
  };

  paint();
}

async function openPack(host, id) {
  host.textContent = '';
  host.appendChild(el('p', 'p5a-sub', '불러오는 중…'));
  try {
    renderPackEditor(host, await call('/api/parent/pack/' + encodeURIComponent(id)));
  } catch (e) {
    fail(host, e, () => openPack(host, id));
  }
}

function renderPackList(host, packs) {
  host.textContent = '';
  const list = el('div', 'p5a-packs');
  const detail = el('div', 'p5a-detail');

  packs.forEach((p) => {
    const b = el('button', 'p5a-pack' + (p.enabled ? '' : ' p5a-pack-off'));
    b.appendChild(el('span', 'p5a-pack-name', p.name));
    b.appendChild(el('span', 'p5a-sub', '사용 ' + p.active + ' / ' + p.total));
    if (p.level === 'warn' || p.level === 'bad') b.appendChild(el('span', 'p5a-flag p5a-' + p.level, '!'));
    b.onclick = () => {
      if (editing && editing.dirty && !confirm('저장하지 않은 변경이 있습니다. 그대로 넘어갈까요?')) return;
      list.querySelectorAll('.p5a-pack').forEach((x) => x.classList.remove('p5a-on'));
      b.classList.add('p5a-on');
      openPack(detail, p.id);
    };
    list.appendChild(b);
  });

  host.appendChild(list);
  host.appendChild(detail);
  detail.appendChild(el('p', 'p5a-sub', '위에서 팩을 고르면 문제를 켜고 끌 수 있습니다.'));
}

/* ------------------------------------------------------------------ 진입 */

const CSS = `
.p5a-card{margin:0 0 24px;padding:16px;border:1px solid rgba(0,0,0,.12);border-radius:12px}
.p5a-rule{margin:0 0 12px;padding:8px 12px;border-left:3px solid currentColor;opacity:.75;font-size:.9em}
.p5a-big{font-size:1.8em;font-weight:700;margin-right:8px}
.p5a-sub{opacity:.65;font-size:.88em}
.p5a-today{display:flex;align-items:baseline;gap:4px;margin:8px 0}
.p5a-bar{height:10px;border-radius:6px;background:rgba(0,0,0,.1);overflow:hidden}
.p5a-bar-fill{height:100%;background:currentColor;opacity:.55;transition:width .3s}
.p5a-wallet{margin:10px 0}
.p5a-week{display:flex;gap:6px;margin:8px 0}
.p5a-day{flex:1;text-align:center;padding:8px 2px;border-radius:8px;background:rgba(0,0,0,.05)}
.p5a-day-off{opacity:.35}
.p5a-day-name{display:block;font-size:.78em;opacity:.7}
.p5a-day-n{display:block;font-weight:700}
.p5a-note{margin:12px 0}
.p5a-note.p5a-warn,.p5a-note.p5a-bad,.p5a-note.p5a-off{padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.06)}
.p5a-note.p5a-bad{outline:1px solid rgba(180,60,60,.5)}
.p5a-note p{margin:2px 0}
.p5a-table{width:100%;border-collapse:collapse;font-size:.94em}
.p5a-table th{text-align:left;font-weight:600;opacity:.6;font-size:.85em;padding:6px 8px}
.p5a-table td{padding:6px 8px;border-top:1px solid rgba(0,0,0,.08);vertical-align:middle}
.p5a-q{font-weight:600}
.p5a-a{opacity:.7}
.p5a-do{font-size:.88em;opacity:.75}
.p5a-chips{display:inline-flex;gap:3px}
.p5a-chip{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
  border-radius:4px;font-size:.72em;background:rgba(0,0,0,.08)}
.p5a-chip-x{background:rgba(70,110,190,.22)}
.p5a-chip-h{background:rgba(0,0,0,.14)}
.p5a-dots{display:inline-flex;gap:3px}
.p5a-dot,.p5a-dot-on{width:8px;height:8px;border-radius:50%;background:currentColor}
.p5a-dot{opacity:.18}
.p5a-dot-on{opacity:.6}
.p5a-packs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.p5a-pack{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 14px;
  border:1px solid rgba(0,0,0,.15);border-radius:10px;background:none;cursor:pointer;font:inherit;text-align:left}
.p5a-pack-name{font-weight:600}
.p5a-pack-off{opacity:.45}
.p5a-pack.p5a-on{outline:2px solid currentColor}
.p5a-flag{font-weight:700}
.p5a-head{display:flex;align-items:baseline;gap:10px}
.p5a-actions{display:flex;align-items:center;gap:12px;margin:12px 0}
.p5a-foot{position:sticky;bottom:0;padding:10px 0;background:inherit}
.p5a-toggle{display:inline-flex;align-items:center;gap:6px}
.p5a-btn{padding:8px 14px;border:1px solid rgba(0,0,0,.2);border-radius:8px;background:none;
  cursor:pointer;font:inherit}
.p5a-btn:disabled{opacity:.4;cursor:default}
.p5a-primary{font-weight:600}
.p5a-orphan{margin:16px 0;opacity:.8}
.p5a-orphan li{font-family:ui-monospace,monospace;font-size:.85em}
.p5a-empty{padding:16px;opacity:.7}
.p5a-table input[type=checkbox]{width:20px;height:20px}
:where(.p5a-btn,.p5a-pack,.p5a-table input):focus-visible{outline:2px solid currentColor;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.p5a-bar-fill{transition:none}}
`;

export function init(opts = {}) {
  if (typeof opts.pin === 'function') getPin = opts.pin;
  else if (typeof opts.pin === 'string') getPin = () => opts.pin;

  if (!document.getElementById('p5a-css')) {
    const style = el('style');
    style.id = 'p5a-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  window.addEventListener('beforeunload', (e) => {
    if (editing && editing.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  return refresh();
}

export async function refresh() {
  const sHost = document.getElementById('p5a-summary');
  const pHost = document.getElementById('p5a-packs');
  if (sHost) sHost.textContent = '불러오는 중…';
  try {
    const data = await call('/api/parent/summary');
    if (sHost) renderSummary(sHost, data);
    if (pHost) renderPackList(pHost, data.packs || []);
  } catch (e) {
    if (sHost) fail(sHost, e, refresh);
    if (pHost) fail(pHost, e, refresh);
  }
}
