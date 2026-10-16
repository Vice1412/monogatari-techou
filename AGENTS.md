# AGENTS.md — DeepSeek Harness 執行準則（《物語手帳》）

> **本檔不取代、不修改 `GEMINI.md`。**
> `GEMINI.md` 仍是本專案最高持久規範文件；本檔只補足 **DSH（DeepSeek Harness）執行環境**的落差、
> 記錄已知歧義與技術債基準，並同步已裁定的圖示分類基準。
>
> Antigravity / Gemini 讀 `GEMINI.md`；DSH 讀本檔，且**以 `GEMINI.md` 為上位規範**。
> 兩份文件並存，互不覆寫。

> **接手的 session 請先讀 [`docs/handoff.md`](docs/handoff.md)。**
> 本檔是規範本體（會被 harness 自動注入），但**不含**「踩過的坑、除錯方法、Git 歷史改寫始末」——
> 那些在交接簡報裡。規範自動生效，狀態要另外讀。
> ※ 交接簡報**刻意不放**現況數字與待辦清單（那些會過時）——**狀態一律以本檔 §1 與 §6 為準**。

---

## 0. 規範優先序

| 順位 | 來源 | 效力 |
|---|---|---|
| 1 | `GEMINI.md` | 最高持久規範，不可被本檔推翻 |
| 2 | 本檔 `AGENTS.md` | DSH 執行細則；補足落差、消解歧義 |
| 3 | `PROJECT_SPEC.md` §4 | 僅在與上述兩者不衝突時適用（**注意：本文件已過時，見 §5**） |
| 4 | `PROJECT_CHANGELOG.md` / 任何歷史報告 | **僅供參考，嚴禁作為事實依據**（依 `GEMINI.md` 規則六） |

---

## 1. 環境事實（DSH 專用）

- **工作目錄**：`E:\MINGWAN\Projects\monogatari-techou`（2026-10-05 由 `FU Companion` 更名，**已完成**）
  **一律以 harness 回報的實際工作目錄為準**（目前與本行一致）。
  本機路徑與 repo 名稱無關；`.github/workflows/deploy.yml` 與 `vite.config.js` 皆用相對路徑，**不受更名影響**。
- **可用工具**：`pwsh`、`read`、`write`、`edit`、`glob`、`grep`
- **建置指令**：`npm run build`（Vite 6，實測約 4.2 秒，exit 0）
- **建置產物**：`dist/`，JS 2,247 kB（gzip 649 kB）。chunk-size 警告為**已知既有現象**，非本次改動造成。
- **測試指令**：`npm test`（實測 **1 + 176/176 + 60/60 + 33/33 + 75/75 + 80/80 + 235/235 + 211/211 + 362/362 + 249/249 + 229/229 + 86/86 + 278/278 + 86/86 + 100/100 + 270/270 + 118/118** 通過，exit 0）。
  二十道測試關卡（其中兩道是自動化的規則關卡）：
  - `npm run test:emoji` —— **規則五.1 已自動化**（見 §3.2）；掃描範圍**已含 `shared/`**
  - `npm run test:affinity` —— 九相屬性標記（誤標表、正標表、資料層掃描、渲染器同步；見 §4 F）
  - `npm run test:equipment` —— 裝備配置（原書裝備表逐筆核對、裝備圖示對照表、熟練度與載入衝突、雙重盾牌、SSR 煙霧；見 `docs/decisions.md` §U）
  - `npm run test:creation` —— 開卡規則與生命週期（原書逐項對照、欄位集護欄、壞資料校正、`createNewCharacter`／`validateCharacter` 讀規則、定稿與進度清單、硬編碼不得回流的原始碼護欄；見 `docs/decisions.md` §V、§X）
  - `npm run test:log` —— 成長履歷（種類詞彙與圖示護欄、append-only 與合併時窗、摘要推導、建卡第一筆、寫入端原始碼護欄、SSR 煙霧；見 `docs/decisions.md` §W）
  - `npm run test:ui` —— 角色卡介面契約（`parseStepperInput` 的輸入語意、六項資源必須可自行填寫、升級流程必須顯示技能效果全文、入口標籤與詞彙護欄、**官方三頁匯出的欄位對應與版面**、**三頁 PDF 產生器與 xref 逐筆驗證**、圖示表重複鍵護欄；見 `docs/decisions.md` §Y、§Z）
  - `npm run test:sentinel` —— 哨兵遷移與回歸護欄
  - `npm run test:propernouns` —— 專有名詞對照與格式鐵律
  - `npm run test:projects` —— 造物專案成本與每日推進公式（對照原書官方範例）
  - `npm run test:resources` —— 職業資源池（上限公式與重置規則，對照原書）
  - `npm run test:gourmet` —— 美食家食材／食譜書（口味組合、d12 效果表、等級縮放，對照原書）
  - `npm run test:cards` —— 卡牌大師牌組與組合結算（30 張組成、8 種效果的精確比對、小丑牌指定、等級加成、牌運亨通、再調度、陷阱卡）
  - `npm run test:engine` —— 角色卡數值引擎（HP/MP/IP/危機/DEF/M.DEF，對照原書 p.163–164）
  - `npm run test:datalayer` —— 鍵註冊表、存取層、舊鍵遷移、房間同步契約
  - `npm run test:presets` —— 官方經典職業搭配 81 組（五本手冊，含篩選分組純函式與 SSR 渲染煙霧）
  - `npm run test:codex` —— 規則概念速查（16 條覆蓋率、關鍵字唯一性、授權合規、**譯名與定譯表逐字比對**）
  - `npm run test:variants` —— 核心書技能變體（取代目標必須存在於該職業、差異粗體成對、**公測開啟／關閉兩態的渲染契約**、閘門欄位形狀、**選用狀態的資料模型／顯示解析／互斥／規則層整合／回溯相容／儲存路徑**；見 `docs/decisions.md` §AV §AW）
  - `npm run test:aliases` —— 職業別稱（官方原書職業頁的「ALSO:」行）：`SOURCEBOOKS ↔ CLASS_ALIASES` **雙向覆蓋率**、28 職英文別稱與出處頁碼**逐條釘死**、顯示（`zh`）／檢索（`en` ＋ `zhExtra`）分流、搜尋純函式逐例、SSR 渲染煙霧與 `zhExtra` 不外洩（見 `docs/decisions.md` §AZ）
  - `npm run test:npcworkshop` —— NPC 工坊純函式（見 `docs/decisions.md` §AX／§AY）
  - `npm run test:npcworkshopui` —— NPC 工坊元件層 SSR（8 道建角步驟的內容錨點；見 §AX）
  測試源碼位於受版控的 `tests/`；bundle 產物輸出至 `.test-build/`（已列入 `.gitignore`）。
  ⚠️ **新增測試檔時，同步改 `package.json` 的 `test` 串鏈是改動的一部分，不是後續工作**——
  `coreBookVariants.test.mjs` 曾被建立後隔了一天都沒被執行（見 §AV1 缺陷 3）。一道不跑的護欄等於不存在。
  ⚠️ **新增護欄後必須做一次「刻意破壞驗證」**（把行為改壞 → 確認它 FAIL → 還原），
  這個步驟**不是「有空再做」**。理由：§AW6 的三個 bug 裡有兩個是「**測試自己壞掉**」，
  而它們的表現與「程式全對」**一模一樣：全綠**。唯一能分辨的方法是故意把它弄壞。
  ⚠️ 斷言 `html.includes('某字串')` 之前，先問「**這個字串在別的區塊是不是也有？**」
  有的話用錨點切出區段（如 `data-testid="variant-browse"`）或比**出現次數**，
  否則斷言會恆真（§AW6(c)）。
  ⚠️ **`onClick` 內的邏輯 SSR 測不到**（SSR 不執行事件）。要測就得抽成**純函式**放資料層
  （如 `buildSkillEntry`），見 §AW6(b)。
  ⚠️ **SSR 測不到的區塊，優先「加測試注入點」而不是「放棄覆蓋」。**
  例：`NPCWorkshop` 的 8 道建角步驟需要 `state !== null` 才渲染，而 `state` 原本只能由
  使用者點擊產生——等於 `renderStepContent` 約 2,100 行**完全沒有護欄**。
  解法是加三個**生產端永不傳入**的 props（`initialDraft`／`initialMainTab`／`initialStep`），
  讓護欄能把流程直接渲染到指定步驟（見 `tests/npcWorkshopUi.test.mjs` E 段）。
  **注入點的鐵律：不傳時行為必須逐字不變**，否則就是為了測試而改動生產行為。
  ⚠️ **「渲染得出來」不等於「內容對」——每一步都要有「只出現在該步」的內容錨點。**
  2026-10-16 實測：把某一步的 `case` 改壞讓它落不到內容，**長度斷言仍然綠**
  （外框與右側預覽就撐過 1,500 字元），是**錨點斷言**抓到的。
  ⚠️ `scratch/` 整個目錄**不在版控內**（`.gitignore:27`），凡置於該處的測試或 bundle 都會與源碼脫鉤——
  2026-10-03 的舊 `stage1.bundle.mjs` 即因早於源碼 40 秒打包，執行後產生 1 筆假失敗。**測試一律放 `tests/`。**
- **截圖量測的陷阱**：`chrome --headless --window-size=390` 的**實際視窗是 500px**
  （Chromium 的視窗最小寬度）——所以「390px 手機截圖」其實是 500px 的版面被裁掉右邊，
  **看起來像版面溢出，其實是截圖工具的假象**。要驗真手機寬度，用
  `scratch/mobile_viewport.html`（iframe 有自己的 viewport）。
  `--headless=old`／`=new` 都一樣；`--dump-dom` 在這個版本沒有輸出。
  完整過程與教訓見 `docs/decisions.md` §AT。
- **樣式系統**：Tailwind 3。全站為**羊皮紙暖色調**（`#fbf7ee` / `#3c2415` / `#d6c7ab`），**非**深色石板底。
- **推送（push）的陷阱**：在 WorkBuddy 的 bash 環境裡直接 `git push` **會永遠掛住**——
  harness 的 PortableGit 把自己的 `etc/gitconfig` 設成 `credential.helper = helper-selector`，
  那是**會彈 GUI 視窗的互動式選擇器**，它不讀 `GIT_TERMINAL_PROMPT=0`，所以在無 GUI 環境下
  就卡在那裡等認證（沒有輸出、最後被 SIGTERM）。
  **解法：改用系統 Git。**
  ```bash
  GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never \
    "/c/Program Files/Git/bin/git.exe" push origin main
  ```
  系統 Git 的 helper 是 `manager`（GCM 2.7.3），且 Windows 憑證管理員裡已有 GitHub 憑證。
  診斷方式：`git config --show-origin --get-all credential.helper`——
  來源若是 `WorkBuddyAI/resources/vendor/PortableGit/etc/gitconfig` 就是撞上這個坑。
- **資料層**：純 localStorage，但**已收斂為單一存取層**（2026-10-04，見 `docs/decisions.md` §L）：
  - 鍵註冊表 `src/data/keys.js`：**7 個權威鍵（`monogatari_techou_` 前綴）+ 11 個舊鍵**
  - 存取層 `src/data/store.js`：`readJSON`／`writeJSON`／`readRaw`／`writeRaw`／`subscribe`／`migrateLegacyStorage`
  - **全站不得再直接呼叫 `localStorage`**（`src/` 內已零殘留，僅註解提及）
  - 舊鍵遷移於 `main.jsx` 首次渲染前執行；**冪等、不覆寫、不刪除舊鍵**
  - 房間同步契約 `shared/schema.js`（前端與未來的 Worker 共用）

### 1.1 官方 PDF 抽取（規則二.4 的必要工具）

**工作區可讀的官方原書（皆在專案目錄之外，`E:\MINGWAN\TRPG\Fabula ultima\`）**：

| 書 | 檔名 | 頁數 | 用途 |
|---|---|---|---|
| 核心規則書 v1.1 | `最終幻想1.1\Fabula_Ultima_TTJRPG_Need_Games,_Rooster_Games_Fabula_Ultima_Core.pdf` | 362 | 機制最高權威 |
| 高度奇幻手冊 | `最終幻想1.1\..._High_Fantasy_Atlas.pdf` | 202 | 拓展職業 |
| 自然奇幻手冊 | `最終幻想1.1\..._Natural_Fantasy_Atlas.pdf` | 210 | 拓展職業 |
| 科技奇幻手冊 | `最終幻想1.1\..._Techno_Fantasy_Atlas.pdf` | 218 | 拓展職業 |
| 怪物圖鑑 Vol.1 | `Fabula Ultima Bestiary Vol. 1 KS_preview.pdf` | 366 | **NPC 定位（職業）來源** |
| 官方特典合輯 | `最終幻想1.1\Fabula_Ultima_TTJRPG_Bonus_Collection.pdf` | 48 | 兩筆 bonus 職業＋其餘特典內容 |

- ⚠️ `read` 工具**無法**直讀 PDF；`pdftotext` / `pdftk` **皆未安裝**。
- ✅ **`pypdf 6.19.0` 已安裝**（DSH bundled Python）。
  - 🚨 **2026-10-04 實測發現：本行原先記載的「已安裝」是假的**——`import pypdf` 直接
    `ModuleNotFoundError`，意即 `GEMINI.md` 規則二.4「實作前必須先讀官方原書」
    在該日之前**根本無法執行**。此為本檔第二個被實證推翻的「環境事實」（第一個見 §4 A）。
  - 已以 `python -m pip install pypdf` 補上。**日後新增此類環境事實，必須在同一輪實跑驗證指令**：
    `& $py -c "import pypdf; print(pypdf.__version__)"`
  - `fontTools` 狀態未複驗（文字抽取不需要它）。
- **抽取工具**：`scratch/pdf_text.py`（`scratch/` 不在版控內，重建即可）。
  用法：`python scratch/pdf_text.py <pdf> <起始頁> <結束頁>`，或 `--search "關鍵字" [前後頁數]`。

```powershell
# DSH bundled Python（路徑隨環境而異；以 $env:DSH_* 或 harness 回報的 python 路徑取代）
$py = "<DSH bundled python>\python.exe"
$pdf = "<原書所在目錄>\最終幻想1.1\Fabula_Ultima_TTJRPG_Need_Games,_Rooster_Games_Fabula_Ultima_Core.pdf"
& $py "scratch\pdf_text.py" $pdf <起始頁> <結束頁>
```

> ⚠️ 本節原本記有**本機絕對路徑**（含 Windows 使用者名稱）。本 repo 為**公開**，
> 已於 2026-10-04 改為佔位符。實際路徑請由環境自行取得，**不要把使用者名稱寫回本檔**。

> ⚠️ **頁碼偏移因書而異**（2026-10-04 實測，**不可套用單一規則**）：
>
> | 書 | 偏移 | 實測 |
> |---|---|---|
> | 核心規則書 | **PDF = 印刷 + 2** | 印刷 p.134 → PDF p.136 |
> | 高度／自然／科技奇幻手冊 | **+2** | 印刷 p.159 → PDF p.161 |
> | **官方特典合輯** | **0（無偏移）** | 印刷 p.7 → PDF p.7 |
>
> 引用頁碼前**務必先確認該書的偏移**，不要沿用上一本的。
>
> ⚠️ **封面頁文字層有重複行**（該頁採 faux-bold 疊印）；其餘內文頁抽取乾淨，
> 表格數值可直接用於機制核對。

### 1.2 民間漢化內容（譯名權威，規則二.1）

**用途**：**只管譯名，不管機制**。機制一律以英文原書為準（見 §1.1）。

#### ✅ 內容位置：**repo 內就有**（不必解 CHM）

> 🚨 **2026-10-04 更正**：先前記載「CHM 為 LZX 壓縮、無法解開」——**完全錯誤**。
> 漢化內容**早已解開並收進本 repo**，而且是轉好的 Markdown。

**首選來源（版控內）**：

```
resources/角色卡/
  ├─ README.md                                  ← 28 職業對照總表（正式名 vs 測試版舊譯名）
  ├─ 01_Core_Rulebook/                          官方原書 PDF 節錄（25 檔）
  ├─ 02_High_Fantasy_高魔奇幻/
  │    ├─ 0X_职业_*.pdf                         官方原書 PDF 節錄
  │    └─ CHM_Playtest_中文翻译/                ★ .md + .html（CHM 漢化）
  ├─ 03_Natural_Fantasy_自然奇幻/  （同上結構）
  ├─ 04_Techno_Fantasy_科技奇幻/   （同上結構）
  └─ 05_Bonus_节日与额外扩展/      （同上結構）
```

**規模**：106 檔 / 92 MB（54 PDF、26 MD、25 HTML、1 XLSX）。

**漢化抽出來源（版控外，僅供追溯）**：
`E:\MINGWAN\TRPG\Fabula ultima\DLC\《Fabula Ultima最终物语》全扩展不全书V1.0(1)\`（26 個 HTML）。
CHM 旁的 `.html` 只是 301 bytes 的空殼 frameset，**無用**；真正的內容在那個同名資料夾。

> 🔑 **教訓（兩層）**：
> ① 找不到內容時，**先看 repo 內有沒有已經整理好的資源**，再去解外部檔案。
> ② `hh.exe` 解不開時，**先看檔案旁邊有沒有已經解開的資料夾**——不要急著實作 LZX。

#### 抽取指令（僅在需要重新抽取時）

```powershell
# 用 lxml 把 DLC 資料夾的 26 個 HTML 抽成純文字
# 輸出到 scratch/chm_content/（gitignored）——repo 內已有更好的 .md 版本，通常不需要跑
& $py "scratch\extract_chm_html.py"
```

> ⚠️ **譯名衝突未解**：`README.md` 的「正式中文名」欄位與 CHM 舊譯名**不一致**（7 個職業）。
> 本專案目前採用 **CHM 舊譯名**（依使用者裁定）。詳見 `docs/decisions.md` §H。

> ⚠️ **本檔為「不全書」**：缺漏的內容**不代表官方沒有**，只代表這份漢化沒收錄。
> 查不到譯名時**不得反推為「官方無此內容」**，只能標記為「CHM 未收錄」。

#### 已知譯名對照（取自檔名與內容）

| 英文 | 漢化 | 本專案 | 狀態 |
|---|---|---|---|
| Quirk | **金手指** | 金手指 | ✅ 相符 |
| High Fantasy | **高度奇幻** | 高度奇幻 | ✅ 已於 2026-10-04 修正 |
| Natural Fantasy | 自然奇幻 | 自然奇幻 | ✅ |
| Techno Fantasy | 科技奇幻 | 科技奇幻 | ✅ |
| Custom Weapon | 自定義武器 | **定制武器** | ✅ 2026-10-06 使用者裁定（見 §AS） |
| Zero Power | 底力技 | （未收錄） | — |
| Technospheres | 魔晶石 | （未收錄） | — |
| Camp Activities | 營地活動 | 營地活動 | ✅ |
| Heroic Skills | 英雄技能 | 英雄技能 | ✅ |

---

## 2. `GEMINI.md` 七大規則在 DSH 的對應實作

### 規則一：圖示三軌鐵律（已於 2026-10-03 裁定分流）
- **軌道 1（官方字型）**：完全沿用 `.fu-icon` / `<FUIcon />` / `renderTextWithAffinities`，零變更。
- **軌道 2（敘事性遊戲圖示）**：職業、範本、物種、定位、資源、狀態、裝備類別等**具世界觀敘事意涵**者，一律 `react-icons/gi`。
- **軌道 2 豁免（功能性 UI 控件）**：返回、關閉／打叉、搜尋、新增、折疊箭頭等**純操作控件**，可使用純 Unicode 排版字符（`←` `✕` `✓` `➔` 等）**或既有圖示庫**，不強制改用 Game-Icons.net。
  - 判定準則：換成純文字後語意不變、且不損沉浸感者 → 功能性控件，適用豁免。
  - **`lucide-react` 硬性範圍（2026-10-04 裁定）**：**僅限**功能性控件。敘事槽位（物種、範本、職業、定位、資源、裝備類別、屬性、反派階級、區塊標題、徽章、空狀態）一律 `react-icons/gi`——lucide 的均勻描邊幾何語彙與羊皮紙＋gi 實心剪影互斥。
- **軌道 3（零 Emoji）**：彩色圖像化 Emoji 全站禁止；純排版字符（`✦` `❖` `★` `◆` `①`~`⑤`）不在此限。
  - **符號詞彙表（2026-10-04 裁定）**：需要視覺錨點的敘事／狀態標記，一律採 `GEMINI.md`「軌道 3 附錄」的**封閉詞彙** `★ ❖ ✦ ✕ ※ △ ◈ ▽ ▼ ◆ ● ◷ ✎`，不得自行發明新符號。官方機制符號仍優先走 `.fu-icon`。
- ⚠️ 檢測正則已同步更新至 `GEMINI.md` 規則五.1（與本檔 §3 同版本）。

### 規則二：規則手冊依據標準
- 官方英文 Core v1.1 為機制最高權威；民間漢化為中文譯名標準；衝突時官方英文優先。
- ✅ **官方原書可讀**（位置與抽取方式見 §1.1）。涉及《FU》專有子系統的實作前，
  **必須先抽取對應章節逐條核對**，嚴禁憑記憶編造等級階級、檢定或數值。
- ✅ **譯名權威（2026-10-05 修訂，見 `docs/decisions.md` §M2）**：**只管譯名，不管機制**——
  譯名決定「中文怎麼寫」，**官方英文正式版**決定「規則是什麼」，兩者職責不可互換。
  - **核心手冊**（阿爾卡納／儀式／小工具／造物／忠實夥伴／咒語）→ 官方核心規則漢化 PDF
  - **三大奇幻手冊與特典**（10 個職業子系統）→ 繁中版角色卡 Excel V2.17
  - ⚠️ **CHM 是測試版**：凡機制與 CHM 衝突者一律以英文正式版為準。抽取方式見 §1.2。
- **「職業」定譯鐵律**：Martial 系列一律譯「職業」（職業近戰武器／職業遠程武器／職業防具／職業盾牌），**嚴禁「軍用」**。

### 規則三：純中文顯示鐵律
- 禁止「中文名（English）」括號附註格式。
- 唯一允許縮寫：`DEX/INS/MIG/WLP`、`HP/MP/IP`、`HR`、`SL`、`DEF/M.DEF`、`z`、`d6~d20`。
- ⚠️ 邊界案例見 §5 技術債 C 項（物種英文標籤、`【Playtest】` 等）。

### 規則四：文案與顯示文本預審協議 —— ⚠️ **DSH 已於 2026-10-05 經使用者授權停用**

> **使用者授權（2026-10-05，原文）**：「給你授權。由於你的能力更加優秀，所以不需要再輸出
> implementation plan 這個規矩。日後有什麼計劃討論完畢後就可以直接實裝。」
>
> 故 DSH 的等效流程（原為：寫 `implementation_plan.md` → `ask_user_question` 確認 → 才可實裝）
> **不再要求事前產出計畫文件或等待確認**。**計畫在對話中討論定案後即可直接實裝。**
> 既有 `implementation_plan-*.md` 保留為歷史紀錄，不刪。
>
> ⚠️ **`GEMINI.md` 規則四原文未被改寫**（本檔不得改寫其原文）。Antigravity／Gemini 仍依
> `GEMINI.md` 走 Artifact 流程；此停用僅適用於 DSH。若使用者日後要求恢復，改回本節即可。
>
> **仍會主動提請確認的情況**（判斷，非規範）：需求本身有歧義、或涉及不可逆的資料刪除。

### 規則五：防退化自檢流程
每次代碼改動完成後、回覆使用者前，**必須**依序執行：

1. **Emoji 掃描** —— 使用 §3 修正版正則（非 `GEMINI.md` 原始版本）。
2. **建置驗證** —— `npm run build` 必須 `exit 0`。

兩項未通過即不得宣稱完成。

### 規則六：源碼審查與事實唯一基準
- 一律以**當前工作區實際源碼**為唯一事實基準。
- **嚴禁**引用歷史報告、舊 Session 草稿或 `PROJECT_CHANGELOG.md` 作為現況結論。
- ⚠️ 本條已獲實證支持：`PROJECT_CHANGELOG.md` 三處宣稱「零 Emoji 合規」，與實測結果嚴重不符（見 §4）。

### 規則七：效果文本九相屬性內聯渲染鐵律
- 九相屬性詞彙一律經 `renderTextWithAffinities` 渲染（`src/components/ui/FUIcon.jsx`）。
- **防誤傷**：`中毒`／`微光視覺`／`曲風`／`暴風`／`物理防禦`／`物防`／`火器` 等不得加圖示。
  - ⚠️ **這份清單是歷史黑名單，不是判定依據。** 2026-10-05 起判定改為「**情境白名單 ＋ 夾字否決**」
    （`src/components/ui/affinityText.js`，見 §4 F）：只有括號、明確後綴、列舉、繫詞等**正面證據**才標。
    舊黑名單漏掉的「發電」「光環」「風格」「暗黑之刃」「火砲模組」都曾真的被畫錯。
    **新增例外詞時不要只往清單裡加**——要改判定規則，並把該詞補進 `test:affinity` 的誤標表。
- **零冗餘標籤**：已內聯屬性圖示者，移除標題旁重複徽章。
- **基線零下沉**：外層容器**嚴禁 `inline-flex`**，一律純 `inline`；`.fu-icon` 自身為
  `display:inline-block; vertical-align:-0.08em; line-height:1`。

---

## 3. Emoji 檢測：修正版正則（取代 `GEMINI.md` 規則五.1）

### 問題
`GEMINI.md` 規則五.1 提供的正則：

```powershell
Get-ChildItem -Path "src" -Recurse -File | Select-String -Pattern "[\uD83C-\uDBFF\uDC00-\uDFFF]"
```

**只能命中代理對（U+1F000 以上）**，會完全漏掉所有 BMP 平面 emoji。
經實測（2026-10-03，哨兵遷移**前**的原始基準），本專案實際違規數為：

| 檢測方式 | 命中行數 | 命中次數 |
|---|---|---|
| `GEMINI.md` 原始正則 | **41** | **98** |
| 本檔修正版正則（emoji，含 BMP） | **149** | **282** |

原始正則的**檢出率僅 27.5%（按行）／34.8%（按次數）**——
這是歷次「零 Emoji 檢驗通過」卻仍殘留大量 emoji 的直接原因。

> ⚠️ 上表為**歷史基準**，用以證明正則修正的必要性；**現行殘留數見 §4 A（已清零 0 行 / 0 次）**。

> ⚠️ **單位陷阱**：`Select-String` 預設**每行只回傳一筆**（行數）；
> 加上 `-AllMatches` 則回傳**每個匹配**（次數）。
> 同一份源碼，行數與次數可相差近兩倍（例：`roles.js` 為 7 行 / 37 次）。
> **引用數字時必須標明單位。**

### 修正版正則（DSH 一律使用此版）

```powershell
Get-ChildItem -Path "src" -Recurse -File |
  Where-Object { $_.Extension -in '.js','.jsx','.json','.css' } |
  Select-String -Pattern '[\uD83C-\uDBFF\uDC00-\uDFFF\u26A1\u26A0\u2705\u274C\u26D3\u2620\u2744\u2600\u23F3\u270F\u2728\u2694]'
```

涵蓋 `GEMINI.md` 原始版本漏掉的高頻 BMP emoji：
`⚡ U+26A1`、`⚠️ U+26A0`、`✅ U+2705`、`❌ U+274C`、`⛓️ U+26D3`、`☠️ U+2620`、
`❄️ U+2744`、`☀️ U+2600`、`⏳ U+23F3`、`✏️ U+270F`、`✨ U+2728`、`⚔️ U+2694`。

> 註：`✦ U+2726`、`✓ U+2713`、`✗ U+2717`、`➔ U+2794`、`❖ U+2756`、`★ U+2605`、`◆ U+25C6`、`①`~`⑤` 屬**排版字符（dingbat）而非 emoji**。
> 依 `GEMINI.md` 軌道 2 豁免條款與軌道 3「Emoji 與排版字符之區分」，**明確允許保留**，且**刻意不納入**上述正則。

### 3.1 ⚡ 語意哨兵 —— ✅ 已於 2026-10-04 完成結構化遷移

**原設計**：攻擊性咒語以 `⚡`（U+26A1）為名稱後綴，程式以 `.includes('⚡')` 判定。
該隱式約定已廢除，改由結構化欄位承載：

- **資料層**：`src/features/npc-workshop/data/spells.js` 的 `SPELLS_DATA[...].isOffensive === true`。
- **判定入口**：同檔 `isOffensiveSpell(name)`——先做舊哨兵相容，再查結構化欄位。
- **舊存檔遷移**：`src/features/npc-workshop/utils/npcEngine.js` 的 `migrateSpellSentinel()`／`migrateNpcState()`，
  正規化技能名稱、咒語書選項、已選咒語與物種咒語鍵，並為「僅以哨兵表達攻擊性」的舊資料補上 `spellData.isOffensive`。
- **原始碼零 Emoji 字面量**：判定路徑一律以跳脫序列 `'\u26A1'` 表示
  （`spells.js:9`、`npcEngine.js:13`、`skillFormulaEvaluator.jsx` 的正則）。
- **回歸護欄**：`npm run test:sentinel` 的 H 區段會檢查上述三檔不含哨兵字面量。

**殘留的 6 行顯示用 `⚡` 已於同日階段 2 一併清除**（原清單：`NPCWorkshop.jsx` 的技能分類圖示、複製文本前綴、Markdown 匯出標題、相性摘要標籤，以及 `constants.js` 的 `CATEGORIES.icon` / `TYPE_STYLES.emoji` 兩個退路欄位）。

> ✅ **`⚡` 現已全站零殘留**（`src/` 內僅存於 `spells.js:9`／`npcEngine.js:13`／`skillFormulaEvaluator.jsx` 的跳脫序列 `'\u26A1'`，屬相容用、不渲染）。
> **判定邏輯與顯示層雙雙與哨兵解耦**，本條目結案。

### 3.2 規則五.1 已自動化 —— ✅ 2026-10-04 起由測試把關

`npm run test:emoji`（`tests/emojiScan.test.mjs`）以**修正版正則**掃描 `src/` 全部
`.js`/`.jsx`/`.json`/`.css`，命中即 `exit 1`，並列出 `檔案:行 U+碼位` 與該行內容。

**為什麼要做成測試**：2026-10-04 一天內，**同一種失誤發生三次**（後續又發生兩次，最近一次是 2026-10-08 修 §AS10 的 bug 時）——
把 `⚠️` 寫進自己的註解（`properNouns.js`、`tinkererProjects.js`、`classResources.js`），
每次都是靠手動掃描才在最後關頭抓到。手動關卡會漏，所以改成自動、排進 `npm test` 的第一道。

> ✅ **關卡有效性已驗證**：刻意注入一個 `U+26A0` → `exit 1` 並精準指出位置；
> 還原後 → `exit 0`。**一個不會失敗的測試等於沒有測試。**

---

## 4. 已知技術債基準（截至 2026-10 稽核）

> 本節為**現況快照**，供避免重複申報與誤判「新引入」之用。
> 依 `GEMINI.md` 規則六，每次稽核仍須以即時源碼重新驗證。

### A. Emoji 殘留 —— ✅ 已於 2026-10-04 清零（規則一軌道 3）
以**修正版正則**實測（`src/` 程式碼檔 75 個——`.js`/`.jsx`/`.json`/`.css`——共 38,619 行）：

| 時點 | 行（檔案:行） | 次 | 說明 |
|---|---|---|---|
| 2026-10-03 | 149 | 282 | 修正版正則首次套用（哨兵遷移**前**） |
| 2026-10-04 | 76 | 145 | 階段 1 哨兵遷移後 |
| 2026-10-04 | **0** | **0** | ✅ **階段 2 完成後** |

> ✅ **零 Emoji 鐵律首次真正達成**。`GEMINI.md` 規則五.1 的檢測正則現在能真正通過——
> 有別於 `PROJECT_CHANGELOG.md` 那三次與實測嚴重不符的「宣稱通過」（見 §5 C）。
>
> **執行依據**：`emoji-cleanup-decisions.xlsx` 逐列裁決表，80 列全數「採用建議」。
> 分頁圖示依使用者裁定改用 `react-icons/gi`（`GiRollingDices`／`GiCrossedSwords`／`GiSpellBook`）。
>
> **符號採用**（依 `GEMINI.md` 軌道 3 附錄封閉詞彙，括號為本次新增數）：
> `★`(6) `❖`(3) `✦`(3) `✕`(1) `※`(2) `△`(2) `◈`(3) `▽`(1) `▼`(1) `◆`(2) `●`(1) `◷`(1) `✎`(2)。
>
> **刪除而非替補者**：三處純裝飾浮水印（`opacity-[0.05~0.06]` 的 `🔓`／`🔥`／`🔮`）——
> 它們不承載語意，換符號只會多一個噪音。
>
> **資料層退路欄位已整欄移除**：`TYPE_STYLES.emoji`（十筆）、`CATEGORIES.icon`（五筆）、
> `ROLE_DESCRIPTIONS.icon`（六筆）。三者的 `fuIcon` / `Icon` 欄位早已完整覆蓋，
> 移除後連帶清掉六處「永不觸發的 fallback 三元式」（已改為直接渲染或 `null`）。
>
> **純文字輸出路徑**（複製文本／Markdown 匯出／ccfolia）一律改為純文字，不帶任何圖示——
> 該處渲染不出字型與 SVG。同時清掉匯出標題的英文 `(BASIC ATTACKS & ACTIONS)`（規則三）。

### B. 圖示庫分佈（規則一軌道 2）
清查方法：`scripts/audit_lucide_usage.py`（只計 JSX 使用點，不計匯入本身）。

| 時點 | lucide 檔 | gi 檔 | 同時使用 | lucide 使用點 |
|---|---|---|---|---|
| 2026-10-03（原始基準） | 26 | 37 | 18 | 243 |
| 2026-10-04（階段 3 完成後） | **26** | **42** | **23** | 敘事槽位 52 點已改 gi |

> ✅ **階段 3 已於 2026-10-04 完成**（commit `37939bf`，2026-10-05 歷史改寫前的舊編號為 `ce85f55`）：52 個誤用於敘事槽位者改為 gi。
> lucide 檔案數**不變**是正確結果——本階段不動功能性控件，只把敘事槽位換掉；
> gi 檔數上升 5 檔（`NPCCardPreview`／`NPCLibrary`／`CombatTracker`／`AddCombatantModal`／`CombatantCard` 由「純 lucide」轉為混用）。
>
> **判定準則**：功能性控件（返回／關閉／搜尋／新增／折疊／排序／篩選／複製／刪除／上傳下載／顯示切換／Toast 狀態）→ lucide 合規；
> 敘事槽位（物種／範本／職業／定位／資源／裝備類別／屬性／反派階級／區塊標題／徽章／空狀態）→ 一律 gi。
> 此準則已寫入 `GEMINI.md` 軌道 2 豁免條款。
>
> **離群診斷**：`character-sheet` 系列本來就全面使用 gi（`GiHealthNormal`／`GiLightningTear`／`GiSparkles`／`GiPocketWatch`／`GiCrossedSwords`），
> 誤用集中於 `npc-workshop` 與 `combat-tracker`——即歷史上由不同批次實作、未經同一次圖示稽核的兩個模組。

### C. 純中文邊界案例（規則三）—— 2026-10-04 大幅收斂
使用者裁定「**專有名詞例外**」後，規則三改為三段式（已寫入 `GEMINI.md`）：
**介面標題／步驟標籤一律純中文**；**職業／範本／物種用「中文 · ENGLISH」**；其餘照舊。

**本次已清除（面向使用者的英文標籤）**：
- `CharacterEditor.jsx` 六步驟的 `en` 欄位（`IDENTITY`／`ATTRIBUTES`／`CLASSES`／`EQUIPMENT`／`BONDS`／`HEROIC & CLOCKS`）與其渲染點 `{t.en}`
- `NPCWorkshop.jsx` 複製文本的 `(BASIC ATTACKS & ACTIONS)`／`(BASIC ATTACKS)`／`(SPELLS)`
- `NPCBuilder.jsx` 兩處步驟標題 `(Level & Rank)`／`(Boss & Negative Skills)`
- `CombatTracker.jsx` `(Enemies & Bosses)`
- `TinkererWorkshop.jsx` 三個公式標籤 `(Base Potency)`／`(Area Multiplier)`／`(Uses Multiplier)`
- `WayfarerCompanionModal.jsx` `（Species）`
- `BookCoverHub.jsx` `'CLICK TO OPEN'` → `'點擊翻開'`
- `ChimeristManager.jsx` 三個物種選項 `野獸 (Beast)` → `野獸 · BEAST`
- **2026-10-06 追加**：`IdentityTablesModal.jsx` 的 `中文 (English)` 括號附註（6 處）與列表的英文行（3 處）——身份核心概念／形容特質／身世細節**不屬**職業／範本／物種，沒有「`中文 · ENGLISH`」的例外。**英文保留在搜尋比對**（`filterList` 仍比對 `item.en`）：那是檢索，不是顯示。同輪另把彈窗的四個屬性名收斂為 `ATTRIBUTE_NAMES`（見 §4 E 註）。

**經裁定保留，不再是違規**：
- `SPECIES_THEMES` 的八個物種英文標籤（`'BEAST'`…`'UNDEAD'`）——物種屬專有名詞，
  且物種瓷磚本即中英並列（中文名一行、英文標籤一行）。
  ✅ 英文名已由原書 **Core p.302** 逐字核對：`beast, construct, demon, elemental, humanoid, monster, plant, undead`。

**仍待處理 / 刻意不改**：
- ~~`BookCoverHub.jsx:104` 的 `FU COMPANION 《物語助手》`~~ —— ✅ **2026-10-05 已改為《物語手帳》**（見 `docs/decisions.md` §K8）
- `rulesData.json` 的 `秘儀師【Playtest】` 等英文標籤
- `CharacterEditor.jsx` 的 `✓` / `✗`（dingbat，依 2026-10-03 裁定允許）
- ⚠️ `NPCWorkshop.jsx` 的 ccfolia 參數 `{ label: "INIT", … }`——**這是外部工具（ccfolia）的欄位識別字，
  不是顯示文案，刻意保留**。改掉會破壞使用者既有的 ccfolia 聊天巨集。

### D. 規則七.4 `inline-flex` — **休眠狀態，非現行違規**
- `src/components/ui/FUIcon.jsx:107` 的 `showLabel` 分支使用 `inline-flex`。
- 經全站檢索，`showLabel` **無任何呼叫點**，屬死碼路徑。
- 同檔 `renderTextWithAffinities`（`:157`、`:164`）正確使用純 `inline`。
- **結論**：目前無實際基線偏移；若未來啟用 `showLabel`，須先改為 `inline`。

### E. 建置與測試
- `npm run build` 通過（exit 0，2026-10-06 實測 9.77 秒）。
- JS bundle 2,252 kB / gzip 651 kB，觸發 Vite chunk-size 警告（>500 kB）。
  建議未來以 `manualChunks` 或 `import()` 拆分，但**非當前規範要求**。
- `npm test` 通過（**1 + 176/176 + 60/60 + 33/33 + 75/75 + 80/80 + 235/235 + 211/211 + 362/362 + 249/249 + 229/229 + 86/86 + 278/278 + 86/86 + 100/100 + 270/270 + 118/118**，exit 0）。
  已補上測試的模組：造物專案成本與每日推進（`test:projects`）、職業資源池（`test:resources`）、
  美食家食材／食譜書（`test:gourmet`）、專有名詞對照（`test:propernouns`）、
  哨兵遷移（`test:sentinel`）、零 Emoji（`test:emoji`）、卡牌大師牌組（`test:cards`）、
  **角色卡數值引擎（`test:engine`，2026-10-04 補上）**、**資料層與房間契約（`test:datalayer`）**、
  **官方經典職業搭配 81 組（`test:presets`，2026-10-05 補上）**、
  **九相屬性標記（`test:affinity`，2026-10-05 補上，見 §4 F）**、
  **裝備配置（`test:equipment`，2026-10-05 補上，見 `docs/decisions.md` §U）**、
  **開卡規則（`test:creation`，2026-10-05 補上，見 `docs/decisions.md` §V、§X）**、
  **成長履歷（`test:log`，2026-10-05 補上，見 `docs/decisions.md` §W）**、
  **角色卡介面契約（`test:ui`，2026-10-05 補上，見 `docs/decisions.md` §Y、§Z）**、
  **創角步驟次序與開卡規則稽核（`test:creation` O 區段 ＋ `test:ui` M 區段，2026-10-06 補上，見 `docs/decisions.md` §AE）**。
  **剩餘覆蓋缺口**：戰鬥輪次狀態機、Fultimator 匯入匯出。
  > ✅ **角色卡數值引擎的缺口已於 2026-10-04 補上**（`test:engine`；2026-10-05 擴充至 **322 項**
  > ＝ 243 項基礎向量 ＋ 79 項數值構成公式與免費增益二選一，見 `docs/decisions.md` §N）。
  > 官方 Camilla 向量已 1:1 還原（原書 p.163–164：等級 5、Might d6、Willpower d8
  > → HP 40／MP 50／危機 20／IP 6／DEF 8／M.DEF 10）。
  > 並確立兩條不變式：**HP/MP 用基礎骰**、**DEF/M.DEF 用當前骰**（狀態減值只影響後者）。
  > 該次同時以測試記錄了四個**既有缺陷**，見 `docs/decisions.md` §L4。

### F. 九相屬性標記 —— ✅ 2026-10-05 改為「情境白名單 ＋ 夾字否決」（規則七）

**現況基準**（`npm run audit:affinity` 實測，13 個資料模組 / 8,779 個字串欄位）：

| 項目 | 值 |
|---|---|
| 正確標記 | **1,030 處**（suffix 379／list 337／standalone 160／damage-tail 70／bracket 64／numbered 12／copula 8） |
| 修正前的誤標 | **317 處**（124 種情境；舊黑名單正則共命中 1,347 處） |

- **判定模組**：`src/components/ui/affinityText.js`（純函式 `findAffinityTokens`）。
  `FUIcon.jsx` 的 `renderTextWithAffinities` 只負責把結果畫成 `<span>`——**判定與渲染分離**，
  測試與稽核才能與實際渲染共用同一份實作。
- **規則**：R1 括號／R2 明確後綴／R3 列舉串（≥2 詞，含相性表記法「風弱電」的 `弱`）／
  R4 整串即屬性詞／R5 傷害式尾綴／R6 繫詞／R7 編號列舉；外加**夾字否決**
  （屬性字右側緊接非黏著漢字 → 只是詞的一部分，不標）。
  **原則：寧漏不誤**——少一個圖示只是少一點裝飾，多一個圖示是把「發電」讀成「閃電」。
- **護欄**：`npm run test:affinity`（`tests/affinityText.test.mjs`，176 項）——
  誤標表 117 條、正標表 29 條、資料層掃描（誤標詞放回語料零命中）、
  速查手冊現場逐格驗證、**渲染器同步**（`FUIcon.jsx` 不得再出現舊黑名單正則或內嵌 `const regex`）。
- **已知殘留**：詞尾剛好是屬性字再接分隔符＋屬性詞仍會誤標（例：「貿易之風、電屬性」的「風」）；
  `風之源泉【洞察】` 的「風」、`不屬於物理的傷害類型` 的「物理」等則**刻意接受失標**。
- 完整背景與逐條清單見 `docs/decisions.md` §Q。

---

## 5. 文件衝突與過時處（DSH 判讀依據）

### A. 圖示政策自相矛盾（已由 2026-10-04 裁定消解）
- `PROJECT_SPEC.md:26` 列「**圖標庫：`lucide-react`**」
- `PROJECT_SPEC.md:100` 卻寫「全站所有其餘圖標**默認一律從 Game-Icons.net** 選取，
  **嚴禁隨意混用現代極簡扁平圖標**」
- `GEMINI.md` 規則一軌道 2 與 `PROJECT_CHANGELOG.md:10` 皆只認 Game-Icons.net。

> lucide-react 正是「現代極簡扁平圖標」。
> ✅ **2026-10-04 裁定已把矛盾切乾淨**：lucide **僅限功能性控件**（軌道 2 豁免），
> 敘事槽位一律 `react-icons/gi`。此界線已寫入 `GEMINI.md` 軌道 2 豁免條款，並於同日完成階段 3 清查（§4 B）。
> 故 `PROJECT_SPEC.md:26` 的「圖標庫：lucide-react」應理解為**僅指功能性控件層**，其餘仍以 `GEMINI.md` 為準。
> 建議後續修訂 `PROJECT_SPEC.md` 時一併更正此兩行。

### B. `PROJECT_SPEC.md` 整體已過時 —— ✅ 2026-10-04 已加註並就地更正
- §4 描述深色石板底（`bg-zinc-950` / `#0c0d0e`）——**實際全站為羊皮紙暖色調**。
- §3 將 `dice-roller` 列為「模塊 4」——**實際第四個章節是 `clocks`（命刻記錄）**，
  骰子為全域浮動模態窗（`DiceRollerModal`）。
- §3 的 `src/types/`、`src/utils/storage.js`、`src/utils/exportImport.js`、`JRPGSelect.jsx`
  **在實際源碼中不存在**。

> ✅ **已於 2026-10-04 處理**：文件頂部加上「**已過時（歷史願景文件），不得作為現況事實依據**」狀態區塊，
> 逐條列出六處已知過時點；並就地以刪除線標註 §1 核心原則 2、§2 圖標庫、§3 目錄結構、
> §4 色彩系統，同時補上**實際值**（羊皮紙色票、實際章節順序、不存在的檔案）。
>
> **判讀原則**：本文件現為**專案意圖的歷史記錄**。規範效力以 `GEMINI.md` 為第一順位，
> 事實陳述一律以當前源碼為準。

### C. `PROJECT_CHANGELOG.md` 的合規宣稱不實 —— ✅ 2026-10-04 已加更正註記
- `:51`「修改檔案中零 Unicode Emoji 字符。」
- `:88`「全站 100% 通過零 Emoji 檢測。」
- `:119`「角色卡、名冊、骰盅與時鐘體系通過零 Emoji 檢驗。」

> 實測 98 處代理對 emoji 仍存在，**三處宣稱皆與現況不符**。
>
> ✅ **已於 2026-10-04 處理**：文件頂部加上更正表，逐條列出三處不實宣稱與實測值，
> 並寫明**根因**（當時的檢測正則只命中代理對，檢出率約 27.5%／34.8%）與
> **真正達成時間**（2026-10-04 技術債三階段完成後，非任一歷史宣告的時間點）。
>
> 此為 `GEMINI.md` 規則六存在的實證理由：**歷史報告不可信**。

### D. 路徑引用不精確
- `GEMINI.md` 規則六舉例 `rulesData.json`；實際路徑為
  `src/features/character-sheet/data/rulesData.json`。

---

## 6. 待決事項與決策紀錄

> **本節只保留索引。** 完整的決策紀錄（背景、逐條核對、過程教訓）在 **`docs/decisions.md`**。
> 原因同 §8：本檔會被當成指令注入，有硬性大小上限，細節留在本檔會把規則本體擠掉。

### 6.1 需使用者裁定（**未決**）

> ⚠️ **2026-10-15 全面複驗**：本表三列已結案、一列狀態有誤，逐條實測後更正如下。
> 每列的「內容」都註明**實測依據**——本表過去有「寫下來的狀態會過時」的問題（規則六）。

| 項目 | 內容 | 狀態 |
|---|---|---|
| ~~金手指來源標記~~ | ✅ **已由 §AR4 裁定結案**：使用者裁定「檢查重複，有重複就不列出處」——實測**有重複**（FLIGHT／CURSED 橫跨高低＋自然；ROBOT 橫跨高低＋科技），故**介面不列出處**，`（高奇）`等名稱標記與 `filterQuirksBySources` 一併移除（§AR5，55→46 筆）。**唯一殘留**：§AR7 的「金手指效果逐筆核對」待辦（見下列） | ✅ 已結案 |
| ~~本機路徑搬遷~~ | ✅ **已完成**：`AGENTS.md:25` 已是 `E:\MINGWAN\Projects\monogatari-techou` | ✅ 已結案 |
| 金手指效果逐筆核對 | §AR7 待辦：三大擴展 HF 15／NF 10／TF 10（＋特典 Halloween）**逐筆效果比對尚未做**（抽取工具 `scratch/extract_en_quirks.py` 已備）。另：特典 Halloween 系列曾被誤標「（科奇）」，實際來自特典合輯 | 待排程 |
| Bonus Collection 其餘 7 項 | ~~New Heroic Skills~~ ✅ 2026-10-06 已收錄（卡牌大師 4 筆，見 §AK4）；**Halloween 系列／Arcane Whispers／三隻 Additional Bosses** 仍待裁定優先序（Halloween 的**範例角色 8 組**已於 `expansionPresets.js` 收錄，此處指其餘內容） | 待裁定 |
| 先攻變體是否套用 | 本團玩 Playtest 2026-06-22「先攻」變體（無先攻值、防具無先攻減值、戰鬥束腰外衣改物防 +2／魔防 +0），但應用程式仍以核心規則值為準（見 `docs/decisions.md` §U7）。現況由 `tests/equipmentRules.test.mjs` L 區段釘住 | 待裁定 |
| ~~GitHub repo 改名~~ | **實測 `git remote -v` 已是 `https://github.com/Vice1412/monogatari-techou.git`——改名早已完成。**（2026-10-05 複驗更正） | ✅ 已結案 |
| 英雄技能「效果文字」逐筆核對 | ✅ **115 筆全部完成**（Core 31 ＋ HF 24 ＋ NF 21 ＋ TF 18 ＋ Bonus 21，共修 20 處；見 §AJ3、§AU）。**待辦**：Playtest changelog 明列約 20 個**修訂既有技能**的項目尚未套用 | 待排程 |
| Playtest 其餘選用規則 | 同文件還有前後排、Applause Points、Surrender、休息場景、電影式造物計畫等選用規則；本專案目前只實裝「開局英雄技能」與「高階角色起始資金」（實測 `DEFAULT_CREATION_RULES` 無相關欄位） | 待裁定 |
| D5 金手指選項 | 金手指「倖存者」的第三個選項「**IP 永久 +2**」未實作；「墮落天使」選項③「**最大 MP +10**」未實作（自然 p.129／科技 p.129／特典 p.18）。**結構性原因**：金手指目前只有「名稱比對」（`characterEngine.js` 的 `quirkName.includes(...)`），**無法承載「選項」** | 待裁定 |
| D6 官方飾品「洋蔥戒指」 | Core p.289：每個**不同職業**使最大 HP 與 MP 各 +2。**實測不在** `rulesData.equipment.accessories`（現僅 6 筆）→ 玩家無法選用 | 待裁定 |
| D7 暗黑之刃【Playtest】遠程 | 「職業近戰**或**遠程（二選一）」永遠只判定為近戰 → 職業遠程永遠 ✗ | 待裁定 |
| NPC 工坊重複函式 | `NPCWorkshop.jsx` 與 `utils/npcEngine.js` 之間有三組**同名函式**：`getInitialAffinities`（邏輯相同，可安全收斂）、**`migrateNpcState`（48 vs 18 行）**、**`getSpeciesAffinities`（66 vs 70 行）**——後兩者**行為不同**，且測試只覆蓋 `npcEngine.js` 那份、**生產端元件用的是另一份**（與 §AW「測試與生產分歧」同型）。**需裁定以哪份為準**（涉及既有 NPC 資料的遷移與相性計算）。詳見 `docs/decisions.md` §AX／§AY | 待裁定 |

### 6.2 已結案（索引）

> **編號即 `docs/decisions.md` 的節號。** 完整背景、逐條核對、實測數字與過程教訓都在那裡；
> 本表**只留結論**。（§I 的後續在 §O。）
>
> ⚠️ 這張表曾經長成「逐條完整歷史」——2026-10-06 一次壓回索引，理由是它一度佔全檔 39%
> （24,725 bytes），把規則本體擠到注入預算的邊緣。**新增列時請寫結論，不要寫過程。**

| 編號 | 主題 | 結論 | 日期 |
|---|---|---|---|
| A | 軌道 2 適用範圍 | 敘事性圖示 → `react-icons/gi`；功能性控件 → Unicode／lucide 豁免 | 2026-10-03 |
| B | 官方 PDF 位置 | 抽取方式見 §1.1 | 2026-10-03 |
| C | dingbat 是否納入零 Emoji | 排版字符（`✦ ✓ ✗ ➔ ❖ ★ ◆ ①~⑤`）不屬 Emoji，允許保留 | 2026-10-03 |
| D | 技術債清理排程 | 三階段（哨兵／Emoji／圖示）全部結案 | 2026-10-04 |
| E | 職業／範本／物種英文註釋 | 格式 `中文 · ENGLISH`；20 個渲染點、11 檔 | 2026-10-04 |
| F | Bonus Collection 其餘內容 | **未涵蓋**，見 6.1 | 待裁定 || G | 譯名權威改為 CHM | 只管譯名、不管機制 | 2026-10-04 |
| H | README 的「正式中文名」是錯的 | 以 CHM 譯名為準（7 個職業） | 2026-10-04 |
| I | `resources/` 版權狀態 | 改寫歷史挖掉 116 個路徑 ＋ force push；`.git` 77.5 → 11.2 MB，磁碟檔案保留。GitHub 端不可達物件待 Support 回收（見 §O） | 2026-10-05 |
| J | 狀態名稱統一 | 全站改「緩慢」；`enraged` 亦統一為「憤怒」（共 7 處） | 2026-10-04 |
| K | 懸空引用 | `（見【私房食譜】）` 改指實際介面「美食家工坊」 | 2026-10-04 |
| K2–K5 | 美食家工坊四輪改版 | 表格化／批次填寫／去冗長／食譜固定性 | 2026-10-04 |
| K6 | 卡牌大師牌組 | 30 張牌組狀態機；花色改用 gi | 2026-10-04 |
| K7 | 規則概念速查授權合規 | 只收機制不收畫風；覆蓋率 6 → 16 | 2026-10-05 |
| K8 | 應用名稱改為《物語手帳》 | 授權 §8 避險；localStorage 鍵名刻意不改 | 2026-10-05 |
| L | 資料層收斂 | 7 權威鍵（2026-10-16 前綴更名 `monogatari_techou_`，舊鍵降級不刪）＋ 11 舊鍵；全站零直接 `localStorage` | 2026-10-16 |
| M | 速查譯名稽核 | 約 140 處改回定譯；`test:codex` G 區段比對 121 個名稱 | 2026-10-05 |
| N | 職業技能改數值 ＋ 數值構成公式 | 35 職僅 2 項改上限；新增 `StatFormulaPanel`；D1～D3 已修，**D5～D7 待裁定**（D4 已隨 D3 移除），見 6.1 | 2026-10-05 |
| P | 官方經典職業搭配擴充 | 五本手冊共 **81 組**；套用時連技能子選擇與小工具／阿爾卡納／載具一起選好 | 2026-10-05 |
| Q | 九相屬性標記誤植 | 判定改「情境白名單 ＋ 夾字否決」；稽核出 317 處誤標、修後保留 1,030 處 | 2026-10-05 |
| R | 卡牌大師非英雄技能補完 | 陷阱卡改回官方正式版（`SL×5`）；新增三套 UI。**英雄技能依指示延後** | 2026-10-05 |
| S | 卡牌大師譯名統一 | 裁定 小丑牌／四條頭獎／魔法同花順／炫目順子／狀態滿貫 | 2026-10-05 |
| T | 卡牌大師三項修正 | 修 `isDeckInConflict()` 卡死；新增小丑牌指定；牌面改撲克牌樣式 | 2026-10-05 |
| U | 裝備配置呈現重設計 | 「顯示後果不顯示規格」＋「不能選的原因在選之前看見」；刪 4 筆無官方出處的裝備 | 2026-10-05 |
| V | 開卡規則抽離 | `data/creationRules.js`；GM 自訂開局／創角分流／Playtest 開關的共同前置 | 2026-10-05 |
| W | 成長履歷 | `utils/characterLog.js`；封閉詞彙、append-only、帶前後值、連續同值合併 | 2026-10-05 |
| X | 創角／編輯分流 | 定稿凍結（`LOCKED_CREATION_TABS`）＋ 導航列變進度表 ＋ `<fieldset disabled>` | 2026-10-05 |
| Y | 三項介面回報 | 升級流程改技能卡／`NumberStepper`／入口按鈕正名。新增 `test:ui` | 2026-10-05 |
| Z | 官方三頁 PNG 匯出 | 依官方版面重繪三頁 A4；`buildSheetModel` ＋ 自寫 `pdfWriter.js`（xref 可逐筆驗） | 2026-10-05 |
| AA | 「一按就死機」的調查 | `html-to-image` 字型 fetch 永不 resolve ＋ 跑團面板把事件物件當分頁編號 | 2026-10-05 |
| AB | 情感羈絆不屬創角 | 原書創角八步驟沒有羈絆 → `CREATION_STEPS` 6→5、`bonds: []`。跑團面板與三頁匯出刻意保留 | 2026-10-06 |
| AC | 跑團面板也能匯出 ＋ 內容補完 | 預覽彈窗兩入口共用；配色跟角色主題；技能／英雄技能／金手指補上效果全文 | 2026-10-06 |
| AD | 引擎既有錯誤一次修完 | 等級夾制改讀 `startingLevel`；另修物語點 0、升級白扣 EXP、等級兩來源、裝備回退 | 2026-10-06 |
| AE | 創角步驟稽核 ＋ 屬性譯名 ＋ 身份表 | **次序錯一處**（職業在屬性之前）＋另修 8 項；屬性譯名照 Excel → `靈巧`／`力量` | 2026-10-06 |
| AF | 第 6 步「命名與背景」 | 原書第 8 步是三件事而程式只有名字 → 獨立成第 6 步／外貌改背景／pronouns 改性別。**三頁匯出塞不下背景 → 不進三頁** | 2026-10-06 |
| AG | 規則層面最後稽核 | **A1** 英雄技能沒有精通關卡（5 級零精通也能加）→ 新增 `checkHeroicSkillRequirement`；**A2** 只驗骰階總和 → 收斂 `ATTRIBUTE_DICE_TIERS`。B／C 類依裁定不做 | 2026-10-06 |
| AH | 四維預設為空 ＋ 開局英雄技能 | 四維預設 0＝尚未指派（舊預設正好是官方「萬事通」）；開局英雄技能五條件逐條落實。**名額開關位置已於 §AL 推翻** | 2026-10-06 |
| AI | 英雄技能出處回填 ＋ Playtest 43 筆 | **⚠️ 更正 §AH5**：Core 其實有 31 筆（Excel 31:31 完全對齊）；六區段 111 筆 ＋ Playtest 43；新增 `HEROIC_SKILLS` 合併入口 | 2026-10-06 |
| AJ | 逐字比對起步 ＋ 托盤預設空 ＋ 職業彈窗列英雄技能 | 托盤改空陣列；職業彈窗只列名稱、效果放 tooltip；Core 31 筆逐字讀完修 2 筆（`背水` 上限／`阿爾卡納迴響` 漏譯） | 2026-10-06 |
| AK | 英雄技能 4 項缺陷修正 | 可重複取得（`maxAcquisitions`）／同團不得重複／`預言守護者` HP 進引擎／卡牌大師 4 筆（154 → 158） | 2026-10-06 |
| AL | 開卡規則搬到編輯器、存到角色身上 | **使用者指出的設計錯誤**：規則改 `char.creationRules` ＋ `CreationRulesPanel`；名冊頁開關移除 | 2026-10-06 |
| AM | 四維改讀官方規則 ＋ 等級獎勵 ＋ 英雄技能表格選擇器 | `attributeTotal` 移除（官方是三組固定陣列）；順帶修好「20 級升級反而被噴假警告」；新增 p.229 等級獎勵；新增 `HeroicSkillPickerModal` | 2026-10-06 |
| AN | 英雄技能的瀏覽位置定調 | 使用者裁定：第 2 步**移除**常駐那塊（用途是選職業的參考，不是常駐面板）；改放挑職業彈窗的**職業技能下面一顆「顯示英雄技能」按鈕**（預設收合、純瀏覽、選用一律回第 5 步）；**定稿後收掉瀏覽入口**，自己已拿到的效果照常顯示 | 2026-10-06 |
| AO | 職業選擇流程重構 | 使用者說「選職業 → 點技能 → 確認 → 再選職業」很繁瑣 → 草稿改成**跨職業累積**，同一個彈窗點完 2~3 個職業、按一次確定全部寫入。另加「全部」鈕（`defaultSourcebooks` 預設全開，上限仍由 `allowedSourcebooks` 把關）、「已選職業」徽章欄位（點它跳過去）、預算計入既有投入（`budgetUsed`） | 2026-10-06 |
| AS | 【定制武器】（HF p.106） | **做法＝虛擬武器條目**（同 §U 的 DUAL_SHIELD）——引擎／挑選器／匯出不用改就吃下它。規則層 `data/customWeapons.js`；開卡規則 `allowCustomWeapon`（預設 false，不綁 HF）。順帶把 25 筆官方配置從死字串變成真資料。**待辦**：Excel 稀有物品（Core p.268）搬成封面【鍛造台】＋刪命刻記錄分頁 | 2026-10-06 |
| AU | 英雄技能逐字比對：HF／NF／TF／Bonus 共 84 筆 | **對齊不用位置**（書上字母序）——改用**條件裡的職業名**按語意配對。**共修 18 處**；錯誤模式四類：可見性條件被換、前提被刪、數字／倍率、**別條目的措辭被誤植**（最危險）。抽取器修 4 個 bug，其中「刪掉整行數字」會**刪到遊戲數值**（代理發現）。**教訓**：新增程式碼引用既有效果文前，那個效果文必須先核對——我因此兩次把錯誤傳播進 `classResources.js` | 2026-10-13 |
| AT | 手機版佈局：一次由**量測工具**造成的假 bug | 技能名直排是真的（`flex-col sm:flex-row` ＋ `whitespace-nowrap shrink-0`）。但我多報了「彈窗橫向溢出」——**Chrome 視窗最小寬度是 500px**（詳見 §1）。`JRPGModal` 的 `min-w-0` 保留（原理對），但**不是為了一個真實存在的溢出而加的** | 2026-10-13 |
| AP | 職業技能的全面比對 | 140 筆逐條比對，**兩輪共修 41 處**。觸發點：`靈光一閃` 的 ①~⑤ 範例是**憑空寫進去的**（規則書與 Excel 都沒有，`git log -S` 只命中初始建檔）→ 使用者裁定「刪到光」。含 4 筆術語錯（champion＝「冠位」、Hinder/Objective＝「阻礙／推進目標」、dazed＝「眩暈」、`verse`＝「樂句」） | 2026-10-06 |
| AX／AY | `NPCWorkshop.jsx` 拆檔（**先補護欄，再動結構**） | 6,448 → 4,597 行。① 第一批：抽 `utils/displayText.jsx`／8 個元件／`data/workshopThemes.js`，並新增**元件層 SSR 護欄**（`test:npcworkshopui`）② 第二批：`handleCopyFullNpc`（448 行）→ 純函式 `buildNpcText`，並補上**四格式分支**的溢額過濾護欄 ③ 前置：加**測試注入點 props**，讓 8 道建角步驟（約 2,100 行）**首次有 SSR 覆蓋**。**第三階段未完成**：`renderStepContent` 尚未搬、`useState` 未分組、`renderCharacterCard` 未抽 | 2026-10-16 |
| AZ | 職業別稱（官方原書職業頁的「ALSO:」行） | 28 職各 3 個（核心 15＋三手冊 11＋特典 2）；`zh` 才顯示、`zhExtra`（測試版漢化獨有）只搜不顯示；搜尋抽成資料層純函式 `matchesClassQuery`；5 個無漢化譯名者**經 GM 裁定語義補譯**並以 `zhDerived` 逐筆登記來源；新增 `test:aliases`（78 條） | 2026-10-16 |

## 7. 本檔維護

- 本檔由 DSH 維護，**與 `GEMINI.md` 並存不互斥**。
- 若 `GEMINI.md` 新增或修訂規則，本檔僅需同步「DSH 對應實作」章節，**不得改寫 `GEMINI.md` 原文**。
- 每次完成稽核後，更新 §4 基準快照與 §6 索引；細節寫入 `docs/decisions.md`。
- **變更紀錄一律寫入 docs/agents-changelog.md**（見 §8）。
- **本檔有硬性大小上限（65,536 bytes）**。
  ⚠️ **不要在這裡寫死目前的數字**——那句話本身會改變大小，寫幾次就過時幾次（2026-10-15 親身踩到）。
  **要用時自己量**（量測法見下），並**當場判斷**是否該壓縮。
  - **量測法**：`wc -c AGENTS.md`，或 `Buffer.byteLength(fs.readFileSync('AGENTS.md'))`。
    ⚠️ **不可用** `fs.readFileSync(f).length`——那是 **UTF-16 字元數**，只有位元組數的**一半左右**，
    用錯尺會嚴重誤判餘裕。
  - **判準**：餘裕 **低於約 15,000** 就該壓縮（§6.2 是最肥的段落）。
  §6.2 是唯一會無限成長的段落：**新增列只寫結論，過程寫進 `docs/decisions.md`**。
  ⚠️ 2026-10-06 一天內壓了兩次：第一次只壓 §6.2 以外，當天仍長到 57,759 bytes（餘裕只剩 7,777），
  第二次才把 §6.2 的列壓回結論。**動 §6.2 之前先看餘裕**，不要等被截斷才處理（§8 記的就是被截斷那次的教訓）。

### 7.1 寫進哪個檔案？（**判準：這段資訊之後會變嗎？**）

本專案有 6 份文件，過去因為**同一個事實寫在多處**而分岔過至少四次
（`+undefined` 顯示錯誤、金手指來源標記、`characterEngine.js` 四缺陷、handoff 的快照）。
以下判準是 2026-10-15 收斂出來的，**寫東西前先問一句：這段話之後會變嗎？**

| 會變的（狀態、數字、清單、進度） | 不會變的（規則、坑、為什麼） |
|---|---|
| → 一律寫進 **`AGENTS.md`**（§1 環境事實／§4 技術債基準／§6.1 待裁定／§6.2 已結案索引）或 **`docs/decisions.md`** | → 才可以寫進 **`docs/handoff.md`** |
| 這兩份有「守門人」：`AGENTS.md` 會被 harness 注入，每次都被讀到；`decisions.md` 是決策的正本 | handoff **不在任何人的更新動線上**，所以**放會變的東西＝必定腐化** |

> **為什麼要有這條判準**：2026-10-15 發現 handoff 有一節寫「四個缺陷未修、**不要自行開修**」，
> 而它們**9 天前就修完了**。根因不是「忘了更新」，是**放錯內容**——
> 沒有守門人的文件只會單向腐化。**解法不是「記得去更新它」，是「不要把會過時的東西放進去」。**

---

## 8. 變更紀錄

本檔的變更紀錄已於 2026-10-04 拆出至 **`docs/agents-changelog.md`**。

**原因**：本檔曾達 68,142 bytes，**超過 harness 的 workspace instruction 注入預算（65,536 bytes）**，
尾端內容在注入時被截斷——而尾端正是**最新**的變更紀錄，最該被讀到的反而讀不到。

> **教訓：規範文件會被當成指令注入，所以有硬性大小上限。**
> 歷史紀錄不是規範，不該放在規範檔裡把規則擠掉。
> **日後新增變更紀錄一律寫入 `docs/agents-changelog.md`，不要寫回本檔。**

同樣的理由，**§6 的詳細決策紀錄**已於 2026-10-05 拆出至 **`docs/decisions.md`**——
當時 §6 已佔全檔 **54%**（36,342 bytes），把規則本體擠到被截斷的邊緣。
**日後新增決策紀錄一律寫入 `docs/decisions.md`，§6 只留索引。**
