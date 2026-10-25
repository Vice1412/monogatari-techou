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
 * | `accent`／`accentDark`／`accentLight` | **保留** | 玩家自己選的那一色，封閉集合、每角色一色 → 真身份 |
 * | `badgeVariant` | **收斂成一個**（第三十三輪 §CI41） | 徽章的內容是 `Lv N`，身份由 `accent`（頭像環／頁籤／圖示）承載；徽章帶色是重複編碼，且六個鍵裡 `blue → cyan` 已失效（靜默變金）、`slate` 借用了「序」的通道 |
 * | `gradient` | **刪除** | 漸層宣告第二套顏色系統；三處使用全改成實心 accent |
 * | `buttonVariant`／`outlineButtonVariant` | **刪除** | 按鈕不該隨角色換色；呼叫端本來就寫了 `\|\| 'primary'`／`\|\| 'outline'` |
 *
 * ## 為什麼刪欄位是安全的
 *
 * 第十五輪刪 `buttonVariant`／`outlineButtonVariant` 時，全站 22 ＋ 8 處讀取
 * 每一處都寫成 `theme.buttonVariant || 'primary'`——**`||` 就是為了這種情況存在的**。
 *
 * 第三十七輪（§CI45）回頭量，發現這句話**只對了一半**：`||` 確實接住了刪掉的欄位，
 * 但接住之後沒有人回頭把讀取拿掉，於是那 30 處變成永遠走右邊的死三元；
 * 而同一句話也讓 241 處 `theme.accent || '#hex'` 看起來「很合理」——
 * 可是 `accent` 從來沒有缺席過，那些 hex 一次都沒有被取用。
 *
 * 判準改成一句話：
 *
 * > **`||` 的右邊如果一次都沒被取用，它就不是保險，是第二個答案。**
 *
 * 所以本輪把三種回退全部清掉（見 §CI45）：回退到 hex 的 248 處、
 * 讀了不存在欄位的 `accentSoft` 10 處、讀了已刪欄位的 33 處。
 * 現在的讀取是裸的：`theme.accent`。欄位真的不見時畫面會**空掉**，
 * 而不是安靜地換成一個看起來還算合理的棕色——空掉看得見，棕色看不見。
 *
 * ## 為什麼 `activeTabClass` 等四個欄位被刪掉了
 *
 * 第十五輪的理由是「它們是 className 字串，Tailwind 在原始碼文字上掃 class，
 * 動態組出來的字串它看不到，所以必須寫成字面值」——**這個理由本身是對的**，
 * 但它證明的是「這幾個欄位不能改成動態」，不是「這幾個欄位必須存在」。
 *
 * 第三十七輪逐字量：`activeTabClass`／`ringColor`／`headerIconColor`／`accentHover`
 * 在全站（含 `.jsx`、含註解）的讀取次數是 **0**。也就是說第十五輪把它們寫死之後，
 * 沒有人真的去用它——頁籤與圖示的身份色早就改走 `accent` 了。
 * 留著四個「只有一個值的欄位」，就是留著一份**看起來像在運作的設定**。
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

  // 墨兩階
  textDark: '#2c221e',
  textMuted: '#6b5a4b',
});

/** 一個主題 ＝ 共用的紙與墨 ＋ 自己的一族身份色 */
const theme = (identity) =>
  Object.freeze({
    ...SHARED,
    ...identity,
  });

export const CHARACTER_THEMES = {
  emerald: theme({
    id: 'emerald',
    name: '翡翠青',
    enName: 'Emerald Forest',
    accent: '#245c45',
    accentDark: '#133829',
    accentLight: '#e1eee7',
    badgeVariant: 'ink',
  }),
  amber: theme({
    id: 'amber',
    name: '琥珀棕',
    enName: 'Amber Parchment',
    accent: '#9c4d16',
    accentDark: '#693108',
    accentLight: '#f4ebd9',
    badgeVariant: 'ink',
  }),
  blue: theme({
    id: 'blue',
    name: '群青藍',
    enName: 'Slate Navy',
    accent: '#27527a',
    accentDark: '#17324c',
    accentLight: '#dde7f0',
    badgeVariant: 'ink',
  }),
  crimson: theme({
    id: 'crimson',
    name: '硃砂紅',
    enName: 'Crimson Wine',
    accent: '#8c2d36',
    accentDark: '#58171e',
    accentLight: '#f5e6e7',
    badgeVariant: 'ink',
  }),
  purple: theme({
    id: 'purple',
    name: '秘術紫',
    enName: 'Arcane Plum',
    accent: '#5e387c',
    accentDark: '#3a1f4f',
    accentLight: '#eee5f5',
    badgeVariant: 'ink',
  }),
  slate: theme({
    id: 'slate',
    name: '鐵石灰',
    enName: 'Iron Slate',
    accent: '#404a58',
    accentDark: '#20262f',
    accentLight: '#e6eaef',
    badgeVariant: 'ink',
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
