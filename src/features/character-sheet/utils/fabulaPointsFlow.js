/**
 * 物語點的寫入層（P12，2026-11-02）
 *
 * ## 為什麼物語點要跟金幣走同一條路
 *
 * 錢包在 P9-b／P10 被拆過一次：`−`／`+` 步進器寫的是「支出資金 350 → 300」——
 * 一個**沒有原因**的數字變化。玩家事後問「這 300z 花在哪」，履歷答不出來。
 * 所以步進器被移除，改成「收入／支出／明細」三顆按鈕，原因必填。
 *
 * 物語點是全卡**最後一個**還留著步進器的資源。它比錢更需要原因，因為
 * 每一次花費都對應書上一條明文規則（Core p.96–97 的七條用途）：
 * 重擲、激勵羈絆、改變故事——三件事在履歷上長得一模一樣。
 *
 * 更關鍵的是：**擲骰器其實早就把原因傳進來了**。
 * `onSpendFp('引用特質重擲檢定')` 的括號內容以前只進了 toast（兩三秒後消失），
 * 存檔裡只留下「消耗物語點 3 → 2」。這一支就是把那句話接到履歷上。
 *
 * ## 不新增欄位
 *
 * 明細一律從 `character.log` 推導（`buildFabulaPointLedger`），與金錢明細同一個做法：
 * 一份事實、兩個看法。舊存檔打開就有明細，不需要回填。
 *
 * ## 判定與繪製分開
 *
 * 這一支只回傳「能不能寫、寫完長什麼樣」，不碰 React、不碰 localStorage。
 * 畫面（`FabulaPointsModal`）只負責畫 `flow.errors` 與 `flow.mathText`，
 * 不自己再算一次「夠不夠扣」——兩處各算一次，遲早會出現
 * 「按鈕說扣得下去、按下去說點數不夠」。
 */

import { loggableChange } from './characterLog';
import { asCount } from './playAvailability';

/** 建卡時的物語點。舊存檔缺欄位時也讀這個值（與 `characterEngine` 的判定一致）。 */
export const FP_DEFAULT = 3;

/** 方向。字串常數而不是布林：`isSpend: false` 讀不出是「獲得」還是「沒填」。 */
export const FP_DIRECTIONS = Object.freeze({
  spend: 'spend',
  gain: 'gain'
});

export const FP_DIRECTION_LABELS = Object.freeze({
  spend: '消耗',
  gain: '獲得'
});

/**
 * 快捷原因。**不是選單，是填空的起點**：點一下填進輸入框，玩家仍可改。
 *
 * 三個消耗原因直接對應官方七條用途裡「要花 1 點」的那三條
 * （`FABULA_POINT_RULES` 第 5、6、7 條），而且與擲骰器實際傳進來的字串同一組詞
 * ——同一件事在兩個地方叫兩個名字，明細就對不起來。
 */
export const FP_SPEND_PRESETS = Object.freeze([
  '引用特質重擲檢定',
  '激勵羈絆',
  '改變故事'
]);

/**
 * 獲得的原因同樣取自官方七條的前四條（不花點、而是「拿到點」的那四條）。
 *
 * 這裡刻意寫出「場景開始」「反派登場」這種情境詞而不是規則全文：
 * 明細一列只有一行寬度，全文留給規則框。
 */
export const FP_GAIN_PRESETS = Object.freeze([
  '場景開始（0 點時）',
  '反派登場',
  '大失敗',
  '0 HP 投降（+2）'
]);

/**
 * 角色現在的物語點。
 *
 * `??` 不是 `||`：0 是合法值（2026-10-06 修過一次，`|| 3` 會把 0 還原成 3）。
 * 缺欄位／`null` 才是「還沒記過」，讀建卡預設 3。
 */
export const resolveFabulaPoints = (character) => (
  asCount(character?.fabulaPoints) ?? FP_DEFAULT
);

/**
 * 判定一筆物語點流動能不能寫。
 *
 * 三個欄位各自回一個錯誤字串（不是一個布林），因為畫面上要**分別**標紅那一格。
 * 空值語意照舊：`amount` 的 `''` 是「還沒填」（不是 0 點）；`0` 是「填了 0」，
 * 而 0 點的流動不是一筆流動，一樣擋。
 *
 * @param {{ direction?:string, amount?:number|string, reason?:string, current?:number }} input
 * @returns {{ ok:boolean, direction:string, amount:number|null, reason:string,
 *             from:number, next:number|null, errors:object, mathText:string,
 *             title:string, delta:number }}
 */
export const describeFabulaPointsFlow = ({ direction, amount, reason, current } = {}) => {
  const dir = direction === FP_DIRECTIONS.gain ? FP_DIRECTIONS.gain : FP_DIRECTIONS.spend;
  const value = asCount(amount);
  const text = typeof reason === 'string' ? reason.trim() : '';
  const from = asCount(current);
  const errors = {};

  // `null`（不知道有幾點）與 `0`（知道，而且沒有）要分開講：
  // 前者是「資料還沒到」，後者是「你不夠」。
  if (from === null) errors.current = '物語點尚未記錄，無法計算';
  if (value === null) errors.amount = '請填寫點數';
  else if (value <= 0) errors.amount = '點數要大於 0';
  if (text === '') errors.reason = '請寫下這 1 點是為了什麼';

  const base = from === null ? FP_DEFAULT : from;
  const delta = value === null ? 0 : (dir === FP_DIRECTIONS.gain ? value : -value);
  const next = base + delta;

  if (dir === FP_DIRECTIONS.spend && value !== null && value > base) {
    errors.amount = `只有 ${base} 點，不夠扣 ${value} 點`;
  }

  const ok = Object.keys(errors).length === 0;
  const label = FP_DIRECTION_LABELS[dir];
  const amountText = value === null ? '' : String(value);

  return {
    ok,
    direction: dir,
    amount: value,
    reason: text,
    from: base,
    next: ok ? next : null,
    delta: ok ? delta : 0,
    errors,
    // 算式**不等 `ok`**：玩家填了點數就要看到「扣完剩幾點」，
    // 不能因為「原因還沒填」就讓那一格顯示破折號——那會讓他把注意力
    // 放在原因上，而真正該先確認的是數字（實機驗證抓到的：mathText 是 `—`）。
    // 扣不夠時不寫算式（寫出來是負數，讀起來像「可以扣到 -1」）。
    mathText: value !== null && value > 0 && (dir === FP_DIRECTIONS.gain || value <= base)
      ? `${base} ${dir === FP_DIRECTIONS.gain ? '+' : '−'} ${amountText} = ${next}`
      : '',
    // 標題是「動了什麼」，原因是「為什麼」——兩件事分開放，
    // 明細才有兩行可以讀（一列只有一行寬度的時候，擠在一起兩件事都看不清楚）。
    title: ok ? `${label}物語點` : ''
  };
};

/**
 * 寫一筆物語點流動：扣點／給點 ＋ 留一筆帶原因的履歷。
 *
 * 與 `applyMoneyFlow` 同一個形狀：輸入舊角色，輸出**新角色**，不碰存檔。
 *
 * `kind: 'fp'` 的 `coalesce` 在 2026-11-02 從 120000 改成 0：
 * 合併會保留「最新的 note」而丟掉前一次的——於是「重擲」與「激勵羈絆」
 * 在兩分鐘內先後發生時，明細上只剩一個原因。**合併的前提是沒有東西會被吃掉**，
 * 而原因正是那個會被吃掉的東西。
 */
export const applyFabulaPointsFlow = (character, input = {}) => {
  const before = character || {};
  const flow = describeFabulaPointsFlow({
    ...input,
    current: resolveFabulaPoints(before)
  });
  if (!flow.ok) return { ok: false, character: before, flow };

  const base = {
    ...before,
    fabulaPoints: flow.next,
    updatedAt: new Date().toISOString()
  };

  const next = loggableChange(before, base, {
    kind: 'fp',
    title: flow.title,
    note: flow.reason,
    changes: [{ field: 'fabulaPoints', from: flow.from, to: flow.next }]
  });

  return { ok: true, character: next, flow };
};

/** 一筆履歷裡「動到物語點」的那一段（沒有就回 `null`）。 */
const fpChangeOf = (entry) => {
  const change = (entry && Array.isArray(entry.changes) ? entry.changes : [])
    .find((c) => c && c.field === 'fabulaPoints');
  if (!change) return null;

  const to = asCount(change.to);
  if (to === null) return null;
  const from = asCount(change.from);
  // 沒有前值就不知道差額——不要猜成 0，那會憑空生出一筆「獲得」。
  if (from === null) return null;

  return { from, to, delta: to - from };
};

/**
 * 物語點明細：把履歷裡動到物語點的條目整理成一張帳（新到舊）。
 *
 * @param {Array} log 角色的成長履歷（`character.log`）
 * @returns {{ rows:Array<{id,at,title,note,delta,deltaText,balance}>,
 *             spent:number, gained:number, count:number }}
 *   `spent`／`gained` 都是**正數**，合計顯示時才好讀。
 */
export const buildFabulaPointLedger = (log) => {
  const entries = Array.isArray(log) ? log : [];
  const rows = [];
  let spent = 0;
  let gained = 0;

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    const fp = fpChangeOf(entry);
    // 差額 0 不算一筆（舊步進器夾在 0 邊界時會寫出這種記錄）。
    if (!fp || fp.delta === 0) continue;

    if (fp.delta > 0) gained += fp.delta;
    else spent += -fp.delta;

    rows.push({
      id: entry.id || '',
      at: entry.at || '',
      kind: entry.kind || '',
      title: entry.title || '',
      // 原因在這裡。沒有它，這一列與「消耗物語點 3 → 2」沒有差別。
      note: entry.note || '',
      delta: fp.delta,
      deltaText: `${fp.delta > 0 ? '+' : '−'}${Math.abs(fp.delta)}`,
      // 這一筆之後的點數，不是「現在剩幾點」——明細要回答「那時候剩多少」。
      balance: fp.to
    });
  }

  return { rows, spent, gained, count: rows.length };
};

/**
 * 給 toast 用的一句話：`消耗【引用特質重擲檢定】−1 FP，餘 2`。
 *
 * toast 只停留兩三秒，所以三件事要在同一句裡講完：
 * **做了什麼**（為什麼花）→ **動了多少** → **現在還剩多少**。
 */
export const describeFabulaPointsToast = ({ ok, flow } = {}) => {
  if (!ok || !flow) return '';
  const label = FP_DIRECTION_LABELS[flow.direction];
  const sign = flow.direction === FP_DIRECTIONS.gain ? '+' : '−';
  return `${label}【${flow.reason}】${sign}${flow.amount} FP，餘 ${flow.next}`;
};
