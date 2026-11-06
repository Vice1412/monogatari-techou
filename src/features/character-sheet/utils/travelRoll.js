/**
 * 旅行移動骰（Travel Roll）子系統純函式模組
 *
 * 規則依據：
 * - 核心規則書 Core Rulebook p.92-93「旅行移動（Travel Moves）」
 * - 旅人【通曉道路】：旅行骰階提升（d6 -> d8 -> d10 -> d12）
 * - 旅人【有備無患】：旅行骰擲出 1 時可重擲
 * - 旅人【寶藏獵人】：旅行骰擲出 ≥6 時發現寶藏獲得【SL × 100】z
 * - 美食家【準備食材】：旅行移動後獲得【SL × 2】份食材
 */

import { TASTES, ingredientCapacity } from '../data/gourmetData';

/**
 * 依據【通曉道路】SL 換算旅行骰階。
 */
export function resolveTravelDie(knowTheRoadsSL = 0) {
  const sl = Math.max(0, Math.floor(Number(knowTheRoadsSL) || 0));
  if (sl <= 0) return 'd6';
  if (sl === 1) return 'd8';
  if (sl === 2) return 'd10';
  return 'd12';
}

/**
 * 評估旅行骰擲骰結果。
 */
export function evalTravelRoll({
  roll,
  die = 'd6',
  wellPreparedSL = 0,
  treasureHunterSL = 0,
  prepareDelicaciesSL = 0,
  hasUsedReroll = false
}) {
  const r = Math.max(1, Math.floor(Number(roll) || 1));
  const isDanger = r === 1;
  const canReroll = isDanger && wellPreparedSL > 0 && !hasUsedReroll;

  const thSL = Math.max(0, Math.floor(Number(treasureHunterSL) || 0));
  const hasTreasure = thSL > 0 && r >= 6;
  const zenitGain = hasTreasure ? thSL * 100 : 0;

  const pdSL = Math.max(0, Math.floor(Number(prepareDelicaciesSL) || 0));
  const ingredientGain = pdSL > 0 ? pdSL * 2 : 0;

  let outcomeText = '';
  if (isDanger) {
    outcomeText = canReroll
      ? `擲出 1：遭遇危險！可發動【有備無患】重擲一次。`
      : `擲出 1：遭遇危險或意外事件！`;
  } else {
    outcomeText = `擲出 ${r}（${die}）：平穩旅行。`;
  }

  if (hasTreasure) {
    outcomeText += `【寶藏獵人】觸發！發現古代遺跡或寶藏，獲得 ${zenitGain}z。`;
  }
  if (ingredientGain > 0) {
    outcomeText += `【準備食材】觸發！獲得 ${ingredientGain} 份旅途食材。`;
  }

  return {
    roll: r,
    die,
    isDanger,
    canReroll,
    hasTreasure,
    zenitGain,
    ingredientGain,
    outcomeText
  };
}

/**
 * 將旅行結算套用至角色（金幣入帳、食材入袋）。
 */
export function applyTravelOutcome(character, outcome) {
  let next = { ...character };

  // 1. 金幣結算
  if (outcome.zenitGain > 0) {
    const curZ = Number(next.zenit) || 0;
    next.zenit = curZ + outcome.zenitGain;
  }

  // 2. 食材結算
  if (outcome.ingredientGain > 0) {
    const gourmetClass = (next.classes || []).find((c) => c.className === '美食家');
    const cookingSL = Math.max(
      0,
      Math.floor(Number((gourmetClass?.skills || []).find((s) => s.name === '烹飪')?.sl) || 0)
    );
    const cap = ingredientCapacity(cookingSL);
    const existing = next.gourmetData?.ingredients || [];
    const remainingSlots = Math.max(0, cap - existing.length);
    const actualAdd = Math.min(remainingSlots, outcome.ingredientGain);

    if (actualAdd > 0) {
      const newItems = [];
      for (let i = 0; i < actualAdd; i += 1) {
        const t = TASTES[i % TASTES.length];
        newItems.push({
          id: `ing_travel_${Date.now()}_${i}`,
          name: `旅途採集的${t}食材`,
          taste: t
        });
      }
      next.gourmetData = {
        ...(next.gourmetData || {}),
        ingredients: [...existing, newItems]
      };
    }
  }

  next.updatedAt = new Date().toISOString();
  return next;
}
