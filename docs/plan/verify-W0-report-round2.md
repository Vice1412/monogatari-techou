# W0 驗收（第二輪）：**通過，可以進 W1**

> 驗收者：Lead（獨立驗證，不只看 AGY 的測試）。
> 對照：`verify-W0-report.md` §2 的 A–D。
> 這一輪我另外寫了一支驗收腳本（`scratch/verify-w0b.mjs`，15 條），用自己的樣本跑**行為**。

## 1. A–D 逐項結果

| # | 上輪的缺陷 | 判定 | 證據 |
|---|---|---|---|
| **A** | `handleResetScope` 用了 `characterFlowItems`／`controlsOf` 卻沒 import（一按就 `ReferenceError`） | ✅ 修好 | import 區塊已含兩者（`CharacterPlayHUD.jsx` 的 `from '../utils/effectFlow'`）；我的驗收 A1–A3 三條通過；AGY 另外在 `playHudFlow` 加了「實際呼叫不拋錯」的斷言（比只比對原始碼更強） |
| **B** | 三顆重置鈕沒有渲染；一鍵休整沒串 rest | ✅ 修好 | SSR 渲染出 `reset-scope-scene`／`-rest`／`-chapter` 三顆且在同一段（B1–B4）；`resetFlowScope(withRest,'rest')` 真的把 `n` 歸零、`picks`/`text` 清空、**`fields` 保留**（B5–B7）；無對應 scope 時回原物件（B8）；`handleCampRest` 已 `nextChar = resetFlowScope(nextChar,'rest')` 並**一次寫入**（HP/MP＋營地次數＋休息重置同一筆 `loggableChange`） |
| **C** | `ChapterSettlementPanel` 沒有任何 importer（死檔） | ✅ 修好 | 以 `ChapterSettlementModal` 掛在 HUD（`<ChapterSettlementModal isOpen … onApply …/>`）；入口在 `handleEndSession` **成功之後**才開，且用 `chapterSettlementItems(next).length > 0` 擋掉空清單（我的 C1/C2 驗過：沒有金手指 → 空清單；【固執的懷疑論者】→ 非空）；`onApply` 走 `loggableChange` 一次寫入 |
| **D** | `PartyPicker.jsx` 死檔 | ✅ 修好 | 檔案已刪除；全 `src/` 沒有殘留引用（D1） |

## 2. 測試與建置（我實際跑的）

| 項目 | 結果 |
|---|---|
| `npm test` | **全綠、exit 0**。`test:flows` **187**、`test:flowdata` **36**、`test:playhudflow` **26**（上輪 22，＋4：三顆鈕、實際呼叫不拋錯…）、`test:florist` 157、`test:classResources` 通過 |
| `npm run build` | exit 0（16.6 s） |
| `test:emoji` | 0 命中 |
| Lead 自立驗收腳本 | **15 / 15 通過**（A/B/C/D 的行為，樣本自備） |

## 3. 兩個小觀察（不擋 W1，但請在 W1 的回報順手處理）

1. **`onApply` 的 patch 合併寫了兩次 `classResources`**（先 `...plan.patch` 再覆寫一次）。
   目前結果正確（第二次把物件攤平覆蓋），但那是「同一個意思寫兩遍」——
   建議收成一句：`classResources: { ...(character.classResources||{}), ...(plan.patch?.classResources||{}) }`，
   並在 `plan.patch` 裡**不要**放整個 `classResources` 物件（只放 `{ fatigue: n }` 這種局部）。
2. **`resetRoll` 只有 2 筆**（疲勞值、不穩定值）是正確的——另外三筆的 1d6 在「使用時」與「章節結算」，
   不在重置那一側。請把這個判斷寫進 W1 回報，免得下一個人以為漏了三筆。

## 4. 可以進 W1 的前提（已滿足）

- `flowState.fields` 容器與「重置不清名字」有測試釘住。
- `controls[]`／`multiSelect`／`text`／`recordList` 四種能力都到位（實際多控件條目留 W2）。
- 重置的**執行者**（三顆鈕＋一鍵休整）已接線。
- 章節結算有入口、有擋空清單。
- 死碼已清。

## 5. 交回 AGY 的下一步

照 `docs/plan/README.md` §0 進 **W1：【富家子弟】示範案**（`03-quirk-plans.md` §1 的八個步驟）。
W1 的回報請照 `08-agy-rules.md` §2，並附：六種狀態的 SSR 斷言（未填／填好／達門檻／章節恢復／履歷／重置不清 `fields`）。
