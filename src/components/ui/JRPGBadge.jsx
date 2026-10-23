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
    gold: "bg-[#f4ebd9] text-[#9c4d16] border border-[#9c4d16]/40 font-bold",
    amber: "bg-amber-50 text-amber-900 border border-amber-300 font-bold",
    cyan: "bg-blue-50 text-blue-900 border border-blue-300 font-bold",
    rose: "bg-red-50 text-red-900 border border-red-300 font-bold",
    green: "bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold",
    emerald: "bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold",
    purple: "bg-purple-50 text-purple-900 border border-purple-300 font-bold",
    indigo: "bg-indigo-50 text-indigo-900 border border-indigo-300 font-bold",
    slate: "bg-[#eee6d3] text-[#3c2f21] border border-[#d6c7ab] font-bold",
    zinc: "bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab]"
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
