import fs from 'node:fs';
import { HOPLOSPHERES, TECHNOSPHERE_MODES, SLOT_QUALITIES, MNEMOSPHERE_CLASSES } from '../src/features/character-sheet/data/technospheres.js';
import { ZERO_TRIGGERS, ZERO_EFFECTS, ZERO_VARIANTS } from '../src/features/character-sheet/data/zeroPowers.js';
import { CAMP_ACTIVITIES } from '../src/features/character-sheet/data/campActivities.js';

const cut = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};
const TICK = '☐';

const L = [];
L.push('# 選用規則打勾表（魔晶石 ＋ 底力技 ＋ 營地活動）');
L.push('');
L.push('> 自動生成自 `technospheres.js`／`zeroPowers.js`／`campActivities.js`（生成器：`scripts/gen-optional-rules-checklist.mjs`，已進版控）。');
L.push('>');
L.push('> **打勾規則**：`' + TICK + '` 未測 → `✔` 測過無問題 → `▲` 有缺陷（填缺陷號）→ `✕` 不適用（附一句為什麼）。');
L.push('>');
L.push('> **這三樣與「職業」不同**：職業是「加內容」，這三樣是「**換條件**」——開啟後會拿走東西、改變必填欄位、鎖住職業數。');
L.push('> 所以每一筆要回答的三問也不同：**①開啟後畫面有沒有告訴我它拿走了什麼 ②我在卡上真的做得到嗎 ③切回關閉後資料還在嗎**。');
L.push('');
L.push('---');
L.push('');

// ── 魔晶石 ──
L.push('## 一、魔晶石（Technospheres，科技奇幻手冊 p.132–145）');
L.push('');
L.push('落在**第 4 步（裝備配置）**與**第 2 步（職業與技能，職業記憶球）**。預設 `off`。');
L.push('');
L.push('### 1.1 五態（**每一態是一個獨立的測試條件**，不是一個勾）');
L.push('');
L.push('| # | 態 | 名稱 | 它拿走／給什麼 | 測 | 缺陷 |');
L.push('|---|---|---|---|---|---|');
Object.values(TECHNOSPHERE_MODES).forEach((m, i) => {
  L.push(`| ${i + 1} | \`${m.key}\` | ${m.label} | ${cut(m.desc, 90)} | ${TICK} | |`);
});
L.push('');
L.push('> 五態之間**不是加減關係**：`integrated` 禁 δ、`mnemospheresOnly` 不給武器熟練、`hoplospheresOnly` 不給 +5 HP/MP。');
L.push('> 所以「切換態之後角色身上的資料會怎樣」是獨立的一筆，不是附註。');
L.push('');
L.push('### 1.2 插槽品級（4）');
L.push('');
L.push('| # | 品級 | 費用 | 插槽 | 職業魔石上限 | 測 | 缺陷 |');
L.push('|---|---|---|---|---|---|---|');
Object.values(SLOT_QUALITIES).forEach((q, i) => {
  L.push(`| ${i + 1} | ${q.label} | ${q.cost}z | ${q.slots} | ${q.maxMnemospheres} | ${TICK} | |`);
});
L.push('');
L.push(`### 1.3 附魔魔石（赫球，${HOPLOSPHERES.length} 筆，d66 對照）`);
L.push('');
L.push('> **d66 一律以英文 p.141–144 為準**（漢化整張表偏移一格，見 `technospheres.js` 檔頭）。');
L.push('> 這一節的檢查重點是「**抽到的名字與效果對不對得上**」，不是「有沒有這筆」。');
L.push('');
L.push('| # | d66 | 魔石 | 插槽 | 效果 | 測 | 缺陷 |');
L.push('|---|---|---|---|---|---|---|');
HOPLOSPHERES.forEach((h, i) => {
  L.push(`| ${i + 1} | ${h.d66} | ${h.name} · ${h.en} | ${h.slots} | ${cut(h.effect, 48)} | ${TICK} | |`);
});
L.push('');
L.push(`### 1.4 職業記憶球（${MNEMOSPHERE_CLASSES.length} 個可選職業）`);
L.push('');
L.push('> 檢查重點：**這 15 個職業與矩陣的 29 職業不是同一份清單**（記憶球只收 15 個）。');
L.push('> 若某職業出現在記憶球清單卻不該出現（或反之），是資料層缺陷，不是 UI 缺陷。');
L.push('');
L.push('| # | 職業 | 可放進記憶球 | 等級上限可達 | 測 | 缺陷 |');
L.push('|---|---|---|---|---|---|');
MNEMOSPHERE_CLASSES.forEach((n, i) => {
  L.push(`| ${i + 1} | ${n} | ${TICK} | ${TICK} | ${TICK} | |`);
});
L.push('');

// ── 底力技 ──
L.push('---');
L.push('');
L.push('## 二、底力技（Zero Powers，高度奇幻手冊 p.124–131）');
L.push('');
L.push('落在**第 5 步（英雄技能與特質）**。預設 `false`。');
L.push('一個新資源（底力命刻）＋ 七個觸發 ＋ 十一個效果 ＋ 兩個改變資料模型的變體。');
L.push('');
L.push(`### 2.1 觸發（${ZERO_TRIGGERS.length}）`);
L.push('');
L.push('| # | 觸發 | 填充數量 | 條件讀得懂嗎 | 測 | 缺陷 |');
L.push('|---|---|---|---|---|---|');
ZERO_TRIGGERS.forEach((t, i) => {
  L.push(`| ${i + 1} | ${t.name} · ${t.en} | ${t.fill} | ${cut(t.desc, 44)} | ${TICK} | |`);
});
L.push('');
L.push(`### 2.2 效果（${ZERO_EFFECTS.length}）`);
L.push('');
L.push('| # | 效果 | 有子選項 | 效果文 | 測 | 缺陷 |');
L.push('|---|---|---|---|---|---|');
ZERO_EFFECTS.forEach((e, i) => {
  L.push(`| ${i + 1} | ${e.name} · ${e.en} | ${e.choice ? '**是**' : ''} | ${cut(e.desc, 44)} | ${TICK} | |`);
});
L.push('');
L.push(`### 2.3 變體（${ZERO_VARIANTS.length}）`);
L.push('');
L.push('> 這兩筆**改變資料模型**（不是加選項）：`覺醒之力` 建角時只選效果不選觸發；`合體之力` 命刻改 4 格且兩人共用。');
L.push('> 檢查重點是「**選了它，畫面有沒有跟著變**」——這一類最常見的缺陷是選了但介面沒切換。');
L.push('');
L.push('| # | 變體 | 頁 | 說明 | 測 | 缺陷 |');
L.push('|---|---|---|---|---|---|');
ZERO_VARIANTS.forEach((v, i) => {
  L.push(`| ${i + 1} | ${v.name} | ${v.page} | ${cut(v.desc, 60)} | ${TICK} | |`);
});
L.push('');
L.push('### 2.4 命名表');
L.push('');
L.push(`| # | 項目 | 測 | 缺陷 |`);
L.push('|---|---|---|---|');
L.push(`| 1 | 命名表可瀏覽、可骰（120 詞，分動作／出身等組） | ${TICK} | |`);
L.push(`| 2 | 骰出的名字可以直接寫進角色卡 | ${TICK} | |`);
L.push('');

// ── 營地活動 ──
L.push('---');
L.push('');
L.push('## 三、營地活動（Camp Activities，自然奇幻手冊 p.130–133）');
L.push('');
L.push('落在**第 5 步**。預設 `false`。**它是開卡必選欄位**（原書 p.130：建角時選兩個），不是可選項。');
L.push('');
L.push(`| # | 活動 | 目標 | 每次休息限一次 | 摘要 | 測 | 缺陷 |`);
L.push('|---|---|---|---|---|---|---|');
CAMP_ACTIVITIES.forEach((a, i) => {
  L.push(`| ${i + 1} | ${a.name} · ${a.en} | ${a.target} | ${a.once ? '是' : ''} | ${cut(a.summary || a.desc, 44)} | ${TICK} | |`);
});
L.push('');
L.push('> **金手指出口**：【老大哥／歐尼醬】明文允許「團隊沒開時仍可使用，且可選 3 種」。');
L.push('> 所以要測兩條路徑：**規則給的**與**金手指給的**，且畫面必須說清楚是哪一條（否則玩家會以為 GM 開了規則）。');
L.push('');
L.push('---');
L.push('');
L.push('## 四、統計口徑');
L.push('');
const total = 5 + Object.keys(SLOT_QUALITIES).length + HOPLOSPHERES.length + MNEMOSPHERE_CLASSES.length
  + ZERO_TRIGGERS.length + ZERO_EFFECTS.length + ZERO_VARIANTS.length + 2 + CAMP_ACTIVITIES.length;
L.push('| 對象 | 分母 |');
L.push('|---|---|');
L.push(`| 魔晶石 | 5 態 ＋ 4 品級 ＋ ${HOPLOSPHERES.length} 赫球 ＋ ${MNEMOSPHERE_CLASSES.length} 記憶球職業 |`);
L.push(`| 底力技 | ${ZERO_TRIGGERS.length} 觸發 ＋ ${ZERO_EFFECTS.length} 效果 ＋ ${ZERO_VARIANTS.length} 變體 ＋ 2 命名表項 |`);
L.push(`| 營地活動 | ${CAMP_ACTIVITIES.length} |`);
L.push(`| **合計檢查單元** | **${total}** |`);
L.push('');
L.push(`> 但**五態不乘進去**：29 職業 × 5 態 = 145 個組合不可能全測。`);
L.push(`> 抽樣規則見 \`00-plan.md\` §13.6：**五態各驗一次「切換前後資料還在不在」**，`);
L.push(`> 內容只在一態（` + '`full`' + `）逐筆驗，其餘四態驗「差異點」不驗全量。`);
L.push('');

fs.writeFileSync('docs/playtest/checklist-optional-rules.md', L.join('\n'), 'utf8');
console.log('written, units =', total);
