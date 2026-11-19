/**
 * W7 個人命刻純函式模組測試（對應 docs/plan/07-fateclocks-to-character.md §7.3）
 *
 * 執行：npm run test:fateclocks
 */
import assert from 'node:assert/strict';
import {
  normalizeClock,
  normalizeClocks,
  findClock,
  fullClocks,
  setClockSegments,
  addClockSegments,
  copyClockToCharacter
} from '../src/features/character-sheet/utils/fateClocks.js';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, ok, detail = '') => {
  if (ok) pass += 1;
  else fail += 1;
  lines.push(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  —— ${detail}` : ''}`);
};

// 1. normalizeClocks(null) & 缺 theme / type 補預設
check('T1 normalizeClocks(null) 回傳空陣列',
  JSON.stringify(normalizeClocks(null)) === '[]' && JSON.stringify(normalizeClocks(undefined)) === '[]',
  '[]');

const legacyNormalized = normalizeClocks([
  { id: 'c_old', title: '舊格式命刻', totalSegments: 6, filledSegments: 2 },
  null,
  { id: 'c_em', title: '翡翠色', totalSegments: 4, filledSegments: 9, theme: 'emerald', type: 'line' }
]);
check('T2 缺 theme/type 補上預設 amber / circle，emerald 正規化為 green 且夾住超出格數',
  legacyNormalized.length === 2
  && legacyNormalized[0].theme === 'amber'
  && legacyNormalized[0].type === 'circle'
  && legacyNormalized[1].theme === 'green'
  && legacyNormalized[1].filledSegments === 4,
  JSON.stringify(legacyNormalized));

// 2. addClockSegments 與邊界夾制＋負向回退
const baseHero = {
  name: '時間守望者',
  clocks: [
    { id: 'clk_a', title: '封印解開', totalSegments: 6, filledSegments: 2, theme: 'red', type: 'circle' },
    { id: 'clk_b', title: '盟友救援', totalSegments: 4, filledSegments: 4 }
  ],
  log: []
};
const origSnapshot = JSON.stringify(baseHero);

const afterPlus = addClockSegments(baseHero, 'clk_a', 10);
check('T3 addClockSegments 正向夾在 totalSegments (2 + 10 -> 6) 且紀錄 kind=clock 完成履歷',
  findClock(afterPlus, 'clk_a').filledSegments === 6
  && afterPlus.log.length === 1
  && afterPlus.log[0].kind === 'clock'
  && afterPlus.log[0].title.includes('封印解開'),
  `${findClock(afterPlus, 'clk_a').filledSegments}/6`);

const afterMinus = addClockSegments(afterPlus, 'clk_a', -10);
check('T4 addClockSegments 負向夾在 0 (6 - 10 -> 0) 且不改寫原物件（不可變）',
  findClock(afterMinus, 'clk_a').filledSegments === 0
  && JSON.stringify(baseHero) === origSnapshot,
  `原物件不變, 後值=${findClock(afterMinus, 'clk_a').filledSegments}`);

// 3. 不存在的 clockId 原樣回傳（不拋錯、不新增）
const unchanged = addClockSegments(baseHero, 'clk_missing', 2);
check('T5 不存在的 clockId 回傳同一角色參考，不拋錯亦不新增',
  unchanged === baseHero && unchanged.clocks.length === 2,
  '同一參考');

// 4. fullClocks 只回傳已填滿的命刻
const completed = fullClocks(baseHero);
check('T6 fullClocks 僅回傳填滿之命刻（clk_b）且容忍缺 theme 舊命刻',
  completed.length === 1 && completed[0].id === 'clk_b' && completed[0].theme === 'amber',
  completed.map((c) => c.id).join(','));

// 5. setClockSegments 邊界與同值不重複記帳
const sameSet = setClockSegments(baseHero, 'clk_a', 2);
check('T7 setClockSegments 同值不變不寫重複履歷',
  sameSet === baseHero && sameSet.log.length === 0,
  'log=0');

// 6. copyClockToCharacter 重新產生 id、不覆蓋既有命刻並寫履歷
const copySource = { id: 'clk_a', title: '舊全域陰謀', totalSegments: 8, filledSegments: 3, theme: 'purple', type: 'line' };
const copyRes = copyClockToCharacter(baseHero, copySource);
check('T8 copyClockToCharacter 重新產生不撞號 id、保留原 clk_a 並寫入 kind=clock 履歷',
  copyRes.ok
  && copyRes.character.clocks.length === 3
  && copyRes.clock.id !== 'clk_a'
  && copyRes.character.clocks[0].id === 'clk_a'
  && copyRes.clock.title === '舊全域陰謀'
  && copyRes.clock.filledSegments === 3
  && copyRes.character.log[0].kind === 'clock',
  `newId=${copyRes.clock?.id}`);

// 7. normalizeClock 對非法輸入安全回傳 null
check('T9 normalizeClock 非法輸入回 null',
  normalizeClock(null) === null && normalizeClock('bad') === null,
  'null');

for (const l of lines) console.log(l);
console.log(`\n  通過 ${pass} / ${pass + fail}${fail ? `　失敗 ${fail}` : '　（全部通過）'}`);
if (fail > 0) process.exit(1);
assert.equal(fail, 0);
