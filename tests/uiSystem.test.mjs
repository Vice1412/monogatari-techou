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
 *   **→ 第三十六輪推翻這條**（見 H34 段）：夾住值不等於收斂名字。設定層留著
 *   `lg`／`xl`／`2xl` 三個鍵，就等於留三份可以各自漂移的定義；而「渲染層是 3–4px
 *   不是 2px」這件事，被這句「已夾住」安撫了三十五輪。現在是零。
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
// 第三十五輪（§CI43）：NPC 工坊的卡片風格表——現在是 `CHARACTER_THEMES` 的投影。
import { THEMES as THEMES_WORKSHOP } from '../src/features/npc-workshop/data/workshopThemes.js';
// 第三十八輪（§CI46）：`cool`／`warm`／`ink`／`signal` 色階唯一的定義。
// 對比度檢查從這裡取值，不再從 `index.css` 的 `[data-theme]` 變數（那組從來沒有接上）。
import twConfig from '../tailwind.config.js';
// 第三十八輪（§CI46）：六個身份色的唯一來源。H36-b／d 直接比對這個物件，
// 不是比對字串——「同一個值兩個名字」正是本輪要根治的病。
import { IDENTITY } from '../src/data/identityPalette.js';
// 第四十一輪（§CI49）：唯一會問「這個 class 名真的存在嗎」的東西。
// 它現編一份 CSS（content 就是 `src`），所以它驗的是**地面真相**，
// 不是「我上次寫的那個字串還在不在」。
import { auditDeadClasses } from '../scripts/auditClasses.mjs';
// 第四十三輪（§CI50.5）：class 合併器。H40 家族要真的跑它，不是讀它的原始碼——
// 「合併後還剩什麼」只有合併器自己答得出來。
import { cn } from '../src/utils/cn.js';
import {
  CHAPTER_STATUS,
  CHAPTER_STATUS_LABEL,
  chapterStatusOf,
  chapterStatusLabelOf,
  needsDevWarning
} from '../src/components/book/chapterStatus.js';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * 剝掉 `//` 行註解與 `/* *\/` 區塊註解（本專案大量用註解記錄設計理由，
 * 不剝掉的話「解釋某條規則」會被當成「違反某條規則」）。
 *
 * 2026-10-24 第三十二輪（§CI40）修正三個假綠，全部來自舊版「對全文跑正則」：
 * 1. `accept="image/*"` 裡的 `/*` 被當成區塊註解開頭，一路吃到下一個 `*\/`，
 *    把整段真實 JSX 塗白——H20 因此看不見 NPCWorkshop 魔防的 `text-purple-800`。
 * 2. 舊版把區塊註解換成單一空白，其後所有行號整體位移；現在保留換行。
 * 3. 「先保護字串、再剝註解」的順序同樣錯：JSDoc 裡的 ```js 圍欄會被誤認為
 *    字串而丟掉換行。改為單趟狀態機——遇到註解就整段吃掉，遇到引號就整段跳過，
 *    兩者互不干擾，行號恆等於原始行號。
 */
const stripComments = (src) => {
  let out = '';
  let i = 0;
  const n = src.length;
  let quote = null;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += d === undefined ? '' : d;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (c === '/' && d === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c;
    i += 1;
  }
  return out;
};

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
  ['圓角全圓 full', "full: '9999px'"],
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

/* 第三十八輪（§CI46）：改讀 `tailwind.config.js`。
   原本讀 `[data-theme="cool"|"warm"]` 的 CSS 變數，但實測：
   全站設定 `data-theme` **0 處**；那 12 個變數只被 `.ui-panel`／`.ui-zone` 讀；
   而那兩條規則**也 0 處使用**——所以這個測試守的是一組**從來沒有上過畫面**的顏色，
   而它一直是綠的，於是「對比合格」這句話沒有對應到任何一個畫面。
   現在改讀那套色階唯一的定義（117 處類別在用）。 */
const TW = twConfig.theme.extend.colors;

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

/** [標籤, 前景, 背景] —— 只列**真的會發生的組合**。
 *
 *  第四十輪（§CI48）改寫：舊階梯只有 `0/1/2` 三階，所以配對表也只測三階。
 *  新階梯有六階，但**不是六階都能放字**——`shade`／`line` 是凹槽與框，
 *  實測 `ink-2` 放上去只有 4.17／3.40（兩區同值），不合規。
 *  所以「可放字的面」是一個**登記過的白名單**（前四階），不是「全部測一測看誰紅」。
 *
 *  兩區都測，而且**同一個墨在同一階的對比必須幾乎相同**（實測最大差 0.064）——
 *  那正是 H38-a 要守的事。
 */
const TEXT_STEPS = ['card', 'page', 'panel-2', 'panel'];
const PAIRS = [];
for (const region of ['cool', 'warm']) {
  const r = TW[region];
  for (const step of TEXT_STEPS) {
    PAIRS.push([`${region}.${step}: ink`, TW.ink.DEFAULT, r[step]]);
    PAIRS.push([`${region}.${step}: ink-2`, TW.ink['2'], r[step]]);
    PAIRS.push([`${region}.${step}: ink-3`, TW.ink['3'], r[step]]);
    PAIRS.push([`${region}.${step}: accent`, TW.signal.accent, r[step]]);
  }
  // accent 在 shade 上仍然合規（4.60／4.57），所以凹槽底可以放紅字。
  PAIRS.push([`${region}.shade: accent`, TW.signal.accent, r.shade]);
}

/* 書的色票：全站絕大多數面積，而舊測試**完全沒有測過它**。
   數字取自 `characterThemes` 的紙與墨（紙三階、墨四階、強調兩階）。 */
PAIRS.push(
  ['書：內文 #3c2415 on 面板 #f4ebd9', '#3c2415', '#f4ebd9'],
  ['書：內文 #3c2415 on 頁面 #fbf7ee', '#3c2415', '#fbf7ee'],
  ['書：標題 #2c221e on 卡片 #fffdf9', '#2c221e', '#fffdf9'],
  ['書：次要 #6b5a4b on 面板 #f4ebd9', '#6b5a4b', '#f4ebd9'],
  ['書：淺字 #fffdf9 on 強調 hover #8c3235', '#fffdf9', '#8c3235'],
);

for (const [label, fg, bg] of PAIRS) {
  const ratio = contrast(fg, bg);
  check(label, ratio >= AA, `${ratio.toFixed(2)}:1（${fg} on ${bg}）`);
}

// 主要動作：白字配 accent 底色
{
  const ratio = contrast('#ffffff', TW.signal.accent);
  check('白字 on accent（主要動作按鈕）', ratio >= AA, `${ratio.toFixed(2)}:1`);
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
 * - `rounded-lg/xl/2xl`：超出圓角階梯的類別名（第三十六輪起，這些名字連同
 *   `sm`／`md`／`ui`／`book` 一起從設定層移除，只剩 `rounded` 與 `rounded-full`）
 * - `font-mono`：中文標籤配等寬字（等寬字是給數值與程式碼的）
 * - `book-cover-leather`／`text-sky-100`：GM 已否決的深藍皮革＋淺藍白字封面
 */
const BANNED = [
  ['animate-pulse', /animate-pulse/],
  ['blur-xl/2xl/3xl', /blur-(?:xl|2xl|3xl)/],
  ['shadow-2xl', /shadow-2xl/],
  ['bg-gradient-to', /bg-gradient-to/],
  ['hover:scale-', /hover:scale-/],
  ['圓角舊階或任意值', /rounded-(?:sm|md|lg|xl|2xl|3xl|book|ui)\b|rounded-\[[^\]]+\]/],
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
  // 第三十五輪：424 → **0**、480 → **0**、10 → **0**。三條任意字級預算到此結束，
  // 改成 H33「全站零任意字級」的硬零——預算的意義是「只減不增」，減到 0 就該換形狀。
  //
  // 第六輪：34 → 18 → 13。21 處已抬到型階梯地板 `text-t12`（12px）：
  //   前 16 處是「原始碼看得到中文」的標籤／句子；
  //   後 5 處是 `{term.label}` 這種**中文在資料層**的標籤（原始碼裡一個中文字都沒有，
  //   所以任何以「原始碼含中文」為判準的掃描都抓不到，只能逐條列名——見 §10.4）。
  // 剩下的 13 處全是等寬拉丁／數字晶片（`d6`、`+3`、`≤70`、屬性英文名），
  // 密度是刻意的，且改動會擠壞 `max-w-[54px]` 這類固定寬度——留待逐處量。天花板跟著降到 13，不准回填。
  // 第三十五輪：13 → 0。9px 這個階級**整個消失**（9px 收斂到 t10）。
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
 *
 * 第四十二輪：詞彙表換成專案自己的令牌。原本寫的是 `2xs|xs|sm`——三個名字
 * 在 v3 全部不存在（v4 的寫法），所以這條護欄**守著空氣**：
 * 它紅不了，因為那些名字根本編不出 CSS，也就沒有陰影可以疊。
 * 全站唯一的陰影令牌是 `e1|e2|e3`，所以詞彙表必須是 `e1|e2`（`e3` 是浮層，見上）。
 *
 * ⚠️ 它仍然是**行級**的，而 class 片段常常散在好幾個字串裡
 * （`'shadow-e1'`、`'ring-2'`、`'border …'` 各一段），所以它是**地板不是天花板**。
 * 第四十二輪實測：換成 `e1|e2` 之後命中 1 處，那 1 處是填色按鈕
 * （`border + bg-[#a63d40] + shadow-e1`），陰影在實色深底上不可見，已移除。
 */
const NOISE_LOW = /\bshadow-(2xs|xs|sm|e1|e2)\b/;
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
 *
 * ## 第三十七輪（§CI45）：這條護欄原本只認一種寫法
 *
 * 它數的是 `bg-gradient` 這個**字串**，所以只看見 2 條——都在 `NPCWorkshop.jsx`。
 * 可是同一時間全站其實有 **13 條**漸層：
 *
 * | 寫法 | 站點 | 舊護欄看不看得見 |
 * |---|---|---|
 * | `bg-gradient-to-r` | NPCWorkshop ×2 | ✅ 看得見 |
 * | inline `repeating-linear-gradient(…)` | BookCoverHub ×2 | ❌ 看不見 |
 * | inline `radial-gradient(…)` | TechnosphereBead ×3、index.css ×3 | ❌ 看不見 |
 * | `bg-[radial-gradient(…)]` 任意值 | BookPageFlipOverlay ×1 | ❌ 看不見 |
 * | inline `linear-gradient(…)` | ZeroPowerBlock ×1 | ❌ 看不見 |
 *
 * 也就是說**天花板一直是假的**：它守著一個角落，而十條漸層在牆外。
 * 這是第三十六輪 `BANNED` 圓角規則的同一個病——規則只認一種寫法。
 *
 * 現在改成三種寫法全認，並且逐檔記**次數**（不是「有／沒有」）。
 *
 * ## 第二條：漸層不准吃主題色
 *
 * 剩下的 11 條全部在「畫一個實體」——布紋、書脊縫線、珠子的內陰影與高光、
 * 皮革封面、髮絲分隔線、hover 光掃、頁面 3% 暖度。它們用的都是**固定的紙階或墨階**，
 * 所以換角色主題時它們不會跟著變，也就不構成「第二套顏色系統」。
 *
 * 反過來說，只要一條漸層裡出現 `${…}` 插值（＝吃主題色），它就會隨身份色改變，
 * 那才是禁令要抓的東西。`ZeroPowerBlock` 原本那條
 * `linear-gradient(135deg, accentDark, accent, border, accent, accentDark)`
 * 正是這樣：兩端暗、中間亮、135° 對角——那是**金箔框的形狀**，
 * 只是把金色換成了角色的 accent，於是躲過了「沒有金色」的字面檢查。
 */
const GRAD_TOKEN =
  /(?:bg-(?:gradient|linear|radial|conic)-[\w-]+|bg-\[[^\]]*(?:linear|radial|conic)-gradient[^\]]*\]|(?:repeating-)?(?:linear|radial|conic)-gradient\()/g;

/** 檔案 → 漸層條數。只能往下修；新增一條就 FAIL。 */
const GRAD_OK = new Map([
  ['src/components/book/BookCoverHub.jsx', 2], // 布紋（3.5% 墨）＋書脊縫線（紙階）
  ['src/components/book/BookPageFlipOverlay.jsx', 1], // 翻頁遮罩的紙色暈影
  ['src/features/character-sheet/components/TechnosphereBead.jsx', 3], // 珠子的內陰影／高光／柱面
  ['src/features/npc-workshop/NPCWorkshop.jsx', 2], // 羊皮紙髮絲線 ＋ hover 光掃
  ['src/index.css', 1], // 只剩皮革封面；第三十八輪刪掉 body 的兩條 3%（那是琥珀與書頁棕的 rgba）
]);

const gradFiles = [];
const gradThemed = [];
/* `walk()` 只收 `.js`／`.jsx`，所以 `index.css` 從來不在任何一條護欄的視野裡——
   那 3 條漸層（含皮革封面的有色相那條）一直是「沒有被數過」而不是「沒有」。
   這裡另外走一遍含 `.css` 的樹。 */
const walkWithCss = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkWithCss(full, out);
    else if (['.js', '.jsx', '.css'].includes(path.extname(entry.name))) out.push(full);
  }
  return out;
};
for (const abs of walkWithCss(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  let n = 0;
  src.split('\n').forEach((line, i) => {
    GRAD_TOKEN.lastIndex = 0;
    const hits = line.match(GRAD_TOKEN);
    if (!hits) return;
    n += hits.length;
    // 吃主題色＝隨身份色改變＝第二套顏色系統
    if (/\$\{/.test(line)) gradThemed.push(`${rel}:${i + 1}`);
  });
  if (n) gradFiles.push([rel, n]);
}
const gradWrong = [
  ...gradFiles.filter(([f, n]) => GRAD_OK.get(f) !== n).map(([f, n]) => `${f}×${n}（應為 ${GRAD_OK.get(f) ?? 0}）`),
  ...[...GRAD_OK.keys()].filter((f) => !gradFiles.some(([g]) => g === f)).map((f) => `${f} 已無漸層（應從表上移除）`),
];
check(
  '漸層只存在於登記過的檔案，且條數固定（三種寫法全認）',
  gradWrong.length === 0,
  gradWrong.length ? gradWrong.join('、') : `${gradFiles.length} 檔／${gradFiles.reduce((a, [, n]) => a + n, 0)} 條`,
);
check(
  '漸層不吃主題色（不得用 ${…} 插值，否則會隨身份色變成第二套顏色系統）',
  gradThemed.length === 0,
  gradThemed.length ? gradThemed.join('、') : '0 處',
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
// （第三十三輪 §CI42：`#f5efdf` 併回 `#f4ebd9` 後從表裡移除——它已不存在於任何檔案。）
// （第三十八輪 §CI46：`#8b5e34`／`#78350f` 兩個書頁棕移除——它們不是第二個強調色，
//   而是「一個色碼同時當強調色與墨階」。按鈕底改走 `#a63d40`／hover `#8c3235`，
//   標題與標籤改走墨階。這張表因此回到真正的 v5 色票。）
const BOOK_HEX = new Set([
  '#fbf7ee', '#f4ebd9', '#fffdf9', '#d6c7ab',
  '#2c221e', '#3c2415', '#6b5a4b', '#7c6a58',
  '#a63d40', '#8c3235', '#f7f3e8',
]);
const attrHexes = [...new Set(attrSrc.match(/#[0-9a-fA-F]{6}/g) || [])].map((h) => h.toLowerCase());
const strayHexes = attrHexes.filter((h) => !BOOK_HEX.has(h));
check('屬性矩陣只用書裡的令牌', strayHexes.length === 0, strayHexes.join('、') || `${attrHexes.length} 色全數在冊`);

const tierBlock = attrSrc.slice(attrSrc.indexOf('export const getDiceColorConfig'));
const tierBgs = [...tierBlock.matchAll(/bgClass:\s*'([^']+)'/g)].map((m) => m[1]);
check('骰階四階都給得出底色', tierBgs.length === 4, `實際 ${tierBgs.length} 階`);
// 四階皆為實心負形底色（單一實心 hex，依墨階與強調色遞增，字色皆為負形反白）
// 每一階都必須是**單一實心 hex**（`bg-[#rrggbb]`）；出現 `from-*`／`to-*` 就代表又回到漸層。
const solidTier = /^bg-\[#[0-9a-f]{6}\]$/;
check(
  '骰階皆為實心負形底色',
  new Set(tierBgs).size === 4 && tierBgs.every((b) => solidTier.test(b)),
  tierBgs.join('、'),
);
check('骰階不再用漸層', !tierBlock.includes('bg-gradient'), tierBlock.includes('bg-gradient') ? '仍有漸層' : '無漸層');
check(
  '骰階皆為負形反白字',
  (tierBlock.match(/textClass:\s*'text-\[#fffdf9\] font-black'/g) || []).length === 4,
  '四階皆為負形白字',
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

/* 第三十八輪（§CI46）：這張表不再自己寫色碼，改成 `clockTheme(id, name, 身份色 id)`。
   所以護欄跟著改成**關係式**的問法，而不是數字面值：
     1. 恰好六項，鍵名唯一；
     2. 每一項的第一個參數（id）等於它的鍵；
     3. 六個身份色 id **兩兩相異**——這才是「色相一對一」的真正條件，
        因為 fill 是從身份色投影出來的（H35-d 另外保證六個 accent 兩兩相異）。
   舊版數的是 `fill: '#…'` 字面值的數量，投影之後那個字面值不存在了——
   而「數不到」和「沒有重複」在斷言裡長得一樣，所以必須換成關係式。 */
const clockKeys = [...clockBlock.matchAll(/^\s{2}([a-z]+):\s*clockTheme\(/gm)].map((m) => m[1]);
check('命刻主題是封閉六集', clockKeys.length === 6, clockKeys.join('、'));

const clockArgs = [...clockBlock.matchAll(/clockTheme\('([a-z]+)',\s*'[^']*',\s*'([a-z]+)'\)/g)].map((m) => ({ id: m[1], identity: m[2] }));
check(
  '命刻主題的 id 等於鍵',
  clockArgs.length === clockKeys.length && clockKeys.every((k, i) => clockArgs[i].id === k),
  clockKeys.map((k, i) => `${k}→${clockArgs[i]?.id}`).join('、')
);
const clockIdentityIds = clockArgs.map((a) => a.identity);
// 比的是「身份色數 == 主題數」，不是「== 6」——寫死 6 的話，多加一個重複項仍然會過
check(
  '命刻色相一對一',
  clockIdentityIds.length === clockKeys.length && new Set(clockIdentityIds).size === clockKeys.length,
  `${clockKeys.length} 鍵／${new Set(clockIdentityIds).size} 個身份色（${clockIdentityIds.join('／')}）`
);
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
const SCALE_TOKENS = ['text-t10', 'text-t11', 'text-t12', 'text-t14', 'text-t16', 'text-t20', 'text-t25', 'text-t31', 'text-t39'];
const scaleUses = SCALE_TOKENS.reduce((sum, c) => sum + count(allSrc, c), 0);
check('型階梯實際被採用（≥ 20 處）', scaleUses >= 20, `${scaleUses} 處`);

/* ────────────────────────────────────────────────────────────────
   H33 家族：任意字級歸零（2026-10-24 第三十五輪 §CI43）
   ────────────────────────────────────────────────────────────────

   背景：全站 814 處 `text-[10px]`／`text-[11px]`／`text-[9px]`。
   前幾輪的做法是「天花板只減不增」——424／480／10 三個預算，一輪削一點。
   這一輪一次削到 0，方法是**承認微字階是真的**：10px 與 11px 共 775 處，
   它們用在屬性矩陣欄頭、骰面、`d6`／`+3` 晶片、密集表格列標籤——七級裡最接近的
   t12 會擠壞 `max-w-[54px]` 這種固定寬度。所以登記成 `t10`／`t11` 兩階，
   其餘 26 處（8／9／13／15／17／22px）收斂到最近的階。

   ⚠️ 這一輪最該記住的不是「814 → 0」，是**舊護欄全部變成假綠**：
   `text-[9px]` 與 `text-[10px]`／`text-[11px]` 這三條都是**字面字串比對**，
   改寫成令牌之後它們掃不到任何東西，於是**全部繼續綠燈**。
   換語法＝換掉護欄的視野，而它不會告訴你。下面三條因此改成：
   ① 掃「任意值語法」而不是特定字面值；② 斷言令牌的**地板**；③ 反向控制令牌真的在用。
   ──────────────────────────────────────────────────────────────── */

// H33：任意字級語法歸零（硬零）。掃的是 `text-[Npx]` 這個**形狀**，不是某個值。
const arbFont = (allSrc.match(/text-\[\d+px\]/g) || []).length;
check(
  'H33 全站零任意字級（一律走型階梯令牌）',
  arbFont === 0,
  arbFont === 0 ? '0 處／9 級令牌' : `${arbFont} 處：${[...new Set(allSrc.match(/text-\[\d+px\]/g))].join('、')}`
);

// H33-a：型階梯的**地板**是 10px。這條取代舊的「9px 不得用於中文」與
// 「資料層中文的那幾支檔案不得再出現 9px」——那兩條的對象（9px 這個階級）
// 已經不存在了。不是規則被取消，是它守的東西被消滅了；
// 但「地板」本身要有人守，否則下一個人會發明 t8。
const scaleSrc = stripComments(read('tailwind.config.js'));
const scaleBlock = scaleSrc.slice(scaleSrc.indexOf('fontSize: {'), scaleSrc.indexOf('},', scaleSrc.indexOf('fontSize: {')));
const scaleDefs = [...scaleBlock.matchAll(/(t\d+):\s*\['(\d+)px'/g)].map((m) => ({ token: m[1], px: Number(m[2]) }));
const floorPx = Math.min(...scaleDefs.map((d) => d.px));
check(
  'H33-a 型階梯地板是 10px（不得再往下發明）',
  scaleDefs.length >= 9 && floorPx === 10,
  `${scaleDefs.length} 級，地板 ${floorPx}px（${scaleDefs.map((d) => `${d.token}=${d.px}`).join('／')}）`
);

// H33-b：反向控制——微字階**真的還在使用**。
// 沒有這一條，「把 t10／t11 全部抬到 t12」也會讓 H33 綠燈，
// 而那正是這輪刻意**不做**的事（會擠壞 54px 寬的格子）。
const t10Uses = count(allSrc, 'text-t10');
const t11Uses = count(allSrc, 'text-t11');
check(
  'H33-b 微字階仍在服役（反向控制）',
  t10Uses >= 300 && t11Uses >= 300,
  `t10 ${t10Uses} 處／t11 ${t11Uses} 處（下限各 300）`
);

/**
 * 9px 這個階級已經消失（第六輪立的兩條護欄在此退役）。
 *
 * 為什麼退役而不是改寫：那兩條守的是「9px 用在中文上」與「資料層中文的那幾支檔案」。
 * 9px 收斂到 t10 之後，前者沒有對象；後者的盲點（`{term.label}` 的中文在資料層）
 * 依然存在，但現在由 H33-a 的「地板 10px」全域守住——任何低於 10px 的階級都過不了，
 * 不需要逐檔列名。
 *
 * 這一條留著，是為了讓「為什麼這裡少兩條護欄」有答案，而不是讓人以為被刪掉了。
 */
const CJK_9 = /[\u4e00-\u9fff]/;
// 逐行去掉「同一行內」的註解：`{/* … */}` 與 `/* … */`。
// 不做全域 stripComments，因為它會把跨行區塊註解壓成一個空白、行號就對不上了。
const stripInlineComments = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const retiredNine = (allSrc.match(/text-\[[0-9]px\]/g) || []).length;
check(
  'H33-c 小於 10px 的任意字級不得回歸（退役的 9px 護欄的替代）',
  retiredNine === 0,
  retiredNine === 0 ? '0 處' : `${retiredNine} 處`
);

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
    // 第三十五輪：這條原本比對 `text-[10px]`／`text-[11px]` 的字面值。
    // 改成令牌之後**它會靜默掃不到任何東西**（假綠），所以改掃令牌。
    if (!/text-t(?:10|11)\b/.test(line)) return;
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

// H6. 資源條：三條資源條用各自的語意色（gauge 令牌），危急那條才換強調紅。
// 2026-10-25 使用者裁定：HP 青／MP 藍／IP 金是有意義的語意——玩家要一眼分得出
// 條是哪一種資源。原版「全墨色、只危急換紅」的判準在此反轉：
//   - 三條資源條各帶 gauge-{hp,mp,ip} 語意色（封閉三集，值取自珠色登記表）；
//   - 危機仍是紅（signal.accent / #a63d40），是獨立的警示語意，不與三色混淆——
//     因為危機只出現在 HP 條，而且會同時觸發 crisis-pulse 邊框脈動，紅色是
//     「形狀＋顏色」雙重訊號，不會被誤認成「HP 本來的青色」。
// 第四條經驗條仍走 theme.accent（身份色，封閉六集），不在這條管轄內。
// 2026-10-30（P5-a）：四條資源條收斂進 `GaugeBar`（主條 ＋ 尾影），
// 所以「一條 bar 長什麼樣」不再是面板原始碼裡的一段固定字串。
//
// 原本這條斷言數的是 `h-full rounded-full transition-all duration-300`——
// 那是**舊實作的字串**，不是需求。改版之後它會永遠是 0，而 0 是「紅」，
// 於是下一個人會以為資源條壞了，其實壞的是這條斷言。
// 這是 MEMORY §C10 的第 ② 類紅燈：**斷言一直在記錄舊行為**。
//
// 現在改成數 `<GaugeBar`，並**逐條點名**四個 testId。
// 「有四條」與「是這四條」是兩件事：少了 EXP 那條、多了一條別的，總數都會是 4。
const hudBars = (hudSrc.match(/<GaugeBar\b/g) || []).length;
const HUD_BAR_IDS = ['gauge-hp', 'gauge-mp', 'gauge-ip', 'gauge-exp'];
const hudBarIdMissing = HUD_BAR_IDS.filter((id) => !hudSrc.includes(`testId="${id}"`));
const hudGaugeHp = (hudSrc.match(/bg-gauge-hp/g) || []).length;
const hudGaugeMp = (hudSrc.match(/bg-gauge-mp/g) || []).length;
const hudGaugeIp = (hudSrc.match(/bg-gauge-ip/g) || []).length;
const hudCrisis = (hudSrc.match(/isCrisis \? 'bg-\[#a63d40\]' : 'bg-gauge-hp'/g) || []).length;
check(
  '資源條三色語意、危急才換強調紅',
  hudBars === 4 &&
    hudBarIdMissing.length === 0 &&
    hudGaugeHp === 1 &&
    hudGaugeMp === 1 &&
    hudGaugeIp === 1 &&
    hudCrisis === 1,
  `bar ${hudBars} 條（HP 青 ${hudGaugeHp}＋MP 藍 ${hudGaugeMp}＋IP 金 ${hudGaugeIp}＋危急 ${hudCrisis}）` +
    (hudBarIdMissing.length ? `｜缺 testId：${hudBarIdMissing.join('、')}` : '')
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
  'appBg', 'sheetBg', 'cardBg', 'panelBg', 'subpanelBg', 'headerBg', 'exportBg',
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

// H9. 角色卡名冊的資源條與跑團面板同一個判準（第十五輪 → 2026-10-25 反轉）。
// 兩支畫面各有一組 HP／MP／IP，如果只收一支，下一輪就會有人「照另一支的寫法」加回去。
// 反轉後判準：三條各帶 gauge 語意色，危急才換紅。
const sheetSrc = stripComments(read('src/features/character-sheet/CharacterSheet.jsx'));
const sheetCrisis = count(sheetSrc, "? 'bg-[#a63d40]' : 'bg-gauge-hp'");
const sheetGaugeHp = (sheetSrc.match(/bg-gauge-hp/g) || []).length;
const sheetGaugeMp = count(sheetSrc, 'rounded-full transition-all duration-300 bg-gauge-mp');
const sheetGaugeIp = count(sheetSrc, 'rounded-full transition-all duration-300 bg-gauge-ip');
check(
  '角色卡資源條也是三色語意、危急才換強調紅',
  sheetCrisis === 1 && sheetGaugeHp === 1 && sheetGaugeMp === 1 && sheetGaugeIp === 1,
  `危急 ${sheetCrisis} 條（應為 1）＋HP 青 ${sheetGaugeHp}＋MP 藍 ${sheetGaugeMp}＋IP 金 ${sheetGaugeIp}（各應為 1）`
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
  // 第四階面：panel（設計文件 §01 明列的四階紙之一）。
  // 第二十九輪補進來：它全站用了 121 處、`WarningNote` 也用它，卻一直不在這張表裡——
  // 因為下面那條「只用登記色票」的護欄只掃 7 個同伴檔，從來沒掃到它。
  '#f9f5eb',
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
  // 珠色身份表（第三十三輪 §CI42 登記）：`technospheres.js` 的
  // `MNEMOSPHERE_BEAD_TINTS` 與 `DAMAGE_TYPE_TINTS`。
  //
  // 為什麼是「登記」而不是「收斂」：珠子顏色是**真的身份**——二十三種魔晶石
  // 各佔一色，玩家靠顏色在珠子堆裡認東西。它們不是紙也不是墨，是保留色，
  // 所以走白名單而不是併回色階。這張表一直是全站唯一沒登記的身份色系。
  '#0891b2', '#0f766e', '#15803d', '#22c55e', '#2563eb', '#38bdf8',
  '#475569', '#65a30d', '#6d28d9', '#7c3aed', '#7f1d1d', '#84cc16',
  '#8a7a63', '#8b5cf6', '#a16207', '#c2410c', '#db2777', '#dc2626',
  '#ea580c', '#eab308', '#ef4444', '#facc15',

  /* ── 第三十八輪 §CI46：三組「真身份」＋身份色的深淺兩階 ──────────────
     這一輪把剩下的 18 個 hex 一次裁決完。判準只有一句：

     > **身份可以用色相；量只能用深淺。**

     所以「登記」與「收斂」的分界不是「好不好看」，是**這個顏色有沒有
     一個封閉的、離散的、玩家要靠它認出「是哪一個」的語意**。

     ── 九相的三色（`FUIcon.jsx`）────────────────────────────────
     九相原本九色，六個用了身份色，電／土／毒三個是自己的值。檔頭已量過
     相鄰色相角（≥29°，兩組靠飽和度分），也在三面上量過對比（最低光 5.09）。
     這是**有裁決記錄**的顏色，所以登記，不是收斂。 */
  '#5a6b00', // 電 h70°
  '#5c4a26', // 土 h40°
  '#8c2d6a', // 毒 h321°

  /* ── 四屬性（`sourcebookConfig.js` 的 `ATTRIBUTE_COLORS`）──────────
     色相角 108°／182°／237°／295°，相鄰差 74／55／58°，
     三面對比 6.00–7.25:1。同樣是量過的封閉四集。
     ※ 刻意避開紅家族：`#a63d40` 講的是「這裡可以按」，屬性講的是「這是哪一個」，
     同一個訊號不能同時講兩件事。 */
  '#336327', // 靈巧 h108°
  '#216163', // 洞察 h182°
  '#91259d', // 力量 h295°
  '#3d458f', // 意志 h237°

  /* ── 六身份色的深階與淺階（`data/identityPalette.js`）──────────────
     第三十八輪之前，這 11 個值散在 `characterThemes` 與 `ClockTracker` 兩份
     抄本裡，而且**沒有任何一份登記過**——所以 H31 一直把它們算成債。
     它們不是債：`dark` 是命刻描邊與按鈕邊界，`light` 是零式選中底，
     兩者都是「同一個身份的另一個明度」，是**量**，但量的載體是身份的色相，
     所以必須與 `accent` 成組登記、成組檢查（見 H36-b 的單調性）。 */
  '#133829', '#693108', '#17324c', '#58171e', '#3a1f4f', '#20262f', // dark
  '#e1eee7', '#dde7f0', '#f5e6e7', '#eee5f5', '#e6eaef', // light（琥珀的 light 就是 #f4ebd9，已在表內）
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
// 第三十八輪（§CI46）：`#78350f`（amber-900）從「刻意不列」改成列入。
// 它原本被排除的理由是「它是棕色強調 `#8b5e34` 的 hover，屬於另一條待收的線」，
// 而那條線這一輪收完了（見 H23-d），所以它現在跟其他十個一樣是硬零。
const AMBER_HEX = ['#b45309', '#f59e0b', '#d97706', '#92400e', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7', '#fffbeb', '#451a03', '#78350f'];
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
// 預算抓的正是「上升」。
//
// 第三十八輪（§CI46）收到 0，所以形狀跟著換成硬零——理由與 H31 相同：
// 「預算 0」跟「預算 141」的差別只是額度大小，兩者都允許交換；硬零不允許。
// 這 117 處的去向分兩類（逐項見 §CI46）：
//   47 處是**面**（按鈕底、hover 底、邊界、focus 環）→ 併進強調色 `#a63d40`／墨階
//   70 處是**字**（標題、標籤、圖示）→ 併進墨階 `#3c2415`／`#6b5a4b`
// 為什麼字不併進紅色：強調色講的是「這裡可以按」（CI33 的裁決），
// 把 70 處字換成紅色，等於讓強調色去標示層級——那是**序**的工作。
const BROWN_ACCENT_BUDGET = 0;
const ACCENT_BROWN = '#8b5e34';
const brownSrc = walkSrc(path.join(ROOT, 'src'))
  .map((abs) => stripComments(fs.readFileSync(abs, 'utf8')).toLowerCase())
  .join('\n');
const brownNow = count(brownSrc, ACCENT_BROWN) + count(brownSrc, '#78350f');
check(
  'H23-d 書頁棕強調色全站硬零（暖色相只剩一個）',
  brownNow <= BROWN_ACCENT_BUDGET,
  brownNow
    ? `${brownNow} 處：${ACCENT_BROWN}×${count(brownSrc, ACCENT_BROWN)}、#78350f×${count(brownSrc, '#78350f')}`
    : `0 處／暖強調色只剩 #a63d40 一族`
);

// H23-e：強調底上的字必須是登記的淺色，不是純白。
//
// `#fffdf9` 是登記的「墨面上的淺字」；`text-white` 不在登記表裡，而且在羊皮紙的暖白
// 旁邊會顯出一塊冷白。本輪在 54 處強調底上把 `text-white` 換成 `#fffdf9`，這條把它鎖住。
//
// 2026-10-24 第三十三輪修正範圍：原本的寫法連 `hover:bg-[#8c3235]` 也算「強調底」，
// 於是封面那顆「白字實心 accent」（底色是 `bg-signal-accent`，不是 hex）被誤判。
// 只看**底色**——前綴不得是 hover／active／focus／group-hover。
const whiteOnAccent = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    if (!/(?<![:\w-])bg-\[#(?:a63d40|8c3235|76252d)\]/.test(line)) return;
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

// H25：警示面（第二十八輪）。
//
// 這一輪的起點不是「還有什麼顏色沒收」，是上一輪殘債清單的第一條：
// **「警示的可讀性沒有實測」**（連列兩輪）。量測方式見 `scratch/r28_shot.mjs`：
// 把三個真實情境（`ErrorBoundary` inline、`ChapterDevWarningModal`、Boss 技能超額）
// 用 SSR ＋ chrome --headless 截圖，然後看圖回答「一眼看得出這裡有事嗎」。
//
// 量到的結論（截圖 `scratch/r28-inline-before.png`／`r28-modal-before.png`）：
//   - `ErrorBoundary` inline：**讀得出來**——紅色「重試載入」按鈕承擔了訊號
//   - `ChapterDevWarningModal`：**讀得出來**——方形圖示磚 ＋ 粗體標題 ＋ WIP 徽章
//   - Boss 技能超額：**讀不出來**——它跟「步驟 N」的導言一模一樣
//
// 所以 §CI34 的取捨（零色 ＋ 符號）沒有錯，錯的是**形狀沒有所有權**：
// `NPCWorkshop` 有 8 個「步驟 N：…」的導言穿著 `bg-[#f5efdf] border-l-4 border-[#3c2415]
// p-4 rounded …`，於是「紙底 ＋ 左條 ＋ 粗體標題」在畫面上等於「章節導言」。
//
// 修法：導言脫掉那件衣服；警示收成 `WarningNote`（方形圖示磚 ＋ 細框 ＋ 紙底，無左條——
// 左條留給「出處」）。下面四條把這件事鎖住。

// H25：步驟導言不得有框／底／左條（逐項）。
//
// 判定單位是**元素**，不是行。這一條原本寫成「掃含『步驟 N：』的那一行」，
// 故意破壞驗證的第②案（把 className 折到上一行）當場漏抓——護欄是綠的，
// 但導言確實穿回了警示的衣服。行級判定對「排版工具重排一次」毫無抵抗力，
// 所以改成：抓包住「步驟 N：」的那個開標籤，檢查它的 class。
// 抓不到開標籤時退回行級判定——退化成舊行為，總比靜默放行好。
const stepBoxed = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  if (!abs.endsWith('.jsx')) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(/步驟\s*\d+\s*：/g)) {
    const before = src.slice(0, m.index);
    const openTag = /<h3\b[^>]*>\s*$/.exec(before);
    const line = src.slice(before.lastIndexOf('\n') + 1, src.indexOf('\n', m.index));
    const probe = openTag ? openTag[0] : line;
    if (!/bg-\[#|border/.test(probe)) continue;
    const lineNo = before.split('\n').length;
    stepBoxed.push(`${rel}:${lineNo} → ${probe.trim().replace(/\s+/g, ' ').slice(0, 60)}`);
  }
}
check(
  'H25 步驟導言不得有框／底／左條（否則警示沒有形狀可用）',
  stepBoxed.length === 0,
  stepBoxed.length ? `${stepBoxed.length} 行：${stepBoxed.slice(0, 3).join('、')}` : '0 處／導言＝純標題＋說明'
);

// H25-a：舊的行內警示形狀全站硬零（逐項）。
//
// 這兩個 class 字串是第二十八輪之前的警示面：一個是「定位不在本版資料裡」，
// 另一個是 Boss 那兩個（`p-4 rounded-xl flex gap-3 items-start relative overflow-hidden`）。
// 它們現在都必須走 `WarningNote`。
const OLD_WARNING_SHAPES = [
  'border-l-4 border-[#3c2415] p-4 rounded',
  'p-4 rounded flex gap-3 items-start relative overflow-hidden',
];
const oldWarnLeft = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    for (const shape of OLD_WARNING_SHAPES) {
      if (line.includes(shape)) oldWarnLeft.push(`${rel}:${i + 1} → ${shape}`);
    }
  });
}
check(
  'H25-a 舊的行內警示形狀全站硬零（一律走 WarningNote）',
  oldWarnLeft.length === 0,
  oldWarnLeft.length ? `${oldWarnLeft.length} 行：${oldWarnLeft.slice(0, 3).join('、')}` : `0 處／檢查 ${OLD_WARNING_SHAPES.length} 個形狀`
);

// H25-b：`border-l-4` 恰好三處，且都在「出處」。
//
// 警示改用圖示磚之後，左條就只剩一個意思：**這張技能卡從哪來**。
// 用「恰好 N 處」而不是「≤ N」：少一處代表出處的視覺被刪掉了，那也是退化。
const LEFT_BAR_ALLOWED = {
  'src/features/npc-workshop/components/EditableSkill.jsx': 1,
  'src/features/npc-workshop/components/ReadOnlySkill.jsx': 1,
  'src/features/npc-workshop/NPCWorkshop.jsx': 1,
};
const leftBarHits = {};
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const n = (stripComments(fs.readFileSync(abs, 'utf8')).match(/border-l-4/g) || []).length;
  if (n) leftBarHits[rel] = n;
}
const leftBarBad = Object.entries(leftBarHits).filter(([rel, n]) => LEFT_BAR_ALLOWED[rel] !== n);
check(
  'H25-b `border-l-4` 恰好三處，且都只在出處（警示不借左條）',
  leftBarBad.length === 0,
  leftBarBad.length
    ? leftBarBad.map(([rel, n]) => `${rel}（${n}）`).slice(0, 3).join('、')
    : `3 檔各 1 處：${Object.keys(leftBarHits).map((p) => p.split('/').pop()).join('、')}`
);

// H25-c：反向控制——`WarningNote` 這個替代通道真的存在、真的有被用。
//
// 硬零護欄最常見的假綠是「規則生效」與「根本沒在看」長得一樣。
// 所以 H25／H25-a 這種「不准這樣畫」的斷言，必須配一條「那要怎麼畫」的形狀斷言。
const WARNING_NOTE = 'src/components/ui/WarningNote.jsx';
const warningNoteSrc = stripComments(fs.readFileSync(path.join(ROOT, WARNING_NOTE), 'utf8'));
const warningNoteMissing = [
  ['data-warning-note', /data-warning-note/],
  ['▲ 符號（GiHazardSign）', /GiHazardSign/],
  ['方形圖示磚（w-7 h-7）', /w-7 h-7/],
  ['兩種語氣', /note:\s*\{[\s\S]*?danger:\s*\{/],
].filter(([, re]) => !re.test(warningNoteSrc)).map(([name]) => name);
let warningNoteUsers = 0;
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  if (!abs.endsWith('.jsx')) continue;
  if (abs.endsWith('WarningNote.jsx')) continue;
  if (/from '[^']*WarningNote'/.test(fs.readFileSync(abs, 'utf8'))) warningNoteUsers += 1;
}
check(
  'H25-c 警示的替代通道存在且被使用（WarningNote 四件套 ＋ 至少 2 個呼叫端）',
  warningNoteMissing.length === 0 && warningNoteUsers >= 2,
  warningNoteMissing.length
    ? `WarningNote 缺：${warningNoteMissing.join('、')}`
    : `${warningNoteUsers} 個呼叫端／四件套齊備`
);

// H25-d：`WarningNote` 自己不准用色相令牌。
//
// 它是「警示」的唯一定義，所以它只能有兩種顏色來源：墨階（`note`）與登記危險紅（`danger`）。
// 一旦這裡出現 `bg-red-50` 之類的東西，全站每一個警示面都會跟著變色——這條是最便宜的保險。
const WARN_FAMS = /(?:[a-z-]+:)*(?:text|bg|border|border-[lrtbxy]|ring|divide|from|via|to|fill|stroke)-(?:red|rose|pink|amber|yellow|orange|emerald|green|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|lime|slate|gray|zinc|neutral|stone)-\d{2,3}(?:\/\d+)?/g;
const warnFamHits = warningNoteSrc.match(WARN_FAMS) || [];
check(
  'H25-d WarningNote 自身零色相令牌（只有墨階與登記危險紅）',
  warnFamHits.length === 0,
  warnFamHits.length ? `${warnFamHits.length} 個：${[...new Set(warnFamHits)].slice(0, 4).join('、')}` : '0 處'
);

// H26：`emerald`／`green` 家族（第二十九輪）。
//
// 開場實測 213 個令牌／20 檔。它同時在當：
// 物種 PLANT 的身份色、翡翠青主題的徽章、味表「苦味」的身份色、
// **成功**（勾勾、toast、已選定）、**選中／已選**（邊框與 ring）、
// **主動作**（綠色確認鈕）、**量**（數值字）、**面板外殼**（整個同伴面板被漆成綠色）。
//
// 判準照抄 §CI33～§CI35：先問「這個色相被哪張身份表登記走了」。答案有三張——
// `speciesThemes` 的 `sp_plant`、`JRPGBadge` 的 `green`（翡翠青主題）、
// `GourmetCookbook` 的 `苦味`（味表，chip ＋ 圓點）。所以它是**保留色**。
//
// 但這一輪比紅更難的地方在「成功」：紅有 `✕`、警示有 `GiHazardSign`，
// **成功原本只有顏色**。所以這一輪先把替代符號定下來——`✓`（第二十八輪在
// 「已選定弱點」那行已經無意間用了第一個），然後成功一律走「✓ ＋ 墨階」。
const GREEN_FAMS = /(?:[a-z-]+:)*(?:text|bg|border|border-[lrtbxy]|ring|ring-offset|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:emerald|green)-\d{2,3}(?:\/\d+)?/g;

// H26：令牌只准出現在三張身份表的那幾行（硬零 ＋ 白名單）。
//
// 白名單用「檔名 ＋ 該行必須長什麼樣」而不是行號：行號會隨任何一次編輯位移，
// 而位移之後的護欄會開始保護錯的地方——那種護欄比沒有更糟。
const GREEN_ALLOWED = [
  { file: 'src/components/ui/JRPGBadge.jsx', re: /^\s*green: "/, why: '翡翠青主題的徽章（身份）' },
  { file: 'src/features/npc-workshop/data/speciesThemes.jsx', re: /^\s*sp_plant: /, why: '物種 PLANT（身份）' },
  { file: 'src/features/character-sheet/components/companions/GourmetCookbook.jsx', re: /^\s*苦味: 'bg-emerald/, why: '味表 苦味（身份）' },
];
const greenStray = [];
let greenTotal = 0;
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    const hits = line.match(GREEN_FAMS);
    if (!hits) return;
    greenTotal += hits.length;
    const ok = GREEN_ALLOWED.some((w) => w.file === rel && w.re.test(line));
    if (!ok) greenStray.push(`${rel}:${i + 1} → ${hits.join(' ')}`);
  });
}
check(
  'H26 emerald／green 只准出現在三張身份表的登記行（硬零＋白名單）',
  greenStray.length === 0,
  greenStray.length
    ? `${greenStray.length} 處：${greenStray.slice(0, 3).join('、')}`
    : `0 處外洩／全站 ${greenTotal} 個令牌，全部在 ${GREEN_ALLOWED.length} 張身份表`
);

// H26-a：白名單檔裡的每一行，都必須以該表自己的鍵開頭（逐項／行級）。
//
// 為什麼要這一條：H26 的白名單是「這個檔案的這一行可以有色相」。如果不逐項檢查，
// 有人可以在 `GourmetCookbook` 的任意新行加 `text-emerald-500`，H26 會放行——
// 因為白名單認的是檔案，不是那一行的身份。H24-a 抓過同一個洞。
const greenWhitelistStray = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (!GREEN_ALLOWED.some((w) => w.file === rel)) continue;
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    if (!GREEN_FAMS.test(line)) return;
    GREEN_FAMS.lastIndex = 0;
    const ok = GREEN_ALLOWED.some((w) => w.file === rel && w.re.test(line));
    if (!ok) greenWhitelistStray.push(`${rel}:${i + 1} → ${line.trim().slice(0, 48)}`);
  });
}
check(
  'H26-a 白名單檔裡每個 emerald／green 令牌都在該表的登記行（逐項）',
  greenWhitelistStray.length === 0,
  greenWhitelistStray.length ? `${greenWhitelistStray.length} 行：${greenWhitelistStray.slice(0, 3).join('、')}` : `${GREEN_ALLOWED.length} 張表、逐行乾淨`
);

// H26-b：綠色原階 hex 全站硬零——只有珠色身份表可以留。
//
// `technospheres.js` 的 `MNEMOSPHERE_BEAD_TINTS` 是 §CI35 正式承認的身份色票池
// （H24-b 的唯一出口），所以它同時是紅與綠的例外。其餘地方一個都不准。
const GREEN_HEXES = [
  '#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b',
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16',
];
const greenHexStray = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (rel === BEAD_TABLE) continue;
  const body = stripComments(fs.readFileSync(abs, 'utf8')).toLowerCase();
  for (const h of GREEN_HEXES) {
    const n = body.split(h).length - 1;
    if (n) greenHexStray.push(`${rel}：${h}×${n}`);
  }
}
check(
  `H26-b 綠色原階 hex 只准在珠色身份表（逐檔，檢查 ${GREEN_HEXES.length} 個 hex）`,
  greenHexStray.length === 0,
  greenHexStray.length ? greenHexStray.slice(0, 3).join('、') : `0 處／${GREEN_HEXES.length} 個 hex`
);

// H26-c：綠色 rgba 發光硬零。
const greenGlow = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const m = stripComments(fs.readFileSync(abs, 'utf8')).match(
    /rgba?\(\s*(?:16\s*,\s*185\s*,\s*129|5\s*,\s*150\s*,\s*105|34\s*,\s*197\s*,\s*94|22\s*,\s*163\s*,\s*74)\s*,[^)]*\)/g
  );
  if (m) greenGlow.push(`${rel}（${m.length}）`);
}
check('H26-c 綠色光暈（rgba）全站硬零', greenGlow.length === 0, greenGlow.length ? greenGlow.join('、') : '0 處');

// H26-d：**反向控制**——「成功」這條通道真的存在、真的被用。
//
// H26／H26-a 都是「不准用綠色」。這種硬零護欄最常見的假綠，是把成功的視覺**全部刪掉**
// 也會通過——那時綠色確實沒了，但「這裡成功了」也讀不出來了。
// 所以這裡斷言兩件事：
//   1. 勾勾類圖示／符號**不准**再帶色相（0 處）；
//   2. 勾勾 ＋ 墨階的站點 ≥ 10（第二十九輪實測 13 處）。
// 把成功全部刪光，第 2 條會失敗。
const CHECK_ICON = /(?:GiCheckMark|CheckCircle2|<Check\b|>\s*✓|\{'✓'\}|✓)/;
const INK_TEXT = /text-\[#(?:2c221e|3c2415|6b5a4b|7c6a58)\]/;
let successInk = 0;
let successHue = 0;
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line) => {
    if (!CHECK_ICON.test(line)) return;
    if (INK_TEXT.test(line)) successInk += 1;
    if (/(?:text|bg)-(?:emerald|green)-\d/.test(line)) successHue += 1;
  });
}
check(
  'H26-d 成功走「✓ ＋ 墨階」，而且真的還在用（勾勾不得帶色相／墨階站點 ≥ 10）',
  successHue === 0 && successInk >= 10,
  successHue > 0 ? `${successHue} 處勾勾帶色相` : `勾勾＋墨階 ${successInk} 處／帶色相 0 處`
);

// H26-e：死變體不得回歸，替代通道必須存在。
//
// `JRPGBadge` 原本同時有 `green` 與 `emerald` 兩個變體，**值完全相同**——
// `green` 被翡翠青主題指著，`emerald` 只有一個呼叫端（「目前已選」）。
// 第二十九輪把 `emerald` 刪掉，改用語意變體 `selected`（墨框＋紙底）。
// 這條鎖住兩件事：`emerald` 不准回來、`selected` 不准消失。
check(
  'H26-e 徽章沒有 `emerald` 死變體，且替代的 `selected` 存在',
  !KNOWN_VARIANTS.has('emerald') && KNOWN_VARIANTS.has('selected'),
  KNOWN_VARIANTS.has('emerald')
    ? '`emerald` 死變體回歸了'
    : KNOWN_VARIANTS.has('selected')
      ? `${KNOWN_VARIANTS.size} 個變體／emerald 已刪、selected 在`
      : '`selected` 不見了（已選狀態沒有形狀）'
);

// H26-f：令牌總數只減不增（預算 10）。
//
// 用預算而不是硬零，因為三張身份表本來就該有色相；用「只減不增」，
// 因為綠的退化模式是**在既有出口裡加一行**（跟紅一樣），不是換一個地方。
const GREEN_BUDGET = 10;
check(
  `H26-f emerald／green 令牌總數只減不增（預算 ${GREEN_BUDGET}）`,
  greenTotal <= GREEN_BUDGET,
  `${greenTotal} / 預算 ${GREEN_BUDGET}`
);


// H26-g：同伴面板的 HP 條不准借翠玉色（逐檔硬零 ＋ 反向控制）。
//
// 這條不是從程式碼看出來的，是**看圖看出來的**。去綠之後截了 before／after 對照，
// 整個面板只剩一條綠——HP 條。它用的是 `#245c45`，登記色沒錯，所以 H26／H26-b
// 都放行；但那支色相的業主是翡翠綠時鐘、風元素、花園、部分職業主題，
// HP 條拿它表示「沒事」＝同一支色相兩個意思。
//
// 之所以敢拿掉：危機態本來就有文字標記（`危機 (≤N)` ＋ 危險圖示），
// 紅綠是重複編碼；「量」真正的編碼是長度，不是顏色。
//
// 兩段都要：
//   一、不准出現 `245c45`——否則會有人把它借回來；
//   二、兩端都還要在（`#3c2415` 健康／`#8c2d36` 危機）——否則「刪掉整條」也能過。
//
// 掃描前一定要 stripComments：上面那段說明本身就寫了 `#245c45`，
// 不剝註解的話這條護欄會指著自己的說明書喊違規（假紅）。
// 平常 stripComments 是用來防假綠的，這裡剛好相反。
const HP_BAR_FILE = 'src/features/character-sheet/components/companions/WayfarerCompanionSheet.jsx';
const hpBarSrc = stripComments(fs.readFileSync(path.join(ROOT, HP_BAR_FILE), 'utf8'));
const hpBorrowsJade = /245c45/.test(hpBarSrc);
const hpHasInk = /bg-\[#3c2415\]/.test(hpBarSrc);
const hpHasDanger = /bg-\[#8c2d36\]/.test(hpBarSrc);
check(
  'H26-g 同伴面板 HP 條不借翠玉色（`#245c45` 硬零，兩端墨／危險仍在）',
  !hpBorrowsJade && hpHasInk && hpHasDanger,
  hpBorrowsJade
    ? 'HP 條又借了 `#245c45`（翠玉色是別人的）'
    : !hpHasInk
      ? '健康態的墨階不見了'
      : !hpHasDanger
        ? '危機態的危險紅不見了'
        : '不借翠玉色／墨階＋危險紅兩端都在'
);

// H27：cyan／teal／blue／sky 家族（第三十輪）。
//
// 開場實測 91 個令牌／15 檔。`speciesThemes` 登記了兩個身份：
// `sp_element`（元素體）= cyan、`sp_humanoid`（人形）= blue。
// 其餘 85 個全部是借色——職業主題、元素效果標籤、MP 數值、冠位裝飾、
// 味道（鹹味）、按鈕、輸入框 focus 等，全部改走紙／墨階或 accent。
const COOL_FAMS = /(?:[a-z-]+:)*(?:text|bg|border|border-[lrtbxy]|ring|ring-offset|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:cyan|teal|blue|sky)-\d{2,3}(?:\/\d+)?/g;

const COOL_ALLOWED = [
  { file: 'src/features/npc-workshop/data/speciesThemes.jsx', re: /^\s*sp_element: /, why: '物種 ELEMENTAL（身份）' },
  { file: 'src/features/npc-workshop/data/speciesThemes.jsx', re: /^\s*sp_humanoid: /, why: '物種 HUMANOID（身份）' },
];

const coolStray = [];
let coolTotal = 0;
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    const hits = line.match(COOL_FAMS);
    if (!hits) return;
    coolTotal += hits.length;
    const ok = COOL_ALLOWED.some((w) => w.file === rel && w.re.test(line));
    if (!ok) coolStray.push(`${rel}:${i + 1} → ${hits.join(' ')}`);
  });
}
check(
  'H27 cyan／teal／blue／sky 只准出現在 speciesThemes 身份表（硬零＋白名單）',
  coolStray.length === 0,
  coolStray.length
    ? `${coolStray.length} 處：${coolStray.slice(0, 3).join('、')}`
    : `0 處外洩／全站 ${coolTotal} 個令牌，全部在 ${COOL_ALLOWED.length} 張身份表`
);

// H27-a：白名單檔裡每個冷色令牌都必須在登記行（逐項）。
const coolWhitelistStray = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (!COOL_ALLOWED.some((w) => w.file === rel)) continue;
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    if (!COOL_FAMS.test(line)) return;
    COOL_FAMS.lastIndex = 0;
    const ok = COOL_ALLOWED.some((w) => w.file === rel && w.re.test(line));
    if (!ok) coolWhitelistStray.push(`${rel}:${i + 1} → ${line.trim().slice(0, 48)}`);
  });
}
check(
  'H27-a 白名單檔裡每個冷色令牌都在登記行（逐項）',
  coolWhitelistStray.length === 0,
  coolWhitelistStray.length ? `${coolWhitelistStray.length} 行：${coolWhitelistStray.slice(0, 3).join('、')}` : `${COOL_ALLOWED.length} 張表、逐行乾淨`
);

// H27-b：冷色原階 hex 全站硬零。
const COOL_HEXES = [
  '#ecfeff','#cffafe','#a5f3fc','#67e8f9','#22d3ee','#06b6d4','#0891b2','#0e7490','#155e75','#164e63',
  '#f0f9ff','#e0f2fe','#bae6fd','#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e',
  '#f0fdfa','#ccfbf1','#99f6e4','#5eead4','#2dd4bf','#14b8a6','#0d9488','#0f766e','#115e59','#134e4a',
  '#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a',
];
const coolHexStray = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (rel === BEAD_TABLE) continue;
  const body = stripComments(fs.readFileSync(abs, 'utf8')).toLowerCase();
  for (const h of COOL_HEXES) {
    const n = body.split(h).length - 1;
    if (n) coolHexStray.push(`${rel}：${h}×${n}`);
  }
}
check(
  `H27-b 藍綠色原階 hex 全站硬零（檢查 ${COOL_HEXES.length} 個 hex）`,
  coolHexStray.length === 0,
  coolHexStray.length ? coolHexStray.slice(0, 3).join('、') : `0 處／${COOL_HEXES.length} 個 hex`
);

// H27-c：冷色 rgba 發光硬零。
const coolGlow = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const m = stripComments(fs.readFileSync(abs, 'utf8')).match(
    /rgba?\(\s*(?:6\s*,\s*182\s*,\s*212|14\s*,\s*165\s*,\s*233|37\s*,\s*99\s*,\s*235|59\s*,\s*130\s*,\s*246|20\s*,\s*184\s*,\s*166)\s*,[^)]*\)/g
  );
  if (m) coolGlow.push(`${rel}（${m.length}）`);
}
check('H27-c 藍綠色光暈（rgba）全站硬零', coolGlow.length === 0, coolGlow.length ? coolGlow.join('、') : '0 處');

// H27-d：身份表兩行都在（反向控制）。
const spElement = speciesSrc.match(/sp_element:/g)?.length || 0;
const spHumanoid = speciesSrc.match(/sp_humanoid:/g)?.length || 0;
check(
  'H27-d 身份表兩行都在（反向控制）',
  spElement === 1 && spHumanoid === 1,
  `sp_element ${spElement} 處、sp_humanoid ${spHumanoid} 處`
);

// H27-e：JRPGBadge 不准保留 cyan 死變體。
check(
  'H27-e 徽章沒有 cyan 死變體',
  !KNOWN_VARIANTS.has('cyan'),
  KNOWN_VARIANTS.has('cyan') ? '`cyan` 死變體仍在' : 'cyan 已刪'
);

// H27-f：令牌總數只減不增（預算 6）。
const COOL_BUDGET = 6;
check(
  `H27-f 冷色家族總數只減不增（預算 ${COOL_BUDGET}）`,
  coolTotal <= COOL_BUDGET,
  `${coolTotal} / 預算 ${COOL_BUDGET}`
);

// H28：lime／pink 家族（第三十一輪）。
//
// 開場實測 8 個 class 令牌／1 檔（GourmetCookbook 的 TASTE_COLOR／TASTE_DOT）。
// 它們背的是味覺系統的酸（lime）與甜（pink）——與 sky 同病：借色無語意，
// 味道已由文字標籤（酸／甜）辨識，顏色是重複編碼。本輪改走紙／墨階。
// 珠表 hex（#65a30d/#db2777/#84cc16 等）屬 R38 範圍，不在此硬零。
const LIME_PINK_FAMS = /(?:[a-z-]+:)*(?:text|bg|border|border-[lrtbxy]|ring|ring-offset|divide|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:lime|pink)-\d{2,3}(?:\/\d+)?/g;

const limePinkStray = [];
let limePinkTotal = 0;
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    const hits = line.match(LIME_PINK_FAMS);
    if (!hits) return;
    limePinkTotal += hits.length;
    limePinkStray.push(`${rel}:${i + 1} → ${hits.join(' ')}`);
  });
}
check(
  'H28 lime／pink class 令牌全站硬零（味覺去色）',
  limePinkStray.length === 0,
  limePinkStray.length
    ? `${limePinkStray.length} 處：${limePinkStray.slice(0, 3).join('、')}`
    : `0 處外洩（全站 ${limePinkTotal} 個 class 令牌已去色）`
);

// H28-a：味覺表酸／甜兩項仍在（反向控制：去色不代表砍掉味道）。
const tasteSrc = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/features/character-sheet/components/companions/GourmetCookbook.jsx'), 'utf8')
);
const hasSour = /酸味:\s*'[^']*'/.test(tasteSrc);
const hasSweet = /甜味:\s*'[^']*'/.test(tasteSrc);
check(
  'H28-a 味覺表酸／甜兩項仍在（反向控制）',
  hasSour && hasSweet,
  `酸=${hasSour} 甜=${hasSweet}`
);

/* ────────────────────────────────────────────────────────────────
   H29 家族：剝註解器本身也要有護欄（2026-10-24 第三十二輪 §CI40）
   ────────────────────────────────────────────────────────────────

   背景：H20 檢查「全站不得有 purple 令牌」，但 NPCWorkshop 魔防明明寫著
   `text-purple-800` 卻一路綠燈。原因是 stripComments 把 `accept="image/*"`
   裡的 `/*` 當成區塊註解開頭，一路吃到下一個 `*\/`，把整段真實 JSX 塗白——
   護欄看不見被塗白的程式碼，於是「假綠」。

   教訓：**檢查工具的缺陷，會讓所有依賴它的斷言一起失效**。所以護欄不能只
   檢查被測物，還要檢查「檢查本身」。
   ──────────────────────────────────────────────────────────────── */

// H29：剝註解器自檢（合成樣本——註解要剝掉、真程式要留下）。
const H29_SAMPLE = [
  'const A = () => (',
  '  <input accept="image/*" onChange={(e) => setFile(e.target.files[0])} />',
  ');',
  '// 舊版會把下面這行的 text-purple-800 當成違規，其實它在註解裡',
  'const B = () => <span className="text-purple-800">魔防</span>;',
  '/* 這個區塊註解的結尾，正是舊版誤配對的對象 */',
].join('\n');
const h29Stripped = stripComments(H29_SAMPLE);
const h29Raw = count(H29_SAMPLE, 'text-purple-800');
const h29Kept = count(h29Stripped, 'text-purple-800');
const h29Glob = h29Stripped.includes('accept="image/*"');
check(
  'H29 剝註解器自檢：註解剝掉、真程式留下',
  h29Raw === 2 && h29Kept === 1 && h29Glob,
  `原始 ${h29Raw} 處 → 剝除後 ${h29Kept} 處（應為 1）；image/* 保留=${h29Glob}`
);

// H29-a：剝註解不得位移行號（否則所有錯誤訊息都指錯行）。
const h29Drift = walkSrc(path.join(ROOT, 'src')).filter((abs) => {
  const raw = fs.readFileSync(abs, 'utf8');
  return raw.split('\n').length !== stripComments(raw).split('\n').length;
});
check(
  'H29-a 剝註解不位移行號（全 src 逐檔）',
  h29Drift.length === 0,
  h29Drift.length
    ? `位移 ${h29Drift.length} 檔：${h29Drift.slice(0, 3).map((f) => path.relative(ROOT, f)).join('、')}`
    : `${walkSrc(path.join(ROOT, 'src')).length} 檔行號全部一致`
);

// H29-b：剝註解不得塗白真實 JSX（原始行有 className=" 者，剝除後該行仍要有）。
const h29Blanked = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rawText = fs.readFileSync(abs, 'utf8');
  const rawLines = rawText.split('\n');
  const stLines = stripComments(rawText).split('\n');
  for (let i = 0; i < rawLines.length; i += 1) {
    if (rawLines[i].includes('className="') && !(stLines[i] || '').includes('className="')) {
      h29Blanked.push(`${path.relative(ROOT, abs).replace(/\\/g, '/')}:${i + 1}`);
    }
  }
}
check(
  'H29-b 剝註解不塗白真實 JSX（className 行逐行比對）',
  h29Blanked.length === 0,
  h29Blanked.length ? `被塗白 ${h29Blanked.length} 行：${h29Blanked.slice(0, 3).join('、')}` : '0 行被塗白'
);

// H29-c：反向控制——自檢樣本必須仍存在於真實原始碼，否則 H29 是空轉。
const h29GlobReal = walkSrc(path.join(ROOT, 'src')).reduce(
  (n, abs) => n + count(fs.readFileSync(abs, 'utf8'), 'image/*'),
  0
);
check(
  'H29-c 自檢樣本仍存在於真實原始碼（反向控制）',
  h29GlobReal >= 3,
  `${h29GlobReal} 處 accept="image/*"`
);

// H29-d：魔防 M.DEF 屬性列無色相令牌（逐項——本輪真正修掉的那一行）。
const H29_HUE =
  /(?:[a-z-]+:)*(?:text|bg|border|ring|from|via|to|fill|stroke)-(?:red|rose|pink|amber|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia)-\d{2,3}/;
const h29NpcSrc = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/features/npc-workshop/NPCWorkshop.jsx'), 'utf8')
);
const h29StatLine = h29NpcSrc.split('\n').find((l) => l.includes('M.DEF')) || '';
const h29StatHit = h29StatLine.match(H29_HUE);
check(
  'H29-d 魔防 M.DEF 屬性列無色相令牌（逐項）',
  h29StatLine !== '' && !h29StatHit,
  h29StatLine === '' ? '找不到 M.DEF 行' : h29StatHit ? `命中 ${h29StatHit[0]}` : '墨色，乾淨'
);

// H28-b：味覺表五項皆無色相令牌（逐項——第三十二輪補完苦味，味覺 5/5 去色）。
// 為什麼是逐項而不是總數：總數可以被「這裡加一個、那裡減一個」抵掉，
// 逐項擋的是「任何一味回頭借色」這件事本身。
const TASTE_KEYS = ['苦味', '鹹味', '酸味', '甜味', '鮮味'];
const H28_HUE =
  /(?:[a-z-]+:)*(?:text|bg|border|ring|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:red|rose|pink|amber|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia)-\d{2,3}/;
const tasteColorBlock = (tasteSrc.match(/const TASTE_COLOR = \{([\s\S]*?)\};/) || [])[1] || '';
const tasteDotBlock = (tasteSrc.match(/const TASTE_DOT = \{([\s\S]*?)\};/) || [])[1] || '';
const tasteDirty = TASTE_KEYS.filter((k) => {
  const c = new RegExp(`${k}:\\s*'([^']*)'`).exec(tasteColorBlock);
  const d = new RegExp(`${k}:\\s*'([^']*)'`).exec(tasteDotBlock);
  return Boolean((c && H28_HUE.test(c[1])) || (d && H28_HUE.test(d[1])));
});
check(
  'H28-b 味覺表五項皆無色相令牌（逐項）',
  tasteDirty.length === 0,
  tasteDirty.length ? `仍帶色：${tasteDirty.join('、')}` : '5 項皆紙／墨'
);

// H28-c：反向控制——五項必須都還在（去色不等於把味道刪掉）。
const tasteMissing = TASTE_KEYS.filter((k) => !tasteColorBlock.includes(`${k}:`));
check(
  'H28-c 味覺表五項仍在（反向控制）',
  tasteMissing.length === 0,
  tasteMissing.length ? `缺：${tasteMissing.join('、')}` : '5 項都在'
);

/* ────────────────────────────────────────────────────────────────
   H30 家族：徽章身份出口收斂（2026-10-24 第三十三輪 §CI41）
   ────────────────────────────────────────────────────────────────

   背景：`JRPGBadge` 有六個「身份」變體（gold/amber/rose/green/purple/indigo），
   由 `characterThemes.badgeVariant` 逐主題指向。三個問題：

   1. 色相是保留色——`speciesThemes` 七族各佔一色，徽章借用等於偷身份。
   2. `blue` 主題指向 `cyan`，而 `cyan` 在第三十輪已刪 → `variantStyles[v] || …`
      讓它**靜默變成金色**，與 `amber` 主題撞色。H24-d 掃的是 JSX 字面值，
      掃不到 `theme.badgeVariant` 這種**間接引用**——這是它的缺口。
   3. `slate` 同時是「序」（冠位／精英／一般）的通道與 `slate` 主題的身份徽章，
      一個鍵兩個意思。

   判準：徽章的內容是 `Lv N`，身份由 `accent`（頭像環／頁籤／圖示）承載，
   色相是重複編碼 → 六個身份鍵收斂成一個 `ink` 紙墨徽章。
   ──────────────────────────────────────────────────────────────── */

const BADGE_MAP = new Map(
  [...badgeMapSrc.slice(variantBlockStart, variantBlockEnd).matchAll(/^\s*"?([a-z][a-z-]*)"?:\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]])
);

// H30：徽章檔本身零色相令牌（硬零）。
const BADGE_HUE =
  /(?:text|bg|border|ring|from|via|to|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/g;
const badgeHueHits = badgeMapSrc.match(BADGE_HUE) || [];
check(
  'H30 JRPGBadge 零色相令牌（身份改紙墨）',
  badgeHueHits.length === 0,
  badgeHueHits.length ? `命中 ${badgeHueHits.length}：${badgeHueHits.slice(0, 5).join('、')}` : '0 處（全檔紙／墨／登記語意色）'
);

// H30-a：六個角色主題指向的身份變體，樣式必須**收斂成同一個值**。
// 用「集合大小」而不是「比對字串」：允許是任何一個值，但必須是**同一個**。
const themeSrcForBadge = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/features/character-sheet/utils/characterThemes.js'), 'utf8')
);
const themeBadgeVals = [...themeSrcForBadge.matchAll(/badgeVariant:\s*'([a-z][a-z-]*)'/g)].map((m) => m[1]);
const identityStyles = new Set(themeBadgeVals.map((v) => BADGE_MAP.get(v)).filter(Boolean));
const inkStyle = BADGE_MAP.get('ink');
check(
  'H30-a 六個主題的身份徽章收斂成同一個值（集合大小 1）',
  themeBadgeVals.length === 6 && identityStyles.size === 1 && identityStyles.has(inkStyle),
  `${themeBadgeVals.length} 個主題 → ${identityStyles.size} 個不同樣式${identityStyles.size === 1 && !identityStyles.has(inkStyle) ? '（但不是 ink）' : ''}`
);

// H30-b：`characterThemes.badgeVariant` 的每個值都必須登記過。
// 這條補 H24-d 的缺口——H24-d 只看 JSX 字面值，看不到 `theme.badgeVariant` 的間接引用。
const unregisteredBadgeVals = themeBadgeVals.filter((v) => !KNOWN_VARIANTS.has(v));
check(
  'H30-b 每個 badgeVariant 值都登記過（補間接引用缺口）',
  unregisteredBadgeVals.length === 0,
  unregisteredBadgeVals.length
    ? `${unregisteredBadgeVals.length} 個未登記：${[...new Set(unregisteredBadgeVals)].join('、')}（會靜默 fallback）`
    : `${themeBadgeVals.length} 個指向全部有效`
);

// H30-c：反向控制——語意與序的變體一個都不能被「收斂」順手刪掉。
const REQUIRED_BADGE_VARIANTS = ['ink', 'zinc', 'danger', 'rank-top', 'rank-mid', 'slate', 'marker', 'selected'];
const missingBadgeVariants = REQUIRED_BADGE_VARIANTS.filter((v) => !KNOWN_VARIANTS.has(v));
check(
  'H30-c 語意／序徽章變體全數仍在（反向控制）',
  missingBadgeVariants.length === 0,
  missingBadgeVariants.length ? `缺 ${missingBadgeVariants.join('、')}` : `${REQUIRED_BADGE_VARIANTS.length} 個都在（共 ${KNOWN_VARIANTS.size} 個）`
);

/* ────────────────────────────────────────────────────────────────
   H31 家族：色票登記表的盲點（2026-10-24 第三十三輪 §CI42）
   ────────────────────────────────────────────────────────────────

   背景：`REGISTERED_HEX` 這張表存在很久，但「只用登記色票」那條護欄
   **只掃 7 個同伴檔**。所以全站 145 個檔案裡的手寫 hex 從來沒被檢查過。

   實測（本輪開場）：173 個不同 hex、6221 次使用，其中 **149 個未登記**
   （769 次）。最大的一群是「看起來一樣但不在表裡」的漂移——例如
   `#f5efdf` 用了 78 次、跟 `#f4ebd9` 只差 6/255，肉眼分不出來，
   但改色階永遠改不到它，而且它會跟著影印到下一支檔案。

   三條護欄各擋一種退化：
     H31   預算（只減不增）：未登記 hex 的總使用次數
     H31-a 逐項：珠色身份表 23 色必須全部登記
     H31-b 反向控制：珠色身份表 23 色仍在（登記不等於刪掉）
     H31-c 硬零：不得再有「與登記色 Δ≤12 且色相接近」的未登記 hex
   ──────────────────────────────────────────────────────────────── */

const H31_HEX = /#[0-9a-fA-F]{6}\b/g;
const h31Map = new Map();
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(H31_HEX)) {
    const h = m[0].toLowerCase();
    if (!h31Map.has(h)) h31Map.set(h, { n: 0, files: new Set() });
    const rec = h31Map.get(h);
    rec.n += 1;
    rec.files.add(rel);
  }
}
const h31Unreg = [...h31Map.entries()].filter(([h]) => !REGISTERED_HEX.has(h));
const h31UnregTotal = h31Unreg.reduce((s, x) => s + x[1].n, 0);

// H31：**硬零**。全站手寫 hex 必須全部在登記表裡。
//
// 形狀原本是「預算（只減不增）」，理由寫在上一段：還有 227 次未登記的 hex
// 散在書頁棕與一次性色碼裡，那些要逐項裁決，不是機械替換。預算擋的是
// 「繼續增加」，不是「一次清零」。
//
// 第三十八輪（§CI46）清零了，所以形狀跟著換。為什麼要換、不能留一個
// 「預算 0」：**預算式護欄的弱點是它允許交換**——留 0 跟留 227 的差別
// 只是額度大小，兩者都允許「這裡加一個、那裡減一個」。硬零不允許交換。
//
// 這一輪的帳（逐項裁決見 §CI46）：
//   227 → 43  刪掉 248 處 `|| '#hex'` 回退的殘餘
//    43 → 28  書頁棕收斂（117 處，見 H23-d）與三處漂移
//    28 →  0  18 個真身份登記（九相 3／四屬性 4／身份深淺 11）
//
// 掉下來的三種東西各有各的死法，但都死在同一件事上：**沒有人量過它**。
//   - `#8b4513` ×4（NPC 工坊的連結文字）：離登記的 `#833f12` 只差 Δ8／h1°，
//     是漂移；它活了三十七輪，因為它「看起來像設計過的棕色」。
//   - 六狀態裡的四個（`#7a6a9c`/`#4a4068`/`#c0603f`/`#8a3f26`）：見
//     `CombatantCard` 的檔頭——它們是「signal 只有四個令牌、狀態有六個」
//     的補丁，不是裁決。
//   - `accentLight` 五個：見 `identityPalette` 的檔頭——「六個值各用一次」
//     聽起來像小事，但它是身份的第三個明度，本來就該跟身份放一起。
const H31_BUDGET = 0;
check(
  'H31 全站手寫 hex 全部登記（硬零）',
  h31UnregTotal <= H31_BUDGET,
  h31UnregTotal
    ? `${h31UnregTotal} 次／${h31Unreg.length} 個未登記：${h31Unreg.slice(0, 5).map((x) => x[0]).join('、')}`
    : `0 處／${h31Map.size} 個相異 hex 全部在登記表`
);

// H31-a：珠色身份表 23 色全部登記（逐項）。
const h31TechSrc = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/features/character-sheet/data/technospheres.js'), 'utf8')
);
// 取出一個 `Object.freeze({ … })` 或 `{ … }` 常數的內容（兩種結尾都要吃得下）
const h31Block = (src, name) => {
  const i = src.indexOf(`const ${name}`);
  if (i < 0) return '';
  const a = src.indexOf('});', i);
  const b = src.indexOf('};', i);
  const ends = [a, b].filter((x) => x > 0);
  return src.slice(i, ends.length ? Math.min(...ends) : src.length);
};
const h31BeadPairs = new Map(); // table -> [{k, v}]
const h31BeadHexes = new Set();
for (const name of ['MNEMOSPHERE_BEAD_TINTS', 'DAMAGE_TYPE_TINTS']) {
  const body = h31Block(h31TechSrc, name);
  const pairs = [...body.matchAll(/^\s*([^\s:]+):\s*'(#[0-9a-fA-F]{6})'/gm)].map((m) => ({ k: m[1], v: m[2].toLowerCase() }));
  h31BeadPairs.set(name, pairs);
  for (const p of pairs) h31BeadHexes.add(p.v);
}
const h31BeadUnreg = [...h31BeadHexes].filter((h) => !REGISTERED_HEX.has(h));
const h31BeadKeys = [...h31BeadPairs.values()].reduce((s, p) => s + p.length, 0);
check(
  'H31-a 珠色身份表全部 hex 已登記（逐項）',
  h31BeadKeys >= 23 && h31BeadUnreg.length === 0,
  h31BeadUnreg.length
    ? `未登記 ${h31BeadUnreg.length}：${h31BeadUnreg.slice(0, 4).join('、')}`
    : `${h31BeadKeys} 個鍵／${h31BeadHexes.size} 個相異色，全部在表內`
);

// H31-b：反向控制——登記不等於刪掉。珠表若被清空，H31-a 會空轉變綠。
// 用「鍵數」而不是「色數」：兩個表（職業魔石／傷害類型）本來就會共用顏色，
// 色數天生比鍵數少一；用色數當門檻會把「跨表共用」誤判成退化。
check(
  'H31-b 珠色身份表 23 個鍵仍在（反向控制）',
  h31BeadKeys >= 23,
  `${h31BeadKeys} 個鍵／${h31BeadHexes.size} 個相異色`
);

// H31-d：一鍵一色、互不相異（注入性）。
//
// 為什麼 H31-b 不夠：把「魔奏者」的紫色換成另一個**新的**紫色，總數還是 23、
// 而且新色也登記過——H31-a／b 都會綠。但兩個職業從此長得一樣，
// 那正是 H14-b 對九相圖示擋過的同一件事：撞色的圖示不是「剛好同色」，
// 是其中一個身份消失了。
const h31Inject = [];
for (const [name, pairs] of h31BeadPairs) {
  const seen = new Map();
  for (const p of pairs) {
    if (seen.has(p.v)) h31Inject.push(`${name}: ${p.k} 與 ${seen.get(p.v)} 同為 ${p.v}`);
    else seen.set(p.v, p.k);
  }
}
check(
  'H31-d 珠色身份表一鍵一色（互不相異）',
  h31Inject.length === 0,
  h31Inject.length ? h31Inject.slice(0, 3).join('；') : `${[...h31BeadPairs.values()].reduce((s, p) => s + p.length, 0)} 個鍵各自一色`
);

// H31-c：硬零——不得再有「與登記色 Δ≤12 且色相接近」的未登記 hex。
//
// 為什麼要色相檢查：最大通道差看不出「冷灰 vs 暖奶油」。`#f2f5f8` 與
// `#fbf7ee` 的 Δ 只有 10，但色相差 168°——併掉它是把藍灰變成奶油，
// 不是收斂漂移。所以只有「色相接近」或「兩者都近乎無彩」才算漂移。
const h31Rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const h31Dist = (a, b) => {
  const A = h31Rgb(a);
  const B = h31Rgb(b);
  return Math.max(...[0, 1, 2].map((i) => Math.abs(A[i] - B[i])));
};
const h31Hsl = (hex) => {
  const [r0, g0, b0] = h31Rgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r0) h = 60 * (((g0 - b0) / d) % 6);
    else if (max === g0) h = 60 * ((b0 - r0) / d + 2);
    else h = 60 * ((r0 - g0) / d + 4);
  }
  return { h: (h + 360) % 360, s };
};
const h31HueDiff = (a, b) => {
  const A = h31Hsl(a);
  const B = h31Hsl(b);
  if (A.s < 0.06 || B.s < 0.06) return 0;
  const d = Math.abs(A.h - B.h);
  return Math.min(d, 360 - d);
};
// 第三十八輪：這張豁免表**刪掉了**。
//
// 它原本列了 8 個「書頁棕家族」的 hex，理由是「等 GM 裁決合併還是分工」。
// 裁決下來了（合併成一個暖色相），117 處也收斂完了，於是這 8 個值全部
// 走完自己的結局：`#8b5e34`／`#78350f` 併進墨階與強調色、`#8b4513`／`#7b4720`
// 併進 `#833f12`／墨階、`#693108` 登記成琥珀身份的深階。
//
// 留著一張「已裁決項目的豁免表」比留著債更危險：**債會被量到，豁免不會。**
const h31Drift = [];
for (const [h, rec] of h31Unreg) {
  let best = null;
  for (const g of REGISTERED_HEX) {
    const d = h31Dist(h, g);
    if (!best || d < best.d) best = { g, d };
  }
  if (best.d <= 12 && h31HueDiff(h, best.g) <= 15) {
    h31Drift.push(`${h}→${best.g}（Δ${best.d}，${rec.n} 次）`);
  }
}
check(
  'H31-c 全站零「近似漂移」未登記 hex（Δ≤12 且色相接近）',
  h31Drift.length === 0,
  h31Drift.length ? `${h31Drift.length} 個：${h31Drift.slice(0, 4).join('、')}` : `0 個／${REGISTERED_HEX.size} 個登記色`
);

/* ────────────────────────────────────────────────────────────────
   H36 家族：三份拷貝、一個色相、以及一條從來沒掃過的路（第三十八輪 §CI46）
   ────────────────────────────────────────────────────────────────

   本輪的主題是「同一個調色盤存在三份」：

     | 位置 | 欄位名 | 有沒有被任何護欄看過 |
     |---|---|---|
     | `characterThemes.js` | `accent`／`accentDark`／`accentLight` | 只有這一份被看過 |
     | `ClockTracker.jsx` | `fill`／`stroke` | 沒看過（欄位名不同，所以「同名比對」抓不到） |
     | `index.css` 的 `[data-theme]` | `--ink`／`--signal` | **完全沒看過** |

   第三份的真相更難看：`data-theme` 在全站被設定 **0 次**，12 個變數 × 2 組
   只被 `.ui-panel`／`.ui-zone` 讀，而那兩條規則用了 **0 次**。也就是說那是一套
   從來沒有連上電的顏色系統，而它的 `--ink` 是 `#2a3240`（冷墨）——如果哪天
   有人真的把 `data-theme` 掛上去，全站內文會從暖墨變成冷墨，而且**沒有任何
   護欄會紅**。本輪把它整組刪掉，只留 `:root { --r: 2px }`。

   下面六條各擋一種退化：
     H36   CSS 檔的手寫 hex 也要登記（硬零）——修 `walkSrc` 只收 .js/.jsx 的盲點
     H36-a `rgba()` 的三通道必須是一個登記色（逐項）——hex 換個寫法就繞過了
     H36-b 身份的明度單調：light > accent > dark（逐項六組）
     H36-c 設定層的死宣告（只減不增，預算 1）——`tailwind.config.js` 是唯一沒量過的一層
     H36-d `characterThemes.js` 只有紙與墨（封閉白名單）——第二份拷貝不得再長出來

     H37  匯出頁字級一律引用 `T`（封閉白名單）——49 個字面值收成 9 階
     H37-a 全站零小數字級（硬零）——CSS／行內／Tailwind 三種寫法一起掃
     H37-b CSS 層 `font-size` 落在匯出字級階梯上（值域）——H33 的 CSS 對應物
     H37-c 行內圓角只有 2px／50%／0（逐項）——`H34-d` 只掃 `.css` 檔
     H37-d 每個 `var(--x)` 都有定義（硬零）——`--tw-*` 是 Tailwind 命名空間，豁免

     H38  冷暖同階等亮（每階 ≤1%）——「同一個墨在兩區對比一樣」的充分條件
     H38-a 兩區都是嚴格遞減的六階（單調性）——階梯不能有回頭路
     H38-b 兩區鍵名集合相同（集合相等）——只加一階等於偷偷拆掉對齊
     H38-c 冷區（戰鬥模組）的面不得出現暖紙 hex 或 `warm-*`（硬零）
     H38-d 反向控制：暖區（書本外框）不得出現 `cool-*` 面令牌（硬零）

     H39  未登記的死 class（硬零）——現編 CSS，問「這個名字真的存在嗎」
     H39-a 已修好的名字要從清單拿掉（清單不得腐爛）
     H39-b 死 class 總數只減不增（預算 0）——第四十二輪之後不允許有任何一個

   第四十一輪的判準是：**「讀起來像一個決定」不等於「是一個決定」。**
   `sat-hiber` 有註解、有分支、有位置，只差一樣東西：它不存在。
   而前面三十九條護欄全是讀原始碼的——它們讀得到那個字串，讀不到「它不存在」。
   只有 Tailwind 自己能回答，所以 H39 是唯一一條**現編 CSS** 的護欄。

   第四十輪的判準是：**「兩區都有顏色」不等於「兩區是同一張紙」。**
   舊的兩條階梯各自挑色，冷區每階暗 5.8–8.0%，於是同一組墨在兩區對比不同——
   `ink-2` 在暖區第 1 階 4.72:1（過），在冷區第 1 階 4.46:1（不過）。
   H38 守的是「同階等亮」，H38-c／d 守的是「冷暖各守一邊」。

   第三十九輪的判準是：**「把檔案加進掃描範圍」不等於「檔案受到檢查」。**
   第三十八輪把 `.css` 加進 `walkSrc` 之後，239/239 依然全綠、零新增——
   因為護欄的樣式是 `text-[13px]`，而 CSS 寫的是 `font-size: 13px`。
   真正的缺口不是檔案沒被掃，是**同一條禁令有幾種寫法**。
   `GRAD_TOKEN`（漸層）早就三種全認，這一輪只是把同一個問法補到字級與圓角上。

   刻意**沒有**加的兩條，以及為什麼：

     ✗ 六身份 ↔ 命刻主題「覆蓋」——已經被「命刻色相一對一」涵蓋。
       六個身份、六個主題，注入性成立時覆蓋必然成立（鴿籠原理），
       再寫一條只是同一個問題問兩次。
     ✗ 九相九色／四屬性四色的「大小與可辨」——已經被 H14-b（九相九色兩兩不同）
       與 H15-a（四屬性四色兩兩不同）涵蓋。本輪破壞驗證跑出來的結果是：
       把「土」改成「電」的顏色，會同時讓 **4 條**既有護欄變紅。
       在那裡再加一條不會多擋任何東西，只會讓「通過 240 條」看起來比實際嚴謹。
   ──────────────────────────────────────────────────────────────── */

// H36：CSS 檔也要掃。
//
// 這是本專案第三次踩同一個坑：`walkSrc` 只收 `.js`／`.jsx`，所以 `.css` 從
// 第一輪到現在**從來沒有被任何色票護欄掃過**。前兩次的代價是
// `index.css` 裡一條 `#b45309`（H23-b 明文硬零的琥珀）活了三十七輪，
// 以及 `body` 的兩條 `radial-gradient` 裡藏著 `rgba(139, 94, 52, .03)`
// ——那是書頁棕，用 rgba 寫的，所以 hex 護欄看不見它。
const walkCss = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkCss(p);
    return /\.css$/.test(e.name) ? [p] : [];
  });
const CSS_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const cssStray = [];
let cssFiles = 0;
for (const abs of walkCss(path.join(ROOT, 'src'))) {
  cssFiles += 1;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(CSS_HEX)) {
    const raw = m[0].toLowerCase();
    // 只認 6 位；3 位縮寫與 8 位（含 alpha）視為「寫法不統一」，一併擋下
    if (raw.length !== 7) {
      cssStray.push(`${rel}:${raw}（非 6 位寫法）`);
      continue;
    }
    if (!REGISTERED_HEX.has(raw)) cssStray.push(`${rel}:${raw}`);
  }
}
check(
  'H36 CSS 檔的手寫 hex 全部登記（硬零）',
  cssStray.length === 0 && cssFiles > 0,
  cssStray.length
    ? `${cssStray.length} 處：${[...new Set(cssStray)].slice(0, 5).join('、')}`
    : `${cssFiles} 個 CSS 檔／0 處未登記`
);

// H36-a：`rgba()` 的三通道也必須是一個登記色。
//
// 為什麼要有這一條：`#8b5e34` 當 hex 寫的時候 H31 抓得到，寫成
// `rgba(139, 94, 52, 0.03)` 就完全繞過去了——而它正是這樣活過第三十七輪的。
// 「換一種寫法」是最常見的繞過方式，護欄必須認得同一件事的兩種寫法。
//
// 可接受的來源有三種，缺一種就會生出假紅：
//   ① `REGISTERED_HEX`——書頁色票與三組身份色
//   ② `tailwind.config.js` 的 v5 色階——`rgba(42,50,64,.035)` 是 `ink.DEFAULT`
//      當陰影用；它不在書頁色票裡，但它是**登記過的令牌**
//   ③ 純無彩色 `#000000`／`#ffffff`——影、光澤、遮罩。無彩色沒有色相，
//      不屬於「身份 vs 量」的任何一邊，硬要它登記只會逼人去發明一個名字
const TW_HEX = new Set();
const collectTw = (obj) => {
  for (const v of Object.values(obj || {})) {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) TW_HEX.add(v.toLowerCase());
    else if (v && typeof v === 'object') collectTw(v);
  }
};
collectTw(twConfig.theme.extend.colors);
const ACHROMATIC = new Set(['#000000', '#ffffff']);
const RGBA_LIT = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)/g;
const rgbaStray = [];
const hexOf = (r, g, b) =>
  '#' + [r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
for (const abs of [...walkSrc(path.join(ROOT, 'src')), ...walkCss(path.join(ROOT, 'src'))]) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(RGBA_LIT)) {
    const h = hexOf(m[1], m[2], m[3]);
    if (!REGISTERED_HEX.has(h) && !TW_HEX.has(h) && !ACHROMATIC.has(h)) {
      rgbaStray.push(`${rel}:${m[0]}→${h}`);
    }
  }
}
check(
  'H36-a rgba 三通道必須是登記色（逐項）',
  rgbaStray.length === 0,
  rgbaStray.length
    ? `${rgbaStray.length} 處：${[...new Set(rgbaStray)].slice(0, 4).join('、')}`
    : `0 處／書頁 ${REGISTERED_HEX.size} 色 ＋ 令牌 ${TW_HEX.size} 色 ＋ 無彩色 2`
);

// H36-b：身份的明度單調。

//
// 「深階比本體還淺」是那種改一個字元、畫面只差一格、看起來像設計過的錯。
// 用相對亮度（WCAG 的定義）而不是 HSL 的 l：`l` 對深色不敏感，
// 兩個都在 l 20% 左右的顏色可以差 3 倍亮度。
const lumOf = (hex) => {
  const c = h31Rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const identityKeys = Object.keys(IDENTITY);
const monoBad = [];
for (const [k, v] of Object.entries(IDENTITY)) {
  const [Ld, La, Ll] = [lumOf(v.dark), lumOf(v.accent), lumOf(v.light)];
  if (!(Ld < La && La < Ll)) {
    monoBad.push(`${k}（dark ${Ld.toFixed(3)} / accent ${La.toFixed(3)} / light ${Ll.toFixed(3)}）`);
  }
}
check(
  'H36-b 身份的明度單調 light > accent > dark（逐項六組）',
  monoBad.length === 0,
  monoBad.length ? `${monoBad.length} 組不單調：${monoBad.join('；')}` : `${identityKeys.length} 組全部單調`
);

// H36-c：設定層的死宣告（只減不增，預算 1）。
//
// 為什麼要量這個：`tailwind.config.js` 是一份**宣告**，而宣告了沒人用的東西
// 不會報錯、不會影響畫面、也不會被任何既有護欄看見——它是第三十七輪那個病
// （宣告了卻不會發生）唯一還沒量過的一層。
//
// 第三十九輪實測 17 個死鍵，處置分兩類：
//   - `parchment` 的 14 個子鍵 → **刪掉**。它們是 v1 遺留，設定層自己的註解
//     就寫著「遷移完成後 parchment 整組應移除」，而且其中四個帶著 H23-b 明文
//     硬零的琥珀值。留著它們有一個具體代價：H36-a 第一版對
//     `rgba(139, 94, 52, .6)` 是綠的，因為 `#8b5e34` 在設定層還算一個「令牌」。
//   - `cool-0`／`cool-line`／`cool-line-2`／`warm-line-2` → 當時留下，列入預算。
//
// 第四十輪（§CI48）：**這四條全部消失**，但不是被刪掉——是階梯重建之後
// 每一階都有了角色名，四階不夠用、六階才夠。預算由 3 降到 1。
//
// ⚠️ 本輪修掉這條護欄自己的一個漏洞，而且修法是把整段正則刪掉：
// 舊版用 `^ {10}(?:'([^']+)'|([a-zA-Z]+)):\s*'(#……)'` 逐行讀設定檔，
// 而這個正則**抓不到數字鍵**——`cool-0` 這種鍵從來沒有被算進 `deadTw`。
// 上一輪報告的「4 個死鍵」其實是「3 個死鍵 ＋ 1 個看不見的鍵」。
// 現在直接讀已經 import 進來的 `twConfig`（同一份設定的解析結果），
// 鍵名由 `Object.keys` 給，數字鍵、引號鍵、連字號鍵一視同仁。
// **能讀結構就不要讀文字**——正則版本的漏洞不是寫錯，是選錯了介面。
//
// 形狀用預算不用硬零：剩下的那一個（`warm-panel-2`）不是「忘了用」，
// 是暖區目前沒有任何一個容器需要「比面板淺一階、比頁面深一階」——
// 冷區有（戰鬥畫面的分區帶），暖區沒有。留著是因為階梯要對稱，
// 不對稱的階梯會讓「同一階在兩區等亮」變成假的。
const DEAD_TW_BUDGET = 1;
const twColourKeys = [];
for (const [group, val] of Object.entries(twConfig.theme.extend.colors)) {
  if (!val || typeof val !== 'object') continue;
  for (const [key, hex] of Object.entries(val)) {
    if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) twColourKeys.push({ group, key });
  }
}
const twCorpus = walkSrc(path.join(ROOT, 'src'))
  .map((f) => stripComments(fs.readFileSync(f, 'utf8')))
  .join('\n');
const deadTw = [];
const seenTw = new Set();
for (const k of twColourKeys) {
  const name = k.key === 'DEFAULT' ? k.group : `${k.group}-${k.key}`;
  if (seenTw.has(name)) continue;
  seenTw.add(name);
  // class 名一定有前綴（`bg-signal-hp`），所以只擋「後面接字母或連字號」
  const n = (twCorpus.match(new RegExp(`(?<![a-zA-Z])${name}(?![a-zA-Z-])`, 'g')) || []).length;
  if (n === 0) deadTw.push(name);
}
check(
  `H36-c 設定層顏色死鍵只減不增（預算 ${DEAD_TW_BUDGET}）`,
  deadTw.length <= DEAD_TW_BUDGET,
  `${deadTw.length} 個死鍵／預算 ${DEAD_TW_BUDGET}${deadTw.length ? `：${deadTw.join('、')}` : ''}`
);


//
// 這一條是「投影」形狀的反向控制。「命刻色相一對一」檢查的是 `ClockTracker`
// 有沒有指向 `IDENTITY`；這一條檢查**另一份拷貝有沒有再長出來**。
// 沒有它，有人把 `accent: '#245c45'` 寫回 `characterThemes` 也不會紅
// ——因為那個值本身是登記過的，H31 完全看不到。
//
// 形狀是「封閉白名單」而不是「不得等於身份色」：白名單擋得住**新的**
// 身份色寫回來（例如有人給第七個主題挑一個新色），黑名單擋不住。
// 名單裡只有 SHARED 的七個值，一個都不多。
const PAPER_INK_ALLOW = new Set([
  '#fbf7ee', // 紙（appBg／sheetBg／exportBg）
  '#fffdf9', // 卡
  '#f4ebd9', // 面板／副面（同時是琥珀身份的 light——這正是它必須留在白名單的原因：
             // 一個值可以同時是「紙」與「某個身份的淺底」，那不代表它是身份色）
  '#e8dcc4', // 頁首
  '#d6c7ab', // 邊界
  '#2c221e', // 墨一
  '#6b5a4b', // 墨二
]);
const charThemesHex = [
  ...new Set((stripComments(read('src/features/character-sheet/utils/characterThemes.js')).match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase())),
];
const identityLeak = charThemesHex.filter((h) => !PAPER_INK_ALLOW.has(h));
check(
  'H36-d characterThemes 只有紙與墨（封閉白名單）',
  identityLeak.length === 0,
  identityLeak.length
    ? `${identityLeak.length} 個非紙墨的 hex：${identityLeak.join('、')}`
    : `${charThemesHex.length} 個 hex 全在白名單的 7 個值裡`
);

/* ═══════════════════════════════════════════════════════════════════
   H37 家族：同一條禁令的三種寫法（第三十九輪 §CI47）
   ═══════════════════════════════════════════════════════════════════

   這一族的起點是一個**失敗的修補嘗試**。

   第三十八輪的殘債清單寫著「`walkSrc` 只收 `.js`／`.jsx`，其餘二十幾條
   護欄看不見 `.css`」。看起來的修法是「把 `.css` 加進 `walkSrc`」。
   我做了，然後量到：

   > **239/239 依然全綠，零新增失敗。**

   那個「全綠」不是好消息，是證據：護欄的樣式長成 `text-[13px]`，
   而 CSS 裡寫的是 `font-size: 13px`。**兩者永遠不會相遇。**
   把 `.css` 加進掃描範圍，只是讓「掃了 147 檔」這句話變真，
   而不是讓那 147 檔受到同樣的檢查。這是**假修補**：
   它讓覆蓋率這個數字變好看，而缺陷的數量一個都沒少。

   真正的缺口不是「檔案沒被掃」，是**同一條禁令有幾種寫法**：

   | 禁令 | Tailwind 類別 | CSS 宣告 | 行內樣式 | 本輪前誰看得到 |
   |---|---|---|---|---|
   | 任意字級 | `text-[13px]` | `font-size: 13px` | `fontSize: '13px'` | 只有第一種（H33） |
   | 圓角上限 | `rounded-[6px]` | `border-radius: 6px` | `borderRadius: '6px'` | 前兩種（H34／H34-d） |
   | 漸層 | `bg-gradient-to-r` | `linear-gradient(` | `linear-gradient(` | **三種全認**（GRAD_TOKEN） |
   | 顏色 | `#hex` | `#hex` | `#hex` | 三種（H31／H36 掃整段文字） |

   **漸層那一列就是模板。** 它的正則同時認得
   `bg-gradient-*`、`bg-[…linear-gradient…]` 與裸的 `linear-gradient(`，
   而且它自己走一遍含 `.css` 的樹（`walkWithCss`）。
   本輪只是把同一個問法套到字級與圓角上。

   ## 量到的缺口（本輪修掉之前）

   - `fontSize: '8px'` 等行內字級 **49 處／11 個值**，全在 `CharacterSheetExport.jsx`。
     同一時間 `H33`（全站零任意字級）是**綠的**——因為它只認 `text-[Npx]`。
   - CSS `font-size: 7px` 1 處，沒有任何護欄。
   - 行內 `borderRadius: '3px'` 1 處，超過 2px 上限；`H34-d` 只掃 `.css` 檔。
   - 13 處是半像素（7.5／8.5／9.5）——步距 6.3%，比型階梯最小步距 10% 還小一半。

   ## 為什麼匯出頁可以有自己的一套

   因為它**不是同一個媒介**。1123×794 的固定畫布要塞進三頁角色的全部內容，
   10px 起跳一定溢出，而 `overflow: hidden` 的溢出等於內容被裁掉。
   所以匯出頁的字級不是漂移，是**第二條真實存在的階梯**——
   問題是它原本沒有名字，49 個字面值散在檔案裡。

   修法沿用第三十六輪（圓角）那一句：**一個值、一個名字。**
   `T`（那個檔案裡 `C` 是顏色、`S` 是樣式、`T` 是字級）是匯出頁唯一的字級來源，護欄直接從原始碼解析它
   （不另外抄一份，否則又多一份可以漂移的拷貝）。
   ─────────────────────────────────────────────────────────────── */

const SHEET_TYPE_SRC = 'src/features/character-sheet/components/CharacterSheetExport.jsx';
const sheetTypeSrc = stripComments(read(SHEET_TYPE_SRC));

// 從原始碼解析 `T`：`s8: '8px',` → { s8: '8px' }
const sheetScale = new Map(
  [...sheetTypeSrc.matchAll(/^\s*(s\d+):\s*'([\d.]+px)'/gm)].map((m) => [m[1], m[2]])
);
const sheetScaleKeys = new Set(sheetScale.keys());
const sheetScaleVals = new Set(sheetScale.values());

// H37：匯出頁的行內字級必須引用 `T`，不准再寫字面值。
// 形狀選「封閉白名單」而不是「值域檢查」：後者允許 `fontSize: '9px'` 這種
// 看起來無害、但等於把階梯又抄了一份的寫法。要引用，不要複寫。
const inlineFontHits = [...sheetTypeSrc.matchAll(/fontSize:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
const inlineFontBad = inlineFontHits.filter((v) => {
  const m = /^T\.(s\d+)$/.exec(v);
  return !m || !sheetScaleKeys.has(m[1]);
});
check(
  'H37 匯出頁字級一律引用 T（封閉白名單）',
  inlineFontBad.length === 0,
  inlineFontBad.length
    ? `${inlineFontBad.length} 處字面值：${inlineFontBad.slice(0, 4).join('、')}`
    : `${inlineFontHits.length} 處全部走 T.sN／階梯 ${sheetScaleKeys.size} 階`
);

// H37-a：全站零小數字級——三種寫法一起掃。
//
// 為什麼半像素要當成缺陷而不是「更精細的排版」：
// 8px → 8.5px 是 **6.3%**，而型階梯最小的步距是 10px → 11px ＝ **10%**。
// 一個比系統自己允許的最小步距還小一半的差距，不構成可辨的層級；
// 而 `html-to-image` 光柵化時，小數字級在不同 DPR 下的捨入方向不一致，
// 同一張表在不同機器上可能一行高一像素。**它是雜訊，不是階層。**
const CSS_FONT_DECL = /font-size:\s*([\d.]+)px/g;
const INLINE_FONT_DECL = /fontSize:\s*'([\d.]+)px'/g;
const TW_FONT_DECL = /text-\[(\d+\.?\d*)px\]/g;
const decimalFont = [];
const walkAllSyntax = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkAllSyntax(p);
    return /\.(jsx?|css)$/.test(e.name) ? [p] : [];
  });
for (const abs of walkAllSyntax(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const [re, label] of [
    [CSS_FONT_DECL, 'font-size'],
    [INLINE_FONT_DECL, 'fontSize'],
    [TW_FONT_DECL, 'text-['],
  ]) {
    for (const m of src.matchAll(re)) {
      if (!Number.isInteger(Number(m[1]))) decimalFont.push(`${rel}:${label}${m[1]}px`);
    }
  }
}
check(
  'H37-a 全站零小數字級（CSS／行內／Tailwind 三種寫法一起掃）',
  decimalFont.length === 0,
  decimalFont.length ? `${decimalFont.length} 處：${decimalFont.slice(0, 4).join('、')}` : '0 處'
);

// H37-b：CSS 層的 `font-size` 也必須落在匯出階梯上。
// 這一條是 H33 的 CSS 對應物：H33 掃 `text-[Npx]`（Tailwind），
// 而 `.sheet-skill-desc` 的 `font-size: 7px` 一直在牆外。
const cssFontDecls = [];
for (const abs of walkCss(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(CSS_FONT_DECL)) {
    if (!sheetScaleVals.has(`${m[1]}px`)) cssFontDecls.push(`${rel}:${m[1]}px`);
  }
}
check(
  'H37-b CSS 層 font-size 落在匯出字級階梯上',
  cssFontDecls.length === 0,
  cssFontDecls.length ? `${cssFontDecls.length} 處階梯外：${cssFontDecls.join('、')}` : '0 處階梯外'
);

// H37-c：行內圓角只有兩個答案——`2px`（方）與 `50%`（圓）。
//
// `H34-d` 已經守住了 `.css` 的 `border-radius`，但 `style={{ borderRadius: '3px' }}`
// 兩邊都不在它的視野裡：它不是類別，也不在 `.css` 檔。
// 匯出頁那一處 3px 就是這樣活下來的——同一個檔案裡另外兩處寫的是 2px，
// 所以它不是「另一套設計」，是**沒有人看得到的一致性缺口**。
const inlineRadiusHits = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(/borderRadius:\s*'([^']+)'/g)) {
    if (!/^(2px|50%|0)$/.test(m[1])) inlineRadiusHits.push(`${rel}:${m[1]}`);
  }
}
check(
  'H37-c 行內圓角只有 2px／50%／0（逐項）',
  inlineRadiusHits.length === 0,
  inlineRadiusHits.length ? `${inlineRadiusHits.length} 處：${inlineRadiusHits.join('、')}` : '0 處'
);

// H37-d：`var(--x)` 必須有定義。
//
// 這一條抓的是第三十八輪**自己留下來的**傷：那一輪刪掉 `[data-theme]` 兩組變數時，
// 連 `--accent: #a63d40` 一起帶走了，而 `index.css` 的焦點外框寫的是
// `var(--accent, #a63d40)`。fallback 的值剛好一樣，所以**畫面一 px 都沒變**，
// 也就沒有人發現它已經是一句空話。
//
// > 壞掉的東西長得跟好的一模一樣，是「宣告了卻不會發生」最難抓的一種。
//
// 定義可以來自 `.css`（`--x: …`）或行內樣式物件（`'--x': …`），兩邊都算。
//
// `--tw-*` 是 Tailwind 自己的命名空間（`--tw-gradient-stops` 之類），
// 由框架在執行時注入，不該由我們定義——這一族是唯一豁免。
const varRefs = [];
const varDefs = new Set();
for (const abs of walkAllSyntax(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(/var\(\s*--([a-z0-9-]+)/g)) {
    if (!m[1].startsWith('tw-')) varRefs.push({ rel, name: m[1] });
  }
  for (const m of src.matchAll(/['"]?--([a-z0-9-]+)['"]?\s*:/g)) varDefs.add(m[1]);
}
const deadVarRefs = varRefs.filter((r) => !varDefs.has(r.name));
check(
  'H37-d 每個 var(--x) 都有定義（CSS 或行內樣式物件）',
  deadVarRefs.length === 0,
  deadVarRefs.length
    ? `${deadVarRefs.length} 處空引用：${deadVarRefs.slice(0, 4).map((r) => `${r.rel}→--${r.name}`).join('、')}`
    : `${varRefs.length} 處引用／${varDefs.size} 個定義，全部對得上`
);

/* ────────────────────────────────────────────────────────────────
   H38 家族：一張紙，兩種光（第四十輪 §CI48）
   ────────────────────────────────────────────────────────────────

   這一族要守的不是「有沒有用到冷色」，而是**冷色有沒有把對比弄壞**。

   背景：原本 `warm` 五階、`cool` 五階是**各自挑的**，而冷區每一階都比暖區
   暗 5.8–8.0%。後果是同一組墨在兩區的對比不一樣——`ink-2` 在暖區第 1 階是
   4.72:1（過 AA），在冷區第 1 階是 4.46:1（不過）。也就是說「把畫面換成冷區」
   會讓二級墨掉出合規範圍，而那不是顏色的錯，是**兩條階梯的明度沒有對齊**。

   修法不是把冷色調亮，是把冷區**從暖區的亮度反推**：先量暖區六階的相對亮度，
   再挑同亮度、不同色相的藍灰。實測最大偏差 0.726%。

   於是「紙只有一種」這句話升級成：**紙只有一種，光有兩種。**
   —— 紙的亮度結構是同一條，溫度才是變數。這就是「冷暖分層」的本體。

   下面五條：
     H38   兩區同階等亮（每階 ≤1%）——這是「同一個墨在兩區對比一樣」的充分條件
     H38-a 兩區都是嚴格遞減的六階（單調性）——階梯不能有回頭路
     H38-b 兩區鍵名集合相同（集合相等）——只加一階等於偷偷拆掉對齊
     H38-c 冷區（戰鬥模組）的面不得出現暖紙 hex 或 `warm-*` 令牌（硬零）
     H38-d 反向控制：暖區（書本外框）不得出現 `cool-*` 令牌（硬零）
   ──────────────────────────────────────────────────────────────── */
const ZONE_STEPS = ['card', 'page', 'panel-2', 'panel', 'shade', 'line'];

// H38：同階等亮。門檻 1% 不是隨手訂的——四階墨在兩區的對比差最大只有 0.064，
// 換算回亮度就是 1% 以內。放寬到 3% 的話 `ink-2` 會開始在某一區掉到 4.5 以下。
//
// 迴圈跑的是**暖區的鍵**，不是寫死的清單：暖區是正本，冷區是它的另一種光。
// 冷區多出來的鍵 H38 不管（那是 H38-b 的事），冷區缺的鍵 H38 也不管
// （同樣是 H38-b 的事）——**一條護欄只回答一個問題**，
// 這樣破壞的時候才知道紅的是哪一個。
const parityBad = [];
let parityMax = 0;
for (const step of Object.keys(TW.warm)) {
  if (TW.cool[step] === undefined) continue;
  const w = luminance(TW.warm[step]);
  const c = luminance(TW.cool[step]);
  const dev = (Math.abs(w - c) / w) * 100;
  parityMax = Math.max(parityMax, dev);
  if (dev > 1) parityBad.push(`${step} ${dev.toFixed(2)}%`);
}
check(
  'H38 冷暖同階等亮（每階相對亮度差 ≤1%）',
  parityBad.length === 0,
  parityBad.length
    ? `${parityBad.length} 階超標：${parityBad.join('、')}`
    : `${Object.keys(TW.warm).length} 階最大偏差 ${parityMax.toFixed(3)}%`
);

// H38-a：兩區都必須是嚴格遞減。
// 這一條抓的是「為了修某個畫面的對比，單獨把某一階調深」——
// 那樣改完畫面會好，但階梯會出現一段回頭路，而下一個人在那段路上做的判斷會是錯的。
const ladderBad = [];
for (const zone of ['warm', 'cool']) {
  for (let i = 1; i < ZONE_STEPS.length; i += 1) {
    const prev = luminance(TW[zone][ZONE_STEPS[i - 1]]);
    const cur = luminance(TW[zone][ZONE_STEPS[i]]);
    if (!(cur < prev)) ladderBad.push(`${zone}.${ZONE_STEPS[i]}（${prev.toFixed(3)} → ${cur.toFixed(3)}）`);
  }
}
check(
  'H38-a 冷暖兩區都是嚴格遞減的六階（單調性）',
  ladderBad.length === 0,
  ladderBad.length ? `${ladderBad.length} 處不遞減：${ladderBad.join('、')}` : '兩區各 5 個下降段，全部遞減'
);

// H38-b：兩區的鍵名集合必須完全相同。
// 只在一區加一階，等於讓另一區「沒有那一階可以對齊」——
// 而 H38 是用同名對同名比對的，少一個鍵它就不會發現，只會靜靜少測一階。
const warmKeys = Object.keys(TW.warm).sort().join(',');
const coolKeys = Object.keys(TW.cool).sort().join(',');
check(
  'H38-b 冷暖兩區鍵名集合相同（集合相等）',
  warmKeys === coolKeys && Object.keys(TW.warm).length === ZONE_STEPS.length,
  warmKeys === coolKeys
    ? `${Object.keys(TW.warm).length} 階：${Object.keys(TW.warm).join('／')}`
    : `暖 ${warmKeys} ≠ 冷 ${coolKeys}`
);

// H38-c：冷區不得出現暖紙。
//
// 只掃**面**（bg／border／ring／divide／from／via／to），不掃文字：
// 墨是兩區共用的一條階梯（`#2c221e`／`#3c2415`／`#6b5a4b`／`#7c6a58`），
// 冷區的文字仍然是書墨——這是刻意的，不是漏掉。把墨也一起換掉，
// 「冷暖」就會變成「同時換底色與字色」兩件事，一次改一件。
const WARM_PAPER = new Set(Object.values(TW.warm).map((h) => h.toLowerCase()));
const COMBAT_DIR = path.join(ROOT, 'src/features/combat-tracker');
const SURFACE_POS = '(bg|border|ring|divide|from|via|to)';
const combatStray = [];
let combatSurfaces = 0;
for (const abs of walkSrc(COMBAT_DIR)) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of src.matchAll(new RegExp(`${SURFACE_POS}-\\[(#[0-9a-fA-F]{6})\\](\\/[0-9]+)?`, 'g'))) {
    if (WARM_PAPER.has(m[2].toLowerCase())) combatStray.push(`${rel} → ${m[1]}-[${m[2]}]`);
  }
  for (const m of src.matchAll(new RegExp(`${SURFACE_POS}-warm-[a-z0-9-]+`, 'g'))) {
    combatStray.push(`${rel} → ${m[0]}`);
  }
  combatSurfaces += (src.match(new RegExp(`${SURFACE_POS}-cool-[a-z0-9-]+`, 'g')) || []).length;
}
check(
  'H38-c 冷區的面不得出現暖紙 hex 或 warm-* 令牌（硬零）',
  combatStray.length === 0 && combatSurfaces > 0,
  combatStray.length
    ? `${combatStray.length} 處：${combatStray.slice(0, 4).join('、')}`
    : `0 處暖紙／${combatSurfaces} 個冷區面令牌`
);

// H38-d：反向控制。暖區（書本外框）不得出現冷區令牌。
//
// 沒有這一條，H38-c 可以被「兩區都用冷色」滿足——那時冷區確實沒有暖紙，
// 但暖區也不暖了，而 H38-c 會是綠的。反向控制的作用是**讓「兩邊都改」不能過關**。
const WARM_ZONE_FILES = [
  'src/App.jsx',
  'src/components/book/BookCoverHub.jsx',
  'src/components/book/ChapterHeader.jsx',
  'src/components/book/chapterChrome.js',
];
const warmZoneStray = [];
for (const rel of WARM_ZONE_FILES) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  for (const m of src.matchAll(new RegExp(`${SURFACE_POS}-cool-[a-z0-9-]+`, 'g'))) {
    warmZoneStray.push(`${rel} → ${m[0]}`);
  }
}
check(
  'H38-d 反向控制：暖區不得出現 cool-* 面令牌（硬零）',
  warmZoneStray.length === 0,
  warmZoneStray.length ? `${warmZoneStray.length} 處：${warmZoneStray.slice(0, 4).join('、')}` : `${WARM_ZONE_FILES.length} 個暖區檔，0 處冷色`
);

/* ────────────────────────────────────────────────────────────────
   H39 家族：寫了名字，但那個名字不存在（第四十一輪 §CI49）
   ────────────────────────────────────────────────────────────────

   起點是一個具體的 bug：`CombatantCard.jsx` 用 `sat-hiber` 表示「已行動」，
   註解寫著「v5 改為去飽和，這是 v5 最重要的狀態語言之一」——而全站
   **沒有任何一條 CSS 定義它**。它不是「效果很弱」，它是**什麼都沒發生**。

   而它比「什麼都沒發生」更糟：`cardState` 是唯一提供邊框色的地方，
   於是不存在的分支會讓邊框掉回 Tailwind 的預設色 `#e5e7eb`——
   一個不屬於冷暖兩條階梯的第三種面；而「危機＋已行動」的紅框整個消失。

   ## 為什麼這需要護欄，而不是「記得就好」

   這類東西的共同點是「**在原始碼裡看起來像一個決定**」：
   不報錯、不影響建置、畫面照樣渲染，只是靜靜地什麼都不做。
   它已經在這個專案發生過七次（`scale-98`／`theme.accentSoft || …`／
   `bg-paper`／`--accent`／`s7`／`warm-panel-2`／`sat-hiber`），
   而**每一次的形狀都不同**——所以不能靠「記住那幾個名字」。

   ## 形狀：為什麼是「編譯」而不是「掃字串」

   前面的護欄都是讀原始碼。這一條不行，因為問題不是「字串寫錯了」，
   而是「這個字串在 Tailwind 裡不存在」——只有 Tailwind 自己能回答。
   所以它現編一份 CSS（content 就是 `src` 底下所有 `.js`／`.jsx`），
   再用同一份編譯結果反解出「這份 CSS 定義了哪些名字」。

   代價是這一條要跑 ~2 秒（其他護欄都是毫秒級）。值得：
   它是全套護欄裡唯一一條**不可能被寫死的字串騙過**的。

   ## 兩個形狀一起用

   - `H39`（硬零）：出現一個**沒登記**的死亡名字就紅。
     擋的是「發明一個新名字」——例如下一個人再寫一次 `sat-hiber`。
   - `H39-a`（清單不得腐爛）：名單上的名字若已經不在畫面上了，也紅。
     擋的是「修好了卻沒把名字拿掉」——否則這份名單三年後會變成一份
     誰也不敢動的化石，而它宣稱的東西早就不是真的。
   - `H39-b`（預算 0，只減不增）：擋的是「在已登記的名字上繼續加」。
     第四十二輪把 264 處全部收乾淨，所以預算是 0——這一條從「預算」變成了硬零。
     沒有它，`shadow-xs` 可以從 54 處長到 154 處，而 `H39` 是綠的。

   ⚠️ 這三條的分工刻意做成「一條只回答一個問題」：
   破壞的時候才知道紅的是哪一個。把它們併成一條會讓失敗訊息變成
   「死 class 有問題」，而那句話不能告訴你該做什麼。
   ──────────────────────────────────────────────────────────────── */

/* 已知的死亡名字（第四十一輪普查結果，**第四十二輪已全部歸零**）。
 *
 * 這份名單現在是空的，而它必須一直是空的——預算 0。
 * 留下註解是為了記住那 264 處長什麼樣：全部是同一件事的兩種寫法。
 *
 *   Tailwind v4 的命名   → 這個專案是 v3.4.19
 *     shadow-2xs / shadow-xs / hover:shadow-2xs   陰影階梯在 v4 被重命名
 *     drop-shadow-xs / drop-shadow-2xs           同上
 *     backdrop-blur-xs                           v3 叫 backdrop-blur-sm
 *     sm:w-18 / sm:h-18                          v4 才有動態間距尺度
 *     focus:outline-hidden                       v4 改名（v3 叫 outline-none）
 *
 *   tailwindcss-animate 外掛（**從未安裝**，`plugins: []`）
 *     animate-in / fade-in / zoom-in-95
 *     slide-in-from-top-2 / -top-4 / -top-5 / -left-2 / -bottom / -bottom-2
 *
 * 兩者的共同點：它們在 shadcn 的文件裡都是正確寫法。抄過來的時候
 * 專案的 Tailwind 版本不一樣、外掛沒裝——而**抄過來的東西不會報錯**。
 *
 * 第四十二輪的對映表（每一條都寫在 `scratch/ui-audit/r42_migrate.cjs` 的檔頭）：
 * 陰影 → `shadow-e1`（元素已有框＋底的一律刪除）、`drop-shadow-*` → `drop-shadow-sm`、
 * `backdrop-blur-xs` → `backdrop-blur-sm`、`sm:*-18` → `sm:*-[4.5rem]`、
 * `focus:outline-hidden` → `focus:outline-none`、`animate-in`＋`fade-in` → `animate-fade-in`、
 * `zoom-in-95` → `animate-modal-pop`、`slide-in-from-*` → 移除（v3 無對應令牌）。 */
const DEAD_CLASS_KNOWN = new Map([]);
const DEAD_CLASS_BUDGET = 0;

const classAudit = auditDeadClasses(ROOT);

// H39：沒登記的死亡名字（硬零）。
const unknownDead = [...classAudit.byToken.entries()]
  .filter(([tok]) => !DEAD_CLASS_KNOWN.has(tok))
  .map(([tok, list]) => `${tok}(${list.length} 處 ${list[0].rel}:${list[0].line})`);
check(
  'H39 未登記的死 class（硬零）——寫了名字，但 Tailwind 編不出它',
  unknownDead.length === 0,
  unknownDead.length
    ? `${unknownDead.length} 個新名字：${unknownDead.slice(0, 4).join('、')}`
    : `${classAudit.defined.size} 個 class 名全數存在（掃 ${classAudit.checked} 個 token）`
);

// H39-a：名單不得腐爛。
const staleDeadNames = [...DEAD_CLASS_KNOWN.keys()].filter((tok) => !classAudit.byToken.has(tok));
check(
  'H39-a 已修好的名字要從清單拿掉（清單不得腐爛）',
  staleDeadNames.length === 0,
  staleDeadNames.length
    ? `${staleDeadNames.length} 個已不存在：${staleDeadNames.join('、')}——請同步刪除並下調預算`
    : `${DEAD_CLASS_KNOWN.size} 個登記的名字全部仍在畫面上（目前為空，這是對的）`
);

// H39-b：總數只減不增。
const deadDelta = classAudit.dead.length - DEAD_CLASS_BUDGET;
check(
  'H39-b 死 class 總數只減不增（預算 0）',
  deadDelta <= 0,
  deadDelta > 0
    ? `超出 ${deadDelta} 處（${classAudit.dead.length}／${DEAD_CLASS_BUDGET}）`
    : `${classAudit.dead.length}／${DEAD_CLASS_BUDGET}${deadDelta < 0 ? `（已減 ${-deadDelta}，請下調預算）` : ''}`
);

/* ────────────────────────────────────────────────────────────────
   H40 家族：class 合併器也會刪 class（2026-10-25 第四十三輪 §CI51）
   ────────────────────────────────────────────────────────────────

   背景：GM 貼了一張截圖——深紅底的「跑團面板」按鈕上，字是**深墨色**，整個讀不到。

   `JRPGButton` 的 `primary` 變體寫著 `text-[#fffdf9]`，那一行沒有錯。
   錯的是它後面那個 `text-t12`：`tailwind-merge` 只認識 Tailwind **內建**的
   字級階梯，專案自訂的 `text-tNN` 它不認得，於是歸類成**文字顏色**。
   而它的規則是「同一組只留最後一個」——

     twMerge('text-[#fffdf9] text-t12')  →  'text-t12'   ← 顏色不是被覆蓋，是消失

   量到的後果：58 顆按鈕的顏色全部被自己的字級吃掉。36 顆 `primary`
   （深底淺字）因此變成深底深字；另外 22 顆是淺底深字，繼承來的墨色剛好對，
   所以**同一個 bug 在四分之三的按鈕上看不出來**。`JRPGBadge` 的
   `rank-top`（`#2c221e` 底）更徹底——字與底同色，整塊只剩一個深色方塊。

   ⚠️ 這跟 H39 是**兩個不同的問題**，所以是兩條護欄：
      H39 問「這個 class 名存在嗎」；
      H40 問「這個 class 名還留著嗎」。
   中間隔著一個會主動刪東西的函式，而它不在任何既有護欄的視野裡。
   ──────────────────────────────────────────────────────────────── */

// H40：全站只准 `src/utils/cn.js` 匯入 tailwind-merge（硬零）。
// 繞過它 = 繞過那份字級登記表 = 同一個 bug 從另一個檔案長回來。
const MERGE_OWNER = 'src/utils/cn.js';
const mergeImporters = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (rel === MERGE_OWNER) continue;
  if (/from\s+['"]tailwind-merge['"]/.test(stripComments(fs.readFileSync(abs, 'utf8')))) {
    mergeImporters.push(rel);
  }
}
check(
  'H40 tailwind-merge 只准從 src/utils/cn.js 匯入（合併設定不得被繞過）',
  mergeImporters.length === 0,
  mergeImporters.length
    ? `${mergeImporters.length} 個檔案直接匯入：${mergeImporters.join('、')}——請改用 cn()`
    : '0 個（全部走 cn()）'
);

// H40-a：真的跑一次合併器，確認顏色與字級**同時**活下來。
// 順序刻意照元件的寫法（變體在前、字級在後）——那是會出事的那個順序。
const MERGE_CASES = [
  ['primary 深紅底＋淺字', 'bg-[#a63d40] text-[#fffdf9]', 'text-t12', 'text-[#fffdf9]'],
  ['rank-top 墨底＋淺字', 'bg-[#2c221e] text-[#e8dcc4]', 'text-t10', 'text-[#e8dcc4]'],
  ['rank-mid 褐底＋淺字', 'bg-[#7c6a58] text-[#fbf7ee]', 'text-t10', 'text-[#fbf7ee]'],
];
const mergeFailures = [];
for (const [name, variant, size, color] of MERGE_CASES) {
  const out = cn(variant, size);
  const lostColor = !out.includes(color);
  const lostSize = !out.includes(size);
  if (lostColor || lostSize) {
    mergeFailures.push(`${name}：${lostColor ? `顏色 ${color} 消失` : ''}${lostSize ? ` 字級 ${size} 消失` : ''}`.trim());
  }
}
check(
  'H40-a 合併後顏色與字級都要留著（深底淺字不得被自己的字級吃掉）',
  mergeFailures.length === 0,
  mergeFailures.length ? mergeFailures.join('；') : `${MERGE_CASES.length} 組全部保留`
);

// H40-b：cn.js 登記的字級令牌必須與 tailwind.config 的 fontSize **鍵集合相等**。
// 少登記 → 新令牌安靜地回到「顏色」組，同一個 bug 再長一次；
// 多登記 → 設定裡刪掉的階還留在合併器裡，兩份清單開始分家。
const cnMergeSrc = stripComments(read(MERGE_OWNER));
const cnSizes = new Set([...cnMergeSrc.matchAll(/'t\d+'/g)].map((m) => m[0].slice(1, -1)));
const twSizes = Object.keys(twConfig.theme.extend.fontSize);
const sizesMissing = twSizes.filter((k) => !cnSizes.has(k));
const sizesExtra = [...cnSizes].filter((k) => !twSizes.includes(k));
check(
  'H40-b cn.js 登記的字級令牌與 tailwind.config 的 fontSize 鍵集合相等',
  sizesMissing.length === 0 && sizesExtra.length === 0,
  sizesMissing.length || sizesExtra.length
    ? `漏登記：${sizesMissing.join('、') || '無'}｜多登記：${sizesExtra.join('、') || '無'}`
    : `${twSizes.length} 個鍵一一對應（${twSizes.join('／')}）`
);

// H40-c：反向控制——它**仍然會去重**。
// 沒有這一條，最省事的「修法」是把合併器關掉（什麼都留），
// 那樣 H40-a 會綠、H40-b 會綠，而 class 衝突全部回到「誰在 CSS 後面誰贏」。
const dedupColor = cn('text-[#fffdf9]', 'text-[#3c2415]');
check(
  'H40-c 反向控制：同一組仍然只留最後一個（合併器沒有被關掉）',
  dedupColor.trim() === 'text-[#3c2415]',
  dedupColor.trim() === 'text-[#3c2415]'
    ? 'text-[#fffdf9] ＋ text-[#3c2415] → 只剩後者（去重仍生效）'
    : `得到「${dedupColor}」——合併器失去去重能力`
);

/* ────────────────────────────────────────────────────────────────
   H32 家族：NPC 工坊的第二套紙系統（2026-10-24 第三十五輪 §CI43）
   ────────────────────────────────────────────────────────────────

   背景：`workshopThemes.js` 原本是**六套完整顏色系統**（每主題 15 欄位），
   而其中四個身份色與 `characterThemes` 一字不差——同一份身份表被抄了兩份，
   另外附上一份多出來的紙（藍主題的卡片是藍灰紙，周圍工坊是奶油紙）。

   判準沿用 H7：**面不是身份，墨不是身份；身份是 accent。**
   修法不是「把第二套紙收斂」，是**投影**：紙與身份都從 `CHARACTER_THEMES` 取，
   所以兩張表在定義上不可能不同。

   ⚠️ 這裡刻意**不用**「比對字串」的形狀（例如斷言某個 hex 出現幾次）：
   那種護欄只能證明「我上次寫的值還在」，不能證明「兩張表沒有分家」。
   下面四條全部比對**兩個物件的關係**。
   ──────────────────────────────────────────────────────────────── */

const WORKSHOP_THEMES_SRC = 'src/features/npc-workshop/data/workshopThemes.js';
const workshopProjectionSrc = stripComments(read(WORKSHOP_THEMES_SRC));

// H32：投影檔本身零 hex（硬零）。
// 有 hex 就代表有人在裡面「就地改了一個顏色」——那正是漂移的起點。
const workshopHexes = [...new Set(workshopProjectionSrc.match(/#[0-9a-fA-F]{6}\b/g) || [])];
check(
  'H32 NPC 工坊主題表零 hex（紙與身份都來自 characterThemes）',
  workshopHexes.length === 0,
  workshopHexes.length ? `出現 ${workshopHexes.length} 個：${workshopHexes.slice(0, 5).join('、')}` : '0 個（純投影）'
);

// H32-a：六個鍵的身份色與 `CHARACTER_THEMES` 逐項相同（一對一，不是「數量對」）。
const WORKSHOP_IDS = Object.keys(THEMES_WORKSHOP);
const workshopIdentityDrift = WORKSHOP_IDS.filter(
  (id) => !CHARACTER_THEMES[id] || THEMES_WORKSHOP[id].accent !== CHARACTER_THEMES[id].accent || THEMES_WORKSHOP[id].accentDark !== CHARACTER_THEMES[id].accentDark
);
check(
  'H32-a NPC 卡片六個身份色與角色卡逐項相同（不是抄一份）',
  WORKSHOP_IDS.length === 6 && workshopIdentityDrift.length === 0,
  workshopIdentityDrift.length
    ? `${workshopIdentityDrift.join('、')} 分家了`
    : `${WORKSHOP_IDS.length} 個鍵全部對得上`
);

// H32-b：六個紙欄位與 `CHARACTER_THEMES` 相同——**同一本書只有一張紙**。
const WORKSHOP_PAPER_KEYS = ['cardBg', 'sheetBg', 'subpanelBg', 'exportBg', 'border', 'textDark'];
const workshopPaperDrift = [];
for (const id of WORKSHOP_IDS) {
  for (const k of WORKSHOP_PAPER_KEYS) {
    if (THEMES_WORKSHOP[id][k] !== CHARACTER_THEMES[id][k]) workshopPaperDrift.push(`${id}.${k}`);
  }
}
check(
  'H32-b NPC 卡片的紙與角色卡是同一張（面不是身份）',
  workshopPaperDrift.length === 0,
  workshopPaperDrift.length ? `${workshopPaperDrift.length} 處不同：${workshopPaperDrift.slice(0, 4).join('、')}` : `${WORKSHOP_IDS.length}×${WORKSHOP_PAPER_KEYS.length} 欄全部一致`
);

// H32-c：反向控制——六個鍵一個都不能少，而且每個都要有名字。
// 「收斂」最容易發生的意外是把選項也收掉了：畫面上只剩一個色票，功能就消失了。
const workshopMissing = WORKSHOP_IDS.filter((id) => !THEMES_WORKSHOP[id].name || !THEMES_WORKSHOP[id].accent);
check(
  'H32-c 六個卡片風格仍在、且都有名字（反向控制）',
  WORKSHOP_IDS.length === 6 && workshopMissing.length === 0,
  workshopMissing.length ? `缺 ${workshopMissing.join('、')}` : `${WORKSHOP_IDS.length} 個：${WORKSHOP_IDS.map((id) => THEMES_WORKSHOP[id].name).join('／')}`
);

// H32-d：`NPCWorkshop` 讀的每一個欄位都必須被投影出來。
// 少投影一個欄位 → 畫面上一塊 `undefined` 色的空白，而所有顏色護欄都不會紅。
const WORKSHOP_USED_KEYS = ['accent', 'accentDark', 'border', 'subpanelBg', 'textDark', 'sheetBg', 'cardBg', 'exportBg', 'name', 'id'];
const workshopMissingKeys = WORKSHOP_USED_KEYS.filter((k) => THEMES_WORKSHOP[WORKSHOP_IDS[0]][k] === undefined);
check(
  'H32-d 工坊會讀的欄位全部投影出來了（不缺欄位）',
  workshopMissingKeys.length === 0,
  workshopMissingKeys.length ? `缺 ${workshopMissingKeys.join('、')}（會渲染成 undefined 色）` : `${WORKSHOP_USED_KEYS.length} 個欄位齊備`
);

/* ────────────────────────────────────────────────────────────────
   H34 家族：圓角只有一個值、一個名字（2026-10-24 第三十六輪 §CI44）

   這一條的起點是**推翻第一輪自己的裁決**。第一輪把 `xl` 從 12px 夾到 3px，
   然後寫下「不要求全站零 `rounded-xl`，逐檔改名只是製造 diff」——
   於是設定層留著 `md`／`lg`／`xl`／`2xl`／`3xl`／`book` 六個名字，
   而「渲染層不是 2px」這件事被那句「已夾住」安撫了三十五輪。

   實測（CDP，兩個畫面共 344 個元素）：角半徑落在 3px 的 11 個、4px 的 10 個。
   不是「幾乎都是 2px」，是**每十六個元素就有一個的角落比規則圓**。

   判準與第三十五輪的 `workshopThemes` 相同：同一個值有四個名字，
   那不是階梯，是四份可以各自漂移的定義。收斂成一個名字之後，
   `rounded-lg` 在設定層**不存在**——它不會得到 3px，也不會得到 Tailwind 預設的 8px，
   它什麼都不會得到（角落是方的）。錯得看得見，比錯得剛好看起來像設計過容易修。
   ──────────────────────────────────────────────────────────────── */
console.log('\n[H34] 圓角：一個值一個名字');

// H34：退役的圓角名字與任意值，全站硬零（掃形狀，不是掃某個字面值）。
// 注意單邊前綴（`rounded-t-lg`）：只寫 `rounded-(lg|xl)` 會漏掉它們，
// 而第三十六輪實際套用時，單邊的正好有 12 處。
const RETIRED_RADIUS = /rounded(?:-(?:t|b|l|r|tl|tr|bl|br))?-(?:sm|md|lg|xl|2xl|3xl|book|ui)\b|rounded-\[[^\]]+\]/g;
const radiusLeft = [];
for (const abs of walkSrc(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const code = stripComments(fs.readFileSync(abs, 'utf8'));
  for (const m of code.matchAll(RETIRED_RADIUS)) radiusLeft.push(`${rel} → ${m[0]}`);
}
check(
  'H34 全站零退役圓角名字與任意值（只剩 rounded／rounded-full）',
  radiusLeft.length === 0,
  radiusLeft.length ? `${radiusLeft.length} 處：${radiusLeft.slice(0, 3).join('、')}` : '0 處'
);

// H34-a：設定層只有兩個鍵，而且沒有兩個鍵同值（一對一）。
// 這條擋的是「再加一個 lg: '2px'」——值對、名字多一個，仍然是一份可以漂移的第二定義。
const radiusBlock = (() => {
  const i = tailwind.indexOf('borderRadius:');
  if (i === -1) return '';
  let depth = 0;
  let started = false;
  for (let j = i; j < tailwind.length; j += 1) {
    if (tailwind[j] === '{') { depth += 1; started = true; }
    else if (tailwind[j] === '}') { depth -= 1; if (started && depth === 0) return tailwind.slice(i, j + 1); }
  }
  return '';
})();
const radiusEntries = [...radiusBlock.matchAll(/^\s*'?([A-Za-z0-9-]+)'?:\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]);
check(
  'H34-a 圓角設定層恰好兩個鍵（DEFAULT／full）',
  radiusEntries.length === 2,
  radiusEntries.length ? radiusEntries.map(([k, v]) => `${k}=${v}`).join('／') : '找不到 borderRadius 區塊'
);
const radiusValues = radiusEntries.map(([, v]) => v);
check(
  'H34-a2 沒有兩個鍵指向同一個值（一個值一個名字）',
  new Set(radiusValues).size === radiusValues.length,
  radiusValues.join('／')
);

// H34-b：上限。任何 px 值都必須 ≤ 2；`full` 是唯一的例外（全圓不是角半徑）。
const radiusOver = radiusEntries.filter(([k, v]) => k !== 'full' && /px$/.test(v) && parseFloat(v) > 2);
check(
  'H34-b 圓角上限 2px（full 是全圓，不在此限）',
  radiusOver.length === 0,
  radiusOver.length ? radiusOver.map(([k, v]) => `${k}=${v}`).join('、') : '全部 ≤ 2px'
);

// H34-c：反向控制——全圓還在，預設圓角還在。
// 沒有這一條，「把 rounded-full 全部改成 rounded」也會讓 H34 綠燈（角落全方），
// 而畫面上每一個圓形頭像、狀態點、膠囊晶片都會變成方塊。
//
// ⚠️ 門檻是**當下實測值**，不是「差不多就好」。
// 第一版寫 `>= 90`（實測 98），刻意留了 8 的餘裕——結果故意破壞第 ⑧ 案
// 「把一個檔案的 rounded-full 全部改成 rounded」只掉了 15 個中的一部分，
// 總數 98 → 83，**沒過門檻也沒紅**。反向控制的餘裕就是它的盲區。
// 現在兩條都是 `>= 當下值`：只能增，不能減；要減就必須來改這個數字（也就是做一次決定）。
//
// 2026-10-30（P5-a）做了一次這樣的決定：98 → 95。
// 四條資源條收斂進 `GaugeBar` 之後，面板裡的 8 處（4 條 × 外框＋內層）變成元件裡的 3 處。
// **渲染出來的圓角元素其實變多了**（4 條 × 3 層＝12，原本 4 條 × 2 層＝8）——
// 這正是文字掃描的盲區：它數的是原始碼裡的出現次數，不是畫面上的元素。
// 所以這裡放寬 3，交換的是同一支檔案裡「資源條逐條點名 testId」那條更強的守衛。
const allSrcRadius = walkSrc(path.join(ROOT, 'src'))
  .map((abs) => stripComments(fs.readFileSync(abs, 'utf8')))
  .join('\n');
const fullRoundUses = (allSrcRadius.match(/\brounded-full\b/g) || []).length;
const bareRoundUses = (allSrcRadius.match(/\brounded\b(?!-)/g) || []).length;
check(
  'H34-c 全圓仍在服役（反向控制，不得減少）',
  fullRoundUses >= 95,
  `${fullRoundUses} 處（收斂前 98；P5-a 資源條收斂後地板 95）`
);
check(
  'H34-c2 預設圓角仍是全站主體（反向控制，不得減少）',
  bareRoundUses >= 1380,
  `${bareRoundUses} 處`
);

// H34-d：CSS 層也不准有別的角半徑。`inherit`（focus 外框跟著宿主）與
// `var(--r)`（`.ui-panel`、捲軸）是引用不是宣告，另外 `--r` 本身必須是 2px。
const cssRadiusDecls = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
const cssRadiusBad = cssRadiusDecls.filter((v) => !/^(inherit|var\(--r\)|0|2px)$/.test(v));
check(
  'H34-d CSS 層沒有第二種角半徑（inherit／var(--r)／2px）',
  cssRadiusBad.length === 0,
  cssRadiusBad.length ? cssRadiusBad.join('、') : `${cssRadiusDecls.length} 處宣告，全部合格`
);
const rVars = [...css.matchAll(/--r:\s*([^;]+);/g)].map((m) => m[1].trim());
check(
  'H34-d2 --r 是 2px（CSS 層的唯一來源）',
  rVars.length > 0 && rVars.every((v) => v === '2px'),
  rVars.join('／')
);

// ═══════════════════════════════════════════════════════════════════
// H35 家族：主題表是唯一來源（第三十七輪 §CI45）
// ═══════════════════════════════════════════════════════════════════

/**
 * ## 這一組在擋什麼
 *
 * 全站有三張主題表：角色主題（`CHARACTER_THEMES`，6 色）、書頁外框（`BOOK_CHROME`）、
 * 翻頁遮罩（`OVERLAY_PAPER`）。它們的用途是「一個欄位只有一個答案」。
 *
 * 第三十七輪量到三種把答案藏起來的寫法：
 *
 * | 寫法 | 站點 | 為什麼是病 |
 * |---|---|---|
 * | `theme.accent \|\| '#a63d40'` | 248 | `accent` 從來沒缺席，hex 一次都沒被取用；而它讓「改欄位名」變成靜默換色 |
 * | `theme.accentSoft \|\| theme.subpanelBg` | 10 | `accentSoft` 這欄位**從來不存在**，所以 `\|\|` 的右邊就是真正的值 |
 * | `theme.buttonVariant \|\| 'primary'` | 33 | 欄位第十五輪就刪了，讀取留著，於是永遠走右邊 |
 *
 * 共通點：**`||` 的右邊如果一次都沒被取用，它就不是保險，是第二個答案。**
 * 而第二個答案最糟的地方是它看起來很合理——`#a63d40` 是強調紅，`#d6c7ab` 是紙邊，
 * 就算真的觸發了，畫面上也只是「顏色有點不對」，不會有人回報。
 *
 * 更麻煩的是那 248 個 hex 裡有一批是 **v4 化石**：
 * `#c9a227`（金）、`#334155`／`#1e293b`／`#0f172a`（冷墨）、`#888888`（純灰）、
 * `#76252d`（硃砂紅的 hover 值，卻被當成 accentDark 的保險）。
 * 它們之所以還活著，正是因為**從來沒有被畫出來過**。
 */

/** 甲：任何「屬性存取鏈 || '#hex'」都是第二個答案 */
const HEX_FALLBACK =
  /(?:[A-Za-z_$][\w$]*(?:\s*\??\.[A-Za-z_$][\w$]*)+)\s*(?:\|\||\?\?)\s*(['"])(#[0-9a-fA-F]{3,8})\1/g;
const hexFallbackSites = [];
for (const abs of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8'))
    .split('\n')
    .forEach((line, i) => {
      HEX_FALLBACK.lastIndex = 0;
      if (HEX_FALLBACK.test(line)) hexFallbackSites.push(`${rel}:${i + 1}`);
    });
}
check(
  'H35 全站零「屬性 || hex」靜默回退（顏色只能來自命名來源）',
  hexFallbackSites.length === 0,
  hexFallbackSites.length ? hexFallbackSites.slice(0, 8).join('、') + (hexFallbackSites.length > 8 ? ` …共 ${hexFallbackSites.length} 處` : '') : '0 處'
);

/** 乙：三張表的鍵集合。角色主題直接讀模組，另兩張從原始碼解析。 */
const CHARACTER_KEYS = new Set(Object.keys(CHARACTER_THEMES.amber));
const BOOK_KEYS = new Set(Object.keys(BOOK_CHROME));
const overlaySrc = stripComments(read('src/components/book/BookPageFlipOverlay.jsx'));
const OVERLAY_KEYS = new Set(
  [
    ...overlaySrc
      .slice(overlaySrc.indexOf('const OVERLAY_PAPER = {'), overlaySrc.indexOf('const CHAPTER_OVERLAY_THEMES'))
      .matchAll(/^\s{2}([A-Za-z_$][\w$]*):/gm),
  ].map((m) => m[1])
);
const REGISTERED_KEYS = new Set([...CHARACTER_KEYS, ...BOOK_KEYS, ...OVERLAY_KEYS]);

check(
  'H35-a 角色主題六筆的鍵集合完全相同（不是六份各自漂移的定義）',
  new Set(Object.values(CHARACTER_THEMES).map((t) => Object.keys(t).sort().join(','))).size === 1,
  `${new Set(Object.values(CHARACTER_THEMES).map((t) => Object.keys(t).sort().join(','))).size} 種鍵集合／每筆 ${CHARACTER_KEYS.size} 鍵`
);
check(
  'H35-a2 角色主題恰好 17 個鍵（新增或刪除欄位都要先想清楚）',
  CHARACTER_KEYS.size === 17,
  `${CHARACTER_KEYS.size} 鍵`
);

/** 丙：`theme.` 系列的讀取不准出現表上沒有的鍵 */
const THEME_VARS = ['theme', 'currentTheme', 'charTheme', 'customTheme'];
const THEME_READ = new RegExp(`(?<![\\w$.])(${THEME_VARS.join('|')})\\s*\\??\\.\\s*([A-Za-z_$][\\w$]*)`, 'g');
const unknownKeySites = [];
const keyReadCount = new Map();
for (const abs of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  stripComments(fs.readFileSync(abs, 'utf8'))
    .split('\n')
    .forEach((line, i) => {
      THEME_READ.lastIndex = 0;
      let m;
      while ((m = THEME_READ.exec(line))) {
        const key = m[2];
        keyReadCount.set(key, (keyReadCount.get(key) || 0) + 1);
        if (!REGISTERED_KEYS.has(key)) unknownKeySites.push(`${rel}:${i + 1} → ${m[1]}.${key}`);
      }
    });
}
check(
  'H35-b 每個主題鍵的讀取都在登記過的表裡（讀不存在的欄位＝靜默用假值）',
  unknownKeySites.length === 0,
  unknownKeySites.length ? unknownKeySites.slice(0, 6).join('、') : `${keyReadCount.size} 個鍵全部登記過`
);

/** 丁：表上的樣式鍵不准是死欄位。`id`／`name`／`enName` 是內容不是樣式，豁免。 */
const META_KEYS = new Set(['id', 'name', 'enName']);
const deadStyleKeys = [...CHARACTER_KEYS].filter((k) => !META_KEYS.has(k) && !keyReadCount.has(k));
check(
  'H35-c 角色主題沒有死欄位（樣式鍵每一個都有人讀）',
  deadStyleKeys.length === 0,
  deadStyleKeys.length ? deadStyleKeys.join('、') : `${CHARACTER_KEYS.size - META_KEYS.size} 個樣式鍵全部在服役`
);

/** 戊：反向控制——六個身份色兩兩相異，且未知 id 落回 amber。 */
const accentSet = new Set(Object.values(CHARACTER_THEMES).map((t) => t.accent));
check(
  'H35-d 六個主題的身份色兩兩相異（反向控制：身份是離散的封閉集合）',
  accentSet.size === 6,
  `${accentSet.size} 個相異 accent／6 個主題`
);
check(
  'H35-d2 未知主題 id 落回 amber（不是拋錯、也不是空值）',
  getCharacterTheme('__nope__').id === 'amber' && getCharacterTheme(undefined).id === 'amber',
  `__nope__ → ${getCharacterTheme('__nope__').id}／undefined → ${getCharacterTheme(undefined).id}`
);

/** 己：F-007 的 live region 還在（P12 轉測試，2026-10-26）。
 *
 *  為什麼放這裡而不是 `test:ui`：這一條驗的是**原始碼的結構**，不是渲染結果。
 *  `test:ui` 走 SSR，而 live region 的重點「容器必須常駐」在 SSR 快照裡看不出來
 *  ——空的時候它 `sr-only` 但仍然在 DOM 裡，跟「條件渲染不存在」在 HTML 上長得一樣
 *  （都是看不到），所以只能讀原始碼。
 *
 *  這一條原本沒有任何護欄（P12 盤點時發現 F-007 在 tests/ 出現 0 次）。
 *  沒有護欄的「已修」等於「下次有人重寫這個 Toast 就會安靜退回原狀」——
 *  而它退化時**畫面完全正常**，只有讀屏使用者受影響。 */
{
  const sheetSrc = stripComments(read('src/features/character-sheet/CharacterSheet.jsx'));

  // ① 有 live region，而且 role 與 aria-live 都在
  const liveRegions = sheetSrc.match(/role="status"/g) || [];
  check(
    'F-007 創角介面有 role="status" 的 live region',
    liveRegions.length === 1,
    `找到 ${liveRegions.length} 個（應為 1）`
  );
  check(
    'F-007 live region 同時帶 aria-live="polite"',
    /role="status"[\s\S]{0,120}?aria-live="polite"/.test(sheetSrc),
    'role="status" 與 aria-live="polite" 必須在同一個元素上'
  );

  // ② 容器常駐：無訊息時是 `sr-only`，不是從 DOM 移除。
  //    判準是 className 三元式裡有 `sr-only` 分支——這正是「先存在、後播報」的寫法。
  const alwaysMounted = /toastMessage[\s\S]{0,40}?\?[\s\S]{0,600}?sr-only/.test(sheetSrc);
  check(
    'F-007 live region 容器常駐（無訊息時 sr-only，不是條件渲染）',
    alwaysMounted,
    alwaysMounted
      ? '有訊息顯示、無訊息 sr-only'
      : '找不到「有訊息顯示、無訊息 sr-only」的三元式——容器可能被條件渲染掉了'
  );

  // ③ 反向控制：條件渲染整個 live region 是這個缺陷的原始樣子。
  //    `{cond && <div role="status"` 這種寫法要抓出來。
  const conditionallyRendered = /\{[\s\S]{0,60}?&&\s*\(\s*<div[^>]*role="status"/.test(sheetSrc);
  check(
    'F-007 live region 沒有被條件渲染（反向控制）',
    !conditionallyRendered,
    conditionallyRendered
      ? '發現 `{cond && <div role="status">}`——容器不常駐，播報不會觸發'
      : '沒有條件渲染的寫法'
  );
}

// ═══════════════════════════════════════════════════════════
// H40. F-008（2026-10-27）：章節狀態只能有一份，「開發中」不能寫在兩個地方
//
// 這條缺陷的病根不是文案難聽，是**同一件事被寫在兩處**：
// 封面寫 `statusLabel: '開發中'`，App 寫 `chapterId !== 'workshop'` 決定要不要攔。
// 兩處各自漂移之後，做完四輪測試、結論寫著「能上桌」的角色卡助手，
// 在封面被標成開發中，而且每次進站都被攔一次、被告知「未完善使用」。
//
// 這種事在畫面上「只是有點保守」，不會報錯、不會建置失敗——所以要有東西在它漂移時叫。
console.log(`\n=== H40. F-008：章節狀態的單一來源 ===`);

check(
  '角色卡助手不再被當成施工中（它已經可以上桌）',
  needsDevWarning('character') === false,
  `needsDevWarning('character') → ${needsDevWarning('character')}`
);
check('NPC工坊是完整功能，不攔', needsDevWarning('workshop') === false);
check('戰鬥輪次仍在施工，要攔', needsDevWarning('combat') === true);
check('命刻記錄仍在施工，要攔', needsDevWarning('clocks') === true);
// 沒登記的章節一律當成施工中——寧可多攔一次，也不要讓半成品看起來像完成品。
check('沒有登記的章節預設「施工中」（安全方向的預設）',
  needsDevWarning('brand-new-chapter') === true && chapterStatusOf('brand-new-chapter') === 'wip');
check('四個章節都登記了狀態（新增章節不能靠預設值蒙混）',
  ['character', 'workshop', 'combat', 'clocks'].every((id) => Boolean(CHAPTER_STATUS[id])),
  `已登記：${Object.keys(CHAPTER_STATUS).join('、')}`);
check('狀態標籤也只有一份（三種狀態各一個字）',
  Object.values(CHAPTER_STATUS_LABEL).length === 3,
  `實際 ${Object.values(CHAPTER_STATUS_LABEL).length} 個`);

const coverSrcF8 = stripComments(read('src/components/book/BookCoverHub.jsx'));
// ※ 這支檔案的 `check(name, ok, detail)` 收的是**布林**，不是 actual/expected。
//   第一版照另一支測試的習慣寫成 `check(..., count(...), 0)`，於是 count=0 被當成 ok=0 → 假紅。
check('封面不再自己寫死狀態標籤（`statusLabel:` 0 處）',
  count(coverSrcF8, 'statusLabel') === 0,
  `實際 ${count(coverSrcF8, 'statusLabel')} 處`);
check('封面改吃 `chapterStatusLabelOf`', coverSrcF8.includes('chapterStatusLabelOf(chap.id)'));
check('封面不再自己判斷「是不是完整功能」',
  !coverSrcF8.includes("chap.status === 'complete'"));

const appSrcF8 = stripComments(read('src/App.jsx'));
check('App 不再用「不是工坊就攔」這種寫法',
  !appSrcF8.includes("chapterId !== 'workshop'"));
check('App 改吃 `needsDevWarning`', appSrcF8.includes('needsDevWarning(chapterId)'));

// 「未完善使用」不是中文詞（應為「尚未完善」）。它出現在最需要信任的第一屏。
const srcFilesF8 = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(e.name)) srcFilesF8.push(p);
  }
})(path.join(ROOT, 'src'));
const badPhraseHits = srcFilesF8
  .filter((f) => stripComments(fs.readFileSync(f, 'utf8')).includes('未完善使用'))
  .map((f) => path.relative(ROOT, f));
check('全站不再出現「未完善使用」這個病句', badPhraseHits.length === 0, badPhraseHits.join('、'));

const devModalSrcF8 = stripComments(read('src/components/book/ChapterDevWarningModal.jsx'));
check('警告框不再宣稱「只有 NPC工坊完整」',
  !devModalSrcF8.includes('僅【NPC工坊】功能已完全完整穩定'));
check('警告框說出角色卡助手可以上桌',
  devModalSrcF8.includes('可以上桌使用'));
check('警告框點名「你正要進入的這一章」（不再泛指其餘章節）',
  devModalSrcF8.includes('你正要進入的'));

const failed = results.filter((r) => !r.ok);console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  失敗項目：`);
  for (const f of failed) console.log(`   - ${f.name}${f.detail ? `  —— ${f.detail}` : ''}`);
  console.log(`\n  這些是設計系統的退化訊號，不是風格偏好。`);
  console.log(`  修法看 docs/ui-review-refactoring-ui.md 的對應規則。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
