/**
 * 書本外框（第八輪）：**一本書的裝訂只有一種**。
 *
 * ## 為什麼要有這支
 *
 * 2026-10-23 之前，四個章節各自帶一套顏色：
 *
 * | 章節 | 頁面底色 | 頁首 | 按鈕 |
 * |---|---|---|---|
 * | NPC 工坊 | `#fbf7ee` 羊皮紙 | `#f4ebd9` | 棕 `#8b5e34` |
 * | 角色卡助手 | `#f4fbf7` 薄荷 | `#ecfdf5` | 翡翠綠 |
 * | 戰鬥輪次 | `#fdf4f5` 粉 | `#fff1f2` | 玫瑰紅 |
 * | 命刻記錄 | `#f0f9ff` 天藍 | `#f0f9ff` | 天藍 |
 *
 * 四個色相跨了 316°，而**整個 app 的 accent 只有一個**（`--accent: #a63d40`）。
 * 也就是說章節色是**第二套顏色系統**，跟設計權杖互相矛盾：翻一章像換一個 app。
 * GM 2026-10-23 的裁定是「章節顏色並非定性，可以收斂」。
 *
 * ## 收斂成什麼
 *
 * **頁面、頁首、頁尾全部回到同一張紙**，章節身份只剩兩件事：
 * 1. 頁首的**圖示**（工坊的箱子／角色卡的法書／戰鬥的骰子／命刻的捲軸，本來就不同）；
 * 2. 頁首的**標題文字**（本來就不同）。
 *
 * 為什麼不保留「每章一個小 accent」：那仍然是四套顏色，只是面積變小。
 * 書裡「Use color to support meaning」——四章之間沒有語意差別，
 * 顏色就不該承擔識別；有語意差別的是**讀／做**，而那個差別由 `data-theme`
 * 的 `warm`／`cool` 在**頁面內部**表達，不需要在裝訂上再說一次。
 *
 * ## 護欄
 *
 * `tests/uiSystem.test.mjs` 斷言：四個章節的 `headerBg`／`headerBorder`／`titleText`／
 * `subtitleText`／`pageBg` **各只有一個值**（`new Set(...).size === 1`）。
 * 也就是說「加回一個章節色」會直接 FAIL——不是靠人記得。
 */

/** 章節 id（順序＝封面上由左至右，測試也用它當迴圈來源） */
export const CHAPTER_IDS = ['workshop', 'character', 'combat', 'clocks'];

/**
 * 紙與墨。全部取自既有 hex（`scratch/ui-audit/hex_inventory.mjs` 可查），
 * 本輪**沒有新增任何一個 hex**——收斂顏色若順便加新色，等於把預算問題往後推。
 */
export const BOOK_CHROME = Object.freeze({
  // 頁面（最底層）
  pageBg: 'bg-[#fbf7ee] text-[#2c221e] selection:bg-amber-200 selection:text-amber-900',
  pageBgHex: '#fbf7ee',

  // 頁首
  headerBg: 'bg-[#f4ebd9]/95 backdrop-blur-md',
  headerBorder: 'border-[#d6c7ab]',
  titleText: 'text-[#3c2415]',
  subtitleText: 'text-[#6b5a4b]',
  divider: 'bg-[#d6c7ab]',
  appIconBorder: 'border-[#d6c7ab]',
  subTitleBadge: 'bg-white/85 border-[#d6c7ab] text-[#3c2415]',

  // 頁首動作（三級：主要／次要／第三級）
  exitBtn: 'border-[#8b5e34]/40 bg-[#8b5e34] hover:bg-[#78350f] text-[#fffdf9] shadow-e1',
  exitIcon: 'text-[#fde68a]',
  iconWrapper: 'bg-[#ede4d1] border-[#d6c7ab] text-amber-900',
  toolBtn: 'border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#ebdcc4] text-[#3c2415] hover:text-amber-950',
  toolIcon: 'text-amber-800',

  // 頁尾
  footerBorder: 'border-[#d6c7ab]',
  footerBg: 'bg-[#f5efdf]/60',
  footerNumber: 'text-amber-900',
  footerText: 'text-[#6b5a4b]',
  footerButton: 'text-amber-800 hover:text-amber-950',
  footerSubtext: 'text-[#7c6a58]',
});

/**
 * 章節主題 = 同一套外框 ＋ 章節自己的 id。
 *
 * `id` 保留是因為 `ChapterHeader` 用它挑圖示、`BookPageFlipOverlay` 用它挑動畫文字；
 * 顏色不再分章。
 */
export const CHAPTER_THEMES = Object.freeze(
  Object.fromEntries(CHAPTER_IDS.map((id) => [id, Object.freeze({ id, ...BOOK_CHROME })]))
);

/** 取章節外框；未知 id 一律回工坊（封面預設） */
export const chapterTheme = (id) => CHAPTER_THEMES[id] || CHAPTER_THEMES.workshop;
