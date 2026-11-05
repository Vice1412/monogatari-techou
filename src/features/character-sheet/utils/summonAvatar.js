/**
 * 秘儀師英雄技能【偉大召喚】與【偉大召喚【變體】】的顯現體（Manifestation）純函式。
 *
 * 原書 Core p.138 & Atlas 規範：
 * 1. 等級＝角色等級。
 * 2. 最大 HP＝2 × 基本 MIG 骰面 + 角色最大 HP/2（向下取整）。
 * 3. 屬性：一個 d10，其餘三個 d8（由玩家指派）。
 * 4. 2 項傷害類型的抗性（由玩家選擇）。
 * 5. 命中檢定使用兩項不同的屬性（由玩家選出；若選了單屬性選項則改用單一屬性）。
 * 6. 基礎傷害【HR+8】（物理傷害、近戰攻擊）。
 * 7. 四選二強化選項：
 *    ① 變成遠程攻擊
 *    ② 傷害+4（傷害變為【HR+12】）
 *    ③ 變成一種物理以外的傷害類型（由玩家選定一種非物理屬性）
 *    ④ 命中檢定使用單一屬性
 * 8. 原文鐵律：「任何選擇都必須在首次召喚時做出並記錄。如果你再次使用本技能召喚相同的阿爾卡納，它會繼承最初的選擇。」
 */

export const AVATAR_DAMAGE_TYPES = Object.freeze([
  '物理', '風', '電', '暗', '土', '火', '冰', '光', '毒'
]);

export const AVATAR_ELEMENTAL_TYPES = Object.freeze([
  '風', '電', '暗', '土', '火', '冰', '光', '毒'
]);

export const AVATAR_ATTRIBUTES = Object.freeze([
  { key: 'dex', label: '敏捷 (DEX)' },
  { key: 'ins', label: '洞察 (INS)' },
  { key: 'mig', label: '力量 (MIG)' },
  { key: 'wlp', label: '意志 (WLP)' }
]);

export const AVATAR_FEATURE_OPTIONS = Object.freeze([
  { id: 'ranged', label: '變成遠程攻擊' },
  { id: 'damage_bonus', label: '傷害 +4' },
  { id: 'custom_type', label: '變成物理以外之傷害類型' },
  { id: 'single_attr', label: '命中檢定使用單一屬性' }
]);

/**
 * 計算顯現體最大 HP。
 * 公式：2 × 基本 MIG 骰面 + 角色最大 HP / 2（向下取整）。
 */
export function calculateAvatarMaxHp(character) {
  if (!character || typeof character !== 'object') return 0;
  const baseMigSize = Number(character.attributes?.mig?.base || character.attributes?.mig) || 8;
  const charMaxHp = Number(character.maxHp) || 40;
  return (2 * baseMigSize) + Math.floor(charMaxHp / 2);
}

/**
 * 建立空白的顯現體草稿。
 */
export function createDefaultAvatarDraft(arcanumName = '') {
  return {
    arcanumName: arcanumName || '',
    attrD10: 'mig',
    resistances: [],
    checkAttrs: ['mig', 'wlp'],
    features: [],
    damageType: '火',
    note: ''
  };
}

/**
 * 驗證顯現體的 5 組選擇是否已完整填齊。
 * 回傳 { ok: boolean, reason?: string }
 */
export function validateAvatarChoices(choices) {
  if (!choices || typeof choices !== 'object') {
    return { ok: false, reason: '未填寫顯現體設定' };
  }

  if (!choices.arcanumName || !choices.arcanumName.trim()) {
    return { ok: false, reason: '請指定顯現體的阿爾卡納名稱' };
  }

  // 1. 屬性分配：必須指定 1 個 d10 屬性
  if (!['dex', 'ins', 'mig', 'wlp'].includes(choices.attrD10)) {
    return { ok: false, reason: '請指派哪一個屬性為 d10' };
  }

  // 2. 抗性：必須選 2 項傷害抗性
  const res = Array.isArray(choices.resistances) ? choices.resistances : [];
  if (res.length !== 2) {
    return { ok: false, reason: '請選擇恰好 2 項傷害抗性' };
  }
  for (const r of res) {
    if (!AVATAR_DAMAGE_TYPES.includes(r)) {
      return { ok: false, reason: `無效的抗性類型：${r}` };
    }
  }

  // 3. 四選二選項：必須選恰好 2 項
  const feats = Array.isArray(choices.features) ? choices.features : [];
  if (feats.length !== 2) {
    return { ok: false, reason: '請在 4 項選項中選擇恰好 2 項' };
  }
  for (const f of feats) {
    if (!AVATAR_FEATURE_OPTIONS.some((opt) => opt.id === f)) {
      return { ok: false, reason: `無效的強化選項：${f}` };
    }
  }

  // 4. 攻擊檢定屬性
  const checkAttrs = Array.isArray(choices.checkAttrs) ? choices.checkAttrs : [];
  const singleAttrAllowed = feats.includes('single_attr');
  if (singleAttrAllowed) {
    if (checkAttrs.length !== 1 || !['dex', 'ins', 'mig', 'wlp'].includes(checkAttrs[0])) {
      return { ok: false, reason: '選擇「單一屬性檢定」時請指定 1 個檢定屬性' };
    }
  } else {
    if (
      checkAttrs.length !== 2 ||
      !['dex', 'ins', 'mig', 'wlp'].includes(checkAttrs[0]) ||
      !['dex', 'ins', 'mig', 'wlp'].includes(checkAttrs[1]) ||
      checkAttrs[0] === checkAttrs[1]
    ) {
      return { ok: false, reason: '請選擇 2 項不同的屬性作為命中檢定' };
    }
  }

  // 5. 若選了 custom_type，必須指定非物理屬性
  if (feats.includes('custom_type')) {
    if (!choices.damageType || !AVATAR_ELEMENTAL_TYPES.includes(choices.damageType)) {
      return { ok: false, reason: '選擇「物理以外之傷害類型」時請指定元素屬性' };
    }
  }

  return { ok: true };
}

/**
 * 衍生攻擊範圍：近戰 or 遠程
 */
export function calculateAvatarAttackRange(choices) {
  const feats = Array.isArray(choices?.features) ? choices.features : [];
  return feats.includes('ranged') ? '遠程' : '近戰';
}

/**
 * 衍生基礎傷害字串
 */
export function calculateAvatarDamageFormula(choices) {
  const feats = Array.isArray(choices?.features) ? choices.features : [];
  const bonus = feats.includes('damage_bonus') ? 12 : 8;
  return `【HR + ${bonus}】`;
}

/**
 * 衍生攻擊傷害類型
 */
export function calculateAvatarDamageType(choices) {
  const feats = Array.isArray(choices?.features) ? choices.features : [];
  if (feats.includes('custom_type') && choices.damageType) {
    return choices.damageType;
  }
  return '物理';
}

