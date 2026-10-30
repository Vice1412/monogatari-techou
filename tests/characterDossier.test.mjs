/**
 * 角色檔案（P5-b，2026-10-30）。
 *
 * 執行：`npm run test:dossier`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者對「代入感」的定義是：
 *
 *   「讓用戶感覺到這個界面就是記錄了角色的所有東西，在這邊操作就可以操控和查到
 *    這個角色所有的內容，而非一個毫不相關的視窗。」
 *
 * 量到的缺口不是數值，是「這個人是誰」：`gender` 與 `background` 在
 * `CharacterPlayHUD.jsx` 的出現次數是 **0**。它們是玩家在編輯器第 6 步
 * 「命名與背景」親手寫下的東西，而同一份 `background` 在名冊卡上是畫得出來的
 * ——所以這不是資料拿不到，是面板沒有去拿。
 *
 * 這個檔案守三件事：
 *   1. 面板真的讀得到（E 段：SSR 渲染，不是原始碼裡有那個字就算）。
 *   2. 空值給的是**指路句**，不是空白（空白的抽屜沒有人會去點）。
 *   3. **不准加輸入框**（F 段）：使用者的另一條裁定是「一般操作還是不要寫太多東西」。
 *      最容易被下一個人當成好主意、也最容易被誤解成「代入感」的，就是「讓玩家自己寫」。
 *
 * ── 為什麼每條正向斷言都要有對照組 ──────────────────────────
 *
 * 「收合時看不到背景全文」與「元件根本沒渲染背景」在輸出上長得一模一樣。
 * 所以 E 段每一條「不該出現」都配一條「展開後必須出現」。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import {
  DOSSIER_FIELDS,
  BACKGROUND_HINT,
  TEASER_BACKGROUND_MAX,
  buildDossier,
  buildDossierTeaser,
  backgroundDisplayText
} from '../src/features/character-sheet/utils/characterDossier.js';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';

let results = [];
/**
 * 值斷言：實際值與期望值真的相等才算過。
 *
 * ※ 專案踩過一次：把「期望值」寫進 `check(name, ok, detail)` 的 `detail` 欄位，
 *   `ok` 拿到實際值本身，非空字串／非零數字全部為真，三十幾條永遠會過。
 *   所以這裡只用 `eq`。
 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const countOf = (hay, needle) => hay.split(needle).length - 1;

const render = (character, props = {}) =>
  renderToStaticMarkup(
    React.createElement(CharacterPlayHUD, {
      character,
      onChange: () => {},
      onBackToRoster: () => {},
      onOpenEditor: () => {},
      showToast: () => {},
      ...props
    })
  );

const bare = () => createNewCharacter({ name: '檔案測試' });
const withStory = (extra = {}) => {
  const c = bare();
  c.gender = '女';
  c.origin = '帝國邊境';
  c.identity = '流浪學者';
  c.theme = '真相';
  c.background = '她在圖書館的火裡醒來，記得的最後一件事是一頁被撕掉的索引。\n此後她只信自己抄下來的字。';
  return Object.assign(c, extra);
};

/* ────────────────────────────────────────────────────────────────
   A. buildDossier：讀得對、空得對
   ──────────────────────────────────────────────────────────────── */
const empty = buildDossier(bare());
eq('A1 四個欄位（性別／出身／身份／主題）', DOSSIER_FIELDS.map((f) => f.key), ['gender', 'origin', 'identity', 'theme']);
eq('A2 欄位順序就是畫面順序（性別貼著姓名在最前）', DOSSIER_FIELDS.map((f) => f.label), ['性別', '出身', '身份', '主題']);
eq('A3 新角色四列全部是空的', empty.rows.map((r) => r.empty), [true, true, true, true]);
eq('A4 新角色背景是空的', empty.backgroundEmpty, true);
eq('A5 新角色沒有任何故事', empty.hasStory, false);
eq('A6 總項數是四列＋背景', empty.totalCount, 5);
eq('A7 空角色的已填數是 0', empty.filledCount, 0);

const full = buildDossier(withStory());
eq('A8 有值時逐列帶出原字串', full.rows.map((r) => r.value), ['女', '帝國邊境', '流浪學者', '真相']);
eq('A9 有值時沒有空的列', full.rows.map((r) => r.empty), [false, false, false, false]);
eq('A10 背景原樣保留（含換行）', full.background, withStory().background);
eq('A11 全填時已填數等於總項數', [full.filledCount, full.totalCount], [5, 5]);

// 空值語意：只有空白不算填、非字串不算填。
const blankOnly = bare();
blankOnly.gender = '   ';
blankOnly.background = '\n\t ';
const blankDossier = buildDossier(blankOnly);
eq('A12 只有空白字元的性別視為未填', blankDossier.rows[0].empty, true);
eq('A13 只有換行與 tab 的背景視為未填', blankDossier.backgroundEmpty, true);

const weird = bare();
weird.gender = 0;
weird.origin = null;
weird.identity = ['流', '浪'];
weird.theme = undefined;
const weirdDossier = buildDossier(weird);
eq('A14 數字 0 不算「玩家寫了東西」（String(0) 會變成 "0"）',
  weirdDossier.rows.map((r) => r.empty), [true, true, true, true]);
eq('A15 陣列不會被當成文字串接', weirdDossier.rows[2].value, '');

eq('A16 null 角色不炸', buildDossier(null).rows.length, 4);
eq('A17 字串角色不炸（不是物件就當空）', buildDossier('not-a-character').hasStory, false);
eq('A18 陣列角色不炸', buildDossier([1, 2, 3]).filledCount, 0);

/* ────────────────────────────────────────────────────────────────
   B. 摘要句（收合時畫面上那一行）
   ──────────────────────────────────────────────────────────────── */
eq('B1 全空時摘要句是空字串（由呼叫端決定要不要換成教學句）', buildDossier(bare()).teaser, '');
eq('B2 只有性別時摘要句就是性別', buildDossierTeaser({
  rows: [{ value: '女', empty: false }, { value: '', empty: true }], background: ''
}), '女');
eq('B3 兩列有值時用「 · 」相接', buildDossierTeaser({
  rows: [{ value: '女', empty: false }, { value: '帝國邊境', empty: false }], background: ''
}), '女 · 帝國邊境');
eq('B4 超過兩列只取前兩列（摘要不是清單）', buildDossierTeaser({
  rows: [
    { value: '女', empty: false },
    { value: '帝國邊境', empty: false },
    { value: '流浪學者', empty: false }
  ],
  background: ''
}), '女 · 帝國邊境');
eq('B5 背景只取第一行（玩家常常分段寫）', buildDossierTeaser({
  rows: [], background: '第一行\n第二行\n第三行'
}), '第一行');

const exact = '一'.repeat(TEASER_BACKGROUND_MAX);
const over = '一'.repeat(TEASER_BACKGROUND_MAX + 1);
eq(`B6 背景恰好 ${TEASER_BACKGROUND_MAX} 字不截斷（邊界內）`, buildDossierTeaser({ rows: [], background: exact }), exact);
eq(`B7 背景 ${TEASER_BACKGROUND_MAX + 1} 字要截斷並補「…」（邊界外）`,
  buildDossierTeaser({ rows: [], background: over }), `${exact}…`);
eq('B8 空輸入不炸', buildDossierTeaser(), '');
eq('B9 傳陣列當 rows 不炸', buildDossierTeaser({ rows: 'not-an-array', background: '' }), '');
eq('B10 rows 裡的壞元素不會被當成有值',
  buildDossierTeaser({ rows: [null, { value: '女', empty: true }, undefined], background: '' }), '');

/* ────────────────────────────────────────────────────────────────
   C. 背景顯示文字：有值原樣、沒值指路
   ──────────────────────────────────────────────────────────────── */
eq('C1 有背景時原樣回傳（不截斷——面板的職責是還原玩家寫的東西）',
  backgroundDisplayText(full), full.background);
eq('C2 沒有背景時回傳教學句', backgroundDisplayText(empty), BACKGROUND_HINT);
eq('C3 教學句指出「第 6 步」而不是第 8 步（編輯器只有六格）',
  BACKGROUND_HINT.includes('第 6 步'), true);
eq('C4 教學句不是「無」兩個字（「無」只說現況，沒說去哪裡補）',
  BACKGROUND_HINT === '無' || BACKGROUND_HINT.trim() === '', false);
eq('C5 教學句說出補上之後會發生什麼', BACKGROUND_HINT.includes('原樣顯示'), true);
eq('C6 傳 null 不炸', backgroundDisplayText(null), BACKGROUND_HINT);

/* ────────────────────────────────────────────────────────────────
   D. 模組邊界：只讀，不寫
   ──────────────────────────────────────────────────────────────── */
const ROOT = process.cwd();
const dossierSrc = fs.readFileSync(
  path.join(ROOT, 'src/features/character-sheet/utils/characterDossier.js'),
  'utf8'
);
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const dossierCode = stripComments(dossierSrc);

eq('D1 沒有寫入 store', /writeJSON|localStorage|sessionStorage/.test(dossierCode), false);
eq('D2 沒有回呼（不是受控元件的一部分）', /onChange|onSave|setState/.test(dossierCode), false);
eq('D3 沒有回傳任何 setter', /export\s+const\s+(set|update|write|save)[A-Z]/.test(dossierCode), false);

/* ────────────────────────────────────────────────────────────────
   E. SSR：面板真的畫出來了嗎
   ──────────────────────────────────────────────────────────────── */
const hudSrc = fs.readFileSync(
  path.join(ROOT, 'src/features/character-sheet/components/CharacterPlayHUD.jsx'),
  'utf8'
);
eq('E0 面板原始碼有接上 buildDossier（不是只有模組存在）',
  /buildDossier\(character\)/.test(stripComments(hudSrc)), true);

const collapsed = render(withStory());
eq('E1 面板上有「角色檔案」', countOf(collapsed, '角色檔案'), 1);
eq('E2 收合時也看得到角色的故事（摘要句在畫面上）', countOf(collapsed, '女 · 帝國邊境'), 1);
eq('E3 收合時**不**顯示背景全文（對照組：證明 E5 的「展開才出現」有意義）',
  countOf(collapsed, '被撕掉的索引'), 0);
eq('E4 收合時不顯示欄位標籤（標籤只在展開後出現）', countOf(collapsed, '>流浪學者<'), 0);

const expanded = render(withStory(), { initialDossierOpen: true });
eq('E5 展開後背景全文出現', countOf(expanded, '被撕掉的索引'), 1);
// 「主題」在畫面上會出現**兩次**：一次在肖像下方那一行（`身份 · 主題 · 來自 出身`），
// 一次在檔案的格子裡。那不是重複渲染，是「摘要行」與「明細表」兩種讀法——
// 就像任何遊戲的角色畫面，名字與職業在標頭與屬性面板上各出現一次。
// 所以這裡寫的是實際值 2，而不是為了好看寫 1：寫 1 的話，有人把檔案的「主題」那一列
// 刪掉時，總數剛好還是 1，這條就會**綠著**（MEMORY §C13：清單型斷言守不住漏掉）。
eq('E6 展開後四個欄位的值都在', ['女', '帝國邊境', '流浪學者', '真相'].map((v) => countOf(expanded, `>${v}<`)), [1, 1, 1, 2]);
eq('E6-b 四個欄位各有一個具名格子（逐一點名，不靠總數）',
  ['gender', 'origin', 'identity', 'theme'].map((k) => countOf(expanded, `data-testid="dossier-${k}"`)), [1, 1, 1, 1]);
eq('E7 展開後四個欄位的標籤都在', ['性別', '出身', '身份', '主題'].map((l) => countOf(expanded, `>${l}<`)), [1, 1, 1, 1]);
eq('E8 展開後說得出「已填幾項」', countOf(expanded, '已填 5 / 5'), 1);
eq('E9 背景保留下面的換行（whitespace-pre-wrap）', countOf(expanded, 'whitespace-pre-wrap'), 1);

const emptyExpanded = render(bare(), { initialDossierOpen: true });
eq('E10 沒有背景時給的是指路句，不是空白', countOf(emptyExpanded, '尚未寫下背景'), 1);
// 「第 6 步」出現兩次是對的：教學句指路一次、下方按鈕「前往第 6 步修改」再一次。
eq('E11 指路句指出第 6 步（教學句＋按鈕各一次）', countOf(emptyExpanded, '第 6 步'), 2);
eq('E12 沒有背景時摘要句也不是空的（空抽屜沒有人會點）', countOf(emptyExpanded, '背景尚未填寫'), 1);
eq('E13 沒有背景時不該說「已填 5 / 5」', countOf(emptyExpanded, '已填 5 / 5'), 0);
eq('E14 沒有背景時已填數是 0', countOf(emptyExpanded, '已填 0 / 5'), 1);

// 對照組：收合時「尚未寫下背景」不該出現——否則 E10 證明不了「展開才出現」。
eq('E15 收合時不顯示教學句（對照組）', countOf(render(bare()), '尚未寫下背景'), 0);

eq('E16 檔案區塊只有一個（不是每欄各畫一個）', countOf(expanded, 'data-testid="character-dossier"'), 1);

/* ────────────────────────────────────────────────────────────────
   F. 紅線：不准用新的空白輸入框換代入感
   ──────────────────────────────────────────────────────────────── */
const inputsCollapsed = countOf(collapsed, '<textarea') + countOf(collapsed, '<input');
const inputsExpanded = countOf(expanded, '<textarea') + countOf(expanded, '<input');
eq('F1 展開檔案不會多出任何輸入框（textarea／input 數量不變）', inputsExpanded, inputsCollapsed);
eq('F2 收合時面板本來就有輸入框（否則 F1 是在比較兩個 0）', inputsCollapsed > 0, true);
eq('F3 面板沒有為檔案新增「背景」輸入框',
  /character\.background\s*\n?\s*onChange|updateField\('background'/.test(stripComments(hudSrc)), false);
eq('F4 檔案模組裡沒有任何 placeholder（沒有要玩家填的東西）',
  /placeholder/.test(dossierCode), false);

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
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  面板讀不到角色的性別與背景，就只是一組數字。`);
  console.log(`  但「讀得到」不等於「可以寫」——使用者的紅線是不再加輸入框。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
