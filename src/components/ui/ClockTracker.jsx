import React from 'react';
import { clsx } from 'clsx';
import { RotateCcw, Plus, Minus } from 'lucide-react';

/**
 * 命刻的六種主題。**這是一個封閉集合**：每一項的 `id` 必須等於它的鍵，
 * 而且六個 `fill` 必須兩兩不同——顏色在這裡表達的是「這是哪一顆命刻」（身份），
 * 兩顆命刻共用一個顏色，使用者就只能靠讀標題分辨。
 *
 * 第十二輪刪掉了原本的第七項 emerald：它的 id 寫的是 green、色碼與 green 一字不差，
 * 等於下拉選單裡有兩個同名同色的「翡翠綠」。舊存檔若存了 emerald，
 * 由下面的 CLOCK_THEME_ALIAS 接住，畫面不會突然變色。
 */
export const CLOCK_THEMES = {
  amber: { id: 'amber', name: '琥珀棕', fill: '#9c4d16', stroke: '#693108', bg: 'rgba(156, 77, 22, 0.15)' },
  red: { id: 'red', name: '赤紅', fill: '#8c2d36', stroke: '#58171e', bg: 'rgba(140, 45, 54, 0.15)' },
  blue: { id: 'blue', name: '群青藍', fill: '#27527a', stroke: '#17324c', bg: 'rgba(39, 82, 122, 0.15)' },
  green: { id: 'green', name: '翡翠綠', fill: '#245c45', stroke: '#133829', bg: 'rgba(36, 92, 69, 0.15)' },
  purple: { id: 'purple', name: '秘術紫', fill: '#5e387c', stroke: '#3a1f4f', bg: 'rgba(94, 56, 124, 0.15)' },
  gray: { id: 'gray', name: '鐵石灰', fill: '#404a58', stroke: '#20262f', bg: 'rgba(64, 74, 88, 0.15)' }
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
          fill={isFilled ? t.fill : '#eee6d3'}
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
        <div className="flex gap-1.5 w-full h-4 bg-[#f4ebd9] p-0.5 rounded-lg border border-[#d6c7ab]">
          {Array.from({ length: totalSegments }).map((_, idx) => (
            <div
              key={idx}
              onClick={() => handleSliceClick(idx)}
              className={clsx(
                "flex-1 rounded transition-all duration-150",
                idx < filledSegments
                  ? "shadow-sm"
                  : "bg-[#e4d9c0] hover:bg-[#d6c7ab]",
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
    <div className={clsx("bg-[#fffdf9] border border-[#d6c7ab] rounded-xl p-4 flex flex-col items-center gap-3 relative text-[#2c221e]", className)}>
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
            className="p-1 rounded-md bg-[#eee6d3] hover:bg-[#e4d9c0] text-[#3c2f21] border border-[#d6c7ab] disabled:opacity-30 transition-colors"
            title="減 1"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={filledSegments === 0}
            className="p-1 rounded-md bg-[#eee6d3] hover:bg-[#e4d9c0] text-[#6b5a4b] hover:text-[#2c221e] border border-[#d6c7ab] disabled:opacity-30 transition-colors"
            title="重置"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={filledSegments >= totalSegments}
            className="p-1 rounded-md bg-[#eee6d3] hover:bg-[#e4d9c0] text-[#3c2f21] border border-[#d6c7ab] disabled:opacity-30 transition-colors"
            title="加 1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
