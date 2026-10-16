/**
 * 【已執行完畢的歷史腳本 — 保留供追溯與重用】
 *
 * 2026-10-16 用它把 `NPCWorkshop.jsx` 內 8 個元件與 1 份卡片配色表抽出去。
 * 執行結果：6,448 行 → 5,012 行（抽出約 1,436 行）。
 *
 * ※ **不要直接重跑**：那些區塊已經不在主檔裡了，會找不到邊界而拋錯。
 *   保留的理由是「技術本身可重用」——它會自動掃描每個區塊實際用到哪些識別字，
 *   再產生對應的 import，未來拆其他大檔時可以照這個模式改。
 *
 * ※ 這個腳本在開發過程中被自己的護欄抓出三個 bug，值得記住：
 *   1. JSX 的 `React` 在原始碼裡看不到（`<div>` 是標籤不是識別字）→ 漏匯入。
 *      **`npm run build` 不會報錯**（Vite 用 automatic runtime），只有 SSR 測試會抓到。
 *   2. `import React, { … }` 解析時把預設匯入抓成 `'React,'`（尾逗號沒去掉）。
 *   3. `import { Image as ImageIcon }` 的別名要用「別名」判斷有無使用，不是原文。
 *   教訓：自動產生程式碼之後，**一定要有東西真的把它跑起來**，否則錯誤只會靜默存在。
 *
 * 原始目的：把 NPCWorkshop.jsx 內 8 個「本來就獨立、只靠 props 溝通」的元件
 * 與 1 份卡片配色表，抽到獨立檔案；並**自動計算**每個新檔需要哪些 import。
 *
 * 為什麼用腳本而不是手動剪貼：
 * 手動剪貼要人工判斷「這個區塊用了哪些圖示／常數」，漏一個就是執行期
 * ReferenceError，而打包器對「未定義的自由變數」不會報錯。
 * 交給程式掃描，漏掉的機率是 0。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src/features/npc-workshop';
const MAIN = `${ROOT}/NPCWorkshop.jsx`;
const src = fs.readFileSync(MAIN, 'utf8');
const lines = src.split('\n');

// ── 1. 解析原始 import 區塊 ───────────────────────────────────
const importEnd = lines.findIndex((l) => l.trim() === '// --- COMPONENTS ---');
if (importEnd < 0) throw new Error('找不到 // --- COMPONENTS --- 標記');
const importText = lines.slice(0, importEnd).join('\n');

const importRe = /import\s+([\s\S]+?)\s+from\s+['"]([^'"]+)['"];?/g;
const specs = [];
let m;
while ((m = importRe.exec(importText))) {
  const clause = m[1].replace(/\s+/g, ' ').trim();
  const mod = m[2];
  if (clause.startsWith('*')) {
    specs.push({ mod, kind: 'namespace', local: clause.replace(/^\*\s*as\s*/, '').trim() });
  } else {
    const braceIdx = clause.indexOf('{');
    const def = braceIdx >= 0 ? clause.slice(0, braceIdx).replace(/[\s,]+$/, '').trim() : clause.trim();
    const named = braceIdx >= 0
      ? clause.slice(braceIdx + 1, clause.lastIndexOf('}')).split(',').map((s) => s.trim()).filter(Boolean)
        // `Image as ImageIcon`：原始碼裡用的是別名（ImageIcon），
        // 所以「用到沒用到」要用別名判斷，但輸出時要保留 `X as Y`。
        .map((s) => {
          const asMatch = s.match(/^(\S+)\s+as\s+(\S+)$/);
          return asMatch ? { local: asMatch[2], spec: s } : { local: s, spec: s };
        })
      : [];
    specs.push({ mod, kind: 'named', def, named });
  }
}
if (specs.length < 5) throw new Error(`import 解析異常，只抓到 ${specs.length} 條`);

/** 依「實際用到的識別字」重建 import 陳述。 */
const buildImports = (used, { prefix = '../' } = {}) => {
  const out = [];
  const remap = (mod) => {
    if (mod.startsWith('./')) return prefix + mod.slice(2);
    if (mod.startsWith('../')) return prefix + mod.slice(3);
    return mod;
  };
  specs.forEach((s) => {
    if (s.kind === 'namespace') {
      if (used.has(s.local)) out.push(`import * as ${s.local} from '${remap(s.mod)}';`);
      return;
    }
    const keepNamed = s.named.filter((n) => used.has(n.local));
    const keepDef = s.def && used.has(s.def) ? s.def : '';
    if (!keepDef && keepNamed.length === 0) return;
    const parts = [];
    if (keepDef) parts.push(keepDef);
    if (keepNamed.length) parts.push(`{ ${keepNamed.map((n) => n.spec).join(', ')} }`);
    out.push(`import ${parts.join(', ')} from '${remap(s.mod)}';`);
  });
  return out;
};

const usedIn = (text) => {
  const used = new Set();
  specs.forEach((s) => {
    if (s.kind === 'namespace') { if (new RegExp(`\\b${s.local}\\b`).test(text)) used.add(s.local); return; }
    if (s.def && new RegExp(`\\b${s.def}\\b`).test(text)) used.add(s.def);
    s.named.forEach((n) => { if (new RegExp(`\\b${n.local}\\b`).test(text)) used.add(n.local); });
  });
  return used;
};

// ── 2. 定義要抽出的區塊 ───────────────────────────────────────
const BLOCKS = [
  { name: 'CopyButton', dir: 'components', ext: 'jsx', start: 'const CopyButton = ({ text }) => {', end: 'const SectionAccordion = ({ title, icon,' },
  { name: 'SectionAccordion', dir: 'components', ext: 'jsx', start: 'const SectionAccordion = ({ title, icon,', end: 'const SkillCard = ({ skill, isActive,' },
  { name: 'SkillCard', dir: 'components', ext: 'jsx', start: 'const SkillCard = ({ skill, isActive,', end: 'const SpellCard = ({ skillId, spellName,' },
  { name: 'SpellCard', dir: 'components', ext: 'jsx', start: 'const SpellCard = ({ skillId, spellName,', end: 'const EditableSkill = ({ skill, rawSkill,' },
  { name: 'EditableSkill', dir: 'components', ext: 'jsx', start: 'const EditableSkill = ({ skill, rawSkill,', end: 'const ReadOnlySkill = ({ skill, finalStats,' },
  { name: 'ReadOnlySkill', dir: 'components', ext: 'jsx', start: 'const ReadOnlySkill = ({ skill, finalStats,', end: 'const THEMES = {' },
  { name: 'THEMES', dir: 'data', ext: 'js', file: 'workshopThemes', start: 'const THEMES = {', end: 'const getInitialAffinities = () => {', exportKind: 'named' },
  { name: 'FreeModeConfirmModal', dir: 'components', ext: 'jsx', start: 'function FreeModeConfirmModal(', end: 'function AvatarCropperModal(' },
  { name: 'AvatarCropperModal', dir: 'components', ext: 'jsx', start: 'function AvatarCropperModal(', end: 'export default function App(' },
];

const idxOf = (needle, from = 0) => {
  const i = lines.findIndex((l, k) => k >= from && l.startsWith(needle));
  if (i < 0) throw new Error(`找不到區塊邊界：${needle}`);
  return i;
};

const extracted = [];
let cursor = 0;
BLOCKS.forEach((b) => {
  const si = idxOf(b.start, cursor);
  const ei = idxOf(b.end, si + 1);
  cursor = ei;
  b.si = si;
  b.ei = ei;
  b.body = lines.slice(si, ei).join('\n').replace(/\s+$/, '');
  extracted.push(b);
});

// ── 3. 產出新檔 ───────────────────────────────────────────────
const siblingNames = new Set(BLOCKS.map((b) => b.name));
const written = [];

extracted.forEach((b) => {
  const used = usedIn(b.body);
  // ★ 教訓（2026-10-16）：JSX 在**原始碼**裡看不到 `React` 這個字
  //（`<div>` 是標籤，不是識別字），所以上面的掃描抓不到它。
  // 但本專案的測試用 esbuild 經典 JSX 轉換，需要 `React` 在作用域內。
  // 第一次跑腳本時正是漏了這一行，9 個元件全部 ReferenceError，
  // 而 `npm run build` 完全沒吭聲（Vite 用 automatic runtime）。
  if (b.ext === 'jsx') used.add('React');
  // 區塊之間互相引用（例如 ReadOnlySkill 內部用了 CopyButton）→ 補上兄弟檔的 import。
  // ※ 這裡必須直接掃 `b.body`，不能查 `used`——`used` 只涵蓋「原檔的 import」，
  //   而兄弟元件是**同檔內的區域常數**，不在 import 清單裡。
  //   （第一次跑腳本時正是漏了這點，ReadOnlySkill 少了 CopyButton 而 ReferenceError。）
  const crossImports = [];
  siblingNames.forEach((n) => {
    if (n === b.name) return;
    if (!new RegExp(`\\b${n}\\b`).test(b.body)) return;
    crossImports.push(n === 'THEMES' ? `import { THEMES } from '../data/workshopThemes';` : `import ${n} from './${n}';`);
  });

  const importLines = buildImports(used);
  const header = [
    '/**',
    ` * 由 \`NPCWorkshop.jsx\` 抽出的獨立元件（2026-10-16 拆檔第一批）。`,
    ' *',
    ' * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。',
    ' * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。',
    ' *',
    ' * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。',
    ' */',
    ...importLines,
    ...crossImports,
  ].join('\n');

  const isFn = b.body.startsWith('function ');
  let out = `${header}\n\n`;
  if (b.exportKind === 'named') {
    // data 檔：`const X = {...}` → `export const X = {...}`
    out += b.body.replace(/^const\s+(\w+)\s*=/, (mm, nm) => `export const ${nm} =`) + '\n';
  } else if (isFn) {
    out += `export default ${b.body}\n`;
  } else {
    out += `${b.body}\n\nexport default ${b.name};\n`;
  }

  const dir = `${ROOT}/${b.dir}`;
  fs.mkdirSync(dir, { recursive: true });
  const file = `${dir}/${b.file || b.name}.${b.ext}`;
  fs.writeFileSync(file, out);
  written.push({ file, bytes: out.length, imports: importLines.length + crossImports.length });
});

// ── 4. 從主檔移除區塊、加上回匯入 ─────────────────────────────
const keep = [];
let skipUntil = -1;
lines.forEach((l, i) => {
  const b = extracted.find((x) => i >= x.si && i < x.ei);
  if (b) return;
  keep.push(l);
});

const importBlock = [
  '// 以下 8 個元件與 1 份卡片配色表已抽到獨立檔案（2026-10-16 拆檔第一批）。',
  "import CopyButton from './components/CopyButton';",
  "import SectionAccordion from './components/SectionAccordion';",
  "import SkillCard from './components/SkillCard';",
  "import SpellCard from './components/SpellCard';",
  "import EditableSkill from './components/EditableSkill';",
  "import ReadOnlySkill from './components/ReadOnlySkill';",
  "import FreeModeConfirmModal from './components/FreeModeConfirmModal';",
  "import AvatarCropperModal from './components/AvatarCropperModal';",
  "import { THEMES } from './data/workshopThemes';",
].join('\n');

const mainOut = [];
let inserted = false;
keep.forEach((l) => {
  if (!inserted && l.trim() === '// --- COMPONENTS ---') {
    mainOut.push(importBlock);
    mainOut.push('');
    inserted = true;
  }
  mainOut.push(l);
});
if (!inserted) throw new Error('回匯入插入失敗');

fs.writeFileSync(MAIN, mainOut.join('\n'));

console.log('=== 抽出結果 ===');
written.forEach((w) => console.log(`  ${w.file}　${w.bytes} bytes　import ${w.imports} 條`));
console.log(`=== 主檔 ${lines.length} → ${mainOut.length} 行（減 ${lines.length - mainOut.length}）===`);
