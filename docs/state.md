# 狀態快照（會變的數字與歷史）

> **這份文件的角色**：`AGENTS.md` 只放**不會變的規則**。凡是「跑一次就會變」的數字、
> 「做完就固定」的歷史清單、以及「下次稽核要重測」的基準，全部放這裡。
>
> **為什麼**：`AGENTS.md` 會被 harness 當成指令注入，有 **65,536 bytes 硬上限**（超出即截斷）。
> 把會變的東西放進去，等於每隔幾輪就要「壓縮」一次，而壓縮刪掉的是「為什麼」。
> 這個檔案沒有預算上限，可以誠實地留著所有數字。
>
> **本檔的數字隨時可能過時。** 引用前先自己量一次（量測法見 `AGENTS.md` §7）。
> 依 `GEMINI.md` 規則六，**一律以當前源碼實測為準**，本檔只是「上一次量到的樣子」。

---

## 1. Emoji 殘留（規則一軌道 3）

以**修正版正則**實測（`src/` 程式碼檔 75 個——`.js`/`.jsx`/`.json`/`.css`——共 38,619 行）：

| 時點 | 行（檔案:行） | 次 | 說明 |
|---|---|---|---|
| 2026-10-03 | 149 | 282 | 修正版正則首次套用（哨兵遷移**前**） |
| 2026-10-04 | 76 | 145 | 階段 1 哨兵遷移後 |
| 2026-10-04 | **0** | **0** | ✅ **階段 2 完成後** |

> ✅ **零 Emoji 鐵律首次真正達成**。`GEMINI.md` 規則五.1 的檢測正則現在能真正通過——
> 有別於 `PROJECT_CHANGELOG.md` 那三次與實測嚴重不符的「宣稱通過」。
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

---

## 2. 圖示庫分佈（規則一軌道 2）

清查方法：`scripts/audit_lucide_usage.py`（只計 JSX 使用點，不計匯入本身）。

| 時點 | lucide 檔 | gi 檔 | 同時使用 | lucide 使用點 |
|---|---|---|---|---|
| 2026-10-03（原始基準） | 26 | 37 | 18 | 243 |
| 2026-10-04（階段 3 完成後） | **26** | **42** | **23** | 敘事槽位 52 點已改 gi |

> ✅ **階段 3 已於 2026-10-04 完成**（commit `37939bf`，2026-10-05 歷史改寫前的舊編號為 `ce85f55`）：52 個誤用於敘事槽位者改為 gi。
> lucide 檔案數**不變**是正確結果——本階段不動功能性控件，只把敘事槽位換掉；
> gi 檔數上升 5 檔（`NPCCardPreview`／`NPCLibrary`／`CombatTracker`／`AddCombatantModal`／`CombatantCard` 由「純 lucide」轉為混用）。
>
> **離群診斷**：`character-sheet` 系列本來就全面使用 gi（`GiHealthNormal`／`GiLightningTear`／`GiSparkles`／`GiPocketWatch`／`GiCrossedSwords`），
> 誤用集中於 `npc-workshop` 與 `combat-tracker`——即歷史上由不同批次實作、未經同一次圖示稽核的兩個模組。

---

## 3. 純中文清除紀錄（規則三）

**使用者裁定「專有名詞例外」後**，規則三改為三段式（已寫入 `GEMINI.md`）：
**介面標題／步驟標籤一律純中文**；**職業／範本／物種用「中文 · ENGLISH」**；其餘照舊。
⚠️ **2026-10-22 收窄（§BR1）**：NPC 工坊的**物種與定位**已改回純中文——該模組不再適用
「`中文 · ENGLISH`」這一段。職業／範本與其他模組不受影響。

### 已清除（面向使用者的英文標籤）

- `CharacterEditor.jsx` 六步驟的 `en` 欄位（`IDENTITY`／`ATTRIBUTES`／`CLASSES`／`EQUIPMENT`／`BONDS`／`HEROIC & CLOCKS`）與其渲染點 `{t.en}`
- `NPCWorkshop.jsx` 複製文本的 `(BASIC ATTACKS & ACTIONS)`／`(BASIC ATTACKS)`／`(SPELLS)`
- `NPCBuilder.jsx` 兩處步驟標題 `(Level & Rank)`／`(Boss & Negative Skills)`
- `CombatTracker.jsx` `(Enemies & Bosses)`
- `TinkererWorkshop.jsx` 三個公式標籤 `(Base Potency)`／`(Area Multiplier)`／`(Uses Multiplier)`
- `WayfarerCompanionModal.jsx` `（Species）`
- `BookCoverHub.jsx` `'CLICK TO OPEN'` → `'點擊翻開'`
- `ChimeristManager.jsx` 三個物種選項 `野獸 (Beast)` → `野獸 · BEAST`
- **2026-10-06 追加**：`IdentityTablesModal.jsx` 的 `中文 (English)` 括號附註（6 處）與列表的英文行（3 處）——身份核心概念／形容特質／身世細節**不屬**職業／範本／物種，沒有「`中文 · ENGLISH`」的例外。**英文保留在搜尋比對**（`filterList` 仍比對 `item.en`）：那是檢索，不是顯示。同輪另把彈窗的四個屬性名收斂為 `ATTRIBUTE_NAMES`。

### 經裁定保留（判準在 `AGENTS.md` §4）

- ~~`SPECIES_THEMES` 的八個物種英文標籤（`'BEAST'`…`'UNDEAD'`）~~ —— ✅ **2026-10-22 例外失效**
  （使用者裁定，見 `docs/decisions.md` §BR1）：NPC 工坊的物種瓷磚、選定物種標題、定位名稱、
  卡片預覽與四種匯出文本**一律只顯示中文**；`label` 欄位降為**純搜尋比對**用途。
  ※ 原裁定理由（「物種屬專有名詞，瓷磚本即中英並列」）已被推翻；英文名仍經原書 Core p.302
  核對過，只是不再顯示。**其餘模組（角色卡、戰鬥追蹤器、奇美拉管理者）不受影響。**

### 已結案（原本列在「仍待處理」）

- ~~`BookCoverHub.jsx:104` 的 `FU COMPANION 《物語助手》`~~ —— ✅ **2026-10-05 已改為《物語手帳》**（見 `docs/decisions.md` §K8）
- ~~`rulesData.json` 的 `秘儀師【Playtest】` 等英文標籤~~ —— ✅ **2026-10-19 已消滅**：6 個【Playtest】職業刪除（`docs/decisions.md` §BE）＋ 唯一保留者改名為「秘儀師【變體】」（§BF）後，`rulesData.classes` 的鍵與 `name` 已無任何拉丁字母

---

## 4. 建置與測試

- `npm run build` 通過（exit 0，2026-10-06 實測 9.77 秒）。
- JS bundle 2,252 kB / gzip 651 kB，觸發 Vite chunk-size 警告（>500 kB）。
  建議未來以 `manualChunks` 或 `import()` 拆分，但**非當前規範要求**。
- `npm test` 通過（**25 道關卡全過**，exit 0）。

### 測試關卡清單

> ⚠️ 這份清單會腐化。**權威來源是 `package.json` 的 `test` 串鏈**，
> 各關卡的斷言數請看該關卡自己的輸出。

已補上測試的模組：造物專案成本與每日推進（`test:projects`）、職業資源池（`test:resources`）、
美食家食材／食譜書（`test:gourmet`）、專有名詞對照（`test:propernouns`）、
哨兵遷移（`test:sentinel`）、零 Emoji（`test:emoji`）、卡牌大師牌組（`test:cards`）、
**角色卡數值引擎（`test:engine`，2026-10-04 補上）**、**資料層與房間契約（`test:datalayer`）**、
**官方經典職業搭配 81 組（`test:presets`，2026-10-05 補上）**、
**九相屬性標記（`test:affinity`，2026-10-05 補上）**、
**裝備配置（`test:equipment`，2026-10-05 補上，見 `docs/decisions.md` §U）**、
**開卡規則（`test:creation`，2026-10-05 補上，見 `docs/decisions.md` §V、§X）**、
**成長履歷（`test:log`，2026-10-05 補上，見 `docs/decisions.md` §W）**、
**角色卡介面契約（`test:ui`，2026-10-05 補上，見 `docs/decisions.md` §Y、§Z）**、
**創角步驟次序與開卡規則稽核（`test:creation` O 區段 ＋ `test:ui` M 區段，2026-10-06 補上，見 `docs/decisions.md` §AE）**、
**秘儀師阿爾卡納（`test:arcanist`，2026-10-20 補上，見 `docs/decisions.md` §BH）**、
**NPC 攻擊欄位解析（`test:npcattack`，2026-10-22 補上，42 條：解析優先序／舊存檔自癒／存檔前
unfreeze／原始碼守門／SSR 真渲染，見 `docs/decisions.md` §BR）**、
**建角草稿與第 4 步介面深度（`test:npcworkshopui` F／G 段，2026-10-22 補上：草稿讀回 18 條
＋「不點就看得到」5 條，見 `docs/decisions.md` §BS4、§BT4）**。

**剩餘覆蓋缺口**：戰鬥輪次狀態機、Fultimator 匯入匯出。

> ✅ **角色卡數值引擎的缺口已於 2026-10-04 補上**（`test:engine`；2026-10-05 擴充至 **322 項**
> ＝ 243 項基礎向量 ＋ 79 項數值構成公式與免費增益二選一，見 `docs/decisions.md` §N）。
> 官方 Camilla 向量已 1:1 還原（原書 p.163–164：等級 5、Might d6、Willpower d8
> → HP 40／MP 50／危機 20／IP 6／DEF 8／M.DEF 10）。
> 並確立兩條不變式：**HP/MP 用基礎骰**、**DEF/M.DEF 用當前骰**（狀態減值只影響後者）。
> 該次同時以測試記錄了四個**既有缺陷**，見 `docs/decisions.md` §L4。

---

## 5. 九相屬性標記基準（規則七）

**判定規則本體在 `AGENTS.md` §4 F，數字在這裡。**

**現況基準**（`npm run audit:affinity` 實測，13 個資料模組 / 8,779 個字串欄位）：

| 項目 | 值 |
|---|---|
| 正確標記 | **1,030 處**（suffix 379／list 337／standalone 160／damage-tail 70／bracket 64／numbered 12／copula 8） |
| 修正前的誤標 | **317 處**（124 種情境；舊黑名單正則共命中 1,347 處） |

- **護欄**：`npm run test:affinity`（`tests/affinityText.test.mjs`，176 項）——
  誤標表 117 條、正標表 29 條、資料層掃描（誤標詞放回語料零命中）、
  速查手冊現場逐格驗證、**渲染器同步**（`FUIcon.jsx` 不得再出現舊黑名單正則或內嵌 `const regex`）。
- 完整背景與逐條清單見 `docs/decisions.md` §Q。

---

## 6. 未決事項完整清單（含已結案歷史）

> `AGENTS.md` §6.1 只留「還沒做完的事」一行式清單；**背景、實測依據、已結案的來龍去脈都在這裡**。
> 結案時：把該列從 `AGENTS.md` §6.1 刪掉，完整敘述留在本節。

| 項目 | 內容 | 狀態 |
|---|---|---|
| ~~金手指來源標記~~ | ✅ **已由 §AR4 裁定結案**：使用者裁定「檢查重複，有重複就不列出處」——實測**有重複**（FLIGHT／CURSED 橫跨高低＋自然；ROBOT 橫跨高低＋科技），故**介面不列出處**，`（高奇）`等名稱標記與 `filterQuirksBySources` 一併移除（§AR5，55→46 筆）。**唯一殘留**：§AR7 的「金手指效果逐筆核對」待辦（見下列） | ✅ 已結案 |
| ~~本機路徑搬遷~~ | ✅ **已完成**：`AGENTS.md:25` 已是 `E:\MINGWAN\Projects\monogatari-techou` | ✅ 已結案 |
| 金手指效果逐筆核對 | §AR7 待辦：三大擴展 HF 15／NF 10／TF 10（＋特典 Halloween）**逐筆效果比對尚未做**（抽取工具 `scratch/extract_en_quirks.py` 已備）。另：特典 Halloween 系列曾被誤標「（科奇）」，實際來自特典合輯 | 待排程 |
| Bonus Collection 其餘 7 項 | ~~New Heroic Skills~~ ✅ 2026-10-06 已收錄（卡牌大師 4 筆，見 §AK4）；**Halloween 系列／Arcane Whispers／三隻 Additional Bosses** 仍待裁定優先序（Halloween 的**範例角色 8 組**已於 `expansionPresets.js` 收錄，此處指其餘內容） | 待裁定 |
| ~~先攻變體是否套用~~ | ✅ **2026-10-21 已實裝（§BL）**：改成整團開關 `creationRules.initiativeVariant`（預設 `false`＝與核心逐字相同）。開啟後：防具先攻減值不存在、戰鬥輕甲改物防 +2／魔防 +0、先攻值不存在（顯示「不計」）、影響先攻的效果**忽略而非替換**。判定收斂在 `data/initiativeVariant.js`，`test:initiative` 95 條釘住。**NPC 端刻意未接線**（NPC 工坊沒有開卡規則面板，見 §BL5） | ✅ 已結案 |
| ~~GitHub repo 改名~~ | **實測 `git remote -v` 已是 `https://github.com/Vice1412/monogatari-techou.git`——改名早已完成。**（2026-10-05 複驗更正） | ✅ 已結案 |
| 英雄技能「效果文字」逐筆核對 | ✅ **115 筆全部完成**（Core 31 ＋ HF 24 ＋ NF 21 ＋ TF 18 ＋ Bonus 21，共修 20 處；見 §AJ3、§AU）。**待辦**：Playtest changelog 明列約 20 個**修訂既有技能**的項目尚未套用 | 待排程 |
| Playtest 其餘選用規則 | 同文件還有前後排、Applause Points、Surrender、休息場景、電影式造物計畫等選用規則；本專案目前只實裝「開局英雄技能」與「高階角色起始資金」（實測 `DEFAULT_CREATION_RULES` 無相關欄位）。**另**：高度奇幻手冊的底力技（p.124–131）已於 2026-10-21 實裝，見 §BM——它**不屬** Playtest | 待裁定 |
| D5 金手指選項 | 金手指「倖存者」的第三個選項「**IP 永久 +2**」未實作；「墮落天使」選項③「**最大 MP +10**」未實作（自然 p.129／科技 p.129／特典 p.18）。**結構性原因**：金手指目前只有「名稱比對」（`characterEngine.js` 的 `quirkName.includes(...)`），**無法承載「選項」** | 待裁定 |
| D6 官方飾品「洋蔥戒指」 | Core p.289：每個**不同職業**使最大 HP 與 MP 各 +2。**實測不在** `rulesData.equipment.accessories`（現僅 6 筆）→ 玩家無法選用 | 待裁定 |
| ~~D7 暗黑之刃【Playtest】遠程~~ | ✅ **已隨 BC1 結案**：該職業已於 2026-10-19 刪除（無官方對應），此缺陷不再存在。核心職業「暗黑之刃」的免費增益是「HP +5，職業近戰/防具」，沒有二選一歧義 | ✅ 已結案 |
| ~~BC1~~ 6 個【Playtest】職業無官方對應 | ✅ **2026-10-19 已依使用者裁定結案**：覆核最新修訂文件（Playtest Materials ENG **2026-10-01**，45 頁）——整份只有 p.24「ARCANIST (variant)」一個職業級變體；守護者／武器大師／博學士／暗黑之刃／神射手／吟唱者**只作為英雄技能的前提被提到**（那是核心職業本身），沒有任何職業資料。**已刪除這 6 個職業**（`SOURCEBOOKS.playtest.classes`、`CLASS_METADATA`、`rulesData.classes`）。唯一保留的變體職業已於 **§BF** 改名為「秘儀師【變體】」並整份對齊原文；兩個 SL 上限（幻影之力 5、快速召喚 4）已於 §BC 修正，與 PDF 一致 | ✅ 已結案 |
| ~~NPC 工坊重複函式~~ | `NPCWorkshop.jsx` 與 `utils/npcEngine.js` 之間有三組**同名函式**：`getInitialAffinities`（邏輯相同，可安全收斂）、**`migrateNpcState`（48 vs 18 行）**、**`getSpeciesAffinities`（66 vs 70 行）**——後兩者**行為不同**，且測試只覆蓋 `npcEngine.js` 那份、**生產端元件用的是另一份**（與 §AW「測試與生產分歧」同型）。**需裁定以哪份為準**（涉及既有 NPC 資料的遷移與相性計算）。詳見 `docs/decisions.md` §AX／§AY 。**2026-10-22 已裁定，見 `docs/decisions.md` §BQ**：三組一律以 `utils/npcEngine.js` 為唯一實作、兩份取聯集；合併時發現引擎那份的 `getSpeciesAffinities` 要求一個**不存在的 key**（`sp_undead_abs_choice`），導致「不死 b1：免疫換吸收」從來沒生效——而錯的那份正是角色卡預覽與入戰在用的。護欄：`scripts/gm/stage11-probe.mjs`（15 條）＋ `stage10` B 段 | ✅ 已結案 |

## 7. NPC 工坊 GM 實測（2026-10-22 完成）

以「新手 GM 開一張卡」的視角，把 NPC 工坊的八道建角步驟、預覽輸出、檔案庫、邊界韌性逐段實測，
分 11 個階段進行，逐段留紀錄。**正本：[`docs/npc-workshop-gm-test.md`](npc-workshop-gm-test.md)**（階段計畫、67 筆缺陷登記、每階段實測依據與裁定）。

- **規模**：11 個階段、67 筆缺陷（S1 四筆、其餘 S2–S4），標籤為「找不到／看不懂／不敢動／不知成功／救不回」。
- **修復節奏**：會污染後續量測基準的缺陷集中到最後一階段修（阻塞池），其餘「下一階段開頭直接解決」。
- **護欄**：`scripts/gm/stage0.mjs`～`stage10.mjs`（逐階段關卡）＋ `scripts/gm/stage11-probe.mjs`（修復批次探測）。
  ⚠️ 這些是**手動工具**，刻意**不**串進 `npm test`（要跑真的瀏覽器與 dev server）；用法見各檔檔頭。
- **修復批次的三個結論**（詳見 `docs/decisions.md` §BQ）：
  1. 三組重複函式收斂為引擎單一實作，並在合併時抓到一個**從未生效的規則**（不死 b1 的免疫換吸收）。
  2. 「認不得的定位」不再被無聲改寫，改成「數值借基準值＋字串原樣保留＋畫面明說」。
  3. 增益卡補上鍵盤可達性（原本整區 Tab 直接跳過）。
- **回歸**：`npm run test:emoji`／`npm run build`／`npm test` 全 `exit 0`；`stage0`～`stage10` 全綠。

### 7.1 全功能稽核（2026-10-22 完成，90 項）

上述 GM 實測是「新手 GM 走一遍」的**敘事視角**；本節是**逐條功能的存在性與連動**驗證，兩者互補。

- **工具**：`scripts/audit-npc-workshop.mjs`（手動，需本機 Chrome ＋ `npm run dev`；**刻意不進 `npm test`**，用法與六個量測陷阱見 `docs/handoff.md` §2.5）。
- **規模**：13 組、90 項檢查（進入與空狀態／八步內容與導覽／定位・等級・階級・物種・反派・相性／技能・咒語・自訂能力・額度 HUD／Boss 與負面技能／稱呼・特質・故事・頭像裁切・戰術／存檔／預覽（揭露 7+・10+・13+・完整、六種卡片風格、四種複製格式、JPG 匯出、複製圖片）／嚴謹↔自由模式／檔案庫搜尋・篩選・排序・單張匯出・備份・匯入・入戰・刪除／跨章節整合）。
- **結果**：90/90 通過，`exit 0`，執行期例外 0、`console.error` 0。
- **有效性驗證**（依 `docs/handoff.md` §2.3 的鐵律）：刻意把搜尋篩選改成 no-op、把 Discord 格式回傳值改成空字串 → 精準 FAIL 在對應 4 項、其餘 79 項仍綠；還原後 83/83 全綠。
- **2026-10-22 第二輪（83 → 90）**：新增第 4 步「不點就看得到」4 條、手風琴預設展開 1 條、
  草稿寫入與佔位符 2 條、子頁切回 1 條（舊的「咒語與自訂能力可展開」改指向同頁的
  「完全自訂技能」）。**這一輪抓到兩條真退化**：G3 的「反派等級可選」「相性可點選」依賴
  「第 4 步預設停在數值頁」這個舊行為（見 `docs/decisions.md` §BT4）。

### 7.2 建角草稿端到端稽核（2026-10-22，9 項）

- **工具**：`scripts/audit-npc-draft.mjs`（手動，同樣**不進 `npm test`**；用法與兩個新陷阱見 `docs/handoff.md` §2.6）。
- **為什麼獨立一支**：`test:npcworkshopui` F 段守「讀回」但用假後端；§7.1 的稽核守「寫入」但**刻意不 reload**。
  「真 localStorage 寫入 → 真 reload → 接回第 3 步 → 提示條兩顆按鈕」這段兩邊都沒踩到。
- **規模**：4 組 9 項（自動暫存與 `step` 記錄／reload 自動接回建角頁且停在第 3 步／
  從檔案庫離開顯示提示條／「繼續編輯」與「丟棄」真的生效，含草稿鍵確實被刪）。
- **結果**：9/9 通過，`exit 0`。
- **附帶確認**：這一輪**沒有發現 NPC 工坊的實際缺陷**——所有 FAIL 都是稽核腳本自身的量測問題（viewport、切換語意、同名元素、reload 清墊片、lazy chunk、開發中提醒）。
