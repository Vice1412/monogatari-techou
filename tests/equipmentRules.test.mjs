/**
 * 裝備配置規則層測試。
 *
 * 執行：npm run test:equipment
 *
 * 全部期望值取自官方英文核心規則書 v1.1（印刷頁碼）：
 * - 基本武器表 p.130–131（十個類別、命中屬性、傷害、持握、遠近、職業標記）
 * - 基本防具表 p.132（含先攻欄）
 * - 基本盾牌表 p.133
 * - 職業武裝的職業對應 p.126
 * - 守護者【雙重盾牌】：主手可裝備盾牌；兩手皆盾時合併為格鬥類別雙手近戰武器「雙盾」
 * - 起始裝備預算 500z p.164（僅限基本裝備；飾品一律稀有，不列入）
 */
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import { ALL_STARTER_PRESETS } from '../src/features/character-sheet/data/starterPresets';
import {
  CUSTOMIZATIONS,
  CUSTOM_WEAPON_CATEGORIES,
  CUSTOM_WEAPON_ELEMENTS,
  buildCustomWeaponEntry,
  createCustomWeaponSpec,
  customWeaponCost,
  customWeaponDamageBonus,
  isMartialCustomWeapon,
  remainingSlots,
  usedSlots,
  validateCustomWeapon,
  equipCustomWeapon,
  groupCustomWeapons,
  equippedFormIndex,
  nextFormFor,
  syncEquipmentNames
} from '../src/features/character-sheet/data/customWeapons';
import {
  WEAPON_CATEGORIES,
  DICE_ATTRS,
  EQUIPMENT_ICONS,
  EQUIPMENT_SLOTS,
  SORT_OPTIONS,
  diceFromStats,
  parseAccuracy,
  parseDamage,
  parseArmorFormula,
  evaluateWeapon,
  computeArmorOutcome,
  computeShieldOutcome,
  requiredProficiency,
  shieldProficiency,
  checkEquippable,
  hasSkill,
  getSkillLevel,
  getDualShieldState,
  DUAL_SHIELD,
  buildLoadoutIssues,
  filterWeapons,
  sortWeapons,
  isTwoHanded,
  isUnarmedStrike,
  isShieldItem,
  applyEquipmentChoice,
  getEquipmentIcon
} from '../src/features/character-sheet/utils/equipmentRules.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EquipmentPickerBody } from '../src/features/character-sheet/components/EquipmentPickerModal.jsx';
import EquipmentSlotCard from '../src/features/character-sheet/components/EquipmentSlotCard.jsx';
import { GAME_ICONS_MAP } from '../src/components/ui/GameIcon.jsx';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';
import { createNewCharacter, calculateCharacterStats } from '../src/features/character-sheet/utils/characterEngine.js';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};
const section = (t) => lines.push(`\n=== ${t} ===`);

const weaponsByName = new Map(rulesData.equipment.weapons.map((w) => [w.name, w]));
const armorsByName = new Map(rulesData.equipment.armors.map((a) => [a.name, a]));
const shieldsByName = new Map(rulesData.equipment.shields.map((s) => [s.name, s]));
const accessoriesByName = new Map(rulesData.equipment.accessories.map((a) => [a.name, a]));

const noProfs = { martialMelee: false, martialRanged: false, martialArmor: false, martialShields: false };
const allProfs = { martialMelee: true, martialRanged: true, martialArmor: true, martialShields: true };

// ─────────────────────────────────────────────────────────── A
section('A. 條目解析：命中屬性與傷害（Core p.131 的寫法）');

check('parseAccuracy("DEX + MIG")', parseAccuracy('DEX + MIG'), { accuracyBonus: 0, attrs: ['DEX', 'MIG'] });
check('parseAccuracy("DEX + INS + 1")', parseAccuracy('DEX + INS + 1'), { accuracyBonus: 1, attrs: ['DEX', 'INS'] });
check('parseAccuracy("MIG + MIG") 同屬性兩顆', parseAccuracy('MIG + MIG'), { accuracyBonus: 0, attrs: ['MIG', 'MIG'] });
check('parseDamage("【HR + 6】物理")', parseDamage('【HR + 6】物理'), { damageBonus: 6, damageType: '物理' });
check('parseDamage("【HR + 0】物理")', parseDamage('【HR + 0】物理'), { damageBonus: 0, damageType: '物理' });
check('parseDamage 空字串不臆測', parseDamage(''), { damageBonus: 0, damageType: '物理' });

check('parseArmorFormula("dex")', parseArmorFormula('dex'), { kind: 'dex', bonus: 0 });
check('parseArmorFormula("ins+2")', parseArmorFormula('ins+2'), { kind: 'ins', bonus: 2 });
check('parseArmorFormula("11")', parseArmorFormula('11'), { kind: 'fixed', value: 11 });
check('parseArmorFormula("怪字串") 不臆測', parseArmorFormula('怪字串'), { kind: 'unknown', value: 0 });

// ─────────────────────────────────────────────────────────── B
section('B. 基本武器資料逐筆核對官方原書（Core p.130–131）');

// [類別, 價格, 命中屬性, 命中加值, 傷害加值, 持握, 遠近, 職業]
const CORE_WEAPONS = {
  徒手打擊: ['鬥毆', 0, 'DEX + MIG', 0, 0, 1, '近戰', false],
  鐵指虎: ['鬥毆', 150, 'DEX + MIG', 0, 6, 1, '近戰', false],
  短匕首: ['匕首', 150, 'DEX + INS', 1, 4, 1, '近戰', false],
  青銅劍: ['劍', 200, 'DEX + MIG', 1, 6, 1, '近戰', true],
  巨劍: ['劍', 200, 'DEX + MIG', 1, 10, 2, '近戰', true],
  武士刀: ['劍', 200, 'DEX + INS', 1, 10, 2, '近戰', true],
  刺劍: ['劍', 200, 'DEX + INS', 1, 6, 1, '近戰', true],
  闊斧: ['重型', 250, 'MIG + MIG', 0, 10, 1, '近戰', true],
  戰斧: ['重型', 250, 'MIG + MIG', 0, 14, 2, '近戰', true],
  鐵錘: ['重型', 200, 'MIG + MIG', 0, 6, 1, '近戰', false],
  輕長矛: ['矛', 200, 'DEX + MIG', 0, 8, 1, '近戰', true],
  重長矛: ['矛', 200, 'DEX + MIG', 0, 12, 2, '近戰', true],
  法杖: ['奧術', 100, 'WLP + WLP', 0, 6, 2, '近戰', false],
  魔導書: ['奧術', 100, 'INS + INS', 0, 6, 2, '近戰', false],
  戰弓: ['弓', 150, 'DEX + INS', 0, 8, 2, '遠程', false],
  短弓: ['弓', 200, 'DEX + DEX', 0, 8, 2, '遠程', false],
  手槍: ['火器', 250, 'DEX + INS', 0, 8, 1, '遠程', true],
  手裡劍: ['投擲', 150, 'DEX + INS', 0, 4, 1, '遠程', false],
  鎖鏈鞭: ['連枷', 150, 'DEX + DEX', 0, 8, 2, '近戰', false],
  '臨時武器（近戰）': ['鬥毆', 0, 'DEX + MIG', 0, 2, 1, '近戰', false],
  '臨時武器（遠程）': ['投擲', 0, 'DEX + MIG', 0, 2, 1, '遠程', false]
};

Object.entries(CORE_WEAPONS).forEach(([name, expected]) => {
  const w = weaponsByName.get(name);
  if (!w) {
    check(`原書武器存在：${name}`, Boolean(w), true);
    return;
  }
  const acc = parseAccuracy(w.attr);
  const dmg = parseDamage(w.damage);
  check(`原書核對：${name}`, [
    w.category, w.cost, acc.attrs.join(' + '), acc.accuracyBonus, dmg.damageBonus,
    Number(w.hands), w.range, Boolean(w.martial)
  ], expected);
});

/**
 * 2026-10-05 使用者裁定刪除。
 *
 * 出處追查結論：這三筆在 repo 的**第一個 commit**（`a7232b0`）就已存在，屬最早的手寫種子資料；
 * 同一批種子的其他數值與原書明顯不符（青銅劍 100z、絲綢外衣／旅行皮甲先攻 0、鋼鐵板甲 500z、
 * 青銅胸甲物防 10），證明它不是照抄原書表格，而是憑印象或二手來源填的。
 * 英文名 Broadsword／Spear／Heavy Musket 在下列來源全部查無：
 * 核心規則書 v1.1、另一份核心規則書、三本 Atlas、官方特典、Bestiary Vol.1、八份 Playtest、
 * Press Start（兩版）、GM Toolkit、CHM 漢化（僅收三本 Atlas 內容）、繁中角色卡 Excel V2.17、
 * 以及使用者自己的裝備設計器「基底」表。
 */
const REMOVED_UNSOURCED = ['闊劍', '長槍', '重型火槍'];
section('C. 已清除：查無官方出處的三筆武器（不得回流）');
check('三筆已不在武器表中', REMOVED_UNSOURCED.filter((n) => weaponsByName.has(n)), []);
check('三筆的圖示對照也已移除', REMOVED_UNSOURCED.filter((n) => EQUIPMENT_ICONS[n]), []);
check('武器表為 21 筆（原書 18 種基本武器 ＋ 空手 ＋ 兩種臨時武器）',
  rulesData.equipment.weapons.length, 21);
check('盾牌表為 3 筆（不裝備 ＋ 原書兩面基本盾牌）', rulesData.equipment.shields.length, 3);
check('同源的 `重型塔盾` 也一併移除，且圖示對照不留殘項',
  [shieldsByName.has('重型塔盾'), Boolean(EQUIPMENT_ICONS['重型塔盾'])], [false, false]);
check('舊存檔若仍寫著被刪除的名稱，會被標成「查無此裝備」而不是靜默消失',
  buildLoadoutIssues({
    character: { equipment: { mainHand: '闊劍', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' } },
    stats: { profs: allProfs },
    weaponMap: weaponsByName,
    armorMap: armorsByName,
    shieldMap: shieldsByName,
    accessoryMap: accessoriesByName
  }).map((i) => i.message),
  ['資料表中查無：主手「闊劍」（不計入預算，請確認是否為自訂名稱）']);

// ─────────────────────────────────────────────────────────── D
section('D. 類別與欄位完整性（防手滑打錯字）');
const CATEGORY_KEYS = WEAPON_CATEGORIES.map((c) => c.key);
check('十大類別數量', CATEGORY_KEYS.length, 10);
check('十大類別內容（Core p.129）', CATEGORY_KEYS,
  ['奧術', '弓', '鬥毆', '匕首', '火器', '連枷', '重型', '矛', '劍', '投擲']);
check('所有武器類別都在十大類別內',
  rulesData.equipment.weapons.filter((w) => !CATEGORY_KEYS.includes(w.category)).map((w) => w.name), []);
check('所有武器都有 hands',
  rulesData.equipment.weapons.filter((w) => ![1, 2].includes(Number(w.hands))).map((w) => w.name), []);
check('所有武器都有 range',
  rulesData.equipment.weapons.filter((w) => !['近戰', '遠程'].includes(w.range)).map((w) => w.name), []);
check('所有武器的命中屬性都是合法四維',
  rulesData.equipment.weapons.filter((w) => {
    const { attrs } = parseAccuracy(w.attr);
    return attrs.length !== 2 || attrs.some((a) => !DICE_ATTRS.includes(a));
  }).map((w) => w.name), []);

// 首版種子資料曾在法杖上多加一個原書沒有的「魔攻檢定 +1」，2026-10-05 查出無出處後移除
check('法杖的欄位與原書一致，不得再長出額外欄位',
  Object.keys(weaponsByName.get('法杖')).sort(),
  ['attr', 'category', 'cost', 'damage', 'hands', 'name', 'range']);
check('全表沒有任何武器帶「魔攻加值」這類未經原書核實的欄位',
  rulesData.equipment.weapons.filter((w) => 'magicBonus' in w).map((w) => w.name), []);

// ─────────────────────────────────────────────────────────── E
section('E. 裝備圖示對照表（來源：使用者的裝備設計器，逐項 IoU 比對）');

check('每一件武器都有對應圖示',
  rulesData.equipment.weapons.filter((w) => !EQUIPMENT_ICONS[w.name]).map((w) => w.name), []);
check('每一件防具都有對應圖示',
  rulesData.equipment.armors.filter((a) => !EQUIPMENT_ICONS[a.name]).map((a) => a.name), []);
check('每一面盾牌都有對應圖示',
  rulesData.equipment.shields.filter((s) => !EQUIPMENT_ICONS[s.name]).map((s) => s.name), []);
check('雙盾也有對應圖示', EQUIPMENT_ICONS[DUAL_SHIELD.name], 'GiDragonShield');
check('所有圖示鍵都是 GameIcon 認得的元件名（打錯字會在這裡斷掉）',
  Object.entries(EQUIPMENT_ICONS)
    .filter(([, iconKey]) => !GAME_ICONS_MAP[iconKey])
    .map(([name, iconKey]) => `${name} → ${iconKey}`),
  []);
check('getEquipmentIcon 查得到時回傳對照表的值', getEquipmentIcon('青銅劍'), 'GiGladius');
check('getEquipmentIcon 查不到時回退', getEquipmentIcon('不存在的武器', 'cat_sword'), 'cat_sword');

// ─────────────────────────────────────────────────────────── F
section('F. 基本防具逐筆核對官方原書（Core p.132）');
// [價格, 物防公式, 魔防公式, 先攻]
const CORE_ARMORS = {
  '無裝甲 / 冒險服': [0, 'dex', 'ins', 0],
  絲綢外衣: [100, 'dex', 'ins+2', -1],
  旅行皮甲: [100, 'dex+1', 'ins+1', -1],
  戰鬥輕甲: [150, 'dex+1', 'ins+1', 0],
  賢者長袍: [200, 'dex+1', 'ins+2', -2],
  板條甲: [150, '10', 'ins', -2],
  青銅胸甲: [200, '11', 'ins', -3],
  符文甲冑: [250, '11', 'ins+1', -3],
  鋼鐵板甲: [300, '12', 'ins', -4]
};
Object.entries(CORE_ARMORS).forEach(([name, expected]) => {
  const a = armorsByName.get(name);
  if (!a) {
    check(`原書防具存在：${name}`, Boolean(a), true);
    return;
  }
  check(`原書核對：${name}`, [a.cost, a.defFormula, a.mdefFormula, a.initMod], expected);
});

check('職業防具標記正確',
  rulesData.equipment.armors.filter((a) => a.martial).map((a) => a.name),
  ['板條甲', '青銅胸甲', '符文甲冑', '鋼鐵板甲']);

// 官方 Camilla 向量：靈巧 d8、洞察 d10、旅行皮甲 → 物防 9、魔防 11、先攻 -1
const camillaDice = { DEX: 8, INS: 10, MIG: 8, WLP: 8 };
check('官方向量：旅行皮甲（DEX d8 / INS d10）',
  computeArmorOutcome(armorsByName.get('旅行皮甲'), camillaDice), { def: 9, mdef: 11, initMod: -1 });
check('官方向量：鋼鐵板甲固定物防 12、魔防 = 洞察 10',
  computeArmorOutcome(armorsByName.get('鋼鐵板甲'), camillaDice), { def: 12, mdef: 10, initMod: -4 });
check('不穿防具時物防 = 靈巧骰、魔防 = 洞察骰',
  computeArmorOutcome(null, camillaDice), { def: 8, mdef: 10, initMod: 0 });

// ─────────────────────────────────────────────────────────── G
section('G. 基本盾牌逐筆核對官方原書（Core p.133）');
check('青銅圓盾 +2 / ±0 / ±0',
  computeShieldOutcome(shieldsByName.get('青銅圓盾')), { defBonus: 2, mdefBonus: 0, initMod: 0 });
check('符文圓盾 +2 / +2 / ±0',
  computeShieldOutcome(shieldsByName.get('符文圓盾')), { defBonus: 2, mdefBonus: 2, initMod: 0 });
check('無盾牌不加值',
  computeShieldOutcome(shieldsByName.get('無盾牌')), { defBonus: 0, mdefBonus: 0, initMod: 0 });
check('資料表中標記為職業的盾牌只有符文圓盾（Core p.133）',
  rulesData.equipment.shields.filter((s) => s.martial).map((s) => s.name), ['符文圓盾']);
check('isShieldItem 認得盾牌、不認得武器',
  [isShieldItem(shieldsByName.get('青銅圓盾')), isShieldItem(weaponsByName.get('青銅劍'))], [true, false]);

// ─────────────────────────────────────────────────────────── H
section('H. 武器換算：命中與傷害式換成該角色的骰（不寫期望值）');

const rapier = evaluateWeapon(weaponsByName.get('刺劍'), { DEX: 8, INS: 10, MIG: 8, WLP: 8 });
check('刺劍命中屬性為 DEX + INS', rapier.accuracyFormula, 'DEX + INS');
check('刺劍命中加值 +1', rapier.accuracyBonus, 1);
check('刺劍命中檢定已換成該角色的骰', rapier.accuracyLabel, 'DEX d8 + INS d10 +1');
check('刺劍傷害式', rapier.damageFormula, 'HR + 6');
check('刺劍傷害類型', rapier.damageType, '物理');
check('換算結果不含期望值欄位（刻意）',
  ['hitExpected', 'dmgExpected', 'hitMax', 'dmgMax'].filter((k) => k in rapier), []);

const waraxeBig = evaluateWeapon(weaponsByName.get('戰斧'), { DEX: 8, INS: 8, MIG: 12, WLP: 8 });
const waraxeSmall = evaluateWeapon(weaponsByName.get('戰斧'), { DEX: 8, INS: 8, MIG: 6, WLP: 8 });
check('同一把戰斧、不同力量 → 命中檢定顯示的骰不同',
  [waraxeBig.accuracyLabel, waraxeSmall.accuracyLabel], ['MIG d12 + MIG d12', 'MIG d6 + MIG d6']);
check('傷害式不因角色而變（書上的數字）',
  [waraxeBig.damageFormula, waraxeSmall.damageFormula], ['HR + 14', 'HR + 14']);

check('雙手判定：戰斧', isTwoHanded(weaponsByName.get('戰斧')), true);
check('雙手判定：青銅劍', isTwoHanded(weaponsByName.get('青銅劍')), false);
check('徒手打擊判定', isUnarmedStrike(weaponsByName.get('徒手打擊')), true);
check('徒手打擊的譯名不得回退成舊稱（突變體技能以「徒手打擊」連動）',
  [weaponsByName.has('無手空拳'), Boolean(EQUIPMENT_ICONS['無手空拳'])], [false, false]);
check('徒手打擊為格鬥類別、單手近戰、HR + 0、免費',
  (() => {
    const w = weaponsByName.get('徒手打擊');
    const d = parseDamage(w.damage);
    return [w.category, Number(w.hands), w.range, d.damageBonus, w.cost];
  })(), ['鬥毆', 1, '近戰', 0, 0]);

check('diceFromStats 取當前骰而非基礎骰',
  diceFromStats({ currentDex: 6, baseDex: 8, currentIns: 12, baseIns: 10, currentMig: 8, baseMig: 8, currentWlp: 6, baseWlp: 6 }),
  { DEX: 6, INS: 12, MIG: 8, WLP: 6 });
check('diceFromStats 缺欄位時回退 8',
  diceFromStats({}), { DEX: 8, INS: 8, MIG: 8, WLP: 8 });

// ─────────────────────────────────────────────────────────── I
section('I. 熟練度需求對應（Core p.126）');
check('職業近戰武器 → martialMelee',
  requiredProficiency(weaponsByName.get('青銅劍'), 'mainHand'), 'martialMelee');
check('職業遠程武器 → martialRanged',
  requiredProficiency(weaponsByName.get('手槍'), 'mainHand'), 'martialRanged');
check('非職業武器 → 無需求',
  requiredProficiency(weaponsByName.get('鐵指虎'), 'mainHand'), null);
check('職業防具 → martialArmor',
  requiredProficiency(armorsByName.get('板條甲'), 'armor'), 'martialArmor');
check('非職業防具 → 無需求',
  requiredProficiency(armorsByName.get('旅行皮甲'), 'armor'), null);
check('職業盾牌 → martialShields',
  shieldProficiency(shieldsByName.get('符文圓盾')), 'martialShields');
check('非職業盾牌 → 無需求',
  shieldProficiency(shieldsByName.get('青銅圓盾')), null);

check('無熟練度時青銅劍不可裝備',
  checkEquippable(weaponsByName.get('青銅劍'), 'mainHand', noProfs), { ok: false, reason: '需要職業近戰武器熟練度' });
check('有熟練度時青銅劍可裝備',
  checkEquippable(weaponsByName.get('青銅劍'), 'mainHand', allProfs), { ok: true, reason: null });
check('無熟練度時手槍需要遠程熟練度',
  checkEquippable(weaponsByName.get('手槍'), 'mainHand', noProfs), { ok: false, reason: '需要職業遠程武器熟練度' });
check('無熟練度時符文圓盾不可裝備',
  checkEquippable(shieldsByName.get('符文圓盾'), 'offHand', noProfs, { isShield: true }),
  { ok: false, reason: '需要職業盾牌熟練度' });
check('無熟練度時板條甲不可裝備',
  checkEquippable(armorsByName.get('板條甲'), 'armor', noProfs),
  { ok: false, reason: '需要職業防具熟練度' });
check('盾牌裝在主手也吃「職業盾牌」熟練度（雙重盾牌）',
  checkEquippable(shieldsByName.get('符文圓盾'), 'mainHand', noProfs),
  { ok: false, reason: '需要職業盾牌熟練度' });
check('null 條目不報錯', checkEquippable(null, 'mainHand', noProfs), { ok: true, reason: null });

// ─────────────────────────────────────────────────────────── J
section('J. 守護者【雙重盾牌】：主手可裝盾，兩手皆盾合併為「雙盾」');

const guardianChar = (dualSL, masterySL) => ({
  classes: [{
    className: '守護者',
    level: 5,
    skills: [
      { name: '雙重盾牌', sl: dualSL },
      { name: '防守掌握', sl: masterySL }
    ]
  }]
});
const noSkillChar = { classes: [{ className: '武器大師', level: 5, skills: [{ name: '破甲擊', sl: 2 }] }] };

check('hasSkill 認得學過的技能', hasSkill(guardianChar(1, 3), '雙重盾牌'), true);
check('hasSkill 對 SL 0 回傳 false', hasSkill(guardianChar(0, 3), '雙重盾牌'), false);
check('hasSkill 對未學技能回傳 false', hasSkill(noSkillChar, '雙重盾牌'), false);
check('getSkillLevel 找不到時回傳 0（不臆測）', getSkillLevel(noSkillChar, '防守掌握'), 0);
check('getSkillLevel 取得 SL', getSkillLevel(guardianChar(1, 4), '防守掌握'), 4);

check('沒學技能時，兩手皆盾不算雙盾',
  getDualShieldState(noSkillChar, { mainIsShield: true, offIsShield: true }).active, false);
check('學了技能但只有一面盾 → 不算雙盾',
  getDualShieldState(guardianChar(1, 3), { mainIsShield: true, offIsShield: false }).active, false);
check('學了技能且兩手皆盾 → 成立雙盾',
  getDualShieldState(guardianChar(1, 3), { mainIsShield: true, offIsShield: true }).active, true);
check('雙盾的命中公式（原書：MIG + MIG）', DUAL_SHIELD.attr, 'MIG + MIG');
check('雙盾的傷害公式（原書：HR + 5 物理）', DUAL_SHIELD.damage, '【HR + 5】物理');
check('雙盾視為格鬥類別雙手近戰武器',
  [DUAL_SHIELD.category, DUAL_SHIELD.hands, DUAL_SHIELD.range], ['鬥毆', 2, '近戰']);

const dualEval = evaluateWeapon(DUAL_SHIELD, { DEX: 8, INS: 8, MIG: 10, WLP: 8 });
check('雙盾對力量 d10 的角色：命中檢定 MIG d10 + MIG d10',
  dualEval.accuracyLabel, 'MIG d10 + MIG d10');
check('雙盾傷害式 HR + 5', dualEval.damageFormula, 'HR + 5');
check('雙重盾牌狀態帶出防守掌握 SL（額外傷害）',
  getDualShieldState(guardianChar(1, 4), { mainIsShield: true, offIsShield: true }).defenseMasterySL, 4);

// ─────────────────────────────────────────────────────────── K
section('K. 載入衝突檢查');
const baseChar = { equipment: { mainHand: '青銅劍', offHand: '青銅圓盾', armor: '旅行皮甲', accessory: '守護護符' } };
const mkStats = (profs) => ({ profs });
const issueMessages = (char, profs) => buildLoadoutIssues({
  character: char,
  stats: mkStats(profs),
  weaponMap: weaponsByName,
  armorMap: armorsByName,
  shieldMap: shieldsByName,
  accessoryMap: accessoriesByName
}).map((i) => i.message);

check('合法配置：無衝突', issueMessages(baseChar, allProfs), []);
check('雙手武器 + 副手盾牌 → 持握衝突',
  issueMessages({ equipment: { ...baseChar.equipment, mainHand: '戰斧' } }, allProfs),
  ['戰斧是雙手武器，副手必須空出']);
check('雙手武器 + 副手空出 → 合法',
  issueMessages({ equipment: { mainHand: '戰斧', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' } }, allProfs), []);
check('職業武器無熟練度 → 回報',
  issueMessages({ equipment: { mainHand: '戰斧', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' } }, noProfs),
  ['主手戰斧：需要職業近戰武器熟練度']);
check('職業盾牌無熟練度 → 回報',
  issueMessages({ equipment: { mainHand: '鐵指虎', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' } }, noProfs),
  ['副手符文圓盾：需要職業盾牌熟練度']);
check('主手裝盾牌但沒學雙重盾牌 → 回報',
  issueMessages({ equipment: { mainHand: '青銅圓盾', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' } }, allProfs),
  ['主手青銅圓盾：盾牌需有守護者【雙重盾牌】才能裝備於主手']);
check('學了雙重盾牌且兩手皆盾 → 合法（不是持握衝突）',
  issueMessages({
    classes: guardianChar(1, 2).classes,
    equipment: { mainHand: '青銅圓盾', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' }
  }, allProfs), []);
check('超出 500z 預算 → 回報（青銅劍200 + 符文圓盾150 + 鋼鐵板甲300 = 650）',
  issueMessages({ equipment: { mainHand: '青銅劍', offHand: '符文圓盾', armor: '鋼鐵板甲', accessory: '' } }, allProfs),
  ['起始裝備花費 650z 超出 500z 預算']);
check('查無此名稱 → 回報為提醒而非錯誤',
  issueMessages({ equipment: { mainHand: '不存在之劍', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' } }, allProfs),
  ['資料表中查無：主手「不存在之劍」（不計入預算，請確認是否為自訂名稱）']);
check('飾品不計入 500z 預算（稀有物品，Core p.126／p.164）',
  issueMessages({ equipment: { mainHand: '巨劍', offHand: '無盾牌', armor: '鋼鐵板甲', accessory: '守護護符' } }, allProfs)
    .filter((m) => m.includes('超出')), []);
check('空裝備不拋錯', issueMessages({ equipment: {} }, noProfs), []);

// ─────────────────────────────────────────────────────────── L
section('L. 篩選與排序（預設隱藏目前無法裝備的項目）');
const rows = rulesData.equipment.weapons.map((weapon) => ({
  weapon,
  eval: evaluateWeapon(weapon, camillaDice),
  equippable: checkEquippable(weapon, 'mainHand', noProfs),
  remainingBudget: 200
}));

check('預設（showAll 未給）只留能裝備的',
  filterWeapons(rows, {}).every((r) => r.equippable.ok), true);
check('預設不會出現職業武器',
  filterWeapons(rows, {}).some((r) => r.weapon.martial), false);
check('showAll: true 才看得到職業武器',
  filterWeapons(rows, { showAll: true }).some((r) => r.weapon.martial), true);
check('showAll: true 的數量等於全部',
  filterWeapons(rows, { showAll: true }).length, rows.length);
check('有熟練度時職業武器回到清單中',
  filterWeapons(rows.map((r) => ({ ...r, equippable: checkEquippable(r.weapon, 'mainHand', allProfs) })), {})
    .some((r) => r.weapon.martial), true);

check('只看買得起的：價格一律 ≤ 200',
  filterWeapons(rows, { showAll: true, affordableOnly: true }).every((r) => r.weapon.cost <= 200), true);
check('類別篩選：劍',
  filterWeapons(rows, { showAll: true, category: '劍' }).map((r) => r.weapon.name).sort(),
  ['刺劍', '巨劍', '武士刀', '青銅劍'].sort());
check('距離篩選：遠程',
  filterWeapons(rows, { showAll: true, range: '遠程' }).every((r) => r.weapon.range === '遠程'), true);
check('持握篩選：雙手',
  filterWeapons(rows, { showAll: true, hands: '2' }).every((r) => Number(r.weapon.hands) === 2), true);
check('關鍵字搜尋：匕首',
  filterWeapons(rows, { showAll: true, query: '匕首' }).map((r) => r.weapon.name), ['短匕首']);

const sorted = sortWeapons(rows, 'damageBonus', 'desc');
check('傷害加值遞減排序：第一筆即最大值',
  sorted[0].eval.damageBonus >= sorted[sorted.length - 1].eval.damageBonus, true);
check('價格遞增排序',
  sortWeapons(rows, 'cost', 'asc')[0].weapon.cost, 0);
check('排序不改變原陣列長度', sorted.length, rows.length);
check('排序選項第一項是傷害加值（預設）', SORT_OPTIONS[0].key, 'damageBonus');
check('排序選項不含期望值欄位',
  SORT_OPTIONS.filter((o) => /Expected|expected/.test(o.key)), []);

// ─────────────────────────────────────────────────────────── M
section('M. 規則書與本團玩法的已知差異（刻意記錄，不是漏改）');

/**
 * 本團採用 2026-06-22 版 Playtest 的「先攻」變體：
 * 取消先攻值、防具不再有先攻減值、戰鬥束腰外衣改為物防 +2／魔防 +0。
 * 使用者已裁定：該變體日後以「Playtest 勾選」統一開啟，屆時才會連同新技能一併套用。
 * 應用程式目前仍以核心規則書的數值為準，這條測試把現況釘住。
 */
check('目前戰鬥輕甲仍為核心規則值（靈巧 +1／洞察 +1／先攻 ±0）',
  [armorsByName.get('戰鬥輕甲').defFormula, armorsByName.get('戰鬥輕甲').mdefFormula, armorsByName.get('戰鬥輕甲').initMod],
  ['dex+1', 'ins+1', 0]);
check('目前防具仍保留先攻欄（核心規則值，未套用變體）',
  rulesData.equipment.armors.some((a) => a.initMod !== 0), true);

// ─────────────────────────────────────────────────────────── N
section('N. 飾品：一律稀有物品（Core p.126／p.284）');
check('飾品資料存在', rulesData.equipment.accessories.length > 0, true);
check('飾品不帶 500z 起始預算用的價格欄位（避免被誤計入預算）',
  rulesData.equipment.accessories.every((a) => a.cost === undefined), true);

// ─────────────────────────────────────────────────────────── O
section('O. 開卡預設裝備：兩手徒手打擊、不穿防具、500z 全額留給玩家選購');

const freshChar = createNewCharacter();
check('預設主手為徒手打擊', freshChar.equipment.mainHand, '徒手打擊');
check('預設副手也為徒手打擊', freshChar.equipment.offHand, '徒手打擊');
check('預設防具為無裝甲 / 冒險服', freshChar.equipment.armor, '無裝甲 / 冒險服');
check('預設不佩戴飾品', freshChar.equipment.accessory, '');
check('預設裝備的兩件條目皆為 0z → 起始預算顯示滿額 500z',
  [weaponsByName.get('徒手打擊').cost, armorsByName.get('無裝甲 / 冒險服').cost], [0, 0]);
check('預設配置無載入衝突（含無熟練度時）',
  buildLoadoutIssues({
    character: freshChar,
    stats: { profs: noProfs },
    weaponMap: weaponsByName,
    armorMap: armorsByName,
    shieldMap: shieldsByName,
    accessoryMap: accessoriesByName
  }).map((i) => i.message), []);
check('兩手皆徒手打擊屬雙持單手武器，不是雙手武器衝突',
  isTwoHanded(weaponsByName.get('徒手打擊')), false);

// ─────────────────────────────────────────────────────────── P
section('P. SSR 渲染煙霧測試：元件真的畫得出來');

const smokeTheme = getCharacterTheme('emerald');
// 給這個角色職業近戰／遠程熟練度，否則預設會把所有職業武器隱藏起來，測不到清單內容
const smokeChar = createNewCharacter({
  attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
  classes: [{ className: '武器大師', level: 5, skills: [{ name: '破甲擊', sl: 2 }] }],
  equipment: { mainHand: '刺劍', offHand: '青銅圓盾', armor: '旅行皮甲', accessory: '守護護符' }
});
const smokeStats = calculateCharacterStats(smokeChar);

const renderPicker = (slot, extra = {}) => renderToStaticMarkup(React.createElement(EquipmentPickerBody, {
  slot,
  theme: smokeTheme,
  character: smokeChar,
  stats: smokeStats,
  remainingBudget: 300,
  onSelect: () => {},
  onClose: () => {},
  ...extra
}));

const mainHtml = renderPicker('mainHand');
check('主手彈窗列出刺劍', mainHtml.includes('刺劍'), true);
check('主手彈窗有命中檢定欄位', mainHtml.includes('命中檢定'), true);
check('主手彈窗不寫期望值', /期望/.test(mainHtml), false);
check('主手彈窗有十大類別篩選', mainHtml.includes('連枷') && mainHtml.includes('投擲') && mainHtml.includes('奧術'), true);
check('主手彈窗標示職業武器', mainHtml.includes('職業'), true);
check('主手彈窗預設隱藏不能裝備的（手槍需職業遠程武器熟練度，不該出現）', mainHtml.includes('手槍'), false);
check('主手彈窗提供「顯示目前無法裝備的」勾選', mainHtml.includes('顯示目前無法裝備的'), true);
check('主手彈窗沒有雙重盾牌提示（此角色未學）', mainHtml.includes('雙重盾牌'), false);

const guardianSmoke = createNewCharacter({
  classes: [{ className: '守護者', level: 5, skills: [{ name: '雙重盾牌', sl: 1 }, { name: '防守掌握', sl: 3 }] }],
  equipment: { mainHand: '青銅圓盾', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' }
});
const guardianHtml = renderToStaticMarkup(React.createElement(EquipmentPickerBody, {
  slot: 'mainHand',
  theme: smokeTheme,
  character: guardianSmoke,
  stats: calculateCharacterStats(guardianSmoke),
  remainingBudget: 300,
  onSelect: () => {},
  onClose: () => {}
}));
check('學會雙重盾牌後，主手彈窗出現盾牌列與雙盾公式',
  guardianHtml.includes('雙重盾牌') && guardianHtml.includes('MIG + MIG') && guardianHtml.includes('HR + 5'), true);
check('盾牌列標示額外傷害來自防守掌握 SL',
  guardianHtml.includes('防守掌握'), true);

const offHtml = renderPicker('offHand');
check('副手彈窗預設為盾牌分頁並顯示合計值',
  offHtml.includes('合計物防') && offHtml.includes('合計魔防'), true);
check('副手彈窗可切換單手武器分頁', offHtml.includes('單手武器'), true);

const armorHtml = renderPicker('armor');
check('防具彈窗列出非職業防具', armorHtml.includes('旅行皮甲') && armorHtml.includes('賢者長袍'), true);
check('防具彈窗預設隱藏職業防具（鋼鐵板甲需職業防具熟練度）', armorHtml.includes('鋼鐵板甲'), false);
check('防具彈窗顯示先攻欄', armorHtml.includes('先攻'), true);

const accHtml = renderPicker('accessory');
check('飾品彈窗說明不列入起始預算', accHtml.includes('不列入起始 500z 裝備預算'), true);
check('飾品彈窗列出守護護符', accHtml.includes('守護護符'), true);

const slotHtml = renderToStaticMarkup(React.createElement(EquipmentSlotCard, {
  theme: smokeTheme,
  slotDef: EQUIPMENT_SLOTS.mainHand,
  itemName: '刺劍',
  itemIcon: getEquipmentIcon('刺劍'),
  badges: [{ label: '職業', variant: 'rose' }],
  metrics: [{ label: '傷害', value: 'HR + 6' }],
  note: '劍 · 單手近戰',
  warning: null,
  onOpen: () => {}
}));
check('槽位卡顯示槽位標籤與裝備名', slotHtml.includes('主手武器') && slotHtml.includes('刺劍'), true);
check('槽位卡顯示傷害式', slotHtml.includes('HR + 6'), true);

const mergedHtml = renderToStaticMarkup(React.createElement(EquipmentSlotCard, {
  theme: smokeTheme,
  slotDef: EQUIPMENT_SLOTS.mainHand,
  itemName: '戰斧',
  itemIcon: getEquipmentIcon('戰斧'),
  badges: [{ label: '雙手', variant: 'zinc' }],
  metrics: [{ label: '傷害', value: 'HR + 14' }],
  note: '重型 · 雙手近戰',
  warning: null,
  mergedNote: '被主手佔用（雙手武器）',
  onOpen: () => {}
}));
check('雙手武器時槽位卡長出副手佔用區塊',
  mergedHtml.includes('副手武裝') && mergedHtml.includes('被主手佔用'), true);
check('雙手武器時標示「雙手」徽章', mergedHtml.includes('雙手'), true);

// ─────────────────────────────────────────────────────────── Q
section('Q. 雙手武器佔用副手：切換主手時自動卸下副手（Core p.131）');

const pickMain = (equipment, name) => applyEquipmentChoice(equipment, 'mainHand', name, weaponsByName);

check('換上雙手武器（戰斧）→ 副手自動清空',
  pickMain({ mainHand: '青銅劍', offHand: '青銅圓盾' }, '戰斧').equipment.offHand, '無盾牌');
check('被卸下的副手會被回報（供 UI 提示）',
  pickMain({ mainHand: '青銅劍', offHand: '符文圓盾' }, '戰斧').clearedOffHand, '符文圓盾');
check('副手本來就是空的 → 不提示',
  pickMain({ mainHand: '青銅劍', offHand: '無盾牌' }, '戰斧').clearedOffHand, null);
check('副手只是徒手打擊 → 靜默改為無盾牌（不算被卸下的裝備）',
  pickMain({ mainHand: '青銅劍', offHand: '徒手打擊' }, '戰斧'),
  { equipment: { mainHand: '戰斧', offHand: '無盾牌' }, clearedOffHand: null });
check('換上單手武器不動副手',
  pickMain({ mainHand: '戰斧', offHand: '無盾牌' }, '青銅劍').equipment.offHand, '無盾牌');
check('換成徒手打擊也不動副手（單手武器）',
  pickMain({ mainHand: '戰斧', offHand: '無盾牌' }, '徒手打擊').equipment.offHand, '無盾牌');
check('只換防具時完全不碰主副手',
  applyEquipmentChoice({ mainHand: '青銅劍', offHand: '青銅圓盾' }, 'armor', '賢者長袍', weaponsByName).equipment,
  { mainHand: '青銅劍', offHand: '青銅圓盾', armor: '賢者長袍' });
check('原物件不會被就地修改',
  (() => {
    const original = { mainHand: '青銅劍', offHand: '青銅圓盾' };
    pickMain(original, '戰斧');
    return original.offHand;
  })(), '青銅圓盾');
check('雙手武器清單：戰斧／巨劍／法杖為雙手，青銅劍／徒手打擊為單手',
  ['戰斧', '巨劍', '法杖', '青銅劍', '徒手打擊'].map((n) => isTwoHanded(weaponsByName.get(n))),
  [true, true, true, false, false]);

// ─────────────────────────────────────────────────────────── W
section('W. 定制武器（HF 印刷 p.106～108 的選用規則）');

const cwBase = createCustomWeaponSpec({ name: '測試武器' });
check('起始規格：成本 300z', customWeaponCost(cwBase), 300);
check('起始規格：雙手武器', buildCustomWeaponEntry(cwBase).hands, 2);
check('起始規格：傷害【HR + 5】', buildCustomWeaponEntry(cwBase).damage, '【HR + 5】物理');
check('起始規格：預設不是職業武器', isMartialCustomWeapon(cwBase), false);
check('三個訂製能力名額', remainingSlots(cwBase), 3);
check('十個類別（Core p.129）', CUSTOM_WEAPON_CATEGORIES.length, 10);
check('八種元素', CUSTOM_WEAPON_ELEMENTS.length, 8);
check('七項訂製能力', CUSTOMIZATIONS.length, 7);

// 名額：迅捷佔兩個（原書 p.107）
const cwQuick = createCustomWeaponSpec({ name: '雙刃', customizations: ['quick'] });
check('迅捷佔 2 個名額', usedSlots(cwQuick), 2);
check('迅捷之後只剩 1 個名額', remainingSlots(cwQuick), 1);
check('迅捷是職業武器', isMartialCustomWeapon(cwQuick), true);
check('迅捷 + 第三項 = 剛好用滿',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', customizations: ['quick', 'accurate'] })).ok, true);
check('迅捷 + 兩項 = 超出名額',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', customizations: ['quick', 'accurate', 'defenseBoost'] })).ok, false);

// 強力的兩個限制（原書 p.107）
check('強力不能用在奧術',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', category: '奧術', customizations: ['powerful'] })).ok, false);
check('強力不能用在匕首',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', category: '匕首', customizations: ['powerful'] })).ok, false);
check('強力不能與迅捷並存',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', category: '劍', customizations: ['powerful', 'quick'] })).ok, false);
check('強力可以用在重型',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', category: '重型', customizations: ['powerful'] })).ok, true);
check('同一個訂製能力不能選兩次',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', customizations: ['accurate', 'accurate'] })).ok, false);

// 傷害與成本（原書 p.106～107）
check('元素：改屬性並 +2 傷害',
  buildCustomWeaponEntry(createCustomWeaponSpec({ name: 'x', customizations: ['elemental'], element: '火' })).damage,
  '【HR + 7】火');
check('強力（非重型）+5 → HR + 10',
  customWeaponDamageBonus(createCustomWeaponSpec({ name: 'x', category: '劍', customizations: ['powerful'] })), 10);
check('強力（重型）+7 → HR + 12',
  customWeaponDamageBonus(createCustomWeaponSpec({ name: 'x', category: '重型', customizations: ['powerful'] })), 12);
check('元素 + 強力（重型）= 5 + 2 + 7 = HR + 14',
  customWeaponDamageBonus(createCustomWeaponSpec({ name: 'x', category: '重型', customizations: ['elemental', 'powerful'], element: '電' })), 14);
check('精準：命中檢定 +2（格式與官方武器表一致）',
  buildCustomWeaponEntry(createCustomWeaponSpec({ name: 'x', accuracy: 'DEX + MIG', customizations: ['accurate'] })).attr,
  'DEX + MIG + 2');
check('可變形：成本 +100z', customWeaponCost(createCustomWeaponSpec({ name: 'x', customizations: ['transforming'] })), 400);

// 元素必須指定屬性（兩個方向都要擋）
check('選了元素卻沒指定屬性 → 不合法',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', customizations: ['elemental'] })).ok, false);
check('沒選元素卻指定了屬性 → 不合法',
  validateCustomWeapon(createCustomWeaponSpec({ name: 'x', element: '火' })).ok, false);

// 可變形必須成對互指（原書 p.107）
const formA = createCustomWeaponSpec({ id: 'a', name: '形態一', customizations: ['transforming'] });
const formB = createCustomWeaponSpec({ id: 'b', name: '形態二', customizations: ['transforming'] });
check('可變形沒指定第二型態 → 不合法',
  validateCustomWeapon(createCustomWeaponSpec({ id: 'a', name: 'x', customizations: ['transforming'] })).ok, false);
check('第二型態沒有可變形 → 不合法',
  validateCustomWeapon({ ...formA, transformingId: 'b' }, { siblings: [{ ...formB, customizations: [] }] }).ok, false);
check('兩者互指 → 合法',
  validateCustomWeapon({ ...formA, transformingId: 'b' }, { siblings: [{ ...formB, transformingId: 'a' }] }).ok, true);

// 條目形狀必須與官方武器表一致（引擎與介面只認這幾個欄位）
const cwEntry = buildCustomWeaponEntry(createCustomWeaponSpec({
  name: '戰車', category: '重型', range: '近戰', accuracy: 'DEX + MIG',
  customizations: ['accurate', 'defenseBoost', 'powerful']
}));
check('條目欄位與官方武器表相同',
  Object.keys(cwEntry).filter((k) => ['name', 'category', 'cost', 'hands', 'attr', 'damage', 'range'].includes(k)).sort(),
  ['attr', 'category', 'cost', 'damage', 'hands', 'name', 'range']);
check('條目標記為定制武器', cwEntry.isCustomWeapon, true);
check('物防提升：條目帶 defBoost 2 與 countsAsShield', [cwEntry.defBoost, cwEntry.countsAsShield], [2, true]);
check('魔防提升：條目帶 mdefBoost 2',
  buildCustomWeaponEntry(createCustomWeaponSpec({ name: 'x', customizations: ['magicDefenseBoost'] })).mdefBoost, 2);
check('parseDamage 讀得懂產生的傷害字串', parseDamage(cwEntry.damage), { damageBonus: 12, damageType: '物理' });
check('parseAccuracy 讀得懂產生的命中字串',
  parseAccuracy(cwEntry.attr), { accuracyBonus: 2, attrs: ['DEX', 'MIG'] });
check('evaluateWeapon 換算成該角色的骰',
  evaluateWeapon(cwEntry, { DEX: 8, MIG: 6 }).accuracyLabel, 'DEX d8 + MIG d6 +2');

// 官方配置的定制武器（`expansionPresets.js`）必須全部合法
const presetSpecs = ALL_STARTER_PRESETS.flatMap((p) => p.customWeapons || []);
check('官方配置裡的定制武器數量', presetSpecs.length, 25);
check('每一把都通過驗證',
  presetSpecs.filter((s) => !validateCustomWeapon(s, { siblings: presetSpecs }).ok).map((s) => s.name), []);
check('主手都指向那把定制武器（不是官方武器表裡的名字）',
  ALL_STARTER_PRESETS.filter((p) => (p.customWeapons || []).length > 0)
    .filter((p) => p.equipment.mainHand !== p.customWeapons[0].name).map((p) => p.title), []);
check('定制武器是雙手武器 → 官方配置的副手一律清空',
  ALL_STARTER_PRESETS.filter((p) => (p.customWeapons || []).length > 0)
    .filter((p) => p.equipment.offHand !== '無盾牌').map((p) => p.title), []);
check('只剩 1 筆是純出處（科技奇幻樣本，沒有規格）',
  ALL_STARTER_PRESETS.filter((p) => p.customWeapon && !(p.customWeapons || []).length).length, 1);

// 裝到主手：回傳的必須是**裝備物件本身**。
// 這裡是使用者實測抓到的 bug：`applyEquipmentChoice` 回傳 `{ equipment, clearedOffHand }`，
// 但呼叫端把整包塞進 `equipment` 欄位 → `mainHand` 變 undefined，按鈕看起來完全沒反應。
const equipChar = {
  equipment: { mainHand: '徒手打擊', offHand: '青銅圓盾', armor: '無裝甲 / 冒險服', accessory: '' },
  customWeapons: [createCustomWeaponSpec({ name: '戰車', category: '重型', customizations: ['accurate'] })]
};
const equipResult = equipCustomWeapon(equipChar, '戰車');
check('裝到主手：mainHand 真的變成那把武器', equipResult.equipment.mainHand, '戰車');
check('定制武器是雙手武器 → 副手被清空', equipResult.equipment.offHand, '無盾牌');
check('回報被卸下的副手（介面據此提示）', equipResult.clearedOffHand, '青銅圓盾');
check('回傳的是裝備物件本身，不是包裝過的結果',
  [equipResult.equipment.equipment, equipResult.equipment.clearedOffHand], [undefined, undefined]);
check('原本的其他欄位沒有被動到', equipResult.equipment.armor, '無裝甲 / 冒險服');
check('副手本來就是空的 → 不提示卸下',
  equipCustomWeapon({ ...equipChar, equipment: { ...equipChar.equipment, offHand: '無盾牌' } }, '戰車').clearedOffHand,
  null);

// ─────────────────────────────────────────────────────────── X
section('X. 可變形武器＝同一把（分組與切換形態，使用者回報「分成兩把有點彆扭」）');

const twinForms = [
  createCustomWeaponSpec({ id: 'g1', name: '柔性纏手布', customizations: ['transforming', 'quick'], transformingId: 'g2' }),
  createCustomWeaponSpec({ id: 'g2', name: '柔性纏手布（第二型態）', customizations: ['transforming', 'accurate', 'powerful'], transformingId: 'g1' })
];
const twinGroup = groupCustomWeapons(twinForms);
check('可變形的兩個型態分成同一組', twinGroup.length, 1);
check('那一組有兩個型態', twinGroup[0].forms.length, 2);
check('組名取第一個型態的名字', twinGroup[0].name, '柔性纏手布');
check('標記為可變形', twinGroup[0].isTransforming, true);
check('單一武器各自一組',
  groupCustomWeapons([
    createCustomWeaponSpec({ id: 'a', name: '甲' }),
    createCustomWeaponSpec({ id: 'b', name: '乙' })
  ]).length,
  2);
check('單邊指向的壞資料不吞掉任何一把',
  groupCustomWeapons([createCustomWeaponSpec({ id: 'a', name: '孤兒', transformingId: '不存在' })]).length,
  1);

check('裝上形態一 → 目前是第 0 個', equippedFormIndex(twinGroup[0], '柔性纏手布'), 0);
check('裝上形態二 → 目前是第 1 個', equippedFormIndex(twinGroup[0], '柔性纏手布（第二型態）'), 1);
check('沒裝備 → -1', equippedFormIndex(twinGroup[0], '徒手打擊'), -1);
check('切換形態：形態一 → 形態二', nextFormFor(twinGroup[0], '柔性纏手布').name, '柔性纏手布（第二型態）');
check('切換形態：形態二 → 回到形態一', nextFormFor(twinGroup[0], '柔性纏手布（第二型態）').name, '柔性纏手布');
check('沒裝備時按下去＝裝上第一個型態', nextFormFor(twinGroup[0], '徒手打擊').name, '柔性纏手布');
check('不可變形時沒有第二個型態可切',
  nextFormFor(groupCustomWeapons([createCustomWeaponSpec({ id: 's', name: '單一' })])[0], '單一').name,
  '單一');
check('切換形態會真的換掉主手（走的是同一條 equip 路徑）',
  equipCustomWeapon(
    { equipment: { mainHand: '柔性纏手布', offHand: '無盾牌' }, customWeapons: twinForms },
    nextFormFor(twinGroup[0], '柔性纏手布').name
  ).equipment.mainHand,
  '柔性纏手布（第二型態）');

// ─────────────────────────────────────────────────────────── Y
section('Y. 改名要跟著改裝備欄（使用者回報：第二型態改名後切換完全不會顯示新名字）');

const renamedTwin = twinForms.map((s) => (s.id === 'g2' ? { ...s, name: '織炎型態' } : s));
const synced = syncEquipmentNames(
  { mainHand: '柔性纏手布（第二型態）', offHand: '無盾牌', armor: '無裝甲 / 冒險服' },
  twinForms,
  renamedTwin
);
check('改名後裝備欄跟著換成新名字', synced.equipment.mainHand, '織炎型態');
check('有回報改名（供履歷用）', synced.renamed, true);
check('其他欄位沒被動到', synced.equipment.armor, '無裝甲 / 冒險服');
check('沒改名時不動裝備欄',
  syncEquipmentNames({ mainHand: '柔性纏手布' }, twinForms, twinForms).renamed, false);
check('改名後群組仍認得被裝備的是第二型態（這就是使用者踩到的情境）',
  equippedFormIndex(groupCustomWeapons(renamedTwin)[0], synced.equipment.mainHand), 1);
check('改名後切換形態會回到第一個型態',
  nextFormFor(groupCustomWeapons(renamedTwin)[0], synced.equipment.mainHand).name, '柔性纏手布');
check('沒裝備的武器改名不影響裝備欄',
  syncEquipmentNames({ mainHand: '青銅劍' }, twinForms, renamedTwin).equipment.mainHand, '青銅劍');
check('副手也可以被同步（例如盾牌類定制武器）',
  syncEquipmentNames({ offHand: '柔性纏手布（第二型態）' }, twinForms, renamedTwin).equipment.offHand, '織炎型態');

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
