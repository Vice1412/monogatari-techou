import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 按鈕（第十五輪收斂：14 個變體 → 4 個）
 *
 * ## 為什麼要收
 *
 * 這支按鈕原本有十四個變體，其中十個是**為 `CHARACTER_THEMES` 的六個角色主題量身訂做的**
 * （`emerald`／`cyan`／`purple`／`slate`／`danger` ＋ 五個 `outline-*`）。
 * 也就是說按鈕的顏色不是「按鈕在講什麼」，而是「這個角色選了哪個主題」——
 * 於是同一個「確定」按鈕在六個角色身上是六種顏色，而它講的永遠是同一件事。
 *
 * 判準沿用第十二輪：**顏色只在有語意差別的地方使用。** 按鈕的語意只有三種：
 * 主要動作、次要動作、無框動作——那是**層級**，不是身份。
 * 身份色（角色的 accent）由頁首圖示、頁籤、focus ring 承擔，不需要按鈕再說一次。
 *
 * ## 現在的四個
 *
 * | 變體 | 外觀 | 用在哪 |
 * |---|---|---|
 * | `primary` | 強調色實心 `#a63d40`，hover 深一階 `#8c3235` | 這一屏唯一該按的那顆 |
 * | `secondary` | 內凹面 `#f4ebd9`，墨字 | 與主要動作並排的第二顆 |
 * | `outline` | 卡面 `#fffdf9` ＋ 邊框，hover 換內凹面 | 第三級、取消、返回 |
 * | `ghost` | 透明，hover 才出現底 | 工具列、說明入口 |
 *
 * 十四個變體裡有十個的呼叫點是零——但它們不是死碼，是**透過主題物件動態呼叫**的
 * （`variant={theme.buttonVariant || 'primary'}`）。刪掉主題那兩個欄位之後，
 * 全站 22 處呼叫自動落回 `primary`、8 處落回 `outline`，一個呼叫點都不用改。
 *
 * ## 護欄
 *
 * `tests/uiSystem.test.mjs`：變體集合恰為這四個（多一個就 FAIL）、本檔零調色盤令牌。
 */
export default function JRPGButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  icon: Icon,
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center font-bold tracking-wide transition-colors duration-150 rounded select-none disabled:opacity-50 disabled:pointer-events-none";

  const variantStyles = {
    primary: "bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] border border-[#8c3235]",
    secondary: "bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#2c221e] border border-[#d6c7ab]",
    outline: "bg-[#fffdf9] hover:bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] hover:border-[#8b5e34]",
    ghost: "bg-transparent hover:bg-[#f4ebd9] text-[#3c2415]",
  };

  const sizeStyles = {
    xs: "text-t12 px-2.5 py-1 gap-1.5",
    sm: "text-t12 px-3 py-1.5 gap-2",
    md: "text-t14 px-4 py-2 gap-2",
    lg: "text-t16 px-5 py-2.5 gap-2.5",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={twMerge(clsx(baseStyles, variantStyles[variant], sizeStyles[size], className))}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </button>
  );
}
