/**
 * 官方經典職業搭配 —— 三大奇幻手冊 ＋ 官方特典合輯
 * (High Fantasy / Natural Fantasy / Techno Fantasy Atlas, Bonus Collection)
 *
 * 來源（官方英文正式版為機制最高權威）：
 *   高度奇幻手冊  NEW CLASSIC CHARACTERS  印刷 p.132–135（PDF p.134–137）18 組
 *   自然奇幻手冊  NEW CLASSIC CHARACTERS  印刷 p.134–137（PDF p.136–139）18 組
 *   科技奇幻手冊  NEW CLASSIC CHARACTERS  印刷 p.146–149（PDF p.148–151）17 組
 *   官方特典合輯  HALLOWEEN CHARACTERS    印刷 p.24–25 （PDF 偏移 0）    8 組
 *   合計 61 組（預組隊伍 6 隊共 23 名，已計入上列數字）
 *
 * 中文譯名逐字沿用 `rulesData.json`（規則二）；角色中文名為官方英文名的中譯。
 *
 * 欄位規格與 `starterPresets.js` 完全相同，另有下列選填欄位：
 *   selectedOptions  技能子選擇（內嵌於 `classes[].skills[]`）。咒語／舞步／天賦／混合形態／
 *                    魔法種子／徽記為名稱陣列；魔奏者【魔法演奏】為 `{ keys, tones }` 物件。
 *                    名稱逐字取自 `skillSuboptionsData.js` 與 `rulesData.spells`。
 *   gadgets          修補匠【小工具】：`{ alchemy, infusion, magitech, magitechSpells }`
 *   arcana           秘儀師【綁定和召喚】：已綁定阿爾卡納的 id 陣列
 *   vehicle          機師【個人載具】：`{ frameId, modules }`（僅框架與已掌握模組）
 *   customWeapon     自訂武器規格（官方原文中譯）。角色卡裝備欄無此欄位，
 *                    故 `equipment.mainHand` 填最接近的基礎武器，本欄保留官方規格供玩家參照。
 *   mnemosphere      魔晶石（科技奇幻可選規則）：`{ className, level, label }`。
 *                    套用時由 `presetApply.js` 轉成真正的 `technospheres.mnemospheres`
 *                    條目（`createMnemosphere`），不是純註記字串（§BO9 第 5 點已於 §CF 補完）。
 *   quirk            金手指名（僅特典合輯 8 組；名稱須與 `rulesData.quirks` 完全一致）。
 */

export const EXPANSION_PRESETS = [
  // ============================================================
  // 高度奇幻手冊（18 組）
  // ============================================================
  {
    id: 'hf_acrobat', sourcebook: 'highFantasy', group: null,
    title: '雜技師', en: 'ACROBAT',
    attributes: { dex: 10, ins: 8, mig: 6, wlp: 8 },
    classes: [
      { className: '舞者', level: 3, skills: [{ name: '起舞', sl: 2, selectedOptions: ['鳳凰', '銜尾蛇'] }, { name: '戰舞者', sl: 1 }] },
      { className: '狂怒鬥士', level: 1, skills: [{ name: '暴怒', sl: 1 }] },
      { className: '神射手', level: 1, skills: [{ name: '警告射擊', sl: 1 }] }
    ],
    equipment: { mainHand: '手裡劍', offHand: '手裡劍', armor: '賢者長袍', accessory: '' },
    zenit: 170
  },
  {
    id: 'hf_dancing_witch', sourcebook: 'highFantasy', group: null,
    title: '舞巫', en: 'DANCING WITCH',
    attributes: { dex: 6, ins: 8, mig: 8, wlp: 10 },
    classes: [
      { className: '舞者', level: 3, skills: [{ name: '起舞', sl: 2, selectedOptions: ['獅鷲形', '雪怪足'] }, { name: '戰舞者', sl: 1 }] },
      { className: '元素師', level: 1, skills: [{ name: '魔法砲擊', sl: 1 }] },
      { className: '熵師', level: 1, skills: [{ name: '熵系魔法', sl: 1, selectedOptions: ['抽取活力'] }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    zenit: 270
  },
  {
    id: 'hf_exorcist', sourcebook: 'highFantasy', group: null,
    title: '驅魔師', en: 'EXORCIST',
    attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
    classes: [
      { className: '神射手', level: 2, skills: [{ name: '鷹眼', sl: 1 }, { name: '遠程武器掌握', sl: 1 }] },
      { className: '靈師', level: 1, skills: [{ name: '靈魂魔法', sl: 1, selectedOptions: ['靈魂武器'] }] },
      { className: '徽記師', level: 2, skills: [{ name: '徽記連結', sl: 1 }, { name: '徽記學', sl: 1, selectedOptions: ['束縛徽記', '真理徽記'] }] }
    ],
    equipment: { mainHand: '短弓', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 170
  },
  {
    id: 'hf_fencer', sourcebook: 'highFantasy', group: null,
    title: '劍客', en: 'FENCER',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '舞者', level: 2, skills: [{ name: '起舞', sl: 2, selectedOptions: ['海怪纏', '孔雀舞'] }] },
      { className: '遊蕩者', level: 1, skills: [{ name: '偷襲', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '招架反擊', sl: 1 }, { name: '碎骨擊', sl: 1 }] }
    ],
    equipment: { mainHand: '刺劍', offHand: '符文圓盾', armor: '戰鬥輕甲', accessory: '' },
    zenit: 70
  },
  {
    id: 'hf_idol', sourcebook: 'highFantasy', group: null,
    title: '偶像', en: 'IDOL',
    attributes: { dex: 8, ins: 8, mig: 6, wlp: 10 },
    classes: [
      { className: '魔奏者', level: 3, skills: [{ name: '魔法演奏', sl: 3, selectedOptions: { keys: ['熾熱'], tones: ['冷靜', '生動', '莊嚴'] } }] },
      { className: '吟唱者', level: 2, skills: [{ name: '我相信你', sl: 1 }, { name: '意外盟友', sl: 1 }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'hf_metalhead', sourcebook: 'highFantasy', group: null,
    title: '重金屬樂手', en: 'METALHEAD',
    attributes: { dex: 6, ins: 8, mig: 10, wlp: 8 },
    classes: [
      { className: '魔奏者', level: 3, skills: [{ name: '魔法演奏', sl: 2, selectedOptions: { keys: ['閃雷'], tones: ['瘋狂', '洶湧'] } }, { name: '顫音', sl: 1 }] },
      { className: '狂怒鬥士', level: 1, skills: [{ name: '挑釁', sl: 1 }] },
      { className: '武器大師', level: 1, skills: [{ name: '破甲擊', sl: 1 }] }
    ],
    equipment: { mainHand: '戰斧', offHand: '無盾牌', armor: '符文甲冑', accessory: '' },
    zenit: 120
  },
  {
    id: 'hf_runesmith', sourcebook: 'highFantasy', group: null,
    title: '符文工匠', en: 'RUNESMITH',
    attributes: { dex: 6, ins: 10, mig: 8, wlp: 8 },
    classes: [
      { className: '秘儀師', level: 3, skills: [{ name: '綁定和召喚', sl: 1 }, { name: '緊急秘儀', sl: 1 }, { name: '秘儀學派儀式', sl: 1 }] },
      { className: '徽記師', level: 2, skills: [{ name: '私人接觸', sl: 1 }, { name: '徽記學', sl: 1, selectedOptions: ['制物徽記', '元素徽記'] }] }
    ],
    equipment: { mainHand: '鐵錘', offHand: '青銅圓盾', armor: '旅行皮甲', accessory: '' },
    zenit: 170,
    arcana: ['forge']
  },
  {
    id: 'hf_sergeant', sourcebook: 'highFantasy', group: null,
    title: '中士', en: 'SERGEANT',
    attributes: { dex: 6, ins: 8, mig: 10, wlp: 8 },
    classes: [
      { className: '指揮官', level: 2, skills: [{ name: '騎兵衝鋒', sl: 1 }, { name: '皇后的秘密計劃', sl: 1 }] },
      { className: '狂怒鬥士', level: 1, skills: [{ name: '不屈意志', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '碎骨擊', sl: 1 }] }
    ],
    equipment: { mainHand: '闊斧', offHand: '青銅圓盾', armor: '板條甲', accessory: '' },
    zenit: 70
  },
  {
    id: 'hf_strategist', sourcebook: 'highFantasy', group: null,
    title: '戰略家', en: 'STRATEGIST',
    attributes: { dex: 6, ins: 10, mig: 8, wlp: 8 },
    classes: [
      { className: '指揮官', level: 3, skills: [{ name: '主教法令', sl: 1 }, { name: '戰車碾壓', sl: 1 }, { name: '帝王堅壘', sl: 1 }] },
      { className: '博學士', level: 2, skills: [{ name: '靈光一閃', sl: 1 }, { name: '知識就是力量', sl: 1 }] }
    ],
    equipment: { mainHand: '手槍', offHand: '青銅圓盾', armor: '旅行皮甲', accessory: '' },
    zenit: 120
  },
  {
    id: 'hf_traveling_artist', sourcebook: 'highFantasy', group: null,
    title: '旅行畫師', en: 'TRAVELING ARTIST',
    attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
    classes: [
      { className: '徽記師', level: 3, skills: [{ name: '幻影', sl: 1 }, { name: '徽記學', sl: 2, selectedOptions: ['元素徽記', '成長徽記', '防護徽記', '反抗徽記'] }] },
      { className: '旅人', level: 2, skills: [{ name: '酒館閒聊', sl: 1 }, { name: '有備無患', sl: 1 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'hf_heartthrob_thief', sourcebook: 'highFantasy',
    group: { id: 'hf_company_of_heroes', title: '英雄小隊：整裝待發！' },
    title: '萬人迷盜賊', en: 'HEARTTHROB THIEF',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '遊蕩者', level: 3, skills: [{ name: '偷襲', sl: 1 }, { name: '閃避', sl: 1 }, { name: '靈魂竊取', sl: 1 }] },
      { className: '旅人', level: 1, skills: [{ name: '酒館閒聊', sl: 1 }] },
      { className: '武器大師', level: 1, skills: [{ name: '碎骨擊', sl: 1 }] }
    ],
    equipment: { mainHand: '雙匕首', offHand: '無盾牌', armor: '戰鬥輕甲', accessory: '' },
    customWeapons: [
      {
        name: '雙匕首',
        category: '匕首',
        range: '近戰',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'quick'],
        element: '',
        id: 'cw_雙匕首'
      }
    ],
    zenit: 120
  },
  {
    id: 'hf_naive_chosen', sourcebook: 'highFantasy',
    group: { id: 'hf_company_of_heroes', title: '英雄小隊：整裝待發！' },
    title: '天真的被選者', en: 'NAIVE CHOSEN',
    attributes: { dex: 6, ins: 8, mig: 8, wlp: 10 },
    classes: [
      { className: '秘儀師', level: 2, skills: [{ name: '綁定和召喚', sl: 1 }, { name: '秘儀學派儀式', sl: 1 }] },
      { className: '魔奏者', level: 2, skills: [{ name: '魔法演奏', sl: 2, selectedOptions: { keys: ['輝光'], tones: ['冷靜', '莊嚴'] } }] },
      { className: '吟唱者', level: 1, skills: [{ name: '我相信你', sl: 1 }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270,
    arcana: ['tower']
  },
  {
    id: 'hf_valiant_knight', sourcebook: 'highFantasy',
    group: { id: 'hf_company_of_heroes', title: '英雄小隊：整裝待發！' },
    title: '英勇騎士', en: 'VALIANT KNIGHT',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '指揮官', level: 2, skills: [{ name: '騎兵衝鋒', sl: 1 }, { name: '皇后的秘密計劃', sl: 1 }] },
      { className: '守護者', level: 1, skills: [{ name: '保護', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '招架反擊', sl: 1 }] }
    ],
    equipment: { mainHand: '巨劍', offHand: '無盾牌', armor: '符文甲冑', accessory: '' },
    zenit: 120
  },
  {
    id: 'hf_young_sage', sourcebook: 'highFantasy',
    group: { id: 'hf_company_of_heroes', title: '英雄小隊：整裝待發！' },
    title: '年少賢者', en: 'YOUNG SAGE',
    attributes: { dex: 6, ins: 10, mig: 6, wlp: 10 },
    classes: [
      { className: '元素師', level: 3, skills: [{ name: '元素魔法', sl: 3, selectedOptions: ['電流術', '冰川覆裂', '伊格尼斯之火'] }] },
      { className: '熵師', level: 1, skills: [{ name: '熵系魔法', sl: 1, selectedOptions: ['加速'] }] },
      { className: '博學士', level: 1, skills: [{ name: '靈光一閃', sl: 1 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'hf_goth_diva', sourcebook: 'highFantasy',
    group: { id: 'hf_the_band', title: '樂團：這節奏將拯救世界！' },
    title: '哥德歌姬', en: 'GOTH DIVA',
    attributes: { dex: 10, ins: 6, mig: 8, wlp: 8 },
    classes: [
      { className: '魔奏者', level: 2, skills: [{ name: '魔法演奏', sl: 1, selectedOptions: { keys: ['疾風'], tones: ['縈繞'] } }, { name: '顫音', sl: 1 }] },
      { className: '舞者', level: 1, skills: [{ name: '起舞', sl: 1, selectedOptions: ['夢魘麋'] }] },
      { className: '神射手', level: 2, skills: [{ name: '遠程武器掌握', sl: 1 }, { name: '警告射擊', sl: 1 }] }
    ],
    equipment: { mainHand: '狂風提琴', offHand: '無盾牌', armor: '戰鬥輕甲', accessory: '' },
    customWeapons: [
      {
        name: '狂風提琴',
        category: '連枷',
        range: '遠程',
        accuracy: 'DEX + MIG',
        customizations: ['elemental', 'quick'],
        element: '風',
        id: 'cw_狂風提琴'
      }
    ],
    zenit: 120
  },
  {
    id: 'hf_golden_hearted_siren', sourcebook: 'highFantasy',
    group: { id: 'hf_the_band', title: '樂團：這節奏將拯救世界！' },
    title: '金心賽蓮', en: 'GOLDEN-HEARTED SIREN',
    attributes: { dex: 8, ins: 8, mig: 6, wlp: 10 },
    classes: [
      { className: '魔奏者', level: 4, skills: [{ name: '魔法演奏', sl: 3, selectedOptions: { keys: ['熾熱', '霜凍'], tones: ['冷靜', '洶湧'] } }, { name: '塞壬之歌', sl: 1 }] },
      { className: '吟唱者', level: 1, skills: [{ name: '意外盟友', sl: 1 }] }
    ],
    equipment: { mainHand: '魅惑麥克風', offHand: '無盾牌', armor: '絲綢外衣', accessory: '' },
    customWeapons: [
      {
        name: '魅惑麥克風',
        category: '奧術',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'elemental', 'defenseBoost'],
        element: '光',
        id: 'cw_魅惑麥克風'
      }
    ],
    zenit: 170
  },
  {
    id: 'hf_ironclad_big_sis', sourcebook: 'highFantasy',
    group: { id: 'hf_the_band', title: '樂團：這節奏將拯救世界！' },
    title: '鐵甲大姊', en: 'IRONCLAD BIG SIS',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '魔奏者', level: 3, skills: [{ name: '魔法演奏', sl: 1, selectedOptions: { keys: ['鋼鐵'], tones: ['生動'] } }, { name: '隔音屏障', sl: 2 }] },
      { className: '狂怒鬥士', level: 1, skills: [{ name: '挑釁', sl: 1 }] },
      { className: '守護者', level: 1, skills: [{ name: '保護', sl: 1 }] }
    ],
    equipment: { mainHand: '鐵甲貝斯', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '鐵甲貝斯',
        category: '重型',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['accurate', 'defenseBoost', 'powerful'],
        element: '',
        id: 'cw_鐵甲貝斯'
      }
    ],
    zenit: 70
  },
  {
    id: 'hf_life_of_the_party', sourcebook: 'highFantasy',
    group: { id: 'hf_the_band', title: '樂團：這節奏將拯救世界！' },
    title: '派對靈魂', en: 'LIFE OF THE PARTY',
    attributes: { dex: 8, ins: 6, mig: 8, wlp: 10 },
    classes: [
      { className: '魔奏者', level: 3, skills: [{ name: '魔法演奏', sl: 2, selectedOptions: { keys: ['閃雷'], tones: ['瘋狂', '洶湧'] } }, { name: '顫音', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '碎骨擊', sl: 1 }] }
    ],
    equipment: { mainHand: '雷霆鼓', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    customWeapons: [
      {
        name: '雷霆鼓',
        category: '重型',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['accurate', 'elemental', 'powerful'],
        element: '電',
        id: 'cw_雷霆鼓'
      }
    ],
    zenit: 170
  },

  // ============================================================
  // 自然奇幻手冊（18 組）
  // ============================================================
  {
    id: 'nf_elemental_acrobat', sourcebook: 'naturalFantasy', group: null,
    title: '元素雜技師', en: 'ELEMENTAL ACROBAT',
    attributes: { dex: 10, ins: 6, mig: 8, wlp: 8 },
    classes: [
      { className: '狂怒鬥士', level: 1, skills: [{ name: '不屈意志', sl: 1 }] },
      { className: '祈喚者', level: 3, skills: [{ name: '元素祈喚', sl: 2 }, { name: '波紋', sl: 1 }] },
      { className: '神射手', level: 1, skills: [{ name: '連續射擊', sl: 1 }] }
    ],
    equipment: { mainHand: '巨型環刃', offHand: '無盾牌', armor: '戰鬥輕甲', accessory: '' },
    customWeapons: [
      {
        name: '巨型環刃',
        category: '投擲',
        range: '遠程',
        accuracy: 'DEX + MIG',
        customizations: ['accurate', 'defenseBoost', 'powerful'],
        element: '',
        id: 'cw_巨型環刃'
      }
    ],
    zenit: 120
  },
  {
    id: 'nf_flutist_monk', sourcebook: 'naturalFantasy', group: null,
    title: '長笛武僧', en: 'FLUTIST MONK',
    attributes: { dex: 6, ins: 8, mig: 8, wlp: 10 },
    classes: [
      { className: '祈喚者', level: 3, skills: [{ name: '元素祈喚', sl: 1 }, { name: '泉源擴張', sl: 2 }] },
      { className: '靈師', level: 2, skills: [{ name: '靈魂學派儀式', sl: 1 }, { name: '靈魂魔法', sl: 1, selectedOptions: ['淨化'] }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'nf_frontier_researcher', sourcebook: 'naturalFantasy', group: null,
    title: '邊境研究者', en: 'FRONTIER RESEARCHER',
    attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
    classes: [
      { className: '博學士', level: 1, skills: [{ name: '快速評估', sl: 1 }] },
      { className: '商人', level: 2, skills: [{ name: '我聽說過', sl: 1 }, { name: '貿易之風', sl: 1 }] },
      { className: '神射手', level: 2, skills: [{ name: '交叉火力', sl: 1 }, { name: '警告射擊', sl: 1 }] }
    ],
    equipment: { mainHand: '雙袖珍手槍', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    customWeapons: [
      {
        name: '雙袖珍手槍',
        category: '火器',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'quick'],
        element: '',
        id: 'cw_雙袖珍手槍'
      }
    ],
    zenit: 170
  },
  {
    id: 'nf_grinning_veteran', sourcebook: 'naturalFantasy', group: null,
    title: '笑面老兵', en: 'GRINNING VETERAN',
    attributes: { dex: 6, ins: 8, mig: 10, wlp: 8 },
    classes: [
      { className: '美食家', level: 3, skills: [{ name: '烹飪', sl: 1 }, { name: '舞刀弄叉', sl: 1 }, { name: '準備食材', sl: 1 }] },
      { className: '守護者', level: 1, skills: [{ name: '保護', sl: 1 }] },
      { className: '武器大師', level: 1, skills: [{ name: '劍刃風暴', sl: 1 }] }
    ],
    equipment: { mainHand: '戰斧', offHand: '無盾牌', armor: '符文甲冑', accessory: '' },
    zenit: 70
  },
  {
    id: 'nf_keeper_of_the_sacred_tree', sourcebook: 'naturalFantasy', group: null,
    title: '聖樹守護者', en: 'KEEPER OF THE SACRED TREE',
    attributes: { dex: 6, ins: 6, mig: 10, wlp: 10 },
    classes: [
      { className: '秘儀師', level: 3, skills: [{ name: '綁定和召喚', sl: 1 }, { name: '緊急秘儀', sl: 2 }] },
      { className: '祈喚者', level: 2, skills: [{ name: '元素祈喚', sl: 1 }, { name: '聯結祈喚', sl: 1 }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    zenit: 370,
    arcana: ['oak']
  },
  {
    id: 'nf_lotus_duelist', sourcebook: 'naturalFantasy', group: null,
    title: '蓮花決鬥者', en: 'LOTUS DUELIST',
    attributes: { dex: 10, ins: 8, mig: 6, wlp: 8 },
    classes: [
      { className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 1, selectedOptions: ['烈風'] }, { name: '咒語之刃', sl: 1 }] },
      { className: '植物學家', level: 2, skills: [{ name: '戰地園藝', sl: 1 }, { name: '植生術', sl: 1, selectedOptions: ['海洋蓮花'] }] },
      { className: '武器大師', level: 1, skills: [{ name: '招架反擊', sl: 1 }] }
    ],
    equipment: { mainHand: '睡蓮之刃', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '睡蓮之刃',
        category: '劍',
        range: '近戰',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'elemental', 'magicDefenseBoost'],
        element: '冰',
        id: 'cw_睡蓮之刃'
      }
    ],
    zenit: 70
  },
  {
    id: 'nf_shy_apothecary', sourcebook: 'naturalFantasy', group: null,
    title: '靦腆藥劑師', en: 'SHY APOTHECARY',
    attributes: { dex: 8, ins: 10, mig: 8, wlp: 6 },
    classes: [
      { className: '商人', level: 1, skills: [{ name: '過期食品', sl: 1 }] },
      { className: '修補匠', level: 4, skills: [{ name: '藥水雨', sl: 2 }, { name: '高瞻遠矚', sl: 2 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'nf_small_merchant', sourcebook: 'naturalFantasy', group: null,
    title: '小商人', en: 'SMALL MERCHANT',
    attributes: { dex: 6, ins: 10, mig: 8, wlp: 8 },
    classes: [
      { className: '商人', level: 2, skills: [{ name: '真正的財富', sl: 1 }, { name: '貿易之風', sl: 1 }] },
      { className: '旅人', level: 3, skills: [{ name: '忠實夥伴', sl: 3 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '絲綢外衣', accessory: '' },
    zenit: 370
  },
  {
    id: 'nf_troublemaker_rogue', sourcebook: 'naturalFantasy', group: null,
    title: '麻煩精', en: 'TROUBLEMAKER ROGUE',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '美食家', level: 2, skills: [{ name: '烹飪', sl: 1 }, { name: '舞刀弄叉', sl: 1 }] },
      { className: '遊蕩者', level: 1, skills: [{ name: '迅捷', sl: 1 }] },
      { className: '神射手', level: 2, skills: [{ name: '連續射擊', sl: 1 }, { name: '警告射擊', sl: 1 }] }
    ],
    equipment: { mainHand: '短弓', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    zenit: 270
  },
  {
    id: 'nf_twilight_witch', sourcebook: 'naturalFantasy', group: null,
    title: '暮色女巫', en: 'TWILIGHT WITCH',
    attributes: { dex: 6, ins: 10, mig: 6, wlp: 10 },
    classes: [
      { className: '熵師', level: 2, skills: [{ name: '熵系魔法', sl: 2, selectedOptions: ['驅散', '魔鏡'] }] },
      { className: '植物學家', level: 3, skills: [{ name: '戰地園藝', sl: 1 }, { name: '植生術', sl: 1, selectedOptions: ['星辰牡丹'] }, { name: '青翠之勢', sl: 1 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'nf_mysterious_elf', sourcebook: 'naturalFantasy',
    group: { id: 'nf_childhood_friends', title: '童年好友：漫漫長路在前' },
    title: '神秘精靈', en: 'MYSTERIOUS ELF',
    attributes: { dex: 10, ins: 10, mig: 6, wlp: 6 },
    classes: [
      { className: '嵌合師', level: 1, skills: [{ name: '野性交談', sl: 1 }] },
      { className: '博學士', level: 2, skills: [{ name: '靈光一閃', sl: 2 }] },
      { className: '神射手', level: 2, skills: [{ name: '連續射擊', sl: 1 }, { name: '警告射擊', sl: 1 }] }
    ],
    equipment: { mainHand: '短弓', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 170
  },
  {
    id: 'nf_rowdy_miner', sourcebook: 'naturalFantasy',
    group: { id: 'nf_childhood_friends', title: '童年好友：漫漫長路在前' },
    title: '喧鬧礦工', en: 'ROWDY MINER',
    attributes: { dex: 6, ins: 8, mig: 10, wlp: 8 },
    classes: [
      { className: '狂怒鬥士', level: 1, skills: [{ name: '挑釁', sl: 1 }] },
      { className: '商人', level: 1, skills: [{ name: '貿易之風', sl: 1 }] },
      { className: '旅人', level: 3, skills: [{ name: '酒館閒聊', sl: 1 }, { name: '寶藏獵人', sl: 1 }, { name: '通曉道路', sl: 1 }] }
    ],
    equipment: { mainHand: '戰斧', offHand: '無盾牌', armor: '青銅胸甲', accessory: '' },
    zenit: 120
  },
  {
    id: 'nf_upbeat_squire', sourcebook: 'naturalFantasy',
    group: { id: 'nf_childhood_friends', title: '童年好友：漫漫長路在前' },
    title: '開朗侍從', en: 'UPBEAT SQUIRE',
    attributes: { dex: 10, ins: 6, mig: 8, wlp: 8 },
    classes: [
      { className: '吟唱者', level: 2, skills: [{ name: '激勵', sl: 2 }] },
      { className: '武器大師', level: 3, skills: [{ name: '碎骨擊', sl: 1 }, { name: '破甲擊', sl: 1 }, { name: '近戰武器掌握', sl: 1 }] }
    ],
    equipment: { mainHand: '青銅劍', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' },
    zenit: 120
  },
  {
    id: 'nf_young_herbalist', sourcebook: 'naturalFantasy',
    group: { id: 'nf_childhood_friends', title: '童年好友：漫漫長路在前' },
    title: '年少藥草師', en: 'YOUNG HERBALIST',
    attributes: { dex: 6, ins: 8, mig: 8, wlp: 10 },
    classes: [
      { className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 1, selectedOptions: ['大地震擊'] }, { name: '魔法砲擊', sl: 1 }] },
      { className: '植物學家', level: 3, skills: [{ name: '植生術', sl: 2, selectedOptions: ['蒲公英之舞', '治療百合'] }, { name: '嫁接', sl: 1 }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'nf_deep_fry_artist', sourcebook: 'naturalFantasy',
    group: { id: 'nf_kitchen_brigade', title: '廚房兵團：我又想到新食譜了！' },
    title: '油炸藝術家', en: 'DEEP-FRY ARTIST',
    attributes: { dex: 8, ins: 8, mig: 10, wlp: 6 },
    classes: [
      { className: '狂怒鬥士', level: 1, skills: [{ name: '忍耐', sl: 1 }] },
      { className: '美食家', level: 2, skills: [{ name: '烹飪', sl: 1 }, { name: '鹽與胡椒', sl: 1 }] },
      { className: '守護者', level: 2, skills: [{ name: '保鏢', sl: 1 }, { name: '保護', sl: 1 }] }
    ],
    equipment: { mainHand: '鑊盾', offHand: '無盾牌', armor: '青銅胸甲', accessory: '' },
    customWeapons: [
      {
        name: '鑊盾',
        category: '鬥毆',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['defenseBoost', 'elemental', 'magicDefenseBoost'],
        element: '火',
        id: 'cw_鑊盾'
      }
    ],
    zenit: 70
  },
  {
    id: 'nf_infusion_master', sourcebook: 'naturalFantasy',
    group: { id: 'nf_kitchen_brigade', title: '廚房兵團：我又想到新食譜了！' },
    title: '浸萃大師', en: 'INFUSION MASTER',
    attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
    classes: [
      { className: '美食家', level: 2, skills: [{ name: '烹飪', sl: 1 }, { name: '舞刀弄叉', sl: 1 }] },
      { className: '神射手', level: 2, skills: [{ name: '連續射擊', sl: 1 }, { name: '遠程武器掌握', sl: 1 }] },
      { className: '修補匠', level: 1, skills: [{ name: '小工具', sl: 1 }] }
    ],
    equipment: { mainHand: '壺釜', offHand: '無盾牌', armor: '絲綢外衣', accessory: '' },
    customWeapons: [
      {
        name: '壺釜',
        category: '火器',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'magicDefenseBoost', 'powerful'],
        element: '',
        id: 'cw_壺釜'
      }
    ],
    zenit: 170,
    gadgets: { alchemy: 0, infusion: 1, magitech: 0, magitechSpells: [] }
  },
  {
    id: 'nf_pickler', sourcebook: 'naturalFantasy',
    group: { id: 'nf_kitchen_brigade', title: '廚房兵團：我又想到新食譜了！' },
    title: '醃漬師', en: 'PICKLER',
    attributes: { dex: 6, ins: 10, mig: 8, wlp: 8 },
    classes: [
      { className: '熵師', level: 1, skills: [{ name: '熵系魔法', sl: 1, selectedOptions: ['停滯'] }] },
      { className: '美食家', level: 2, skills: [{ name: '烹飪', sl: 1 }, { name: '準備食材', sl: 1 }] },
      { className: '商人', level: 2, skills: [{ name: '小金庫', sl: 1 }, { name: '貿易之風', sl: 1 }] }
    ],
    equipment: { mainHand: '急凍器', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '急凍器',
        category: '匕首',
        range: '近戰',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'defenseBoost', 'elemental'],
        element: '冰',
        id: 'cw_急凍器'
      }
    ],
    zenit: 70
  },
  {
    id: 'nf_street_cook', sourcebook: 'naturalFantasy',
    group: { id: 'nf_kitchen_brigade', title: '廚房兵團：我又想到新食譜了！' },
    title: '街頭廚師', en: 'STREET COOK',
    attributes: { dex: 8, ins: 8, mig: 6, wlp: 10 },
    classes: [
      { className: '美食家', level: 2, skills: [{ name: '烹飪', sl: 1 }, { name: '加點愛', sl: 1 }] },
      { className: '吟唱者', level: 2, skills: [{ name: '我相信你', sl: 1 }, { name: '意外盟友', sl: 1 }] },
      { className: '旅人', level: 1, skills: [{ name: '酒館閒聊', sl: 1 }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },

  // ============================================================
  // 科技奇幻手冊（17 組）
  // ============================================================
  {
    id: 'tf_chimeric_hunter', sourcebook: 'technoFantasy', group: null,
    title: '嵌合獵人', en: 'CHIMERIC HUNTER',
    attributes: { dex: 8, ins: 10, mig: 8, wlp: 6 },
    classes: [
      { className: '突變體', level: 3, skills: [{ name: '混合變形', sl: 3, selectedOptions: ['追獵形態', '放電形態', '毒物形態'] }] },
      { className: '神射手', level: 2, skills: [{ name: '連續射擊', sl: 1 }, { name: '鷹眼', sl: 1 }] }
    ],
    equipment: { mainHand: '防禦弩', offHand: '無盾牌', armor: '青銅胸甲', accessory: '' },
    customWeapons: [
      {
        name: '防禦弩',
        category: '弓',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'defenseBoost', 'powerful'],
        element: '',
        id: 'cw_防禦弩'
      }
    ],
    zenit: 70
  },
  {
    id: 'tf_cybervampire', sourcebook: 'technoFantasy', group: null,
    title: '電馭吸血鬼', en: 'CYBERVAMPIRE',
    attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
    classes: [
      { className: '熵師', level: 1, skills: [{ name: '熵系魔法', sl: 1, selectedOptions: ['抽取活力'] }] },
      { className: '突變體', level: 3, skills: [{ name: '吞噬', sl: 1 }, { name: '混合變形', sl: 2, selectedOptions: ['神經吞噬形態', '飛翼形態'] }] },
      { className: '神射手', level: 1, skills: [{ name: '連續射擊', sl: 1 }] }
    ],
    equipment: { mainHand: '「懺悔」左輪', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '「懺悔」左輪',
        category: '火器',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'elemental', 'magicDefenseBoost'],
        element: '光',
        id: 'cw_「懺悔」左輪'
      }
    ],
    zenit: 70
  },
  {
    id: 'tf_magical_gun_girl', sourcebook: 'technoFantasy', group: null,
    title: '魔導槍姬', en: 'MAGICAL GUN GIRL',
    attributes: { dex: 6, ins: 8, mig: 8, wlp: 10 },
    classes: [
      { className: '元素師', level: 3, skills: [{ name: '災難', sl: 1 }, { name: '元素魔法', sl: 2, selectedOptions: ['冰川覆裂', '伊格尼斯之火'] }] },
      { className: '機師', level: 2, skills: [{ name: '壓縮技術', sl: 1 }, { name: '個人載具', sl: 1 }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270,
    vehicle: { frameId: 'exoskeleton', modules: ['advanced_targeting_module', 'aerial_module', 'magistatic_module'] }
  },
  {
    id: 'tf_net_wizard', sourcebook: 'technoFantasy', group: null,
    title: '網路巫師', en: 'NET WIZARD',
    attributes: { dex: 6, ins: 10, mig: 8, wlp: 8 },
    classes: [
      { className: '元素師', level: 1, skills: [{ name: '元素魔法', sl: 1, selectedOptions: ['冰凍堡壘'] }] },
      { className: '靈能者', level: 3, skills: [{ name: '認知焦點', sl: 1 }, { name: '心靈天賦', sl: 1, selectedOptions: ['光能掌握'] }, { name: '領航員', sl: 1 }] },
      { className: '博學士', level: 1, skills: [{ name: '靈光一閃', sl: 1 }] }
    ],
    equipment: { mainHand: '破壞者護手', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '破壞者護手',
        category: '奧術',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'defenseBoost', 'elemental'],
        element: '電',
        id: 'cw_破壞者護手'
      }
    ],
    zenit: 70
  },
  {
    id: 'tf_psychic_avenger', sourcebook: 'technoFantasy', group: null,
    title: '靈能復仇者', en: 'PSYCHIC AVENGER',
    attributes: { dex: 6, ins: 8, mig: 10, wlp: 8 },
    classes: [
      { className: '暗黑之刃', level: 2, skills: [{ name: '暗黑之心', sl: 1 }, { name: '暗影突襲', sl: 1 }] },
      { className: '靈能者', level: 2, skills: [{ name: '心靈天賦', sl: 2, selectedOptions: ['神視', '精神反衝'] }] },
      { className: '守護者', level: 1, skills: [{ name: '保護', sl: 1 }] }
    ],
    equipment: { mainHand: '戰斧', offHand: '無盾牌', armor: '符文甲冑', accessory: '' },
    zenit: 70
  },
  {
    id: 'tf_road_knight', sourcebook: 'technoFantasy', group: null,
    title: '道路騎士', en: 'ROAD KNIGHT',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '機師', level: 2, skills: [{ name: '引擎之心', sl: 1 }, { name: '個人載具', sl: 1 }] },
      { className: '遊蕩者', level: 1, skills: [{ name: '迅捷', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '近戰武器掌握', sl: 1 }] }
    ],
    equipment: { mainHand: '輕長矛', offHand: '符文圓盾', armor: '旅行皮甲', accessory: '' },
    zenit: 120,
    vehicle: { frameId: 'steed', modules: ['flexible_plating', 'rapid_interface_module', 'turbo_module'] }
  },
  {
    // 官方原書印作 d6/d6/d8/d10（總和 30），是**筆誤**：全 81 組中僅此組不成官方 32 點陣列。
    // 使用者裁定依技能與武器組合補回——武器為 (DEX + MIG)、【念動力】可把一顆骰換成 WLP，
    // 故缺的是靈巧（d6 → d8），補回後即為正典 (10,8,8,6) 陣列；洞察維持 d6（本組合無洞察系技能）。
    // 已以 pypdf 逐字元座標確認原書數值，非抽取誤差（見 docs/decisions.md §P5）。
    id: 'tf_soulstream_psyblade', sourcebook: 'technoFantasy', group: null,
    title: '魂流靈刃', en: 'SOULSTREAM PSYBLADE',
    attributes: { dex: 8, ins: 6, mig: 8, wlp: 10 },
    classes: [
      { className: '靈能者', level: 3, skills: [{ name: '認知焦點', sl: 1 }, { name: '心靈天賦', sl: 1, selectedOptions: ['生命轉移'] }, { name: '念動力', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '碎骨擊', sl: 1 }, { name: '招架反擊', sl: 1 }] }
    ],
    equipment: { mainHand: '本我雙刃', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    customWeapons: [
      {
        name: '本我雙刃',
        category: '劍',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['elemental', 'quick'],
        element: '暗',
        id: 'cw_本我雙刃'
      }
    ],
    zenit: 120
  },
  {
    id: 'tf_roving_physician', sourcebook: 'technoFantasy', group: null,
    title: '巡迴醫師', en: 'ROVING PHYSICIAN',
    attributes: { dex: 6, ins: 10, mig: 6, wlp: 10 },
    classes: [
      { className: '靈能者', level: 1, skills: [{ name: '心靈天賦', sl: 1, selectedOptions: ['安心'] }] },
      { className: '修補匠', level: 1, skills: [{ name: '藥水雨', sl: 1 }] },
      { className: '旅人', level: 3, skills: [{ name: '忠實夥伴', sl: 3 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 270
  },
  {
    id: 'tf_test_subject', sourcebook: 'technoFantasy', group: null,
    title: '實驗體', en: 'TEST SUBJECT',
    attributes: { dex: 8, ins: 8, mig: 10, wlp: 6 },
    classes: [
      { className: '嵌合師', level: 1, skills: [{ name: '咒語模仿', sl: 1 }] },
      { className: '狂怒鬥士', level: 1, skills: [{ name: '暴怒', sl: 1 }] },
      { className: '突變體', level: 3, skills: [{ name: '無拘形態', sl: 1 }, { name: '基因分析', sl: 1 }, { name: '混合變形', sl: 1, selectedOptions: ['腕力形態'] }] }
    ],
    equipment: { mainHand: '徒手打擊', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 370
  },
  {
    id: 'tf_wandering_inventor', sourcebook: 'technoFantasy', group: null,
    title: '流浪發明家', en: 'WANDERING INVENTOR',
    attributes: { dex: 8, ins: 10, mig: 8, wlp: 6 },
    classes: [
      { className: '機師', level: 2, skills: [{ name: '個人載具', sl: 2 }] },
      { className: '修補匠', level: 3, skills: [{ name: '小工具', sl: 1 }, { name: '藥水雨', sl: 1 }, { name: '高瞻遠矚', sl: 1 }] }
    ],
    equipment: { mainHand: '徒手打擊', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 370,
    gadgets: { alchemy: 0, infusion: 1, magitech: 0, magitechSpells: [] },
    vehicle: { frameId: 'exoskeleton', modules: ['advanced_targeting_module', 'rifle_module', 'shield_module'] }
  },
  {
    id: 'tf_courageous_mystic', sourcebook: 'technoFantasy',
    group: { id: 'tf_rebel_cell', title: '反抗細胞：勇敢的革命者' },
    title: '勇敢的秘修者', en: 'COURAGEOUS MYSTIC',
    attributes: { dex: 6, ins: 10, mig: 6, wlp: 10 },
    classes: [
      { className: '靈能者', level: 1, skills: [{ name: '念動力', sl: 1 }] },
      { className: '吟唱者', level: 1, skills: [{ name: '我相信你', sl: 1 }] },
      { className: '靈師', level: 3, skills: [{ name: '靈魂學派儀式', sl: 1 }, { name: '靈魂魔法', sl: 2, selectedOptions: ['治癒', '加強'] }] }
    ],
    equipment: { mainHand: '折疊權杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '折疊權杖',
        category: '奧術',
        range: '近戰',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'elemental', 'magicDefenseBoost'],
        element: '光',
        id: 'cw_折疊權杖'
      }
    ],
    // 官方配搭配的初始職業魔石（科技奇幻手冊 p.134）。**結構化**，不是說明字串——
    // 以前這裡只是一個字串，只拿來顯示，套用之後玩家其實沒有那顆魔石（見 §CF）。
    mnemosphere: { className: '元素師', level: 1, label: '極性魔晶石' },
    zenit: 70
  },
  {
    id: 'tf_fierce_brawler', sourcebook: 'technoFantasy',
    group: { id: 'tf_rebel_cell', title: '反抗細胞：勇敢的革命者' },
    title: '兇猛打手', en: 'FIERCE BRAWLER',
    attributes: { dex: 10, ins: 6, mig: 8, wlp: 8 },
    classes: [
      { className: '狂怒鬥士', level: 1, skills: [{ name: '暴怒', sl: 1 }] },
      { className: '遊蕩者', level: 2, skills: [{ name: '偷襲', sl: 2 }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '碎骨擊', sl: 1 }] }
    ],
    equipment: { mainHand: '柔性纏手布', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    customWeapons: [
      {
        name: '柔性纏手布',
        category: '鬥毆',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['transforming', 'quick'],
        element: '',
        transformingId: 'cw_柔性纏手布_b',
        id: 'cw_柔性纏手布'
      },
      {
        name: '柔性纏手布（第二型態）',
        category: '鬥毆',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['transforming', 'accurate', 'powerful'],
        element: '',
        transformingId: 'cw_柔性纏手布',
        id: 'cw_柔性纏手布_b'
      }
    ],
    mnemosphere: { className: '靈能者', level: 1, label: '動能魔晶石' },
    zenit: 70
  },
  {
    id: 'tf_magsec_defector', sourcebook: 'technoFantasy',
    group: { id: 'tf_rebel_cell', title: '反抗細胞：勇敢的革命者' },
    title: '魔警叛逃者', en: 'MAGSEC DEFECTOR',
    attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
    classes: [
      { className: '狂怒鬥士', level: 1, skills: [{ name: '忍耐', sl: 1 }] },
      { className: '守護者', level: 1, skills: [{ name: '保護', sl: 1 }] },
      { className: '武器大師', level: 3, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '破甲擊', sl: 1 }, { name: '招架反擊', sl: 1 }] }
    ],
    equipment: { mainHand: '魔警巨劍', offHand: '無盾牌', armor: '青銅胸甲', accessory: '' },
    customWeapons: [
      {
        name: '魔警巨劍',
        category: '劍',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['accurate', 'defenseBoost', 'powerful'],
        element: '',
        id: 'cw_魔警巨劍'
      }
    ],
    mnemosphere: { className: '元素師', level: 1, label: '灼熱魔晶石' },
    zenit: 70
  },
  {
    id: 'tf_m001_nemo', sourcebook: 'technoFantasy',
    group: { id: 'tf_the_pilots', title: '機師們：控制系統，啟動！' },
    title: 'M001：尼莫', en: 'M001: NEMO',
    attributes: { dex: 8, ins: 10, mig: 8, wlp: 6 },
    classes: [
      { className: '機師', level: 3, skills: [{ name: '靈活配置', sl: 1 }, { name: '個人載具', sl: 2 }] },
      { className: '神射手', level: 1, skills: [{ name: '鷹眼', sl: 1 }] },
      { className: '武器大師', level: 1, skills: [{ name: '碎骨擊', sl: 1 }] }
    ],
    equipment: { mainHand: '手槍', offHand: '短匕首', armor: '絲綢外衣', accessory: '' },
    zenit: 70,
    vehicle: { frameId: 'mecha', modules: ['aerial_module', 'flamer_module', 'shield_module', 'sword_module', 'standard_plating'] }
  },
  {
    id: 'tf_m002_gozen', sourcebook: 'technoFantasy',
    group: { id: 'tf_the_pilots', title: '機師們：控制系統，啟動！' },
    title: 'M002：五禪', en: 'M002: GOZEN',
    attributes: { dex: 6, ins: 8, mig: 10, wlp: 8 },
    classes: [
      { className: '守護者', level: 1, skills: [{ name: '保護', sl: 1 }] },
      { className: '機師', level: 2, skills: [{ name: '個人載具', sl: 1 }, { name: '加大油門', sl: 1 }] },
      { className: '武器大師', level: 2, skills: [{ name: '劍刃風暴', sl: 1 }, { name: '招架反擊', sl: 1 }] }
    ],
    equipment: { mainHand: '戰斧', offHand: '無盾牌', armor: '符文甲冑', accessory: '' },
    zenit: 70,
    vehicle: { frameId: 'mecha', modules: ['aerial_module', 'scythe_module', 'heavy_plating'] }
  },
  {
    id: 'tf_m003_khorkoi', sourcebook: 'technoFantasy',
    group: { id: 'tf_the_pilots', title: '機師們：控制系統，啟動！' },
    title: 'M003：霍爾科伊', en: 'M003: KHORKOI',
    attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
    classes: [
      { className: '元素師', level: 1, skills: [{ name: '元素魔法', sl: 1, selectedOptions: ['元素武器'] }] },
      { className: '機師', level: 1, skills: [{ name: '個人載具', sl: 1 }] },
      { className: '遊蕩者', level: 3, skills: [{ name: '偷襲', sl: 1 }, { name: '閃避', sl: 2 }] }
    ],
    equipment: { mainHand: '弧光連枷', offHand: '無盾牌', armor: '戰鬥輕甲', accessory: '' },
    customWeapons: [
      {
        name: '弧光連枷',
        category: '連枷',
        range: '近戰',
        accuracy: 'DEX + INS',
        customizations: ['elemental', 'quick'],
        element: '電',
        id: 'cw_弧光連枷'
      }
    ],
    zenit: 120,
    vehicle: { frameId: 'mecha', modules: ['aerial_module', 'flexible_plating', 'machine_gun_module'] }
  },
  {
    id: 'tf_m005_walpurgis', sourcebook: 'technoFantasy',
    group: { id: 'tf_the_pilots', title: '機師們：控制系統，啟動！' },
    title: 'M005：瓦普吉斯', en: 'M005: WALPURGIS',
    attributes: { dex: 8, ins: 8, mig: 6, wlp: 10 },
    classes: [
      { className: '熵師', level: 2, skills: [{ name: '熵系魔法', sl: 2, selectedOptions: ['加速', '半影'] }] },
      { className: '機師', level: 2, skills: [{ name: '個人載具', sl: 2 }] },
      { className: '靈師', level: 1, skills: [{ name: '靈魂魔法', sl: 1, selectedOptions: ['治癒'] }] }
    ],
    equipment: { mainHand: '手槍', offHand: '無盾牌', armor: '旅行皮甲', accessory: '' },
    customWeapon: '埃克特里步槍（定制武器樣本，見科技奇幻手冊 p.116）',
    zenit: 70,
    vehicle: { frameId: 'mecha', modules: ['advanced_targeting_module', 'aerial_module', 'bow_module', 'counterstrike_module', 'runic_plating'] }
  },

  // ============================================================
  // 官方特典合輯 —— 萬聖節經典角色（8 組，皆帶金手指）
  // ============================================================
  {
    id: 'bc_bog_witch', sourcebook: 'bonus', group: null,
    title: '沼澤女巫', en: 'BOG WITCH',
    attributes: { dex: 6, ins: 8, mig: 8, wlp: 10 },
    classes: [
      { className: '元素師', level: 2, skills: [{ name: '災難', sl: 1 }, { name: '元素魔法', sl: 1, selectedOptions: ['冰凍堡壘'] }] },
      { className: '旅人', level: 3, skills: [{ name: '忠實夥伴', sl: 3 }] }
    ],
    equipment: { mainHand: '法杖', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    quirk: '巫術後裔',
    zenit: 270
  },
  {
    id: 'bc_centuries_old_vampire', sourcebook: 'bonus', group: null,
    title: '千年吸血鬼', en: 'CENTURIES-OLD VAMPIRE',
    attributes: { dex: 8, ins: 8, mig: 6, wlp: 10 },
    classes: [
      { className: '靈能者', level: 1, skills: [{ name: '念動力', sl: 1 }] },
      { className: '突變體', level: 2, skills: [{ name: '無拘形態', sl: 2 }] },
      { className: '靈師', level: 2, skills: [{ name: '靈魂魔法', sl: 2, selectedOptions: ['激怒', '幻覺'] }] }
    ],
    equipment: { mainHand: '徒手打擊', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    quirk: '束縛你的約定',
    zenit: 370
  },
  {
    id: 'bc_mellow_gang', sourcebook: 'bonus', group: null,
    title: '軟糯幫', en: 'MELLOW GANG',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '嵌合師', level: 1, skills: [{ name: '野性交談', sl: 1 }] },
      { className: '舞者', level: 2, skills: [{ name: '起舞', sl: 2, selectedOptions: ['獅鷲形', '獨角獸'] }] },
      { className: '武器大師', level: 2, skills: [{ name: '碎骨擊', sl: 1 }, { name: '破甲擊', sl: 1 }] }
    ],
    equipment: { mainHand: '巨型麻糬杵', offHand: '無盾牌', armor: '戰鬥輕甲', accessory: '' },
    customWeapons: [
      {
        name: '巨型麻糬杵',
        category: '鬥毆',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['accurate', 'quick'],
        element: '',
        id: 'cw_巨型麻糬杵'
      }
    ],
    quirk: '怪物幫派',
    zenit: 120
  },
  {
    id: 'bc_model_punk', sourcebook: 'bonus', group: null,
    title: '模範不良', en: 'MODEL PUNK',
    attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
    classes: [
      { className: '狂怒鬥士', level: 1, skills: [{ name: '不屈意志', sl: 1 }] },
      { className: '吟唱者', level: 2, skills: [{ name: '激勵', sl: 1 }, { name: '我相信你', sl: 1 }] },
      { className: '靈師', level: 2, skills: [{ name: '靈魂魔法', sl: 1, selectedOptions: ['治癒'] }, { name: '支援魔法', sl: 1 }] }
    ],
    equipment: { mainHand: '擴音器', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '擴音器',
        category: '奧術',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'elemental', 'magicDefenseBoost'],
        element: '電',
        id: 'cw_擴音器'
      }
    ],
    quirk: '地獄差生',
    zenit: 70
  },
  {
    id: 'bc_mummy_advisor', sourcebook: 'bonus', group: null,
    title: '木乃伊顧問', en: 'MUMMY ADVISOR',
    attributes: { dex: 6, ins: 10, mig: 8, wlp: 8 },
    classes: [
      { className: '熵師', level: 2, skills: [{ name: '熵系魔法', sl: 2, selectedOptions: ['加速', '預測'] }] },
      { className: '吟唱者', level: 2, skills: [{ name: '譴責', sl: 1 }, { name: '激勵', sl: 1 }] },
      { className: '博學士', level: 1, skills: [{ name: '靈光一閃', sl: 1 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    quirk: '(不太)忠誠的僕人',
    zenit: 270
  },
  {
    id: 'bc_prince_of_malebolge', sourcebook: 'bonus', group: null,
    title: '馬勒博爾熱親王', en: 'PRINCE OF MALEBOLGE',
    attributes: { dex: 10, ins: 6, mig: 8, wlp: 8 },
    classes: [
      { className: '元素師', level: 3, skills: [{ name: '元素魔法', sl: 2, selectedOptions: ['照明烈焰', '雷霆'] }, { name: '咒語之刃', sl: 1 }] },
      { className: '暗黑之刃', level: 1, skills: [{ name: '暗影突襲', sl: 1 }] },
      { className: '狂怒鬥士', level: 1, skills: [{ name: '腎上腺素', sl: 1 }] }
    ],
    equipment: { mainHand: '祕儀巨劍', offHand: '無盾牌', armor: '戰鬥輕甲', accessory: '' },
    customWeapons: [
      {
        name: '祕儀巨劍',
        category: '劍',
        range: '近戰',
        accuracy: 'DEX + MIG',
        customizations: ['accurate', 'defenseBoost', 'powerful'],
        element: '',
        id: 'cw_祕儀巨劍'
      }
    ],
    quirk: '被推翻的王',
    zenit: 120
  },
  {
    id: 'bc_robokaiju_prototype', sourcebook: 'bonus', group: null,
    title: '機獸原型機', en: 'ROBOKAIJU PROTOTYPE',
    attributes: { dex: 8, ins: 6, mig: 10, wlp: 8 },
    classes: [
      { className: '修補匠', level: 1, skills: [{ name: '小工具', sl: 1 }] },
      { className: '守護者', level: 2, skills: [{ name: '防守掌握', sl: 2 }] },
      { className: '神射手', level: 2, skills: [{ name: '連續射擊', sl: 1 }, { name: '鷹眼', sl: 1 }] }
    ],
    equipment: { mainHand: '腹砲原子加農', offHand: '無盾牌', armor: '青銅胸甲', accessory: '' },
    customWeapons: [
      {
        name: '腹砲原子加農',
        category: '火器',
        range: '遠程',
        accuracy: 'DEX + MIG',
        customizations: ['accurate', 'defenseBoost', 'powerful'],
        element: '',
        id: 'cw_腹砲原子加農'
      }
    ],
    quirk: '超級頭目(據說是)',
    zenit: 70,
    gadgets: { alchemy: 0, infusion: 1, magitech: 0, magitechSpells: [] }
  },
  {
    id: 'bc_zombie_maid', sourcebook: 'bonus', group: null,
    title: '殭屍女僕', en: 'ZOMBIE MAID',
    attributes: { dex: 6, ins: 8, mig: 10, wlp: 8 },
    classes: [
      { className: '守護者', level: 2, skills: [{ name: '雙重盾牌', sl: 1 }, { name: '保護', sl: 1 }] },
      { className: '修補匠', level: 2, skills: [{ name: '小工具', sl: 1 }, { name: '藥水雨', sl: 1 }] },
      { className: '旅人', level: 1, skills: [{ name: '有備無患', sl: 1 }] }
    ],
    equipment: { mainHand: '徒手打擊', offHand: '符文圓盾', armor: '青銅胸甲', accessory: '' },
    quirk: '亡者歸來',
    zenit: 70,
    gadgets: { alchemy: 1, infusion: 0, magitech: 0, magitechSpells: [] }
  },

  // ── 特典合輯：卡牌大師的兩組官方範例（Bonus Collection 印刷 p.11 的 SAMPLE CHARACTERS）──
  //    這兩組是「卡牌大師」唯一出現在官方範例角色的地方；先前的 8 組是 Halloween 系列，
  //    沒有一組用卡牌大師。兩組都**沒有金手指**（範例角色卡沒列這一欄）。
  {
    id: 'bc_collector', sourcebook: 'bonus', group: null,
    title: '收藏家', en: 'COLLECTOR',
    attributes: { dex: 8, ins: 8, mig: 6, wlp: 10 },
    classes: [
      { className: '卡牌大師', level: 3, skills: [{ name: '魔法卡組', sl: 1 }, { name: '陷阱卡', sl: 2 }] },
      { className: '嵌合師', level: 1, skills: [{ name: '咒語模仿', sl: 1 }] },
      { className: '遊蕩者', level: 1, skills: [{ name: '靈魂竊取', sl: 1 }] }
    ],
    equipment: { mainHand: '魔導書', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    zenit: 170
  },
  {
    id: 'bc_trickster', sourcebook: 'bonus', group: null,
    title: '騙徒', en: 'TRICKSTER',
    attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
    classes: [
      { className: '卡牌大師', level: 2, skills: [{ name: '孤注一擲', sl: 1 }, { name: '魔法卡組', sl: 1 }] },
      { className: '熵師', level: 2, skills: [{ name: '熵系魔法', sl: 1, selectedOptions: ['預測'] }, { name: '幸運七', sl: 1 }] },
      { className: '神射手', level: 1, skills: [{ name: '交叉火力', sl: 1 }] }
    ],
    // 官方寫的是「疊牌（自訂武器）」，角色卡裝備欄沒有自訂武器這一格，
      // 所以主手填最接近的基礎投擲武器（《核心規則》的賭徒範例也是「手裡劍，描述成擲牌」），
      // 完整規格留在下面的 customWeapon。
      equipment: { mainHand: '疊牌', offHand: '無盾牌', armor: '賢者長袍', accessory: '' },
    customWeapons: [
      {
        name: '疊牌',
        category: '投擲',
        range: '遠程',
        accuracy: 'DEX + INS',
        customizations: ['accurate', 'magicDefenseBoost', 'powerful'],
        element: '',
        id: 'cw_疊牌'
      }
    ],
    zenit: 70
  },
];
