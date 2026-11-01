/**
 * 等級與跨技能公式求值（`src/features/character-sheet/utils/skillFormulaEvaluator.jsx` 與 `playCopyFormat.js`）測試。
 *
 * 執行：npm run test:levelformula
 *
 * ── 為什麼有這道關卡 ──────────────────────────────────────────────
 * 玩家跑團反饋：商人技能【貿易之風】中的「你的等級乘以 30」沒有隨角色等級精算，
 * 仍顯示原始公式。
 *
 * 經盤點，全書包含角色等級、半等級、跨技能 SL 的公式分佈在：
 *   - 商人（貿易之風、過期食品）
 *   - 旅人（忠實夥伴）
 *   - 英雄技能（誘餌、靈氣掌握、小憩片刻、短瞬間的安息、陰陽流轉）
 *   - 金手指（富家子弟、信魔使徒）
 *   - 底力技（零之機運、零之救濟、零之天災）
 *   - 目標等級（歐米茄終結、靈魂竊取）——須維持不替換
 *
 * 本檔護欄鎖定：
 *   A. 公式求值純函式（乘算、除算、半等級向下取整、跨技能 SL）
 *   B. 目標等級豁免（不被玩家自身等級誤換）
 *   C. 跑團複製文本動態代入（Discord 粗體格式）
 *   D. 規則資料層的標記規範（貿易之風單位為小寫 z）
 */
import assert from 'node:assert/strict';
import {
  evaluateFormulaString,
  getSkillLevel
} from '../src/features/character-sheet/utils/skillFormulaEvaluator.jsx';
import {
  formatSkillCopyText,
  formatHeroicSkillCopyText,
  formatQuirkCopyText,
  formatZeroPowerCopyText,
  evaluateSkillDescForCopy
} from '../src/features/character-sheet/utils/playCopyFormat.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import { ZERO_EFFECTS } from '../src/features/character-sheet/data/zeroPowers.js';

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    pass++;
    console.log(`[PASS] ${label}`);
  } catch (err) {
    fail++;
    console.error(`[FAIL] ${label}`);
    console.error(`  預期: ${JSON.stringify(expected)}`);
    console.error(`  實際: ${JSON.stringify(actual)}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

// -----------------------------------------------------------------------------
section('A. 等級公式求值純函式（evaluateFormulaString）');
// -----------------------------------------------------------------------------

// 1. 商人：貿易之風（乘算）
const rLvl5 = evaluateFormulaString('你的等級乘以 30', 1, { level: 5 });
check('等級 5：你的等級乘以 30 → 150', { value: rLvl5.value, text: rLvl5.text, isCalculated: rLvl5.isCalculated }, { value: 150, text: '【150】', isCalculated: true });

const rLvl10 = evaluateFormulaString('你的等級乘以 30', 1, { level: 10 });
check('等級 10：你的等級乘以 30 → 300', { value: rLvl10.value, text: rLvl10.text, isCalculated: rLvl10.isCalculated }, { value: 300, text: '【300】', isCalculated: true });

const rLvl0 = evaluateFormulaString('你的等級乘以 30', 1, { level: 0 });
check('等級 0：你的等級乘以 30 → 不精算（維持原狀）', { value: rLvl0.value, text: rLvl0.text, isCalculated: rLvl0.isCalculated }, { value: null, text: '【你的等級乘以 30】', isCalculated: false });

// 2. 商人：過期食品（半等級 + SL*10，嚴格向下取整）
const rExp5 = evaluateFormulaString('你等級的一半 + (SL × 10)', 2, { level: 5 });
check('等級 5、SL 2：你等級的一半 + (SL × 10) → 22 (Math.floor(5/2) + 20)', { value: rExp5.value, text: rExp5.text, isCalculated: rExp5.isCalculated }, { value: 22, text: '【22】', isCalculated: true });

const rExp10 = evaluateFormulaString('你等級的一半 + (SL × 10)', 1, { level: 10 });
check('等級 10、SL 1：你等級的一半 + (SL × 10) → 15', { value: rExp10.value, text: rExp10.text, isCalculated: rExp10.isCalculated }, { value: 15, text: '【15】', isCalculated: true });

// 3. 英雄技能：小憩片刻（常數 + 半等級）
const rRest = evaluateFormulaString('20+你的等級的一半', 1, { level: 7 });
check('等級 7：20+你的等級的一半 → 23 (20 + 3)', { value: rRest.value, text: rRest.text, isCalculated: rRest.isCalculated }, { value: 23, text: '【23】', isCalculated: true });

// 4. 金手指：富家子弟（常數 + 半等級無「的」字）
const rRich = evaluateFormulaString('5+你的等級一半', 1, { level: 6 });
check('等級 6：5+你的等級一半 → 8 (5 + 3)', { value: rRich.value, text: rRich.text, isCalculated: rRich.isCalculated }, { value: 8, text: '【8】', isCalculated: true });

// 5. 底力技：零之機運、救濟、天災（常數 + 半等級）
const rChance = evaluateFormulaString('30 + 等級的一半', 0, { level: 5 });
check('等級 5：30 + 等級的一半 → 32 (30 + 2)', { value: rChance.value, text: rChance.text, isCalculated: rChance.isCalculated }, { value: 32, text: '【32】', isCalculated: true });

const rRemedy = evaluateFormulaString('40 + 等級的一半', 0, { level: 8 });
check('等級 8：40 + 等級的一半 → 44', { value: rRemedy.value, text: rRemedy.text, isCalculated: rRemedy.isCalculated }, { value: 44, text: '【44】', isCalculated: true });

// 6. 英雄技能：陰陽流轉（單純等級與半等級）
const rYinFull = evaluateFormulaString('你的等級', 1, { level: 5 });
check('等級 5：你的等級 → 5', { value: rYinFull.value, text: rYinFull.text, isCalculated: rYinFull.isCalculated }, { value: 5, text: '【5】', isCalculated: true });

const rYinHalf = evaluateFormulaString('你等級的一半', 1, { level: 5 });
check('等級 5：你等級的一半 → 2', { value: rYinHalf.value, text: rYinHalf.text, isCalculated: rYinHalf.isCalculated }, { value: 2, text: '【2】', isCalculated: true });

// 7. 英雄技能：靈氣掌握（除算）
const rAura = evaluateFormulaString('你的等級除以 10', 1, { level: 25 });
check('等級 25：你的等級除以 10 → 2 (Math.floor(25/10))', { value: rAura.value, text: rAura.text, isCalculated: rAura.isCalculated }, { value: 2, text: '【2】', isCalculated: true });

// 8. 複雜式：短瞬間的安息（半等級保留後續公式）
const rBlink = evaluateFormulaString('你角色等級/2+10×以此方式恢復狀態數', 1, { level: 9 });
check('等級 9：你角色等級/2+10×以此方式恢復狀態數 → 4 + 10 × 以此方式恢復狀態數', { value: rBlink.value, text: rBlink.text, isCalculated: rBlink.isCalculated }, { value: '4 + 10 × 以此方式恢復狀態數', text: '【4 + 10 × 以此方式恢復狀態數】', isCalculated: true });

// -----------------------------------------------------------------------------
section('B. 跨技能與角色狀態引用（getSkillLevel）');
// -----------------------------------------------------------------------------

const mockChar = {
  classes: [
    {
      className: '神射手',
      skills: [{ name: '鷹眼', sl: 3 }]
    },
    {
      className: '靈媒',
      skills: []
    }
  ],
  customClasses: [
    {
      className: '靈媒',
      skills: [{ name: '通靈', sl: 2 }]
    }
  ]
};

check('跨技能查找：鷹眼 SL 為 3', getSkillLevel(mockChar, '鷹眼'), 3);
check('跨技能查找：不存在的技能 SL 為 0', getSkillLevel(mockChar, '不存在的技能'), 0);

const rCross1 = evaluateFormulaString('你的鷹眼SL', 1, { level: 10, character: mockChar });
check('跨技能引用：等級 10，你的鷹眼SL → 3', { value: rCross1.value, text: rCross1.text, isCalculated: rCross1.isCalculated }, { value: 3, text: '【3】', isCalculated: true });

const rCross2 = evaluateFormulaString('3+你的鷹眼SL', 1, { level: 10, character: mockChar });
check('跨技能引用：等級 10，3+你的鷹眼SL → 6', { value: rCross2.value, text: rCross2.text, isCalculated: rCross2.isCalculated }, { value: 6, text: '【6】', isCalculated: true });

const rCross3 = evaluateFormulaString('你等級的一半+（你的鷹眼SL×5）', 1, { level: 10, character: mockChar });
check('跨技能引用：等級 10，你等級的一半+（你的鷹眼SL×5） → 20 (5 + 15)', { value: rCross3.value, text: rCross3.text, isCalculated: rCross3.isCalculated }, { value: 20, text: '【20】', isCalculated: true });

// -----------------------------------------------------------------------------
section('C. 目標等級豁免防線（不被自身等級替換）');
// -----------------------------------------------------------------------------

const rTargetHalf = evaluateFormulaString('20 + 目標等級的一半', 1, { level: 20 });
check('目標等級的一半：保持原字串不精算', { value: rTargetHalf.value, text: rTargetHalf.text, isCalculated: rTargetHalf.isCalculated }, { value: null, text: '【20 + 目標等級的一半】', isCalculated: false });

const rTargetMult = evaluateFormulaString('目標等級 × 30', 1, { level: 20 });
check('目標等級乘算：保持原字串不精算', { value: rTargetMult.value, text: rTargetMult.text, isCalculated: rTargetMult.isCalculated }, { value: null, text: '【目標等級 × 30】', isCalculated: false });

// -----------------------------------------------------------------------------
section('D. 跑團複製文字（playCopyFormat）動態求值');
// -----------------------------------------------------------------------------

const descTradeWinds = '價值等於或低於【你的等級乘以 30】z；或者你創造一個附近的 NPC。';
check(
  'evaluateSkillDescForCopy：等級 5 精算為 **【150】**z',
  evaluateSkillDescForCopy(descTradeWinds, 1, { level: 5 }),
  '價值等於或低於**【150】**z；或者你創造一個附近的 NPC。'
);

const descExpiredFood = '恢復【你等級的一半 + (SL × 10)】點 HP。';
check(
  'evaluateSkillDescForCopy：等級 5、SL 2 精算為 **【22】**點 HP',
  evaluateSkillDescForCopy(descExpiredFood, 2, { level: 5 }),
  '恢復**【22】**點 HP。'
);

const skillCopy = formatSkillCopyText({
  className: '商人',
  name: '貿易之風',
  sl: 2,
  maxSL: 3,
  desc: descTradeWinds,
  characterName: '愛麗絲',
  characterLevel: 5
});
check('formatSkillCopyText 包含角色名與精算金額', skillCopy.includes('**【150】**z'), true);

const heroicCopy = formatHeroicSkillCopyText({
  name: '小憩片刻',
  sourceLabel: '英雄特技',
  effect: '恢復【20+你的等級的一半】點 HP 與 MP。',
  characterName: '愛麗絲',
  characterLevel: 6
});
check('formatHeroicSkillCopyText 精算為 **【23】**', heroicCopy.includes('**【23】**'), true);

const quirkCopy = formatQuirkCopyText({
  name: '富家子弟',
  effect: '獲得【5+你的等級一半】點金幣加值。',
  characterName: '愛麗絲',
  characterLevel: 8
});
check('formatQuirkCopyText 精算為 **【9】**', quirkCopy.includes('**【9】**'), true);

const zeroCopy = formatZeroPowerCopyText({
  name: '零之機運',
  triggerName: '連續',
  triggerText: '當隊友發動時。',
  effectName: '零之機運',
  effectText: '造成【30 + 等級的一半】傷害。',
  filled: 6,
  max: 6,
  characterName: '愛麗絲',
  characterLevel: 10
});
check('formatZeroPowerCopyText 精算為 **【35】**', zeroCopy.includes('**【35】**'), true);

// -----------------------------------------------------------------------------
section('E. 資料層與原書一致性校驗');
// -----------------------------------------------------------------------------

const merchantDesc = rulesData.classes?.['商人']?.skills?.find(s => s.name === '貿易之風')?.desc || '';
check('資料層貿易之風：已統一為小寫 z', merchantDesc.includes('【你的等級乘以 30】z'), true);

const zeroRemedy = ZERO_EFFECTS.find(e => e.id === 'remedy')?.desc || '';
check('資料層零之救濟：已套用計算式括號 【40 + 等級的一半】', zeroRemedy.includes('【40 + 等級的一半】'), true);

const zeroChance = ZERO_EFFECTS.find(e => e.id === 'chance')?.desc || '';
check('資料層零之機運：已套用計算式括號 【30 + 等級的一半】', zeroChance.includes('【30 + 等級的一半】'), true);

const zeroScourge = ZERO_EFFECTS.find(e => e.id === 'scourge')?.desc || '';
check('資料層零之天災：已套用計算式括號 【30 + 等級的一半】', zeroScourge.includes('【30 + 等級的一半】'), true);

// -----------------------------------------------------------------------------
section('結算');
// -----------------------------------------------------------------------------
console.log(`\n通過：${pass}　失敗：${fail}`);
if (fail > 0) {
  process.exit(1);
}
