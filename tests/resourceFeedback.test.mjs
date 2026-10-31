/**
 * 資源回饋（P5-a，2026-10-30）。
 *
 * 執行：`npm run test:feedback`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者對「操作感」的定義是：
 *
 *   「要有玩遊戲的感覺，不呆板，而是有系統互動的實感。」
 *
 * 量到的現況是：全站 65 處 `transition`／`animate-`，但真正會動的動畫只有
 * `animate-fade-in` 一種，而四條資源條只有 `width` 在動、滑完就沒了。
 * 玩家按下 `−8` 之後，除了自己心算，沒有任何東西告訴他「剛剛這一擊扣了 8」。
 *
 * 這一輪補的是三件很便宜、但缺一整個世代的東西：
 *   1. 浮動的增減數字（`-8` 從條子上飄起來）
 *   2. 尾影（主條快、尾影慢，露出「剛剛失去的那一段」）
 *   3. 危機脈動真的接上跑團面板的 HP 卡（`.crisis-pulse-active` 一直存在，
 *      但只有名冊卡與戰鬥卡在用）
 *
 * ── 為什麼 D 段要掃 CSS ────────────────────────────────────
 *
 * 動畫最容易壞的方式不是「寫錯」，是**寫了一個沒有人定義的名字**：
 * `animate-fade-in` 曾經在全站被寫在 29 個地方，而它從來沒有被定義過
 * （見 `src/index.css` 的註解）。29 處全部安靜地什麼都不做，沒有任何測試會紅。
 * 所以 D 段做的是：把 `index.css` 裡每一個 `animation:` 引用的名字，
 * 拿去跟 `@keyframes` 的定義對帳。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describeResourceDelta,
  DELTA_FLASH_MS,
  ResourceDeltaBadge
} from '../src/features/character-sheet/components/ResourceDeltaBadge.jsx';
import GaugeBar from '../src/features/character-sheet/components/GaugeBar.jsx';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';

let results = [];
/** 值斷言：實際值與期望值真的相等才算過（理由同 characterDossier.test.mjs）。 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const countOf = (hay, needle) => hay.split(needle).length - 1;

const ROOT = process.cwd();
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const renderGauge = (props) => renderToStaticMarkup(React.createElement(GaugeBar, props));

/* ────────────────────────────────────────────────────────────────
   A. describeResourceDelta：說得對，也懂得「不知道」
   ──────────────────────────────────────────────────────────────── */
eq('A1 掉血 8 → 顯示 -8、語氣 loss', describeResourceDelta(20, 12), { delta: -8, tone: 'loss', text: '-8' });
eq('A2 回血 5 → 顯示 +5、語氣 gain', describeResourceDelta(12, 17), { delta: 5, tone: 'gain', text: '+5' });
eq('A3 沒有變化 → 不回傳任何東西（不畫「-0」）', describeResourceDelta(12, 12), null);
eq('A4 從 0 變 1 要算數（0 是值，不是「沒有」）', describeResourceDelta(0, 1), { delta: 1, tone: 'gain', text: '+1' });
eq('A5 從 1 變 0 要算數', describeResourceDelta(1, 0), { delta: -1, tone: 'loss', text: '-1' });
eq('A6 負值到 0 也算（不會被當成「沒有」）', describeResourceDelta(-3, 0), { delta: 3, tone: 'gain', text: '+3' });

// 空值語意：`null` 是「不知道」，不是「零」。
// 這一條如果寫成 `Number(from)`，四維還沒指派時畫面會浮出一個假的 +8。
eq('A7 null 是「不知道」，不是 0（不得浮出假數字）', describeResourceDelta(null, 8), null);
eq('A8 undefined 是「不知道」', describeResourceDelta(undefined, 8), null);
eq('A9 數字字串不強制轉型（來源一定是 number）', describeResourceDelta('5', 8), null);
eq('A10 NaN 不比對', describeResourceDelta(NaN, 8), null);
eq('A11 Infinity 不比對', describeResourceDelta(0, Infinity), null);
eq('A12 -Infinity 不比對', describeResourceDelta(-Infinity, 0), null);
eq('A13 布林不當數字', describeResourceDelta(false, true), null);

eq('A14 浮字停留 0.9 秒（與 CSS 動畫長度一致）', DELTA_FLASH_MS, 900);

/* ────────────────────────────────────────────────────────────────
   B. ResourceDeltaBadge：沒有東西時什麼都不畫
   ──────────────────────────────────────────────────────────────── */
const renderBadge = (flash) => renderToStaticMarkup(React.createElement(ResourceDeltaBadge, { flash }));
eq('B1 沒有 flash 時不輸出任何標記（不是空殼元素）', renderBadge(null), '');
eq('B2 有 flash 時畫出數字', countOf(renderBadge({ delta: -8, tone: 'loss', text: '-8', key: 1 }), '-8'), 1);
eq('B3 帶上語氣（讓顏色與字重可以分別被測）',
  countOf(renderBadge({ delta: 5, tone: 'gain', text: '+5', key: 2 }), 'data-tone="gain"'), 1);
eq('B4 損失用深紅、增益用深綠（都是登記色）', [
  countOf(renderBadge({ delta: -8, tone: 'loss', text: '-8', key: 3 }), '#8c3235'),
  countOf(renderBadge({ delta: 5, tone: 'gain', text: '+5', key: 4 }), '#245c45')
], [1, 1]);
eq('B5 掛的是浮字動畫 class', countOf(renderBadge({ delta: -8, tone: 'loss', text: '-8', key: 5 }), 'animate-resource-delta'), 1);
eq('B6 不攔截滑鼠（浮字不該擋住下面的按鈕）',
  countOf(renderBadge({ delta: -8, tone: 'loss', text: '-8', key: 6 }), 'pointer-events-none'), 1);
eq('B7 對螢幕閱讀器隱藏（值是輸入框的職責，不重複唸）',
  countOf(renderBadge({ delta: -8, tone: 'loss', text: '-8', key: 7 }), 'aria-hidden="true"'), 1);
// 2026-10-30：第一版是 `right-1 -top-4`（貼齊條子右端往上浮）。實機截圖裡 `-8`
// 正好壓在旁邊的 `42 / 50` 上，兩個數字疊成一團——而所有測試都是綠的，
// 因為它們驗的是「有沒有那個元素」，不是「看不看得清楚」。
// 資源卡的標頭是 justify-between（左：資源名／右：現在/上限），**中間是空的**，
// 所以浮字改成整條寬置中。置中不能用 `-translate-x-1/2`：動畫 keyframes 會設
// `transform`，整組蓋掉 utility 的 transform，浮字就又跑回左邊了。
const badgeCentered = renderBadge({ delta: -8, tone: 'loss', text: '-8', key: 8 });
eq('B8 浮字置中（走標頭中間那片空白），不靠右',
  [countOf(badgeCentered, 'inset-x-0'), countOf(badgeCentered, 'text-center'), /(^|\s)right-\d/.test(badgeCentered)],
  [1, 1, false]);
eq('B9 置中不靠 translate（動畫會蓋掉 transform，浮字會跑回左邊）',
  /-translate-x/.test(badgeCentered), false);
eq('B10 浮字掛在條子之上（不佔版面高度）', countOf(badgeCentered, 'absolute'), 1);

/* ────────────────────────────────────────────────────────────────
   C. GaugeBar：主條 ＋ 尾影
   ──────────────────────────────────────────────────────────────── */
const gauge = renderGauge({ percent: 40, testId: 'g' });
/**
 * 取出某一層的 `style`。
 *
 * 為什麼不能只數 `width:40%` 出現幾次：尾影與主條在「沒有變動」時**本來就同寬**，
 * 所以那個字串一定出現兩次。數它只證明「有人寫了 40%」，證明不了
 * 「主條是 40%、尾影也是 40%」——而尾影存在的意義正是「兩者可以不同」。
 */
const fillStyleOf = (markup) => (markup.match(/gauge-fill[^>]*?style="([^"]*)"/) || [])[1] || '';
const trailStyleOf = (markup) => (markup.match(/gauge-trail[^>]*?style="([^"]*)"/) || [])[1] || '';

eq('C1 畫出主條與尾影兩層', [countOf(gauge, 'gauge-fill'), countOf(gauge, 'gauge-trail')], [1, 1]);
eq('C2 主條寬度是 40%', fillStyleOf(gauge), 'width:40%');
eq('C3 沒有給 trailPercent 時尾影跟著主條（第一帧不該有第三種寬度）', trailStyleOf(gauge), 'width:40%');
eq('C4 尾影先畫（順序就是圖層：主條疊在上面）',
  gauge.indexOf('gauge-trail') < gauge.indexOf('gauge-fill'), true);
eq('C5 有 testId 時主條與尾影各自具名',
  [countOf(gauge, 'data-testid="g-fill"'), countOf(gauge, 'data-testid="g-trail"')], [1, 1]);

const noId = renderGauge({ percent: 10 });
eq('C6 沒有 testId 時不會生出 data-testid="undefined"', countOf(noId, 'data-testid'), 0);

eq('C7 超過 100 夾到 100', fillStyleOf(renderGauge({ percent: 180 })), 'width:100%');
eq('C8 低於 0 夾到 0', fillStyleOf(renderGauge({ percent: -20 })), 'width:0%');
eq('C9 NaN 當 0（不是 width:NaN%，那會被瀏覽器整條丟掉）',
  fillStyleOf(renderGauge({ percent: NaN })), 'width:0%');
eq('C10 字串數字照算（呼叫端偶爾會傳字串）', fillStyleOf(renderGauge({ percent: '55' })), 'width:55%');
eq('C11 尾影可以單獨指定（上限改變時可選）',
  [fillStyleOf(renderGauge({ percent: 30, trailPercent: 70 })), trailStyleOf(renderGauge({ percent: 30, trailPercent: 70 }))],
  ['width:30%', 'width:70%']);
eq('C12 fillStyle 會與 width 合併，不會蓋掉寬度',
  fillStyleOf(renderGauge({ percent: 25, fillStyle: { backgroundColor: '#a63d40' } })),
  'background-color:#a63d40;width:25%');

/* ────────────────────────────────────────────────────────────────
   D. CSS 契約：動畫名字有定義、尾影真的比較慢、減少動態有開關
   ──────────────────────────────────────────────────────────────── */
const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

eq('D1 `.gauge-fill` 有 width 過場', /\.gauge-fill\s*\{[^}]*transition:\s*width/.test(cssCode), true);
eq('D2 `.gauge-trail` 有 width 過場', /\.gauge-trail\s*\{[^}]*transition:\s*width/.test(cssCode), true);

const fillMs = Number((cssCode.match(/\.gauge-fill\s*\{[^}]*?width\s+(\d+)ms/) || [])[1]);
const trailMs = Number((cssCode.match(/\.gauge-trail\s*\{[^}]*?width\s+(\d+)ms/) || [])[1]);
eq('D3 尾影比主條慢（否則兩條一起到，尾影看不見）', trailMs > fillMs, true);
eq('D4 尾影有延遲（先讓主條動起來，才露得出那一段）',
  /\.gauge-trail\s*\{[^}]*?cubic-bezier\([^)]*\)\s+\d+ms/.test(cssCode), true);
eq('D5 主條在 120–200ms 的動態語彙內（v5 的節奏，不是彈簧）', fillMs >= 120 && fillMs <= 200, true);

eq('D6 `@keyframes resourceDeltaFloat` 存在', countOf(cssCode, '@keyframes resourceDeltaFloat'), 1);
eq('D7 `.animate-resource-delta` 綁的是那個 keyframes',
  /\.animate-resource-delta\s*\{\s*animation:\s*resourceDeltaFloat/.test(cssCode), true);
eq('D8 浮字時長與 `DELTA_FLASH_MS` 一致（不一致就會提早消失或停在半空）',
  countOf(cssCode, `${DELTA_FLASH_MS}ms ease-out forwards`), 1);

// 結構護欄：每一個 `animation: <name>` 引用的名字都要有 `@keyframes <name>`。
// 這正是 `animate-fade-in` 那次的病——名字寫了 29 次，定義一次都沒有。
const declaredFrames = new Set([...cssCode.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]));
const usedFrames = [...cssCode.matchAll(/animation:\s*([A-Za-z][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
const orphanFrames = [...new Set(usedFrames)].filter((n) => !declaredFrames.has(n));
eq('D9 index.css 裡每個 animation 引用的名字都有 @keyframes（沒有孤兒動畫）', orphanFrames, []);
eq('D10 反向控制：真的有掃到動畫（否則 D9 是在比對兩個空集合）', declaredFrames.size >= 10, true);

// 減少動態：這條在本輪之前完全不存在（grep 是 0 筆），而站上已有 11 組 keyframes，
// 其中包含 1.8 秒無限循環的危機脈動與 0.85 秒的翻書轉場。
eq('D11 有 prefers-reduced-motion 開關', countOf(cssCode, '@media (prefers-reduced-motion: reduce)'), 1);
eq('D12 開關把 animation-iteration-count 壓成 1（不然 infinite 會變成高速閃爍）',
  /prefers-reduced-motion[\s\S]{0,400}animation-iteration-count:\s*1\s*!important/.test(cssCode), true);
eq('D13 開關同時關掉 transition（尾影與按鈕過場也算動態）',
  /prefers-reduced-motion[\s\S]{0,400}transition-duration:\s*0\.001ms\s*!important/.test(cssCode), true);
eq('D14 開關放在檔案最後（`!important` 也要在後面才蓋得乾淨）',
  cssCode.lastIndexOf('prefers-reduced-motion') > cssCode.length * 0.8, true);

/* ────────────────────────────────────────────────────────────────
   E. 面板接線：四條資源條都接上了
   ──────────────────────────────────────────────────────────────── */
const hudSrc = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/features/character-sheet/components/CharacterPlayHUD.jsx'), 'utf8')
);
eq('E1 面板用了四條 GaugeBar', countOf(hudSrc, '<GaugeBar'), 4);
eq('E2 四條各有具名 testId',
  ['gauge-hp', 'gauge-mp', 'gauge-ip', 'gauge-exp'].map((id) => countOf(hudSrc, `testId="${id}"`)), [1, 1, 1, 1]);
eq('E3 四個浮字各吃自己的值',
  ['hpDelta', 'mpDelta', 'ipDelta', 'expDelta'].map((v) => countOf(hudSrc, `flash={${v}}`)), [1, 1, 1, 1]);
// 2026-10-31（P9）：浮字從四條變成五條，第五條是**錢包**。
//
// 為什麼要改這條斷言：原本寫死 `4`，而錢包是「存量型」資源——它沒有條，
// 所以它不在 E1／E2 的「四條資源條」清單裡，但它同樣需要「剛剛變了多少」。
// 這是 MEMORY §C10 的第二類紅燈（斷言一直在記錄舊行為），不是回歸。
//
// 為什麼不是只把 4 改成 5（MEMORY §C11）：只改數字的話，有人刪掉「HP 浮字」、
// 再隨便補一個新的浮字，這裡仍然是綠的——它守的其實是「那四條一條都沒消失」。
// 所以改成**逐一點名**，另外用一條總數擋「多掛了沒人決定的第六個」。
eq('E3-b 五個浮字逐一掛在正確的值上（含錢包）', [
  'flash={hpDelta}', 'flash={mpDelta}', 'flash={ipDelta}', 'flash={expDelta}', 'flash={zenitDelta}'
].map((v) => countOf(hudSrc, v)), [1, 1, 1, 1, 1]);
eq('E3-c 浮字總數恰為五個（第六個要有人決定）', countOf(hudSrc, '<ResourceDeltaBadge'), 5);
eq('E4 四支 hook 都真的被呼叫了（不是宣告了沒用）',
  ['curHp', 'curMp', 'curIp'].map((v) => countOf(hudSrc, `useResourceDelta(${v})`)), [1, 1, 1]);
// 錢包那支吃的是 `character.zenit ?? null`，不是 `|| 0`——
// `|| 0` 會讓「不知道有多少錢」變成「有 0 元」，於是浮出一個假的 -500。
eq('E4-b 錢包的 hook 傳的是 null 而不是 0（空值語意）',
  countOf(hudSrc, 'useResourceDelta(character.zenit ?? null)'), 1);

const renderHud = (character, props = {}) =>
  renderToStaticMarkup(
    React.createElement(CharacterPlayHUD, {
      character,
      onChange: () => {},
      onBackToRoster: () => {},
      onOpenEditor: () => {},
      showToast: () => {},
      ...props
    })
  );

const healthy = createNewCharacter({ name: '回饋測試' });
const hudHealthy = renderHud(healthy);
eq('E6 不是危機時沒有脈動層（對照組）', countOf(hudHealthy, 'data-testid="hp-crisis-pulse"'), 0);

const crisis = createNewCharacter({ name: '回饋測試' });
crisis.currentHp = 1;
const hudCrisis = renderHud(crisis);
eq('E7 危機時 HP 卡有脈動層', countOf(hudCrisis, 'data-testid="hp-crisis-pulse"'), 1);
eq('E8 脈動層用的是既有的 `.crisis-pulse-active`（不是另寫一個動畫）',
  countOf(hudCrisis, 'crisis-pulse-active'), 1);
eq('E9 `.crisis-pulse-active` 這個 class 真的有定義（否則 E8 是空殼）',
  countOf(cssCode, '.crisis-pulse-active'), 1);
eq('E10 脈動層不吃滑鼠事件（不能擋住下面的按鈕）',
  countOf(hudCrisis, 'pointer-events-none absolute inset-0'), 1);

// 浮字是「剛剛那一下」，SSR 沒有「上一個值」，所以不該畫任何東西。
eq('E11 SSR 首帧不畫浮字（沒有「上一個值」就沒有增減）', countOf(hudHealthy, 'data-testid="resource-delta"'), 0);

/* ────────────────────────────────────────────────────────────────
   F. 紅線：回饋不寫入任何地方
   ──────────────────────────────────────────────────────────────── */
const badgeSrc = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/features/character-sheet/components/ResourceDeltaBadge.jsx'), 'utf8')
);
eq('F1 回饋模組不碰 store', /writeJSON|localStorage|sessionStorage/.test(badgeSrc), false);
eq('F2 回饋模組不呼叫任何回呼（純視覺）', /onChange|showToast/.test(badgeSrc), false);
eq('F3 回饋沒有被寫進成長履歷（履歷記的是「發生過什麼」，不是「剛剛按了什麼」）',
  /kind:\s*'delta'/.test(hudSrc), false);

/* ────────────────────────────────────────────────────────────────
   Z. 斷言器自我體檢
   ──────────────────────────────────────────────────────────────── */
const before = results.length;
eq('__selfcheck__', 1, 2);
const selfOk = results.length === before + 1 && results[results.length - 1].ok === false;
results.pop();
eq('Z1 斷言器本身會紅（餵不相等的值必須回 false）', selfOk, true);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  「有在玩遊戲的感覺」不是多加功能，是讓按下去的每一格都有回應。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
