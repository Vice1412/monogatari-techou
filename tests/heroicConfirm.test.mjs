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
  resolveHeroicExtraRequirement
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

check('瞬息之間 → 抓出後半段', extraOf('瞬息之間'), '習得招架反擊技能');
check('被封印的儀式 → 抓出「【魔法卡組】達到技能等級 3」', extraOf('被封印的儀式'), '【魔法卡組】達到技能等級 3');
check('模擬同化 → 開頭的「且」要清掉', extraOf('模擬同化'), '學習了突變體中的基因分析和嵌合師的咒語模仿技能');

// 立案時只找「且／並」，漏了這三條用**逗號**連接的（MEMORY 鐵則 13 的又一個實例：
// 掃描的邊界錯了，比邏輯錯了更安靜）。
check('英雄級夥伴（用逗號連接）→ 抓得到', extraOf('英雄級夥伴'), '忠實夥伴技能');
check('完美瞄準（用逗號連接）→ 抓得到', extraOf('完美瞄準'), '警告射擊技能');
check('劫掠（用逗號連接）→ 抓得到', extraOf('劫掠'), '靈魂竊取技能');

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
section('C. 分類：28 條引擎自己判得出來，6 條交回玩家（逐條釘住）');

const resolved = HS.map((h) => ({ h, r: resolveHeroicExtraRequirement(h) })).filter((x) => x.r.hasExtra);
const auto = resolved.filter((x) => x.r.checkable);
const manual = resolved.filter((x) => !x.r.checkable);

check('有額外前提的條數', resolved.length, 34);
check('可自動判 28 條', auto.length, 28);
check('交回玩家 6 條', manual.length, 6);

// 這 6 條**點名列出**。只驗「6 條」的話，A 換成 B 也會是 6 條，測試照樣綠。
// 三種不可判的原因：①有技能≠有那個物種 ②有技能≠拿了那個增益 ③資料沒有那個分類。
check('交回玩家的就是這 6 條（多一條少一條都要回來看）',
  manual.map((x) => x.h.name),
  ['奧法戰士', '藥水霧化', '量子魔加農', '大鍋秘方', '這東西是活著的', '根源共生']);

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

// 點名釘住。這 9 條是「引擎真的判不出來」的，其餘 38 條都判得出來。
// 數字或名單一變就要回來看：多一條可能是填充詞又漏了，少一條可能是資料改了。
check('全部 167 條裡，交回玩家的是這 9 條',
  fullManual.map((h) => h.name),
  ['奧法戰士', '藥水霧化', '量子魔加農', '大鍋秘方', '這東西是活著的', '根源共生',
    '躍空', '爆裂藝術家', '收割行者']);

// 反向控制：這三條**看起來**應該能判，其實不行。它們是「保守」這件事的證據。
check('躍空 → 交回玩家（同一團有沒有別人拿過，App 看不到）',
  resolveOfFull('躍空').checkable, false);
check('收割行者 → 交回玩家（引用的【高速】在名冊裡不存在，不猜）',
  resolveOfFull('收割行者').checkable, false);
check('藥水霧化 → 交回玩家（引用的「高級煉金術」在名冊裡不存在，不猜）',
  resolveOfFull('藥水霧化').checkable, false);

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

// 判不出來的 6 條：`ok` 仍然是 true，但要標記「請玩家自己確認」。
check('奧法戰士（判不出來）→ 不擋，但要求玩家確認',
  [asCreation('奧法戰士').ok, asCreation('奧法戰士').needsPlayerConfirm], [true, true]);
check('奧法戰士 → 帶出要確認的那段原文',
  asCreation('奧法戰士').extraText, '至少學會兩個攻擊性咒語');
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
check('（反向）20 級元素師選不了雙重詠唱',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師'], classes: ['元素師'], level: 20
  }).ok, false);
check('（反向）30 級元素師選得了雙重詠唱',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師'], classes: ['元素師'], level: 30
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
const warRow = rowOf(creationHtml, '奧法戰士');
check('奧法戰士在預設視圖裡', creationRows.includes('奧法戰士'), true);
check('奧法戰士那一列有勾選框（引擎判不出「兩個攻擊性咒語」）', hasConfirm(warRow), true);
check('奧法戰士的勾選框寫出要確認的那段', warRow.includes('至少學會兩個攻擊性咒語'), true);
check('奧法戰士的勾選框說明有講「App 不會自動檢查」', warRow.includes('App 不會自動檢查'), true);
check('奧法戰士沒勾之前按鈕停用、寫「先確認」',
  [isBtnDisabled(pickTag(warRow, '奧法戰士')), warRow.includes('先確認')], [true, true]);

// 逐一驗：畫面上每一列，只有「判不出來」的才該有勾選框。
// 這條用 `resolveHeroicExtraRequirement` 當期望值——**它與畫面讀的是同一份判定**，
// 所以它守的是「畫面有沒有照判定走」，不是「判定對不對」（那是 C 段的事）。
const manualNames = manual.map((x) => x.h.name);
const expectConfirm = creationRows.filter((n) => manualNames.includes(n));
const expectNoConfirm = creationRows.filter((n) => !manualNames.includes(n));
check('（自我檢查）這一輪真的兩種列都有（否則下面的逐一驗等於只驗一種）',
  [expectConfirm.length > 0, expectNoConfirm.length > 0], [true, true]);
check('該有勾選框的列，一條都沒漏',
  expectConfirm.filter((n) => !hasConfirm(rowOf(creationHtml, n))), []);
check('不該有勾選框的列，一條都沒多',
  expectNoConfirm.filter((n) => hasConfirm(rowOf(creationHtml, n))), []);

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

// 30 級元素師：雙重詠唱 的職業前提與等級前提都過了，而它後半段只有等級
// → **不該**長勾選框，按鈕要直接可以按。
const masterHtml = renderPicker({
  over: { classes: [{ className: '元素師', level: 30, skills: [] }] },
  level: 30
});
check('30 級元素師的視圖裡有雙重詠唱', renderedNames(masterHtml).includes('雙重詠唱'), true);
check('雙重詠唱那一列沒有勾選框（等級前提引擎已經算過）',
  hasConfirm(rowOf(masterHtml, '雙重詠唱')), false);
check('雙重詠唱那一列的按鈕是可按的（不是停用）',
  isBtnDisabled(pickTag(rowOf(masterHtml, '雙重詠唱'), '雙重詠唱')), false);

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
