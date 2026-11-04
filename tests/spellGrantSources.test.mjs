/**
 * 咒語與儀式「授予來源」的測試（`utils/spellGrants.js` 的來源表）。
 *
 * 執行：`npm run test:grantsource`
 *
 * ## 為什麼要有這支測試（2026-11-03）
 *
 * `tests/spellGrants.test.mjs` 守的是**核心路徑**（三條魔法技能的額度、職業技能的
 * 儀式權）。它全綠的同時，跑團面板上仍然有三個真實的坑，因為它只測「職業技能」：
 *
 *   ① `spellGrants.js` 完全不讀 `character.quirk` → 金手指給的「學一個咒語／取得
 *      儀式權」在非施法者身上失效（面板顯示 0/0，學不了）。
 *   ② 幻影／塞壬之歌／青翠之勢／領航員（四條擴充職業技能）的儀式學科不在
 *      `RITUAL_SKILL_SOURCES` → 角色明明有技能，面板卻說「本角色尚無儀式權」。
 *   ③ 彗星／火山／希望／瘴氣（四條英雄技能點名的咒語）本體不在 `rulesData.spells`
 *      → 學不到，也放不出（施放要讀 `mp`／`target`／`duration`／`effect`）。
 *
 * 這支測試的每一條都要能**真的紅**：
 *   - 正向：該 +1 的真的 +1（不是「有回傳就好」）。
 *   - **反向斷言**：沒有那個金手指／技能／英雄技能的角色**不受影響**——
 *     少了反向，「所有人都 +1」這種假修好也會全綠。
 *   - 對照組（F 段）：把來源表換成空表 → 同一組情境必須塌回 0，
 *     證明紅綠真的來自這些表，而不是「剛好」。
 *
 * ※ 本檔只讀資料與純函式，不碰 DOM／localStorage／React（SSR 測得到）。
 */
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import { PLAYTEST_HEROIC_SKILLS } from '../src/features/character-sheet/data/playtestHeroicSkills.js';
import {
  CORE_SPELL_SCHOOLS,
  HEROIC_SPELL_SOURCES,
  QUIRK_RITUAL_SOURCES,
  QUIRK_SPELL_SOURCES,
  RITUAL_SKILL_SOURCES,
  describeRitualRights,
  describeSpellGrants
} from '../src/features/character-sheet/utils/spellGrants.js';

let results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

/** 造一個骨架角色：不碰 localStorage、不碰 React。 */
const mk = ({
  classes = [],
  heroicSkills = [],
  spells = [],
  quirk = '無',
  quirkChoice = ''
} = {}) => ({ name: '授予來源測試', classes, heroicSkills, spells, quirk, quirkChoice });
const cl = (className, skills = []) => ({ className, level: 5, skills });

const spellByName = (name) => (rulesData.spells || []).find((s) => s.name === name) || null;

/* ────────────────────────────────────────────────────────────────
   A. 金手指給的咒語額度（缺陷①）
   ──────────────────────────────────────────────────────────────── */

// 同一個「沒有任何職業技能」的骨架，只差有沒有那個金手指。
const noQuirk = describeSpellGrants(mk());
const fairy = describeSpellGrants(mk({ quirk: '離鄉的妖精' }));
const fairyCapacity = fairy.capacity - noQuirk.capacity;

check('A1 沒有金手指的非施法者 → 額度 0（基準線）',
  noQuirk.capacity === 0 && noQuirk.canLearn === false, `${noQuirk.capacity}`);
check('A2 離鄉的妖精 → 額度真的 +1（差額，不是「有回傳」）',
  fairyCapacity === 1, `無金手指 ${noQuirk.capacity} → 有金手指 ${fairy.capacity}`);
check('A3 離鄉的妖精 → 學得了（canLearn），且剩餘 1 格',
  fairy.canLearn === true && fairy.remaining === 1, `canLearn=${fairy.canLearn}／剩 ${fairy.remaining}`);
check('A4 離鄉的妖精 → 開放元素／熵系／靈魂三份清單',
  CORE_SPELL_SCHOOLS.every((s) => fairy.allowedSchools.includes(s)),
  `[${fairy.allowedSchools.join('、')}]`);

// 反向斷言：換一個不給咒語的金手指，額度必須還是 0。
const robot = describeSpellGrants(mk({ quirk: '機器人' }));
check('A5 反向：不給咒語的金手指（機器人）→ 額度仍是 0，沒有被順手 +1',
  robot.capacity === 0 && robot.hasPath === false && robot.unfiledGrants.length === 0,
  `${robot.capacity}／hasPath=${robot.hasPath}／unfiled=${robot.unfiledGrants.length}`);

// 選項型金手指：只有「選到該選項」才算。
const survivorSpell = describeSpellGrants(mk({ quirk: '倖存者', quirkChoice: 'spell' }));
const survivorIp = describeSpellGrants(mk({ quirk: '倖存者', quirkChoice: 'ip' }));
check('A6 倖存者選②（學一個咒語）→ 額度 +1',
  survivorSpell.capacity === 1, `${survivorSpell.capacity}`);
check('A7 反向：倖存者選③（永久 +2 IP）→ 不給咒語額度（不能白送一格）',
  survivorIp.capacity === 0, `${survivorIp.capacity}`);
check('A8 倖存者選② → 只開放元素與靈魂（官方寫「元素師、靈師咒語表」）',
  survivorSpell.allowedSchools.length === 2
    && survivorSpell.allowedSchools.includes('元素')
    && survivorSpell.allowedSchools.includes('靈魂'),
  `[${survivorSpell.allowedSchools.join('、')}]`);

const angelSpell = describeSpellGrants(mk({ quirk: '墮落天使', quirkChoice: 'spell' }));
const angelMp = describeSpellGrants(mk({ quirk: '墮落天使', quirkChoice: 'mp' }));
check('A9 墮落天使選②（靈師咒語）→ 額度 +1 且只開放靈魂',
  angelSpell.capacity === 1 && angelSpell.allowedSchools.length === 1
    && angelSpell.allowedSchools[0] === '靈魂',
  `${angelSpell.capacity}／[${angelSpell.allowedSchools.join('、')}]`);
check('A10 反向：墮落天使選③（最大 MP +10）→ 不給咒語額度',
  angelMp.capacity === 0, `${angelMp.capacity}`);

// 舊存檔（名字後面自己加註記）也要認得。
const legacyFairy = describeSpellGrants(mk({ quirk: '離鄉的妖精（自奇）' }));
check('A11 舊存檔的金手指註記（（自奇））不影響判定',
  legacyFairy.capacity === 1, `${legacyFairy.capacity}`);

// 額度是「額外加」而不是「取代」：與職業技能的額度相加，且已學的咒語照樣扣。
const eleWithFairy = describeSpellGrants(
  mk({ classes: [cl('元素師', [{ name: '元素魔法', sl: 2 }])], quirk: '離鄉的妖精' }),
  [{ name: '照明烈焰', school: '元素' }]
);
check('A12 職業技能 SL2 ＋ 離鄉的妖精 1 → 額度 3（相加，不是取代）',
  eleWithFairy.capacity === 3, `${eleWithFairy.capacity}`);
check('A13 同一個角色已學 1 條 → 剩 2 格（金手指的量併進同一個池子）',
  eleWithFairy.used === 1 && eleWithFairy.remaining === 2,
  `used=${eleWithFairy.used}／剩 ${eleWithFairy.remaining}`);
check('A14 摘要寫得出金手指這一條來源（面板印的就是 summary）',
  eleWithFairy.summary.includes('離鄉的妖精') && eleWithFairy.summary.includes('元素魔法 SL 2'),
  eleWithFairy.summary);

/* ────────────────────────────────────────────────────────────────
   B. 金手指給的儀式權（缺陷①的另一半）
   ──────────────────────────────────────────────────────────────── */
const soulOfElement = describeRitualRights(mk({ quirk: '元素之魂', quirkChoice: { resist: '火', vuln: '冰' } }));
const oracle = describeRitualRights(mk({ quirk: '世界的神諭' }));
const hexborn = describeRitualRights(mk({ quirk: '巫術後裔', quirkChoice: { absorb: '毒' } }));
const ghost = describeRitualRights(mk({ quirk: '通智幽魂' }));
const noQuirkRitual = describeRitualRights(mk({ quirk: '機器人' }));

check('B1 元素之魂 → 可施展元素學派儀式（INS + WLP）',
  soulOfElement.canPerform === true
    && soulOfElement.schools.some((s) => s.name === '元素' && s.formula === 'INS + WLP'),
  `[${soulOfElement.summary}]`);
check('B2 元素之魂 → 附帶敘事限制寫在 note（面板 tooltip 之外的既知限制）',
  (soulOfElement.schools.find((s) => s.name === '元素')?.note || '').includes('元素'),
  soulOfElement.schools.find((s) => s.name === '元素')?.note);
check('B3 世界的神諭 → 靈魂學派儀式',
  oracle.canPerform === true && oracle.schools[0]?.name === '靈魂', `[${oracle.summary}]`);
check('B4 巫術後裔 → 儀式學派',
  hexborn.canPerform === true && hexborn.schools.some((s) => s.name === '儀式'), `[${hexborn.summary}]`);
check('B5 通智幽魂 → 儀式學派（靈魂網絡）',
  ghost.canPerform === true && ghost.schools.some((s) => s.name === '儀式'), `[${ghost.summary}]`);
check('B6 反向：不給儀式權的金手指（機器人）→ 仍然不能施展儀式',
  noQuirkRitual.canPerform === false && noQuirkRitual.schools.length === 0,
  `canPerform=${noQuirkRitual.canPerform}`);
check('B7 來源要寫出「金手指【X】」（不然玩家不知道這權限哪來的）',
  (soulOfElement.schools[0]?.sources || []).some((s) => s.includes('元素之魂')),
  `[${(soulOfElement.schools[0]?.sources || []).join('、')}]`);
check('B8 刻意不列的三條沒有混進表：遺物使用者／天才的宿敵／神秘魔法書',
  !['遺物使用者', '天才的宿敵', '神秘魔法書'].some((q) => QUIRK_RITUAL_SOURCES.some((s) => s.quirk === q)),
  `表內：${QUIRK_RITUAL_SOURCES.map((s) => s.quirk).join('、')}`);

/* ────────────────────────────────────────────────────────────────
   C. 四條擴充職業技能的儀式權（缺陷②）＋ 嵌合學派儀式（Lead 追加的第 5 條）
   ──────────────────────────────────────────────────────────────── */

/* 這四個職業的免費能力都**不含**「儀式學派」（徽記師 IP+2／魔奏者 MP+5／
   靈能者 MP+5／植物學家 HP 或 MP+5），所以測得到的是技能本身。
   （若哪天免費能力被改成含儀式學派，這幾條會變成恆真——那時要改用別的職業測。） */
const RITUAL_SKILL_CASES = [
  { skill: '幻影', className: '徽記師', school: '儀式' },
  { skill: '塞壬之歌', className: '魔奏者', school: '儀式' },
  { skill: '青翠之勢', className: '植物學家', school: '儀式' },
  { skill: '領航員', className: '靈能者', school: '儀式' },
  { skill: '嵌合學派儀式', className: '嵌合師', school: '嵌合' }
];

RITUAL_SKILL_CASES.forEach(({ skill, className, school }, idx) => {
  const withSkill = describeRitualRights(mk({ classes: [cl(className, [{ name: skill, sl: 1 }])] }));
  const zeroSl = describeRitualRights(mk({ classes: [cl(className, [{ name: skill, sl: 0 }])] }));
  const sourcesOf = (rights) => rights.schools.flatMap((s) => s.sources || []);
  check(`C${idx + 1} 【${skill}】→ 出現在 describeRitualRights 的來源裡（${school}）`,
    withSkill.schools.some((s) => s.name === school && (s.sources || []).includes(skill)),
    `[${withSkill.summary}] 來源=[${sourcesOf(withSkill).join('、')}]`);
  /* 反向：SL 0（＝沒學過）不該授予。這才是「不是因為名字像就給」的證明。 */
  check(`C${idx + 1}b 反向：【${skill}】SL 0 → 這一條學派權不存在`,
    zeroSl.schools.some((s) => s.name === school && (s.sources || []).includes(skill)) === false,
    `SL 0 → [${zeroSl.summary || '(無)'}]`);
});

// 嵌合師的免費能力本身也給「儀式」→ 有【嵌合學派儀式】時應該同時有「嵌合」與「儀式」。
const chimeristRitual = describeRitualRights(mk({ classes: [cl('嵌合師', [{ name: '嵌合學派儀式', sl: 1 }])] }));
check('C6 嵌合師＋【嵌合學派儀式】→「嵌合」與免費能力的「儀式」並存',
  chimeristRitual.schools.some((s) => s.name === '嵌合')
    && chimeristRitual.schools.some((s) => s.name === '儀式'),
  `[${chimeristRitual.summary}]`);

// 同一學派兩個來源時，來源必須是聯集（不能先到先贏）。
const eleAndIllusion = describeRitualRights(
  mk({ classes: [cl('元素師', [{ name: '幻影', sl: 1 }])] })
);
const mergedRitual = eleAndIllusion.schools.find((s) => s.name === '儀式');
check('C7 免費能力與【幻影】都給「儀式」→ 只留一筆，但來源是聯集',
  eleAndIllusion.schools.filter((s) => s.name === '儀式').length === 1
    && (mergedRitual?.sources || []).length === 2,
  `[${(mergedRitual?.sources || []).join('、')}]`);

/* ────────────────────────────────────────────────────────────────
   D. 四條英雄技能點名的咒語（缺陷③）：本體真的建檔了、學得到、放得出
   ──────────────────────────────────────────────────────────────── */
const HEROIC_CASES = [
  { skill: '彗星', spell: '彗星', school: '熵系', mp: '50' },
  { skill: '火山', spell: '火山', school: '元素', mp: '40' },
  { skill: '希望', spell: '希望', school: '靈魂', mp: '40' },
  { skill: '瘴氣', spell: '瘴氣', school: '元素', mp: '20' }
];

HEROIC_CASES.forEach(({ skill, spell, school, mp }, idx) => {
  const entry = spellByName(spell);
  const granted = describeSpellGrants(mk({ heroicSkills: [skill] }));
  const others = describeSpellGrants(mk({ heroicSkills: ['大口袋'] }));
  check(`D${idx + 1} 【${spell}】本體在 rulesData.spells，學派＝${school}、MP＝${mp}`,
    Boolean(entry) && entry.school === school && entry.mp === mp,
    entry ? `${entry.school}／${entry.mp}` : '查無此咒語');
  check(`D${idx + 1}b 【${spell}】可施放：目標／持續時間／效果文都非空`,
    Boolean(entry && entry.target && entry.duration && (entry.effect || '').length >= 10),
    entry ? `${entry.target}／${entry.duration}／${(entry.effect || '').length} 字` : '查無此咒語');
  check(`D${idx + 1}c 有英雄技能【${skill}】→ 額度 +1 且該學派可選（非施法者也學得到）`,
    granted.capacity === 1 && granted.allowedSchools.includes(school)
      && granted.grants.some((g) => g.spell === spell),
    `${granted.capacity}／[${granted.allowedSchools.join('、')}]`);
  check(`D${idx + 1}d 反向：換成不給咒語的英雄技能 → 額度 0，學派清單是空的`,
    others.capacity === 0 && others.allowedSchools.length === 0,
    `${others.capacity}／[${others.allowedSchools.join('、')}]`);
});

// 學完之後額度要真的被扣掉（否則「點名咒語」可以無限學）。
const cometLearned = describeSpellGrants(
  mk({ heroicSkills: ['彗星'] }), [{ name: '彗星', school: '熵系' }]
);
check('D17 學會【彗星】之後 → used 1、剩 0（點名咒語也吃額度）',
  cometLearned.used === 1 && cometLearned.remaining === 0 && cometLearned.canLearn === false,
  `used=${cometLearned.used}／剩 ${cometLearned.remaining}`);

// 職業技能與點名咒語並存時相加：熵師 SL2 ＋【彗星】＝ 3 格。
const entropistComet = describeSpellGrants(
  mk({ classes: [cl('熵師', [{ name: '熵系魔法', sl: 2 }])], heroicSkills: ['彗星'] })
);
check('D18 熵系魔法 SL2 ＋【彗星】→ 3 格（英雄技能是額外的，不是取代）',
  entropistComet.capacity === 3, `${entropistComet.capacity}`);

/* ────────────────────────────────────────────────────────────────
   E. 缺檔的咒語必須「明確回報」，不是靜默 0（缺陷③的退路）
   ──────────────────────────────────────────────────────────────── */
const npcQuirk = describeSpellGrants(mk({ quirk: '草木成精' }));
const npcQuirkBeast = describeSpellGrants(
  mk({ quirk: '會說話的野獸', quirkChoice: { boon1: 'npcSpell', boon2: 'unarmed' } })
);
const beastNoSpell = describeSpellGrants(
  mk({ quirk: '會說話的野獸', quirkChoice: { boon1: 'customWeapon', boon2: 'unarmed' } })
);
const pact = describeSpellGrants(mk({ quirk: '束縛你的約定' }));

check('E1 草木成精（NPC 咒語）→ unfiledGrants 有 1 筆且寫明「尚未建檔」',
  npcQuirk.unfiledGrants.length === 1
    && /尚未建檔/.test(npcQuirk.unfiledGrants[0]?.reason || ''),
  npcQuirk.unfiledGrants[0]?.reason || '(空)');
check('E2 草木成精 → hasPath 為 true（面板不會再顯示「本職業沒有咒語學派」）',
  npcQuirk.hasPath === true, `hasPath=${npcQuirk.hasPath}`);
check('E3 草木成精 → summary 讓玩家看得到「尚待建檔」（面板只印 summary）',
  npcQuirk.summary.includes('尚待建檔'), npcQuirk.summary);
check('E4 草木成精 → 不假裝有額度（capacity 0、canLearn false），也不猜學派',
  npcQuirk.capacity === 0 && npcQuirk.canLearn === false && npcQuirk.allowedSchools.length === 0,
  `${npcQuirk.capacity}／[${npcQuirk.allowedSchools.join('、')}]`);
check('E5 會說話的野獸選了 NPC 咒語增益 → 回報缺檔',
  npcQuirkBeast.unfiledGrants.length === 1, `${npcQuirkBeast.unfiledGrants.length}`);
check('E6 反向：會說話的野獸沒選那一項 → 不回報（沒有無中生有）',
  beastNoSpell.unfiledGrants.length === 0 && beastNoSpell.hasPath === false,
  `unfiled=${beastNoSpell.unfiledGrants.length}／hasPath=${beastNoSpell.hasPath}`);
check('E7 束縛你的約定（核心 p.310 三選一）→ 回報缺檔',
  pact.unfiledGrants.length === 1 && /p\.310/.test(pact.unfiledGrants[0]?.reason || ''),
  pact.unfiledGrants[0]?.reason || '(空)');

/* 模擬「點名咒語本體不在規則庫」的未來情境：把目錄換成空表。
   這一條釘住的是**機制**（不依賴現在剛好四筆都建檔了）。 */
const cometNoCatalogue = describeSpellGrants(
  mk({ heroicSkills: ['彗星'] }), [], { spellCatalogue: [] }
);
check('E8 目錄裡沒有【彗星】時 → 不回額度，改回報「【彗星】尚未建檔」',
  cometNoCatalogue.capacity === 0
    && cometNoCatalogue.unfiledGrants.some((u) => /彗星/.test(u.reason) && /尚未建檔/.test(u.reason)),
  JSON.stringify(cometNoCatalogue.unfiledGrants));
check('E9 目錄裡沒有【彗星】時 → hasPath 仍為 true（系統知道它缺，不是玩家選錯職業）',
  cometNoCatalogue.hasPath === true && cometNoCatalogue.summary.includes('尚待建檔'),
  cometNoCatalogue.summary);

/* ────────────────────────────────────────────────────────────────
   F. 對照組：把來源表清空 → 上面那些「+1」必須塌回 0
   （沒有這一段，A/D 段可能只是「剛好都 +1」而永遠全綠）
   ──────────────────────────────────────────────────────────────── */
const fairyNoTable = describeSpellGrants(
  mk({ quirk: '離鄉的妖精' }), [], { quirkSpellSources: [] }
);
const cometNoTable = describeSpellGrants(
  mk({ heroicSkills: ['彗星'] }), [], { heroicSpellSources: [] }
);
const eleNoTable = describeSpellGrants(
  mk({ classes: [cl('元素師', [{ name: '元素魔法', sl: 2 }])] }), [], { spellGrantSources: [] }
);
const illusionNoTable = describeRitualRights(
  mk({ classes: [cl('徽記師', [{ name: '幻影', sl: 1 }])] }), { ritualSkillSources: [] }
);
const quirkRitualNoTable = describeRitualRights(
  mk({ quirk: '元素之魂' }), { quirkRitualSources: [] }
);

check('F1 對照組：QUIRK_SPELL_SOURCES 清空 → 離鄉的妖精額度歸 0',
  fairyNoTable.capacity === 0, `${fairyNoTable.capacity}`);
check('F2 對照組：HEROIC_SPELL_SOURCES 清空 → 彗星額度歸 0',
  cometNoTable.capacity === 0, `${cometNoTable.capacity}`);
check('F3 對照組：SPELL_GRANT_SOURCES 清空 → 元素魔法 SL2 額度歸 0',
  eleNoTable.capacity === 0, `${eleNoTable.capacity}`);
check('F4 對照組：RITUAL_SKILL_SOURCES 清空 → 幻影的儀式權消失',
  illusionNoTable.canPerform === false, `[${illusionNoTable.summary}]`);
check('F5 對照組：QUIRK_RITUAL_SOURCES 清空 → 元素之魂的儀式權消失',
  quirkRitualNoTable.canPerform === false, `[${quirkRitualNoTable.summary}]`);

/* ────────────────────────────────────────────────────────────────
   G. 資料防漂移（技能／金手指改名時這裡先紅，而不是玩家發現面板變空）
   ──────────────────────────────────────────────────────────────── */
const allClassSkills = new Set();
Object.values(rulesData.classes || {}).forEach((def) => {
  (def.skills || []).forEach((sk) => allClassSkills.add(sk.name));
});
const quirkNames = new Set((rulesData.quirks || []).map((q) => q.name));
const heroicNames = new Set((rulesData.heroicSkills || []).map((h) => h.name));

const missingRitualSkills = RITUAL_SKILL_SOURCES
  .map((s) => s.skill)
  .filter((n) => !allClassSkills.has(n));
check('G1 每個「儀式授予」技能名都真實存在於職業資料（含四條擴充職業）',
  missingRitualSkills.length === 0,
  missingRitualSkills.length ? `找不到：${missingRitualSkills.join('、')}` : `${RITUAL_SKILL_SOURCES.length} 個全部命中`);

const missingQuirkSpell = QUIRK_SPELL_SOURCES
  .map((s) => s.quirk)
  .filter((n) => !quirkNames.has(n));
check('G2 金手指咒語來源的名字都對得上規則資料', missingQuirkSpell.length === 0,
  missingQuirkSpell.length ? `找不到：${missingQuirkSpell.join('、')}` : `${QUIRK_SPELL_SOURCES.length} 個全部命中`);

const missingQuirkRitual = QUIRK_RITUAL_SOURCES
  .map((s) => s.quirk)
  .filter((n) => !quirkNames.has(n));
check('G3 金手指儀式來源的名字都對得上規則資料', missingQuirkRitual.length === 0,
  missingQuirkRitual.length ? `找不到：${missingQuirkRitual.join('、')}` : `${QUIRK_RITUAL_SOURCES.length} 個全部命中`);

const missingHeroic = HEROIC_SPELL_SOURCES
  .map((s) => s.skill)
  .filter((n) => !heroicNames.has(n) && !PLAYTEST_HEROIC_SKILLS.some((h) => h.name === n));
check('G4 英雄技能名都對得上規則資料（含 Playtest 的【瘴氣】）', missingHeroic.length === 0,
  missingHeroic.length ? `找不到：${missingHeroic.join('、')}` : `${HEROIC_SPELL_SOURCES.length} 個全部命中`);

const missingSpells = HEROIC_SPELL_SOURCES
  .map((s) => s.spell)
  .filter((n) => !spellByName(n));
check('G5 四筆點名咒語都已經建檔在 rulesData.spells', missingSpells.length === 0,
  missingSpells.length ? `缺：${missingSpells.join('、')}` : `${HEROIC_SPELL_SOURCES.length} 筆全部命中`);

// 追加的四筆不得覆蓋既有 38 筆：名冊長度必須是 38 ＋ 4，且前 38 筆名字沒變。
const SPELLS_BEFORE = 38;
check('G6 追加只在尾端：總數 ＝ 38 ＋ 4，且沒有同名覆蓋',
  rulesData.spells.length === SPELLS_BEFORE + 4
    && new Set(rulesData.spells.map((s) => s.name)).size === rulesData.spells.length,
  `${rulesData.spells.length} 筆／去重後 ${new Set(rulesData.spells.map((s) => s.name)).size} 筆`);
check('G7 追加的四筆在陣列尾端（前 38 筆的順序沒有被動到）',
  rulesData.spells.slice(SPELLS_BEFORE).map((s) => s.name).join('、')
    === HEROIC_SPELL_SOURCES.map((s) => s.spell).join('、'),
  rulesData.spells.slice(SPELLS_BEFORE).map((s) => s.name).join('、'));

/* ────────────────────────────────────────────────────────────────
   總計
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(60)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log('\n  授予來源是資料，不是硬寫的 if：表錯了，玩家就會看到 0/0 或「向無施展權」。');
}
console.log(`${'='.repeat(60)}`);
process.exit(failed.length ? 1 : 0);
