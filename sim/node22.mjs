/* CI 조건으로 검사를 돌린다 — node --import sim/node22.mjs test/t_apprun.mjs

   CI는 node 22, 손은 node 18일 수 있습니다. 그 차이로 **CI에서만** 터진 적이 있습니다.

   node 21부터 `navigator`가 전역에 있고, **setter가 없는 getter**입니다.
   모듈은 strict라 `globalThis.navigator = {...}` 가 조용히 무시되지 않고 TypeError로 터집니다.
   node 18에는 `navigator`가 아예 없어서 대입이 그냥 됩니다 (구현-현황 40장).

   여기서는 그 상태만 흉내 냅니다. node 22를 깔 수 없는 곳에서 CI를 미리 보는 용도입니다.
   진짜 해법은 검사 쪽에서 **대입 대신 defineProperty**를 쓰는 것이고, 그건
   `t_apprun.mjs`의 «어떤 검사도 globalThis에 대입하지 않는다»가 지킵니다. */

for (const [name, value] of [
  ['navigator', { userAgent: 'node', hardwareConcurrency: 4 }],
]) {
  if (name in globalThis) continue;      // 진짜 새 node에서는 건드리지 않는다
  Object.defineProperty(globalThis, name, { configurable: true, get: () => value });
}
