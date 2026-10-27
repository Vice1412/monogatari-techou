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
 * ※ 這份物件**只放真的有東西在讀的欄位**——沒有讀取端的設定欄位就是幻覺欄位
 * （見 `docs/decisions.md` §U15 的教訓）。所以每一個欄位在加進來的那一輪就必須
 * 有讀取端：`allowCustomWeapon` 讀在裝備與定制武器鍛造、`initiativeVariant` 讀在
 * `data/initiativeVariant.js`、`zeroPowers` 讀在 `utils/zeroPower.js` 與第 5 步區塊。
 *
 * ※ **`attributeTotal` 已於 2026-10-06 移除**（見 `docs/decisions.md` §AM）。
 * 使用者指出「骰子大小就那幾個」，而原書 p.162 確實是**三組固定陣列**（d8×4／
 * d10,d8,d8,d6／d10,d10,d6,d6），不是「總和 32」。真正的變數是**等級獎勵**
 * （p.229：20 級與 40 級各可把一顆**基礎**骰 +1 階，上限 d12），
 * 由 `attributeDieUpgradesAllowed` 處理，不是一條 GM 規則。
 */
import { SOURCEBOOKS } from './sourcebookConfig';
import {
  DEFAULT_TECHNOSPHERE_MODE,
  INNATE_CLASS_COUNT,
  TECHNOSPHERE_MODES,
  isTechnosphereEnabled,
  modeRestrictsEquipment,
  normalizeTechnosphereMode
} from './technospheres';

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
  'initiativeVariant',
  'zeroPowers',
  'campActivities',
  'technospheres'
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
   *
   * ※ **魔晶石開啟時這一格是派生值**：`resolveCreationRules` 會強制回 `true`
   *   （p.133 的裝備白名單只剩定制武器／防具／飾品／機師模組，官方武器表整份不存在）。
   *   那是規則後果，不是 GM 的選擇——面板上會鎖住並註明。詳見 `docs/decisions.md` §BW。
   *   ※ 同一條規則還改寫了修補匠的魔導科技（魔加農刪除、魔法球降為進階），見 §BX。
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
  initiativeVariant: false,
  /**
   * 選用規則：底力技（ZERO POWERS，高度奇幻手冊 p.124–131）。
   *
   * 原書明言「這條規則會讓故事的主角們強得過分，請先與整團討論過再決定是否使用」，
   * 所以它是**整團一層**的開關（與 `initiativeVariant` 同一個位置），不是每個角色
   * 各自勾的選項。開啟後：建角第 5 步出現底力技區塊、角色身上多一個 `zeroPower`
   * 欄位、跑團面板的命刻分頁出現底力命刻。
   *
   * ※ 舊註解曾寫「原書特典的底力技」——**那是錯的**。它只出現在高度奇幻手冊，
   *   自然奇幻與科技奇幻全文掃描 `ZERO POWER` 皆 0 命中（見 `docs/zero-powers-hf.md` §0）。
   */
  zeroPowers: false,
  /**
   * 選用規則：營地活動（CAMP ACTIVITIES，自然奇幻手冊 p.130–133）。
   *
   * 原書 p.130：「If you use this optional rule, each Player Character gains access to
   * two different Camp Activities, **chosen during character creation**」——它動到的正是
   * 開卡流程：第 5 步多一個必選欄位（15 選 2），跑團時每次休息場景可以用掉其中一種。
   *
   * 開啟後：建角第 5 步出現營地活動區塊、角色身上多一個 `campActivities` 欄位
   * （`{ picked, used }`）、跑團面板的休息區塊可以標記「本次休息已使用」。
   *
   * ※ 金手指【老大哥／歐尼醬】另外允許「團隊沒開這條規則時仍然使用，且可選 3 種」——
   *   判定集中在 `data/campActivities.js` 的 `campActivityAccess`，不是這裡的開關。
   *
   * 預設 false：官方核心規則沒有營地活動（它是自然奇幻手冊的選用規則）。
   */
  campActivities: false,
  /**
   * 選用規則：魔晶石（TECHNOSPHERES，科技奇幻手冊 p.132–145）。
   *
   * 這一格是**字串**不是布林，因為原書除了完整規則之外還給了三個
   * 「只採用一部分」的變體，而三個變體拿走的东西各不相同：
   *   - `full`              完整規則（p.134–137）
   *   - `integrated`        職業魔石改裝在裝置上，不能有 δ、插槽只放附魔魔石（p.138）
   *   - `mnemospheresOnly`  裝備回到核心規則、沒有附魔魔石、**不給**武器熟練（p.138）
   *   - `hoplospheresOnly`  沒有職業魔石與 δ、**不給** +5 HP/MP（p.138）
   * 用一個 `true` 表達不了這三種取捨，所以用五態枚舉（含 `off`）。
   *
   * 開啟後會**拿走**東西而不只是加上去：官方武器表與盾牌整份不可用、
   * 守護者【雙重盾牌】作廢、修補匠的魔導球與魔法加農炮改寫、
   * 職業數強制為**恰好三個**且此後不得新增職業。
   * 判定集中在 `data/technospheres.js`。
   *
   * 預設 `'off'`：官方核心規則沒有魔晶石。
   */
  technospheres: DEFAULT_TECHNOSPHERE_MODE
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

  // ── 魔晶石（科技奇幻手冊 p.134）────────────────────────────────
  //
  // 「must distribute those levels among **exactly three** Classes」——
  // 所以開啟後職業數是**派生值**，不是 GM 可調的規則欄位：
  // 面板上的上下限會一併被鎖成 3，`diffCreationRules` 也不會把它們寫進 diff。
  // 這樣做是因為 2 個職業的魔晶石角色在原書裡不存在，容許 GM 調成 2 等於
  // 讓一條規則互相矛盾。
  const technospheres = normalizeTechnosphereMode(
    given.technospheres === undefined ? d.technospheres : given.technospheres
  );
  if (isTechnosphereEnabled(technospheres)) {
    classCountMin = INNATE_CLASS_COUNT;
    classCountMax = INNATE_CLASS_COUNT;
  }

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

  // ── 定制武器是魔晶石的**規則後果**，不是可選項（p.133）──────────────
  //
  // 原書：「The only types of equipment available in the game are the following:
  // custom weapons (page 112), armor, and accessories, plus weapon and armor
  // modules for the Pilot Class」——下一句接著說「Any other equipment simply
  // cannot exist」。所以開了魔晶石就**沒有官方武器表**：不定制武器等於沒有武器。
  //
  // 這裡用**派生**，而不是「開啟魔晶石時把使用者那一格寫成 true」：
  // 寫進去的話，之後關掉魔晶石它還是 true——玩家當初沒選過的東西會留在他身上。
  // 派生沒有這個問題，關掉就自動回到他原本的選擇。
  // （與上面 `classCountMin/Max` 被鎖成 3 是同一個做法。）
  //
  // 例外是「僅職業魔石」變體：p.138 明寫「equipment simply follows the standard
  // rules in the Core Rulebook… all types of equipment are once again available」，
  // 官方裝備整份回來，所以那一態**不**強制。判定集中在 `modeRestrictsEquipment`。
  const allowCustomWeapon = modeRestrictsEquipment(technospheres)
    ? true
    : (typeof given.allowCustomWeapon === 'boolean'
      ? given.allowCustomWeapon
      : d.allowCustomWeapon);
  const startingHeroicSkill = typeof given.startingHeroicSkill === 'boolean'
    ? given.startingHeroicSkill
    : d.startingHeroicSkill;
  const initiativeVariant = typeof given.initiativeVariant === 'boolean'
    ? given.initiativeVariant
    : d.initiativeVariant;
  const zeroPowers = typeof given.zeroPowers === 'boolean' ? given.zeroPowers : d.zeroPowers;
  const campActivities = typeof given.campActivities === 'boolean'
    ? given.campActivities
    : d.campActivities;

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
    initiativeVariant,
    zeroPowers,
    campActivities,
    technospheres
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

/**
 * 「幾個職業」的區間寫法——**單一來源**。
 *
 * 為什麼需要它（F-012，2026-10-27）：這句話原本**四個地方各寫一次**
 * （驗證訊息、角色卡、編輯器第 2 步的「目前已選擇 N 個職業」、以及同一步的說明句），
 * 每處都是 `${min}~${max}`。魔晶石制把上下限一起鎖成 3 之後，四處同時變成「3~3」——
 * 當時只修了前兩處，後兩處**留在畫面上**，直到 P14 的實機截圖才被看見。
 *
 * 判準：**上下限相等時不要印區間**。「3~3 個職業」不是數字錯，是廢話，
 * 而且會讓人以為自己看錯了。
 *
 * @param {object} rules creationRules（會先過 resolveCreationRules）
 * @returns {string} `'2~3'` 或 `'3'`
 */
export const classCountRange = (rules) => {
  const r = resolveCreationRules(rules);
  return r.classCountMin === r.classCountMax
    ? String(r.classCountMin)
    : `${r.classCountMin}~${r.classCountMax}`;
};

/**
 * 同上的「強調版」：上下限相等時前面加「恰好」，用來強調那不是「最多」。
 * @param {object} rules creationRules
 * @returns {string} `'2~3'` 或 `'恰好 3'`
 */
export const classCountPhrase = (rules) => {
  const r = resolveCreationRules(rules);
  const range = classCountRange(r);
  return r.classCountMin === r.classCountMax ? `恰好 ${range}` : range;
};

/**
 * 名冊卡上的「這張卡是哪個規則開的」徽章（F-015，2026-10-27）。
 *
 * 為什麼需要：20 張卡並存時，四張卡四組規則，外觀**完全一致**——
 * P1 實測把卡名從全文剔除後，搜「魔晶石／底力／營地活動／自訂規則」一個都沒中。
 * 要分辨只能一張一張點進去，而「每次開團情況都不一樣」正是這個專案的核心用法。
 *
 * 三條設計約束：
 * ① **只列與官方核心規則不同的項目**。徽章是「差異」，不是「清單」；
 *    完整清單仍在角色卡展開後的「此團開卡規則」。
 * ② 沒有差異時回**一顆「官方標準」**——「什麼都沒有」和「還沒載入」在畫面上長得一樣。
 * ③ 魔晶石開啟時 `allowCustomWeapon` 與職業數都是**派生值**（p.133 的裝備後果），
 *    不是 GM 的選擇，所以只在魔晶石關閉時才單獨列它們。
 *
 * @param {object} rules 角色身上的 `creationRules`
 * @returns {Array<{key:string, label:string}>} 依「影響上桌程度」排序，至少一筆
 */
export const describeRuleBadges = (rules) => {
  const r = resolveCreationRules(rules);
  const techMode = normalizeTechnosphereMode(r.technospheres);
  const techOn = isTechnosphereEnabled(techMode);
  const badges = [];

  if (techOn) {
    const def = TECHNOSPHERE_MODES[techMode];
    badges.push({ key: 'technospheres', label: `魔晶石・${def?.label || techMode}` });
  }
  if (r.zeroPowers) badges.push({ key: 'zeroPowers', label: '底力技' });
  if (r.campActivities) badges.push({ key: 'campActivities', label: '營地活動' });
  if (r.allowQuirk) badges.push({ key: 'allowQuirk', label: '金手指' });
  if (r.allowPlaytest) badges.push({ key: 'allowPlaytest', label: '公測修訂' });
  if (r.initiativeVariant) badges.push({ key: 'initiativeVariant', label: '先攻變體' });
  if (r.startingHeroicSkill) badges.push({ key: 'startingHeroicSkill', label: '開局英雄技能' });
  if (Number(r.startingLevel) !== DEFAULT_CREATION_RULES.startingLevel) {
    badges.push({ key: 'startingLevel', label: `起始 ${r.startingLevel} 級` });
  }
  if (!techOn && r.allowCustomWeapon) {
    badges.push({ key: 'allowCustomWeapon', label: '定制武器' });
  }
  if (!techOn && (r.classCountMin !== DEFAULT_CREATION_RULES.classCountMin
    || r.classCountMax !== DEFAULT_CREATION_RULES.classCountMax)) {
    badges.push({ key: 'classCount', label: `職業 ${classCountRange(r)}` });
  }

  if (badges.length === 0) return [{ key: 'standard', label: '官方標準' }];
  return badges;
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
  // 魔晶石開啟時，職業數是**派生值**（固定 3），不是 GM 設定的東西。
  // 若把它寫進 diff，分享出去再餵回 `resolveCreationRules` 就會留下一筆
  // 「玩家以為是自己調的 3」——而且日後關掉魔晶石時它會殘留成 3，
  // 於是角色變成「官方標準規則但強制三個職業」。所以這裡剔除。
  const derived = isTechnosphereEnabled(r.technospheres)
    ? ['classCountMin', 'classCountMax']
    : [];
  // 定制武器同理，但只有「因為魔晶石而被強制」時才算派生。
  // 若把它寫進 diff，分享出去再餵回 `resolveCreationRules`，對方就變成
  // 「沒開魔晶石卻莫名開了定制武器」——正是 §U15 講的幻覺欄位。
  // ※ 只剔除 `modeRestrictsEquipment` 那三態；「僅職業魔石」不強制，GM 自己勾的照留。
  if (modeRestrictsEquipment(r.technospheres)) derived.push('allowCustomWeapon');
  const out = {};
  CREATION_RULE_FIELDS.forEach((key) => {
    if (derived.includes(key)) return;
    const a = r[key];
    const b = DEFAULT_CREATION_RULES[key];
    const same = Array.isArray(b) ? JSON.stringify(a) === JSON.stringify([...b]) : a === b;
    if (!same) out[key] = a;
  });
  return out;
};
