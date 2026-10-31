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
 * 最近一筆**動到錢**的履歷條目（推導，不新增任何欄位）。
 *
 * 為什麼要從履歷推導而不是記一個 `lastTrade` 欄位：
 * 多一個欄位就多一份會與履歷分岔的事實（MEMORY §D.22「兩份事實」），
 * 而且它會在匯入舊存檔時永遠是空的——推導版對舊存檔一樣有效。
 *
 * @param {Array} log 角色的成長履歷（`character.log`）
 * @returns {{ id:string, at:string, kind:string, title:string,
 *             delta:number, deltaText:string } | null}
 */
export const findLastZenitEvent = (log) => {
  const entries = Array.isArray(log) ? log : [];

  // 從尾端找：履歷是時間正序，最後一筆才是「最近」。
  // 不用 `filter(...).at(-1)`——那會先複製一份陣列，而這個函式每個 render 都會跑。
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    const change = (entry && Array.isArray(entry.changes) ? entry.changes : [])
      .find((c) => c && c.field === 'zenit');
    if (!change) continue;

    const from = asCount(change.from);
    const to = asCount(change.to);
    // 兩端都要是數字才算得出差額；只有一端的話那是別人的記錄，不是一筆交易。
    if (from === null || to === null) continue;

    const delta = to - from;
    return {
      id: entry.id || '',
      at: entry.at || '',
      kind: entry.kind || '',
      title: entry.title || '',
      delta,
      deltaText: formatZenitDelta(delta)
    };
  }

  return null;
};
