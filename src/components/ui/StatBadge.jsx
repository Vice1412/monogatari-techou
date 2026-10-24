import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
// 四個屬性的名字與顏色都只有一份定義（見 sourcebookConfig 的 ATTRIBUTE_NAMES／ATTRIBUTE_COLORS）。
// 這裡原本寫「力量」，而編輯器與三頁匯出寫「體魄」——同一組屬性在站上有兩個名字。
// 顏色也是同一個病、同一個藥：第二十一輪之前有五份拷貝，DEX 在角色卡上是琥珀、
// 在 NPC 工坊是藍色。名字與顏色現在都從那張表來，改一次就全站一致。
import { ATTRIBUTE_NAMES, ATTRIBUTE_COLORS } from '../../features/character-sheet/data/sourcebookConfig';

// 面全部相同（第十五輪）：四屬性的底色與邊框一律紙色，身份只由字色承擔。
// 舊版每個屬性各自帶 bg-*-50 與 border-*-400——那不是身份，是三層噪音，
// 而且底色一深一淺之後，「哪一個是靈巧」就不再只由一個訊號回答了。
const STAT_CONFIG = {
  dex: { name: ATTRIBUTE_NAMES.dex, en: 'DEX', color: ATTRIBUTE_COLORS.dex },
  ins: { name: ATTRIBUTE_NAMES.ins, en: 'INS', color: ATTRIBUTE_COLORS.ins },
  mig: { name: ATTRIBUTE_NAMES.mig, en: 'MIG', color: ATTRIBUTE_COLORS.mig },
  wlp: { name: ATTRIBUTE_NAMES.wlp, en: 'WLP', color: ATTRIBUTE_COLORS.wlp }
};

const VALID_TIERS = [6, 8, 10, 12];

export default function StatBadge({
  stat = 'dex',
  value = 8,
  onChange = null,
  size = 'md',
  showName = true,
  className = ''
}) {
  const cfg = STAT_CONFIG[stat.toLowerCase()] || STAT_CONFIG.dex;
  const isInteractive = typeof onChange === 'function';

  // Parse raw value to numeric tier for stepping
  const numValue = typeof value === 'string'
    ? (parseInt(value.replace('d', ''), 10) || 8)
    : (parseInt(value, 10) || 8);

  const displayVal = typeof value === 'string'
    ? (value.startsWith('d') ? value : `d${value}`)
    : `d${value}`;

  const handleStep = (step) => {
    if (!isInteractive) return;
    const currentIdx = VALID_TIERS.indexOf(numValue);
    const newIdx = currentIdx + step;
    if (newIdx >= 0 && newIdx < VALID_TIERS.length) {
      onChange(VALID_TIERS[newIdx]);
    }
  };

  return (
    <div
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-lg border border-[#d6c7ab] bg-[#fffdf9] px-2.5 py-1 select-none transition-all",
          size === 'sm' && "text-xs py-0.5 px-2",
          size === 'lg' && "text-base py-1.5 px-3",
          className
        )
      )}
    >
      {showName && (
        <span className={clsx("font-bold tracking-wider mr-2 font-mono text-xs flex items-center", cfg.color)}>
          {cfg.en}
          <span className="text-t10 text-[#6b5a4b] ml-1 font-sans hidden sm:inline">{cfg.name}</span>
        </span>
      )}

      {isInteractive && (
        <button
          type="button"
          onClick={() => handleStep(-1)}
          disabled={numValue <= 6}
          className="text-[#7c6a58] hover:text-[#3c2415] disabled:opacity-30 px-1 font-mono font-bold"
        >
          -
        </button>
      )}

      <span className="font-mono font-black text-[#2c221e] px-1.5">
        {displayVal}
      </span>

      {isInteractive && (
        <button
          type="button"
          onClick={() => handleStep(1)}
          disabled={numValue >= 12}
          className="text-[#7c6a58] hover:text-[#3c2415] disabled:opacity-30 px-1 font-mono font-bold"
        >
          +
        </button>
      )}
    </div>
  );
}
