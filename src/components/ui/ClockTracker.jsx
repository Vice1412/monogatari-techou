import React from 'react';
import { clsx } from 'clsx';
import { RotateCcw, Plus, Minus } from 'lucide-react';
import { IDENTITY } from '../../data/identityPalette';

/** `fill` 的 15% 底色。由 fill 推導，避免「同一個顏色寫兩次」。 */
const tint = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * 命刻的六種主題。**這是一個封閉集合**：每一項的 `id` 必須等於它的鍵，
 * 而且六個 `fill` 必須兩兩不同——顏色在這裡表達的是「這是哪一顆命刻」（身份），
 * 兩顆命刻共用一個顏色，使用者就只能靠讀標題分辨。
 *
 * 第十二輪刪掉了原本的第七項 emerald：它的 id 寫的是 green、色碼與 green 一字不差，
 * 等於下拉選單裡有兩個同名同色的「翡翠綠」。舊存檔若存了 emerald，
 * 由下面的 CLOCK_THEME_ALIAS 接住，畫面不會突然變色。
 *
 * ## 第三十八輪（§CI46）：這張表不再自己寫色碼
 *
 * 原本六個 `fill`／`stroke` 是**手寫的第二份身份表**，而它與
 * `characterThemes` 的 `accent`／`accentDark` **一字不差**——只是欄位名不一樣
 * （`fill`/`stroke` vs `accent`/`accentDark`）。同一個值兩個名字，改一邊就分家，
 * 而畫面上不會有任何錯誤。
 *
 * 現在三個值全部從 `src/data/identityPalette.js` 取：`fill` ＝ `accent`、
 * `stroke` ＝ `dark`、`bg` ＝ `fill` 的 15%。所以「六個 fill 兩兩不同」
 * 這條不變式**繼承自身份色本身**（H35-d 已經在守），不需要在這裡重複宣告一次。
 *
 * 為什麼不是直接 import `characterThemes`：`ClockTracker` 是通用元件
 * （角色卡、戰鬥輪次、命刻頁、工匠工坊都在用），反過來依賴角色卡模組
 * 會讓依賴方向倒過來。
 */
const clockTheme = (id, name, identityId) => {
  const identity = IDENTITY[identityId];
  return {
    id,
    name,
    fill: identity.accent,
    stroke: identity.dark,
    bg: tint(identity.accent, 0.15),
  };
};

export const CLOCK_THEMES = {
  amber: clockTheme('amber', '琥珀棕', 'amber'),
  red: clockTheme('red', '赤紅', 'crimson'),
  blue: clockTheme('blue', '群青藍', 'blue'),
  green: clockTheme('green', '翡翠綠', 'emerald'),
  purple: clockTheme('purple', '秘術紫', 'purple'),
  gray: clockTheme('gray', '鐵石灰', 'slate'),
};

/** 舊鍵 → 現行鍵。只為了讓舊存檔維持同一個顏色，不是第七種主題。 */
export const CLOCK_THEME_ALIAS = { emerald: 'green' };

export default function ClockTracker({
  title = '',
  totalSegments = 6,
  filledSegments = 0,
  onChange = null,
  onFilledChange = null,
  theme = 'amber',
  type = 'circle', // 'circle' | 'line'
  size = 120,
  showControls = true,
  compact = false,
  className = ''
}) {
  const actualOnChange = onChange || onFilledChange;
  const t = CLOCK_THEMES[theme] || CLOCK_THEMES[CLOCK_THEME_ALIAS[theme]] || CLOCK_THEMES.amber;
  const isInteractive = typeof actualOnChange === 'function';

  const handleSliceClick = (index) => {
    if (!isInteractive) return;
    if (filledSegments === index + 1) {
      actualOnChange(index);
    } else {
      actualOnChange(index + 1);
    }
  };

  const handleStep = (step) => {
    if (!isInteractive) return;
    const nextVal = Math.max(0, Math.min(totalSegments, filledSegments + step));
    actualOnChange(nextVal);
  };

  const handleReset = () => {
    if (!isInteractive) return;
    actualOnChange(0);
  };

  // SVG Circular Clock
  const renderCircleClock = () => {
    const center = size / 2;
    const radius = center - 8;
    const slices = [];

    for (let i = 0; i < totalSegments; i++) {
      const startAngle = (i * 360) / totalSegments - 90;
      const endAngle = ((i + 1) * 360) / totalSegments - 90;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const largeArc = 360 / totalSegments > 180 ? 1 : 0;
      const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const isFilled = i < filledSegments;

      slices.push(
        <path
          key={i}
          d={pathData}
          fill={isFilled ? t.fill : '#f4ebd9'}
          stroke="#fffdf9"
          strokeWidth="2.5"
          className={clsx(
            "transition-all duration-150 origin-center",
            isInteractive && "cursor-pointer hover:opacity-85"
          )}
          onClick={() => handleSliceClick(i)}
        />
      );
    }

    return (
      <div className="relative inline-flex items-center justify-center select-none" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
          {/* Outer ring */}
          <circle
            cx={center}
            cy={center}
            r={radius + 3}
            fill="none"
            stroke={t.stroke}
            strokeWidth="2.5"
          />
          {slices}
          {/* Center core */}
          <circle
            cx={center}
            cy={center}
            r={radius * 0.3}
            fill="#fbf7ee"
            stroke={t.stroke}
            strokeWidth="1.5"
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-mono font-bold text-xs text-[#2c221e]">
            {filledSegments}/{totalSegments}
          </span>
        </div>
      </div>
    );
  };

  // Line Clock Builder
  const renderLineClock = () => {
    return (
      <div className="w-full select-none">
        <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
          <span className="text-[#3c2415] font-bold">{title || '進度命刻'}</span>
          <span style={{ color: t.fill }} className="font-black">{filledSegments} / {totalSegments}</span>
        </div>
        <div className="flex gap-1.5 w-full h-4 bg-[#f4ebd9] p-0.5 rounded border border-[#d6c7ab]">
          {Array.from({ length: totalSegments }).map((_, idx) => (
            <div
              key={idx}
              onClick={() => handleSliceClick(idx)}
              className={clsx(
                "flex-1 rounded transition-all duration-150",
                idx < filledSegments
                  ? "shadow-sm"
                  : "bg-[#e8dcc4] hover:bg-[#d6c7ab]",
                isInteractive && "cursor-pointer"
              )}
              style={{
                backgroundColor: idx < filledSegments ? t.fill : undefined
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <div className={clsx("inline-flex items-center gap-2", className)}>
        {type === 'circle' ? renderCircleClock() : renderLineClock()}
      </div>
    );
  }

  return (
    <div className={clsx("bg-[#fffdf9] border border-[#d6c7ab] rounded p-4 flex flex-col items-center gap-3 relative text-[#2c221e]", className)}>
      {title && (
        <h4 className="font-bold text-sm text-[#3c2415] text-center tracking-wide line-clamp-1">
          {title}
        </h4>
      )}

      {type === 'circle' ? renderCircleClock() : renderLineClock()}

      {showControls && isInteractive && (
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={filledSegments <= 0}
            className="p-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] disabled:opacity-30 transition-colors"
            title="減 1"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={filledSegments === 0}
            className="p-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#6b5a4b] hover:text-[#2c221e] border border-[#d6c7ab] disabled:opacity-30 transition-colors"
            title="重置"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={filledSegments >= totalSegments}
            className="p-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] disabled:opacity-30 transition-colors"
            title="加 1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
