/**
 * 金錢回饋（P9，2026-10-31）
 *
 * 執行：`npm run test:zenit`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 使用者的原話：「目前角色卡買裝備或者中途買東西的時候，金錢並沒有明顯的表現出來。」
 *
 * 改動前量到的三件事（2026-10-31 實測）：
 *
 *   1. 錢包只有一個 `NumberStepper`。同一張面板上 HP／MP／IP／EXP 都有浮字，
 *      只有錢沒有——**錢是唯一沒有回饋的資源**。
 *   2. 全站沒有「交易」這個動作。68 件裝備的 `cost` 只出現在建卡的預算條裡，
 *      跑團中買東西＝自己心算、自己按 `−N`、自己記住買了什麼。
 *   3. `LOG_KINDS.zenit` 的 `coalesce` 是 120000：兩分鐘內的連續變動合併成一筆
 *      「支出資金」，標題沒有品名。買三樣東西只留一筆。
 *
 * ── 為什麼「事件」與「雜訊」要分成兩種 kind ────────────────
 *
 * 這是本輪最重要的一條判斷，也是最容易在半年後被「順手合併」的地方：
 * 同一個欄位（`zenit`）可以有兩種語意。手動微調是**雜訊**（連按四下 `-1`），
 * 交易是**事件**（買了什麼）。合併是給雜訊用的，不是給事件用的。
 * 所以 `trade` 必須是 `coalesce: 0`，而 `zenit` 保持 120000——
 * 兩條都要有斷言，否則下一個人只會看到「有合併」而不知道「誰不該合併」。
 *
 * ── 為什麼 D 段要同時驗「合併」與「不合併」 ────────────────
 *
 * 只驗「trade 不合併」的話，把 `coalesce` 從 0 改成 120000 會紅；
 * 但把整個合併機制拆掉（`zenit` 也變成 0）**不會紅**——
 * 而那是另一半的退化。所以 E 段拿兩筆模擬記錄當對照組：
 * 兩筆 `zenit` 微調要併成一筆，兩筆 `trade` 要留下兩筆。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  formatZenit,
  formatZenitDelta,
  describePurchase,
  findLastZenitEvent,
  ZENIT_SUFFIX
} from '../src/features/character-sheet/utils/zenitFeedback.js';
import {
  buildPurchaseCatalog,
  filterCatalog,
  describeCheckoutBlock,
  PurchaseModalBody,
  PURCHASE_CATEGORIES
} from '../src/features/character-sheet/components/PurchaseModal.jsx';
import { LOG_KINDS, loggableChange } from '../src/features/character-sheet/utils/characterLog.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';

let results = [];
/** 值斷言：實際值與期望值真的相等才算過（理由同 resourceFeedback.test.mjs）。 */
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
   A. formatZenit：千分位、單位、以及「不知道」
   ──────────────────────────────────────────────────────────────── */
eq('A1 小額不加千分位', formatZenit(500), `500${ZENIT_SUFFIX}`);
eq('A2 四位數要加千分位（12px 下 2500 與 25000 一樣長）', formatZenit(2500), '2,500z');
eq('A3 五位數', formatZenit(25000), '25,000z');
eq('A4 0 是一個值，不是「沒有」', formatZenit(0), '0z');
// 空值語意：`0z` 是一句斷言（你真的沒錢），`—` 是一句實話（我不知道）。
eq('A5 null 是「不知道」，印破折號不是 0z', formatZenit(null), '—');
eq('A6 undefined 一樣是「不知道」', formatZenit(undefined), '—');
eq('A7 空字串是「不知道」，不是 0', formatZenit(''), '—');
eq('A8 數字字串可以收（存檔匯入會給字串）', formatZenit('1200'), '1,200z');
eq('A9 NaN 是「不知道」', formatZenit(NaN), '—');

eq('A10 增額帶 +', formatZenitDelta(200), '+200z');
eq('A11 減額帶 -', formatZenitDelta(-200), '-200z');
eq('A12 沒有變化回空字串（呼叫端才不用判斷）', formatZenitDelta(0), '');
eq('A13 差額也是「不知道」', formatZenitDelta(null), '');

/* ────────────────────────────────────────────────────────────────
   B. describePurchase：付得起、付不起、不知道
   ──────────────────────────────────────────────────────────────── */
const buy = (price, wallet) => describePurchase({ price, wallet });

eq('B1 付得起：算式寫出來，不只寫結果', buy(200, 500).mathText, '500z - 200z = 300z');
eq('B2 付得起：剩 300', buy(200, 500).after, 300);
eq('B3 付得起：語氣 ok、沒有短少量', [buy(200, 500).tone, buy(200, 500).shortText], ['ok', '']);
eq('B4 付不起：說還差多少', buy(800, 500).shortText, '還差 300z');
eq('B5 付不起：算式也要說還差多少（不是印負數）', buy(800, 500).mathText, '500z - 800z = 還差 300z');
eq('B6 付不起：tone 是 short', buy(800, 500).tone, 'short');
eq('B7 付不起：after 是負數（不要夾成 0，那是騙人）', buy(800, 500).after, -300);
// 邊界：`wallet === price` 買得起，付完剛好 0。
eq('B8 剛好付完算買得起（不是不足）', [buy(500, 500).affordable, buy(500, 500).after], [true, 0]);
eq('B9 差 1z 就買不起', buy(501, 500).affordable, false);
eq('B10 免費品（cost 0）買得起，錢包不變', [buy(0, 500).affordable, buy(0, 500).after], [true, 500]);
eq('B11 免費品的語氣是 free', buy(0, 500).tone, 'free');

// 空值語意：不知道錢包有多少 → 三態回 null，**不是 false**。
// 說「買不起」是在斷言一件我們其實不知道的事。
eq('B12 不知道錢包 → affordable 是 null，不是 false', buy(200, null).affordable, null);
eq('B13 不知道錢包 → 不編造算式', buy(200, null).mathText, '');
eq('B14 不知道錢包 → 仍然知道價格（畫面要能印價格）', buy(200, null).priceText, '200z');
eq('B15 不知道價格 → affordable 是 null', buy(null, 500).affordable, null);
eq('B16 不知道價格 → priceKnown 為 false', buy(undefined, 500).priceKnown, false);
eq('B17 什麼都沒給也不炸（回一個完整的空殼）', buy().tone, 'unknown');
// 對照組：0 元的錢包是「知道而且不夠」，不是「不知道」。
eq('B18 錢包 0 元是「知道且不夠」（與 null 不同）', buy(200, 0).affordable, false);

/* ────────────────────────────────────────────────────────────────
   C. findLastZenitEvent：從履歷推導「最近一筆資金事件」
   ──────────────────────────────────────────────────────────────── */
const mkEntry = (at, kind, title, from, to) => ({
  id: `e-${at}`,
  at,
  kind,
  title,
  changes: from === undefined ? [] : [{ field: 'zenit', from, to }]
});

eq('C1 空履歷回 null', findLastZenitEvent([]), null);
eq('C2 不是陣列也不炸', findLastZenitEvent(null), null);
eq('C3 取最後一筆（不是第一筆）',
  findLastZenitEvent([
    mkEntry('2026-10-31T10:00:00.000Z', 'trade', '購入 青銅劍', 500, 300),
    mkEntry('2026-10-31T10:05:00.000Z', 'trade', '購入 短匕首', 300, 150)
  ]).title,
  '購入 短匕首');
eq('C4 差額由前後值算出來（不是另存的欄位）',
  findLastZenitEvent([mkEntry('2026-10-31T10:00:00.000Z', 'trade', 'x', 500, 300)]).delta, -200);
eq('C5 差額帶單位',
  findLastZenitEvent([mkEntry('2026-10-31T10:00:00.000Z', 'trade', 'x', 500, 300)]).deltaText, '-200z');
eq('C6 沒有動到錢的記錄要跳過',
  findLastZenitEvent([
    mkEntry('2026-10-31T10:00:00.000Z', 'trade', '購入 青銅劍', 500, 300),
    mkEntry('2026-10-31T10:01:00.000Z', 'hp', '承受傷害')
  ]).title,
  '購入 青銅劍');
eq('C7 只有一端是數字（舊資料）不算一筆交易',
  findLastZenitEvent([{ id: 'x', at: '2026-10-31T10:00:00.000Z', kind: 'zenit', title: 't', changes: [{ field: 'zenit', from: null, to: 300 }] }]),
  null);
eq('C8 沒有 changes 的記錄不會炸',
  findLastZenitEvent([{ id: 'x', at: '2026-10-31T10:00:00.000Z', kind: 'note', title: '記事' }]),
  null);

/* ────────────────────────────────────────────────────────────────
   D. kind 登記：trade 存在，而且「不合併」
   ──────────────────────────────────────────────────────────────── */
eq('D1 trade 是登記過的 kind（沒登記會被 appendLog 靜默拒收）', Boolean(LOG_KINDS.trade), true);
eq('D2 trade 不合併（事件不是雜訊）', LOG_KINDS.trade.coalesce, 0);
// 對照組：`zenit` 必須**保持**合併，否則手動連按四下 `-1` 會留下四筆。
eq('D3 zenit 仍然合併（手動微調是雜訊）', LOG_KINDS.zenit.coalesce > 0, true);
eq('D4 trade 有自己的標籤與圖示（履歷篩選器看的是這兩欄）',
  [LOG_KINDS.trade.label, LOG_KINDS.trade.icon], ['交易', 'GiTakeMyMoney']);
// 圖示必須真的登記在 GameIcon 的對照表裡，否則會**安靜地**退回 GiSparkles。
const iconSrc = readSrc('src/components/ui/GameIcon.jsx');
eq('D5 圖示有被 import，也有對照到 trade（否則安靜退回預設圖示）',
  [/^\s*GiTakeMyMoney,\s*$/m.test(iconSrc), /trade:\s*GiTakeMyMoney/.test(iconSrc)], [true, true]);

/* ────────────────────────────────────────────────────────────────
   E. 兩筆記錄真的寫得進去：合併與不合併的對照
   ──────────────────────────────────────────────────────────────── */
const baseChar = { name: '測試', log: [], activeSession: null, zenit: 500, equipment: {} };
const trade1 = loggableChange(baseChar, { ...baseChar, zenit: 300 }, {
  kind: 'trade',
  title: '購入 青銅劍（-200z）',
  changes: [{ field: 'zenit', from: 500, to: 300 }]
});
const trade2 = loggableChange(trade1, { ...trade1, zenit: 150 }, {
  kind: 'trade',
  title: '購入 短匕首（-150z）',
  changes: [{ field: 'zenit', from: 300, to: 150 }]
});
eq('E1 兩筆交易留下兩筆（不合併）', trade2.log.length, 2);
eq('E2 兩筆都帶品名（事後查得到買了什麼）',
  trade2.log.map((e) => e.title), ['購入 青銅劍（-200z）', '購入 短匕首（-150z）']);
eq('E3 兩筆的 kind 都是 trade', trade2.log.map((e) => e.kind), ['trade', 'trade']);
// `summarizeLog` 的 zenitDelta 讀的是欄位，不是 kind——所以 trade 不必改統計。
eq('E4 交易也計入資金增減統計（field 仍是 zenit）',
  trade2.log.map((e) => e.changes[0].field), ['zenit', 'zenit']);

const zen1 = loggableChange(baseChar, { ...baseChar, zenit: 490 }, {
  kind: 'zenit', title: '支出資金', changes: [{ field: 'zenit', from: 500, to: 490 }]
});
const zen2 = loggableChange(zen1, { ...zen1, zenit: 480 }, {
  kind: 'zenit', title: '支出資金', changes: [{ field: 'zenit', from: 490, to: 480 }]
});
// 對照組：同一種寫法，換成 `zenit` kind 就會併成一筆（from 500、to 480）。
eq('E5 對照組：兩筆 zenit 微調併成一筆', zen2.log.length, 1);
eq('E6 合併後保留最初的 from 與最新的 to', [zen2.log[0].changes[0].from, zen2.log[0].changes[0].to], [500, 480]);

/* ────────────────────────────────────────────────────────────────
   F. 採購目錄：只列真的買得到的東西
   ──────────────────────────────────────────────────────────────── */
const catalog = buildPurchaseCatalog(rulesData.equipment);
eq('F1 每個品項都有正價格（0 元的是空槽位替身，不是商品）',
  catalog.every((item) => item.cost > 0), true);
eq('F2 空槽位替身不在清單裡（徒手打擊／無盾牌／無裝甲）',
  ['徒手打擊', '無盾牌', '無裝甲 / 冒險服', '臨時武器（近戰）'].filter((n) => catalog.some((i) => i.name === n)),
  []);
eq('F3 四類都有人（不是只有武器）',
  PURCHASE_CATEGORIES.map((c) => catalog.some((i) => i.categoryId === c.id)),
  [true, true, true, true]);
eq('F4 每件都帶槽位（購買後要裝備到哪裡）',
  catalog.every((item) => Boolean(item.slot)), true);
eq('F5 價格取自書上（青銅劍 200z）',
  catalog.find((i) => i.name === '青銅劍')?.cost, 200);
eq('F6 目前共 63 件可購買（資料改了要有人決定）', catalog.length, 63);

eq('F7 名稱搜尋只回符合的', filterCatalog(catalog, { query: '匕首' }).map((i) => i.name), ['短匕首']);
eq('F8 分類篩選只回該類', filterCatalog(catalog, { categoryId: 'shields' }).every((i) => i.categoryId === 'shields'), true);
eq('F9 同類內由便宜到貴（買東西的人在意價格）',
  filterCatalog(catalog, { categoryId: 'armors' }).map((i) => i.cost),
  [...filterCatalog(catalog, { categoryId: 'armors' }).map((i) => i.cost)].sort((a, b) => a - b));
eq('F10 搜尋不到就回空陣列（不是全部）', filterCatalog(catalog, { query: '不存在的東西' }).length, 0);

/* ────────────────────────────────────────────────────────────────
   G. 彈窗本體：價格、算式、買不起的短少量都要看得到
   ──────────────────────────────────────────────────────────────── */
const renderBody = (wallet, character = { equipment: {} }) =>
  renderToStaticMarkup(React.createElement(PurchaseModalBody, {
    theme: {},
    character,
    wallet,
    onConfirm: () => {},
    onClose: () => {}
  }));

const richBody = renderBody(5000);
eq('G1 錢包金額印在標頭（千分位）', countOf(richBody, '5,000z'), 1);
eq('G2 清單印出價格（青銅劍 200z）', countOf(richBody, '200z') >= 1, true);
eq('G3 四個分類頁籤都在',
  PURCHASE_CATEGORIES.map((c) => countOf(richBody, `data-testid="purchase-cat-${c.id}"`)), [1, 1, 1, 1]);
eq('G4 還沒選東西時，結帳鈕是 aria-disabled（不是 disabled）',
  [countOf(richBody, 'aria-disabled="true"') >= 1, countOf(richBody, 'disabled=""')], [true, 0]);
eq('G5 沒選東西時說清楚「選了才會算」',
  countOf(richBody, '這裡會算出買完還剩多少'), 1);

const poorBody = renderBody(100);
eq('G6 買不起的品項在列上就標出「還差」',
  countOf(poorBody, '還差 50z') >= 1, true);
eq('G7 買不起不是隱藏（青銅劍仍然列出來）',
  countOf(poorBody, 'data-testid="purchase-item-青銅劍"'), 1);

// 結帳鈕的三句話必須分得開：沒選／不知道錢包／真的不夠。
// 三條都要驗，因為「把其中兩句併成一句」不會讓任何一條畫面壞掉，
// 只會讓玩家在打開彈窗的第一秒就被告知「錢包金額尚未記錄」——而錢包就在左上角。
eq('G8-a 沒選東西時說「先選」而不是「沒錢」', describeCheckoutBlock({ hasSelection: false, gate: describePurchase({}) }), '先選一件品項');
eq('G8-b 不知道錢包時說「未記錄」（不指控買不起）',
  describeCheckoutBlock({ hasSelection: true, gate: describePurchase({ price: 200, wallet: null }) }),
  '錢包金額尚未記錄，無法結帳');
eq('G8-c 真的不夠時才說「資金不足」',
  describeCheckoutBlock({ hasSelection: true, gate: describePurchase({ price: 800, wallet: 500 }) }),
  '資金不足：還差 300z');
eq('G8-d 買得起時沒有理由（空字串，不是「可以買」）',
  describeCheckoutBlock({ hasSelection: true, gate: describePurchase({ price: 200, wallet: 500 }) }), '');
// 反例守衛：`disabled` 會吃掉 title、也拿不到焦點（MEMORY §E.16）。
const modalSrc = readSrc('src/features/character-sheet/components/PurchaseModal.jsx');
eq('G9 彈窗不用 disabled（會吃掉 title 與焦點）',
  /\sdisabled(=""|\s|>)/.test(modalSrc), false);
eq('G10 彈窗不自己拼金額（一律走 formatZenit）',
  [countOf(modalSrc, 'formatZenit(') >= 2, /\$\{[^}]*\}\s*z`/.test(modalSrc)], [true, false]);
eq('G11 彈窗不寫入（結帳交給面板的單一出口）',
  [/onChange\s*\(/.test(modalSrc), /localStorage/.test(modalSrc)], [false, false]);

/* ────────────────────────────────────────────────────────────────
   H. 面板接線：錢包 → 交易條 → 購買 → 履歷
   ──────────────────────────────────────────────────────────────── */
const hudSrc = readSrc('src/features/character-sheet/components/CharacterPlayHUD.jsx');
eq('H1 錢包金額走 formatZenit（不是手寫 `{n} z`）',
  [countOf(hudSrc, 'data-testid="wallet-amount"'), countOf(hudSrc, '} z')], [1, 0]);
eq('H2 交易條存在，而且會顯示最近一筆',
  [countOf(hudSrc, 'data-testid="wallet-trade-strip"'), countOf(hudSrc, 'data-testid="wallet-last-delta"')], [1, 1]);
eq('H3 兩個購買入口（主面板的錢包條 ＋ 行囊分頁）',
  [countOf(hudSrc, 'data-testid="open-purchase"'), countOf(hudSrc, 'data-testid="pack-purchase"')], [1, 1]);
eq('H4 行囊分頁看得到餘額（錢要出現在做決定的地方）',
  countOf(hudSrc, 'data-testid="pack-wallet"'), 1);
eq('H5 結帳走 describePurchase（與畫面上的算式同一個函式）',
  countOf(hudSrc, 'describePurchase({ price: item?.cost, wallet })'), 1);
eq('H6 交易記成 trade，不是 zenit（事件 vs 雜訊）',
  [countOf(hudSrc, "kind: 'trade'"), countOf(hudSrc, "kind: 'zenit'")], [1, 1]);
eq('H7 最近一筆由履歷推導（不新增欄位）',
  countOf(hudSrc, 'findLastZenitEvent(character.log)'), 1);
eq('H8 不新增任何持久欄位（沒有 lastTrade／walletLog）',
  [/lastTrade\s*:/.test(hudSrc), /walletLog\s*:/.test(hudSrc)], [false, false]);

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
  console.log(`\n  「錢沒有表現出來」不是顏色不夠，是錢沒有參與那件事。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
