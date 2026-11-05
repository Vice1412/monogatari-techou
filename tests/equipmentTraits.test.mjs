import {
  EQUIPMENT_TRAITS,
  traitsFor,
  traitPrice
} from '../src/features/character-sheet/data/equipmentTraits.js';
import {
  FLOW_DATA_SPECS,
  specFor,
  getForesightSL,
  planUpgradeTrait
} from '../src/features/character-sheet/utils/flowData.js';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';

let results = [];
const check = (name, ok, detail = '') => {
  const shown = detail === true ? (ok ? '有' : '缺') : detail;
  results.push({ name, ok: !!ok, detail: shown });
};

console.log('\n=== A. traitsFor 篩選與價格上限 ===');
const weaponUnder1000 = traitsFor('weapon', 1000);
check('A1 traitsFor("weapon", 1000) 包含多重 (1000z)',
  weaponUnder1000.some((t) => t.id === 'traitMulti' && t.cost === 1000),
  true);
check('A2 traitsFor("weapon", 1000) 不含免疫 (1500z)',
  !weaponUnder1000.some((t) => t.id === 'traitImmunity'),
  true);
check('A3 traitsFor("weapon", 1000) 不含完美健康 (2000z)',
  !weaponUnder1000.some((t) => t.id === 'traitPerfectHealth'),
  true);

const accessoryUnder1000 = traitsFor('accessory', 1000);
check('A4 traitsFor("accessory", 1000) 不含咒語強化 (2000z)',
  !accessoryUnder1000.some((t) => t.id === 'traitSpellBoost'),
  true);
check('A5 traitsFor("accessory", 1000) 包含生命力強化 (1000z)',
  accessoryUnder1000.some((t) => t.id === 'traitVigor' && t.cost === 1000),
  true);

console.log('\n=== B. traitPrice 價格計算與高瞻遠矚折抵 ===');
check('B1 traitPrice 基礎價（SL 0）：原價 700z',
  traitPrice({ cost: 700 }, 0) === 700,
  true);
check('B2 traitPrice 折抵計算（SL 3）：700 − 300 = 400z',
  traitPrice({ cost: 700 }, 3) === 400,
  true);
check('B3 traitPrice 超額折抵（SL 9）：最低為 0z（不為負數）',
  traitPrice({ cost: 700 }, 9) === 0,
  true);
check('B4 traitPrice 接受數值型態原價',
  traitPrice(800, 2) === 600,
  true);
check('B5 traitPrice 負數或非法 SL 視為 0（不增加價格）',
  traitPrice({ cost: 500 }, -2) === 500 && traitPrice({ cost: 500 }, null) === 500,
  true);

console.log('\n=== C. 資料完整性與封閉詞彙自檢 ===');
const ALL_IDS = EQUIPMENT_TRAITS.map((t) => t.id);
const UNIQUE_IDS = new Set(ALL_IDS);
check('C1 特性資料庫 id 無重複項',
  ALL_IDS.length === UNIQUE_IDS.size,
  true);

const VALID_STATUSES = new Set(['眩暈', '動搖', '緩慢', '虛弱', '憤怒', '中毒']);
const VALID_ELEMENTS = new Set(['物理', '風', '電', '暗', '土', '火', '冰', '光', '毒']);
const VALID_SPECIES = new Set(['野獸', '構造體', '惡魔', '元素', '類人', '怪物', '植物', '不死', '構裝體']);
const VALID_SLOTS = new Set(['weapon', 'armor', 'shield', 'accessory']);

let slotsValid = true;
let costsValid = true;
let choicesValid = true;

for (const t of EQUIPMENT_TRAITS) {
  if (!Array.isArray(t.slots) || t.slots.length === 0 || !t.slots.every((s) => VALID_SLOTS.has(s))) {
    slotsValid = false;
  }
  if (!Number.isInteger(t.cost) || t.cost <= 0) {
    costsValid = false;
  }
  if (t.choice) {
    if (!Array.isArray(t.choice.options) || t.choice.options.length < 2) {
      choicesValid = false;
    }
    if (t.choice.key === 'status') {
      if (!t.choice.options.every((opt) => VALID_STATUSES.has(opt))) choicesValid = false;
    } else if (t.choice.key === 'damageType') {
      if (!t.choice.options.every((opt) => VALID_ELEMENTS.has(opt))) choicesValid = false;
    } else if (t.choice.key === 'species') {
      if (!t.choice.options.every((opt) => VALID_SPECIES.has(opt))) choicesValid = false;
    }
  }
}

check('C2 每筆特性的 slots 均非空且在合法槽位內', slotsValid, true);
check('C3 每筆特性的 cost 均為正整數', costsValid, true);
check('C4 特性選擇項 choice.options 均在對應封閉詞彙內且選項 ≥ 2', choicesValid, true);

const traitState = EQUIPMENT_TRAITS.find((t) => t.id === 'traitState');
check('C5 反狀態 (traitState) 跨武器與防具/盾牌共用同一個 id',
  traitState?.slots?.includes('weapon') &&
  traitState?.slots?.includes('armor') &&
  traitState?.slots?.includes('shield'),
  true);

console.log('\n=== D. 【升級】規格與 flowDataSpecs ===');
const upgradeSpec = specFor('heroic:升級');
check('D1 specFor("heroic:升級") 存在於 FLOW_DATA_SPECS', !!upgradeSpec, true);
check('D2 升級具備 records 欄位且限制在 1000z 裝備槽位內',
  upgradeSpec?.records?.max === 8 &&
  upgradeSpec?.requires?.maxCost === 1000 &&
  upgradeSpec?.requires?.slotScope?.length === 3,
  true);

console.log('\n=== E. planUpgradeTrait 改造流程與資金判定 ===');
const tinkererChar = createNewCharacter({ name: '修補匠角色' });
tinkererChar.classes = [
  {
    name: '修補匠',
    skills: [{ name: '高瞻遠矚', sl: 2 }]
  }
];
tinkererChar.zenit = 1000;

check('E1 getForesightSL 正確識別高瞻遠矚技能等級（SL 2）',
  getForesightSL(tinkererChar) === 2,
  true);

const plan1 = planUpgradeTrait(tinkererChar, {
  itemName: '旅行長劍',
  slot: '武器',
  traitId: 'traitPierce' // 400z, SL 2 折 200z -> 實付 200z
});
check('E2 成功為旅行長劍添加穿刺特性，實付 200z（400 − 200）',
  plan1.ok === true && plan1.paid === 200 && plan1.patch.zenit === 800,
  true);
check('E3 planUpgradeTrait 生成合規履歷且 kind 為 heroic',
  plan1.log?.kind === 'heroic' && plan1.log?.title?.includes('旅行長劍') && plan1.log?.changes?.[0]?.to === 800,
  true);

const poorChar = { ...tinkererChar, zenit: 50 };
const planPoor = planUpgradeTrait(poorChar, {
  itemName: '旅行長劍',
  slot: '武器',
  traitId: 'traitPierce' // 需 200z，現有 50z
});
check('E4 資金不足時拒絕添加並說明所需金額',
  planPoor.ok === false && /資金不足.*200.*50/.test(planPoor.reason),
  true);

const planOver1000 = planUpgradeTrait(tinkererChar, {
  itemName: '鋼鐵護甲',
  slot: '護甲',
  traitId: 'traitImmunity' // 1500z
});
check('E5 超過 1000z 的特性（如免疫 1500z）無法透過【升級】附加',
  planOver1000.ok === false && planOver1000.reason?.includes('1000z'),
  true);

const planMismatched = planUpgradeTrait(tinkererChar, {
  itemName: '鋼鐵護甲',
  slot: '護甲',
  traitId: 'traitArcane' // 武器專屬特性
});
check('E6 槽位不匹配時拒絕附加（護甲不能附加魔能）',
  planMismatched.ok === false && planMismatched.reason?.includes('無法附加'),
  true);

/* ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail === '' ? '' : `  —— ${r.detail}`}`);
}
console.log('');
console.log(`  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) process.exit(1);

