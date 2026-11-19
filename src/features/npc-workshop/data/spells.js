import { DAMAGE_TYPES, STATUS_OPTIONS, STATUS_AND_POISON } from './constants';


/**
 * 舊版語意哨兵（U+26A1）。
 * 僅用於相容「尚未遷移」的 localStorage 舊存檔；此常數永不渲染、永不寫入新資料。
 * 以跳脫序列表示，避免原始碼中出現 Emoji 字面量（GEMINI.md 規則一軌道 3）。
 */
const LEGACY_OFFENSIVE_SENTINEL = '\u26A1';

/**
 * 判斷字串是否仍帶有舊版語意哨兵。
 *
 * 僅用於相容「尚未經 `migrateNpcState` 遷移」的舊資料；永不渲染、永不寫入新資料。
 * 供各消費端取代散落的哨兵字面量判定。
 *
 * @param {unknown} value - 待檢測值
 * @returns {boolean}
 */
export const hasLegacyOffensiveSentinel = (value) =>
  typeof value === 'string' && value.includes(LEGACY_OFFENSIVE_SENTINEL);

/**
 * 僅剝除舊版語意哨兵，**保留其餘格式**（特別是 `(Lv30+)` 等級標註）。
 *
 * 供遷移舊存檔使用。等級標註是咒語書選單的配額／顯示資訊，
 * 不可與哨兵一併去除——這正是本函式與 `normalizeSpellName` 的關鍵差別。
 * （`normalizeSpellName` 用於「查表」，兩者都去；本函式用於「改寫存檔」，只去哨兵。）
 *
 * @param {string} name - 原始名稱
 * @returns {string} 已去除哨兵、保留等級標註的名稱
 */
export const stripLegacySentinel = (name) =>
  typeof name === 'string'
    ? name.replace(new RegExp(LEGACY_OFFENSIVE_SENTINEL, 'g'), '').trim()
    : name;

export const SPELLS_DATA = {
  "驅散": { mp: 10, target: "一個生物", duration: "瞬發", effect: "若目標受到一個或多個持續時間為場景的咒語影響，其不再受到這些咒語的影響。" },
  "抽取精魂": { mp: 5, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標失去【HR+15】MP。隨後，你獲得相當於其所損失MP一半的MP。" },
  "停止": { mp: 10, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標在下一個回合中執行的動作減少一個（最少0個動作）。" },
  "吐息": { mp: 5, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標受到【HR+10】的{spell_breath_type}傷害。", selectionsConfig: [{ key: "spell_breath_type", label: "屬性", options: DAMAGE_TYPES }] },
  "詛咒之息": { mp: 10, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標受到【HR+15】的{spell_curse_breath_type}傷害，並陷入{spell_curse_breath_status}狀態。", selectionsConfig: [{ key: "spell_curse_breath_type", label: "屬性", options: DAMAGE_TYPES }, { key: "spell_curse_breath_status", label: "狀態", options: STATUS_OPTIONS }] },
  "照明烈焰": { mp: 20, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標受到【HR+25】的<火>屬性傷害；此傷害無視抗性。" },
  "電流術": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被此咒語擊中的目標受到【HR+15】的<電>屬性傷害。\n機會：每個被此咒語擊中的目標陷入眩暈狀態。" },
  "冰川覆裂": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被此咒語擊中的目標受到【HR+15】的<冰>屬性傷害。\n機會：每個被此咒語擊中的目標陷入緩慢狀態。" },
  "冰凍堡壘": { mp: 20, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標受到【HR+25】的<冰>屬性傷害；此傷害無視抗性。" },
  "伊格尼斯之火": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被此咒語擊中的目標受到【HR+15】的<火>屬性傷害。\n機會：每個被此咒語擊中的目標陷入動搖狀態。" },
  "光照射線": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被此咒語擊中的目標受到【HR+15】<光>屬性傷害。\n機會：每個被擊中的目標陷入眩暈狀態。" },
  "歐米茄終結": { mp: 20, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標失去相當於【20+目標一半等級】的HP。" },
  "大地震擊": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被此咒語擊中的目標受到【HR+15】的<土>屬性傷害。此咒語不能以正在飛行、漂浮、墜落或在半空中的生物為目標。\n機會：每個被此咒語擊中的目標在其下一個回合中執行的動作減少一個（最少0個動作）。" },
  "雷霆": { mp: 20, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標受到【HR+25】的<電>屬性傷害；此傷害無視抗性。" },
  "半影": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被此咒語擊中的目標受到【HR+15】的<暗>屬性傷害。\n機會：每個被此咒語擊中的目標陷入虛弱狀態。" },
  "烈風": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被此咒語擊中的目標受到【HR+15】的<風>屬性傷害。\n機會：每個被此咒語擊中的飛行目標被強制立即降落。" },
  "群體狀態": { mp: 20, target: "特殊", duration: "瞬發", effect: "選擇任意數量的可見生物：每個目標陷入{spell_mass_status_status}狀態。", selectionsConfig: [{ key: "spell_mass_status_status", label: "狀態效果", options: STATUS_OPTIONS }] },
  "詛咒": { mp: 5, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標陷入{spell_curse_status}狀態。", selectionsConfig: [{ key: "spell_curse_status", label: "狀態", options: STATUS_OPTIONS }] },
  "大詛咒": { mp: 10, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標陷入{spell_great_curse_status1}與{spell_great_curse_status2}狀態。", selectionsConfig: [{ key: "spell_great_curse_status1", label: "狀態1", options: STATUS_OPTIONS }, { key: "spell_great_curse_status2", label: "狀態2", options: STATUS_OPTIONS }] },
  "激怒": { mp: 10, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標陷入憤怒狀態，並且在其下一個回合不能執行防禦或咒語動作。" },
  "舔舐傷口": { mp: 5, target: "自身", duration: "瞬發", effect: "恢復 <lv20->20</lv20-><lv20+><lv40->30</lv40-></lv20+><lv40+><lv60->40</lv60-></lv40+><lv60+>50</lv60+> 點 HP。" },
  "生命偷取": { mp: 10, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標受到【HR+15】的{spell_life_steal_type}傷害。隨後，你恢復等同於傷害量一半的HP。", selectionsConfig: [{ key: "spell_life_steal_type", label: "屬性", options: DAMAGE_TYPES }] },
  "心靈偷取": { mp: 10, target: "一個生物", duration: "瞬發", isOffensive: true, effect: "目標受到【HR+15】的{spell_mind_steal_type}傷害。隨後，你恢復等同於傷害量一半的MP。", selectionsConfig: [{ key: "spell_mind_steal_type", label: "屬性", options: DAMAGE_TYPES }] },
  "毒藥": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被命中的目標陷入中毒狀態。" },
  "狂暴": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", isOffensive: true, effect: "每個被命中的目標陷入憤怒狀態。" },
  "弱化": { mp: 10, target: "一個生物", duration: "場景", isOffensive: true, effect: "在此咒語結束之前，目標從任何造成{spell_weaken_type}傷害的來源額外承受5點傷害。", selectionsConfig: [{ key: "spell_weaken_type", label: "弱化屬性", options: DAMAGE_TYPES }] },
  "護罩": { mp: 10, target: "自身", duration: "場景", effect: "在此咒語結束之前，你獲得對<物理>傷害的抗性。" },
  "戰吼": { mp: "10 × T", target: "至多三個生物", duration: "場景", effect: "在此咒語結束之前，每個目標在命中檢定上獲得+1加值。" },
  "加強": { mp: "5 × T", target: "至多三個生物", duration: "場景", effect: "在此咒語結束之前，每個目標對{spell_reinforce_status}狀態免疫。", selectionsConfig: [{ key: "spell_reinforce_status", label: "免疫狀態", options: STATUS_AND_POISON }] },
  "魔鏡": { mp: 10, target: "一個生物", duration: "場景", effect: "在此咒語結束之前，若攻擊性咒語以受此咒語影響的目標為對象，施法者將代替其成為該咒語的目標（該咒語仍可正常針對其他目標）。一旦此效果觸發一次，此咒語結束。" },
  "毀盪": { mp: 10, target: "特殊", duration: "瞬發", effect: "選擇任意數量的可見生物：每個目標受到30點{spell_devastation_type}傷害。每回合限施放一次（限30級或更高且為精英或冠位生物，且僅能在每輪的最後一回合施放）。", selectionsConfig: [{ key: "spell_devastation_type", label: "屬性", options: DAMAGE_TYPES }] },

  "光環": { mp: "5 × T", target: "至多三個生物", duration: "場景", effect: "在此咒語結束之前，每個目標可將其魔防視為 <lv20->12</lv20-><lv20+><lv40->13</lv40-></lv20+><lv40+>14</lv40+>（若其原本數值更高，則使用原本數值）。" },
  "覺醒": { mp: 20, target: "一個生物", duration: "場景", effect: "在此咒語結束之前，目標的【{spell_awaken_stat}】屬性骰尺寸提升一階（最大為 d12）。", selectionsConfig: [{ key: "spell_awaken_stat", label: "提升屬性", options: ["DEX", "INS", "MIG", "WLP"] }] },
  "屏障": { mp: "5 × T", target: "至多三個生物", duration: "場景", effect: "在此咒語結束之前，每個目標可將其物防視為 <lv20->12</lv20-><lv20+><lv40->13</lv40-></lv20+><lv40+>14</lv40+>（若其原本數值更高，則使用原本數值）。" },
  "淨化": { mp: "5 × T", target: "至多三個生物", duration: "瞬發", effect: "每個目標從所有狀態效果中恢復。" },
  "預測": { mp: 10, target: "自己", duration: "場景", effect: "在此咒語結束前，在你可見的生物執行檢定後，若該檢定既不是大失敗也不是大成功，你可以強迫該生物重骰該檢定。一旦此效果發動兩次，此咒語結束。" },
  "元素防護罩": { mp: "5 × T", target: "至多三個生物", duration: "場景", effect: "在此咒語結束之前，每個目標獲得對{spell_elemental_shield_type}傷害的抗性。", selectionsConfig: [{ key: "spell_elemental_shield_type", label: "抗性屬性", options: ["風", "電", "土", "火", "冰"] }] },
  "治癒": { mp: "10 × T", target: "至多三個生物", duration: "瞬發", effect: "每個目標恢復 <lv20->40</lv20-><lv20+><lv40->50</lv40-></lv20+><lv40+>60</lv40+> 點生命值。" },
  "加速": { mp: 20, target: "一個生物", duration: "場景", effect: "在此咒語結束之前，目標在每個回合結束時可選擇一項：\n① 進行一次自由攻擊；\n② 進行一次自由咒語動作，其MP消耗必須等於或少於 10。\n一旦目標執行過該咒語所賦予的總共兩個額外動作，此咒語結束。" },
  "魂之帷幕": { mp: "5 × T", target: "至多三個生物", duration: "場景", effect: "在此咒語結束之前，每個目標獲得對{spell_soul_veil_type}傷害的抗性。", selectionsConfig: [{ key: "spell_soul_veil_type", label: "抗性屬性", options: ["暗", "光", "毒"] }] }
};

/**
 * 將咒語名稱正規化為 `SPELLS_DATA` 的鍵值。
 *
 * 處理兩種歷史遺留格式：
 * 1. 舊版語意哨兵後綴（U+26A1）—— 攻擊性咒語的舊標記方式，已由 `isOffensive` 欄位取代。
 * 2. 等級標註後綴 `(Lv30+)` —— 僅用於選單顯示，非咒語本名。
 *
 * @param {string} name - 原始咒語名稱（可能含哨兵或等級標註）
 * @returns {string} 可直接用於 `SPELLS_DATA[...]` 查表的純淨名稱
 */
export const normalizeSpellName = (name) =>
  String(name ?? '')
    .replace(/\(Lv30\+\)/g, '')
    .replace(new RegExp(LEGACY_OFFENSIVE_SENTINEL, 'g'), '')
    .trim();

/**
 * 判定一個咒語是否為「攻擊性咒語」。
 *
 * 判定順序：
 * 1. 舊存檔相容 —— 名稱仍帶舊版哨兵者視為攻擊性（涵蓋尚未經 `migrateNpcState` 遷移的資料）。
 * 2. 結構化欄位 —— `SPELLS_DATA[正規化名稱].isOffensive === true`。
 *
 * @param {string} name - 咒語名稱（可含哨兵或等級標註）
 * @returns {boolean}
 */
export const isOffensiveSpell = (name) => {
  if (name === undefined || name === null || name === '') return false;
  const raw = String(name);
  if (raw.includes(LEGACY_OFFENSIVE_SENTINEL)) return true;
  return SPELLS_DATA[normalizeSpellName(raw)]?.isOffensive === true;
};
