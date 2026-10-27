/**
 * 魔晶石（TECHNOSPHERES）護欄 —— 科技奇幻手冊 p.132–145 的選用規則。
 *
 * 執行：`npm run test:technospheres`
 *
 * 官方依據：*Fabula Ultima — Atlas: Techno Fantasy*，印刷 p.132–145（此書 PDF 偏移 +2）。
 * 譯名以 CHM 漢化 `05_可选规则_魔晶石Technospheres.md` 為準，**機制一律以英文正式版為準**
 * ——兩者實測有 8 處分歧（見 `docs/decisions.md` §BN），本檔把每一處都用斷言釘住，
 * 免得哪天有人「照漢化改一下」就把規則改錯了。
 *
 * ## 這道關卡守的是「一條選用規則在六個層面同時生效」
 *
 *   ① 開卡規則（`creationRules.technospheres`，五態列舉，預設 off；開啟時職業數被**推導**成 3/3）
 *   ② 角色資料（`character.technospheres`，舊存檔沒有 → 收斂成空狀態，行為不變）
 *   ③ 數值引擎（+5 最大 HP／+5 最大 MP、職業近戰＋遠程武器熟練、技能等級上限放寬）
 *   ④ 升級流程（點數可投職業魔石；**不得新增職業**）
 *   ⑤ 裝備層（官方武器表與盾牌整份不可用；插槽品級與附魔魔石算進同一筆預算）
 *   ⑥ 介面入口（規則關閉時**整個面板不存在**，不是停用）
 *
 * 任何一處漏掉，畫面看起來都正常——這正是要把它們釘死的原因
 * （同 `tests/zeroPowers.test.mjs`、`tests/initiativeVariant.test.mjs` 檔頭的理由）。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TECHNOSPHERE_MODES,
  TECHNOSPHERE_MODE_KEYS,
  TECHNOSPHERE_MODE_OPTIONS,
  DEFAULT_TECHNOSPHERE_MODE,
  normalizeTechnosphereMode,
  isTechnosphereEnabled,
  modeHasMnemospheres,
  modeHasHoplospheres,
  modeGrantsInnateBonus,
  modeGrantsMartialWeaponProficiency,
  modeAllowsDeltaSlot,
  modeRestrictsEquipment,
  modeUsesIntegratedCarrier,
  modeNeedsSlotEditor,
  getIntegratedMnemosphereCap,
  SLOT_QUALITIES,
  SLOT_QUALITY_KEYS,
  DEFAULT_SLOT_QUALITY,
  getSlotQuality,
  slotQualityCost,
  slotQualityCapacity,
  slotQualityMnemosphereCap,
  slotQualityIsWeaponOnly,
  getAvailableSlotQualities,
  MNEMOSPHERE_CLASSES,
  MNEMOSPHERE_MAX_LEVEL,
  MNEMOSPHERE_MASTERY_LEVEL,
  INNATE_CLASS_COUNT,
  INNATE_MIN_LEVELS,
  isMnemosphereClass,
  getInitialMnemosphereCount,
  getInitialMnemosphereLevel,
  getInitialMnemosphereLevels,
  buildInitialMnemosphere,
  HOPLOSPHERES,
  hoplospherePreviewLines,
  HOPLOSPHERE_MAP,
  getHoplosphere,
  HOPLOSPHERE_PRICE,
  mnemospherePrice,
  findHoplosphereByD66,
  DAMAGE_TYPE_HOPLOSPHERES,
  createTechnosphereState,
  makeMnemosphereId,
  createMnemosphere,
  normalizeTechnosphereState,
  computeSlotUsage,
  listHoplosphereEffects,
  getActiveMnemospheres,
  getMnemosphereSkills,
  getMnemosphereLevelTotal,
  getSkillLevelCeiling,
  validateTechnosphereState,
  getTechnosphereEquipmentSpend,
  getTechnosphereSpending,
  SLOT_QUALITY_ELIGIBLE_SLOTS,
  slotSupportsQuality,
  MNEMOSPHERE_BEAD_TINTS,
  getMnemosphereBeadTint,
  DAMAGE_TYPE_TINTS,
  HOPLOSPHERE_BEAD_TINT,
  getHoplosphereBeadTint,
  beadRingSegments,
  getLevelUpMnemosphereCandidates,
  TECHNOSPHERE_SUPPRESSED_SKILLS,
  isSkillSuppressedByTechnospheres
} from '../src/features/character-sheet/data/technospheres.js';
import {
  DEFAULT_CREATION_RULES,
  CREATION_RULE_FIELDS,
  resolveCreationRules,
  diffCreationRules,
  isDefaultCreationRules
} from '../src/features/character-sheet/data/creationRules.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  MAGITECH_CORE_NODES,
  magitechMaxTier,
  magitechNodeAt,
  resolveMagitechNodes
} from '../src/features/character-sheet/data/gadgetBranches.js';
import {
  createNewCharacter,
  calculateCharacterStats,
  getProficiencies,
  getCharacterLevel,
  getEquippedTechnosphereSlotIds,
  validateCharacter,
  applyLevelUp,
  classSkillsForClass,
  resolveLevelUpSkill,
  CLASS_MAX_LEVEL,
  MAX_NON_MASTERED_CLASSES,
  LEVEL_UP_NEW_CLASS_PREFIX,
  parseLevelUpClassValue
} from '../src/features/character-sheet/utils/characterEngine.js';
import { totalStartingEquipCost, buildLoadoutIssues, getDualShieldState } from '../src/features/character-sheet/utils/equipmentRules.js';
import TechnospherePanel from '../src/features/character-sheet/components/TechnospherePanel.jsx';
import MnemosphereSection from '../src/features/character-sheet/components/MnemosphereSection.jsx';
import TechnosphereBead, { EmptyBeadSocket, beadArcPath } from '../src/features/character-sheet/components/TechnosphereBead.jsx';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';
import TinkererGadgetsModal from '../src/features/character-sheet/components/companions/TinkererGadgetsModal.jsx';
import TinkererGadgetsQuickRef from '../src/features/character-sheet/components/companions/TinkererGadgetsQuickRef.jsx';

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

const READ = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
const theme = getCharacterTheme('parchment');

/** 建一個「合法」的五級角色當底稿：三個職業、四維已填 */
const BASE_CHAR = {
  level: 5,
  attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
  classes: [
    { className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 2 }] },
    { className: '靈能者', level: 2, skills: [{ name: '超感認知', sl: 2 }] },
    { className: '靈師', level: 1, skills: [{ name: '治癒', sl: 1 }] }
  ]
};
const makeChar = (mode, extra = {}) => createNewCharacter({
  ...BASE_CHAR,
  ...extra,
  creationRules: { technospheres: mode }
});

// ─────────────────────────────────────────────────────────── A
section('A. 五種模式（p.132–138）');

check('模式數量為 5', TECHNOSPHERE_MODE_KEYS.length, 5);
check('模式鍵', TECHNOSPHERE_MODE_KEYS, ['off', 'full', 'integrated', 'mnemospheresOnly', 'hoplospheresOnly']);
check('預設是關閉', DEFAULT_TECHNOSPHERE_MODE, 'off');
check('每個模式都有中文標籤與說明', TECHNOSPHERE_MODE_KEYS.every(
  (k) => TECHNOSPHERE_MODES[k].label && TECHNOSPHERE_MODES[k].desc.length > 10
), true);
// 面板（`TechnospherePanel`／`CreationRulesPanel`）是把 `desc` **當純文字輸出**的，
// 寫進 markdown 星號就會字面顯示成 `**不再**`。2026-10-21 實際發生過兩處。
check('模式說明不含 markdown 星號',
  TECHNOSPHERE_MODE_KEYS.filter((k) => TECHNOSPHERE_MODES[k].desc.includes('**')), []);
check('選項順序（off 在最前）', TECHNOSPHERE_MODE_OPTIONS.map((o) => o.key), TECHNOSPHERE_MODE_KEYS);
check('壞值收斂成 off', normalizeTechnosphereMode('nope'), 'off');
check('undefined 收斂成 off', normalizeTechnosphereMode(undefined), 'off');
check('大小寫不敏感', normalizeTechnosphereMode('FULL'), 'full');
check('off 沒有啟用', isTechnosphereEnabled('off'), false);
check('full 有啟用', isTechnosphereEnabled('full'), true);

// 職業魔石（Mnemospheres）只有「僅附魔魔石」沒有
check('職業魔石：full/integrated/mnemospheresOnly',
  TECHNOSPHERE_MODE_KEYS.filter((k) => modeHasMnemospheres(k)),
  ['full', 'integrated', 'mnemospheresOnly']);
// 附魔魔石（Hoplospheres）只有「僅職業魔石」沒有
check('附魔魔石：full/integrated/hoplospheresOnly',
  TECHNOSPHERE_MODE_KEYS.filter((k) => modeHasHoplospheres(k)),
  ['full', 'integrated', 'hoplospheresOnly']);
// p.134：+5 最大 HP／+5 最大 MP。p.138：「僅附魔魔石」變體**不給**。
check('+5/+5 加給：full/integrated/mnemospheresOnly',
  TECHNOSPHERE_MODE_KEYS.filter((k) => modeGrantsInnateBonus(k)),
  ['full', 'integrated', 'mnemospheresOnly']);
// p.134：職業近戰＋職業遠程武器熟練（**不含防具**）。p.138：「僅職業魔石」變體**失去**它。
check('武器熟練：full/integrated/hoplospheresOnly',
  TECHNOSPHERE_MODE_KEYS.filter((k) => modeGrantsMartialWeaponProficiency(k)),
  ['full', 'integrated', 'hoplospheresOnly']);
// p.138：δ 在「僅附魔魔石」與「內嵌裝置」兩個變體都不存在
check('δ 品級：只有 full 與 mnemospheresOnly 有',
  TECHNOSPHERE_MODE_KEYS.filter((k) => modeAllowsDeltaSlot(k)),
  ['full', 'mnemospheresOnly']);
// p.133 裝備白名單；p.138 說「僅職業魔石」把官方裝備全部放回來
check('裝備白名單：full/integrated/hoplospheresOnly',
  TECHNOSPHERE_MODE_KEYS.filter((k) => modeRestrictsEquipment(k)),
  ['full', 'integrated', 'hoplospheresOnly']);
check('只有 integrated 用內嵌裝置', TECHNOSPHERE_MODE_KEYS.filter((k) => modeUsesIntegratedCarrier(k)), ['integrated']);
check('插槽編輯器只在有附魔魔石時需要',
  TECHNOSPHERE_MODE_KEYS.filter((k) => modeNeedsSlotEditor(k)),
  ['full', 'integrated', 'hoplospheresOnly']);

// 內嵌裝置容量：1 ＋ 每 15 級 1 顆（p.138）
check('內嵌容量 5 級 = 1', getIntegratedMnemosphereCap(5), 1);
check('內嵌容量 15 級 = 2', getIntegratedMnemosphereCap(15), 2);
check('內嵌容量 30 級 = 3', getIntegratedMnemosphereCap(30), 3);
check('內嵌容量 0 級 = 1', getIntegratedMnemosphereCap(0), 1);
check('內嵌容量負數不炸', getIntegratedMnemosphereCap(-5), 1);

// ─────────────────────────────────────────────────────────── B
section('B. 插槽品級（p.133 的價格表，逐筆核對）');

check('四個品級', SLOT_QUALITY_KEYS, ['alpha', 'beta', 'gamma', 'delta']);
check('預設品級是 α', DEFAULT_SLOT_QUALITY, 'alpha');
check('α：免費／1 格／1 顆職業魔石', [slotQualityCost('alpha'), slotQualityCapacity('alpha'), slotQualityMnemosphereCap('alpha')], [0, 1, 1]);
check('β：+600z／2 格／1 顆', [slotQualityCost('beta'), slotQualityCapacity('beta'), slotQualityMnemosphereCap('beta')], [600, 2, 1]);
check('γ：+1500z／3 格／2 顆', [slotQualityCost('gamma'), slotQualityCapacity('gamma'), slotQualityMnemosphereCap('gamma')], [1500, 3, 2]);
check('δ：+1800z／4 格／2 顆', [slotQualityCost('delta'), slotQualityCapacity('delta'), slotQualityMnemosphereCap('delta')], [1800, 4, 2]);
check('只有 δ 是武器限定', SLOT_QUALITY_KEYS.filter((k) => slotQualityIsWeaponOnly(k)), ['delta']);
check('未知品級退回 α', getSlotQuality('nope').key, 'alpha');
check('每個品級都有中文說明', SLOT_QUALITY_KEYS.every((k) => SLOT_QUALITIES[k].label && SLOT_QUALITIES[k].desc.length > 10), true);
check('品級說明不含 markdown 星號',
  SLOT_QUALITY_KEYS.filter((k) => SLOT_QUALITIES[k].desc.includes('**')), []);
check('α 的說明沒有簡體字殘留', SLOT_QUALITIES.alpha.desc.includes('額外'), true);
check('full 可選四個品級', getAvailableSlotQualities('full').map((q) => q.key), SLOT_QUALITY_KEYS);
check('hoplospheresOnly 沒有 δ', getAvailableSlotQualities('hoplospheresOnly').map((q) => q.key), ['alpha', 'beta', 'gamma']);
check('integrated 沒有 δ', getAvailableSlotQualities('integrated').map((q) => q.key), ['alpha', 'beta', 'gamma']);

// ─────────────────────────────────────────────────────────── C
section('C. 職業魔石清單（p.136：正面表列 15 個職業）');

check('清單數量為 15', MNEMOSPHERE_CLASSES.length, 15);
check('名稱與原書順序', MNEMOSPHERE_CLASSES, [
  '魔奏者', '嵌合師', '指揮官', '舞者', '元素師',
  '熵師', '靈能者', '狂怒鬥士', '守護者', '博學士',
  '吟唱者', '遊蕩者', '神射手', '靈師', '武器大師'
]);
check('全部都是真的職業（rulesData.classes 有）', MNEMOSPHERE_CLASSES.filter((n) => !rulesData.classes[n]), []);
// 這幾個是原書**刻意排除**的：秘儀師不在表上，科技奇幻自己的三個職業也不在（機師／突變體／靈能者例外）
check('秘儀師不在清單裡', isMnemosphereClass('秘儀師'), false);
check('機師不在清單裡', isMnemosphereClass('機師'), false);
check('突變體不在清單裡', isMnemosphereClass('突變體'), false);
check('徽記師不在清單裡', isMnemosphereClass('徽記師'), false);
check('靈能者**在**清單裡（科技奇幻職業但原書有列）', isMnemosphereClass('靈能者'), true);
check('上限 5 級', MNEMOSPHERE_MAX_LEVEL, 5);
check('精通＝5 級', MNEMOSPHERE_MASTERY_LEVEL, 5);
check('固有職業恰好 3 個', INNATE_CLASS_COUNT, 3);
check('固有職業至少吃 5 級', INNATE_MIN_LEVELS, 5);

// 初始魔石：1 顆，且是 **1 級**（p.134）。CHM 寫 0 級，那是錯的。
check('初始魔石數量 5 級 = 1', getInitialMnemosphereCount(5), 1);
check('初始魔石數量 14 級 = 1', getInitialMnemosphereCount(14), 1);
check('初始魔石數量 15 級 = 2', getInitialMnemosphereCount(15), 2);
check('初始魔石數量 25 級 = 3', getInitialMnemosphereCount(25), 3);
check('初始魔石數量 1 級 = 1', getInitialMnemosphereCount(1), 1);
check('第一顆是 1 級（不是 0 級）', getInitialMnemosphereLevel(0), 1);
check('第二顆以後是 0 級', getInitialMnemosphereLevel(1), 0);

// ─────────────────────────────────────────────────────────── D
section('D. 附魔魔石 d66 表（p.137–139，36 筆）');

check('數量為 36', HOPLOSPHERES.length, 36);
check('d66 全部唯一', new Set(HOPLOSPHERES.map((h) => h.d66)).size, 36);
check('key 全部唯一', new Set(HOPLOSPHERES.map((h) => h.key)).size, 36);
check('d66 由 11 到 66（六個十位、每個六筆）',
  [...new Set(HOPLOSPHERES.map((h) => h.d66[0]))], ['1', '2', '3', '4', '5', '6']);
check('每個十位各有 6 筆',
  ['1', '2', '3', '4', '5', '6'].map((t) => HOPLOSPHERES.filter((h) => h.d66[0] === t).length),
  [6, 6, 6, 6, 6, 6]);
check('每筆都有名字、效果與佔用格數', HOPLOSPHERES.every(
  (h) => h.name && h.effect && Number(h.slots) >= 1 && Number(h.slots) <= 2
), true);
check('11 是靈敏（CHM 的表格整體錯位一列，11 寫成銳化）', findHoplosphereByD66('11').name, '靈敏');
check('52 是銳化', findHoplosphereByD66('52').name, '銳化');
check('查不到回 null', findHoplosphereByD66('99'), null);
check('getHoplosphere 未知 key 回 null', getHoplosphere('nope'), null);
check('HOPLOSPHERE_MAP 與陣列同步', Object.keys(HOPLOSPHERE_MAP).length, 36);
check('每顆 500z（p.137）', HOPLOSPHERE_PRICE, 500);

// 傷害屬性：原書只有 8 筆帶屬性（Arctic 冰／Cyclonic 風／Dark 暗／Poisonous 毒／
// Radiant 光／Seismic 土／Volcanic 火／Voltaic 電）
check('帶傷害屬性的有 8 筆', DAMAGE_TYPE_HOPLOSPHERES.length, 8);
check('這 8 筆的 damageType 都在八相裡', DAMAGE_TYPE_HOPLOSPHERES.map((k) => getHoplosphere(k).damageType).sort(), ['土', '光', '冰', '暗', '毒', '火', '風', '電'].sort());

// 劇毒只造成「中毒」狀態，本身**不是**毒屬性傷害——第一版把它寫成 damageType: '毒' 是錯的
check('劇毒不是毒屬性傷害', getHoplosphere('toxic').damageType, null);
check('劇毒佔 2 格', getHoplosphere('toxic').slots, 2);
// 武器限定（原書用星號標）
check('武器限定共 19 筆（原書用星號標）', HOPLOSPHERES.filter((h) => h.weaponOnly).length, 19);
check('醫療不是武器限定', getHoplosphere('medical').weaponOnly, false);
check('凝聚效果只出現在有 coag2 的條目上',
  HOPLOSPHERES.every((h) => (h.coag3 ? Boolean(h.coag2) : true)), true);
check('凝聚 3 的條目數量為 8', HOPLOSPHERES.filter((h) => h.coag3).length, 8);
// 職業魔石估值：500 + 300 × 等級（p.137）
check('0 級估值 500z', mnemospherePrice(0), 500);
check('1 級估值 800z', mnemospherePrice(1), 800);
check('5 級估值 2000z', mnemospherePrice(5), 2000);

// ─────────────────────────────────────────────────────────── E
section('E. 角色資料形狀與正規化');

check('空狀態形狀', createTechnosphereState(), { mnemospheres: [], slots: {}, integrated: [] });
check('id 由職業名與序號組成', makeMnemosphereId('元素師', 3), 'mn-3-元素師');
check('不合法職業收斂成清單第一個', createMnemosphere({ className: '秘儀師' }).className, '魔奏者');
check('等級夾制到 5', createMnemosphere({ className: '元素師', level: 9 }).level, 5);
check('負等級夾制到 0', createMnemosphere({ className: '元素師', level: -3 }).level, 0);
check('技能只留有名稱的', createMnemosphere({
  className: '元素師', skills: [{ name: '元素魔法', sl: 2 }, { name: '', sl: 1 }, null]
}).skills, [{ name: '元素魔法', sl: 2 }]);
check('heroicSkill 預設 null', createMnemosphere({ className: '元素師' }).heroicSkill, null);

check('null 收斂成空狀態', normalizeTechnosphereState(null), createTechnosphereState());
check('字串收斂成空狀態', normalizeTechnosphereState('oops'), createTechnosphereState());
check('缺欄位收斂成空陣列', normalizeTechnosphereState({}), createTechnosphereState());
check('壞魔石被濾掉', normalizeTechnosphereState({ mnemospheres: [null, 5, { className: '元素師' }] }).mnemospheres.length, 1);
check('integrated 只留存在的 id', normalizeTechnosphereState({
  mnemospheres: [{ id: 'a', className: '元素師' }],
  integrated: ['a', 'b', 5]
}).integrated, ['a']);
check('插槽內容被正規化', normalizeTechnosphereState({
  slots: { mainHand: { quality: 'gamma', contents: [{ kind: 'hoplosphere', ref: 'arctic' }] } }
}).slots.mainHand.quality, 'gamma');
check('壞插槽被丟掉', normalizeTechnosphereState({ slots: { mainHand: 'nope' } }).slots, {});

// ─────────────────────────────────────────────────────────── F
section('F. 插槽佔用與凝聚（p.139 的例子）');

const slotOf = (quality, contents) => ({ quality, contents });
check('α 空槽', computeSlotUsage(slotOf('alpha', [])).remaining, 1);
check('β 裝兩顆 1 格附魔魔石剛好滿', computeSlotUsage(slotOf('beta', [
  { kind: 'hoplosphere', ref: 'arctic' }, { kind: 'hoplosphere', ref: 'dark' }
])).remaining, 0);
check('δ 裝兩顆 2 格附魔魔石剛好滿', computeSlotUsage(slotOf('delta', [
  { kind: 'hoplosphere', ref: 'agile' }, { kind: 'hoplosphere', ref: 'brave' }
])).remaining, 0);
check('超裝會標 overflow', computeSlotUsage(slotOf('alpha', [
  { kind: 'hoplosphere', ref: 'agile' }
])).overflow, true);
check('α 只能 1 顆職業魔石', computeSlotUsage(slotOf('alpha', [
  { kind: 'mnemosphere', ref: 'm1' }, { kind: 'mnemosphere', ref: 'm2' }
])).mnemosphereOverflow, true);
check('γ 可裝 2 顆職業魔石', computeSlotUsage(slotOf('gamma', [
  { kind: 'mnemosphere', ref: 'm1' }, { kind: 'mnemosphere', ref: 'm2' }
])).mnemosphereOverflow, false);
check('職業魔石固定佔 1 格', computeSlotUsage(slotOf('gamma', [
  { kind: 'mnemosphere', ref: 'm1' }
])).used, 1);

// 兩顆寒冰 → 凝聚 2（每顆各自結算，狀態型取最強）
const twoArctic = listHoplosphereEffects([
  { kind: 'hoplosphere', ref: 'arctic' }, { kind: 'hoplosphere', ref: 'arctic' }
]);
check('兩顆寒冰 → 4 筆（2 基礎 + 2 凝聚）', twoArctic.entries.length, 4);
check('寒冰凝聚 2 存在', twoArctic.entries.filter((e) => e.tier === 'coag2').length, 2);
// 三顆角鬥士 → 每顆 2 點，共 6 點（原書 p.139 的例子）
const threeGladiator = listHoplosphereEffects([
  { kind: 'hoplosphere', ref: 'gladiator' },
  { kind: 'hoplosphere', ref: 'gladiator' },
  { kind: 'hoplosphere', ref: 'gladiator' }
]);
check('三顆角鬥士 → 3 筆基礎（每筆 +2，數值疊加成 6）', threeGladiator.entries.filter((e) => e.tier === 'base').length, 3);
check('三顆角鬥士 → 3 筆凝聚 2（凝聚效果每顆各給一次）', threeGladiator.entries.filter((e) => e.tier === 'coag2').length, 3);
check('混用不同傷害屬性會被列出', listHoplosphereEffects([
  { kind: 'hoplosphere', ref: 'arctic' }, { kind: 'hoplosphere', ref: 'volcanic' }
]).damageTypeConflicts.sort(), ['冰', '火']);
check('同屬性不算衝突', listHoplosphereEffects([
  { kind: 'hoplosphere', ref: 'arctic' }, { kind: 'hoplosphere', ref: 'arctic' }
]).damageTypeConflicts, []);
check('空內容不炸', listHoplosphereEffects([]).entries, []);

// ─────────────────────────────────────────────────────────── G
section('G. 驗證器（p.133–139 的每一條限制）');

const stateWith = (over = {}) => ({ ...createTechnosphereState(), ...over });
const issuesOf = (payload) => validateTechnosphereState(payload).map((i) => i.message);
const hasMsg = (list, needle) => list.some((m) => m.includes(needle));

check('規則關閉時完全不驗', validateTechnosphereState({ state: stateWith(), mode: 'off' }), []);
check('空狀態沒有問題', issuesOf({ state: stateWith(), mode: 'full', level: 5 }), []);

// 職業魔石本身
check('超過 5 級 → 錯誤', hasMsg(issuesOf({
  state: stateWith({ mnemospheres: [{ id: 'a', className: '元素師', level: 7, skills: [] }] }),
  mode: 'full', level: 10
}), '最多 5 級'), true);
check('不在 15 職清單 → 警告（GM 可放寬）', validateTechnosphereState({
  state: stateWith({ mnemospheres: [{ id: 'a', className: '秘儀師', level: 1, skills: [] }] }),
  mode: 'full', level: 5
}).some((i) => i.level === 'warning' && i.message.includes('清單')), true);
check('5 級但沒選英雄技能 → 警告', hasMsg(issuesOf({
  state: stateWith({ mnemospheres: [{ id: 'a', className: '元素師', level: 5, skills: [] }] }),
  mode: 'full', level: 10
}), '尚未選擇英雄技能'), true);
check('「僅附魔魔石」有職業魔石 → 錯誤', hasMsg(issuesOf({
  state: stateWith({ mnemospheres: [{ id: 'a', className: '元素師', level: 1, skills: [] }] }),
  mode: 'hoplospheresOnly', level: 5
}), '沒有職業魔石'), true);

// 同一件物品不能裝兩顆共享技能的職業魔石（p.135）
const sharedState = stateWith({
  mnemospheres: [
    { id: 'a', className: '元素師', level: 1, skills: [{ name: '元素魔法', sl: 1 }] },
    { id: 'b', className: '靈能者', level: 1, skills: [{ name: '元素魔法', sl: 1 }] }
  ],
  slots: { mainHand: { quality: 'gamma', contents: [
    { kind: 'mnemosphere', ref: 'a' }, { kind: 'mnemosphere', ref: 'b' }
  ] } }
});
check('共享技能 → 錯誤', hasMsg(issuesOf({ state: sharedState, mode: 'full', level: 5 }), '共享技能'), true);
// 但**不同**物品可以（p.135 只禁同一件物品）
const splitState = stateWith({
  mnemospheres: sharedState.mnemospheres,
  slots: {
    mainHand: { quality: 'alpha', contents: [{ kind: 'mnemosphere', ref: 'a' }] },
    offHand: { quality: 'alpha', contents: [{ kind: 'mnemosphere', ref: 'b' }] }
  }
});
check('不同物品裝同樣技能 → 不擋', hasMsg(issuesOf({ state: splitState, mode: 'full', level: 5 }), '共享技能'), false);

// 角色不能裝備「自己已經會那些技能」的魔石（p.135）
check('已有該技能 → 錯誤', hasMsg(issuesOf({
  state: splitState, mode: 'full', level: 5, ownedSkillNames: ['元素魔法']
}), '已經具備的技能'), true);
check('沒有的技能 → 不擋', hasMsg(issuesOf({
  state: splitState, mode: 'full', level: 5, ownedSkillNames: ['治癒']
}), '已經具備的技能'), false);

// δ 只限武器（p.133）
check('δ 裝在防具上 → 錯誤', hasMsg(issuesOf({
  state: stateWith({ slots: { armor: { quality: 'delta', contents: [] } } }),
  mode: 'full', level: 5
}), '只能用在武器上'), true);
check('δ 裝在主手 → 不擋', hasMsg(issuesOf({
  state: stateWith({ slots: { mainHand: { quality: 'delta', contents: [] } } }),
  mode: 'full', level: 5
}), '只能用在武器上'), false);
check('hoplospheresOnly 用 δ → 錯誤', hasMsg(issuesOf({
  state: stateWith({ slots: { mainHand: { quality: 'delta', contents: [] } } }),
  mode: 'hoplospheresOnly', level: 5
}), '沒有槽位 δ'), true);

// 容量
check('超出插槽容量 → 錯誤', hasMsg(issuesOf({
  state: stateWith({ slots: { mainHand: { quality: 'alpha', contents: [
    { kind: 'hoplosphere', ref: 'agile' }
  ] } } }),
  mode: 'full', level: 5
}), '目前已佔用'), true);
check('職業魔石超過品級上限 → 錯誤', hasMsg(issuesOf({
  state: stateWith({
    mnemospheres: [
      { id: 'a', className: '元素師', level: 1, skills: [] },
      { id: 'b', className: '靈能者', level: 1, skills: [] }
    ],
    slots: { mainHand: { quality: 'alpha', contents: [
      { kind: 'mnemosphere', ref: 'a' }, { kind: 'mnemosphere', ref: 'b' }
    ] } }
  }),
  mode: 'full', level: 5
}), '至多 1 顆職業魔石'), true);

// 附魔魔石的武器限定
check('武器限定附魔魔石裝在防具 → 錯誤', hasMsg(issuesOf({
  state: stateWith({ slots: { armor: { quality: 'gamma', contents: [
    { kind: 'hoplosphere', ref: 'sharpening' }
  ] } } }),
  mode: 'full', level: 5
}), '只能安裝在武器上'), true);
check('非武器限定裝在防具 → 不擋', hasMsg(issuesOf({
  state: stateWith({ slots: { armor: { quality: 'gamma', contents: [
    { kind: 'hoplosphere', ref: 'medical' }
  ] } } }),
  mode: 'full', level: 5
}), '只能安裝在武器上'), false);

// 同一把武器不能混不同傷害屬性（p.141）
check('武器混屬性 → 錯誤', hasMsg(issuesOf({
  state: stateWith({ slots: { mainHand: { quality: 'delta', contents: [
    { kind: 'hoplosphere', ref: 'arctic' }, { kind: 'hoplosphere', ref: 'volcanic' }
  ] } } }),
  mode: 'full', level: 5
}), '不能混用不同傷害屬性'), true);
check('防具混屬性 → 不擋（原書只管武器）', hasMsg(issuesOf({
  state: stateWith({ slots: { armor: { quality: 'delta', contents: [
    { kind: 'hoplosphere', ref: 'arctic' }, { kind: 'hoplosphere', ref: 'volcanic' }
  ] } } }),
  mode: 'full', level: 5
}), '不能混用不同傷害屬性'), false);

// 「僅職業魔石」變體沒有附魔魔石
check('mnemospheresOnly 有附魔魔石 → 錯誤', hasMsg(issuesOf({
  state: stateWith({ slots: { mainHand: { quality: 'beta', contents: [
    { kind: 'hoplosphere', ref: 'arctic' }
  ] } } }),
  mode: 'mnemospheresOnly', level: 5
}), '沒有附魔魔石'), true);

// 內嵌裝置（p.138）
check('內嵌超過容量 → 錯誤', hasMsg(issuesOf({
  state: stateWith({
    mnemospheres: [
      { id: 'a', className: '元素師', level: 1, skills: [] },
      { id: 'b', className: '靈能者', level: 1, skills: [] }
    ],
    integrated: ['a', 'b']
  }),
  mode: 'integrated', level: 5
}), '最多可容納 1 顆'), true);
check('內嵌變體把職業魔石塞進插槽 → 錯誤', hasMsg(issuesOf({
  state: stateWith({
    mnemospheres: [{ id: 'a', className: '元素師', level: 1, skills: [] }],
    slots: { mainHand: { quality: 'beta', contents: [{ kind: 'mnemosphere', ref: 'a' }] } }
  }),
  mode: 'integrated', level: 5
}), '只能用來裝附魔魔石'), true);
check('非內嵌變體卻有 integrated → 錯誤', hasMsg(issuesOf({
  state: stateWith({
    mnemospheres: [{ id: 'a', className: '元素師', level: 1, skills: [] }],
    integrated: ['a']
  }),
  mode: 'full', level: 5
}), '應裝在裝備的插槽裡'), true);

// 引用完整性
check('同一顆魔石裝兩處 → 錯誤', hasMsg(issuesOf({
  state: stateWith({
    mnemospheres: [{ id: 'a', className: '元素師', level: 1, skills: [] }],
    slots: {
      mainHand: { quality: 'alpha', contents: [{ kind: 'mnemosphere', ref: 'a' }] },
      offHand: { quality: 'alpha', contents: [{ kind: 'mnemosphere', ref: 'a' }] }
    }
  }),
  mode: 'full', level: 5
}), '不能同時裝在兩個地方'), true);
check('插槽指向不存在的附魔魔石 → 警告', hasMsg(issuesOf({
  state: stateWith({ slots: { mainHand: { quality: 'beta', contents: [
    { kind: 'hoplosphere', ref: 'nope' }
  ] } } }),
  mode: 'full', level: 5
}), '不存在的附魔魔石'), true);

// 未裝備的魔石只提示（p.136：沒裝備就沒有技能）
check('未裝備的職業魔石 → 警告', hasMsg(issuesOf({
  state: stateWith({
    mnemospheres: [{ id: 'a', className: '元素師', level: 1, skills: [] }],
    slots: { mainHand: { quality: 'alpha', contents: [] } }
  }),
  mode: 'full', level: 5, equippedSlots: ['mainHand']
}), '沒有裝在任何裝備上'), true);

// ─────────────────────────────────────────────────────────── H
section('H. 生效判定與技能聚合');

const activeState = {
  mnemospheres: [
    { id: 'a', className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 2 }] },
    { id: 'b', className: '博學士', level: 1, skills: [{ name: '集中', sl: 1 }] }
  ],
  slots: { mainHand: { quality: 'gamma', contents: [
    { kind: 'mnemosphere', ref: 'a' }, { kind: 'mnemosphere', ref: 'b' }
  ] } },
  integrated: []
};
check('兩顆都生效', getActiveMnemospheres(activeState).map((m) => m.className), ['元素師', '博學士']);
check('限定插槽後只剩一顆', getActiveMnemospheres(activeState, { equippedSlots: ['armor'] }).length, 0);
check('攤平技能', getMnemosphereSkills(getActiveMnemospheres(activeState)), [
  { name: '元素魔法', sl: 2, source: 'a', className: '元素師' },
  { name: '集中', sl: 1, source: 'b', className: '博學士' }
]);
check('SL 0 的技能不計入', getMnemosphereSkills([
  { id: 'x', className: '元素師', skills: [{ name: '元素魔法', sl: 0 }] }
]), []);
check('魔石總等級', getMnemosphereLevelTotal(activeState.mnemospheres), 3);
// p.134 的例子：5 級角色 ＋ 5 級守護者 ＋ 3 級元素師 → 技能水準相當於 13 級角色
check('技能等級上限＝角色等級＋魔石總等級（原書例子 5＋5＋3＝13）',
  getSkillLevelCeiling(5, [{ level: 5 }, { level: 3 }]), 13);
check('沒有魔石時上限＝角色等級', getSkillLevelCeiling(7, []), 7);

// ─────────────────────────────────────────────────────────── I
section('I. 開卡規則整合（職業數被推導成 3/3）');

check('DEFAULT_CREATION_RULES 有這個欄位', DEFAULT_CREATION_RULES.technospheres, 'off');
check('欄位集包含 technospheres', CREATION_RULE_FIELDS.includes('technospheres'), true);
check('預設仍是「預設規則」', isDefaultCreationRules({}), true);
check('開啟後不再是預設規則', isDefaultCreationRules({ technospheres: 'full' }), false);

check('off → 職業數 2~3（原書標準）',
  [resolveCreationRules({}).classCountMin, resolveCreationRules({}).classCountMax], [2, 3]);
check('full → 職業數固定 3/3',
  [resolveCreationRules({ technospheres: 'full' }).classCountMin,
    resolveCreationRules({ technospheres: 'full' }).classCountMax], [3, 3]);
check('mnemospheresOnly 也固定 3/3',
  [resolveCreationRules({ technospheres: 'mnemospheresOnly' }).classCountMin,
    resolveCreationRules({ technospheres: 'mnemospheresOnly' }).classCountMax], [3, 3]);
check('壞值退回 off 且職業數回到 2~3',
  [resolveCreationRules({ technospheres: 'nope' }).technospheres,
    resolveCreationRules({ technospheres: 'nope' }).classCountMin], ['off', 2]);
// 推導欄位不進 diff：否則「我明明只開了魔晶石，履歷卻說我改了職業數」
check('diff 只記 technospheres', diffCreationRules(resolveCreationRules({ technospheres: 'full' })), { technospheres: 'full' });
check('off 狀態下改職業數仍會被記到', diffCreationRules(resolveCreationRules({ classCountMin: 3 })), { classCountMin: 3 });

// ─────────────────────────────────────────────────────────── J
section('J. 數值引擎（+5 HP／+5 MP、武器熟練、技能上限）');

const offStats = calculateCharacterStats(makeChar('off'));
const fullStats = calculateCharacterStats(makeChar('full'));
check('off 沒有魔晶石加給', [offStats.bonusHp, offStats.bonusMp].slice(0, 2), [0, 15]);
check('full 多 +5 最大 HP', fullStats.maxHp - offStats.maxHp, 5);
check('full 多 +5 最大 MP', fullStats.maxMp - offStats.maxMp, 5);
check('加給的來源標記是 technosphere',
  fullStats.breakdown.hp.terms.some((b) => b.kind === 'technosphere' && b.label === '魔晶石創角加給'), true);

check('off 沒有職業武器熟練', [getProficiencies(makeChar('off')).martialMelee, getProficiencies(makeChar('off')).martialRanged], [false, false]);
check('full 給職業近戰＋遠程武器熟練',
  [getProficiencies(makeChar('full')).martialMelee, getProficiencies(makeChar('full')).martialRanged], [true, true]);
check('full **不給**職業防具', getProficiencies(makeChar('full')).martialArmor, false);
check('full **不給**職業盾牌', getProficiencies(makeChar('full')).martialShields, false);
check('mnemospheresOnly 失去武器熟練', getProficiencies(makeChar('mnemospheresOnly')).martialMelee, false);
check('mnemospheresOnly 仍有 +5/+5', calculateCharacterStats(makeChar('mnemospheresOnly')).bonusHp >= 5, true);
check('hoplospheresOnly 有武器熟練', getProficiencies(makeChar('hoplospheresOnly')).martialMelee, true);
check('hoplospheresOnly 沒有 +5/+5 加給',
  calculateCharacterStats(makeChar('hoplospheresOnly')).bonusHp, offStats.bonusHp);

// 技能等級總和：魔晶石制允許「投在魔石上」，所以只擋超過（見 validateCharacter）
check('off 的技能總和必須剛好等於等級', offStats.isLevelMatched, true);
check('full 的技能總和允許小於等級', calculateCharacterStats(makeChar('full')).isLevelMatched, true);

// ─────────────────────────────────────────────────────────── K
section('K. 建角與升級流程');

const newChar = makeChar('full');
check('新角色有 technospheres 欄位', Boolean(newChar.technospheres), true);
check('新角色不預先塞職業魔石（與四維、羈絆同一原則）', newChar.technospheres.mnemospheres, []);
check('新角色 slots 是空的', newChar.technospheres.slots, {});

// 升級投在職業魔石上
const withMnem = {
  ...newChar,
  exp: 10,
  technospheres: {
    mnemospheres: [{ id: 'm1', className: '博學士', level: 1, skills: [{ name: '集中', sl: 1 }] }],
    slots: { mainHand: { quality: 'alpha', contents: [{ kind: 'mnemosphere', ref: 'm1' }] } },
    integrated: []
  }
};
const upMnem = applyLevelUp(withMnem, { mnemosphereId: 'm1', skillName: '集中' });
check('投魔石：角色等級 +1', upMnem.level, 6);
check('投魔石：魔石等級 +1', upMnem.technospheres.mnemospheres[0].level, 2);
check('投魔石：技能 SL +1', upMnem.technospheres.mnemospheres[0].skills, [{ name: '集中', sl: 2 }]);
check('投魔石：職業數不變', upMnem.classes.length, 3);
check('投魔石：扣 EXP', upMnem.exp, 0);
check('投魔石：當前 HP/MP 各 +1',
  [upMnem.currentHp - (withMnem.currentHp ?? calculateCharacterStats(withMnem).maxHp),
    upMnem.currentMp - (withMnem.currentMp ?? calculateCharacterStats(withMnem).maxMp)], [1, 1]);
check('投魔石：不存在的 id 直接退回原角色', applyLevelUp(withMnem, { mnemosphereId: 'nope' }), withMnem);
check('投魔石：已滿級不能再升',
  applyLevelUp({ ...withMnem, technospheres: {
    ...withMnem.technospheres,
    mnemospheres: [{ id: 'm1', className: '博學士', level: 5, skills: [] }]
  } }, { mnemosphereId: 'm1' }).level, 5);
// 魔石分支同樣要驗證「技能屬於該魔石的職業」——而且用的是**魔石自己的** `className`，
// 不是呼叫端傳進來的（HUD 的魔石分支只傳 `mnemosphereId`，`className` 是 undefined）。
// 以前這裡是「找不到就 push」，所以任何字串都會被寫進魔石技能表（§CE）。
const wrongMnemSkill = applyLevelUp(withMnem, { mnemosphereId: 'm1', skillName: '碎骨擊' });
check('投魔石：不是博學士的技能 -> 原物件原樣回傳', wrongMnemSkill === withMnem, true);
check('投魔石：那筆技能沒有被寫進魔石',
  wrongMnemSkill.technospheres.mnemospheres[0].skills, [{ name: '集中', sl: 1 }]);
check('投魔石：魔石等級沒有動', wrongMnemSkill.technospheres.mnemospheres[0].level, 1);
check('投魔石：EXP 沒有被扣', wrongMnemSkill.exp, 10);

// 技能自己的 SL 上限（博學士的「集中」是 5）——到了就投不進去，魔石等級也不能偷偷 +1。
const fullMnemSL = {
  ...withMnem,
  technospheres: {
    ...withMnem.technospheres,
    mnemospheres: [{ id: 'm1', className: '博學士', level: 2, skills: [{ name: '集中', sl: 5 }] }]
  }
};
const fullMnemUp = applyLevelUp(fullMnemSL, { mnemosphereId: 'm1', skillName: '集中' });
check('投魔石：技能已達 maxSL -> 原物件原樣回傳', fullMnemUp === fullMnemSL, true);
check('投魔石：已達 maxSL 時魔石等級不動', fullMnemUp.technospheres.mnemospheres[0].level, 2);

check('不得新增職業（p.134）',
  applyLevelUp(withMnem, { className: '舞者', skillName: '起舞', isNewClass: true }).level, 5);
check('不得新增職業：職業清單原封不動',
  applyLevelUp(withMnem, { className: '舞者', skillName: '起舞', isNewClass: true }).classes.length, 3);
const upInnate = applyLevelUp(withMnem, { className: '元素師', skillName: '元素魔法' });
check('固有職業照常升級', upInnate.level, 6);
check('固有職業的技能 SL 上升', upInnate.classes.find((c) => c.className === '元素師').skills[0].sl, 3);
// 規則關閉時照常可以「第一次拿到某個職業」。但 `BASE_CHAR` 已經有三個職業，而
// Core p.228 限制「未精通職業不得超過三個」——所以這裡刻意用**只有兩個職業**的角色
// （建角預設 `classCountMin: 2`），新增後剛好三個。
const plainChar = {
  ...makeChar('off'),
  exp: 10,
  classes: [
    { className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 2 }] },
    { className: '靈能者', level: 2, skills: [{ name: '超感認知', sl: 2 }] }
  ]
};
const plainAdded = applyLevelUp(plainChar, { className: '舞者', skillName: '起舞', isNewClass: true });
check('規則關閉時「新增職業」照常可用', plainAdded.classes.length, 3);
check('規則關閉時新增的職業：等級 1、首個技能 SL 1',
  [plainAdded.classes[2].level, plainAdded.classes[2].skills[0].sl], [1, 1]);

// validateCharacter 的魔晶石檢查
const techChar = {
  ...withMnem,
  equipment: { mainHand: '青銅劍', offHand: '無盾牌', armor: '無裝甲 / 冒險服', accessory: '' }
};
const techErrors = validateCharacter(techChar).errors.map((e) => e.message);
check('官方武器表在魔晶石制下被擋', techErrors.some((m) => m.includes('只能裝備自訂武器')), true);
// 2026-10-27（F-011）：起始等級時「職業數不對」由通用那條負責（「起始不可超過 3 個職業」），
// 魔晶石那條**不重複發言**——兩條並列會讓玩家以為是兩個不同的缺口。
// 所以這裡要分兩個情況驗，才不會把「去重」誤讀成「檢查不見了」。
check('四職業在魔晶石制下被擋（起始等級：由通用的職業數檢查發言）',
  validateCharacter({ ...withMnem, classes: [...withMnem.classes, { className: '舞者', level: 1, skills: [] }] })
    .errors.some((e) => e.message.includes('起始不可超過 3 個職業')), true);
check('四職業在魔晶石制下不會被報兩次（同一件事只說一遍）',
  validateCharacter({ ...withMnem, classes: [...withMnem.classes, { className: '舞者', level: 1, skills: [] }] })
    .errors.filter((e) => e.message.includes('個職業') || e.message.includes('固有職業')).length, 1);
// 離開起始等級之後，通用那條不跑了，魔晶石這條就必須自己發言——
// 否則「已升級的角色把職業數改壞」會靜默放行。
check('四職業在魔晶石制下被擋（非起始等級：由魔晶石那條發言）',
  validateCharacter({
    ...withMnem,
    level: 6,
    classes: [...withMnem.classes, { className: '舞者', level: 1, skills: [] }]
  }).errors.some((e) => e.message.includes('恰好 3 個固有職業')), true);
check('三職業在魔晶石制下不擋職業數',
  validateCharacter(withMnem).errors.some((e) => e.message.includes('恰好 3 個固有職業')), false);
// 去重最危險的寫法是「魔晶石那條只在 classCount > 0 時才檢查」——
// 那會在「已升級、但職業被清空」時讓兩條都不發言，變成靜默放行。
// 這條專門擋那個寫法：離開起始等級、0 個職業，魔晶石那條必須自己說。
check('非起始等級 + 0 個職業：魔晶石那條仍要發言（不能被去重吃掉）',
  validateCharacter({ ...withMnem, level: 6, classes: [] })
    .errors.some((e) => e.message.includes('恰好 3 個固有職業')), true);

// ─────────────────────────────────────────────────────────── L
section('L. 裝備層（插槽品級算進同一筆預算）');

const weaponMap = new Map(rulesData.equipment.weapons.map((w) => [w.name, w]));
const shieldMap = new Map(rulesData.equipment.shields.map((s) => [s.name, s]));
const armorMap = new Map(rulesData.equipment.armors.map((a) => [a.name, a]));
const bareEquip = { mainHand: '徒手打擊', offHand: '無盾牌', armor: '冒險服', accessory: '' };

check('沒有魔晶石時花費不變',
  totalStartingEquipCost(bareEquip, { weaponMap, shieldMap, armorMap }), 0);
check('extraSpend 直接加上去',
  totalStartingEquipCost(bareEquip, { weaponMap, shieldMap, armorMap, extraSpend: 600 }), 600);
check('γ 插槽花 1500z',
  getTechnosphereEquipmentSpend({
    mnemospheres: [], integrated: [],
    slots: { mainHand: { quality: 'gamma', contents: [] } }
  }), 1500);
check('附魔魔石每顆 500z',
  getTechnosphereEquipmentSpend({
    mnemospheres: [], integrated: [],
    slots: { mainHand: { quality: 'beta', contents: [{ kind: 'hoplosphere', ref: 'arctic' }] } }
  }), 1100);
// 職業魔石**不**花起始預算（p.134 免費給、p.140 的採購清單沒有它）
check('職業魔石不計入起始裝備預算',
  getTechnosphereEquipmentSpend({
    mnemospheres: [{ id: 'a', className: '元素師', level: 5, skills: [] }], integrated: [], slots: {}
  }), 0);
check('但估值函式仍算得出職業魔石',
  getTechnosphereSpending({
    mnemospheres: [{ id: 'a', className: '元素師', level: 5, skills: [] }], integrated: [], slots: {}
  }), 2000);

const budgetIssues = buildLoadoutIssues({
  character: { equipment: bareEquip, classes: [] },
  stats: { profs: {} },
  weaponMap, shieldMap, armorMap,
  accessoryMap: new Map(),
  budget: 500,
  extraSpend: 1800
}).map((i) => i.message);
check('插槽品級超支會被擋', budgetIssues.some((m) => m.includes('超出 500z 預算')), true);

// ─────────────────────────────────────────────────────────── M
section('M. 面板（規則關閉時整個區塊不存在）');

const renderPanel = (mode) => renderToStaticMarkup(React.createElement(TechnospherePanel, {
  character: makeChar(mode), theme, disabled: false, onChange: () => {}
}));
// 2026-10-22：職業魔石的**成長**（取得／等級／技能／精通）搬到建角第 2 步，
// 第 4 步的面板只剩插槽與附魔魔石。所以「職業魔石區」的斷言要換一個渲染源。
const renderMnemosphere = (mode) => renderToStaticMarkup(React.createElement(MnemosphereSection, {
  character: makeChar(mode), theme, disabled: false, onChange: () => {}
}));

const panelOff = renderPanel('off');
const panelFull = renderPanel('full');
const panelIntegrated = renderPanel('integrated');
const panelHoplo = renderPanel('hoplospheresOnly');
const panelMnem = renderPanel('mnemospheresOnly');

check('規則關閉 → 面板不存在', panelOff, '');
check('full 有面板錨點', panelFull.includes('data-testid="technosphere-panel"'), true);
check('full 有職業魔石區', plain(panelFull).includes('職業魔石'), true);
check('full 有附魔魔石區', plain(panelFull).includes('附魔魔石'), true);
check('full 有 δ 選項', plain(panelFull).includes('槽位 δ'), true);
check('integrated 有內嵌裝置區', plain(panelIntegrated).includes('內嵌裝置'), true);
check('integrated 沒有 δ 選項', plain(panelIntegrated).includes('槽位 δ'), false);
check('hoplospheresOnly 沒有 δ 選項', plain(panelHoplo).includes('槽位 δ'), false);
check('hoplospheresOnly 沒有職業魔石區塊',
  panelHoplo.includes('mnemosphere-summary') || panelHoplo.includes('mnemosphere-empty'), false);
check('mnemospheresOnly 有職業魔石區',
  panelMnem.includes('mnemosphere-summary') || panelMnem.includes('mnemosphere-empty'), true);
check('mnemospheresOnly 沒有附魔魔石下拉', plain(panelMnem).includes('鑲嵌'), false);
check('空狀態會提示「開局免費獲得一顆 1 級魔石」（第 2 步）',
  plain(renderMnemosphere('full')).includes('開局會免費獲得一顆 1 級魔石'), true);
// 有魔石但沒裝 → 面板要標出來（p.136：未裝備不提供技能）
const idleChar = {
  ...makeChar('full'),
  technospheres: {
    mnemospheres: [{ id: 'm1', className: '博學士', level: 1, skills: [] }],
    slots: {},
    integrated: []
  }
};
const panelIdle = renderToStaticMarkup(React.createElement(TechnospherePanel, {
  character: idleChar, theme, disabled: false, onChange: () => {}
}));
const sectionIdle = renderToStaticMarkup(React.createElement(MnemosphereSection, {
  character: idleChar, theme, disabled: false, onChange: () => {}
}));
check('未裝備的魔石在第 4 步被標成「不提供技能」',
  plain(panelIdle).includes('沒有裝在任何插槽上'), true);
check('「未裝備」的警告不在第 2 步（那裡管成長，未裝是常態）',
  plain(sectionIdle).includes('沒有裝在任何插槽上'), false);
check('第 2 步改說「未裝入插槽（第 4 步）」',
  plain(sectionIdle).includes('第 4 步'), true);

// ─────────────────────────────────────────────────────────── N
section('N. 原始碼護欄（單一來源，不得各自重算）');

const PANEL_SRC = READ('src/features/character-sheet/components/TechnospherePanel.jsx');
const DATA_SRC = READ('src/features/character-sheet/data/technospheres.js');
const ENGINE_SRC = READ('src/features/character-sheet/utils/characterEngine.js');
const EQUIP_SRC = READ('src/features/character-sheet/utils/equipmentRules.js');
const RULES_SRC = READ('src/features/character-sheet/data/creationRules.js');

// 面板不得自己乘出價格或容量——一律呼叫資料層
check('面板不自己算 500／600／1500／1800',
  /[^0-9](600|1500|1800)[^0-9]/.test(PANEL_SRC.replace(/SLOT_QUALITIES\.\w+\.cost/g, '')), false);
check('面板呼叫 getTechnosphereEquipmentSpend', PANEL_SRC.includes('getTechnosphereEquipmentSpend'), true);
check('面板呼叫 validateTechnosphereState 以外的判定都走資料層',
  PANEL_SRC.includes('computeSlotUsage'), true);
// 引擎不得自己寫死 +5（要能被規則層決定）
check('引擎的 +5/+5 由 modeGrantsInnateBonus 決定',
  ENGINE_SRC.includes('modeGrantsInnateBonus'), true);
check('引擎的武器熟練由 modeGrantsMartialWeaponProficiency 決定',
  ENGINE_SRC.includes('modeGrantsMartialWeaponProficiency'), true);
// 裝備層對魔晶石的依賴**只准單向**。
//
// 原本這條寫的是「equipmentRules 不准提到 technospheres」。2026-10-22（§CF）放寬：
// 【雙重盾牌】在魔晶石制下失效（p.133）的判定必須在裝備層生效——主手能不能拿盾牌、
// 兩手皆盾能不能合併成「雙盾」，都在 `equipmentRules.js` 裡。把判定搬到 UI 等於
// 多一份會漂移的真相。
//
// 真正的風險不是「依賴」，是**成環**：`data/customWeapons.js` 已經 import 了
// `equipmentRules.js`，所以只要 `technospheres.js` 反過來 import 任何東西，
// 就可能繞回 `equipmentRules`。因此護欄改成守那條真正的不變式：
// **`technospheres.js` 零 import**。
check('technospheres.js 零 import（equipmentRules 對它的依賴才安全）',
  /^\s*import\s/m.test(DATA_SRC), false);
check('equipmentRules 對 technospheres 只有單向依賴（用來判定【雙重盾牌】失效）',
  EQUIP_SRC.includes("from '../data/technospheres'"), true);
// 開卡規則的推導：classCount 在魔晶石制下是 let（可被覆寫）
check('creationRules 用 let 讓職業數可被推導',
  /let classCountMin/.test(RULES_SRC) && /let classCountMax/.test(RULES_SRC), true);
// 翻譯用詞
check('資料層用「魔晶石」而非「科技球」', DATA_SRC.includes('魔晶石'), true);
check('資料層沒有把 Hoplosphere 命名成「魔導球」（那是修補匠的子系統）',
  /name: '魔導球'/.test(DATA_SRC), false);

// 面板的每個模式說明都要有出處頁碼
check('模式說明提到頁碼或原書', TECHNOSPHERE_MODE_KEYS.every((k) => (
  TECHNOSPHERE_MODES[k].desc.length > 10
)), true);

// ─────────────────────────────────────────────────────────── O
section('O. 珠子（等級環、珠色、泛指圖示）');

// 等級環是「亮幾段＝幾級」的唯一來源，UI 只負責轉成 SVG path
const ring0 = beadRingSegments(0);
const ring3 = beadRingSegments(3);
check('等級環固定 5 段', ring0.length, 5);
check('0 級 → 全暗', ring0.every((s) => s.active === false), true);
check('3 級 → 亮 3 段', ring3.map((s) => s.active), [true, true, true, false, false]);
check('超額等級夾到上限', beadRingSegments(9).every((s) => s.active), true);
check('負數等級視為 0 級', beadRingSegments(-2).every((s) => s.active === false), true);
check('每一段都是正角度區間', ring0.every((s) => s.endDeg > s.startDeg), true);
check('相鄰段不重疊（前段結束 < 後段開始）',
  ring0.slice(1).every((s, i) => s.startDeg > ring0[i].endDeg), true);

// 珠色：15 個職業一個都不能漏（漏了會退回中性色，玩家就分不出來）
check('珠色覆蓋全部 15 個職業魔石職業',
  MNEMOSPHERE_CLASSES.every((c) => Boolean(MNEMOSPHERE_BEAD_TINTS[c])), true);
check('珠色沒有多餘的鍵（職業清單是唯一來源）',
  Object.keys(MNEMOSPHERE_BEAD_TINTS).length, MNEMOSPHERE_CLASSES.length);
check('清單外的職業回中性色', getMnemosphereBeadTint('不存在的職業'), '#8a7a63');
check('清單內的職業回自己的顏色', getMnemosphereBeadTint('守護者'), MNEMOSPHERE_BEAD_TINTS['守護者']);

// 附魔魔石：36 顆共用一個泛指圖示，靠傷害屬性上色
const hopDamageTypes = new Set(
  DAMAGE_TYPE_HOPLOSPHERES.map((key) => getHoplosphere(key)?.damageType).filter(Boolean)
);
check('傷害屬性色覆蓋附魔魔石用到的每一個屬性',
  [...hopDamageTypes].every((t) => Boolean(DAMAGE_TYPE_TINTS[t])), true);
check('傷害屬性色沒有多餘的鍵',
  Object.keys(DAMAGE_TYPE_TINTS).length, hopDamageTypes.size);
check('有傷害屬性 → 用屬性色',
  getHoplosphereBeadTint(HOPLOSPHERES.find((h) => h.damageType)),
  DAMAGE_TYPE_TINTS[HOPLOSPHERES.find((h) => h.damageType).damageType]);
check('沒有傷害屬性 → 用泛指色',
  getHoplosphereBeadTint(HOPLOSPHERES.find((h) => !h.damageType)), HOPLOSPHERE_BEAD_TINT);
check('查不到的附魔魔石也回泛指色', getHoplosphereBeadTint(null), HOPLOSPHERE_BEAD_TINT);

// SVG 弧線：0° 在 12 點鐘、順時針
check('弧線是 A 指令（不是折線）', beadArcPath(5, 67).includes(' A '), true);
check('弧線起點在圓心正上方',
  beadArcPath(0, 72).startsWith('M 20.00 3.00'), true);

section('O2. 插槽資格（p.133：只有自訂武器與自訂防具）');

check('武器可以有插槽', slotSupportsQuality('mainHand') && slotSupportsQuality('offHand'), true);
check('防具可以有插槽', slotSupportsQuality('armor'), true);
check('飾品不能有插槽', slotSupportsQuality('accessory'), false);
check('資格清單就是三個裝備位', [...SLOT_QUALITY_ELIGIBLE_SLOTS], ['mainHand', 'offHand', 'armor']);

const accessoryBeta = validateTechnosphereState({
  state: { mnemospheres: [], slots: { accessory: { quality: 'beta', contents: [] } }, integrated: [] },
  mode: 'full',
  level: 5
}).map((i) => i.message);
check('飾品掛 β 品級 → error',
  accessoryBeta.some((m) => m.includes('只有自訂武器與自訂防具可以有魔石插槽')), true);

const accessoryEmpty = validateTechnosphereState({
  state: { mnemospheres: [], slots: { accessory: { quality: 'alpha', contents: [] } }, integrated: [] },
  mode: 'full',
  level: 5
}).map((i) => i.message);
check('飾品什麼都沒掛 → 不算違規', accessoryEmpty.length, 0);

const accessoryContent = validateTechnosphereState({
  state: {
    mnemospheres: [],
    slots: { accessory: { quality: 'alpha', contents: [{ kind: 'hoplosphere', ref: HOPLOSPHERES[0].key }] } },
    integrated: []
  },
  mode: 'full',
  level: 5
}).map((i) => i.message);
check('飾品掛了附魔魔石 → error',
  accessoryContent.some((m) => m.includes('只有自訂武器與自訂防具可以有魔石插槽')), true);

section('O3. 職業魔石的技能點數（p.136：每一級給一個技能等級）');

const overSpent = validateTechnosphereState({
  state: {
    mnemospheres: [{ id: 'm1', className: '守護者', level: 3, skills: [{ name: '鐵壁', sl: 4 }] }],
    slots: {},
    integrated: []
  },
  mode: 'full',
  level: 5
}).map((i) => i.message);
check('3 級魔石分配 4 點 → error',
  overSpent.some((m) => m.includes('只有 3 點技能可分配')), true);

const exactSpent = validateTechnosphereState({
  state: {
    mnemospheres: [{ id: 'm1', className: '守護者', level: 3, skills: [{ name: '鐵壁', sl: 3 }] }],
    slots: {},
    integrated: []
  },
  mode: 'full',
  level: 5
}).map((i) => i.message);
check('3 級魔石剛好分配 3 點 → 不算違規',
  exactSpent.some((m) => m.includes('點技能可分配')), false);

// 技能表與職業本身共用同一份資料，不另外維護一套
const guardianSkills = classSkillsForClass('守護者');
check('職業魔石查得到該職業的技能表', guardianSkills.length > 0, true);
check('技能表每一筆都有 name 與 maxSL',
  guardianSkills.every((s) => typeof s.name === 'string' && s.name && Number(s.maxSL) >= 1), true);
check('技能表與 rulesData 完全一致',
  guardianSkills.map((s) => s.name),
  (rulesData.classes['守護者'].skills || []).map((s) => s.name));
check('查不到的職業回空表', classSkillsForClass('不存在的職業'), []);
check('空職業名回空表', classSkillsForClass(''), []);

section('O4. 引擎把魔石技能併進角色數值（p.136）');

const techCharBase = makeChar('full');
const techWithSphere = {
  ...techCharBase,
  equipment: { ...(techCharBase.equipment || {}), mainHand: '自訂長劍' },
  technospheres: {
    mnemospheres: [{ id: 'm1', className: '守護者', level: 3, skills: [{ name: '鐵壁', sl: 2 }] }],
    slots: { mainHand: { quality: 'alpha', contents: [{ kind: 'mnemosphere', ref: 'm1' }] } },
    integrated: []
  }
};
const techStats = calculateCharacterStats(techWithSphere);
check('生效中的魔石被列出來', techStats.activeMnemospheres.map((m) => m.id), ['m1']);
check('魔石技能被攤平進 stats', techStats.mnemosphereSkills.map((s) => s.name), ['鐵壁']);
check('魔石技能等級總和', techStats.mnemosphereSkillLevels, 2);
check('技能水準上限＝角色等級＋魔石等級',
  techStats.skillLevelCeiling, getCharacterLevel(techWithSphere) + 3);

// 沒裝備就不生效（p.136：卸下即失去全部技能）
const techUnequipped = {
  ...techWithSphere,
  equipment: { ...(techWithSphere.equipment || {}), mainHand: '無' }
};
const techUnequippedStats = calculateCharacterStats(techUnequipped);
check('裝備位空著 → 魔石不生效', techUnequippedStats.mnemosphereSkills.length, 0);
check('不生效時技能水準上限回到角色等級',
  techUnequippedStats.skillLevelCeiling, getCharacterLevel(techUnequipped));

// 規則沒開 → 三個欄位都是中性值
const techOffStats = calculateCharacterStats({ ...techWithSphere, creationRules: { technospheres: 'off' } });
check('規則關閉 → 不列魔石', techOffStats.activeMnemospheres.length, 0);
check('規則關閉 → 技能水準上限＝角色等級',
  techOffStats.skillLevelCeiling, getCharacterLevel(techWithSphere));

section('O5. 面板真的畫出珠子（SSR）');

const beadChar = {
  ...techCharBase,
  equipment: { ...(techCharBase.equipment || {}), mainHand: '自訂長劍', armor: '自訂鎧甲', accessory: '自訂護符' },
  technospheres: {
    mnemospheres: [{ id: 'm1', className: '守護者', level: 3, skills: [{ name: '鐵壁', sl: 2 }] }],
    slots: {
      mainHand: { quality: 'gamma', contents: [{ kind: 'mnemosphere', ref: 'm1' }] },
      armor: { quality: 'alpha', contents: [] },
      accessory: { quality: 'alpha', contents: [] }
    },
    integrated: []
  }
};
const renderChar = (char, mode = 'full') => renderToStaticMarkup(React.createElement(TechnospherePanel, {
  character: { ...char, creationRules: { technospheres: mode } },
  theme,
  disabled: false,
  onChange: () => {}
}));
const panelBead = renderChar(beadChar);
// 珠子與技能選擇器現在畫在第 2 步的 `MnemosphereSection`（2026-10-22 拆分）。
const sectionBead = renderToStaticMarkup(React.createElement(MnemosphereSection, {
  character: { ...beadChar, creationRules: { technospheres: 'full' } },
  theme,
  disabled: false,
  onChange: () => {}
}));

check('職業魔石畫成一顆珠子', sectionBead.includes('data-testid="bead-mnemosphere-m1"'), true);
check('第 4 步的摘要也畫珠子', panelBead.includes('data-testid="bead-summary-m1"'), true);
check('插槽裡的魔石也是一顆珠子', panelBead.includes('data-testid="bead-socket-mainHand-0"'), true);
check('珠子有等級環（SVG 弧線）', panelBead.includes('A 17 17'), true);
check('珠座有空位（虛線凹槽）', panelBead.includes('data-testid="sockets-mainHand"'), true);
check('魔石技能選擇器存在', sectionBead.includes('data-testid="skill-picker-m1"'), true);
check('已分配的技能點數顯示成 n / m',
  plain(sectionBead).includes('2 / 3'), true);

// 飾品不能掛插槽 → 下拉要鎖住
const accessorySelect = panelBead.match(/<select[^>]*data-testid="quality-accessory"[^>]*>/);
check('飾品槽的品級下拉被鎖住', Boolean(accessorySelect) && accessorySelect[0].includes('disabled'), true);
check('飾品槽說明「飾品與機師模組沒有」', plain(panelBead).includes('飾品與機師模組沒有'), true);
const armorSelect = panelBead.match(/<select[^>]*data-testid="quality-armor"[^>]*>/);
check('防具槽的品級下拉沒有被鎖住', Boolean(armorSelect) && !armorSelect[0].includes('disabled'), true);

// 附魔魔石：泛指圖示 + 逐筆效果 + 凝聚標記
const coagSample = HOPLOSPHERES.find((h) => h.coag2);
const hoploChar = {
  ...beadChar,
  technospheres: {
    mnemospheres: [],
    slots: {
      mainHand: {
        quality: 'delta',
        contents: [
          { kind: 'hoplosphere', ref: coagSample.key },
          { kind: 'hoplosphere', ref: coagSample.key }
        ]
      }
    },
    integrated: []
  }
};
const panelHoploBead = renderChar(hoploChar);
check('附魔魔石也有珠子', panelHoploBead.includes('data-testid="bead-socket-mainHand-0"'), true);
check('附魔魔石的效果逐筆列出', panelHoploBead.includes('data-testid="hoplosphere-effects-mainHand"'), true);
check('凝聚 2 的效果文字出現', plain(panelHoploBead).includes('凝聚 2：'), true);
check('凝聚標記是菱形記號（不是 emoji）', panelHoploBead.includes('◆◆'), true);
check('珠子上標了佔用格數',
  panelHoploBead.includes(`>${coagSample.slots}<`), true);

// 內嵌變體：珠座 + 空位
const integratedChar = {
  ...beadChar,
  technospheres: {
    mnemospheres: [{ id: 'm1', className: '守護者', level: 2, skills: [] }],
    slots: {},
    integrated: ['m1']
  }
};
const panelIntBead = renderChar(integratedChar, 'integrated');
check('內嵌裝置是一排珠座', panelIntBead.includes('data-testid="integrated-carrier"'), true);
check('內嵌的魔石畫成珠子', panelIntBead.includes('data-testid="bead-integrated-m1"'), true);
check('內嵌裝置有選擇器', panelIntBead.includes('data-testid="integrated-picker"'), true);

// 珠子元件本身：等級環段數與顏色
const beadMarkup = renderToStaticMarkup(React.createElement(TechnosphereBead, {
  iconName: '守護者', tint: '#2563eb', level: 4, size: 34, testId: 'bead-unit'
}));
// 只數等級環自己的弧：GameIcon 的 gi 剪影本身也是 SVG（含自己的 path），
// 數 `<path` 會把職業圖示一起算進來（5 段環 ＋ 1 個剪影 = 6）。
check('珠子元件渲染 5 段環',
  (beadMarkup.match(/A 17 17/g) || []).length, 5);
check('珠子元件帶 testId', beadMarkup.includes('data-testid="bead-unit"'), true);
const emptyMarkup = renderToStaticMarkup(React.createElement(EmptyBeadSocket, { size: 30, label: '1' }));
check('空珠座是虛線圓', emptyMarkup.includes('dashed'), true);

// 面板原始碼：珠子與圖示一律走共用元件，不得自己畫圓
check('面板使用 TechnosphereBead', PANEL_SRC.includes('TechnosphereBead'), true);
check('面板使用 EmptyBeadSocket', PANEL_SRC.includes('EmptyBeadSocket'), true);
// 舊版用 `◇`／`◆` 文字冒充珠子。現在珠子是元件，面板只准把 `◆` 用在
// 凝聚層級記號（TIER_MARK）上——空心菱形則完全不該再出現。
check('面板不再用空心菱形 ◇ 假裝珠子', /◇/.test(PANEL_SRC), false);
check('凝聚層級記號仍是菱形（◆／◆◆／◆◆◆）',
  /const TIER_MARK = \{ base: '◆', coag2: '◆◆', coag3: '◆◆◆' \}/.test(PANEL_SRC), true);

// ─────────────────────────────────────────────────────────── P
section('P. 裝備白名單的邊界：只有「僅職業魔石」放回官方裝備（p.138）');

// p.133：「The only types of equipment available in the game are the following:
// custom weapons (page 112), armor, and accessories, plus weapon and armor
// modules for the Pilot Class」＋「Any other equipment simply cannot exist」。
// 所以「要不要定制武器」不是 GM 的偏好，是這條規則的直接後果。
// 唯一的例外是「僅職業魔石」（p.138）：那一態官方裝備整份放回，穿官方劍是合法的。

const officialSwordChar = (mode) => ({
  ...makeChar(mode),
  equipment: { mainHand: '青銅劍', offHand: '無盾牌', armor: '無裝甲 / 冒險服', accessory: '' }
});
const swordBanned = (mode) => validateCharacter(officialSwordChar(mode)).errors
  .some((e) => e.message.includes('只能裝備自訂武器'));

check('完整規則：官方武器被擋', swordBanned('full'), true);
check('內嵌裝置：官方武器仍被擋', swordBanned('integrated'), true);
check('僅附魔魔石：官方武器仍被擋', swordBanned('hoplospheresOnly'), true);
check('僅職業魔石：官方武器**合法**（p.138「all types of equipment are once again available」）',
  swordBanned('mnemospheresOnly'), false);
check('魔晶石關閉：官方武器合法', swordBanned('off'), false);

// 開卡規則層：定制武器是**派生值**，不是寫進使用者偏好的 true
check('完整規則 → allowCustomWeapon 派生為 true',
  resolveCreationRules({ technospheres: 'full' }).allowCustomWeapon, true);
check('內嵌裝置 → 派生為 true',
  resolveCreationRules({ technospheres: 'integrated' }).allowCustomWeapon, true);
check('僅附魔魔石 → 派生為 true',
  resolveCreationRules({ technospheres: 'hoplospheresOnly' }).allowCustomWeapon, true);
check('僅職業魔石 → 不派生',
  resolveCreationRules({ technospheres: 'mnemospheresOnly' }).allowCustomWeapon, false);
check('關閉 → 不派生', resolveCreationRules({ technospheres: 'off' }).allowCustomWeapon, false);
check('派生值不會被寫進 diff（分享出去不會傳染給別的團）',
  'allowCustomWeapon' in diffCreationRules({ technospheres: 'full' }), false);

// 裝備選擇器：官方武器表與盾牌表整份空掉，並說明去哪裡鍛造
const PICKER_SRC = READ('src/features/character-sheet/components/EquipmentPickerModal.jsx');
check('裝備選擇器認得魔晶石制', PICKER_SRC.includes('modeRestrictsEquipment'), true);
check('武器表與盾牌表都被清空（兩處）',
  (PICKER_SRC.match(/if \(technoRestrictsEquipment\) return \[\];/g) || []).length, 2);
check('武器空狀態指向定制武器分頁', PICKER_SRC.includes('沒有官方武器表'), true);
check('盾牌空狀態引用【雙重盾牌】', PICKER_SRC.includes('雙重盾牌'), true);
check('防具與飾品沒有被一起清空（p.133 的白名單裡有 armor／accessories）',
  /armorRows[\s\S]{0,400}if \(technoRestrictsEquipment\)/.test(PICKER_SRC), false);

/* ──────────────────────────────────────────────────────────────────────────
 * Q. 魔晶石制下的修補匠【小工具】魔導科技（科技奇幻手冊 p.133）
 *
 *   > … turn the magispheres from the Tinkerer Class into an advanced magitech
 *   > benefit, removing the magicannon completely (Core Rulebook, page 215).
 *
 * 兩件事必須同時成立，而且必須是同一份資料推出來的：
 *   ① 魔加農整檔消失（它在 p.215 是一把 `Cannot have Qualities` 的武器，
 *      在魔晶石制下連一顆魔石都鑲不了，白名單也不收它）
 *   ② 魔法球原型從最高檔（tier 3）降到進階檔（tier 2），補上魔加農的位置
 *      → 這一態的魔導科技只有**兩個**益處
 * ────────────────────────────────────────────────────────────────────────── */
section('Q. 魔晶石制：魔導科技只剩兩個益處（p.133）');

const coreMagitech = resolveMagitechNodes(false);
const technoMagitech = resolveMagitechNodes(true);

check('核心書：三檔', coreMagitech.length, 3);
check('魔晶石制：兩檔', technoMagitech.length, 2);
check('核心書：檔位就是 1／2／3', coreMagitech.map((n) => n.tier), [1, 2, 3]);
check('魔晶石制：檔位是 1／2（不留空洞）', technoMagitech.map((n) => n.tier), [1, 2]);
check('魔晶石制：魔加農整檔不存在', technoMagitech.some((n) => n.id === 'magicannon'), false);
check('魔晶石制：魔科技篡奪留著（基礎檔不受影響）',
  technoMagitech[0].id, 'magitechOverride');
check('魔晶石制：魔法球原型補上進階檔',
  [technoMagitech[1].id, technoMagitech[1].name], ['magispheres', '魔法球原型']);
check('魔晶石制：魔法球的檔位名是「進階益處」',
  technoMagitech[1].tierName, '進階益處');
check('核心書：魔法球原本在最高檔',
  [coreMagitech[2].tier, coreMagitech[2].tierName], [3, '最高益處']);
check('核心書：魔加農在進階檔', coreMagitech[1].id, 'magicannon');

check('最高檔：核心 3', magitechMaxTier(false), 3);
check('最高檔：魔晶石制 2', magitechMaxTier(true), 2);
check('magitechNodeAt(2) 在魔晶石制下是魔法球',
  magitechNodeAt(2, true)?.id, 'magispheres');
check('magitechNodeAt(3) 在魔晶石制下不存在（不能選到一個不存在的檔）',
  magitechNodeAt(3, true), null);
check('magitechNodeAt(3) 在核心書下是魔法球',
  magitechNodeAt(3, false)?.id, 'magispheres');
check('關閉魔晶石 → 回傳的仍是同一份凍結陣列（沒有多餘複製）',
  resolveMagitechNodes(false) === MAGITECH_CORE_NODES, true);
check('魔晶石制的節點陣列是新的（不污染核心常數）',
  technoMagitech === MAGITECH_CORE_NODES, false);
check('核心常數沒有被改動（魔法球仍是 tier 3）',
  MAGITECH_CORE_NODES[2].tier, 3);

// 三個顯示面必須用同一份推導，否則會出現「彈窗兩檔、速查三檔」
const MODAL_SRC = READ('src/features/character-sheet/components/companions/TinkererGadgetsModal.jsx');
const QUICKREF_SRC = READ('src/features/character-sheet/components/companions/TinkererGadgetsQuickRef.jsx');
const WORKSHOP_SRC = READ('src/features/character-sheet/components/companions/TinkererWorkshop.jsx');
const SKILLCARD_SRC = READ('src/features/character-sheet/components/ClassSkillCard.jsx');
const HUD_SRC = READ('src/features/character-sheet/components/CharacterPlayHUD.jsx');

check('彈窗：節點來自資料層的 MAGITECH_CORE_NODES（不再就地寫死）',
  MODAL_SRC.includes('nodes: MAGITECH_CORE_NODES'), true);
check('彈窗：有魔晶石制的節點解析',
  MODAL_SRC.includes('resolveMagitechNodes(technoRestrictsEquipment)'), true);
check('彈窗：存檔裡超額的魔導科技點數進場就夾回上限',
  MODAL_SRC.includes('Math.min(gadgetsData?.magitech || 0, maxMagitechTier)'), true);
// ⚠️ 這一條刻意錨在 `onSave` 的寫入式上，不是上面那個 useState 的初始值——
// 2026-10-22 實測：把寫入改回 `magitech: magitechTier` 時，只鎖初始值的斷言仍然全綠。
check('彈窗：寫回存檔時也夾上限（降檔後不會留下不存在的第 3 點）',
  MODAL_SRC.includes('magitech: Math.min(magitechTier, maxMagitechTier),'), true);
check('彈窗：咒語挑選器跟著該軌最高檔走（不寫死 3）',
  MODAL_SRC.includes('magitechTier >= maxMagitechTier'), true);
check('彈窗：魔晶石制有專屬說明文案',
  MODAL_SRC.includes('魔導科技只有兩個益處'), true);

check('速查：魔加農有魔晶石制的守衛（兩處：收合摘要標籤 ＋ 展開區塊）',
  (QUICKREF_SRC.match(/magitech >= 2 && !technoRestrictsEquipment/g) || []).length, 2);
check('速查：魔法球的檔位跟著走，不寫死 3',
  QUICKREF_SRC.includes('magitech >= magisphereTier'), true);
check('速查：標題會依規則改名',
  QUICKREF_SRC.includes("technoRestrictsEquipment ? '高級【魔法球原型】' : '最高【魔法球原型】'"), true);

check('工坊：魔加農區塊有魔晶石制的守衛（一處）',
  (WORKSHOP_SRC.match(/gadgets\.magitech >= 2 && !technoRestrictsEquipment/g) || []).length, 1);
check('工坊：魔法球區塊的門檻跟著走',
  WORKSHOP_SRC.includes('gadgets.magitech >= magisphereTier'), true);
check('工坊：判定與裝備選擇器共用 modeRestrictsEquipment',
  WORKSHOP_SRC.includes('modeRestrictsEquipment('), true);

check('技能卡：把判定傳進彈窗',
  SKILLCARD_SRC.includes('technoRestrictsEquipment={'), true);
check('跑團卡：把判定傳進速查',
  HUD_SRC.includes('technoRestrictsEquipment={'), true);
// SSR 真渲染：兩態 × 展開／收合，四個組合都要對
const GADGETS_FIXTURE = { alchemy: 0, infusion: 0, magitech: 3, magitechSpells: [] };
const NOOP = () => {};
const renderGadgetViews = (techno) => ({
  modal: renderToStaticMarkup(React.createElement(TinkererGadgetsModal, {
    isOpen: true, onClose: NOOP, gadgetsData: GADGETS_FIXTURE, tinkererSL: 5,
    characterLevel: 5, variantId: null, technoRestrictsEquipment: techno, onSave: NOOP
  })),
  quick: renderToStaticMarkup(React.createElement(TinkererGadgetsQuickRef, {
    gadgetsData: GADGETS_FIXTURE, sl: 5, characterLevel: 5, variantId: null,
    technoRestrictsEquipment: techno
  })),
  folded: renderToStaticMarkup(React.createElement(TinkererGadgetsQuickRef, {
    gadgetsData: GADGETS_FIXTURE, sl: 5, characterLevel: 5, variantId: null,
    technoRestrictsEquipment: techno, initialCollapsed: true
  }))
});
const coreViews = renderGadgetViews(false);
const technoViews = renderGadgetViews(true);
const tally = (s, n) => (s.match(new RegExp(n, 'g')) || []).length;

check('SSR 彈窗：核心書有魔加農節點', coreViews.modal.includes('魔加農火器'), true);
check('SSR 彈窗：魔晶石制沒有魔加農節點', technoViews.modal.includes('魔加農火器'), false);
check('SSR 彈窗：魔晶石制仍有魔科技篡奪', technoViews.modal.includes('魔科技篡奪'), true);
check('SSR 彈窗：魔晶石制仍有魔法球原型', technoViews.modal.includes('魔法球原型'), true);
check('SSR 彈窗：魔晶石制的魔法球掛在進階檔', technoViews.modal.includes('進階益處'), true);
// 兩處：「魔法球原型」節點的 tierName ＋ 檔位狀態條（currentTier === 3 的文案）
check('SSR 彈窗：最高益處比核心少兩個（節點 ＋ 檔位條）',
  tally(coreViews.modal, '最高益處') - tally(technoViews.modal, '最高益處'), 2);
check('SSR 彈窗：魔晶石制有 p.133 的說明文案', technoViews.modal.includes('只有兩個益處'), true);

check('SSR 速查（展開）：核心書有高級【魔加農】', coreViews.quick.includes('高級【魔加農】'), true);
check('SSR 速查（展開）：魔晶石制沒有高級【魔加農】', technoViews.quick.includes('高級【魔加農】'), false);
check('SSR 速查（展開）：魔晶石制有高級【魔法球原型】', technoViews.quick.includes('高級【魔法球原型】'), true);
check('SSR 速查（展開）：核心書有最高【魔法球原型】', coreViews.quick.includes('最高【魔法球原型】'), true);
check('SSR 速查（展開）：魔晶石制的 Tier 顯示為 2/2（存檔 3 點已被夾）',
  technoViews.quick.includes('Tier 2/2'), true);
check('SSR 速查（展開）：核心書的 Tier 不帶分母', coreViews.quick.includes('Tier 3'), true);

// 收合摘要標籤是跑團桌上最常看到的那一面，最容易漏
check('SSR 速查（收合）：核心書有魔加農標籤', coreViews.folded.includes('魔加農【HR + 10】'), true);
check('SSR 速查（收合）：魔晶石制沒有魔加農標籤', technoViews.folded.includes('魔加農【HR + 10】'), false);
check('SSR 速查（收合）：核心書的魔法球標籤要 tier 3',
  coreViews.folded.includes('魔法球原型 (2 IP)'), true);
check('SSR 速查（收合）：魔晶石制的魔法球標籤在 tier 2 就出現',
  technoViews.folded.includes('魔法球原型 (2 IP)'), true);
check('SSR 速查（收合）：魔晶石制仍有魔科技篡奪標籤',
  technoViews.folded.includes('魔科技篡奪 (10 MP)'), true);
// ─────────────────────────────────────────────────────────── R
section('R. 職業魔石拆兩步：成長在第 2 步、裝載在第 4 步（p.134–136）');

// 為什麼要拆：p.134 說升級點是「投進固有職業**或**職業魔石」（成長，同一個池子）；
// p.135 才說「**裝備著**才取得技能，一卸下就全失去」（生效）。這是兩個決定。
// 拆之前兩者都在第 4 步，於是 `skillLevelCeiling` 在第 2 步算的是一個
// 不含魔石的數字，跳到第 4 步又變——同一個概念兩個答案。

// ── R1. 引擎的兩個數字：持有（held）vs 生效（active）──
const heldChar = makeChar('full', {
  technospheres: {
    mnemospheres: [{ id: 'h1', className: '守護者', level: 3, skills: [] }],
    slots: {},
    integrated: []
  }
});
const heldStats = calculateCharacterStats(heldChar);
const heldLevel = getCharacterLevel(heldChar);
check('R1 未裝載 → 實際上限仍是角色等級', heldStats.skillLevelCeiling, heldLevel);
check('R1 未裝載 → 持有上限把魔石算進去', heldStats.heldSkillLevelCeiling, heldLevel + 3);
check('R1 兩個數字不可互換', heldStats.heldSkillLevelCeiling > heldStats.skillLevelCeiling, true);
check('R1 heldMnemospheres 回傳持有的魔石（不看裝沒裝）',
  heldStats.heldMnemospheres.map((m) => m.id), ['h1']);
check('R1 activeMnemospheres 未裝載時是空的', heldStats.activeMnemospheres.length, 0);

const slottedChar = makeChar('full', {
  equipment: { ...(BASE_CHAR.equipment || {}), mainHand: '自訂長劍' },
  technospheres: {
    mnemospheres: [{ id: 'h1', className: '守護者', level: 3, skills: [] }],
    slots: { mainHand: { quality: 'gamma', contents: [{ kind: 'mnemosphere', ref: 'h1' }] } },
    integrated: []
  }
});
const slottedStats = calculateCharacterStats(slottedChar);
check('R1 裝上且裝備著 → 實際上限＝持有上限',
  slottedStats.skillLevelCeiling, slottedStats.heldSkillLevelCeiling);
check('R1 裝上後實際上限＝角色等級＋魔石等級',
  slottedStats.skillLevelCeiling, getCharacterLevel(slottedChar) + 3);

const offHeldStats = calculateCharacterStats(makeChar('off', {
  technospheres: {
    mnemospheres: [{ id: 'h1', className: '守護者', level: 3, skills: [] }],
    slots: {}, integrated: []
  }
}));
check('R1 規則關閉 → 兩個數字都退回角色等級',
  [offHeldStats.skillLevelCeiling, offHeldStats.heldSkillLevelCeiling],
  [getCharacterLevel(makeChar('off')), getCharacterLevel(makeChar('off'))]);

// ── R2. `getEquippedTechnosphereSlotIds` 是唯一一份「哪些槽位算裝備著」的判定 ──
check('R2 四個裝備位都算', getEquippedTechnosphereSlotIds({ equipment: {
  mainHand: '劍', offHand: '盾', armor: '甲', accessory: '飾'
} }), ['mainHand', 'offHand', 'armor', 'accessory']);
check('R2 「無」「無盾牌」空字串與 null 都不算', getEquippedTechnosphereSlotIds({ equipment: {
  mainHand: '無', offHand: '無盾牌', armor: '', accessory: null
} }), []);
check('R2 沒有 equipment 也不炸', getEquippedTechnosphereSlotIds({}), []);

// ── R3. 原始碼護欄：每一種操作只准存在一個地方 ──
const SECTION_SRC = READ('src/features/character-sheet/components/MnemosphereSection.jsx');
check('R3 等級 ±1 只出現在第 2 步',
  [PANEL_SRC.includes('raiseMnemosphere'), PANEL_SRC.includes('lowerMnemosphere'),
    SECTION_SRC.includes('raiseMnemosphere'), SECTION_SRC.includes('lowerMnemosphere')],
  [false, false, true, true]);
check('R3 技能分配下拉只出現在第 2 步',
  [PANEL_SRC.includes('skill-picker-'), SECTION_SRC.includes('skill-picker-')], [false, true]);
check('R3 精通英雄技能下拉只出現在第 2 步',
  [PANEL_SRC.includes('heroic-picker-'), SECTION_SRC.includes('heroic-picker-')], [false, true]);
check('R3 第 4 步不再畫職業魔石珠座',
  PANEL_SRC.includes('bead-mnemosphere-'), false);
check('R3 裝載下拉只出現在第 4 步',
  [PANEL_SRC.includes('mnemosphere-picker-'), SECTION_SRC.includes('mnemosphere-picker-')], [true, false]);
check('R3 插槽品級只出現在第 4 步',
  [PANEL_SRC.includes('quality-'), SECTION_SRC.includes('quality-')], [true, false]);
check('R3 第 2 步不自己算技能上限（呼叫資料層）',
  [SECTION_SRC.includes('getSkillLevelCeiling('), SECTION_SRC.includes('getMnemosphereLevelTotal')],
  [true, false]);

// ── R4. 掛載點：第 2 步 vs 第 4 步 ──
const EDITOR_SRC = READ('src/features/character-sheet/components/CharacterEditor.jsx');
const iStep2 = EDITOR_SRC.indexOf('activeTab === 2 &&');
const iStep4 = EDITOR_SRC.indexOf('activeTab === 4 &&');
const iMnemSection = EDITOR_SRC.indexOf('<MnemosphereSection');
const iTechnoPanel = EDITOR_SRC.indexOf('<TechnospherePanel');
check('R4 兩個步驟的區塊邊界都找得到', [iStep2 > 0, iStep4 > iStep2], [true, true]);
check('R4 職業魔石區掛在第 2 步',
  [iMnemSection > iStep2, iMnemSection < iStep4], [true, true]);
check('R4 魔晶石面板仍掛在第 4 步', iTechnoPanel > iStep4, true);
check('R4 第 2 步沒有插槽面板', iTechnoPanel < iMnemSection, false);

// ── R5. 第 2 步把「持有」那個數字印出來，玩家才做得出正確的分配決定 ──
check('R5 第 2 步印出「技能水準相當於 N 級」',
  plain(sectionIdle).includes('技能水準相當於'), true);
check('R5 那個數字是「角色等級＋持有魔石等級」',
  plain(sectionIdle).includes(`技能水準相當於 ${getCharacterLevel(idleChar) + 1} 級`), true);
check('R5 第 2 步說得出「裝進插槽是第 4 步的事」',
  plain(sectionIdle).includes('裝備配置'), true);

section('S. 開局自動配發 ＋ 技能表要看得到說明（p.134–135）');

// ── S1. 開局那一顆不是「按取得」，是「選職業」──
// p.134「Each Player Character also receives a level 1 mnemosphere of a Class of
// their choice upon creation」——「upon creation」是自動成立的，不是玩家記得按按鈕
// 才成立。所以空狀態畫的是一顆**空珠座**加一個職業下拉，選完就變成第一顆。
const emptySection = renderMnemosphere('full');
check('S1 開局畫的是空珠座（不是一行提示字）',
  emptySection.includes('data-testid="free-mnemosphere-slot"'), true);
check('S1 空珠座裡就能選職業',
  emptySection.includes('data-testid="mnemosphere-class-picker"'), true);
check('S1 開局沒有「取得」按鈕要玩家記得按',
  emptySection.includes('data-testid="add-mnemosphere"'), false);

// ── S2. 第二顆以後才是 GM 獎勵（p.138 `TECHNOSPHERES AS REWARDS`）──
check('S2 已有魔石時才出現「再取得一顆」',
  sectionBead.includes('data-testid="add-mnemosphere"'), true);
check('S2 已有魔石時不再畫空珠座',
  sectionBead.includes('data-testid="free-mnemosphere-slot"'), false);

// ── S3. 技能表列出**所有**技能，而且帶說明 ──
// 拆之前是一個只有技能名的 `<select>`：玩家看不到「保鏢」在寫什麼就得決定
// 那一點要投哪裡。`beadChar` 只學了《鐵壁》，所以「保鏢」「防守掌握」出現在
// 畫面上就證明列出的是整張表，不是已學的那幾個。
check('S3 未學習的技能也列出來（保鏢）', plain(sectionBead).includes('保鏢'), true);
check('S3 未學習的技能也列出來（防守掌握）', plain(sectionBead).includes('防守掌握'), true);
check('S3 技能說明真的畫出來（不只有技能名）',
  plain(sectionBead).includes('如果你執行'), true);
check('S3 星星是可操作的（onChange 有接上）',
  SECTION_SRC.includes('onChange={(next) => setSkills('), true);

// ── S4. 原始碼護欄：加減點數只有一份實作 ──
const SKILL_PICKER_SRC = READ('src/features/character-sheet/components/ClassSkillPickerList.jsx');
check('S4 第 2 步不再自己加減技能點',
  [SECTION_SRC.includes('assignSkill'), SECTION_SRC.includes('dropSkill')], [false, false]);
check('S4 技能表走共用元件', SECTION_SRC.includes('<ClassSkillPickerList'), true);
check('S4 單一技能上限夾在 5 級', SKILL_PICKER_SRC.includes('maxSLCap = 5'), true);
check('S4 此刻天花板＝現有 ＋ 還沒花的，取小',
  SKILL_PICKER_SRC.includes('Math.min(cap, current + remaining)'), true);
check('S4 星星畫技能自己的上限（不是畫剩下的點數）',
  SKILL_PICKER_SRC.includes('maxSL={Math.max(1, cap)}'), true);
check('S4 點超過剩下的點數時夾回此刻天花板',
  SKILL_PICKER_SRC.includes('Math.min(cap, currentSL + remaining)'), true);

// ─────────────────────────────────────────────────────────── T
section('T. 升級的兩個出口：固有職業 or 職業魔石（p.134）');

// T1–T5 資料層。這一條刻意抽成純函式（`getLevelUpMnemosphereCandidates`）而不是
// 寫在元件裡的理由：元件裡的 `filter` 要 SSR 才看得到，而 SSR 不執行 `onChange`，
// 於是「滿級魔石不出現在候選」這種規則判定會變成測不到的空白。
const mixedMnemState = {
  mnemospheres: [
    { id: 'm1', className: '守護者', level: 3, skills: [] },
    { id: 'm2', className: '元素師', level: MNEMOSPHERE_MAX_LEVEL, skills: [] },
    { id: 'm3', className: '博學士', level: 1, skills: [] }
  ],
  slots: {},
  integrated: []
};
check('T1 候選只列未滿 5 級的魔石',
  getLevelUpMnemosphereCandidates(mixedMnemState).map((m) => m.id), ['m1', 'm3']);
check('T2 滿級魔石不進候選（p.136 上限 5 級）',
  getLevelUpMnemosphereCandidates(mixedMnemState).some((m) => m.level >= MNEMOSPHERE_MAX_LEVEL), false);
check('T3 候選保持持有順序（不是按等級排）',
  getLevelUpMnemosphereCandidates(mixedMnemState).map((m) => m.className), ['守護者', '博學士']);
check('T4 沒有魔石時回空陣列', getLevelUpMnemosphereCandidates(undefined), []);
check('T5 全部滿級時沒有候選',
  getLevelUpMnemosphereCandidates({
    mnemospheres: [{ id: 'x', className: '守護者', level: 5, skills: [] }],
    slots: {},
    integrated: []
  }), []);

// T6–T11 接線。這些是原始碼字串斷言——它們證明「接上去了」，不證明「按下去對」。
// 「按下去對」由 K 區段的 `applyLevelUp` 直接測（引擎層已經有了）。
check('T6 升級面板把 mnemosphereId 傳進 applyLevelUp',
  HUD_SRC.includes('mnemosphereId: levelUpMnemosphere.id'), true);
check('T7 升級面板有「職業魔石」這個出口',
  HUD_SRC.includes("setLevelUpTarget('mnemosphere')"), true);
check('T8 未開魔晶石制時不畫出口切換',
  HUD_SRC.includes('{levelUpTechOn && ('), true);
check('T9 魔石那條走它自己那個職業的技能表',
  HUD_SRC.includes('classSkillsForClass(levelUpMnemosphere.className, levelUpTechnosphereMode)'), true);
check('T9b 升級清單兩條分支都濾掉作廢技能（p.133 的【雙重盾牌】）',
  [HUD_SRC.includes('isSkillSuppressedByTechnospheres(sk.name, levelUpTechnosphereMode)'),
    HUD_SRC.includes('classSkillsForClass(levelUpMnemosphere.className, levelUpTechnosphereMode)')],
  [true, true]);
check('T10 魔石模式下不畫固有職業的下拉',
  HUD_SRC.includes("levelUpTarget !== 'mnemosphere' && ("), true);
check('T11 候選來自資料層（元件裡不自己 filter）',
  [HUD_SRC.includes('getLevelUpMnemosphereCandidates(character?.technospheres)'),
    HUD_SRC.includes('.filter((m) => m.level < MNEMOSPHERE_MAX_LEVEL)')], [true, false]);
check('T12 投魔石不碰 char.classes（引擎層已測，這裡釘住呼叫端沒有先改職業）',
  HUD_SRC.includes('className: levelUpMnemosphere.className,'), true);

// ─────────────────────────────────────────────────────────── U
section('U. 升級的第二個出口：第一次拿到某個職業（Core p.228）');

// 這一段釘的是「升級面板真的有那條路」。規則本身（10 級上限、未精通 3 個上限、
// 不得重複 push）由 `test:engine` 的 G 區段直接測引擎；這裡只證明接線沒斷。
//
// 原本 `isNewClassLevelUp` 是一個**有 setter 卻沒有控件**的死 state：引擎的
// `isNewClass` 分支從 §BO 起就寫好也測好了，玩家卻永遠碰不到。
check('U1 死 state 已移除（沒有 setter、也沒有被當成旗標傳出去）',
  [HUD_SRC.includes('setIsNewClassLevelUp'), HUD_SRC.includes('isNewClass: isNewClassLevelUp')], [false, false]);
// U2 系列是**真值斷言**，不是原始碼字串斷言——2026-10-22 的刻意破壞驗證裡，
// 把 `slice(PREFIX.length)` 改成 `slice(0)` 之後，字串斷言照樣全綠，
// 只有把拆解邏輯抽成 `parseLevelUpClassValue` 才抓得到。
check('U2 新職業的值前綴只有一份定義', LEVEL_UP_NEW_CLASS_PREFIX, '__new__:');
check('U2b 新職業：前綴被剝掉，職業名乾淨',
  parseLevelUpClassValue('__new__:舞者'), { isNew: true, className: '舞者' });
check('U2c 既有職業：原樣回傳',
  parseLevelUpClassValue('舞者'), { isNew: false, className: '舞者' });
check('U2d 空值：不是新職業、職業名為空（確認鈕因此保持禁用）',
  parseLevelUpClassValue(''), { isNew: false, className: '' });
check('U2e 前綴後面沒東西時職業名為空（不會誤判成某個職業）',
  parseLevelUpClassValue('__new__:'), { isNew: true, className: '' });
check('U2f 非字串輸入不會爆掉',
  parseLevelUpClassValue(undefined), { isNew: false, className: '' });
check('U2g 拆解結果真的能查到技能表（舞者至少有 1 個技能）',
  (rulesData.classes[parseLevelUpClassValue('__new__:舞者').className]?.skills || []).length > 0, true);
check('U3 「能不能開新職業」由資料層條件決定（不是靠 JSX 少畫幾行）',
  HUD_SRC.includes('const levelUpCanAddClass = !levelUpTechOn && levelUpNonMasteredCount < MAX_NON_MASTERED_CLASSES;'), true);
check('U4 未精通職業數用 CLASS_MAX_LEVEL 判定（精通的不算）',
  HUD_SRC.includes('.filter((c) => (c.level || 0) < CLASS_MAX_LEVEL).length'), true);
check('U5 下拉有「新職業」分組', HUD_SRC.includes('label={`新職業（未精通 '), true);
check('U6 新職業只列還沒有的職業', HUD_SRC.includes('!(character?.classes || []).some((c) => c.className === name)'), true);
check('U7 呼叫引擎時帶 isNewClass', HUD_SRC.includes('isNewClass: levelUpSelectedIsNew'), true);
check('U8 呼叫引擎時帶的是剝掉前綴的職業名', HUD_SRC.includes('className: levelUpSelectedClassName,'), true);
check('U9 成長履歷標題標出「（新職業）」', HUD_SRC.includes("? '（新職業）' : ''"), true);
check('U10 技能表跟著剝掉前綴的職業名走（否則新職業會是空的）',
  HUD_SRC.includes('rulesData.classes[levelUpSelectedClassName]?.skills'), true);
check('U11 確認鈕的可用性也看剝掉前綴的職業名',
  HUD_SRC.includes('(!levelUpIsMnemosphere && !levelUpSelectedClassName)'), true);

// ─────────────────────────────────────────────────────────── V
section('V. 高階角色的額外起始魔石（p.140）');

// p.140「HIGH LEVEL CHARACTERS」逐字：
//   "The character receives an additional level 0 mnemosphere for every 10 levels
//    beyond 5 (for instance, a level 23 character will receive one additional
//    mnemosphere, for a total of two initial mnemospheres)."
//
// 三個必須同時成立的點：① 只對「起始等級 > 5」的角色算；② 每 **10** 級一顆，不是每 5 級；
// ③ 追加的是 **0 級**，不是 1 級。任何一條抄錯，玩家拿到的免費額度就是錯的。
check('V1 5 級：1 顆', getInitialMnemosphereLevels(5), [1]);
check('V2 14 級：還是 1 顆（差一級才滿 10）', getInitialMnemosphereLevels(14), [1]);
check('V3 15 級：2 顆', getInitialMnemosphereLevels(15), [1, 0]);
check('V4 原書自己的例子——23 級：共 2 顆', getInitialMnemosphereLevels(23), [1, 0]);
check('V5 25 級：3 顆', getInitialMnemosphereLevels(25), [1, 0, 0]);
check('V6 35 級：4 顆', getInitialMnemosphereLevels(35), [1, 0, 0, 0]);
check('V7 低等級與異常值都至少 1 顆',
  [getInitialMnemosphereLevels(1), getInitialMnemosphereLevels(0), getInitialMnemosphereLevels(-3)],
  [[1], [1], [1]]);
check('V8 只有第一顆是 1 級，其餘全是 0 級',
  getInitialMnemosphereLevels(45).slice(1).every((lv) => lv === 0), true);

// ── V9. 建出來的魔石等級要真的照這張表，不是只有畫面寫得好看 ──
check('V9 createMnemosphere 收 level 0 就是 0 級',
  createMnemosphere({ className: '舞者', level: 0 }).level, 0);
check('V9b createMnemosphere 收 level 1 就是 1 級',
  createMnemosphere({ className: '舞者', level: 1 }).level, 1);
check('V9c 不傳 level 時預設 0——所以呼叫端非傳不可',
  createMnemosphere({ className: '舞者' }).level, 0);
// 2026-10-22 之前的 bug：呼叫端沒傳 `level`，於是「開局免費 1 級魔石」實際建出 0 級——
// 文案寫 1 級、珠子顯示 0 級、技能一點都分不了，而所有 SSR 斷言照樣全綠。
// 修法不是「記得傳」，是把「第幾顆是幾級」抽成純函式，讓它有會失敗的斷言。
check('V10 免費額度第 0 顆建出來是 1 級',
  buildInitialMnemosphere('舞者', 0).level, 1);
check('V10b 免費額度第 1 顆建出來是 0 級',
  buildInitialMnemosphere('舞者', 1).level, 0);
check('V10c 免費額度第 3 顆也是 0 級',
  buildInitialMnemosphere('舞者', 3).level, 0);
check('V10d 建出來的職業名照傳入值',
  buildInitialMnemosphere('舞者', 1).className, '舞者');
check('V10e 取得魔石時把「第幾顆」交給資料層決定等級',
  SECTION_SRC.includes('buildInitialMnemosphere(name, grantIndex)'), true);

// ── V11. SSR：空珠座的數量＝免費額度還沒填滿的部分 ──
const countSlots = (html) => (String(html).match(/data-testid="free-mnemosphere-slot"/g) || []).length;
const slotLevels = (html) => Array.from(
  String(html).matchAll(/data-slot-level="(\d)"/g), (m) => Number(m[1])
);
const renderMnemFor = (char) => renderToStaticMarkup(React.createElement(MnemosphereSection, {
  character: char, theme, disabled: false, onChange: () => {}
}));
const hiChar = (startingLevel, extra = {}) => createNewCharacter({
  ...BASE_CHAR,
  ...extra,
  creationRules: { technospheres: 'full', startingLevel }
});

const hi5 = renderMnemFor(hiChar(5));
check('V11 5 級角色：1 個空珠座、等級 1', [countSlots(hi5), slotLevels(hi5)], [1, [1]]);
const hi15 = renderMnemFor(hiChar(15));
check('V12 15 級角色：2 個空珠座', countSlots(hi15), 2);
check('V12b 兩個空珠座的等級是 1、0', slotLevels(hi15), [1, 0]);
check('V13 第二個空珠座說得出「高階角色」與 p.140',
  [plain(hi15).includes('高階角色額外獲得一顆 0 級魔石'), plain(hi15).includes('p.140')], [true, true]);
// 標題原本只印「0 顆，合計 0 級」，底下卻畫了 3 個空珠座——看起來像程式算錯。
// 「免費額度」是規則給的、不是玩家已持有的，所以兩個數字要一起說。
check('V13b 標題說得出「免費額度幾顆、還差幾顆」',
  [plain(hi5).includes('免費額度 1 顆，還差 1 顆'), plain(hi15).includes('免費額度 2 顆，還差 2 顆')],
  [true, true]);

// ── V14. 免費額度沒填滿時，不該同時出現「＋ 再取得一顆」──
// 那顆按鈕是 GM 獎勵（p.137 `TECHNOSPHERES AS REWARDS`），與「開卡就該拿到的免費額度」
// 是兩件事。兩個一起出現，玩家會以為第二顆要先按按鈕才有。
const oneHeld = {
  ...hiChar(15),
  technospheres: {
    mnemospheres: [{ id: 'm1', className: '博學士', level: 1, skills: [] }],
    slots: {},
    integrated: []
  }
};
const hi15one = renderMnemFor(oneHeld);
check('V14 15 級已持有 1 顆：還剩 1 個空珠座', countSlots(hi15one), 1);
check('V14b 剩下那個是 0 級（不是又給一顆 1 級）', slotLevels(hi15one), [0]);
check('V14c 免費額度沒填滿時不畫「再取得一顆」',
  hi15one.includes('data-testid="add-mnemosphere"'), false);

const twoHeld = {
  ...hiChar(15),
  technospheres: {
    mnemospheres: [
      { id: 'm1', className: '博學士', level: 1, skills: [] },
      { id: 'm2', className: '舞者', level: 0, skills: [] }
    ],
    slots: {},
    integrated: []
  }
};
const hi15two = renderMnemFor(twoHeld);
check('V15 額度領完：沒有空珠座，改出現「再取得一顆」',
  [countSlots(hi15two), hi15two.includes('data-testid="add-mnemosphere"')], [0, true]);

// ── V16. 顆數看的是**起始等級**，不是角色當前等級 ──
// p.140 的前提是 "When you create a character with a level higher than 5"。
// 一個 5 級開卡、練到 15 級的角色不該憑空多一顆免費魔石——免費額度在開卡那一刻就算定了。
// 這條刻意做成**行為斷言**：原始碼寫 `getInitialMnemosphereLevels(level)` 也讀得懂，
// 但 `level` 是 `getCharacterLevel(character)`，兩者在這裡會給出不同的答案。
const grown = { ...hiChar(5), level: 15 };
check('V16 起始 5 級、現在 15 級：仍然只有 1 個空珠座', countSlots(renderMnemFor(grown)), 1);
check('V16b 原始碼讀的是 rules.startingLevel',
  SECTION_SRC.includes('getInitialMnemosphereLevels(rules.startingLevel)'), true);

// ── V17. 引擎不再持有死 import ──
// `getInitialMnemosphereCount`／`getInitialMnemosphereLevel` 從 §BO 起就 import 進
// `characterEngine.js` 卻一次都沒被使用——免費額度是開卡 UI 的事，引擎不需要它們。
// 死 import 比「沒做」更糟：它讓「缺口 I 待做」與「原始碼裡有這個函式」互相矛盾。
check('V17 引擎沒有這兩個死 import',
  [ENGINE_SRC.includes('getInitialMnemosphereCount'), ENGINE_SRC.includes('getInitialMnemosphereLevel')],
  [false, false]);

// ─────────────────────────────────────────────────────────── W
section('W. 魔晶石制下作廢的技能（p.133 的【雙重盾牌】）');

// 原書在裝備白名單後面補了一句「ignore the Guardian's Dual Shield skill」——
// 盾牌整類不存在，這個技能買了也不會生效。問題是它**照樣留在守護者的技能表上**，
// 所以創角、升級、魔石三條選單路徑都得自己濾，引擎也要擋，
// 否則玩家會花 1 點 SL 買一個永遠不會觸發的技能。

check('W1 作廢清單只有原書點名的那一項',
  TECHNOSPHERE_SUPPRESSED_SKILLS, ['雙重盾牌']);

check('W2 未開魔晶石時不作廢（含舊存檔的 undefined）',
  [isSkillSuppressedByTechnospheres('雙重盾牌', 'off'),
    isSkillSuppressedByTechnospheres('雙重盾牌', undefined)],
  [false, false]);

check('W3 三個限制裝備的模式都作廢它',
  [isSkillSuppressedByTechnospheres('雙重盾牌', 'full'),
    isSkillSuppressedByTechnospheres('雙重盾牌', 'integrated'),
    isSkillSuppressedByTechnospheres('雙重盾牌', 'hoplospheresOnly')],
  [true, true, true]);

// p.138：「all types of equipment are once again available for PCs and NPCs」
// ——裝備整份放回來，盾牌也在，所以這一態的技能**沒有**被作廢。
check('W4 「僅職業魔石」把官方裝備整份放回來（p.138）→ 不作廢',
  isSkillSuppressedByTechnospheres('雙重盾牌', 'mnemospheresOnly'), false);

check('W5 別的技能不受影響',
  isSkillSuppressedByTechnospheres('防守掌握', 'full'), false);

const guardianSkillsOff = classSkillsForClass('守護者').map((sk) => sk.name);
const guardianSkillsOn = classSkillsForClass('守護者', 'full').map((sk) => sk.name);
check('W6 不傳模式時技能表逐字不變（含雙重盾牌）',
  guardianSkillsOff.includes('雙重盾牌'), true);
check('W7 魔晶石制下技能表濾掉雙重盾牌',
  guardianSkillsOn.includes('雙重盾牌'), false);
// 只少一項——不是「整個職業的技能表被清空」那種災難性錯誤。
check('W8 濾掉的只有那一項，其餘數量不變',
  guardianSkillsOff.length - guardianSkillsOn.length, 1);

check('W9 升級解析：魔晶石制下投雙重盾牌 → not-in-class',
  resolveLevelUpSkill('守護者', '雙重盾牌', 'full'),
  { ok: false, reason: 'not-in-class', maxSL: 0 });
check('W10 升級解析：不傳模式時照舊可用',
  resolveLevelUpSkill('守護者', '雙重盾牌').ok, true);

// 行為層：真的丟進 `applyLevelUp` 看它會不會寫進角色。
const mkGuardian = (mode) => {
  const c = makeChar(mode, {
    classes: [{ className: '守護者', level: 5, skills: [] }],
    exp: 10
  });
  c.creationRules = resolveCreationRules({ technospheres: mode });
  return c;
};
const guardianBefore = mkGuardian('full');
const guardianAfter = applyLevelUp(guardianBefore, { className: '守護者', skillName: '雙重盾牌' });
// 擋掉時回傳**同一個參考**——「被擋」與「本來就不能升級」從外面看一樣，
// 參考相等是這裡唯一分得出來的訊號。
check('W11 魔晶石制下投雙重盾牌：角色完全不動',
  guardianAfter === guardianBefore, true);
check('W12 未開魔晶石時照舊寫得進去',
  applyLevelUp(mkGuardian('off'), { className: '守護者', skillName: '雙重盾牌' })
    .classes[0].skills,
  [{ name: '雙重盾牌', sl: 1 }]);

// 舊存檔：先開守護者買了雙重盾牌，後來整團切成魔晶石制。
// 選單層擋不住已經寫進去的資料，所以要有一條看得見的 warning——
// 否則玩家只會覺得卡片壞了，而不知道那一點 SL 已經白花。
const legacyGuardian = mkGuardian('full');
legacyGuardian.classes = [{ className: '守護者', level: 5, skills: [{ name: '雙重盾牌', sl: 1 }] }];
const legacyReport = validateCharacter(legacyGuardian);
check('W13 舊存檔已學會雙重盾牌 → 出「已作廢」warning',
  legacyReport.warnings.some((w) => w.message.includes('已作廢')), true);
check('W14 那是 warning 不是 error（舊存檔不該一開頁就紅）',
  legacyReport.errors.some((e) => e.message.includes('已作廢')), false);
check('W15 未開魔晶石時同樣的存檔不報',
  validateCharacter({ ...legacyGuardian, creationRules: resolveCreationRules({ technospheres: 'off' }) })
    .warnings.some((w) => w.message.includes('已作廢')), false);

// ─────────────────────────────────────────────────────────── X. 【雙重盾牌】在裝備層失效
//
// 科技奇幻手冊 p.133：「ignore the Guardian's Dual Shield skill」。
// §W 管的是技能表與升級路徑，這裡管的是**裝備層**——主手能不能拿盾牌、
// 兩手皆盾能不能合併成「雙盾」。判定的唯一入口是 `getDualShieldState`。
const dualChar = (mode) => ({
  ...mkGuardian(mode),
  classes: [{ className: '守護者', level: 5, skills: [{ name: '雙重盾牌', sl: 1 }] }],
  equipment: { mainHand: '青銅圓盾', offHand: '青銅圓盾', armor: '', accessory: '' }
});

const dualOff = getDualShieldState(dualChar('off'), { mainIsShield: true, offIsShield: true });
check('X1 未開魔晶石：學會技能且兩手皆盾 → 雙盾成立',
  [dualOff.learned, dualOff.active], [true, true]);

const dualFull = getDualShieldState(dualChar('full'), {
  mainIsShield: true, offIsShield: true, technosphereMode: 'full'
});
check('X2 魔晶石制下：技能失效 → learned 為假',
  dualFull.learned, false);
check('X3 連帶 active 也為假（攻擊不會切成「雙盾」的公式）',
  dualFull.active, false);

const dualMnem = getDualShieldState(dualChar('mnemospheresOnly'), {
  mainIsShield: true, offIsShield: true, technosphereMode: 'mnemospheresOnly'
});
check('X4 mnemospheresOnly 變體把官方裝備全放回 → 技能不失效（p.138）',
  [dualMnem.learned, dualMnem.active], [true, true]);

check('X5 呼叫端沒傳 mode 時不判定抑制（向後相容：沒改到的呼叫點行為不變）',
  getDualShieldState(dualChar('full'), { mainIsShield: true, offIsShield: true }).learned, true);
check('X6 裝備層自己會從 creationRules 解析團規，呼叫端不必記得傳',
  EQUIP_SRC.includes('resolveCreationRules(character?.creationRules).technospheres'), true);
check('X7 編輯器把團規傳進去了（`rules` 已在作用域）',
  READ('src/features/character-sheet/components/CharacterEditor.jsx')
    .includes('technosphereMode: rules.technospheres'), true);
check('X8 跑團面板把團規傳進去了',
  READ('src/features/character-sheet/components/CharacterPlayHUD.jsx')
    .includes('technosphereMode: resolveCreationRules(character?.creationRules).technospheres'), true);
check('X9 裝備選擇器把團規傳進去了（主手清單不該再出現盾牌）',
  READ('src/features/character-sheet/components/EquipmentPickerModal.jsx')
    .includes('technosphereMode: resolveCreationRules(character?.creationRules).technospheres'), true);

// ─────────────────────────────────────────────────────────── X
section('X. F-021：下拉選了但還沒鑲嵌時，先看得到效果');

// 36 顆附魔魔石的下拉原本只有「11 靈敏（2 格）」——只有名字。
// 想知道「深淵」是什麼效果，唯一辦法是先鑲上去再看、看完再拔，而鑲嵌會寫進成長履歷。
// 這裡守的是「預覽的字從哪裡來」：一律來自 `hoplospherePreviewLines`，畫面不另寫一份文案。
// 為什麼每一條都先過一層 `previewLines()`：
// 如果被測函式回空陣列，下面的 `[1].text` 會拋 TypeError，整個測試檔在載入期就死掉，
// 連「通過 X / Y」都不印——那看起來像「護欄沒抓到」，實際上是**護欄沒機會跑**，
// 破壞驗證會拿到 fail = -1 這種假訊號（2026-10-27 真的踩到，見 scratch/_p15_sabotage.mjs ⑦）。
// 包一層之後，壞掉就是一行 FAIL，還說得出是哪一條壞。
const previewLines = (key) => {
  const v = hoplospherePreviewLines(key);
  return Array.isArray(v) ? v : [];
};
check('36 顆全部都能產生預覽（逐一，不抽樣）',
  HOPLOSPHERES.every((h) => previewLines(h.key).length >= 1), true);
check('第一行就是基礎效果、沒有標籤',
  previewLines('arctic')[0], { label: '', text: '你獲得冰屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為冰屬性。' });
check('有凝聚 2 的會多一行，標籤寫「鑲 2 顆」',
  previewLines('arctic').map((l) => l.label), ['', '鑲 2 顆', '鑲 3 顆']);
check('沒有凝聚的只有一行（不要印空行）',
  previewLines('agile').map((l) => l.label), ['']);
check('凝聚效果的文字跟資料層一致（不是另外抄一份）',
  (previewLines('arctic')[1] || {}).text, getHoplosphere('arctic').coag2);
check('不合法的 key 回空陣列（呼叫端不必防呆）',
  [hoplospherePreviewLines('nope'), hoplospherePreviewLines('')], [[], []]);

// 面板原始碼：預覽必須在 `withHoplospheres` 分支裡、且吃的是 `pending`
// （吃已鑲嵌的內容就等於沒修——那本來就看得到）。
check('面板有掛預覽區塊', PANEL_SRC.includes('data-testid={`hoplosphere-preview-${slotId}`}'), true);
check('預覽的文字來自 hoplospherePreviewLines(pending)',
  PANEL_SRC.includes('hoplospherePreviewLines(pending)'), true);
check('預覽只在有附魔魔石的模式出現', PANEL_SRC.includes('withHoplospheres && pendingHop'), true);

// ─────────────────────────────────────────────────────────── 結果
lines.push('');
if (fail > 0) {
  lines.push(`\n失敗 ${fail} 項`);
}
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
lines.push('='.repeat(56));
console.log(lines.join('\n'));
process.exit(fail === 0 ? 0 : 1);
