import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function JRPGInput({
  label,
  error,
  type = 'text',
  className = '',
  wrapperClassName = '',
  icon: Icon,
  theme = null,
  style = {},
  ...props
}) {
  return (
    <div className={twMerge(clsx("flex flex-col gap-1.5", wrapperClassName))}>
      {label && (
        <label
          className="text-xs font-bold text-[#3c2415] flex items-center justify-between"
          style={theme ? { color: theme.textDark } : {}}
        >
          <span>{label}</span>
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-[#7c6a58] pointer-events-none" style={theme ? { color: theme.accent } : {}}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type={type}
          className={twMerge(
            clsx(
              "w-full bg-[#fffdf9] border border-[#d6c7ab] rounded px-3.5 py-2 text-sm text-[#2c221e] placeholder-[#7c6a58] outline-none transition-all duration-150",
              "focus:border-[#3c2415] focus:ring-1 focus:ring-[#3c2415]/25 focus:bg-white",
              Icon && "pl-9",
              error && "border-[#8c2d36] focus:border-[#8c2d36] focus:ring-[#8c2d36]/20",
              type === 'number' && "font-mono font-bold",
              className
            )
          )}
          style={theme ? {
            backgroundColor: theme.cardBg || '#fffdf9',
            borderColor: theme.border,
            color: theme.textDark,
            ...style
          } : style}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-[#8c2d36] font-bold">{error}</span>}
    </div>
  );
}

export function JRPGSelect({
  label,
  options = [],
  value,
  onChange,
  className = '',
  wrapperClassName = '',
  placeholder = '請選擇...',
  theme = null,
  style = {},
  ...props
}) {
  return (
    <div className={twMerge(clsx("flex flex-col gap-1.5", wrapperClassName))}>
      {label && (
        <label
          className="text-xs font-bold text-[#3c2415]"
          style={theme ? { color: theme.textDark } : {}}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className={twMerge(
            clsx(
              "w-full bg-[#fffdf9] border border-[#d6c7ab] rounded px-3.5 py-2 text-sm text-[#2c221e] outline-none transition-all duration-150 appearance-none cursor-pointer",
              "focus:border-[#3c2415] focus:ring-1 focus:ring-[#3c2415]/25 focus:bg-white font-medium",
              className
            )
          )}
          style={theme ? {
            backgroundColor: theme.cardBg || '#fffdf9',
            borderColor: theme.border,
            color: theme.textDark,
            ...style
          } : style}
          {...props}
        >
          {placeholder && <option value="" disabled className="bg-white text-[#6b5a4b]">{placeholder}</option>}
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const lbl = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={val} value={val} className="bg-white" style={theme ? { color: theme.textDark } : { color: '#2c221e' }}>
                {lbl}
              </option>
            );
          })}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs" style={theme ? { color: theme.accent } : { color: '#7c6a58' }}>
          ▼
        </div>
      </div>
    </div>
  );
}
