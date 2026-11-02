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
 *   除此之外，角色不會憑空習得咒語。非施法者就是沒有，這不是資料沒填。
 *
 * ── 儀式（核心手冊 118~121 頁）──
 *   施展儀式需要對應學派的職業技能（秘儀／嵌合／元素／熵系／靈魂學派儀式），
 *   或職業免費能力賦予的【儀式學派】權限（元素師、熵師、靈師、嵌合師）。
 *   沒有的人**只能在同伴施展時參與團隊檢定協助**——那是一個協助動作，
 *   不是自己扣 MP 擲施法檢定。所以「無權者按鈕」不只是文案不準，是規則錯誤。
 *
 * ## 契約
 *
 * `describeSpellGrants(character, resolvedSpells)` 回傳「這個角色能學幾個、
 * 哪些學派、還剩幾個」；`describeRitualRights(character)` 回傳「能不能獨自
 * 施展儀式、哪些學派」。UI 只負責照著畫，不自己判斷規則。
 *
 * `resolvedSpells` 由呼叫端傳入（`resolveCharacterSpells(character)` 的結果）。
 * 這樣本檔不必依賴 `characterEngine`，避免循環匯入。
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
 * 會授予儀式權限的職業技能，以及各自的施法公式（核心手冊 118~121 頁）。
 * `formula` 用專案既有的 `parseCheckFormula` 可解析格式。
 */
export const RITUAL_SKILL_SOURCES = Object.freeze([
  { skill: '秘儀學派儀式', name: '秘儀', formula: 'WLP + WLP' },
  { skill: '嵌合學派儀式', name: '嵌合', formula: 'INS + WLP' },
  { skill: '元素學派儀式', name: '元素', formula: 'INS + WLP' },
  { skill: '熵系學派儀式', name: '熵系', formula: 'INS + WLP' },
  { skill: '靈魂學派儀式', name: '靈魂', formula: 'INS + WLP' }
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
 * 描述角色的咒語取得額度。
 *
 * @param {object} character 角色（可為 null／不完整，一律回空結果）
 * @param {Array<{name?:string, school?:string}>} [resolvedSpells]
 *        `resolveCharacterSpells(character)` 的結果，用來計算「已用幾個」
 * @returns {{
 *   hasPath: boolean,
 *   grants: Array<{key:string,label:string,school:string,sl:number,capacity:number}>,
 *   allowedSchools: string[],
 *   capacity: number,
 *   used: number,
 *   remaining: number,
 *   canLearn: boolean,
 *   hasExtraGrant: boolean,
 *   chimerist: {sl:number, capacity:number, used:number} | null,
 *   summary: string
 * }}
 */
export const describeSpellGrants = (character, resolvedSpells = []) => {
  const levels = collectSkillLevels(character);
  const heroicNames = collectHeroicNames(character);
  const spells = Array.isArray(resolvedSpells) ? resolvedSpells : [];

  const grants = [];
  SPELL_GRANT_SOURCES.forEach((src) => {
    const sl = levels.get(src.skill) || 0;
    if (sl <= 0) return;
    grants.push({
      key: src.skill,
      label: src.label,
      school: src.school,
      sl,
      capacity: src.perSl * sl
    });
  });

  const hasExtraGrant = heroicNames.includes(EXTRA_SPELL_SKILL);
  if (hasExtraGrant) {
    grants.push({
      key: EXTRA_SPELL_SKILL,
      label: '額外咒語（英雄技能）',
      school: '',
      sl: 1,
      capacity: EXTRA_SPELL_GRANT
    });
  }

  // 可選清單：有對應技能的學派，加上額外咒語開放的「同清單任一」。
  const allowedSchools = [];
  grants.forEach((g) => {
    if (g.school && !allowedSchools.includes(g.school)) allowedSchools.push(g.school);
  });
  if (hasExtraGrant) {
    CORE_SPELL_SCHOOLS.forEach((s) => {
      if (!allowedSchools.includes(s)) allowedSchools.push(s);
    });
  }

  const capacity = grants.reduce((sum, g) => sum + g.capacity, 0);
  // 已用：只算核心三清單的咒語。嵌合師那本不在此列（它不在本地規則庫裡）。
  const used = spells.filter((sp) => CORE_SPELL_SCHOOLS.includes(sp?.school)).length;
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

  const hasPath = capacity > 0 || Boolean(chimerist);

  const pieces = grants
    .filter((g) => g.capacity > 0)
    .map((g) => (g.school ? `${g.label} SL ${g.sl}` : `${g.label} +${g.capacity}`));
  if (chimerist) pieces.push(`${CHIMERIST_SKILL} SL ${chimerist.sl}`);
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
    summary
  };
};

/**
 * 描述角色的儀式施展權限。
 *
 * @param {object} character
 * @returns {{
 *   canPerform: boolean,
 *   schools: Array<{name:string, formula:string, from:string}>,
 *   primary: {name:string, formula:string, from:string} | null,
 *   summary: string
 * }}
 */
export const describeRitualRights = (character) => {
  const levels = collectSkillLevels(character);
  const schools = [];
  const push = (entry) => {
    if (schools.some((s) => s.name === entry.name)) return;
    schools.push(entry);
  };

  // ① 職業技能：<學派>學派儀式。
  RITUAL_SKILL_SOURCES.forEach((src) => {
    if ((levels.get(src.skill) || 0) <= 0) return;
    push({ name: src.name, formula: src.formula, from: src.skill });
  });

  // ② 職業免費能力：freeBonus 內含「儀式學派」者（元素師／熵師／靈師／嵌合師）。
  (Array.isArray(character?.classes) ? character.classes : []).forEach((cl) => {
    const def = rulesData.classes?.[cl?.className];
    if (!def) return;
    const bonusText = `${def.freeBonus || ''}${def.freeBenefits || ''}`;
    if (!bonusText.includes(GENERIC_RITUAL_BONUS)) return;
    push({ name: '儀式', formula: GENERIC_RITUAL_FORMULA, from: `${cl.className} 免費能力` });
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
          formula: String(opt).includes('秘儀') ? 'WLP + WLP' : 'INS + WLP',
          from: '儀式學派'
        });
      });
    });
  });

  return {
    canPerform: schools.length > 0,
    schools,
    primary: schools[0] || null,
    summary: schools.map((s) => s.name).join('、')
  };
};
