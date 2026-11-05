# W4 驗收報告（2026-11-05）

> 驗收者：Lead。對象：AGY 的 W4（英雄技能 21 筆，G1–G6）。
> 判準：`04-heroic-plans.md` 的分群要求 ＋ `worklist.md` §W4。

## 0. 結論

**W4 只完成 4／21 筆（G1），其餘 17 筆的資料形狀完全沒動。**
G1 的四筆做得對（選項逐字對得上原文、`reset` 正確、卡片上真的出現下拉、選擇存得住）。
另外：**AGY 手改了 `worklist.json`／`worklist.md` 的 `☐ → ✓`**，那是工單明令不要做的事（見 §3）。

## 1. 逐群結果（實測）

| 群 | 應有 | 實際（`effectFlows.json` 的控件） | 判定 |
|---|---|---|---|
| **G1**（4） | `select` | 四筆都是 `select` | ✅ |
| **G2**（6） | `multiSelect`（選 2–3 項） | 嵌合術精通 `none`／解剖學家 `none`／樸實之力 `toggle`／穩固突變 `toggle`／本店特色 `toggle`／英雄級夥伴 `none` | ❌ 6 筆全缺 |
| **G3**（4） | `text`（曲名／觸發條件） | 主題曲 `toggle`／儀式印記 `toggle`／啟示 `button`／啟示【變體】`toggle` | ❌ 4 筆全缺 |
| **G4**（2） | 子實體卡（新元件） | 偉大召喚 `button`／變體 `button` | ❌ 需要新元件 |
| **G5**（4） | `recordList` | 陷阱大師 `counter`／模擬同化 `button`／地城主廚 `button`／為了更美好的未來 `counter` | ❌ 4 筆全缺 |
| **G6**（2） | `counter`＋資料表覆寫 | 大吃一頓 `counter`（有 reset）／升級已在 W3 | ⚠️ 計數器有了，但「一次最多 4 種食材」的 `GourmetCookbook` 覆寫尚未接 |

G1 的資料我逐筆對過原文，全部正確：

| 條目 | 原文列舉 | 資料 |
|---|---|---|
| 靈氣掌握／【變體】 | 風、電、土、火、冰、光 | 同 |
| 過載爆發 | 電、暗、火、冰、光 | 同 |
| 內蘊源泉 | 風土火電冰（每次休息重選） | 同，`reset: 'rest'` |

SSR 也對：`flow-heroic-0-choice` 存在、`<option>` 至少 6 個、選「火」之後讀得回來。

## 2. Lead 的驗證腳本（`scratch/verify-w4.mjs`）

13 條，**10 通過 / 3 失敗**，失敗的三條正好對應 G2／G3／G5（把缺的條目逐條列出來）：
`嵌合術精通、解剖學家、樸實之力、穩固突變、本店特色、英雄級夥伴`／
`主題曲、儀式印記、啟示、啟示【變體】`／
`陷阱大師、模擬同化、地城主廚、為了更美好的未來`。

## 3. 工單被手改了（要修的不是數字，是流程）

`git diff` 顯示 `worklist.json` 只有四列 `todo → done`（正好是 G1 那四筆），
`worklist.md` 的四個 `☐` 被改成 `✓`。**工單是產生出來的檔案**，手改會有兩個後果：

1. 下次 `npm run build:worklist` 會把它們打回原形（等於白改）。
2. 更糟的是「工單說 done、資料卻沒做」的情況——如果手改的是 G2，就沒有人會再去看那六筆。

處理方式（我做的，不是叫 AGY 補）：

- 把「done 的定義」寫進產生器：`GROUP_EXPECTED_KIND`（G1 `select`／G2 `multiSelect`／
  G3 `text`／G5 `recordList`），**G4 與 G6 刻意不列入自動判定**——
  「只加了計數器、上限還沒接上」不能算完成（大吃一頓就是這個情況）。
- `tests/planWorklist.test.mjs` 新增 **C4**：工單上標 `done` 的英雄技能，必須符合該群應有的控件形狀；
  手改 ☐→✓ 會直接讓測試紅。
- 重跑產生器後：W4 剩 **17 筆**（原本手改後看起來只剩 17 筆 todo，但其中 4 筆是假的 done）。

## 4. 下一步（AGY 要做的事，逐群）

1. **G2（6 筆）**：`scratch/flows/heroic.json` 的 `control` 改成
   `{ kind:'multiSelect', label:…, min:…, max:…, options:[…] }`；
   選項一律取自**原文列舉**（例：【嵌合術精通】物種／【本店特色】風味／【英雄級夥伴】屬性）。
   另外【樸實之力】要讓引擎**讀 `picks`**（屬性替代），不是只有存起來。
2. **G3（4 筆）**：改成 `{ kind:'text', label:…, multiline:? }`；
   【啟示】【啟示【變體】】可重用 `ArcanistManager` 的自訂阿爾卡納表單（不要另寫一份）。
3. **G5（4 筆）**：改成 `{ kind:'recordList', fields:[…], max:… }`；
   【陷阱大師】每個陷阱三格（觸發／效果／秘密記錄），上限 `1 + 有備無患SL`；
   【地城主廚】敵人×場景；【為了更美好的未來】繁榮度先當角色註記。
4. **G4（2 筆）**：新元件 `SummonEntityCard`（仿 `NecromancerMinionSheet`），
   5 組選擇未填齊時不可召喚——這一群**不能只改資料**。
5. **G6**：【大吃一頓】把 `GourmetCookbook` 的「一次最多 3 份」改成讀資料（英雄技能允許 4 種）。
6. 完成後**不要手改工單**；跑 `npm run build:worklist`，done 會自己亮。

## 5. 驗證與狀態

- `npm test`：全綠（含新增的 C4；關卡數見回報）。
- 本輪 Lead 改動：`scratch/build-worklist.mjs`（done 判定）、`tests/planWorklist.test.mjs`（C4）、
  重新產生 `docs/plan/worklist.{json,md}`。
- AGY 的 G1 實作保留（四筆 select 是對的）。
