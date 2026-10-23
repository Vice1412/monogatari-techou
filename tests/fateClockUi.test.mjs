/**
 * 命刻記錄（clocks）UI 契約測試（SSR 冒煙測試）。
 *
 * 執行：`npm run test:fateclock`（已納入 `npm test` 串接）
 *
 * 為什麼要有這個檔案（2026-10-23 建立，第三輪稽核）：
 * `docs/ui-review-refactoring-ui.md` §7.3 第 6 列（P0）：全站 93 個會 `map` 清單的檔案裡，
 * 只有 7 個有真正的空狀態。**命刻這一章是 0 個**——把三顆範例命刻刪光之後，
 * `clocks.map` 對空陣列什麼都不畫，畫面只剩標題、一顆按鈕與一大片空白。
 *
 * Refactoring UI §8.4：空狀態是使用者**保證會看到**的畫面，不是例外。
 *
 * 這個檔案護住三件事：
 *   A. 預設（有範例命刻）行為**逐字不變**——注入點鐵律，見 AGENTS.md §1。
 *   B. 空狀態真的出現，而且**只出現一次**。
 *   C. 空狀態時標頭那顆「新增進度命刻」**不出現**——
 *      同一個動作在一屏裡喊兩次，等於告訴使用者這裡有兩件不同的事。
 *
 * ※ 測不到的部分（誠實聲明）：`onClick` 內的行為（SSR 不執行事件）。
 *   所以「按了建立第一個命刻會真的新增」不在這裡，那是 `handleAddClock` 的職責。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FateClockPage from '../src/features/clocks/FateClockPage.jsx';

let pass = 0;
let fail = 0;
const lines = [];
const results = [];

const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  if (ok) {
    pass += 1;
    lines.push(`PASS  ${name}${detail ? `  —— ${detail}` : ''}`);
  } else {
    fail += 1;
    lines.push(`FAIL  ${name}${detail ? `  —— ${detail}` : ''}`);
  }
};

const render = (props) => renderToStaticMarkup(React.createElement(FateClockPage, props));
const countOf = (hay, needle) => hay.split(needle).length - 1;

/* ────────────────────────────────────────────────────────────────
   A. 不傳注入點：預設行為不變（三顆範例命刻）
   ──────────────────────────────────────────────────────────────── */
lines.push('-- A. 預設行為（不傳注入點） --');
const def = render();
check(
  'A1 預設渲染出三顆範例命刻',
  countOf(def, '深淵魔神的甦醒儀式') === 1 &&
    countOf(def, '王國皇家禁衛隊抵達') === 1 &&
    countOf(def, '古代禁咒解析進度') === 1,
  `三顆標題各 1 次`
);
check('A2 預設不顯示空狀態', countOf(def, '還沒有任何命刻') === 0, `0 次`);
check('A3 預設顯示標頭新增鈕', countOf(def, '新增進度命刻') === 1, `${countOf(def, '新增進度命刻')} 次`);

/* ────────────────────────────────────────────────────────────────
   B. 注入空陣列：空狀態
   ──────────────────────────────────────────────────────────────── */
lines.push('-- B. 空狀態（initialClocks=[]） --');
const empty = render({ initialClocks: [] });
check('B1 空狀態標題出現且只有一次', countOf(empty, '還沒有任何命刻') === 1, `${countOf(empty, '還沒有任何命刻')} 次`);
check(
  'B2 空狀態有一句解釋（不是只有一句「沒有資料」）',
  countOf(empty, '命刻用來記錄反派陰謀') === 1,
  `${countOf(empty, '命刻用來記錄反派陰謀')} 次`
);
check('B3 空狀態有唯一動作', countOf(empty, '建立第一個命刻') === 1, `${countOf(empty, '建立第一個命刻')} 次`);
check(
  'B4 空狀態時標頭新增鈕不出現（避免一屏兩個同一動作）',
  countOf(empty, '新增進度命刻') === 0,
  `${countOf(empty, '新增進度命刻')} 次`
);
check(
  'B5 空狀態有敘事圖示（gi 實心剪影，不是純文字）',
  countOf(empty, '<svg') >= 1 && countOf(empty, '還沒有任何命刻') === 1,
  `svg ${countOf(empty, '<svg')} 個`
);

/* ────────────────────────────────────────────────────────────────
   C. 注入單顆：正常清單、無空狀態
   ──────────────────────────────────────────────────────────────── */
lines.push('-- C. 單顆命刻 --');
const one = render({
  initialClocks: [{ id: 'fc_t', title: '測試用命刻', totalSegments: 6, filledSegments: 2, theme: 'amber', type: 'circle' }],
});
check('C1 命刻標題出現', countOf(one, '測試用命刻') === 1, `${countOf(one, '測試用命刻')} 次`);
check('C2 不顯示空狀態', countOf(one, '還沒有任何命刻') === 0, `0 次`);
check('C3 顯示標頭新增鈕', countOf(one, '新增進度命刻') === 1, `${countOf(one, '新增進度命刻')} 次`);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
console.log(`\n${'='.repeat(56)}`);
for (const l of lines) console.log(`  ${l}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  空狀態是 §8.4 的硬性要求，不是加分項：`);
  console.log(`  使用者刪光資料之後看到的那一屏，跟你第一次打開時看到的是同一屏。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
