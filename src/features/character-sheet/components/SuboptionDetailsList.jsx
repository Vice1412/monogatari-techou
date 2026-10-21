import React from 'react';
import { GiSparkles, GiMusicalNotes, GiCheckMark, GiDna2 } from 'react-icons/gi';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';
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
  hasGreaterTheriomorphosis = false
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

  return (
    <div className={`space-y-2.5 ${classNameCustom}`}>
      {/* 1. 魔奏者專屬：基礎 3 大音量常駐外顯卡片 */}
      {isChanter && showVolumeBlock && (
        <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/90 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900 border-b border-purple-200/60 pb-1.5">
            <span className="flex items-center gap-1.5">
              <GiMusicalNotes className="w-3.5 h-3.5 text-purple-700" />
              <span>基礎音量體系（自動掌握全部 3 種音量）</span>
            </span>
            <span className="text-[10px] text-purple-700 font-normal">
              無須消耗配額
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {CHANTER_DATA.volumes.map(vol => (
              <div
                key={vol.id}
                className="p-2 bg-white rounded-lg border border-purple-100/90 shadow-2xs space-y-1"
              >
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="text-purple-950 font-serif">{vol.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 font-mono text-[10px] font-bold">
                    {vol.mp} MP
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  目標：{vol.target}
                </div>
                <p className="text-[11px] text-slate-700 leading-snug">
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
          className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/90 space-y-1"
        >
          <div className="flex items-center justify-between text-xs font-bold text-rose-900 border-b border-rose-200/60 pb-1.5 gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <GiDna2 className="w-3.5 h-3.5 text-rose-700" />
              <span>{therioRules.label}：使用方式</span>
            </span>
            {isTheriomorphosisVariant(variantId) && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-rose-800 border border-rose-300 font-bold">
                【公測】變體
              </span>
            )}
          </div>
          {therioLines.map((line) => (
            <div key={line} className="text-[11px] leading-snug text-slate-700">
              {line}
            </div>
          ))}
        </div>
      )}

      {/* 2. 已選子項目詳細微卡片清單 */}
      {rawList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {rawList.map((rawName, idx) => {
            const detail = getSuboptionDetails(className, skillName, rawName);
            if (!detail) return null;

            const isOffensive = detail.isOffensive;
            const isChanterKey = detail.itemType === 'key' || String(rawName).startsWith('音調:');
            const isChanterTone = detail.itemType === 'tone' || String(rawName).startsWith('曲風:');

            return (
              <div
                key={`${detail.name || rawName}_${idx}`}
                className="p-2.5 rounded-xl border border-amber-200/80 bg-white/95 shadow-2xs hover:border-amber-300 transition-all space-y-1.5 text-xs"
              >
                {/* 卡片標題與標籤列 */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-amber-500 text-xs">✦</span>
                    {isOffensive && (
                      <span className="fu-icon text-red-600 font-bold" title="攻擊性咒語">
                        o
                      </span>
                    )}
                    <span className="font-bold text-amber-950 font-serif text-[13px] tracking-wide truncate">
                      {detail.name}
                    </span>

                    {/* 分類標籤 (如 音調 / 曲風) */}
                    {isChanterKey && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold border border-amber-200">
                        音調
                      </span>
                    )}
                    {isChanterTone && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 font-bold border border-purple-200">
                        曲風
                      </span>
                    )}
                  </div>

                  {/* 右側數值標籤群 */}
                  <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono flex-wrap">
                    {detail.mp && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold border border-indigo-200">
                        {detail.mp} MP
                      </span>
                    )}
                    {detail.duration && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        持續：{detail.duration}
                      </span>
                    )}
                    {detail.target && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-sans">
                        目標：{detail.target}
                      </span>
                    )}
                    {detail.event && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200 font-sans">
                        時機：{detail.event}
                      </span>
                    )}
                  </div>
                </div>

                {/* 寓意 / 語錄 */}
                {detail.quote && (
                  <div className="text-[11px] text-emerald-800 italic">
                    「{detail.quote}」
                  </div>
                )}
                {detail.examples && (
                  <div className="text-[10px] text-slate-500">
                    象徵範例：{detail.examples}
                  </div>
                )}

                {/* 核心效果描述（透過 renderTextWithAffinities 內聯渲染官方符號與色彩） */}
                {detail.effect && (
                  <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                    {renderTextWithAffinities(detail.effect)}
                  </p>
                )}
                {detail.desc && !detail.effect && (
                  <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                    {renderTextWithAffinities(detail.desc)}
                  </p>
                )}

                {/* 植物學家多階刻度與回合效果 */}
                {detail.effects && Array.isArray(detail.effects) && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-1.5">
                    {detail.effects.map((ef, eIdx) => (
                      <div key={eIdx} className="text-[11px] flex items-start gap-1.5">
                        <span className="font-mono font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-emerald-200">
                          {ef.clock}
                        </span>
                        <span className="text-slate-700 leading-relaxed font-sans">
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
        <div className="p-3 text-center bg-slate-50/80 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs italic">
          尚未配置任何項目。請點擊上方按鈕展開清單完成角色構築。
        </div>
      )}
    </div>
  );
}
