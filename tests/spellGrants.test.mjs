/**
 * 咒語與儀式的「取得資格」契約測試（`utils/spellGrants.js`）。
 *
 * 執行：`npm run test:spellgrants`（已納入 `npm test` 串接）
 *
 * ## 為什麼要有這個檔案（2026-11-02，使用者裁定）
 *
 * 跑團面板的「咒語與儀式」分頁原本對**任何**角色都給兩顆按鈕：
 * 「從規則庫選擇習得咒語」與「扣除 X MP 並擲儀式檢定」。那不是 UI 品味問題，
 * 是把規則反過來寫：
 *
 *   - 咒語只能經由【元素魔法】／【熵系魔法】／【靈魂魔法】（每次獲得學一個同清單）、
 *     【咒語模仿】（上限 SL＋2），或英雄技能【額外咒語】（+2）取得（p.188~210）。
 *   - 儀式需要對應學派的職業技能，或職業免費能力賦予的儀式學派權限（p.118~121）。
 *
 * 判定抽成純函式之後，這支測試守三件事：
 *   1. **沒來源就是沒來源**——非施法者的額度必須是 0，不是「預設 1」或「不限」。
 *   2. **額度算得對**——SL、跨職業累加、舊技能名正名、超出不會變負數。
 *   3. **對照表沒有漂移**——技能一旦改名，這裡會先紅，而不是玩家發現面板變空。
 *
 * ※ SSR 測不到 `onClick`，所以「按了會不會被擋」不在這裡；
 *   那部分由 `tests/playHudEmptyUi.test.mjs` 的 D 段（畫面有沒有那顆按鈕）覆蓋。
 *   兩者分工：這裡管「規則算得對」，那裡管「畫面照著畫」。
 */
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  CHIMERIST_SKILL,
  CORE_SPELL_SCHOOLS,
  EXTRA_SPELL_SKILL,
  RITUAL_SKILL_SOURCES,
  SPELL_GRANT_SOURCES,
  describeRitualRights,
  describeSpellGrants
} from '../src/features/character-sheet/utils/spellGrants.js';

let results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

/** 造一個只有職業技能的骨架角色（不碰 localStorage、不碰 React）。 */
const mk = (classes = [], heroicSkills = [], spells = []) => ({
  name: '額度測試',
  classes,
  heroicSkills,
  spells
});
const cl = (className, skills = []) => ({ className, level: 5, skills });

/* ────────────────────────────────────────────────────────────────
   A. 咒語額度
   ──────────────────────────────────────────────────────────────── */
const none = describeSpellGrants(mk());
check('A1 沒有任何職業技能 → 沒有來源', none.hasPath === false, `hasPath=${none.hasPath}`);
check('A2 沒有任何職業技能 → 額度 0，學不了', none.capacity === 0 && none.canLearn === false, `${none.capacity} / canLearn=${none.canLearn}`);
check('A3 沒有任何職業技能 → 可選清單是空的（不是「全部學派」）', none.allowedSchools.length === 0, `[${none.allowedSchools.join('、')}]`);

const ele3 = describeSpellGrants(mk([cl('元素師', [{ name: '元素魔法', sl: 3 }])]));
check('A4 元素魔法 SL3 → 額度 3', ele3.capacity === 3, `${ele3.capacity}`);
check('A5 元素魔法 SL3 → 只開放元素清單', ele3.allowedSchools.length === 1 && ele3.allowedSchools[0] === '元素', `[${ele3.allowedSchools.join('、')}]`);
check('A6 元素魔法 SL3 → 摘要寫得出「元素魔法 SL 3」', ele3.summary.includes('元素魔法 SL 3'), ele3.summary);

const ele0 = describeSpellGrants(mk([cl('元素師', [{ name: '元素魔法', sl: 0 }])]));
check('A7 技能 SL 0 不算學過（額度仍是 0）', ele0.capacity === 0 && ele0.hasPath === false, `${ele0.capacity} / hasPath=${ele0.hasPath}`);

/* ※ 第二個參數是已解析的咒語清單（`resolveCharacterSpells` 的結果）。
   UI 也是這樣呼叫的——額度計算與畫面必須看同一份資料，否則兩邊會漂移。 */
const eleUsed = describeSpellGrants(
  mk([cl('元素師', [{ name: '元素魔法', sl: 3 }])]),
  [{ name: '照明烈焰', school: '元素' }]
);
check('A8 已學 1 個元素咒語 → 用了 1 格、剩 2 格', eleUsed.used === 1 && eleUsed.remaining === 2, `${eleUsed.used} / ${eleUsed.remaining}`);
check('A9 還有剩額度 → 可以再學', eleUsed.canLearn === true, `canLearn=${eleUsed.canLearn}`);

const overUsed = describeSpellGrants(
  mk([cl('元素師', [{ name: '元素魔法', sl: 1 }])]),
  [
    { name: '照明烈焰', school: '元素' },
    { name: '雷霆', school: '元素' },
    { name: '冰川覆裂', school: '元素' }
  ]
);
check('A10 舊存檔超額（3 個 / 額度 1）→ 剩 0 而不是負數', overUsed.remaining === 0, `${overUsed.remaining}`);
check('A11 超額時不能再學', overUsed.canLearn === false, `canLearn=${overUsed.canLearn}`);

const mixed = describeSpellGrants(
  mk([cl('元素師', [{ name: '元素魔法', sl: 3 }]), cl('熵師', [{ name: '熵系魔法', sl: 2 }])])
);
check('A12 兩個學派並存 → 額度相加（3＋2）', mixed.capacity === 5, `${mixed.capacity}`);
check('A13 兩個學派並存 → 兩份清單都可選', mixed.allowedSchools.length === 2, `[${mixed.allowedSchools.join('、')}]`);

const stacked = describeSpellGrants(
  mk([
    cl('元素師', [{ name: '元素魔法', sl: 2 }]),
    cl('元素師', [{ name: '元素魔法', sl: 1 }])
  ])
);
check('A14 同名技能跨職業累加（SL2＋SL1＝3）', stacked.capacity === 3, `${stacked.capacity}`);

const legacyName = describeSpellGrants(mk([cl('熵師', [{ name: '熵係魔法', sl: 4 }])]));
check('A15 舊技能名「熵係魔法」會被正名成熵系魔法', legacyName.capacity === 4, `${legacyName.capacity}`);

const chimerist = describeSpellGrants(mk([cl('嵌合師', [{ name: CHIMERIST_SKILL, sl: 2 }])]));
check('A16 咒語模仿 SL2 → 有自己的記錄額（SL＋2＝4）', chimerist.chimerist?.capacity === 4, `${chimerist.chimerist?.capacity}`);
check('A17 咒語模仿 → 有路徑，但不是核心清單額度', chimerist.hasPath === true && chimerist.capacity === 0, `hasPath=${chimerist.hasPath}／capacity=${chimerist.capacity}`);
check('A18 咒語模仿 → 不開放「從規則庫挑」（清單在怪物身上）', chimerist.allowedSchools.length === 0, `[${chimerist.allowedSchools.join('、')}]`);

const extraByName = describeSpellGrants(mk([], [EXTRA_SPELL_SKILL]));
check('A19 英雄技能【額外咒語】→ 額度 2', extraByName.capacity === 2, `${extraByName.capacity}`);
check('A20 英雄技能【額外咒語】→ 三份清單都可選（同一份為限，規則在玩家）',
  CORE_SPELL_SCHOOLS.every((s) => extraByName.allowedSchools.includes(s)),
  `[${extraByName.allowedSchools.join('、')}]`);

const extraByObject = describeSpellGrants(mk([], [{ name: EXTRA_SPELL_SKILL }]));
check('A21 英雄技能用物件存也認得', extraByObject.capacity === 2, `${extraByObject.capacity}`);

const bothPaths = describeSpellGrants(
  mk([cl('元素師', [{ name: '元素魔法', sl: 2 }])], [EXTRA_SPELL_SKILL])
);
check('A22 技能額度與額外咒語相加（2＋2＝4）', bothPaths.capacity === 4, `${bothPaths.capacity}`);
check('A23 有額外咒語時 allowedSchools 不重複', bothPaths.allowedSchools.length === 3, `[${bothPaths.allowedSchools.join('、')}]`);

/* 嵌合師的咒語不該被算進核心三清單的「已用」——它不在 `rulesData.spells` 裡。 */
const chimeristUsed = describeSpellGrants(
  mk([cl('元素師', [{ name: '元素魔法', sl: 3 }]), cl('嵌合師', [{ name: CHIMERIST_SKILL, sl: 1 }])]),
  [
    { name: '元素防護罩', school: '元素' },
    { name: '某野獸咒語', school: '嵌合' }
  ]
);
check('A24 嵌合咒語不佔核心清單的額度', chimeristUsed.used === 1, `${chimeristUsed.used}`);

/* ────────────────────────────────────────────────────────────────
   B. 儀式權限
   ──────────────────────────────────────────────────────────────── */
const noRitual = describeRitualRights(mk());
check('B1 沒有任何職業 → 不能獨自施展儀式', noRitual.canPerform === false, `canPerform=${noRitual.canPerform}`);
check('B2 沒有權限時 schools 必須是空的（UI 靠它決定要不要畫計算器）', noRitual.schools.length === 0, `${noRitual.schools.length} 個`);
check('B3 沒有權限時 primary 是 null（呼叫端不必防呆）', noRitual.primary === null, `${noRitual.primary}`);

const elemental = describeRitualRights(mk([cl('元素師', [{ name: '元素魔法', sl: 1 }])]));
check('B4 元素師的免費能力（儀式學派）就算權限', elemental.canPerform === true, `canPerform=${elemental.canPerform}`);
check('B5 元素師 → 學派名是「儀式」', elemental.schools.some((s) => s.name === '儀式'), `[${elemental.summary}]`);
check('B6 元素師 → 公式是 INS + WLP', elemental.schools[0]?.formula === 'INS + WLP', elemental.schools[0]?.formula);

const scholar = describeRitualRights(mk([cl('博學士', [{ name: '元素學派儀式', sl: 1 }])]));
check('B7 有【元素學派儀式】技能 → 可施展元素學派儀式', scholar.canPerform === true && scholar.schools[0]?.name === '元素', `[${scholar.summary}]`);
check('B8 博學士沒有免費儀式權限，靠的是技能（來源記在 from）', scholar.schools[0]?.from === '元素學派儀式', scholar.schools[0]?.from);

const arcanist = describeRitualRights(mk([cl('秘儀師', [{ name: '秘儀學派儀式', sl: 1 }])]));
check('B9 秘儀學派儀式 → 公式是 WLP + WLP', arcanist.schools[0]?.formula === 'WLP + WLP', arcanist.schools[0]?.formula);

/* ※ 用「博學士」而不是元素師：元素師的免費能力本身就帶儀式學派權限，
   拿它測「SL 0 不授予」會被免費能力蓋過去，測試就永遠是綠的。 */
const zeroSl = describeRitualRights(mk([cl('博學士', [{ name: '元素學派儀式', sl: 0 }])]));
check('B10 技能 SL 0 不授予權限', zeroSl.canPerform === false, `canPerform=${zeroSl.canPerform}`);

const guardian = describeRitualRights(mk([cl('守護者', [{ name: '保鏢', sl: 3 }])]));
check('B11 守護者（無儀式學派、無免費權限）不能施展儀式', guardian.canPerform === false, `canPerform=${guardian.canPerform}`);

const fastRitual = describeRitualRights(mk([cl('守護者', [{ name: '保鏢', sl: 1 }])], ['快速儀式']));
check('B12 英雄技能【快速儀式】是修飾器，不授予儀式權', fastRitual.canPerform === false, `canPerform=${fastRitual.canPerform}`);

const dedup = describeRitualRights(
  mk([cl('元素師', [{ name: '元素學派儀式', sl: 1 }])])
);
check('B13 免費能力＋同學派技能 → 學派不重複', dedup.schools.filter((s) => s.name === '元素').length === 1,
  `[${dedup.summary}]`);

/* ────────────────────────────────────────────────────────────────
   C. 對照表防漂移（技能改名時這裡先紅，而不是玩家發現面板變空）
   ──────────────────────────────────────────────────────────────── */
const allClassSkills = new Set();
Object.values(rulesData.classes || {}).forEach((def) => {
  (def.skills || []).forEach((sk) => allClassSkills.add(sk.name));
});

const missingSpellSkills = SPELL_GRANT_SOURCES
  .map((s) => s.skill)
  .filter((n) => !allClassSkills.has(n) && n !== CHIMERIST_SKILL);
check('C1 每個「咒語授予」技能名都真實存在於職業資料', missingSpellSkills.length === 0,
  missingSpellSkills.length ? `找不到：${missingSpellSkills.join('、')}` : `${SPELL_GRANT_SOURCES.length} 個全部命中`);

check('C2 咒語模仿也真實存在', allClassSkills.has(CHIMERIST_SKILL), CHIMERIST_SKILL);

const missingRitualSkills = RITUAL_SKILL_SOURCES
  .map((s) => s.skill)
  .filter((n) => !allClassSkills.has(n));
check('C3 每個「儀式授予」技能名都真實存在於職業資料', missingRitualSkills.length === 0,
  missingRitualSkills.length ? `找不到：${missingRitualSkills.join('、')}` : `${RITUAL_SKILL_SOURCES.length} 個全部命中`);

const spellSchoolsInData = new Set((rulesData.spells || []).map((s) => s.school));
const badSchools = SPELL_GRANT_SOURCES
  .map((s) => s.school)
  .filter((s) => !spellSchoolsInData.has(s));
check('C4 授予的學派名對得上規則庫的 `spells[].school`', badSchools.length === 0,
  badSchools.length ? `對不上：${badSchools.join('、')}` : `[${[...spellSchoolsInData].join('、')}]`);

check('C5 額外咒語是英雄技能而不是職業技能（兩張表不該互相污染）',
  !allClassSkills.has(EXTRA_SPELL_SKILL) && (rulesData.heroicSkills || []).some((h) => h.name === EXTRA_SPELL_SKILL),
  `${EXTRA_SPELL_SKILL}`);

/* ────────────────────────────────────────────────────────────────
   總計
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log('\n  咒語與儀式不是自由選購的：沒有來源就是沒有，額度用完就是滿了。');
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
