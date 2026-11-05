# W5 驗收報告（2026-11-05）

> 驗收者：Lead。對象：AGY 的 W5（金手指剩餘 18 筆）。
> 判準：`worklist.md` §W5 每一列自己寫的「要做什麼」。

## 0. 結論

**14／18 通過，4 筆的「擲骰」沒接上——已由 Lead 補完機制，現在 18／18。**

- AGY 把 18 筆全部從「只有文字／沒有控件」推到「有控件＋有結構化效果」：
  5 顆按鈕有了 `gain:{fp:1}`（物語點真的會加）、1 顆有了 `cost:{subversion:1}`（顛覆點真的會扣）、
  來自遙遠的世界有「每場景一次」的場景上限並在重置後回充、束縛你的約定有 999 傷害的履歷。
  `tests/quirkFlow.test.mjs` 81 條。
- **但四筆的骰子沒有接**：`+1d6／+1d8` 只寫在按鈕的 `label` 上，`control` 沒有任何欄位表示它是擲骰，
  所以按下去只會寫 `flowState` 與一句「使用【X】」，**資源值一點都不會動**。
  這正是工單對這幾筆寫的要求（「接上真正的效果（擲骰／資源增減）與履歷」）。

| 條目 | 之前的按鈕 | 現在 | 判定 |
|---|---|---|---|
| 來自遙遠的世界 | button | button + `gain:{fp:1}` + 場景上限 | ✅ |
| 傳家寶／古代武器／離鄉的妖精 | 無 | text + button + `gain:{fp:1}`（章節結算） | ✅ |
| 棄暗投明之人 | 無 | text + button（`cost:{subversion:1}`） | ✅ |
| 束縛你的約定 | button | text + button（999 傷害履歷） | ✅ |
| 信魔使徒／草木成精／古代武器／老大哥／倖存者／會說話的野獸／新人類／墮落天使／被推翻的王 | 無 | text／toggle／select／multiSelect | ✅（備忘型，記得住就可用） |
| **實驗逃亡體** | button | button（`+1d8 不穩定值`） | ⚠️ 骰子沒接 → **已補** |
| **遺物使用者** | 無 | text + button（`+1d6 異常值`） | ⚠️ 同上 → **已補** |
| **固執的懷疑論者** | 無 | button×2（`1d6` 判定／`2d20` 章節） | ⚠️ 同上 → **已補** |
| **地獄差生** | counter | button×2（`+1d6 差生點`／自私片刻 `gain:{fp:1}`） | ⚠️ 差生點不是池子，仍是計數器 → 見 §3 |

## 1. 我補的機制：`control.roll`

純函式不擲骰（它也是這樣拒絕沒給骰值的呼叫），所以骰子只能落在 UI 這一層：

```
control.roll = { resource: 'instability', dice: '1d8', sign: 1, max: 10 }   // 純累積：增加量＝骰值
control.roll = { resource: 'doubt', dice: '1d6', onlyIfRollLte: 4 }          // 判定式：骰值只用來過門檻
```

- `effectFlow.js`：`COST_RESOURCES` 補 `instability`／`anomaly`／`doubt`；
  `flowActionPlan` 新增 roll 區塊（夾 0..max、判定式固定 +1、toast 印「1d6 擲出 3 → 懷疑點 2 → 3」）；
  沒給骰值 → `ok:false` 且理由寫「需要先擲 1d8」。
- `build-effect-flows.mjs`：`formatControl` 會帶出 `roll`（不然資料寫了會被吃掉）。
- `CharacterPlayHUD`：按鈕按下時依 `dice` 擲骰再交給純函式（`2d20` 也支援）。
- 資料：三筆（實驗逃亡體／遺物使用者／固執的懷疑論者）由 `scratch/add-roll-specs.mjs` 寫入
  （每筆在 `control` 與 `controls[0]` 各出現一次，手改很容易只改到一半）。
- 護欄：`test:flows` 新增 **N1–N8**——沒骰值要拒絕、純累積用骰值、累積不破上限、
  判定式只 +1、toast 印實際骰值。

## 2. 驗證

| 項目 | 結果 |
|---|---|
| `npm test` | 全綠 exit 0（`test:flows` 199→**207**、`test:quirkflow` **81**、`test:planworklist` 25） |
| `npm run build` | exit 0 |
| `test:emoji`／`test:uisystem` | 0 命中／295 全綠 |
| 工單 | W5 18／18，產生器與資料一致（無需手改） |

## 3. 剩下的三件事（不擋 W5 判定）

1. **地獄差生的「差生點」沒有池子**：`classResources` 只有 fatigue／instability／subversion／anomaly／doubt…
   沒有 delinquent。所以「自私片刻」的「所有差生點歸零」目前做不到（只加物語點）。
   要修就得先決定差生點是不是一個資源（上限？重置時機？）——這需要你裁定。
2. **懷疑論者的 `2d20` 章節判定**：`chapterSettlement.js` 已經有這條（2d20 ≤ 等級 → 懷疑點 +1），
   但按鈕本身沒接 roll（它的 `dice` 是 null 的結算項）。兩邊都按得到，數字也只會加一次，
   只是入口重複——建議之後把按鈕改成指向結算面板。
3. **`apply.via` 的分佈動了**：AGY 這一輪讓 `flow-control` 從 220 增加到 241（`existing` 51→46、
   `flow-listed` 98→82）。方向是對的（更多條目有自己的控件），但這代表有幾條原本標成
   `existing`／`flow-listed` 的條目改歸類，值得在下一輪的回報裡說明是哪幾條、為什麼。

## 4. 下一步

**W6 職業技能 28 筆**（`worklist.md` §W6，群別 C1–C8）。先做 C5（既有面板補操作，3 筆）
與 C3（貿易點數收斂），因為那兩群的元件都已經存在。
