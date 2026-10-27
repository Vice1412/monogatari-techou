#!/usr/bin/env node
/**
 * 交接狀態量測器 —— 產出 docs/STATE-LIVE.md
 *
 * 為什麼要有這支腳本：
 *   這個專案已經發生過三次「寫死的快照數字變成下一個勘誤對象」。
 *   手寫的狀態檔一定會腐化（因為它不在任何人的更新動線上）。
 *   所以現況數字不寫在文件裡，而是每次重新量。
 *
 * 用法：
 *   npm run handoff            產生 docs/STATE-LIVE.md
 *   node scripts/handoff-state.mjs --stdout   只印到螢幕，不寫檔
 *
 * 設計原則：
 *   - 只量「機器量得到」的東西，不推測、不評分。
 *   - 每一項都標明「怎麼量的」，否則這份報告自己就會變成下一個勘誤對象。
 *   - 量不到就寫「量不到」，不要寫 0（0 和「沒有」是兩件事）。
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'STATE-LIVE.md');
const toStdout = process.argv.includes('--stdout');

/* ---------- 小工具 ---------- */

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function read(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return null;
  }
}

function sizeOf(rel) {
  try {
    return fs.statSync(path.join(ROOT, rel)).size;
  } catch {
    return null;
  }
}

/** 遞迴列出檔案（跳過 node_modules / dist / .test-build / scratch / resources）
 *  一律用 `/` 當分隔字元 —— 後面所有比對都靠它，用 path.join 會拿到 `\` 而靜默比對失敗。 */
function walk(dir, exts, acc = []) {
  const SKIP = new Set(['node_modules', 'dist', '.test-build', 'scratch', 'resources', '.git', 'design-mockups']);
  let entries;
  try {
    entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, exts, acc);
    else if (exts.some((x) => e.name.endsWith(x))) acc.push(rel);
  }
  return acc;
}

const fmt = (n) => (n == null ? '量不到' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

/* ---------- 各段量測 ---------- */

const lines = [];
const add = (s = '') => lines.push(s);

// 1. Git
const branch = sh('git rev-parse --abbrev-ref HEAD');
const head = sh('git rev-parse --short HEAD');
const headSubject = sh('git log -1 --pretty=%s');
const dirty = sh('git status --porcelain');
const recent = sh('git log -6 --pretty=format:"%h %ad %s" --date=short');
const ahead = sh('git rev-list --count @{u}..HEAD');
const remote = sh('git ls-remote --heads origin 2>/dev/null | head -3');

// 2. 規範檔大小（Antigravity 單檔上限 24,000 bytes）
const RULE_LIMIT = 24000;
const ruleFiles = [
  ['AGENTS.md', 'DeepSeek Harness 執行細則'],
  ['GEMINI.md', '最高持久規範'],
  ['CODEBUDDY.md', 'WorkBuddy 入口 bootstrap'],
  ['.agents/rules/00-start-here.md', 'Antigravity 開場規則（always_on）'],
  ['.agents/rules/00-local-paths.md', '本機絕對路徑（不進版控）'],
  ['.agents/rules/10-code-rules.md', 'Antigravity 寫程式細則（model_decision）'],
  ['docs/handoff.md', '交接簡報（坑與教訓）'],
  ['docs/antigravity-brief.md', 'Antigravity 完整交接'],
  ['docs/decisions.md', '決策紀錄（紀錄，不是規範）'],
  ['docs/state.md', '人工狀態快照（可能過時）'],
];

// 3. 原始碼規模
const srcFiles = walk('src', ['.js', '.jsx', '.css']);
let srcLines = 0;
for (const f of srcFiles) {
  const s = read(f);
  if (s) srcLines += s.split('\n').length;
}

// 4. 紀律檢查（掃原始碼，不是掃畫面）
const discipline = { localStorage: 0, consoleLog: 0, todo: 0 };
for (const f of srcFiles) {
  if (f.includes('src/data/store.js') || f.includes('src/data/keys.js')) continue; // 存取層本身允許
  const s = read(f);
  if (!s) continue;
  discipline.localStorage += (s.match(/localStorage\./g) || []).length;
  discipline.consoleLog += (s.match(/\bconsole\.(log|debug)\(/g) || []).length;
  discipline.todo += (s.match(/\b(TODO|FIXME)\b/g) || []).length;
}

// 5. 測試
const testFiles = walk('tests', ['.mjs']);
const pkg = JSON.parse(read('package.json') || '{}');
const gateCount = (pkg.scripts?.test || '').split('npm run ').length - 1;

// 6. 缺陷台賬
const summary = read('docs/playtest/99-summary.md');
const findingIds = summary ? [...new Set(summary.match(/F-0\d\d/g) || [])].sort() : [];
const resume = read('docs/playtest/resume.md');
const resumeStatus = resume
  ? (resume.split('\n').filter((l) => /^- \*\*(更新|基準 commit|狀態)/.test(l)).slice(0, 3) || []).join('\n')
  : null;

// 7. docs 清單
const docFiles = walk('docs', ['.md', '.html']).sort();

/* ---------- 組裝 ---------- */

const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

add('# 現況（自動生成）');
add();
add(`> **本檔由 \`npm run handoff\` 生成，時間 ${stamp}。**`);
add('> **不要手改** —— 手改會在下次重跑時消失，而且會製造第二個真相。');
add('> 要改量測項目，改 `scripts/handoff-state.mjs`。');
add();
add('---');
add();

add('## 1. 版本狀態');
add();
add('| 項目 | 值 |');
add('|---|---|');
add(`| 分支 | \`${branch ?? '量不到'}\` |`);
add(`| HEAD | \`${head ?? '量不到'}\` ${headSubject ? `— ${headSubject}` : ''} |`);
add(`| 未提交變更 | ${dirty ? `${dirty.split('\n').length} 個檔案` : '無（工作區乾淨）'} |`);
add(`| 未推送 commit | ${ahead == null ? '量不到（沒有 upstream）' : ahead} |`);
add();
if (dirty) {
  add('未提交的檔案：');
  add();
  add('```');
  add(dirty.split('\n').slice(0, 25).join('\n'));
  if (dirty.split('\n').length > 25) add(`... 另有 ${dirty.split('\n').length - 25} 個`);
  add('```');
  add();
}
add('最近 6 個 commit（`git log -6`）：');
add();
add('```');
add(recent || '量不到');
add('```');
add();

add('## 2. 規範檔大小 vs Antigravity 上限');
add();
add('Antigravity 的規則檔**單檔上限 24,000 bytes**，`always_on` 規則**總預算 20,000 tokens**，');
add('超過時最大的檔案會被自動降級成「只給路徑與描述」的指標。');
add('`AGENTS.md` 與 `GEMINI.md` 會被自動注入，所以它們的大小直接影響你能看到多少。');
add();
add('| 檔案 | bytes | 24 KB 上限 | 說明 |');
add('|---|---:|---|---|');
for (const [f, note] of ruleFiles) {
  const s = sizeOf(f);
  let flag;
  if (s == null) flag = '不存在';
  else if (s > RULE_LIMIT) flag = `**超出 ${fmt(s - RULE_LIMIT)} bytes，會被截斷**`;
  else if (s > RULE_LIMIT * 0.8) flag = '接近上限';
  else flag = 'OK';
  add(`| \`${f}\` | ${fmt(s)} | ${flag} | ${note} |`);
}
add();
const agentsSize = sizeOf('AGENTS.md');
if (agentsSize && agentsSize > RULE_LIMIT) {
  add(`> **注意**：\`AGENTS.md\` 有 ${fmt(agentsSize)} bytes，超過上限。`);
  add('> 它是 DeepSeek Harness 的執行細則，Antigravity 讀到的是被截斷的版本。');
  add('> 需要完整內容時請用 Read 工具分段讀，或直接讀你真正需要的章節。');
  add();
}

add('## 3. 原始碼規模');
add();
add('| 項目 | 數量 | 怎麼量的 |');
add('|---|---:|---|');
add(`| \`src/\` 檔案（.js/.jsx/.css） | ${fmt(srcFiles.length)} | 遞迴列舉，跳過 node_modules／dist／scratch |`);
add(`| \`src/\` 總行數 | ${fmt(srcLines)} | 逐檔 \`split('\\n').length\` 相加 |`);
add(`| \`tests/\` 測試檔 | ${fmt(testFiles.length)} | \`tests/**/*.test.mjs\` |`);
add(`| \`npm test\` 關卡數 | ${fmt(gateCount)} | \`package.json\` 的 \`test\` 字串裡 \`npm run\` 出現次數 |`);
add();

add('## 4. 原始碼紀律（掃原始碼，不是掃畫面）');
add();
add('| 檢查項 | 現值 | 目標 |');
add('|---|---:|---|');
add(`| \`src/\` 直接呼叫 \`localStorage\` | ${discipline.localStorage} | 0（一律走 \`src/data/store.js\`） |`);
add(`| \`src/\` \`console.log\` / \`console.debug\` | ${discipline.consoleLog} | 0 |`);
add(`| \`src/\` TODO / FIXME | ${discipline.todo} | 0 |`);
add();
add('> 這三項是「掃原始碼」的靜態計數，不是執行期行為。');
add('> 數字是 0 只代表沒有這些字串，不代表功能正確。');
add();

add('## 5. 缺陷台賬');
add();
if (findingIds.length) {
  add(`\`docs/playtest/99-summary.md\` 裡出現的缺陷編號共 **${findingIds.length}** 個：`);
  add();
  add(`\`${findingIds.join('` `')}\``);
  add();
} else {
  add('量不到（`docs/playtest/99-summary.md` 不存在或沒有 F-0xx 編號）。');
  add();
}
if (resumeStatus) {
  add('`docs/playtest/resume.md` 的狀態行（原樣引用，未經解讀）：');
  add();
  add('```');
  add(resumeStatus);
  add('```');
  add();
}
add('> **台賬狀態已被發現過期四次。** 動工前必須複驗現況，');
add('> 不要直接相信任何一處寫的「已修／還開著」。');
add();

add('## 6. 文件地圖');
add();
add(`\`docs/\` 共 ${docFiles.length} 個檔案：`);
add();
add('```');
for (const f of docFiles) {
  const s = sizeOf(f);
  add(`${(s == null ? '?' : String(s)).padStart(7)}  ${f}`);
}
add('```');
add();

add('## 7. 下一步');
add();
add('本檔**不判斷**下一步該做什麼（那是人的決定）。請讀：');
add();
add('- `docs/playtest/resume.md` —— 續傳卡，「如果你要接著做」那一節');
add('- `docs/playtest/99-summary.md` §六 —— 裁定清單與優先序判準');
add('- `AGENTS.md` §6.1 —— 尚未裁定的事項（**未裁定前不要自行開修**）');
add();
add('---');
add();
add('*本檔結束。要重新量一次：`npm run handoff`*');

/* ---------- 輸出 ---------- */

const text = lines.join('\n') + '\n';
if (toStdout) {
  process.stdout.write(text);
} else {
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(OUT, text, 'utf8');
  console.log(`已生成 ${path.relative(ROOT, OUT)}（${text.length} 字元）`);
  console.log(`  HEAD ${head ?? '?'} · src ${fmt(srcFiles.length)} 檔 / ${fmt(srcLines)} 行 · 未提交 ${dirty ? dirty.split('\n').length : 0}`);
}
