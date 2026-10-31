/**
 * 擲骰留痕（2026-10-31，P8）
 *
 * 為什麼要有這個模組：
 * 履歷已經有 16 種 kind（HP／MP／IP／FP／EXP／資金／羈絆／命刻／營地／場次…），
 * 但跑團最高頻的動作——**擲骰——一筆都沒有**。
 * `DiceRollerModal` 從建立起就是零寫回：沒有 `updateField`、沒有 `onChange`、
 * 沒有 localStorage、沒有 history。那不是「刻意不留」，是「沒有人接過這條線」。
 *
 * 設計判準（GM 2026-10-31 裁定）：**只記值得記的**。
 * 一晚幾十次的普通檢定如果全記，履歷會被淹掉——而「可用的履歷」與「雜訊」的分界，
 * 正是 `characterLog.js` 的 `coalesce` 在講的同一件事。
 *
 *   - 大成功／大失敗 → **自動記**。那是回合的轉折，玩家會記得，GM 審卡也會問。
 *   - 普通檢定 → **不自動記**，但擲骰器留一顆「記下這一擲」讓玩家自己決定。
 *     App 不替他判斷哪一次重要——與「不要從既有資料榨意義」是同一個原則的兩面。
 *
 * 為什麼判定放在這裡、不放在擲骰器：
 * `DiceRollerModal` 只回報「發生了什麼」，判定與格式化屬於角色業務。
 * 它每次擲骰都呼叫 `onRecordRoll(outcome, { auto: true })`，
 * 由這裡決定要不要真的寫——判定只有一份，不會兩邊分岔。
 */

/**
 * 這一擲值不值得自動記？
 *
 * 只認明確的 `true`：缺欄位、`null`、舊格式一律當「不是」。
 * 這裡刻意不用 truthy 判斷——`isCritical: 'false'` 這種髒資料不該被當成大成功。
 */
export const shouldAutoRecordRoll = (outcome) => {
  if (!outcome || typeof outcome !== 'object') return false;
  return outcome.isCritical === true || outcome.isFumble === true;
};

/** 結果標籤；普通檢定回空字串（標題就不會多一個沒意義的詞） */
export const describeRollOutcome = (outcome) => {
  if (!outcome || typeof outcome !== 'object') return '';
  if (outcome.isCritical === true) return '大成功';
  if (outcome.isFumble === true) return '大失敗';
  return '';
};

const asFinite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * 組出一筆履歷的標題與備註。
 *
 * 標題只放「這是什麼、結果多少」——履歷是清單，一行讀不完就沒有人會讀。
 * 每顆骰面、加值、羈絆加值全部收進 `note`。
 *
 * `context.reroll` 會在標題前面加「重擲」：大成功之後玩家仍可能花 FP 重擲
 * （Core p.46），而那會讓「大成功」變成歷史而不是結果。若不記這一筆，
 * 履歷上會永遠留著一個已經不成立的結果——**記錯比沒記更糟**。
 *
 * @param {object} outcome `computeRollOutcome` 的回傳值
 * @param {object} context `{ label, die1Type, die2Type, fpBonus, bondName, reroll }`
 * @returns {{title: string, note: string}|null} 沒有可用的總值就回 `null`（不寫一筆空記錄）
 */
export const buildRollRecord = (outcome, context = {}) => {
  if (!outcome || typeof outcome !== 'object') return null;
  const total = asFinite(outcome.total);
  if (total === null) return null;

  const ctx = context && typeof context === 'object' ? context : {};
  const label = typeof ctx.label === 'string' ? ctx.label.trim() : '';
  const die1Type = asFinite(ctx.die1Type);
  const die2Type = asFinite(ctx.die2Type);
  const fpBonusRaw = asFinite(ctx.fpBonus);
  const fpBonus = fpBonusRaw === null ? 0 : fpBonusRaw;
  const bondName = typeof ctx.bondName === 'string' ? ctx.bondName.trim() : '';
  const isReroll = ctx.reroll === true;

  const tag = describeRollOutcome(outcome);
  // 檢定總值要含羈絆加值——那才是玩家在桌上報出來的數字。
  const finalTotal = total + fpBonus;
  const title = `${label ? `【${label}】` : ''}${isReroll ? '重擲 ' : ''}${tag ? `${tag} ` : ''}${finalTotal}`;

  const parts = [];
  const d1 = asFinite(outcome.die1);
  const d2 = asFinite(outcome.die2);
  if (d1 !== null) parts.push(`${die1Type ? `d${die1Type}` : '骰'} ${d1}`);
  if (d2 !== null) parts.push(`${die2Type ? `d${die2Type}` : '骰'} ${d2}`);
  const modifier = asFinite(outcome.modifier);
  if (modifier !== null && modifier !== 0) parts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
  if (fpBonus > 0) parts.push(`羈絆+${fpBonus}${bondName ? `（${bondName}）` : ''}`);

  const hr = asFinite(outcome.hr);
  const note = `${parts.join(' ')} = ${finalTotal}${hr === null ? '' : ` · HR ${hr}`}`;

  return { title, note };
};
