/**
 * 事前可用性（P6，2026-10-30）。
 *
 * 執行：`npm run test:availability`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者的原話是「操作感則是要有玩遊戲的感覺，不呆板，而是有系統互動的實感」。
 * 量到的問題不是畫面不好看，而是**順序錯了**：同一個成本門檻在八個地方各寫一次，
 * 而且八個地方全部長這樣——
 *
 *     onClick={() => { if (curMp < cost) { showToast('MP 不足'); return; } ... }}
 *
 * 也就是「先讓你按下去，再告訴你不行」。玩家在桌上得到的是「按了沒反應」，
 * 那不是互動，是拒絕。這一輪把判定收斂成 `describeCostGate` 並提前算一次，
 * 讓按鈕在按之前就灰掉、並且**寫出還差多少**（只有灰掉不夠：手機沒有 hover）。
 *
 * ── 這個檔案特別在守的三件事 ────────────────────────────────
 *
 * 1. **空值語意**：`null`／`''`／布林／物件＝「不知道」→ 不擋；
 *    `0`＝「知道而且不夠」→ 擋。用 `Number(v)` 會把前者全變成後者
 *    （`Number(null) === 0`），舊存檔會一開場整排變灰。B 段逐個釘住。
 * 2. **按下後的守衛沒有被拆**：H 段逐條點名八個 `if (… < …)` 還在。
 *    提示只是提前告知；它如果變成唯一依據，判定一有出入就會「按了沒反應」。
 * 3. **對照組**：G 段每一條「不足時要出現」都配一條「足夠時必須消失」。
 *    沒有對照組的話，「元件根本沒渲染那個提示」與「判定正確地不顯示」長得一樣。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  GATE_UNITS,
  GATED_BUTTON_CLASS,
  GATED_SHELL_CLASS,
  GATED_LABEL_CLASS,
  asCount,
  describeCostGate,
  describeCostGates,
  gateButtonAttrs
} from '../src/features/character-sheet/utils/playAvailability.js';
import UnavailableHint from '../src/features/character-sheet/components/UnavailableHint.jsx';
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

const utilSrc = read('src/features/character-sheet/utils/playAvailability.js');
const hudSrc = read('src/features/character-sheet/components/CharacterPlayHUD.jsx');
const hintSrc = read('src/features/character-sheet/components/UnavailableHint.jsx');

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

const bare = () => createNewCharacter({ name: '可用性測試' });

/* ────────────────────────────────────────────────────────────────
   A. asCount：把「不知道」與「0」分開
   ──────────────────────────────────────────────────────────────── */
eq('A1 數字原樣回傳', asCount(7), 7);
eq('A2 零是「知道而且不夠」，不是「不知道」', asCount(0), 0);
eq('A3 負數原樣回傳（交由判定端決定語意）', asCount(-3), -3);
eq('A4 數字字串會被解析', asCount('12'), 12);
eq('A5 前後有空白的數字字串也會解析', asCount('  4  '), 4);
eq('A6 null 是「不知道」', asCount(null), null);
eq('A7 undefined 是「不知道」', asCount(undefined), null);
eq('A8 空字串是「不知道」（Number("") 會變 0，這裡必須擋住）', asCount(''), null);
eq('A9 只有空白的字串是「不知道」', asCount('   '), null);
eq('A10 布林不是數量（Number(false) 會變 0）', asCount(false), null);
eq('A11 陣列不是數量', asCount([]), null);
eq('A12 物件不是數量', asCount({}), null);
eq('A13 NaN 是「不知道」', asCount(NaN), null);
eq('A14 Infinity 不是可用的數量', asCount(Infinity), null);
eq('A15 非數字字串是「不知道」', asCount('很多'), null);

/* ────────────────────────────────────────────────────────────────
   B. describeCostGate：門檻判定與邊界
   ──────────────────────────────────────────────────────────────── */
const g = (cost, current, unit) => describeCostGate({ cost, current, unit });

// 邊界：付完剛好 0 是可以的。這條最容易寫錯成 `<=`。
eq('B1 剛好付得起不算不足（current === cost）', g(5, 5).blocked, false);
eq('B2 付完還剩很多不算不足', g(5, 9).blocked, false);
eq('B3 差 1 就是不足', g(5, 4).blocked, true);
eq('B4 差 1 的短少量是 1', g(5, 4).short, 1);
eq('B5 完全沒有（0）是「知道而且不夠」，要擋', g(5, 0).blocked, true);
eq('B6 完全沒有時短少量等於成本', g(5, 0).short, 5);

// 不知道就不擋。這三條是「不嚇人」的全部依據。
eq('B7 現值 null（不知道）不擋', g(5, null).blocked, false);
eq('B8 現值 undefined（不知道）不擋', g(5, undefined).blocked, false);
eq('B9 現值空字串（不知道）不擋', g(5, '').blocked, false);
eq('B10 現值布林（不知道）不擋', g(5, false).blocked, false);
eq('B11 現值 NaN（不知道）不擋', g(5, NaN).blocked, false);

// 沒有成本就不是門檻。
eq('B12 成本 0 不算門檻', g(0, 0).blocked, false);
eq('B13 成本 null 不算門檻', g(null, 0).blocked, false);
eq('B14 成本 undefined 不算門檻', g(undefined, 0).blocked, false);
eq('B15 成本負數不算門檻', g(-4, 0).blocked, false);
eq('B16 成本 NaN 不算門檻', g(NaN, 0).blocked, false);

// 文字
eq('B17 單位預設是 MP', g(5, 2).reason, 'MP 不足：需要 5，現有 2，還差 3');
eq('B18 短少量文字給的是「差多少」', g(5, 2).shortText, '差 3 MP');
eq('B19 單位可以換成 IP', g(3, 1, GATE_UNITS.ip).shortText, '差 2 IP');
eq('B20 單位可以換成物語點', g(1, 0, GATE_UNITS.fp).shortText, '差 1 物語點');
eq('B21 沒被擋時沒有說明文字（不留一句空話給畫面）', g(5, 9).shortText, '');
eq('B22 沒被擋時 reason 也是空的', g(5, 9).reason, '');

// 字串進來的成本（存檔可能是字串）
eq('B23 成本是數字字串也能判', g('5', 2).blocked, true);
eq('B24 成本是數字字串時短少量正確', g('5', 2).short, 3);

// known：畫面上要知道「這是真的不夠」還是「我們不知道」
eq('B25 知道現值時 known 為真', g(5, 2).known, true);
eq('B26 不知道現值時 known 為假', g(5, null).known, false);

/* ────────────────────────────────────────────────────────────────
   C. gateButtonAttrs：用 aria-disabled，不用 disabled
   ──────────────────────────────────────────────────────────────── */
const blockedAttrs = gateButtonAttrs(g(5, 2));
eq('C1 被擋時標記 aria-disabled', blockedAttrs['aria-disabled'], 'true');
eq('C2 被擋時留下可掃描的 data 標記', blockedAttrs['data-blocked'], 'true');
eq('C3 被擋時 title 就是完整原因', blockedAttrs.title, 'MP 不足：需要 5，現有 2，還差 3');
eq('C4 沒被擋時不掛任何屬性（不要留一個 aria-disabled="false"）', gateButtonAttrs(g(5, 9)), {});
eq('C5 沒有判定結果時不掛任何屬性', gateButtonAttrs(null), {});
// 這條是設計理由本身：`disabled` 會吃掉 title 也拿不到焦點，說明文字等於消失。
eq('C6 刻意不使用 disabled 屬性（否則說明文字會消失）',
  Object.prototype.hasOwnProperty.call(blockedAttrs, 'disabled'), false);

/* ────────────────────────────────────────────────────────────────
   D. describeCostGates：多個成本合併
   ──────────────────────────────────────────────────────────────── */
const multi = describeCostGates([
  { cost: 3, current: 10, unit: 'IP' },
  { cost: 8, current: 2, unit: 'MP' }
]);
eq('D1 多項中有一項不足就算擋', multi.blocked, true);
eq('D2 取的是不足的那一項', multi.shortText, '差 6 MP');
eq('D3 全部足夠就不擋', describeCostGates([{ cost: 1, current: 1 }]).blocked, false);
eq('D4 空陣列回一個安全的預設（不擋、不炸）', describeCostGates([]).blocked, false);
eq('D5 非陣列輸入不會炸', describeCostGates(null).blocked, false);

/* ────────────────────────────────────────────────────────────────
   E. 樣式與 Tailwind 尺度
   ──────────────────────────────────────────────────────────────── */
eq('E1 灰掉用的是 Tailwind 預設尺度值 opacity-50', countOf(GATED_BUTTON_CLASS, 'opacity-50'), 1);
// `opacity-45` 不在 Tailwind 3 的預設尺度裡，寫了不會生成樣式 → 以為灰掉了其實沒有。
eq('E2 不使用尺度外的 opacity-45（生不出樣式）', countOf(GATED_BUTTON_CLASS, 'opacity-45'), 0);
eq('E3 被擋時游標要說明不能按', countOf(GATED_BUTTON_CLASS, 'cursor-not-allowed'), 1);
// 這一條是實機量到才發現的：按鈕一壓透明度，按鈕裡的「差 3 IP」會跟著變淡。
// CSS 的 opacity 是整棵子樹相乘，子元素沒辦法比父元素更不透明。
eq('E4 外殼樣式不得含 opacity（否則裡面的短少量會一起被壓淡）',
  /opacity/.test(GATED_SHELL_CLASS), false);
eq('E5 外殼仍然要關掉游標', countOf(GATED_SHELL_CLASS, 'cursor-not-allowed'), 1);
eq('E6 標籤樣式才是壓透明度的那一層', GATED_LABEL_CLASS, 'opacity-50');
eq('E7 整個模組沒有尺度外的 opacity', /opacity-(?!50\b)\d+/.test(stripComments(utilSrc)), false);

/* ────────────────────────────────────────────────────────────────
   F. 接線：八處門檻都走同一個入口
   ──────────────────────────────────────────────────────────────── */
eq('F1 消耗品五項都算過判定', Object.keys({
  remedy: 1, elixir: 1, tonic: 1, magicTent: 1, elementalShard: 1
}).every((k) => hudSrc.includes(`consumableGates.${k}`)), true);
eq('F2 咒語用的是每條咒語自己的 mp', countOf(hudSrc, 'describeCostGate({ cost: sp.mp'), 1);
eq('F3 儀式用的是折半後的 finalMp', countOf(hudSrc, 'describeCostGate({ cost: finalMp'), 1);
// 逐一點名，不用「出現 N 次」——數字型斷言守不住「漏掉」，只守得住「變多」。
eq('F4a 羈絆激勵的判定算在物語點上', countOf(hudSrc, 'const bondInspireGate = describeCostGate('), 1);
eq('F4b 羈絆按鈕掛上判定結果', countOf(hudSrc, '{...gateButtonAttrs(bondInspireGate)}'), 1);
eq('F4c 羈絆按鈕會灰掉', countOf(hudSrc, 'bondInspireGate.blocked ? GATED_BUTTON_CLASS'), 1);
eq('F4d 羈絆頁有一行全域提示', countOf(hudSrc, 'bondInspireGate.blocked && ('), 1);
eq('F5 八處以上掛了按鈕屬性', countOf(hudSrc, 'gateButtonAttrs(') >= 8, true);
// 兩種灰法各有各的場合，逐一點名（不用「出現 N 次」——數字守不住漏掉）。
eq('F6a 提示在按鈕外的三處（咒語／儀式／羈絆）用整顆淡化',
  countOf(hudSrc, '? GATED_BUTTON_CLASS : '), 3);
eq('F6b 提示在按鈕內的五處（消耗品）只用外殼樣式',
  ['remedy', 'elixir', 'tonic', 'magicTent', 'elementalShard']
    .every((k) => hudSrc.includes(`consumableGates.${k}.blocked ? GATED_SHELL_CLASS : ''`)), true);
eq('F6c 五個消耗品標籤各自可淡化（短少量才不會被一起壓淡）',
  ['remedy', 'elixir', 'tonic', 'magicTent', 'elementalShard']
    .every((k) => hudSrc.includes(`consumableGates.${k}.blocked ? GATED_LABEL_CLASS : ''`)), true);
eq('F7 儀式有可掃描的提示', countOf(hudSrc, 'testId="gate-ritual"'), 1);
eq('F8 羈絆的全域提示有可掃描的標記', countOf(hudSrc, 'data-testid="gate-bonds-notice"'), 1);
eq('F9 五個消耗品各有自己的提示標記',
  ['remedy', 'elixir', 'tonic', 'magicTent', 'elementalShard']
    .every((k) => hudSrc.includes(`testId="gate-consumable-${k}"`)), true);
eq('F10 咒語提示的標記帶索引（同名咒語不會撞在一起）',
  countOf(hudSrc, 'testId={`gate-spell-${idx}`}'), 1);

/* ────────────────────────────────────────────────────────────────
   G. SSR：畫得出來才算（對照組在 G3／G6／G9）
   ──────────────────────────────────────────────────────────────── */
// 道具點 0：五項全部不足
const noIp = bare();
noIp.currentIp = 0;
const htmlNoIp = render(noIp);
eq('G1 道具點 0 時大補藥顯示短少量', countOf(htmlNoIp, 'data-testid="gate-consumable-remedy"'), 1);
eq('G2 道具點 0 時短少量是 3（不是「不足」兩個字帶過）',
  /data-testid="gate-consumable-remedy"[^>]*data-short="3"/.test(htmlNoIp), true);

// 對照組：道具點充足時，五個提示一個都不能出現
const richIp = bare();
richIp.currentIp = 12;
const htmlRichIp = render(richIp);
eq('G3 道具點充足時五個提示全部消失（對照組）',
  ['remedy', 'elixir', 'tonic', 'magicTent', 'elementalShard']
    .map((k) => countOf(htmlRichIp, `data-testid="gate-consumable-${k}"`)), [0, 0, 0, 0, 0]);
// 這條證明 G3 不是「整個區塊都沒渲染」造成的假綠燈
eq('G4 道具點充足時那五顆按鈕仍然在畫面上',
  countOf(htmlRichIp, 'data-testid="hud-ip-consumables"'), 1);
eq('G5 道具點充足時按鈕上沒有 data-blocked',
  /data-testid="hud-ip-consumables"[\s\S]*?data-blocked="true"/.test(htmlRichIp), false);

// 咒語：拿一條真的咒語，把 MP 壓到它的成本以下
const sampleSpell = (rulesData.spells || []).find((s) => Number(s.mp) >= 5) || (rulesData.spells || [])[0];
const spellCost = Number(sampleSpell.mp);
const noMp = bare();
noMp.spells = [sampleSpell];
noMp.currentMp = 0;
const htmlNoMp = render(noMp, { initialTab: 'spells' });
eq('G6 MP 0 時咒語顯示短少量', countOf(htmlNoMp, 'data-testid="gate-spell-0"'), 1);
eq('G7 短少量等於那條咒語的成本', /data-testid="gate-spell-0"[^>]*data-short="(\d+)"/.exec(htmlNoMp)?.[1], String(spellCost));

// 對照組：MP 剛好等於成本（邊界）→ 不該出現
const exactMp = bare();
exactMp.spells = [sampleSpell];
exactMp.currentMp = spellCost;
const htmlExactMp = render(exactMp, { initialTab: 'spells' });
eq('G8 MP 剛好等於成本時不顯示短少量（邊界）', countOf(htmlExactMp, 'data-testid="gate-spell-0"'), 0);
// 證明 G8 不是「咒語清單根本沒渲染」
eq('G9 那條咒語確實畫在畫面上（否則 G8 是空的）',
  htmlExactMp.includes(sampleSpell.name), true);

// 羈絆：物語點 0 → 全域提示；有物語點 → 沒有提示
const noFp = bare();
noFp.fabulaPoints = 0;
noFp.bonds = [{ id: 'b1', target: '某人', feelings: ['admiration'], npcId: '' }];
const htmlNoFp = render(noFp, { initialTab: 'bonds' });
eq('G10 物語點 0 時羈絆頁顯示全域提示', countOf(htmlNoFp, 'data-testid="gate-bonds-notice"'), 1);
const withFp = bare();
withFp.fabulaPoints = 3;
withFp.bonds = noFp.bonds;
const htmlWithFp = render(withFp, { initialTab: 'bonds' });
eq('G11 有物語點時不顯示提示（對照組）', countOf(htmlWithFp, 'data-testid="gate-bonds-notice"'), 0);
eq('G12 有物語點時羈絆本身仍然畫得出來',
  htmlWithFp.includes('某人'), true);

// 提示元件自己：不該出現時回 null，不要留一個空的 span
eq('G13 沒被擋時元件回傳 null', UnavailableHint({ gate: g(5, 9) }), null);
eq('G14 沒有 gate 時回傳 null', UnavailableHint({ gate: null }), null);
const hintHtml = renderToStaticMarkup(React.createElement(UnavailableHint, { gate: g(5, 2), testId: 'x' }));
eq('G15 被擋時真的印出短少量', hintHtml.includes('差 3 MP'), true);

/* ────────────────────────────────────────────────────────────────
   H. 按下後的守衛沒有被拆（提示不是唯一依據）
   ──────────────────────────────────────────────────────────────── */
eq('H1 大補藥的守衛還在', countOf(hudSrc, "if (curIp < 3) { showToast('道具點不足 3 點（大補藥需 3 IP）'"), 1);
eq('H2 萬靈藥的守衛還在', countOf(hudSrc, "if (curIp < 3) { showToast('道具點不足 3 點（萬靈藥需 3 IP）'"), 1);
eq('H3 滋補藥的守衛還在', countOf(hudSrc, "if (curIp < 2) { showToast('道具點不足 2 點（滋補藥需 2 IP）'"), 1);
eq('H4 元素碎片的守衛還在', countOf(hudSrc, "if (curIp < 2) { showToast('道具點不足 2 點（元素碎片需 2 IP）'"), 1);
eq('H5 魔法帳篷的守衛還在', countOf(hudSrc, "if (curIp < 4) { showToast('道具點不足 4 點（魔法帳篷需 4 IP）'"), 1);
eq('H6 咒語的守衛還在', countOf(hudSrc, 'if (curMp < mpCost)'), 1);
eq('H7 儀式的守衛還在', countOf(hudSrc, 'if (curMp < finalMp)'), 1);
eq('H8 羈絆激勵的守衛還在', countOf(hudSrc, 'if ((character.fabulaPoints ?? 3) <= 0)'), 1);
eq('H9 八個守衛一個都沒少', [
  countOf(hudSrc, 'if (curIp < 3)'),
  countOf(hudSrc, 'if (curIp < 2)'),
  countOf(hudSrc, 'if (curIp < 4)'),
  countOf(hudSrc, 'if (curMp < mpCost)'),
  countOf(hudSrc, 'if (curMp < finalMp)'),
  countOf(hudSrc, 'if ((character.fabulaPoints ?? 3) <= 0)')
].reduce((a, b) => a + b, 0), 8);

/* ────────────────────────────────────────────────────────────────
   I. 這一輪仍然是零寫入
   ──────────────────────────────────────────────────────────────── */
const utilCode = stripComments(utilSrc);
eq('I1 判定模組不寫 localStorage', /localStorage|sessionStorage/.test(utilCode), false);
eq('I2 判定模組沒有 setter 形狀', /updateField|onChange|setState|writeJSON/.test(utilCode), false);
eq('I3 判定模組不產生 id 或時間戳（不是記錄，是判定）',
  /Date\.now|new Date|Math\.random/.test(utilCode), false);
eq('I4 提示元件不帶任何回呼（只印字）',
  /onClick|onChange|updateField/.test(stripComments(hintSrc)), false);

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
  console.log(`\n  按了才說不行，不是互動，是拒絕。`);
  console.log(`  但提示不能取代守衛——兩者講同一句話，只是先後不同。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
