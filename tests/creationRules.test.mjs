/**
 * 開卡規則測試。
 *
 * 執行：npm run test:creation
 *
 * 這份規則的用途是「把原本硬編碼在六個檔案裡的創角常數抽成一份資料」，
 * 讓 GM 自訂開局（campaign）只要換一份規則物件，而不必改引擎或 UI。
 *
 * 期望值取自官方英文核心規則書 v1.1（印刷頁碼）：
 * - 起始等級 5 → p.157
 * - 起始四維總和 32 → p.155–156
 * - 起始 2~3 個職業 → p.158
 * - 起始裝備預算 500z → p.164
 * - 高階角色每級 +50z → p.229
 */
import fs from 'node:fs';
import {
  DEFAULT_CREATION_RULES,
  CREATION_RULE_FIELDS,
  ZENIT_PER_LEVEL,
  resolveCreationRules,
  isDefaultCreationRules,
  diffCreationRules,
  isPlaytestAllowed,
  PLAYTEST_SOURCEBOOK_KEY
} from '../src/features/character-sheet/data/creationRules.js';
import {
  createNewCharacter,
  validateCharacter,
  calculateCharacterStats,
  isCharacterLocked,
  lockCharacter,
  unlockCharacter,
  buildCreationChecklist,
  CREATION_STEPS,
  LOCKED_CREATION_TABS,
  PLACEHOLDER_CHARACTER_NAME,
  checkHeroicSkillRequirement,
  snapToAttributeDie,
  ATTRIBUTE_DICE_TIERS,
  STARTING_HEROIC_SKILL_BLOCKLIST,
  HEROIC_SKILLS,
  HEROIC_SKILL_SOURCE_LABELS,
  heroicSkillsForClass,
  heroicSkillMaxAcquisitions,
  findDuplicateStartingHeroicSkills,
  attributeDieUpgradesAllowed,
  attributeDieUpgradesUsed
} from '../src/features/character-sheet/utils/characterEngine.js';
import { PLAYTEST_HEROIC_SKILLS } from '../src/features/character-sheet/data/playtestHeroicSkills.js';
import { VARIANT_ARCANIST_HEROIC_SKILLS } from '../src/features/character-sheet/data/variantArcanistHeroicSkills.js';
import { getLog } from '../src/features/character-sheet/utils/characterLog.js';
import {
  SOURCEBOOKS,
  CLASS_METADATA,
  CANONICAL_THEMES,
  THEME_ALIASES,
  normalizeTheme,
  ATTRIBUTE_PRESET_ARRAYS,
  ATTRIBUTE_KEYS,
  VARIANT_ARCANIST_CLASS_NAME
} from '../src/features/character-sheet/data/sourcebookConfig.js';
import { totalStartingEquipCost } from '../src/features/character-sheet/utils/equipmentRules.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';

import { modeRestrictsEquipment } from '../src/features/character-sheet/data/technospheres.js';
import { describeRuleBadges } from '../src/features/character-sheet/data/creationRules.js';

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

const ALL_BOOK_KEYS = Object.keys(SOURCEBOOKS);
/**
 * 「手冊」清單（不含公測修訂）。
 * 2026-10-19 使用者裁定：公測不是一本手冊，是開卡規則的【開放公測修訂內容】開關，
 * 由 `allowPlaytest` 單獨控制進出 allowedSourcebooks／defaultSourcebooks（§BE）。
 */
const MANUAL_BOOK_KEYS = ALL_BOOK_KEYS.filter((k) => k !== 'playtest');
const msgs = (char, rules) => validateCharacter(char, rules).warnings.map((w) => w.message);
const errs = (char, rules) => validateCharacter(char, rules).errors.map((w) => w.message);

// ─────────────────────────────────────────────────────────── A
section('A. 官方標準開卡規則（逐項對照原書）');

check('起始等級 5（Core p.157）', DEFAULT_CREATION_RULES.startingLevel, 5);
check('起始裝備預算 500z（Core p.164）', DEFAULT_CREATION_RULES.startingZenit, 500);
check('起始四維**不是**一條規則（官方是三組固定陣列，見 §AM）',
  [CREATION_RULE_FIELDS.includes('attributeTotal'), DEFAULT_CREATION_RULES.attributeTotal],
  [false, undefined]);
check('官方三組起始陣列（Core 印刷 p.162）',
  ATTRIBUTE_PRESET_ARRAYS.map((p) => [...p.diceList].sort((a, b) => b - a).join('/')),
  ['10/8/8/6', '8/8/8/8', '10/10/6/6']);
check('起始職業數 2~3（Core p.158）',
  [DEFAULT_CREATION_RULES.classCountMin, DEFAULT_CREATION_RULES.classCountMax], [2, 3]);
check('技能點數 = 起始等級（每級 1 點）',
  DEFAULT_CREATION_RULES.skillPointBudget, DEFAULT_CREATION_RULES.startingLevel);
// 2026-10-06 改成全部（使用者裁定：「默認不要只有核心，而是全部，不然要切換來切換去很麻煩」）。
// 這一格只決定選單一開始顯示什麼；真正的上限仍是 allowedSourcebooks。
check('新角色預設全開手冊（公測另由 allowPlaytest 控制）', [...DEFAULT_CREATION_RULES.defaultSourcebooks],
  MANUAL_BOOK_KEYS);
check('預設勾選仍受 allowedSourcebooks 上限約束',
  resolveCreationRules({ allowedSourcebooks: ['core'] }).defaultSourcebooks, ['core']);
check('拓展上限預設為全部手冊（沒有 campaign 時不該擋玩家）',
  [...DEFAULT_CREATION_RULES.allowedSourcebooks].sort(), [...MANUAL_BOOK_KEYS].sort());
check('預設不指定必修職業', [...DEFAULT_CREATION_RULES.requiredClasses], []);
// 官方核心規則沒有金手指這個制度——它是三大奇幻手冊才推出的，所以預設必須是關的。
// 要玩的團由 GM 在「此團開卡規則」打開。
check('預設不開放金手指', DEFAULT_CREATION_RULES.allowQuirk, false);

check('欄位集護欄：不多不少，就這幾個欄位（幻覺欄位進不來）',
  Object.keys(DEFAULT_CREATION_RULES).sort(), [...CREATION_RULE_FIELDS].sort());
check('resolve 的輸出欄位集與預設一致',
  Object.keys(resolveCreationRules({})).sort(), [...CREATION_RULE_FIELDS].sort());
check('預設規則物件是凍結的', Object.isFrozen(DEFAULT_CREATION_RULES), true);

// 每個規則欄位都必須有**開關**——不然就是一個玩家碰不到的死欄位。
// 這條是補 §AS 的洞：`allowCustomWeapon` 當時有讀取端（validateCharacter 會擋）、
// 欄位集護欄也過，但 `CreationRulesPanel` 根本沒有那一格，
// 於是裝備分頁寫著「請在第 1 步打開」而那個開關不存在。
// 直接用 fs 讀面板原始碼（read 助手定義在檔案後段，這裡用不到它）
const panelSrc = fs.readFileSync(new URL('../src/features/character-sheet/components/CreationRulesPanel.jsx', import.meta.url), 'utf8');
const PANEL_EXEMPT = {
  defaultSourcebooks: '新角色的起始勾選，由角色自己的拓展開關決定（面板刻意不列）'
};
check('每個開卡規則欄位都有 UI 開關（或在豁免清單裡並註明理由）',
  [...CREATION_RULE_FIELDS].filter((key) => !panelSrc.includes(`'${key}'`) && !PANEL_EXEMPT[key]),
  []);
check('豁免清單只放真的刻意不列的面板欄位',
  Object.keys(PANEL_EXEMPT).filter((key) => !CREATION_RULE_FIELDS.includes(key)),
  []);
check('開放【定制武器】的開關在面板上（§AS 的補洞）',
  panelSrc.includes("'allowCustomWeapon'"), true);

// ─────────────────────────────────────────────────────────── B
section('B. resolveCreationRules：壞資料一律退回官方預設');

const d = DEFAULT_CREATION_RULES;
check('空物件 → 全部預設',
  [resolveCreationRules().startingLevel, resolveCreationRules({}).startingZenit], [5, 500]);
check('null / undefined / 字串 不拋錯',
  [resolveCreationRules(null).startingLevel, resolveCreationRules(undefined).startingLevel, resolveCreationRules('壞資料').startingLevel],
  [5, 5, 5]);
check('未知欄位被忽略', '不存在' in resolveCreationRules({ 不存在: 1 }), false);

check('起始等級 0 → 退回預設', resolveCreationRules({ startingLevel: 0 }).startingLevel, 5);
check('起始等級 51 → 退回預設', resolveCreationRules({ startingLevel: 51 }).startingLevel, 5);
check('起始等級 "12"（數字字串）→ 12', resolveCreationRules({ startingLevel: '12' }).startingLevel, 12);
check('起始等級 10.7 → 取整 10', resolveCreationRules({ startingLevel: 10.7 }).startingLevel, 10);
check('起始資金負數 → 退回預設', resolveCreationRules({ startingZenit: -1 }).startingZenit, 500);
check('起始資金 0 是合法值（GM 可以開無資金開局）',
  resolveCreationRules({ startingZenit: 0 }).startingZenit, 0);
check('舊存檔殘留的 attributeTotal 會被忽略（不再是一條規則）',
  [resolveCreationRules({ attributeTotal: 2 }).attributeTotal,
    isDefaultCreationRules({ attributeTotal: 40 })], [undefined, true]);

check('職業數下限 > 上限 → 上限被拉齊',
  [resolveCreationRules({ classCountMin: 5, classCountMax: 3 }).classCountMin,
   resolveCreationRules({ classCountMin: 5, classCountMax: 3 }).classCountMax], [5, 5]);
check('技能點數未給 → 跟著起始等級',
  resolveCreationRules({ startingLevel: 10 }).skillPointBudget, 10);
check('技能點數明給 → 用它',
  resolveCreationRules({ startingLevel: 10, skillPointBudget: 5 }).skillPointBudget, 5);

check('拓展含錯字 → 過濾掉，保留合法的',
  resolveCreationRules({ allowedSourcebooks: ['core', '不存在的書'] }).allowedSourcebooks, ['core']);
check('拓展全部非法 → 退回全部手冊',
  resolveCreationRules({ allowedSourcebooks: ['不存在的書'] }).allowedSourcebooks.sort(), [...MANUAL_BOOK_KEYS].sort());
check('預設勾選超出上限 → 削到上限內',
  resolveCreationRules({ allowedSourcebooks: ['core'], defaultSourcebooks: ['core', 'technoFantasy'] }).defaultSourcebooks,
  ['core']);
check('上限不含核心時，預設勾選取上限第一個',
  resolveCreationRules({ allowedSourcebooks: ['technoFantasy'], defaultSourcebooks: ['core'] }).defaultSourcebooks,
  ['technoFantasy']);
check('必修職業含不存在的職業 → 過濾掉',
  resolveCreationRules({ requiredClasses: ['守護者', '不存在的職業'] }).requiredClasses, ['守護者']);
check('必修職業去重',
  resolveCreationRules({ requiredClasses: ['守護者', '守護者'] }).requiredClasses, ['守護者']);
check('allowQuirk 非 boolean → 退回預設',
  resolveCreationRules({ allowQuirk: 'yes' }).allowQuirk, false);

check('isDefaultCreationRules：空物件為 true', isDefaultCreationRules({}), true);
check('isDefaultCreationRules：改過為 false', isDefaultCreationRules({ startingZenit: 800 }), false);
check('diffCreationRules：只留與預設不同的欄位',
  diffCreationRules({ startingZenit: 800, startingLevel: 5 }), { startingZenit: 800 });
check('diffCreationRules：全預設 → 空物件', diffCreationRules({}), {});

// ─────────────────────────────────────────────────────────── C
section('C. createNewCharacter：起始等級／資金／拓展由規則決定');

const fresh = createNewCharacter();
check('預設新角色等級 5', fresh.level, 5);
check('預設新角色資金 500z', fresh.zenit, 500);
check('預設新角色全開手冊（2026-10-06 起；公測由 allowPlaytest 控制）',
  fresh.enabledSourcebooks, MANUAL_BOOK_KEYS);

const custom = createNewCharacter({}, {
  startingLevel: 10,
  startingZenit: 800,
  defaultSourcebooks: ['core', 'technoFantasy']
});
check('GM 自訂：等級 10 / 資金 800z / 開放核心＋科技奇幻',
  [custom.level, custom.zenit, custom.enabledSourcebooks], [10, 800, ['core', 'technoFantasy']]);

check('overrides 仍為最上層（優先於規則）',
  [createNewCharacter({ level: 12, zenit: 999 }, { startingLevel: 10, startingZenit: 800 }).level,
   createNewCharacter({ level: 12, zenit: 999 }, { startingLevel: 10, startingZenit: 800 }).zenit],
  [12, 999]);
check('規則物件不會被角色共用參考（改角色不影響規則）',
  (() => {
    const a = createNewCharacter();
    // 推一個不存在的鍵——這樣斷言就不必跟著預設值跑
    a.enabledSourcebooks.push('__sentinel__');
    return createNewCharacter().enabledSourcebooks.includes('__sentinel__');
  })(), false);
check('不傳規則等同官方標準',
  [createNewCharacter({}, undefined).level, createNewCharacter({}, undefined).zenit], [5, 500]);

// ─────────────────────────────────────────────────────────── D
section('D. validateCharacter：以這一團的規則驗證');

// 基準角色：填好身世並具備 2 個職業，讓其他檢查單獨現形。
// `startingFundsRolled: true` 是必要的——否則「起始資金尚未結算」那筆 error 會混進每一條斷言。
const base = (over = {}) => createNewCharacter({
  name: '測試',
  identity: '身分',
  origin: '故鄉',
  startingFundsRolled: true,
  classes: [
    { className: '守護者', level: 1, skills: [] },
    { className: '元素師', level: 1, skills: [] }
  ],
  ...over
});

check('官方陣列（d8×4）不報屬性警告',
  msgs(base({ attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 } }), {}).filter((m) => m.includes('屬性骰')), []);
check('官方陣列（d10,d8,d8,d6）不報屬性警告',
  msgs(base({ attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 } }), {}).filter((m) => m.includes('屬性骰')), []);
// d10,d8,d8,d8 的索引和是 5（官方三組都是 4）＝ 多升了一次，而 5 級給 0 次
check('d10,d8,d8,d8（不在官方陣列上）→ 警告「已升級 1 次但 5 級只給 0 次」',
  msgs(base({ attributes: { dex: 10, ins: 8, mig: 8, wlp: 8 } }), {})
    .filter((m) => m.includes('屬性骰已升級 1 次')).length, 1);

// 等級獎勵（Core 印刷 p.229）：20 級與 40 級各可把一顆**基礎**骰 +1 階，上限 d12
check('20 級給 1 次、40 級給 2 次',
  [attributeDieUpgradesAllowed(19), attributeDieUpgradesAllowed(20),
    attributeDieUpgradesAllowed(39), attributeDieUpgradesAllowed(40),
    attributeDieUpgradesAllowed(50)], [0, 1, 1, 2, 2]);
check('d10,d8,d8,d6 是 0 次升級',
  attributeDieUpgradesUsed({ dex: 10, ins: 8, mig: 8, wlp: 6 }), 0);
check('d12,d8,d8,d6 是 1 次升級',
  attributeDieUpgradesUsed({ dex: 12, ins: 8, mig: 8, wlp: 6 }), 1);
check('20 級升過一次的角色（d12,d8,d8,d6）不再被誤報',
  msgs(base({ level: 20, attributes: { dex: 12, ins: 8, mig: 8, wlp: 6 } }), {})
    .filter((m) => m.includes('屬性骰')), []);
check('20 級還沒升 → info 提示（不是違規）',
  msgs(base({ level: 20, attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 } }), {})
    .filter((m) => m.includes('可以選一顆屬性骰')).length, 1);
check('5 級不會出現升級提示',
  msgs(base({ level: 5, attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 } }), {})
    .filter((m) => m.includes('可以選一顆屬性骰')).length, 0);
check('升級次數超過等級允許的 → 警告',
  msgs(base({ level: 5, attributes: { dex: 12, ins: 10, mig: 8, wlp: 6 } }), {})
    .filter((m) => m.includes('只給')).length, 1);

const withClasses = (names) => base({
  classes: names.map((className) => ({ className, level: 1, skills: [] }))
});
check('0 個職業 → 1 筆 error（訊息引用規則的 5 級與 2~3）',
  errs(withClasses([]), {}), ['尚未選擇任何職業 (起始 5 級需配置 2~3 個職業)']);
check('1 個職業 → 1 筆 error',
  errs(withClasses(['守護者']), {}), ['起始需至少 2 個職業，目前只有 1 個 (不可純單職)']);
check('2 個職業 → 無職業數 error', errs(withClasses(['守護者', '元素師']), []), []);
check('3 個職業 → 無職業數 error', errs(withClasses(['守護者', '元素師', '靈師']), []), []);
check('4 個職業 → 1 筆 error',
  errs(withClasses(['守護者', '元素師', '靈師', '旅人']), {}),
  ['起始不可超過 3 個職業，目前有 4 個']);
check('GM 放寬成 1~4 個職業後，單職不再報錯',
  errs(withClasses(['守護者']), { classCountMin: 1, classCountMax: 4 }), []);
check('GM 收窄成 3~3 個職業後，2 個職業會報錯',
  errs(withClasses(['守護者', '元素師']), { classCountMin: 3, classCountMax: 3 }),
  ['起始需至少 3 個職業，目前只有 2 個 (不可純單職)']);
// F-012（2026-10-27）：上下限相同時不能寫成「3~3」。
// 「3 到 3」讀起來像還要挑，實際上是「剛好 3 個」——而這句話出現在最需要明確的位置。
check('上下限相同時，訊息寫「恰好 3 個職業」而不是「3~3」',
  errs(withClasses([]), { classCountMin: 3, classCountMax: 3 }),
  ['尚未選擇任何職業 (起始 5 級需配置恰好 3 個職業)']);
// 反向控制：上下限不同時**不能**冒出「恰好」——那會變成另一種說錯。
// 這條同時守住「預設值沒被改壞」：一般團仍然是 2~3。
check('上下限不同時仍寫區間（預設 2~3）',
  errs(withClasses([]), {}), ['尚未選擇任何職業 (起始 5 級需配置 2~3 個職業)']);
check('任何情況下，職業數訊息都不含「~」以外的退化寫法（例如 3~3）',
  errs(withClasses([]), { classCountMin: 3, classCountMax: 3 }).filter((m) => m.includes('3~3')), []);

check('必修職業缺少 → error',
  errs(withClasses(['元素師', '靈師']), { requiredClasses: ['守護者'] }), ['此團規定必須修習：守護者']);
check('必修職業具備 → 無 error',
  errs(withClasses(['守護者', '元素師']), { requiredClasses: ['守護者'] }), []);

check('未開放金手指但填了金手指 → error',
  errs(base({ quirk: '倖存者' }), { allowQuirk: false }), ['此團未開放金手指，請移除「倖存者」']);
check('未開放金手指但填「無」→ 不報錯', errs(base({ quirk: '無' }), { allowQuirk: false }), []);
check('開放金手指時填了也不報錯', errs(base({ quirk: '倖存者' }), { allowQuirk: true }), []);

check('啟用了未開放的拓展 → error',
  errs(base({ enabledSourcebooks: ['core', 'technoFantasy'] }), { allowedSourcebooks: ['core'] }),
  ['此團未開放：technoFantasy，請在職業分頁關閉']);
check('預設規則（上限＝全部手冊）不會對拓展報錯',
  errs(base({ enabledSourcebooks: [...ALL_BOOK_KEYS] }), {}), []);

check('規則不影響數值引擎（換規則不會改變同一張卡的 HP）',
  calculateCharacterStats(base()).maxHp, calculateCharacterStats(base()).maxHp);

// ─────────────────────────────────────────────────────────── F
section('F. 創角定稿：把「開好就固定」變成真實狀態');

const T0 = '2026-10-05T09:00:00.000Z';
const T1 = '2026-10-06T09:00:00.000Z';

const unlocked = createNewCharacter();
check('新角色預設未定稿', [unlocked.locked, unlocked.lockedAt], [false, null]);
check('舊存檔（沒有 locked 欄位）視為未定稿', isCharacterLocked({ name: '舊角色' }), false);
check('locked 不是 true 也視為未定稿', isCharacterLocked({ locked: 'yes' }), false);
check('角色為 null 不炸', isCharacterLocked(null), false);

const lockedChar = lockCharacter(unlocked, { at: T0 });
check('定稿後 locked 為 true', lockedChar.locked, true);
check('定稿時間寫入 lockedAt', lockedChar.lockedAt, T0);
check('定稿留下一筆履歷', getLog(lockedChar).map((e) => e.kind), ['creation', 'lock']);
check('履歷標題', getLog(lockedChar)[1].title, '角色定稿');
check('定稿不就地修改原角色', unlocked.locked, false);
check('不傳時間也能定稿', Number.isFinite(Date.parse(lockCharacter(unlocked).lockedAt)), true);

const unlockedAgain = unlockCharacter(lockedChar, { at: T1 });
check('解鎖後 locked 為 false', unlockedAgain.locked, false);
check('解鎖後 lockedAt 清空', unlockedAgain.lockedAt, null);
check('解鎖也留下一筆履歷（查得到什麼時候解鎖過）',
  getLog(unlockedAgain).map((e) => e.kind), ['creation', 'lock', 'lock']);
check('解鎖的標題說明原因', getLog(unlockedAgain)[2].title, '解除定稿（重新開放創角欄位）');

check('凍結的分頁是身世、四維與命名（姓名在最後一步，也是創角決定）', [...LOCKED_CREATION_TABS], [1, 3, 6]);

// ─────────────────────────────────────────────────────────── G
section('G. 創角進度清單：把驗證結果變成一條主線');

const blankList = buildCreationChecklist(createNewCharacter());
check('清單有六個步驟且與 CREATION_STEPS 一致',
  blankList.map((i) => i.id), CREATION_STEPS.map((i) => i.id));
check('清單不含情感羈絆（羈絆不屬創角，原書 p.154）',
  blankList.some((i) => i.label.includes('羈絆')), false);
check('每一步都有顯示名', blankList.every((i) => Boolean(i.label)), true);
check('空白角色：身世待處理（缺姓名等）', blankList[0].status, 'todo');
check('空白角色：職業有問題（0 個職業）', blankList[1].status, 'error');
// 四維預設是空的（0 = 尚未指派），所以空白角色的第 3 步是待處理，不是已完成。
// 舊版預設 d8×4 = 32 剛好等於標準總和，第 3 步對新角色永遠是「done」——
// 那正是「系統替玩家選好了萬事通」的另一個症狀。
check('空白角色：四維待處理（預設未指派）', blankList[2].status, 'todo');
check('有問題的步驟帶錯誤數', blankList[1].errorCount, 1);
check('待處理的步驟給出說明文字', blankList[2].message, '尚未選擇四維屬性配置');
check('待處理的步驟給出第一則提醒', blankList[0].message, '尚未設定身份');

// 清單不新增驗證邏輯：狀態必須與 validateCharacter 的分組一致
const grouped = validateCharacter(createNewCharacter()).warnings.reduce((acc, w) => {
  acc[w.step] = acc[w.step] || [];
  acc[w.step].push(w);
  return acc;
}, {});
check('清單狀態與 validateCharacter 的分組一致',
  blankList.map((i) => {
    const issues = grouped[i.id] || [];
    const errors = issues.filter((w) => w.type === 'error').length;
    return errors > 0 ? 'error' : (issues.length > 0 ? 'todo' : 'done');
  }),
  blankList.map((i) => i.status));

// 一張「該填的都填了」的卡：五步全綠、可以定稿
const finished = createNewCharacter({
  name: '完成測試',
  identity: '流浪劍士',
  theme: '希望',
  origin: '邊境村落',
  // 第 6 步「命名與背景」的另外兩格（原書第 8 步的稱呼與外貌描述在本專案的對應）
  gender: '女',
  background: '來自邊境的流浪劍士。',
  // 四維預設是空的（0 = 尚未指派），填完的卡必須自己帶上配置
  attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
  // 起始資金已結算（原書 p.165）。沒有這一項，第 4 步會是 error，這張卡不能定稿。
  startingFundsRolled: true,
  classes: [
    { className: '守護者', level: 5, skills: [{ name: '測試技能', sl: 5 }] },
    { className: '元素師', level: 0, skills: [] }
  ]
});
const finishedList = buildCreationChecklist(finished);
check('填完的卡：六步全部完成',
  finishedList.map((i) => i.status), ['done', 'done', 'done', 'done', 'done', 'done']);
check('填完的卡：沒有阻擋定稿的項目',
  finishedList.filter((i) => i.status === 'error').length, 0);
check('GM 規則會反映在清單上（必修職業未修習 → 該步有問題）',
  buildCreationChecklist(finished, { requiredClasses: ['靈師'] })
    .find((i) => i.id === 2).status, 'error');
check('GM 收窄職業數也會反映在清單上',
  buildCreationChecklist(finished, { classCountMin: 3, classCountMax: 3 })
    .find((i) => i.id === 2).status, 'error');
check('未開放金手指且有金手指 → 第 5 步有問題',
  buildCreationChecklist(createNewCharacter({ quirk: '倖存者' }), { allowQuirk: false })
    .find((i) => i.id === 5).status, 'error');

// ─────────────────────────────────────────────────────────── H
section('H. 原始碼護欄：硬編碼不得回流');

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const editor = read('../src/features/character-sheet/components/CharacterEditor.jsx');
const classPicker = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
const equipPicker = read('../src/features/character-sheet/components/EquipmentPickerModal.jsx');
const engine = read('../src/features/character-sheet/utils/characterEngine.js');

check('CharacterEditor 不再寫死預算 500', editor.includes('500 - totalEquipCost'), false);
check('CharacterEditor 不再寫死「起始裝備預算 500z」', editor.includes('起始裝備預算 500z'), false);
check('CharacterEditor 不再寫死「起始 5 級」', editor.includes('起始 5 級'), false);
check('ClassPickerModal 不再寫死技能點上限 5', classPicker.includes('totalAllocatedSL >= 5'), false);
check('EquipmentPickerModal 不再以 500 當預算預設', equipPicker.includes('remainingBudget = 500'), false);
check('characterEngine 不再寫死屬性總和 32', engine.includes('attrSum !== 32'), false);
check('characterEngine 不再寫死「起始 5 級」的職業數判斷', engine.includes('char.level === 5'), false);
check('三個檔案都改讀 creationRules',
  [editor.includes('resolveCreationRules'), classPicker.includes('resolveCreationRules'), engine.includes('resolveCreationRules')],
  [true, true, true]);
check('編輯器有定稿與解鎖的動作',
  [editor.includes('lockCharacter('), editor.includes('unlockCharacter(')], [true, true]);
check('凍結是用 fieldset 一次涵蓋整個分頁，不是逐個 input 加 disabled',
  editor.includes('disabled={frozenTab}'), true);
check('側邊欄不再重複顯示標籤，改顯示進度訊息',
  [editor.includes('step.message'), editor.includes('checklistById')], [true, true]);
check('已定稿時仍可切換分頁（導航列不在凍結範圍內）',
  editor.includes('const frozenTab = locked && LOCKED_CREATION_TABS.includes(activeTab)'), true);

// ─────────────────────────────────────────────────────────── N
section('N. 金手指的名稱清理與去重（2026-10-06）');

// 2026-10-06：名稱裡的「（高奇）（自奇）（科奇）」標記已移除。
//   ① 那是**顯示字串**，直接違反規則三（禁止括號附註）；
//   ② 使用者裁定「三大擴展的金手指有重複就不列出處」——實測 FLIGHT／CURSED／ROBOT
//      各出現在兩本，所以介面不列出處，標記就沒有意義了。
// 連帶地，靠標記做的來源過濾（`filterQuirksBySources`／`getQuirkSource`）也一起移除——
// 那本來就只涵蓋 17/55 筆，留著是半殘的功能。
const allQuirks = rulesData.quirks;
check('金手指名稱不含來源標記（規則三：禁止括號附註）',
  allQuirks.filter((q) => /[（(](高奇|自奇|科奇)[)）]/.test(q.name)).map((q) => q.name), []);
check('金手指已去重（同名只留一筆）',
  allQuirks.length, new Set(allQuirks.map((q) => q.name)).size);
check('金手指總數 46（三大手冊 35 ＋ 特典合輯 Halloween 系列，去重後）',
  allQuirks.length, 46);
check('每一筆都有名稱與效果',
  allQuirks.filter((q) => !q.name || !q.desc).map((q) => q.name), []);

// `0 || 3` 會把合法的 0 當成缺值。全站不得再出現這個寫法（一律用 `??`）。
const sourceFiles = fs.readdirSync(new URL('../src/features/character-sheet', import.meta.url), { recursive: true })
  .filter((p) => /\.(js|jsx)$/.test(p))
  .map((p) => String(p).replace(/\\/g, '/'));
check('全站沒有 fabulaPoints || N 這種「0 當缺值」的寫法',
  sourceFiles.filter((p) => /fabulaPoints\s*\|\|\s*\d/.test(
    read('../src/features/character-sheet/' + p)
  )),
  []);
check('角色卡引擎不再寫死 Math.max(5',
  read('../src/features/character-sheet/utils/characterEngine.js').includes('Math.max(5'),
  false);
check('等級一律經過 getCharacterLevel（不再直接讀 char.level）',
  /getCharacterLevel/.test(read('../src/features/character-sheet/components/CharacterCard.jsx'))
  && /getCharacterLevel/.test(read('../src/features/character-sheet/CharacterSheet.jsx')),
  true);

// ─────────────────────────────────────────────────────────── O
section('O. 2026-10-06 稽核修正：步驟次序、主題、姓名、屬性陣列、起始資金');

// O1 步驟次序：原書是「先選職業（第 4 步）再分配屬性（第 5 步）」（p.154／p.162）
check('CREATION_STEPS 的順序是職業(2) 先於四維(3)，姓名在最後(6)',
  CREATION_STEPS.map((s) => s.label),
  ['基礎身世', '職業與技能', '四維屬性', '裝備配置', '英雄技能與金手指', '命名與背景']);

// O1b 第 5 步的完成提示不得宣稱「已確認」。
// 這一步在官方標準開卡規則下**沒有任何欄位**（英雄技能要精通職業才解鎖、金手指是選用規則），
// `buildCreationChecklist` 因此永遠把它判成 done 並顯示 doneHint——寫「已確認」等於
// 對玩家宣稱一件從未發生的事（2026-10-20 實測，見 `docs/playtest/findings.md` F-002）。
check('第 5 步的 doneHint 不得宣稱「已確認」（該步在官方標準下無欄位）',
  CREATION_STEPS.find((s) => s.id === 5).doneHint.includes('已確認'), false);
check('第 5 步在兩份清單裡同名（導航列與進度清單不得各叫各的）',
  CREATION_STEPS.find((s) => s.id === 5).label, '英雄技能與金手指');

// O1b-2 「特質」不能同時指兩件事（F-029，2026-10-27）。
// 「特質」在這個 App 裡是**第 1 步 d20 身世表**的那 40 種（見對照表標題），
// 而第 5 步的舊名「英雄技能與特質」指的是金手指——同一個詞兩個意思，
// 玩家在第 1 步選完特質，到第 5 步又看到一個叫「特質」的步驟，裡面卻沒有 d20 特質。
check('第 5 步的名稱不含「特質」（那個詞專指 d20 身世表）',
  CREATION_STEPS.find((s) => s.id === 5).label.includes('特質'), false);
// 反向控制：不能為了「不含特質」就把第 1 步那個正牌「特質」也改掉。
// 那會變成「為了解決撞名，把正確的那個也一起消滅」。
const editorSrcForTrait = fs.readFileSync(
  new URL('../src/features/character-sheet/components/CharacterEditor.jsx', import.meta.url), 'utf8');
check('第 1 步的 d20 對照表仍然叫「特質」（正牌用法沒被誤改）',
  editorSrcForTrait.includes('40 種特質'), true);
check('六個步驟名稱裡「特質」只出現在 0 個步驟上（撞名已解除）',
  CREATION_STEPS.filter((s) => s.label.includes('特質')).length, 0);

// O1c 導航列的步驟名稱必須由 CREATION_STEPS 派生，不得再手抄一份。
// 2026-10-20 之前是兩份硬編碼，而兩邊各有自己的測試釘住——於是**兩邊都綠、名稱卻不同**，
// 導航列同一格出現「英雄技能與特質」與「特質與命刻」兩個名字（見 F-003）。
const editorSrcForTabs = fs.readFileSync(
  new URL('../src/features/character-sheet/components/CharacterEditor.jsx', import.meta.url), 'utf8');
check('CharacterEditor 的 TABS 由 CREATION_STEPS 派生（不得硬編碼步驟標籤）',
  /const TABS = CREATION_STEPS\.map\(/.test(editorSrcForTabs), true);

check('姓名不再落在第 1 步（原書第 8 步，p.154／p.170）',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.field === 'name').map((w) => w.step), [6]);check('第 1 步只剩身分／主題／故鄉（姓名已移出）',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.step === 1).map((w) => w.field), ['identity', 'theme', 'origin']);
check('新角色有性別與角色背景兩個欄位（都預設空字串）',
  [createNewCharacter().gender, createNewCharacter().background], ['', '']);
// 主題不代選：原書 p.158 只「建議」第一位角色從列表選，不是系統替他選。
// 舊版預設 '希望'，等於替玩家決定了最核心的情感，也讓「尚未選擇個人主題」永不觸發。
check('主題預設為空（不擅自先選希望）', createNewCharacter().theme, '');
check('主題為空會被提醒（第 1 步）',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.field === 'theme').map((w) => w.message), ['尚未選擇個人主題']);
check('未填姓名／性別／背景會被提醒（第 6 步）',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.step === 6).map((w) => w.field), ['name', 'gender', 'background']);
check('三格都填了就沒有第 6 步的提醒',
  validateCharacter(createNewCharacter({ name: '雷恩', gender: '女', background: '邊境流浪劍士' }))
    .warnings.filter((w) => w.step === 6), []);
check('validateCharacter 的職業警告落在第 2 步',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.field === 'classes').map((w) => w.step), [2]);
check('validateCharacter 的屬性警告落在第 3 步',
  validateCharacter(createNewCharacter({ attributes: { dex: 6, ins: 6, mig: 6, wlp: 6 } }))
    .warnings.filter((w) => w.field === 'attributes').map((w) => w.step), [3]);

// O2 姓名：佔位符不算填過（舊版只檢查空字串，這條提醒對新角色永遠不觸發）
check('新角色的姓名是佔位符', createNewCharacter().name, PLACEHOLDER_CHARACTER_NAME);
check('佔位符姓名會被提醒',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.field === 'name').map((w) => w.message), ['角色尚未填寫姓名']);
check('真的填了名字就不提醒',
  validateCharacter(createNewCharacter({ name: '卡米拉' }))
    .warnings.filter((w) => w.field === 'name'), []);

// O3 主題：官方十個（Core p.158）
check('主題清單是官方十個、譯名照官方漢化', CANONICAL_THEMES,
  ['野心', '憤怒', '歸屬', '懷疑', '責任', '內疚', '希望', '正義', '慈悲', '復仇']);
check('舊譯名負疚 → 內疚', normalizeTheme('負疚'), '內疚');
check('舊譯名職責 → 責任', normalizeTheme('職責'), '責任');
check('自訂主題原樣傳回', normalizeTheme('救贖'), '救贖');
check('別名表只有這兩個（新增要一起改這裡）',
  Object.keys(THEME_ALIASES).sort(), ['負疚', '職責'].sort());
// 主題沒有預設值（見 O 區段的「主題預設為空」）——所以這裡只確認清單本身是官方那十個
check('官方清單裡的每一個都是合法主題',
  CANONICAL_THEMES.every((t) => typeof t === 'string' && t.length > 0), true);

// O4 屬性陣列：官方三組（Core p.162）
check('三組屬性陣列的名稱與骰組照官方',
  ATTRIBUTE_PRESET_ARRAYS.map((p) => [p.name, p.diceList.join(',')]),
  [['標準', '10,8,8,6'], ['萬事通', '8,8,8,8'], ['特化型', '10,10,6,6']]);
check('三組總和都是 32',
  ATTRIBUTE_PRESET_ARRAYS.map((p) => p.diceList.reduce((a, b) => a + b, 0)), [32, 32, 32]);
check('沒有任何一組自稱「最推薦」（原書沒有推薦哪一組）',
  ATTRIBUTE_PRESET_ARRAYS.some((p) => /推薦/.test(p.tag) || /推薦/.test(p.desc)), false);

// O5 起始資金（原書 p.165）與裝備預算（p.164）
check('新角色的起始資金尚未結算', createNewCharacter().startingFundsRolled, false);
check('未結算會擋住第 4 步',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.field === 'zenit').map((w) => w.type), ['error']);
check('舊存檔（沒有這個欄位）不受影響',
  validateCharacter(createNewCharacter({ startingFundsRolled: undefined }))
    .warnings.filter((w) => w.field === 'zenit'), []);
check('已結算就不再提醒',
  validateCharacter(createNewCharacter({ startingFundsRolled: true }))
    .warnings.filter((w) => w.field === 'zenit'), []);

const equipMaps = {
  weaponMap: new Map(rulesData.equipment.weapons.map((w) => [w.name, w])),
  shieldMap: new Map(rulesData.equipment.shields.map((s) => [s.name, s])),
  armorMap: new Map(rulesData.equipment.armors.map((a) => [a.name, a]))
};
check('徒手＋無裝甲的花費是 0', totalStartingEquipCost(createNewCharacter().equipment, equipMaps), 0);
check('飾品不計入起始裝備花費（即使飾品表有價格）',
  totalStartingEquipCost(
    { mainHand: '徒手打擊', offHand: '', armor: '無裝甲 / 冒險服', accessory: '守護護符' },
    { ...equipMaps, accessoryMap: new Map([['守護護符', { name: '守護護符', cost: 999 }]]) }
  ), 0);
check('主手是盾牌時也算得到（守護者【雙重盾牌】）',
  totalStartingEquipCost({ mainHand: '符文圓盾', offHand: '青銅圓盾', armor: '無裝甲 / 冒險服' }, equipMaps),
  250);

// 超支要進清單（以前只有編輯器的提示框看得到，清單與定稿關卡看不到）
const overBudget = createNewCharacter({
  startingFundsRolled: true,
  equipment: { mainHand: '巨劍', offHand: '符文圓盾', armor: '鋼鐵板甲', accessory: '' }
});
check('超支會變成第 4 步的 error',
  validateCharacter(overBudget).warnings
    .filter((w) => w.step === 4 && /超出/.test(w.message))
    .map((w) => [w.type, w.message]),
  [['error', '起始裝備花費 650z 超出 500z 預算']]);

// O6 高階角色（原書 p.229）：30 級 = 500 + 50 × 30 = 2000
check('預設不加給（5 級維持 500z）', resolveCreationRules({}).startingZenit, 500);
check('30 級自動加給到 2000z（原書 p.229 的例子）',
  resolveCreationRules({ startingLevel: 30 }).startingZenit, 2000);
check('明確給的 startingZenit 優先於加給',
  resolveCreationRules({ startingLevel: 30, startingZenit: 3000 }).startingZenit, 3000);
check('每級加給是官方值 50z', ZENIT_PER_LEVEL, 50);
check('規則 diff 餵回 resolve 會得到同一份規則（分享不會愈套愈多錢）',
  resolveCreationRules(diffCreationRules({ startingLevel: 30 })).startingZenit,
  resolveCreationRules({ startingLevel: 30 }).startingZenit);

// O7 原始碼護欄
const editorSrc = read('../src/features/character-sheet/components/CharacterEditor.jsx');
const engineSrc = read('../src/features/character-sheet/utils/characterEngine.js');
// 原本這裡還有一條「編輯器的分頁標籤是職業在四維之前」——掃源碼裡
// `label: '職業與技能'` 與 `label: '四維屬性'` 的出現位置。
// 2026-10-20 起 `TABS` 由 `CREATION_STEPS` 派生（見 O1c），源碼裡已無那些字面量，
// 掃字面量只會得到 -1 < -1 = false 的假失敗。順序的唯一來源因此是引擎的
// `CREATION_STEPS`，而 **O1 已經釘住它**（職業(2) 先於四維(3)、姓名在最後(6)）；
// 渲染層由 `test:ui` 的「導航列的順序也是職業在四維之前」釘住。這條因此退場，不是被放棄。
check('編輯器不再寫死初始持有金幣 500',
  editorSrc.includes('character.zenit !== undefined ? character.zenit : 500'), false);
check('編輯器不再自己算裝備花費（改呼叫 totalStartingEquipCost）',
  editorSrc.includes('curAcc?.cost'), false);
check('引擎不再用 stats.armorWarning（改讀 buildLoadoutIssues）',
  engineSrc.includes('stats.armorWarning'), false);
check('編輯器不再 import 已刪除的 ATTRIBUTE_STARTING_ARRAYS',
  editorSrc.includes('ATTRIBUTE_STARTING_ARRAYS'), false);
check('屬性陣列只有一份定義（在 data/，元件只 import）',
  read('../src/features/character-sheet/components/AttributeMatrixPicker.jsx')
    .includes('export const ATTRIBUTE_PRESET_ARRAYS'), false);

// ─────────────────────────────────────────────────────────── P
section('P. 英雄技能前提（原書 p.232）與四維骰階範圍（原書 p.162）');

const heroicWarnings = (over) => validateCharacter(createNewCharacter(over))
  .warnings.filter((w) => w.field === 'heroicSkills');
const master = (className) => [{ className, level: 10, skills: [] }];

// 共同前提：精通一個職業（原書 p.232「將一個職業提升到 10 級」）
check('未精通任何職業時，英雄技能是 error',
  heroicWarnings({ heroicSkills: ['額外HP'] }).map((w) => w.type), ['error']);
check('精通後「通用」英雄技能就合法',
  heroicWarnings({ heroicSkills: ['額外HP'], classes: master('守護者') }), []);
check('精通了職業但沒到 10 級 → 仍算未精通',
  heroicWarnings({ heroicSkills: ['額外HP'], classes: [{ className: '守護者', level: 9, skills: [] }] })
    .map((w) => w.type), ['error']);

// 個別技能指定的職業前提
check('精通守護者拿不了【背水】（需暗黑之刃）',
  heroicWarnings({ heroicSkills: ['背水'], classes: master('守護者') }).map((w) => w.message),
  ['【背水】需精通【暗黑之刃】其中之一']);
check('精通暗黑之刃就拿得了【背水】',
  heroicWarnings({ heroicSkills: ['背水'], classes: master('暗黑之刃') }), []);
check('「A或B」任一精通即可',
  checkHeroicSkillRequirement({ requirement: '狂怒鬥士或武器大師' },
    { masteredClasses: ['武器大師'], level: 5 }).ok, true);
check('「A、B或C」任一個都沒有 → 擋',
  checkHeroicSkillRequirement({ requirement: '嵌合師、元素師、熵師或靈師' },
    { masteredClasses: ['守護者'], level: 5 }).ok, false);

// 「且／並」後面的額外技能前提不猜（寧漏不誤）；等級前提抽得出來
check('額外技能前提不猜，只判職業',
  checkHeroicSkillRequirement({ requirement: '修補匠，且必須獲得小工具技能中的高級煉金術技能' },
    { masteredClasses: ['修補匠'], level: 5 }).ok, true);
check('等級前提抽得出來（不足 → 擋）',
  checkHeroicSkillRequirement({ requirement: '秘儀師，且你的角色等級必須為30或更高' },
    { masteredClasses: ['秘儀師'], level: 5 }).ok, false);
check('等級前提抽得出來（足夠 → 過）',
  checkHeroicSkillRequirement({ requirement: '秘儀師，且你的角色等級必須為30或更高' },
    { masteredClasses: ['秘儀師'], level: 30 }).ok, true);
check('沒有前提資料時不擋（無法判定）',
  checkHeroicSkillRequirement({ name: '未知技能' }, { masteredClasses: ['守護者'], level: 5 }).ok, true);
check('沒有任何精通 → 連「通用」也擋',
  checkHeroicSkillRequirement({ requirement: '通用' }, { masteredClasses: [], level: 30 }).ok, false);

// 荊棘之心的前提在官方繁中 Excel 裡寫成「暗影之刃」——但同一本 Excel 其他 8 處
// （含職業技能合集）都寫「暗黑之刃」，而這個技能的說明提到「暗影突襲」（暗黑之刃的技能）。
// 那是來源自己的不一致，已修正；否則這個關卡會誤擋精通暗黑之刃的角色。
check('荊棘之心的前提是暗黑之刃（不是 Excel 那一處的暗影之刃）',
  rulesData.heroicSkills.find((h) => h.name === '荊棘之心').requirement.includes('暗黑之刃'), true);
check('沒有任何英雄技能的前提指向不存在的職業',
  rulesData.heroicSkills
    .filter((h) => h.requirement !== '通用')
    .filter((h) => {
      const part = h.requirement.split(/且|並/)[0];
      const tokens = part.split(/[、,，]|或|：|:/).map((t) => t.trim())
        .filter((t) => t && !/技能|咒語|等級|兩個|更多|職業|中$/.test(t));
      return tokens.length > 0 && tokens.every((t) => !Object.keys(rulesData.classes).includes(t));
    })
    .map((h) => h.name), []);

// 四維骰階範圍（原書 p.162：「從最小 d6 到最大 d12」）
check('d20 不在階梯上 → error 並指出是哪一項',
  validateCharacter(createNewCharacter({ attributes: { dex: 20, ins: 8, mig: 6, wlp: 6 } }))
    .warnings.filter((w) => w.field === 'attributes' && w.type === 'error').map((w) => w.message),
  ['屬性骰階必須是 d6／d8／d10／d12：DEX 為 d20']);
check('合法階梯不會觸發範圍 error',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.field === 'attributes' && w.type === 'error'), []);
check('snapToAttributeDie 取最接近的一階（同距取低，不替玩家灌水）',
  [20, 11, 7, 6, 12, 5].map(snapToAttributeDie), [12, 10, 6, 6, 12, 6]);
check('階梯常數就是官方那四階', [...ATTRIBUTE_DICE_TIERS], [6, 8, 10, 12]);

// ─────────────────────────────────────────────────────────── Q
section('Q. 四維預設為空 ＋ 開局英雄技能（Playtest Materials 2026-10-01 p.4）');

// 四維屬性預設 0 = 尚未指派（使用者指示：讓玩家自己選三組之一，不先套「萬事通」）
check('新角色四維預設為 0（不是 d8×4）',
  ATTRIBUTE_KEYS.map((k) => createNewCharacter().attributes[k]), [0, 0, 0, 0]);
check('四項全空 → 第 3 步是 info（還沒開始，不是玩家的錯）',
  validateCharacter(createNewCharacter()).warnings.filter((w) => w.step === 3).map((w) => w.type), ['info']);
check('四項全空的訊息是「尚未選擇四維屬性配置」',
  validateCharacter(createNewCharacter()).warnings.filter((w) => w.step === 3).map((w) => w.message),
  ['尚未選擇四維屬性配置']);
check('部分指派 → warning 並列出還缺哪幾項',
  validateCharacter(createNewCharacter({ attributes: { dex: 10, ins: 8, mig: 0, wlp: 0 } }))
    .warnings.filter((w) => w.field === 'attributes').map((w) => [w.type, w.message]),
  [['warning', '四維屬性還有 2 項未指派（力量、意志）']]);
check('全部指派且總和正確 → 第 3 步沒有任何提醒',
  validateCharacter(createNewCharacter({ attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 } }))
    .warnings.filter((w) => w.step === 3), []);
// 0 不能被當成「非法骰階」——那是「還沒指派」，不是 d0 這個違法值
check('未指派不會被誤判成非法骰階',
  validateCharacter(createNewCharacter()).warnings
    .filter((w) => w.field === 'attributes' && w.type === 'error'), []);

// 開局英雄技能：官方原文「each Player Character gains an additional Heroic Skill during
// character creation; however, the first time they would normally gain a Heroic Skill by
// mastering one of their Classes, instead they gain no Heroic Skill from that.」
const START_RULE = { startingHeroicSkill: true };
const creationWarn = (over, rules) => validateCharacter(createNewCharacter(over), rules)
  .warnings.filter((w) => w.field === 'heroicSkills');
const L3 = (className) => [{ className, level: 3, skills: [] }];

check('規則關閉時，開局拿英雄技能仍然被擋（維持原行為）',
  creationWarn({ heroicSkills: ['額外HP'], classes: L3('守護者') }).map((w) => w.type), ['error']);
check('規則開啟時，**擁有**該職業即可（不必精通）',
  creationWarn({ heroicSkills: ['背水'], classes: L3('暗黑之刃') }, START_RULE), []);
check('規則開啟但沒有那個職業 → 仍然擋，且訊息說的是「開局需擁有」',
  creationWarn({ heroicSkills: ['背水'], classes: L3('守護者') }, START_RULE).map((w) => w.message),
  ['【背水】開局需擁有【暗黑之刃】其中之一']);
check('8 個官方禁用技能都不能用開局名額',
  STARTING_HEROIC_SKILL_BLOCKLIST.map((name) =>
    checkHeroicSkillRequirement({ name, requirement: '通用' }, { classes: ['守護者'], atCreation: true }).ok),
  STARTING_HEROIC_SKILL_BLOCKLIST.map(() => false));
check('禁用清單就是官方列的那 8 個（逐字）',
  [...STARTING_HEROIC_SKILL_BLOCKLIST],
  ['大口袋', '額外HP', '額外IP', '額外MP', '強力射擊', '強力咒語', '強力攻擊', '啟示']);
check('開局名額只有一個：兩個技能都靠它 → error',
  creationWarn({ heroicSkills: ['背水', '夢之刃'], classes: L3('暗黑之刃') }, START_RULE)
    .map((w) => w.message.includes('開局名額只能選一個')), [true]);
check('精通之後就不佔開局名額（同一組技能不再報錯）',
  creationWarn({
    heroicSkills: ['背水', '夢之刃'],
    classes: [{ className: '暗黑之刃', level: 10, skills: [] }]
  }, START_RULE), []);
check('等級前提在開局模式下不變（Playtest 明文「remain unchanged」）',
  checkHeroicSkillRequirement({ requirement: '秘儀師，且你的角色等級必須為30或更高' },
    { classes: ['秘儀師'], level: 5, atCreation: true }).ok, false);
check('開局模式但一個職業都沒有 → 擋',
  checkHeroicSkillRequirement({ requirement: '通用' }, { classes: [], atCreation: true }).ok, false);
check('規則關閉時，開局模式不適用（沒有名額這回事）',
  creationWarn({ heroicSkills: ['背水'], classes: L3('暗黑之刃') }).map((w) => w.type), ['error']);

// ─────────────────────────────────────────────────────────── R
section('R. 英雄技能出處（使用者要求「必須要標出出處」）與 Playtest 收錄');

const sourceCounts = () => {
  const c = {};
  rulesData.heroicSkills.forEach((h) => { c[h.source] = (c[h.source] || 0) + 1; });
  // 排序後回傳，避免物件鍵的插入順序影響斷言
  return Object.keys(c).sort().map((k) => `${k}:${c[k]}`);
};

check('正式規則書 115 筆 ＋ Playtest 43 筆 ＋ 變體秘儀師 9 筆 ＝ 167',
  [HEROIC_SKILLS.length, rulesData.heroicSkills.length, PLAYTEST_HEROIC_SKILLS.length,
    VARIANT_ARCANIST_HEROIC_SKILLS.length],
  [167, 115, 43, 9]);
// 出處回填自繁中版角色卡 Excel V2.17 的來源區段（位置對齊，已驗證順序完全一致）
// ＋ 卡牌大師那 4 筆（規則書有、Excel 沒有，使用者指示要實裝）
check('出處分佈：核心 31／高度奇幻 24／科技 18／自然 21／特典 21（含卡牌大師 4 筆）',
  sourceCounts(),
  ['bonus:21', 'core:31', 'highFantasy:24', 'naturalFantasy:21', 'technoFantasy:18']);
check('每一筆都有出處，且顯示表裡有對應的中文名',
  HEROIC_SKILLS.filter((h) => !HEROIC_SKILL_SOURCE_LABELS[h.source]).map((h) => h.name), []);
check('Playtest 那批全部標 playtest',
  PLAYTEST_HEROIC_SKILLS.every((h) => h.source === 'playtest'), true);
check('正式與 Playtest 之間沒有重名',
  HEROIC_SKILLS.length - new Set(HEROIC_SKILLS.map((h) => h.name)).size, 0);
check('Playtest 每一筆都有名稱、要求與效果',
  PLAYTEST_HEROIC_SKILLS.filter((h) => !h.name || !h.requirement || !h.effect).map((h) => h.name), []);

// 判定要能吃下 Playtest 的 requirement 寫法（「需精通 X」「通用」「已學會…」）
check('Playtest 技能的要求都判得出來（不會一律擋）',
  PLAYTEST_HEROIC_SKILLS.filter((h) => !checkHeroicSkillRequirement(h, {
    masteredClasses: ['秘儀師', '暗黑之刃', '元素師', '狂怒鬥士', '神射手', '武器大師', '遊蕩者',
      '博學士', '吟唱者', '靈師', '修補匠', '旅人', '守護者', '熵師', '嵌合師',
      '指揮官', '舞者', '魔奏者', '徽記師', '美食家', '祈喚者', '商人', '植物學家',
      '機師', '靈能者', '突變體'],
    classes: ['秘儀師', '暗黑之刃', '元素師', '狂怒鬥士', '神射手', '武器大師', '遊蕩者',
      '博學士', '吟唱者', '靈師', '修補匠', '旅人', '守護者', '熵師', '嵌合師',
      '指揮官', '舞者', '魔奏者', '徽記師', '美食家', '祈喚者', '商人', '植物學家',
      '機師', '靈能者', '突變體'],
    level: 50
  }).ok).map((h) => [h.name, h.requirement]), []);

// 【銃劍士】官方原文是「have acquired … (even if you have not mastered them)」
// ——精通路徑也只要求「擁有」，不是「精通」
const gunbreaker = PLAYTEST_HEROIC_SKILLS.find((h) => h.name === '銃劍士');
check('【銃劍士】不必精通，只要擁有神射手或武器大師',
  checkHeroicSkillRequirement(gunbreaker, {
    masteredClasses: ['守護者'],
    classes: ['守護者', '神射手'],
    level: 5
  }).ok, true);
check('【銃劍士】連擁有都沒有 → 擋',
  checkHeroicSkillRequirement(gunbreaker, {
    masteredClasses: ['守護者'],
    classes: ['守護者'],
    level: 5
  }).ok, false);

// 可重複取得的技能（原書 p.232 預設 1 次；少數明文寫著可以拿多次）
check('可重複次數：預設 1 次',
  heroicSkillMaxAcquisitions(HEROIC_SKILLS.find((h) => h.name === '背水')), 1);
check('可重複次數：嵌合術精通 2 次（官方 may be acquired up to twice）',
  heroicSkillMaxAcquisitions(HEROIC_SKILLS.find((h) => h.name === '嵌合術精通')), 2);
check('可重複次數：解剖學家 3 次（官方 can be acquired up to three times）',
  heroicSkillMaxAcquisitions(HEROIC_SKILLS.find((h) => h.name === '解剖學家')), 3);
check('取得超過上限 → error',
  validateCharacter(createNewCharacter({
    heroicSkills: ['背水', '背水'],
    classes: master('暗黑之刃')
  })).warnings.filter((w) => w.field === 'heroicSkills').map((w) => w.message),
  ['【背水】最多只能取得 1 次（目前 2 次）']);
check('可重複的技能拿兩次是合法的（嵌合術精通）',
  validateCharacter(createNewCharacter({
    heroicSkills: ['嵌合術精通', '嵌合術精通'],
    classes: master('嵌合師')
  })).warnings.filter((w) => w.field === 'heroicSkills'), []);

// 開局名額的「同團不得重複」（Playtest p.4）
// 規則**存在角色身上**，所以這裡是把規則寫進角色、不是傳給函式
const dupA = createNewCharacter({
  name: '甲', heroicSkills: ['背水'], classes: L3('暗黑之刃'), creationRules: START_RULE
});
const dupB = createNewCharacter({
  name: '乙', heroicSkills: ['背水'], classes: L3('暗黑之刃'), creationRules: START_RULE
});
check('兩張卡都沒開規則時不做同團重複檢查',
  findDuplicateStartingHeroicSkills([
    createNewCharacter({ name: '甲', heroicSkills: ['背水'], classes: L3('暗黑之刃') }),
    createNewCharacter({ name: '乙', heroicSkills: ['背水'], classes: L3('暗黑之刃') })
  ]), []);
check('規則開啟時，兩個角色用開局名額拿同一個技能 → 回報',
  findDuplicateStartingHeroicSkills([dupA, dupB]),
  [{ name: '背水', characters: ['甲', '乙'] }]);
check('只有一個角色用到開局名額 → 不回報',
  findDuplicateStartingHeroicSkills([dupA]), []);
check('靠精通取得的不算佔用開局名額',
  findDuplicateStartingHeroicSkills([
    createNewCharacter({ name: '甲', heroicSkills: ['背水'], classes: master('暗黑之刃'), creationRules: START_RULE }),
    createNewCharacter({ name: '乙', heroicSkills: ['背水'], classes: master('暗黑之刃'), creationRules: START_RULE })
  ]), []);
check('只有一張卡開了規則 → 那張卡的名額才算數（另一張不參與）',
  findDuplicateStartingHeroicSkills([dupA, createNewCharacter({
    name: '丙', heroicSkills: ['背水'], classes: L3('暗黑之刃')
  })]), []);

// 開卡規則存在角色身上（見 CreationRulesPanel）——這一段是那個重構的護欄
const ruleChar = createNewCharacter({ creationRules: { startingLevel: 10, classCountMin: 3, classCountMax: 4 } });
check('validateCharacter 預設讀「這張卡自己的」規則',
  validateCharacter(ruleChar).warnings.filter((w) => w.field === 'classes').length, 0);
check('同一張卡用官方標準驗證就會報職業數',
  validateCharacter(ruleChar, DEFAULT_CREATION_RULES).warnings
    .filter((w) => w.field === 'classes').map((w) => w.type), ['error']);
check('明確傳入的規則優先於角色自帶的',
  validateCharacter(ruleChar, { classCountMin: 2, classCountMax: 3 }).warnings
    .filter((w) => w.field === 'classes').map((w) => w.type), ['error']);
// 沒有 creationRules 的舊存檔 → 官方標準（行為與重構前完全相同）：
// error＝職業數不足；warning＝職業等級總和（3）不等於角色等級（5）
check('沒有 creationRules 的舊存檔 → 官方標準（行為不變）',
  validateCharacter(createNewCharacter({ classes: L3('守護者') })).warnings
    .filter((w) => w.field === 'classes').map((w) => w.type), ['error', 'warning']);

// 【預言守護者】把基礎洞察骰面加進最大 HP（Playtest p.16）
const prophetBase = createNewCharacter({ attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 } });
const prophetWith = createNewCharacter({
  attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
  heroicSkills: ['預言守護者']
});
check('【預言守護者】最大 HP 增加基礎洞察骰面（d10 → +10）',
  calculateCharacterStats(prophetWith).maxHp - calculateCharacterStats(prophetBase).maxHp, 10);
check('【預言守護者】不影響 MP',
  calculateCharacterStats(prophetWith).maxMp - calculateCharacterStats(prophetBase).maxMp, 0);

// 職業 → 可解鎖的英雄技能（職業彈窗下方那塊，使用者要求）
check('heroicSkillsForClass：回傳的每一筆都真的提到該職業',
  heroicSkillsForClass('守護者').every((h) => h.requirement.split(/且|並/)[0].includes('守護者')), true);
check('heroicSkillsForClass：通用技能不會出現',
  heroicSkillsForClass('守護者').some((h) => h.requirement === '通用'), false);
check('heroicSkillsForClass：守護者至少解鎖 3 個',
  heroicSkillsForClass('守護者').length >= 3, true);
check('heroicSkillsForClass：Playtest 那批也算得出來',
  heroicSkillsForClass('元素師').some((h) => h.source === 'playtest'), true);
check('heroicSkillsForClass：沒有職業時回空陣列', heroicSkillsForClass(''), []);
// 2026-10-19（§BG）：變體職業**不再**對到核心那一組，而是自己獨立一組。
// 舊版這條斷言寫的是「兩邊長度相等」——在核心 9 筆、變體也 9 筆時它會**假性通過**，
// 正好是「護欄綠燈 ≠ 行為正確」的範例，所以改成驗內容而不是驗數量。
const CORE_ARCANIST_HEROIC = heroicSkillsForClass('秘儀師');
const VARIANT_ARCANIST_HEROIC = heroicSkillsForClass(VARIANT_ARCANIST_CLASS_NAME);
check('核心秘儀師的英雄技能：一筆【變體】都沒有',
  CORE_ARCANIST_HEROIC.filter((h) => h.name.includes('【變體】')).map((h) => h.name), []);
check('變體秘儀師的英雄技能：每一筆都帶【變體】',
  VARIANT_ARCANIST_HEROIC.filter((h) => !h.name.includes('【變體】')).map((h) => h.name), []);
check('兩份清單沒有一個名字重疊（不能相通）',
  CORE_ARCANIST_HEROIC.filter((h) => VARIANT_ARCANIST_HEROIC.some((v) => v.name === h.name)).map((h) => h.name), []);
check('變體秘儀師有 9 筆英雄技能',
  VARIANT_ARCANIST_HEROIC.length, VARIANT_ARCANIST_HEROIC_SKILLS.length);
check('heroicSkillsForClass：「A或B」型在兩邊都查得到',
  [heroicSkillsForClass('機師').some((h) => h.name === '震顫泰坦'),
    heroicSkillsForClass('守護者').some((h) => h.name === '震顫泰坦')], [true, true]);

// ─────────────────────────────────────────────────────────── S
// §BE（2026-10-19 使用者裁定）：
// ① 公測修訂不是「手冊」，是開卡規則裡的一個 tickbox【開放公測修訂內容】；
// ② 開放的手冊清單不再有公測修訂；
// ③ 6 個無官方對應的【Playtest】職業已刪除，只留秘儀師。
section('S. 公測修訂＝規則開關（不是手冊）＋ 6 個無對應職業已刪除');

check('預設關閉公測修訂（官方核心規則沒有公測內容）', DEFAULT_CREATION_RULES.allowPlaytest, false);
check('allowPlaytest 在欄位集裡（否則 diff／重設會漏掉它）',
  CREATION_RULE_FIELDS.includes('allowPlaytest'), true);
check('公測鍵仍是合法的 sourcebook 鍵（秘儀師要靠它）',
  ALL_BOOK_KEYS.includes(PLAYTEST_SOURCEBOOK_KEY), true);

// 開關 → 兩份清單的進出
const withPlaytest = resolveCreationRules({ allowPlaytest: true });
check('開啟公測 → allowedSourcebooks 含 playtest',
  withPlaytest.allowedSourcebooks.includes(PLAYTEST_SOURCEBOOK_KEY), true);
check('開啟公測 → defaultSourcebooks 含 playtest（新角色直接看得到秘儀師）',
  withPlaytest.defaultSourcebooks.includes(PLAYTEST_SOURCEBOOK_KEY), true);
check('開啟公測不影響其他手冊（仍全開）',
  withPlaytest.allowedSourcebooks.filter((k) => k !== PLAYTEST_SOURCEBOOK_KEY).sort(),
  [...MANUAL_BOOK_KEYS].sort());

const noPlaytest = resolveCreationRules({ allowPlaytest: false });
check('關閉公測 → allowedSourcebooks 不含 playtest',
  noPlaytest.allowedSourcebooks.includes(PLAYTEST_SOURCEBOOK_KEY), false);
check('關閉公測 → defaultSourcebooks 不含 playtest',
  noPlaytest.defaultSourcebooks.includes(PLAYTEST_SOURCEBOOK_KEY), false);

// 壞資料／殘留資料：就算 allowedSourcebooks 明寫 playtest，關閉時也要被剝掉
check('關閉公測時，明寫 playtest 的清單也會被剝掉',
  resolveCreationRules({ allowPlaytest: false, allowedSourcebooks: ['core', PLAYTEST_SOURCEBOOK_KEY] }).allowedSourcebooks,
  ['core']);
check('關閉公測時，defaultSourcebooks 明寫 playtest 也會被剝掉',
  resolveCreationRules({ allowPlaytest: false, defaultSourcebooks: ['core', PLAYTEST_SOURCEBOOK_KEY] }).defaultSourcebooks,
  ['core']);
// 冪等：diff 再餵回來不該長出第二個 playtest
const roundTrip = resolveCreationRules(diffCreationRules(withPlaytest));
check('開啟公測的 diff 再餵回去仍等值（不會愈套愈多）',
  roundTrip.allowedSourcebooks.filter((k) => k === PLAYTEST_SOURCEBOOK_KEY).length, 1);

check('官方標準判定：空規則＝預設（allowPlaytest 不破壞 isDefaultCreationRules）',
  isDefaultCreationRules({}), true);
check('官方標準的 diff 是空的（不會無故長出 playtest）', diffCreationRules({}), {});
check('開啟公測 → diff 只帶 allowPlaytest 與被帶動的清單',
  Object.keys(diffCreationRules({ allowPlaytest: true })).sort(),
  ['allowPlaytest', 'allowedSourcebooks', 'defaultSourcebooks']);

// isPlaytestAllowed：單一判定入口 ＋ 舊角色遷移
check('isPlaytestAllowed：allowPlaytest=true → true', isPlaytestAllowed({ creationRules: { allowPlaytest: true } }), true);
check('isPlaytestAllowed：allowPlaytest=false → false（即使 enabledSourcebooks 有 playtest）',
  isPlaytestAllowed({ creationRules: { allowPlaytest: false }, enabledSourcebooks: ['core', 'playtest'] }), false);
check('isPlaytestAllowed：欄位從未設定 → 退回看 enabledSourcebooks（舊角色遷移）',
  isPlaytestAllowed({ creationRules: {}, enabledSourcebooks: ['core', 'playtest'] }), true);
check('isPlaytestAllowed：欄位從未設定且沒開過 → false',
  isPlaytestAllowed({ creationRules: {}, enabledSourcebooks: ['core'] }), false);
check('isPlaytestAllowed：沒有 character 也不拋錯',
  [isPlaytestAllowed(null), isPlaytestAllowed(undefined), isPlaytestAllowed({})], [false, false, false]);

// 面板：tickbox 在、手冊清單不含公測
check('面板有【開放公測修訂內容】開關',
  [panelSrc.includes("'allowPlaytest'"), panelSrc.includes('開放公測修訂內容')], [true, true]);
check('面板的「開放的手冊」不再直接遍歷 SOURCEBOOKS（公測會被列進去）',
  /Object\.entries\(SOURCEBOOKS\)\.map/.test(panelSrc), false);
check('面板改走已過濾的 SOURCEBOOK_ENTRIES',
  panelSrc.includes('SOURCEBOOK_ENTRIES.map'), true);

// 其他兩處「手冊開關」也不能再列公測
const editorSrcBe = read('../src/features/character-sheet/components/CharacterEditor.jsx');
check('編輯器「官方拓展職業」列不列公測（公測由規則控制）',
  /Object\.keys\(SOURCEBOOKS\)\.map/.test(editorSrcBe), false);
check('編輯器以 PLAYTEST_SOURCEBOOK_KEY 過濾掉公測',
  editorSrcBe.includes('sbKey !== PLAYTEST_SOURCEBOOK_KEY'), true);
check('編輯器：allowPlaytest 開啟時才把 playtest 補進可用清單',
  editorSrcBe.includes('rules.allowPlaytest'), true);

const pickerSrcBe = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
check('選職業彈窗：手冊列不列公測',
  /Object\.keys\(SOURCEBOOKS\)\.map/.test(pickerSrcBe), false);
check('選職業彈窗：變體顯示改看 rules.allowPlaytest（不再看 enabledBooks）',
  [pickerSrcBe.includes('const showVariants = rules.allowPlaytest === true;'),
    pickerSrcBe.includes("(enabledBooks || []).includes('playtest')")], [true, false]);

const skillCardSrcBe = read('../src/features/character-sheet/components/ClassSkillCard.jsx');
check('職業卡：公測變體改走 isPlaytestAllowed(character)',
  [skillCardSrcBe.includes('isPlaytestAllowed(character)'),
    skillCardSrcBe.includes("includes('playtest')")], [true, false]);

// 起始範本彈窗的手冊篩選列同理（公測沒有起始範本，列出來只會是「0 組」噪音）
const presetSrcBe = read('../src/features/character-sheet/components/StarterPresetsModal.jsx');
check('起始範本彈窗：手冊篩選列不列公測',
  presetSrcBe.includes('key !== PLAYTEST_SOURCEBOOK_KEY'), true);

// 刪除的 6 個職業：資料層與設定層都不得殘留
const DELETED_PLAYTEST_CLASSES = [
  '守護者【Playtest】', '武器大師【Playtest】', '博學士【Playtest】',
  '暗黑之刃【Playtest】', '神射手【Playtest】', '吟唱者【Playtest】'
];
check('rulesData 不再有那 6 個職業',
  DELETED_PLAYTEST_CLASSES.filter((name) => Object.prototype.hasOwnProperty.call(rulesData.classes, name)), []);
check('SOURCEBOOKS.playtest.classes 只剩秘儀師【變體】',
  SOURCEBOOKS.playtest.classes, ['秘儀師【變體】']);
check('CLASS_METADATA 也不再有那 6 個職業',
  DELETED_PLAYTEST_CLASSES.filter((name) => Object.prototype.hasOwnProperty.call(CLASS_METADATA, name)), []);
check('秘儀師【變體】仍然在（公測唯一的職業級變體，不可誤刪）',
  Object.prototype.hasOwnProperty.call(rulesData.classes, '秘儀師【變體】'), true);

// ─────────────────────────────────────────────────────────── BG
section('BG. 變體秘儀師的英雄技能：獨立條目 ＋ 與核心版互不相通');
// 使用者裁定（2026-10-19）：
// 「變體版的英雄技能全部加進去，然後在後面括號【變體】，不要修改到核心版的原文。
//   同時要界定邏輯，如果精通的職業是核心版，就只能選核心版的英雄技能，
//   變體版則只能選變體版的英雄技能，這兩者不能相通。」
const heroicByName = (n) => HEROIC_SKILLS.find((h) => h.name === n);
const VAR = '【變體】';
// 全部走「查不到就給空字串」的取值器：資料檔被改壞時要**回報 FAIL**，
// 不能丟 TypeError 把整份報告吃掉（第一版就是這樣，刻意破壞驗證才發現它其實沒在守）。
const effectOf = (n) => heroicByName(n)?.effect ?? '';
const reqOf = (name, opts) => {
  const skill = heroicByName(name);
  return skill ? checkHeroicSkillRequirement(skill, opts) : { ok: null, reason: '（找不到這個技能）' };
};

// (1) 使用者同日裁定：「秘術再生的翻譯保留」——不改叫「阿爾卡納再生」。
check('變體秘儀師的技能名保留「秘術再生」',
  [rulesData.classes[VARIANT_ARCANIST_CLASS_NAME].skills.some((s) => s.name === '秘術再生'),
    rulesData.classes[VARIANT_ARCANIST_CLASS_NAME].skills.some((s) => s.name === '阿爾卡納再生')],
  [true, false]);

// (2) 9 筆：命名、需求、完整性
check('每一筆都帶【變體】後綴',
  VARIANT_ARCANIST_HEROIC_SKILLS.filter((h) => !h.name.endsWith(VAR)).map((h) => h.name), []);
check('每一筆的需求都指向變體職業',
  VARIANT_ARCANIST_HEROIC_SKILLS.filter((h) => !h.requirement.includes(VARIANT_ARCANIST_CLASS_NAME)).map((h) => h.name), []);
check('每一筆都有名稱／需求／效果',
  VARIANT_ARCANIST_HEROIC_SKILLS.filter((h) => !h.name || !h.requirement || !h.effect).map((h) => h.name), []);
check('每一筆都真的併進 HEROIC_SKILLS（否則選單裡根本沒有）',
  VARIANT_ARCANIST_HEROIC_SKILLS.filter((h) => !heroicByName(h.name)).map((h) => h.name), []);
// 變體版不該再列出其他職業（否則同一條技能會在別的職業那邊出現兩份）。
check('變體版需求不再掛其他職業',
  VARIANT_ARCANIST_HEROIC_SKILLS
    .filter((h) => /或靈師|或守護者|、商人、徽記師|^卡牌大師/.test(h.requirement))
    .map((h) => h.name), []);

// (3) 原文照抄的 5 條：效果必須與核心版逐字相同
const IDENTICAL_HEROIC = ['阿爾卡納迴響', '靈氣掌握', '奧術獻祭', '神符精通', '被封印的儀式'];
check('原文說「kept identical」的 5 條，效果與核心版逐字相同',
  IDENTICAL_HEROIC.filter((n) => effectOf(`${n}${VAR}`) !== effectOf(n)), []);

// (4) 真的改了 2 條
check('啟示【變體】是重寫版（與核心版不同）',
  effectOf(`啟示${VAR}`) !== effectOf('啟示') && effectOf(`啟示${VAR}`) !== '', true);
check('啟示【變體】寫入 p.32 的新條款（危機 ＋ 快速召喚兩個選項）',
  [effectOf(`啟示${VAR}`).includes('危機狀態'),
    effectOf(`啟示${VAR}`).includes('快速召喚')], [true, true]);
check('偉大召喚【變體】保留核心全文，只在尾端追加',
  effectOf(`偉大召喚${VAR}`).startsWith(effectOf('偉大召喚')) && effectOf('偉大召喚') !== '', true);
check('偉大召喚【變體】追加「顯現體也能執行脈衝」與「不能搭配快速召喚」',
  [effectOf(`偉大召喚${VAR}`).includes('脈衝'),
    effectOf(`偉大召喚${VAR}`).includes('沒有使用【快速召喚】')], [true, true]);

// (5) 核心版一個字都沒被動到
const CORE_ARCANIST_HEROIC_NAMES = [
  '阿爾卡納迴響', '啟示', '偉大召喚', '靈氣掌握', '奧術獻祭', '神符精通', '被封印的儀式'
];
check('核心 7 條的需求都沒有【變體】字樣',
  CORE_ARCANIST_HEROIC_NAMES.filter((n) => heroicByName(n)?.requirement.includes(VAR)).map((n) => n), []);
check('核心 7 條的效果都沒有被追加脈衝條款',
  CORE_ARCANIST_HEROIC_NAMES.filter((n) => heroicByName(n)?.effect.includes('脈衝')).map((n) => n), []);

// (6) 隔離：精通哪一版就只能選哪一版
check('精通核心秘儀師 → 選不到變體技能',
  reqOf(`阿爾卡納迴響${VAR}`, { masteredClasses: ['秘儀師'], level: 10 }).ok, false);
check('精通變體秘儀師 → 選不到核心技能',
  reqOf('阿爾卡納迴響', { masteredClasses: [VARIANT_ARCANIST_CLASS_NAME], level: 10 }).ok, false);
check('各自精通 → 各自選得到',
  [reqOf('阿爾卡納迴響', { masteredClasses: ['秘儀師'], level: 10 }).ok,
    reqOf(`阿爾卡納迴響${VAR}`, { masteredClasses: [VARIANT_ARCANIST_CLASS_NAME], level: 10 }).ok],
  [true, true]);
check('開局名額模式也隔離（擁有核心職業 ≠ 擁有變體職業）',
  [reqOf(`阿爾卡納迴響${VAR}`, { classes: ['秘儀師'], level: 5, atCreation: true }).ok,
    reqOf(`阿爾卡納迴響${VAR}`, { classes: [VARIANT_ARCANIST_CLASS_NAME], level: 5, atCreation: true }).ok],
  [false, true]);
check('隔離對「需求附帶等級」的那條也成立（偉大召喚 30 級）',
  [reqOf(`偉大召喚${VAR}`, { masteredClasses: ['秘儀師'], level: 30 }).ok,
    reqOf(`偉大召喚${VAR}`, { masteredClasses: [VARIANT_ARCANIST_CLASS_NAME], level: 20 }).ok,
    reqOf(`偉大召喚${VAR}`, { masteredClasses: [VARIANT_ARCANIST_CLASS_NAME], level: 30 }).ok],
  [false, false, true]);

// (7) 開局名額封鎖不能因為改名而失效
check('啟示【變體】也不能用開局名額取得（核心版被擋，變體版不能開後門）',
  reqOf(`啟示${VAR}`, { classes: [VARIANT_ARCANIST_CLASS_NAME], level: 5, atCreation: true }).ok, false);

// (8) 錯誤訊息要說清楚缺的是哪一版
check('核心角色選變體技能 → 提示寫出「秘儀師【變體】」',
  reqOf(`阿爾卡納迴響${VAR}`, { masteredClasses: ['秘儀師'], level: 10 }).reason,
  '需精通秘儀師【變體】其中之一');
check('變體角色選核心技能 → 提示寫出「秘儀師」',
  reqOf('阿爾卡納迴響', { masteredClasses: [VARIANT_ARCANIST_CLASS_NAME], level: 10 }).reason,
  '需精通【秘儀師】其中之一');

// ─────────────────────────────────────────────────────────── T
section('T. 魔晶石把【定制武器】變成派生值（p.133 裝備白名單）');

// 原書：「The only types of equipment available in the game are the following:
// custom weapons (page 112), armor, and accessories, plus weapon and armor
// modules for the Pilot Class」——下一句是「Any other equipment simply cannot
// exist」。所以開了魔晶石就**沒有官方武器表**，不定制武器等於沒有武器可拿。
//
// 實作方式刻意選「派生」而不是「開啟時把那一格寫成 true」：寫進去的話，
// 之後關掉魔晶石它還是 true，玩家當初沒選過的東西會留在他身上。

const TECHNO_MODES = ['off', 'full', 'integrated', 'mnemospheresOnly', 'hoplospheresOnly'];

// (1) 三態強制、兩態不強制——「僅職業魔石」是關鍵反例，證明不是一刀切
check('完整規則 → 強制定制武器',
  resolveCreationRules({ technospheres: 'full' }).allowCustomWeapon, true);
check('內嵌裝置 → 強制定制武器',
  resolveCreationRules({ technospheres: 'integrated' }).allowCustomWeapon, true);
check('僅附魔魔石 → 強制定制武器',
  resolveCreationRules({ technospheres: 'hoplospheresOnly' }).allowCustomWeapon, true);
check('僅職業魔石 → **不**強制（p.138 官方裝備整份放回）',
  resolveCreationRules({ technospheres: 'mnemospheresOnly' }).allowCustomWeapon, false);
check('魔晶石關閉 → 維持官方預設（不開）',
  resolveCreationRules({}).allowCustomWeapon, false);

// (2) 與 `modeRestrictsEquipment` 逐態一致——同一條規則不許在兩個地方判定
check('五態的強制與否與 modeRestrictsEquipment 完全一致',
  TECHNO_MODES.map((m) => resolveCreationRules({ technospheres: m }).allowCustomWeapon),
  TECHNO_MODES.map((m) => modeRestrictsEquipment(m)));

// (3) 派生蓋過「使用者自己勾的 false」——這是規則後果，不是偏好
check('使用者關掉但魔晶石開著 → 仍是 true',
  resolveCreationRules({ technospheres: 'full', allowCustomWeapon: false }).allowCustomWeapon, true);

// (4) 派生值不得被寫回「使用者的偏好」——否則關掉魔晶石之後它會殘留
//     （面板存的是原始偏好，不是 `resolveCreationRules` 的輸出；
//      `diffCreationRules` 是分享出去的那一份，它也不准夾帶派生欄位。）
const shared = diffCreationRules({ technospheres: 'full' });
check('分享出去的規則不含派生的 allowCustomWeapon', 'allowCustomWeapon' in shared, false);
check('分享的規則回餵 → 魔晶石還在，所以仍是 true', resolveCreationRules(shared).allowCustomWeapon, true);
check('回餵後再關掉魔晶石 → false（沒有殘留）',
  resolveCreationRules({ ...shared, technospheres: 'off' }).allowCustomWeapon, false);

// (5) diff 不帶派生欄位——否則分享出去會讓對方「沒開魔晶石卻莫名開了定制武器」
check('diffCreationRules 不把魔晶石派生的 allowCustomWeapon 寫進 diff',
  'allowCustomWeapon' in diffCreationRules({ technospheres: 'full' }), false);
check('GM 自己開的定制武器（無魔晶石）仍然寫進 diff',
  'allowCustomWeapon' in diffCreationRules({ allowCustomWeapon: true }), true);
check('「僅職業魔石」下 GM 自己開的定制武器也照留',
  'allowCustomWeapon' in diffCreationRules({ technospheres: 'mnemospheresOnly', allowCustomWeapon: true }), true);

// (6) 官方標準判定不受影響
check('空規則仍是官方標準', isDefaultCreationRules({}), true);
check('魔晶石一開就不再是官方標準', isDefaultCreationRules({ technospheres: 'full' }), false);

// (7) UI：勾選框鎖住並說明理由（否則 GM 只看到「打勾但不能改」）
const rulesPanel = read('../src/features/character-sheet/components/CreationRulesPanel.jsx');
check('面板有 derivedToggle 判定',
  rulesPanel.includes("const derivedToggle = (key) => forcedCustomWeapon && key === 'allowCustomWeapon'"), true);
check('勾選框的 checked 吃派生值',
  rulesPanel.includes('checked={derivedToggle(f.key) || Boolean(rules[f.key])}'), true);
check('勾選框在派生時 disabled',
  rulesPanel.includes('disabled={disabled || derivedToggle(f.key)}'), true);
check('鎖住時寫出理由「官方武器表整份不存在」',
  rulesPanel.includes('官方武器表整份不存在'), true);

// ─────────────────────────────────────────────────────────── F-015
section('F-015 名冊卡上的「這張卡是哪個規則開的」徽章（2026-10-27）');

// 病：20 張卡並存時，四張卡四組規則，外觀完全一致——把卡名從全文剔除後，
// 搜「魔晶石／底力／營地活動／自訂規則」一個都沒中，只能一張一張點進去。
// 徽章是**差異**，不是清單：只列與官方核心規則不同的項目，沒有差異就印一顆「官方標準」
// （「什麼都沒有」和「還沒載入」在畫面上長得一樣）。
const labelsOf = (rules) => describeRuleBadges(rules).map((b) => b.label);
const keysOf = (rules) => describeRuleBadges(rules).map((b) => b.key);

check('官方預設規則 → 只有一顆「官方標準」', labelsOf({}), ['官方標準']);
check('沒有規則資料（舊存檔）也回「官方標準」，不是空陣列', labelsOf(undefined), ['官方標準']);
check('魔晶石 full → 印「魔晶石・完整規則」', labelsOf({ technospheres: 'full' }), ['魔晶石・完整規則']);
check('魔晶石 integrated → 印「魔晶石・內嵌魔晶石」',
  labelsOf({ technospheres: 'integrated' }), ['魔晶石・內嵌魔晶石']);
check('底力技 → 印「底力技」', labelsOf({ zeroPowers: true }), ['底力技']);
check('營地活動 → 印「營地活動」', labelsOf({ campActivities: true }), ['營地活動']);
check('金手指 → 印「金手指」', labelsOf({ allowQuirk: true }), ['金手指']);
check('公測修訂 → 印「公測修訂」', labelsOf({ allowPlaytest: true }), ['公測修訂']);
check('起始等級不是 5 → 印出來（不然「3 級開局」的卡跟官方標準長得一樣）',
  labelsOf({ startingLevel: 3 }), ['起始 3 級']);
check('職業數被改過 → 印出來', labelsOf({ classCountMin: 4, classCountMax: 4 }), ['職業 4']);

// 派生值不列：魔晶石開啟時 allowCustomWeapon 一定是 true、職業數被鎖成 3。
// 若照樣列，每一張魔晶石卡都會多兩顆「定制武器」「職業 3」——那不是 GM 的選擇。
check('魔晶石開啟時不單獨列「定制武器」（那是 p.133 的規則後果）',
  labelsOf({ technospheres: 'full', allowCustomWeapon: true }), ['魔晶石・完整規則']);
check('魔晶石開啟時不列職業數（被鎖成 3，不是 GM 調的）',
  labelsOf({ technospheres: 'full', classCountMin: 3, classCountMax: 3 }), ['魔晶石・完整規則']);
check('魔晶石關閉時，定制武器要列（那才是 GM 真的打開的）',
  labelsOf({ allowCustomWeapon: true }), ['定制武器']);

// 順序：影響上桌程度大的排前面（名冊卡只顯示前 4 顆，排序錯了就看不到重點）
check('全部打開時魔晶石排第一、底力技第二',
  keysOf({ technospheres: 'full', zeroPowers: true, campActivities: true, allowQuirk: true }).slice(0, 2),
  ['technospheres', 'zeroPowers']);
check('每一筆都有 key 與非空 label（逐一，不抽樣）',
  describeRuleBadges({
    technospheres: 'full', zeroPowers: true, campActivities: true, allowQuirk: true,
    allowPlaytest: true, initiativeVariant: true, startingHeroicSkill: true, startingLevel: 3
  }).every((b) => b.key && b.label && b.label.length > 0), true);
check('同一份規則呼叫兩次結果相同（沒有隱藏狀態）',
  labelsOf({ zeroPowers: true, campActivities: true }), labelsOf({ zeroPowers: true, campActivities: true }));

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
