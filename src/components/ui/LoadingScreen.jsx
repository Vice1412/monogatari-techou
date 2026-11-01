import React, { useState, useEffect } from 'react';

/**
 * 全站通用載入文案（單一來源）。
 * 依使用者裁定，依序輪播四句造物／構築世界意象的敘事短句。
 */
export const LOADING_MESSAGES = Object.freeze([
  '正在繪製圖紙……',
  '正在雕刻棋子……',
  '正在冶煉金屬……',
  '正在構造世界……',
]);

/**
 * 全站通用載入畫面（Loading Screen）
 *
 * 適用場景：
 * - 章節按需下載（`App.jsx` 的 `Suspense` 過場）
 * - 任何需要等待載入／處理的全頁或區塊級過場
 *
 * @param {object} props
 * @param {boolean} [props.fullScreen=false] - 是否撐滿整個視窗高度
 * @param {string|null} [props.message=null] - 若傳入固定文案則顯示該句；未傳則自動輪播 `LOADING_MESSAGES`
 * @param {string|null} [props.title='《物語手帳》'] - 進度條上方的標題文字（傳入 null 可隱藏）
 */
export default function LoadingScreen({
  fullScreen = false,
  message = null,
  title = '《物語手帳》',
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (message) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [message]);

  const displayMessage = message || LOADING_MESSAGES[index];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loading-screen"
      className={`flex flex-col items-center justify-center px-6 select-none text-[#2c221e] ${
        fullScreen ? 'min-h-screen w-full bg-[#fbf7ee]' : 'flex-1 w-full py-16'
      }`}
    >
      {title && (
        <div className="font-serif font-bold text-t14 text-[#3c2415] tracking-widest mb-3">
          {title}
        </div>
      )}

      {/* 長條載入軌道 */}
      <div
        data-testid="loading-bar-track"
        className="w-64 sm:w-80 h-2 bg-[#e8dcc4] border border-[#d6c7ab] rounded overflow-hidden p-0.5"
      >
        <div
          data-testid="loading-bar-fill"
          className="w-2/5 h-full bg-[#a63d40] rounded animate-loading-bar"
        />
      </div>

      {/* 下方輪播敘事文案 */}
      <p
        data-testid="loading-message"
        className="mt-3 text-t12 text-[#6b5a4b] font-serif tracking-wider"
      >
        {displayMessage}
      </p>
    </div>
  );
}

