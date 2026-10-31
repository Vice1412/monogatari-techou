/**
 * 金錢的寫入層（P9-b，2026-10-31）
 *
 * ## 為甚麼要從元件裡抽出來
 *
 * 上一輪（§CI67）的 `handlePurchase` 住在 `CharacterPlayHUD` 裡。這一輪多了一個
 * 入口——編輯器（「全部走購買面板」）與收支對話框都要做同一件事：
 *
 *   扣款 → 換裝備 → 留一筆履歷
 *
 * 三件事**必須在同一次寫入裡完成**（§D.24：分兩次 `onChange` 的話，第二次讀到的
 * 是這一輪開始前的角色，於是「UI 扣了 200、存檔只扣一次」）。把這段留在兩個元件裡
 * 各寫一次，等於保證它們有一天會不一樣——而這種不一致不會報錯，只會讓錢對不上。
 *
 * 所以這裡只做一件事：**輸入舊角色與一筆交易，輸出新的角色**。
 * 不碰 localStorage、不碰 React、不呼叫 `onChange`——呼叫端決定怎麼存。
 *
 * ## 判定的權威仍然在 `zenitFeedback.js`
 *
 * 這一支不自己判斷「買不買得起」，一律問 `describePurchase`／`describeMoneyFlow`。
 * 畫面上的算式、按鈕的灰化、這裡的守衛，三處必須是同一個函式算出來的，
 * 否則會出現「按鈕說買得起、按下去說錢不夠」。
 */

import { loggableChange } from './characterLog';
import { asCount } from './playAvailability';
import {
  describePurchase,
  describeMoneyFlow,
  describeEquipmentRecord,
  formatZenit,
  DIRECTION_LABELS,
  MONEY_DIRECTIONS
} from './zenitFeedback';

/** 一次結帳的結果。`ok: false` 時 `character` 原樣回傳（呼叫端可以安全地忽略）。 */
const rejected = (character, gate) => ({
  ok: false,
  character,
  gate,
  record: null,
  spent: 0,
  cleared: null
});

/**
 * 買一件裝備：扣款 ＋（可選）裝備到槽位 ＋ 留一筆 `trade`。
 *
 * `resolveEquipment` 是給「雙手武器佔滿兩個手部欄位」這種跨槽規則用的：
 * 換上雙手武器時副手必須空出（Core p.126）。那條判定住在 `equipmentRules`，
 * 這支不該自己再判斷一次，所以讓呼叫端把它傳進來。
 *
 * @param {object} character 目前角色
 * @param {{ name:string, cost:number, slot:string, detail?:string }} item 目錄品項
 * @param {{
 *   equip?: boolean, slotLabel?: string, slot?: string,
 *   resolveEquipment?: (equipment:object, slot:string, name:string) =>
 *     ({ equipment?:object, clearedOffHand?:string|null })
 * }} options
 *   `slot` 覆寫品項自己的槽位——主手可以放盾（守護者【雙重盾牌】），
 *   這時目錄上的 `slot` 是 `offHand`，但玩家要放的是 `mainHand`。
 * @returns {{ ok:boolean, character:object, gate:object,
 *             record:{title,note}|null, spent:number, cleared:string|null }}
 */
export const applyPurchase = (character, item, {
  equip = false,
  slotLabel = '',
  slot = '',
  resolveEquipment = null
} = {}) => {
  const before = character || {};
  const gate = describePurchase({ price: item?.cost, wallet: before.zenit });

  // 只有「確定付得起」才結帳。`null`（錢包金額未記錄）也擋——扣款需要算術。
  if (gate.affordable !== true) return rejected(before, gate);

  const price = Number(item.cost) || 0;
  const from = Number(before.zenit) || 0;
  const to = Math.max(0, from - price);
  const record = describeEquipmentRecord(item, { equip, slotLabel });
  const targetSlot = slot || item.slot;

  let nextEquipment = before.equipment || {};
  let cleared = null;
  if (equip && targetSlot) {
    if (typeof resolveEquipment === 'function') {
      const resolved = resolveEquipment(nextEquipment, targetSlot, item.name) || {};
      nextEquipment = resolved.equipment || nextEquipment;
      cleared = resolved.clearedOffHand || null;
    } else {
      nextEquipment = { ...nextEquipment, [targetSlot]: item.name };
    }
  }

  const base = {
    ...before,
    zenit: to,
    equipment: nextEquipment,
    updatedAt: new Date().toISOString()
  };

  // 兩個欄位一起記在同一筆：`zenit` 是錢、槽位是東西。
  // 分成兩筆的話履歷上會看到「購入 青銅劍」與「更換主手武器」兩件事，
  // 但它們是同一次動作（而且中間那個狀態——付了錢、東西還沒上身——從來沒存在過）。
  const changes = [{ field: 'zenit', from, to }];
  if (equip && targetSlot) {
    changes.push({ field: targetSlot, from: before.equipment?.[targetSlot] || '', to: item.name });
  }
  if (cleared) {
    changes.push({ field: 'offHand', from: cleared, to: '無盾牌' });
  }

  const next = loggableChange(before, base, {
    // `trade`（標籤「收支」）：這是**事件**，不合併（`coalesce: 0`）。
    // 手動修正走 `zenit`（合併）——同一個欄位、兩種語意，見 characterLog.js。
    kind: 'trade',
    title: record.title,
    note: record.note,
    changes
  });

  return { ok: true, character: next, gate, record, spent: price, cleared };
};

/**
 * 記一筆收支（住宿、餐費、報酬……），可選一併把裝備記進欄位。
 *
 * `item` 有值時是「桌邊買到的裝備」：金額由呼叫端決定（可能是 GM 給的折扣價），
 * 但**記錄格式仍然走 `describeEquipmentRecord`**——同一次購買不該有兩種寫法。
 *
 * @param {object} character
 * @param {{ direction:'spend'|'gain', amount:number|string, reason:string,
 *           item?:object, equip?:boolean, slotLabel?:string }} input
 */
export const applyMoneyFlow = (character, { direction, amount, reason, item = null, equip = false, slotLabel = '' } = {}) => {
  const before = character || {};
  const flow = describeMoneyFlow({ direction, amount, reason, wallet: before.zenit });
  if (!flow.ok) return { ok: false, character: before, flow, record: null };

  const from = Number(before.zenit) || 0;
  const to = flow.next;
  const template = item ? describeEquipmentRecord(item, { equip, slotLabel }) : null;

  const nextEquipment = item && equip && item.slot
    ? { ...(before.equipment || {}), [item.slot]: item.name }
    : (before.equipment || {});

  const base = {
    ...before,
    zenit: to,
    equipment: nextEquipment,
    updatedAt: new Date().toISOString()
  };

  // 有裝備時，玩家自己寫的原因不能消失。
  //
  // 第一版把 `reason` 整個丟掉（`note: template.note`）——於是「買劍，老闆算我便宜因為
  // 我幫他找回走失的貓」只留下「近戰武器 · … · 200z」。**模板是格式，不是內容**：
  // 它負責讓同一件事在三個地方長得一樣，不負責取代玩家說的話。
  //
  // 只有當原因**就是**品名（對話框自動填的預設值）時才略過，否則會印成
  // `購入 青銅劍 · 青銅劍`。
  const extra = template && flow.reason && flow.reason !== item?.name ? flow.reason : '';

  const next = loggableChange(before, base, {
    kind: 'trade',
    // 有裝備就用模板的標題（`購入 青銅劍`），沒有就用「支出 · 住宿」。
    title: template ? template.title : flow.title,
    note: template
      ? [template.note, extra].filter(Boolean).join(' · ')
      : '',
    changes: [{ field: 'zenit', from, to }]
  });

  return { ok: true, character: next, flow, record: template, spent: flow.amount };
};

/**
 * 給 toast 用的一句話：`購入【短匕首】-150z，餘 350z` / `支出【住宿】-50z，餘 300z`。
 *
 * 三件事要在同一句話裡講完，因為 toast 只停留兩三秒：
 *   **做了什麼**（買了什麼／為了什麼）→ **錢動了多少** → **現在還剩多少**。
 * 只講「已記錄」等於什麼都沒講——玩家要看的是那個數字變了。
 *
 * `spent` 與 `flow.amount` 擇一：購買面板沒有 `flow`，收支對話框沒有 `spent`。
 * 兩者都缺就回空字串，讓呼叫端決定要不要顯示，而不是印出 `-0z`。
 */
export const describeMoneyToast = ({ ok, character, record, flow, spent } = {}) => {
  if (!ok) return '';

  const wallet = asCount(character?.zenit);
  const rest = wallet === null ? '—' : formatZenit(wallet);

  // 金額來源：購買走 `spent`，收支走 `flow.amount`。`0` 是合法值，所以不能用 `||`。
  const amount = asCount(spent) ?? asCount(flow?.amount);
  const sign = flow?.direction === MONEY_DIRECTIONS.gain ? '+' : '-';

  const name = record?.title ? record.title.replace(/^購入\s*/, '') : '';
  // 兩種來源、同一種講法：都講「什麼事」＋「多少錢」＋「還剩多少」。
  // 收支走 `支出【住宿】-50z`，而不是把 `支出 · 住宿` 直接接上金額——
  // 那會印成「支出 · 住宿-50z」，數字黏在字上，讀起來像同一個詞。
  const label = name
    ? `購入【${name}】`
    : (flow ? `${DIRECTION_LABELS[flow.direction]}【${flow.reason}】` : '');
  if (!label) return '';

  const amountText = amount === null ? '' : `${sign}${formatZenit(amount)}`;
  return `${label}${amountText}，餘 ${rest}`;
};
