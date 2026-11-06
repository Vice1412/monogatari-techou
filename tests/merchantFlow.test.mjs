/**
 * 商人 4 筆技能（C3 貿易池收斂）的流程與扣款護欄。
 *
 * 核心驗證：
 *  A. 4 筆條目存在、apply.via 為 flow-control，且不含 counter 控件。
 *  B. 【貿易之風】：花費 2 點扣款與不足阻擋；休息結算 +【SL + 1】貿易點數（夾至 SL+3）。
 *  C. 【真正的財富】：每環節一次獲得【SL + 1】貿易點數。
 *  D. 【我聽說過】與【小金庫】：扣除 1 點貿易點數。
 *  E. 跑團卡 SSR 渲染：按鈕正確渲染，零冗餘計數器。
 *
 * 執行：npm run test:merchantflow
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import effectFlows from '../src/features/character-sheet/data/effectFlows.json';
import {
  flowItemById,
  flowActionPlan,
  resetFlowScope
} from '../src/features/character-sheet/utils/effectFlow.js';
import SkillFlowControls from '../src/features/character-sheet/components/SkillFlowControls.jsx';

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

// ─────────────────────────────────────────────────────────── A
section('A. 4 筆商人條目結構與 controls（收斂至 tradePoints，零 counter）');
const MERCHANT_IDS = [
  'class:商人:貿易之風',
  'class:商人:真正的財富',
  'class:商人:我聽說過',
  'class:商人:小金庫'
];

for (const id of MERCHANT_IDS) {
  const item = flowItemById(id);
  check(`${id} 條目存在`, Boolean(item), true);
  check(`${id} apply.via 為 flow-control`, item?.apply?.via, 'flow-control');
  const kinds = (item?.controls || []).map((c) => c.kind);
  check(`${id} 控件不含 counter（零假計數器）`, kinds.includes('counter'), false);
  check(`${id} 全部為 button 控件`, kinds.every((k) => k === 'button'), true);
}

// ─────────────────────────────────────────────────────────── B
section('B. 【貿易之風】花費 2 點與休息結算');
const twItem = flowItemById('class:商人:貿易之風');

// 1. 花費 2 點阻擋
const charTwLow = {
  classes: [{ className: '商人', skills: [{ name: '貿易之風', sl: 2 }] }],
  classResources: { tradePoints: 1 }
};
const planTwLow = flowActionPlan(twItem, charTwLow, { sl: 2, controlIndex: 0 });
check('貿易點數只有 1 時花費 2 點被擋', planTwLow.ok, false);
check('被擋理由提示貿易點數不足', planTwLow.reason?.includes('貿易點數'), true);

// 2. 花費 2 點成功
const charTwHigh = {
  classes: [{ className: '商人', skills: [{ name: '貿易之風', sl: 2 }] }],
  classResources: { tradePoints: 4 }
};
const planTwSuccess = flowActionPlan(twItem, charTwHigh, { sl: 2, controlIndex: 0 });
check('貿易點數充足時計畫成功', planTwSuccess.ok, true);
check('貿易點數扣除 2 點（4 -> 2）', planTwSuccess.patch.classResources?.tradePoints, 2);

// 3. 休息結算：增加 SL+1 點數（SL=2 增加 3 點），受限於上限 SL+3 = 5
const charTwRest = {
  classes: [{ className: '商人', skills: [{ name: '貿易之風', sl: 2 }] }],
  classResources: { tradePoints: 3 }
};
const planTwRest = flowActionPlan(twItem, charTwRest, { sl: 2, controlIndex: 1 });
check('休息結算計畫成功', planTwRest.ok, true);
// 3 + 3 = 6，但上限是 2 + 3 = 5
check('休息結算增加並夾至上限（3 + 3 -> 5）', planTwRest.patch.classResources?.tradePoints, 5);

// ─────────────────────────────────────────────────────────── C
section('C. 【真正的財富】：每環節一次獲得【SL + 1】貿易點數');
const rwItem = flowItemById('class:商人:真正的財富');
const charRw = {
  classes: [{ className: '商人', skills: [{ name: '真正的財富', sl: 2 }, { name: '貿易之風', sl: 2 }] }],
  classResources: { tradePoints: 1 }
};
const planRw1 = flowActionPlan(rwItem, charRw, { sl: 2, controlIndex: 0 });
check('真正的財富計畫執行成功', planRw1.ok, true);
check('貿易點數增加 3 點（1 -> 4）', planRw1.patch.classResources?.tradePoints, 4);

// 模擬已使用過
const charRwUsed = {
  ...charRw,
  flowState: planRw1.patch.flowState
};
const planRwBlocked = flowActionPlan(rwItem, charRwUsed, { sl: 2, controlIndex: 0 });
check('本環節再次點擊時被擋', planRwBlocked.ok, false);
check('被擋理由提示等「遊戲環節」重置', planRwBlocked.reason?.includes('遊戲環節'), true);

// ─────────────────────────────────────────────────────────── D
section('D. 【我聽說過】與【小金庫】：扣除 1 點貿易點數');
const hiItem = flowItemById('class:商人:我聽說過');
const mvItem = flowItemById('class:商人:小金庫');

const charZero = {
  classes: [{ className: '商人', skills: [{ name: '我聽說過', sl: 1 }, { name: '小金庫', sl: 1 }] }],
  classResources: { tradePoints: 0 }
};
check('點數為 0 時【我聽說過】被擋', flowActionPlan(hiItem, charZero, { sl: 1 }).ok, false);
check('點數為 0 時【小金庫】被擋', flowActionPlan(mvItem, charZero, { sl: 1 }).ok, false);

const charTwo = {
  classes: [{ className: '商人', skills: [{ name: '我聽說過', sl: 1 }, { name: '小金庫', sl: 1 }] }],
  classResources: { tradePoints: 2 }
};
const planHi = flowActionPlan(hiItem, charTwo, { sl: 1 });
check('【我聽說過】計畫成功', planHi.ok, true);
check('【我聽說過】扣除 1 點貿易點數（2 -> 1）', planHi.patch.classResources?.tradePoints, 1);

const planMv = flowActionPlan(mvItem, charTwo, { sl: 1 });
check('【小金庫】計畫成功', planMv.ok, true);
check('【小金庫】扣除 1 點貿易點數（2 -> 1）', planMv.patch.classResources?.tradePoints, 1);

// ─────────────────────────────────────────────────────────── E
section('E. 跑團卡 SSR 渲染：按鈕正確呈現且無計數器');
const renderSkillControls = (item, char) => renderToStaticMarkup(
  React.createElement(SkillFlowControls, {
    item,
    character: char,
    flowState: char.flowState || {},
    onCommitPlan: () => {}
  })
);

const htmlTw = renderSkillControls(twItem, charTwHigh);
check('貿易之風渲染出花費 2 點按鈕', htmlTw.includes('花費 2 點'), true);
check('貿易之風渲染出休息結算按鈕', htmlTw.includes('休息結算'), true);
check('貿易之風不包含 counter 數字輸入框', htmlTw.includes('type="number"'), false);

const htmlHi = renderSkillControls(hiItem, charTwo);
check('我聽說過渲染出花費 1 點按鈕', htmlHi.includes('花費 1 點'), true);
check('我聽說過不包含 counter 數字輸入框', htmlHi.includes('type="number"'), false);

// ─────────────────────────────────────────────────────────── 收尾
console.log(lines.join('\n'));
console.log(`\n通過 ${pass}，失敗 ${fail}`);
if (fail > 0) process.exit(1);

