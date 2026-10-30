/**
 * 英雄技能「文字層」契約測試（F-031／F-032／F-033，2026-10-28）。
 *
 * 執行：npm run test:heroictext
 *
 * ## 這一組在守什麼
 *
 * P9 把 115 條英雄技能從頭讀過一遍，發現三件事——**都不是「功能壞了」，
 * 而是「讀的人會誤解或停下來」**：
 *
 * - **F-031**：`HR`／`物語點`／`IP`／`TP`／`（o）`／`10×T` 在 27 條效果裡出現，
 *   全站一個字都沒解釋。這一組守「該解釋的詞都進了術語表，而且畫面上真的掛得出來」。
 * - **F-032**：錯字 3、簡體字 2、`伙伴／夥伴` 混用。這一組守「一個都不准回來」。
 * - **F-033**：半角括號 15 條、半角逗號 3 條、六種「見…」寫法、`精通技能` 與介面的
 *   `英雄技能` 兩種叫法。這一組守「格式統一，而且不准再混進來」。
 *
 * ## 為什麼「掃描」而不是「逐條寫死字串」
 *
 * 115 條會改、會加。寫死「第 37 條的第 12 個字」這種斷言，改一次就失效一次。
 * 所以全部改成**掃描整個英雄技能表**，命中數必須為 0——新增的技能自動被涵蓋。
 *
 * ## 掃描範圍為什麼是 `rulesData.json` 的 `heroicSkills`，不含 Playtest
 *
 * `playtestHeroicSkills.js` 的 43 條是 S4 範圍，**還沒測過**，也還沒有人逐字校過。
 * 把它們一起掃進來會有兩種下場：要嘛現在就順手改（等於沒測就改，違反流程），
 * 要嘛把斷言寫成「只掃一部分」而看起來全綠。所以這一組**明講不含**，
 * 由 `check` 的標籤寫清楚——不要讓後人以為 115 條綠了就是全部綠了。
 */
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import { GLOSSARY, TERMS } from '../src/features/character-sheet/data/glossary.js';
import { SOURCEBOOKS } from '../src/features/character-sheet/data/sourcebookConfig.js';
import { renderTextWithTerms } from '../src/components/ui/termText.jsx';
import { HeroicSkillPickerBody, HEROIC_TERM_LIST } from '../src/features/character-sheet/components/HeroicSkillPickerModal.jsx';
import { createNewCharacter, calculateCharacterStats } from '../src/features/character-sheet/utils/characterEngine.js';
import { resolveCreationRules } from '../src/features/character-sheet/data/creationRules.js';

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

const HS = rulesData.heroicSkills;
/** 名稱／需求／效果三個欄位都要掃——潔淨月光的簡體字住在**名稱**裡，不在效果文裡。 */
const allText = (h) => `${h.name}\u0000${h.requirement}\u0000${h.effect}`;
const hitsOf = (re) => HS.filter((h) => re.test(allText(h))).map((h) => h.name);

// ─────────────────────────────────────────────────────────── A
section('A. 前提：表本身是完整的（不然下面每一條掃描都會「因為掃不到東西」而假綠）');

check('英雄技能恰好 115 條', HS.length, 115);
check('每一條都有 name／requirement／effect',
  HS.filter((h) => !h.name || !h.requirement || !h.effect).map((h) => h.name || '(無名)'), []);
check('技能名不重複', new Set(HS.map((h) => h.name)).size, HS.length);

// 掃描自己也要體檢（MEMORY 鐵則 7）：餵它壞字串必須叫、餵它正常字串必須不叫。
// 沒有這兩條的話，「命中數 = 0」有兩種意思——「資料乾淨」和「正則根本壞了」，分不出來。
const probe = (text) => [{ name: '探針', requirement: '', effect: text }]
  .filter((h) => /[()]/.test(allText(h))).map((h) => h.name);
check('掃描器體檢：餵它半角括號必須叫', probe('（o）(半角)'), ['探針']);
check('掃描器體檢：餵它全角括號必須不叫', probe('（o）（全角）'), []);

// ─────────────────────────────────────────────────────────── B
section('B. F-033：標點格式統一（半角括號／逗號／冒號一律全角）');

check('115 條不含半角括號 ()', hitsOf(/[()]/), []);
// 白名單是「ASCII 字元後面的半角逗號」：數學魔法的「DEX, INS, MIG, WLP」與「6, 8, 10, 12」
// 是英文列表，本來就該用半角。用 lookbehind 表達「中文後面的才算違規」，
// 而不是把整條數學魔法跳過——跳過去的話，它以後真的打錯字也不會有人知道。
check('115 條不含「中文後面的半角逗號／冒號／分號」', hitsOf(/(?<=[^\x00-\x7F])[,;:]/), []);
check('（反向）數學魔法的英文列表仍然是半角', rulesData.heroicSkills
  .find((h) => h.name === '數學魔法').effect.includes('（DEX, INS, MIG, WLP）'), true);
check('（反向）ASCII 後面的半角逗號不算違規', 'DEX, INS'.match(/(?<=[^\x00-\x7F])[,;:]/), null);

// ─────────────────────────────────────────────────────────── C
section('C. F-031：不該再出現的縮寫與圖示');

check('115 條不含「（o）」圖示（原書是「攻擊性咒語」的圖示，抄成純文字後變成一個字母）',
  hitsOf(/[（(]\s*[oO]\s*[）)]/), []);
check('115 條不含「10×T」（要寫成「10 × T」並註明 T＝目標數）', hitsOf(/\d+×T/), []);
check('吞噬魔法真的有那句「T＝目標數」',
  rulesData.heroicSkills.find((h) => h.name === '吞噬魔法').effect.includes('（T＝目標數）'), true);
check('115 條不含零寬字元（蠱惑之聲原本夾了兩個 U+200B）',
  hitsOf(/[\u200B-\u200D\uFEFF]/), []);

// ─────────────────────────────────────────────────────────── D
section('D. F-032：錯字與簡體字（一個都不准回來）');

// 寫成 \u 逃逸而不是直接打那個字：簡體字存檔時可能被編輯器「順手」轉成繁體，
// 那樣正則就永遠不會命中，而測試看起來是綠的（P9 踩過：潔淨月光的「净」就是這樣漏掉的）。
check('不含「位止」（應為「為止」）', hitsOf(/位止/), []);
check('不含「演湊」（應為「演奏」）', hitsOf(/演湊/), []);
check('不含「并且」（應為「並且」）', hitsOf(/并且/), []);
check('不含「聼」（應為「聽」）', hitsOf(/聼/), []);
check('不含「伙伴」（統一為「夥伴」）', hitsOf(/伙伴/), []);
check('不含簡體「净」（U+51C0）', hitsOf(/[\u51c0]/u), []);
check('不含簡體「并」（U+5E76）', hitsOf(/[\u5e76]/u), []);
check('（反向）「夥伴」還在，而且不只一條',
  HS.filter((h) => h.effect.includes('夥伴')).length >= 2, true);
check('（反向）潔淨月光用的是繁體「淨」', HS.some((h) => h.name === '潔淨月光'), true);
check('（反向）繁體「淨」沒有被掃描器誤判', '潔\u6DE8月光'.match(/[\u51c0]/u), null);

// ─────────────────────────────────────────────────────────── E
section('E. F-033：引用格式統一成「（見《書名》p.N）」');

const BOOK_NAMES = Object.values(SOURCEBOOKS).map((b) => b.name);
// 合格寫法：`見《書名》p.N`。**刻意不要求外面那一層括號**——【進階無拘形態】的引用
// 夾在一句更長的括號補充裡（「（例如因為…技能，見《高度奇幻手冊》p.154）」），
// 要求「整個括號裡只有引用」會把正確的寫法判成錯的。
// 這一組守的是**引用本身的格式**，不是括號的嵌套方式。
const ALLOWED_CITATION = /見《([^》]+)》p\.(\d+)/g;
// 裸頁碼（只有頁碼、沒有書名）。**這不是合格寫法**，只是拿來數量的。
const BARE_PAGE = /見 p\.(\d+)/g;

// 先把「合格的引用」整段拿掉，再看剩下的還有沒有「見 + 頁碼」。
// 這樣不用窮舉六種舊寫法，任何**新**的寫法也會被抓到。
// ※ 裸頁碼刻意**不**在 stripAllowed 裡：它不是合格寫法，要留下來讓 badCitation 抓到。
const stripAllowed = (t) => t.replace(ALLOWED_CITATION, '');
const badCitation = (t) => {
  const m = stripAllowed(t).match(/見[^。\n]{0,24}?p\.?\s?\d+|參閱[^。\n]{0,24}?\d+\s?頁/);
  return m ? m[0] : null;
};

check('115 條裡沒有「不合格的引用寫法」',
  HS.map((h) => badCitation(h.effect)).filter(Boolean), []);

const citedBooks = [...new Set(HS.flatMap((h) => [...h.effect.matchAll(ALLOWED_CITATION)].map((m) => m[1])))];
check('引用到的書名都是 sourcebookConfig 裡真的有的書（防打錯字）',
  citedBooks.filter((b) => !BOOK_NAMES.includes(b)), []);
check('至少引用了 2 本書（證明掃描真的掃到東西，不是因為一條都沒有而全綠）',
  citedBooks.length >= 2, true);

// 裸頁碼（只有頁碼、沒有書名）**必須是 0 處**。
//
// 這條原本是「恰好 2 處，都在破釜沉舟」——當時不知道那兩頁屬於哪本書，
// 站內線索互相矛盾（可變形武器在別處一律標「HF p.107」），所以刻意留白並釘住數量。
// **2026-10-28 GM 裁定「破釜沉舟是科技奇幻的」**，書名補上（《科技奇幻手冊》p.113／p.161），
// 於是這條改成 0。
//
// 為什麼不是「刪掉這條斷言就好」：它原本守的是「有人又寫了沒有書名的頁碼」。
// 刪掉的話，`badCitation` 雖然也會抓到（裸頁碼現在不在 stripAllowed 裡），
// 但那裡只會回報「有一條不合格」，看不出是「裸頁碼」這種特定情況。
// 兩條一起留著：一條負責「不准有」，一條負責「就算有也說得出是哪一條」。
const barePages = HS.flatMap((h) => [...h.effect.matchAll(BARE_PAGE)].map((m) => `${h.name}:${m[1]}`));
check('沒有裸頁碼（每一處引用都要寫書名）', barePages, []);
check('（反向）掃描器本身會叫：餵它「見 p.9」必須數到 1',
  [...'見 p.9'.matchAll(BARE_PAGE)].length, 1);

// 補了書名之後要順便釘住「補的是哪一本」，否則下次有人手滑改成別的書名也不會有人知道。
// 依據：該技能的 `source` 是 `technoFantasy`，且 GM 2026-10-28 明確裁定。
const pot = HS.find((h) => h.name === '破釜沉舟');
check('破釜沉舟的出處是科技奇幻', pot ? pot.source : null, 'technoFantasy');
// 這條技能一共三處引用：兩處指向自己那本書（p.113／p.161），一處指向核心規則書（雙重盾牌 p.197）。
// 三處都寫出來，而不是只挑前兩處——只挑前兩處的話，第三處被改成什麼書都不會紅。
check('破釜沉舟的三處引用書名',
  pot ? [...pot.effect.matchAll(ALLOWED_CITATION)].map((m) => m[1]) : [],
  ['科技奇幻手冊', '科技奇幻手冊', '核心規則書']);

// ─────────────────────────────────────────────────────────── F
section('F. F-033：同一個東西只有一個叫法');

check('115 條不含「精通技能」（介面與術語表一律叫「英雄技能」）', hitsOf(/精通技能/), []);
check('（反向）四條原本寫「精通技能」的技能，現在都寫「英雄技能」',
  ['重裝兵', '蜘蛛網', '主題曲', '三刀流'].filter(
    (n) => !HS.find((h) => h.name === n).effect.includes('英雄技能')), []);

// ─────────────────────────────────────────────────────────── G
section('G. F-031：四個新術語真的在表裡，而且畫面掛得出來');

check('術語表有 HR', TERMS.hr ? TERMS.hr.term : null, 'HR');
check('術語表有 物語點', TERMS.fabulaPoint ? TERMS.fabulaPoint.term : null, '物語點');
check('術語表有 IP', TERMS.ip ? TERMS.ip.term : null, 'IP');
check('術語表有 TP', TERMS.tradePoint ? TERMS.tradePoint.term : null, 'TP');
check('四條都有「一句話」（沒寫等於沒解釋）',
  [TERMS.hr, TERMS.fabulaPoint, TERMS.ip, TERMS.tradePoint].filter((e) => !e || !e.short).length, 0);
check('四條都不在 K2 的 12 條名單裡（是這一輪補的，不是本來就有）',
  ['hr', 'fabulaPoint', 'ip', 'tradePoint'].filter((id) => GLOSSARY.findIndex((e) => e.id === id) < 12), []);
// 挑選器到底標哪四個，是它自己的一份清單。清單漏一個，畫面上就少一個 tooltip，
// 而下面那些「每一格含 HR 的都掛了說明」完全不會知道——所以這裡直接點名。
check('挑選器的術語清單就是這四個（順序也固定，改動要顯眼）',
  HEROIC_TERM_LIST.map((e) => e.id), ['hr', 'fabulaPoint', 'ip', 'tradePoint']);

// 真的畫一次。`includes('renderTextWithTerms')` 只證明有人寫過那一行，
// 證明不了畫得出來——這是 F-016 的教訓（護欄掃到字串、破壞成 false 之後仍然全綠）。
const html = renderToStaticMarkup(
  React.createElement('div', null, renderTextWithTerms('將你的 HR 視為 0', [TERMS.hr]))
);
check('renderTextWithTerms 真的包出 term-hint-hr', html.includes('data-testid="term-hint-hr"'), true);
check('說明寫在 aria-label 裡（讀屏聽得到、SSR 也驗得到）',
  html.includes(`aria-label="HR：${TERMS.hr.short}"`), true);
check('原本的字沒有被吃掉', html.includes('將你的') && html.includes('視為 0'), true);

// 只標第一次：同一段出現兩次 HR，只長出一個按鈕。
// 為什麼：一句話裡三個 HR 就長三個按鈕，鍵盤使用者要 Tab 三次才過得去一句話。
const twice = renderToStaticMarkup(
  React.createElement('div', null, renderTextWithTerms('HR 與 HR', [TERMS.hr]))
);
check('同一個術語只標第一次', (twice.match(/term-hint-hr/g) || []).length, 1);

// ASCII 術語要檢查單字邊界：HRX 不是 HR。
check('ASCII 術語有單字邊界（HRX 不會被標成 HR）',
  renderToStaticMarkup(React.createElement('div', null, renderTextWithTerms('HRX', [TERMS.hr])))
    .includes('term-hint-hr'), false);
// 中文術語不需要邊界（中文沒有空格可以判斷），但不能因此把「物語點數」切壞。
check('中文術語照樣命中',
  renderToStaticMarkup(React.createElement('div', null, renderTextWithTerms('花 1 點物語點', [TERMS.fabulaPoint])))
    .includes('term-hint-fabulaPoint'), true);
check('沒有術語的句子原樣回傳（不包一層 span 進去）',
  renderTextWithTerms('純文字一句', [TERMS.hr]), '純文字一句');
check('空字串不會爆', renderTextWithTerms('', [TERMS.hr]), '');
check('null 不會爆', renderTextWithTerms(null, [TERMS.hr]), '');

// 四個術語在**真實的技能文本**上都要標得出來（不是用手寫的樣本句子）。
// 做法：從 115 條裡各挑一條含該詞的，原封不動丟進函式。
// 找不到任何一條含該詞 → 紅燈。那代表「這個術語根本沒被用到」，
// 而沒被用到的術語留在表裡只會讓人以為有覆蓋。
const firstWith = (needle) => HS.find((h) => h.effect.includes(needle));
const tagsIn = (text) => [...new Set(
  (renderToStaticMarkup(React.createElement('div', null, renderTextWithTerms(text, HEROIC_TERM_LIST)))
    .match(/term-hint-[a-zA-Z]+/g) || [])
)];
for (const [needle, id] of [['HR', 'hr'], ['物語點', 'fabulaPoint'], ['IP', 'ip'], ['TP', 'tradePoint']]) {
  const skill = firstWith(needle);
  check(`真實技能文本裡的「${needle}」標得出來（用的是${skill ? skill.name : '（找不到）'}）`,
    skill ? tagsIn(skill.effect).includes(`term-hint-${id}`) : false, true);
}

// ─────────────────────────────────────────────────────────── H
section('H. F-031：挑選器的效果欄真的掛了術語（不是只有資料層改了）');

// 這一段用真的彈窗本體畫一次：dump 只證明資料改了，
// 只有 SSR 才知道「那一格到底有沒有長出按鈕」。
const pickerChar = createNewCharacter({
  name: '術語測試',
  startingFundsRolled: true,
  classes: [{ className: '武器大師', level: 10, skills: [] }]
});
const pickerHtml = renderToStaticMarkup(React.createElement(HeroicSkillPickerBody, {
  character: pickerChar,
  rules: resolveCreationRules({}),
  stats: calculateCharacterStats(pickerChar),
  theme: {},
  onPick: () => {}
}));

/** 取出某一條技能的效果格（`<td data-testid="heroic-effect-名字">…</td>`）。 */
const effectCell = (name) => {
  const start = pickerHtml.indexOf(`data-testid="heroic-effect-${name}"`);
  if (start < 0) return '';
  return pickerHtml.slice(start, pickerHtml.indexOf('</td>', start));
};

check('挑選器畫得出技能列（不然下面每一條都會「因為找不到格子」而假綠）',
  (pickerHtml.match(/heroic-effect-/g) || []).length >= 10, true);
// 斷言寫成「每一格含 HR 的都必須掛說明」，而不是「瞬息之間那一格有掛」——
// 前者在新增 HR 技能時自動涵蓋，後者只守一條。
const hrCells = [...pickerHtml.matchAll(/data-testid="heroic-effect-([^"]+)"/g)]
  .map((m) => m[1])
  .filter((n) => /HR/.test(effectCell(n)));
check('至少有一格效果文含 HR（證明這條驗證真的在驗東西）', hrCells.length >= 1, true);
check('每一格含 HR 的都掛了說明', hrCells.filter((n) => !effectCell(n).includes('term-hint-hr')), []);
check('瞬息之間那一格真的掛了 HR 說明', effectCell('瞬息之間').includes('term-hint-hr'), true);

// 物語點／IP／TP 在「這個角色的預設視圖」裡看不到（篩選器只留 18 格，剛好都是 HR），
// 所以畫面層只驗得到 HR；另外三個由上面「真實技能文本」那一組守。
// 這裡刻意**不寫**一條「假裝也驗了」的斷言——恆真的綠燈比沒有更糟。

// ─────────────────────────────────────────────────────────── G
// 2026-10-29：金手指的引用斷鏈。
//
// 神秘魔法書寫著「彗星、額外咒語、希望和火山」；同一個毛病也發生在「植物人」身上：
// 清單裡那條叫【草木成精】（NF p.121 ARBOREAL）。
//
// 2026-10-30 更正：VOLCANO 的定名是【火山】，不是【超魔法】——超魔法是公測版的名字，
// 正式版把「可改名／改屬性」寫成咒語本身的可選條款，因此恢復原定名（§BA）。
//
// 為什麼要釘住「這四條」而不是掃全表：金手指正文是自由散文，沒有可靠的語法能抽出
// 「它引用了哪一條技能」。硬掃會掃出一堆「希望」「火山」這種日常詞。所以退一步——
// 至少讓**已知會斷鏈的那一條**永遠有人守著，改壞了會紅。
section('I. 跨表引用：神秘魔法書點名的英雄技能與金手指都查得到');

const quirkByName = (n) => rulesData.quirks.find((q) => q.name === n);
const grim = quirkByName('神秘魔法書');
const HS_NAMES = new Set(HS.map((h) => h.name));
const QUIRK_NAMES = new Set(rulesData.quirks.map((q) => q.name));

check('神秘魔法書還在（不然下面三條都會「因為掃不到東西」而假綠）', Boolean(grim), true);
check('引用的四條英雄技能都在表裡',
  ['彗星', '額外咒語', '希望', '火山'].filter((n) => !HS_NAMES.has(n)), []);
check('引用的四條金手指都在表裡',
  ['草木成精', '機器人', '會說話的野獸', '大夢一場'].filter((n) => !QUIRK_NAMES.has(n)), []);
check('神秘魔法書引用的是【火山】（正式版定名）', /火山/.test(grim.desc || ''), true);
check('不再出現公測舊名「超魔法」', /超魔法/.test(grim.desc || ''), false);
check('不再出現舊譯「植物人」（App 定名【草木成精】）', /植物人/.test(grim.desc || ''), false);

// ─────────────────────────────────────────────────────────── H
// 2026-10-29：金手指的「中文＋英文原詞」黏連（危險danger、彗星Comet、戒律commandments…）。
// 那是漢化留下的註記，不是規則內容；留著會讓搜尋與閱讀都變糟。
// 白名單是**遊戲縮寫與骰子記法**，不是「懶得清」的藉口——名單只有下面這些。
section('J. 金手指文字不再夾英文原詞（縮寫與骰子記法除外）');

const LATIN_OK = new Set([
  'HP', 'MP', 'IP', 'XP', 'NPC', 'GM', 'TA', 'PC', 'HR', 'SL',
  'MIG', 'WLP', 'INS', 'DEX', 'PUL', 'D', 'd', 'z',
  'Aaron Callisto', 'Natalia Caiden' // 書中示例 NPC 姓名，無官方中文
]);
const glued = [];
for (const q of rulesData.quirks) {
  for (const field of ['desc', 'flavor']) {
    const text = q[field] || '';
    const re = /[\u4e00-\u9fff][A-Za-z][A-Za-z' ]*/g;
    let m;
    while ((m = re.exec(text))) {
      const word = m[0].slice(1).trim();
      if (!LATIN_OK.has(word)) glued.push(`${q.name}/${field} :: ${m[0]}`);
    }
  }
}
check('46 條金手指零命中', glued, []);
check('（自檢）這條掃描真的掃得到東西：故意丟一個黏連進去會被抓到',
  (() => {
    const re = /[\u4e00-\u9fff][A-Za-z][A-Za-z' ]*/g;
    return re.test('危險danger或發現');
  })(), true);

// ─────────────────────────────────────────────────────────── K
// 2026-10-30：金手指【棄暗投明之人】的示例反派領袖，正式版英文（TF p.126
// `REPENTANT ENFORCER`：`led by Aaron Callisto`）作 Callisto；
// 公測中文翻譯寫的是 Felgrance。規則與專名以英文版為準（見 decisions §BB）。
section('K. 棄暗投明之人的示例 NPC 用正式版英文名');
const repentant = rulesData.quirks.find((q) => q.name === '棄暗投明之人');
const repentantText = (repentant && repentant.desc) || '';
check('棄暗投明之人還在（不然下面幾條會假綠）', Boolean(repentant), true);
check('示例領袖作 Aaron Callisto', /Aaron Callisto/.test(repentantText), true);
check('不再出現公測舊名 Aaron Felgrance', /Felgrance/.test(repentantText), false);
check('句讀已清：沒有半形逗號「投降,」', /投降,/.test(repentantText), false);
check('句讀已清：沒有半形句點「物語點）.」', /物語點\)\./.test(repentantText), false);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
