# W6 驗收報告（2026-11-06）

> 驗收者：Lead。對象：AGY 的 W6（職業技能 28 筆 ＋ C5／C3 收尾）。
> 判準：`worklist.md` §W6 ＋ `w6-kickoff.md`（A1／A2／B1）＋ `decisions.md` **DA**（六項裁定）。

## 0. 結論

**W6 本體通過（28／28 都有承接者），但六項裁定全部沒做。** 裁定我直接補完了。

| 範圍 | 結果 |
|---|---|
| W6 的 28 筆職業技能 | ✅ 8 筆有真控件、20 筆交給既有面板；**20 筆的承接檔案全部存在且真的提到它** |
| C5 花園收尾（A1／A2） | ✅ 嫁接保留生長命刻、生命之樹離園治療都在 `FloristGardenTracker` |
| C3 貿易點數（B1） | ✅ 四筆有「花 N 點」按鈕（真正的財富是「獲得」，不算花費） |
| **DA 六項裁定** | ❌ **一項都沒做**（差生點池、2d20 收斂、穩固互斥、本店特色兩個下拉、解剖學家上限）→ **已由 Lead 補完** |

## 1. W6 本體：28 筆的證據

- 有真控件（8 筆）：貿易之風、真正的財富、我聽說過、小金庫、孤注一擲（button）、
  不屈意志（select+button）、嵌合學派儀式（select）、靈光一閃（counter+recordList）。
- 交給既有面板（20 筆）：徽記學／咒語徽記（`SymbolistMarks`）、植生術／嫁接／生命之樹（`FloristGardenTracker`）、
  烹飪／加點愛／鹽與胡椒／過期食品（`GourmetCookbook`＋新 `gourmetActions`）、
  藥水雨、有備無患、寶藏獵人、通曉道路、準備食材、支援魔法、我相信你、能言善辯、壓縮技術、忠實夥伴、幸運七。
- 這一層我另外寫了一支腳本（`scratch/verify-w6-existing.mjs`，60 條）逐筆確認
  **evidence 指的檔案存在，而且檔案裡真的提到這個技能**——因為 `via: 'existing'` 會讓通用按鈕消失，
  接錯就等於「玩家看到一片空白」（W3 的【升級】就是這樣）。

## 2. 六項裁定：AGY 沒做，我補完了

| # | 裁定 | 施工內容 | 驗證 |
|---|---|---|---|
| 1A | 差生點成刻度 | `classResources` 新增 `delinquent`（上限 10、不自動重置）；`+1d6` 走 `control.roll`；「自私片刻」新增 `control.zero: ['delinquent']`，`flowActionPlan` 真的歸零並寫「差生點 7 → 0」 | `test:flows` O1–O3；`test:resources` 102 條 |
| 2A | 2d20 收斂 | 移除【固執的懷疑論者】卡片上的 2d20 按鈕，只剩收場結算那一條 | `test:flows` 資料檢查 |
| 3A | 三形態互斥 | `control.groups: [{ oneOf: [追獵, 腕力, 靈巧] }]`；互斥規則抽成純函式 `toggleMultiSelectPicks`（SSR 測不到點擊，所以不能寫在元件裡） | `test:flows` O5–O9 |
| 4A | 本店特色補兩項 | 追加 `multiSelect(max 1)`（效果三選一）＋ `select`（暗／光），與原本的風味三選一共三個控件 | `verify-w6` C6 |
| 5A | 解剖學家上限 | `maxPerTake: 2` ＋ 純函式 `multiSelectMax(control, takes)`；`takes` 由 HUD 用「同名技能出現幾次」算出來 | `test:flows` O10–O14 |
| 6C | 飾品特性 | **不做**（使用者選 C） | — |

順帶修掉兩個「資料寫了、引擎沒讀」的洞：
- `COST_RESOURCES` 少了 `delinquent` → `zero` 會靜默略過（差生點永遠不會歸零）。加上之後 O2 才轉綠。
- 產生器 `formatControl` 沒有帶出 `zero`／`groups`／`maxPerTake`，資料寫了會被吃掉。
  （這種「宣告了但 builder 不傳」的洞，W5 的 `roll` 也遇過一次。）

## 3. 工單：把「名字白名單」換成證據判定

`build-worklist.mjs` 的職業技能原本用一份 `CLASS_DONE_NAMES` 白名單決定 ✓——
那等於「有人說做完了」，不證明接得上。現在改成 `classEvidence()`：

1. 自己有真控件，或
2. `via: 'existing'` 且 evidence 指的檔案**存在並提到它**。

重跑後 28 筆仍然是 28／28（因為證據都在），但下次有人只改 `apply.via` 不接面板，工單就不會亮。

## 4. 驗證

| 項目 | 結果 |
|---|---|
| Lead `verify-w6.mjs` | **24／24**（C5、C3、六項裁定、28 筆、新模組） |
| Lead `verify-w6-existing.mjs` | **60／60**（20 筆 existing 的承接檔案） |
| `npm test` | 全綠 exit 0（`test:flows` 207→**220**、`test:resources` **102**、`test:planworklist` 34） |
| `npm run build` | exit 0（12.2 s） |
| `test:emoji` | 0 命中 |

過程中的兩個自踩坑（都已修）：
1. `check(label, actual)` 忘了第三個參數 → 四條斷言全紅，看起來像程式壞了。
2. 驗 evidence 路徑的正則 `\.(js|jsx|mjs|json)` 寫成巢狀群組，把 `SymbolistMarks.jsx` 截成 `.js`。

## 5. 下一步

- W6 這一段**可以收**。剩下唯一沒動的是 **W7 命刻搬家**（`worklist.md` §W7）。
- 建議 W7 之前先做一次「資源條實機檢查」：新增的差生點刻度要看起來跟疲勞值一致
  （`ClassResourceStrip` 的 `resetLabel: null` 走的是「沒有重置鈕」那條路）。
