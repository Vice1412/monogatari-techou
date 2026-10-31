/**
 * 金錢回饋（P9，2026-10-31）
 *
 * ## 問題
 *
 * 使用者：「目前角色卡買裝備或者中途買東西的時候，金錢並沒有明顯的表現出來。」
 *
 * 量到的現況（2026-10-31 實測，`src/` 全掃）：
 *
 * 1. **錢包只有一個數字。** 跑團面板的「金幣錢包」是一個 `NumberStepper`；
 *    按 `−200` 之後畫面上唯一的變化是輸入框裡的數字變成另一個數字。
 *    同一張面板上 HP／MP／IP／EXP 四條都有浮字（`ResourceDeltaBadge`），
 *    只有錢沒有——**錢是唯一沒有回饋的資源**。
 * 2. **全站沒有「交易」這個動作。** 68 件裝備的 `cost` 只出現在兩個地方：
 *    建卡時的預算條、裝備選單的「剩餘預算」。跑團中要買東西，玩家得自己
 *    心算、自己按 `−N`、自己記住買了什麼——**價格與扣款之間沒有任何連線**。
 * 3. **履歷會把交易吃掉。** `LOG_KINDS.zenit` 宣告 `coalesce: 120000`，
 *    兩分鐘內的連續變動合併成一筆「支出資金」，標題裡沒有品名。
 *    買三樣東西只留一筆，而且事後看不出買了哪三樣。
 *
 * ## 這支只管「算」
 *
 * 三件純計算：付不付得起、付完剩多少、最近一筆資金事件是什麼。
 * 不呈現、不寫入、不碰 localStorage、不 import React——與 `playAvailability.js`
 * 同一個分工：**判定與文案在這裡，「事前提示」與「事後守衛」才有機會講同一句話。**
 *
 * ## 空值語意（本專案反覆踩到的坑，MEMORY §D.21）
 *
 * `null`／`undefined` ＝ **不知道**，`0` ＝ 知道而且不夠。
 * 所以 `affordable` 是三態：`true`／`false`／`null`。
 * 三態不是潔癖——`null` 的時候畫面上要說「錢包金額未記錄」，
 * 而說「買不起」是**另一句話**（它斷言了一件我們其實不知道的事）。
 */

import { asCount } from './playAvailability';

/** 金額單位。全站統一，不要在各個元件裡各寫一次 `'z'`。 */
export const ZENIT_SUFFIX = 'z';

/**
 * 金額的顯示格式：**千分位 ＋ 緊貼單位**（`1,500z`）。
 *
 * 為什麼要有這一支：改動前全站三種寫法並存——`{n} z`（錢包卡）、
 * `{n}z`（預算條）、`{n} Zenit`（裝備選單）。四位数以上沒有千分位時，
 * `2500z` 與 `25000z` 在 12px 的字級下看起來一樣長。
 *
 * 不知道就回 `—`，不回 `0z`：`0z` 是一句斷言（你真的沒錢），
 * `—` 是一句實話（我不知道）。
 */
export const formatZenit = (value) => {
  const amount = asCount(value);
  if (amount === null) return '—';
  return `${amount.toLocaleString('en-US')}${ZENIT_SUFFIX}`;
};

/**
 * 帶正負號的金額（浮字與履歷摘要用）。
 * 沒有變化回空字串，讓呼叫端可以 `{text && …}` 直接決定要不要畫。
 */
export const formatZenitDelta = (delta) => {
  const amount = asCount(delta);
  if (amount === null || amount === 0) return '';
  return `${amount > 0 ? '+' : '-'}${Math.abs(amount).toLocaleString('en-US')}${ZENIT_SUFFIX}`;
};

/**
 * 一次購買的判定與文案。
 *
 * @param {object} options
 * @param {number} options.price  售價（`null`／`undefined` ＝ 不知道）
 * @param {number} options.wallet 錢包現額（`null`／`undefined` ＝ 不知道）
 * @returns {{
 *   priceKnown: boolean, walletKnown: boolean,
 *   affordable: true|false|null,
 *   after: number|null, short: number,
 *   priceText: string, afterText: string, mathText: string, shortText: string,
 *   tone: 'ok'|'short'|'free'|'unknown'
 * }}
 *
 * 邊界：`wallet === price` **買得起**（付完剛好 0），不是不足。
 */
export const describePurchase = ({ price, wallet } = {}) => {
  const need = asCount(price);
  const have = asCount(wallet);

  const unknown = {
    priceKnown: need !== null,
    walletKnown: have !== null,
    affordable: null,
    after: null,
    short: 0,
    priceText: need === null ? '' : formatZenit(need),
    afterText: '',
    mathText: '',
    shortText: '',
    tone: 'unknown'
  };

  // 沒有價格就不是一筆交易。**不要**在它前面加一層 `typeof` 檢查：
  // `asCount` 已經把型別與空字串一起收掉了，多一層只會是死碼（MEMORY §A3）。
  if (need === null) return unknown;

  // 免費品（`cost: 0`）：買得起，而且「還剩多少」就是原本的錢包。
  if (need === 0) {
    return {
      ...unknown,
      priceKnown: true,
      affordable: true,
      after: have,
      afterText: have === null ? '' : formatZenit(have),
      mathText: have === null ? '' : `${formatZenit(have)} - 0${ZENIT_SUFFIX} = ${formatZenit(have)}`,
      tone: 'free'
    };
  }

  // 價格知道、錢包不知道 → 算不出來。回 `null`，不回 `false`。
  if (have === null) return unknown;

  const after = have - need;
  const affordable = after >= 0;
  const short = affordable ? 0 : -after;
  const priceText = formatZenit(need);

  return {
    priceKnown: true,
    walletKnown: true,
    affordable,
    after,
    short,
    priceText,
    afterText: formatZenit(Math.max(0, after)),
    // 算式要寫出來，不要只寫結果：玩家真正想確認的是「買完還剩多少」。
    mathText: affordable
      ? `${formatZenit(have)} - ${priceText} = ${formatZenit(after)}`
      : `${formatZenit(have)} - ${priceText} = 還差 ${formatZenit(short)}`,
    shortText: affordable ? '' : `還差 ${formatZenit(short)}`,
    tone: affordable ? 'ok' : 'short'
  };
};

/**
 * 一條履歷條目裡「動到錢」的那一段（沒有就回 `null`）。
 *
 * P9 時它被 `findLastZenitEvent` 與 `buildMoneyLedger` 共用；P10 把錢包下方那條
 * 「最近一筆」換成一顆「明細」按鈕之後，只剩 `buildMoneyLedger` 一個呼叫者。
 * 仍然獨立成一支，是因為**「哪些 change 算一筆交易」只能有一個判斷**：
 * 判斷散在兩處，遲早會有一邊把 `0` 或字串判成數字——而那種分岔在畫面上
 * 長得一樣（少一列），不會報錯。
 */
const zenitChangeOf = (entry) => {
  const change = (entry && Array.isArray(entry.changes) ? entry.changes : [])
    .find((c) => c && c.field === 'zenit');
  if (!change) return null;

  // 終值一定要有：不知道「變成多少」就算不出任何東西（連差額都不成立）。
  const to = asCount(change.to);
  if (to === null) return null;

  const from = asCount(change.from);
  // **沒有前值＝開帳**，不是「資料壞了」。
  // 起始資金結算前，角色身上根本沒有錢包（`zenit` 只是預算的佔位值），
  // 所以那一筆沒有「前值」可言。硬寫 `from: 0` 會斷言「他本來有 0z」——
  // 那是我們不知道的事。差額就是終值本身（從無到有）。
  //
  // **但只有 `creation` 可以這樣讀**（P11，2026-11-01）：
  // 舊寫法也留下過「只有終值」的記錄（淨額、匯入的殘缺資料），
  // 把那些讀成開帳會**憑空生出收入**——「擲起始資金 500」明明含著花掉的錢，
  // 讀成 +500 收入就等於說他一毛都沒花。讀不出來就說讀不出來，不要猜。
  if (from === null) {
    if (entry.kind !== 'creation') return null;
    return { from: null, to, delta: to, deltaText: formatZenitDelta(to), opening: true };
  }

  const delta = to - from;
  return { from, to, delta, deltaText: formatZenitDelta(delta), opening: false };
};

/**
 * 金錢明細：把履歷裡**動到錢**的條目整理成一張帳（新到舊）。
 *
 * 為什麼從履歷推導而不是另開一本帳：`zenit` 的每一次變動都已經寫進履歷了
 * （`applyPurchase`／`applyMoneyFlow`／編輯器的起始資金結算都走 `loggableChange`）。
 * 另開一本帳＝兩份事實，而兩份事實一定會分岔（MEMORY §D.22）。
 *
 * 這是「明細」按鈕背後的資料，也是為什麼錢包卡不再需要 `−`／`+`：
 * **玩家要的不是改數字，是知道錢去哪了。**
 *
 * @param {Array} log 角色的成長履歷（`character.log`）
 * @returns {{ rows:Array<{id,at,kind,title,note,delta,deltaText,balance}>,
 *             income:number, expense:number, count:number }}
 *   `income`／`expense` 都是**正數**（支出不再帶負號），合計要顯示時才好讀。
 */
export const buildMoneyLedger = (log) => {
  const entries = Array.isArray(log) ? log : [];
  const rows = [];
  let income = 0;
  let expense = 0;

  // 新到舊：履歷儲存是時間正序，明細要從最近一筆開始讀。
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    const zenit = zenitChangeOf(entry);
    if (!zenit) continue;

    // 差額 0 不算一筆：`formatZenitDelta(0)` 回空字串（那是給浮字用的「沒有變化」），
    // 放進明細會變成**一列右邊什麼都沒有的帳**。免費品、被取消的交易都落在這裡。
    if (zenit.delta === 0) continue;

    if (zenit.delta > 0) income += zenit.delta;
    else expense += -zenit.delta;

    rows.push({
      id: entry.id || '',
      at: entry.at || '',
      kind: entry.kind || '',
      title: entry.title || '',
      note: entry.note || '',
      delta: zenit.delta,
      deltaText: zenit.deltaText,
      // 開帳列（起始裝備預算）與一般列的差別只在「有沒有前值」，
      // 差額與餘額的算法完全一樣，所以畫面上不必分開畫。
      opening: zenit.opening === true,
      // 這一筆之後的餘額。`to` 是當時的實際數字，不是「現在的錢包」——
      // 明細要回答「那時候剩多少」，不是「現在剩多少」。
      balance: zenit.to
    });
  }

  return { rows, income, expense, count: rows.length };
};

/* ─────────────────────────────────────────────────────────────
   收支：有原因的金錢流動（P9-b，2026-10-31）

   上一輪（§CI67）只補了「買裝備」。但跑團中花錢的地方遠多於買裝備：
   住宿、餐費、賄賂、修裝、情報……這些原本只能按 `−N`，**沒有原因**。
   而沒有原因的支出在履歷上長得一模一樣：「支出資金 350 → 300」。

   所以這一節處理的是「有原因」的那一半：
   - 金額與原因都要能判定（空字串不是 0，是「還沒填」）
   - 裝備要用**同一個模板**記錄，否則同一次購買會有兩種寫法
   ───────────────────────────────────────────────────────────── */

/** 收支方向。用字串常數而不是布林：`isSpend: false` 讀不出是「獲得」還是「沒填」。 */
export const MONEY_DIRECTIONS = Object.freeze({
  spend: 'spend',
  gain: 'gain'
});

/** 方向的顯示字（標題前綴與 toast 共用）。 */
export const DIRECTION_LABELS = Object.freeze({
  spend: '支出',
  gain: '獲得'
});

/**
 * 一筆裝備的**記錄模板**——這是「正確格式」的唯一來源。
 *
 * 為甚麼要有模板：同一次購買會出現在三個地方（交易條、成長履歷、匯出卡），
 * 三處各寫一次就會有三種格式，而使用者要的是「買到的裝備以正確的格式記錄在案」。
 * 所以格式只寫在這裡：
 *
 *   title：`購入 青銅劍`
 *   note ：`近戰武器 · DEX + MIG · 【HR + 0】物理 · 200z · 裝備到主手武器`
 *
 * `note` 的順序是**規格 → 價格 → 去向**：先說這是什麼，再說花多少，最後說裝去哪。
 * 價格放中間是因為它最短，放最後會讓「裝備到主手武器」被擠到看不見的地方。
 *
 * @param {object} item 目錄品項（`buildPurchaseCatalog` 的形狀）
 * @param {{ equip?: boolean, slotLabel?: string }} options
 */
export const describeEquipmentRecord = (item, { equip = false, slotLabel = '' } = {}) => {
  if (!item || !item.name) return { title: '', note: '' };

  const detail = typeof item.detail === 'string' ? item.detail.trim() : '';
  const parts = [detail, formatZenit(item.cost)];
  if (equip && slotLabel) parts.push(`裝備到${slotLabel}`);

  return {
    title: `購入 ${item.name}`,
    note: parts.filter(Boolean).join(' · ')
  };
};

/**
 * 判定一筆「收支」能不能寫。
 *
 * 與 `describePurchase` 的差別：那裡只有「錢夠不夠」，這裡還要「有沒有說原因」。
 * 三個欄位各自回一個錯誤字串（不是一個布林），因為畫面上要**分別**標紅那一個欄位
 * ——全部擠在底部一行「請填寫完整」等於沒說哪裡沒填。
 *
 * 空值語意照舊：`amount` 的 `''` 是「還沒填」（不是 0 元）；`0` 是「填了 0」，
 * 而 0 元的收支不是一筆收支，一樣擋。
 */
export const describeMoneyFlow = ({ direction, amount, reason, wallet } = {}) => {
  const dir = direction === MONEY_DIRECTIONS.gain ? MONEY_DIRECTIONS.gain : MONEY_DIRECTIONS.spend;
  const value = asCount(amount);
  const text = typeof reason === 'string' ? reason.trim() : '';

  const errors = { amount: '', reason: '', wallet: '' };
  if (value === null) errors.amount = '請填金額';
  else if (value <= 0) errors.amount = '金額要大於 0';
  if (text === '') errors.reason = '請寫下這筆錢的原因';

  // 只有支出需要看錢包；獲得不需要（沒有人在收到錢之前檢查錢包）。
  let gate = null;
  if (dir === MONEY_DIRECTIONS.spend && value !== null && value > 0) {
    gate = describePurchase({ price: value, wallet });
    if (gate.affordable === false) errors.wallet = `資金不足：${gate.shortText}`;
    if (gate.affordable === null) errors.wallet = '錢包金額尚未記錄，無法記帳';
  }

  const hasError = Boolean(errors.amount || errors.reason || errors.wallet);
  // 餘額與算式只看**金額與錢包**，不看原因。
  //
  // 第一版把 `hasError` 整個算進來，於是「填了 50、還沒寫原因」時算式是空的——
  // 而玩家正是在那一刻最想知道「這筆之後還剩多少」。原因沒填不影響算術，
  // 它只影響能不能寫入（`ok`），那是另一件事。
  //
  // 錢包不知道 → 餘額算不出來（`+` 也一樣：不知道起點就不知道終點）。
  // 支出且資金不足 → 也算不出來（硬算會得到一個負數，而畫面上那句話已經說「還差多少」）。
  const walletKnown = asCount(wallet) !== null;
  const base = walletKnown ? Number(wallet) : 0;
  const next = dir === MONEY_DIRECTIONS.spend ? base - (value || 0) : base + (value || 0);
  const computable = walletKnown && value !== null && value > 0 && !errors.wallet;

  return {
    ok: !hasError,
    direction: dir,
    amount: value,
    reason: text,
    errors,
    // 只有「可以寫」而且「起點已知」時才算得出餘額；否則回 null，讓畫面印破折號。
    next: computable ? next : null,
    title: hasError ? '' : `${DIRECTION_LABELS[dir]} · ${text}`,
    amountText: value === null ? '' : formatZenit(value),
    mathText: computable
      ? (dir === MONEY_DIRECTIONS.spend
        ? `${formatZenit(base)} - ${formatZenit(value)} = ${formatZenit(next)}`
        : `${formatZenit(base)} + ${formatZenit(value)} = ${formatZenit(next)}`)
      : '',
    afterText: computable ? formatZenit(next) : ''
  };
};
