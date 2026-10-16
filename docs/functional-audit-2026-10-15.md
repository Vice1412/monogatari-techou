# 《物語手帳》功能健檢報告

> ## ※ 本報告有 4 處數字錯誤，已由 2026-10-16 第二輪複驗更正（2026-10-16 加註）
>
> **請以 `docs/functional-audit-2026-10-16.md` 為準。** 本檔保留原樣不修改，
> 因為它記錄了「當時怎麼判定的」——那份判定過程本身是有價值的教材。
>
> | 本報告的說法 | 實測更正 | 證據 |
> |---|---|---|
> | `shared/schema.js`（房間契約）**零測試** | **錯。有 46 個專屬斷言** | `tests/dataLayer.test.mjs:37` 匯入其 10 個匯出；E/F/G 段 `:223`～`:326` |
> | `keys.js` 註冊表**無測試護欄**、唯一性靠人工 | **錯。唯一性／無交集已被斷言** | `tests/dataLayer.test.mjs:96-112` |
> | `npm test`「**16 道**關卡全數通過（約 **3,000** 個斷言）」 | **錯。17 道、2,649 個斷言** | `package.json` 的 `scripts.test` 以 `&&` 串接 17 個指令 |
> | `src/` 107 檔、**37,405 行** | **單位混用**。37,405 只是 `.jsx`；含 `.js` 共 **51,069** | `find src -name "*.jsx" \| xargs cat \| wc -l` = 37,405 |
>
> **誤判原因（可複製的教訓）**：把「沒有專屬測試檔」當成「零測試」。
> `shared/schema.js` 沒有 `tests/schema.test.mjs`，所以被判為零測試——
> 但它其實是被 `tests/dataLayer.test.mjs` 匯入測的。
> **判定「有沒有測試」要看 `grep` 匯入路徑，不是看檔名。**
>
> 本報告**方向正確**的部分仍然成立：舊名前綴、`NPCWorkshop.jsx` 大檔、bundle 大小。

- **實測日期**：2026-10-15
- **範圍**：整個工作區 `E:\MINGWAN\Projects\monogatari-techou`
- **方法**：`npm test`／`npm run build`／`npm run test:emoji` 實跑 ＋ 靜態掃描（grep／wc）
- **基準守則**：一律以當前工作區實際源碼為準，未引用 `PROJECT_CHANGELOG.md` 或任何歷史報告作為現況結論

---

## 一、結論先行

**這個專案沒有功能層級的壞掉問題，基準全綠。** 16 道測試關卡（約 3,000 個斷言）全數通過，build exit 0，emoji 掃描 110 個檔案零命中。資料層已收斂乾淨，`src/` 全域沒有直接呼叫 `localStorage`。

但有 **1 個高優先級問題**、**4 個中優先級**、**5 個低優先級／觀察項**。

| 優先級 | 問題 | 風險 |
|---|---|---|
| **高** | `fu_companion_` 舊名前綴仍是 10 個 localStorage 權威鍵 | 與「舊名廢棄」目標直接衝突；使用者資料被鎖在舊名上 |
| 中 | `NPCWorkshop.jsx` 6,443 行，無對應測試 | 單檔改動風險極高 |
| 中 | `shared/schema.js`（房間契約）零測試 | 連線功能一上線就是裸奔 |
| 中 | `subscribe` 是死碼，卻寫在 store 契約裡 | 誤導後來接手的人 |
| 中 | build 單一 chunk 2,265 kB | 首屏載入慢（既有現象） |
| 低 | `keys.js` 註冊表無測試護欄 | 加錯鍵不會被發現 |
| 低 | 「中文（English）」看起來 28 筆違規，細查後是誤報 | 不用處理，但要知道 |
| 低 | `src/utils/properNouns.js`、`soundEffects.js` 零測試 | 低風險 |
| 低 | `00_Project_Index.md` 條目格式與其他專案不一致 | 純外觀 |

---

## 二、基準實測結果（全綠）

| 關卡 | 指令 | 結果 |
|---|---|---|
| 綜合測試 | `npm test` | **16 道關卡全數通過**（約 3,000 個斷言；另有 `grep` 統計得 18 個「全部通過」字樣，含 2 個獨立子項） |
| 建置 | `npm run build` | **exit 0**，9.86s，2050 modules。chunk-size 警告為既有現象 |
| 零 Emoji | `npm run test:emoji` | 掃描 110 檔（`src/` 與 `shared/` 的 .js/.jsx/.json/.css），**命中 0 行** |

測試關卡清單：資料完整性、取代目標存在性、差異標記、公測開關、閘門來源、資料模型（`name` 不變／`variantId` 承載選擇）、顯示解析、原版收起來、同技能多變體互斥、英雄技能互斥、規則層整合、回溯相容、儲存時帶 `variantId`、編輯模式顯示。

※ `grep` 到的 4 筆「失敗」字樣全部是測試名稱或預期中的錯誤訊息（如「字型內嵌失敗也不會讓匯出卡住」），**不是失敗日誌**。

---

## 三、高優先級：`fu_companion_` 前綴仍在實作裡

### 3.1 事實

GM 已裁定 `FU Companion` 因版權問題廢棄，但程式的 localStorage 權威鍵**仍全部帶舊名前綴**：

| 權威鍵 | 語意 |
|---|---|
| `fu_companion_npc_library` | NPC 檔案庫 |
| `fu_companion_character_roster` | 角色名冊 |
| `fu_companion_active_combat` | 進行中的戰鬥 |
| `fu_companion_fate_clocks` | 獨立命刻 |
| `fu_companion_sound_enabled` | 音效開關 |
| `fu_companion_character_theme` | 角色卡配色 |

另有 `fu_companion_creation_rules`（舊鍵）、`fu_companion_export`（`src/features/character-sheet/utils/fultimatorConverter.js:289` 的匯出 uid）、`fu_npc_library_backup_*`（`NPCWorkshop.jsx:2063` 的備份檔名）。

`src/` 內相關字串合計 14 筆，全域（含 docs、tests、.test-build）約 120 筆。

### 3.2 為什麼這不只是「改名」

這些鍵**承載使用者資料**。直接改字串會造成：已有玩家的角色卡全部讀不到，必須重新建角——這是不可逆的資料災難。

正確做法是**漸進式遷移**（`keys.js` 的 `LEGACY_KEYS` 機制已經有先例，`npcLibraryV2` 就是這樣做的）：

```
1. 新權威鍵改用新前綴（例：monogatari_npc_library）
2. migrateLegacyStorage() 加入：新鍵為空時才從舊鍵複製
3. 舊字串移進 LEGACY_KEYS，永不刪除
4. 跑一次遷移驗證 → 才在文件寫「已遷移」
```

※ 這個改動**跨多檔案且牽動使用者資料**，屬於高風險，**我不自批准，等 GM 裁定**。若 GM 決定要做，我會先提出完整的遷移計畫與回滾方案。

### 3.3 我的建議

**改，但分兩步**：先做 `keys.js` 的遷移（資料無虞，約 30 分鐘），匯出檔名與註解隨後。**不要一次全改。**

---

## 四、中優先級

### 4.1 `NPCWorkshop.jsx` 6,443 行，無測試護欄

- 單一檔案 6,443 行，佔 `src/` 總行數（37,405 行）的 17%。
- 專案裡已有一份 `NPC_WORKSHOP_REFACTOR_GUIDE.md`，看來早有重構打算但未動。
- 沒有任何 `tests/npcWorkshop*.test.mjs`。
- 檔案內已知含 localStorage 舊鍵的說明註解（`NPCWorkshop.jsx:1674`）與舊名備份檔名（`:2063`）。

**建議**：先補「行為護欄測試」（把現有輸出抓成快照），再動手拆。不要先拆後測。

### 4.2 `shared/schema.js` 零測試

房間同步契約（`SCHEMA_VERSION`、訊息型別、`isGmOnlyType`、`clampResource`、`toCombatantSnapshot`）沒有任何專屬測試。連線房間同步目前代為「待裁定」（見 `docs/room-sync-plan.md`，階段 0 已完成），但契約是「前端與 Worker 共用的唯一事實來源」——**它一旦有錯，兩邊會靜默算出不同結果**。

**建議**：至少為 `clampResource`、`isGmOnlyType`、`toCombatantSnapshot` 補一輪測試，這三個是純函式，測起來便宜。順帶一提，`tests/dataLayer.test.mjs` 已經覆蓋到 store 層，schema 沒理由裸奔。

### 4.3 `subscribe` 是死碼但寫在契約裡

`src/data/store.js:13` 註解說「提供 `subscribe`：目前供跨分頁與 UI 使用」，但全站 **0 個呼叫端**（`src/`、`tests/` 均無）。這是「看起來有功能、其實沒接上」的典型案例，會讓接手的人誤判現狀。

**建議**：兩個選項——要嘛真的接上（跨分頁同步是有意義的），要嘛從 store 移除並在 `docs/decisions.md` 記一筆「曾規劃但未實作」。**不要留著**。

### 4.4 單一 chunk 2,265 kB

`dist/assets/index-*.js` 2,265 kB（gzip 655 kB）。build 警告建議 code-split。屬既有現象，但 655 kB gzip 在手機上首屏會明顯等。

**建議**：低調處理。把 `NPCWorkshop`、`CharacterSheet`、`CombatTracker` 用 lazy import 拆開即可，不需要引入抽象層。

---

## 五、低優先級／觀察項

| 項目 | 現況 | 建議 |
|---|---|---|
| `keys.js` 無測試 | 10 個鍵的命名、唯一性、無前綴重複，全靠人工 | 補一個「鍵名不得重複、不得含舊前綴」的護欄測 |
| 「中文（English）」 | 掃到 28 筆，細查後**全部是誤報**（程式碼語法、註解、官方原文內文如「攻擊性咒語（O）」） | 不用處理。但若日後有人懷疑，這份報告就是證據 |
| `src/utils/properNouns.js` | 僅 4,306 bytes 專用名表，只有 `properNouns.test.mjs` 間接覆蓋 | 低風險，可不動 |
| `src/utils/soundEffects.js` | 零測試 | 音效用戶端容錯高，低風險 |
| `00_Project_Index.md` | 我加的條目用了 `🎴`，其他條目用自己的 emoji | 純外觀，可不管 |

---

## 六、關於「expert」事件的誠實回報

GM 問該用哪個 expert 來驗證專案，我實作了 WorkBuddy 的專家推薦流程，結果**告失敗**：

| 嘗試 | 查詢內容 | 回傳 |
|---|---|---|
| 1 | 完整意圖（程式碼審查／架構健檢）＋ 多組關鍵字 | `search_failed` |
| 2 | 中文意圖 | `search_failed` |
| 3 | 英文意圖 | `search_failed` |
| 4 | 單一關鍵字 `code review` | `search_failed` |
| 5 | 只給 `type: expert` | `search_failed` |

五次全部回 `search_failed`——**不是「查無相符專家」，是查詢本身失敗**。因此我**沒有推薦任何 expert**，也**不會編造專家的名字或 ID**。

現場能查到專家候選的唯一正規入口（`search_plugins`）目前不可用。建議 GM 稍後重試：WorkBuddy 側的專家中心若恢復，走「Code Review／架構健檢」類的單一專家最適合這個專案；本次健檢的性質（純本地靜態分析＋實跑關卡）其實不一定需要外部專家，我已用手動健檢完成。

**待觀察**：若專家中心恢復，值得問問是否有「重構／大型檔案拆分」類的專家。

---

## 七、驗證與執行摘要

| 項目 | 狀態 |
|---|---|
| `npm test` | 16 道關卡全通過（約 3,000 斷言） |
| `npm run build` | exit 0 |
| `npm run test:emoji` | 110 檔，0 命中 |
| 資料層稽核 | `src/` 全域無直接 `localStorage` 呼叫（另 2 筆僅為註解提及） |
| 純中文協調 | 28 筆疑似違規細查後全部為誤報 |
| 掃描統計 | `src/` 107 檔、37,405 行；`tests/` 7,436 行 |

---

## 八、DevVault 沉澱

本報告產出後，已將本次健檢結果寫入 DevVault（專案日誌＋全域時間線）。
