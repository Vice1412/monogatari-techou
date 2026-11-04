/**
 * 效果流程（Effect Flows）核心純函式層
 *
 * 為什麼要有這一層：`docs/skill-coverage.md` 的稽核把 373 條「只有文字」的技能條目
 * 逐條分類後，發現它們其實分成五種**形狀**（狀態、動作、修正、授予、敘事）。
 * 形狀是穩定的，只有數字與文案不同——所以抽成一份資料（`data/effectFlows.json`）
 * 加一層純函式，UI 與引擎各自讀同一份判定，就不會出現「技能卡說可以、跑團卡說不行」。
 *
 * 本檔是**純函式**：不讀 DOM、不讀 localStorage、不 import React。
 * 這不是潔癖——本專案反覆踩到「`onClick` 裡的邏輯 SSR 測不到」，
 * 所以凡是算得出來的東西一律住在資料層，測試才跑得動。
 *
 * ── 三個一定要守住的語意邊界 ──────────────────────────────────────────
 *
 * 1. **`null` 不是 `0`**。上限算不出來（`無上限`、或算式含看不懂的變數）回 `null`，
 *    代表「不夾」。若回 `0`，計數器會在建立的那一刻就被夾成 0，
 *    玩家看到的上限是 0、`+` 一按就撞牆——那不是「算不出來」，是「算成零」。
 *
 * 2. **「沒填過」與「填成 0」要分開**。沿用 `data/classResources.js` 的判法：
 *    `Number.isFinite` 才代表真的寫過。若用 `||`，玩家把計數器歸零之後
 *    會「復活」成初始值，比原本的 bug 更糟。
 *
 * 3. **`apply.via === 'existing'` 的條目不准重算**。那 38 條的數字已經被舊有客製程式
 *    （`characterEngine` 的 `bonusMp`、裝備判定、卡牌桌……）算進了最終數值。
 *    這一層再算一次，結果是**加倍**，而且從畫面上看不出來是哪裡多出來的。
 */

import EFFECT_FLOWS from '../data/effectFlows.json';
import { getSkillSL } from '../data/classResources.js';
// 第二期：結構化條件判定（裝備／武器類別／手部／狀態數／技能 SL／等級）。
// 它不 import `characterEngine`（避免循環），自己照抄了引擎的空手／無防具判定。
import { evaluateWhen, buildConditionContext } from './effectConditions.js';

// ─────────────────────────────────────────────────────────── 封閉詞彙

/** 控制項型態。`none` 代表「這條沒有可操作的控制項」，UI 應該完全不畫。 */
// `select`（第三期）：需要「選一個」的條目——所選武器類別、所選元素源泉……
// 這一種控件不佔數字，只記 `flowState[id].choice`；引擎要靠那個字串才有辦法算
// （例如【類別訓練】給的熟練度）。沒有它，玩家選了「劍」，`profs` 仍是 false。
export const FLOW_CONTROL_KINDS = Object.freeze(['none', 'counter', 'toggle', 'button', 'select']);

/**
 * 效果作用對象的封閉詞彙。
 *
 * 為什麼要寫死在這裡而不是從資料推導：這份清單是**護欄**。
 * 若改成 `new Set(FLOW_ITEMS.flatMap(...))`，測試就變成「資料等於資料」——
 * 永遠會綠。寫死之後，`build:flows` 產生一個新 target（例如把「射程」寫成 `rangeMax`），
 * 測試會轉紅，強迫人回來決定「這個 target 要不要進 totals、中文叫什麼」。
 */
export const FLOW_TARGETS = Object.freeze([
  'actionEconomy', 'check', 'damage', 'damageTaken', 'def', 'fp',
  'hpMax', 'immunity', 'initiative', 'inventorySlots', 'ipCost', 'ipMax',
  'mdef', 'mpCost', 'mpMax', 'other', 'range', 'resistance',
  'statusApplied', 'vulnerability', 'zenit'
]);

/** 持續時間的封閉詞彙。`permanent` 是唯一會進 `totals` 的那一種。 */
export const FLOW_SCOPES = Object.freeze([
  'permanent', 'scene', 'round', 'rest', 'instant',
  'chapter', 'conflict', 'once', 'session', 'turn', 'whZero', 'none'
]);

/**
 * target → 中文顯示名。
 * 只為了 `terms` 的 `label` 與紀錄標題；沒有列到的 target 直接顯示原始 key，
 * 這樣漏登記時是「看得到英文 key」而不是「看到 undefined」。
 */
const TARGET_LABELS = Object.freeze({
  actionEconomy: '動作經濟',
  check: '檢定',
  damage: '傷害',
  damageTaken: '受到的傷害',
  def: '物防',
  fp: '物語點',
  hpMax: '最大 HP',
  immunity: '免疫',
  initiative: '先制',
  inventorySlots: '物品欄',
  ipCost: 'IP 成本',
  ipMax: '最大 IP',
  mdef: '魔防',
  mpCost: 'MP 成本',
  mpMax: '最大 MP',
  other: '其他',
  range: '射程',
  resistance: '抗性',
  statusApplied: '施加狀態',
  vulnerability: '弱點',
  zenit: '資金'
});

const targetLabel = (target) => TARGET_LABELS[target] || String(target);

// ─────────────────────────────────────────────────────────── 索引

const FLOW_ITEMS_RAW = Array.isArray(EFFECT_FLOWS?.items) ? EFFECT_FLOWS.items : [];

/**
 * 全部條目。**刻意不凍結第二層**：測試要用同一個條目做「via 改成 untracked 之後
 * totals 會不會變」的 A/B 對照，凍結之後只能靠複製整份資料作假對象，
 * 那就等於在測複製品而不是真的程式路徑。
 */
export const FLOW_ITEMS = FLOW_ITEMS_RAW;

const BY_ID = new Map();
const BY_CATEGORY_NAME = new Map();
const BY_CLASS_SKILL = new Map();
const BY_CAMP = new Map();

for (const item of FLOW_ITEMS) {
  if (!item || typeof item.id !== 'string') continue;
  BY_ID.set(item.id, item);
  // 用 `\u0000` 當分隔符：條目名稱裡真的出現過 `\`（金手指「交織的靈魂\戒指裡的老爺爺」），
  // 用 `:` 或 `|` 拼鍵會撞。
  if (item.category === 'heroic' || item.category === 'quirk') {
    BY_CATEGORY_NAME.set(`${item.category}\u0000${item.name}`, item);
  }
  if (item.category === 'class') {
    BY_CLASS_SKILL.set(`${item.className}\u0000${item.name}`, item);
  }
  if (item.category === 'camp') {
    BY_CAMP.set(item.id.replace(/^camp:/, ''), item);
  }
}

// ─────────────────────────────────────────────────────────── 查找

export const flowItemById = (id) => BY_ID.get(id) || null;

export const flowItemForClassSkill = (className, skillName) => (
  className && skillName
    ? BY_CLASS_SKILL.get(`${className}\u0000${skillName}`) || null
    : null
);

export const flowItemForHeroic = (name) => (
  name ? BY_CATEGORY_NAME.get(`heroic\u0000${name}`) || null : null
);

export const flowItemForQuirk = (name) => (
  name ? BY_CATEGORY_NAME.get(`quirk\u0000${name}`) || null : null
);

/**
 * 營地活動的查找同時接受 `campForge` 與 `camp:campForge`：
 * `campActivities.picked` 存的是前者（`data/campActivities.js` 的 id），
 * 本份資料的條目 id 是後者。兩個都吃，呼叫端不必記得自己在哪一層。
 */
export const flowItemForCamp = (id) => {
  if (!id) return null;
  const raw = String(id).replace(/^camp:/, '');
  return BY_CAMP.get(raw) || null;
};

// ─────────────────────────────────────────────────────────── 持有的判定

/**
 * 角色身上的英雄技能名。
 *
 * `heroicSkills` **可能是字串也可能是 `{ name }`**——舊存檔是字串，
 * 而 `classResources.getActiveClassResources` 早就已經處理過這件事。
 * 這裡照抄同一條規則（而不是另外寫一份），否則「資源池看得到、流程條目看不到」
 * 會變成一個沒人查得出來的不一致。
 */
const heroicNamesOf = (character) => (Array.isArray(character?.heroicSkills) ? character.heroicSkills : [])
  .map((h) => (typeof h === 'string' ? h : h?.name))
  .filter(Boolean);

/** 金手指：`'無'` 是「沒選」的佔位字串，不是一個名叫「無」的金手指。 */
const quirkOf = (character) => {
  const quirk = character?.quirk;
  if (typeof quirk !== 'string' || quirk === '' || quirk === '無') return null;
  return quirk;
};

/**
 * 營地活動 id。除了現行的 `{ picked, used }`，也吃早期手寫的**純陣列**存檔
 * （`normalizeCampActivities` 已經把陣列視為 `picked`，這裡若不一樣，
 * 舊存檔會出現「選了活動但流程條目消失」）。
 */
const campIdsOf = (character) => {
  const raw = character?.campActivities;
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.picked) ? raw.picked : []);
  return list.map((p) => (typeof p === 'string' ? p : p?.id)).filter(Boolean);
};

/**
 * 角色現在持有的條目，附各自的 SL。
 *
 * 職業技能要求 `SL > 0` 才列出——與 `getActiveClassResources` 一致：
 * SL 0 代表「學過但水準是 0」，那一條的所有數值乘起來都是 0，
 * 列出來只會在跑團卡上多一堆永遠是 0 的列。
 *
 * @returns {Array<{item: object, sl: number, owned: true}>}
 */
export const characterFlowItems = (character) => {
  if (!character || typeof character !== 'object') return [];
  const heroic = new Set(heroicNamesOf(character));
  const quirk = quirkOf(character);
  const camp = new Set(campIdsOf(character));
  const out = [];
  const seen = new Set();
  const push = (item, sl) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    out.push({ item, sl, owned: true });
  };

  for (const item of FLOW_ITEMS) {
    if (item.category === 'class') {
      const sl = getSkillSL(character, item.className, item.name);
      if (sl > 0) push(item, sl);
    } else if (item.category === 'heroic') {
      if (heroic.has(item.name)) push(item, 0);
    } else if (item.category === 'quirk') {
      if (quirk && quirk === item.name) push(item, 0);
    } else if (item.category === 'camp') {
      if (camp.has(item.id.replace(/^camp:/, ''))) push(item, 0);
    }
  }
  return out;
};

// ─────────────────────────────────────────────────────────── 算式求值

/**
 * 把字串切成 token。看不懂的一律回 `null`（代表整條算式不合法）。
 *
 * **不用 `eval` / `new Function`**：這份資料是 `build:flows` 從稽核結果產生的，
 * 但資料檔終究是外部輸入；`eval` 會讓「有人改了 JSON」直接變成任意程式執行。
 * 變數只有 `SL` 與 `等級`／`LEVEL` 三個寫法，手寫一個遞迴下降解析器就夠了，
 * 而且「哪些算式算得出來」變成明示的而非隱式的。
 */
const tokenize = (src, extraVars = null) => {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1;
      tokens.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push({ t: ch });
      i += 1;
      continue;
    }
    // 識別字：只認 `SL`、`等級`、`LEVEL`。整段連續的漢字／字母一起吃掉，
    // 所以「有備無患SL」「鷹眼SL」會是**一個**不認得的識別字 → 整條算式 null。
    // 這正是我們要的：那兩條資料的上限其實寫在括號的文字裡，猜不得。
    if (/[A-Za-z\u4e00-\u9fff]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_\u4e00-\u9fff]/.test(src[j])) j += 1;
      const word = src.slice(i, j);
      const upper = word.toUpperCase();
      if (upper === 'SL') tokens.push({ t: 'var', v: 'sl' });
      else if (word === '等級' || upper === 'LEVEL') tokens.push({ t: 'var', v: 'level' });
      // 第二期：其他技能的 SL 也可以當變數（例如【陷阱大師】的「1 + 有備無患SL」）。
      // 只有呼叫端**明確傳進來**的變數才認得——沒傳就仍然是 null（不猜 0）。
      // 「認得哪些變數」由 `flowVarsFor(character)` 依角色身上的技能清單產生，
      // 所以同一條算式在「學了有備無患」與「沒學」的角色身上會給不同結果。
      else if (extraVars && Object.prototype.hasOwnProperty.call(extraVars, word)) {
        tokens.push({ t: 'ext', v: word });
      } else return null;
      i = j;
      continue;
    }
    return null;
  }
  return tokens;
};

const BAD_EXPR = 'flow-control-expr-invalid';

/**
 * 求出 `control.max` 的數值。
 *
 * 回 `null` 的三種情況都**不可以被當成 0**：
 * - 算式是 `無上限` 之類的散文（資料裡真的有）；
 * - 算式含未登記的變數（`有備無患SL`、`×` 這種全角乘號也不支援）；
 * - 語法錯誤（`SL +`、空字串、`undefined`）。
 *
 * 除法一律**向下取整**（原書的上限公式全是「除以 2 取整」這種寫法），
 * 除數為 0 視為不合法——回 `Infinity` 會讓 `Math.min` 之後變成上限 Infinity，
 * 那跟「無上限」看起來一樣，但呼叫端會以為自己算成功了。
 *
 * @param {string|number} expr
 * @param {{sl?: number, level?: number, vars?: object}} [ctx]
 *   `vars` 是**額外可認得的變數**（例如 `{ 有備無患SL: 2 }`），由 `flowVarsFor(character)` 產生。
 *   不傳就維持第一期行為：那兩個算式仍然回 `null`（上限算不出來 → UI 當「無上限」顯示但保留原式）。
 * @returns {number|null}
 */
export const evaluateControlValue = (expr, { sl = 0, level = 1, vars: extraVars = null } = {}) => {
  if (typeof expr === 'number') return Number.isFinite(expr) ? Math.floor(expr) : null;
  if (typeof expr !== 'string') return null;

  const tokens = tokenize(expr, extraVars);
  if (!tokens || tokens.length === 0) return null;

  const vars = {
    sl: Number.isFinite(Number(sl)) ? Math.floor(Number(sl)) : 0,
    level: Number.isFinite(Number(level)) ? Math.floor(Number(level)) : 0
  };

  let pos = 0;
  const fail = () => { throw new Error(BAD_EXPR); };
  const peek = () => tokens[pos];

  const parseUnary = () => {
    const tk = peek();
    if (!tk) fail();
    if (tk.t === '(') {
      pos += 1;
      const value = parseSum();
      if (!peek() || peek().t !== ')') fail();
      pos += 1;
      return value;
    }
    if (tk.t === '-') { pos += 1; return -parseUnary(); }
    if (tk.t === '+') { pos += 1; return parseUnary(); }
    if (tk.t === 'num') { pos += 1; return tk.v; }
    if (tk.t === 'var') { pos += 1; return vars[tk.v]; }
    if (tk.t === 'ext') {
      pos += 1;
      const v = Number(extraVars[tk.v]);
      // 變數存在但值不是有限數字（例如技能學了但 SL 是 undefined）→ 整條算式不合法。
      // 回 0 會把上限變成 0，計數器就永遠按不動了。
      if (!Number.isFinite(v)) fail();
      return Math.floor(v);
    }
    return fail();
  };

  const parseProduct = () => {
    let value = parseUnary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = tokens[pos].t;
      pos += 1;
      const right = parseUnary();
      if (op === '*') value *= right;
      else {
        if (right === 0) fail();
        value = Math.floor(value / right);
      }
    }
    return value;
  };

  const parseSum = () => {
    let value = parseProduct();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = tokens[pos].t;
      pos += 1;
      const right = parseProduct();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };

  try {
    const value = parseSum();
    // 逗號、尾隨運算子、未關閉括號：解析完還有剩餘 token 就是語法錯。
    if (pos !== tokens.length) return null;
    if (!Number.isFinite(value)) return null;
    return Math.floor(value);
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────── 等級與 SL

/**
 * SL 從角色身上查，而不是要呼叫端傳——`clampFlowState` 的簽名沒有 ctx，
 * 但上限算式需要 SL。與其偷偷假設 SL 是 0（那會把有上限的計數器夾成 0），
 * 不如回頭查角色本身這唯一一份事實。
 */
const resolveSl = (character, item) => (
  item?.category === 'class' ? getSkillSL(character, item.className, item.name) : 0
);

/**
 * 等級。權威是玩家自己設定的 `character.level`（見 `getCharacterLevel` 的說明：
 * 職業等級總和會漂移，只有 `level` 是玩家填的）。
 * 缺欄時退回「這張卡自己的開卡規則」，再退回專案預設 5 級——
 * 這裡刻意不 import `characterEngine`：那支會把整個引擎（含資料字典）拉進測試，
 * 而這一層需要的只是一個整數。
 */
const resolveLevel = (character) => {
  const own = parseInt(character?.level, 10);
  if (Number.isFinite(own) && own > 0) return own;
  const fromRules = parseInt(character?.creationRules?.startingLevel, 10);
  if (Number.isFinite(fromRules) && fromRules > 0) return fromRules;
  return 5;
};

const toFiniteInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : null;
};

const controlInitial = (item) => {
  const n = toFiniteInt(item?.control?.initial);
  return n === null ? 0 : n;
};

/** 這條目在該角色身上的上限；`null` ＝ 不夾。 */
const controlMax = (character, item) => {
  const expr = item?.control?.max;
  if (expr === null || expr === undefined) return null;
  const max = evaluateControlValue(expr, {
    sl: resolveSl(character, item),
    level: resolveLevel(character),
    vars: flowVarsFor(character)
  });
  if (max === null) return null;
  // 上限是負數在規則上沒有意義，但也不該默默變成 0（那會鎖住整個計數器）。
  return max >= 0 ? max : null;
};

// ─────────────────────────────────────────────────────────── 狀態容器

/**
 * 額外的算式變數：**角色身上每一個技能的 SL**，鍵名是「技能名 ＋ SL」。
 *
 * 為什麼要有這個：14 筆計數器的上限算式寫的**不是自己的 SL**，而是別條技能的 SL
 * （【陷阱大師】的「1 + 有備無患SL」、【誘餌】的「等級/2 + 鷹眼SL × 5」）。
 * 第一期那兩條一律回 `null`，UI 因此當成「無上限」——玩家可以無限加，
 * 而畫面上完全看不出來（上限那一格只是空著）。
 *
 * 只有**角色真的學過**的技能才進表（SL > 0）：沒學的技能若也給 0，
 * 「1 + 有備無患SL」會算出 1，看起來像正常上限，實際上把「還沒學」讀成了「學了 0 級」。
 * 那比算不出來更糟——算不出來至少畫面會露出來。
 */
export const flowVarsFor = (character) => {
  const vars = {};
  const put = (name, sl) => {
    const key = `${name}SL`;
    if (!Object.prototype.hasOwnProperty.call(vars, key) || vars[key] < sl) vars[key] = sl;
  };
  for (const cls of character?.classes || []) {
    for (const sk of cls?.skills || []) {
      const sl = toFiniteInt(sk?.sl);
      if (sk?.name && sl !== null && sl > 0) put(sk.name, sl);
    }
  }
  // 自訂職業（`character.customClasses`）與職業同一個形狀，玩家自建的技能也能當變數。
  for (const cls of character?.customClasses || []) {
    for (const sk of cls?.skills || []) {
      const sl = toFiniteInt(sk?.sl);
      if (sk?.name && sl !== null && sl > 0) put(sk.name, sl);
    }
  }
  return vars;
};

/**
 * 讀取某條目的狀態。
 *
 * `character.flowState[item.id] = { n, on }`，**舊存檔沒有這個欄位**，
 * 所以缺欄一律容忍並回預設，絕不回 `undefined`——
 * UI 若拿到 `undefined.n`，畫面會在跑團現場炸掉，而玩家只會看到白畫面。
 *
 * 讀取時也順手夾上限（與 `readResource` 同一個理由）：玩家把 SL 改小之後，
 * 舊存檔裡超過新上限的數字不該繼續顯示。
 *
 * @returns {{n:number, on:boolean}}
 */
export const readFlowState = (character, item) => {
  if (!item || typeof item.id !== 'string') return { n: 0, on: false, choice: '' };
  const raw = character?.flowState?.[item.id];
  const wrote = toFiniteInt(raw?.n);
  const base = wrote === null ? controlInitial(item) : wrote;
  const max = controlMax(character, item);
  const n = max === null ? Math.max(0, base) : Math.min(max, Math.max(0, base));
  // choice：需要「選一個」的條目（所選武器類別、所選元素源泉…）。
  // 沒有這個欄位的舊存檔一律回空字串（＝還沒選），不回 undefined——
  // UI 與引擎都靠「是不是空字串」判斷「玩家選了沒」。
  return { n, on: raw?.on === true, choice: typeof raw?.choice === 'string' ? raw.choice : '' };
};

/**
 * 依上限／初始值夾住下一個狀態。**上限為 `null` 時不夾**（`無上限` 是真的無上限）。
 * 非數字（`''`、`'abc'`、`undefined`）退回初始值，不是硬性 0——
 * 與 `clampResource` 同一個判法。
 *
 * @returns {{n:number, on:boolean}}
 */
export const clampFlowState = (character, item, next) => {
  const raw = toFiniteInt(next?.n);
  const base = raw === null ? controlInitial(item) : raw;
  const max = controlMax(character, item);
  const n = max === null ? Math.max(0, base) : Math.min(max, Math.max(0, base));
  const choice = typeof next?.choice === 'string' ? next.choice : '';
  return { n, on: next?.on === true, choice };
};

/**
 * 建立新的角色物件（不可變更新）。只覆寫 `flowState[id]`，其他欄位與其他條目的
 * 狀態一律原樣帶過——跑團時同時有好幾條流程在跑，寫一條不能弄掉另一條。
 */
export const withFlowState = (character, id, nextState) => {
  const base = character && typeof character === 'object' ? character : {};
  const key = typeof id === 'string' ? id : '';
  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [key]: {
        n: Math.max(0, toFiniteInt(nextState?.n) ?? 0),
        on: nextState?.on === true,
        choice: typeof nextState?.choice === 'string' ? nextState.choice : ''
      }
    }
  };
};

/**
 * 重置（UI 的「場景結束／休息／歸零」按鈕）。
 *
 * `reset` 的**時機**由誰觸發是 UI／HUD 的事；這一層只負責「重置成什麼」：
 * 一律回初始值並關掉開關。不另開一張「reset → 值」的表，
 * 因為資料裡的 `reset` 目前只有時機語意，沒有值語意。
 */
export const flowResetState = (character, item) => {
  if (!item || typeof item.id !== 'string') return character;
  return withFlowState(character, item.id, { n: controlInitial(item), on: false, choice: '' });
};

// ─────────────────────────────────────────────────────────── 動作計畫

/**
 * 成本 → 角色身上的欄位。
 *
 * `hp/mp/ip` 的當前值在角色上是 `null`（代表「等於最大值」），
 * 所以要用 `stats.maxHp` 這些欄位補出來——這就是 `ctx.stats` 存在的原因。
 * `fp`（物語點）與 `zenit` 沒有「null 代表滿」的約定，退回各自預設。
 */
const COST_RESOURCES = Object.freeze({
  hp: { field: 'currentHp', statKey: 'maxHp', label: 'HP' },
  mp: { field: 'currentMp', statKey: 'maxMp', label: 'MP' },
  ip: { field: 'currentIp', statKey: 'maxIp', label: 'IP' },
  fp: { field: 'fabulaPoints', statKey: null, label: '物語點', fallback: 3 },
  zenit: { field: 'zenit', statKey: null, label: '資金', fallback: 0 }
});

/** 目前可用量；`null` ＝「沒有足夠資訊可算」（不是 0，不然會誤擋）。 */
const readAvailable = (character, key, stats) => {
  const meta = COST_RESOURCES[key];
  const own = toFiniteInt(character?.[meta.field]);
  if (own !== null) return own;
  if (meta.statKey) return toFiniteInt(stats?.[meta.statKey]);
  return meta.fallback;
};

const costTextOf = (paid) => Object.keys(paid)
  .map((key) => `${COST_RESOURCES[key].label} ${paid[key]}`)
  .join('、');

/**
 * 「按了這顆按鈕會發生什麼」——**純計算，不寫入**。
 *
 * 為什麼要拆成「計畫」而不是直接寫回角色：跑團現場最需要的是**反悔**。
 * 計畫回傳 `patch`（要寫的欄位）與 `log`（要留下的履歷），由 HUD 決定要不要套用；
 * 這一層因此完全沒有副作用，也才能在測試裡直接把同一份輸入算兩次比對。
 *
 * 成功時 `patch.flowState` 會把 `n` 加一、`on` 設為 true。
 * 按鈕型沒有「幾次」的限制（資料裡 188 個 button 沒有任何一個有 `max`／`reset`），
 * 所以 `n` 的語意是「**本場次按過幾次**」，`on` 是「至少用過一次」——
 * 兩者都由場景重置去清。沒有這個計數，計畫就沒有東西可以證明「真的按過」。
 *
 * 成本不足時回 `ok:false` 並帶**實際值**（不是「資源不足」這種沒用的話）：
 * 玩家需要知道差多少才能決定要不要放棄。
 *
 * @param {object} item effectFlows 的一筆
 * @param {object} character
 * @param {{sl?:number, level?:number, stats?:object}} [ctx]
 * @returns {{ok:boolean, reason?:string, patch:object, log:object|null, toast:string,
 *            unresolved:Array<{label:string,text:string}>, via:string, sl:number, level:number}}
 */
export const flowActionPlan = (item, character, ctx = {}) => {
  const empty = {
    ok: false,
    patch: {},
    log: null,
    toast: '',
    unresolved: [],
    via: item?.apply?.via || 'untracked',
    sl: 0,
    level: 1
  };
  if (!item || typeof item !== 'object') {
    return { ...empty, reason: '找不到這條效果流程' };
  }

  const sl = toFiniteInt(ctx?.sl) ?? resolveSl(character, item);
  const level = toFiniteInt(ctx?.level) ?? resolveLevel(character);
  const base = { ...empty, sl, level };

  // 敘事條目本來就不該有效果；先判它，否則會落到下面「不是按鈕型」的訊息，
  // 而玩家看到「不是按鈕型」只會覺得 App 壞了，不會知道這條規則本來就沒有數字。
  if (item.flow === 'narrative' || item.apply?.via === 'none') {
    return { ...base, reason: '這是敘事條目，沒有可執行的效果' };
  }
  if (item.control?.kind !== 'button') {
    return { ...base, reason: '這條不是按鈕型' };
  }

  const stats = ctx?.stats || null;
  const cost = item.control?.cost;
  const paid = {};
  const unresolved = [];

  if (cost && typeof cost === 'object') {
    for (const key of Object.keys(cost)) {
      const meta = COST_RESOURCES[key];
      const text = String(cost[key]);
      if (!meta) {
        unresolved.push({ label: key, text });
        continue;
      }
      const amount = toFiniteInt(cost[key]);
      if (amount === null) {
        // 資料裡有「該咒語 MP」「10 × 複本數（≤30）」這種描述型成本（19 筆）。
        // 它們不是「免費」，只是這一層算不出來——所以不擋，但一定要回報，
        // 否則玩家會以為 MP 已經自動扣好了。
        unresolved.push({ label: meta.label, text });
        continue;
      }
      const have = readAvailable(character, key, stats);
      if (have === null) {
        unresolved.push({ label: meta.label, text: '未提供角色數值，無法核對' });
        continue;
      }
      if (amount > have) {
        return { ...base, reason: `${meta.label} 不足（需要 ${amount}，現有 ${have}）` };
      }
      if (amount < 0) {
        unresolved.push({ label: meta.label, text: '成本是負數，需玩家自行確認' });
        continue;
      }
      paid[key] = amount;
    }
  }

  const state = readFlowState(character, item);
  const nextState = clampFlowState(character, item, { n: state.n + 1, on: true });
  const patch = { flowState: { [item.id]: nextState } };
  const changes = [];
  const paidNotes = [];

  for (const key of Object.keys(paid)) {
    const meta = COST_RESOURCES[key];
    const from = readAvailable(character, key, stats);
    const to = Math.max(0, from - paid[key]);
    patch[meta.field] = to;
    changes.push({ field: meta.field, from, to });
    paidNotes.push(`${meta.label} ${from} → ${to}`);
  }

  const costText = costTextOf(paid);
  const title = costText ? `使用【${item.name}】（${costText}）` : `使用【${item.name}】`;
  const note = unresolved.length > 0
    ? `另有無法自動計算的成本：${unresolved.map((u) => `${u.label}：${u.text}`).join('；')}`
    : '';

  return {
    ...base,
    ok: true,
    patch,
    log: {
      // `kind` 必須是 `characterLog.LOG_KINDS` 的封閉詞彙（未登記者一律拒收），
      // 技能流程最接近的是 `skill`。`changes` 只放真的有欄位標籤的（HP/MP/IP/物語點/資金）；
      // `flowState` **刻意不進去**——`LOG_FIELD_LABELS` 沒有它的中文名，
      // 寫進去履歷會顯示成一串鍵名，比不記還糟。
      kind: 'skill',
      title,
      changes,
      ...(note ? { note } : {})
    },
    toast: paidNotes.length > 0
      ? `${title}；${paidNotes.join('、')}${note ? `；${note}` : ''}`
      : `${title}${note ? `；${note}` : ''}`,
    unresolved
  };
};

// ─────────────────────────────────────────────────────────── 常駐修正

/** 會進 `totals` 的六個欄位——與 `calculateCharacterStats` 回傳的同名欄位一一對應。 */
const TOTAL_KEYS = Object.freeze(['hpMax', 'mpMax', 'ipMax', 'def', 'mdef', 'initiative']);

/**
 * 角色身上所有**常駐**的被動值，供引擎折進數值構成。
 *
 * 三個設計決定：
 *
 * 1. `apply.via === 'existing'` 一律跳過整條條目。那 38 條的數字已經被舊程式算進去了，
 *    這裡再算一次就是加倍，而且加倍的來源在 UI 上完全看不出來。
 * 2. `totals` 只收 `scope === 'permanent'`。場景／回合型的加值不是「角色常駐數值」，
 *    混進去會讓 `maxHp` 在場景開始時莫名跳一階。
 * 3. 其餘**全部**列進 `conditional`（連 `value` 是 0 的也列）：那些條目的價值在
 *    `condition` 的那句說明，玩家要看的是「什麼時候 +SL」而不是數字。
 *    反過來，`terms` 只放非零值——`+0` 的列只是噪音。
 *
 * 特別注意第 1 點的**範圍**：`existing` 條目跳過的只有「會被折進數值」的
 * `totals` 與 `terms`；它們的條件式說明照樣列進 `conditional`（並標 `existing: true`），
 * 因為那些說明本來就只給人看、不參與計算，跳過的話面板會少掉一半的解釋。
 *
 * @returns {{totals:object, terms:Array, conditional:Array}}
 */
export const characterFlowModifiers = (character, stats = null) => {
  const totals = {};
  for (const key of TOTAL_KEYS) totals[key] = 0;
  const terms = [];
  const conditional = [];
  // 條件判定的情境（裝備解析、技能 SL、等級）只建一次：每一筆各建一次會重複解析武器表，
  // 而這個函式在 `calculateCharacterStats` 裡每幀都會被呼叫。
  // `stats` 只在**危機**（`crisis`）這類需要 HP 上限的條件才用得到；不傳＝那些條件回 unknown。
  const conditionCtx = character ? buildConditionContext(character, stats || {}) : null;

  for (const { item, sl } of characterFlowItems(character)) {
    const isExisting = item.apply?.via === 'existing';
    const effects = Array.isArray(item.effects) ? item.effects : [];
    // 注意：只有「職業技能」與「英雄技能」的常駐值可以直接折進數值。
    //
    // 金手指與營地活動**一律不折**，兩個理由都是實測撞到的：
    //   ① 金手指的機械效果住在 `rulesData.quirks[].effects`，由 `getQuirkEffects` 承接，
    //      而且**幾乎都掛在「玩家選了哪個選項」之下**（倖存者③ 的 +2 IP、會說話的野獸的
    //      +2 物防都是）。照這裡的宣告折進去，等於「沒選那個選項也給」——
    //      `test:engine` 的 J7／J8 就是這樣一次紅 6 條。
    //   ② 營地活動是「本次休息到下次休息」的一次性權利，不是角色常駐數值。
    // 兩類的條件式說明照樣進 `conditional`（面板要看得到），只是不參與計算。
    const foldable = item.category === 'class' || item.category === 'heroic';
    for (const fx of effects) {
      const perSl = toFiniteInt(fx?.perSL) ?? 0;
      const flat = toFiniteInt(fx?.flat) ?? 0;
      const value = perSl * sl + flat;
      const sign = value >= 0 ? '+' : '';
      const label = `${targetLabel(fx?.target)} ${sign}${value}`;
      // 只有「無條件 ＋ 落在數值欄位上」的才折得進 totals。兩個判準都是實測逼出來的：
      //   ① **有 `condition` 的一律不折**。【靈巧雙手】的「物防 +2」條件是
      //      「裝備兩種不屬於同類別的武器」——無條件折進去等於單手空著也給 +2，
      //      那是替 GM 改規則（而且玩家永遠不會發現）。
      //   ② **`target` 不在六個數值欄位的一律不折**（damage／check／mpCost…）。
      //      折了會進 `terms`，而 `terms` 只被「數值構成」消費——那些加值最後
      //      一個地方都看不到，比不折更糟。
      const isNumeric = Object.prototype.hasOwnProperty.call(totals, fx?.target);
      const unconditional = !String(fx?.condition || '').trim();
      // 第二期：有結構化條件（`when`）就以它為準，三態判定：
      //   'true'    → 可以折進數字（條件現在真的成立）
      //   'false'   → 完全不列（技能卡上本來就寫著條件；列一條「現在不算」的加值是噪音）
      //   'unknown' → 維持第一期（列進 conditional 並附原文）
      // 「unknown 不能當 false」是這一層的鐵律：把不確定當成不成立，
      // 會靜默吃掉玩家合法的加值，而畫面上什麼都不會發生。
      // 條件來源優先序：效果自己的 `when`（同一條目裡不同效果條件不同時用）
      // → 條目級 `when`（整條共用）→ 沒有（維持第一期：列出來給人看）。
      const whenList = (Array.isArray(fx?.when) && fx.when.length)
        ? fx.when
        : (Array.isArray(item?.when) && item.when.length ? item.when : null);
      const structured = Array.isArray(whenList) && whenList.length > 0;
      const verdict = structured ? evaluateWhen(whenList, conditionCtx) : 'unknown';
      if (structured && verdict === 'false') continue;
      const satisfied = !structured ? unconditional : verdict === 'true';
      if (fx?.scope === 'permanent' && foldable && isNumeric && satisfied) {
        if (isExisting || value === 0) continue;
        totals[fx.target] += value;
        terms.push({ label, value, kind: fx.target, source: item.name });
      } else {
        conditional.push({
          label,
          value,
          target: fx?.target || 'other',
          scope: fx?.scope || 'none',
          condition: fx?.condition || '',
          source: item.name,
          existing: isExisting
        });
      }
    }
  }

  return { totals, terms, conditional };
};

// ─────────────────────────────────────────────────────────── 覆蓋率

/**
 * 覆蓋率報告（給稽核、測試與「這一期到底接通了幾條」的對帳用）。
 *
 * `untracked` 是還沒接上的條目（`apply.via === 'untracked'`），
 * `narrative` 是本來就不該有效果的敘事條目。
 * 兩者都是**清單**而不是計數：數字只能回答「還剩幾條」，
 * 清單才能回答「剩的是哪幾條」，而後者才是下一個人要的東西。
 */
export const flowCoverageReport = () => {
  const byFlow = {};
  const byCategory = {};
  const untracked = [];
  const narrative = [];
  for (const item of FLOW_ITEMS) {
    byFlow[item.flow] = (byFlow[item.flow] || 0) + 1;
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    if (item.apply?.via === 'untracked') untracked.push(item.id);
    if (item.flow === 'narrative') narrative.push(item.id);
  }
  return {
    total: FLOW_ITEMS.length,
    byFlow,
    byCategory,
    untracked,
    narrative,
    existing: FLOW_ITEMS.filter((i) => i.apply?.via === 'existing').map((i) => i.id),
    notApplied: FLOW_ITEMS.filter((i) => i.apply?.via === 'none').map((i) => i.id)
  };
};
