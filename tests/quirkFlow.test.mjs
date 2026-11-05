/**
 * 金手指流程測試（W5: 18 筆金手指端到端閉環測試）
 *
 * 守護項目：
 * 1. 18 筆金手指的條目結構與 controls 宣告完整。
 * 2. 主動操作按鈕（flowActionPlan）正確處理成本扣除、增益獲取、次數限制與履歷記錄。
 * 3. 專屬文字欄位、下拉選擇與多選設定的不可變存取與重置保護。
 */
import {
  flowItemById,
  flowActionPlan,
  readFlowState,
  withFlowState,
  resetFlowScope
} from '../src/features/character-sheet/utils/effectFlow.js';

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

const mkChar = (props = {}) => ({
  name: '測試角色',
  level: 10,
  currentHp: 40,
  currentMp: 40,
  currentIp: 6,
  fabulaPoints: 3,
  zenit: 500,
  classResources: {},
  flowState: {},
  ...props
});

// ─────────────────────────────────────────────────────────── A. 條目存在與結構
section('A. 18 筆金手指條目與 controls 結構');
const w5Ids = [
  'quirk:信魔使徒', 'quirk:棄暗投明之人', 'quirk:地獄差生', 'quirk:固執的懷疑論者',
  'quirk:草木成精', 'quirk:來自遙遠的世界', 'quirk:傳家寶', 'quirk:古代武器',
  'quirk:老大哥\\歐尼醬', 'quirk:離鄉的妖精', 'quirk:倖存者',
  'quirk:會說話的野獸', 'quirk:實驗逃亡體', 'quirk:新人類', 'quirk:遺物使用者',
  'quirk:墮落天使', 'quirk:束縛你的約定', 'quirk:被推翻的王'
];

w5Ids.forEach((id) => {
  const item = flowItemById(id);
  check(`${id} 條目存在`, Boolean(item), true);
  check(`${id} apply.via 為 flow-control`, item?.apply?.via, 'flow-control');
  check(`${id} 擁有 controls 陣列`, Array.isArray(item?.controls) && item.controls.length > 0, true);
});

// ─────────────────────────────────────────────────────────── B. 扣款與資源計畫 (cost / gain)
section('B. 執行計畫扣款與增益 (flowActionPlan)');

// 1. 棄暗投明之人：扣除 1 顛覆點
const turncoat = flowItemById('quirk:棄暗投明之人');
const charNoSubversion = mkChar({ classResources: { subversion: 0 } });
const turncoatBlocked = flowActionPlan(turncoat, charNoSubversion, { controlIndex: 1 });
check('顛覆點為 0 時被擋', turncoatBlocked.ok, false);
check('被擋理由提示顛覆點不足', turncoatBlocked.reason.includes('顛覆點 不足'), true);

const charWithSubversion = mkChar({ classResources: { subversion: 3 } });
const turncoatPaid = flowActionPlan(turncoat, charWithSubversion, { controlIndex: 1 });
check('顛覆點足夠時計畫通過', turncoatPaid.ok, true);
check('顛覆點正確扣除 1 點（3 -> 2）', turncoatPaid.patch?.classResources?.subversion, 2);
check('履歷記錄為 skill', turncoatPaid.log?.kind, 'skill');

// 2. 來自遙遠的世界：獲得 1 物語點（每場景限 1 次）
const distant = flowItemById('quirk:來自遙遠的世界');
const charDistant = mkChar({ quirk: '來自遙遠的世界', fabulaPoints: 2 });
const distantPlan1 = flowActionPlan(distant, charDistant, { controlIndex: 0 });
check('進入衝突場景獲得 1 物語點（2 -> 3）', distantPlan1.patch?.fabulaPoints, 3);
check('計畫執行成功', distantPlan1.ok, true);

// 次數限制檢查（reset: scene 預設 1 次）
const charDistantUsed = withFlowState(charDistant, distant.id, distantPlan1.patch.flowState[distant.id]);
const distantPlan2 = flowActionPlan(distant, charDistantUsed, { controlIndex: 0 });
check('本場景再次點擊時被擋', distantPlan2.ok, false);
check('被擋理由說明場景上限', distantPlan2.reason.includes('場景'), true);

// 場景重置後可再次獲得
const charDistantReset = resetFlowScope(charDistantUsed, 'scene');
const distantPlan3 = flowActionPlan(distant, charDistantReset, { controlIndex: 0 });
check('場景重置後可再次獲得物語點', distantPlan3.ok, true);

// 3. 地獄差生：自私片刻（獲得 1 物語點）
const underachiever = flowItemById('quirk:地獄差生');
const charDelinquent = mkChar({ fabulaPoints: 1 });
const selfishPlan = flowActionPlan(underachiever, charDelinquent, { controlIndex: 1 });
check('自私片刻計畫成功', selfishPlan.ok, true);
check('物語點增加 1 點（1 -> 2）', selfishPlan.patch?.fabulaPoints, 2);

// 4. 傳家寶 / 古代武器 / 離鄉的妖精：章節末 GM 物語點結算按鈕
const heirloom = flowItemById('quirk:傳家寶');
const heirloomPlan = flowActionPlan(heirloom, mkChar({ fabulaPoints: 4 }), { controlIndex: 1 });
check('傳家寶 GM 結算成功獲得 1 物語點（4 -> 5）', heirloomPlan.patch?.fabulaPoints, 5);

const ancientWpn = flowItemById('quirk:古代武器');
const ancientPlan = flowActionPlan(ancientWpn, mkChar({ fabulaPoints: 0 }), { controlIndex: 1 });
check('古代武器 GM 結算成功獲得 1 物語點（0 -> 1）', ancientPlan.patch?.fabulaPoints, 1);

const fae = flowItemById('quirk:離鄉的妖精');
const faePlan = flowActionPlan(fae, mkChar({ fabulaPoints: 2 }), { controlIndex: 1 });
check('離鄉妖精 GM 結算成功獲得 1 物語點（2 -> 3）', faePlan.patch?.fabulaPoints, 3);

// 5. 束縛你的約定：打破約定按鈕
const vow = flowItemById('quirk:束縛你的約定');
const vowPlan = flowActionPlan(vow, mkChar(), { controlIndex: 1 });
check('打破約定按鈕計畫通過', vowPlan.ok, true);
check('打破約定日誌標題正確', vowPlan.log?.title.includes('束縛你的約定'), true);

// ─────────────────────────────────────────────────────────── C. 狀態與文字欄位存取
section('C. 狀態與自訂文字欄位');

// 草木成精：文字備忘與陽光開關
const arboreal = flowItemById('quirk:草木成精');
const arborealState = readFlowState(mkChar(), arboreal);
check('初始狀態開關為關閉', arborealState.on, false);
check('初始自訂文字為空', arborealState.text, '');

const charArborealSet = withFlowState(mkChar(), arboreal.id, { text: '自然荊棘術（INS+WLP）', on: true });
const readBackArboreal = readFlowState(charArborealSet, arboreal);
check('成功寫入並讀回自訂咒語備忘', readBackArboreal.text, '自然荊棘術（INS+WLP）');
check('成功開啟陽光開關', readBackArboreal.on, true);

// 會說話的野獸：多選野性增益
const beast = flowItemById('quirk:會說話的野獸');
const charBeastSet = withFlowState(mkChar(), beast.id, { picks: ['customWeapon', 'unarmedDamage'], text: '利爪拳刃' });
const readBackBeast = readFlowState(charBeastSet, beast);
check('成功選擇兩項野性增益', readBackBeast.picks, ['customWeapon', 'unarmedDamage']);
check('成功記錄野獸備忘', readBackBeast.text, '利爪拳刃');

// 新人類：屬性下拉與場景開關
const newHuman = flowItemById('quirk:新人類');
const charHumanSet = withFlowState(mkChar({ quirk: '新人類' }), newHuman.id, { choice: 'DEX', on: true });
const readBackHuman = readFlowState(charHumanSet, newHuman);
check('成功指定潛能屬性 DEX', readBackHuman.choice, 'DEX');
check('成功開啟本場景骰階提升開關', readBackHuman.on, true);

// 場景重置清空開關
const charHumanReset = resetFlowScope(charHumanSet, 'scene');
const readBackHumanReset = readFlowState(charHumanReset, newHuman);
check('場景重置關閉開關', readBackHumanReset.on, false);
check('場景重置回初始開關狀態', readBackHumanReset.on, false);

// ========================================================
console.log(lines.join('\n'));
console.log('\n========================================================');
console.log(`  通過 ${pass} / ${pass + fail}　${fail > 0 ? `失敗 ${fail}` : '（全部通過）'}`);
console.log('========================================================');
if (fail > 0) process.exit(1);
