# 04 · 英雄技能（22 筆，六群）

> 本檔是計劃書的分冊（給 Antigravity 分冊閱讀）；入口與施工順序看 `docs/plan/README.md`。
> 逐筆原文引用與行號看 `appendix-heroic-needs.md`。

## 0. 每筆的施工骨架（十群通用，照抄）

1. **資料**：`data/flowDataSpecs.js` 加一筆（欄位、`min`/`max`、增益或結算）。
2. **純函式**：`utils/flowData.js` 只加「這筆特有的判斷」，通用判斷不要複製。
3. **面板**：`FlowDataPanel` 若吃不下（子實體卡、清單），才寫新元件，並在下方表格標明。
4. **掛載**：「掌握之英雄技能」卡內掛一次（`CharacterPlayHUD` 約 4110）。
5. **履歷**：`kind:'heroic'`（既有），`title` 寫得出「哪一條技能、做了什麼」。
6. **測試**：純函式 ≥4 條；SSR 至少要「未填時禁用」與「填好後可按」各一條。

## 1. 六群總表

| 群 | 筆數 | 條目 | 先行件 | 施工要點 |
|---|---|---|---|---|
| **G1 單選** | 4 | 靈氣掌握、靈氣掌握【變體】、過載爆發、內蘊源泉 | 無（`select` 已全通） | **只改 `scratch/flows/heroic.json` 的 `control` 宣告**＋`npm run build:flows`；【內蘊源泉】的 `reset: 'rest'` 要寫對（每次休息重選） |
| **G2 多選** | 6 | 嵌合術精通、解剖學家、樸實之力、穩固突變、本店特色、英雄級夥伴 | **W0-2**（`picks`） | 每筆在 spec 寫 `min`/`max`（例：【解剖學家】取得三次 → `min:1,max:3`）；引擎側只有【樸實之力】要讀 `picks`（屬性替代） |
| **G3 自由文字** | 4 | 主題曲、儀式印記、啟示、啟示【變體】 | **W0-2**（`text`） | 啟示／變體：**重用** `ArcanistManager` 的自訂阿爾卡納表單，不要另寫一份 |
| **G4 子實體** | 2 | 偉大召喚、偉大召喚【變體】 | 新元件（仿 `NecromancerMinionSheet`） | 原文「任何選擇都必須在首次召喚時做出並記錄」→ 每個阿爾卡納一份資料，5 組選擇全部存 `list` |
| **G5 清單** | 4 | 陷阱大師、模擬同化、地城主廚、為了更美好的未來 | **W0-2**（`list`） | 陷阱大師：每個陷阱 3 格「秘密記錄」（原文自己說要寫在廢紙上 → 卡上顯示即可）；地城主廚：敵人已用名單；繁榮度：先當角色註記（裁定 D9：世界狀態留待 `room-sync`） |
| **G6 額度** | 2 | 升級、大吃一頓 | 既有 `counter` + `reset`；【升級】另需 `06-traits-under-1000z.md` | 【升級】改用 `07`／`06` 的特性清單（≤1000z）；【大吃一頓】要把 `GourmetCookbook` 的 3 份上限改成可覆寫 |

## 2. 逐群施工步驟

### G1（4 筆，零元件成本）
1. 改 `scratch/flows/heroic.json`：這四筆的 `control` 從 `none` 改成
   `{ kind:'select', label:'…', options:[…] }`，`options` 的值取自原文列舉（屬性／元素）。
2. `npm run build:flows` → 檢查 `effectFlows.json` 的 `control.kind === 'select'`。
3. **引擎**：只有【樸實之力】需要消費（見 G2）；其餘三筆目前只記錄、不計算 → 在 spec 標
   `consume: 'none'`（避免下一個人以為它會算）。
4. 驗收：卡片上出現下拉、選了之後重開卡還在（`flowState.choice`）。

### G2（6 筆，靠 W0-2）
1. `flowState` 擴充 `picks: []`（W0-2）＋`SkillFlowControls` 的 `multiSelect`。
2. 每筆 spec：`min`/`max`（【嵌合術精通】兩次、【解剖學家】三次、【樸實之力】兩個屬性）。
3. 選項來源：
   - 【穩固突變】＝ `skillSuboptionsData.js` 的突變形態名（**不要另抄一份清單**）。
   - 【本店特色】＝ 三種風味（原文列舉）。
   - 【英雄級夥伴】＝ 夥伴的屬性（`wayfarerCompanionData`）。
4. 驗收：選滿 `max` 時其餘 disabled；`picks` 去重；重開卡仍在。

### G3（4 筆）
1. 【主題曲】存曲名（`text`，≤40 字）；【儀式印記】存觸發條件（`text`，多行）。
2. 【啟示】／【啟示【變體】】：**改成呼叫 `ArcanistManager` 的表單**，把自訂阿爾卡納存進
   `character.arcanist.customArcanum`（既有欄位，先確認形狀），不要新增第二份。
3. 驗收：長字串可存；空白視同未填；啟示只留一份（重複建立時覆蓋並提示）。

### G4（2 筆，唯一要新元件）
1. 新元件 `components/SummonEntityCard.jsx`（仿 `NecromancerMinionSheet` 的 edit/play 兩模式）。
2. 資料：`flowState[...].list`，每筆 `{ arcanumName, choices: {...5 組}, hp, mp, note }`。
3. 原文要求「首次召喚時就要做完 5 組選擇」→ 未填齊時**不可**在跑團卡按「召喚」。
4. 驗收：每組選擇都有測試；未填齊 → 按鈕 disabled 且寫原因。

### G5（4 筆）
1. 【陷阱大師】：`list` 每筆三格（觸發／效果／秘密記錄），最多 `1 + 有備無患SL`（用 W0-2 的變數）。
2. 【模擬同化】：重用 `ChimeristManager` 的咒語清單，只加「來源」欄位。
3. 【地城主廚】：`list` 記錄「敵人 × 場景」，每場景一次。
4. 【為了更美好的未來】：繁榮度先做成 `counters`＋註記（裁定 D9）。

### G6（2 筆）
1. 【升級】：見 `06-traits-under-1000z.md` §6.5（`records` 型，每次休息一筆）。
2. 【大吃一頓】：`GourmetCookbook` 的「一次最多 3 份」改成讀 `flowDataSpecs` 的上限（英雄技能允許 4 種）。
3. 驗收：升級要付的錢算得對（`traitPrice`）；食材上限被覆寫後仍夾在 `10 + SL×5`。

## 3. 刻意不做

- G1 四筆**不**自動折進數值（屬性替代與每場景重選都是戰鬥／場景內判定，留給戰鬥視窗）。
- 【偉大召喚】的顯現體**不進戰鬥追蹤器**（本期只做資料卡；裁定 R5）。
- 【為了更美好的未來】不改世界狀態（繁榮度跨角色共享需要 `room-sync`）。
