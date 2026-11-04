# 01 · 共通架構（先建好，再逐筆填資料）

> 本檔是計劃書的分冊（給 Antigravity 分冊閱讀）；入口與施工順序看 `docs/plan/README.md`。
> 索引與施工順序看 `docs/plan/README.md`；逐筆原文引用與行號看 `docs/plan/appendix-*.md`。
> 檔名 `01-architecture.md` 只是閱讀順序，不是施工順序——施工順序在 README。

## 2. 共通架構（先建好，再逐筆填資料）

### 2.1 為什麼要通用層，而不是每筆一個元件

本專案已經有十幾個「專屬面板」（工坊、花園、牌桌、夥伴、僕從…），每一個都是手寫的。
再加十幾個手寫面板的後果是可預期的：**同一個「填名字」在五個地方長得不一樣**，
而其中兩個會忘記夾上限。因此這一輪的方針是：

> **一份資料規格（`flowDataSpecs.js`）＋ 一支純函式層（`flowData.js`）＋ 一個通用面板元件。
> 每一筆條目只是資料，不是程式。**

### 2.2 資料放哪裡（**裁定：一個容器，不要兩個**）

名字／外表／戒律／預言這些「原文要玩家填的非數字資料」，一律放**既有的 `flowState`**，
不另開 `quirkData`（附錄裡兩位規劃員分別建議了 `quirkData` 與 `fields{}`——本文裁定用**後者**）：

```js
character.flowState['quirk:富家子弟'] = {
  n: 0, on: false, choice: '',
  fields: {                                  // ← 新增：任意非數字資料
    bodyguards: [
      { id: 'b1', name: '阿福', look: '光頭、左手有燒傷' },
      { id: 'b2', name: '小滿', look: '矮、總是戴著圍巾' }
    ]
  },
  picks: [],                                 // 多選（W0-2）
  text: '',                                  // 自由文字（主題曲名、儀式印記）
  list: [],                                  // 多筆記錄（陷阱的三格秘密記錄）
  updatedAt: '2026-11-04T12:00:00.000Z'
}
```

四條硬性規則：

1. **刻度不要放這裡**。刻度（疲勞值／不穩定值／異常值／懷疑點／顛覆點）已經有
   `character.classResources`＋`ClassResourceStrip` 在跑；再開第二個存放處就是兩個真相
   （目前**已經**有這個問題，見 W0-8）。
2. **`fields` 不受重置影響**：`flowResetState` 只清 `n`/`on`/`picks`/`text`/`list`。
   玩家填的名字被「場景結束」清掉，比不重置更難救。
3. **舊存檔沒有新欄位** → 一律回空預設（`fields: {}`／`picks: []`／`text: ''`／`list: []`），不寫遷移腳本。
4. **不必新增頂層欄位**：`flowState` 已存在，這一輪只擴充它的子欄位——遷移面積最小。

### 2.3 檔案與職責（新檔三個、改動四個）

| 檔案 | 動作 | 職責 |
|---|---|---|
| `src/features/character-sheet/data/flowDataSpecs.js` | **新增** | 每筆條目的資料規格（欄位、型別、必填、N 的上限、增益清單、結算時機）。**唯一事實來源** |
| `src/features/character-sheet/utils/flowData.js` | **新增** | 純函式：正規化、完整性檢查、能不能用（門檻）、用一次／結算一次的 patch 與履歷 |
| `src/features/character-sheet/components/FlowDataPanel.jsx` | **新增** | 通用面板：名冊編輯、增益按鈕、狀態切換、結算按鈕。**不寫入**，只回呼 |
| `src/features/character-sheet/utils/effectFlow.js` | 改 | `flowState` 擴充 `fields`／`picks`／`text`／`list`；`control` 支援陣列（W0-6）；重置語意（W0-7） |
| `src/features/character-sheet/components/SkillFlowControls.jsx` | 改 | 新增 `multiSelect`／`text`／`recordList` 三種控件；支援 `controls[]` |
| `src/features/character-sheet/components/CharacterPlayHUD.jsx` | 改 | 掛 `FlowDataPanel`（兩處）＋「場景／休息／章節」重置列（W0-7） |
| `scripts/build-effect-flows.mjs` | 改 | 吃 `controls[]`；順手移除死欄位 `control.step`（有輸出、全 repo 沒有讀者） |

### 2.4 規格的形狀（`flowDataSpecs.js`）

```js
export const FLOW_DATA_SPECS = Object.freeze({
  'quirk:富家子弟': {
    title: '保鑣',
    source: 'Bonus Collection p.20',
    // A 名冊型：原文「給他們一個名字，描述一下他們的外表」
    records: {
      label: '保鑣',
      min: 2,
      max: 2,
      fields: [
        { key: 'name', label: '名字', required: true, maxLength: 24 },
        { key: 'look', label: '外表', required: true, multiline: true, maxLength: 120 }
      ]
    },
    // B 增益選單型：原文三個增益
    buffs: [
      { id: 'careful', label: '小心！', describe: '受到傷害時減半', costDice: '1d6', clockId: 'fatigue' },
      { id: 'intel', label: '這是您先前需要的情報。', describe: '休息時向 GM 提一個問題', costDice: '1d6', clockId: 'fatigue' },
      { id: 'elemental', label: '臥倒，我會處理好的！', describe: '元素水晶追加【5＋等級一半】傷害', costDice: '1d6', clockId: 'fatigue' }
    ],
    // C 刻度型：**指向既有的 classResources 池**（不新開存放處）
    clock: { resourceId: 'fatigue', label: '疲勞值', max: 10, blockAt: 10 },
    // E 週期結算型：原文「每當章節結束……恢復 1d6 點疲勞值（最低降為 0）」
    settlements: [
      { id: 'chapter', label: '章節結束：恢復 1d6 疲勞值', dice: '1d6', clockId: 'fatigue', sign: -1, min: 0 }
    ],
    // 未填齊資料時能不能用增益？原文沒有說「沒填名字就不能用」，但玩家沒填就沒有人——
    // 所以規則：**資料未齊時按鈕存在但標「未填寫」並禁用**（見 §3.2 的理由）
    requireRecordsForBuffs: true
  }
});
```

### 2.5 純函式層的簽名（`utils/flowData.js`）

```js
export const normalizeFlowEntry = (character, itemId) => ({ n:0, on:false, choice:'', fields:{}, picks:[], text:'', list:[] });
export const specFor = (itemId) => FLOW_DATA_SPECS[itemId] || null;
export const readEntry = (character, itemId) => ({ records: [], picks: {}, state: {}, counters: {} });

export const recordIssues = (spec, entry) => [{ index, field, message }];   // 「第 1 位保鑣還沒填外表」
export const isEntryComplete = (spec, entry) => recordIssues(spec, entry).length === 0;

export const setRecord = (character, itemId, index, patch) => 新角色;      // 不可變
export const addRecord = (character, itemId) => 新角色;
export const removeRecord = (character, itemId, index) => 新角色;
export const setPick = (character, itemId, pickKey, value) => 新角色;

// ── W0-2 之後追加的四支（多選／自由文字／多筆清單）────────────────────────
export const togglePick = (character, itemId, pickKey, value, { min, max }) => 新角色; // 去重、保序、擋上下限
export const setText = (character, itemId, text) => 新角色;                            // 長度由 spec 決定
export const upsertListRecord = (character, itemId, record) => 新角色;                 // record 必須有 id
export const removeListRecord = (character, itemId, recordId) => 新角色;

/** 能不能用某個增益。回 { ok, reason }——reason 一律帶實際值（「疲勞值 9／10」）。 */
export const canUseBuff = (character, itemId, buffId) => ({ ok, reason });

/** 用一次增益：擲 costDice → 疲勞值 +N → 寫履歷。回 { ok, reason, patch, log, toast, roll } */
export const planBuffUse = (character, itemId, buffId, { roll } = {});

/** 週期結算：章節結束 → 疲勞值 −N（最低 0）→ 寫履歷。 */
export const planSettlement = (character, itemId, settlementId, { roll } = {});
```

**設計約束**（違反會被退件）：

1. `roll` 由呼叫端傳（UI 用 `Math.floor(Math.random()*6)+1`）。純函式**不得自己擲骰**——
   否則測試永遠只能驗「有變化」，驗不了「變化是幾」。
2. `patch` 只放真的要寫的欄位（`classResources`／`flowState`），**不要整個角色**。
3. `log` 走 `characterLog` 的既有形狀：`{ kind: 'quirk', title, changes, note }`。
   `kind` 必須是封閉詞彙內的值（現有：`hp/mp/ip/fp/zenit/exp/class/skill/heroic/quirk/camp/bond/clock/session/roll/equip/trade/note`），
   **不要新增 kind**——新增會讓舊履歷畫面找不到圖示。
4. 門檻訊息一律**帶實際值**：「疲勞值已達 10，無法再依賴保鑣」不要寫成「不能用」。

### 2.6 通用面板（`FlowDataPanel.jsx`）

```jsx
<FlowDataPanel
  spec={spec}                       // flowDataSpecs 的一筆
  entry={readEntry(character, itemId)}
  theme={theme}
  completeness={{ ok, issues }}     // recordIssues 的結果；未齊時增益禁用並寫原因
  clock={{ value: 7, max: 10, label: '疲勞值' }}
  onRecordChange={(index, patch) => ...}
  onPick={(key, value) => ...}
  onUseBuff={(buffId) => ...}       // 由 HUD 擲骰後呼叫 planBuffUse
  onSettle={(settlementId) => ...}
  testId={`flowdata-${itemId}`}
/>
```

- 名冊：每一筆一個小卡（名字＋外表），`−` 刪除、`＋` 新增（達 `max` 時禁用並說明）。
- 增益：一顆按鈕＋一行說明；門檻不足時 `disabled` ＋ **看得見的一行原因**（不能只改顏色）。
- 結算：一顆按鈕，按下去走 `planSettlement`，toast 寫「章節結束：疲勞值 9 → 7（−1d6=2）」。
- 全部 `data-testid` 前綴 `flowdata-<id>`，測試靠它定位（不要靠文字）。
- 顏色一律取自 `theme`；字級只能用 `text-t10`…`text-t39`；禁 Emoji。

### 2.7 HUD 掛載點（兩處，各一次）

| 位置 | 現況行號（2026-11-04 實測） | 掛法 |
|---|---|---|
| 金手指特質區塊（`hud-quirk-detail`） | `CharacterPlayHUD.jsx` 約 4200 | 在效果全文之後，`specFor('quirk:'+character.quirk)` 有值才渲染 |
| 掌握之英雄技能（`hud-heroic-skills`） | 約 4110 | 每一張英雄技能卡內，`specFor('heroic:'+resolved.name)` 有值才渲染 |

> ⚠️ 兩處都**只掛一次**。本專案踩過「同一個面板掛在兩個分頁」的坑（`F-020`），
> 修正方式是 `data/classPanels.js` 當唯一來源。這一輪請照同一個原則：
> **`FlowDataPanel` 只出現在它自己的條目卡上**，不要另外開一個「金手指工具」分頁。

### 2.8 履歷與統計

- 每次「使用增益」「章節結算」「填寫保鑣資料」各寫一筆 `kind:'quirk'` 的履歷，
  `title` 寫得出來（`使用保鑣增益【小心！】（疲勞 4 → 7）`）。
- `changes` 只放有中文標籤的欄位（`classResources` 沒有個別欄位標籤 → **放進 note** 而不是 changes）。

### 2.9 測試（新檔 `tests/flowData.test.mjs`，`npm run test:flowdata`）

至少 25 條，每條都要能失敗：

1. `normalizeFlowEntry`：缺欄／非物件／陣列 → 空預設，不炸。
2. `recordIssues`：缺名字、缺外表、超過 `max`、少於 `min` 各一條；齊了回空陣列。
3. `isEntryComplete`：`requireRecordsForBuffs` 的條目在未齊時 `canUseBuff` 回 `ok:false` 且訊息含「位保鑣」。
4. `canUseBuff`：疲勞 9 → ok；10 → 不可（訊息含「10」）；舊存檔沒有 fatigue → 視為 0。
5. `planBuffUse`：`roll=4` → `patch.classResources.fatigue = 目前+4`（夾上限 10）；`log.title` 非空；
   `roll` 沒傳 → 回 `ok:false`（**不自己擲骰**）。
6. `planSettlement`：`roll=6`、疲勞 3 → 0（最低 0，不是 −3）；`roll=2`、疲勞 9 → 7。
7. 不可變：呼叫後原角色物件不變（`JSON.stringify` 前後相等）。
8. 掃描自檢：`FLOW_DATA_SPECS` 每一筆的 `clock.resourceId` 都存在於 `CLASS_RESOURCES`（否則紅）。

**破壞驗證**：把夾上限拿掉 → 第 5 條紅；把 `roll` 自動補成亂數 → 第 5 條紅；
把最低 0 拿掉 → 第 6 條紅。

---
