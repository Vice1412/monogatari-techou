/**
 * 擲骰留痕（P8，2026-10-31）
 *
 * 這一輪的起點是一個量測：履歷有 16 種 kind，`DiceRollerModal` 的寫回是 **0 處**。
 * 跑團最高頻的動作，一筆都沒記。
 *
 * 測試分四層，缺一層就會有一種「看起來對了」的假象：
 *   A 判定（哪一擲值得自動記）—— 純函式，最容易被寫成 truthy 而放過髒資料
 *   B 格式化（標題／備註）—— 字串比對，錯字與多餘空白都看得見
 *   C 封閉詞彙（`LOG_KINDS.dice`）—— 沒登記就拒收，這是履歷的閘門
 *   D 接線（擲骰器有沒有真的回報、HUD 有沒有真的寫）—— 原始碼形狀
 *
 * ※ D 段驗的是「有人寫過」，不是「畫得出來」——畫得出來由實機腳本負責。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LOG_KINDS,
  createLogEntry,
  appendLog,
  getLog
} from '../src/features/character-sheet/utils/characterLog.js';
import {
  shouldAutoRecordRoll,
  describeRollOutcome,
  buildRollRecord
} from '../src/features/character-sheet/utils/rollRecord.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const countOf = (src, needle) => src.split(needle).length - 1;

let pass = 0;
let total = 0;
const failures = [];

const check = (name, ok, detail = '') => {
  total += 1;
  if (ok) {
    pass += 1;
  } else {
    failures.push(`${name}${detail ? `　→ ${detail}` : ''}`);
  }
};

const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `實際 ${a}／期望 ${e}`);
};

/** 一顆普通的骰（既不 Critical 也不 Fumble） */
const plain = (over = {}) => ({
  die1: 5,
  die2: 6,
  modifier: 3,
  total: 14,
  hr: 6,
  isCritical: false,
  isFumble: false,
  ...over
});

/* ══════════════════════════════════════════════════════════════
   A. 判定：哪一擲值得自動記
   ══════════════════════════════════════════════════════════════ */

eq('A1 大成功要自動記', shouldAutoRecordRoll(plain({ isCritical: true })), true);
eq('A2 大失敗要自動記', shouldAutoRecordRoll(plain({ isFumble: true })), true);
eq('A3 普通檢定不自動記', shouldAutoRecordRoll(plain()), false);
eq('A4 null 不自動記', shouldAutoRecordRoll(null), false);
eq('A5 undefined 不自動記', shouldAutoRecordRoll(undefined), false);
eq('A6 空物件不自動記', shouldAutoRecordRoll({}), false);

// 只認布林 true。`isCritical: 'false'` 是字串，truthy——用 `if (outcome.isCritical)`
// 會把「不是大成功」記成「大成功」，而履歷一旦寫錯就不會自己更正。
eq('A7 字串 "false" 不算大成功（不用 truthy 判斷）',
  shouldAutoRecordRoll(plain({ isCritical: 'false' })), false);
eq('A8 數字 1 不算大成功（只認布林 true）',
  shouldAutoRecordRoll(plain({ isCritical: 1 })), false);
eq('A9 明確的 false 不算', shouldAutoRecordRoll(plain({ isCritical: false })), false);

/* ══════════════════════════════════════════════════════════════
   B. 標籤與格式化
   ══════════════════════════════════════════════════════════════ */

eq('B1 大成功的標籤', describeRollOutcome(plain({ isCritical: true })), '大成功');
eq('B2 大失敗的標籤', describeRollOutcome(plain({ isFumble: true })), '大失敗');
eq('B3 普通檢定沒有標籤（不該多一個沒意義的詞）', describeRollOutcome(plain()), '');
eq('B4 null 回空字串', describeRollOutcome(null), '');
eq('B5 字串 "true" 不算大成功', describeRollOutcome(plain({ isCritical: 'true' })), '');

const rec1 = buildRollRecord(plain(), { label: 'DEX + INS', die1Type: 8, die2Type: 8 });
eq('B6 標題帶檢定名稱與總值', rec1?.title, '【DEX + INS】14');
eq('B7 備註帶每顆骰面、加值與 HR', rec1?.note, 'd8 5 d8 6 +3 = 14 · HR 6');

const recCrit = buildRollRecord(plain({ isCritical: true, total: 18, die1: 9, die2: 9, hr: 9 }), {
  label: 'MIG + MIG', die1Type: 10, die2Type: 10
});
eq('B8 大成功的標題把「大成功」寫進去', recCrit?.title, '【MIG + MIG】大成功 18');
eq('B9 大成功的備註仍然記骰面', recCrit?.note, 'd10 9 d10 9 +3 = 18 · HR 9');

const recNoLabel = buildRollRecord(plain(), { die1Type: 8, die2Type: 8 });
eq('B10 沒有檢定名稱時不長出空括號', recNoLabel?.title, '14');

// 羈絆加值要併進「報出來的數字」——玩家在桌上說的是 16，不是「14 加 2」。
const recBond = buildRollRecord(plain(), {
  label: 'WLP + WLP', die1Type: 8, die2Type: 8, fpBonus: 2, bondName: '灰燼'
});
eq('B11 羈絆加值併入總值', recBond?.title, '【WLP + WLP】16');
eq('B12 羈絆加值與對象都寫進備註', recBond?.note, 'd8 5 d8 6 +3 羈絆+2（灰燼） = 16 · HR 6');

// 負加值不能印成「+ -3」
const recNeg = buildRollRecord(plain({ modifier: -3, total: 8 }), { die1Type: 8, die2Type: 8 });
eq('B13 負加值印成 -3 而不是 + -3', recNeg?.note, 'd8 5 d8 6 -3 = 8 · HR 6');

const recZeroMod = buildRollRecord(plain({ modifier: 0, total: 11 }), { die1Type: 8, die2Type: 8 });
eq('B14 加值為 0 時不寫 +0（雜訊）', recZeroMod?.note, 'd8 5 d8 6 = 11 · HR 6');

// 壞資料不寫空記錄
eq('B15 total 不是數字就回 null', buildRollRecord(plain({ total: 'abc' })), null);
eq('B16 total 是 NaN 就回 null', buildRollRecord(plain({ total: Number.NaN })), null);
eq('B17 null outcome 回 null', buildRollRecord(null), null);
eq('B18 缺 hr 時不印「HR undefined」',
  buildRollRecord(plain({ hr: undefined }), { die1Type: 8, die2Type: 8 })?.note,
  'd8 5 d8 6 +3 = 14');
eq('B19 缺骰面時不印「d8 undefined」',
  buildRollRecord(plain({ die1: undefined, die2: undefined }), { die1Type: 8, die2Type: 8 })?.note,
  '+3 = 14 · HR 6');
eq('B20 沒有骰階時用「骰」代替，不印 dnull',
  buildRollRecord(plain(), {})?.note, '骰 5 骰 6 +3 = 14 · HR 6');

// 重擲：大成功之後玩家仍可能花 FP 重擲（Core p.46），那會讓「大成功」變成歷史
// 而不是結果。標題必須寫得出來「這是重擲」，否則履歷上兩筆看起來一樣。
const recReroll = buildRollRecord(plain({ total: 12, die1: 4, die2: 5, hr: 5 }), {
  label: 'DEX + INS', die1Type: 8, die2Type: 8, reroll: true
});
eq('B21 重擲的標題寫「重擲」', recReroll?.title, '【DEX + INS】重擲 12');
eq('B22 重擲結果普通時不帶大成功／大失敗', /大成功|大失敗/.test(recReroll?.title || ''), false);
eq('B23 重擲的備註照樣記骰面', recReroll?.note, 'd8 4 d8 5 +3 = 12 · HR 5');
eq('B24 reroll 只認布林 true（字串不算）',
  buildRollRecord(plain({ total: 12 }), { reroll: 'true' })?.title, '12');

/* ══════════════════════════════════════════════════════════════
   C. 封閉詞彙：履歷的閘門
   ══════════════════════════════════════════════════════════════ */

check('C1 LOG_KINDS 有 dice（沒登記就一律拒收）', Boolean(LOG_KINDS.dice));
eq('C2 dice 的顯示名稱是純中文', LOG_KINDS.dice?.label, '擲骰');
eq('C3 dice 不合併（兩次擲骰是兩件事）', LOG_KINDS.dice?.coalesce, 0);
eq('C4 dice 有圖示', typeof LOG_KINDS.dice?.icon, 'string');

// 反向控制：如果哪天有人「順手」把 dice 刪掉，C1 會紅——但也要確認拒收真的會發生，
// 否則「有登記」與「登記了卻沒作用」分不出來。
eq('C5 未登記的 kind 會被拒收（反向控制）', createLogEntry({ kind: 'notAKind', title: 'x' }), null);
eq('C6 已登記的 dice 只有標題也成立',
  createLogEntry({ kind: 'dice', title: '【DEX】大成功 18' })?.kind, 'dice');

/* ══════════════════════════════════════════════════════════════
   D. 寫進履歷之後：只動 log，不動別的
   ══════════════════════════════════════════════════════════════ */

const baseChar = {
  id: 'c1',
  name: '灰燼',
  currentHp: 40,
  currentMp: 20,
  fabulaPoints: 3,
  log: []
};

const entry = createLogEntry({
  kind: 'dice',
  title: '【DEX + INS】大成功 18',
  note: 'd10 9 d10 9 +3 = 18 · HR 9'
});
const afterLog = appendLog(baseChar, entry);

eq('D1 履歷多了一筆', getLog(afterLog).length, 1);
eq('D2 新記錄的 kind 是 dice', getLog(afterLog)[0]?.kind, 'dice');
eq('D3 新記錄帶備註', getLog(afterLog)[0]?.note, 'd10 9 d10 9 +3 = 18 · HR 9');

// 擲骰**不改變任何數值**。這一條是「留痕不是副作用」的證明：
// 如果哪天有人順手在 recordRoll 裡扣了什麼，這裡會紅。
eq('D4 HP 沒被動到', afterLog.currentHp, 40);
eq('D5 MP 沒被動到', afterLog.currentMp, 20);
eq('D6 物語點沒被動到', afterLog.fabulaPoints, 3);
eq('D7 姓名沒被動到', afterLog.name, '灰燼');
eq('D8 原物件沒有被就地修改（append-only）', baseChar.log.length, 0);

// 兩次擲骰不合併（coalesce: 0）——合併會吃掉「哪一次大成功」
const two = appendLog(afterLog, createLogEntry({ kind: 'dice', title: '【MIG】大失敗 4' }));
eq('D9 兩次擲骰是兩筆（不被 coalesce 吃掉）', getLog(two).length, 2);
eq('D10 兩筆的標題都在', getLog(two).map((e) => e.title), ['【DEX + INS】大成功 18', '【MIG】大失敗 4']);

/* ══════════════════════════════════════════════════════════════
   E. 接線：擲骰器有沒有真的回報、HUD 有沒有真的寫
   ══════════════════════════════════════════════════════════════ */

const modalSrc = read('src/features/dice-roller/DiceRollerModal.jsx');
const hudSrc = read('src/features/character-sheet/components/CharacterPlayHUD.jsx');
const utilSrc = read('src/features/character-sheet/utils/rollRecord.js');

// 掃原始碼的斷言一律**先去註解**：本專案的註解經常在解釋那些識別字本身
// （「判定在 rollRecord.js」「`auto: true` 只表示…」），不去註解就會把說明文字
// 當成實作——E2／E11 第一次就是這樣紅的，而那種紅會讓人以為程式寫錯了。
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const modalCode = stripComments(modalSrc);
const hudCode = stripComments(hudSrc);
const utilCode = stripComments(utilSrc);

check('E1 擲骰器從 config 取 onRecordRoll', countOf(modalCode, 'initialConfig?.onRecordRoll') === 1);
check('E2 擲骰器在擲完後回報（auto: true）', countOf(modalCode, 'auto: true') === 1);
check('E3 擲骰器有手動「記下這一擲」的按鈕', countOf(modalCode, 'data-testid="roll-record"') === 1);
check('E4 大成功／大失敗顯示「已自動記入」而不是按鈕',
  countOf(modalCode, 'data-testid="roll-recorded-auto"') === 1);
// 兩處都要：① 玩家按「記下這一擲」② 重擲（重擲也已經記了一筆，按鈕就該消失）。
// 只寫 `>= 1` 的話，刪掉其中一處照樣綠——那正是這條要守的東西。
check('E5 手動記錄與重擲後都會隱藏按鈕（兩處）',
  countOf(modalCode, 'setManualRecorded(true)') === 2);
// `disabled` 會吃掉 title、也讓鍵盤使用者被跳過——本專案一律不用它做「不能用」。
check('E6 手動記錄的按鈕不用 disabled 表達狀態',
  countOf(modalCode, 'disabled={manualRecorded}') === 0);

check('E7 HUD 有 recordRoll', countOf(hudCode, 'const recordRoll = (outcome, info = {})') === 1);
check('E8 HUD 把 recordRoll 傳進擲骰器', countOf(hudCode, 'onRecordRoll: recordRoll') === 1);
check('E9 HUD 用 kind: dice 寫履歷', countOf(hudCode, "kind: 'dice'") === 1);
// 判定只有一份：HUD 用 shouldAutoRecordRoll，擲骰器不 import 它（避免跨 feature 兩份判定）
check('E10 HUD 的判定走單一入口', countOf(hudCode, 'shouldAutoRecordRoll(outcome)') === 1);
check('E11 擲骰器不 import 業務模組（判定留在業務層）',
  countOf(modalCode, 'rollRecord') === 0);

// 跨 modal 生命週期的閉包陷阱：config 裡的 callback 必須讀 ref，不能讀閉包
check('E12 HUD 有 characterRef', countOf(hudCode, 'characterRef.current = character') === 1);
check('E13 adjustFp 讀 ref（不是閉包）', countOf(hudCode, 'const latest = characterRef.current;') >= 2);
check('E14 recordRoll 也讀 ref', /const recordRoll[\s\S]{0,900}characterRef\.current/.test(hudCode));

// 純函式模組不該有副作用
eq('E15 rollRecord 模組沒有任何寫入', /localStorage|sessionStorage|writeFile|onChange/.test(utilCode), false);
eq('E16 rollRecord 模組不 import React', /from 'react'/.test(utilCode), false);
// 對照組：去註解之後檔案還是有內容的（否則上面兩條會因為「什麼都沒有」而全綠）
check('E17 去註解後仍有實際程式碼（對照組）', utilCode.includes('buildRollRecord') && utilCode.length > 400);

// 重擲也要回報：只記第一次的話，履歷上會永遠留著一個已經不成立的大成功。
check('E18 重擲會回報（reroll: true）', countOf(modalCode, 'reroll: true') === 1);
check('E19 HUD 把 reroll 傳給格式化', countOf(hudCode, 'reroll: info.reroll === true') === 1);
check('E20 重擲的回報不是 auto（玩家主動的戰術決定，一律留痕）',
  /onRecordRoll\(outcome, \{[\s\S]{0,200}?auto: false,[\s\S]{0,60}?reroll: true/.test(modalCode));

// 同一輪事件裡連續寫兩次（重擲＝先扣 FP、再寫履歷）時，第二次不能讀到「這一輪開始前」
// 的角色。`commit` 同步更新 ref，是所有寫入的唯一出口。
check('E21 有 commit（同步更新 ref 的寫入出口）',
  countOf(hudCode, 'const commit = (next) =>') === 1);
// 逐一具名，不數總數：數「commit( 出現幾次」的話，三個出口砍掉一個、
// 只要別處多一個，總數照樣過關。
check('E22 updateField 走 commit',
  countOf(hudCode, 'commit(meta ? loggableChange(before, base, meta) : base)') === 1);
check('E23 adjustFp 走 commit（扣 FP 是 modal 內會連續觸發的寫入）',
  countOf(hudCode, 'commit(loggableChange(latest, base, {') === 1);
check('E24 recordRoll 走 commit（重擲＝同一輪事件裡先扣 FP 再寫履歷）',
  countOf(hudCode, 'commit(loggableChange(latest, latest, {') === 1);

/* ══════════════════════════════════════════════════════════════
   Z. 自檢：斷言器自己要先能紅
   ══════════════════════════════════════════════════════════════ */

// 自檢：eq 對不相等的值必須留下失敗——否則整支測試的綠燈沒有意義。
// 先記下當下的計數，跑一條一定失敗的比對，確認它真的留下痕跡，再把痕跡清掉。
const beforeTotal = total;
const beforeFail = failures.length;
eq('（自檢）1 不等於 2', 1, 2);
const selfCheckOk = total === beforeTotal + 1 && failures.length === beforeFail + 1;
failures.pop();
total = beforeTotal;
check('Z1 斷言器對不相等的值會留下失敗', selfCheckOk);

check('Z2 有真的驗到東西（不是全部空轉）', pass > 0 && total > 0);

console.log('');
console.log(`  通過 ${pass} / ${total}　${failures.length === 0 ? '（全部通過）' : `（失敗 ${failures.length}）`}`);
if (failures.length > 0) {
  console.log('');
  failures.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
