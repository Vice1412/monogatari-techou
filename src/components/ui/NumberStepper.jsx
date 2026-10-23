import React, { useEffect, useRef, useState } from 'react';

/**
 * 解析步進器的輸入，回傳要套用的增減量。
 *
 * 抽成純函式是為了測得到——「帶正負號＝增減、否則＝絕對值」這條規則是這個元件的核心，
 * 而它藏在 JSX 裡就只測得到渲染結果。
 *
 * @returns {{ delta: number } | null} 無法解析、空白、或增減為 0 時回傳 null
 */
export const parseStepperInput = (raw, currentValue) => {
  const text = String(raw ?? '').trim();
  if (text === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  // 帶正負號＝以增減計算；否則視為絕對值
  const delta = /^[+-]/.test(text) ? n : n - currentValue;
  return delta === 0 ? null : { delta };
};

/**
 * 數值步進器 (NumberStepper)
 *
 * 為什麼要有這個元件：
 * 跑團時數值的變動幅度常常不是 1——「這一下扣 12」很常見，
 * 但舊介面只有固定的 ±1／±5／±50 按鈕，要嘛點很多下、要嘛根本湊不出那個數字。
 * 使用者的要求是「所有數值要可以自己填寫的功能」。
 *
 * 互動：
 * - `−`／`+`：±1
 * - 直接點中間的數字填寫：填**絕對值**，確認（Enter 或失焦）後套用
 * - 輸入 `+12`／`-12`：以**增減**計算，同樣是確認後套用
 *
 * 只有一個回呼 `onDelta(delta)`：填絕對值時內部換算成「目標 − 現值」，
 * 所以呼叫端（與成長履歷）看到的永遠是前後值的差，
 * 不必為了兩種輸入各寫一條路徑——這也讓「填絕對值」與「±N」走同一條記錄邏輯。
 *
 * 邊界夾制留在呼叫端（`onDelta` 自己 clamp），本元件不重複一份規則；
 * 套用後 `value` 會回傳被夾制過的結果，畫面自然同步。
 */
export default function NumberStepper({
  value = 0,
  onDelta,
  theme = null,
  disabled = false,
  className = '',
  inputClassName = '',
  buttonClassName = '',
  width = 'w-12',
  title = '可直接輸入數值；輸入 +N／-N 則以增減計算',
  ariaLabel = '數值'
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelRef = useRef(false);

  // 外部值改變時同步；正在編輯時不覆蓋，否則打字會被吃掉
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(String(value));
      return;
    }
    const parsed = parseStepperInput(draft, value);
    if (!parsed) {
      setDraft(String(value));
      return;
    }
    onDelta(parsed.delta);
  };

  const baseButton = `px-1.5 py-1 rounded border text-xs font-bold leading-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${buttonClassName}`;
  const buttonStyle = theme
    ? { backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }
    : undefined;
  const inputStyle = theme
    ? { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
    : undefined;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelta(-1)}
        className={`${baseButton} ${theme ? '' : 'bg-[#fbf7ee] hover:bg-[#f4ebd9] border-[#d6c7ab] text-[#3c2415]'}`}
        style={buttonStyle}
        aria-label={`${ariaLabel} -1`}
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
        onFocus={() => setEditing(true)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelRef.current = true;
            e.currentTarget.blur();
          }
        }}
        className={`${width} text-center font-mono font-black text-sm rounded border outline-none focus:ring-1 ${inputClassName}`}
        style={inputStyle}
        title={title}
        aria-label={ariaLabel}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelta(1)}
        className={`${baseButton} ${theme ? '' : 'bg-[#fbf7ee] hover:bg-[#f4ebd9] border-[#d6c7ab] text-[#3c2415]'}`}
        style={buttonStyle}
        aria-label={`${ariaLabel} +1`}
      >
        +
      </button>
    </div>
  );
}
