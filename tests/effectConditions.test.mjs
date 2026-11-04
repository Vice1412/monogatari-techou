/**
 * 效果條件判定引擎測試。
 *
 * 執行：`npm run test:conditions`（若 `package.json` 還沒登記，見檔尾說明）
 *
 * 期望值來源：`scratch/flows/CONDITION-SPEC.md` §2 的封閉詞彙與 §3 的三態規則，
 * 以及 `characterEngine.js:1969-1998 / 2124-2130` 的裝備判定（本層逐字照抄）。
 *
 * 全部用假角色：跑團卡上的真角色一旦被測試寫髒，玩家看到的物防就會少 2。
 */
import fs from 'node:fs';

import {
  CONDITION_KINDS,
  CONDITION_VERDICTS,
  evaluateCondition,
  evaluateWhen,
  buildConditionContext,
  describeCondition
} from '../src/features/character-sheet/utils/effectConditions.js';
import { createFreeformWeaponSpec } from '../src/features/character-sheet/data/customWeapons.js';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};
const section = (t) => lines.push(`\n=== ${t} ===`);

/** 造一個測試角色：裝備欄齊全、六種異常狀態都為假、等級 7 */
const mkChar = (over = {}) => ({
  level: 7,
  equipment: { mainHand: '徒手打擊', offHand: '徒手打擊', armor: '無裝甲 / 冒險服' },
  statusAfflictions: {
    dazed: false, enraged: false, poisoned: false, shaken: false, slow: false, weak: false
  },
  classes: [],
  customWeapons: [],
  ...over
});

const withEquip = (mainHand, offHand = '無盾牌', armor = '無裝甲 / 冒險服') => (
  mkChar({ equipment: { mainHand, offHand, armor } })
);

const judge = (cond, char) => evaluateCondition(cond, buildConditionContext(char));

// 自訂武器：一件「定制武器」（HF p.106，固定雙手）與一件「自由武器」（玩家自己寫的）。
const CUSTOM_SPEAR = { id: 'c1', name: '自製長矛', category: '矛', range: '近戰', customizations: [] };
const FREEFORM_CLUB = createFreeformWeaponSpec({ id: 'f1', name: '家傳木棍', category: '重型', hands: 2 });

// ─────────────────────────────────────────────────────────── A
section('A. 封閉詞彙（新增 kind 一律要改這裡，不得自創）');
check('kind 共 17 個', CONDITION_KINDS.length, 17);
check('kind 沒有重複', new Set(CONDITION_KINDS).size, CONDITION_KINDS.length);
check('三態詞彙共 3 個', CONDITION_VERDICTS, ['true', 'false', 'unknown']);
const missingDocs = CONDITION_KINDS.filter((kind) => {
  const text = describeCondition({ kind });
  return !text || text.includes('未知條件') || text.startsWith('未提供');
});
check('每個 kind 都有一句中文說明', missingDocs, []);
check('未知 kind 不會被當成 false', judge({ kind: 'notAKind' }, mkChar()), 'unknown');
check('cond 是 null 時回 unknown', evaluateCondition(null, buildConditionContext(mkChar())), 'unknown');
check('cond 是空物件時回 unknown', judge({}, mkChar()), 'unknown');

// ─────────────────────────────────────────────────────────── B
section('B. handsEmpty：徒手打擊是武器表的一筆，主手放盾牌不能算空手');
check('預設角色（兩手都徒手打擊）-> 空手', judge({ kind: 'handsEmpty' }, mkChar()), 'true');
check('主手空白字串 -> 空手', judge({ kind: 'handsEmpty' }, withEquip('')), 'true');
check('主手短匕首 -> 不是空手', judge({ kind: 'handsEmpty' }, withEquip('短匕首')), 'false');
check('主手盾牌 -> 不是空手（不能因為查不到武器就判空手）',
  judge({ kind: 'handsEmpty' }, withEquip('青銅圓盾', '無盾牌')), 'false');
check('副手盾牌 -> 不是空手', judge({ kind: 'handsEmpty' }, withEquip('徒手打擊', '青銅圓盾')), 'false');
// 引擎 `:2127` 的 offIsUnarmed 只看盾表，副手拿武器時仍回 true——這裡照抄，不順手修。
check('副手放武器 -> 仍算空手（照抄引擎的歷史行為）',
  judge({ kind: 'handsEmpty' }, withEquip('徒手打擊', '短匕首')), 'true');
check('裝備欄整個不見 -> unknown（不是空手）',
  judge({ kind: 'handsEmpty' }, { level: 7 }), 'unknown');
check('null 角色 -> unknown', evaluateCondition({ kind: 'handsEmpty' }, buildConditionContext(null)), 'unknown');

// ─────────────────────────────────────────────────────────── C
section('C. noArmor：只認中性防具');
check('中性防具 -> 沒有防具', judge({ kind: 'noArmor' }, mkChar()), 'true');
check('「無」視同沒有防具', judge({ kind: 'noArmor' }, withEquip('徒手打擊', '無盾牌', '無')), 'true');
check('旅行皮甲 -> 有防具', judge({ kind: 'noArmor' }, withEquip('徒手打擊', '無盾牌', '旅行皮甲')), 'false');
check('查不到的防具名 -> unknown（資料漂移要看得到）',
  judge({ kind: 'noArmor' }, withEquip('徒手打擊', '無盾牌', '不知名斗篷')), 'unknown');
check('裝備欄不見 -> unknown', judge({ kind: 'noArmor' }, { level: 7 }), 'unknown');

// ─────────────────────────────────────────────────────────── D
section('D. mainWeaponCategoryIn：類別來自武器表');
check('短匕首 ∈ 匕首 -> true', judge({ kind: 'mainWeaponCategoryIn', categories: ['匕首'] }, withEquip('短匕首')), 'true');
check('短匕首 ∈ 劍 -> false', judge({ kind: 'mainWeaponCategoryIn', categories: ['劍'] }, withEquip('短匕首')), 'false');
check('短匕首 ∈ 匕首、劍 -> true',
  judge({ kind: 'mainWeaponCategoryIn', categories: ['匕首', '劍'] }, withEquip('短匕首')), 'true');
check('徒手打擊 ∈ 鬥毆 -> true（它是武器表的一筆）',
  judge({ kind: 'mainWeaponCategoryIn', categories: ['鬥毆'] }, mkChar()), 'true');
check('主手盾牌 -> false（盾不是武器）',
  judge({ kind: 'mainWeaponCategoryIn', categories: ['匕首'] }, withEquip('青銅圓盾')), 'false');
check('categories 是空陣列 -> unknown（資料寫壞）',
  judge({ kind: 'mainWeaponCategoryIn', categories: [] }, withEquip('短匕首')), 'unknown');
check('categories 不是陣列 -> unknown',
  judge({ kind: 'mainWeaponCategoryIn', categories: '匕首' }, withEquip('短匕首')), 'unknown');
check('自訂武器（定制長矛）∈ 矛 -> true',
  judge({ kind: 'mainWeaponCategoryIn', categories: ['矛'] },
    mkChar({ customWeapons: [CUSTOM_SPEAR], equipment: { mainHand: '自製長矛', offHand: '無盾牌', armor: '無裝甲 / 冒險服' } })),
  'true');
check('自由武器（家傳木棍）∈ 重型 -> true',
  judge({ kind: 'mainWeaponCategoryIn', categories: ['重型'] },
    mkChar({ customWeapons: [FREEFORM_CLUB], equipment: { mainHand: '家傳木棍', offHand: '無盾牌', armor: '無裝甲 / 冒險服' } })),
  'true');
check('武器表查不到又不在自訂武器裡 -> unknown',
  judge({ kind: 'mainWeaponCategoryIn', categories: ['劍'] }, withEquip('來路不明的刀')), 'unknown');

// ─────────────────────────────────────────────────────────── E
section('E. mainWeaponRange／mainWeaponHands');
check('戰弓是遠程', judge({ kind: 'mainWeaponRange', range: '遠程' }, withEquip('戰弓')), 'true');
check('戰弓不是近戰', judge({ kind: 'mainWeaponRange', range: '近戰' }, withEquip('戰弓')), 'false');
check('短匕首是近戰', judge({ kind: 'mainWeaponRange', range: '近戰' }, withEquip('短匕首')), 'true');
check('range 參數不是近戰／遠程 -> unknown',
  judge({ kind: 'mainWeaponRange', range: '中程' }, withEquip('短匕首')), 'unknown');
check('主手盾牌沒有 range -> false', judge({ kind: 'mainWeaponRange', range: '近戰' }, withEquip('青銅圓盾')), 'false');
check('巨劍是雙手', judge({ kind: 'mainWeaponHands', hands: 2 }, withEquip('巨劍')), 'true');
check('短匕首不是雙手', judge({ kind: 'mainWeaponHands', hands: 2 }, withEquip('短匕首')), 'false');
check('hands 參數缺 -> unknown', judge({ kind: 'mainWeaponHands' }, withEquip('短匕首')), 'unknown');
check('定制武器固定佔兩手',
  judge({ kind: 'mainWeaponHands', hands: 2 },
    mkChar({ customWeapons: [CUSTOM_SPEAR], equipment: { mainHand: '自製長矛', offHand: '無盾牌', armor: '無裝甲 / 冒險服' } })),
  'true');

// ─────────────────────────────────────────────────────────── F
section('F. equippedTwoCategories／mainWeaponAndShield／offHandIsShield');
check('匕首＋匕首 -> 不是兩個類別',
  judge({ kind: 'equippedTwoCategories' }, withEquip('短匕首', '短匕首')), 'false');
check('匕首＋劍 -> 兩個類別', judge({ kind: 'equippedTwoCategories' }, withEquip('短匕首', '青銅劍')), 'true');
check('主手＋盾牌 -> 不是兩個武器類別',
  judge({ kind: 'equippedTwoCategories' }, withEquip('短匕首', '青銅圓盾')), 'false');
check('主手武器＋副手盾牌 -> true',
  judge({ kind: 'mainWeaponAndShield' }, withEquip('短匕首', '青銅圓盾')), 'true');
check('主手徒手＋副手盾牌 -> mainWeaponAndShield false',
  judge({ kind: 'mainWeaponAndShield' }, withEquip('徒手打擊', '青銅圓盾')), 'false');
check('副手是盾 -> true', judge({ kind: 'offHandIsShield' }, withEquip('徒手打擊', '青銅圓盾')), 'true');
check('副手「無盾牌」-> false', judge({ kind: 'offHandIsShield' }, withEquip('短匕首', '無盾牌')), 'false');
check('主手雙手武器時副手不生效 -> offHandIsShield false',
  judge({ kind: 'offHandIsShield' }, withEquip('巨劍', '青銅圓盾')), 'false');
check('副手名字查不到 -> unknown', judge({ kind: 'offHandIsShield' }, withEquip('短匕首', '不明圓盤')), 'unknown');

// ─────────────────────────────────────────────────────────── G
section('G. equippedCategoryCount／noEquippedWeapon');
check('兩把匕首，min 2 -> true',
  judge({ kind: 'equippedCategoryCount', category: '匕首', min: 2 }, withEquip('短匕首', '短匕首')), 'true');
check('兩把匕首，min 3 -> false',
  judge({ kind: 'equippedCategoryCount', category: '匕首', min: 3 }, withEquip('短匕首', '短匕首')), 'false');
check('徒手不算「裝備一件」',
  judge({ kind: 'equippedCategoryCount', category: '鬥毆', min: 1 }, mkChar()), 'false');
check('category 缺 -> unknown', judge({ kind: 'equippedCategoryCount', min: 1 }, withEquip('短匕首')), 'unknown');
check('兩手都徒手 -> 沒有裝備武器', judge({ kind: 'noEquippedWeapon' }, mkChar()), 'true');
check('主手有武器 -> 不是沒有武器', judge({ kind: 'noEquippedWeapon' }, withEquip('短匕首')), 'false');
check('副手有武器 -> 不是沒有武器',
  judge({ kind: 'noEquippedWeapon' }, withEquip('徒手打擊', '短匕首')), 'false');

// ─────────────────────────────────────────────────────────── H
section('H. statusCountAtLeast');
check('沒有異常狀態，min 1 -> false',
  judge({ kind: 'statusCountAtLeast', n: 1 }, mkChar()), 'false');
check('一項異常，min 1 -> true',
  judge({ kind: 'statusCountAtLeast', n: 1 },
    mkChar({ statusAfflictions: { dazed: false, poisoned: true, weak: false } })), 'true');
check('三項異常，min 3 -> true',
  judge({ kind: 'statusCountAtLeast', n: 3 },
    mkChar({ statusAfflictions: { dazed: true, poisoned: true, weak: true } })), 'true');
check('min 0 一律成立（門檻就是 0）',
  judge({ kind: 'statusCountAtLeast', n: 0 }, mkChar()), 'true');
check('statusAfflictions 不見了 -> unknown',
  judge({ kind: 'statusCountAtLeast', n: 1 }, { level: 7, equipment: mkChar().equipment }), 'unknown');
check('n 缺 -> unknown', judge({ kind: 'statusCountAtLeast' }, mkChar()), 'unknown');

// ─────────────────────────────────────────────────────────── I
section('I. skillSLAtLeast：同名技能取最高、沒學過回 unknown');
const SCHOLAR = {
  level: 7,
  equipment: mkChar().equipment,
  statusAfflictions: mkChar().statusAfflictions,
  classes: [{ className: '博學士', skills: [{ name: '集中', sl: 3 }] }]
};
check('集中 SL3，min 3 -> true', judge({ kind: 'skillSLAtLeast', skill: '集中', min: 3 }, SCHOLAR), 'true');
check('集中 SL3，min 4 -> false', judge({ kind: 'skillSLAtLeast', skill: '集中', min: 4 }, SCHOLAR), 'false');
check('技能不在角色身上 -> unknown（不是 false）',
  judge({ kind: 'skillSLAtLeast', skill: '靈巧雙手', min: 1 }, SCHOLAR), 'unknown');
check('兼職同名技能取最高（2 與 4，min 4 -> true）',
  judge({ kind: 'skillSLAtLeast', skill: '集中', min: 4 }, {
    ...SCHOLAR,
    classes: [
      { className: '博學士', skills: [{ name: '集中', sl: 2 }] },
      { className: '吟唱者', skills: [{ name: '集中', sl: 4 }] }
    ]
  }), 'true');
check('classes 欄位不見 -> unknown',
  judge({ kind: 'skillSLAtLeast', skill: '集中', min: 1 }, { level: 7, equipment: mkChar().equipment }), 'unknown');
check('skill 參數缺 -> unknown', judge({ kind: 'skillSLAtLeast', min: 1 }, SCHOLAR), 'unknown');

// ─────────────────────────────────────────────────────────── J
section('J. levelAtLeast／levelBelow');
check('Lv7 >= 7 -> true', judge({ kind: 'levelAtLeast', n: 7 }, mkChar()), 'true');
check('Lv7 >= 8 -> false', judge({ kind: 'levelAtLeast', n: 8 }, mkChar()), 'false');
check('Lv7 < 8 -> true', judge({ kind: 'levelBelow', n: 8 }, mkChar()), 'true');
check('Lv7 < 7 -> false', judge({ kind: 'levelBelow', n: 7 }, mkChar()), 'false');
// `level` 缺欄時退回「這張卡自己的開卡規則」；兩者都沒有才是 unknown。
// 刻意不退回硬編碼的 5：那會替一張「等級欄位掉了」的 20 級角色謊報 5 級。
check('沒有 level 時退回建立規則的起始等級 5',
  judge({ kind: 'levelAtLeast', n: 5 }, mkChar({ level: null, creationRules: { startingLevel: 5 } })), 'true');
check('等級完全查不到 -> unknown',
  judge({ kind: 'levelAtLeast', n: 1 }, { equipment: mkChar().equipment }), 'unknown');
check('n 缺 -> unknown', judge({ kind: 'levelAtLeast' }, mkChar()), 'unknown');

// ─────────────────────────────────────────────────────────── K
section('K. evaluateWhen：空陣列 unknown、任一 false 優先、其餘 unknown');
const TRUE_COND = { kind: 'handsEmpty' };
const FALSE_COND = { kind: 'mainWeaponHands', hands: 2 };
const UNKNOWN_COND = { kind: 'mainWeaponHands' };
check('空陣列 -> unknown（不是 true）', evaluateWhen([], buildConditionContext(mkChar())), 'unknown');
check('不是陣列 -> unknown', evaluateWhen(null, buildConditionContext(mkChar())), 'unknown');
check('全部成立 -> true', evaluateWhen([TRUE_COND], buildConditionContext(mkChar())), 'true');
check('有一個不成立 -> false',
  evaluateWhen([TRUE_COND, FALSE_COND], buildConditionContext(mkChar())), 'false');
check('true + unknown -> unknown',
  evaluateWhen([TRUE_COND, UNKNOWN_COND], buildConditionContext(mkChar())), 'unknown');
check('unknown + false -> false（false 優先）',
  evaluateWhen([UNKNOWN_COND, FALSE_COND], buildConditionContext(mkChar())), 'false');
check('false 在前也一樣是 false',
  evaluateWhen([FALSE_COND, UNKNOWN_COND], buildConditionContext(mkChar())), 'false');

// ─────────────────────────────────────────────────────────── L
section('L. 情境物件：可重用、可誤傳角色、不碰全域');
const ctx = buildConditionContext(mkChar());
check('情境有標記（避免被誤當角色重建）', ctx.__isConditionContext, true);
check('同一份情境算兩次答案一樣',
  evaluateCondition({ kind: 'handsEmpty' }, ctx), evaluateCondition({ kind: 'handsEmpty' }, ctx));
check('直接傳角色也能算（等於先建情境）',
  evaluateCondition({ kind: 'handsEmpty' }, mkChar()), 'true');
check('傳 null 角色 -> unknown', evaluateCondition({ kind: 'levelAtLeast', n: 1 }, null), 'unknown');
check('建立情境不會修改角色', (() => {
  const char = mkChar();
  const snapshot = JSON.stringify(char);
  buildConditionContext(char);
  return JSON.stringify(char) === snapshot;
})(), true);
check('describeCondition 分得出單手／雙手',
  [describeCondition({ kind: 'mainWeaponHands', hands: 1 }), describeCondition({ kind: 'mainWeaponHands', hands: 2 })],
  ['主手是單手武器', '主手是雙手武器']);

// ─────────────────────────────────────────────────────────── N
section('N. noShield：offHandIsShield 的反面，但缺資料仍是 unknown');
check('副手「無盾牌」-> 沒有盾', judge({ kind: 'noShield' }, mkChar()), 'true');
check('副手徒手打擊 -> 沒有盾',
  judge({ kind: 'noShield' }, withEquip('短匕首', '徒手打擊')), 'true');
check('副手青銅圓盾 -> 有盾（反面不成立）',
  judge({ kind: 'noShield' }, withEquip('短匕首', '青銅圓盾')), 'false');
check('副手名字查不到 -> unknown（不是 true）',
  judge({ kind: 'noShield' }, withEquip('短匕首', '不明圓盤')), 'unknown');
check('主手雙手武器時副手不生效 -> 沒有盾',
  judge({ kind: 'noShield' }, withEquip('巨劍', '青銅圓盾')), 'true');
check('裝備欄不見 -> unknown', judge({ kind: 'noShield' }, { level: 7 }), 'unknown');

// ─────────────────────────────────────────────────────────── O
section('O. noMartialArmor：只認 armors[].martial === true');
check('中性防具 -> 不是職業防具', judge({ kind: 'noMartialArmor' }, mkChar()), 'true');
check('輕甲（旅行皮甲）-> 不是職業防具',
  judge({ kind: 'noMartialArmor' }, withEquip('徒手打擊', '無盾牌', '旅行皮甲')), 'true');
check('職業防具（板條甲）-> 反面不成立',
  judge({ kind: 'noMartialArmor' }, withEquip('徒手打擊', '無盾牌', '板條甲')), 'false');
check('職業防具（鋼鐵板甲）也一樣',
  judge({ kind: 'noMartialArmor' }, withEquip('徒手打擊', '無盾牌', '鋼鐵板甲')), 'false');
check('查不到的防具名 -> unknown（不是 true）',
  judge({ kind: 'noMartialArmor' }, withEquip('徒手打擊', '無盾牌', '不知名斗篷')), 'unknown');
check('裝備欄不見 -> unknown', judge({ kind: 'noMartialArmor' }, { level: 7 }), 'unknown');

// ─────────────────────────────────────────────────────────── P
section('P. crisis：需要 stats.maxHp，沒有就 unknown');
const crisisChar = (hp) => mkChar({ currentHp: hp });
const crisisStats = { maxHp: 30, crisisThreshold: 15 };
check('HP 15、上限 30（閾值 15）-> 危機成立',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(15), crisisStats)), 'true');
check('HP 16 -> 不成立（邊界右側）',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(16), crisisStats)), 'false');
check('HP 0 -> 成立',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(0), crisisStats)), 'true');
check('沒有 stats -> unknown（不猜「滿血」也不猜「危機」）',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(10))), 'unknown');
check('stats 沒有 maxHp -> unknown',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(10), { maxMp: 20 })), 'unknown');
check('maxHp 為 0（屬性未指派、數值不成立）-> unknown',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(0), { maxHp: 0 })), 'unknown');
check('沒有給 crisisThreshold 時用量的一半（上限 30 → 15）',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(15), { maxHp: 30 })), 'true');
check('currentHp 是 null（＝滿血）-> 不成立，不是 unknown',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar(null), crisisStats)), 'false');
check('currentHp 欄位整個不存在 -> unknown',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(mkChar(), crisisStats)), 'unknown');
check('currentHp 是垃圾字串 -> unknown',
  evaluateCondition({ kind: 'crisis' }, buildConditionContext(crisisChar('重傷'), crisisStats)), 'unknown');

// ─────────────────────────────────────────────────────────── M
section('Q. 原始碼自檢：不得 import 引擎（循環依賴）、不得用 eval');
let source = '';
try {
  source = fs.readFileSync(
    new URL('../src/features/character-sheet/utils/effectConditions.js', import.meta.url), 'utf8');
} catch {
  source = fs.readFileSync('src/features/character-sheet/utils/effectConditions.js', 'utf8');
}
check('沒有 import characterEngine', /from\s+['"][^'"]*characterEngine/.test(source), false);
check('沒有 eval(', /\beval\s*\(/.test(source), false);
check('沒有 new Function', /new\s+Function\s*\(/.test(source), false);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
