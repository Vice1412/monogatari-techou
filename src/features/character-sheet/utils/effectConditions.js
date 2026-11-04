/**
 * 效果條件判定引擎（Effect Conditions）
 *
 * 第一期把 373 條效果流程接上了落點，但其中 97 條 `flow-listed` 只是「把數字與條件原文印出來」，
 * 不會自動生效。這一層負責回答唯一一個問題：**這條條件現在成立嗎？**
 *
 * ── 為什麼是「三態」而不是布林 ─────────────────────────────────────────
 *
 * 回傳 `'true' | 'false' | 'unknown'`，不是 `true/false`。
 * 缺資料（讀不到裝備名稱、武器不在表上、技能不在角色身上）時**必須回 unknown**，
 * 因為「不確定」與「不成立」在玩家身上長得完全不同：
 *
 * - 判成 `false` → 加值被靜默吃掉。玩家看到技能卡上寫著「+2 物防」，
 *   跑團卡的物防卻少了 2，而且畫面上**沒有任何一行**告訴他為什麼。
 * - 判成 `unknown` → 維持第一期行為：列進 `conditional` 並附上條件原文，
 *   玩家自己看一眼就知道該不該算。
 *
 * 兩種錯的代價不對稱：多列一條「依條件」的加值只是噪音；
 * 少算 2 點物防會在戰鬥中真的打死人。所以本檔一律「宁可 unknown」。
 *
 * ── 為什麼不 import `characterEngine` ──────────────────────────────────
 *
 * `characterEngine.js` 已經在它的第 28 行 import 了 `./effectFlow`；
 * 這一層若要接進 `characterFlowModifiers`，再反向 import 引擎就是循環依賴
 * （Vite 會把它變成半初始化的模組，錯誤現場在執行期、而且症狀完全不像循環）。
 *
 * 代價是「空手／無防具」的判定會有**第二份實作**。這正是本專案最痛的那種債
 * （`getEquippedTechnosphereSlotIds` 的註解就是在講同一件事），所以：
 *
 *   **判準逐字照抄 `characterEngine.js`，並在每一處標上來源行號。**
 *   改引擎的那一段時，這一層必須同步改——兩份判定只要有一份漂移，
 *   就會出現「技能卡說空手、引擎說沒空手」這種沒人查得出來的分歧。
 *
 * 抄的是這幾行（2026-11-03 的 `calculateCharacterStats`）：
 * - `characterEngine.js:1969`      `normName`：剝括號 ＋ `normalizeEquipmentName`
 * - `characterEngine.js:1973-1974` `NEUTRAL_ARMOR` / `NEUTRAL_SHIELD`
 * - `characterEngine.js:1983-1988` 主手查武器表，查不到再查自訂武器
 * - `characterEngine.js:1989`      `offHandSuppressed`：主手 `hands === 2` 時副手不生效
 * - `characterEngine.js:1994`      `UNARMED_ENTRY`
 * - `characterEngine.js:1995-1998` 副手只查盾表，查不到就視為中性盾（無盾牌）
 * - `characterEngine.js:2124-2130` `mainIsShieldNow` / `mainIsUnarmed` / `offIsUnarmed`
 *                                  / `handsEmpty` / `armorEmpty`
 */

import rulesData from '../data/rulesData.json';
import { normalizeEquipmentName } from '../data/sourcebookConfig';
import { buildCustomWeaponEntries } from '../data/customWeapons';

// ─────────────────────────────────────────────────────────── 封閉詞彙

/**
 * 條件種類的封閉詞彙（`CONDITION-SPEC.md` §2）。
 *
 * 引擎**不認得任何技能名**——判定只看 `when` 的結構。
 * 若哪天有人想在資料裡寫 `if (name === '靈巧雙手')` 那種特例，
 * 就得先改這份清單，而改清單會被測試的掃描自檢擋下來。
 */
export const CONDITION_KINDS = Object.freeze([
  'handsEmpty',
  'noArmor',
  'noShield',
  'noMartialArmor',
  'hasMartialArmor',
  'crisis',
  'mainWeaponCategoryIn',
  'mainWeaponRange',
  'mainWeaponHands',
  'equippedTwoCategories',
  'mainWeaponAndShield',
  'offHandIsShield',
  'equippedCategoryCount',
  'noEquippedWeapon',
  'statusCountAtLeast',
  'skillSLAtLeast',
  'levelAtLeast',
  'levelBelow',
  // 第三期：`anyOf` 是 OR 的唯一出口（外層 `when` 是 AND）。
  'anyOf'
]);

export const CONDITION_VERDICTS = Object.freeze(['true', 'false', 'unknown']);

// ─────────────────────────────────────────────────────────── 裝備表

const WEAPONS = Array.isArray(rulesData?.equipment?.weapons) ? rulesData.equipment.weapons : [];
const SHIELDS = Array.isArray(rulesData?.equipment?.shields) ? rulesData.equipment.shields : [];
const ARMORS = Array.isArray(rulesData?.equipment?.armors) ? rulesData.equipment.armors : [];

/** 中性條目（引擎 `:1973-1974`）。它們是「什麼都沒裝備」，不是裝備。 */
const NEUTRAL_ARMOR = '無裝甲 / 冒險服';
const NEUTRAL_SHIELD = '無盾牌';

/**
 * 【徒手打擊】是武器表裡**真的存在的一筆**（`category: 鬥毆`、`cost: 0`、`hands: 1`），
 * 而開卡預設的 `mainHand` 正是它——所以「空手」不能只看「查不到武器」。
 * 引擎在 `:1990-1994` 為此特別註解過，這裡照抄同一條判準。
 */
const UNARMED_ENTRY = '徒手打擊';

/** 空欄位的佔位字串（引擎把它們一律當成「沒有裝備」）。 */
const EMPTY_ARMOR_NAMES = new Set(['', '無', NEUTRAL_ARMOR]);
const EMPTY_OFFHAND_NAMES = new Set(['', '無', NEUTRAL_SHIELD, UNARMED_ENTRY]);

/** 與引擎 `:1969` 的 `normName` 同一套：先剝括號，再走 `normalizeEquipmentName`。 */
const normName = (name) => normalizeEquipmentName(
  String(name === null || name === undefined ? '' : name).replace(/\s*\([^)]*\)/g, '').trim()
);

const findByEither = (list, raw, norm) => list.find(
  (entry) => entry.name === raw || entry.name === norm
) || null;

/** 一筆手上的東西（主手／副手）。`kind` 只用四個值，避免呼叫端各自解讀。 */
const handNone = (def) => ({ kind: 'none', def: def || null, label: def?.name || '' });
const handUnknown = (label) => ({ kind: 'unknown', def: null, label: label || '' });

/**
 * 把「手部欄位裡的字串」分類成 空手／武器／盾牌／看不懂。
 *
 * 「看不懂」＝有填名字，但三張表（武器、盾、自訂武器）都查不到。
 * 這種情況**不能**當成空手（引擎目前是當成空手處理的，那是它的歷史行為），
 * 因為新書加了新武器的時候，這一條會被靜默判成 `false` 而吃掉加值。
 */
const classifyHand = (raw, { customEntries = [] } = {}) => {
  if (raw === null || raw === undefined) return handNone(null);
  const text = String(raw).trim();
  if (text === '' || text === '無') return handNone(null);
  const norm = normName(text);

  const shield = findByEither(SHIELDS, text, norm);
  if (shield) {
    return shield.name === NEUTRAL_SHIELD ? handNone(shield) : { kind: 'shield', def: shield, label: shield.name };
  }

  const weapon = findByEither(WEAPONS, text, norm);
  if (weapon) {
    // 徒手打擊不是「裝備了武器」，但它的 category／range／hands 仍然是有效資料
    // （空格的手部欄位在規則上就等於徒手打擊），所以 def 要留下來給類別判定用。
    return weapon.name === UNARMED_ENTRY
      ? handNone(weapon)
      : { kind: 'weapon', def: weapon, label: weapon.name };
  }

  const custom = customEntries.find((w) => w.name === text || w.name === norm);
  if (custom) return { kind: 'weapon', def: custom, label: custom.name };

  return handUnknown(text);
};

/**
 * 防具欄。引擎 `:1976-1977` 找不到就**回退中性防具**（等於「沒穿防具」）；
 * 這裡刻意不跟著回退：一個查不到的名字代表資料漂移，回 `unknown` 才會被看見。
 */
const classifyArmor = (raw) => {
  if (raw === null || raw === undefined) return { kind: 'none', def: null, label: '' };
  const text = String(raw).trim();
  const norm = normName(text);
  if (EMPTY_ARMOR_NAMES.has(text) || EMPTY_ARMOR_NAMES.has(norm)) return { kind: 'none', def: null, label: '' };
  const armor = findByEither(ARMORS, text, norm);
  if (!armor) return { kind: 'unknown', def: null, label: text };
  return armor.name === NEUTRAL_ARMOR
    ? { kind: 'none', def: armor, label: armor.name }
    : { kind: 'armor', def: armor, label: armor.name };
};

// ─────────────────────────────────────────────────────────── 情境

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * `character.currentHp === null` 的語意：**值**（等於最大值），不是缺資料。
 *
 * 依據：`createNewCharacter` 的即時動態資源就是 `currentHp: null`（「null 代表等於最大值」），
 * `effectFlow` 的 COST_RESOURCES 也照這個語意在補 `stats.maxHp`。
 * 若把它當成 unknown，滿血的每一個角色都會讓 `crisis` 變成 unknown——
 * 那是本專案最常見的狀態，等於這個 kind 永遠不會回 false。
 *
 * 保留成常數是為了**一行可改**：若之後決定「null 一律 unknown」，
 * 把這裡改成 false，不必動 `crisis` 的判定邏輯。
 */
const NULL_HP_MEANS_FULL = true;

/**
 * 建立判定情境（一次算好，之後每次判定都只讀）。
 *
 * 為什麼要預先算：`evaluateCondition` 會被 `characterFlowModifiers` 對 373 條 × 多個效果
 * 各呼叫一次。若每次判定都去掃三張裝備表、重建自訂武器條目，成本是 O(條目 × 效果 × 裝備表)；
 * 建一次情境則是 O(裝備表 ＋ 技能表)。
 *
 * `stats` 目前只有 `crisis` 用到（需要 `maxHp`），但整份原樣留在 `ctx.stats` 裡：
 * 之後「最大 HP 低於一半」「防禦高於 X」這類條件都會從同一份數值取，
 * 不要為了省一個欄位再從角色重算一次（重算就有第二份定義）。
 */
export const buildConditionContext = (character, stats = {}) => {
  const char = isPlainObject(character) ? character : null;
  const equipment = isPlainObject(char?.equipment) ? char.equipment : null;

  // 自訂武器：**必須**用引擎同一支 builder（`data/customWeapons.js:488`）。
  // 自己比對 `character.customWeapons[].name` 會漏掉兩件事：
  // ① 可變形的第二型態是另一件 spec、名字不同；② 定制武器固定佔兩手（`hands: 2`）。
  let customEntries = [];
  if (char) {
    try {
      customEntries = buildCustomWeaponEntries(char) || [];
    } catch {
      customEntries = [];
    }
  }

  const main = classifyHand(equipment?.mainHand, { customEntries });

  // 雙手武器佔滿兩個手部欄位（引擎 `:1989`）：副手寫著什麼都不生效。
  // 這裡只把「盾牌」抹掉（引擎的 `offHandSuppressed` 也只影響盾表查詢）。
  const offHandSuppressed = Number(main.def?.hands) === 2;
  const off = offHandSuppressed
    ? handNone(null)
    : classifyHand(equipment?.offHand, { customEntries });

  // 副手寫著「無盾牌」的佔位字串時，`classifyHand` 已經回 none；
  // 但副手寫著一個**武器**名字時，引擎的 `offIsUnarmed` 仍然會回 true
  // （`:1995-1998`：副手只查盾表，查不到就當中性盾）。那個歷史行為見 `handsEmpty` 的註解。
  const armor = classifyArmor(equipment?.armor);

  const statusAfflictions = char?.statusAfflictions;
  const statusKnown = isPlainObject(statusAfflictions);
  const statusCount = statusKnown
    ? Object.keys(statusAfflictions).filter((key) => statusAfflictions[key] === true).length
    : 0;

  const classes = Array.isArray(char?.classes) ? char.classes : null;
  const skills = {};
  if (classes) {
    for (const cl of classes) {
      for (const sk of (Array.isArray(cl?.skills) ? cl.skills : [])) {
        const name = typeof sk?.name === 'string' ? sk.name.trim() : '';
        if (!name) continue;
        const sl = Math.max(0, Math.floor(toFiniteNumber(sk?.sl) ?? 0));
        // 同名技能可能出現在兩個職業上（兼職）→ 取最高的那一份，
        // 因為條件問的是「角色的這個技能到不到 SL n」，而不是「哪一班的技能」。
        skills[name] = Math.max(skills[name] ?? 0, sl);
      }
    }
  }

  const ownLevel = toFiniteNumber(char?.level);
  const ruleLevel = toFiniteNumber(char?.creationRules?.startingLevel);
  const level = ownLevel !== null && ownLevel > 0
    ? ownLevel
    : (ruleLevel !== null && ruleLevel > 0 ? ruleLevel : null);

  // ── 危機判定用的數值 ────────────────────────────────────────────────
  //
  // `maxHp` 只從 `stats` 拿（那是 `calculateCharacterStats` 的輸出，含金手指、技能、
  // 裝備的全部加值）。不從屬性自己算：算第二份就一定會與引擎漂移。
  //
  // `currentHp === null` 在本專案是**值**，不是缺資料——`createNewCharacter` 的
  // `currentHp: null` 語意就是「等於最大值」（同 `effectFlow` 的 COST_RESOURCES 註解）。
  // 所以 null 要解讀成「滿血」（危機＝不成立），只有**欄位整個不存在**才是 unknown。
  // 若哪天要改成「null 一律 unknown」，把下面那個常數設成 false 即可。
  const statsSource = isPlainObject(stats) ? stats : {};
  const maxHpRaw = toFiniteNumber(statsSource.maxHp);
  const maxHp = maxHpRaw !== null && maxHpRaw > 0 ? maxHpRaw : null;
  const thresholdRaw = toFiniteNumber(statsSource.crisisThreshold);
  const crisisThreshold = thresholdRaw !== null
    ? thresholdRaw
    : (maxHp === null ? null : Math.floor(maxHp / 2));

  const rawHp = char ? char.currentHp : undefined;
  const currentHp = rawHp === null
    ? (NULL_HP_MEANS_FULL ? maxHp : null)
    : toFiniteNumber(rawHp);

  return {
    // 標記：呼叫端可以安全地重複傳同一個 ctx。也讓 `evaluateCondition`
    // 能分辨「傳進來的是情境」還是「傳進來的是角色」（見下方 `asContext`）。
    __isConditionContext: true,
    character: char,
    hasEquipment: Boolean(equipment),
    main,
    off,
    offHandSuppressed,
    armor,
    statusCount,
    statusKnown,
    skills,
    skillsKnown: Boolean(classes),
    level,
    maxHp,
    crisisThreshold,
    currentHp,
    stats: statsSource
  };
};

/**
 * 允許呼叫端「誤傳角色」——傳角色進來時就地建情境。
 * 為什麼要容忍：這層若對誤傳一律回 unknown，症狀會是「全部條件都不成立」，
 * 看起來像資料寫錯，而不是像參數傳錯，追起來會多花一小時。
 */
const asContext = (ctx) => {
  if (isPlainObject(ctx) && ctx.__isConditionContext === true) return ctx;
  if (ctx === null || ctx === undefined) return buildConditionContext(null);
  return buildConditionContext(ctx);
};

// ─────────────────────────────────────────────────────────── 判定

const verdict = (value) => (value ? 'true' : 'false');

/**
 * 需要裝備資料才判得出來的條件。
 *
 * 為什麼要另外列成一組：`character.equipment` **整個欄位不存在**（不是欄位裡是空字串）
 * 時，代表這份存檔根本沒有裝備資訊，不是「他什麼都沒穿」。
 * 前者回 unknown、後者才是「空手／沒有防具」——兩者在畫面上長得一樣，
 * 但一個是資料缺失、一個是真的規則成立，混在一起就會替玩家決定他沒穿防具。
 */
const EQUIPMENT_KINDS = new Set([
  'handsEmpty',
  'noArmor',
  'noShield',
  'noMartialArmor',
  'hasMartialArmor',
  'mainWeaponCategoryIn',
  'mainWeaponRange',
  'mainWeaponHands',
  'equippedTwoCategories',
  'mainWeaponAndShield',
  'offHandIsShield',
  'equippedCategoryCount',
  'noEquippedWeapon'
]);

/**
 * 單一條件判定。
 *
 * 參數不足（陣列空、`min` 不是數字、`range` 不是近戰／遠程）一律回 `'unknown'`：
 * 那是**資料寫錯**，不是「條件不成立」。寫錯的資料必須在畫面上看得見（列進 conditional），
 * 若回 false 就會安靜地消失，連「這裡有條條件寫壞了」都不會有人知道。
 *
 * @param {{kind:string}} cond
 * @param {object} ctx `buildConditionContext` 的結果（或直接傳角色，會被就地轉換）
 * @returns {'true'|'false'|'unknown'}
 */
export const evaluateCondition = (cond, ctx) => {
  if (!isPlainObject(cond)) return 'unknown';
  const kind = cond.kind;
  if (typeof kind !== 'string' || !CONDITION_KINDS.includes(kind)) return 'unknown';

  const context = asContext(ctx);
  const { main, off, armor } = context;

  // 裝備欄整個不見 → 不是「空手」，是「不知道」（見 `EQUIPMENT_KINDS` 的說明）。
  if (EQUIPMENT_KINDS.has(kind) && !context.hasEquipment) return 'unknown';

  switch (kind) {
    // 空手：主手徒手（含空格）＋ 副手沒有盾。
    //
    // 照抄引擎 `:2126-2129`，包含它的**歷史行為**：`offIsUnarmed` 只看盾表，
    // 所以副手放著一把武器時引擎仍回 true。這裡刻意不「順手修好」——
    // 這一層若比引擎嚴格，同一張卡會出現「技能卡說不算、引擎卻算了」的分歧，
    // 而那正是本檔開頭說要避免的事。要修請連 `characterEngine.js:2127` 一起改。
    case 'handsEmpty': {
      if (main.kind === 'unknown' || off.kind === 'unknown') return 'unknown';
      if (main.kind === 'shield') return 'false';
      return verdict(main.kind === 'none' && off.kind !== 'shield');
    }

    // 沒有防具：防具欄是中性防具（含空字串與「無」）。
    case 'noArmor': {
      if (armor.kind === 'unknown') return 'unknown';
      return verdict(armor.kind === 'none');
    }

    // 副手沒有盾。`offHandIsShield` 的反面，但**不能寫成 `!offHandIsShield`**：
    // 反面會把「副手名字查不到」一起算成「沒有盾」，那就把 unknown 變成 true 了
    // （而 unknown 的意義正是「我不知道」，替玩家決定他有沒有盾是這一層最不该做的事）。
    case 'noShield': {
      if (off.kind === 'unknown') return 'unknown';
      return verdict(off.kind !== 'shield');
    }

    // 防具不是**職業防具**。
    //
    // 判準取自 `rulesData.equipment.armors[].martial`：只有四件重甲（板條甲、青銅胸甲、
    // 符文甲冑、鋼鐵板甲）帶這個旗標；中性防具與輕甲（旅行皮甲、戰鬥輕甲、絲綢外衣、
    // 賢者長袍）都沒有。所以「沒穿防具」也算「不是職業防具」——這正是
    // 「閃避：未裝備盾牌與職業防具」要的語意。
    //
    // 注意：原文是「盾**或**職業防具」的那兩條（閃避、防守掌握）**不在這裡處理 OR**，
    // 由資料層寫成兩筆效果（各帶一條 `when`）——這一層只提供單一 kind。
    case 'noMartialArmor': {
      if (armor.kind === 'unknown') return 'unknown';
      if (armor.kind === 'none') return 'true';
      return verdict(armor.def?.martial !== true);
    }

    // 穿著**職業防具**（`noMartialArmor` 的正面）。
    //
    // 【防守掌握】的原文是「裝備盾牌**或**職業防具時，受到的所有傷害 −SL」。
    // 這一半單獨存在，是因為 `anyOf` 需要兩個獨立的布林——把 OR 寫在資料層用
    // 「兩筆效果」湊出來的話，`conditional` 清單會出現兩條幾乎一樣的說明。
    // 缺防具資料時回 unknown（與 `noMartialArmor` 對稱，不猜）。
    case 'hasMartialArmor': {
      if (armor.kind === 'unknown') return 'unknown';
      if (armor.kind === 'none') return 'false';
      return verdict(armor.def?.martial === true);
    }

    // 「A 或 B」：外層 `when` 是 AND，OR 只能用巢狀表達。
    // 三態合併：任一 true → true；否則任一 unknown → unknown；全 false → false。
    // **unknown 優先於 false**：只要有一支還不知道，就不能斷言「或」不成立。
    case 'anyOf': {
      const inner = Array.isArray(cond.conditions) ? cond.conditions : [];
      if (inner.length === 0) return 'unknown';
      let sawUnknown = false;
      for (const c of inner) {
        const r = evaluateCondition(c, context);
        if (r === 'true') return 'true';
        if (r === 'unknown') sawUnknown = true;
      }
      return sawUnknown ? 'unknown' : 'false';
    }

    // 處於危機：目前 HP 不超過最大 HP 的一半（`crisisThreshold`）。
    //
    // 需要 `stats`：`maxHp` 或 `currentHp` 算不出來就回 unknown，不猜。
    // `maxHp <= 0` 也視為 unknown——那是「屬性還沒指派完、數值不成立」的狀態
    // （`calculateCharacterStats` 的 `attributesUnset`），不是「最大 HP 是 0」。
    case 'crisis': {
      if (context.maxHp === null || context.currentHp === null) return 'unknown';
      const threshold = context.crisisThreshold;
      if (threshold === null) return 'unknown';
      return verdict(context.currentHp <= threshold);
    }

    // 主手武器的類別在清單內。
    case 'mainWeaponCategoryIn': {
      const cats = Array.isArray(cond.categories) ? cond.categories.filter((c) => typeof c === 'string') : [];
      if (cats.length === 0) return 'unknown';
      if (main.kind === 'unknown') return 'unknown';
      // 主手是盾牌 → 不是武器，直接不成立（不是 unknown：盾牌查得到）。
      if (main.kind === 'shield' || !main.def) return 'false';
      return verdict(cats.includes(main.def.category));
    }

    // 主手武器的 range。盾牌沒有 range，所以是 false 而不是 unknown。
    case 'mainWeaponRange': {
      if (cond.range !== '近戰' && cond.range !== '遠程') return 'unknown';
      if (main.kind === 'unknown') return 'unknown';
      if (main.kind === 'shield' || !main.def) return 'false';
      return verdict(main.def.range === cond.range);
    }

    // 主手武器的 hands。同上。
    case 'mainWeaponHands': {
      const hands = toFiniteNumber(cond.hands);
      if (hands === null) return 'unknown';
      if (main.kind === 'unknown') return 'unknown';
      if (main.kind === 'shield' || !main.def) return 'false';
      return verdict(Number(main.def.hands) === hands);
    }

    // 主副手都裝備武器，且類別不同。
    // 「裝備武器」不含徒手打擊——它只是空手欄位的名字。
    case 'equippedTwoCategories': {
      if (main.kind === 'unknown' || off.kind === 'unknown') return 'unknown';
      if (main.kind !== 'weapon' || off.kind !== 'weapon') return 'false';
      if (!main.def?.category || !off.def?.category) return 'unknown';
      return verdict(main.def.category !== off.def.category);
    }

    // 主手武器 ＋ 副手盾牌。
    case 'mainWeaponAndShield': {
      if (main.kind === 'unknown' || off.kind === 'unknown') return 'unknown';
      return verdict(main.kind === 'weapon' && off.kind === 'shield');
    }

    // 副手是盾（單獨成立即可）。
    case 'offHandIsShield': {
      if (off.kind === 'unknown') return 'unknown';
      return verdict(off.kind === 'shield');
    }

    // 已裝備的武器中，屬於該類別的件數 ≥ min。
    //
    // 徒手打擊不算「裝備」：這條問的是件數，把空手算成一件會讓
    // 「裝備兩件匕首」在空手的角色身上也成立。
    case 'equippedCategoryCount': {
      const category = typeof cond.category === 'string' ? cond.category : '';
      const min = toFiniteNumber(cond.min);
      if (!category || min === null) return 'unknown';
      if (main.kind === 'unknown' || off.kind === 'unknown') return 'unknown';
      const count = [main, off].filter(
        (hand) => hand.kind === 'weapon' && hand.def?.category === category
      ).length;
      return verdict(count >= min);
    }

    // 主副手都沒有武器（徒手或空）。
    case 'noEquippedWeapon': {
      if (main.kind === 'unknown' || off.kind === 'unknown') return 'unknown';
      return verdict(main.kind !== 'weapon' && off.kind !== 'weapon');
    }

    // 異常狀態為真的項目數 ≥ n。
    case 'statusCountAtLeast': {
      const n = toFiniteNumber(cond.n);
      if (n === null) return 'unknown';
      if (!context.statusKnown) return 'unknown';
      return verdict(context.statusCount >= n);
    }

    // 某技能（任意職業）的 SL ≥ min。
    //
    // 「技能不在角色身上」也回 unknown 而不是 false（規格 §3 明文），
    // 因為 `classes` 本身可能是舊存檔留下來的殘缺資料——
    // 分不出「真的沒學」與「資料沒帶到」時，不該替玩家做決定。
    case 'skillSLAtLeast': {
      const skill = typeof cond.skill === 'string' ? cond.skill.trim() : '';
      const min = toFiniteNumber(cond.min);
      if (!skill || min === null) return 'unknown';
      if (!context.skillsKnown) return 'unknown';
      const sl = context.skills[skill];
      if (sl === undefined) return 'unknown';
      return verdict(sl >= min);
    }

    // 等級 ≥ n。
    case 'levelAtLeast': {
      const n = toFiniteNumber(cond.n);
      if (n === null || context.level === null) return 'unknown';
      return verdict(context.level >= n);
    }

    // 等級 < n。
    case 'levelBelow': {
      const n = toFiniteNumber(cond.n);
      if (n === null || context.level === null) return 'unknown';
      return verdict(context.level < n);
    }

    default:
      return 'unknown';
  }
};

/**
 * `when` 陣列判定：**全部成立**才算成立。
 *
 * 三態的組合規則（規格 §3，順序很重要）：
 * 1. 空陣列／不是陣列 → `'unknown'`。
 *    為什麼不是 `'true'`：`when: []` 在資料上的意思是「這條還沒寫條件」，
 *    不是「這條無條件成立」。回 true 會讓 373 條裡所有還沒填 `when` 的條目瞬間全部生效。
 * 2. 任一 `false` → `false`（不必再看其他條）。
 * 3. 否則任一 `unknown` → `unknown`。
 * 4. 全部 `true` → `true`。
 *
 * @param {Array<{kind:string}>} when
 * @param {object} ctx
 * @returns {'true'|'false'|'unknown'}
 */
export const evaluateWhen = (when, ctx) => {
  if (!Array.isArray(when) || when.length === 0) return 'unknown';
  const context = asContext(ctx);
  let sawUnknown = false;
  for (const cond of when) {
    const result = evaluateCondition(cond, context);
    if (result === 'false') return 'false';
    if (result === 'unknown') sawUnknown = true;
  }
  return sawUnknown ? 'unknown' : 'true';
};

// ─────────────────────────────────────────────────────────── 文案

const CATEGORY_LABELS = {
  奧術: '奧術',
  弓: '弓',
  鬥毆: '鬥毆',
  匕首: '匕首',
  火器: '火器',
  連枷: '連枷',
  重型: '重型',
  矛: '矛',
  劍: '劍',
  投擲: '投擲'
};

const categoryLabel = (category) => CATEGORY_LABELS[category] || String(category);

/**
 * 把一條條件寫成給玩家看的一句中文。
 *
 * 為什麼要集中在這裡而不是讓 UI 各自拼字：`conditional` 的清單會跟技能卡並排顯示，
 * 兩邊用不同說法講同一條條件（「空手」／「未裝備武器」）時，
 * 玩家會以為那是兩條不同的限制。
 *
 * 未登記的 kind 回「未知條件」開頭的字串，而不是丟空字串——
 * 空字串在清單上是一行什麼都沒有的空隙，比明講「未知」更難追。
 */
export const describeCondition = (cond) => {
  if (!isPlainObject(cond)) return '未提供條件';
  const kind = cond.kind;
  switch (kind) {
    case 'handsEmpty':
      return '空手（主手徒手，副手沒有盾）';
    case 'noArmor':
      return '沒有穿防具';
    case 'noShield':
      return '副手沒有盾牌';
    case 'noMartialArmor':
      return '沒有穿職業防具';
    case 'hasMartialArmor':
      return '穿著職業防具';
    // `anyOf`：原文寫「A **或** B」時用（例如【防守掌握】的「裝備盾牌**或**職業防具」）。
    // 外層 `when` 是 AND 陣列，OR 只能用巢狀表達——這一條就是那個出口。
    case 'anyOf': {
      const inner = Array.isArray(cond.conditions) ? cond.conditions : [];
      if (inner.length === 0) return '任一條件（未指定）';
      return inner.map((c) => describeCondition(c)).join(' 或 ');
    }
    case 'crisis':
      return '處於危機（目前 HP 不超過最大 HP 的一半）';
    case 'mainWeaponCategoryIn': {
      const cats = Array.isArray(cond.categories) ? cond.categories.map(categoryLabel) : [];
      return cats.length > 0 ? `主手武器類別是 ${cats.join('、')}` : '主手武器類別（未指定）';
    }
    case 'mainWeaponRange':
      return cond.range === '近戰' || cond.range === '遠程'
        ? `主手武器是${cond.range}`
        : '主手武器距離（未指定）';
    case 'mainWeaponHands': {
      const hands = toFiniteNumber(cond.hands);
      if (hands === 1) return '主手是單手武器';
      if (hands === 2) return '主手是雙手武器';
      return '主手武器手數（未指定）';
    }
    case 'equippedTwoCategories':
      return '主副手各裝備一把不同類別的武器';
    case 'mainWeaponAndShield':
      return '主手武器＋副手盾牌';
    case 'offHandIsShield':
      return '副手裝備盾牌';
    case 'equippedCategoryCount': {
      const min = toFiniteNumber(cond.min);
      const label = typeof cond.category === 'string' ? categoryLabel(cond.category) : '（未指定）';
      return min === null ? `裝備中的${label}件數` : `裝備中的${label}至少 ${min} 件`;
    }
    case 'noEquippedWeapon':
      return '主副手都沒有武器';
    case 'statusCountAtLeast': {
      const n = toFiniteNumber(cond.n);
      return n === null ? '異常狀態數（未指定）' : `異常狀態至少 ${n} 項`;
    }
    case 'skillSLAtLeast': {
      const skill = typeof cond.skill === 'string' && cond.skill.trim() ? cond.skill.trim() : '（未指定）';
      const min = toFiniteNumber(cond.min);
      return min === null ? `技能【${skill}】的 SL` : `技能【${skill}】的 SL 至少 ${min}`;
    }
    case 'levelAtLeast': {
      const n = toFiniteNumber(cond.n);
      return n === null ? '等級（未指定）' : `等級至少 ${n}`;
    }
    case 'levelBelow': {
      const n = toFiniteNumber(cond.n);
      return n === null ? '等級上限（未指定）' : `等級低於 ${n}`;
    }
    default:
      return `未知條件（${String(kind)}）`;
  }
};
