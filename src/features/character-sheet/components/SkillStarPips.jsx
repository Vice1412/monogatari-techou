import React from 'react';

/**
 * 技能等級星芒指示器 (Skill Star Pips)
 * 滿足需求 2：Max SL 視覺化為星星，每點選一次填滿一顆星，直觀呈現投入的點數。
 * 遵循零 Emoji 規範，採用純向量 SVG 繪製。
 */
export default function SkillStarPips({
  maxSL = 5,
  currentSL = 0,
  onChange = null,
  disabled = false,
  size = 18,
  className = ''
}) {
  const safeMax = Math.max(1, maxSL);
  const safeCurrent = Math.max(0, Math.min(safeMax, currentSL));

  return (
    <div className={`inline-flex items-center gap-1 select-none ${className}`}>
      {Array.from({ length: safeMax }).map((_, idx) => {
        const starLevel = idx + 1;
        const isFilled = starLevel <= safeCurrent;

        return (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled || !onChange) return;
              // 點選當前已滿星星時，將等級降一階（如點擊 SL 1 降為 0）
              const nextSL = safeCurrent === starLevel ? starLevel - 1 : starLevel;
              onChange(nextSL);
            }}
            className={`transition-all duration-150 transform ${
              disabled
                ? 'cursor-default'
                : 'cursor-pointer hover:scale-120 active:scale-95 focus:outline-none'
            }`}
            title={
              disabled
                ? `技能等級：SL ${safeCurrent} / ${safeMax}`
                : `點擊設定為 SL ${starLevel} / ${safeMax}（再點一次可扣減）`
            }
            aria-label={`設定為 SL ${starLevel} / ${safeMax}`}
            aria-pressed={isFilled}
          >
            {/* `w` 是官方 `.fu-icon` 字型的 glyph 映射碼，視覺上是星芒。
                它**不是內容**——沒有 aria-hidden 的話，螢幕閱讀器會把
                「阿爾卡納圓環 SL 0/4」念成「阿爾卡納圓環 w w w w SL 0/4」
                （2026-10-20 實測，見 `docs/playtest/findings.md` F-009）。 */}
            <span
              aria-hidden="true"
              className={`fu-icon inline-flex items-center justify-center leading-none transition-all duration-150 ${
                isFilled
                  ? 'text-amber-500 drop-shadow-[0_1px_3px_rgba(245,158,11,0.45)] scale-110'
                  : 'text-slate-300 opacity-40 hover:opacity-90 hover:text-amber-400'
              }`}
              style={{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }}
            >
              w
            </span>
          </button>
        );
      })}

      <span className="font-mono text-xs font-bold text-slate-500 ml-1">
        SL {safeCurrent}/{safeMax}
      </span>
    </div>
  );
}
