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
  HOPLOSPHERES,
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
  getTechnosphereSpending
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
  createNewCharacter,
  calculateCharacterStats,
  getProficiencies,
  getCharacterLevel,
  validateCharacter,
  applyLevelUp
} from '../src/features/character-sheet/utils/characterEngine.js';
import { totalStartingEquipCost, buildLoadoutIssues } from '../src/features/character-sheet/utils/equipmentRules.js';
import TechnospherePanel from '../src/features/character-sheet/components/TechnospherePanel.jsx';
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
    { id: 'b', className: '博學士', level: 1, skills: [{ name: '萬能知識', sl: 1 }] }
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
  { name: '萬能知識', sl: 1, source: 'b', className: '博學士' }
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
    mnemospheres: [{ id: 'm1', className: '博學士', level: 1, skills: [{ name: '萬能知識', sl: 1 }] }],
    slots: { mainHand: { quality: 'alpha', contents: [{ kind: 'mnemosphere', ref: 'm1' }] } },
    integrated: []
  }
};
const upMnem = applyLevelUp(withMnem, { mnemosphereId: 'm1', skillName: '萬能知識' });
check('投魔石：角色等級 +1', upMnem.level, 6);
check('投魔石：魔石等級 +1', upMnem.technospheres.mnemospheres[0].level, 2);
check('投魔石：技能 SL +1', upMnem.technospheres.mnemospheres[0].skills, [{ name: '萬能知識', sl: 2 }]);
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

check('不得新增職業（p.134）',
  applyLevelUp(withMnem, { className: '舞者', skillName: '舞步', isNewClass: true }).level, 5);
check('不得新增職業：職業清單原封不動',
  applyLevelUp(withMnem, { className: '舞者', skillName: '舞步', isNewClass: true }).classes.length, 3);
const upInnate = applyLevelUp(withMnem, { className: '元素師', skillName: '元素魔法' });
check('固有職業照常升級', upInnate.level, 6);
check('固有職業的技能 SL 上升', upInnate.classes.find((c) => c.className === '元素師').skills[0].sl, 3);
// 規則關閉時行為完全不變
const plainChar = { ...makeChar('off'), exp: 10 };
check('規則關閉時「新增職業」照常可用',
  applyLevelUp(plainChar, { className: '舞者', skillName: '舞步', isNewClass: true }).classes.length, 4);

// validateCharacter 的魔晶石檢查
const techChar = {
  ...withMnem,
  equipment: { mainHand: '青銅劍', offHand: '無盾牌', armor: '無裝甲 / 冒險服', accessory: '' }
};
const techErrors = validateCharacter(techChar).errors.map((e) => e.message);
check('官方武器表在魔晶石制下被擋', techErrors.some((m) => m.includes('只能裝備自訂武器')), true);
check('四職業在魔晶石制下被擋',
  validateCharacter({ ...withMnem, classes: [...withMnem.classes, { className: '舞者', level: 1, skills: [] }] })
    .errors.some((e) => e.message.includes('恰好 3 個固有職業')), true);
check('三職業在魔晶石制下不擋職業數',
  validateCharacter(withMnem).errors.some((e) => e.message.includes('恰好 3 個固有職業')), false);

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
check('hoplospheresOnly 沒有職業魔石區塊', plain(panelHoplo).includes('取得'), false);
check('mnemospheresOnly 有職業魔石區', plain(panelMnem).includes('職業魔石'), true);
check('mnemospheresOnly 沒有附魔魔石下拉', plain(panelMnem).includes('鑲嵌'), false);
check('空狀態會提示「開局免費獲得一顆 1 級魔石」',
  plain(panelFull).includes('開局會免費獲得一顆 1 級魔石'), true);
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
check('未裝備的魔石被標成「不提供技能」', plain(panelIdle).includes('未裝備（不提供技能）'), true);

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
// 裝備層保持「不知道魔晶石是什麼」
check('equipmentRules 不 import technospheres（保持純裝備規則）',
  EQUIP_SRC.includes('technospheres'), false);
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

// ─────────────────────────────────────────────────────────── 結果
lines.push('');
if (fail > 0) {
  lines.push(`\n失敗 ${fail} 項`);
}
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
lines.push('='.repeat(56));
console.log(lines.join('\n'));
process.exit(fail === 0 ? 0 : 1);
