/**
 * 英雄技能「額外前提」契約測試（F-030 ＋ P31，2026-10-28）。
 *
 * 執行：npm run test:heroicconfirm
 *
 * ## 這一組在守什麼
 *
 * 34 條英雄技能的前提寫成「武器大師，**且**習得招架反擊技能」。前半段（職業、等級）
 * 引擎一直都算得出來；後半段原本刻意不解析（怕猜錯擋掉合法角色），改成叫玩家自己勾。
 *
 * **P31 量過之後改變了做法**：34 條裡有 28 條的後半段就是一個或多個真實存在的技能名，
 * 而角色卡本來就存著 `classes[].skills = [{name, sl}]`。所以現在：
 *
 * - **認得出來 → 直接判**，判不過就寫「需先學會【招架反擊】」，玩家知道缺什麼；
 * - **認不出來 → 交回玩家**（勾「我符合這個前提」），不假裝知道。
 *
 * 這一組守四件事：
 *   1. `heroicSkillExtraPrerequisite()` 抓到的正好是那 34 條；
 *   2. `resolveHeroicExtraRequirement()` 的分類**逐條釘住**：28 條可自動判、6 條交回玩家。
 *      分類一變就紅——因為那代表條件文字或名冊變了，要回來重新確認；
 *   3. 判定本身：有學／沒學／「或」／「和」／技能等級／沒給「學過什麼」六種情況；
 *   4. 畫面：判得出來的列**不該**再問玩家，判不出來的列**才**問。
 *
 * ## 為什麼第 2 點要逐條釘住而不是只驗數量
 *
 * 只驗「28 條」的話，A 條變成不可判、B 條變成可判，數量還是 28，測試全綠。
 * 所以那 6 條**點名列出**，並且另外抽驗幾條的 `needs`／`mode` 內容。
 *
 * ## 這一組驗不到什麼（寫出來，不要用假斷言蓋掉）
 *
 * 「勾了之後按鈕會變成可按」需要真的點一下，SSR 做不到（專案沒有 jsdom）。
 * 那一段由實機腳本 `scratch/p31-ui.mjs` 驗。**這裡只驗初始狀態。**
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  checkHeroicSkillRequirement,
  createNewCharacter,
  calculateCharacterStats,
  HEROIC_SKILLS,
  heroicSkillExtraPrerequisite,
  resolveHeroicExtraRequirement,
  countOffensiveSpells
} from '../src/features/character-sheet/utils/characterEngine.js';
import { resolveCreationRules } from '../src/features/character-sheet/data/creationRules.js';
import { HeroicSkillPickerBody } from '../src/features/character-sheet/components/HeroicSkillPickerModal.jsx';

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
const byName = (n) => HS.find((h) => h.name === n);
const extraOf = (n) => {
  const h = byName(n);
  return h ? heroicSkillExtraPrerequisite(h) : '(找不到這條技能)';
};
const resolveOf = (n) => resolveHeroicExtraRequirement(byName(n));

// 「畫面上真正會出現的那一份」——`HEROIC_SKILLS`（含 Playtest／變體），不是 115 條基本款。
const byNameFull = (n) => HEROIC_SKILLS.find((h) => h.name === n);
const resolveOfFull = (n) => resolveHeroicExtraRequirement(byNameFull(n));
const fullManual = HEROIC_SKILLS
  .map((h) => ({ h, r: resolveHeroicExtraRequirement(h) }))
  .filter((x) => x.r.hasExtra && !x.r.checkable)
  .map((x) => x.h);

// ─────────────────────────────────────────────────────────── A
section('A. 前提：表本身是完整的（不然下面每一條都會「因為掃不到東西」而假綠）');

check('英雄技能恰好 115 條', HS.length, 115);
check('每一條都有 requirement', HS.filter((h) => !h.requirement).map((h) => h.name), []);
check('職業技能名冊非空（自動判定靠它，空的話全部都會變成「不可判」而看起來正常）',
  Object.values(rulesData.classes).reduce((n, c) => n + (c.skills || []).length, 0), 145);
check('咒語名冊非空', rulesData.spells.length, 38);

// ─────────────────────────────────────────────────────────── B
section('B. `heroicSkillExtraPrerequisite()`：抓到的正好是「職業與等級之外的那一段」');

// ※ 2026-10-29（P34）條件欄統一寫法之後，這幾條的期望值跟著改：
//   連接詞一律「，且」、動詞一律「習得」、技能名一律加【】、不再接「技能」二字。
//   這不是「把期望值改成現在的樣子」——下面 C 段另外釘住「寫法只有一種」，
//   所以這裡改的是**資料的規格**，不是遷就現況。
check('瞬息之間 → 抓出後半段', extraOf('瞬息之間'), '已習得【招架反擊】');
check('被封印的儀式 → 抓出「【魔法卡組】達到技能等級 3 或更高」',
  extraOf('被封印的儀式'), '【魔法卡組】達到技能等級 3 或更高');
check('模擬同化 → 開頭的「且」要清掉，職業名也一起收乾淨',
  extraOf('模擬同化'), '已習得【基因分析】和【咒語模仿】');

// 立案時只找「且／並」，漏了這三條用**逗號**連接的（MEMORY 鐵則 13 的又一個實例：
// 掃描的邊界錯了，比邏輯錯了更安靜）。
check('英雄級夥伴（用逗號連接）→ 抓得到', extraOf('英雄級夥伴'), '已習得【忠實夥伴】');
check('完美瞄準（用逗號連接）→ 抓得到', extraOf('完美瞄準'), '已習得【警告射擊】');
check('劫掠（用逗號連接）→ 抓得到', extraOf('劫掠'), '已習得【靈魂竊取】');

check('只有職業名的（強力咒語）→ 空字串', extraOf('強力咒語'), '');
check('只有職業名的（破釜沉舟）→ 空字串', extraOf('破釜沉舟'), '');
check('「通用」→ 空字串', extraOf('靈巧雙手'), '');
check('雙重詠唱（後半段只有等級）→ 空字串，不叫玩家自己確認', extraOf('雙重詠唱'), '');
check('偉大召喚（後半段只有等級）→ 空字串', extraOf('偉大召喚'), '');
check('空物件不會爆', heroicSkillExtraPrerequisite({}), '');
check('undefined 不會爆', heroicSkillExtraPrerequisite(undefined), '');
check('requirement 是 null 不會爆', heroicSkillExtraPrerequisite({ requirement: null }), '');

// 數量釘住：33 條含「且／並」扣掉 2 條只有等級的 = 31，再加上 3 條用逗號連接的 = 34。
// 數字變了就是有人改了條件文——回來看這一段，不要直接把 34 改掉。
const withExtra = HS.map((h) => ({ h, extra: heroicSkillExtraPrerequisite(h) }))
  .filter((x) => x.extra !== '');
check('恰好 34 條有額外前提', withExtra.length, 34);
check('每一段額外前提都是 requirement 的子字串（不是憑空組出來的）',
  withExtra.filter(({ h, extra }) => !String(h.requirement).includes(extra)).map(({ h }) => h.name), []);
check('每一段額外前提都不含「等級必須為」（那個引擎在管）',
  withExtra.filter(({ extra }) => extra.includes('等級必須為')).map(({ h }) => h.name), []);
check('每一段額外前提都不是以「且」或「並」開頭（清理乾淨）',
  withExtra.filter(({ extra }) => /^[且並]/.test(extra)).map(({ h }) => h.name), []);

// ─────────────────────────────────────────────────────────── C
section('C. 分類：31 條引擎自己判得出來，3 條交回玩家（逐條釘住）');

const resolved = HS.map((h) => ({ h, r: resolveHeroicExtraRequirement(h) })).filter((x) => x.r.hasExtra);
const auto = resolved.filter((x) => x.r.checkable);
const manual = resolved.filter((x) => !x.r.checkable);

check('有額外前提的條數', resolved.length, 34);
check('可自動判 34 條（基本款全部）', auto.length, 34);
check('語法上判不出來 0 條', manual.length, 0);

// 這 3 條**點名列出**。只驗「3 條」的話，A 換成 B 也會是 3 條，測試照樣綠。
// 剩下的一種不可判原因：「有那個技能」≠「拿了那個增益」——
// App 知道你有【小工具】，不知道你走了哪一軌。
//
// ※ 2026-10-29（P33）從 6 條變 3 條。三條**都是變成判得出來**，不是放寬：
//   ・【奧法戰士】38 條咒語補上 `isOffensive`（官方角色卡 Excel 的 ⚡ 標記）→ 數得出來
//   ・【這東西是活著的】【根源共生】物種存在 `wayfarerData.companion.species` → 判得出來
//     ※ 分類上可判，但**玩家還沒設計夥伴時仍然交回玩家**（見 C3 段）。
// ※ 2026-10-29（P34）這張表**清空了**。GM 一句「小工具的軌你自己不會讀嗎？」
//   把最後三條問了回去：玩家在科技樹上點的每一檔都存在 `tinkererData.gadgets`，
//   三條軌 × 三個檔次全部有值。**資料一直都在，只是沒有人去讀**（和 P33 的物種同一個病）。
//   所以「語法上讀不懂」現在是 0 條——但**不代表不會再問玩家**：
//   資料還沒填（沒設計夥伴、沒開過科技樹）時仍然會問，那是 C3 段的事。
//   兩個數字不要併成一個：語法 0 條／實際會問 6 條。
check('語法上判不出來的一條都沒有（清單空的是結論，不是漏寫）',
  manual.map((x) => x.h.name), []);

// 抽驗內容：不是「有命中就算」，要認對人、認對關係。
check('瞬息之間 → 需要【招架反擊】（單一技能）',
  [resolveOf('瞬息之間').mode, resolveOf('瞬息之間').needs.map((n) => n.name)], ['all', ['招架反擊']]);
check('肩並肩 → 需要【忠實夥伴】',
  resolveOf('肩並肩').needs.map((n) => n.name), ['忠實夥伴']);
check('子彈時間「閃避**或**竊取時間」→ any',
  [resolveOf('子彈時間').mode, resolveOf('子彈時間').needs.map((n) => n.name).sort()],
  ['any', ['竊取時間', '閃避']]);
check('哀慟採集者「抽取精魂**和**抽取活力」→ all（而且是兩個咒語）',
  [resolveOf('哀慟採集者').mode, resolveOf('哀慟採集者').needs.map((n) => `${n.name}:${n.kind}`).sort()],
  ['all', ['抽取活力:spell', '抽取精魂:spell']]);
check('為了更美好的未來「真正的財富**和**貿易之風」→ all',
  [resolveOf('為了更美好的未來').mode, resolveOf('為了更美好的未來').needs.map((n) => n.name)],
  ['all', ['真正的財富', '貿易之風']]);
check('被封印的儀式 → 技能等級前提，不是技能名',
  [resolveOf('被封印的儀式').skillLevel.name, resolveOf('被封印的儀式').skillLevel.level], ['魔法卡組', 3]);
check('靈氣掌握「光環**或**屏障」→ 屏障認的是短名（長名優先不會張冠李戴）',
  resolveOf('靈氣掌握').needs.map((n) => n.name).sort(), ['光環', '屏障'].sort());

// 名冊裡有兩組「短名住在長名裡面」：【屏障】⊂【隔音屏障】、【幻影】⊂【幻影之力】。
// 名冊是「長名優先」排序的，否則「隔音屏障」會被讀成【屏障】＋看不懂的殘字「隔音」。
// 目前 167 條裡沒有哪一條寫到長名，所以**只用真實資料驗不到這段排序**——
// 這裡餵它合成的條件文，讓「長名優先」變成驗得到的事（不然它是驗不到的程式碼）。
const synth = (req) => resolveHeroicExtraRequirement({ requirement: req });
check('長名優先：「隔音屏障」不會被拆成【屏障】＋殘字「隔音」',
  synth('武器大師，且習得隔音屏障技能').needs.map((n) => n.name), ['隔音屏障']);
check('長名優先：「幻影之力」不會被拆成【幻影】＋殘字「之力」',
  synth('武器大師，且習得幻影之力技能').needs.map((n) => n.name), ['幻影之力']);
check('（對照）寫短名時認的仍然是短名', 
  synth('武器大師，且習得光環或屏障技能').needs.map((n) => n.name).sort(), ['光環', '屏障'].sort());
check('沒有額外前提的條目 → hasExtra false', resolveOf('破釜沉舟').hasExtra, false);
check('沒有額外前提的條目 → checkable true（沒有東西要判，不算「判不出來」）',
  resolveOf('破釜沉舟').checkable, true);

// ─────────────────────────────────────────────────────────── C2
section('C2. 畫面上其實有 167 條：只量 115 條會漏掉整批 Playtest（鐵則 13 第四次）');

// 為什麼要另開一段：`rulesData.heroicSkills` 是 115 條基本款，但選擇器列的是
// 引擎的 `HEROIC_SKILLS`（115 ＋ 52 條 Playtest／變體）。P31 只量了 115 條，
// 於是「勾選框剩 6 個」在畫面上其實是 15 個——**漏掉的那批寫法不一樣**
// （基本款寫「已習得／已學會」，Playtest 寫「已取得」），所以「取得」不在填充詞裡也看不出來。
check('畫面用的清單是 167 條（不是 115）', HEROIC_SKILLS.length, 167);
check('「已取得【挑釁】」→ 認得（填充詞漏了「取得」就會變成看不懂）',
  [resolveOfFull('滿口髒話').checkable, resolveOfFull('滿口髒話').needs.map((n) => n.name)], [true, ['挑釁']]);
check('「已取得【偷襲】或【個人載具】」→ any',
  [resolveOfFull('暗藏武器').mode, resolveOfFull('暗藏武器').needs.map((n) => n.name).sort()],
  ['any', ['個人載具', '偷襲'].sort()]);

// 點名釘住。這幾條是「**解析不出來**」的，其餘 43 條都解析得出來。
// 數字或名單一變就要回來看：多一條可能是填充詞又漏了，少一條可能是資料改了。
//
// ※ 2026-10-29（P32）從 9 條變 8 條：【躍空】不再交回玩家。
//   原因不是「放寬」，而是**它原本根本沒被檢查**——舊寫法無條件丟掉第一段，
//   把「已學會【飛天打擊】」當成職業段丟了，只剩「你便不能取得」這句團務限制，
//   於是那一列長出勾選框，玩家勾一下就能拿一個沒學過【飛天打擊】的英雄技能。
// ※ 2026-10-29（P33）再從 8 條變 4 條：奧法戰士／收割行者離開這張表（真的判得出來了），
//   這東西是活著的／根源共生**移到 C3**——它們的「判不出來」不是解析的問題，
//   是**資料還沒填**（玩家沒設計夥伴）。混在同一張表裡會看不出這個差別。
// ※ 2026-10-29（P34）這張表也清空了：四條小工具條件改成讀 `tinkererData.gadgets`，
//   全部變成判得出來。所以「解析不出來 0 條」在 115 條與 167 條上是同一件事。
check('全部 167 條裡，解析不出來的一條都沒有',
  fullManual.map((h) => h.name), []);

// 反向控制：這一條**看起來**應該判不出來（「高級煉金術」不是技能名），
// 其實判得出來——因為「煉金術」是【小工具】的一條軌，「高級」是那一軌的第二檔。
// 留下這一條是為了讓「四條小工具條件真的被讀懂了」變成可驗證的事，
// 而不是只驗「清單是空的」（空的清單也可能是因為整段沒被解析）。
check('藥水霧化 → 讀得懂，而且是「煉金術軌的高級益處」',
  [resolveOfFull('藥水霧化').checkable, resolveOfFull('藥水霧化').gadgetTier],
  [true, { track: '煉金術', tier: 2 }]);
check('量子魔加農 → 讀成「魔導科技軌的高級益處」（原文寫「魔科技」，是同一個鍵）',
  resolveOfFull('量子魔加農').gadgetTier, { track: '魔導科技', tier: 2 });
check('大鍋秘方 → 讀成「煉金術軌的最高益處」',
  resolveOfFull('大鍋秘方').gadgetTier, { track: '煉金術', tier: 3 });
check('爆裂藝術家 → 讀成「煉金術軌的基礎益處」',
  resolveOfFull('爆裂藝術家').gadgetTier, { track: '煉金術', tier: 1 });

// 【收割行者】原本寫的是「已取得【高速】或【竊取時間】」，而【高速】在名冊裡不存在，
// 於是殘字消不掉、整條交回玩家。2026-10-29 GM 裁定：**【高速】是【迅捷】，遊蕩者的技能。**
// 對照職業也說得通：熵師→【竊取時間】、遊蕩者→【迅捷】，正好一人一招。
check('收割行者 → 判得出來，而且是「任一個」',
  [resolveOfFull('收割行者').checkable, resolveOfFull('收割行者').mode,
    resolveOfFull('收割行者').needs.map((n) => n.name).sort()],
  [true, 'any', ['竊取時間', '迅捷'].sort()]);
check('收割行者的原文已經是【迅捷】，不再有【高速】',
  byNameFull('收割行者').requirement.includes('【高速】'), false);
check('收割行者的原文仍然是【迅捷】（不是把整句拿掉）',
  byNameFull('收割行者').requirement.includes('【迅捷】'), true);

// 【躍空】是 P32 抓到的「安靜的漏檢查」：它的第一段不是職業段。
// 這三條一起守——**只改一條不夠**：只驗「不再交回玩家」，程式碼把前提丟掉也會過。
check('躍空 → 判得出來（前提是【飛天打擊】，不是那句團務限制）',
  [resolveOfFull('躍空').checkable, resolveOfFull('躍空').needs.map((n) => n.name)], [true, ['飛天打擊']]);
check('躍空的額外前提不含團務限制句（那句不是「這個角色符不符合」）',
  resolveOfFull('躍空').text, '已習得【飛天打擊】');
check('躍空的完整原文仍然保留著那句團務限制（畫面上要看得到）',
  byNameFull('躍空').requirement.includes('同一團中若有其他玩家角色'), true);

// ─────────────────────────────────────────── 結構護欄：這一條會自己抓「漏檢查」
//
// 判準：**條件裡寫到一個已知的技能名，`needs` 就必須涵蓋它。**
// 沒有涵蓋的只准是下面點名的這三條，而且每一條都有理由。
//
// 為什麼要有這一條：【躍空】原本就是這樣漏掉的——條件寫著【飛天打擊】，
// 引擎把整句當成「職業段」丟掉，`needs` 是空的，而它在外表上**跟其他保守的例外一模一樣**
// （都是「交回玩家」）。當時那條「交回玩家的 9 條」的斷言照樣綠燈，因為它驗的是
// 「哪些交回玩家」，不是「該檢查的有沒有檢查」。
// **清單型的斷言守不住「漏掉」——它只守得住「變多」。**
const KNOWN_NAME_SET = (() => {
  const s = new Set();
  for (const c of Object.values(rulesData.classes || {})) for (const sk of c.skills || []) s.add(sk.name);
  for (const sp of rulesData.spells || []) s.add(sp.name);
  return s;
})();
const uncoveredNames = HEROIC_SKILLS.filter((h) => {
  // 只掃【】裡的。**不要**改成「掃所有已知名字」——那會抓到「小工具技能」裡的
  // 「小工具」（那是修補匠的技能名，這裡卻只是普通名詞），一次多出 5 條假陽性。
  // 沒有括號的那兩條（這東西是活著的／根源共生）由下面「交回玩家的 8 條」守。
  const known = [...String(h.requirement || '').matchAll(/【([^】]+)】/g)]
    .map((m) => m[1]).filter((n) => KNOWN_NAME_SET.has(n));
  if (known.length === 0) return false;
  const needs = resolveHeroicExtraRequirement(h).needs.map((n) => n.name);
  return known.some((n) => !needs.includes(n));
}).map((h) => h.name);
check('條件裡【】寫到的已知技能名，needs 都要涵蓋（一條例外都沒有）',
  uncoveredNames, []);
// ※ 這張例外清單 2026-10-29 已經清空：
//   收割行者原本是唯一的例外（引用的【高速】在名冊裡不存在，殘字消不掉）。
//   改成【迅捷】之後它的兩個名字都認得，`needs` 涵蓋得到，所以不再需要例外。
//   **例外清單歸零不代表這條護欄可以刪**——它守的是「條件寫到什麼就要檢查什麼」，
//   下一個人漏掉一段時，這裡會是唯一會叫的地方（【躍空】就是這樣被抓到的）。
//
// ※ 2026-10-29（P34）這兩條**進了掃描範圍**：條件統一寫成「已習得【忠實夥伴】（構裝體物種）」，
//   名字外面有【】了。它們能過關是因為「物種」與「有沒有那個技能」被拆成兩件事——
//   物種段只挖掉括號（「（構裝體物種）」），名稱留在句子裡進 `needs`。
//   第一版把整段「忠實夥伴（構裝體物種）」都挖掉，於是 `needs` 少了【忠實夥伴】，
//   這條護欄當場變紅——**它抓到的是真的漏檢查**，不是雜訊。

// ─────────────────────────────────────────────────────────── C3
section('C3. 判定層：引擎「解析得出來」不等於「現在就有答案」');

// 【這東西是活著的】【根源共生】在 C 段的分類是 `checkable: true`（語句解析得出來），
// 但那不等於現在就有答案：物種存在角色卡上，**玩家沒設計夥伴之前那裡是空的**。
// 這一節把「分類」和「實際判定」分開量——兩者混著看，就會誤以為已經不必問玩家。
const companionGate = (name, { species = null, skills = ['忠實夥伴', '高瞻遠矚'] } = {}) =>
  checkHeroicSkillRequirement(byNameFull(name), {
    masteredClasses: ['旅人'], classes: ['旅人'], level: 50,
    learnedSkills: skills.map((n) => ({ name: n, sl: 1 })),
    companionSpecies: species
  });

check('還沒設計夥伴 → 這東西是活著的仍然交回玩家（不假裝知道）',
  companionGate('這東西是活著的').needsPlayerConfirm, true);
check('還沒設計夥伴 → 根源共生仍然交回玩家',
  companionGate('根源共生').needsPlayerConfirm, true);
check('夥伴是【構裝體】→ 這東西是活著的可以拿',
  companionGate('這東西是活著的', { species: '構裝體' }).ok, true);
check('夥伴是【構裝體】→ 根源共生不行，而且講清楚差在哪',
  companionGate('根源共生', { species: '構裝體' }).reason,
  '需忠實夥伴是【植物】物種（目前【構裝體】）');
check('夥伴是【植物】→ 根源共生可以拿',
  companionGate('根源共生', { species: '植物' }).ok, true);
check('夥伴是【植物】→ 這東西是活著的講的是構裝體',
  companionGate('這東西是活著的', { species: '植物' }).reason,
  '需忠實夥伴是【構裝體】物種（目前【植物】）');
check('夥伴是【野獸】→ 兩條都不行',
  [companionGate('這東西是活著的', { species: '野獸' }).ok,
    companionGate('根源共生', { species: '野獸' }).ok], [false, false]);
// ※ 這一條守的是 P32【躍空】的同一個錯誤：物種那一關過了，**同一句裡的其他前提**
//   還是要檢查。【這東西是活著的】是「忠實夥伴（構裝體物種）**和**高瞻遠矚技能」。
check('物種對了但沒學【高瞻遠矚】→ 仍然不能拿（不能因為物種過了就整句放行）',
  companionGate('這東西是活著的', { species: '構裝體', skills: ['忠實夥伴'] }).reason,
  '需先學會【高瞻遠矚】');

// 【奧法戰士】「至少學會兩個攻擊性咒語」：攻擊性由 `rulesData.spells[].isOffensive` 決定，
// 那個欄位來自官方角色卡 Excel「咒語合集」的 ⚡ 標記（38 條裡 20 條）。
const wizardGate = (spells) => checkHeroicSkillRequirement(byNameFull('奧法戰士'), {
  masteredClasses: ['元素師'], classes: ['元素師'], level: 50,
  learnedSkills: [], learnedSpells: spells
});
check('攻擊性咒語 0 個 → 不能拿', wizardGate([]).ok, false);
check('只有 1 個 → 不能拿，而且要說出目前幾個', wizardGate(['照明烈焰']).reason,
  '需至少學會 2 個攻擊性咒語（目前 1 個）');
check('（對照）2 個攻擊性 → 可以拿', wizardGate(['照明烈焰', '雷霆']).ok, true);
check('非攻擊性咒語不算數（【治癒】＋【屏障】＝ 0 個）',
  countOffensiveSpells(['治癒', '屏障']), 0);
check('一個攻擊性 ＋ 一個非攻擊性 ＝ 1 個',
  countOffensiveSpells(['治癒', '雷霆']), 1);
check('嵌合師記下的咒語（物件帶 isOffensive）也算',
  countOffensiveSpells(['治癒', { name: '自訂吐息', isOffensive: true }]), 1);
check('物件沒有 isOffensive、名字也不在名單裡 → 不算（不猜）',
  countOffensiveSpells([{ name: '自訂咒語' }]), 0);
check('混著字串與物件不會爆', countOffensiveSpells([null, '', '雷霆']), 1);

// ─────────────────────────────────────────────────────────── C4
section('C4. 小工具的三條軌（F-043）：GM 問「小工具的軌你自己不會讀嗎？」');

// 這四條的條件在 P33 之前是「讀不懂」（F-035 的立案理由：App 知道你有【小工具】，
// 不知道你走了哪一軌）。**那個理由本來就是錯的**——玩家在科技樹上點的每一檔都存在
// `tinkererData.gadgets = { alchemy, infusion, magitech }`，值是 0–3。
// 所以這一節驗三件事：讀得懂、真的會擋、以及「資料沒填」時仍然交回玩家。
const gadgetGate = (name, gadgets, opts = {}) => checkHeroicSkillRequirement(byNameFull(name), {
  masteredClasses: ['修補匠'], classes: ['修補匠'], level: 50,
  learnedSkills: [], learnedSpells: [], gadgets, ...opts
});

check('四條的軌與檔次都讀對了',
  ['藥水霧化', '量子魔加農', '大鍋秘方', '爆裂藝術家']
    .map((n) => resolveOfFull(n).gadgetTier),
  [{ track: '煉金術', tier: 2 }, { track: '魔導科技', tier: 2 },
    { track: '煉金術', tier: 3 }, { track: '煉金術', tier: 1 }]);

// 檔次邊界：0 / 不夠 / 剛好 / 超過。**四種都要驗**，只驗「剛好」會看不出 > 與 >= 的差別。
check('煉金術 0 檔 → 擋，訊息說「尚未取得」',
  gadgetGate('藥水霧化', { alchemy: 0 }).reason, '需小工具【煉金術】達高級益處（目前尚未取得）');
check('煉金術 1 檔 → 擋，訊息說「目前基礎益處」',
  gadgetGate('藥水霧化', { alchemy: 1 }).reason, '需小工具【煉金術】達高級益處（目前基礎益處）');
check('煉金術 2 檔 → 剛好到，可以拿', gadgetGate('藥水霧化', { alchemy: 2 }).ok, true);
check('（對照）煉金術 3 檔 → 也可以拿（門檻是「至少」，不是「剛好」）',
  gadgetGate('藥水霧化', { alchemy: 3 }).ok, true);
check('最高益處要 3 檔：2 檔不夠', gadgetGate('大鍋秘方', { alchemy: 2 }).ok, false);
check('最高益處要 3 檔：3 檔可以', gadgetGate('大鍋秘方', { alchemy: 3 }).ok, true);
check('基礎益處 1 檔就夠', gadgetGate('爆裂藝術家', { alchemy: 1 }).ok, true);

// 走錯軌不算數——這是「軌」這件事真正的意義。
check('把灌注術點滿也不能拿去換煉金術的條件',
  gadgetGate('藥水霧化', { infusion: 3, magitech: 3 }).ok, false);

// **整份資料都沒有**（舊卡、還沒開過科技樹）→ 交回玩家，不假裝知道。
// 注意這跟「有資料但 0 檔」不同：0 是「點過，確實一檔都沒有」，可以照實擋。
check('完全沒有科技樹資料 → 不擋，但交回玩家',
  [gadgetGate('藥水霧化', null).ok, gadgetGate('藥水霧化', null).needsPlayerConfirm], [true, true]);

// 魔晶石制改寫了魔導科技那一軌（魔加農火器整條移除、魔法球原型從最高降成高級），
// 同一個「高級」指的不是同一個節點 → 不猜。煉金術不受影響，照樣判。
check('魔晶石制 → 魔導科技那條交回玩家（同一個詞指不同節點，不猜）',
  [gadgetGate('量子魔加農', { magitech: 3 }, { technoRestrictsEquipment: true }).ok,
    Boolean(gadgetGate('量子魔加農', { magitech: 3 }, { technoRestrictsEquipment: true }).needsPlayerConfirm)],
  [true, true]);
check('（對照）魔晶石制不影響煉金術：3 檔仍然放行、0 檔仍然擋',
  [gadgetGate('藥水霧化', { alchemy: 3 }, { technoRestrictsEquipment: true }).ok,
    gadgetGate('藥水霧化', { alchemy: 0 }, { technoRestrictsEquipment: true }).ok], [true, false]);

// ─────────────────────────────────────────────────────────── D
section('D. 判定：有學／沒學／「或」／「和」／技能等級／沒給「學過什麼」');

// 第三個參數是職業。**不能全部塞武器大師**：判定會先過「職業」那關，
// 職業不符就直接回「開局需擁有…」，根本走不到技能那關，於是 D 段驗的東西不是它想驗的東西。
// （2026-10-28 就是這樣紅了三條：子彈時間要遊蕩者／熵師、哀慟採集者要死靈術士／熵師。）
const asCreation = (name, learned = [], classes = ['武器大師']) => checkHeroicSkillRequirement(byName(name), {
  classes, level: 5, atCreation: true, learnedSkills: learned
});

check('沒學【招架反擊】→ 不能選', asCreation('瞬息之間').ok, false);
check('沒學的訊息要點名缺哪一招', asCreation('瞬息之間').reason, '需先學會【招架反擊】');
check('學了【招架反擊】→ 可以選', asCreation('瞬息之間', [{ name: '招架反擊', sl: 1 }]).ok, true);
check('學了但技能名不對（【招架】）→ 仍然不能選（不做模糊比對）',
  asCreation('瞬息之間', [{ name: '招架', sl: 1 }]).ok, false);

check('「或」：只學【閃避】就夠',
  asCreation('子彈時間', [{ name: '閃避', sl: 1 }], ['遊蕩者']).ok, true);
check('「或」：一個都沒學 → 不能選', asCreation('子彈時間', [], ['遊蕩者']).ok, false);
check('「和」：只學【抽取精魂】不夠',
  asCreation('哀慟採集者', [{ name: '抽取精魂', sl: 1 }], ['死靈術士']).ok, false);
check('「和」：缺的那一招要點名',
  asCreation('哀慟採集者', [{ name: '抽取精魂', sl: 1 }], ['死靈術士']).reason,
  '需先學會【抽取活力】');
check('「和」：兩個都學了就夠',
  asCreation('哀慟採集者', [{ name: '抽取精魂', sl: 1 }, { name: '抽取活力', sl: 1 }], ['死靈術士']).ok, true);

// 反向控制：職業不符時，訊息必須講職業，不能講技能。
// 沒有這條的話，「全部塞武器大師」那種寫錯的測試會紅得很像產品壞了。
// 不驗字面順序——職業名的先後由資料排序決定，驗順序等於在驗排序實作。
const classMsg = asCreation('子彈時間', [{ name: '閃避', sl: 1 }]).reason;
check('職業不符 → 先講職業（有講到兩個職業名）',
  [classMsg.includes('遊蕩者'), classMsg.includes('熵師')], [true, true]);
check('職業不符 → 不要誤報成「缺技能」', classMsg.includes('需先學會'), false);

// 技能等級前提（被封印的儀式：卡牌大師或秘儀師，且【魔法卡組】達到技能等級 3）
const asCard = (sl) => checkHeroicSkillRequirement(byName('被封印的儀式'), {
  classes: ['卡牌大師'], level: 10, atCreation: true, learnedSkills: [{ name: '魔法卡組', sl }]
});
check('技能等級 2 → 不能選', asCard(2).ok, false);
check('技能等級不夠的訊息要寫出目前幾級', asCard(2).reason, '需【魔法卡組】技能等級 3（目前 2）');
check('技能等級 3 → 可以選', asCard(3).ok, true);
check('沒學【魔法卡組】→ 不能選（sl 當 0 算，不是當成有）', asCard(0).ok, false);

// 判不出來的條目：`ok` 仍然是 true，但要標記「請玩家自己確認」。
//
// ※ 這一組原本用【奧法戰士】當樣本。2026-10-29 補上咒語的 `isOffensive` 之後它變成
//   判得出來（見 C3），所以樣本換成【藥水霧化】。
// ※ P34 之後它**讀得懂**了（「煉金術軌的高級益處」），但這張測試卡**沒有科技樹資料**
//   （`tinkererData.gadgets` 是 undefined）——所以仍然交回玩家。
//   理由從「讀不懂」變成「資料還沒填」，這正是 C3 段在守的那條界線。
check('藥水霧化（沒有科技樹資料）→ 不擋，但要求玩家確認',
  [asCreation('藥水霧化', [], ['修補匠']).ok,
    asCreation('藥水霧化', [], ['修補匠']).needsPlayerConfirm], [true, true]);
check('藥水霧化 → 帶出要確認的那段原文',
  asCreation('藥水霧化', [], ['修補匠']).extraText, '小工具【煉金術】已達高級益處');
check('判得出來而且通過的 → 不要要求玩家確認',
  [asCreation('瞬息之間', [{ name: '招架反擊', sl: 1 }]).ok,
    Boolean(asCreation('瞬息之間', [{ name: '招架反擊', sl: 1 }]).needsPlayerConfirm)], [true, false]);

// 呼叫端沒給「學過什麼」→ 一律交回玩家。**不知道就不要假裝知道。**
// 編輯器算「開局名額用掉幾個」就是這種情況：那時在數已取得的技能，不該重新審核資格。
check('沒給 learnedSkills → 判得出來的也交回玩家（不假裝知道）',
  checkHeroicSkillRequirement(byName('瞬息之間'), {
    classes: ['武器大師'], level: 5, atCreation: true
  }).needsPlayerConfirm, true);
check('沒給 learnedSkills 但職業就不合 → 還是照職業的理由擋（職業優先）',
  checkHeroicSkillRequirement(byName('瞬息之間'), {
    classes: ['旅人'], level: 5, atCreation: true
  }).reason, '開局需擁有【武器大師】其中之一');

// 反向控制：20 級的元素師選不了雙重詠唱、30 級選得了（等級前提真的在擋）。
//
// ※ 2026-10-29（P32，F-034）改寫：舊版第三條寫「30 級**元素師**選得了」，
//   而那正是缺陷本身——【雙重詠唱】的原文是「**兩個或更多**：元素師、熵師、靈師」，
//   引擎卻用 `required.some(...)`（任一個就夠），把「兩個」悄悄放寬成「一個」。
//   **斷言原本在替那個 bug 背書**，所以紅燈不是產品壞了，是這條在記錄舊行為。
//   現在拆成三條：一個職業不行、兩個職業可以、三個職業也可以。
check('（反向）20 級元素師選不了雙重詠唱',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師'], classes: ['元素師'], level: 20
  }).ok, false);
check('（F-034）30 級但只有**一個**職業 → 選不了雙重詠唱（原文是「兩個或更多」）',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師'], classes: ['元素師'], level: 30
  }).ok, false);
check('（F-034）缺的數量要講出來，不要只說「不可選」',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師'], classes: ['元素師'], level: 30
  }).reason, '需精通【元素師／熵師／靈師】其中 2 個（目前 1 個）');
check('（F-034）30 級＋元素師與熵師 → 選得了',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師', '熵師'], classes: ['元素師', '熵師'], level: 30
  }).ok, true);
check('（F-034）30 級＋三個職業 → 也選得了（「或更多」不是「剛好兩個」）',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師', '熵師', '靈師'], classes: ['元素師', '熵師', '靈師'], level: 30
  }).ok, true);

// ─────────────────────────────────────────────────────────── E
section('E. 畫面：判得出來的不再問玩家，判不出來的才問');

const renderPicker = ({ over = {}, rules = {}, level = null } = {}) => {
  const base = createNewCharacter({ name: '確認測試', startingFundsRolled: true, ...over });
  // `createNewCharacter` 的 `level` 來自開卡規則（預設 5），不會因為職業等級 30 就變 30。
  const char = level === null ? base : { ...base, level };
  return renderToStaticMarkup(React.createElement(HeroicSkillPickerBody, {
    character: char,
    rules: resolveCreationRules(rules),
    stats: calculateCharacterStats(char),
    theme: {},
    onPick: () => {}
  }));
};

/** 把一列（`<tr>`）切出來：從名稱那一格的效果 testid 往回找 `<tr`，往前找 `</tr>`。 */
const rowOf = (html, name) => {
  const anchor = html.indexOf(`data-testid="heroic-effect-${name}"`);
  if (anchor < 0) return '';
  const start = html.lastIndexOf('<tr', anchor);
  const end = html.indexOf('</tr>', anchor);
  return start >= 0 && end >= 0 ? html.slice(start, end) : '';
};
const renderedNames = (html) => [...html.matchAll(/data-testid="heroic-effect-([^"]+)"/g)].map((m) => m[1]);
const hasConfirm = (row) => row.includes('data-testid="heroic-confirm-');
/**
 * 抓「選用」那顆按鈕的開頭標籤。
 * ※ **不能取一列裡的第一個 `<button>`**：效果欄的術語 tooltip（`TermHint`）也是 `<button>`，
 * 而且它排在前面。第一版就是這樣寫的，於是驗到的是 HR 的 tooltip。
 */
const pickTag = (row, name) => {
  const hit = row.match(new RegExp(`<button[^>]*data-testid="heroic-pick-${name}"[^>]*>`));
  return hit ? hit[0] : '';
};
/**
 * 按鈕是不是停用的（React SSR 的停用是 `disabled=""`）。
 * ※ 不能只搜 `disabled`：className 裡永遠有 `disabled:opacity-40`。
 */
const isBtnDisabled = (tag) => / disabled(=""|\s|>)/.test(tag || '<button disabled>');

const creationHtml = renderPicker({
  over: { classes: [{ className: '武器大師', level: 5, skills: [] }] },
  rules: { startingHeroicSkill: true }
});
const creationRows = renderedNames(creationHtml);

check('開局模式下畫面真的畫出了列（不然下面全部假綠）', creationRows.length > 0, true);
check('瞬息之間在預設視圖裡（它是武器大師的技能）', creationRows.includes('瞬息之間'), true);

// 判得出來 → 不問玩家，直接把缺什麼寫出來。
const momentRow = rowOf(creationHtml, '瞬息之間');
check('瞬息之間那一列**沒有**勾選框（引擎判得出來，不該問玩家）',
  hasConfirm(momentRow), false);
check('瞬息之間那一列寫出缺哪一招', momentRow.includes('需先學會【招架反擊】'), true);
check('瞬息之間那一列按鈕是停用的', isBtnDisabled(pickTag(momentRow, '瞬息之間')), true);
check('瞬息之間那一列寫的是「不可選」（不是「先確認」）',
  [momentRow.includes('不可選'), momentRow.includes('先確認')], [true, false]);

// 判不出來 → 才問玩家。
// ※ 樣本原本是【奧法戰士】，2026-10-29 它變成判得出來之後換成【藥水霧化】
//   （「必須獲得小工具技能中的高級煉金術技能」——App 知道你有【小工具】，不知道你走了哪一軌）。
//   【藥水霧化】只對修補匠開放，所以要另開一個修補匠視圖來量（預設視圖是武器大師）。
const brewHtml = renderPicker({
  over: { classes: [{ className: '修補匠', level: 5, skills: [] }] },
  rules: { startingHeroicSkill: true }
});
const brewRows = renderedNames(brewHtml);
const brewRow = rowOf(brewHtml, '藥水霧化');
check('藥水霧化在修補匠視圖裡', brewRows.includes('藥水霧化'), true);
// ※ P34 之後這一列問玩家的理由變了：不是「讀不懂高級煉金術」，
//   而是「這張卡沒有科技樹資料」。勾選框旁邊印的仍然是**條件原文**，
//   所以期望字串跟著統一後的新寫法走（不是放寬成「有含某個字就算」）。
check('藥水霧化那一列有勾選框（這張卡沒有科技樹資料，所以還是要問）', hasConfirm(brewRow), true);
check('藥水霧化的勾選框寫出要確認的那段原文',
  brewRow.includes('小工具【煉金術】已達高級益處'), true);
check('藥水霧化的勾選框說明有講「App 不會自動檢查」', brewRow.includes('App 不會自動檢查'), true);
check('藥水霧化沒勾之前按鈕停用、寫「先確認」',
  [isBtnDisabled(pickTag(brewRow, '藥水霧化')), brewRow.includes('先確認')], [true, true]);

// 逐一驗：畫面上每一列，只有「**現在**判不出來」的才該有勾選框。
//
// ※ 期望值要跟畫面用**同一組輸入**算，否則量到的不是同一件事：
//   畫面的條件是 `verdict.needsPlayerConfirm && verdict.ok && !blocked`，
//   而 `resolveHeroicExtraRequirement(...).checkable` 只是**語句層**的分類。
//   2026-10-29 之前兩者剛好一致（沒有哪一條是「解析得出來但缺資料」），
//   【這東西是活著的】【根源共生】改成判物種之後就不一致了：
//   分類是 checkable、但玩家沒設計夥伴時仍然要問。
//   用 `manual` 當期望值的話，這兩條會被判成「多出來的勾選框」——那是**量錯**，不是產品錯。
const expectedConfirmFor = (classNames) => HEROIC_SKILLS.filter((h) => {
  const v = checkHeroicSkillRequirement(h, {
    masteredClasses: [], classes: classNames, level: 5, atCreation: true,
    learnedSkills: [], learnedSpells: [], companionSpecies: null
  });
  return Boolean(v.needsPlayerConfirm) && v.ok;
}).map((h) => h.name);

// 兩個視圖都要量，理由不同：
//   ・**武器大師**：它底下**一條「判不出來」都沒有**（那四條分屬修補匠／熵師／嵌合師／靈能者）。
//     所以「該有勾選框的一條都沒漏」在這個視圖裡是**恆真的**——那是假綠燈（MEMORY 鐵則 7）。
//     這個視圖改為釘住「它就是零條」，並量「一條都不該多」。
//   ・**修補匠**：有【藥水霧化】，兩個方向都量得到。
for (const view of [
  { label: '武器大師', classNames: ['武器大師'], html: creationHtml, rows: creationRows, expectAny: false },
  { label: '修補匠', classNames: ['修補匠'], html: brewHtml, rows: brewRows, expectAny: true }
]) {
  const manualNames = expectedConfirmFor(view.classNames);
  const expectConfirm = view.rows.filter((n) => manualNames.includes(n));
  const expectNoConfirm = view.rows.filter((n) => !manualNames.includes(n));
  if (view.expectAny) {
    check(`${view.label}視圖：（自我檢查）兩種列都有（否則下面的逐一驗等於只驗一種）`,
      [expectConfirm.length > 0, expectNoConfirm.length > 0], [true, true]);
  } else {
    check(`${view.label}視圖：這一頁本來就沒有「判不出來」的列（把這件事釘住，免得變成假綠）`,
      expectConfirm.length, 0);
  }
  check(`${view.label}視圖：該有勾選框的列，一條都沒漏`,
    expectConfirm.filter((n) => !hasConfirm(rowOf(view.html, n))), []);
  check(`${view.label}視圖：不該有勾選框的列，一條都沒多`,
    expectNoConfirm.filter((n) => hasConfirm(rowOf(view.html, n))), []);
}

// 學了【招架反擊】之後，同一列要變成可以選（這是「真的在判」的正面證明）。
const learnedHtml = renderPicker({
  over: {
    classes: [{ className: '武器大師', level: 5, skills: [{ name: '招架反擊', sl: 1 }] }]
  },
  rules: { startingHeroicSkill: true }
});
const learnedRow = rowOf(learnedHtml, '瞬息之間');
check('學了【招架反擊】之後，瞬息之間那一列變成可以按',
  isBtnDisabled(pickTag(learnedRow, '瞬息之間')), false);
check('學了之後那一列寫「選用」', learnedRow.includes('選用'), true);
check('學了之後那一列沒有「需先學會」', learnedRow.includes('需先學會'), false);

// 精通模式（還沒精通任何職業）：整張表都按不下去，所以不該問玩家任何問題。
const masteryHtml = renderPicker({
  over: { classes: [{ className: '武器大師', level: 5, skills: [] }] }
});
check('還沒精通任何職業時，畫面上一個勾選框都沒有（按不下去的東西不必問）',
  [...masteryHtml.matchAll(/data-testid="heroic-confirm-/g)].length, 0);

// 30 級元素師：等級前提過了，而它後半段只有等級 → **不該**長勾選框。
// ※ 2026-10-29（P32，F-034）：按鈕不再「可按」——【雙重詠唱】要**兩個**職業，
//   這張卡只有元素師一個。舊版驗「可按」是在替缺陷背書。
const masterHtml = renderPicker({
  over: { classes: [{ className: '元素師', level: 30, skills: [] }] },
  level: 30
});
check('30 級元素師的視圖裡有雙重詠唱', renderedNames(masterHtml).includes('雙重詠唱'), true);
check('雙重詠唱那一列沒有勾選框（等級前提引擎已經算過）',
  hasConfirm(rowOf(masterHtml, '雙重詠唱')), false);
check('（F-034）只有一個職業時，雙重詠唱按鈕是停用的',
  isBtnDisabled(pickTag(rowOf(masterHtml, '雙重詠唱'), '雙重詠唱')), true);
check('（F-034）那一列寫出「其中 2 個」，不是只寫「不可選」',
  rowOf(masterHtml, '雙重詠唱').includes('其中 2 個'), true);

// 對照組：補上第二個職業（熵師）就真的可以按了。
// 沒有這條的話，「停用」可能只是因為別的條件沒過，而不是因為數了職業。
const twoClassHtml = renderPicker({
  over: {
    classes: [
      { className: '元素師', level: 30, skills: [] },
      { className: '熵師', level: 10, skills: [] }
    ]
  },
  level: 30
});
check('（F-034 對照）補上熵師之後，雙重詠唱按鈕變成可按',
  isBtnDisabled(pickTag(rowOf(twoClassHtml, '雙重詠唱'), '雙重詠唱')), false);

// 已經持有的技能：那一列本來就按不下去，不必再問。
const ownedHtml = renderPicker({
  over: {
    classes: [{ className: '武器大師', level: 5, skills: [{ name: '招架反擊', sl: 1 }] }],
    heroicSkills: [{ name: '瞬息之間' }]
  },
  rules: { startingHeroicSkill: true }
});
check('已持有的瞬息之間那一列不再長勾選框',
  hasConfirm(rowOf(ownedHtml, '瞬息之間')), false);
check('已持有的瞬息之間那一列寫著「已習得」',
  rowOf(ownedHtml, '瞬息之間').includes('已習得'), true);

// 底部說明：P31 之後不能再用「後半段一律不解析」這種說法——那已經不是現況。
// 這裡同時驗「新的說法在」與「舊的說法不在」，否則改文案時漏改一句也沒人發現。
check('底部說明改成「判不出來的才要自己確認」', creationHtml.includes('判不出來的'), true);
check('底部說明不再宣稱「後半段一律不解析」', creationHtml.includes('App 不解析'), false);

// ─────────────────────────────────────────────────────────── 收尾
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
