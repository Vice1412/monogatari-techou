/**
 * 角色檔案 (Character Dossier)
 *
 * ## 為什麼要有這個模組
 *
 * 使用者（2026-10-30）對「代入感」下的定義是：
 *
 * > 「讓用戶感覺到這個界面就是記錄了角色的所有東西，在這邊操作就可以操控和查到
 * >  這個角色所有的內容，而非一個毫不相關的視窗。」
 *
 * 量測跑團面板對角色物件欄位的覆蓋率時，缺得最徹底的**不是數值**，是「這個人是誰」：
 *
 * | 欄位 | `CharacterPlayHUD.jsx` 出現次數 |
 * |---|---|
 * | `identity` / `origin` | 各 1（只印在肖像下方那一行） |
 * | `theme` | 3（其中兩次是主題色的 `theme.*`，不是角色的「主題」） |
 * | `gender` | **0** |
 * | `background` | **0** |
 *
 * `gender` 與 `background` 是玩家在創角時**親手寫下的東西**——原書 p.154 的
 * 第 8 步「描述你的角色並選擇名字和稱呼」，對應到本專案編輯器的**第 6 步
 * 「命名與背景」**（`CREATION_STEPS` 只有六格）。官方卡上它就印在姓名旁邊。
 * 它們在整張跑團面板上一次都沒出現過，於是玩家跑團時看到的是一組數字，
 * 而不是自己寫的那個角色。這正是「毫不相關的視窗」。
 *
 * ※ 同一個 `background` 在**名冊卡**（`CharacterCard.jsx`）上是畫得出來的。
 *   也就是說面板不是「資料拿不到」，是**這一頁沒有去拿**——差別很重要，
 *   因為前者要改資料層，後者只要把讀取端接上。
 *
 * ## 邊界：這裡只做「讀」，不做「寫」
 *
 * 使用者的另一條裁定是「一般操作還是不要寫太多東西」。所以這個模組**沒有 setter**、
 * **沒有任何輸入框的資料**：它只把已經存在角色身上的東西排成可讀的列。
 * 要改就去「構築與成長」第 8 步改——那裡才是寫入端。
 *
 * 這也是為什麼 `buildDossier` 對空值回傳的是**教學句**而不是空白：
 * 一片空白會讓玩家以為「這裡本來就沒有東西」，而一句「尚未寫下背景，在某某地方可以補」
 * 才回答了「那我該去哪裡」。
 */

/** 檔案的固定欄位與順序。順序照官方角色卡的閱讀順序：性別在最前（貼著姓名）。 */
export const DOSSIER_FIELDS = Object.freeze([
  { key: 'gender', label: '性別' },
  { key: 'origin', label: '出身' },
  { key: 'identity', label: '身份' },
  { key: 'theme', label: '主題' }
]);

/** 背景為空時的教學句。**不是**「無」——「無」只說明了現況，沒說明去哪裡補。 */
export const BACKGROUND_HINT =
  '尚未寫下背景。在「構築與成長」第 6 步「命名與背景」補上之後，這裡會原樣顯示。';

/** 摘要句裡背景最多留幾個字。超過就截斷並補「…」。 */
export const TEASER_BACKGROUND_MAX = 22;

/**
 * 只收「非空白的字串」。
 *
 * 為什麼不用 `String(v ?? '')`：`String(0)` 會得到 `'0'`，於是數字 0 會被當成
 * 「玩家寫了東西」。這在 `bondLink.js` 的 `normalizeBondWhy` 上真的發生過
 * （見 MEMORY §C「空值語意」）。性別／背景只可能是字串，不是字串就是「沒填」。
 */
const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * 把角色的「非數值身份」整理成可讀的列。
 *
 * @param {object|null|undefined} character
 * @returns {{
 *   rows: Array<{ key: string, label: string, value: string, empty: boolean }>,
 *   background: string,
 *   backgroundEmpty: boolean,
 *   teaser: string,
 *   hasStory: boolean,
 *   filledCount: number,
 *   totalCount: number
 * }}
 */
export const buildDossier = (character) => {
  const c = character && typeof character === 'object' ? character : {};

  const rows = DOSSIER_FIELDS.map(({ key, label }) => {
    const value = asText(c[key]);
    return { key, label, value, empty: value === '' };
  });

  const background = asText(c.background);
  const filledCount = rows.filter((row) => !row.empty).length + (background ? 1 : 0);
  const totalCount = rows.length + 1;

  return {
    rows,
    background,
    backgroundEmpty: background === '',
    teaser: buildDossierTeaser({ rows, background }),
    hasStory: filledCount > 0,
    filledCount,
    totalCount
  };
};

/**
 * 收合時顯示的那一句。
 *
 * 為什麼收合的區塊也要有字：一個「角色檔案 ▸」的空標題跟不存在沒有兩樣——
 * 玩家不會去點一個看起來沒有東西的抽屜。摘要句讓角色的故事**一直待在面板上**，
 * 即使從來沒有人展開它。
 *
 * 組成：前兩個有值的欄位（`男 · 帝國邊境`）＋ 背景第一行的前 22 個字。
 * 全部為空時回傳空字串，由呼叫端決定要顯示教學句還是什麼都不顯示。
 *
 * @param {{ rows?: Array, background?: string }} input
 * @returns {string}
 */
export const buildDossierTeaser = ({ rows, background } = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  const head = list
    .filter((row) => row && typeof row === 'object' && row.empty === false && typeof row.value === 'string')
    .slice(0, 2)
    .map((row) => row.value);

  const body = typeof background === 'string' ? background.trim() : '';
  // 背景只取第一行：玩家常常在背景裡分段落，摘要句不該把整段塞進來。
  const firstLine = body.split(/\r?\n/)[0] || '';
  const clipped = firstLine.length > TEASER_BACKGROUND_MAX
    ? `${firstLine.slice(0, TEASER_BACKGROUND_MAX)}…`
    : firstLine;

  return [...head, clipped].filter(Boolean).join(' · ');
};

/**
 * 給「背景」那一段用的顯示文字：空的時候是教學句，有值時原樣（不截斷、不改寫）。
 *
 * 為什麼不截斷：背景是玩家自己寫的散文，面板的職責是**原樣還原**。
 * 截斷會讓玩家以為系統吃掉了他寫的東西。
 */
export const backgroundDisplayText = (dossier) => {
  const bg = dossier && typeof dossier === 'object' ? dossier.background : '';
  return typeof bg === 'string' && bg.trim() !== '' ? bg : BACKGROUND_HINT;
};
