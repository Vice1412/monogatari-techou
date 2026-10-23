import {
  GiBrute,
  GiCrossbow,
  GiWizardStaff,
  GiTimeBomb,
  GiShieldReflect,
  GiHealing
} from 'react-icons/gi';

// --- DATA ---
export const SPONSOR_CONFIG = {
  kofiUrl: "https://ko-fi.com/scarletvice",
  authorName: "ScarletVice",
};

export const DAMAGE_TYPES = ['物理', '風', '電', '暗', '土', '火', '冰', '光', '毒'];
export const DAMAGE_TYPES_NO_PHYS = ['風', '電', '暗', '土', '火', '冰', '光', '毒'];
/**
 * 相性狀態：**不是身份，是序**（第二十二輪）。
 *
 * 九相是身份——離散、封閉、沒有順序 → 用色相，九色兩兩不同，撞色等於其中一個身份消失。
 * 相性狀態是**序**：弱點 < 一般 < 抗性 < 免疫 < 吸收，講的是「打我這裡會怎樣」。
 * 序不該用五個色相承擔：那會讓九張相性磚變成五色彩虹，而色相在那些磚上已經被九相用掉了。
 *
 * 所以拆成兩層：
 *   bar  —— 極性。弱點紅、其餘綠、一般米。只有 4px，只在磚的左緣。
 *   chip —— 程度。兩端實心（弱點／吸收），中間描邊（抗性／免疫），一般不加框。
 *   ink  —— 分類標題與分頁標籤的字色，跟 bar 同一個極性。
 *
 * 顏色只講「好壞」，文字講「哪一種」。抗性與免疫同色是刻意的——兩者都是「傷害變少」，
 * 差別在幅度，而幅度由標籤文字承擔。這與九相相反：九相必須單射，狀態不必。
 * （判準：身份是離散的集合，序是連續的軸。連續的軸用深淺／填色，不用色相。）
 *
 * 用色全部是登記色：#8c2d36 危險、#245c45 綠、#d6c7ab 邊框、#e8dcc4 分隔、
 * #fffdf9 紙面、#6b5a4b 二級墨。零新 hex。
 *
 * 消費端（三個，全部引用這張表）：NPCWorkshop 的分類摘要／分頁／相性磚，
 * NPCCardPreview 的預覽徽章。任何一處自帶顏色就是第二份拷貝。
 */
export const AFFINITY_STATES = {
  normal: { label: '一般', bar: 'bg-[#e8dcc4]', chip: 'border-transparent bg-transparent text-[#6b5a4b]', ink: 'text-[#6b5a4b]' },
  vul: { label: '弱點', bar: 'bg-[#8c2d36]', chip: 'border-[#8c2d36] bg-[#8c2d36] text-[#fffdf9]', ink: 'text-[#8c2d36]' },
  res: { label: '抗性', bar: 'bg-[#245c45]', chip: 'border-[#d6c7ab] bg-[#fffdf9] text-[#6b5a4b]', ink: 'text-[#245c45]' },
  imm: { label: '免疫', bar: 'bg-[#245c45]', chip: 'border-[#245c45] bg-[#fffdf9] text-[#245c45]', ink: 'text-[#245c45]' },
  abs: { label: '吸收', bar: 'bg-[#245c45]', chip: 'border-[#245c45] bg-[#245c45] text-[#fffdf9]', ink: 'text-[#245c45]' }
};
export const LEVELS = [5, 10, 20, 30, 40, 50, 60];
export const PARTY_LEVELS = [5, 20, 40];
export const RANKS = ["士兵", "精英", "冠位"];
export const CATEGORIES = [{ id: 'attack', name: '基本攻擊', fuIcon: 'm' }, { id: 'spell', name: '咒語', fuIcon: 'c' }, { id: 'action', name: '其餘行動', fuIcon: 's' }, { id: 'rule', name: '特殊規則' }, { id: 'boss', name: 'Boss' }];
// 九相色票：這張表是 `src/components/ui/FUIcon.jsx` 的 FU_ICON_MAP 的**鏡像**，
// 不是 import 來的——Tailwind 只掃字面量，`text-[${hex}]` 這種模板字串不會生成 class。
// 兩張表必須逐一相等，護欄見 tests/uiSystem.test.mjs 的 H14-f（值相等）與 H14-g（不得回退成色相令牌）。
// 撞色的代價不是「不好看」：看到兩個一樣顏色的字，讀者學到「這兩個是同一類」。
export const TYPE_STYLES = { '物理': { fuIcon: 'p', color: 'text-[#404a58] font-bold' }, '風': { fuIcon: 'a', color: 'text-[#245c45] font-bold' }, '電': { fuIcon: 'b', color: 'text-[#5a6b00] font-bold' }, '暗': { fuIcon: 'd', color: 'text-[#5e387c] font-bold' }, '土': { fuIcon: 'e', color: 'text-[#5c4a26] font-bold' }, '火': { fuIcon: 'f', color: 'text-[#a63d40] font-bold' }, '冰': { fuIcon: 'i', color: 'text-[#27527a] font-bold' }, '光': { fuIcon: 'l', color: 'text-[#9c4d16] font-bold' }, '毒': { fuIcon: 't', color: 'text-[#8c2d6a] font-bold' }, '攻擊性咒語': { fuIcon: 'o', color: 'text-[#8c2d36] font-bold' } };
export const STATUS_OPTIONS = ["眩暈", "動搖", "緩慢", "虛弱"]; export const STATUS_AND_POISON = ["眩暈", "動搖", "緩慢", "虛弱", "中毒", "憤怒"]; export const ACTION_TYPES = ["攻擊", "裝備", "防禦", "阻礙", "使用庫存", "推進目標", "咒語", "研究", "技能"];

export const ROLE_ICONS = {
  "暴徒": GiBrute,
  "獵人": GiCrossbow,
  "法師": GiWizardStaff,
  "破壞者": GiTimeBomb,
  "衛士": GiShieldReflect,
  "輔助": GiHealing
};

export const ROLE_DESCRIPTIONS = {
  "暴徒": { Icon: GiBrute, subtitle: "「越戰越勇的肉搏戰車」", desc: "擁有極高的 HP 與強大的原始攻擊力，但防禦較低且弱點多。非常適合做為高壓消耗戰的 Boss，或掩護其他複雜敵人的強力肉盾。" },
  "獵人": { Icon: GiCrossbow, subtitle: "「致命的高速刺客」", desc: "擁有極高的命中與先攻，專精單體爆發與趁虛而入。擅長利用敵人的破綻與異常狀態造成毀滅性的打擊，是能瞬間撕裂防線的殺手。" },
  "法師": { Icon: GiWizardStaff, subtitle: "「掌控元素的移動砲台」", desc: "擁有最高的群體傷害潛力與 MP 儲備，精通各種屬性魔法。極度依賴 MP，HP 較低，通常需要隊友保護才能發揮最大破壞力。" },
  "破壞者": { Icon: GiTimeBomb, subtitle: "「折磨心智的極惡干擾者」", desc: "不以直接傷害見長，精通各種強大的 Debuff、封鎖動作與抽取 MP。能透過異常狀態瓦解玩家戰術，是最陰險的控場大師。" },
  "衛士": { Icon: GiShieldReflect, subtitle: "「堅不可摧的鐵壁守護者」", desc: "擁有最強的雙防禦加成。擅長保護盟友、提供抗性，並在隊友受擊時發動無情的反擊。通常伴隨著需要保護的高威脅目標出現。" },
  "輔助": { Icon: GiHealing, subtitle: "「扭轉戰局的幕後推手」", desc: "缺乏直接攻擊力，但能提供強大增益、治癒並充當 MP 電池。能讓團隊威脅成倍增加，是玩家必須優先集火擊殺的戰術樞紐。" }
};
// 反派階級是**序**（非反派 ＜ 次要 ＜ 主要 ＜ 最終），不是身份——顏色只講極性（危險／不危險），
// 程度由「填充」承擔：無框（非反派）→ 描邊淺（次要）→ 描邊重（主要）→ 實心（最終）。
// 三階共用同一個紅 `#8c2d36`：把三階塗成紫／紅／桃紅等於說「這是三個不同的東西」，
// 而它們是同一件事的三個刻度。護欄 H17-d 量的是**單調性**（每一階必須比上一階響），
// 不是一對一——與九相（H14-b）、四屬性（H15-a）相反的形狀，理由同 AFFINITY_STATES。
// 這張卡的身份色已經被**物種主題**（SPECIES_THEMES 的 accent）佔用，反派階級只准當程度。
export const VILLAIN_TIERS = {
  "none":    { up: 0,  label: "非反派",   ink: "text-[#6b5a4b]", chip: "border-transparent bg-transparent text-[#6b5a4b]" },
  "minor":   { up: 5,  label: "次要反派", ink: "text-[#8c2d36]", chip: "border-[#d6c7ab] bg-[#fffdf9] text-[#8c2d36]" },
  "major":   { up: 10, label: "主要反派", ink: "text-[#8c2d36]", chip: "border-[#8c2d36] bg-[#fffdf9] text-[#8c2d36]" },
  "supreme": { up: 15, label: "最終反派", ink: "text-[#8c2d36]", chip: "border-[#8c2d36] bg-[#8c2d36] text-[#fffdf9]" }
};

// --- SHARED UTILS FOR ROLES ---
export const getCommonMilestones = (level) => { const ms = []; if (level >= 20) ms.push({ id: 'sys_role_20', unlockLevel: 20, originalName: "解鎖定位技能額度", originalDesc: "你獲得了 1 點額外的定位技能配置額度。請前往【步驟 3：能力】區塊進行挑選。", isSystem: true }); if (level >= 40) ms.push({ id: 'sys_role_40', unlockLevel: 40, originalName: "解鎖定位技能額度", originalDesc: "你獲得了 1 點額外的定位技能配置額度。請前往【步驟 3：能力】區塊進行挑選。", isSystem: true }); if (level >= 60) ms.push({ id: 'sys_role_60', unlockLevel: 60, originalName: "解鎖定位技能額度", originalDesc: "你獲得了 1 點額外的定位技能配置額度。請前往【步驟 3：能力】區塊進行挑選。", isSystem: true }); return ms; };
