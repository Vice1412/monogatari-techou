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
- `npm test` 通過（關卡清單與數量一律以 `package.json` 的 `test` 串鏈為準，`exit 0`）。
- **要報「總共幾條斷言」時，只能把每一關的「通過 X / Y」總計行相加**——
  不可以把逐條 `PASS` 也加進去（2026-10 曾因此把 5180 誤報成 5230）。
  會印總計行的關卡有 **30 支**；`test:emoji` 是掃描器，只回報「命中 0 行」，把它算進去會得到 31（錯的）。
- **新增測試關卡時，`test` 串鏈要一起加**，否則那個檔案永遠不會被跑到。

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
＋「不點就看得到」5 條，見 `docs/decisions.md` §BS4、§BT4）**、
**魔晶石（`test:technospheres`，477 條：五模式／插槽品級／15 職業魔石／36 附魔魔石 d66／
凝聚與逐筆效果／驗證器／珠子等級環與珠色／SSR 真渲染／裝備白名單的變體邊界／
修補匠魔導科技的兩檔改寫（含 18 條 SSR 真渲染）／職業魔石拆兩步的成長與裝載分界
（28 條）／開局自動配發與技能表職業樣式（15 條）／升級的兩個出口（12 條）／
升級的第二條路「第一次拿到某個職業」（17 條）／
高階角色的額外起始魔石（28 條：逐顆等級真值、SSR 空珠座數量、起始等級 vs 角色等級）／
【雙重盾牌】在裝備層失效（10 條：X 區段，含 `mnemospheresOnly` 必須仍有效），
各輪皆有刻意破壞驗證，
見 `docs/decisions.md` §BO、§BW、§BX、§BY、§BZ、§CA、§CB、§CC、§CD、§CE、§CF）**、
**營地活動（`test:campactivities`，127 條：15 種活動與目標／CHM 五處數字落差的逐條核對／
開卡規則開關只認真布林／舊存檔正規化（陣列形態、去重、used ⊆ picked、不依上限截斷）／
上限 2 與金手指【老大哥／歐尼醬】的 3 種與「團隊沒開仍可用」／純函式選取與休息回充／
第 5 步驗證（規則關閉時零訊息、只進 warning 不擋存檔）／編輯器與跑團面板的門禁原始碼正則／
SSR 雙模式真渲染／紙卡匯出，刻意破壞驗證紅 6 條，
見 `docs/decisions.md` §CH）**、
**介面設計系統（`test:uisystem`，2026-10-23 補上，57 條：型階梯與高度階梯存在／WCAG 對比 21 組／
外殼檔案禁用樣式 9 條／封面四卷結構／工坊空狀態單一 CTA／技術債預算 8 項，
刻意破壞驗證 2 次，見 `docs/decisions.md` §CI）**。

**剩餘覆蓋缺口**：戰鬥輪次狀態機、Fultimator 匯入匯出。

> ✅ **角色卡數值引擎的缺口已於 2026-10-04 補上**（`test:engine`；2026-10-05 擴充至 **322 項**
> ＝ 243 項基礎向量 ＋ 79 項數值構成公式與免費增益二選一，見 `docs/decisions.md` §N）。
> 2026-10-22 再補 7 項魔晶石制的等級分配校驗（K10–K16：職業等級總和 vs 角色等級的例外、
> p.140 的 5 級下限，見 `docs/decisions.md` §CD），15 項投點驗證（G2：技能必須屬於
> 該職業、`maxSL` 上限、未精通職業上限，見 §CE），16 項金手指選項（J7，見 §CF），
> 以及 24 項金手指效果（J8：相性／免疫／條件式防禦／多組選項，見 §CG）。
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
| ~~金手指來源標記~~ | ✅ **已由 §AR4 裁定結案**：使用者裁定「檢查重複，有重複就不列出處」——實測**有重複**（FLIGHT／CURSED 橫跨高低＋自然；ROBOT 橫跨高低＋科技），故**介面不列出處**，`（高奇）`等名稱標記與 `filterQuirksBySources` 一併移除（§AR5，55→46 筆）。 | ✅ 已結案 |
| ~~本機路徑搬遷~~ | ✅ **已完成**：`AGENTS.md:25` 已是 `本專案根目錄` | ✅ 已結案 |
| ~~金手指效果逐筆核對~~ | ✅ **2026-10-22 已結案（§CG）**：46 條逐條讀過（含 `desc` 全文）。只有 **11 條**會改角色卡上的數字（7 條本體 `effects` ＋ 4 條 `optionGroups`），已全部進 `calculateCharacterStats`（`stats.quirkEffects` ＋ 條件式 `def`／`mdef`）。其餘 **35 條不實作**，分類與逐類理由見 §CG7（敘事／章節結算／裝備載具／戰鬥內一次性）——判準是「有欄位放它，而且有東西讀那個欄位」 | ✅ 已結案 |
| Bonus Collection 其餘 7 項 | ~~New Heroic Skills~~ ✅ 2026-10-06 已收錄（卡牌大師 4 筆，見 §AK4）；**Halloween 系列／Arcane Whispers／三隻 Additional Bosses** 仍待裁定優先序（Halloween 的**範例角色 8 組**已於 `expansionPresets.js` 收錄，此處指其餘內容） | 待裁定 |
| ~~先攻變體是否套用~~ | ✅ **2026-10-21 已實裝（§BL）**：改成整團開關 `creationRules.initiativeVariant`（預設 `false`＝與核心逐字相同）。開啟後：防具先攻減值不存在、戰鬥輕甲改物防 +2／魔防 +0、先攻值不存在（顯示「不計」）、影響先攻的效果**忽略而非替換**。判定收斂在 `data/initiativeVariant.js`，`test:initiative` 95 條釘住。**NPC 端刻意未接線**（NPC 工坊沒有開卡規則面板，見 §BL5） | ✅ 已結案 |
| ~~GitHub repo 改名~~ | **實測 `git remote -v` 已是 `https://github.com/Vice1412/monogatari-techou.git`——改名早已完成。**（2026-10-05 複驗更正） | ✅ 已結案 |
| 英雄技能「效果文字」逐筆核對 | ✅ **115 筆全部完成**（Core 31 ＋ HF 24 ＋ NF 21 ＋ TF 18 ＋ Bonus 21，共修 20 處；見 §AJ3、§AU）。**待辦**：Playtest changelog 明列約 20 個**修訂既有技能**的項目尚未套用 | 待排程 |
| ~~自然奇幻其餘選用規則~~ | ✅ **2026-10-23 已結案（§CH）**：掃 `Natural Fantasy Atlas` 全書（p.108 起 New Options）後，**除了金手指之外只剩營地活動**（p.130–133）會影響開卡流程——定制武器、金手指早已實裝，其餘章節是純內容或預設集。營地活動已完整實裝：整團開關 `creationRules.campActivities`（預設 `false`）、角色資料 `character.campActivities = { picked, used }`、建角選 2 種（金手指【老大哥／歐尼醬】給 3 種且團隊沒開仍可用）、第 5 步驗證、編輯器與跑團面板雙模式區塊、紙卡匯出。CHM 測試版五處數字落差一律照英文正式版。`test:campactivities` 127 條。**註**：§AG5 當年把「營地活動」列為「不需要」，該裁定已由 §CH 取代 | ✅ 已結案 |
| Playtest 其餘選用規則 | 同文件還有前後排、Applause Points、Surrender、休息場景、電影式造物計畫等選用規則；本專案目前只實裝「開局英雄技能」與「高階角色起始資金」（實測 `DEFAULT_CREATION_RULES` 無相關欄位）。**另**：高度奇幻手冊的底力技（p.124–131）已於 2026-10-21 實裝，見 §BM——它**不屬** Playtest；自然奇幻的營地活動（p.130–133）已於 2026-10-23 實裝，見 §CH——同樣**不屬** Playtest | 待裁定 |
| ~~D5 金手指選項~~ | ✅ **2026-10-22 已結案（§CF／§CG）**：「倖存者」③ IP +2、「墮落天使」③ 最大 MP +10 都已進 stats。結構性原因一併解除——金手指不再只有名稱比對：`quirks[].options`（單組）與 `quirks[].optionGroups`（多組，草木成精要選免疫狀態＋易傷屬性、通智幽魂三組）都有資料層承載，`quirkChoice` 允許 `string | { [groupId]: optionId }` | ✅ 已結案 |
| ~~D6 官方飾品「洋蔥戒指」~~ | ✅ **2026-10-22 已結案（§CF4）**：Core p.289 的洋蔥戒指（`{ hpPerClass: 2, mpPerClass: 2 }`，2000z）已在 `rulesData.equipment.accessories`。實測該表 **35 筆** ＝ 官方 **29 筆** ＋ 本專案早期自造 **6 筆**（後者全部標 `custom: true` 並在說明尾巴註明非官方表，保留以免舊存檔出現「查無此項」） | ✅ 已結案 |
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

---

## 8. 介面設計系統（v5.1「層級優先 · 安靜」，2026-10-23）

> 規則本體與稽核明細在 [`docs/ui-review-refactoring-ui.md`](ui-review-refactoring-ui.md)；
> 本節只放**會變的數字**。護欄：`npm run test:uisystem`。

### 8.1 設計令牌（現值）

| 令牌 | 值 | 備註 |
|---|---|---|
| 型階梯 | `t12 / t14 / t16 / t20 / t25 / t31 / t39` | 12/14/16/20/25/31/39px，比例約 1.25 |
| 行高 | 1.6 / 1.55 / 1.6 / 1.45 / 1.3 / 1.2 / 1.1 | 與字級**成反比** |
| 高度階梯 | `e1 / e2 / e3` | 全部雙層陰影 |
| 圓角 | `DEFAULT 2px / md-lg-xl 3px / 2xl 4px / book 4px / ui 2px` | 設定層一次收斂，不動 373 處類別名 |
| `--ink-3` | `#5f6a78`（原 `#8b95a3`） | 紙色 5.41:1、`ui-0` 4.96:1 |
| 九相色票（九相＋墨＋危險紅） | 物理 `#404a58`／風 `#245c45`／電 `#5a6b00`／暗 `#5e387c`／土 `#5c4a26`／火 `#a63d40`／冰 `#27527a`／光 `#9c4d16`／毒 `#8c2d6a`；墨 `#3c2415`、危險 `#8c2d36` | 九相**兩兩不同**（H14-b）；最低 5.01:1（電）；三組撞色已消除 |
| hover 階（六對） | `#a63d40→#8c3235`／`#8c2d36→#76252d`／`#245c45→#1e4b39`／`#9c4d16→#833f12`／`#27527a→#214365`／`#5e387c→#4f2e67` | 同色相暗一階（比例 0.82–0.84）；**`hover:` 必須換值**，H13 把關 |

### 8.2 WCAG 對比實測（AA 門檻 4.5:1）

| 配對 | warm | cool |
|---|---|---|
| `ink` on `paper` | 12.68:1 | 11.63:1 |
| `ink` on `ui-0` | 11.63:1 | 10.95:1 |
| `ink-2` on `paper` | 5.57:1 | 5.11:1 |
| `ink-3` on `paper` | 5.41:1 | 4.96:1 |
| `ink-3` on `ui-0` | 4.96:1 | 4.67:1 |
| `accent` on `paper` | 6.14:1 | 5.63:1 |
| 白字 on `accent` | 6.24:1 | 6.24:1 |
| `ink-3` on `ui-2` | 4.03:1（**不合規**） | 3.73:1（**不合規**） |

**`ui-2` 是面，不是字面**——三級墨放上去必然不合規（連二級墨都只有 3.87:1），
故本專案的約束是「`ui-1`／`ui-2` 只放 `ink` 級文字或不放文字」。理由見稽核文件 §1.5。

### 8.3 技術債預算（只能減不能增，`test:uisystem` [F] 把關）

| 項目 | 2026-10-23 實測（第七輪後） | 上限 |
|---|---|---|
| `text-[10px]` | 426 | 426 |
| `text-[11px]` | 491 | 491 |
| `text-[9px]` | 12 | 12 |
| `animate-pulse` | 26 | 26 |
| `shadow-2xl` | **0** | **0**（已全數換成 `shadow-e3`，此後不得回退） |
| `font-mono` | 481 | 481 |
| `hover:scale-` | 62 | 62 |
| `bg-gradient` | 42 | 42 |
| 新型階採用（`text-t*`） | 32 處 | ≥ 20 |

> 10px／11px 的數字只是**總量**；「其中有多少是句子」見 §8.8（第七輪：1,030 處裡只有 113 處是中文段落，已清零）。

### 8.4 已改寫的畫面

- 封面 `BookCoverHub.jsx`：深藍皮革 → 暖紙＋紅書脊；卡片四色 → 單一色調＋hover 強調條；卡片補說明文字；主要動作唯一；`div onClick` → `<button>`。
- 章節標頭 `ChapterHeader.jsx`：漸層退出鈕 → 平面單色；四顆工具鈕改成「次要 ×3 ＋ 第三級 ×1（還原全站）」。
- NPC 工坊空狀態：700px 空盒 → 填滿並置中的虛線區；單一 CTA；文案不再指路到已隱藏按鈕。
- 術語統一：顯示路徑 4 處「種族」→「物種」（搜尋 placeholder、區塊標題、卡片預覽、文字匯出）。
- 陰影階梯落地：全站 22 處 `shadow-2xl` → `shadow-e3`（15 個檔案，含 8 個模態窗），天花板歸零。

### 8.5 第二輪實測（2026-10-23，渲染層 ＋ 碼面）

**渲染層**（CDP 實測，封面 1440／390、工坊空狀態 1440）：

| 指標 | 封面 | 工坊空狀態 |
|---|---|---|
| 相異字級 | 4（12／14／20／39） | 4（12／14／16／20） |
| 相異文字色 | 6 | 5 |
| 相異字重 | 5 | 4 |
| 行寬（字元） | 64 | — |
| 同列混字級需基線對齊 | 0 | 0 |

**碼面**（全站 `src/`，剝註解）：

| 指標 | 數值 | 護欄 |
|---|---|---|
| 相異 hex 色票 | 218 | [G] 上限 218 |
| 字重種類 | 6 | [G] 上限 6 |
| `uppercase` 未帶字距 | 1（房間碼輸入框，刻意保留） | [G] 上限 1 |
| 任意值總數 | 2,872（`text-` 1,730／`bg-` 490／`border-` 442） | [F] 部分納管 |
| 邊框＋陰影＋換底同元素 | 229 行 | 未納管 |
| 有空狀態文案的清單檔 | 15 / 67 | 未納管（下一輪主目標） |
| `active:` 覆蓋 | 62 行 / 28 檔 | 外殼由 [G] 守住 |

**390px 標頭（修前 → 修後）**：退出鈕 175px → **96px**（<sm 顯示「返回封面」）；
標頭高度 73px → **34px**；第四顆工具鈕從「第二列右端孤立圖示」回到第一列。
量測腳本 `scratch/ui-audit/header390.mjs`（不進版控，可重跑）。

**空狀態覆蓋（第三輪，2026-10-23）**：嚴格判準（同時有長度判斷與說明性文案）
清單檔 93 → 有空狀態 **7 → 8**（新增命刻章）。寬鬆判準（只數文案）為 15/67。
兩套判準的差別是「有沒有先問使用者會不會真的落到空清單」——嚴格判準只認真的空狀態。
掃描腳本 `scratch/ui-audit/empty_state_scan.mjs`。

**空狀態盒內距（390px 實測）**：工坊與命刻的空狀態說明文字距虛線框線
**1px → 24px**（`over: -1` → `over: -25`），`scrollWidth` 仍等於 `clientWidth`。

**章節身份色（第三輪量測，未修）**：四個 `CHAPTER_THEMES.headerBg` 的色相
40°／152°／356°／204°，全距 **316°**，飽和度最高 **100%**。腳本
`scratch/ui-audit/chapter_hues.mjs`。這與 v5「冷暖分層」宣言的落差見
`docs/ui-review-refactoring-ui.md` §7.5。

**空狀態可讀性（第四輪，2026-10-23）**——前三輪量「有沒有」，這一輪量「讀不讀得到」：

| class | hex | 白底 | `slate-50` 底 | 用途判定 |
|---|---|---|---|---|
| `text-slate-400` | `#94a3b8` | **2.56:1** | **2.44:1** | ❌ 連 3:1 都不到 |
| `text-slate-500` | `#64748b` | 4.76:1 | 4.55:1 | ⚠️ 勉強 AA，不該用於 10–11px |
| `text-slate-600` | `#475569` | 7.56:1 | 7.24:1 | ✅ 小字說明 |
| `text-slate-800` | `#1e293b` | 14.6:1 | 13.98:1 | ✅ 標題 |

圖示 alpha（`amber-700` 於 `#f8fafc`）：`/60` **2.44**、`/70` 2.90、`/75` 3.14、`/80` **3.43** →
空狀態圖示一律 `/80` 起（`FateClockPage:93`、`NPCWorkshop:4429` 已升）。腳本
`scratch/ui-audit/contrast_empty.mjs`、`scratch/ui-audit/alpha_icons.mjs`。

**空狀態文案等級（第四輪，只列能量測的）**：

| 量測 | 判準 | 第四輪前 | 第四輪後 | 怎麼量的 |
|---|---|---|---|---|
| 佔位型空狀態 | 一行 `text-slate-400`＋「暫無／尚無／還沒有」 | 4 | **0** | 正則掃 `src/*.jsx`（`text-slate-400[^>]*>(暫無\|尚無\|…)`） |
| 段落級低對比說明 | `<p>` 帶 `text-slate-400` | 4 | **0** | `test:playhudempty` G1（掃 87 檔，`dark:` 變體除外） |
| 本輪升級成教學型的區塊 | 虛線框＋`gi` 圖示＋標題＋一句規則或下一步 | — | **8 個區塊 / 6 檔** | 逐檔改動，見 `docs/ui-review-refactoring-ui.md` §8.2 |

> 「教學型總數」**不列數字**：`border-dashed` 在 `src/` 有 69 處、散在 30 個檔案，
> 其中大半是表單與拖放框，不是空狀態——用 class 去數會得到一個看起來精確的假數字。

`text-slate-400` 全站仍有 **114 處**（圖示／控件 55、小標籤文字 59——其中段落級 4 處已清）。

> ⚠️ **上面那個 114 已作廢，不要拿它當工作清單**（第五輪實測，見 §8.6）：它是 grep 直數，
> 把「註解裡提到的 class 名」與「深底上的正確用法」一起算了進去。現行基準是 §8.6 的分診表。

**型階梯預算（第四輪的副作用，數字下降）**：`text-[10px]` 469→**468**、`text-[11px]` 563→**562**
（[F] 上限不變）。觸發原因：把 10px 改 11px 讓計數爆表 → 改用型階梯 `text-t12`。

- 全站 `:focus-visible` 焦點框（2px `accent`）。

---

### 8.6 第五輪實測（2026-10-23，標籤層對比）

**現存 `text-slate-400`：62 處**（改前 111 處，改動 49 處字串 / 15 檔）。

| 類別 | 數量 | 處置 |
|---|---|---|
| 控件（disabled／`placeholder:`／`hover:text-*`） | 51 | 留著灰（WCAG 對 disabled 不要求對比） |
| 註解 | 5 | 不是畫面 |
| 裝飾（`➔`×3、`—`、深底標記×2） | 6 | 不動 |
| **真文字** | **0** | 全部改 `slate-600`（7.58:1）或 `slate-500`（4.76:1，僅搜尋圖示） |

**深底對比實測（同一條規則在這裡會反向）**：

| 組合 | 對比 |
|---|---|
| `slate-400` on `slate-900` | **6.96:1** ← 合格，不動 |
| `slate-400` on `slate-800` | **5.71:1** ← 合格 |
| `slate-600` on `slate-800` | **1.93:1** ← 照規則改會壞 |
| `slate-600` on `slate-900` | **2.36:1** |
| `slate-400` on `#ffffff` | **2.56:1** ← 淺底，必須改 |
| `slate-600` on `#ffffff` | **7.58:1** |
| `slate-500` on `#ffffff` | **4.76:1** |

**護欄**：`test:playhudempty` 25→**27 條**（H1 真文字 = 0、H2 總量 ≤ 62）；三次刻意破壞驗證。
**深底例外機制**：`{/* slate400-on-dark */}` 顯式標記，護欄不推測背景色。

**仍待處理**：`text-[9px]` 34 處（改字級會動版面，需逐處截圖）。


### 8.7 第六輪實測（2026-10-23，9px → 12px 地板）

**前提**：`tailwind.config.js` 的 `fontSize` 只有七級（`t12 t14 t16 t20 t25 t31 t39`），
最低一級就是 12px。所以 9px／10px／11px **全部在型階梯之外**，而 `text-[10px]`（468/469）
與 `text-[11px]`（562/563）都只剩 1 的餘裕——9px 只有一條路：抬到 `text-t12`（不佔任意值預算）。

**結果：34 → 13 處（21 處抬到 12px / 14 檔）**

| 段 | 腳本 | 處 | 檔 | 判準 |
|---|---|---|---|---|
| 一 | `scratch/ui-audit/nine_to_t12.mjs` | 16 | 10 | 原始碼裡看得到中文的標籤與句子 |
| 二 | `scratch/ui-audit/nine_cjk_data.mjs` | 5 | 4 | 中文在資料層（`{term.label}`），容器有 `min-w-[…]` 或 `flex-col` |

**第二段為什麼要另一支腳本**：`<span className="text-[9px]">{term.label}</span>` 這一行
**一個中文字都沒有**——中文在資料層（「基礎」「職業」…）。任何以「這行有沒有中文字」
為判準的掃描都會回報 0 處，而畫面上確實是 9px 中文。這批只能人工判定 ＋ 逐條列名。

**護欄**：`test:uisystem` 62→**64 條**

| 斷言 | 內容 |
|---|---|
| F-9px | `text-[9px]` **≤ 13**（天花板跟著降，不准回填） |
| F-CJK9 | 9px 那行（含後兩行）不得有中文字；同行 `{/* … */}` 先剝掉 |
| F-4FILE | `StatFormulaPanel`／`EquipmentSlotCard`／`CharacterLogModal`／`TinkererWorkshop` 整檔零 9px |

四次刻意破壞：改回 9px（預算＋CJK 紅）／新增拉丁 9px 晶片（只有預算紅）／
把既有晶片內容換成中文且總量不變（只有 CJK 紅）／把資料層那批改回 9px（四檔規則紅）。
**後兩種破壞各自證明了另一條規則的必要性**——只做前兩種的話，兩條規則看起來永遠一起紅、一起綠。

**截圖抓到的兩個版面缺陷（測試抓不到）**：

| 位置 | 症狀 | 修法 |
|---|---|---|
| NPC 工坊 · 冠位面板 | 12px 後句子折行，貼到右側「HP x1」圓標 | 左欄 `flex-1 min-w-0 pr-3`、圓標 `shrink-0` |
| 角色編輯 · 跑團面板副標 | 斷行把「咒語」切成「咒／語」 | `text-balance` |

順帶：冠位面板標題原為「冠位等級 / Champion Level」，違反純中文鐵律（規則三）。
全站掃「中文 / English」樣式 4 個命中、3 個假陽性（單位與並列），真違規就這一個，已改純中文。

**顏色順手修一處**：`StatFormulaPanel` 說明句 `#8c7b6c` 在 `#fbf7ee` 上只有 **3.80:1**
（小字門檻 4.5:1 未達）→ 改用既有 `#6b5a4b`（6.16:1），**不新增色票**（色票集已滿）。

**剩餘 13 處**：全部是等寬拉丁／數字晶片（`d6`、`+3`、`≤70`、屬性英文名、角標數字），
密度是刻意的，且多數受 `max-w-[54px]` 這類固定寬度保護。
唯一「知道是中文仍留著」的是 `CombatantCard.jsx:299` 的 `{st.desc}`——它在 `grid-cols-3`
的窄晶片裡，抬到 12px 會把整排撐高；**正確修法是改格子數（3→2），不是改字級**，
需要連戰鬥章截圖一起驗，不塞進字級這一輪。已有 `title={st.desc}` 作退路。

### 8.8 第七輪實測（2026-10-23，1,030 處 → 113 句）

`text-[10px]`／`text-[11px]` 的總數是 1,030，但那個數字不能當工作清單。普查（`scratch/ui-audit/ten_eleven_census.mjs`）分五類後：

| 類別 | 判準 | 10px | 11px | 合計 |
|---|---|---|---|---|
| SENTENCE | `<p>` ＋ 該行與後 2 行有中文 | 42 | 71 | **113** |
| CJK | 有中文但是短標籤 | 247 | 240 | 487 |
| LATIN | 無中文（`d6`、`+3`、`STR`） | 176 | 244 | 420 |
| DISABLED | `disabled`／`aria-disabled` | 1 | 9 | 10 |

三批清完（40 ＋ 69 ＋ 4，最後 4 處是 `truncate`／`line-clamp-1`）：

| 級別 | 之前 | 之後 | 天花板 |
|---|---|---|---|
| `text-[10px]` | 468 | **424** | 426 |
| `text-[11px]` | 562 | **493** | 491（測試計數 491） |
| SENTENCE | 113 | **0** | — |
| `text-[9px]` | 13 | **12** | 12 |

護欄：`test:uisystem` 64 → **65**（第 65 條「中文段落不得低於 12px」）；`test:ui` 362 → **366**（第 5 步空狀態 4 條）。

刻意破壞：新規則以 `span→p`（字級不動、總量不動）隔離驗證 → 只有新規則紅；`revert` 一次 → 預算與新規則同時紅。第 5 步空狀態破壞兩次 → 永不出現 2 紅；永不出現不了只有第 4 條紅。

同輪修掉的真缺陷：**第 5 步在預設規則下整頁空白**（三塊內容全由開卡規則決定，三個開關預設 false），補虛線框空狀態。

全量關卡：`npm test` exit 0（關卡全綠）、`npm run build` ✓ 4.96s、emoji 0 行。

### 8.9 第八輪實測（2026-10-23，章節色 4 套 → 1 套）

四章頁首 computed 底色（`scratch/ui-audit/shot_chapters.mjs`，1440×1000）：

| 章節 | 之前 | 之後 |
|---|---|---|
| NPC 工坊 | `rgba(244,235,217,.95)` | `rgba(244,235,217,.95)` |
| 角色卡助手 | `rgba(236,253,245,.95)`（薄荷） | `rgba(244,235,217,.95)` |
| 戰鬥輪次 | `rgba(255,241,242,.95)`（粉） | `rgba(244,235,217,.95)` |
| 命刻記錄 | `rgba(240,249,255,.95)`（天藍） | `rgba(244,235,217,.95)` |

| 指標 | 之前 | 之後 | 天花板／備註 |
|---|---|---|---|
| 章節外框色表 | 4 套（＋警告框第 5 套） | **1 套** | 集合大小必須為 1 |
| 相異 hex（`hex_inventory.mjs`） | 265 | **253** | 刪掉 3 個零引用死類別 |
| 色票預算（`test:uisystem`） | 210 / 218 | **210 / 218** | 未增加（零新 hex） |
| `#8c7b6c` 文字站點 | 52 | **0** | 3.80:1 → `#7c6a58` 4.84:1 |
| `text-slate-400` 正文站點 | 49 | **10** | 10 行皆為停用態（WCAG 豁免） |
| `test:uisystem` | 65 | **81** | C2 段 16 條 |
| `text-[10px]`／`[11px]`／`[9px]` | 424／491／12 | **424／491／12** | 本輪未動字級 |

護欄：`tests/uiSystem.test.mjs` 新增 C2 段——7 條「四章同一個 key 的值只有一種」（`Set(...).size === 1`）、
5 條「外殼檔無章節色相」、1 條「外殼表的值就是 `BOOK_CHROME`」、1 條「沒有手寫覆寫」、
2 條皮膚（預設 amber／六種沒少）。

刻意破壞（一次只隔離一條）：combat 自帶 `headerBg` → 2 紅（78/80）；
`ChapterHeader` 標題加 `text-emerald-900` → 1 紅（79/80）；
`getCharacterTheme` fallback 改回 emerald → 1 紅（79/80）。還原後 81/81。

全量關卡：`npm test` exit 0（關卡全綠）、`npm run build` ✓、emoji 0 行。

### 8.10 第九輪實測（2026-10-23，脈動 26 → 2、三層噪音 267 → 17）

| 指標 | 之前 | 之後 | 天花板／備註 |
|---|---|---|---|
| `animate-pulse`（非註解） | 26 | **2** | 恰好 2，且必須是 `PULSE_OK` 那兩支 |
| 三層噪音（邊框＋低陰影＋底色） | 267 行 | **17 行** | 上限 17，只能往下 |
| 移除的陰影 | — | **242**（45 ＋ 3 檔） | 兩段：帶色 border 236／裸 border 6 |
| `shadow-inner`／`md\|lg\|xl\|e3` | 18／49 | **18／49** | 刻意不動（內凹槽／浮層） |
| 全站 `shadow-` 行數 | 384 | **384** | 大部分陰影合法，這條只管跟邊框打架的 |
| `test:uisystem` | 81 | **84** | C3 兩條 ＋ C4 一條 |

刻意破壞（一次只隔離一條）：`CombatTracker` 連線圖示加回 `animate-pulse` → **3 條同時紅**（80/83）；
章節警告框卡片加回 `shadow-xs` → **只有**噪音那條紅（83/84）。還原後 84/84。

保留脈動的兩處與理由：`BookPageFlipOverlay.jsx`（翻頁星芒，300 ms，動畫結束即卸載）、
`AttributeMatrixPicker.jsx`（拖曳中的「放開收回」，放手即消失）。

全量關卡：`npm test` exit 0（關卡全綠）、`npm run build` ✓、emoji 0 行。

### 8.11 第十輪實測（2026-10-23，漸層 37 行 → 14 行）

| 指標 | 之前 | 之後 | 天花板／備註 |
|---|---|---|---|
| `bg-gradient`（行數） | 37 | **14** | 13 檔、23 處子字串替換 |
| `bg-gradient`（出現次數，護欄單位） | 42 | **17** | 同一行可能出現兩次 |
| 同伴面板漸層底 | 15 | **0** | 七位同伴七套色相 → 全部 `#fffdf9` ＋ `#d6c7ab` |
| 三色琥珀標題條／深琥珀橫幅 | 3／3 | **0／0** | → `#8b5e34`／`#3c2415` ＋ `#f7f3e8` |
| 三層噪音 | 17 | **17** | 沒動：漸層底本來就被負向前瞻排除（見 §CI18.5） |
| `test:uisystem` | 84 | **85** | 天花板 ＋ 檔案集合兩條 |

刻意破壞：花匠面板底改回翠青漸層 → **2 條同時紅**（83/85）；還原後 85/85。
全量：`npm test` exit 0、`npm run build` ✓ 5.36s、emoji 0 行。

### 8.12 第十一輪實測（2026-10-23，空狀態收斂成一支元件）

| 指標 | 之前 | 之後 | 備註 |
|---|---|---|---|
| 畫面級空狀態（普查） | 28 | 28 | 數量沒變，變的是「長相從哪來」 |
| 四件事齊備（虛線框＋圖示＋標題＋教學） | **0** | **11** | 收斂後全部由 `EmptyState` 產生 |
| 走 `EmptyState` 的檔案 | 0 | **11** | 例外 1 筆（`CharacterEditor`，走 customTheme） |
| 書外的色票（`indigo`／`amber-300`／`slate-50`／`emerald-200`／`rose-700`） | 10 處 | **0** | 全數回到 `#fffdf9`／`#f5efdf`／`#d6c7ab`／`#2c221e`／`#6b5a4b` |
| `font-mono` 寫散文的空狀態 | 2 | **0** | 戰鬥追蹤玩家／敵方兩塊 |
| 空狀態 CTA 帶 `shadow-md`／`hover:scale` | 1 | **0** | 角色名冊；CTA 樣式收進元件 |
| `test:uisystem` | 85 | **89** | 四條：元件存在／檔案集合／文法本體／每次呼叫齊備 |
| `test:playhudempty` | 27 | **27** | E3／F4 改驗「走元件」，不再數 `text-slate-600`／`border-dashed` |

刻意破壞（`scratch/ui-audit/empty_break.mjs`）：拿掉 `CombatTracker` 的 `teach=` 與
`FloristGardenTracker` 的 `EmptyState` 匯入 → **87/89，兩條紅各自指名檔案**；還原後 89/89。

截圖：`scratch/ui-audit/empty/before-combat.png`（兩行 `font-mono` 灰字浮在 1,200px 虛線框中央）
→ `after-combat.png`（兩塊虛線框，各有 `gi` 圖示、粗體標題、一句教學）；
`after-clocks.png`（命刻頁空狀態，含「建立第一個命刻」CTA）。

全量：`npm test` exit 0（關卡全綠）、`npm run build` ✓、emoji 0 行。

## 8.13 第十二輪實測：骰階收斂與托盤去深色（2026-10-23）

改動檔案：`src/features/character-sheet/components/AttributeMatrixPicker.jsx`（880 行）、
`src/components/ui/EmptyState.jsx`（新增 `dense`）、`tests/uiSystem.test.mjs`。

| 指標 | 之前 | 之後 | 備註 |
|---|---|---|---|
| 骰階色相數（4 階） | 3 個色相 | **1 個（同一條墨階梯）** | d12 與 d10 原本共用青色 |
| 實心強調色出現次數 | 0 | **1**（只有最強階） | 強調色稀有才叫強調 |
| 骰階對比（d12／d10／d8／d6） | 未量（深字壓漸層） | **6.15／6.15／15.26／5.56:1** | 全數 ≥ AA |
| 深色面板（`bg-slate-900`） | 1 塊（托盤） | **0** | 全書唯一深色面板 |
| Tailwind 調色盤類別（本檔） | 76 處 | **0** | `slate`／`amber`／`cyan`／`teal`／`rose`／`yellow`／`red` |
| 純白／純黑（本檔） | `bg-white`×3、`text-white`×3 | **0** | 改用 `#fffdf9` |
| 本檔 hex 種類 | 27 | **12** | 全部在令牌白名單內 |
| 本檔任意字級 | 15 處 | **0** | 全走 `text-t12` |
| 半徑 > 2px（本檔） | 17 處（3px／4px） | **0** | `rounded-ui` |
| 本檔 `shadow-*` | 7 處 | **0** | 有邊框就不需要陰影 |
| `bg-gradient`（全站） | 17 | **13** | 天花板同步降到 13 |
| `GRAD_OK` 檔案集合 | 6 支 | **5 支** | 屬性矩陣退出 |
| `text-[10px]`（全站） | 426 | **424** | 天花板同步降 |
| `text-[11px]`（全站） | 491 | **480** | 天花板同步降 |
| `text-[9px]`（全站） | 12 | **10** | 天花板同步降 |
| `test:uisystem` | 89 | **104** | 新增 15 條 ＋ 2 條既有收緊 |
| 命刻主題數 | 7（其中 `emerald` 與 `green` 同名同色） | **6** | 下拉選單不再有兩個「翡翠綠」 |

刻意破壞（`scratch/ui-audit/attr_break.mjs`）：

| 破壞 | 結果 |
|---|---|
| 注入 `bg-cyan-500 text-white` | **2 條紅**：調色盤（`cyan-500`）、純白／純黑（`text-white`） |
| d6 改回 `from-rose-500 to-red-700` | **5 條紅**：`bg-gradient` 預算 14/13、`GRAD_OK` 檔案集合、調色盤、階梯不是色相、不再用漸層 |
| 讓 d10 也變實心 accent | **1 條紅**：最強階是唯一實心強調色 |
| 拿掉 `dense` | **1 條紅**：托盤的空狀態也走同一個元件 |
| INS 借用 DEX 的色相 | **1 條紅**：四個身份拿到四個不同色相 |
| 重複的 `emerald` 加回 `CLOCK_THEMES` | **3 條紅**：封閉六集、id 等於鍵、色相一對一（7 鍵／6 色） |
| 拆掉別名與 fallback 鏈 | **1 條紅**：命刻主題有別名與 fallback |

還原後 104/104。

截圖：`scratch/ui-audit/attr/before-matrix.png`（深海軍藍托盤 ＋ 青／琥珀／玫瑰漸層骰面）
→ `after-matrix.png`（羊皮紙托盤 ＋ 虛線空狀態）
→ `final-matrix.png`（一鍵填入後：d10 強調描邊／d8 中性描邊／d6 內凹淡底，
托盤留下四顆虛線幽靈插槽）；`mobile-matrix.png`（390px：托盤收成橫條，四顆幽靈插槽並排）。

命刻頁的 DOM 實測（`scratch/ui-audit/shot_clocks_opts.mjs`）：主題下拉選單 **6 個選項**，
「翡翠綠」只有一個（改動前是 7 個，其中兩個同名同色）。

全量：`npm test` exit 0（關卡全綠）、`npm run build` ✓ 5.19s、`npm run test:emoji` 0 行、
`test:uisystem` 104/104、`test:playhudempty` 27/27。

---

## 8.14 第十三輪實測：全程淺色與色相收斂（2026-10-23）

> 完整判準與逐條理由在 `docs/decisions.md` §CI21。

### 一、`dark:` 變體：1,323 → 0

| 項目 | 改動前 | 改動後 |
|---|---|---|
| `src/` 內 `dark:` 令牌 | **1,323** | **0** |
| 孤立站點（沒有淺色兄弟） | — | **0**（1323 全部成對） |
| `tailwind.config.js` 的 `darkMode` | **缺**（＝`media`） | `'class'` |

唯一殘留的 `dark:` 字樣是 `FUIcon.jsx:25` 的**屬性鍵** `dark: { char: 'd', … }`（暗相），
不是變體。護欄 H1 只認「`dark:` ＋ 工具前綴」，正是為了不誤殺它。

### 二、色相收斂（`TinkererWorkshop.jsx`，2,163 行）

| 色相 | 改動前 | 改動後 |
|---|---|---|
| amber | 119 | 0 |
| slate | 100 | 0 |
| purple | 51 | 0 |
| stone | 43 | 0 |
| cyan | 38 | 0 |
| rose | 34 | 0 |
| blue | 23 | 0 |
| emerald | 18 | 0 |
| red | 1 | 0 |
| **合計** | **738**（150 種令牌） | **0** |

映射結果：`490 處／163 條規則；未對應 0 個；殘留調色盤行 0`。
白字檢查：`text-[#fffdf9]` 35 處，其中 34 處帶 `bg-[#a63d40]`，第 35 處是
`hover:text-[#fffdf9] hover:bg-[#2c221e]` 的模態窗關閉鈕（合法）。

### 三、形狀 213 處

| 項目 | 處 | 改成 |
|---|---|---|
| `text-[9/10/11/13px]` | 73 | `text-t12` |
| `rounded`／`sm`／`md`／`lg`／`xl`／`2xl` | 83 | `rounded-ui`（2px） |
| `shadow-*` | 16 | 刪除 |
| `hover:scale-105/110`／`active:scale-95` | 16 | 刪除 |
| `animate-bounce/ping` | 2 | 刪除 |
| 保留 `rounded-full` | 6 | 藥丸（`Tier N` 晶片、狀態點），全圓不適用 2px 上限 |
| 保留 `animate-fade-in` | 4 | 一次性入場（判準：**它會不會自己停**） |

### 四、三層噪音：18 → **0**（天花板 17 → 0）

`noise_fix.mjs` 移除 18 個低陰影：`CharacterPlayHUD` 6、`StarterPresetsModal` 6、
`CharacterSheet` 2、`CharacterEditor` 2、`BookPageFlipOverlay` 1、`PilotVehicleCombatSheet` 1。

> ⚠️ 其中 1 處是**這一輪才浮出來的**：`drop_dark` 把跨行的 `className` 收成一行之後，
> `shadow-xs` 與 `bg-*` 才落到同一行。**行掃描的預算會低估噪音，因為噪音會躲進換行。**

### 五、死三元式：2 → 0（新增護欄 H4）

`TinkererWorkshop.jsx` 兩處 `cond ? 'A' : 'A'`（完成狀態、流派圓點），修法見 §CI21.5。
全站掃描現在 0 處。

### 六、390px 實測：分頁鈕直書

`grid-cols-3` 的三顆派系鈕在 390px 下各約 115px，內容 ≈ 118px → 中文逐字折行成直書。
改成窄屏 `flex-col`／`sm:flex-row` ＋ `whitespace-nowrap`。

### 六之二、底部兩格「未指定」收進空狀態文法

`藥劑目標`／`藥劑效果` 兩格原本無論如何都是**同一張實線卡**，只把「未指定」三個字塞進右上角——
等於叫使用者自己發現「這一格是空的」、再自己找出「要去哪一格點」。
改成條件渲染：未指派時走 `EmptyState`（`kind="tinkerer-target"`／`"tinkerer-effect"`，`dense`，
虛線框＋`gi` 圖示＋粗體標題＋一句教學），指派後才回到實線卡面。
截圖 `after-1280.png` 底部兩格。

### 七、全站普查（同一支 `census13.mjs`，第十三輪前後對照）

| 指標 | 第十二輪後 | 第十三輪後 |
|---|---|---|
| `#8c7b6c`（4.07:1，不合格的第四階墨） | 4 處／2 檔 | **0 處／0 檔** |
| `text-slate-400`（2.56:1） | 23 處／5 檔 | **0 處／0 檔** |
| `animate-pulse`（無限動態） | 2 處／2 檔 | **0 處／0 檔** |
| `bg-gradient` | 13 處／5 檔 | 13 處／5 檔（未動） |
| `text-[Npx]` 任意字級 | 943 處／68 檔 | **870 處／67 檔** |
| slate 家族 | 1,076 處／37 檔 | **509 處／30 檔** |
| 九本同伴表色相令牌 | 2,711 處／15 檔 | **1,225 處／15 檔**（其中修補匠工坊 738 → 0） |

三項歸零的判準各不相同，理由寫在 §CI21.11：

- **`#8c7b6c`**：它不是「第四階墨」，是一個**剛好路過的四級灰**——三處是
  `placeholder-[#8c7b6c]`、一處是圖示的 fallback 色。placeholder 是提示文字，仍算文字
  （WCAG 1.4.3 沒有為它開例外），4.07:1 不合格，改 `#7c6a58`（5.17:1）。
- **`text-slate-400`**：剩下 10 處**全部是 disabled 態**（`cursor-not-allowed` ＋ 淡底）。
  disabled 控制項本來就在 1.4.3 的例外裡，所以這裡的問題**不是對比度，是色系**——
  羊皮紙暖底上放一排藍灰，那一塊看起來像壞掉的。全部換成暖階
  （內凹 `#f4ebd9`／分隔 `#e8dcc4`／第四階墨 `#7c6a58`）。
- **`animate-pulse`**：判準是**它會不會自己停**。翻頁星芒的動畫本身 300 ms 就結束，
  但脈動是無限的（一直呼吸）；「放開收回」的提示在放手的瞬間就消失，而它是**文字**，
  強調色＋粗體已經足夠。兩處都判掉，天花板 26 → 2 → **0**。

### 八、截圖

`scratch/ui-audit/tinkerer/before-1280.png`（六個色相同時在說話：amber 標頭／purple「任意」晶片／
emerald「回復」晶片／blue「藥劑目標」面板／rose「藥劑效果」面板／amber 選中頁籤）
→ `after-1280.png`（只剩一個強調色，層級靠三階面與四階墨）；
`after-390.png`（窄屏分頁鈕直排後的三欄）。

方法是 SSR 產出元件的靜態 HTML，再注入跑著的 dev server 頁面（同一份 Tailwind CSS），
不動路由、不動 localStorage：`scratch/ui-audit/ssr_tinkerer.mjs` ＋ `shot_tinkerer.mjs`。
之所以不點進畫面——修補匠工坊要「角色卡 → 開始遊戲 → 職業面板 → 修補匠」四層，
且要求角色真的帶修補匠職業與小工具 SL；注入 DOM 只驗樣式，正是這一輪要看的。

### 九、全量

`npm test` exit 0（關卡全綠）、`npm run build` ✓ 4.93s、`npm run test:uisystem` **107/107**、
`test:playhudempty` 27/27、`test:emoji` 0 行、`check:agents` 在警告門檻之下。
新增／收緊的護欄各有一次刻意破壞驗證（共 6 種）。

> 條數 104 → **107** 而不是 108：脈動原本是兩條斷言（「只有兩處」＋「就是那兩支檔案」），
> 歸零之後第二條失去意義，合併成一條「全站零脈動」。

---

## 8.15 第十四輪實測：跑團面板的六個色相收斂（2026-10-23）

> 完整判準與逐條理由在 `docs/decisions.md` §CI22。
> 對象是 `src/features/character-sheet/components/CharacterPlayHUD.jsx`（2,818 行）——
> 第十三輪之後全站最大的單點債（313 個調色盤令牌／108 種）。

### 一、色相：313 → 0

| 家族 | 改動前 | 改動後 | 換成 |
|---|---|---|---|
| slate | 98 | 0 | 暖階（`#fbf7ee`／`#f4ebd9`／`#e8dcc4`／`#d6c7ab`／`#7c6a58`／`#6b5a4b`／`#3c2415`／`#2c221e`） |
| amber | 60 | 0 | 書的暖棕（`#8b5e34`／`#78350f`）＋內凹 |
| purple／indigo | 35 | 0 | 墨與內凹 |
| rose | 20 | 0 | 強調色 `#a63d40`（危險文字 `#8c3235`） |
| red | 20 | 0 | 同上 |
| blue | 15 | 0 | 墨 `#3c2415`／`#6b5a4b` |
| emerald／teal | 6 | 0 | 同上 |
| **合計** | **313**（108 種） | **0** | 映射 305 處 ＋ 漸層 8 個色相令牌 |

新增 hex **1 個**：`#8c3235`（強調色 hover／pressed、危險文字；7.49／6.76／7.88:1，
與 `#a63d40` 的 ΔE 8.8）。否決「HP 磚紅 `#9c3a3c`」——與強調色 ΔE **3.5**，是同一個紅。

### 二、資源條：漸層 4 → 0，色相 3 → 1（危急才換）

| bar | 改動前 | 改動後 |
|---|---|---|
| HP | `from-red-500 to-rose-600`／危急 `from-red-600 to-rose-700` | `bg-[#3c2415]`／危急 `bg-[#a63d40]` |
| MP | `from-blue-500 to-indigo-600` | `bg-[#3c2415]` |
| IP | `from-emerald-500 to-teal-600` | `bg-[#3c2415]` |
| 經驗 | 行內 `theme.accent`（角色主題色） | **不動**——那是玩家選的身份，封閉集合 |

判準：**HP／MP／IP 是「量」，量用長度說**；「哪一條是 HP」由標籤（`生命值` ＋ 圖示）承擔。

### 三、形狀 157 處

| 項目 | 處 | 改成 |
|---|---|---|
| `text-[8/10/11px]` | 55 | `text-t12` |
| `rounded-md/lg/xl/2xl` | 86 | `rounded-ui`（2px） |
| `shadow-xs/2xs/sm/md` | 16 | 刪除 |
| `truncate`（防禦卡三處說明） | 3 | `leading-tight` |

保留：`rounded-full` 8 處（藥丸與 bar，全圓不受 2px 上限約束）、`shadow-e1` 1 處（既有高度權杖）、
`shadow-inner` 2 處（**內凹槽不是抬升**，第九輪已裁定保留——它講的是「這裡凹進去」，不是「這塊浮起來」）。
`shadow-2xs` 1 處是本輪多抓到的：它不在原本的清單（`xs/sm/md`）裡，是逐個列出殘留時才看見的。

### 四、390px 實測：截斷變成刪資訊

`text-[10px]` → `text-t12` 是 +20%。防禦卡三欄在 390px 各約 110px，
「當前 DEX(d10)」被 `truncate` 截成「當前 DEX(d…」——**`d10` 不見了**。
改成 `leading-tight` 折行（「當前」／「DEX(d10)」），資訊完整。
`after-390.png` 第 9 屏可見兩行；`before-390.png` 是單行截斷。

### 五、護欄：107 → **110**，並收緊一條舊的

| 護欄 | 內容 |
|---|---|
| 漸層表（收緊） | 從「檔案白名單」改成 `Map`（檔案 → 次數）：`JRPGModal` 2／`CharacterSheet` 4／`CharacterCard` 1／`NPCWorkshop` 2 ＝ **4 檔／9 條**（原 5 檔／13 條） |
| H5 | `CharacterPlayHUD.jsx` 零調色盤令牌（`0 個`）＋ 零任意字級（`0 個`） |
| H6 | 資源條 4 條／實心墨 2／危急三元式 1；經驗條的例外寫在註解旁 |

刻意破壞驗證 5 種（`scratch/ui-audit/hud_break.mjs`），全部紅且指名：

| 破壞 | 訊息 |
|---|---|
| 塞回 `text-red-700` | `遊戲中主畫面零調色盤令牌（量用長度說） —— 1 個` |
| 塞回 `text-[10px]` | `遊戲中主畫面零任意字級（型階梯） —— 1 個` |
| 一條資源條掉填色 | `bar 4 條（實心墨 1＋危急 1＋經驗 1）` |
| 主畫面長出漸層 | `CharacterPlayHUD.jsx×1（應為 0）` |
| 白名單檔案多一條 | `CharacterSheet.jsx×5（應為 4）` |

### 六、全站普查（`census13.mjs`，第十三／十四輪對照）

| 指標 | 第十三輪後 | 第十四輪後 |
|---|---|---|
| `#8c7b6c`（4.07:1） | 0 處／0 檔 | 0 處／0 檔 |
| `text-slate-400`（2.56:1） | 0 處／0 檔 | 0 處／0 檔 |
| `animate-pulse` | 0 處／0 檔 | 0 處／0 檔 |
| `bg-gradient` | 13 處／5 檔 | **9 處／4 檔** |
| `text-[Npx]` 任意字級 | 870 處／67 檔 | **815 處／66 檔** |
| slate 家族 | 509 處／30 檔 | **387 處／29 檔** |
| 九本同伴表色相令牌 | 1,225 處／15 檔 | 1,225 處／15 檔 |

### 七、截圖

`scratch/ui-audit/hud/before-1280.png`（HP 紅漸層／MP 藍漸層／IP 綠漸層／HP 卡粉底紅框／
「魔法防禦」藍字／全站借來的 slate 灰／12px 以下小字／圓角與陰影）→
`after-1280.png`（三條 bar 同一個墨、危急才紅；HP 卡回羊皮紙；只剩角色主題色一個色相來源）；
`before-390.png` → `after-390.png`（折行取代截斷）。

方法是 SSR 產出元件的靜態 HTML 再注入跑著的 dev server 頁面（同一份 Tailwind CSS），
不動路由、不動 localStorage：`scratch/ui-audit/ssr_hud.mjs` ＋ `shot_hud.mjs`。
之所以不點進畫面——跑團面板要「封面 → 角色卡 → 開發警告 → 選角色 → 開始遊戲」五層。

### 八、全量

`npm test` exit 0（關卡全綠）、`npm run build` ✓ 5.10s、`npm run test:uisystem` **110/110**、
`test:playhudempty` 27/27、`test:ui` 366/366、`syntax_check.mjs` 144 檔 0 錯、
`check:agents` 在警告門檻之下（31,128 bytes）。

> 條數 107 → **110**：H5 拆成兩條（色相／字級是兩種債，一起紅就分不出是哪一種），H6 一條。
> 漸層表那條**條數不變、內容收緊**——它從「有哪些檔案」變成「每個檔案有幾條」。

## 8.16 第十五輪實測：換一個角色主題，不該換一個 app（2026-10-23）

### 一、六套顏色系統 → 一張紙 ＋ 一階墨 ＋ 一個身份色

`src/features/character-sheet/utils/characterThemes.js` 原本每個主題二十二個欄位全部不同
（紙 6 階、墨 2 階、邊界 3 種、晶片、漸層、按鈕變體…），等於「換角色主題 = 換一個 app 的顏色」。

| 欄位群 | 本輪前 | 本輪後 |
|---|---|---|
| 面（`appBg`／`sheetBg`／`cardBg`／`panelBg`／`subpanelBg`／`headerBg`） | 6 種各不同 | **1 種**（`SHARED`） |
| 邊界（`border`／`cardBorder`／`cardBorderHover`） | 6 種各不同 | **1 種** |
| 墨（`textDark`／`textMuted`） | 6 種各不同 | **1 種** |
| 晶片（`chipBg`） | 6 種各不同 | **1 種** |
| 身份（`accent` 家族 ＋ 3 個跟著走的 className） | 6 種 | **6 種，兩兩不同** |
| `gradient`／`buttonVariant`／`outlineButtonVariant` | 6 種 | **欄位刪除** |

新增的 hex：**0**。所有面／墨／邊界的值都取自 v5 既有色票（`#fbf7ee`／`#fffdf9`／`#f4ebd9`／
`#e8dcc4`／`#d6c7ab`／`#2c221e`／`#6b5a4b`）。

刪欄位安全的理由：22 處讀 `theme.buttonVariant`、8 處讀 `theme.outlineButtonVariant`，
**每一處都寫著 `|| 'primary'`／`|| 'outline'`**；唯一沒有 fallback 的
`ChapterDevWarningModal.jsx:51` 讀的是檔內常值物件。

### 二、按鈕：14 → 4 個變體

| 項目 | 本輪前 | 本輪後 |
|---|---|---|
| 變體 | 14（`primary`／`emerald`／`purple`／`slate`／`secondary`／`danger`／`cyan`／`ghost` ＋ 5 個 `outline-*`） | **4**（`primary`／`secondary`／`outline`／`ghost`） |
| 圓角 | `rounded-lg` | `rounded-ui` |
| 陰影 | 5 個變體帶 `hover:shadow-md` | **0** |
| 字級 | `text-xs`／`sm`／`base` | `text-t12`／`t14`／`t16`（同尺寸換名） |
| 調色盤令牌 | `bg-emerald-600`／`bg-purple-700`／`bg-slate-700`／`bg-cyan-600`／`bg-red-600` 等 | **0** |

### 三、漸層：9 處／4 檔 → **2 處／1 檔**

三處主題漸層條（`JRPGModal.jsx` 頂線、`CharacterCard.jsx` 與 `CharacterSheet.jsx` 的主題色條）
改成實心 `style={{ backgroundColor: theme.accent }}`。

剩下的兩條在 `NPCWorkshop.jsx`，**都無色相**且刻意保留：`:2562` 羊皮紙髮絲分隔線
（`transparent → #d6c7ab → transparent`）、`:2620` hover 光掃（`white/20`，`group-hover` 才動）。
護欄天花板因此寫 **2 不是 0**，理由寫在 `GRAD_OK` 旁邊。

### 四、角色卡名冊的資源條（與第十四輪同一個判準）

| 條 | 本輪前 | 本輪後 |
|---|---|---|
| HP | `from-red-500 to-rose-600`／危急 `from-red-600 to-rose-700` | `#3c2415`／危急 `#a63d40` |
| MP | `from-blue-500 to-indigo-600` | `#3c2415` |
| IP | `#a8781f`（未登記的土黃） | `#3c2415` |
| 軌道 | `#e8dec8` | `#f4ebd9`（共用內凹槽） |
| 標籤 | `#991b1b`／`#b91c1c`／`text-blue-800` | `#3c2415`（危急才 `#a63d40`） |
| 字級 | 3 處 `text-[11px]` | `text-t12` |

### 五、護欄：110 → **116**

| 護欄 | 內容 |
|---|---|
| H7-a | 六個角色主題共用同一張紙與同一階墨（12 個面／墨／邊界欄位 `Set.size === 1`） |
| H7-b | 六個身份色兩兩不同（`size === 6`） |
| H7-c | 角色主題表零調色盤令牌 |
| H8-a | 按鈕變體集合恰為 `primary／secondary／outline／ghost` |
| H8-b | 按鈕零調色盤令牌 |
| H9 | 角色卡資源條實心、危急才換強調色（危急 1 ＋ 實心墨 2） |
| 收緊 | 漸層 `Map` 4 檔／9 條 → **1 檔／2 條**（三個已清空的鍵移除） |

H7-a 與 H7-b 方向相反（「都一樣」與「都不一樣」），是同一條判準的兩端：
**面必須全部相同，身份必須兩兩不同**。只有 H7-a 的話，六個 accent 全改成同一個顏色也會全綠。

刻意破壞 7 種（`scratch/ui-audit/theme_break.mjs`），全紅且指名；其中 3 種是
「**善意的破壞**」——給翡翠綠一個自己的頁首底，看起來像在幫它加層次：

```
紅 ✓ H7 某個主題有了自己的頁首底        → headerBg 有 2 種
紅 ✓ H7 兩個主題共用同一個身份色        → 5 種 / 6 個主題
紅 ✓ H7 主題表偷渡一個調色盤令牌        → 1 個
紅 ✓ H8 按鈕長回第五個變體              → 5 個：primary／secondary／outline／ghost／danger
紅 ✓ H8 按鈕偷渡一個調色盤令牌          → 1 個
紅 ✓ H9 角色卡危急條換回自己的紅        → 危急 0 條（應為 1）
紅 ✓ 漸層護欄：模態窗頂線長回一條漸層    → JRPGModal.jsx×1（應為 0）
```

### 六、全站普查（`census13.mjs`，第十四／十五輪對照）

| 項目 | 十四輪後 | 十五輪後 |
|---|---|---|
| `#8c7b6c`（4.07:1） | 0／0 | 0／0 |
| `text-slate-400`（2.56:1） | 0／0 | 0／0 |
| `animate-pulse` | 0／0 | 0／0 |
| `bg-gradient` | 9／4 | **2／1** |
| `text-[Npx]` 任意字級 | 815／66 | **812／66** |
| slate 家族 | 387／29 | **367／27** |
| 九本同伴表色相令牌 | 1,225／15 | 1,225／15（未動） |

slate 掉 20 處、檔數 29 → 27，是因為舊的 `characterThemes.js` 與 `JRPGButton.jsx` 本身就在發
`border-slate-300`／`hover:border-slate-700`／`bg-slate-50 text-slate-950`／`bg-slate-700`
——**債有一半住在「產生 class 的那支檔案」裡**，不在呼叫端。

### 七、截圖

`scratch/ui-audit/theme/before-1280.png` → `after-1280.png`（六張紙 ＋ 十四顆按鈕 → 一張紙 ＋ 四顆），
另加 `after-390.png`。

before 取自 `git show HEAD:` 的 `characterThemes.js` 與 `JRPGButton.jsx`（本輪唯二「純本輪改動」的
檔案），跑**同一份 fixture**：六張紙的色值是兩個版本的真實主題表、按鈕是兩個版本的真實元件，
只有餵進去的物件不同。工具：`scratch/ui-audit/ssr_theme.mjs` ＋ `shot_theme.mjs`
（SSR 出靜態 HTML，注入跑著的 dev server 頁面，共用同一份 Tailwind CSS）。

### 八、全量

`npm test` exit 0（關卡全綠）、`npm run build` ✓ 5.27s、`npm run test:uisystem` **116/116**、
`test:playhudempty` 27/27、`test:ui` 366/366、`syntax_check.mjs` 144 檔 0 錯、
`check:agents` 在警告門檻之下（31,128 bytes）。

> 條數 110 → **116**：H7 三條（面收斂／身份一對一／零令牌）、H8 兩條（變體集合／零令牌）、
> H9 一條。面與身份那兩條**必須分開**，否則「六個 accent 全同色」會靠「都一樣」變綠。

## 8.17 第十六輪實測：借來的灰（2026-10-23）

### 一、起點

第十五輪結束時的記帳是「slate 令牌 367 處」。本輪用**護欄同一支正則**重量：**370 處／27 檔**。
差 3 處沒有追——**引用上一輪的數字等於引用一次沒有基準的量測**，數字要在寫進文件的那一刻重量。

`slate` 是 Tailwind 的**冷灰**，v5 是暖紙。370 處散在 27 個檔案，最多的單檔 49 處
（`SkillSuboptionModal`），沒有任何一屏「一眼看過去全是冷灰」，所以沒有任何一次 review 會停下來。

### 二、對映（18 種令牌，依職責不依深淺）

| 職責 | `slate` | → |
|---|---|---|
| 次級說明 | `text-slate-500`／`600` | `text-[#6b5a4b]`（墨三階 6.16/5.56/6.48:1） |
| 標籤、表格值 | `text-slate-700`／`800` | `text-[#3c2415]`（墨二階） |
| 標題 | `text-slate-900` | `text-[#2c221e]`（墨一階） |
| 停用／未點亮 | `text-slate-300` | `text-[#7c6a58]`（4.84:1） |
| 邊界 | `border-slate-200`／`300` | `border-[#d6c7ab]` |
| 分隔線 | `border-slate-100` | `border-[#e8dcc4]` |
| 內凹槽／hover | `bg-slate-100` | `bg-[#f4ebd9]` |
| 區塊底 | `bg-slate-50` | `bg-[#fbf7ee]` |
| 深一階面 | `bg-slate-200` | `bg-[#e8dcc4]` |
| 圓點 | `bg-slate-300`／`400` | `bg-[#d6c7ab]`／`bg-[#7c6a58]` |
| 遮罩層 | `bg-slate-950` | `bg-black`（保留 `/70`、`/75`） |
| 佔位字 | `placeholder-slate-400` | `placeholder-[#7c6a58]` |
| 深底程式碼區塊 | `bg-slate-900` ＋ `text-slate-200` | `bg-[#f4ebd9]` ＋ `text-[#2c221e]` |

**`slate-500` 與 `slate-600` 收斂到同一階墨**：它們在原本的設計裡就是同一個職責，
保留兩階只是把「兩個很像的灰」換成「兩個很像的褐」。

### 三、三個不是「換顏色」的決定

1. **遮罩層不是面。** `bg-slate-950/70` 的職責是壓下底下的畫面；收進面階梯會變成羊皮紙色，
   那就不是遮罩而是紙。改 `bg-black/70`，與全站既有 8 處一致。
2. **`ErrorBoundary` 的深底 `<pre>` 是全站最後一塊深色面板。** 它活過第十三輪，因為它不是 `dark:`
   變體而是當機畫面的 stack trace。深色程式碼區塊是社群慣例，不是這個 app 的規則 → 淺色內凹槽。
3. **停用態要看得出來。** `text-slate-300` 那種「更淡的灰」改 `#7c6a58`（4.84:1）——
   第四輪已證明「讀不到的一行灰字」不是空狀態，停用同理。

### 四、根因

第十三輪刪 1,323 個 `dark:` 令牌時，規則寫的是「只刪**有淺色兄弟**的」。
那些淺色兄弟就是 `slate`——**護欄拿掉深色那一半，淺色那一半原封不動留著**。
於是「深色系統」只剩一半，而剩下那一半看起來完全正常。

> **刪掉一半的系統，比刪掉整個系統更危險**：留下來的那一半不會再被認出來是一個系統。

### 五、護欄

`test:uisystem` 116 → **117**：

- **H10 全站零 slate 令牌（借來的灰）**——硬零值（與 emoji 同級），不是預算。
  掃 `src/**/*.{js,jsx}`（先 `stripComments()`），例外數 0，理由寫在護欄旁邊
  （v5 全程淺色，`slate` 唯一合理的用法是深底，而深底本身已是第二套語言）。

刻意破壞 **3 種 ＝ 2 紅 ＋ 1 綠**（`scratch/ui-audit/slate_break.mjs`）：

| # | 破壞 | 結果 |
|---|---|---|
| 1 | `NumberStepper` 的 `text-[#3c2415]` → `text-slate-700` | 紅 ✓ 指名 `NumberStepper.jsx×1` |
| 2 | `TinkererGadgetsModal` 的 `bg-black/70` → `bg-slate-950/70` | 紅 ✓ 指名 `TinkererGadgetsModal.jsx×1` |
| 3 | 把 `text-slate-500` 寫進**註解** | **綠 ✓（反向對照）** |

第 3 種不是湊數：硬零值護欄最容易寫成永遠不紅，「全站現在是零」讓綠燈沒有資訊量。
掃太兇的護欄會被下一個人用白名單繞過，然後白名單就開始長。

### 六、對照截圖

- `scratch/ui-audit/slate/before-1280.png`／`after-1280.png`：角色編輯器（slate 第二多的畫面，28 處）。
  `before` 來自 `scratch/ui-audit/bak/src16/src`（本輪前的**整份** `src` 快照，實測含 370 處 slate），
  `after` 來自 `src`；同一支 SSR 入口（`ssr_editor.mjs --src=…`）、同一份角色資料。
- `scratch/ui-audit/slate/compare-crop.png`：同一塊區域（角色等級／身份／主題／故事）上下並排放大。

**全幅 1280 前後幾乎一樣。** 那不是截圖失敗，那就是這筆債的樣子——它改的是邊界與次級文字的色溫。
裁到表格邊界，輸入框框線從藍灰變暖褐，差別才成立。

### 七、本輪數字

| 項目 | 前 | 後 |
|---|---|---|
| `slate` 令牌 | 370 處／27 檔 | **0 處／0 檔** |
| 深色面板 | 4（3 遮罩 ＋ 1 `<pre>`） | **0** |
| 相異 hex | 241 | **241**（零新增、零消失） |
| `test:uisystem` | 116 | **117** |
| `text-[Npx]` | 812 處／66 檔 | 812 處／66 檔（本輪未動） |
| `bg-gradient` | 2 處／1 檔 | 2 處／1 檔（本輪未動） |

### 八、全量

`npm test` exit 0（關卡全綠）、`npm run build` ✓ 5.09s、`npm run test:uisystem` **117/117**、
`syntax_check.mjs` 144 檔 0 錯、`check:agents` 31,128 bytes（上限 47.5%）。


## 8.18 第十七輪實測：借來的暖灰（2026-10-23）

### 一、起點

第十六輪結尾的記帳是「剩下的債：同伴表色相令牌 1,225 處、`text-[Npx]` 812 處」，
而 `stone` 只被提到兩次（`bg-stone-900/60` 遮罩 ×2）。本輪用護欄同一支正則重量：

| 家族 | 處 | 檔 |
|---|---|---|
| `slate`（第十六輪已清零） | 0 | 0 |
| `stone` | **526** | **26** |

**比第十六輪的 370 處還多。** 它之所以活到第十七輪，正是因為它比 `slate` 更不像債：
`slate` 是冷灰（`#64748b`），擺在羊皮紙上一眼就怪；`stone` 是暖灰（`#78716c`），
跟 `#fbf7ee` / `#d6c7ab` 的色相同一個區間，所以它**看起來對**。

### 二、分佈（依職責，不是依深淺）

| 職責 | 令牌 | 處 |
|---|---|---|
| 說明字 | `text-stone-500`／`600` | 129 |
| 標籤、值 | `text-stone-700`／`800` | 97 |
| 標題 | `text-stone-900` | 51 |
| 停用／未點亮 | `text-stone-400` | 42 |
| 邊界 | `border-stone-200`／`300`／`100`／`400` | 108 |
| 分隔線 | `divide-stone-100` | 9 |
| 輸入框底／區塊底 | `bg-stone-50`／`100`／`200`／`300`／`500` | 68 |
| 遮罩層 | `bg-stone-900/60` | 3 |
| 深底上的淺色字 | `text-stone-200` | 1 |

最多的三個檔案：`RuleCodexDrawer` 134、`PilotVehicleModal` 98、`WayfarerCompanionModal` 95。
三個都在同伴／法典這一塊——**這一區是第十六輪沒有掃到的角落**，因為它同時也是色相令牌最密的地方。

### 三、對映

判準與第十六輪同一條（依職責，不依深淺），差別只在顏色的來源換成墨／面／邊界階梯：

| 職責 | `stone` | → |
|---|---|---|
| 次級說明 | `text-stone-500`／`600` | `text-[#6b5a4b]` |
| 標籤、值 | `text-stone-700`／`800` | `text-[#3c2415]` |
| 標題 | `text-stone-900` | `text-[#2c221e]` |
| 停用／未點亮 | `text-stone-400` | `text-[#7c6a58]` |
| 邊界 | `border-stone-200`／`300` | `border-[#d6c7ab]` |
| 分隔線 | `border-stone-100`／`divide-stone-100` | `#e8dcc4` |
| 更強的邊界（左側 4px 條、鎖定徽章外框） | `border-stone-400` | `border-[#7c6a58]` |
| 輸入框底 | `bg-stone-50`／`100` | `bg-[#fbf7ee]`／`bg-[#f4ebd9]` |
| 區塊底 | `bg-stone-200`／`300`／`500` | `#e8dcc4`／`#d6c7ab`／`#7c6a58` |
| 遮罩層 | `bg-stone-900/60` | `bg-black/60` |
| **深底上的淺色字** | `text-stone-200` | `text-[#f7f3e8]`（例外，見下） |

### 四、唯一一個例外，也是唯一一個「同 class 兩種修法」

`text-stone-200` 全站 1 處，在 `ArcanistManager.jsx:339`，住在一塊**深底面板**裡：

```
<div className="… bg-[#2c221e] text-[#f7f3e8] border border-[#6b5a4b] …">
```

在那裡它不是「灰字」，是**淺色字**。對映到墨一階會變成墨上墨——不是低對比，是看不見。
所以它對映到那塊面板自己的文字色。

這是第十三輪那條教訓的第二次咬人：**同一個 class 在深底上的修法相反，而掃描器看不到背景色。**
處理方式不是跳過它，是**指名例外，並在護欄旁邊釘住它**（H10-b）。

### 五、護欄 117 → 118

- **H10 改寫**：從「零 `slate`」擴成「零五個灰家族」——
  `(?:…)-(?:slate|stone|zinc|neutral|gray)-\d{2,3}`。硬零值，不是預算。
- **H10-b 新增**：`ArcanistManager.jsx` 的 `text-[#f7f3e8]` 必須 **2 處**。

H10-b 不是為了湊數。只有 H10 的話，下一個人可以靠「**把深底面板也壓成淺色**」讓 H10 通過，
而那正是最省事的做法——H10-b 讓它變成紅的。

### 六、刻意破壞驗證（3 紅 ＋ 1 綠，另加 1 紅打新護欄）

| 破壞 | 結果 |
|---|---|
| `text-[#6b5a4b]` → `text-stone-600` | 紅 ✓ |
| `bg-black/60` → `bg-stone-900/60` | 紅 ✓ |
| 同一錨點 → `text-slate-600`（驗舊的一半） | 紅 ✓ |
| `text-stone-500` 寫進**註解** | 綠 ✓（反向對照） |
| `text-[#f7f3e8]` → `text-[#2c221e]`（壓平深底） | 紅 ✓（H10-b） |

第三條是這一輪特有的：**擴充護欄要驗舊的一半**，否則「變嚴」與「換掉」在綠燈下無法分辨。

### 七、對照

`scratch/ui-audit/stone/`：

- `before-760.png` / `after-760.png`（旅人・忠實夥伴編輯窗，SSR 注入）
- `compare-crop.png`（720×816，名字欄＋物種瓷磚＋四大屬性方案＋屬性下拉）

全幅看起來「兩張幾乎一樣」——那仍然是這筆債的樣子。裁到表單上，輸入框邊界由中性灰
變成 `#d6c7ab`、輸入框底由灰白變成 `#f4ebd9` 內凹槽，差別才成立。
before 來自**整份 `src` 快照**（`scratch/ui-audit/bak/src17/src`，153 檔）。

### 八、本輪數字

- `stone` 令牌：**526 → 0**（26 檔 → 0 檔），殘留閘門 0 檔。
- 五個灰家族合計：**0 處／0 檔**。
- 相異 hex：**241 → 241**，零新增零消失。
- 護欄：**117 → 118**；`npm test` exit 0、`npm run build` ✓ 5.03s、
  `syntax_check.mjs` 144 檔 0 錯。

### 九、剩下的債（本輪重量）

| 項目 | 處／檔 |
|---|---|
| 同伴目錄色相令牌（**不含灰**，14 檔） | **806** |
| 全站色相令牌（Tailwind 色相家族） | **2,266** |
| `text-[Npx]` 任意字級 | **812 / 66** |

同伴目錄前五：`TinkererGadgetsQuickRef` 116、`ArcanistManager` 83、`AceOfCardsTable` 75、
`GourmetCookbook` 74、`WayfarerCompanionModal` 68。

⚠️ **不要拿 806 去對「1,225」**。那兩個數字量的不是同一件事：1,225 是第十三輪用
**含灰 ＋ 15 檔（含 `TinkererWorkshop`）**的口徑量的；806 是**只數色相家族、同伴目錄 14 檔**。
本輪把同一棵樹（`bak/src17/src`）用兩支正則各量一次，得到的是：

| 口徑 | 掃描前 | 掃描後 |
|---|---|---|
| 色相家族（14 個家族） | **806** | **806**（未動） |
| 灰家族（5 個家族） | **328** | **0** |
| 合計 | **1,134** | **806** |

**806 ＋ 328 ＝ 1,134**，兩個數字各有基準，而且相加對得上——所以「同伴表的債還有 806」
是一個可以被下一輪直接拿來當起點的量測，不是一句形容。

---

## 8.19 第十八輪實測：同伴表的裝飾色（2026-10-23）

### 一、這一輪的起點

第十七輪結尾留下的「同伴目錄色相 806／14 檔」不是一句形容，是一個可以接著量的起點。
本輪第一件事是把它拆成**家族 × 職責**，而不是直接開始掃。

### 二、拆開之後看到的事實

`amber` 在**四個**同伴檔裡是主色相（紙牌、阿爾卡納、食譜、小工具）、`emerald` 在**三個**
（幻獸、花匠追蹤、花匠預覽）、`cyan` 在**兩個**（載具編輯、載具戰鬥頁）。

**同一個色相被四個身份共用 → 它不可能是身份 → 它是裝飾。**

### 三、本輪收掉的範圍

只收「單色相」六檔，共 **211 處**：

| 檔案 | 收掉 | 主色相 → 登記色 |
|---|---|---|
| `ChanterComposer.jsx` | 57 | purple → `#5e387c` |
| `PilotVehicleModal.jsx` | 50 | cyan → `#27527a` |
| `FloristGardenTracker.jsx` | 35 | emerald → `#245c45` |
| `PilotVehicleCombatSheet.jsx` | 32 | cyan → `#27527a` |
| `FloristGardenPreview.jsx` | 22 | emerald → `#245c45` |
| `NecromancerMinionSheet.jsx` | 15 | rose → `#8c2d36` |

### 四、刻意不收的範圍（與理由）

剩下 8 檔的色相裡混著**真的語意**：小工具四學派、紙牌花色、食譜分類、
阿爾卡納牌組階級、幻獸／旅人物種色。機械對映會把「兩張不同的牌」壓成「兩張一樣的牌」。
那 8 檔要**逐檔讀語意**，不是一支正則能決定的。

### 五、量測（本輪）

| 項目 | 前 | 後 |
|---|---|---|
| 同伴目錄色相令牌 | **806／14 檔** | **595／8 檔** |
| 全站色相家族令牌 | **2,266** | **2,055** |
| 相異 hex（同一支正則，before/after 同口徑） | **201** | **201** |
| `#6b5a45`（漂移的墨三階） | 9 | **0** |
| `#f5efdf`（假面） | 2 | **0** |
| `test:uisystem` 斷言 | 118 | **121** |

⚠️ **201 不可與第十七輪的 241 相比**：兩次的正則口徑不同。同一個口徑量兩次才是有效的
before/after；**沒有基準的數字不能相加，也不能相減。**

### 六、護欄（三條互補）

- **H11 預算 ≤ 595**：剩下的 8 檔要逐檔判斷，所以只能是預算。天花板寫在「正確」不是「最少」。
- **H11-b 六檔硬零**：預算式護欄的弱點是**允許交換**，硬零不允許。
- **H11-c 色票白名單（18 色）**：手寫 hex 掃不到，只能靠白名單。

### 七、刻意破壞驗證

3 紅 ＋ 2 綠。關鍵是第 2 條：往**未收斂檔**加色相時，H11 紅而 **H11-b 必須綠**——
**兩條護欄如果同進同出，就等於只有一條。**

### 八、順手抓到的漂移

`NecromancerMinionSheet.jsx` 有 **9 處 `#6b5a45`**（墨三階是 `#6b5a4b`，只差一個字元）
與 2 處 `#f5efdf`。對比過關、肉眼一樣，所以活了下來——但它是漂移：
以後調墨三階永遠改不到它。已收 11 處。

### 九、殘債（下一輪起點）

同伴目錄 **595／8 檔**：`TinkererGadgetsQuickRef` 116、`ArcanistManager` 83、
`AceOfCardsTable` 75、`GourmetCookbook` 74、`WayfarerCompanionModal` 68、
`ChimeristManager` 65、`WayfarerCompanionSheet` 63、`TinkererGadgetsModal` 51。
這八檔要逐檔讀語意。另：`ArcanistManager.jsx:294` 仍是全站第二塊深底面板。

---

## 8.20 第十九輪實測：收斂會吃掉狀態（2026-10-23）

### 一、這一輪的起點

第十八輪留下的兩筆債裡，`ArcanistManager`（83 處）被歸在「要逐檔讀語意」那一組。
實際讀完的結論相反：**它沒有語意色**，那五個色相全部住在一塊深底面板裡，
講的是同一件事（「這張卡正在召喚中」）；面板外只剩單一色相的裝飾。

所以順序是「**先拆面板，再掃色相**」——面板不拆，分不出哪些色相是面板的。

### 二、全站最後一塊深底面板退場

`ArcanistManager.jsx:294`–`:347` 是 v5 之後唯一還活著的 `bg-[#2c221e]` 面板。
改成淺底卡片（面 `#fffdf9`、邊界與標題 `#27527a`、危險鈕 `#8c2d36`、
內凹槽 `#f4ebd9`／`#e8dcc4`），並把兩個未登記的紙色 `#fdfbf7` 換成 `#fffdf9`。

H10-b 這條護欄的宿主就是那塊面板，所以它**必須在同一次改動裡換形狀**：
先拆面板、晚一輪改護欄的話，中間那段時間護欄是紅的，而下一個人最省事的修法是
把深底加回去——**護欄會逼人把債還原**。

第一版換法是「`text-[#f7f3e8]` 全站 0 處」，跑出來 **6 處紅**。紅的是護欄的前提：
那支色票還是合法的（墨面淺字 6 處：抽屜標頭、書封、翻頁遮罩）。
最終形狀是「面板簽名」＋「深底只當晶片」兩條。

### 三、真正的發現：色相收斂會吃掉狀態

`bg-amber-600 hover:bg-amber-700` 兩端都 ≥ 500，機械對映後**雙雙變成 `#9c4d16`**。
按鈕宣告了回饋，回饋是空的。全站 **31 處**，其中 13 處是既有的
（`TinkererWorkshop` 的 `bg-[#a63d40] hover:bg-[#a63d40]`，更早某一輪留下的）。

三條既有護欄**同時看不到**它：令牌數照樣下降（hover 端本來也是令牌）、
`#9c4d16` 是登記色（白名單只問合不合法）、對比完全沒變（同一個 hex 對同一個底）。

> **一條只數令牌的護欄，對「兩個令牌變成一樣」完全無感——它的輸入是集合，不是配對。**

### 四、五個新 hex 的來源

不是第二套色系，是**既有模式的延伸**：`#a63d40 → #8c3235` 從第五輪就登記在案。
五個 hover 階照同一比例推（0.84／0.82／0.83）：
`#76252d`（紅）、`#1e4b39`（綠）、`#833f12`（橙）、`#214365`（藍）、`#4f2e67`（紫）。
它們講的是「同一個身份被按下去」，不是第六個身份。

### 五、護欄 121 → 123

| 編號 | 形狀 | 內容 |
|---|---|---|
| H10-b | 簽名（硬零） | `bg-[#2c221e]` 不與 `text-[#f7f3e8]` 同行 |
| H10-c | 形狀 | 實心 `bg-[#2c221e]` 必帶 `text-[#e8dcc4]`；帶 `/NN` 的遮罩不管 |
| H11 | 預算 | 595 → **512** |
| H11-b | 硬零 | 六檔 → **七檔** |
| H11-c | 白名單 | 18 → **23** 色 |
| H13 | 硬零（新增） | 全站零死 hover（base 與 hover 不得同值） |

H13 的判準刻意是「**有沒有換一個值**」而不是「有沒有寫 hover」：
`hover:border-[#d6c7ab]` 掛在 `border-transparent` 上（4 處）是真的回饋。
第一版偵測器沒分前綴，31 變成 35——**誤報會讓人把真的債一起關掉**。

### 六、刻意破壞 6 紅 ＋ 3 綠

兩組「同時確認另一條是綠」是重點：半透明深底 ＋ 淺字 → 只有 H10-b 紅；
實心深底換掉晶片字色 → 只有 H10-c 紅；未收斂檔加色相 → 只有 H11 紅。
**護欄之間如果同進同出，那它們其實只有一條。**

### 七、自己踩的坑

破壞驗證跑到一半用 `| Select-Object -First 6` 截斷輸出，PowerShell 關管線時把 node
一起殺了，而還原寫在「跑完之後」那一行——第 3 個案例的破壞被留在檔案裡，而且是綠的。

> **會寫檔的腳本，輸出要導到檔案再讀，不要截斷管線。**

### 八、量測

| 項目 | before | after |
|---|---|---|
| 同伴目錄色相 | 595／8 檔 | **512／7 檔** |
| 全站色相家族（同口徑） | 2,247 | **1,953** |
| 死 hover | 31／9 檔 | **0** |
| 深底面板 | 1 | **0**（`bg-[#2c221e]` 剩 7 行：3 淡底＋2 遮罩＋2 晶片） |
| `test:uisystem` | 121 | **123** |

全站 2,247 → 1,953 的差 **294** ＝ 第十八輪 211 ＋ 第十九輪 83，可對帳。
⚠️ 第十八輪紀錄寫的 2,266 → 2,055 與這一對**不同基準**，不可互相加減。

全量：`npm run build` ✓ 5.13s、`syntax_check.mjs` 144 檔 0 錯、`check:agents` 31,128 bytes。

### 九、殘債（下一輪起點）

同伴目錄 **512／7 檔**：`TinkererGadgetsQuickRef` 116、`AceOfCardsTable` 75、
`GourmetCookbook` 74、`WayfarerCompanionModal` 68、`ChimeristManager` 65、
`WayfarerCompanionSheet` 63、`TinkererGadgetsModal` 51——全部是真的身份系統
（四學派／紙牌花色／食譜分類／物種色），要逐檔讀語意。

**新發現**：`src/components/ui/FUIcon.jsx` 的九相屬性對照表用 Tailwind 色相令牌
（`風` → `text-cyan-700`、`電` → `text-amber-600`、`土` → `text-amber-800`…）。
九相是封閉的九個身份，用色相是對的，但那些色票**沒有登記**，也沒有護欄看著它。
→ **已於第二十輪完成**（見 §8.21）：九個 hex 登記、五條護欄、40 處令牌歸零。

另：`text-[Npx]` 812／66 檔、`hover:scale-` 62 處、`CharacterEditor` 三色紅綠燈、
`TinkererWorkshop` 兩個 `EmptyState` 尚無護欄。

## 8.21 第二十輪實測：撞色不是「剛好同色」（2026-10-23）

### 8.21.1 對象

`src/components/ui/FUIcon.jsx` 的 `FU_ICON_MAP`——全站最大的一個**身份用色系統**：
九相 × 3–4 個別名 ＝ **40 處色相令牌／9 種**（cyan-700 4、amber-600 7、indigo-950 3、
amber-800 7、red-700 7、blue-700 3、fuchsia-800 3、purple-700 3、red-600 3）。

**第二份拷貝**：`src/features/npc-workshop/data/constants.js` 的 `TYPE_STYLES`——
同樣十個條目、同樣三組撞色，**9 處色相令牌**（物理本來就是 hex）。

### 8.21.2 舊表的三組撞色

| 撞色 | 舊值 |
|---|---|
| 電 ≡ 光 | `text-amber-600` |
| 火 ≡ 攻擊性咒語 | `text-red-700` |
| 土 ≡ 其餘行動 | `text-amber-800` |

撞色的意思不是「兩個身份剛好同色」，是**其中一個身份消失了**：
看到兩個一樣顏色的字，讀者學到「這兩個是同一類」。

### 8.21.3 現值（九相九色，兩兩不同）

| 相 | hex | 色相角 | 飽和度 | 明度 | 三面最低對比 |
|---|---|---|---|---|---|
| 物理 | `#404a58` | 215° | 16% | 30% | 7.58:1 |
| 風 | `#245c45` | 155° | 44% | 25% | 6.59:1 |
| 電 | `#5a6b00` | 70° | 100% | 21% | 5.01:1 |
| 暗 | `#5e387c` | 274° | 38% | 35% | 7.60:1 |
| 土 | `#5c4a26` | 41° | 51% | 28% | 7.20:1 |
| 火 | `#a63d40` | 358° | 46% | 45% | 5.27:1 |
| 冰 | `#27527a` | 209° | 52% | 32% | 6.89:1 |
| 光 | `#9c4d16` | 25° | 75% | 35% | 5.09:1 |
| 毒 | `#8c2d6a` | 321° | 51% | 36% | 6.57:1 |

新增三個（電／土／毒），六個沿用登記色。三面＝`#fbf7ee`／`#f4ebd9`／`#fffdf9`。
`TYPE_STYLES` 十個條目與上表**逐一相等**（物理 `#404a58`、攻擊性咒語 `#8c2d36`）。

### 8.21.4 兩組例外（靠飽和度分，不是色相角）

- 光 h25° s75% ↔ 土 h41° s51%　差 16°（Δs 24／Δl 10）
- 冰 h209° s52% ↔ 物理 h215° s16%　差 6°（Δs 36）

其餘七組相鄰距離 ≥ 29°。例外寫在 `FUIcon.jsx` 的註解與護欄旁邊。

### 8.21.5 分類標籤不是身份

近戰／遠程／咒語／其餘行動 → 墨 `#3c2415`；攻擊性咒語／危機 → 危險紅 `#8c2d36`。
語意由字形（m r c s o w）承擔；上色只會讓同一句話裡出現四五種顏色。

### 8.21.6 護欄

`test:uisystem` **123 → 131**：

| 護欄 | 判準 |
|---|---|
| H14 | `FUIcon.jsx` 零 Tailwind 色相令牌 |
| H14-b | 九相 → 九個相異色 |
| H14-c | 同一相的所有別名同色 |
| H14-d | 只用登記過的十一色 |
| H14-e | 十一色 × 三面 ≥ 4.5:1 |
| H14-f | `TYPE_STYLES` 與 `FU_ICON_MAP` 同色（值相等，不是色票白名單） |
| H14-g | `TYPE_STYLES` 十個條目零色相令牌（只掃那個宣告） |

刻意破壞（`scratch/ui-audit/affinity_break.mjs`）：**7 紅 ＋ 3 綠**，
每一條紅都附「另一條必須是綠」的反向確認。
※ 加上 H14-f 之後，兩個原本是綠的反向對照**變成紅**——「只改一份」從無害變成真的漂移，
綠案例因此改成兩份一起改，破壞套件也改成支援多檔操作。

### 8.21.7 量測

- 全站色相家族（同一支正則、同一範圍）：**1,953 → 1,904**（差 49 ＝ FUIcon 40 ＋ TYPE_STYLES 9，可對帳）。
- `FUIcon.jsx`：40 → **0**；`TYPE_STYLES`：9 → **0**。
- 同伴目錄不動：**512 處／7 檔**。
- `test:uisystem` **131/131**、`npm test` exit 0、`npm run build` ✓ 5.00s、
  `syntax_check.mjs` 144 檔 0 錯。
- 截圖：`scratch/ui-audit/hue/affinity-before-760.png`／`affinity-after-760.png`／
  `compare-affinity.png`；`typestyles-before-900.png`／`typestyles-after-900.png`／
  `compare-typestyles.png`。

### 8.21.8 殘債（下一輪的起點）

- 同伴目錄 **512／7 檔**（同上節，全部是真的身份系統）。
- 全站仍有 **1,904** 處色相家族令牌；**尚未登記的身份用色系統**至少還有三個：
  `StatBadge.jsx` 的四屬性（封閉的四個身份，形狀與九相相同）、
  `constants.js` 的 `AFFINITY_STATES`（五種相性狀態，各一組三階）、
  `ErrorBoundary.jsx` 的警示色。
- `text-[Npx]` 812／66 檔、`hover:scale-` 62 處、`CharacterEditor` 三色紅綠燈、
  `TinkererWorkshop` 兩個 `EmptyState` 尚無護欄。
- 可能還有第三、第四份「九相對照表」的拷貝：這一輪只靠 `grep fuIcon` 找到一份，
  下次應該用「九相的十個中文鍵同時出現在一個檔案」當搜尋條件。

## 8.22 第二十一輪實測：同一個身份，三個顏色（2026-10-23）

### 8.22.1 病

四屬性的顏色有五份拷貝、三種映射。DEX 在角色卡是 `amber-800`、在 NPC 工坊是 `blue-800/900`、
在旅人夥伴是 `amber-600/700`。INS 在旅人夥伴還叫「直覺」、MIG 叫「體質」。

| 出處 | DEX | INS | MIG | WLP |
|---|---|---|---|---|
| `StatBadge.jsx` | `amber-800` | `blue-800` | `red-800` | `emerald-800` |
| `NPCWorkshop.jsx:2097`／`:2642` | `blue-800` | `emerald-800` | `red-800` | `purple-800` |
| `NPCWorkshop.jsx:3160-3163` | `blue-900` | `emerald-900` | `red-900` | `purple-900` |
| `WayfarerCompanionModal.jsx:384…` | `amber-600` | `blue-600` | `red-600` | `purple-600` |
| `WayfarerCompanionSheet.jsx:184…` | `amber-700` | `blue-700` | `red-700` | `purple-700` |

### 8.22.2 修法

`sourcebookConfig.js` 新增 `ATTRIBUTE_COLORS`（`dex`／`ins`／`mig`／`wlp` → `text-[#hex]`），
五個消費端全部改成引用。**這是真的 import，不是鏡像**——字面量集中在一個被 Tailwind 掃到的
`.js` 檔裡，消費端只引用常數。`TYPE_STYLES` 之所以是鏡像，是因為它把 hex 拼進 class 字串裡。

### 8.22.3 色票

| 屬性 | hex | h | s | l | 三面最低對比 |
|---|---|---|---|---|---|
| 靈巧 DEX | `#336327` | 108° | 43 | 27 | 6.00 |
| 洞察 INS | `#216163` | 182° | 50 | 26 | 6.00 |
| 意志 WLP | `#3d458f` | 234° | 40 | 40 | 7.25 |
| 力量 MIG | `#91259d` | 294° | 62 | 38 | 6.00 |

對比帶 6.00–7.25，落在九相的 5.01–7.60 之內（兩組身份會同卡相遇，帶不同會讓一組看起來更重）。
相鄰色相距離 74°／55°／58°／173°。與九相靠飽和度分開兩組：意志 234° ↔ 物理 215°（Δs 24）、
力量 294° ↔ 暗 274°（Δs 24）。

**四屬性一律避開紅家族**（`#a63d40`／`#8c2d36`／`#76252d`）：強調色講「這裡可以按」，
屬性色講「這是哪一個」。同一個訊號不能同時講兩件事。

### 8.22.4 護欄

`test:uisystem` **131 → 138**：

| 護欄 | 擋什麼 |
|---|---|
| H15 | 單一來源（解析 `export const ATTRIBUTE_COLORS = Object.freeze({…})`） |
| H15-a | 一對一（四個 hex 兩兩不同） |
| H15-b | 形狀硬零（屬性那一行不得出現色相令牌，去註解後掃全 `src`） |
| H15-c | 四個消費端都必須 **import** 自 `sourcebookConfig` |
| H15-d | 三種面上都 ≥ 4.5:1 |
| H15-e | 不得同值，且距強調色家族 ≥ 20° |
| H15-f | 與九相每色距離 ≥ 20° 或 Δs ≥ 20 |

### 8.22.5 刻意破壞

**7 紅 ＋ 2 綠**。第一版有 **2 個假綠**：紅③（破壞點打在沒有屬性字面量的那一行）與
紅④（H15-c 寫成 `.includes('ATTRIBUTE_COLORS')`，換成同名常數照樣綠）。
兩條都改成「認形狀」之後才真的紅。

### 8.22.6 順手修掉

- `StatBadge` 與 NPC 屬性卡拿掉 `shadow-sm`：改成紙底 ＋ 邊框後，陰影是第三層噪音
  （既有護欄紅 2 處，改程式不調上限）。
- `ReadOnlySkill.jsx:122`／`NPCWorkshop.jsx:2313` 的 `text-blue-900` → `#8c2d36`（登記的攻擊性咒語色）。
- 同兩行的命中修正值 `text-amber-700` → 墨色（量不借色相）。
- `ChimeristManager.jsx:227/234` 的公式晶片 `bg-emerald-600` → `bg-[#3c2415]`（狀態，不是身份）。

### 8.22.7 量測

- 全站色相家族：**1,904 → 1,858**（−46）。
- 同伴目錄：**512 → 500**（7 檔不變）。
- `test:uisystem` **138/138**、`npm test` exit 0、`npm run build` ✓ 5.28s、
  `syntax_check.mjs` 144 檔 0 錯、`check:agents` 31,128 bytes。
- 截圖：`scratch/ui-audit/hue/stat-before-crop.png`／`stat-after-crop.png`／`stat-compare.png`。

### 8.22.8 殘債（下一輪的起點）

- 同伴目錄 **500／7 檔**（`TinkererGadgetsQuickRef` 116、`AceOfCardsTable` 75、
  `GourmetCookbook` 74、`WayfarerCompanionModal` 64、`ChimeristManager` 61、
  `WayfarerCompanionSheet` 59、`TinkererGadgetsModal` 51）。
- 未登記的身份用色系統：`AFFINITY_STATES`（5 狀態 × 3 階，帶底色晶片）、
  `constants.js` 的反派階級（purple／red／fuchsia 三組 800/400/50）。
- `NPCWorkshop.jsx:3192` 的「已自定義」晶片與 `:3222` 的選定骰仍是 amber（狀態）。
- `text-[Npx]` **812／66 檔**；`rounded-lg`／`rounded-xl` 與 2px 半徑上限的落差**尚未量測**。
- `CharacterEditor` 的三色紅綠燈與 `hover:scale-` 62 處未動。

## 8.23 第二十二輪實測：狀態是序，不是身份（相性狀態收斂，2026-10-23）

### 8.23.1 起點與判準

§8.22.8 的第二條殘債：`AFFINITY_STATES`（五種相性狀態 × 三階）未登記。
這一輪判定它的性質是**序**而不是身份，所以顏色只准承擔極性（2 個），程度交給文字（5 個）與形狀（3 種）。

三次處理的對照：

| 輪次 | 對象 | 顏色該做什麼 | 護欄 |
|---|---|---|---|
| 第二十輪 | 九相屬性（封閉、一對一） | 九個互不相同的色相 | 一對一硬性要求 |
| 第二十一輪 | 四屬性（封閉身份） | 四個互不相同的色相 | 一對一 ＋ 距離 ＋ 避開強調色 |
| **第二十二輪** | **五狀態（序）** | **只講極性（紅／綠）** | **反向上限 ≤ 2 色相家族** |

### 8.23.2 新表（`constants.js`）

```js
normal: { label: '一般', bar: 'bg-[#e8dcc4]', chip: 'border-transparent bg-transparent text-[#6b5a4b]',            ink: 'text-[#6b5a4b]' },
vul:    { label: '弱點', bar: 'bg-[#8c2d36]', chip: 'border-[#8c2d36] bg-[#8c2d36] text-[#fffdf9]',                ink: 'text-[#8c2d36]' },
res:    { label: '抗性', bar: 'bg-[#245c45]', chip: 'border-[#d6c7ab] bg-[#fffdf9] text-[#6b5a4b]',                ink: 'text-[#245c45]' },
imm:    { label: '免疫', bar: 'bg-[#245c45]', chip: 'border-[#245c45] bg-[#fffdf9] text-[#245c45]',                ink: 'text-[#245c45]' },
abs:    { label: '吸收', bar: 'bg-[#245c45]', chip: 'border-[#245c45] bg-[#245c45] text-[#fffdf9]',                ink: 'text-[#245c45]' },
```

三個欄位的職責：`bar` 左側 4px 極性條（磚）、`chip` 晶片（文字程度）、`ink` 純字色（摘要標題、分頁）。

### 8.23.3 對比（實測，五階 × 面三階的最低值）

| 狀態 | 晶片字色 | 對比 |
|---|---|---|
| 一般 | `#6b5a4b` on `#fffdf9` | 6.48:1 |
| 弱點 | `#fffdf9` on `#8c2d36` | 8.13:1 |
| 抗性 | `#6b5a4b` on `#fffdf9` | 6.48:1 |
| 免疫 | `#245c45` on `#fffdf9` | 7.68:1 |
| 吸收 | `#fffdf9` on `#245c45` | 7.68:1 |

舊表最響的一格是**一般**（12.18:1），比四個例外（8.15–8.57）都重；新表倒過來。

### 8.23.4 護欄

`test:uisystem` **138 → 145**，新增 H16 區段 7 條：

| 編號 | 內容 |
|---|---|
| H16 | 五階齊備（5 個鍵 × 3 個欄位） |
| H16-a | 狀態表零色相令牌 |
| H16-b | 只用登記色票（`REGISTERED_HEX.size` 動態取值） |
| H16-c | 形狀硬零：狀態鍵與色相令牌不得同行（掃全 `src`，去註解） |
| H16-d | 標籤純中文 |
| H16-e | 晶片對比 ≥ 4.5:1 |
| H16-f | **反向上限**：彩色色相家族 ≤ 2 |

刻意**不設一對一**：`res`／`imm`／`abs` 共用 `#245c45` 是設計。

### 8.23.5 刻意破壞

**7 紅 ＋ 2 綠**（`scratch/ui-audit/state_break.log`）。逐條：

| 案例 | 紅在哪 |
|---|---|
| 刪掉 `abs` 一列 | 五階齊備（＋晶片對比，耦合正確） |
| `normal.bar` → `bg-stone-200` | 表零色相令牌（＋行零色相令牌） |
| `vul.ink` → `#a8323a` | 只用登記色票（＋極性色相，第三家族） |
| 別的檔案塞狀態鍵＋色相令牌 | **只有**行零色相令牌 |
| `vul.label` → `弱點 VUL` | **只有**標籤純中文 |
| `res.chip` 字色 → `#b9a894` | **只有**晶片對比 |
| `imm.ink` → `#7a4a12` | **只有**極性色相 |
| 綠①：`res.ink` → `#3c2415` | 全綠 |
| 綠②：色相令牌只在註解裡 | 全綠 |

### 8.23.6 量測

- 全站色相家族 **1,858 → 1,810**（−48）。
- 三個消費端殘留 **425**（`constants.js` 9、`NPCWorkshop.jsx` 379、`NPCCardPreview.jsx` 37）。
- `test:uisystem` **145/145**；`npm test` exit 0；`npm run build` ✓ 5.25s；
  `syntax_check.mjs` 144 檔 0 錯；`check:agents` 31,128 bytes。
- 截圖：`scratch/ui-audit/shots/state-compare.png`（2,102×1,734）。

### 8.23.7 截圖工具的三次安靜失敗

| 症狀 | 真正的原因 |
|---|---|
| `openWorkshop` 逾時，錯誤指向「建立新 NPC」 | 空庫時入口叫「建立第一位 NPC」 |
| `clickText('4. 能力', { exact: true })` 永遠 not found | 側欄按鈕 `innerText` 是 `"4\n4. 能力"` |
| 兩張截圖 MD5 相同、腳本零抱怨 | `Lv.5` 時免疫／吸收是 `disabled`，點不到 |

修法：把驗收寫進腳本（作用中分頁邊框必須離開 `#d6c7ab`；選中的磚必須離開未選中樣態），
且判準不釘死顏色——before 版 active 是紅與琥珀、after 版是墨色，兩版都要拍得出來。

### 8.23.8 殘債（下一輪的起點）

- 相性無關的色相殘留：`VILLAIN_TIERS`（purple／red／fuchsia）、`NPCCardPreview` 技能來源徽章
  （amber／emerald／red／purple 四組）。
- `NPCWorkshop` 的「已自定義」晶片、選定骰、相性配置標題、獎勵晶片仍是 amber；`:3348` 仍是 purple。
- `ErrorBoundary.jsx` 的 amber 警示色盤（狀態，不是身份）。
- `CharacterEditor` 三色紅綠燈、`hover:scale-` 62 處。
- `text-[Npx]` **812／66 檔**；半徑（`rounded-lg`／`rounded-xl` vs 2px）**尚未量測**。
- `TinkererWorkshop.jsx` 的 `EmptyState`（第十一輪改的）**沒有護欄**。

## 8.24 第二十三輪實測：反派階級是刻度，不是顏色（卡片色相收斂，2026-10-23）

### 8.24.1 起點與判準

§8.23.8 的第一條殘債：`VILLAIN_TIERS`（purple／red／fuchsia）與 `NPCCardPreview` 的技能來源徽章
（amber／emerald／red／purple）。這一輪判定兩者性質不同——**反派階級是序，技能來源是出處**——
而當時的寫法把兩者都當成身份在塗色。

三條依序問下來的判準：

1. 它是身份、序，還是出處？
2. 這張卡的身份色已經被誰佔走了？→ **物種主題**（`SPECIES_THEMES.accent`／`currentTheme.accentDark`）
3. 不是身份就不准帶身份色。

四次處理的對照：

| 輪次 | 對象 | 是什麼 | 顏色數量 | 護欄 |
|---|---|---|---|---|
| 第二十輪 | 九相屬性 | 封閉、一對一 | 9 | 一對一硬性要求 |
| 第二十一輪 | 四屬性 | 封閉身份 | 4 | 一對一 ＋ 距離 ＋ 避開強調色 |
| 第二十二輪 | 五狀態 | 序 | 2（極性） | 反向上限 ≤ 2 家族 |
| **第二十三輪** | **反派階級／技能來源／數值** | **序／出處／量** | **1／0／0** | **單調性 ＋ 預算上限** |

### 8.24.2 新表（`constants.js`）

```js
export const VILLAIN_TIERS = {
  "none":    { up: 0,  label: "非反派",   ink: "text-[#6b5a4b]", chip: "border-transparent bg-transparent text-[#6b5a4b]" },
  "minor":   { up: 5,  label: "次要反派", ink: "text-[#8c2d36]", chip: "border-[#d6c7ab] bg-[#fffdf9] text-[#8c2d36]" },
  "major":   { up: 10, label: "主要反派", ink: "text-[#8c2d36]", chip: "border-[#8c2d36] bg-[#fffdf9] text-[#8c2d36]" },
  "supreme": { up: 15, label: "最終反派", ink: "text-[#8c2d36]", chip: "border-[#8c2d36] bg-[#8c2d36] text-[#fffdf9]" }
};
```

舊的 `color`／`border`／`bg` 三欄位刪除（全站 0 處殘留 `tier.color|border|bg`），
新的 `ink` 是純字色、`chip` 是晶片。

填充階（`borderRank + bgRank`，無權重）：

| 階級 | 邊框 | 底 | 秩 |
|---|---|---|---|
| 非反派 | `transparent` | `transparent` | 0 |
| 次要反派 | `#d6c7ab`（中性） | 未填 | 1 |
| 主要反派 | `#8c2d36`（極性） | 未填 | 2 |
| 最終反派 | `#8c2d36`（極性） | `#8c2d36` | 3 |

### 8.24.3 為什麼填充階不是對比度

`contrast(A,B) == contrast(B,A)`。主要反派（紅框白底）與最終反派（紅框紅底）在亮度上
是同一件事——差別是**面積**（多少像素是紅的）。所以「響度」不能是純量，
必須是**兩個維度的秩相加**。這是全檔第一條「單調性」護欄（H17-d），
方向與 H14-b／H15-a 的一對一相反。

### 8.24.4 技能來源：顏色整體退出

`badgeClass` 從五段 `let` 疊寫提成常數，四個分支只准改 `badgeLabel` 與 `icon`：

```js
let badgeLabel = '特殊規則';
const badgeClass = 'bg-[#eee6d3] text-[#3c2f21] border-[#d6c7ab]';
let icon = '';
```

辨識改由圖示承擔：✦ 客製化／❖ 定位技能／★ Boss 技能／✕ 負面技能（全在軌道 3 封閉詞彙表內）。
理由：「這是哪一種技能」已經有標籤在講了，顏色不帶額外資訊。

順手修掉一個真的 bug：攻擊性咒語的 `fu-icon` 是 `text-red-600`（未登記 hex），改 `text-[#8c2d36]`。

### 8.24.5 卡片數值區：標籤三級、數值一級

| 角色 | 墨階 |
|---|---|
| 數值（`18`／`12`／`9`／`7`） | `#2c221e` |
| 區塊標題（咒語／能力／咒語書／技能列／戰術方針） | `#3c2415` |
| 標籤、圖示、提示語、危機值 | `#6b5a4b` |
| hover | `hover:text-[#2c221e]` |

### 8.24.6 護欄

`test:uisystem` **145 → 153**，新增 H17／H18 區段 8 條：

| 編號 | 內容 |
|---|---|
| H17 | 四階齊備（4 鍵 × 3 欄位）＋ `up` 嚴格遞增 |
| H17-a | 反派表零色相令牌 |
| H17-b | 只用登記色票（`REGISTERED_HEX.size` 動態取值，現為 23） |
| H17-c | 標籤純中文（`/[A-Za-z（）()]/`） |
| H17-d | **單調性**：填充階 0→1→2→3 |
| H17-e | 三階 `ink` 全等 `#8c2d36`，非反派用墨且 ≠ 極性 |
| H17-f | 晶片對比 ≥ 4.5:1（4 階 × 面三階） |
| H18 | 全站「同族底色＋字色」行數 ≤ **216**（只能減） |

**H18 是新發現的第五種作弊法**：`bg-red-100 text-red-900` 寫在同一行 className 裡，
既不進任何表、也不是拷貝——它就是「用顏色當身份」本身。實測 **216 行／33 檔**（三件套另計 182）。

### 8.24.7 刻意破壞

**9 紅 ＋ 2 綠**（`scratch/ui-audit/tier_break.log`，11 個案例）。逐條：

| 案例 | 紅在哪 |
|---|---|
| `major` 鍵改壞 | 四階齊備＋遞增（通過 149） |
| `major.up` 10 → 5 | 同上 —— `0、5、5、15` |
| `minor.ink` → `text-purple-800` | **只有**表零色相令牌 |
| `none.chip` 字色 → `#123456` | **只有**登記色票 |
| `minor.label` → `次要 Boss` | **只有**標籤純中文 |
| `major` 框退回 `#d6c7ab` | **只有**填充階（`none=0、minor=1、major=1、supreme=3`） |
| `major.ink` → `#5e387c` | **只有**三階 ink 全等（`#5e387c` 是登記色，H17-b 綠） |
| `minor` 字色 → `#d6c7ab` | **只有**晶片對比（`1.64:1`） |
| 新增一行 `bg-red-100 text-red-900` | **只有** H18（`217 / 預算 216`） |
| 綠①：`major.chip` 多 `font-bold` | 全綠（填充階不變） |
| 綠②：`none.ink` → `#3c2415` | 全綠（仍是墨、仍非極性） |

**形狀與極性是兩條獨立的軸**：紅⑥ 只動形狀、紅⑦ 只動顏色，兩條護欄互不代勞。

### 8.24.8 工具坑：收斂做得越好，錨點越難找

紅⑦ 第一次跑出 `find 命中 2 次`——`major` 與 `supreme` 的列都以
`ink: "text-[#8c2d36]", chip: "border-[#8c2d36]` 開頭。**同一個家族的列本來就該長得像**，
所以逐字替換的錨點必須往**差異處**延伸（拉到 `bg-[#fffdf9]`），不是往共同處延伸。

### 8.24.9 量測

- 全站色相家族 **1,810 → 1,755**（−55）。
- 相性狀態三個消費端 **425 → 370**（`constants.js` 9 → 0、`NPCCardPreview.jsx` 37 → 0、
  `NPCWorkshop.jsx` 379 → 370）。
- 全站「同族底色＋字色」**216 行／33 檔**；三件套 **182**。
- `test:uisystem` **153/153**；`npm test` exit 0；`npm run build` ✓ 5.18s；
  `syntax_check.mjs` 144 檔 0 錯；`check:agents` 31,128 bytes。
- 截圖：`scratch/ui-audit/shots/tier-compare.png`（3,196×2,034）、
  `scratch/ui-audit/shots/tier-live.png`（1,318×1,210）。

### 8.24.10 殘債（下一輪的起點）

- `NPCWorkshop.jsx` 仍有 **370** 處色相令牌；H18 的 216 行裡它佔 29 行。
- **fuchsia 是全站唯一「只出現在鎖定語意」的家族**：`NPCWorkshop:472`／`:477`／`:2226`／`:2228`／`:2248`
  （物種鎖定徽章）、`FreeModeConfirmModal:20`、`SectionAccordion:26`。要嘛全部收斂成極性，
  要嘛全部登記成「鎖定」的身份色——目前是第三種狀態：三個寫法、沒有判準。
- `ErrorBoundary.jsx:53`–`:88` 的 amber 警示色盤（狀態，不是身份）。
- `CharacterEditor` 三色紅綠燈、`hover:scale-` 62 處。
- `text-[Npx]` **812／66 檔**；半徑（`rounded-lg`／`rounded-xl` vs 2px）**尚未量測**。
- `TinkererWorkshop.jsx` 的 `EmptyState`（第十一輪改的）**沒有護欄**。

## 8.25 第二十四輪實測：一個色相家族，三種語意（fuchsia 全滅，2026-10-23）

### 8.25.1 病灶

`fuchsia` **48 個令牌／6 個檔案**，但它在這 6 檔裡承擔**三種互不相干的語意**：

| 語意 | 判定欄位 | 消費端 | 令牌數 |
|---|---|---|---|
| 祕技（標記） | `skill.isSecretArt` | `ReadOnlySkill.jsx`、`EditableSkill.jsx`、`NPCWorkshop.jsx`（咒語卡）、`SpellCard.jsx` | 21 |
| 自定義模式（模式） | `state.isFreeModeEnabled` | `FreeModeConfirmModal.jsx`、`NPCWorkshop.jsx`（切換鈕與提示條） | 24 |
| 解鎖限制計數（量） | `isFreeMode` ＋ `current` | `SectionAccordion.jsx`（`n/∞` 徽章） | 3 |

`npcTextExport.js` 是純文字匯出，`constants.js` 本來就是 0——所以「6 檔」不是 8 檔。

### 8.25.2 三條具名通道

| 語意 | 通道 | 逐字 |
|---|---|---|
| 標記 | 符號詞彙 ＋ 墨階 | `text-[10px] text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab] px-1 rounded font-normal` ＋ `※ 祕技` |
| 模式 | 登記強調色 | `#a63d40`（框／圖示／主要動作底）＋ hover `#8c3235` |
| 計數 | 墨階晶片 | `text-[10px] text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab] px-2 py-0.5 rounded-full` |

**沒有新增任何 hex。** `#a63d40`／`#8c3235` 都是第二輪就登記的色票。

### 8.25.3 護欄

| 編號 | 內容 | 形狀 |
|---|---|---|
| H19 | `src/` 全站 fuchsia 家族令牌**硬零**（含 `hover:`／`focus:`／`border-[lrtbxy]`／`/opacity` 變體） | 硬零 |
| H19-a | 三條替代通道必須真的存在：`※ 祕技` 恰好 **3 檔**；`FreeModeConfirmModal.jsx` 同時含 `border-[#a63d40]` 與 `bg-[#a63d40]`；`SectionAccordion.jsx` 含 `text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab]` | 反向控制 |

刻意破壞驗證 **6/6（4 紅 2 綠）**，日誌 `scratch/ui-audit/h19_break.log`。
綠①綠②刻意是「合規但不同」而不是「一模一樣」。

### 8.25.4 量測

| 指標 | 第二十三輪 | 第二十四輪 |
|---|---|---|
| fuchsia 令牌 | 48／6 檔 | **0** |
| 全站色相家族 | 1,755 | **1,692**（−63） |
| 相性狀態三消費端（`constants.js`＋`NPCCardPreview.jsx`＋`NPCWorkshop.jsx`） | 370 | **357** |
| 三件套（bg＋text＋border 同家族）行數 | 182 | **179** |
| 雙件套（bg＋text 同家族）行數（H18 預算 213） | 216 | **213** |
| `test:uisystem` 斷言 | 153 | **155** |
| `animate-bounce` | 6 | **5** |
| `animate-pulse` | 2 | 2 |

> ⚠️ `animate-pulse` 只剩 **2 處**（`BookCoverHub.jsx:30`、`CombatantCard.jsx:164`）。
> 舊文件裡的「26 處」是沒有重量的歷史數字。

### 8.25.5 驗證

- `npm test` **exit 0**；29 道關卡全綠，`test:uisystem` **155/155**。
- `npm run build` **exit 0**。
- `node scratch/ui-audit/syntax_check.mjs` 144 檔 0 錯。
- 對照圖 `scratch/ui-audit/shots/fuchsia-compare.png`（2,360×2,432，三列 × 前後）：
  before 由 `scratch/ui-audit/before24/` 的**備份檔**真的渲染出來，逐字命中 7/7 舊字串；
  after 由 `src/` 現行元件渲染，fuchsia **0**、`※ 祕技` 存在。
- 現場圖 `scratch/ui-audit/shots/fuchsia-live.png`（1,257×807，真頁面的確認窗）：
  框線 `2px rgb(166,61,64)`、確認鈕 `rgb(166,61,64)`／字 `rgb(255,253,249)`、
  副標「解除規則限制」`12px`、對話框內紫紅殘留 **0**。

### 8.25.6 剩餘債

- `purple` **124**／`violet` **29**／`indigo` **85** 個色相令牌，本輪一個都沒動。
  三族要各自回答「它承擔幾種語意」，不能一起收。
- `text-[Npx]` **812 處／66 檔**（`NPCWorkshop` 56、`GourmetCookbook` 51、`CharacterEditor` 46、
  `AceOfCardsTable` 38、`TinkererGadgetsQuickRef` 36、`EquipmentPickerModal` 34、
  `ZeroPowerBlock` 34、`ClassSkillCard` 29、`WayfarerCompanionModal` 28）。
- `ErrorBoundary.jsx:53`–`:88` 的 amber 警示色盤（狀態，不是身份）。
- `CharacterEditor` 三色紅綠燈、`hover:scale-` 62 處。
- 半徑（`rounded-lg`／`rounded-xl`／`rounded-2xl` vs 2px 上限）**仍未量測、無護欄**。
- `TinkererWorkshop.jsx` 的 `EmptyState`（第十一輪改的）**沒有護欄**。
- `NPCWorkshop.jsx` 約 25 行三件套；`animate-bounce` 剩 5 處（`SectionAccordion:37` 等）。

---

## 8.26 第二十五輪：保留色（purple／violet／indigo）

### 8.26.1 三族收斂（`stripComments` 後掃全 `src/`，含前綴變體）

| 家族 | 輪前 | 輪後 | 剩下的在哪 |
|---|---|---|---|
| `purple` | 107／12 檔 | **6／2 檔** | `speciesThemes.jsx`（MONSTER）＋ `JRPGBadge.jsx`（職業徽章） |
| `indigo` | 85／10 檔 | **6／2 檔** | `speciesThemes.jsx`（UNDEAD）＋ `JRPGBadge.jsx`（規則書徽章） |
| `violet` | 29／3 檔 | **0** | — |

剩下的 12 個令牌全部是**身份出口**（封閉身份表的一格），不是裝飾。
`JRPGBadge.jsx` 是身份徽章的**註冊表**（第十五輪裁定 `badgeVariant` 保留），
`speciesThemes.jsx` 是八物種的封閉身份集。

### 8.26.2 五條替代通道

| 語意 | 通道 | 逐字 |
|---|---|---|
| 區塊容器 | 紙（零色） | `bg-[#f9f5eb] border border-[#d6c7ab]` |
| 選中／展開 | 墨框＋紙底 | `bg-[#f4ebd9] border-[#3c2415]`／`border-[#3c2415] bg-[#fffdf9]` |
| 量（MP／IP／魔防） | 墨階晶片 | `text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab]` |
| 出處（公式八階） | 零色＋標籤 | 八階同一個 chip，唯一例外 `status` 帶危險紅 `#8c2d36` |
| 標記（公測） | 符號＋墨階 | `△ 公測`（`△` 取自封閉詞彙） |
| 分類（學派） | 文字 | `<span className="font-normal text-[#7c6a58]">{sp.school}</span>` |

**本輪新增 hex：0。**

### 8.26.3 護欄

| 編號 | 內容 | 形狀 |
|---|---|---|
| H20 | `violet` 全站硬零（含 `hover:`／`border-[lrtbxy]`／`/opacity` 變體） | 硬零 |
| H20-a | `purple`／`indigo` 只准出現在兩個身份出口（檔案級白名單） | 白名單＋硬零 |
| H20-b | 物種表一對一：八物種 → 八個相異色 | 集合大小 |
| H20-c | `StatFormulaPanel` 八階齊備、`chip` 值 ≤ 2、`status` 帶危險紅 | 集合大小＋極性 |
| H20-d | `△ 公測` 恰好 2 檔 | 反向控制 |
| H20-e | MP 晶片三件套**逐一**同一行（以 MP 文字行為錨往上看 `<span>`） | 逐一斷言 |
| H21 | 造物工坊三個空狀態走 `EmptyState`，文案在元件 220 字元內 | 形狀 |
| H22 | `animate-bounce` 全站硬零 | 硬零 |

刻意破壞 **13/13（10 紅 3 綠）**，日誌 `scratch/ui-audit/r25_break.log`。

### 8.26.4 量測

| 指標 | 第二十四輪 | 第二十五輪 |
|---|---|---|
| 全站色相家族 | 1,692／47 檔 | **1,457／46 檔**（−235） |
| 雙件套（bg＋text 同家族，H18） | 213 | **180**（預算同步降到 180） |
| `text-[Npx]` | 812／66 檔 | **814／65 檔**（本輪未動，814 是實測值） |
| `text-[10px]`／`text-[11px]` | 424／480（預算） | **371／403** |
| `hover:scale-` | 51（文件寫 62） | **51**（預算 62 → 51） |
| `animate-bounce` | 5 | **0** |
| `test:uisystem` 斷言 | 155 | **163** |

對帳（20 個被改動的檔案，含前綴變體正則）：**−236**（purple −101、indigo −79、violet −29、
amber −11、red −7、emerald −4、rose −4、cyan −1）。與全站 −235 差 1 是正則邊界差異。

### 8.26.5 驗證

- `npm test` **exit 0**（29 道關卡），`test:uisystem` **163/163**。
- `npm run build` **exit 0**（✓ 9.54s）。
- `node scratch/ui-audit/syntax_check.mjs` **144 檔 0 錯**。
- 本輪**沒有截圖**：改動只有「刪色相、換紙墨」，零佈局變動；驗收改用逐行對帳表 ＋ 13 案破壞。

### 8.26.6 剩餘債

- **`amber` 827 處**（本輪結尾實測），至少五種語意（物種 BEAST／狀態警示／已自定義／音調標籤／
  反派填充階）。判準沿用本輪的保留色。
- `blue`／`cyan`／`emerald` 也各被物種表登記一格，同時又是通用「資訊／成功」色。
- `ErrorBoundary.jsx:53`–`:88` 的 amber 警示五階（狀態）未動。
- `CharacterEditor` 三色紅綠燈、`hover:scale-` 51 處未分類。
- `text-[Npx]` 814／65 檔。
- 半徑：設定層是 2–6px（`lg`／`xl` = 3px、`2xl` = 4px、`3xl` = 6px），
  「2px 上限」在渲染層並不成立。實測 `rounded-lg` 436、`rounded-xl` 236、`rounded-ui` 232、
  `rounded-full` 98、`rounded-md` 43、`rounded-2xl` 30。

---

## 8.27 第二十六輪：`amber` 收斂（保留色判準的第二次套用）

### 8.27.1 開場實測

| 家族 | 令牌 | 檔案 | 階 |
|---|---|---|---|
| `amber` | 828 | 43 | **十一階**（50／100／200／300／400／500／600／700／800／900／950） |
| `yellow` | 6 | 1 | `TinkererGadgetsQuickRef` |
| `orange` | 4 | 1 | `NPCWorkshop`「過多的 Boss 技能」 |

合計 **838**，佔全站殘餘色相令牌 1474 的 **57%**。按「同一行的令牌組合」聚類得到
**164 種行簽名**——一個色相有 164 種用法，就不可能還是「一個」意思。

### 8.27.2 判準與分類

先問「`amber` 被哪張身份表登記走了」：`speciesThemes` 的 `sp_beast`（BEAST），
以及 `JRPGBadge` 的 `amber:` 變體（六本規則書的第一本，§CI33 已接受的出口）。
→ `amber` 是**保留色**，其餘語意不得再借。

逐行讀完 164 個簽名，`amber` 實際在當**八種**語意：

| 語意 | 例子 |
|---|---|
| 身份 | 物種 BEAST、規則書 #1 徽章 |
| 警示 | 崩潰、開發警告、不支援的職業、Boss 技能超額、區塊未完成 |
| 選中／展開 | 選中卡框、展開天賦、當前步驟、拖曳經過 |
| 量 | 星等、可選格圓點、解鎖等級、本職等級合計 |
| 標記 | 已自定義、`※ 祕技`、`預設體質`、`✦` |
| 出處 | 系統／自訂技能左側色條、分類圓點 |
| 主動作 | 匯出、儲存、重試、確認（`bg-amber-700` 42 處的主體） |
| 裝飾 | 桂冠浮水印、龍頭圖示、插圖、底線、發光 |

### 8.27.3 十條通道（零新增 hex）

| 原語意 | 落點 |
|---|---|
| 身份 | 保留 `amber`（白名單兩檔，逐行） |
| 警示 | **零色 ＋ `▲`／`GiHazardSign`**：`bg-[#f9f5eb] border-[#d6c7ab]` ＋ 墨左條 |
| 崩潰 | 危險極性 `#8c2d36` |
| 選中／展開 | 墨框 `#3c2415` ＋ 紙底 `#f4ebd9`／`#fffdf9` |
| 量 | 四階墨（`#2c221e`／`#3c2415`／`#6b5a4b`／`#7c6a58`） |
| 標記 | 既有符號 ＋ 墨階 |
| 出處 | 零色：系統 `#7c6a58`／自訂 `#3c2415` |
| 主動作 | 登記強調 `#a63d40`（hover `#8c3235`、active `#76252d`） |
| 容器 | 紙 `#f9f5eb`／`#f4ebd9`／`#e8dcc4` |
| 焦點 | 墨框 `#3c2415` |

執行方式：**逐令牌全域對映**（118 條規則、40 檔、811 令牌），乾跑驗證「未對映 0 個」才落盤；
其餘 27 個人工（兩個白名單 8 ＋ `ErrorBoundary` 19）。另跑一趟 hex 收斂 44 處
（`#b45309` 29、`#f59e0b` 3、`#fef3c7` 3、`#fffbeb` 3、`#fcd34d` 2、`#451a03` 2、
`#92400e` 1、`#fde68a` 1），並把 54 處強調底上的 `text-white` 換成 `#fffdf9`。

### 8.27.4 三個暖強調色（本輪發現）

| 色 | 出現 | 身分 | 本輪處置 |
|---|---|---|---|
| `#a63d40` | 131 | **登記**強調色 | 承接所有主動作 |
| `#8b5e34` | 85 | 書頁棕（離開鈕、EmptyState 主鈕、hover 框） | **未動**，用預算 141 鎖住 |
| `#b45309` | 29 | **`amber-700` 的 hex 形式**（`theme?.accent ||` 預設值） | **收掉 → `#a63d40`** |

### 8.27.5 收斂塌掉的三元式（語意損失，逐個人判）

| 位置 | 在分什麼 | 修法 |
|---|---|---|
| `NPCWorkshop` 天賦卡左條 | 系統／自訂 | 出處通道：`#7c6a58`／`#3c2415` |
| `NPCWorkshop` 天賦卡邊框 | `amber-300`／`400` | 刪三元式（框不承擔出處） |
| `NPCWorkshop` `Lv.` 徽章 | `amber-700`／`800` | 統一 `#3c2415`（出處已由左條承擔） |
| `ReadOnlySkill` 分類圓點 | 四種 → Boss／其他同值 | 塌成兩種：法術／祕技 `#3c2415`、其餘 `#7c6a58` |

另刪三處假分支（`isMonarch`、`isSecretArt`、`customDesc` 兩邊同值）。
**護欄抓不到這四處**——它只抓「兩邊完全同值」，抓不到「兩邊不同但意思一樣」；
那四處是逐行讀出來的。

### 8.27.6 收尾數字

| 指標 | 開場 | 收尾 | 差 |
|---|---|---|---|
| `amber` | 828 | **6** | −822 |
| `yellow` | 6 | **0** | −6 |
| `orange` | 4 | **0** | −4 |
| 三家族合計 | **838** | **6** | **−832** |
| 全站色相令牌 | 1,474 | **637** | **−837** |
| 有令牌的檔案 | 46 | **36** | −10 |
| `rose` | 85 | 80 | −5 |
| `text-[10px]` | 371／424 | 371 | 0 |
| `hover:scale-` | 51／51 | 51 | 0 |
| 雙件套（H18） | 93／180 | 93 | 0 |
| `test:uisystem` 斷言 | 163 | **169** | +6 |

對帳：832 ＋ 5（rose）＝ **837** ＝ 全站差值，**零殘差**。
收尾 6 個令牌：`speciesThemes` 3 ＋ `JRPGBadge` 3，兩個出口各一行。

### 8.27.7 新增六條護欄

| # | 護欄 | 形狀 |
|---|---|---|
| H23 | amber／yellow／orange 只留兩個出口 | 硬零 ＋ 檔級白名單 |
| H23-a | 白名單檔裡 amber 只准在那一行 | **逐項** |
| H23-b | 琥珀原始 hex 十階硬零 | 硬零 |
| H23-c | 琥珀發光 rgba 硬零 | 硬零 |
| H23-d | 書頁棕 `#8b5e34`＋`#78350f` ≤ **141** | **預算（零餘裕）** |
| H23-e | 強調底上的字是 `#fffdf9` | 硬零 |

H23-d 破例用預算，因為退化模式是「**替代**」而不是「多一個」——§CI33 的
「預算制不適用」是對保留色說的，對「替代目的地」預算才是唯一抓得住的形狀。

### 8.27.8 驗證

- `npm test` **exit 0**，`test:uisystem` **169/169**。
- `npm run build` **exit 0**（✓ 22.98s）。
- 故意破壞 **9/9**（6 紅 3 綠），每案指名失敗並逐位元組還原。
  綠②（在白名單那一行內把 `amber-50` 換成 `amber-100`）證明 H23-a 是**行級**而非檔級白名單。
- **沒有截圖**：零佈局變動。但本輪有一個肉眼可見的風險（警示變得不顯眼），
  那個風險不該用截圖驗，應該實跑一次壞掉的區塊——列為下一輪第一條。

### 8.27.9 剩餘債

- **警示可讀性未實測**（CI34.4 是設計推理，不是量測）。要驗三個真實情境。
- **`red` 214／25 檔**：物種 DEMON ＋ 危險極性 ＋ HP 條 ＋ 刪除鈕 ＋ 錯誤訊息。
  比 `amber` 麻煩，因為它的「危險」用途是真的危險，不能收成零色。
- `emerald` 187（PLANT＋成功）、`blue` 30（HUMANOID＋資訊）、`cyan` 29（ELEMENTAL）、
  `teal` 28、`sky` 10——同一個病，量更小。
- **書頁棕 141 處**只鎖了預算，沒有分類；「合併還是分工」要有一個答案。
- `theme?.accent ||` 這種「沒主題就給暖色」的模式還在（現在指向 `#a63d40`）。
- `text-[Npx]` 371／65 檔、半徑（`lg` 436／`xl` 232／`ui` 242）、`hover:scale-` 51——三條未動。
- `MNEMOSPHERE_BEAD_TINTS`：11 個身份的色票全是未登記 hex，本輪只換了 `指揮官` 一格。

---

## §8.28　第二十七輪：`red`／`rose`／`pink` 收斂（§CI35 的可查版）

### 8.28.1 開場實測

| 家族 | 含註解 | 去註解（真正的活數） | 檔案 |
|---|---|---|---|
| `red` | 214 | **202** | 25 |
| `rose` | 80 | **80** | — |
| `pink` | 5 | **5** | 1 |
| 合計 | 299 | **287** | 33 |

差 12 全在註解裡（`chapterChrome.js` 檔頭表格、`EmptyState.jsx` 說明註解）。
行簽名聚類：**76 種**。角色分佈：`text` 155／`border` 74／`bg` 66／`ring` 4。

### 8.28.2 判準

三張身份表登記了紅 → 紅是保留色。

| 身份表 | 那一格 |
|---|---|
| `speciesThemes.jsx` | `sp_demon` |
| `JRPGBadge.jsx` | `rose:`（硃砂紅主題 ＋ 公測修訂規則書，**兩個消費者**） |
| `GourmetCookbook.jsx` | `甜味:`（兩行） |

### 8.28.3 十二條通道（零新增 hex）

| 原用法 | 落點 |
|---|---|
| 物種 DEMON／硃砂紅主題／公測規則書／甜味 | 不動（四行） |
| 危機徽章 | `variant="danger"`：紙底 ＋ `#8c2d36` 字 ＋ 50% 框 |
| 錯誤訊息／刪除鈕／HP 條 | `#8c2d36`（hover `#76252d`） |
| 冠位／精英／一般 | `rank-top`／`rank-mid`／`slate`（**序**：填充量） |
| 裝備「職業」限定 | `variant="marker"`（**標記**：零色） |
| 敵方數量晶片 | `variant="slate"`（**量**：墨） |
| 資源磚 HP／MP／IP | 紙底 `#f9f5eb` ＋ `#d6c7ab` 框 ＋ 四階墨（**量**） |
| 紅光暈 | 刪除 |

### 8.28.4 `JRPGBadge` 變體 10 → 14

| 新變體 | 值 | 消費端 |
|---|---|---|
| `danger` | `bg-[#f9f5eb] text-[#8c2d36] border-[#8c2d36]/50` | 危機 ×3 |
| `rank-top` | `bg-[#2c221e] text-[#e8dcc4] border-[#2c221e]` | 冠位 ×2 |
| `rank-mid` | `bg-[#7c6a58] text-[#fbf7ee] border-[#7c6a58]` | 精英 ×2 |
| `marker` | `bg-transparent text-[#6b5a4b] border-[#6b5a4b]/40` | 職業 ×6（3 處元素 ＋ 3 處物件） |

`variant="rose"` 的 7 個呼叫端全部改走上面四個（危機 3／冠位 2／職業 4，其中職業含物件形式）。
`rose:` 那一行本身保留，只服務兩張身份表。

### 8.28.5 三個順手收掉的死東西

| 東西 | 位置 | 數量 | 為什麼是死的 |
|---|---|---|---|
| `LOG_KINDS[*].tone` | `characterLog.js` | 13 個色相名 | `CharacterLogModal` 只讀 `label`／`icon`／`coalesce` |
| `CHAPTER_METAS[*].color` | `App.jsx` | 4 個色相名 | 消費端只讀 `title`／`subtitle`／`icon`／`number` |
| `--codex-*` 第二色系 | `index.css` | 46 個顏色宣告 | `var()` 讀取端只有 2 處，且 fallback 與值相同；`[data-codex-theme]` 無人設定 |

`index.css` 11,899 → **10,408 bytes**。

### 8.28.6 收尾數字

| 指標 | 開場 | 收尾 | 差 |
|---|---|---|---|
| `red` | 202 | **6** | −196 |
| `rose` | 80 | **0** | −80 |
| `pink` | 5 | **4** | −1 |
| 三家族 | **287** | **10** | **−277** |
| `emerald` | 187 | 184 | −3 |
| `green` | 31 | 30 | −1 |
| `blue` | 29 | 24 | −5 |
| 全站色相令牌 | 623 | **337** | **−286** |
| 有令牌的檔案 | 36 | **27** | −9 |
| 登記色票 | 23 | 23 | 0 |
| 護欄 | 169 | **176** | +7 |

對帳 277 ＋ 3 ＋ 1 ＋ 5 ＝ 286，零殘差。
§CI34.9 的 637 本輪**無法重現**（同腳本對 `HEAD` 量到 623），差 14，不採用。

### 8.28.7 新增七條護欄

| 編號 | 形狀 | 內容 |
|---|---|---|
| H24 | 硬零＋白名單 | 紅家族令牌只准在三張身份表的四行 |
| H24-a | 逐項（行） | 白名單檔每一行紅令牌都必須以該表鍵開頭 |
| H24-b | 硬零（逐行＋出口） | 33 個紅家族原始 hex 只准在珠色身份表 |
| H24-c | 硬零 | 紅光暈 rgba |
| H24-d | 集合歸屬 | 呼叫端 `variant` 名稱必須登記過（防靜默 fallback 成金色） |
| H24-e | 逐項（元素） | 危機＝`danger`、職業＝`marker`、冠位＝`rank-top/mid/slate` |
| H24-f | 預算 10（只減） | 紅家族令牌總數天花板 |

### 8.28.8 驗證

- `npm test` exit 0（31 支全綠，`test:uisystem` **176/176**）
- `npm run build` exit 0（✓ 23.73s）
- `syntax_check.mjs` 144 檔 / 0 錯
- 故意破壞 **7/7**（第一次跑 4/7，因為錨點落在註解裡被 `stripComments` 吃掉）

### 8.28.9 剩餘債

- 警示／危機的可讀性**仍未實測**（第二次列）
- `emerald` 184 ＋ `green` 30 = **214**（身份 PLANT ＋ 成功；成功沒有替代符號）
- `blue` 24／`cyan` 29／`teal` 28／`sky` 10
- `JRPGBadge` 仍有 8 個色相變體，其中 `green` 與 `emerald` **值完全相同**（死變體）
- 書頁棕 141（未動）
- 珠色身份表 11 格未登記（本輪正式承認它為 H24-b 的出口）
- `theme?.accent ||` 模式仍在
- `text-[Npx]` 371／半徑／`hover:scale-` 51 未動
- `body` 的兩個 `radial-gradient`（α 0.03）算不算違反「禁止漸層」，未判

---

## §8.29　第二十八輪：警示的可讀性（§CI36 的可查版）

### 8.29.1 開場實測（看圖，不是推理）

腳本 `scratch/r28_shot.mjs`：`renderToStaticMarkup` → 靜態 HTML 引 `dist/assets/*.css` → `chrome --headless=new --screenshot`。

| 情境 | 形狀 | 讀得出來 |
|---|---|---|
| `ErrorBoundary` inline | 紙底＋細框＋方形圖示磚＋紅色「重試載入」按鈕 | **是** |
| `ChapterDevWarningModal` | 紙底＋細框＋方形圖示磚＋粗體標題＋WIP 徽章 | **是** |
| Boss 技能超額 | 紙底＋`rounded-xl`＋裸的 `AlertTriangle`（沒有磚）＋粗體標題 | **否** |

「定位不在本版資料裡」那一則更糟：它用的 `GiSparkles` 跟步驟 1 導言**是同一顆圖示**，
連 class 都一樣——不是「像」，是幾乎逐位元組相同。

三個讀得出來／讀不出來的差別只有一個：**有沒有方形圖示磚**。

### 8.29.2 判準：不是顏色不夠，是形狀沒有所有權

`NPCWorkshop` 8 個「步驟 N：…」導言穿著 `bg-[#f5efdf] border-l-4 border-[#3c2415] p-4 rounded …`，
所以「紙底＋左條＋粗體標題」在畫面上等於「章節導言」，不等於「這裡有事」。
§CI34 的零色取捨是對的；它沒解決問題，是因為零色之後警示只剩形狀，而形狀被別人穿走了。

### 8.29.3 兩處修改

| 檔案 | 改動 |
|---|---|
| `NPCWorkshop.jsx` | 8 個步驟導言脫框（純 `<h3>` ＋ `<p>`）；3 個警示遷 `WarningNote`；「已選定弱點」`text-emerald-800` → 墨階＋`✓` |
| `SectionAccordion.jsx` | 額度溢出橫幅遷 `WarningNote tone="danger"` |
| `WarningNote.jsx`（新） | 紙底＋1px 框＋7×7 方形圖示磚；`note` 零色相／`danger` 用登記危險紅 `#8c2d36` |

左條**不給**警示，理由有二：語意上左條已被「出處」用掉；實作上 `border` 與 `border-l-4`
是同一個 CSS 屬性，實測 `.border{` offset 24075 < `.border-l-4` offset 24401，
「左條會生效」目前是靠 Tailwind 產出順序的巧合，不是規則。

### 8.29.4 收尾數字

| 指標 | 開場 | 收尾 | 差 |
|---|---|---|---|
| 步驟導言有框 | 8 | **0** | −8 |
| 舊行內警示形狀 | 2 | **0** | −2 |
| `border-l-4`（全部＝出處） | 3 | **3** | 0 |
| `WarningNote` 呼叫端／使用次數 | 0 | **2／4** | +2／+4 |
| 全站色相令牌 | 337 | **336** | −1 |
| 有令牌的檔案 | 27 | **27** | 0 |
| 登記色票 | 23 | **23** | **0（零新增 hex）** |
| 護欄 | 176 | **181** | +5 |

337 → 336 的那 1 個是副作用：`NPCWorkshop` 的「已選定弱點」由 `text-emerald-800` 改墨階。
`src/` 裡唯一的 `▲` 字元是 `EquipmentPickerModal.jsx:692` 的排序方向指示，**不該改**（假線索，已在 §CI36.11 註明）。
警示面該量的是「有沒有磚」：遷移前 4 處警示 2 處有磚、2 處沒有；遷移後 4 處全部有磚。

### 8.29.5 新增五條護欄

| 編號 | 形狀 | 內容 |
|---|---|---|
| H25 | 元素級（逐項） | 步驟導言不得有 `bg-[#`／`border`（抓包住「步驟 N：」的開標籤） |
| H25-a | 硬零 | 兩個舊行內警示 class 字串全站為零 |
| H25-b | 集合大小（恰好 3） | `border-l-4` 只在三處出處（少一處也算退化） |
| H25-c | 反向控制 | `WarningNote` 四件套（`data-warning-note`／`GiHazardSign`／`w-7 h-7`／兩種語氣）＋ ≥2 呼叫端 |
| H25-d | 硬零 | `WarningNote` 自身零色相令牌 |

### 8.29.6 驗證

- `npm test` exit 0（31 支全綠，`test:uisystem` **181/181**）
- `npm run build` exit 0（✓ 41.47s）
- 故意破壞 **7/7**（第一次 6/7：第②案把 `className` 折到上一行，行級護欄漏抓 → 改元素級後補上）
- 截圖 4 張；`r28-modal-before.png` 與 `after` 的 sha256 **完全相同**（`494dff0b…`），
  證明「量到讀得出來 → 刻意不動」

### 8.29.7 剩餘債

- `emerald` 184 ＋ `green` 30 = **214**（身份 PLANT ＋ 成功；**「成功」的替代符號仍未定義**）
- `blue` 24／`cyan` 29／`teal` 28／`sky` 10
- `JRPGBadge` 仍有 8 個色相變體，`green` 與 `emerald` 值完全相同（死變體）
- 書頁棕 141（未動）；珠色身份表 11 格未登記
- `theme?.accent ||` 模式仍在
- `text-[Npx]` 371／65 檔、半徑（`lg` 436／`xl` 232／`ui` 242）、`hover:scale-` 51——未動
- `body` 的兩個 `radial-gradient`（α 0.03）未判
- **新增**：全站「長得像警示」的東西沒有普查過（本輪只遷已知 4 處）。
  普查線索應該是「有沒有方形圖示磚」，不是 class 字串

### 8.30　第二十九輪：成功沒有顏色——`emerald`／`green` 213 → 10

**日期**：2026-10-24　**commit**：待補　**起點**：§CI36.13 第一條

**決策看板**：§CI37

#### 8.30.1 核心設計問題（使用者的回答）

成功狀態（已選定、已完成）在紙／墨體系裡該長什麼樣？
**答覆：`✓`（已存在於「已選定弱點」那行，現在全站化）。**

#### 8.30.2 開場實測與修正

§CI36.13 寫 214，實測 HEAD 為 **213**（`emerald` 183 ＋ `green` 30 ／ 20 檔）。
舊數字有 1 個累積誤差——為什麼每一輪都要自己量。

角色重疊：面板外殼＝選中容器，同一行兩種解釋都說得通 → 單純換色會錯。

#### 8.30.3 修法概要

- **面板脫漆**：`WayfarerCompanion*` + `ChimeristManager` 兩檔就佔 101 個令牌，全部改走紙／墨階。
- **成功改判**：`✓` ＋ 墨階（`#3c2415`／`#6b5a4b`）。
- **選中改判**：新語意變體 `selected`（墨框＋紙底）。
- **主動作改判**：`#a63d40` 註冊 accent，統一全站確認鈕。
- **量改判**：數值字全部走墨階。
- **換色引擎**：50 組 MAP ＋ 4 組白名單 ＋ 負向回顧 ＋ dry-run（殘留預期 10）。
- **203 換掉／19 檔；殘留 10／3 檔**。
- **6 個手動修復**（折疊三元 ＋ 相鄰未登記 hex）。
- **HP 條去綠**：`#245c45` 借色 → `#3c2415` 墨階（看圖發現，危機態已有文字標記，紅綠是重複編碼）。

#### 8.30.4 截圖假綠與像素驗證

- 第一次 before 是假圖：舊 JSX 配新 CSS，`bg-green-600` 被 purge → 按鈕消失。
  修正：還原 HEAD → build → 截 before → 還原改動 → build → 截 after。
- 腳本加自檢：原始碼 blob vs `HEAD:`、CSS sha 必須不同。
- 像素掃描（1,232,000 px）：
  - 綠相位 14,607 (1.19%) → **308 (0.025%)**
  - 明顯偏綠 (S≥30%) 14,533 → **274**
  - 最密 40×40 網格：639 → **20**（從實心色塊變邊緣散點）

#### 8.30.5 新增八條護欄

| 編號 | 形狀 | 內容 |
|---|---|---|
| H26 | 硬零＋白名單 | `emerald`/`green` 令牌只准在三張身份表的登記行 |
| H26-a | 逐項 | 白名單檔裡每個綠令牌都必須以該表的鍵開頭 |
| H26-b | 逐檔 | 21 個綠色原階 hex 只准在珠色身份表 |
| H26-c | 硬零 | 綠色 rgba 發光全站為 0 |
| H26-d | 反向控制 | 成功走 `✓`＋墨階，而且真的在用（≥10 處） |
| H26-e | 存在性 | `emerald` 死變體不准回歸，`selected` 必須存在 |
| H26-f | 預算 | 總數只減不增（預算 10） |
| H26-g | 硬零＋反向控制 | 同伴面板 HP 條不借翠玉色，兩端都要在 |

#### 8.30.6 驗證

- `npm test` exit 0（31 支全綠，`test:uisystem` **189/189**）
- `npm run build` exit 0
- 故意破壞 **10/10**（含 HP 條兩半：借色 ⑨、拔端 ⑩）
- 截圖 2 張，原始碼／CSS 各附雜湊自檢

#### 8.30.7 收尾數字

| 指標 | 開場 → 收場 |
|---|---|
| `emerald`/`green` 令牌 | 213／20 檔 → **10**／3 檔 |
| `green` 單獨 | 30 → **0** |
| 全站色相令牌 | 336／27 檔 → **133**／15 檔 |
| 護欄 | 181 → **189** |
| 成功通道（✓＋墨階）| — → **13** 處 |
| 綠色原階 hex（非珠色）| 0 → **0** |

#### 8.30.8 剩餘債

- `cyan` 29／`teal` 28／`blue` 24／`sky` 10（身份＋功能混用，比綠更難，因為沒有「成功」這種明確替代語意）
- `JRPGBadge` 仍有 7 個色相變體
- 書頁棕 141（未動）；珠色身份表 11 格未登記
- `REGISTERED_HEX` 護欄盲點（只掃 7 個同伴檔）
- `theme?.accent ||`、`text-[Npx]` 371、半徑、`hover:scale-`、`body` 的 radial-gradient——未動
- 全站「長得像警示」的普查（第二十八輪債，本輪未動）

#### 8.31 第三十輪（2026-10-24）：cyan／teal／blue／sky 91 → 6

#### 8.31.1 判準

只有 `speciesThemes` 的 `sp_element`（cyan）與 `sp_humanoid`（blue）是身份，其餘 85 個全是借色。沒有統一替代符號——靠紙／墨階與 accent `#a63d40` 分頭接管。

#### 8.31.2 修法

- **批量映射**：50 組 MAP（最長優先）＋ dry-run → 81 處自動替換／14 檔。
- **手動修復**：
  - `JRPGBadge.jsx` 刪除 `cyan` 死變體。
  - `AddCombatantModal.jsx`：3 處 `variant="cyan"` 改 `zinc`/`primary` + `bg-[#dbeafe]` 改 `bg-[#f4ebd9]`。
  - `EquipmentPickerModal.jsx`：`variant="cyan"`（盾牌）改 `marker`。
  - `CombatantCard.jsx`：`isPlayer ? 'cyan' : 'gold'` 改 `zinc`。
  - `NPCWorkshop.jsx`：戰術區塊 `#bfdbfe`/`#1e3a8a` 改紙墨。
- **味道系統**：`GourmetCookbook` 的 `鹹味`（sky）被引擎自動換成紙墨；四種味道現在都是同一套紙墨階。

#### 8.31.3 新增七條護欄

| 編號 | 形狀 | 內容 |
|---|---|---|
| H27 | 硬零＋白名單 | 冷色只准在 `speciesThemes` |
| H27-a | 逐項 | 白名單檔裡每個令牌都在登記行 |
| H27-b | 硬零 | 40 個藍綠原階 hex 全站為 0 |
| H27-c | 硬零 | 藍綠 rgba 發光全站為 0 |
| H27-d | 反向控制 | 身份表兩行都在 |
| H27-e | 存在性 | `cyan` 死變體不准回歸 |
| H27-f | 預算 | 總數只減不增（預算 6） |

#### 8.31.4 驗證

- `npm test` 全部通過（`test:uisystem` 196/196）
- `npm run build` exit 0
- 故意破壞 **8/8**

#### 8.31.5 收尾數字

| 指標 | 開場 → 收場 |
|---|---|
| `cyan`/`teal`/`blue`/`sky` 令牌 | 91／15 檔 → **6**／1 檔 |
| 全站色相令牌 | 133／27 檔 → **48**／3 檔 |
| 護欄 | 189 → **196** |
| 新增 hex | **0** |

#### 8.31.6 剩餘債

- `lime` 4／`pink` 4（味道系統的酸味／甜味，跟本輪 sky 同病）
- `JRPGBadge` 仍有 6 個色相變體（amber／rose／green／purple／indigo／slate）
- 書頁棕 141；珠色身份表 11 格未登記
- `REGISTERED_HEX` 護欄盲點（只掃 7 個同伴檔）
- `theme?.accent ||`、`text-[Npx]` 371、半徑、`hover:scale-`、`body` 的 radial-gradient——未動
- 全站「長得像警示」的普查（第二十八輪債，本輪未動）

#### 8.32 第三十一輪（2026-10-24）：lime／pink 8 → 0（味覺去色收尾）

#### 8.32.1 起點
第二十九輪殘債。實測 8 個 class 令牌／1 檔（GourmetCookbook 酸味/甜味，TASTE_COLOR+TASTE_DOT）。校正：第三十輪「四味皆紙墨」不實，本輪只補酸/甜；苦(emerald) 留 R32。

#### 8.32.2 判準
酸(lime)/甜(pink) 借色無語意，文字已辨味 → 去色走紙墨。

#### 8.32.3 修法
- `TASTE_COLOR` 酸/甜 → `bg-[#f9f5eb] border-[#d6c7ab] text-[#3c2415]`
- `TASTE_DOT` 酸/甜 → `bg-[#3c2415]`（墨）
- 8 處／1 檔，殘留 0。`technospheres` 珠表 hex 不屬本輪。

#### 8.32.4 護欄 H28 家族（196 → 198）
| 條號 | 形狀 | 內容 |
|---|---|---|
| H28 | 硬零 | lime/pink class 令牌全站 0 |
| H28-a | 反向控制 | 味覺表 酸/甜 兩項仍在 |

#### 8.32.5 驗證
- `npm test` 198/198，`npm run build` exit 0，破壞 1/1。

#### 8.32.6 收尾數字
| 指標 | 開場 → 收場 |
|---|---|
| lime/pink class 令牌 | 8／1 檔 → **0**／0 檔 |
| 全站色相令牌 | 48／3 檔 → **40**／3 檔 |
| 護欄 | 196 → **198** |

#### 8.32.7 剩餘債
苦味(emerald) + JRPGBadge 5 色相變體 → R32；書頁棕、珠表 11 未登記、REGISTERED_HEX 盲點、text-[Npx] 814、半徑 835、hover:scale- 45、radial-gradient 3 → R33–R38。

#### 8.33 第三十二輪（2026-10-24）：護欄自己也會瞎——`stripComments` 假綠

#### 8.33.1 起點（與計畫不符，重新界定範圍）
原計畫「苦味 + JRPGBadge 五變體」。實測發現 `JRPGBadge`／`speciesThemes` 的色相是護欄白名單裡的**合法身份出口**，不是債。真正問題：**H20 檢查全站不得有 purple，但 `NPCWorkshop.jsx:2125` 魔防寫著 `text-purple-800`，測試一路綠燈。**

#### 8.33.2 根因
`stripComments` 直接對全文跑正則，`accept="image/*"` 的 `/*` 被當成區塊註解開頭，吃到下一個 `*/`，把整段真實 JSX 塗白。護欄掃的是剝除後內容 → 假綠。該檔 `/*` 79／`*/` 78 不平衡，全站 7 檔不平衡。

**量測工具同病**：R30／R31 收尾腳本用同一個剝註解器，所以「全站 40」是被盲點算的，誠實值是 41（實測 fixed-strip 1 vs old-strip 0）。

#### 8.33.3 修法
- `stripComments` 改**單趟狀態機**：遇註解整段吃掉（換行以空白保留）、遇引號整段跳過。
  - 失敗的中間版本：先用佔位符遮字串再剝 → `technospheres.js` 的 JSDoc 內 ```` ```js ```` 圍欄被誤認字串，丟 6 個換行、行號位移。**順序錯，不是實作錯。**
- 魔防 `text-purple-800` → `text-[#2c221e]`（同排物防已是墨色）。
- 苦味 `bg-emerald-50…` → 紙墨；`bg-emerald-500` → `bg-[#3c2415]`。味覺 5/5 去色。

#### 8.33.4 護欄（198 → 205）
| 條號 | 形狀 | 內容 |
|---|---|---|
| H29 | 自檢 fixture | `image/*` ＋ 後續 `*/` ＋ 註解 purple ＋ 程式 purple → 剝除後只剩 1 |
| H29-a | 逐檔不變量 | 行號守恆（145 檔 0 位移） |
| H29-b | 逐行不變量 | 原始行有 `className="` → 剝除後該行仍有 |
| H29-c | 反向控制 | `image/*` ≥ 3 處仍在 |
| H29-d | 逐項 | 魔防屬性列無色相令牌 |
| H28-b | 逐項 | 味覺五項皆無色相令牌 |
| H28-c | 反向控制 | 味覺五項仍在 |

#### 8.33.5 驗證
- `npm test` **205**/205、`npm run build` exit 0。
- 故意破壞 **5/5**（sha256 全部一致）＋ **負向對照**：舊剝註解器＋purple 同時存在時，H20 家族**沒紅**（假綠實測再現），H29 紅了。

#### 8.33.6 收尾數字
| 指標 | 開場 → 收場 |
|---|---|
| 被塗白的真實 JSX | 有（約 50 行）→ **0** |
| 全站色相（誠實量測） | 41／3 檔 → **36／2 檔** |
| purple／emerald | 7／10 → **6／6**（全在兩張身份表） |
| 味覺去色 | 3/5 → **5/5** |
| 行號位移 | 未知 → **0／145** |
| 護欄 | 198 → **205** |

#### 8.33.7 剩餘債
`JRPGBadge` 15 個色相令牌是**身份調色盤**問題（要嘛整組改紙墨並改寫白名單，要嘛正式登記）→ R33；其餘結構債 → R34–R38。

#### 8.34 第三十三輪（2026-10-24）：徽章身份出口收斂——`JRPGBadge` 15 → 0

#### 8.34.1 起點（三個問題，不只借色）
1. 5 個身份變體帶色相（amber/rose/green/purple/indigo），15 個令牌。
2. **`blue` 主題靜默變金**：`badgeVariant: 'cyan'` 指向 R30 已刪的鍵，fallback 成 `gold`，與 `amber` 主題撞色。
3. **`slate` 一鍵兩義**：H24-e 定它是「序」第三階，`slate` 主題卻拿它當身份徽章。

> H24-d 只掃 JSX 字面值，掃不到 `theme.badgeVariant` 的間接引用——② 因此活了兩輪。

#### 8.34.2 判準
徽章內容是 `Lv N`；身份由 `accent`（頭像環／頁籤／圖示）承載。色相是重複編碼，且色相是 `speciesThemes` 七族的保留色。GM 裁決：「直接開，改成紙墨。」

#### 8.34.3 修法
- 刪 `gold/amber/rose/green/purple/indigo` 六鍵，新增 `ink`＝`bg-[#f9f5eb] text-[#3c2415] border border-[#d6c7ab] font-bold`；預設與 fallback 同步改 `ink`。
- `characterThemes` 六個 `badgeVariant` → `'ink'`；判決表該列改為「收斂成一個」。
- 字面 `variant="gold"` 2 處、三元式 `'gold'` 2 處 → `ink`。
- 保留 8 個變體：`ink`／`zinc`／`danger`／`rank-top`／`rank-mid`／`slate`／`marker`／`selected`。

#### 8.34.4 護欄（205 → 209）
| 條號 | 形狀 | 內容 |
|---|---|---|
| H30 | 硬零 | `JRPGBadge.jsx` 全檔零色相令牌 |
| H30-a | 集合大小 | 六個主題的身份樣式收斂成同一個值 |
| H30-b | 逐項 | `badgeVariant` 每個值都登記過（補 H24-d 間接引用缺口） |
| H30-c | 反向控制 | 8 個語意／序變體全在 |

#### 8.34.5 驗證
- `npm test` **209**/209、`npm run build` exit 0。
- 故意破壞 **4/4**（sha256 全一致）＋ **負向對照**：`badgeVariant: 'cyan'` → H30-b 紅、**H24-d 沒紅**（缺口實測存在）。
- 附帶收穫：收斂後 H24-d 抓出 2 處人工 grep 漏掉的 `gold`（藏在三元式）。

#### 8.34.6 收尾數字
| 指標 | 開場 → 收場 |
|---|---|
| `JRPGBadge` 色相令牌 | 15 → **0** |
| 身份變體 | 6（1 個失效）→ **1** |
| 全站色相 | 36／2 檔 → **21／1 檔** |
| 剩餘分佈 | 全部在 `speciesThemes`（7 物種 × 3） |

**里程碑**：全站色相第一次只剩一張登記表。

#### 8.34.7 剩餘債
舊白名單仍列 `JRPGBadge` 為色相出口，但該行已不存在 → 反而成為額外保護，不改。其餘結構債 → R34–R38。

#### 8.35 第三十四輪（2026-10-24）：色票登記表盲點——未登記 hex 149 → 83

#### 8.35.1 起點（比預期大一個量級）
原以為是「珠表 11 格未登記」的小補丁。實測：全站 **173 個不同 hex／6221 次**，其中 **149 個未登記（769 次）**。原因：「只用登記色票」那條護欄只掃 7 個同伴檔。

#### 8.35.2 分類方法
`max(|ΔR|,|ΔG|,|ΔB|) ≤ 12` **且** 色相差 ≤ 15°（或兩者近乎無彩）才算漂移。純 RGB 距離會誤判：`#f2f5f8`（冷灰）→ `#fbf7ee`（暖奶油）Δ 只有 10，色相差 168°。

| 群 | 內容 | 處置 |
|---|---|---|
| A 漂移 | 56 個／473 次 | 併回 |
| B 書頁棕 | `#8b5e34` 85 次等 | 不動（R38 待裁決） |
| C 珠表 | 23 鍵／22 色 | 登記 |
| D 工坊六套紙 | ~15 個 hex | 不動（需截圖驗證） |

#### 8.35.3 修法
- 併回 54 個漂移色 → 395 處／54 檔。
- 珠表 22 色加入 `REGISTERED_HEX`。
- 附帶修掉 4 處被併回**暴露**的既有缺陷：`SpellCard` 死三元式、`AttributeMatrixPicker`／`NPCWorkshop` 死 hover、`BookCoverHub` 的 `text-white`（原本藏在未登記的 `#8f3235` 後面）。
- `H23-e` 修正範圍：只看底色，不看 `hover:bg-[#…]`（否則封面那顆白字實心 accent 被誤判）。

#### 8.35.4 護欄（209 → 214）
| 條號 | 形狀 | 內容 |
|---|---|---|
| H31 | 預算 340（只減不增） | 全站未登記 hex 使用次數 |
| H31-a | 逐項 | 珠表全部 hex 已登記 |
| H31-b | 反向控制 | 珠表 23 鍵仍在 |
| H31-c | 硬零 | 無「Δ≤12 且色相接近」的未登記 hex |
| H31-d | 注入性 | 珠表一鍵一色、互不相異 |

#### 8.35.5 驗證
- `npm test` **214**/214、`npm run build` exit 0。
- 故意破壞 **4/4**（sha256 全一致）。

#### 8.35.6 收尾數字
| 指標 | 開場 → 收場 |
|---|---|
| 不同 hex | 173 → **129** |
| 未登記 | 149 個／769 次 → **83 個／340 次** |
| 登記色票 | 24 → **46** |
| 漂移 | 56 → **0** |
| 改動 | — → 55 檔／395 處 |

#### 8.35.7 剩餘債
`workshopThemes` 第二套紙系統（需截圖驗證）、書頁棕（待 GM 裁決）、其餘 83 個一次性色碼；`text-[Npx]` 814、半徑 835、`hover:scale-` 45、radial-gradient 3 → R35–R38。

#### 8.36 第三十五輪（2026-10-24）：第二套紙系統與 814 處任意字級

#### 8.36.1 開場量測
- `workshopThemes.js`：6 主題 × 15 欄位 ＝ **58 個 hex**（上一輪記成「約 15 個」，那是欄位數）。
- 其中 6 個欄位（`appBg`／`panelBg`／`headerBg`／`badgeBg`／`accentHover`／`accentLight`）**全站讀取次數為 0**——36 個 hex 從未上過畫面。
- 六個身份色（accent／accentDark）與 `characterThemes` **一字不差**。
- `text-[Npx]`：**814 處／65 檔**（`11px` 404、`10px` 371、其餘 39）。

#### 8.36.2 A 部分：投影
`workshopThemes.js` 改成 `CHARACTER_THEMES` 的投影，只輸出 `NPCWorkshop` 真正會讀的 9 個欄位 ＋ `id`。本檔 hex 58 → **0**。

`exportBg` 原本不在 `CHARACTER_THEMES`（SHARED 缺這個欄位），由 H32-d 在開發中抓到 → 補進 SHARED（`#fbf7ee`，未新增 hex）並納入 H7 的 `SURFACE_KEYS`。

#### 8.36.3 B 部分：登記微字階
- 新增 `t10: ['10px']`、`t11: ['11px']`，**刻意不設 lineHeight**（列高由 padding 決定，且與原 `text-[Npx]` 計算值完全相同）。
- 775 處 10／11px 原值不動；39 處漂移收斂（8／9→t10、13→t12、15→t14、17→t16、22→t20）。
- 全站 `text-[Npx]` 814 → **0**。

#### 8.36.4 截圖與守恆驗證
- NPC 卡片六主題的「大面積底色」：改前 **16 個相異色**（每主題一套紙）→ 改後 **6 個**（全部來自工坊外框，六主題相同）；六個 accent 仍各自不同。
- 字級桶計數守恆：同一畫面 116 個文字節點 → 116 個，只有 19 個換桶（9px→10px、22px→20px）。

#### 8.36.5 兩個假綠
1. 五條以**字面字串**比對的護欄（`text-[9px]`／`text-[10px]`／`text-[11px]`／9px 中文／句子低於 12px）在改寫成令牌後**全部靜默變綠**。負向對照證明舊判定看不見 `text-t10`。→ 改掃語法形狀 ＋ 地板 ＋ 反向控制。
2. dev server 的 Tailwind 設定是**啟動時快照**：改完 config 沒重啟，`text-t10` 沒有 CSS，元素回退成 16px。第一次的「改後」量測因此無效，重啟後重拍才對上。

#### 8.36.6 護欄 214 → 218
H32（投影檔零 hex）、H32-a（身份色逐項相同）、H32-b（紙逐項相同）、H32-c（六風格仍在）、H32-d（欄位齊備）、H33（零任意字級）、H33-a（地板 10px）、H33-b（微字階 ≥300 反向控制）、H33-c（<10px 不得回歸）。
故意破壞 **7/7**，sha256 全部一致。

#### 8.36.7 收尾數字
任意字級 814 → **0**；型階梯 7 → **9** 級；`workshopThemes` hex 58 → **0**；全站不同 hex 129 → **100**；未登記 hex 83／340 → **54／283**；改動 **70 檔**。

#### 8.36.8 剩餘債
半徑 835（R36）、`hover:scale-` 51＋漸層 7＋`theme?.accent ||`（R37）、書頁棕 141 次（待 GM 裁決，R38）、其餘 54 個未登記 hex。

#### 8.37 第三十六輪（2026-10-24）：圓角——一個值、四個名字

#### 8.37.1 開場量測
- 圓角類別 **1,492 處／82 檔**（上一輪殘債寫「835」——那是 `rounded`(398)＋`rounded-lg`(436)，只算了兩項）。
- 設定層宣告 **4 個值／9 個名字**：2px（`DEFAULT`／`sm`／`ui`）、3px（`md`／`lg`／`xl`）、4px（`2xl`／`book`）、6px（`3xl`）。
- 渲染層（CDP，兩畫面 344 個元素）：角半徑超標 **21 個**（3px×11、4px×10）；全圓 39 個（豁免）。

#### 8.37.2 根因：第一輪的「改設定」只修了值，沒修名字
第一輪裁決「`xl` 12px→3px，設定層夾住就不會爆版，逐檔改名只是製造 diff」。值確實修對了，但九個名字留著，其中六個指向 3px／4px／6px——「上限 2px」從第一天起在渲染層就不成立，而文件讀起來像已完成。

#### 8.37.3 禁令的視野是 2/78
`BANNED` 的 `rounded-lg/xl/2xl` 只套用在 `SHELL_FILES`（`BookCoverHub.jsx`、`ChapterHeader.jsx`）。全站 78 個有圓角的檔案裡，只有 2 個被檢查。負向對照：在 `NPCWorkshop.jsx` 注入 `rounded-lg`，舊規則全綠、H34 紅。

#### 8.37.4 修法：讓名字不存在
- 收斂到 `rounded`（`DEFAULT: 2px`），刪除 `sm`／`md`／`lg`／`xl`／`2xl`／`3xl`／`ui`／`book`。
- `borderRadius` 從 `theme.extend` 搬到 `theme`（extend 只能覆蓋、刪不掉）。
- 建置產物只剩 `.rounded{2px}`、`.rounded-full{9999px}` 與 8 個單邊類別（皆 2px）。
- 套用 **998 處／78 檔**。

#### 8.37.5 守恆驗證
| | 0px | 2px | 3px | 4px | 全圓 | 超標 |
|---|---|---|---|---|---|---|
| 改前 | 266 | 16 | 11 | 10 | 39 | 21 |
| 改後 | 266 | 37 | 0 | 0 | 39 | 0 |

元素總數 344 → 344、全圓 39 → 39、37 個角 → 全部 2px。

#### 8.37.6 兩處不能機械處理
- `rounded-full` 98 處不收斂（全圓不是角半徑，§CI21 已裁定）；H34-c 是反向控制。
- CSS 層：`inherit`／`var(--r)` 是引用，捲軸的 `4px` 是宣告 → 改 `var(--r)`。

#### 8.37.7 收斂掀開的缺陷
`ZeroPowerBlock.jsx:135`：外 4px、間距 3px、內 **13px**。嵌套圓角應為 內 ≤ 外 − 間距 ＝ 1px；13px 是它的 13 倍，框線四角向外鼓出。對照圖 `scratch/ui-audit/r36-nested-radius.png`。

#### 8.37.8 護欄 218 → 226
H34（零退役名字／任意值）、H34-a（恰好兩鍵）、H34-a2（一對一）、H34-b（上限 2px）、H34-c（全圓 ≥98）、H34-c2（`rounded` ≥1380）、H34-d（CSS 白名單）、H34-d2（`--r` 2px）。

故意破壞 **8/8**，sha256 全部位元組級一致。第 ⑧ 案第一版沒紅（H34-c 門檻 `>= 90`，實測 98，單檔破壞掉到 83 仍過關）→ 門檻改成 `>= 當下值`。

#### 8.37.9 收尾數字
圓角類別 1,492 → **1,492**（名字收斂、次數守恆）；設定層 4 值／9 名 → **2 值／2 名**；渲染層超標 21 → **0**；全圓 39 → 39；護欄 218 → **226**；改動 998 處／78 檔。

#### 8.37.10 剩餘債
R37：`hover:scale-` 51、漸層 7（`body` 2）、`theme?.accent ||`。R38：書頁棕 141 次（**GM 已裁決：與強調紅合併成一個**）＋ 其餘 54 個一次性 hex。

---

#### 8.38 第三十七輪（2026-10-24）：三種「宣告了卻不會發生」

#### 8.38.1 開場量測（殘債的三個數字全部要改）
| 項目 | 殘債寫的 | 實測 |
|---|---|---|
| `scale-` | 51 | **126**（98 具名 ＋ 28 任意值） |
| 漸層 | 7 | **13 行**，其中 **12 條在護欄視野外** |
| hex 回退 | 「的靜默回退」 | **248** |

`scale-` 的 51 只數了 `hover:` 前綴；漸層的 7 數的是肉眼看到的；回退只有一句話沒有數字。**殘債清單本身也是需要被量測的文件。**

#### 8.38.2 `scale`：22 個是死值，12 處連回饋都沒有
98 個具名 `scale-` 裡 22 個是不存在的階（`scale-98`×7、`scale-102`×9、`scale-101`×3、`scale-120`×3）——**沒有產生任何 CSS**。逐站點問「拿掉 `scale` 之後還剩什麼」：44 處它是唯一回饋，其中 12 處是死值 ＋ 完全沒有其他回饋，也就是「按下去什麼都不會發生」。

處置：先把 44 處換成 `hover:border-[#3c2415]`（多數）／`hover:brightness-[0.97]`（1，inline `theme` 上色，class hover 無效）／`hover:ring-2`（2，拖曳令牌），再全部刪掉 126 處。

#### 8.38.3 漸層：護欄只認 `bg-gradient` 一種寫法
| 寫法 | 站點 | 舊護欄 |
|---|---|---|
| `bg-gradient-to-r` | NPCWorkshop ×2 | ✅ |
| inline `repeating-linear-gradient` | BookCoverHub ×2 | ❌ |
| inline `radial-gradient` | TechnosphereBead ×3、index.css ×3 | ❌ |
| `bg-[radial-gradient(…)]` | BookPageFlipOverlay ×1 | ❌ |
| inline `linear-gradient` | ZeroPowerBlock ×1 | ❌ |

另外 `walk()` 只收 `.js`／`.jsx`，`index.css` 從未被任何護欄掃過。改寫成三種寫法全認 ＋ 含 `.css`，並新增「漸層不准吃 `${…}` 插值」（吃主題色＝隨身份色變＝第二套顏色系統）。

#### 8.38.4 `ZeroPowerBlock` 是金箔框，只是換了顏色
`linear-gradient(135deg, accentDark → accent → border → accent → accentDark)` ＋ `0 18px 40px -22px accent` 投影 ＋ 內層兩圈放射光暈——形狀就是 v4 金箔邊框，把金色換成 `accent` 之後躲過「沒有金色」的字面檢查。改成**實心 `accent` 3px 描邊**；「特別」由四角 ❖、襯線大字、浮起徽章、進場動畫承擔（四項都還在）。`zeroPowers.test.mjs` 的三條斷言同步改寫。

#### 8.38.5 回退 292 處：`||` 的右邊如果沒被取用，它就不是保險
| 種類 | 站點 | 處置 |
|---|---|---|
| `<物件>.<鍵> \|\| '#hex'` | 248 | 刪右邊 |
| `theme.accentSoft \|\| X` | 10 | 留 `X` |
| `theme.buttonVariant \|\| 'primary'` | 23 | 留 `'primary'` |
| `theme.outlineButtonVariant \|\| 'outline'` | 10 | 留 `'outline'` |
| 兩邊同值的三元 | 1 | 收成單值 |

另外 `CoreBookVariantCard` 的 `highlightBg`（從未存在 → 選中與未選中底色一直一樣）與 `ChapterDevWarningModal` 的假 `currentTheme`（兩個鍵各只有一個值 → 內聯、物件刪除）。

#### 8.38.6 那 248 個 hex 裡有一批是 v4 化石
`#c9a227`（金）、`#334155`／`#1e293b`／`#0f172a`（冷墨）、`#94a3b8`／`#e2e8f0`（冷灰）、`#888888`（純灰）、`#76252d`（硃砂紅 hover 值被當成 accentDark 保險）。**它們活了三十六輪，正因為從來沒被畫出來過。**

#### 8.38.7 唯一真的在用的回退：匯出畫布
`sheetVars(theme)` 是全站唯一真的會拿到 `null` 的地方。第一版把 `||` 一起刪掉 → 測試紅。正確修法是**把保險換成具名來源**：`const t = theme || getCharacterTheme(null)`。護欄形狀因此定為「右邊不准是 hex 字面值」，不是「不准有 fallback」。順帶修掉 `--sh-ink` 保險 `#3c2415` 與主題 `textDark` `#2c221e` 的顏色不一致。

#### 8.38.8 死欄位 25 鍵 → 17 鍵
`activeTabClass`／`ringColor`／`headerIconColor`／`accentHover`／`chipBg`／`cardBorder`／`cardBorderHover`／`borderHover` 讀取次數皆 **0**，刪除。`id`／`name`／`enName` 是內容，留。第十五輪「`activeTabClass` 必須寫死」的理由**本身對**，但它證明的是「不能改成動態」，不是「必須存在」。

#### 8.38.9 護欄 226 → 234
H35（零 hex 回退）、H35-a（六筆鍵集合相同）、H35-a2（恰好 17 鍵）、H35-b（讀的鍵必須在三張登記表之一）、H35-c（零死欄位）、H35-d（六個 accent 兩兩相異）、H35-d2（未知 id 落回 amber）；漸層改寫（三種寫法 ＋ `.css`）＋ 新增「漸層不吃主題色」。

故意破壞 **8/8**，sha256 全部位元組級一致。反向控制：同一份 inline `radial-gradient`，舊規則看到 2 檔（完全沉默），新規則看到 6 檔（含 `index.css`）。

#### 8.38.10 收尾數字
`scale-` 126 → **0**；`transition-transform` 13 → **5**；hex 回退 248 → **0**；讀不存在欄位 43 → **0**；主題鍵 25 → **17**；死欄位 9 → **0**；漸層 13 行 → **11 條／5 檔全部登記**、吃主題色 3 → **0**；未登記 hex 283 次／54 個 → **227 次／46 個**；護欄 226 → **234**；改動 **48 檔**。

`index.css` 另刪 v4「金銀青絲」三件套（前兩者引用 0，`.gold-text-emboss` 只剩翻頁遮罩標題在用 → 改紙白實心字）。

#### 8.38.11 剩餘債
- **R38**：書頁棕 `#8b5e34`(85)／`#78350f`(56) 共 141 次——**GM 已裁決：與強調紅 `#a63d40` 家族合併成一個**；其餘 **46 個**一次性 hex。
- **R39 候選**：`badgeVariant` 六個主題全是 `'ink'`（集合大小 1）但被讀 15 次——H35-c 不會紅，要不要收成常數是獨立判決。
- 殘留：`transition-transform` 5 處中 2 處用 inline `transform`，行掃描器分不出來，**刻意不寫護欄**（會假紅的護欄比沒有更糟）。

#### 8.39 第三十八輪（2026-10-25）：三份同一個調色盤

**主題**：GM 裁決「書頁棕與強調紅合併成一個」；量下去發現那 117 處棕只是表象，
底下是**同一個六色調色盤被抄了三份**，其中一份從來沒有接上電。

#### 8.39.1 開場量測：清單說 141，實際 117
R37 的殘債清單寫「書頁棕 141 次」，實測 **117 處／11 檔**。差的 23 次是 R37 自己刪掉的
`|| '#hex'` 回退。**寫進文件的數字沒有人再量過**——本輪第一個動作是把清單重數一次。

#### 8.39.2 117 處逐項歸類：47 面 ＋ 70 字
`r38_sites.cjs` 改用「緊接在 hex 前面的那個 token」判角色（行級判會把
`bg-[#8b5e34] hover:bg-[#78350f]` 的兩端判成同一個角色）。結果：

| 角色 | 處數 | 去向 |
|---|---|---|
| 強調底／hover | 25 | `#a63d40`／`#8c3235` |
| 強調文字（粗體） | 24 | `#3c2415` |
| 次要文字／圖示 | 45 | `#6b5a4b` |
| hover／focus 邊界、環 | 18 | `#3c2415` |
| 墨底晶片邊界 | 2 | `#6b5a4b` |
| inline 狀態色 | 3 | `#a63d40` |

**70 處字不進紅色**：CI33 裁決 `#a63d40` 只給「可以按的、被選中的」。
把標題換成紅色＝用強調色標示層級，那是**序**的工作。

#### 8.39.3 三份拷貝，只有一份被看過
`characterThemes`（`accent`/`accentDark`/`accentLight`）、`ClockTracker`（`fill`/`stroke`）、
`index.css` 的 `[data-theme]`（`--ink`/`--signal`）——色碼一字不差，欄位名不同。
護欄只看得見第一份。

#### 8.39.4 `index.css` 是一套從來沒接電的顏色系統
- `data-theme` 全站設定 **0 次**；
- 12 個變數 × 2 組只被 `.ui-panel`／`.ui-zone` 讀，而那兩條規則用 **0 次**；
- 值與 `tailwind.config.js` 一字不差；
- 它的 `--ink` 是 `#2a3240`（冷墨），`body` 實際是 `#2c221e`（暖墨）。

→ 整組刪除（24 個宣告），只留 `:root { --r: 2px; }`；另刪 7 條死規則
（`.ui-sel`／`.ui-done`／`.ui-mute`／`.ui-panel`／`.ui-zone`／`.ui-pixel`／
`.animate-page-dissolve-out`）。

#### 8.39.5 投影：`identityPalette.js` 成為唯一來源
`IDENTITY.x = { accent, dark, light }`。`characterThemes` 與 `ClockTracker` 都往下取。
`accentLight` 這一輪才搬進來——上一輪說它是「另一筆債」，其實它就是身份的第三個明度。

#### 8.39.6 剩下 27 個未登記 hex：18 個登記、9 個收斂
登記：九相 3（電／土／毒）、四屬性 4、身份深淺 11。
收斂：`#8b4513`×4、`#7b4720`、`#8b2d27`、`#8a3f26`、`#9d302a`、`#4a4068`、`#5f2225`。

#### 8.39.7 六狀態：4 個手寫色是補丁，不是裁決
`CombatantCard` 六個狀態裡，4 個用 `border-signal-*` ＋ 登記墨色（正確），
2 個（動搖／憤怒）手寫了一對 hex。原因不是設計，是 **signal 只有四個令牌、狀態有六個**。
兩對顏色沒有任何一句「為什麼是這個值」，`#c0603f` 在紙上只有 3.56:1。
→ 收斂到登記的身份紫與硃砂紅；邊界六色仍兩兩相異，文字最低對比 5.59:1。

#### 8.39.8 `tailwind.config.js`：15 個鍵，15 個 0 次
`parchment` 色盤的註解寫「過渡期保留」，實際 **15 個鍵全部 0 次**（連 `DEFAULT`）。
紙的顏色三十八輪以來一直寫在 hex 與 `CHARACTER_THEMES` 裡。
代價：其中 4 個鍵帶著 H23-b 硬零的琥珀值，讓本輪新加的 `H36-a` **第一版對
`rgba(139, 94, 52, .6)` 給出綠燈**。→ 整組刪除。

#### 8.39.9 護欄 234 → 239
`H36`（`.css` hex 硬零）、`H36-a`（rgba 三通道）、`H36-b`（身份明度單調）、
`H36-c`（設定層死鍵，預算 3）、`H36-d`（`characterThemes` 封閉白名單）。

刻意不加兩條：命刻「覆蓋」（已被注入性涵蓋）、九相／四屬性「大小與可辨」
（已被 `H14-b`／`H15-a` 涵蓋，破壞驗證顯示會同時 4 條變紅）。

#### 8.39.10 故意破壞 8/8
`H31`／`H36`／`H36-a`／`H36-b`／`H36-c`／`H36-d`／`H23-d`／`H23-b` 全部點名失敗，
sha256 位元組級一致。**四條新護欄各自「只有它自己變紅」**，證明它們沒有被既有護欄順手擋住。

反向控制：`walkSrc` 146 檔 vs 加 `.css` 147 檔；`rgba(139,94,52,.6)` 在 hex 正則下命中 **0 次**；
刪掉 `parchment` 死子鍵之前 `H36-a` 對它是**綠的**。

#### 8.39.11 收尾數字
書頁棕 117 → **0**；未登記 hex 227 次／46 個 → **0／0**（64 色全登記）；
身份定義 3 份 → **1 份**；`[data-theme]` 宣告 24 → **0**；`index.css` 死規則 7 → **0**；
`parchment` 鍵 15 → **0**；設定層死鍵 17 → **3**；漸層 11 → **9 條／5 檔**；
護欄 234 → **239**；改動 **30 檔原始碼** ＋ 6 份文件。

#### 8.39.12 剩餘債
- **R39 候選**：`badgeVariant` 六個主題全是 `'ink'`（集合大小 1）卻被讀 15 次；
  設定層 3 個死鍵 `cool-line`／`cool-line-2`／`warm-line-2`。
- **結構債**：`walkSrc` 仍只收 `.js`／`.jsx`。本輪只補了「色票」這一條，
  其餘二十幾條護欄（任意字級、圓角…）仍然看不見 `.css`。要嘛全掃，要嘛明文宣告 `.css` 只管色票。
- **判準債**：「六狀態是標記不是身份」這句本輪才寫下來，與九相／四屬性的邊界值得單獨一輪寫成通則。

#### 8.40 第三十九輪（2026-10-25）：把檔案加進掃描範圍，不等於檔案受到檢查

**主題**：殘債第一條寫著「`walkSrc` 只收 `.js`／`.jsx`」。照著修（把 `.css` 加進去）
之後 **239/239 依然全綠、零新增**——那個全綠是證據，不是好消息。

#### 8.40.1 假修補的量測
`walkSrc` 收 **146 檔**，加上 `.css` 收 **147 檔**。差的那 1 檔從來沒被掃過，
但把它加進來之後，**一條護欄都沒有多紅**。原因：護欄的樣式是 `text-[13px]`，
CSS 寫的是 `font-size: 13px`，**兩者永遠不會相遇**。

#### 8.40.2 缺口不是檔案，是寫法
| 禁令 | Tailwind | CSS | 行內 | 本輪前誰看得到 |
|---|---|---|---|---|
| 任意字級 | `text-[13px]` | `font-size:` | `fontSize:` | **只有第一種** |
| 圓角上限 | `rounded-[6px]` | `border-radius:` | `borderRadius:` | 前兩種 |
| 漸層 | `bg-gradient-*` | `linear-gradient(` | `linear-gradient(` | **三種全認** |
| 顏色 | `#hex` | `#hex` | `#hex` | 三種 |

漸層那一列是模板——`GRAD_TOKEN` 從第十輪就寫對了，本輪只是把同一個問法
補到字級與圓角上。

#### 8.40.3 量到的四筆
行內 `fontSize` **49 處／11 個值**（H33 命中 **0**）；半像素 **13 處**；
CSS `font-size: 7px` 1 處；行內 `borderRadius: '3px'` 1 處。
反向控制：把 `T.sN` 還原成字面值，49 處字面值、H33 命中 0 處
——**舊護欄對行內字級的覆蓋率是 0**。

#### 8.40.4 匯出頁是另一個媒介，不是漂移
1123×794 固定畫布，10px 起跳一定溢出，而 `overflow: hidden` 的溢出＝內容被裁掉。
所以它需要自己的階梯——但它仍然需要**一個階梯**。抽成 `T`（`C` 顏色／`S` 樣式／`T` 字級），
49 處改引用；護欄直接從原始碼解析 `T`，不另抄一份。

#### 8.40.5 半像素是雜訊
螢幕型階梯最小步距 **9.1%**（10→11）；8→8.5 是 **6.3%**、8.5→9 是 **5.9%**、
9→9.5 是 **5.6%**——只有下限的六成。加上 `html-to-image` 在不同 DPR 下捨入方向不一致。
**一律向下取整**（版面安全：固定畫布上變小不會溢出）。
**11 個值 → 9 階**（7·8·9·10·11·12·13·14·16），與螢幕型階梯同數。

13px（步距 8.3%／7.7%）也在邊緣，不動它——因為它與 12／14 構成 1px 線性階梯；
半像素連 1px 都不是。界線是「整數」，不是「步距夠不夠大」。

#### 8.40.6 `var(--accent)`：上一輪自己留的傷
第三十八輪刪 `[data-theme]` 時把 `--accent: #a63d40` 一起帶走，
而焦點外框寫的是 `var(--accent, #a63d40)`。**fallback 的值一模一樣，畫面一 px 都沒變。**
反向控制：H31 命中 1 次（綠）、H36-a 命中 0 次（綠）、H37-d 命中 1 次（紅）。

> 壞掉的東西長得跟好的一模一樣，是「宣告了卻不會發生」最難抓的一種。

#### 8.40.7 護欄 239 → 244
`H37`（匯出頁字級引用 `T`，封閉白名單）、`H37-a`（零小數字級，三種寫法）、
`H37-b`（CSS `font-size` 落在階梯上）、`H37-c`（行內圓角 2px／50%／0）、
`H37-d`（`var(--x)` 必須有定義，`--tw-*` 豁免）。

`H37` 選封閉白名單而非值域，因為值域允許 `fontSize: '9px'`——那等於把階梯又抄一份。
**要引用，不要複寫。**

#### 8.40.8 故意破壞 5/5
五條各自**只有它自己變紅**，sha256 還原一致。`H37-a` 的破壞點刻意放在別的檔案
（`JRPGModal.jsx`），因為 `H37` 只讀匯出頁——同檔破壞會讓兩條一起紅，證明不了承重。

#### 8.40.9 收尾數字
匯出頁字面值 49 → **0**；相異字級 11 → **9 階**；半像素 13 → **0**；
CSS 階梯外 1 → **0**；行內圓角 3px 1 → **0**；`var` 空引用 1 → **0**；
護欄 239 → **244**；改動 **3 檔**。

#### 8.40.10 剩餘債
- `badgeVariant` 六個主題全是 `'ink'`、被讀 15 次，且 `JRPGBadge` 的預設與 fallback
  也都是 `'ink'`——三重死亡（CI41 的墓碑被讀 15 次就是活著的宣告）。
- 設定層 3 個死鍵 `cool-line`／`cool-line-2`／`warm-line-2`。
- 六條純黑陰影 `rgba(0,0,0,0.3～0.75)`：R38 已立「陰影用墨」判準並套用在書封，
  **沒套用到翻頁關鍵影格**。改 alpha 需要眼睛驗證，本輪無法離線驗證動畫。
- `walkSrc` 仍只收 `.js`／`.jsx`；正確方向是逐條檢查「這條護欄認幾種寫法」。

#### 8.41 第四十輪（2026-10-25）：紙只有一種，光有兩種

**主題**：第三十九輪結尾留下一句「冷暖分層只有暖的一層」，GM 裁定「做」。
動手前先讀自己的設計文件，發現 §01 寫著 **「紙只有一種」**——
要建的冷區被自己的文件明文否決。

#### 8.41.1 一句被自己文件否決的裁定

`design-system-v5.html` §01：「層次靠冷暖溫差，不靠明暗對比。**紙只有一種**，
墨是一條階梯，強調色只有一個。」

而 `tailwind.config.js` 有 `warm` 五階 ＋ `cool` 五階，兩者在文件裡沒有位置。
所以這一輪不是實作一個既有設計，是**改一條教義**——必須說得出來
「紙只有一種」為什麼還能成立。

#### 8.41.2 說法：紙只有一種，光有兩種

一張紙的結構是「六階亮度」；暖與冷是**照在它上面的光**。
兩區同階等亮，紙就還是同一張紙。

冷區六階是**從暖區的相對亮度反推**的，不是另外挑一組藍灰。
實測最大偏差 **0.726%**（`shade` 那一階），六階全部在 1% 內，兩區都嚴格遞減。

於是四階墨在兩區的對比幾乎逐位相同：`ink-3` 在暖 `page` 是 6.16:1、
在冷 `page` 是 6.18:1；逐格最大差 **0.064**。

#### 8.41.3 舊階梯的地雷

舊 `cool` 每一階都比暖區同階暗 5.8–8.0%（`line` 差 **21.52%**）。後果：

| 墨 | 暖 `panel` | 舊冷 `panel` |
|---|---|---|
| `ink-2 #5c6878` | 4.78 ✓ | **4.46 ✗** |
| `ink-3 #5f6a78` | 4.64 ✓ | **4.33 ✗** |

**「把畫面換成冷區」會讓二級與三級墨一起掉出 AA。**
它活了這麼久沒被發現，因為冷區只被用 3 次，而那 3 次是進度條底色，上面不放字。

#### 8.41.4 一個名字，兩個都只對一半

`#e8dcc4`：文件叫 `header`、設定叫 `line`。實測 `bg` 122 次、`border` 146 次、
`divide` 9 次、`text` 11 次——它同時是凹下去的面與最淺的框。
改名 `shade`。`line` 留給 `#d6c7ab`（951 次使用中 907 次是 `border`）。

#### 8.41.5 規模：令牌層不是全站的語言

暖紙 hex **4,753** 處、書墨 hex **2,267** 處；`warm`＋`cool` 令牌 **24** 處、
`ink` 令牌 **85** 處。而且 24 處令牌只在三個檔。

所以「做冷區」只能是**一個試點**——戰鬥輪次，那個本來就該冷的畫面。
一次換完 4,753 處不是這一輪的題目。

#### 8.41.6 做法：只換面，不換墨

面（`bg`／`border`／`ring`／`divide`／`from`／`via`／`to`）→ `cool-*`。
墨（`#2c221e`／`#3c2415`／`#6b5a4b`／`#7c6a58`）不動——墨是兩區共用的一條階梯。
`text-[#fffdf9]`（紅底反白 4 處）不動，它是紙當字用；
`text-[#d6c7ab]`（分隔 `|` 1 處）換成 `text-cool-line`，它是線當字用。

#### 8.41.7 護欄 244 → 268

新增 `H38` 家族五條：同階等亮（≤1%）／嚴格遞減／鍵名集合相等／
冷區零暖紙（硬零）／暖區零冷色（反向控制）。

另外 19 條是 `[B]` 對比迴圈的**展開**（面三階→六階、可放字的面 3→4、兩區都測），
不是新規則。把它算進「護欄成長」會讓這個數字可以造假。

`H36-c` 的預算 3 → **1**，同時修掉它自己的一個漏洞：舊正則抓不到數字鍵，
`cool-0` 與 `ink` 的 `2`／`3` 一直是隱形的。修法是**刪掉整段正則**改讀 `twConfig`。

#### 8.41.8 故意破壞 5/5

| 護欄 | 同時變紅 |
|---|---|
| `H38` | **2 條**（＋`cool.panel: ink-3` 對比） |
| `H38-a` | 1 條 |
| `H38-b` | 1 條 |
| `H38-c` | 1 條 |
| `H38-d` | 1 條 |

`H38` 的 2 條紅是這一輪最重要的數字：它是**對比失敗的預測器**，
紅的時候 bug 已經發生了。`H38-a` 的破壞必須兩區同時抬亮，
只抬暖區會讓 `H38` 一起紅，證明不了它承重。

反向控制：舊冷區 → `H38` 紅 **6/6 階**；同一條正則掃 `git HEAD` 的戰鬥模組
→ `H38-c` 命中 **79 處**（24＋24＋2＋29）。

#### 8.41.9 收尾數字

戰鬥模組暖紙面 79 → **0**；冷區面令牌 3 → **82**；
全站 `warm`／`cool` 21／3 → **12／83**；兩區同階最大偏差 → **0.726%**；
設定層死鍵 4（1 個隱形）→ **1**；護欄 244 → **268**；改動 **8 檔**；
`npm test` **30 個子套件全綠**；`npm run build` exit 0；新增 hex（`src/`）**0**。

#### 8.41.10 剩餘債

- **暖區 4,753 處 hex 沒有令牌化。** 現在全站兩種寫法並存：戰鬥畫面用
  `bg-cool-card`，角色卡用 `bg-[#fffdf9]`。令牌層要成為全站語言還差一次大遷移，
  風險不在顏色，在於它會動到 4,753 個位置。
- **兩套墨並存**：`text-ink`（藍灰 `#2a3240`，85 處，四個檔）與書墨
  （暖棕 `#2c221e`，2,267 處）。設計文件只登記後者。
- **`warm-panel-2` 死鍵**（`H36-c` 預算 1）。
- **邊框對頁面 1.56:1**，低於非文字 3:1。既有、刻意的淡線；冷區 1.57:1，兩區一致。
  要動它得動 907 個 `border-[#d6c7ab]`。
- **`ink-3` on `shade` 4.82、`ink-4` on `panel` 4.37**：兩區同值，既有債。
  判準是「不在凹槽上放小字」，不是把墨一路調深。

#### 8.41.11 實圖驗證：只有溫度不同

用 `renderToStaticMarkup` 產生一次卡片 HTML（冷區），暖區版是同一份字串做
`cool-` → `warm-` 的替換，兩份並排。三個自檢：兩份除溫度外**逐字相同**（40,855
字元全等）、CSS 由同一份 config 現編（28 KB）、12 個令牌的編譯色值**逐個比對
12/12 正確**。結果：兩側版面一致，只差底色溫度，卡片內部墨色與狀態徽章一字不差。

**不能證明的**：整個戰鬥畫面在真實資料下的樣子。只證明 ①令牌編得出來
②兩區只差色相 ③換區沒弄壞任何元素。

#### 8.41.12 新發現：`sat-hiber` 從來沒有被定義過

色值自檢順手檢查了 `CombatantCard` 用到的 class 有沒有進 CSS——`sat-hiber`
**0 次**，全站定義也 **0 次**。它只出現在 `CombatantCard.jsx:129` 的三元式裡，
而同檔註解寫著「v5 改為去飽和，這是 v5 最重要的狀態語言之一」。

**「已行動」的卡片從第一天起就沒有任何視覺差異。** 這是同一種病的第七次
（`scale-98`／`theme.accentSoft || …`／`bg-paper`／`--accent`）——
**每一次形狀都不同，共同點是「它在原始碼裡看起來像一個決定」。**

本輪沒修：修法需要設計裁決（飽和度多少、要不要連帶壓掉 HP 條的紅），
而這一輪的主題是面不是狀態。

#### 8.42 第四十一輪（2026-10-25）：讀起來像一個決定

**主題**：GM 兩條裁定——① 修 `sat-hiber` ② 4,753 處 hex 令牌化**不做**。
第一條照做，但做的時候發現它不是一個 bug，是一種病。

#### 8.42.1 它不只「沒有效果」

`cardState` 是**唯一**提供邊框色的地方，而它是三元式。所以「已行動」
不是沒有變化，是換成了另一種變化：

| 狀態 | 邊框 | 對卡片底 |
|---|---|---|
| 敵方·待行動 | `#c4c9ce` | 1.64 |
| 敵方·已行動 | **`#e5e7eb`**（第三種灰） | 1.22 |
| 敵方·危機且已行動 | **`#e5e7eb`**（紅框消失） | 1.22 |

**一個不存在的 class 不會只是「沒有效果」，它會把原本屬於別的狀態的顏色
一起帶走。** 血量見底的敵人只要動過一次就不再警示。

#### 8.42.2 修法：不發明那個名字

`filter: saturate()` 會連帶壓掉 HP 條的紅（「褪色」變成「全部灰」），
而且這個 class 之所以不存在，是因為**它不該存在**——卡片有兩個獨立維度
（陣營、動過沒有），一個 class 只能表達一個。

改成疊：危機 > 已行動 > 陣營；已行動＝**降一階不換色相**；
識別條去色；資源條不動（HP／MP 是量，GM 要讀）。

| 狀態 | 修正前 | 修正後 |
|---|---|---|
| 敵方·已行動 | `#e5e7eb` 1.22 | `cool-shade` **1.34** |
| 敵方·危機且已行動 | `#e5e7eb` 1.22 | `signal-hp/45` **1.98** |
| 玩家·已行動 | `#e5e7eb` 1.22 | `signal-mp/20` **1.31** |

#### 8.42.3 量測器自己錯了兩次

① `parse()` 讀了 alpha，`ratio()` 沒用它 → 玩家兩態都 5.3、危機態 1.00。
② 出圖自檢用 `.x{` 定位，而 CLI 產出是縮排格式 → 三個正確被報成三個錯誤。

**量測器回報的「異常」，第一件事應該是懷疑量測器。**

#### 8.42.4 同一個病還有 264 處

`HEAD`：**25 種／335 處**。全部是同一件事的兩半：

| 病因 | 處數 |
|---|---|
| Tailwind **v4 的命名**跑在 v3.4.19 上（`shadow-2xs`／`shadow-xs`／`drop-shadow-*`／`backdrop-blur-xs`／`sm:w-18`／`focus:outline-hidden`） | 175 |
| **`tailwindcss-animate` 從未安裝**（`plugins: []`）——`animate-in`／`fade-in`／`slide-in-*`／`zoom-in-95` | 89 |

共同點：**它們在 shadcn 的文件裡都是正確寫法。** 抄過來時版本不同、
外掛沒裝，而抄過來的東西不會報錯。

順帶：`三層噪音` 護欄的詞彙表裡有 `shadow-xs`——它守著一個
**不可能發生的陰影**。護欄的詞彙也會過期。

#### 8.42.5 量尺三代

| 版本 | 結果 | 問題 |
|---|---|---|
| v1 所有像 class 的字串 | 113 種／394 處 | 假陽性滿天飛 |
| v2 只掃 `className=` | 23 種／273 處 | **`sat-hiber` 從名單上消失** |
| v3 ＋插值＋變數解析＋標記免責＋行內 `<style>` | 18 種／264 處 | — |

**量尺收緊會讓目標走出畫面。** 護欄要的是召回，不是精確。

v3 的規則：① 掃 className 的字面值 ② **進 `${}` 繼續掃** ③ 一層變數解析
（`${cardState}` → `const cardState =`）④ 被 `classList.contains`／
`querySelector`／`closest` 查詢的是 DOM 標記，免責（且必須全域）。
另外：物件的鍵不是 class，判斷要同時看左右、且往左看必須在**去註解**的字串上做。

#### 8.42.6 本輪修掉 7 種／71 處

`py-0.2` 35（→ `py-0.5`）／`animate-fade-in` 29（**補定義**）／
`duration-350` 2（→ 200）／`bg-signal-ip/8` 2（→ `/10`）／
`hover:bg-[#f7f3e8]/12` 1（→ `/10`）／`animate-spin-slow` 1（移除）／
`sat-hiber` 1（重寫狀態邏輯）。

順手量到：**透明度修飾詞只接受 5 的倍數**（`/5`／`/45` 有效，`/8`／`/12` 無效）。
寫的人以為它是百分比。

#### 8.42.7 兩個名字指同一個東西時，留多數的那個

`animate-backdrop-fade` 有定義、用 1 次；`animate-fade-in` 沒定義、寫了 29 次。
留 29 的那個，把定義補到它身上。

#### 8.42.8 護欄 268 → 271

`H39`（未登記的死 class，硬零）／`H39-a`（清單不得腐爛）／
`H39-b`（總數只減不增，預算 264）。

**這是全套護欄裡唯一一條會現編 CSS 的**——前面三十九條讀得到那個字串，
讀不到「它不存在」。代價 ~2 秒，換來唯一一條不可能被寫死的字串騙過的檢查。

量尺升級為 `scripts/auditClasses.mjs`，護欄與普查共用同一份實作
（重構時弄丟「多數決」濾網，數字從 264 變 270——所以必須共用）。

#### 8.42.9 故意破壞 4/4

| 護欄 | 同時變紅 |
|---|---|
| `H39` | 1 條 |
| `H39-a` | 1 條 |
| `H39-b` | 1 條 |
| `sat-hiber` 放回去 | **2 條**（名字＋總數） |

`H39-b` 的破壞點換過一次：第一版加在書封 `shadow-e3` 旁邊，`三層噪音`
也一起紅（那一行同時有 border 與 bg-）。**那不是護欄不獨立，是我把兩個
違規同時放進同一行。破壞點本身就是一個設計問題。**

反向控制：`HEAD` 25 種／335 處、`sat-hiber` 在名單上 → 現在 18 種／264 處。
如果 `H39` 早一輪存在，那個 bug 會在**寫下的當下**就紅。

#### 8.42.10 收尾

死 class **25 種／335 處 → 18 種／264 處**；護欄 268 → **271**；
`npm test` **30 個子套件全綠（271/271）**；`npm run build` exit 0；
改動 **16 檔**＋1 個新工具；新增 hex（`src/`）**0**。

#### 8.42.11 待裁決與殘債

**待裁決：剩下 264 處要不要修？**

| 類別 | 處數 | 建議 | 風險 |
|---|---|---|---|
| 陰影 | 137 | → `shadow-e1`（墨色，符合「陰影是量，用墨」） | 137 個元素第一次真的有陰影 |
| 動畫 | 89 | → `animate-fade-in`／`animate-modal-pop` | 89 個元素第一次真的會動 |

兩者都是「把原本靜止的東西叫醒」，不是純改名；一次改 226 個視覺行為無法驗證。

**其餘**：`sm:w-18`／`sm:h-18`（20 處，v3 沒有 18 這一階，挑 16 還是 20 是
視覺決定）；`focus:outline-hidden`（6 處，v3 是 `outline-none`）；
`backdrop-blur-xs`（12 處，一對一可安全改）；兩套墨並存、邊框 1.56:1 不變。

**GM 已裁定不做**：4,753 處暖紙 hex 令牌化。

---

#### 8.43 第四十二輪（2026-10-25）：把一類東西關掉

**起點是一句質問，不是一個 bug。** 第四十一輪收尾照慣例交了「剩下 264 處，要不要修？」
GM 回：「做，到底還有什麼還沒做好，為什麼每次做完你都會講有新的東西要裁定？什麼時候才能做好」

這不是對某個 bug 的意見，是對節奏的意見。R39／R40／R41 三輪都在動死 class，
三輪都沒把它關掉——每次只處理「這一輪剛好看到的那幾個」，剩下的寫成清單交出去。
**清單看起來像進度，實際上是把決定權當成擋箭牌。**

所以這一輪的題目不是「修掉 264 處」，是「讓這個數字永遠是 0，而且回不去」。

##### 8.43.1 264 處只是 18 個名字

| 名字 | 處 | 檔 | 處置 |
|---|---:|---:|---|
| `shadow-2xs` | 74 | 24 | → `shadow-e1`（8 處改刪除） |
| `shadow-xs` | 54 | 21 | → `shadow-e1`（同上） |
| `animate-in` | 39 | 10 | 移除，改掛 `animate-fade-in` |
| `fade-in` | 29 | 7 | 移除，同上 |
| `backdrop-blur-xs` | 12 | 9 | → `backdrop-blur-sm` |
| `slide-in-from-top-2` | 12 | 4 | **移除，無替代** |
| `sm:w-18` / `sm:h-18` | 10 / 10 | 1 | → `[4.5rem]` |
| `drop-shadow-xs` / `drop-shadow-2xs` | 6 / 1 | 1 | → `drop-shadow-sm` |
| `focus:outline-hidden` | 6 | 2 | → `focus:outline-none` |
| `slide-in-from-top-4` | 3 | 1 | **移除，無替代** |
| `hover:shadow-2xs` | 2 | 1 | → `hover:shadow-e1` |
| `zoom-in-95` | 2 | 2 | → `animate-modal-pop` |
| `slide-in-from-{left-2,bottom-2,top-5,bottom}` | 各 1 | 1 | **移除，無替代** |

合計 **264 處／18 種／38 檔／166 個字串**。

##### 8.43.2 陰影：8 處的答案是刪掉，不是換名字

130 處陰影裡，有 8 處是「`text-white` ＋ 底色來自 inline style」的實色按鈕
（`AvatarCropperModal`×2、`CharacterAvatarUploader`×2、`CharacterEditor`、
`IdentityTablesModal`、`StarterPresetsModal`、`ZeroPowerNameTablesModal`）。
`e1` 的 alpha 是 .05／.06，鋪在飽和強調紅上等於零。

R41 已經對 `chapterChrome.exitBtn` 做過同一個判斷（刪掉），這一輪把那個判準
套到全站。**把它們遷過去，只是把一個看不見的死 class 換成一個看不見的活 class**——
仍然是一種「宣告了卻不會發生」，只是這次會通過所有護欄。

其餘 122 處遷到 `shadow-e1`：122 個元素第一次真的有了陰影。

##### 8.43.3 動畫：19 處失去方向，這是唯一真的變少的東西

`animate-in`＋`fade-in` 68 處（`tailwindcss-animate` 從未安裝）→ 全部改掛
已定義的 `animate-fade-in`。但 `slide-in-from-*` **19 處沒有對應**：v3 沒這個語法，
而它承載的是**方向**。沒有手寫 19 組 keyframes——那會讓設計系統多出 19 個
沒有人登記的動畫名，正是這一輪在清的東西。

代價寫清楚：**這 19 個元素現在只是淡入，不是滑入。**

`zoom-in-95`（2 處）例外：modal 的彈出是**層級宣告**，接 `animate-modal-pop`。

##### 8.43.4 那 20 處「需要視覺決定」的，其實不需要

R41 殘債寫「`sm:w-18` 要挑 `w-16` 還是 `w-20` 是視覺決定」——**這句話是錯的**。
v4 動態間距是 `n × 0.25rem`，`18` 就是 `4.5rem`。改 `sm:w-[4.5rem]` 像素級一致，
零決定。這條債在清單上躺了兩輪，不是難，是沒有去算。

##### 8.43.5 量測器又錯一次：樣本跑出畫布

第一張對照圖是**一整片空白框**。原因：樣本裡有 `absolute inset-0` 的覆蓋層，
而測試頁容器是 `static`——元素以視窗為定位祖先，10 個樣本疊在一起蓋住整頁。
修法：容器給 `position: relative`，樣本外再加一層定位容器。

修好後：`shadow-e1` 是一條幾乎看不見的邊；八個填色按鈕前後**完全一樣**
（那正是刪掉它們的理由）。

##### 8.43.6 遷移紀錄不是最終狀態

`migrate-log.json` 記 `drop-shadow-e1`，檔案實際是 `drop-shadow-sm`（R41 那次修正
沒有回頭更新 log）。驗證時一度以為自己製造了 5 個新死 class。**紀錄一旦落後於檔案，
它就會變成第二個答案。** 本輪表格改從 `git diff` ＋ 遷移前普查檔重新對出來。

##### 8.43.7 護欄 271，但預算歸零

條數不變（271），變的是容忍額度：`DEAD_CLASS_KNOWN` 清空、`DEAD_CLASS_BUDGET`
**264 → 0**。`H39-a` 的職責從「清單不能腐爛」變成「清單不能長回來」。
預算不是「現在還剩多少」，是「還可以再錯多少次」——264 那個數字本身就是
一個錯誤的承諾。

破壞 2/2（插入 `shadow-xs` → `H39` 點名檔名行號 ＋ `H39-b` 超出 1 處），
還原後 sha256 一致。同一次破壞裡 `text-t10` 沒被點名（它是真的存在的字級令牌），
這是反向控制。

##### 8.43.8 收尾

死 class **18 種／264 處 → 0 種／0 處**；預算 264 → 0；掃描 146 檔／28,795 個
token／1,140 個名字；護欄 271（不變）；`npm test` 30 個子套件全綠（271/271）；
`npm run build` exit 0；改動 **41 檔**；新增 hex（`src/`）**0**。

##### 8.43.9 關掉的與仍開著的

**已關死（硬零護欄）**：死 class／未登記 hex／書頁棕／`scale-` 家族／`|| hex`
靜默回退／三層噪音／冷區暖紙。這七類不需要再裁定。

**仍開著（量到了，不假裝不存在）**：Tailwind 預設黑影 **148 處／36 檔**
（`shadow-sm` 76／`shadow-md` 43／`shadow-inner` 19／`shadow-xl` 5／`shadow-lg` 5）；
兩套墨並存 85 vs 2,267；邊框對頁面 1.56:1（907 處）；4,753 處暖紙 hex（GM 已裁定不做）。

148 處不需要裁決——`shadow-sm → e1`／`shadow-md → e2`／`shadow-xl → e3` 是同一條
高度階梯，跟本輪做過的 122 處是同一個判斷。`shadow-inner` 是例外（內陰影是凹陷
不是高度，沒有對應的 `e` 令牌）。

---

#### 8.44 第四十三輪（2026-10-25）：顏色不是被覆蓋，是被刪掉

**起點是 GM 的一張截圖**：深紅底（`#a63d40`）的「跑團面板」按鈕，字是深墨色，整個讀不到。
而那一行寫的是 `text-[#fffdf9]`——**淺色，完全正確**。問題不在那行。

##### 8.44.1 診斷

`JRPGButton` 用 `twMerge(clsx(base, variantStyles[v], sizeStyles[size], className))`。
`twMerge` 的規則是「同一組只留最後一個」，而它只認識 Tailwind **內建**的字級階梯。
專案的字級是自訂令牌 `text-t10`…`text-t39`，它不認得 → 歸類成**文字顏色**。

而 `sizeStyles` 排在 `variantStyles` 後面：

```
twMerge('… text-[#fffdf9] … text-t12')  →  '… text-t12'
```

實測 `有保留 text-[#fffdf9] 嗎？ false`。顏色沒有被覆蓋，是**根本沒進 DOM**。
按鈕因此沒有 `color`，字繼承父層墨色 → 深底深字。

##### 8.44.2 為什麼四分之三的按鈕看不出來

| 變體 | 底色 | 原字色 | 顏色被刪後 | 看起來 |
|---|---|---|---|---|
| `primary` | 深紅 `#a63d40` | 淺 `#fffdf9` | 繼承墨色 | **讀不到** |
| `secondary` | 淺 `#f4ebd9` | 深 | 繼承墨色 | 剛好對 |
| `outline` | 淺 `#fffdf9` | 深 | 繼承墨色 | 剛好對 |
| `ghost` | 透明 | 深 | 繼承墨色 | 剛好對 |

呼叫點 58 個：`primary` **36**／`secondary` 6／`outline` 11／`ghost` 5。
**36 個壞掉，22 個「壞掉但看不出來」**——後者的錯誤答案剛好等於正確答案。
所以它從第十五輪（按鈕收斂成四變體）活到現在。

##### 8.44.3 冠位徽章：字與底同色

`JRPGBadge` 的 `rank-top` 是墨底淺字（`bg-[#2c221e] text-[#e8dcc4]`），
`text-[#e8dcc4]` 被 `text-t10` 吃掉 → 字繼承墨色 → **和底色一樣**。
截圖上那顆徽章只剩一個純深色方塊，**連字都不存在**。`rank-mid` 同樣（褐底深字，勉強有輪廓）。

##### 8.44.4 修法

新增 `src/utils/cn.js`：`extendTailwindMerge` 把專案字級登記進 `font-size` 組。
四支元件（`JRPGButton`／`JRPGBadge`／`JRPGInput`／`StatBadge`）共 7 個 `twMerge` 呼叫改成 `cn()`。

否決三個修法：把 `sizeStyles` 排前面（只是換成字級被刪，退回 16px 更難查）／
加 `!important`（問題不是優先權，是 class 不在）／拿掉 `twMerge`（去重全部失效）。

##### 8.44.5 護欄 271 → 275

| 護欄 | 形狀 |
|---|---|
| `H40` | 硬零：只准 `src/utils/cn.js` import `tailwind-merge` |
| `H40-a` | 行為測試：真的跑 `cn()`，深底淺字的顏色與字級都要活著 |
| `H40-b` | 鍵集合相等：`cn.js` 登記的字級 == `tailwind.config` 的 `fontSize` |
| `H40-c` | 反向控制：同一組仍然只留最後一個（防「把合併器關掉」被當成修法） |

**`H39` 問「這個 class 名存在嗎」，`H40` 問「它還留著嗎」。** 271 條護欄全部讀原始碼，
沒有一條跑過 `twMerge`——中間那個會主動刪東西的函式，從來不在視野裡。

##### 8.44.6 破壞 4/4，其中一個破壞點選錯

`H40`／`H40-a`／`H40-b`／`H40-c` 各紅 1 條，還原後 sha256 一致。

`H40-a` 第一版破壞把 `'font-size'` 改成不存在的 `'font-size-x'`，結果 **275/275 全綠**。
不是護欄弱，是那個「破壞」**其實是一個可行的修法**：組名不存在 → `text-t12` 不被分類 →
不再衝突 → 兩個 class 都留 → 畫面正確。改用存在的 `'text-color'` 才紅。
**破壞點要挑「同一個錯誤」，不是「同一個位置」。**

##### 8.44.7 收尾

顏色被刪的按鈕 **58 → 0**（可見 36 → 0）；徽章變體 **2 → 0**；直接 import `tailwind-merge` 的檔案 **4 → 0**；
護欄 271 → **275**；`npm test` 全綠（275/275）；`npm run build` exit 0；改動 **5 檔**；新增 hex **0**。

出圖：把 `cn.js` 暫時換回第四十二輪版本渲染一次、`finally` 還原比對 sha256、再渲染一次。
次要／無框前後**完全一樣**（那正是「壞掉但看起來對」的證據）；`rank-top` 修正前是空方塊。

---

#### 8.45 第五十五輪（2026-10-30，P5）：角色檔案與資源回饋

**起點是使用者對兩個名詞的重新定義**（全文見 `docs/decisions.md` §CI63.1）。
前四輪都假設「代入感 ＝ 從既有資料榨出更多意義」，這個假設被推翻了。

##### 8.45.1 量到的兩個缺口

**缺口一：面板讀不到「這個人是誰」。** 對 `CharacterPlayHUD.jsx` 掃角色物件的欄位：

| 欄位 | 出現次數 |
|---|---|
| `identity`／`origin` | 各 1 |
| `equipment` | 15 |
| `gender` | **0** |
| `background` | **0** |

同一份 `background` 在名冊卡（`CharacterCard.jsx:226`）**畫得出來**——所以不是資料拿不到，
是這一頁沒有去拿。

**缺口二：數值變了，畫面沒有回應。** 全站 65 處 `transition`／`animate-`，真正會動的只有
`animate-fade-in`；四條資源條只有 `width` 在動。另外 `.crisis-pulse-active`（2026-10-25 建立）
只有名冊卡與戰鬥卡在用，跑團面板的 HP 卡一直沒接上。

##### 8.45.2 做的兩件事

| 模組 | 職責 | 寫入 |
|---|---|---|
| `utils/characterDossier.js` | 把性別／出身／身份／主題／背景排成可讀列 ＋ 摘要句 | **零** |
| `components/GaugeBar.jsx` | 主條 ＋ 尾影（同一個 `width`，差在 CSS duration／delay） | **零** |
| `components/ResourceDeltaBadge.jsx` | 浮字（比對前後 render 的值，0.9 秒後消失） | **零** |

新增輸入框 **0 個**。測試 `F1` 直接比對「展開前後的 `<input>` ＋ `<textarea>` 數量」必須相等。

##### 8.45.3 三個量測陷阱（新踩到的）

1. **測試全綠，畫面糊成一團。** 浮字第一版 `right-1 -top-4`，實機截圖裡 `-8` 壓在 `42 / 50` 上。
   修法是加**幾何**斷言（`collide()`：外框不得與任何純數字元素相交），不是加文字斷言。
2. **量到的是空盒子。** `data-testid` 掛在 `inset-x-0` 的外層上，外框是整條 bar 的寬度，
   `collide()` 永遠說「壓到了」。分成兩層才量得對。
3. **`@keyframes` 的 `transform` 會蓋掉 `-translate-x-1/2`。** 置中改用 `inset-x-0` ＋ `text-center`。

##### 8.45.4 順帶刪掉的死碼

`describeResourceDelta` 原本有 `typeof` 檢查 ＋ `Number.isFinite` 兩行。刻意破壞驗證把第一行拿掉
→ **全綠**。`Number.isFinite` 用 IsNumber（不做強制轉型），一個就擋掉全部非數字。
第一行在任何輸入下都等價 → 不是保險，是看起來像護欄的死碼，已刪。

##### 8.45.5 收尾數字

- 全套 **41 支測試 / 6,274 條斷言 / 0 FAIL**（新增 `test:dossier` 60、`test:feedback` 65）
- 刻意破壞 **17 / 17 全部轉紅**（`scratch/break-check-dossier.mjs` 8、`scratch/break-check-feedback.mjs` 9）
- 實機 `scratch/p43-console.mjs` **21 / 21**；截圖 4 張，md5 兩兩不同
- `npm run build` exit 0
- `test:uisystem` 292 → **295 / 295**（改了兩條斷言，理由見下）

##### 8.45.6 改了兩條既有護欄（理由）

| 護欄 | 舊 | 新 | 為什麼 |
|---|---|---|---|
| 「資源條三色語意」 | 數 `h-full rounded-full transition-all duration-300` | 數 `<GaugeBar` ＋ 逐條點名四個 `testId` | 舊寫法數的是**舊實作的字串**。改版後它永遠是 0，而 0 是紅——下一個人會以為資源條壞了，其實壞的是斷言 |
| `H34-c` 全圓反向控制 | `>= 98` | `>= 95` | 四條資源條收斂進元件（原始碼 8 處 → 3 處）。**渲染出來的圓角元素其實變多**（4×3＝12，原本 4×2＝8）——文字掃描數的是原始碼次數，不是畫面元素 |

> 兩條都是 MEMORY §C10 的第 ② 類：**斷言一直在記錄舊行為**。改的時候保住了它順帶守的東西
> （前者多守了「是哪四條」，後者在同一支檔案裡交換到更強的守衛）。

#### 8.46 第五十六輪（2026-10-30，P6）：事前可用性

**起點是一句「不呆板」**（全文見 `docs/decisions.md` §CI64）。量下去發現問題不是外觀，
是**順序**：八處成本門檻全部寫成「按下之後才 `showToast` 說不行」。

##### 8.46.1 八處門檻

| 位置 | 門檻 | 單位 | 提示位置 |
|---|---|---|---|
| 大補藥／萬靈藥 | 3 | IP | 按鈕內 |
| 滋補藥／元素碎片 | 2 | IP | 按鈕內 |
| 魔法帳篷 | 4 | IP | 按鈕內 |
| 咒語（逐條） | `sp.mp` | MP | 按鈕外 |
| 儀式 | `finalMp` | MP | 按鈕外 |
| 羈絆激勵 | 1 | 物語點 | 全域一行 |

##### 8.46.2 新增的兩個模組

| 模組 | 職責 | 寫入 |
|---|---|---|
| `utils/playAvailability.js` | `describeCostGate`／`gateButtonAttrs`／三組樣式常數 | **零** |
| `components/UnavailableHint.jsx` | 印一行「差 N 單位」；沒被擋回 `null` | **零** |

**按下後的守衛 0 條被拆**（測試 `H1–H9` 逐條點名八個 `if` 還在）。
**刻意不用 `disabled`**：會吃掉 `title`、也拿不到焦點，說明文字等於消失。

##### 8.46.3 三個新踩到的量測陷阱

1. **`opacity` 是整棵子樹相乘。** 按鈕壓 `opacity-50`，按鈕裡的「差 3 IP」跟著變淡
   ——灰掉正好把「為什麼不能用」也灰掉。而 `getComputedStyle(提示).opacity` **仍回 1**
   （opacity 不是繼承，是合成），所以量提示自己永遠看不到；要沿祖先鏈相乘。
   修法：外殼只關游標、內容才壓透明度（`GATED_SHELL_CLASS` / `GATED_LABEL_CLASS`）。
2. **`opacity-45` 不在 Tailwind 3 尺度裡**（…40、50…）。寫了不生成樣式，
   等於「以為灰了其實沒灰」，而畫面不會報錯。
3. **整頁截圖 1056px 寬時 12px 字只剩幾像素。** 給 `scratch/cdp.mjs` 補 `shotEl(file, selector, scale)`
   用 CDP `clip` 截原生解析度（`clip` 要文件座標，`getBoundingClientRect()` 要自己加 `scrollX/Y`）。

##### 8.46.4 刻意不擋的事

HP 全滿還吃大補藥、沒有異常還喝滋補藥——**不擋**。付不起是規則，浪費是玩家的判斷。
與 P5 的裁定同源：「理由讓玩家自己知道就好，只做操作層面。」

##### 8.46.5 收尾數字

- 全套 **42 支測試 / 6,377 條斷言 / 0 FAIL**（新增 `test:availability` 103 條）
- 刻意破壞 **12 / 12 全部轉紅**（`scratch/break-check-availability.mjs`）
- 實機 `scratch/p44-console.mjs` **22 / 22**；截圖 4 張 md5 兩兩不同，另加 1 張原生裁切
- `npm run build` exit 0
- 新增輸入框 **0 個**；`test:uisystem` 295 → **295 / 295**（未動）

##### 8.46.6 順帶修掉的三處指路錯誤

P5 留下的三處註解寫「去構築與成長**第 8 步**改」——那是**原書**步數，本專案編輯器只切六步。
指到不存在的地方比不指更糟，已統一為第 6 步。

#### 8.47 第五十七輪（2026-10-30，P7）：狀態異常的順序、效果碼與位置

##### 8.47.1 三句話其實是一件事

使用者的要求是「每個按鈕寫上簡單效果（`DEX ⬇`／`DEX · INS ⬇`）、照 `緩慢 眩暈 虛弱 動搖 憤怒 中毒`
排序、按鈕和四維相近」。看起來是加文字／換順序／搬家三件雜事，實際上是同一件事：
**讓「DEX 從 d10 掉到 d8」的原因，出現在 DEX 旁邊，而且照屬性排好。**

##### 8.47.2 他給的順序不是喜好

`緩慢 眩暈 虛弱 動搖` ＝ DEX／INS／MIG／WLP，`憤怒 中毒` ＝ DEX·INS／MIG·WLP。
單屬性在前（照四維順序）、雙屬性在後——於是兩欄格子的**前兩列與上方四維逐格對齊**：
緩慢↔DEX、眩暈↔INS、虛弱↔MIG、動搖↔WLP。實機量左右邊界誤差 ≤ 1px。

順序寫成 `STATUS_AFFLICTION_ORDER`，**不動 `STATUS_AFFLICTIONS` 本身的排列**——
後者被 `calculateCharacterStats` 用來推導每項減值的來源名稱，動它會連帶改掉公式面板的排列。
介面順序歸介面、資料順序歸資料，兩者的一致性由測試逐字比對。

##### 8.47.3 效果碼是推導的，不是抄的

`DEX · INS` 一律由 `affectedStats` 算出來（`describeAfflictionStats`），
模組裡**不准出現 DEX／INS／MIG／WLP 的字面值**（`test:affliction` D3／D4 去註解後掃全模組）。

寫死一份對照表的代價不是多幾行，是**不一致的那天沒有人會知道**：
按鈕上寫 DEX、實際扣 INS，玩家不會回報「資料層有第二個真相」，他只會覺得這個 App 壞了。

##### 8.47.4 位置：搬進四維卡片，代價是左欄多 30px 空白

原本這一塊在整頁最下方、滿版寬，與四維之間隔了整個左翼與中央立繪。
搬進四維卡片底部（常用檢定之後）後，四維格子底端到狀態區塊頂端 **46px**。

代價是右翼變高、左翼的 IP 卡片被拉長，內部空白 60 → 約 90px。
**刻意接受**：那 30px 換到的是「原因就在數字下面」。
反過來把狀態搬到左翼去填那塊空白，會讓它離四維最遠，直接違反第三句話。

##### 8.47.5 拿掉的與換掉的

- 拿掉按鈕上的 `(-1階)`：六個狀態**全都是 1 階**，寫六次是噪音。實際降幅在上方四維
  （d10 被劃掉、旁邊是 d8）與公式面板看得到；完整說明仍在 `title`，測試逐顆驗 title 還在。
- 箭頭用 `↓`（U+2193）不用 `⬇`（U+2B07）：後者可被當 emoji 以彩色字型渲染，
  在紙墨色系裡會冒出一顆彩色方塊，而且各平台長得不一樣。

##### 8.47.6 三個量測陷阱

1. **`innerText` 不為 flex 的 `gap` 補空白**：兩個相鄰 `<span>` 給的是「緩慢DEX ↓」，
   畫面上卻是分開的。量文字要量「看起來的樣子」。
2. **樣板字串裡的註解不能有反引號**：實機腳本把整段 `eval` 內容寫在反引號裡，
   註解裡再用反引號標程式碼 → 字串當場截斷，錯誤指向函式開頭而不是那一行。
3. **斷言只驗一半的狀態＝沒驗**：第一版「按鈕上不得出現 `-1階`」驗的是「全不生效」的畫面，
   把 `{isActive && <span>(-1階)</span>}` 加回去時根本不會渲染——弄壞了測試照樣全綠。
   補上「全生效」那一組才真的擋住回歸。

##### 8.47.7 收尾數字

- 全套 **43 支測試 / 6,442 條斷言 / 0 FAIL**（新增 `test:affliction` 65 條）
- 刻意破壞 **13 / 13 全部轉紅**（`scratch/break-check-affliction.mjs`）
- 實機 `scratch/p47-console.mjs` **34 / 34**（含 6 條逐格對齊的幾何斷言）；截圖 5 張
- `npm run build` exit 0
- 新增模組 1 個（`afflictionDisplay.js`）；新增輸入框 **0 個**、新增寫入路徑 **0 條**
