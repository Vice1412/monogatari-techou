import React from 'react';
import { GiSparkles } from 'react-icons/gi';
import appIcon from '../../assets/app-icon.png';

/* 2026-10-23（第八輪）：四章共用同一張紙（見 `chapterChrome.js`）。
   這裡保留「每章一個物件」的形狀，是因為下面的取值點按 `targetChapter.id` 索引；
   但四份內容完全相同——**翻頁動畫畫的是目標頁，目標頁已經沒有章節色了**。 */
const OVERLAY_PAPER = {
  bg: 'bg-[#fbf7ee]',
  border: 'border-[#d6c7ab]',
  innerBorder: 'border-[#d6c7ab]/40',
  headerBorder: 'border-[#d6c7ab]',
  title: 'text-[#3c2415]',
  subtitle: 'text-[#6b5a4b]',
  tag: 'text-[#8b5e34]',
  tagAccent: 'text-[#3c2415]',
  backBg: 'bg-[#f4ebd9]',
  backBorder: 'border-[#d6c7ab]',
  backText: 'text-[#3c2415]',
  backIconBorder: 'border-[#d6c7ab]',
};

const CHAPTER_OVERLAY_THEMES = {
  workshop: OVERLAY_PAPER,
  character: OVERLAY_PAPER,
  combat: OVERLAY_PAPER,
  clocks: OVERLAY_PAPER,
};

export default function BookPageFlipOverlay({ direction, targetChapter, onAnimationEnd }) {
  const isOpening = direction === 'open';
  const theme = CHAPTER_OVERLAY_THEMES[targetChapter?.id] || CHAPTER_OVERLAY_THEMES.workshop;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden bg-black/75 perspective-book transition-opacity duration-300"
      onAnimationEnd={onAnimationEnd}
    >
      {/* Dynamic Background Light Sweep */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#d6c7ab]/25 via-[#f4ebd9]/15 to-transparent pointer-events-none" />

      {/* 3D Book Stage with Camera Zoom In/Out Motion */}
      <div className={`relative w-full max-w-4xl h-[520px] sm:h-[600px] flex items-center justify-center transform-style-3d px-4 ${
        isOpening ? 'animate-book-stage-open' : 'animate-book-stage-close'
      }`}>
        
        {/* Underneath Page: The Interior Parchment Page (內頁底紙 - 琉璃白玉質感) */}
        <div className={`absolute w-[90%] sm:w-[85%] h-full rounded-2xl ${theme.bg} border-2 ${theme.border} shadow-e3 p-8 sm:p-12 flex flex-col justify-between overflow-hidden`}>
          {/* Parchment Texture & Subtle Filigree */}
          <div className={`absolute inset-4 border ${theme.innerBorder} rounded-xl pointer-events-none`} />
          
          <div className={`flex items-center justify-between border-b ${theme.headerBorder} pb-4`}>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs ${theme.tag} font-bold`}>《物語手帳》</span>
            </div>
            <span className={`font-serif text-xs ${theme.tagAccent} font-semibold`}>✦ CHAPTER OPENING ✦</span>
          </div>

          <div className="text-center my-auto">
            <h2 className={`text-2xl sm:text-4xl font-serif font-black ${theme.title} tracking-wider mb-2`}>
              {targetChapter?.title || '正在載入...'}
            </h2>
            <p className={`text-xs sm:text-sm ${theme.subtitle} font-serif max-w-md mx-auto`}>
              {isOpening ? '正在開啟工作空間...' : '正在返回封面目錄...'}
            </p>
          </div>

          <div className={`border-t ${theme.headerBorder} pt-4 flex justify-between text-t11 ${theme.tag} font-mono font-medium`}>
            <span>《物語手帳》一體化套件</span>
            <span>PAGE TURNING...</span>
          </div>
        </div>

        {/* The 3D Turning Page Leaf (翻動之書頁/封面) */}
        <div
          className={`absolute left-[5%] sm:left-[7.5%] w-[90%] sm:w-[85%] h-full rounded-2xl transform-style-3d ${
            isOpening ? 'animate-page-turn-forward' : 'animate-page-turn-reverse'
          }`}
          style={{
            transformOrigin: 'left center',
          }}
        >
          {/* Front of the turning leaf (Outer Cover) */}
          <div className="absolute inset-0 rounded-2xl book-cover-leather border-2 border-[#d6c7ab]/70 shadow-e3 backface-hidden p-8 flex flex-col justify-between overflow-hidden">
            {/* Corner Ornaments */}
            <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-[#d6c7ab]" />
            <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-[#d6c7ab]" />
            <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-[#d6c7ab]" />
            <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-[#d6c7ab]" />

            <div className="text-center my-auto">
              <img
                src={appIcon}
                alt="物語手帳"
                className="w-16 h-16 rounded-2xl border-2 border-[#d6c7ab] mx-auto mb-4 bg-[#3c2415] p-1.5 shadow-xl"
              />
              <h2 className="text-2xl sm:text-3xl font-serif font-black gold-text-emboss tracking-widest">
                《物語手帳》
              </h2>
              <p className="text-xs text-[#f7f3e8] font-serif mt-2 tracking-widest">
                ~ 《物語手帳》冒險啟程之書 ~
              </p>
            </div>
          </div>

          {/* Back of the turning leaf (Reverse side of page: parchment) */}
          <div
            className={`absolute inset-0 rounded-2xl ${theme.backBg} border-2 ${theme.backBorder} p-8 flex flex-col justify-between shadow-e3 backface-hidden`}
            style={{
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="text-center my-auto">
 <div className={`w-12 h-12 rounded-full border ${theme.backIconBorder} mx-auto mb-3 flex items-center justify-center bg-white `}>
                <GiSparkles className="w-6 h-6 text-[#8b5e34]" />
              </div>
              <p className={`font-serif text-sm ${theme.backText} font-bold`}>
                翻動篇章中...
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Page Turning Shadow Overlay */}
        <div className="absolute inset-0 pointer-events-none page-shadow-overlay-open rounded-2xl" />
      </div>
    </div>
  );
}
