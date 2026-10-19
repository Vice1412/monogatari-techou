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
 * §BC 反轉版（2026-10-17）：**根本不再有變體瀏覽區**——檢視模式只渲染技能列本身。
 * 技能列裡就已選用變體，標題／描述／上限都是變體的。
 *
 * 所以「技能列切片」這招**仍然需要**，但錨點改成**多變體技能展開區**（`variant-picker-{skillName}`），
 * 因為只有嵌合師會展開成那個區塊（單變體展開按鈕仍只展開變體清單，不是完整卡）。
 */
const adoptedCard = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet', selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme
}));
const notAdoptedCard = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme
}));

// 把「技能列」切出來：變體展開區（`data-testid="variant-picker-咒語模仿"`）**之前**的內容。
// 這個錨點是為了讓測試能分辨「技能列印的」與「展開區印的」——否則同一段文字
// 出現在兩處，斷言會永遠為真（§BC §AW9 第 5 條的教訓）。
const skillRowOf = (html) => {
  const at = html.indexOf('variant-picker-');
  return at >= 0 ? html.slice(0, at) : html;
};

// 技能列本身直接驗：展開區之前的內容才是「技能列」
const adoptedRow = skillRowOf(adoptedCard);
const notAdoptedRow = skillRowOf(notAdoptedCard);
check('★ 技能列（含展開區之前）就含變體名', adoptedRow.includes('咒語自助餐'), true);
check('★ 未選用時技能列（含展開區之前）沒有變體名', notAdoptedRow.includes('咒語自助餐'), false);
// 最強的一條：技能列顯示的**上限**要是變體的。原版上限 10、咒語自助餐 6。
// 這條同時抓到「名稱沒換」與「只換名稱忘了換上限」兩種壞法。
// ※ 檢視模式 (isEditing=false) 沒有 SL X/Y 格式，所以這條改驗 maxSL 數字
// ★ 技能列印的 SL 描述含變體上限 6
check('★ 技能列的描述是變體的（原版描述不出現）',
  adoptedRow.includes('不能取得【嵌合精通】英雄技能'), true);
check('★ 未選用時技能列的描述是原版的（變體描述不出現）',
  notAdoptedRow.includes('不能取得【嵌合精通】英雄技能'), false);
check('★ 未選用時技能列印的是原版描述',
  notAdoptedRow.includes('均使用所選屬性進行魔法檢定'), true);
// 舊語意已反轉：現在是取代，不是並列
check('★ 選用後不再並列印出原版描述', adoptedCard.includes('原版描述'), false);

// §BC 反轉版（2026-10-17）：**檢視模式不再有任何 variant-browse / 變體大卡**。
// 這個斷言專門抓「§BC 沒移除乾淨 → 截圖那個『兩段並列』bug 又回來了」這種回歸。
check('★ 檢視模式：不再渲染 CoreBookVariantCard（已選用變體只在技能列裡）',
  adoptedCard.includes('使用中') && adoptedCard.includes('Playtest 2026-10-01'), false);
check('★ 檢視模式：已選用變體不應出現「改回原版」鈕（那是編輯模式才有）',
  adoptedCard.includes('改回原版'), false);

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
 * 編輯模式下，變體展開區（`variant-picker-{skillName}`）的「之前」就是技能列。
 * 已選用時不會展開（按鈕是「改回原版」），所以這時的整份 HTML 才是技能列本體。
 */
const editRowOf = (html) => {
  const at = html.indexOf('variant-picker-');
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
section('P. §BC 反轉版的編輯模式互動：公測按鈕在原版技能列旁、原地切換（§BC 2026-10-17）');
/**
 * GM 裁定 2026-10-17：精簡入口改成「**原版技能列旁的公測按鈕**」，而不是「職業卡底下的整塊」。
 * 點公測按鈕 → 展開該技能的變體清單（inline） → 點任一變體 → 預覽模式（原地切換）→ 確認才寫入。
 *
 * 與 §BC 第一版（2026-10-16，職業卡底下整塊 variant-picker + 已選用大卡）差異：
 *   - 第一版：精簡入口 + 已選用大卡（CoreBookVariantCard）並列 → 截圖的「兩段並列」bug
 *   - 第二版：原版技能列旁永遠一顆「公測」按鈕，已選用時變「改回原版」 → 沒有第二段
 *
 * `data-testid`：
 *   - `variant-toggle-{skillName}`  未選用時的「公測」按鈕
 *   - `variant-revert-{skillName}`  已選用時的「改回原版」按鈕
 *   - `variant-picker-{skillName}`  展開的變體清單
 *   - `variant-preview-{skillName}-{variantId}`  預覽按鈕
 *   - `variant-confirm-{skillName}`  「使用此公測變體」按鈕（預覽中才出現）
 *   - `variant-cancel-{skillName}`   「關閉預覽」按鈕（預覽中才出現）
 *
 * SSR 注入點（用 `initialExpandedSkill` 與 `initialPreviewVariants` 模擬 useState 初始值）：
 *   - 預設未展開、未預覽
 *   - `initialExpandedSkill: '咒語模仿'` → 展開該技能
 *   - `initialPreviewVariants: { '咒語模仿': 'spellBuffet' }` → 預覽該變體
 */

// (1) 未選用、未展開：只有「公測」按鈕
const editPickerHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true
}));
const countOf = (hay, needle) => (hay.match(new RegExp(needle, 'g')) || []).length;
check('編輯模式：未選用時「公測」展開鈕存在', editPickerHTML.indexOf('variant-toggle-咒語模仿') >= 0, true);
check('編輯模式：未選用時不該出現「改回原版」鈕', editPickerHTML.includes('改回原版'), false);
check('編輯模式：未展開時不該出現變體清單', editPickerHTML.indexOf('variant-picker-咒語模仿'), -1);
check('編輯模式：未展開時不該出現「使用此公測變體」', editPickerHTML.includes('使用此公測變體'), false);
check('編輯模式：未展開時不該出現「關閉預覽」', editPickerHTML.includes('關閉預覽'), false);

// (2) 展開：出現變體清單，但尚未預覽
const editExpandedHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true,
  initialExpandedSkill: '咒語模仿'
}));
const pickerIdx = editExpandedHTML.indexOf('variant-picker-咒語模仿');
check('編輯模式：展開後出現變體清單', pickerIdx >= 0, true);
const pickerSection = pickerIdx >= 0 ? editExpandedHTML.slice(pickerIdx) : '';
check('展開後：變體清單含變體名【咒語自助餐】', pickerSection.includes('咒語自助餐'), true);
check('展開後：變體清單含英文代號【SPELL BUFFET】', pickerSection.includes('SPELL BUFFET'), true);
check('展開後：變體清單含變體上限 6', pickerSection.includes('上限 6') || pickerSection.includes('maxSL 6'), true);
check('展開後：未預覽時不該出現「使用此公測變體」', pickerSection.includes('使用此公測變體'), false);
check('展開後：未預覽時不該出現「關閉預覽」', pickerSection.includes('關閉預覽'), false);

// (3) 預覽中：出現確認/取消鈕、標題切換成變體名、SL 用變體上限
const editPreviewHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true,
  initialExpandedSkill: '咒語模仿',
  initialPreviewVariants: { '咒語模仿': 'spellBuffet' }
}));
check('預覽中：「使用此公測變體」鈕存在', editPreviewHTML.includes('使用此公測變體'), true);
check('預覽中：「關閉預覽」鈕存在', editPreviewHTML.includes('關閉預覽'), true);
const previewRow = editRowOf(editPreviewHTML);
check('預覽中：技能列標題換成變體名（咒語自助餐）', previewRow.includes('咒語自助餐'), true);
// 注意：不能檢查 `>咒語模仿<` 是否出現——變體描述裡合法引用了原版名
// （「就英雄技能的要求而言，此技能的名稱視為「咒語模仿」」），codex 連結會把它
// 渲染成 `>咒語模仿<`。那不是「標題沒切換」的 bug，是正常的官方文字。
// 改成：標題 span（font-serif 那個）的內容是變體名，不是原版名。
check('預覽中：技能標題 span 是變體名（不是原版名）',
  previewRow.includes('font-serif">咒語自助餐</span>'), true);
check('預覽中：技能標題 span 不是原版名',
  previewRow.includes('font-serif">咒語模仿</span>'), false);
check('預覽中：SL 上限用變體的 6', previewRow.includes('SL 3/6'), true);
check('預覽中：不再用原版上限 10', previewRow.includes('SL 3/10'), false);
check('預覽中：描述換成變體的', previewRow.includes('不能取得【嵌合精通】英雄技能'), true);

// (4) 已選用：出現「改回原版」鈕 + 沒有「公測」展開鈕
const editAdoptedPickerHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet', selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true
}));
check('編輯模式：已選用時出現「改回原版」鈕', editAdoptedPickerHTML.indexOf('variant-revert-咒語模仿') >= 0, true);
check('編輯模式：已選用時不該出現「公測」展開鈕', editAdoptedPickerHTML.indexOf('variant-toggle-咒語模仿'), -1);
check('編輯模式：已選用時不該展開變體清單', editAdoptedPickerHTML.indexOf('variant-picker-咒語模仿'), -1);
check('編輯模式：已選用時不該出現「使用此公測變體」', editAdoptedPickerHTML.includes('使用此公測變體'), false);
check('編輯模式：已選用時不該出現「關閉預覽」', editAdoptedPickerHTML.includes('關閉預覽'), false);

// (5) 公測關閉：完全沒有任何變體入口
check('編輯模式：公測關閉時也沒有「公測」按鈕', editClosed.indexOf('variant-toggle-') < 0, true);
check('編輯模式：公測關閉時也沒有「改回原版」鈕', editClosed.includes('改回原版'), false);
check('編輯模式：公測關閉時也不展開變體清單', editClosed.indexOf('variant-picker-') < 0, true);

// (6) 【暴怒】有兩個變體 → 展開後變體清單有兩筆
const editTwoVariantsHTML = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('狂怒鬥士', [{ name: '暴怒', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme, isInitialEdit: true,
  initialExpandedSkill: '暴怒'
}));
const twoPickerIdx = editTwoVariantsHTML.indexOf('variant-picker-暴怒');
const twoPickerSection = twoPickerIdx >= 0 ? editTwoVariantsHTML.slice(twoPickerIdx) : '';
check('狂怒鬥士：展開後變體清單含【勇猛打手】', twoPickerSection.includes('勇猛打手'), true);
check('狂怒鬥士：展開後變體清單含【隕石猛擊】', twoPickerSection.includes('隕石猛擊'), true);
check('狂怒鬥士：展開後變體清單含兩個預覽按鈕',
  countOf(editTwoVariantsHTML, 'variant-preview-暴怒-'), 2);

// 「↑ [Repeat]」型護欄——專門抓「渲染次數錯」的 bug（§AW9 教訓）。
// 第一版破壞驗證時，故意讓精簡入口重複渲染，結果「有沒有」型斷言沒叫到。
// 改用「出現次數」型護欄：
// ※ `countOf` 整份 HTML 數（含 title 屬性），所以變體名會在 title 與 inner text
//    各出現一次（= 2）。用 `countVisible` 只數 inner text（剝掉 title 屬性後）。
const stripTitles = (html) => html.replace(/title="[^"]*"/g, '');
const countVisible = (hay, needle) => (hay.replace(/title="[^"]*"/g, '').match(new RegExp(needle, 'g')) || []).length;
check('嵌合師：展開後【咒語自助餐】可見文字只出現 1 次（只在變體清單裡）',
  countVisible(editExpandedHTML, '咒語自助餐'), 1);
check('狂怒鬥士：展開後【勇猛打手】可見文字只出現 1 次（清單內 1 次）',
  countVisible(editTwoVariantsHTML, '勇猛打手'), 1);
check('狂怒鬥士：展開後【隕石猛擊】可見文字只出現 1 次（清單內 1 次）',
  countVisible(editTwoVariantsHTML, '隕石猛擊'), 1);
check('預覽中：「使用此公測變體」按鈕只出現 1 次',
  countOf(editPreviewHTML, '使用此公測變體'), 1);
check('預覽中：「關閉預覽」按鈕只出現 1 次',
  countOf(editPreviewHTML, '關閉預覽'), 1);
check('展開但未預覽：「使用此公測變體」按鈕 0 次',
  countOf(editExpandedHTML, '使用此公測變體'), 0);
check('展開但未預覽：「關閉預覽」按鈕 0 次',
  countOf(editExpandedHTML, '關閉預覽'), 0);
check('已選用時：「使用此公測變體」按鈕 0 次（已選用要直接走「改回原版」）',
  countOf(editAdoptedPickerHTML, '使用此公測變體'), 0);

// ★ §BC 反轉版的最關鍵護欄：檢視模式**永遠**不該出現任何變體切換介面
const viewAdopted = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, variantId: 'spellBuffet', selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme
}));
check('★ 檢視模式：永遠不該出現「公測」展開鈕', viewAdopted.indexOf('variant-toggle-'), -1);
check('★ 檢視模式：永遠不該出現「改回原版」鈕', viewAdopted.includes('改回原版'), false);
check('★ 檢視模式：永遠不該展開變體清單', viewAdopted.indexOf('variant-picker-'), -1);
check('★ 檢視模式：永遠不該出現預覽確認鈕', viewAdopted.includes('使用此公測變體'), false);
check('★ 檢視模式：永遠不該出現預覽取消鈕', viewAdopted.includes('關閉預覽'), false);

// ─────────────────────────────────────────────────────────── Q
// §BE（2026-10-19）：公測變體改由開卡規則的【開放公測修訂內容】控制，
// 不再看角色身上 `enabledSourcebooks` 有沒有 playtest。
// 這一段是**行為驗證**（真的 SSR 渲染），不是原始碼掃描。
section('Q. 公測變體由 creationRules.allowPlaytest 控制（§BE）');

const renderEditRow = (character) => renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 3, selectedOptions: [] }]),
  classIndex: 0, character, theme, isInitialEdit: true
}));

// (a) 新規則：allowPlaytest=true，角色 enabledSourcebooks 沒有 playtest → 仍要出現公測鈕
const ruleOnChar = mkChar(['core']);
ruleOnChar.creationRules = { allowPlaytest: true };
check('規則開啟（enabledSourcebooks 沒 playtest）→ 公測鈕出現',
  renderEditRow(ruleOnChar).indexOf('variant-toggle-咒語模仿') >= 0, true);

// (b) 新規則：allowPlaytest=false，但舊資料 enabledSourcebooks 有 playtest → 不得出現
const ruleOffChar = mkChar(['core', 'playtest']);
ruleOffChar.creationRules = { allowPlaytest: false };
check('規則關閉（舊資料仍留著 playtest）→ 公測鈕不出現',
  renderEditRow(ruleOffChar).indexOf('variant-toggle-') < 0, true);

// (c) 舊角色遷移：creationRules 完全沒有 allowPlaytest → 退回看 enabledSourcebooks
const legacyOnChar = mkChar(['core', 'playtest']);
check('舊角色（無 allowPlaytest、有 playtest）→ 公測鈕仍出現（遷移不破）',
  renderEditRow(legacyOnChar).indexOf('variant-toggle-咒語模仿') >= 0, true);
const legacyOffChar = mkChar(['core']);
check('舊角色（無 allowPlaytest、無 playtest）→ 公測鈕不出現',
  renderEditRow(legacyOffChar).indexOf('variant-toggle-') < 0, true);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
