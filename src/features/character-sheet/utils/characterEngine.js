import rulesData from '../data/rulesData.json';
import { PLAYTEST_HEROIC_SKILLS } from '../data/playtestHeroicSkills';
import { SOURCEBOOKS, STATUS_AFFLICTIONS, ATTRIBUTE_NAMES, ATTRIBUTE_KEYS, ATTRIBUTE_PRESET_ARRAYS, normalizeClassName, VARIANT_ARCANIST_CLASS_NAME } from '../data/sourcebookConfig';
import { getSkillSuboptionConfig, calculateSkillSuboptionMax } from '../data/skillSuboptionsData';
import { PILOT_ARMOR_MODULES } from '../data/pilotVehicleData';
import { DEFAULT_CREATION_RULES, resolveCreationRules, PLAYTEST_SOURCEBOOK_KEY } from '../data/creationRules';
import { buildLoadoutIssues } from './equipmentRules';
import { buildCustomWeaponEntries, validateCustomWeapon, CUSTOM_WEAPON_BASE } from '../data/customWeapons';
import { appendLog, createLogEntry } from './characterLog';
import { findVariantHeroicSkillConflicts } from '../data/coreBookVariants';
import { stripClassSuffix } from '../data/classAliases';
import { VARIANT_ARCANIST_HEROIC_SKILLS } from '../data/variantArcanistHeroicSkills';
import { isInitiativeVariant, getArmorProfile, initiativeVariantTermLabel } from '../data/initiativeVariant';
import { isZeroPowersEnabled, createZeroPowerState } from '../data/zeroPowers';
import {
  createTechnosphereState,
  getActiveMnemospheres,
  getHeldMnemospheres,
  getMnemosphereSkills,
  getSkillLevelCeiling,
  getTechnosphereEquipmentSpend,
  INNATE_CLASS_COUNT,
  INNATE_MIN_LEVELS,
  isTechnosphereEnabled,
  isSkillSuppressedByTechnospheres,
  modeGrantsInnateBonus,
  modeGrantsMartialWeaponProficiency,
  modeHasMnemospheres,
  modeRestrictsEquipment,
  normalizeTechnosphereState,
  validateTechnosphereState,
  MNEMOSPHERE_MAX_LEVEL
} from '../data/technospheres';
import { zeroPowerIssues } from './zeroPower';

// Dice ladder for step reductions
const DICE_STEPS = [6, 8, 10, 12];

/**
 * 四維屬性骰階的合法階梯（原書 p.162：最小 d6、最大 d12）。
 *
 * 這是唯一的來源：`AttributeMatrixPicker` 的步進器、`fultimatorConverter` 的匯入夾制、
 * `validateCharacter` 的範圍檢查都讀它。以前 UI 有一份 `VALID_TIERS`、引擎有一份
 * `DICE_STEPS`、匯入端則完全沒有——於是匯入的 `dex: 20` 會直接進引擎。
 */
export const ATTRIBUTE_DICE_TIERS = Object.freeze([...DICE_STEPS]);

/**
 * 骰階在階梯上的索引（d6=0、d8=1、d10=2、d12=3）；不在階梯上回 -1。
 * 「+1 階」就是索引 +1，所以整個升級機制可以用索引加減表達。
 */
export const attributeDieIndex = (die) => ATTRIBUTE_DICE_TIERS.indexOf(Number(die));

/**
 * 官方三組起始陣列的**索引和**（Core 印刷 p.162）：
 *   Jack of All Trades d8,d8,d8,d8 → 1+1+1+1 = 4
 *   Average d10,d8,d8,d6          → 2+1+1+0 = 4
 *   Specialized d10,d10,d6,d6     → 2+2+0+0 = 4
 * 三組都是 4，所以「這張卡用掉了幾次升級」＝ 索引和 − 4。這是整套判定的支點。
 */
export const ATTRIBUTE_PROFILE_INDEX_SUM = 4;

/**
 * 依等級**應該已經用掉幾次**屬性骰升級（Core 印刷 p.229）：
 *
 * > If you just reached **level 20 or 40**, choose one of your Attributes and increase its
 * > **base** die size by one step, up to a maximum of d12.
 *
 * 所以 20 級給 1 次、40 級再給 1 次（等級上限 50，所以最多 2 次）。
 * 加的是**基礎**骰——與 HP/MP 的算法一致（`calculateCharacterStats` 用 base 骰）。
 */
export const attributeDieUpgradesAllowed = (level) => {
  const lv = Number(level);
  if (!Number.isFinite(lv)) return 0;
  return (lv >= 20 ? 1 : 0) + (lv >= 40 ? 1 : 0);
};

/** 這組四維用掉了幾次升級（索引和 − 4）。有骰階不在階梯上時回 null。 */
export const attributeDieUpgradesUsed = (attributes) => {
  const idx = ATTRIBUTE_KEYS.map((key) => attributeDieIndex(attributes?.[key]));
  if (idx.some((i) => i < 0)) return null;
  return idx.reduce((sum, i) => sum + i, 0) - ATTRIBUTE_PROFILE_INDEX_SUM;
};

/**
 * 這組四維是不是「從官方三組陣列出發、用不超過 `allowed` 次升級」推得出來的。
 *
 * 骰子只能往上、不能超過 d12；把兩邊都**降冪**排序後逐位相減就是最佳配對
 * （重排不等式）——所以只需要檢查每個差都 ≥ 0 且總和 ≤ 允許次數。
 *
 * 這取代了舊版的「總和必須等於 32」：那條在 20 級升過一次之後就變成假的
 * （d10→d12 讓總和變 34，app 會對照規則升級的玩家噴警告）。
 */
export const attributeDiceReachable = (attributes, allowed) => {
  const dice = ATTRIBUTE_KEYS.map((key) => attributeDieIndex(attributes?.[key]));
  if (dice.some((i) => i < 0)) {
    return { ok: false, reason: `骰階必須是 ${ATTRIBUTE_DICE_TIERS.map((d) => `d${d}`).join('／')}` };
  }
  const desc = [...dice].sort((a, b) => b - a);
  for (const preset of ATTRIBUTE_PRESET_ARRAYS) {
    const profile = preset.diceList.map(attributeDieIndex).sort((a, b) => b - a);
    const need = desc.map((v, i) => v - profile[i]);
    if (need.every((v) => v >= 0) && need.reduce((s, v) => s + v, 0) <= allowed) {
      return { ok: true, preset: preset.name, steps: need.reduce((s, v) => s + v, 0) };
    }
  }
  return {
    ok: false,
    reason: ATTRIBUTE_PRESET_ARRAYS.map((p) => `${p.name} ${p.diceList.map((d) => `d${d}`).join(',')}`).join('／')
  };
};

/** 把任意數字夾到合法骰階（取最接近的一階；同距取低的那一階，不替玩家灌水） */
export const snapToAttributeDie = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 8;
  let best = ATTRIBUTE_DICE_TIERS[0];
  let bestDist = Infinity;
  ATTRIBUTE_DICE_TIERS.forEach((tier) => {
    const dist = Math.abs(tier - n);
    if (dist < bestDist) {
      best = tier;
      bestDist = dist;
    }
  });
  return best;
};

export const reduceDieStep = (baseDie, steps = 1) => {
  const currentIdx = DICE_STEPS.indexOf(baseDie);
  if (currentIdx === -1) return Math.max(6, baseDie - steps * 2);
  const targetIdx = Math.max(0, currentIdx - steps);
  return DICE_STEPS[targetIdx];
};

/**
 * 判定職業免費增益是否為「最大 HP 或最大 MP」二選一。
 *
 * 為什麼不能只看有沒有一個「或」字：例如「獲得裝備職業近戰或遠程武器（二選一）和職業防具」
 * 這種寫法——它的「或」指的是武器類別，HP 本身是固定 +5。只看「或」會把它誤判為
 * HP/MP 二選一，一旦玩家選了 MP 就會得到錯誤的數值。
 * （歷史上最容易誤判的是 暗黑之刃【Playtest】，該職業已於 2026-10-19 刪除，但判定規則要守住。）
 * 因此必須同時在句中看到 HP 與 MP 兩側（或英文的 maximum Hit/Mind Points 兩側）。
 */
export const isHpMpChoiceBenefit = (freeBenefitText = '') => (
  /最大\s*HP[^。；]{0,40}或[^。；]{0,40}最大\s*MP/.test(freeBenefitText) ||
  /最大\s*MP[^。；]{0,40}或[^。；]{0,40}最大\s*HP/.test(freeBenefitText) ||
  /maximum\s+(?:Hit|Mind)\s+Points[^.]{0,60}\bor\b[^.]{0,60}maximum\s+(?:Hit|Mind)\s+Points/i.test(freeBenefitText)
);

/**
 * 新角色的佔位姓名。
 *
 * 它不是玩家填的名字，只是讓卡片在填之前有東西可顯示。
 * `validateCharacter` 必須把它當成「尚未填寫」——否則那條提醒對任何新角色都不會觸發，
 * 等於一條永遠不會響的檢查（測試以 `PLACEHOLDER_CHARACTER_NAME` 綁住兩邊）。
 */
export const PLACEHOLDER_CHARACTER_NAME = '新冒險者';

/**
 * 全部英雄技能：正式規則書 111 筆 ＋ Playtest 新增 43 筆 ＋ 變體秘儀師 9 筆。
 *
 * 三份分開存是因為**出處不同**——Playtest 那批官方自己標為「NEW HEROIC SKILLS，
 * designed for inclusion within the Strategy Guide」，也就是還沒進正式規則書；
 * 變體秘儀師那批是同一份文件的 p.32，為了「核心／變體互不相通」而必須獨立成條目
 * （見 `variantArcanistHeroicSkills.js` 檔頭）。
 * 這一支是唯一的合併入口，所有讀取端（引擎、編輯器、三頁匯出）都走它，
 * 免得有人只讀 `rulesData.heroicSkills` 而看不到另外兩批。
 */
export const HEROIC_SKILLS = Object.freeze([
  ...(rulesData.heroicSkills || []),
  ...PLAYTEST_HEROIC_SKILLS,
  ...VARIANT_ARCANIST_HEROIC_SKILLS
]);

/**
 * 英雄技能出處的顯示名（`source` 欄位 → 中文）。
 *
 * 出處回填自繁中版角色卡 Excel V2.17 的來源區段標記（位置對齊、已驗證順序一致）：
 * 核心 31／死亡饋贈 3／高度奇幻 24／科技奇幻 18／自然奇幻 21／24年萬聖 14。
 * 「死亡饋贈」與「24年萬聖」都屬 DLC 內容，一併歸到 `bonus`。
 */
export const HEROIC_SKILL_SOURCE_LABELS = Object.freeze({
  core: '核心',
  highFantasy: '高度奇幻',
  naturalFantasy: '自然奇幻',
  technoFantasy: '科技奇幻',
  bonus: '特典',
  playtest: 'Playtest'
});

/**
 * 從 `requirement` 的職業段落抽出**最長**的職業名。
 *
 * 為什麼要取最長：職業名互為子字串（`秘儀師` ⊂ `秘儀師【變體】`）。若照舊「有出現就算」，
 * 變體條目的 requirement 會同時命中核心職業 → 精通核心版的人也能選變體技能，
 * 「兩者不能相通」就破了。取最長之後，`秘儀師【變體】` 只認變體、`秘儀師` 只認核心。
 *
 * 「且／並」之後是額外技能前提，不列入判定（那是自由文字，猜錯會擋掉合法角色）。
 */
const requiredClassesOf = (requirement) => {
  const classPart = String(requirement || '').split(/且|並/)[0];
  const hits = Object.keys(rulesData.classes).filter((name) => classPart.includes(name));
  return hits.filter((name) => !hits.some((other) => other !== name && other.includes(name)));
};

/**
 * 精通某個職業之後能解鎖哪些英雄技能（原書 p.232：把一個職業練到 10 級可獲得一個英雄技能）。
 *
 * 判定與 `checkHeroicSkillRequirement` 共用 `requiredClassesOf`，所以「需精通守護者或機師」
 * 會**同時**出現在守護者與機師底下（兩條路都能走）。`通用` 的技能與職業無關，一律排除。
 *
 * **核心版與變體版互不相通**（§BG 使用者裁定）：變體職業的條目需求寫「秘儀師【變體】」，
 * 因為取最長職業名，精通核心秘儀師的人不會看到它們，反之亦然。
 *
 * 放在引擎而不是元件裡：職業彈窗要顯示它，而它得能被測試直接驗。
 */
export const heroicSkillsForClass = (className) => {
  if (!className) return [];
  // 舊名先正名（§BF：秘儀師【Playtest】 → 秘儀師【變體】）。
  const key = normalizeClassName(className);
  if (!key) return [];
  // 已刪除／未知的舊職業（例：守護者【Playtest】）退回「剝後綴」比對，讓舊存檔還看得到
  // 主職業的英雄技能；**現行職業一律精確比對**——否則變體職業會連核心那份一起吃下。
  const match = Object.prototype.hasOwnProperty.call(rulesData.classes, key)
    ? key
    : stripClassSuffix(key);
  if (!match) return [];
  return HEROIC_SKILLS.filter((h) => h.requirement !== '通用'
    && requiredClassesOf(h.requirement).includes(match));
};

/**
 * 某個職業的技能表（給職業魔石分配點數用）。
 *
 * 職業魔石（科技奇幻手冊 p.136）給的是「該職業的技能」，每一級一點。
 * 那張表就是 `rulesData.classes[職業].skills`——與職業本身用的是同一份資料，
 * 所以魔石的技能上限（`maxSL`）與職業技能完全一致，不會出現兩套數字。
 *
 * `technosphereMode` 是選填的（§CF）：魔晶石制下原書明文作廢的技能（p.133 的
 * 守護者【雙重盾牌】）不會出現在回傳清單裡。**不傳時行為逐字不變**——
 * 這條路徑同時被「查技能上限」與「列可選技能」兩種呼叫端使用，
 * 前者不該因為模式而查不到技能。
 *
 * 為什麼放在引擎而不是資料層：`rulesData` 只被引擎持有（資料層零依賴原則）。
 */
export const classSkillsForClass = (className, technosphereMode = null) => {
  if (!className) return [];
  const key = normalizeClassName(className);
  if (!key) return [];
  const match = Object.prototype.hasOwnProperty.call(rulesData.classes, key)
    ? key
    : stripClassSuffix(key);
  if (!match) return [];
  return (rulesData.classes[match]?.skills || [])
    .filter((sk) => !isSkillSuppressedByTechnospheres(sk.name, technosphereMode))
    .map((sk) => ({
      name: sk.name,
      maxSL: Math.max(1, Number(sk.maxSL) || 1),
      desc: sk.desc || ''
    }));
};

/**
 * 這個英雄技能最多可以取得幾次。
 *
 * 原書預設是 1 次（「除非特別說明，每個英雄技能只能獲得一次」），但**少數技能明文寫著
 * 可以拿多次**——`嵌合術精通`（may be acquired up to twice）、`解剖學家`
 * （can be acquired up to three times）。舊版介面無條件擋重複，那兩個技能等於拿不到第二次。
 */
export const heroicSkillMaxAcquisitions = (skill) => {
  const n = Number(skill?.maxAcquisitions);
  return Number.isFinite(n) && n > 1 ? Math.floor(n) : 1;
};

/**
 * 開局名額的「同團不得重複」（Playtest Materials 2026-10-01, p.4）：
 * 「**no two characters may acquire the same Heroic Skill this way**」。
 *
 * 這是**團務層級**的限制——`validateCharacter` 只看得到一張卡，所以由持有名冊的呼叫端
 * （名冊頁）來檢查。回傳重複的技能名與用到它的角色名。
 * 只有「靠開局名額取得」的才算；靠精通取得的不受此限（每個人本來就各拿各的）。
 */
export const findDuplicateStartingHeroicSkills = (roster = []) => {
  const seen = new Map();
  (roster || []).forEach((char) => {
    // 規則存在角色身上：只有「這張卡自己」開了開局英雄技能，它的名額才算數
    const creation = resolveCreationRules(char?.creationRules);
    if (!creation.startingHeroicSkill) return;
    const stats = calculateCharacterStats(char);
    const owned = (char.classes || []).map((c) => c.className);
    const level = getCharacterLevel(char);
    (char.heroicSkills || []).forEach((entry) => {
      const name = typeof entry === 'string' ? entry : entry?.name;
      const def = HEROIC_SKILLS.find((h) => h.name === name);
      if (!def) return;
      // 靠精通取得 → 不算佔用開局名額
      if (checkHeroicSkillRequirement(def, { masteredClasses: stats.masteredClasses, classes: owned, level }).ok) return;
      if (!checkHeroicSkillRequirement(def, { classes: owned, level, atCreation: true }).ok) return;
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name).push(char.name || char.id || '(未命名)');
    });
  });
  return [...seen.entries()]
    .filter(([, who]) => who.length > 1)
    .map(([name, characters]) => ({ name, characters }));
};

/**
 * 開局名額**不能**取得的英雄技能（Playtest Materials 2026-10-01, p.4 明文列出）。
 *
 * 官方原文列的是英文名，這裡是對應的繁中名——對應方式是**官方字母序**：
 * 核心規則書的英雄技能章（英文 p.232–235）按字母排列，而繁中版角色卡 Excel V2.17
 * 的「英雄技能列表」核心區段**順序完全一致**，所以逐位對齊即可（已逐筆核對）：
 * Deep Pockets→大口袋、Extra HP→額外HP、Extra IP→額外IP、Extra MP→額外MP、
 * Powerful Shot→強力射擊、Powerful Spell→強力咒語、Powerful Strike→強力攻擊、Revelation→啟示。
 *
 * 官方理由：這些是「通用型」的強化技能，開局就給會讓角色失去成長曲線。
 */
export const STARTING_HEROIC_SKILL_BLOCKLIST = Object.freeze([
  '大口袋',
  '額外HP',
  '額外IP',
  '額外MP',
  '強力射擊',
  '強力咒語',
  '強力攻擊',
  '啟示'
]);

/**
 * 英雄技能的前提判定（原書 p.232）。
 *
 * 官方原文：「當一個玩家角色將一個職業提升到 10 級時，這個角色可以從下面的列表中
 * 獲得一個英雄技能。」——**精通一個職業是所有英雄技能的共同前提**，這一條 100% 可靠。
 *
 * `rulesData.heroicSkills[].requirement` 是自由文字，實際有六七種寫法：
 * `通用`、單一職業、`A、B或C`、`A，且必須獲得 X 技能`、
 * `兩個或更多：…，且角色等級必須為 30 或更高`……。這裡**只判定能精確判定的部分**：
 * - 職業名是封閉集合（比對 `rulesData.classes` 的鍵）→ 可以抽出來；
 * - 「等級必須為 N 或更高」→ 可以抽出來；
 * - **「且／並」後面的額外技能前提不猜**——那是自由文字，猜錯會擋掉合法角色。
 *   它已經顯示在選項標籤上（`[requirement]`），由玩家自己確認。
 * - 「兩個或更多：A、B、C」這種寫法只要求**其中之一**（比原文寬鬆，寧漏不誤）。
 *
 * 職業名互為子字串（`秘儀師` ⊂ `秘儀師【變體】`）**會誤判，所以取最長職業名**
 * （`requiredClassesOf`）：變體條目只認變體職業，核心條目只認核心職業。
 * 這正是 §BG 使用者裁定的「兩者不能相通」——精通核心版卻能選變體技能，隔離就沒意義了。
 */
export const checkHeroicSkillRequirement = (skill, {
  masteredClasses = [],
  classes = [],
  level = 5,
  atCreation = false
} = {}) => {
  const req = String(skill?.requirement || '').trim();
  if (!req) return { ok: true, reason: '' }; // 沒有前提資料 → 無法判定，不擋

  // 開局名額（Playtest Materials 2026-10-01, p.4）：
  // 官方原文「the character must have at least one of those Classes at character creation」
  // ——不要求精通，只要**擁有**那個職業其中之一（開局本來就不可能有 10 級職業）。
  // 官方同時明說「Any other requirements … remain unchanged」，所以等級前提照舊。
  if (atCreation) {
    // 比對時要把尾端的【…】剝掉：`啟示【變體】` 是 `啟示` 的變體版，
    // 官方擋的是「這條技能」，不是「這個名字」——不剝就會出現
    // 「核心角色開局拿不到啟示、變體角色卻拿得到」的漏洞。
    const rawName = String(skill?.name || '');
    const bareName = stripClassSuffix(rawName);
    if (STARTING_HEROIC_SKILL_BLOCKLIST.includes(rawName)
      || STARTING_HEROIC_SKILL_BLOCKLIST.includes(bareName)) {
      return { ok: false, reason: '這個英雄技能不能用開局名額取得' };
    }
    if (classes.length === 0) return { ok: false, reason: '開局名額需要至少一個職業' };
  } else if (masteredClasses.length === 0) {
    return { ok: false, reason: '需先精通一個職業（單一職業達 10 級）' };
  }
  if (req === '通用') return { ok: true, reason: '' };

  const lv = /等級必須為\s*(\d+)\s*或更高/.exec(req);
  if (lv) {
    const need = parseInt(lv[1], 10);
    if (level < need) return { ok: false, reason: `需角色等級 ${need} 或更高` };
  }

  // 職業段落：「且／並」之後是額外技能前提，不列入判定
  const required = requiredClassesOf(req);
  if (required.length === 0) return { ok: true, reason: '' }; // 抓不到職業名 → 不擋

  // 少數技能明文寫著「不必精通」（例：Playtest 的【銃劍士】「you must have acquired the
  // Sharpshooter Class and/or the Weaponmaster Class (even if you have not mastered them)」）。
  // 這種情況兩種模式都只要求**擁有**該職業，不要求精通。
  const anyClassEnough = /不必精通/.test(req);
  const owned = (atCreation || anyClassEnough) ? classes : masteredClasses;
  if (required.some((name) => owned.includes(name))) return { ok: true, reason: '' };

  // 錯誤訊息照原樣顯示職業名：`【變體】` 現在是玩家必須分辨的東西，
  // 剝掉它會變成「需精通【秘儀師】」，而對方缺的其實是「秘儀師【變體】」。
  // 名稱本身已含【…】時不再多加一層外框，免得變成「【秘儀師【變體】】」。
  const shown = [...new Set(required)];
  const needsList = shown.some((n) => n.includes('【'))
    ? shown.join('／')
    : `【${shown.join('／')}】`;
  return {
    ok: false,
    reason: atCreation
      ? `開局需擁有${needsList}其中之一`
      : `需精通${needsList}其中之一`
  };
};

/**
 * 建立全新角色卡預設結構
 *
 * 起始等級、起始資金與開放的拓展都由**開卡規則**決定（見 `data/creationRules.js`），
 * 不再寫死在這裡——GM 自訂開局就是傳一份不同的規則進來。
 * `overrides` 仍為最上層覆寫，優先於規則。
 */
export const createNewCharacter = (overrides = {}, rules = DEFAULT_CREATION_RULES) => {
  const creation = resolveCreationRules(rules);
  const character = {
    id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: PLACEHOLDER_CHARACTER_NAME,
    identity: "",
    // 主題**預設為空**：原書 p.158 說「如果這是你的第一位角色，強烈建議你從下面的
    // 列表選擇」——那是建議玩家選，不是系統替他選。舊版預設 '希望'，等於替玩家
    // 決定了角色最核心的那個情感，而且讓「尚未選擇個人主題」那條提醒永遠不響。
    theme: "",
    origin: "",
    // 性別與角色背景屬於原書第 8 步（p.154「描述你的角色並選擇名字和稱呼」）。
    // 官方角色卡上與姓名並排的那一格是「稱呼」，本專案依使用者裁定（2026-10-06）
    // 改為**性別**；原書同一步的「外貌描述」則改為**角色背景**（頭像已由 avatar 承載）。
    gender: "",
    background: "",
    avatar: null,
    avatarRaw: null,

    // 冒險等級與成長（由開卡規則決定）
    level: creation.startingLevel,
    exp: 0,
    zenit: creation.startingZenit,
    // 起始資金尚未結算：原書 p.165 的起始資金是「剩餘裝備預算 ＋ 2d6 × 10」，
    // 不是裝備預算本身。在玩家按下結算之前，`zenit` 只是預算的佔位值。
    // **舊存檔沒有這個欄位 → undefined → 一律視為已結算**，行為與以前完全相同。
    startingFundsRolled: false,
    fabulaPoints: 3,

    // 啟用的手冊拓展（由開卡規則決定；上限另由 allowedSourcebooks 把關）
    enabledSourcebooks: [...creation.defaultSourcebooks],

    // 四維屬性基礎骰階（起始總和為 32）
    //
    // **預設是空的（0 = 尚未指派）**，不替玩家先套「萬事通」。原書 p.162 給了
    // 三組建議陣列，但選哪一組是玩家的決定——舊版預設 d8×4 等於偷偷替他選了。
    // 0 會在 `calculateCharacterStats` 被視為「尚未指派」（`attributesUnset`），
    // 六項數值因此在畫面上顯示為未定，而不是拿一個假的 d8 算出來。
    attributes: {
      dex: 0,
      ins: 0,
      mig: 0,
      wlp: 0
    },

    // 六大狀態異常 (Status Afflictions)
    statusAfflictions: {
      dazed: false,    // 眩暈: INS 降一階
      enraged: false,  // 憤怒: DEX & INS 降一階
      poisoned: false, // 中毒: MIG & WLP 降一階
      shaken: false,   // 動搖: WLP 降一階
      slow: false,     // 緩慢: DEX 降一階
      weak: false      // 虛弱: MIG 降一階
    },

    // 職業與特技配置 (預設為空，起始需配置 2~3 個職業)
    classes: [],

    // 三維六向情感羈絆 (上限 6 個)。
    // 官方創角八步驟**不含羈絆**（原書 p.154），羈絆是在遊戲中的休息場景等時機建立（p.57）；
    // 「起始帶 1 條羈絆」是選用規則（p.220），本專案未開啟 —— 所以新角色從 0 條開始。
    bonds: [],

    // 武裝配置：開卡時兩手皆為徒手打擊、不穿防具 —— 預算 500z 全額留給玩家自己選購
    equipment: {
      mainHand: "徒手打擊",
      offHand: "徒手打擊",
      armor: "無裝甲 / 冒險服",
      accessory: ""
    },

    // 角色自己鍛造的【定制武器】（高度奇幻手冊 p.106 的選用規則）。
    // 舊存檔沒有這個欄位 → 視為空陣列，行為與以前完全相同。
    // 這裡只存「規格」，實際的武器條目由 `data/customWeapons.js` 的
    // `buildCustomWeaponEntries()` 即時產生——單一來源，避免兩份資料漂移。
    customWeapons: [],

    // 已學會法術、英雄技能、金手指與個人筆記
    spells: [],    heroicSkills: [],
    quirk: "無",
    // 金手指「選項」（§CF）：11 個金手指寫著「選擇一個選項」，其中只有兩個會改數值
    // （倖存者③ IP +2、墮落天使③ 最大 MP +10）。這裡存選中的 `options[].id`。
    // 預設空字串——建角不替玩家選（與金手指本身同一原則）；舊存檔沒有這個欄位
    // → `getQuirkOptionEffects` 回空物件，行為與以前完全相同。
    quirkChoice: "",
    backpackNotes: "",

    // 底力技（高度奇幻手冊 p.124–131 的選用規則）。
    // **預設是空的**：建角時不替玩家選觸發或效果（與四維屬性、羈絆、金手指同一原則）。
    // 舊存檔沒有這個欄位 → 由 `normalizeZeroPower` 收斂成空狀態，行為與以前完全相同。
    zeroPower: createZeroPowerState(),

    // 個人命刻 (Personal Clocks)。
    // 原書的創角八步驟（p.154）與同章都沒有命刻，所以**不預先種一條**——
    // 「新角色一開始就有一條時鐘」是專案自己的假設，跟 §AB 移除的預設羈絆是同一類東西。
    // 空陣列的空狀態由 `CharacterCard` 與跑團面板各自處理。
    clocks: [],

    // 即時動態資源 (null 代表等於最大值)
    currentHp: null,
    currentMp: null,
    currentIp: null,

    // 秘儀師的阿爾卡納契約資料。
    // **刻意留空**：開局那一個阿爾卡納是玩家自選的（Core p.133），
    // 舊版由 `ArcanistManager` 在讀取時預設 `boundArcana: ['sword']`，
    // 等於送玩家一個沒選過的契約與它的連攜增益（+5 傷害、傷害視為無屬性）。
    arcanistData: {
      boundArcana: [],
      customArcana: [],
      activeSummonId: null
    },

    // 魔晶石（科技奇幻手冊 p.132–145 的選用規則）。
    // **預設是空的**：不替玩家挑職業魔石，也不預先掛任何附魔魔石——
    // 與四維屬性、羈絆、金手指、底力技同一個原則。
    // 舊存檔沒有這個欄位 → `normalizeTechnosphereState` 收斂成空狀態，行為不變。
    // 規則關閉時這個欄位一樣存在，只是沒有讀取端會去用它。
    technospheres: createTechnosphereState(),

    // 創角定稿狀態（見下方 isCharacterLocked／lockCharacter）
    locked: false,
    lockedAt: null,

    updatedAt: new Date().toISOString(),
    ...overrides
  };

  // 成長履歷的第一筆：建卡。之後的每一次變更都由 loggableChange 追加。
  return appendLog(character, createLogEntry({
    kind: 'creation',
    title: `建立角色（${creation.startingLevel} 級起，起始資金 ${creation.startingZenit}z）`
  }));
};

/**
 * 檢查角色擁有的軍用武裝熟練度
 */
export const getProficiencies = (char) => {
  const profs = {
    martialMelee: false,
    martialRanged: false,
    martialArmor: false,
    martialShields: false
  };

  // 魔晶石（科技奇幻手冊 p.134）：創角時直接獲得**職業近戰與遠程武器**的裝備能力。
  //
  // 注意它**不給職業防具**——原書寫得很死：「gains the ability to equip martial melee
  // weapons and ranged weapons」，沒有 armor。這正是魔晶石制要付的代價之一：
  // 你的防具選擇被鎖在自訂防具上，而自訂防具沒有職業防具的減傷門檻。
  // 「僅職業魔石」變體把這條整條拿走（p.138）。
  const creation = resolveCreationRules(char?.creationRules);
  if (modeGrantsMartialWeaponProficiency(creation.technospheres)) {
    profs.martialMelee = true;
    profs.martialRanged = true;
  }

  (char.classes || []).forEach(cl => {
    const cName = cl.className || '';
    const classDef = rulesData.classes[cName];
    const fb = (classDef?.freeBenefits || '') + ' ' + (classDef?.freeBonus || '');

    if (fb.includes('近戰') || ['武器大師', '暗黑之刃', '狂怒鬥士', '指揮官'].some(n => cName.includes(n))) profs.martialMelee = true;
    if (fb.includes('遠程') || ['神射手', '指揮官', '機師'].some(n => cName.includes(n))) profs.martialRanged = true;
    if (fb.includes('防具') || ['守護者', '暗黑之刃', '狂怒鬥士'].some(n => cName.includes(n))) profs.martialArmor = true;
    if (fb.includes('盾牌') || ['守護者', '武器大師', '神射手', '指揮官'].some(n => cName.includes(n))) profs.martialShields = true;
  });

  return profs;
};

/**
 * 角色的等級 —— **單一讀取點**。
 *
 * 為什麼要有這個函式：角色資料裡的 `level` 是**玩家可以直接編輯的欄位**
 * （編輯器有一個 5～50 的數字框），所以它才是權威；每個職業另外各有一個等級，
 * 那是「這些等級怎麼分配」的結果。兩者本來應該相等（升級時一起 +1），
 * 但沒有東西在檢查，於是會**漂移**——同一張卡在卡片上顯示 Lv 5、在匯出的三頁表格上顯示 Lv 8。
 *
 * 處理方式是：**以玩家設定的等級為準**，並在 `validateCharacter` 用一則提醒
 * 把「職業等級總和對不上」講出來，而不是偷偷拿另一個數字蓋掉玩家的輸入。
 */
export const getCharacterLevel = (char) => (
  parseInt(char?.level, 10) || DEFAULT_CREATION_RULES.startingLevel
);

/**
 * 目前**真的裝著東西**的裝備槽位 id。
 *
 * 這個判定原本只寫在 `calculateCharacterStats` 裡面（算「生效中的職業魔石」用），
 * 2026-10-22 抽出成匯出函式——因為建角第 2 步的「職業魔石」區也要用它來算
 * 「已裝載幾顆」。抽出來的動機不是為了重複使用，是為了**不要有第二份判定**：
 * 一處認為「這格是空的」、另一處認為「這格有東西」，就會出現「卡片上寫已裝備、
 * 引擎卻說未生效」這種沒人查得出來的漂移。
 *
 * `'無'` 與 `'無盾牌'` 是裝備選擇器清空後留下的佔位字串，不是裝備。
 *
 * @param {object} char
 * @returns {string[]} 例如 `['mainHand', 'armor']`
 */
export const getEquippedTechnosphereSlotIds = (char) => (
  ['mainHand', 'offHand', 'armor', 'accessory'].filter((slotId) => {
    const equipped = char?.equipment?.[slotId];
    return Boolean(equipped) && equipped !== '無' && equipped !== '無盾牌';
  })
);

/**
 * 金手指「選項」的機械效果（§CF）。
 *
 * 原書有 11 個金手指寫著「選擇一個選項」，但絕大多數是敘事選項（寫下預言、
 * 指定羈絆對象、挑一個聯繫人……）。真正會改數值的只有兩個：
 * 倖存者③「永久 +2 IP」、墮落天使③「最大 MP +10」——那兩筆寫在資料層的
 * `quirks[].options[].effects`，其餘選項根本沒有 `effects` 欄位。
 *
 * 沒選、選了敘事項、或舊存檔沒有 `quirkChoice` → 回空物件（行為與以前相同）。
 * 選了資料裡不存在的 id 也回空物件——不猜、不近似。
 */
const findQuirkDef = (name) => {
  if (!name || name === '無') return null;
  const quirks = rulesData.quirks || [];
  // 精確優先，其次包含——舊存檔有 `'倖存者（自奇）'` 這種自己加註記的寫法，
  // 而金手指本身的數值效果一直是 `includes` 比對（見下面 (4) 那一段），
  // 選項的查找必須用同一個寬容度，否則加了註記的角色選項會靜默失效。
  return quirks.find((q) => q.name === name) || quirks.find((q) => name.includes(q.name)) || null;
};

/** 金手指 effects 裡「會累加成陣列」的鍵（其餘數字鍵一律相加） */
const QUIRK_FX_ARRAY_KEYS = ['resistances', 'vulnerabilities', 'absorption', 'immuneDamage', 'immuneStatuses'];

/** 把一筆 effects 併進累加器：數字相加、陣列去重後串接 */
const mergeQuirkEffects = (acc, fx) => {
  if (!fx || typeof fx !== 'object') return acc;
  Object.entries(fx).forEach(([key, value]) => {
    if (QUIRK_FX_ARRAY_KEYS.includes(key)) {
      if (Array.isArray(value)) acc[key] = Array.from(new Set([...(acc[key] || []), ...value]));
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      acc[key] = (acc[key] || 0) + value;
    }
  });
  return acc;
};

/**
 * 收集玩家在這個金手指上實際選到的 option 物件。
 *
 * `quirkChoice` 有兩種形態：
 * - **字串**：單組選項（倖存者、墮落天使……），`options[].id`
 * - **物件**：多組選項（草木成精要選「免疫狀態」＋「易傷屬性」兩件事），
 *   鍵是組 id、值是該組選到的 option id——即 `{ immune: '眩暈', vuln: '火' }`
 *
 * 舊存檔只有字串；`optionGroups` 的金手指若拿到字串，只認第一組
 * （玩家手動改壞資料時不至於讓整個金手指失效）。
 */
const collectChosenQuirkOptions = (quirk, choice) => {
  if (!quirk || !choice) return [];
  const picked = [];
  const take = (list, id) => {
    const hit = (list || []).find((opt) => opt && opt.id === id);
    if (hit) picked.push(hit);
  };

  if (typeof choice === 'string') {
    take(quirk.options, choice);
    if (Array.isArray(quirk.optionGroups) && quirk.optionGroups[0]) {
      take(quirk.optionGroups[0].options, choice);
    }
    return picked;
  }

  if (typeof choice === 'object') {
    if (Array.isArray(quirk.optionGroups)) {
      quirk.optionGroups.forEach((group) => take(group?.options, choice[group?.id]));
    } else {
      take(quirk.options, choice.default);
    }
  }
  return picked;
};

/**
 * 金手指「選項」的機械效果（§CF）。
 *
 * 原書有 11 個金手指寫著「選擇一個選項」，但絕大多數是敘事選項（寫下預言、
 * 指定羈絆對象、挑一個聯繫人……）。真正會改數值的只有兩個：
 * 倖存者③「永久 +2 IP」、墮落天使③「最大 MP +10」——那兩筆寫在資料層的
 * `quirks[].options[].effects`，其餘選項根本沒有 `effects` 欄位。
 *
 * 沒選、選了敘事項、或舊存檔沒有 `quirkChoice` → 回空物件（行為與以前相同）。
 * 選了資料裡不存在的 id 也回空物件——不猜、不近似。
 */
export const getQuirkOptionEffects = (char) => {
  const quirk = findQuirkDef(char?.quirk);
  if (!quirk) return {};
  return collectChosenQuirkOptions(quirk, char?.quirkChoice)
    .reduce((acc, opt) => mergeQuirkEffects(acc, opt.effects), {});
};

/**
 * 金手指的**全部**機械效果（§CG）：本體 `effects` ＋ 玩家已選選項的效果。
 *
 * 為什麼要拆 `body` 與 `option`：breakdown 的來源標籤不同
 * （「金手指 倖存者」 vs 「金手指 倖存者 選項」），混在一起玩家就分不出
 * 哪 5 點是金手指本身、哪 2 點是自己選的。
 *
 * 回傳形狀固定（陣列一律給空陣列、數字一律給 0），呼叫端不必逐鍵判斷。
 */
export const getQuirkEffects = (char) => {
  const quirk = findQuirkDef(char?.quirk);
  const empty = {
    body: {},
    option: {},
    resistances: [],
    vulnerabilities: [],
    absorption: [],
    immuneDamage: [],
    immuneStatuses: [],
    defIfNoWeapon: 0,
    mdefIfNoWeapon: 0,
    defIfNoArmor: 0,
    mdefIfNoArmor: 0,
    unarmedDamageBonus: 0,
    unarmedDamageBonusHigh: 0
  };
  if (!quirk) return empty;

  const body = mergeQuirkEffects({}, quirk.effects);
  const option = collectChosenQuirkOptions(quirk, char?.quirkChoice)
    .reduce((acc, opt) => mergeQuirkEffects(acc, opt.effects), {});
  const merged = mergeQuirkEffects(mergeQuirkEffects({}, quirk.effects), option);

  return {
    body,
    option,
    resistances: merged.resistances || [],
    vulnerabilities: merged.vulnerabilities || [],
    absorption: merged.absorption || [],
    immuneDamage: merged.immuneDamage || [],
    immuneStatuses: merged.immuneStatuses || [],
    defIfNoWeapon: merged.defIfNoWeapon || 0,
    mdefIfNoWeapon: merged.mdefIfNoWeapon || 0,
    defIfNoArmor: merged.defIfNoArmor || 0,
    mdefIfNoArmor: merged.mdefIfNoArmor || 0,
    unarmedDamageBonus: merged.unarmedDamageBonus || 0,
    unarmedDamageBonusHigh: merged.unarmedDamageBonusHigh || 0
  };
};

/**
 * 完整計算角色各項衍生數值、狀態減值與裝備聯動
 */
export const calculateCharacterStats = (char) => {
  if (!char) return {};

  // 等級最低就是開卡規則的起始等級（核心規則 p.157：角色從 5 級開始）。
  // 讀規則而不是寫死 5，是為了 GM 日後調整起始等級時，這裡會跟著走。
  const level = Math.max(
    DEFAULT_CREATION_RULES.startingLevel,
    getCharacterLevel(char)
  );
  // 0 = 尚未指派（見 `createNewCharacter`）。**不要**寫成 `|| 8`——那會讓一個
  // 還沒選屬性配置的角色，被當成「萬事通 d8×4」算出六項數值，畫面上看起來
  // 像一個真的角色。0 就讓它是 0，由 `attributesUnset` 告訴介面「還沒有數值」。
  const baseDex = char.attributes?.dex || 0;
  const baseIns = char.attributes?.ins || 0;
  const baseMig = char.attributes?.mig || 0;
  const baseWlp = char.attributes?.wlp || 0;
  // 只要有一項沒指派，六項數值就都還不成立（HP 要 MIG、物防要 DEX…）。
  const attributesUnset = [baseDex, baseIns, baseMig, baseWlp].some((v) => !v);

  // 1. 計算六大異常狀態對屬性骰階的削減
  // 減值一律由 STATUS_AFFLICTIONS.affectedStats 推導（單一資料來源），
  // 同時保留每一項減值的來源名稱，供數值構成公式逐項顯示。
  const aff = char.statusAfflictions || {};
  const affSources = { dex: [], ins: [], mig: [], wlp: [] };

  Object.keys(STATUS_AFFLICTIONS).forEach(key => {
    if (!aff[key]) return;
    (STATUS_AFFLICTIONS[key].affectedStats || []).forEach(attrKey => {
      if (affSources[attrKey]) affSources[attrKey].push(STATUS_AFFLICTIONS[key].name);
    });
  });

  const dexPenalty = affSources.dex.length;
  const insPenalty = affSources.ins.length;
  const migPenalty = affSources.mig.length;
  const wlpPenalty = affSources.wlp.length;

  const currentDex = reduceDieStep(baseDex, dexPenalty);
  const currentIns = reduceDieStep(baseIns, insPenalty);
  const currentMig = reduceDieStep(baseMig, migPenalty);
  const currentWlp = reduceDieStep(baseWlp, wlpPenalty);

  // 2. 計算職業免費加成、技能常駐加成、飾品、英雄技能與金手指 (HP, MP, IP)
  // 每一筆加成同時記錄來源（label / value / kind），供數值構成公式逐項顯示。
  let bonusHp = 0;
  let bonusMp = 0;
  let bonusIp = 0;
  const hpTerms = [];
  const mpTerms = [];
  const ipTerms = [];

  const addHp = (label, value, kind) => { if (value) { bonusHp += value; hpTerms.push({ label, value, kind }); } };
  const addMp = (label, value, kind) => { if (value) { bonusMp += value; mpTerms.push({ label, value, kind }); } };
  const addIp = (label, value, kind) => { if (value) { bonusIp += value; ipTerms.push({ label, value, kind }); } };

  // (0) 魔晶石的創角永久加給（科技奇幻手冊 p.134）
  //
  // 這一筆**不屬於任何職業**，所以不能併進下面的職業免費增益迴圈——職業魔石
  // 本身明文「不提供職業的免費增益」（p.136），把它們混在一起會讓人以為
  // 換掉職業魔石就會失去這 5 點。它只在創角時給一次，之後永久跟著角色。
  // 「僅附魔魔石」變體拿掉這一條（p.138）。
  const creation = resolveCreationRules(char?.creationRules);
  if (modeGrantsInnateBonus(creation.technospheres)) {
    addHp('魔晶石創角加給', 5, 'technosphere');
    addMp('魔晶石創角加給', 5, 'technosphere');
  }

  // (1) 職業免費增益 (Free Benefits) 與職業常駐被動技能
  (char.classes || []).forEach(cl => {
    const classDef = rulesData.classes[cl.className];
    const fb = (classDef?.freeBenefits || '') + ' ' + (classDef?.freeBonus || '');
    const clsLabel = cl.className || '未知職業';

    // 二選一職業判定 (秘儀師【變體】、死靈術士、舞者、祈喚者、植物學家、卡牌大師)
    if (isHpMpChoiceBenefit(fb)) {
      // 未指定時預設以 HP+5 為主（避免兩者同時加 5 點導致多送點數）
      if (cl.chosenBenefit === 'MP') {
        addMp(`${clsLabel} 免費增益（MP）`, 5, 'class');
      } else {
        addHp(`${clsLabel} 免費增益（HP）`, 5, 'class');
      }
    } else {
      if (fb.includes('HP') && fb.includes('5')) addHp(`${clsLabel} 免費增益`, 5, 'class');
      if (fb.includes('MP') && fb.includes('5')) addMp(`${clsLabel} 免費增益`, 5, 'class');
    }
    if (fb.includes('IP') && fb.includes('2')) addIp(`${clsLabel} 免費增益`, 2, 'class');

    // 職業常駐被動技能衍生加成 (不動要塞, 集中)
    const step = clsLabel.includes('Playtest') ? 5 : 3;
    (cl.skills || []).forEach(sk => {
      const skName = sk.name || '';
      const sl = sk.sl || 0;
      if (skName.includes('不動要塞') || skName.toLowerCase().includes('fortress')) {
        addHp(`${clsLabel} ${skName} SL ${sl} × ${step}`, sl * step, 'skill');
      }
      if (skName.includes('集中') || skName.toLowerCase().includes('concentration')) {
        addMp(`${clsLabel} ${skName} SL ${sl} × ${step}`, sl * step, 'skill');
      }
    });
  });

  // (2) 飾品加成：一律讀資料層的 `effects`。
  //
  // 2026-10-22（§CF）之前這裡是「名字 includes 就加固定值」的鬆散匹配，只認得三件自造飾品；
  // 官方 Core p.285–287 的 29 件一件都不認得——連洋蔥戒指（每個不同職業 +2 HP／+2 MP）
  // 根本不在 `accessories` 表裡，玩家連選都選不到。
  // 現在改成資料驅動：`effects` 有什麼就加什麼，新增飾品只要填資料就會動。
  //
  // 精確匹配優先，找不到才退回 `includes`——後者是給「守護護符（自訂）」這種
  // 帶括號後綴的舊存檔用的，不是主要路徑。
  const accName = char.equipment?.accessory || '';
  const accItem = accName
    ? (rulesData.equipment.accessories.find((a) => a.name === accName)
      || rulesData.equipment.accessories.find((a) => accName.includes(a.name)))
    : null;
  const accFx = accItem?.effects || {};
  if (accFx.hp) addHp(`飾品 ${accName}`, accFx.hp, 'equip');
  if (accFx.mp) addMp(`飾品 ${accName}`, accFx.mp, 'equip');
  if (accFx.ip) addIp(`飾品 ${accName}`, accFx.ip, 'equip');
  // 洋蔥戒指：每個**不同**職業 +2 HP／+2 MP。職業清單就在 `char.classes` 裡，
  // 所以這條算得出來，不需要 GM 手動加。
  // 去重前先剝掉公測後綴——`武器大師` 與 `武器大師【變體】` 是同一個職業，不能算兩個。
  if (accFx.hpPerClass || accFx.mpPerClass) {
    const distinctClassCount = new Set(
      (char.classes || [])
        .map((c) => stripClassSuffix(normalizeClassName(c.className)))
        .filter(Boolean)
    ).size;
    if (distinctClassCount > 0) {
      const perClassLabel = `飾品 ${accName} × ${distinctClassCount} 職業`;
      if (accFx.hpPerClass) addHp(perClassLabel, accFx.hpPerClass * distinctClassCount, 'equip');
      if (accFx.mpPerClass) addMp(perClassLabel, accFx.mpPerClass * distinctClassCount, 'equip');
    }
  }

  // (3) 英雄技能常駐加成 (額外HP, 額外MP, 額外IP, 預言守護者的基礎洞察骰面)
  (char.heroicSkills || []).forEach(hs => {
    const hName = typeof hs === 'string' ? hs : (hs?.name || '');
    if (hName.includes('額外HP') || hName.toLowerCase().includes('extra hp')) {
      addHp(`英雄技能 ${hName}`, level >= 40 ? 20 : 10, 'heroic');
    }
    if (hName.includes('額外MP') || hName.toLowerCase().includes('extra mp')) {
      addMp(`英雄技能 ${hName}`, level >= 40 ? 20 : 10, 'heroic');
    }
    if (hName.includes('額外IP') || hName.toLowerCase().includes('extra ip')) {
      addIp(`英雄技能 ${hName}`, 4, 'heroic');
    }
    // Playtest【預言守護者】：最大 HP 永久增加等同於**基礎**洞察骰面大小的數值
    // （官方原文 "your base Insight die size"——用基礎骰，不是當前骰，所以不受狀態減值影響）
    if (hName.includes('預言守護者')) {
      addHp(`英雄技能 ${hName}`, baseIns, 'heroic');
    }
  });

  // (4) 金手指的機械效果（§CG）
  //
  // 一律從資料層讀：本體 `quirks[].effects`，選項 `options`／`optionGroups`。
  // 以前這裡是兩段 `if (quirkName.includes(...))` 的硬編碼，只認得倖存者與
  // 束縛你的約定——46 個金手指裡另外還有 5 個帶明確數值（空手道、亡者歸來、
  // 機器人、墮落天使、會說話的野獸），那些加值全部落空。
  const quirkName = char.quirk || '';
  const quirkFx = getQuirkEffects(char);
  if (quirkFx.body.hp) addHp(`金手指 ${quirkName}`, quirkFx.body.hp, 'quirk');
  if (quirkFx.body.mp) addMp(`金手指 ${quirkName}`, quirkFx.body.mp, 'quirk');
  if (quirkFx.body.ip) addIp(`金手指 ${quirkName}`, quirkFx.body.ip, 'quirk');

  // 玩家選的選項（§CF）：標籤與本體分開，玩家才看得出哪幾點是自己選的。
  if (quirkFx.option.hp) addHp(`金手指 ${quirkName} 選項`, quirkFx.option.hp, 'quirk');
  if (quirkFx.option.mp) addMp(`金手指 ${quirkName} 選項`, quirkFx.option.mp, 'quirk');
  if (quirkFx.option.ip) addIp(`金手指 ${quirkName} 選項`, quirkFx.option.ip, 'quirk');

  // (5) 死靈術士【殘酷的誕生】的僕從代價
  //     官方原文：「減少你自己相當於該 NPC 等級的 HP 和 MP 上限」，
  //     並明說「如果你的僕從被摧毀，你的 HP 和 MP 上限會恢復正常」——
  //     所以這裡只看「現在有沒有活著的僕從」，不是看有沒有拿那個英雄技能。
  const minion = char.necroData?.minion;
  const minionCost = Math.max(0, Math.floor(Number(minion?.npcLevel) || 0));
  if (minion?.active && minionCost > 0) {
    addHp(`僕從代價（${minionCost} 級）`, -minionCost, 'minion');
    addMp(`僕從代價（${minionCost} 級）`, -minionCost, 'minion');
  }

  // 官方規則：最大 HP / MP 基礎計算採用 BASE 力量與意志（不受異常狀態減骰影響）
  const maxHp = baseMig * 5 + level + bonusHp;
  const maxMp = baseWlp * 5 + level + bonusMp;
  const maxIp = 6 + bonusIp;
  const crisisThreshold = Math.floor(maxHp / 2);

  // 3. 裝備防禦與先攻計算
  const normName = (n) => (n || '').replace(/\s*\([^)]*\)/g, '').trim();
  // 回退一律回**具名的中性條目**，不要回「資料表第一筆」——
  // 第一筆剛好是中性值只是運氣，哪天有人把新裝備插到最前面，
  // 所有沒穿防具的角色就會白拿那份加值，而且不會有任何警告。
  const NEUTRAL_ARMOR = '無裝甲 / 冒險服';
  const NEUTRAL_SHIELD = '無盾牌';
  const findByName = (list, name) => list.find((x) => x.name === name) || null;
  const armorDef = rulesData.equipment.armors.find(a => a.name === char.equipment?.armor || a.name === normName(char.equipment?.armor))
    || findByName(rulesData.equipment.armors, NEUTRAL_ARMOR);
  // 雙手武器佔滿兩個手部欄位（Core p.131）→ 副手裝備不生效，回退到中性條目（無盾牌）
  //
  // 主手武器先在官方武器表找，找不到再找**角色自己鍛造的定制武器**（HF p.106）。
  // 定制武器的條目欄位與官方武器完全相同（見 `data/customWeapons.js` 的
  // `buildCustomWeaponEntry`），所以底下所有計算都不用為它開特例。
  const customWeaponEntries = buildCustomWeaponEntries(char);
  const mainHandName = char.equipment?.mainHand;
  const mainHandDef = findByName(rulesData.equipment.weapons, mainHandName)
    || findByName(rulesData.equipment.weapons, normName(mainHandName))
    || customWeaponEntries.find((w) => w.name === mainHandName)
    || null;
  const offHandSuppressed = Number(mainHandDef?.hands) === 2;
  const shieldDef = offHandSuppressed
    ? findByName(rulesData.equipment.shields, NEUTRAL_SHIELD)
    : (rulesData.equipment.shields.find(s => s.name === char.equipment?.offHand || s.name === normName(char.equipment?.offHand))
      || findByName(rulesData.equipment.shields, NEUTRAL_SHIELD));

  let def = currentDex;
  let mdef = currentIns;
  const defTerms = [];
  const mdefTerms = [];
  const initTerms = [];

  // 顯示用的裝備名稱：優先採用角色實際填寫的字串，其次才是資料表名稱
  const armorLabel = char.equipment?.armor || armorDef?.name || '';
  const shieldLabel = char.equipment?.offHand || shieldDef?.name || '';

  // 先攻變體（公測材料 2026-10-01 p.34）：判定與側寫只在 `data/initiativeVariant.js` 一處，
  // 這裡只負責「拿側寫來套公式」——與 `equipmentRules.computeArmorOutcome` 共用同一份判定，
  // 才不會出現角色卡與裝備挑選視窗各算一份的分歧。
  const initiativeVariant = isInitiativeVariant(char);
  const armorProfile = getArmorProfile(armorDef, initiativeVariant);

  // 防具防禦公式 (輕甲使用當前靈巧，重甲使用固定數值)
  if (armorDef && armorProfile) {
    if (armorProfile.defFormula === 'dex') {
      def = currentDex;
      defTerms.push({ label: `當前${ATTRIBUTE_NAMES.dex} d${currentDex}`, value: currentDex, kind: 'base' });
    } else if (armorProfile.defFormula === 'dex+1') {
      def = currentDex + 1;
      defTerms.push({ label: `當前${ATTRIBUTE_NAMES.dex} d${currentDex}`, value: currentDex, kind: 'base' });
      defTerms.push({ label: `${armorLabel} ${ATTRIBUTE_NAMES.dex} + 1`, value: 1, kind: 'equip' });
    } else if (armorProfile.defFormula === 'dex+2') {
      def = currentDex + 2;
      defTerms.push({ label: `當前${ATTRIBUTE_NAMES.dex} d${currentDex}`, value: currentDex, kind: 'base' });
      defTerms.push({ label: `${armorLabel} ${ATTRIBUTE_NAMES.dex} + 2`, value: 2, kind: 'equip' });
    } else if (!isNaN(parseInt(armorProfile.defFormula, 10))) {
      const fixedDef = parseInt(armorProfile.defFormula, 10);
      def = fixedDef;
      defTerms.push({ label: `${armorLabel} 固定值 ${fixedDef}`, value: fixedDef, kind: 'equip' });
    }

    if (armorProfile.mdefFormula === 'ins') {
      mdef = currentIns;
      mdefTerms.push({ label: `當前洞察 d${currentIns}`, value: currentIns, kind: 'base' });
    } else if (armorProfile.mdefFormula === 'ins+1') {
      mdef = currentIns + 1;
      mdefTerms.push({ label: `當前洞察 d${currentIns}`, value: currentIns, kind: 'base' });
      mdefTerms.push({ label: `${armorLabel} 洞察 + 1`, value: 1, kind: 'equip' });
    } else if (armorProfile.mdefFormula === 'ins+2') {
      mdef = currentIns + 2;
      mdefTerms.push({ label: `當前洞察 d${currentIns}`, value: currentIns, kind: 'base' });
      mdefTerms.push({ label: `${armorLabel} 洞察 + 2`, value: 2, kind: 'equip' });
    } else if (!isNaN(parseInt(armorProfile.mdefFormula, 10))) {
      const fixedMdef = parseInt(armorProfile.mdefFormula, 10);
      mdef = fixedMdef;
      mdefTerms.push({ label: `${armorLabel} 固定值 ${fixedMdef}`, value: fixedMdef, kind: 'equip' });
    }
  }

  // 資料缺漏或公式無法辨識時，仍以「當前屬性骰」作為基準項顯示
  if (defTerms.length === 0) defTerms.push({ label: `當前${ATTRIBUTE_NAMES.dex} d${currentDex}`, value: currentDex, kind: 'base' });
  if (mdefTerms.length === 0) mdefTerms.push({ label: `當前洞察 d${currentIns}`, value: currentIns, kind: 'base' });

  // 盾牌防禦加值
  if (shieldDef) {
    const shieldDefBonus = shieldDef.defBonus || 0;
    const shieldMdefBonus = shieldDef.mdefBonus || 0;
    def += shieldDefBonus;
    mdef += shieldMdefBonus;
    if (shieldDefBonus) defTerms.push({ label: `${shieldLabel} 物防 +${shieldDefBonus}`, value: shieldDefBonus, kind: 'equip' });
    if (shieldMdefBonus) mdefTerms.push({ label: `${shieldLabel} 魔防 +${shieldMdefBonus}`, value: shieldMdefBonus, kind: 'equip' });
  }

  // 定制武器的【物防提升】與【魔防提升】（HF p.107）。
  // 這兩項是「持有者獲得加值」，不是武器本身的數值，所以算在這裡而不是武器條目裡。
  // `countsAsShield` 另外回報給技能判定——原書明講它會被視為裝備著一面盾牌。
  const mainHandWeapon = mainHandDef;
  const countsAsShield = Boolean(mainHandWeapon?.countsAsShield);
  if (mainHandWeapon?.defBoost) {
    def += mainHandWeapon.defBoost;
    defTerms.push({ label: `${mainHandWeapon.name} 物防提升 +${mainHandWeapon.defBoost}`, value: mainHandWeapon.defBoost, kind: 'equip' });
  }
  if (mainHandWeapon?.mdefBoost) {
    mdef += mainHandWeapon.mdefBoost;
    mdefTerms.push({ label: `${mainHandWeapon.name} 魔防提升 +${mainHandWeapon.mdefBoost}`, value: mainHandWeapon.mdefBoost, kind: 'equip' });
  }

  // 飾品的固定物防／魔防加值（Core p.286 的魔導戒指）。
  // 排在這一行是因為下面那段「機師載具搭乘防禦覆蓋」會把 `defTerms`／`mdefTerms`
  // 整份清掉——坐在載具上時飾品不生效，與防具、盾牌一致。
  if (accFx.def) {
    def += accFx.def;
    defTerms.push({ label: `飾品 ${accName} 物防 +${accFx.def}`, value: accFx.def, kind: 'equip' });
  }
  if (accFx.mdef) {
    mdef += accFx.mdef;
    mdefTerms.push({ label: `飾品 ${accName} 魔防 +${accFx.mdef}`, value: accFx.mdef, kind: 'equip' });
  }

  // 金手指的條件式防禦加值（§CG）：
  // ・空手道：沒有裝備武器和盾牌時，物防 +1／魔防 +1
  // ・會說話的野獸：防具欄為空時，物防 +2／魔防 +2
  // 兩者都算在「搭載具」之前——坐在載具上時一律改用載具的數值（與飾品一致）。
  //
  // 「空手」的判定有兩個坑：
  // ① 主手要先查是不是盾牌——`mainHandDef` 查的是**武器表**，主手放盾牌時它也是
  //    null，只看它會把雙盾誤判成空手。
  // ② **`徒手打擊` 是武器表裡的一筆**（`category: 鬥毆`、`cost: 0`、`hands: 1`），
  //    而開卡預設的 `mainHand` 正是它（見 `createNewCharacter`）。所以
  //    `!mainHandDef` 對「真的空手」是 false——空手道在**每個**新角身上都不生效。
  //    這裡改成「查不到 或 查到的是徒手打擊」才算空手。
  const UNARMED_ENTRY = '徒手打擊';
  const mainIsShieldNow = rulesData.equipment.shields
    .some((s) => s.name === char.equipment?.mainHand || s.name === normName(char.equipment?.mainHand));
  const mainIsUnarmed = !mainHandDef || mainHandDef.name === UNARMED_ENTRY;
  const offIsUnarmed = !shieldDef || shieldDef.name === NEUTRAL_SHIELD
    || shieldDef.name === UNARMED_ENTRY;
  const handsEmpty = mainIsUnarmed && offIsUnarmed && !mainIsShieldNow;
  const armorEmpty = armorDef?.name === NEUTRAL_ARMOR;
  const quirkDefBonus = (handsEmpty ? quirkFx.defIfNoWeapon : 0) + (armorEmpty ? quirkFx.defIfNoArmor : 0);
  const quirkMdefBonus = (handsEmpty ? quirkFx.mdefIfNoWeapon : 0) + (armorEmpty ? quirkFx.mdefIfNoArmor : 0);
  if (quirkDefBonus) {
    def += quirkDefBonus;
    defTerms.push({ label: `金手指 ${quirkName} 物防 +${quirkDefBonus}`, value: quirkDefBonus, kind: 'quirk' });
  }
  if (quirkMdefBonus) {
    mdef += quirkMdefBonus;
    mdefTerms.push({ label: `金手指 ${quirkName} 魔防 +${quirkMdefBonus}`, value: quirkMdefBonus, kind: 'quirk' });
  }

  // 機師載具搭乘防禦覆蓋 (Techno Fantasy Atlas p. 161)
  if (char.pilotVehicle?.isMounted) {
    const activeMods = char.pilotVehicle?.activeModules || [];
    const plating = PILOT_ARMOR_MODULES.find(m => activeMods.includes(m.id));
    if (plating) {
      defTerms.length = 0;
      mdefTerms.length = 0;
      if (plating.id === 'flexible_plating') {
        def = currentDex + 2;
        mdef = currentIns + 1;
        defTerms.push({ label: `當前${ATTRIBUTE_NAMES.dex} d${currentDex}`, value: currentDex, kind: 'base' });
        defTerms.push({ label: `載具 ${plating.name} + 2`, value: 2, kind: 'equip' });
        mdefTerms.push({ label: `當前洞察 d${currentIns}`, value: currentIns, kind: 'base' });
        mdefTerms.push({ label: `載具 ${plating.name} + 1`, value: 1, kind: 'equip' });
      } else {
        def = plating.def;
        mdef = plating.mdef;
        defTerms.push({ label: `載具 ${plating.name} 固定值 ${plating.def}`, value: plating.def, kind: 'equip' });
        mdefTerms.push({ label: `載具 ${plating.name} 固定值 ${plating.mdef}`, value: plating.mdef, kind: 'equip' });
      }
    }
    // 載具盾牌模組加值 (每個提供 DEF+2, M.DEF+2)
    const shieldModuleCount = activeMods.filter(id => id === 'shield_module').length;
    if (shieldModuleCount > 0) {
      def += shieldModuleCount * 2;
      mdef += shieldModuleCount * 2;
      defTerms.push({ label: `載具 盾牌模組 × ${shieldModuleCount}`, value: shieldModuleCount * 2, kind: 'equip' });
      mdefTerms.push({ label: `載具 盾牌模組 × ${shieldModuleCount}`, value: shieldModuleCount * 2, kind: 'equip' });
    }
  }

  // 先攻修正
  let init = 0;
  if (initiativeVariant) {
    // 先攻變體：先攻值**不存在**。原文說「影響先攻的規則與效果一律忽略，不要換成別的加值」，
    // 所以防具減值、盾牌、飾品加值全部不算，明細也不留——只留一列說明這格為什麼是 0。
    initTerms.push({ label: initiativeVariantTermLabel(), value: '—', kind: 'base' });
  } else {
    if (armorProfile?.initMod) {
      init += armorProfile.initMod;
      initTerms.push({ label: `${armorLabel} 先攻 ${armorProfile.initMod > 0 ? '+' : ''}${armorProfile.initMod}`, value: armorProfile.initMod, kind: 'equip' });
    }
    if (shieldDef?.initMod) {
      init += shieldDef.initMod;
      initTerms.push({ label: `${shieldLabel} 先攻 ${shieldDef.initMod > 0 ? '+' : ''}${shieldDef.initMod}`, value: shieldDef.initMod, kind: 'equip' });
    }
    // 飾品先攻加值同樣讀 `effects.init`（Core p.285 的探險家腰帶 +4、自訂示例的風行長靴 +2）。
    // 先攻變體下整格不存在，所以這段留在 else 分支裡——原文要求「不要換成別的加值」。
    if (accFx.init) {
      init += accFx.init;
      initTerms.push({ label: `飾品 ${accName} 先攻 ${accFx.init > 0 ? '+' : ''}${accFx.init}`, value: accFx.init, kind: 'equip' });
    }
  }

  // 4. 熟練度比對
  const profs = getProficiencies(char);
  // 「這件裝備穿不穿得上」不再由 stats 自己算一份：一律交給 equipmentRules 的
  // `buildLoadoutIssues`（validateCharacter 與編輯器的提示框共用同一份判定）。
  
  // 5. 職業精通狀況 (Mastery: 單一職業達到 10 級)
  const masteredClasses = (char.classes || []).filter(cl => cl.level >= 10).map(cl => cl.className);
  const totalSkillLevels = (char.classes || []).reduce((sum, cl) => sum + (cl.skills || []).reduce((sSum, sk) => sSum + sk.sl, 0), 0);

  // 5-b. 職業魔石提供的技能（科技奇幻手冊 p.136）
  //
  // 魔石技能**不屬於任何職業**，所以它們不在 `char.classes[].skills` 裡，
  // 以前也就完全不會出現在角色卡的技能清單上——玩家裝了三顆魔石，
  // 卡面上一點效果都看不到。這裡把「生效中的魔石技能」攤平，
  // 由顯示層自己決定怎麼併進技能池（角色卡、跑團卡、匯出共用這一份）。
  //
  // 「生效」＝ 魔石裝在**實際裝備著**的物品槽裡（`getActiveMnemospheres`）。
  // 沒裝備的魔石不提供任何技能，所以這裡的 `equippedSlots` 是必要條件。
  const technoEnabled = isTechnosphereEnabled(creation.technospheres);
  const equippedSlotIds = getEquippedTechnosphereSlotIds(char);
  const activeMnemospheres = technoEnabled
    ? getActiveMnemospheres(char.technospheres, { equippedSlots: equippedSlotIds })
    : [];
  const mnemosphereSkills = getMnemosphereSkills(activeMnemospheres);
  const mnemosphereSkillLevels = mnemosphereSkills.reduce((sum, sk) => sum + sk.sl, 0);
  // 「技能水準相當於幾級角色」——原書 p.134 的例子就是這個數字（角色等級 ＋ 魔石等級）。
  const skillLevelCeiling = technoEnabled
    ? getSkillLevelCeiling(level, activeMnemospheres)
    : level;
  // 同一條公式，但用**持有的**魔石算——給建角第 2 步的預覽用。
  //
  // 為什麼要有兩個數字：p.134 的升級點是投給「固有職業或魔石」（成長），
  // p.136 的生效條件是「裝備著」（生效）。第 2 步玩家在投點，那時魔石通常還沒裝，
  // 所以它需要「若裝上，技能水準相當於幾級」；而引擎算實際技能時仍然只認已裝備的。
  // 兩個數字都輸出，讓呼叫端自己挑——**不要讓預覽去覆蓋實際值**。
  const heldMnemospheres = technoEnabled ? getHeldMnemospheres(char.technospheres) : [];
  const heldSkillLevelCeiling = technoEnabled
    ? getSkillLevelCeiling(level, heldMnemospheres)
    : level;

  // 6. 數值構成公式（逐項分解，供角色卡／跑團卡點擊展開顯示）
  // 每一項為 { label, value, kind }；kind 供面板分色：
  // base 基礎骰 / level 等級 / class 職業免費增益 / skill 特技 / equip 裝備飾品 / heroic 英雄技能 / quirk 金手指 / status 狀態異常
  const attrBreakdown = (base, current, penalty, sources) => ({
    total: current,
    terms: [
      { label: `基礎骰 d${base}`, value: `d${base}`, kind: 'base' },
      ...(penalty > 0
        ? [{ label: `狀態 ${sources.join('、')} 降 ${penalty} 階`, value: `d${current}`, kind: 'status' }]
        : [])
    ]
  });

  const breakdown = {
    hp: {
      total: maxHp,
      terms: [
        { label: `基礎${ATTRIBUTE_NAMES.mig} d${baseMig} × 5`, value: baseMig * 5, kind: 'base' },
        { label: `角色等級 Lv ${level}`, value: level, kind: 'level' },
        ...hpTerms
      ]
    },
    mp: {
      total: maxMp,
      terms: [
        { label: `基礎意志 d${baseWlp} × 5`, value: baseWlp * 5, kind: 'base' },
        { label: `角色等級 Lv ${level}`, value: level, kind: 'level' },
        ...mpTerms
      ]
    },
    ip: {
      total: maxIp,
      terms: [
        { label: '基礎值 6', value: 6, kind: 'base' },
        ...ipTerms
      ]
    },
    crisis: {
      total: crisisThreshold,
      terms: [
        { label: '最大生命值', value: maxHp, kind: 'base' },
        { label: '除以 2，向下取整', value: '÷ 2', kind: 'base' }
      ]
    },
    def: { total: def, terms: defTerms },
    mdef: { total: mdef, terms: mdefTerms },
    init: { total: init, terms: initTerms },
    attributes: {
      dex: attrBreakdown(baseDex, currentDex, dexPenalty, affSources.dex),
      ins: attrBreakdown(baseIns, currentIns, insPenalty, affSources.ins),
      mig: attrBreakdown(baseMig, currentMig, migPenalty, affSources.mig),
      wlp: attrBreakdown(baseWlp, currentWlp, wlpPenalty, affSources.wlp)
    }
  };

  return {
    maxHp,
    maxMp,
    maxIp,
    crisisThreshold,
    // 金手指的相性與免疫（§CG）。這些不是加減值，而是戰鬥時的判定依據，
    // 所以放在 stats 最外層而不是 breakdown：`immuneDamage` 是「傷害免疫」，
    // 與飾品的 `resistance`（抗性，傷害減半）是不同機制，不可混用。
    quirkEffects: {
      resistances: quirkFx.resistances,
      vulnerabilities: quirkFx.vulnerabilities,
      absorption: quirkFx.absorption,
      immuneDamage: quirkFx.immuneDamage,
      immuneStatuses: quirkFx.immuneStatuses,
      unarmedDamageBonus: (getCharacterLevel(char) >= 30 && quirkFx.unarmedDamageBonusHigh)
        ? quirkFx.unarmedDamageBonusHigh
        : quirkFx.unarmedDamageBonus
    },
    def,
    mdef,
    init,
    // true = 四維還沒指派完，六項數值不成立。介面據此顯示「未設定」而不是假數字。
    attributesUnset,
    bonusHp,
    bonusMp,
    bonusIp,
    baseDex,
    baseIns,
    baseMig,
    baseWlp,
    currentDex,
    currentIns,
    currentMig,
    currentWlp,
    dexPenalty,
    insPenalty,
    migPenalty,
    wlpPenalty,
    profs,
    masteredClasses,
    totalSkillLevels,
    // 職業魔石（科技奇幻手冊 p.136）：生效中的魔石、它們提供的技能，
    // 以及「技能水準相當於幾級角色」。未啟用魔晶石制時三者都是中性值。
    activeMnemospheres,
    mnemosphereSkills,
    mnemosphereSkillLevels,
    skillLevelCeiling,
    // 持有（不論裝沒裝）——建角第 2 步「職業與技能」的預覽用。
    // `heldSkillLevelCeiling` 是「若把持有的魔石全裝上，技能水準相當於幾級」，
    // 與上面的 `skillLevelCeiling`（實際生效值）**不可互換**。
    heldMnemospheres,
    heldSkillLevelCeiling,
    breakdown,
    // 定制武器的【物防提升】＝「在技能判定上視為裝備著一面盾牌」（HF p.107）。
    // 消費端（防守掌握／閃避等技能）讀這個旗標，不必自己去翻武器規格。
    countsAsShield,
    mainHandWeapon,
    // 標準規則下「技能等級總和 ＝ 角色等級」是恆等式（每升一級投一點）。
    // 魔晶石制打破它：升級可以把那一點投進**職業魔石**而不是固有職業（p.134），
    // 於是角色等級會跑在固有職業的技能總和前面。所以這裡改成「不得超過」，
    // 由驗證層另外把「還差幾點沒投」講出來——用等號會讓每一張合法的
    // 魔晶石角色一升級就被判定成不一致。
    isLevelMatched: isTechnosphereEnabled(creation.technospheres)
      ? totalSkillLevels <= level
      : totalSkillLevels === level
  };
};

/**
 * 經驗值成長與升級邏輯 (10 EXP = 1 Level)
 */
/**
 * 單一職業的等級上限（Core p.228）：
 * 「You can never have more than ten levels in a Class. Once you put the tenth level
 * in a Class, that Class has been mastered ... and you can no longer invest levels into it.」
 */
export const CLASS_MAX_LEVEL = 10;

/**
 * 同時擁有的**未精通**職業上限（Core p.228）：
 * 「You can never have more than three non-mastered Classes. If you want to further
 * diversify your character, you must first master some of the Classes you acquired.」
 *
 * 注意這與建角規則的 `classCountMax` **不是同一件事**——那是「開局選幾個職業」（2–3），
 * 這是「升級時最多幾個還沒精通」。精通一個（10 級）之後，就能再開一個新的。
 */
export const MAX_NON_MASTERED_CLASSES = 3;

/**
 * 升級下拉裡「新職業」選項的值前綴（Core p.228：「you gain your first level in a
 * Class you didn't already have」——這是升級的第二條路，和「投給既有職業」共用
 * 同一個下拉，靠前綴區分）。
 */
export const LEVEL_UP_NEW_CLASS_PREFIX = '__new__:';

/**
 * 把升級下拉的值拆成「是不是新職業 + 職業名」。
 *
 * **為什麼抽成純函式而不是寫在元件裡**：`HUD_SRC.includes('...')` 這種原始碼字串
 * 斷言只能證明「接上去了」，證明不了「拆對了」。2026-10-22 的刻意破壞驗證裡，把
 * `slice(PREFIX.length)` 改成 `slice(0)` 之後，字串斷言**照樣全綠**——前綴原封不動
 * 留在職業名裡，技能表會是空的，而測試一聲不吭。抽出來之後才有真值可以斷言。
 */
export const parseLevelUpClassValue = (value = '') => {
  const raw = typeof value === 'string' ? value : '';
  const isNew = raw.startsWith(LEVEL_UP_NEW_CLASS_PREFIX);
  return {
    isNew,
    className: isNew ? raw.slice(LEVEL_UP_NEW_CLASS_PREFIX.length) : raw
  };
};

/**
 * 升級時投的那一點，`skillName` 是不是那個職業的技能。
 *
 * **為什麼要問**：`applyLevelUp` 以前是「找不到就 push」——傳什麼都收。實測（2026-10-22）
 * 連測試自己都在傳不存在的技能名（`博學士` 的技能表裡沒有「萬能知識」、`舞者` 沒有「舞步」），
 * 而引擎一聲不吭地把它們寫進技能表。那筆技能會計入 `totalSkillLevels`，讓技能點預算莫名
 * 超支，卡片上還會出現一個職業表查無此技能的條目。
 *
 * 回傳 `{ ok, maxSL, reason }`。抽成純函式是為了能斷言**為什麼**被擋——
 * `applyLevelUp` 只回傳角色，「擋掉」與「本來就沒升級」從外面看長得一模一樣。
 *
 * `technosphereMode`（§CF）：魔晶石制下被原書作廢的技能（p.133 的【雙重盾牌】）
 * 一律回 `not-in-class`——它不在「可投」的技能表裡。不傳時行為不變。
 */
export const resolveLevelUpSkill = (className, skillName, technosphereMode = null) => {
  const wanted = typeof skillName === 'string' ? skillName.trim() : '';
  if (!wanted) return { ok: false, reason: 'empty', maxSL: 0 };
  const hit = classSkillsForClass(className, technosphereMode).find((sk) => sk.name === wanted);
  if (!hit) return { ok: false, reason: 'not-in-class', maxSL: 0 };
  return { ok: true, reason: null, maxSL: hit.maxSL, name: hit.name };
};

export const canLevelUp = (char) => {
  return (char.exp || 0) >= 10 && getCharacterLevel(char) < 50;
};

export const applyLevelUp = (char, { className, skillName, isNewClass = false, mnemosphereId = null }) => {
  if (!canLevelUp(char)) return char;

  const creation = resolveCreationRules(char?.creationRules);
  const techOn = isTechnosphereEnabled(creation.technospheres);

  // ── 魔晶石制：把這一點投進**職業魔石**（科技奇幻手冊 p.134）──────────
  //
  // 這條路徑不碰 `char.classes`：那一點沒有進固有職業，而是讓某顆魔石升級。
  // 角色等級照樣 +1（角色等級是獨立的計數器），所以升級後「職業技能總和」
  // 會小於角色等級——那是合法的，`isLevelMatched` 已改為「不得超過」。
  if (techOn && mnemosphereId) {
    const state = normalizeTechnosphereState(char.technospheres);
    const target = state.mnemospheres.find((m) => m.id === mnemosphereId);
    // 找不到、或那顆魔石已經 5 級（p.136 的上限）→ 什麼都不要動，EXP 不能被扣。
    if (!target || target.level >= MNEMOSPHERE_MAX_LEVEL) return char;

    // 魔石給的是**它自己那個職業**的技能（p.136「that mnemosphere develops a new Skill of
    // the corresponding Class」），所以驗證要用 `target.className`，不是呼叫端傳進來的
    // `className`——HUD 的魔石分支只傳 `mnemosphereId`，`className` 根本是 undefined。
    const verdict = resolveLevelUpSkill(target.className, skillName, creation.technospheres);
    if (!verdict.ok) return char;
    const existing = (target.skills || []).find((s) => s.name === verdict.name);
    // 技能 SL 已達該技能的 `maxSL`（原書每個技能的 SL 上限不同）→ 這一點無處可投。
    if (existing && existing.sl >= verdict.maxSL) return char;

    const mnemospheres = state.mnemospheres.map((m) => {
      if (m.id !== mnemosphereId) return m;
      const skills = (m.skills || []).map((s) => ({ ...s }));
      const hit = skills.find((s) => s.name === verdict.name);
      if (hit) hit.sl += 1;
      else skills.push({ name: verdict.name, sl: 1 });
      return { ...m, level: m.level + 1, skills };
    });

    const oldStats = calculateCharacterStats(char);
    const curHp = char.currentHp ?? oldStats.maxHp;
    const curMp = char.currentMp ?? oldStats.maxMp;
    return {
      ...char,
      technospheres: { ...state, mnemospheres },
      level: getCharacterLevel(char) + 1,
      exp: (char.exp || 0) - 10,
      currentHp: curHp + 1,
      currentMp: curMp + 1,
      updatedAt: new Date().toISOString()
    };
  }

  // 魔晶石制**不得取得新職業**——原書寫得很硬：「cannot acquire new Classes,
  // not even after mastering all three Innate Classes」（p.134）。
  // 所以就算三個固有職業都 5 級了，也只剩「繼續投固有職業」與「投魔石」兩條路。
  if (techOn && isNewClass) return char;

  // ── 新增職業的兩個前提（Core p.228）──────────────────────────────
  //
  // ① 「未精通的職業不得超過三個」。這是**升級時**的限制，與建角規則的
  //    `classCountMax`（開局選 2–3 個）不是同一件事：精通一個 10 級職業之後，
  //    就能再開一個新的。
  // ② 已經有的職業不能當「新職業」——那會 push 出兩筆同名條目，
  //    `getCharacterLevel` 的總和與 `masteredClasses` 都會跟著壞。
  if (isNewClass) {
    const owned = (char.classes || []).some((c) => c.className === className);
    const nonMastered = (char.classes || []).filter((c) => (c.level || 0) < CLASS_MAX_LEVEL).length;
    if (owned || nonMastered >= MAX_NON_MASTERED_CLASSES) return char;
    // 新職業的第一個技能也要屬於那個職業——否則會造出一個技能表整張對不上的職業，
    // 而且它照樣佔掉一個「未精通職業」的名額。
    if (!resolveLevelUpSkill(className, skillName, creation.technospheres).ok) return char;
  }

  let updatedClasses = JSON.parse(JSON.stringify(char.classes || []));

  if (isNewClass) {
    updatedClasses.push({
      className,
      level: 1,
      skills: [{ name: skillName, sl: 1 }]
    });
  } else {
    const targetClass = updatedClasses.find(c => c.className === className);
    // 找不到那個職業就**什麼都不要動**：EXP 不能被扣掉。
    // 原本的寫法是「扣 EXP、角色等級 +1」照樣執行，但職業與技能都沒動——
    // 結果是玩家少了 10 點經驗值、等級數字 +1，卻沒有學到任何東西（實測確認）。
    if (!targetClass) return char;
    // 精通（10 級）之後不能再投——原書：「you can no longer invest levels into it」。
    if (targetClass.level >= CLASS_MAX_LEVEL) return char;
    // 技能必須屬於這個職業，且不得超過它自己的 SL 上限。以前這裡是「找不到就 push」，
    // 所以任何字串都會被寫進技能表（§CE 的實測：連測試都在傳不存在的技能名）。
    const verdict = resolveLevelUpSkill(className, skillName, creation.technospheres);
    if (!verdict.ok) return char;
    const targetSkill = targetClass.skills.find(s => s.name === verdict.name);
    if (targetSkill && targetSkill.sl >= verdict.maxSL) return char;
    targetClass.level += 1;
    if (targetSkill) {
      targetSkill.sl += 1;
    } else {
      targetClass.skills.push({ name: verdict.name, sl: 1 });
    }
  }

  // 升級連帶同步當前 HP 與 MP（若在滿值狀態）
  const oldStats = calculateCharacterStats(char);
  const curHp = char.currentHp ?? oldStats.maxHp;
  const curMp = char.currentMp ?? oldStats.maxMp;

  const leveled = { ...char, classes: updatedClasses };
  return {
    ...leveled,
    // 等級與職業一起 +1（兩者本來就該同步；對不上時由 validateCharacter 提醒）
    level: getCharacterLevel(char) + 1,
    exp: (char.exp || 0) - 10,
    currentHp: curHp + 1,
    currentMp: curMp + 1,
    updatedAt: new Date().toISOString()
  };
};

/**
 * 創角完整度校驗器 (Validation Checklist)
 * 不阻斷操作，提供即時提醒與跳轉定位
 *
 * 驗證的「標準」來自開卡規則（`data/creationRules.js`）——
 * 預設是官方核心規則，GM 自訂開局時傳入不同的規則即可，
 * 不必改這支函式。訊息一律引用規則裡的數值，不寫死。
 */
export const validateCharacter = (char, rules = null) => {
  // **規則存在角色身上**（`char.creationRules`，見 `CreationRulesPanel` 的說明）。
  // 明確傳入的 `rules` 優先——測試與未來的 GM 需求匯入會用到；不傳就用這張卡自己的。
  // 舊存檔沒有該欄位 → `resolveCreationRules(undefined)` 補成官方標準，行為與以前相同。
  const creation = resolveCreationRules(rules ?? char?.creationRules);
  const warnings = [];
  const stats = calculateCharacterStats(char);

  // 步驟 1: 基礎身世（身分／主題／故鄉）。
  //
  // 姓名**不在這裡**——原書第 8 步（p.154）把它與稱呼、外貌描述一起放在最後，
  // 理由是「先掌握了角色的外貌與能力，取名就容易多了」（p.170）。見步驟 6。
  if (!char.identity || !char.identity.trim()) {
    warnings.push({ step: 1, field: 'identity', type: 'info', message: '尚未設定身份' });
  }
  if (!char.theme) {
    warnings.push({ step: 1, field: 'theme', type: 'info', message: '尚未選擇個人主題' });
  }
  if (!char.origin || !char.origin.trim()) {
    warnings.push({ step: 1, field: 'origin', type: 'info', message: '尚未填寫故鄉' });
  }

  // 步驟 2 前置: 手冊拓展不得超出這一團開放的上限（GM 自訂開局）
  // ※ 公測修訂**不算手冊**（2026-10-19，§BE）：它由 `allowPlaytest` 控制，
  //   舊角色身上殘留的 `playtest` 不該被這裡判成「超出上限」。
  const booksOutOfRange = (char.enabledSourcebooks || [])
    .filter((key) => key !== PLAYTEST_SOURCEBOOK_KEY)
    .filter((key) => !creation.allowedSourcebooks.includes(key));
  if (booksOutOfRange.length > 0) {
    warnings.push({
      step: 2,
      field: 'enabledSourcebooks',
      type: 'error',
      message: `此團未開放：${booksOutOfRange.join('、')}，請在職業分頁關閉`
    });
  }

  // 步驟 3: 四維屬性（起始總點數由開卡規則決定）
  //
  // 為什麼屬性排在職業之後：原書的順序是先選職業（第 4 步）再分配屬性（第 5 步），
  // 而且 p.162 明說「當分配屬性骰子時，你應該考慮到你的職業和技能選擇！」。
  // 舊版把屬性放在第 2 步，玩家得在還不知道職業會給什麼免費增益時就決定四維。
  // 四維屬性：0 = 尚未指派（`createNewCharacter` 的預設）。分成三種狀態處理，
  // 因為它們的「怎麼了」不一樣，訊息也該不一樣：
  //   ① 四項全空 → 還沒開始（info，不是玩家的錯）
  //   ② 部分空   → 做到一半（warning）
  //   ③ 都指派了 → 才檢查總和與單顆骰階（原書 p.162）
  const unassigned = ATTRIBUTE_KEYS.filter((key) => !char.attributes?.[key]);
  if (unassigned.length === ATTRIBUTE_KEYS.length) {
    warnings.push({ step: 3, field: 'attributes', type: 'info', message: '尚未選擇四維屬性配置' });
  } else if (unassigned.length > 0) {
    warnings.push({
      step: 3,
      field: 'attributes',
      type: 'warning',
      message: `四維屬性還有 ${unassigned.length} 項未指派（${unassigned.map((k) => ATTRIBUTE_NAMES[k]).join('、')}）`
    });
  } else {
    // 官方規則（印刷 p.162）是「從三組固定陣列挑一組」，**不是「總和 32」**；
    // 而 20／40 級各可再把一顆**基礎**骰 +1 階（p.229）。所以合法組合＝
    // 「某組陣列 ＋ 不超過 allowed 次 +1 階」。
    // 舊版驗總和，於是照規則在 20 級升級（d10→d12，總和 32→34）反而會被噴警告。
    const upgradesAllowed = attributeDieUpgradesAllowed(char.level);
    const upgradesUsed = attributeDieUpgradesUsed(char.attributes);
    const reach = attributeDiceReachable(char.attributes, upgradesAllowed);
    if (upgradesUsed !== null && upgradesUsed > upgradesAllowed) {
      warnings.push({
        step: 3,
        field: 'attributes',
        type: 'warning',
        message: `屬性骰已升級 ${upgradesUsed} 次，但 ${char.level} 級只給 ${upgradesAllowed} 次`
          + '（20 級與 40 級各一次，原書 p.229）'
      });
    } else if (!reach.ok) {
      warnings.push({
        step: 3,
        field: 'attributes',
        type: 'warning',
        message: `屬性骰不是官方三組起始陣列推得出來的組合（官方：${reach.reason}）`
      });
    } else if (upgradesUsed < upgradesAllowed) {
      // 「提示」而非「違規」——晚點再選也可以，所以是 info，不影響定稿
      warnings.push({
        step: 3,
        field: 'attributes',
        type: 'info',
        message: `已達 ${char.level} 級：可以選一顆屬性骰 +1 階（上限 d12），還剩 `
          + `${upgradesAllowed - upgradesUsed} 次`
      });
    }

    // 單顆骰階必須落在 d6~d12（原書 p.162「從最小 d6 到最大 d12」）。
    // UI 的步進器本來就有界，但 Fultimator 匯入與手改存檔可以繞過——那是 **error**：
    // d20 不是合法的角色，而 `calculateCharacterStats` 會照樣把它算成 DEF 20。
    const offLadder = ATTRIBUTE_KEYS.filter((key) => !ATTRIBUTE_DICE_TIERS.includes(char.attributes[key]));
    if (offLadder.length > 0) {
      warnings.push({
        step: 3,
        field: 'attributes',
        type: 'error',
        message: `屬性骰階必須是 ${ATTRIBUTE_DICE_TIERS.map((d) => `d${d}`).join('／')}：`
          + offLadder.map((key) => `${key.toUpperCase()} 為 d${char.attributes[key]}`).join('、')
      });
    }
  }

  // 步驟 2: 職業與特技（起始等級的職業數限制由開卡規則決定）
  const classCount = (char.classes || []).length;
  if (char.level === creation.startingLevel) {
    if (classCount === 0) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `尚未選擇任何職業 (起始 ${creation.startingLevel} 級需配置 ${creation.classCountMin}~${creation.classCountMax} 個職業)`
      });
    } else if (classCount < creation.classCountMin) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `起始需至少 ${creation.classCountMin} 個職業，目前只有 ${classCount} 個 (不可純單職)`
      });
    } else if (classCount > creation.classCountMax) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `起始不可超過 ${creation.classCountMax} 個職業，目前有 ${classCount} 個`
      });
    }

    // GM 指定的必修職業（開卡規則 requiredClasses）
    const missingRequired = creation.requiredClasses
      .filter((name) => !(char.classes || []).some((cl) => cl.className === name));
    if (missingRequired.length > 0) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `此團規定必須修習：${missingRequired.join('、')}`
      });
    }
  }

  // 魔晶石制的固有職業（科技奇幻手冊 p.134）：**恰好三個，而且永遠不得新增**。
  //
  // 上面那段只在「還在起始等級」時跑，但這條不隨等級鬆綁——原書寫得很硬：
  // 「cannot acquire new Classes, not even after mastering all three Innate Classes」。
  // 所以獨立成一段，任何等級都檢查。
  if (isTechnosphereEnabled(creation.technospheres) && classCount !== INNATE_CLASS_COUNT) {
    warnings.push({
      step: 2,
      field: 'classes',
      type: 'error',
      message: `魔晶石制需恰好 ${INNATE_CLASS_COUNT} 個固有職業（目前 ${classCount} 個），且升級不得新增職業`
    });
  }

  // Core p.228「You can never have more than three non-mastered Classes」。
  //
  // 這條在**升級路徑**上從 2026-10-22（§CB）起就擋住了，但升級不是唯一入口：
  // 匯入存檔、手改 localStorage、以及舊版本留下的卡都不經過 `applyLevelUp`。
  // 在此之前驗證器對此一聲不吭——一張四個未精通職業的卡照樣能定稿。
  //
  // 用 error 不用 warning：這不是「還沒填完」，是規則明文禁止的狀態。
  //
  // **只在「已經離開起始等級」時報**：起始等級的職業數由上面那段 `classCountMax` 管，
  // 兩邊都報等於同一件事說兩遍；而且起始等級時職業數 ≤ 3 就保證未精通 ≤ 3，
  // 這條在那裡永遠只是重複。
  const nonMasteredCount = (char.classes || [])
    .filter((c) => (parseInt(c.level, 10) || 0) < CLASS_MAX_LEVEL).length;
  if (char.level !== creation.startingLevel && nonMasteredCount > MAX_NON_MASTERED_CLASSES) {
    warnings.push({
      step: 2,
      field: 'classes',
      type: 'error',
      message: `未精通的職業有 ${nonMasteredCount} 個，超過上限 ${MAX_NON_MASTERED_CLASSES} 個（p.228）`
    });
  }

  // 職業等級總和應該等於角色等級（升級時兩者一起 +1）。對不上就是**漂移**——
  // 以前沒有任何地方檢查這件事，於是同一張卡在卡片上顯示 Lv 5、在三頁表格上顯示 Lv 8。
  //
  // 魔晶石制是**例外，而且是規則上的例外**（p.134）：升級那一點可以投進魔石，
  // 投進魔石時職業等級不會 +1，所以「職業等級總和」本來就會落在角色等級之後。
  // 用等號去比，等於每一張合法卡片都被噴一次警告——2026-10-22 實測：
  // 15 級角色（三個固有職業 2/2/1 ＝ 5 級）＋ 兩顆 5 級魔石，正是 p.134 自己舉的例子，
  // 卻被報成「職業等級總和為 5，與角色等級 15 不一致」。
  const classLevelSum = (char.classes || []).reduce((sum, cl) => sum + (parseInt(cl.level, 10) || 0), 0);
  const technoCreation = isTechnosphereEnabled(creation.technospheres);
  if (technoCreation) {
    if (classLevelSum > getCharacterLevel(char)) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'warning',
        message: `職業等級總和為 ${classLevelSum}，超過角色等級 ${getCharacterLevel(char)}`
      });
    }
    // p.140「The character may distribute their levels as they wish between their Innate
    // Classes and initial mnemospheres, but must invest at least 5 levels among three
    // Innate Classes.」——分配自由，但下限是硬的。
    //
    // 下限不超過角色等級本身：起始等級 < 5 是 GM 自訂（`startingLevel` 的 min 是 1），
    // 那時「至少 5 級」不可能達成，硬套會讓每一張這種卡都無法通過定稿。
    const innateFloor = Math.min(INNATE_MIN_LEVELS, getCharacterLevel(char));
    if (classCount > 0 && classLevelSum < innateFloor) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `魔晶石制要求至少 ${innateFloor} 級投在三個固有職業（p.140），`
          + `目前只有 ${classLevelSum} 級——其餘可以投進職業魔石`
      });
    }
  } else if (classCount > 0 && classLevelSum !== getCharacterLevel(char)) {
    warnings.push({
      step: 2,
      field: 'classes',
      type: 'warning',
      message: `職業等級總和為 ${classLevelSum}，與角色等級 ${getCharacterLevel(char)} 不一致`
    });
  }

  // 魔晶石制下，升級的那一點可能投進**職業魔石**而不是固有職業（p.134），
  // 於是「技能總和」會落在角色等級之後。所以只擋「超過」——
  // 用等號會讓每一張剛把點數投進魔石的角色被噴一次警告。
  if (isTechnosphereEnabled(creation.technospheres)) {
    if (stats.totalSkillLevels > char.level) {
      warnings.push({
        step: 2,
        field: 'skills',
        type: 'warning',
        message: `技能點數總和 (${stats.totalSkillLevels}) 超過角色等級 (${char.level})`
      });
    }
  } else if (stats.totalSkillLevels !== char.level) {
    warnings.push({
      step: 2,
      field: 'skills',
      type: 'warning',
      message: `技能點數總和 (${stats.totalSkillLevels}) 與角色等級 (${char.level}) 不符`
    });
  }

  // 步驟 2: 特技子項目配額檢驗 (如舞步、音調曲風、心靈天賦、魔法種子等)
  (char.classes || []).forEach(cl => {
    (cl.skills || []).forEach(sk => {
      if (sk.sl > 0) {
        const subConfig = getSkillSuboptionConfig(cl.className, sk.name);
        if (subConfig) {
          const maxQuota = calculateSkillSuboptionMax(cl.className, sk.name, sk.sl);
          let currentCount = 0;
          if (Array.isArray(sk.selectedOptions)) {
            currentCount = sk.selectedOptions.length;
          } else if (sk.selectedOptions && typeof sk.selectedOptions === 'object') {
            currentCount = (sk.selectedOptions.keys || []).length + (sk.selectedOptions.tones || []).length;
          }
          if (currentCount < maxQuota) {
            warnings.push({
              step: 2,
              field: `skill_suboptions_${cl.className}_${sk.name}`,
              type: 'warning',
              // 這句原本把玩家指向一個不存在的「特技分頁」——子選項的介面其實就在第 2 步
              // 「職業與技能」的技能卡上（`ClassSkillCard` 的技能列 → 右側按鈕開彈窗），
              // 全站沒有那個分頁。實際操作時照著提示去找，找不到。
              message: `【${cl.className}】的【${sk.name}】名額未滿：目前已配置 ${currentCount} 個，尚有 ${maxQuota - currentCount} 個名額可供選擇。請回到第 2 步「職業與技能」，在【${sk.name}】那一列點右側的「配置…／調整…」按鈕完成構築。`
            });
          } else if (currentCount > maxQuota) {
            warnings.push({
              step: 2,
              field: `skill_suboptions_${cl.className}_${sk.name}`,
              type: 'warning',
              message: `【${cl.className}】的【${sk.name}】超出配額：目前已配置 ${currentCount} 個，上限為 ${maxQuota} 個。請刪減 ${currentCount - maxQuota} 個選項。`
            });
          }
        }
      }
    });
  });

  // 步驟 4: 裝備與熟練度
  //
  // 「能不能穿」「有沒有超支」只寫在 `equipmentRules.js` 一處——這裡直接呼叫同一支函式，
  // 於是編輯器的琥珀色提示框與創角清單是同一份判定（以前清單看不到超支，
  // 玩家可以帶著超額裝備直接定稿）。
  if (!char.equipment?.mainHand || char.equipment.mainHand === '無') {
    warnings.push({ step: 4, field: 'mainHand', type: 'info', message: '尚未裝備主手武器' });
  }
  buildLoadoutIssues({
    character: char,
    stats,
    // 定制武器也要進這張表，否則「這件裝備你裝備不了／超出預算」的檢查會看不到它
    weaponMap: new Map([
      ...rulesData.equipment.weapons.map((w) => [w.name, w]),
      ...buildCustomWeaponEntries(char).map((w) => [w.name, w])
    ]),
    shieldMap: new Map(rulesData.equipment.shields.map((s) => [s.name, s])),
    armorMap: new Map(rulesData.equipment.armors.map((a) => [a.name, a])),
    accessoryMap: new Map(rulesData.equipment.accessories.map((a) => [a.name, a])),
    budget: creation.startingZenit,
    // 插槽品級與附魔魔石算進**同一筆**裝備預算（p.133 的價格表與 p.140 的採購清單）。
    extraSpend: isTechnosphereEnabled(creation.technospheres)
      ? getTechnosphereEquipmentSpend(char.technospheres)
      : 0
  }).forEach((issue) => {
    warnings.push({
      step: 4,
      field: 'equipment',
      type: issue.level === 'error' ? 'error' : 'warning',
      message: issue.message
    });
  });

  // 魔晶石制的裝備表（科技奇幻手冊 p.133）：官方武器表與盾牌**整份不可用**，
  // 角色只裝備自訂武器、自訂防具與飾品。
  //
  // 這不是「建議」——原書把整個 Equipment 章節換掉了。所以穿官方劍是錯誤，
  // 不是提醒。徒手打擊與「無盾牌」是空手狀態的預設值，不算違規。
  //
  // ※ 判定用 `modeRestrictsEquipment` 而不是 `isTechnosphereEnabled`：
  //   「僅職業魔石」變體（p.138）明寫「all types of equipment are once again
  //   available for PCs and NPCs」，那一態穿官方武器是**合法**的。
  if (modeRestrictsEquipment(creation.technospheres)) {
    const officialNames = new Set([
      ...rulesData.equipment.weapons.map((w) => w.name),
      ...rulesData.equipment.shields.map((s) => s.name)
    ]);
    const customWeaponNames = new Set(buildCustomWeaponEntries(char).map((w) => w.name));
    const emptyValues = new Set(['徒手打擊', '無盾牌', '無', '']);
    const offenders = ['mainHand', 'offHand']
      .map((slotId) => char.equipment?.[slotId])
      .filter((name) => name && !emptyValues.has(name)
        && officialNames.has(name) && !customWeaponNames.has(name));
    if (offenders.length > 0) {
      warnings.push({
        step: 4,
        field: 'equipment',
        type: 'error',
        message: `魔晶石制只能裝備自訂武器（科技奇幻手冊 p.133 換掉了整份裝備表），請換掉：${offenders.join('、')}`
      });
    }

    // 已學會、但被這個模式作廢的技能（p.133 的守護者【雙重盾牌】）。
    //
    // 選單層已經擋掉了（創角、升級、魔石三條路都不再列出它），這裡是給**舊存檔**用的：
    // 玩家先開守護者買了雙重盾牌、後來把整團切成魔晶石制，那一點 SL 就白花了。
    // 用 warning 不用 error——舊存檔不該一開頁就紅成一片；但玩家要看得見
    // 「這一點已經沒用」，否則他只會覺得卡片壞了。
    const deadSkills = [...new Set((char.classes || []).flatMap((cl) => (cl.skills || [])
      .filter((sk) => (sk.sl || 0) > 0 && isSkillSuppressedByTechnospheres(sk.name, creation.technospheres))
      .map((sk) => sk.name)))];
    if (deadSkills.length > 0) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'warning',
        message: `魔晶石制下這些技能已作廢（科技奇幻手冊 p.133）：${deadSkills.join('、')}——已投入的技能點不會退還`
      });
    }
  }

  // 魔晶石（科技奇幻手冊 p.132–145）：職業魔石與附魔魔石的合法性全部由
  // `data/technospheres.js` 的 `validateTechnosphereState` 判定——插槽容量、
  // 同一物品不得裝兩顆共享技能的職業魔石、不得裝備自己已經會那些技能的魔石、
  // δ 品級的武器限定、γ／δ 品級的花費、內嵌裝置的容量……
  // 這裡只負責把結果轉成創角清單的格式，不重寫任何一條判定。
  if (isTechnosphereEnabled(creation.technospheres)) {
    const equippedSlotIds = ['mainHand', 'offHand', 'armor', 'accessory']
      .filter((slotId) => {
        const value = char.equipment?.[slotId];
        return value && value !== '無';
      });
    // 「角色已經能用的技能」＝固有職業上投過點的技能。魔石不得重複提供它們，
    // 否則等於用魔石換到第二份同樣的效果（p.135）。
    const ownedSkillNames = (char.classes || []).flatMap((cl) => (cl.skills || [])
      .filter((sk) => (sk.sl || 0) > 0)
      .map((sk) => sk.name));
    validateTechnosphereState({
      state: char.technospheres,
      mode: creation.technospheres,
      level: getCharacterLevel(char),
      equippedSlots: equippedSlotIds,
      ownedSkillNames
    }).forEach((issue) => {
      warnings.push({
        step: 4,
        field: 'technospheres',
        type: issue.level === 'error' ? 'error' : 'warning',
        message: issue.message
      });
    });
  }

  // 起始資金尚未結算（原書 p.165：起始資金 = 剩餘裝備預算 ＋ 2d6 × 10）。
  // `startingFundsRolled` 由三個結算點寫入 true：擲 2d6 × 10、手動填寫初始持有金幣、
  // 套用官方經典職業搭配。**舊存檔沒有這個欄位 → 不提醒**，行為與以前完全相同。
  if (char.startingFundsRolled === false) {
    warnings.push({
      step: 4,
      field: 'zenit',
      type: 'error',
      message: `起始資金尚未結算（原書 p.165：剩餘預算 ＋ 2d6 × 10）——目前顯示的 ${char.zenit ?? 0}z 是裝備預算，不是起始資金`
    });
  }

  // 步驟 5: 特質與金手指（是否開放由開卡規則決定）
  //
  // 註：羈絆**不在創角驗證範圍內**。原書的創角八步驟沒有羈絆（p.154），
  // 羈絆是遊戲中於休息場景建立的（p.57），「起始帶 1 條羈絆」只是選用規則（p.220）。
  // 以前這裡會產生「建議至少建立 1 個」的警告，那是沒有官方來源的杜撰。
  if (!creation.allowQuirk && char.quirk && char.quirk !== '無') {
    warnings.push({
      step: 5,
      field: 'quirk',
      type: 'error',
      message: `此團未開放金手指，請移除「${char.quirk}」`
    });
  }

  // 金手指「選項」（§CF）：選了帶選項的金手指卻還沒挑 → 提醒。
  //
  // 只有兩個選項會改數值（倖存者③ IP +2、墮落天使③ 最大 MP +10），
  // 其餘 11 個是敘事選項——但**每一個都要選**，原書寫的是「選擇一個選項」，
  // 不是「可以選」。沒選時卡片上只會少那 2 點 IP／10 點 MP，
  // 玩家不會知道是自己的角色還沒填完。
  const quirkDef = findQuirkDef(char.quirk);
  // 選項有兩種形狀（§CG）：單組 `options`、多組 `optionGroups`（草木成精要選
  // 「免疫狀態」＋「易傷屬性」兩件事）。一律包成「組」再檢查，才不會漏掉多組的。
  const isGrouped = Array.isArray(quirkDef?.optionGroups) && quirkDef.optionGroups.length > 0;
  const quirkGroups = isGrouped
    ? quirkDef.optionGroups
    : (Array.isArray(quirkDef?.options) && quirkDef.options.length > 0
      ? [{ id: 'default', options: quirkDef.options }]
      : []);
  const choiceOf = (groupId) => (isGrouped
    ? (char.quirkChoice && typeof char.quirkChoice === 'object' ? char.quirkChoice[groupId] : undefined)
    : char.quirkChoice);
  const missingQuirkGroups = quirkGroups.filter((group) => !(group.options || [])
    .some((opt) => opt.id === choiceOf(group.id)));
  if (missingQuirkGroups.length > 0) {
    warnings.push({
      step: 5,
      field: 'quirkChoice',
      type: 'warning',
      message: quirkGroups.length > 1
        ? `金手指「${char.quirk}」要選 ${quirkGroups.length} 件事（原書：選擇選項）`
        : `金手指「${char.quirk}」要選一個選項（原書：選擇一個選項）`
    });
  }

  // 定制武器（HF p.106 的選用規則）：規則沒開就不該存在。
  // 規格本身的合法性（名額、強力限制、可變形成對…）由 `validateCustomWeapon` 判定，
  // 這裡只處理「這條規則這團有沒有開」。
  if (!creation.allowCustomWeapon && (char.customWeapons || []).length > 0) {
    warnings.push({
      step: 4,
      field: 'customWeapons',
      type: 'error',
      message: `此團未開放【${CUSTOM_WEAPON_BASE.label}】，請移除已鍛造的武器`
    });
  }
  (char.customWeapons || []).forEach((spec) => {
    const { ok, issues } = validateCustomWeapon(spec, { siblings: char.customWeapons || [] });
    if (!ok) {
      warnings.push({
        step: 4,
        field: 'customWeapons',
        type: 'error',
        message: `【${spec?.name || CUSTOM_WEAPON_BASE.label}】${issues[0].message}`
      });
    }
  });

  // 英雄技能的前提（原書 p.232）。以前這裡完全沒有檢查——5 級、零精通也能從選單
  // 直接加英雄技能，而畫面只印了一行「已精通職業: …【具備英雄技能資格】」當裝飾。
  //
  // 現在分兩條路徑判，**與技能在陣列裡的順序無關**：
  //   ① 精通路徑（規則的預設）：該職業已達 10 級。
  //   ② 開局名額路徑（選用規則，Playtest 2026-10-01 p.4）：規則有開、且該技能過得了
  //      「開局版」前提（擁有指定職業其中之一、不在 8 個禁用清單裡）。
  // ②的名額只有一個，所以最後要檢查「有幾個技能是靠它過關的」。
  const heroic = char.heroicSkills || [];
  const charLevel = getCharacterLevel(char);
  const ownedClasses = (char.classes || []).map((c) => c.className);
  const masteryGate = (def) => checkHeroicSkillRequirement(def, {
    masteredClasses: stats.masteredClasses,
    // 「不必精通」型的技能（例：銃劍士）在精通路徑也要比對「擁有」，
    // 所以這裡一律把現有職業一起傳進去
    classes: ownedClasses,
    level: charLevel
  });
  const creationGate = (def) => checkHeroicSkillRequirement(def, {
    classes: ownedClasses,
    level: charLevel,
    atCreation: true
  });

  const viaCreationSlot = [];
  heroic.forEach((entry) => {
    const name = typeof entry === 'string' ? entry : entry?.name;
    const def = HEROIC_SKILLS.find((h) => h.name === name);
    if (!def) return; // 資料表裡沒有這個英雄技能 → 無法判定，不擋（寧漏不誤）
    if (masteryGate(def).ok) return; // 靠精通取得 → 沒問題
    if (creation.startingHeroicSkill && creationGate(def).ok) {
      viaCreationSlot.push(name);
      return;
    }
    // 訊息要說玩家「正在嘗試的那條路」為什麼不通：規則有開就講開局名額的條件，
    // 否則講精通。兩者混用會出現「規則開著、卻說你沒精通」這種答非所問的提示。
    warnings.push({
      step: 5,
      field: 'heroicSkills',
      type: 'error',
      message: `【${name}】${creation.startingHeroicSkill ? creationGate(def).reason : masteryGate(def).reason}`
    });
  });
  if (viaCreationSlot.length > 1) {
    warnings.push({
      step: 5,
      field: 'heroicSkills',
      type: 'error',
      message: `開局名額只能選一個英雄技能（目前有 ${viaCreationSlot.length} 個用到它：`
        + `${viaCreationSlot.join('、')}）`
    });
  }

  // 取得次數上限（原書 p.232：「除非特別說明，每個英雄技能只能獲得一次」）。
  // 少數技能明文可以拿多次（嵌合術精通 2 次、解剖學家 3 次），見 `heroicSkillMaxAcquisitions`。
  const skillCounts = new Map();
  heroic.forEach((entry) => {
    const name = typeof entry === 'string' ? entry : entry?.name;
    skillCounts.set(name, (skillCounts.get(name) || 0) + 1);
  });
  skillCounts.forEach((count, name) => {
    const def = HEROIC_SKILLS.find((h) => h.name === name);
    if (!def) return;
    const max = heroicSkillMaxAcquisitions(def);
    if (count > max) {
      warnings.push({
        step: 5,
        field: 'heroicSkills',
        type: 'error',
        message: `【${name}】最多只能取得 ${max} 次（目前 ${count} 次）`
      });
    }
  });

  // ── 核心書技能變體的互斥條款（2026-10-14 GM 裁定實作）
  //
  // 變體效果文各自寫著「若你使用此變體，你不能取得【某某】英雄技能」，
  // 但在此之前**完全沒有程式檢查**——那些條款只是 desc 裡的自由文字。
  // 判定與資料都在 `coreBookVariants.js`，這裡只負責轉成驗證訊息。
  findVariantHeroicSkillConflicts(char).forEach((c) => {
    warnings.push({
      step: 5,
      field: 'heroicSkills',
      type: 'error',
      message: c.message
    });
  });

  // ── 步驟 2：秘儀師的「開局自選一個阿爾卡納」
  //
  // 【綁定和召喚】的效果文明寫「如果你在角色創建時獲得這個技能，你可以在開始遊戲前
  // 自選一個阿爾卡納作為已經綁定的阿爾卡納」。但這句話長期**沒有程式對應**：
  // 創角六步沒有任何綁定入口、驗證不檢查、跑團面板還預設送一個劍之阿爾卡納。
  // 實際操作一輪的結果是「規則說要選，程式沒地方選，而且已經幫你選好了」。
  // 判定與費用計算的單一來源在 `utils/arcanist.js`（此處只做職業名比對，避免循環匯入）。
  const arcanistClassEntry = (char.classes || []).find(
    (cl) => cl?.className === '秘儀師' || cl?.className === VARIANT_ARCANIST_CLASS_NAME
  );
  const bindingSkillSL = Number(
    ((arcanistClassEntry?.skills) || []).find((s) => s?.name === '綁定和召喚')?.sl
  ) || 0;
  const boundArcanaIds = Array.isArray(char.arcanistData?.boundArcana)
    ? char.arcanistData.boundArcana.filter(Boolean)
    : [];
  if (bindingSkillSL > 0 && boundArcanaIds.length === 0) {
    warnings.push({
      step: 2,
      field: 'arcanistData',
      type: 'warning',
      message: '【綁定和召喚】尚未選擇開局的阿爾卡納：開始遊戲前可自選 1 個（Core p.133）'
    });
  }

  // ── 步驟 5：底力技（高度奇幻手冊 p.124–131 的選用規則）
  //
  // 規則沒開就完全不管——舊角色身上殘留的 `zeroPower` 資料不該在關閉後變成警告
  // （與 `allowPlaytest` 關閉後不動既有資料同一個原則）。
  // 開啟時只回報「還缺哪個選擇」。「兩名以上角色撞同一個觸發」**刻意不檢查**：
  // 使用者裁定（2026-10-21）團隊約束交給 GM 審卡，不是開卡時的硬性規定。
  if (isZeroPowersEnabled(creation)) {
    zeroPowerIssues(char.zeroPower).forEach((issue) => {
      warnings.push({ step: 5, field: issue.field, type: issue.type, message: issue.message });
    });
  }

  // 步驟 6: 命名與背景（原書第 8 步，p.154／p.170）
  //
  // 姓名由 `createNewCharacter` 以佔位符初始化，所以「有值」不等於「填過」——
  // 舊版把這條檢查放在第 1 步又只檢查空字串，於是對任何新角色都不會觸發。
  const nameFilled = Boolean(char.name && char.name.trim()) && char.name.trim() !== PLACEHOLDER_CHARACTER_NAME;
  if (!nameFilled) {
    warnings.push({ step: 6, field: 'name', type: 'warning', message: '角色尚未填寫姓名' });
  }
  if (!char.gender || !char.gender.trim()) {
    warnings.push({ step: 6, field: 'gender', type: 'info', message: '尚未填寫性別' });
  }
  if (!char.background || !char.background.trim()) {
    warnings.push({ step: 6, field: 'background', type: 'info', message: '尚未填寫角色背景' });
  }

  const errors = warnings.filter(w => w.type === 'error');
  const nonErrors = warnings.filter(w => w.type !== 'error');

  return {
    isValid: errors.length === 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
    totalIssues: warnings.length
  };
};

/**
 * 創角定稿 (Lock)
 *
 * 使用者對這張卡的描述是「開好角色後，就基本是固定好了」——但在這之前，
 * 程式裡沒有任何狀態表達那件事：編輯器任何時候都全開，於是 UI 不敢簡化，
 * 玩家也分不清自己「還在創角」還是「已經在跑」。
 *
 * `locked` 就是那個狀態。定稿後，創角時做的決定（身世、四維）凍結，
 * 只留成長相關的欄位（等級、技能點、裝備、命刻、筆記）可以動。
 * （羈絆也是成長的一部分，但它不屬創角、編輯器也沒有這一格——於跑團面板管理，見 `CREATION_STEPS`。）
 * **舊存檔沒有這個欄位 → 一律視為未定稿**，行為與以前完全相同。
 */
export const isCharacterLocked = (char) => char?.locked === true;

/** 定稿後凍結的分頁（對應 CharacterEditor 的分頁 id：1 基礎身世、3 四維屬性、6 命名與背景） */
export const LOCKED_CREATION_TABS = Object.freeze([1, 3, 6]);

/** 定稿：留下 `locked` 旗標與一筆履歷 */
export const lockCharacter = (char, { at, note = '' } = {}) => {
  const ts = at || new Date().toISOString();
  return appendLog(
    { ...char, locked: true, lockedAt: ts },
    createLogEntry({ kind: 'lock', title: '角色定稿', note, at: ts })
  );
};

/** 解除定稿：重新開放創角欄位（同樣留下一筆履歷，所以「什麼時候解鎖過」查得到） */
export const unlockCharacter = (char, { at, note = '' } = {}) => {
  const ts = at || new Date().toISOString();
  return appendLog(
    { ...char, locked: false, lockedAt: null },
    createLogEntry({ kind: 'lock', title: '解除定稿（重新開放創角欄位）', note, at: ts })
  );
};

/** 創角步驟（與 validateCharacter 的 step 編號一一對應）
 *
 * 為什麼沒有「情感羈絆」這一格：原書的創角流程是八個步驟（Identity／Theme／Origin／
 * 職業與等級／四維／HP·MP·IP·DEF·M.DEF·先攻／裝備 500z／名字），**沒有羈絆**（p.154）；
 * 羈絆是遊戲中透過休息場景等時機建立的（p.57），而「起始帶 1 條羈絆」是選用規則（p.220）。
 * 舊版把它列為創角第 5 步並在驗證時催填，屬無官方來源的杜撰。
 *
 * 為什麼職業（第 2 步）排在四維（第 3 步）之前：原書是「先選職業（第 4 步）再分配屬性
 * （第 5 步）」，且 p.162 明說分配屬性骰時要考慮職業與技能選擇。舊版把兩者對調，
 * 玩家得在還不知道職業會給什麼免費增益時就決定四維。
 *
 * 為什麼姓名在**最後**（第 6 步）而不是第 1 步：原書第 8 步是「描述你的角色並選擇
 * 名字和稱呼」（p.154），p.170 給了理由——「先掌握了角色的外貌與能力，取名就容易多了」。
 * 舊版把它併進「基礎身世」，等於要玩家在還不知道自己是誰之前先取名字。
 *
 * 為什麼第 5 步的 `doneHint` 是「沒有需要設定的項目」而不是「已確認」：
 * 這一步在官方標準開卡規則下**沒有任何欄位**——英雄技能要精通職業（10 級）才解鎖，
 * 金手指是選用規則；所以 `buildCreationChecklist` 永遠把它判成 `done`。
 * 原本的「特質與命刻已確認」是命刻還留在創角裡時的寫法，而命刻早已移出創角
 * （見 `CharacterEditor.jsx` 第 5 步上方的說明）——留著等於對玩家宣稱一件沒發生的事。
 *
 * 為什麼 label 是「英雄技能與特質」：`CharacterEditor.jsx` 的 `TABS` **直接由這裡派生**
 * （不再各自硬編碼），所以兩份清單的步驟名稱在結構上不可能再漂移。
 */
export const CREATION_STEPS = Object.freeze([
  { id: 1, label: '基礎身世', doneHint: '身分、主題、故鄉都已填寫' },
  { id: 2, label: '職業與技能', doneHint: '職業組合與技能點數已配置' },
  { id: 3, label: '四維屬性', doneHint: '骰階點數已分配完成' },
  { id: 4, label: '裝備配置', doneHint: '武裝與防具已就緒' },
  { id: 5, label: '英雄技能與特質', doneHint: '沒有需要設定的項目' },
  { id: 6, label: '命名與背景', doneHint: '姓名、性別與角色背景都已填寫' }
]);

/**
 * 創角進度清單：把 `validateCharacter` 的結果整理成一條主線。
 *
 * 以前「還缺什麼」只是一顆小紅點加一個 modal——玩家得自己找。
 * 這裡**不新增任何驗證邏輯**，只把同一份結果按步驟分成
 * 「已完成（done）／待處理（todo）／有問題（error）」，讓導航列本身就是進度表。
 */
export const buildCreationChecklist = (char, rules = DEFAULT_CREATION_RULES) => {
  const validation = validateCharacter(char, rules);
  return CREATION_STEPS.map((step) => {
    const issues = validation.warnings.filter((w) => w.step === step.id);
    const errorCount = issues.filter((w) => w.type === 'error').length;
    return {
      ...step,
      status: errorCount > 0 ? 'error' : (issues.length > 0 ? 'todo' : 'done'),
      errorCount,
      issueCount: issues.length,
      message: issues.length > 0 ? issues[0].message : step.doneHint
    };
  });
};

/**
 * 導出至戰鬥輪次追蹤器 (CombatTracker)
 */
export const exportCharacterToCombatant = (char) => {
  const stats = calculateCharacterStats(char);
  const curHp = char.currentHp !== null && char.currentHp !== undefined ? char.currentHp : stats.maxHp;
  const curMp = char.currentMp !== null && char.currentMp !== undefined ? char.currentMp : stats.maxMp;

  return {
    instanceId: `comb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sourceId: char.id,
    sourceType: 'character',
    name: char.name || '冒險者',
    avatar: char.avatar || null,
    faction: '玩家隊伍',
    level: getCharacterLevel(char),
    rank: '玩家',
    role: (char.classes || []).map(c => c.className).join(' / ') || '冒險者',
    species: '玩家',
    hp: {
      current: curHp,
      max: stats.maxHp,
      crisisThreshold: stats.crisisThreshold
    },
    mp: {
      current: curMp,
      max: stats.maxMp
    },
    ip: {
      current: char.currentIp !== undefined && char.currentIp !== null ? char.currentIp : stats.maxIp,
      max: stats.maxIp
    },
    fabulaPoints: char.fabulaPoints ?? 3,
    attributes: {
      dex: stats.currentDex,
      ins: stats.currentIns,
      mig: stats.currentMig,
      wlp: stats.currentWlp
    },
    defense: stats.def,
    magicDefense: stats.mdef,
    initiative: stats.init,
    hasActed: false,
    statusEffects: { ...char.statusAfflictions },
    skills: (char.classes || []).flatMap(cl => (cl.skills || []).map(sk => ({
      id: `${cl.className}_${sk.name}`,
      name: `${sk.name} (SL ${sk.sl})`,
      category: 'skill',
      desc: `【${cl.className}】特技`,
      isRevealed: true
    }))),
    rawCharData: char
  };
};
