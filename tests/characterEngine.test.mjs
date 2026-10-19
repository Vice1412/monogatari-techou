/**
 * 角色卡數值引擎測試（characterEngine.js）。
 *
 * 執行：
 *   npx esbuild tests/characterEngine.test.mjs --bundle --platform=node --format=esm \
 *     --outfile=.test-build/characterEngine.mjs --log-level=warning && node .test-build/characterEngine.mjs
 *
 * 全部期望值取自官方英文 Core Rulebook v1.1（印刷頁碼 p.163-164；PDF = 印刷 + 2），逐字引用：
 *
 * - 最大 HP："Your maximum Hit Points are equal to your total character level
 *            + five times your character's base Might die size."
 * - 危機："Your Crisis score is equal to half your maximum Hit Points, rounded down."
 * - 最大 MP："Your maximum Mind Points are equal to your total character level
 *            + five times your character's base Willpower die size."
 * - 最大 IP："Your maximum Inventory Points are equal to 6."
 * - 基礎骰不變式："Note that while some game elements might temporarily alter the die size of your
 *            Attributes, this will never increase or decrease your Hit Points and Mind Points."
 * - 物防："Your Defense is equal to your current Dexterity die size."
 * - 魔防："Your Magic Defense is equal to your current Insight die size."
 * - 先攻："Your Initiative modifier is equal to 0."
 * - 當前骰不變式："Note that some game elements might temporarily alter your Attribute die sizes,
 *            which will affect your Defense and Magic Defense (since these are based on the current
 *            Attribute die size, not your base Attribute die size)."
 * - 免費增益疊加："If two or more of your Classes give you the same free benefits, they will stack!"
 *
 * 官方範例（Camilla，印刷 p.164）：等級 5、基礎 MIG d6、基礎 WLP d8、DEX d8、INS d10；
 * 職業賦予 Weaponmaster（HP +5）與 Orator（MP +5）
 *   -> 最大 HP 40、最大 MP 50、危機 20、最大 IP 6、物防 8、魔防 10、先攻修正 0
 * 本專案對應職業為「武器大師」（HP +5）與「吟唱者」（MP +5）。
 * 本專案屬性以數字儲存骰階（6/8/10/12），故 Camilla 為
 * { level: 5, attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 } }。
 *
 * 注意：官方範例未穿戴任何裝備。本專案 createNewCharacter 的預設裝備
 * （旅行皮甲 + 青銅圓盾 + 守護護符）會額外提供物防／魔防／HP 加值，
 * 故還原官方向量時必須明確清空裝備（見 NEUTRAL_EQUIP）。
 */
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  reduceDieStep,
  createNewCharacter,
  calculateCharacterStats,
  canLevelUp,
  applyLevelUp,
  validateCharacter,
  exportCharacterToCombatant,
  isHpMpChoiceBenefit,
  getCharacterLevel
} from '../src/features/character-sheet/utils/characterEngine.js';
import { DEFAULT_CREATION_RULES } from '../src/features/character-sheet/data/creationRules.js';
import { createCustomWeaponSpec } from '../src/features/character-sheet/data/customWeapons.js';
// 屬性名只有一份定義（使用者裁定：照繁中版角色卡 Excel V2.17）
import { ATTRIBUTE_NAMES } from '../src/features/character-sheet/data/sourcebookConfig.js';

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

// ─────────────────────────────────────────────────────────── 共用夾具

// 中性裝備：無裝甲 / 冒險服（armors[0]，物防 = 靈巧、魔防 = 洞察）、無盾牌（shields[0]，加值 0）
const NEUTRAL_EQUIP = { mainHand: '', offHand: '無盾牌', armor: '無裝甲 / 冒險服', accessory: '' };
// 輕甲組合：旅行皮甲（物防 = 靈巧 + 1、魔防 = 洞察 + 1、先攻 -1）+ 青銅圓盾（物防 +2）
const LIGHT_EQUIP = { mainHand: '', offHand: '青銅圓盾', armor: '旅行皮甲', accessory: '' };
// 重甲組合：板條甲（物防為固定值 10、魔防 = 洞察、先攻 -2）+ 無盾牌
const HEAVY_EQUIP = { mainHand: '', offHand: '無盾牌', armor: '板條甲', accessory: '' };

const ALL_8 = { dex: 8, ins: 8, mig: 8, wlp: 8 };
const HP_MP_CLASSES = [
  { className: '武器大師', level: 3, skills: [] },
  { className: '吟唱者', level: 2, skills: [] }
];
const AFF_KEYS = ['dazed', 'enraged', 'poisoned', 'shaken', 'slow', 'weak'];

// `startingFundsRolled: true`：起始資金已結算（原書 p.165）。
// 沒有它，每一張 `mk()` 出來的卡都會多一筆「起始資金尚未結算」的 error。
const mk = (over = {}) => createNewCharacter({ equipment: NEUTRAL_EQUIP, startingFundsRolled: true, ...over });
const stats = (over = {}) => calculateCharacterStats(mk(over));
const aff = (...on) => Object.fromEntries(AFF_KEYS.map((k) => [k, on.includes(k)]));
const dice = (s) => [s.currentDex, s.currentIns, s.currentMig, s.currentWlp];
const pen = (s) => [s.dexPenalty, s.insPenalty, s.migPenalty, s.wlpPenalty];

// ─────────────────────────────────────────────────────────── A
section('A. HP / MP / IP / 危機 公式（官方 Camilla 向量 + 免費增益疊加）');

// 資料層前提：本節數值全部建立在下列職業免費增益字串之上；資料一旦被改動，這裡會先失敗
check('資料：武器大師 freeBenefits 為 HP +5',
  rulesData.classes['武器大師'].freeBenefits.includes('最大HP永久提高5點'), true);
check('資料：吟唱者 freeBenefits 為 MP +5',
  rulesData.classes['吟唱者'].freeBenefits.includes('最大MP永久提高5點'), true);
check('資料：暗黑之刃 freeBenefits 為 HP +5',
  rulesData.classes['暗黑之刃'].freeBenefits.includes('最大HP永久提高5點'), true);
check('資料：元素師 freeBenefits 為 MP +5',
  rulesData.classes['元素師'].freeBenefits.includes('最大MP永久提高5點'), true);
check('資料：死靈術士為二選一職業（含「或」）',
  rulesData.classes['死靈術士'].freeBenefits.includes('或'), true);

// 官方範例 Camilla：未穿裝備，故裝備必須清空（否則預設的守護護符會多送 5 點 HP）
const camilla = mk({
  level: 5,
  attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
  classes: HP_MP_CLASSES
});
const cs = calculateCharacterStats(camilla);
check('Camilla 最大 HP = 40（等級 5 + 基礎 MIG d6 × 5 + 武器大師 5）', cs.maxHp, 40);
check('Camilla 最大 MP = 50（等級 5 + 基礎 WLP d8 × 5 + 吟唱者 5）', cs.maxMp, 50);
check('Camilla 危機 = 20（最大 HP 一半，向下取整）', cs.crisisThreshold, 20);
check('Camilla 最大 IP = 6', cs.maxIp, 6);
check('Camilla 物防 = 8（當前 DEX d8）', cs.def, 8);
check('Camilla 魔防 = 10（當前 INS d10）', cs.mdef, 10);
check('Camilla 先攻修正 = 0', cs.init, 0);
check('Camilla 基礎骰回報 baseMig = 6', cs.baseMig, 6);
check('Camilla 基礎骰回報 baseWlp = 8', cs.baseWlp, 8);

// HP 公式逐項：等級每 +1 -> HP +1
const hpLv5 = mk({ level: 5, attributes: ALL_8, classes: [{ className: '武器大師', level: 3, skills: [] }] });
const hpLv6 = mk({ level: 6, attributes: ALL_8, classes: [{ className: '武器大師', level: 3, skills: [] }] });
check('HP：等級 5 -> 8 × 5 + 5 + 5 = 50', calculateCharacterStats(hpLv5).maxHp, 50);
check('HP：等級 6 -> 多 1 點 = 51', calculateCharacterStats(hpLv6).maxHp, 51);
check('危機：51 的一半向下取整 = 25', calculateCharacterStats(hpLv6).crisisThreshold, 25);
check('危機：50 的一半 = 25', calculateCharacterStats(hpLv5).crisisThreshold, 25);

// TODO(bug): characterEngine.js:127 以 Math.max(5, ...) 把角色等級夾到至少 5 級，
//   因此等級 1~4 的角色，其 HP / MP / 危機門檻會依原書公式（總等級 + 5 × 基礎骰）算出偏高的值。
//   Fultimator 匯入（fultimatorConverter.js:88 的 parseInt(fChar.lvl) || 5）可產生等級低於 5 的角色，
//   故此路徑可達。以下記錄現況（原書值分別為 46 與 44）。
check('等級 1 的角色：HP 被當成 5 級計算 = 50（現況，原書公式應為 46）',
  calculateCharacterStats(mk({ level: 1, attributes: ALL_8, classes: [{ className: '武器大師', level: 1, skills: [] }] })).maxHp, 50);
check('等級 4 的角色：MP 被當成 5 級計算 = 45（現況，原書公式應為 44）',
  calculateCharacterStats(mk({ level: 4, attributes: ALL_8 })).maxMp, 45);

// 基礎骰每升一階（+2 面）-> HP / MP +10
const mig10 = mk({ level: 5, attributes: { dex: 8, ins: 8, mig: 10, wlp: 8 }, classes: [{ className: '武器大師', level: 3, skills: [] }] });
const wlp10 = mk({ level: 5, attributes: { dex: 8, ins: 8, mig: 8, wlp: 10 }, classes: [{ className: '吟唱者', level: 2, skills: [] }] });
check('HP：基礎 MIG d8 -> d10 = +10 點（60）', calculateCharacterStats(mig10).maxHp, 60);
check('MP：基礎 WLP d8 -> d10 = +10 點（60）', calculateCharacterStats(wlp10).maxMp, 60);

// 無 IP 增益職業 -> 上限 6
check('IP：無 IP 增益職業 -> 6', stats({ attributes: ALL_8 }).maxIp, 6);

// 免費增益疊加（原書：同種免費增益會疊加）
const stackHp = stats({ attributes: ALL_8, classes: [{ className: '武器大師', level: 3, skills: [] }, { className: '暗黑之刃', level: 2, skills: [] }] });
check('疊加：兩個 HP +5 職業 -> 50 + 5 = 55', stackHp.maxHp, 55);
check('疊加：兩個 HP +5 職業 -> MP 不受影響 = 45', stackHp.maxMp, 45);

const stackMp = stats({ attributes: ALL_8, classes: [{ className: '吟唱者', level: 2, skills: [] }, { className: '元素師', level: 3, skills: [] }] });
check('疊加：兩個 MP +5 職業 -> 45 + 5 = 55', stackMp.maxMp, 55);
check('疊加：兩個 MP +5 職業 -> HP 不受影響 = 45', stackMp.maxHp, 45);

const stackIp = stats({ attributes: ALL_8, classes: [{ className: '修補匠', level: 3, skills: [] }, { className: '商人', level: 2, skills: [] }] });
check('疊加：兩個 IP +2 職業 -> 6 + 2 + 2 = 10', stackIp.maxIp, 10);

// 二選一職業（死靈術士）：原書為「HP +5 或 MP +5」，未指定時的預設值屬專案決定
const necro = (chosenBenefit) => stats({
  attributes: ALL_8,
  classes: [{ className: '死靈術士', level: 5, skills: [], ...(chosenBenefit ? { chosenBenefit } : {}) }]
});
check('二選一：未指定 -> 預設 HP +5（專案決定，非原書）', necro().maxHp, 50);
check('二選一：未指定 -> MP 不加', necro().maxMp, 45);
check('二選一：指定 HP -> HP +5', necro('HP').maxHp, 50);
check('二選一：指定 HP -> MP 不加', necro('HP').maxMp, 45);
check('二選一：指定 MP -> MP +5', necro('MP').maxMp, 50);
check('二選一：指定 MP -> HP 不加', necro('MP').maxHp, 45);

// ─────────────────────────────────────────────────────────── B
section('B. 基礎骰 vs 當前骰不變式（HP / MP 必須不受異常狀態影響）');

const clean = stats({ attributes: ALL_8, classes: HP_MP_CLASSES });
const allAff = stats({ attributes: ALL_8, classes: HP_MP_CLASSES, statusAfflictions: aff(...AFF_KEYS) });

check('乾淨角色：最大 HP = 50', clean.maxHp, 50);
check('乾淨角色：最大 MP = 50', clean.maxMp, 50);
check('乾淨角色：四項當前骰 = 基礎骰 8', dice(clean), [8, 8, 8, 8]);
check('乾淨角色：四項減值皆為 0', pen(clean), [0, 0, 0, 0]);

// 前半：當前骰確實下降了
check('六狀態全開：當前骰確實下降為 6/6/6/6', dice(allAff), [6, 6, 6, 6]);
check('六狀態全開：減值確實累計為 2/2/2/2', pen(allAff), [2, 2, 2, 2]);

// 後半：最大 HP / MP 完全沒有變動（HP 用基礎力量、MP 用基礎意志）
check('六狀態全開：最大 HP 仍是 50（不受當前骰影響）', allAff.maxHp, clean.maxHp);
check('六狀態全開：最大 MP 仍是 50（不受當前骰影響）', allAff.maxMp, clean.maxMp);
check('六狀態全開：危機門檻仍是 25', allAff.crisisThreshold, 25);
check('六狀態全開：baseMig 仍回報 8', allAff.baseMig, 8);
check('六狀態全開：baseWlp 仍回報 8', allAff.baseWlp, 8);

// 單一狀態逐一驗證：只降當前骰，不動 HP / MP
const weakOnly = stats({ attributes: ALL_8, statusAfflictions: aff('weak') });
check('僅虛弱：當前 MIG 8 -> 6', weakOnly.currentMig, 6);
check('僅虛弱：最大 HP 仍為 45（力量 d8 × 5 + 等級 5）', weakOnly.maxHp, 45);
check('僅虛弱：當前骰其餘三項不動', [weakOnly.currentDex, weakOnly.currentIns, weakOnly.currentWlp], [8, 8, 8]);

const shakenOnly = stats({ attributes: ALL_8, statusAfflictions: aff('shaken') });
check('僅動搖：當前 WLP 8 -> 6', shakenOnly.currentWlp, 6);
check('僅動搖：最大 MP 仍為 45（意志 d8 × 5 + 等級 5）', shakenOnly.maxMp, 45);

const poisonedOnly = stats({ attributes: ALL_8, statusAfflictions: aff('poisoned') });
check('僅中毒：當前 MIG 與 WLP 同時降至 6', [poisonedOnly.currentMig, poisonedOnly.currentWlp], [6, 6]);
check('僅中毒：最大 HP 與最大 MP 皆不變（45 / 45）', [poisonedOnly.maxHp, poisonedOnly.maxMp], [45, 45]);

// ─────────────────────────────────────────────────────────── C
section('C. 物防 / 魔防 使用「當前」骰（B 的鏡像，真正的錯誤類型）');

// 中性裝備下物防 = 當前 DEX、魔防 = 當前 INS
check('中性裝備：物防 = 當前 DEX = 8', clean.def, 8);
check('中性裝備：魔防 = 當前 INS = 8', clean.mdef, 8);
check('中性裝備 + 六狀態：物防降為 6（同一狀態下 HP/MP 不變）', allAff.def, 6);
check('中性裝備 + 六狀態：魔防降為 6（同一狀態下 HP/MP 不變）', allAff.mdef, 6);

const slowOnly = stats({ attributes: ALL_8, statusAfflictions: aff('slow') });
const dazedOnly = stats({ attributes: ALL_8, statusAfflictions: aff('dazed') });
check('僅緩慢：物防 8 -> 6', slowOnly.def, 6);
check('僅緩慢：魔防不受影響 = 8', slowOnly.mdef, 8);
check('僅眩暈：魔防 8 -> 6', dazedOnly.mdef, 6);
check('僅眩暈：物防不受影響 = 8', dazedOnly.def, 8);

// 輕甲組合（旅行皮甲 + 青銅圓盾）：物防 = 當前 DEX + 1 + 2、魔防 = 當前 INS + 1
const lightClean = calculateCharacterStats(mk({ attributes: ALL_8, equipment: LIGHT_EQUIP }));
const lightAff = calculateCharacterStats(mk({ attributes: ALL_8, equipment: LIGHT_EQUIP, statusAfflictions: aff(...AFF_KEYS) }));
check('輕甲：物防 = 8 + 1 + 2 = 11', lightClean.def, 11);
check('輕甲：魔防 = 8 + 1 + 0 = 9', lightClean.mdef, 9);
check('輕甲：先攻 = -1（旅行皮甲）', lightClean.init, -1);
check('輕甲 + 六狀態：物防降為 6 + 1 + 2 = 9', lightAff.def, 9);
check('輕甲 + 六狀態：魔防降為 6 + 1 + 0 = 7', lightAff.mdef, 7);
check('輕甲 + 六狀態：最大 HP / MP 不變（45 / 45）', [lightAff.maxHp, lightAff.maxMp], [45, 45]);
check('輕甲 + 六狀態：先攻仍為 -1（不隨屬性變動）', lightAff.init, -1);

// 重甲（板條甲）：資料檔將物防設為固定值 10，魔防仍為當前 INS
// 註：固定值 10 來自本專案 rulesData.json，不是本測試自行發明的數值。
const heavyClean = calculateCharacterStats(mk({ attributes: ALL_8, equipment: HEAVY_EQUIP }));
const heavySlow = calculateCharacterStats(mk({ attributes: ALL_8, equipment: HEAVY_EQUIP, statusAfflictions: aff('slow') }));
const heavyDazed = calculateCharacterStats(mk({ attributes: ALL_8, equipment: HEAVY_EQUIP, statusAfflictions: aff('dazed') }));
check('重甲：物防 = 固定值 10', heavyClean.def, 10);
check('重甲：魔防 = 當前 INS = 8', heavyClean.mdef, 8);
check('重甲：先攻 = -2（板條甲）', heavyClean.init, -2);
check('重甲 + 緩慢：物防仍為固定值 10（不隨 DEX 變動）', heavySlow.def, 10);
check('重甲 + 眩暈：魔防仍隨當前 INS 降至 6', heavyDazed.mdef, 6);

// 找不到防具／盾牌時的回退行為（characterEngine.js:232-233）
// 目前 armors[0] = 無裝甲 / 冒險服（dex / ins / 0）、shields[0] = 無盾牌（0 / 0 / 0），兩者皆中性，
// 因此「未穿防具」與「回退到索引 0」在數值上恰好一致。
// TODO(bug): 回退到 armors[0] / shields[0] 的語意是錯的——角色沒穿防具時不該套用任何防具公式。
//   目前因 armors[0] 恰為中性而未產生數值偏差；一旦 armors[0] 換成帶加值的防具，
//   所有未指定防具（或防具名稱對不上）的角色都會被靜默套用該防具的物防／魔防公式。
check('資料：armors[0] 為中性無裝甲（物防 = 靈巧、魔防 = 洞察、先攻 0）',
  [rulesData.equipment.armors[0].name, rulesData.equipment.armors[0].defFormula, rulesData.equipment.armors[0].mdefFormula, rulesData.equipment.armors[0].initMod],
  ['無裝甲 / 冒險服', 'dex', 'ins', 0]);
check('資料：shields[0] 為中性無盾牌（加值 0）',
  [rulesData.equipment.shields[0].name, rulesData.equipment.shields[0].defBonus, rulesData.equipment.shields[0].mdefBonus, rulesData.equipment.shields[0].initMod],
  ['無盾牌', 0, 0, 0]);
const unknownArmor = calculateCharacterStats(mk({ attributes: ALL_8, equipment: { mainHand: '', offHand: '不存在的盾牌', armor: '不存在的防具', accessory: '' } }));
check('未知防具名稱 -> 回退 armors[0]，物防 = 當前 DEX = 8', unknownArmor.def, 8);
check('未知盾牌名稱 -> 回退 shields[0]，魔防 = 當前 INS = 8', unknownArmor.mdef, 8);
const noEquip = calculateCharacterStats(mk({ attributes: ALL_8, equipment: {} }));
check('完全沒有裝備欄位 -> 物防 = 當前 DEX = 8', noEquip.def, 8);
check('完全沒有裝備欄位 -> 魔防 = 當前 INS = 8', noEquip.mdef, 8);
check('完全沒有裝備欄位 -> 先攻 = 0', noEquip.init, 0);

// 雙手武器佔滿兩個手部欄位（Core p.131）→ 副手裝備不生效。
// UI 在切換主手時就會自動卸下副手（見 test:equipment §Q），這裡處理的是既有存檔的殘留組合。
const twoHandedWithShield = calculateCharacterStats(mk({
  attributes: ALL_8,
  equipment: { mainHand: '戰斧', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' }
}));
check('雙手武器 + 副手盾牌：盾牌加值不生效（物防 = 8 + 1，無 +2）', twoHandedWithShield.def, 9);
check('雙手武器 + 副手盾牌：魔防也不吃盾牌（= 8 + 1，無 +2）', twoHandedWithShield.mdef, 9);
check('雙手武器 + 副手盾牌：先攻不計盾牌（旅行皮甲 -1、符文圓盾 0）', twoHandedWithShield.init, -1);
const oneHandedWithShield = calculateCharacterStats(mk({
  attributes: ALL_8,
  equipment: { mainHand: '青銅劍', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' }
}));
check('對照：單手武器 + 同一個盾牌時加值照算（8 + 1 + 2 = 11）', oneHandedWithShield.def, 11);

// ─────────────────────────────────────────────────────────── D
section('D. 六大異常狀態映射（眩暈／憤怒／中毒／動搖／緩慢／虛弱）');

const d = (name) => stats({ attributes: ALL_8, statusAfflictions: aff(name) });
check('眩暈：僅 INS 減值 1', pen(d('dazed')), [0, 1, 0, 0]);
check('眩暈：當前骰 8/6/8/8', dice(d('dazed')), [8, 6, 8, 8]);
check('憤怒：DEX 與 INS 各減值 1', pen(d('enraged')), [1, 1, 0, 0]);
check('憤怒：當前骰 6/6/8/8', dice(d('enraged')), [6, 6, 8, 8]);
check('中毒：MIG 與 WLP 各減值 1', pen(d('poisoned')), [0, 0, 1, 1]);
check('中毒：當前骰 8/8/6/6', dice(d('poisoned')), [8, 8, 6, 6]);
check('動搖：僅 WLP 減值 1', pen(d('shaken')), [0, 0, 0, 1]);
check('動搖：當前骰 8/8/8/6', dice(d('shaken')), [8, 8, 8, 6]);
check('緩慢：僅 DEX 減值 1', pen(d('slow')), [1, 0, 0, 0]);
check('緩慢：當前骰 6/8/8/8', dice(d('slow')), [6, 8, 8, 8]);
check('虛弱：僅 MIG 減值 1', pen(d('weak')), [0, 0, 1, 0]);
check('虛弱：當前骰 8/8/6/8', dice(d('weak')), [8, 8, 6, 8]);

// 組合：同向疊加
check('緩慢 + 憤怒：DEX 減值累計為 2 -> 8 降兩階 = 6',
  pen(stats({ attributes: ALL_8, statusAfflictions: aff('slow', 'enraged') })), [2, 1, 0, 0]);
check('中毒 + 動搖：WLP 減值累計為 2 -> 8 降兩階 = 6',
  dice(stats({ attributes: ALL_8, statusAfflictions: aff('poisoned', 'shaken') }))[3], 6);

// d6 下限：基礎骰已是 d6 時，再降階仍為 d6（不低於 d6）
const lowDice = { dex: 6, ins: 12, mig: 6, wlp: 8 };
const lowSlow = stats({ attributes: lowDice, statusAfflictions: aff('slow') });
const lowWeak = stats({ attributes: lowDice, statusAfflictions: aff('weak') });
const lowDazed = stats({ attributes: lowDice, statusAfflictions: aff('dazed') });
const lowShaken = stats({ attributes: lowDice, statusAfflictions: aff('shaken') });
check('d6 下限：基礎 DEX d6 + 緩慢 -> 仍為 6', lowSlow.currentDex, 6);
check('d6 下限：基礎 DEX d6 + 緩慢 -> 減值仍計為 1', lowSlow.dexPenalty, 1);
check('d6 下限：基礎 MIG d6 + 虛弱 -> 仍為 6', lowWeak.currentMig, 6);
check('d6 下限：基礎 WLP d8 + 動搖 -> 6', lowShaken.currentWlp, 6);
check('d12 降一階：基礎 INS d12 + 眩暈 -> 10', lowDazed.currentIns, 10);

// ─────────────────────────────────────────────────────────── E
section('E. reduceDieStep：骰階階梯 [6, 8, 10, 12]');

check('0 步：d6 不變', reduceDieStep(6, 0), 6);
check('0 步：d8 不變', reduceDieStep(8, 0), 8);
check('0 步：d10 不變', reduceDieStep(10, 0), 10);
check('0 步：d12 不變', reduceDieStep(12, 0), 12);
check('1 步：d12 -> d10', reduceDieStep(12, 1), 10);
check('1 步：d10 -> d8', reduceDieStep(10, 1), 8);
check('1 步：d8 -> d6', reduceDieStep(8, 1), 6);
check('1 步：d6 已是最低階 -> 6', reduceDieStep(6, 1), 6);
check('2 步：d12 -> d8', reduceDieStep(12, 2), 8);
check('2 步：d10 -> d6', reduceDieStep(10, 2), 6);
check('2 步：d8 -> 夾在 d6', reduceDieStep(8, 2), 6);
check('3 步：d12 -> d6', reduceDieStep(12, 3), 6);
check('過度降階：d12 降 5 階 -> 夾在 d6', reduceDieStep(12, 5), 6);
check('過度降階：d8 降 99 階 -> 夾在 d6', reduceDieStep(8, 99), 6);
check('預設步數 = 1：d8 -> d6', reduceDieStep(8), 6);
check('預設步數 = 1：d12 -> d10', reduceDieStep(12), 10);

// 未知輸入（不在階梯上）：退路公式為 baseDie - steps × 2，下限 6
check('未知輸入 d20 降 1 階 -> 18（退路公式）', reduceDieStep(20, 1), 18);
check('未知輸入 d14 降 1 階 -> 12（退路公式）', reduceDieStep(14, 1), 12);
check('未知輸入 d7 降 1 階 -> 夾在 6', reduceDieStep(7, 1), 6);
check('未知輸入 d4 降 1 階 -> 夾在 6', reduceDieStep(4, 1), 6);
check('未知輸入 d0 降 1 階 -> 夾在 6', reduceDieStep(0, 1), 6);
// 註：呼叫端一律傳入數字基礎骰；undefined 會落到退路公式而得到 NaN，僅記錄現況。
check('未知輸入 undefined -> NaN（呼叫端不會產生此輸入）', Number.isNaN(reduceDieStep(undefined, 1)), true);

// ─────────────────────────────────────────────────────────── F
section('F. createNewCharacter：全新角色卡預設結構');

const fresh = createNewCharacter();
check('等級預設 5', fresh.level, 5);
check('EXP 預設 0', fresh.exp, 0);
check('澤尼特預設 500（官方起始裝備預算）', fresh.zenit, 500);
check('物語點預設 3', fresh.fabulaPoints, 3);
// 四維屬性**預設是空的**（0 = 尚未指派）——原書 p.162 給了三組建議陣列，
// 但選哪一組是玩家的決定，系統不替他先套「萬事通」（使用者指示 2026-10-06）。
check('四項屬性預設為 0（尚未指派，不先套萬事通）',
  [fresh.attributes.dex, fresh.attributes.ins, fresh.attributes.mig, fresh.attributes.wlp], [0, 0, 0, 0]);
check('屬性骰階總和預設為 0（尚未分配，不是 32）',
  fresh.attributes.dex + fresh.attributes.ins + fresh.attributes.mig + fresh.attributes.wlp, 0);
// 0 不能被當成「d0 的屬性」偷偷算進六項數值——`attributesUnset` 讓介面顯示「—」
check('四維未指派時，六項數值標記為不成立',
  calculateCharacterStats(fresh).attributesUnset, true);
check('指派完成後就不再是不成立',
  calculateCharacterStats(mk({ attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 } })).attributesUnset, false);
check('只指派一項仍算不成立',
  calculateCharacterStats(mk({ attributes: { dex: 10, ins: 0, mig: 0, wlp: 0 } })).attributesUnset, true);
check('六大狀態旗標齊備且全為 false',
  AFF_KEYS.map((k) => fresh.statusAfflictions[k]), [false, false, false, false, false, false]);
check('當前 HP / MP / IP 皆為 null（null 代表等於最大值）',
  [fresh.currentHp, fresh.currentMp, fresh.currentIp], [null, null, null]);
check('職業清單預設為空', fresh.classes, []);
// 2026-10-06 起預設全開（使用者裁定；上限仍由 allowedSourcebooks 把關）
// 2026-10-19：公測修訂不再是「手冊」——它是開卡規則的【開放公測修訂內容】開關（§BE），
// 預設關閉，所以 `enabledSourcebooks` 預設不含 playtest；打開開關時 resolve 會自動補上。
check('啟用來源手冊預設全開（不含公測修訂）', fresh.enabledSourcebooks,
  ['core', 'highFantasy', 'technoFantasy', 'naturalFantasy', 'bonus']);
check('情感羈絆預設 0 條（原書 p.154 創角八步驟無羈絆；羈絆於遊戲中建立 p.57）', fresh.bonds.length, 0);
check('個人命刻預設 0 座（原書創角八步驟無命刻，不預先種一條；見 §AB 的預設羈絆）', fresh.clocks.length, 0);
check('咒語與英雄技能預設為空', [fresh.spells.length, fresh.heroicSkills.length], [0, 0]);
check('預設主手為徒手打擊', fresh.equipment.mainHand, '徒手打擊');
check('預設副手也為徒手打擊（開卡兩手皆空手）', fresh.equipment.offHand, '徒手打擊');
check('預設不穿防具', fresh.equipment.armor, '無裝甲 / 冒險服');
check('預設不佩戴飾品', fresh.equipment.accessory, '');

// overrides 為最上層覆寫（不做深層合併）
const overridden = createNewCharacter({ level: 12, name: '覆寫測試' });
check('overrides 覆寫等級', overridden.level, 12);
check('overrides 覆寫姓名', overridden.name, '覆寫測試');
check('overrides 未提及的欄位保持預設（防具）', overridden.equipment.armor, '無裝甲 / 冒險服');

// id 唯一性
const idA = createNewCharacter().id;
const idB = createNewCharacter().id;
check('id 具 char_ 前綴', idA.startsWith('char_'), true);
check('兩次建立的 id 不相同', idA === idB, false);

// ─────────────────────────────────────────────────────────── G
section('G. canLevelUp / applyLevelUp：10 EXP = 1 級，等級上限 50');

check('EXP 10 / 等級 5 -> 可升級', canLevelUp({ exp: 10, level: 5 }), true);
check('EXP 9 / 等級 5 -> 不可升級', canLevelUp({ exp: 9, level: 5 }), false);
check('EXP 0 / 等級 5 -> 不可升級', canLevelUp({ exp: 0, level: 5 }), false);
check('EXP 100 / 等級 49 -> 可升級', canLevelUp({ exp: 100, level: 49 }), true);
check('EXP 100 / 等級 50 -> 已達上限，不可升級', canLevelUp({ exp: 100, level: 50 }), false);
check('缺 exp 欄位 -> 視為 0，不可升級', canLevelUp({ level: 5 }), false);

const growBase = mk({
  level: 5,
  exp: 10,
  attributes: ALL_8,
  classes: [{ className: '武器大師', level: 3, skills: [{ name: '碎骨擊', sl: 2 }] }]
});
check('升級前：最大 HP = 50', calculateCharacterStats(growBase).maxHp, 50);
check('升級前：最大 MP = 45', calculateCharacterStats(growBase).maxMp, 45);

// EXP 不足時原物件原樣回傳
const noGrow = mk({ level: 5, exp: 9, classes: [{ className: '武器大師', level: 3, skills: [] }] });
check('EXP 不足 -> 原物件原樣回傳', applyLevelUp(noGrow, { className: '武器大師', skillName: '碎骨擊' }) === noGrow, true);

// 提升既有技能 SL
const raised = applyLevelUp(growBase, { className: '武器大師', skillName: '碎骨擊' });
check('提升既有技能：角色等級 5 -> 6', raised.level, 6);
check('提升既有技能：扣除 10 EXP -> 0', raised.exp, 0);
check('提升既有技能：職業等級 3 -> 4', raised.classes[0].level, 4);
check('提升既有技能：技能 SL 2 -> 3', raised.classes[0].skills[0].sl, 3);
check('提升既有技能：技能數量不變（1）', raised.classes[0].skills.length, 1);
check('提升既有技能：原角色未被修改（等級仍為 5）', growBase.level, 5);
check('提升既有技能：原角色職業等級仍為 3', growBase.classes[0].level, 3);
check('提升既有技能：原角色技能 SL 仍為 2', growBase.classes[0].skills[0].sl, 2);
check('提升既有技能：原角色 EXP 仍為 10', growBase.exp, 10);

// 等級 +1 -> 最大 HP / MP 各 +1，且當前值同步 +1
check('升級後：最大 HP = 51（等級 +1）', calculateCharacterStats(raised).maxHp, 51);
check('升級後：最大 MP = 46（等級 +1）', calculateCharacterStats(raised).maxMp, 46);
check('升級後：當前 HP = 51（原為 null，先取滿值再 +1）', raised.currentHp, 51);
check('升級後：當前 MP = 46', raised.currentMp, 46);
check('升級後：當前 HP 等於新的最大 HP', raised.currentHp, calculateCharacterStats(raised).maxHp);

// 當前值未滿時：以實際當前值 +1 為準
const wounded = mk({
  level: 5,
  exp: 10,
  currentHp: 20,
  currentMp: 5,
  attributes: ALL_8,
  classes: [{ className: '武器大師', level: 3, skills: [{ name: '碎骨擊', sl: 2 }] }]
});
const healed = applyLevelUp(wounded, { className: '武器大師', skillName: '碎骨擊' });
check('未滿血升級：當前 HP 20 -> 21', healed.currentHp, 21);
check('未滿血升級：當前 MP 5 -> 6', healed.currentMp, 6);
check('未滿血升級：新的最大 HP = 51', calculateCharacterStats(healed).maxHp, 51);

// 在既有職業上新增技能
const newSkill = applyLevelUp(growBase, { className: '武器大師', skillName: '劍刃風暴' });
check('新增技能：技能數量 1 -> 2', newSkill.classes[0].skills.length, 2);
check('新增技能：新技能 SL = 1', newSkill.classes[0].skills[1].sl, 1);
check('新增技能：新技能名稱正確', newSkill.classes[0].skills[1].name, '劍刃風暴');
check('新增技能：職業等級仍 +1 = 4', newSkill.classes[0].level, 4);

// 加入新職業
const newClass = applyLevelUp(growBase, { className: '吟唱者', skillName: '譴責', isNewClass: true });
check('新職業：職業數量 1 -> 2', newClass.classes.length, 2);
check('新職業：新職業等級 = 1', newClass.classes[1].level, 1);
check('新職業：新職業首個技能 SL = 1', newClass.classes[1].skills[0].sl, 1);
check('新職業：新職業名稱正確', newClass.classes[1].className, '吟唱者');
check('新職業：最大 MP 因吟唱者而 +5（等級 6 -> 46 + 5 = 51）', calculateCharacterStats(newClass).maxMp, 51);

// 已達上限 50 級時不動作
const capped = mk({ level: 50, exp: 100, classes: [{ className: '武器大師', level: 3, skills: [] }] });
check('已達 50 級 -> 原物件原樣回傳', applyLevelUp(capped, { className: '武器大師', skillName: '碎骨擊' }) === capped, true);

// 已修正（2026-10-06）：className 不存在於 classes 時，原本會扣 10 EXP 並提升角色等級，
//   但職業與技能完全沒動 → 玩家付出 10 EXP 卻什麼都沒得到。
//   現在改成「找不到那個職業就原物件原樣回傳」——EXP 不能被扣掉。
const lostExp = applyLevelUp(growBase, { className: '不存在的職業', skillName: '不存在的技能' });
check('未知職業升級：原物件原樣回傳（EXP 不會被扣）', lostExp === growBase, true);
check('未知職業升級：角色等級維持 5', lostExp.level, 5);
check('未知職業升級：EXP 維持 10', lostExp.exp, 10);
check('未知職業升級：職業清單完全沒有變動', lostExp.classes.length, 1);

// ─────────────────────────────────────────────────────────── H
section('H. exportCharacterToCombatant：導出至戰鬥輪次追蹤器');

const expChar = mk({
  level: 5,
  attributes: ALL_8,
  classes: [{ className: '武器大師', level: 3, skills: [{ name: '碎骨擊', sl: 2 }] }, { className: '吟唱者', level: 2, skills: [{ name: '譴責', sl: 3 }] }]
});
const exported = exportCharacterToCombatant(expChar);
check('當前 HP 為 null -> 帶入最大 HP 50', exported.hp.current, 50);
check('hp.max = 50', exported.hp.max, 50);
check('hp.crisisThreshold = 25', exported.hp.crisisThreshold, 25);
check('當前 MP 為 null -> 帶入最大 MP 50', exported.mp.current, 50);
check('mp.max = 50', exported.mp.max, 50);
check('當前 IP 為 null -> 帶入最大 IP 6', exported.ip.current, 6);
check('ip.max = 6', exported.ip.max, 6);
check('物防帶入 8', exported.defense, 8);
check('魔防帶入 8', exported.magicDefense, 8);
check('先攻帶入 0', exported.initiative, 0);
check('屬性帶入「當前」骰', [exported.attributes.dex, exported.attributes.ins, exported.attributes.mig, exported.attributes.wlp], [8, 8, 8, 8]);
check('角色定位 = 職業名以斜線串接', exported.role, '武器大師 / 吟唱者');
check('等級帶入 5', exported.level, 5);
check('來源類型為 character', exported.sourceType, 'character');
check('來源 id 對應角色 id', exported.sourceId, expChar.id);
check('尚可行動旗標為 false', exported.hasActed, false);
check('技能 id 為 職業_技能', exported.skills.map((s) => s.id), ['武器大師_碎骨擊', '吟唱者_譴責']);
check('技能名稱附帶 SL', exported.skills.map((s) => s.name), ['碎骨擊 (SL 2)', '譴責 (SL 3)']);
check('實例 id 具 comb_ 前綴', exported.instanceId.startsWith('comb_'), true);
check('保留原始角色資料', exported.rawCharData === expChar, true);
check('導出不會修改原角色的當前 HP', expChar.currentHp, null);

// 已設定當前值時必須被尊重
const setChar = mk({
  level: 5,
  attributes: ALL_8,
  classes: HP_MP_CLASSES,
  currentHp: 13,
  currentMp: 7,
  currentIp: 2,
  statusAfflictions: aff('dazed', 'slow')
});
const exportedSet = exportCharacterToCombatant(setChar);
check('已設定當前 HP 13 -> 尊重原值', exportedSet.hp.current, 13);
check('已設定當前 MP 7 -> 尊重原值', exportedSet.mp.current, 7);
check('已設定當前 IP 2 -> 尊重原值', exportedSet.ip.current, 2);
check('hp.max 仍為 50', exportedSet.hp.max, 50);
check('危機門檻隨最大 HP 為 25', exportedSet.hp.crisisThreshold, 25);
check('狀態效果原樣帶入', exportedSet.statusEffects, aff('dazed', 'slow'));
check('屬性帶入「當前」骰（緩慢 + 眩暈）', [exportedSet.attributes.dex, exportedSet.attributes.ins], [6, 6]);
check('物防為當前 DEX = 6', exportedSet.defense, 6);
check('魔防為當前 INS = 6', exportedSet.magicDefense, 6);

// 已修正（2026-10-06）：`char.fabulaPoints || 3` 把 0 當成缺值，物語點 0 會被還原成 3 點。
//   改成 `??`（只擋 null／undefined）之後，0 就是 0。
check('物語點 0 -> 保持 0', exportCharacterToCombatant(mk({ fabulaPoints: 0 })).fabulaPoints, 0);
check('物語點 2 -> 原值 2', exportCharacterToCombatant(mk({ fabulaPoints: 2 })).fabulaPoints, 2);
check('物語點未設定 -> 才用預設 3',
  exportCharacterToCombatant(mk({ fabulaPoints: null })).fabulaPoints, 3);

// ─────────────────────────────────────────────────────────── I
section('I. validateCharacter：創角完整度校驗');

const validChar = mk({
  name: '測試冒險者',
  identity: '流浪劍客',
  origin: '無名村落',
  theme: '希望',
  // 四維預設是空的（見「四項屬性預設為 0」），合規角色必須自己帶上配置
  attributes: ALL_8,
  // 第 6 步「命名與背景」的另外兩格（原書第 8 步的稱呼與外貌描述在本專案的對應）
  gender: '女',
  background: '四處漂泊的劍客。',
  equipment: { ...NEUTRAL_EQUIP, mainHand: '青銅劍' },
  classes: [
    { className: '武器大師', level: 3, skills: [{ name: '碎骨擊', sl: 3 }] },
    { className: '吟唱者', level: 2, skills: [{ name: '譴責', sl: 2 }] }
  ]
});
const validRes = validateCharacter(validChar);
check('合規角色：0 筆問題', validRes.totalIssues, 0);
check('合規角色：isValid = true', validRes.isValid, true);
check('合規角色：hasWarnings = false', validRes.hasWarnings, false);
check('合規角色：errors 為空', validRes.errors.length, 0);

const hasField = (res, field) => res.warnings.some((w) => w.field === field);
const findField = (res, field) => res.warnings.find((w) => w.field === field);

// 步驟 3：屬性骰必須是官方三組陣列之一，或由它們加上等級獎勵（20／40 級各 +1 階）推出來
// （屬性排在職業之後——原書 p.154 第 4 步職業、第 5 步屬性）。
// 2026-10-06 起不再是「總和必須為 32」：那條在 20 級升過一次（d10→d12，總和 34）就會誤報。
const badSum = validateCharacter({ ...validChar, attributes: { dex: 10, ins: 8, mig: 8, wlp: 8 } });
check('d10,d8,d8,d8（不在官方陣列上）-> 產生 attributes 警告', hasField(badSum, 'attributes'), true);
check('d10,d8,d8,d8 -> 警告層級為 warning', findField(badSum, 'attributes').type, 'warning');
check('d10,d8,d8,d8 -> 警告屬於步驟 3', findField(badSum, 'attributes').step, 3);
check('d10,d8,d8,d8 -> 訊息載明升級次數', findField(badSum, 'attributes').message.includes('已升級 1 次'), true);
check('d10,d8,d8,d8 -> 不是 error，isValid 仍為 true', badSum.isValid, true);
check('官方陣列 -> 不產生 attributes 警告', hasField(validRes, 'attributes'), false);

// 步驟 2：5 級起始必須配置 2~3 個職業
const cls = (n) => ['武器大師', '吟唱者', '暗黑之刃', '元素師'].slice(0, n)
  .map((c) => ({ className: c, level: 1, skills: [] }));
const zero = validateCharacter({ ...validChar, classes: cls(0) });
const one = validateCharacter({ ...validChar, classes: cls(1) });
const two = validateCharacter({ ...validChar, classes: cls(2) });
const three = validateCharacter({ ...validChar, classes: cls(3) });
const four = validateCharacter({ ...validChar, classes: cls(4) });
check('0 個職業 -> 2 筆 error（職業數 ＋ 沒有職業卻拿著職業武器）', zero.errors.length, 2);
check('0 個職業 -> error 欄位為 classes', zero.errors[0].field, 'classes');
check('0 個職業 -> 另一筆是裝備的職業武器熟練度（青銅劍是職業武器）', zero.errors[1].field, 'equipment');
check('0 個職業 -> isValid = false', zero.isValid, false);
check('1 個職業 -> 1 筆 error', one.errors.length, 1);
check('1 個職業 -> isValid = false', one.isValid, false);
check('2 個職業 -> 無 error', two.errors.length, 0);
check('2 個職業 -> isValid = true', two.isValid, true);
check('3 個職業 -> 無 error', three.errors.length, 0);
check('3 個職業 -> isValid = true', three.isValid, true);
check('4 個職業 -> 1 筆 error', four.errors.length, 1);
check('4 個職業 -> isValid = false', four.isValid, false);

// 職業數量限制只在 5 級創角時生效
const lv6 = validateCharacter({ ...validChar, level: 6, classes: cls(0) });
check('6 級時 0 個職業 -> 不再有職業數 error（只剩裝備的熟練度那筆）',
  lv6.errors.map((w) => w.field), ['equipment']);

// 步驟 2：技能 SL 總和必須等於角色等級
const badSkills = validateCharacter({
  ...validChar,
  classes: [
    { className: '武器大師', level: 3, skills: [{ name: '碎骨擊', sl: 2 }] },
    { className: '吟唱者', level: 2, skills: [{ name: '譴責', sl: 2 }] }
  ]
});
check('技能總和 4 ≠ 等級 5 -> 產生 skills 警告', hasField(badSkills, 'skills'), true);
check('技能總和 4 ≠ 等級 5 -> 警告層級為 warning（不阻斷）', findField(badSkills, 'skills').type, 'warning');
check('技能總和 4 ≠ 等級 5 -> isValid 仍為 true', badSkills.isValid, true);
check('技能總和 5 = 等級 5 -> 不產生 skills 警告', hasField(validRes, 'skills'), false);
check('totalSkillLevels 正確累計為 5', calculateCharacterStats(validChar).totalSkillLevels, 5);
check('isLevelMatched 為 true', calculateCharacterStats(validChar).isLevelMatched, true);

// 步驟 1：基本身世欄位
const noName = validateCharacter({ ...validChar, name: '   ' });
check('姓名為空白 -> 產生 name 警告', hasField(noName, 'name'), true);
check('身份未填 -> 產生 identity 提示', hasField(validateCharacter({ ...validChar, identity: '' }), 'identity'), true);
check('故鄉未填 -> 產生 origin 提示', hasField(validateCharacter({ ...validChar, origin: '' }), 'origin'), true);

// 羈絆**不是**創角步驟：原書 p.154 的八個步驟沒有羈絆，羈絆於休息場景建立（p.57）。
// 所以「沒有羈絆」不該產生任何驗證警告（以前這裡會催玩家「建議至少建立 1 個」）。
check('無羈絆 -> 不產生 bonds 警告（羈絆不在創角驗證範圍內）',
  hasField(validateCharacter({ ...validChar, bonds: [] }), 'bonds'), false);

// ─────────────────────────────────────────────────────────── J
section('J. 數值構成公式（breakdown）與免費增益二選一');

// 逐項加總工具：字串值（骰階）不計入加總
const sumTerms = (b) => (b?.terms || []).reduce((s, t) => s + (typeof t.value === 'number' ? t.value : 0), 0);

// ── J1 bonusHp / bonusMp / bonusIp 必須真的存在
// 原本回傳物件缺這三個欄位，導致角色卡與跑團卡的提示顯示「被動加成(+undefined)」。
const fortChar = mk({
  attributes: ALL_8,
  classes: [{ className: '守護者', level: 5, skills: [{ name: '不動要塞', sl: 5 }] }]
});
const fortStats = calculateCharacterStats(fortChar);
check('J1 守護者＋不動要塞 SL5：bonusHp = 免費增益 5 + 技能 15 = 20', fortStats.bonusHp, 20);
check('J1 bonusMp = 0', fortStats.bonusMp, 0);
check('J1 bonusIp = 0', fortStats.bonusIp, 0);
check('J1 三個 bonus 欄位皆為數字（不再是 undefined）',
  [fortStats.bonusHp, fortStats.bonusMp, fortStats.bonusIp].every((v) => typeof v === 'number'), true);
check('J1 maxHp = 基礎 40 + 等級 5 + 加成 20 = 65', fortStats.maxHp, 65);

// ── J2 逐項加總不變式：所有數字項相加必須等於該項總額
check('J2 HP：逐項相加等於 maxHp', sumTerms(fortStats.breakdown.hp), fortStats.maxHp);
check('J2 MP：逐項相加等於 maxMp', sumTerms(fortStats.breakdown.mp), fortStats.maxMp);
check('J2 IP：逐項相加等於 maxIp', sumTerms(fortStats.breakdown.ip), fortStats.maxIp);
check('J2 危機合計 = 65 的一半向下取整 = 32', fortStats.breakdown.crisis.total, 32);
check('J2 危機第一項為最大生命值 65', fortStats.breakdown.crisis.terms[0].value, 65);
check('J2 危機第二項為 ÷ 2', fortStats.breakdown.crisis.terms[1].value, '÷ 2');

// ── J3 標籤必須說明這筆數字的身分
const hpLabels = fortStats.breakdown.hp.terms.map((t) => t.label);
check('J3 HP 首項標籤為基礎力量', hpLabels[0], `基礎${ATTRIBUTE_NAMES.mig} d8 × 5`);
check('J3 HP 次項標籤為角色等級', hpLabels[1], '角色等級 Lv 5');
check('J3 HP 含職業免費增益項', hpLabels.includes('守護者 免費增益'), true);
check('J3 HP 含特技 SL 項（帶職業名與 SL 與倍率）', hpLabels.includes('守護者 不動要塞 SL 5 × 3'), true);
check('J3 每一項都有 label / value / kind',
  fortStats.breakdown.hp.terms.every((t) => t.label && t.value !== undefined && t.kind), true);

// ── J4 裝備／屬性構成
const neutralStats = stats({ attributes: ALL_8 });
check('J4 中性裝備物防逐項相加 = 8', sumTerms(neutralStats.breakdown.def), neutralStats.def);
check('J4 中性裝備魔防逐項相加 = 8', sumTerms(neutralStats.breakdown.mdef), neutralStats.mdef);
check('J4 中性裝備先攻沒有任何加成項', neutralStats.breakdown.init.terms.length, 0);

const lightStats = calculateCharacterStats(mk({ attributes: ALL_8, equipment: LIGHT_EQUIP }));
check('J4 輕甲物防 = 靈巧 8 + 防具 1 + 盾牌 2 = 11', sumTerms(lightStats.breakdown.def), lightStats.def);
check('J4 輕甲物防第一項標籤為當前靈巧', lightStats.breakdown.def.terms[0].label, `當前${ATTRIBUTE_NAMES.dex} d8`);
check('J4 輕甲魔防 = 洞察 8 + 防具 1 = 9', sumTerms(lightStats.breakdown.mdef), lightStats.mdef);
check('J4 輕甲先攻逐項相加 = -1', sumTerms(lightStats.breakdown.init), lightStats.init);

const heavyStats = calculateCharacterStats(mk({ attributes: ALL_8, equipment: HEAVY_EQUIP }));
check('J4 重甲物防為單一固定值項', heavyStats.breakdown.def.terms.length, 1);
check('J4 重甲物防固定值 10', heavyStats.breakdown.def.terms[0].value, 10);
check('J4 重甲魔防仍為當前洞察（逐項相加 = 8）', sumTerms(heavyStats.breakdown.mdef), heavyStats.mdef);

const slowStats = stats({ attributes: ALL_8, statusAfflictions: aff('slow') });
check('J4 緩慢：DEX 構成含基礎骰與狀態兩項', slowStats.breakdown.attributes.dex.terms.length, 2);
check('J4 緩慢：DEX 首項為基礎骰 d8', slowStats.breakdown.attributes.dex.terms[0].value, 'd8');
check('J4 緩慢：DEX 次項標籤載明狀態名稱', slowStats.breakdown.attributes.dex.terms[1].label, '狀態 緩慢 降 1 階');
check('J4 緩慢：DEX 合計為 d6', slowStats.breakdown.attributes.dex.total, 6);
check('J4 未受影響的 INS 只有基礎骰一項', slowStats.breakdown.attributes.ins.terms.length, 1);

const bothStats = stats({ attributes: ALL_8, statusAfflictions: aff('slow', 'enraged') });
check('J4 緩慢＋憤怒：DEX 狀態項標籤列出兩個狀態名',
  bothStats.breakdown.attributes.dex.terms[1].label, '狀態 憤怒、緩慢 降 2 階');

// ── J5 飾品 / 英雄技能 / 金手指的來源標籤
const gearStats = calculateCharacterStats(mk({
  attributes: ALL_8,
  equipment: { mainHand: '', offHand: '無盾牌', armor: '無裝甲 / 冒險服', accessory: '守護護符' }
}));
check('J5 飾品守護護符以「飾品 + 名稱」為標籤', gearStats.breakdown.hp.terms.some((t) => t.label === '飾品 守護護符'), true);
check('J5 飾品讓 maxHp = 45 + 5 = 50', gearStats.maxHp, 50);

const heroicStats = calculateCharacterStats(mk({ attributes: ALL_8, heroicSkills: ['額外HP', '額外MP', '額外IP'] }));
check('J5 英雄技能額外HP +10', heroicStats.bonusHp, 10);
check('J5 英雄技能額外MP +10', heroicStats.bonusMp, 10);
check('J5 英雄技能額外IP +4', heroicStats.bonusIp, 4);
check('J5 英雄技能標籤', heroicStats.breakdown.hp.terms.some((t) => t.label === '英雄技能 額外HP'), true);

const quirkStats = calculateCharacterStats(mk({ attributes: ALL_8, quirk: '倖存者（自奇）' }));
check('J5 金手指倖存者 HP +5 / MP +5', [quirkStats.bonusHp, quirkStats.bonusMp], [5, 5]);
check('J5 金手指標籤帶金手指名稱',
  quirkStats.breakdown.mp.terms.some((t) => t.label === '金手指 倖存者（自奇）'), true);

// ── J6 二選一判定：必須只看「最大 HP 或 最大 MP」
const fbOf = (cn) => {
  const c = rulesData.classes[cn] || {};
  return (c.freeBenefits || '') + ' ' + (c.freeBonus || '');
};
const CHOICE_CLASSES = ['秘儀師【Playtest】', '死靈術士', '舞者', '祈喚者', '植物學家', '卡牌大師'];
CHOICE_CLASSES.forEach((cn) => {
  check(`J6 ${cn} 判定為 HP/MP 二選一`, isHpMpChoiceBenefit(fbOf(cn)), true);
});
// 「或」出現在武器類別（而不是 HP/MP 兩側）時不得誤判——原本這是
// 暗黑之刃【Playtest】的案例；該職業已於 2026-10-19 依使用者裁定刪除（§BE），
// 改用合成字串保留同一條回歸護欄（被測的是 `isHpMpChoiceBenefit` 的判定規則）。
check('J6 「職業近戰 或 遠程」屬武器類別，不得判為 HP/MP 二選一',
  isHpMpChoiceBenefit('HP +5，職業近戰 或 遠程（二選一）'), false);
check('J6 守護者（固定 HP +5）不得判為二選一', isHpMpChoiceBenefit(fbOf('守護者')), false);
check('J6 機師（固定 HP +5，近戰/遠程皆給）不得判為二選一', isHpMpChoiceBenefit(fbOf('機師')), false);
check('J6 全 29 個職業中，僅 6 個屬 HP/MP 二選一',
  Object.keys(rulesData.classes).filter((cn) => isHpMpChoiceBenefit(fbOf(cn))).length, 6);

// ── J7 二選一的實際數值
const choiceStats = (cn, benefit) => calculateCharacterStats(mk({
  attributes: ALL_8,
  classes: [{ className: cn, level: 5, skills: [], ...(benefit ? { chosenBenefit: benefit } : {}) }]
}));
CHOICE_CLASSES.forEach((cn) => {
  check(`J7 ${cn} 指定 MP -> HP 45 / MP 50`, [choiceStats(cn, 'MP').maxHp, choiceStats(cn, 'MP').maxMp], [45, 50]);
  check(`J7 ${cn} 指定 HP -> HP 50 / MP 45`, [choiceStats(cn, 'HP').maxHp, choiceStats(cn, 'HP').maxMp], [50, 45]);
  check(`J7 ${cn} 未指定 -> 沿用既有預設 HP +5`, [choiceStats(cn).maxHp, choiceStats(cn).maxMp], [50, 45]);
});
// 非二選一職業即使被指定 chosenBenefit，也不能改變固定 HP +5
// （原本用 暗黑之刃【Playtest】 驗這條；該職業已刪除，改用守護者驗同一個不變式）
check('J7 非二選一職業（守護者）即使被指定 MP，仍為固定 HP +5',
  [choiceStats('守護者', 'MP').maxHp, choiceStats('守護者', 'MP').maxMp], [50, 45]);

// ── J8 二選一職業的標籤要標明點數落在哪一邊
check('J8 二選一選 HP 時標籤為（HP）',
  choiceStats('舞者', 'HP').breakdown.hp.terms.some((t) => t.label === '舞者 免費增益（HP）'), true);
check('J8 二選一選 MP 時標籤為（MP）',
  choiceStats('舞者', 'MP').breakdown.mp.terms.some((t) => t.label === '舞者 免費增益（MP）'), true);
check('J8 未指定時標籤仍為（HP）',
  choiceStats('舞者').breakdown.hp.terms.some((t) => t.label === '舞者 免費增益（HP）'), true);

// ── J9 機師載具的防禦覆蓋（Techno Fantasy Atlas p.161）
const mountedStats = calculateCharacterStats(mk({
  attributes: ALL_8,
  pilotVehicle: { isMounted: true, activeModules: ['standard_plating', 'shield_module', 'shield_module'] }
}));
check('J9 標準鍍層 物防 11 + 盾牌模組 2×2 = 15', mountedStats.def, 15);
check('J9 標準鍍層 魔防 10 + 盾牌模組 2×2 = 14', mountedStats.mdef, 14);
check('J9 載具物防逐項相加 = 15', sumTerms(mountedStats.breakdown.def), 15);
check('J9 載具物防首項為模組固定值 11', mountedStats.breakdown.def.terms[0].value, 11);

const flexStats = calculateCharacterStats(mk({
  attributes: ALL_8,
  pilotVehicle: { isMounted: true, activeModules: ['flexible_plating'] }
}));
check('J9 柔性鍍層 物防 = 靈巧 8 + 2 = 10', flexStats.def, 10);
check('J9 柔性鍍層 魔防 = 洞察 8 + 1 = 9', flexStats.mdef, 9);
check('J9 柔性鍍層物防逐項相加 = 10', sumTerms(flexStats.breakdown.def), 10);

// ─────────────────────────────────────────────────────────── K
section('K. 等級的單一讀取點、裝備回退、物語點（2026-10-06 修正）');

// 等級：玩家可以直接編輯那個欄位（編輯器有 5～50 的數字框），所以它才是權威。
// 以前「卡片讀 char.level、三頁表格讀職業等級總和」，同一張卡會顯示兩個不同的等級。
check('getCharacterLevel 讀玩家設定的等級', getCharacterLevel(mk({ level: 7 })), 7);
check('沒有等級時退回開卡規則的起始等級',
  getCharacterLevel({}), DEFAULT_CREATION_RULES.startingLevel);
check('等級最低就是開卡規則的起始等級（使用者裁定：開卡規則就是最低 5）',
  calculateCharacterStats(mk({ level: 1 })).maxHp,
  calculateCharacterStats(mk({ level: 5 })).maxHp);
check('起始等級由開卡規則決定（不是寫死 5）',
  calculateCharacterStats(mk({ level: 3 })).maxHp
    === calculateCharacterStats(mk({ level: DEFAULT_CREATION_RULES.startingLevel })).maxHp,
  true);

// 職業等級總和與角色等級對不上時，要**講出來**，而不是偷偷用另一個數字蓋掉
const drifted = mk({ level: 5, classes: [{ className: '武器大師', level: 2, skills: [] }] });
check('職業等級總和與角色等級不一致 -> 產生一則提醒',
  validateCharacter(drifted).warnings.some((w) => w.message.includes('職業等級總和為 2')),
  true);
check('兩者一致時不提醒',
  validateCharacter(mk({ level: 5, classes: [{ className: '武器大師', level: 3, skills: [] }, { className: '吟唱者', level: 2, skills: [] }] }))
    .warnings.some((w) => w.message.includes('職業等級總和')),
  false);

// 裝備回退：一律回**具名的中性條目**，不是「資料表第一筆」
// （第一筆剛好是中性值只是運氣；哪天有人把新裝備插到最前面就會靜默多給加值）
const noArmorName = calculateCharacterStats(mk({
  attributes: ALL_8,
  equipment: { armor: '資料表裡沒有的名字', mainHand: '徒手打擊', offHand: '無盾牌' }
}));
const neutralArmor = calculateCharacterStats(mk({ attributes: ALL_8 }));
check('防具名字查不到 -> 等同中性裝甲（物防）', noArmorName.def, neutralArmor.def);
check('防具名字查不到 -> 等同中性裝甲（魔防）', noArmorName.mdef, neutralArmor.mdef);
check('回退是「具名中性條目」而不是陣列第一筆',
  rulesData.equipment.armors[0].name, '無裝甲 / 冒險服');
check('盾牌表的第一筆也是中性條目（回退才不會白送加值）',
  rulesData.equipment.shields[0].name, '無盾牌');
const unknownShield = calculateCharacterStats(mk({
  attributes: ALL_8,
  equipment: { armor: '無裝甲 / 冒險服', mainHand: '徒手打擊', offHand: '資料表裡沒有的盾' }
}));
check('副手名字查不到 -> 等同無盾牌', unknownShield.def, neutralArmor.def);

// ─────────────────────────────────────────────────────────── 死靈術士【殘酷的誕生】的僕從
section('死靈術士【殘酷的誕生】：僕從代價（HP／MP 上限各減去該 NPC 的等級）');
const noMinion = stats();
const withMinion = stats({ necroData: { minion: { active: true, npcLevel: 7 } } });
check('有僕從時最大 HP 減去 NPC 等級', noMinion.maxHp - withMinion.maxHp, 7);
check('有僕從時最大 MP 減去 NPC 等級', noMinion.maxMp - withMinion.maxMp, 7);
// 官方：「如果你的僕從被摧毀，你的 HP 和 MP 上限會恢復正常」
const destroyed = stats({ necroData: { minion: { active: false, npcLevel: 7 } } });
check('僕從被摧毀後 HP 上限恢復正常', destroyed.maxHp, noMinion.maxHp);
check('僕從被摧毀後 MP 上限恢復正常', destroyed.maxMp, noMinion.maxMp);
// 沒有 active 這個旗標（舊存檔或半填狀態）不該倒扣
check('沒有 active 旗標時不倒扣', stats({ necroData: { minion: { npcLevel: 7 } } }).maxHp, noMinion.maxHp);
check('NPC 等級 0 不會倒扣', stats({ necroData: { minion: { active: true, npcLevel: 0 } } }).maxHp, noMinion.maxHp);

// ─────────────────────────────────────────────────────────── L
section('L. 定制武器進引擎（HF p.106）');

const cwSpec = createCustomWeaponSpec({
  name: '戰車', category: '重型', range: '近戰', accuracy: 'DEX + MIG',
  customizations: ['defenseBoost', 'magicDefenseBoost']
});
const cwChar = mk({
  attributes: ALL_8,
  equipment: { mainHand: '戰車', offHand: '無盾牌', armor: '無裝甲 / 冒險服', accessory: '' },
  customWeapons: [cwSpec]
});
const cwStats = calculateCharacterStats(cwChar);
const plainStats = calculateCharacterStats(mk({ attributes: ALL_8 }));

check('定制武器被引擎認得（主手解析得到條目）', cwStats.mainHandWeapon?.isCustomWeapon, true);
check('【物防提升】+2 進物防', cwStats.def, plainStats.def + 2);
check('【魔防提升】+2 進魔防', cwStats.mdef, plainStats.mdef + 2);
check('逐項分解看得到物防提升',
  cwStats.breakdown.def.terms.some((t) => t.label.includes('物防提升')), true);
check('物防提升的逐項相加等於合計', sumTerms(cwStats.breakdown.def), cwStats.def);
check('【物防提升】回報 countsAsShield（技能判定要用）', cwStats.countsAsShield, true);
check('沒選物防提升就不算盾牌',
  calculateCharacterStats(mk({
    attributes: ALL_8,
    equipment: { mainHand: '戰車', offHand: '無盾牌', armor: '無裝甲 / 冒險服', accessory: '' },
    customWeapons: [createCustomWeaponSpec({ name: '戰車', customizations: ['accurate'] })]
  })).countsAsShield, false);
check('雙手定制武器 → 副手不生效（維持 §U 的規則）',
  calculateCharacterStats(mk({
    attributes: ALL_8,
    equipment: { mainHand: '戰車', offHand: '符文圓盾', armor: '無裝甲 / 冒險服', accessory: '' },
    customWeapons: [cwSpec]
  })).def, cwStats.def);

// 規則沒開就不該存在
check('規則未開放卻帶著定制武器 → 錯誤',
  validateCharacter({ ...cwChar, creationRules: { ...DEFAULT_CREATION_RULES, allowCustomWeapon: false } })
    .errors.some((e) => e.message.includes('未開放【定制武器】')), true);
check('規則開放時沒有這條錯誤',
  validateCharacter({ ...cwChar, creationRules: { ...DEFAULT_CREATION_RULES, allowCustomWeapon: true } })
    .errors.some((e) => e.message.includes('未開放【定制武器】')), false);
check('規格本身不合法（超出名額）→ 錯誤',
  validateCharacter({
    ...cwChar,
    creationRules: { ...DEFAULT_CREATION_RULES, allowCustomWeapon: true },
    customWeapons: [createCustomWeaponSpec({ name: '壞的', customizations: ['quick', 'accurate', 'defenseBoost'] })]
  }).errors.some((e) => e.message.includes('超出名額')), true);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
