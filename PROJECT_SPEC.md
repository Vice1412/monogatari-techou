# ⚔️ FU Companion 《物語助手》 - 跑團整合助手 APP 規格與開發執行指南

> ⚠️ **文件狀態：已過時（歷史願景文件），不得作為現況事實依據。**
>
> 本文件為專案**初期**的願景與分步實施指南。實作過程中架構與視覺語彙均已演進，
> 多處描述與當前源碼不符。**規範效力**以 `GEMINI.md` 為第一順位、`AGENTS.md` 為第二順位；
> **事實陳述**一律以當前工作區源碼為唯一基準（依 `GEMINI.md` 規則六）。
>
> **已知過時處（2026-10-04 更正，詳見 `AGENTS.md` §5 B）**：
> - §1 核心原則 2：**非**深色石板底。全站為**羊皮紙暖色調**（`#fbf7ee` / `#3c2415` / `#d6c7ab`）。
> - §2 圖標庫：**非**以 `lucide-react` 為主。三軌鐵律為「官方字型 `.fu-icon` / 敘事性 `react-icons/gi` / 功能性控件可用 lucide 或純 Unicode」。
> - §3 目錄結構：`src/types/`、`src/utils/storage.js`、`src/utils/exportImport.js`、`JRPGSelect.jsx` **皆不存在**。
> - §3 模塊順序：第四個章節是 **`clocks`（命刻記錄）**，非 `dice-roller`；骰子為全域浮動模態窗 `DiceRollerModal`。
> - §4 色彩系統：同 §1 核心原則 2，整節以深色石板底描述，已失效。
> - §6 分階段工作流：Phase 1–6 皆已完成，另經三輪技術債清理（見 `AGENTS.md` §6 D）。
>
> 本文件保留作為專案意圖的歷史記錄；**修訂它之前請先讀 `GEMINI.md` 與 `AGENTS.md`**。

> **文件定位**：本文件為 AI CLI 智能體（Antigravity CLI / Claude Code / OpenCode）的完整項目初始化與分步實施規範指南。
> **項目名稱**：`fu-companion FU Companion 《物語助手》`
> **項目實體目錄**：`"本專案根目錄"`

---

## 🎯 1. 項目概述與核心願景

本項目是專為日系奇幻桌上角色扮演遊戲 **《FU》** 打造的一體化跑團輔助 Web 應用。
徹底解決以往工具分散（NPC 構建器、角色卡、戰鬥輪次各自獨立）的痛點，將三者融合在同一個高質感、統一 JRPG 視覺風格的純前端單頁應用（SPA）中。

### 核心原則：
1. **純前端、零伺服器依賴**：數據以 `localStorage` 即時自動持久化，提供「一鍵導出 / 導入 JSON」完整備份，方便上線 Vercel / GitHub Pages。
2. ~~**JRPG 統一視覺語義**：深色石板底底色、琥珀金與青色符文高亮、細邊框微質感卡片、專屬進度時鐘（Clocks）。~~
   ⚠️ **已失效**：全站實際為**羊皮紙暖色調**（`#fbf7ee` / `#3c2415` / `#d6c7ab`）＋襯線字＋官方字型圖示，非深色石板底。
3. **組件零件先行**：所有頁面必須強制調用封裝好的原子 UI 零件庫，嚴禁頁面內隨意拼湊不同風格的按鈕或容器。
4. **數據血液貫通**：NPC 工坊生成的高危 Boss 或小怪、角色卡分頁中的玩家角色，皆可**一鍵「推入戰鬥輪次」**，實現數據零摩擦互通。

---

## 🛠️ 2. 技術棧與依賴

- **框架**：React 19 + Vite
- **樣式**：TailwindCSS + PostCSS + Autoprefixer
- ~~**圖標庫**：`lucide-react`~~ ⚠️ **已失效**：實際為三軌鐵律（官方字型 `.fu-icon` / 敘事性 `react-icons/gi` / 功能性控件可用 lucide 或純 Unicode），見 `GEMINI.md` 規則一。
- **特效工具**：`canvas-confetti`（大成功 / 絕殺特寫）
- **實用工具庫**：`clsx`, `tailwind-merge`

---

## 📐 3. 目錄結構與架構劃分

```text
fabula-companion/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── PROJECT_SPEC.md                 # 本技術規範手冊
└── src/
    ├── main.jsx
    ├── index.css                   # 全局 JRPG 配色、字體、捲軸與基底樣式
    ├── App.jsx                     # 外殼路由 / Tab 導航（分頁切換）與全局備份按鈕
    ├── components/
    │   └── ui/                     # 【核心零件庫】全站強制複用，保證 UI 絕對統一
    │       ├── JRPGButton.jsx      # 按鈕（主金/副灰/危險紅/幽靈邊框）
    │       ├── JRPGCard.jsx        # 容器卡片（石板灰、細線金邊、發光投影）
    │       ├── JRPGBadge.jsx       # 標籤（屬性、抗性、階級等標示）
    │       ├── JRPGModal.jsx       # 統一彈窗
    │       ├── JRPGInput.jsx       # 輸入框與數值步進器
    │       ├── JRPGSelect.jsx      # 統一下拉選單
    │       ├── ClockTracker.jsx    # Fabula 專屬 4/6/8 格進度圓盤時鐘
    │       └── StatBadge.jsx       # DEX/INS/MIG/WLP 骰階（d6~d12）標籤
    ├── features/                   # 【業務功能模塊】互相解耦，僅透過通用數據層通信
    │   ├── npc-workshop/           # 模塊 1：NPC 與怪物工坊
    │   │   ├── NPCWorkshop.jsx     # 主頁面
    │   │   ├── components/         # 怪物專用表單、技能添加器、抗性矩陣
    │   │   └── data/               # 怪物模板、法術庫、精英/首領規則加成
    │   ├── character-sheet/        # 模塊 2：玩家角色卡
    │   │   ├── CharacterSheet.jsx  # 主頁面
    │   │   ├── components/         # 屬性、職業技能、裝備、法術、個人時鐘
    │   │   └── data/               # 官方職業推薦、武器防具表
    │   ├── combat-tracker/         # 模塊 3：戰鬥與回合追蹤器
    │   │   ├── CombatTracker.jsx   # 主頁面（輪次控制、先攻列表、場景時鐘）
    │   │   ├── components/         # 參戰者卡片、實時 HP/MP 扣減、狀態異常開關
    │   │   └── utils/              # 輪次循環演算法、先攻排序
    │   └── dice-roller/            # 全域浮動模態窗（非章節）
    │       └── DiceRollerModal.jsx # 雙屬性檢定、HR（High Roll）、大成功/大失敗計算
    ├── types/                      # ⚠️ 不存在（實際無此目錄）
    │   ├── character.js            # ⚠️ 不存在
    │   ├── npc.js                  # ⚠️ 不存在
    │   └── combat.js               # ⚠️ 不存在（跨模組轉換改於各 feature 內實作）
    └── utils/                      # 實際僅 soundEffects.js
        ├── storage.js              # ⚠️ 不存在（各 feature 自行讀寫 localStorage）
        └── exportImport.js         # ⚠️ 不存在（備份還原實作於 App.jsx）
```

> ⚠️ **實際章節順序**：`character`（角色卡助手）／`workshop`（NPC 工坊）／`combat`（戰鬥輪次）／
> **`clocks`（命刻記錄）**。第四個章節**不是** `dice-roller`。

---

## 🎨 4. JRPG 視覺風格規範 (Design System)

所有 CLI Agent 在撰寫組件與樣式時，**嚴格遵循以下視覺語法**：

1. ~~**色彩系統**：~~
   ⚠️ **整節已失效**：以下為初期深色設計，**實際全站為羊皮紙暖色調**。實際值：
   - **底色**：`#fbf7ee`（NPC 工坊）／`#f4fbf7`（角色卡）／`#fdf4f5`（戰鬥輪次）／`#f0f9ff`（命刻記錄）；封面為 `#ebf5f8`。
   - **文字**：`#2c221e` / `#3c2415`；**邊框**：`#d6c7ab`（羊皮紙褐）；**卡面**：`#fffdf9`。
   - 保留有效的部分：`font-mono` 用於骰階與 HP/MP 數值；`rounded-lg` / `rounded-xl` 圓角統一。
   - ~~**底色 (Background)**：`bg-zinc-950`（主背景 `#0c0d0e`）、`bg-zinc-900`（卡片表面）。~~
   - ~~**主色 (Accent / Amber Gold)**：`amber-500` (`#f59e0b`)、`amber-400`（按鈕聚焦、核心數字、高亮邊框）。~~
   - ~~**輔色 (Runic Cyan / Magic)**：`cyan-400` / `sky-400`（MP 消耗、法術、特技標籤）。~~
   - ~~**生命 (Health / Danger)**：`rose-500` / `red-500`（HP 條、危機 Crisis 觸發閃爍）。~~
   - ~~**邊框 (Border)**：`border-zinc-800`（常態）、`border-amber-500/40`（聚焦或重要頭部）。~~
2. **字體與排版**：
   - 等寬數字排版：骰階、HP/MP 數值使用 `font-mono`，避免數值跳動導致佈局抖動。
   - 圓角：統一為 `rounded-lg` 或 `rounded-xl`，禁止不同模塊出現生硬的混用。
3. **Fabula 特色元素**：
   - **Crisis（危機狀態）**：HP <= 最大 HP 的 50% 時，卡片與血條自動觸發暗紅色呼吸燈閃爍效果。
   - **Clocks（進度時鐘）**：可配置 4、6、8 格切片，點擊切片可切換填充狀態。
4. **圖標庫規範 (Icons System)**：
   - **官方屬性與傷害標識**：強制調用 Fabula Ultima 官方專屬字型圖標庫（`FabulaUltimaIcons-Regular.otf` / `.fu-icon`）。
   - **全站所有其餘圖標**：**默認一律從 [Game-Icons.net](https://game-icons.net/)（透過 `react-icons/gi`）選取**，嚴禁隨意混用現代極簡扁平圖標，除非使用者有額外明確指示。以維持最高規格之正統 JRPG/TRPG 桌遊魔導書沈浸質感。

---

## 🔄 5. 數據模型與跨模塊聯動協議

### A. 角色卡 (Character) 核心字段：
- 基礎：`id`, `name`, `identity`, `theme`, `origin`
- 屬性骰階：`dexterity`, `insight`, `might`, `willpower` (數值為 6, 8, 10, 12)
- 資源：`hp: { current, max }`, `mp: { current, max }`, `ip: { current, max }`, `fabulaPoints: number`
- 裝備、職業技能、個人 Clocks。

### B. NPC 核心字段：
- 基礎：`id`, `name`, `level`, `species` (Beast, Construct, Demon, Elemental, Humanoid, Monster, Plant, Undead)
- 階級：`rank` ('soldier' | 'elite' | 'champion' | 'companion')
- 屬性：`attributes: { dex, ins, mig, wlp }`
- 防禦與先攻：`defense`, `magicDefense`, `initiativeModifier`
- 弱點矩陣：各屬性抗性（None / Vulnerability / Resistance / Immunity / Absorption）
- 技能與法術列表。

### C. 戰鬥實體轉換協議 (`exportToCombatant`)：
無論是 Character 還是 NPC，呼叫該函數均轉化為標準 `Combatant` 實體直接灌入戰鬥器：
```javascript
{
  instanceId: string,          // 戰鬥實例 UUID
  sourceId: string,            // 源 Character 或 NPC ID
  sourceType: 'character' | 'npc',
  name: string,
  level: number,
  rank: string,
  hp: { current, max, crisisThreshold },
  mp: { current, max },
  attributes: { dex, ins, mig, wlp },
  defense: number,
  magicDefense: number,
  initiative: number,          // 檢定後的先攻值
  hasActed: boolean,           // 本輪是否已行動
  statusEffects: {             // 6 大 FU 異常狀態
    slow: boolean,             // 敏捷降階
    dazed: boolean,            // 洞察降階
    weak: boolean,             // 力量降階
    shaken: boolean,           // 意志降階
    enraged: boolean,          // 狂怒
    poisoned: boolean          // 中毒
  }
}
```

---

## 🚀 6. CLI Agent 分步實施工作流 (Phases)

請接管本項目的 CLI Agent 按照以下階段循序漸進實施，每完成一階段進行本地驗證：

### 【Phase 1: 環境搭建與骨架建立】
1. 在 `"本專案根目錄"` 初始化 Vite + React 項目。
2. 安裝 TailwindCSS、`lucide-react`、`canvas-confetti`、`clsx`、`tailwind-merge`。
3. 配置 `tailwind.config.js` 與全局 `index.css`（JRPG 深色主題底色、自定義滾動條）。
4. 驗證構建 `npm run build` 通過。

### 【Phase 2: 共享 UI 零件庫】
1. 在 `src/components/ui/` 封裝完成：
   - `JRPGButton.jsx`
   - `JRPGCard.jsx`
   - `JRPGBadge.jsx`
   - `JRPGInput.jsx`
   - `ClockTracker.jsx`（SVG 繪製 4/6/8 格進度時鐘）
2. 實現主佈局 `App.jsx`：頂部導航欄（4 個 Tab 切換 + 數據導出導入備份按鈕）。

### 【Phase 3: 移植並升級 NPC 工坊 (NPC Workshop)】
1. 參考原項目已有的 NPC 生成規則（或已有的 `fu-npc-builder` 邏輯）：
   - 等級選擇（1~60）、種類選擇、階級選擇（小兵、精英、首領）。
   - 屬性點自動計算與分配。
   - 攻擊方式（近戰/遠程）、傷害公式【HR + X】。
   - 弱點抗性選取矩陣。
2. 界面全面適配 Phase 2 的 JRPG UI 零件。
3. 增加「⚔️ 派入戰鬥」按鈕。

### 【Phase 4: 玩家角色卡模塊 (Character Sheet)】
1. 實現 4 大屬性骰階（d6, d8, d10, d12）切換器。
2. 實現 HP / MP / IP 實時調整與 Crisis 警戒警示。
3. 實現職業技能、裝備欄位、個人時鐘清單。
4. 增加「⚔️ 加入戰鬥」按鈕。

### 【Phase 5: 戰鬥與回合追蹤器 (Combat Tracker)】
1. 實現參戰者列表（區分「玩家小隊」與「敵方怪物」）。
2. 先攻輪次管理器：
   - 支援「回合數（Round）」計數。
   - 標記每位參戰者「已行動 / 未行動」，全員行動後自動推進下一輪。
3. 實時血量控制（+1, -1, -5, +5, 自定義扣減）、MP 扣減。
4. 6 大狀態異常（Slow, Dazed, Weak, Shaken, Enraged, Poisoned）點擊切換。
5. 場景時鐘（Scene Clocks）多個動態添加與計數。

### 【Phase 6: 擲骰面板與數據備份閉環】
1. 全局浮動/側邊擲骰器：支持選擇任意雙屬性（如 DEX + INS）點擊擲骰，自動算出擲骰結果、高點（High Roll）並判定大成功（雙骰相同且>=6）與大失敗（雙1）。
2. 實現完整的 `localStorage` 自動保存與 `JSON 導出/導入` 數據備份。
3. 執行最終 `npm run build` 構建檢驗，確保無任何語法錯誤。

---

## 📌 執行備忘與安全紅線
- **本地第二大腦聯動**：實施過程中若有重大功能里程碑，記得將進度更新至本機的 Obsidian 專案筆記。
  （原始路徑含使用者名稱，因本 repo 為公開已於 2026-10-04 移除；實際位置由使用者自行維護。）
- **嚴禁洩露密鑰**：全站純前端運行，嚴禁在代碼或配置文件中寫入任何敏感個人密鑰。
