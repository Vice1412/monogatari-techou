import React from 'react';
import { GiSparkles, GiMusicalNotes, GiCheckMark, GiDna2 } from 'react-icons/gi';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';
import CopyTextButton from '../../../components/ui/CopyTextButton';
import { formatSuboptionCopyText } from '../utils/playCopyFormat';
import { getSuboptionDetails, CHANTER_DATA } from '../data/skillSuboptionsData';
import {
  getTheriomorphosisRules,
  describeTheriomorphosis,
  isTheriomorphosisVariant
} from '../data/theriomorphosisVariant';

/**
 * 技能子項目效果即時速查卡片清單 (SuboptionDetailsList)
 *
 * 專為車卡管理卡片 (ClassSkillCard) 與跑團卡 (CharacterPlayHUD) 提供共用的子項目效果即時展開清單。
 * 涵蓋舞步、魔奏音調與曲風、心靈天賦、突變形態、魔法種子、徽記與三大法術學派咒語。
 * 支援魔奏者基礎 3 大音量常駐展示。
 */
export default function SuboptionDetailsList({
  className,
  skillName,
  selectedOptions = [],
  showVolumeBlock = true,
  classNameCustom = '',
  variantId = null,
  hasGreaterTheriomorphosis = false,
  characterName = '',
  showToast = null
}) {
  // 解析已掌握清單
  let rawList = [];
  if (Array.isArray(selectedOptions)) {
    rawList = selectedOptions;
  } else if (selectedOptions && typeof selectedOptions === 'object') {
    const keys = selectedOptions.keys || [];
    const tones = selectedOptions.tones || [];
    rawList = [
      ...keys.map(k => `音調: ${k}`),
      ...tones.map(t => `曲風: ${t}`)
    ];
  }

  const isChanter = className === '魔奏者' && skillName === '魔法演奏';

  // 突變體【混合變形】：形態庫與配額不受變體影響，變的是消耗、顯現上限與後續動作。
  const isTherioform = className === '突變體' && skillName === '混合變形';
  const therioRules = isTherioform ? getTheriomorphosisRules(variantId) : null;
  const therioLines = isTherioform
    ? describeTheriomorphosis(therioRules, { hasGreater: hasGreaterTheriomorphosis })
    : [];

  const resolvedCards = rawList
    .map((rawName, idx) => ({
      rawName,
      idx,
      detail: getSuboptionDetails(className, skillName, rawName)
    }))
    .filter((entry) => Boolean(entry.detail));

  return (
    <div className={`space-y-2.5 ${classNameCustom}`}>
      {/* 1. 魔奏者專屬：基礎 3 大音量常駐外顯卡片 */}
      {isChanter && showVolumeBlock && (
        <div className="p-2.5 rounded bg-[#f9f5eb] border border-[#d6c7ab] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#3c2415] border-b border-[#e8dcc4] pb-1.5">
            <span className="flex items-center gap-1.5">
              <GiMusicalNotes className="w-3.5 h-3.5 text-[#3c2415]" />
              <span>基礎音量體系（自動掌握全部 3 種音量）</span>
            </span>
            <span className="text-t10 text-[#6b5a4b] font-normal">
              無須消耗配額
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {CHANTER_DATA.volumes.map(vol => (
              <div
                key={vol.id}
                className="p-2 bg-white rounded border border-[#e8dcc4] space-y-1 min-w-0"
              >
                <div className="flex items-center justify-between font-bold text-xs gap-1">
                  <span className="text-[#3c2415] font-serif">{vol.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab] tabular-nums text-t10 font-bold shrink-0">
                    {vol.mp} MP
                  </span>
                </div>
                <div className="text-t10 text-[#6b5a4b] font-medium">
                  目標：{vol.target}
                </div>
                <p className="text-t11 text-[#3c2415] leading-snug">
                  {renderTextWithAffinities(vol.desc)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1.5 突變體【混合變形】：使用方式常駐外顯（原版與公測 p.40 變體差在這裡） */}
      {isTherioform && (
        <div
          data-testid="therioform-usage"
          className="p-2.5 rounded bg-[#f9f5eb] border border-[#8c2d36]/30 space-y-1"
        >
          <div className="flex items-center justify-between text-xs font-bold text-[#8c2d36] border-b border-[#8c2d36]/30 pb-1.5 gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <GiDna2 className="w-3.5 h-3.5 text-[#8c2d36]" />
              <span>{therioRules.label}：使用方式</span>
            </span>
            {isTheriomorphosisVariant(variantId) && (
              <span className="text-t10 px-1.5 py-0.5 rounded bg-white text-[#8c2d36] border border-[#8c2d36]/50 font-bold">
                【公測】變體
              </span>
            )}
          </div>
          {therioLines.map((line) => (
            <div key={line} className="text-t11 leading-snug text-[#3c2415]">
              {line}
            </div>
          ))}
        </div>
      )}

      {/* 2. 已選子項目詳細微卡片清單 */}
      {rawList.length > 0 ? (
        <div
          data-testid="suboption-details-grid"
          className={`grid gap-2 ${resolvedCards.length <= 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}
        >
          {resolvedCards.map(({ rawName, idx, detail }) => {
            const isOffensive = detail.isOffensive;
            const isChanterKey = detail.itemType === 'key' || String(rawName).startsWith('音調:');
            const isChanterTone = detail.itemType === 'tone' || String(rawName).startsWith('曲風:');
            const hasMetaTags = Boolean(detail.mp || detail.duration || detail.target || detail.event);

            return (
              <div
                key={`${detail.name || rawName}_${idx}`}
                data-testid={`suboption-detail-card-${idx}`}
                className="p-2.5 rounded border border-[#e8dcc4] bg-white/95 hover:border-[#7c6a58] transition-all space-y-1.5 text-xs min-w-0"
              >
                {/* 卡片標題與複製鈕（固定單行兩端對齊，不再與長標籤擠成一列爆框） */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[#3c2415] text-xs shrink-0">✦</span>
                    {isOffensive && (
                      <span className="fu-icon text-[#8c2d36] font-bold shrink-0" title="攻擊性咒語">
                        o
                      </span>
                    )}
                    <span className="font-bold text-[#2c221e] font-serif text-t12 tracking-wide">
                      {detail.name}
                    </span>

                    {/* 分類標籤 (如 音調 / 曲風) */}
                    {isChanterKey && (
                      <span className="text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] font-bold border border-[#d6c7ab]">
                        音調
                      </span>
                    )}
                    {isChanterTone && (
                      <span className="text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] font-bold border border-[#d6c7ab]">
                        曲風
                      </span>
                    )}
                  </div>

                  <CopyTextButton
                    testId={`copy-suboption-${idx}`}
                    toastLabel={detail.name}
                    showToast={showToast}
                    getText={() =>
                      formatSuboptionCopyText({
                        className,
                        skillName,
                        categoryLabel: isChanterKey ? '音調' : isChanterTone ? '曲風' : '',
                        detail,
                        characterName
                      })
                    }
                  />
                </div>

                {/* 數值與目標標籤列：移除 shrink-0，允許在窄欄卡內自動換行，絕不衝出右側邊界 */}
                {hasMetaTags && (
                  <div
                    data-testid={`suboption-meta-tags-${idx}`}
                    className="flex items-center gap-1 text-t10 flex-wrap min-w-0"
                  >
                    {detail.mp && (
                      <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] tabular-nums font-bold border border-[#d6c7ab]">
                        {detail.mp} MP
                      </span>
                    )}
                    {detail.duration && (
                      <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]">
                        持續：{detail.duration}
                      </span>
                    )}
                    {detail.target && (
                      <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab] font-sans">
                        目標：{detail.target}
                      </span>
                    )}
                    {detail.event && (
                      <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab] font-sans">
                        時機：{detail.event}
                      </span>
                    )}
                  </div>
                )}

                {/* 寓意 / 語錄 */}
                {detail.quote && (
                  <div className="text-t11 text-[#3c2415] italic">
                    「{detail.quote}」
                  </div>
                )}
                {detail.examples && (
                  <div className="text-t10 text-[#6b5a4b]">
                    象徵範例：{detail.examples}
                  </div>
                )}

                {/* 核心效果描述（透過 renderTextWithAffinities 內聯渲染官方符號與色彩） */}
                {detail.effect && (
                  <p className="text-t11 text-[#3c2415] leading-relaxed font-sans">
                    {renderTextWithAffinities(detail.effect)}
                  </p>
                )}
                {detail.desc && !detail.effect && (
                  <p className="text-t11 text-[#3c2415] leading-relaxed font-sans">
                    {renderTextWithAffinities(detail.desc)}
                  </p>
                )}

                {/* 植物學家多階刻度與回合效果 */}
                {detail.effects && Array.isArray(detail.effects) && (
                  <div className="mt-1.5 pt-1.5 border-t border-[#e8dcc4] space-y-1.5">
                    {detail.effects.map((ef, eIdx) => (
                      <div key={eIdx} className="text-t11 flex items-start gap-1.5">
                        <span className="font-mono font-bold text-[#2c221e] bg-[#f4ebd9] px-1.5 py-0.5 rounded text-t10 shrink-0 border border-[#d6c7ab]">
                          {ef.clock}
                        </span>
                        <span className="text-[#3c2415] leading-relaxed font-sans">
                          {renderTextWithAffinities(ef.text)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-3 text-center bg-[#fbf7ee]/80 rounded border border-dashed border-[#d6c7ab] text-[#6b5a4b] text-xs italic">
          尚未配置任何項目。請點擊上方按鈕展開清單完成角色構築。
        </div>
      )}
    </div>
  );
}
