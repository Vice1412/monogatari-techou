/**
 * 規則索引的搜尋（`utils/codexSearch.js`）測試。
 *
 * 執行：`npm run test:codexsearch`
 *
 * 這支測的是**純函式**，不是畫面。畫面上「有沒有那個輸入框」由
 * `tests/ruleCodex.test.mjs` 的形狀斷言守；這裡守的是「輸入什麼、回什麼」。
 *
 * 為什麼要分開：搜尋壞掉的方式很安靜——輸入框在、按了也有反應，只是回錯東西
 * 或什麼都不回。那種壞法截圖看不出來，形狀斷言也看不出來，只有餵字串進去才知道。
 */
import { RULE_CODEX } from '../src/features/character-sheet/data/ruleCodexData.js';
import {
  buildCodexIndex,
  searchCodex,
  CODEX_FIELD_LABEL
} from '../src/features/character-sheet/utils/codexSearch.js';

let pass = 0;
let fail = 0;
const lines = [];

const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};
const ok = (label, cond) => eq(label, !!cond, true);
const section = (t) => lines.push(`\n=== ${t} ===`);

const IDS = Object.keys(RULE_CODEX);
const INDEX = buildCodexIndex(RULE_CODEX);

/* ══════════════════════════════════════════════════════════════
   A. 索引：18 節都要進來，而且每一節都要有可搜尋的欄位
   ══════════════════════════════════════════════════════════════ */
section('A. 索引建得起來');

eq('A1 索引條目數＝RULE_CODEX 的鍵數', INDEX.length, IDS.length);
eq('A2 索引的 id 與 RULE_CODEX 的鍵逐一相同', INDEX.map((e) => e.id), IDS);
eq('A3 每一節都有 title', INDEX.filter((e) => !e.title).length, 0);
eq('A4 每一節都有 book（原書名）', INDEX.filter((e) => !e.book).length, 0);
eq('A5 每一節都至少有一個可搜尋欄位', INDEX.filter((e) => e.fields.length === 0).length, 0);
ok('A6 索引總欄位數 > 500（18 節的規模）', INDEX.reduce((n, e) => n + e.fields.length, 0) > 500);

// 結構護欄：collectFields 產生的每一種 field，都必須在 FIELD_ORDER 與標籤表裡。
// 漏一個的症狀是「那一類命中的排序永遠排最後、標籤顯示成『條文』」——不會報錯。
const FIELD_KINDS = [...new Set(INDEX.flatMap((e) => e.fields.map((f) => f.field)))].sort();
eq('A7 出現過的欄位種類（逐一列出，不是只數數量）', FIELD_KINDS,
  ['book', 'item', 'keyword', 'page', 'row', 'rule', 'spell', 'summary', 'title']);
eq('A8 每一種欄位都有中文標籤（沒有就落回「條文」而使用者不知道命中在哪）',
  FIELD_KINDS.filter((k) => !CODEX_FIELD_LABEL[k]), []);

// 反面控制：索引**不准**把 id 收進來。收了的話搜「a」會命中全部（代號幾乎都含 a）。
const idHits = searchCodex(INDEX, 'arcana');
eq('A9 代號不是可搜尋欄位（搜 "arcana" 不該命中任何一節）', idHits.length, 0);

/* ══════════════════════════════════════════════════════════════
   B. 搜尋：找得到、找得準、找錯時安靜
   ══════════════════════════════════════════════════════════════ */
section('B. 搜尋');

// 對照組：先證明「真的有掃到」。沒有這一條，下面所有「0 筆」都可能是壞掉。
const arcanaHits = searchCodex(INDEX, '阿爾卡納');
ok('B1 搜「阿爾卡納」至少命中一節（對照組：證明索引真的有被讀）', arcanaHits.length >= 1);
eq('B2 標題命中的那一節排第一', arcanaHits[0].title, '阿爾卡納');
eq('B3 回報的欄位是「標題」', arcanaHits[0].label, '標題');

const mpHits = searchCodex(INDEX, 'MP');
ok('B4 搜「MP」命中多節（條文／咒語裡到處都是）', mpHits.length > 1);
eq('B5 大小寫不敏感（mp 與 MP 回一樣的結果）',
  searchCodex(INDEX, 'mp').map((r) => r.id), mpHits.map((r) => r.id));

const bookHits = searchCodex(INDEX, '科技奇幻手冊');
eq('B6 原書名可搜（科技奇幻手冊 4 節）', bookHits.length, 4);
eq('B7 原書命中回報「原書」', [...new Set(bookHits.map((r) => r.label))], ['原書']);

const pageHits = searchCodex(INDEX, '178');
ok('B8 頁碼可搜（178 命中阿爾卡納）', pageHits.some((r) => r.id === 'arcana'));

// 咒語名要搜得到。用官方譯名（這本書沒有「火球」——那是通用奇幻的講法，
// 專案用的是「照明烈焰」「伊格尼斯之火」這種原書譯名）。
const spellEntry = INDEX.find((e) => e.id === 'spellbooks');
ok('B9 咒語名可搜（照明烈焰 命中核心法術書，且命中在 spell 欄位）',
  searchCodex(INDEX, '照明烈焰').some((r) => r.id === 'spellbooks')
  && spellEntry.fields.some((f) => f.field === 'spell' && f.text.includes('照明烈焰')));

eq('B10 查無時回空陣列，不是 undefined', searchCodex(INDEX, '這個字一定不存在'), []);
eq('B11 空字串回空陣列', searchCodex(INDEX, ''), []);
eq('B12 只有空白也回空陣列（不是把所有節都列出來）', searchCodex(INDEX, '   '), []);
eq('B13 null 不會炸', searchCodex(INDEX, null), []);
eq('B14 壞索引不會炸', searchCodex(null, '阿爾卡納'), []);
eq('B15 壞 codex 不會炸', buildCodexIndex(null), []);

/* ══════════════════════════════════════════════════════════════
   C. 片段與計數：使用者要靠它決定要不要點進去
   ══════════════════════════════════════════════════════════════ */
section('C. 片段');

ok('C1 片段包含查詢字本身', arcanaHits[0].snippet.includes('阿爾卡納'));
ok('C2 片段不是整段條文（> 120 字就是沒截）', arcanaHits[0].snippet.length <= 120);
ok('C3 命中在字串中間時，前面有省略號', searchCodex(INDEX, '詛咒')
  .some((r) => r.snippet.startsWith('…')));

const multi = searchCodex(INDEX, 'MP').filter((r) => r.count > 1);
ok('C4 多處命中時 count > 1（目錄上會寫「共 N 處」）', multi.length > 0);
eq('C5 count 不會超過該節的欄位數', INDEX.every((e) => {
  const hit = searchCodex(INDEX, 'MP').find((r) => r.id === e.id);
  return !hit || hit.count <= e.fields.length;
}), true);

// C6 系列：片段不得與標題重複。
// 實機截圖抓到過「徽記／標題 · 共 34 處／徽記」——第三行就是標題本身，
// 看起來像渲染壞掉。先留對照組（真的有節是標題命中），否則這條會恆真。
const titleHitRows = searchCodex(INDEX, '徽記').filter((r) => r.field === 'title');
ok('C6 對照組：搜「徽記」時真的有節是「標題」命中（否則下面那條問不到東西）',
  titleHitRows.length > 0);
eq('C7 標題命中時，片段不得等於標題',
  titleHitRows.every((r) => r.snippet !== r.title), true);
eq('C8 任何一節的片段都不得等於自己的標題',
  ['徽記', 'MP', '阿爾卡納', '詛咒'].every((t) =>
    searchCodex(INDEX, t).every((r) => r.snippet !== r.title)), true);
ok('C9 對照組：內文命中時片段仍然有內容（不是把片段一律清空）',
  searchCodex(INDEX, 'MP').some((r) => r.field !== 'title' && r.snippet.length > 0));

/* ══════════════════════════════════════════════════════════════
   D. 排序：標題命中優先，其餘照原書順序
   ══════════════════════════════════════════════════════════════ */
section('D. 排序');

const titleFirst = searchCodex(INDEX, '徽記');
eq('D1 搜「徽記」時標題命中的那一節排第一', titleFirst[0].title, '徽記');

const ordered = searchCodex(INDEX, 'MP');
const ranks = ordered.map((r) => (r.field === 'title' ? 0 : r.field === 'book' ? 2 : 1));
eq('D2 排序是單調的（標題 → 內文 → 原書，不會交錯）',
  ranks.every((v, i) => i === 0 || ranks[i - 1] <= v), true);
// 同 rank 之間必須維持原書順序（Array#sort 在現代 JS 是穩定的，但這條要釘住，
// 因為換成不穩定的排序時「順序跳來跳去」不會報錯，只會讓人找不到東西）。
const sameRank = ordered.filter((r) => r.field !== 'title' && r.field !== 'book');
const idOrder = IDS.filter((id) => sameRank.some((r) => r.id === id));
eq('D3 同 rank 的結果維持原書順序', sameRank.map((r) => r.id), idOrder);

/* ══════════════════════════════════════════════════════════════
   Z. 自檢：斷言器自己要先能分辨
   ══════════════════════════════════════════════════════════════ */
section('Z. 自檢');
// 這一條不能寫成「故意 FAIL」——那會讓整支測試永遠紅。
// 要驗的是**比對器分得出不同值**（否則上面每一條「回空陣列」都恆真）。
eq('Z1 比對器分得出 1 與 2', JSON.stringify(1) === JSON.stringify(2), false);
eq('Z2 比對器認得相同的陣列', JSON.stringify([1, 2]) === JSON.stringify([1, 2]), true);
ok('Z3 對照組本身不是空的（索引真的有 18 節）', INDEX.length === IDS.length && IDS.length > 0);

console.log(lines.join('\n'));
console.log(`\n  通過 ${pass} / ${pass + fail}${fail ? `　（失敗 ${fail}）` : '　（全部通過）'}`);
process.exit(fail ? 1 : 0);
