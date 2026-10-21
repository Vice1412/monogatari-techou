/**
 * 先攻變體（INITIATIVE，變體規則）護欄。
 *
 * 執行：npm run test:initiative
 *
 * 官方依據：Playtest Materials ENG **2026-10-01**，印刷 p.34（此書 PDF 無偏移）。
 * 原文三條後果逐字引用見 `src/features/character-sheet/data/initiativeVariant.js` 檔頭。
 *
 * 這道關卡守的是「一條變體規則在三個層面同時生效」：
 *   ① 防具側寫（戰鬥輕甲改物防 +2／魔防 +0）
 *   ② 防具先攻減值（全部歸零，說明文字也要跟著改）
 *   ③ 先攻值本身（不存在 → 顯示「不計」，不是 0）
 * 三者**任一漏改，畫面看起來都正常**——這正是要把它們釘死的原因。
 */
import fs from 'node:fs';
import path from 'node:path';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  INITIATIVE_VARIANT_FIELD,
  INITIATIVE_VARIANT_RULES,
  INITIATIVE_VARIANT_NOTES,
  INITIATIVE_VARIANT_SOURCE,
  COMBAT_TUNIC_NAME,
  TRAVEL_GARB_NAME,
  COMBAT_TUNIC_VARIANT_PROFILE,
  isInitiativeVariant,
  getArmorProfile,
  resolveArmorDesc,
  armorDescChangesUnderVariant,
  describeInitiativeOrder,
  formatInitiative,
  initiativeVariantTermLabel
} from '../src/features/character-sheet/data/initiativeVariant.js';
import {
  DEFAULT_CREATION_RULES,
  CREATION_RULE_FIELDS,
  resolveCreationRules
} from '../src/features/character-sheet/data/creationRules.js';
import {
  computeArmorOutcome,
  diceFromStats
} from '../src/features/character-sheet/utils/equipmentRules.js';
import {
  createNewCharacter,
  calculateCharacterStats
} from '../src/features/character-sheet/utils/characterEngine.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterCard from '../src/features/character-sheet/components/CharacterCard.jsx';
import { EquipmentPickerBody } from '../src/features/character-sheet/components/EquipmentPickerModal.jsx';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';

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

/** SSR 標記 → 純文字（去掉 React 的文字節點註解與標籤） */
const plain = (html) => String(html)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]*>/g, '');

const armors = rulesData.equipment.armors;
const armorByName = new Map(armors.map((a) => [a.name, a]));
const READ = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

// ─────────────────────────────────────────────────────────── A
section('A. 規則資料（公測 p.34 三條後果）');

check('開關欄位名', INITIATIVE_VARIANT_FIELD, 'initiativeVariant');
check('出處標了頁碼', INITIATIVE_VARIANT_SOURCE.includes('p.34'), true);
check('規則物件凍結（避免執行期被改寫）', Object.isFrozen(INITIATIVE_VARIANT_RULES), true);
check('防具先攻減值：不存在', INITIATIVE_VARIANT_RULES.armorInitiativePenalty, false);
check('戰鬥輕甲新側寫（原文 Defense +2 / M.Defense +0）',
  INITIATIVE_VARIANT_RULES.combatTunicProfile,
  { defFormula: 'dex+2', mdefFormula: 'ins' });
check('側寫常數與規則物件一致', COMBAT_TUNIC_VARIANT_PROFILE, INITIATIVE_VARIANT_RULES.combatTunicProfile);
check('沒有反派 → 英雄方先攻', INITIATIVE_VARIANT_RULES.noVillainsHeroesFirst, true);
check('有反派 → 敵方先攻', INITIATIVE_VARIANT_RULES.villainsEnemiesFirst, true);
check('影響先攻的效果一律忽略（不替換）', INITIATIVE_VARIANT_RULES.ignoreInitiativeEffects, true);
check('NPC 沒有先攻值', INITIATIVE_VARIANT_RULES.npcInitiative, false);
check('精英／冠位不再提高先攻', INITIATIVE_VARIANT_RULES.eliteChampionInitiative, false);
check('NPC 技能【強化先攻】不可用', INITIATIVE_VARIANT_RULES.npcImprovedInitiative, false);
check('介面說明四條', INITIATIVE_VARIANT_NOTES.length, 4);
// 規則三只允許固定縮寫；NPC 與全站既有文案（NPC 工坊、NPC 定位）一致，一併放行。
const ALLOWED_LATIN = /\b(?:DEX|INS|MIG|WLP|HP|MP|IP|HR|SL|DEF|M\.DEF|NPC)\b/g;
check('說明文字沒有白名單以外的拉丁字母',
  INITIATIVE_VARIANT_NOTES
    .map((line) => line.replace(ALLOWED_LATIN, ''))
    .filter((line) => /[A-Za-z]/.test(line)), []);
check('說明第三條點名戰鬥輕甲', INITIATIVE_VARIANT_NOTES[2].includes(COMBAT_TUNIC_NAME), true);
check('兩個關鍵防具名都在裝備表裡（名字不能只是文件裡的字）',
  [TRAVEL_GARB_NAME, COMBAT_TUNIC_NAME].filter((name) => !armorByName.has(name)), []);

// ─────────────────────────────────────────────────────────── B
section('B. 開關判定：只認真正的 true');

check('undefined', isInitiativeVariant(undefined), false);
check('null', isInitiativeVariant(null), false);
check('空物件', isInitiativeVariant({}), false);
check('空規則物件', isInitiativeVariant({ creationRules: {} }), false);
check('明確 false', isInitiativeVariant({ creationRules: { initiativeVariant: false } }), false);
check('明確 true', isInitiativeVariant({ creationRules: { initiativeVariant: true } }), true);
check('字串 "true" 不算（壞資料不該默默開規則）',
  isInitiativeVariant({ creationRules: { initiativeVariant: 'true' } }), false);
check('數字 1 不算', isInitiativeVariant({ creationRules: { initiativeVariant: 1 } }), false);
check('直接傳規則物件也吃得下', isInitiativeVariant({ initiativeVariant: true }), true);
check('官方預設規則 → 關閉', isInitiativeVariant(DEFAULT_CREATION_RULES), false);
check('creationRules 是字串時不炸', isInitiativeVariant({ creationRules: 'oops' }), false);

// ─────────────────────────────────────────────────────────── C
section('C. 開卡規則欄位（整團一層，不是角色技能）');

check('欄位在權威欄位集裡', CREATION_RULE_FIELDS.includes(INITIATIVE_VARIANT_FIELD), true);
check('官方預設關閉', DEFAULT_CREATION_RULES.initiativeVariant, false);
check('resolveCreationRules 保留 true', resolveCreationRules({ initiativeVariant: true }).initiativeVariant, true);
check('壞值退回預設 false', resolveCreationRules({ initiativeVariant: 'yes' }).initiativeVariant, false);
check('不影響其他欄位（起始等級仍是 5）', resolveCreationRules({ initiativeVariant: true }).startingLevel, 5);

// ─────────────────────────────────────────────────────────── D
section('D. 防具側寫（getArmorProfile）');

check('無防具 → null', getArmorProfile(null, true), null);
check('核心：旅行皮甲仍有先攻 -1',
  getArmorProfile(armorByName.get(TRAVEL_GARB_NAME), false),
  { defFormula: 'dex+1', mdefFormula: 'ins+1', initMod: -1 });
check('變體：旅行皮甲先攻歸零、公式不變',
  getArmorProfile(armorByName.get(TRAVEL_GARB_NAME), true),
  { defFormula: 'dex+1', mdefFormula: 'ins+1', initMod: 0 });
check('核心：戰鬥輕甲 = 靈巧 + 1／洞察 + 1、無先攻',
  getArmorProfile(armorByName.get(COMBAT_TUNIC_NAME), false),
  { defFormula: 'dex+1', mdefFormula: 'ins+1', initMod: 0 });
check('變體：戰鬥輕甲 = 靈巧 + 2／洞察 + 0',
  getArmorProfile(armorByName.get(COMBAT_TUNIC_NAME), true),
  { defFormula: 'dex+2', mdefFormula: 'ins', initMod: 0 });
check('變體：鋼鐵板甲固定值不動、先攻歸零',
  getArmorProfile(armorByName.get('鋼鐵板甲'), true),
  { defFormula: '12', mdefFormula: 'ins', initMod: 0 });
check('變體：九件防具先攻一律 0',
  armors.filter((a) => getArmorProfile(a, true).initMod !== 0).map((a) => a.name), []);
check('變體：只有戰鬥輕甲的公式會變',
  armors
    .filter((a) => {
      const core = getArmorProfile(a, false);
      const variant = getArmorProfile(a, true);
      return core.defFormula !== variant.defFormula || core.mdefFormula !== variant.mdefFormula;
    })
    .map((a) => a.name),
  [COMBAT_TUNIC_NAME]);
check('讀側寫不會改到資料表（純函式）',
  [armorByName.get(TRAVEL_GARB_NAME).initMod, armorByName.get('鋼鐵板甲').initMod], [-1, -4]);

// ─────────────────────────────────────────────────────────── E
section('E. 防具說明文字（顯示字串也是規則的一部分）');

check('關閉時九件逐字不變',
  armors.filter((a) => resolveArmorDesc(a, false) !== a.desc).map((a) => a.name), []);
check('開啟時沒有任何一件還寫著「先攻」',
  armors.filter((a) => resolveArmorDesc(a, true).includes('先攻')).map((a) => a.name), []);
check('旅行皮甲：只去掉先攻片段',
  resolveArmorDesc(armorByName.get(TRAVEL_GARB_NAME), true), '物防 = 靈巧 + 1，魔防 = 洞察 + 1');
check('戰鬥輕甲：換成新側寫',
  resolveArmorDesc(armorByName.get(COMBAT_TUNIC_NAME), true), '物防 = 靈巧 + 2，魔防 = 洞察');
check('板條甲：固定值不動、去先攻',
  resolveArmorDesc(armorByName.get('板條甲'), true), '物防 = 10，魔防 = 洞察');
check('鋼鐵板甲：固定值不動、去先攻',
  resolveArmorDesc(armorByName.get('鋼鐵板甲'), true), '物防 = 12，魔防 = 洞察');
check('無裝甲：本來就沒有先攻，逐字不變',
  resolveArmorDesc(armorByName.get('無裝甲 / 冒險服'), true), '物防 = 靈巧，魔防 = 洞察');
check('沒有逗號殘尾',
  armors.filter((a) => /[，,]\s*$/.test(resolveArmorDesc(a, true))).map((a) => a.name), []);
check('會變的共八件（七件有先攻 + 戰鬥輕甲）',
  armorDescChangesUnderVariant(armors).sort(),
  ['絲綢外衣', '旅行皮甲', '戰鬥輕甲', '板條甲', '符文甲冑', '賢者長袍', '鋼鐵板甲', '青銅胸甲'].sort());

// ─────────────────────────────────────────────────────────── F
section('F. 裝備試算（computeArmorOutcome）與角色卡引擎共用同一個判定');

const dice = { DEX: 10, INS: 8 };
check('核心：戰鬥輕甲 物防 11／魔防 9',
  computeArmorOutcome(armorByName.get(COMBAT_TUNIC_NAME), dice),
  { def: 11, mdef: 9, initMod: 0 });
check('變體：戰鬥輕甲 物防 12／魔防 8',
  computeArmorOutcome(armorByName.get(COMBAT_TUNIC_NAME), dice, { initiativeVariant: true }),
  { def: 12, mdef: 8, initMod: 0 });
check('核心：旅行皮甲先攻 -1',
  computeArmorOutcome(armorByName.get(TRAVEL_GARB_NAME), dice),
  { def: 11, mdef: 9, initMod: -1 });
check('變體：旅行皮甲先攻 0',
  computeArmorOutcome(armorByName.get(TRAVEL_GARB_NAME), dice, { initiativeVariant: true }),
  { def: 11, mdef: 9, initMod: 0 });
check('變體：鋼鐵板甲 物防 12／魔防 8／先攻 0',
  computeArmorOutcome(armorByName.get('鋼鐵板甲'), dice, { initiativeVariant: true }),
  { def: 12, mdef: 8, initMod: 0 });
check('無防具兩態相同（沒有側寫可改）',
  [computeArmorOutcome(null, dice), computeArmorOutcome(null, dice, { initiativeVariant: true })],
  [{ def: 10, mdef: 8, initMod: 0 }, { def: 10, mdef: 8, initMod: 0 }]);

// ─────────────────────────────────────────────────────────── G
section('G. 角色卡數值引擎（calculateCharacterStats）');

const makeChar = (armor, { accessory = '', variant = false, dex = 10, ins = 8 } = {}) => {
  const ch = createNewCharacter({}, { ...DEFAULT_CREATION_RULES, initiativeVariant: variant });
  ch.creationRules = variant ? { initiativeVariant: true } : {};
  ch.attributes = { dex, ins, mig: 8, wlp: 8 };
  ch.classes = [];
  ch.equipment = { mainHand: '徒手打擊', offHand: '無盾牌', armor, accessory };
  return ch;
};

const statsCore = calculateCharacterStats(makeChar(COMBAT_TUNIC_NAME));
const statsVariant = calculateCharacterStats(makeChar(COMBAT_TUNIC_NAME, { variant: true }));
check('核心：戰鬥輕甲 物防 11', statsCore.def, 11);
check('核心：戰鬥輕甲 魔防 9', statsCore.mdef, 9);
check('變體：戰鬥輕甲 物防 12', statsVariant.def, 12);
check('變體：戰鬥輕甲 魔防 8', statsVariant.mdef, 8);
check('變體不動 HP／MP／IP',
  [statsVariant.maxHp, statsVariant.maxMp, statsVariant.maxIp],
  [statsCore.maxHp, statsCore.maxMp, statsCore.maxIp]);

const statsPlate = calculateCharacterStats(makeChar('鋼鐵板甲'));
const statsPlateVariant = calculateCharacterStats(makeChar('鋼鐵板甲', { variant: true }));
check('核心：鋼鐵板甲先攻 -4', statsPlate.init, -4);
check('變體：鋼鐵板甲先攻 0', statsPlateVariant.init, 0);
check('核心：先攻明細有裝備項',
  statsPlate.breakdown.init.terms.map((t) => t.kind), ['equip']);
check('變體：先攻明細只剩一列說明',
  statsPlateVariant.breakdown.init.terms.map((t) => t.label), [initiativeVariantTermLabel()]);
check('變體：明細說明不含「先攻 +」的假加值',
  statsPlateVariant.breakdown.init.terms.filter((t) => String(t.value).includes('+')), []);

const statsBoots = calculateCharacterStats(makeChar('無裝甲 / 冒險服', { accessory: '風行長靴' }));
const statsBootsVariant = calculateCharacterStats(makeChar('無裝甲 / 冒險服', { accessory: '風行長靴', variant: true }));
check('核心：風行長靴 先攻 +2', statsBoots.init, 2);
check('變體：風行長靴的加值被忽略（原文：不要換成別的加值）', statsBootsVariant.init, 0);

// ─────────────────────────────────────────────────────────── H
section('H. 顯示字串（先攻值不存在 → 「不計」，不是 0）');

check('0 在核心規則下是 +0', formatInitiative(0, false), '+0');
check('正值帶正號', formatInitiative(2, false), '+2');
check('負值不再出現 +-4 這種字串', formatInitiative(-4, false), '-4');
check('變體：不計（0）', formatInitiative(0, true), '不計');
check('變體：不計（負值也一樣）', formatInitiative(-4, true), '不計');
check('沒有反派 → 英雄方', describeInitiativeOrder(), { side: 'heroes', label: '英雄方先攻', reason: '場上沒有反派' });
check('有反派 → 敵方', describeInitiativeOrder({ hasVillain: true }), { side: 'enemy', label: '敵方先攻', reason: '場上有反派' });

// ─────────────────────────────────────────────────────────── I
section('I. 原始碼護欄：判定只有一份，呼叫點不得自己再判一次');

const engineSrc = READ('src/features/character-sheet/utils/characterEngine.js');
const equipSrc = READ('src/features/character-sheet/utils/equipmentRules.js');
const rulesSrc = READ('src/features/character-sheet/data/creationRules.js');
const cardSrc = READ('src/features/character-sheet/components/CharacterCard.jsx');
const hudSrc = READ('src/features/character-sheet/components/CharacterPlayHUD.jsx');
const sheetSrc = READ('src/features/character-sheet/CharacterSheet.jsx');
const exportSrc = READ('src/features/character-sheet/components/CharacterSheetExport.jsx');

check('引擎不再直接讀 armorDef.initMod', engineSrc.includes('armorDef.initMod'), false);
check('引擎不再直接讀 armorDef.defFormula', engineSrc.includes('armorDef.defFormula'), false);
check('引擎改讀側寫 armorProfile', engineSrc.includes('getArmorProfile(armorDef'), true);
check('裝備層也走同一個側寫', equipSrc.includes('getArmorProfile(armor'), true);
check('裝備層不自己判斷變體規則', equipSrc.includes("initiativeVariant === true"), false);
check('開卡規則欄位已註冊', rulesSrc.includes(`'${INITIATIVE_VARIANT_FIELD}'`), true);
check('四個顯示點都改用 formatInitiative',
  [cardSrc, hudSrc, sheetSrc].filter((src) => !src.includes('formatInitiative(stats.init')).length, 0);
check('角色卡不再寫死 +{stats.init}（負值會變成 +-4）',
  [cardSrc, sheetSrc].filter((src) => src.includes('+{stats.init}')).length, 0);
check('三頁匯出也走變體判定', exportSrc.includes('isInitiativeVariant(ch)'), true);
check('三頁匯出的先攻欄會印「不計」', exportSrc.includes("model.initiativeVariant ? '不計'"), true);

// ─────────────────────────────────────────────────────────── J
section('J. SSR 煙霧：角色卡與裝備挑選視窗兩態');

const cardChar = (variant) => {
  const ch = makeChar(COMBAT_TUNIC_NAME, { variant });
  ch.name = '先攻變體測試';
  return ch;
};
const coreCardHtml = plain(renderToStaticMarkup(React.createElement(CharacterCard, { character: cardChar(false) })));
const variantCardHtml = plain(renderToStaticMarkup(React.createElement(CharacterCard, { character: cardChar(true) })));
check('角色卡（核心）：顯示 +0', coreCardHtml.includes('先攻: +0'), true);
check('角色卡（變體）：顯示不計', variantCardHtml.includes('先攻: 不計'), true);
check('角色卡（變體）：不再顯示 +0', variantCardHtml.includes('先攻: +0'), false);

const plateCardHtml = plain(renderToStaticMarkup(React.createElement(CharacterCard, { character: makeChar('鋼鐵板甲') })));
check('角色卡（核心）：鋼鐵板甲顯示 -4（不是 +-4）', plateCardHtml.includes('先攻: -4'), true);

const pickerChar = (variant) => {
  const ch = makeChar('無裝甲 / 冒險服', { variant });
  return ch;
};
const theme = getCharacterTheme('parchment');
const renderPicker = (character) => plain(renderToStaticMarkup(React.createElement(EquipmentPickerBody, {
  slot: 'armor',
  theme,
  character,
  stats: calculateCharacterStats(character),
  remainingBudget: 300,
  onSelect: () => {},
  onClose: () => {}
})));

const corePicker = renderPicker(pickerChar(false));
const variantPicker = renderPicker(pickerChar(true));
check('裝備表（核心）：戰鬥輕甲寫「靈巧 + 1」', corePicker.includes('物防 = 靈巧 + 1，魔防 = 洞察 + 1'), true);
check('裝備表（核心）：板條甲仍寫「先攻 -2」', corePicker.includes('先攻 -2'), true);
check('裝備表（變體）：戰鬥輕甲改寫「靈巧 + 2」', variantPicker.includes('物防 = 靈巧 + 2，魔防 = 洞察'), true);
check('裝備表（變體）：整張表不再出現先攻減值', variantPicker.includes('先攻 -'), false);
check('裝備表（變體）：先攻欄顯示不計', variantPicker.includes('不計'), true);
check('裝備表（核心）：先攻欄沒有「不計」', corePicker.includes('不計'), false);

// ─────────────────────────────────────────────────────────── 結果
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
if (fail > 0) lines.push(`\n失敗 ${fail} 項`);
console.log(lines.join('\n'));
process.exit(fail > 0 ? 1 : 0);
