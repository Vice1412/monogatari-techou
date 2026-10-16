> ## ※ 本文件已過時（2026-10-16 加註）
>
> **本指南針對的檔案 `src/features/npc-workshop/components/NPCBuilder.jsx` 已經不存在。**
> 實測 `find src -name "NPCBuilder*"` 回空；現在的結構是單一的
> `src/features/npc-workshop/NPCWorkshop.jsx`（6,443 行）＋ 已抽出的
> `data/`（7 檔）與 `utils/npcEngine.js`。**照著本文件開工會找不到檔案。**
>
> 另外本文件建立於 2026-09-20，當時專案名仍是舊名 `FU Companion`（已因版權問題廢棄）。
>
> **仍可參考的部分**（這是本文件不被刪除的唯一理由）：
> - §2 官方《快速建構》8 步驟架構
> - §3 配額算法（`calculateNpcBudgets` 的階級／等級／負面技能／物種／弱點加成公式）
> - §6 驗收測試清單（劍聖機甲 HP 260 等官方範例數值）
>
> **現況與重構方案請看**：`docs/functional-audit-2026-10-16.md`（第五節）。
> 該節以當前實際源碼重新量測，並給出「先補快照護欄 → 就地拆 state → 才拆元件」的順序。

---

# ⚔️ 《最終物語》NPC 工坊重構與官方快速建構規範對齊指南

> **文件定位**：本手冊為交由 IDE / AI Agent 進行程式碼重構的完整執行規範指南。  
> **目標**：修復 `src/features/npc-workshop/` 現存的步驟錯亂、資料斷頭與配額缺失問題，使其 **100% 精準對齊《Fabula Ultima 快速建構 (Quick Building)》官方手冊標準**。

---

## 📋 目錄
1. [現狀診斷與重構核心目標](#1-現狀診斷與重構核心目標)
2. [官方標準 8 步驟架構與 UI 導航重組](#2-官方標準-8-步驟架構與-ui-導航重組)
3. [配額算法與規則引擎 (Budget & Rules Engine)](#3-配額算法與規則引擎-budget--rules-engine)
4. [各模塊具體檔案修改指令 (File-by-File Instructions)](#4-各模塊具體檔案修改指令-file-by-file-instructions)
5. [圖標與 JRPG 視覺風格規範](#5-圖標與-jrpg-視覺風格規範)
6. [驗收測試清單 (Acceptance Criteria)](#6-驗收測試清單-acceptance-criteria)

---

## 1. 現狀診斷與重構核心目標

### 🚨 現存問題分析
1. **步驟順序倒置**：目前 `NPCBuilder.jsx` 的 Step 1 先選物種（Species），Step 2 才是定位。官方規則明確強調「**定位優先 (Role First)**」，物種是第 6 步，其加成依附於已確立的定位基底。
2. **致命的資料斷頭**：
   - 各定位專屬的 **定位技能庫（Role Skills）** 在 `roles.js` 中完整存在，但 `NPCBuilder.jsx` 介面上**完全未渲染**，使用者只能看到「加普攻」和通用法術。
   - **負面技能（Negative Skills）** 在 `negativeSkillsData.js` 中存在，但介面上**完全沒有入口**。
   - **Boss 技能（Boss Skills）** 在 `bossSkillsData.js` 中有完整 40 個，但介面被硬編碼切片 `BOSS_SKILLS_DATA.slice(0, 6)` **閹割成只剩 6 個**。
3. **缺乏配額計算與平衡提示（Budget Tracker）**：使用者在配置抗性或技能時，無法得知當前等級/階級允許選幾個，失去了快速建構「數值防呆與安全網」的作用。

### 🎯 重構目標
- 重組 `NPCBuilder.jsx` 的步驟導航，完全符合官方 8 步驟心智模型。
- 全面接通 `roles.js` 的定位技能庫、客製化選項、`negativeSkillsData.js` 與 40 個 `bossSkillsData.js`。
- 在頂部或右側卡片增加即時「**技能與抗性配額儀表板 (Budget Tracker)**」。
- 保持全站圖標默認調用 **[Game-Icons.net](https://game-icons.net/) (`react-icons/gi`)**。

---

## 2. 官方標準 8 步驟架構與 UI 導航重組

將 `NPCBuilder.jsx` 中的步驟重構為以下結構（可組織為 8 大分頁步驟，或 5 大邏輯章節）：

```text
├── 步驟 1：定位選擇 (Choose Role)
│   └── 6 大原型：暴徒 (Brute)、獵人 (Hunter)、法師 (Mage)、破壞者 (Saboteur)、衛士 (Sentinel)、輔助 (Support)
├── 步驟 2：等級與階級 (Level & Rank)
│   ├── 等級：5, 10, 20, 30, 40, 50, 60
│   ├── 階級：士兵 (Soldier)、精英 (Elite)、冠位 (Champion ×1~×6)
│   └── 反派等級：無、小反派 (+1 UP)、大反派 (+2 UP)、終極反派 (+3 UP)
├── 步驟 3：基礎數值與攻擊 (Stats & Basic Attacks)
│   ├── 四維屬性骰（自動依等級成長配置，可選自由調骰模式）
│   ├── HP / MP / 先攻 / 物理防禦 / 魔法防禦（顯示加成來源公式）
│   ├── 基礎攻擊配置（普通攻擊 / 強力攻擊，公式、距離與屬性下拉配置）
│   └── 客製化選項（Customization：如 +10 HP 或定位專屬特殊規則，供士兵/精英/冠位選擇 1 項）
├── 步驟 4：屬性相性矩陣 (Affinities & Affinities Budget)
│   ├── 9 大屬性矩陣切換（一般 ➔ 弱點 ➔ 抗性 ➔ 免疫 ➔ 吸收）
│   └── 弱點與抗性配額儀表板（提示：基礎弱點數、等級解鎖抗性/免疫數）
├── 步驟 5：定位技能庫與法術 (Role Skills & Spells)
│   ├── 定位技能庫：讀取 ROLES_DATA[role].availableSkills，支援技能參數配置（selectionsConfig）
│   ├── 咒語書挑選器（針對有施法能力的原型）
│   └── 定位技能配額指示器（顯示：可用 X 個，已選 Y 個）
├── 步驟 6：Boss 技能與負面技能 (Boss & Negative Skills)
│   ├── 冠位 Boss 技能（若階級為冠位，開放完整 40 個技能，分類抽屜：戰場/控制/防禦/破壞/形態/動作）
│   └── 負面技能配置器（8 大負面技能，選取後為 NPC 額外增加 1 個定位技能或 Boss 技能名額）
├── 步驟 7：生物物種 (Choose Species)
│   ├── 8 大物種：野獸、構造體、惡魔、元素、類人、怪物、植物、不死
│   ├── 先天抗性/免疫與專屬弱點連動
│   └── 種族專屬特性與增益選擇（如類人無裝備補償 +1 技能、構造體額外弱點換取狀態免疫等）
└── 步驟 8：命名、特質與戰術慣例 (Name, Traits & Routine)
    ├── NPC 名稱、陣營/分類、標籤 (Tags)
    ├── 3~4 個核心特質短評 (Traits)
    └── 戰術行動慣例 (Action Routine：如「普攻 ➔ 強攻 ➔ 技能」，引導 GM 設計清晰的回合循環)
```

---

## 3. 配額算法與規則引擎 (Budget & Rules Engine)

請在 `src/features/npc-workshop/utils/npcEngine.js` 中實作或強化以下配額計算邏輯：

### A. 定位技能配額 (Role Skills Budget)
$$\text{Total Role Skills} = \text{Rank Bonus} + \text{Level Bonus} + \text{Negative Skill Bonus} + \text{Species Bonus} + \text{Weakness Bonus}$$

- **階級加成 (Rank Bonus)**：
  - 士兵 (Soldier)：`0`
  - 精英 (Elite)：`+1`
  - 冠位 (Champion (X))：`+X`（等於冠位倍率，預設 1~6）
- **等級里程碑加成 (Level Bonus)**：
  - 等級 $\ge 20$：`+1`
  - 等級 $\ge 40$：`+1`
  - 等級 $\ge 60$：`+1`
- **負面技能補償 (Negative Skill Bonus)**：
  - 若配置了負面技能（Negative Skill）：`+1`（可用於定位技能或 Boss 技能）
- **物種補償 (Species Bonus)**：
  - 類人生物 (Humanoid)：因無裝備規則，獲得 `+1` 技能。
  - 野獸/惡魔/元素等：若在種族選項中勾選「額外定位技能」，則相應增加。
- **物理弱點補償 (Weakness Bonus)**：
  - 快速建構規則特殊條款：若 NPC 被賦予「物理屬性弱點 (Vulnerability to Physical)」，獲得 `+1` 額外技能（註：非官方舊版規則的 2 個）。

### B. 抗性與免疫配額 (Affinities Budget)
- **基礎弱點**：
  - 暴徒：基礎 `2` 個弱點。
  - 獵人 / 法師 / 破壞者 / 衛士 / 輔助：基礎 `1` 個弱點。
- **等級解鎖抗性/免疫 (Level Milestones)**：
  - **暴徒 / 法師 / 破壞者 / 衛士 / 輔助**：
    - Lv 10+：獲得 `2` 個抗性 (Resistances) 額度。
    - Lv 30+：獲得 `1` 個免疫 (Immunities) 額度。
  - **獵人 (Hunter)**：
    - 獵人成長曲線不同，Lv 50+ 獲得 `2` 個抗性額度。

### C. 客製化名額 (Customization Budget)
- 士兵、精英、冠位均固定享有 `1` 個客製化名額（選擇：增加 10 HP，或從定位客製化清單選 1 項特殊規則）。

---

## 4. 各模塊具體檔案修改指令 (File-by-File Instructions)

### 檔案 1：`src/features/npc-workshop/utils/npcEngine.js`
1. **導出配額計算工具函數 `calculateNpcBudgets(npc)`**：
   - 計算並返回：
     ```javascript
     return {
       roleSkills: { max: totalRoleSkills, used: usedRoleSkills },
       customization: { max: 1, used: usedCustomization },
       bossSkills: { max: npc.rank === '冠位' ? (1 + extraBossBudget) : 0, used: usedBossSkills },
       resistances: { max: maxRes, used: usedRes },
       immunities: { max: maxImm, used: usedImm },
       weaknesses: { min: requiredVul, current: currentVul }
     };
     ```
2. **修復模板變數動態替換 `resolveTemplateVariables`**：
   - 確保 `[少量]`、`[大量]`、`[巨量]`、`[碾壓傷害]` 以及 `{type}`、`{status}`、`{distance}` 都能依據 `npc.level` 正確解析為數字與具體文字，不留生硬的 `{key}` 標籤。

---

### 檔案 2：`src/features/npc-workshop/components/NPCBuilder.jsx`
1. **重構步驟 Tabs**：
   - 更新 `STEPS` 陣列為 8 步驟（或 5 大集成階段），保證「步驟 1：定位」➔「步驟 2：等級/階級」➔「步驟 3：基礎數值」➔「步驟 4：抗性」➔「步驟 5：定位技能」➔「步驟 6：Boss/負面技能」➔「步驟 7：物種」➔「步驟 8：特質戰術」。
2. **在「步驟 5：定位技能」中完整渲染 `availableSkills`**：
   - 從 `ROLES_DATA[npc.role].availableSkills` 讀取清單。
   - 區分「客製化選項 (Customization)」與「定位技能 (Role Skills)」。
   - 提供技能參數配置介面（例如選擇屬性 `{type}`、異常狀態 `{status}`、攻擊距離 `{distance}` 等下拉選單）。
3. **在「步驟 6：Boss 技能與負面技能」中**：
   - **負面技能選擇器**：引入 `NEGATIVE_SKILLS_DATA`，允許勾選 1 項負面技能，並即時增加技能配額。
   - **完整 Boss 技能庫**：**徹底移除 `.slice(0, 6)`**，改以分類摺疊抽屜（Accordion）展示全部 40 個技能，並支援關鍵字搜尋。
4. **增加「配額狀態列 (Budget Bar)」**：
   - 在編輯器頂部或右側預覽上方，以徽章（Badges）形式直觀展示：
     - `定位技能：1 / 2`
     - `抗性：2 / 2`
     - `免疫：1 / 1`
     - `Boss技能：1 / 1`（僅冠位顯示）
   - 當超出或不足時以顏色警示（正常綠/琥珀，超額紅）。

---

### 檔案 3：`src/features/npc-workshop/components/NPCCardPreview.jsx`
1. **卡片即時同步**：
   - 確保卡片中的技能描述經過 `resolveTemplateVariables` 解析。
   - 正確顯示客製化規則、定位技能、Boss 技能與負面技能的分組標籤。
   - 正確渲染官方字型圖標（`.fu-icon`）與屬性抗性符號。

---

## 5. 圖標與 JRPG 視覺風格規範

- **圖標規範**：所有 UI 圖標**一律默認調用 `react-icons/gi` (Game-Icons.net)**（屬性與傷害標識除外，調用 `.fu-icon`）。
  - 定位圖標：`GiDragonHead` (暴徒), `GiCrossbow` / `GiVisoredHelm` (獵人), `GiWizardStaff` / `GiSpellBook` (法師), `GiDaggers` (破壞者), `GiShieldReflect` (衛士), `GiHeartPlus` / `GiLaurelCrown` (輔助)。
  - 功能操作：`GiSparkles` (新增), `GiTrashCan` (刪除), `GiSaveArrow` (匯出), `GiOpenChest` (匯入), `GiReturnArrow` (返回)。
- **配色主題**：嚴格遵循專案 JRPG 羊皮紙風格（`#fbf7ee` 底色、`#b45309` 琥珀金、`#d6c7ab` 石板細線邊框）。

---

## 6. 驗收測試清單 (Acceptance Criteria)

請在完成重構後依序驗證以下測試案例（Test Cases）：

- [ ] **測試案例 1：劍聖機甲（官方範例驗證）**
  - 設定：等級 30、精英、構造體、暴徒。
  - 驗證：
    - HP 是否為 260（基礎 120 + 客製化 10，精英 ×2）。
    - INS 是否自動提升為 d8，先攻提升為 10（7 + 2 + 1）。
    - 抗性配額是否正確解鎖（構造體自帶土抗性、毒免疫；等級 10/30 解鎖 2 抗性、1 免疫）。
    - 定位技能配額是否為 2 個（Lv.20 贈送 1 個 + 精英 1 個），且能順利挑選「強化防禦」與「穩定恢復」。
- [ ] **測試案例 2：40 個 Boss 技能完整性**
  - 將階級切換為「冠位」，檢查 Boss 技能抽屜是否能看到全部 40 個技能，並能正確添加戰場技能、控制技能等。
- [ ] **測試案例 3：負面技能聯動**
  - 選擇 1 個負面技能（如「臨終引爆」），檢查定位技能配額是否自動 +1。
- [ ] **測試案例 4：打包建構**
  - 執行 `npm run build`，確認 0 錯誤、0 警告通過。

---
*文件建立時間：2026-09-20 · 專為 FU Companion 專案標準化打造*
