export const SPECIES_DATA = [
  {
    id: 'sp_beast',
    name: '野獸物種',
    fixedDesc: '',
    mandatorySelections: [],
    optionalDrawback: null,
    benefitsConfig: {
      conditionKey: null,
      maxPicks: 2,
      options: [
        { id: 'b1', text: '最大 HP 增加 10 點。' },
        { id: 'b2', text: '學習一個咒語：舔舐傷口、護罩或戰吼，並將最大 MP 增加 10 點。', needsSelection: true, selectionConfig: { key: 'spell', label: '選擇咒語', type: 'spellbook', options: ['舔舐傷口', '護罩', '戰吼'] } },
        { id: 'b3', text: '在有利於此野獸的身體能力或其自然行為和本能的情況下，對抗檢定獲得 +3 加成。' },
        { id: 'b4', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b5', text: '一個來自你 NPC 定位的額外定位技能。（此技能最多可選2次）', canPickTwice: true }
      ]
    }
  },
  {
    id: 'sp_construct',
    name: '構裝體物種',
    fixedDesc: '添加對土傷害的抗性、對毒傷害的免疫，以及對中毒狀態效果的免疫。',
    mandatorySelections: [],
    optionalDrawback: {
      desc: '你可以給予你的 NPC 一個額外的弱點。如果你這樣做，添加以下一項：',
      selectionConfig: { key: 'sp_construct_extra_vul', label: '額外弱點', type: 'select', options: ['無', '風', '電', '火', '冰'] }
    },
    benefitsConfig: {
      conditionKey: 'sp_construct_extra_vul',
      maxPicks: 1,
      options: [
        { id: 'b1', text: '對兩種你選擇的狀態效果的免疫。', needsSelection: true, selectionConfig: { key: 'sp_construct_imm_status', label: '選擇狀態', type: 'multiselect_2', options: ['眩暈', '動搖', '緩慢', '虛弱', '憤怒'] } },
        {
          id: 'b2',
          text: '在有利於此構造體獨特設計、工具或程式設計【{sp_construct_domain}】的情況下，對抗檢定獲得 +3 加成。',
          needsSelection: true,
          selectionConfig: {
            key: 'sp_construct_domain',
            label: '加成領域',
            type: 'text',
            placeholder: '輸入此構造體獲得加成的領域（例如：破拆作業、水下維護、警衛監控、數據分析）'
          }
        },
        { id: 'b3', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b4', text: '一個來自你 NPC 定位的額外定位技能。' }
      ]
    }
  },
  {
    id: 'sp_demon',
    name: '惡魔物種',
    fixedDesc: '添加對兩種你選擇的傷害類型的抗性。',
    mandatorySelections: [
      { key: 'sp_demon_resists', label: '選擇抗性', type: 'multiselect_2', options: ['風', '電', '暗', '土', '火', '冰', '光', '物理', '毒'] }
    ],
    optionalDrawback: null,
    benefitsConfig: {
      conditionKey: null,
      maxPicks: 1,
      options: [
        { id: 'b1', text: '將一種抗性替換為吸收。', needsSelection: true, selectionConfig: { key: 'sp_demon_abs_choice', label: '選擇吸收', type: 'select', options: ['連結於抗性'] } },
        { id: 'b2', text: '學習一個咒語：吐息、大詛咒、心靈偷取或弱化，並將最大 MP 增加 10 點。', needsSelection: true, selectionConfig: { key: 'spell', label: '選擇咒語', type: 'spellbook', options: ['吐息', '大詛咒', '心靈偷取', '弱化'] } },
        { id: 'b3', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b4', text: '一個來自你 NPC 定位的額外定位技能。' }
      ]
    }
  },
  {
    id: 'sp_element',
    name: '元素物種',
    fixedDesc: '添加對毒傷害的免疫、對另一種你選擇的傷害類型的免疫，以及對中毒狀態效果的免疫。',
    mandatorySelections: [
      { key: 'sp_element_immune', label: '選擇免疫', type: 'select', options: ['風', '電', '暗', '土', '火', '冰', '光'] }
    ],
    optionalDrawback: {
      desc: '你可以給予你的 NPC 一個額外的對與其本性不合的傷害類型的弱點（例：寒冰精靈怕火）。如果你這樣做，添加以下一項：',
      selectionConfig: { key: 'sp_element_extra_vul', label: '額外弱點', type: 'select', options: ['無', '風', '電', '暗', '土', '火', '冰', '光', '物理', '毒'] }
    },
    benefitsConfig: {
      conditionKey: 'sp_element_extra_vul',
      maxPicks: 1,
      options: [
        { id: 'b1', text: '將一種免疫替換為吸收。', needsSelection: true, selectionConfig: { key: 'sp_element_abs_choice', label: '選擇吸收', type: 'select', options: ['毒', '連結於免疫'] } },
        { id: 'b2', text: '學習一個咒語：吐息、詛咒之息或舔舐傷口，並將最大 MP 增加 10 點。', needsSelection: true, selectionConfig: { key: 'spell', label: '選擇咒語', type: 'spellbook', options: ['吐息', '詛咒之息', '舔舐傷口'] } },
        { id: 'b3', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b4', text: '一個來自你 NPC 定位的額外定位技能。' }
      ]
    }
  },
  {
    id: 'sp_humanoid',
    name: '類人物種',
    fixedDesc: '添加一個傷害弱點（物理除外）。',
    mandatorySelections: [
      { key: 'sp_humanoid_weakness', label: '選擇弱點', type: 'select', options: ['暗', '光', '毒'] }
    ],
    optionalDrawback: null,
    benefitsConfig: {
      conditionKey: null,
      maxPicks: 3,
      options: [
        { id: 'b1', text: '對兩種傷害類型（物理除外）的抗性。', needsSelection: true, selectionConfig: { key: 'sp_humanoid_resists', label: '選擇抗性', type: 'multiselect_2', options: ['風', '電', '暗', '土', '火', '冰', '光', '毒'] } },
        { id: 'b2', text: '學習一個咒語：舔舐傷口、護罩或戰吼，並將最大 MP 增加 10 點。', needsSelection: true, selectionConfig: { key: 'spell', label: '選擇咒語', type: 'spellbook', options: ['舔舐傷口', '護罩', '戰吼'] } },
        { id: 'b3', text: '在與【{sp_humanoid_bg}】相關的對抗檢定中獲得 +3 加成。', needsSelection: true, selectionConfig: { key: 'sp_humanoid_bg', label: '領域', type: 'text', placeholder: '輸入背景或訓練領域，例如：皇家守衛、魔法學院' } },
        { id: 'b4', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b5', text: '一個來自你 NPC 定位的額外定位技能。', canPickTwice: true }
      ]
    }
  },
  {
    id: 'sp_monster',
    name: '魔獸物種',
    fixedDesc: '',
    mandatorySelections: [],
    optionalDrawback: null,
    benefitsConfig: {
      conditionKey: null,
      maxPicks: 2,
      options: [
        { id: 'b1', text: '對兩種傷害類型（物理除外）的抗性。', needsSelection: true, selectionConfig: { key: 'sp_monster_resists', label: '選擇抗性', type: 'multiselect_2', options: ['風', '電', '暗', '土', '火', '冰', '光', '毒'] } },
        { id: 'b2', text: '學習一個咒語：吐息、詛咒之息或舔舐傷口，並將最大 MP 增加 10 點。', needsSelection: true, selectionConfig: { key: 'spell', label: '選擇咒語', type: 'spellbook', options: ['吐息', '詛咒之息', '舔舐傷口'] } },
        { id: 'b3', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b4', text: '一個來自你 NPC 定位的額外定位技能。', canPickTwice: true },
        { id: 'b5', text: '最大 HP 增加 10 點。' }
      ]
    }
  },
  {
    id: 'sp_plant',
    name: '植物物種',
    fixedDesc: '添加對眩暈、憤怒和動搖狀態效果的免疫。',
    mandatorySelections: [
      { key: 'sp_plant_weakness', label: '選擇弱點', type: 'select', options: ['風', '電', '火', '冰'] }
    ],
    optionalDrawback: null,
    benefitsConfig: {
      conditionKey: null,
      maxPicks: 1,
      options: [
        { id: 'b1', text: '最大 HP 增加 10 點。' },
        { id: 'b2', text: '對兩種傷害類型（物理除外）的抗性。', needsSelection: true, selectionConfig: { key: 'sp_plant_resists', label: '選擇抗性', type: 'multiselect_2', options: ['風', '電', '暗', '土', '火', '冰', '光', '毒'] } },
        { id: 'b3', text: '學習一個咒語：吐息、詛咒之息、生命偷取或毒藥，並將最大 MP 增加 10 點。', needsSelection: true, selectionConfig: { key: 'spell', label: '選擇咒語', type: 'spellbook', options: ['吐息', '詛咒之息', '生命偷取', '毒藥'] } },
        { id: 'b4', text: '添加特殊規則【荊棘】：當敵人用近戰攻擊命中此 NPC 時，在該攻擊結算後，此 NPC 對該敵人造成 <lv30->5</lv30-><lv30+>10</lv30+> 點物理傷害。' },
        { id: 'b5', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b6', text: '一個來自你 NPC 定位的額外定位技能。' }
      ]
    }
  },
  {
    id: 'sp_undead',
    name: '不死物種',
    fixedDesc: '添加對光傷害的弱點、對暗傷害和毒傷害的免疫，以及對中毒狀態效果的免疫。不死生物會受到恢復 HP 效果的傷害。',
    mandatorySelections: [],
    optionalDrawback: {
      desc: '你可以給予你的 NPC 一個額外的弱點。如果你這樣做，添加以下一項：',
      selectionConfig: { key: 'sp_undead_extra_vul', label: '額外弱點', type: 'select', options: ['無', '風', '電', '土', '火', '冰'] }
    },
    benefitsConfig: {
      conditionKey: 'sp_undead_extra_vul',
      maxPicks: 1,
      options: [
        { id: 'b1', text: '將對暗傷害的免疫替換為對暗傷害的吸收。' },
        { id: 'b2', text: '學習一個咒語：吐息、大詛咒、生命偷取或毒藥，並將最大 MP 增加 10 點。', needsSelection: true, selectionConfig: { key: 'spell', label: '選擇咒語', type: 'spellbook', options: ['吐息', '大詛咒', '生命偷取', '毒藥'] } },
        { id: 'b3', text: '飛行技能。近戰攻擊能以飛行生物為目標。不能被作爲近戰攻擊的目標，除非攻擊者正在飛行或是有能接觸飛行目標的方法。受到弱點傷害時，直到該輪結束都會被迫降落，並失去這個技能的所有收益。PC也可通過花費一個機會來迫使降落。處於危機時，失去這個技能的所有收益。' },
        { id: 'b4', text: '一個來自你 NPC 定位的額外定位技能。' }
      ]
    }
  }
];
