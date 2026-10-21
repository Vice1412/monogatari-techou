# 規則核對手冊（官方原書抽取 ＋ 民間漢化位置）

> **這份文件的角色**：`AGENTS.md` 只留一句「做規則核對前先讀本檔」。
> 本檔放的是**操作手冊**——「要去哪裡拿資料、怎麼抽、頁碼怎麼算」。
> 它不需要在每一次任務都被讀到，所以不該佔用 `AGENTS.md` 的注入預算。
>
> 觸發條件（`AGENTS.md` §1.1）：**任何涉及《FU》專有機制、等級階級、檢定、數值、
> 或職業／技能／裝備譯名的實作**，動手前先讀完本檔。

---

## 1. 官方原書（機制最高權威）

**位置**：專案目錄之外，`E:\MINGWAN\TRPG\Fabula ultima\`（本機路徑，不寫進 repo）。

| 書 | 檔名 | 頁數 | 用途 |
|---|---|---|---|
| 核心規則書 v1.1 | `最終幻想1.1\Fabula_Ultima_TTJRPG_Need_Games,_Rooster_Games_Fabula_Ultima_Core.pdf` | 362 | 機制最高權威 |
| 高度奇幻手冊 | `最終幻想1.1\..._High_Fantasy_Atlas.pdf` | 202 | 拓展職業 |
| 自然奇幻手冊 | `最終幻想1.1\..._Natural_Fantasy_Atlas.pdf` | 210 | 拓展職業 |
| 科技奇幻手冊 | `最終幻想1.1\..._Techno_Fantasy_Atlas.pdf` | 218 | 拓展職業 |
| 怪物圖鑑 Vol.1 | `Fabula Ultima Bestiary Vol. 1 KS_preview.pdf` | 366 | **NPC 定位（職業）來源** |
| 官方特典合輯 | `最終幻想1.1\Fabula_Ultima_TTJRPG_Bonus_Collection.pdf` | 48 | 兩筆 bonus 職業＋其餘特典內容 |

### 工具狀態

- ⚠️ `read` 工具**無法**直讀 PDF；`pdftotext` / `pdftk` **皆未安裝**。
- ✅ **`pypdf` 已安裝**（DSH bundled Python）。
  - 🚨 **2026-10-04 實測發現：本行原先記載的「已安裝」是假的**——`import pypdf` 直接
    `ModuleNotFoundError`，意即 `GEMINI.md` 規則二.4「實作前必須先讀官方原書」
    在該日之前**根本無法執行**。此為「環境事實」被實證推翻的一例。
  - 已以 `python -m pip install pypdf` 補上。**日後新增此類環境事實，必須在同一輪實跑驗證指令**：
    `& $py -c "import pypdf; print(pypdf.__version__)"`
  - `fontTools` 狀態未複驗（文字抽取不需要它）。

### 抽取工具

`scratch/pdf_text.py`（`scratch/` 不在版控內，重建即可）。
用法：`python scratch/pdf_text.py <pdf> <起始頁> <結束頁>`，或 `--search "關鍵字" [前後頁數]`。

```powershell
# DSH bundled Python（路徑隨環境而異；以 $env:DSH_* 或 harness 回報的 python 路徑取代）
$py = "<DSH bundled python>\python.exe"
$pdf = "<原書所在目錄>\最終幻想1.1\Fabula_Ultima_TTJRPG_Need_Games,_Rooster_Games_Fabula_Ultima_Core.pdf"
& $py "scratch\pdf_text.py" $pdf <起始頁> <結束頁>
```

> ⚠️ 本檔為**公開 repo** 的內容。實際路徑請由環境自行取得，**不要把使用者名稱寫回任何文件**。

### 頁碼偏移（**不可套用單一規則**，2026-10-04 實測）

| 書 | 偏移 | 實測 |
|---|---|---|
| 核心規則書 | **PDF = 印刷 + 2** | 印刷 p.134 → PDF p.136 |
| 高度／自然／科技奇幻手冊 | **+2** | 印刷 p.159 → PDF p.161 |
| **官方特典合輯** | **0（無偏移）** | 印刷 p.7 → PDF p.7 |

> 引用頁碼前**務必先確認該書的偏移**，不要沿用上一本的。

> ⚠️ **封面頁文字層有重複行**（該頁採 faux-bold 疊印）；其餘內文頁抽取乾淨，
> 表格數值可直接用於機制核對。

---

## 2. 民間漢化內容（譯名權威）

**用途**：**只管譯名，不管機制**。機制一律以英文原書為準（見 §1）。

### 內容位置：**repo 內就有**（不必解 CHM）

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

### 抽取指令（僅在需要重新抽取時）

```powershell
# 用 lxml 把 DLC 資料夾的 26 個 HTML 抽成純文字
# 輸出到 scratch/chm_content/（gitignored）——repo 內已有更好的 .md 版本，通常不需要跑
& $py "scratch\extract_chm_html.py"
```

> ⚠️ **譯名衝突未解**：`README.md` 的「正式中文名」欄位與 CHM 舊譯名**不一致**（7 個職業）。
> 本專案目前採用 **CHM 舊譯名**（依使用者裁定）。詳見 `docs/decisions.md` §H。

> ⚠️ **本檔為「不全書」**：缺漏的內容**不代表官方沒有**，只代表這份漢化沒收錄。
> 查不到譯名時**不得反推為「官方無此內容」**，只能標記為「CHM 未收錄」。

### 已知譯名對照（取自檔名與內容）

| 英文 | 漢化 | 本專案 | 狀態 |
|---|---|---|---|
| Quirk | **金手指** | 金手指 | ✅ 相符 |
| High Fantasy | **高度奇幻** | 高度奇幻 | ✅ 已於 2026-10-04 修正 |
| Natural Fantasy | 自然奇幻 | 自然奇幻 | ✅ |
| Techno Fantasy | 科技奇幻 | 科技奇幻 | ✅ |
| Custom Weapon | 自定義武器 | **定制武器** | ✅ 2026-10-06 使用者裁定（見 `docs/decisions.md` §AS） |
| Zero Power | 底力技 | （未收錄） | 出處＝**高度奇幻手冊** p.124–131，非官方特典；定譯與 CHM 比對見 `docs/zero-powers-hf.md` |
| Technospheres | 魔晶石 | 魔晶石 | ✅ 2026-10-21 已實裝（選用規則，見 `docs/decisions.md` §BO） |
| Camp Activities | 營地活動 | 營地活動 | ✅ |
| Heroic Skills | 英雄技能 | 英雄技能 | ✅ |

---

## 3. 譯名權威分工（2026-10-05 修訂，見 `docs/decisions.md` §M2）

**只管譯名，不管機制**——譯名決定「中文怎麼寫」，**官方英文正式版**決定「規則是什麼」，
兩者職責不可互換。

- **核心手冊**（阿爾卡納／儀式／小工具／造物／忠實夥伴／咒語）→ 官方核心規則漢化 PDF
- **三大奇幻手冊與特典**（10 個職業子系統）→ 繁中版角色卡 Excel V2.17
- ⚠️ **CHM 是測試版**：凡機制與 CHM 衝突者一律以英文正式版為準。

**「職業」定譯鐵律**：Martial 系列一律譯「職業」（職業近戰武器／職業遠程武器／職業防具／職業盾牌），**嚴禁「軍用」**。
