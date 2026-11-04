# 03 · 金手指逐筆方案（35 筆）

> 本檔是計劃書的分冊（給 Antigravity 分冊閱讀）；入口與施工順序看 `docs/plan/README.md`。
> 索引與施工順序看 `docs/plan/README.md`；逐筆原文引用與行號看 `docs/plan/appendix-*.md`。
> 檔名 `03-quirk-plans.md` 只是閱讀順序，不是施工順序——施工順序在 README。

### 3.1 `quirk:富家子弟`（示範案：A+B+C+E 四型都有）

**原文要求（逐句）**
- 「給他們一個名字，描述一下他們的外表」→ 2 筆具名記錄，各有 `name`／`look`。
- 「他們提供以下增益：小心！／這是您先前需要的情報。／臥倒，我會處理好的！」→ 3 個增益，
  **使用時挑一個**。
- 「每當你使用這些增益時，你的保鑣會累積 1d6 點疲勞值」→ 每次使用：擲 1d6，疲勞值 +N。
- 「當他們累積到 10 點或更多疲勞值時，你就不能再依賴他們了」→ 門檻 10，達標禁用增益。
- 「每當章節結束（通常為一次 4 小時的聚會），你的保鑣會恢復 1d6 點疲勞值（最低降為 0）」→ 章節結算 −1d6。

**現況**
- 疲勞值池**已存在**：`data/classResources.js` 的 `fatigue`（`quirkName: '富家子弟'`、上限 10、`resetLabel: '每章節恢復 1d6'`）。
  但那個 `resetLabel` 只是文字——**沒有任何東西會擲那顆 d6**。
- `flowState` 已有一個「使用保鑣增益」的 `button`（`data/effectFlows.json`），但它只會寫一筆履歷，不碰疲勞值、不知道有幾個增益。
- 保鑣的名字與外表：**完全沒有欄位**。

**施工步驟（每一步都可以獨立驗收）**

1. **資料欄位**（`utils/effectFlow.js`，即 W0-1）
   - `readFlowState` 回傳物件加 `fields: {}`；`withFlowState` 保留它；`flowResetState` **不清它**。
   - 驗收：舊存檔（沒有 `fields`）跑完是 `{}`；`calculateCharacterStats` 不受影響；重置後名字還在。
2. **規格**（`data/flowDataSpecs.js`）：照 §2.4 的 `'quirk:富家子弟'` 完整寫入。
   - 驗收：`FLOW_DATA_SPECS['quirk:富家子弟'].records.max === 2`、`buffs.length === 3`。
3. **純函式**（`utils/flowData.js`）：實作 §2.5 全部函式。
   - `canUseBuff` 的判斷順序：①`spec` 不存在 → `ok:false, reason:'這一條沒有增益資料'`；
     ②`requireRecordsForBuffs` 且 `recordIssues` 非空 → `ok:false` 並指名「第 N 位保鑣還沒填外表」；
     ③刻度 ≥ `blockAt` → `ok:false, reason:'疲勞值 10／10，無法再依賴保鑣'`；④否則 `ok:true`。
   - `planBuffUse`：`roll` 必須是 1–6 的整數，否則 `ok:false`（**不自己擲**）；
     patch 寫 `classResources.fatigue = min(max, 現值 + roll)`；`log.title = 使用保鑣增益【${buff.label}】（疲勞 ${before} → ${after}）`。
   - 驗收：`tests/flowData.test.mjs` 的第 1～7 條。
4. **面板**（`components/FlowDataPanel.jsx`）：名冊（2 格）＋三個增益按鈕＋「章節結束」按鈕。
   - 未填齊：增益按鈕 `disabled`，下方一行「先填完 2 位保鑣的名字與外表」。
   - 達門檻：三個按鈕 `disabled`，一行「疲勞值 10／10——本聚會不能再依賴保鑣，等章節結束恢復」。
   - 驗收：SSR 三種狀態各渲染一次，斷言 `disabled` 與那行字存在。
5. **HUD 掛載**（`CharacterPlayHUD.jsx`，金手指區塊）：
   ```jsx
   {(() => {
     const spec = specFor(`quirk:${character.quirk}`);
     if (!spec) return null;
     const entry = readEntry(character, `quirk:${character.quirk}`);
     const issues = recordIssues(spec, entry);
     const clockRes = getActiveClassResources(character).find((r) => r.id === spec.clock.resourceId);
     return (
       <FlowDataPanel
         spec={spec}
         entry={entry}
         theme={theme}
         completeness={{ ok: issues.length === 0, issues }}
         clock={clockRes ? { value: readResource(character, clockRes), max: clockRes.max, label: clockRes.label } : null}
         onRecordChange={(i, patch) => commit(withRecord(character, itemId, i, patch))}
         onUseBuff={(buffId) => {
           const roll = Math.floor(Math.random() * 6) + 1;
           const plan = planBuffUse(character, itemId, buffId, { roll });
           if (!plan.ok) { showToast(plan.reason, 'warning'); return; }
           commit(applyFlowPlanPatch(character, plan));   // 見第 6 步
           showToast(plan.toast, 'success');
         }}
         onSettle={(id) => { /* 同上，改用 planSettlement */ }}
         testId={`flowdata-quirk-${character.quirk}`}
       />
     );
   })()}
   ```
   - `applyFlowPlanPatch`：把 `patch` 鋪回角色並寫一筆履歷（**一次寫入**，不要分兩次 `onChange`——
     本專案踩過「UI 扣了、存檔沒扣」）。
6. **履歷**：三種事件都寫 `kind:'quirk'`；疲勞值變化寫在 `title` 與 `note`（`classResources` 沒有個別欄位標籤）。
7. **測試**：`tests/flowData.test.mjs`（§2.9）＋ `tests/playHudFlow.test.mjs` 追加 3 條（面板出現／未填齊時禁用／達門檻時禁用）。
8. **接線檢查**：`npm run test:flows` 仍綠（`effectFlows.json` 的那顆 button 與新面板**不要同時存在**，
   否則同一個增益會有兩顆按鈕、其中一顆不扣疲勞。做法：在 `deriveApply` 之外，
   於 HUD 的 `renderFlowControls` 加一條「有 `flowDataSpecs` 的條目跳過通用控件」）。

**刻意不做**
- 不把保鑣做成 NPC 卡（原文：「他們沒有 NPC 資料面板，也不會參與檢定或衝突場景」）。
- 不自動判定「章節結束」（那是桌邊的決定，玩家按才結算）。
- 不為三個增益各自寫一個計數器（疲勞值是**共享**的，原文特別強調這一點）。
---

### 3.3 金手指：逐筆方案（35 筆，附錄 `plan-appendix-quirk-needs-2026-11-04.md` 有每筆的原文引用與行號）

> 每一筆都寫「資料 → 純函式 → 面板 → 履歷 → 驗收」。有共用先行件的直接引用 W0-x。
> **施工順序見 §3.6**：先做「不需要新資料欄位」的 7 筆（W3），再動 schema（W1/W2）。

#### 3.3.1 `quirk:富家子弟` —— 見 §3.1（示範案，A+B+C+E）。施工時把 §3.1 的 `withRecord` 改成 W0-2 的 `setRecord`。

#### 3.3.2 `quirk:被束縛的心`（A+C+F）
- **原文要求**：羈絆對象（NPC／組織）、**3 條戒律**、每場景第一次違反 → 動搖＋虛弱＋失去一半 HP/MP＋+2 物語點、累積 6 次後免罰、**第 7 次失去這個金手指**。
- **資料**（`flowState['quirk:被束縛的心'].fields`）：`bondId`（指向 `character.bonds[]` 的 id）、三條戒律（`list` 三筆 `{ id, text }`）、`violations`（0–7）。
- **操作**：一顆「違反戒律（本場景第一次）」按鈕 → `planVowViolation(character, { sceneFlag })`：
  - 已在本場景用過 → `ok:false`（訊息「本場景已經違反過一次」）；
  - `violations < 6` → patch：`currentHp/currentMp` 各減一半（向下取整）＋兩個狀態 ＋`fabulaPoints +2`；
  - `violations === 6`（第七次）→ 加一筆「失去金手指」的履歷並把 `quirk` 設為 `'無'`（走 `buildQuirkPatch`，理由見 §3.1 第 7 步）。
- **落點**：金手指區塊（`FlowDataPanel`）。戒律三格用 `recordList`（`min:3,max:3`）。
- **驗收**：6 條（半血半魔向下取整、每場景一次、第 6 次起免罰但次數照加、第 7 次移除金手指並退 1000z 類帳本、履歷、舊存檔沒有此欄）。
- **待裁定**：「本場景」的邊界（見 §3.6 第 3 條）。

#### 3.3.3 載具三筆：`老載具`／`偷來的載具`／`行動工作站`（B+F）
- **資料**：`flowState[...].fields.vehicle` 一筆 `{ name（必填）, type（清單，待裁定是否內建 p.125 那張表）, size（中型／大型）, note }`。
- **不進 `calculateCharacterStats`**：`pilotVehicle` 是機師專屬（`characterEngine` 只讀它），共用會把載具防禦覆蓋規則帶進來。
- **操作**：章節限一次（`counters.chapterUsed`）＋「本章節已用過」toggle（既有）。
- **驗收**：3 條（資料齊才顯示「已登記」；章節結算清空 `chapterUsed`；不影響 stats）。

#### 3.3.4 `quirk:交織的靈魂／戒指裡的老爺爺`（A+D）
- **資料**：`picks.hostId`（`PartyPicker`，指向名冊）、`state.phase`（`inside`／`outside`）、`picks.sacrifice`（二選一）。
- **操作**：一顆「進出宿主」toggle（衝突中僅回合開始可切換——**這一條交給戰鬥視窗，跑團卡只記狀態**）。
- **驗收**：2 條（離開時 `phase==='outside'` 且面板顯示「距離超過一日 → 重現」提示；回來後清 `sacrifice`）。

#### 3.3.5 `quirk:大夢一場`（C+E）
- **資料**：`counters.progress`（0–10）、`counters.partyFpPerChapter`（團隊層面，**待裁定**）。
- **操作**：按鈕「推進 1」；達 10 → 角色退場（寫履歷、把 `character.retired = true`？**這是新欄位，需裁定**）。
- **驗收**：2 條（達 10 不再可推；退場後金手指面板唯讀）。

#### 3.3.6 其餘金手指（**表格化：照這張表逐筆照抄 §3.3.2 的骨架**）

| 條目 | 型 | 需要的資料 | 跑團操作 | 先行件 | 備註 |
|---|---|---|---|---|---|
| 光榮的命運 | F+E | 五選一的結果（`picks.oracle`） | 章節末結算（五個選項各一顆按鈕） | W0-5 | 移除金手指那條走 `buildQuirkPatch` |
| 固執的懷疑論者 | C+E | 懷疑點（既有池） | 每次受效果擲 1d6：1–4 +1 點、5–6 免疫 | W0-3 | 20 點的回憶觸發要一顆「重擲 2d20」 |
| 實驗逃亡體 | C+E | 不穩定值（既有池） | 忽略成本 +1d8；章節 −1d6；達 10 → HP 0 並投降 | W0-3 | 達 10 的自動化需 `planInstabilityCheck` |
| 遺物使用者 | B+C | 異常值（既有池） | 三個能力挑一個；達 10 → 擲 d6（1–4 沉睡／5–6 釋放） | W0-3 | 能力清單寫進 spec |
| 地獄差生 | C+E | 差生點（**新增池**） | 休息 +1d6；加成直接進傷害（戰鬥視窗） | W0-3 | 先在 `CLASS_RESOURCES` 補池 |
| (不太)忠誠的僕人 | C+F+E | 主人（`PartyPicker`）＋依賴點 | 章節 2d20；達 20 → 挑戰／背叛二選一 | W0-3, W0-4 | 二選一用 `picks` |
| 應劫之人 | F+E | 2d20 ≤ 等級的結果 | 章節結算 | W0-5 | |
| 天才的宿敵 | F | 宿敵（名字＋次要反派終結點） | 花 1 物語點忽略成本 | — | 終結點屬戰鬥視窗 |
| 神秘魔法書 | F | 選定的英雄技能 | 取得時選一次 | — | 交給英雄技能選器 |
| 信魔使徒 | A | 惡魔夥伴（名字／外表） | 休息時對話 | 可重用 `WayfarerCompanionModal` 的表單 | 待裁定是否通用化 |
| 傳家寶／古代武器／離鄉的妖精 | F | 所選物品／咒語 | 取得時選一次 | — | 與行囊／咒語清單連動 |
| 武器縛靈 | A | 鞘（`PartyPicker`） | 拔刀／收刀 | W0-4 | |
| 棄暗投明之人 | C | 顛覆點（既有池） | 取代 1 點物語點 | — | 已在池裡，只缺按鈕 |
| 草木成精／會說話的野獸 | F | 自訂 NPC 咒語 | 取得時建一筆咒語 | — | 與 `npc-workshop` 的咒語表共用？待裁定 |
| 偷來的載具／老載具／行動工作站 | 見 §3.3.3 | | | W0-3 | |
