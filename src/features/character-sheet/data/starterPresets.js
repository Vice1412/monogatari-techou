/**
 * 官方經典職業搭配 —— 核心規則書 (Core Rulebook Classic Characters)
 *
 * 來源：Core Rulebook v1.1（Errata 校正版）印刷 p.172–175（PDF p.174–177）。
 * 官方英文正式版為機制最高權威；中文譯名逐字沿用 `rulesData.json`（規則二）。
 *
 * 欄位規格（與 `expansionPresets.js` 完全相同）：
 *   id           唯一識別字
 *   sourcebook   手冊歸屬：core / highFantasy / naturalFantasy / technoFantasy / bonus
 *   group        預組隊伍 { id, title }；非預組者為 null
 *   title        中文名（官方角色名的中譯）
 *   en           官方英文角色名（僅資料用，不渲染）
 *   attributes   屬性骰階（官方 32 點陣列）
 *   classes      職業（等級）＋技能（含 SL）；等級恆等於該職業技能 SL 總和
 *                技能可帶 `selectedOptions`：咒語／舞步／天賦／混合形態／魔法種子／徽記為
 *                名稱陣列；魔奏者【魔法演奏】為 `{ keys, tones }` 物件（名稱取自
 *                `skillSuboptionsData.js`）。套用時隨 `classes` 深拷貝一併帶入。
 *   equipment    起始裝備（名稱取自 `rulesData.equipment`）
 *   zenit        起始資金
 *
 * 選填（職業子系統，不在 `classes` 內，由 `handleApplyPreset` 寫入）：
 *   gadgets      修補匠【小工具】：`{ alchemy, infusion, magitech, magitechSpells }`
 *   arcana       秘儀師【綁定和召喚】：已綁定阿爾卡納的 id 陣列（取自 `RULE_CODEX.arcana.catalog`）
 *   vehicle      機師【個人載具】：`{ frameId, modules }`；只寫框架與已掌握模組，
 *                啟用狀態留給載具面板（避免與槽位／武器上限衝突）
 *   quirk        金手指名（須與 `rulesData.quirks` 逐字相同）
 *
 * 本檔不含身分／主題／出身／格言／羈絆 —— 官方原書不提供這些欄位（見
 * `implementation_plan-classic-presets.md` §7 使用者裁定）。
 */

import { EXPANSION_PRESETS } from './expansionPresets';

export const STARTER_PRESETS = [
  {
    id: 'alchemist', sourcebook: 'core', group: null,
    title: '鍊金術士', en: 'ALCHEMIST',
    attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
    classes: [
      { className: '修補匠', level: 3, skills: [{ name: '小工具', sl: 1 }, { name: '藥水雨', sl: 1 }, { name: '秘密配方', sl: 1 }] },
      { className: '旅人', level: 2, skills: [{ name: '有備無患', sl: 1 }, { name: '酒館閒聊', sl: 1 }] }
    ],
    equipment: { mainHand: '短匕首', offHand: '戰弓', armor: '旅行皮甲', accessory: '' },
    zenit: 170,
    gadgets: { alchemy: 1, infusion: 0, magitech: 0, magitechSpells: [] }
  },
  {
    id: 'black_knight', sourcebook: 'core', group: null,
    title: '黑騎士', en: 'BLACK KNIGHT',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '暗黑之刃', level: 2, skills: [{ name: '暗影突襲', sl: 2 }] },
      { className: '熵師', level: 1, skills: [{ name: '熵系魔法', sl: 1, selectedOptions: ['抽取活力'] }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '近戰武器掌握', sl: 1 }] }
    ],
    equipment: { mainHand: '巨劍', offHand: '無盾牌', armor: '符文甲冑', accessory: '' },
    zenit: 120
  },
  {
    id: 'gambler', sourcebook: 'core', group: null,
    title: '賭徒', en: 'GAMBLER',
    attributes: { dex: 10, ins: 8, mig: 6, wlp: 8 },
    classes: [
      { className: '熵師', level: 2, skills: [{ name: '熵系魔法', sl: 1, selectedOptions: ['賭博'] }, { name: '幸運七', sl: 1 }] },
      { className: '遊蕩者', level: 2, skills: [{ name: '閃避', sl: 1 }, { name: '迅捷', sl: 1 }] },
      { className: '武器大師', level: 1, skills: [{ name: '近戰武器掌握', sl: 1 }] }
    ],
    equipment: { mainHand: '刺劍', offHand: '手裡劍', armor: '絲綢外衣', accessory: '' },
    zenit: 120
  },
  {
    id: 'gunslinger', sourcebook: 'core', group: null,
    title: '槍手', en: 'GUNSLINGER',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '神射手', level: 3, skills: [{ name: '連續射擊', sl: 1 }, { name: '交叉火力', sl: 1 }, { name: '遠程武器掌握', sl: 1 }] },
      { className: '修補匠', level: 2, skills: [{ name: '小工具', sl: 2 }] }
    ],
    equipment: { mainHand: '手槍', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' },
    zenit: 70,
    gadgets: { alchemy: 0, infusion: 2, magitech: 0, magitechSpells: [] }
  },
  {
    id: 'healer', sourcebook: 'core', group: null,
    title: '治癒師', en: 'HEALER',
    attributes: { dex: 6, ins: 8, mig: 8, wlp: 10 },
    classes: [
      { className: '吟唱者', level: 2, skills: [{ name: '激勵', sl: 1 }, { name: '我相信你', sl: 1 }] },
      { className: '靈師', level: 3, skills: [{ name: '靈魂魔法', sl: 3, selectedOptions: ['淨化', '治癒', '光照射線'] }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'magitechnician', sourcebook: 'core', group: null,
    title: '魔導技師', en: 'MAGITECHNICIAN',
    attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
    classes: [
      { className: '博學士', level: 2, skills: [{ name: '快速評估', sl: 2 }] },
      { className: '修補匠', level: 3, skills: [{ name: '小工具', sl: 3 }] }
    ],
    equipment: { mainHand: '短匕首', offHand: '青銅圓盾', armor: '賢者長袍', accessory: '' },
    zenit: 120,
    gadgets: { alchemy: 0, infusion: 0, magitech: 3, magitechSpells: ['元素防護罩', '照明烈焰', '治癒'] }
  },
  {
    id: 'monster_mage', sourcebook: 'core', group: null,
    title: '魔獸法師', en: 'MONSTER MAGE',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '嵌合師', level: 2, skills: [{ name: '野性交談', sl: 1 }, { name: '咒語模仿', sl: 1 }] },
      { className: '旅人', level: 2, skills: [{ name: '忠實夥伴', sl: 2 }] },
      { className: '武器大師', level: 1, skills: [{ name: '破甲擊', sl: 1 }] }
    ],
    equipment: { mainHand: '闊斧', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' },
    zenit: 70
  },
  {
    id: 'ninja', sourcebook: 'core', group: null,
    title: '忍者', en: 'NINJA',
    attributes: { dex: 10, ins: 8, mig: 6, wlp: 8 },
    classes: [
      { className: '遊蕩者', level: 3, skills: [{ name: '偷襲', sl: 1 }, { name: '閃避', sl: 2 }] },
      { className: '神射手', level: 1, skills: [{ name: '警告射擊', sl: 1 }] },
      { className: '武器大師', level: 1, skills: [{ name: '碎骨擊', sl: 1 }] }
    ],
    equipment: { mainHand: '短匕首', offHand: '手裡劍', armor: '戰鬥輕甲', accessory: '' },
    zenit: 120
  },
  {
    id: 'pirate', sourcebook: 'core', group: null,
    title: '海盜', en: 'PIRATE',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 1, selectedOptions: ['雷霆'] }, { name: '咒語之刃', sl: 1 }] },
      { className: '狂怒鬥士', level: 2, skills: [{ name: '腎上腺素', sl: 1 }, { name: '挑釁', sl: 1 }] },
      { className: '武器大師', level: 1, skills: [{ name: '破甲擊', sl: 1 }] }
    ],
    equipment: { mainHand: '闊斧', offHand: '符文圓盾', armor: '絲綢外衣', accessory: '' },
    zenit: 70
  },
  {
    id: 'pugilist', sourcebook: 'core', group: null,
    title: '拳鬥士', en: 'PUGILIST',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '狂怒鬥士', level: 3, skills: [{ name: '腎上腺素', sl: 1 }, { name: '暴怒', sl: 1 }, { name: '忍耐', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '碎骨擊', sl: 1 }, { name: '招架反擊', sl: 1 }] }
    ],
    equipment: { mainHand: '鐵指虎', offHand: '鐵指虎', armor: '戰鬥輕甲', accessory: '' },
    zenit: 120
  },
  {
    id: 'ranger', sourcebook: 'core', group: null,
    title: '遊俠', en: 'RANGER',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '神射手', level: 3, skills: [{ name: '連續射擊', sl: 1 }, { name: '遠程武器掌握', sl: 1 }, { name: '警告射擊', sl: 1 }] },
      { className: '旅人', level: 2, skills: [{ name: '有備無患', sl: 1 }, { name: '通曉道路', sl: 1 }] }
    ],
    equipment: { mainHand: '短弓', offHand: '短匕首', armor: '絲綢外衣', accessory: '' },
    zenit: 120
  },
  {
    id: 'red_sorcerer', sourcebook: 'core', group: null,
    title: '紅魔法師', en: 'RED SORCERER',
    attributes: { dex: 8, ins: 10, mig: 8, wlp: 6 },
    classes: [
      { className: '元素師', level: 3, skills: [{ name: '元素魔法', sl: 2, selectedOptions: ['照明烈焰', '冰凍堡壘'] }, { name: '咒語之刃', sl: 1 }] },
      { className: '靈師', level: 1, skills: [{ name: '靈魂魔法', sl: 1, selectedOptions: ['治癒'] }] },
      { className: '武器大師', level: 1, skills: [{ name: '近戰武器掌握', sl: 1 }] }
    ],
    equipment: { mainHand: '刺劍', offHand: '符文圓盾', armor: '戰鬥輕甲', accessory: '' },
    zenit: 70
  },
  {
    id: 'sage', sourcebook: 'core', group: null,
    title: '賢者', en: 'SAGE',
    attributes: { dex: 6, ins: 10, mig: 6, wlp: 10 },
    classes: [
      { className: '元素師', level: 3, skills: [{ name: '元素魔法', sl: 3, selectedOptions: ['電流術', '冰川覆裂', '伊格尼斯之火'] }] },
      { className: '博學士', level: 2, skills: [{ name: '靈光一閃', sl: 1 }, { name: '集中', sl: 1 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'samurai', sourcebook: 'core', group: null,
    title: '武士', en: 'SAMURAI',
    attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
    classes: [
      { className: '守護者', level: 2, skills: [{ name: '防守掌握', sl: 2 }] },
      { className: '靈師', level: 1, skills: [{ name: '靈魂魔法', sl: 1, selectedOptions: ['靈魂武器'] }] },
      { className: '武器大師', level: 2, skills: [{ name: '招架反擊', sl: 1 }, { name: '近戰武器掌握', sl: 1 }] }
    ],
    equipment: { mainHand: '武士刀', offHand: '無盾牌', armor: '符文甲冑', accessory: '' },
    zenit: 120
  },
  {
    id: 'soldier', sourcebook: 'core', group: null,
    title: '士兵', en: 'SOLDIER',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '守護者', level: 2, skills: [{ name: '保鏢', sl: 1 }, { name: '保護', sl: 1 }] },
      { className: '武器大師', level: 3, skills: [{ name: '碎骨擊', sl: 2 }, { name: '破甲擊', sl: 1 }] }
    ],
    equipment: { mainHand: '青銅劍', offHand: '符文圓盾', armor: '板條甲', accessory: '' },
    zenit: 70
  },
  {
    id: 'spell_fencer', sourcebook: 'core', group: null,
    title: '咒劍士', en: 'SPELL FENCER',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 2, selectedOptions: ['元素防護罩', '元素武器'] }] },
      { className: '靈師', level: 1, skills: [{ name: '靈魂魔法', sl: 1, selectedOptions: ['光環'] }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '招架反擊', sl: 1 }] }
    ],
    equipment: { mainHand: '刺劍', offHand: '符文圓盾', armor: '絲綢外衣', accessory: '' },
    zenit: 120
  },
  {
    id: 'summoner', sourcebook: 'core', group: null,
    title: '召喚師', en: 'SUMMONER',
    attributes: { dex: 8, ins: 8, mig: 6, wlp: 10 },
    classes: [
      { className: '秘儀師', level: 3, skills: [{ name: '阿爾卡納再生', sl: 2 }, { name: '綁定和召喚', sl: 1 }] },
      { className: '靈師', level: 2, skills: [{ name: '靈魂魔法', sl: 2, selectedOptions: ['屏障', '慈悲'] }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270,
    arcana: ['grimoire']
  },
  {
    id: 'thief', sourcebook: 'core', group: null,
    title: '竊賊', en: 'THIEF',
    attributes: { dex: 10, ins: 8, mig: 6, wlp: 8 },
    classes: [
      { className: '遊蕩者', level: 3, skills: [{ name: '偷襲', sl: 1 }, { name: '迅捷', sl: 1 }, { name: '靈魂竊取', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '碎骨擊', sl: 2 }] }
    ],
    equipment: { mainHand: '短匕首', offHand: '短匕首', armor: '旅行皮甲', accessory: '' },
    zenit: 170
  },
  {
    id: 'troubadour', sourcebook: 'core', group: null,
    title: '吟遊詩人', en: 'TROUBADOUR',
    attributes: { dex: 10, ins: 8, mig: 6, wlp: 8 },
    classes: [
      { className: '吟唱者', level: 2, skills: [{ name: '譴責', sl: 1 }, { name: '意外盟友', sl: 1 }] },
      { className: '靈師', level: 2, skills: [{ name: '靈魂魔法', sl: 2, selectedOptions: ['覺醒', '激怒'] }] },
      { className: '旅人', level: 1, skills: [{ name: '通曉道路', sl: 1 }] }
    ],
    equipment: { mainHand: '短匕首', offHand: '青銅圓盾', armor: '絲綢外衣', accessory: '' },
    zenit: 220
  },
  {
    id: 'valkyrie', sourcebook: 'core', group: null,
    title: '女武神', en: 'VALKYRIE',
    attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
    classes: [
      { className: '元素師', level: 1, skills: [{ name: '元素魔法', sl: 1, selectedOptions: ['飛天打擊'] }] },
      { className: '守護者', level: 1, skills: [{ name: '不動要塞', sl: 1 }] },
      { className: '武器大師', level: 3, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '近戰武器掌握', sl: 2 }] }
    ],
    equipment: { mainHand: '輕長矛', offHand: '符文圓盾', armor: '板條甲', accessory: '' },
    zenit: 70
  }
];

/**
 * 全部官方經典職業搭配：核心規則書 20 組 ＋ 三大奇幻手冊／特典合輯 61 組 ＝ 81 組。
 * 依 `sourcebook` 分派給各手冊；依 `group` 歸類預組隊伍（`group === null` 為個人配置）。
 */
export const ALL_STARTER_PRESETS = [...STARTER_PRESETS, ...EXPANSION_PRESETS];
