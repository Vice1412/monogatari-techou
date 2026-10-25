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
 * （第三十八輪 §CI46：上表那個「棕 `#8b5e34`」已經併掉了。它不是第二個強調色，
 *   而是**一個色碼同時當強調色與墨階**——按鈕底改走 `#a63d40`，標題與標籤改走墨階。
 *   這張表保留原樣，因為它記錄的是**當時**的四套色。）
 *
 * 四個色相跨了 316°，而**整個 app 的強調色只有一個**（`#a63d40`）。
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
 * 顏色就不該承擔識別；有語意差別的是**讀／做**。
 *
 * （第三十九輪 §CI47 修正：這段原本寫「那個差別由 `data-theme` 的 `warm`／`cool`
 *   在頁面內部表達」。`data-theme` 已經在第三十八輪連同整組變數刪掉了——全站
 *   設定次數 0。實際承載冷暖的是 `tailwind.config.js` 的 `warm-*`／`cool-*` 色階，
 *   而當時量到的使用次數是 **warm 21 處、cool 3 處**，且那 3 處全在 `CombatantCard`
 *   當進度條底色（同一個檔案自己用的是 `bg-warm-*`）。
 *   **所以第三十九輪結束時，「冷暖分層」只有暖的一層。**）
 *
 * （第四十輪 §CI48 把它做完了：戰鬥畫面 79 處暖紙全部換成冷區令牌，
 *   全站變成 **warm 12 處、cool 83 處**，而且兩區的六階**同階等亮**
 *   （最大偏差 0.726%）。這一段留在這裡是因為它記錄了「收斂」與「分層」
 *   其實是兩件事：第三十八輪把四個章節色收成**一張紙**，
 *   第四十輪才在同一張紙上做出**兩種光**。）
 *
 * ## 護欄
 *
 * `tests/uiSystem.test.mjs` 斷言：四個章節的 `headerBg`／`headerBorder`／`titleText`／
 * `subtitleText`／`pageBg` **各只有一個值**（`new Set(...).size === 1`）。
 * 也就是說「加回一個章節色」會直接 FAIL——不是靠人記得。
 *
 * 另外 H38-d 斷言：**這個檔在內的暖區四個檔不得出現 `cool-*` 面令牌**。
 * 冷區是戰鬥畫面的事，書的外框一直是暖的——你一直在書裡。
 */

/** 章節 id（順序＝封面上由左至右，測試也用它當迴圈來源） */
export const CHAPTER_IDS = ['workshop', 'character', 'combat', 'clocks'];

/**
 * 紙與墨。全部取自既有 hex（`scratch/ui-audit/hex_inventory.mjs` 可查），
 * 本輪**沒有新增任何一個 hex**——收斂顏色若順便加新色，等於把預算問題往後推。
 */
export const BOOK_CHROME = Object.freeze({
  // 頁面（最底層）
  pageBg: 'bg-[#fbf7ee] text-[#2c221e] selection:bg-[#e8dcc4] selection:text-[#3c2415]',
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
  exitBtn: 'border-[#a63d40]/40 bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] shadow-e1',
  exitIcon: 'text-[#f7f3e8]',
  iconWrapper: 'bg-[#f4ebd9] border-[#d6c7ab] text-[#3c2415]',
  toolBtn: 'border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#e8dcc4] text-[#3c2415] hover:text-[#2c221e]',
  toolIcon: 'text-[#3c2415]',

  // 頁尾
  footerBorder: 'border-[#d6c7ab]',
  footerBg: 'bg-[#f4ebd9]/60',
  footerNumber: 'text-[#3c2415]',
  footerText: 'text-[#6b5a4b]',
  footerButton: 'text-[#3c2415] hover:text-[#2c221e]',
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
