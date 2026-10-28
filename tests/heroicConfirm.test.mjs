/**
 * 英雄技能「算不到的前提」契約測試（F-030，2026-10-28）。
 *
 * 執行：npm run test:heroicconfirm
 *
 * ## 這一組在守什麼
 *
 * 33 條英雄技能的前提寫成「武器大師，**且**習得招架反擊技能」。
 * 前半段（職業）引擎算得出來，後半段是**自由文字**，引擎刻意不解析——
 * 猜錯會擋掉合法角色，那比不擋更糟。
 *
 * GM 2026-10-28 的裁定是：**把判斷還給玩家**。
 * 選擇器在這種列上顯示「我符合這個前提」的勾選框，**沒勾就按不下去**。
 *
 * 所以這一組守三件事：
 *   1. `heroicSkillExtraPrerequisite()` 抓到的正好是那 31 條，而且抓出來的字是原文的一部分；
 *   2. 只有等級前提的（雙重詠唱、偉大召喚）**不長勾選框**——那個引擎已經在算了；
 *   3. 畫面上「該有勾選框的列都有、不該有的都沒有」，而且按鈕在沒勾時是停用的。
 *
 * ## 為什麼第 3 點要「逐一」而不是「至少有一個」
 *
 * MEMORY 鐵則 5：「至少有一個」型斷言太弱。只驗一條的話，剩下 30 條全部漏掉也會是綠的。
 * 所以這裡用「掃描渲染出來的表格」，對每一列逐一判定。
 *
 * ## 這一組驗不到什麼（寫出來，不要用假斷言蓋掉）
 *
 * 「勾了之後按鈕會變成可按」需要真的點一下，SSR 做不到（專案沒有 jsdom）。
 * 那一段由實機腳本 `scratch/p30-ui.mjs` 驗。**這裡只驗初始狀態。**
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  checkHeroicSkillRequirement,
  createNewCharacter,
  calculateCharacterStats,
  heroicSkillExtraPrerequisite
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

// ─────────────────────────────────────────────────────────── A
section('A. 前提：表本身是完整的（不然下面每一條都會「因為掃不到東西」而假綠）');

check('英雄技能恰好 115 條', HS.length, 115);
check('每一條都有 requirement', HS.filter((h) => !h.requirement).map((h) => h.name), []);

// ─────────────────────────────────────────────────────────── B
section('B. 引擎函式：抓到的正好是「引擎算不到的那一段」');

check('瞬息之間 → 抓出後半段', extraOf('瞬息之間'), '習得招架反擊技能');
check('被封印的儀式 → 抓出「【魔法卡組】達到技能等級 3」', extraOf('被封印的儀式'), '【魔法卡組】達到技能等級 3');
// 「並且」拆開後第二段開頭會留一個「且」，必須清掉。
check('模擬同化 → 開頭的「且」要清掉', extraOf('模擬同化'), '學習了突變體中的基因分析和嵌合師的咒語模仿技能');

// 立案時只找「且／並」，漏了這三條用**逗號**連接的（MEMORY 鐵則 13 的又一個實例：
// 掃描的邊界錯了，比邏輯錯了更安靜）。改成「把職業名與等級拿掉、剩下還有字」之後才抓到。
check('英雄級夥伴（用逗號連接）→ 抓得到', extraOf('英雄級夥伴'), '忠實夥伴技能');
check('完美瞄準（用逗號連接）→ 抓得到', extraOf('完美瞄準'), '警告射擊技能');
check('劫掠（用逗號連接）→ 抓得到', extraOf('劫掠'), '靈魂偷竊技能');

// 沒有額外前提的：只有職業名，或只有職業名＋「或」。
check('只有職業名的（強力咒語）→ 空字串', extraOf('強力咒語'), '');
check('只有職業名的（破釜沉舟）→ 空字串', extraOf('破釜沉舟'), '');
check('「通用」→ 空字串', extraOf('靈巧雙手'), '');

// 只有等級前提的不算：引擎已經在 `checkHeroicSkillRequirement` 裡檢查過了。
check('雙重詠唱（後半段只有等級）→ 空字串，不叫玩家自己確認', extraOf('雙重詠唱'), '');
check('偉大召喚（後半段只有等級）→ 空字串', extraOf('偉大召喚'), '');
// 反向：這兩條的等級前提是真的會被擋的，不是「反正引擎不管」。
check('（反向）20 級的元素師選不了雙重詠唱（等級前提真的在擋）',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師'], classes: ['元素師'], level: 20, atCreation: false
  }).ok, false);
check('（反向）30 級的元素師選得了雙重詠唱',
  checkHeroicSkillRequirement(byName('雙重詠唱'), {
    masteredClasses: ['元素師'], classes: ['元素師'], level: 30, atCreation: false
  }).ok, true);

// 通用技能與沒有前提的條目一律回空。
check('5 條「通用」技能全部回空字串',
  HS.filter((h) => h.requirement === '通用' && heroicSkillExtraPrerequisite(h) !== '').map((h) => h.name), []);
check('空物件不會爆', heroicSkillExtraPrerequisite({}), '');
check('undefined 不會爆', heroicSkillExtraPrerequisite(undefined), '');
check('requirement 是 null 不會爆', heroicSkillExtraPrerequisite({ requirement: null }), '');

// 數量釘住：F-030 立案時寫「33 條含且／並」，扣掉 2 條只有等級的 = 31；
// 但立案的掃描漏了 3 條用逗號連接的（英雄級夥伴／完美瞄準／劫掠），所以真正的數字是 **34**。
// 數字變了就是有人改了條件文——回來看這一段，不要直接把 34 改掉。
const withExtra = HS.map((h) => ({ h, extra: heroicSkillExtraPrerequisite(h) }))
  .filter((x) => x.extra !== '');
check('恰好 34 條需要玩家自己確認', withExtra.length, 34);
check('其中 3 條是用逗號連接的（立案時漏掉的那三條）',
  ['英雄級夥伴', '完美瞄準', '劫掠'].filter((n) => !withExtra.some((x) => x.h.name === n)), []);

// 抓出來的字必須是原文的一部分，不能是憑空組出來的。
check('每一段額外前提都是 requirement 的子字串',
  withExtra.filter(({ h, extra }) => !String(h.requirement).includes(extra)).map(({ h }) => h.name), []);
check('每一段額外前提都不含「等級必須為」（那個引擎在管）',
  withExtra.filter(({ extra }) => extra.includes('等級必須為')).map(({ h }) => h.name), []);
check('每一段額外前提都不是以「且」或「並」開頭（清理乾淨）',
  withExtra.filter(({ extra }) => /^[且並]/.test(extra)).map(({ h }) => h.name), []);
check('每一段額外前提都不是空的', withExtra.filter(({ extra }) => !extra.trim()).length, 0);

// ─────────────────────────────────────────────────────────── C
section('C. 畫面：該有勾選框的列都有、不該有的都沒有');

const renderPicker = ({ over = {}, rules = {}, level = null } = {}) => {
  const base = createNewCharacter({ name: '確認測試', startingFundsRolled: true, ...over });
  // `createNewCharacter` 的 `level` 來自開卡規則（預設 5），不會因為職業等級 30 就變 30。
  // 要驗「30 級時雙重詠唱可以直接選」就得在這裡蓋掉。
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
 *
 * ※ **不能取一列裡的第一個 `<button>`**：效果欄的術語 tooltip（`TermHint`）也是 `<button>`，
 * 而且它排在前面。第一版就是這樣寫的，於是驗到的是 HR 的 tooltip——它當然沒有 disabled，
 * 紅的理由完全不是我要驗的東西。用 testid 指定，不要用「第一個」。
 */
const pickTag = (row, name) => {
  const hit = row.match(new RegExp(`<button[^>]*data-testid="heroic-pick-${name}"[^>]*>`));
  return hit ? hit[0] : '';
};
/**
 * 按鈕是不是停用的（React SSR 的停用是 `disabled=""`）。
 * ※ 不能只搜 `disabled`：className 裡永遠有 `disabled:opacity-40 disabled:pointer-events-none`，
 * 那只證明「這個按鈕有寫停用樣式」，不證明「它現在是停用的」。
 */
const isBtnDisabled = (tag) => / disabled(=""|\s|>)/.test(tag || '<button disabled>');

// 開局模式：武器大師 5 級。這個視角下 瞬息之間 的職業前提是過的，
// 只有「習得招架反擊技能」算不到 → 應該長勾選框。
const creationHtml = renderPicker({
  over: { classes: [{ className: '武器大師', level: 5, skills: [] }] },
  rules: { startingHeroicSkill: true }
});
const creationRows = renderedNames(creationHtml);

check('開局模式下畫面真的畫出了列（不然下面全部假綠）', creationRows.length > 0, true);
check('瞬息之間在預設視圖裡（它是武器大師的技能）', creationRows.includes('瞬息之間'), true);

const momentRow = rowOf(creationHtml, '瞬息之間');
check('瞬息之間那一列有「我符合這個前提」勾選框',
  momentRow.includes('我符合這個前提'), true);
check('勾選框的說明寫出是哪一段前提（「習得招架反擊技能」）',
  momentRow.includes('習得招架反擊技能'), true);
check('勾選框說明有講「App 不會自動檢查」（不然玩家以為是壞了）',
  momentRow.includes('App 不會自動檢查'), true);
check('沒勾之前按鈕是停用的',
  isBtnDisabled(pickTag(momentRow, '瞬息之間')), true);
check('按鈕上寫的是「先確認」而不是「不可選」（兩件事：一個是你沒勾，一個是你不能選）',
  momentRow.includes('先確認') && !momentRow.includes('不可選'), true);

// 逐一驗：畫面上每一列，只要它的 requirement 有「算不到的後半段」就要有勾選框。
// 反過來，沒有後半段的列不准有勾選框（多長一個框會讓人以為每條都要勾）。
const expectConfirm = creationRows.filter((n) => {
  const h = byName(n);
  return h && heroicSkillExtraPrerequisite(h) !== ''
    && checkHeroicSkillRequirement(h, {
      classes: ['武器大師'], level: 5, atCreation: true
    }).ok;
});
const expectNoConfirm = creationRows.filter((n) => !expectConfirm.includes(n));

check('（自我檢查）這一輪真的兩種列都有，不是只有一種（否則下面的逐一驗等於只驗一種）',
  [expectConfirm.length > 0, expectNoConfirm.length > 0], [true, true]);
check('該有勾選框的列，一條都沒漏',
  expectConfirm.filter((n) => !hasConfirm(rowOf(creationHtml, n))), []);
check('不該有勾選框的列，一條都沒多',
  expectNoConfirm.filter((n) => hasConfirm(rowOf(creationHtml, n))), []);

// 精通模式（還沒精通任何職業）：整張表都按不下去，所以不該問玩家任何問題。
const masteryHtml = renderPicker({
  over: { classes: [{ className: '武器大師', level: 5, skills: [] }] }
});
check('還沒精通任何職業時，畫面上一個勾選框都沒有（按不下去的東西不必問）',
  [...masteryHtml.matchAll(/data-testid="heroic-confirm-/g)].length, 0);

// 30 級元素師：雙重詠唱 的職業前提與等級前提都過了，而它後半段只有等級
// → **不該**長勾選框，按鈕要直接可以按。這是「不要把算過的東西退回來問玩家」的反向證明。
const masterHtml = renderPicker({
  over: { classes: [{ className: '元素師', level: 30, skills: [] }] },
  level: 30
});
check('30 級元素師的視圖裡有雙重詠唱', renderedNames(masterHtml).includes('雙重詠唱'), true);
check('雙重詠唱那一列沒有勾選框（等級前提引擎已經算過）',
  hasConfirm(rowOf(masterHtml, '雙重詠唱')), false);
check('雙重詠唱那一列的按鈕是可按的（不是停用）',
  isBtnDisabled(pickTag(rowOf(masterHtml, '雙重詠唱'), '雙重詠唱')), false);
check('雙重詠唱那一列寫的是「選用」', rowOf(masterHtml, '雙重詠唱').includes('選用'), true);

// 已經持有的技能：那一列本來就按不下去，不必再問。
const ownedHtml = renderPicker({
  over: {
    classes: [{ className: '武器大師', level: 5, skills: [] }],
    heroicSkills: [{ name: '瞬息之間' }]
  },
  rules: { startingHeroicSkill: true }
});
check('已持有的瞬息之間那一列不再長勾選框',
  hasConfirm(rowOf(ownedHtml, '瞬息之間')), false);
check('已持有的瞬息之間那一列寫著「已習得」',
  rowOf(ownedHtml, '瞬息之間').includes('已習得'), true);

// 底部說明：玩家要知道「為什麼這幾列要打勾」。
check('底部說明有解釋「App 不解析後半段」',
  creationHtml.includes('App 不解析'), true);

// ─────────────────────────────────────────────────────────── 收尾
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
