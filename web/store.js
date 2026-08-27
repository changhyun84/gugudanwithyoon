/* 저장소 — 집 서버와 정적 배포(GitHub Pages) 두 곳에서 같은 코드가 돌게 한다.

   서버 모드  : 지금까지처럼 /api/* 를 부른다. 프로필은 PC의 JSON 파일에 남는다.
   정적 모드  : content.json을 읽고 프로필은 브라우저(localStorage)에 남는다.

   빌드(sim/build-static.py)가 index.html에 window.GUGUDAN_STATIC 을 심는다.
   집 서버에서 여는 web/index.html에는 그 줄이 없으므로 서버 모드가 된다.

   ⚠️ 정적 모드의 위험 — iOS 사파리는 일주일 넘게 안 들어간 사이트의 localStorage를
   지운다. 홈 화면에 추가하면 그 대상에서 빠지고, 부모 화면의 "기록 내보내기"가 마지막 보루다. */

export const STATIC = !!globalThis.window?.GUGUDAN_STATIC;

const KEY = id => `gugudan-profile-${id}`;
const LIST = 'gugudan-profiles';
const SETTINGS = 'gugudan-settings';

const json = (url, opt) => fetch(url, opt).then(r => r.json());

let CONTENT = null;   // 정적 모드에서 한 번만 읽는다

async function content() {
  if (!CONTENT) CONTENT = await json('./content.json');
  return CONTENT;
}

/* ── 정적 모드의 프로필 목록 ── */

const ids = () => {
  try { return JSON.parse(localStorage.getItem(LIST)) || []; }
  catch { return []; }
};

const readLocal = id => {
  try { return JSON.parse(localStorage.getItem(KEY(id))); }
  catch { return null; }
};

function writeLocal(p) {
  localStorage.setItem(KEY(p.id), JSON.stringify(p));
  const all = ids();
  if (!all.includes(p.id)) localStorage.setItem(LIST, JSON.stringify([...all, p.id]));
}

/* ── 부모가 정하는 것은 아이 화면이 덮어쓰면 안 된다 ────────────────

   아이 화면은 프로필 **전체**를 통째로 씁니다. 그런데 그 프로필은 게임을 연 순간의
   사본이라, 그 사이에 부모가 진도를 바꿔도 아이 화면은 모릅니다. 문제 다섯 개마다,
   화면을 내릴 때, 탭을 닫을 때 자동 저장이 돌면서 **부모가 방금 바꾼 것을 지웁니다.**

   실제로 그랬습니다(구현-현황 34장). 부모는 "저장해도 아이 화면에 반영이 안 된다"고
   느끼지만, 사실은 반영됐다가 몇 초 뒤에 지워지고 있었습니다.

   그래서 **쓰는 길을 셋으로 나눕니다.**

     saveProfile(p)        아이 화면. 부모 몫은 저장소에 있는 것으로 되돌려 놓고 쓴다
     saveParent(id, patch) 부모 화면. **부모 몫만** 고친다. 아이가 푼 것은 안 건드린다
     restoreProfile(p)     되돌리기. 파일에 있는 그대로 쓴다 (부모 몫도 그 시점 것)

   이 목록은 server.py의 PARENT_FIELDS와 **같아야 합니다** — t_race.mjs가 대조합니다. */
export const PARENT_FIELDS = ['progress', 'disabled', 'gifts'];

export function adoptParent(mine, stored) {
  if (!stored) return mine;
  const out = { ...mine };
  for (const f of PARENT_FIELDS) if (f in stored) out[f] = stored[f];
  // settings는 부모 몫(하루 목표)과 아이 몫(알림·모션)이 섞여 있다
  if (stored.settings && typeof stored.settings.goal === 'number')
    out.settings = { ...out.settings, goal: stored.settings.goal };
  return out;
}

/* 부모가 고친 것만 얹는다. patch에 없는 것은 저장소 그대로 둔다. */
export function applyParent(stored, patch) {
  const out = { ...stored };
  for (const f of PARENT_FIELDS) if (f in patch) out[f] = patch[f];
  if (patch.settings) out.settings = { ...out.settings, ...patch.settings };
  return out;
}

/* ── 밖에서 쓰는 것 ── */

export async function bootstrap() {
  if (!STATIC) return json('/api/bootstrap');

  const c = await content();
  return {
    profiles: ids().map(id => ({ id, displayName: readLocal(id)?.displayName || id })).filter(Boolean),
    settings: { ...c.settings, ...(localSettings()) },
    // 문제가 없는 팩은 아이 화면에 안 보낸다. 서버의 /api/bootstrap과 같은 규칙이다.
    packs: c.packs.filter(p => p.count)
      .map(p => ({ id: p.id, name: p.name, subject: p.subject, unit: p.unit, order: p.order, count: p.count })),
    messages: c.messages,
    wishes: c.wishes,
  };
}

export async function loadPack(id) {
  if (!STATIC) return json(`/api/pack/${encodeURIComponent(id)}`);
  const c = await content();
  return c.packs.find(p => p.id === id) || null;
}

export async function loadProfile(id) {
  if (!STATIC) return json(`/api/profile/${encodeURIComponent(id)}`);
  return readLocal(id);
}

/* 아이 화면이 쓰는 길. 부모 몫은 저장소에 있는 것으로 되돌려 놓는다. */
export async function saveProfile(p) {
  if (!STATIC) {
    // 서버 모드에서도 같은 규칙이 필요하다. 서버가 PUT을 받을 때 한 번 더 얹는다(server.py).
    await fetch(`/api/profile/${encodeURIComponent(p.id)}`, { method: 'PUT', body: JSON.stringify(p) });
    return;
  }
  writeLocal(adoptParent(p, readLocal(p.id)));
}

/* 부모 화면이 쓰는 길. **부모 몫만** 고치므로 아이가 지금 풀고 있어도 안전하다. */
export async function saveParent(id, patch) {
  if (!STATIC) {
    const res = await fetch(`/api/profile/${encodeURIComponent(id)}/parent`,
      { method: 'PUT', body: JSON.stringify(patch) });
    if (!res.ok) throw new Error('저장하지 못했습니다');
    return res.json();
  }
  const cur = readLocal(id);
  if (!cur) throw new Error('기록을 찾지 못했습니다');
  const next = applyParent(cur, patch);
  writeLocal(next);
  return next;
}

/* 다른 탭이 저장한 것을 곧바로 읽는다. 정적 모드에서만 뜻이 있다 —
   서버 모드에서는 아이 기기와 부모 기기가 다르므로 storage 이벤트가 안 온다. */
export const readStored = id => (STATIC ? readLocal(id) : null);

/* 되돌리기. 파일에 있는 그대로 쓴다 — 그 시점의 진도까지 통째로 돌아가는 것이 맞다. */
export async function restoreProfile(p) {
  if (!STATIC) {
    await fetch(`/api/profile/${encodeURIComponent(p.id)}?restore=1`,
      { method: 'PUT', body: JSON.stringify(p) });
    return;
  }
  writeLocal(p);
}

/* 새 프로필의 모양은 server.py의 new_profile()이 정한다. 빌드가 그대로 실어 온다 —
   두 곳에 두면 반드시 어긋난다. */
export async function createProfile(id) {
  if (!STATIC) return json('/api/profile', { method: 'POST', body: JSON.stringify({ id }) });

  if (!/^[가-힣a-zA-Z0-9_-]{1,20}$/.test(id) || readLocal(id))
    return { error: '이름을 쓸 수 없습니다' };

  const c = await content();
  const made = { ...structuredClone(c.newProfile), id, displayName: id,
                 createdAt: new Date().toLocaleDateString('sv-SE') };
  writeLocal(made);
  return made;
}

/* 아이패드는 홈 버튼을 누르면 그냥 사라진다. 그 순간에도 남겨야 한다. */
export function saveOnExit(p) {
  // 서버 모드의 beacon은 먼저 읽어볼 수 없다. 그래서 서버가 받을 때 얹는다(server.py).
  if (!STATIC) return navigator.sendBeacon(`/api/profile/${encodeURIComponent(p.id)}`, JSON.stringify(p));
  writeLocal(adoptParent(p, readLocal(p.id)));
  return true;
}

/* ── 부모 화면 ── */

export function localSettings() {
  if (!STATIC) return null;
  try { return JSON.parse(localStorage.getItem(SETTINGS)) || {}; }
  catch { return {}; }
}

export async function parentPacks(pin) {
  if (!STATIC) return json('/api/parent/packs', { headers: { 'X-Parent-Pin': pin } });

  const c = await content();
  if (pin !== (localSettings().parentPin ?? '0000')) return { error: 'PIN이 다릅니다' };
  return {
    packs: c.packs.map(p => ({ id: p.id, name: p.name, subject: p.subject, unit: p.unit,
                               order: p.order, file: p.file, count: p.count, warnings: p.warnings })),
    messages: { file: 'messages.csv', warnings: c.messageWarnings },
    wishes: { file: 'wishes.csv', list: c.wishes, warnings: c.wishWarnings },
  };
}

export async function saveSettings(pin, patch) {
  if (!STATIC) return json('/api/parent/settings',
    { method: 'PUT', headers: { 'X-Parent-Pin': pin }, body: JSON.stringify(patch) });

  if (pin !== (localSettings().parentPin ?? '0000')) return { error: 'PIN이 다릅니다' };
  localStorage.setItem(SETTINGS, JSON.stringify({ ...localSettings(), ...patch }));
  return { saved: true };
}
