/**
 * 狀態異常的顯示順序與效果碼（P7，2026-10-30）。
 *
 * 執行：`npm run test:affliction`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者的要求有兩句，第二句是重點：
 *
 *     1.「每個按鈕都要寫上它的簡單效果。『DEX ⬇』、『DEX · INS ⬇』，之類的。」
 *     2.「按鈕照著這個排序：緩慢 眩暈 虛弱 動搖 憤怒 中毒。」
 *     3.「我希望狀態效果的按鈕要和四維相近。」
 *
 * 第一句是**資訊**，第二句是**順序**，第三句是**位置**。三句其實是同一件事：
 * 讓「DEX 從 d10 掉到 d8」的原因，出現在 DEX 旁邊，而且照屬性排好。
 *
 * ── 這個檔案特別在守的四件事 ────────────────────────────────
 *
 * 1. **效果碼是推導的，不是抄的**：`DEX · INS` 由 `affectedStats` 算出來，
 *    模組裡不准出現 `DEX`／`INS`／`MIG`／`WLP` 的字面值（D 段）。
 *    寫死一份對照表的代價不是「多幾行」，是它會跟資料層不一致，
 *    而不一致的那天沒有人會知道——按鈕上寫 DEX、實際扣 INS，玩家只會覺得「這 App 壞了」。
 * 2. **順序是介面順序，不是資料順序**：`STATUS_AFFLICTION_ORDER` 必須是
 *    `STATUS_AFFLICTIONS` 鍵集合的**排列**（不多不少，A 段逐字點名）。
 *    少一個＝畫面上安靜地少一顆按鈕；多一個＝安靜地什麼都不畫。兩者都不會報錯。
 * 3. **對照組**：F 段每一條「這個狀態要亮」都配一條「其他五個必須不亮」。
 *    沒有對照組的話，「`aria-pressed` 永遠是 false」與「判定正確地不亮」長得一樣。
 * 4. **位置在原始碼層也要釘住**：G 段用 `indexOf` 的相對次序證明這一塊
 *    住在四維卡片裡面（常用檢定之後、EXP 卡片之前），而且只有一份。
 *    真正的「看起來很近」由實機腳本 `scratch/p47-console.mjs` 量實際座標。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import {
  ATTRIBUTE_KEYS,
  STATUS_AFFLICTIONS,
  STATUS_AFFLICTION_ORDER
} from '../src/features/character-sheet/data/sourcebookConfig.js';
import {
  AFFLICTION_ARROW,
  AFFLICTION_STAT_SEPARATOR,
  afflictionEffectLabel,
  buildAfflictionRows,
  describeAfflictionStats
} from '../src/features/character-sheet/utils/afflictionDisplay.js';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';

let results = [];
/** 值斷言。不用「真值」斷言：非空字串與非零數字全部為真，會製造假綠燈。 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const countOf = (hay, needle) => hay.split(needle).length - 1;

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const utilSrc = read('src/features/character-sheet/utils/afflictionDisplay.js');
const configSrc = read('src/features/character-sheet/data/sourcebookConfig.js');
const hudSrc = read('src/features/character-sheet/components/CharacterPlayHUD.jsx');

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

const bare = () => createNewCharacter({ name: '狀態異常測試' });
const withAfflictions = (on = {}) => ({ ...bare(), statusAfflictions: { ...on } });

/** 從 SSR 輸出取出六顆按鈕，**保持 DOM 順序**（順序本身就是這一輪要驗的東西）。 */
const afflictionButtons = (html) => {
  const out = [];
  const re = /<button\b[^>]*data-testid="affliction-([a-z]+)"[^>]*>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({
      key: m[1],
      tag: m[0].slice(0, m[0].indexOf('>') + 1),
      // 標籤換成空白再壓縮：名稱與效果碼在 DOM 裡是兩個相鄰的 <span>，
      // 直接刪標籤會黏成「緩慢DEX ↓」，那不是畫面上的樣子（CSS 有 gap）。
      text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    });
  }
  return out;
};

/* ────────────────────────────────────────────────────────────────
   A. 介面順序：逐字點名，而且必須是資料表的排列
   ──────────────────────────────────────────────────────────────── */
// 逐字點名而不是只比長度：只比長度的話，把「緩慢」換成「動搖」也照樣綠燈。
eq('A1 順序逐字＝使用者的要求（緩慢 眩暈 虛弱 動搖 憤怒 中毒）',
  STATUS_AFFLICTION_ORDER, ['slow', 'dazed', 'weak', 'shaken', 'enraged', 'poisoned']);
eq('A2 六個都在，不多不少', STATUS_AFFLICTION_ORDER.length, 6);
eq('A3 順序表與資料表的鍵集合完全相同（不多不少）',
  STATUS_AFFLICTION_ORDER.slice().sort(), Object.keys(STATUS_AFFLICTIONS).slice().sort());
eq('A4 順序表是唯讀的（不會被誰 push 進去）', Object.isFrozen(STATUS_AFFLICTION_ORDER), true);
// 每個 id 都必須在資料表裡有一筆 `id` 相同的紀錄。少了這條，
// 打錯一個字（`sahken`）只會讓那顆按鈕安靜地消失，而 A3 會紅得莫名其妙。
eq('A5 每一個 id 在資料表裡都對得上自己的 id 欄位',
  STATUS_AFFLICTION_ORDER.map((k) => STATUS_AFFLICTIONS[k] && STATUS_AFFLICTIONS[k].id),
  STATUS_AFFLICTION_ORDER.slice());
// 反向控制：這不是英文版字母序。若有人「順手」改回 `Object.keys`，這條會紅。
eq('A6 順序不是資料表的原始排列（英文版字母序 dazed 開頭）',
  STATUS_AFFLICTION_ORDER.join(',') !== Object.keys(STATUS_AFFLICTIONS).join(','), true);
eq('A7 順序是「單屬性在前、雙屬性在後」',
  STATUS_AFFLICTION_ORDER.map((k) => (STATUS_AFFLICTIONS[k].affectedStats || []).length),
  [1, 1, 1, 1, 2, 2]);
eq('A8 單屬性的四項照 DEX→INS→MIG→WLP 排',
  STATUS_AFFLICTION_ORDER.slice(0, 4).map((k) => STATUS_AFFLICTIONS[k].affectedStats[0]),
  ['dex', 'ins', 'mig', 'wlp']);

/* ────────────────────────────────────────────────────────────────
   B. 屬性代碼＝鍵名大寫（不另立對照表的前提）
   ──────────────────────────────────────────────────────────────── */
// `describeAfflictionStats` 用 `toUpperCase()` 產生 DEX／INS／MIG／WLP。
// 這條釘住「對四個現有屬性而言，大寫就是官方代碼」——不是巧合，是可以逐字驗的。
eq('B1 四維鍵名大寫後就是官方代碼', ATTRIBUTE_KEYS.map((k) => k.toUpperCase()),
  ['DEX', 'INS', 'MIG', 'WLP']);
eq('B2 箭頭是純文字的下箭頭（不是彩色 emoji）', AFFLICTION_ARROW, '↓');
eq('B3 箭頭不是 U+2B07（會被當成 emoji 用彩色字型渲染）', AFFLICTION_ARROW === '⬇', false);
eq('B4 多屬性之間用中點分隔', AFFLICTION_STAT_SEPARATOR, ' · ');

/* ────────────────────────────────────────────────────────────────
   C. describeAfflictionStats：推導與空值語意
   ──────────────────────────────────────────────────────────────── */
const ds = (stats) => describeAfflictionStats({ affectedStats: stats });

eq('C1 單屬性', ds(['dex']), 'DEX');
eq('C2 雙屬性用中點連接', ds(['dex', 'ins']), 'DEX · INS');
eq('C3 三屬性也接得住（不假設只有一到兩個）', ds(['dex', 'ins', 'mig']), 'DEX · INS · MIG');
eq('C4 保留資料層的順序，不自動排序', ds(['wlp', 'mig']), 'WLP · MIG');
eq('C5 大小寫混寫也正規化', ds(['Dex']), 'DEX');
eq('C6 前後空白會去掉', ds([' dex ']), 'DEX');

// 空值語意：不是陣列＝「不知道」，回空字串（按鈕只顯示名稱）。
// **不能回 `[]`**——那會在畫面上寫出「眩暈 」然後什麼都沒有，看起來像壞掉。
eq('C7 沒有 affectedStats（不知道）回空字串', describeAfflictionStats({}), '');
eq('C8 null 回空字串', describeAfflictionStats(null), '');
eq('C9 undefined 回空字串', describeAfflictionStats(undefined), '');
eq('C10 空陣列＝真的沒有屬性，也是空字串', ds([]), '');
// 逐項驗證而不是直接 map：`[null]` 直接 map 會在 render 裡拋錯＝整個面板白畫面。
eq('C11 陣列裡有 null 不會拋錯', ds([null]), '');
eq('C12 陣列裡有空字串不會拋錯', ds(['', 'dex']), 'DEX');
eq('C13 陣列裡有數字不會拋錯', ds([7]), '');
eq('C14 affectedStats 是字串（打錯型別）回空字串', ds('dex'), '');
eq('C15 affectedStats 是物件回空字串', ds({ 0: 'dex' }), '');

/* ────────────────────────────────────────────────────────────────
   D. 效果碼是推導的，不是抄的
   ──────────────────────────────────────────────────────────────── */
eq('D1 效果碼（含箭頭）', afflictionEffectLabel({ affectedStats: ['mig', 'wlp'] }), 'MIG · WLP ↓');
eq('D2 沒有屬性時不留下孤零零的箭頭', afflictionEffectLabel({}), '');

// 這一條是整個檔案的核心護欄：模組裡不准出現屬性代碼的字面值。
// 有人改成 `const CODE = { dazed: 'INS' }` 就會紅——因為那正是「第二個真相」。
const utilCode = stripComments(utilSrc);
eq('D3 模組裡沒有屬性代碼字面值（不准寫死對照表）',
  /\b(DEX|INS|MIG|WLP)\b/.test(utilCode), false);
eq('D4 模組裡沒有狀態名稱字面值（名稱一律取自資料層）',
  /['"`](眩暈|憤怒|中毒|動搖|緩慢|虛弱)['"`]/.test(utilCode), false);

/* ────────────────────────────────────────────────────────────────
   E. buildAfflictionRows：順序、內容、與資料層的一致性
   ──────────────────────────────────────────────────────────────── */
const rows = buildAfflictionRows();
eq('E1 六列', rows.length, 6);
eq('E2 列的順序＝順序表', rows.map((r) => r.key), STATUS_AFFLICTION_ORDER.slice());
eq('E3 每一列都有名稱', rows.every((r) => typeof r.name === 'string' && r.name.length > 0), true);
eq('E4 每一列都有非空的效果碼', rows.every((r) => r.effect.length > 0), true);
// 逐字點名六個效果碼。清單型斷言守不住「漏掉」，所以逐字寫出來。
eq('E5 六個效果碼逐字', rows.map((r) => r.effect),
  ['DEX ↓', 'INS ↓', 'MIG ↓', 'WLP ↓', 'DEX · INS ↓', 'MIG · WLP ↓']);
eq('E6 六個名稱逐字', rows.map((r) => r.name),
  ['緩慢', '眩暈', '虛弱', '動搖', '憤怒', '中毒']);
// 效果碼必須與資料層同源：拿掉箭頭後必須等於 `affectedStats` 推出來的結果。
eq('E7 每一列的效果碼都與 affectedStats 同源',
  rows.map((r) => r.effect.replace(` ${AFFLICTION_ARROW}`, '')),
  rows.map((r) => describeAfflictionStats(STATUS_AFFLICTIONS[r.key])));
eq('E8 每一列都帶得出完整說明（title 用）',
  rows.every((r) => typeof r.desc === 'string' && r.desc.length > 0), true);
// 回傳的 stats 必須是副本：外部改它不該影響資料層（共享資料前先複製）。
const firstRow = rows[0];
firstRow.stats.push('wlp');
eq('E9 回傳的 stats 是副本，不會污染資料層',
  STATUS_AFFLICTIONS.slow.affectedStats.length, 1);

/* ────────────────────────────────────────────────────────────────
   F. SSR：六顆按鈕、順序、內容、對照組
   ──────────────────────────────────────────────────────────────── */
const htmlEmpty = render(withAfflictions({}));
const btnsEmpty = afflictionButtons(htmlEmpty);
eq('F1 六顆按鈕都畫出來了', btnsEmpty.length, 6);
eq('F2 DOM 順序＝STATUS_AFFLICTION_ORDER', btnsEmpty.map((b) => b.key), STATUS_AFFLICTION_ORDER.slice());
eq('F3 每顆按鈕都寫了效果碼', btnsEmpty.map((b) => b.text),
  ['緩慢 DEX ↓', '眩暈 INS ↓', '虛弱 MIG ↓', '動搖 WLP ↓', '憤怒 DEX · INS ↓', '中毒 MIG · WLP ↓']);
eq('F4 沒有一個狀態生效時，六顆全部 aria-pressed=false',
  btnsEmpty.map((b) => /aria-pressed="true"/.test(b.tag)), [false, false, false, false, false, false]);

// 對照組：只開「緩慢」。它自己亮，其他五個必須不亮。
// 沒有這一組，「aria-pressed 永遠 false」與「判定正確」長得一樣。
const btnsSlow = afflictionButtons(render(withAfflictions({ slow: true })));
eq('F5 只開緩慢時，只有緩慢是 aria-pressed=true',
  btnsSlow.map((b) => /aria-pressed="true"/.test(b.tag)),
  [true, false, false, false, false, false]);
// 兩組都要有，才能證明「亮」與「不亮」是判定出來的，不是全部一樣。
const htmlAll = render(withAfflictions(
  Object.fromEntries(STATUS_AFFLICTION_ORDER.map((k) => [k, true]))));
const btnsAll = afflictionButtons(htmlAll);
eq('F6 全開時六顆全部 aria-pressed=true',
  btnsAll.map((b) => /aria-pressed="true"/.test(b.tag)), [true, true, true, true, true, true]);

// 舊的「(-1階)」已從按鈕上拿掉（六個狀態全都是 1 階，寫六次是噪音）。
// 這條同時擋住「有人覺得少了資訊就把它加回來」——要加，得先改掉這裡的理由。
//
// ※ 一定要驗**生效時**的畫面。第一版只驗了「全不生效」，於是刻意破壞驗證抓不到：
//   把 `{isActive && <span>(-1階)</span>}` 加回去，沒有狀態生效時它根本不會渲染，
//   而「不生效」正是那個破折號唯一不出現的狀態。**斷言只驗了一半的狀態＝沒驗。**
eq('F7 沒有狀態生效時，畫面上沒有「-1階」', countOf(htmlEmpty, '-1階'), 0);
eq('F7-b 有狀態生效時，畫面上也沒有「-1階」（這條才是真的擋住回歸）', countOf(htmlAll, '-1階'), 0);
eq('F8 按鈕文字裡沒有殘留的括號數字（全不生效）', btnsEmpty.every((b) => !/\(-\d/.test(b.text)), true);
eq('F8-b 按鈕文字裡沒有殘留的括號數字（全生效）', btnsAll.every((b) => !/\(-\d/.test(b.text)), true);
// 按鈕上的字不該隨狀態改變：亮的只是底色，不是內容。
// 內容一變，玩家就得在「按下去」與「還沒按」之間重新讀一次六顆按鈕。
eq('F8-c 生效與否不改變按鈕上的字',
  btnsAll.map((b) => b.text), btnsEmpty.map((b) => b.text));

// 說明仍然在 title 裡（拿掉 -1階 不等於拿掉資訊）。
eq('F9 每顆按鈕的 title 帶著名稱與完整說明',
  btnsEmpty.map((b) => /title="緩慢：靈巧 骰階下降 1 級/.test(b.tag)), [true, false, false, false, false, false]);
eq('F10 六顆都有 title', btnsEmpty.every((b) => /title="[^"]+：/.test(b.tag)), true);

/* ────────────────────────────────────────────────────────────────
   G. 位置：住在四維卡片裡，而且只有一份
   ──────────────────────────────────────────────────────────────── */
const at = (needle) => hudSrc.indexOf(needle);
eq('G1 狀態異常區塊只有一份（沒有留下舊的滿版區塊）', countOf(hudSrc, 'data-testid="hud-afflictions"'), 1);
eq('G2 不再用 Object.keys(STATUS_AFFLICTIONS) 直接決定畫面順序',
  countOf(hudSrc, 'Object.keys(STATUS_AFFLICTIONS).map'), 0);
eq('G3 區塊住在四維卡片的「常用檢定」之後', at('常用雙屬性一鍵檢定列') < at('data-testid="hud-afflictions"'), true);
eq('G4 區塊住在 EXP 卡片之前（＝還在右翼的四維卡片裡）',
  at('data-testid="hud-afflictions"') < at('EXP / Zenit / Fabula Points Compact Cards'), true);
eq('G5 舊的滿版六欄樣式沒有跟著搬進來（新的是兩欄，與四維對齊）',
  countOf(hudSrc.slice(at('data-testid="hud-afflictions"'), at('EXP / Zenit / Fabula Points Compact Cards')),
    'sm:grid-cols-6'), 0);
eq('G6 新的是兩欄格子（與上方四維格子同欄寬才會逐格對齊）',
  countOf(hudSrc.slice(at('data-testid="hud-afflictions"'), at('EXP / Zenit / Fabula Points Compact Cards')),
    'grid grid-cols-2 gap-2'), 1);
eq('G7 切換仍然走既有的 handleToggleAffliction（沒有另開寫入路徑）',
  countOf(hudSrc, 'handleToggleAffliction(row.key)'), 1);

/* ────────────────────────────────────────────────────────────────
   H. 這一輪仍然是零寫入
   ──────────────────────────────────────────────────────────────── */
eq('H1 顯示模組不寫 localStorage', /localStorage|sessionStorage/.test(utilCode), false);
eq('H2 顯示模組沒有 setter 形狀', /updateField|onChange|setState|writeJSON/.test(utilCode), false);
eq('H3 顯示模組不產生 id 或時間戳', /Date\.now|new Date|Math\.random/.test(utilCode), false);
eq('H4 資料層的順序表只是常數，沒有任何副作用',
  countOf(configSrc, 'export const STATUS_AFFLICTION_ORDER'), 1);

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
  console.log(`\n  按鈕上寫 DEX、實際扣 INS，玩家只會覺得「這 App 壞了」。`);
  console.log(`  效果碼必須從 affectedStats 算出來，不能抄一份。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
