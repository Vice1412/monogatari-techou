import {
  createInventoryItem,
  consumeInventoryItem,
  addInventoryItem
} from '../src/features/character-sheet/utils/inventory.js';
import {
  applySaltAndPepper,
  applyDashOfLove,
  buildCookedDelicacyItem
} from '../src/features/character-sheet/utils/gourmetActions.js';

let results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: detail || (ok ? '通過' : '失敗') });
};

// ── A. createInventoryItem effectModel ──
const itemWithModel = createInventoryItem({
  name: '高級治療藥水',
  category: 'consumable',
  value: 100,
  qty: 2,
  effectModel: { healHp: 50, healMp: 0, isPotion: true }
});
check('A1 成功建立帶 effectModel 之物品', itemWithModel && itemWithModel.effectModel?.healHp === 50, '50 HP');
check('A2 標記為藥水（isPotion: true）', itemWithModel.effectModel?.isPotion === true, 'isPotion');

const itemWithoutModel = createInventoryItem({ name: '鐵劍', category: 'equipment' });
check('A3 無 effectModel 時不長多餘欄位', itemWithoutModel.effectModel === undefined, '無多餘欄位');

// ── B. 一般消耗品使用 ──
let char = {
  currentHp: 10,
  maxHp: 80,
  currentMp: 10,
  maxMp: 60,
  inventory: [itemWithModel]
};

const resConsume = consumeInventoryItem(char, itemWithModel.id);
check('B1 成功使用一件消耗品', resConsume.ok === true && resConsume.outcome.type === 'normal', 'normal');
check('B2 自身 HP 獲得恢復（10 + 50 = 60）', resConsume.character.currentHp === 60, String(resConsume.character.currentHp));
check('B3 物品數量減 1（剩 1 件）', resConsume.character.inventory[0]?.qty === 1, '剩 1 件');

// 再次使用，數量歸零移除
const resConsume2 = consumeInventoryItem(resConsume.character, itemWithModel.id);
check('B4 數量歸零後自背包清空', resConsume2.character.inventory.length === 0, '清空');

// ── C. 修補匠【藥水雨】──
const potion = createInventoryItem({
  name: '治療魔藥',
  category: 'consumable',
  effectModel: { healHp: 40, healMp: 20, isPotion: true }
});
let tinkererChar = {
  currentHp: 20,
  maxHp: 80,
  currentMp: 10,
  maxMp: 60,
  inventory: [potion]
};

const resRain = consumeInventoryItem(tinkererChar, potion.id, { isPotionRain: true, potionRainSL: 2 });
check('C1 藥水雨模式成功觸發', resRain.ok === true && resRain.outcome.type === 'potionRain', 'potionRain');
check('C2 目標數為 SL + 1（SL 2 -> 3 人）', resRain.outcome.targets === 3, String(resRain.outcome.targets));
check('C3 恢復量折半（40 -> 20 HP, 20 -> 10 MP）', resRain.outcome.halvedHp === 20 && resRain.outcome.halvedMp === 10, '折半');
check('C4 自身獲得折半恢復（20 + 20 = 40 HP）', resRain.character.currentHp === 40, String(resRain.character.currentHp));

// ── D. 商人【過期食品】──
const spoiledFoodItem = createInventoryItem({
  name: '過期草莓派',
  category: 'consumable',
  effectModel: { healHp: 50, healMp: 0 }
});
let merchantChar = {
  currentHp: 30,
  maxHp: 80,
  inventory: [spoiledFoodItem]
};

const resSpoiled = consumeInventoryItem(merchantChar, spoiledFoodItem.id, { isSpoiledFood: true });
check('D1 過期食品成功投擲', resSpoiled.ok === true && resSpoiled.outcome.type === 'spoiledFood', 'spoiledFood');
check('D2 轉為等額毒傷害（50 點毒傷）', resSpoiled.outcome.poisonDamage === 50, String(resSpoiled.outcome.poisonDamage));
check('D3 自身 HP 不增加（維持 30）', resSpoiled.character.currentHp === 30, String(resSpoiled.character.currentHp));

// ── E. 美食家【鹽與胡椒】──
const ingredients = [
  { id: 'ing1', name: '酸漿果', taste: '酸味' },
  { id: 'ing2', name: '苦艾草', taste: '苦味' }
];
const resSpFail = applySaltAndPepper({ pickedIngredients: ingredients, targetId: 'ing1', newTaste: '甜味', currentIp: 1 });
check('E1 IP 不足 2 點時調味被擋', resSpFail.ok === false && resSpFail.reason.includes('IP 不足'), resSpFail.reason);

const resSpOk = applySaltAndPepper({ pickedIngredients: ingredients, targetId: 'ing1', newTaste: '甜味', currentIp: 3 });
check('E2 成功調味並扣除 2 IP（3 -> 1）', resSpOk.ok === true && resSpOk.nextIp === 1, `剩餘 IP: ${resSpOk.nextIp}`);
check('E3 食材口味成功覆寫為【甜味】', resSpOk.modifiedIngredients.find((i) => i.id === 'ing1')?.taste === '甜味', '甜味');

// ── F. 美食家【加點愛】──
const resLoveFailMax = applyDashOfLove({ skillSL: 2, currentMp: 40, extraAllies: 3 });
check('F1 超過 SL 上限時被擋（上限 2 人）', resLoveFailMax.ok === false && resLoveFailMax.reason.includes('最多額外影響 2 名盟友'), resLoveFailMax.reason);

const resLoveFailMp = applyDashOfLove({ skillSL: 3, currentMp: 15, extraAllies: 2 });
check('F2 MP 不足時被擋（需 20 MP，目前 15）', resLoveFailMp.ok === false && resLoveFailMp.reason.includes('MP 不足'), resLoveFailMp.reason);

const resLoveOk = applyDashOfLove({ skillSL: 3, currentMp: 50, extraAllies: 2 });
check('F3 成功加點愛並扣除 20 MP（50 -> 30）', resLoveOk.ok === true && resLoveOk.nextMp === 30 && resLoveOk.extraAllies === 2, `剩餘 MP: ${resLoveOk.nextMp}`);

// ── G. 美食家【烹飪】包裝為物品 ──
const delicacy = buildCookedDelicacyItem({ dishName: '特製燉蘑菇', dishText: '恢復 40 點 HP。' });
check('G1 成功打包為消耗品美食', delicacy.category === 'consumable' && delicacy.effectModel?.isDelicacy === true, delicacy.name);

// ── H. SSR 渲染驗證 ──
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BackpackGrid from '../src/features/character-sheet/components/BackpackGrid.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';

const testHero = createNewCharacter({ name: '烹飪大師' });
testHero.classes = [
  { className: '修補匠', level: 5, skills: [{ name: '藥水雨', sl: 2 }] },
  { className: '商人', level: 5, skills: [{ name: '過期食品', sl: 1 }] }
];
const testConsumable = createInventoryItem({
  name: '特效靈藥',
  category: 'consumable',
  value: 120,
  qty: 2,
  effectModel: { healHp: 40, isPotion: true }
});
testHero.inventory = [testConsumable];

const bp充Html = renderToStaticMarkup(
  React.createElement(BackpackGrid, {
    character: testHero,
    onChange: () => {},
    onAdd: () => {},
    onSell: () => {},
    onDiscard: () => {},
    showToast: () => {},
    initialSelectedId: testConsumable.id
  })
);

check('H1 詳情區渲染消耗品使用區塊（backpack-consume-section）', bp充Html.includes('data-testid="backpack-consume-section"'), '有使用區塊');
check('H2 渲染使用按鈕（backpack-consume-btn）', bp充Html.includes('data-testid="backpack-consume-btn"'), '有使用按鈕');
check('H3 具備【藥水雨】技能渲染勾選框（backpack-toggle-potion-rain）', bp充Html.includes('data-testid="backpack-toggle-potion-rain"'), '有藥水雨勾選');
check('H4 具備【過期食品】技能渲染勾選框（backpack-toggle-spoiled-food）', bp充Html.includes('data-testid="backpack-toggle-spoiled-food"'), '有過期食品勾選');

// ── 輸出 ──
const fails = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  —— ${r.detail}`);
}
console.log(`\n  通過 ${results.length - fails.length} / ${results.length}`);
if (fails.length > 0) process.exit(1);

