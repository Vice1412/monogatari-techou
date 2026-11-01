import React, { useState, useRef, useEffect } from 'react';
import { Copy } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { copyTextToClipboard } from '../../features/character-sheet/utils/playCopyFormat.js';

/**
 * 跑團面板與隨身子系統專用「複製說明文字」功能性控件。
 *
 * 遵循規範：
 * - GEMINI.md 規則一軌道 2 豁免：純功能性「複製」控件使用 lucide-react Copy 與排版字符 ✓。
 * - Refactoring UI v5.1：統一走書頁紙墨色階（#fffdf9 / #f4ebd9 / #d6c7ab / #3c2415 / #2c221e）、
 *   型階梯令牌（text-t11 / text-t12）與 2px 圓角（rounded），不混入未登記色相與陰影噪音。
 */
export default function CopyTextButton({
  getText,
  text = '',
  label = '複製',
  copiedLabel = '已複製',
  title = '複製說明文字（可直接貼至 Discord）',
  toastLabel = '',
  showToast = null,
  size = 'xs',
  className = '',
  testId = 'copy-text-btn',
  onCopied = null
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const payload = typeof getText === 'function' ? getText() : text;
    if (!payload || typeof payload !== 'string' || !payload.trim()) return;

    const ok = await copyTextToClipboard(payload);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);

    if (typeof showToast === 'function' && toastLabel) {
      showToast(ok ? `已複製「${toastLabel}」說明` : `「${toastLabel}」複製失敗`);
    }
    if (typeof onCopied === 'function') {
      onCopied(payload, ok);
    }
  };

  const sizeClass =
    size === 'sm'
      ? 'px-2.5 py-1 text-t12 gap-1.5'
      : 'px-2 py-0.5 text-t11 gap-1';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      data-testid={testId}
      className={cn(
        'inline-flex items-center justify-center font-bold rounded border transition-colors shrink-0 select-none',
        sizeClass,
        copied
          ? 'bg-[#f4ebd9] text-[#2c221e] border-[#7c6a58]'
          : 'bg-[#fffdf9] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9] hover:text-[#2c221e] hover:border-[#7c6a58]',
        className
      )}
    >
      {copied ? (
        <span className="text-[#2c221e] font-black leading-none">{'✓'}</span>
      ) : (
        <Copy className="w-3 h-3 shrink-0" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

