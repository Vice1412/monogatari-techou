/**
 * 美食家子系統動作純函式模組
 *
 * 規則依據：官方原書《Natural Fantasy Atlas》p.138-139
 *
 * 1. 【烹飪】：花費 1 個動作組合食材製作美食，可存為背包物品（Delicacy）或現場食用。
 * 2. 【鹽與胡椒】：花費 2 點 IP，將烹飪中其中一種食材的口味視為任意指定口味。
 * 3. 【加點愛】：烹飪現場享用時，花費至多【SL × 10】點 MP：每花 10 點 MP 額外影響 1 名盟友。
 */

import { TASTES } from '../data/gourmetData';
import { createInventoryItem } from './inventory';

/**
 * 鹽與胡椒：花費 2 IP 調整單一食材的臨時口味。
 */
export function applySaltAndPepper({ pickedIngredients, targetId, newTaste, currentIp }) {
  const ip = Math.max(0, Math.floor(Number(currentIp) || 0));
  if (ip < 2) {
    return {
      ok: false,
      reason: 'IP 不足（需要 2 點 IP）'
    };
  }

  if (!TASTES.includes(newTaste)) {
    return {
      ok: false,
      reason: '未知的口味種類'
    };
  }

  const list = Array.isArray(pickedIngredients) ? pickedIngredients : [];
  const found = list.some((it) => it && it.id === targetId);
  if (!found) {
    return {
      ok: false,
      reason: '找不到指定的食材'
    };
  }

  const modified = list.map((it) => {
    if (it && it.id === targetId) {
      return { ...it, taste: newTaste, isSeasoned: true };
    }
    return it;
  });

  return {
    ok: true,
    nextIp: ip - 2,
    modifiedIngredients: modified
  };
}

/**
 * 加點愛：花費至多【SL × 10】點 MP 額外影響盟友。
 */
export function applyDashOfLove({ skillSL, currentMp, extraAllies }) {
  const sl = Math.max(1, Math.floor(Number(skillSL) || 1));
  const mp = Math.max(0, Math.floor(Number(currentMp) || 0));
  const count = Math.max(0, Math.floor(Number(extraAllies) || 0));

  if (count <= 0) {
    return {
      ok: true,
      nextMp: mp,
      extraAllies: 0,
      costMp: 0
    };
  }

  if (count > sl) {
    return {
      ok: false,
      reason: `加點愛最多額外影響 ${sl} 名盟友（當前 SL 為 ${sl}）`
    };
  }

  const costMp = count * 10;
  if (mp < costMp) {
    return {
      ok: false,
      reason: `MP 不足（需要 ${costMp} 點 MP，目前僅有 ${mp} 點）`
    };
  }

  return {
    ok: true,
    nextMp: mp - costMp,
    extraAllies: count,
    costMp
  };
}

/**
 * 將烹飪完成的美食打包為行囊消耗品物品。
 */
export function buildCookedDelicacyItem({ dishName, dishText, effectModel = {} }) {
  const finalName = typeof dishName === 'string' && dishName.trim()
    ? dishName.trim()
    : '特製美食';

  return createInventoryItem({
    name: finalName,
    category: 'consumable',
    value: 100, // 美食標準估值（原書食材每份 10z，2~3 份料理估值約 100z）
    effect: typeof dishText === 'string' ? dishText.trim() : '美味的料理。',
    qty: 1,
    effectModel: {
      isDelicacy: true,
      ...effectModel
    }
  });
}

