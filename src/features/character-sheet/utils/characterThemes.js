/**
 * Fabula Ultima Companion - 角色卡換色風格模板體系
 *
 * ## 第十五輪（2026-10-23）：一個色系 ＋ 一個身份色
 *
 * 這支檔案原本是**六套完整的顏色系統**：每個主題各帶頁面底、卡面、面板、頁首、
 * 邊框、兩階墨、晶片、頁籤、focus ring、漸層、按鈕變體——二十二個欄位全部不同。
 * 也就是說「換角色主題」＝**換一個 app 的顏色**，而 v5 的設計語言是「全程淺色 ·
 * 冷暖分層」：紙只有一種，墨只有一階梯。
 *
 * 收斂的判準沿用第十二輪那一條：
 *
 * > **身份是離散的、封閉的、沒有順序的 → 可以用色相；
 * > 量是連續的、有順序的 → 只能用深淺、粗細。**
 *
 * 逐欄位問「這是身份還是面」：
 *
 * | 欄位 | 判決 | 理由 |
 * |---|---|---|
 * | `appBg`／`sheetBg`／`cardBg`／`panelBg`／`subpanelBg`／`headerBg` | **收斂成一個** | 那是**紙**，不是身份。六種紙＝六個 app |
 * | `border`／`cardBorder`／`cardBorderHover` | **收斂成一個** | 邊界是結構，不是身份 |
 * | `textDark`／`textMuted` | **收斂成一個** | 墨是**量**（階梯），不是身份 |
 * | `chipBg` | **收斂成一個** | 晶片是面，文字才是內容 |
 * | `accent`／`accentHover`／`accentDark`／`accentLight` | **保留** | 玩家自己選的那一色，封閉集合、每角色一色 → 真身份 |
 * | `headerIconColor`／`ringColor`／`activeTabClass` | **保留**（跟著 accent） | 同一個身份色的小面積延伸 |
 * | `badgeVariant` | **收斂成一個**（第三十三輪 §CI41） | 徽章的內容是 `Lv N`，身份由 `accent`（頭像環／頁籤／圖示）承載；徽章帶色是重複編碼，且六個鍵裡 `blue → cyan` 已失效（靜默變金）、`slate` 借用了「序」的通道 |
 * | `gradient` | **刪除** | 漸層宣告第二套顏色系統；三處使用全改成實心 accent |
 * | `buttonVariant`／`outlineButtonVariant` | **刪除** | 按鈕不該隨角色換色；呼叫端本來就寫了 `\|\| 'primary'`／`\|\| 'outline'` |
 *
 * ## 為什麼刪欄位是安全的
 *
 * 全站 22 處讀 `theme.buttonVariant`、8 處讀 `theme.outlineButtonVariant`，
 * 每一處都寫成 `theme.buttonVariant || 'primary'`——**fallback 就是為了這種情況存在的**。
 * 唯一沒有 fallback 的是 `ChapterDevWarningModal.jsx`，而它讀的是自己檔內的常值物件。
 *
 * ## 為什麼 `activeTabClass` 等三個欄位仍然逐字寫死
 *
 * 它們是 **className 字串**，而 Tailwind 是在**原始碼文字**上掃 class 名稱的。
 * 用 `` `bg-[${t.accent}]` `` 動態組出來的字串，Tailwind 看不到 → class 不會被產生
 * → 樣式靜默失效。所以這三個欄位必須是字面值，哪怕它跟 `accent` 重複。
 */

import { STORAGE_KEYS } from '../../../data/keys';

/**
 * 紙與墨：六個主題共用同一組（本輪**沒有新增任何 hex**，全部取自 v5 既有色票）。
 *
 * 這不是「預設值」——它就是**唯一的值**。想改紙的顏色，改這裡；
 * 想給某個主題換紙的顏色，答案是不要。
 */
const SHARED = Object.freeze({
  // 面三階
  appBg: '#fbf7ee',
  sheetBg: '#fbf7ee',
  cardBg: '#fffdf9',
  panelBg: '#f4ebd9',
  subpanelBg: '#f4ebd9',
  headerBg: '#e8dcc4',

  /* 匯出底色（第三十五輪 §CI43 補上）。
     為什麼它是一個獨立欄位而不是「呼叫端自己寫 sheetBg」：
     NPC 工坊匯出 JPG 時要的是**紙**，而「紙是哪一個」這件事只能有一個答案。
     它與 `sheetBg` 同值（#fbf7ee），但語意不同——一個是畫面、一個是輸出的畫布。
     沒有新增任何 hex：它就是既有的紙。 */
  exportBg: '#fbf7ee',

  // 邊界
  border: '#d6c7ab',
  cardBorder: 'border-[#d6c7ab]',
  cardBorderHover: 'hover:border-[#3c2415]',

  // 墨兩階
  textDark: '#2c221e',
  textMuted: '#6b5a4b',

  // 晶片
  chipBg: 'bg-[#f4ebd9] text-[#2c221e] border-[#d6c7ab]',
});

/** 一個主題 ＝ 共用的紙與墨 ＋ 自己的一族身份色 */
const theme = (identity) =>
  Object.freeze({
    ...SHARED,
    borderHover: identity.accent,
    ...identity,
  });

export const CHARACTER_THEMES = {
  emerald: theme({
    id: 'emerald',
    name: '翡翠青',
    enName: 'Emerald Forest',
    accent: '#245c45',
    accentHover: '#1e4b39',
    accentDark: '#133829',
    accentLight: '#e1eee7',
    badgeVariant: 'ink',
    activeTabClass: 'bg-[#245c45] text-[#fffdf9]',
    ringColor: 'focus:ring-[#245c45]/40 focus:border-[#245c45]',
    headerIconColor: 'text-[#245c45]',
  }),
  amber: theme({
    id: 'amber',
    name: '琥珀棕',
    enName: 'Amber Parchment',
    accent: '#9c4d16',
    accentHover: '#833f12',
    accentDark: '#693108',
    accentLight: '#f4ebd9',
    badgeVariant: 'ink',
    activeTabClass: 'bg-[#9c4d16] text-[#fffdf9]',
    ringColor: 'focus:ring-[#9c4d16]/40 focus:border-[#9c4d16]',
    headerIconColor: 'text-[#9c4d16]',
  }),
  blue: theme({
    id: 'blue',
    name: '群青藍',
    enName: 'Slate Navy',
    accent: '#27527a',
    accentHover: '#214365',
    accentDark: '#17324c',
    accentLight: '#dde7f0',
    badgeVariant: 'ink',
    activeTabClass: 'bg-[#27527a] text-[#fffdf9]',
    ringColor: 'focus:ring-[#27527a]/40 focus:border-[#27527a]',
    headerIconColor: 'text-[#27527a]',
  }),
  crimson: theme({
    id: 'crimson',
    name: '硃砂紅',
    enName: 'Crimson Wine',
    accent: '#8c2d36',
    accentHover: '#76252d',
    accentDark: '#58171e',
    accentLight: '#f5e6e7',
    badgeVariant: 'ink',
    activeTabClass: 'bg-[#8c2d36] text-[#fffdf9]',
    ringColor: 'focus:ring-[#8c2d36]/40 focus:border-[#8c2d36]',
    headerIconColor: 'text-[#8c2d36]',
  }),
  purple: theme({
    id: 'purple',
    name: '秘術紫',
    enName: 'Arcane Plum',
    accent: '#5e387c',
    accentHover: '#4f2e67',
    accentDark: '#3a1f4f',
    accentLight: '#eee5f5',
    badgeVariant: 'ink',
    activeTabClass: 'bg-[#5e387c] text-[#fffdf9]',
    ringColor: 'focus:ring-[#5e387c]/40 focus:border-[#5e387c]',
    headerIconColor: 'text-[#5e387c]',
  }),
  slate: theme({
    id: 'slate',
    name: '鐵石灰',
    enName: 'Iron Slate',
    accent: '#404a58',
    accentHover: '#303844',
    accentDark: '#20262f',
    accentLight: '#e6eaef',
    badgeVariant: 'ink',
    activeTabClass: 'bg-[#404a58] text-[#fffdf9]',
    ringColor: 'focus:ring-[#404a58]/40 focus:border-[#404a58]',
    headerIconColor: 'text-[#404a58]',
  }),
};

/** 角色卡配色的儲存鍵。數值由 `src/data/keys.js` 的註冊表提供，避免兩處定義漂移。 */
export const STORAGE_THEME_KEY = STORAGE_KEYS.characterTheme;

export const getCharacterTheme = (themeId) => {
  if (!themeId || !CHARACTER_THEMES[themeId]) {
    return CHARACTER_THEMES.amber;
  }
  return CHARACTER_THEMES[themeId];
};
