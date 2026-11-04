# W0 驗收報告（2026-11-04）

> 驗收者：Lead。被驗收的對象：AGY 的 W0 施工（工作區未提交變更）。
> 判準來源：`docs/plan/README.md` §0（W0 完成判準）＋ `02-wave0-primitives.md`（九件各自的驗收）＋
> `08-agy-rules.md` §4（驗收清單）。
>
> **結論：核心層（純函式與資料形狀）通過；接線層 4 項未完成，其中 1 項是會拋錯的真缺陷。**
> 建議：修完下面 §2 的 A–D 再進 W1（W1 會直接用 `handleResetScope` 與 `FlowDataPanel` 的掛載點）。

## 1. 通過的項目（含證據）

| 先行件 | 判定 | 證據（實測） |
|---|---|---|
| W0-1 `flowState[id].fields` 容器 | ✅ | `readFlowState({})` 回 `{n:0,on:false,choice:'',fields:{},picks:[],text:'',list:[]}`；`flowResetState` **保留** `fields`（名字不會被場景結束清掉）；純函式（原物件未被改） |
| W0-2 `picks`／`text`／`list` ＋ 三種控件 | ✅ | `togglePick` 有去重與 `min`/`max` 邊界；`setText` 存長字串；`SkillFlowControls` 有 `MultiSelectControl`／`RecordListControl`／`text` 分支 |
| W0-3 擲骰式加減 | ✅（範圍修正見 §3-1） | `applyRollDelta(8,6,{max:10})=10`、`(2,6,{sign:-1,min:0})=0`；`resetRoll` 與 `resetTo` **不會同時存在**；`ClassResourceStrip` 有「擲 1d6」按鈕 |
| W0-6 `controls[]`（多控件） | ✅（機制） | `controlsOf` 三種輸入都正確（`controls[]`／單 `control`／空）；`build-effect-flows.mjs` 會輸出 `controls`；元件會 map 多顆。**目前沒有 `controls>1` 的實際條目**——那是 W2 的工作，機制先到位即可 |
| W0-8 收斂重複計數器 | ✅ | `effectFlows.json` 有 **14 筆 `control.backedBy`**（貿易點數 4 筆全部指向 `tradePoints`、疲勞值→`fatigue`、勇氣→`courage`…）；`effectFlow` 讀 `backedBy` |
| W0-9 單一扣款路徑 | ✅ | 【植生術】已是 `apply.via: 'existing'`＋`control.kind:'none'`（通用按鈕消失）；`FloristGardenTracker` 種下扣 20 MP（`test:florist` ＋15 條） |
| W0-5 章節結算**純函式** | ✅（面板未接，見 §2-C） | `chapterSettlement.js` 有 `1d6`／`2d20 ≤ 等級` 兩種判定，履歷文字含實測值 |
| 測試與建置 | ✅ | `npm test` 全綠（`test:flows` 169→**187**、新增 `test:flowdata` **36**、`test:florist` +15、`test:classResources` +4）；`npm run build` exit 0（10.8 s）；`test:emoji` 0 命中 |

## 2. 未通過（請修完再進 W1）

### A. **真缺陷**：`handleResetScope` 會拋 `ReferenceError`
`CharacterPlayHUD.jsx` 用了 `characterFlowItems` 與 `controlsOf`，但**沒有 import**：

```js
// 目前（第 80–89 行的 import 區塊）只匯入到 flowVarsFor
import { …, flowVarsFor } from '../utils/effectFlow';
```

修法（一行）：

```js
import {
  flowItemForClassSkill, flowItemForHeroic, flowItemForQuirk,
  readFlowState, clampFlowState, withFlowState, flowResetState,
  flowActionPlan, flowVarsFor,
  characterFlowItems, controlsOf            // ← 補這兩個
} from '../utils/effectFlow';
```

為什麼一定要修：這顆按鈕 W0-7 一接上就會被按到；`build`／SSR 都不會叫（識別字沒被呼叫時
esbuild 視為全域），所以**測試全綠也抓不到**——這正是「護欄要斷言行為、不要斷言原始碼」的反面案例。

### B. W0-7 只做了一半：**三顆重置鈕沒有渲染**，一鍵休整也沒串
- `handleResetScope` 定義了但**沒有任何 JSX 呼叫它**。
- `handleCampRest`（第 1206 行）沒有跑 `resetFlowScope(character,'rest')`。

修法：
1. 在第 1965–1978 行的「營地休整」按鈕之後，加一列三顆小按鈕（`data-testid="reset-scope-scene"` /
   `-rest` / `-chapter`），各自 `onClick={() => handleResetScope('scene'|'rest'|'chapter')}`。
2. `handleCampRest` 內，HP/MP 回滿的那一筆 `loggableChange` 之後，把
   `campActivities` 與 `resetFlowScope(nextChar,'rest')` 一起寫入（**一次寫入**）。

驗收（請一併加測試）：
- `test:flowui` 新增 3 條：三顆鈕存在；`characterFlowItems`／`controlsOf` 可在模組載入期解析（不靠按下去才知道）；
  按下 `reset-scope-rest` 後 `flowState` 的 `n/on/picks` 歸零而 `fields` 還在（純函式層已可測，UI 只驗存在）。

### C. W0-5 面板**沒有入口**：`ChapterSettlementPanel` 沒有任何 importer
`chapterSettlement.js` 寫得不錯，但 `ChapterSettlementPanel.jsx` 是**死檔**（全 `src/` 0 個 importer）。

修法：在「收場」流程（`handleEndSession`，第 1255 行）之後開啟面板：
1. 加 state `isChapterSettlementOpen`。
2. `handleEndSession` 成功後：`setIsChapterSettlementOpen(true)`。
3. 面板以 `JRPGModal` 包（照 `FabulaPointLedgerModal` 的形狀），props：`character`、`onApply(plan)`、`showToast`。
4. 面板內沒有任何可結算條目 → **不要彈**（`chapterSettlementItems(character).length === 0` 就跳過）。

### D. W0-4 `PartyPicker` 是死檔（沒有任何 importer）
名冊其實**已經**傳給 `ZeroPowerBlock`（`roster={roster}`，既有），所以「合體之力」不受影響；
但計劃書要求的是「一支可重用的小選擇器」。兩個選項，**選一個並在回報裡寫明**：
- (D1) 在 W1 的【富家子弟】面板用不到它（保鑣是自由文字，不選隊友）→ **把 `PartyPicker.jsx` 刪掉**，
  等 W4 的【交織的靈魂】／【武器縛靈】真正需要時再寫（避免死碼）。
- (D2) 保留，但立刻接進 W4 會用到的那一筆（本輪先加一個「未使用」的註解與 TODO 不算完成）。

> Lead 的建議：**(D1) 刪掉**。本專案對死碼的態度是明確的（「宣告了卻沒有消費者的常量比沒有更糟」）。

## 3. 觀察（不算缺陷，但要在回報裡說明）

1. **`resetRoll` 只有 2 筆**（疲勞值、不穩定值）——這是對的：另外三筆的「1d6」發生在**使用時**
   （遺物使用者 +1d6、富家子弟 +1d6）與**章節結算**（懷疑點 2d20），不在「重置」那一側。
   請在回報裡寫明這個判斷，避免下一個人以為漏了三筆。
2. `flowDataSpecs.js` 目前只有【富家子弟】一筆——那是 W1 的範圍，OK。
3. `docs/agents-changelog.md` 的條目把 W0-1～W0-9 全寫成已完成，但 §2 的 B/C/D 還沒接線。
   **回報與紀錄要對得上**：請在修完之後更新那一條（或補一句「接線待 W1」）。

## 4. 修完之後請回報

照 `docs/plan/08-agy-rules.md` §2 的格式，並特別附上：
- A 的 import 修好後，**一次真實呼叫**的證據（例如 `test:flowui` 裡那條「按下去不會拋錯」的斷言）；
- B 的三顆鈕與 `handleCampRest` 的串接各一條測試；
- C 的「沒有可結算條目時不彈窗」測試；
- D 你選了 D1 還是 D2、理由一句話。
