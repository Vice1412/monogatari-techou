/**
 * 開卡規則 (Creation Rules)
 *
 * 為什麼要有這份資料：
 * 原書的創角規則原本**硬編碼在六個檔案裡**——
 * 起始 500z 在 `CharacterEditor`、起始等級 5 在 `characterEngine` 與 `CharacterSheet`、
 * 屬性總和 32 在 `characterEngine`、起始 5 級與 2~3 職業在 `ClassPickerModal` 與 `characterEngine`。
 *
 * 硬編碼的後果不只是「不好改」。它讓「GM 自訂開局」看起來像一個很遙遠的新功能——
 * 其實那不是新功能，而是「把這些常數變成一份資料」：
 * 一份 campaign 只要帶上這份 `creationRules`，玩家端的建卡與驗證就會照著那一團的規矩走。
 *
 * 這份資料同時是「創角」與「編輯」得以分流的基礎：有了規則物件，
 * 「這張卡還缺什麼、哪裡不合這一團的規矩」才是可以計算的，而不是散在各處的 if。
 *
 * 欄位來源（官方英文核心規則書 v1.1，印刷頁碼）：
 * - 起始等級 5 → p.157（Create Your Character 步驟 1）
 * - 起始四維總和 32 → p.155–156（屬性骰階配置）
 * - 起始 2~3 個職業 → p.158（起始 5 級需分配於 2~3 個職業）
 * - 起始裝備預算 500z → p.164（Purchase Starting Equipment）
 * - 高階角色的起始預算每級 +50z → p.229（Creating High Level Characters）
 *   `2000 = 500 + 50 × 30`，由 `ZENIT_PER_LEVEL` 套用在起始等級高於 5 的預設值上
 *
 * ※ 這份物件**只放真的有東西在讀的欄位**。原書特典的底力技（Zero Power）、
 * 自訂武器（Custom Weapon）等子系統本專案尚未收錄，因此不預先開旗標——
 * 沒有讀取端的設定欄位就是幻覺欄位（見 `docs/decisions.md` §U15 的教訓）。
 *
 * ※ **`attributeTotal` 已於 2026-10-06 移除**（見 `docs/decisions.md` §AM）。
 * 使用者指出「骰子大小就那幾個」，而原書 p.162 確實是**三組固定陣列**（d8×4／
 * d10,d8,d8,d6／d10,d10,d6,d6），不是「總和 32」。真正的變數是**等級獎勵**
 * （p.229：20 級與 40 級各可把一顆**基礎**骰 +1 階，上限 d12），
 * 由 `attributeDieUpgradesAllowed` 處理，不是一條 GM 規則。
 */
import { SOURCEBOOKS } from './sourcebookConfig';

/** 全部合法的開卡規則欄位（測試以此為欄位集護欄） */
export const CREATION_RULE_FIELDS = Object.freeze([
  'startingLevel',
  'startingZenit',
  'classCountMin',
  'classCountMax',
  'skillPointBudget',
  'allowedSourcebooks',
  'defaultSourcebooks',
  'requiredClasses',
  'allowQuirk',
  'allowCustomWeapon',
  'startingHeroicSkill',
  'allowPlaytest',
  'initiativeVariant'
]);

/** 全部手冊的鍵（合法值域） */
const ALL_SOURCEBOOK_KEYS = Object.freeze(Object.keys(SOURCEBOOKS));

/**
 * 公測修訂的來源鍵。
 *
 * **它仍然是一個合法的 sourcebook 鍵**（角色身上 `enabledSourcebooks` 用它決定
 * 秘儀師【變體】能不能選），但**不是 GM 在「開放的手冊」裡勾的東西**——
 * 使用者裁定（2026-10-19）：公測是一個像金手指／定制武器那樣的**選用規則開關**，
 * 不是一本「手冊」。所以它由 `allowPlaytest` 單獨控制進出
 * `allowedSourcebooks` / `defaultSourcebooks`，兩個清單不再手動勾它。
 */
export const PLAYTEST_SOURCEBOOK_KEY = 'playtest';

/** 手冊類來源（不含公測修訂）——這是「開放的手冊」勾選清單與預設上限的範圍。 */
const BASE_SOURCEBOOK_KEYS = Object.freeze(
  ALL_SOURCEBOOK_KEYS.filter((key) => key !== PLAYTEST_SOURCEBOOK_KEY)
);

/**
 * 高階角色的每級起始預算加給（原書 p.229）。
 *
 * 原書：「每級增加 50Z……例如一個 30 級的角色起始預算是 2000Z」——
 * `2000 = 500 + 50 × 30`。所以起始等級高於 5 時，**預設值**自動變成
 * `500 + 50 × 起始等級`；GM 想用別的數字就直接指定 `startingZenit`（明確值優先）。
 *
 * 不做成獨立的規則欄位是刻意的：那會讓 `startingZenit` 變成「基礎值」而實際生效的是
 * 另一個名字，於是 `diffCreationRules` 的輸出再餵回 `resolveCreationRules` 就不等值
 * （分享出去的規則會愈套愈多錢）。這裡只有一個欄位、一個真相。
 */
export const ZENIT_PER_LEVEL = 50;

// 金手指的來源過濾（`filterQuirksBySources`／`getQuirkSource`）**已移除**（2026-10-06）。
//
// 原本的做法是從名稱裡的「（高奇）（自奇）（科奇）」標記反推來源，但那只涵蓋 55 筆中的 17 筆，
// 而且標記本身是**顯示字串**——直接違反規則三（禁止括號附註）。名稱已清理乾淨。
//
// 使用者裁定：「檢查一下三大擴展的金手指是否有重複，如果沒有就把金手指的出處也列出來；
// 有的話就不列。」實測**有重複**（FLIGHT 與 CURSED 同時收錄於高度奇幻與自然奇幻手冊，
// ROBOT 同時收錄於高度奇幻與科技奇幻手冊），所以介面不列出處。
//
// ※ 若日後要恢復「依手冊過濾金手指」，正確做法是**補一個 `source` 欄位**，
// 而不是回到名稱標記。抽取工具已經備好：`scratch/extract_en_quirks.py`
// （HF 15 筆／NF 10 筆／TF 10 筆，另加特典合輯的 Halloween 系列）。

const ALL_CLASS_NAMES = Object.freeze([
  ...new Set(
    Object.keys(SOURCEBOOKS).flatMap((key) => SOURCEBOOKS[key].classes || [])
  )
]);

/** 官方標準開卡規則（核心規則書） */
export const DEFAULT_CREATION_RULES = Object.freeze({
  /** 起始角色等級 */
  startingLevel: 5,
  /** 起始裝備預算（zenit）。這是 5 級角色的官方值（p.164）。 */
  startingZenit: 500,
  /** 起始必須修習的職業數下限 */
  classCountMin: 2,
  /** 起始必須修習的職業數上限 */
  classCountMax: 3,
  /** 起始可分配的技能等級總數（原書：每級 1 點，故等於起始等級） */
  skillPointBudget: 5,
  /**
   * 此團開放的拓展**上限**。預設為全部手冊——因為在「沒有 campaign」的情況下
   * 玩家就是自己的 GM，不該被擋；GM 自訂開局時把這裡收窄，才成為真正的上限。
   *
   * ※ **不含公測修訂**：公測由 `allowPlaytest` 單獨開關（見 `PLAYTEST_SOURCEBOOK_KEY`）。
   *   這裡若含 playtest，`isDefaultCreationRules()` 會永遠判定「非官方標準」——
   *   因為官方核心規則本來就沒有公測內容。
   */
  allowedSourcebooks: Object.freeze([...BASE_SOURCEBOOK_KEYS]),
  /**
   * 新角色預設勾選哪些拓展。
   *
   * 2026-10-06 改成**全部**（使用者裁定）：「默認不要只有核心，而是全部，不然要切換來切換去很麻煩。」
   * 這一格只決定「選單一開始顯示什麼」——**真正的上限是 `allowedSourcebooks`**，
   * 所以 GM 收窄手冊時照樣擋得住（`validateCharacter` 的「啟用了未開放的拓展」是 error）。
   *
   * ※ 同樣**不含公測修訂**：`allowPlaytest` 開啟時會自動把 playtest 補進這兩個清單。
   */
  defaultSourcebooks: Object.freeze([...BASE_SOURCEBOOK_KEYS]),
  /** GM 指定必須修習的職業（空陣列＝不指定） */
  requiredClasses: Object.freeze([]),
  /** 是否允許金手指 */
  // 官方預設**沒有**金手指——三大奇幻手冊才推出這個制度，所以不開就是「照官方核心規則開卡」。
  // 要玩金手指的團由 GM 在「此團開卡規則」自己打開。
  allowQuirk: false,
  /**
   * 是否開放【定制武器】（高度奇幻手冊 p.106 的選用規則）。
   *
   * 官方預設**沒有**——那是手冊的選用規則。原書說它「簡單、沒有深遠的遊戲影響，
   * 可以永遠開給任何有興趣的人」，所以它**不綁高度奇幻手冊**：任何團都能單獨打開。
   */
  allowCustomWeapon: false,
  /**
   * 選用規則：開局就給一個英雄技能（Playtest Materials 2026-10-01, p.4）。
   *
   * 官方原文（OPTIONAL: HEROIC SKILL AT CHARACTER CREATION）：
   * 「If you use this optional rule, each Player Character gains an additional Heroic
   *   Skill during character creation; however, the first time they would normally gain
   *   a Heroic Skill by mastering one of their Classes, instead they gain no Heroic
   *   Skill from that.」
   *
   * 三個附帶條件（實作時逐條落實，見 `checkHeroicSkillRequirement` 的 `atCreation`）：
   * ① 需要特定職業才能學的英雄技能 → 開局只要**擁有**那個職業其中之一即可，
   *    不要求精通（開局不可能有 10 級職業）；其他前提（等級、已習得特定技能／咒語）不變。
   * ② 同一團**不得有兩個角色用這個名額拿到同一個英雄技能**。
   * ③ 下列核心英雄技能**不能**用這個名額取得：Deep Pockets／Extra HP／Extra IP／
   *    Extra MP／Powerful Shot／Powerful Spell／Powerful Strike／Revelation。
   *
   * 預設 false：這是「給想把角色從一級就做得很複雜的老手團」的選用規則，不是核心規則。
   */
  startingHeroicSkill: false,
  /**
   * 選用規則：開放公測修訂內容（Playtest Materials，官方 Patreon 釋出）。
   *
   * 使用者裁定（2026-10-19）：「playtest 公測的內容也是一個 tickbox，像那些開局的設定同理。
   * 名為【開放公測修訂內容】」——所以它是**規則開關**，不是「開放的手冊」裡的一本手冊。
   *
   * 開啟時：
   * ① 核心書技能的【公測】變體按鈕才會出現（`coreBookVariants.js`）；
   * ② `playtest` 自動進入 `allowedSourcebooks` 與 `defaultSourcebooks`，
   *    秘儀師【變體】才能被選；
   * ③ 關閉時兩份清單都會剝除 `playtest`（既有角色的資料不動，只是上限擋住）。
   *
   * 預設 false：官方核心規則沒有公測內容。
   */
  allowPlaytest: false,
  /**
   * 變體規則：先攻變體（公測材料 2026-10-01 p.34）。
   *
   * 這一格與上面幾格**不是同一種東西**：`allowQuirk`／`allowCustomWeapon` 是「開放某批
   * 選項」，`allowPlaytest` 是「開放某批修訂」，而 `initiativeVariant` 是**把一條既有規則
   * 換掉**——開啟後防具沒有先攻減值、戰鬥束腰外衣換側寫、先攻值整個不存在。
   *
   * 官方原文明言變體規則「必須整團共同採用」，所以它住在 `creationRules`（整團一層），
   * 不是每個角色各自的技能變體。判定與逐條後果見 `data/initiativeVariant.js`。
   *
   * 預設 false：核心規則的先攻值照算（`tests/equipmentRules.test.mjs` L 區段釘住的現況）。
   */
  initiativeVariant: false
});

const toInt = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min || i > max) return fallback;
  return i;
};

const pickSourcebooks = (value, fallback) => {
  const list = Array.isArray(value)
    ? [...new Set(value.filter((key) => ALL_SOURCEBOOK_KEYS.includes(key)))]
    : [];
  return list.length > 0 ? list : [...fallback];
};

/**
 * 把（可能不完整的）開卡規則補齊並校正成一份可用的規則。
 *
 * 這是未來 campaign 的入口：`resolveCreationRules(campaign.rules)`。
 * 校正原則是**寧可退回官方預設，也不要讓壞資料流進引擎**——
 * 一條規則寫錯就讓整張卡算不出數值，比忽略那條規則更糟。
 */
export const resolveCreationRules = (overrides = {}) => {
  const given = overrides && typeof overrides === 'object' ? overrides : {};
  const d = DEFAULT_CREATION_RULES;

  const startingLevel = toInt(given.startingLevel, d.startingLevel, { min: 1, max: 50 });
  // 高階角色（原書 p.229）：預設預算隨起始等級提高；明確給了 `startingZenit` 就以它為準。
  const levelBonus = startingLevel > d.startingLevel ? ZENIT_PER_LEVEL * startingLevel : 0;
  const startingZenit = toInt(given.startingZenit, d.startingZenit + levelBonus, { min: 0 });

  let classCountMin = toInt(given.classCountMin, d.classCountMin, { min: 1, max: 10 });
  let classCountMax = toInt(given.classCountMax, d.classCountMax, { min: 1, max: 10 });
  if (classCountMin > classCountMax) classCountMax = classCountMin;

  // 技能點數預設跟著起始等級走（原書：每級 1 點）
  const skillPointBudget = toInt(given.skillPointBudget, startingLevel, { min: 1, max: 50 });

  const allowPlaytest = given.allowPlaytest === true;

  // 公測不是「手冊勾選」而是規則開關：由 allowPlaytest 決定 playtest 是否進出兩份清單。
  // 先算出手冊類清單（去掉 playtest，避免殘留的舊資料讓它復活），再依開關補回。
  const stripPlaytest = (list) => list.filter((key) => key !== PLAYTEST_SOURCEBOOK_KEY);
  let allowedSourcebooks = stripPlaytest(pickSourcebooks(given.allowedSourcebooks, d.allowedSourcebooks));
  if (allowPlaytest) allowedSourcebooks = [...allowedSourcebooks, PLAYTEST_SOURCEBOOK_KEY];

  // 預設勾選必須落在上限之內，否則就退回核心
  const wanted = stripPlaytest(pickSourcebooks(given.defaultSourcebooks, d.defaultSourcebooks));
  const withinCeiling = wanted.filter((key) => allowedSourcebooks.includes(key));
  let defaultSourcebooks = withinCeiling.length > 0
    ? withinCeiling
    : (allowedSourcebooks.includes('core') ? ['core'] : [allowedSourcebooks[0]]);
  // 公測開啟時，新角色預設就該看得到秘儀師【變體】（否則等於白開）
  if (allowPlaytest && !defaultSourcebooks.includes(PLAYTEST_SOURCEBOOK_KEY)) {
    defaultSourcebooks = [...defaultSourcebooks, PLAYTEST_SOURCEBOOK_KEY];
  }

  const requiredClasses = Array.isArray(given.requiredClasses)
    ? [...new Set(given.requiredClasses.filter((name) => ALL_CLASS_NAMES.includes(name)))]
    : [...d.requiredClasses];

  const allowQuirk = typeof given.allowQuirk === 'boolean' ? given.allowQuirk : d.allowQuirk;
  const allowCustomWeapon = typeof given.allowCustomWeapon === 'boolean'
    ? given.allowCustomWeapon
    : d.allowCustomWeapon;
  const startingHeroicSkill = typeof given.startingHeroicSkill === 'boolean'
    ? given.startingHeroicSkill
    : d.startingHeroicSkill;
  const initiativeVariant = typeof given.initiativeVariant === 'boolean'
    ? given.initiativeVariant
    : d.initiativeVariant;

  return {
    startingLevel,
    startingZenit,
    classCountMin,
    classCountMax,
    skillPointBudget,
    allowedSourcebooks,
    defaultSourcebooks,
    requiredClasses,
    allowQuirk,
    allowCustomWeapon,
    startingHeroicSkill,
    allowPlaytest,
    initiativeVariant
  };
};

/**
 * 這張卡是否開放公測修訂內容（**單一判定入口**）。
 *
 * 權威來源是 `character.creationRules.allowPlaytest`。
 * **舊角色遷移**：這個欄位是 2026-10-19 才加的，在那之前「公測」是靠
 * `enabledSourcebooks` 裡有沒有 `playtest` 決定的。所以欄位**從未被設定過**時
 * 退回看舊資料——**不覆寫、不刪舊值**（與 localStorage 遷移鐵律同一個原則）。
 * 一旦 GM 在面板上勾過或取消過（值變成 true/false），就以那個值為準。
 *
 * @param {{creationRules?: object, enabledSourcebooks?: string[]}} character
 * @returns {boolean}
 */
export const isPlaytestAllowed = (character) => {
  const raw = character && typeof character === 'object' ? character.creationRules : null;
  if (raw && typeof raw.allowPlaytest === 'boolean') return raw.allowPlaytest;
  const books = character && Array.isArray(character.enabledSourcebooks)
    ? character.enabledSourcebooks
    : [];
  return books.includes(PLAYTEST_SOURCEBOOK_KEY);
};

/** 這份規則是否等於官方標準（UI 用來決定要不要顯示「此團自訂規則」提示） */
export const isDefaultCreationRules = (rules) => {
  const r = resolveCreationRules(rules);
  return CREATION_RULE_FIELDS.every((key) => {
    const a = r[key];
    const b = DEFAULT_CREATION_RULES[key];
    return Array.isArray(b) ? JSON.stringify(a) === JSON.stringify([...b]) : a === b;
  });
};

/** 供 GM 端分享用的精簡序列化（只帶與官方預設不同的欄位） */
export const diffCreationRules = (rules) => {
  const r = resolveCreationRules(rules);
  const out = {};
  CREATION_RULE_FIELDS.forEach((key) => {
    const a = r[key];
    const b = DEFAULT_CREATION_RULES[key];
    const same = Array.isArray(b) ? JSON.stringify(a) === JSON.stringify([...b]) : a === b;
    if (!same) out[key] = a;
  });
  return out;
};
