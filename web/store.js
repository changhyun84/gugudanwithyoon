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

export async function saveProfile(p) {
  if (!STATIC) {
    await fetch(`/api/profile/${encodeURIComponent(p.id)}`, { method: 'PUT', body: JSON.stringify(p) });
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
  if (!STATIC) return navigator.sendBeacon(`/api/profile/${encodeURIComponent(p.id)}`, JSON.stringify(p));
  writeLocal(p);
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
