/**
 * 通用流程資料層測試（flowData.test.mjs）
 * 涵蓋 W0 先行件與通用架構（至少 25 條斷言）。
 * 執行：npm run test:flowdata
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// SSR 的 disabled 判斷必須看「屬性」，不能看 `disabled:` 這個 Tailwind class（見 helper 檔頭）。
import { hasDisabledAttr, hasTestId } from './helpers/domAttr.mjs';

import {
  FLOW_DATA_SPECS,
  specFor,
  normalizeFlowEntry,
  readEntry,
  recordIssues,
  isEntryComplete,
  setRecord,
  addRecord,
  removeRecord,
  togglePick,
  setText,
  upsertListRecord,
  removeListRecord,
  canUseBuff,
  planBuffUse,
  planSettlement,
  getForesightSL,
  deriveUpgradePaid,
  applyUpgradeDraft
} from '../src/features/character-sheet/utils/flowData.js';

import { CLASS_RESOURCES } from '../src/features/character-sheet/data/classResources.js';
import { chapterSettlementItems, planChapterSettlement } from '../src/features/character-sheet/utils/chapterSettlement.js';
import ChapterSettlementModal, { ChapterSettlementPanelBody } from '../src/features/character-sheet/components/ChapterSettlementPanel.jsx';
import FlowDataPanel from '../src/features/character-sheet/components/FlowDataPanel.jsx';
import { resetFlowScope } from '../src/features/character-sheet/utils/effectFlow.js';

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

const mkChar = (over = {}) => ({
  level: 5,
  quirk: '富家子弟',
  classes: [],
  classResources: { fatigue: 0 },
  flowState: {},
  ...over
});

const ITEM_ID = 'quirk:富家子弟';
const SPEC = specFor(ITEM_ID);

// ─────────────────────────────────────────────────────────── A
section('A. normalizeFlowEntry：容錯與形狀');
check('缺 flowState 回預設', normalizeFlowEntry({}, ITEM_ID), {
  n: 0, on: false, choice: '', fields: {}, picks: [], text: '', list: []
});
check('null 角色回預設', normalizeFlowEntry(null, ITEM_ID), {
  n: 0, on: false, choice: '', fields: {}, picks: [], text: '', list: []
});
check('非物件的 flowState 回預設', normalizeFlowEntry({ flowState: 'corrupted' }, ITEM_ID), {
  n: 0, on: false, choice: '', fields: {}, picks: [], text: '', list: []
});
check('保留合法欄位', normalizeFlowEntry({ flowState: { [ITEM_ID]: { n: 2, on: true, text: 'hello' } } }, ITEM_ID).text, 'hello');

// ─────────────────────────────────────────────────────────── B
section('B. recordIssues 與 isEntryComplete：名冊驗證');
const emptyEntry = { records: [] };
check('少於 min（需要 2 位）報錯', recordIssues(SPEC, emptyEntry).some((i) => i.message.includes('至少 2 位')), true);
const oneRecord = { records: [{ name: '阿福', look: '' }] };
check('缺外表（look）欄位報錯', recordIssues(SPEC, oneRecord).some((i) => i.field === 'look'), true);
const completeEntry = {
  records: [
    { name: '阿福', look: '光頭、有燒傷' },
    { name: '小滿', look: '矮小、戴圍巾' }
  ]
};
check('資料齊備時 issues 為空', recordIssues(SPEC, completeEntry), []);
check('資料齊備時 isEntryComplete 為 true', isEntryComplete(SPEC, completeEntry), true);
const tooManyRecords = {
  records: [
    { name: 'A', look: 'L1' },
    { name: 'B', look: 'L2' },
    { name: 'C', look: 'L3' }
  ]
};
check('超過 max 報錯', recordIssues(SPEC, tooManyRecords).some((i) => i.message.includes('最多僅能')), true);

// ─────────────────────────────────────────────────────────── C
section('C. canUseBuff：門檻與疲勞刻度');
const charIncomplete = mkChar();
const canUseIncomplete = canUseBuff(charIncomplete, ITEM_ID, 'careful');
check('未填齊名冊時 canUseBuff 為 false', canUseIncomplete.ok, false);
check('未填齊時理由含「保鑣」', canUseIncomplete.reason.includes('保鑣'), true);

const charComplete = mkChar({
  flowState: {
    [ITEM_ID]: {
      fields: {
        保鑣: [
          { name: '阿福', look: '身材魁梧' },
          { name: '小滿', look: '身形敏捷' }
        ]
      }
    }
  },
  classResources: { fatigue: 7 }
});
check('資料齊且疲勞未達 10 時可使用', canUseBuff(charComplete, ITEM_ID, 'careful').ok, true);

const charTired = mkChar({
  ...charComplete,
  classResources: { fatigue: 10 }
});
const canUseTired = canUseBuff(charTired, ITEM_ID, 'careful');
check('疲勞達 10 時不可使用', canUseTired.ok, false);
check('疲勞達 10 時理由含「10」', canUseTired.reason.includes('10'), true);

const charNoFatigue = mkChar({
  ...charComplete,
  classResources: {}
});
check('舊存檔缺少 fatigue 欄位時視為 0（可使用）', canUseBuff(charNoFatigue, ITEM_ID, 'careful').ok, true);

// ─────────────────────────────────────────────────────────── D
section('D. planBuffUse：擲骰式增益計算');
check('未傳入 roll 時回 ok:false（不自行擲骰）', planBuffUse(charComplete, ITEM_ID, 'careful').ok, false);
const buffPlan = planBuffUse(charComplete, ITEM_ID, 'careful', { roll: 4 });
check('roll=4 時 fatigue 由 7 變為 10（夾上限 10）', buffPlan.patch?.classResources?.fatigue, 10);
check('log.title 非空', !!buffPlan.log?.title, true);
check('log.kind 為 quirk', buffPlan.log?.kind, 'quirk');

const charNine = mkChar({ ...charComplete, classResources: { fatigue: 9 } });
const buffPlanClamped = planBuffUse(charNine, ITEM_ID, 'careful', { roll: 5 });
check('9 + 5 夾在上限 10', buffPlanClamped.patch?.classResources?.fatigue, 10);

// ─────────────────────────────────────────────────────────── E
section('E. planSettlement：週期結算');
check('結算未傳入 roll 時回 ok:false', planSettlement(charComplete, ITEM_ID, 'chapter').ok, false);
const settlePlan1 = planSettlement(charComplete, ITEM_ID, 'chapter', { roll: 2 });
check('疲勞 7 − 2 = 5', settlePlan1.patch?.classResources?.fatigue, 5);
const charLowFatigue = mkChar({ ...charComplete, classResources: { fatigue: 3 } });
const settlePlan2 = planSettlement(charLowFatigue, ITEM_ID, 'chapter', { roll: 6 });
check('疲勞 3 − 6 夾在最低 0（不變負數）', settlePlan2.patch?.classResources?.fatigue, 0);

// ─────────────────────────────────────────────────────────── F
section('F. 不可變性（Immutability）');
const originalChar = mkChar({
  flowState: { [ITEM_ID]: { fields: { 保鑣: [{ name: 'A', look: 'B' }] } } }
});
const snap = JSON.stringify(originalChar);
addRecord(originalChar, ITEM_ID);
setRecord(originalChar, ITEM_ID, 0, { name: 'A2' });
togglePick(originalChar, ITEM_ID, 'picks', 'opt1');
setText(originalChar, ITEM_ID, 'new text');
check('操作後原角色物件保持不變', JSON.stringify(originalChar), snap);

// ─────────────────────────────────────────────────────────── G
section('G. 規格自檢：resourceId 必須在 CLASS_RESOURCES 存在');
const validResourceIds = new Set(CLASS_RESOURCES.map((r) => r.id));
for (const [key, spec] of Object.entries(FLOW_DATA_SPECS)) {
  if (spec.clock?.resourceId) {
    check(`${key} 的 clock resourceId 合法`, validResourceIds.has(spec.clock.resourceId), true);
  }
}

// ─────────────────────────────────────────────────────────── H
section('H. W0-5 ChapterSettlementModal 渲染驗證');
const closedModal = renderToStaticMarkup(
  React.createElement(ChapterSettlementModal, { isOpen: false, character: {} })
);
check('isOpen=false 時 Modal 不渲染（空字串）', closedModal, '');

const openNoItems = renderToStaticMarkup(
  React.createElement(ChapterSettlementPanelBody, { character: { quirk: '無' } })
);
check('無結算項時 PanelBody 顯示無條目提示', openNoItems.includes('目前沒有需要章節結算的效果條目'), true);

const openSkeptic = renderToStaticMarkup(
  React.createElement(ChapterSettlementPanelBody, {
    character: { level: 8, quirk: '固執的懷疑論者' }
  })
);
check('有結算項時渲染結算按鈕', openSkeptic.includes('data-testid="settle-btn-quirk:固執的懷疑論者"'), true);

// ─────────────────────────────────────────────────────────── I
section('I. W0-5 ChapterSettlement 章節結算');
const noSettlementChar = { quirk: '無' };
check('無結算條目的角色回傳空清單', chapterSettlementItems(noSettlementChar), []);
const skepticChar = { level: 8, quirk: '固執的懷疑論者', classResources: { doubt: 2 } };
check('固執的懷疑論者列出結算項', chapterSettlementItems(skepticChar).length, 1);
const skepticSuccess = planChapterSettlement(skepticChar, 'quirk:固執的懷疑論者', { roll: 7 });
check('2d20 擲 7 ≤ 等級 8 時懷疑點 +1（2 -> 3）', skepticSuccess.patch?.classResources?.doubt, 3);
const skepticFail = planChapterSettlement(skepticChar, 'quirk:固執的懷疑論者', { roll: 12 });
check('2d20 擲 12 > 等級 8 時未獲得懷疑點', Object.keys(skepticFail.patch).length, 0);

// ─────────────────────────────────────────────────────────── J
section('J. FlowDataPanel 元件 SSR 渲染');
const panelMarkup = renderToStaticMarkup(
  React.createElement(FlowDataPanel, {
    spec: SPEC,
    entry: readEntry(charComplete, ITEM_ID),
    character: charComplete,
    itemId: ITEM_ID,
    theme: { subpanelBg: '#f4ebd9', border: '#d6c7ab', textDark: '#3c2415' },
    clock: { value: 7, max: 10, label: '疲勞值' }
  })
);
check('面板渲染標題【保鑣】', panelMarkup.includes('保鑣'), true);
check('面板渲染疲勞刻度 7 / 10', panelMarkup.includes('7 / 10'), true);
check('面板渲染三個可用增益', panelMarkup.includes('小心！') && panelMarkup.includes('這是您先前需要的情報。'), true);
check('面板渲染章節結算按鈕', panelMarkup.includes('章節結束：恢復 1d6 疲勞值'), true);

// ─────────────────────────────────────────────────────────── K
section('K. W1【富家子弟】六種狀態 SSR 與行為驗證');
// 1. 未填狀態
const markupIncomplete = renderToStaticMarkup(
  React.createElement(FlowDataPanel, {
    spec: SPEC,
    entry: readEntry(charIncomplete, ITEM_ID),
    character: charIncomplete,
    itemId: ITEM_ID,
    theme: { subpanelBg: '#f4ebd9', border: '#d6c7ab', textDark: '#3c2415' }
  })
);
const BUFF_BTN = 'flowdata-quirk:富家子弟-use-buff-careful';
check('1. 未填狀態：增益按鈕 disabled 且呈現未填齊警示',
  hasDisabledAttr(markupIncomplete, BUFF_BTN) && markupIncomplete.includes('尚未填齊資料'),
  true);

// 2. 填好狀態
const markupComplete = renderToStaticMarkup(
  React.createElement(FlowDataPanel, {
    spec: SPEC,
    entry: readEntry(charComplete, ITEM_ID),
    character: charComplete,
    itemId: ITEM_ID,
    theme: { subpanelBg: '#f4ebd9', border: '#d6c7ab', textDark: '#3c2415' },
    clock: { value: 7, max: 10, label: '疲勞值' }
  })
);
// 「可按」必須是「按鈕存在」＋「沒有 disabled 屬性」兩個一起驗：
// 只驗「不包含某個字串」在按鈕根本不存在時也會成立（上一版就是這樣）。
check('2. 填好狀態：增益按鈕存在且沒有 disabled 屬性',
  hasTestId(markupComplete, BUFF_BTN) && hasDisabledAttr(markupComplete, BUFF_BTN) === false,
  true);

// 3. 達門檻狀態
const markupTired = renderToStaticMarkup(
  React.createElement(FlowDataPanel, {
    spec: SPEC,
    entry: readEntry(charTired, ITEM_ID),
    character: charTired,
    itemId: ITEM_ID,
    theme: { subpanelBg: '#f4ebd9', border: '#d6c7ab', textDark: '#3c2415' },
    clock: { value: 10, max: 10, label: '疲勞值' }
  })
);
check('3. 達門檻狀態：按鈕 disabled 且印出上限原因',
  markupTired.includes('disabled') && markupTired.includes('疲勞值已達 10 / 10'),
  true);

// 4. 章節恢復狀態
const settleOutcome = planSettlement(charComplete, ITEM_ID, 'chapter', { roll: 3 });
check('4. 章節恢復狀態：7 點疲勞恢復 3 點降為 4 點', settleOutcome.patch?.classResources?.fatigue, 4);

// 5. 履歷狀態
const buffOutcome = planBuffUse(charComplete, ITEM_ID, 'careful', { roll: 2 });
check('5. 履歷狀態：log.kind 為 quirk 且標題包含增益與數值變動',
  buffOutcome.log?.kind === 'quirk' &&
  buffOutcome.log?.title.includes('小心！') &&
  buffOutcome.log?.title.includes('7 → 9'),
  true);

// 6. 重置不清 fields 狀態
const afterRestChar = resetFlowScope(charComplete, 'rest');
const preservedRecords = afterRestChar.flowState?.[ITEM_ID]?.fields?.['保鑣'];
check('6. 重置不清 fields：休息重置後保鑣名冊完整保留',
  Array.isArray(preservedRecords) && preservedRecords.length === 2 && preservedRecords[0].name === '阿福',
  true);

// 7. 判斷工具自己也要有護欄（否則 helper 寫錯，上面那幾條又變成假綠）
const FAKE = {
  disabled: '<button data-testid="x" class="cursor-pointer disabled:cursor-not-allowed" disabled="">確定</button>',
  enabled: '<button data-testid="x" class="cursor-pointer disabled:cursor-not-allowed">確定</button>',
  missing: '<div>沒有這顆按鈕</div>'
};
check('7a helper：class 裡的 disabled: 不算 disabled 屬性',
  hasDisabledAttr(FAKE.enabled, 'x'), false);
check('7b helper：真的 disabled="" 才算',
  hasDisabledAttr(FAKE.disabled, 'x'), true);
check('7c helper：找不到 testid 回 false（不是拋錯）',
  hasDisabledAttr(FAKE.missing, 'x'), false);
check('7d helper：hasTestId 分得出有／沒有',
  [hasTestId(FAKE.enabled, 'x'), hasTestId(FAKE.missing, 'x')], [true, false]);

// ─────────────────────────────────────────────────────────── 8. 【升級】的草稿結算
// 這一組守的是「面板按得過、記帳卻沒動」：金額要自己推導、套用要真的扣款、而且不能扣兩次。
const UPGRADE_ID = 'heroic:升級';
const upgChar = {
  ...charComplete,
  zenit: 1000,
  classes: [{ className: '修補匠', level: 5, skills: [{ name: '高瞻遠矚', sl: 2 }] }],
  flowState: {
    [UPGRADE_ID]: {
      n: 0, on: false, choice: '',
      fields: {
        本次休息的改造: [{ id: 'u1', itemName: '旅行長劍', slot: '武器', traitId: '', replaced: '', paid: '' }]
      },
      picks: [], text: '', list: []
    }
  }
};
const upgDraft = upgChar.flowState[UPGRADE_ID].fields.本次休息的改造[0];
check('8a getForesightSL 讀得到高瞻遠矚 SL 2', getForesightSL(upgChar), 2);
check('8b 選「穿刺」自動推導實付 200z（400 − 2×100）',
  deriveUpgradePaid(upgChar, upgDraft, { traitId: 'traitPierce' }).paid, 200);
check('8c 沒選特性時不改動 patch',
  deriveUpgradePaid(upgChar, upgDraft, { itemName: 'x' }), { itemName: 'x' });

const upgReady = {
  ...upgChar,
  flowState: {
    [UPGRADE_ID]: {
      ...upgChar.flowState[UPGRADE_ID],
      fields: { 本次休息的改造: [{ ...upgDraft, traitId: 'traitPierce', paid: 200 }] }
    }
  }
};
const upgApplied = applyUpgradeDraft(upgReady, 0);
check('8d 套用成功', upgApplied.ok, true);
check('8e 套用後扣 200z', upgApplied.patch.zenit, 800);
check('8f 該筆標成 applied（避免重複扣款）',
  upgApplied.patch.flowState[UPGRADE_ID].fields.本次休息的改造[0].applied, true);
check('8g 同一筆再套用一次會被拒絕',
  applyUpgradeDraft({ ...upgReady, zenit: 800, flowState: upgApplied.patch.flowState }, 0).ok, false);
check('8h 餘額不足時拒絕並說出金額',
  /資金不足/.test(String(applyUpgradeDraft({ ...upgReady, zenit: 50 }, 0).reason || '')), true);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);

