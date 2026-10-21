/**
 * 先攻變體（INITIATIVE，變體規則）—— 公測材料 ENG 2026-10-01 印刷 p.34（PDF p.34，此書無偏移）。
 *
 * 原文（逐字）：
 *   "Conflict scenes follow a simple rule for determining which side goes first: if the
 *    conflict features no Villains, the heroes' side wins initiative. If the conflict
 *    features one or more Villains, the enemy side wins initiative."
 *   "This variant has consequences throughout the system.
 *    w Rules and effects that affect initiative no longer exist. If an option grants
 *      benefits to Initiative, do not replace it with another benefit: just ignore it.
 *    w Armor no longer gives initiative penalties; this makes the travel garb and combat
 *      tunic identical, so the combat tunic profile (as well as that of rare items based
 *      upon it) changes to granting a +2 bonus to Defense and a +0 bonus to Magic Defense.
 *    w NPCs no longer have Initiative, so elite and champion foes do not increase it, and
 *      the NPC Skill Improved Initiative is no longer available."
 *
 * ※ 這是**變體規則**（整團共同採用），不是技能變體（每人各自選）。所以它的開關住在
 *   `creationRules`（與 `allowQuirk`／`allowCustomWeapon` 同一層），不是寫在技能條目上。
 *   **預設 false**：不開啟時全站行為與核心規則逐字相同。
 *
 * ※ 為什麼要獨立一個模組而不是散在引擎裡：這條變體改了**三個不同層**的東西——
 *   防具的防禦公式（戰鬥束腰外衣）、防具的先攻減值、以及「先攻這個數字還存不存在」。
 *   三者若各自寫在各個呼叫點，遲早有一處漏改，而漏改的表現是「數字看起來正常」。
 */

/** `creationRules` 上的欄位名。 */
export const INITIATIVE_VARIANT_FIELD = 'initiativeVariant';

/** 出處（給介面與測試引用，避免各處自己打字）。 */
export const INITIATIVE_VARIANT_SOURCE = '公測材料 2026-10-01 p.34';

/**
 * 兩個關鍵防具的**中文名**。
 *
 * 原文寫的是 travel garb 與 combat tunic；本專案裝備表（`rulesData.equipment.armors`）
 * 的對應條目是「旅行皮甲」與「戰鬥輕甲」。**已對過原書 p.132（PDF p.134）的防具表**：
 *   Silk Shirt  DEX / INS+2 / -1      → 絲綢外衣
 *   Travel Garb DEX+1 / INS+1 / -1    → 旅行皮甲
 *   Combat Tunic DEX+1 / INS+1 /  —   → 戰鬥輕甲
 *   Sage Robe   DEX+1 / INS+2 / -2    → 賢者長袍
 * 兩者在核心規則下只差一個先攻減值，正好對上原文「拿掉減值之後這兩件就一樣了」。
 *
 * ※ 對外文案一律寫「戰鬥輕甲」——那是玩家在裝備表上看得到的名字。
 *   不引入第二個譯名（束腰外衣），否則同一件裝備在規則說明與裝備表上叫不同名字。
 */
export const TRAVEL_GARB_NAME = '旅行皮甲';
export const COMBAT_TUNIC_NAME = '戰鬥輕甲';

/** 變體後戰鬥輕甲的新側寫（原文：Defense +2、Magic Defense +0）。 */
export const COMBAT_TUNIC_VARIANT_PROFILE = Object.freeze({
  defFormula: 'dex+2',
  mdefFormula: 'ins'
});

/**
 * 這條變體的四條後果。
 *
 * `npc*` 三項本輪**尚未接進 NPC 工坊**（它沒有規則面板），見 docs/decisions.md §BL7。
 * 保留欄位是為了讓「哪些還沒做」是資料而不是註解。
 */
export const INITIATIVE_VARIANT_RULES = Object.freeze({
  id: 'initiativeVariant',
  label: '先攻變體',
  source: INITIATIVE_VARIANT_SOURCE,
  /** 場上沒有反派 → 英雄方先攻 */
  noVillainsHeroesFirst: true,
  /** 場上有一個以上的反派 → 敵方先攻 */
  villainsEnemiesFirst: true,
  /** 影響先攻的規則與效果一律忽略（不是替換成別的加值） */
  ignoreInitiativeEffects: true,
  /** 防具不再有先攻減值 */
  armorInitiativePenalty: false,
  /** 戰鬥束腰外衣（與以其為藍本的稀有物品）改成物防 +2／魔防 +0 */
  combatTunicProfile: COMBAT_TUNIC_VARIANT_PROFILE,
  /** NPC 沒有先攻值 */
  npcInitiative: false,
  /** 精英／冠位不再提高先攻 */
  eliteChampionInitiative: false,
  /** NPC 技能【強化先攻】不可用 */
  npcImprovedInitiative: false
});

/** 介面用的四條後果（純中文；括號內是原文本項的英文關鍵詞，供對照）。 */
export const INITIATIVE_VARIANT_NOTES = Object.freeze([
  '沒有反派時英雄方先攻；有反派時敵方先攻。',
  '影響先攻的規則與效果一律忽略，不換成別的加值。',
  '防具不再有先攻減值；戰鬥輕甲改為物防 +2、魔防 +0。',
  'NPC 沒有先攻值，精英與冠位不再提高它，【強化先攻】不可用。'
]);

/**
 * 先攻變體是否開啟。
 *
 * 接受**角色物件**（讀 `character.creationRules`）或**規則物件本身**：
 * 兩者都吃，是因為引擎拿到的是角色、面板拿到的是規則，而判定只能有一份。
 */
export const isInitiativeVariant = (characterOrRules) => {
  if (!characterOrRules || typeof characterOrRules !== 'object') return false;
  const rules = characterOrRules.creationRules && typeof characterOrRules.creationRules === 'object'
    ? characterOrRules.creationRules
    : characterOrRules;
  // 只認真正的布林 true：存檔裡出現字串 'true' 不算（壞資料不該默默打開一條變體規則）。
  return rules[INITIATIVE_VARIANT_FIELD] === true;
};

/**
 * 一件防具在**當前規則**下的側寫。
 *
 * 回傳 `{ defFormula, mdefFormula, initMod }`，語意與 `equipmentRules.parseArmorFormula`、
 * `characterEngine` 完全一致——三個呼叫點共用同一份判定，才不會出現
 * 「角色卡算對了、裝備挑選視窗算錯了」這種各算一份的分歧。
 *
 * 變體下：先攻減值一律視為 0；戰鬥束腰外衣改用新側寫。
 */
export const getArmorProfile = (armor, initiativeVariant = false) => {
  if (!armor) return null;
  const base = {
    defFormula: armor.defFormula,
    mdefFormula: armor.mdefFormula,
    initMod: Number(armor.initMod) || 0
  };
  if (!initiativeVariant) return base;
  if (armor.name === COMBAT_TUNIC_NAME) {
    return {
      defFormula: COMBAT_TUNIC_VARIANT_PROFILE.defFormula,
      mdefFormula: COMBAT_TUNIC_VARIANT_PROFILE.mdefFormula,
      initMod: 0
    };
  }
  return { ...base, initMod: 0 };
};

/**
 * 防具說明文字的變體版本。
 *
 * 說明文字（`armor.desc`）是**顯示字串**，不是計算來源（計算是靠 `defFormula`）。
 * 但它是玩家在裝備表上唯一看得到的東西——變體開了卻還寫著「先攻 -3」，
 * 玩家就會手動去扣，於是規則對了、桌上算錯了。
 *
 * 做法刻意保守：**只移除先攻片段**，其餘逐字不動；戰鬥束腰外衣整句換掉。
 * 不用「重組整句」的方式，是因為九件防具的句式並不統一（固定值那幾件沒有「靈巧 +」）。
 */
export const resolveArmorDesc = (armor, initiativeVariant = false) => {
  if (!armor) return '';
  const desc = armor.desc || '';
  if (!initiativeVariant) return desc;
  if (armor.name === COMBAT_TUNIC_NAME) {
    return '物防 = 靈巧 + 2，魔防 = 洞察';
  }
  // 移除「，先攻 -N」／「，先攻 +N」（含全形與半形減號、可能出現在句中）
  return desc
    .replace(/[，,]\s*先攻\s*[+\-−－]\s*\d+/g, '')
    .replace(/\s*先攻\s*[+\-−－]\s*\d+/g, '')
    .replace(/[，,]\s*$/, '')
    .trim();
};

/** 這條變體下，哪些裝備條目的說明文字會改變（給護欄與介面用）。 */
export const armorDescChangesUnderVariant = (armors = []) => (
  armors
    .filter((armor) => resolveArmorDesc(armor, true) !== (armor.desc || ''))
    .map((armor) => armor.name)
);

/**
 * 先攻順序（原文第一段）。
 *
 * 本專案沒有自動的衝突輪次結算，這個純函式存在的理由是**讓規則有可測的形狀**，
 * 以及讓跑團卡能把「這回合誰先」寫成人話，而不是留給 GM 記。
 */
export const describeInitiativeOrder = ({ hasVillain = false } = {}) => (
  hasVillain
    ? { side: 'enemy', label: '敵方先攻', reason: '場上有反派' }
    : { side: 'heroes', label: '英雄方先攻', reason: '場上沒有反派' }
);

/**
 * 先攻數字的顯示字串（單一來源）。
 *
 * 變體下先攻值不存在，顯示「不計」而不是 0——0 是「算出來剛好是 0」，
 * 這兩件事在桌上不一樣：前者不該被任何加值影響，後者可以被。
 *
 * ※ 順帶修掉一個既有顯示缺陷：`CharacterCard` 原本寫死 `+{stats.init}`，
 *   負值會顯示成 `+-4`。這裡統一產生帶正負號的字串。
 */
export const formatInitiative = (init, initiativeVariant = false) => {
  if (initiativeVariant) return '不計';
  const value = Number(init) || 0;
  return value >= 0 ? `+${value}` : String(value);
};

/** 變體下「先攻」這一格的說明文字（給數值構成面板用）。 */
export const initiativeVariantTermLabel = () => (
  '本團採用先攻變體：不使用先攻值'
);
