/**
 * 核心書技能變體（Core Book Variants）的護欄。
 *
 * ## 兩條鐵律（第二條是後來改的，改動本身有紀錄）
 *
 * 1. **不可修改原始規則書的內容。**
 *    「要勾選【官方公測修訂】才會出現的項目，千萬不可用修改到原本規則書的內容。
 *      勾選之後，那些有改過的內容要在後面標記【公測】。」
 *    → 資料層不動 `rulesData.json`；變體另存一份，`skills[].name` 永遠是**原版技能名**。
 *
 * 2. **選用之後，原版要收起來（GM 裁定 2026-10-14）。**
 *    「公測按鈕是玩家點的，不是 GM……選用之後，原版要收起來。」
 *    → 這是**取代**語意：選了變體，同一列就顯示變體；原版不再並列。
 *      官方 PDF p.34 也支持「per-player」：變體**規則**須全團一致，
 *      變體**技能**是每位玩家的個人選擇 → 狀態存在角色上。
 *
 * ⚠️ 第一版測試寫的是舊語意（「變體與原版同時存在、不可覆寫」），
 *    改版後 D／E 兩節已**反轉**。留著舊斷言會讓護欄擋住正確的行為。
 *
 * 執行：
 *   npx esbuild tests/coreBookVariants.test.mjs --bundle --platform=node --format=esm \
 *     --outfile=.test-build/coreBookVariants.mjs --log-level=warning && node .test-build/coreBookVariants.mjs
 *
 * ## 為什麼用 SSR 而不是截圖
 *
 * 這個開關的失敗模式是「**條件永遠為 false**」——build 與其他測試都會過，
 * 因為那在語法與型別上都完全合法。截圖只證明一次，測試每次都會跑。
 * （實際上第一版就是寫成 `rules.enabledSourcebooks`，那個欄位不存在，
 *   變體一個都不會出現，而且沒有任何錯誤訊息。）
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  CORE_BOOK_VARIANTS,
  getVariantsForClass,
  getVariantsForSkill,
  getVariantById,
  getSkillVariant,
  withSkillVariant,
  resolveSkillDisplay,
  getAdoptedVariants,
  findVariantHeroicSkillConflicts,
  buildSkillEntry
} from '../src/features/character-sheet/data/coreBookVariants.js';
import { createNewCharacter, validateCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';
import ClassSkillCard from '../src/features/character-sheet/components/ClassSkillCard.jsx';
import { resolveCreationRules } from '../src/features/character-sheet/data/creationRules.js';

let pass = 0;
let fail = 0;
const lines = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(`${ok ? '  PASS' : '  FAIL'}  ${label}${ok ? '' : `　期望 ${JSON.stringify(expected)}，實得 ${JSON.stringify(actual)}`}`);
};
const section = (t) => lines.push(`\n${t}`);

const NEUTRAL = { mainHand: '無武器', offHand: '無盾牌', armor: '無防具', accessory: '' };
const mkChar = (books) => {
  const c = createNewCharacter({ equipment: NEUTRAL, startingFundsRolled: 0 });
  c.enabledSourcebooks = books;
  return c;
};
const theme = getCharacterTheme('emerald');

/**
 * 組出 `ClassSkillCard` 真正吃得下的 `classItem`。
 *
 * ⚠️ `rulesData.classes['嵌合師']` **不能直接當 `classItem`**——它只有
 * `source／freeBenefits／skills／freeBonus`，**沒有 `className`**（職業名只在 key 上）。
 * 真實呼叫端（`CharacterEditor.jsx:1452`）傳的是 `character.classes[]` 的元素，那才有。
 * 第一版測試直接把 rulesData 的物件塞進去 → 元件內 `getVariantsForClass(undefined)`
 * 拿到空陣列，變體一個都不會出現，而**測試照樣會過**（因為它當時問的是別的條件）。
 */
const mkClassItem = (className, skills = []) => ({ className, skills, level: skills.reduce((s, k) => s + k.sl, 0) });

// ─────────────────────────────────────────────────────────── A
section('A. 資料完整性（每一筆都要有取代目標與官方出處）');
check('變體共 7 筆', CORE_BOOK_VARIANTS.length, 7);
check('每筆都有 id／className／replaces／name／en／maxSL／origin／desc',
  CORE_BOOK_VARIANTS.every((v) => v.id && v.className && v.replaces && v.name && v.en
    && Number.isFinite(v.maxSL) && v.origin && v.desc), true);
check('id 不重複', new Set(CORE_BOOK_VARIANTS.map((v) => v.id)).size, 7);
check('出處都指向新版公測文件',
  CORE_BOOK_VARIANTS.every((v) => v.origin.includes('2026-10-01')), true);

// ─────────────────────────────────────────────────────────── B
section('B. 取代目標必須真的存在於該職業（否則就是懸空引用）');
for (const v of CORE_BOOK_VARIANTS) {
  const cls = rulesData.classes[v.className];
  check(`${v.name}：職業「${v.className}」存在`, !!cls, true);
  const has = !!cls && (cls.skills || []).some((s) => s.name === v.replaces);
  check(`${v.name}：取代的【${v.replaces}】在該職業的技能清單裡`, has, true);
}
// 【暴怒】有兩個變體，其餘一對一
check('【暴怒】有兩個變體', getVariantsForSkill('暴怒').length, 2);
check('getVariantsForClass(嵌合師) 回 1 筆', getVariantsForClass('嵌合師').length, 1);
check('沒有變體的職業回空陣列', getVariantsForClass('秘儀師').length, 0);

// ─────────────────────────────────────────────────────────── C
section('C. 差異必須用 **...** 標出來（使用者：把不一樣的內容粗體化）');
for (const v of CORE_BOOK_VARIANTS) {
  check(`${v.name}：desc 含粗體標記`, v.desc.includes('**'), true);
  // 成對，不能只有單邊
  check(`${v.name}：粗體標記成對`, (v.desc.match(/\*\*/g) || []).length % 2, 0);
}

// ─────────────────────────────────────────────────────────── D
section('D. 公測關閉時：變體完全不顯示，原版技能照常顯示');
// 角色已配過【咒語模仿】——元件只印**配過的**技能（未配的是空狀態），所以要看原版在不在，
// 就得讓角色真的配過它。
const off = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 2, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core']), theme
}));
check('關閉時看不到【咒語自助餐】', off.includes('咒語自助餐'), false);
check('關閉時看不到【公測】徽章', off.includes('公測'), false);
check('關閉時原版【咒語模仿】仍在', off.includes('咒語模仿'), true);

// ─────────────────────────────────────────────────────────── E
section('E. 公測開啟但**未選用**：檢視模式不渲染變體卡（§BC GM 裁定 2026-10-16）');
/**
 * 「乖乖藏起來」——未選用的變體卡在檢視模式完全不渲染。
 * 玩家要在檢視模式看變體，必須先在編輯模式選用；選用後才會出現在檢視模式。
 * 這個翻轉是 GM 裁定的（見 decisions.md §BC），把舊語意「開啟就並列顯示給玩家看」
 * 改成「開啟了但沒選就看不見」。
 */
const on = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師'), classIndex: 0,
  character: mkChar(['core', 'playtest']), theme
}));
check('未選用時變體【咒語自助餐】不渲染（乖乖藏起來）', on.includes('咒語自助餐'), false);
// ※ 編輯模式仍要給玩家入口——這個由 §O 與新 §P 一起驗。
// 檢視模式公測徽章「公測」這個字也可能不再出現（因為精簡入口在編輯模式才渲染）

// ─────────────────────────────────────────────────────────── E2
section('E2. 已配點但未選用：變體仍不渲染（避免「有配點反而看不到」的舊 bug）');
// 真實情境：角色已經配過【咒語模仿】但沒選變體——檢視模式該乾淨，不該突然冒出大卡。
const onWithSkills = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 2, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme
}));
check('已配點但未選用時變體【咒語自助餐】仍不渲染', onWithSkills.includes('咒語自助餐'), false);
check('已配點時原版【咒語模仿】仍在（技能列的內容）', onWithSkills.includes('咒語模仿'), true);

// ─────────────────────────────────────────────────────────── E3
section('E3. 職業名的來源必須是 `className`（元件吃的是 character.classes 的元素）');
check('rulesData 的職業物件沒有 className（所以不能直接當 classItem）',
  'className' in rulesData.classes['嵌合師'], false);
check('rulesData 的職業物件沒有 name',
  'name' in rulesData.classes['嵌合師'], false);
// ※ 舊斷言「有兩個變體的職業（狂怒鬥士）兩張都出現」已反轉為
// 「都沒選時兩張都不渲染」——「不選就藏起來」是 §BC 的精神。
check('狂怒鬥士未選用時【勇猛打手】與【隕石猛擊】都不渲染',
  (renderToStaticMarkup(React.createElement(ClassSkillCard, {
    classItem: mkClassItem('狂怒鬥士'), classIndex: 0,
    character: mkChar(['core', 'playtest']), theme
  })).match(/勇猛打手|隕石猛擊/g) || []).length, 0);

// ─────────────────────────────────────────────────────────── F
section('F. 閘門來源必須正確（這是最容易寫錯、而且不會報錯的地方）');
// `resolveCreationRules()` 的回傳**沒有** enabledSourcebooks——第一版就是寫錯這個
const r = resolveCreationRules({});
check('resolveCreationRules 沒有 enabledSourcebooks（所以不能用它當閘門）',
  'enabledSourcebooks' in r, false);
check('但它有 defaultSourcebooks', Array.isArray(r.defaultSourcebooks), true);
check('也有 allowedSourcebooks', Array.isArray(r.allowedSourcebooks), true);

// ═══════════════════════════════════════════════════════════════════════════
// 以下為 2026-10-14「選用機制」新增。上面 A~F 是不變的部分；
// 這一節起測的是「玩家在自己角色卡上選用／取消變體」的行為。
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────── G
section('G. 選用狀態的資料模型：`name` 不變、`variantId` 才是選擇（G1）');
// 這是整個機制的關鍵決定。`skills[].name` 有 20+ 處 `find(s => s.name === '…')`
// 硬編碼查詢（小工具 20 處、咒語模仿 7 處、混合變形 5 處…），改 `name` 會讓
// 那些子系統**靜默失效**。所以識別字保持原版名，變體只是顯示層。
const baseSkill = { name: '咒語模仿', sl: 3, selectedOptions: [] };
const adopted = withSkillVariant(baseSkill, 'spellBuffet', { maxSL: 5 });
check('選用後 name 仍是原版技能名', adopted.name, '咒語模仿');
check('選用後帶上 variantId', adopted.variantId, 'spellBuffet');
check('選用後不改到原物件（回傳新物件）', baseSkill.variantId, undefined);
check('選用後 sl 不超過**變體**的上限（咒語自助餐 6）', adopted.sl, 3);
check('原版上限 5、變體上限 6 → 取變體的', getVariantById('spellBuffet').maxSL, 6);

// 夾制：選用上限**較低**的變體時，sl 要降下來
const enraged = { name: '暴怒', sl: 5, selectedOptions: [] };
const asBrawler = withSkillVariant(enraged, 'braveBrawler', { maxSL: 5 });
check('【暴怒】5 級改用上限 3 的【勇猛打手】→ sl 夾到 3', asBrawler.sl, 3);
check('【勇猛打手】的上限是 3', getVariantById('braveBrawler').maxSL, 3);

// 取消選用：variantId 要真的被移除，不是設成 null
const reverted = withSkillVariant(adopted, null, { maxSL: 5 });
check('取消選用後 variantId 欄位被刪除（不是 null）', 'variantId' in reverted, false);
check('取消選用後 name 不變', reverted.name, '咒語模仿');
// 取消選用後 sl 要重新夾回原版上限（暴怒案例：3 → 原版 5，不變；但反向要能夾）
const backToOriginal = withSkillVariant({ name: '暴怒', sl: 3, variantId: 'braveBrawler' }, null, { maxSL: 5 });
check('取消選用後 sl 仍保留', backToOriginal.sl, 3);

// ─────────────────────────────────────────────────────────── H
section('H. 顯示解析：選了變體就用變體的名字與描述（H4）');
const dispOriginal = resolveSkillDisplay({ name: '咒語模仿', sl: 2 }, { name: '咒語模仿', desc: '原版描述', maxSL: 5 });
check('未選用 → 顯示原版名', dispOriginal.name, '咒語模仿');
check('未選用 → isVariant 為 false', dispOriginal.isVariant, false);
check('未選用 → 顯示原版描述', dispOriginal.desc, '原版描述');

const dispVariant = resolveSkillDisplay({ name: '咒語模仿', sl: 2, variantId: 'spellBuffet' }, { name: '咒語模仿', desc: '原版描述', maxSL: 5 });
check('選用 → 顯示變體名【咒語自助餐】', dispVariant.name, '咒語自助餐');
check('選用 → isVariant 為 true', dispVariant.isVariant, true);
check('選用 → 描述換成變體的（原版收起來）', dispVariant.desc !== '原版描述', true);
check('選用 → 上限換成變體的 6', dispVariant.maxSL, 6);
check('選用 → 仍記得它取代了誰', dispVariant.replaces, '咒語模仿');

// 壞資料不能炸：variantId 指向不存在的變體 → 退回原版顯示
const dispBroken = resolveSkillDisplay({ name: '咒語模仿', sl: 2, variantId: 'not-a-real-variant' }, { name: '咒語模仿', desc: '原版描述', maxSL: 5 });
check('variantId 無效 → 退回原版（不 throw）', dispBroken.name, '咒語模仿');
check('variantId 無效 → isVariant 為 false', dispBroken.isVariant, false);

// ─────────────────────────────────────────────────────────── I
section('I. 選用後介面要「收起來原版」（GM 裁定：選用之後原版要收起來）');
/**
 * ⚠️ 這裡的斷言必須**只針對技能列**，不能只問「整份 HTML 有沒有這個字串」。
 *
 * 踩過的坑：第一版寫成 `adoptedCard.includes('咒語自助餐')`，看起來很合理，
 * 但它**永遠為真**——因為同一張卡片底下還有「變體瀏覽區」（`CoreBookVariantCard`），
 * 那裡本來就會印變體的名字。於是「技能列忘了用 variantId」這個 bug
 * 完全不會被這條護欄抓到（實際做了刻意破壞驗證才發現）。
 *
 * 現在改成：把「技能列」那段 HTML 切出來單獨檢查（瀏覽區之前），
 * 變體名 / 上限 / 描述都只看技能列，兩層都顧到。
 *
 * ※ 舊斷言「選用後多出現一次（差=1）」在 §BC 反轉後已不再有意義——
 *   編輯模式的精簡入口按鈕（`原版【咒語模仿】→ 公測變體【咒語自助餐】`）也會
 *   含變體名，所以「次數差」隨之改變。改用「技能列切片」直接驗，更穩。
 */
const adoptedCard = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet', selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme
}));
const notAdoptedCard = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme
}));
const countOf = (hay, needle) => (hay.match(new RegExp(needle, 'g')) || []).length;

// 把「技能列」切出來：變體瀏覽區（`data-testid="variant-browse"`）**之前**的全部內容。
// 這個錨點是為了讓測試能分辨「技能列印的」與「瀏覽區印的」——否則同一段文字
// 出現在兩處，斷言會永遠為真。
const skillRowOf = (html) => {
  const at = html.indexOf('variant-browse');
  return at >= 0 ? html.slice(0, at) : html;
};

// 技能列本身直接驗：瀏覽區之前的內容才是「技能列」
const adoptedRow = skillRowOf(adoptedCard);
const notAdoptedRow = skillRowOf(notAdoptedCard);
check('★ 技能列（瀏覽區之前）就含變體名', adoptedRow.includes('咒語自助餐'), true);
check('★ 未選用時技能列（瀏覽區之前）沒有變體名', notAdoptedRow.includes('咒語自助餐'), false);
// 最強的一條：技能列顯示的**上限**要是變體的。原版上限 10、咒語自助餐 6。
// 這條同時抓到「名稱沒換」與「只換名稱忘了換上限」兩種壞法。
check('★ 技能列的 SL 上限是變體的 6 級（原版是 10）',
  adoptedRow.includes('SL 3/6'), true);
check('★ 未選用時技能列的 SL 上限是原版的 10 級',
  notAdoptedRow.includes('SL 3/10'), true);
check('★ 技能列的描述是變體的（原版描述不出現）',
  adoptedRow.includes('不能取得【嵌合精通】英雄技能'), true);
check('★ 未選用時技能列的描述是原版的（變體描述不出現）',
  notAdoptedRow.includes('不能取得【嵌合精通】英雄技能'), false);
check('★ 未選用時技能列印的是原版描述',
  notAdoptedRow.includes('均使用所選屬性進行魔法檢定'), true);
// 舊語意已反轉：現在是取代，不是並列
check('★ 選用後不再並列印出原版描述', adoptedCard.includes('原版描述'), false);

// ─────────────────────────────────────────────────────────── J
section('J. 互斥：同一個技能有兩個變體時一次只能選一個（官方 p.36【暴怒】）');
check('【暴怒】確實有兩個變體', getVariantsForSkill('暴怒').length, 2);
const pickedBrawler = withSkillVariant({ name: '暴怒', sl: 5 }, 'braveBrawler', { maxSL: 5 });
check('選了【勇猛打手】就只有一個 variantId', pickedBrawler.variantId, 'braveBrawler');
// 切換到另一個變體＝覆蓋，不會同時帶兩個
const pickedMeteor = withSkillVariant(pickedBrawler, 'meteorSlam', { maxSL: 5 });
check('切換到【隕石猛擊】後只剩新的那個', pickedMeteor.variantId, 'meteorSlam');
check('不會同時保留兩個 variantId', Array.isArray(pickedMeteor.variantId), false);

// ─────────────────────────────────────────────────────────── K
section('K. 英雄技能互斥：選了變體就要擋掉被排除的英雄技能（官方載明）');
check('【咒語自助餐】排除【嵌合精通】', getVariantById('spellBuffet').excludesHeroicSkills, ['嵌合精通']);
check('【魔導武裝】排除【量子魔加農】', getVariantById('magitechArmament').excludesHeroicSkills, ['量子魔加農']);

const clashChar = {
  classes: [{ className: '嵌合師', level: 3, skills: [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet' }] }],
  heroicSkills: ['嵌合精通']
};
const conflicts = findVariantHeroicSkillConflicts(clashChar);
check('同時有變體與被排除的英雄技能 → 抓到 1 筆衝突', conflicts.length, 1);
check('衝突訊息指名英雄技能', conflicts[0].heroicSkill, '嵌合精通');
check('衝突訊息指名變體', conflicts[0].variantName, '咒語自助餐');

// 英雄技能的格式有兩種：字串 與 { name }
const clashCharObj = {
  classes: [{ className: '嵌合師', level: 3, skills: [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet' }] }],
  heroicSkills: [{ name: '嵌合精通', desc: '' }]
};
check('heroicSkills 是物件格式時也要抓到', findVariantHeroicSkillConflicts(clashCharObj).length, 1);
check('沒有英雄技能時不誤報',
  findVariantHeroicSkillConflicts({
    classes: [{ className: '嵌合師', level: 3, skills: [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet' }] }],
    heroicSkills: []
  }).length, 0);
check('沒有任何變體時不誤報',
  findVariantHeroicSkillConflicts({
    classes: [{ className: '嵌合師', level: 3, skills: [{ name: '咒語模仿', sl: 3 }] }],
    heroicSkills: ['嵌合精通']
  }).length, 0);

// ─────────────────────────────────────────────────────────── L
section('L. 規則層整合：衝突要真的變成 validateCharacter 的 error（不只是工具函式）');
// ⚠️ 這一節是為了防「寫了檢查函式但沒有接上」——那是最容易發生的半成品。
const vChar = createNewCharacter({ equipment: NEUTRAL, startingFundsRolled: 0 });
vChar.classes = [{ className: '嵌合師', level: 3, skills: [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet' }] }];
vChar.heroicSkills = ['嵌合精通'];
const vResult = validateCharacter(vChar);
const vHit = (vResult.errors || vResult.warnings || []).filter(
  (w) => typeof w.message === 'string' && w.message.includes('嵌合精通')
);
check('validateCharacter 有回報這個衝突', vHit.length >= 1, true);
check('回報的層級是 error（不是 warning）', vHit[0]?.type, 'error');

// ─────────────────────────────────────────────────────────── M
section('M. 回溯相容：舊角色（沒有 variantId）行為完全不變');
const legacyChar = mkChar(['core', 'playtest']);
legacyChar.classes = [{ className: '嵌合師', level: 2, skills: [{ name: '咒語模仿', sl: 2, selectedOptions: [] }] }];
check('舊角色 getAdoptedVariants 回空陣列', getAdoptedVariants(legacyChar).length, 0);
check('舊角色 getSkillVariant 回 null', getSkillVariant({ name: '咒語模仿', sl: 2 }), null);
check('舊角色 findVariantHeroicSkillConflicts 不誤報',
  findVariantHeroicSkillConflicts(legacyChar).length, 0);
const legacyCard = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 2, selectedOptions: [] }]),
  classIndex: 0, character: legacyChar, theme
}));
check('舊角色卡片照常顯示原版技能', legacyCard.includes('咒語模仿'), true);
// getAdoptedVariants 在有用變體時要抓到，並記得它屬於哪個職業
const adoptedChar = mkChar(['core', 'playtest']);
adoptedChar.classes = [{ className: '嵌合師', level: 3, skills: [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet' }] }];
const adoptedList = getAdoptedVariants(adoptedChar);
check('getAdoptedVariants 抓到 1 筆', adoptedList.length, 1);
check('getAdoptedVariants 帶上職業名', adoptedList[0]?.className, '嵌合師');
check('getAdoptedVariants 帶上變體', adoptedList[0]?.variant?.name, '咒語自助餐');

// ─────────────────────────────────────────────────────────── N
section('N. 儲存／確定時必須把 variantId 一起寫進去（SSR 抓不到的 bug）');
/**
 * ⚠️ 這一節是**刻意破壞驗證逼出來的**。
 *
 * 「儲存技能配置」與「創角按確定」都是**重建** `skills[]`，不是在原物件上改。
 * 第一版忘了把 `variantId` 帶過去 → 玩家選了變體、按了儲存，選用狀態無聲消失。
 *
 * 這個 bug **SSR 測試抓不到**：`handleSave` 只存在於 `onClick` 裡，SSR 不執行事件。
 * 所以只好把邏輯抽成純函式 `buildSkillEntry`（`coreBookVariants.js`），在這裡直接打。
 */
const entryAdopted = buildSkillEntry('咒語模仿', 3, { variantId: 'spellBuffet', originalMaxSL: 5 });
check('buildSkillEntry 有帶上 variantId', entryAdopted.variantId, 'spellBuffet');
check('buildSkillEntry 的 name 是原版識別字', entryAdopted.name, '咒語模仿');
check('buildSkillEntry 用變體上限夾 sl（6，不是原版 5）', entryAdopted.sl, 3);
const entryClamped = buildSkillEntry('暴怒', 5, { variantId: 'braveBrawler', originalMaxSL: 5 });
check('buildSkillEntry 會把 sl 夾到變體上限 3', entryClamped.sl, 3);
const entryOriginal = buildSkillEntry('咒語模仿', 3, { variantId: null, originalMaxSL: 5 });
check('沒選變體時不寫 variantId 欄位', 'variantId' in entryOriginal, false);
check('沒選變體時用原版上限', entryOriginal.sl, 3);
check('buildSkillEntry 保留 selectedOptions', buildSkillEntry('小工具', 2, { selectedOptions: ['a'] }).selectedOptions, ['a']);
check('沒給 selectedOptions 時給空陣列', buildSkillEntry('小工具', 2, {}).selectedOptions, []);
// 無效的 variantId 不能把 sl 弄壞
check('無效 variantId → 退回用原版上限',
  buildSkillEntry('暴怒', 5, { variantId: 'nope', originalMaxSL: 5 }).sl, 5);

// ─────────────────────────────────────────────────────────── O
section('O. 編輯模式的列也要顯示變體（`isInitialEdit` 讓 SSR 進得去）');
/**
 * 檢視模式與編輯模式是**兩段不同的 JSX**（`!isEditing` 與 `isEditing`）。
 * 檢視模式對了不代表編輯模式也對——第一版就是在檢視模式做好了、編輯模式整個漏掉。
 * `isInitialEdit={true}` 讓 SSR 直接渲染編輯模式，不必模擬點擊。
 */
const editAdopted = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet', selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true
}));
const editOriginal = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true
}));
/**
 * 編輯模式的邊界比檢視模式難切：選用面板（標題「核心書技能變體（公測）」）
 * **本來就會**印出變體名——那是給玩家點的按鈕，兩種狀態都該出現。
 * 所以「技能列」的邊界是**選用面板的標題**，不是 `variant-browse`（那在檢視模式）。
 */
const editRowOf = (html) => {
  const at = html.indexOf('核心書技能變體（公測）');
  return at >= 0 ? html.slice(0, at) : html;
};
const editAdoptedRow = editRowOf(editAdopted);
const editOriginalRow = editRowOf(editOriginal);
check('編輯模式：選用後技能列顯示變體名', editAdoptedRow.includes('咒語自助餐'), true);
check('編輯模式：未選用時技能列**不**顯示變體名',
  editOriginalRow.includes('咒語自助餐'), false);
check('編輯模式：未選用時技能列顯示原版名',
  editOriginalRow.includes('咒語模仿'), true);
check('編輯模式：選用後技能列用變體上限 6（原版 10）',
  editAdoptedRow.includes('SL 3/6'), true);
check('編輯模式：未選用時技能列用原版上限 10',
  editOriginalRow.includes('SL 3/10'), true);
check('編輯模式：選用後標示「取代【咒語模仿】」', editAdoptedRow.includes('取代【咒語模仿】'), true);
check('編輯模式：選用後提示原版暫不適用', editAdoptedRow.includes('暫不適用'), true);
check('編輯模式：選用後顯示變體描述',
  editAdoptedRow.includes('不能取得【嵌合精通】英雄技能'), true);
// 公測關閉時，編輯模式也不該出現變體
const editClosed = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core']), theme, isInitialEdit: true
}));
check('編輯模式：公測關閉時變體一個都不出現', editClosed.includes('咒語自助餐'), false);

// ─────────────────────────────────────────────────────────── P
section('P. §BC 反轉後的編輯模式入口：未選用時顯示精簡按鈕、選用後不顯示（§AW ＋ §BC）');
/**
 * GM 裁定 2026-10-16：「乖乖藏起來」——檢視模式不渲染未選用變體卡（§E）。
 * 但玩家還是要能在編輯模式選用——所以另開精簡入口（`data-testid="variant-picker"`），
 * 每個未選用變體顯示一行「原版【咒語模仿】→ 公測變體【咒語自助餐】 點此選用」。
 * 選用後入口消失，因為 pickable 變空。
 *
 * 為什麼不在原版技能列旁加按鈕？因為【暴怒】有兩個變體（勇猛打手／隕石猛擊），
 * 玩家要能看到「同技能多變體」這件事——集中顯示比散在各列清楚。
 */
const editPickerHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true
}));
// 切到選用面板後（標題「核心書技能變體（公測）」）的精簡入口區
const pickerIdx = editPickerHTML.indexOf('variant-picker');
const pickerSection = pickerIdx >= 0 ? editPickerHTML.slice(pickerIdx) : '';
check('編輯模式：未選用時顯示 variant-picker 精簡入口', pickerIdx >= 0, true);
check('編輯模式：精簡入口內含原版技能名【咒語模仿】', pickerSection.includes('咒語模仿'), true);
check('編輯模式：精簡入口內含變體名【咒語自助餐】', pickerSection.includes('咒語自助餐'), true);
check('編輯模式：精簡入口的按鈕文案是「點此選用」', pickerSection.includes('點此選用'), true);
// 同一段內不該出現完整的變體 desc（精簡入口只是一行按鈕，不是大卡）
check('編輯模式：精簡入口內不出現大卡描述字串',
  pickerSection.includes('不能取得【嵌合精通】英雄技能'), false);

// 選用後：精簡入口不應再出現（因為 pickable 變空）
const editAdoptedPickerHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet', selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true
}));
const adoptedPickerIdx = editAdoptedPickerHTML.indexOf('variant-picker');
check('編輯模式：已選用時 pick 不該再出現（沒有未選用變體）', adoptedPickerIdx, -1);
// 但「改回原版」鈕的文案還要在（因為 CoreBookVariantCard 仍渲染）
const adoptedSection = editAdoptedPickerHTML.indexOf('核心書技能變體（公測）') >= 0
  ? editAdoptedPickerHTML.slice(editAdoptedPickerHTML.indexOf('核心書技能變體（公測）'))
  : editAdoptedPickerHTML;
check('編輯模式：已選用時仍有「改回原版」鈕（CoreBookVariantCard 仍在）',
  adoptedSection.includes('改回原版'), true);

// 公測關閉時也沒有精簡入口
const editClosedPickerIdx = editClosed.indexOf('variant-picker');
check('編輯模式：公測關閉時也沒有 variant-picker', editClosedPickerIdx, -1);

// 【暴怒】有兩個變體 → 精簡入口要看得到兩筆「點此選用」
const editTwoVariantsHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('狂怒鬥士', [{ name: '暴怒', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true
}));
const twoVariantsPickerIdx = editTwoVariantsHTML.indexOf('variant-picker');
const twoPickerSection = twoVariantsPickerIdx >= 0 ? editTwoVariantsHTML.slice(twoVariantsPickerIdx) : '';
check('狂怒鬥士：兩個未選用變體 → 兩顆「點此選用」按鈕',
  (twoPickerSection.match(/點此選用/g) || []).length, 2);
check('狂怒鬥士：精簡入口內含【勇猛打手】', twoPickerSection.includes('勇猛打手'), true);
check('狂怒鬥士：精簡入口內含【隕石猛擊】', twoPickerSection.includes('隕石猛擊'), true);

// 「↑ [Repeat]」型護欄——故意讓「pickable 重複渲染」這類 bug 被抓到。
// 第一版破壞驗證時，故意把 `pickable = allForClass` 沒過濾，
// 結果大卡區跟精簡入口區同時渲染「點此選用」——但「精簡入口點此選用」這條只驗「有沒有」，
// 沒驗「幾次」，所以沒叫到。下面這條就為了抓「渲染次數錯」這類壞法。
check('嵌合師編輯模式：「點此選用」按鈕只出現 1 顆（不是 0 也不是 2）',
  (editPickerHTML.match(/點此選用/g) || []).length, 1);
check('狂怒鬥士編輯模式：「點此選用」按鈕剛好出現 2 顆（兩個變體各一）',
  (editTwoVariantsHTML.match(/點此選用/g) || []).length, 2);
check('已選用後「點此選用」按鈕不應再出現（pickable 已空）',
  (editAdoptedPickerHTML.match(/點此選用/g) || []).length, 0);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
