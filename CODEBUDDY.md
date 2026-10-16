# CODEBUDDY.md —《物語手帳》WorkBuddy 入口

> **本檔是 bootstrap，不是規範本體。**
> WorkBuddy 只讀 `CODEBUDDY.md` → `.codebuddy/CODEBUDDY.md` → `AGENTS.md` **三者中第一個存在的**，
> 並且**硬截斷在 8000 字元**。`AGENTS.md` 有約 52 KB，直接餵進去會被砍掉 84%——所以用本檔把新 session 送進正確的檔案。
> **完整順位**：`GEMINI.md`（最高規範，只讀不改）＞ `AGENTS.md`（執行細則）＞ 本檔。

---

## 0. 新 session 開場必做（照順序）

1. 讀 `AGENTS.md` 全文（約 52 KB，規則本體；本檔只是索引與入口）。
2. 讀 `docs/handoff.md`（**踩過的坑、除錯方法、Git 歷史改寫始末**——它刻意不記現況與待辦，那些看 `AGENTS.md` §1 與 §6）。
3. 讀 `docs/decisions.md` 的**近期幾節**（越新越重要：§AW 核心書技能變體、§AR 金手指、§AD 引擎修正）、
   §L（資料層）、§AP／§AU（逐字比對方法論）、§AT（手機版量測陷阱）。
4. 跑 `npm test` 與 `npm run build`，確認基準綠燈再動手。

## 1. 專案事實

| 項目 | 值 |
|---|---|
| 名稱 | 《物語手帳》（套件名 `monogatari-techou`）。原名 FU Companion **已因版權問題廢棄，不得再用於新增的路徑／識別字／對外文件**；既有文件中的「原名」屬歷史敘述 |
| 路徑 | `E:\MINGWAN\Projects\monogatari-techou` |
| repo | https://github.com/Vice1412/monogatari-techou （**公開**） |
| 技術 | Vite 6 + React + Tailwind 3；全站羊皮紙暖色調（`#fbf7ee` / `#3c2415` / `#d6c7ab`），**非**深色石板底 |
| 資料層 | 純 localStorage，但已收斂為單一存取層 `src/data/store.js`；鍵註冊表 `src/data/keys.js`（7 權威鍵，前綴 `monogatari_techou_`；11 個舊鍵只讀不寫，由 `migrateLegacyStorage()` 於啟動時搬移）；房間契約 `shared/schema.js`。**`src/` 內不得直接呼叫 `localStorage`** |
| 指令 | `npm run build`、`npm test`（17 道關卡）、`npm run test:emoji`、`npm run audit:affinity` |

## 2. 硬性關卡（每次改動後必跑，沒過不得宣稱完成）

1. **零 Emoji**：`npm run test:emoji`（掃 `src/` 與 `shared/`）。排版字符 `★ ❖ ✦ ✕ ※ △ ◈ ▽ ▼ ◆ ● ◷ ✎ ✓ ✗ ➔ ①~⑤` **允許**。
   ※ **不要把警示或打勾的表情符號寫進自己的註解**——這個坑已踩過五次（`properNouns.js`、`tinkererProjects.js`、`classResources.js`、`aceOfCardsData.js`、`AceOfCardsTable.jsx`）。
2. **建置**：`npm run build` 必須 exit 0。chunk-size 警告是既有現象，不是新問題。
3. **純中文顯示**：介面標題／步驟標籤一律純中文；**只有**職業／範本／物種可用「中文 · ENGLISH」；禁「中文（English）」括號附註。
4. **圖示三軌**：官方機制字型 `.fu-icon`；敘事槽位（物種／範本／職業／定位／資源／裝備類別／屬性／反派階級／區塊標題／徽章／空狀態）一律 `react-icons/gi`；功能性控件（返回／關閉／搜尋／新增／折疊／排序／篩選／複製／刪除）可用 `lucide-react` 或純排版字符。禁彩色 emoji。
5. **九相屬性內聯**：一律走 `renderTextWithAffinities`；判定在 `src/components/ui/affinityText.js`，原則**寧漏不誤**。新增例外詞要改**判定規則**並補 `test:affinity` 的誤標表，不要只往黑名單加詞。
6. **效果文本必須先核對官方原書**（見 §4），嚴禁憑記憶編造等級階級、檢定或數值。

## 3. 事實唯一基準

一律以**當前工作區實際源碼**為準。**嚴禁**引用 `PROJECT_CHANGELOG.md`、舊 session 草稿或任何歷史報告作為現況結論（該檔三處「零 Emoji 合規」宣稱與實測嚴重不符）。
`PROJECT_SPEC.md` 已標記為**過時歷史文件**，只代表專案意圖，不是現況。

## 4. 官方原書與譯名（都在專案目錄之外）

| 書 | 路徑 | PDF 頁碼偏移 |
|---|---|---|
| 核心規則書 v1.1（機制最高權威） | `E:\MINGWAN\TRPG\Fabula ultima\最終幻想1.1\Fabula_Ultima_TTJRPG_Need_Games,_Rooster_Games_Fabula_Ultima_Core.pdf` | **PDF = 印刷 + 2** |
| 高度／自然／科技奇幻手冊 | 同目錄 `..._High_Fantasy_Atlas.pdf`、`..._Natural_Fantasy_Atlas.pdf`、`..._Techno_Fantasy_Atlas.pdf` | +2 |
| 官方特典合輯 | 同目錄 `Fabula_Ultima_TTJRPG_Bonus_Collection.pdf` | **0（無偏移）** |
| 怪物圖鑑 Vol.1 | `E:\MINGWAN\TRPG\Fabula ultima\Fabula Ultima Bestiary Vol. 1 KS_preview.pdf` | — |
| 民間漢化（**只管譯名，不管機制**） | `E:\MINGWAN\TRPG\Fabula ultima\DLC\《Fabula Ultima最终物语》全扩展不全书V1.0(1)\`（26 個 HTML） | — |
| 繁中角色卡 Excel（三大手冊＋特典的譯名權威） | `E:\MINGWAN\TRPG\Fabula ultima\最终物语_自动角色卡_核心+扩展_正式版25_10_14.xlsx` | — |

- 抽 PDF：`pypdf` 已安裝；**`read` 工具讀不了 PDF**，`pdftotext` 未裝。抽取腳本 `scratch/pdf_text.py`（`scratch/` 不在版控，重建即可）。
- ※ 頁碼偏移**因書而異**，引用頁碼前先確認該書的偏移，不要沿用上一本的。
- 衝突時**官方英文優先**；譯名決定「中文怎麼寫」，官方英文決定「規則是什麼」，兩者職責不可互換。
- **「職業」定譯鐵律**：Martial 系列一律譯「職業」（職業近戰武器／職業遠距武器／職業防具／職業盾牌），**嚴禁「軍用」**。
- ※ 漢化是**測試版**且是「不全書」：查不到譯名**不等於官方沒有**，只能標記為「漢化未收錄」。

## 5. 專案內資源

| 路徑 | 內容 | 版控狀態 |
|---|---|---|
| `resources/角色卡/` | 官方原書節錄 54 PDF ＋ 漢化 26 MD／25 HTML（106 檔 / 92 MB） | **不在版控**（`.gitignore`），但**仍在 git 歷史層**，repo 公開 |
| `scratch/` | 抽取腳本、量測頁、舊 bundle、`pre-purge-backup.git` | **不在版控**；測試**嚴禁**放這裡（會與源碼脫鉤） |
| `tests/` | 17 道測試關卡源碼（bundle 輸出至 `.test-build/`） | 在版控 |
| `docs/` | `decisions.md`（決策本體）、`agents-changelog.md`（變更紀錄）、`handoff.md`、`room-sync-plan.md`、`skill-coverage.md` | 在版控 |

## 6. 文件分工

> **完整判準（含「這段資訊之後會變嗎？」的決策樹）在 `AGENTS.md` §7.1——這裡只留速查，避免兩份分岔。**

| 想寫什麼 | 寫到哪 |
|---|---|
| 規範、規則、環境事實、技術債基準 | `AGENTS.md`（會被注入，**硬上限 65,536 bytes**） |
| 「為什麼這樣決定」的完整紀錄 | `docs/decisions.md` |
| 變更紀錄 | `docs/agents-changelog.md` |
| **不會變的坑、除錯方法、歷史脈絡** | `docs/handoff.md`（**其餘一律不要放這裡**，見 §7.1） |
| 最高規範 | `GEMINI.md`（**只讀，不得改寫原文**） |

`AGENTS.md` 曾在 68 KB 時被 harness 截斷，而截掉的正是最新的變更紀錄——所以細節一律往外放，`AGENTS.md` 只留索引。

## 7. 其他已知陷阱

- `chrome --headless --window-size=390` 的**實際視窗是 500px**（Chromium 最小寬度）——「手機版橫向溢出」常是截圖工具的假象。要驗真手機寬度得用 iframe（`scratch/mobile_viewport.html`）。
- `resources/` 已移出版控但**仍在歷史層**；查「公開 repo 有沒有不該公開的檔案」要三層都查：`git ls-files`（索引）、`git check-ignore -v`（忽略規則）、`git rev-list --objects --all`（歷史層）。
- 未裁定事項見 `AGENTS.md` §6.1；**未裁定前不要自行開修**。
  ※ 曾以此處的「`characterEngine.js` 四個已知缺陷」為例——**那四個已於 2026-10-06 §AD 全部修完**，
  不要再拿它當待辦（這是「舉例本身會過時」的教訓）。
- 未結案的既有工作：連線房間同步（`docs/room-sync-plan.md`，**待裁定**；前置階段 0 已完成）、
  英雄技能的 Playtest 修訂項（約 20 筆，見 `AGENTS.md` §6.1）。

## 8. 我的資源地圖與報告慣例

跨專案／TRPG 素材路徑清單與報告產出慣例在**工作區外**的兩個 skill：

- `~/.workbuddy-ai/skills/yg-resource-map/SKILL.md`（＋同目錄 `RESOURCE_PATHS.md`）——全機路徑地圖
- `~/.workbuddy-ai/skills/yg-report-workflow/SKILL.md`——報告規格與輸出位置

需要專案原始碼以外的素材，或要產出報告時，先載入對應 skill。
