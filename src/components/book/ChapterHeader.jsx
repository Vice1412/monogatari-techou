import React from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  GiSpellBook,
  GiRollingDices,
  GiSaveArrow,
  GiOpenChest
} from 'react-icons/gi';
import appIcon from '../../assets/app-icon.png';
import { playBookCloseSound } from '../../utils/soundEffects';
import { chapterTheme as chapterThemeOf } from './chapterChrome';


export default function ChapterHeader({
  chapter,
  onExitToCover,
  backOverride = null,
  onOpenDice,
  onOpenCodex,
  onBackup,
  onRestore,
  extraLeft = null,
  extraRight = null
}) {
  const handleExit = () => {
    if (backOverride && typeof backOverride.onBack === 'function') {
      backOverride.onBack();
      return;
    }
    playBookCloseSound();
    onExitToCover();
  };

  const chapterTheme = chapterThemeOf(chapter?.id);
  const customTheme = backOverride?.theme || null;
  const theme = chapterTheme;
  const ChapterIcon = chapter?.icon;

  /* 2026-10-23（v5.1）：手機上的退出鈕原本寫「合上書本 · 返回封面」（10 字），
     在 390px 下把右側第四顆工具鈕（還原全站）擠到第二列右端，變成一顆孤立的圖示。
     書中「Layout」一節：空間不夠時**先刪字，不要刪功能**——
     所以短標籤只砍掉情境詞（合上書本），動作本身（返回封面）一個字都沒少。
     桌面寬度維持原本的長標籤，因為那裡沒有擁擠問題。 */
  const exitLabelLong = backOverride ? backOverride.label : '合上書本 · 返回封面';
  const exitLabelShort = backOverride ? backOverride.label : '返回封面';

  return (
    <header
      className={`border-b ${customTheme ? '' : theme.headerBorder} ${customTheme ? 'backdrop-blur-md' : theme.headerBg} px-3 sm:px-6 py-2 flex items-center justify-between sticky top-0 z-40 shadow-sm transition-colors duration-300 min-h-[52px]`}
      style={customTheme ? { backgroundColor: `${customTheme.headerBg}f2`, borderColor: customTheme.border } : {}}
    >
      {/* Left: Exit to Book Cover or Back to Parent Button */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          onClick={handleExit}
          className={`group inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-ui ${customTheme ? 'text-white shadow-e1' : theme.exitBtn} text-t12 sm:text-t14 font-serif font-bold transition-colors duration-160 shrink-0 cursor-pointer`}
          style={customTheme ? {
            backgroundColor: customTheme.accentDark,
            borderColor: customTheme.border
          } : {}}
          title={backOverride ? (backOverride.title || backOverride.label) : "合上當前章節，返回典籍封面目錄以選擇其他功能"}
        >
          <ArrowLeft className={`w-4 h-4 ${customTheme ? 'text-white/80' : theme.exitIcon} group-hover:-translate-x-0.5 transition-transform`} />
          <span className="flex items-center gap-1.5">
            {!backOverride && <GiSpellBook className={`hidden sm:block w-4 h-4 ${customTheme ? 'text-white/80' : theme.exitIcon}`} />}
            <span className="sm:hidden">{exitLabelShort}</span>
            <span className="hidden sm:inline">{exitLabelLong}</span>
          </span>
        </button>

        {/* Vertical Divider */}
        <div
          className={`hidden sm:block h-6 w-px ${customTheme ? '' : theme.divider}`}
          style={customTheme ? { backgroundColor: customTheme.border } : {}}
        />

        {/* Current Chapter Indicator */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {ChapterIcon ? (
            <span
              className={`p-1.5 rounded-ui border flex items-center justify-center shrink-0 ${customTheme ? 'shadow-sm' : theme.iconWrapper}`}
              style={customTheme ? { backgroundColor: customTheme.subpanelBg, borderColor: customTheme.border, color: customTheme.accent } : {}}
            >
              <ChapterIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
          ) : (
            <img
              src={appIcon}
              alt="FU Icon"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded border ${theme.appIconBorder} object-contain bg-white p-0.5 shrink-0`}
            />
          )}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-serif font-black text-t16 sm:text-t20 tracking-wide leading-none ${customTheme ? '' : theme.titleText}`}
                style={customTheme ? { color: customTheme.textDark } : {}}
              >
                {chapter.title}
              </span>
              {backOverride?.subTitle && (
                <span
                  className={`text-t12 font-sans font-bold px-2 py-0.5 rounded-ui border ${customTheme ? '' : (theme.subTitleBadge || 'bg-white/80 border-[#d6c7ab] text-[#3c2415]')}`}
                  style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
                >
                  {backOverride.subTitle}
                </span>
              )}
            </div>
            {chapter.subtitle && !backOverride?.subTitle && (
              <span className={`text-t12 font-serif font-bold hidden md:inline tracking-wider mt-0.5 ${theme.subtitleText}`}>
                {chapter.subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Extra Left Controls */}
        {extraLeft && (
          <div className="flex items-center ml-1">
            {extraLeft}
          </div>
        )}
      </div>

      {/* Right: Extra Right + Quick Tools */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
        {backOverride?.extraRight || extraRight}

        {/* Vertical Divider if extraRight present */}
        {(backOverride?.extraRight || extraRight) && (
          <div
            className={`hidden sm:block h-5 w-px ${customTheme ? '' : theme.divider} my-auto mx-0.5`}
            style={customTheme ? { backgroundColor: customTheme.border } : {}}
          />
        )}

        {/* ── 右側動作群：三個層級，不是三個同級按鈕 ────────────────────
            2026-10-23（v5.1）：原本四顆按鈕（規則速查／擲骰器／還原全站／備份）
            外觀完全同級，使用者得逐字讀才知道哪顆會覆蓋資料。
            書中「Actions」一節的分法是三級：
              · 主要動作 → 實心、高對比（這裡是左側的「合上書本」，因為它是唯一的前進方向）
              · 次要動作 → 外框、低對比（規則速查、擲骰器、備份）
              · 第三級動作 → 像連結一樣，找得到但不礙眼（還原全站：破壞性，不該跟備份長一樣）
            「還原全站」在 ≥sm 顯示文字標籤；手機（<sm）只剩圖示，但它是 `<input type="file">`
            ——點下去只會開檔案選擇器，不選檔就取消，誤觸不會直接覆蓋資料。
            真正該防的那一步（選了哪個檔案）由檔案選擇器自己擋。 */}
        <button
          onClick={onOpenCodex}
          className={`inline-flex items-center gap-1.5 px-1.5 sm:px-2.5 py-1.5 rounded-ui border text-t12 font-bold transition-colors duration-160 cursor-pointer ${customTheme ? 'shadow-sm' : theme.toolBtn}`}
          style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
          title="開啟規則概念速查（16 項官方子系統）"
        >
          <GiSpellBook className="w-4 h-4" style={customTheme ? { color: customTheme.accent } : {}} />
          <span className="hidden sm:inline">規則速查</span>
        </button>

        <button
          onClick={onOpenDice}
          className={`inline-flex items-center gap-1.5 px-1.5 sm:px-2.5 py-1.5 rounded-ui border text-t12 font-bold transition-colors duration-160 cursor-pointer ${customTheme ? 'shadow-sm' : theme.toolBtn}`}
          style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
          title="開啟雙屬性擲骰器"
        >
          <GiRollingDices className="w-4 h-4" style={customTheme ? { color: customTheme.accent } : {}} />
          <span className="hidden sm:inline">擲骰器</span>
        </button>

        {/* Backup（次要） */}
        <button
          onClick={onBackup}
          className={`inline-flex items-center gap-1.5 px-1.5 sm:px-2 py-1.5 rounded-ui border text-t12 font-medium transition-colors duration-160 cursor-pointer ${customTheme ? 'shadow-sm' : theme.toolBtn}`}
          style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
          title="下載全站完整 JSON 備份檔"
        >
          <GiSaveArrow className="w-4 h-4" style={customTheme ? { color: customTheme.accent } : {}} />
          <span className="hidden lg:inline">備份</span>
        </button>

        {/* Restore（第三級，破壞性）
            這顆和 NPC 工坊的「匯入 NPC」都吃 .json，而且在同一條水平線上。
            誤觸的代價是用一個單卡檔案覆蓋全站資料，所以標題要寫清楚「全站」，
            並且在視覺上**低於**備份：無邊框、三級墨、hover 才浮出。 */}
        <label
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-ui px-1.5 sm:px-2 py-1.5 text-t12 text-ink-3 transition-colors duration-160 hover:bg-warm-1 hover:text-[#a63d40]"
          title="還原全站備份（會覆蓋目前的全部資料）"
        >
          <input
            type="file"
            accept=".json"
            onChange={onRestore}
            className="hidden"
            aria-label="還原全站備份"
          />
          <GiOpenChest className="w-4 h-4" />
          <span className="hidden sm:inline">還原全站</span>
        </label>
      </div>
    </header>
  );
}
