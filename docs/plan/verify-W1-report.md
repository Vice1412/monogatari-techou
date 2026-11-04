# W1 驗收報告（2026-11-04）

> 驗收者：Lead。對象：AGY 的 W1（【富家子弟】示範案）。
> 判準：`docs/plan/03-quirk-plans.md` §1 的八個步驟 ＋ `08-agy-rules.md` §4。

## 0. 結論

**功能：通過。護欄：原本不通過（3 處假綠），已由 Lead 直接修好並附破壞驗證 3/3。**

- 我用**自己的樣本**獨立驗了 18 條（`scratch/verify-w1.mjs`，18/18 通過）：面板真的掛在跑團卡上、
  三種狀態（未填／填好／達門檻）的禁用與原因都對、夾上限與不低於 0 都對、履歷 kind 與前後值都對。
- AGY 那幾條「disabled」的斷言**永遠都會綠**——因為每個按鈕的 Tailwind class 都含
  `disabled:cursor-not-allowed`，`includes('disabled')` 與 `/…[^>]*disabled/` 一定命中。
  **把 `disabled` 屬性整個拿掉，測試照樣全綠。** 這是本專案第 N 次「全綠有兩種意思」。
- 三處已改成「屬性判斷」並加了判斷工具的自檢；破壞驗證 **3/3**（見 §2 末）。

## 1. 通過的項目（附證據）

| 步驟 | 判定 | 證據（Lead 獨立驗證） |
|---|---|---|
| 資料欄位 | ✅ | `fields` 容器；重置保留名冊（`flowResetState` 不動 `fields`） |
| 規格 `flowDataSpecs` | ✅ | `records`（min/max 2、name/look 必填）＋ `buffs` 3 個 ＋ `clock.resourceId='fatigue'` ＋ `settlements` 1 筆 |
| 純函式層 | ✅ | `canUseBuff` 四段順序（無規格→未填齊→達門檻→可）；`planBuffUse`／`planSettlement` **沒給 roll 就拒絕**（不自己擲骰） |
| 面板掛載 | ✅ | SSR 渲染出 `flowdata-quirk-富家子弟`；**通用流程按鈕被抑制**（`flow-quirk` 0 次）——避免兩顆按鈕 |
| 三種狀態 | ✅ | 未填：按鈕 `disabled` ＋「尚未填齊」；填好（疲勞 3）：**無** `disabled` 屬性；達 10：`disabled` ＋「10 / 10」 |
| 邊界 | ✅ | 疲勞 9 + 5 → **10**（夾上限）；疲勞 2 − 6 → **0**（不低於 0） |
| 履歷 | ✅ | `log.kind === 'quirk'`；標題含「1 → 4」；patch **只寫 `classResources`**（沒污染 `flowState`） |
| 單一真相 | ✅ | 疲勞值一律讀 `classResources.fatigue`；面板顯示 `3 / 10` |
| 上次的兩個小觀察 | ✅ | `onApply` 的 `classResources` 不再寫兩次；死檔 `PartyPicker` 已刪 |

測試與建置（我跑的）：`npm test` 全綠 exit 0（`test:flowdata` **42**、`test:flowui` **29**、`test:flows` 187）、
`npm run build` exit 0（9.1 s）、`test:emoji` 0 命中。

## 2. 假綠：3 處（**已修**，附破壞驗證）

### 問題的形狀

`FlowDataPanel` 的按鈕 class 是
`… cursor-pointer disabled:cursor-not-allowed disabled:bg-[#d6c7ab]`。
所以「這份 HTML 裡有沒有 `disabled` 這個字」**永遠是 true**，與按鈕是否真的 disabled 無關。

### 三處與修法（Lead 直接改）

| 檔案 | 原本 | 修成 |
|---|---|---|
| `tests/flowData.test.mjs` | `markupIncomplete.includes('disabled')` | `hasDisabledAttr(markupIncomplete, 'flowdata-quirk:富家子弟-use-buff-careful')` |
| `tests/flowData.test.mjs` | 斷言一個**不存在**的 testid（`…-buff-disabled-careful`） | `hasTestId(...)` ＋ `hasDisabledAttr(...) === false`（存在且沒被禁用） |
| `tests/playHudFlow.test.mjs` H2 | `/…[^>]*disabled/` | `hasDisabledAttr(richHtml, …)` |
| `tests/playHudFlow.test.mjs` B3（**Lead 自己早前寫的**） | 同上 | 同上 |

新增 `tests/helpers/domAttr.mjs`：`tagOf`／`hasDisabledAttr`／`hasTestId`。
`hasDisabledAttr` 會**先拔掉 `class="…"`** 再判斷 `disabled` 屬性。

### 判斷工具自己的護欄（`flowData.test.mjs` 7a–7d）

- 7a `class` 裡有 `disabled:` → 必須回 `false`
- 7b 真的 `disabled=""` → 回 `true`
- 7c 找不到 testid → 回 `false`（不拋錯）
- 7d `hasTestId` 分得出有／沒有

### 破壞驗證 3/3（`scratch/break-disabled-fakegreen.mjs`，每次還原後逐字相同）

| # | 破壞 | 結果 |
|---|---|---|
| D1 | 拿掉 `disabled={!check.ok}` | `test:flowdata` **轉紅**（未填齊那條叫了） |
| D2 | 改成永遠 `disabled` | **轉紅**（填好那條叫了） |
| D3 | 把 helper 退回「不拔 class ＋ 看到 disabled 就算」 | **轉紅**（7a 叫了） |

> 記一個過程中的插曲：D3 第一次的破壞只換了正則、沒拔掉 class，結果**仍然全綠**——
> 因為 `\sdisabled(=|\s|>)` 這個錨點本來就不會命中 `disabled:`（後面接的是冒號）。
> 真正的病是「不拔 class ＋ 鬆散正則」兩件事**一起**，破壞驗證要重現那個組合才會紅。

## 3. 規則檔的變更：**保留**（使用者裁定）

AGY 這一輪除了 W1 的程式，還動了：

| 檔案 | 內容 | 裁定 |
|---|---|---|
| `.agents/rules/10-code-rules.md` | 新增三條規則（未 import 的假綠、EmptyState、死碼 YAGNI）＋把「五個高頻陷阱」改名為「高頻陷阱」 | **保留**。使用者原話：「那个 rule 是我让他自我学习的成果，不用删」 |
| `docs/handoff.md` | 新增 §1.8（未 import 的識別字盲區）與 §1.9（EmptyState） | 保留（handoff 的定位就是「不會變的坑」） |
| `docs/agents-changelog.md` | W0＋W1 的變更紀錄 | 保留，但**要與現實對得上** |

> 之後 Lead 驗收時，**規則檔的成長算正常輸出**，不再當成越界回報。
> 唯一仍要守的是：新規則必須是**這一輪真的踩到的坑**（不是抄來的口號），
> 而且不得與 `GEMINI.md`／`AGENTS.md` 的既有條文衝突。

## 4. 給 AGY 的下一步（可以進 W2）

1. 假綠已由 Lead 修完並驗證（§2），**W2 不用回頭處理**。
2. 進 **W2**：把 `controls[]` 套到 18 筆金手指（`02-wave0-primitives.md` W0-6 的機制已就位），
   並逐筆驗收「每場景一次」真的會重置。
3. 每一筆都要**刻意破壞驗證 ≥2 條**；disabled 這類斷言一律用 `tests/helpers/domAttr.mjs`。
