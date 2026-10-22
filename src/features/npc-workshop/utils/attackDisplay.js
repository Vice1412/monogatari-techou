/**
 * 攻擊欄位「選單 vs 寫死值」的解析規則。
 *
 * 為什麼要抽這一支（2026-10-22 使用者回報的兩個現象）：
 * 同一張攻擊卡上有**兩套控制同一欄位的介面**——
 *   1. 卡片上的「距離／屬性」下拉選單（存在 `skill.selections`）；
 *   2. 「編輯」面板裡的 距離／公式／屬性 下拉（直接寫進 `skill.attack`）。
 * 而顯示端只有在「值是 `{key}` 佔位符」時才會去讀選單，於是：
 *   - 編輯面板把 `attack.type` 寫成寫死值（例：冰）之後，選單再怎麼選都不生效
 *     ——使用者看到的現象是「屬性沒有照著我已經選的內容」；
 *   - 那個寫死值會跟著存檔，之後永遠改不回來——「保存之後就亂掉了、強制固定」。
 *
 * 這裡把規則收斂成一句話：**只要技能宣告了同名的選單欄位，選單就是唯一真相。**
 * 顯示端（`EditableSkill`／`ReadOnlySkill`／`npcTextExport`）與儲存端共用這一支，
 * 三份實作才不會各自漂移。
 */

const PLACEHOLDER_RE = /^\{([A-Za-z0-9_]+)\}$/;

/** 這個技能是否宣告了名為 `key` 的選單欄位。 */
export const hasSelectionKey = (selectionsConfig, key) =>
  Array.isArray(selectionsConfig) && selectionsConfig.some((cfg) => cfg && cfg.key === key);

const isFilled = (v) => v !== undefined && v !== null && v !== '';

/**
 * 解析單一攻擊欄位。
 *
 * 優先序：
 *   1. 技能宣告了同名選單欄位 → 用選單的值（即使 attack 裡寫死了別的值）。
 *   2. 值本身是 `{someKey}` 佔位符 → 用 `selections[someKey]`。
 *   3. 以上皆非 → 原樣回傳（尊重刻意寫死的值，例如「強力攻擊一律近戰」）。
 */
export const resolveAttackField = (value, key, selections, selectionsConfig) => {
  if (hasSelectionKey(selectionsConfig, key) && isFilled(selections?.[key])) {
    return selections[key];
  }
  if (typeof value === 'string') {
    const m = value.match(PLACEHOLDER_RE);
    if (m && isFilled(selections?.[m[1]])) return selections[m[1]];
  }
  return value;
};

/** 把整組攻擊欄位解析成「畫面上真正要顯示的值」。 */
export const resolveAttack = (attack, selections, selectionsConfig) => {
  if (!attack) return attack;
  return {
    ...attack,
    distance: resolveAttackField(attack.distance, 'distance', selections, selectionsConfig),
    formula: resolveAttackField(attack.formula, 'formula', selections, selectionsConfig),
    type: resolveAttackField(attack.type, 'type', selections, selectionsConfig),
  };
};

/**
 * 儲存前把「被寫死的值」還原成佔位符。
 *
 * 只有技能**宣告了同名選單**時才還原——那種情況下寫死等於把選單永久鎖住。
 * 沒有同名選單的欄位（例如某些攻擊的距離固定為近戰）一律原樣保留。
 */
export const unfreezeAttackField = (value, key, selectionsConfig) => {
  if (!hasSelectionKey(selectionsConfig, key)) return value;
  if (typeof value !== 'string' || value === '') return value;
  if (PLACEHOLDER_RE.test(value)) return value;
  return `{${key}}`;
};
