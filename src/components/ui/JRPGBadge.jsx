import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function JRPGBadge({
  children,
  variant = 'gold',
  size = 'sm',
  className = '',
  icon: Icon,
  ...props
}) {
  const baseStyles = "inline-flex items-center font-mono font-medium rounded-md select-none tracking-wide transition-colors";

  const variantStyles = {
    // ── 身份（色相）：由 characterThemes 的 badgeVariant 指向，一個主題一個 ──
    gold: "bg-[#f4ebd9] text-[#9c4d16] border border-[#9c4d16]/40 font-bold",
    amber: "bg-amber-50 text-amber-900 border border-amber-300 font-bold",
    rose: "bg-red-50 text-red-900 border border-red-300 font-bold",
    green: "bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold",
    purple: "bg-purple-50 text-purple-900 border border-purple-300 font-bold",
    indigo: "bg-indigo-50 text-indigo-900 border border-indigo-300 font-bold",
    slate: "bg-[#eee6d3] text-[#3c2f21] border border-[#d6c7ab] font-bold",
    zinc: "bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab]",

    // ── 語意（不帶色相，或帶登記過的語意色）──
    // 危險極性：唯一允許紅色的語意出口，色值＝登記色 #8c2d36（不是新的紅）
    danger: "bg-[#f9f5eb] text-[#8c2d36] border border-[#8c2d36]/50 font-bold",
    // 序（冠位 > 精英 > 一般）：靠填充量分級，不靠色相
    "rank-top": "bg-[#2c221e] text-[#e8dcc4] border border-[#2c221e] font-bold",
    "rank-mid": "bg-[#7c6a58] text-[#fbf7ee] border border-[#7c6a58] font-bold",
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
      className={twMerge(clsx(baseStyles, variantStyles[variant] || variantStyles.gold, sizeStyles[size], className))}
      {...props}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  );
}
