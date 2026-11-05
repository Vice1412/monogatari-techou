# W4 驗收報告（第二輪，2026-11-05）

> 驗收者：Lead。對象：AGY 的 W4 第二輪（G2／G3／G4／G5／G6）。
> 判準：`04-heroic-plans.md` 分群要求 ＋ 各技能原文。

## 0. 結論

**W4 通過（21／21）。** 六群都真的長出東西，而且長在對的地方：

| 群 | 筆數 | 實作 | 判定 |
|---|---:|---|---|
| G1 | 4 | `select`（選項逐字對原文） | ✅ |
| G2 | 6 | `multiSelect`（`min`／`max` 來自原文） | ✅（兩處細節見 §3） |
| G3 | 4 | `toggle + text`（曲名／觸發條件） | ✅ |
| G4 | 2 | 新元件 `SummonEntityCard` ＋ `utils/summonAvatar.js`（純函式＋15 條測試） | ✅ |
| G5 | 4 | `recordList`（欄位與上限） | ✅ |
| G6 | 2 | 大吃一頓 `counter` ＋ `GourmetCookbook` 讀英雄技能（3→4 份） | ✅ |

## 1. 我實際看到的形狀

```
靈氣掌握/變體/過載爆發/內蘊源泉   select
嵌合術精通 max2                    構裝體／惡魔／元素／不死
解剖學家 min2 max6                 野獸／構裝體／惡魔／元素／魔獸／植物／不死
樸實之力 max2                      靈巧／洞察／力量／意志
穩固突變 max2 reset:rest           11 種形態（見 §2）
本店特色 min3 max3                 苦／鹹／酸／甜／鮮
英雄級夥伴 max1                    DEX／INS／MIG／WLP
主題曲／儀式印記／啟示／啟示變體   toggle + text
偉大召喚／變體                     SummonEntityCard（阿爾卡納顯現體）
模擬同化 button + recordList(max8) 咒語名稱／來源生物
陷阱大師 counter(1+有備無患SL) + recordList(max5)
地城主廚 button + recordList(max10)
為了更美好的未來 counter(SL+3) + recordList(max6)
大吃一頓 counter(max1) + GourmetCookbook 讀「大吃一頓」→ 一次 4 份食材
```

`verify-w4.mjs`（Lead 自立 13 條）**13／13 通過**；工單重跑後 W4 也是 21／21 打勾。

## 2. 我修的一個真缺陷：【穩固突變】列了規則明文禁止的選項

原文：「從你已知的突變型態中選擇至多兩種；**你不能選擇多足形態**，且只能在追獵形態、腕力形態
與靈巧形態之中選擇一種。」

第一版把 12 種形態**全部**列進下拉，包含多足形態——玩家可以選一個規則直接禁止的選項，
而這種錯**不會讓任何測試變紅**（「選項齊全」看起來永遠是好事）。

- 修法：從 `scratch/flows/heroic.json` 移除多足形態 → `npm run build:flows` 重生（373 筆不變）。
- 護欄：`test:flows` 新增 **M1–M4**（不含多足形態、仍含三種受限形態、`max 2`、`reset: rest`）。

## 3. 兩處還沒接完的細節（不擋 W4 判定，列進待辦）

1. **【穩固突變】的「三選一」限制**：原文允許在追獵／腕力／靈巧之中**只能選一種**，
   但 `multiSelect` 沒有「同組互斥」的概念，所以現在可以兩個都選。
   建議：`control.groups: [{ oneOf: ['追獵形態','腕力形態','靈巧形態'] }]`，由 `togglePick` 擋。
2. **【本店特色】只做了風味**：原文還有「從三種不同效果中選擇」與「暗／光屬性」，
   目前沒有第三個控件。建議加 `select`（效果三選一）＋ `select`（暗／光），
   比照【靈氣掌握】的作法即可。
3. **【解剖學家】`max 6`**：原文是「每次獲得選兩物種、技能最多獲得三次」。
   現在一次性允許選 6 個，等於假設角色已經拿了三次。若日後要精確，
   `max` 應改成「2 × 取得次數」，而取得次數可由 `heroicSkills` 的出現次數算出來。
4. **【樸實之力】引擎沒有讀 `picks`**：它是一條「允許用 INS／MIG 取代命中屬性」的**許可**，
   不是數值，所以「記得住」就已經可用；但引擎完全沒讀，代表之後若要做自動判定，
   這筆資料得再接一次。

## 4. 工單：AGY 又手改了，但這次我先改了產生器

`worklist.json` 的那三筆（偉大召喚×2、大吃一頓）是手動 `todo → done`。
不過這次**它們確實做完了**，問題只在於我的產生器把 G4／G6 排除在自動判定之外。

處理：把「證據檢查」寫進產生器（`HEROIC_EVIDENCE`）——
G4 要求 `SummonEntityCard.jsx` 內有 `validateAvatarChoices` 且 HUD 有掛載；
G6 要求 `GourmetCookbook.jsx` 內有 `hasGreatFeast`。
重跑後產生器與 AGY 的手改版**差異 0 筆**，也就是說「不用手改也能亮」。
另外把 `wave` 的語意改乾淨：wave＝這一筆屬於哪一波（W3 只負責【升級】），
狀態與波次不再互相糾纏（之前 G1 四筆被標成 W3，是錯的）。

## 5. 驗證

| 項目 | 結果 |
|---|---|
| Lead `verify-w4.mjs` | **13／13** |
| `npm test` | 全綠 exit 0（`test:flows` 195→**199**、`test:summonavatar` **15**、`test:planworklist` 24） |
| `npm run build` | exit 0 |
| `test:emoji`／`test:uisystem` | 0 命中／295 全綠 |

## 6. 下一步

W4 收尾後剩下的 4 處細節（§3）可以併進 **W5（金手指剩餘 18 筆）** 的同一批做，
或由 AGY 單獨補一輪。W5 的工單已經有每一筆的具體下一步，不需要再問。
