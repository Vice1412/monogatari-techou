# Fabula Ultima Companion (FU Companion) - 專案紀錄與變更日誌

> ⚠️ **本文件為歷史紀錄，不得作為現況事實依據**（依 `GEMINI.md` 規則六）。
>
> **已證實的錯誤宣稱（2026-10-04 稽核）**——以下三處「零 Emoji 合規」的宣告與實測嚴重不符：
>
> | 位置 | 原文 | 實測 |
> |---|---|---|
> | `:51` | 「修改檔案中零 Unicode Emoji 字符。」 | 當時仍有大量殘留 |
> | `:88` | 「全站 100% 通過零 Emoji 檢測。」 | 當時仍有大量殘留 |
> | `:119` | 「角色卡、名冊、骰盅與時鐘體系通過零 Emoji 檢驗。」 | 當時仍有大量殘留 |
>
> **根因**：當時使用的檢測正則只能命中代理對（U+1F000+），**完全漏掉 BMP 平面 emoji**，
> 檢出率僅約 27.5%（按行）／34.8%（按次數）。此為「宣稱通過卻仍殘留」的直接原因，
> 已由 `GEMINI.md` 規則五.1 的修正版正則解決。
>
> ✅ **截至 2026-10-04，零 Emoji 已真正達成**（`src/` 命中 0 行 / 0 次），
> 但達成時間是**技術債三階段清理完成之後**，而非本文件任一歷史宣告的時間點。
>
> **判讀原則**：本文件可作為**專案意圖的歷史記錄**；任何關於現況的結論，一律以當前源碼為準。

---

本文件記錄專案的全局架構、核心設計約束、重要決策與每次代碼變更歷史，方便後續直接維護與追蹤。

---

## 📌 核心架構與設計約定 (Core Guidelines)

1. **圖示規範 (Icon Policy)**：
   - 全網站圖示**一律預設自 [Game-Icons.net](https://game-icons.net/)**（使用 `react-icons/gi` 函式庫），除非用戶另有明確指示。
   - 《Fabula Ultima》官方特有屬性符號（如物理、風、雷、光、暗等）採用官方字體與樣式類名（`.fu-icon`）。
2. **UI/UX 核心風格**：
   - 經典 JRPG 魔導書/羊皮紙暖色調風格（`#fbf7ee` 背景底色、`#3c2415` 深褐色主文字、琥珀金與復古黃銅色高亮）。
   - 首頁為書本封面入口（`BookCoverHub`），點選不同模組時伴隨翻書翻頁淡隱動畫（Page Flip Overlay）。
3. **模組架構**：
   - 📖 **書本封面入口 (Book Cover Hub)**：全螢幕進入點，獨立章節切換。
   - 🛠️ **NPC 工坊 (NPC Workshop)**：完整整合自 `fu-npc-builder`，支援嚴謹/自由規則、定位算法、技能樹、頭像裁切、圖片匯出與 JSON 存檔。
   - ⚔️ **戰鬥輪次 (Combat Tracker)**：支援從 NPC 工坊一鍵推入 NPC 入戰，管理先攻輪次與 HP/MP 消耗。
   - 📜 **角色卡助手 (Character Sheet)**：管理玩家角色屬性、職業與裝備。
   - ⏱️ **命刻記錄 (Fate Clocks)**：TRPG 推進時鐘與危機倒數。
   - 🎲 **全域浮動骰盅 (Dice Roller Modal)**：隨時可呼叫的雙骰檢定器。

---

## 📜 變更日誌 (Changelog)

### [2026-10-28] - 測試計畫 P18：F-031／F-033／F-032 三條純文案結案（12＋9＋6 分）

> 來源：`findings.md` 三條各自的「修法」段、`decisions.md` §CI57、`scratch/p18-*.mjs`。
> GM 裁定「先修 F-031 ＋ F-033」；F-032 是同一批字串、同一個掃描，一起做完。
> **這一輪沒有動任何規則、任何引擎**，只動文字與一個新的渲染小工具。

- **F-031（12 分）——術語終於有解釋**：`glossary.js` 12 → **16 條**（HR／物語點／IP／TP）。
  新增 `src/components/ui/termText.jsx` 的 `renderTextWithTerms()`：**在渲染時**把術語包成
  `TermHint`，`rulesData.json` 保持純文字（那個檔會被匯出、列印、逐位元組比對）。
  設計點：ASCII 術語要單字邊界（`HRX` ≠ `HR`）、中文不用；**同一術語只標第一次**
  （一句話長三個按鈕，鍵盤要 Tab 三次）。
- **F-031 的另一半**：`（o）` 五處**直接刪掉**——五處都緊接在「攻擊性咒語」後面，
  那個字母本來就是重複的圖示；`10×T` → 「10 × T（T＝目標數）」。
- **F-033（9 分）——標點與引用統一**：半角括號 34 處、半角逗號冒號 2 處、引用 9 處
  （統一成「（見《書名》p.N）」）、`精通技能` → `英雄技能` 4 處。
  白名單用「前一個字是不是 ASCII」表達（數學魔法的 `DEX, INS, MIG, WLP` 是英文列表），
  **不是「跳過整條技能」**——跳過的話它以後真的打錯字也沒人知道。
- **F-032（6 分）——錯字與簡繁**：位止／演湊／并且／聼／伙伴 共 11 處，`潔净月光` 改名 `潔淨月光`。
  修的時候**多發現一種**：`蠱惑之聲` 夾了兩個零寬字元（U+200B），肉眼看不到，一併清掉。
- **已知留白（不是漏修）**：`破釜沉舟` 的 `見 p.113`／`見 p.161` **只有頁碼沒有書名**。
  站內線索互相矛盾（可變形武器在別處一律標 HF p.107）、原書 PDF 在 shell 被擋，所以**不猜**。
  護欄把它**釘住**在「恰好 2 處」，數量一變就紅。
- **護欄**：新增 `tests/heroicText.test.mjs`（**53 條**，`npm run test:heroictext`，已接進 `npm test`）。
  引用判定寫成「先把合格的全部拿掉，再看剩下的還有沒有『見＋頁碼』」——
  **不用窮舉六種舊寫法，第七種也會被抓到**。
- **驗證三層**：破壞驗證 **17／17**（16 條護欄各弄壞一次 ＋ 還原後重跑全綠）；
  實機 **28／28**（`scratch/p18-ui.mjs`，含真的把焦點放上去、讀浮層文字）；
  全套 **31 支測試檔、5500 條斷言、0 FAIL**；`npm run build` exit 0。
- **改動**：`rulesData.json` 34 insertions／34 deletions（沒有整檔重排）、`glossary.js`、
  `HeroicSkillPickerModal.jsx`、`termText.jsx`（新）、`affinityText.test.mjs`（誤標表改名）、`package.json`。
- **台賬**：33 條立案，**32 已修**，只剩 **F-030**（GM 已裁定「我符合這個前提」勾選，待實作）。

### [2026-10-28] - 測試計畫 P9：英雄技能 115 筆跑完（覆蓋率最後一塊），立案 4 條

> 來源：`docs/playtest/sessions/2026-10-28-p9-heroic.md`、`findings.md` F-030～F-033。
> 這是 `99-summary.md` 從 P1 起一直掛著的「唯一的大洞」——115 筆英雄技能**從來沒有人讀過**。
> 本輪**不改程式**，只量：選得到嗎／前置講清楚了嗎／讀得懂嗎。

- **可達性（引擎實算）**：30 級 115／115、10 級（精通）113／115、5 級（開局名額）105／115。
  差的 10 條是官方黑名單 8 條 ＋ 要 30 級 2 條，**畫面都說得出為什麼**（實機 18／18 驗過）。
  → K3 內容可達率從 62%～74% 變成 **100%**。
- **新立案 4 條**（全部是「選得到但會被誤解」）：
  | ID | 一句話 | 分 |
  |---|---|---|
  | F-031 | HR／物語點／IP／TP／（o）／10×T 在 27 條效果裡出現，全站沒有解釋 | **12** |
  | F-033 | 標點與引用格式不一致（半角括號 15、半角逗號 3、六種「見…」寫法、精通技能 vs 英雄技能） | **9** |
  | F-032 | 錯字 3、簡體字 2、夥伴／伙伴不一致 | 6 |
  | F-030 | 33 條英雄技能的「且／並」前置，App 不檢查（按鈕照樣亮著） | 4 |
- **打勾表**：`checklist-heroic.md` 115 列全部 `☐ → ✔`，並掛上對應缺陷號
  （F-030 33 條／F-031 27 條／F-032 6 條／F-033 23 條）。
- **方法**：B 類 dump（`scratch/p9-dump-heroic.mjs`，115 筆 × 9 條規則）＋ 2 個實機場景
  （`scratch/p9-heroic-ui.mjs`）。**A 類只花在 dump 看不到的那一格——按鈕狀態。**
- **最大的一課**：**「缺陷清單空了」不等於「產品沒問題」，只等於「測過的地方沒問題」。**
  P17 才宣布 29 條全部結案，隔一天補完覆蓋率就冒出 4 條。

### [2026-10-27] - 測試計畫 P17：第四批五條結案（F-008／F-013／F-016／F-022／F-027），**29 條全部結案**

> 來源：`docs/playtest/99-summary.md` §六。這五條是「剩下還沒修完的 3 條 ＋ 修一半的 2 條」。
> 它們沒有一條會讓人做錯事，但每一條都會讓人**以為壞了**——在只有一個 GM 的小團裡，
> 「以為壞了」的代價是他不再相信這個工具。共同根因：**程式內部知道的事，沒有走到畫面上。**

- **F-008 首頁章節卡自稱「開發中／未完善使用」→ 已修**：
  - 新增 `src/components/book/chapterStatus.js`：`CHAPTER_STATUS`（complete／usable／wip）
    ＋ `chapterStatusOf`／`chapterStatusLabelOf`／`needsDevWarning`。
    封面的狀態標籤與 `App.jsx` 的「進站要不要攔」**從此讀同一份資料**。
  - 狀態分三級而不是兩種：「做完」與「可以上桌」不是同一件事，而玩家只在意後者。
  - 角色卡助手標「可用」、**不再被進站提醒攔下**；病句「未完善使用」全站移除，
    警告框改寫成「【NPC工坊】已完成，【角色卡助手】可以上桌使用；你正要進入的【X】還在施工中」。
- **F-013 受限模式主手彈窗留 18 顆死按鈕 → 已修**：
  - `technoRestrictsEquipment` 為真時，整個篩選工具列**不渲染**，原地換一顆「關閉並去鍛造」；
    副手的「盾牌／單手武器」切換鈕同樣收掉。
  - 說明由「到『定制武器』**分頁**鍛造」改成「鍛造面板**就在這一頁的下方**」——
    指路指錯比不指路更糟：不指路的人會自己找，指錯路的人會相信你。
- **F-016 守護者只剩 4 條技能卻不解釋 → 已修**：
  - 標題改吃清單長度（`{(def.skills || []).length} 項技能任選`），不再寫死 5。
  - 新增 `suppressedSkillsNote(names)`（`data/technospheres.js`）：一句話點名【雙重盾牌】
    並附出處 p.133；**職業選擇器與職業魔石區塊共用這一個字串**，兩個現場一字不差。
  - 不直接補上第 5 條技能：濾掉是對的（買了不會生效），問題不是「少了一條」，是「少了卻不說」。
- **F-022 覺醒之力占位句仍寫「還缺：觸發」→ 已修**：
  - 「還沒輪到」不是「缺」：未覺醒時不再把「觸發」列進缺項，改由占位塊的一句說明解釋。
  - 順帶修掉 `missing` 為空字串時仍印出一行光禿禿「還缺：」的顯示缺陷。
- **F-027 紙卡只印規則原文，不印「你選了什麼」→ 已修**：
  - 引擎新增 `describeQuirkChoice(char)` → `[{ group, label }]`；紙卡第 2 頁印「已選　咒語」。
    兩個值長得像就要說出它們各屬於哪一格（【會說話的野獸】有兩組選項）。
  - `rulesData.json` 補上【天才的宿敵】`options`、【會說話的野獸】`optionGroups`。
    **只補 2 筆不是 4 筆**：另外 2 筆已有替代去處，硬加會變成第二個能填同一個答案的地方。
- **方法論（四條，寫進 `docs/decisions.md` §CI56 與 `test-backlog.md` §4.5）**：
  - **掃字串只能證明「有人寫過」，不能證明「畫得出來」**：F-016 的護欄原本只檢查原始碼有沒有
    `mnemosphere-suppressed-note-`，把條件改成 `{false ? …}` 之後那串字還在檔案裡，
    護欄全綠、畫面全空。改成 SSR 真的渲染一次才修好（本輪 12 條破壞裡唯一沒抓到的那條）。
  - **破壞腳本的 `expect` 也是被測物**（同一個坑第二次）：護欄改名後腳本還在比對舊名稱。
  - **修好的東西會弄壞舊腳本**：F-008 讓「確定進入」消失，P15／P16 的實機腳本因此失效
    （它們不是被改壞，是被修好的）→ 已回頭修並重跑 30/30、22/22。
  - **`finally` 會把例外吞掉**：實機腳本第一版乙段拋錯時仍印「甲 12/12 全部通過」。
- **驗證**：護欄 58 條（uisystem H40 15／ui §CR 11／§CQ 16／§CS 9／zeropower §N2 7）；
  刻意破壞 **12/12**（第一輪 11/12，補強護欄後全中）；實機 **41/41**（`scratch/p17-ui.mjs`）；
  全套 30 支測試檔 **5446 條斷言全綠**；`npm run build` exit 0。
- **台賬**：29 條立案**全部結案、還開著 0 條**。下一個洞不是缺陷，是覆蓋率——
  115 筆英雄技能還沒跑。

### [2026-10-27] - 測試計畫 P16：第三批兩條結案（F-015／F-020），F-012 補到第 9 處

> 來源：`docs/playtest/99-summary.md` §六。這兩條原本排在「4 分以下，可做可不做」，
> 改判的理由是 F-015 的分數**隨名冊變大而放大**（P1 自己就是 20 張卡），
> 而 F-020 只要一張對照表，成本低於它造成的困惑。

- **F-015 名冊裡四張卡四組規則，外觀完全一致（6 分）→ 已修**：
  - 新增 `describeRuleBadges(rules)`（`data/creationRules.js`），回傳 `[{ key, label }]`。
    名冊卡在「職業」那一行下面印出徽章：`官方標準`／`魔晶石・完整規則`／`底力技`／`營地活動`……
  - **只印「與官方核心規則不同」的項目**。20 張卡每張印 8 條等於什麼都沒說。
  - **被別條規則強制決定的值不印**：魔晶石制開啟時，「定制武器」與「職業數」是 p.133 推導出來的，
    不是這個團的選擇，再印一次只是把同一件事說兩次。
  - 超過 4 顆收成「+N」，但 `title` 要列全部——**被收起來不等於可以消失**。
- **F-020 職業面板散落兩分頁，旅人／機師各掛兩次（4 分）→ 已修**：
  - 新增 `data/classPanels.js` 當「面板 → 分頁」的**唯一來源**（4 張表 ＋ 2 個純函式）。
    判準是「這個面板管的東西屬於哪一種操作」：載具／夥伴／僕從是戰鬥中的實體 → 住「武器與戰鬥」；
    模仿咒語管的是咒語清單 → 住「咒語與魔法」；其餘養成與收藏 → 住「職業特技」。
  - **刪掉三處重複掛載**（旅人、機師、嵌合師在「職業特技」的那一份）。
    8 個面板現在在整個 HUD 裡各掛一次，「職業特技」改為**只負責指路**：
    「※ 夥伴卡在『武器與戰鬥』分頁」。指路句也從同一張表派生，不手寫。
- **F-012 補到第 9 處（不是我去找的）**：
  - 掃描範圍從 `components/` 擴大到**遞迴整個 `character-sheet/`** 之後，
    `utils/characterEngine.js` 的驗證訊息自己跳出來——它是 `classCountPhrase` 的第三份複本。
  - 定義檔的放行方式改成「**恰好命中 1 次**」，不是整檔跳過（整檔跳過等於留一個無人看守的角落）。
  - 改完之後字面多了**一個空格**（「需配置 恰好 3 個職業」），是 `test:creation` 的完整字串比對抓到的。
- **方法論（三條，都寫進 `docs/handoff.md` §2.3.5 與 `test-backlog.md` §4.4）**：
  - **掃描的「邊界」和掃描的「邏輯」一樣會錯，而且錯得更安靜**（這是同一個錯誤的第三次）。
  - **「輸出看起來一樣」要用護欄驗，不能靠讀。**
  - **實機腳本每一步都要斷言「我真的到了那一頁」**，不要靠固定毫秒數——
    `loadRoster()` 的等待時間不夠，`確定進入` 還沒畫出來，整段在「名冊沒開」的狀態下量測，四條全紅。
- **驗證**：護欄 44 條（creation §F-015 16／ui §CP 6／playhudempty F-020 段 22）＋ F-012 再補 4 條；
  刻意破壞 **9/9**；實機 **22/22**（`scratch/p16-ui.mjs`，含三組反向控制）；
  全套 30 支測試檔 **5427 條斷言全綠**；`npm run build` exit 0。

### [2026-10-27] - 測試計畫 P15：第二批剩下三條結案（F-014／F-017／F-021），F-012 補到第三輪

> 來源：`docs/playtest/99-summary.md` §六「裁定清單」第二批第 2～4 件。
> 三條同為 6 分、同屬「看不懂但不會做錯事」，一起施工、一起驗證。

- **F-014 營地打造在魔晶石制下有兩個選項做不到，介面不提（6 分）→ 已修**：
  - 核心 p.131 的「營地打造」寫「免費製作一件基礎武器、防具或盾牌」；
    科技奇幻 p.133 的裝備白名單只剩定制武器／定制防具／飾品／機師模組
    → 「基礎武器」與「盾牌」整類不存在，三個選項實際只剩「防具」與「修復／拆解」。
  - 新增純函式 `campActivityModeNote(activityId, technosphereMode)`（`data/campActivities.js`），
    在**活動原文旁邊**加一段提示，**不動官方原文**。建角與跑團兩個分支都印。
- **F-017 29 個職業的定位句只寫在右邊詳情，左邊清單看不到（6 分）→ 已修**：
  - 清單卡在「又稱」下面補一行定位句，`line-clamp-2` 截兩行，完整句子放 `title`。
    用零筆新資料換到「點開之前分得出鐵壁守衛和時空術士」；右邊詳情面板照舊有全文。
  - 實機量測：清單 29 張卡、29 條定位句、0 條空白。
- **F-021 36 顆附魔魔石的下拉只有名字，要讀效果必須先鑲上去（6 分）→ 已修**：
  - 新增 `hoplospherePreviewLines(key)`（`data/technospheres.js`）回傳 `[{label, text}]`，
    第一筆是基礎效果，之後才是凝聚 2／凝聚 3（標籤寫「鑲 2 顆」——它是**門檻**，不是等級）。
  - `TechnospherePanel` 在 `pending` 有值時就印預覽，並標明「尚未鑲嵌」。
    **文字全部來自資料層**，面板只負責排版。
- **F-012 補到第三輪：這句「N~M 個職業」共 8 處，不是 5 處**：
  - P15 又撈到 3 處（`ClassPickerModal` 的紅字與按鈕文字、`CreationRulesPanel` 的官方標準行）。
    前兩輪都漏在同一個原因：**在「我記得的檔案」裡找**。
  - 護欄改掃 **整個 `components/` 目錄**（`readdirSync`，新增檔案自動納入），
    並改用正則同時涵蓋 JSX 的 `{min}~{max}` 與樣板字串的 `${min}~${max}`；
    掃描自己也要體檢（餵壞字串必須叫、餵正常字串必須不叫）。
- **護欄自身的一個缺陷（方法論）**：
  - 破壞驗證 ⑦ 兩輪回報「沒抓到」，真因是**測試檔在載入期拋錯**（`arr[1].text` 的 `[1]` 是 undefined），
    連「通過 X / Y」都沒印，腳本只看到 `fail = -1`。
    → 被測函式回空值時護欄要 **FAIL 不能 crash**；`fail = -1` 不是「沒抓到」，是「這條驗證根本沒跑」。
- **驗證**：
  - 護欄 24 條（camp §L 10、ui §CO 5、tech §X 9）＋ F-012 再補 6 條掃描。
  - 刻意破壞 **9／9** 全抓到，還原後逐位元一致。
  - 實機 **30／30**（`scratch/p15-ui.mjs`，含兩組反向控制）；F-018 的 11／11 也重跑過。
  - `npm test` 30 支測試檔、**5326 條斷言全綠**；`npm run build` exit 0。
- **順帶修好一支過期的實機腳本**：名冊卡上的「編輯」已改成「構築與成長」，
  P14 的 `p14-f018-ui.mjs` 因此整支失效（`scratch/` 不在版控，改文案不會有任何紅燈）。

### [2026-10-27] - 測試計畫 P14：F-018 結案（GM 裁定「這是玩家自己的選擇」），順帶修掉大小寫造成的兩個靜默 bug

> 來源：`docs/playtest/99-summary.md` §六「裁定清單」第二批第 1 件。

- **F-018 6 個職業的免費增益寫「HP +5 或 MP +5」，只說二選一、不說怎麼選（6 分）→ 已修**：
  - **GM 裁定**：「這個原本就是玩家自己選擇的」。→ 原本打算「補一句建議（會用 MP 的職業選 MP）」
    **不採用**：那等於替玩家決定，而原書只說二選一。改成在那一列直說
    「**由你決定，兩者都是永久 +5**」——回答的是「選錯會怎樣」（不會怎樣），不是「該選哪個」。
  - 6 個職業的 `freeBonus` 統一成 `HP +5 或 MP +5`，刪掉秘儀師【變體】孤零零的「(請依配置選擇)」
    （它有提示只是因為當初手寫在那裡，而它剛好是最不需要提示的進階變體）。
  - 按鈕補 `aria-pressed` 與 `data-testid`，畫面與讀屏都看得出「現在選的是哪一邊」。
- **查證時抓到同一根源的兩個真 bug（比本體嚴重，且沒有人會發現）**：
  - UI 按鈕寫**大寫** `'HP'`／`'MP'`，但修改記錄比**小寫** `'mp'` → **玩家選 MP，履歷永遠寫「最大 HP +5」**。
  - 列印卡也比小寫 → `freeBenefit` 永遠是空字串 → **列印卡上 29 個職業的免費增益全部消失**
    （不只這 6 個；守護者、遊蕩者、修補匠全都不印）。
  - 修法：新增三個純函式收斂寫法——`normalizeBenefitKey()`（大小寫正規化）→
    `resolveChosenBenefit()`（二選一的唯一判定入口）→ `describeFreeBenefit()`（印在卡上的那句話）。
    引擎／記錄／列印卡／職業卡四處全部改吃它。**舊存檔若存了小寫 `'mp'` 仍然算對。**
  - 非二選一職業的列印卡改印資料層原文（守護者＝「HP +5，職業防具/盾牌」），資訊只多不少。
- **順手抓到的第三件事**：做 F-018 時截了一張第 2 步的圖，畫面上還印著「創角規定：**3~3** 個職業」——
  F-012 那句「N~M 個職業」一共寫在 **5 個地方**，P13 只修了看得見的 2 處。
  改成 `classCountRange()`／`classCountPhrase()` 兩個純函式，5 處全部改吃；
  護欄除了驗函式輸出，還掃原始碼確認編輯器裡不再有手拼區間。
- **驗證**：新增護欄 41 條（引擎 §O 19、UI §CN 14、F-012 補漏 8）＋ 改寫 1 條記錄舊行為的斷言；
  刻意破壞 **11/11 全抓到**；實機 **11/11**（含「記錄真的寫 MP」「畫面不再有 3~3」）；
  全套 `npm test` **30 支 / 5298 條 / 0 FAIL**；`npm run build` 零錯誤。
- **文件同步**：`findings.md` F-018 改「已修（2026-10-27，P14）」並寫下結案理由與兩個附帶 bug；
  `99-summary.md` 已修 18→19、還開著 9→8；`test-backlog.md` 同步（§一 19 條／§二 8 條）；
  `decisions.md` 新增 `§CI53`；`resume.md` 改寫開場（第十五次）。

### [2026-10-27] - 測試計畫 P13：裁定清單第一批 6 條缺陷結案（術語層 ＋ 三個算錯 ＋ 兩處同名）

> 來源：`docs/playtest/99-summary.md` §六「裁定清單」第一批。判準＝**算錯 > 看不懂；擋流程 > 不擋**。
> 本輪只動「已證實的缺陷」，不新增功能。

- **F-028 全站沒有術語解釋層（9 分）→ 已修，改用 tooltip 而非辭典頁**：
  - GM 裁定：不要開新分頁、不要速查抽屜加目錄，**每個術語只給一句話**。
  - 新增 `src/features/character-sheet/data/glossary.js`（12 條，`short` 全部壓到**一句**，上限 60 字）＋
    `src/components/ui/TermHint.jsx`（虛線底線＋滑鼠移入／鍵盤聚焦才展開，`aria-label` 直接帶完整解釋）。
  - 落地 5 處：第 5 步副標（精通／英雄技能）、第 2 步（職業技能／特技／公測）、第 1 步（初始持有金幣）、
    身分靈感對照表（形容特質）。
  - **同時更正 `findings.md` 的一處錯誤定義**：「精通」是**該職業達 10 級**，不是「5 條技能全滿」。
- **F-025 選了卻沒有任何效果的選項（6 分）→ 已修**：
  - 倖存者①四項熟練度接進 `getProficiencies()`（與職業熟練度同一個回傳物件，取 OR）。
  - 富家子弟 +1000z 改為**記帳式**：新增 `buildQuirkPatch()` 記錄 `quirkZenitBonus`，只補差額。
    實測 500 → 1500 → 換掉 → 500 → 再選 → 1500，**不會累加成 2500**。
  - 其餘三個「玩家必須自己挑」的選項（倖存者②／墮落天使①②）在選單上直接印出需要手動處理的內容。
- **F-024 空手道徒手傷害 +6 沒進攻擊公式（6 分）→ 已修**：
  - 加成改為折進**複製的**武器資料（`withHrBonus()`），不動共用資料，避免污染其他角色。
  - 跑團面板與列印卡第 2 頁從此讀同一個數字；「徒手傷害 +6」重新出現在相性區塊（兩邊終於一致）。
- **F-012 ＋ F-011 同一行 `if` 造成兩個後果（6／3 分）→ 已修**：
  - 職業數上下限相同時改印「需配置**恰好** N 個職業」（原本印「2~2 個」）。
  - 職業數那條已經發言後，魔晶石那條不再重複報同一件事（加 `classCountReported` 旗標）。
  - 順帶修掉第二份硬編碼：`CharacterCard` 原本寫死「起始需配置 2~3 個職業」，改為從開卡規則派生。
- **F-029 「特質」同時指兩件事（6 分）→ 已修**：
  - 第 5 步更名為「英雄技能與**金手指**」（實際內容就是金手指／底力技／營地活動）。
  - 第 1 步 d20 身世表的「特質」**刻意不動**——那才是官方原意，改錯會更糟。
- **驗證（三層全綠才改狀態）**：
  - 護欄：新增 73 條斷言；全套 `npm test` ＝ **30 支測試檔 / 5257 條斷言 / 0 FAIL**。
  - 破壞驗證：21 處刻意改壞，**21/21 都被抓到**（含「替換是否真的發生」的斷言，避免 CRLF 假綠燈）。
  - 實機瀏覽器：52 條斷言全過（術語 13／F-025 16／F-024 6／F-012 9／F-029 8）。
  - `npm run build` 零錯誤；`npm run check:agents` 距上限仍有 24,891 bytes。
- **文件同步**：`findings.md` 六條狀態改「已修（2026-10-27，P13）」＋新增 §七；
  `99-summary.md` 已修 12→18、還開著 15→9；`test-backlog.md` 同步並拆出 §4.2；
  `decisions.md` 新增 `§CI52`（6 條決策記錄）；`handoff.md` 補三條新教訓；`resume.md` 改寫開場。

### [2026-09-26] - 規則沉澱 (/learn) 與規則概念速查全量校準
- **專有機制與子系統零臆測規範寫入 GEMINI.md (Rule 2.4)**：
  - 嚴禁憑經驗或泛用 TRPG 習慣自行編造等級階級、不存在的檢定或簡化數值。凡涉及專有子系統（造物專案、小工具、儀式等），實裝前必須直接閱讀官方 PDF 查核原始公式與表格倍率。
- **純中文顯示鐵律寫入 GEMINI.md (Rule 3)**：
  - 嚴格禁絕以「括號附帶英文原名/譯名」的格式呈現。名詞標題純粹化，去除所有中英雙語夾雜，僅保留官方必要縮寫【DEX/INS/MIG/WLP】、【HP/MP/IP】、【HR】、【SL】、【DEF/M.DEF】、金幣【z】與骰子規格【d6/d8/d10/d12/d20】。
- **規則概念速查數據庫 (`ruleCodexData.js`) 全面重構**：
  - **阿爾卡納 (Arcana)**：收錄官方核心 9 大阿爾卡納完整名錄（鍛造、霜、門、魔典、橡樹、天空、劍、塔、輪）。校準劍之阿爾卡納無解除效果，將多重攻擊與自動解除正確歸入連結增益；所有領域、連結與解除效果皆以純中文完整記載。
  - **小工具發明 (Gadgets)**：
    - **煉金術**：收錄基礎 (3 IP)、高級 (4 IP)、最高 (5 IP) 混合藥劑規則，補齊 20 面的「目標表（1~6, 7~11, 12~16, 17~20）」與「效果表（1~20 + 任意備選）」。
    - **灌注術**：明確標明「技能對象：你」，收錄命中 2 IP 觸發、多重擴散、不可重複灌注、吸血限單一目標等核心規則；列出基礎（低溫、焦火、電壓）、高級（疾風、驅邪、地震、暗影）與最高（吸血、毒液）全量目錄。
    - **魔科技**：對齊 Core v1.1 最新機制。基礎【魔科技篡奪】(10 MP) 修正為即時解除敵人狀態、揭示數據並作為盟友強制執行動作；高級【魔加農】修正為 2 IP 並補齊雙手欄位為空時立即裝備並自由攻擊之全套數據；最高【魔法球】修正為 2 IP 免費執行咒語動作與 3 -> 4 -> 5 個原型上限。
  - **核心法術書 (Core Spellbooks)**：
    - 全量收錄三大施法職業共 38 門咒語詳細規則。
    - **元素魔法 (13 門)**：補齊官方漏譯的【巨石】（20 MP，單體 HR+25 土屬性無視抗性）；旋渦對齊 Core 1.1 的高壓風刃斬擊傷害。
    - **熵系魔法 (12 門)**：對齊 Core 1.1 勘誤，【加速】更新為回合結束自由攻擊或<=10MP施法、【黑暗武器】修正為 5 MP、【抽取精魂】更新為 HR+20 MP、【歐米茄終結】修正為 15 MP。
    - **靈魂魔法 (13 門)**：【光環】與【屏障】補齊 20/40 級時 13/14 點的動態增長；完整收錄【靈魂護罩】（5 × T MP，暗/光/毒抗性）；【靈魂武器】修正為 5 MP。
  - **儀式魔法、造物專案、忠實夥伴**：
    - **造物專案 (Projects)**：依據官方手冊第 134~139 頁真實規則全面重構，徹底拔除虛構階級與不存在的擲骰檢定。完整收錄官方**六大造物步驟**、**三大計算乘數表**（效力表小/中/大/強、範圍表個體/小型/大型/巨型、使用次數表消耗品/永久）、特殊成分冒險材料、致命缺陷減免 25% 成本、**進度公式（總成本 / 100z）**與**每日參與 PC +1 / 修補匠額外 +1 / 特技《高瞻遠矚》額外 +SL / 幫手半價薪酬每日 +1 的自動推進機制**，並完整收錄 9 大官方經典範例（「探索者」號飛艇、加特林魔像、磁力靴、魔科技動力裝甲、禁魔刺樁、純潔之塵、火元素精油、催眠瓦斯、潛水頭盔）。
    - **儀式魔法 & 忠實夥伴**：全量純中文標準化，補齊 6 大儀式學派、效力/範圍乘數表、忠實夥伴屬性與動態 HP 公式。
- **速查彈窗 (`RuleCodexDrawer.jsx`) 渲染重構**：
  - 移除標題處英文顯示；阿爾卡納【合體】修正為官方【連結】。
  - 為修補匠三大工藝設計專屬視覺卡片（煉金術調配表與 20 面效果滾動表、灌注術對象標籤與三階矩陣、魔科技魔加農武器數據條）。
  - 為核心法術書提供即時搜尋過濾功能，流暢檢索 38 門咒語。
- **防退化檢驗**：
  - 修改檔案中零 Unicode Emoji 字符。
  - 通過 Vite Production Build (`npm run build`)，零錯誤。

### [2026-09-26] - 核心 15 職業技能校準：確立官方英文 Core v1.1 機制與民間漢化譯名雙軌鐵律
- **最高持久原則寫入 GEMINI.md**：
  - 確立「**官方英文最新勘誤版 (`Fabula_Ultima_Core.pdf` Core v1.1 Errata) 為機制與數值基準**」、「**民間漢化版為中文名詞翻譯標準**」、「**衝突時無條件以官方英文為最高優先**」。
- **角色卡數據庫 (`rulesData.json`) 7 大關鍵偏離校準**：
  - **守護者 (Guardian)**：將誤植之公測【盾反】替換回官方核心【保鏢 (Bodyguard, maxSL: 1)】；【不動要塞】maxSL 修正為 5（HP 增加 `SL × 3`）。
  - **武器大師 (Weaponmaster)**：【破甲擊】回歸官方核心 Core 1.1 標準（maxSL: 3，花費 5 MP，不造成傷害，可破壞盾牌/護甲或增傷 `SL × 2`）；【近戰武器掌握】maxSL 修正為 4。
  - **博學士 (Loremaster)**：【靈光一閃】修正為官方 Core 1.1 條款（檢定結果 13+ 觸發提問，maxSL: 3）；【集中】maxSL 修正為 5。
  - **狂怒鬥士 (Fury)**：【忍耐】補回官方原文漏譯之基礎固定值 `5 +`（HP 恢復修正為 `5 + 【SL × 最高羈絆強度】`）。
  - **元素師 (Elementalist)**：【咒語之刃】對齊 Core 1.1 勘誤版（單體目標、MP 門檻放寬至 `SL × 20`、非奧術武器、DEX 檢定加成），移除混入之公測增傷。
  - **神射手 (Sharpshooter)**：【鷹眼】移除公測 10 MP 規則，回歸官方 Core 1.1 的 `SL × 3` 增傷；【交叉火力】移除多餘 Playtest 標記。
  - **靈師 (Spiritist)**：【活力魔法】更新為 Core 1.1 之 `10 + 該咒語總 MP` 生命消耗；【療癒能力】移除 Playtest 標記。
  - **暗黑之刃 & 熵師**：【痛苦的教訓】maxSL 修正為 3；修復【熵系儀式】錯字，移除多餘 Playtest 標註。

### [2026-09-23] - 角色卡全模組視覺與排版對齊：回歸羊皮紙暖調，消除冷綠 SaaS 割裂感
- **章節頂部條（ChapterHeader）全面統一**：
  - 將角色卡章節頂部導航條 ([`ChapterHeader.jsx`](./src/components/book/ChapterHeader.jsx)) 由過往的薄荷綠冷調徹底替換為與 NPC 工坊完全一致的米褐色魔導書羊皮紙橫幅（`bg-[#f4ebd9]/95`, `border-[#d6c7ab]`, `text-[#3c2415]`，黃金微光印記與皮質深褐退出按鈕）。
  - 切換章節時，頭部視覺無縫銜接，徹底消滅進入角色卡時的色彩突兀跳變。
- **預設風格模板回歸「琥珀棕 (Amber Parchment)」**：
  - 將系統預設風格 ([`characterThemes.js`](./src/features/character-sheet/utils/characterThemes.js)) 由 `emerald` 全面校正為經典 `amber`（與 NPC 工坊同源調色盤：`#fbf7ee` 底色、`#fffdf9` 卡片白、`#d6c7ab` 框線、`#3c2415` 墨色文字）。
  - 自動遷移過往暫存預設值，使新舊用戶打開角色卡即刻置身典籍世界觀。
- **名冊大廳（Character Roster）書頁質感升級**：
  - [`CharacterSheet.jsx`](./src/features/character-sheet/CharacterSheet.jsx)：全面清除 `bg-slate-*`、`border-slate-*`、`text-slate-*` 與現代 `rounded-3xl`。
  - 角色卡片改採硬朗典雅的雙重古銅框線（`rounded-xl border-2 border-[#d6c7ab]`）與溫潤羊皮紙底（`bg-[#fffdf9]`），四維屬性格子、防禦儀表板、空狀態卡片全面對齊古籍質感。
  - 資源條（HP/MP/IP）背景槽由冷白灰改為暖沙米黃（`bg-[#e8dec8]`），極佳襯托血量與魔力光影。
- **創角工坊（CharacterEditor）100+ 處硬編碼翡翠綠全面淨化**：
  - [`CharacterEditor.jsx`](./src/features/character-sheet/components/CharacterEditor.jsx)：全面拔除過往殘留的 100+ 處 `emerald-*` 與 `slate-*` 類名，重構為 `theme` 變數與溫暖羊皮紙背景（`bg-[#fffdf9]`, `bg-[#f5efdf]`, `border-[#d6c7ab]`, `text-[#3c2415]`）。
  - 左側 5 大步驟邊欄、官方範本按鈕、軍用熟練度面板、加點按鈕等回歸統一的古銅皮質質感。
- **預覽卡片與跑團 HUD（CharacterCard & CharacterPlayHUD）統一**：
  - [`CharacterCard.jsx`](./src/features/character-sheet/components/CharacterCard.jsx)：外殼、裝備配置盒、特技列表、情感羈絆與個人命刻全面對齊 [`NPCCardPreview.jsx`](./src/features/npc-workshop/components/NPCCardPreview.jsx) 的卡片質地。
  - [`CharacterPlayHUD.jsx`](./src/features/character-sheet/components/CharacterPlayHUD.jsx)：儀表板標頭、資源微調鈕、經驗升級卡、六大狀態異常開關、武器命中膠囊換上書頁暖色，操作時如同翻閱實體魔導書。
- **官方身份對照表與屬性矩陣彈窗同步對齊**：
  - [`IdentityTablesModal.jsx`](./src/features/character-sheet/components/IdentityTablesModal.jsx) 與 [`AttributeMatrixPicker.jsx`](./src/features/character-sheet/components/AttributeMatrixPicker.jsx) 換上沉穩琥珀金與羊皮紙底色，彈窗風格全站一體。
- **規範驗證**：
  - 通過 Vite Production Build (`npm run build`)，零錯誤、零警告。
  - 全站 100% 通過零 Emoji 檢測。

### [2026-09-23] - 角色名冊支援 0 角色空狀態與全面清除構築頁面殘留英文括號
- **角色名冊支援 0 角色（預設空名冊，不強制塞入範例角色）**：
  - **初次進入為空**：[`CharacterSheet.jsx`](./src/features/character-sheet/CharacterSheet.jsx) 初始化邏輯修正為預設返回空陣列 `[]`，不再自動產生預設測試角色。
  - **移除刪除角色限制**：解除過往 `roster.length <= 1` 時「至少需保留一張角色卡」的限制，玩家可自由將所有角色全數刪除至 0。
  - **獨立空狀態介面**：名冊為空時不顯示搜尋篩選列與計數，改為渲染專屬的空名冊引導卡片（「冒險者名冊目前為空」），並提供「建立新冒險者」按鈕與匯入入口。
  - **安全導向與匯出防護**：當名冊為空或當前選定角色不存在時，頁面安全退回名冊總覽，避免編輯器或實戰卡崩潰；「匯出名冊」按鈕在名冊為空時自動禁用並提示。
- **清除構築頁面與全站殘留之英文括號與標籤**：
  - **步驟 3 標題**：[`CharacterEditor.jsx`](./src/features/character-sheet/components/CharacterEditor.jsx) 移除 `(Classes & Skills)`，改為純粹的 `3. 職業組合與特技加點`。
  - **步驟 5 標題與按鈕**：移除 `(Bonds & Feelings)`，改為 `5. 情感羈絆系統`；「新增羈絆」計數改為中文括號 `【X/6】`。
  - **咒語與儀式標題**：[`CharacterPlayHUD.jsx`](./src/features/character-sheet/components/CharacterPlayHUD.jsx) 移除 `(Spells & Rituals)`，改為純中文 `已掌握的咒語與儀式`。
  - **職業與特技下拉選單**：職業選單修習標記與技能上限由 `(已修習)`、`(Max SL: X)` 優化為 `【已修習】`、`【上限 SL X】`。
  - **英雄技能描述**：[`rulesData.json`](./src/features/character-sheet/data/rulesData.json) 清理「五行源泉之力」中的 `(INS)`、`(DEX)` 等英文縮寫括號，對齊中文【洞察】、【敏捷】等；清理「本店特色」中殘留之 `⚡` 符號。

### [2026-09-23] - 全面清除全站英文括號註釋：回歸純淨、簡練與沉浸的原生中文介面
- **標籤與介面字樣全面去括號淨化**：
  - **創角工坊 ([`CharacterEditor.jsx`](./src/features/character-sheet/components/CharacterEditor.jsx))**：移除 `角色姓名`、`角色等級`、`身份`、`主題`、`故鄉`、`初始持有金幣`、`初始物語點`、`四維基礎屬性骰配置`、`裝備庫與熟練度檢核`、`主手武器`、`副手裝備 / 盾牌`、`身體防具`、`佩戴飾品`、`金手指特質`、`掌握之英雄技能`、`個人誓約命刻`、`《FU》官方 20 大核心經典角色範本`、`創角完整度自檢清單` 中的雙語英文括號。
  - **實戰跑團儀表板 ([`CharacterPlayHUD.jsx`](./src/features/character-sheet/components/CharacterPlayHUD.jsx))**：資源欄位純粹化（`生命值`、`魔力值`、`道具點`、`金幣錢包`、`經驗升級`、`物語點`），四維防禦簡化（`物理防禦`、`魔法防禦`、`先攻修正`），情感三維六向選項全面改為純中文（`欽佩`、`自卑`、`忠誠`、`疑忌`、`喜愛`、`仇恨`），彈窗標題全面修飾。
  - **名冊與預覽卡片 ([`CharacterSheet.jsx`](./src/features/character-sheet/CharacterSheet.jsx), [`CharacterCard.jsx`](./src/features/character-sheet/components/CharacterCard.jsx))**：`玩家角色卡名冊`、`物語點`、`職業特技清單`、`英雄技能`、`情感羈絆`、`個人命刻` 括號全數清除。
  - **屬性矩陣選取器 ([`AttributeMatrixPicker.jsx`](./src/features/character-sheet/components/AttributeMatrixPicker.jsx))**：陣列名稱對齊純中文：`專精型`、`均衡型`、`特化型`；機制說明文字去括號。
- **規則資料庫與預設集清理**：
  - **基礎裝備清單 ([`rulesData.json`](./src/features/character-sheet/data/rulesData.json))**：所有 32 項武器、防具與盾牌名稱修訂為純中文（如 `巨劍`、`符文甲冑`、`青銅圓盾`、`旅行皮甲` 等）。
  - **20 大官方經典範本 ([`starterPresets.js`](./src/features/character-sheet/data/starterPresets.js))**：範本職業頭銜、個人主題與武裝配置全面淨化為純中文，與規則資料庫 100% 匹配。
  - **手冊拓展與身分對照表 ([`sourcebookConfig.js`](./src/features/character-sheet/data/sourcebookConfig.js))**：手冊名稱（`核心規則書`、`高等奇幻手冊` 等）、官方身分主題靈感池、狀態異常描述與三表標題去括號。
  - **計算引擎向後相容 ([`characterEngine.js`](./src/features/character-sheet/utils/characterEngine.js))**：裝備比對邏輯加入自動正規化容錯，確保 localStorage 中舊有存檔仍可無縫計算防禦與先攻。
- **NPC 工坊、戰鬥輪次與通用組件對齊**：
  - **NPC 工坊 ([`NPCWorkshop.jsx`](./src/features/npc-workshop/NPCWorkshop.jsx), [`NPCBuilder.jsx`](./src/features/npc-workshop/components/NPCBuilder.jsx), [`NPCCardPreview.jsx`](./src/features/npc-workshop/components/NPCCardPreview.jsx), [`roles.js`](./src/features/npc-workshop/data/roles.js))**：動作分類標題（`基本攻擊`、`咒語`、`其餘行動`、`特殊規則`）、相性矩陣、表單標籤與導引步驟去括號，並同步清理殘留 emoji。
  - **戰鬥輪次與時鐘 ([`CombatTracker.jsx`](./src/features/combat-tracker/CombatTracker.jsx), [`DiceRollerModal.jsx`](./src/features/dice-roller/DiceRollerModal.jsx), [`FateClockPage.jsx`](./src/features/clocks/FateClockPage.jsx), [`ErrorBoundary.jsx`](./src/components/ui/ErrorBoundary.jsx), [`JRPGModal.jsx`](./src/components/ui/JRPGModal.jsx))**：按鈕、彈窗標題與欄位標籤全面清爽化。
- **建置與規範驗證**：
  - 通過 Vite Production Build (`npm run build`)，零錯誤。
  - 角色卡、名冊、骰盅與時鐘體系通過零 Emoji 檢驗。
- **移除右側常駐預覽，升級全寬專注工作台 ([`CharacterEditor.jsx`](./src/features/character-sheet/components/CharacterEditor.jsx))**：
  - 徹底移除創角時佔據右側螢幕一半的常駐 `CharacterCard`，解除分欄佈局限制。
  - 車卡工作台改為全寬大器容器（`max-w-4xl mx-auto`），四維屬性分配、職業特技增減、裝備庫挑選與羈絆配置獲得極佳的視覺呼吸感，讓玩家 100% 專注於數值構築。
- **隨選角色卡檢視彈窗 (On-Demand Card Preview Modal)**：
  - 在編輯器頂部工具列及底部導航列新增「**查看角色卡**」按鈕（`<GiScrollUnfurled />`）。
  - 玩家在創角過程中隨時可一鍵呼叫居中視窗彈窗（`JRPGModal`）全貌檢視當前角色卡。
  - 彈窗底部提供「進入跑團實戰」與「返回編輯」捷徑；步驟 6 底部同步新增「完成創角，進入跑團卡」大按鈕。
- **未填欄位空格與佔位標籤強化 ([`CharacterCard.jsx`](./src/features/character-sheet/components/CharacterCard.jsx))**：
  - 車卡填寫一半時直接查閱，尚未完成的各項欄位均以專屬的虛線下劃線、提示標記或空白框呈現，一目了然：
    1. **角色姓名**：未命名時顯示 `【 ______ 尚未命名冒險者 】`
    2. **核心身份**：未填寫時顯示 `【 尚未設定身份 】`
    3. **指引主題**：未選取時顯示 `【 尚未設定主題 】`
    4. **故鄉發源**：未填寫時顯示 `【 尚未設定故鄉 】`
    5. **職業與特技**：未選取職業時提示 `【 尚未配置職業 (起始需選 2~3 個職業) 】`；特技總點數不足時動態標記 `尚餘 X 點特技未分配`；特技清單呈現空槽位提示。
    6. **裝備清單**：主手、副手/盾牌、防具、飾品未穿戴時顯示 `[ 空格 / 未裝備 ]`。
    7. **情感羈絆**：未締結時顯示 `【 尚未締結任何情感羈絆 】（可建立最多 6 組羈絆）` 與 `0 / 6`。
    8. **個人命刻**：未建立時顯示 `【 尚未添加個人命刻 】`。
- **合規自檢**：
  - 全站 100% 零 Unicode Emoji 掃描合格。
  - `npm run build` 生產構建無報錯通過。

### [2026-09-21] - 角色卡換色模板系統：對齊 NPC 工坊 6 大經典配色風格與即時切換體系
- **6 大經典主題色彩定義 ([`characterThemes.js`](./src/features/character-sheet/utils/characterThemes.js))**：
  - 完美對齊 NPC 工坊的經典風格調色盤，涵蓋：
    1. **翡翠青 (Emerald Mint)**：清爽薄荷青翠（默認風格）
    2. **琥珀棕 (Amber Parchment)**：溫潤羊皮紙與復古黃銅
    3. **經典藍 (Ocean Blue)**：沉穩深邃蔚藍
    4. **硃砂紅 (Crimson Rose)**：熱血緋紅朱赤
    5. **秘術紫 (Arcane Purple)**：神秘法師幽紫
    6. **鐵石灰 (Iron Slate)**：堅毅冷峻鋼鐵曜黑
  - 嚴格遵守零 Unicode Emoji 規範，純中文名稱搭配高質感色圓點與向量圖標。
- **專屬風格切換器 ([`CharacterThemePicker.jsx`](./src/features/character-sheet/components/CharacterThemePicker.jsx))**：
  - 採用與 NPC 工坊相同的操作邏輯：顯示當前主題色點與下拉選單，點擊展開 6 宮格風格卡片，支援點選即時預覽與選中 Check 標記。
  - 持久化儲存於 `localStorage`（鍵名：`fu_companion_character_theme`）。
- **全場景深度整合換色機制**：
  - **名冊大廳 ([`CharacterSheet.jsx`](./src/features/character-sheet/CharacterSheet.jsx))**：頂部工具列提供主題切換器，名冊內每張卡片皆動態套用所選或個別自訂主題的光條、邊框與頭像配色。
  - **跑團實戰儀表板 ([`CharacterPlayHUD.jsx`](./src/features/character-sheet/components/CharacterPlayHUD.jsx))**：頂部 HUD 標頭右側整合風格切換器，實時同步切換面板、經驗進度條、Tabs 標籤頁與操作按鈕主題。
  - **角色卡卡片展示 ([`CharacterCard.jsx`](./src/features/character-sheet/components/CharacterCard.jsx))**：頂部漸層條、邊框、卡頭、裝備清單、特技卡與情感羈絆面板完全自適應當前主題色。
  - **六步創角編輯器 ([`CharacterEditor.jsx`](./src/features/character-sheet/components/CharacterEditor.jsx))**：頂部工具列可切換風格；步驟 1「核心身分」中新增「卡片專屬風格模板」6 宮格按鈕，支援為個別冒險者自訂專屬代表色；右側即時卡片預覽隨選即變。
- **全站按鈕樣式庫擴充 ([`JRPGButton.jsx`](./src/components/ui/JRPGButton.jsx))**：
  - 新增 `purple`, `slate`, `outline-blue`, `outline-crimson`, `outline-purple`, `outline-slate` 等按鈕變體，全面支援 6 色系切換。
- **合規自檢**：
  - 全模組源代碼 100% 零 Emoji 檢測合格。
  - `npm run build` 生產構建無報錯通過。

### [2026-09-21] - 角色卡全模組主題色彩重塑：全面對齊清爽淺青色（Emerald / Mint / Cyan）
- **主題色彩視覺統一（對齊章節標題）**：
  - 角色卡模組全面回歸專案原先設計的專屬代表色「**清爽淺青 / 翡翠薄荷綠（Emerald / Cyan / Mint）**」，與頂部 `ChapterHeader` 的淺青標題列（`bg-[#ecfdf5]`、`border-emerald-200`、`text-emerald-950`）完美呼應。
  - 歷史出處驗證：確立了 Commit `093d1af` 中定義的章節主題色彩架構（NPC工坊為暖羊皮紙・琥珀金 `#f4ebd9`；角色卡助手為清爽翡翠青 `#f4fbf7`；戰鬥輪次為緋紅玫瑰 `#fff1f2`；命刻記錄為天空蔚藍 `#f0f9ff`）。
- **按鈕與 UI 體系擴充**：
  - [`JRPGButton.jsx`](./src/components/ui/JRPGButton.jsx) 新增 `variant="emerald"` 與 `variant="outline-emerald"`，提供高雅質感的青翠翡翠操作按鈕。
- **角色卡五大核心視圖全面青化**：
  - **名冊大廳 ([`CharacterSheet.jsx`](./src/features/character-sheet/CharacterSheet.jsx))**：卡片頂部裝飾光條改為 `from-emerald-500 via-teal-600 to-emerald-700`，標題列與各項按鈕改為翡翠青配色。
  - **六步創角編輯器 ([`CharacterEditor.jsx`](./src/features/character-sheet/components/CharacterEditor.jsx))**：步驟導航 Tab、屬性陣列卡片、職業特技增減面板、500z 開局預算追蹤條、情感羈絆按鈕等全數套用淺青色板（`bg-[#f4fbf7]`, `border-emerald-200`, `text-emerald-950`）。
  - **預覽卡片 ([`CharacterCard.jsx`](./src/features/character-sheet/components/CharacterCard.jsx))**：全卡邊框、等級標籤、四維防禦面板、職業特技卡改為翡翠青薄荷白底色。
  - **實戰跑團儀表板 ([`CharacterPlayHUD.jsx`](./src/features/character-sheet/components/CharacterPlayHUD.jsx))**：頂部 HUD 標頭、頭像外框、EXP 升級經驗條、Zenit 錢包、六大狀態異常欄位與子功能標籤全面對齊淺青色調。
  - **官方身份對照表彈窗 ([`IdentityTablesModal.jsx`](./src/features/character-sheet/components/IdentityTablesModal.jsx))**：說明橫幅、擲骰結算區、分組卡片與自選選中狀態均換上清爽淺青。
- **規則與規範雙重校驗**：
  - 全站源碼 100% 通過 `[\uD83C-\uDBFF\uDC00-\uDFFF]` 零 Emoji 掃描。
  - `npm run build` 生產構建無報錯通過。

### [2026-09-21] - 創角微調：移除代名詞、自訂主題切換、等級默認標註與官方身份靈感對照表彈窗
- **移除代名詞欄位 (Pronouns)**：
  - 在創角流程步驟 1 與角色初始結構中徹底移除 `pronouns` 輸入項與預設值，使介面更加清爽俐落。
- **角色等級額外註明默認 5 級 (Level)**：
  - 等級欄位上方新增「起始默認 5 級」高亮標籤，下方附帶官方創角規則說明（5~50 級；單職業上限 10 級），支持玩家依跑團團務手動微調。
- **主題自由填寫切換 (Custom Theme)**：
  - 主題欄位新增「自行填寫」打勾選項（Checkbox）。
  - 未打勾時維持官方 9 大經典主題下拉選單（希望、野心、歸屬、負疚、正義、慈悲、復仇、懷疑、職責）；打勾後無縫切換為自由輸入框，可手動填寫「救贖」、「追尋」等自訂主題。
- **官方身份創建靈感完整對照表彈窗 (Official Identity Tables Modal)**：
  - 嚴格依照官方 Core Rulebook v1.1 Errata p.158-159 完整提取並實裝全部數據：
    - **核心概念 (Core Concept)**：共 60 種身分，分為 3 組（d6: 1-2, 3-4, 5-6），每組 20 項（d20: 1~20），均提供中英對照。
    - **形容特質 (Adjective)**：共 40 種特質，分為 2 組（d6: 1-3, 4-6），每組 20 項（d20: 1~20），均提供中英對照。
    - **身世細節 (Detail)**：共 20 種身世細節（d20: 1~20），提供中英對照。
  - 新增專屬彈窗組件 [`IdentityTablesModal.jsx`](./src/features/character-sheet/components/IdentityTablesModal.jsx)：
    - 在身份輸入欄旁提供按鈕「查看官方靈感對照表 (d6+d20)」。
    - 彈窗支援分類標籤切換與中英文關鍵字搜尋。
    - 支援「投擲官方 1d6 + 1d20」即時擲骰，顯示各組骰點結算與身分，並可一鍵套用至角色卡。
    - 支援「自選組合身份區」：點擊表格中任意特質、身分、細節即可自由拼裝組合並一鍵套用。
- **身分中文語法順序校正（符合中文書寫習慣）**：
  - 角色身分在確認並填入身分欄時，嚴格遵循中文習慣順序：『**身世細節 ➔ 形容特質 ➔ 核心概念**』。
  - 例如擲出：細節【來自遠古森林】、特質【失憶的】、身分【騎士】，最終確認輸出為「**來自遠古森林的失憶的騎士**」或「**來自風暴騎士團的破誓者騎士**」。
  - 彈窗內的擲骰點數結算卡與自選組合選取欄同步調整為「1. 身世細節 ➔ 2. 形容特質 ➔ 3. 核心概念」之流暢視覺順序。
- **全局彈窗視窗置中定位修復 (Modal Viewport Portal Fix)**：
  - **根因修復**：修復了因父層頁面淡入動畫 `.animate-page-dissolve-in` 的 `transform` 與 `will-change` 屬性觸發 CSS 包含塊陷阱（Containing Block），導致 `fixed inset-0` 相對於數千像素高的頁面居中而非瀏覽器可視視窗（導致彈窗沉到頁面極下方需大幅向下滾動才能看見）的嚴重 UX 問題。
  - **React Portal 重構**：[`JRPGModal.jsx`](./src/components/ui/JRPGModal.jsx) 全面改用 `ReactDOM.createPortal(..., document.body)` 直掛 `<body>`，脫離一切父層變形與層疊上下文束縛，確保所有彈窗永遠死死鎖定在當前螢幕中央（`z-[9999]`），並於開啟時自動鎖定背景滾動條（`overflow: hidden`）。
  - **彈窗統一**：將創角範本彈窗、自檢清單彈窗、角色升級彈窗、官方身份對照表彈窗、全域擲骰彈窗全面收斂至 `JRPGModal`，實現 100% 視口精確居中。
- **圖示政策與代碼自檢**：
  - 嚴格遵守 `GEMINI.md` 規範，零 Unicode Emoji，UI 全面採用 Game-Icons.net 向量圖標。
  - `npm run build` 通過生產構建。

### [2026-09-20] - 倉庫初始化與 NPC 工坊戰術定位圖示升級
- **版本控制初始化**：
  - 本地倉庫建立 Git 版本控制（`git init`），提供 IDE 完整的行級代碼追蹤與 Source Control 面板支援。
  - 建立專案總覽與變更檔案 `PROJECT_CHANGELOG.md`。
- **NPC 工坊定位標誌全面升級 (Game-Icons.net)**：
  - 取代原本各定位的文字 Emoji（🩸、🏹、🔮、💣、🛡️、🌿），改為標準向量 SVG：
    - **暴徒 (Brute)**: `GiBrute`（肌肉剛猛的破陣者）
    - **獵人 (Hunter)**: `GiCrossbow`（致命連發精密弩）
    - **法師 (Mage)**: `GiWizardStaff`（元素奧術法杖）
    - **破壞者 (Saboteur)**: `GiTimeBomb`（戰術定時引信爆彈）
    - **衛士 (Sentinel)**: `GiShieldReflect`（守護與防禦反擊之盾）
    - **輔助 (Support)**: `GiHealing`（雙手生命治癒祝禱之光）
  - 同步更新位置：
    - 步驟 1 輪播卡片中央徽章與 12 度傾斜背景浮水印。
    - 步驟 1 底部 Quick Select 快捷按鈕。
    - NPC 檔案庫存檔卡片角色標籤。
    - `NPCBuilder.jsx` 戰術定位選擇器。
- **翻頁動效升級（GPU 合成層縮放過渡）**：
  - 實現「運鏡式翻開/合上縮放過渡」：
    - **翻開典籍 (Open)**：書本自 `scale(0.94)` 伴隨 3D 翻頁流暢推進放大至 `scale(1.18)`，無縫融會至工作區。
    - **合上典籍 (Close)**：書本自 `scale(1.15)` 翻頁合閉，平滑收縮落回 `scale(1.0)` 封面。
  - **極致效能優化 (0 卡頓保障)**：
    - 徹底移除全螢幕 `backdrop-blur` 與 keyframe `blur` 濾鏡（避免每秒 60 次的 GPU 像素重繪）。
- **典籍深度融合（消除雙重典籍穿崩視覺）**：
  - 解決「翻開書時背景還留著一本大書」的違和感：
    - **點擊進入時**：背景的實體典籍與工具列即時以 `opacity: 1 -> 0` 伴隨輕微縮小淡出，由前景浮動翻開的典籍作為唯一視覺主體，如行雲流水般「拿起典籍並翻開進入」。
    - **合上返回時**：工作區即刻優雅淡出，前景典籍闔上並落回桌面的過程中，背景典籍以 `opacity: 0 -> 1` 平滑顯現歸位，視覺連貫無瑕。
- **建置驗證**：
  - 通過 Vite Production Build (`npm run build`)，無任何編譯與語法警告。

### [2026-09-20] - NPC 工坊背景色鎖定與調色盤移至角色卡預覽
- **模組背景色解耦 (UI/Card Decoupling)**：
  - 各模組維持各自專屬特色背景底色，NPC 工坊介面全面固定為經典羊皮紙米褐色（`#fbf7ee` 背景、`#f4ebd9` 標題/容器條、`#d6c7ab` 邊框）。
  - 移除先前的全域 `:root` `data-codex-theme` 覆寫，避免切換調色盤時污染或變更其他板塊（如角色卡助手、戰鬥輪次等）的視覺風格。
- **調色盤遷移至角色卡預覽工具列**：
  - 頂部導航欄不再顯示全域調色盤懸浮選單，將主題色切換按鈕內嵌於「**角色卡預覽**」頁籤的工具列中（緊鄰研究檢定層級選擇器）。
  - 支援六種經典 JRPG 魔導書配色（琥珀金、深海藍、翡翠綠、緋紅曜石、秘法紫、灰燼黑）。
  - 色彩更換範圍嚴格限制於 NPC 角色卡實體（包含即時預覽、分頁預覽、圖片輸出與 HTML 渲染），工坊編輯框與導航保持沉浸穩定的米褐色。
- **建置驗證**：
  - 通過 `npm run build` 完整打包編譯。

### [2026-09-20] - 構裝體物種技能「獨特設計」加成領域自由填寫功能
- **物種專屬特性擴展 (Construct Domain Input)**：
  - 為構裝體（Construct）的特性技能『在有利於此構造體獨特設計、工具或程式設計的情況下，對抗檢定獲得 +3 加成。』新增 `needsSelection: true` 與自由填寫輸入框（`sp_construct_domain`）。
  - 使用者在步驟 2 勾選該選項後，下方即時展開專屬輸入框（提示範例：破拆作業、水下維護、警衛監控、數據分析等）。
  - 輸入框支援即時雙向綁定與動態插值，未輸入時於預覽中呈現琥珀色待配置虛線槽（`待配置項目：加成領域`），輸入後即時嵌入描述為『在有利於此構造體獨特設計、工具或程式設計【所填領域】的情況下，對抗檢定獲得 +3 加成。』。
- **角色卡與規則導出精確化**：
  - 角色卡規則名稱由原先籠統的「身體能力」自動精確辨識為「**獨特設計**」，確保構裝體特性命名嚴謹。
  - 同步支援於 `NPCWorkshop.jsx` 與 `NPCBuilder.jsx`，並相容 JSON 存檔與導出。
- **建置驗證**：
  - 通過 `npm run build` 完整打包編譯無警告。

### [2026-09-20] - 暫時隱藏作者贊助入口
- **UI 精簡 (Hide Sponsorship Entrance)**：
  - 暫時自 NPC 工坊存檔庫頁面底部移除「贊助支持卡片」（請喝咖啡橫幅與按鈕）。
  - 移除「支持詳情」專屬彈窗（Ko-fi 連結與未來開發計畫彈窗），維持乾淨簡潔的介面體驗，待整體專案功能完善後再行安排。
- **建置驗證**：
  - 通過 `npm run build` 完整打包編譯無警告。

### [2026-09-20] - 第三方授權聲明遷移至首頁封面與聲明內容更新
- **授權聲明外移 (Relocate License Notice to Cover Hub)**：
  - 將原本位於 NPC 工坊存檔庫底部的第三方授權聲明（Third-Party License Notice）自工坊內徹底移除。
  - 將其外移至網站主入口封面（`BookCoverHub.jsx`）底部，作為整站全域的官方授權聲明。
- **聲明內容規範與技術標註更新**：
  - 專案名稱由 `FU NPC Builder` 改為 `FU Companion`。
  - 於 `production` 處新增 Google Antigravity 輔助開發標註：`(developed with assistance from Antigravity)`。
  - 移除原先對 Bestiary vol.1 的引用，調整為僅引用核心規則書：`This tool requires the Fabula Ultima Core Rulebook.`。
  - 動效融合：開書動畫觸發時，該聲明區塊隨封面 UI 平滑淡出（`isOpening` 同步漸隱），維持沉浸式翻頁視覺。
### [2026-09-20] - NPC 工坊全面對齊官方 Style Guide 規範 (Page 11)
- **官方風格指南對齊 (Fabula Ultima Third-Party License Style Guide Alignment)**：
  - 下載並深入對照官方最新發佈之風格手冊（Page 11 "WRITING NPC PROFILES"），針對 NPC 數據區塊（Statblock）與技能類別實施規範化修改。
- **屬性相性順序標準化 (Canonical Affinity Order `p a b d e f i l t`)**：
  - 將原本順序倒置（物理排在倒數第二）的 `DAMAGE_TYPES` 嚴格修訂為官方標準核心九相順序：
    - `物理` (p)、`風` (a)、`電` (b)、`暗` (d)、`土` (e)、`火` (f)、`冰` (i)、`光` (l)、`毒` (t)。
  - 連帶修訂 `NPCWorkshop.jsx` 預覽分類、`NPCCardPreview.jsx` 抗性矩陣、`constants.js` 與 `NPCBuilder.jsx` 步驟 4 的抗性循環排列順序。
- **生命值危機臨界值標準指示符 (`HP X w X`)**：
  - 角色卡核心資源區於 HP 旁增加官方 Crisis 專屬圖標（來自 `FabulaUltimaIcons-Regular.otf` 之 `w` 字符）與數值標記：`w Math.floor(HP / 2)`。
  - 同步更新即時預覽、角色卡預覽（`NPCCardPreview.jsx`）與 Discord / Plain / Markdown 複製格式（`HP X (危機 X)`）。
- **防禦與先攻專用術語規範 (`DEF`, `M.DEF`, `INIT`)**：
  - 依風格指南縮寫規範，防禦與先攻表頭嚴格對齊為 `物防 DEF`、`魔防 M.DEF`、`先攻 INIT`。
- **攻擊射程專用符號與傷害屬性圖示 (`m` Melee / `r` Ranged)**：
  - 基本攻擊欄位前方全面內嵌官方武器射程字型字符：近戰攻擊標註 `m`（近戰標記）、遠程攻擊標註 `r`（遠程標記）。
  - 傷害類型標籤前補齊屬性官方符號（如物理 `p`、火 `f`、冰 `i`、電 `b` 等）。
- **NPC 技能動作分類規範化 (Four Canonical Action Categories)**：
  - 依手冊第 11 頁標準四大分類嚴格統一標題與符號：
    - **基本攻擊 (BASIC ATTACKS)**：配備 `m` 官方近戰圖標。
    - **咒語 (SPELLS)**：配備 `c` 官方咒語圖標與 `o` 攻擊性咒語圖標。
    - **其餘行動 (OTHER ACTIONS)**：配備 `s` 官方行動圖標。
    - **特殊規則 (SPECIAL RULES)**：配備 `📜` 典籍規則圖標。
- **建置驗證**：
  - 通過 Vite Production Build (`npm run build`)，零錯誤、零警告。

### [2026-09-21] - 章節專屬色調頂欄與 NPC 工坊頂欄米褐色對齊
- **NPC 工坊頂部導覽列改版為羊皮紙米褐色 (Rice-Brown Topbar for NPC Workshop)**：
  - 將 NPC 工坊頂部的章節導覽欄（`ChapterHeader.jsx`）完全改為米褐色底色（`bg-[#f4ebd9]/95`）、褐色邊框（`border-[#d6c7ab]`）、深棕文字（`text-[#3c2415]`、`text-[#7c6a58]`）與皮革琥珀金色返回按鈕（`from-[#8b5e34] via-[#92400e] to-[#78350f]`），徹底消除原本突兀的亮天藍色，與下方工坊的羊皮紙米褐調完全融為一體。
  - 同步將工坊注入頂欄右側的快捷操作按鈕（`回到檔案庫`、`🔒 嚴謹模式`、`讀取 JSON`、`匯出 JSON`）改為米白色底配米褐色邊框（`bg-[#fffdf9] border-[#d6c7ab] text-[#3c2415] hover:bg-[#ebdcc4]`）。
- **全站四大章節專屬色調矩陣 (Chapter-Specific Themes)**：
  - 各章節頂欄（`ChapterHeader`）、頁面底色與選取高亮（`App.jsx`）、3D 翻頁內頁與翻頁底面（`BookPageFlipOverlay.jsx`）以及頁腳（Footer）全面按章節自訂專屬色系：
    1. **NPC 工坊 (`workshop`)**：米褐色 / 典籍羊皮紙（`#f4ebd9` / `#fbf7ee` / `#d6c7ab` / `#3c2415`）
    2. **角色卡助手 (`character`)**：翡翠綠（`#ecfdf5` / `#f4fbf7` / `border-emerald-200` / 墨綠文字）
    3. **戰鬥輪次 (`combat`)**：緋紅曜石（`#fff1f2` / `#fdf4f5` / `border-rose-200` / 深紅文字）
    4. **命刻記錄 (`clocks`)**：蒼穹青藍（`#f0f9ff` / `border-sky-200` / 湛藍文字）
- **建置驗證**：
  - 通過 Vite Production Build (`npm run build`)，零錯誤編譯。

### [2026-09-21] - 玩家角色卡全系統重構：靈活導引精靈、跑團實戰儀表板與戰役成長體系
- **手冊與拓展分類體系 (Sourcebook & Expansion System)**：
  - 新增 [`sourcebookConfig.js`](./src/features/character-sheet/data/sourcebookConfig.js)，將 28 大職業精確劃分為五大模組：
    - 核心 15 職 (Core Rulebook - 永遠預設啟用)
    - 🏰 高等奇幻手冊 (High Fantasy Atlas - 5 職)
    - ⚙️ 科技奇幻手冊 (Techno Fantasy Atlas - 3 職)
    - 🌿 自然奇幻手冊 (Natural Fantasy Atlas - 4 職)
    - 🧪 官方公測修訂 (Playtest Materials)
  - 提供即時打勾開關，勾選後立即解鎖對應職業與特技。
- **官方經典 8 大起始範本庫 (Core Starter Archetypes)**：
  - 新增 [`starterPresets.js`](./src/features/character-sheet/data/starterPresets.js)，收錄官方規則書推薦的 8 大起始配置：元素魔劍士、神聖護衛、荒野神射手、奧術博學者、暗夜殺手、魔導機巧技師、戰意演說家、魔獸擬態薩滿。
  - 創角時點擊「官方經典配置」可一鍵套用身世、屬性、職業、裝備與情感羈絆。
- **三態架構整合 (Tri-Mode Architecture in `CharacterSheet.jsx`)**：
  1. **名冊總覽 (Roster Mode)**：卡片總覽、即時 HP/MP/金錢/EXP 概覽、複製、刪除、一鍵推入戰鬥房間、JSON 備份匯出入。
  2. **跑團實戰儀表板 (Play HUD Mode - `CharacterPlayHUD.jsx`)**：
     - **戰役長期成長體系**：EXP 動態進度條（10 EXP = 1 級），滿 10 點觸發升級彈窗，可點選新職業或提升技能 SL。
     - **金錢 Zenit 與物語點 FP 記帳**：提供快速增減按鈕。
     - **資源快速消耗**：HP/MP/IP 加減微調，IP 一鍵製造治療劑、萬能藥、解毒劑與提神藥。
     - **六大狀態異常即時切換**：眩暈、憤怒、中毒、動搖、緩速、虛弱，點擊切換時下方的敏捷、洞察、體魄、意志屬性骰階自動降級（`reduceDieStep`）。
     - **點擊屬性即時擲骰**：點擊屬性或武器檢定直接喚醒全域 3D 雙骰骰盅。
  3. **靈活創角與升級工作台 (Builder Wizard - `CharacterEditor.jsx`)**：
     - 六大步驟自由跳轉，支援暫時放空。
     - 頂部常駐**「自檢提醒清單」**，點擊彈出抽屜並可跳轉至指定步驟修復。
     - 官方三大標準屬性陣列（專精型、均衡型、特化型）一鍵填入與 32 點總和檢驗。
     - 三維六向情感羈絆輪盤（欽佩/自卑、忠誠/疑忌、眷愛/憎恨）。
     - 軍用武器/重甲熟練度檢核警告。
- **建置驗證**：
  - 通過 Vite Production Build (`npm run build`)，零錯誤編譯。

### [2026-09-21] - 官方 Style Guide 字型全面納管、FUIcon 組件落地與 GEMINI.md 持久規則建立
- **建立 Antigravity 官方持久規則文件 [`GEMINI.md`](./GEMINI.md)**：
  - 為杜絕 Context Compaction（對話歷史壓縮）導致的指令遺忘，於專案根目錄正式建立 `GEMINI.md`。
  - Antigravity 系統保證在任何 Turn、任何 Session 與上下文壓縮後，無條件自動加載 `GEMINI.md` 至最高優先級 Rules 預算中，永久維持「圖示雙軌鐵律」、「Core v1.1 Errata 官方規則」與「零 Emoji 規範」。
- **官方專屬符號封裝組件 [`FUIcon.jsx`](./src/components/ui/FUIcon.jsx)**：
  - 封裝 `FabulaUltimaIcons-Regular.otf` 與 `.fu-icon` 類名，全面規範化管理官方特有標誌：
    - **屬性九相** (Canonical Affinity Order: `p a b d e f i l t`)：物理 `p`、風 `a`、電 `b`、暗 `d`、土 `e`、火 `f`、冰 `i`、光 `l`、毒 `t`。
    - **攻擊射程**：近戰 `m` (Melee)、遠程 `r` (Ranged)。
    - **動作與技能分類**：咒語 `c` (Spell)、攻擊性咒語 `o` (Offensive Spell)、其餘行動 `s` (Other Action)。
    - **危機臨界指示符**：危機 `w` (Crisis Indicator - Style Guide p.11 `HP X w X`)。
- **角色卡與名冊全面對齊官方符號**：
  - 跑團實戰儀表板 ([`CharacterPlayHUD.jsx`](./src/features/character-sheet/components/CharacterPlayHUD.jsx))：危機徽章全面改用 `<FUIcon name="crisis" />`，武器卡片射程改用 `<FUIcon name="melee" />` / `<FUIcon name="ranged" />`。
  - 角色卡檢視 ([`CharacterCard.jsx`](./src/features/character-sheet/components/CharacterCard.jsx)) 與名冊總覽 ([`CharacterSheet.jsx`](./src/features/character-sheet/CharacterSheet.jsx)) 危機標籤同步對齊官方 `w` 符號。
- **建置驗證**：
  - 通過 Vite Production Build (`npm run build`)，零錯誤、零警告。

### [2026-09-23] - 頂部導航層級重整、調色盤單一來源化與 NPC 工坊按鈕群極簡對齊
- **角色卡調色盤雙重冗餘清理 (Single Source of Truth for Character Themes)**：
  - 針對使用者回饋「顏色盤沒必要做兩個」，清理了 [`CharacterEditor.jsx`](./src/features/character-sheet/components/CharacterEditor.jsx) 內部桌面左側身份卡片與移動端頂部重疊的 6 色圓圈。
  - 唯一保留全局頂部導航欄（[`ChapterHeader.jsx`](./src/components/book/ChapterHeader.jsx)）右側的 6 色主題切換器，確保不論在編輯器還是實戰模式、不論頁面滾動到何處，都能快速切換角色卡專屬色系。
- **NPC 工坊頂部導航層級完全對齊角色卡助手 (Top Navigation Parity with Character Sheet)**：
  - **頂部左側次級返回導航**：在 NPC 工坊進入「構築頁面」或「角色卡預覽」時，左上角的按鈕從原本突兀退回首頁的「合上書本 · 返回封面」自動動態變形為 `[ ← 返回檔案庫 ]`，並附帶 `構建：${state.name}` 徽章。點擊時自動執行靜默儲存並返回檔案庫，徹底杜絕誤點退至封面的問題。
  - **頂部右側功能列精簡大瘦身**：
    - 將原本凌亂的 8 個按鈕大刀闊斧簡化，引入與角色卡助手**一模一樣的 6 色主題切換圓圈**（琥珀、翡翠、經典藍、硃砂紅、秘術紫、鐵石灰），1 點即切 NPC 卡片樣式。
    - 保留高頻操作：`[ 🔒 嚴謹模式 / 🔓 自由模式 ]` 與 `[ 儲存 (Ctrl+S) ]`。
    - 徹底剔除右上角「回到檔案庫」（已由左上角承接）、「讀取 JSON」與「匯出 JSON」（已在檔案庫與預覽分頁中完備提供）。
- **功能按鈕工整符號化與零 Emoji 合規優化 (Neat Functional Glyphs & Zero Emoji Enforcement)**：
  - 返回、關閉、檔案標籤與檢視等操作全面改用標準向量圖標（`ArrowLeft`, `X`, `Tag`, `Eye`, `MessageSquare`, `FileCode`, `FileText` 等），不再混用粗糙的符號與 Unicode Emoji。
  - 移除了 NPC 工坊存檔、複製、刪除提示字串中的 Unicode Emoji。
- **建置驗證**：
  - 執行 `npm run build`，編譯耗時 3.64 秒，零錯誤、零警告。

### [2026-09-24] - NPC 工坊：新增 ccfolia 棋子一鍵匯出（剪貼簿即貼即用）
- **ccfolia 剪貼簿棋子格式支援 (Ccfolia Clipboard Token Generation)**：
  - 於 NPC 工坊的「複製文本 ▾」下拉選單中新增 **「ccfolia 棋子 (Ctrl+V)」** 選項（配備 `GiRollingDices` 圖標）。
  - 自動將 NPC 當前數值與技能轉譯為符合 ccfolia 規範的 `kind: "character"` JSON 資料：
    - **`status` 資源條**：自動填入當前計算後的滿值 `HP`、`MP`，以及反派階級對應的 `UP`（終極點數）。
    - **`params` 屬性矩陣**：自動拆解並綁定 `DEX`, `INS`, `MIG`, `WLP`, `DEF`, `M.DEF`, `INIT` 參數。
    - **`memo` 備忘資訊**：整合位階、定位、反派階級、種族、陣營、特質、全相性矩陣、異常狀態免疫與戰術慣例。
    - **`commands` 聊天調色盤 (Chat Palette)**：
      - 常用雙屬性檢定與先攻檢定算式（支援動態引用 `{DEX}` 與 `{INS}` 等參數）。
      - 所有基本攻擊命中判定算式（如 `1d{DEX}+1d{MIG}+2`）、傷害計算與額外效果。
      - 咒語魔攻判定算式、MP 消耗、目標與效果文字。
      - 特殊規則與能力摘要。
      - 常用狀態微調指令快捷（`:HP-`, `:HP+`, `:MP-`, `:MP+`, `:UP-1`）。
  - 點擊後自動寫入剪貼簿並彈出友善引導 Toast：「已複製 ccfolia 棋子！請至 ccfolia 房間按 Ctrl+V 貼上」。
- **建置驗證**：
  - 通過 Vite Production Build (`npm run build`)，零報錯完成打包。


