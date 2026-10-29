/**
 * 公測英雄技能「效果全文」契約測試（F-045～F-052，2026-10-29，P35）。
 *
 * 執行：npm run test:heroiceffect
 *
 * ## 這一組在守什麼
 *
 * 前提（條件欄）在 P31／P32／P33 已經量過三輪，但**效果全文從來沒有人讀過**。
 * P35 把 43 條公測 ＋ 9 條變體（共 52 條）逐條跟英文原文對過，抓到 8 個問題。
 * 這一組把「抓到的東西不會回來」變成機器可驗的條件。
 *
 * ## 為什麼可以機器驗——而不是「我讀過覺得沒問題」
 *
 * 因為**英文原文可以存成檔案**。`tests/fixtures/playtest-en-source.json` 是
 * Playtest Materials ENG 2026-10-01（p.4–21）的英文快照，43 條都在裡面。
 * 有了它，「中文這條到底有沒有少講一段」就變成可計算的問題：
 *
 * - **數字對位**：中文效果文裡的數字集合，必須等於英文本文的數字集合。
 *   這條抓到【收割行者】（少了 +5、+5、10）、【日月輪轉】（少了 5、5、20、20）、
 *   【吸血亢奮】（中文有 2、5，英文有 10、153、155）、【多變戰術】（中文有 2、2、2，英文有 0、20）。
 * - **長度比例**：中文字數 ÷（英文字元 × 0.42）必須落在 0.55～1.10。
 *   0.42 是這批 43 條實測出來的中英密度比；修完之後實際範圍是 **0.65～0.93**，
 *   上下都留了餘裕。這條抓到【收割行者】（0.20）、【日月輪轉】（0.25）、
 *   【光之言語】（0.46）、【滿口髒話】（0.47）、【多變戰術】（0.51）。
 * - **概念對位**：英文提到「抗性／危機／自由攻擊／咒語動作／命中檢定」等 27 個規則概念，
 *   中文必須有對應詞。這條抓到【光之言語】（英文有抗性、無視、盟友，中文一個都沒有）。
 *
 * 三層互補：數字抓「有數字的漏譯」，長度抓「整段不見」，概念抓「用詞跑掉」。
 * **吸血亢奮的長度是 0.67（在範圍內），只有數字那一層抓得到**——這就是為什麼要三層。
 *
 * ## 這一組自己也踩過的坑（留著當警告）
 *
 * 1. 第一輪用的英文區塊檔（`en_blocks.json`）邊界有問題：標題換行（FŪMA SHURIKEN）、
 *    頁碼殘留的 `W`、`W W CATEGORY TRAINING` 黏在前一條尾巴上，導致區塊吞掉下一條。
 *    結果 44 條裡有 41 條被標成「不符」——**大部分是假警報**。
 *    重切之後（以完整標題定位、取最後一次出現，因為第一次是目錄）才剩下 7 條，而那 7 條才是真的。
 *    → 教訓：**比對結果大規模變紅時，先懷疑切法，不要先懷疑資料。**
 * 2. 有了正確的英文之後，仍然有兩條是假警報：【激勵人心】的「兩到三次」與
 *    【陷阱大師】的「冰／中毒」在舊的截斷區塊裡看不到，看起來像中文亂加。
 *    完整區塊一讀，**中英文完全對得上**。→ 教訓：**「中文多寫了」要先確認「英文是不是被切掉了」。**
 * 3. 數字比對原本把「條件」那一段也算進去，於是【躍空】的頁碼 `page 189` 與
 *    【漣漪祈喚】的 `Skill Level 2` 變成假警報。條件段的中文刻意不寫頁碼與技能等級（P34 定案），
 *    所以**只比效果本文**。
 */
import fs from 'node:fs';
import { PLAYTEST_HEROIC_SKILLS } from '../src/features/character-sheet/data/playtestHeroicSkills.js';
import { VARIANT_ARCANIST_HEROIC_SKILLS } from '../src/features/character-sheet/data/variantArcanistHeroicSkills.js';
import { MUTANT_THERIOFORMS } from '../src/features/character-sheet/data/skillSuboptionsData.js';
import { SOURCEBOOKS } from '../src/features/character-sheet/data/sourcebookConfig.js';
import enSource from './fixtures/playtest-en-source.json';

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

const ALL = [...PLAYTEST_HEROIC_SKILLS, ...VARIANT_ARCANIST_HEROIC_SKILLS];
const BOOK_NAMES = Object.values(SOURCEBOOKS).map((b) => b.name);
const EN = enSource.blocks;
/** 名稱／需求／效果三個欄位都要掃（同 `heroicText.test.mjs` 的理由：缺陷不一定住在效果文裡）。 */
const allText = (h) => `${h.name}\u0000${h.requirement}\u0000${h.effect}`;
const hitsOf = (pool, re) => pool.filter((h) => re.test(allText(h))).map((h) => h.name);

// ── 可被單獨餵資料的比對函式（自檢要用） ──────────────────────────
const numsOf = (s) => (String(s).match(/\d+/g) || []).map(Number).sort((a, b) => a - b);
const numbersMatch = (zhText, enBody) =>
  JSON.stringify(numsOf(zhText)) === JSON.stringify(numsOf(enBody));

const RATIO_BASE = 0.42;
const RATIO_LO = 0.55;
const RATIO_HI = 1.1;
const lengthOk = (zhText, enBody) => {
  const expected = Math.round(String(enBody).length * RATIO_BASE);
  const ratio = zhText.length / Math.max(1, expected);
  return ratio >= RATIO_LO && ratio <= RATIO_HI;
};

// 英文一個概念 → 中文可接受的任一寫法。**寧可漏抓，不要誤報**：
// 誤報會讓人開始懷疑護欄，然後把它關掉。
const CONCEPTS = [
  { id: '抗性', en: /Resistance/i, zh: /抗性/ },
  { id: '免疫', en: /immun/i, zh: /免疫/ },
  { id: '危機', en: /\bCrisis\b/i, zh: /危機/ },
  { id: '自由攻擊', en: /free attack/i, zh: /自由攻擊/ },
  { id: '命刻', en: /\bClock\b/i, zh: /命刻/ },
  { id: '庫存點', en: /Inventory Point/i, zh: /庫存點/ },
  { id: 'MP', en: /Mind Point|\bMP\b/i, zh: /MP/ },
  { id: 'HP', en: /Hit Point|\bHP\b/i, zh: /HP/ },
  { id: '額外傷害', en: /extra damage|additional damage/i, zh: /額外造成|額外傷害|額外的傷害|額外受到/ },
  { id: '防禦動作', en: /Guard action|perform the Guard/i, zh: /防禦動作/ },
  { id: '咒語動作', en: /Spell action/i, zh: /咒語動作/ },
  { id: '回合', en: /\bturn\b(?! back)/i, zh: /回合/ },
  { id: '休息', en: /\brest\b/i, zh: /休息/ },
  { id: '造物計畫', en: /Project/i, zh: /造物計畫|計畫/ },
  { id: '無視', en: /ignor(?:e|es|ed|ing)/i, zh: /無視|忽略/ },
  { id: '狀態效果', en: /status effect/i, zh: /狀態效果/ },
  { id: '命中檢定', en: /Accuracy Check/i, zh: /命中檢定/ },
  { id: '魔法檢定', en: /Magic Check/i, zh: /魔法檢定/ },
  { id: '多重', en: /multi \(\d\)/i, zh: /多重/ },
  { id: '穿透', en: /pierc/i, zh: /穿透/ },
  { id: '盟友', en: /\bally\b|allies/i, zh: /盟友/ },
  { id: '敵人', en: /\benem/i, zh: /敵人/ },
  { id: '生物', en: /\bcreature/i, zh: /生物/ },
  { id: '傷害屬性', en: /Affinit/i, zh: /傷害屬性/ },
  { id: '特質', en: /Traits?\b/i, zh: /特質/ },
  { id: '物防', en: /Defense/i, zh: /物防|防禦值/ },
  { id: '魔防', en: /Magic Defense/i, zh: /魔防/ }
];
const conceptGaps = (zhText, enBody) => {
  const missing = CONCEPTS.filter((c) => c.en.test(enBody) && !c.zh.test(zhText)).map((c) => c.id);
  const extra = CONCEPTS.filter((c) => !c.en.test(enBody) && c.zh.test(zhText)).map((c) => c.id);
  return { missing, extra };
};

// 【穩固突變】的形態名：專案真正在用的是 MUTANT_THERIOFORMS，不是另創一套。
const FORM_NAMES = ['兩棲形態', '放電形態', '疊甲形態', '噴射形態', '爆燃形態', '毒物形態'];
// 2026-10-29 之前【穩固突變】自己另創的名字。一個都不准回來。
const FORM_NAMES_OLD = ['兩棲型', '節肢型', '動力獸型', '電鱗型', '板足型', '氣囊型', '多足型', '焰羽型', '迅捷獸型', '毒棘型'];
const oldFormNamesIn = (text) => FORM_NAMES_OLD.filter((n) => text.includes(n));

// ─────────────────────────────────────────────────────────── A
section('A. 前提：表與樣本本身是完整的（不然下面每一條都會「因為掃不到東西」而假綠）');

check('公測英雄技能恰好 43 條', PLAYTEST_HEROIC_SKILLS.length, 43);
check('變體秘儀師英雄技能恰好 9 條', VARIANT_ARCANIST_HEROIC_SKILLS.length, 9);
check('52 條都有 name／requirement／effect',
  ALL.filter((h) => !h.name || !h.requirement || !h.effect).map((h) => h.name || '(無名)'), []);
check('52 條技能名不重複', new Set(ALL.map((h) => h.name)).size, ALL.length);
check('英文樣本恰好 43 條', Object.keys(EN).length, 43);
check('英文樣本的標題不重複',
  new Set(Object.values(EN).map((b) => b.head)).size, Object.keys(EN).length);

// ─────────────────────────────────────────────────────────── B
section('B. 配對：中文 43 條 ↔ 英文 43 條，一一對得上');

// 配錯的話，下面每一個「相符」都是假的。所以配對本身也要驗。
const zhNames = PLAYTEST_HEROIC_SKILLS.map((h) => h.name);
check('每一條公測技能都有英文樣本', zhNames.filter((n) => !EN[n]), []);
check('英文樣本沒有多出來的（除了 43 條以外一個都沒有）',
  Object.keys(EN).filter((n) => !zhNames.includes(n)), []);
check('每一條的英文標題都非空', Object.entries(EN).filter(([, b]) => !b.head || !b.body).map(([n]) => n), []);

// ─────────────────────────────────────────────────────────── C
section('C. F-045／F-046：中文效果文的「數字」必須與英文本文一致（逐條）');

const numberOffenders = [];
for (const h of PLAYTEST_HEROIC_SKILLS) {
  const body = EN[h.name].body;
  const ok = numbersMatch(h.effect, body);
  if (!ok) numberOffenders.push({ 技能: h.name, 中文數字: numsOf(h.effect), 英文數字: numsOf(body) });
  check(`數字對位：${h.name}`, ok, true);
}

// ─────────────────────────────────────────────────────────── D
section('D. F-045：中文效果文的「長度」必須與英文本文成比例（逐條）');

// 0.42＝中英密度比；0.55～1.10＝實測範圍 0.65～0.93 上下各留餘裕。
// 太短＝整段不見（收割行者 0.20、日月輪轉 0.25）；太長＝自己加了東西。
const lengthOffenders = [];
for (const h of PLAYTEST_HEROIC_SKILLS) {
  const body = EN[h.name].body;
  const ok = lengthOk(h.effect, body);
  if (!ok) {
    lengthOffenders.push({
      技能: h.name,
      比例: Number((h.effect.length / Math.round(body.length * RATIO_BASE)).toFixed(2))
    });
  }
  check(`長度比例：${h.name}`, ok, true);
}

// ─────────────────────────────────────────────────────────── E
section('E. F-045：英文提到的規則概念，中文必須有對應詞');

const conceptOffenders = [];
for (const h of PLAYTEST_HEROIC_SKILLS) {
  const gaps = conceptGaps(h.effect, EN[h.name].body);
  if (gaps.missing.length || gaps.extra.length) conceptOffenders.push({ 技能: h.name, ...gaps });
}
check('43 條的概念對位全部一致', conceptOffenders, []);

// ─────────────────────────────────────────────────────────── F
section('F. F-048：【穩固突變】的形態名必須是專案在用的那 12 個');

const steady = PLAYTEST_HEROIC_SKILLS.find((h) => h.name === '穩固突變');
check('找得到【穩固突變】', Boolean(steady), true);
// 逐一點名：只驗「總數」的話，有人刪一個、加一個錯的，數字還是一樣。
for (const form of FORM_NAMES) {
  check(`【穩固突變】用「${form}」`, steady.effect.includes(form), true);
}
check('【穩固突變】不含任何自創的舊形態名', oldFormNamesIn(steady.effect), []);
// 這 6 個必須真的存在於專案的形態表，否則上面的斷言是在守一個不存在的名字。
check('這 6 個名字都在 MUTANT_THERIOFORMS 裡',
  FORM_NAMES.filter((f) => !MUTANT_THERIOFORMS.some((t) => t.name === f)), []);
check('專案的形態表恰好 12 個', MUTANT_THERIOFORMS.length, 12);

// ─────────────────────────────────────────────────────────── G
section('G. F-047：【疊句】用的是「曲風」的名字，不是「音調」的名字');

const refrain = PLAYTEST_HEROIC_SKILLS.find((h) => h.name === '疊句');
check('找得到【疊句】', Boolean(refrain), true);
// 英文 energetic / lively / solemn verse → 曲風的 激情／生動／莊嚴
check('【疊句】三個曲風都點名了',
  ['激情', '生動', '莊嚴'].filter((t) => !refrain.effect.includes(t)), []);
// 熾熱／疾風／堅石 是**音調**（key），不是曲風（tone）。寫錯會讓玩家去翻錯那張表。
check('【疊句】不含任何音調名（熾熱／疾風／堅石）',
  ['熾熱', '疾風', '堅石'].filter((k) => refrain.effect.includes(k)), []);
check('【疊句】用「樂句」（不是「詩節」）', refrain.effect.includes('樂句'), true);

// ─────────────────────────────────────────────────────────── H
section('H. F-047／F-049／F-050／F-051：全批 52 條的格式與術語');

check('52 條不含「詩節」（verse 統一叫「樂句」）', hitsOf(ALL, /詩節/), []);
check('52 條不含「機械框架」（載具框架叫「機甲框架」）', hitsOf(ALL, /機械框架/), []);
check('52 條的「生命轉移」不是「技能」（它是靈能者的心靈天賦）',
  hitsOf(ALL, /生命轉移】技能/), []);
check('52 條不含「中文後面接半角空白再接中文」', hitsOf(ALL, /[\u4e00-\u9fff] [\u4e00-\u9fff]/), []);
// 核心 115 條一個（O）都沒有——那是原書「攻擊性咒語」的圖示，抄成純文字後變成一個字母。
check('52 條不含「（O）」圖示（核心 115 條也沒有）',
  hitsOf(ALL, /[（(]\s*[oO]\s*[）)]/), []);
check('52 條不含半角括號', hitsOf(ALL, /[()]/), []);
check('52 條不含零寬字元', hitsOf(ALL, /[\u200B-\u200D\uFEFF]/), []);

// 頁碼引用：核心 115 條**一處**「第 N 頁」都沒有，全部是「見《書名》p.N」。
// 這 43 條原本全部寫成「（《書名》第 155 頁）」，同一件事兩種寫法（跟 F-044 同一個病）。
check('52 條不含「第 N 頁」（引用一律寫成「見《書名》p.N」）',
  hitsOf(ALL, /《[^》]+》第\s*\d+\s*頁/), []);
const citedBooks = [...new Set(
  ALL.flatMap((h) => [...h.effect.matchAll(/見《([^》]+)》p\.\d+/g)].map((m) => m[1]))
)];
check('引用到的書名都是 sourcebookConfig 裡真的有的書（防打錯字）',
  citedBooks.filter((b) => !BOOK_NAMES.includes(b)), []);
check('至少引用了 2 本書（證明掃描真的掃到東西，不是因為一條都沒有而全綠）',
  citedBooks.length >= 2, true);

// ─────────────────────────────────────────────────────────── I
section('I. F-052：檔頭不准再有被誤寫進去的程式碼殘骸');

const playtestSrc = fs.readFileSync(
  new URL('../src/features/character-sheet/data/playtestHeroicSkills.js', import.meta.url),
  'utf8'
);
// 2026-10-13 那一次（commit 2cf1266）宣稱「6 筆改寫」，實際上把新文字接進了檔頭註解，
// 一條 effect 都沒動到，還吃掉了 4 行文件。這條守「那種東西不准再出現」。
check('檔頭不含 `#eff` 殘骸', playtestSrc.includes('#eff'), false);
check('檔頭的「為什麼獨立成一個檔」那一段還在', playtestSrc.includes('## 為什麼獨立成一個檔'), true);
// 上一版的斷言寫成「檔頭不含『當你在衝突中使一個或多個盟友恢復 HP 時』」——那是**錯的**：
// 那句話現在是【光之言語】的正式效果文，本來就會出現在檔案裡，於是斷言永遠紅（鐵則 25：
// 正向斷言分辨不出「有查」和「沒查」，這裡則是分辨不出「殘骸」和「正文」）。
// 改成抓真正的特徵：**檔頭那一段註解裡不該出現任何程式碼語法**。
const headerOf = (src) => src.slice(0, src.indexOf('export const PLAYTEST_SOURCE'));
const headerHasCode = (src) => /(^|\n)\s*\*\s*\S*(effect|name|requirement)\s*:/.test(headerOf(src));
check('檔頭的註解裡不含 effect:／name:／requirement: 之類的程式碼',
  headerHasCode(playtestSrc), false);

// ─────────────────────────────────────────────────────────── J
section('J. 掃描器體檢：餵它壞的必須叫、餵它好的必須安靜（成對）');

check('（數字）兩邊一致必須說對', numbersMatch('造成 5 點傷害', 'deal 5 damage'), true);
check('（數字）兩邊不一致必須說錯', numbersMatch('造成 5 點傷害', 'deal 10 damage'), false);
check('（數字）中文多了數字也要說錯', numbersMatch('造成 5 點與 7 點傷害', 'deal 5 damage'), false);
check('（長度）整段砍掉必須說錯', lengthOk('短', 'x'.repeat(200)), false);
check('（長度）正常比例必須說對', lengthOk('中'.repeat(67), 'x'.repeat(200)), true);
check('（長度）灌水兩倍也要說錯', lengthOk('中'.repeat(300), 'x'.repeat(200)), false);
check('（概念）英文有抗性、中文沒有 → 必須抓出來',
  conceptGaps('你造成傷害', 'you gain Resistance to fire').missing, ['抗性']);
check('（概念）兩邊都有抗性 → 必須安靜',
  conceptGaps('你獲得火抗性', 'you gain Resistance to fire').missing, []);
check('（形態名）餵它舊名字必須叫', oldFormNamesIn('兩棲型、毒棘型'), ['兩棲型', '毒棘型']);
check('（形態名）餵它正規名字必須安靜', oldFormNamesIn('兩棲形態、毒物形態'), []);
check('（檔頭）餵它一段帶 effect: 的註解必須叫',
  headerHasCode('/**\n * #effeffect: \'壞掉了\'\n */\nexport const PLAYTEST_SOURCE = 1;'), true);
check('（檔頭）餵它乾淨的註解必須安靜',
  headerHasCode('/**\n * 說明文字\n */\nexport const PLAYTEST_SOURCE = 1;'), false);
const barePageIn = (t) => /《[^》]+》第\s*\d+\s*頁/.test(t);
check('（引用）餵它「（《核心規則書》第 130 頁）」必須叫', barePageIn('（《核心規則書》第 130 頁）'), true);
check('（引用）餵它「（見《核心規則書》p.130）」必須安靜', barePageIn('（見《核心規則書》p.130）'), false);

// ─────────────────────────────────────────────────────────── 總計
lines.push('');
lines.push(`通過 ${pass} / ${pass + fail}${fail ? `，失敗 ${fail}` : ''}`);
if (numberOffenders.length || lengthOffenders.length) {
  lines.push('');
  lines.push('※ 有疑慮的條目（修法：對照 tests/fixtures/playtest-en-source.json 的英文本文重譯）：');
  for (const o of [...numberOffenders, ...lengthOffenders]) lines.push(`   ${JSON.stringify(o)}`);
}
console.log(lines.join('\n'));
if (fail > 0) process.exitCode = 1;
