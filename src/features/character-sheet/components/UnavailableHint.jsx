import React from 'react';

/**
 * 一行「現在還不能用」的說明。
 *
 * 存在的理由：只有灰掉是不夠的。灰掉的按鈕在手機上沒有 hover、在鍵盤上
 * 又可能被跳過，玩家只會覺得「壞了」。所以把短少的量直接印出來。
 *
 * `null` 進來就回 `null`——**沒有不足時不佔位**，不要在父層多包一層
 * 條件，那會讓「有沒有印」變成兩個地方要同時正確。
 */
export default function UnavailableHint({ gate, testId, className = '' }) {
  if (!gate || !gate.blocked || !gate.shortText) return null;
  return (
    <span
      data-testid={testId}
      data-short={gate.short}
      className={`text-t12 font-bold text-[#8c3235] whitespace-nowrap ${className}`}
    >
      {gate.shortText}
    </span>
  );
}
