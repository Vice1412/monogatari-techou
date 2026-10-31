/**
 * 狀態異常按鈕的「效果碼」與排列（2026-10-30，P7）。
 *
 * 為什麼要有這一支：六個狀態按鈕原本只寫名稱（`眩暈`），玩家要記得「眩暈是哪一項掉」，
 * 或去 hover 讀 `title`。名稱本身不攜帶資訊——真正要看的是**它打哪幾個屬性**。
 *
 * 效果碼一律由 `STATUS_AFFLICTIONS[key].affectedStats` 推導，**不另外維護對照表**：
 * 資料層已經宣告了每個狀態打哪幾個屬性，再寫一份「眩暈＝INS」就是第二個真相。
 * 第二個真相的代價不是「多寫幾行」，是它會跟第一個不一致，而不一致的那天沒有人會知道。
 *
 * 排列順序同理：`STATUS_AFFLICTION_ORDER` 是**介面順序**（見該常數的註解），
 * 不是資料順序。這裡只負責照它排，不重新決定。
 */

import { STATUS_AFFLICTIONS, STATUS_AFFLICTION_ORDER } from '../data/sourcebookConfig';

/** 骰階下降的記號。刻意用 `↓`（U+2193）而不是 `⬇`（U+2B07）：後者可被當成 emoji
 *  以彩色字型渲染，在紙墨色系裡會突然冒出一顆彩色方塊。`↓` 是純文字，吃顏色。 */
export const AFFLICTION_ARROW = '↓';

/** 多屬性之間的分隔。用中點而不是逗號：逗號在這個專案裡是「列舉」，
 *  中點讀起來是「同時」，而 `DEX · INS ↓` 的意思是「這兩項一起降」。 */
export const AFFLICTION_STAT_SEPARATOR = ' · ';

/**
 * `affectedStats` → `DEX · INS`（不含箭頭）。
 *
 * 空值語意：`affectedStats` 不是陣列（`undefined`／`null`／字串／數字）＝**不知道**，
 * 回空字串，按鈕就只顯示名稱。**不要回 `[]` 假裝「打不到任何屬性」**——
 * 那會在畫面上寫出「眩暈 」然後什麼都沒有，看起來像壞掉，而不是像「這筆資料沒填」。
 *
 * 逐項驗證而不是直接 `.map`：`affectedStats: [null]` 會讓 `.toUpperCase()` 拋錯，
 * 而拋錯發生在 render 裡＝整個面板白畫面。這種資料打錯一個字就全毀的寫法不值得。
 */
export const describeAfflictionStats = (aff) => {
  const list = aff && aff.affectedStats;
  if (!Array.isArray(list)) return '';
  return list
    .filter((key) => typeof key === 'string' && key.trim() !== '')
    .map((key) => key.trim().toUpperCase())
    .join(AFFLICTION_STAT_SEPARATOR);
};

/** `affectedStats` → `DEX · INS ↓`。沒有可顯示的屬性時回空字串（按鈕只留名稱）。 */
export const afflictionEffectLabel = (aff) => {
  const code = describeAfflictionStats(aff);
  return code ? `${code} ${AFFLICTION_ARROW}` : '';
};

/**
 * 按 `STATUS_AFFLICTION_ORDER` 排出六列顯示資料。
 *
 * 順序表與資料表若不一致（有人在順序表裡打錯字、或加了第七個狀態卻忘了登記），
 * 這裡**跳過**找不到的那一項而不是拋錯——面板不該因為一個顯示用的順序表而整個掛掉。
 * 代價是它會安靜地少一顆按鈕，所以 `tests/afflictionOrder.test.mjs` 有一條護欄
 * 逐字比對「順序表」與「資料表的鍵集合」必須完全相同（不多不少）。
 */
export const buildAfflictionRows = () => STATUS_AFFLICTION_ORDER
  .map((key) => {
    const aff = STATUS_AFFLICTIONS[key];
    if (!aff) return null;
    return {
      key,
      name: aff.name || key,
      short: aff.short || aff.name || key,
      effect: afflictionEffectLabel(aff),
      desc: aff.desc || '',
      stats: Array.isArray(aff.affectedStats) ? aff.affectedStats.slice() : []
    };
  })
  .filter(Boolean);
