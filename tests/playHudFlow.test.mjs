import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import GourmetCookbook from '../src/features/character-sheet/components/companions/GourmetCookbook.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import {
  flowItemForClassSkill,
  flowItemForQuirk,
  flowItemForHeroic,
  characterFlowItems,
  controlsOf,
  resetFlowScope
} from '../src/features/character-sheet/utils/effectFlow.js';
import { chapterSettlementItems } from '../src/features/character-sheet/utils/chapterSettlement.js';
// SSR 的 disabled 判斷必須看「屬性」，不能看 `disabled:` 這個 Tailwind class（見 helper 檔頭）。
import { hasDisabledAttr } from './helpers/domAttr.mjs';

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
  // 用屬性判斷，不要用 `/…[^>]*disabled/`：class 裡的 `disabled:cursor-not-allowed`
  // 會讓「有 disabled」與「沒有 disabled」都命中（2026-11-04 驗收抓到的假綠）。
  const hasDisabled = hasDisabledAttr(elemHtml, 'flow-skill-元素師-災難-act');
  const hasReason = /MP 不足|物語點不足|不足/.test(elemHtml);
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
check('D1 金手指效果文區塊存在', countOf(quirkHtml, 'data-testid="hud-quirk-detail"') >= 1, true);
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

/* ────────────────────────────────────────────────────────────────
   G. W0 接線契約：重置範圍三按鈕、函式載入解析、營地整合與章節彈窗
   ──────────────────────────────────────────────────────────────── */
const hudHtml = render(blank, { initialTab: 'skills' });
check('G1 HUD 工具列有三顆重置按鈕（場景／休息／章節）',
  countOf(hudHtml, 'data-testid="reset-scope-scene"') >= 1 &&
  countOf(hudHtml, 'data-testid="reset-scope-rest"') >= 1 &&
  countOf(hudHtml, 'data-testid="reset-scope-chapter"') >= 1,
  true);

// 驗證 characterFlowItems 與 controlsOf 在實際呼叫時不拋錯（修復 ReferenceError 的真實調用證據）
let callItemsSucceeded = false;
try {
  const items = characterFlowItems(scholar);
  const totalControls = items.reduce((acc, ci) => acc + controlsOf(ci.item).length, 0);
  callItemsSucceeded = Array.isArray(items) && totalControls >= 0;
} catch {
  callItemsSucceeded = false;
}
check('G2 characterFlowItems 與 controlsOf 呼叫不拋錯且解析正常（A 項修復實測）', callItemsSucceeded, true);

// 驗證 resetFlowScope('rest') 會清除數值但保留 fields 容器
const testScopeChar = createNewCharacter({ name: '重置測試' });
testScopeChar.heroicSkills = [{ name: '內蘊源泉' }];
testScopeChar.flowState = {
  'heroic:內蘊源泉': {
    n: 3,
    on: true,
    picks: ['a'],
    fields: { customTitle: '源泉之名' }
  }
};
const resetChar = resetFlowScope(testScopeChar, 'rest');
const resetItemState = resetChar.flowState?.['heroic:內蘊源泉'];
check('G3 resetFlowScope("rest") 歸零數值狀態並保留 fields（B 項功能實測）',
  resetItemState?.n === 0 &&
  resetItemState?.on === false &&
  Array.isArray(resetItemState?.picks) && resetItemState.picks.length === 0 &&
  resetItemState?.fields?.customTitle === '源泉之名',
  true);

// 驗證章節結算待辦項目判定
const noSettlementChar = createNewCharacter({ name: '無結算角色' });
const richChar = createNewCharacter({ name: '富家子弟角色' });
richChar.quirk = '富家子弟';
check('G4 章節結算條目判定：無結算條目為空陣列（不彈窗），有結算金手指則返回結算清單（C 項）',
  chapterSettlementItems(noSettlementChar).length === 0 &&
  chapterSettlementItems(richChar).length === 1 &&
  chapterSettlementItems(richChar)[0].dice === '1d6',
  true);

/* ────────────────────────────────────────────────────────────────
   H. W1【富家子弟】HUD 接線整合：專屬面板、按鈕抑制與狀態連動
   ──────────────────────────────────────────────────────────────── */
const richHtml = render(richChar, { initialTab: 'skills' });
check('H1 富家子弟在 HUD 正確掛載 FlowDataPanel',
  countOf(richHtml, 'data-testid="flowdata-quirk-富家子弟"') >= 1,
  true);
check('H2 未填齊保鑣時 HUD 內的增益按鈕為 disabled',
  hasDisabledAttr(richHtml, 'flowdata-quirk-富家子弟-use-buff-careful'),
  true);
check('H3 通用按鈕成功被抑制（不與 FlowDataPanel 同時存在）',
  countOf(richHtml, 'data-testid="flow-quirk-act"') === 0,
  '0 顆');

/* ────────────────────────────────────────────────────────────────
   I. W2 金手指多控件與 reset 生命週期實測（杜絕假綠燈、嚴禁 class 判斷）
   ──────────────────────────────────────────────────────────────── */
// I1: 天才發明家具備多控件（按鈕 0：IP 成本歸 0 [reset: scene]，按鈕 1：自備造物零件）
const inventorItem = flowItemForQuirk('天才發明家');
const inventorCtrls = controlsOf(inventorItem);
check('I1 天才發明家具備 2 顆 controls 且 c0 標記 reset: scene',
  inventorCtrls.length === 2 &&
  inventorCtrls[0]?.reset === 'scene' &&
  inventorCtrls[1]?.cost?.fp === 1,
  true);

// I2: 失憶古賢具備 2 顆 controls（c0: button [reset: rest], c1: counter）
const amnesiacItem = flowItemForQuirk('失憶古賢');
const amnesiacCtrls = controlsOf(amnesiacItem);
check('I2 失憶古賢具備 2 顆 controls（按鈕重置為 rest，計數器為 none）',
  amnesiacCtrls.length === 2 &&
  amnesiacCtrls[0]?.kind === 'button' && amnesiacCtrls[0]?.reset === 'rest' &&
  amnesiacCtrls[1]?.kind === 'counter' && amnesiacCtrls[1]?.reset === 'none',
  true);

// I3: 跑團卡渲染多控件（測試天生發明家渲染出 c0 與 c1 控件）
const inventorChar = createNewCharacter({ name: '發明家角色' });
inventorChar.quirk = '天才發明家';
const inventorHtml = render(inventorChar, { initialTab: 'skills' });
check('I3 跑團卡成功渲染天才發明家多控件（flow-quirk-c0 與 flow-quirk-c1）',
  countOf(inventorHtml, 'data-testid="flow-quirk-c0"') >= 1 &&
  countOf(inventorHtml, 'data-testid="flow-quirk-c1"') >= 1,
  true);

// I4: 未使用時，c0 按鈕為 enabled（hasDisabledAttr 為 false）
check('I4 天才發明家 c0 按鈕初始為可點擊狀態（hasDisabledAttr 為 false）',
  !hasDisabledAttr(inventorHtml, 'flow-quirk-c0-act'),
  true);

// I5: 使用過後，c0 按鈕變為 disabled（hasDisabledAttr 為 true），且畫面上寫明上限原因
const usedInventorChar = {
  ...inventorChar,
  flowState: {
    'quirk:天才發明家': { n: 1, on: true, fields: { _uses: { 0: 1 } } }
  }
};
const usedInventorHtml = render(usedInventorChar, { initialTab: 'skills' });
check('I5 使用過後的天才發明家 c0 按鈕為 disabled（hasDisabledAttr 檢驗）',
  hasDisabledAttr(usedInventorHtml, 'flow-quirk-c0-act'),
  true);
check('I6 使用過後的按鈕下方顯示上限原因文案',
  /使用次數已達上限.*等.*重置/.test(usedInventorHtml),
  true);

// I7: 點擊場景重置（resetFlowScope("scene")）後，按鈕恢復為 enabled！不再有「永遠不重置」的按鈕
const resetInventorChar = resetFlowScope(usedInventorChar, 'scene');
const resetInventorHtml = render(resetInventorChar, { initialTab: 'skills' });
check('I7 場景重置後，天才發明家按鈕恢復為 enabled（hasDisabledAttr 為 false）',
  !hasDisabledAttr(resetInventorHtml, 'flow-quirk-c0-act'),
  true);

// I8: 失憶古賢：使用後按鈕 disabled，休息重置（resetFlowScope("rest")）後恢復 enabled
const usedAmnesiacChar = createNewCharacter({ name: '古賢角色' });
usedAmnesiacChar.quirk = '失憶古賢';
usedAmnesiacChar.flowState = {
  'quirk:失憶古賢': { n: 1, on: true, fields: { _uses: { 0: 1 } } }
};
const usedAmnesiacHtml = render(usedAmnesiacChar, { initialTab: 'skills' });
check('I8 失憶古賢使用後按鈕為 disabled（hasDisabledAttr 檢驗）',
  hasDisabledAttr(usedAmnesiacHtml, 'flow-quirk-c0-act'),
  true);

const restAmnesiacChar = resetFlowScope(usedAmnesiacChar, 'rest');
const restAmnesiacHtml = render(restAmnesiacChar, { initialTab: 'skills' });
check('I9 休息重置後，失憶古賢按鈕恢復為 enabled（hasDisabledAttr 為 false）',
  !hasDisabledAttr(restAmnesiacHtml, 'flow-quirk-c0-act'),
  true);

// I10: Toggle 重置：新人類在場景重置後自動關閉
const newHumanChar = createNewCharacter({ name: '新人類角色' });
newHumanChar.quirk = '新人類';
newHumanChar.flowState = {
  'quirk:新人類': { n: 0, on: true }
};
const resetNewHumanChar = resetFlowScope(newHumanChar, 'scene');
check('I10 新人類 toggle 在場景重置後關閉（on: false）',
  resetNewHumanChar.flowState?.['quirk:新人類']?.on === false,
  true);

// I11: Toggle 重置：老載具在章節重置後自動關閉
const vehicleChar = createNewCharacter({ name: '載具角色' });
vehicleChar.quirk = '老載具';
vehicleChar.flowState = {
  'quirk:老載具': { n: 0, on: true }
};
const resetVehicleChar = resetFlowScope(vehicleChar, 'chapter');
check('I11 老載具 toggle 在章節重置後關閉（on: false）',
  resetVehicleChar.flowState?.['quirk:老載具']?.on === false,
  true);

/* ────────────────────────────────────────────────────────────────
   J. 三種新控件的**內部** testid（Lead 補）
   ──────────────────────────────────────────────────────────────── */
// 為什麼要守這一組：`multiSelect`／`text`／`recordList` 原本只有外層容器有 testid，
// 於是「選項有沒有 disabled」「輸入框在不在」只能靠文字判斷——而文字斷言會隨文案漂。
const dreamChar = createNewCharacter({ name: '大夢角色' });
dreamChar.quirk = '大夢一場';
const dreamHtml = render(dreamChar, { initialTab: 'skills' });
check('J1 text 控件的輸入框有自己的 testid（c1-input 或 c1-textarea）',
  countOf(dreamHtml, 'data-testid="flow-quirk-c1-input"') >= 1
  || countOf(dreamHtml, 'data-testid="flow-quirk-c1-textarea"') >= 1,
  true);
check('J2 計數器的加減鈕仍然存在（c0）',
  countOf(dreamHtml, 'data-testid="flow-quirk-c0-plus"') >= 1,
  true);

/* ────────────────────────────────────────────────────────────────
   K. W4 G1 英雄技能單選下拉與持久化驗證
   ──────────────────────────────────────────────────────────────── */
const auraChar = createNewCharacter({ name: '靈氣角色' });
auraChar.heroicSkills = ['靈氣掌握'];
auraChar.flowState = {
  'heroic:靈氣掌握': { choice: '火' }
};
const auraHtml = render(auraChar, { initialTab: 'skills' });
check('K1 跑團卡成功渲染靈氣掌握下拉選單（flow-heroic-0-choice）',
  countOf(auraHtml, 'data-testid="flow-heroic-0-choice"') >= 1,
  true);
check('K2 靈氣掌握下拉選項包含風、電、土、火、冰、光 6 個選項',
  countOf(auraHtml, '<option value="火"') >= 1 && countOf(auraHtml, '<option value="光"') >= 1,
  true);
check('K3 下拉選單選中先前儲存之 choice: 火',
  countOf(auraHtml, 'value="火" selected') >= 1 || auraHtml.includes('<option value="火" selected'),
  true);

const sourceChar = createNewCharacter({ name: '源泉角色' });
sourceChar.heroicSkills = ['內蘊源泉'];
sourceChar.flowState = {
  'heroic:內蘊源泉': { choice: '冰' }
};
const resetSourceChar = resetFlowScope(sourceChar, 'rest');
check('K4 內蘊源泉在休息重置後清空 choice（等待重選）',
  resetSourceChar.flowState?.['heroic:內蘊源泉']?.choice === '',
  true);

/* ────────────────────────────────────────────────────────────────
   L. W4 G2 英雄技能多選控件（multiSelect）與狀態持久化驗證
   ──────────────────────────────────────────────────────────────── */
// L1: 嵌合術精通（multiSelect 渲染、選項存在與已選標記）
const chimeristChar = createNewCharacter({ name: '嵌合角色' });
chimeristChar.heroicSkills = ['嵌合術精通'];
chimeristChar.flowState = {
  'heroic:嵌合術精通': { picks: ['惡魔', '元素'] }
};
const chimeristHtml = render(chimeristChar, { initialTab: 'skills' });
check('L1 跑團卡渲染嵌合術精通多選控件（flow-heroic-0）',
  countOf(chimeristHtml, 'data-testid="flow-heroic-0"') >= 1,
  true);
check('L2 嵌合術精通計數與已選狀態（已選 2 / 2，且惡魔已勾選）',
  chimeristHtml.includes('已選 2 / 2') && chimeristHtml.includes('✓ 惡魔'),
  true);
check('L3 選滿 2 項時，其餘未選選項（構裝體、不死）為 disabled',
  hasDisabledAttr(chimeristHtml, 'flow-heroic-0-opt-構裝體') && hasDisabledAttr(chimeristHtml, 'flow-heroic-0-opt-不死'),
  true);

// L4: 穩固突變（休息重置後清空 picks）
const mutantChar = createNewCharacter({ name: '突變角色' });
mutantChar.heroicSkills = ['穩固突變'];
mutantChar.flowState = {
  'heroic:穩固突變': { picks: ['兩棲形態', '疊甲形態'] }
};
const resetMutantChar = resetFlowScope(mutantChar, 'rest');
check('L4 穩固突變在休息重置後清空 picks（等待重選）',
  Array.isArray(resetMutantChar.flowState?.['heroic:穩固突變']?.picks) &&
  resetMutantChar.flowState['heroic:穩固突變'].picks.length === 0,
  true);

// L5: 樸實之力（屬性選項存在與選滿 2 個時停用其餘）
const simpleChar = createNewCharacter({ name: '樸實角色' });
simpleChar.heroicSkills = ['樸實之力'];
simpleChar.flowState = {
  'heroic:樸實之力': { picks: ['力量', '意志'] }
};
const simpleHtml = render(simpleChar, { initialTab: 'skills' });
check('L5 樸實之力渲染 4 項屬性且已選 2 / 2',
  simpleHtml.includes('已選 2 / 2') &&
  hasDisabledAttr(simpleHtml, 'flow-heroic-0-opt-靈巧') &&
  hasDisabledAttr(simpleHtml, 'flow-heroic-0-opt-洞察'),
  true);

// L6: 本店特色（五風味選項與已選三種）
const deliChar = createNewCharacter({ name: '美食角色' });
deliChar.heroicSkills = ['本店特色'];
deliChar.flowState = {
  'heroic:本店特色': { picks: ['甜味', '鮮味'] }
};
const deliHtml = render(deliChar, { initialTab: 'skills' });
check('L6 本店特色未選滿時其餘選項非 disabled（已選 2 / 3）',
  deliHtml.includes('已選 2 / 3') &&
  !hasDisabledAttr(deliHtml, 'flow-heroic-0-opt-苦味'),
  true);

/* ────────────────────────────────────────────────────────────────
   M. W4 G3 自由文字與多控件（toggle/button + text）驗證
   ──────────────────────────────────────────────────────────────── */
// M1: 主題曲（演奏 toggle + 曲名 text 輸入框）
const themeChar = createNewCharacter({ name: '主題曲角色' });
themeChar.heroicSkills = ['主題曲'];
themeChar.flowState = {
  'heroic:主題曲': { on: true, text: '勝利之歌・光音調' }
};
const themeHtml = render(themeChar, { initialTab: 'skills' });
check('M1 跑團卡渲染主題曲演奏 toggle（flow-heroic-0-c0）與文字框（flow-heroic-0-c1-input）',
  countOf(themeHtml, 'data-testid="flow-heroic-0-c0"') >= 1 &&
  countOf(themeHtml, 'data-testid="flow-heroic-0-c1-input"') >= 1,
  true);
check('M2 主題曲文字框保存先前填入之曲名文字',
  themeHtml.includes('value="勝利之歌・光音調"'),
  true);

// M3: 儀式印記（場景重置時關閉 toggle 但保留填寫條件 text）
const markChar = createNewCharacter({ name: '印記角色' });
markChar.heroicSkills = ['儀式印記'];
markChar.flowState = {
  'heroic:儀式印記': { on: true, text: '當我進入危機時' }
};
const resetMarkChar = resetFlowScope(markChar, 'scene');
check('M3 儀式印記在場景重置後關閉 toggle 但完整保留觸發條件文字',
  resetMarkChar.flowState?.['heroic:儀式印記']?.on === false &&
  resetMarkChar.flowState?.['heroic:儀式印記']?.text === '當我進入危機時',
  true);

// M4: 啟示（按鈕與多行備註 textarea）
const revChar = createNewCharacter({ name: '啟示角色' });
revChar.heroicSkills = ['啟示'];
revChar.flowState = {
  'heroic:啟示': { text: '未知阿爾卡納：時光領主' }
};
const revHtml = render(revChar, { initialTab: 'skills' });
check('M4 跑團卡渲染啟示按鈕（c0）與多行 textarea（c1-textarea）',
  countOf(revHtml, 'data-testid="flow-heroic-0-c0"') >= 1 &&
  countOf(revHtml, 'data-testid="flow-heroic-0-c1-textarea"') >= 1,
  true);

/* ────────────────────────────────────────────────────────────────
   N. W4 G4 子實體卡（偉大召喚 & 偉大召喚【變體】）驗證
   ──────────────────────────────────────────────────────────────── */
// N1: 偉大召喚初始狀態（無顯現體記錄時渲染空提示與設定按鈕）
const summonChar = createNewCharacter({ name: '召喚角色' });
summonChar.heroicSkills = ['偉大召喚'];
const summonHtml = render(summonChar, { initialTab: 'skills' });
check('N1 偉大召喚初始渲染空狀態提示與設定按鈕',
  countOf(summonHtml, 'data-testid="avatar-empty-hint"') >= 1 &&
  countOf(summonHtml, 'data-testid="avatar-create-btn"') >= 1,
  true);

// N2: 偉大召喚已有記錄（渲染顯現體卡片、等級、抗性、攻擊公式與召喚按鈕）
const boundSummonChar = createNewCharacter({ name: '契約角色' });
boundSummonChar.heroicSkills = ['偉大召喚'];
boundSummonChar.flowState = {
  'heroic:偉大召喚': {
    list: [
      {
        id: 'avatar_1',
        arcanumName: '雷霆',
        choices: {
          arcanumName: '雷霆',
          attrD10: 'mig',
          resistances: ['電', '火'],
          checkAttrs: ['mig', 'wlp'],
          features: ['damage_bonus', 'custom_type'],
          damageType: '電'
        },
        active: false,
        currentHp: 36,
        maxHp: 36
      }
    ]
  }
};
const boundHtml = render(boundSummonChar, { initialTab: 'skills' });
check('N2 渲染已記錄顯現體之卡片、抗性徽章與召喚按鈕',
  countOf(boundHtml, 'data-testid="avatar-display"') >= 1 &&
  countOf(boundHtml, 'data-testid="avatar-summon-btn"') >= 1 &&
  boundHtml.includes('【雷霆】顯現體') &&
  boundHtml.includes('【HR + 12】'),
  true);

// N3: 偉大召喚【變體】額外渲染脈衝授權說明
const varSummonChar = createNewCharacter({ name: '變體召喚角色' });
varSummonChar.heroicSkills = ['偉大召喚【變體】'];
varSummonChar.flowState = {
  'heroic:偉大召喚【變體】': {
    list: [
      {
        id: 'avatar_v1',
        arcanumName: '劍',
        choices: {
          arcanumName: '劍',
          attrD10: 'dex',
          resistances: ['物理', '光'],
          checkAttrs: ['dex', 'ins'],
          features: ['ranged', 'damage_bonus'],
          damageType: '物理'
        },
        active: false,
        currentHp: 40,
        maxHp: 40
      }
    ]
  }
};
const varSummonHtml = render(varSummonChar, { initialTab: 'skills' });
check('N3 偉大召喚【變體】渲染脈衝授權與快速召喚互斥提示',
  varSummonHtml.includes('脈衝授權') &&
  varSummonHtml.includes('若使用【快速召喚】則不可使用本技能'),
  true);

/* ────────────────────────────────────────────────────────────────
   O. W4 G5 清單型（陷阱大師、模擬同化、地城主廚、為了更美好的未來）驗證
   ──────────────────────────────────────────────────────────────── */
// O1: 陷阱大師（計數器與清單新增）
const trapChar = createNewCharacter({ name: '陷阱角色' });
trapChar.heroicSkills = ['陷阱大師'];
trapChar.flowState = {
  'heroic:陷阱大師': {
    n: 1,
    list: [
      { id: 'trap_1', type: '火', status: '眩暈', trigger: '移動' }
    ]
  }
};
const trapHtml = render(trapChar, { initialTab: 'skills' });
check('O1 陷阱大師渲染計數器（c0）與清單控件（c1-add）及已布設陷阱記錄',
  countOf(trapHtml, 'data-testid="flow-heroic-0-c0-plus"') >= 1 &&
  countOf(trapHtml, 'data-testid="flow-heroic-0-c1-add"') >= 1 &&
  countOf(trapHtml, 'data-testid="flow-heroic-0-c1-record-0"') >= 1,
  true);

// O2: 模擬同化（按鈕與咒語清單）
const simChar = createNewCharacter({ name: '模擬角色' });
simChar.heroicSkills = ['模擬同化'];
simChar.flowState = {
  'heroic:模擬同化': {
    list: [
      { id: 'sim_1', spellName: '龍息術', sourceEnemy: '火龍（惡魔）' }
    ]
  }
};
const simHtml = render(simChar, { initialTab: 'skills' });
check('O2 模擬同化渲染按鈕（c0-act）與同化咒語名冊（c1-add）',
  countOf(simHtml, 'data-testid="flow-heroic-0-c0-act"') >= 1 &&
  countOf(simHtml, 'data-testid="flow-heroic-0-c1-add"') >= 1 &&
  simHtml.includes('value="龍息術"'),
  true);

// O3: 地城主廚（按鈕與敵人名冊）
const chefChar = createNewCharacter({ name: '主廚角色' });
chefChar.heroicSkills = ['地城主廚'];
chefChar.flowState = {
  'heroic:地城主廚': {
    list: [
      { id: 'chef_1', enemy: '石像鬼', flavor: '鹹味' }
    ]
  }
};
const chefHtml = render(chefChar, { initialTab: 'skills' });
check('O3 地城主廚渲染按鈕（c0-act）與已用敵人名冊（c1-add）及敵人物種欄位',
  countOf(chefHtml, 'data-testid="flow-heroic-0-c0-act"') >= 1 &&
  countOf(chefHtml, 'data-testid="flow-heroic-0-c1-add"') >= 1 &&
  countOf(chefHtml, 'data-testid="flow-heroic-0-c1-field-0-enemy"') >= 1 &&
  chefHtml.includes('value="石像鬼"'),
  true);

// O4: 為了更美好的未來（繁榮度計數器與受資助聚落名冊）
const futureChar = createNewCharacter({ name: '未來角色' });
futureChar.heroicSkills = ['為了更美好的未來'];
futureChar.flowState = {
  'heroic:為了更美好的未來': {
    n: 2,
    list: [
      { id: 'set_1', town: '邊境綠洲', prosperity: '12' }
    ]
  }
};
const futureHtml = render(futureChar, { initialTab: 'skills' });
check('O4 為了更美好的未來渲染繁榮度計數器（c0）與受資助名冊（c1-add）及聚落欄位',
  countOf(futureHtml, 'data-testid="flow-heroic-0-c0-plus"') >= 1 &&
  countOf(futureHtml, 'data-testid="flow-heroic-0-c1-add"') >= 1 &&
  countOf(futureHtml, 'data-testid="flow-heroic-0-c1-field-0-town"') >= 1 &&
  futureHtml.includes('value="邊境綠洲"'),
  true);

/* ────────────────────────────────────────────────────────────────
   P. W4 G6 額度型（大吃一頓）驗證
   ──────────────────────────────────────────────────────────────── */
// P1: 大吃一頓在跑團卡上渲染每場景一次計數器
const feastChar = createNewCharacter({ name: '大胃角色' });
feastChar.heroicSkills = ['大吃一頓'];
feastChar.flowState = {
  'heroic:大吃一頓': { n: 1 }
};
const feastHtml = render(feastChar, { initialTab: 'skills' });
check('P1 大吃一頓渲染計數器（flow-heroic-0-plus）且上限為 1',
  countOf(feastHtml, 'data-testid="flow-heroic-0-plus"') >= 1 &&
  countOf(feastHtml, 'data-testid="flow-heroic-0-value"') >= 1 &&
  feastHtml.includes('/ 1'),
  true);

// P2: 場景重置清空大吃一頓的使用次數
const resetFeastChar = resetFlowScope(feastChar, 'scene');
check('P2 場景重置清空大吃一頓的使用計數（n 回歸 0）',
  resetFeastChar.flowState?.['heroic:大吃一頓']?.n === 0,
  true);

// P3: 美食家工坊食材上限受【大吃一頓】英雄技能放寬至 4 份
const normalGourmetChar = createNewCharacter({ name: '一般美食家' });
normalGourmetChar.classes = [{ className: '美食家', level: 5, skills: [{ name: '烹飪', sl: 2 }] }];
normalGourmetChar.gourmetData = {
  ingredients: [
    { id: 'i1', name: '香菇', taste: '苦味' },
    { id: 'i2', name: '野莓', taste: '酸味' }
  ]
};
const normalGourmetHtml = renderToStaticMarkup(
  React.createElement(GourmetCookbook, { character: normalGourmetChar, initialSubTab: 'cook', onChange: () => {} })
);

const feastGourmetChar = {
  ...normalGourmetChar,
  heroicSkills: ['大吃一頓']
};
const feastGourmetHtml = renderToStaticMarkup(
  React.createElement(GourmetCookbook, { character: feastGourmetChar, initialSubTab: 'cook', onChange: () => {} })
);

check('P3 美食家工坊烹飪食材上限：普通 3 份，具備【大吃一頓】放寬至 4 份',
  normalGourmetHtml.includes('選擇 2～3 份食材') &&
  feastGourmetHtml.includes('選擇 2～4 份食材'),
  true);

/* ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail === '' ? '' : `  —— ${r.detail}`}`);
console.log('');
console.log(`  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) process.exit(1);
