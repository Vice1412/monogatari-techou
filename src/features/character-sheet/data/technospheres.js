/**
 * 魔晶石（Technospheres）— 科技奇幻手冊 p.132–145 的選用規則
 *
 * ## 這是什麼
 *
 * 魔晶石是「把角色的組成拆成可替換模組」的一整套規則：職業、技能、裝備品質
 * 全部變成可以拔插的晶石。它**不是單純加東西**——原書 p.130 明寫目的是
 * 「替換掉一部分複雜度，而不是單純增加」（replacing part of the complexity
 * instead of merely adding to it）。所以開啟後會**拿走**一些東西：
 * 官方武器表整份消失、盾牌消失、守護者的【雙重盾牌】作廢、
 * 修補匠的魔導球與魔法加農炮改寫。
 *
 * ## 為什麼規則文字以英文正式版為準
 *
 * 民間漢化（`resources/角色卡/04_Techno_Fantasy_科技奇幻/CHM_Playtest_中文翻译/
 * 05_可选规则_魔晶石Technospheres.md`）**只取譯名**。該檔的機制與英文正式版有
 * 至少八處實質分歧，逐條列在 `docs/decisions.md`（§BN）。最要命的三處：
 *
 *   ① 漢化寫「只能且必須選擇 **2** 個固有職業」——英文是 **exactly three**。
 *   ② 漢化寫防具最高可到 **γ**、δ「至多包括 **3** 個職業魔石」——英文 δ 只有武器，
 *      且職業魔石上限是 **2**。
 *   ③ 漢化寫「不能裝備 γ 或 δ 品級的物品」（內嵌變體）——英文只禁 **δ**。
 *
 * 另有一處**表格錯位**：漢化的 d66 對照把 11 給了「銳化 Sharpening」，
 * 英文 11 是「靈敏 Agile」。整張表的骰點全部偏移一格，照抄會讓每一次
 * 「骰 d66 抽附魔魔石」都抽錯。本檔的 d66 一律以英文 p.141–144 為準。
 *
 * ## 譯名來源
 *
 * 全部 36 筆附魔魔石的中文名取自上述漢化（該檔有完整 36 筆）。
 * 但漢化的**效果文字**有多處誤譯，本檔效果一律重譯自英文，僅沿用名稱：
 *   - 神聖 Blessed 凝聚 2：漢化寫「施法檢定 +1」，英文是**魔防 +1**。
 *   - 施法者 Sorcerous 凝聚 2：漢化寫「額外恢復 2 點 **MP**」，英文是 **HP**。
 *   - 騎士 Knightly：漢化寫「魔獸生物」，本專案物種定譯為**魔物**。
 *
 * ## 純函式邊界
 *
 * 本模組無 React 依賴，供 UI、`characterEngine.js`、`equipmentRules.js`
 * 與 `tests/technospheres.test.mjs` 共用同一份實作。
 */

// ════════════════════════════════════════════════════════════════════
// 一、模式（五態）
// ════════════════════════════════════════════════════════════════════

/**
 * 五種使用方式。`off` 以外的四種都是原書明列的：
 * `full` 是 p.134–137 的完整規則，其餘三種是 p.138 的疑難排解變體。
 *
 * ※ 這裡刻意**不用布林**：原書把「只用職業魔石」與「只用附魔魔石」寫成
 * 兩套互斥的減法規則，各自的取捨不同（一個拿走武器熟練、一個拿走 +5 HP/MP），
 * 用一個 `true` 表達不了。
 */
export const TECHNOSPHERE_MODES = Object.freeze({
  off: Object.freeze({
    key: 'off',
    label: '不使用',
    en: 'Off',
    short: '官方核心規則',
    desc: '裝備與職業完全照核心規則書。'
  }),
  full: Object.freeze({
    key: 'full',
    label: '完整規則',
    en: 'Full',
    short: '職業魔石 ＋ 附魔魔石',
    desc: '科技奇幻手冊 p.134–137。裝備只剩定制武器、防具、飾品與機師模組；'
      + '職業固定三個固有職業、不能新增；獲得 +5 最大 HP／MP 與職業近戰／遠程武器熟練。'
  }),
  integrated: Object.freeze({
    key: 'integrated',
    label: '內嵌魔晶石',
    en: 'Integrated technospheres',
    short: '職業魔石裝在裝置上',
    desc: '科技奇幻手冊 p.138。職業魔石改為裝在裝置／臂環上（數量上限 1 ＋ 等級 ÷ 15），'
      + '不能裝備 δ 品級物品，裝備上的魔石插槽只能用來裝附魔魔石。'
  }),
  mnemospheresOnly: Object.freeze({
    key: 'mnemospheresOnly',
    label: '僅職業魔石',
    en: 'Mnemospheres only',
    short: '保留原本的裝備規則',
    desc: '科技奇幻手冊 p.138。所有裝備類型恢復可用、遊戲中沒有附魔魔石；'
      + '角色維持 +5 最大 HP／MP 與一顆初始 1 級職業魔石，'
      + '但不再獲得職業近戰／遠程武器熟練。'
  }),
  hoplospheresOnly: Object.freeze({
    key: 'hoplospheresOnly',
    label: '僅附魔魔石',
    en: 'Hoplospheres only',
    short: '裝備可以改，職業不綁魔石',
    desc: '科技奇幻手冊 p.138。裝備規則照魔晶石制走，但沒有 δ 品級、沒有職業魔石；'
      + '角色不獲得 +5 最大 HP／MP，但仍獲得職業近戰／遠程武器熟練。'
  })
});

/** 模式的合法值（`CREATION_RULE_FIELDS` 的枚舉護欄會比對這份清單） */
export const TECHNOSPHERE_MODE_KEYS = Object.freeze(Object.keys(TECHNOSPHERE_MODES));

/** 官方核心規則沒有魔晶石——預設關閉 */
export const DEFAULT_TECHNOSPHERE_MODE = 'off';

/** 給 GM 面板用的下拉選項（順序即原書敘述順序：完整規則在前，變體在後） */
export const TECHNOSPHERE_MODE_OPTIONS = Object.freeze(
  ['off', 'full', 'integrated', 'mnemospheresOnly', 'hoplospheresOnly'].map((key) => TECHNOSPHERE_MODES[key])
);

/**
 * 把任意輸入收斂成合法模式。
 * 舊存檔沒有這個欄位 → 回 `off`，行為與以前完全相同。
 *
 * 大小寫與前後空白都容忍（`'FULL'`、`' full '` → `full`）：
 * 這個值會被寫進 localStorage、也會被 GM 的需求清單匯入，
 * 兩種來源都可能帶著人類手寫的痕跡。寧可收斂，不要讓它默默退回 off。
 */
export const normalizeTechnosphereMode = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (TECHNOSPHERE_MODE_KEYS.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  return TECHNOSPHERE_MODE_KEYS.includes(lower) ? lower : DEFAULT_TECHNOSPHERE_MODE;
};

/** 這團有沒有開魔晶石 */
export const isTechnosphereEnabled = (mode) => normalizeTechnosphereMode(mode) !== 'off';

/** 這個模式有沒有職業魔石 */
export const modeHasMnemospheres = (mode) => {
  const m = normalizeTechnosphereMode(mode);
  return m === 'full' || m === 'integrated' || m === 'mnemospheresOnly';
};

/** 這個模式有沒有附魔魔石 */
export const modeHasHoplospheres = (mode) => {
  const m = normalizeTechnosphereMode(mode);
  return m === 'full' || m === 'integrated' || m === 'hoplospheresOnly';
};

/**
 * 創角時 +5 最大 HP 與 +5 最大 MP（p.134）。
 * 只有「僅附魔魔石」拿掉這一條（p.138 原文：do not increase maximum HP and MP by 5）。
 */
export const modeGrantsInnateBonus = (mode) => {
  const m = normalizeTechnosphereMode(mode);
  return m === 'full' || m === 'integrated' || m === 'mnemospheresOnly';
};

/**
 * 創角時獲得「職業近戰武器與遠程武器」的裝備能力（p.134）。
 * 只有「僅職業魔石」拿掉這一條（p.138 原文：no longer gain the ability to equip
 * all martial melee and ranged weapons at character creation）。
 */
export const modeGrantsMartialWeaponProficiency = (mode) => {
  const m = normalizeTechnosphereMode(mode);
  return m === 'full' || m === 'integrated' || m === 'hoplospheresOnly';
};

/**
 * δ 品級只在武器上（`weaponOnly`），而且**兩個變體把它整級移除**（p.138）：
 * - 僅附魔魔石（hoplospheresOnly）：δ 不存在。
 * - 內嵌裝置（integrated）：「cannot equip items with a δ slot」——δ 不存在。
 *
 * ※ CHM 漢化在內嵌裝置那一段寫成「不能使用 γ 或 δ」，與英文正式版不符。
 *   英文只禁 δ，γ 照常可用。以英文為準。
 */
export const modeAllowsDeltaSlot = (mode) => {
  const m = normalizeTechnosphereMode(mode);
  // 規則沒開時不存在任何插槽品級——`off` 也必須回 false，
  // 否則 GM 面板會在下拉選單裡看到一個用不到的 δ。
  return m !== 'off' && m !== 'hoplospheresOnly' && m !== 'integrated';
};

/**
 * 裝備白名單（p.133）：只剩定制武器、防具、飾品與機師的武器／防具模組。
 * 「僅職業魔石」變體把官方裝備全部放回來（p.138）。
 */
export const modeRestrictsEquipment = (mode) => {
  const m = normalizeTechnosphereMode(mode);
  return m === 'full' || m === 'integrated' || m === 'hoplospheresOnly';
};

/** 職業魔石改裝在裝置上、不佔裝備插槽 */
export const modeUsesIntegratedCarrier = (mode) => normalizeTechnosphereMode(mode) === 'integrated';

/**
 * 魔晶石制下被原書明文作廢的技能（p.133）。
 *
 * 原文在列出裝備白名單之後補了一句：「ignore the Guardian's Dual Shield skill」——
 * 盾牌整類不存在，這個技能也就沒有作用對象。它照樣留在守護者的技能表上，
 * 所以**必須在選單層擋掉**，否則玩家會花 1 點 SL 買一個永遠不會生效的技能。
 *
 * ※ 這裡刻意只放原書點名的項目。其餘「看起來也該作廢」的技能（例如依賴盾牌的
 * 被動）原書沒說，就不自行推論。
 */
export const TECHNOSPHERE_SUPPRESSED_SKILLS = ['雙重盾牌'];

/**
 * 這個技能在當前魔晶石模式下是否被作廢。
 * `mode` 傳 `off` 或未開魔晶石時一律回 `false`。
 */
export const isSkillSuppressedByTechnospheres = (skillName, mode) => (
  modeRestrictsEquipment(mode) && TECHNOSPHERE_SUPPRESSED_SKILLS.includes(skillName)
);

/** 這個模式要不要顯示「魔晶石插槽」編輯介面（有任何一種魔石就需要） */
export const modeNeedsSlotEditor = (mode) => modeHasHoplospheres(mode);

/**
 * 內嵌裝置可容納的職業魔石數量：`1 + floor(等級 / 15)`（p.138）。
 * 例：5 級 → 1 顆；15 級 → 2 顆；30 級 → 3 顆。
 */
export const getIntegratedMnemosphereCap = (level) => 1 + Math.floor(Math.max(0, Number(level) || 0) / 15);

// ════════════════════════════════════════════════════════════════════
// 二、槽位品級（p.133 的表）
// ════════════════════════════════════════════════════════════════════

/**
 * 四級魔石插槽。原書表格逐字：
 *
 * | 品級 | 成本 | 效果 |
 * |---|---|---|
 * | α | 免費 | 1 個插槽；**所有沒有其他品級的武器與防具自動具備** |
 * | β | +600z | 2 個插槽（至多 1 個職業魔石） |
 * | γ | +1500z | 3 個插槽（至多 2 個職業魔石） |
 * | δ | +1800z | 4 個插槽（至多 2 個職業魔石）；**只存在於武器** |
 *
 * ※ α 的職業魔石上限：原文只寫「Offers 1 technosphere slot」沒寫上限。
 * 一個插槽最多放一顆，所以上限自然是 1——這裡把隱含值寫出來，
 * 免得驗證時把 α 當成「不能放職業魔石」。
 */
export const SLOT_QUALITIES = Object.freeze({
  alpha: Object.freeze({
    key: 'alpha',
    symbol: 'α',
    label: '槽位 α',
    cost: 0,
    slots: 1,
    maxMnemospheres: 1,
    weaponOnly: false,
    desc: '1 個魔石插槽。沒有其他品級的武器與防具自動具備，不額外收費。'
  }),
  beta: Object.freeze({
    key: 'beta',
    symbol: 'β',
    label: '槽位 β',
    cost: 600,
    slots: 2,
    maxMnemospheres: 1,
    weaponOnly: false,
    desc: '2 個魔石插槽（至多 1 個職業魔石）。'
  }),
  gamma: Object.freeze({
    key: 'gamma',
    symbol: 'γ',
    label: '槽位 γ',
    cost: 1500,
    slots: 3,
    maxMnemospheres: 2,
    weaponOnly: false,
    desc: '3 個魔石插槽（至多 2 個職業魔石）。'
  }),
  delta: Object.freeze({
    key: 'delta',
    symbol: 'δ',
    label: '槽位 δ',
    cost: 1800,
    slots: 4,
    maxMnemospheres: 2,
    weaponOnly: true,
    desc: '4 個魔石插槽（至多 2 個職業魔石）。只存在於武器。'
  })
});

/** 品級鍵，由低到高 */
export const SLOT_QUALITY_KEYS = Object.freeze(['alpha', 'beta', 'gamma', 'delta']);

/** 沒有額外品級時的預設值 */
export const DEFAULT_SLOT_QUALITY = 'alpha';

/** 取得品級定義（不合法一律回 α——α 是「什麼都沒加」的基準，最安全） */
export const getSlotQuality = (key) => SLOT_QUALITIES[key] || SLOT_QUALITIES[DEFAULT_SLOT_QUALITY];

/** 品級的額外成本（z）；α 為 0 */
export const slotQualityCost = (key) => getSlotQuality(key).cost;

/** 品級提供的插槽總數 */
export const slotQualityCapacity = (key) => getSlotQuality(key).slots;

/** 品級允許的職業魔石顆數上限 */
export const slotQualityMnemosphereCap = (key) => getSlotQuality(key).maxMnemospheres;

/** 這個品級是不是只給武器（δ） */
export const slotQualityIsWeaponOnly = (key) => getSlotQuality(key).weaponOnly;

/**
 * 這個模式下可選的品級清單。
 * 「僅附魔魔石」變體沒有 δ（p.138）。
 */
export const getAvailableSlotQualities = (mode) => SLOT_QUALITY_KEYS
  .filter((key) => (key === 'delta' ? modeAllowsDeltaSlot(mode) : true))
  .map((key) => SLOT_QUALITIES[key]);

/**
 * 哪些裝備位**可以**掛插槽品級（p.133）。
 *
 * 原書把這件事夾在 Equipment 段落裡：「Only **custom weapons and custom armor**
 * may have technosphere slots.」飾品（accessories）與機師的稀有模組不在其中——
 * 它們照舊存在，但永遠只有「沒有插槽」這一個選項。
 *
 * ※ 這條以前沒有實作：面板讓飾品也能選 β／γ，驗證層也只擋「δ 非武器」。
 *   兩邊一起漏，所以「飾品掛 γ 插槽」可以一路存進存檔而全綠。
 */
export const SLOT_QUALITY_ELIGIBLE_SLOTS = Object.freeze(['mainHand', 'offHand', 'armor']);

/** 這個裝備位能不能掛插槽品級（飾品不行） */
export const slotSupportsQuality = (slotId) => SLOT_QUALITY_ELIGIBLE_SLOTS.includes(slotId);

// ════════════════════════════════════════════════════════════════════
// 二之二、珠子外觀（純資料，供 UI 畫「鑲嵌」）
// ════════════════════════════════════════════════════════════════════

/**
 * 職業魔石的珠色（15 個職業各一色）。
 *
 * 為什麼要 15 個顏色：插槽裡可能同時躺著 3 顆不同職業的魔石，
 * 光靠 18px 的 gi 剪影分不出來（守護者的盾與武器大師的雙劍在縮小後幾乎同形）。
 * 顏色是**輔助**，不是替代——圖示仍是主要識別，顏色只讓「一眼掃過去」可行。
 */
export const MNEMOSPHERE_BEAD_TINTS = Object.freeze({
  魔奏者: '#8b5cf6',
  嵌合師: '#65a30d',
  指揮官: '#9c4d16',
  舞者: '#db2777',
  元素師: '#ea580c',
  熵師: '#6d28d9',
  靈能者: '#0891b2',
  狂怒鬥士: '#dc2626',
  守護者: '#2563eb',
  博學士: '#0f766e',
  吟唱者: '#c2410c',
  遊蕩者: '#475569',
  神射手: '#15803d',
  靈師: '#eab308',
  武器大師: '#7f1d1d'
});

/** 職業魔石的珠色；清單外的職業（GM 自行放寬）回中性色 */
export const getMnemosphereBeadTint = (className) => (
  MNEMOSPHERE_BEAD_TINTS[className] || '#8a7a63'
);

/**
 * 九相屬性色（給「會轉換傷害屬性」的附魔魔石上色）。
 * 與 `src/components/ui/affinityText.js` 的 `AFFINITY_BASES` 同一組字面值，
 * 但這裡刻意只放 8 個——附魔魔石裡沒有「物理」轉換。
 */
export const DAMAGE_TYPE_TINTS = Object.freeze({
  冰: '#38bdf8',
  風: '#22c55e',
  暗: '#7c3aed',
  毒: '#84cc16',
  光: '#facc15',
  土: '#a16207',
  火: '#ef4444',
  電: '#eab308'
});

/** 附魔魔石沒有傷害屬性時的珠色（泛指：金屬灰） */
export const HOPLOSPHERE_BEAD_TINT = '#8a7a63';

/** 附魔魔石的珠色：有傷害屬性就用屬性色，否則用泛指色 */
export const getHoplosphereBeadTint = (hoplosphere) => (
  DAMAGE_TYPE_TINTS[hoplosphere?.damageType] || HOPLOSPHERE_BEAD_TINT
);

/**
 * 珠子的等級環：把 `level / maxLevel` 切成等分弧段。
 *
 * 回傳純數值（起訖角度，0° 在 12 點鐘、順時針），由 UI 自己轉成 SVG path——
 * 這樣「畫幾段亮」這件事可以被測試釘住，而不必靠截圖比對。
 *
 * @param {number} level    已達等級（0–maxLevel）
 * @param {number} [maxLevel] 上限，預設 5
 * @param {number} [gapDeg] 段與段之間的縫隙角度
 * @returns {Array<{index:number, active:boolean, startDeg:number, endDeg:number}>}
 */
export const beadRingSegments = (level, maxLevel = MNEMOSPHERE_MAX_LEVEL, gapDeg = 10) => {
  const total = Math.max(1, Math.floor(Number(maxLevel) || 0));
  const lit = Math.min(total, Math.max(0, Math.floor(Number(level) || 0)));
  const sweep = 360 / total;
  const gap = Math.min(sweep * 0.6, Math.max(0, Number(gapDeg) || 0));
  return Array.from({ length: total }, (_, index) => ({
    index,
    active: index < lit,
    startDeg: index * sweep + gap / 2,
    endDeg: (index + 1) * sweep - gap / 2
  }));
};

// ════════════════════════════════════════════════════════════════════
// 三、職業魔石（Mnemospheres）
// ════════════════════════════════════════════════════════════════════

/**
 * 建議的職業魔石職業清單（p.136 逐字，共 **15** 個）：
 * Chanter, Chimerist, Commander, Dancer, Elementalist, Entropist, Esper, Fury,
 * Guardian, Loremaster, Orator, Rogue, Sharpshooter, Spiritist, Weaponmaster.
 *
 * 原書寫的是「建議」（recommended），不是硬性；但預設照它走，
 * 因為這份清單是平衡的一部分（p.132 舉例說明秘儀師刻意不在名單裡：
 * 「it is a Class that should always be extraordinary in the narrative」）。
 *
 * ※ 漢化把這件事寫成「以下職業**不存在**對應的職業魔石」並只列 5 個排除
 * （秘儀師、突變體、機師、修補匠、旅人）。英文是**正面列 15 個**，
 * 兩者差在：徽記師、暗黑之刃、以及自然奇幻與特典全部職業。
 * 本專案採英文的正面清單。
 */
export const MNEMOSPHERE_CLASSES = Object.freeze([
  '魔奏者',   // Chanter
  '嵌合師',   // Chimerist
  '指揮官',   // Commander
  '舞者',     // Dancer
  '元素師',   // Elementalist
  '熵師',     // Entropist
  '靈能者',   // Esper
  '狂怒鬥士', // Fury
  '守護者',   // Guardian
  '博學士',   // Loremaster
  '吟唱者',   // Orator
  '遊蕩者',   // Rogue
  '神射手',   // Sharpshooter
  '靈師',     // Spiritist
  '武器大師'  // Weaponmaster
]);

/** 職業魔石的最高等級（p.136：A mnemosphere may contain 5 levels at most） */
export const MNEMOSPHERE_MAX_LEVEL = 5;

/** 精通（達 5 級）時可選一個該職業或通用的英雄技能 */
export const MNEMOSPHERE_MASTERY_LEVEL = 5;

/** 固有職業的數量（p.134：exactly three Classes） */
export const INNATE_CLASS_COUNT = 3;

/** 高階角色在三個固有職業裡至少要投的等級數（p.140） */
export const INNATE_MIN_LEVELS = 5;

/** 是不是建議清單裡的職業 */
export const isMnemosphereClass = (className) => MNEMOSPHERE_CLASSES.includes(className);

/**
 * 創角時免費贈送的職業魔石顆數（p.134 的 1 顆 1 級，加上 p.140 的
 * 「每超過 5 級 10 級再多一顆 0 級」）。
 *
 * 例：5 級 → 1 顆；14 級 → 1 顆；15 級 → 2 顆；23 級 → 2 顆；25 級 → 3 顆。
 */
export const getInitialMnemosphereCount = (level) => {
  const lv = Math.max(0, Number(level) || 0);
  return 1 + Math.floor(Math.max(0, lv - 5) / 10);
};

/**
 * 創角時**第一顆**職業魔石的免費等級。
 * p.134 明寫 level 1；p.140 的追加顆數明寫 level 0。
 * 兩者不同，所以「第幾顆」要一起看。
 */
export const getInitialMnemosphereLevel = (index = 0) => (index === 0 ? 1 : 0);

/**
 * 開卡時「免費」的那幾顆職業魔石，逐顆的等級。
 *
 * 回傳陣列的**長度就是顆數**，所以「要畫幾個空珠座」與「每一顆幾級」是同一個來源——
 * 分成兩個函式就一定會有一天對不上（畫了 2 個座，卻只有 1 個知道自己是 0 級）。
 *
 * p.134 給第 1 顆（1 級）；p.140 對「起始等級高於 5」的角色每超過 5 級 10 級再給一顆
 * （0 級）。原書自己的例子：23 級 → 共 2 顆。
 *
 * ※ 參數是**起始等級**（`creationRules.startingLevel`），不是角色當前等級。
 * 用 `char.level` 會讓一個從 5 級練到 15 級的角色憑空多出一顆免費魔石——p.140 講的是
 * `When you create a character with a level higher than 5`，只管開卡那一刻。
 */
export const getInitialMnemosphereLevels = (level) => Array.from(
  { length: getInitialMnemosphereCount(level) },
  (_, index) => getInitialMnemosphereLevel(index)
);

// ════════════════════════════════════════════════════════════════════
// 四、附魔魔石（Hoplospheres）— p.141–144 的 36 筆 d66 表
// ════════════════════════════════════════════════════════════════════

/**
 * 36 筆附魔魔石。`d66` 為原書骰點（兩顆 d6，十位＋個位）。
 *
 * 欄位說明：
 * - `slots`：佔用插槽數（原書「This hoplosphere occupies 2 slots」）
 * - `weaponOnly`：原書以星號標記，只能裝在武器上
 * - `damageType`：會轉換傷害屬性的 8 筆（原書：同一把武器不能混不同傷害屬性）
 * - `effect`：基礎效果（裝備期間）
 * - `coag2` / `coag3`：凝聚 2／3 的額外效果
 *
 * 凝聚的結算方式見 `listHoplosphereEffects`。
 */
export const HOPLOSPHERES = Object.freeze([
  {
    key: 'agile', d66: '11', name: '靈敏', en: 'Agile',
    slots: 2, weaponOnly: false, damageType: null,
    effect: '你的靈巧視為提高一級骰尺寸（最大 d12）。',
    coag2: null, coag3: null
  },
  {
    key: 'arctic', d66: '12', name: '寒冰', en: 'Arctic',
    slots: 1, weaponOnly: false, damageType: '冰',
    effect: '你獲得冰屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為冰屬性。',
    coag2: '你獲得冰屬性傷害免疫。',
    coag3: '你造成的冰屬性傷害無視抗性。當你造成傷害時，可以將其改為冰屬性。'
  },
  {
    key: 'blessed', d66: '13', name: '神聖', en: 'Blessed',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對不死生物造成 2 點額外傷害。',
    coag2: '你的魔防 +1。', coag3: null
  },
  {
    key: 'brave', d66: '14', name: '勇氣', en: 'Brave',
    slots: 2, weaponOnly: false, damageType: null,
    effect: '你的意志視為提高一級骰尺寸（最大 d12）。',
    coag2: null, coag3: null
  },
  {
    key: 'crystalline', d66: '15', name: '水晶', en: 'Crystalline',
    slots: 1, weaponOnly: false, damageType: null,
    effect: '你免疫暈眩狀態。',
    coag2: '你在檢視生物、物品與地點的開放檢定獲得 +2 加值。', coag3: null
  },
  {
    key: 'cyclonic', d66: '16', name: '旋風', en: 'Cyclonic',
    slots: 1, weaponOnly: false, damageType: '風',
    effect: '你獲得風屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為風屬性。',
    coag2: '你獲得風屬性傷害免疫。',
    coag3: '你造成的風屬性傷害無視抗性。當你造成傷害時，可以將其改為風屬性。'
  },
  {
    key: 'dark', d66: '21', name: '黑暗', en: 'Dark',
    slots: 1, weaponOnly: false, damageType: '暗',
    effect: '你獲得暗屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為暗屬性。',
    coag2: '你獲得暗屬性傷害免疫。',
    coag3: '你造成的暗屬性傷害無視抗性。當你造成傷害時，可以將其改為暗屬性。'
  },
  {
    key: 'dazing', d66: '22', name: '擊暈', en: 'Dazing',
    slots: 2, weaponOnly: true, damageType: null,
    effect: '被這把武器命中的每個目標都受到暈眩狀態。',
    coag2: null, coag3: null
  },
  {
    key: 'disrupting', d66: '23', name: '干擾', en: 'Disrupting',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對構裝體造成 2 點額外傷害。',
    coag2: '你的物防 +1。', coag3: null
  },
  {
    key: 'draining', d66: '24', name: '消耗戰', en: 'Draining',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '當你用這把武器命中一個或更多生物時，你可以恢復 3 點 HP 與 3 點 MP。',
    coag2: null, coag3: null
  },
  {
    key: 'energizing', d66: '25', name: '活力', en: 'Energizing',
    slots: 1, weaponOnly: false, damageType: null,
    effect: '你免疫虛弱狀態。',
    coag2: '當你恢復 HP 時，額外恢復 2 點 HP。', coag3: null
  },
  {
    key: 'expansive', d66: '26', name: '巨化', en: 'Expansive',
    slots: 2, weaponOnly: true, damageType: null,
    effect: '使用這把武器的攻擊獲得「多重（2）」特性。',
    coag2: null, coag3: null
  },
  {
    key: 'ghastly', d66: '31', name: '可怖', en: 'Ghastly',
    slots: 2, weaponOnly: true, damageType: null,
    effect: '被這把武器命中的每個目標都受到動搖狀態。',
    coag2: null, coag3: null
  },
  {
    key: 'gladiator', d66: '32', name: '角鬥士', en: 'Gladiator',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對類人生物造成 2 點額外傷害。',
    coag2: '你的物防 +1。', coag3: null
  },
  {
    key: 'knightly', d66: '33', name: '騎士', en: 'Knightly',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對魔物造成 2 點額外傷害。',
    coag2: '你的魔防 +1。', coag3: null
  },
  {
    key: 'medical', d66: '34', name: '醫藥學', en: 'Medical',
    slots: 1, weaponOnly: false, damageType: null,
    effect: '當你以藥水使一個或更多生物恢復 HP 或 MP 時，該藥水使他們額外恢復 2 點對應數值。',
    coag2: '當你以藥水使一個或更多生物恢復 HP 或 MP 時，該藥水使他們再額外恢復 1 點對應數值。',
    coag3: null
  },
  {
    key: 'mighty', d66: '35', name: '強力', en: 'Mighty',
    slots: 2, weaponOnly: false, damageType: null,
    effect: '你的力量視為提高一級骰尺寸（最大 d12）。',
    coag2: null, coag3: null
  },
  {
    key: 'occult', d66: '36', name: '秘法', en: 'Occult',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對元素生物造成 2 點額外傷害。',
    coag2: '你的魔防 +1。', coag3: null
  },
  {
    key: 'piercing', d66: '41', name: '穿刺', en: 'Piercing',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器造成的傷害無視抗性。',
    coag2: '這把武器造成的傷害無視抗性與免疫。', coag3: null
  },
  {
    key: 'poisonous', d66: '42', name: '淬毒', en: 'Poisonous',
    slots: 1, weaponOnly: false, damageType: '毒',
    effect: '你獲得毒屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為毒屬性。',
    coag2: '你獲得毒屬性傷害免疫。',
    coag3: '你造成的毒屬性傷害無視抗性。當你造成傷害時，可以將其改為毒屬性。'
  },
  {
    key: 'predator', d66: '43', name: '捕食者', en: 'Predator',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對野獸造成 2 點額外傷害。',
    coag2: '你的物防 +1。', coag3: null
  },
  {
    key: 'quick', d66: '44', name: '急速', en: 'Quick',
    slots: 1, weaponOnly: false, damageType: null,
    effect: '你免疫緩慢狀態。',
    coag2: '你的先攻檢定 +2。', coag3: null
  },
  {
    key: 'radiant', d66: '45', name: '輻光', en: 'Radiant',
    slots: 1, weaponOnly: false, damageType: '光',
    effect: '你獲得光屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為光屬性。',
    coag2: '你獲得光屬性傷害免疫。',
    coag3: '你造成的光屬性傷害無視抗性。當你造成傷害時，可以將其改為光屬性。'
  },
  {
    key: 'reaping', d66: '46', name: '收割', en: 'Reaping',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對植物造成 2 點額外傷害。',
    coag2: '你的物防 +1。', coag3: null
  },
  {
    key: 'revealing', d66: '51', name: '揭示', en: 'Revealing',
    slots: 2, weaponOnly: false, damageType: null,
    effect: '你的洞察視為提高一級骰尺寸（最大 d12）。',
    coag2: null, coag3: null
  },
  {
    key: 'sharpening', d66: '52', name: '銳化', en: 'Sharpening',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器的命中檢定 +1。',
    coag2: '這把武器造成 2 點額外傷害。', coag3: null
  },
  {
    key: 'scornful', d66: '53', name: '輕蔑', en: 'Scornful',
    slots: 2, weaponOnly: true, damageType: null,
    effect: '被這把武器命中的每個目標都受到憤怒狀態。',
    coag2: null, coag3: null
  },
  {
    key: 'seismic', d66: '54', name: '地震', en: 'Seismic',
    slots: 1, weaponOnly: false, damageType: '土',
    effect: '你獲得土屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為土屬性。',
    coag2: '你獲得土屬性傷害免疫。',
    coag3: '你造成的土屬性傷害無視抗性。當你造成傷害時，可以將其改為土屬性。'
  },
  {
    key: 'skeptical', d66: '55', name: '懷疑', en: 'Skeptical',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '這把武器對惡魔造成 2 點額外傷害。',
    coag2: '你的魔防 +1。', coag3: null
  },
  {
    key: 'snaring', d66: '56', name: '捕獲', en: 'Snaring',
    slots: 2, weaponOnly: true, damageType: null,
    effect: '被這把武器命中的每個目標都受到緩慢狀態。',
    coag2: null, coag3: null
  },
  {
    key: 'sorcerous', d66: '61', name: '施法者', en: 'Sorcerous',
    slots: 1, weaponOnly: true, damageType: null,
    effect: '使用這把武器的攻擊改為對抗目標的魔防。',
    coag2: '你施展的咒語造成 2 點額外傷害；使你施展的咒語讓生物恢復 HP 時，額外恢復 2 點 HP。',
    coag3: null
  },
  {
    key: 'steadfast', d66: '62', name: '堅定', en: 'Steadfast',
    slots: 1, weaponOnly: false, damageType: null,
    effect: '你免疫動搖狀態。',
    coag2: '當你恢復 MP 時，額外恢復 2 點 MP。', coag3: null
  },
  {
    key: 'tiring', d66: '63', name: '減氣', en: 'Tiring',
    slots: 2, weaponOnly: true, damageType: null,
    effect: '被這把武器命中的每個目標都受到虛弱狀態。',
    coag2: null, coag3: null
  },
  {
    key: 'toxic', d66: '64', name: '劇毒', en: 'Toxic',
    slots: 2, weaponOnly: true, damageType: null,
    effect: '被這把武器命中的每個目標都受到中毒狀態。',
    coag2: null, coag3: null
  },
  {
    key: 'volcanic', d66: '65', name: '火山', en: 'Volcanic',
    slots: 1, weaponOnly: false, damageType: '火',
    effect: '你獲得火屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為火屬性。',
    coag2: '你獲得火屬性傷害免疫。',
    coag3: '你造成的火屬性傷害無視抗性。當你造成傷害時，可以將其改為火屬性。'
  },
  {
    key: 'voltaic', d66: '66', name: '電流', en: 'Voltaic',
    slots: 1, weaponOnly: false, damageType: '電',
    effect: '你獲得電屬性傷害抗性。若這件物品是武器，它造成的所有傷害變為電屬性。',
    coag2: '你獲得電屬性傷害免疫。',
    coag3: '你造成的電屬性傷害無視抗性。當你造成傷害時，可以將其改為電屬性。'
  }
]);

/** key → 附魔魔石 */
export const HOPLOSPHERE_MAP = Object.freeze(
  HOPLOSPHERES.reduce((acc, h) => { acc[h.key] = h; return acc; }, {})
);

/** 取得附魔魔石；不合法回 `null`（呼叫端負責給訊息） */
export const getHoplosphere = (key) => HOPLOSPHERE_MAP[key] || null;

/** 附魔魔石的單顆價格（p.137：each technosphere is worth approximately 500 zenit） */
export const HOPLOSPHERE_PRICE = 500;

/**
 * 職業魔石的價格（p.137：每個已存在的等級再 +300z）。
 * 例：1 級 = 800z、5 級 = 2000z。
 */
export const mnemospherePrice = (level) => (
  HOPLOSPHERE_PRICE + 300 * Math.max(0, Number(level) || 0)
);

/** 由 d66 骰點找附魔魔石（給「隨機抽一顆」用） */
export const findHoplosphereByD66 = (d66) => HOPLOSPHERES.find((h) => h.d66 === String(d66)) || null;

/** 會轉換傷害屬性的附魔魔石（同一把武器不能混用，p.141） */
export const DAMAGE_TYPE_HOPLOSPHERES = Object.freeze(
  HOPLOSPHERES.filter((h) => h.damageType).map((h) => h.key)
);

// ════════════════════════════════════════════════════════════════════
// 五、狀態的正規化
// ════════════════════════════════════════════════════════════════════

/**
 * 角色的魔晶石狀態。掛在 `char.technospheres` 上。
 *
 * ```js
 * {
 *   mnemospheres: [ { id, className, level, skills: [{ name, sl }], heroicSkill } ],
 *   slots: { mainHand: { quality, contents: [{ kind, ref }] }, armor: { ... } },
 *   integrated: ['mn-xxxx']   // 內嵌變體：裝在裝置上的職業魔石 id
 * }
 * ```
 *
 * `contents` 裡的 `kind` 只有 `'mnemosphere'`（`ref` 是魔石 id）與
 * `'hoplosphere'`（`ref` 是附魔魔石的 key）。同一件物品可以重複放同一種附魔魔石
 * （原書 p.135：You can place two or more identical hoplospheres within the same item），
 * 所以 `contents` 是陣列而不是計數表。
 */
export const createTechnosphereState = () => ({
  mnemospheres: [],
  slots: {},
  integrated: []
});

/** 產生職業魔石 id（決定性：由職業名＋序號組成，方便除錯與測試） */
export const makeMnemosphereId = (className, seed = 0) => (
  `mn-${seed}-${String(className || 'unknown')}`
);

/**
 * 建立一顆職業魔石。
 * 不合法的一律收斂成安全值——這是**存檔正規化**，不是驗證；
 * 驗證交給 `validateTechnosphereState`。
 */
export const createMnemosphere = (overrides = {}) => {
  const className = MNEMOSPHERE_CLASSES.includes(overrides.className)
    ? overrides.className
    : MNEMOSPHERE_CLASSES[0];
  const level = Math.min(
    MNEMOSPHERE_MAX_LEVEL,
    Math.max(0, Math.floor(Number(overrides.level) || 0))
  );
  const skills = Array.isArray(overrides.skills)
    ? overrides.skills
      .filter((s) => s && typeof s.name === 'string' && s.name)
      .map((s) => ({ name: s.name, sl: Math.max(0, Math.floor(Number(s.sl) || 0)) }))
    : [];
  return {
    id: overrides.id || makeMnemosphereId(className, Math.floor(Math.random() * 1e6)),
    className,
    level,
    skills,
    heroicSkill: typeof overrides.heroicSkill === 'string' && overrides.heroicSkill
      ? overrides.heroicSkill
      : null
  };
};

/**
 * 建一顆**開卡免費額度**裡的職業魔石：第 `index` 顆，等級由 p.134／p.140 決定。
 *
 * 為什麼要有這個函式，而不是讓 UI 自己寫 `createMnemosphere({ className, level })`：
 * 「第幾顆是幾級」是規則，不是排版。寫在 `onChange` 裡就永遠測不到——2026-10-22 的
 * 實際 bug 就是這樣發生的：呼叫端漏傳 `level`，`createMnemosphere` 的預設值 0 生效，
 * 於是「開局免費的 1 級魔石」建出來是 0 級（文案寫 1 級、珠子顯示 0 級、技能分不了半點），
 * 而所有 SSR 斷言照樣全綠。抽成純函式之後，`buildInitialMnemosphere(x, 0).level === 1`
 * 是一條會失敗的斷言。
 *
 * @param {string} className 職業名（不在清單上會被 `createMnemosphere` 收斂成第一個）
 * @param {number} index 第幾顆（0 起算）
 * @returns {object} 職業魔石
 */
export const buildInitialMnemosphere = (className, index = 0) => createMnemosphere({
  className,
  level: getInitialMnemosphereLevel(index)
});

/** 單一裝備槽的正規化 */const normalizeSlotState = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const quality = SLOT_QUALITY_KEYS.includes(raw.quality) ? raw.quality : DEFAULT_SLOT_QUALITY;
  const contents = Array.isArray(raw.contents)
    ? raw.contents
      .filter((c) => c && typeof c.ref === 'string' && c.ref)
      .filter((c) => c.kind === 'mnemosphere' || c.kind === 'hoplosphere')
      .map((c) => ({ kind: c.kind, ref: c.ref }))
    : [];
  return { quality, contents };
};

/**
 * 把任意（含舊存檔、壞資料）收斂成合法狀態。
 * 沒有這個欄位的舊角色 → 回空狀態，行為與以前完全相同。
 */
export const normalizeTechnosphereState = (raw) => {
  if (!raw || typeof raw !== 'object') return createTechnosphereState();
  const mnemospheres = Array.isArray(raw.mnemospheres)
    ? raw.mnemospheres.filter((m) => m && typeof m === 'object').map((m) => createMnemosphere(m))
    : [];
  const slots = {};
  if (raw.slots && typeof raw.slots === 'object') {
    Object.keys(raw.slots).forEach((slotId) => {
      const normalized = normalizeSlotState(raw.slots[slotId]);
      if (normalized) slots[slotId] = normalized;
    });
  }
  const ids = new Set(mnemospheres.map((m) => m.id));
  const integrated = Array.isArray(raw.integrated)
    ? raw.integrated.filter((id) => typeof id === 'string' && ids.has(id))
    : [];
  return { mnemospheres, slots, integrated };
};

// ════════════════════════════════════════════════════════════════════
// 六、插槽佔用與凝聚結算
// ════════════════════════════════════════════════════════════════════

/**
 * 算出一個槽位的佔用情況。
 *
 * @param {{quality:string, contents:Array}} slot
 * @param {Map<string, object>} [mnemosphereIndex] id → 魔石（用不到時可省略）
 * @returns {{capacity:number, used:number, remaining:number,
 *            mnemosphereCount:number, mnemosphereCap:number,
 *            hoplosphereCounts:Object, overflow:boolean, mnemosphereOverflow:boolean}}
 */
export const computeSlotUsage = (slot, mnemosphereIndex = null) => {
  const quality = getSlotQuality(slot?.quality);
  const contents = Array.isArray(slot?.contents) ? slot.contents : [];
  let used = 0;
  let mnemosphereCount = 0;
  const hoplosphereCounts = {};

  contents.forEach((entry) => {
    if (entry.kind === 'mnemosphere') {
      mnemosphereCount += 1;
      used += 1; // 職業魔石固定佔 1 個插槽
      return;
    }
    const hop = getHoplosphere(entry.ref);
    used += hop ? hop.slots : 1;
    if (hop) hoplosphereCounts[hop.key] = (hoplosphereCounts[hop.key] || 0) + 1;
  });

  // 內嵌變體把職業魔石搬出裝備，槽位裡不該再有職業魔石——但佔用計算本身照算，
  // 「該不該出現」由驗證層判斷。
  void mnemosphereIndex;

  return {
    capacity: quality.slots,
    used,
    remaining: quality.slots - used,
    mnemosphereCount,
    mnemosphereCap: quality.maxMnemospheres,
    hoplosphereCounts,
    overflow: used > quality.slots,
    mnemosphereOverflow: mnemosphereCount > quality.maxMnemospheres
  };
};

/**
 * 凝聚（Coagulation）結算。
 *
 * 原書 p.139 的例子是唯一判準：
 *   - 兩個寒冰 → 每個都給「抗性」與「凝聚 2 的免疫」，**結果是免疫**（狀態型取最強，不疊加）
 *   - 三個角鬥士 → 「6 點額外傷害（每顆 2 點）」＋「物防 +3」
 *
 * 所以規則是：**每顆魔石各自結算並疊加**；凝聚 N 的門檻是「同一個物品內
 * 該種魔石達到 N 顆」，達到後**每一顆**都取得該凝聚效果。
 * 數值型效果因此會隨顆數線性疊加（3 顆 → 3 倍），狀態型效果則取最強者。
 *
 * 本函式回傳「逐筆效果」，由呼叫端決定怎麼顯示；不嘗試自動合併成
 * 「最終物防 +3」這種單一數字——那需要理解每一句效果文的語意，
 * 超出純函式能保證的範圍。**顯示層照原書的逐筆寫法呈現即可。**
 *
 * @param {Array<{kind:string, ref:string}>} contents
 * @returns {{entries:Array<object>, damageTypeConflicts:string[]}}
 */
export const listHoplosphereEffects = (contents = []) => {
  const counts = {};
  (Array.isArray(contents) ? contents : []).forEach((entry) => {
    if (entry?.kind !== 'hoplosphere') return;
    if (!getHoplosphere(entry.ref)) return;
    counts[entry.ref] = (counts[entry.ref] || 0) + 1;
  });

  const entries = [];
  Object.keys(counts).forEach((key) => {
    const hop = getHoplosphere(key);
    const count = counts[key];
    // 每一顆都給基礎效果（原書例子：3 顆角鬥士 = 每顆 2 點 = 6 點）
    for (let i = 0; i < count; i += 1) {
      entries.push({
        key: hop.key,
        name: hop.name,
        en: hop.en,
        tier: 'base',
        count,
        text: hop.effect
      });
    }
    // 凝聚效果：達門檻後**每一顆**都取得
    if (count >= 2 && hop.coag2) {
      for (let i = 0; i < count; i += 1) {
        entries.push({
          key: hop.key, name: hop.name, en: hop.en,
          tier: 'coag2', count, text: hop.coag2
        });
      }
    }
    if (count >= 3 && hop.coag3) {
      for (let i = 0; i < count; i += 1) {
        entries.push({
          key: hop.key, name: hop.name, en: hop.en,
          tier: 'coag3', count, text: hop.coag3
        });
      }
    }
  });

  // 同一把武器不能混不同傷害屬性的附魔魔石（p.141；防具不受此限）
  const damageTypes = [...new Set(
    Object.keys(counts)
      .map((key) => getHoplosphere(key)?.damageType)
      .filter(Boolean)
  )];

  return {
    entries,
    damageTypeConflicts: damageTypes.length > 1 ? damageTypes : []
  };
};

// ════════════════════════════════════════════════════════════════════
// 七、職業魔石的技能彙總
// ════════════════════════════════════════════════════════════════════

/**
 * 角色**持有**的職業魔石——不論有沒有裝進插槽。
 *
 * 與 `getActiveMnemospheres` 的分工是這一節最重要的一件事：
 *
 * | 概念 | 選擇器 | 用在哪 |
 * |---|---|---|
 * | 持有 | `getHeldMnemospheres` | 建角第 2 步「職業與技能」：投等級、分配技能 |
 * | 生效 | `getActiveMnemospheres` | 引擎與跑團卡：真的提供技能的只有已裝備的 |
 *
 * 為什麼要分：p.134 說升級點可以投進「固有職業**或**職業魔石」，那是**成長**；
 * p.136 說「只要裝備著…一旦卸下就全部失去」，那是**生效**。兩件事分開之後，
 * 第 2 步才能在魔石還沒裝上時就回答「若裝上，你的技能水準相當於幾級」——
 * 而引擎仍然只認已裝備的，不會變成「沒裝的魔石也給技能」。
 *
 * @param {object} state `char.technospheres`
 * @returns {Array<object>} 持有的魔石（正規化後）
 */
export const getHeldMnemospheres = (state) => normalizeTechnosphereState(state).mnemospheres;

/**
 * 升級時**可以投點**的職業魔石。
 *
 * p.134 說升級的那一點可以「invest into an Innate Class **or** into a mnemosphere」，
 * 所以升級面板必須列出魔石；但 p.136 的上限是 5 級——滿級的魔石不再吃點數，
 * 列出來只會讓玩家點了一個什麼都不會發生的選項。
 *
 * 這條判定刻意放在資料層而不是元件裡：元件裡的 `filter` 在 SSR 測不到
 * （`AGENTS.md` §1「`onClick` 內的邏輯 SSR 測不到」的同一條理由），
 * 而「滿級魔石不該出現在候選」是規則，不是排版。
 *
 * @param {object} state `char.technospheres`
 * @returns {Array<object>} 未滿 5 級的持有魔石
 */
export const getLevelUpMnemosphereCandidates = (state) => getHeldMnemospheres(state)
  .filter((m) => (Number(m?.level) || 0) < MNEMOSPHERE_MAX_LEVEL);

/**
 * 目前**生效中**的職業魔石。
 *
 * 原書 p.136：只要裝備著含有職業魔石的武器或防具，就取得其中所有技能；
 * 一旦卸下就全部失去。所以「生效」＝ 有被裝在某個已裝備的物品槽裡，
 * 或（內嵌變體）在 `integrated` 清單裡。
 *
 * @param {object} state `char.technospheres`
 * @param {{equippedSlots?:string[]}} [options] 目前真正裝著東西的槽位 id
 * @returns {Array<object>} 生效中的魔石
 */
export const getActiveMnemospheres = (state, options = {}) => {
  const normalized = normalizeTechnosphereState(state);
  const equippedSlots = Array.isArray(options.equippedSlots) ? options.equippedSlots : null;
  const activeIds = new Set();

  Object.keys(normalized.slots).forEach((slotId) => {
    if (equippedSlots && !equippedSlots.includes(slotId)) return;
    normalized.slots[slotId].contents.forEach((entry) => {
      if (entry.kind === 'mnemosphere') activeIds.add(entry.ref);
    });
  });
  normalized.integrated.forEach((id) => activeIds.add(id));

  return normalized.mnemospheres.filter((m) => activeIds.has(m.id));
};

/**
 * 把所有生效中的職業魔石技能攤平成 `{ name, sl, source }` 清單。
 * `source` 是魔石 id，供 UI 標示來源、驗證層比對重複。
 */
export const getMnemosphereSkills = (mnemospheres = []) => {
  const flat = [];
  (Array.isArray(mnemospheres) ? mnemospheres : []).forEach((m) => {
    (m.skills || []).forEach((s) => {
      if (!s?.name || !(Number(s.sl) > 0)) return;
      flat.push({ name: s.name, sl: Number(s.sl), source: m.id, className: m.className });
    });
  });
  return flat;
};

/**
 * 職業魔石的總等級。
 * 原書 p.134 的例子：「5 級角色裝 5 級守護者＋3 級元素師 → 技能水準相當於 13 級角色」
 * （5 ＋ 5 ＋ 3），所以這個數字要計入技能等級總量，但**不計入角色等級**。
 */
export const getMnemosphereLevelTotal = (mnemospheres = []) => (
  (Array.isArray(mnemospheres) ? mnemospheres : [])
    .reduce((sum, m) => sum + Math.max(0, Number(m.level) || 0), 0)
);

/**
 * 技能等級的理論上限：角色等級 ＋ 生效中職業魔石的總等級。
 *
 * 標準規則下兩者相等（角色等級就是技能等級總和）；魔晶石制下角色等級
 * 與職業等級脫鉤（p.134），所以上限必須另外算。
 * 創角時那顆免費的 1 級魔石也在此自然被計入。
 */
export const getSkillLevelCeiling = (level, mnemospheres = []) => (
  Math.max(0, Number(level) || 0) + getMnemosphereLevelTotal(mnemospheres)
);

// ════════════════════════════════════════════════════════════════════
// 八、驗證（純函式，不含職業資料）
// ════════════════════════════════════════════════════════════════════

/**
 * 魔晶石狀態的驗證。回傳 `[{ level, field, message }]`，
 * `level` 為 `'error'` 或 `'warning'`——與 `validateCharacter` 的警告格式一致。
 *
 * **這裡刻意不碰職業技能表**：技能是否存在、SL 上限多少，屬於
 * `characterEngine.js`（它才握有 `rulesData`）。本函式只做「不需要職業資料
 * 就能判定」的結構與規則檢查，避免資料層反向依賴規則層。
 *
 * @param {object} params
 * @param {object} params.state            `char.technospheres`
 * @param {string} params.mode             開卡規則的 technospheres 模式
 * @param {number} params.level            角色等級（內嵌上限用）
 * @param {string[]} [params.weaponSlots]  哪些槽位是武器（δ 與星號附魔魔石需要）
 * @param {string[]} [params.equippedSlots] 實際裝著物品的槽位
 * @param {string[]} [params.ownedSkillNames] 角色本來就有的技能名（含英雄技能）
 * @returns {Array<{level:string, field:string, message:string}>}
 */
export const validateTechnosphereState = ({
  state,
  mode,
  level = 0,
  weaponSlots = ['mainHand', 'offHand'],
  equippedSlots = null,
  ownedSkillNames = []
} = {}) => {
  const issues = [];
  const push = (lv, field, message) => issues.push({ level: lv, field, message });

  if (!isTechnosphereEnabled(mode)) return issues;

  const normalized = normalizeTechnosphereState(state);
  const { mnemospheres, slots, integrated } = normalized;
  const mnemosphereById = new Map(mnemospheres.map((m) => [m.id, m]));
  const hasMnemospheres = modeHasMnemospheres(mode);
  const hasHoplospheres = modeHasHoplospheres(mode);
  const isIntegrated = modeUsesIntegratedCarrier(mode);
  const allowsDelta = modeAllowsDeltaSlot(mode);

  // ── 職業魔石本身的合法性 ──────────────────────────────────────
  //
  // ※ 這兩條必須看**原始值**：`normalizeTechnosphereState` 會把超額等級夾到 5 級、
  //   把不在清單上的職業收斂成清單第一個。若拿正規化後的資料驗證，
  //   這兩個錯誤永遠驗不出來（存檔壞了卻顯示「一切正常」）。
  const rawMnemospheres = Array.isArray(state?.mnemospheres) ? state.mnemospheres : [];
  rawMnemospheres.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const label = MNEMOSPHERE_CLASSES.includes(raw.className)
      ? raw.className
      : (mnemospheres[index]?.className || String(raw.className || '未命名'));
    if (Number(raw.level) > MNEMOSPHERE_MAX_LEVEL) {
      push('error', 'technospheres',
        `【${label}】職業魔石最多 ${MNEMOSPHERE_MAX_LEVEL} 級`
        + `（存檔寫成 ${Number(raw.level)} 級，已夾制）`);
    }
    if (typeof raw.className === 'string' && raw.className && !isMnemosphereClass(raw.className)) {
      push('warning', 'technospheres',
        `【${raw.className}】不在原書建議的 ${MNEMOSPHERE_CLASSES.length} 個職業魔石清單裡`
        + '（科技奇幻手冊 p.136；GM 可自行放寬）');
    }
  });

  mnemospheres.forEach((m) => {
    if (!hasMnemospheres) {
      push('error', 'technospheres',
        `此團的魔晶石規則沒有職業魔石，請移除【${m.className}】職業魔石`);
      return;
    }
    if (m.level >= MNEMOSPHERE_MASTERY_LEVEL && !m.heroicSkill) {
      push('warning', 'technospheres',
        `【${m.className}】職業魔石已達 ${m.level} 級（精通），尚未選擇英雄技能`);
    }
    // 魔石的等級就是它的技能點數（p.136：每一級給該職業的一個技能等級）。
    // 這條不需要職業技能表就能判定，所以留在資料層。
    const spent = (m.skills || [])
      .reduce((sum, sk) => sum + Math.max(0, Number(sk.sl) || 0), 0);
    if (spent > m.level) {
      push('error', 'technospheres',
        `【${m.className}】職業魔石只有 ${m.level} 點技能可分配，目前已分配 ${spent} 點`);
    }
  });

  // ── 同一件物品不能有兩顆共享技能的職業魔石（p.135）────────────
  Object.keys(slots).forEach((slotId) => {
    const slot = slots[slotId];
    const mnemosphereIds = slot.contents
      .filter((c) => c.kind === 'mnemosphere')
      .map((c) => c.ref)
      .filter((id) => mnemosphereById.has(id));

    for (let i = 0; i < mnemosphereIds.length; i += 1) {
      for (let j = i + 1; j < mnemosphereIds.length; j += 1) {
        const a = mnemosphereById.get(mnemosphereIds[i]);
        const b = mnemosphereById.get(mnemosphereIds[j]);
        const shared = (a.skills || [])
          .map((s) => s.name)
          .filter((name) => (b.skills || []).some((s) => s.name === name));
        if (shared.length > 0) {
          push('error', 'technospheres',
            `同一個物品不能裝兩顆共享技能的職業魔石（【${a.className}】與【${b.className}】`
            + `都含有：${shared.join('、')}）`);
        }
      }
    }
  });

  // ── 角色不能裝備含「自己已經有的技能」的職業魔石（p.135）───────
  if (ownedSkillNames.length > 0) {
    const owned = new Set(ownedSkillNames);
    const checked = new Set();
    const checkAgainstOwned = (m) => {
      if (!m || checked.has(m.id)) return;
      checked.add(m.id);
      const dup = (m.skills || []).map((s) => s.name).filter((name) => owned.has(name));
      if (m.heroicSkill && owned.has(m.heroicSkill)) dup.push(m.heroicSkill);
      if (dup.length > 0) {
        push('error', 'technospheres',
          `【${m.className}】職業魔石含有你已經具備的技能（${[...new Set(dup)].join('、')}），`
          + '不能裝備它');
      }
    };
    mnemospheres.forEach(checkAgainstOwned);
  }

  // ── 內嵌變體（p.138）──────────────────────────────────────────
  if (isIntegrated) {
    const cap = getIntegratedMnemosphereCap(level);
    if (integrated.length > cap) {
      push('error', 'technospheres',
        `內嵌裝置最多可容納 ${cap} 顆職業魔石（1 ＋ 等級 ÷ 15；目前 ${integrated.length} 顆）`);
    }
    integrated.forEach((id) => {
      if (!mnemosphereById.has(id)) {
        push('warning', 'technospheres', '內嵌清單裡有一顆不存在的職業魔石，已忽略');
      }
    });
  } else if (integrated.length > 0) {
    push('error', 'technospheres',
      '此團沒有使用「內嵌魔晶石」變體，職業魔石應裝在裝備的插槽裡');
  }

  // ── 插槽容量與品級限制 ────────────────────────────────────────
  Object.keys(slots).forEach((slotId) => {
    const slot = slots[slotId];
    const isWeapon = weaponSlots.includes(slotId);
    const usage = computeSlotUsage(slot);

    if (!slotSupportsQuality(slotId) && (slot.quality !== DEFAULT_SLOT_QUALITY || slot.contents.length > 0)) {
      push('error', 'technospheres',
        `只有自訂武器與自訂防具可以有魔石插槽（${slotId} 這個裝備位不行，科技奇幻手冊 p.133）`);
    }
    if (slot.quality === 'delta' && !isWeapon) {
      push('error', 'technospheres', `槽位 δ 只能用在武器上（${slotId} 不是武器）`);
    }
    if (slot.quality === 'delta' && !allowsDelta) {
      push('error', 'technospheres',
        '此團的魔晶石變體沒有槽位 δ（僅附魔魔石變體，科技奇幻手冊 p.138）');
    }
    if (usage.overflow) {
      push('error', 'technospheres',
        `槽位 ${getSlotQuality(slot.quality).symbol} 只有 ${usage.capacity} 個插槽，`
        + `目前已佔用 ${usage.used} 個`);
    }
    if (usage.mnemosphereOverflow) {
      push('error', 'technospheres',
        `槽位 ${getSlotQuality(slot.quality).symbol} 至多 ${usage.mnemosphereCap} 顆職業魔石`
        + `（目前 ${usage.mnemosphereCount} 顆）`);
    }
    if (isIntegrated && usage.mnemosphereCount > 0) {
      push('error', 'technospheres',
        '使用「內嵌魔晶石」變體時，裝備插槽只能用來裝附魔魔石（科技奇幻手冊 p.138）');
    }

    // 附魔魔石的武器限制
    if (!hasHoplospheres && usage.hoplosphereCounts && Object.keys(usage.hoplosphereCounts).length > 0) {
      push('error', 'technospheres', '此團的魔晶石規則沒有附魔魔石，請移除已安裝的附魔魔石');
    }
    Object.keys(usage.hoplosphereCounts || {}).forEach((key) => {
      const hop = getHoplosphere(key);
      if (hop.weaponOnly && !isWeapon) {
        push('error', 'technospheres',
          `【${hop.name}】只能安裝在武器上（${slotId} 不是武器）`);
      }
    });

    // 同一把武器不能混不同傷害屬性（p.141）
    if (isWeapon) {
      const { damageTypeConflicts } = listHoplosphereEffects(slot.contents);
      if (damageTypeConflicts.length > 1) {
        push('error', 'technospheres',
          `同一把武器不能混用不同傷害屬性的附魔魔石（目前混了：${damageTypeConflicts.join('、')}）`);
      }
    }
  });

  // ── 引用完整性與重複裝備 ──────────────────────────────────────
  const seen = new Map();
  Object.keys(slots).forEach((slotId) => {
    slots[slotId].contents.forEach((entry) => {
      if (entry.kind === 'hoplosphere' && !getHoplosphere(entry.ref)) {
        push('warning', 'technospheres', `插槽裡有一顆不存在的附魔魔石（${entry.ref}），已忽略`);
      }
      if (entry.kind === 'mnemosphere') {
        if (!mnemosphereById.has(entry.ref)) {
          push('warning', 'technospheres', '插槽裡有一顆不存在的職業魔石，已忽略');
          return;
        }
        if (seen.has(entry.ref)) {
          push('error', 'technospheres',
            `同一顆職業魔石不能同時裝在兩個地方（${seen.get(entry.ref)} 與 ${slotId}）`);
        } else {
          seen.set(entry.ref, slotId);
        }
      }
    });
  });

  // ── 未裝備的職業魔石（不擋，只提示）──────────────────────────
  if (hasMnemospheres) {
    const active = new Set(getActiveMnemospheres(normalized, { equippedSlots }).map((m) => m.id));
    const idle = mnemospheres.filter((m) => !active.has(m.id));
    if (idle.length > 0 && equippedSlots && equippedSlots.length > 0) {
      push('warning', 'technospheres',
        `有 ${idle.length} 顆職業魔石沒有裝在任何裝備上，因此不提供技能`
        + `（${idle.map((m) => m.className).join('、')}）`);
    }
  }

  return issues;
};

/**
 * 只有**附魔魔石與插槽品級**要花起始裝備預算（z）。
 *
 * 為什麼職業魔石不算：原書 p.134 的創角變更明說「gain one free level 1 mnemosphere」，
 * 而 p.140 的〈High Level Characters〉在列「起始資金可以買什麼」時也只列了
 * custom weapons、armor、accessories、**hoplospheres（500z each）**——沒有職業魔石。
 * 職業魔石是**獎勵**（p.137：冒險中會自己冒出來），不是商店貨。
 * 若把 `getTechnosphereSpending`（含職業魔石估值）直接接進預算，
 * 一顆 5 級魔石就會吃掉 2000z，玩家的裝備預算當場蒸發。
 *
 * @param {object} state
 * @param {Object<string,string>} [slotQualities] 槽位 → 品級（未提供則讀 state.slots）
 */
export const getTechnosphereEquipmentSpend = (state, slotQualities = null) => {
  const normalized = normalizeTechnosphereState(state);
  let total = 0;

  Object.keys(normalized.slots).forEach((slotId) => {
    const slot = normalized.slots[slotId];
    slot.contents.forEach((entry) => {
      if (entry.kind === 'hoplosphere') total += HOPLOSPHERE_PRICE;
    });
    const quality = slotQualities ? slotQualities[slotId] : slot.quality;
    total += slotQualityCost(quality);
  });

  return total;
};

/**
 * 裝備花在魔晶石上的總金額（z）。
 * 原書 p.137：每顆魔晶石約 500z，職業魔石每個等級再 +300z；
 * 插槽品級的額外成本另計（p.133 的表）。
 *
 * ※ 這是**估值**（「這顆東西值多少錢」），不是「玩家花了多少起始預算」。
 *   起始預算請用 `getTechnosphereEquipmentSpend`。
 *
 * @param {object} state
 * @param {Object<string,string>} [slotQualities] 槽位 → 品級（未提供則讀 state.slots）
 */
export const getTechnosphereSpending = (state, slotQualities = null) => {
  const normalized = normalizeTechnosphereState(state);
  let total = 0;

  // 職業魔石：500 + 300 × 等級
  normalized.mnemospheres.forEach((m) => { total += mnemospherePrice(m.level); });

  // 附魔魔石：每顆 500
  Object.keys(normalized.slots).forEach((slotId) => {
    const slot = normalized.slots[slotId];
    slot.contents.forEach((entry) => {
      if (entry.kind === 'hoplosphere') total += HOPLOSPHERE_PRICE;
    });
  });

  // 插槽品級
  Object.keys(normalized.slots).forEach((slotId) => {
    const quality = slotQualities ? slotQualities[slotId] : normalized.slots[slotId].quality;
    total += slotQualityCost(quality);
  });

  return total;
};
