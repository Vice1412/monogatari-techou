# 逐筆工單（worklist）

> 由 `scratch/build-worklist.mjs` 從三份附錄與分群表產生；**不要手改**。
> `tests/planWorklist.test.mjs` 會比對「附錄有幾筆／工單有幾筆」，漏一筆就紅。

## W1 · 金手指示範案（1 筆）

| 狀態 | id | 群 | 要做什麼 | 驗收 |
|---|---|---|---|---|
| ✓ | `quirk:富家子弟` | Q1 | → 併入 W1（已完成） | 見 verify-W1-report.md |

## W2 · 多控件與重置（16 筆）

| 狀態 | id | 群 | 要做什麼 | 驗收 |
|---|---|---|---|---|
| ✓ | `quirk:被束縛的心` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:光榮的命運` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:老載具` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:天才的宿敵` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:應劫之人` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:交織的靈魂／戒指裡的老爺爺` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:神秘魔法書` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:大夢一場` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:行動工作站` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:偷來的載具` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:武器縛靈` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:(不太)忠誠的僕人` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:被詛咒之人` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:失憶古賢` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:百臉千面` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |
| ✓ | `quirk:天才發明家` | Q2 | → 併入 W2（已完成） | 見 verify-W2-report.md |

## W3 · 特性與【升級】（1 筆）

| 狀態 | id | 群 | 要做什麼 | 驗收 |
|---|---|---|---|---|
| ✓ | `heroic:升級` | G6 | counter＋reset（已有）＋資料表（特性／食材上限） | 休息時可用一次；跨休息會回充 |

## W4 · 英雄技能 22 筆（21 筆）

| 狀態 | id | 群 | 要做什麼 | 驗收 |
|---|---|---|---|---|
| ☐ | `heroic:靈氣掌握` | G1 | 宣告 control:select（只改 JSON，零元件成本） | 卡片出現下拉；選完重開卡仍在（flowState.choice） |
| ☐ | `heroic:靈氣掌握【變體】` | G1 | 宣告 control:select（只改 JSON，零元件成本） | 卡片出現下拉；選完重開卡仍在（flowState.choice） |
| ☐ | `heroic:過載爆發` | G1 | 宣告 control:select（只改 JSON，零元件成本） | 卡片出現下拉；選完重開卡仍在（flowState.choice） |
| ☐ | `heroic:內蘊源泉` | G1 | 宣告 control:select（只改 JSON，零元件成本） | 卡片出現下拉；選完重開卡仍在（flowState.choice） |
| ☐ | `heroic:嵌合術精通` | G2 | multiSelect + picks（W0-2 已有），spec 設 min/max | 選滿時其餘 disabled；picks 存得住；重開卡仍在 |
| ☐ | `heroic:解剖學家` | G2 | multiSelect + picks（W0-2 已有），spec 設 min/max | 選滿時其餘 disabled；picks 存得住；重開卡仍在 |
| ☐ | `heroic:樸實之力` | G2 | multiSelect + picks（W0-2 已有），spec 設 min/max | 選滿時其餘 disabled；picks 存得住；重開卡仍在 |
| ☐ | `heroic:穩固突變` | G2 | multiSelect + picks（W0-2 已有），spec 設 min/max | 選滿時其餘 disabled；picks 存得住；重開卡仍在 |
| ☐ | `heroic:本店特色` | G2 | multiSelect + picks（W0-2 已有），spec 設 min/max | 選滿時其餘 disabled；picks 存得住；重開卡仍在 |
| ☐ | `heroic:英雄級夥伴` | G2 | multiSelect + picks（W0-2 已有），spec 設 min/max | 選滿時其餘 disabled；picks 存得住；重開卡仍在 |
| ☐ | `heroic:主題曲` | G3 | text 欄位（W0-2 已有）；啟示類重用 ArcanistManager 表單 | 長字串可存；空白視同未填；不新增第二份資料 |
| ☐ | `heroic:儀式印記` | G3 | text 欄位（W0-2 已有）；啟示類重用 ArcanistManager 表單 | 長字串可存；空白視同未填；不新增第二份資料 |
| ☐ | `heroic:啟示` | G3 | text 欄位（W0-2 已有）；啟示類重用 ArcanistManager 表單 | 長字串可存；空白視同未填；不新增第二份資料 |
| ☐ | `heroic:啟示【變體】` | G3 | text 欄位（W0-2 已有）；啟示類重用 ArcanistManager 表單 | 長字串可存；空白視同未填；不新增第二份資料 |
| ☐ | `heroic:偉大召喚` | G4 | 新子實體卡（仿 NecromancerMinionSheet） | 未填齊 5 組選擇時不能按召喚；每組選擇有測試 |
| ☐ | `heroic:偉大召喚【變體】` | G4 | 新子實體卡（仿 NecromancerMinionSheet） | 未填齊 5 組選擇時不能按召喚；每組選擇有測試 |
| ☐ | `heroic:模擬同化` | G5 | recordList（W0-2 已有）＋各自上限 | 新增／刪除／到期可運作；上限來自資料不是寫死 |
| ☐ | `heroic:陷阱大師` | G5 | recordList（W0-2 已有）＋各自上限 | 新增／刪除／到期可運作；上限來自資料不是寫死 |
| ☐ | `heroic:地城主廚` | G5 | recordList（W0-2 已有）＋各自上限 | 新增／刪除／到期可運作；上限來自資料不是寫死 |
| ☐ | `heroic:為了更美好的未來` | G5 | recordList（W0-2 已有）＋各自上限 | 新增／刪除／到期可運作；上限來自資料不是寫死 |
| ☐ | `heroic:大吃一頓` | G6 | counter＋reset（已有）＋資料表（特性／食材上限） | 休息時可用一次；跨休息會回充 |

## W5 · 金手指剩餘（18 筆）

| 狀態 | id | 群 | 要做什麼 | 驗收 |
|---|---|---|---|---|
| ☐ | `quirk:信魔使徒` | Q4 | 已有 toggle／文字欄位：補上「按了會怎樣」的那一半（效果或結算） | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:棄暗投明之人` | Q4 | 計數器已由資源條承接：只缺「使用／結算」的按鈕與履歷 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:地獄差生` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:固執的懷疑論者` | Q4 | 計數器已由資源條承接：只缺「使用／結算」的按鈕與履歷 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:草木成精` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:來自遙遠的世界` | Q4 | 按鈕已存在但只寫 flowState：接上真正的效果（擲骰／資源增減）與履歷 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:傳家寶` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:古代武器` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:老大哥／歐尼醬` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:離鄉的妖精` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:倖存者` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:會說話的野獸` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:實驗逃亡體` | Q4 | 計數器已由資源條承接：只缺「使用／結算」的按鈕與履歷 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:新人類` | Q4 | 已有 toggle／文字欄位：補上「按了會怎樣」的那一半（效果或結算） | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:遺物使用者` | Q4 | 計數器已由資源條承接：只缺「使用／結算」的按鈕與履歷 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:墮落天使` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:束縛你的約定` | Q4 | 按鈕已存在但只寫 flowState：接上真正的效果（擲骰／資源增減）與履歷 | 每筆的「按了會怎樣」都有純函式＋測試 |
| ☐ | `quirk:被推翻的王` | Q4 | 目前沒有控件：先決定 control（button／toggle）再補資料欄位 | 每筆的「按了會怎樣」都有純函式＋測試 |

## W6 · 職業技能 28 筆（28 筆）

| 狀態 | id | 群 | 要做什麼 | 驗收 |
|---|---|---|---|---|
| ☐ | `class:徽記師:徽記學` | C6 | 新 SymbolistMarks 元件（19 種徽記） | 建立／摧毀／攜帶者可運作；不新增第二份清單 |
| ☐ | `class:徽記師:咒語徽記` | C6 | 新 SymbolistMarks 元件（19 種徽記） | 建立／摧毀／攜帶者可運作；不新增第二份清單 |
| ☐ | `class:植物學家:植生術` | C8 | 各自一個小欄位（choice／list／旗標） | 欄位存得住、重開卡仍在、履歷寫得出 |
| ☐ | `class:植物學家:嫁接` | C8 | 各自一個小欄位（choice／list／旗標） | 欄位存得住、重開卡仍在、履歷寫得出 |
| ☐ | `class:植物學家:生命之樹` | C8 | 各自一個小欄位（choice／list／旗標） | 欄位存得住、重開卡仍在、履歷寫得出 |
| ☐ | `class:美食家:烹飪` | C1 | inventory item 加 effectModel；BackpackItemModal 加欄位 | 模型可存、讀回一致；舊物品沒有模型時不炸 |
| ☐ | `class:美食家:加點愛` | C1 | inventory item 加 effectModel；BackpackItemModal 加欄位 | 模型可存、讀回一致；舊物品沒有模型時不炸 |
| ☐ | `class:美食家:鹽與胡椒` | C1 | inventory item 加 effectModel；BackpackItemModal 加欄位 | 模型可存、讀回一致；舊物品沒有模型時不炸 |
| ☐ | `class:商人:過期食品` | C1 | inventory item 加 effectModel；BackpackItemModal 加欄位 | 模型可存、讀回一致；舊物品沒有模型時不炸 |
| ☐ | `class:修補匠:藥水雨` | C1 | inventory item 加 effectModel；BackpackItemModal 加欄位 | 模型可存、讀回一致；舊物品沒有模型時不炸 |
| ☐ | `class:旅人:有備無患` | C2 | 新旅行骰面板（純函式先寫） | 骰階換算、SL 門檻、重擲各一條測試 |
| ☐ | `class:旅人:寶藏獵人` | C2 | 新旅行骰面板（純函式先寫） | 骰階換算、SL 門檻、重擲各一條測試 |
| ☐ | `class:旅人:通曉道路` | C2 | 新旅行骰面板（純函式先寫） | 骰階換算、SL 門檻、重擲各一條測試 |
| ☐ | `class:美食家:準備食材` | C2 | 新旅行骰面板（純函式先寫） | 骰階換算、SL 門檻、重擲各一條測試 |
| ☐ | `class:商人:貿易之風` | C3 | 收斂到同一個池（W0-8 backedBy）＋一顆花費鈕 | 跑團卡只剩一個貿易點數；花費寫 classResources |
| ☐ | `class:商人:真正的財富` | C3 | 收斂到同一個池（W0-8 backedBy）＋一顆花費鈕 | 跑團卡只剩一個貿易點數；花費寫 classResources |
| ☐ | `class:商人:我聽說過` | C3 | 收斂到同一個池（W0-8 backedBy）＋一顆花費鈕 | 跑團卡只剩一個貿易點數；花費寫 classResources |
| ☐ | `class:商人:小金庫` | C3 | 收斂到同一個池（W0-8 backedBy）＋一顆花費鈕 | 跑團卡只剩一個貿易點數；花費寫 classResources |
| ☐ | `class:靈師:支援魔法` | C4 | pendingBuffs[] 暫存表（不做跨卡寫入） | 新增／到期／移除各一條；不動別人的卡 |
| ☐ | `class:吟唱者:我相信你` | C4 | pendingBuffs[] 暫存表（不做跨卡寫入） | 新增／到期／移除各一條；不動別人的卡 |
| ☐ | `class:吟唱者:能言善辯` | C4 | pendingBuffs[] 暫存表（不做跨卡寫入） | 新增／到期／移除各一條；不動別人的卡 |
| ☐ | `class:機師:壓縮技術` | C4 | pendingBuffs[] 暫存表（不做跨卡寫入） | 新增／到期／移除各一條；不動別人的卡 |
| ☐ | `class:卡牌大師:孤注一擲` | C7 | 擲骰器加 mode（偶數翻倍／改一顆骰） | 判定抽成純函式並有邊界測試 |
| ☐ | `class:熵師:幸運七` | C7 | 擲骰器加 mode（偶數翻倍／改一顆骰） | 判定抽成純函式並有邊界測試 |
| ☐ | `class:狂怒鬥士:不屈意志` | C8 | 各自一個小欄位（choice／list／旗標） | 欄位存得住、重開卡仍在、履歷寫得出 |
| ☐ | `class:嵌合師:嵌合學派儀式` | C8 | 各自一個小欄位（choice／list／旗標） | 欄位存得住、重開卡仍在、履歷寫得出 |
| ☐ | `class:旅人:忠實夥伴` | C8 | 各自一個小欄位（choice／list／旗標） | 欄位存得住、重開卡仍在、履歷寫得出 |
| ☐ | `class:博學士:靈光一閃` | C8 | 各自一個小欄位（choice／list／旗標） | 欄位存得住、重開卡仍在、履歷寫得出 |

## W7 · 命刻搬家（1 筆）

| 狀態 | id | 群 | 要做什麼 | 驗收 |
|---|---|---|---|---|
| ☐ | `system:fateclocks` | W6 | 命刻搬到 character.clocks＋fateClocks 工具 | 技能可推進命刻；FateClocks 頁轉唯讀＋複製鈕 |
