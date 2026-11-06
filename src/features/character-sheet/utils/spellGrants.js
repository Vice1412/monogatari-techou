/**
 * 咒語與儀式的「取得資格」判定（純函式，零 React、零副作用）。
 *
 * ## 為什麼要有這個檔案
 *
 * 跑團面板的「咒語與儀式」分頁原本對**任何**角色都給兩顆按鈕：
 * 「從規則庫選擇習得咒語」與「扣除 X MP 並擲儀式檢定」。在《FU》裡這兩件事
 * 都不是自由選購的，官方依據分成兩條：
 *
 * ── 咒語（核心手冊 188~210 頁，核心職業法術書）──
 *   1. 【元素魔法】／【熵系魔法】／【靈魂魔法】——每次獲得該技能，學**一個**同清單咒語。
 *      所以額度等於該技能的 SL。
 *   2. 【咒語模仿】（嵌合師）——上限【SL＋2】，而且只能記錄「親眼見過野獸／魔獸／
 *      植物物種施展」的咒語。它的來源是衝突現場，不是規則庫。
 *   3. 英雄技能【額外咒語】——再添 2 個，且必須來自同一份清單。
 *   4. 英雄技能**點名**的終極咒語（彗星／火山／希望／瘴氣）——直接學會那一個咒語。
 *   5. 金手指：離鄉的妖精、倖存者②、墮落天使② 給「學一個咒語」；草木成精、
 *      會說話的野獸、束縛你的約定給的是**NPC 咒語**（核心 p.310~311，需自訂）。
 *   除此之外，角色不會憑空習得咒語。非施法者就是沒有，這不是資料沒填。
 *
 * ── 儀式（核心手冊 118~121 頁）──
 *   施展儀式需要對應學派的職業技能（秘儀／嵌合／元素／熵系／靈魂學派儀式），
 *   或職業／英雄技能／金手指賦予的【儀式學派】權限（元素師、熵師、靈師、嵌合師、
 *   幻影、塞壬之歌、青翠之勢、領航員、元素之魂、通智幽魂、世界的神諭、巫術後裔……）。
 *   沒有的人**只能在同伴施展時參與團隊檢定協助**——那是一個協助動作，
 *   不是自己扣 MP 擲施法檢定。所以「無權者按鈕」不只是文案不準，是規則錯誤。
 *
 * ## 2026-11-03：三個實測缺陷的修法（全部**資料驅動**）
 *
 * 前一位稽核員實測到三件事，共同點是「來源只認職業技能與【額外咒語】」：
 *   ① 本檔完全不讀 `character.quirk` → 金手指給的咒語額度／儀式權對非施法者失效
 *      （面板顯示 0/0，學不了）。
 *   ② 四條職業技能（幻影／塞壬之歌／青翠之勢／領航員）給的儀式學科不在對照表裡。
 *   ③ 四條英雄技能點名的咒語本體不在 `rulesData.spells`（彗星／火山／希望／瘴氣）——
 *      學不到也放不出。
 *
 * 修法一律走「新增一張表」而不是在各處寫 `if (quirkName === …)`：判定邏輯只有一份，
 * 下一條金手指／技能要給額度時改的是資料，不是程式。程式裡沒有任何一個金手指名字。
 *
 * ## 契約
 *
 * `describeSpellGrants(character, resolvedSpells, opts)` 回傳「這個角色能學幾個、
 * 哪些學派、還剩幾個」；`describeRitualRights(character, opts)` 回傳「能不能獨自
 * 施展儀式、哪些學派」。UI 只負責照著畫，不自己判斷規則。
 *
 * `resolvedSpells` 由呼叫端傳入（`resolveCharacterSpells(character)` 的結果）。
 * 這樣本檔不必依賴 `characterEngine`，避免循環匯入。
 *
 * `opts` 是**測試注入點**（生產端永不傳入，不傳時行為逐字不變）：讓測試能把來源表
 * 換成空表，證明紅燈真的來自這些表、而不是「剛好全綠」。
 */
import rulesData from '../data/rulesData.json';
import { normalizeHeroicSkillName, normalizeSkillName } from '../data/sourcebookConfig';

/**
 * 會授予「核心咒語清單」額度的職業技能。
 *
 * `school` 對應 `rulesData.spells[].school` 的三個值（元素／熵系／靈魂）——
 * 那是本地規則庫實際收錄的三份清單。`perSl` 是每次獲得該技能給的咒語數。
 */
export const SPELL_GRANT_SOURCES = Object.freeze([
  { skill: '元素魔法', label: '元素魔法', school: '元素', perSl: 1 },
  { skill: '熵系魔法', label: '熵系魔法', school: '熵系', perSl: 1 },
  { skill: '靈魂魔法', label: '靈魂魔法', school: '靈魂', perSl: 1 }
]);

/** 核心三清單的學派名（本地 `rulesData.spells` 只用這三個值）。 */
export const CORE_SPELL_SCHOOLS = Object.freeze(['元素', '熵系', '靈魂']);

/** 嵌合師的咒語模仿：上限 SL＋2，來源是衝突現場而非規則庫。 */
export const CHIMERIST_SKILL = '咒語模仿';
export const CHIMERIST_BASE = 2;
export const CHIMERIST_SCHOOL = '嵌合';

/** 英雄技能【額外咒語】：再添 2 個，必須同一份清單。 */
export const EXTRA_SPELL_SKILL = '額外咒語';
export const EXTRA_SPELL_GRANT = 2;

/**
 * 英雄技能**點名**授予的咒語（官方原文都是「You learn the ultimate X spell: Y」）。
 *
 * 為什麼需要這張表而不是靠 `rulesData.spells` 自己找：這四條技能給的是
 * 「一個指定咒語」，不是「一格可自由挑選的額度」。把它們記成額度會出現兩個問題：
 *   1. 沒有施法職業的角色（例如靠金手指【神秘魔法書】取得英雄技能的人）拿不到任何學派，
 *      於是仍然學不到——「學不到也放不出」的第二個成因。
 *   2. 額度必須有個學派才好挑；點名咒語的學派由咒語本身決定。
 *
 * 所以這裡的做法是：**實體在規則庫裡 → 給 1 格並開放該學派；不在 → 明確回報
 * 「本條授予的咒語尚未建檔」，不給額度、不猜學派**（見 `unfiledGrants`）。
 *
 * 四筆的出處（2026-11-03 逐筆查證，見 `rulesData.spells` 尾端四筆的 `source`）：
 *   - 彗星：核心手冊 英雄技能章 印刷 p.235（Comet，MP50，Target: Special，Instantaneous）
 *   - 火山：核心手冊 英雄技能章 印刷 p.241（Volcano，MP40，Target: Special，Instantaneous）
 *   - 希望：核心手冊 英雄技能章 印刷 p.237（Hope，MP40，Target: Special，Instantaneous）
 *   - 瘴氣：Playtest Materials 2026-10-01 p.15（Miasma，MP20，One creature，Instantaneous）
 */
export const HEROIC_SPELL_SOURCES = Object.freeze([
  { skill: '彗星', spell: '彗星', school: '熵系' },
  { skill: '火山', spell: '火山', school: '元素' },
  { skill: '希望', spell: '希望', school: '靈魂' },
  { skill: '瘴氣', spell: '瘴氣', school: '元素' }
]);

/**
 * 金手指授予的**咒語**額度。
 *
 * `schools` 是「這一格可以拿去挑哪幾份清單」——官方原文寫「在元素師、熵師和靈師的
 * 咒語中學會一個」時就是三個學派共用一格；寫「靈師咒語」時只有靈魂。
 *
 * `optionId`：這一條金手指要有**選到該選項**才算數（`character.quirkChoice`）。
 *   倖存者與墮落天使的「學一個咒語」都是三選一裡的其中一個選項——沒選就不能給，
 *   否則等於白送一格（那會讓「選①拿熟練度」的角色同時也拿到咒語）。
 *
 * `kind: 'npc'`：官方給的是 **NPC 咒語**（核心 p.310~311）＋「請依照你的需求客製
 *   名稱、傷害類型、狀態效果」。這類咒語**本來就不在規則庫裡**，所以不能憑空生一格
 *   給玩家在清單裡挑——改成在 `unfiledGrants` 明確回報（玩家的面板會寫
 *   「額度來源：…；X 尚待建檔」，而不是安靜地顯示 0/0）。
 */
export const QUIRK_SPELL_SOURCES = Object.freeze([
  {
    quirk: '離鄉的妖精',
    label: '離鄉的妖精（元素師／熵師／靈師咒語 1 個）',
    schools: ['元素', '熵系', '靈魂'],
    capacity: 1
  },
  {
    quirk: '倖存者',
    optionId: 'spell',
    label: '倖存者②（元素師／靈師咒語 1 個）',
    schools: ['元素', '靈魂'],
    capacity: 1
  },
  {
    quirk: '墮落天使',
    optionId: 'spell',
    label: '墮落天使②（靈師咒語 1 個）',
    schools: ['靈魂'],
    capacity: 1
  },
  {
    quirk: '草木成精',
    kind: 'npc',
    label: '草木成精（NPC 咒語 1 個）',
    reason: '官方給的是核心 p.310~311 的 NPC 咒語，且要求玩家自訂名稱／傷害類型／狀態效果——規則庫沒有這筆條目'
  },
  {
    quirk: '會說話的野獸',
    optionId: 'npcSpell',
    kind: 'npc',
    label: '會說話的野獸（NPC 咒語 1 個）',
    reason: '同上：核心 p.310~311 的 NPC 咒語，需自訂'
  },
  {
    quirk: '束縛你的約定',
    kind: 'npc',
    label: '束縛你的約定（詛咒之息／生命偷取／心靈偷取 擇一）',
    reason: '官方指定核心 p.310 的三個 NPC 咒語，且要求自訂名稱／傷害類型／狀態效果'
  }
]);

/**
 * 金手指授予的**儀式**權限。
 *
 * 逐條原文（`rulesData.quirks[].desc`，2026-11-03 核對）：
 *   - 元素之魂：「你也可以獲得施展效果屬於元素學派的儀式的能力，但前提是這些儀式
 *     是操控你所選擇的元素。」→ 學派＝元素，**附敘事限制**（`note`）。
 *   - 離鄉的妖精：「你還獲得施展屬於儀式學派的儀式的能力」→ 儀式（Ritualism）。
 *   - 通智幽魂：「你獲得施展儀式學派的儀式的能力」→ 儀式。
 *   - 世界的神諭：「你獲得施展靈魂學派的儀式的能力。」→ 靈魂。
 *   - 巫術後裔：「你獲得施展屬於儀式學派的儀式的能力」→ 儀式。
 *
 * 刻意**不列**的三條（不是漏掉）：
 *   - 遺物使用者：能力②是「當前場景內、裝備該遺物的任何人可施展所選學派儀式，MP 減半」，
 *     屬場景性效果且學派由使用時決定 → 不是角色身上的常駐權限，硬塞進這張表會變成
 *     永久權限（比沒有更錯）。
 *   - 天才的宿敵：選「儀式」領域只換到「花 1 物語點忽略 HP/MP 成本」，沒有授予任何學派。
 *   - 神秘魔法書：授予的是英雄技能選擇權（彗星／額外咒語／希望／火山），
 *     玩家真的取得該英雄技能後由 `HEROIC_SPELL_SOURCES` 接手。
 */
export const QUIRK_RITUAL_SOURCES = Object.freeze([
  { quirk: '元素之魂', name: '元素', formula: 'INS + WLP', note: '僅限操控你所選擇的元素的儀式（敘事限制，GM 裁定）' },
  { quirk: '離鄉的妖精', name: '儀式', formula: 'INS + WLP', note: '可用於運送生物進出妖精王國' },
  { quirk: '通智幽魂', name: '儀式', formula: 'INS + WLP', note: '可用於運送生物進出靈魂網絡、在網絡內獲取資訊與追蹤' },
  { quirk: '世界的神諭', name: '靈魂', formula: 'INS + WLP' },
  { quirk: '巫術後裔', name: '儀式', formula: 'INS + WLP', note: '所選元素在場時可操縱它' }
]);

/**
 * 會授予儀式權限的**職業技能**，以及各自的施法公式（核心手冊 118~121 頁）。
 * `formula` 用專案既有的 `parseCheckFormula` 可解析格式。
 *
 * 前五條是核心手冊的「<學派>學派儀式」技能；後四條是擴充職業的技能，
 * 官方原文都是 "You gain the ability to perform Rituals of the **Ritualism** discipline"
 * ——亦即通用儀式學派（Ritualism，公式【INS + WLP】），不是該職業自己的學派：
 *   - 幻影（徽記師）：HF Atlas pdf p.149「Rituals of the Ritualism discipline;
 *     additionally, you may use Ritualism to create sight-based illusions.」
 *     （`rulesData` 的 desc 寫「屬於儀式學科」，學科＝學派，同一件事）
 *   - 塞壬之歌（魔奏者）：HF Atlas pdf p.139（hearing-based illusions）
 *   - 青翠之勢（植物學家）：NF Atlas pdf p.141「VERDANT SWAY…Ritualism discipline…
 *     vegetation, pollen, spores, and toxins」（desc 寫「儀式學派」）
 *   - 領航員（靈能者）：TF Atlas pdf p.153「NAVIGATOR…Ritualism discipline」
 *
 * 注意一：這四條都是 SL 1 的技能，`maxSL: 1`；有它就有權（不看 SL 高低以外的東西）。
 * 注意二：嵌合師的【嵌合學派儀式】原本就在表上（第二筆），官方給的是
 *    「選擇【INS + WLP】或【MIG + WLP】」——本檔存預設值 INS + WLP，
 *    另一個選項由角色卡上的選擇決定，不影響「有沒有權限」的判定。
 */
export const RITUAL_SKILL_SOURCES = Object.freeze([
  { skill: '秘儀學派儀式', name: '秘儀', formula: 'WLP + WLP' },
  { skill: '嵌合學派儀式', name: '嵌合', formula: 'INS + WLP', note: '可選擇改用【MIG + WLP】' },
  { skill: '元素學派儀式', name: '元素', formula: 'INS + WLP' },
  { skill: '熵系學派儀式', name: '熵系', formula: 'INS + WLP' },
  { skill: '靈魂學派儀式', name: '靈魂', formula: 'INS + WLP' },
  { skill: '幻影', name: '儀式', formula: 'INS + WLP', note: '可額外創造視覺幻象' },
  { skill: '塞壬之歌', name: '儀式', formula: 'INS + WLP', note: '可額外創造聽覺幻象' },
  { skill: '青翠之勢', name: '儀式', formula: 'INS + WLP', note: '可額外創造／活化／控制植被、花粉、孢子與毒素' },
  { skill: '領航員', name: '儀式', formula: 'INS + WLP', note: '可額外運送生物進出靈魂網絡' }
]);

/** 職業免費能力賦予的通用儀式權限（`freeBonus` 內含此字樣者）。 */
export const GENERIC_RITUAL_BONUS = '儀式學派';
export const GENERIC_RITUAL_FORMULA = 'INS + WLP';

/** 技能等級：非數字、負數、缺漏一律視為 0（0 級＝沒學過）。 */
const skillSl = (sk) => {
  const n = Number(sk?.sl);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** 收集角色每一項已學技能的 SL（同名技能跨職業累加）。 */
const collectSkillLevels = (character) => {
  const levels = new Map();
  (Array.isArray(character?.classes) ? character.classes : []).forEach((cl) => {
    (Array.isArray(cl?.skills) ? cl.skills : []).forEach((sk) => {
      const name = normalizeSkillName(sk?.name);
      if (!name) return;
      const sl = skillSl(sk);
      if (sl <= 0) return;
      levels.set(name, (levels.get(name) || 0) + sl);
    });
  });
  return levels;
};

/** 收集角色持有的英雄技能名（舊存檔有「純字串」與「物件」兩種寫法）。 */
const collectHeroicNames = (character) => {
  const list = Array.isArray(character?.heroicSkills) ? character.heroicSkills : [];
  return list
    .map((h) => (typeof h === 'string' ? h : h?.name))
    .filter(Boolean)
    .map(normalizeHeroicSkillName);
};

/**
 * 正規化金手指名。
 *
 * 舊存檔有 `'倖存者（自奇）'` 這種自己加註記的寫法（`characterEngine` 的
 * `LEGACY_QUIRK_SUFFIX_RE` 同一份規則）。本檔不 import 引擎（會循環），所以只留
 * 這一個字串層的正規化——它不依賴任何規則資料。
 */
const normalizeQuirkName = (name) => (
  typeof name === 'string'
    ? name.replace(/\s*[（(](?:高奇|自奇|科奇)[）)]\s*$/, '').trim()
    : ''
);

/**
 * 角色身上的金手指是否就是表裡這一條。
 *
 * 用 `includes` 是為了容許玩家自己在名字後面加註記（與引擎的查找寬容度一致）；
 * `'無'`（預設值）不算任何金手指。
 */
const quirkMatches = (quirkName, key) => {
  const n = normalizeQuirkName(quirkName);
  if (!n || n === '無') return false;
  return n === key || n.includes(key);
};

/**
 * 角色在金手指上「實際選到」的選項 id。
 *
 * `quirkChoice` 的兩種形態（與 `characterEngine.collectChosenQuirkOptions` 相同）：
 *   - 字串：單組選項，例如倖存者選到 `'spell'`
 *   - 物件：多組選項，例如會說話的野獸 `{ boon1: 'npcSpell', boon2: 'unarmed' }`
 * 這裡只需要「選了哪些 id」，不需要 option 物件本身，所以兩種都攤平成一個集合。
 */
const chosenQuirkOptionIds = (choice) => {
  const ids = new Set();
  if (!choice) return ids;
  if (typeof choice === 'string') {
    ids.add(choice);
    return ids;
  }
  if (typeof choice === 'object') {
    Object.entries(choice).forEach(([key, value]) => {
      if (key === 'default' && typeof value === 'string') ids.add(value);
      if (typeof value === 'string') ids.add(value);
      if (Array.isArray(value)) value.forEach((v) => { if (typeof v === 'string') ids.add(v); });
    });
  }
  return ids;
};

/** 規則庫裡的咒語目錄（預設用 `rulesData.spells`；測試可注入）。 */
const catalogueOf = (opts) => (
  Array.isArray(opts?.spellCatalogue) ? opts.spellCatalogue : (rulesData.spells || [])
);

/** 來源表（預設用本檔匯出的常數；測試傳空陣列即可做「對照組」）。 */
const tableOf = (opts, key, fallback) => (Array.isArray(opts?.[key]) ? opts[key] : fallback);

/**
 * 描述角色的咒語取得額度。
 *
 * @param {object} character 角色（可為 null／不完整，一律回空結果）
 * @param {Array<{name?:string, school?:string}>} [resolvedSpells]
 *        `resolveCharacterSpells(character)` 的結果，用來計算「已用幾個」
 * @param {{ spellCatalogue?: Array, quirkSpellSources?: Array, heroicSpellSources?: Array }} [opts]
 *        測試注入點；不傳時用檔案內建的表與 `rulesData.spells`
 * @returns {{
 *   hasPath: boolean,
 *   grants: Array<{key:string,label:string,school:string,schools:string[],sl:number,capacity:number,spell?:string,from?:string}>,
 *   allowedSchools: string[],
 *   capacity: number,
 *   used: number,
 *   remaining: number,
 *   canLearn: boolean,
 *   hasExtraGrant: boolean,
 *   chimerist: {sl:number, capacity:number, used:number} | null,
 *   unfiledGrants: Array<{key:string,label:string,reason:string}>,
 *   summary: string
 * }}
 */
export const describeSpellGrants = (character, resolvedSpells = [], opts = {}) => {
  const levels = collectSkillLevels(character);
  const heroicNames = collectHeroicNames(character);
  const spells = Array.isArray(resolvedSpells) ? resolvedSpells : [];
  const catalogueByName = new Map(catalogueOf(opts).map((sp) => [sp?.name, sp]));

  const grants = [];
  /** 官方有給、但規則庫沒有條目的授予（NPC 咒語、未建檔的點名咒語）——要明說，不能靜默 0。 */
  const unfiledGrants = [];

  // ① 職業技能：核心三清單，額度＝SL。
  tableOf(opts, 'spellGrantSources', SPELL_GRANT_SOURCES).forEach((src) => {
    const sl = levels.get(src.skill) || 0;
    if (sl <= 0) return;
    grants.push({
      key: src.skill,
      label: src.label,
      school: src.school,
      schools: [src.school],
      sl,
      capacity: src.perSl * sl,
      from: 'class'
    });
  });

  // ② 英雄技能【額外咒語】：+2，三份清單任一（「同一份清單」的限制在玩家身上）。
  const hasExtraGrant = heroicNames.includes(EXTRA_SPELL_SKILL);
  if (hasExtraGrant) {
    grants.push({
      key: EXTRA_SPELL_SKILL,
      label: '額外咒語（英雄技能）',
      school: '',
      schools: [],
      sl: 1,
      capacity: EXTRA_SPELL_GRANT,
      from: 'heroic'
    });
  }

  // ③ 英雄技能點名的咒語：實體建檔了才給一格（學派由咒語本身決定）。
  tableOf(opts, 'heroicSpellSources', HEROIC_SPELL_SOURCES).forEach((src) => {
    if (!heroicNames.includes(src.skill)) return;
    const filed = catalogueByName.get(src.spell);
    if (!filed) {
      unfiledGrants.push({
        key: `heroic:${src.skill}`,
        label: `【${src.skill}】`,
        reason: `本條授予的咒語【${src.spell}】尚未建檔`
      });
      return;
    }
    grants.push({
      key: `heroic:${src.skill}`,
      label: `【${src.skill}】`,
      school: filed.school,
      schools: [filed.school],
      sl: 1,
      capacity: 1,
      spell: filed.name,
      from: 'heroic'
    });
  });

  // ④ 金手指：咒語額度（含「NPC 咒語」這種本來就不在規則庫裡的授予）。
  const quirkName = character?.quirk;
  const chosenOptions = chosenQuirkOptionIds(character?.quirkChoice);
  tableOf(opts, 'quirkSpellSources', QUIRK_SPELL_SOURCES).forEach((src) => {
    if (!quirkMatches(quirkName, src.quirk)) return;
    // 三選一的金手指：沒選到「學一個咒語」那一項就不給（否則等於白送一格）。
    if (src.optionId && !chosenOptions.has(src.optionId)) return;
    if (src.kind === 'npc') {
      unfiledGrants.push({
        key: `quirk:${src.quirk}`,
        label: src.label,
        reason: `本條授予的咒語尚未建檔（${src.reason || '官方未給規則庫條目'}）`
      });
      return;
    }
    const schools = (src.schools || []).filter((s) => CORE_SPELL_SCHOOLS.includes(s));
    if (schools.length === 0) return;
    grants.push({
      key: `quirk:${src.quirk}`,
      label: src.label,
      school: schools[0],
      schools,
      sl: 1,
      capacity: Number(src.capacity) > 0 ? Number(src.capacity) : 1,
      from: 'quirk'
    });
  });

  // 可選清單：有對應技能的學派，加上額外咒語開放的「同清單任一」。
  const allowedSchools = [];
  const openSchool = (school) => {
    if (school && !allowedSchools.includes(school)) allowedSchools.push(school);
  };
  grants.forEach((g) => (g.schools && g.schools.length ? g.schools : [g.school]).forEach(openSchool));
  if (hasExtraGrant) CORE_SPELL_SCHOOLS.forEach(openSchool);

  const capacity = grants.reduce((sum, g) => sum + g.capacity, 0);
  // 已用：核心三清單的咒語，加上英雄技能點名的那幾筆（點名咒語就在三清單裡，這裡
  // 一併列出是為了「學派欄位日後改動時額度仍然算對」）。嵌合師那本不在此列。
  const namedSpellNames = new Set(grants.filter((g) => g.spell).map((g) => g.spell));
  const used = spells.filter((sp) => (
    CORE_SPELL_SCHOOLS.includes(sp?.school) || namedSpellNames.has(sp?.name)
  )).length;
  const remaining = Math.max(0, capacity - used);

  // 嵌合師：只回報額度與已記錄數，不提供「從規則庫挑」的入口——
  // 官方規定它只能記錄衝突現場親眼見過的咒語，規則庫裡沒有這些條目。
  const chimeristSl = levels.get(CHIMERIST_SKILL) || 0;
  const chimerist = chimeristSl > 0
    ? {
      sl: chimeristSl,
      capacity: CHIMERIST_BASE + chimeristSl,
      used: spells.filter((sp) => sp?.school === CHIMERIST_SCHOOL).length
    }
    : null;

  // 「有路徑」＝任何一種授予存在。缺檔的授予也算有路徑：玩家至少要知道系統知道它缺，
  // 而不是看到一句「本職業沒有咒語學派」然後以為是自己選錯職業。
  const hasPath = capacity > 0 || Boolean(chimerist) || unfiledGrants.length > 0;

  const pieces = grants
    .filter((g) => g.capacity > 0)
    .map((g) => {
      if (g.from === 'quirk') return g.label;
      if (g.from === 'heroic') return `${g.label} +${g.capacity}`;
      return g.school ? `${g.label} SL ${g.sl}` : `${g.label} +${g.capacity}`;
    });
  if (chimerist) pieces.push(`${CHIMERIST_SKILL} SL ${chimerist.sl}`);
  unfiledGrants.forEach((u) => pieces.push(`${u.label} 尚待建檔`));
  const summary = pieces.join('、');

  return {
    hasPath,
    grants,
    allowedSchools,
    capacity,
    used,
    remaining,
    canLearn: remaining > 0,
    hasExtraGrant,
    chimerist,
    unfiledGrants,
    summary
  };
};

/**
 * 描述角色的儀式施展權限。
 *
 * @param {object} character
 * @param {{ ritualSkillSources?: Array, quirkRitualSources?: Array, genericRitualBonus?: string }} [opts]
 *        測試注入點；不傳時用檔案內建的表
 * @returns {{
 *   canPerform: boolean,
 *   schools: Array<{name:string, formula:string, from:string, sources:string[], note?:string}>,
 *   primary: {name:string, formula:string, from:string, sources:string[], note?:string} | null,
 *   summary: string
 * }}
 */
export const describeRitualRights = (character, opts = {}) => {
  const levels = collectSkillLevels(character);
  const schools = [];

  /**
   * 同一個學派只留一筆，但**來源全部保留**（`from` 是給 tooltip 的聯集）。
   *
   * 為什麼不「先到先贏」：元素師的免費能力與【幻影】都給「儀式」學派，
   * 只留第一個來源時，玩家在 hover 上看到的是「元素師 免費能力」而看不到技能本身，
   * 日後技能被拿掉也看不出來是誰在撐這一筆。
   */
  const push = (entry, source) => {
    if (!entry?.name) return;
    const label = source || entry.from || '';
    const hit = schools.find((s) => s.name === entry.name);
    if (hit) {
      if (label && !hit.sources.includes(label)) {
        hit.sources.push(label);
        hit.from = hit.sources.join('、');
      }
      if (!hit.note && entry.note) hit.note = entry.note;
      return;
    }
    schools.push({
      name: entry.name,
      formula: entry.formula,
      from: label,
      sources: label ? [label] : [],
      ...(entry.note ? { note: entry.note } : {})
    });
  };

  // ① 職業技能：<學派>學派儀式 ＋ 四條擴充職業的 Ritualism 權限。
  tableOf(opts, 'ritualSkillSources', RITUAL_SKILL_SOURCES).forEach((src) => {
    if ((levels.get(src.skill) || 0) <= 0) return;
    let formula = src.formula;
    if (src.skill === '嵌合學派儀式') {
      const choice = character?.flowState?.['class:嵌合師:嵌合學派儀式']?.choice;
      if (choice === 'MIG + WLP') formula = 'MIG + WLP';
    }
    push({ ...src, formula }, src.skill);
  });

  // ② 職業免費能力：freeBonus 內含「儀式學派」者（元素師／熵師／靈師／嵌合師）。
  const genericBonus = typeof opts?.genericRitualBonus === 'string'
    ? opts.genericRitualBonus
    : GENERIC_RITUAL_BONUS;
  (Array.isArray(character?.classes) ? character.classes : []).forEach((cl) => {
    const def = rulesData.classes?.[cl?.className];
    if (!def) return;
    const bonusText = `${def.freeBonus || ''}${def.freeBenefits || ''}`;
    if (!bonusText.includes(genericBonus)) return;
    push(
      { name: '儀式', formula: GENERIC_RITUAL_FORMULA },
      `${cl.className} 免費能力`
    );
  });

  // ③ 技能「儀式學派」本身帶的子選項（舊存檔與部分變體以此記錄額外學派）。
  (Array.isArray(character?.classes) ? character.classes : []).forEach((cl) => {
    (Array.isArray(cl?.skills) ? cl.skills : []).forEach((sk) => {
      if (skillSl(sk) <= 0) return;
      if (normalizeSkillName(sk?.name) !== '儀式學派') return;
      (Array.isArray(sk.selectedOptions) ? sk.selectedOptions : []).forEach((opt) => {
        if (!opt) return;
        push({
          name: String(opt).replace(/學派$/, ''),
          formula: String(opt).includes('秘儀') ? 'WLP + WLP' : 'INS + WLP'
        }, '儀式學派');
      });
    });
  });

  // ④ 金手指授予的儀式權限（元素之魂、離鄉的妖精、通智幽魂、世界的神諭、巫術後裔）。
  tableOf(opts, 'quirkRitualSources', QUIRK_RITUAL_SOURCES).forEach((src) => {
    if (!quirkMatches(character?.quirk, src.quirk)) return;
    push(src, `金手指【${src.quirk}】`);
  });

  return {
    canPerform: schools.length > 0,
    schools,
    primary: schools[0] || null,
    summary: schools.map((s) => s.name).join('、')
  };
};
