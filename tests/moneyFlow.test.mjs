/**
 * 金錢的寫入層與兩個新入口（P9-b，2026-10-31）
 *
 * 執行：`npm run test:moneyflow`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者的原話：
 *   「全部走購買面板，必須讓玩家感受到金錢有在流動。點了之後也要跳出提示，
 *     不止是記錄在案而已。然後跑團卡也要有消耗金錢的地方。要讓玩家寫是花費／
 *     增加金錢是什麼原因，如果是裝備的話就要給一個模板，讓玩家可以把買到的裝備
 *     以正確的格式記錄在案。然後背包也要可以選到所有的裝備。」
 *
 * 六句話拆成六個可驗的命題：
 *   1. 三個入口（購買面板／收支對話框／編輯器）共用**同一支**寫入函式  → C 段
 *   2. 扣款、換裝、留痕在**同一次寫入**裡完成                          → C 段
 *   3. 每次動作都要有 toast，而且 toast 要說「還剩多少」                → E 段
 *   4. 跑團中有「有原因的收支」這個動作                                → D 段
 *   5. 裝備用**同一個模板**記錄（不是三處各寫一種格式）                → A 段
 *   6. 行囊分頁四個槽可以換，而且列得出全部可購買裝備                  → F 段
 *
 * ── 為什麼要特別驗「同一個物件」而不是「值相同」 ──────────────
 *
 * `applyPurchase` 在買不起時回傳的是**原本那個物件**（`===`）。
 * 驗 `deepEqual` 的話，「回傳一個內容一樣的新物件」也會過，
 * 但那個新物件帶著新的 `updatedAt`，寫回去就是一次假的存檔
 * （而且會觸發一次多餘的 render）。所以 C2 用嚴格相等。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  describeEquipmentRecord,
  describeMoneyFlow,
  MONEY_DIRECTIONS,
  DIRECTION_LABELS
} from '../src/features/character-sheet/utils/zenitFeedback.js';
import {
  applyPurchase,
  applyMoneyFlow,
  describeMoneyToast
} from '../src/features/character-sheet/utils/moneyFlow.js';
import {
  slotAccepts,
  catalogForSlot,
  describeHeldState,
  describeHeldLabel,
  describeSlotBlock,
  EquipmentSlotModalBody
} from '../src/features/character-sheet/components/EquipmentSlotModal.jsx';
import {
  MONEY_FLOW_PRESETS,
  describeReasonHint,
  MoneyFlowModalBody
} from '../src/features/character-sheet/components/MoneyFlowModal.jsx';
import {
  buildPurchaseCatalog,
  PURCHASE_CATEGORIES
} from '../src/features/character-sheet/components/PurchaseModal.jsx';
import { EQUIPMENT_SLOTS } from '../src/features/character-sheet/utils/equipmentRules.js';
import { LOG_KINDS } from '../src/features/character-sheet/utils/characterLog.js';

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
   A. describeEquipmentRecord：裝備的「正確格式」只有這一份
   ──────────────────────────────────────────────────────────────── */

const bronzeSword = {
  name: '青銅劍',
  cost: 200,
  slot: 'mainHand',
  detail: '近戰武器 · DEX + MIG · 【HR + 0】物理'
};

eq('A1 標題是「購入 ＋ 品名」（不寫金額——金額在 changes 那一行）',
  describeEquipmentRecord(bronzeSword).title, '購入 青銅劍');
// 順序是規格 → 價格 → 去向。價格放中間是因為它最短；
// 放最後會讓「裝備到主手武器」被擠到看不見的地方。
eq('A2 note 的順序是規格 → 價格（沒裝備就不寫去向）',
  describeEquipmentRecord(bronzeSword).note,
  '近戰武器 · DEX + MIG · 【HR + 0】物理 · 200z');
eq('A3 有裝備時，去向接在價格後面',
  describeEquipmentRecord(bronzeSword, { equip: true, slotLabel: '主手武器' }).note,
  '近戰武器 · DEX + MIG · 【HR + 0】物理 · 200z · 裝備到主手武器');
// equip 為真但沒有槽位名 → 不寫「裝備到」。半句話比沒有更糟。
eq('A4 沒有槽位名就不寫去向（不印「裝備到undefined」）',
  describeEquipmentRecord(bronzeSword, { equip: true, slotLabel: '' }).note,
  '近戰武器 · DEX + MIG · 【HR + 0】物理 · 200z');
eq('A5 沒有 detail 的品項只留價格（不留一個開頭的「 · 」）',
  describeEquipmentRecord({ name: '短匕首', cost: 150 }).note, '150z');
eq('A6 沒有品項回空殼，不是「購入 undefined」',
  describeEquipmentRecord(null), { title: '', note: '' });
eq('A7 沒有名字也回空殼', describeEquipmentRecord({ cost: 100 }), { title: '', note: '' });

/* ────────────────────────────────────────────────────────────────
   B. describeMoneyFlow：金額、原因、錢包三格各自判定
   ──────────────────────────────────────────────────────────────── */
const flow = (input) => describeMoneyFlow(input);
const spend = (amount, reason, wallet) => flow({
  direction: MONEY_DIRECTIONS.spend, amount, reason, wallet
});
const gain = (amount, reason, wallet) => flow({
  direction: MONEY_DIRECTIONS.gain, amount, reason, wallet
});

eq('B1 支出：算式寫出來（玩家要確認的是「這筆之後還剩多少」）',
  spend(50, '住宿', 500).mathText, '500z - 50z = 450z');
eq('B2 支出：餘額', spend(50, '住宿', 500).next, 450);
eq('B3 支出：標題是「支出 · 原因」', spend(50, '住宿', 500).title, '支出 · 住宿');
eq('B4 獲得：算式是加法', gain(500, '任務報酬', 500).mathText, '500z + 500z = 1,000z');
eq('B5 獲得：餘額', gain(500, '任務報酬', 500).next, 1000);
eq('B6 獲得：標題是「獲得 · 原因」', gain(500, '任務報酬', 500).title, '獲得 · 任務報酬');
eq('B7 可以寫的時候 ok 為 true', [spend(50, '住宿', 500).ok, gain(500, '報酬', 500).ok], [true, true]);

// 金額：`''` 是「還沒填」，`0` 是「填了 0」——兩句話，但都不是一筆收支。
eq('B8 沒填金額 → 請填金額', spend('', '住宿', 500).errors.amount, '請填金額');
eq('B9 金額 0 不是一筆收支', spend(0, '住宿', 500).errors.amount, '金額要大於 0');
eq('B10 負數也不行（方向已經由「支出／獲得」決定，不需要負號）',
  spend(-50, '住宿', 500).errors.amount, '金額要大於 0');
eq('B11 金額字串可以收（輸入框給的是字串）', spend('50', '住宿', 500).next, 450);
eq('B12 金額是全形數字以外的雜訊 → 當作沒填', spend('五十', '住宿', 500).errors.amount, '請填金額');

// 原因：必填。使用者明說「要讓玩家寫是花費／增加金錢是什麼原因」。
eq('B13 沒寫原因 → 擋下來', spend(50, '', 500).errors.reason, '請寫下這筆錢的原因');
eq('B14 只有空白也算沒寫', spend(50, '   ', 500).errors.reason, '請寫下這筆錢的原因');
eq('B15 原因前後的空白會修掉', spend(50, '  住宿  ', 500).reason, '住宿');

// 三個錯誤各自獨立——畫面上要分別標紅那一格。
// 全部擠在底部一行「請填寫完整」等於沒說哪裡沒填。
const bothEmpty = spend('', '', 500);
eq('B16 金額與原因同時沒填 → 兩個錯誤都在',
  [bothEmpty.errors.amount, bothEmpty.errors.reason],
  ['請填金額', '請寫下這筆錢的原因']);
eq('B17 有錯誤時沒有標題（不要留半句話）', bothEmpty.title, '');
eq('B18 有錯誤時算不出餘額', bothEmpty.next, null);

// 錢包：只有**支出**需要看。沒有人在收到錢之前檢查錢包。
eq('B19 支出不足 → 說還差多少', spend(800, '修裝', 500).errors.wallet, '資金不足：還差 300z');
eq('B20 支出不足 → ok 為 false', spend(800, '修裝', 500).ok, false);
eq('B21 支出時錢包未記錄 → 說「未記錄」，不是「不夠」',
  spend(50, '住宿', null).errors.wallet, '錢包金額尚未記錄，無法記帳');
// 對照組：同樣的錢包未記錄，**獲得**不該報錯（B22 與 B21 是一對）。
eq('B22 獲得時錢包未記錄不擋（收錢不需要先有錢包）',
  gain(500, '報酬', null).errors.wallet, '');
eq('B23 獲得時錢包未記錄仍然算不出餘額（不知道起點就不知道終點）',
  [gain(500, '報酬', null).next, gain(500, '報酬', null).mathText], [null, '']);
eq('B24 支出剛好付完（500-500）可以記，餘 0',
  [spend(500, '住宿', 500).ok, spend(500, '住宿', 500).next], [true, 0]);

// 空值語意：沒給方向時預設支出，不是「不確定」。
// `isSpend: false` 讀不出是「獲得」還是「沒填」，所以方向用字串常數。
eq('B25 沒給方向預設為支出', flow({ amount: 50, reason: '住宿', wallet: 500 }).direction,
  MONEY_DIRECTIONS.spend);
eq('B26 方向標籤只有兩個', Object.keys(DIRECTION_LABELS).sort(), ['gain', 'spend']);
// 餘額與算式只看金額與錢包，**不看原因**。
// 第一版把「有沒有錯誤」整個算進來，於是「填了 50、還沒寫原因」時算式是空的——
// 而那正是玩家最想知道「這筆之後還剩多少」的一刻。這是實機跑出來才發現的。
eq('B27 原因還沒填，算式照樣算（玩家要先看到餘額）',
  [spend(50, '', 500).mathText, spend(50, '', 500).ok], ['500z - 50z = 450z', false]);
eq('B28 但沒填原因仍然不能寫入', spend(50, '', 500).errors.reason, '請寫下這筆錢的原因');
eq('B29 金額沒填時仍然算不出來（沒有金額就沒有算式）',
  [spend('', '住宿', 500).mathText, spend('', '住宿', 500).next], ['', null]);
// 對照組：資金不足時不硬算（會得到負數），由 errors.wallet 說「還差多少」。
eq('B30 資金不足時算式留空，交給「還差多少」那句話',
  [spend(800, '修裝', 500).mathText, spend(800, '修裝', 500).errors.wallet],
  ['', '資金不足：還差 300z']);

/* ────────────────────────────────────────────────────────────────
   C. applyPurchase：扣款 ＋ 換裝 ＋ 留痕，同一次寫入
   ──────────────────────────────────────────────────────────────── */
const baseChar = () => ({
  name: '測試角色',
  zenit: 500,
  equipment: { mainHand: '短匕首', offHand: '無盾牌', armor: '旅行者服', accessory: '' },
  log: []
});

const sword = { name: '青銅劍', cost: 200, slot: 'mainHand', detail: '近戰武器 · DEX + MIG' };
const dagger = { name: '短匕首', cost: 150, slot: 'mainHand', detail: '匕首' };
const greatsword = { name: '雙手劍', cost: 300, slot: 'mainHand', detail: '重型 · 雙手' };
const buckler = { name: '小圓盾', cost: 100, slot: 'offHand', detail: '盾牌' };

const c1 = applyPurchase(baseChar(), sword, { equip: true, slotLabel: '主手武器' });
eq('C1 扣款：500 - 200 = 300', c1.character.zenit, 300);
eq('C2 換裝：主手變成青銅劍', c1.character.equipment.mainHand, '青銅劍');
eq('C3 其他槽不受影響', [c1.character.equipment.offHand, c1.character.equipment.armor],
  ['無盾牌', '旅行者服']);
eq('C4 留痕：一筆 trade，標題用模板', 
  [c1.character.log.length, c1.character.log[0].kind, c1.character.log[0].title],
  [1, 'trade', '購入 青銅劍']);
eq('C5 履歷的 changes 同時記錢與槽位（同一次動作，不拆兩筆）',
  c1.character.log[0].changes.map((c) => c.field).sort(), ['mainHand', 'zenit']);
eq('C6 回報 spent（toast 要用）', c1.spent, 200);

// 買不起：**原樣回傳同一個物件**。驗 `===` 而不是 deepEqual——
// 回一個內容一樣的新物件會帶著新的 updatedAt，寫回去就是一次假存檔。
const broke = { ...baseChar(), zenit: 100 };
const c2 = applyPurchase(broke, sword, { equip: true });
eq('C7 買不起 → ok 為 false', c2.ok, false);
eq('C8 買不起 → 原樣回傳同一個物件（不製造假存檔）', c2.character === broke, true);
eq('C9 買不起 → 沒有寫任何履歷', c2.character.log.length, 0);
eq('C10 買不起 → 仍然回報差多少（toast 要說這句）', c2.gate.shortText, '還差 100z');

// 錢包未記錄：擋，但**不是**說「買不起」（那是斷言一件我們不知道的事）。
const c3 = applyPurchase({ ...baseChar(), zenit: undefined }, sword, { equip: true });
eq('C11 錢包未記錄 → 擋下來', c3.ok, false);
eq('C12 錢包未記錄 → affordable 是 null（不是 false）', c3.gate.affordable, null);

eq('C13 不裝備時 equipment 完全不動',
  applyPurchase(baseChar(), sword, { equip: false }).character.equipment.mainHand, '短匕首');
eq('C14 不裝備時履歷只有錢',
  applyPurchase(baseChar(), sword, { equip: false }).character.log[0].changes.map((c) => c.field),
  ['zenit']);

// 主手放盾（守護者【雙重盾牌】）：目錄上的 slot 是 offHand，玩家要放的是 mainHand。
const c15 = applyPurchase(baseChar(), buckler, { equip: true, slot: 'mainHand', slotLabel: '主手武器' });
eq('C15 slot 覆寫生效（盾牌進主手，不是副手）',
  [c15.character.equipment.mainHand, c15.character.equipment.offHand], ['小圓盾', '無盾牌']);

// 雙手武器：副手必須空出。這條規則住在 equipmentRules，由呼叫端傳進來。
const twoHanded = (equipment, slot, name) => {
  const next = { ...equipment, [slot]: name };
  let clearedOffHand = null;
  if (slot === 'mainHand' && name === '雙手劍') {
    if (next.offHand && next.offHand !== '無盾牌') {
      clearedOffHand = next.offHand;
      next.offHand = '無盾牌';
    }
  }
  return { equipment: next, clearedOffHand };
};
const withShield = { ...baseChar(), equipment: { ...baseChar().equipment, offHand: '小圓盾' } };
const c16 = applyPurchase(withShield, greatsword, { equip: true, resolveEquipment: twoHanded });
eq('C16 雙手武器會清空副手', c16.character.equipment.offHand, '無盾牌');
eq('C17 清空副手要回報（toast 要說「玩家沒要求但規則替他做了」）', c16.cleared, '小圓盾');
eq('C18 清空副手也要進履歷（不然看不出副手為什麼空了）',
  c16.character.log[0].changes.map((c) => c.field).sort(), ['mainHand', 'offHand', 'zenit']);

// 不合併：兩次購買是兩件事（`trade` 的 coalesce 是 0）。
const c19 = applyPurchase(applyPurchase(baseChar(), sword, { equip: false }).character, dagger, { equip: false });
eq('C19 連續兩次購買留下兩筆（合併會吃掉「買了哪兩樣」）',
  [c19.character.log.length, c19.character.log.map((e) => e.title)],
  [2, ['購入 青銅劍', '購入 短匕首']]);
eq('C20 trade 的 coalesce 是 0（不是 120000）', LOG_KINDS.trade.coalesce, 0);

/* ────────────────────────────────────────────────────────────────
   D. applyMoneyFlow：有原因的收支
   ──────────────────────────────────────────────────────────────── */
const d1 = applyMoneyFlow(baseChar(), { direction: 'spend', amount: 50, reason: '住宿' });
eq('D1 支出：500 - 50 = 450', d1.character.zenit, 450);
eq('D2 支出：履歷標題「支出 · 住宿」', d1.character.log[0].title, '支出 · 住宿');
eq('D3 支出：履歷 kind 也是 trade（同一種事件，同一種記法）', d1.character.log[0].kind, 'trade');

const d4 = applyMoneyFlow(baseChar(), { direction: 'gain', amount: 500, reason: '任務報酬' });
eq('D4 獲得：500 + 500 = 1000', d4.character.zenit, 1000);
eq('D5 獲得：履歷標題「獲得 · 任務報酬」', d4.character.log[0].title, '獲得 · 任務報酬');

// 原因必填是這一輪的硬需求。
const d6 = applyMoneyFlow(baseChar(), { direction: 'spend', amount: 50, reason: '' });
eq('D6 沒有原因 → 不寫入', [d6.ok, d6.character.log.length], [false, 0]);
eq('D7 沒有原因 → 回傳原物件（同 applyPurchase 的理由）',
  d6.character.zenit, 500);

// 買裝備時，模板負責格式、玩家的話負責內容。**模板不是內容。**
const d8 = applyMoneyFlow(baseChar(), {
  direction: 'spend', amount: 200, reason: '老闆算我便宜，因為我幫他找回走失的貓',
  item: sword, equip: true, slotLabel: '主手武器'
});
eq('D8 有裝備時標題走模板', d8.character.log[0].title, '購入 青銅劍');
eq('D9 玩家的原因不會被模板吃掉',
  d8.character.log[0].note.includes('老闆算我便宜'), true);
eq('D10 模板的規格與價格仍然在 note 裡',
  [d8.character.log[0].note.includes('近戰武器'), d8.character.log[0].note.includes('200z')],
  [true, true]);
// 對照組：原因**就是**品名（對話框自動填的預設值）時不重複印。
const d11 = applyMoneyFlow(baseChar(), {
  direction: 'spend', amount: 200, reason: '青銅劍', item: sword, equip: true, slotLabel: '主手武器'
});
eq('D11 原因等於品名時不印成「購入 青銅劍 · 青銅劍」',
  countOf(d11.character.log[0].note, '青銅劍'), 0);

eq('D12 有裝備時 equipment 也會更新', d8.character.equipment.mainHand, '青銅劍');
eq('D13 回報 spent（toast 用）', d8.spent, 200);

/* ────────────────────────────────────────────────────────────────
   E. describeMoneyToast：三件事要在同一句話裡講完
   ──────────────────────────────────────────────────────────────── */
eq('E1 購買：買了什麼 → 錢動多少 → 還剩多少',
  describeMoneyToast(c1), '購入【青銅劍】-200z，餘 300z');
eq('E2 支出：同樣三件事，用「支出【原因】」',
  describeMoneyToast(d1), '支出【住宿】-50z，餘 450z');
eq('E3 獲得帶 +（不是把收入印成扣款）',
  describeMoneyToast(d4), '獲得【任務報酬】+500z，餘 1,000z');
eq('E4 沒成功就沒有話說（不印半句）',
  describeMoneyToast({ ok: false }), '');
eq('E5 錢包不知道時不編一個數字（印破折號）',
  describeMoneyToast({ ok: true, character: {}, flow: { direction: 'gain', amount: 500, reason: '報酬' } }),
  '獲得【報酬】+500z，餘 —');

/* ────────────────────────────────────────────────────────────────
   F. 行囊分頁的單槽選擇器
   ──────────────────────────────────────────────────────────────── */
const catalog = buildPurchaseCatalog();
const catOf = (id) => PURCHASE_CATEGORIES.find((c) => c.id === id);

eq('F1 主手接受武器', slotAccepts(catOf('weapons'), 'mainHand'), true);
// 守護者【雙重盾牌】：主手也能放盾。少了這一條，「把盾換到主手」會找不到任何品項。
eq('F2 主手也接受盾（守護者雙盾）', slotAccepts(catOf('shields'), 'mainHand'), true);
eq('F3 副手接受盾', slotAccepts(catOf('shields'), 'offHand'), true);
eq('F4 主手不接受防具', slotAccepts(catOf('armors'), 'mainHand'), false);
eq('F5 飾品只進飾品槽', [slotAccepts(catOf('accessories'), 'accessory'),
  slotAccepts(catOf('accessories'), 'armor')], [true, false]);

const mainHandOptions = catalogForSlot(catalog, 'mainHand');
const armorOptions = catalogForSlot(catalog, 'armor');
eq('F6 主手清單＝武器 ＋ 盾牌（兩類相加，不多不少）',
  mainHandOptions.length,
  catalog.filter((i) => i.categoryId === 'weapons' || i.categoryId === 'shields').length);
eq('F7 主手清單裡真的有盾牌',
  mainHandOptions.some((i) => i.categoryId === 'shields'), true);
eq('F8 防具槽只有防具', armorOptions.every((i) => i.categoryId === 'armors'), true);
// 使用者要的是「選得到**所有**的裝備」——所以清單不能是空的，也不能只有幾件。
eq('F9 四個槽的清單都不是空的', ['mainHand', 'offHand', 'armor', 'accessory']
  .map((s) => catalogForSlot(catalog, s).length > 0), [true, true, true, true]);
eq('F10 可購買裝備總數大於 50（不是只列幾件）', catalog.length > 50, true);
// 空槽位的替身（徒手打擊／無盾牌／無裝甲）不是商品，不該出現在清單裡。
eq('F11 空槽替身不在清單裡（0z 的「空手」不是商品）',
  catalog.some((i) => ['徒手打擊', '無盾牌', '無裝甲', '無'].includes(i.name)), false);

const held = { equipment: { mainHand: '青銅劍', offHand: '小圓盾', armor: '旅行者服', accessory: '' } };
eq('F12 裝在這個槽 → current',
  describeHeldState({ name: '青銅劍' }, held, 'mainHand').state, 'current');
eq('F13 裝在別的槽 → elsewhere（按下去是搬家，不是購買）',
  describeHeldState({ name: '小圓盾' }, held, 'mainHand').state, 'elsewhere');
eq('F14 沒有 → none', describeHeldState({ name: '雙手劍' }, held, 'mainHand').state, 'none');
// 三態不得併成兩態：`current` 與 `elsewhere` 在畫面上是兩句不同的話。
eq('F15 三態真的有三個不同的值',
  new Set([
    describeHeldState({ name: '青銅劍' }, held, 'mainHand').state,
    describeHeldState({ name: '小圓盾' }, held, 'mainHand').state,
    describeHeldState({ name: '雙手劍' }, held, 'mainHand').state
  ]).size, 3);
eq('F16 目前裝備那句話', describeHeldLabel({ state: 'current', holders: ['mainHand'] }, 'mainHand'), '目前裝備');
eq('F17 在別的槽時說「換過來不收費」（不然玩家會以為要再付一次）',
  describeHeldLabel({ state: 'elsewhere', holders: ['offHand'] }, 'mainHand'),
  '已在副手武裝，換過來不收費');
eq('F18 沒有的時候不說話（右邊已經印了價格）', describeHeldLabel({ state: 'none', holders: [] }, 'mainHand'), '');

// 四種狀態四句話。第三與第四句一定要分開——錢包未記錄時說「資金不足」
// 是在指控玩家沒錢，而它其實什麼都不知道（MEMORY §D.21）。
eq('F19 還沒選 → 說「先選」，不是「沒錢」',
  describeSlotBlock({ hasSelection: false }), '先選一件裝備');
eq('F20 已經裝在這裡 → 說「已經裝在這裡」，不是「買不起」',
  describeSlotBlock({ hasSelection: true, held: { state: 'current', holders: ['mainHand'] }, gate: { affordable: true } }),
  '這一件已經裝在這裡了');
eq('F21 在別的槽 → 沒有理由（搬家是免費的）',
  describeSlotBlock({ hasSelection: true, held: { state: 'elsewhere', holders: ['offHand'] }, gate: { affordable: false, shortText: '還差 100z' } }),
  '');
eq('F22 錢包未記錄 → 說「未記錄」（不指控買不起）',
  describeSlotBlock({ hasSelection: true, held: { state: 'none', holders: [] }, gate: { affordable: null } }),
  '錢包金額尚未記錄，無法結帳');
eq('F23 真的不夠 → 才說「資金不足」',
  describeSlotBlock({ hasSelection: true, held: { state: 'none', holders: [] }, gate: { affordable: false, shortText: '還差 300z' } }),
  '資金不足：還差 300z');
eq('F24 買得起 → 沒有理由（空字串，不是「可以買」）',
  describeSlotBlock({ hasSelection: true, held: { state: 'none', holders: [] }, gate: { affordable: true } }), '');

/* ────────────────────────────────────────────────────────────────
   G. SSR 煙霧：兩個新彈窗真的畫得出來
   ──────────────────────────────────────────────────────────────── */
const noop = () => {};
const renderSlot = (character, slot, wallet) => renderToStaticMarkup(
  React.createElement(EquipmentSlotModalBody, {
    theme: {}, character, slot, wallet, onConfirm: noop, onClose: noop
  })
);
const slotHtml = renderSlot({ ...held, zenit: 500 }, 'mainHand', 500);

eq('G1 換裝彈窗畫得出來，而且有錢包與清單',
  [slotHtml.includes('data-testid="slot-wallet"'), slotHtml.includes('data-testid="slot-list"')],
  [true, true]);
eq('G2 錢包金額有畫出來', slotHtml.includes('500z'), true);
// 主手清單要有盾牌（F2 的畫面版）：規則對但畫不出來等於沒做。
eq('G3 主手清單裡看得到盾牌', slotHtml.includes('青銅圓盾'), true);
eq('G4 目前裝備那一件標「目前裝備」', slotHtml.includes('目前裝備'), true);
// 不用 `disabled` 屬性：它會吃掉 `title` 也拿不到焦點。
// 驗 `/\sdisabled(=""|\s|>)/` 而不是 `includes('disabled')`——
// JRPGButton 的 class 裡本來就有 `disabled:opacity-50`，後者永遠為真（MEMORY §C.15）。
eq('G5 還沒選東西時，按鈕是 aria-disabled（不是 disabled）',
  [slotHtml.includes('aria-disabled="true"'), /\sdisabled(?:=""|\s|>)/.test(slotHtml)],
  [true, false]);
eq('G6 沒選東西時說「先選一件裝備」', slotHtml.includes('先選一件裝備'), true);
// 錢包未記錄 → 印破折號，不是 0z。`0z` 是一句斷言（你真的沒錢），`—` 是一句實話。
// 要**取出那一格的值**再比，不能 `includes('0z')`——`100z` 裡面也有 `0z`。
const walletText = (html) => {
  const m = html.match(/data-testid="slot-wallet">([^<]*)</);
  return m ? m[1] : null;
};
eq('G7 錢包未記錄時印破折號（不是 0z）',
  [walletText(renderSlot(held, 'mainHand', null)), walletText(renderSlot(held, 'mainHand', 0))],
  ['—', '0z']);

const flowHtml = renderToStaticMarkup(
  React.createElement(MoneyFlowModalBody, {
    theme: {}, character: baseChar(), wallet: 500, onConfirm: noop, onClose: noop
  })
);
eq('G8 收支彈窗畫得出來：金額、原因、方向三格都在',
  ['data-testid="moneyflow-amount"', 'data-testid="moneyflow-reason"',
    'data-testid="moneyflow-direction-spend"', 'data-testid="moneyflow-direction-gain"']
    .map((t) => flowHtml.includes(t)), [true, true, true, true]);
eq('G9 一打開就說「請填金額」與「請寫下原因」（不是等按下才說）',
  [flowHtml.includes('請填金額'), flowHtml.includes('請寫下這筆錢的原因')], [true, true]);
eq('G10 沒填完時按鈕是 aria-disabled', flowHtml.includes('aria-disabled="true"'), true);
eq('G11 履歷預覽那一格存在（模板要在按之前看見）',
  flowHtml.includes('data-testid="moneyflow-record-title"'), true);
eq('G12 裝備模板預設是關的（不勾就不會突然多一件裝備）',
  flowHtml.includes('data-testid="moneyflow-item-toggle"') &&
  !flowHtml.includes('data-testid="moneyflow-item"'), true);

/* ────────────────────────────────────────────────────────────────
   H. 結構護欄（掃原始碼）
   ──────────────────────────────────────────────────────────────── */
const hudSrc = readSrc('src/features/character-sheet/components/CharacterPlayHUD.jsx');
const editorSrc = readSrc('src/features/character-sheet/components/CharacterEditor.jsx');
const moneySrc = readSrc('src/features/character-sheet/utils/moneyFlow.js');

// 先確認「掃到了東西」——否則「掃到零個違規」與「什麼都沒掃到」在輸出上長得一樣。
eq('H0 對照組：三份原始碼都讀到了內容',
  [hudSrc.length > 10000, editorSrc.length > 10000, moneySrc.length > 2000],
  [true, true, true]);

// 寫入層不碰儲存、不碰 React、不呼叫 onChange——它只回傳新的角色。
eq('H1 moneyFlow 不碰 localStorage／React／onChange',
  [/localStorage/.test(moneySrc), /from 'react'/.test(moneySrc), /\bonChange\b/.test(moneySrc)],
  [false, false, false]);

// 三個入口共用同一支。
eq('H2 面板與編輯器都呼叫 applyPurchase（不是各寫一份）',
  [countOf(hudSrc, 'applyPurchase('), countOf(editorSrc, 'applyPurchase(')], [1, 1]);
eq('H3 面板呼叫 applyMoneyFlow', countOf(hudSrc, 'applyMoneyFlow('), 1);

// 行囊分頁的四個槽是**按鈕**，不是唯讀文字。
// 用「由 EQUIPMENT_SLOTS 逐一生成」而不是「列了四個 testid」：
// 後者守不住「有人刪掉飾品那一格」，前者是結構性的——四個槽共用同一個出口。
eq('H4 四個槽由同一個出口生成（不是四個手寫的 div）',
  [countOf(hudSrc, 'data-testid={`pack-slot-${slotKey}`}'),
    hudSrc.includes('Object.keys(EQUIPMENT_SLOTS).map((slotKey)')],
  [1, true]);
// 舊的唯讀寫法不得回來（`主手武器:` 這種標籤後面直接接值）。
eq('H5 舊的唯讀四行沒有回來',
  [/主手武器:\s*<strong>/.test(hudSrc), /副手武裝:\s*<strong>/.test(hudSrc)], [false, false]);
eq('H6 行囊分頁也有收支入口', countOf(hudSrc, 'data-testid="pack-money-flow"'), 1);
eq('H7 主面板的收支入口存在', countOf(hudSrc, 'data-testid="open-money-flow"'), 1);

// 編輯器：四張卡片走 `openSlot`，而 `openSlot` 依 `walletSettled` 分流。
eq('H8 四張裝備卡片都走 openSlot（不是直接開預算挑選器）',
  ['mainHand', 'offHand', 'armor', 'accessory']
    .map((k) => editorSrc.includes(`openSlot('${k}')`)), [true, true, true, true]);
eq('H9 openSlot 依「起始資金結算了沒有」分流',
  [editorSrc.includes('if (walletSettled) setBuySlot(slotKey);'),
    editorSrc.includes('else setPickerSlot(slotKey);')],
  [true, true]);
eq('H10 walletSettled 的來源是 startingFundsRolled',
  countOf(editorSrc, 'character.startingFundsRolled === true'), 1);
// 結算之後不能再有「擲 2d6 結算」——那會讓玩家重擲一次起始資金。
eq('H11 已結算時不再顯示「擲 2d6 × 10 結算」按鈕',
  editorSrc.includes('{!walletSettled && ('), true);
eq('H12 已結算時那一段改口說明「換裝備改由錢包扣款」',
  editorSrc.includes('之後換裝備改由錢包扣款'), true);
// 文案改口了，但上面那兩個數字還在算「預算」——於是同一張卡上出現兩個錢：
// 「剩餘 250z」與「錢包 380z」，而其中一個是假的（P9-c 實機量測抓到的）。
eq('H14 已結算時「剩餘: Nz」那一格換成錢包（同一張卡不能有兩個錢）',
  [editorSrc.includes('walletSettled ? ('), countOf(editorSrc, '剩餘: {remainingBudget}z')],
  [true, 1]);

// `describeHeldLabel` 一定要**被畫出來**。
// 第一版匯出了它卻沒有在 JSX 裡用——於是「已在副手武裝，換過來不收費」這句話
// 從來沒有出現過，而列上只寫「已持有」，沒有回答「要不要付錢」。
// 這是實機驗證抓到的（S33）：純函式的斷言全綠，因為它驗的是函式本身。
const slotModalSrc = readSrc('src/features/character-sheet/components/EquipmentSlotModal.jsx');
eq('H13 「換過來不收費」真的畫在畫面上（不只是匯出了一個函式）',
  [countOf(slotModalSrc, 'describeHeldLabel(held, slot)'),
    countOf(slotModalSrc, 'data-testid="slot-held-label"')],
  [1, 1]);

/* ────────────────────────────────────────────────────────────────
   Z. 斷言器自我體檢
   ──────────────────────────────────────────────────────────────── */
const before = results.length;
eq('__selfcheck__', 1, 2);
const selfOk = results.length === before + 1 && results[results.length - 1].ok === false;
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
  console.log(`\n  「錢有在流動」不是把數字改小，是那個數字參與了那件事。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
