import {
  calculateAvatarMaxHp,
  createDefaultAvatarDraft,
  validateAvatarChoices,
  calculateAvatarAttackRange,
  calculateAvatarDamageFormula,
  calculateAvatarDamageType
} from '../src/features/character-sheet/utils/summonAvatar.js';

const results = [];
const check = (name, actual, expected, detail = '') => {
  const ok = actual === expected;
  results.push({ name, ok, detail: ok ? '' : `expected ${expected}, got ${actual} ${detail}` });
};

// 1. HP 計算公式：2 × 基本 MIG 骰面 + 角色最大 HP/2（向下取整）
const char1 = { attributes: { mig: { base: 8 } }, maxHp: 40 };
check('1. 基本 MIG d8, 最大 HP 40 -> 顯現體最大 HP 36', calculateAvatarMaxHp(char1), 36);

const char2 = { attributes: { mig: { base: 10 } }, maxHp: 55 };
check('2. 基本 MIG d10, 最大 HP 55 -> 顯現體最大 HP 47 (20 + 27)', calculateAvatarMaxHp(char2), 47);

// 2. 空白草稿
const draft = createDefaultAvatarDraft('雷霆');
check('3. 空白草稿帶入阿爾卡納名稱', draft.arcanumName, '雷霆');
check('4. 空白草稿預設 attrD10 為 mig', draft.attrD10, 'mig');

// 3. 驗證 5 組選擇
// 未選滿 2 個抗性
const invalidRes = {
  arcanumName: '雷霆',
  attrD10: 'mig',
  resistances: ['電'],
  checkAttrs: ['mig', 'wlp'],
  features: ['ranged', 'damage_bonus']
};
check('5. 抗性不足 2 項時驗證失敗', validateAvatarChoices(invalidRes).ok, false);
check('6. 抗性不足理由', validateAvatarChoices(invalidRes).reason.includes('恰好 2 項傷害抗性'), true);

// 選項不足 2 項
const invalidFeat = {
  arcanumName: '雷霆',
  attrD10: 'mig',
  resistances: ['電', '火'],
  checkAttrs: ['mig', 'wlp'],
  features: ['ranged']
};
check('7. 選項不足 2 項時驗證失敗', validateAvatarChoices(invalidFeat).ok, false);

// 選了 custom_type 但未給有效 damageType
const invalidType = {
  arcanumName: '雷霆',
  attrD10: 'mig',
  resistances: ['電', '火'],
  checkAttrs: ['mig', 'wlp'],
  features: ['custom_type', 'ranged'],
  damageType: '物理' // 必須為物理以外
};
check('8. custom_type 未選元素屬性時驗證失敗', validateAvatarChoices(invalidType).ok, false);

// 合法配置
const validChoices = {
  arcanumName: '雷霆',
  attrD10: 'mig',
  resistances: ['電', '火'],
  checkAttrs: ['mig', 'wlp'],
  features: ['custom_type', 'damage_bonus'],
  damageType: '電'
};
check('9. 填妥 5 組自選時驗證通過', validateAvatarChoices(validChoices).ok, true);

// 4. 攻擊衍生
check('10. 未選遠程時為近戰', calculateAvatarAttackRange(validChoices), '近戰');
check('11. 選了 ranged 時為遠程', calculateAvatarAttackRange({ features: ['ranged'] }), '遠程');
check('12. 選了 damage_bonus 傷害為【HR + 12】', calculateAvatarDamageFormula(validChoices), '【HR + 12】');
check('13. 未選 damage_bonus 傷害為【HR + 8】', calculateAvatarDamageFormula({ features: [] }), '【HR + 8】');
check('14. 選了 custom_type 傷害類型為指定屬性', calculateAvatarDamageType(validChoices), '電');
check('15. 未選 custom_type 傷害類型為物理', calculateAvatarDamageType({ features: [] }), '物理');

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail === '' ? '' : `  —— ${r.detail}`}`);
console.log('');
console.log(`  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) process.exit(1);

