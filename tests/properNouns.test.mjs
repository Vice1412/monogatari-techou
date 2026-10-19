/**
 * 專有名詞「中文 · ENGLISH」對照測試（`GEMINI.md` 規則三第 4 點）。
 *
 * 執行方式：
 *   npm run test:propernouns
 *
 * 這組測試的價值在於**守住「寧缺勿造」**：查無官方英文的名詞必須原樣回傳，
 * 不得因為新增資料而意外生出未經核對的英文。
 */
import { withEn, englishOf } from '../src/utils/properNouns.js';

let pass = 0;
let fail = 0;
const lines = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          expected: ${JSON.stringify(expected)}\n          actual:   ${JSON.stringify(actual)}`
  );
}

function section(title) {
  lines.push(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------- A
section('A. NPC 定位（Bestiary Vol. 1 p.46）');
check('暴徒', withEn('暴徒'), '暴徒 · BRUTE');
check('獵人', withEn('獵人'), '獵人 · HUNTER');
check('法師', withEn('法師'), '法師 · MAGE');
check('破壞者', withEn('破壞者'), '破壞者 · SABOTEUR');
check('衛士', withEn('衛士'), '衛士 · SENTINEL');
check('輔助', withEn('輔助'), '輔助 · SUPPORT');

// ---------------------------------------------------------------- B
section('B. 物種（Core p.302）');
check('野獸', withEn('野獸'), '野獸 · BEAST');
check('構造體', withEn('構造體'), '構造體 · CONSTRUCT');
check('惡魔', withEn('惡魔'), '惡魔 · DEMON');
check('不死', withEn('不死'), '不死 · UNDEAD');

// ---------------------------------------------------------------- C
section('C. 職業 · 核心（Core p.182–200）');
check('秘儀師', withEn('秘儀師'), '秘儀師 · ARCANIST');
check('嵌合師', withEn('嵌合師'), '嵌合師 · CHIMERIST');
check('暗黑之刃', withEn('暗黑之刃'), '暗黑之刃 · DARKBLADE');
check('狂怒鬥士', withEn('狂怒鬥士'), '狂怒鬥士 · FURY');
check('吟唱者', withEn('吟唱者'), '吟唱者 · ORATOR');
check('武器大師', withEn('武器大師'), '武器大師 · WEAPONMASTER');

// ---------------------------------------------------------------- D
section('D. 職業 · 拓展（三本 Atlas）');
check('魔奏者（高等）', withEn('魔奏者'), '魔奏者 · CHANTER');
check('徽記師（高等）', withEn('徽記師'), '徽記師 · SYMBOLIST');
check('植物學家（自然）', withEn('植物學家'), '植物學家 · FLORALIST');
check('商人（自然）', withEn('商人'), '商人 · MERCHANT');
check('機師（科技）', withEn('機師'), '機師 · PILOT');
check('靈能者（科技）', withEn('靈能者'), '靈能者 · ESPER');
check('突變體（科技）', withEn('突變體'), '突變體 · MUTANT');

// ---------------------------------------------------------------- E
section('E. 【…】限定標記：查表時剝除、顯示時保留');
// 2026-10-19：守護者【Playtest】等 6 個職業已刪除，這裡改用**合成後綴**驗機制本身
// （剝除後仍查得到 守護者 的官方英文，顯示時後綴保留）。
check('守護者【自訂】', withEn('守護者【自訂】'), '守護者【自訂】 · GUARDIAN');
check('秘儀師【變體】', withEn('秘儀師【變體】'), '秘儀師【變體】 · ARCANIST');

// ---------------------------------------------------------------- F
section('F. 寧缺勿造：查無官方英文者原樣回傳');
check('不存在的名詞', withEn('不存在的名詞'), '不存在的名詞');
check('空字串', withEn(''), '');
check('null', withEn(null), null);
check('undefined', withEn(undefined), undefined);
check('englishOf 查無 → null', englishOf('查無此物'), null);

// ---------------------------------------------------------------- G
section('G. 格式鐵律：半形空格＋間隔號＋半形空格，英文全大寫');
const sample = withEn('暴徒');
check('間隔號為 U+00B7', sample[3], '\u00B7');
check('間隔號前後各一空格', sample.slice(2, 5), ' \u00B7 ');
check('英文為大寫', sample.slice(5), sample.slice(5).toUpperCase());

// ---------------------------------------------------------------- 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(52)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(52)}`);
process.exit(fail > 0 ? 1 : 0);
