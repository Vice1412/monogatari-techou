import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

/**
 * body 捲動鎖 —— **計數**，不是直接覆寫。
 *
 * 原本的寫法是「進場時記下當前的 overflow，關閉時還原」，兩個彈窗重疊時就會壞掉：
 * 內層彈窗進場時看到的是外層設的 `hidden`，它關閉時就把 `hidden` 還原回去，
 * 外層也關了之後**頁面永遠鎖住、完全不能捲**——使用者看到的就是「當掉了」。
 * 這種「一按就死」最常見的成因之一就是這個。
 */
let bodyLockCount = 0;
let bodyOverflowBeforeLock = '';

const lockBodyScroll = () => {
  if (typeof document === 'undefined') return () => {};
  if (bodyLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
  return () => {
    bodyLockCount = Math.max(0, bodyLockCount - 1);
    if (bodyLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
  };
};

export default function JRPGModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-xl',
  actionButtons = null,
  theme = null
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // onClose 通常是行內箭頭函式（每次 render 都是新的 identity）。
  // 若把它放進下面那個 effect 的依賴陣列，effect 就會**每次 render 都重跑**
  // （拆掉再裝一次 keydown、鎖一次 body），純粹是白工；改用 ref 讓 effect 只跟 isOpen 走。
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const releaseScrollLock = lockBodyScroll();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      releaseScrollLock();
    };
  }, [isOpen]);

  // `mounted` 與 `document` 的檢查搬到下面——SSR 時要走「內聯回傳」那條分支。
  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto min-w-0">
      {/* Clickable Backdrop */}
      <div 
        className="fixed inset-0 -z-10" 
        onClick={onClose} 
      />

      {/* Modal Dialog Card
          ※ `min-w-0` 是必要的：flex 項目的 `min-width` 預設是 `auto`，
          所以即使有 `w-full`，內容的 min-content 寬度（例如一排不會換行的技能名）
          還是會把整個彈窗撐破、在手機上造成橫向溢出。`min-w-0` 讓它可以真的縮到容器寬度。 */}
      <div
        className={`relative w-full min-w-0 ${maxWidth} bg-[#fffdf9] border-2 border-[#d6c7ab] rounded shadow-e3 overflow-hidden my-auto flex flex-col max-h-[90vh] text-[#2c221e]`}
        style={theme ? { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark } : {}}
      >
        {/* Top accent line（第十五輪：實心，不再是漸層——漸層是第二套顏色系統） */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: theme?.accent }}
        />

        {/* Modal Header */}
        <div
          className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-[#d6c7ab] flex items-center justify-between bg-[#f4ebd9] shrink-0"
          style={theme ? { backgroundColor: theme.headerBg, borderColor: theme.border } : {}}
        >
          <h3
            className="font-serif font-black text-base sm:text-lg text-[#3c2415] flex items-center gap-2 truncate"
            style={theme ? { color: theme.textDark } : {}}
          >
            <span style={theme ? { color: theme.accent } : { color: '#a63d40' }}>❖</span>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6b5a4b] hover:text-[#2c221e] p-1.5 rounded hover:bg-[#e8dcc4] transition-colors shrink-0"
            style={theme ? { color: theme.textMuted } : {}}
            title="關閉視窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content。`min-w-0` 同上：讓內容也能跟著縮，而不是被 min-content 撐破。 */}
        <div className="p-2.5 sm:p-5 overflow-y-auto flex-1 flex flex-col min-h-0 min-w-0">
          {children}
        </div>

        {/* Action Footer */}
        {actionButtons && (
          <div
            className="px-5 py-3 border-t border-[#d6c7ab] bg-[#f7f3e8] flex items-center justify-end gap-3 shrink-0"
            style={theme ? { backgroundColor: theme.subpanelBg, borderColor: theme.border } : {}}
          >
            {actionButtons}
          </div>
        )}
      </div>
    </div>
  );

  // SSR 專用分支：`createPortal` 需要真實的 `document.body`，伺服器端沒有。
  // 直接內聯回傳內容，讓彈窗裡的文字能被 SSR 斷言看到（否則整個彈窗在 SSR 下
  // 是一片空白，「這裡到底有沒有這段文案」只能靠原始碼字串猜）。
  // ※ 瀏覽器裡 `document` 永遠存在，這條分支**永不觸發**，生產行為逐字不變。
  if (typeof document === 'undefined') return modalContent;
  if (!mounted) return null;
  return ReactDOM.createPortal(modalContent, document.body);
}
