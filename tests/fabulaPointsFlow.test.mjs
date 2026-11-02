/**
 * 物語點：有原因的寫入 ＋ 從履歷推導的明細（P12，2026-11-02）
 *
 * 執行：`npm run test:fpflow`
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者這一輪的三個裁定，這一支管第二個：「拆」——拆掉物語點的 `−`／`+` 步進器。
 *
 * 拆的理由不是「步進器不好用」，是**它寫出來的帳沒有原因**：
 * 書上七條用途裡三條要花 1 點（重擲／激勵羈絆／改變故事），價錢完全一樣，
 * 所以履歷上「消耗物語點 3 → 2」根本無法回答「那 1 點是為了什麼」。
 * 而擲骰器其實早就把原因傳進來了（`onSpendFp('引用特質重擲檢定')`），
 * 那句話以前只進了 toast。
 *
 * 拆成五個可驗的命題：
 *   1. 三格（點數／原因／現有）各自標紅，不是一句「請填寫完整」   → A 段
 *   2. 寫入是同一次（點數與履歷不會分岔）                          → B 段
 *   3. 原因真的寫進 `note`，而且**兩筆不會被合併吃掉一個原因**      → B 段
 *   4. 明細是履歷的另一個看法，不是第二份事實                      → C 段
 *   5. 畫面上真的沒有步進器了（減法要三件事一起驗）                → E 段
 */

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  FP_DEFAULT,
  FP_DIRECTIONS,
  FP_GAIN_PRESETS,
  FP_SPEND_PRESETS,
  applyFabulaPointsFlow,
  buildFabulaPointLedger,
  describeFabulaPointsFlow,
  describeFabulaPointsToast,
  resolveFabulaPoints
} from '../src/features/character-sheet/utils/fabulaPointsFlow.js';
import { FabulaPointsModalBody } from '../src/features/character-sheet/components/FabulaPointsModal.jsx';
import { LOG_KINDS } from '../src/features/character-sheet/utils/characterLog.js';

let results = [];
/** 值斷言：實際值與期望值真的相等才算過。 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const section = (title) => {
  results.push({ __section__: true, name: title });
};
const countOf = (hay, needle) => String(hay).split(needle).length - 1;

const ROOT = process.cwd();
// 掃原始碼的斷言一律先剝註解：這一輪的註解裡就寫著 `adjustFp(delta)`，
// 不剝的話「舊的東西還在不在」永遠為真（MEMORY §C.15）。
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readSrc = (rel) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const HUD = 'src/features/character-sheet/components/CharacterPlayHUD.jsx';

/* ────────────────────────────────────────────────────────────────
   A. describeFabulaPointsFlow：三格各自標紅
   ──────────────────────────────────────────────────────────────── */
section('A. 判定：三格各自回一個錯誤，不是一句「請填寫完整」');

eq('A1 正常的一筆（消耗 1 點，剩 2）',
  (({ ok, next, mathText }) => ({ ok, next, mathText }))(
    describeFabulaPointsFlow({ direction: FP_DIRECTIONS.spend, amount: 1, reason: '重擲', current: 3 })
  ),
  { ok: true, next: 2, mathText: '3 − 1 = 2' });

eq('A2 獲得也要算得出來（+2：投降那一條）',
  (({ ok, next, mathText }) => ({ ok, next, mathText }))(
    describeFabulaPointsFlow({ direction: FP_DIRECTIONS.gain, amount: 2, reason: '投降', current: 1 })
  ),
  { ok: true, next: 3, mathText: '1 + 2 = 3' });

// `''` 是「還沒填」，`0` 是「填了 0」。兩者都要擋，但講的話不一樣。
eq('A3 點數沒填 → 那一格自己說「請填寫點數」',
  describeFabulaPointsFlow({ direction: 'spend', amount: '', reason: '重擲', current: 3 }).errors.amount,
  '請填寫點數');
eq('A4 點數填 0 → 那一格自己說「要大於 0」',
  describeFabulaPointsFlow({ direction: 'spend', amount: 0, reason: '重擲', current: 3 }).errors.amount,
  '點數要大於 0');
eq('A5 原因空白 → 原因那一格自己說（不是底部一行）',
  describeFabulaPointsFlow({ direction: 'spend', amount: 1, reason: '   ', current: 3 }).errors.reason,
  '請寫下這 1 點是為了什麼');
eq('A6 只有空白的原因不算填了（trim 後才算）',
  describeFabulaPointsFlow({ direction: 'spend', amount: 1, reason: ' 重擲 ', current: 3 }).reason,
  '重擲');

// 不夠扣是**最常見**的失敗，而且它必須說出「只有幾點」——
// 只寫「點數不足」的話玩家還要去數卡片上的數字。
eq('A7 不夠扣時說出「只有幾點」（訊息裡帶實際值）',
  describeFabulaPointsFlow({ direction: 'spend', amount: 2, reason: '重擲', current: 1 }).errors.amount,
  '只有 1 點，不夠扣 2 點');
eq('A8 剛好扣完（1 點扣 1 點）可以，不是不足',
  describeFabulaPointsFlow({ direction: 'spend', amount: 1, reason: '重擲', current: 1 }).ok,
  true);

// 算式**不等 `ok`**：原因還沒填時，玩家仍然要看得到「扣完剩幾點」。
// （實機驗證抓到的：對話框一打開，算式那一格是 `—`，因為它被綁在 `ok` 上。）
eq('A8b 原因還沒填，算式照樣算得出來',
  describeFabulaPointsFlow({ direction: 'spend', amount: 1, reason: '', current: 3 }).mathText,
  '3 − 1 = 2');
// 但扣不夠時不寫算式——寫出來是負數，讀起來像「可以扣到 -1」。
eq('A8c 扣不夠時不寫算式（負數會誤導）',
  describeFabulaPointsFlow({ direction: 'spend', amount: 5, reason: '重擲', current: 3 }).mathText,
  '');

// `null`（不知道）與 `0`（知道，而且沒有）必須分開：
// 前者是資料還沒到，後者是「你不夠」。混成一句會讓舊存檔看起來像沒點數。
eq('A9 現有值 unknown（null）→ 講「尚未記錄」，不是「不夠」',
  describeFabulaPointsFlow({ direction: 'spend', amount: 1, reason: '重擲', current: null }).errors.current,
  '物語點尚未記錄，無法計算');
eq('A10 現有值 0 → 走「不夠扣」那一條，不是「尚未記錄」',
  [
    describeFabulaPointsFlow({ direction: 'spend', amount: 1, reason: '重擲', current: 0 }).errors.current,
    describeFabulaPointsFlow({ direction: 'spend', amount: 1, reason: '重擲', current: 0 }).errors.amount
  ],
  [undefined, '只有 0 點，不夠扣 1 點']);

// 建卡預設 3。`??` 不是 `||`：0 是合法值（2026-10-06 修過一次）。
eq('A11 缺欄位／null 才讀預設 3', [
  resolveFabulaPoints({}),
  resolveFabulaPoints({ fabulaPoints: null }),
  FP_DEFAULT
], [3, 3, 3]);
eq('A12 物語點 0 保持 0（不會被還原成 3）', resolveFabulaPoints({ fabulaPoints: 0 }), 0);
eq('A13 字串數字也讀得懂（存檔轉存過）', resolveFabulaPoints({ fabulaPoints: '2' }), 2);

/* ────────────────────────────────────────────────────────────────
   B. applyFabulaPointsFlow：同一次寫入 ＋ 原因進履歷
   ──────────────────────────────────────────────────────────────── */
section('B. 寫入：點數與履歷同一次完成，而且原因真的留下來');

const baseChar = { id: 'c1', fabulaPoints: 3, log: [] };
const spent = applyFabulaPointsFlow(baseChar, {
  direction: FP_DIRECTIONS.spend, amount: 1, reason: '引用特質重擲檢定'
});

eq('B1 寫入後點數是 2', spent.character.fabulaPoints, 2);
eq('B2 履歷多了一筆（kind: fp）',
  [spent.character.log.length, spent.character.log[0].kind], [1, 'fp']);
eq('B3 標題是「動了什麼」，note 是「為什麼」',
  [spent.character.log[0].title, spent.character.log[0].note],
  ['消耗物語點', '引用特質重擲檢定']);
eq('B4 前後值真的記下來（明細要靠它算餘額）',
  spent.character.log[0].changes, [{ field: 'fabulaPoints', from: 3, to: 2 }]);
eq('B5 不改到原本那個物件（純函式）', baseChar.fabulaPoints, 3);

// 失敗時**什麼都不寫**，而且回的是原本那個物件（`===`）：
// 回一個內容一樣的新物件會帶著新的 `updatedAt`，寫回去就是一次假的存檔。
const blocked = applyFabulaPointsFlow(baseChar, {
  direction: FP_DIRECTIONS.spend, amount: 5, reason: '重擲'
});
eq('B6 不夠扣時不寫入（連空記錄都沒有）',
  [blocked.ok, blocked.character === baseChar, baseChar.log.length], [false, true, 0]);

// 這一條是這次改動的核心：`fp` 的 coalesce 從 120000 改成 0。
// 合併的實作是「保留最新的 note、丟掉前一次的」——兩分鐘內重擲再激勵羈絆，
// 明細上就只剩一個原因，而那正是玩家要讀的那一行。
eq('B7 `fp` 不合併（coalesce 0）：合併會吃掉前一次的原因', LOG_KINDS.fp.coalesce, 0);

const twice = applyFabulaPointsFlow(
  applyFabulaPointsFlow(baseChar, { direction: 'spend', amount: 1, reason: '引用特質重擲檢定' }).character,
  { direction: 'spend', amount: 1, reason: '激勵羈絆【勇氣】' }
);
eq('B8 兩筆先後發生 → 兩筆都在，而且各帶各的原因',
  twice.character.log.map((e) => e.note),
  ['引用特質重擲檢定', '激勵羈絆【勇氣】']);
eq('B9 兩筆之後點數是 1', twice.character.fabulaPoints, 1);

/* ────────────────────────────────────────────────────────────────
   C. buildFabulaPointLedger：履歷的另一個看法
   ──────────────────────────────────────────────────────────────── */
section('C. 明細：從履歷推導（不新增欄位），新到舊，帶當時餘額');

const ledger = buildFabulaPointLedger(twice.character.log);
eq('C1 兩筆都在，而且新到舊', ledger.rows.map((r) => r.note),
  ['激勵羈絆【勇氣】', '引用特質重擲檢定']);
eq('C2 差額帶號（消耗是負的）', ledger.rows.map((r) => r.delta), [-1, -1]);
eq('C3 合計：消耗 2、獲得 0', [ledger.spent, ledger.gained], [2, 0]);
eq('C4 餘額是「那一筆之後」的，不是現在的',
  ledger.rows.map((r) => r.balance), [1, 2]);
eq('C5 筆數＝列數', ledger.count, 2);

// 差額 0 不算一筆：舊步進器夾在 0 邊界時會寫出「0 → 0」，
// 放進明細就是**一列右邊什麼都沒有的帳**。
eq('C6 差額 0 的記錄被跳過（不是畫成一列空白）',
  buildFabulaPointLedger([
    { id: 'x', at: '2026-11-02T00:00:00.000Z', kind: 'fp', title: '消耗物語點', changes: [{ field: 'fabulaPoints', from: 2, to: 2 }] }
  ]).count,
  0);
// 沒有前值就不知道差額——不要猜成 0（那會憑空生出一筆「獲得」）。
eq('C7 只有終值的殘缺記錄不算一筆',
  buildFabulaPointLedger([
    { id: 'y', at: '2026-11-02T00:00:00.000Z', kind: 'fp', title: '物語點', changes: [{ field: 'fabulaPoints', to: 3 }] }
  ]).count,
  0);
eq('C8 沒動到物語點的履歷不算（HP 的記錄不該出現在物語點明細）',
  buildFabulaPointLedger([
    { id: 'z', at: '2026-11-02T00:00:00.000Z', kind: 'hp', title: '承受傷害', changes: [{ field: 'currentHp', from: 10, to: 6 }] }
  ]).count,
  0);
eq('C9 空履歷回空帳（不是 crash）',
  buildFabulaPointLedger(null), { rows: [], spent: 0, gained: 0, count: 0 });

/* ────────────────────────────────────────────────────────────────
   D. toast：一句話講完三件事
   ──────────────────────────────────────────────────────────────── */
section('D. toast：做了什麼 → 動了多少 → 還剩多少');

eq('D1 消耗的 toast 帶原因與餘數',
  describeFabulaPointsToast(spent), '消耗【引用特質重擲檢定】−1 FP，餘 2');
eq('D2 獲得的 toast 用加號',
  describeFabulaPointsToast(applyFabulaPointsFlow(baseChar, {
    direction: FP_DIRECTIONS.gain, amount: 1, reason: '反派登場'
  })), '獲得【反派登場】+1 FP，餘 4');
eq('D3 失敗時不印（不要印一句什麼都沒發生的話）',
  describeFabulaPointsToast(blocked), '');

/* ────────────────────────────────────────────────────────────────
   E. 畫面：真的沒有步進器了（減法要三件事一起驗）
   ──────────────────────────────────────────────────────────────── */
section('E. 畫面：三顆按鈕長出來，步進器真的消失');

const hud = readSrc(HUD);
// 剝完註解要還讀得到內容——否則「什麼都沒掃到」與「掃到零個違規」長得一樣。
eq('E0 對照組：剝完註解後 hud 仍然是一份原始碼（長度 > 100000）',
  hud.length > 100000, true);

eq('E1 物語點卡上有三顆按鈕（獲得／消耗／明細）',
  ['fp-gain', 'fp-spend', 'fp-ledger'].filter((id) => !hud.includes(`data-testid="${id}"`)), []);
eq('E2 三顆按鈕接的是對的動作',
  [
    hud.includes('onClick={() => openFpFlow(FP_DIRECTIONS.gain)}'),
    hud.includes('onClick={() => openFpFlow(FP_DIRECTIONS.spend)}'),
    hud.includes('onClick={() => setIsFpLedgerOpen(true)}')
  ],
  [true, true, true]);

// 減法：舊的東西三件都要不在——舊函式、舊的步進器接線、舊的顯示寫法。
eq('E3 舊的 adjustFp 函式 0 次',
  countOf(hud, 'adjustFp'), 0);
eq('E4 舊的步進器接線 0 次',
  countOf(hud, 'onDelta={adjustFp}'), 0);
// scope 到「物語點卡那一段」為止（下一張卡是職業資源池）：
// 整份檔案裡 `<NumberStepper` 還有四顆（HP／MP／IP／EXP），不 scope 就一定假綠。
// 結束錨點用 `ClassResourceStrip`（程式碼），**不能用那一行的中文標題**——
// 它住在 JSX 註解裡，而上面已經先剝掉註解了，於是切片長度 0、
// 「裡面沒有 NumberStepper」永遠為真。E5 的第一格就是在擋這件事。
const fpCardStart = hud.indexOf('data-testid="fp-card"');
const fpCardEnd = hud.indexOf('<ClassResourceStrip', fpCardStart);
const fpCardBlock = fpCardStart === -1 || fpCardEnd === -1
  ? ''
  : hud.slice(fpCardStart, fpCardEnd);
eq('E5 物語點卡那一段沒有 <NumberStepper>（而且那一段真的抓到了）',
  [fpCardBlock.length > 200, fpCardBlock.includes('<NumberStepper')],
  [true, false]);

// 擲骰器的原因真的接到寫入了（不是只接到 toast）。
eq('E6 擲骰器的 onSpendFp 走 applyFpFlow 並把 reason 傳進去',
  [
    /onSpendFp:\s*\(reason\)\s*=>\s*\{[\s\S]{0,200}?applyFpFlow\(\{ direction: FP_DIRECTIONS\.spend, amount: 1, reason \}\)/.test(hud),
    /onGainFp:\s*\(reason\)\s*=>\s*\{[\s\S]{0,200}?applyFpFlow\(\{ direction: FP_DIRECTIONS\.gain, amount: 1, reason \}\)/.test(hud)
  ],
  [true, true]);
eq('E7 舊的「只進 toast」寫法 0 次（那句話以前就死在這裡）',
  countOf(hud, '（消耗 1 點物語點）'), 0);

// SSR 一次：靜態字串證明「有人寫過」，畫得出來才算（MEMORY §C.12）。
const modalHtml = renderToStaticMarkup(React.createElement(FabulaPointsModalBody, {
  theme: {},
  current: 3,
  onConfirm: () => {},
  onClose: () => {}
}));
eq('E8 對話框畫得出來：預設 1 點、算式、兩顆方向鍵',
  [
    modalHtml.includes('data-testid="fpflow-amount"'),
    modalHtml.includes('data-testid="fpflow-direction-spend"'),
    modalHtml.includes('data-testid="fpflow-math"'),
    modalHtml.includes('3 FP')
  ],
  [true, true, true, true]);
eq('E9 沒填原因時送出鍵是「擋住」的（aria-disabled，不是 disabled——disabled 會吃掉 title）',
  [
    modalHtml.includes('data-testid="fpflow-error-reason"'),
    modalHtml.includes('aria-disabled="true"'),
    /data-testid="fpflow-error-reason"[^>]*>請寫下這 1 點是為了什麼/.test(modalHtml)
  ],
  [true, true, true]);
eq('E10 快捷原因真的畫出來（三個消耗原因＝書上要花點的那三條）',
  FP_SPEND_PRESETS.filter((preset) => !modalHtml.includes(`data-testid="fpflow-preset-${preset}"`)),
  []);
eq('E11 獲得方向給的是「拿到點」的四條，不是花點的三條',
  [FP_GAIN_PRESETS.length, FP_GAIN_PRESETS.includes('引用特質重擲檢定')], [4, false]);

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
  console.log(`\n  1 點物語點做三件事，價錢一樣——所以留下原因才是那個功能本身。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
