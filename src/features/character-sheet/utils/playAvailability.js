/**
 * 「事前可用性」——把「按了才知道」改成「看就知道」。
 *
 * 這一支只做判定：不呈現、不寫入、不碰 localStorage。畫面上原本那些
 * 「按下之後才 `showToast('MP 不足')` 並 `return`」的守衛**仍然存在，而且
 * 仍然是唯一的執行權威**；這裡只是把同一個門檻提前算一次，讓玩家在動手
 * 之前就看得到「這個現在不能用、還差多少」。
 *
 * 為什麼要有這一支：同一個門檻原本在八個地方各寫一次（五種 IP 消耗品、
 * 咒語、儀式、羈絆激勵），每一處的文案與單位都不一樣，改一條就會漏掉
 * 另外七條。判定收斂成一個純函式之後，「事前提示」與「事後守衛」講的
 * 是同一句話。
 *
 * 空值語意（本專案反覆踩到的坑，見 MEMORY §D.21）：
 *   `null`／`undefined`／`''`／布林／物件 ＝ **不知道** → 不擋。
 *   `0` ＝ 知道而且不夠 → 擋。
 *   所以**不能**用 `Number(value)`：`Number(null) === 0`、`Number('') === 0`、
 *   `Number(false) === 0`，三個都會把「不知道」翻譯成「不夠」，讓舊存檔
 *   一開場整排變灰。
 */

/** 單位標籤：畫面上直接印，不另外做對照表 */
export const GATE_UNITS = Object.freeze({
  hp: 'HP',
  mp: 'MP',
  ip: 'IP',
  fp: '物語點',
  exp: 'EXP'
});

/**
 * 把一個「應該是數字」的值收斂成數字或 `null`。
 *
 * `null` 代表**不知道**（不是 0）。只接受 number 與非空白的數字字串；
 * 其餘一律回 `null`，交由呼叫端決定「不確定就不擋」。
 */
export const asCount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * 判定一次「付得起嗎」。
 *
 * @param {object}  options
 * @param {number}  options.cost    要付多少（`null`／`0`／負數＝沒有成本，一律放行）
 * @param {number}  options.current 現在有多少（`null`＝不知道，放行）
 * @param {string}  options.unit    單位標籤，預設 `MP`
 * @returns {{blocked:boolean, known:boolean, cost:number|null, current:number|null,
 *            short:number, reason:string, shortText:string}}
 *
 * 邊界：`current === cost` **可以**（付完剛好 0），不是不足。
 */
export const describeCostGate = ({ cost, current, unit = GATE_UNITS.mp } = {}) => {
  const need = asCount(cost);
  const have = asCount(current);
  const empty = {
    blocked: false,
    known: have !== null,
    cost: need,
    current: have,
    short: 0,
    reason: '',
    shortText: ''
  };

  // 沒有成本（或成本算不出來）就不是一個門檻，不要拿它擋人。
  if (need === null || need <= 0) return empty;
  // 不知道現在有多少 → 不擋。**這一行是「不嚇人」的唯一依據**，不要為了
  // 「保險」在它前面加一層等價的型別檢查（那會變成看起來像護欄的死碼）。
  if (have === null) return empty;
  if (have >= need) return empty;

  const short = need - have;
  return {
    blocked: true,
    known: true,
    cost: need,
    current: have,
    short,
    reason: `${unit} 不足：需要 ${need}，現有 ${have}，還差 ${short}`,
    shortText: `差 ${short} ${unit}`
  };
};

/**
 * 給按鈕用的屬性。刻意**不用 `disabled`**：
 *   - `disabled` 的按鈕在很多瀏覽器不吃 `title`，說明文字會消失；
 *   - 也拿不到焦點，鍵盤使用者會直接跳過它，等於看不到「為什麼不能用」。
 * 所以走 `aria-disabled`，按下去仍然會觸發原本的守衛（行為與改動前一致），
 * 只是先一步告訴你結果。
 */
export const gateButtonAttrs = (gate) => {
  if (!gate || !gate.blocked) return {};
  return {
    'aria-disabled': 'true',
    'data-blocked': 'true',
    title: gate.reason
  };
};

/** 灰掉但不下市。**用在「短少量印在按鈕外面」的情況**（咒語、儀式、羈絆）：
 *  提示是兄弟節點，不會被按鈕的透明度影響。
 *  `opacity-50` 是 Tailwind 3 的預設尺度值——`opacity-45` 不在尺度裡，
 *  寫了會生不出樣式，等於「以為灰掉了其實沒有」。 */
export const GATED_BUTTON_CLASS = 'opacity-50 cursor-not-allowed';

/**
 * 按鈕本體**只關游標、不壓透明度**。用在「短少量印在按鈕裡面」的情況
 * （五種 IP 消耗品：按鈕右側那一格就是「差 3 IP」）。
 *
 * 為什麼要分成兩個常數：CSS 的 `opacity` 是「整棵子樹一起乘」，
 * 子元素**不可能**比父元素更不透明。所以按鈕一壓透明度，
 * 那行「差 3 IP」會跟著變淡——變成「灰掉，但看不到為什麼」，
 * 也就是這一輪要解決的問題本身。實機量到 `opacity: 0.5` 才發現。
 *
 * 內容的淡化交給 `GATED_LABEL_CLASS`，短少量保持全強。
 */
export const GATED_SHELL_CLASS = 'cursor-not-allowed';

/** 按鈕裡「可以按的那一半」的淡化。與 `GATED_SHELL_CLASS` 配對使用。 */
export const GATED_LABEL_CLASS = 'opacity-50';

/**
 * 把「多個成本」合併判定（例：儀式同時要 MP 與衝突命刻）。
 * 只要有一項不足就算擋，短少的說明取第一項——不堆疊成一句長話。
 */
export const describeCostGates = (entries = []) => {
  const gates = (Array.isArray(entries) ? entries : []).map(describeCostGate);
  const blocked = gates.find((g) => g.blocked);
  if (blocked) return blocked;
  return (
    gates[0] || {
      blocked: false,
      known: true,
      cost: null,
      current: null,
      short: 0,
      reason: '',
      shortText: ''
    }
  );
};
