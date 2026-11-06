/**
 * 擲骰計算與檢定改寫引擎測試（C7 檢定改寫群：孤注一擲、幸運七）。
 *
 * 核心驗證：
 *  A. 【孤注一擲】：偶數翻倍（2->4, 4->8...）、奇數視為 1（1,3,5->1）；
 *     高點 HR 與總值重新核算；大成功與大失敗以原始骰面為準。
 *  B. 【幸運七】：替換 D1 / D2 為幸運數字；被替換之原始數值成為 nextLuckyNumber；
 *     重新核算總值與 HR。
 *
 * 執行：npm run test:rolloutcome
 */
import {
  evalGambitDie,
  computeRollOutcome,
  swapDieWithLuckyNumber
} from '../src/features/dice-roller/utils/rollOutcome.js';

let pass = 0;
let fail = 0;
const lines = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};
const section = (t) => lines.push(`\n=== ${t} ===`);

// ─────────────────────────────────────────────────────────── A
section('A. 【孤注一擲】：單顆骰偶數翻倍，奇數視為 1');
check('偶數 2 翻倍為 4', evalGambitDie(2), 4);
check('偶數 4 翻倍為 8', evalGambitDie(4), 8);
check('偶數 6 翻倍為 12', evalGambitDie(6), 12);
check('偶數 8 翻倍為 16', evalGambitDie(8), 16);
check('偶數 10 翻倍為 20', evalGambitDie(10), 20);
check('偶數 12 翻倍為 24', evalGambitDie(12), 24);

check('奇數 1 視為 1', evalGambitDie(1), 1);
check('奇數 3 視為 1', evalGambitDie(3), 1);
check('奇數 5 視為 1', evalGambitDie(5), 1);
check('奇數 7 視為 1', evalGambitDie(7), 1);
check('奇數 9 視為 1', evalGambitDie(9), 1);
check('奇數 11 視為 1', evalGambitDie(11), 1);

// 檢定計算驗證
// 骰出 4 與 5，修正值 +2：
// 正常模式：4 + 5 + 2 = 11，HR = 5
const normalRes = computeRollOutcome(4, 5, 2, { mode: 'normal' });
check('正常模式總值 11', normalRes.total, 11);
check('正常模式 HR 5', normalRes.hr, 5);

// 孤注一擲模式：4 翻倍為 8，5 視為 1；8 + 1 + 2 = 11，HR = 8
const gambitRes = computeRollOutcome(4, 5, 2, { mode: 'gambit' });
check('孤注一擲 D1 變為 8', gambitRes.die1, 8);
check('孤注一擲 D2 變為 1', gambitRes.die2, 1);
check('孤注一擲總值 11', gambitRes.total, 11);
check('孤注一擲 HR 8', gambitRes.hr, 8);
check('保留原始骰面 rawDie1=4, rawDie2=5', [gambitRes.rawDie1, gambitRes.rawDie2], [4, 5]);

// 大成功與大失敗依原始骰面
const critGambit = computeRollOutcome(6, 6, 0, { mode: 'gambit' });
check('雙 6 在孤注一擲下仍是大成功', critGambit.isCritical, true);
check('雙 6 翻倍為 12 + 12 = 24', critGambit.total, 24);

const fumbleGambit = computeRollOutcome(1, 1, 0, { mode: 'gambit' });
check('雙 1 在孤注一擲下仍是大失敗', fumbleGambit.isFumble, true);

// ─────────────────────────────────────────────────────────── B
section('B. 【幸運七】：以幸運數字替換單骰，原始值成為新幸運數字');
// 原始骰出 4 與 8，修正值 +3：
const baseOutcome = computeRollOutcome(4, 8, 3);
check('基礎骰總值 4 + 8 + 3 = 15', baseOutcome.total, 15);

// 替換 D1 為幸運數字 7
const swapD1 = swapDieWithLuckyNumber(baseOutcome, 1, 7);
check('替換 D1 後 D1 為 7', swapD1.outcome.die1, 7);
check('D2 保持 8', swapD1.outcome.die2, 8);
check('替換後總值 7 + 8 + 3 = 18', swapD1.outcome.total, 18);
check('替換後 HR 8', swapD1.outcome.hr, 8);
check('原始 D1 的 4 成為新的幸運數字', swapD1.nextLuckyNumber, 4);

// 替換 D2 為幸運數字 7
const swapD2 = swapDieWithLuckyNumber(baseOutcome, 2, 7);
check('替換 D2 後 D2 為 7', swapD2.outcome.die2, 7);
check('D1 保持 4', swapD2.outcome.die1, 4);
check('替換後總值 4 + 7 + 3 = 14', swapD2.outcome.total, 14);
check('替換後 HR 7', swapD2.outcome.hr, 7);
check('原始 D2 的 8 成為新的幸運數字', swapD2.nextLuckyNumber, 8);

// ─────────────────────────────────────────────────────────── 收尾
console.log(lines.join('\n'));
console.log(`\n通過 ${pass}，失敗 ${fail}`);
if (fail > 0) process.exit(1);

