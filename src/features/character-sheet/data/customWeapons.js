/**
 * 定制武器（Custom Weapons）—— 高度奇幻手冊印刷 p.106～108（PDF p.108～110）。
 *
 * 這是一條**選用規則**：原書說它「簡單、直接，沒有深遠的遊戲影響，可以永遠開給
 * 任何有興趣的人」。所以它不綁定高度奇幻手冊，任何團都能單獨開啟（見 `creationRules.allowCustomWeapon`）。
 *
 * 譯名依**繁中版角色卡 Excel V2.17**（`【定制武器】` 分頁），那是高度奇幻手冊子系統的譯名權威：
 * 精準／物防提升／元素／魔防提升／強力／迅捷／可變形。
 * ※ 專案舊有的 25 筆 preset 字串用的是「快速／防禦強化／魔法防禦強化／變形」，
 * 與 Excel 不一致——**以 Excel 為準**，那批字串在接上結構化資料時一併更正。
 *
 * ※ 武器**類別名**（奧術／弓／鬥毆…）來自**核心規則書 p.129**，權威是核心漢化 PDF，
 * 不是這份 Excel（Excel 把 brawling 寫成「格鬥」）。所以類別沿用專案既有的「鬥毆」。
 */
import { applyEquipmentChoice } from '../utils/equipmentRules';

/** 基礎規格（原書 p.106 的固定值，玩家不能改） */
export const CUSTOM_WEAPON_BASE = Object.freeze({
  label: '定制武器',
  cost: 300,
  hands: 2,
  damageBonus: 5,
  /** 可變形的額外成本（原書 p.107） */
  transformingCost: 100
});

/** 訂製能力名額（原書 p.106：三項） */
export const CUSTOM_WEAPON_SLOTS = 3;

/** 十個類別（Core p.129）——與 `equipmentRules.WEAPON_CATEGORIES` 同一份來源 */
export const CUSTOM_WEAPON_CATEGORIES = Object.freeze([
  '奧術', '弓', '鬥毆', '匕首', '火器', '連枷', '重型', '矛', '劍', '投擲'
]);

/** 命中檢定二選一（原書 p.106） */
export const CUSTOM_WEAPON_ACCURACIES = Object.freeze(['DEX + INS', 'DEX + MIG']);

/** 近戰或遠程自選，與類別無關（原書 p.106） */
export const CUSTOM_WEAPON_RANGES = Object.freeze(['近戰', '遠程']);

/** 元素的八個選項（原書 p.107） */
export const CUSTOM_WEAPON_ELEMENTS = Object.freeze(['風', '電', '暗', '土', '火', '冰', '光', '毒']);

/** 強力不能用於這兩個類別（原書 p.107） */
const POWERFUL_FORBIDDEN = Object.freeze(['奧術', '匕首']);

/**
 * 七項訂製能力（原書 p.107）。
 *
 * `slots` 是佔用的名額——**迅捷佔兩個**，其餘各一個。
 * `martial` 為真者帶原書的職業武器符號，選了它這把武器就變成職業武器，需要對應職業才能裝備。
 * `costDelta` 目前只有可變形（+100z）。
 */
export const CUSTOMIZATIONS = Object.freeze([
  {
    key: 'accurate',
    name: '精準',
    slots: 1,
    martial: false,
    costDelta: 0,
    effect: '武器的命中檢定 +2。'
  },
  {
    key: 'defenseBoost',
    name: '物防提升',
    slots: 1,
    martial: false,
    costDelta: 0,
    effect: '你獲得物防 +2，並且在某些技能中會被視為裝備著一面盾牌（例如守護者的【防守掌握】與遊蕩者的【閃避】）。'
  },
  {
    key: 'elemental',
    name: '元素',
    slots: 1,
    martial: false,
    costDelta: 0,
    requiresElement: true,
    effect: '選擇風、電、暗、土、火、冰、光或毒。該武器改為造成該屬性的傷害（而非物理），並額外造成 2 點傷害。'
  },
  {
    key: 'magicDefenseBoost',
    name: '魔防提升',
    slots: 1,
    martial: true,
    costDelta: 0,
    effect: '你獲得魔防 +2。'
  },
  {
    key: 'powerful',
    name: '強力',
    slots: 1,
    martial: true,
    costDelta: 0,
    forbiddenCategories: POWERFUL_FORBIDDEN,
    conflictsWith: ['quick'],
    effect: '該武器額外造成 5 點傷害；若為重型武器則為 7 點。此訂製能力不適用於奧術與匕首類別，也不能與【迅捷】並存。'
  },
  {
    key: 'quick',
    name: '迅捷',
    slots: 2,
    martial: true,
    costDelta: 0,
    effect: '視為 2 個訂製能力。當你使用該武器執行攻擊動作時，可以進行兩次攻擊（同一或不同目標）；若如此做，兩次攻擊都遵循雙武器戰鬥規則（失去多重、HR 視為 0）。'
  },
  {
    key: 'transforming',
    name: '可變形',
    slots: 1,
    martial: false,
    costDelta: CUSTOM_WEAPON_BASE.transformingCost,
    effect: '該武器擁有第二種型態；第二型態必須另外設計成一件定制武器，且也必須擁有【可變形】，但不需要額外成本。裝備其中一種型態時可隨時變形成另一種；衝突場景中只能在你的回合、且每回合一次。若其中一種型態是職業武器，你需要對應職業才能裝備它。整把武器仍然只有一個特性，兩個型態共用。'
  }
]);

export const CUSTOMIZATION_MAP = Object.freeze(
  CUSTOMIZATIONS.reduce((acc, c) => { acc[c.key] = c; return acc; }, {})
);

export const getCustomization = (key) => CUSTOMIZATION_MAP[key] || null;

/**
 * 一件全新的定制武器（尚未選擇任何訂製能力）。
 * 名稱預設為類別名，讓「先選類別再命名」的流程不會出現空欄位。
 */
export const createCustomWeaponSpec = (overrides = {}) => ({
  id: overrides.id || `cw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  name: overrides.name || '',
  category: overrides.category || CUSTOM_WEAPON_CATEGORIES[0],
  range: overrides.range || CUSTOM_WEAPON_RANGES[0],
  accuracy: overrides.accuracy || CUSTOM_WEAPON_ACCURACIES[0],
  customizations: overrides.customizations ? [...overrides.customizations] : [],
  element: overrides.element || '',
  /** 可變形的第二型態（另一件 spec 的 id） */
  transformingId: overrides.transformingId || ''
});

/** 佔用的名額（迅捷算兩個） */
export const usedSlots = (spec) => (spec?.customizations || [])
  .reduce((sum, key) => sum + (getCustomization(key)?.slots || 0), 0);

/** 剩餘名額（不會小於 0） */
export const remainingSlots = (spec) => Math.max(0, CUSTOM_WEAPON_SLOTS - usedSlots(spec));

/** 這把武器是否為職業武器（任一訂製能力帶職業符號） */
export const isMartialCustomWeapon = (spec) => (spec?.customizations || [])
  .some((key) => getCustomization(key)?.martial === true);

/**
 * 成本：300z 起，可變形 +100z。
 * （原書只說可變形會提高成本，其餘訂製能力不影響價格。）
 */
export const customWeaponCost = (spec) => CUSTOM_WEAPON_BASE.cost
  + (spec?.customizations || []).reduce((sum, key) => sum + (getCustomization(key)?.costDelta || 0), 0);

/** 傷害加值：基礎 5 ＋ 元素 2 ＋ 強力 5（重型 7） */
export const customWeaponDamageBonus = (spec) => {
  const picks = spec?.customizations || [];
  let bonus = CUSTOM_WEAPON_BASE.damageBonus;
  if (picks.includes('elemental')) bonus += 2;
  if (picks.includes('powerful')) bonus += spec?.category === '重型' ? 7 : 5;
  return bonus;
};

/** 傷害屬性：選了元素就是該屬性，否則物理 */
export const customWeaponDamageType = (spec) => (
  (spec?.customizations || []).includes('elemental') && spec?.element ? spec.element : '物理'
);

/** 命中檢定的屬性字串（精準 +2，格式與官方武器表一致：`DEX + MIG + 2`） */
export const customWeaponAccuracyAttr = (spec) => {
  const base = spec?.accuracy || CUSTOM_WEAPON_ACCURACIES[0];
  return (spec?.customizations || []).includes('accurate') ? `${base} + 2` : base;
};

/**
 * 檢查一份定制武器規格。回傳 `{ ok, issues }`，`issues` 每筆為 `{ field, message }`。
 *
 * 這是**純函式**，UI 的即時提示與測試共用同一份判定——避免「畫面說可以、測試說不行」。
 * `siblings` 用來檢查可變形的第二型態（該型態也要有可變形）。
 */
export const validateCustomWeapon = (spec, { siblings = [] } = {}) => {
  const issues = [];
  const picks = spec?.customizations || [];

  if (!String(spec?.name || '').trim()) {
    issues.push({ field: 'name', message: '請為這把武器命名' });
  }
  if (!CUSTOM_WEAPON_CATEGORIES.includes(spec?.category)) {
    issues.push({ field: 'category', message: '請選擇一個武器類別' });
  }
  if (!CUSTOM_WEAPON_ACCURACIES.includes(spec?.accuracy)) {
    issues.push({ field: 'accuracy', message: '命中檢定必須是【DEX + INS】或【DEX + MIG】' });
  }
  if (!CUSTOM_WEAPON_RANGES.includes(spec?.range)) {
    issues.push({ field: 'range', message: '必須是近戰或遠程' });
  }

  const unknown = picks.filter((key) => !CUSTOMIZATION_MAP[key]);
  if (unknown.length > 0) {
    issues.push({ field: 'customizations', message: `未知的訂製能力：${unknown.join('、')}` });
  }
  if (new Set(picks).size !== picks.length) {
    issues.push({ field: 'customizations', message: '同一個訂製能力只能選一次' });
  }
  if (usedSlots(spec) > CUSTOM_WEAPON_SLOTS) {
    issues.push({
      field: 'customizations',
      message: `訂製能力超出名額：用了 ${usedSlots(spec)} 個，上限 ${CUSTOM_WEAPON_SLOTS} 個（迅捷佔 2 個）`
    });
  }

  // 強力的兩個限制（原書 p.107）
  if (picks.includes('powerful')) {
    if (POWERFUL_FORBIDDEN.includes(spec?.category)) {
      issues.push({ field: 'customizations', message: `【強力】不適用於${spec.category}類別` });
    }
    if (picks.includes('quick')) {
      issues.push({ field: 'customizations', message: '【強力】不能與【迅捷】並存' });
    }
  }

  // 元素必須指定屬性
  if (picks.includes('elemental') && !CUSTOM_WEAPON_ELEMENTS.includes(spec?.element)) {
    issues.push({ field: 'element', message: '選了【元素】就必須指定一種屬性' });
  }
  if (!picks.includes('elemental') && spec?.element) {
    issues.push({ field: 'element', message: '沒有選【元素】就不該指定屬性' });
  }

  // 可變形必須成對
  if (picks.includes('transforming')) {
    const other = siblings.find((s) => s.id === spec?.transformingId);
    if (!other) {
      issues.push({ field: 'transformingId', message: '【可變形】需要指定第二型態' });
    } else if (!(other.customizations || []).includes('transforming')) {
      issues.push({ field: 'transformingId', message: '第二型態也必須擁有【可變形】' });
    } else if (other.transformingId !== spec?.id) {
      issues.push({ field: 'transformingId', message: '第二型態必須指回這一型態（兩者互指）' });
    }
  }

  return { ok: issues.length === 0, issues };
};

/** 給裝備列表與角色卡用的一行摘要（純中文，不含代號以外的英文） */
export const describeCustomWeapon = (spec) => {
  const parts = [
    spec?.category,
    spec?.range,
    customWeaponAccuracyAttr(spec),
    ...(spec?.customizations || []).map((key) => {
      const def = getCustomization(key);
      if (!def) return key;
      return def.requiresElement && spec?.element ? `${def.name}（${spec.element}）` : def.name;
    })
  ].filter(Boolean);
  return parts.join('、');
};

/**
 * 需要**額外敘述**的訂製能力效果（使用者指示：「有需要額外敘述的能力，記得要寫在武器的效果。
 * 數值類的就直接加沒關係」）。
 *
 * 判準：**從數字看不出來的規則**才寫在這裡。
 * - 精準 +2／強力 +5（重型 +7）／魔防提升 +2 → 已經反映在命中式、傷害式、防禦逐項裡，不重複寫。
 * - 元素 → 傷害式已經印成「【HR + 7】火」，屬性一目了然，不重複寫。
 * - 物防提升 → **「技能判定上視為裝備著一面盾牌」是數字看不出來的**（關係到防守掌握／閃避），要寫。
 * - 迅捷 → 兩次攻擊、且要照雙武器戰鬥規則，數字看不出來，要寫。
 * - 可變形 → 第二型態與每回合一次的變形限制，數字看不出來，要寫。
 */
export const describeCustomWeaponEffects = (spec, { siblings = [] } = {}) => {
  const picks = spec?.customizations || [];
  const parts = [];

  if (picks.includes('defenseBoost')) {
    parts.push('物防提升：技能判定上視為裝備著一面盾牌');
  }
  if (picks.includes('quick')) {
    parts.push('迅捷：使用該武器執行攻擊動作時可進行兩次攻擊，兩次都遵循雙武器戰鬥規則（失去多重、HR 視為 0）');
  }
  if (picks.includes('transforming')) {
    const other = siblings.find((s) => s.id === spec?.transformingId);
    const formName = other?.name ? `「${other.name}」` : '第二型態';
    parts.push(`可變形：可切換為${formName}，衝突場景中每回合一次`);
  }

  return parts.join('。');
};

/**
 * 把規格轉成**裝備表用的武器條目**——欄位與 `rulesData.equipment.weapons` 完全一致。
 *
 * 這樣引擎、裝備挑選器、跑團卡、三頁匯出**全部不用改就能吃下它**，
 * 因為它們本來就只認這幾個欄位。做法與 §U 的 `DUAL_SHIELD`（雙盾）相同：
 * 「不是官方表裡的東西，但長得一樣」。
 *
 * `siblings` 只用來在效果文字裡寫出可變形第二型態的名字（拿不到就寫「第二型態」）。
 */
export const buildCustomWeaponEntry = (spec, { siblings = [] } = {}) => {
  const martial = isMartialCustomWeapon(spec);
  const picks = spec?.customizations || [];
  return {
    name: spec?.name || CUSTOM_WEAPON_BASE.label,
    category: spec?.category || CUSTOM_WEAPON_CATEGORIES[0],
    cost: customWeaponCost(spec),
    hands: CUSTOM_WEAPON_BASE.hands,
    attr: customWeaponAccuracyAttr(spec),
    damage: `【HR + ${customWeaponDamageBonus(spec)}】${customWeaponDamageType(spec)}`,
    range: spec?.range || CUSTOM_WEAPON_RANGES[0],
    martial,
    isCustomWeapon: true,
    customWeaponId: spec?.id || '',
    // 說明＝規格摘要 ＋ **需要敘述的效果**（數字看不出來的那些，見 describeCustomWeaponEffects）。
    // 另外單獨留一份 `effectText`：跑團面板已經用藥丸顯示命中／傷害了，
    // 那裡只該顯示「數字看不出來的規則」，再印一次規格摘要是噪音。
    note: [`定制武器：${describeCustomWeapon(spec)}`, describeCustomWeaponEffects(spec, { siblings })]
      .filter(Boolean)
      .join('　｜　'),
    effectText: describeCustomWeaponEffects(spec, { siblings }),
    // 引擎與技能判定用的旗標（原書 p.107：物防提升＝視為裝備著一面盾牌）
    countsAsShield: picks.includes('defenseBoost'),
    defBoost: picks.includes('defenseBoost') ? 2 : 0,
    mdefBoost: picks.includes('magicDefenseBoost') ? 2 : 0,
    hasQuick: picks.includes('quick'),
    isTransforming: picks.includes('transforming')
  };
};

/** 把角色身上的定制武器全部轉成武器條目（帶上彼此，可變形才寫得出第二型態的名字） */
export const buildCustomWeaponEntries = (character) => {
  const siblings = character?.customWeapons || [];
  return siblings.map((spec) => buildCustomWeaponEntry(spec, { siblings }));
};

/**
 * 改名後把**裝備欄裡的名字**一起換掉。
 *
 * 為什麼需要：`equipment.mainHand` 記的是武器的**名字**，不是 id（整個專案的裝備都這樣存，
 * 因為官方武器表是用名字當鍵）。所以玩家在鍛造台把武器改名之後，裝備欄會留著一個
 * **已經不存在的名字**——主手看起來像空的，而且可變形武器會因為找不到「哪個型態被裝備」
 * 而退回顯示第一個型態（使用者就是這樣回報的：「第二形態寫新的名字，切換後完全不會顯示，
 * 依然是寫第一個名字」）。
 *
 * 比對用 **id**（名字會變，id 不會）。回傳新的 equipment 與改名對照，讓呼叫端能寫履歷。
 */
export const syncEquipmentNames = (equipment, previousSpecs = [], nextSpecs = []) => {
  const renamed = new Map();
  (previousSpecs || []).forEach((old) => {
    const now = (nextSpecs || []).find((s) => s.id === old.id);
    if (now && old.name && now.name !== old.name) renamed.set(old.name, now.name);
  });

  const next = { ...(equipment || {}) };
  const changes = [];
  ['mainHand', 'offHand'].forEach((slot) => {
    const current = next[slot];
    if (current && renamed.has(current)) {
      next[slot] = renamed.get(current);
      changes.push({ slot, from: current, to: next[slot] });
    }
  });

  return { equipment: next, changes, renamed: changes.length > 0 };
};

/**
 * 把規格**分組**：可變形的兩個型態算**同一把武器**。
 *
 * 為什麼需要：規格層為了讓兩個型態各自能有類別／命中／傷害（原書 p.107 要求第二型態
 * 「必須設計成另一件定制武器」），所以存成兩筆。但**規則上它是一件武器**——
 * 原書明講「一件可變形武器仍然只能擁有一個特性，兩個型態共用」。
 * 介面照規格層分兩列，玩家看到的就是「兩把武器」，那不對。
 *
 * 只有**互指**才算同一把（`a.transformingId === b.id` 且 `b.transformingId === a.id`）。
 * 單邊指向的壞資料當成獨立的一把，**不要吞掉它**——寧可顯示成兩把，也不要讓玩家的武器消失。
 */
export const groupCustomWeapons = (specs = []) => {
  const byId = new Map((specs || []).map((s) => [s.id, s]));
  const seen = new Set();
  const groups = [];
  (specs || []).forEach((spec) => {
    if (seen.has(spec.id)) return;
    const partner = spec.transformingId ? byId.get(spec.transformingId) : null;
    const paired = Boolean(partner) && partner.transformingId === spec.id;
    seen.add(spec.id);
    if (paired) {
      seen.add(partner.id);
      groups.push({ id: spec.id, name: spec.name, forms: [spec, partner], isTransforming: true });
      return;
    }
    groups.push({ id: spec.id, name: spec.name, forms: [spec], isTransforming: false });
  });
  return groups;
};

/**
 * 這一組武器目前**裝在主手的是哪個型態**（沒裝備回 -1）。
 * 群組以「型態的名字」判定，因為 `equipment.mainHand` 存的是名稱。
 */
export const equippedFormIndex = (group, mainHandName) => (
  (group?.forms || []).findIndex((f) => f.name === mainHandName)
);

/**
 * 切換形態要裝上去的那一個。
 *
 * 原書 p.107：「當你裝備了兩種型態的其中一種時，你可以隨時變形成另一種形態；
 * 在衝突場景中，你只能在你的回合的一個動作使用之前或之後進行，並且每個回合只能變形一次。」
 * ——所以**切換只在已裝備時有意義**；沒裝備時回傳第一個型態（介面會顯示成「裝到主手」）。
 */
export const nextFormFor = (group, mainHandName) => {
  const forms = group?.forms || [];
  if (forms.length < 2) return forms[0] || null;
  const idx = equippedFormIndex(group, mainHandName);
  if (idx < 0) return forms[0];
  return forms[(idx + 1) % forms.length];
};

/** 依名稱找一件定制武器的條目（找不到回 null） */
export const findCustomWeaponEntry = (character, name) => (
  buildCustomWeaponEntries(character).find((w) => w.name === name) || null
);

/**
 * 把一把定制武器裝到主手，回傳**裝備物件本身**（不是包裝過的結果）。
 *
 * 為什麼要有這個函式：這段邏輯原本寫在 `CharacterEditor` 的 onClick 裡，
 * 而 `applyEquipmentChoice` 回傳的是 `{ equipment, clearedOffHand }`——
 * 內嵌版本把整包直接塞進 `equipment` 欄位，於是 `equipment.mainHand` 變成 undefined，
 * 畫面看起來**完全沒反應**（而且裝備物件被污染）。元件裡的 inline 邏輯沒有測試碰得到，
 * 所以抽成純函式，讓測試直接驗行為。
 *
 * 定制武器一律是雙手武器（HF p.106），所以副手一定會被清空。
 */
export const equipCustomWeapon = (character, weaponName, weaponMap = null) => {
  const map = weaponMap || new Map(buildCustomWeaponEntries(character).map((w) => [w.name, w]));
  const { equipment, clearedOffHand } = applyEquipmentChoice(
    character?.equipment,
    'mainHand',
    weaponName,
    map
  );
  return { equipment, clearedOffHand };
};
