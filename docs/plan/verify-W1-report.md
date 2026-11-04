# W1 驗收報告（2026-11-04）

> 驗收者：Lead。對象：AGY 的 W1（【富家子弟】示範案）。
> 判準：`docs/plan/03-quirk-plans.md` §1 的八個步驟 ＋ `08-agy-rules.md` §4。

## 0. 結論

**功能：通過。護欄：不通過（有 3 處假綠）。**

- 我用**自己的樣本**獨立驗了 18 條（`scratch/verify-w1.mjs`，18/18 通過）：面板真的掛在跑團卡上、
  三種狀態（未填／填好／達門檻）的禁用與原因都對、夾上限與不低於 0 都對、履歷 kind 與前後值都對。
- 但 AGY 那幾條「disabled」的斷言**永遠都會綠**——因為每個按鈕的 Tailwind class 都含
  `disabled:cursor-not-allowed`，`includes('disabled')` 與 `/…[^>]*disabled/` 一定命中。
  **把 `disabled` 屬性整個拿掉，測試照樣全綠。** 這是本專案第 N 次「全綠有兩種意思」。

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

## 2. 不通過：3 處**假綠**斷言（請修，修完我再驗一次）

### 問題的形狀

`FlowDataPanel` 的按鈕 class 是
`… cursor-pointer disabled:cursor-not-allowed disabled:bg-[#d6c7ab]`。
所以「這份 HTML 裡有沒有 `disabled` 這個字」**永遠是 true**，與按鈕是否真的 disabled 無關。

### 三處

| 檔案 | 行 | 目前的寫法 | 為什麼是假綠 |
|---|---|---|---|
| `tests/flowData.test.mjs` | 237 | `markupIncomplete.includes('disabled') && …` | `disabled:` class 一定命中 |
| `tests/flowData.test.mjs` | 253 | `!markupComplete.includes('flowdata-quirk:富家子弟-buff-disabled-careful')` | 這個 testid **根本不存在**（實際是 `use-buff-careful`），所以「不包含」永遠成立 |
| `tests/playHudFlow.test.mjs` | 194 | `/flowdata-quirk-富家子弟-use-buff-careful[^>]*disabled/` | `[^>]*` 會吃到同一標籤內的 class，含 `disabled:` |

另外 **Lead 自己早前寫的** `tests/playHudFlow.test.mjs:73`（B3）也有同一種病，這次一併修。

### 修法（請照抄）

1. 新增 `tests/helpers/domAttr.mjs`（兩個測試檔都 import，esbuild 會一起打包）：

```js
/** 取某個 data-testid 的整段標籤，並判斷它有沒有 `disabled` 屬性（不是 class 裡的 `disabled:`）。 */
export const tagOf = (html, testId) => {
  const at = html.indexOf(`data-testid="${testId}"`);
  if (at < 0) return '';
  return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
};
export const hasDisabledAttr = (html, testId) => {
  const tag = tagOf(html, testId).replace(/class="[^"]*"/, '');   // 先把 class 拔掉
  return tag !== '' && /\sdisabled(=|\s|>)/.test(tag);
};
export const hasTestId = (html, testId) => html.includes(`data-testid="${testId}"`);
```

2. 三處改成：

```js
// flowData.test.mjs 1.
check('1. 未填狀態：增益按鈕 disabled 且呈現未填齊警示',
  hasDisabledAttr(markupIncomplete, 'flowdata-quirk:富家子弟-use-buff-careful')
  && markupIncomplete.includes('尚未填齊資料'), true);

// flowData.test.mjs 2.（填好 → 必須「沒有」disabled 屬性，而且按鈕存在）
const buffId = 'flowdata-quirk:富家子弟-use-buff-careful';
check('2. 填好狀態：增益按鈕存在且沒有 disabled 屬性',
  hasTestId(markupComplete, buffId) && hasDisabledAttr(markupComplete, buffId) === false, true);

// playHudFlow.test.mjs H2
check('H2 未填齊保鑣時 HUD 內的增益按鈕為 disabled',
  hasDisabledAttr(richHtml, 'flowdata-quirk-富家子弟-use-buff-careful'), true);

// playHudFlow.test.mjs B3（Lead 補的）
const hasDisabled = hasDisabledAttr(html, 'flow-skill-元素師-災難-act');
```

3. **加一條「護欄自己會紅」的測試**（本專案的既有做法）：把一段已知**沒有** `disabled` 屬性的
   按鈕 HTML 餵給 `hasDisabledAttr`，斷言回 `false`；餵一段有的，斷言回 `true`。
   否則新加的 helper 也可能寫錯。

4. **破壞驗證**（回報要附數字）：
   - 把 `FlowDataPanel` 的 `disabled={!check.ok}` 拿掉 → 上面第 1 條必須轉紅；
   - 把它改成永遠 `disabled` → 第 2 條必須轉紅；
   - 兩次都要還原並確認回綠。

## 3. 另一件要你（使用者）點頭的事：AGY 改了規則檔

這一輪除了 W1 的程式，AGY 還動了：

| 檔案 | 內容 | 我的判斷 |
|---|---|---|
| `.agents/rules/10-code-rules.md` | 新增三條規則（未 import 的假綠、EmptyState、死碼 YAGNI）＋把「五個高頻陷阱」改名為「高頻陷阱」 | **內容正確、有價值**（這次的假綠正好是第 3 條的反面教材），但**規則檔是最高層級的文件**，要不要留在那裡請你裁 |
| `docs/handoff.md` | 新增 §1.8（未 import 的識別字盲區）與 §1.9（EmptyState） | 合適：handoff 的定位就是「不會變的坑」 |
| `docs/agents-changelog.md` | W0＋W1 的變更紀錄 | 合適，但**要與現實對得上**（W0 的接線當時還沒做） |

Lead 不會替他回退；請你決定：保留（我之後在 AGENTS.md 記一筆「規則檔變更需回報」）或回退。

## 4. 給 AGY 的下一步（修完 §2 才進 W2）

1. 修 §2 的三處假綠（含 Lead 的 B3），加 helper 與 helper 自檢。
2. 附破壞驗證數字。
3. 之後才進 **W2**：`controls[]` 套到 18 筆金手指、重置執行者已經有了（W0-7），
   把「每場景一次」真的會重置這件事補上逐筆驗收。
