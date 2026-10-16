/**
 * 子項目挑選器專屬資料庫 (skillSuboptionsData.js)
 * 涵蓋維度一中需要進一步挑選子項目的職業特技資料與規則。
 * 包含：
 * 1. 舞者【起舞】：17 種官方舞步（繁中 Excel 定譯）
 * 2. 魔奏者【魔法演奏】：3 音量、8 音調、7 曲風（繁中 Excel 定譯）
 * 3. 靈能者【心靈天賦】：9 種心靈天賦（CHM 與 Excel 定譯，官方英文機制）
 * 4. 突變體【混合變形】：12 種混合形態（繁中 Excel 定譯）
 * 5. 植物學家【植生術】：20 種魔法種子（繁中 Excel 定譯）
 * 6. 徽記師【徽記學】：19 種徽記全庫（繁中 Excel 定譯）
 * 7. 三大法術學派（元素師【元素魔法】、靈師【靈魂魔法】、熵師【熵系魔法】）之子項目配置規則
 */

import rulesData from './rulesData.json';

// ==========================================
// 1. 舞者舞步庫 (17 種)
// ==========================================
export const DANCER_DANCES = [
  {
    id: 'dance_angel',
    name: '天使舞',
    duration: '直到下回合開始',
    effect: '選擇一項：獲得光屬性抗性；或所有攻擊與咒語造成的傷害轉換為光屬性。',
    affinity: '光'
  },
  {
    id: 'dance_banshee',
    name: '女妖嚎',
    duration: '瞬發',
    effect: '選擇另一個可以看見你的生物：若其已有緩慢狀態，立刻獲得動搖狀態。'
  },
  {
    id: 'dance_bat',
    name: '蝠之舞',
    duration: '直到下回合開始',
    effect: '選擇一項：獲得暗屬性抗性；或所有攻擊與咒語造成的傷害轉換為暗屬性。',
    affinity: '暗'
  },
  {
    id: 'dance_golem',
    name: '傀儡戲',
    duration: '直到下回合開始',
    effect: '選擇一項：獲得電屬性抗性；或所有攻擊與咒語造成的傷害轉換為電屬性。',
    affinity: '電'
  },
  {
    id: 'dance_griffin',
    name: '獅鷲形',
    duration: '直到下回合開始',
    effect: '選擇一項：獲得風屬性抗性；或所有攻擊與咒語造成的傷害轉換為風屬性。',
    affinity: '風'
  },
  {
    id: 'dance_hydra',
    name: '九頭蛇',
    duration: '直到下回合開始',
    effect: '當你受到傷害後，選擇一項：恢復 5 點【HP】；或恢復 5 點【MP】。'
  },
  {
    id: 'dance_kraken',
    name: '海怪纏',
    duration: '瞬發',
    effect: '選擇另一個可以看見你的生物：若其已有眩暈狀態，立刻獲得緩慢狀態。'
  },
  {
    id: 'dance_lion',
    name: '獅子吼',
    duration: '瞬發',
    effect: '從你自選的單一異常狀態中恢復。'
  },
  {
    id: 'dance_maenad',
    name: '梅納德',
    duration: '瞬發',
    effect: '選擇另一個可以看見你的生物：其失去等於你目前【DEX】骰面數值的【MP】。'
  },
  {
    id: 'dance_myrmidon',
    name: '米爾頓',
    duration: '直到下回合開始',
    effect: '選擇一項：獲得土屬性抗性；或所有攻擊與咒語造成的傷害轉換為土屬性。',
    affinity: '土'
  },
  {
    id: 'dance_nightmare',
    name: '夢魘麋',
    duration: '瞬發',
    effect: '選擇另一個可以看見你的生物：若其已有動搖狀態，立刻獲得虛弱狀態。'
  },
  {
    id: 'dance_ouroboros',
    name: '銜尾蛇',
    duration: '瞬發',
    effect: '選擇另一個可以看見你、且尚未在本輪行動過的盟友：該盟友可以在你的回合結束後立刻開始其回合。'
  },
  {
    id: 'dance_peacock',
    name: '孔雀舞',
    duration: '瞬發',
    effect: '選擇另一個可以看見你的生物：該生物在此場景下次進行攻擊或攻擊性咒語時，必須盡可能將你選為目標之一。'
  },
  {
    id: 'dance_phoenix',
    name: '鳳凰',
    duration: '直到下回合開始',
    effect: '選擇一項：獲得火屬性抗性；或所有攻擊與咒語造成的傷害轉換為火屬性。',
    affinity: '火'
  },
  {
    id: 'dance_satyr',
    name: '薩特欲',
    duration: '瞬發',
    effect: '選擇另一個可以看見你的生物：若其已有虛弱狀態，立刻獲得眩暈狀態。'
  },
  {
    id: 'dance_unicorn',
    name: '獨角獸',
    duration: '瞬發',
    effect: '選擇一個能看見你且對你抱有羈絆的盟友：你與該盟友均恢復等於你目前【DEX】骰面數值的【HP】（20級+5，40級+10）。'
  },
  {
    id: 'dance_yeti',
    name: '雪怪足',
    duration: '直到下回合開始',
    effect: '選擇一項：獲得冰屬性抗性；或所有攻擊與咒語造成的傷害轉換為冰屬性。',
    affinity: '冰'
  }
];

// ==========================================
// 2. 魔奏者體系 (音量、音調、曲風)
// ==========================================
export const CHANTER_DATA = {
  volumes: [
    {
      id: 'vol_low',
      name: '低音',
      mp: 10,
      target: '自己或一個能聽到你的生物',
      desc: '花費 10 點【MP】，目標為自己或一名可見且可聽見你的生物。'
    },
    {
      id: 'vol_med',
      name: '中音',
      mp: 20,
      target: '所有能聽到你的盟友',
      desc: '花費 20 點【MP】，目標為所有能聽見你的盟友。'
    },
    {
      id: 'vol_high',
      name: '高音',
      mp: 30,
      target: '所有能聽到你的敵人',
      desc: '花費 30 點【MP】，目標為所有能聽見你的敵人。'
    }
  ],
  keys: [
    {
      id: 'key_blazing',
      name: '熾熱',
      damageType: '火',
      status: '動搖',
      attribute: 'MIG',
      recovery: 'HP',
      desc: '傷害【火】，狀態【動搖】，屬性【MIG】，恢復【HP】。'
    },
    {
      id: 'key_frost',
      name: '霜凍',
      damageType: '冰',
      status: '虛弱',
      attribute: 'WLP',
      recovery: 'MP',
      desc: '傷害【冰】，狀態【虛弱】，屬性【WLP】，恢復【MP】。'
    },
    {
      id: 'key_steel',
      name: '鋼鐵',
      damageType: '物理',
      status: '緩慢',
      attribute: 'WLP',
      recovery: 'MP',
      desc: '傷害【物理】，狀態【緩慢】，屬性【WLP】，恢復【MP】。'
    },
    {
      id: 'key_radiance',
      name: '輝光',
      damageType: '光',
      status: '眩暈',
      attribute: 'INS',
      recovery: 'HP',
      desc: '傷害【光】，狀態【眩暈】，屬性【INS】，恢復【HP】。'
    },
    {
      id: 'key_shadow',
      name: '暗影',
      damageType: '暗',
      status: '虛弱',
      attribute: 'DEX',
      recovery: 'MP',
      desc: '傷害【暗】，狀態【虛弱】，屬性【DEX】，恢復【MP】。'
    },
    {
      id: 'key_stone',
      name: '堅石',
      damageType: '土',
      status: '眩暈',
      attribute: 'MIG',
      recovery: 'HP',
      desc: '傷害【土】，狀態【眩暈】，屬性【MIG】，恢復【HP】。'
    },
    {
      id: 'key_thunder',
      name: '閃雷',
      damageType: '電',
      status: '動搖',
      attribute: 'DEX',
      recovery: 'HP',
      desc: '傷害【電】，狀態【動搖】，屬性【DEX】，恢復【HP】。'
    },
    {
      id: 'key_gale',
      name: '疾風',
      damageType: '風',
      status: '緩慢',
      attribute: 'INS',
      recovery: 'MP',
      desc: '傷害【風】，狀態【緩慢】，屬性【INS】，恢復【MP】。'
    }
  ],
  tones: [
    {
      id: 'tone_calm',
      name: '冷靜',
      effect: '所有目標恢復等於【10 + 2 × 目前 WLP 骰面】點的【音調恢復值】（20級+10，40級+20）。若用來恢復 MP，則對演奏者自身無效。'
    },
    {
      id: 'tone_passion',
      name: '激情',
      effect: '直到下回合開始，當目標成功通過包含【音調屬性】的檢定且推進或迴轉命刻時，可額外推進或迴轉 1 個刻度。'
    },
    {
      id: 'tone_frenzy',
      name: '瘋狂',
      effect: '每個目標受到等於【2 × 目前 WLP 骰面】點的【音調傷害】（20級+5，40級+10）。'
    },
    {
      id: 'tone_haunting',
      name: '縈繞',
      effect: '每個目標遭受【音調狀態】。此外，每個目標失去對【音調傷害】的抗性，直到下回合開始。'
    },
    {
      id: 'tone_vivid',
      name: '生動',
      effect: '每個目標的【音調屬性】骰尺寸增加一階（最高 d12），直到下回合開始。'
    },
    {
      id: 'tone_surging',
      name: '洶湧',
      effect: '直到下回合開始，每個目標在首次受到傷害時，該傷害被轉換為【音調傷害】。'
    },
    {
      id: 'tone_solemn',
      name: '莊嚴',
      effect: '每個目標從【音調狀態】中恢復。此外，每個目標獲得對【音調傷害】的抗性，直到下回合開始。'
    }
  ]
};

// ==========================================
// 3. 靈能者心靈天賦庫 (9 種)
// ==========================================
export const ESPER_GIFTS = [
  {
    id: 'gift_atmokinesis',
    name: '動能掌控',
    event: '當你造成傷害時',
    effect: '這次傷害類型變為風或電屬性，並造成等同於【2 + 目前靈刻已填刻度】點的額外傷害。',
    affinities: ['風', '電']
  },
  {
    id: 'gift_clairvoyance',
    name: '神視',
    event: '當 NPC 成為焦點或對其建立羈絆時',
    effect: '向主持人詢問關於該 NPC 的一個問題，主持人必須如實回答。每名 NPC 限一次。'
  },
  {
    id: 'gift_life_transference',
    name: '生命轉移',
    event: '當你使一個或多個敵人失去 HP 時',
    effect: '選擇自身或一名處於焦點的盟友：若處於危機狀態，該生物恢復等同於【5 + 5 × 目前靈刻已填刻度】點【HP】。'
  },
  {
    id: 'gift_gravitokinesis',
    name: '引力掌握',
    event: '當你造成傷害時',
    effect: '這次傷害類型變為土或物理屬性，並造成等同於【2 + 目前靈刻已填刻度】點的額外傷害；若命中飛行生物，迫使其立即著陸。',
    affinities: ['土', '物理']
  },
  {
    id: 'gift_photokinesis',
    name: '光能掌握',
    event: '當你造成傷害時',
    effect: '這次傷害類型變為光或暗屬性，並造成等同於【2 + 目前靈刻已填刻度】點的額外傷害。',
    affinities: ['光', '暗']
  },
  {
    id: 'gift_psychic_backlash',
    name: '精神反衝',
    event: '當敵人在對抗檢定中勝過你或使你失去 HP 時',
    effect: '該敵人失去等同於【5 + 目前靈刻已填刻度】點【MP】。然後二選一：使其陷入眩暈，或使其陷入動搖。'
  },
  {
    id: 'gift_psychic_shield',
    name: '心靈護盾',
    event: '當可見敵人進行攻擊或攻擊性咒語時',
    effect: '你的防禦與魔防視為等同於【目前 WLP 骰面 + 2 × 目前靈刻已填刻度】。'
  },
  {
    id: 'gift_reassuring_presence',
    name: '安心',
    event: '當你執行防禦動作掩護一名盟友後',
    effect: '該盟友恢復等同於【10 + 5 × 目前靈刻已填刻度】點【MP】；若該盟友為焦點，從眩暈、憤怒、動搖中自選一項狀態解除。'
  },
  {
    id: 'gift_thermokinesis',
    name: '内能掌握',
    event: '當你造成傷害時',
    effect: '這次傷害類型變為火或冰屬性，並造成等同於【2 + 目前靈刻已填刻度】點的額外傷害。',
    affinities: ['火', '冰']
  }
];

// ==========================================
// 4. 突變體混合形態庫 (12 種)
// ==========================================
export const MUTANT_THERIOFORMS = [
  {
    id: 'form_amphibia',
    name: '兩棲形態',
    examples: '青蛙、蠑螈、水生怪獸',
    effect: '獲得水下呼吸與微光視覺。每當你恢復 HP 時額外恢復 5 點，並立即解除自選的一種異常狀態。'
  },
  {
    id: 'form_arpaktida',
    name: '追獵形態',
    examples: '狼、猛禽、敏銳感官生物',
    effect: '【INS】骰面視為提升一階（最高 d12）。每回合首次造成傷害時，若目標中有人處於危機，對其額外造成 5 點傷害。'
  },
  {
    id: 'form_dynamotheria',
    name: '腕力形態',
    examples: '熊、恐龍、巨力生物',
    effect: '【MIG】骰面視為提升一階（最高 d12）。推進或回撥包含體質的命刻檢定成功時，額外推進或回撥 1 格。'
  },
  {
    id: 'form_electrophora',
    name: '放電形態',
    examples: '放電生物、雷元素、機械',
    effect: '攻擊或咒語傷害可轉為電屬性。徒手攻擊造成電傷害使目標損失 20 點以上 HP 時，目標陷入緩慢狀態。',
    affinity: '電'
  },
  {
    id: 'form_neurophagoida',
    name: '神經吞噬形態',
    examples: '寄生蟲、不死生物、靈魂吞噬者',
    effect: '使用【吞噬】技能時，額外恢復等同於【4 + 混合變形 SL】點【MP】。'
  },
  {
    id: 'form_placophora',
    name: '疊甲形態',
    examples: '甲殼類、陸龜、重裝生物',
    effect: '防禦視為等於【13 + 混合變形 SL 的一半】（若原本防禦較高仍可採用）。'
  },
  {
    id: 'form_pneumophora',
    name: '噴射形態',
    examples: '噴氣軟體動物、飛翼獸、火箭',
    effect: '攻擊或咒語傷害可轉為風屬性。徒手攻擊造成風傷害使目標損失 20 點以上 HP 時，目標陷入虛弱狀態。',
    affinity: '風'
  },
  {
    id: 'form_polypoda',
    name: '多足形態',
    examples: '烏賊、章魚、藤蔓卷鬚生物',
    effect: '徒手攻擊獲得多重(3)。'
  },
  {
    id: 'form_pterotheria',
    name: '飛翼形態',
    examples: '蝙蝠、飛鳥、有翼昆蟲',
    effect: '獲得飛行能力，近戰可攻擊飛行目標，且不受地面近戰攻擊瞄準（受到風、電、冰傷害時暫時失效直到下回合開始）。'
  },
  {
    id: 'form_pyrophora',
    name: '爆燃形態',
    examples: '射砲甲蟲、槍蝦、火元素',
    effect: '攻擊或咒語傷害可轉為火屬性。徒手攻擊造成火傷害使目標損失 20 點以上 HP 時，目標陷入眩暈狀態。',
    affinity: '火'
  },
  {
    id: 'form_tachytheria',
    name: '靈巧形態',
    examples: '獵豹、羚羊、迅敏野兔',
    effect: '【DEX】骰面視為提升一階（最高 d12）。推進或回撥包含靈巧的命刻檢定成功時，額外推進或回撥 1 格。'
  },
  {
    id: 'form_toxicophora',
    name: '毒物形態',
    examples: '蜘蛛、毒蛇、毒性史萊姆',
    effect: '攻擊或咒語傷害可轉為毒屬性。徒手攻擊造成毒傷害使目標損失 20 點以上 HP 時，目標陷入中毒狀態。',
    affinity: '毒'
  }
];

// ==========================================
// 5. 植物學家魔法種子庫 (20 種)
// ==========================================
export const FLORIST_MAGISEEDS = [
  {
    id: 'seed_arctic_narcissus',
    name: '極地水仙',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身對土屬性與冰屬性傷害具有抗性。' },
      { clock: '第 2~3 回合（生長命刻 2~3 格）', text: '自身與場景中可見的盟友對土屬性與冰屬性傷害具有抗性。' }
    ],
    affinities: ['土', '冰']
  },
  {
    id: 'seed_blazing_chrysanthemum',
    name: '熾焰菊',
    duration: '至多 4 回合',
    effects: [
      {
        clock: '第 1~3 回合（生長命刻 1~3 格）',
        text: '回合結束選擇土或火：直到再次使用或離園，自身與全隊傷害轉化為該屬性，無法改變且無視抗性。'
      }
    ],
    affinities: ['土', '火']
  },
  {
    id: 'seed_desert_dahlia',
    name: '沙漠大麗花',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身對風屬性與火屬性傷害具有抗性。' },
      { clock: '第 2~3 回合（生長命刻 2~3 格）', text: '自身與場景中可見的盟友對風屬性與火屬性傷害具有抗性。' }
    ],
    affinities: ['風', '火']
  },
  {
    id: 'seed_golden_ginkgo',
    name: '黃金銀杏',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合結束（生長命刻 1 格）', text: '回合結束時，自身與場景中可見的每個盟友解除眩暈、憤怒與動搖狀態。' },
      { clock: '第 2~3 回合結束（生長命刻 2~3 格）', text: '回合結束時，自身與場景中可見的每個盟友恢復等同於【5 + 植生術 SL】點【MP】。' }
    ]
  },
  {
    id: 'seed_grave_asphodel',
    name: '墓地阿福花',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合結束（生長命刻 1 格）', text: '回合結束可選一名可見敵人：使其陷入動搖狀態。' },
      { clock: '第 2 回合結束（生長命刻 2 格）', text: '回合結束時，場景中可見的每個敵人都陷入動搖狀態。' },
      { clock: '第 3 回合結束（生長命刻 3 格）', text: '回合結束對場景中可見的每個處於動搖狀態的敵人造成等同於【15 + 植生術 SL】點暗屬性傷害。' }
    ],
    affinities: ['暗']
  },
  {
    id: 'seed_hermit_iris',
    name: '隱士鳶尾',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合結束（生長命刻 1 格）', text: '回合結束選擇一名可見敵人：主持人揭露其等級、位階、物種、最大HP/MP、特質、屬性、物防與魔防。' },
      { clock: '第 2~3 回合結束（生長命刻 2~3 格）', text: '回合結束選擇一名可見敵人：揭露上述全部數值，並額外揭露其全部屬性相性。' }
    ]
  },
  {
    id: 'seed_hookleaf_nightshade',
    name: '鉤葉顛茄',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身造成的所有傷害轉為毒屬性，無法改變且無視免疫與抗性。' },
      {
        clock: '第 2~3 回合（生長命刻 2~3 格）',
        text: '自身所有傷害轉為毒屬性無視免疫抗性。回合首次造成毒傷時額外造成【植生術 SL】傷害，且目標陷入中毒。'
      }
    ],
    affinities: ['毒']
  },
  {
    id: 'seed_horned_hawthorn',
    name: '角狀山楂',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身對暗屬性與毒屬性傷害具有抗性。' },
      { clock: '第 2~3 回合（生長命刻 2~3 格）', text: '自身與場景中可見的盟友對暗屬性與毒屬性傷害具有抗性。' }
    ],
    affinities: ['暗', '毒']
  },
  {
    id: 'seed_lunar_magnolia',
    name: '月光玉蘭',
    duration: '至多 4 回合',
    effects: [
      {
        clock: '第 1~3 回合（生長命刻 1~3 格）',
        text: '回合結束選擇冰或光：直到再次使用或離園，自身與全隊傷害轉化為該屬性，無法改變且無視抗性。'
      }
    ],
    affinities: ['冰', '光']
  },
  {
    id: 'seed_ocean_lotus',
    name: '海洋蓮花',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身免疫眩暈與緩慢狀態。' },
      { clock: '第 2 回合（生長命刻 2 格）', text: '自身將【DEX】與【INS】骰面視為提高一階（最高 d12）。' },
      { clock: '第 3 回合（生長命刻 3 格）', text: '自身與場景中可見的每個盟友將【DEX】與【INS】骰面視為提高一階（最高 d12）。' }
    ]
  },
  {
    id: 'seed_pilgrim_gazalia',
    name: '朝聖者羚羊花',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1~2 回合結束（生長命刻 1~2 格）', text: '回合結束選擇自己或另一名可見的玩家角色：恢復 2 點【IP】。' },
      { clock: '第 3 回合結束（生長命刻 3 格）', text: '回合結束時，自身與場景中可見的每個其他玩家角色恢復 1 點【IP】。' }
    ]
  },
  {
    id: 'seed_prancing_dandelion',
    name: '蒲公英之舞',
    duration: '至多 4 回合',
    effects: [
      {
        clock: '第 1~3 回合（生長命刻 1~3 格）',
        text: '回合結束選擇風或電：直到再次使用或離園，自身與全隊傷害轉化為該屬性，無法改變且無視抗性。'
      }
    ],
    affinities: ['風', '電']
  },
  {
    id: 'seed_regal_protea',
    name: '王者帝王花',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身免疫動搖與虛弱狀態。' },
      { clock: '第 2 回合（生長命刻 2 格）', text: '自身將【MIG】與【WLP】骰面視為提高一階（最高 d12）。' },
      { clock: '第 3 回合（生長命刻 3 格）', text: '自身與場景中可見的每個盟友將【MIG】與【WLP】骰面視為提高一階（最高 d12）。' }
    ]
  },
  {
    id: 'seed_remedy_lily',
    name: '治療百合',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合結束（生長命刻 1 格）', text: '回合結束時，自身與場景中可見的每個盟友解除中毒、緩慢與虛弱狀態。' },
      { clock: '第 2~3 回合結束（生長命刻 2~3 格）', text: '回合結束時，自身與場景中可見的每個盟友恢復等同於【15 + 植生術 SL】點【HP】。' }
    ]
  },
  {
    id: 'seed_serrated_rose',
    name: '鋸齒玫瑰',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合結束（生長命刻 1 格）', text: '回合結束可選一名可見敵人：使其陷入緩慢狀態。' },
      { clock: '第 2 回合結束（生長命刻 2 格）', text: '回合結束時，場景中可見的每個敵人都陷入緩慢狀態。' },
      { clock: '第 3 回合結束（生長命刻 3 格）', text: '回合結束對場景中可見的每個處於緩慢狀態的敵人造成等同於【15 + 植生術 SL】點物理傷害。' }
    ],
    affinities: ['物理']
  },
  {
    id: 'seed_silver_strelitzia',
    name: '銀色天堂鳥',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身對電屬性與光屬性傷害具有抗性。' },
      { clock: '第 2~3 回合（生長命刻 2~3 格）', text: '自身與場景中可見的盟友對電屬性與光屬性傷害具有抗性。' }
    ],
    affinities: ['電', '光']
  },
  {
    id: 'seed_star_peony',
    name: '星辰牡丹',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合結束（生長命刻 1 格）', text: '回合結束可選一名可見敵人：使其陷入眩暈狀態。' },
      { clock: '第 2 回合結束（生長命刻 2 格）', text: '回合結束時，場景中可見的每個敵人都陷入眩暈狀態。' },
      { clock: '第 3 回合結束（生長命刻 3 格）', text: '回合結束對場景中可見的每個處於眩暈狀態的敵人造成等同於【15 + 植生術 SL】點光屬性傷害。' }
    ],
    affinities: ['光']
  },
  {
    id: 'seed_striped_orchid',
    name: '條紋蘭',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合結束（生長命刻 1 格）', text: '回合結束可選一名可見敵人：使其陷入虛弱狀態。' },
      { clock: '第 2 回合結束（生長命刻 2 格）', text: '回合結束時，場景中可見的每個敵人都陷入虛弱狀態。' },
      { clock: '第 3 回合結束（生長命刻 3 格）', text: '回合結束對場景中可見的每個處於虛弱狀態的敵人造成等同於【15 + 植生術 SL】點毒屬性傷害。' }
    ],
    affinities: ['毒']
  },
  {
    id: 'seed_wardwattle',
    name: '守衛肉垂',
    duration: '至多 4 回合',
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '自身獲得物理抗性。' },
      { clock: '第 2 回合（生長命刻 2 格）', text: '自身具物理抗性。被近戰命中後，對攻擊者反彈【5 + 植生術 SL】點物理傷害。' },
      { clock: '第 3 回合（生長命刻 3 格）', text: '自身具物理抗性。被近戰命中後，反彈【5 + 植生術 SL】物理傷害並追加【5 + 植生術 SL】毒傷害。' }
    ],
    affinities: ['物理', '毒']
  },
  {
    id: 'seed_wrathful_carnation',
    name: '憤怒康乃馨',
    duration: '至多 4 回合',
    effects: [
      {
        clock: '滿 4 格離園時（第 4 回合結束或主動離園）',
        text: '選至多一名可見敵人：直到下回合結束，其進行攻擊或施展攻擊性咒語時必須盡可能將你納入目標。回合結束可主動移出花園並清除生長命刻。'
      }
    ]
  }
];

// ==========================================
// 6. 徽記師徽記庫 (19 種全庫)
// ==========================================
export const SYMBOLIST_SYMBOLS = [
  {
    id: 'sym_binding',
    name: '束縛徽記',
    effect: '攜帶者的目前屬性骰尺寸永遠不會超過其基礎骰尺寸（無效提高骰尺寸效果）。'
  },
  {
    id: 'sym_creation',
    name: '制物徽記',
    effect: '攜帶者在衝突中需要消耗【IP】時，可改為摧毀此徽記而不消耗任何【IP】。'
  },
  {
    id: 'sym_despair',
    name: '絕望徽記',
    effect: '攜帶者在衝突中恢復【HP】或【MP】時，只能恢復原本一半的數值。'
  },
  {
    id: 'sym_destiny',
    name: '命運徽記',
    effect: '攜帶者檢定後，若可見該生物，可消耗 1 點物語點強迫其重骰兩顆骰子（非大成功或大失敗時）。'
  },
  {
    id: 'sym_elements',
    name: '元素徽記',
    effect: '創造時自選八大傷害屬性之一。攜帶者造成傷害時，可消耗三分之一總傷害點數（含任何額外傷害來源）的【MP】將其全數轉為所選屬性。'
  },
  {
    id: 'sym_enmity',
    name: '憎惡徽記',
    effect: '只要攜帶者處於危機狀態，任何能看到他的敵人都必須盡可能將其選為攻擊或攻擊性咒語的目標。'
  },
  {
    id: 'sym_flux',
    name: '融焊徽記',
    effect: '創造時自選一項異常狀態。二選一：攜帶者獲得對該狀態的免疫；或失去對該狀態的免疫且無法重新獲得。'
  },
  {
    id: 'sym_forbiddance',
    name: '禁止徽記',
    effect: '創造時自選動作類別。攜帶者執行所選動作前，失去 5 點【HP】與 5 點【MP】（20級10點，40級20點）。'
  },
  {
    id: 'sym_growth',
    name: '成長徽記',
    effect: '攜帶者施展目標為「至多三個生物」的咒語時，提升為「至多四個生物」（需支付額外 MP）。'
  },
  {
    id: 'sym_metamorphosis',
    name: '變形徽記',
    effect: '創造時自選物種。攜帶者在特技與效果判定上被視為所選物種（不可施加在玩家角色上）。'
  },
  {
    id: 'sym_prosperity',
    name: '繁榮徽記',
    effect: '攜帶者消耗 1 點物語點觸發背景或羈絆時，額外獲得 100 z。'
  },
  {
    id: 'sym_protection',
    name: '防護徽記',
    effect: '創造時自選八大傷害屬性之一。攜帶者獲得對該屬性傷害的抗性。'
  },
  {
    id: 'sym_rebellion',
    name: '反抗徽記',
    effect: '若場景中存在反派，攜帶者進行對抗檢定時，雙骰出目相同且非大失敗即觸發大成功。'
  },
  {
    id: 'sym_rebirth',
    name: '重生徽記',
    effect: '攜帶者生命值即將被削減至 0 點時，可摧毀該徽記，改為削減至 1 點【HP】。'
  },
  {
    id: 'sym_retaliation',
    name: '復仇徽記',
    effect: '處於危機的生物若以攻擊或攻擊性咒語命中攜帶者，該攻擊者恢復 5 點【HP】與 5 點【MP】。'
  },
  {
    id: 'sym_sacrifice',
    name: '犧牲徽記',
    effect: '攜帶者受到傷害時，若你能看到他，可摧毀此徽記並代替他承受等額傷害。'
  },
  {
    id: 'sym_sorcery',
    name: '巫術徽記',
    effect: '以攜帶者為目標的咒語，總【MP】消耗減少 5 點（不低於 5 點）。若同時選取多名攜帶者可疊加。'
  },
  {
    id: 'sym_truth',
    name: '真理徽記',
    effect: '對攜帶者進行研究調查、以及以攜帶者為目標的命中與施法檢定均獲得 +2 加值。'
  },
  {
    id: 'sym_weakness',
    name: '弱點徽記',
    effect: '創造時自選八大傷害屬性之一。攜帶者受到該屬性傷害時，承受額外 5 點傷害。'
  }
];

// ==========================================
// 7. 子項目職業技能配置定義表
// ==========================================
export const SUBOPTION_SKILLS_CONFIG = {
  '元素師': {
    '元素魔法': {
      type: 'spells',
      school: '元素',
      itemTypeTitle: '元素咒語',
      maxFormula: (sl) => sl,
      quotaHint: (sl) => `可掌握 ${sl} 個元素咒語`
    }
  },
  '靈師': {
    '靈魂魔法': {
      type: 'spells',
      school: '靈魂',
      itemTypeTitle: '靈魂咒語',
      maxFormula: (sl) => sl,
      quotaHint: (sl) => `可掌握 ${sl} 個靈魂咒語`
    }
  },
  '熵師': {
    '熵系魔法': {
      type: 'spells',
      school: '熵系',
      itemTypeTitle: '熵系咒語',
      maxFormula: (sl) => sl,
      quotaHint: (sl) => `可掌握 ${sl} 個熵系咒語`
    }
  },
  '舞者': {
    '起舞': {
      type: 'dances',
      itemTypeTitle: '舞步',
      maxFormula: (sl) => sl,
      quotaHint: (sl) => `可掌握 ${sl} 個舞步`,
      data: DANCER_DANCES
    }
  },
  '魔奏者': {
    '魔法演奏': {
      type: 'chanter',
      itemTypeTitle: '音調與曲風',
      // 開局 SL 1 習得全部 3 種音量、1 音調、1 曲風 (共 2 選項)；之後每升 1 級可多選 1 音調或 1 曲風
      maxFormula: (sl) => (sl > 0 ? sl + 1 : 0),
      quotaHint: (sl) => `可掌握 ${sl + 1} 個音調與曲風（至少各選 1 項）`,
      data: CHANTER_DATA
    }
  },
  '靈能者': {
    '心靈天賦': {
      type: 'esper_gifts',
      itemTypeTitle: '心靈天賦',
      maxFormula: (sl) => sl,
      quotaHint: (sl) => `可掌握 ${sl} 個心靈天賦`,
      data: ESPER_GIFTS
    }
  },
  '突變體': {
    '混合變形': {
      type: 'mutant_forms',
      itemTypeTitle: '混合形態',
      maxFormula: (sl) => sl,
      quotaHint: (sl) => `可掌握 ${sl} 個混合形態`,
      data: MUTANT_THERIOFORMS
    }
  },
  '植物學家': {
    '植生術': {
      type: 'florist_seeds',
      itemTypeTitle: '魔法種子',
      maxFormula: (sl) => sl,
      quotaHint: (sl) => `可掌握 ${sl} 種魔法種子`,
      data: FLORIST_MAGISEEDS
    }
  },
  '徽記師': {
    '徽記學': {
      type: 'symbols',
      itemTypeTitle: '徽記',
      maxFormula: (sl) => sl * 2,
      quotaHint: (sl) => `可掌握 ${sl * 2} 個徽記（同時維持上限 ${sl + 1} 個）`,
      data: SYMBOLIST_SYMBOLS
    }
  }
};

/**
 * 檢查特技是否擁有子項目挑選配置
 */
export function getSkillSuboptionConfig(className, skillName) {
  return SUBOPTION_SKILLS_CONFIG[className]?.[skillName] || null;
}

/**
 * 計算當前 SL 下子項目的最大允許數量
 */
export function calculateSkillSuboptionMax(className, skillName, sl) {
  const config = getSkillSuboptionConfig(className, skillName);
  if (!config) return 0;
  return config.maxFormula ? config.maxFormula(sl) : sl;
}

// ═══════════════════════════════════════════════════════════
// 植物學家魔法種子：生長命刻 → 生效階級（唯一來源）
// ═══════════════════════════════════════════════════════════

/**
 * 生長命刻的總格數。官方 4 格，見 `ruleCodexExpansion.js` 的「生長命刻」節。
 * 抽出來是為了讓 UI（建角預覽、跑團盤）不必各自寫死一個 4。
 */
export const GROWTH_CLOCK_MAX = 4;

// 標籤裡的區間寫法：'生長命刻 0~1 格'、'生長命刻 2~3 格'、'生長命刻 1~3 格'、'生長命刻 1~2 格'。
// 連字號容忍全形與各種 dash，因為速查表用的是 en-dash（'0–1'）。
const CLOCK_RANGE_RE = /(\d+)\s*[~～–—-]\s*(\d+)\s*格/;
// 單一值寫法：'生長命刻 1 格'、'生長命刻 3 格'，以及不帶「生長命刻」四字的 '滿 4 格離園時（…）'。
const CLOCK_SINGLE_RE = /(\d+)\s*格/;

/**
 * 從一列魔法種子效果的文字標籤，取出它生效的生長命刻區間。
 *
 * 為什麼需要這支：官方資料的標籤寫法**不統一**（實測 43 列有 5 種格式）。
 * 舊版 `FloristGardenTracker` 用 `clock.includes('0~1')` / `includes('3 格')` 之類的
 * 字串猜測來判斷「哪一階生效」，於是
 *   '…（生長命刻 1~3 格）'（熾焰菊／月光玉蘭／蒲公英之舞）與 '…（生長命刻 1~2 格）'（朝聖者羚羊花）
 * 都被誤判成 2~3 格 → **T = 1 時那一列不會亮**，玩家會以為該格數沒有效果。
 * 改成解析數字之後，「哪一階生效」只有這一個來源，UI 兩邊（建角／跑團）不會再各猜一套。
 *
 * 實測涵蓋的格式：
 *   '第 1 回合（生長命刻 0~1 格）'          → { min: 0, max: 1 }
 *   '第 2~3 回合（生長命刻 2~3 格）'        → { min: 2, max: 3 }
 *   '第 1~3 回合（生長命刻 1~3 格）'        → { min: 1, max: 3 }
 *   '第 3 回合結束（生長命刻 3 格）'        → { min: 3, max: 3 }
 *   '滿 4 格離園時（第 4 回合結束…）'   → { min: 4, max: 4 }
 *
 * @returns {{min:number,max:number}|null} 解析不出來時回 null（由護欄擋住，不會靜默放行）
 */
export function getSeedClockRange(clockLabel) {
  const text = String(clockLabel ?? '');
  const range = CLOCK_RANGE_RE.exec(text);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = CLOCK_SINGLE_RE.exec(text);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return null;
}

/**
 * 指定的生長命刻格數下，這一列種子效果是否生效。
 *
 * 官方鐵則（`ruleCodexExpansion.js` 的「魔法種子效果」節）：
 * **只套用與當前填充格數「完全相同」的那一條，不是以上或以下。**
 */
export function isSeedEffectActiveAt(clockLabel, clock) {
  const range = getSeedClockRange(clockLabel);
  if (!range) return false;
  const t = Number(clock);
  if (!Number.isFinite(t)) return false;
  return t >= range.min && t <= range.max;
}

/**
 * 依據職業、技能與項目名稱獲取子項目的詳細效果資料
 */
export function getSuboptionDetails(className, skillName, rawItemName) {
  if (!className || !skillName || !rawItemName) return null;
  const config = getSkillSuboptionConfig(className, skillName);
  if (!config) return null;

  // 清理前綴，如 "音調: 熾熱" -> "熾熱", "曲風: 瘋狂" -> "瘋狂"
  const cleanName = String(rawItemName).replace(/^(音調|曲風)[:：]\s*/, '').trim();

  // 1. 三大法術學派咒語
  if (config.type === 'spells') {
    const spell = (rulesData.spells || []).find(
      s => s.name === cleanName && (!config.school || s.school === config.school)
    );
    if (spell) {
      return {
        id: spell.name,
        name: spell.name,
        school: spell.school,
        mp: spell.mp,
        target: spell.target,
        duration: spell.duration,
        isOffensive: spell.isOffensive,
        effect: spell.effect,
        damageType: spell.damageType
      };
    }
  }

  // 2. 魔奏者（包含音量、音調、曲風）
  if (config.type === 'chanter') {
    // 檢查是否為音量
    const vol = (config.data?.volumes || []).find(v => v.name === cleanName || v.id === cleanName);
    if (vol) return { ...vol, itemType: 'volume', typeLabel: '音量' };

    // 檢查是否為音調
    const key = (config.data?.keys || []).find(k => k.name === cleanName || k.id === cleanName);
    if (key) return { ...key, itemType: 'key', typeLabel: '音調' };

    // 檢查是否為曲風
    const tone = (config.data?.tones || []).find(t => t.name === cleanName || t.id === cleanName);
    if (tone) return { ...tone, itemType: 'tone', typeLabel: '曲風' };
  }

  // 3. 一般陣列資料（舞步、心靈天賦、突變形態、魔法種子、徽記）
  if (Array.isArray(config.data)) {
    const item = config.data.find(d => d.name === cleanName || d.id === cleanName);
    if (item) return item;
  }

  return {
    name: cleanName,
    effect: '暫無該子項目的詳細效果數據'
  };
}

/**
 * 魔奏者歌曲即時動態合成器
 * 組合 [音量] + [音調] + [曲風]，動態替換曲風中的四維變量
 */
export function composeChanterSong(volumeIdOrName, keyName, toneName) {
  const volumes = CHANTER_DATA.volumes || [];
  const keys = CHANTER_DATA.keys || [];
  const tones = CHANTER_DATA.tones || [];

  const vol = volumes.find(v => v.id === volumeIdOrName || v.name === volumeIdOrName) || volumes[0];
  const key = keys.find(k => k.name === keyName || k.id === keyName) || keys[0];
  const tone = tones.find(t => t.name === toneName || t.id === toneName) || tones[0];

  if (!vol || !key || !tone) return null;

  // 動態置換曲風效果中的變量
  // 1. 【音調傷害】 -> 【{damageType}】屬性傷害
  // 2. 【音調狀態】 -> 【{status}】狀態
  // 3. 【音調屬性】 -> 【{attribute}】
  // 4. 【音調恢復值】 -> 【{recovery}】
  let dynamicEffect = tone.effect || '';
  dynamicEffect = dynamicEffect.replace(/【音調傷害】/g, `【${key.damageType}】屬性傷害`);
  dynamicEffect = dynamicEffect.replace(/【音調狀態】/g, `【${key.status}】狀態`);
  dynamicEffect = dynamicEffect.replace(/【音調屬性】/g, `【${key.attribute}】`);
  dynamicEffect = dynamicEffect.replace(/【音調恢復值】/g, `【${key.recovery}】`);

  const songTitle = `【${vol.name}・${key.name}調・${tone.name}曲】`;

  return {
    songTitle,
    volume: vol,
    key,
    tone,
    mp: vol.mp,
    target: vol.target,
    composedEffect: dynamicEffect
  };
}

