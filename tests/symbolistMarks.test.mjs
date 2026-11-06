import {
  maxSymbolMarks,
  getSymbolMarks,
  canAddSymbolMark,
  addSymbolMark,
  removeSymbolMark,
  clearSymbolMarks,
  listSymbolMarkBearers
} from '../src/features/character-sheet/utils/symbolist.js';

let results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: detail || (ok ? '通過' : '失敗') });
};

// ── A. 上限計算與讀取 ──
check('A1 上限為 SL + 1（SL 1 -> 2）', maxSymbolMarks(1) === 2, String(maxSymbolMarks(1)));
check('A2 上限為 SL + 1（SL 3 -> 4）', maxSymbolMarks(3) === 4, String(maxSymbolMarks(3)));
check('A3 空角色回傳空陣列', getSymbolMarks({}).length === 0, '0');
check('A4 舊欄位相容（symbolistData.marks）', getSymbolMarks({ symbolistData: { marks: [{ id: '1' }] } }).length === 1, '1');

// ── B. 刻劃徽記與上限阻擋 ──
let char = { symbolMarks: [] };
check('B1 初始可刻劃徽記', canAddSymbolMark(char, 2) === true, '可刻劃');

const res1 = addSymbolMark(char, { symbolId: 'sym_binding', bearer: '艾莉絲', note: '前線防護' }, 1);
check('B2 刻劃第一個徽記成功', res1.ok === true && res1.character.symbolMarks.length === 1, '成功');
char = res1.character;

const res2 = addSymbolMark(char, { symbolId: 'sym_destiny', bearer: '自身' }, 1);
check('B3 刻劃第二個徽記成功（達 SL 1 上限 2）', res2.ok === true && res2.character.symbolMarks.length === 2, '成功');
char = res2.character;

check('B4 達上限後 canAddSymbolMark 為 false', canAddSymbolMark(char, 1) === false, '阻擋');

const res3 = addSymbolMark(char, { symbolId: 'sym_creation', bearer: '第三方' }, 1);
check('B5 超過上限時刻劃被拒絕且給出理由', res3.ok === false && res3.reason.includes('已達徽記維持上限'), res3.reason);

// ── C. 攜帶者名冊（咒語徽記依賴） ──
const bearers = listSymbolMarkBearers(char);
check('C1 正確列出所有不重複攜帶者（艾莉絲、自身）', bearers.includes('艾莉絲') && bearers.includes('自身') && bearers.length === 2, bearers.join(', '));

// ── D. 摧毀操作 ──
const markToRemove = char.symbolMarks[0].id;
const resDel = removeSymbolMark(char, markToRemove);
check('D1 成功摧毀單個徽記', resDel.ok === true && resDel.character.symbolMarks.length === 1, '剩餘 1 個');
char = resDel.character;

const resClear = clearSymbolMarks(char);
check('D2 成功清空所有維持中的徽記', resClear.ok === true && resClear.character.symbolMarks.length === 0 && resClear.count === 1, '清空');
char = resClear.character;

// ── E. HUD SSR 整合渲染 ──
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';

const symChar = createNewCharacter({ name: '測試徽記師' });
symChar.classes = [{
  className: '徽記師',
  level: 5,
  skills: [
    { name: '徽記學', sl: 2, selectedOptions: ['束縛徽記', '命運徽記', '制物徽記', '元素徽記'] },
    { name: '咒語徽記', sl: 1 }
  ]
}];
symChar.symbolMarks = [
  { id: 'm1', symbolId: 'sym_binding', symbolName: '束縛徽記', bearer: '瓦爾基麗', effect: '測試效果', createdAt: '' }
];

const symHtml = renderToStaticMarkup(
  React.createElement(CharacterPlayHUD, {
    character: symChar,
    onChange: () => {},
    onBackToRoster: () => {},
    onOpenEditor: () => {},
    showToast: () => {},
    initialTab: 'skills'
  })
);

check('E1 徽記學渲染實體追蹤面板（symbolist-marks-tracker）', symHtml.includes('data-testid="symbolist-marks-tracker"'), '有面板');
check('E2 徽記學面板顯示額度（1 / 3）', symHtml.includes('1 / 3'), '額度正確');
check('E3 徽記學面板渲染維持中徽記卡片（瓦爾基麗）', symHtml.includes('瓦爾基麗'), '有攜帶者');
check('E4 咒語徽記渲染攜帶者名冊（spell-mark-targets）', symHtml.includes('data-testid="spell-mark-targets"') && symHtml.includes('瓦爾基麗'), '受術名冊正確');

// ── 輸出 ──
const fails = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  —— ${r.detail}`);
}
console.log(`\n  通過 ${results.length - fails.length} / ${results.length}`);
if (fails.length > 0) process.exit(1);
