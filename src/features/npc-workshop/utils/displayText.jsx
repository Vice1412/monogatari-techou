/**
 * NPC 工坊的「顯示用文字」模組。
 *
 * 為什麼獨立成檔（2026-10-16）：
 * 這幾個函式原本埋在 `NPCWorkshop.jsx` 裡（該檔當時 6,400 餘行），
 * 其中三個是**純函式**（給同樣的輸入一定得到同樣的輸出），卻因為放在元件檔內
 * 而完全無法被測試。抽出來之後，`tests/npcWorkshop.test.mjs` 可以直接呼叫它們。
 *
 * 這裡全部是「把技能／咒語的文字模板渲染成人看的樣子」的邏輯：
 *   - `TEMPLATE_KEY_TRANSLATIONS`：`{type}` 這種變數名 → 中文標籤
 *   - `getChineseKeyLabel`：找不到對照表時用關鍵字猜中文標籤
 *   - `resolveTemplateVariablesForDisplay`：把 `{變數}` 換成玩家選的值（顯示版）
 *   - `getPlainText`：同上但輸出**純文字**（匯出用，不含 JSX）
 *   - `renderFormattedText`：輸出**帶顏色的 JSX**（畫面上顯示用）
 *
 * ※ 本檔不含任何狀態、不碰 localStorage、不依賴 React 以外的環境 —— 純輸入輸出。
 */

import React from 'react';
import { DAMAGE_TYPES, TYPE_STYLES } from '../data';
import { getDynamicValues } from './npcEngine';

/** `{type}` 這類模板變數名 → 中文標籤。找不到時見 `getChineseKeyLabel`。 */
export const TEMPLATE_KEY_TRANSLATIONS = {
  distance: "距離",
  type: "屬性",
  type1: "抗性1",
  type2: "抗性2",
  formula: "命中公式",
  attackFormula: "命中公式",
  extra: "附加效果",
  status: "異常狀態",
  status1: "狀態1",
  status2: "狀態2",
  heavy_status: "異常狀態",
  effect: "效果",
  effect1: "效果1",
  effect2: "效果2",
  imm1: "免疫1",
  imm2: "免疫2",
  statusEffect: "狀態效果",
  spell_breath_type: "吐息屬性",
  spell_curse_breath_type: "詛咒屬性",
  spell_curse_breath_status: "詛咒狀態",
  spell_mass_status_status: "群體狀態",
  spell_great_curse_status1: "大詛咒狀態1",
  spell_great_curse_status2: "大詛咒狀態2",
  spell_life_steal_type: "偷取屬性",
  spell_mind_steal_type: "偷取屬性",
  spell_weaken_type: "弱化屬性",
  spell_reinforce_status: "防護狀態",
  spell_devastation_type: "毀盪屬性",
  spell_awaken_stat: "提升屬性",
  spell_elemental_shield_type: "元素抗性屬性",
  spell_soul_veil_type: "魂之帷幕屬性",
  stat: "屬性骰",
  encStat: "提升屬性",
  source: "傷害來源",
  attack: "指定攻擊",
  trigger: "觸發條件",
  trigger1: "觸發條件1",
  trigger2: "觸發條件2",
  target: "目標",
  target_count: "目標數量",
  bonus: "加成項目",
  action1: "指定動作1",
  action2: "指定動作2",
  encRes: "恢復資源",
  sp_humanoid_bg: "背景領域",
  sp_construct_domain: "加成領域",
  customName: "名稱",
  name: "名稱",
  skillName: "技能名稱",
  spellName: "咒語名稱",
  customDesc: "說明",
  desc: "說明",
  rank: "階級",
  level: "等級",
};

/**
 * 取模板變數的中文標籤。
 * 先查對照表；查不到時退而用**關鍵字包含**猜一個（例如 `sp_beast_bg` → 「領域」）。
 * 這是為了讓未來新增但還沒進對照表的變數，在畫面上至少顯示得像中文而不是原始英文鍵。
 */
export const getChineseKeyLabel = (key) => {
  if (!key) return "項目";
  if (TEMPLATE_KEY_TRANSLATIONS[key]) return TEMPLATE_KEY_TRANSLATIONS[key];
  if (key.includes('distance')) return "距離";
  if (key.includes('formula')) return "命中公式";
  if (key.includes('type')) return "屬性";
  if (key.includes('status')) return "狀態";
  if (key.includes('stat')) return "屬性";
  if (key.includes('effect')) return "效果";
  if (key.includes('trigger')) return "觸發條件";
  if (key.includes('target')) return "目標";
  if (key.includes('action')) return "動作";
  if (key.includes('bonus')) return "加成";
  if (key.includes('name')) return "名稱";
  if (key.includes('desc')) return "說明";
  if (key.includes('bg')) return "領域";
  if (key.includes('imm')) return "免疫";
  return key;
};

/**
 * 把技能說明裡的 `{變數}` 換成玩家選定的值 —— **畫面上顯示用**。
 *
 * ※ 為什麼名字這麼長（2026-10-16 更名）：
 *   `utils/npcEngine.js` 也匯出一個 `resolveTemplateVariables`，**但行為不同**：
 *     - 本函式（顯示用）：陣列值接成「換行 ＋ ● 」，且**不**代換 `[少量]` 之類的動態括號值
 *       （那些由 `renderFormattedText` 以 JSX 上色處理）。
 *     - npcEngine 版（匯出純文字用）：陣列值接成 `' / '`，且會先把 `[少量]` 代換成數字。
 *   兩者同名不同行為，是「合併重構」最容易誤殺的地方——合併後文字匯出或畫面
 *   會其一悄悄壞掉，而 `npm test` 只覆蓋 npcEngine 那份，**不會紅**。
 *   故本函式更名為 `...ForDisplay`，讓「同名」這個陷阱消失。
 *   護欄：`tests/npcWorkshop.test.mjs` J 段斷言兩者行為確實不同。
 */
export const resolveTemplateVariablesForDisplay = (text, selections, options = {}) => {
  if (!text) return "";
  const {
    npcLevel = 5,
    partyLevel = 5,
    hideMeta = false,
    damageEmojis = false,
    recursionLimit = 3
  } = options;

  let resolved = text;
  let loopCount = 0;

  while (resolved.includes('{') && loopCount < recursionLimit) {
    resolved = resolved.replace(/\{([^}]+)\}/g, (match, key) => {
      let val = selections?.[key];
      if (val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) return `[ ___ ]`;

      if (Array.isArray(val)) {
        return '\n' + val.map(v => `● ${v}`).join('\n');
      }

      if (damageEmojis && DAMAGE_TYPES.includes(val)) {
        return `${val}`;
      }

      return val;
    });
    loopCount++;
  }
  return resolved;
};

/**
 * 把技能／咒語的模板文字轉成**純文字**（給複製、匯出、Markdown 用）。
 * 與 `renderFormattedText` 的差別：這裡不產生任何 JSX，只回字串。
 */
export const getPlainText = (text, selections, npcLevel = 5, partyLevel = 5, hideMeta = false) => {
  if (!text) return "";
  let plain = text;

  if (hideMeta) {
    plain = plain.replace(/<(meta|status)>[\s\S]*?<\/\1>/gi, "");
  } else {
    plain = plain.replace(/<\/?(?:meta|status)[^>]*>/gi, "");
  }

  // Handle level-based visibility tags: <lv30+>...<lv30+> or <lv30->...<lv30->
  plain = plain.replace(/<lv(\d+)\+>([\s\S]*?)<\/lv\d+\+>/g, (match, lv, content) => npcLevel >= parseInt(lv) ? content : "");
  plain = plain.replace(/<lv(\d+)\->([\s\S]*?)<\/lv\d+\->/g, (match, lv, content) => npcLevel < parseInt(lv) ? content : "");

  const dynVals = getDynamicValues(npcLevel, partyLevel);
  Object.keys(dynVals).forEach(key => {
    plain = plain.replace(new RegExp(key.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), `${dynVals[key]} 點`);
  });

  plain = resolveTemplateVariablesForDisplay(plain, selections, {
    npcLevel,
    partyLevel,
    hideMeta,
    damageEmojis: true
  });
  plain = plain.replace(/<([^>]+)>/g, (match, p1) => {
    if (/^\/?(?:meta|status)/i.test(p1)) return "";
    return DAMAGE_TYPES.includes(p1) ? p1 : p1;
  });
  plain = plain.replace(/__NPC_NAME__(.*?)__NPC_END__/g, "**$1**");
  return plain;
};

/**
 * 把技能說明渲染成**帶顏色的 JSX**（畫面上顯示用）。
 *
 * 與 `getPlainText` 的差別：這裡會把動態數值標成粉紅粗體、把 `{未填}` 畫成虛線空格、
 * 把屬性名加上圖示。`{未填}` 的空格是**刻意的提示**——提醒玩家這裡還沒選。
 */
export const renderFormattedText = (text, selections, npcLevel = 5, partyLevel = 5, hideMeta = false) => {
  if (!text) return "";
  let processedText = text;

  if (hideMeta) {
    processedText = processedText.replace(/<(meta|status)>[\s\S]*?<\/\1>/gi, "");
  } else {
    processedText = processedText.replace(/<\/?(?:meta|status)[^>]*>/gi, "");
  }

  // Handle level-based visibility tags: <lv30+>...<lv30+> or <lv30->...<lv30->
  processedText = processedText.replace(/<lv(\d+)\+>([\s\S]*?)<\/lv\d+\+>/g, (match, lv, content) => npcLevel >= parseInt(lv) ? content : "");
  processedText = processedText.replace(/<lv(\d+)\->([\s\S]*?)<\/lv\d+\->/g, (match, lv, content) => npcLevel < parseInt(lv) ? content : "");

  const dynVals = getDynamicValues(npcLevel, partyLevel);
  Object.keys(dynVals).forEach(key => {
    processedText = processedText.replace(new RegExp(key.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), `__DYN_VALUE__${dynVals[key]} 點__DYN_END__`);
  });

  const parts = processedText.split(/(__DYN_VALUE__.*?__DYN_END__|__NPC_NAME__.*?__NPC_END__|\{[^}]+\}|<[^>]+>)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('__DYN_VALUE__')) {
      const val = part.replace('__DYN_VALUE__', '').replace('__DYN_END__', '');
      return <span key={i} className="font-black text-pink-400 drop-shadow-[0_0_5px_rgba(244,114,182,0.6)] px-1">{val}</span>;
    }
    if (part.startsWith('__NPC_NAME__')) {
      const name = part.replace('__NPC_NAME__', '').replace('__NPC_END__', '');
      return <span key={i} className="font-black text-[#2c221e] drop-shadow-sm">{name}</span>;
    }
    if (part.startsWith('{') && part.endsWith('}')) {
      const key = part.slice(1, -1);
      const val = selections?.[key];
      if (!val || (Array.isArray(val) && val.length === 0)) {
        return (
          <span
            key={i}
            className="inline-flex items-center justify-center min-w-[50px] h-[22px] px-2 bg-[#f4ebd9]/90 border-2 border-dashed border-[#3c2415] rounded-md shadow-inner align-middle mx-1 hover:border-[#3c2415] transition-all select-none group/blankSlot"
            title={`待配置項目：${getChineseKeyLabel(key)}`}
          >
            <span className="w-full h-0.5 bg-[#d6c7ab] rounded-full"></span>
          </span>
        );
      }
      if (Array.isArray(val)) return <span key={i} className="font-bold text-[#2c221e]">{val.map((v, vi) => <span key={vi} className="block ml-2">● {v}</span>)}</span>;
      if (typeof val === 'string' && (val.includes('{') || val.includes('['))) return <React.Fragment key={i}>{renderFormattedText(val, selections, npcLevel, partyLevel, hideMeta)}</React.Fragment>;
      if (DAMAGE_TYPES.includes(val)) return <span key={i} className={`inline-flex items-center gap-1 font-extrabold ${TYPE_STYLES[val].color} tracking-wide drop-shadow-sm`}><span className="fu-icon text-sm leading-none translate-y-[0.5px]">{TYPE_STYLES[val].fuIcon}</span><span>{val}</span></span>;
      return <span key={i} className="font-extrabold text-[#2c221e]">{val}</span>;
    }
    if (part.startsWith('<') && part.endsWith('>')) {
      const type = part.slice(1, -1);
      if (/^\/?(?:meta|status)/i.test(type)) return null;
      if (DAMAGE_TYPES.includes(type)) return <span key={i} className={`inline-flex items-center gap-1 font-extrabold ${TYPE_STYLES[type].color} tracking-wide drop-shadow-sm`}><span className="fu-icon text-sm leading-none translate-y-[0.5px]">{TYPE_STYLES[type].fuIcon}</span><span>{type}</span></span>;
      return part;
    }
    return part;
  });
};
