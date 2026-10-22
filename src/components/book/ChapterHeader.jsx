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

const CHAPTER_THEMES = {
  workshop: {
    id: 'workshop',
    headerBg: 'bg-[#f4ebd9]/95 backdrop-blur-md',
    headerBorder: 'border-[#d6c7ab]',
    titleText: 'text-[#3c2415]',
    subtitleText: 'text-[#7c6a58]',
    exitBtn: 'border-[#8b5e34]/40 bg-gradient-to-r from-[#8b5e34] via-[#92400e] to-[#78350f] hover:from-[#78350f] hover:to-[#602e0c] text-[#fffdf9] shadow-md shadow-[#3c2415]/20',
    exitIcon: 'text-[#fde68a]',
    iconWrapper: 'bg-[#ede4d1] border-[#d6c7ab] text-amber-900 shadow-sm',
    divider: 'bg-[#d6c7ab]',
    toolBtn: 'border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#ebdcc4] text-[#3c2415] hover:text-amber-950 shadow-sm',
    toolIcon: 'text-amber-800',
    appIconBorder: 'border-[#d6c7ab]',
    subTitleBadge: 'bg-white/85 border-[#d6c7ab] text-[#3c2415]'
  },
  character: {
    id: 'character',
    headerBg: 'bg-[#ecfdf5]/95 backdrop-blur-md',
    headerBorder: 'border-emerald-200',
    titleText: 'text-emerald-950',
    subtitleText: 'text-emerald-700',
    exitBtn: 'border-emerald-700/40 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-500 hover:to-teal-700 text-white shadow-md shadow-emerald-950/20',
    exitIcon: 'text-emerald-200',
    iconWrapper: 'bg-emerald-100/90 border-emerald-300 text-emerald-800 shadow-sm',
    divider: 'bg-emerald-300/80',
    toolBtn: 'border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-950 hover:text-emerald-900 shadow-sm',
    toolIcon: 'text-emerald-700',
    appIconBorder: 'border-emerald-300',
    subTitleBadge: 'bg-white/85 border-emerald-300 text-emerald-900'
  },
  combat: {
    id: 'combat',
    headerBg: 'bg-[#fff1f2]/95 backdrop-blur-md',
    headerBorder: 'border-rose-200',
    titleText: 'text-rose-950',
    subtitleText: 'text-rose-700',
    exitBtn: 'border-rose-700/40 bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 hover:from-rose-500 hover:to-red-700 text-white shadow-md shadow-rose-950/20',
    exitIcon: 'text-rose-200',
    iconWrapper: 'bg-rose-100/90 border-rose-300 text-rose-800 shadow-sm',
    divider: 'bg-rose-300/80',
    toolBtn: 'border-rose-300 bg-white hover:bg-rose-50 text-rose-950 hover:text-rose-900 shadow-sm',
    toolIcon: 'text-rose-700',
    appIconBorder: 'border-rose-300',
    subTitleBadge: 'bg-white/85 border-rose-300 text-rose-900'
  },
  clocks: {
    id: 'clocks',
    headerBg: 'bg-[#f0f9ff]/95 backdrop-blur-md',
    headerBorder: 'border-sky-200',
    titleText: 'text-slate-800',
    subtitleText: 'text-sky-700',
    exitBtn: 'border-sky-400 bg-gradient-to-r from-sky-600 via-cyan-700 to-blue-800 hover:from-sky-500 hover:to-cyan-600 text-white shadow-md shadow-sky-950/20',
    exitIcon: 'text-sky-200',
    iconWrapper: 'bg-sky-100/90 border-sky-300 text-sky-800 shadow-sm',
    divider: 'bg-sky-300/80',
    toolBtn: 'border-sky-300 bg-white hover:bg-sky-50 text-sky-900 hover:text-sky-950 shadow-sm font-bold',
    toolIcon: 'text-sky-700',
    appIconBorder: 'border-sky-300',
    subTitleBadge: 'bg-white/85 border-sky-300 text-sky-900'
  }
};

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

  const chapterTheme = CHAPTER_THEMES[chapter?.id] || CHAPTER_THEMES.workshop;
  const customTheme = backOverride?.theme || null;
  const theme = chapterTheme;
  const ChapterIcon = chapter?.icon;

  return (
    <header
      className={`border-b ${customTheme ? '' : theme.headerBorder} ${customTheme ? 'backdrop-blur-md' : theme.headerBg} px-3 sm:px-6 py-2 flex items-center justify-between sticky top-0 z-40 shadow-sm transition-colors duration-300 min-h-[52px]`}
      style={customTheme ? { backgroundColor: `${customTheme.headerBg}f2`, borderColor: customTheme.border } : {}}
    >
      {/* Left: Exit to Book Cover or Back to Parent Button */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          onClick={handleExit}
          className={`group inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border ${customTheme ? 'text-white shadow-md' : theme.exitBtn} text-xs sm:text-sm font-serif font-bold transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer`}
          style={customTheme ? {
            backgroundImage: `linear-gradient(to right, ${customTheme.accentHover}, ${customTheme.accentDark})`,
            borderColor: customTheme.border
          } : {}}
          title={backOverride ? (backOverride.title || backOverride.label) : "合上當前章節，返回典籍封面目錄以選擇其他功能"}
        >
          <ArrowLeft className={`w-4 h-4 ${customTheme ? 'text-white/80' : theme.exitIcon} group-hover:-translate-x-0.5 transition-transform`} />
          <span className="flex items-center gap-1.5">
            {!backOverride && <GiSpellBook className={`w-4 h-4 ${customTheme ? 'text-white/80' : theme.exitIcon}`} />}
            <span>{backOverride ? backOverride.label : '合上書本 · 返回封面'}</span>
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
              className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${customTheme ? 'shadow-sm' : theme.iconWrapper}`}
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
                className={`font-serif font-black text-base sm:text-lg md:text-xl tracking-wide leading-none ${customTheme ? '' : theme.titleText}`}
                style={customTheme ? { color: customTheme.textDark } : {}}
              >
                {chapter.title}
              </span>
              {backOverride?.subTitle && (
                <span
                  className={`text-[11px] font-sans font-bold px-2 py-0.5 rounded-md border shadow-xs ${customTheme ? '' : (theme.subTitleBadge || 'bg-white/80 border-slate-300 text-slate-800')}`}
                  style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
                >
                  {backOverride.subTitle}
                </span>
              )}
            </div>
            {chapter.subtitle && !backOverride?.subTitle && (
              <span className={`text-[10px] sm:text-xs font-serif font-bold hidden md:inline tracking-wider mt-0.5 ${theme.subtitleText}`}>
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

        {/* Rule Codex Button in Header */}
        <button
          onClick={onOpenCodex}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${customTheme ? 'shadow-sm' : theme.toolBtn}`}
          style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
          title="開啟規則概念速查（16 項官方子系統）"
        >
          <GiSpellBook className="w-4 h-4" style={customTheme ? { color: customTheme.accent } : {}} />
          <span className="hidden sm:inline">規則速查</span>
        </button>

        {/* Dice Roller Button in Header */}
        <button
          onClick={onOpenDice}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${customTheme ? 'shadow-sm' : theme.toolBtn}`}
          style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
          title="開啟雙屬性擲骰器"
        >
          <GiRollingDices className="w-4 h-4" style={customTheme ? { color: customTheme.accent } : {}} />
          <span className="hidden sm:inline font-mono">擲骰器</span>
        </button>

        {/* Restore */}
        {/* 這顆和 NPC 工坊的「匯入 NPC」都吃 .json，而且在同一條水平線上。
            誤觸的代價是用一個單卡檔案覆蓋全站資料，所以標題要寫清楚「全站」。 */}
        <label className="cursor-pointer" title="還原全站備份（會覆蓋目前的全部資料）">
          <input
            type="file"
            accept=".json"
            onChange={onRestore}
            className="hidden"
            aria-label="還原全站備份"
          />
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors ${customTheme ? 'shadow-sm' : theme.toolBtn}`}
            style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
          >
            <GiOpenChest className="w-4 h-4" style={customTheme ? { color: customTheme.accent } : {}} />
            <span className="hidden lg:inline">還原全站</span>
          </span>
        </label>

        {/* Backup */}
        <button
          onClick={onBackup}
          className={`inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${customTheme ? 'shadow-sm' : theme.toolBtn}`}
          style={customTheme ? { backgroundColor: customTheme.cardBg || '#ffffff', borderColor: customTheme.border, color: customTheme.textDark } : {}}
          title="下載全站完整 JSON 備份檔"
        >
          <GiSaveArrow className="w-4 h-4" style={customTheme ? { color: customTheme.accent } : {}} />
          <span className="hidden lg:inline">備份</span>
        </button>
      </div>
    </header>
  );
}
