# 07 · 命刻改由角色卡持有（裁定：要做；`FateClockPage` 之後刪除）

> 使用者原話：「要，就是給角色卡，fate clock page 我過後有打算刪掉的因為沒什麼用。」
>
> 所以這一冊要解決的是：**命刻的唯一真相搬到角色卡**，讓技能（【能言善辯】等）碰得到，
> 並為「刪掉 `FateClockPage`」鋪路。

## 7.1 現況（實測，2026-11-04）

| 位置 | 存什麼 | 誰在用 |
|---|---|---|
| `character.clocks[]` | 個人命刻：`{ id, title, totalSegments, filledSegments, theme, type }` | 跑團卡「個人命刻」分頁（`CharacterPlayHUD` 約 4598–4680）、角色卡 |
| `localStorage['monogatari_techou_fate_clocks']` | 全域命刻（另一份，與角色無關） | `src/features/clocks/FateClockPage.jsx`（`:10`、`:29`） |

**問題**：兩份命刻互不相通。技能若要「推進一格命刻」，它只能碰 `character.clocks`，
而玩家如果在 `FateClockPage` 上建立命刻，技能永遠看不到。

## 7.2 施工步驟

1. **純函式**（新增 `utils/fateClocks.js`）
   ```js
   export const normalizeClocks = (raw) => Array.isArray(raw) ? raw.filter(…).map(…) : [];
   export const addClockSegments = (character, clockId, n = 1) => 新角色;   // 夾在 0..totalSegments
   export const setClockSegments = (character, clockId, filled) => 新角色;
   export const findClock = (character, clockId) => clock | null;
   export const fullClocks = (character) => character.clocks.filter(c => c.filledSegments >= c.totalSegments);
   ```
   - 一律**不可變**、夾邊界、缺欄容忍（舊存檔的命刻可能沒有 `theme`／`type`）。
   - `addClockSegments` 是技能要用的那一支（例如【能言善辯】推進一格）。
2. **技能接線**
   - `utils/effectFlow.js`：新增 `counters: { clockId, n }` 型的動作（或直接在 spec 的 `settlements` 支援 `clock: { id }`）。
   - 第一批只接**明確會動命刻**的條目：【能言善辯】（職業技能，C4 群）、【靈光一閃】若需要、【背叛者】系列留待。
   - 驗收：按一次 → `character.clocks[i].filledSegments + 1`，履歷 `kind:'clock'` 且 `title` 說得出哪一顆命刻。
3. **`FateClockPage` 的退場**（分兩步，**不要一次刪**）
   - 第一步（本輪做）：頁面上方加一則說明「命刻已改由角色卡持有，這一頁保留唯讀」，
     並提供一顆 **「把這裡的命刻複製到目前角色」**（**明確按鈕、一次一人**，不要自動分配）。
     - 複製規則：`title`／`totalSegments`／`filledSegments` 照搬，`id` 重新產生（避免與角色既有命刻撞號）。
   - 第二步（使用者確認後）：移除路由與導覽入口，`STORAGE_KEYS.fateClocks` 只留讀取（舊資料不刪）。
4. **資料層**：`STORAGE_KEYS.fateClocks` **不要刪**——`tests/dataLayer.test.mjs` 會檢查鍵的註冊與遷移計畫，
   刪鍵要同步改測試。這一輪只加「唯讀」語意。

## 7.3 驗收（≥8 條）

1. `normalizeClocks(null) === []`；`normalizeClocks([{...缺 theme}])` 補預設 `amber`。
2. `addClockSegments` 夾在 `0..totalSegments`；`n` 為負也能往回推。
3. 不存在的 `clockId` → 回原角色（不炸、不新增）。
4. `fullClocks` 只回滿格的。
5. 不可變：呼叫後原物件不變。
6. 技能按鈕一按 → 命刻 +1 且履歷一筆（`kind:'clock'`）。
7. `FateClockPage` 的「複製到目前角色」不會覆蓋既有命刻（id 重新產生）。
8. 舊存檔（只有 `character.clocks`、沒有 `theme`）在跑團卡上照樣畫得出來。

## 7.4 刻意不做

- **不自動把全域命刻分給所有角色**（同一份資料在多張卡上各存一份＝四個真相）。
- **不刪 `STORAGE_KEYS.fateClocks`**（等使用者確認 `FateClockPage` 正式下線）。
- **不改 `ClockTracker` 的介面**（它是通用元件，四處在用）。
