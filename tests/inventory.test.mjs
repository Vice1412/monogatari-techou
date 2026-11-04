/**
 * 行囊物品契約（`utils/inventory.js` ＋ `BackpackGrid`）。
 *
 * 執行：`npm run test:inventory`（已納入 `npm test` 串接）
 *
 * ## 為什麼要有這支（2026-11-03）
 *
 * 使用者：「冒險途中拿到裝備、特殊物品、紀念品、神器……該記錄在哪裡？」
 * 當時答案是「寫進冒險筆記本」——一段純文字，算不出價值、賣不掉。
 *
 * 這支守四件事：
 *   ① 資料收斂（空白名不進清單、價值壞值＝不知道、數量至少 1）
 *   ② **賣出是一次寫入**：物品移除 ＋ zenit 增加 ＋ 履歷一筆，不能只做一半
 *   ③ 賣出金額由玩家輸入（原書沒有公定售價），空白／0 要擋下來而不是靜默成交
 *   ④ 畫面：空格子要有教學、有物品要畫出格子、選中才出現詳情
 */
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  INVENTORY_CATEGORIES,
  applySellItem,
  createInventoryItem,
  describeInventoryTotal,
  inventoryCategoryLabel,
  describeGearSummary,
  readInventory,
  removeInventoryItem
} from '../src/features/character-sheet/utils/inventory.js';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';

let results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const base = () => createNewCharacter({ name: '行囊測試' });
const withItems = (...items) => ({ ...base(), inventory: items });

/* ────────────────────────────────────────────────────────────────
   A. 建立與收斂
   ──────────────────────────────────────────────────────────────── */
const empty = createInventoryItem({ name: '   ' });
check('A1 空白名稱不進清單（回 null）', empty === null, String(empty));

const basic = createInventoryItem({ name: '破咒之刃', category: 'rare', value: '800', effect: '對魔法生物 +5' });
check('A2 正常建立：名稱去頭尾空白', basic.name === '破咒之刃', basic.name);
check('A3 類別照登記表收斂', basic.category === 'rare', basic.category);
check('A4 價值轉數字', basic.value === 800, basic.value);
check('A5 數量預設 1', basic.qty === 1, basic.qty);
check('A6 有穩定 id', typeof basic.id === 'string' && basic.id.startsWith('inv_'), basic.id);

const weird = createInventoryItem({ name: '古怪東西', category: '不存在的類別', value: 'abc', qty: 0 });
check('A7 未登記的類別 → 雜項', weird.category === 'misc', weird.category);
check('A8 價值壞值 → null（不知道，不是 0）', weird.value === null, String(weird.value));
check('A9 數量 0 → 1', weird.qty === 1, weird.qty);

const blankValue = createInventoryItem({ name: '紀念品', value: '' });
check('A10 價值留空 → null', blankValue.value === null, String(blankValue.value));

check('A11 三個官方類別都在（裝備／消耗品／稀有物品）',
  ['equipment', 'consumable', 'rare'].every((k) => INVENTORY_CATEGORIES.some((c) => c.key === k)),
  INVENTORY_CATEGORIES.map((c) => c.key).join(','));
check('A12 類別標籤可查，未知鍵回「雜項」',
  inventoryCategoryLabel('rare') === '稀有物品' && inventoryCategoryLabel('zzz') === '雜項',
  `${inventoryCategoryLabel('rare')}／${inventoryCategoryLabel('zzz')}`);

/* ────────────────────────────────────────────────────────────────
   B. 讀取與移除
   ──────────────────────────────────────────────────────────────── */
check('B1 舊存檔沒有 inventory → 空陣列（不是 undefined）', readInventory(base()).length === 0, `${readInventory(base()).length}`);
const two = withItems(basic, blankValue);
check('B2 讀得到兩筆', readInventory(two).length === 2, `${readInventory(two).length}`);
check('B3 移除一筆後剩一筆', readInventory(removeInventoryItem(two, basic.id)).length === 1, `${readInventory(removeInventoryItem(two, basic.id)).length}`);
check('B4 移除不存在的 id → 回同一物件（呼叫端可據此不寫檔）',
  removeInventoryItem(two, 'nope') === two, 'same ref');
check('B5 估值合計＝價值 × 數量', describeInventoryTotal(withItems(basic, { ...blankValue, value: 200, qty: 3 })) === 1400,
  `${describeInventoryTotal(withItems(basic, { ...blankValue, value: 200, qty: 3 }))}`);
check('B6 價值為 null 的不計入估值', describeInventoryTotal(withItems(blankValue)) === 0, `${describeInventoryTotal(withItems(blankValue))}`);

/* ────────────────────────────────────────────────────────────────
   C. 賣出：一次寫入，不能只做一半
   ──────────────────────────────────────────────────────────────── */
const wallet = withItems(basic);
wallet.zenit = 500;
const sold = applySellItem(wallet, { itemId: basic.id, amount: 800 });
check('C1 賣出成功', sold.ok === true, String(sold.ok));
check('C2 錢真的加了（500 + 800）', sold.character.zenit === 1300, `${sold.character.zenit}`);
check('C3 物品真的離開行囊', readInventory(sold.character).length === 0, `${readInventory(sold.character).length}`);
/* 建卡本身就會留一筆 `creation` 記錄，所以這裡只挑 `trade` 那一筆來驗
   ——否則「有三筆」與「有履歷」會被混為一談。 */
const tradeLog = (sold.character.log || []).filter((e) => e.kind === 'trade');
check('C4 履歷留下一筆交易（不是靜默加錢）', tradeLog.length === 1, `${tradeLog.length} 筆 trade／共 ${(sold.character.log || []).length} 筆`);
check('C5 履歷寫出「賣出 ○○」', (tradeLog[0]?.title || '').includes('賣出'), tradeLog[0]?.title || '(缺)');
check('C6 履歷的 zenit 變化與實際一致',
  JSON.stringify((tradeLog[0]?.changes || []).find((c) => c.field === 'zenit') || {}),
  JSON.stringify({ field: 'zenit', from: 500, to: 1300 }));

const missingItem = applySellItem(wallet, { itemId: 'nope', amount: 100 });
check('C7 找不到物品 → 不成交、不改錢', missingItem.ok === false && missingItem.character === wallet, `${missingItem.ok}`);
const noAmount = applySellItem(wallet, { itemId: basic.id, amount: '' });
check('C8 金額空白 → 擋下來（不是 0 元成交）', noAmount.ok === false && noAmount.reason.includes('金額'), noAmount.reason || '');
const zeroAmount = applySellItem(wallet, { itemId: basic.id, amount: 0 });
check('C9 金額 0 → 擋下來', zeroAmount.ok === false, String(zeroAmount.reason));
check('C10 被擋下來時物品還在、錢沒動',
  readInventory(noAmount.character).length === 1 && noAmount.character.zenit === 500,
  `${readInventory(noAmount.character).length} 件 / ${noAmount.character.zenit}z`);
const editable = applySellItem(wallet, { itemId: basic.id, amount: 300 });
check('C11 成交價可以低於物品價值（原書沒有公定售價）', editable.ok && editable.character.zenit === 800, `${editable.character?.zenit}`);

/* ────────────────────────────────────────────────────────────────
   G. 裝備的詳細欄位（2026-11-03 第二輪，使用者回報）
   ────────────────────────────────────────────────────────────────
   「自訂裝備是代表不是在列表上的，而不代表不是裝備……你應該也要給他輸入傷害、
    輸入類別、輸入屬性類型、輸入效果、輸入檢定之類的。」 */
const armored = createInventoryItem({
  name: '守墓人的鏽劍',
  category: 'equipment',
  value: 300,
  gear: { slot: 'mainHand', category: '劍', range: '近戰', hands: 1, check: 'DEX + MIG', damage: '【HR + 6】', damageType: '物理' }
});
check('G1 裝備類保留 gear 欄位', Boolean(armored.gear), armored.gear ? '有' : '缺');
check('G2 欄位、類別、檢定、傷害、屬性都留下來了',
  [armored.gear.slot, armored.gear.category, armored.gear.check, armored.gear.damage, armored.gear.damageType],
  ['mainHand', '劍', 'DEX + MIG', '【HR + 6】', '物理']);
check('G3 摘要寫成一行（給詳情區與匯出用）',
  describeGearSummary(armored.gear) === '劍 · 近戰 · DEX + MIG · 【HR + 6】物理',
  describeGearSummary(armored.gear));

const notGear = createInventoryItem({ name: '治療藥水', category: 'consumable', value: 100, gear: { category: '劍' } });
check('G4 非裝備類不保留 gear（不讓資料長出沒意義的欄位）', notGear.gear === undefined, String(notGear.gear));

const emptyGear = createInventoryItem({ name: '不知道什麼', category: 'equipment', gear: { slot: 'mainHand' } });
check('G5 全部留空的 gear → null（不是一個空物件）', emptyGear.gear === null, String(emptyGear.gear));

const weirdGear = createInventoryItem({ name: '怪東西', category: 'equipment', gear: { slot: '腳趾', category: ' 劍 ', hands: 7 } });
check('G6 未登記的欄位 → 主手；字串去頭尾；手數只認 1／2',
  [weirdGear.gear.slot, weirdGear.gear.category, weirdGear.gear.hands], ['mainHand', '劍', 1]);

const fieldsSrc = fs.readFileSync('src/features/character-sheet/components/EquipmentItemFields.jsx', 'utf8');
check('G7 自訂裝備欄位組含：類別／遠近／手數／檢定／傷害／屬性',
  ['gear-category', 'gear-range', 'gear-hands-', 'gear-check', 'gear-damage', 'gear-damage-type'].every((k) => fieldsSrc.includes(k)),
  '六項都在');
const backpackSrc = fs.readFileSync('src/features/character-sheet/components/BackpackItemModal.jsx', 'utf8');
check('G8 行囊新增物品也用同一組欄位（不是另一份表單）',
  backpackSrc.includes('<EquipmentItemFields'), 'EquipmentItemFields');
const moneySrc = fs.readFileSync('src/features/character-sheet/components/MoneyFlowModal.jsx', 'utf8');
check('G9 支出對話框的「自訂裝備」也用它，而不是切到「不是裝備」那條路',
  [moneySrc.includes('<EquipmentItemFields'), moneySrc.includes("setItemKind('other')")],
  [true, false]);

/* ────────────────────────────────────────────────────────────────
   D. 畫面（SSR）
   ──────────────────────────────────────────────────────────────── */
const BackpackGrid = (await import('../src/features/character-sheet/components/BackpackGrid.jsx')).default;
const renderGrid = (character) => renderToStaticMarkup(
  React.createElement(BackpackGrid, {
    character,
    theme: { border: '#e8dcc4' },
    onChange: () => {},
    onAdd: () => {},
    onSell: () => ({ ok: true }),
    onDiscard: () => {},
    showToast: () => {}
  })
);
const emptyHtml = renderGrid(base());
check('D1 空行囊有教學（不是一片空白）', emptyHtml.includes('行囊是空的'), emptyHtml.includes('行囊是空的') ? '有' : '缺');
check('D2 空行囊給「新增物品」的出口', emptyHtml.includes('新增物品'), '新增物品');
check('D3 有物品時畫出分類列與件數',
  [emptyHtml.includes('backpack-filter-all'), emptyHtml.includes('backpack-filter-rare')],
  [true, true]);

const filledHtml = renderGrid(withItems(
  { id: 'i1', name: '破咒之刃', category: 'rare', value: 800, effect: '對魔法生物 +5', qty: 1 },
  { id: 'i2', name: '治療藥水', category: 'consumable', value: 100, effect: '', qty: 3 }
));
check('D4 兩件物品都畫成格子', [filledHtml.includes('backpack-item-i1'), filledHtml.includes('backpack-item-i2')], [true, true]);
check('D5 數量 >1 才顯示角標（×3）', filledHtml.includes('×3'), filledHtml.includes('×3') ? '有' : '缺');
check('D6 估值合計寫出來（800 + 300，走 formatZenit 的千分位）', filledHtml.includes('1,100z'), filledHtml.match(/1,100z/)?.[0] || '缺');
check('D7 沒選物品時不畫詳情區', !filledHtml.includes('backpack-detail'), filledHtml.includes('backpack-detail') ? '有' : '無');

/* ────────────────────────────────────────────────────────────────
   E. 匯出用的資料（與畫面共用同一份讀取）
   ──────────────────────────────────────────────────────────────── */
const exportSrc = fs.readFileSync('src/features/character-sheet/components/CharacterSheetExport.jsx', 'utf8');
check('E1 匯出用的是同一支 readInventory（不是自己再解析一次）',
  exportSrc.includes('readInventory(ch)'), exportSrc.includes('readInventory(ch)') ? '有' : '缺');
check('E2 匯出有獨立的「行囊物品」區塊', exportSrc.includes('title="行囊物品"'), exportSrc.includes('title="行囊物品"') ? '有' : '缺');

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log('\n  行囊的兩條底線：賣出是一次寫入、金額由玩家決定（沒有公定售價）。');
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
