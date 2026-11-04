/**
 * 營地活動的效果流程護欄（`IMPL-SPEC.md` §4，2026-11-03）
 *
 * 執行：`npm run test:campoutcome`
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 稽核量到的實況：15 條營地活動**沒有一條會改任何數值**，1d6 表格只被當文字印出來。
 * 這一期把它接上流程，而「接上」最容易壞的三個地方正好都不會報錯：
 *
 *   ① 區間判斷（`3–5`）把 4 判成不命中 → 玩家骰 4 什麼都沒發生，畫面完全正常
 *   ② IP 沒夾上限 → 庫存點變成 9／6，而且存得下去
 *   ③ `manual` 被清空 → App 假裝 `buff` 已經套用，玩家不會去加那個 +4
 *
 * 所以這份測試是**照著「怎麼壞掉」寫的**，不是照著「怎麼正常」寫的。
 *
 * ── 一條不能少的斷言 ────────────────────────────────────────
 *
 * `patch` 只准放**真的算得出來**的欄位。這一條要用「白名單」驗，不能用黑名單：
 * 之後有人新增一個 `effects.restHalfDetail` 之類的鍵時，黑名單不會紅。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CAMP_ACTIVITIES,
  campActivityById
} from '../src/features/character-sheet/data/campActivities.js';
import {
  CAMP_AUTO_KEYS,
  CAMP_BUFF_TARGETS,
  CAMP_BUFF_UNITS,
  CAMP_EFFECT_KEYS,
  CAMP_INGREDIENT_FLAVORS,
  CAMP_MANUAL_KEYS,
  applyCampPlan,
  campActivityRollLabel,
  campGourmetSl,
  campZenitAmount,
  describeCampOutcome,
  parseCampRollRange,
  planCampActivity,
  rollCampResult
} from '../src/features/character-sheet/utils/campOutcome.js';
import { TASTE_ROLL, ingredientCapacity } from '../src/features/character-sheet/data/gourmetData.js';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';
import CampActivitiesBlock from '../src/features/character-sheet/components/CampActivitiesBlock.jsx';

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
const section = (title) => lines.push(`\n=== ${title} ===`);
const plain = (html) => String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '');

const theme = getCharacterTheme('parchment');

/** 一份「什麼都有的」測試角色——刻意不用真存檔（`createNewCharacter` 會帶很多預設值進來）。 */
const makeCharacter = (overrides = {}) => ({
  name: '測試角色',
  level: 10,
  zenit: 500,
  currentIp: 2,
  campActivities: {
    picked: ['exploration', 'gathering', 'massage', 'combatLesson', 'midnightOil', 'campForge'],
    used: []
  },
  classes: [{ className: '美食家', skills: [{ name: '烹飪', sl: 2 }] }],
  gourmetData: { ingredients: [], cookbook: {} },
  tinkererData: {
    projects: [{ id: 'proj_1', name: '蒸氣鍋爐', totalClock: 8, filledClock: 2, completed: false }]
  },
  log: [],
  ...overrides
});

const STATS = { maxIp: 6 };
const PATCH_WHITELIST = ['currentIp', 'zenit', 'gourmetData', 'tinkererData', 'campActivities'];
const patchKeysOutsideWhitelist = (patch) => Object.keys(patch).filter((key) => !PATCH_WHITELIST.includes(key));

// ─────────────────────────────────────────────────────────── A
section('A. 1d6 查表：六個面都對得上（含 3–5 區間）');

const exploration = campActivityById('exploration');
const gathering = campActivityById('gathering');

check('列號解析：1 → 1–1', parseCampRollRange('1'), { lo: 1, hi: 1 });
check('列號解析：3–5 → 3–5', parseCampRollRange('3–5'), { lo: 3, hi: 5 });
check('列號解析：容忍 ASCII 連字號', parseCampRollRange('3-5'), { lo: 3, hi: 5 });
check('列號解析：容忍波浪號', parseCampRollRange('3~5'), { lo: 3, hi: 5 });
check('列號解析：非法列號回 null', parseCampRollRange('7–9'), null);

/**
 * 查表結果用 null 安全的方式取值。
 *
 * 這一支不是潔癖：第一版直接寫 `rollCampResult(...).roll`，於是「區間判斷壞掉」
 * 的刻意破壞驗證是**整個程式 crash**（TypeError），而不是一行 FAIL。
 * crash 當然也算紅，但報告裡看不出「哪一條規格破了」，而那正是這份測試的用途。
 */
const found = (activity, d6) => rollCampResult(activity, d6) || {};
const rollOf = (activity, d6) => found(activity, d6).roll ?? null;

check('探索 d6=1 → 第 1 列', rollOf(exploration, 1), '1');
check('探索 d6=2 → 第 2 列', rollOf(exploration, 2), '2');
check('探索 d6=3 → 3–5', rollOf(exploration, 3), '3–5');
check('探索 d6=4 → 3–5（區間要真的判斷，不是只比端點）', rollOf(exploration, 4), '3–5');
check('探索 d6=5 → 3–5', rollOf(exploration, 5), '3–5');
check('探索 d6=6 → 第 6 列', rollOf(exploration, 6), '6');
check('探索六個面逐一面對', [1, 2, 3, 4, 5, 6].map((d6) => rollOf(exploration, d6)),
  ['1', '2', '3–5', '3–5', '3–5', '6']);
check('採集六個面逐一面對', [1, 2, 3, 4, 5, 6].map((d6) => rollOf(gathering, d6)),
  ['1', '2', '3–5', '3–5', '3–5', '6']);
check('查表結果帶著原始骰值', found(exploration, 4).d6, 4);
check('查表結果帶著原文', String(found(exploration, 6).text).includes('中大獎'), true);
check('沒有 table 的活動回 null（不是 crash）', rollCampResult(campActivityById('massage'), 4), null);
check('沒有 table 的活動對任何骰值都回 null',
  [1, 2, 3, 4, 5, 6].map((d6) => rollCampResult(campActivityById('midnightOil'), d6)),
  [null, null, null, null, null, null]);
check('未定義的活動回 null', rollCampResult(undefined, 4), null);
check('骰值 0 回 null', rollCampResult(exploration, 0), null);
check('骰值 7 回 null', rollCampResult(exploration, 7), null);
check('非整數骰值回 null', rollCampResult(exploration, 1.5), null);
check('非數字骰值回 null', rollCampResult(exploration, '中大獎'), null);
check('用列號查表也可以（3–5）', rollOf(exploration, '3–5'), '3–5');

// ─────────────────────────────────────────────────────────── B
section('B. 資料層：outcomes 是原文的結構化版本，不是新寫的規則');

check('15 條都有 outcomes', CAMP_ACTIVITIES.every((a) => Array.isArray(a.outcomes) && a.outcomes.length > 0), true);
check('有 table 的活動：outcomes 與表格列數相同',
  CAMP_ACTIVITIES.filter((a) => Array.isArray(a.table)).map((a) => [a.outcomes.length, a.table.length]),
  [[4, 4], [4, 4]]);
check('有 table 的活動：outcomes 的 roll 標籤與表格列號逐字相同',
  CAMP_ACTIVITIES.filter((a) => Array.isArray(a.table))
    .map((a) => a.outcomes.map((o) => o.roll).join('|') === a.table.map((r) => r.roll).join('|')),
  [true, true]);
check('表格列的 short 逐字取自該列原文（不准發明文案）',
  CAMP_ACTIVITIES.filter((a) => Array.isArray(a.table)).flatMap((a) => a.table
    .map((row, index) => Boolean(a.outcomes[index].short) && row.text.startsWith(a.outcomes[index].short))),
  [true, true, true, true, true, true, true, true]);
check('effects 的鍵都在封閉詞彙內',
  CAMP_ACTIVITIES.flatMap((a) => a.outcomes.flatMap((o) => Object.keys(o.effects)))
    .filter((key) => !CAMP_EFFECT_KEYS.includes(key)),
  []);
check('buff.target 都在封閉詞彙內',
  CAMP_ACTIVITIES.flatMap((a) => a.outcomes)
    .filter((o) => o.effects.buff)
    .map((o) => o.effects.buff.target)
    .filter((target) => !CAMP_BUFF_TARGETS[target]),
  []);
check('buff.unit 都在封閉詞彙內（flat／times）',
  CAMP_ACTIVITIES.flatMap((a) => a.outcomes)
    .filter((o) => o.effects.buff)
    .map((o) => o.effects.buff.unit)
    .filter((unit) => !CAMP_BUFF_UNITS[unit]),
  []);
check('每一條 buff 都有一句 condition（不然玩家不知道怎麼用）',
  CAMP_ACTIVITIES.flatMap((a) => a.outcomes)
    .filter((o) => o.effects.buff)
    .every((o) => typeof o.effects.buff.condition === 'string' && o.effects.buff.condition.length > 8), true);
check('once: true 的 12 條，後果一律是一場一次性權利（buff）',
  CAMP_ACTIVITIES.filter((a) => a.once).map((a) => Boolean(a.outcomes[0].effects.buff)),
  Array.from({ length: 12 }, () => true));
check('抱佛腳 = 專案 3 點進度', campActivityById('midnightOil').outcomes[0].effects, { projectProgress: 3 });
check('探索 6 的資金是「等級 × 50」的算式，不是寫死數字',
  exploration.outcomes[3].effects.zenit, 'level * 50');
check('探索 2 = 2 點 IP（CHM 測試版寫 1 點）', exploration.outcomes[1].effects.ip, 2);
check('探索 1 = 休息恢復減半', exploration.outcomes[0].effects.restHalf, true);
check('採集 1 = 衝突', gathering.outcomes[0].effects.encounter, true);
check('採集 2 = 2 份隨機口味', gathering.outcomes[1].effects.ingredients, { count: 2, flavor: 'random' });
check('採集 6 = 3 份各自任選', gathering.outcomes[3].effects.ingredients, { count: 3, flavor: 'choose' });
check('食材口味只有兩種合法值',
  CAMP_ACTIVITIES.flatMap((a) => a.outcomes)
    .map((o) => o.effects.ingredients && o.effects.ingredients.flavor)
    .filter(Boolean)
    .filter((flavor) => !CAMP_INGREDIENT_FLAVORS.includes(flavor)),
  []);
check('自動與人工的鍵加起來等於封閉詞彙（沒有第三類）',
  [...CAMP_AUTO_KEYS, ...CAMP_MANUAL_KEYS].sort(), [...CAMP_EFFECT_KEYS].sort());

// ─────────────────────────────────────────────────────────── C
section('C. 一句標籤：探索 d6=6：中大獎！');

check('骰值標籤', campActivityRollLabel(exploration, { d6: 6, short: '中大獎！' }), '探索 d6=6：中大獎！');
check('沒有骰值時只回活動名（不印 d6=null）', campActivityRollLabel(campActivityById('massage'), { d6: null }), '按摩');
check('沒有 result 時只回活動名', campActivityRollLabel(campActivityById('massage'), null), '按摩');
check('沒有活動時回空字串', campActivityRollLabel(null, { d6: 3 }), '');

// ─────────────────────────────────────────────────────────── D
section('D. planCampActivity：patch 只放真的算得出來的欄位');

const planExplore4 = planCampActivity(makeCharacter(), exploration, { d6: 4, stats: STATS });
check('探索 d6=4 算得出來', planExplore4.ok, true);
check('探索 d6=4 的 patch 鍵', Object.keys(planExplore4.patch), ['currentIp']);
check('patch 沒有白名單以外的鍵', patchKeysOutsideWhitelist(planExplore4.patch), []);
check('patch 裡沒有 restHalf／encounter／buff',
  ['restHalf', 'encounter', 'buff'].filter((key) => key in planExplore4.patch), []);
check('探索 d6=4 沒有要玩家自己做的事', planExplore4.manual, []);
check('探索 d6=4 的 toast 講出前後值', planExplore4.toast.includes('庫存點 2 → 5'), true);

const planExplore1 = planCampActivity(makeCharacter(), exploration, { d6: 1, stats: STATS });
check('探索 d6=1 不改任何數值（patch 全空）', Object.keys(planExplore1.patch), []);
check('探索 d6=1 把「恢復減半」列進 manual',
  planExplore1.manual.some((line) => line.includes('一半')), true);
check('探索 d6=1 的 manual 是給人看的一句話（不是物件）',
  planExplore1.manual.every((line) => typeof line === 'string' && line.length > 8), true);

const planGather1 = planCampActivity(makeCharacter(), gathering, { d6: 1, stats: STATS });
check('採集 d6=1：patch 不含 encounter', 'encounter' in planGather1.patch, false);
check('採集 d6=1：manual 叫玩家去開一場衝突',
  planGather1.manual.some((line) => line.includes('簡單衝突')), true);

const planMassage = planCampActivity(makeCharacter(), campActivityById('massage'), { stats: STATS, target: '隊友甲' });
check('按摩：patch 只有 campActivities（一次性權利不自動改數值）',
  Object.keys(planMassage.patch), ['campActivities']);
check('按摩：manual 帶出原文的排除條件（儀式）',
  planMassage.manual.some((line) => line.includes('儀式')), true);
check('按摩：manual 明確說「App 不會自動改數值」',
  planMassage.manual.some((line) => line.includes('App 不會自動改數值')), true);
check('按摩：manual 至少兩行（權利 ＋ 「App 不會自動改數值」）',
  planMassage.manual.length >= 2, true);
check('按摩：沒有指定盟友時會多一行提醒',
  planCampActivity(makeCharacter(), campActivityById('massage'), { stats: STATS })
    .manual.some((line) => line.includes('一個盟友')), true);

const planCombatNoTarget = planCampActivity(makeCharacter(), campActivityById('combatLesson'), { stats: STATS });
check('盟友型活動沒指定目標 → manual 提醒指定',
  planCombatNoTarget.manual.some((line) => line.includes('盟友')), true);
check('戰鬥課程 +4 有寫進 manual 的數值',
  planCombatNoTarget.manual.some((line) => line.includes('+4')), true);

const planForge = planCampActivity(makeCharacter(), campActivityById('campForge'), { stats: STATS });
check('營地打造：三個選項逐條列進 manual',
  ['修復', '免費製作', '拆解'].every((word) => planForge.manual.some((line) => line.includes(word))), true);
check('營地打造：patch 不含任何裝備欄位',
  patchKeysOutsideWhitelist(planForge.patch), []);

// ─────────────────────────────────────────────────────────── E
section('E. IP：一定夾在上限內');

check('IP 2 + 3 = 5（上限 6）', planCampActivity(makeCharacter({ currentIp: 2 }), exploration, { d6: 4, stats: STATS }).patch.currentIp, 5);
check('IP 5 + 3 夾在 6', planCampActivity(makeCharacter({ currentIp: 5 }), exploration, { d6: 4, stats: STATS }).patch.currentIp, 6);
/**
 * `currentIp` 的 `null`／`undefined` 是「滿的」語意（同一條規則住在 `CharacterPlayHUD` 的
 * `curIp`）。所以「滿的 + 3」不是「變成 3」，也不是「變成 9」——**不寫**，改成請玩家自己看。
 */
check('currentIp 為 null（滿的）→ 不改數值',
  Object.keys(planCampActivity(makeCharacter({ currentIp: null }), exploration, { d6: 4, stats: STATS }).patch), []);
check('currentIp 為 undefined（滿的）→ 不改數值',
  Object.keys(planCampActivity(makeCharacter({ currentIp: undefined }), exploration, { d6: 4, stats: STATS }).patch), []);
check('currentIp 為 null 時 manual 說明已滿',
  planCampActivity(makeCharacter({ currentIp: null }), exploration, { d6: 4, stats: STATS })
    .manual.some((line) => line.includes('已經是上限')), true);
check('IP 已滿 → 不改數值，改成 manual',
  Object.keys(planCampActivity(makeCharacter({ currentIp: 6 }), exploration, { d6: 4, stats: STATS }).patch),
  []);
check('IP 已滿時 manual 說明沒有實際效果',
  planCampActivity(makeCharacter({ currentIp: 6 }), exploration, { d6: 4, stats: STATS })
    .manual.some((line) => line.includes('沒有實際效果')), true);
check('沒有 stats → 不猜上限，改成 manual',
  Object.keys(planCampActivity(makeCharacter(), exploration, { d6: 4 }).patch), []);
check('沒有 stats 時 manual 說明上限算不出來',
  planCampActivity(makeCharacter(), exploration, { d6: 4 }).manual.some((line) => line.includes('上限算不出來')), true);
check('上限 0（沒有庫存點）→ 不會寫出負數或超過 0',
  planCampActivity(makeCharacter({ currentIp: 0 }), exploration, { d6: 4, stats: { maxIp: 0 } }).patch.currentIp,
  undefined);

// ─────────────────────────────────────────────────────────── F
section('F. 資金：走 applyMoneyFlow，原因必填');

const level10 = makeCharacter({ level: 10, zenit: 500 });
const planExplore6 = planCampActivity(level10, exploration, { d6: 6, stats: STATS });
check('等級 10 → 500z', campZenitAmount('level * 50', 10), 500);
check('等級 1 → 50z', campZenitAmount('level * 50', 1), 50);
check('中文寫法也認（等級 × 50）', campZenitAmount('等級 × 50', 7), 350);
check('純數字照收', campZenitAmount(120, 10), 120);
check('看不懂的算式回 null（不猜 0）', campZenitAmount('SL * 5', 10), null);
check('等級未知回 null', campZenitAmount('level * 50', null), null);
check('探索 d6=6：錢包 500 → 1000', planExplore6.patch.zenit, 1000);
check('探索 d6=6：同時給 IP', planExplore6.patch.currentIp, 5);
check('探索 d6=6：plan.money 一筆、方向為獲得', planExplore6.money.map((m) => m.direction), ['gain']);
check('探索 d6=6：plan.money 金額 500z', planExplore6.money.map((m) => m.amount), [500]);
check('探索 d6=6：原因必填且帶活動名',
  planExplore6.money[0].reason.includes('營地活動【探索】'), true);
check('錢包金額未知 → 不寫 zenit（避免把錢包寫成 null）',
  'zenit' in planCampActivity(makeCharacter({ zenit: null }), exploration, { d6: 6, stats: STATS }).patch, false);
check('錢包金額未知時 manual 說清楚',
  planCampActivity(makeCharacter({ zenit: null }), exploration, { d6: 6, stats: STATS })
    .manual.some((line) => line.includes('錢包金額尚未記錄')), true);

// ─────────────────────────────────────────────────────────── G
section('G. 一次性權利：用了就標記，第二次擋下來');

check('按摩套用後標記 used',
  planMassage.patch.campActivities.used, ['massage']);
check('已用過 → 拒絕', planCampActivity(
  makeCharacter({ campActivities: { picked: ['massage'], used: ['massage'] } }),
  campActivityById('massage'),
  { stats: STATS }
).ok, false);
check('已用過的訊息帶活動名',
  planCampActivity(
    makeCharacter({ campActivities: { picked: ['massage'], used: ['massage'] } }),
    campActivityById('massage'),
    { stats: STATS }
  ).reason.includes('【按摩】'), true);
check('沒選的活動不能用', planCampActivity(
  makeCharacter({ campActivities: { picked: ['massage'], used: [] } }),
  exploration,
  { d6: 4, stats: STATS }
).ok, false);
check('沒選的訊息說「沒有在創角時選定」', planCampActivity(
  makeCharacter({ campActivities: { picked: ['massage'], used: [] } }),
  exploration,
  { d6: 4, stats: STATS }
).reason.includes('沒有在創角時選定'), true);
check('once: false 的活動不寫 used（探索可以再骰）',
  'campActivities' in planExplore4.patch, false);
check('本輪休息回充後可以再用',
  planCampActivity(
    makeCharacter({ campActivities: { picked: ['massage'], used: [] } }),
    campActivityById('massage'),
    { stats: STATS }
  ).ok, true);
check('未知的活動 id 回 ok:false', planCampActivity(makeCharacter(), '不存在', {}).ok, false);

// ─────────────────────────────────────────────────────────── H
section('H. 要先有骰值，不能自己假設一面');

const noDie = planCampActivity(makeCharacter(), exploration, { stats: STATS });
check('沒有骰值 → ok:false', noDie.ok, false);
check('沒有骰值的訊息寫出 1d6', noDie.reason.includes('1d6'), true);
check('拒絕時 patch 是空的', noDie.patch, {});
check('拒絕時 manual 是空的', noDie.manual, []);
check('拒絕時 toast 等於 reason', noDie.toast, noDie.reason);

// ─────────────────────────────────────────────────────────── I
section('I. 食材：接上既有的 gourmetData（含上限、口味、非美食家擋）');

const planGather3 = planCampActivity(makeCharacter(), gathering, { d6: 3, stats: STATS });
check('沒骰口味 → 不寫 gourmetData', 'gourmetData' in planGather3.patch, false);
check('沒骰口味 → manual 說明要再骰 d6',
  planGather3.manual.some((line) => line.includes('再骰 d6')), true);

const planGather3Taste = planCampActivity(makeCharacter(), gathering, {
  d6: 3,
  stats: STATS,
  tasteRolls: [1, 2, 3]
});
check('骰出口味 → 寫入 3 份食材',
  planGather3Taste.patch.gourmetData.ingredients.map((item) => item.taste), ['苦味', '鹹味', '酸味']);
check('食材名稱沿用美食家面板的格式',
  planGather3Taste.patch.gourmetData.ingredients.map((item) => item.name), ['苦味食材', '鹹味食材', '酸味食材']);
check('食材 id 可預測（純函式，不用 Date.now）',
  planGather3Taste.patch.gourmetData.ingredients[0].id, 'ing_camp_gathering_1');
check('食材保留原有的 cookbook 欄位',
  planGather3Taste.patch.gourmetData.cookbook, {});

const planGatherFree = planCampActivity(makeCharacter(), gathering, {
  d6: 3,
  stats: STATS,
  tasteRolls: [1, 6, 3]
});
check('有一份骰出 6（由你決定）→ 整批不代填', 'gourmetData' in planGatherFree.patch, false);
check('骰出 6 → manual 說明由你決定',
  planGatherFree.manual.some((line) => line.includes('由你決定')), true);

const planGatherChoose = planCampActivity(makeCharacter(), gathering, { d6: 6, stats: STATS, tasteRolls: [1, 2, 3] });
check('味道各自任選 → 不代填', 'gourmetData' in planGatherChoose.patch, false);
check('味道各自任選 → manual 叫玩家自己指定',
  planGatherChoose.manual.some((line) => line.includes('任選')), true);

check('採集骰值 2 → 2 份',
  planCampActivity(makeCharacter(), gathering, { d6: 2, stats: STATS, tasteRolls: [4, 5] })
    .patch.gourmetData.ingredients.length, 2);

const fullIngredients = Array.from({ length: ingredientCapacity(2) - 1 }, (_, i) => ({
  id: `ing_old_${i}`,
  name: '苦味食材',
  taste: '苦味'
}));
const planGatherFull = planCampActivity(
  makeCharacter({ gourmetData: { ingredients: fullIngredients, cookbook: {} } }),
  gathering,
  { d6: 3, stats: STATS, tasteRolls: [1, 2, 3] }
);
check('超過食材上限 → 不寫入', 'gourmetData' in planGatherFull.patch, false);
check('超過食材上限 → manual 寫出上限與現有數',
  planGatherFull.manual.some((line) => line.includes('食材已達上限') && line.includes(String(ingredientCapacity(2)))), true);

const planNoGourmet = planCampActivity(makeCharacter({ classes: [] }), gathering, {
  d6: 3,
  stats: STATS,
  tasteRolls: [1, 2, 3]
});
check('沒有美食家 → 不寫入', 'gourmetData' in planNoGourmet.patch, false);
check('沒有美食家 → manual 說明目標限制',
  planNoGourmet.manual.some((line) => line.includes('美食家')), true);
check('美食家 SL 讀的是烹飪技能的 SL', campGourmetSl(makeCharacter()), 2);
check('沒有美食家時 SL 為 0', campGourmetSl(makeCharacter({ classes: [] })), 0);

// ─────────────────────────────────────────────────────────── J
section('J. 抱佛腳：指定專案才算得出來，且夾在命刻上限');

const oil = campActivityById('midnightOil');
const planOilNoTarget = planCampActivity(makeCharacter(), oil, { stats: STATS });
check('沒指定專案 → 不寫 tinkererData', 'tinkererData' in planOilNoTarget.patch, false);
check('沒指定專案 → manual 列出未完成的專案',
  planOilNoTarget.manual.some((line) => line.includes('蒸氣鍋爐')), true);

const planOil = planCampActivity(makeCharacter(), oil, { stats: STATS, target: 'proj_1' });
check('指定專案 → 進度 2 → 5', planOil.patch.tinkererData.projects[0].filledClock, 5);
check('指定專案 → 還沒完工', planOil.patch.tinkererData.projects[0].completed, false);
check('指定專案 → patch 只有 tinkererData', Object.keys(planOil.patch), ['tinkererData']);
const planOilDone = planCampActivity(
  makeCharacter({
    tinkererData: { projects: [{ id: 'proj_1', name: '蒸氣鍋爐', totalClock: 8, filledClock: 7, completed: false }] }
  }),
  oil,
  { stats: STATS, target: 'proj_1' }
);
check('進度夾在 totalClock', planOilDone.patch.tinkererData.projects[0].filledClock, 8);
check('填滿就標記完工', planOilDone.patch.tinkererData.projects[0].completed, true);
check('沒有專案 → manual 說明先去建一個',
  planCampActivity(makeCharacter({ tinkererData: { projects: [] } }), oil, { stats: STATS })
    .manual.some((line) => line.includes('造物工坊')), true);

// ─────────────────────────────────────────────────────────── K
section('K. 履歷：一筆 camp，帶前後值');

check('log 的 kind 是 camp', planExplore6.log.kind, 'camp');
check('log 標題帶骰值', planExplore6.log.title.includes('d6 = 6'), true);
check('log 帶 IP 前後值',
  planExplore6.log.changes.find((change) => change.field === 'currentIp'), { field: 'currentIp', from: 2, to: 5 });
check('log 帶資金前後值',
  planExplore6.log.changes.find((change) => change.field === 'zenit'), { field: 'zenit', from: 500, to: 1000 });
check('log 的 note 寫出要做的事',
  planMassage.log.note.includes('需自行處理'), true);
check('沒有要自己做的事時 note 不寫「需自行處理」',
  planExplore6.log.note.includes('需自行處理'), false);

// ─────────────────────────────────────────────────────────── L
section('L. applyCampPlan：錢走 applyMoneyFlow，所以有一筆 trade 履歷');

const applied = applyCampPlan(makeCharacter(), planExplore6);
check('套用後錢包 1000', applied.zenit, 1000);
check('套用後 IP 5', applied.currentIp, 5);
check('套用後營地活動標記 used（once 的活動）',
  applyCampPlan(makeCharacter(), planMassage).campActivities.used, ['massage']);
check('探索不是 once，套用後不會被鎖住',
  applyCampPlan(makeCharacter(), planExplore6).campActivities.used, []);
check('履歷含一筆 trade（錢有原因）',
  applied.log.filter((entry) => entry.kind === 'trade').length, 1);
check('履歷含一筆 camp（活動本身）',
  applied.log.filter((entry) => entry.kind === 'camp').length, 1);
check('trade 履歷的標題帶活動名',
  applied.log.find((entry) => entry.kind === 'trade').title.includes('探索'), true);
check('套用不會就地修改原物件', makeCharacter().zenit, 500);
check('ok:false 的 plan 原樣回傳', applyCampPlan(makeCharacter(), noDie).zenit, 500);

// ─────────────────────────────────────────────────────────── M
section('M. describeCampOutcome：一句 toast');

check('成功時講出活動與骰值', describeCampOutcome(planExplore6).includes('營地活動【探索】 d6 = 6'), true);
check('成功時講出結果原文', describeCampOutcome(planExplore6).includes('中大獎'), true);
check('成功時講出 IP 變化', describeCampOutcome(planExplore6).includes('庫存點 2 → 5'), true);
check('有 manual 時提示還有幾項要自己處理',
  describeCampOutcome(planMassage).includes('要自己處理'), true);
check('失敗時回 reason', describeCampOutcome(noDie), noDie.reason);
check('空 plan 回空字串', describeCampOutcome(null), '');

// ─────────────────────────────────────────────────────────── N
section('N. 介面：跑團模式才有操作列，建角模式逐字不變');

const playChar = makeCharacter({
  campActivities: { picked: ['exploration', 'massage'], used: [] }
});
const editHtml = renderToStaticMarkup(React.createElement(CampActivitiesBlock, {
  character: playChar,
  theme,
  mode: 'edit',
  allowance: 2,
  onChange: () => {}
}));
check('建角模式沒有操作列', editHtml.includes('camp-action-'), false);
check('建角模式沒有「擲 d6」', plain(editHtml).includes('擲 d6'), false);
check('建角模式仍然列得出表格', plain(editHtml).includes('中大獎'), true);

const unwiredHtml = renderToStaticMarkup(React.createElement(CampActivitiesBlock, {
  character: playChar,
  theme,
  mode: 'play',
  allowance: 2,
  onChange: () => {}
}));
check('沒有 onApply 時不畫假按鈕', unwiredHtml.includes('camp-roll-exploration'), false);
check('沒有 onApply 時明講入口沒接', unwiredHtml.includes('camp-apply-unwired-exploration'), true);

const wiredHtml = renderToStaticMarkup(React.createElement(CampActivitiesBlock, {
  character: playChar,
  theme,
  mode: 'play',
  allowance: 2,
  onChange: () => {},
  onApply: () => {},
  stats: STATS
}));
const wiredText = plain(wiredHtml);
check('有 table 的活動有「擲 d6」', wiredHtml.includes('camp-roll-exploration'), true);
check('有 table 的活動有「套用」', wiredText.includes('套用'), true);
check('一次性活動有「使用（本次休息一次）」', wiredText.includes('使用（本次休息一次）'), true);
check('一次性活動沒有擲骰鈕', wiredHtml.includes('camp-roll-massage'), false);
check('操作列帶各自活動的 testid', wiredHtml.includes('camp-apply-massage'), true);

// ─────────────────────────────────────────────────────────── 結果
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
if (fail > 0) lines.push(`\n失敗 ${fail} 項`);
console.log(lines.join('\n'));
process.exit(fail > 0 ? 1 : 0);
