// 核心規則 - 旅人【忠實夥伴】資料庫與機制規則
// 依據 Core Rulebook p. 219 (忠實夥伴) 與 p. 302-317 (官方 NPC 創建與能力規則)

export const COMPANION_SPECIES = [
  { id: 'beast', name: '野獸' },
  { id: 'construct', name: '構裝體' },
  { id: 'elemental', name: '元素' },
  { id: 'plant', name: '植物' }
];

// 官方 p. 302 四大屬性配置方案
export const COMPANION_ATTRIBUTE_ARRAYS = [
  { id: 'average', name: '平均', dice: [8, 8, 8, 8], label: '平均（d8, d8, d8, d8）' },
  { id: 'standard', name: '標準', dice: [10, 8, 8, 6], label: '標準（d10, d8, d8, d6）' },
  { id: 'specialized', name: '專精', dice: [10, 10, 6, 6], label: '專精（d10, d10, d6, d6）' },
  { id: 'super_specialized', name: '超級專精', dice: [12, 8, 6, 6], label: '超級專精（d12, d8, d6, d6）' }
];

// 傷害類型選項
export const DAMAGE_TYPES = [
  { id: 'physical', name: '物理', code: 'p' },
  { id: 'air', name: '風', code: 'a' },
  { id: 'bolt', name: '電', code: 'b' },
  { id: 'dark', name: '暗', code: 'd' },
  { id: 'earth', name: '土', code: 'e' },
  { id: 'fire', name: '火', code: 'f' },
  { id: 'ice', name: '冰', code: 'i' },
  { id: 'light', name: '光', code: 'l' },
  { id: 'poison', name: '毒', code: 't' }
];

// 屬性縮寫列表
export const ATTRIBUTE_KEYS = ['DEX', 'INS', 'MIG', 'WLP'];

// 計算夥伴最大 HP：((SL × 夥伴基礎 MIG 骰面) + 向下取整(旅人等級 / 2))
export function calculateCompanionMaxHp(sl = 1, migDie = 8, characterLevel = 5) {
  const safeSl = Math.max(1, Math.min(5, Number(sl) || 1));
  const safeMig = Number(migDie) || 8;
  const safeLevel = Number(characterLevel) || 5;
  return (safeSl * safeMig) + Math.floor(safeLevel / 2);
}

// 計算夥伴危機 HP：向下取整(最大 HP / 2)
export function calculateCompanionCrisisHp(maxHp) {
  return Math.floor(Number(maxHp) / 2);
}

// 建立預設旅人忠實夥伴資料
export function createDefaultCompanionData() {
  return {
    name: '忠實夥伴',
    species: '野獸',
    arrayType: 'standard',
    dex: 8,
    ins: 8,
    mig: 10,
    wlp: 6,
    currentHp: null,
    attacks: [
      {
        id: 'atk_1',
        name: '猛撲撕咬',
        range: 'melee',
        attr1: 'MIG',
        attr2: 'DEX',
        damageType: 'physical',
        damageText: '【HR + 5】物理',
        specialEffect: ''
      },
      {
        id: 'atk_2',
        name: '威嚇咆哮',
        range: 'ranged',
        attr1: 'MIG',
        attr2: 'WLP',
        damageType: 'physical',
        damageText: '【HR + 5】物理',
        specialEffect: ''
      }
    ],
    spells: [],
    otherActions: [],
    specialRules: []
  };
}
