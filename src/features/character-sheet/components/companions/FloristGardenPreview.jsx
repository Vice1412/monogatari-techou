import React, { useState } from 'react';
import { GiFlowerPot, GiBookCover } from 'react-icons/gi';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import {
  FLORIST_MAGISEEDS,
  GROWTH_CLOCK_MAX,
  isSeedEffectActiveAt
} from '../../data/skillSuboptionsData';
import { findCodexRule } from '../../data/ruleCodexData';
import { openRuleCodex } from '../../utils/skillFormulaEvaluator';

/**
 * 建角用的「花園與生長命刻」預覽盤 (FloristGardenPreview)
 *
 * 為什麼需要它：
 * 建角期間（`CharacterEditor` → `ClassSkillCard`）原本只有「魔法種子挑選器」——
 * 萌新學得到「這顆種子有什麼效果」，卻學不到「花園怎麼運作」。
 * 花園／生長命刻的畫面只存在於**跑團卡**（`CharacterPlayHUD` 掛的
 * `FloristGardenTracker`），所以正在車卡的人看不到那個機制長什麼樣。
 *
 * 這裡只做兩件事，刻意不做第三件：
 *  1. 把花園的四條鐵則用一句話講完（同時只容納 1 顆、回合結束 +1 格、
 *     滿 4 格離園並抹去格數）。
 *  2. 讓玩家**撥一格數**，看已挑選的每顆種子在該格數下「實際生效」的是哪一條。
 *     ——這是這個職業最反直覺的地方：官方規則是「只套用與當前填充格數
 *     **完全相同**的那一條，不是以上或以下」（`ruleCodexExpansion.js`）。
 *  3. **不**提供播種／推進／結算。那些是跑團中的操作，屬於 `FloristGardenTracker`。
 *     建角時能改動「花園裡現在有哪顆種子」只會製造兩套狀態。
 *
 * 「哪一階生效」一律走資料層的 `isSeedEffectActiveAt()`，元件不自己比對字串。
 *
 * @param {object}   props
 * @param {string[]} props.selectedOptions 已挑選的魔法種子名稱
 * @param {string}   props.skillName       技能名（用來查規則速查頁，預設【植生術】）
 * @param {number}   props.initialClock    測試注入點：SSR 不跑點擊，靠它渲染到指定格數。
 *                                         不傳時＝0，正式行為完全不變。
 */
export default function FloristGardenPreview({
  selectedOptions = [],
  skillName = '植生術',
  initialClock = 0
}) {
  const [previewClock, setPreviewClock] = useState(initialClock);

  const names = Array.isArray(selectedOptions) ? selectedOptions : [];
  const seeds = FLORIST_MAGISEEDS.filter((s) => names.includes(s.name));
  const codexRule = findCodexRule(skillName);

  return (
    <div
      data-testid="florist-garden-preview"
      className="mt-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-2"
    >
      {/* 標題列 ＋ 規則速查入口 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <GiFlowerPot className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="font-bold text-xs text-emerald-950 font-serif">花園與生長命刻</span>
          <span className="text-[10px] text-emerald-800/80">
            （建角預覽；播種與推進在跑團卡操作）
          </span>
        </div>

        {codexRule && (
          <button
            type="button"
            onClick={() => openRuleCodex(skillName)}
            title={`開啟規則速查「${codexRule.title}」（${codexRule.page}）`}
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
          >
            <GiBookCover className="w-3 h-3" />
            <span>規則速查：{codexRule.title}</span>
          </button>
        )}
      </div>

      {/* 花園鐵則（一句話） */}
      <p className="text-[10px] text-emerald-900/90 leading-relaxed">
        花園同時只容納 <strong>1 顆</strong>魔法種子；你的回合結束時填入 1 格；
        填滿第 {GROWTH_CLOCK_MAX} 格時種子離園，格數全部抹去。
      </p>

      {/* 生長命刻撥盤：預覽各格數下生效的階級 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-emerald-900">預覽格數</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: GROWTH_CLOCK_MAX + 1 }, (_, t) => t).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPreviewClock(t)}
              title={`預覽生長命刻 ${t} 格時生效的效果`}
              className={`w-6 h-6 rounded-md border text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                previewClock === t
                  ? 'bg-emerald-700 border-emerald-800 text-white'
                  : 'bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-emerald-800/80">
          只套用與 {previewClock} 格「完全相同」的那一階，不是以上或以下
        </span>
      </div>

      {/* 已挑選種子在該格數下的生效效果 */}
      {seeds.length > 0 ? (
        <div className="space-y-1">
          {seeds.map((seed) => {
            const active = (seed.effects || []).filter((ef) =>
              isSeedEffectActiveAt(ef.clock, previewClock)
            );
            return (
              <div
                key={seed.id || seed.name}
                className="p-1.5 rounded-lg bg-white border border-emerald-200/80 space-y-0.5"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-serif font-bold text-[11px] text-emerald-950">
                    {seed.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-700">
                    {previewClock} 格
                  </span>
                </div>

                {active.length > 0 ? (
                  active.map((ef, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px]">
                      <span className="font-mono font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-emerald-200">
                        {ef.clock}
                      </span>
                      <span className="text-slate-700 leading-relaxed font-sans">
                        {renderTextWithAffinities(ef.text)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-500 italic">
                    此格數沒有對應效果——該階不生效。
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-600 italic">
          尚未配置魔法種子。點上方「配置魔法種子」挑選後，這裡會顯示各格數下實際生效的效果。
        </p>
      )}
    </div>
  );
}
