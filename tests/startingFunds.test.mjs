/**
 * 起始資金的履歷（P11，2026-11-01）
 *
 * 執行：`npm run test:startingfunds`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者的原話（附一張開卡結果的截圖）：
 *   「這個是開卡過後的結果。我完全看不到我初始買了什麼，我2d6又得到了多少」
 *
 * 量到的現況：結算只寫**一筆** `kind: 'zenit'`，`changes` 是「500 → 390」。
 * 於是明細上只有一列 `-110z`，而 -110 這個數字：
 *   1. 不是任何一件東西的價格（那 110 是差額）；
 *   2. 把**骰到的錢抵銷掉了**（擲骰是加項，卻被混進同一個差額）。
 *
 * ── 這份測試的核心命題只有一句話 ──────────────────────────
 *
 * **每一筆的 `from` 必須是前一筆的 `to`。**
 *
 * 這是整條履歷唯一能「逐列對帳」的性質：鏈斷了，明細上就會出現兩個
 * 各自看起來都合理、加起來卻對不上錢包的數字——而那種錯在畫面上
 * 完全正常（每列都有金額、都有標題），只有拿計算機的人才會發現。
 * 所以 B3／D6／H2 都直接驗這條，而不是驗「有幾列」。
 *
 * ── 為什麼「開帳」是 `from: null` 而不是 `from: 0` ──────────
 *
 * 結算前角色身上沒有錢包（`zenit` 只是預算的佔位值）。寫 `from: 0` 等於
 * 斷言「他本來有 0z」——那是我們不知道的事。但反過來也不能讓**任何**
 * 只有終值的記錄都讀成開帳：舊寫法留下的淨額記錄若被讀成開帳，
 * 500z 的花費會變成 500z 的收入（`zenitFeedback.test.mjs` C14 是它的對照組）。
 *
 * ── 修補為什麼要有五道閘門 ────────────────────────────────
 *
 * 舊存檔的骰值只能用推導的：`2d6 × 10 = 結算後餘額 − 剩餘裝備預算`。
 * 但這個式子只在「裝備還是開卡那一套」時成立。玩家事後買過任何東西，
 * 推導出來的骰值就是**錯的**——而錯的骰值比沒有更糟，因為它看起來
 * 跟真的一模一樣。所以寧可少修一筆。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  resolveStartingEquipment,
  buildStartingFundsEntries,
  buildPrintedStartingFundsEntries,
  describeStartingFundsSettlement,
  repairStartingFundsLog,
  repairRosterStartingFunds,
  LEGACY_STARTING_FUNDS_TITLE,
  PRINTED_STARTING_FUNDS_TITLE
} from '../src/features/character-sheet/utils/startingFunds.js';
import { buildMoneyLedger, formatZenit } from '../src/features/character-sheet/utils/zenitFeedback.js';
import { appendLog, formatChange } from '../src/features/character-sheet/utils/characterLog.js';
import { MoneyLedgerModalBody } from '../src/features/character-sheet/components/MoneyLedgerModal.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import { createFreeformWeaponSpec, attachCustomWeapon } from '../src/features/character-sheet/data/customWeapons.js';
import { applyPreset } from '../src/features/character-sheet/utils/presetApply.js';
import { STARTER_PRESETS } from '../src/features/character-sheet/data/starterPresets.js';
import { EXPANSION_PRESETS } from '../src/features/character-sheet/data/expansionPresets.js';

let results = [];
/** 值斷言：實際值與期望值真的相等才算過（理由同 resourceFeedback.test.mjs）。 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};

const ROOT = process.cwd();
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readSrc = (rel) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const countOf = (hay, needle) => String(hay).split(needle).length - 1;

/** 角色工廠：預設是「剛開卡、還沒結算」的空白角色（預算 500z，五級）。 */
const mkChar = (over = {}) => ({ ...createNewCharacter(), ...over });

/** 只挑「動到錢」的條目——明細看的就是這些。 */
const zenitRows = (entries) => (Array.isArray(entries) ? entries : [])
  .filter((e) => Array.isArray(e?.changes) && e.changes.some((c) => c?.field === 'zenit'));

/**
 * 鏈連續：每一筆的 `from` 等於前一筆的 `to`（第一筆必須是開帳）。
 * 回傳**第一個斷掉的位置**（-1 表示沒斷）——只回布林的話，紅了也不知道斷在哪。
 */
const firstBreak = (entries) => {
  const rows = zenitRows(entries);
  if (rows.length === 0) return 0;
  if (rows[0].changes.find((c) => c.field === 'zenit').from !== null) return 0;
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1].changes.find((c) => c.field === 'zenit');
    const cur = rows[i].changes.find((c) => c.field === 'zenit');
    if (cur.from !== prev.to) return i;
  }
  return -1;
};

/* ────────────────────────────────────────────────────────────────
   A. resolveStartingEquipment：這隻角色開卡時買了什麼（推導）
   ──────────────────────────────────────────────────────────────── */

const bare = mkChar();
eq('A1 空裝備：什麼都沒買（不是 undefined，呼叫端不必判斷）',
  resolveStartingEquipment(bare), { items: [], extraSpend: 0, totalSpend: 0 });

const full = mkChar({
  equipment: { mainHand: '青銅劍', offHand: '戰弓', armor: '旅行皮甲', accessory: '' }
});
const fullRes = resolveStartingEquipment(full);
eq('A2 三個槽各一件 → 三筆，順序是主手／副手／防具（明細的閱讀順序）',
  fullRes.items.map((i) => [i.slot, i.name]),
  [['mainHand', '青銅劍'], ['offHand', '戰弓'], ['armor', '旅行皮甲']]);
eq('A3 每一件都帶履歷格式（標題「購入 X」＋說明含價格）',
  [fullRes.items[0].record.title, fullRes.items[0].record.note.includes(formatZenit(200))],
  ['購入 青銅劍', true]);
eq('A4 合計等於三件價格和（200 + 150 + 100）', fullRes.totalSpend, 450);

// 0z 的「無盾牌」「無裝甲」是空槽的替身，不是買來的東西。
// 把它們寫成一筆 0z 的履歷，明細上會出現「購入 無盾牌　0z」——那不是玩家做的決定。
const zeroSlot = mkChar({ equipment: { mainHand: '短匕首', offHand: '無盾牌', armor: '旅行皮甲' } });
const zeroRes = resolveStartingEquipment(zeroSlot);
eq('A5 0z 的空槽替身不列進履歷，也不計價',
  [zeroRes.items.map((i) => i.name), zeroRes.totalSpend], [['短匕首', '旅行皮甲'], 250]);

// 原書 p.164：起始裝備預算只算主手／副手／防具。飾品是稀有物品，不在預算裡。
// 這條如果鬆掉，買一條 500z 的腰帶就會讓「已花費」爆表，而玩家其實沒超支。
const withAccessory = mkChar({
  equipment: { mainHand: '短匕首', offHand: '', armor: '', accessory: '探險家腰帶' }
});
eq('A6 飾品不進起始預算（原書 p.164 只算三槽）',
  [resolveStartingEquipment(withAccessory).items.length,
    resolveStartingEquipment(withAccessory).totalSpend],
  [1, 150]);

// 開卡時買一把玩家自己寫的武器是合法的，而它不在書上的表裡。
// 只查書上的表 → 那筆錢憑空消失 → 明細會出現一筆沒有來源的差額。
const freeform = attachCustomWeapon(mkChar(), createFreeformWeaponSpec({
  name: '守墓人的鏽劍', category: '劍', range: '近戰', hands: 1,
  attr: 'DEX + MIG', damage: '【HR + 2】火', cost: 120, note: ''
}));
const freeformRes = resolveStartingEquipment({ ...freeform, equipment: { mainHand: '守墓人的鏽劍' } });
eq('A7 自訂武器用玩家填的價格（書上查不到也要算得進去）',
  [freeformRes.items.map((i) => i.name), freeformRes.totalSpend], [['守墓人的鏽劍'], 120]);

// 書上查不到的名字（打錯字、舊存檔）不能讓整份履歷炸掉，也不能計價。
const typo = mkChar({ equipment: { mainHand: '不存在的大劍', armor: '旅行皮甲' } });
eq('A8 查不到的裝備名不計價也不拋錯',
  [resolveStartingEquipment(typo).items.length, resolveStartingEquipment(typo).totalSpend], [1, 100]);

/* ────────────────────────────────────────────────────────────────
   B. buildStartingFundsEntries：一次結算寫成一串事件
   ──────────────────────────────────────────────────────────────── */

const SCENE = { budget: 500, items: fullRes.items, extraSpend: 0, totalSpend: 450, rollSum: 70, dice: [3, 4] };
const scene = buildStartingFundsEntries(SCENE);

// 開帳 ＋ 三件 ＋ 骰到的錢 ＝ 5 筆。這個數字本身就是「看得到買了什麼」的證明：
// 舊寫法這裡是 1 筆。
eq('B1 條目數 ＝ 開帳 1 ＋ 購買 3 ＋ 骰到的錢 1',
  zenitRows(scene.entries).length, 5);
eq('B2 第一筆是開帳：沒有前值，終值是裝備預算',
  [scene.entries[0].kind, scene.entries[0].changes[0].from, scene.entries[0].changes[0].to],
  ['creation', null, 500]);
// **這個檔案最重要的一條。**
eq('B3 每一筆的 from 都是前一筆的 to（明細才能逐列對帳）', firstBreak(scene.entries), -1);
eq('B4 每一筆都說得出「買了什麼」（不是「支出」「收入」）',
  scene.entries.map((e) => e.title),
  ['起始裝備預算', '購入 青銅劍', '購入 戰弓', '購入 旅行皮甲', LEGACY_STARTING_FUNDS_TITLE]);
// 使用者情境：500 − 450 ＋ 70 ＝ 120。
eq('B5 最終金額 ＝ 剩餘預算 ＋ 骰值', [scene.finalZenit, scene.spent], [120, 450]);

const lastChange = scene.entries[scene.entries.length - 1].changes[0];
// 舊寫法把「擲骰得到的錢」記成一個負的差額（因為它跟花費混在一起）。
// 骰到的錢是**收入**：這一條就是「我2d6又得到了多少」的答案。
eq('B6 骰到的錢是收入（差額為正，不是被抵銷成支出）',
  [lastChange.from, lastChange.to, lastChange.to - lastChange.from], [50, 120, 70]);
eq('B7 骰值寫進說明（事後對得了帳）',
  scene.entries[scene.entries.length - 1].note, '2d6（3 + 4）× 10 ＝ 70z');
// 舊存檔修補時骰值不可考，要說「未記錄」而不是編一個。
eq('B8 沒有骰值時照實說「未個別記錄」',
  buildStartingFundsEntries({ ...SCENE, dice: null }).entries.slice(-1)[0].note,
  '2d6 × 10 ＝ 70z（骰值未個別記錄）');

// 超支：錢不夠就沒有「一件一件買」的順序可言，硬列會出現負餘額，
// 而負餘額在畫面上看起來像程式壞了。
const over = buildStartingFundsEntries({
  budget: 500, items: fullRes.items, totalSpend: 900, rollSum: 70, dice: [1, 1]
});
eq('B9 超支只寫一筆，餘額停在 0，說明寫出超出多少',
  [zenitRows(over.entries).length, over.finalZenit,
    over.entries[1].title, over.entries[1].note.includes('超出預算 400z')],
  [3, 70, '購入起始裝備（共 3 件）', true]);

// 對帳補列：`items` 是「認得出名字的」，`totalSpend` 是權威合計（含魔晶石插槽）。
// 少了這一列，明細的合計會比畫面上的「已花費」少一截——看起來像漏記。
// 用 480（沒有超支）而不是 520：超過預算會走「超支」那一支，補列就永遠不會出現，
// 而「補列不存在」與「補列寫對了」在輸出上長得一樣（假綠燈，MEMORY §A.1）。
const gap = buildStartingFundsEntries({ ...SCENE, totalSpend: 480, extraSpend: 0, rollSum: 0 });
eq('B10 認不出名字的花費補一列，合計才對得上「已花費」',
  [gap.entries.some((e) => e.title === '其他起始裝備'), gap.spent], [true, 480]);
eq('B11 補列之後鏈仍然連續', firstBreak(gap.entries), -1);

// 0z 的品項如果混進來（呼叫端自己傳的），不能在履歷上留一列 0z 的購買。
const withZero = buildStartingFundsEntries({
  budget: 500,
  items: [{ slot: 'offHand', name: '無盾牌', cost: 0, record: { title: '購入 無盾牌', note: '' } }],
  totalSpend: 0, rollSum: 70, dice: [2, 5]
});
eq('B12 0z 品項不寫進履歷（那是空槽，不是買來的東西）',
  withZero.entries.map((e) => e.title), ['起始裝備預算', LEGACY_STARTING_FUNDS_TITLE]);

// 經典搭配走的是「原書印好的金額」，標題與說明都要能被覆寫——
// 否則履歷會說「他擲了 2d6」，而他其實只是套了一份官方配置。
const overridden = buildStartingFundsEntries({
  ...SCENE, rollSum: 70, rollTitle: PRINTED_STARTING_FUNDS_TITLE, rollNote: '原書印製'
});
eq('B13 標題與說明可以覆寫（經典搭配不是擲骰）',
  [overridden.entries.slice(-1)[0].title, overridden.entries.slice(-1)[0].note],
  [PRINTED_STARTING_FUNDS_TITLE, '原書印製']);

// 結算那一刻的說明（原生 alert）：同一串履歷換一種排版，
// 不維護第二份事實。只印「已結算為 120z」等於沒有回答使用者的問題。
eq('B14 結算說明逐件列出買了什麼、擲到多少',
  describeStartingFundsSettlement(scene.entries).split('\n'),
  ['起始裝備預算　500z',
    '− 青銅劍　200z　→ 餘 300z',
    '− 戰弓　150z　→ 餘 150z',
    '− 旅行皮甲　100z　→ 餘 50z',
    '＋ 擲起始資金 2d6 × 10　70z　→ 餘 120z']);
eq('B15 沒有條目時回空字串（呼叫端不必判斷）',
  describeStartingFundsSettlement([]), '');

/* ────────────────────────────────────────────────────────────────
   C. 使用者情境：那張截圖上應該看到什麼
   ──────────────────────────────────────────────────────────────── */

const settled = appendLog(
  mkChar({ equipment: { mainHand: '青銅劍', offHand: '戰弓', armor: '旅行皮甲', accessory: '' } }),
  scene.entries
);
const settledLog = zenitRows(settled.log);
const ledger = buildMoneyLedger(settled.log);

eq('C1 履歷上真的留下 5 筆（不是只有一筆差額）', settledLog.length, 5);
eq('C2 累計收入 ＝ 預算 500 ＋ 骰到的 70（不是把骰值抵銷掉）', ledger.income, 570);
eq('C3 累計支出 ＝ 三件裝備 450（不是 -110 那種淨額）', ledger.expense, 450);
eq('C4 明細的每一列都說得出買了什麼',
  ledger.rows.map((r) => r.title).filter((t) => t.startsWith('購入 ')),
  ['購入 旅行皮甲', '購入 戰弓', '購入 青銅劍']);
// 履歷（不是明細）那一頁也讀得懂：開帳不能印成「資金 （空） → 500」。
eq('C5 履歷把開帳寫成「開帳 500」，不是「（空） → 500」',
  formatChange({ field: 'zenit', from: null, to: 500 }), '資金 開帳 500');
// 對照組：其他欄位真的「本來是空的」時，仍然要印「（空）」。
eq('C6 對照組：其他欄位沒有前值時仍然印「（空）」',
  formatChange({ field: 'identity', from: null, to: '流浪者' }), '身分 （空） → 流浪者');

/* ────────────────────────────────────────────────────────────────
   D. 舊存檔修補：五道閘門
   ──────────────────────────────────────────────────────────────── */

const LEGACY_AT = '2026-10-01T12:00:00.000Z';
/** 舊寫法留下的角色：三件裝備（450）＋ 骰 70 → 錢包 120。 */
const legacyChar = (over = {}) => mkChar({
  equipment: { mainHand: '青銅劍', offHand: '戰弓', armor: '旅行皮甲', accessory: '' },
  zenit: 120,
  startingFundsRolled: true,
  log: [{
    id: 'legacy-1', at: LEGACY_AT, kind: 'zenit', title: LEGACY_STARTING_FUNDS_TITLE,
    changes: [{ field: 'zenit', from: 500, to: 120 }], note: ''
  }],
  ...over
});

// 閘門 1：還沒結算的角色沒有「舊結算」可修。
const notSettled = legacyChar({ startingFundsRolled: false });
eq('D1 還沒結算的角色不動（回傳同一個物件）', repairStartingFundsLog(notSettled) === notSettled, true);

// 閘門 2：事後買過東西 → 裝備已經不是開卡那一套 → 推導出來的骰值會是錯的。
const shopped = legacyChar({
  log: [
    { id: 'l1', at: LEGACY_AT, kind: 'zenit', title: LEGACY_STARTING_FUNDS_TITLE,
      changes: [{ field: 'zenit', from: 500, to: 120 }] },
    { id: 'l2', at: '2026-10-02T12:00:00.000Z', kind: 'trade', title: '購入 藥水',
      changes: [{ field: 'zenit', from: 120, to: 100 }] }
  ]
});
eq('D2 履歷裡已經有別的錢的變動時不動（推導會推出錯的骰值）',
  repairStartingFundsLog(shopped) === shopped, true);

// 閘門 3：只認舊寫法那個標題。別的 zenit 記錄（玩家自己記的收支）不是結算。
const otherTitle = legacyChar({
  log: [{ id: 'l1', at: LEGACY_AT, kind: 'zenit', title: '任務報酬',
    changes: [{ field: 'zenit', from: 500, to: 120 }] }]
});
eq('D3 標題不是舊結算時不動', repairStartingFundsLog(otherTitle) === otherTitle, true);

// 閘門 4：前值必須等於規則的起始預算，否則那個 from 是「某個錢包」不是預算。
const notBudget = legacyChar({
  log: [{ id: 'l1', at: LEGACY_AT, kind: 'zenit', title: LEGACY_STARTING_FUNDS_TITLE,
    changes: [{ field: 'zenit', from: 300, to: 120 }] }]
});
eq('D4 前值不是起始預算時不動', repairStartingFundsLog(notBudget) === notBudget, true);

// 閘門 5：推導出來的骰值必須落在 2d6 × 10 的可能值裡（20–120，10 的倍數）。
const badRoll = legacyChar({
  zenit: 700,
  log: [{ id: 'l1', at: LEGACY_AT, kind: 'zenit', title: LEGACY_STARTING_FUNDS_TITLE,
    changes: [{ field: 'zenit', from: 500, to: 700 }] }]
});
eq('D5 推導出的骰值超出 2d6 範圍時不動（300 不是 2d6 × 10）',
  repairStartingFundsLog(badRoll) === badRoll, true);

// 正常情況：換成一串。
const repaired = repairStartingFundsLog(legacyChar());
eq('D6 修好之後是完整的一串，而且鏈連續',
  [zenitRows(repaired.log).length, firstBreak(repaired.log)], [5, -1]);
eq('D7 修好之後最後一筆的終值等於原本的錢包（對帳對得上）',
  zenitRows(repaired.log).slice(-1)[0].changes[0].to, 120);
eq('D8 修補不改錢包金額', repaired.zenit, 120);
// 修補不該讓這件事看起來發生在「現在」——時間戳沿用原本那一筆。
eq('D9 沿用原本的時間戳（不是修補當下的時間）',
  zenitRows(repaired.log).map((e) => e.at), Array(5).fill(LEGACY_AT));
// 冪等：下一次載入不該再修一次（否則每開一次就多五筆）。
eq('D10 再跑一次回傳同一個物件（冪等）',
  repairStartingFundsLog(repaired) === repaired, true);

/* ────────────────────────────────────────────────────────────────
   E. 名冊層：載入時自己修好
   ──────────────────────────────────────────────────────────────── */

const cleanRoster = [mkChar(), mkChar()];
eq('E1 沒有人需要修時回傳同一個陣列（不必重繪）',
  repairRosterStartingFunds(cleanRoster) === cleanRoster, true);

const mixedRoster = [mkChar(), legacyChar()];
const fixedRoster = repairRosterStartingFunds(mixedRoster);
eq('E2 有一支要修時回傳新陣列，沒事的那些原樣保留',
  [fixedRoster !== mixedRoster, fixedRoster[0] === mixedRoster[0],
    zenitRows(fixedRoster[1].log).length],
  [true, true, 5]);
eq('E3 不是陣列也不炸', repairRosterStartingFunds(null), null);

/* ────────────────────────────────────────────────────────────────
   F. 原始碼護欄：唯一入口
   ──────────────────────────────────────────────────────────────── */

const editorSrc = readSrc('src/features/character-sheet/components/CharacterEditor.jsx');
const presetSrc = readSrc('src/features/character-sheet/utils/presetApply.js');
const sheetSrc = readSrc('src/features/character-sheet/CharacterSheet.jsx');
const fundsSrc = readSrc('src/features/character-sheet/utils/startingFunds.js');

// 編輯器以前自己拼 `changes: [{ field: 'zenit', from: budget, to: final }]`，
// 那正是「-110z」的來源。現在它只能呼叫建構器。
eq('F1 編輯器不再自己拼金錢變更（走建構器）',
  [countOf(editorSrc, 'buildStartingFundsEntries('), countOf(editorSrc, "field: 'zenit'")],
  [1, 0]);
eq('F2 經典搭配也留下同一種履歷（不是只寫一個 zenit 數字）',
  [countOf(presetSrc, 'buildPrintedStartingFundsEntries('), countOf(presetSrc, 'startingFundsRolled: true')],
  [1, 1]);
eq('F3 名冊載入時會修舊存檔', countOf(sheetSrc, 'repairRosterStartingFunds('), 1);
// 結算當下也要說得出買了什麼（明細是事後才翻的，結算那一刻只有這一行字）。
eq('F3-b 編輯器的結算說明走同一串履歷（不是另寫一段文案）',
  countOf(editorSrc, 'describeStartingFundsSettlement(entries)'), 1);
// 只有一個地方能產生「沒有前值」的變更。多一個地方就多一種開帳語意。
eq('F4 「開帳」只有一個產生點（`from: null` 只寫在建構器裡）',
  [countOf(fundsSrc, 'from: null'), countOf(editorSrc, 'from: null'), countOf(presetSrc, 'from: null')],
  [1, 0, 0]);

/* ────────────────────────────────────────────────────────────────
   G. 明細畫得出來：真的看得到「買了什麼」與「2d6 得到多少」
   ──────────────────────────────────────────────────────────────── */

const cellText = (html, testid) => {
  const at = html.indexOf(`data-testid="${testid}"`);
  if (at < 0) return '';
  const start = html.indexOf('>', at) + 1;
  const end = html.indexOf('</span>', start);
  return html.slice(start, end === -1 ? start : end).replace(/<[^>]*>/g, '');
};
const ledgerHtml = renderToStaticMarkup(React.createElement(MoneyLedgerModalBody, {
  theme: {}, character: { zenit: 120, log: settled.log }, onClose: () => {}
}));

// 三種標題都要看得到：這是「看得到我買了什麼」的字面答案。
eq('G1 明細上三種列都印得出來（預算／逐件購買／骰到的錢）',
  [ledgerHtml.includes('起始裝備預算'), ledgerHtml.includes('購入 青銅劍'),
    ledgerHtml.includes(LEGACY_STARTING_FUNDS_TITLE)],
  [true, true, true]);
eq('G2 骰值印在說明裡（「2d6（3 + 4）× 10 ＝ 70z」）',
  ledgerHtml.includes('2d6（3 + 4）× 10 ＝ 70z'), true);
eq('G3 三格合計：餘額 120／收入 570／支出 450',
  [cellText(ledgerHtml, 'ledger-balance'), cellText(ledgerHtml, 'ledger-income'),
    cellText(ledgerHtml, 'ledger-expense')],
  ['120z', '+570z', '-450z']);
// 每一列右邊的「餘」是那一筆之後的餘額，逐列遞減／遞增。
// 這條如果只驗「有印數字」，把餘額全印成現在的錢包也會過。
eq('G4 逐列的餘額是「那一筆之後」（不是每一列都印現在的錢包）',
  ledger.rows.map((r) => r.balance), [120, 50, 150, 300, 500]);
eq('G5 五列都在（不是畫一個空清單）', ledger.count, 5);

/* ────────────────────────────────────────────────────────────────
   H. 經典職業搭配：83 組逐一驗
   ──────────────────────────────────────────────────────────────── */

const ALL_PRESETS = [...STARTER_PRESETS, ...EXPANSION_PRESETS];
// 逐一驗，不是「至少有一組成立」。清單型斷言守不住「漏掉」——
// 只要有一組的裝備與原書印的金額對不上，這裡就必須紅。
const presetMismatch = ALL_PRESETS.filter((preset) => {
  const applied = applyPreset(mkChar(), preset);
  return applied.zenit !== preset.zenit;
}).map((p) => p.id);
eq(`H1 每一組套用後錢包都等於原書印的金額（共 ${ALL_PRESETS.length} 組）`, presetMismatch, []);

// 套用之後履歷也要有東西：開帳 ＋ 逐件 ＋ 起始資金。
// 舊版這裡是 0 筆——錢包裡有數字，履歷裡什麼都沒有。
const presetChainBad = ALL_PRESETS.filter((preset) => {
  const applied = applyPreset(mkChar(), preset);
  const rows = zenitRows(applied.log);
  const { items } = resolveStartingEquipment(applied);
  const titles = rows.map((e) => e.title);
  return firstBreak(applied.log) !== -1
    || rows.length < items.length + 1
    || !titles.includes('起始裝備預算')
    || !titles.some((t) => t === PRINTED_STARTING_FUNDS_TITLE);
}).map((p) => p.id);
eq('H2 每一組都留下 預算 → 逐件 → 起始資金 的一串（而且鏈連續）', presetChainBad, []);

// 已經結算過的角色再套用搭配，是**覆寫錢包**，不是重新開卡。
// 寫成購買履歷會憑空多出他其實沒買的東西，所以只留一筆。
const settledChar = mkChar({ zenit: 999, startingFundsRolled: true });
const reapplied = applyPreset(settledChar, STARTER_PRESETS[0]);
const reappliedRows = zenitRows(reapplied.log);
eq('H3 已結算的角色再套用：只寫一筆「套用經典搭配」，不假裝他重新買過',
  [reappliedRows.length, reappliedRows[0].title.includes('套用經典搭配'),
    reappliedRows[0].changes[0].from, reappliedRows[0].changes[0].to],
  [1, true, 999, STARTER_PRESETS[0].zenit]);

/* ────────────────────────────────────────────────────────────────
   Z. 斷言器自我體檢
   ──────────────────────────────────────────────────────────────── */
const before = results.length;
eq('__selfcheck__', 1, 2);
const selfOk = results.length === before + 1 && results[results.length - 1].ok === false;
results.pop();
eq('Z1 斷言器本身會紅（餵不相等的值必須回 false）', selfOk, true);
// 輔助函式也要體檢：`firstBreak` 對「斷掉的鏈」必須回得出位置，
// 否則 B3／D6／H2 會全部恆綠（而它們是本檔的主命題）。
const brokenChain = [
  { kind: 'creation', title: 'a', changes: [{ field: 'zenit', from: null, to: 500 }] },
  { kind: 'trade', title: 'b', changes: [{ field: 'zenit', from: 400, to: 300 }] }
];
eq('Z2 鏈斷掉時 firstBreak 指得出位置（不是永遠 -1）', firstBreak(brokenChain), 1);
eq('Z3 空履歷也回得出位置（0，不是 -1）', firstBreak([]), 0);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  「看不到買了什麼」不是文案問題，是履歷裡沒有那件事。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
