import React from 'react';
import { GiGraveFlowers, GiTwoCoins, GiClover } from 'react-icons/gi';
import {
  getActiveClassResources,
  readResource,
  setResourceValue
} from '../data/classResources';

/**
 * 職業資源池（Class Resource Strip）
 *
 * ## 為什麼放在這裡，而不是「職業特技」分頁？
 *
 * 跑團卡的分頁（TAB 3 職業特技）放的是**要主動去操作的工具**——魔奏者合成器、
 * 植物學家花園盤、修補匠工坊。那些是你會特地切過去用的東西。
 *
 * 但職業資源池不是工具，是**不能忘記的計數器**：
 * - 【墳墓點】在咒語分頁施咒時要花 → 放進分頁得來回切
 * - 【幸運數字】任何時候擲骰都要看 → 放進分頁等於看不到
 *
 * 所以它與 HP／MP／IP 同屬「常駐資源」，渲染在資源量表正下方。
 * 且**只有對應職業的角色才會看到**——其他角色完全不會多出任何東西。
 *
 * 數值來源與判定邏輯全在 `data/classResources.js`（已逐條核對官方原書）。
 */

const ICONS = {
  gravePoints: GiGraveFlowers,
  tradePoints: GiTwoCoins,
  luckyNumber: GiClover
};

export default function ClassResourceStrip({ character, onChange, showToast = () => {} }) {
  const resources = getActiveClassResources(character);

  // 沒有對應職業 -> 完全不渲染，不對其他角色造成噪音
  if (resources.length === 0) return null;

  const writeValue = (resource, nextValue) => {
    onChange({
      ...character,
      classResources: setResourceValue(character, resource, nextValue),
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="p-3.5 rounded bg-white border border-[#d6c7ab] space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[#3c2415] flex items-center gap-1">
          <GiGraveFlowers className="w-3.5 h-3.5 text-[#6b5a4b]" />
          <span>職業資源</span>
        </span>
        <span className="text-t10 text-[#6b5a4b] font-mono">依職業自動出現</span>
      </div>

      <div className="space-y-2">
        {resources.map((resource) => {
          const value = readResource(character, resource);
          const Icon = ICONS[resource.id];
          const isPool = resource.kind === 'pool';
          const atMax = isPool && value >= resource.max;
          // 單值的下限不一定是 1——幸運數字最小是 1，但勇氣／顛覆點／懷疑點的原書起點是 0。
    const atMin = value <= (isPool ? 0 : (resource.min ?? 1));

          return (
            <div
              key={resource.id}
              className="flex items-center gap-2 flex-wrap p-2 rounded bg-[#f4ebd9] border border-[#d6c7ab]"
              title={resource.source ? `官方依據：${resource.source}` : undefined}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#3c2415] min-w-[5.5rem]">
                {Icon && <Icon className="w-4 h-4 text-[#6b5a4b] shrink-0" />}
                <span>{resource.label}</span>
              </span>

              {/* 減 */}
              <button
                type="button"
                disabled={atMin}
                onClick={() => writeValue(resource, value - 1)}
                className={`w-6 h-6 rounded border text-sm leading-none font-bold transition-colors ${
                  atMin
                    ? 'border-[#d6c7ab] text-[#d6c7ab] cursor-not-allowed'
                    : 'border-[#d6c7ab] text-[#3c2415] bg-[#f9f5eb] hover:bg-[#f4ebd9] cursor-pointer'
                }`}
              >
                −
              </button>

              {isPool ? (
                <span className="font-mono text-sm font-black text-[#3c2415] min-w-[3rem] text-center">
                  {value}
                  <span className="text-t11 font-bold text-[#6b5a4b]"> / {resource.max}</span>
                </span>
              ) : (
                <input
                  type="number"
                  min={1}
                  value={value}
                  onChange={(e) => writeValue(resource, e.target.value)}
                  className="w-14 px-1 py-0.5 rounded border border-[#d6c7ab] bg-white text-center font-mono text-sm font-black text-[#3c2415]"
                />
              )}

              {/* 加 */}
              <button
                type="button"
                disabled={atMax}
                onClick={() => writeValue(resource, value + 1)}
                className={`w-6 h-6 rounded border text-sm leading-none font-bold transition-colors ${
                  atMax
                    ? 'border-[#d6c7ab] text-[#d6c7ab] cursor-not-allowed'
                    : 'border-[#d6c7ab] text-[#3c2415] bg-[#f9f5eb] hover:bg-[#f4ebd9] cursor-pointer'
                }`}
              >
                +
              </button>

              {/* 重置：只在原書確有該規則時才出現（見 classResources.js 的 resetLabel） */}
              {resource.resetLabel && (
                <button
                  type="button"
                  onClick={() => {
                    writeValue(resource, resource.resetTo);
                    showToast(`【${resource.label}】已重置為 ${resource.resetTo}`, 'info');
                  }}
                  className="px-2 py-1 rounded border border-[#d6c7ab] bg-white text-t11 font-bold text-[#6b5a4b] hover:bg-[#e8dcc4] transition-colors cursor-pointer"
                >
                  {resource.resetLabel}
                </button>
              )}

              {resource.hint && (
                <span className="text-t10 text-[#6b5a4b] font-mono ml-auto">{resource.hint}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
