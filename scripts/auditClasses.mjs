/**
 * 「寫了 class 名、但編不出任何 CSS」的普查工具。
 *
 * 執行：node scripts/auditClasses.mjs
 *
 * ## 為什麼需要它
 *
 * 第四十一輪（§CI49）在 `CombatantCard.jsx` 找到 `sat-hiber`：一個被註解描述得
 * 很像一回事、全站卻**從未定義**的 class。它不是特例——順手普查之後，
 * 全站有 264 處同樣的東西（Tailwind v4 的寫法跑在 v3 上、以及一個從未安裝的
 * `tailwindcss-animate` 外掛）。
 *
 * 這類東西的共同點是「**在原始碼裡看起來像一個決定**」：
 * 它不會報錯、不會影響建置、畫面上也不會有任何異常——它只是靜靜地什麼都不做。
 * 所以它需要一個會問「這個名字真的存在嗎」的東西。
 *
 * ## 三條判準（每一條都是踩過坑才有的）
 *
 * ① `className=` 的值 → 掃字串字面值（含模板字串的靜態片段）。
 * ② 進到 `${…}` 裡面繼續掃。**這一條不能省**：第一版整段跳過插值，
 *    於是 `className={`… ${cardState}`}` 裡的東西全部隱形。
 * ③ className 裡出現的識別字，若同檔有 `const X =` 就再掃一次它的初始值（一層）。
 *    `sat-hiber` 正是靠這條才被抓到——它是**先被指派給變數、之後才插進 className** 的字串。
 *
 * ## 免責（假陽性的來源，逐一處理過）
 *
 * - **JS 標記**：被 `classList.contains`／`querySelector`／`closest` 查詢的 class
 *   是 DOM 標記，本來就不該有 CSS（`hide-on-export`）。
 *   免責必須是**全域**的：它在 4 個檔被寫進 className，只有 1 個檔會去讀。
 * - **物件字面值的鍵**：`{ "rank-top": "bg-[#2c221e] …" }` 裡 `rank-top` 是 variant 名。
 *   判斷要同時看左右兩邊，而且往前看必須在**去註解**的字串上做。
 * - **CSS 不只住在 index.css**：`custom-scrollbar` 定義在 `NPCWorkshop.jsx` 的
 *   `<style>` 裡。字串同時含 `{` `}` `;` 就當它是一段 CSS。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLASSISH = /^-?[a-z][a-z0-9]*(?:[-:][a-z0-9[\]#%./_-]+)+$/;

/* 被 JS 查詢的標記：不需要 CSS。
 * ⚠️ 實際寫法是 `node?.classList?.contains('x')`，可選鏈會讓字面比對失效。 */
const MARKER = new RegExp(
  [
    String.raw`classList\s*\??\.\s*contains\s*\(\s*['"\x60]([\w-]+)`,
    String.raw`(?:querySelector(?:All)?|closest|getElementsByClassName)\s*\(\s*['"\x60]([\w-]+)`,
  ].join('|'),
  'g'
);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/**
 * 去註解但**保持長度**（本專案的 StripComments 規矩）。
 *
 * 把註解字元換成空白、字串內容不動，於是所有 offset 與原文一一對應——
 * 這樣「往前看前一個有效字元」才不會看到被註解掉的東西。
 * 用佔位符會踩坑：佔位符本身可能在字串裡出現。
 */
function stripComments(src) {
  const out = src.split('');
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { out[i] = ' '; i += 1; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const s = i;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      for (let k = s; k < i && k < n; k += 1) if (src[k] !== '\n') out[k] = ' ';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/** 掃一段區間裡的字串字面值與識別字；模板字串的 `${…}` 會遞迴進去。 */
function scan(src, from, to, depth = 0) {
  const literals = [];
  const idents = [];
  let i = from;
  while (i < to) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < to && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < to && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      let j = i + 1;
      let buf = '';
      while (j < to && src[j] !== q) {
        if (src[j] === '\\') { buf += src[j + 1] ?? ''; j += 2; continue; }
        if (src[j] === '\n') break;
        buf += src[j];
        j += 1;
      }
      literals.push({ text: buf, line: src.slice(0, i).split('\n').length, start: i, end: j });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      let buf = '';
      const line0 = src.slice(0, i).split('\n').length;
      while (j < to && src[j] !== '`') {
        if (src[j] === '\\') { buf += src[j + 1] ?? ''; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          if (buf.trim()) literals.push({ text: buf, line: line0 });
          buf = '';
          let d = 1;
          const start = j + 2;
          j += 2;
          while (j < to && d > 0) {
            if (src[j] === '{') d += 1;
            else if (src[j] === '}') d -= 1;
            j += 1;
          }
          const inner = scan(src, start, j - 1, depth + 1);
          literals.push(...inner.literals);
          idents.push(...inner.idents);
          continue;
        }
        buf += src[j];
        j += 1;
      }
      if (buf.trim()) literals.push({ text: buf, line: line0 });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < to && /[A-Za-z0-9_$]/.test(src[j])) j += 1;
      idents.push(src.slice(i, j));
      i = j;
      continue;
    }
    i += 1;
  }
  return { literals, idents };
}

/** `className=` 的值在原始碼裡的區間。 */
function classNameSpans(src) {
  const spans = [];
  for (const m of src.matchAll(/\bclassName\s*=\s*/g)) {
    let i = m.index + m[0].length;
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j += 1; j += 1; }
      spans.push([i + 1, j]);
      continue;
    }
    if (c === '{') {
      let d = 0; let j = i; let inS = null;
      while (j < src.length) {
        const ch = src[j];
        if (inS) {
          if (ch === '\\') { j += 2; continue; }
          if (ch === inS) inS = null;
          j += 1; continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inS = ch; j += 1; continue; }
        if (ch === '{') d += 1;
        else if (ch === '}') { d -= 1; if (d === 0) break; }
        j += 1;
      }
      spans.push([i + 1, j]);
    }
  }
  return spans;
}

/** `const X = …` 的初始值區間（掃到同層的 `;` 或深度歸零）。 */
function initializerSpan(src, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*=`, 'g');
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  let d = 0; let j = start; let inS = null;
  while (j < src.length) {
    const ch = src[j];
    if (inS) {
      if (ch === '\\') { j += 2; continue; }
      if (ch === inS) inS = null;
      j += 1; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inS = ch; j += 1; continue; }
    if ('([{'.includes(ch)) d += 1;
    else if (')]}'.includes(ch)) { d -= 1; if (d < 0) break; }
    else if (ch === ';' && d === 0) break;
    j += 1;
  }
  return [start, j];
}

/**
 * 現編一份 CSS（content 就是 `src` 自己），回傳它定義了哪些 class 名。
 *
 * 這是唯一的「地面真相」：Tailwind 說它存在才是存在。
 * 從 CSS 反解名字時**字元集不能放 `:`**——`.hover\:bg-x:hover` 會被讀成
 * `hover:bg-x:hover`，所有帶變體的字都會被判成缺失。
 */
export function compiledClassNames(root, outFile) {
  const out = outFile || path.join(root, '.test-build', 'audit-classes.css');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules/tailwindcss/lib/cli.js'),
      '-c', 'tailwind.config.js',
      '-i', 'src/index.css',
      '-o', path.relative(root, out),
      '--content', 'src/**/*.{js,jsx}',
    ],
    { cwd: root, stdio: 'pipe' }
  );
  const css = fs.readFileSync(out, 'utf8');
  const defined = new Set();
  for (const m of css.matchAll(/\.((?:[a-zA-Z0-9_-]|\\.)+)/g)) {
    const name = m[1].replace(/\\(.)/g, '$1');
    if (!name || /^\d/.test(name)) continue;
    defined.add(name);
  }
  return defined;
}

/**
 * 掃出所有 className 內的 token（不判斷對錯）。
 *
 * 回傳 `{ files, tokens, markers }`；`tokens` 的每一項是
 * `{ rel, line, tok, via }`，`via` 記錄它是從哪條規則抓到的
 * （`className`／`var:X`／`classlist`）——出問題時要能說明來源。
 *
 * `defined` 是「編譯後的 class 名集合」。給了它才會啟用第三條來源
 * （物件裡的 class 清單），因為那條需要「這串字裡有多少是真的 class」
 * 才能判斷——沒給就只掃 className，會漏掉一批（實測差 6 處）。
 */
export function collectClassTokens(root, defined = null) {
  const files = walk(path.join(root, 'src'));
  const sources = files.map((f) => ({ file: f, src: fs.readFileSync(f, 'utf8') }));

  const markers = new Set();
  for (const { src } of sources) {
    for (const m of src.matchAll(MARKER)) markers.add(m[1] || m[2]);
  }

  const tokens = [];
  for (const { file, src } of sources) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const clean = stripComments(src);
    const prevSignificant = (i) => {
      let k = i - 1;
      while (k >= 0 && /\s/.test(clean[k])) k -= 1;
      return clean[k] ?? '';
    };
    /* 物件的鍵不是 class。判斷要同時看右邊（`:`）與左邊（`{` 或 `,`），
       而且往左看必須在去註解的字串上做——否則上一行是註解時會判錯。 */
    const isObjectKey = (lit) =>
      lit.end != null &&
      /^\s*:/.test(clean.slice(lit.end + 1, lit.end + 10)) &&
      /[{,]/.test(prevSignificant(lit.start));

    const push = (text, line, via) => {
      for (const tok of text.split(/\s+/)) {
        if (!tok || !CLASSISH.test(tok)) continue;
        tokens.push({ rel, line, tok, via });
      }
    };

    for (const [a, b] of classNameSpans(src)) {
      const { literals, idents } = scan(src, a, b);
      for (const lit of literals) push(lit.text, lit.line, 'className');
      for (const id of new Set(idents)) {
        const span = initializerSpan(src, id);
        if (!span) continue;
        for (const lit of scan(src, span[0], span[1]).literals) {
          if (isObjectKey(lit)) continue;
          push(lit.text, lit.line, `var:${id}`);
        }
      }
    }

    /* 來源 ②：把 class 清單放在物件裡再傳出去的模組（多數決——
       一個字串裡有半數以上是已定義的 class，就當整串都是 class 清單）。
       沒有 `defined` 就不跑：這一條的判準本身就依賴「什麼是真的 class」，
       少了它會把「順便長得像 class 的文案」也收進來。 */
    if (defined) {
      for (const lit of scan(src, 0, src.length).literals) {
        if (isObjectKey(lit)) continue;
        const toks = lit.text.split(/\s+/).filter((t) => CLASSISH.test(t));
        if (toks.length < 2) continue;
        if (toks.filter((t) => defined.has(t)).length / toks.length < 0.5) continue;
        push(lit.text, lit.line, 'classlist');
      }
    }
  }

  return { files: files.length, tokens, markers };
}

/** 把行內 `<style>` 之類的 CSS 也算成「已定義」（只會減少假陽性）。 */
function addInlineCss(root, defined) {
  for (const file of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const lit of scan(src, 0, src.length).literals) {
      const t = lit.text;
      if (!(t.includes('{') && t.includes('}') && t.includes(';'))) continue;
      for (const m of t.matchAll(/\.([a-zA-Z][\w-]*)(?=[\s,:{])/g)) defined.add(m[1]);
    }
  }
}

/**
 * 一次做完：編 CSS → 掃 token → 比對。
 *
 * 回傳 `{ defined, checked, dead, byToken }`，`dead` 已排除 JS 標記。
 */
export function auditDeadClasses(root, outFile) {
  const defined = compiledClassNames(root, outFile);
  addInlineCss(root, defined);
  const { files, tokens, markers } = collectClassTokens(root, defined);

  const dead = [];
  let checked = 0;
  for (const t of tokens) {
    if (markers.has(t.tok)) continue;
    checked += 1;
    if (!defined.has(t.tok)) dead.push(t);
  }

  const byToken = new Map();
  for (const d of dead) {
    if (!byToken.has(d.tok)) byToken.set(d.tok, []);
    byToken.get(d.tok).push(d);
  }

  return { files, defined, markers, checked, dead, byToken };
}

/* ── CLI ── */
if (process.argv[1] && process.argv[1].endsWith('auditClasses.mjs')) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = auditDeadClasses(root);
  console.log(`被 JS 查詢的標記 class（免責）：${[...r.markers].join('、') || '無'}`);
  console.log(`掃描 ${r.files} 個檔，${r.checked} 個 className 內的 token`);
  console.log(`這份 CSS 定義了 ${r.defined.size} 個 class 名`);
  console.log(`\n=== 編不出 CSS 的 token：${r.byToken.size} 種／${r.dead.length} 處 ===\n`);
  for (const [tok, list] of [...r.byToken.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const fs_ = [...new Set(list.map((h) => h.rel))];
    console.log(`${tok.padEnd(26)} ${String(list.length).padStart(3)} 處  ${String(fs_.length).padStart(2)} 檔  ${fs_[0]}`);
  }
}
