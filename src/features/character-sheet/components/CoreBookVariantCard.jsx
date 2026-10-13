import React from 'react';
import { GiScrollUnfurled } from 'react-icons/gi';
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
 * 所以這張卡**只新增**：它出現在原版技能旁邊，原版技能一個字都不動。
 * `desc` 裡的 `**...**` 由 `SkillDescription` 渲染成粗體（專案既有的格式），
 * 標的是**與原版機制不同**的地方。
 *
 * @param {object} variant data/coreBookVariants.js 的一筆
 * @param {object} theme 角色卡主題
 */
export default function CoreBookVariantCard({ variant, theme }) {
  if (!variant) return null;
  return (
    <div
      className="p-2.5 sm:p-3 rounded-xl border space-y-2 shadow-2xs"
      style={{
        backgroundColor: theme?.subpanelBg || '#f5efdf',
        borderColor: theme?.accent || '#c9a227',
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0"
          style={{ borderColor: theme?.accent || '#c9a227', color: theme?.accent || '#a16207' }}>
          公測
        </span>
        <span className="font-serif font-black text-sm whitespace-nowrap shrink-0"
          style={{ color: theme?.textDark || '#3c2415' }}>
          {variant.name}
        </span>
        <span className="text-[10px] font-mono shrink-0" style={{ color: theme?.textMuted || '#8a7a63' }}>
          {variant.en}
        </span>
        <span className="text-[10px] font-mono shrink-0" style={{ color: theme?.textMuted || '#8a7a63' }}>
          SL 上限 {variant.maxSL}
        </span>
        <span className="text-[10px] shrink-0" style={{ color: theme?.textMuted || '#8a7a63' }}>
          取代【{variant.replaces}】
        </span>
      </div>

      <div className="text-xs sm:text-[13px] leading-relaxed" style={{ color: theme?.textDark || '#3c2415' }}>
        <SkillDescription desc={variant.desc} sl={0} linkCodex={false} />
      </div>

      <div className="flex items-start gap-1 text-[10px]" style={{ color: theme?.textMuted || '#8a7a63' }}>
        <GiScrollUnfurled className="w-3 h-3 mt-0.5 shrink-0" />
        <span>{variant.origin}。粗體＝與原版不同的機制。</span>
      </div>
    </div>
  );
}
