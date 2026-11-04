# 02 · Wave 0 先行件（W0-1 ～ W0-9）

> 本檔是計劃書的分冊（給 Antigravity 分冊閱讀）；入口與施工順序看 `docs/plan/README.md`。
> 索引與施工順序看 `docs/plan/README.md`；逐筆原文引用與行號看 `docs/plan/appendix-*.md`。
> 檔名 `02-wave0-primitives.md` 只是閱讀順序，不是施工順序——施工順序在 README。

### 3.2 先行件（Wave 0：九件，**先做完這些，後面八成的條目才有東西可掛**）

> 九件都是「一支通用件吃多筆」，不做而逐筆寫客製面板，會出現五套「填名字」的手寫表單。
> 每一件都可以獨立驗收，**做完就先跑一次 `npm test`**。
> 順序建議：W0-2 → W0-1（其實是同一支的兩半）→ W0-3 → W0-6 → W0-7 → W0-8 → W0-9 → W0-4 → W0-5。

#### W0-1 `flowState[id].fields`：非數字資料的容器（吃 24 筆）

- 檔案：`utils/effectFlow.js`（**不是** `characterEngine`——這一輪不新增頂層欄位）
  - `readFlowState` 回傳物件加 `fields: {}`（從 `raw.fields` 取，非物件則回 `{}`）。
  - `withFlowState` 寫入時保留 `fields`（**不在** `reset` 時清掉，見 §2.2 第 2 條）。
  - `flowResetState`：清 `n`/`on`/`picks`/`text`/`list`，**保留** `fields`。
- 驗收：舊存檔（`flowState[id]` 沒有 `fields`）→ `fields` 是 `{}`；`calculateCharacterStats` 輸出完全不變；
  `flowResetState` 之後 `fields` 還在。

#### W0-2 `flowState` 的形狀擴充：`picks`／`text`／`list`（吃 14 筆）

現況 `flowState[id] = { n, on, choice }`，`choice` **只收單一字串**
（`utils/effectFlow.js` 的 `withFlowState` 會把非字串清成空字串）。所以「選兩個以上」全部卡住。

- 檔案：`utils/effectFlow.js`
  ```js
  // 新形狀（舊欄位全部保留，缺欄回預設）
  { n: 0, on: false, choice: '', picks: [], text: '', list: [] }
  ```
  - `readFlowState` / `clampFlowState` / `withFlowState` / `flowResetState` 四支都要帶新欄位。
  - `picks`：去重、保序、只收字串；`list`：每筆 `{ id, ... }`，`id` 由呼叫端給（不自動產生時間戳）。
  - **`reset` 時 `picks`/`text`/`list` 一律清空**（除了 spec 標 `persist: true` 的條目——目前沒有）。
- 檔案：`components/SkillFlowControls.jsx` 新增三種控件：
  | kind | props | 行為 |
  |---|---|---|
  | `multiSelect` | `control.options`、`control.min/max` | 勾選清單；選滿 `max` 時其餘 disabled；顯示「已選 2／3」 |
  | `text` | `control.multiline`、`control.maxLength` | 單行或 textarea；空字串＝未填 |
  | `recordList` | `control.fields`、`control.max` | 多筆記錄（每筆一張小卡） |

- 檔案：`components/CharacterPlayHUD.jsx` 的 `renderFlowControls`
  - 把 `onChoice` 之外再傳 `onPicks` / `onText` / `onListChange`（都走 `adjustFlowCounter` 同一條寫入路徑）。
- 驗收 `tests/effectFlows.test.mjs` 追加 6 條：舊存檔缺新欄 → 回 `picks:[]`/`text:''`/`list:[]`；
  `picks` 去重；超過 `max` 被擋；重置清空；`withFlowState` 不弄丟其他欄位；`text` 是長字串也照存。

#### W0-3 `RollAdjustButton`：擲骰式加減（吃 5 筆，並修掉一個規則錯誤）

**現況是錯的，不只是缺**：`classResources.js` 的五個金手指池把「恢復 1d6」寫成 `resetTo: 0`，
而 `ClassResourceStrip` 的重置是**寫入固定值**——按下去是**直接清零**，不是恢復 1d6。

- 檔案：`data/classResources.js`
  - 五筆的 `resetLabel` 改為結構化：`resetRoll: '1d6'`（取代或並存 `resetLabel`），
    並把 `resetTo` 改成 `null`（**不可同時存在**，否則兩條寫入路徑）。
- 檔案：`components/ClassResourceStrip.jsx`
  - 有 `resetRoll` 時，重置鈕改成「擲 1d6」：`Math.floor(Math.random()*6)+1` → `writeValue(resource, clamp(現值 - roll))`，
    toast 寫「疲勞值 9 → 7（−1d6 = 2）」。
- 檔案：`utils/classResources.js` 或 `data/classResources.js` 加純函式：
  ```js
  export const applyRollDelta = (current, roll, { sign = 1, min = 0, max = Infinity } = {}) =>
    Math.min(max, Math.max(min, current + sign * roll));
  ```
- 驗收：`tests/classResources.test.mjs` 追加 4 條（+1d6 夾上限、−1d6 不低於 0、`resetTo` 與 `resetRoll` 不得同時存在、roll 非 1–6 → 不動）。

#### W0-4 `PartyPicker`：從名冊挑一個隊友（吃 3 筆金手指＋修一個既有問題）

- 現況：`ZeroPowerBlock` 有 `roster` 參數，但**跑團面板呼叫時沒傳**（`CharacterPlayHUD` 約 4605），
  所以「合體之力」在跑團面板永遠判定不了對方的命刻。
- 檔案：新增 `components/PartyPicker.jsx`（純呈現）：`{ roster, excludeId, value, onChange, label, testId }`。
- 檔案：`CharacterPlayHUD.jsx` 把 `roster` 傳進 `ZeroPowerBlock` 與新的 `FlowDataPanel`。
- 驗收：`tests/flowData.test.mjs` 1 條（名冊為空時回 `null` 而不是空白下拉）＋ SSR 1 條。

#### W0-5 `ChapterSettlement`：章節結束的統一結算清單（吃 6 筆）

- 現況：「聚會結算」只做 EXP；`characterLog` 已有 `session` 的開始／結束（`startSession`／`endSession`）。
- 檔案：新增 `utils/chapterSettlement.js`（純函式）：
  ```js
  export const chapterSettlementItems = (character) => [{ itemId, label, dice, kind }];
  // 例：{ itemId:'quirk:固執的懷疑論者', label:'2d20 ≤ 等級 → +1 懷疑點', dice:'2d20', kind:'rollBelowLevel' }
  export const planChapterSettlement = (character, itemId, { roll }) => ({ ok, patch, log, toast });
  ```
- 檔案：新增 `components/ChapterSettlementPanel.jsx`（`JRPGModal` 內一張清單，逐條按「骰」）。
- 入口：`CharacterPlayHUD` 的「收場」流程（`handleEndSession` 之後）彈出；**不自動結算**（章節邊界只有桌邊的人知道）。
- 驗收：`tests/flowData.test.mjs` 3 條（無可結算條目 → 空清單且不彈窗；`2d20` 判定邊界；結算後履歷一筆）。

#### W0-6 `controls[]`：一條條目不只一顆控件（吃 18 筆金手指）

**這是這一輪最大的結構瓶頸**：`items[].control` 目前是**單一物件**（`scripts/build-effect-flows.mjs`
產生時只寫一顆），而【富家子弟】需要「疲勞計數器 ＋ 3 顆增益按鈕 ＋ 章節骰」並存。

- 檔案：`scripts/build-effect-flows.mjs`
  - 規格來源多接受一個 `controls: [...]`；有 `controls` 時輸出 `controls` 陣列，
    **同時**保留 `control` 為第一顆（向後相容：既有的 `renderFlowControls` 讀 `control`）。
  - 驗證：`controls` 每一顆都要通過既有的 kind 檢查（`counter` 要 `max`+`reset`、`button` 要 `label`+`outcome`…）。
- 檔案：`utils/effectFlow.js`
  - 新增 `controlsOf(item) => item.controls?.length ? item.controls : (item.control ? [item.control] : [])`。
  - `readFlowState` 不變（狀態仍是同一份）；`flowActionPlan` 接受 `controlIndex`。
- 檔案：`components/SkillFlowControls.jsx`
  - 外層改成 map `controlsOf(item)`，每顆各自渲染（`data-testid` 加後綴 `-c0`／`-c1`…）。
- 驗收：`test:flows` 追加 4 條（單控件向後相容、多控件順序、`controlsOf` 對空物件回 `[]`、多控件時每顆都有 testid）。

#### W0-7 重置的**執行者**（吃 10 筆；修一個「每場景一次其實是每張卡一次」的假實作）

現況：`control.reset` 的值（`scene`/`round`/`rest`/`chapter`）只被**顯示**在按鈕的 `title` 裡，
**沒有任何東西會執行它**。所以【陷阱大師】的「每場景一次」實際上是「每張卡一次」。

- 檔案：`utils/effectFlow.js` 新增：
  ```js
  export const resetScopeLabel = (scope) => ({ scene:'場景結束', round:'回合結束', rest:'休息',
    chapter:'章節結束', conflict:'衝突結束', hpZero:'HP 歸零', turn:'回合結束' }[scope] || '重置');
  export const resetFlowScope = (character, scope) => 新角色;  // 把該 scope 的條目重置
  ```
  - 只重置 `control.reset === scope`（或 `controls[]` 內任一顆）的條目；
    `fields` 一律保留（見 §2.2 第 2 條）。
- 檔案：`components/CharacterPlayHUD.jsx`
  - 在「營地休整」旁加一列三顆小按鈕：**場景結束／休息／章節結束**，各自呼叫 `resetFlowScope`，
    並 toast「已重置 N 條（每場景／每休息）」。
  - 已有的 `handleCampRest`（營地休整）在 HP/MP 回滿之後一併跑 `resetFlowScope(character,'rest')`。
- 驗收：`test:flows` 追加 4 條（只重置對應 scope、`fields` 不被清、toast 條數正確、沒有該 scope 的條目時不寫檔）。

#### W0-8 收斂「同一個數字兩份」（既有缺陷，吃 5 筆金手指＋4 筆職業技能）

**現況**：疲勞值／不穩定值／顛覆點／異常值／懷疑點**同時**存在
`classResources` 的池與 `flowState[id].n`（`effectFlows.json` 也給它們各一顆 counter）；
貿易點數更誇張——`classResources` 一個池，`effectFlows` 又有【貿易之風】【真正的財富】【我聽說過】【小金庫】
四顆 `max="SL + 3"` 的假計數器。**跑團卡上會看到兩個（甚至四個）長得一樣的數字**。

- 檔案：`scripts/build-effect-flows.mjs`
  - 輸出時若該條目的 `id` 指向一個 `classResources` 池（新增一張對照表 `RESOURCE_BACKED_IDS`），
    **不要輸出 counter**，改輸出 `control: { kind:'none', backedBy:'fatigue' }`。
- 檔案：`utils/effectFlow.js`
  - `readFlowState`／`clampFlowState`：`backedBy` 有值時，數字從 `classResources` 讀寫（單一真相）。
- 檔案：`data/classResources.js`：貿易點數的 4 筆條目全部指向同一個 `tradePoints` 池。
- 驗收：`test:flows` 2 條（`backedBy` 條目不再畫 counter；讀到的值等於池的值）＋
  `test:resources` 追加 1 條（四個條目指向同一個池）。

#### W0-9 兩條扣款路徑（既有缺陷，吃 1 筆已證實＋多筆潛在）

**【植生術】現在有兩條路**：通用按鈕扣 20 MP 但不加種子（`effectFlows` 的 `button/cost{mp:20}`）、
花園盤加種子但不扣 MP（`FloristGardenTracker.jsx`）。玩家按哪一顆都只做一半。

- 規則（請寫進 `renderFlowControls` 的註解）：**`apply.via === 'existing'` 一律不畫通用控件**——
  這條已經存在；問題是【植生術】的 `via` 還是 `flow-control`。
- 檔案：`scratch/flows/class.json` 把它改成 `status:'wired'` 並在 `evidence` 指到花園盤，
  重新 `npm run build:flows` 後 `via` 會變成 `existing`，通用按鈕就消失。
- 同時修 `FloristGardenTracker`：種下時扣 20 MP（`onChange` 一併寫 `currentMp`，**一次寫入**）。
- 驗收：`test:florist` 追加 2 條（種下扣 20 MP、MP 不足時不種且不被扣）。

---
