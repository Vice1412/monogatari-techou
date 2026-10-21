/**
 * 混合變形（Theriomorphosis）變體 —— 公測 2026-10-01 p.40 的規則層
 *
 * ## 為什麼要有這個模組
 *
 * 【混合變形】本身早就實裝了（`skillSuboptionsData.js` 的 12 種混合形態、
 * `SkillSuboptionModal` 的挑選器、`SuboptionDetailsList` 的顯示），
 * 但**變體與原版的差別不在「有幾個形態」，而在「怎麼用」**：
 *
 * | 項目 | 原版（科技奇幻 p.155） | 公測 p.40 變體 |
 * |---|---|---|
 * | 動作 | 一個動作 | 一個動作 |
 * | HP 消耗 | **當前 HP 的三分之一**（向下取整） | **固定 20 點** |
 * | 顯現形態數 | 至多 **2** 個 | 至多 **2** 個 |
 * | 之後 | 無 | **可自由攻擊一次**（高擲視為 0；透過【基因分析】執行時沒有） |
 * | 【進階混合變形】 | 3 個 ＋ **追加一個動作** | 3 個，**沒有追加動作** |
 *
 * 所以變體**不動形態庫、不動配額**（兩者都是「每取得一次學一個形態」＝ SL 個），
 * 只改「消耗、顯現上限、後續動作」與【進階混合變形】的文本。
 * 把這四件事寫成資料，是為了讓介面與測試讀同一份真相，而不是各自記一次。
 *
 * ## 官方原文（Playtest 2026-10-01, PDF p.40）
 *
 *   「Each time you acquire this Skill, you learn a therioform.
 *     You may use an action and spend 20 Hit Points to manifest the effects of
 *     up to two therioforms you have learned. Then, if you did not perform this
 *     Skill through Genoclepsis, you may perform a free attack with a weapon you
 *     have equipped. If you do, treat your High Roll as being 0 when determining
 *     damage dealt by this attack.
 *     If you play with this variant, the text of the Greater Theriomorphosis
 *     Heroic Skill changes to the following: …up to three therioforms from those
 *     you have learned (instead of two).」
 *
 * ※ 官方在【進階混合變形】的變體版本裡**沒有**再提「追加一個動作」，
 *    而原版有。這一條是最容易漏掉的差異——它不是「多一個形態」而已。
 */

/** 變體 id：與 `coreBookVariants.js` 的 `theriomorphosisVariant` 一致。 */
export const THERIOMORPHOSIS_VARIANT_ID = 'theriomorphosisVariant';

/** 技能名（`skills[].name` 永遠是原版名，變體只記在 `variantId`）。 */
export const THERIOMORPHOSIS_SKILL = '混合變形';

/** 會因為這個變體而改寫文本的英雄技能。 */
export const GREATER_THERIOMORPHOSIS_SKILL = '進階混合變形';

/** 讓變體「不給自由攻擊」的那個技能（官方：through Genoclepsis）。 */
export const GENOCLEPSIS_SKILL = '基因分析';

/** 變體的固定 HP 消耗（原版是按比例，所以這裡是 `null` 的那一邊）。 */
export const THERIOMORPHOSIS_FIXED_HP_COST = 20;

/**
 * 兩套規則。**一律 `Object.freeze`**——這是規則常數，不是可調參數；
 * 任何一端被就地改寫都會讓介面與測試同時說謊，而且不會有任何錯誤訊息。
 */
export const THERIOMORPHOSIS_RULES = Object.freeze({
  base: Object.freeze({
    id: 'base',
    label: '原版（科技奇幻 p.155）',
    hpCostKind: 'fraction',
    hpCostDivisor: 3,
    hpCostValue: null,
    hpCostLabel: '當前 HP 的三分之一（向下取整）',
    manifestCap: 2,
    freeAttack: false,
    freeAttackNote: '',
    greaterManifestCap: 3,
    greaterExtraAction: true
  }),
  variant: Object.freeze({
    id: THERIOMORPHOSIS_VARIANT_ID,
    label: '公測 p.40 變體',
    hpCostKind: 'fixed',
    hpCostDivisor: null,
    hpCostValue: THERIOMORPHOSIS_FIXED_HP_COST,
    hpCostLabel: '20 點 HP',
    manifestCap: 2,
    freeAttack: true,
    freeAttackNote: '高擲視為 0；透過【基因分析】執行時沒有這次自由攻擊',
    greaterManifestCap: 3,
    greaterExtraAction: false
  })
});

/**
 * 依變體 id 取規則。**任何不是變體 id 的值都回原版**——
 * 舊存檔沒有 `variantId`、壞資料寫了不存在的 id，行為都必須與以往完全相同。
 */
export const getTheriomorphosisRules = (variantId) =>
  (variantId === THERIOMORPHOSIS_VARIANT_ID
    ? THERIOMORPHOSIS_RULES.variant
    : THERIOMORPHOSIS_RULES.base);

/** 這個 id 是不是混合變形變體。 */
export const isTheriomorphosisVariant = (variantId) =>
  variantId === THERIOMORPHOSIS_VARIANT_ID;

/**
 * 從角色身上找出【混合變形】那一筆技能條目（沒有回 null）。
 * 變體狀態住在技能上，不在角色上——這是 §AW 的資料模型決定的。
 */
export const findTheriomorphosisSkill = (character) => {
  const classes = Array.isArray(character?.classes) ? character.classes : [];
  for (const cls of classes) {
    const skills = Array.isArray(cls?.skills) ? cls.skills : [];
    const hit = skills.find((s) => s?.name === THERIOMORPHOSIS_SKILL);
    if (hit) return hit;
  }
  return null;
};

/** 這張卡有沒有選用混合變形變體。 */
export const isTheriomorphosisVariantAdopted = (character) =>
  isTheriomorphosisVariant(findTheriomorphosisSkill(character)?.variantId);

/** 這張卡有沒有【進階混合變形】（決定顯現上限是 2 還是 3）。 */
export const hasGreaterTheriomorphosis = (character) =>
  (Array.isArray(character?.heroicSkills) ? character.heroicSkills : []).some((h) => {
    const name = typeof h === 'string' ? h : h?.name;
    return name === GREATER_THERIOMORPHOSIS_SKILL;
  });

/**
 * 顯現上限：2（一般）／3（有【進階混合變形】）。
 * 原版與變體的**上限數字相同**，差別只在變體版本沒有追加動作——
 * 所以這支刻意不吃 `variantId`，只吃「有沒有進階」。
 */
export const getManifestCap = (rules, { hasGreater = false } = {}) => {
  const r = rules || THERIOMORPHOSIS_RULES.base;
  return hasGreater ? r.greaterManifestCap : r.manifestCap;
};

/**
 * 這次使用要付多少 HP。
 * 原版是**當前 HP 的三分之一（向下取整）**，所以需要 `currentHp`；
 * 變體是固定值，`currentHp` 傳什麼都不影響。
 *
 * @param {object} rules `getTheriomorphosisRules()` 的回傳值
 * @param {number} [currentHp] 當前 HP（原版用）
 * @returns {number} HP 消耗
 */
export const getTheriomorphosisHpCost = (rules, currentHp) => {
  const r = rules || THERIOMORPHOSIS_RULES.base;
  if (r.hpCostKind === 'fixed') return r.hpCostValue;
  const hp = Number(currentHp);
  if (!Number.isFinite(hp) || hp <= 0) return 0;
  return Math.floor(hp / r.hpCostDivisor);
};

/**
 * 【進階混合變形】在變體下的替換文本（官方 p.40 逐句對應）。
 * 刻意**不含**「追加一個動作」——那是原版才有的一段。
 */
export const GREATER_THERIOMORPHOSIS_VARIANT_EFFECT =
  '在衝突場景中，當你在你的回合內使用混合變形技能後，'
  + '若這不是透過【基因分析】技能觸發，你可以顯性表達出**三個**你已習得的混合形態'
  + '（而非原來的兩個）。（變體版本不提供追加動作。）';

/**
 * 英雄技能的效果文本解析：選了混合變形變體時，【進階混合變形】換成變體版本。
 *
 * 為什麼要在**顯示時**換、而不是在取得時改寫角色資料：
 * ① 角色身上的 `heroicSkills[].effect` 是取得當下的快照，改寫它等於竄改歷史；
 * ② 變體是**玩家自己**可以隨時改回的選擇（§AW），改回原版時文本必須跟著回來；
 * ③ 三處顯示（角色卡、編輯器、三頁匯出）共用同一支，才不會只改到一半。
 *
 * @param {string} skillName 英雄技能名
 * @param {string} effectText 原本的效果文本
 * @param {object} character 角色（用來判斷有沒有選用變體）
 */
export const resolveHeroicSkillEffect = (skillName, effectText, character) => {
  if (skillName !== GREATER_THERIOMORPHOSIS_SKILL) return effectText;
  return isTheriomorphosisVariantAdopted(character)
    ? GREATER_THERIOMORPHOSIS_VARIANT_EFFECT
    : effectText;
};

/**
 * 給介面用的一段摘要（挑選器與技能列共用）。
 * 回傳的是**純文字陣列**，圖示與樣式由呼叫端決定。
 */
export const describeTheriomorphosis = (rules, { hasGreater = false, currentHp = null } = {}) => {
  const r = rules || THERIOMORPHOSIS_RULES.base;
  const lines = [
    `消耗：${r.hpCostLabel}`,
    `顯現：至多 ${getManifestCap(r, { hasGreater })} 個已習得的混合形態`
  ];
  if (r.freeAttack) lines.push(`之後：${r.freeAttackNote}`);
  if (hasGreater && !r.greaterExtraAction) lines.push('【進階混合變形】：沒有追加動作');
  if (r.hpCostKind === 'fraction' && Number.isFinite(Number(currentHp)) && Number(currentHp) > 0) {
    lines[0] = `消耗：${r.hpCostLabel}（當前 ${Number(currentHp)} → ${getTheriomorphosisHpCost(r, currentHp)}）`;
  }
  return lines;
};
