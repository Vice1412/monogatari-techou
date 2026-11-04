# W2 驗收報告（2026-11-05）

> 驗收者：Lead。對象：AGY 的 W2（`controls[]` 套到金手指 ＋「每場景一次」真的會重置）。
> 判準：`02-wave0-primitives.md` W0-6／W0-7 ＋ `03-quirk-plans.md` 的分群表。

## 0. 結論

**通過**。功能、資料形狀、重置生命週期都對；我另外補了三個**可測性與護欄**的缺口（見 §3），
並用破壞驗證 3/3 證明那三條規則真的被護住。

## 1. 這一輪做到的事（實測）

| 項目 | 數字／結果 |
|---|---|
| 多控件條目 | **16 筆金手指**（`controls.length > 1`），分佈：`button+text` 8、`counter+text` 3、`button+counter` 2、`button+button` 1、`toggle+text` 2 |
| 單控件／無控件 | 30 筆——其中 14 筆是 `backedBy`（計數器交給資源條顯示，刻意的），其餘是純常駐或純戰鬥 |
| 向後相容 | **`control` 與 `controls[0]` 逐筆相等（46/46）**——舊呼叫端（`renderFlowControls`、`flowItemForX`）不會壞 |
| reset 分佈 | scene 29／round 8／rest 4／hpZero 3／conflict 2／chapter 2／turn 1／none 14 |
| 「每場景一次」 | `flowActionPlan` 對**有 reset 的按鈕**預設上限 **1**，並在 `_uses`（`fields` 內）記次數；被擋時訊息寫「本場景使用次數已達上限（1／1）…」 |
| 重置生命週期 | `flowResetState` **刪 `_uses`、保留其他 `fields`** → 次數回充、玩家填的名字還在 |
| SSR 多控件 | `flow-quirk-c0`／`-c1` 都畫出來（以【天才發明家】【大夢一場】實測） |

資料層的兩個正確判斷值得記下來：
- 五顆 `reset: scene` 的按鈕，原文全都是「每場景一次」（【一點就通】【快速學習】【來自遙遠的世界】
  【天才發明家】【被束縛的心】），所以「預設 1」不是猜的。
- 【失憶古賢】的 rest 按鈕寫的也是「每次休息一次」。

## 2. 我跑的驗證

| 項目 | 結果 |
|---|---|
| Lead 自立驗收腳本（`scratch/verify-w2.mjs`，13 條行為） | **13/13** |
| `npm test` | 全綠 exit 0（`test:flows` 187→**195**、`test:flowui` 29→**42**、`test:flowdata` 46、`test:campoutcome` 157） |
| `npm run build` | exit 0（9.6 s） |
| `test:emoji` | 0 命中 |

驗收過程抓到一個**我自己的量測錯誤**：`flowItemForQuirk()` 吃的是**名稱**（它自己補 `quirk:`），
我先把 id 傳進去，於是拿到 `null`，後面四條全部變成「找不到這條效果流程」。
差一點把它當成程式缺陷——這與「找不到 ≠ 沒有」是同一類陷阱，已寫進腳本註解。

## 3. 我直接修的三件事（使用者授權「不妥就直接修」）

### 3.1 三種控件沒有內部 `data-testid`（可測性缺口）
`multiSelect`／`text`／`recordList` 原本只有外層容器有 testid，於是「選項有沒有 disabled」
「輸入框在不在」只能靠文字判斷（文字會隨文案漂）。補上：

| 控件 | 新增 |
|---|---|
| `multiSelect` | `-opt-<value>`、`-count`（已選 N／M） |
| `text` | `-input` 或 `-textarea` |
| `recordList` | `-add`、`-record-<i>`、`-field-<i>-<key>`、`-remove-<i>` |

### 3.2 「預設 1 次」是把雙面刃：補了「不要寫死」的護欄
`flowActionPlan` 目前對有 reset 的按鈕預設 1 次。若未來某條資料寫 `max: '3'`，必須真的允許三次。
`test:flows` 新增 **L1–L8**：預設 1（可／不可）、`max:'3'`（第 3 次後才擋）、無 reset（不設限）、
以及**重置後可再按一次**（行為判斷，不是「某個欄位不見了」）。

### 3.3 補 `recordList`／`multiSelect` 的 SSR 斷言
`test:flowui` 新增 J1–J3：text 的輸入框、counter 的加減鈕、名冊欄位都各有 testid 可定位。

## 4. 破壞驗證 3/3（`scratch/break-w2-limits.mjs`）

| # | 破壞 | 結果 |
|---|---|---|
| D1 | 拿掉「有 reset 時預設上限 1」 | **轉紅** |
| D2 | 忽略 `max`、一律當 1 | **轉紅** |
| D3 | 重置不刪 `_uses`（次數永不回充） | **轉紅**（補了 L8 之後才紅——第一次是綠的，這是本輪的收穫） |

> D3 第一次**仍然全綠**：因為原本沒有任何測試斷言「重置後可以再按一次」，
> AGY 的 I9–I11 只驗 toggle 的 `on`。補上 L8 之後才轉紅。**又一個「全綠有兩種意思」。**

## 5. 剩下的觀察（不擋 W3）

1. `_uses` 放在 `fields` 裡（與玩家填的名字同一個容器），靠 `flowResetState` 刪除。
   目前正確，但語意上「玩家資料」與「系統記帳」混在一起；若日後有人把 `fields` 拿去序列化或匯出，
   記得把 `_uses` 排除（建議匯出時白名單，而不是黑名單）。
2. `maxLimit` 的 `evaluateControlValue` 吃到 `activeControl.max`，若某筆資料把 `max` 寫成散文
   （例如「每次場景 2」），會回 `null`＝不設限——目前資料沒有這種寫法，但值得在 `build:flows`
   加一條驗證（`button.max` 若有值必須是算式）。

## 6. 下一步

可以進 **W3**（`06-traits-under-1000z.md`：特性資料 ＋【升級】的休息改造流程）。
W3 的資料量大（三張表的 id／花費／效果／slots 與「需要再選一項」），建議先做資料檔與測試，
再接面板；交件時附「`traitsFor()` 對 weapon／armor／shield／accessory 各回幾筆」的實測數字。
