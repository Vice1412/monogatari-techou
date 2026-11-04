/**
 * 效果流程核心層測試。
 *
 * 執行：`npm run test:flows`
 *
 * 期望值來源：`scratch/flows/IMPL-SPEC.md` §2 的九組必測項目＋
 * `data/effectFlows.json` 的實際形狀（373 筆，由 `npm run build:flows` 產生）。
 *
 * 這份測試刻意**不碰真存檔**：全部用假角色，因為跑團卡上的真角色
 * 一旦被測試寫髒，玩家看到的 HP 就會少一格，而且沒人知道是測試做的。
 */
import fs from 'node:fs';

import {
  FLOW_ITEMS,
  FLOW_CONTROL_KINDS,
  FLOW_TARGETS,
  FLOW_SCOPES,
  flowItemById,
  flowItemForClassSkill,
  flowItemForHeroic,
  flowItemForQuirk,
  flowItemForCamp,
  characterFlowItems,
  evaluateControlValue,
  readFlowState,
  clampFlowState,
  withFlowState,
  flowResetState,
  flowActionPlan,
  characterFlowModifiers,
  flowVarsFor,
  flowCoverageReport
} from '../src/features/character-sheet/utils/effectFlow.js';
// 金手指的 effects 鍵白名單守衛（§K）需要原始資料，不是流程資料。
import rulesData from '../src/features/character-sheet/data/rulesData.json';

const QUIRKS = rulesData.quirks || [];

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

/** 造一個測試角色（只填這一層會讀的欄位） */
const mkChar = (over = {}) => ({
  level: 5,
  classes: [{ className: '博學士', level: 5, skills: [{ name: '集中', sl: 3 }, { name: '靈光一閃', sl: 2 }] }],
  heroicSkills: [],
  quirk: '無',
  campActivities: { picked: [], used: [] },
  ...over
});

const REPORT = flowCoverageReport();

// ─────────────────────────────────────────────────────────── A
section('A. 覆蓋率：條目數與分類計數必須對得上備份');
check('條目總數 373', FLOW_ITEMS.length, 373);
check('職業技能 145', REPORT.byCategory.class, 145);
check('英雄技能 167', REPORT.byCategory.heroic, 167);
check('金手指 46', REPORT.byCategory.quirk, 46);
check('營地活動 15', REPORT.byCategory.camp, 15);
check('四個分類加起來等於總數',
  Object.values(REPORT.byCategory).reduce((a, b) => a + b, 0), FLOW_ITEMS.length);
check('flow=state 57', REPORT.byFlow.state, 57);
check('flow=action 137', REPORT.byFlow.action, 137);
check('flow=modifier 121', REPORT.byFlow.modifier, 121);
check('flow=grant 54', REPORT.byFlow.grant, 54);
check('flow=narrative 4', REPORT.byFlow.narrative, 4);
// 「還沒接」的清單就是「全數修好」的定義：它必須是空的。
// 這一條紅了，代表又有條目退回「只寫了文字」——`REPORT.untracked` 會直接印出是哪幾條。
check('untracked 清單必須為空（空＝373 條全部接得起來）', REPORT.untracked, []);
check('narrative 清單 4 筆', REPORT.narrative.length, 4);
check('total 與清單一致', REPORT.total, FLOW_ITEMS.length);
// 每一筆條目都必須說得出「靠什麼接的」，而且是已實作的機制之一（或 none）。
const APPLY_VIAS = ['existing', 'flow-control', 'flow-listed', 'none'];
check('每一筆的 apply.via 都在封閉詞彙內',
  FLOW_ITEMS.filter((i) => !APPLY_VIAS.includes(i.apply?.via)).map((i) => i.id), []);
check('flow-control 的條目一定有控件（counter/toggle/button）',
  FLOW_ITEMS.filter((i) => i.apply?.via === 'flow-control'
    && !['counter', 'toggle', 'button'].includes(i.control?.kind)).map((i) => i.id), []);
check('narrative 一定是 via=none',
  FLOW_ITEMS.filter((i) => i.flow === 'narrative' && i.apply?.via !== 'none').map((i) => i.id), []);

// ─────────────────────────────────────────────────────────── B
section('B. evaluateControlValue：只認 + - * / 括號與兩個變數');
check('SL + 1（SL3）-> 4', evaluateControlValue('SL + 1', { sl: 3 }), 4);
check('SL * 5（SL2）-> 10', evaluateControlValue('SL * 5', { sl: 2 }), 10);
check('10 + SL * 5（SL3）-> 25（先乘除後加減）', evaluateControlValue('10 + SL * 5', { sl: 3 }), 25);
check('等級 / 2（Lv7）-> 3（除不盡向下取整）', evaluateControlValue('等級 / 2', { level: 7 }), 3);
check('LEVEL / 2（Lv8）-> 4（大寫別名）', evaluateControlValue('LEVEL / 2', { level: 8 }), 4);
check('(SL + 1) * 2（SL2）-> 6（括號）', evaluateControlValue('(SL + 1) * 2', { sl: 2 }), 6);
check('SL / 2（SL5）-> 2', evaluateControlValue('SL / 2', { sl: 5 }), 2);
// 這一條專門分辨「每一段除法就取整」與「最後才取整」：
// SL5 的 5/2 若只在最後取整，會是 floor(2.5*2)=5；分段取整才是 2*2=4。
check('SL / 2 * 2（SL5）-> 4（除法當下就取整，不是最後才取整）',
  evaluateControlValue('SL / 2 * 2', { sl: 5 }), 4);
check('純數字 "1" -> 1', evaluateControlValue('1'), 1);
check('數字型別 20 -> 20', evaluateControlValue(20), 20);
check('SL 單獨出現 -> SL 值', evaluateControlValue('SL', { sl: 4 }), 4);
check('等級/2 + 鷹眼SL × 5 -> null（含全角乘號與未登記變數）',
  evaluateControlValue('等級/2 + 鷹眼SL × 5', { sl: 3, level: 7 }), null);
check('1 + 有備無患SL -> null（變數黏在中文後面）',
  evaluateControlValue('1 + 有備無患SL', { sl: 3 }), null);
check('"無上限" -> null（不是 0）', evaluateControlValue('無上限'), null);
check('"無上限（每偶數輪 +1）" -> null', evaluateControlValue('無上限（每偶數輪 +1）'), null);
check('空字串 -> null', evaluateControlValue(''), null);
check('undefined -> null', evaluateControlValue(undefined), null);
check('null -> null', evaluateControlValue(null), null);
check('語法錯 "SL +" -> null', evaluateControlValue('SL +'), null);

// 第二期：其他技能的 SL 可以當變數（上限算式寫的不是自己的 SL）。
// 【陷阱大師】的「1 + 有備無患SL」、【誘餌】的「等級/2 + 鷹眼SL×5」都是這一類。
// 只傳 `vars` 時才算得出來；不傳就**仍然是 null**（第一期行為）——
// 這一組 A/B 對照證明「補了變數」不是靠放寬 tokenizer 偷來的。
check('不傳 vars：1 + 有備無患SL -> null（維持第一期）',
  evaluateControlValue('1 + 有備無患SL', { sl: 3 }), null);
check('傳 vars：1 + 有備無患SL（SL2）-> 3',
  evaluateControlValue('1 + 有備無患SL', { sl: 3, vars: { 有備無患SL: 2 } }), 3);
check('傳 vars 但沒學那個技能 -> null（不當成 0 級）',
  evaluateControlValue('1 + 有備無患SL', { sl: 3, vars: {} }), null);
check('變數值是 NaN -> null（不是 0）',
  evaluateControlValue('1 + 有備無患SL', { sl: 3, vars: { 有備無患SL: NaN } }), null);
check('flowVarsFor 收集角色身上的技能 SL',
  flowVarsFor({ classes: [{ skills: [{ name: '有備無患', sl: 2 }] }] }), { 有備無患SL: 2 });
check('flowVarsFor 忽略 SL 0（沒點過不算學過）',
  flowVarsFor({ classes: [{ skills: [{ name: '有備無患', sl: 0 }] }] }), {});
check('flowVarsFor 容忍舊存檔沒有 classes', flowVarsFor({}), {});
check('flowVarsFor 也吃自訂職業',
  flowVarsFor({ customClasses: [{ skills: [{ name: '鷹眼', sl: 3 }] }] }), { 鷹眼SL: 3 });
check('未關括號 "(SL + 1" -> null', evaluateControlValue('(SL + 1'), null);
check('除以 0 -> null', evaluateControlValue('SL / 0', { sl: 3 }), null);
check('小寫 sl 也認（識別字大小寫不敏感）-> 4', evaluateControlValue('sl + 1', { sl: 3 }), 4);

// ─────────────────────────────────────────────────────────── C
section('C. 條目查找：找得到、找不到要回 null');
const PROTECT = flowItemForClassSkill('守護者', '保護');
check('守護者「保護」找得到', Boolean(PROTECT), true);
check('守護者「保護」的 id 正確', PROTECT?.id, 'class:守護者:保護');
check('不存在的技能回 null', flowItemForClassSkill('守護者', '不存在的技能'), null);
check('不存在的職業回 null', flowItemForClassSkill('不存在的職業', '保護'), null);
check('缺參數回 null', flowItemForClassSkill('', ''), null);
// 規格書範例寫「守護者／盾牆」，但實際資料裡守護者沒有「盾牆」這一條
// （只有 不動要塞／保護／保鏢／防守掌握／雙重盾牌）——所以這裡釘住的是「找不到就是 null」。
check('規格書舉例的「盾牆」在資料中不存在 -> null', flowItemForClassSkill('守護者', '盾牆'), null);
check('英雄技能「怒潮拳」找得到', Boolean(flowItemForHeroic('怒潮拳')), true);
check('英雄技能不存在回 null', flowItemForHeroic('不存在'), null);
check('金手指「煽動家」找得到', flowItemForQuirk('煽動家')?.id, 'quirk:煽動家');
check('金手指不存在回 null', flowItemForQuirk('無'), null);
check('營地活動吃短 id', flowItemForCamp('campForge')?.id, 'camp:campForge');
check('營地活動也吃完整 id', flowItemForCamp('camp:campForge')?.id, 'camp:campForge');
check('營地活動不存在回 null', flowItemForCamp('nope'), null);
check('flowItemById 找得到', flowItemById('heroic:怒潮拳')?.name, '怒潮拳');
check('flowItemById 找不到回 null', flowItemById('nope:nope'), null);

// ─────────────────────────────────────────────────────────── D
section('D. characterFlowItems：只回角色真的持有的條目');
const FULL = mkChar({
  heroicSkills: ['怒潮拳', { name: '不破之人' }],
  quirk: '煽動家',
  campActivities: { picked: ['campForge', 'exploration'], used: [] }
});
const fullItems = characterFlowItems(FULL);
const fullIds = fullItems.map((e) => e.item.id);
check('職業技能「集中」在清單裡', fullIds.includes('class:博學士:集中'), true);
check('「集中」的 SL 是 3', fullItems.find((e) => e.item.id === 'class:博學士:集中')?.sl, 3);
check('「靈光一閃」的 SL 是 2', fullItems.find((e) => e.item.id === 'class:博學士:靈光一閃')?.sl, 2);
check('英雄技能（字串形式）在清單裡', fullIds.includes('heroic:怒潮拳'), true);
check('英雄技能（物件形式）在清單裡', fullIds.includes('heroic:不破之人'), true);
check('英雄技能的 SL 一律 0', fullItems.find((e) => e.item.id === 'heroic:怒潮拳')?.sl, 0);
check('金手指在清單裡', fullIds.includes('quirk:煽動家'), true);
check('營地活動在清單裡', fullIds.includes('camp:campForge'), true);
check('營地活動二也在清單裡', fullIds.includes('camp:exploration'), true);
check('每個條目都標 owned', fullItems.every((e) => e.owned === true), true);
check('沒持有的職業條目不出現',
  fullIds.includes('class:守護者:保護'), false);
check('金手指為「無」時不出現任何金手指條目',
  characterFlowItems(mkChar({ quirk: '無' })).filter((e) => e.item.category === 'quirk').length, 0);
check('沒有英雄技能時不出現英雄條目',
  characterFlowItems(mkChar()).filter((e) => e.item.category === 'heroic').length, 0);
check('SL 0 的職業技能不出現',
  characterFlowItems(mkChar({
    classes: [{ className: '博學士', skills: [{ name: '集中', sl: 0 }] }]
  })).length, 0);
check('舊存檔的純陣列 campActivities 也吃得下',
  characterFlowItems(mkChar({ campActivities: ['campForge'] }))
    .filter((e) => e.item.category === 'camp')
    .map((e) => e.item.id),
  ['camp:campForge']);
check('空角色回空陣列', characterFlowItems({}), []);
check('null 角色回空陣列', characterFlowItems(null), []);

// ─────────────────────────────────────────────────────────── E
section('E. readFlowState：缺欄一律容忍（舊存檔沒有 flowState）');
const COUNTER_ITEM = flowItemForClassSkill('博學士', '靈光一閃'); // max = SL
const NO_MAX_ITEM = flowItemForHeroic('怒潮拳');                 // max = 無上限
check('從未寫入 -> {n:0,on:false}', readFlowState(mkChar(), COUNTER_ITEM), { n: 0, on: false });
check('讀到的不是 undefined', readFlowState(mkChar(), COUNTER_ITEM) !== undefined, true);
check('寫過 1/true -> 原值', readFlowState(
  mkChar({ flowState: { [COUNTER_ITEM.id]: { n: 1, on: true } } }), COUNTER_ITEM), { n: 1, on: true });
check('填成 0 就是 0（不會復活成初始值）', readFlowState(
  mkChar({ flowState: { [COUNTER_ITEM.id]: { n: 0, on: false } } }), COUNTER_ITEM).n, 0);
check('超過上限 -> 夾到上限 2', readFlowState(
  mkChar({ flowState: { [COUNTER_ITEM.id]: { n: 99, on: false } } }), COUNTER_ITEM).n, 2);
check('沒有上限的條目不夾（99 就 99）', readFlowState(
  mkChar({ flowState: { [NO_MAX_ITEM.id]: { n: 99, on: false } } }), NO_MAX_ITEM).n, 99);
check('on 只認 true', readFlowState(
  mkChar({ flowState: { [COUNTER_ITEM.id]: { n: 1, on: 'yes' } } }), COUNTER_ITEM).on, false);
check('null 角色 -> 預設', readFlowState(null, COUNTER_ITEM), { n: 0, on: false });
check('undefined 條目 -> 預設', readFlowState(mkChar(), undefined), { n: 0, on: false });

// ─────────────────────────────────────────────────────────── F
section('F. clampFlowState：有上限才夾，無上限不夾');
check('超過上限 -> 2', clampFlowState(mkChar(), COUNTER_ITEM, { n: 9 }).n, 2);
check('負數 -> 0', clampFlowState(mkChar(), COUNTER_ITEM, { n: -3 }).n, 0);
check('範圍內原樣', clampFlowState(mkChar(), COUNTER_ITEM, { n: 1 }).n, 1);
check('非數字 -> 初始值 0', clampFlowState(mkChar(), COUNTER_ITEM, { n: 'abc' }).n, 0);
check('上限 null 時不夾', clampFlowState(mkChar(), NO_MAX_ITEM, { n: 99 }).n, 99);
check('on 只認布林 true（字串 1 不算）', clampFlowState(mkChar(), COUNTER_ITEM, { n: 1, on: 1 }).on, false);
check('未知條目不會炸（上限視為無）', clampFlowState(mkChar(), { id: 'x', control: {} }, { n: 5 }).n, 5);

// ─────────────────────────────────────────────────────────── G
section('G. flowActionPlan：成本不足要講出現有值');
const QUICK = flowItemForClassSkill('博學士', '快速評估'); // cost.mp = 5
const SHED = flowItemForClassSkill('突變體', '蛻皮');      // cost.hp = 10
const SUMMON = flowItemForHeroic('偉大召喚');              // fp 1 ＋ hp「當前 HP 的一半」
const TACTIC = flowItemForHeroic('多變戰術');              // mp「該咒語 MP」（描述型）
const UPGRADE = flowItemForHeroic('升級');                 // zenit 描述型
const NARRATIVE = flowItemForClassSkill('博學士', '博聞強記');

check('計數器型 -> 不是按鈕型', flowActionPlan(NO_MAX_ITEM, mkChar(), {}).ok, false);
check('計數器型的理由文字', flowActionPlan(NO_MAX_ITEM, mkChar(), {}).reason, '這條不是按鈕型');
check('敘事條目不產生計畫', flowActionPlan(NARRATIVE, mkChar(), {}).ok, false);
check('敘事條目的理由講「敘事」',
  flowActionPlan(NARRATIVE, mkChar(), {}).reason.includes('敘事'), true);

const blocked = flowActionPlan(QUICK, mkChar({ currentMp: 3 }), { stats: { maxMp: 30 } });
check('MP 不足 -> ok:false', blocked.ok, false);
check('MP 不足要帶實際值', blocked.reason, 'MP 不足（需要 5，現有 3）');

const paid = flowActionPlan(QUICK, mkChar({ currentMp: 12 }), { stats: { maxMp: 30 } });
check('MP 足夠 -> ok:true', paid.ok, true);
check('MP 扣款寫進 patch', paid.patch.currentMp, 7);
check('patch 有 flowState 變化', paid.patch.flowState[QUICK.id].n, 1);
check('log.title 非空', paid.log.title.length > 0, true);
check('log.kind 用封閉詞彙 skill', paid.log.kind, 'skill');
check('log.changes 帶前後值', paid.log.changes, [{ field: 'currentMp', from: 12, to: 7 }]);
check('toast 說明扣了什麼', paid.toast.includes('MP 12 → 7'), true);
check('同一個計畫算兩次結果一樣（純函式）', JSON.stringify(flowActionPlan(QUICK, mkChar({ currentMp: 12 }), { stats: { maxMp: 30 } })), JSON.stringify(paid));

const fromMax = flowActionPlan(QUICK, mkChar({ currentMp: null }), { stats: { maxMp: 30 } });
check('currentMp 為 null 時用 stats.maxMp 起算', fromMax.patch.currentMp, 25);

const hpBlocked = flowActionPlan(SHED, mkChar({ currentHp: 8 }), { stats: { maxHp: 30 } });
check('HP 不足 -> 帶現有值的理由', hpBlocked.reason, 'HP 不足（需要 10，現有 8）');
const hpPaid = flowActionPlan(SHED, mkChar({ currentHp: 12 }), { stats: { maxHp: 30 } });
check('HP 扣款寫進 patch', hpPaid.patch.currentHp, 2);

const tactic = flowActionPlan(TACTIC, mkChar({ currentMp: 30 }), { stats: { maxMp: 30 } });
check('描述型成本不擋（ok:true）', tactic.ok, true);
check('描述型成本要回報', tactic.unresolved.length, 1);
check('描述型成本不寫 patch.currentMp', tactic.patch.currentMp, undefined);
check('描述型成本寫進 log.note', String(tactic.log.note || '').includes('該咒語 MP'), true);

const summon = flowActionPlan(SUMMON, mkChar({ fabulaPoints: 1 }), {});
check('物語點扣款寫進 patch', summon.patch.fabulaPoints, 0);
check('物語點扣完的說明在 toast', summon.toast.includes('物語點 1 → 0'), true);
check('同一條的敘述型 HP 成本被列管', summon.unresolved.some((u) => u.label === 'HP'), true);

const upgrade = flowActionPlan(UPGRADE, mkChar({ zenit: 3000 }), {});
check('資金是描述型成本時列管', upgrade.unresolved[0].label, '資金');
check('資金列管時不亂改 patch.zenit', upgrade.patch.zenit, undefined);

const second = flowActionPlan(QUICK, mkChar({
  currentMp: 12,
  flowState: { [QUICK.id]: { n: 1, on: true } }
}), { stats: { maxMp: 30 } });
check('第二次使用累計到 2', second.patch.flowState[QUICK.id].n, 2);

const unknown = flowActionPlan(null, mkChar(), {});
check('找不到條目時回 ok:false 且不炸', unknown.ok, false);
check('找不到條目的理由非空', unknown.reason.length > 0, true);

// ─────────────────────────────────────────────────────────── H
section('H. characterFlowModifiers：existing 條目不准重算（否則加倍）');
const scholarOnly = mkChar();
const existingTotals = characterFlowModifiers(scholarOnly);
check('existing 的「集中」不進 totals.mpMax', existingTotals.totals.mpMax, 0);
check('totals 只有六個欄位', Object.keys(existingTotals.totals).sort(),
  ['def', 'hpMax', 'initiative', 'ipMax', 'mdef', 'mpMax']);
check('場景型的加值進 conditional，不進 totals',
  existingTotals.conditional.some((c) => c.source === '集中' && c.scope === 'scene'), true);
check('existing 條目的條件式說明有標 existing（UI 可以淡化）',
  existingTotals.conditional.find((c) => c.source === '集中')?.existing, true);

// A/B 對照：把同一條的 via 暫時改成 untracked，totals 必須變。
const FOCUS = flowItemForClassSkill('博學士', '集中');
const originalVia = FOCUS.apply.via;
let untrackedTotals;
try {
  FOCUS.apply.via = 'untracked';
  untrackedTotals = characterFlowModifiers(scholarOnly);
} finally {
  FOCUS.apply.via = originalVia;
}
check('改判成 untracked 後 totals.mpMax 變成 9', untrackedTotals.totals.mpMax, 9);
check('還原後 totals.mpMax 回到 0', characterFlowModifiers(scholarOnly).totals.mpMax, 0);
check('permanent 條目會產生 terms', untrackedTotals.terms.some((t) => t.kind === 'mpMax'), true);
check('terms 的 label 是中文', untrackedTotals.terms.find((t) => t.kind === 'mpMax')?.label, '最大 MP +9');

const quirkMods = characterFlowModifiers(mkChar({ classes: [], quirk: '棄暗投明之人' }));
// 金手指**不折進 totals**：它的機械效果住在 `rulesData.quirks[].effects`（由 `getQuirkEffects`
// 承接），而且幾乎都掛在「玩家選了哪個選項」之下。照宣告折進去等於「沒選也給」——
// `test:engine` 的 J7／J8 就是這樣一次紅 6 條（倖存者③的 +2 IP、會說話的野獸的 +2 物防）。
check('金手指的加值不進 totals.hpMax（避免與 getQuirkEffects 重複、也避免沒選選項就給）',
  quirkMods.totals.hpMax, 0);
check('同一條的 mpMax 也不進 totals', quirkMods.totals.mpMax, 0);
check('但金手指的說明照樣列進 conditional（面板要看得到）',
  quirkMods.conditional.some((c) => c.source === '棄暗投明之人'), true);
check('零值的非數值 target 不會混進 terms',
  quirkMods.terms.some((t) => t.kind === 'inventorySlots'), false);
check('permanent 的零值不列進 terms（+0 是噪音）',
  characterFlowModifiers(mkChar({ classes: [], quirk: '武器縛靈' })).terms.length, 0);

const defMods = characterFlowModifiers(mkChar({ classes: [], heroicSkills: ['靈巧雙手'] }));
// 【靈巧雙手】的「物防 +2」條件是「裝備兩種不屬於同類別的武器」。
// 有 `condition` 的條目**一律不折**進 totals——無條件折進去等於空手也給 +2，
// 那是替 GM 改規則。它會出現在 `conditional`，讓玩家看到「+2 — 裝備兩種不同類別武器」。
check('有條件的物防 +2 不進 totals.def', defMods.totals.def, 0);
check('但它會列進 conditional（附條件原文）', defMods.conditional.some(
  (c) => c.source === '靈巧雙手' && c.target === 'def' && /武器/.test(c.condition)
), true);
check('英雄技能的 damage 型加值也不進 totals（target 不在六個數值欄位）',
  characterFlowModifiers(mkChar({ classes: [], heroicSkills: ['強力攻擊'] })).totals.def, 0);

// ── 第二期：結構化條件（`when`）真的會改結果 ──────────────────────────────
// 【靈巧雙手】的 `when` 是 `equippedTwoCategories`。三種裝備狀態給三種結果，
// 這一組就是「條件型加值有沒有真的接上」的驗證：
//   兩把不同類別 → true  → 折進 totals
//   只有一把     → false → 完全不列（技能卡上本來就寫著條件）
//   裝備名查不到 → unknown → 列進 conditional（不確定≠不成立）
const twoWeapons = mkChar({
  classes: [],
  heroicSkills: ['靈巧雙手'],
  equipment: { mainHand: '短匕首', offHand: '鐵指虎', armor: '無裝甲 / 冒險服' }
});
check('when=true：兩把不同類別武器 → 物防 +2 真的折進 totals',
  characterFlowModifiers(twoWeapons).totals.def, 2);
const oneWeapon = mkChar({
  classes: [],
  heroicSkills: ['靈巧雙手'],
  equipment: { mainHand: '短匕首', offHand: '', armor: '無裝甲 / 冒險服' }
});
check('when=false：只有一把武器 → 不折', characterFlowModifiers(oneWeapon).totals.def, 0);
check('when=false：也不列進 conditional（列一條「現在不算」的加值是噪音）',
  characterFlowModifiers(oneWeapon).conditional.some((c) => c.source === '靈巧雙手'), false);
const unknownWeapon = mkChar({
  classes: [],
  heroicSkills: ['靈巧雙手'],
  equipment: { mainHand: '某本新書的武器', offHand: '另一把沒登記的武器', armor: '無裝甲 / 冒險服' }
});
check('when=unknown：裝備名查不到 → 不折（不確定≠成立）',
  characterFlowModifiers(unknownWeapon).totals.def, 0);
check('when=unknown：但會列進 conditional，玩家仍看得到條件原文',
  characterFlowModifiers(unknownWeapon).conditional.some((c) => c.source === '靈巧雙手'), true);
check('空角色 totals 全 0',
  characterFlowModifiers({}).totals, { hpMax: 0, mpMax: 0, ipMax: 0, def: 0, mdef: 0, initiative: 0 });
check('null 角色不炸', characterFlowModifiers(null).terms.length, 0);

// ─────────────────────────────────────────────────────────── I
section('I. 掃描自檢：封閉詞彙（新增值就該轉紅）');
const badKind = FLOW_ITEMS.filter((i) => !FLOW_CONTROL_KINDS.includes(i.control?.kind));
check('每一筆 control.kind 都在封閉詞彙內', badKind.map((i) => i.id), []);
const badTarget = [];
for (const item of FLOW_ITEMS) {
  for (const fx of item.effects || []) {
    if (!FLOW_TARGETS.includes(fx.target)) badTarget.push(`${item.id}:${fx.target}`);
  }
}
check('每一筆 effects[].target 都在封閉詞彙內', badTarget, []);
const badScope = [];
for (const item of FLOW_ITEMS) {
  for (const fx of item.effects || []) {
    if (!FLOW_SCOPES.includes(fx.scope)) badScope.push(`${item.id}:${fx.scope}`);
  }
}
check('每一筆 effects[].scope 都在封閉詞彙內', badScope, []);
check('target 封閉詞彙 21 個', FLOW_TARGETS.length, 21);
check('control 型態封閉詞彙 4 個', FLOW_CONTROL_KINDS.length, 4);
check('每個 id 都以分類為前綴',
  FLOW_ITEMS.filter((i) => !i.id.startsWith(`${i.category}:`)).map((i) => i.id), []);

// ─────────────────────────────────────────────────────────── J
section('J. 不可變更新與「不得使用 eval」');
const before = mkChar({ flowState: { 'class:博學士:集中': { n: 1, on: true } } });
const after = withFlowState(before, COUNTER_ITEM.id, { n: 2, on: true });
check('新值寫進新物件', after.flowState[COUNTER_ITEM.id], { n: 2, on: true });
check('原物件未被修改', before.flowState[COUNTER_ITEM.id], undefined);
check('其他條目的狀態原樣保留', after.flowState['class:博學士:集中'], { n: 1, on: true });
check('沒有 flowState 時可建立',
  withFlowState(mkChar(), COUNTER_ITEM.id, { n: 1, on: false }).flowState[COUNTER_ITEM.id].n, 1);
check('重置回初始值並關掉開關',
  flowResetState(mkChar({ flowState: { [COUNTER_ITEM.id]: { n: 2, on: true } } }), COUNTER_ITEM)
    .flowState[COUNTER_ITEM.id], { n: 0, on: false });

let source = '';
try {
  source = fs.readFileSync(
    new URL('../src/features/character-sheet/utils/effectFlow.js', import.meta.url), 'utf8');
} catch {
  source = fs.readFileSync('src/features/character-sheet/utils/effectFlow.js', 'utf8');
}
check('原始碼不含 eval(', /\beval\s*\(/.test(source), false);
check('原始碼不含 new Function', /new\s+Function\s*\(/.test(source), false);

// ─────────────────────────────────────────────────────────── K
section('K. 金手指 effects 的白名單（寫了卻不讀的鍵會靜默失效）');
// 為什麼要守這一條：`mergeQuirkEffects` 對**任何有限數字鍵**都會累加，
// 但 `getQuirkEffects`（`characterEngine.js`）只轉出固定的十幾個鍵。
// 於是「有人寫了 `effects.check: 2`」不會壞、不會報錯——只是永遠不會生效，
// 而金手指在畫面上看起來完全正常（本專案四次「宣稱已修、實際沒生效」都是這種形狀）。
// 這份清單刻意手寫、刻意與引擎重複：它要回答的問題是「引擎現在認得哪些鍵」，
// 而那個答案只有在有人**同時改兩邊**時才該變。多一個鍵 → 這裡紅 → 逼你去引擎確認。
const QUIRK_FX_KEYS_SUPPORTED = [
  'hp', 'mp', 'ip',
  'resistances', 'vulnerabilities', 'absorption', 'immuneDamage', 'immuneStatuses', 'profs',
  'defIfNoWeapon', 'mdefIfNoWeapon', 'defIfNoArmor', 'mdefIfNoArmor',
  'unarmedDamageBonus', 'unarmedDamageBonusHigh', 'startingZenitBonus'
];
const collectQuirkFxKeys = () => {
  const out = [];
  for (const q of QUIRKS) {
    const push = (where, fx) => {
      for (const k of Object.keys(fx || {})) out.push(`${q.name}${where}:${k}`);
    };
    push('', q.effects);
    (q.options || []).forEach((o) => push(`.${o.id}`, o.effects));
    (q.optionGroups || []).forEach((g) => (g.options || []).forEach((o) => push(`.${g.id}.${o.id}`, o.effects)));
  }
  return out;
};
const allQuirkKeys = collectQuirkFxKeys();
const unknownQuirkKeys = allQuirkKeys
  .filter((entry) => !QUIRK_FX_KEYS_SUPPORTED.includes(entry.split(':').slice(1).join(':')));
check('每一個金手指 effects 的鍵，引擎都讀得懂', unknownQuirkKeys, []);
check('對照組：真的有掃到鍵（否則上一條會恆真）', allQuirkKeys.length > 0, true);
check('白名單本身沒有重複', new Set(QUIRK_FX_KEYS_SUPPORTED).size, QUIRK_FX_KEYS_SUPPORTED.length);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
