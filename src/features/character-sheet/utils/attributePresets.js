/**
 * 四維屬性「起始陣列」的純函式。
 *
 * 抽出來的理由：這些邏輯原本只存在 `AttributeMatrixPicker` 的 `onClick` 裡，
 * 而 SSR 測試**不執行事件**，所以「點了預設卡卻沒填入」這種缺陷測不到。
 * 2026-10-19 實際操作時就是這樣：點「萬事通（四項均等 d8×4）」之後
 * `attributes` 仍是 `{dex:0,ins:0,mig:0,wlp:0}`——卡片只是把骰子丟進托盤，
 * 沒有通知父層，玩家得自己再找到「一鍵填入」才會真的生效。
 */
import { ATTRIBUTE_KEYS } from '../data/sourcebookConfig';

/** 把一組起始陣列變成托盤上的四顆骰子（尚未入座） */
export const buildTrayPool = (preset, idPrefix = 'd') => {
  const list = Array.isArray(preset?.diceList) ? preset.diceList : [];
  return ATTRIBUTE_KEYS.map((_, i) => ({
    id: `${idPrefix}_${i}`,
    val: list[i],
    assignedTo: null
  })).filter((die) => Number(die.val) > 0);
};

/** 依 DEX／INS／MIG／WLP 的固定順序把托盤上的骰子入座（「一鍵填入」的語意） */
export const assignPoolInOrder = (pool) =>
  (pool || []).map((die, idx) => ({
    ...die,
    assignedTo: ATTRIBUTE_KEYS[idx] || null
  }));

/** 從托盤推導出四維屬性物件；有任何一顆沒入座就回傳 null（避免只寫一半） */
export const attributesFromPool = (pool) => {
  const attrs = {};
  let assignedCount = 0;
  (pool || []).forEach((die) => {
    if (!die?.assignedTo) return;
    attrs[die.assignedTo] = die.val;
    assignedCount += 1;
  });
  if (assignedCount !== ATTRIBUTE_KEYS.length) return null;
  return attrs;
};

/** 點預設卡就一步到位：托盤 ＋ 入座 ＋ 屬性，回傳三者供呼叫端使用 */
export const applyPreset = (preset, idPrefix = 'd') => {
  const pool = assignPoolInOrder(buildTrayPool(preset, idPrefix));
  return { pool, attributes: attributesFromPool(pool) };
};
