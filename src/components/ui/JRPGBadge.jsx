import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function JRPGBadge({
  children,
  variant = 'ink',
  size = 'sm',
  className = '',
  icon: Icon,
  ...props
}) {
  const baseStyles = "inline-flex items-center font-mono font-medium rounded-md select-none tracking-wide transition-colors";

  const variantStyles = {
    // ── 身份（紙／墨）：第三十三輪 §CI41 起，六個角色主題共用同一個身份徽章 ──
    //
    // 為什麼可以共用：徽章的內容是 `Lv N`（等級數字），身份由文字承載；
    // 色相只是重複編碼——與 §CI34 味覺去色同一個判準。
    // 為什麼必須共用：色相是保留色（`speciesThemes` 七族各佔一色），徽章借用
    // 等於偷別人的身份；而且六個主題原本指向 `gold/amber/rose/green/purple/indigo`
    // 六個鍵，其中 `blue → cyan` 指向一個已刪除的鍵，靜默 fallback 成金色
    // （與 amber 主題撞色），`slate` 又借用了「序」的通道。
    ink: "bg-[#f9f5eb] text-[#3c2415] border border-[#d6c7ab] font-bold",

    // ── 語意（不帶色相，或帶登記過的語意色）──
    // 中性（無語意，例如「非玩家」）：比身份徽章更淡一階，不加粗
    zinc: "bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab]",
    // 危險極性：唯一允許紅色的語意出口，色值＝登記色 #8c2d36（不是新的紅）
    danger: "bg-[#f9f5eb] text-[#8c2d36] border border-[#8c2d36]/50 font-bold",
    // 序（冠位 > 精英 > 一般）：靠填充量分級，不靠色相
    "rank-top": "bg-[#2c221e] text-[#e8dcc4] border border-[#2c221e] font-bold",
    "rank-mid": "bg-[#7c6a58] text-[#fbf7ee] border border-[#7c6a58] font-bold",
    // 序的第三階（一般）：紙底墨字，填充量最低
    slate: "bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] font-bold",
    // 標記（職業限定之類）：零色，只有墨與邊
    marker: "bg-transparent text-[#6b5a4b] border border-[#6b5a4b]/40",
    // 已選／選中：墨框 ＋ 紙底（與全站的「選中」同一條通道）
    selected: "bg-[#fffdf9] text-[#3c2415] border border-[#3c2415] font-bold"
  };

  const sizeStyles = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5 font-semibold"
  };

  return (
    <span
      className={twMerge(clsx(baseStyles, variantStyles[variant] || variantStyles.ink, sizeStyles[size], className))}
      {...props}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  );
}
