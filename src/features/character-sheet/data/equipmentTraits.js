/**
 * 裝備與飾品特性資料模組（equipmentTraits.js）
 * 包含官方核心規則中武器、防具、盾牌、飾品的所有特性與花費，供選購與【升級】流程使用。
 */

export const EQUIPMENT_TRAITS = Object.freeze([
  // ── 武器專屬特性 ──────────────────────────────────────────────
  {
    id: 'traitArcane',
    name: '魔能',
    cost: 100,
    slots: ['weapon'],
    effect: '該武器攻擊對抗的是魔防，而不是物防'
  },
  {
    id: 'traitHunter',
    name: '獵人',
    cost: 300,
    slots: ['weapon'],
    effect: '該武器對某一特定物種的生物造成 5 點額外傷害',
    choice: {
      key: 'species',
      label: '物種',
      options: ['野獸', '類人', '怪物', '植物', '不死', '惡魔', '元素', '構造體']
    }
  },
  {
    id: 'traitPierce',
    name: '穿刺',
    cost: 400,
    slots: ['weapon'],
    effect: '該武器造成的傷害無視抗性'
  },
  {
    id: 'traitDoubleHunter',
    name: '雙重獵人',
    cost: 500,
    slots: ['weapon'],
    effect: '該武器對屬於兩個特定物種的生物造成額外 5 點傷害',
    choice: {
      key: 'species',
      label: '物種',
      multi: 2,
      options: ['野獸', '類人', '怪物', '植物', '不死', '惡魔', '元素', '構造體']
    }
  },
  {
    id: 'traitMulti',
    name: '多重',
    cost: 1000,
    slots: ['weapon'],
    effect: '使用該武器的攻擊具有多重（2）'
  },
  {
    id: 'traitInflictState',
    name: '狀態',
    cost: 1500,
    slots: ['weapon'],
    effect: '使用該武器造成的攻擊對目標施加一種狀態效果',
    choice: {
      key: 'status',
      label: '施加的狀態',
      options: ['眩暈', '動搖', '緩慢', '虛弱', '憤怒', '中毒']
    }
  },
  {
    id: 'traitInflictStatePlus',
    name: '狀態+',
    cost: 2000,
    slots: ['weapon'],
    effect: '使用該武器造成的攻擊對目標施加兩種狀態效果',
    choice: {
      key: 'status',
      label: '施加的狀態',
      multi: 2,
      options: ['眩暈', '動搖', '緩慢', '虛弱', '憤怒', '中毒']
    }
  },

  // ── 武器／防具／盾牌共用特性 ────────────────────────────────────
  {
    id: 'traitState',
    name: '反狀態',
    cost: 500,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你對一種狀態效果免疫',
    choice: {
      key: 'status',
      label: '免疫的狀態',
      options: ['眩暈', '動搖', '緩慢', '虛弱', '憤怒', '中毒']
    }
  },
  {
    id: 'traitResist',
    name: '抗性',
    cost: 700,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你獲得對一種傷害類型（非物理）的抗性',
    choice: {
      key: 'damageType',
      label: '抗性的傷害類型',
      options: ['風', '電', '暗', '土', '火', '冰', '光', '毒']
    }
  },
  {
    id: 'traitCharm',
    name: '護身符',
    cost: 800,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你的魔防 +1'
  },
  {
    id: 'traitBulwark',
    name: '壁壘',
    cost: 800,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你的物防 +1'
  },
  {
    id: 'traitDoubleResist',
    name: '雙重抗性',
    cost: 1000,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你獲得對兩種傷害類型（非物理）的抗性',
    choice: {
      key: 'damageType',
      label: '抗性的傷害類型',
      multi: 2,
      options: ['風', '電', '暗', '土', '火', '冰', '光', '毒']
    }
  },
  {
    id: 'traitSwordbreaker',
    name: '破劍者',
    cost: 1000,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你獲得對物理傷害的抗性'
  },
  {
    id: 'traitImmunity',
    name: '免疫',
    cost: 1500,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你對一種傷害類型（非物理）免疫',
    choice: {
      key: 'damageType',
      label: '免疫的傷害類型',
      options: ['風', '電', '暗', '土', '火', '冰', '光', '毒']
    }
  },
  {
    id: 'traitPerfectHealth',
    name: '完美健康',
    cost: 2000,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你免疫所有狀態效果'
  },
  {
    id: 'traitOmniShield',
    name: '全能盾',
    cost: 2000,
    slots: ['weapon', 'armor', 'shield'],
    effect: '你的物防 +2，魔防 +2'
  },

  // ── 飾品特性（不在【升級】範圍）────────────────────────────────
  {
    id: 'traitDamageConvert',
    name: '傷害轉換',
    cost: 300,
    slots: ['accessory'],
    effect: '你的武器、咒語、技能所造成的傷害全部轉換為一個特定的傷害類型',
    choice: {
      key: 'damageType',
      label: '轉換的傷害類型',
      options: ['物理', '風', '電', '暗', '土', '火', '冰', '光', '毒']
    }
  },
  {
    id: 'traitInitUp',
    name: '先攻提高',
    cost: 500,
    slots: ['accessory'],
    effect: '如果你在衝突開始時裝備著這個飾品，你的先攻 +4'
  },
  {
    id: 'traitHitUp',
    name: '命中提高',
    cost: 1000,
    slots: ['accessory'],
    effect: '你的命中檢定 +1'
  },
  {
    id: 'traitMagicUp',
    name: '魔法提高',
    cost: 1000,
    slots: ['accessory'],
    effect: '你的施法檢定 +1'
  },
  {
    id: 'traitVigor',
    name: '生命力強化',
    cost: 1000,
    slots: ['accessory'],
    effect: '當你恢復 HP 時，額外恢復 5 點 HP'
  },
  {
    id: 'traitHealing',
    name: '癒合力強化',
    cost: 1500,
    slots: ['accessory'],
    effect: '當你受到治療或恢復 HP 時，額外恢復 10 點 HP'
  },
  {
    id: 'traitSpellBoost',
    name: '咒語強化',
    cost: 2000,
    slots: ['accessory'],
    effect: '你施展的咒語造成的傷害 +5'
  },
  {
    id: 'traitWeaponBoost',
    name: '武具強化',
    cost: 2000,
    slots: ['accessory'],
    effect: '你的武器攻擊造成的傷害 +5',
    choice: {
      key: 'weaponType',
      label: '武器類型',
      options: ['近戰武器', '遠程武器']
    }
  }
]);

/**
 * 依欄位（weapon / armor / shield / accessory）與金額上限取得可用特性。
 * @param {string} slot 裝備槽位
 * @param {number} maxCost 價格上限（預設無上限）
 * @returns {Array<object>}
 */
export const traitsFor = (slot, maxCost = Infinity) => {
  if (!slot || typeof slot !== 'string') return [];
  const limit = Number.isFinite(Number(maxCost)) ? Number(maxCost) : Infinity;
  return EQUIPMENT_TRAITS.filter((t) => Array.isArray(t.slots) && t.slots.includes(slot) && t.cost <= limit);
};

/**
 * 【升級】的實際支付金額：Z − 高瞻遠矚SL × 100（最低 0）。
 * @param {object|number} trait 特性物件或價格數值
 * @param {number} foresightSL 高瞻遠矚技能等級（預設 0）
 * @returns {number}
 */
export const traitPrice = (trait, foresightSL = 0) => {
  const baseCost = typeof trait === 'number' ? trait : (trait?.cost || 0);
  const sl = Math.max(0, Number(foresightSL) || 0);
  return Math.max(0, baseCost - sl * 100);
};
