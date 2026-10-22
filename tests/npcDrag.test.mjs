/**
 * `resolveDragDirection` 護欄（GM 開卡實測 `GM-02-01` 的副產物）。
 *
 * 背景：步驟一的定位輪播靠「拖曳放手時的位移」決定換不換頁，而那段判斷
 * 原本寫在 `onMouseUp` 裡。`onClick` / `onMouseUp` 這類事件處理器在 SSR
 * 測試中不會執行（見 `AGENTS.md` §1），所以門檻寫錯、方向寫反、門檻被改成 0
 * 都不會有任何測試變紅——2026-10-21 的實測就是拖曳整個失效卻全綠。
 * 抽成純函式後，這一支才測得到。
 */
import { resolveDragDirection } from '../src/features/npc-workshop/utils/dragDirection.js';

let pass = 0;
let fail = 0;

function eq(label, actual, expected) {
  if (actual === expected) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}（期望 ${expected}，實得 ${actual}）`);
  }
}

console.log('============================================================');
console.log('  拖曳方向判定（resolveDragDirection）');
console.log('============================================================');

console.log('\n-- A. 桌面門檻 80px --');
eq('往左拖 320px → 下一張', resolveDragDirection(-320, 80), 1);
eq('往右拖 320px → 上一張', resolveDragDirection(320, 80), -1);
eq('往左拖 81px 剛過門檻 → 下一張', resolveDragDirection(-81, 80), 1);
eq('往左拖剛好 80px（未超過）→ 不動', resolveDragDirection(-80, 80), 0);
eq('往右拖剛好 80px（未超過）→ 不動', resolveDragDirection(80, 80), 0);
eq('完全沒動 → 不動', resolveDragDirection(0, 80), 0);
eq('只抖了 3px → 不動（避免手抖換頁）', resolveDragDirection(3, 80), 0);

console.log('\n-- B. 觸控門檻 50px --');
eq('往左拖 60px → 下一張', resolveDragDirection(-60, 50), 1);
eq('往右拖 60px → 上一張', resolveDragDirection(60, 50), -1);
eq('往左拖 50px（未超過）→ 不動', resolveDragDirection(-50, 50), 0);

console.log('\n-- C. 方向不可顛倒（回歸重點） --');
// 這三條是「左右寫反」時唯一會紅的斷言。
eq('負位移必須回正方向', resolveDragDirection(-1000, 80), 1);
eq('正位移必須回負方向', resolveDragDirection(1000, 80), -1);
eq('兩者必須相反', resolveDragDirection(-120, 80) === -resolveDragDirection(120, 80), true);

console.log('\n-- D. 異常輸入一律不動（fail closed） --');
eq('dx 是 NaN → 不動', resolveDragDirection(NaN, 80), 0);
eq('dx 是 undefined → 不動', resolveDragDirection(undefined, 80), 0);
eq('dx 是 null → 不動', resolveDragDirection(null, 80), 0);
eq('dx 是字串 → 不動', resolveDragDirection('-320', 80), 0);
eq('threshold 是 NaN → 不動', resolveDragDirection(-320, NaN), 0);
eq('threshold 是 0 → 不動（門檻為零等於一碰就換頁）', resolveDragDirection(-320, 0), 0);
eq('threshold 是負數 → 不動', resolveDragDirection(-320, -80), 0);
eq('threshold 是 undefined → 不動', resolveDragDirection(-320, undefined), 0);

console.log('\n-- E. 極端值 --');
eq('位移 0 且門檻 0 → 不動', resolveDragDirection(0, 0), 0);
eq('位移極大 → 仍只回 1', resolveDragDirection(-Number.MAX_SAFE_INTEGER, 80), 1);
eq('位移極大（正）→ 仍只回 -1', resolveDragDirection(Number.MAX_SAFE_INTEGER, 80), -1);
eq('Infinity → 不動', resolveDragDirection(Infinity, 80), 0);

console.log('\n============================================================');
if (fail === 0) {
  console.log(`  通過 ${pass} / ${pass}　（全部通過）`);
  console.log('============================================================');
  process.exit(0);
} else {
  console.log(`  通過 ${pass} / ${pass + fail}　（失敗 ${fail}）`);
  console.log('============================================================');
  process.exit(1);
}
