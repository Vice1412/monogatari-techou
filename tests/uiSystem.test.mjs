/**
 * 介面設計系統護欄（v5.1「層級優先 · 安靜」）
 *
 * 執行：npm run test:uiSystem
 *
 * ## 為什麼要有這支測試
 *
 * 2026-10-23 依《Refactoring UI》（Adam Wathan／Steve Schoger）稽核全站，發現三件事
 * **靠人眼永遠抓不住、而且會慢慢長回來**：
 *
 * 1. **三級文字色不合規**：`--ink-3`（`#8b95a3`）在紙色上只有 2.98:1，低於 WCAG AA 的 4.5:1。
 *    它是「最小最淡的那批字」的顏色——全站最難讀的東西剛好用了最不合規的顏色，
 *    而這種事在截圖上看起來「只是有點淡」。
 * 2. **封面的深底白字**：GM 早在 v5 就明確否決「深色＋白色字」，但封面一直是唯一例外，
 *    而且它是全站第一個畫面。改回來只需一次 commit，沒有任何東西會阻止它。
 * 3. **任意字級**：`text-[10px]`／`text-[11px]` 共一千多處，等於「沒有字級系統」。
 *    書中的規則是「先定階梯，再只用階梯」；但既有的密集表格不能一次性搬遷（會爆版），
 *    所以本關卡改成**預算制**：只能減少，不能增加。
 *
 * 這三項的共通點是「**退化不會報錯**」——畫面照樣渲染、建置照樣 exit 0。
 * 所以必須有東西在它退化時失敗。
 *
 * ## 刻意不做的事
 *
 * - **不驗證像素**（截圖比對在 CI 上不穩定）。驗的是**設計令牌的值**與**原始碼的類別字串**。
 * - **不要求全站零 `rounded-xl`**：`tailwind.config.js` 已把圓角階梯收斂成 2/3/4px，
 *   舊類別名會被設定層夾住，逐檔改名只是製造 diff。
 * - **不掃註解**：註解裡出現 `animate-pulse` 這種字是「說明規則」，不是「違反規則」。
 *   所有原始碼掃描都先剝掉註解。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  CHAPTER_IDS,
  CHAPTER_THEMES,
  BOOK_CHROME,
} from '../src/components/book/chapterChrome.js';
import {
  CHARACTER_THEMES,
  getCharacterTheme,
} from '../src/features/character-sheet/utils/characterThemes.js';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * 剝掉 `//` 行註解與 `/* *\/` 區塊註解（本專案大量用註解記錄設計理由，
 * 不剝掉的話「解釋某條規則」會被當成「違反某條規則」）。
 * 字串裡的 `//`（如 URL）會被誤剝——對本測試無害，因為被剝掉的內容不會被斷言。
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const count = (hay, needle) => hay.split(needle).length - 1;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  —— ${detail}` : ''}`);
};

console.log(`\n=== 介面設計系統護欄（v5.1） ===`);

/* ────────────────────────────────────────────────────────────────
   A. 設計令牌必須存在（型階梯／高度階梯／圓角階梯）
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[A] 設計令牌`);
const tailwind = read('tailwind.config.js');
for (const [name, needle] of [
  ['型階梯 t12', "t12: ['12px'"],
  ['型階梯 t14', "t14: ['14px'"],
  ['型階梯 t16', "t16: ['16px'"],
  ['型階梯 t20', "t20: ['20px'"],
  ['型階梯 t25', "t25: ['25px'"],
  ['型階梯 t31', "t31: ['31px'"],
  ['型階梯 t39', "t39: ['39px'"],
  ['高度階梯 e1', "e1: '0 1px"],
  ['高度階梯 e2', "e2: '0 2px"],
  ['高度階梯 e3', "e3: '0 4px"],
  ['圓角 DEFAULT 2px', "DEFAULT: '2px'"],
  ['圓角上限 book 4px', "book: '4px'"],
]) {
  check(name, tailwind.includes(needle));
}

/* ────────────────────────────────────────────────────────────────
   B. WCAG 對比（從 index.css 實際取值，不寫死）

   ⚠️ 這裡的配對表是**設計約束**，不是「所有組合都測」：
   `ui-1`／`ui-2` 是「面」（hover 底、內凹槽、邊框），不是「字面」。
   把三級墨放上去必然不合規——因為它們的明度差本來就只剩那一點。
   實測：`ink-3 #5f6a78` 在 `cool ui-2 #ccd6dd` 上只有 3.73:1，
   而連 `ink-2 #5c6878` 都只有 3.87:1。要在那上面合規，三級墨必須深到跟二級墨一樣，
   於是「三級層級」當場消失。**正解是不在那兩個面上放小字**，不是把顏色一路調深。
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[B] WCAG 對比（門檻 4.5:1）`);

const css = read('src/index.css');

const themeBlock = (theme) => {
  const start = css.indexOf(`[data-theme="${theme}"]`);
  if (start < 0) return '';
  return css.slice(start, css.indexOf('}', start));
};

const tokenOf = (block, name) => {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
};

const toRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

const AA = 4.5;

/** [標籤, 前景 token, 背景 token] —— 只列**實際會發生的組合** */
const PAIRS = [
  ['ink on paper', 'ink', 'paper'],
  ['ink on ui-0', 'ink', 'ui-0'],
  ['ink on ui-1', 'ink', 'ui-1'],
  ['ink on ui-2', 'ink', 'ui-2'],
  ['ink-2 on paper', 'ink-2', 'paper'],
  ['ink-2 on ui-0', 'ink-2', 'ui-0'],
  ['ink-3 on paper', 'ink-3', 'paper'],
  ['ink-3 on ui-0', 'ink-3', 'ui-0'],
  ['accent on paper', 'accent', 'paper'],
  ['accent on ui-0', 'accent', 'ui-0'],
];

for (const theme of ['cool', 'warm']) {
  const block = themeBlock(theme);
  const t = (name) => tokenOf(block, name);

  for (const [label, fgName, bgName] of PAIRS) {
    const fg = t(fgName);
    const bg = t(bgName);
    if (!fg || !bg) {
      check(`${theme}: ${label}`, false, 'token 缺失');
      continue;
    }
    const ratio = contrast(fg, bg);
    check(`${theme}: ${label}`, ratio >= AA, `${ratio.toFixed(2)}:1（${fg} on ${bg}）`);
  }
}

// 主要動作：白字配 accent 底色
const warmBlock = themeBlock('warm');
const accentToken = tokenOf(warmBlock, 'accent');
if (accentToken) {
  const ratio = contrast('#ffffff', accentToken);
  check('白字 on accent（主要動作按鈕）', ratio >= AA, `${ratio.toFixed(2)}:1`);
} else {
  check('白字 on accent（主要動作按鈕）', false, 'accent token 缺失');
}

/* ────────────────────────────────────────────────────────────────
   C. 外殼檔案禁用樣式（封面／章節標頭）
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[C] 外殼檔案禁用樣式`);

const SHELL_FILES = [
  'src/components/book/BookCoverHub.jsx',
  'src/components/book/ChapterHeader.jsx',
];

/**
 * 每一條都對應一次真實的稽核發現：
 * - `animate-pulse`：封面常駐呼吸的狀態點（沒有「正在發生的事」，動態只是假載入感）
 * - `blur-xl/2xl/3xl`：裝飾性光暈（`backdrop-blur-md` 的霧面標頭不算，那是功能性）
 * - `shadow-2xl`：誇張陰影（v5 的層級靠冷暖，不靠陰影）——2026-10-23 已全數換成 `shadow-e3`，天花板歸零
 * - `bg-gradient-to`：漸層填色（v5 硬邊）
 * - `hover:scale-`：彈性動效（120–200ms 色彩過渡才是本專案語彙）
 * - `rounded-lg/xl/2xl`：超出圓角階梯的類別名（改用 `rounded-ui`／`rounded-book`）
 * - `font-mono`：中文標籤配等寬字（等寬字是給數值與程式碼的）
 * - `book-cover-leather`／`text-sky-100`：GM 已否決的深藍皮革＋淺藍白字封面
 */
const BANNED = [
  ['animate-pulse', /animate-pulse/],
  ['blur-xl/2xl/3xl', /blur-(?:xl|2xl|3xl)/],
  ['shadow-2xl', /shadow-2xl/],
  ['bg-gradient-to', /bg-gradient-to/],
  ['hover:scale-', /hover:scale-/],
  ['rounded-lg/xl/2xl', /rounded-(?:lg|xl|2xl)/],
  ['font-mono', /font-mono/],
  ['text-sky-100 淺藍白字', /text-sky-100/],
  ['book-cover-leather', /book-cover-leather/],
];

for (const rel of SHELL_FILES) {
  const src = stripComments(read(rel));
  const hits = BANNED.filter(([, re]) => re.test(src)).map(([name]) => name);
  check(`${rel} 無禁用樣式`, hits.length === 0, hits.length ? `命中 ${hits.join('、')}` : '');
}

/* ────────────────────────────────────────────────────────────────
   C2. 章節外框：一本書只有一種裝訂（2026-10-23 第八輪）
   ────────────────────────────────────────────────────────────────

   背景：四個章節原本各帶一套顏色（工坊羊皮紙／角色薄荷／戰鬥粉／命刻天藍），
   四個色相跨 316°，而全站的 accent 只有一個。翻一章像換一個 app。

   GM 2026-10-23：「章節顏色並非定性，可以收斂。」

   為什麼用「集合大小」而不是「比對字串」：比對字串只能擋住「改回舊值」，
   擋不住「換一個新的第四色」。集合大小擋的是**這件事本身**——
   四章的外框值允許是任何一個值，但必須是**同一個**。
   ──────────────────────────────────────────────────────────────── */
console.log('\n[C2] 章節外框：一本書只有一種裝訂');

check(
  '四個章節共用同一張外框表',
  CHAPTER_IDS.length === 4 && Object.keys(CHAPTER_THEMES).length === 4,
  '章節 ' + CHAPTER_IDS.length + ' 個、外框表 ' + Object.keys(CHAPTER_THEMES).length + ' 筆'
);

for (const key of ['pageBg', 'headerBg', 'headerBorder', 'titleText', 'subtitleText', 'divider', 'toolBtn']) {
  const uniq = new Set(CHAPTER_IDS.map((id) => CHAPTER_THEMES[id][key]));
  check(
    '四章共用同一個 ' + key,
    uniq.size === 1,
    uniq.size === 1 ? '' : '出現 ' + uniq.size + ' 種：' + [...uniq].join(' / ')
  );
}

check(
  '外框表的值就是 BOOK_CHROME 的值（沒有手寫覆寫）',
  CHAPTER_IDS.every((id) => CHAPTER_THEMES[id].headerBg === BOOK_CHROME.headerBg),
  CHAPTER_IDS.every((id) => CHAPTER_THEMES[id].headerBg === BOOK_CHROME.headerBg) ? '' : '有章節自己寫了 headerBg'
);

/* 原始碼掃描：外殼檔案不得再出現「章節色相」。
   為什麼要這一條：外框表可以是乾淨的，而元件裡另外寫死一個
   bg-emerald-50——那仍然是章節色，只是不在表裡。 */
const CHROME_FILES = [
  'src/App.jsx',
  'src/components/book/ChapterHeader.jsx',
  'src/components/book/BookPageFlipOverlay.jsx',
  'src/components/book/BookCoverHub.jsx',
  'src/components/book/ChapterDevWarningModal.jsx',
];
const CHAPTER_HUE = /(?:emerald|rose|sky|cyan|teal|indigo|violet)-\d{2,3}/;

for (const rel of CHROME_FILES) {
  const src = stripComments(read(rel));
  const hits = [...new Set(src.match(new RegExp(CHAPTER_HUE.source, 'g')) || [])];
  check(rel + ' 無章節色相', hits.length === 0, hits.length ? '命中 ' + hits.join('、') : '');
}

/* 預設皮膚：NPC 工坊的介面本來就固定琥珀羊皮紙，
   角色卡若預設翡翠青，兩個「讀」的章節會像兩本書。
   六種皮膚不刪，選色器照舊——這一條只管「沒選過的人看到什麼」。 */
check(
  '角色卡預設皮膚是琥珀棕（與 NPC 工坊同一張紙）',
  getCharacterTheme().id === 'amber',
  '實際 ' + getCharacterTheme().id
);

check(
  '六種角色卡皮膚一個都沒少（選色器仍可選）',
  Object.keys(CHARACTER_THEMES).length === 6 && getCharacterTheme('emerald').id === 'emerald',
  '實際 ' + Object.keys(CHARACTER_THEMES).length + ' 種'
);

/* ────────────────────────────────────────────────────────────────
   D. 封面結構：四卷、每卷有說明、只有一個主要動作
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[D] 封面結構`);
const coverSrc = stripComments(read('src/components/book/BookCoverHub.jsx'));

check(
  '封面用單一迴圈渲染章節卡（不複製貼上四份）',
  count(coverSrc, 'data-chapter-card={chap.id}') === 1,
  `實際 ${count(coverSrc, 'data-chapter-card={chap.id}')} 處`
);

for (const id of ['character', 'workshop', 'combat', 'clocks']) {
  check(`章節資料存在：${id}`, coverSrc.includes(`id: '${id}'`));
}

// 每張卡都要有說明文字：只有標題的卡片等於叫使用者猜裡面有什麼
const descs = [...coverSrc.matchAll(/desc:\s*'([^']+)'/g)].map((m) => m[1]);
check(
  '四張卡都有說明文字（每則 ≥ 8 字）',
  descs.length === 4 && descs.every((d) => d.length >= 8),
  `實際 ${descs.length} 則${descs.length ? `，最短 ${Math.min(...descs.map((d) => d.length))} 字` : ''}`
);

// 主要動作唯一：一屏裡「白字實心強調色」的按鈕只能有一個
check(
  '封面只有一個主要動作（白字實心 accent）',
  count(coverSrc, 'text-white') === 1,
  `實際 ${count(coverSrc, 'text-white')} 處`
);

check('封面不再使用固定高度卡片', !coverSrc.includes('min-h-[135px]'));

/* ────────────────────────────────────────────────────────────────
   E. NPC 工坊空狀態：單一 CTA、不指路到已隱藏的按鈕
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[E] NPC 工坊空狀態`);
const workshopSrc = stripComments(read('src/features/npc-workshop/NPCWorkshop.jsx'));

// 空狀態 CTA ＋ 工具列建立鈕 ＝ 恰好兩個入口（檔案庫為空時只會出現一個）
check(
  '建立入口恰好兩處（空狀態／工具列）',
  count(workshopSrc, 'onClick={createNewNPC}') === 2,
  `實際 ${count(workshopSrc, 'onClick={createNewNPC}')} 處`
);

// 工具列那顆必須被 `library.length > 0` 包住：檔案庫為空時，主要動作只能有一個
const createIdxs = [...workshopSrc.matchAll(/onClick=\{createNewNPC\}/g)].map((m) => m.index);
const guarded = createIdxs.some((idx) => workshopSrc.slice(Math.max(0, idx - 400), idx).includes('library.length > 0 &&'));
check('檔案庫為空時工具列不顯示建立鈕', guarded, `建立鈕位置 ${createIdxs.join('、')}`);

// 空狀態區塊：不得再指路到已隱藏的按鈕，也不得有裝飾性光暈
const emptyStart = workshopSrc.indexOf('檔案庫目前空空如也');
const emptySlice = emptyStart > 0 ? workshopSrc.slice(Math.max(0, emptyStart - 600), emptyStart + 900) : '';
check('空狀態區塊存在', emptySlice.length > 0);
check('空狀態不再指路到「右上方按鈕」', emptySlice.length > 0 && !emptySlice.includes('點擊右上方按鈕'));
check('空狀態無裝飾性光暈', emptySlice.length > 0 && !/blur-/.test(emptySlice));

/* ────────────────────────────────────────────────────────────────
   F. 技術債預算（只能減少，不能增加）
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[F] 技術債預算`);

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (['.js', '.jsx'].includes(path.extname(entry.name))) out.push(full);
  }
  return out;
};

const allSrc = walk(path.join(ROOT, 'src'))
  .map((f) => stripComments(fs.readFileSync(f, 'utf8')))
  .join('\n');

/**
 * 天花板＝ 2026-10-23 稽核當天量到的數字。**只能往下調，不能往上調。**
 * 要新增任意字級時，先問「這七級裡哪一級不夠用」——答案通常是夠用。
 */
const BUDGET = [
  // 第七輪：469 → 426、563 → 495。109 處「中文句子」（`<p>` 段落）抬到 `text-t12`。
  // 判準不是「1,030 處」那個總數，是普查分出來的 **SENTENCE 113 處**——總數是噪音。
  // 第十二輪：426 → 424、491 → 480、12 → 10。屬性矩陣 15 處任意字級抬到型階梯
  // （托盤標頭、骰面、已分配計數、幽靈插槽標籤、說明模態）——全部在 12px 以上仍然讀得懂，
  // 而 176px 的窄欄正是「任意值」最容易失控的地方。
  ['text-[10px]', 424],
  ['text-[11px]', 480],
  // 第六輪：34 → 18 → 13。21 處已抬到型階梯地板 `text-t12`（12px）：
  //   前 16 處是「原始碼看得到中文」的標籤／句子；
  //   後 5 處是 `{term.label}` 這種**中文在資料層**的標籤（原始碼裡一個中文字都沒有，
  //   所以任何以「原始碼含中文」為判準的掃描都抓不到，只能逐條列名——見 §10.4）。
  // 剩下的 13 處全是等寬拉丁／數字晶片（`d6`、`+3`、`≤70`、屬性英文名），
  // 密度是刻意的，且改動會擠壞 `max-w-[54px]` 這類固定寬度——留待逐處量。天花板跟著降到 13，不准回填。
  ['text-[9px]', 10],
  // 第九輪：26 → 4。判準不是「這個狀態重不重要」，而是「**它會不會自己停**」——
  // Tailwind 的 animate-pulse 永遠 infinite，所以常駐狀態（危機徽章、待行動、連線中、
  // 狀態圓點、超額警告、空白插槽）上的脈動最後都變成背景雜訊。
  // 2 ＝ 真的短暫互動（翻頁星芒、拖曳中的「放開收回」）。
  // 註：`allSrc` 已剝掉註解，所以文件說明不會被算進來。
  ['animate-pulse', 2],
  ['shadow-2xl', 0],
  ['font-mono', 481],
  // 第二十五輪重量：51（舊值 62 是沒有重量的歷史數字）。上限跟著降到當下量測值。
  ['hover:scale-', 51],
  // 第十輪：42 → 17。漸層不是「好不好看」，是**有沒有宣告第二套顏色系統**：
  // 每條色相漸層至少宣告兩個色相，而 v5 的規則是「一個強調色 ＋ 一條墨階梯」。
  // 留的 17 次全都有功能：HP／MP／IP 填充條、角色卡主題色條、四屬性的骰面、
  // 羊皮紙髮絲線、hover 光掃（後兩者無色相）。
  // 第十二輪：17 → 13。屬性矩陣的四條骰階漸層移除（骰階是量，量用深淺說，不用色相說）。
  // 留的 13 次全都有功能：HP／MP／IP 填充條、角色卡主題色條、羊皮紙髮絲線、hover 光掃。
  ['bg-gradient', 13],
];

for (const [needle, ceiling] of BUDGET) {
  const n = count(allSrc, needle);
  check(`預算：${needle}`, n <= ceiling, `${n} / 上限 ${ceiling}`);
}

/**
 * 脈動只准出現在「會自己停」的地方（第九輪）。
 *
 * 專案早在 `CombatantCard.jsx:163` 就裁定「待行動的無限脈動＝裝飾性動態，v5 禁用」，
 * 但那是**一個檔案裡的一個註解**，所以另外 25 處照樣脈動。
 * 這條把它變成全站規則。註解不算——`stripComments()` 已經先剝掉，
 * 「講到這個類別名」不會被誤判成違規。
 *
 * 第九輪先收到 2 處（翻頁星芒、拖曳提示），第十三輪兩處都判掉：
 * 翻頁星芒的脈動是**無限**的（動畫本身 300 ms 就結束，脈動卻一直呼吸），
 * 拖曳提示是**文字**，強調色＋粗體已經足夠，不需要再讓它呼吸。
 * 天花板 26 → 2 → **0**，只能往下。
 */
const pulseFiles = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const hits = (stripComments(fs.readFileSync(abs, 'utf8')).match(/\banimate-pulse\b/g) || []).length;
  if (hits) pulseFiles.push([path.relative(ROOT, abs).replace(/\\/g, '/'), hits]);
}
const pulseTotal = pulseFiles.reduce((sum, [, n]) => sum + n, 0);
check(
  '全站零脈動（無限動態一律禁用）',
  pulseTotal === 0,
  `實際 ${pulseTotal} 處${pulseFiles.length ? `：${pulseFiles.map(([f, n]) => `${f}×${n}`).join('、')}` : ''}`
);

/**
 * 三層噪音：同一個元素用三種方式說「我是一塊」（第九輪）。
 *
 * `border` ＋ `shadow-2xs|xs|sm` ＋ `bg-*` 同時出現時，邊界被宣告三次，
 * 而其中兩次互相削弱——淡陰影貼在有邊框的卡片外側，只會在邊框外圍加一圈灰霧。
 * 判準（《Refactoring UI》）：**一個元素只需要一種方式說「我是一塊」**：
 * 有邊框就不需要陰影（平面），有陰影就不需要邊框（浮起）。
 *
 * 不動的三類：`shadow-inner`（內凹槽，不是抬升）、`shadow-md|lg|xl|e3`（浮層，
 * 抬升就是它的語意，而且浮層通常沒有邊框）、`border-transparent|0|none`（那裡陰影是唯一邊界）。
 * 天花板 267 → 17 → **0**（第十三輪清完）。只能往下。
 *
 * 第十三輪的教訓：上限停在 17 的那段時間，有 1 個站點是「看不到」而不是「沒有」——
 * `drop_dark` 把跨行的 className 收成一行之後，`shadow-xs` 與 `bg-*` 才落到同一行。
 * **行掃描的預算會低估噪音，因為噪音會躲進換行。**
 */
const NOISE_LOW = /\bshadow-(2xs|xs|sm)\b/;
const NOISE_BORDER = /\bborder\b/;
const NOISE_BG = /\bbg-(?!gradient|none|transparent|opacity)/;
const noiseSites = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  stripComments(fs.readFileSync(abs, 'utf8'))
    .split('\n')
    .forEach((line, i) => {
      if (NOISE_LOW.test(line) && NOISE_BORDER.test(line) && NOISE_BG.test(line)) {
        noiseSites.push(`${path.relative(ROOT, abs).replace(/\\/g, '/')}:${i + 1}`);
      }
    });
}
check('三層噪音（邊框＋低陰影＋底色）', noiseSites.length === 0, `${noiseSites.length} 處（上限 0）`);

/**
 * 漸層只准出現在「有功能」的地方（第十輪）。
 *
 * 同伴面板底原本每位同伴一套色相漸層（紫／綠／青／藍／橙／琥珀）＝**七套顏色系統**，
 * 跟第八輪的四個章節色是同一種病，只是分散在七個檔案裡、更不容易被看見。
 * 天花板（17 次）擋不住「在別處新增一條、同時刪掉舊的一條」，所以這裡再擋**檔案集合**。
 *
 * 第十四輪：`CharacterPlayHUD.jsx` 的四條資源條（HP／MP／IP）不再用漸層——
 * HP 是**量**（剩下多少），量用長度說；危急是**狀態**，用強調色說。
 * 於是這一條從「檔案白名單」升級成「檔案＋次數」的精確表：
 * 白名單擋得住「多一個檔案」，擋不住「同一個檔案多一條」。
 *
 * 第十五輪：全站收到**一檔兩條**。`JRPGModal` 的頂線、`CharacterCard` 與
 * `CharacterSheet` 的主題色條全部改成實心 accent（角色主題只剩一個身份色）；
 * `CharacterSheet` 的 HP／MP 填充條跟第十四輪的跑團面板同一個判準收成實心。
 * 剩下的兩條在 `NPCWorkshop.jsx`，**都無色相**：
 * 一條是 `transparent → #d6c7ab → transparent` 的髮絲分隔線，
 * 一條是 `white/20` 的 hover 光掃（`group-hover:` 才動，離開就停）。
 * 判準是第十輪那句「**它有沒有在宣告第二套顏色系統**」——這兩條沒有。
 */
const GRAD_OK = new Map([
  ['src/features/npc-workshop/NPCWorkshop.jsx', 2], // 羊皮紙髮絲線 ＋ hover 光掃（皆無色相）
]);
const gradFiles = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const hits = (stripComments(fs.readFileSync(abs, 'utf8')).match(/bg-gradient/g) || []).length;
  if (hits) gradFiles.push([path.relative(ROOT, abs).replace(/\\/g, '/'), hits]);
}
const gradWrong = [
  ...gradFiles.filter(([f, n]) => GRAD_OK.get(f) !== n).map(([f, n]) => `${f}×${n}（應為 ${GRAD_OK.get(f) ?? 0}）`),
  ...[...GRAD_OK.keys()].filter((f) => !gradFiles.some(([g]) => g === f)).map((f) => `${f} 已無漸層（應從表上移除）`),
];
check(
  '漸層只存在於有功能的那幾支檔案，且次數固定',
  gradWrong.length === 0,
  gradWrong.length ? gradWrong.join('、') : `${gradFiles.length} 檔／${gradFiles.reduce((a, [, n]) => a + n, 0)} 條`,
);

/**
 * 骰階是「量」，不是「色相」（第十二輪）。
 *
 * 屬性矩陣的四個骰階原本是三套色相漸層（青／琥珀／玫瑰）配近黑深字與發光環，
 * 第十輪把它留了下來，理由寫的是「一組封閉的四色對應」。**那句話是錯的**：
 * d12 與 d10 是**同一個青色**，所以色相在那裡不承載任何資訊，它承載的只是飽和度。
 *
 * 判準：
 *   - **身份**（DEX／INS／MIG／WLP）可以用色相，而且是封閉集合；
 *   - **量**（同一個屬性的強弱）要用深淺、粗細、大小，因為量是連續的，色相是離散的。
 * 兩者混用時，畫面上就有兩套互相競爭的色系，而使用者分不出哪一套在講什麼。
 *
 * 收斂後四階只有一件事在變——離「實心強調色」有多遠；而**實心強調色只有一個**。
 * 這條同時擋住「再加一個色相」與「再加一個發光環」。
 */
const ATTR_REL = 'src/features/character-sheet/components/AttributeMatrixPicker.jsx';
const attrSrc = stripComments(fs.readFileSync(path.join(ROOT, ATTR_REL), 'utf8'));

const PALETTE_HUE = /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/;
const paletteHits = [...new Set(attrSrc.match(new RegExp(PALETTE_HUE.source, 'g')) || [])];
check('屬性矩陣不再借用 Tailwind 調色盤', paletteHits.length === 0, paletteHits.join('、'));

const whiteBlack = [...new Set(attrSrc.match(/\b(?:bg|text|border|ring)-(?:white|black)\b/g) || [])];
check('屬性矩陣沒有純白／純黑', whiteBlack.length === 0, whiteBlack.join('、'));

// 書裡的令牌：羊皮紙四階 ＋ 墨階梯四階 ＋ 強調色 ＋ 深棕。新顏色要進這張表，得先改這張表。
const BOOK_HEX = new Set([
  '#fbf7ee', '#f4ebd9', '#f5efdf', '#fffdf9', '#d6c7ab',
  '#2c221e', '#3c2415', '#6b5a4b', '#7c6a58',
  '#a63d40', '#8b5e34', '#78350f', '#f7f3e8',
]);
const attrHexes = [...new Set(attrSrc.match(/#[0-9a-fA-F]{6}/g) || [])].map((h) => h.toLowerCase());
const strayHexes = attrHexes.filter((h) => !BOOK_HEX.has(h));
check('屬性矩陣只用書裡的令牌', strayHexes.length === 0, strayHexes.join('、') || `${attrHexes.length} 色全數在冊`);

const tierBlock = attrSrc.slice(attrSrc.indexOf('export const getDiceColorConfig'));
const tierBgs = [...tierBlock.matchAll(/bgClass:\s*'([^']+)'/g)].map((m) => m[1]);
check('骰階四階都給得出底色', tierBgs.length === 4, `實際 ${tierBgs.length} 階`);
// 四階、三種底色：這正是「階梯」的形狀——差異來自描邊與墨色，不是來自第四個色相。
// 每一階都必須是**單一實心 hex**（`bg-[#rrggbb]`）；出現 `from-*`／`to-*` 就代表又回到漸層。
const solidTier = /^bg-\[#[0-9a-f]{6}\]$/;
check(
  '骰階是階梯不是色相',
  new Set(tierBgs).size === 3 && tierBgs.every((b) => solidTier.test(b)),
  tierBgs.join('、'),
);
check('骰階不再用漸層', !tierBlock.includes('bg-gradient'), tierBlock.includes('bg-gradient') ? '仍有漸層' : '無漸層');
check(
  '最強階是唯一實心強調色',
  tierBgs.filter((b) => b.includes('#a63d40')).length === 1,
  tierBgs.filter((b) => b.includes('#a63d40')).join('、'),
);
check('骰階不再發光', (tierBlock.match(/glow:\s*''/g) || []).length === 4, tierBlock.match(/glow:\s*'[^']*'/g)?.join('、') || '四階 glow 全空');

// 托盤（176px 窄欄）原本是一行手抄的灰字空狀態——第十一輪掃不到它，因為它沒說「空」，
// 它說的是「先從上方選一組起始陣列」。窄欄不是另抄一份樣板的理由，`dense` 就是為此存在。
check(
  '托盤的空狀態也走同一個元件',
  attrSrc.includes('kind="attribute-dice-tray"') && /<EmptyState[\s\S]{0,220}?dense/.test(attrSrc),
  attrSrc.includes('kind="attribute-dice-tray"') ? '缺 dense' : '未走 EmptyState',
);

/**
 * 同一條判準的另一半：**身份必須一對一**。
 *
 * 骰階擋的是「用色相表達量」；這裡擋的是反過來的事——**身份共用色相**。
 * DEX／INS／MIG／WLP 是四個封閉的身份（顏色綁在 `sourcebookConfig` 的 `ATTRIBUTE_COLORS`，
 * 角色卡／NPC 工坊／旅人夥伴四個畫面共用同一份——第二十一輪之前有五份，且互相不一致），
 * 所以四個屬性必須拿到四個**不同**的色相；兩個屬性共用一個色相，等於那個顏色
 * 同時代表兩件事，使用者只能靠讀字分辨——那顏色就是純裝飾。
 *
 * 這也是 §CI20 判準的完整形狀：
 *   量 → 深淺（可以共用底色，因為差別在明度）
 *   身份 → 色相（不可以共用色相，因為差別不在明度）
 */
const STAT_REL = 'src/components/ui/StatBadge.jsx';
const statSrc = stripComments(fs.readFileSync(path.join(ROOT, STAT_REL), 'utf8'));
const statBlock = statSrc.slice(statSrc.indexOf('const STAT_CONFIG'), statSrc.indexOf('const VALID_TIERS'));
const statKeys = [...statBlock.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map((m) => m[1]);
check('屬性色只有四個身份', statKeys.length === 4 && ['dex', 'ins', 'mig', 'wlp'].every((k) => statKeys.includes(k)), statKeys.join('、'));
// 第二十一輪：顏色本身搬到 `ATTRIBUTE_COLORS`（值的一對一在 H15 區段驗），
// 這裡只驗「四個身份都從那張表拿」。
// 舊形狀是「四個 Tailwind 色相名兩兩不同」——顏色改成登記色之後，那個 regex 抓到 0 個，
// `new Set([]).size === 4` 是 false，於是它紅，而且是**假紅**（程式完全正確）。
// **例外的宿主消失時，例外必須在同一次改動裡換掉形狀**（第十九輪）。
const statRefs = [...statBlock.matchAll(/color:\s*ATTRIBUTE_COLORS\.([a-z]+)/g)].map((m) => m[1]);
check(
  'StatBadge 的四個身份都引用 ATTRIBUTE_COLORS',
  statRefs.length === 4 && ['dex', 'ins', 'mig', 'wlp'].every((k) => statRefs.includes(k)),
  statRefs.length ? statRefs.join('、') : '一個都沒引用（顏色被寫死在別處）'
);

// 命刻的三種主題是**種類**（不是量）：封閉三集 ＋ 明確 fallback。
// 封閉集合若沒有 fallback，新增第四種時會靜默渲染成 undefined 底色。
// 命刻的六種主題是**身份**（哪一顆命刻），所以是封閉集合 ＋ 一對一色相 ＋ 明確 fallback。
// 這條護欄第一次跑就抓到第七項 `emerald`：它的 `id` 是 `'green'`、色碼與 `green` 完全相同，
// 等於下拉選單裡有兩個同名同色的「翡翠綠」。封閉集合會壞，通常不是「多了一個」，
// 是「多了一個跟別人一樣的」。
const CLOCK_REL = 'src/components/ui/ClockTracker.jsx';
const clockSrc = stripComments(fs.readFileSync(path.join(ROOT, CLOCK_REL), 'utf8'));
const cStart = clockSrc.indexOf('CLOCK_THEMES');
const clockBlock = clockSrc.slice(cStart, clockSrc.indexOf('};', cStart));
const clockKeys = [...clockBlock.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map((m) => m[1]);
check('命刻主題是封閉六集', clockKeys.length === 6, clockKeys.join('、'));
const clockIds = [...clockBlock.matchAll(/id:\s*'([a-z]+)'/g)].map((m) => m[1]);
check('命刻主題的 id 等於鍵', clockIds.length === clockKeys.length && clockKeys.every((k, i) => clockIds[i] === k), clockKeys.map((k, i) => `${k}→${clockIds[i]}`).join('、'));
const clockFills = [...clockBlock.matchAll(/fill:\s*'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1].toLowerCase());
// 比的是「色相數 == 主題數」，不是「色相數 == 6」——寫死 6 的話，多加一個重複項仍然會過
check('命刻色相一對一', clockFills.length === clockKeys.length && new Set(clockFills).size === clockKeys.length, `${clockKeys.length} 鍵／${new Set(clockFills).size} 色`);
const clockFallback = /CLOCK_THEMES\[theme\]\s*\|\|\s*CLOCK_THEMES\[CLOCK_THEME_ALIAS\[theme\]\]\s*\|\|\s*CLOCK_THEMES\.amber/.test(clockSrc);
check('命刻主題有別名與 fallback', clockFallback, clockFallback ? '主題 → 別名 → amber' : '找不到三段 fallback');

/**
 * 空狀態只准有一種長相（第十一輪）。
 *
 * 文法四件事：虛線框 ＋ `gi` 敘事圖示 ＋ 粗體標題 ＋ 一句教學（第五件選用：最多一個 CTA）。
 * 這句話原本只寫在 docs 裡，於是每個畫面各自抄一份樣板：抄對的看起來一致，抄錯的就變成
 * 一行 `font-mono` 灰字（戰鬥追蹤）、一整塊靛藍（NPC 工坊自訂能力）、或 `slate`／`emerald`
 * 色系（角色 HUD、花匠）。**寫成元件之後，「抄錯」不再是選項。**
 *
 * 這條護欄問的是：**畫面文字裡講「空」的檔案，有沒有走 `EmptyState`？**
 * 例外要寫進 `EMPTY_HAND` 並附理由——白名單不附理由，下一個人會以為那是歷史遺留。
 */
const EMPTY_WORDS = /尚無|還沒有|目前沒有|空空如也/;
const EMPTY_SKIP = /<option|alert\(|showToast\(|message:|reason:|^\s*(\*|\/\/|\{\/\*)/;
const EMPTY_HAND = [
  [
    'src/features/character-sheet/components/CharacterEditor.jsx',
    '走 customTheme 主題物件（theme.cardBg／theme.accent），換成 EmptyState 會把使用者選的皮膚換掉',
  ],
];
const emptyFiles = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  if (!abs.endsWith('.jsx')) continue;
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  const hit = src.split('\n').some((line) => EMPTY_WORDS.test(line) && !EMPTY_SKIP.test(line));
  if (!hit) continue;
  emptyFiles.push([path.relative(ROOT, abs).replace(/\\/g, '/'), /from '[^']*EmptyState'/.test(src)]);
}
const bareEmpty = emptyFiles
  .filter(([rel, uses]) => !uses && !EMPTY_HAND.some(([f]) => f === rel))
  .map(([rel]) => rel);
check('講「空」的畫面都走 EmptyState', bareEmpty.length === 0, bareEmpty.join('、') || `${emptyFiles.length} 支全數合規`);
check('EmptyState 例外清單只剩主題化的那一個', EMPTY_HAND.length === 1, `${EMPTY_HAND.length} 筆`);

// 元件的文法本體：少一件，`EmptyState` 就只是另一個樣板
const emptyStateSrc = fs.readFileSync(path.join(ROOT, 'src/components/ui/EmptyState.jsx'), 'utf8');
const GRAMMAR = ['border-dashed', 'data-empty-state', '{title}', '{teach}', 'text-[#2c221e]', 'text-[#6b5a4b]'];
const grammarMissing = GRAMMAR.filter((k) => !emptyStateSrc.includes(k));
check(
  'EmptyState 保留空狀態文法',
  grammarMissing.length === 0,
  grammarMissing.length ? `缺：${grammarMissing.join('、')}` : '四件事齊備',
);

// 每一次呼叫都要給齊 icon／title／teach——`<EmptyState title="…" />` 就是下一個「只說空」的畫面
const badCalls = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  if (!abs.endsWith('.jsx') || abs.endsWith('ui/EmptyState.jsx')) continue;
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  const re = /<EmptyState\b([\s\S]*?)\/>/g;
  let m;
  while ((m = re.exec(src))) {
    const lack = ['icon=', 'title=', 'teach='].filter((k) => !m[1].includes(k));
    if (lack.length) badCalls.push(`${path.relative(ROOT, abs).replace(/\\/g, '/')} 缺 ${lack.join('、')}`);
  }
}
check('每次呼叫 EmptyState 都給齊 icon／title／teach', badCalls.length === 0, badCalls.join('；') || '全部齊備');

// 新階梯要真的被用：全部沿用舊寫法的話，型階梯只是 config 裡的一段裝飾
const scaleUses = ['text-t12', 'text-t14', 'text-t16', 'text-t20', 'text-t25', 'text-t31', 'text-t39']
  .reduce((sum, c) => sum + count(allSrc, c), 0);
check('型階梯實際被採用（≥ 20 處）', scaleUses >= 20, `${scaleUses} 處`);

/**
 * 9px 不得用於中文（第六輪）。
 *
 * 為什麼要單獨一條：`text-[9px]` 的**數量**天花板擋不住「9px 用在中文上」——
 * 只要有人把一個拉丁晶片改成中文、或新增一個 9px 中文標籤，總數可能還在天花板之下。
 * 而 9px 中文在 12px 的階梯地板之外，是**真的看不清楚**（CJK 沒有 x-height 可以借）。
 *
 * 判準與預算相同：看該行與接下來兩行（JSX 的 className 與它顯示的字通常不同行）。
 */
const CJK_9 = /[\u4e00-\u9fff]/;
// 逐行去掉「同一行內」的註解：`{/* … */}` 與 `/* … */`。
// 不做全域 stripComments，因為它會把跨行區塊註解壓成一個空白、行號就對不上了。
const stripInlineComments = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const nineCjk = [];
for (const f of walk(path.join(ROOT, 'src')).filter((p) => p.endsWith('.jsx'))) {
  const lines = fs.readFileSync(f, 'utf8').split('\n').map(stripInlineComments);
  lines.forEach((line, i) => {
    if (!line.includes('text-[9px]')) return;
    if (!CJK_9.test(`${line}\n${lines[i + 1] ?? ''}\n${lines[i + 2] ?? ''}`)) return;
    nineCjk.push(`${path.relative(ROOT, f)}:${i + 1}`);
  });
}
check('9px 不得用於中文（型階梯地板是 12px）', nineCjk.length === 0, nineCjk.join('、') || '0 處');

/**
 * 上面那條規則有一個**它自己承認不了的盲點**：`{term.label}` 這種寫法，
 * 中文在資料層，原始碼裡一個中文字都沒有——掃描永遠說「0 處」，而畫面上確實是 9px 中文。
 *
 * 這四支檔案在第六輪逐條人工判定過：**它們的 9px 全部是中文**（標籤或整句說明）。
 * 所以對這四支改用「整檔零 9px」——比逐條列字串耐改動，也比字串比對誠實。
 */
const NINE_FREE = [
  'src/features/character-sheet/components/StatFormulaPanel.jsx',
  'src/features/character-sheet/components/EquipmentSlotCard.jsx',
  'src/features/character-sheet/components/CharacterLogModal.jsx',
  'src/features/character-sheet/components/companions/TinkererWorkshop.jsx',
  // 第七輪加入：`CombatantCard` 的狀態異常晶片副標是 `STATUS_EFFECTS[].desc`，
  // **中文在資料層**（「靈巧·洞察降階·限普攻」），原始碼裡一個中文字都沒有——
  // 所以第六輪「剩下的 13 處 9px 全是拉丁晶片」這個結論對這一處是錯的，
  // 掃描永遠說 0 處，只有截圖看得到（`scratch/ui-audit/shot_combat.mjs`）。
  // 現在標籤與說明都是 12px，靠 `font-bold` 與 `opacity-80` 分層；不准再回到 9px。
  'src/features/combat-tracker/components/CombatantCard.jsx',
];
const stillNine = NINE_FREE.filter((rel) => {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes('text-[9px]');
});
check('資料層中文的那幾支檔案不得再出現 9px', stillNine.length === 0, stillNine.join('、') || '0 檔');

/**
 * 第七輪：**句子**不得低於 12px（比 9px 那條更寬的網）。
 *
 * 為什麼要另一條：9px 那條只管 9px，而 10px／11px 有 900 多處——**數量天花板擋不住品質**。
 * 普查（`scratch/ui-audit/ten_eleven_census.mjs`）把 1,030 處分成
 * SENTENCE（`<p>` 段落＋中文，113 處）／CJK 短標籤（487）／LATIN（420）／其他，
 * 真正在「讀句子」的只有 113 處——**那個 1,030 是噪音，113 才是工作量**。
 *
 * 所以這條只管句子：`<p>` 標籤 ＋ 中文 ＋ 10/11px = 0。
 * 短標籤與晶片不在管轄內（它們要逐處量容器寬度，見 §11）。
 */
const sentencesLow = [];
for (const f of walk(path.join(ROOT, 'src')).filter((p) => p.endsWith('.jsx'))) {
  const lines = fs.readFileSync(f, 'utf8').split('\n').map(stripInlineComments);
  lines.forEach((line, i) => {
    if (!/text-\[(?:10|11)px\]/.test(line)) return;
    if (!/<p[\s>]/.test(line)) return;
    if (!CJK_9.test(`${line}\n${lines[i + 1] ?? ''}\n${lines[i + 2] ?? ''}`)) return;
    sentencesLow.push(`${path.relative(ROOT, f)}:${i + 1}`);
  });
}
check('中文段落不得低於 12px（句子不是標籤）', sentencesLow.length === 0, sentencesLow.join('、') || '0 處');

/* ────────────────────────────────────────────────────────────────
   G. 全域公約（規則本身會退化，所以也要有天花板）
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[G] 全域公約`);

const srcLines = allSrc.split('\n');

// G1. `uppercase` 必須成對出現 `tracking-`（§4.8.2）。
// 唯一例外：CombatTracker 的房間碼輸入框——那是把輸入值正規化成大寫，不是標籤字距。
const upperNoTrack = srcLines.filter(
  (l) => /\buppercase\b/.test(l) && !/tracking-(wide|wider|widest|tighter|tight|\[)/.test(l)
);
check(
  '大寫標籤一律帶字距（輸入值正規化除外）',
  upperNoTrack.length <= 1,
  `${upperNoTrack.length} 行未帶 tracking-`
);

// G2. 色票數量只能減（§5.2.1：每多一個色票，就多一個沒人記得的灰）。
// 2026-10-23 量到 218 個相異 hex。
const hexes = new Set((allSrc.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).map((h) => h.toLowerCase()));
check('色票數量不增加', hexes.size <= 218, `${hexes.size} / 上限 218`);

// G3. 字重種類只能減（§2.2.b：兩個就夠用）。
const weightSet = new Set(
  (allSrc.match(/font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g) || []).map((w) =>
    w.replace('font-', '')
  )
);
check('字重種類不增加', weightSet.size <= 6, `${weightSet.size} 種：${[...weightSet].join('、')}`);

// G4. 可按的卡片與主要動作要有按下回饋（§6.2.2）。
// 只對「外殼」把關：封面四張章節卡＋主要 CTA，全站掃會誤傷純展示元素。
// 沿用 §D 已剝過註解的 coverSrc——否則註解裡寫「active:」就會讓斷言恆真。
check(
  '封面卡片與主要動作有按下狀態',
  count(coverSrc, 'active:') >= 2,
  `${count(coverSrc, 'active:')} 處 active:`
);

// G5. 手機標頭不折行：<sm 用短標籤，≥sm 用長標籤。
// 390px 實測（scratch/ui-audit/header390.mjs）：長標籤 175px 寬 → 標頭高 73px／兩列，
// 第四顆工具鈕被擠到第二列右端變孤立圖示；改短標籤＋<sm 收窄內距後 → 標頭 34px／一列。
// 這裡鎖「短標籤存在且真的被藏／顯」，因為折行與否在 SSR 測不到。
const headerSrc = stripComments(read('src/components/book/ChapterHeader.jsx'));
check(
  '手機標頭有短標籤（避免工具鈕折到第二列）',
  count(headerSrc, 'sm:hidden') >= 1 && headerSrc.includes('返回封面') && headerSrc.includes('合上書本 · 返回封面'),
  `sm:hidden ${count(headerSrc, 'sm:hidden')} 處／短標籤 ${headerSrc.includes('返回封面')}／長標籤 ${headerSrc.includes('合上書本 · 返回封面')}`
);

/* ────────────────────────────────────────────────────────────────
   H. 全程淺色（第十三輪）：`dark:` 是死碼，不是備援
   ────────────────────────────────────────────────────────────────
   這本書的深淺由 `data-theme`（cool／warm）承擔——那是**同一套色票的兩種溫度**，
   不是「亮版／暗版」。`prefers-color-scheme` 驅動的 `dark:` 變體是**另一套設計語言**：
   深色 slate 面板配淺色羊皮紙內文，兩者混在同一頁時，層級會整個塌掉。

   `tailwind.config.js` 原本沒有 `darkMode` 鍵 → Tailwind 預設 `media` →
   **作業系統是深色的使用者會自動拿到那套深色面板**，而作者自己從來看不到。
   這一輪把 1,323 個 `dark:` 令牌刪掉，並把 `darkMode` 釘成 `'class'`：
   `class` 模式下沒有 `.dark` 祖先，任何殘留的 `dark:` 都不會生效。

   兩道一起上：**刪掉是治本，`darkMode: 'class'` 是讓殘留無害**。
   ──────────────────────────────────────────────────────────────── */
console.log(`\n[H] 全程淺色`);

// H1. 全站零 `dark:` 變體。注意不能只數 `dark:`——`FUIcon` 有一個屬性鍵就叫 `dark`（暗相），
// 所以只認「dark: + 工具前綴」這種真的變體寫法。
const DARK_VARIANT =
  /\bdark:(?:text|bg|border|ring|from|via|to|fill|stroke|shadow|divide|placeholder|opacity|outline|decoration|hover:|focus:|group-hover:|active:)[a-z-]/g;
const darkHits = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  const n = (body.match(DARK_VARIANT) || []).length;
  if (n) darkHits.push(`${path.relative(ROOT, abs).replace(/\\/g, '/')}（${n}）`);
}
check(
  '全站沒有 dark: 變體（深淺由 data-theme 承擔）',
  darkHits.length === 0,
  darkHits.length ? darkHits.join('、') : '0 個'
);

// H2. `darkMode: 'class'`：即使有人日後又寫了 `dark:`，也不會被作業系統偏好點亮。
const twSrc = stripComments(fs.readFileSync(path.join(ROOT, 'tailwind.config.js'), 'utf8'));
check(
  "tailwind 宣告 darkMode: 'class'（不是 media）",
  /darkMode\s*:\s*['"]class['"]/.test(twSrc),
  /darkMode\s*:\s*['"]class['"]/.test(twSrc) ? "darkMode: 'class'" : '缺 darkMode 宣告 → 預設 media，OS 深色會改寫整本書'
);

// H3. 修補匠工坊的色相令牌歸零（第十三輪的最大單點債：738 → 0）。
// 只鎖這一個檔：它是全站最肥的單一畫面，也是「五個分類色相假裝是身份」的集中地。
// 身份由圖示與文字承擔，色相只留一個強調色。
const tinkererSrc = stripComments(read('src/features/character-sheet/components/companions/TinkererWorkshop.jsx'));
const PALETTE =
  /(?:text|bg|border|ring|divide|from|via|to|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/g;
const tinkererHues = (tinkererSrc.match(PALETTE) || []).length;
check('修補匠工坊零調色盤令牌（色相不是身份）', tinkererHues === 0, `${tinkererHues} 個`);

// H4. 沒有「死三元式」：`cond ? 'x' : 'x'`。
// 收斂色相時最典型的副作用——`isDone ? 'bg-emerald-500' : 'bg-amber-500'` 兩邊被映到
// 同一個值，三元式還在，卻永遠不分支。它讀起來像有兩種狀態，實際只有一種；
// 而**它不會紅**：語法對、畫面也畫得出來，只是那個分支死了。
// 比對必須**逐字**：`' 與 ' : '與'` 只差排版空格（中英混排要加），是刻意的。
const DEAD_TERNARY = /\?\s*(['"`])([^'"`]*?)\1\s*:\s*(['"`])([^'"`]*?)\3/g;
const deadTernaries = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  body.split('\n').forEach((line, i) => {
    let m;
    DEAD_TERNARY.lastIndex = 0;
    while ((m = DEAD_TERNARY.exec(line))) {
      const [, , a, , b] = m;
      if (a === b && a.trim()) deadTernaries.push(`${path.relative(ROOT, abs).replace(/\\/g, '/')}:${i + 1}`);
    }
  });
}
check(
  '沒有死三元式（兩個分支同一個值）',
  deadTernaries.length === 0,
  deadTernaries.length ? deadTernaries.join('、') : '0 處'
);

// H5. 遊戲中主畫面（`CharacterPlayHUD`）的色相令牌歸零（第十四輪）。
// 這支畫面原本同時有六個色相在說話：slate（借來的灰）、amber、purple（靈能者曲風）、
// red（HP）、blue（MP）、emerald（IP）、rose（刪除）。判準：
// **HP／MP／IP 是「量」，量用長度說；那三個縮寫永遠寫在 bar 旁邊，身份已由標籤承擔。**
// 真正需要顏色的只有「危急」——那是狀態，不是身份，所以它拿強調色。
const hudSrc = stripComments(read('src/features/character-sheet/components/CharacterPlayHUD.jsx'));
const hudHues = (hudSrc.match(PALETTE) || []).length;
check('遊戲中主畫面零調色盤令牌（量用長度說）', hudHues === 0, `${hudHues} 個`);

const hudArb = (hudSrc.match(/text-\[\d+px\]/g) || []).length;
check('遊戲中主畫面零任意字級（型階梯）', hudArb === 0, `${hudArb} 個`);

// H6. 資源條：三條資源條都是單一實心墨色，危急那一條才是強調色。
// 漸層會讓一條 bar 自己宣告兩個色相（第十輪），而「危急」若用第四個色相，
// 使用者就分不出那是「沒血了」還是「這是第三種資源」。
//
// 第四條 bar 是**經驗條**，它的填色來自 `theme.accent`——那是玩家自己選的角色主題色
// （`characterThemes.js` 的封閉集合，每個角色一色）。那條**不算違規**：
// 它是身份，而且是封閉集合；這條護欄只鎖「三條資源條」。
const hudBars = (hudSrc.match(/h-full rounded-full transition-all duration-300/g) || []).length;
const hudSolid = (hudSrc.match(/bg-\[#3c2415\] h-full rounded-full/g) || []).length;
const hudCrisis = (hudSrc.match(/\$\{isCrisis \? 'bg-\[#a63d40\]' : 'bg-\[#3c2415\]'\}/g) || []).length;
check(
  '資源條實心、危急才換強調色',
  hudBars === 4 && hudSolid === 2 && hudCrisis === 1,
  `bar ${hudBars} 條（實心墨 ${hudSolid}＋危急 ${hudCrisis}＋經驗 1）`
);

// H7. 角色主題：六個主題共用同一張紙、同一階墨，只有身份色不同（第十五輪）。
// 原本每個主題各帶二十二個欄位——頁面底、卡面、面板、頁首、邊框、兩階墨、晶片、頁籤、
// focus ring、漸層、按鈕變體。那等於「換角色主題 = 換一個 app 的顏色」，
// 而 v5 是「全程淺色 · 冷暖分層」：紙只有一種。
//
// 判準（第十二輪那條的第三次應用）：**面不是身份、墨不是身份；身份是 accent。**
// 所以這一條守兩件事，而且是**相反方向**的兩件事：
//   1. 面／墨／邊界**必須全部相同**（收斂）；
//   2. 身份色**必須兩兩不同**（一對一，否則「選哪個都一樣」）。
const THEME_IDS = Object.keys(CHARACTER_THEMES);
const SURFACE_KEYS = [
  'appBg', 'sheetBg', 'cardBg', 'panelBg', 'subpanelBg', 'headerBg',
  'border', 'cardBorder', 'cardBorderHover', 'textDark', 'textMuted', 'chipBg',
];
const surfaceDrift = SURFACE_KEYS
  .map((k) => [k, new Set(THEME_IDS.map((id) => CHARACTER_THEMES[id][k]))])
  .filter(([, set]) => set.size !== 1);
check(
  '六個角色主題共用同一張紙與同一階墨（面不是身份）',
  surfaceDrift.length === 0,
  surfaceDrift.length
    ? surfaceDrift.map(([k, set]) => `${k} 有 ${set.size} 種`).join('、')
    : `${SURFACE_KEYS.length} 欄全部一致`
);

const themeAccents = THEME_IDS.map((id) => CHARACTER_THEMES[id].accent);
check(
  '六個身份色兩兩不同（身份必須一對一）',
  new Set(themeAccents).size === THEME_IDS.length,
  `${new Set(themeAccents).size} 種 / ${THEME_IDS.length} 個主題`
);

const themeSrc = stripComments(read('src/features/character-sheet/utils/characterThemes.js'));
const themeHues = (themeSrc.match(PALETTE) || []).length;
check('角色主題表零調色盤令牌', themeHues === 0, `${themeHues} 個`);

// H8. 按鈕：十四個變體 → 四個（第十五輪）。
// 原本的十個變體是為六個角色主題量身訂做的（emerald／cyan／purple／slate／danger ＋
// 五個 outline-*），於是同一個「確定」按鈕在六個角色身上是六種顏色，
// 而它講的永遠是同一件事。按鈕的語意只有**層級**三種，不是身份。
//
// 兩個斷言分開寫：變體多一個 與 偷渡一個色相 是兩種債，一起紅就分不出是哪一種。
const btnSrc = stripComments(read('src/components/ui/JRPGButton.jsx'));
const variantBlock = btnSrc.slice(
  btnSrc.indexOf('const variantStyles'),
  btnSrc.indexOf('const sizeStyles')
);
const btnVariants = [...variantBlock.matchAll(/^\s+([a-zA-Z][a-zA-Z-]*):\s*"/gm)].map((m) => m[1]);
const BTN_OK = ['primary', 'secondary', 'outline', 'ghost'];
check(
  '按鈕只有四個變體（層級不是身份）',
  btnVariants.length === BTN_OK.length && BTN_OK.every((v) => btnVariants.includes(v)),
  `${btnVariants.length} 個：${btnVariants.join('／')}`
);
const btnHues = (btnSrc.match(PALETTE) || []).length;
check('按鈕零調色盤令牌', btnHues === 0, `${btnHues} 個`);

// H9. 角色卡名冊的資源條與跑團面板同一個判準（第十五輪）。
// 兩支畫面各有一組 HP／MP／IP，如果只收一支，下一輪就會有人「照另一支的寫法」加回去。
const sheetSrc = stripComments(read('src/features/character-sheet/CharacterSheet.jsx'));
const sheetCrisis = count(sheetSrc, "? 'bg-[#a63d40]' : 'bg-[#3c2415]'");
const sheetSolid = count(sheetSrc, 'rounded-full transition-all duration-300 bg-[#3c2415]');
check(
  '角色卡資源條也是實心、危急才換強調色',
  sheetCrisis === 1 && sheetSolid === 2,
  `危急 ${sheetCrisis} 條（應為 1）＋實心墨 ${sheetSolid} 條（應為 2）`
);

// H10. 借來的灰（第十六輪 slate、第十七輪 stone）。
//
// `slate` 是 Tailwind 的**冷灰**，`stone` 是**暖灰**。兩者在畫面上都不是「另一個灰」，
// 是**另一個色溫**——跟第八輪的四個章節色同型，只是更難看見，因為灰看起來「沒有顏色」。
// v5 已經有四階墨、三階面、兩階邊界，所以每一個灰令牌都有一個職責相同的對應物。
//
// 為什麼兩輪才收完：`slate` 錯得很明顯（冷灰在暖紙上一眼就怪），`stone` 錯得**只差一點**
// （暖灰幾乎對得上羊皮紙）——**錯得只差一點的東西活得最久**。
//
// 這一條是**硬零值**（跟 emoji 同一級），不是預算：沒有任何一種灰令牌是「合法但罕見」的。
// 五個家族一起掃（slate／stone／zinc／neutral／gray），否則下一個人只是換一個灰再長回來。
//
// 唯一的例外是**深底上的灰**：`ArcanistManager.jsx:339` 的 `text-stone-200` 住在
// `bg-[#2c221e]` 的深底面板裡，那裡的「灰」其實是**淺色字**，對映到墨一階會變成墨上墨。
// 例外寫在護欄旁邊：下面第二條斷言（H10-b）釘住那塊面板的淺色字還在。
const BORROWED_GREY =
  /(?:text|bg|border|ring|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:slate|stone|zinc|neutral|gray)-\d{2,3}/g;
const walkSrc = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walkSrc(p);
    return /\.jsx?$/.test(d.name) ? [p] : [];
  });
const greyHits = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const hits = stripComments(fs.readFileSync(abs, 'utf8')).match(BORROWED_GREY) || [];
  if (hits.length) greyHits.push(`${rel}×${hits.length}`);
}
check(
  '全站零借來的灰（slate／stone／zinc／neutral／gray）',
  greyHits.length === 0,
  greyHits.length ? `${greyHits.length} 檔：${greyHits.slice(0, 6).join('、')}` : '0 處／0 檔'
);

// H10-b. 例外的另一面：深底面板的淺色字必須還在。
// 只寫 H10 的話，下一個人可以靠「把深底也改成淺色」讓它變綠——那不是收斂，那是把面板壓平。
//
// ⚠️ **第十九輪：這條例外的宿主已經拆了。**
// `ArcanistManager` 那塊 `bg-[#2c221e]` 面板是全站最後一塊**深底面板**，改成 v5 淺底之後
// 那兩處 `text-[#f7f3e8]` 一起消失——**例外與宿主在同一次改動裡一起消失**。
// 所以 H10-b 不再釘「某支檔案有 2 處」，改成釘**面板的簽名**：
// `bg-[#2c221e]` 與 `text-[#f7f3e8]` 不得同行。
//
// 為什麼釘簽名而不是釘 0：`text-[#f7f3e8]` 本身還合法——它是**墨面上的淺字**
// （`bg-[#3c2415]` 的抽屜標頭、書封、翻頁遮罩，共 6 處）。它不合法的地方只有一個：
// 跟 `#2c221e` 一起出現，因為那正是那塊面板的樣子。
const PANEL_SIG = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    if (line.includes('bg-[#2c221e]') && line.includes('text-[#f7f3e8]')) {
      PANEL_SIG.push(`${rel}: ${line.trim().slice(0, 60)}`);
    }
  }
}
check(
  '深底面板簽名已絕跡（bg-[#2c221e] 不與 text-[#f7f3e8] 同行）',
  PANEL_SIG.length === 0,
  PANEL_SIG.length ? `${PANEL_SIG.length} 行：${PANEL_SIG[0]}` : '0 處／淺字只住在墨面'
);

// H10-c. 深底只准當晶片或遮罩，不准當面板。
//
// 拆掉那塊面板之後，全站仍有 `bg-[#2c221e]`——但每一處的角色都不同：
//   `/10` 的淡底標籤、`/55` `/70` 的模態遮罩 → **半透明，不是面**
//   實心的那兩處 → **單行等寬晶片**，字色 `#e8dcc4`
// 這一條把三種分開：**帶透明度的不管，實心的必須帶晶片字色。**
// 面板的特徵是它裝一整段內文；把深底長回成容器的那一行不會有 `#e8dcc4`。
const darkSolid = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    // 只看實心（後面沒有 /NN）
    const m = line.match(/(?<![\w-])bg-\[#2c221e\](?!\/)/g);
    if (!m) continue;
    if (!line.includes('text-[#e8dcc4]')) darkSolid.push(`${rel}: ${line.trim().slice(0, 60)}`);
  }
}
check(
  '深底只當晶片（實心 bg-[#2c221e] 必與晶片字色 text-[#e8dcc4] 同行）',
  darkSolid.length === 0,
  darkSolid.length ? `${darkSolid.length} 行沒有晶片字色：${darkSolid[0]}` : '0 處／深底只剩晶片與遮罩'
);

// H11. 同伴表的色相令牌（第十八輪起：預算式，只准減）。
//
// 為什麼不是硬零：同伴表裡的色相有一半是**真的語意**——小工具四學派、紙牌花色、
// 危險／費用／資訊。收那些要逐檔判斷，不能機械對映（機械對映會把「兩張不同的牌」
// 壓成「兩張一樣的牌」，那是把一個真的身份系統壓平）。
//
// 本輪只收「單色相」六檔，因為那六檔的色相是**裝飾**：
// `amber` 在四個同伴檔當身份色、`emerald` 在三個檔、`cyan` 在兩個檔——
// **同一個色相被四個身份共用，它就不是身份，是裝飾。裝飾不需要九套。**
//
// 天花板寫在「正確」不是「最少」：512 是收完七檔之後的實測值，不是「還能再刪多少」。
// 任何一個新增都會讓這條變紅；要減少就往下調，調之前先量。
const HUE_TOKEN =
  /(?:text|bg|border|ring|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:rose|pink|fuchsia|purple|violet|indigo|blue|sky|cyan|teal|emerald|green|lime|yellow|amber|orange|red)-\d{2,3}/g;
const COMPANIONS = 'src/features/character-sheet/components/companions';
const hueByFile = {};
for (const abs of walkSrc(path.join(ROOT, COMPANIONS))) {
  const n = (stripComments(fs.readFileSync(abs, 'utf8')).match(HUE_TOKEN) || []).length;
  if (n) hueByFile[path.basename(abs)] = n;
}
const hueTotal = Object.values(hueByFile).reduce((a, b) => a + b, 0);
check(
  '同伴表色相令牌只減不增（預算 512）',
  hueTotal <= 512,
  `目前 ${hueTotal} 處／${Object.keys(hueByFile).length} 檔`
);

// H11-b. 收完的那七檔是**硬零**。
// 只有 H11 的話，預算可以被「這裡加一個、那裡減一個」抵掉——**預算式護欄的弱點就是
// 它允許交換**。硬零不允許交換：這七檔一個都不能長回來。
const HUE_CONVERGED = [
  'FloristGardenPreview.jsx',
  'FloristGardenTracker.jsx',
  'PilotVehicleCombatSheet.jsx',
  'PilotVehicleModal.jsx',
  'NecromancerMinionSheet.jsx',
  'ChanterComposer.jsx',
  'ArcanistManager.jsx',
];
const hueLeft = HUE_CONVERGED.filter((f) => hueByFile[f]);
check(
  '七個已收斂同伴檔零色相令牌（硬零）',
  hueLeft.length === 0,
  hueLeft.length ? `${hueLeft.length} 檔：${hueLeft.join('、')}` : '0 處／7 檔'
);

// H11-c. 收完的六檔，手寫 hex 只能用**登記過的**那幾個。
//
// 為什麼要有這一條：`NecromancerMinionSheet` 裡有 9 處 `#6b5a45`——比墨三階 `#6b5a4b`
// 只差一個字元。它看起來一模一樣（對比也過），所以活了下來；但它是**漂移**：
// 以後改墨三階永遠改不到它，而且它會跟著影印到下一支檔案。
// 色相令牌可以用正則掃，手寫 hex 只能靠白名單。
const REGISTERED_HEX = new Set([
  // 三階面
  '#fbf7ee', '#f4ebd9', '#fffdf9',
  // 兩階邊界／分隔
  '#d6c7ab', '#e8dcc4',
  // 四階墨
  '#2c221e', '#3c2415', '#6b5a4b', '#7c6a58',
  // 強調與 hover
  '#a63d40', '#8c3235',
  // 深底上的淺字（面板已拆，色票仍登記：它是歷史決策的一部分）
  '#f7f3e8',
  // 六個登記身份色（第五輪角色主題 → 第十八輪同伴表沿用）
  '#8c2d36', '#245c45', '#9c4d16', '#27527a', '#5e387c', '#404a58',
  // 五個身份色的 hover 階（第十九輪：同色相暗一階，比例照 #a63d40 → #8c3235）
  '#76252d', '#1e4b39', '#833f12', '#214365', '#4f2e67',
]);
const strayHex = [];
for (const f of HUE_CONVERGED) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, COMPANIONS, f), 'utf8'));
  for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    const h = m[0].toLowerCase();
    if (!REGISTERED_HEX.has(h)) strayHex.push(`${f}:${h}`);
  }
}
check(
  '七個已收斂同伴檔只用登記色票',
  strayHex.length === 0,
  strayHex.length
    ? `${strayHex.length} 處：${[...new Set(strayHex)].slice(0, 6).join('、')}`
    : `0 處／${REGISTERED_HEX.size} 個登記色`
);

// H13. 死掉的 hover（第十九輪）。
//
// 這一條抓的是**收斂的副作用**，不是原本就有的毛病：
// `bg-amber-600 hover:bg-amber-700` 兩端都 ≥ 500，機械對映後**雙雙變成同一個登記色**，
// 於是 `hover:bg-[#9c4d16]` 跟底色一模一樣——按鈕宣告了回饋，而回饋是空的。
//
// 為什麼前面所有護欄都看不到它：色相令牌數照樣下降、對比照樣合格、預算照樣變綠。
// **一個「只數令牌」的護欄對「兩個令牌變成一樣」完全無感。**
//
// 判準：同一個前綴、同一個 hex，base 與 hover 相同 → 死 hover。
// 例外不需要：真正的回饋一定換一個值（暗一階、下一階面、主強調色）。
const DEAD_HOVER =
  /(?<![\w-])(bg|text|border|ring|divide)-\[(#[0-9a-fA-F]{6})\] hover:\1-\[(#[0-9a-fA-F]{6})\]/g;
const deadHover = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  for (const m of stripComments(fs.readFileSync(abs, 'utf8')).matchAll(DEAD_HOVER)) {
    if (m[2].toLowerCase() === m[3].toLowerCase()) deadHover.push(`${rel}: ${m[0]}`);
  }
}
check(
  '全站零死 hover（base 與 hover 不得同值）',
  deadHover.length === 0,
  deadHover.length ? `${deadHover.length} 處：${deadHover[0]}` : '0 處／每個 hover 都換了值'
);

﻿// H14. 九相色票（第二十輪）。
//
// `FUIcon.jsx` 的 `FU_ICON_MAP` 是全站**最大的一個身份用色系統**，而它一直是
// Tailwind 色相令牌，而且**真的撞色**：電與光都是 `amber-600`、火與攻擊性咒語都是
// `red-700`、土與其餘行動都是 `amber-800`。
//
// 撞色的圖示不是「兩個身份剛好同色」，是**其中一個身份消失了**——
// 使用者看到兩個一樣顏色的字，學到的是「這兩個是同一類」。
//
// 七條護欄各擋一種退化：
//   H14   硬零：這個檔案不准再出現色相令牌（換色要換成登記色）
//   H14-b 一對一：九相必須九個相異色（這是最容易被「順手對映」壓扁的一條）
//   H14-c 別名同步：同一相的所有鍵（中文／英文／單字母）必須同色
//   H14-d 封閉白名單：整個檔案只准用登記過的 11 個色（九相 ＋ 墨 ＋ 危險紅）
//   H14-e 對比：九色在三種面上都要 ≥ 4.5:1
//   H14-f 鏡像相等：NPC 工坊的 TYPE_STYLES（第二份拷貝）必須與這張表同色
//   H14-g 鏡像硬零：TYPE_STYLES 那十個條目不得回退成色相令牌
const FUICON_PATH = path.join(ROOT, 'src/components/ui/FUIcon.jsx');
const fuiRaw = fs.readFileSync(FUICON_PATH, 'utf8');
const fuiSrc = stripComments(fuiRaw);

const FUI_HUE_TOKEN = /text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/g;
const fuiHues = fuiSrc.match(FUI_HUE_TOKEN) || [];
check(
  'FUIcon 零 Tailwind 色相令牌（九相是登記色票）',
  fuiHues.length === 0,
  fuiHues.length ? `${fuiHues.length} 個：${[...new Set(fuiHues)].join('、')}` : '0 個／全部是登記色'
);

// 解析對照表：color → label。同一 label 的所有鍵都必須落在同一個色上。
const FUI_ENTRY = /color: '([^']+)'[^}]*label: '([^']+)'/g;
const fuiByLabel = new Map();
for (const m of fuiSrc.matchAll(FUI_ENTRY)) {
  const hex = (m[1].match(/#[0-9a-fA-F]{6}/) || [])[0];
  if (!hex) continue;
  if (!fuiByLabel.has(m[2])) fuiByLabel.set(m[2], []);
  fuiByLabel.get(m[2]).push(hex.toLowerCase());
}

const FUI_NINE = ['物理', '風', '電', '暗', '土', '火', '冰', '光', '毒'];
const fuiMissingNine = FUI_NINE.filter((k) => !fuiByLabel.has(k));
check(
  '九相全部在對照表裡（p a b d e f i l t 一個都不能少）',
  fuiMissingNine.length === 0,
  fuiMissingNine.length ? `缺：${fuiMissingNine.join('、')}` : `9 個都在／共 ${fuiByLabel.size} 個身份`
);

const fuiNineColours = FUI_NINE.map((k) => (fuiByLabel.get(k) || [])[0]);
const fuiDistinctNine = new Set(fuiNineColours.filter(Boolean));
check(
  '九相九色兩兩不同（身份必須一對一）',
  fuiDistinctNine.size === 9,
  `${fuiDistinctNine.size} 色／9 個身份${fuiDistinctNine.size < 9 ? `　撞色：${fuiNineColours.join(' ')}` : ''}`
);

const fuiAliasDrift = [...fuiByLabel.entries()]
  .filter(([, v]) => new Set(v).size > 1)
  .map(([k, v]) => `${k}（${[...new Set(v)].join(' / ')}）`);
check(
  '同一相的所有別名同色（中文／英文／單字母不得漂移）',
  fuiAliasDrift.length === 0,
  fuiAliasDrift.length ? `${fuiAliasDrift.length} 個身份漂移：${fuiAliasDrift[0]}` : '0 個／每個身份的別名都一致'
);

// 封閉白名單：九相 ＋ 墨（分類標籤）＋ 危險紅（攻擊性咒語／危機）。
const FUI_ALLOWED = new Set([
  '#404a58', '#245c45', '#5a6b00', '#5e387c', '#5c4a26',
  '#a63d40', '#27527a', '#9c4d16', '#8c2d6a',
  '#3c2415', '#8c2d36',
]);
const fuiStrayHex = [...fuiByLabel.entries()]
  .flatMap(([k, v]) => v.filter((h) => !FUI_ALLOWED.has(h)).map((h) => `${k}=${h}`));
check(
  'FUIcon 只用登記過的十一色（九相＋墨＋危險紅）',
  fuiStrayHex.length === 0,
  fuiStrayHex.length ? `${fuiStrayHex.length} 處未登記：${fuiStrayHex[0]}` : `0 處／${FUI_ALLOWED.size} 個登記色`
);

const FUI_SURFACES = ['#fbf7ee', '#f4ebd9', '#fffdf9'];
const fuiLowContrast = [];
for (const hex of FUI_ALLOWED) {
  for (const bg of FUI_SURFACES) {
    const r = contrast(hex, bg);
    if (r < 4.5) fuiLowContrast.push(`${hex} on ${bg} = ${r.toFixed(2)}`);
  }
}
check(
  '九相色票在三種面上都 ≥ 4.5:1',
  fuiLowContrast.length === 0,
  fuiLowContrast.length ? `${fuiLowContrast.length} 組不合規：${fuiLowContrast[0]}` : `0 組／${FUI_ALLOWED.size} 色 × 3 面`
);

// H14-f. 鏡像相等：NPC 工坊的 `TYPE_STYLES` 是這張表的第二份拷貝。
//
// 為什麼是拷貝而不是 import：Tailwind 只掃**字面量**，`text-[${hex}]` 這種模板字串
// 不會生成 class，所以兩張表必須各自寫死。寫死就會各自漂移——這一輪之前它就帶著
// 一模一樣的三組撞色（電≡光、火≡攻擊性咒語、土≡其餘行動）。
// 護欄的形狀是**值相等**，不是「用過的色票」：改色時兩邊一起改就綠，只改一邊就紅。
const TS_PATH = path.join(ROOT, 'src/features/npc-workshop/data/constants.js');
const tsRaw = fs.readFileSync(TS_PATH, 'utf8');
const tsSrc = stripComments(tsRaw);

const TS_ENTRY = /'([^']+)':\s*\{\s*fuIcon:\s*'[a-z]',\s*color:\s*'([^']+)'\s*\}/g;
const tsByLabel = new Map();
for (const m of tsSrc.matchAll(TS_ENTRY)) {
  const hex = (m[2].match(/#[0-9a-fA-F]{6}/) || [])[0];
  if (hex) tsByLabel.set(m[1], hex.toLowerCase());
}
const TS_LABELS = [...FUI_NINE, '攻擊性咒語'];
const tsMissing = TS_LABELS.filter((k) => !tsByLabel.has(k));
const tsDrift = TS_LABELS.filter(
  (k) => tsByLabel.has(k) && fuiByLabel.has(k) && tsByLabel.get(k) !== fuiByLabel.get(k)[0]
).map((k) => `${k}（TYPE_STYLES ${tsByLabel.get(k)} / FUIcon ${fuiByLabel.get(k)[0]}）`);
check(
  'TYPE_STYLES 與 FU_ICON_MAP 同色（第二份拷貝不得各自漂移）',
  tsMissing.length === 0 && tsDrift.length === 0,
  tsMissing.length
    ? `缺 ${tsMissing.length} 個：${tsMissing.join('、')}`
    : tsDrift.length
      ? `${tsDrift.length} 個漂移：${tsDrift[0]}`
      : `${TS_LABELS.length} 個身份逐一相等`
);

// H14-g. 鏡像硬零：只掃 `TYPE_STYLES` 這一行，不掃整個檔案——
// 同檔的 `AFFINITY_STATES`（五種相性狀態）與反派階級是**另一組分類**，
// 它們的色相令牌是已登記的債，不在這一條的管轄範圍。
// 護欄範圍寫死在「這個宣告」上，才不會因為隔壁的債而誤紅。
const TS_DECL = (tsSrc.match(/export const TYPE_STYLES = \{[^\n]*\}/) || [''])[0];
const tsHues = TS_DECL.match(FUI_HUE_TOKEN) || [];
check(
  'TYPE_STYLES 十個條目零色相令牌',
  TS_DECL.length > 0 && tsHues.length === 0,
  TS_DECL.length === 0
    ? '找不到 TYPE_STYLES 宣告，這一條沒有真的被驗證'
    : tsHues.length
      ? `${tsHues.length} 個：${[...new Set(tsHues)].join('、')}`
      : '0 個／10 個條目都是登記色'
);

// H15. 四屬性色票（第二十一輪）。
//
// 四屬性是**第二個封閉的身份集**，形狀與九相完全相同——但這一輪之前它沒有「一張表」，
// 它有**五張**，而且當場就不一致：DEX 在 `StatBadge` 是 `amber-800`、在 NPC 工坊是
// `blue-800`、在 Wayfarer 是 `amber-600`／`amber-700`。同一個身份在不同畫面是不同顏色，
// 那不是深淺差，是**兩個身份**。
//
// 收斂的做法與 `ATTRIBUTE_NAMES` 完全相同：名字和顏色放在一起（`sourcebookConfig.js`），
// 五個消費端全部引用它。四色另外避開紅家族——`#a63d40` 是強調色，它講的是「這裡可以按」；
// 屬性色講的是「這是哪一個」。同一個訊號不能同時講兩件事。
//
// 七條護欄各擋一種退化：
//   H15   單一來源：四個身份引用同一張表
//   H15-a 一對一：四個 hex 兩兩不同
//   H15-b 形狀硬零：任何「屬性那一行」都不准出現色相令牌（擋第六份拷貝）
//   H15-c 引用：四個消費端都必須 import 這張表（不得各自寫死）
//   H15-d 對比：四色在三種面上都要 ≥ 4.5:1
//   H15-e 避開強調色：不得與強調色同值，且色相距離 ≥ 20°
//   H15-f 與九相的距離：≥ 20°，或飽和度差 ≥ 20（登記例外才允許靠近）
const SBC_PATH = path.join(ROOT, 'src/features/character-sheet/data/sourcebookConfig.js');
const sbcSrc = stripComments(fs.readFileSync(SBC_PATH, 'utf8'));
const AC_DECL = (sbcSrc.match(/export const ATTRIBUTE_COLORS = Object\.freeze\(\{[\s\S]*?\}\)/) || [''])[0];
const AC_ENTRY = /([a-z]+):\s*'text-\[(#[0-9a-fA-F]{6})\]'/g;
const attrColours = new Map();
for (const m of AC_DECL.matchAll(AC_ENTRY)) attrColours.set(m[1], m[2].toLowerCase());
const ATTR_FOUR = ['dex', 'ins', 'mig', 'wlp'];
const attrMissing = ATTR_FOUR.filter((k) => !attrColours.has(k));
check(
  '四屬性色票是封閉四集且引用自同一張表',
  AC_DECL.length > 0 && attrMissing.length === 0 && attrColours.size === 4,
  AC_DECL.length === 0
    ? '找不到 ATTRIBUTE_COLORS 宣告，這一條沒有真的被驗證'
    : attrMissing.length
      ? `缺：${attrMissing.join('、')}`
      : `${attrColours.size} 個身份：${[...attrColours.values()].join(' ')}`
);

const attr15Hexes = ATTR_FOUR.map((k) => attrColours.get(k));
check(
  '四屬性四色兩兩不同（身份必須一對一）',
  new Set(attr15Hexes.filter(Boolean)).size === 4,
  `${new Set(attr15Hexes.filter(Boolean)).size} 色／4 個身份　${attr15Hexes.join(' ')}`
);

// H15-b. 形狀判準：**同一行**同時出現屬性代碼與一個色相令牌，就是「屬性的顏色寫在別處」。
//
// 這一條不認顏色長什麼樣，只認「身份與顏色在同一行相遇」——所以它能抓到第六份拷貝，
// 不管那份拷貝用的是 amber 還是 purple、是 600 還是 900。
// 掃描前先去掉註解：註解裡為了說明而寫的 `text-amber-800` 不是宣告。
const ATTR_CODE = /\b(?:DEX|INS|MIG|WLP)\b|靈巧|洞察|力量|意志/;
const ATTR_HUE =
  /(?:hover:|focus:|active:|disabled:|group-hover:)?(?:text|bg|border|border-[lrtbxy]|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|placeholder|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/;
const attrHueHits = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const lines = fs.readFileSync(abs, 'utf8').split('\n').map(stripInlineComments);
  lines.forEach((line, i) => {
    if (ATTR_CODE.test(line) && ATTR_HUE.test(line)) attrHueHits.push(`${rel}:${i + 1}`);
  });
}
check(
  '屬性那一行零色相令牌（不得長出第六份拷貝）',
  attrHueHits.length === 0,
  attrHueHits.length ? `${attrHueHits.length} 處：${attrHueHits.slice(0, 3).join('、')}` : '0 處／顏色只有一個來源'
);

// H15-c. 引用：四個消費端都必須從那張表拿顏色。
// 沒有這一條的話，把某一端的顏色「暫時寫死」不會有任何訊號——而這正是那五份拷貝的成因。
const ATTR_CONSUMERS = [
  'src/components/ui/StatBadge.jsx',
  'src/features/npc-workshop/NPCWorkshop.jsx',
  'src/features/character-sheet/components/companions/WayfarerCompanionModal.jsx',
  'src/features/character-sheet/components/companions/WayfarerCompanionSheet.jsx',
];
// 判準是**import 自那張表**，不是「檔案裡出現這個名字」。
// 第一版寫成 `.includes('ATTRIBUTE_COLORS')`，於是「把 import 換成一個同名常數」
// 仍然是綠的——那正是這條護欄要擋的事。刻意破壞驗證就是這樣抓到的。
const ATTR_IMPORT =
  /import\s*\{[^}]*\bATTRIBUTE_COLORS\b[^}]*\}\s*from\s*'[^']*sourcebookConfig'/;
const attrNoRef = ATTR_CONSUMERS.filter(
  (rel) => !ATTR_IMPORT.test(stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8')))
);
check(
  '四個消費端都引用 ATTRIBUTE_COLORS',
  attrNoRef.length === 0,
  attrNoRef.length ? `${attrNoRef.length} 個沒引用：${attrNoRef.join('、')}` : `${ATTR_CONSUMERS.length} 個都在引用`
);

const ATTR_SURFACES = ['#fbf7ee', '#f4ebd9', '#fffdf9'];
const attrLowContrast = [];
for (const hex of attr15Hexes) {
  for (const bg of ATTR_SURFACES) {
    const r = contrast(hex, bg);
    if (r < AA) attrLowContrast.push(`${hex} on ${bg} = ${r.toFixed(2)}`);
  }
}
check(
  '四屬性色票在三種面上都 ≥ 4.5:1',
  attrLowContrast.length === 0,
  attrLowContrast.length ? `${attrLowContrast.length} 組不合規：${attrLowContrast[0]}` : `0 組／4 色 × 3 面`
);

const hueOf = (hex) => {
  const [r, g, b] = toRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// H15-e. 避開強調色的家族。`#a63d40`（強調）／`#8c2d36`（危險紅）／`#76252d`（強調 hover）
// 三個都在同一個紅色家族裡；屬性色一旦靠近，使用者就分不出「這是屬性」與「這裡可以按」。
const ACCENT_FAMILY = ['#a63d40', '#8c2d36', '#76252d'];
const attrAccentClash = [];
for (const [key, hex] of ATTR_FOUR.map((k) => [k, attrColours.get(k)])) {
  for (const acc of ACCENT_FAMILY) {
    if (hex === acc) attrAccentClash.push(`${key} 與 ${acc} 同值`);
    else if (hueGap(hueOf(hex), hueOf(acc)) < 20) attrAccentClash.push(`${key} ${hex} 距 ${acc} 僅 ${hueGap(hueOf(hex), hueOf(acc)).toFixed(0)}°`);
  }
}
check(
  '四屬性色票避開強調色家族（≥ 20° 且不得同值）',
  attrAccentClash.length === 0,
  attrAccentClash.length ? `${attrAccentClash.length} 處：${attrAccentClash[0]}` : '0 處／四色都不在紅色家族'
);

// H15-f. 與九相的距離。兩組身份集會在 NPC 工坊的同一張卡上相遇，色相太近就等於同一個身份。
// 例外只准靠**飽和度**分開（九相自己就有兩組登記例外：光↔土 16°、冰↔物理 6°），
// 所以判準是「≥ 20°，或飽和度差 ≥ 20」——不是單純的「≥ 20°」。
const satOf = (hex) => {
  const [r, g, b] = toRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  const l = (max + min) / 2;
  return d / (1 - Math.abs(2 * l - 1));
};
const attrNineClash = [];
for (const [key, hex] of ATTR_FOUR.map((k) => [k, attrColours.get(k)])) {
  for (const [label, nineHex] of fuiByLabel.entries()) {
    if (!FUI_NINE.includes(label)) continue;
    const g = hueGap(hueOf(hex), hueOf(nineHex[0]));
    const ds = Math.abs(satOf(hex) - satOf(nineHex[0])) * 100;
    if (g < 20 && ds < 20) attrNineClash.push(`${key} ↔ ${label}：${g.toFixed(0)}°／Δs ${ds.toFixed(0)}`);
  }
}
check(
  '四屬性與九相的距離 ≥ 20° 或 Δs ≥ 20',
  attrNineClash.length === 0,
  attrNineClash.length ? `${attrNineClash.length} 組太近：${attrNineClash[0]}` : '0 組／4 色 × 9 相都分得開'
);

// H16. 相性狀態（第二十二輪）：**狀態不是身份，是序**。
//
// 九相是身份——離散、封閉、沒有順序 → 用色相，九色兩兩不同，撞色等於其中一個身份消失。
// 相性狀態（一般／弱點／抗性／免疫／吸收）是**序**：講的是「打我這裡會怎樣」。
// 這一輪之前它有四份拷貝、五個色相家族：
//   `constants.js` 的 `AFFINITY_STATES`（red/amber/sky/emerald × 100/400/900 ＝ 12 個令牌）、
//   `NPCWorkshop` 的分類摘要（8 個）與分頁 conf（12 個）與容器外框（4 個）、
//   `NPCCardPreview` 的預覽徽章（12 個——它讀了 label，卻自己另寫一份顏色）。
//
// 判準與九相**相反**：九相必須單射，狀態**不必**。顏色只講「好壞」（極性），
// 文字講「哪一種」。抗性與免疫同色是刻意的——兩者都是「傷害變少」，差別在幅度。
//
// ⚠️ 不要給狀態加「一對一」護欄：那會逼出第五個色相，把相性磚變回彩虹。
// 這六條各擋一種退化：
//   H16   五階齊備（四個欄位都在：label／bar／chip／ink）
//   H16-a 表內零色相令牌
//   H16-b 表內只用登記 hex
//   H16-c 形狀硬零：狀態鍵與色相令牌不得同行（擋第五份拷貝）
//   H16-d 標籤純中文（規則三：不得再長出 `弱點 VUL`）
//   H16-e 晶片對比 ≥ 4.5:1
//   H16-f 極性只有兩種色相（狀態是序，不是身份——這一條擋的是「把它當身份處理」）
const STATE_PATH = path.join(ROOT, 'src/features/npc-workshop/data/constants.js');
const stateSrc = stripComments(fs.readFileSync(STATE_PATH, 'utf8'));
const STATE_DECL = (stateSrc.match(/export const AFFINITY_STATES = \{[\s\S]*?\n\};/) || [''])[0];
const STATE_KEYS = ['normal', 'vul', 'res', 'imm', 'abs'];
const stateRow = (k) => (STATE_DECL.match(new RegExp(`\\n  ${k}: \\{([^}]*)\\}`)) || [])[1] || '';
const stateField = (k, f) => (stateRow(k).match(new RegExp(`\\b${f}: '([^']*)'`)) || [])[1] || '';
const stateIncomplete = STATE_KEYS.filter(
  (k) => !stateRow(k) || !stateField(k, 'label') || !stateField(k, 'bar') || !stateField(k, 'chip') || !stateField(k, 'ink')
);
check(
  '相性狀態五階齊備（狀態是序，不是身份）',
  STATE_DECL.length > 0 && stateIncomplete.length === 0,
  STATE_DECL.length === 0
    ? '找不到 AFFINITY_STATES 宣告，這一條沒有真的被驗證'
    : stateIncomplete.length
      ? `缺欄位或整列：${stateIncomplete.join('、')}`
      : `5 階：${STATE_KEYS.map((k) => stateField(k, 'label')).join('／')}`
);

const stateHueHits = STATE_DECL.match(
  /(?:text|bg|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/g
) || [];
check(
  '相性狀態表零色相令牌',
  STATE_DECL.length > 0 && stateHueHits.length === 0,
  stateHueHits.length ? `${stateHueHits.length} 個：${[...new Set(stateHueHits)].join('、')}` : '0 個／5 階都是登記色'
);

const stateHexes = STATE_KEYS.flatMap((k) =>
  [...(stateRow(k).match(/#[0-9a-fA-F]{6}\b/g) || [])].map((h) => h.toLowerCase())
);
const stateStray = [...new Set(stateHexes)].filter((h) => !REGISTERED_HEX.has(h));
check(
  '相性狀態只用登記色票',
  stateHexes.length > 0 && stateStray.length === 0,
  stateStray.length ? `${stateStray.length} 個未登記：${stateStray.join('、')}` : `0 個／${new Set(stateHexes).size} 色全在登記表`
);

// H16-c. 形狀判準：**同一行**同時出現狀態鍵字面量與色相令牌，就是「狀態的顏色寫在別處」。
// 不認顏色長什麼樣，只認「狀態與顏色在同一行相遇」——所以第五份拷貝用什麼色相都會被抓到。
// 狀態鍵只認**引號或物件鍵**形式：`Math.abs` 不是狀態。
const STATE_KEY_LITERAL = /['"`](vul|res|imm|abs)['"`]|\b(vul|res|imm|abs):/;
const STATE_HUE =
  /(?:hover:|focus:|active:|disabled:|group-hover:)?(?:text|bg|border|border-[lrtbxy]|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|placeholder|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/;
const stateHueLines = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  fs.readFileSync(abs, 'utf8')
    .split('\n')
    .map(stripInlineComments)
    .forEach((line, i) => {
      if (STATE_KEY_LITERAL.test(line) && STATE_HUE.test(line)) stateHueLines.push(`${rel}:${i + 1}`);
    });
}
check(
  '狀態那一行零色相令牌（不得長出第五份拷貝）',
  stateHueLines.length === 0,
  stateHueLines.length ? `${stateHueLines.length} 處：${stateHueLines.slice(0, 3).join('、')}` : '0 處／顏色只有一個來源'
);

const stateLatin = STATE_KEYS.filter((k) => /[A-Za-z]/.test(stateField(k, 'label')));
check(
  '相性狀態標籤純中文（規則三）',
  stateLatin.length === 0,
  stateLatin.length ? `${stateLatin.length} 階含拉丁字母：${stateLatin.map((k) => stateField(k, 'label')).join('、')}` : '5 階都是純中文'
);

const stateChipLow = [];
for (const k of STATE_KEYS) {
  const chip = stateField(k, 'chip');
  const fg = (chip.match(/text-\[(#[0-9a-fA-F]{6})\]/) || [])[1];
  const bg = (chip.match(/bg-\[(#[0-9a-fA-F]{6})\]/) || [])[1] || '#fffdf9';
  if (!fg) { stateChipLow.push(`${k}：找不到字色`); continue; }
  const r = contrast(fg.toLowerCase(), bg.toLowerCase());
  if (r < AA) stateChipLow.push(`${k} ${fg} on ${bg} = ${r.toFixed(2)}`);
}
check(
  '相性狀態晶片對比 ≥ 4.5:1',
  stateChipLow.length === 0,
  stateChipLow.length ? `${stateChipLow.length} 階不合規：${stateChipLow[0]}` : '0 階／5 階都過 AA'
);

// H16-f. 極性只有兩種色相。
// 這一條是**反向**的：它擋的不是「撞色」，是「有人把狀態當身份、補到五個色相」。
// 中性色（面／墨／邊框）的彩度低，不算極性；算的是 chip／bar／ink 全部用色裡
// 彩度 ≥ 0.18 的色相家族數——必須 ≤ 2（紅＝壞、綠＝好）。
const stateChromatic = [...new Set([...stateHexes])].filter((h) => {
  const [r, g, b] = toRgb(h);
  return (Math.max(r, g, b) - Math.min(r, g, b)) * 255 >= 0.18 * 255;
});
const stateHueFamilies = [...new Set(stateChromatic.map((h) => Math.round(hueOf(h) / 30)))];
check(
  '相性狀態的極性色相 ≤ 2（狀態是序，不是身份）',
  stateHueFamilies.length > 0 && stateHueFamilies.length <= 2,
  `${stateHueFamilies.length} 個色相家族：${stateChromatic.join(' ')}`
);

// H17. 反派階級（第二十三輪）：**序 ＋ 極性**，不是身份。
//
// 這一輪之前它有四個色相家族：非反派（墨）／次要（紫）／主要（紅）／最終（桃紅）——
// 四個格子裡有三個「不同的東西」，而它們其實是**同一件事的四個刻度**。
// 判準沿用 H16（相性狀態）：顏色只講極性（反派＝危險），程度由**填充**承擔：
//   無框 → 描邊（中性）→ 描邊（極性）→ 實心（極性）
// 三階共用同一個紅 `#8c2d36`，所以 H17-e 要求它們的 `ink` **全等**——
// 有人日後給主要反派一個自己的顏色，這一條會紅。
//
// ⚠️ 這張卡的身份色已經被**物種主題**（`SPECIES_THEMES` 的 accent）佔用。
// 一張卡只能有一個身份色；反派階級是疊在主題上的程度，不是第二個身份。
//
// ⚠️ 不要給階級加「一對一」護欄：那會逼出第四、第五個色相，把反派磚變回彩虹。
// 七條各擋一種退化：
//   H17   四階齊備（up／label／ink／chip 都在，且 up 嚴格遞增）
//   H17-a 表內零色相令牌
//   H17-b 表內只用登記 hex
//   H17-c 標籤純中文（規則三：不得再長出 `Boss 級`）
//   H17-d **單調性**：填充階必須逐階遞增（與九相、四屬性的單射**相反**的形狀）
//   H17-e 三階共用同一個極性色（ink 全等），非反派用墨
//   H17-f 晶片對比 ≥ 4.5:1
const TIER_PATH = path.join(ROOT, 'src/features/npc-workshop/data/constants.js');
const tierSrc = stripComments(fs.readFileSync(TIER_PATH, 'utf8'));
const TIER_DECL = (tierSrc.match(/export const VILLAIN_TIERS = \{[\s\S]*?\n\};/) || [''])[0];
const TIER_KEYS = ['none', 'minor', 'major', 'supreme'];
const TIER_POLAR = '#8c2d36';
const tierRow = (k) => (TIER_DECL.match(new RegExp(`\\n  "${k}":\\s+\\{([^}]*)\\}`)) || [])[1] || '';
const tierField = (k, f) => (tierRow(k).match(new RegExp(`\\b${f}: "([^"]*)"`)) || [])[1] || '';
const tierUp = (k) => Number((tierRow(k).match(/\bup: (\d+)/) || [])[1] ?? NaN);

const tierIncomplete = TIER_KEYS.filter(
  (k) => !tierRow(k) || !tierField(k, 'label') || !tierField(k, 'ink') || !tierField(k, 'chip') || !Number.isFinite(tierUp(k))
);
const tierUps = TIER_KEYS.map(tierUp);
const tierAscending = tierUps.every((v, i) => i === 0 || v > tierUps[i - 1]);
check(
  '反派階級四階齊備且 up 嚴格遞增',
  TIER_DECL.length > 0 && tierIncomplete.length === 0 && tierAscending,
  TIER_DECL.length === 0
    ? '找不到 VILLAIN_TIERS 宣告，這一條沒有真的被驗證'
    : tierIncomplete.length
      ? `缺欄位或整列：${tierIncomplete.join('、')}`
      : tierAscending
        ? `4 階：${TIER_KEYS.map((k) => `${tierField(k, 'label')} ${tierUp(k)}`).join('／')}`
        : `up 不是嚴格遞增：${tierUps.join('、')}`
);

const tierHueHits = TIER_DECL.match(
  /(?:text|bg|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/g
) || [];
check(
  '反派階級表零色相令牌',
  TIER_DECL.length > 0 && tierHueHits.length === 0,
  tierHueHits.length ? `${tierHueHits.length} 個：${[...new Set(tierHueHits)].join('、')}` : '0 個／4 階都是登記色'
);

const tierHexes = TIER_KEYS.flatMap((k) => [...(tierRow(k).match(/#[0-9a-fA-F]{6}\b/g) || [])].map((h) => h.toLowerCase()));
const tierStray = [...new Set(tierHexes)].filter((h) => !REGISTERED_HEX.has(h));
check(
  '反派階級只用登記色票',
  tierHexes.length > 0 && tierStray.length === 0,
  tierStray.length ? `${tierStray.length} 個未登記：${tierStray.join('、')}` : `0 個／${new Set(tierHexes).size} 色全在登記表`
);

const tierLatin = TIER_KEYS.filter((k) => /[A-Za-z（）()]/.test(tierField(k, 'label')));
check(
  '反派階級標籤純中文（規則三）',
  tierLatin.length === 0,
  tierLatin.length ? `${tierLatin.length} 階含拉丁字母或括號：${tierLatin.map((k) => tierField(k, 'label')).join('、')}` : '4 階都是純中文'
);

// H17-d. 單調性。序的護欄不能是「兩兩不同」，只能是「一階比一階響」。
// 填充階只認兩個維度、三種邊框份量——不加權重、不算對比，所以不會被「多一個 font-bold」弄壞：
//   邊框：transparent = 0、中性 hex = 1、極性紅 = 2
//   底色：不填 = 0、填極性紅 = 1
const tierFillRank = (k) => {
  const chip = tierField(k, 'chip').toLowerCase();
  const border = (chip.match(/border-\[(#[0-9a-f]{6})\]/) || [])[1] || null;
  const bg = (chip.match(/\bbg-\[(#[0-9a-f]{6})\]/) || [])[1] || null;
  return (border === TIER_POLAR ? 2 : border ? 1 : 0) + (bg === TIER_POLAR ? 1 : 0);
};
const tierRanks = TIER_KEYS.map(tierFillRank);
const tierMonotone = tierRanks.every((v, i) => i === 0 || v > tierRanks[i - 1]);
check(
  '反派階級的填充階嚴格遞增（序由形狀承擔）',
  TIER_DECL.length > 0 && tierMonotone,
  tierMonotone
    ? `填充階 ${tierRanks.join(' → ')}（無框→中性框→極性框→實心）`
    : `不是嚴格遞增：${TIER_KEYS.map((k, i) => `${k}=${tierRanks[i]}`).join('、')}`
);

// H17-e. 三階 ink 必須全等且等於極性紅；非反派必須是墨，而且**不是**「比較不紅」。
// 這一條是整個判準的核心：序共用一個顏色，程度交給填充。
const tierInkOf = (k) => ((tierField(k, 'ink').match(/(#[0-9a-fA-F]{6})/) || [])[1] || '').toLowerCase();
const tierPolarInks = ['minor', 'major', 'supreme'].map(tierInkOf);
const tierNeutralInk = tierInkOf('none');
const tierPolarOk = tierPolarInks.every((h) => h === TIER_POLAR);
const tierNeutralOk = !!tierNeutralInk && tierNeutralInk !== TIER_POLAR && REGISTERED_HEX.has(tierNeutralInk);
check(
  '反派三階共用同一個極性色，非反派用墨',
  tierPolarOk && tierNeutralOk,
  tierPolarOk && tierNeutralOk
    ? `三階 ink 皆 ${TIER_POLAR}；非反派 ${tierNeutralInk}`
    : `三階 ink：${tierPolarInks.join('、')}；非反派 ${tierNeutralInk || '缺'}`
);

const tierChipLow = [];
for (const k of TIER_KEYS) {
  const chip = tierField(k, 'chip');
  const fg = (chip.match(/text-\[(#[0-9a-fA-F]{6})\]/) || [])[1];
  const bg = (chip.match(/bg-\[(#[0-9a-fA-F]{6})\]/) || [])[1] || '#fffdf9';
  if (!fg) { tierChipLow.push(`${k}：找不到字色`); continue; }
  const r = contrast(fg.toLowerCase(), bg.toLowerCase());
  if (r < AA) tierChipLow.push(`${k} ${fg} on ${bg} = ${r.toFixed(2)}`);
}
check(
  '反派階級晶片對比 ≥ 4.5:1',
  tierChipLow.length === 0,
  tierChipLow.length ? `${tierChipLow.length} 階不合規：${tierChipLow[0]}` : '0 階／4 階都過 AA'
);

// H18. 「同一個色相家族同時做底與字」的行數（第二十三輪新增的量測維度）。
//
// 一行裡同時出現 `bg-X-100` 與 `text-X-900`，就是**用顏色當身份**：底色與字色同族，
// 讀者看到的不是「一個元件」，是「一個被塗成某種顏色的東西」。
// 這一條是**預算**（H11 的形狀），不是硬零——全站還有大量**狀態**色（toast、驗證、
// 刪除鈕、危險提示）本來就該紅，要逐檔判斷。只准減，不准增。
// 第二十三輪把 `NPCCardPreview`（4→0）、`constants.js`（3→0）、`NPCWorkshop` 的四處
// 一次降下來，並把當時的量測值釘成預算。
const TRIAD_FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const TRIAD_BG = new RegExp(`bg-(?:${TRIAD_FAMILIES})-\\d{2,3}`, 'g');
const TRIAD_TX = new RegExp(`text-(?:${TRIAD_FAMILIES})-\\d{2,3}`, 'g');
// 第二十五輪：213 → 180（三個色相家族在容器／狀態／量／出處四種語意上退場）。
const TRIAD_BUDGET = 180;
const triadLines = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  fs.readFileSync(abs, 'utf8')
    .split('\n')
    .map(stripInlineComments)
    .forEach((line, i) => {
      const bg = [...line.matchAll(TRIAD_BG)].map((m) => m[0].slice(3).replace(/-\d+$/, ''));
      const tx = [...line.matchAll(TRIAD_TX)].map((m) => m[0].slice(5).replace(/-\d+$/, ''));
      if (bg.some((h) => tx.includes(h))) triadLines.push(`${rel}:${i + 1}`);
    });
}
check(
  '「同族底色＋字色」行數不超過預算（只能減）',
  triadLines.length <= TRIAD_BUDGET,
  `${triadLines.length} / 預算 ${TRIAD_BUDGET}${triadLines.length > TRIAD_BUDGET ? `　超出：${triadLines.slice(0, 3).join('、')}` : ''}`
);

// ─────────────────────────────────────────────────────────────────────────────
// H19：fuchsia 家族硬零（第二十四輪）
//
// 這個色相在本輪之前同時承擔**三種互不相干的語意**：
//   1. `isSecretArt`（祕技）—— 規則書上的**標記**，四個消費端各寫一次
//   2. `isFreeModeEnabled`（自定義模式）—— 使用者**開啟的模式**
//   3. 解鎖限制徽章的**計數**（`SectionAccordion` 的 n/∞）
//
// 同一個色相被三個意思共用，它就不是身份，是**裝飾**——而且是會誤導的裝飾：
// 看到紫紅色的人無法分辨「這是祕技」還是「這裡鎖住了」。
// 這正是第二十三輪判準的第四次現形：**一張卡只能有一個身份色**，
// 而這三種東西一個都不是身份——一個是標記，一個是模式，一個是量。
//
// 三種語意各自的**具名通道**（H19-a 逐條驗：刪掉色相不等於修好）：
//   標記 → 符號詞彙 `※` ＋「祕技」二字（GEMINI.md 軌道 3 的封閉詞彙，不新增符號）
//   模式 → 強調色 `#a63d40`（全站「這裡可以按／這裡需要注意」的既有語意）
//   計數 → 墨階 `#6b5a4b` ／ `#f4ebd9`（量不是身份，第十四輪裁定）
//
// ⚠️ 這條是**硬零**，不是預算。要再加紫紅家族成員，先回答「它是哪一種」，
// 然後走上面三條通道之一——不要讓第四種語意再借同一個色相。
const FUCHSIA_TOKEN =
  /(?:hover:|focus:|active:|disabled:|group-hover:)?(?:text|bg|border|border-[lrtbxy]|ring|from|to|via|fill|stroke|divide|outline|decoration|accent|caret|placeholder|shadow)-fuchsia-\d{2,3}(?:\/\d+)?/g;
const fuchsiaHits = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8'))
    .split('\n')
    .forEach((line, i) => {
      const n = (line.match(FUCHSIA_TOKEN) || []).length;
      if (n) fuchsiaHits.push(`${rel}:${i + 1}×${n}`);
    });
}
check(
  'H19 fuchsia 家族全站零殘留',
  fuchsiaHits.length === 0,
  fuchsiaHits.length ? `${fuchsiaHits.length} 處：${fuchsiaHits.slice(0, 3).join('、')}` : '0 處（三種語意已各自走具名通道）'
);

// H19-a：替代通道必須**真的存在**。
// 硬零護欄可以因為「規則生效」而變綠，也可以因為「它根本沒在看」而變綠——
// 這一條是反向控制：把色相刪掉卻沒補上通道，H19 會綠、H19-a 會紅。
const SECRET_MARK = '※ 祕技';
const secretMarkFiles = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  if (fs.readFileSync(abs, 'utf8').includes(SECRET_MARK)) secretMarkFiles.push(path.basename(abs));
}
const freeModeSrc = fs.readFileSync(
  path.join(ROOT, 'src/features/npc-workshop/components/FreeModeConfirmModal.jsx'),
  'utf8'
);
const badgeSrc = fs.readFileSync(
  path.join(ROOT, 'src/features/npc-workshop/components/SectionAccordion.jsx'),
  'utf8'
);
const hueChannels = [
  [`標記（${SECRET_MARK}，恰好 3 檔）`, secretMarkFiles.length === 3],
  ['模式（#a63d40 框＋底）', freeModeSrc.includes('border-[#a63d40]') && freeModeSrc.includes('bg-[#a63d40]')],
  ['計數（墨階徽章）', badgeSrc.includes('text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab]')]
];
check(
  'H19-a 三種語意各有具名替代通道',
  hueChannels.every(([, ok]) => ok),
  hueChannels.map(([k, ok]) => `${ok ? '✓' : '✗'} ${k}`).join('　')
);

// ─────────────────────────────────────────────────────────────────────────────
// H20：保留色——身份表用掉的色相，其他語意一律不得借用（第二十五輪）
//
// 前四輪處理的是「這張表該不該有顏色」：九相（身份，一對一）、四屬性（身份，一對一）、
// 相性狀態（序，只講極性）、反派階級（刻度，只講極性）、祕技／模式／計數（三條具名通道）。
// 每一輪都問「**這個東西**是什麼」。這一輪問的是另一件事：
//
//   > **這個色相，是不是已經被某張身份表登記走了？**
//
// 實測 purple 在 `src/` 有 107 個令牌、承擔 **六種**語意：
//   ① 物種身份 MONSTER（`speciesThemes.jsx`）——**身份**
//   ② 職業徽章（`characterThemes.badgeVariant` → `JRPGBadge`）——**身份**
//   ③ 魔法球／魔科技區塊容器（TinkererGadgetsModal／QuickRef／RuleCodexDrawer）
//   ④ 詩歌「曲風」欄位標籤（SuboptionDetailsList／SkillSuboptionModal）
//   ⑤ 選中態（魔法球卡片、攻擊性咒語公式）
//   ⑥ 量（MP／IP 晶片）
//
// ②③④⑤⑥ 單看每一處都「合理」——問題在於 ① 已經把 purple 登記成「MONSTER」了。
// 讀者看到卡片上的紫，學到的是「這隻怪的物種是 MONSTER」；而同一頁的 MP 晶片、
// 選中的卡片、區塊外框也是紫，於是那個訊號**當場失效**。
//
// 判準因此升級成一條**全局**規則（前四輪都是局部規則）：
//
//   > **身份色是保留色（reserved hue）。一個色相一旦被某張身份表的一格佔用，
//   > 其他任何語意都不得再借它——包括「只是裝飾」。**
//
// 這比「撞色」更嚴格：撞色是兩個身份撞在一起（§CI28），這裡是**身份與非身份**撞在一起。
//
// 三個家族的量測（`stripComments` 後全 `src/`）與判決：
//
// | 家族 | 令牌 | 身份出口 | 判決 |
// |---|---|---|---|
// | `purple` | 107 → **6** | 物種 MONSTER ＋ 職業徽章 | 只准留在兩個出口 |
// | `indigo` | 85 → **6** | 物種 UNDEAD ＋ 規則書徽章 | 只准留在兩個出口 |
// | `violet` | 29 → **0** | **無**（沒有任何身份表用 violet） | 全站硬零 |
//
// ⚠️ 這一條是**硬零＋白名單**，不是預算。預算允許「這裡加一個、那裡減一個」，
// 而這裡的退化正是「換一個地方偷偷用回去」——所以白名單必須是**檔案級**的。
const RESERVED = (fam) =>
  new RegExp(
    `(?:[a-z-]+:)*(?:text|bg|border|border-[lrtbxy]|ring|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-${fam}-\\d{2,3}(?:\\/\\d+)?`,
    'g'
  );

// 這兩個檔案是**身份出口**，不是消費端：
//   `speciesThemes.jsx` —— 八物種的封閉身份集（§CI31.3：卡片上唯一有資格帶身份色的東西）
//   `JRPGBadge.jsx`     —— 身份徽章的**註冊表**（第十五輪裁定 badgeVariant 保留）
// 註冊表本身有顏色不是違規；違規的是**註冊表以外的任何一處**。
const IDENTITY_OUTLETS = [
  'src/features/npc-workshop/data/speciesThemes.jsx',
  'src/components/ui/JRPGBadge.jsx',
];
const reservedHits = { purple: [], indigo: [], violet: [] };
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const fam of ['purple', 'indigo', 'violet']) {
    const n = (src.match(RESERVED(fam)) || []).length;
    if (n) reservedHits[fam].push({ rel, n, outlet: IDENTITY_OUTLETS.includes(rel) });
  }
}

const violetLeft = reservedHits.violet.reduce((a, h) => a + h.n, 0);
check(
  'H20 violet 家族全站零殘留（它沒有任何身份出口）',
  violetLeft === 0,
  violetLeft
    ? `${violetLeft} 處：${reservedHits.violet.map((h) => `${h.rel}×${h.n}`).join('、')}`
    : '0 處（公測標記走 △ ＋ 墨階，選中態走墨框）'
);

const leaked = [...reservedHits.purple, ...reservedHits.indigo].filter((h) => !h.outlet);
const leakTotal = leaked.reduce((a, h) => a + h.n, 0);
check(
  'H20-a purple／indigo 只留在兩個身份出口',
  leakTotal === 0,
  leakTotal
    ? `${leakTotal} 處外洩：${leaked.map((h) => `${h.rel}×${h.n}`).join('、')}`
    : `0 處外洩／出口 ${IDENTITY_OUTLETS.map((f) => path.basename(f)).join('、')}`
);

// H20-b：白名單的**形狀**。允許兩個檔案有顏色，前提是它們真的是「一對一」的身份表——
// 否則白名單會變成「這兩個檔案愛怎麼用顏色就怎麼用」的後門。
const speciesSrc = stripComments(read('src/features/npc-workshop/data/speciesThemes.jsx'));
const speciesColors = [...speciesSrc.matchAll(/\bcolor: '([a-z]+)'/g)].map((m) => m[1]);
check(
  'H20-b 物種身份表一對一（八物種 → 八個相異色）',
  speciesColors.length === 8 && new Set(speciesColors).size === 8,
  `${speciesColors.length} 個物種／${new Set(speciesColors).size} 個相異色：${speciesColors.join(' ')}`
);

// H20-c：出處通道。八種「這個數字哪來的」在這一輪之前是八個色相家族
// （level amber／class emerald／skill indigo／heroic violet／quirk rose／status red）。
// 出處不是身份（§CI31.5 同一條判準）——八階必須齊備，但**晶片只能有一種**，
// 唯一的例外是 `status`（狀態異常是危險極性）。
const formulaSrc = stripComments(read('src/features/character-sheet/components/StatFormulaPanel.jsx'));
const kindBlock = (formulaSrc.match(/const KIND_STYLES = \{([\s\S]*?)\n\};/) || [])[1] || '';
const kindKeys = [...kindBlock.matchAll(/^\s{2}([a-z]+): \{/gm)].map((m) => m[1]);
const kindChips = [...kindBlock.matchAll(/chip: '([^']*)'/g)].map((m) => m[1]);
const kindPolarity = (kindBlock.match(/status: \{[^}]*\}/) || [''])[0].includes('#8c2d36');
check(
  'H20-c 八種出處齊備，晶片只剩「中性」與「危險極性」兩種',
  kindKeys.length === 8 && new Set(kindChips).size <= 2 && kindPolarity,
  `${kindKeys.length} 階（${kindKeys.join('／')}）／chip 值 ${new Set(kindChips).size} 種${kindPolarity ? '' : '　✗ status 沒有極性'}`
);

// H20-d：標記通道。公測變體原本是 violet（全站唯一一個「只出現在公測語意」的家族），
// 收斂後走**符號 ＋ 墨階**——`△` 取自 GEMINI.md 軌道 3 的封閉詞彙，不新增符號。
// 兩個消費端（技能卡、職業選擇）都必須有；少一個＝漏改，多一個＝有第三個消費端沒登記。
const playtestMarkFiles = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  if (fs.readFileSync(abs, 'utf8').includes('△ 公測')) playtestMarkFiles.push(path.basename(abs));
}
check(
  'H20-d 公測標記走「△ ＋ 墨階」，恰好 2 個消費端',
  playtestMarkFiles.length === 2,
  `${playtestMarkFiles.length} 檔：${playtestMarkFiles.join('、')}`
);

// H20-e：量通道。MP／IP 是量（第十四輪裁定），量走墨階晶片——
// 三個令牌必須**同一行**，否則晶片會拆成三塊（§CI32.5 同一條形狀）。
//
// ⚠️ 這一條刻意寫成「**逐一都必須成立**」而不是「至少有一個」：
// 第一版是 `subSrc.includes('bg-[#f4ebd9] text-[#6b5a4b] …')`，而這個檔在收斂之後
// 有**四顆長得一樣的晶片**，於是「把其中一顆拆成三行」仍然是綠的——
// 護欄看的是「還有另一顆活著」，不是「這一顆沒壞」。刻意破壞驗證抓到它（紅⑦ 假綠）。
// 第二版改成「以 MP 文字那一行為錨，往上看它的 `<span>`」，兩檔逐一驗。
const MP_CHIP_FILES = [
  'src/features/character-sheet/components/SuboptionDetailsList.jsx',
  'src/features/character-sheet/components/SkillSuboptionModal.jsx',
];
const mpChipBad = [];
let mpChipCount = 0;
for (const rel of MP_CHIP_FILES) {
  const lines = read(rel).split('\n').map(stripInlineComments);
  lines.forEach((line, i) => {
    if (!/\{(?:detail|item)\.mp\} MP/.test(line)) return;
    mpChipCount += 1;
    const spanLine = lines[i - 1] || '';
    const ok =
      spanLine.includes('bg-[#f4ebd9]') &&
      spanLine.includes('text-[#6b5a4b]') &&
      spanLine.includes('border-[#d6c7ab]');
    if (!ok) mpChipBad.push(`${path.basename(rel)}:${i}`);
  });
}
check(
  'H20-e MP 晶片走墨階三件套（逐一，同一行）',
  mpChipCount >= 2 && mpChipBad.length === 0,
  `${mpChipCount} 顆／${mpChipBad.length} 顆壞掉${mpChipBad.length ? `：${mpChipBad[0]}` : ''}`
);

// H21：造物工坊的空狀態走 `EmptyState`（第十一輪改的，第五輪之後才有護欄）。
//
// 這一條的判準不是「有沒有 EmptyState 這個字」，是**三個空狀態各自的文案都在
// `<EmptyState>` 的 220 字元內**——擋的是「把文案搬回裸 `<p>`，元件留在原地當裝飾」。
const tinkererWsSrc = read('src/features/character-sheet/components/companions/TinkererWorkshop.jsx');
const tinkererWsKinds = [...tinkererWsSrc.matchAll(/kind="(tinkerer-[a-z-]+)"/g)].map((m) => m[1]);
const tinkererWsEmptyOk = ['尚未指派藥劑目標', '尚未指派藥劑效果', '還沒有進行中的造物專案'].every((t) => {
  const i = tinkererWsSrc.indexOf(t);
  if (i < 0) return false;
  return /<EmptyState[\s\S]{0,220}$/.test(tinkererWsSrc.slice(0, i));
});
check(
  'H21 造物工坊三個空狀態都走 EmptyState（文案在元件內）',
  new Set(tinkererWsKinds).size === 3 && tinkererWsEmptyOk,
  `${new Set(tinkererWsKinds).size} 個 kind：${[...new Set(tinkererWsKinds)].join('、')}${tinkererWsEmptyOk ? '' : '　✗ 有文案跑到元件外'}`
);

// H22：裝飾性彈跳硬零。
//
// `animate-bounce` 與 `animate-pulse` 同一個病灶：Tailwind 的動畫永遠 infinite，
// 所以「提醒你點這裡」的彈跳最後變成**常駐噪音**——而且它會把視線從內容搶走。
// 第九輪只收了 `animate-pulse`（26 → 0），`animate-bounce` 留了 5 處「等下一輪」，
// 這一輪收完：0。要「這裡可以按」請用強調色 `#a63d40`，不要用動作。
const bounceSrc = walkSrc(path.join(ROOT, 'src'))
  .map((abs) => stripComments(fs.readFileSync(abs, 'utf8')))
  .join('\n');
check(
  'H22 animate-bounce 全站零殘留',
  count(bounceSrc, 'animate-bounce') === 0,
  `${count(bounceSrc, 'animate-bounce')} 處`
);

// H23：`amber` 家族（第二十六輪）。
//
// 這條跟 H20 同一個判準，只是對象大得多：本輪開場實測 `amber` 828 處／`yellow` 6／
// `orange` 4，共 838 個令牌、43 個檔案，佔全站殘餘色相令牌的 **56%**。它同時在當
// 物種 BEAST 的身份色、五種警示、選中態、量（星等／選格數／解鎖等級）、出處（系統
// 技能左條）、主動作按鈕、以及一堆純裝飾。**一個色相包辦七種語意**，跟第二十五輪
// 的 `purple` 是同一個病，只是劑量高八倍。
//
// 判準照抄 §CI33：先問「這個色相被哪張身份表登記走了」。答案是 `speciesThemes` 的
// `sp_beast`。所以 `amber` 是**保留色**——除了身份出口，其他語意一律不得再借。
//
// 為什麼是硬零而不是預算：預算允許「這裡加一個、那裡減一個」，而這裡的退化正是
// **換一個地方偷偷用回去**。只要允許非零，`amber` 遲早又會長回警示框。
const AMBER_FAMS = /(?:[a-z-]+:)*(?:text|bg|border|border-[lrtbxy]|ring|ring-offset|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:amber|yellow|orange)-\d{2,3}(?:\/\d+)?/g;
// 兩個身份出口：物種 BEAST（`sp_beast`）與規則書 #1 的徽章變體（`amber:`）。
const AMBER_OUTLETS = {
  'src/features/npc-workshop/data/speciesThemes.jsx': 'sp_beast:',
  'src/components/ui/JRPGBadge.jsx': 'amber:',
};
const amberLeak = [];
const amberOutletRows = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  const tokens = body.match(AMBER_FAMS) || [];
  if (!tokens.length) continue;
  if (!AMBER_OUTLETS[rel]) {
    amberLeak.push(`${rel}（${tokens.length}）`);
    continue;
  }
  // 逐項，不是「至少一個」：白名單檔裡**每一行**出現 amber 的行，
  // 都必須是那一張身份表的那一格。多一行就代表有人在裡面偷加裝飾。
  body.split('\n').forEach((line, i) => {
    if (!AMBER_FAMS.test(line)) return;
    AMBER_FAMS.lastIndex = 0;
    const t = line.trim();
    if (!t.startsWith(AMBER_OUTLETS[rel])) amberOutletRows.push(`${rel}:${i + 1} → ${t.slice(0, 40)}`);
  });
}
check(
  'H23 amber／yellow／orange 只留在兩個身份出口（其餘全站硬零）',
  amberLeak.length === 0,
  amberLeak.length
    ? `${amberLeak.length} 檔外洩：${amberLeak.slice(0, 4).join('、')}`
    : `0 處外洩／出口 ${Object.keys(AMBER_OUTLETS).map((p) => p.split('/').pop()).join('、')}`
);
check(
  'H23-a 身份出口裡 amber 只准出現在那一行（逐項）',
  amberOutletRows.length === 0,
  amberOutletRows.length ? amberOutletRows.slice(0, 3).join('；') : '2 檔、各 1 行，沒有夾帶'
);

// H23-b：琥珀的原始 hex 階硬零。
//
// 令牌收乾淨了，還有第二條路：直接寫 hex。`#b45309` 就是 amber-700，本輪開場有
// **29 處**——它幾乎全部是 `theme?.accent || '#b45309'` 這種主題預設值，畫面上跟
// 令牌版本同一個顏色。只收令牌不收 hex，等於宣告歸零而牆上還留著同一個色。
// `#78350f`（amber-900）刻意不列：它是棕色強調 `#8b5e34` 的 hover，屬於另一條待收的線。
const AMBER_HEX = ['#b45309', '#f59e0b', '#d97706', '#92400e', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7', '#fffbeb', '#451a03'];
const amberHexHits = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const body = stripComments(fs.readFileSync(abs, 'utf8')).toLowerCase();
  for (const h of AMBER_HEX) {
    const n = count(body, h);
    if (n) amberHexHits.push(`${rel}:${h}×${n}`);
  }
}
check(
  'H23-b 琥珀原始 hex 階全站硬零',
  amberHexHits.length === 0,
  amberHexHits.length ? amberHexHits.slice(0, 4).join('、') : `0 處／檢查 ${AMBER_HEX.length} 個 hex`
);

// H23-c：琥珀發光硬零。
//
// 收斂時最容易被留下來的就是「發光」——因為它寫在 `shadow-[...]` 裡，不是色相令牌，
// 任何數令牌的護欄都看不到它。本輪拆掉兩處：已學會的星等光暈、填滿星號的投影。
const amberGlow = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const rgb of ['rgba(245,158,11', 'rgba(251,191,36', 'rgba(217,119,6']) {
    const n = count(body, rgb);
    if (n) amberGlow.push(`${rel}:${rgb}×${n}`);
  }
}
check('H23-c 琥珀發光（rgba 光暈）全站硬零', amberGlow.length === 0, amberGlow.length ? amberGlow.slice(0, 3).join('、') : '0 處');

// H23-d：另一個暖強調色只減不增（預算）。
//
// 這個專案其實有**三個**暖強調色：登記的 `#a63d40`（131 處）、書頁棕 `#8b5e34`（86 處）
// 加它的 hover `#78350f`（56 處）、以及本輪才收掉的 `#b45309`（29 處）。
//
// 為什麼這條用預算，而 H23 用硬零？因為兩者的退化模式相反：
// `amber` 的退化是**悄悄用回去**（加一個不會被發現），所以只能硬零；
// 而這裡的退化是**替代**——把 `amber` 換成 `#8b5e34`，總數一定上升。
// 預算抓的正是「上升」，而它允許的「這裡減、那裡加」在這裡反而是對的：
// 書頁棕本來就該逐輪往下收，收到 0 是下一輪的事。
//
// 開場 85 + 56 = 141（去掉註解後，註解裡提到的不算），本輪沒有動它，所以基準就是 141：任何一處新增都會紅。
const BROWN_ACCENT_BUDGET = 141;
const ACCENT_BROWN = '#8b5e34';
const brownSrc = walkSrc(path.join(ROOT, 'src'))
  .map((abs) => stripComments(fs.readFileSync(abs, 'utf8')).toLowerCase())
  .join('\n');
const brownNow = count(brownSrc, ACCENT_BROWN) + count(brownSrc, '#78350f');
check(
  'H23-d 書頁棕強調色只減不增（預算 141）',
  brownNow <= BROWN_ACCENT_BUDGET,
  `${brownNow} / 預算 ${BROWN_ACCENT_BUDGET}`
);

// H23-e：強調底上的字必須是登記的淺色，不是純白。
//
// `#fffdf9` 是登記的「墨面上的淺字」；`text-white` 不在登記表裡，而且在羊皮紙的暖白
// 旁邊會顯出一塊冷白。本輪在 54 處強調底上把 `text-white` 換成 `#fffdf9`，這條把它鎖住。
const whiteOnAccent = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    if (!/bg-\[#(?:a63d40|8c3235|76252d)\]/.test(line)) return;
    if (/(?:^|[\s"'`])text-white(?:[\s"'`]|$)/.test(line)) whiteOnAccent.push(`${rel} → ${line.trim().slice(0, 50)}`);
  });
}
check(
  'H23-e 強調底上的字是登記淺色 #fffdf9，不是純白',
  whiteOnAccent.length === 0,
  whiteOnAccent.length ? `${whiteOnAccent.length} 行：${whiteOnAccent.slice(0, 3).join('、')}` : '0 處'
);

// H24：`red`／`rose`／`pink` 家族（第二十七輪）。
//
// 開場實測 299 個令牌／33 個檔案，是全站殘餘色相裡最大的一群。它同時在當：
// 物種 DEMON 的身份色、六本規則書裡「公測修訂」的身份色、美食家「甜味」的身份色、
// 危險極性（錯誤框／刪除鍵）、HP 條、危機徽章、冠位／精英的等級標籤、裝備「職業」
// 限定標記、敵方數量晶片、三張資源磚（HP／MP／IP）。
//
// 判準照抄 §CI33／§CI34：先問「這個色相被哪張身份表登記走了」。答案有三張——
// `speciesThemes` 的 `sp_demon`、`JRPGBadge` 的 `rose` 列（硃砂紅主題 ＋ 公測修訂）、
// `GourmetCookbook` 的 `甜味`。所以紅是**保留色**。
//
// 但紅跟琥珀不同。琥珀被拿掉之後只剩身份；紅被拿掉之後**危險就沒有顏色了**。
// 這一輪的處置是：危險留下全站唯一的那個紅（登記色 `#8c2d36`），其餘全部改走
// 「序」（填充量）與「標記」（零色）。所以下面這組硬零有一條例外線：`#8c2d36`
// 可以用，但**只准當危險極性**——不准當身份、不准當裝飾。
const ROSE_FAMS = /(?:[a-z-]+:)*(?:text|bg|border|border-[lrtbxy]|ring|ring-offset|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:red|rose|pink)-\d{2,3}(?:\/\d+)?/g;
// 三個身份出口。注意 `JRPGBadge` 的 `rose` 列有**兩個**身份消費者：
// 硃砂紅角色主題（characterThemes）與公測修訂規則書（sourcebookConfig）。
const ROSE_OUTLETS = {
  'src/features/npc-workshop/data/speciesThemes.jsx': 'sp_demon:',
  'src/components/ui/JRPGBadge.jsx': 'rose:',
  'src/features/character-sheet/components/companions/GourmetCookbook.jsx': '甜味:',
};
const roseLeak = [];
const roseOutletRows = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  const tokens = body.match(ROSE_FAMS) || [];
  if (!tokens.length) continue;
  if (!ROSE_OUTLETS[rel]) {
    roseLeak.push(`${rel}（${tokens.length}）`);
    continue;
  }
  // 逐項：白名單檔裡每一行出現紅家族令牌的行，都必須是那一張身份表的那一格。
  body.split('\n').forEach((line, i) => {
    ROSE_FAMS.lastIndex = 0;
    if (!ROSE_FAMS.test(line)) return;
    ROSE_FAMS.lastIndex = 0;
    const t = line.trim();
    if (!t.startsWith(ROSE_OUTLETS[rel])) roseOutletRows.push(`${rel}:${i + 1} → ${t.slice(0, 40)}`);
  });
}
check(
  'H24 red／rose／pink 只留在三個身份出口（其餘全站硬零）',
  roseLeak.length === 0,
  roseLeak.length
    ? `${roseLeak.length} 檔外洩：${roseLeak.slice(0, 4).join('、')}`
    : `0 處外洩／出口 ${Object.keys(ROSE_OUTLETS).map((p) => p.split('/').pop()).join('、')}`
);
check(
  'H24-a 身份出口裡紅家族只准出現在那一行（逐項）',
  roseOutletRows.length === 0,
  roseOutletRows.length ? roseOutletRows.slice(0, 3).join('；') : '3 檔、共 4 行，沒有夾帶'
);

// H24-b：紅家族的原始 hex 只准出現在珠色身份表裡。
//
// 令牌收乾淨了，還有第二條路：直接寫 hex。Tailwind 的紅階（`#ef4444` 之類）
// 與登記色 `#8c2d36` 是兩個不同的紅，肉眼分不出來、但系統裡是兩個顏色。
// 全站只剩 `technospheres.js` 的兩張珠色身份表（職業珠色／傷害屬性珠色）還在用
// 原始 hex——那是本輪**沒有動**的債（11 個身份色全部未登記），列在 §CI35 的收尾清單。
const RED_RAW_HEX = [
  '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a',
  '#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337', '#4c0519',
  '#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843', '#500724',
];
const BEAD_TABLE = 'src/features/character-sheet/data/technospheres.js';
const BEAD_ROW = /^\s*[A-Za-z\u4e00-\u9fa5]+:\s*'#[0-9a-fA-F]{6}'/;
const redHexLeak = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    const low = line.toLowerCase();
    if (!RED_RAW_HEX.some((h) => low.includes(h))) return;
    if (rel === BEAD_TABLE && BEAD_ROW.test(line)) return;
    redHexLeak.push(`${rel}:${i + 1} → ${line.trim().slice(0, 46)}`);
  });
}
check(
  'H24-b 紅家族原始 hex 只准出現在珠色身份表（逐行）',
  redHexLeak.length === 0,
  redHexLeak.length ? `${redHexLeak.length} 行：${redHexLeak.slice(0, 3).join('、')}` : '0 處／33 個 hex'
);

// H24-c：紅光暈硬零。
//
// `shadow-[0_0_12px_rgba(239,68,68,.5)]` 這種東西是「AI 感」的來源之一。
// 本輪開場量測為 0，這條把它鎖在 0。
const RED_GLOW = [
  /rgba\(\s*239\s*,\s*68\s*,\s*68/, /rgba\(\s*220\s*,\s*38\s*,\s*38/, /rgba\(\s*185\s*,\s*28\s*,\s*28/,
  /rgba\(\s*190\s*,\s*18\s*,\s*60/, /rgba\(\s*244\s*,\s*63\s*,\s*94/, /rgba\(\s*236\s*,\s*72\s*,\s*153/,
  /rgba\(\s*225\s*,\s*29\s*,\s*72/,
];
const redGlow = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const re of RED_GLOW) {
    const m = body.match(re);
    if (m) redGlow.push(`${rel} → ${m[0]}`);
  }
}
check('H24-c 紅光暈（rgba 光暈）全站硬零', redGlow.length === 0, redGlow.length ? redGlow.slice(0, 3).join('、') : '0 處');

// H24-d：呼叫端用到的每一個 `variant` 名稱，都必須在 `variantStyles` 裡登記過。
//
// 這條不是風格偏好，是**抓靜默失效**：`JRPGBadge` 讀
// `variantStyles[variant] || variantStyles.gold`，打錯字或忘了登記的變體不會報錯，
// 只會安靜地變成金色徽章。本輪新加的 `danger`／`rank-top`／`rank-mid`／`marker`
// 就是靠這條鎖住的。
//
// 為什麼要掃「元素」而不是掃「行」：`variant` 是全站共用的 prop 名，`<Button variant="primary">`
// 有 13 處。只掃含 `variant` 的行會把它們全部誤判成未登記的徽章變體（第一版就是這樣，
// 56 個假陽性）。所以先把每個 `<JRPGBadge …>` 元素切出來，只看它自己的開頭標籤。
const BADGE_FILE = 'src/components/ui/JRPGBadge.jsx';
const badgeMapSrc = stripComments(fs.readFileSync(path.join(ROOT, BADGE_FILE), 'utf8'));
const variantBlockStart = badgeMapSrc.indexOf('const variantStyles = {');
const variantBlockEnd = badgeMapSrc.indexOf('\n  };', variantBlockStart);
const KNOWN_VARIANTS = new Set(
  [...badgeMapSrc.slice(variantBlockStart, variantBlockEnd).matchAll(/^\s*"?([a-z][a-z-]*)"?:\s*"/gm)].map((m) => m[1])
);

/** 取出開頭標籤裡 `variant` 的字面值：`variant="x"`、`variant={'x'}`、`variant={a ? 'x' : 'y'}` */
function variantValuesIn(tag) {
  const out = [];
  const direct = tag.match(/variant="([a-z][a-z-]*)"/);
  if (direct) out.push(direct[1]);
  const idx = tag.indexOf('variant={');
  if (idx >= 0) {
    let depth = 0;
    let end = tag.length;
    for (let i = idx + 'variant='.length; i < tag.length; i += 1) {
      if (tag[i] === '{') depth += 1;
      else if (tag[i] === '}') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const expr = tag.slice(idx + 'variant={'.length, end);
    for (const m of expr.matchAll(/['"]([a-z][a-z-]*)['"]/g)) out.push(m[1]);
  }
  return out;
}

/** 把每個 `<JRPGBadge …>…</JRPGBadge>` 元素切出來（含開頭標籤與內容） */
function jrpBadgeElements(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('<JRPGBadge', i)) >= 0) {
    let depth = 0;
    let tagEnd = i + 200;
    for (let j = i; j < i + 200; j += 1) {
      const c = src[j];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) { tagEnd = j; break; }
    }
    const close = src.indexOf('</JRPGBadge>', tagEnd);
    const limit = close >= 0 && close - tagEnd < 400 ? close + '</JRPGBadge>'.length : tagEnd + 1;
    out.push({
      line: src.slice(0, i).split('\n').length,
      openTag: src.slice(i, tagEnd + 1),
      text: src.slice(i, limit),
    });
    i = limit;
  }
  return out;
}

const unknownVariants = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  if (!abs.endsWith('.jsx')) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const el of jrpBadgeElements(body)) {
    for (const v of variantValuesIn(el.openTag)) {
      if (!KNOWN_VARIANTS.has(v)) unknownVariants.push(`${rel}:${el.line} → ${v}`);
    }
  }
  // 徽章也可能以物件形式傳進 `EquipmentSlotCard` 的 `badges` 陣列（`{ label, variant }`）。
  body.split('\n').forEach((line, i) => {
    if (!line.includes('label:') || !line.includes('variant:')) return;
    for (const m of line.matchAll(/variant:\s*'([a-z][a-z-]*)'/g)) {
      if (!KNOWN_VARIANTS.has(m[1])) unknownVariants.push(`${rel}:${i + 1} → ${m[1]}`);
    }
  });
}
check(
  'H24-d 每個用到的徽章 variant 都登記過（否則靜默變成金色）',
  unknownVariants.length === 0,
  unknownVariants.length
    ? `${unknownVariants.length} 處未登記：${unknownVariants.slice(0, 4).join('、')}`
    : `${KNOWN_VARIANTS.size} 個登記變體，呼叫端零筆錯字`
);

// H24-e：三種語意徽章不得借用色相。
//
// 「危機」是危險極性 → `danger`；「職業」是標記 → `marker`；
// 冠位／精英／一般 是序 → `rank-top`／`rank-mid`／`slate`（填充量遞減）。
// 這三種在第二十七輪之前全部用色相（rose／cyan／slate），也就是**一個色相三個意思**：
// 紅同時是「怪物身份」「冠位」「職業限定」「危機」「刪除鍵」「HP 條」。
//
// 這條看的是**整個元素**（含子節點），因為「危機」這兩個字寫在 `<span>` 裡，
// 而 `variant` 寫在開頭標籤上。
const ORDINAL_VARIANTS = new Set(['rank-top', 'rank-mid', 'slate']);
const semanticBadgeMiss = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  if (!abs.endsWith('.jsx')) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const body = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const el of jrpBadgeElements(body)) {
    const vs = variantValuesIn(el.openTag);
    if (!vs.length) continue;
    const at = `${rel}:${el.line}`;
    if (/危機|CRISIS/.test(el.text) && !vs.includes('danger')) semanticBadgeMiss.push(`${at} 危機 → ${vs.join('/')}`);
    if (/職業/.test(el.text) && !vs.includes('marker')) semanticBadgeMiss.push(`${at} 職業 → ${vs.join('/')}`);
    if (/冠位/.test(el.text) && !vs.every((v) => ORDINAL_VARIANTS.has(v))) {
      semanticBadgeMiss.push(`${at} 序 → ${vs.join('/')}`);
    }
  }
}
check(
  'H24-e 危機／職業／冠位三種語意徽章走登記語意，不借色相',
  semanticBadgeMiss.length === 0,
  semanticBadgeMiss.length ? semanticBadgeMiss.slice(0, 4).join('；') : '危險＝danger、標記＝marker、序＝rank-top/mid/slate'
);

// H24-f：紅家族令牌總數只減不增（預算 10）。
//
// 前三條保證「外面是 0、裡面只有那幾行」。這條是**天花板**：出口自己的行數
// 也可能被人加回去（例如在 `sp_demon` 那一行多塞一個 `bg-red-500`）。
// 用預算而不是硬零，因為出口本來就該有令牌；用「只減不增」，因為紅的退化模式
// 是**在既有出口裡加**，不是換一個地方。
const ROSE_TOKEN_BUDGET = 10;
let roseNow = 0;
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  roseNow += (stripComments(fs.readFileSync(abs, 'utf8')).match(ROSE_FAMS) || []).length;
}
check(
  `H24-f 紅家族令牌總數只減不增（預算 ${ROSE_TOKEN_BUDGET}）`,
  roseNow <= ROSE_TOKEN_BUDGET,
  `${roseNow} / 預算 ${ROSE_TOKEN_BUDGET}`
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  失敗項目：`);
  for (const f of failed) console.log(`   - ${f.name}${f.detail ? `  —— ${f.detail}` : ''}`);
  console.log(`\n  這些是設計系統的退化訊號，不是風格偏好。`);
  console.log(`  修法看 docs/ui-review-refactoring-ui.md 的對應規則。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
