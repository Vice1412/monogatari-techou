# W3 驗收報告（2026-11-05）

> 驗收者：Lead。對象：AGY 的 W3（特性資料 ＋【升級】的休息改造流程）。
> 判準：`06-traits-under-1000z.md` §6.4–6.6 ＋ `08-agy-rules.md` §4。

## 0. 結論

**資料與邏輯：通過。UI：原本完全沒有接（比 W2 之前更糟），已由 Lead 補上。**

AGY 交出的：
- `data/equipmentTraits.js`（24 筆特性）＋ `traitsFor`／`traitPrice`，數字與四張官方表**逐筆對得上**。
- `planUpgradeTrait`（驗證槽位、1000z 上限、折抵、餘額、履歷）＋ 23 條測試。

沒交出的（我抓到的）：
- **`planUpgradeTrait` 沒有任何 UI 消費者**——它只有測試在呼叫。
- `flowDataSpecs` 的 `records.fields` 宣告了 `options`／`source: 'EQUIPMENT_TRAITS:1000'`／`numeric`，
  但 `FlowDataPanel` **把它們全部畫成自由文字**：類別可打「飛彈」、特性可打「雷射砲」、
  `requires: { slotScope, maxCost: 1000 }` 沒有任何消費者。
- HUD 只在**金手指**區塊掛 `FlowDataPanel`，**英雄技能卡沒有**。而 `renderFlowControls`
  因為 `specFor('heroic:升級')` 存在而**抑制通用按鈕** → 【升級】在跑團卡上**什麼都沒有**。

也就是說：W3 讓【升級】從「有一顆會寫履歷的按鈕」變成「一片空白」。這是回歸，不只是缺口。

## 1. 資料層（實測）

| 槽位 | ≤1000z 筆數 | 內容 |
|---|---:|---|
| 武器 | **11** | 魔能100／獵人300／穿刺400／雙重獵人500／反狀態500／抵抗力700／護身符800／壁壘800／多重1000／雙重抵抗1000／破劍者1000 |
| 防具 | **6** | 反狀態500／抗性700／護身符800／壁壘800／雙重抗性1000／破劍者1000 |
| 盾牌 | **6** | 同上 |
| 飾品 | **5** | 傷害轉換300／先攻提高500／命中提高1000／魔法提高1000／生命力強化1000 |

與四張官方截圖一致；>1000z 的（免疫1500／狀態1500／完美健康2000／全能盾2000／狀態+2000／
癒合力強化1500／咒語強化2000／武具強化2000）也都在資料裡、只是不會出現在 ≤1000 的清單。
`traitPrice(700, 3) = 400`、`traitPrice(700, 9) = 0`（不為負）——對。

## 2. 邏輯層（實測）

`planUpgradeTrait` 的八種情況都對：讀高瞻遠矚 SL、槽位不符、>1000z、餘額不足、履歷 kind `heroic`、
扣款金額、`customPaid`、找不到特性。23 條測試全綠。

## 3. Lead 補的 UI（§3.1–3.3 是本輪主要工作）

### 3.1 `FlowDataPanel` 的欄位終於有型別
`records.fields` 現在支援三種宣告，並各自有 `data-testid`：

| 宣告 | 畫成 | 例 |
|---|---|---|
| `f.options` | `<select>`（靜態） | 類別：武器／護甲／盾牌 |
| `f.source === 'EQUIPMENT_TRAITS:1000'` | `<select>`，**依同一筆的類別過濾**、只列 ≤1000z | 特性 |
| `f.numeric` | `<input type="number">` | 支付金額 |

未選類別時特性下拉是 disabled 並寫「先選類別」——不是給一個空下拉讓玩家猜。

### 3.2 金額自動推導（`deriveUpgradePaid`）
選了類別或特性時，HUD 的 `onRecordChange` 會把 `paid` 換成
「特性原價 − 高瞻遠矚SL × 100（最低 0）」。玩家不必自己算，也不會算錯。

### 3.3 套用（`applyUpgradeDraft`）
記錄列多一顆「套用（扣款並寫履歷）」：扣 zenit、把該筆標成 `applied`、寫一筆 `kind:'heroic'` 履歷。
**已套用的那一筆再按會被拒絕**（`這一筆已經套用過了`）——避免重複扣款。
（這一條的守衛我補寫時被 here-string 吃掉一次，測試 8g 立刻轉紅，已補回。）

### 3.4 英雄技能卡掛上面板
`specFor('heroic:<名稱>')` 有值時，卡片內渲染 `FlowDataPanel`，並把
`onRecordChange`／`onAddRecord`／`onRemoveRecord`／`onApplyRecord` 接到角色資料。
這樣`renderFlowControls` 的「有 spec 就抑制通用按鈕」才不會變成空白。

## 4. 驗證

| 項目 | 結果 |
|---|---|
| Lead 自立驗收腳本（`scratch/verify-w3.mjs`） | **29/29**（資料 9＋邏輯 8＋UI 12） |
| `npm test` | 全綠 exit 0（`test:flowdata` 46→**54**、`test:equipmenttraits` 23、`test:flowui` 42） |
| `npm run build` | exit 0（10.0 s） |
| `test:emoji` / `test:uisystem` | 0 命中／295 全綠 |
| 破壞驗證 3/3（`scratch/break-w3-traits.mjs`） | 拿掉費用上限→紅；不折抵→紅；拿掉「已套用就拒絕」→紅 |

過程中我自己踩了兩個坑，都寫進腳本註解：
1. 驗收腳本第一次把 **id 當名稱**傳給 `flowItemForQuirk` → 四條全變成「找不到這條效果流程」。
2. `text-t10` 寫在一句提示語上，被 `test:uisystem` 的「中文段落不得低於 12px」攔下（改成 `text-t12`）。

## 5. 剩下的觀察（不擋 W4）

1. `applyUpgradeDraft` 內部呼叫 `planUpgradeTrait` 只為了**驗證＋算價**，再把它的 `patch` 丟掉、
   自己重建 patch。現在兩者一致，但這意味著同一個驗證寫在兩處；建議下一輪把
   `validateUpgradeInput()` 抽出來共用（我在 §3 的註解已標）。
2. `requires: { slotScope, maxCost: 1000 }` 目前仍只是宣告，面板是靠 `source` 字串判斷。
   若未來有第二個條目要用同一種「特性選單」，把 `source` 解析抽成一支函式（`traitsForField()`）。
3. 飾品特性（5 筆）目前**沒有任何入口**（【升級】不含飾品）。要不要讓「購買飾品」也能選特性，
   屬於上一層的商品流程，不在這份計劃內。

## 6. 下一步（W4）

`04-heroic-plans.md`：英雄技能 22 筆，先做 **G1（四筆單選，只改 JSON）**——那是零元件成本的。
交件時請附：四筆在卡片上出現下拉、選了之後重開卡還在（`flowState.choice`）。
G2（多選六筆）可直接用 W2 的 `multiSelect`。
