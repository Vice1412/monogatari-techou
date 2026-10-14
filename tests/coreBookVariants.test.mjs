/**
 * 核心書技能變體（Core Book Variants）的護欄。
 *
 * 使用者裁定的鐵律：
 * 「要勾選【官方公測修訂】才會出現的項目，千萬不可用修改到原本規則書的內容。
 *   勾選之後，那些有改過的內容要在後面標記【公測】，然後和原版的技能同時存在，
 *   並把不一樣的內容粗體化讓用戶看到。」
 *
 * 執行：
 *   npx esbuild tests/coreBookVariants.test.mjs --bundle --platform=node --format=esm \
 *     --outfile=.test-build/coreBookVariants.mjs --log-level=warning && node .test-build/coreBookVariants.mjs
 *
 * ## 為什麼用 SSR 而不是截圖
 *
 * 這個開關的失敗模式是「**條件永遠為 false**」——build 與其他 17 道測試都會過，
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
  getVariantsForSkill
} from '../src/features/character-sheet/data/coreBookVariants.js';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
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
section('E. 公測開啟時：變體出現，且原版技能**同時**還在（不可覆寫原版）');
const on = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師'), classIndex: 0,
  character: mkChar(['core', 'playtest']), theme
}));
check('開啟時看得到【咒語自助餐】', on.includes('咒語自助餐'), true);
check('開啟時看得到【公測】徽章', on.includes('公測'), true);
check('開啟時看得到「取代【咒語模仿】」', on.includes('咒語模仿'), true);
check('★ 原版【咒語模仿】與變體**同時存在**（不可覆寫）',
  on.includes('咒語模仿') && on.includes('咒語自助餐'), true);

// ─────────────────────────────────────────────────────────── E2
section('E2. 已配點時變體也要在（`classItem.skills` 非空的那條分支）');
// 真實情境：角色已經配過【咒語模仿】。第一版把變體寫在空狀態的 else 分支裡，
// 所以「有配點」反而看不到變體——這條護欄就是為了那個錯而存在的。
const onWithSkills = renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkClassItem('嵌合師', [{ name: '咒語模仿', sl: 2, selectedOptions: [] }]),
  classIndex: 0, character: mkChar(['core', 'playtest']), theme
}));
check('已配點時仍看得到變體【咒語自助餐】', onWithSkills.includes('咒語自助餐'), true);
check('已配點時原版【咒語模仿】也在', onWithSkills.includes('咒語模仿'), true);

// ─────────────────────────────────────────────────────────── E3
section('E3. 職業名的來源必須是 `className`（元件吃的是 character.classes 的元素）');
check('rulesData 的職業物件沒有 className（所以不能直接當 classItem）',
  'className' in rulesData.classes['嵌合師'], false);
check('rulesData 的職業物件沒有 name',
  'name' in rulesData.classes['嵌合師'], false);
check('有兩個變體的職業（狂怒鬥士）兩張都出現',
  (renderToStaticMarkup(React.createElement(ClassSkillCard, {
    classItem: mkClassItem('狂怒鬥士'), classIndex: 0,
    character: mkChar(['core', 'playtest']), theme
  })).match(/勇猛打手|隕石猛擊/g) || []).length, 2);

// ─────────────────────────────────────────────────────────── F
section('F. 閘門來源必須正確（這是最容易寫錯、而且不會報錯的地方）');
// `resolveCreationRules()` 的回傳**沒有** enabledSourcebooks——第一版就是寫錯這個
const r = resolveCreationRules({});
check('resolveCreationRules 沒有 enabledSourcebooks（所以不能用它當閘門）',
  'enabledSourcebooks' in r, false);
check('但它有 defaultSourcebooks', Array.isArray(r.defaultSourcebooks), true);
check('也有 allowedSourcebooks', Array.isArray(r.allowedSourcebooks), true);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
