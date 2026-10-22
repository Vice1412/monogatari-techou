import React, { useState } from 'react';
import {
  GiDragonHead,
  GiVisoredHelm,
  GiSwordClash,
  GiPocketWatch,
  GiRollingDices,
  GiSaveArrow,
  GiOpenChest,
  GiSoundOn,
  GiSoundOff,
  GiSpellBook,
  GiSparkles,
  GiPlainArrow,
  GiHazardSign
} from 'react-icons/gi';
import appIcon from '../../assets/app-icon.png';
import modLogo from '../../assets/Fabula Ultima Mod Logo - White Background.png';
import { isSoundEnabled, toggleSoundEnabled, playPageFlipSound } from '../../utils/soundEffects';

export default function BookCoverHub({ onSelectChapter, onOpenDice, onBackup, onRestore, isOpening }) {
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [hoveredChapter, setHoveredChapter] = useState(null);

  const handleSoundToggle = () => {
    const next = toggleSoundEnabled();
    setSoundOn(next);
  };

  const CHAPTERS = [
    {
      id: 'character',
      title: '角色卡助手',
      status: 'wip',
      statusLabel: '開發中',
      icon: GiVisoredHelm,
      color: 'emerald',
      borderGlow: 'hover:border-emerald-400 hover:shadow-emerald-500/20',
      accentGradient: 'from-emerald-400/10 via-emerald-200/5 to-transparent',
      textColor: 'group-hover:text-emerald-800',
      iconBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 border-emerald-300 text-emerald-700 shadow-sm'
    },
    {
      id: 'workshop',
      title: 'NPC工坊',
      status: 'complete',
      statusLabel: '完整功能',
      icon: GiDragonHead,
      color: 'amber',
      borderGlow: 'hover:border-amber-400 hover:shadow-amber-500/20',
      accentGradient: 'from-amber-400/10 via-amber-200/5 to-transparent',
      textColor: 'group-hover:text-amber-800',
      iconBg: 'bg-gradient-to-br from-amber-50 to-amber-100/80 border-amber-300 text-amber-700 shadow-sm'
    },
    {
      id: 'combat',
      title: '戰鬥輪次',
      status: 'wip',
      statusLabel: '開發中',
      icon: GiSwordClash,
      color: 'rose',
      borderGlow: 'hover:border-rose-400 hover:shadow-rose-500/20',
      accentGradient: 'from-rose-400/10 via-rose-200/5 to-transparent',
      textColor: 'group-hover:text-rose-800',
      iconBg: 'bg-gradient-to-br from-rose-50 to-rose-100/80 border-rose-300 text-rose-700 shadow-sm'
    },
    {
      id: 'clocks',
      title: '命刻記錄',
      status: 'wip',
      statusLabel: '開發中',
      icon: GiPocketWatch,
      color: 'cyan',
      borderGlow: 'hover:border-cyan-400 hover:shadow-cyan-500/20',
      accentGradient: 'from-cyan-400/10 via-cyan-200/5 to-transparent',
      textColor: 'group-hover:text-cyan-800',
      iconBg: 'bg-gradient-to-br from-cyan-50 to-cyan-100/80 border-cyan-300 text-cyan-700 shadow-sm'
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#ebf5f8] text-[#1e293b] flex flex-col items-center justify-center p-3 sm:p-6 md:p-10 select-none overflow-hidden">
      {/* Tabletop Atmosphere Ambient Background (Ethereal Light Cyan Glow) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-200/50 via-sky-100/30 to-[#f0f9ff] pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#0284c7 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Floating Magic Rune Motes */}
      <div className="absolute top-12 left-12 w-64 h-64 bg-sky-400/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-12 right-12 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Utility Ribbon (Sound toggle, backup, restore) */}
      <div className={`w-full max-w-5xl flex items-center justify-between py-2 px-2 z-20 mb-3 text-xs text-[#475569] transition-opacity duration-300 ${
        isOpening ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/80 border border-sky-300 text-sky-900 font-serif tracking-wider shadow-sm backdrop-blur-sm">
            <GiSparkles className="w-4 h-4 text-sky-600" />
            <span>《物語手帳》</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={handleSoundToggle}
            className="p-1.5 rounded-lg border border-sky-300 bg-white/80 hover:bg-sky-50 text-sky-900 hover:text-cyan-700 transition-colors shadow-sm"
            title={soundOn ? '點擊靜音翻書音效' : '點擊開啟翻書音效'}
          >
            {soundOn ? <GiSoundOn className="w-4 h-4 text-sky-600" /> : <GiSoundOff className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Restore */}
          <label className="cursor-pointer" title="還原全站備份（會覆蓋目前的全部資料）">
            <input type="file" accept=".json" onChange={onRestore} className="hidden" aria-label="還原全站備份" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-300 bg-white/80 hover:bg-sky-50 text-sky-900 hover:text-cyan-700 transition-colors shadow-sm font-medium">
              <GiOpenChest className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">還原全站</span>
            </span>
          </label>

          {/* Backup */}
          <button
            onClick={onBackup}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-300 bg-white/80 hover:bg-sky-50 text-sky-900 hover:text-cyan-700 transition-colors shadow-sm font-medium"
            title="下載全站完整備份"
          >
            <GiSaveArrow className="w-4 h-4 text-sky-600" />
            <span className="hidden sm:inline">備份</span>
          </button>
        </div>
      </div>

      {/* Main Grimoire Book Body (點擊進入時優雅漸隱，絕不出現兩本書重疊) */}
      <div className={`relative w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col md:flex-row book-cover-leather border border-sky-400/50 overflow-hidden z-10 transition-all duration-500 ease-out ${
        isOpening ? 'opacity-0 scale-[0.96] pointer-events-none' : 'opacity-100 scale-100'
      }`}>
        
        {/* Left Book Spine (書脊立體構造) */}
        <div className="hidden md:flex w-16 shrink-0 book-spine-gradient flex-col items-center justify-between py-8 border-r border-sky-800/40 relative shadow-2xl">
          {/* Top Spine Stud */}
          <div className="w-5 h-5 rounded-full border border-sky-300/80 bg-gradient-to-br from-sky-200 to-sky-700 shadow-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-950" />
          </div>

          {/* Vertical Embossed Spine Title */}
          <div className="[writing-mode:vertical-rl] text-sky-100 tracking-[0.35em] font-serif text-xs font-bold uppercase opacity-95 drop-shadow-[0_2px_4px_rgba(2,132,199,0.8)]">
            《物語手帳》 · 冒險典籍
          </div>

          {/* Bottom Spine Stud */}
          <div className="w-5 h-5 rounded-full border border-sky-300/80 bg-gradient-to-br from-sky-200 to-sky-700 shadow-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-950" />
          </div>

          {/* Bookmark Ribbon hanging down */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 w-6 h-10 bg-gradient-to-b from-cyan-600 via-sky-700 to-teal-900 rounded-b shadow-lg border-b-2 border-sky-300/60 z-30" />
        </div>

        {/* Book Cover Face (書本封面正頁) */}
        <div className="flex-1 p-6 sm:p-10 md:p-12 relative flex flex-col justify-between">
          
          {/* Ornate Gold/Cyan Filigree Corner Accents */}
          {/* Top-Left Corner */}
          <div className="absolute top-3 left-3 w-10 h-10 border-t-2 border-l-2 border-sky-300/80 pointer-events-none flex items-start justify-start p-1">
            <div className="w-2 h-2 bg-sky-400 rounded-sm" />
          </div>
          {/* Top-Right Corner */}
          <div className="absolute top-3 right-3 w-10 h-10 border-t-2 border-r-2 border-sky-300/80 pointer-events-none flex items-start justify-end p-1">
            <div className="w-2 h-2 bg-sky-400 rounded-sm" />
          </div>
          {/* Bottom-Left Corner */}
          <div className="absolute bottom-3 left-3 w-10 h-10 border-b-2 border-l-2 border-sky-300/80 pointer-events-none flex items-end justify-start p-1">
            <div className="w-2 h-2 bg-sky-400 rounded-sm" />
          </div>
          {/* Bottom-Right Corner */}
          <div className="absolute bottom-3 right-3 w-10 h-10 border-b-2 border-r-2 border-sky-300/80 pointer-events-none flex items-end justify-end p-1">
            <div className="w-2 h-2 bg-sky-400 rounded-sm" />
          </div>

          {/* Decorative Inner Border Frame */}
          <div className="absolute inset-4 border border-sky-300/30 rounded-xl pointer-events-none" />

          {/* Header Section: Grand Book Title & Emblem */}
          <div className="text-center pt-2 pb-6 border-b border-sky-300/30 relative">
            <div className="inline-flex items-center justify-center gap-3 mb-2">
              <img
                src={appIcon}
                alt="FU Emblem"
                className="w-12 h-12 rounded-xl border-2 border-sky-300/80 object-contain p-1 bg-sky-950/80 shadow-lg shadow-sky-950/50"
              />
              <div className="text-left">
                <span className="text-[10px] font-mono tracking-[0.25em] text-sky-200 uppercase font-bold block">
                  Tabletop Roleplaying Companion
                </span>
                <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-widest gold-text-emboss flex flex-wrap items-center gap-2">
                  《物語手帳》
                </h1>
              </div>
            </div>

            <p className="text-sm sm:text-base font-serif text-sky-100 tracking-wide mt-1">
              《物語手帳》冒險啟程之書 · 一體化跑團綜合典籍
            </p>
          </div>

          {/* Feature Chapter Entrances (4 大功能入口卡片) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-6 sm:my-8 relative z-10">
            {CHAPTERS.map((chap) => {
              const Icon = chap.icon;

              return (
                <div
                  key={chap.id}
                  onClick={() => {
                    onSelectChapter(chap.id);
                  }}
                  className={`group relative rounded-2xl border border-sky-200/90 bg-white/95 p-6 sm:p-7 min-h-[135px] flex flex-col justify-between cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-xl ${chap.borderGlow} overflow-hidden shadow-sm`}
                >
                  {/* Subtle Card Background Accent Gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${chap.accentGradient} opacity-60 group-hover:opacity-100 transition-opacity`} />

                  {/* Translucent Watermark Emblem Background */}
                  <Icon className="absolute -right-5 -bottom-5 w-36 h-36 text-sky-900/[0.06] group-hover:text-sky-700/15 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 pointer-events-none" />

                  {/* Top & Bottom Corner Filigree Accents */}
                  <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-sky-300/40 group-hover:border-sky-400 transition-colors pointer-events-none" />
                  <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-sky-300/40 group-hover:border-sky-400 transition-colors pointer-events-none" />

                  {/* Icon & Title Header */}
                  <div className="flex items-center gap-4 relative z-10 my-auto">
                    <div className={`w-14 h-14 rounded-xl border flex items-center justify-center shadow-sm group-hover:scale-105 shrink-0 transition-transform ${chap.iconBg}`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className={`font-serif font-black text-xl sm:text-2xl tracking-wider text-slate-800 transition-colors ${chap.textColor}`}>
                          {chap.title}
                        </h3>
                        {chap.status === 'complete' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-2xs font-mono">
                            完整功能
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/80 shadow-2xs flex items-center gap-1 font-mono">
                            <GiHazardSign className="w-3 h-3 text-amber-700" />
                            <span>開發中</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Link Footer with Status Dot & Arrow Button */}
                  <div className="flex items-center justify-between pt-3 border-t border-sky-100/80 text-xs relative z-10 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 group-hover:text-sky-600 transition-colors font-medium">
                      <span className={`w-1.5 h-1.5 rounded-full ${chap.status === 'complete' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                      <span>{chap.status === 'complete' ? '點擊翻開' : '開發中 · 點擊確認'}</span>
                    </span>
                    
                    <div className="w-7 h-7 rounded-full bg-sky-50 group-hover:bg-sky-600 border border-sky-200 group-hover:border-sky-600 flex items-center justify-center transition-all group-hover:shadow-md group-hover:scale-105">
                      <GiPlainArrow className="w-3.5 h-3.5 rotate-90 text-sky-600 group-hover:text-white transition-colors" />
                    </div>
                  </div>

                  {/* Hover Sheen Sweep Effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-sky-400/15 to-transparent pointer-events-none" />
                </div>
              );
            })}
          </div>

          {/* Book Bottom Ribbon Bar: Dice Roller & Prompt */}
          <div className="pt-4 border-t border-sky-300/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-sky-100">
              <GiSpellBook className="w-5 h-5 text-sky-300 shrink-0" />
              <span className="font-serif">
                提示：點擊任一章節後將以<span className="text-cyan-300 font-bold">「翻書漸隱」</span>完全進入該功能，退出後可再換卷。
              </span>
            </div>

            {/* Quick Dice Roller Launch */}
            <button
              onClick={onOpenDice}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-700 hover:from-sky-500 hover:to-cyan-600 text-white font-bold shadow-lg shadow-sky-950/40 border border-sky-300/50 transition-all hover:scale-105 active:scale-95"
            >
              <GiRollingDices className="w-5 h-5 text-sky-100" />
              <span className="font-mono tracking-wider">雙屬性擲骰盤</span>
            </button>
          </div>

        </div>

        {/* Right Book Page Edges Stack (右側立體書頁切邊效果) */}
        <div className="hidden md:block w-3 shrink-0 book-pages-edge-right border-l border-sky-800/40" />
      </div>

      {/* 第三方授權聲明 (Third-Party License Notice) */}
      <footer 
        className={`w-full max-w-2xl mx-auto mt-6 mb-2 text-center space-y-2 z-10 transition-opacity duration-300 ${
          isOpening ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
      >
        <img src={modLogo} alt="Fabula Ultima Mod Logo" className="h-7 object-contain mx-auto opacity-75" />
        <div className="text-[11px] text-slate-600 leading-relaxed">
          <p><span className="font-bold text-slate-800">《物語手帳》</span> is an independent production by <span className="font-bold text-slate-800">ScarletVice</span>.</p>
          <p>It is <span className="font-bold text-slate-800">not endorsed or sponsored in any way</span> by Need Games or Rooster Games.</p>
          <p>Published under the <a href="https://need.games/wp-content/uploads/2024/06/Fabula-Ultima-Third-Party-Tabletop-License-1.0.pdf" target="_blank" rel="noopener noreferrer" className="text-sky-800 hover:text-sky-600 underline underline-offset-2 transition-colors">Fabula Ultima Third-Party Tabletop License 1.0</a>.</p>
          <p>Fabula Ultima is &copy; Emanuele Galletto, Need Games and Rooster Games.</p>
          <p>This tool requires the <span className="font-bold text-slate-800">Fabula Ultima Core Rulebook</span>.</p>
          <p className="pt-1 border-t border-slate-300/60 mt-1">
            <span className="font-bold text-slate-800">AI 生成內容聲明：</span>
            本工具的介面文案、規則文本整理與程式碼均由 AI 輔助產出，並經人工校對。
            規則數值一律逐條核對官方原書。
          </p>
          <p>
            本工具僅重製官方規則的<span className="font-bold text-slate-800">機制</span>部分（數值、公式、費用、效果、表格），
            不重製官方原書的美術、世界觀敘述與畫風文字。
          </p>
        </div>
        <div className="text-[10px] text-sky-900/60 font-serif pt-1">
          《物語手帳》 · 純前端零伺服器架構 · 數據即時保存於瀏覽器
        </div>
      </footer>
    </div>
  );
}
