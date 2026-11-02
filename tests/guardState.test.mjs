/**
 * 守衛：一個跨回合的 +2（P12，2026-11-02）
 *
 * 執行：`npm run test:guard`
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者這一輪的第三個裁定：「只做 +2」——不做「替隊友扛」（隊友名單屬隊伍層級，
 * 那是另一條還沒裁定的軸線）。
 *
 * 守衛與其他資源最大的差別是它**跨回合存在**：宣告之後，對手的兩三次攻擊都要算 +2。
 * 所以它不是一顆「按一下跳 toast」的按鈕，而是一個要進存檔的狀態。三條命題：
 *   1. 狀態讀得嚴格（舊存檔的 `'false'` 不能變成「永遠在守衛」）      → A 段
 *   2. +2 **不併進 `stats`**（併進去，公式展開就對不上）              → B 段
 *   3. **沒有任何人會自動把它關掉**（App 不知道回合什麼時候結束）      → D 段
 *
 * D 段是這個檔案真正的重點。前兩段錯了看得出來，第三段錯了看不出來——
 * 它會在跑團中途安靜地少 2 點防禦，而沒有人知道是什麼時候消失的。
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  GUARD_BONUS,
  describeGuardState,
  guardBonusOf,
  isGuarding,
  setGuard
} from '../src/features/character-sheet/utils/guardState.js';
import { LOG_FIELD_LABELS, LOG_KINDS } from '../src/features/character-sheet/utils/characterLog.js';

let results = [];
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const section = (title) => { results.push({ __section__: true, name: title }); };
const countOf = (hay, needle) => String(hay).split(needle).length - 1;

const ROOT = process.cwd();
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readSrc = (rel) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** 走整個 `src/`，不手寫清單——手寫的清單會在新增檔案時安靜地漏掉那一支。 */
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.(jsx?|mjs)$/.test(entry.name) ? [full] : [];
});

/* ────────────────────────────────────────────────────────────────
   A. 讀狀態：嚴格相等，不是真值判斷
   ──────────────────────────────────────────────────────────────── */
section('A. 讀狀態：只有真的 `true` 才算守衛');

eq('A1 沒有欄位 → 不在守衛', isGuarding({}), false);
eq('A2 true → 在守衛', isGuarding({ isGuarding: true }), true);
eq('A3 false → 不在守衛', isGuarding({ isGuarding: false }), false);
// 這一條是為什麼用 `=== true`：`Boolean('false')` 是 true，
// 一個從表單／舊存檔轉存出來的字串會變成**永遠關不掉的守衛**。
eq('A4 字串 `"false"` 不算守衛（真值判斷會把它讀成 true）',
  [isGuarding({ isGuarding: 'false' }), Boolean('false')], [false, true]);
eq('A5 加成值：沒守衛是 0（已知的「沒有加成」，不是 null）',
  guardBonusOf({}), 0);
eq('A6 加成值：守衛是 +2', guardBonusOf({ isGuarding: true }), GUARD_BONUS);

/* ────────────────────────────────────────────────────────────────
   B. 描述：畫面與 tooltip 共用一句話
   ──────────────────────────────────────────────────────────────── */
section('B. 描述：按鈕文字與 tooltip 都讀同一個函式');

eq('B1 未守衛：按鈕寫「宣告守衛」、加成 0',
  (({ active, bonus, label }) => ({ active, bonus, label }))(describeGuardState({})),
  { active: false, bonus: 0, label: '宣告守衛' });
eq('B2 守衛中：按鈕寫「守衛中（防禦 +2）」',
  describeGuardState({ isGuarding: true }).label, '守衛中（防禦 +2）');
// tooltip 一定要寫「不會自動解除」——不然玩家會以為它會自己消失。
eq('B3 tooltip 講清楚「不會自動解除」',
  describeGuardState({ isGuarding: true }).title.includes('不會自動解除'), true);

/* ────────────────────────────────────────────────────────────────
   C. 寫入：狀態與履歷同一次
   ──────────────────────────────────────────────────────────────── */
section('C. 寫入：切換與履歷同一次完成');

const base = { id: 'c1', isGuarding: false, log: [] };
const on = setGuard(base, true);
eq('C1 宣告之後欄位是 true', on.isGuarding, true);
eq('C2 履歷多一筆，kind 是 stance', [on.log.length, on.log[0].kind], [1, 'stance']);
eq('C3 履歷寫「宣告守衛」，並記下前後值',
  [on.log[0].title, on.log[0].changes], ['宣告守衛', [{ field: 'isGuarding', from: false, to: true }]]);
eq('C4 不改原本那個物件（純函式）', base.isGuarding, false);

const off = setGuard(on, false);
eq('C5 解除是另一筆（不合併）', off.log.length, 2);
eq('C6 解除那一筆寫「解除守衛」', off.log[1].title, '解除守衛');

// 同一個狀態再按一次＝什麼都沒發生。回傳**原本那個物件**（`===`），
// 否則會多一次假存檔與一筆「false → false」的空記錄。
const same = setGuard(off, false);
eq('C7 已經解除時再解除：不寫入、回同一個物件',
  [same === off, off.log.length], [true, 2]);

eq('C8 `stance` 不合併（宣告與解除是兩件事）', LOG_KINDS.stance.coalesce, 0);
eq('C9 履歷上有「守衛」這個欄位名（不是印出 isGuarding）',
  LOG_FIELD_LABELS.isGuarding, '守衛');

/* ────────────────────────────────────────────────────────────────
   D. 沒有任何人會自動關掉它（這一節才是重點）
   ──────────────────────────────────────────────────────────────── */
section('D. 沒有自動解除：寫入點只有一個，而且沒有計時器');

const guardSrc = stripComments(fs.readFileSync(
  path.join(ROOT, 'src/features/character-sheet/utils/guardState.js'), 'utf8'
));

// 全 `src/` 掃一遍：除了 guardState.js 自己，沒有人可以「寫」這個欄位。
// 讀（`isGuarding(...)`）不限——畫面要讀它才能畫 +2。
const writers = walk(path.join(ROOT, 'src'))
  .filter((file) => !file.endsWith('guardState.js'))
  .map((file) => ({
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    src: stripComments(fs.readFileSync(file, 'utf8'))
  }))
  // 只找「賦值」而不是「讀取」：`isGuarding:` 是物件字面量裡的鍵，
  // 也是 `LOG_FIELD_LABELS` 那個標籤——後者是字典，不是寫入。
  .filter(({ src }) => /isGuarding\s*:/.test(src))
  .map(({ file }) => file);

eq('D1 除了 guardState.js，沒有任何檔案寫 `isGuarding:`（只有 characterLog 的標籤）',
  writers, ['src/features/character-sheet/utils/characterLog.js']);

// 反向：那個唯一的例外真的只是字典的一行，不是偷偷把守衛關掉。
eq('D2 characterLog 那一行是欄位標籤（不是 `isGuarding: false`）',
  /isGuarding\s*:\s*false/.test(readSrc('src/features/character-sheet/utils/characterLog.js')), false);

// 自動解除最常見的寫法就是一個 effect／計時器。這裡沒有。
eq('D3 guardState 裡沒有計時器（setTimeout／setInterval）',
  [countOf(guardSrc, 'setTimeout'), countOf(guardSrc, 'setInterval')], [0, 0]);

const hud = readSrc('src/features/character-sheet/components/CharacterPlayHUD.jsx');
eq('D4 跑團卡沒有用 effect 動守衛（useEffect 裡 0 次 isGuarding）',
  /useEffect\([\s\S]{0,400}?isGuarding/.test(hud), false);
eq('D5 唯一的切換點是 handleToggleGuard（而且它只讀最新值反轉）',
  [
    countOf(hud, 'setGuard(latest, !isGuarding(latest))'),
    countOf(hud, 'data-testid="guard-toggle"')
  ],
  [1, 1]);

/* ────────────────────────────────────────────────────────────────
   E. 畫面：+2 畫在數字旁邊，不進 stats
   ──────────────────────────────────────────────────────────────── */
section('E. 畫面：加成是「數字旁邊的 +2」，不是改掉那個數字');

eq('E1 兩格防禦各有一個 +2 標記（物理／魔法）',
  ['guard-bonus-def', 'guard-bonus-mdef'].filter((id) => !hud.includes(`data-testid="${id}"`)), []);
eq('E2 按鈕用 aria-pressed（切換，不是「不能按」）',
  hud.includes('aria-pressed={guard.active}'), true);
// 加成若被寫進 stats，`StatFormulaPanel` 展開的算式會多出一個沒有出處的 +2。
eq('E3 守衛沒有被寫進 stats（`stats.def +`／`stats.mdef +` 0 次）',
  [countOf(hud, 'stats.def +'), countOf(hud, 'stats.mdef +')], [0, 0]);
eq('E4 加成是「+2」而不是把 `GUARD_BONUS` 硬寫在畫面裡（單一來源）',
  [hud.includes('guardBonusOf(character)'), countOf(hud, '>+2<')], [true, 0]);

/* ────────────────────────────────────────────────────────────────
   Z. 斷言器自我體檢
   ──────────────────────────────────────────────────────────────── */
const before = results.length;
eq('__selfcheck__', 1, 2);
const selfOk = results.length === before + 1 && results[results.length - 1].ok === false;
results.pop();
eq('Z1 斷言器本身會紅（餵不相等的值必須回 false）', selfOk, true);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok && !r.__section__);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) {
  if (r.__section__) { console.log(`\n=== ${r.name} ===`); continue; }
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
}
const total = results.filter((r) => !r.__section__).length;
console.log(`\n  通過 ${total - failed.length} / ${total}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  一個自己會消失的 +2，比沒有的 +2 更難查。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
