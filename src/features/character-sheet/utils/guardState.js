/**
 * 守衛（Guard）——跑團時最常被問、卻沒有地方記的一個狀態（P12，2026-11-02）
 *
 * ## 為什麼它需要「狀態」而不是一顆按鈕
 *
 * 原書的守衛是：花掉你的行動，防禦與魔法防禦 +2，**直到你下一回合開始**。
 * 也就是說它跨回合存在——玩家宣告守衛之後，對手的兩三次攻擊都要算這個 +2。
 * 如果只做一顆「+2」的按鈕按一下跳一次 toast，那第二隻怪物打過來時
 * 玩家就得自己記著「我還在守衛」——那正是這張卡應該幫忙記的事。
 *
 * ## 為什麼不自動重置
 *
 * 「直到你下一回合開始」需要知道回合什麼時候輪到你。**App 不知道**：
 * 這張卡是玩家自己按的，不是戰鬥追蹤器推過來的（戰鬥輪次在另一頁，
 * 而且常常是 GM 在數）。自動在「某個時間點」清掉，等於用一個猜測
 * 蓋掉玩家手上的事實——寧可它留著，讓玩家自己按掉。
 *
 * 所以：`isGuarding` 進存檔、跨回合保留、**只有玩家按的那一下會改變它**。
 * 這也是為什麼它是一條「寫入軸」的補洞，而不是一個顯示小工具。
 *
 * ## 為什麼 +2 不寫進 `stats`
 *
 * `stats.def` 是「這張卡的防禦值」，由 DEX 與裝備推導（`StatFormulaPanel` 會展開算式）。
 * 把守衛加成併進那個數字，展開的算式就會對不上（12 = d8 + 2，但 +2 從哪來？）。
 * 所以加成留在畫面上（數字旁邊的 `+2`），算式仍然是原本那一條。
 *
 * 頁碼未在本輪核對（官方 PDF 在工具鏈裡被擋），只採用「+2、持續到下一回合開始」
 * 這個玩法結論；若與你手上的版本不同，改 `GUARD_BONUS` 一處即可。
 */

import { loggableChange } from './characterLog';

/** 守衛給的加值。單一來源：畫面、測試、履歷都讀這一個。 */
export const GUARD_BONUS = 2;

/** 守衛加成的對象。寫成清單是因為畫面上要**逐一**標記，而不是加進總值。 */
export const GUARD_TARGETS = Object.freeze(['def', 'mdef']);

/**
 * 現在是否處於守衛。
 *
 * 用 `=== true` 而不是真值判斷：舊存檔可能存過 `'false'` 這種字串
 * （表單轉存的殘留），而 `Boolean('false')` 是 `true`——一個永遠關不掉的守衛。
 */
export const isGuarding = (character) => character?.isGuarding === true;

/** 畫面用的加成值：沒守衛就是 0（不是 null——「沒有加成」是已知的）。 */
export const guardBonusOf = (character) => (isGuarding(character) ? GUARD_BONUS : 0);

/**
 * 一句話描述目前架勢（給徽章與 tooltip 共用）。
 *
 * `active` 與 `bonus` 分開放：畫面要拿 `bonus` 決定要不要畫 `+2`，
 * 要拿 `active` 決定按鈕的 `aria-pressed`。只回一個布林的話，
 * 兩邊會各自再寫一次 `? GUARD_BONUS : 0`。
 */
export const describeGuardState = (character) => {
  const active = isGuarding(character);
  return {
    active,
    bonus: active ? GUARD_BONUS : 0,
    label: active ? `守衛中（防禦 +${GUARD_BONUS}）` : '宣告守衛',
    title: active
      ? `防禦與魔法防禦 +${GUARD_BONUS}，直到你的下一回合開始。App 不會自動解除——回合結束時自己按掉。`
      : `花掉你的行動：防禦與魔法防禦 +${GUARD_BONUS}，直到你的下一回合開始。`
  };
};

/**
 * 切換守衛並留一筆履歷。
 *
 * 為什麼要留痕：這是一個**跨回合仍然有效**的狀態，而「我什麼時候宣告的」
 * 在爭執時是唯一能查的東西。`kind: 'stance'` 不合併（`coalesce: 0`）——
 * 宣告與解除是兩件事，合併會讓它們變成一筆「守衛 false → true」。
 *
 * @param {object} character
 * @param {boolean} active 目標狀態
 */
export const setGuard = (character, active) => {
  const before = character || {};
  const next = active === true;
  if (isGuarding(before) === next) return before;

  const base = { ...before, isGuarding: next, updatedAt: new Date().toISOString() };
  return loggableChange(before, base, {
    kind: 'stance',
    title: next ? '宣告守衛' : '解除守衛',
    note: next ? `防禦與魔法防禦 +${GUARD_BONUS}，直到下一回合開始` : '',
    changes: [{ field: 'isGuarding', from: isGuarding(before), to: next }]
  });
};
