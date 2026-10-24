/**
 * NPC 工坊的「卡片風格」表。
 *
 * ## 第三十五輪（2026-10-24 §CI43）：這裡原本是第二套紙系統
 *
 * 這支檔案原本是**六套完整的顏色系統**：每個主題各帶 15 個欄位——頁面底、卡面、
 * 面板、子面板、頁首、匯出底、邊框、墨、四階身份色、徽章底。
 * 也就是說「換卡片風格」＝**換一張卡片的整個 app**：選「群青藍」的 NPC 卡片
 * 是藍灰色的紙，而它周圍的工坊是奶油色的——同一頁上兩個 app。
 *
 * 更嚴重的是：那 15 個欄位裡的**身份色（accent／accentHover／accentDark／accentLight）
 * 與 `characterThemes` 一字不差**。六個主題、六組色、兩份拷貝。
 * 也就是說這支檔案真正的內容是：
 *
 *     characterThemes 的身份表 ＋ 一份多出來的紙 ＋ 六個死欄位
 *
 * ## 判準（沿用第十五輪對 `characterThemes` 的判決）
 *
 * > **面不是身份，墨不是身份；身份是 accent。**
 *
 * 紙只有一種（這本書的紙），墨只有一階梯，六個主題的差別只有一個 `accent`。
 * 所以這支檔案現在**只做投影**：把 `CHARACTER_THEMES` 的紙與身份取出來，
 * 給 `NPCWorkshop` 一個形狀穩定的 `THEMES`。
 *
 * ## 為什麼是「投影」而不是「各自維護一份」
 *
 * 兩份拷貝的最終歸宿一定是漂移——第三十三輪的 `blue → cyan` 就是同一種病：
 * 一份表改了，另一份不知道。這裡的投影讓「NPC 卡片的六個身份色」與
 * 「角色卡的六個身份色」在**定義上**不可能不同，而不是靠人工同步。
 *
 * 護欄 H32 家族守著這件事：本檔零 hex、六個鍵與 `CHARACTER_THEMES` 逐項相同、
 * 六個紙欄位與 `CHARACTER_THEMES` 相同、六個鍵一個都不能少。
 *
 * ## 死欄位
 *
 * 原檔的 `appBg`／`panelBg`／`headerBg`／`badgeBg`／`accentHover`／`accentLight`
 * 在**全站程式碼裡一次都沒被讀過**（已剝註解逐字統計）。六個欄位 × 六個主題
 * ＝ 36 個 hex 從來沒有上過畫面。這輪直接不投影它們。
 *
 * ## 預設主題的外觀沒有變
 *
 * 工坊外框本來就釘在 `THEMES.amber`（`workshopTheme`），而 amber 的紙本來就是
 * `#fbf7ee`／`#f4ebd9`／`#d6c7ab`——也就是 `characterThemes` 的 SHARED。
 * 所以收斂的目標不是「新發明的紙」，是**工坊本來就在用的那張紙**：
 * 卡片與它所在的頁面終於是同一張紙。
 */

import { CHARACTER_THEMES } from '../../character-sheet/utils/characterThemes';

/**
 * `NPCWorkshop` 實際會讀的欄位（已剝註解逐字統計）：
 * `accent`、`accentDark`、`border`、`subpanelBg`、`textDark`、`sheetBg`、`cardBg`、
 * `exportBg`、`name`。少一個就會在畫面上變成 `undefined` 色的空白區塊，
 * 所以這裡**逐一列出**而不是 `{ ...t }`——多投影一個欄位就等於多留一個死欄位。
 */
const project = (t) =>
  Object.freeze({
    id: t.id,
    name: t.name,

    // 身份（六色，封閉集合，每個 NPC 一色）
    accent: t.accent,
    accentDark: t.accentDark,

    // 紙與墨（六個主題共用同一組，來自 `characterThemes` 的 SHARED）
    cardBg: t.cardBg,
    sheetBg: t.sheetBg,
    subpanelBg: t.subpanelBg,
    exportBg: t.exportBg,
    border: t.border,
    textDark: t.textDark,
  });

export const THEMES = Object.freeze(
  Object.fromEntries(
    Object.entries(CHARACTER_THEMES).map(([id, t]) => [id, project(t)])
  )
);
