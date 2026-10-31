/**
 * 自由武器模板（P9-c，2026-10-31）
 *
 * 執行：`npm run test:freeform`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者的原話：「武器並不是只有基礎武器而已，請你開放自由的武器模板讓玩家寫資訊。」
 *
 * 三句話拆成三個可驗的命題：
 *   1. 玩家寫什麼就記什麼——**一格原書公式都不套**                        → B 段
 *   2. 寫完之後它要跟書上的武器**一樣好用**（裝備、換回來、履歷格式）    → C／D／F 段
 *   3. 寫的入口在玩家會找的地方（購買面板與換裝彈窗各一個）              → H 段
 *
 * ── 為什麼「不套公式」需要被驗 ──────────────────────────────
 *
 * 專案裡已經有【定制武器】：300z、雙手、傷害 HR + 5。
 * 自由武器走的是**同一個陣列、同一支 `buildCustomWeaponEntry`**，
 * 所以最可能的錯不是「沒接上」，而是**接上了、但被套上那套公式**——
 * 玩家寫「【HR + 2】火」，畫面變成「【HR + 7】物理」，而他的字被程式改掉。
 * 這種錯不會報錯、不會當掉，只會讓玩家覺得「它根本沒在聽我說話」。
 *
 * ── 第二個容易安靜失敗的地方 ────────────────────────────────
 *
 * 雙手武器換上主手時副手必須空出。那條判定靠 `weaponMap` 找武器——
 * 而**剛寫好的那把還沒進角色身上**，不在 map 裡。不補進去的話：
 * 武器裝上去了、盾也還在，畫面上兩格都有東西（F1／F2 就是這條的對照組）。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CUSTOM_WEAPON_BASE,
  FREEFORM_WEAPON_DEFAULTS,
  createFreeformWeaponSpec,
  isFreeformWeapon,
  validateFreeformWeapon,
  validateCustomWeapon,
  describeCustomWeapon,
  buildCustomWeaponEntry,
  buildFreeformWeaponItem,
  buildOwnedWeaponItems,
  attachCustomWeapon
} from '../src/features/character-sheet/data/customWeapons.js';
import { applyPurchase } from '../src/features/character-sheet/utils/moneyFlow.js';
import { applyEquipmentChoice } from '../src/features/character-sheet/utils/equipmentRules.js';
import {
  describeHeldState,
  describeHeldLabel,
  describeSlotBlock
} from '../src/features/character-sheet/components/EquipmentSlotModal.jsx';
import {
  WeaponTemplateFields,
  describeTemplateBlock
} from '../src/features/character-sheet/components/WeaponTemplateFields.jsx';
import { describePurchase } from '../src/features/character-sheet/utils/zenitFeedback.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';

let results = [];
/** 值斷言：實際值與期望值真的相等才算過。 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const countOf = (hay, needle) => String(hay).split(needle).length - 1;

const ROOT = process.cwd();
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readSrc = (rel) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/* ────────────────────────────────────────────────────────────────
   A. 規格：預設值與驗證
   ──────────────────────────────────────────────────────────────── */

const blank = createFreeformWeaponSpec();
const rustSword = createFreeformWeaponSpec({
  name: '守墓人的鏽劍',
  category: '劍',
  range: '近戰',
  hands: 1,
  attr: 'DEX + MIG',
  damage: '【HR + 2】火',
  cost: 120,
  note: '對亡靈額外 2 點傷害'
});

eq('A1 新武器預設就是自由武器（同一條陣列要靠這個旗標分辨）', blank.freeform, true);
eq('A2 預設是單手（定制武器一定是雙手，兩者不能混）', blank.hands, 1);
eq('A3 預設留著空的訂製欄位（讓其他程式碼不必逐一判斷 freeform）',
  [blank.customizations, blank.element, blank.transformingId], [[], '', '']);
eq('A4 isFreeformWeapon 只認 true（字串 "true" 不算）',
  [isFreeformWeapon({ freeform: true }), isFreeformWeapon({ freeform: 'true' }),
    isFreeformWeapon({}), isFreeformWeapon(null)],
  [true, false, false, false]);
eq('A5 hands 只有 1 與 2 兩種值（字串會讓「清副手」那條判定安靜失效）',
  [createFreeformWeaponSpec({ hands: 2 }).hands,
    createFreeformWeaponSpec({ hands: '2' }).hands,
    createFreeformWeaponSpec({ hands: 3 }).hands],
  [2, 1, 1]);

const issueFields = (spec) => validateFreeformWeapon(spec).issues.map((i) => i.field);
eq('A6 空白表單 → 缺名稱與價格', issueFields(blank), ['name', 'cost']);
eq('A7 名稱只有空白＝沒填', issueFields({ ...blank, name: '   ' }), ['name', 'cost']);
// `''` 與 `0` 不是同一件事：`0` 是「我知道，而且免費」，`''` 是「還沒填」。
eq('A8 價格空字串 → 說「請填價格」（不是當成 0 元）',
  issueFields({ ...blank, name: '柴刀', cost: '' }), ['cost']);
eq('A9 價格 0 → 合法（免費的武器是真的存在）',
  validateFreeformWeapon({ ...blank, name: '柴刀', cost: 0 }).ok, true);
eq('A10 價格負數 → 不合法',
  issueFields({ ...blank, name: '柴刀', cost: -1 }), ['cost']);
eq('A11 命中與傷害必填（那是玩家要寫的資訊，不是可省略的裝飾）',
  issueFields({ ...blank, name: '柴刀', cost: 0, attr: '', damage: '  ' }), ['attr', 'damage']);
eq('A12 完整的一把 → 通過', validateFreeformWeapon(rustSword), { ok: true, issues: [] });

// 結構護欄：每一個 issue 都要帶 field 與 message。
// 只驗「有幾個 issue」的話，`{ field:'name' }` 少了訊息也會過，
// 而畫面上那一格就變成紅框＋空白（玩家看不出要改什麼）。
const allIssueKeys = [
  ...validateFreeformWeapon(blank).issues,
  ...validateFreeformWeapon({ ...blank, name: 'x', cost: -5 }).issues
];
eq('A13 每個 issue 都帶 field 與 message（缺訊息＝紅框但沒說要改什麼）',
  allIssueKeys.every((i) => typeof i.field === 'string' && i.field && typeof i.message === 'string' && i.message),
  true);

// 最關鍵的一條：自由武器**不能**被送去跑定制武器那一套驗證。
// 走錯分支的話，它會被要求「命中檢定必須是【DEX + INS】或【DEX + MIG】」與
// 「必須選滿三個訂製能力」——而那是玩家自己寫的字。
eq('A14 整條 customWeapons 一起驗時，自由武器走自己那套（不被要求 300z／雙手／訂製名額）',
  validateCustomWeapon(rustSword, { siblings: [rustSword] }).ok, true);
eq('A15 對照組：真正的定制武器仍然走原書那一套（沒有訂製能力也能過，但要有 accuracy）',
  validateCustomWeapon({ ...rustSword, freeform: false, customizations: [] }, { siblings: [] }).ok,
  false);

/* ────────────────────────────────────────────────────────────────
   B. buildCustomWeaponEntry：玩家寫什麼就是什麼
   ──────────────────────────────────────────────────────────────── */
const entry = buildCustomWeaponEntry(rustSword);

eq('B1 傷害式原樣保留（不是 HR + 5，也不是物理）', entry.damage, '【HR + 2】火');
eq('B2 價格原樣保留（不是定制武器的 300z）', entry.cost, 120);
eq('B3 單手就記單手（定制武器一律雙手）', entry.hands, 1);
eq('B4 命中檢定原樣保留', entry.attr, 'DEX + MIG');
eq('B5 類別與遠近原樣保留', [entry.category, entry.range], ['劍', '近戰']);
eq('B6 玩家寫的備註進得了效果欄，而且標明是自訂武器',
  [entry.note, entry.effectText], ['自訂武器：對亡靈額外 2 點傷害', '對亡靈額外 2 點傷害']);
eq('B7 沒有訂製能力就不該有訂製能力的旗標（物防提升／迅捷／可變形）',
  [entry.countsAsShield, entry.defBoost, entry.mdefBoost, entry.hasQuick, entry.isTransforming],
  [false, 0, 0, false, false]);
eq('B8 標記成自訂武器，換裝與匯出才找得到它',
  [entry.isCustomWeapon, entry.isFreeform, entry.customWeaponId], [true, true, rustSword.id]);

// 形狀必須與官方武器表一致——否則引擎、裝備挑選器、匯出會有一半吃不到。
// 這不是「值對不對」，是「欄位在不在」：用書上一把真的武器當對照組。
const bookWeapon = (rulesData.equipment.weapons || [])[0];
const requiredKeys = ['name', 'category', 'cost', 'hands', 'attr', 'damage', 'range'];
eq('B9 對照組：官方武器表讀得到（不然下面那條在驗空氣）', Boolean(bookWeapon?.name), true);
eq('B10 欄位與官方武器表一致（少一個欄位＝有一半的消費端吃不到）',
  requiredKeys.filter((key) => !(key in entry)), []);

// 對照組：定制武器那條路仍然套公式。兩條路都驗，才分得出「沒套公式」與「整支壞了」。
const forged = buildCustomWeaponEntry({
  id: 'cw1', name: '霜之刃', category: '劍', range: '近戰',
  accuracy: 'DEX + MIG', customizations: [], element: '', transformingId: ''
});
eq('B11 對照組：定制武器仍然是 300z／雙手／HR + 5',
  [forged.cost, forged.hands, forged.damage], [CUSTOM_WEAPON_BASE.cost, 2, '【HR + 5】物理']);

/* ────────────────────────────────────────────────────────────────
   C. 一行摘要：玩家最在意的是傷害式與價格
   ──────────────────────────────────────────────────────────────── */
const summary = describeCustomWeapon(rustSword);
eq('C1 摘要含傷害式（不含的話清單上只剩類別與遠近，看不出這把劍多強）',
  summary.includes('【HR + 2】火'), true);
eq('C2 摘要含單／雙手', summary.includes('單手'), true);
eq('C3 摘要含命中檢定', summary.includes('DEX + MIG'), true);
eq('C4 雙手時說雙手', describeCustomWeapon({ ...rustSword, hands: 2 }).includes('雙手'), true);

/* ────────────────────────────────────────────────────────────────
   D. 目錄條目：買得到、也換得回來
   ──────────────────────────────────────────────────────────────── */
const item = buildFreeformWeaponItem(rustSword);
eq('D1 剛寫好的一把 → 目錄條目（還沒買，所以 owned: false）',
  [item.name, item.cost, item.slot, item.owned], ['守墓人的鏽劍', 120, 'mainHand', false]);
eq('D2 目錄條目帶得回原規格（買的時候要一起存進角色）', item.spec, rustSword);

const withWeapon = attachCustomWeapon({ name: '測試角色', zenit: 500, customWeapons: [] }, rustSword);
const owned = buildOwnedWeaponItems(withWeapon);
eq('D3 買過的自由武器會出現在「已經有的」清單裡（不然換下來就再也裝不回去）',
  owned.map((i) => i.name), ['守墓人的鏽劍']);
eq('D4 已擁有的條目標成 owned（換上去不收費）', owned[0].owned, true);
eq('D5 自由武器與定制武器的標籤分開（玩家要知道哪一把是自己寫的）',
  [buildOwnedWeaponItems({ customWeapons: [rustSword] })[0].categoryLabel,
    buildOwnedWeaponItems({
      customWeapons: [{
        id: 'cw1', name: '霜之刃', category: '劍', range: '近戰',
        accuracy: 'DEX + MIG', customizations: [], element: '', transformingId: ''
      }]
    })[0].categoryLabel],
  ['自訂武器', '定制武器']);
eq('D6 沒有名字的規格不會變成清單上的一格空白',
  buildOwnedWeaponItems({ customWeapons: [blank] }).length, 0);
eq('D7 沒有 customWeapons 的角色也能問（不會炸）',
  buildOwnedWeaponItems({ name: '空角色' }), []);
// 清單上那一行是「標籤 · 說明」。說明如果直接放 `weapon.note`（它開頭就是
// 「自訂武器：」），會讀成「自訂武器 · 自訂武器：…」——標籤重複，而且最該看到的
// 規格被擠掉。這條是實機 S27 抓到的。
eq('D8 清單上的說明是規格摘要，不是再印一次「自訂武器」',
  [owned[0].detail.startsWith('自訂武器'), owned[0].detail.includes('【HR + 2】火'),
    owned[0].detail.includes('對亡靈額外 2 點傷害')],
  [false, true, true]);

/* ────────────────────────────────────────────────────────────────
   E. attachCustomWeapon：追加，不改原本那個角色
   ──────────────────────────────────────────────────────────────── */
const before = { name: '測試角色', customWeapons: [] };
const after = attachCustomWeapon(before, rustSword);
eq('E1 追加到陣列尾端', after.customWeapons.length, 1);
eq('E2 原本那個角色沒被改（React 靠物件換新才會重繪）', before.customWeapons.length, 0);
eq('E3 沒有 customWeapons 的角色也能接（舊存檔）',
  attachCustomWeapon({ name: '舊角色' }, rustSword).customWeapons.length, 1);

/* ────────────────────────────────────────────────────────────────
   F. 購買路徑：雙手自由武器要清副手
   ──────────────────────────────────────────────────────────────── */
const twoHanded = createFreeformWeaponSpec({
  name: '守墓人的巨鏟', category: '重型', range: '近戰', hands: 2,
  attr: 'MIG + MIG', damage: '【HR + 4】物理', cost: 200
});
const twoHandedItem = buildFreeformWeaponItem(twoHanded);
const holder = () => ({
  name: '測試角色',
  zenit: 500,
  equipment: { mainHand: '短匕首', offHand: '青銅圓盾', armor: '旅行者服', accessory: '' },
  customWeapons: [],
  log: []
});

// 對照組：**不**把那把武器補進 weaponMap。這正是「安靜地漏」的那個版本。
const withoutSpec = applyPurchase(holder(), twoHandedItem, {
  equip: true,
  slotLabel: '主手武器',
  resolveEquipment: (equipment, slot, name) => applyEquipmentChoice(equipment, slot, name, new Map())
});
eq('F1 對照組：沒補進 weaponMap 時副手不會被清（所以下面那條不是白過的）',
  [withoutSpec.character.equipment.offHand, withoutSpec.cleared], ['青銅圓盾', null]);

const withSpec = applyPurchase(holder(), twoHandedItem, {
  equip: true,
  slotLabel: '主手武器',
  resolveEquipment: (equipment, slot, name) => applyEquipmentChoice(
    equipment, slot, name,
    new Map([[twoHanded.name, buildCustomWeaponEntry(twoHanded)]])
  )
});
eq('F2 補進去之後：雙手武器佔滿兩個手部欄位，副手卸下',
  [withSpec.character.equipment.offHand, withSpec.cleared], ['無盾牌', '青銅圓盾']);
eq('F3 主手換成自己寫的那把', withSpec.character.equipment.mainHand, '守墓人的巨鏟');
eq('F4 錢真的扣了：500 - 200 = 300', withSpec.character.zenit, 300);
eq('F5 履歷用同一個裝備模板記（與書上的劍同一種寫法）',
  [withSpec.character.log[0].title, withSpec.character.log[0].kind], ['購入 守墓人的巨鏟', 'trade']);
// 買完之後「這把武器存在」必須有人記得——只留交易的話，換下來就找不回來了。
const persisted = attachCustomWeapon(withSpec.character, twoHanded);
eq('F6 同一次寫入裡把它存進 customWeapons（否則換下來就再也裝不回去）',
  buildOwnedWeaponItems(persisted).map((i) => i.name), ['守墓人的巨鏟']);

/* ────────────────────────────────────────────────────────────────
   G. 換裝彈窗的第四態：`owned`（有這一把，只是沒裝備）
   ──────────────────────────────────────────────────────────────── */
const ownedItem = buildOwnedWeaponItems({ customWeapons: [rustSword] })[0];
const heldChar = { equipment: { mainHand: '', offHand: '無盾牌', armor: '', accessory: '' } };

eq('G1 有這一把但沒裝備 → owned（不是 none：那會讓玩家再付一次錢）',
  describeHeldState(ownedItem, heldChar, 'mainHand').state, 'owned');
eq('G2 owned 說的是「你已經有這一把」（不是「已在副手」，那是位置）',
  describeHeldLabel({ state: 'owned', holders: [] }, 'mainHand'), '你已經有這一把，換上去不收費');
// 已擁有＝免費，而且**不管錢包剩多少**都免費。
// 第一版這裡餵的是 `affordable: true`——那時把 owned 那條分支拿掉也照樣回空字串，
// 於是這條斷言驗不出任何東西（MEMORY §A.2③：破壞點沒改行為）。
// 要餵「錢不夠」與「不知道有多少錢」才分得出差別。
eq('G3 owned 不需要理由——即使錢包不夠或未記錄，換上去也不收費',
  [
    describeSlotBlock({ hasSelection: true, held: { state: 'owned', holders: [] }, gate: { affordable: false, shortText: '還差 300z' } }),
    describeSlotBlock({ hasSelection: true, held: { state: 'owned', holders: [] }, gate: { affordable: null } })
  ],
  ['', '']);
// 四態的優先順序：已經裝著的 > 在別的槽 > 有但沒裝。
// 順序反了的話，裝在主手的武器會被說成「你已經有這一把」——那句話沒錯，
// 但它沒回答「那我現在裝著的是什麼」。
eq('G4 已裝備優先於 owned',
  describeHeldState({ ...ownedItem, name: '短匕首' },
    { equipment: { mainHand: '短匕首', offHand: '無盾牌' } }, 'mainHand').state, 'current');
eq('G5 在別的槽優先於 owned',
  describeHeldState({ ...ownedItem, name: '青銅圓盾' },
    { equipment: { mainHand: '', offHand: '青銅圓盾' } }, 'mainHand').state, 'elsewhere');

/* ────────────────────────────────────────────────────────────────
   H. 原始碼護欄（掃描）
   ──────────────────────────────────────────────────────────────── */
const purchaseSrc = readSrc('src/features/character-sheet/components/PurchaseModal.jsx');
const slotSrc = readSrc('src/features/character-sheet/components/EquipmentSlotModal.jsx');
const formSrc = readSrc('src/features/character-sheet/components/WeaponTemplateFields.jsx');
const hudSrc = readSrc('src/features/character-sheet/components/CharacterPlayHUD.jsx');
const editorSrc = readSrc('src/features/character-sheet/components/CharacterEditor.jsx');
const dataSrc = readSrc('src/features/character-sheet/data/customWeapons.js');

// 先確認掃到了東西（否則「零個違規」與「什麼都沒掃到」在輸出上長得一樣）。
eq('H0 對照組：六份原始碼都讀到了內容',
  [purchaseSrc.length > 3000, slotSrc.length > 3000, formSrc.length > 3000,
    hudSrc.length > 10000, editorSrc.length > 10000, dataSrc.length > 5000],
  [true, true, true, true, true, true]);

eq('H1 購買面板有「書上沒有這把」的出口', countOf(purchaseSrc, 'data-testid="purchase-cat-custom"'), 1);
eq('H2 那個出口切到表單模式（不是切到一個空分類）',
  [purchaseSrc.includes("setMode('custom')"), purchaseSrc.includes("mode === 'custom' && (")],
  [true, true]);
eq('H3 換裝彈窗也有出口', countOf(slotSrc, 'data-testid="slot-write-weapon"'), 1);
// 自由武器只可能是武器，所以只有接受武器的槽才給這個入口。
// 放在護甲槽會生出一個「寫一把劍然後裝到護甲」的畫面。
eq('H4 只有接受武器的槽才給「自己寫一把」',
  slotSrc.includes('const canWriteWeapon = slotAccepts('), true);
// 表單只負責填與驗：不寫存檔、不自己扣款、不自己接武器。
// （`onChange` 在 JSX 裡是輸入框的 DOM 事件，不是存檔出口——所以這裡驗的是
//   「它沒有呼叫寫入層」，不是「它沒有 onChange 這個字」。）
eq('H5 表單本身不寫存檔、不扣款、不接武器（它只負責填與驗）',
  [/localStorage/.test(formSrc), /applyPurchase|attachCustomWeapon|from '..\/utils\/moneyFlow'/.test(formSrc)],
  [false, false]);
eq('H6 表單的驗證與畫面共用同一份判定（不是畫面自己再寫一套）',
  countOf(formSrc, 'validateFreeformWeapon(spec)'), 1);
eq('H7 價格欄位保留空字串（把「還沒填」轉成 0 會讓它變成合法價格）',
  formSrc.includes("digits === '' ? '' : Number(digits)"), true);
eq('H8 履歷預覽走同一個模板（同一次購買不該有兩種寫法）',
  countOf(formSrc, 'describeEquipmentRecord('), 1);

// 兩個 host 都必須把規格注入 weaponMap，也都要把它存進角色。
eq('H9 兩個 host 都把剛寫好的武器補進 weaponMap（雙手武器才清得掉副手）',
  [countOf(hudSrc, 'buildCustomWeaponEntry(spec)'), countOf(editorSrc, 'buildCustomWeaponEntry(spec)')],
  [1, 1]);
eq('H10 兩個 host 都在同一次寫入裡存下規格',
  [countOf(hudSrc, 'attachCustomWeapon('), countOf(editorSrc, 'attachCustomWeapon(')], [1, 1]);
eq('H11 換裝彈窗把已擁有的武器也列進清單（不然清單裡沒有那個名字）',
  slotSrc.includes('buildOwnedWeaponItems(character)'), true);

/* ────────────────────────────────────────────────────────────────
   I. SSR 煙霧：表單真的畫得出來
   ──────────────────────────────────────────────────────────────── */
const noop = () => {};
const renderForm = (wallet) => renderToStaticMarkup(
  React.createElement(WeaponTemplateFields, { theme: {}, wallet, onSubmit: noop, onBack: noop })
);
const formHtml = renderForm(500);
const formNoWallet = renderForm(undefined);

eq('I1 四格核心資訊都在畫面上（名稱／價格／命中／傷害）',
  ['name', 'cost', 'attr', 'damage'].map((k) => formHtml.includes(`data-testid="weapon-template-${k}"`)),
  [true, true, true, true]);
eq('I2 一打開就說「請為這把武器命名」（不是等按下才說）',
  formHtml.includes('請為這把武器命名'), true);
eq('I3 空白時送出鈕是 aria-disabled，而且不是 disabled（disabled 會吃掉 title）',
  [formHtml.includes('aria-disabled="true"'), /\sdisabled(?:=""|\s|>)/.test(formHtml)],
  [true, false]);
eq('I4 履歷預覽那一格存在（按之前就看得到它會被記成什麼）',
  formHtml.includes('data-testid="weapon-template-record-title"'), true);
// 空白表單的**第一句話**必須是「請命名」，不是「沒錢」。
// 錢包未記錄時更容易錯：那時它什麼都不知道，卻很容易被寫成「資金不足」。
// （四句話的完整對照在 I7；這裡驗的是「畫面上先出現哪一句」。）
eq('I5 錢包未記錄＋表單空白 → 先說「請命名」，不指控沒錢',
  [formNoWallet.includes('請為這把武器命名'), formNoWallet.includes('資金不足')],
  [true, false]);
eq('I6 錢包有記錄時不印那句話（對照組）',
  formHtml.includes('錢包金額尚未記錄'), false);

// 四種「為什麼不能按」必須是四句話——併成一句的話，
// 填錯一格會被說成沒錢（與結帳鈕同一個原則）。
const gateOk = describePurchase({ price: 120, wallet: 500 });
const gateShort = describePurchase({ price: 900, wallet: 500 });
const gateUnknown = describePurchase({ price: 120, wallet: undefined });
eq('I7 四種狀態四句話（缺欄位／不知道錢包／不夠／可以）',
  [
    describeTemplateBlock({ issues: [{ field: 'name', message: '請為這把武器命名' }], gate: gateOk }),
    describeTemplateBlock({ issues: [], gate: gateUnknown }),
    describeTemplateBlock({ issues: [], gate: gateShort }),
    describeTemplateBlock({ issues: [], gate: gateOk })
  ],
  ['請為這把武器命名', '錢包金額尚未記錄，無法結帳', `資金不足：${gateShort.shortText}`, '']);
eq('I8 填完而且買得起 → 沒有理由（空字串，不是「可以買」）',
  describeTemplateBlock({ issues: [], gate: describePurchase({ price: 0, wallet: 500 }) }), '');

/* ────────────────────────────────────────────────────────────────
   Z. 斷言器自我體檢
   ──────────────────────────────────────────────────────────────── */
const beforeCount = results.length;
eq('__selfcheck__', 1, 2);
const selfOk = results.length === beforeCount + 1 && results[results.length - 1].ok === false;
results.pop();
eq('Z1 斷言器本身會紅（餵不相等的值必須回 false）', selfOk, true);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  「開放自由模板」不是多一格輸入框，是玩家寫的字不會被公式改掉。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
