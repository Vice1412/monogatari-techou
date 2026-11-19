/**
 * 命刻記錄（clocks）UI 契約測試（SSR 冒煙測試 · W7 唯讀退場階段一）。
 *
 * 執行：`npm run test:fateclock`（已納入 `npm test` 串接）
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

const SAMPLE_ROSTER = [
  { id: 'char_1', name: '艾莉婭', level: 8, clocks: [] },
  { id: 'char_2', name: '萊歐', level: 10, clocks: [] }
];

/* ────────────────────────────────────────────────────────────────
   A. 不傳 initialClocks 時渲染三顆預覽命刻＋唯讀公告＋複製到角色入口
   ──────────────────────────────────────────────────────────────── */
lines.push('-- A. 預設唯讀典藏檢視 --');
const def = render({ initialRoster: SAMPLE_ROSTER });
check(
  'A1 預設渲染出三顆範例命刻',
  countOf(def, '深淵魔神的甦醒儀式') === 1 &&
    countOf(def, '王國皇家禁衛隊抵達') === 1 &&
    countOf(def, '古代禁咒解析進度') === 1,
  '三顆標題各 1 次'
);
check('A2 預設不顯示空狀態', countOf(def, '還沒有任何命刻') === 0, '0 次');
check('A3 顯示 W7 唯讀退場公告，並移除新增進度命刻鈕',
  def.includes('data-testid="fate-clock-readonly-banner"') &&
    def.includes('命刻已改由角色卡持有') &&
    countOf(def, '新增進度命刻') === 0,
  '唯讀公告在／新增鈕已移除');
check('A4 顯示目標角色選擇器與三顆「複製到目前角色」按鈕',
  def.includes('data-testid="fate-clock-target-char"') &&
    countOf(def, '複製到目前角色') === 3,
  '3 顆複製鈕');

/* ────────────────────────────────────────────────────────────────
   B. 注入空陣列：空狀態（無建立按鈕，維持唯讀）
   ──────────────────────────────────────────────────────────────── */
lines.push('-- B. 空狀態（initialClocks=[]） --');
const empty = render({ initialClocks: [], initialRoster: SAMPLE_ROSTER });
check('B1 空狀態標題出現且只有一次', countOf(empty, '還沒有任何命刻') === 1, `${countOf(empty, '還沒有任何命刻')} 次`);
check(
  'B2 空狀態清楚說明已整合至角色卡（不再給建立按鈕）',
  countOf(empty, '已整合至角色卡的「個人命刻」分頁') === 1 &&
    countOf(empty, '建立第一個命刻') === 0 &&
    countOf(empty, '新增進度命刻') === 0,
  '1 次說明／0 建立鈕'
);
check(
  'B3 空狀態有敘事圖示（gi 實心剪影）',
  countOf(empty, '<svg') >= 1 && countOf(empty, '還沒有任何命刻') === 1,
  `svg ${countOf(empty, '<svg')} 個`
);

/* ────────────────────────────────────────────────────────────────
   C. 注入單顆舊格式命刻（缺 theme/type）：唯讀＋無編輯/刪除框
   ──────────────────────────────────────────────────────────────── */
lines.push('-- C. 單顆舊命刻容忍＋無名冊禁用複製 --');
const one = render({
  initialClocks: [{ id: 'fc_t', title: '測試用舊命刻', totalSegments: 6, filledSegments: 2 }],
  initialRoster: []
});
check('C1 舊格式命刻安全補齊並渲染標題與進度 2 / 6',
  countOf(one, '測試用舊命刻') === 1 && one.includes('2 / 6'),
  '2 / 6');
check('C2 不出現輸入編輯框與刪除按鈕，名冊為空時提示先建角',
  !one.includes('placeholder="命刻名稱..."') &&
    !one.includes('title="刪除命刻"') &&
    one.includes('角色名冊為空'),
  '純唯讀');

console.log(`\n${'='.repeat(56)}`);
for (const l of lines) console.log(`  ${l}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
