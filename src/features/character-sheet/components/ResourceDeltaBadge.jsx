import React, { useEffect, useRef, useState } from 'react';

/**
 * 資源變動的即時回饋（ResourceDeltaBadge）
 *
 * ## 問題
 *
 * 跑團面板上所有數值都走 `updateField()`，寫入 localStorage、留下一筆成長履歷——
 * **系統其實什麼都記了**。但畫面上唯一的回饋是「輸入框裡的數字變成另一個數字」。
 * 玩家按 `−8` 之後，除了自己心算，沒有任何東西告訴他「剛剛這一擊扣了 8」。
 *
 * 使用者的說法是「要有玩遊戲的感覺，不呆板，而是有系統互動的實感」。
 * 遊戲給回饋的方式很固定：**數字動的那一刻，把它做出來**——一個 `-8` 從條子上
 * 浮起來、往上飄、淡出。零輸入、零設定、零額外欄位。
 *
 * ## 為什麼是「推導」而不是「記錄」
 *
 * 這個回饋**不寫任何東西**：沒有 log、沒有 localStorage、沒有新欄位。
 * 它只是比較「上一個 render 的值」與「這一個 render 的值」，差額不為零就畫 0.9 秒。
 * 換句話說，重新整理頁面之後它就不見了——這正是要的，因為它講的是
 * 「剛剛那一下」，不是「歷史上發生過什麼」（那是履歷的工作）。
 *
 * ## 一個容易寫錯的地方
 *
 * `from` / `to` 只接受**真正的數字**。`Number(null)` 是 `0`、`Number('')` 是 `0`，
 * 用強制轉型的話「值還沒算出來」會被當成「從 0 變成 X」，於是畫面會在
 * 角色四維還沒指派時浮出一個假的 `+8`。空值語意是「不知道」，
 * 不是「零」——同 MEMORY §D「空值語意」。
 */

/**
 * 比較前後值，回傳要顯示的增減。
 *
 * @param {number} from 上一次的值
 * @param {number} to 這一次的值
 * @returns {{ delta: number, tone: 'gain'|'loss', text: string } | null}
 *   不是數字、或沒有變化時回傳 `null`（呼叫端據此不畫任何東西）
 */
export const describeResourceDelta = (from, to) => {
  // `Number.isFinite` 本身就**不做強制轉型**（它用的是 IsNumber，不是 ToNumber），
  // 所以它一個就擋掉了 null／undefined／字串／布林／NaN／Infinity。
  //
  // ※ 這裡原本還有一行 `typeof from !== 'number' || typeof to !== 'number'`。
  //   刻意破壞驗證時把它拿掉，測試**全綠**——因為它在任何輸入下都與下一行等價。
  //   那不是「多一層保險」，是**一段看起來像護欄的死碼**（MEMORY §A3）。
  //   留著它的代價是下一個人以為那裡有人在守，於是改動 `isFinite` 那一行時
  //   不會去檢查它。所以刪掉，並留下這段說明：**不要加回來。**
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const delta = to - from;
  if (delta === 0) return null;
  return {
    delta,
    tone: delta > 0 ? 'gain' : 'loss',
    text: `${delta > 0 ? '+' : '-'}${Math.abs(delta)}`
  };
};

/** 浮字停留時間（毫秒）。與 `index.css` 的 `resourceDeltaFloat` 動畫長度一致。 */
export const DELTA_FLASH_MS = 900;

/**
 * 監看一個數值，變動時回傳一個短命的 `flash` 物件。
 *
 * @param {number} value 要監看的值
 * @param {{ holdMs?: number }} options
 * @returns {{ delta: number, tone: 'gain'|'loss', text: string, key: number } | null}
 */
export function useResourceDelta(value, { holdMs = DELTA_FLASH_MS } = {}) {
  const [flash, setFlash] = useState(null);
  const previousRef = useRef(value);
  const seqRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = value;

    const described = describeResourceDelta(previous, value);
    // 第一次 render 時 previous === value，這裡一定不會有東西要畫。
    if (!described) return undefined;

    seqRef.current += 1;
    setFlash({ ...described, key: seqRef.current });

    // 連續變動（例如連按四下「−1」）時重設計時器，否則第一個計時器會提早把
    // 第二、三、四個數字擦掉——那會讓回饋看起來「有時有、有時沒有」。
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setFlash(null);
      timerRef.current = null;
    }, holdMs);

    return undefined;
  }, [value, holdMs]);

  // 卸載時把計時器收乾淨；否則元件的 setState 會在已經消失的樹上跑。
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return flash;
}

/**
 * 浮動的增減數字。
 *
 * 用 `key` 強制重掛載，是為了讓「連續兩次同方向、同數量的變動」也能重新播一次動畫
 * ——只改內文的話 CSS 動畫不會重跑，玩家會覺得「第二次按沒反應」。
 *
 * ## 為什麼是「整條寬、置中」而不是「靠右」
 *
 * 第一版寫 `right-1 -top-4`（貼齊條子的右端往上浮），實機截圖看起來**數字壞掉了**：
 * `-8` 正好壓在旁邊的 `42 / 50` 上，兩個數字疊成一團。測試全綠，因為它們驗的是
 * 「有沒有那個元素」，不是「看不看得清楚」。
 *
 * 資源卡的標頭是 `justify-between`：左邊是資源名，右邊是「現在 / 上限」，
 * **中間是空的**。所以浮字改成整條寬置中，往上浮的路徑全程都在那片空白上。
 * 置中不能用 `-translate-x-1/2`——動畫的 keyframes 會設 `transform`，
 * 它會把 utility 的 transform 整組蓋掉，於是浮字又跑回左邊。
 * 用 `inset-x-0` ＋ `text-center` 就沒有這個問題。
 *
 * `aria-hidden`：這個數字是**視覺上的重複**。真正的值在旁邊那顆有 `aria-label`
 * 的輸入框裡，而且已經變了；再讓螢幕閱讀器把每個 ±1 唸一遍，只會蓋掉它真正要聽的內容。
 */
export function ResourceDeltaBadge({ flash, className = '', inline = false }) {
  if (!flash) return null;

  // ── 行內版（P9，2026-10-31）──
  // 錢包卡沒有「條」，也就沒有可以讓浮字飄過去的空白：卡片是
  // 「標頭（名稱 ←→ 金額）」＋「步進器」兩行，兩行都塞滿了字。
  // 照浮字版放上去，`-200` 會正好壓在金額上——那正是 P5 踩過的坑
  // （`-8` 壓在 `42 / 50` 上，測試全綠、看起來壞掉）。
  //
  // 所以同一支元件出第二種形態：**在流內、緊貼金額右側**。
  // 它不飄，改成金額自己動（`animate-resource-delta` 的縮放）。
  // 動畫名字刻意相同：同一個「剛剛變了多少」的語彙，不因為容器形狀換一種說法。
  if (inline) {
    return (
      <span
        key={flash.key}
        aria-hidden="true"
        data-testid="resource-delta"
        data-tone={flash.tone}
        className={`animate-resource-delta pointer-events-none inline-block font-mono font-black leading-none ${className}`}
        style={{ color: flash.tone === 'gain' ? '#245c45' : '#8c3235' }}
      >
        {flash.text}
      </span>
    );
  }

  return (
    // 外層只負責「定位 ＋ 置中」，寬度是整條；內層才是那個看得見的數字。
    // 分兩層是必要的：`data-testid` 掛在外層的話，它的外框是**整條 bar 的寬度**，
    // 於是「有沒有壓到別的數字」這種檢查永遠會說有——量到的是一個空盒子。
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-3 text-center"
    >
      <span
        key={flash.key}
        data-testid="resource-delta"
        data-tone={flash.tone}
        className={`animate-resource-delta inline-block font-mono font-black text-sm leading-none ${className}`}
        style={{ color: flash.tone === 'gain' ? '#245c45' : '#8c3235' }}
      >
        {flash.text}
      </span>
    </span>
  );
}
