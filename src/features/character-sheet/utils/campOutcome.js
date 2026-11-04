/**
 * 營地活動的效果流程（`IMPL-SPEC.md` §4，2026-11-03）
 *
 * ## 這一支在補什麼缺口
 *
 * 稽核（`scratch/flows/camp.json`）量到的實況：15 條營地活動**沒有一條會改任何數值**，
 * 跑團面板上只有「標記使用」與「清空已使用」兩個開關。玩家照著原書在休息場景骰了
 * 探索的 1d6，App 既不查表也不寫 IP，於是那張表等於一段說明文字。
 *
 * ## 三層分工（缺一層就會出現「畫面說好了、數字沒動」）
 *
 *   資料層 `data/campActivities.js` 的 `outcomes`  ← 原文的結構化後果（只結構化，不新增規則）
 *   這一支 `rollCampResult` / `planCampActivity`   ← 純計算，回一份「按了會發生什麼」
 *   介面層 `components/CampActivitiesBlock.jsx`    ← 只呼叫 `onApply(plan)`，不自己寫角色
 *
 * 純函式：不讀 DOM、不讀 localStorage、不 import React（SSR 測試才跑得動，
 * `docs/decisions.md` §AW6(b)）。寫入一律交給呼叫端。
 *
 * ## 最重要的一條：**算不出來的東西不准放進 `patch`**
 *
 * `patch` 是「呼叫端可以直接鋪回角色的欄位」。放進去的每一個值都必須是這一支真的算出來的：
 *
 *   `currentIp`（夾在 `stats.maxIp`）、`zenit`（走 `applyMoneyFlow`）、
 *   `gourmetData`（食材份數與口味都確定時）、`tinkererData`（指定了哪個專案時）、
 *   `campActivities`（本次休息已使用）
 *
 * 其餘一律進 `manual` —— 那是**給玩家看的清單**：
 *
 *   `buff`（本次休息到下次休息的一次性權利）、`restHalf`（休息恢復減半）、
 *   `encounter`（整團被捲入衝突）
 *
 * 這一條不是潔癖。把 `buff` 塞進 `patch` 的話，畫面會顯示「已套用」而角色身上什麼都沒變，
 * 而玩家在下一次檢定時不會去加那個 +4——那是這一專案最貴的一種 bug（靜默且無回報）。
 *
 * ## 錢只走一條路
 *
 * `patch.zenit` 只是**算出來的結果值**（給不想接 `applyMoneyFlow` 的呼叫端參考）。
 * 真正寫入請用 `plan.money`：`{ direction: 'gain', amount, reason }`，原因必填
 * （`utils/zenitFeedback.js` 的 `describeMoneyFlow` 會擋空原因）。
 * 懶得自己接就用 `applyCampPlan(character, plan)`——它內部呼叫 `applyMoneyFlow`，
 * 所以錢那一筆會留下 `kind: 'trade'` 的履歷，不會變成「沒有原因的 +350z」。
 */

import {
  campActivityById,
  normalizeCampActivities,
  setCampActivityUsed
} from '../data/campActivities';
import { TASTE_ROLL, TASTE_SHORT, ingredientCapacity } from '../data/gourmetData';
import { loggableChange } from './characterLog';
import { applyMoneyFlow } from './moneyFlow';
import { asCount } from './playAvailability';
import { formatZenit } from './zenitFeedback';

/* ─────────────────────────────────────────────────────────────
   封閉詞彙（測試會逐筆掃資料層，超出就紅）
   ───────────────────────────────────────────────────────────── */

/**
 * `effects.buff.target` 的封閉詞彙。
 *
 * 刻意不叫 `check`／`damage`（那是 `effectFlows.json` 的詞彙）：營地活動的權利
 * 有一半不是「檢定加值」而是倍率或屬性（HP 損失減半、攻擊取得多重），
 * 硬套同一組詞只會讓 `daydream` 這種條目被迫寫成「其他」。
 */
export const CAMP_BUFF_TARGETS = Object.freeze({
  check: '檢定結果',
  attack: '攻擊的多重屬性',
  hpLoss: '一次 HP 損失',
  hpRecover: '一次 HP 恢復',
  mpRecover: '一次 MP 恢復',
  mpCost: '一次 MP 成本',
  action: '自己的回合行動',
  status: '同一來源的狀態效果',
  travelMove: '團隊的旅行移動骰',
  spell: '盟友可施展的咒語',
  item: '裝備與材料'
});

/** `effects.buff.unit`：`flat` = 固定加值，`times` = 倍率（減半是 0.5，不是 -50%）。 */
export const CAMP_BUFF_UNITS = Object.freeze({
  flat: '加值',
  times: '倍率'
});

/** `effects` 允許的鍵（封閉詞彙）。 */
export const CAMP_EFFECT_KEYS = Object.freeze([
  'ip',
  'zenit',
  'ingredients',
  'restHalf',
  'encounter',
  'buff',
  'projectProgress'
]);

/** `effects.ingredients.flavor`：`random` = 各再骰 d6，`choose` = 各自任選。 */
export const CAMP_INGREDIENT_FLAVORS = Object.freeze(['random', 'choose']);

/** 真的算得出來、可以進 `patch` 的鍵（其餘一律進 `manual`）。 */
export const CAMP_AUTO_KEYS = Object.freeze(['ip', 'zenit', 'ingredients', 'projectProgress']);

/** 算不出來、只能請玩家自己做的鍵。 */
export const CAMP_MANUAL_KEYS = Object.freeze(['buff', 'restHalf', 'encounter']);

/* ─────────────────────────────────────────────────────────────
   1d6 查表
   ───────────────────────────────────────────────────────────── */

/**
 * 把表格列號（`'1'`／`'3–5'`／`'6'`）解析成閉區間。
 *
 * `–`（U+2013）是資料層實際使用的連接號，但全形減號、波浪號、`~` 也可能從
 * 手寫資料或複製貼上進來，所以一律先正規化再解析。解析不出來回 `null`
 * ——**不要猜**：猜錯的那一格會在不該命中的骰值上命中，而畫面看起來完全正常。
 */
export const parseCampRollRange = (label) => {
  const text = String(label ?? '').trim().replace(/\s+/g, '').replace(/[–—−~～]/g, '-');
  const matched = /^(\d)(?:-(\d))?$/.exec(text);
  if (!matched) return null;
  const lo = Number(matched[1]);
  const hi = matched[2] === undefined ? lo : Number(matched[2]);
  if (!Number.isInteger(lo) || !Number.isInteger(hi)) return null;
  if (lo < 1 || hi > 6 || lo > hi) return null;
  return { lo, hi };
};

const sameRange = (a, b) => {
  const left = parseCampRollRange(a);
  const right = parseCampRollRange(b);
  if (!left || !right) return String(a) === String(b);
  return left.lo === right.lo && left.hi === right.hi;
};

/**
 * 骰值 → 對應的那一筆 `outcomes`。
 *
 * 沒有 `table` 的活動（13 條）回 `null`——**不是 crash**：呼叫端拿到的是一支
 * 可以對任何活動呼叫的函式，回 `null` 才問得出「這條是不是要先骰」。
 *
 * `3–5` 這種區間會真的判斷（4 會命中，不是只有 3 與 5）。
 *
 * @param {object} activity 資料層的活動
 * @param {number|string} d6 骰值（1–6），或表格列號（`'3–5'`，給沒有真骰值的場合）
 * @returns {{roll:string, text:string, short:string|undefined, effects:object, d6:number|null, index:number}|null}
 */
export const rollCampResult = (activity, d6) => {
  const rows = Array.isArray(activity?.table) ? activity.table : [];
  if (rows.length === 0) return null;
  const outcomes = Array.isArray(activity?.outcomes) ? activity.outcomes : [];

  let index = -1;
  let die = null;
  const numeric = asCount(d6);

  if (numeric !== null && Number.isInteger(numeric)) {
    index = rows.findIndex((row) => {
      const range = parseCampRollRange(row.roll);
      return Boolean(range) && numeric >= range.lo && numeric <= range.hi;
    });
    die = numeric;
  } else if (typeof d6 === 'string') {
    index = rows.findIndex((row) => sameRange(row.roll, d6));
  }

  if (index < 0) return null;
  const row = rows[index];
  // 後果與表格靠**同一個 roll 標籤**對位；找不到標籤才退回同索引。
  // 兩份標籤各寫一次遲早會有一邊漏改，而那時候畫面完全正常——所以這裡允許退回，
  // 由 `tests/campOutcome.test.mjs` 用標籤相等把資料層釘死。
  const outcome = outcomes.find((item) => item && item.roll === row.roll) || outcomes[index] || null;
  if (!outcome) return null;

  return { ...outcome, roll: row.roll, text: row.text, d6: die, index };
};

/**
 * 給介面用的一行標籤：「探索 d6=6：中大獎！」。
 *
 * 沒有 `table`（或沒有骰值）時只回活動名——`d6=null` 印成「按摩 d6=null」
 * 看起來像資料壞掉，而那其實是「這條不用骰」。
 */
export const campActivityRollLabel = (activity, result) => {
  const name = activity?.name || '';
  if (!name) return '';
  const die = asCount(result?.d6);
  if (die === null) return name;
  const short = typeof result?.short === 'string' ? result.short : '';
  return `${name} d6=${die}${short ? `：${short}` : ''}`;
};

/* ─────────────────────────────────────────────────────────────
   內部：可算的後果
   ───────────────────────────────────────────────────────────── */

/**
 * `zenit` 的算式。資料層寫的是原書那句「（角色等級 × 50）z」，所以這一欄
 * 是字串而不是數字——**數字不能代替原文**（等級一變它就不對了）。
 *
 * 只接受 `level * N`／`等級 × N` 這一種形狀；其餘回 `null`（→ 進 `manual`），
 * 不寫一個會猜錯的通用算式解析器。
 */
export const campZenitAmount = (expr, level) => {
  const direct = asCount(expr);
  if (direct !== null) return Math.max(0, Math.trunc(direct));
  const text = typeof expr === 'string' ? expr.trim() : '';
  const matched = /^(?:level|等級)\s*[*×xX]\s*(\d+)$/.exec(text);
  if (!matched) return null;
  const lv = asCount(level);
  if (lv === null) return null;
  return Math.max(0, Math.trunc(lv * Number(matched[1])));
};

/** 擁有美食家職業時「烹飪」的 SL（沒有就是 0）。 */
export const campGourmetSl = (character) => {
  const gourmet = (Array.isArray(character?.classes) ? character.classes : [])
    .find((item) => item && item.className === '美食家');
  const cooking = (Array.isArray(gourmet?.skills) ? gourmet.skills : [])
    .find((item) => item && item.name === '烹飪');
  const sl = Math.trunc(asCount(cooking?.sl) ?? 0);
  return sl > 0 ? sl : 0;
};

/** 內部：IP（`currentIp` 為 `null` = 滿血語意，一律當成上限）。 */
const addIpEffect = ({ gain, character, stats, patch, manual, applied, changes }) => {
  const amount = asCount(gain);
  if (amount === null || amount <= 0) return;

  const maxIp = asCount(stats?.maxIp);
  const stored = asCount(character?.currentIp);
  const from = stored === null ? maxIp : stored;

  if (maxIp === null || from === null) {
    manual.push(`庫存點上限算不出來（屬性可能還沒指派完）——這次的 +${Math.trunc(amount)} IP 請自己加`);
    return;
  }

  const to = Math.max(0, Math.min(maxIp, Math.trunc(from + amount)));
  if (to === from) {
    manual.push(`庫存點已經是上限（${maxIp} 點）——這次的 +${Math.trunc(amount)} IP 沒有實際效果`);
    return;
  }

  patch.currentIp = to;
  changes.push({ field: 'currentIp', from: Math.trunc(from), to });
  applied.push({ key: 'ip', text: `庫存點 ${Math.trunc(from)} → ${to}（上限 ${maxIp}）` });
};

/** 內部：資金（只有錢包金額已知時才算得出來，且一律走 `applyMoneyFlow`）。 */
const addZenitEffect = ({ effects, outcome, character, patch, manual, applied, changes, money, activityName }) => {
  if (!effects || !Object.prototype.hasOwnProperty.call(effects, 'zenit')) return;

  const level = asCount(character?.level) ?? 1;
  const amount = campZenitAmount(effects.zenit, level);
  if (amount === null || amount <= 0) {
    manual.push('資金的金額算不出來（等級未記錄）——請自己算');
    return;
  }

  const from = asCount(character?.zenit);
  if (from === null) {
    // 錢包金額未知時 `describeMoneyFlow` 算不出餘額，`applyMoneyFlow` 會把 zenit 寫成 null
    // ——那不是「歸零」，是「把錢包刪掉」。所以這裡直接改成請玩家自己加。
    manual.push(`獲得 ${formatZenit(amount)}——錢包金額尚未記錄，請自己加上去`);
    return;
  }

  const detail = typeof outcome?.zenitReason === 'string' && outcome.zenitReason.trim()
    ? outcome.zenitReason.trim()
    : '活動所得';
  const reason = `營地活動【${activityName}】：${detail}`;
  const flow = applyMoneyFlow(character, { direction: 'gain', amount, reason });
  if (!flow.ok || asCount(flow.character?.zenit) === null) {
    manual.push(`獲得 ${formatZenit(amount)} 記不進去（${flow.flow?.errors?.reason || '錢包金額未記錄'}）——請自己加`);
    return;
  }

  const to = asCount(flow.character.zenit);
  patch.zenit = to;
  money.push({ direction: 'gain', amount, reason });
  changes.push({ field: 'zenit', from, to });
  applied.push({ key: 'zenit', text: `資金 ${formatZenit(from)} → ${formatZenit(to)}` });
};

/** 內部：食材（寫進 `gourmetData.ingredients`，形狀與 `GourmetCookbook.addIngredient` 一致）。 */
const addIngredientEffect = ({ effect, character, patch, manual, applied, tasteRolls }) => {
  const count = Math.trunc(asCount(effect?.count) ?? 0);
  if (count <= 0) return;

  const sl = campGourmetSl(character);
  if (sl <= 0) {
    manual.push(`這條只對「擁有美食家職業的角色」有效——這張卡沒有美食家（烹飪 SL 0），${count} 份食材請交給該角色的玩家自己記`);
    return;
  }

  const data = (character?.gourmetData && typeof character.gourmetData === 'object') ? character.gourmetData : {};
  const existing = Array.isArray(data.ingredients) ? data.ingredients : [];
  const capacity = ingredientCapacity(sl);
  if (existing.length + count > capacity) {
    manual.push(`食材已達上限（${capacity} 份，現有 ${existing.length} 份）——這 ${count} 份要先使用或丟棄才放得進去`);
    return;
  }

  if (effect.flavor === 'choose') {
    manual.push(`${count} 份食材的味道各自任選——請到美食家面板逐份指定口味`);
    return;
  }

  const rolls = Array.isArray(tasteRolls) ? tasteRolls : [];
  if (rolls.length < count) {
    manual.push(`${count} 份食材的味道要各自再骰 d6 決定——骰完再套用（骰到 6 代表由你決定）`);
    return;
  }

  const tastes = [];
  for (let i = 0; i < count; i += 1) {
    const roll = asCount(rolls[i]);
    const taste = Number.isInteger(roll) ? TASTE_ROLL[roll] : null;
    if (!taste) {
      manual.push(`第 ${i + 1} 份食材骰出 ${roll === null ? '未知' : roll}（6 代表由你決定）——這一類要到美食家面板自己選口味`);
      return;
    }
    tastes.push(taste);
  }

  const added = tastes.map((taste, i) => ({
    // id 刻意可預測（不用 `Date.now()`）：純函式要能被測試釘住，
    // 而且重複套用時 `existing.length` 已經變了，撞號的機率是 0。
    id: `ing_camp_${effect.idSuffix || 'x'}_${existing.length + i + 1}`,
    name: `${TASTE_SHORT[taste]}味食材`,
    taste
  }));

  patch.gourmetData = { ...data, ingredients: [...existing, ...added] };
  applied.push({ key: 'ingredients', text: `食材 +${count} 份（${tastes.join('、')}）` });
};

/** 內部：造物專案進度（要指名專案才算得出來）。 */
const addProjectEffect = ({ points, character, target, patch, manual, applied }) => {
  const step = Math.trunc(asCount(points) ?? 0);
  if (step <= 0) return;

  const projects = Array.isArray(character?.tinkererData?.projects) ? character.tinkererData.projects : [];
  if (projects.length === 0) {
    manual.push(`這張卡目前沒有造物專案——請先到造物工坊建立一個，再自己填 ${step} 點進度`);
    return;
  }

  const wanted = typeof target === 'string' ? target.trim() : '';
  const picked = wanted
    ? projects.find((item) => item && (item.id === wanted || item.name === wanted)) || null
    : null;

  if (!picked) {
    const open = projects.filter((item) => item && !item.completed).map((item) => item.name).filter(Boolean);
    manual.push(`請選一個造物專案 +${step} 點進度${open.length > 0 ? `（目前未完成：${open.join('、')}）` : '（目前沒有未完成的專案）'}`);
    return;
  }

  if (picked.completed) {
    manual.push(`【${picked.name || picked.id}】已完工——請改選另一個專案`);
    return;
  }

  const total = Math.trunc(asCount(picked.totalClock) ?? 0);
  const filled = Math.max(0, Math.trunc(asCount(picked.filledClock) ?? 0));
  const next = total > 0 ? Math.min(total, filled + step) : filled + step;
  if (next === filled) {
    manual.push(`【${picked.name || picked.id}】的命刻已經填滿——請改選另一個專案`);
    return;
  }

  patch.tinkererData = {
    ...character.tinkererData,
    projects: projects.map((item) => {
      if (!item || item.id !== picked.id) return item;
      const done = total > 0 ? next >= total : item.completed === true;
      return { ...item, filledClock: next, completed: done };
    })
  };
  applied.push({
    key: 'projectProgress',
    text: `專案【${picked.name || picked.id}】進度 ${filled} → ${next}${total > 0 ? `／${total}` : ''}`
  });
};

/* ─────────────────────────────────────────────────────────────
   內部：算不出來的後果（一律進 manual）
   ───────────────────────────────────────────────────────────── */

const describeBuffManual = (buff) => {
  const lines = [];
  if (!buff || typeof buff !== 'object') return lines;

  const targetLabel = CAMP_BUFF_TARGETS[buff.target] || '這一項';
  const unit = CAMP_BUFF_UNITS[buff.unit] || CAMP_BUFF_UNITS.flat;
  const value = asCount(buff.value);
  const scale = value === null
    ? ''
    : (buff.unit === 'times' ? `${value} 倍` : `${value >= 0 ? '+' : ''}${value}`);

  lines.push(`一次性權利（到下一次休息前，用掉就沒了）：${buff.condition || targetLabel}`);
  if (Array.isArray(buff.options)) buff.options.forEach((text) => { if (text) lines.push(text); });
  lines.push(`App 不會自動改數值——請在${targetLabel}發生的那一次自己套用${scale ? `（${unit} ${scale}）` : ''}，並口頭告知 GM`);
  return lines;
};

/* ─────────────────────────────────────────────────────────────
   主入口：按了會發生什麼
   ───────────────────────────────────────────────────────────── */

const emptyPlan = () => ({
  ok: false,
  reason: '',
  activityId: '',
  name: '',
  roll: null,
  rollLabel: '',
  d6: null,
  outcome: null,
  effects: {},
  patch: {},
  money: [],
  applied: [],
  manual: [],
  log: null,
  toast: ''
});

/**
 * 「按了這顆會發生什麼」——純計算，不寫入。
 *
 * @param {object} character 目前角色
 * @param {object|string} activityInput 活動物件或 id
 * @param {{
 *   roll?: number|string,      // 表格列號（`'3–5'`）或骰值；沒有真骰值時可用
 *   d6?: number,               // 實際骰出的 1–6（優先於 roll）
 *   target?: string,           // 盟友名稱，或造物專案 id／名稱（抱佛腳）
 *   stats?: object,            // `calculateCharacterStats` 的結果（算 IP 上限）
 *   tasteRolls?: number[]      // 採集：每份食材再骰的 d6（含 6 = 由你決定，需玩家自選）
 * }} options
 * @returns {{ok:boolean, reason:string, patch:object, log:object|null, toast:string, manual:string[]}}
 */
export const planCampActivity = (character, activityInput, options = {}) => {
  const { roll = null, target = '', stats = null, d6 = null, tasteRolls = null } = options || {};
  const activity = typeof activityInput === 'string' ? campActivityById(activityInput) : activityInput;
  const plan = emptyPlan();

  const reject = (reason) => {
    plan.reason = reason;
    plan.toast = reason;
    return plan;
  };

  if (!activity || !activity.id) return reject('找不到這條營地活動');

  const state = normalizeCampActivities(character?.campActivities);
  if (!state.picked.includes(activity.id)) {
    return reject(`【${activity.name}】沒有在創角時選定，不能使用`);
  }
  if (activity.once && state.used.includes(activity.id)) {
    return reject(`【${activity.name}】本次休息已經用過了（下一次休息才會回充）`);
  }

  // 查表：有 table 的才需要骰值；沒給骰值就不能先假設一面。
  let outcome = null;
  let die = null;
  if (Array.isArray(activity.table)) {
    if (d6 !== null && d6 !== undefined && asCount(d6) !== null) {
      die = Math.trunc(asCount(d6));
      outcome = rollCampResult(activity, die);
    } else if (roll !== null && roll !== undefined) {
      outcome = rollCampResult(activity, roll);
      die = asCount(roll);
      die = Number.isInteger(die) ? die : null;
    }
    if (!outcome) return reject(`【${activity.name}】要先骰 1d6，才知道會發生什麼`);
  } else {
    outcome = (Array.isArray(activity.outcomes) ? activity.outcomes : [])[0] || null;
    if (!outcome) return reject(`【${activity.name}】沒有可用的後果資料`);
  }

  const effects = (outcome && outcome.effects) || {};
  const patch = {};
  const manual = [];
  const applied = [];
  const changes = [];
  const money = [];

  /* ① 算得出來的（才進 patch） */
  if (Object.prototype.hasOwnProperty.call(effects, 'ip')) {
    addIpEffect({ gain: effects.ip, character, stats, patch, manual, applied, changes });
  }
  addZenitEffect({
    effects,
    outcome,
    character,
    patch,
    manual,
    applied,
    changes,
    money,
    activityName: activity.name
  });
  if (effects.ingredients) {
    addIngredientEffect({
      effect: { ...effects.ingredients, idSuffix: activity.id },
      character,
      patch,
      manual,
      applied,
      tasteRolls
    });
  }
  if (Object.prototype.hasOwnProperty.call(effects, 'projectProgress')) {
    addProjectEffect({ points: effects.projectProgress, character, target, patch, manual, applied });
  }

  /* ② 算不出來的（一律進 manual，不准偽裝成已套用） */
  if (effects.restHalf) {
    manual.push('這次休息只恢復正常一半的 HP 與 MP——App 的一鍵休整會直接回滿，請把多回的那一半自己扣回去');
  }
  if (effects.encounter) {
    manual.push('這次休息結束時，整團會捲入一場與團隊等級同級威脅的簡單衝突——請到戰鬥追蹤器開一場（這是整團的事件，不是一個數字）');
  }
  if (effects.buff) {
    describeBuffManual(effects.buff).forEach((line) => manual.push(line));
  }
  if (activity.target === 'ally' && String(target ?? '').trim() === '') {
    manual.push('這條的目標是「一個盟友」——請先指定那一位盟友，並把這一次權利告訴他');
  }

  /* ③ 一次性權利的消耗（`once` 的 12 條） */
  if (activity.once) {
    const nextState = setCampActivityUsed(state, activity.id, true);
    if (nextState.used.join('|') !== state.used.join('|')) patch.campActivities = nextState;
  }

  const title = die === null ? `營地活動：${activity.name}` : `營地活動：${activity.name}（d6 = ${die}）`;
  const noteParts = [];
  if (applied.length > 0) noteParts.push(applied.map((item) => item.text).join('；'));
  if (manual.length > 0) noteParts.push(`需自行處理：${manual.join('；')}`);

  plan.ok = true;
  plan.activityId = activity.id;
  plan.name = activity.name;
  plan.roll = outcome?.roll ?? null;
  plan.d6 = die;
  plan.outcome = outcome;
  plan.effects = effects;
  plan.patch = patch;
  plan.money = money;
  plan.applied = applied;
  plan.manual = manual;
  plan.rollLabel = campActivityRollLabel(activity, { ...outcome, d6: die });
  plan.log = {
    kind: 'camp',
    title,
    note: noteParts.join('　※　'),
    changes
  };
  plan.toast = describeCampOutcome(plan);
  return plan;
};

/**
 * 一句 toast。
 *
 * toast 只停留兩三秒，所以要講完三件事：**哪一條活動**（含骰值）→ **數字變成多少**
 * → **還有什麼要自己做**。只講「已套用」等於什麼都沒講。
 */
export const describeCampOutcome = (plan) => {
  if (!plan) return '';
  if (!plan.ok) return plan.reason || '這條營地活動現在不能使用';

  const head = `營地活動【${plan.name}】`;
  const die = asCount(plan.d6);
  const short = typeof plan.outcome?.short === 'string' ? plan.outcome.short : '';
  const parts = [die === null ? head : `${head} d6 = ${die}${short ? `（${short}）` : ''}`];

  (plan.applied || []).forEach((item) => parts.push(item.text));
  const manual = plan.manual || [];
  if (manual.length > 0) parts.push(`另有 ${manual.length} 項要自己處理（見清單）`);
  if (parts.length === 1) parts.push('已記錄在履歷');
  return parts.join('，');
};

/**
 * 把一份 plan 真的鋪回角色（可選的便利函式）。
 *
 * 為什麼需要它：`patch.zenit` 只是算出來的數字，直接鋪上去就變成
 * 「沒有原因的 +350z」——這是全站唯一一條不准繞的路（`utils/moneyFlow.js` 檔頭）。
 * 這一支內部呼叫 `applyMoneyFlow`，所以錢那一筆會自己留下 `kind: 'trade'` 履歷，
 * 其原因就是原地那句話（`營地活動【探索】：找到價值等於…`）。
 *
 * 純函式：回傳新角色，不碰 localStorage、不呼叫 `onChange`。
 */
export const applyCampPlan = (character, plan) => {
  if (!plan || !plan.ok) return character;
  const before = character || {};
  // `zenit` 從 patch 拿掉：錢只走 `applyMoneyFlow`（見上方說明）。
  const { zenit: ignoredZenit, ...rest } = plan.patch || {};
  let next = { ...before, ...rest };

  if (Array.isArray(plan.money) && plan.money.length > 0) {
    plan.money.forEach((flow) => {
      const result = applyMoneyFlow(next, flow);
      if (result.ok) next = result.character;
    });
  } else if (typeof ignoredZenit === 'number') {
    next = { ...next, zenit: ignoredZenit };
  }

  const updated = { ...next, updatedAt: new Date().toISOString() };
  const log = plan.log;
  if (!log) return updated;

  return loggableChange(next, updated, {
    kind: log.kind || 'camp',
    title: log.title,
    note: log.note,
    changes: Array.isArray(log.changes) ? log.changes : []
  });
};
