import rulesData from '../data/rulesData.json';
import { PLAYTEST_HEROIC_SKILLS } from '../data/playtestHeroicSkills';
import {
  SOURCEBOOKS,
  STATUS_AFFLICTIONS,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_PRESET_ARRAYS,
  normalizeClassName,
  normalizeSkillName,
  normalizeHeroicSkillName,
  normalizeEquipmentName,
  normalizeSpellName,
  normalizeCharacterLegacyNames,
  VARIANT_ARCANIST_CLASS_NAME
} from '../data/sourcebookConfig';
import { resolveHeroicSkillEffect } from '../data/theriomorphosisVariant';
import { getSkillSuboptionConfig, calculateSkillSuboptionMax } from '../data/skillSuboptionsData';
import { PILOT_ARMOR_MODULES } from '../data/pilotVehicleData';
import { DEFAULT_CREATION_RULES, resolveCreationRules, classCountPhrase, PLAYTEST_SOURCEBOOK_KEY } from '../data/creationRules';
import { buildLoadoutIssues, withHrBonus } from './equipmentRules';
import { buildCustomWeaponEntries, validateCustomWeapon, CUSTOM_WEAPON_BASE } from '../data/customWeapons';
import { appendLog, createLogEntry } from './characterLog';
import { findVariantHeroicSkillConflicts } from '../data/coreBookVariants';
import { stripClassSuffix } from '../data/classAliases';
import { VARIANT_ARCANIST_HEROIC_SKILLS } from '../data/variantArcanistHeroicSkills';
import { isInitiativeVariant, getArmorProfile, initiativeVariantTermLabel } from '../data/initiativeVariant';
import { isZeroPowersEnabled, createZeroPowerState } from '../data/zeroPowers';
import {
  campActivityAccess,
  campActivityIssues,
  createCampActivityState,
  normalizeCampActivities
} from '../data/campActivities';
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
import { COMPANION_SPECIES } from '../data/wayfarerCompanionData';

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
 * 把玩家存下來的 `chosenBenefit` 正規化成 `'HP'` / `'MP'`（不認得就回空字串）。
 *
 * 為什麼需要這一層：UI 按鈕寫的是大寫 `'HP'`／`'MP'`，但歷史上有兩處拿小寫去比
 * （`'mp'`／`'hp'`），於是永遠不相等、永遠走預設分支。**同一份資料有兩種寫法，
 * 就一定有人比錯**——與其逐一改字面值，不如只留一個正規化入口。
 */
export const normalizeBenefitKey = (value) => {
  const key = String(value || '').trim().toUpperCase();
  return key === 'HP' || key === 'MP' ? key : '';
};

/**
 * 這個職業的免費增益「實際上落在哪一邊」——**二選一的唯一判定入口**。
 *
 * 回傳 `'HP'`／`'MP'`；不是二選一職業就回空字串（那種職業的增益是固定的，沒有選擇）。
 * 玩家沒選時預設 `'HP'`，理由是**不能兩邊都加**（那會多送 5 點）。
 *
 * 原書只寫「二選一」，沒說怎麼選——**那就是玩家的選擇**，不是 App 該替他決定的事
 * （2026-10-27 GM 裁定）。所以這裡只負責「讀出他選了什麼」，不提供推薦。
 */
export const resolveChosenBenefit = (classDef, classItem) => {
  const text = (classDef?.freeBenefits || '') + ' ' + (classDef?.freeBonus || '');
  if (!isHpMpChoiceBenefit(text)) return '';
  return normalizeBenefitKey(classItem?.chosenBenefit) || 'HP';
};

/**
 * 免費增益要印在卡片上的那句話。
 *
 * 二選一職業 → 玩家實際選到的 `'最大 HP +5'`／`'最大 MP +5'`（不是只印「二選一」，
 * 因為列印出來的卡要能直接拿去桌上用）。
 * 其餘職業 → 資料層的 `freeBonus` 原文（例如守護者的 `'HP +5，職業防具/盾牌'`）。
 */
export const describeFreeBenefit = (classDef, classItem) => {
  const key = resolveChosenBenefit(classDef, classItem);
  if (key) return `最大 ${key} +5`;
  return String(classDef?.freeBonus || '').trim();
};

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
 * 動態解析單一英雄技能條目（權威資料優先於存檔快照）。
 *
 * 舊存檔的 `character.heroicSkills` 在選取當下把 `{ name, source, requirement, effect }`
 * 整份拷貝進角色 JSON。日後規則文本或出處修訂時，若讀取端直接讀 `hs.effect`／`hs.source`，
 * 舊卡就會永遠停留在當初的舊文字。
 * 透過此唯一入口：凡名稱在 `HEROIC_SKILLS` 查得到者，一律以最新權威資料覆蓋快照欄位，
 * 並套用混合變形變體改寫（`resolveHeroicSkillEffect`）；查不到者（自訂條目）才退回快照欄位。
 */
export const resolveHeroicSkillEntry = (entry, character = null) => {
  if (!entry) return { name: '', source: '', requirement: '', effect: '' };
  const rawName = typeof entry === 'string' ? entry : (entry?.name || '');
  const name = normalizeHeroicSkillName(rawName);
  const def = HEROIC_SKILLS.find((h) => h.name === name);
  const baseObj = typeof entry === 'object' ? entry : {};
  const source = def?.source ?? baseObj.source ?? '';
  const requirement = def?.requirement ?? baseObj.requirement ?? '';
  const rawEffect = def?.effect ?? baseObj.effect ?? '';
  const effect = resolveHeroicSkillEffect(name, rawEffect, character);
  return {
    ...baseObj,
    name,
    source,
    requirement,
    effect
  };
};

const SPELL_SKILL_NAMES = new Set(['元素魔法', '靈魂魔法', '熵系魔法']);

/**
 * 動態解析單一咒語條目（權威 `rulesData.spells` 優先於存檔快照）。
 *
 * 凡名稱在 `rulesData.spells` 查得到者，其 `school`、`mp`、`target`、`duration`、`effect`、
 * `isOffensive` 一律以最新權威資料為準；自訂咒語（不在 `rulesData.spells` 內）則保留原欄位。
 */
export const resolveSpellEntry = (entry) => {
  if (!entry) {
    return { name: '', school: '通用', mp: '10', target: '單體', duration: '瞬發', effect: '', isOffensive: false };
  }
  const rawName = typeof entry === 'string' ? entry : (entry?.name || '');
  const name = normalizeSpellName(rawName);
  const rulesSpell = (rulesData.spells || []).find((s) => s.name === name);
  const baseObj = typeof entry === 'object' ? entry : {};
  if (rulesSpell) {
    return {
      ...baseObj,
      name: rulesSpell.name,
      school: rulesSpell.school,
      mp: rulesSpell.mp,
      target: rulesSpell.target,
      duration: rulesSpell.duration,
      effect: rulesSpell.effect,
      isOffensive: Boolean(rulesSpell.isOffensive)
    };
  }
  return {
    ...baseObj,
    name,
    school: baseObj.school || '通用',
    mp: baseObj.mp || '10',
    target: baseObj.target || '單體',
    duration: baseObj.duration || '瞬發',
    effect: baseObj.effect || baseObj.desc || '',
    isOffensive: Boolean(baseObj.isOffensive) || /\s*\u26A1\s*$/.test(rawName) || String(baseObj.effect || '').includes('（o）')
  };
};

/**
 * 解析角色目前已掌握的全部咒語（合併 `character.spells` 與三大魔法技能的 `selectedOptions`），
 * 並將每一筆以 `resolveSpellEntry` 對齊最新權威資料。
 */
export const resolveCharacterSpells = (character) => {
  if (!character || typeof character !== 'object') return [];
  const result = [];
  const seen = new Set();
  (Array.isArray(character.spells) ? character.spells : []).forEach((sp) => {
    const resolved = resolveSpellEntry(sp);
    if (resolved.name && !seen.has(resolved.name)) {
      seen.add(resolved.name);
      result.push(resolved);
    }
  });
  (Array.isArray(character.classes) ? character.classes : []).forEach((cl) => {
    (Array.isArray(cl?.skills) ? cl.skills : []).forEach((sk) => {
      const sName = normalizeSkillName(sk?.name);
      if (!SPELL_SKILL_NAMES.has(sName) || !Array.isArray(sk?.selectedOptions)) return;
      sk.selectedOptions.forEach((optName) => {
        const normName = normalizeSpellName(optName);
        if (!normName || seen.has(normName)) return;
        const rulesSpell = (rulesData.spells || []).find((s) => s.name === normName);
        if (rulesSpell) {
          seen.add(normName);
          result.push(resolveSpellEntry(rulesSpell));
        }
      });
    });
  });
  return result;
};

/**
 * 正規化單一角色（舊名正名 ＋ 英雄技能與咒語快照刷新 ＋ 魔法子選項同步）。
 * 若角色所有欄位皆已是最新狀態，嚴格回傳原本的物件參考（`===`）。
 */
export const normalizeCharacter = (char) => {
  if (!char || typeof char !== 'object') return char;
  const legacyNorm = normalizeCharacterLegacyNames(char);
  let changed = legacyNorm !== char;
  let next = legacyNorm;
  const patch = (key, val) => {
    if (!changed) {
      next = { ...legacyNorm };
      changed = true;
    }
    next[key] = val;
  };

  if (Array.isArray(next.heroicSkills)) {
    let hsChanged = false;
    const nextHs = next.heroicSkills.map((hs) => {
      if (!hs || typeof hs !== 'object') return hs;
      const def = HEROIC_SKILLS.find((h) => h.name === hs.name);
      if (!def) return hs;
      if (hs.source === def.source && hs.requirement === def.requirement && hs.effect === def.effect) {
        return hs;
      }
      hsChanged = true;
      return {
        ...hs,
        source: def.source,
        requirement: def.requirement,
        effect: def.effect
      };
    });
    if (hsChanged) patch('heroicSkills', nextHs);
  }

  const hasSpellsArray = Array.isArray(next.spells);
  const currentSpells = hasSpellsArray ? next.spells : [];
  let spChanged = false;
  const seenSpells = new Set();
  const nextSpells = currentSpells.map((sp) => {
    if (typeof sp === 'string') {
      seenSpells.add(sp);
      return sp;
    }
    if (!sp || typeof sp !== 'object') return sp;
    seenSpells.add(sp.name);
    const rulesSpell = (rulesData.spells || []).find((s) => s.name === sp.name);
    if (!rulesSpell) return sp;
    const wantOff = Boolean(rulesSpell.isOffensive);
    if (
      sp.school === rulesSpell.school &&
      sp.mp === rulesSpell.mp &&
      sp.target === rulesSpell.target &&
      sp.duration === rulesSpell.duration &&
      sp.effect === rulesSpell.effect &&
      Boolean(sp.isOffensive) === wantOff &&
      typeof sp.isOffensive === 'boolean'
    ) {
      return sp;
    }
    spChanged = true;
    return {
      ...sp,
      school: rulesSpell.school,
      mp: rulesSpell.mp,
      target: rulesSpell.target,
      duration: rulesSpell.duration,
      effect: rulesSpell.effect,
      isOffensive: wantOff
    };
  });

  if (Array.isArray(next.classes)) {
    next.classes.forEach((cl) => {
      (Array.isArray(cl?.skills) ? cl.skills : []).forEach((sk) => {
        if (!SPELL_SKILL_NAMES.has(sk?.name) || !Array.isArray(sk?.selectedOptions)) return;
        sk.selectedOptions.forEach((optName) => {
          if (!optName || seenSpells.has(optName)) return;
          const rulesSpell = (rulesData.spells || []).find((s) => s.name === optName);
          if (rulesSpell) {
            seenSpells.add(optName);
            spChanged = true;
            nextSpells.push({
              name: rulesSpell.name,
              school: rulesSpell.school,
              mp: rulesSpell.mp,
              target: rulesSpell.target,
              duration: rulesSpell.duration,
              effect: rulesSpell.effect,
              isOffensive: Boolean(rulesSpell.isOffensive)
            });
          }
        });
      });
    });
  }

  if (spChanged) patch('spells', nextSpells);

  return next;
};

/**
 * 正規化整份角色名冊；若全名冊皆已是最新狀態，回傳原本的陣列參考（`===`）。
 */
export const normalizeRosterCharacters = (roster) => {
  if (!Array.isArray(roster)) return roster;
  let rosterChanged = false;
  const next = roster.map((char) => {
    const norm = normalizeCharacter(char);
    if (norm !== char) rosterChanged = true;
    return norm;
  });
  return rosterChanged ? next : roster;
};

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
/** 職業名 → `rulesData.classes` 的鍵（精確優先，其次去掉後綴）。查不到回空字串。 */
const resolveClassKey = (className) => {
  if (!className) return '';
  const key = normalizeClassName(className);
  if (!key) return '';
  const match = Object.prototype.hasOwnProperty.call(rulesData.classes, key)
    ? key
    : stripClassSuffix(key);
  return match || '';
};

export const classSkillsForClass = (className, technosphereMode = null) => {
  const match = resolveClassKey(className);
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
 * 這個職業在當前模式下**被原書作廢**的技能名稱（F-016，2026-10-27）。
 *
 * 為什麼要另外回一份：`classSkillsForClass` 把作廢的技能濾掉了，於是畫面上
 * 「守護者只剩 4 條」看起來像資料少了，而不是「有一條被這團的規則拿掉」。
 * 介面需要一個能說出「少了哪一條、為什麼」的來源——那就是這支。
 *
 * 與 `classSkillsForClass` 共用 `resolveClassKey`，否則兩邊對「守護者（變體）」
 * 這種帶後綴的名字寬容度不同，會出現「清單 4 條、說明卻說少了 0 條」。
 */
export const suppressedSkillsForClass = (className, technosphereMode = null) => {
  const match = resolveClassKey(className);
  if (!match) return [];
  return (rulesData.classes[match]?.skills || [])
    .filter((sk) => isSkillSuppressedByTechnospheres(sk.name, technosphereMode))
    .map((sk) => sk.name);
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
  atCreation = false,
  learnedSkills = null,
  learnedSpells = null,
  companionSpecies = null,
  gadgets = null,
  technoRestrictsEquipment = false
} = {}) => {
  const base = checkClassAndLevelRequirement(skill, { masteredClasses, classes, level, atCreation });
  if (!base.ok) return base;
  return checkExtraRequirement(skill, {
    learnedSkills, learnedSpells, companionSpecies, gadgets, technoRestrictsEquipment
  });
};

/**
 * 前提的「前半段」：職業與等級。這兩件事引擎一直都算得出來。
 * @returns {{ok: boolean, reason: string}}
 */
const checkClassAndLevelRequirement = (skill, {
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

  // 「兩個或更多：元素師、熵師、靈師」＝這三個裡**至少要有兩個**（F-034）。
  // 原本一律用 `required.some(...)`（任一個就夠），把「兩個」悄悄放寬成「一個」——
  // 那是**把條件改鬆**，比擋錯人更難發現：畫面不會報錯，只會讓不合格的卡過關。
  const minMatch = /(兩個|二個|2\s*個|三個|3\s*個)或更多/.exec(req);
  const minCount = minMatch ? ({ 兩: 2, 二: 2, 2: 2, 三: 3, 3: 3 }[minMatch[1][0]] || 1) : 1;

  const ownedHit = required.filter((name) => owned.includes(name));
  if (ownedHit.length >= minCount) return { ok: true, reason: '' };

  // 錯誤訊息照原樣顯示職業名：`【變體】` 現在是玩家必須分辨的東西，
  // 剝掉它會變成「需精通【秘儀師】」，而對方缺的其實是「秘儀師【變體】」。
  // 名稱本身已含【…】時不再多加一層外框，免得變成「【秘儀師【變體】】」。
  const shown = [...new Set(required)];
  const needsList = shown.some((n) => n.includes('【'))
    ? shown.join('／')
    : `【${shown.join('／')}】`;
  if (minCount > 1) {
    return {
      ok: false,
      reason: `${atCreation ? '開局需擁有' : '需精通'}${needsList}其中 ${minCount} 個`
        + `（目前 ${ownedHit.length} 個）`
    };
  }
  return {
    ok: false,
    reason: atCreation
      ? `開局需擁有${needsList}其中之一`
      : `需精通${needsList}其中之一`
  };
};

/**
 * 引擎「認得的攻擊性咒語」——`rulesData.spells` 裡 `isOffensive === true` 的那 20 條。
 *
 * 這個欄位是 2026-10-29 GM 裁定後補上的：
 *
 *   > 咒語去根據名字標記出攻擊性的欄位，讓你可以自動數。
 *
 * 依據是**官方繁中角色卡 Excel 的「咒語合集」工作表**——38 條咒語裡有 20 條的
 * 名稱後面帶一個閃電符號（Unicode U+26A1，例：「照明烈焰」加那個符號），
 * 那就是官方標的攻擊性咒語。逐條對照後 38 條名稱與本專案完全一致（沒有多、沒有少）。
 * ※ 這裡刻意不寫出那個符號本身：`test:emoji` 是硬性禁止項，連註解都不放行。
 *
 * 為什麼不能「看效果文有沒有寫傷害」自己猜：`遲鈍`（緩慢）、`幻覺`、`激怒` 都不是傷害，
 * 但它們都要**對魔防做施法檢定**——那才是「攻擊性（o）」的定義。猜錯的方向剛好相反。
 */
const OFFENSIVE_SPELL_NAMES = new Set(
  (rulesData.spells || []).filter((s) => s.isOffensive === true).map((s) => s.name)
);

/**
 * 這一串「學過的咒語」裡有幾個是攻擊性咒語。
 *
 * 吃的是**混着字串與物件**的陣列（角色卡的 `spells` 存名字，嵌合師的
 * `chimeristData.spells` 存物件），所以兩種都要認：
 * - 名字在 38 條攻擊性咒語名單裡 → 算；
 * - 物件自己帶 `isOffensive === true`（嵌合師自己造的咒語）→ 算。
 *
 * @param {Array<string|{name?:string,isOffensive?:boolean}>} spells
 * @returns {number}
 */
const KNOWN_SPELL_NAMES = new Set((rulesData.spells || []).map((s) => s.name));

export const countOffensiveSpells = (spells = []) =>
  (spells || []).filter((s) => {
    const rawName = typeof s === 'string' ? s : s?.name;
    const name = normalizeSpellName(rawName);
    if (name && KNOWN_SPELL_NAMES.has(name)) return OFFENSIVE_SPELL_NAMES.has(name);
    if (typeof rawName === 'string' && /\s*\u26A1\s*$/.test(rawName)) return true;
    return typeof s === 'object' && s !== null && s.isOffensive === true;
  }).length;

/**
 * 前提的「後半段」：額外技能前提（F-030／P31）。
 *
 * 三種結果：
 * - **判得出來** → 缺什麼就回什麼（`需先學會【招架反擊】`），玩家知道要去點哪一招；
 * - **判不出來** → `needsPlayerConfirm: true` ＋ `extraText`，由選擇器顯示勾選框；
 * - **呼叫端沒給「學過什麼」** → 一律交回玩家。**不知道就不要假裝知道。**
 *   為什麼要留這條路：編輯器算「開局名額用掉幾個」時是在數**已經取得的**技能，
 *   那時候不該重新審核資格（重新審核會讓名額看起來是空的，玩家就能多拿一個）。
 *
 * @returns {{ok: boolean, reason: string, needsPlayerConfirm?: boolean, extraText?: string}}
 */
const checkExtraRequirement = (skill, {
  learnedSkills = null, learnedSpells = null, companionSpecies = null,
  gadgets = null, technoRestrictsEquipment = false
} = {}) => {
  const r = resolveHeroicExtraRequirement(skill);
  if (!r.hasExtra) return { ok: true, reason: '' };

  const handToPlayer = { ok: true, reason: '', needsPlayerConfirm: true, extraText: r.text };
  if (!r.checkable || learnedSkills === null) return handToPlayer;

  const skillNameOf = (s) => normalizeSkillName(typeof s === 'string' ? s : s?.name);
  const spellNameOf = (s) => normalizeSpellName(typeof s === 'string' ? s : s?.name);
  const owned = new Set();
  for (const s of learnedSkills || []) owned.add(skillNameOf(s));
  for (const s of learnedSpells || []) owned.add(spellNameOf(s));

  // 技能等級前提：「【魔法卡組】達到技能等級 3」
  if (r.skillLevel) {
    const have = (learnedSkills || []).find((s) => skillNameOf(s) === r.skillLevel.name);
    const sl = Number(have?.sl || 0);
    if (sl < r.skillLevel.level) {
      return {
        ok: false,
        reason: `需【${r.skillLevel.name}】技能等級 ${r.skillLevel.level}（目前 ${sl}）`
      };
    }
    return { ok: true, reason: '' };
  }

  // 數量前提：「至少學會兩個攻擊性咒語」（【奧法戰士】）
  if (r.offensiveSpells) {
    const have = countOffensiveSpells(learnedSpells || []);
    if (have < r.offensiveSpells) {
      return {
        ok: false,
        reason: `需至少學會 ${r.offensiveSpells} 個攻擊性咒語（目前 ${have} 個）`
      };
    }
    return { ok: true, reason: '' };
  }

  // 小工具軌道前提：「小工具【煉金術】已達高級益處」（【藥水霧化】【量子魔加農】
  // 【大鍋秘方】【爆裂藝術家】）。軌與檔次存在 `character.tinkererData.gadgets`，
  // 也就是玩家在科技樹上點到哪裡——**App 一直知道**，2026-10-29 GM 指正後才去讀。
  if (r.gadgetTier) {
    const gate = resolveGadgetTierGate(r.gadgetTier, gadgets, { technoRestrictsEquipment });
    if (gate.needsPlayerConfirm) return handToPlayer;
    if (!gate.ok) return gate;
    // 這一關過了，**還要**繼續驗同一句裡的其他前提（理由與物種段相同）。
  }

  // 物種前提：「忠實夥伴（構裝體物種）」（【這東西是活著的】【根源共生】）
  if (r.companionSpecies) {
    const gate = resolveCompanionSpeciesGate(r.companionSpecies, companionSpecies);
    if (gate.needsPlayerConfirm) return handToPlayer;
    if (!gate.ok) return gate;
    // 物種這一關過了，**還要**繼續驗同一句裡的其他前提（【這東西是活著的】還要【高瞻遠矚】）。
  }

  const missing = r.needs.filter((n) => !owned.has(n.name));
  if (r.mode === 'any') {
    if (missing.length === r.needs.length) {
      return { ok: false, reason: `需先學會${r.needs.map((n) => `【${n.name}】`).join('或')}其中之一` };
    }
    return { ok: true, reason: '' };
  }
  if (missing.length) {
    return { ok: false, reason: `需先學會${missing.map((n) => `【${n.name}】`).join('、')}` };
  }
  return { ok: true, reason: '' };
};

/**
 * 英雄技能前提裡「**引擎算不到的那一段**」（F-030）。
 *
 * ## 這是什麼
 *
 * 34 條英雄技能的前提寫成「武器大師，**且**習得招架反擊技能」。前半段（職業）引擎算得出來，
 * 後半段是**自由文字**：「習得招架反擊技能」「【魔法卡組】達到技能等級 3」
 * 「必須透過小工具技能獲得最高級煉金術增益」。
 * 要解析它得先有一份技能名冊，再猜「達到技能等級 3」是什麼意思——
 * **猜錯的代價是擋掉合法角色**，而那是比「不擋」更糟的錯。
 *
 * ## 判定方式：把「算得出來的」拿掉，剩下的就是「算不到的」
 *
 * 不用「找 且／並」這種寫法——**立案時就是這樣掃的，結果漏了 3 條**
 * （英雄級夥伴「旅人，忠實夥伴技能」、完美瞄準「神射手，警告射擊技能」、
 * 劫掠「遊蕩者，靈魂偷竊技能」，它們用逗號連接）。這是 MEMORY 鐵則 13 的又一個實例：
 * **掃描的邊界錯了，比邏輯錯了更安靜——它只會什麼都不抓，看起來全綠。**
 *
 * 所以反過來：把 ①職業名 ②「等級必須為 N 或更高」 拿掉，剩下還有字就是額外前提。
 * 這樣不管譯者用「且」「並」「，」還是別的連接詞，都會被抓到；**新增的技能也自動涵蓋**。
 *
 * ## 只有等級前提的不算
 *
 * 「你的角色等級必須為 30 或更高」是引擎**已經在算**的東西
 * （`checkHeroicSkillRequirement` 的 `等級必須為 N 或更高`）。
 * 把它丟回來叫玩家自己確認，等於把算過的東西退回去，還讓玩家以為 App 沒在管。
 *
 * @param {{requirement?: string}} skill 英雄技能資料
 * @returns {string} 需要玩家自己確認的前提原文；不需要（或沒有）就回空字串
 */
export const heroicSkillExtraPrerequisite = (skill) => {
  const req = String(skill?.requirement || '').trim();
  if (!req) return '';
  // 「通用」不必特別處理：它沒有任何連接詞，切完只剩第一段（職業段），自然回空字串。
  // 特地寫一條 `if (req === '通用') return ''` 只會多一個**永遠不會失敗**的分支。

  // 「你的角色等級必須為30或更高」整句都要吃掉——只吃「等級必須為30或更高」的話
  // 會剩一個「你的角色」，於是那一段被當成額外前提（第一版就是這樣，多數了 2 條）。
  const LEVEL_PHRASE = /(你的?)?角色?等級必須為\s*\d+\s*或更高/g;

  // ① 團務限制句先拿掉：「同一團中若有其他玩家角色已取得此英雄技能，你便不能取得」。
  //    那不是「這個角色符不符合」，而是「這張卡在這一團裡能不能拿」，跟
  //    `findDuplicateStartingHeroicSkills` 是同一類東西。留在這裡會讓整句變成「讀不懂」，
  //    於是【躍空】的**真正前提【飛天打擊】被勾選框蓋掉**——玩家勾一下就能拿（P32）。
  //    ※ 原文仍然完整顯示在選擇器的「條件」欄，這裡拿掉的只是**判定用的那一份**。
  const TEAM_NOTE = /同一團[^。]*。?/g;
  const body = req.replace(TEAM_NOTE, '');

  // ② 用「，」「；」「。」「且」「並」切段。**不用「、」**——那是職業名之間的分隔，
  //    「元素師、熵師、靈師」切開會被誤認成三個前提。
  //    「。」也要切：一個句子裡可以塞兩件事（【躍空】就是）。
  const segs = body.split(/[，,；;。]|且|並/).map((s) => s.trim()).filter(Boolean);

  // ③ 丟掉「職業段」。**不能無條件丟第一段**——第一版就是 `.slice(1)`，
  //    於是【躍空】開頭那句「已學會【飛天打擊】」被當成職業段丟掉。
  //    改成「這一段是不是只由職業名與雜訊組成」，是才丟。
  const rest = segs.length > 0 && isClassOnlySegment(segs[0]) ? segs.slice(1) : segs;
  return rest
    .filter((s) => s.replace(LEVEL_PHRASE, '').trim() !== '')
    .join('、');
};

/**
 * 引擎「認得」的所有可學習名稱：145 條職業技能 ＋ 38 條咒語。
 *
 * **長名優先排序**：`隔音屏障` 要先於 `屏障` 命中，否則「屏障」會把「隔音屏障」吃掉，
 * 判定就變成「你有隔音屏障嗎」——問錯問題。（目前只有 `屏障／隔音屏障`、`幻影／幻影之力`
 * 兩組會互相包含，但排序是免費的保險。）
 */
const LEARNABLE_NAMES = (() => {
  const out = [];
  for (const c of Object.values(rulesData.classes || {})) {
    for (const s of c.skills || []) out.push({ kind: 'skill', name: s.name });
  }
  for (const s of rulesData.spells || []) out.push({ kind: 'spell', name: s.name });
  const seen = new Set();
  return out
    .filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)))
    .sort((a, b) => b.name.length - a.name.length);
})();

/** 職業名（長名優先，`秘儀師【變體】` 先於 `秘儀師`）。判「殘留」時要一起拿掉。 */
const ALL_CLASS_NAMES = Object.keys(rulesData.classes || {}).sort((a, b) => b.length - a.length);

/**
 * 「職業段」裡允許出現的雜訊。
 * 這些字出現在第一段**不代表**有額外前提——它們是在描述職業條件本身：
 * - `通用`：跟職業無關（【靈巧雙手】【額外HP】…）
 * - `職業`／`中`：譯文的口語（「修補匠**職業**」「修補匠或旅人**中**」）
 * - `不必精通`：【銃劍士】的放寬註記
 * - `兩個或更多`：【雙重詠唱】的計數（判定在 `checkClassAndLevelRequirement`）
 */
const CLASS_SEGMENT_NOISE = /(通用|職業|不必精通|兩個或更多|或|和|與|及|、|，|,|：|:|（|）|\(|\)|中|\s)/g;

/**
 * 這一段是不是「職業段」——**只由職業名與雜訊組成**。
 *
 * 判準刻意寫成「拿掉職業名與雜訊之後還有沒有字」，不是「有沒有出現職業名」：
 * 舊寫法是**直接丟掉第一段**（`.slice(1)`），連問都沒問，於是【躍空】
 * 開頭那句「已學會【飛天打擊】」被當成職業段丟掉，真正的前提從來沒被檢查過。
 * 這是 MEMORY 鐵則 13 的第五次：**邊界錯了不會報錯，它只會什麼都不抓。**
 */
const isClassOnlySegment = (seg) => {
  let rest = String(seg || '');
  for (const cn of ALL_CLASS_NAMES) rest = rest.split(cn).join('');
  return rest.replace(CLASS_SEGMENT_NOISE, '').trim() === '';
};

/**
 * 條件文字裡「不是名詞」的填充詞。
 * 拿掉技能名、職業名、填充詞之後**還有字**，就代表那段話裡有引擎讀不懂的東西
 * （例：「高級煉金術」「構裝體物種」「至少兩個攻擊性」）→ 不可自動判。
 *
 * ※ 漏一個填充詞＝那條被誤判成「讀不懂」＝勾選框多一個，**不會擋掉任何人**，
 *   所以漏字的代價是「多問一次」而不是「判錯」。但反過來說，漏字是**安靜的**：
 *   測試只會顯示「交回玩家 15 條」而不是 6 條，看起來像正常運作。
 *   P31 就漏了「取得」——Playtest 那批寫的是「已**取得**【挑釁】」，
 *   而基本 115 條寫的是「已**習得**／已**學會**」，所以我量 115 條時它從來沒出現過。
 *   **這就是 MEMORY 鐵則 13 的第四次：樣本換了，邊界就變了。**
 */
const EXTRA_FILLER = /(必須|學會|習得|取得|獲得|學習了|已|技能|咒語|增益|中的|中|的|和|或|與|達到|技能等級|\d+|【|】|（|）|\(|\)|「|」|、|，|,|\s)/g;

/**
 * 把「額外前提」解析成**引擎能不能自己判**的形式。
 *
 * ## 為什麼要解析（原本刻意不解析）
 *
 * F-030 立案時的理由是「那是自由文字，猜錯會擋掉合法角色」。那個顧慮是真的，
 * 但**量過之後發現代價被高估了**：34 條裡有 28 條的條件就是一個或多個真實存在的技能名
 * （145 條職業技能 ＋ 38 條咒語），而且角色卡本來就存著 `classes[].skills = [{name, sl}]`。
 * 缺的只是「把句子拆成名詞」這一步。
 *
 * 所以現在分兩條路：
 * - **認得出來 → 直接判**，判不過就寫「需先學會【招架反擊】」，玩家知道缺什麼；
 * - **認不出來 → 交回玩家**（勾「我符合這個前提」），不假裝知道。
 *
 * ## 認不出來的情況（逐條釘在測試裡）
 *
 * 1. **「有那個技能」≠「有那個變體」**：【根源共生】要「忠實夥伴（植物物種）」、
 *    【這東西是活著的】要「忠實夥伴（構裝體物種）」——App 知道你有忠實夥伴，
 *    不知道你選了哪個物種（**2026-10-29 已改成判得出來，見 `resolveCompanionSpeciesGate`**）。
 * 2. **「有那個技能」≠「拿了那個增益」**：【藥水霧化】【大鍋秘方】【量子魔加農】
 *    要「透過小工具獲得高級煉金術／高級魔科技」——App 知道你有小工具，不知道你拿了哪個。
 * 3. **團務層面的限制**：【收割行者】的「同一團中…」與【躍空】同類，屬 `findDuplicateStartingHeroicSkills`。
 *
 * ※ 【奧法戰士】的「至少學會兩個攻擊性咒語」原本也在這張清單上，理由寫的是
 *   「38 條咒語沒有攻擊性欄位，數不出來」。2026-10-29 GM 裁定補上 `isOffensive` 之後
 *   它變成 `offensiveSpells` 分支，**這條已經不在了**——清單會過期，量一次再改。
 *
 * @returns {{
 *   text: string, hasExtra: boolean, checkable: boolean,
 *   mode: 'all'|'any', needs: Array<{kind:string,name:string}>,
 *   skillLevel: null|{name:string, level:number},
 *   offensiveSpells: null|number, companionSpecies: null|string
 * }}
 */
export const resolveHeroicExtraRequirement = (skill) => {
  const text = heroicSkillExtraPrerequisite(skill);
  const none = {
    text: '', hasExtra: false, checkable: true, mode: 'all', needs: [],
    skillLevel: null, offensiveSpells: null, companionSpecies: null, gadgetTier: null
  };
  if (!text) return none;

  const unknown = {
    text, hasExtra: true, checkable: false, mode: 'all', needs: [],
    skillLevel: null, offensiveSpells: null, companionSpecies: null, gadgetTier: null
  };

  // ① 「【魔法卡組】達到技能等級 3」：技能等級存在角色卡裡，判得出來。
  const sl = /【([^】]+)】\s*達到技能等級\s*(\d+)/.exec(text);
  if (sl) {
    return {
      text,
      hasExtra: true,
      checkable: true,
      mode: 'all',
      needs: [{ kind: 'skill', name: sl[1] }],
      skillLevel: { name: sl[1], level: Number(sl[2]) },
      offensiveSpells: null,
      companionSpecies: null,
      gadgetTier: null
    };
  }

  // ② 「至少學會兩個攻擊性咒語」（【奧法戰士】）：38 條咒語現在有 `isOffensive`，數得出來。
  const off = /至少\s*(?:學會|習得|取得|獲得)?\s*([一二兩三四五六\d]+)\s*個?\s*攻擊性咒語/.exec(text);
  if (off) {
    return {
      text,
      hasExtra: true,
      checkable: true,
      mode: 'all',
      needs: [],
      skillLevel: null,
      offensiveSpells: { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6 }[off[1][0]] || Number(off[1]) || 1,
      companionSpecies: null,
      gadgetTier: null
    };
  }

  // ③ 「忠實夥伴（構裝體物種）」（【這東西是活著的】【根源共生】）：
  //    物種存在 `character.wayfarerData.companion.species`，判得出來。
  //
  //    ※ 這裡**不能**直接 return。這一句是條件裡的**其中一段**：
  //      【這東西是活著的】寫的是「已習得忠實夥伴（構裝體物種）**和**高瞻遠矚技能」，
  //      提早回傳就等於把【高瞻遠矚】整個丟掉——那正是 P32【躍空】的同一個錯誤。
  //      所以物種只是「先挖掉、記下來」，剩下的字繼續走下面的一般流程。
  // ※ `】?` 是必要的：條件欄現在統一寫成「已習得【忠實夥伴】（構裝體物種）」，
  //    名稱外面有【】，所以「忠實夥伴」後面接的是】而不是（。
  //    少了這一個字元，物種段就整段認不出來 → 那兩條會從「判得出來」退回「交回玩家」，
  //    而且**不會報錯**（看起來只是多問一次）。P34 就是這樣被抓到的。
  const speciesMatch = /忠實夥伴\s*】?\s*[（(]\s*([^）)]+?)\s*[）)]/.exec(text);
  const companionSpecies = speciesMatch ? speciesMatch[1].replace(/\s*物種\s*$/, '') : null;
  // **只挖掉括號那一段**（「（構裝體物種）」），名稱本身要留在句子裡——
  // 否則【忠實夥伴】不會進 `needs`，而「你有沒有這個技能」與「你的夥伴是什麼物種」
  // 是**兩件事**，兩個都要驗。結構護欄（條件裡【】寫到的技能名都要進 needs）就是這樣抓到它的。
  const speciesParen = speciesMatch ? /[（(][^）)]*[）)]/.exec(speciesMatch[0])[0] : '';
  let body = speciesParen ? text.split(speciesParen).join('') : text;

  // ③-b 「小工具【煉金術】已達高級益處」（【藥水霧化】【量子魔加農】【大鍋秘方】【爆裂藝術家】）：
  //      軌與檔次存在 `character.tinkererData.gadgets = { alchemy, infusion, magitech }`，
  //      那是玩家在科技樹上點到第幾檔——**資料一直都在**。
  //
  //      ※ 這裡同樣**挖掉、不提早 return**：以後若有條件寫成
  //        「小工具【煉金術】已達高級益處 和【某技能】」，後半段才不會被丟掉。
  //      ※ 舊寫法（「必須獲得小工具技能中的高級煉金術技能」）**刻意不支援**：
  //        資料層已經統一成一種寫法，留兩套只會讓下一個人以為兩種都要維護。
  const gadgetMatch = /小工具\s*【\s*([^】]+?)\s*】\s*已達\s*(基礎|高級|最高)益處/.exec(body);
  const gadgetTier = gadgetMatch
    ? { track: gadgetMatch[1], tier: { 基礎: 1, 高級: 2, 最高: 3 }[gadgetMatch[2]] }
    : null;
  if (gadgetMatch) body = body.split(gadgetMatch[0]).join('');

  // ④ 從文字裡認出可學習的名稱（長名優先；命中後就地佔位，避免短名重複命中）。
  let rest = body;
  const needs = [];
  for (const k of LEARNABLE_NAMES) {
    if (!rest.includes(k.name)) continue;
    rest = rest.split(k.name).join('\u0000');
    needs.push(k);
  }
  // 依**原文出現順序**排，不要用「長名優先」的比對順序：
  // 條件欄寫「【迅捷】或【竊取時間】」，訊息卻印「【竊取時間】或【迅捷】」，
  // 玩家會以為是兩件事（MEMORY：同樣的內容不能有不同的寫法，也不能有不同的順序）。
  needs.sort((a, b) => body.indexOf(a.name) - body.indexOf(b.name));

  // ⑤ 把職業名、填充詞、佔位符拿掉；還有殘留 → 有讀不懂的東西 → 交回玩家。
  let residual = rest;
  for (const cn of ALL_CLASS_NAMES) residual = residual.split(cn).join('');
  residual = residual.replace(/\u0000/g, '').replace(EXTRA_FILLER, '').trim();
  // 「只有物種那一段」是合法的（【根源共生】就只有這一段），
  // 「只有小工具那一段」也合法（【藥水霧化】等四條）——所以 needs 空但有物種或軌道就算數。
  if ((needs.length === 0 && !companionSpecies && !gadgetTier) || residual !== '') return unknown;

  // ⑥ 「和／與」＝全部都要，「或」＝任一個。兩個都出現＝語意不明，不猜。
  const hasAnd = /和|與/.test(text);
  const hasOr = /或/.test(text);
  if (hasAnd && hasOr) return unknown;

  return {
    text, hasExtra: true, checkable: true, mode: hasOr ? 'any' : 'all', needs,
    skillLevel: null, offensiveSpells: null, companionSpecies, gadgetTier
  };
};

/**
 * 「忠實夥伴的物種」這一段判不判得出來（【這東西是活著的】＝構裝體、【根源共生】＝植物）。
 *
 * 物種存在 `character.wayfarerData.companion.species`（**存的是名字**：野獸／構裝體／元素／植物，
 * 見 `WayfarerCompanionModal` 的 `species: sp.name`）。
 *
 * 三種結果：
 * - 對得上 → 通過；
 * - 對不上 → 講清楚「需要什麼、你現在是什麼」；
 * - **玩家還沒設計夥伴**（`actual` 是空的）→ 交回玩家。**不知道就不要假裝知道。**
 *   注意：`createDefaultCompanionData()` 會給 `species: '野獸'`，那是**預設值不是選擇**，
 *   所以這裡刻意看「有沒有值」而不是看那個值等於什麼。
 *
 * @param {string} required 條件裡寫的物種（已去掉「物種」二字，例：`構裝體`）
 * @param {string|null} actual 角色卡上的夥伴物種名字
 * @returns {{ok: boolean, reason?: string, needsPlayerConfirm?: boolean}}
 */
export const resolveCompanionSpeciesGate = (required, actual) => {
  const wanted = String(required || '').trim();
  const known = COMPANION_SPECIES.some((s) => s.name === wanted);
  if (!known) return { ok: true, needsPlayerConfirm: true };
  if (!actual) return { ok: true, needsPlayerConfirm: true };
  if (actual === wanted) return { ok: true, reason: '' };
  return { ok: false, reason: `需忠實夥伴是【${wanted}】物種（目前【${actual}】）` };
};

/**
 * 小工具的三條軌與三個檔次——**資料在 `GADGET_TRACKS`／`MAGITECH_CORE_NODES`，這裡只做對照**。
 *
 * 條件欄寫的軌名是玩家看到的字（煉金術／灌注術／魔導科技），角色卡存的是鍵
 * （`tinkererData.gadgets = { alchemy, infusion, magitech }`，值是 0–3 的檔次）。
 * 這兩邊的對照只寫在這裡，不要在各個元件裡各寫一份。
 */
const GADGET_TRACK_KEYS = Object.freeze({
  煉金術: { key: 'alchemy', label: '煉金術' },
  灌注術: { key: 'infusion', label: '灌注術' },
  魔導科技: { key: 'magitech', label: '魔導科技' },
  魔科技: { key: 'magitech', label: '魔導科技' }
});

/** 檔次 1–3 的名字。`0` ＝ 還沒點，訊息要說「尚未取得」而不是「基礎益處」。 */
const GADGET_TIER_LABELS = Object.freeze(['尚未取得', '基礎益處', '高級益處', '最高益處']);

/**
 * 「小工具【煉金術】已達高級益處」這一段判不判得出來。
 *
 * ## 為什麼現在判得出來（而 F-035 當時說判不出來）
 *
 * F-035 立案時寫的是「App 知道你有【小工具】，不知道你走了哪一軌」。
 * **那是錯的**：玩家在科技樹上點的每一檔都存進 `tinkererData.gadgets`，
 * 三條軌 × 三個檔次全部有值。2026-10-29 GM 一句「小工具的軌你自己不會讀嗎？」
 * 把這條問了回去——**資料一直都在，只是沒有人去讀**（和 F-041 的物種同一個病）。
 *
 * ## 三種結果
 *
 * - 檔次夠 → 通過；
 * - 檔次不夠 → 講清楚「需要哪一軌的哪一檔、你現在到哪裡」；
 * - **魔晶石制下的魔導科技** → 交回玩家。那一制把這一軌改寫了
 *   （魔加農火器整條移除、魔法球原型從最高降成高級，見 `resolveMagitechNodes`），
 *   同一個「高級」指的**不是同一個節點**，所以不猜。
 *
 * @param {{track: string, tier: number}|null} required 條件裡寫的軌與檔次
 * @param {{alchemy?: number, infusion?: number, magitech?: number}|null} gadgets 角色卡上的科技樹進度
 * @param {{technoRestrictsEquipment?: boolean}} options
 * @returns {{ok: boolean, reason?: string, needsPlayerConfirm?: boolean}}
 */
export const resolveGadgetTierGate = (required, gadgets, { technoRestrictsEquipment = false } = {}) => {
  const track = GADGET_TRACK_KEYS[required?.track];
  const tier = Number(required?.tier) || 0;
  // 認不得的軌名或檔次 → 不假裝知道。
  if (!track || tier < 1 || tier > 3) return { ok: true, needsPlayerConfirm: true };
  // **整份科技樹資料都沒有**（舊卡、還沒開過科技樹）→ 交回玩家。
  // 注意這跟「有資料但檔次是 0」不同：0 是「點過，確實一檔都沒有」，可以照實擋。
  // 分不出這兩種就擋，等於用「沒有紀錄」推定「你沒點」——那是假裝知道。
  if (!gadgets || typeof gadgets !== 'object') return { ok: true, needsPlayerConfirm: true };

  // 魔晶石制把魔導科技的「第幾檔是什麼」換掉了，同一個詞指不同節點 → 不猜。
  if (track.key === 'magitech' && technoRestrictsEquipment && tier >= 2) {
    return { ok: true, needsPlayerConfirm: true };
  }

  const have = Math.max(0, Math.min(3, Number(gadgets?.[track.key]) || 0));
  if (have >= tier) return { ok: true, reason: '' };
  return {
    ok: false,
    reason: `需小工具【${track.label}】達${GADGET_TIER_LABELS[tier]}（目前${GADGET_TIER_LABELS[have]}）`
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

    // 營地活動（自然奇幻手冊 p.130–133 的選用規則）。
    // **預設是空的**：建角時不替玩家挑活動（與四維屬性、羈絆、金手指、底力技同一原則）。
    // `used` 是「直到下一次休息前限一次」的追蹤欄位，由跑團面板寫入、休息時清空。
    // 舊存檔沒有這個欄位 → `normalizeCampActivities` 收斂成空狀態，行為與以前完全相同。
    campActivities: createCampActivityState(),

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
    const cName = normalizeClassName(cl.className || '');
    const classDef = rulesData.classes[cName];
    const fb = (classDef?.freeBenefits || '') + ' ' + (classDef?.freeBonus || '');

    if (fb.includes('近戰') || ['武器大師', '暗黑之刃', '狂怒鬥士', '指揮官'].some(n => cName.includes(n))) profs.martialMelee = true;
    if (fb.includes('遠程') || ['神射手', '指揮官', '機師'].some(n => cName.includes(n))) profs.martialRanged = true;
    if (fb.includes('防具') || ['守護者', '暗黑之刃', '狂怒鬥士'].some(n => cName.includes(n))) profs.martialArmor = true;
    if (fb.includes('盾牌') || ['守護者', '武器大師', '神射手', '指揮官'].some(n => cName.includes(n))) profs.martialShields = true;
  });

  // 金手指給的熟練度（F-025，2026-10-27）。
  //
  // 原書的【倖存者】①寫「獲得裝備職業近戰武器、職業遠程武器、職業盾牌與職業防具的能力」。
  // 以前這一項在資料層沒有 `effects`，所以選了之後 `profs` 四項**全部仍是 false**——
  // 玩家選了「可以穿職業防具」，到第 4 步照樣被擋，而且看不出是 App 沒做。
  //
  // 判定方式刻意用「資料層宣告 + 逐項 OR」，不在這裡寫職業名或金手指名：
  // 之後任何金手指要給熟練度，只要在 `effects.profs` 列出四個鍵即可。
  (getQuirkEffects(char).profs || []).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(profs, key)) profs[key] = true;
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

/**
 * 金手指 effects 裡「會累加成陣列」的鍵（其餘數字鍵一律相加）。
 *
 * `profs`（2026-10-27，F-025）：四項職業武裝熟練度是**布林**，但選項的語意是
 * 「獲得這四項能力」——所以宣告成「要打開哪幾項」的清單，由 `getProficiencies`
 * 逐項 OR 進去。放在這裡而不是在引擎寫 `if (quirkName === '倖存者')`：
 * 資料層宣告、引擎只負責合併，下一個金手指要給熟練度時不必改程式。
 */
const QUIRK_FX_ARRAY_KEYS = ['resistances', 'vulnerabilities', 'absorption', 'immuneDamage', 'immuneStatuses', 'profs'];

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
/**
 * 玩家在這個金手指上「選了什麼」——給列印卡與其他唯讀畫面用的純文字（F-027，2026-10-27）。
 *
 * 為什麼需要它：列印卡原本只印 `rulesData.quirks[].desc`（原書全文），
 * 於是印出來的紙上寫著「在風、電、暗、土、火、冰和光屬性中選擇 2 種」，
 * 但**你選了火、光、冰這件事紙上沒有**。玩家帶去團裡只能憑記憶。
 *
 * 回傳 `[{ group, label }]`：多組的金手指要知道「哪一組選了什麼」，
 * 只印 label 會出現兩個一樣的字串而分不出來。單組時 `group` 是空字串。
 * 沒選、選了不存在的 id、舊存檔 → 回空陣列（呼叫端用「有沒有內容」決定要不要印）。
 */
export const describeQuirkChoice = (char) => {
  const quirk = findQuirkDef(char?.quirk);
  if (!quirk) return [];
  const choice = char?.quirkChoice;
  const labelOf = (list, id) => (list || []).find((o) => o && o.id === id)?.label || '';
  const out = [];

  if (Array.isArray(quirk.optionGroups) && quirk.optionGroups.length > 0) {
    quirk.optionGroups.forEach((group) => {
      const id = choice && typeof choice === 'object'
        ? choice[group.id]
        : (typeof choice === 'string' ? choice : '');
      const label = labelOf(group.options, id);
      if (label) out.push({ group: group.label || '', label });
    });
    return out;
  }

  const id = typeof choice === 'string' ? choice : (choice && choice.default) || '';
  const label = labelOf(quirk.options, id);
  if (label) out.push({ group: '', label });
  return out;
};

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
    unarmedDamageBonusHigh: 0,
    // 金手指給的起始資金加成（F-025）：【富家子弟】的 +1000z。
    // 放在金手指效果裡而不是 `stats` 的數字欄位，因為**起始資金不是衍生數值**——
    // 它是一次性寫進 `character.zenit` 的存量，不是每幀重算的量。
    startingZenitBonus: 0
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
    // 金手指給的職業武裝熟練度（F-025）：值是 `getProficiencies` 的四個鍵之一。
    // 空陣列＝沒給任何一項（絕大多數金手指）。
    profs: merged.profs || [],
    defIfNoWeapon: merged.defIfNoWeapon || 0,
    mdefIfNoWeapon: merged.mdefIfNoWeapon || 0,
    defIfNoArmor: merged.defIfNoArmor || 0,
    mdefIfNoArmor: merged.mdefIfNoArmor || 0,
    unarmedDamageBonus: merged.unarmedDamageBonus || 0,
    unarmedDamageBonusHigh: merged.unarmedDamageBonusHigh || 0,
    startingZenitBonus: merged.startingZenitBonus || 0
  };
};

/**
 * 金手指給的**起始資金加成**（F-025，2026-10-27）。
 *
 * 【富家子弟】原書：「如果你在創建角色時選擇了這個金手指，你的初始資金將增加 1000z。」
 *
 * 為甚麼要獨立一個函式而不是塞進 `stats`：
 * 起始資金是**存量**（一次性寫進 `character.zenit`），不是衍生數值。
 * 混進 `stats` 會變成「每幀重算的加成」，於是玩家花掉的錢會一直被補回來。
 *
 * 為甚麼不在「結算起始資金」時加：金手指在第 5 步選，而結算在第 1 步，
 * 照流程走**永遠加不到**。所以改由呼叫端在「換金手指」的當下補／退，
 * 並用 `character.quirkZenitBonus` 記住「已經補過多少」——
 * 這樣來回換金手指不會重複加，也不會漏退。
 */
export const getQuirkStartingZenitBonus = (char) => getQuirkEffects(char).startingZenitBonus || 0;

/**
 * 換金手指時要寫入的欄位包（F-025，2026-10-27）。
 *
 * 抽成純函式而不是留在 `CharacterEditor` 的 onClick 裡，是為了**測得到**：
 * 這段邏輯有三種會出錯的方式，而三種都不會讓畫面壞掉，只會讓角色默默多拿或少拿錢——
 *
 *   1. 來回換金手指時**重複加**：富家子弟 → 無 → 富家子弟，zenit 變 +2000；
 *   2. 從富家子弟換走時**沒退**：角色白拿 1000z；
 *   3. 只寫了 `zenit` 卻沒寫帳本：下一次換金手指時 `applied` 還是 0，於是再加一次。
 *
 * 三種都要靠「把結果算出來比對」才抓得到，看畫面是看不出來的。
 *
 * @param {object} character 目前角色
 * @param {string} nextName 新金手指名稱（取消＝`'無'`）
 * @param {string} [choiceId] 新選項 id
 * @returns {object} 要交給 `updateField` 的欄位包
 */
export const buildQuirkPatch = (character, nextName, choiceId) => {
  const nextChoice = choiceId || '';
  const nextBonus = getQuirkStartingZenitBonus({ quirk: nextName, quirkChoice: nextChoice });
  const applied = (character && character.quirkZenitBonus) || 0;
  const delta = nextBonus - applied;
  return {
    quirk: nextName,
    quirkChoice: nextChoice,
    quirkZenitBonus: nextBonus,
    // 差額為 0 就不碰 zenit——不然每次換金手指都會寫一筆「金額沒變」的歷史記錄。
    ...(delta === 0 ? {} : { zenit: Math.max(0, ((character && character.zenit) || 0) + delta) })
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
    const cName = normalizeClassName(cl.className || '');
    const classDef = rulesData.classes[cName];
    const fb = (classDef?.freeBenefits || '') + ' ' + (classDef?.freeBonus || '');
    const clsLabel = cName || '未知職業';

    // 二選一職業判定 (秘儀師【變體】、死靈術士、舞者、祈喚者、植物學家、卡牌大師)
    //
    // 2026-10-27（F-018）：判定改走 `resolveChosenBenefit`。以前這裡直接比
    // `cl.chosenBenefit === 'MP'`，而另外兩個消費端（修改記錄、列印卡）比的是小寫
    // `'mp'`／`'hp'`——同一份資料兩種寫法，結果是「記錄說你選了 HP、列印卡什麼都不印」。
    // 現在三個地方吃同一個函式，寫法不可能再漂移。
    if (isHpMpChoiceBenefit(fb)) {
      if (resolveChosenBenefit(classDef, cl) === 'MP') {
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
  const normName = (n) => normalizeEquipmentName((n || '').replace(/\s*\([^)]*\)/g, '').trim());
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
  // 「徒手打擊」在武器表裡是**真的存在的一筆**（`category: 鬥毆`、`cost: 0`、`hands: 1`），
  // 而開卡預設的 `mainHand` 正是它。所以「空手」的判定不能只看 `!mainHandDef`，
  // 要連「查到的是徒手打擊」一起算。這個常數往上提，是因為下面兩個地方都要用：
  // 徒手傷害加成（F-024）與「空手時才生效」的防禦加成。
  const UNARMED_ENTRY = '徒手打擊';
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

  // 空手道的徒手傷害加成（F-024，2026-10-27）。
  //
  // 原書【空手道】：「你的徒手打擊傷害獲得 +6（30 級後改為 +10）」。以前這個數字
  // 只被放進 `stats.quirkEffects`，編輯器把它**印成一行字**，但攻擊公式讀的是
  // 武器條目自己的 `damage`（`【HR + 0】物理`），所以跑團時照樣是 +0——
  // 玩家看到「編輯器說 +6、打團寫 +0」，只能自己記著手動加。
  //
  // 這裡直接改寫 `mainHandWeapon.damage` 的 HR，讓**所有**讀武器條目的地方
  // （跑團面板的膠囊、列印卡、之後新增的消費端）自動拿到正確數字。
  // 只在「主手真的是徒手」時才加：拿著劍的空手道徒不該多 6 點。
  const unarmedDamageBonus = (getCharacterLevel(char) >= 30 && quirkFx.unarmedDamageBonusHigh)
    ? quirkFx.unarmedDamageBonusHigh
    : quirkFx.unarmedDamageBonus;

  // 定制武器的【物防提升】與【魔防提升】（HF p.107）。
  // 這兩項是「持有者獲得加值」，不是武器本身的數值，所以算在這裡而不是武器條目裡。
  // `countsAsShield` 另外回報給技能判定——原書明講它會被視為裝備著一面盾牌。
  const isUnarmed = !mainHandDef || mainHandDef.name === UNARMED_ENTRY;
  const mainHandWeapon = (isUnarmed && unarmedDamageBonus > 0 && mainHandDef)
    // 複製一份再改：`mainHandDef` 是 `rulesData` 的共享物件，
    // 直接改它會把加成寫進全站共用的武器表，下一個角色也跟著 +6。
    ? { ...mainHandDef, damage: withHrBonus(mainHandDef.damage, unarmedDamageBonus), unarmedDamageBonus }
    : mainHandDef;
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
      unarmedDamageBonus
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
  // 上下限相同時不要寫成「3~3」（F-012，2026-10-27）。
  // 魔晶石制把 min／max 一起鎖成 3，於是原本的模板拼出「需配置 3~3 個職業」——
  // 「3 到 3」讀起來像還要挑，實際上是「剛好 3 個」。而這句話出現在**最需要明確**的位置。
  // F-012 第 9 處（2026-10-27，P16 掃描補抓）：這段原本自己比 min === max 再拼字串，
  // 是 classCountPhrase 的第三份複本。輸出字面完全相同（「恰好 3」／「2~3」），
  // 差別只在以後改規則時不必再來這裡改一次。
  const countPhrase = classCountPhrase(creation);
  // 空格只影響排版，但這是玩家看得到的紅字，改動前後必須一字不差：
  // 接「恰好」時不加空格（需配置恰好 3 個職業），接區間時要加（需配置 2~3 個職業）。
  const classCountRequirement = `需配置${countPhrase.startsWith('恰好') ? '' : ' '}${countPhrase} 個職業`;
  // 記錄「這一段有沒有已經說過職業數不對」（F-011）。
  // 下面那段魔晶石檢查講的是同一件事，只是換句話說；兩條並列會讓玩家以為是兩個缺口。
  let classCountReported = false;
  if (char.level === creation.startingLevel) {
    if (classCount === 0) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `尚未選擇任何職業 (起始 ${creation.startingLevel} 級${classCountRequirement})`
      });
      classCountReported = true;
    } else if (classCount < creation.classCountMin) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `起始需至少 ${creation.classCountMin} 個職業，目前只有 ${classCount} 個 (不可純單職)`
      });
      classCountReported = true;
    } else if (classCount > creation.classCountMax) {
      warnings.push({
        step: 2,
        field: 'classes',
        type: 'error',
        message: `起始不可超過 ${creation.classCountMax} 個職業，目前有 ${classCount} 個`
      });
      classCountReported = true;
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
  //
  // 但**起始等級時上面那段已經說過同一件事**（F-011，2026-10-27）。
  // 魔晶石制把 `classCountMin`／`classCountMax` 一起鎖成 3，所以「不是 3 個」
  // 一定也會被上面那三條抓到一次，於是玩家看到兩條並列的 error 在講同一個缺口：
  //   「尚未選擇任何職業 (起始 5 級需配置恰好 3 個職業)」
  //   「魔晶石制需恰好 3 個固有職業（目前 0 個），且升級不得新增職業」
  // 用 `!classCountReported` 排除掉重複的那一種情況，而不是寫 `classCount > 0`——
  // 後者會在「已經離開起始等級、職業數是 0」時**兩條都不報**，變成靜默放行。
  if (isTechnosphereEnabled(creation.technospheres)
    && classCount !== INNATE_CLASS_COUNT
    && !classCountReported) {
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
  // 「已經學會哪些技能／咒語」——P32 才補上。以前這裡只傳職業與等級，
  // 於是**額外技能前提從來沒有被重審**：選的時候是勾選框（玩家自己說符合），
  // 選完之後也沒有人再看一眼。GM 2026-10-29 回報的
  // 「明明沒有選【舞刀弄叉】還能拿【指節三明治】」就是這條路徑的漏洞。
  const learnedSkills = (char.classes || []).flatMap((c) => c.skills || []);
  // 咒語：三學派的存在 `char.spells`（存名字），嵌合師自己記下的存在
  // `char.chimeristData.spells`（存物件，帶 `isOffensive`）。兩邊都要算，
  // 否則【奧法戰士】會漏數嵌合師記下的攻擊性咒語，把合法角色擋掉。
  const learnedSpells = [
    ...(char.spells || []).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean),
    ...(char.chimeristData?.spells || [])
  ];
  // 忠實夥伴的物種（【這東西是活著的】＝構裝體、【根源共生】＝植物）。
  // 玩家還沒設計夥伴時是 undefined → 那兩條仍然交回玩家，不假裝知道。
  const companionSpecies = char.wayfarerData?.companion?.species || null;
  // 小工具的三條軌點到第幾檔（【藥水霧化】等四條要看這個）。
  // 玩家沒開過科技樹時是 undefined → 檔次一律算 0（「尚未取得」）。
  const gadgets = char.tinkererData?.gadgets || null;
  // 魔晶石制會改寫魔導科技那一軌，同一個「高級」指的不是同一個節點 → 那一條交回玩家。
  const technoRestrictsEquipment = modeRestrictsEquipment(
    resolveCreationRules(char?.creationRules).technospheres
  );
  const masteryGate = (def) => checkHeroicSkillRequirement(def, {
    masteredClasses: stats.masteredClasses,
    // 「不必精通」型的技能（例：銃劍士）在精通路徑也要比對「擁有」，
    // 所以這裡一律把現有職業一起傳進去
    classes: ownedClasses,
    level: charLevel,
    learnedSkills,
    learnedSpells,
    companionSpecies,
    gadgets,
    technoRestrictsEquipment
  });
  const creationGate = (def) => checkHeroicSkillRequirement(def, {
    classes: ownedClasses,
    level: charLevel,
    atCreation: true,
    learnedSkills,
    learnedSpells,
    companionSpecies,
    gadgets,
    technoRestrictsEquipment
  });

  const viaCreationSlot = [];
  heroic.forEach((entry) => {
    const name = normalizeHeroicSkillName(typeof entry === 'string' ? entry : entry?.name);
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
    const name = normalizeHeroicSkillName(typeof entry === 'string' ? entry : entry?.name);
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

  // ── 步驟 5：營地活動（自然奇幻手冊 p.130–133 的選用規則）
  //
  // 「規則沒開就不管」的原則與底力技完全相同：舊角色身上殘留的 `campActivities`
  // 資料不該在關閉後變成警告。
  // 差別是本規則多一個**金手指出口**——【老大哥／歐尼醬】的原文寫著「如果你跑的團
  // 沒有使用營地活動，你的角色仍然可以使用它，而且可以選 3 種」，所以判定走
  // `campActivityAccess`（規則或金手指任一成立），不是只看開關。
  const campAccess = campActivityAccess(char, creation);
  if (campAccess.enabled) {
    campActivityIssues(normalizeCampActivities(char.campActivities), {
      allowance: campAccess.allowance
    }).forEach((issue) => {
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
 * 為什麼 label 是「英雄技能與金手指」（F-029，2026-10-27 改名）：
 * 原本叫「英雄技能與特質」，但「特質」在這個 App 裡已經是**另一個東西**——
 * 第 1 步 d20 身世表的那 40 種特質（`CharacterEditor.jsx` 的對照表標題寫著「40 種特質」）。
 * 「特質」其實是金手指的**舊名**（F-003 那個年代的用語），步驟名一路沿用下來，
 * 於是玩家在第 1 步把「特質」選完，到第 5 步又看到一個叫「特質」的步驟，
 * 而裡面一個 d20 特質都沒有。改名比改 d20 那邊安全：只動一個字串，
 * 不動資料、也不動玩家既有的理解（`findings.md` F-029 建議①）。
 *
 * `CharacterEditor.jsx` 的 `TABS` **直接由這裡派生**（不再各自硬編碼），
 * 所以兩份清單的步驟名稱在結構上不可能再漂移。
 */
export const CREATION_STEPS = Object.freeze([
  { id: 1, label: '基礎身世', doneHint: '身分、主題、故鄉都已填寫' },
  { id: 2, label: '職業與技能', doneHint: '職業組合與技能點數已配置' },
  { id: 3, label: '四維屬性', doneHint: '骰階點數已分配完成' },
  { id: 4, label: '裝備配置', doneHint: '武裝與防具已就緒' },
  { id: 5, label: '英雄技能與金手指', doneHint: '沒有需要設定的項目' },
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
 * 把一條驗證訊息壓成「一句話的開頭」，給 `title` 這種只能塞一行的地方用。
 *
 * 原文常帶括號補充與破折號解釋，整條塞進 tooltip 會爆版。例：
 *   起始資金尚未結算（原書 p.165：剩餘預算 ＋ 2d6 × 10）——目前顯示的 500z 是裝備預算…
 *   → 起始資金尚未結算
 *
 * 切在第一個「（／(／——／；」之前。**不切在句尾**：有些訊息本來就只有一句，
 * 硬截會截掉主詞。所以再加一道長度上限，超過才加「…」。
 */
const ISSUE_LABEL_CUT = /[（(；;]|——/;
const ISSUE_LABEL_MAX = 24;

export const shortIssueLabel = (message) => {
  const text = String(message || '').trim();
  if (!text) return '';
  const cut = text.search(ISSUE_LABEL_CUT);
  const head = (cut > 0 ? text.slice(0, cut) : text).trim();
  return head.length > ISSUE_LABEL_MAX ? `${head.slice(0, ISSUE_LABEL_MAX)}…` : head;
};

/** 「按不下去時要說得出原因」——`title` 最多列幾條（其餘收成「…等 N 項」）。 */
const LOCK_HINT_MAX_ITEMS = 3;

/**
 * 創角狀態的**單一來源**（2026-10-26，群 A 重構：F-004／F-005／F-010）。
 *
 * ## 為什麼要有這個函式
 *
 * 在此之前，畫面上同時存在**三個各自計算的數字**，而且分母不一樣：
 *
 * | 位置 | 算什麼 | 空卡 R01 | 空卡 R05（魔晶石） |
 * |---|---|---|---|
 * | 頁首「還有 N 項未符合規則」 | **有 error 的步驟數** | 2 | **2**（沒跟上） |
 * | 左側「N 項待修正」 | **error 訊息條數** | 2 | **3** |
 * | 導航列圓點 | 每步一個（紅＝有 error／橘＝只有提醒） | 2 紅 3 橘 | 2 紅 3 橘 |
 *
 * 三個數字都「對」，只是回答不同問題；但畫面上長得像是同一件事，
 * 於是玩家問「5 個橘點，但只有 2 項？那 3 個橘點是不用管的嗎？」。
 *
 * 修法不是「把三個數字調成一樣」（步驟數與訊息條數本來就不會相等——
 * 第 2 步可能有兩條 error，那是 2 項、1 步），而是**讓每一個數字都說清楚自己在數什麼**，
 * 而且**全部從這裡出來**，不再各自 `filter` 一遍。
 *
 * ## 兩個計數的定義
 *
 * - `blockerCount`＝**必須修正**的條數（`type === 'error'`）。歸零才能定稿。
 * - `suggestionCount`＝**提醒**的條數（`warning` ＋ `info`）。不擋定稿。
 *
 * 這兩個加起來才是 `validation.warnings.length`。以前頁首只數前者、
 * 自檢卡在沒有 error 時只數後者，所以同一張卡會看到「2」和「10」兩個數字。
 */
export const deriveCreationState = (char, rules = null) => {
  const validation = validateCharacter(char, rules);
  const checklist = buildCreationChecklist(char, rules);

  const blockers = validation.errors;
  const suggestions = validation.warnings.filter((w) => w.type !== 'error');
  const blockerSteps = [...new Set(blockers.map((b) => b.step))].sort((a, b) => a - b);
  const suggestionSteps = [...new Set(suggestions.map((s) => s.step))].sort((a, b) => a - b);
  const blockerLabels = blockers.map((b) => shortIssueLabel(b.message));

  const canLock = blockers.length === 0;

  // F-005：灰掉的按鈕原本只說「定稿後會怎樣」，沒說「現在為什麼不能按」。
  // 這裡把缺口直接寫進 title——想定稿的人不必自己去左側翻詳情。
  const lockHint = canLock
    ? '定稿後創角欄位凍結，只留成長相關欄位'
    : `尚缺：${blockerLabels.slice(0, LOCK_HINT_MAX_ITEMS).join('、')}${
      blockerLabels.length > LOCK_HINT_MAX_ITEMS
        ? `…等 ${blockerLabels.length} 項`
        : ''
    } —— 點左側「規則自檢」看詳情`;

  return {
    validation,
    checklist,
    checklistById: new Map(checklist.map((item) => [item.id, item])),
    blockers,
    suggestions,
    blockerSteps,
    suggestionSteps,
    blockerCount: blockers.length,
    suggestionCount: suggestions.length,
    blockerLabels,
    canLock,
    lockHint
  };
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
