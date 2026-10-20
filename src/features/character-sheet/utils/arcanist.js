/**
 * 秘儀師（核心）／秘儀師【變體】的共用判定與費用計算。
 *
 * 為什麼要抽成獨立模組：這兩套規則的差異（召喚費 40／30、【緊急秘儀】的危機折扣、
 * 【快速召喚】的兩個選項、【阿爾卡納再生】／【秘術再生】的治療）原本散在
 * `ArcanistManager` 的 JSX 裡，而**面板是否出現**寫在 `CharacterPlayHUD` 的條件式中。
 * 兩處各寫一份的結果就是 2026-10-19 的實測缺陷：變體角色在跑團面板**完全沒有**
 * 阿爾卡納面板（HUD 用 `cl.className === '秘儀師'` 嚴格比對），而面板本身
 * 早就支援變體（`usesVariantArcanist`）。判定與渲染分離後，護欄才測得到判定。
 *
 * 這裡全部是純函式：不碰 localStorage、不碰 React、不改變傳入的角色。
 */
import { VARIANT_ARCANIST_CLASS_NAME } from '../data/sourcebookConfig';
import { calculateCharacterStats } from './characterEngine';

export const ARCANIST_CLASS_NAME = '秘儀師';
export const ARCANIST_VARIANT_CLASS_NAME = VARIANT_ARCANIST_CLASS_NAME;

/** 綁定和召喚：核心 40 MP、變體 30 MP（Core p.133／Playtest 2026-10-01 p.24） */
export const ARCANIST_BINDING_SKILL = '綁定和召喚';
export const ARCANIST_CORE_SUMMON_COST = 40;
export const ARCANIST_VARIANT_SUMMON_COST = 30;
/** 【緊急秘儀】每 SL 折 5 MP（核心）；【快速召喚】選項① 每 SL 折 5 MP（變體） */
export const ARCANIST_DISCOUNT_PER_SL = 5;

/** 這個職業名是不是秘儀師家族（核心或變體） */
export const isArcanistClassName = (className) =>
  className === ARCANIST_CLASS_NAME || className === ARCANIST_VARIANT_CLASS_NAME;

/** 角色身上的秘儀師職業條目（核心與變體互斥，取第一個命中的） */
export const getArcanistClass = (character) =>
  (character?.classes || []).find((cl) => isArcanistClassName(cl?.className)) || null;

/** 角色用的是不是變體規則——只認職業名，不認 `allowPlaytest`（開關決定能不能選，不決定選到之後怎麼算） */
export const usesVariantArcanist = (character) =>
  (character?.classes || []).some((cl) => cl?.className === ARCANIST_VARIANT_CLASS_NAME);

/** 某個職業條目裡的技能等級；沒這個技能就是 0 */
export const getArcanistSkillLevel = (character, skillName, className = null) => {
  const cl = className
    ? (character?.classes || []).find((c) => c?.className === className)
    : getArcanistClass(character);
  if (!cl) return 0;
  const sk = (cl.skills || []).find((s) => s?.name === skillName);
  const sl = sk ? Number(sk.sl) : 0;
  return Number.isFinite(sl) && sl > 0 ? sl : 0;
};

/**
 * 跑團面板要不要渲染阿爾卡納面板。
 *
 * 條件是「**這個職業條目**有綁定和召喚」，不是「角色是核心秘儀師」——
 * 舊版寫死核心職業名，變體角色因此整塊消失（實測：`hasPanelTitle: false`）。
 * `className` 由 HUD 逐職業傳入，所以同一張卡若同時有核心與變體（規則上不允許，
 * 但舊存檔可能出現）也只會在真正持有技能的那一條底下出現一次。
 */
export const shouldRenderArcanistPanel = (character, className) =>
  isArcanistClassName(className) && getArcanistSkillLevel(character, ARCANIST_BINDING_SKILL, className) > 0;

/** 已綁定的阿爾卡納 id 清單 */
export const getBoundArcanaIds = (character) => {
  const bound = character?.arcanistData?.boundArcana;
  return Array.isArray(bound) ? bound.filter((id) => typeof id === 'string' && id) : [];
};

/** 是否處於危機狀態（HP ≦ 危機值；危機值＝最大 HP 的一半，Core p.163） */
export const isInCrisis = (character) => {
  const stats = calculateCharacterStats(character) || {};
  const maxHp = Number(stats.maxHp) || 0;
  const threshold = Number(stats.crisisThreshold) || Math.floor(maxHp / 2);
  if (maxHp <= 0 || threshold <= 0) return false;
  const curHp = character?.currentHp === null || character?.currentHp === undefined
    ? maxHp
    : Number(character.currentHp);
  if (!Number.isFinite(curHp)) return false;
  return curHp > 0 && curHp <= threshold;
};

/**
 * 一次召喚的 MP 消耗明細。
 *
 * 核心：【緊急秘儀】在**危機**時折 SL×5（Core p.133）。
 * 變體：【快速召喚】是**選項**，不是常駐——由呼叫端明確傳 `quickSummon` 才折。
 * 兩者都不得讓消耗低於 0。
 */
export const getArcanistSummonCost = (character, { quickSummon = false } = {}) => {
  const variant = usesVariantArcanist(character);
  const base = variant ? ARCANIST_VARIANT_SUMMON_COST : ARCANIST_CORE_SUMMON_COST;
  const stats = calculateCharacterStats(character) || {};
  const maxMp = Number(stats.maxMp) || 0;
  const curMp = character?.currentMp === null || character?.currentMp === undefined
    ? maxMp
    : Number(character.currentMp);
  const crisis = isInCrisis(character);

  const emergencySl = variant ? 0 : getArcanistSkillLevel(character, '緊急秘儀');
  const emergencyDiscount = crisis ? emergencySl * ARCANIST_DISCOUNT_PER_SL : 0;

  const quickSl = variant ? getArcanistSkillLevel(character, '快速召喚') : 0;
  const quickDiscount = quickSummon && quickSl > 0 ? quickSl * ARCANIST_DISCOUNT_PER_SL : 0;

  const discount = emergencyDiscount + quickDiscount;
  const cost = Math.max(0, base - discount);

  return {
    variant,
    base,
    discount,
    emergencyDiscount,
    quickDiscount,
    cost,
    crisis,
    maxMp,
    curMp: Number.isFinite(curMp) ? curMp : maxMp,
    affordable: Number.isFinite(curMp) ? curMp >= cost : maxMp >= cost
  };
};

/** 召喚時立即恢復的 HP：核心【阿爾卡納再生】SL×5（變體沒有這條） */
export const getArcanistSummonHeal = (character) => {
  if (usesVariantArcanist(character)) return 0;
  return getArcanistSkillLevel(character, '阿爾卡納再生') * 5;
};

/** 自願解除時恢復的 HP：變體【秘術再生】SL×5，且**必須處於危機**（變體沒有核心那條） */
export const getArcanistDismissHeal = (character) => {
  if (!usesVariantArcanist(character)) return 0;
  if (!isInCrisis(character)) return 0;
  return getArcanistSkillLevel(character, '秘術再生') * 5;
};

/** 開局可自選的阿爾卡納數量：有綁定和召喚就是 1 個（Core p.133／變體 p.24 同樣是「開局一個」） */
export const getStartingArcanaQuota = (character) =>
  getArcanistSkillLevel(character, ARCANIST_BINDING_SKILL) > 0 ? 1 : 0;
