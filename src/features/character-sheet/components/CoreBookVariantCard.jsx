import React from 'react';
import { GiScrollUnfurled, GiCheckMark } from 'react-icons/gi';
import SkillDescription from '../utils/skillFormulaEvaluator';

/**
 * 核心書技能變體卡片（Core Book Variant Card）
 *
 * ## 使用者裁定的鐵律
 *
 * 「Core Book Variants 所修改的內容，是要勾選【官方公測修訂】才會出現的項目，
 *   千萬不可用修改到原本規則書的內容。勾選之後，那些有改過的內容要在後面標記【公測】，
 *   然後和原版的技能同時存在，並把不一樣的內容粗體化讓用戶看到。」
 *
 * ## 選用機制（2026-10-14 GM 裁定）
 *
 * 「照官方。公測按鈕是玩家點的，不是 GM。開角色卡的人是玩家……
 *   然後玩家自己點。選用之後，原版要收起來。」
 *
 * 官方依據（Playtest 2026-10-01, PDF p.34）：
 *   「Variant Skills are **a choice each Player may make individually**.」
 * → 所以這是**玩家的選用鈕**，不是 GM 開關。
 *
 * ## 兩種呈現狀態
 *
 * - **未選用**：只讀卡片 ＋ 一顆「選用此變體」鈕（點下去＝用變體取代原版）
 * - **已選用**：卡片標「使用中」＋ 一顆「改回原版」鈕；此時原版技能在
 *   上層畫面被**收起來**（由呼叫端處理，不由本卡負責）
 *
 * @param {object}   variant      data/coreBookVariants.js 的一筆
 * @param {object}   theme        角色卡主題
 * @param {boolean}  isSelected   這個技能條目目前是否選用了這個變體
 * @param {Function} onToggle     `(variantId | null) => void`；點「選用」傳 id、點「改回原版」傳 null
 * @param {boolean}  disabled     唯讀情境（角色卡瀏覽／跑團面板）不給按
 * @param {string}   disabledHint disabled 時顯示的原因
 */
export default function CoreBookVariantCard({
  variant,
  theme,
  isSelected = false,
  onToggle,
  disabled = false,
  disabledHint = ''
}) {
  if (!variant) return null;

  /** 唯讀模式＝沒有給 onToggle。此時不顯示任何按鈕，維持原本的純瀏覽卡。 */
  const interactive = typeof onToggle === 'function';
  const canPress = interactive && !disabled;

  return (
    <div
      className="p-2.5 sm:p-3 rounded space-y-2 shadow-2xs transition-colors"
      style={{
        backgroundColor: isSelected
          ? (theme?.highlightBg || theme?.subpanelBg || '#f4ebd9')
          : (theme?.subpanelBg || '#f4ebd9'),
        borderColor: isSelected
          ? (theme?.accent || '#c9a227')
          : (theme?.border || '#e8dcc4'),
        borderWidth: isSelected ? 2 : 1,
        borderStyle: isSelected ? 'solid' : 'dashed',
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-t10 font-black px-1.5 py-0.5 rounded border shrink-0"
          style={{ borderColor: theme?.accent || '#c9a227', color: theme?.accent || '#a16207' }}>
          公測
        </span>
        {isSelected && (
          <span className="text-t10 font-black px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5 text-white"
            style={{ backgroundColor: theme?.accent || '#a16207' }}>
            <GiCheckMark className="w-2.5 h-2.5" />
            使用中
          </span>
        )}
        <span className="font-serif font-black text-sm whitespace-nowrap shrink-0"
          style={{ color: theme?.textDark || '#3c2415' }}>
          {variant.name}
        </span>
        <span className="text-t10 font-mono shrink-0" style={{ color: theme?.textMuted || '#8a7a63' }}>
          {variant.en}
        </span>
        <span className="text-t10 font-mono shrink-0" style={{ color: theme?.textMuted || '#8a7a63' }}>
          SL 上限 {variant.maxSL}
        </span>
        <span className="text-t10 shrink-0" style={{ color: theme?.textMuted || '#8a7a63' }}>
          取代【{variant.replaces}】
        </span>
      </div>

      <div className="text-xs sm:text-t12 leading-relaxed" style={{ color: theme?.textDark || '#3c2415' }}>
        <SkillDescription desc={variant.desc} sl={0} linkCodex={false} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        <div className="flex items-start gap-1 text-t10 flex-1 min-w-[180px]" style={{ color: theme?.textMuted || '#8a7a63' }}>
          <GiScrollUnfurled className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{variant.origin}。粗體＝與原版不同的機制。</span>
        </div>

        {interactive && (
          <button
            type="button"
            disabled={!canPress}
            onClick={() => onToggle(isSelected ? null : variant.id)}
            title={
              disabled
                ? (disabledHint || '目前不能調整')
                : isSelected
                  ? `改回原版【${variant.replaces}】`
                  : `用【${variant.name}】取代原版【${variant.replaces}】`
            }
            className={`text-t11 font-bold px-2.5 py-1 rounded border transition-all shrink-0 ${
              canPress ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed opacity-45'
            }`}
            style={isSelected
              ? { backgroundColor: theme?.cardBg || '#fff', borderColor: theme?.border || '#e8dcc4', color: theme?.textDark || '#3c2415' }
              : { backgroundColor: theme?.accent || '#a16207', borderColor: theme?.accentDark || theme?.accent || '#a16207', color: '#fff' }}
          >
            {isSelected ? '改回原版' : '選用此變體'}
          </button>
        )}
      </div>

      {interactive && disabled && disabledHint && (
        <p className="text-t10 italic" style={{ color: theme?.textMuted || '#8a7a63' }}>
          {disabledHint}
        </p>
      )}
    </div>
  );
}
