/**
 * 擲骰計算與檢定改寫引擎（純函式模組）。
 * 支援：
 *  - 核心檢定計算（total, hr, critical, fumble）
 *  - 【孤注一擲】：偶數翻倍、奇數視為 1
 *  - 【幸運七】：以幸運數字替換一顆骰值，並將被替換值作為新的幸運數字
 */

/**
 * 孤注一擲單顆骰改寫（純函式）。
 * 原書：若點數為偶數，該骰子點數視為翻倍；其餘骰子點數視為 1。
 */
export const evalGambitDie = (val) => {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n % 2 === 0 ? n * 2 : 1;
};

/**
 * 計算擲骰結果（純函式）。
 */
export const computeRollOutcome = (r1, r2, mod = 0, { mode = 'normal' } = {}) => {
  const isCritical = r1 === r2 && r1 >= 6;
  const isFumble = r1 === 1 && r2 === 1;

  let effectiveDie1 = r1;
  let effectiveDie2 = r2;

  if (mode === 'gambit') {
    effectiveDie1 = evalGambitDie(r1);
    effectiveDie2 = evalGambitDie(r2);
  }

  const total = effectiveDie1 + effectiveDie2 + mod;
  const hr = Math.max(effectiveDie1, effectiveDie2);

  return {
    rawDie1: r1,
    rawDie2: r2,
    die1: effectiveDie1,
    die2: effectiveDie2,
    modifier: mod,
    total,
    hr,
    isCritical,
    isFumble,
    mode
  };
};

/**
 * 幸運七骰值替換（純函式）。
 * 原書：每個場景一次，用幸運數字替換擲出的一個骰子數值，被替換的原始數值成為新的幸運數字。
 */
export const swapDieWithLuckyNumber = (outcome, dieTarget, luckyNumber) => {
  if (!outcome) return { outcome: null, nextLuckyNumber: luckyNumber };
  const target = dieTarget === 2 ? 2 : 1;
  const replacedValue = target === 1 ? outcome.die1 : outcome.die2;
  const nextLuckyNumber = replacedValue;

  const newDie1 = target === 1 ? luckyNumber : outcome.die1;
  const newDie2 = target === 2 ? luckyNumber : outcome.die2;
  const total = newDie1 + newDie2 + (outcome.modifier || 0);
  const hr = Math.max(newDie1, newDie2);

  return {
    outcome: {
      ...outcome,
      die1: newDie1,
      die2: newDie2,
      total,
      hr,
      replacedDie: target,
      originalReplacedValue: replacedValue
    },
    nextLuckyNumber
  };
};

