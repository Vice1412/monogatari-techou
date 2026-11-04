/**
 * 效果流程資料規格表（Flow Data Specs）—— 唯一事實來源。
 * 定義需要額外名冊、選單、自訂文字或結算時機的條目資料結構。
 */

export const FLOW_DATA_SPECS = Object.freeze({
  'quirk:富家子弟': {
    title: '保鑣',
    source: 'Bonus Collection p.20',
    // A 名冊型：原文「給他們一個名字，描述一下他們的外表」
    records: {
      label: '保鑣',
      min: 2,
      max: 2,
      fields: [
        { key: 'name', label: '名字', required: true, maxLength: 24 },
        { key: 'look', label: '外表', required: true, multiline: true, maxLength: 120 }
      ]
    },
    // B 增益選單型：原文三個增益
    buffs: [
      { id: 'careful', label: '小心！', describe: '受到傷害時減半', costDice: '1d6', clockId: 'fatigue' },
      { id: 'intel', label: '這是您先前需要的情報。', describe: '休息時向 GM 提一個問題', costDice: '1d6', clockId: 'fatigue' },
      { id: 'elemental', label: '臥倒，我會處理好的！', describe: '元素水晶追加【5＋等級一半】傷害', costDice: '1d6', clockId: 'fatigue' }
    ],
    // C 刻度型：指向既有的 classResources 池（不新開存放處）
    clock: { resourceId: 'fatigue', label: '疲勞值', max: 10, blockAt: 10 },
    // E 週期結算型：原文「每當章節結束……恢復 1d6 點疲勞值（最低降為 0）」
    settlements: [
      { id: 'chapter', label: '章節結束：恢復 1d6 疲勞值', dice: '1d6', clockId: 'fatigue', sign: -1, min: 0 }
    ],
    // 未填齊資料時增益禁用並標明原因
    requireRecordsForBuffs: true
  }
});

export const specFor = (itemId) => FLOW_DATA_SPECS[itemId] || null;

