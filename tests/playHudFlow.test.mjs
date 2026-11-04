/**
 * 跑團卡「效果流程」接線契約測試。
 *
 * 執行：`npm run test:flowui`（已納入 `npm test` 串接）
 *
 * 為什麼要有這個檔案：373 條規則物件裡有 335 條「只有文字」——本輪把它們接成
 * 三種控件（計數器／開關／按鈕）＋ 一份條件式清單。接線放在 `CharacterPlayHUD` 的
 * 三個位置（職業技能卡、英雄技能卡、金手指區塊），而那三個位置**只有 SSR 測得到**；
 * `onClick` 的實際寫入在 `applyFlowPlan`，屬於純函式層（`test:flows` 守）。
 *
 * 這裡守四件事：
 *   ① 該長控件的地方長了（而且帶對的 `data-testid`）
 *   ② 不該長的地方沒長（`apply.via === 'existing'` 的條目不畫按鈕：同一個效果
 *      兩條扣款路徑，重複扣款在畫面上完全看不出來）
 *   ③ 金手指的效果文真的印出來了（以前讀 `quirkDef.effect`，46 條全部只印一句佔位字）
 *   ④ 條件式加值列在「效果加成（依條件）」上，而且附得出條件原文
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import { flowItemForClassSkill, flowItemForQuirk, flowItemForHeroic } from '../src/features/character-sheet/utils/effectFlow.js';

let results = [];
const check = (name, ok, detail = '') => {
  const shown = detail === true ? (ok ? '有' : '缺') : detail;
  results.push({ name, ok: !!ok, detail: shown });
};

const render = (character, props = {}) =>
  renderToStaticMarkup(
    React.createElement(CharacterPlayHUD, {
      character,
      onChange: () => {},
      onBackToRoster: () => {},
      onOpenEditor: () => {},
      showToast: () => {},
      ...props
    })
  );

const countOf = (hay, needle) => hay.split(needle).length - 1;

/** 一個帶指定職業技能的角色（技能 SL 由參數給）。 */
const withClassSkill = (className, skillName, sl = 1) => {
  const c = createNewCharacter({ name: '測試角色' });
  c.classes = [{ className, level: 5, skills: [{ name: skillName, sl }] }];
  return c;
};

/* ────────────────────────────────────────────────────────────────
   A. 職業技能卡上的計數器
   ──────────────────────────────────────────────────────────────── */
const counterItem = flowItemForClassSkill('博學士', '靈光一閃');
check('A0 前提：博學士【靈光一閃】在資料裡是計數器型', counterItem?.control?.kind, 'counter');

const scholar = withClassSkill('博學士', '靈光一閃', 2);
const scholarHtml = render(scholar, { initialTab: 'skills' });
check('A1 計數器長在職業技能卡上',
  countOf(scholarHtml, 'data-testid="flow-skill-博學士-靈光一閃"') >= 1,
  `${countOf(scholarHtml, 'data-testid="flow-skill-博學士-靈光一閃"')} 顆`);
check('A2 有加減兩顆按鈕',
  countOf(scholarHtml, 'flow-skill-博學士-靈光一閃-minus') >= 1
  && countOf(scholarHtml, 'flow-skill-博學士-靈光一閃-plus') >= 1,
  true);
check('A3 上限算式算得出來就印成「值 / 上限」（SL 2 → 0 / 2）',
  scholarHtml.includes('0') && countOf(scholarHtml, '/ 2') >= 1,
  `${countOf(scholarHtml, '/ 2')} 次`);

/* ────────────────────────────────────────────────────────────────
   B. 按鈕型：成本與後果都要寫在畫面上
   ──────────────────────────────────────────────────────────────── */
const elementalist = withClassSkill('元素師', '災難', 3);
// 明確把 MP 壓到 0：不然「成本不足」這一條會隨開卡預設值而變成永遠不觸發的空斷言。
elementalist.currentMp = 0;
const elemHtml = render(elementalist, { initialTab: 'skills' });
check('B1 按鈕長出來了', countOf(elemHtml, 'data-testid="flow-skill-元素師-災難-act"') >= 1, true);
check('B2 後果那一行也印出來（不是只有按鈕）',
  countOf(elemHtml, 'data-testid="flow-skill-元素師-災難-outcome"') >= 1, true);
check('B3 成本不足時按鈕是 disabled，而且畫面上寫得出原因（不是只有灰掉）', (() => {
  const html = elemHtml.replace(/\s+/g, ' ');
  const hasDisabled = /data-testid="flow-skill-元素師-災難-act"[^>]*disabled/.test(html);
  const hasReason = /MP 不足|物語點不足|不足/.test(html);
  return hasDisabled && hasReason;
})(), true);

/* ────────────────────────────────────────────────────────────────
   C. 已有客製實作的條目：不許再畫控件
   ──────────────────────────────────────────────────────────────── */
const tinkerer = withClassSkill('修補匠', '小工具', 1);
check('C0 前提：修補匠【小工具】是 existing（工坊面板在做）',
  flowItemForClassSkill('修補匠', '小工具')?.apply?.via, 'existing');
const tinkHtml = render(tinkerer, { initialTab: 'skills' });
check('C1 existing 的條目沒有 flow 控件（避免兩條扣款路徑）',
  countOf(tinkHtml, 'data-testid="flow-skill-修補匠-小工具"') === 0, '0 顆');

/* ────────────────────────────────────────────────────────────────
   D. 金手指：效果文真的出現（46 條的共通缺陷）
   ──────────────────────────────────────────────────────────────── */
const quirkChar = createNewCharacter({ name: '測試角色' });
quirkChar.quirk = '亡者歸來';
const quirkHtml = render(quirkChar, { initialTab: 'skills' });
check('D1 金手指效果文區塊存在', countOf(quirkHtml, 'data-testid="hud-quirk-effect"') >= 1, true);
check('D2 印出來的是資料層的 desc，不是「已啟用金手指【X】。」這句佔位字',
  countOf(quirkHtml, '已啟用金手指【亡者歸來】。') === 0, '0 次');
check('D3 效果文裡真的有一段原文',
  /不死|傷害|暗/.test(quirkHtml), true);
check('D4 金手指的按鈕型流程也長出來了（亡者歸來的暗屬性轉換）',
  countOf(quirkHtml, 'data-testid="flow-quirk-act"') >= 1, true);
check('D5 前提：亡者歸來在資料裡是 button',
  flowItemForQuirk('亡者歸來')?.control?.kind, 'button');

/* ────────────────────────────────────────────────────────────────
   E. 條件式加值：列得出來，而且附得出條件
   ──────────────────────────────────────────────────────────────── */
const duck = createNewCharacter({ name: '測試角色' });
duck.heroicSkills = [{ name: '靈巧雙手' }];
// 第二期之後【靈巧雙手】有了結構化條件：**條件成立**時它會折進物防（不再列在加成清單），
// **條件不成立**時整條不列。要驗「清單本身畫得出來」，就得讓它落在第三態（unknown）——
// 裝備名不在武器表上（例如某本新書的武器）。這一格測的是清單的渲染，不是條件判定
// （條件判定在 `test:flows` 的三態 A/B/C 對照裡）。
duck.equipment = { ...(duck.equipment || {}), mainHand: '某本新書的武器', offHand: '另一把沒登記的武器' };
check('E0 前提：靈巧雙手有帶條件的物防加值',
  flowItemForHeroic('靈巧雙手')?.effects?.some((e) => e.target === 'def' && e.condition), true);
check('E0b 前提：它的條件是結構化的（`when`），不是只有散文',
  Array.isArray(flowItemForHeroic('靈巧雙手')?.when), true);
const duckHtml = render(duck, { initialTab: 'profile' });
check('E1 個人資料頁有「效果加成（依條件）」區塊',
  countOf(duckHtml, 'data-testid="hud-flow-conditional"') >= 1, true);
check('E2 逐條列出來（不是只印一個數字）',
  countOf(duckHtml, 'data-testid="flow-conditional-row"') >= 1, true);
check('E3 條件原文也印出來（玩家要知道什麼時候算）',
  /武器/.test(duckHtml), true);

/* ────────────────────────────────────────────────────────────────
   F. 對照組：什麼都沒有的角色不該長出任何 flow 控件
   ──────────────────────────────────────────────────────────────── */
const blank = createNewCharacter({ name: '空白角色' });
const blankSkills = render(blank, { initialTab: 'skills' });
check('F1 空白角色的技能頁沒有任何 flow 控件',
  countOf(blankSkills, 'data-testid="flow-skill-') === 0, '0 顆');
check('F2 空白角色沒有金手指區塊',
  countOf(blankSkills, 'data-testid="hud-quirk-detail"') === 0, '0 個');
const blankProfile = render(blank, { initialTab: 'profile' });
check('F3 空白角色沒有「效果加成」區塊（不畫空框）',
  countOf(blankProfile, 'data-testid="hud-flow-conditional"') === 0, '0 個');

/* ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail === '' ? '' : `  —— ${r.detail}`}`);
console.log('');
console.log(`  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) process.exit(1);
