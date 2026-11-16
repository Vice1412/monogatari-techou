/**
 * 旅行骰與長途移動結算純函式模組
 *
 * 規則依據（依官方英文正式版為準，Core p.106-107 / p.217、NF Atlas p.149-150）：
 * 1. 【旅行骰】（Core p.106-107）：
 *    - 威脅等級：最低 d6 / 低 d8 / 中 d10 / 高 d12 / 極高 d20。
 *    - 擲出 6 或更高：遭遇危險（Danger）。
 *    - 擲出 1（無寶藏獵人時）：獲得意外發現（Discovery）。
 *    - 其餘點數（2~5）：安全度過該日行程。
 * 2. 【旅人：通曉道路】（Core p.217，maxSL 1）：
 *    - 將旅行骰尺寸降低 1 階（d20->d12->d10->d8->d6，最低降至 d6）；多名角色持有時不疊加。
 * 3. 【旅人：有備無患】（Core p.217，maxSL 4）：
 *    - 每次進行旅行骰後恢復【SL】點 IP（上限依 maxIp 夾制）。
 * 4. 【旅人：寶藏獵人】（Core p.217，maxSL 2）：
 *    - 旅行骰擲出【SL + 1】或更低時即可獲得發現（SL1 <= 2，SL2 <= 3）。
 * 5. 【美食家：準備食材】（NF Atlas p.149-150，maxSL 3）：
 *    - 須先習得美食家【烹飪】技能；每次進行旅行骰後獲得【SL × 2】份食材，
 *      依 d6 口味表決定口味（6 為自選口味），追加為扁平陣列並依食材上限夾制。
 */

import { resolveVitalResources, getCharacterSkillSL } from './characterEngine';
import { loggableChange } from './characterLog';
import { TASTES, TASTE_ROLL, ingredientCapacity } from '../data/gourmetData';

export const TRAVEL_DICE_LADDER = Object.freeze(['d6', 'd8', 'd10', 'd12', 'd20']);

export const TRAVEL_THREAT_LEVELS = Object.freeze([
  { die: 'd6', label: '最低威脅', desc: '安全或常巡守的區域（d6）' },
  { die: 'd8', label: '低威脅', desc: '偶有警戒與零星危險（d8）' },
  { die: 'd10', label: '中威脅', desc: '野外或局勢不安之地（d10）' },
  { die: 'd12', label: '高威脅', desc: '敵境、邊疆或災厄之地（d12）' },
  { die: 'd20', label: '極高威脅', desc: '致命禁地與深淵前線（d20）' }
]);

const normalizeDieString = (die = 'd6') => {
  const s = String(die || 'd6').trim().toLowerCase();
  const formatted = s.startsWith('d') ? s : `d${s}`;
  return TRAVEL_DICE_LADDER.includes(formatted) ? formatted : 'd6';
};

/**
 * 計算通曉道路後的實際旅行骰規格。
 * 原書 p.217：將旅行骰尺寸降低一階（最低降至 d6），多名角色擁有不疊加。
 *
 * @param {string} threatDie GM 宣告的區域威脅骰（d6 / d8 / d10 / d12 / d20）
 * @param {number} knowTheRoadsSL 旅人【通曉道路】技能等級（0 或 1；>0 固定降一階）
 * @returns {string} 實際擲出的旅行骰
 */
export function resolveTravelDie(threatDie = 'd6', knowTheRoadsSL = 0) {
  const normalized = normalizeDieString(threatDie);
  const idx = TRAVEL_DICE_LADDER.indexOf(normalized);
  if (Number(knowTheRoadsSL) > 0) {
    return TRAVEL_DICE_LADDER[Math.max(0, idx - 1)];
  }
  return normalized;
}

/**
 * 將骰子規格字串轉為數值面數。
 */
export function dieSides(die) {
  const sides = Number(String(die || 'd6').replace(/[^0-9]/g, ''));
  return Number.isFinite(sides) && sides >= 4 ? sides : 6;
}

const rollIndexFromTasteInput = (tasteRoll, idx, chosenTaste) => {
  const numeric = Number(tasteRoll);
  const validRoll = Number.isInteger(numeric) && numeric >= 1 && numeric <= 6
    ? numeric
    : ((idx % 5) + 1);
  const rolledTaste = TASTE_ROLL[validRoll];
  if (rolledTaste) {
    return { roll: validRoll, taste: rolledTaste, wasPlayerChoice: false };
  }
  const fallbackTaste = TASTES.includes(chosenTaste) ? chosenTaste : TASTES[0];
  return { roll: 6, taste: fallbackTaste, wasPlayerChoice: true };
};

/**
 * 評估單次旅行移動骰結算。
 *
 * @param {object} params
 * @param {number} params.roll 旅行骰實際擲出點數（1 ~ sides）
 * @param {string} [params.die] 實際使用的骰型（預設 d6）
 * @param {number} [params.wellPreparedSL] 旅人【有備無患】SL（0~4）
 * @param {number} [params.treasureHunterSL] 旅人【寶藏獵人】SL（0~2）
 * @param {number} [params.prepareDelicaciesSL] 美食家【準備食材】SL（0~3）
 * @param {number} [params.cookingSL] 美食家【烹飪】SL（未習得烹飪則無法攜帶收集食材）
 * @param {number[]} [params.tasteRolls] 每份食材對應的 d6 口味骰結果（1~6）
 * @param {string} [params.chosenTaste] 當 d6 擲出 6（自選口味）時採用之口味
 * @returns {object}
 */
export function evalTravelRoll({
  roll,
  die = 'd6',
  wellPreparedSL = 0,
  treasureHunterSL = 0,
  prepareDelicaciesSL = 0,
  cookingSL = 0,
  tasteRolls = [],
  chosenTaste = TASTES[0]
}) {
  const normalizedDie = normalizeDieString(die);
  const sides = dieSides(normalizedDie);
  const r = Math.max(1, Math.min(sides, Math.floor(Number(roll) || 1)));

  const wpSL = Math.max(0, Math.min(4, Math.floor(Number(wellPreparedSL) || 0)));
  const thSL = Math.max(0, Math.min(2, Math.floor(Number(treasureHunterSL) || 0)));
  const pdSL = Math.max(0, Math.min(3, Math.floor(Number(prepareDelicaciesSL) || 0)));
  const ckSL = Math.max(0, Math.min(5, Math.floor(Number(cookingSL) || 0)));

  // Core p.107：6 或更高 = 遭遇危險；Core p.217 寶藏獵人：SL + 1 或更低 = 獲得發現
  const isDanger = r >= 6;
  const discoveryThreshold = 1 + thSL;
  const isDiscovery = r <= discoveryThreshold;
  const isCalm = !isDanger && !isDiscovery;

  // Core p.217 有備無患：每次旅行骰後恢復 SL 點 IP
  const ipGain = wpSL;

  // NF Atlas p.149-150 準備食材：須已習得【烹飪】，每次旅行骰後獲得 SL × 2 份食材
  let ingredientGain = 0;
  let blockedPrepareReason = '';
  if (pdSL > 0) {
    if (ckSL > 0) {
      ingredientGain = pdSL * 2;
    } else {
      blockedPrepareReason = '尚未習得美食家【烹飪】技能，無法攜帶與收集食材';
    }
  }

  const tasteRollBreakdown = [];
  const newIngredients = [];
  const baseStamp = Date.now();
  for (let i = 0; i < ingredientGain; i += 1) {
    const picked = rollIndexFromTasteInput(tasteRolls[i], i, chosenTaste);
    tasteRollBreakdown.push(picked);
    newIngredients.push({
      id: `ing_travel_${baseStamp}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: `旅途採集食材（${picked.taste}）`,
      taste: picked.taste
    });
  }

  const outcomeLabel = isDanger
    ? '遭遇危險（擲出 6 或更高）'
    : (isDiscovery ? `獲得意外發現（擲出 ≤ ${discoveryThreshold}）` : '平安前行');

  return {
    roll: r,
    die: normalizedDie,
    sides,
    isDanger,
    isDiscovery,
    isCalm,
    discoveryThreshold,
    ipGain,
    cookingSL: ckSL,
    ingredientGain,
    blockedPrepareReason,
    tasteRollBreakdown,
    newIngredients,
    outcomeLabel
  };
}

/**
 * 將旅行結算結果安全應用到角色物件上（純函式，回傳新角色與寫入摘要）。
 * - IP 補回至上限 `maxIp`
 * - 食材以扁平陣列附加進 `gourmetData.ingredients`，並依 `ingredientCapacity(cookingSL)` 夾制
 * - 寫入一筆 `kind: 'camp'`（coalesce: 0）角色履歷
 */
export function applyTravelOutcome(character, outcome, statsOverride = null) {
  if (!character || typeof character !== 'object') {
    return {
      ok: false,
      character,
      ipDelta: 0,
      addedIngredients: [],
      discardedIngredients: [],
      reason: '無效的角色物件'
    };
  }
  const safeOutcome = outcome && typeof outcome === 'object' ? outcome : {};

  // 1. 計算 IP 恢復與上限夾制
  const { curIp, maxIp } = resolveVitalResources(character, statsOverride);
  const requestedIp = Math.max(0, Math.floor(Number(safeOutcome.ipGain) || 0));
  const nextIp = requestedIp > 0 ? Math.min(maxIp, curIp + requestedIp) : curIp;
  const ipDelta = nextIp - curIp;

  // 2. 計算美食家食材（扁平合併，避免產生巢狀陣列）
  const incomingIngredients = Array.isArray(safeOutcome.newIngredients)
    ? safeOutcome.newIngredients.filter((it) => it && typeof it === 'object' && it.taste)
    : [];

  const charCookingSL = getCharacterSkillSL(character, '烹飪');
  const effectiveCookingSL = Math.max(charCookingSL, Math.max(0, Math.floor(Number(safeOutcome.cookingSL) || 0)));
  const existingGourmet = character.gourmetData || { ingredients: [], cookbook: {} };
  const existingIngredients = Array.isArray(existingGourmet.ingredients)
    ? existingGourmet.ingredients
    : [];

  let addedIngredients = [];
  let discardedIngredients = incomingIngredients;
  let nextIngredients = existingIngredients;

  if (incomingIngredients.length > 0 && effectiveCookingSL > 0) {
    const cap = ingredientCapacity(effectiveCookingSL);
    const availableSlots = Math.max(0, cap - existingIngredients.length);
    addedIngredients = incomingIngredients.slice(0, availableSlots);
    discardedIngredients = incomingIngredients.slice(availableSlots);
    nextIngredients = [...existingIngredients, ...addedIngredients];
  }

  const nextCharBase = {
    ...character,
    ...(ipDelta > 0 ? { currentIp: nextIp } : {}),
    ...(addedIngredients.length > 0
      ? {
          gourmetData: {
            ...existingGourmet,
            ingredients: nextIngredients
          }
        }
      : {}),
    updatedAt: new Date().toISOString()
  };

  const parts = [];
  if (safeOutcome.outcomeLabel) parts.push(safeOutcome.outcomeLabel);
  if (ipDelta > 0) parts.push(`IP +${ipDelta}`);
  else if (requestedIp > 0) parts.push('IP 已滿');
  if (addedIngredients.length > 0) {
    parts.push(`獲得 ${addedIngredients.length} 份食材`);
  }
  if (discardedIngredients.length > 0 && effectiveCookingSL > 0) {
    parts.push(`另有 ${discardedIngredients.length} 份因背包上限未收入`);
  }

  const changes = [];
  if (ipDelta > 0) {
    changes.push({ field: 'currentIp', from: curIp, to: nextIp });
  }

  const summary = parts.join('｜') || '完成旅行移動結算';
  const logged = loggableChange(character, nextCharBase, {
    kind: 'camp',
    title: `旅行移動結算（${safeOutcome.die || 'd6'} 擲出 ${safeOutcome.roll ?? '—'}）：${safeOutcome.outcomeLabel || '已結算'}`,
    note: summary,
    changes
  });

  return {
    ok: true,
    character: logged,
    ipDelta,
    nextIp,
    maxIp,
    addedIngredients,
    discardedIngredients,
    summary
  };
}
