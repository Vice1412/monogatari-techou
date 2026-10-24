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
  GiSpellBook
} from 'react-icons/gi';
import appIcon from '../../assets/app-icon.png';
import modLogo from '../../assets/Fabula Ultima Mod Logo - White Background.png';
import { isSoundEnabled, toggleSoundEnabled } from '../../utils/soundEffects';

/**
 * 封面：書本物件 ＋ 四個章節入口
 *
 * ── 2026-10-23 改版（v5.1「層級優先 · 安靜」）────────────────────────────
 *
 * 依《Refactoring UI》（Adam Wathan／Steve Schoger）的規則重寫。原版的三個結構性問題：
 *
 * 1. **深底＋白字**。原版是深藍皮革封面 ＋ 淺藍白字，正是 GM 在 v5 裁決裡明確否決的
 *    「深色＋白色字」組合（見 index.css 的 v5 註解）。v5 的結論是「全程淺底深字、
 *    靠冷暖分層」，但封面一直是唯一的例外。本版改為**暖紙封面 ＋ 墨字**，
 *    書脊用深紅強調色——書的隱喻留著，白字拿掉。
 * 2. **裝飾壓過內容**。原版同時有：外框、四角括號、內框、卡片漸層、卡片角標、
 *    浮水印大圖示、hover 光掃、blur 光暈 ×2、常駐 `animate-pulse` 狀態點。
 *    書中「Use fewer borders」「Limit your choices」講的就是這件事——
 *    每一樣裝飾都在跟標題搶注意力。本版只留：書脊、頁口、兩條細分隔線。
 * 3. **沒有層級**。四張卡片是四種顏色（emerald／amber／rose／cyan），純裝飾、
 *    不帶語意；卡片裡沒有說明文字，只有標題＋狀態；底部一行「點擊翻開」和標題同級。
 *    本版：標題 t20 ／說明 t14 二級墨 ／狀態 t12 三級墨，三級落差固定；
 *    四個章節共用**一個**強調色，顏色只保留給「狀態」與「主要動作」。
 *
 * 另外把卡片從 `div onClick` 改成 `<button>`：原本只能用滑鼠點，鍵盤完全到不了。
 */
export default function BookCoverHub({ onSelectChapter, onOpenDice, onBackup, onRestore, isOpening }) {
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const handleSoundToggle = () => {
    const next = toggleSoundEnabled();
    setSoundOn(next);
  };

  // `desc` 是新增的：卡片沒有說明文字時，使用者只能靠標題猜裡面有什麼。
  // 文案取自各章節的實際功能範圍（與 App.jsx 的 CHAPTER_METAS 一致），不新增承諾。
  const CHAPTERS = [
    {
      id: 'character',
      title: '角色卡助手',
      desc: '建立與管理冒險者角色卡，數值、技能、裝備一次掌握。',
      status: 'wip',
      statusLabel: '開發中',
      icon: GiVisoredHelm,
    },
    {
      id: 'workshop',
      title: 'NPC工坊',
      desc: '從物種、定位到技能，逐步建構一隻 NPC。',
      status: 'complete',
      statusLabel: '完整功能',
      icon: GiDragonHead,
    },
    {
      id: 'combat',
      title: '戰鬥輪次',
      desc: '管理遭遇戰的輪次推進、參戰者狀態與先攻順序。',
      status: 'wip',
      statusLabel: '開發中',
      icon: GiSwordClash,
    },
    {
      id: 'clocks',
      title: '命刻記錄',
      desc: '管理情勢命刻、進度時鐘與場景危機。',
      status: 'wip',
      statusLabel: '開發中',
      icon: GiPocketWatch,
    }
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-warm-0 px-4 py-6 text-ink sm:px-6 md:py-10">
      {/* 紙紋：一條 3.5% 透明度的細橫紋，取代原版的兩顆 blur 光暈與點陣圖層。
          不做動畫——封面沒有「正在發生的事」，動態只會讓人以為在載入。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(42,50,64,0.035) 0 1px, transparent 1px 4px)',
        }}
      />

      {/* ── 頂部工具列 ──────────────────────────────────────────────
          三個動作全部是「安靜」的：小字、無邊框、hover 才浮出底色。
          還原全站是**破壞性**動作，刻意做得比備份更淡——書中「Actions」一節：
          主要動作要顯眼，次要動作要清楚但不搶眼，第三級動作要「找得到但不礙眼」。 */}
      <div
        className={`relative z-20 mb-4 flex w-full max-w-5xl items-center justify-between transition-opacity duration-200 ${
          isOpening ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-2 text-t12 font-medium tracking-[0.18em] text-ink-3">
          <img src={appIcon} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
          <span>物語手帳</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSoundToggle}
            aria-pressed={soundOn}
            className="rounded p-1.5 text-ink-3 transition-colors duration-160 hover:bg-warm-1 hover:text-ink"
            title={soundOn ? '關閉翻書音效' : '開啟翻書音效'}
          >
            {soundOn ? <GiSoundOn className="h-4 w-4" /> : <GiSoundOff className="h-4 w-4" />}
          </button>

          <label
            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-t12 text-ink-3 transition-colors duration-160 hover:bg-warm-1 hover:text-ink"
            title="還原全站備份（會覆蓋目前的全部資料）"
          >
            <input
              type="file"
              accept=".json"
              onChange={onRestore}
              className="hidden"
              aria-label="還原全站備份"
            />
            <GiOpenChest className="h-4 w-4" />
            <span className="hidden sm:inline">還原</span>
          </label>

          <button
            type="button"
            onClick={onBackup}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-t12 text-ink-3 transition-colors duration-160 hover:bg-warm-1 hover:text-ink"
            title="下載全站完整備份"
          >
            <GiSaveArrow className="h-4 w-4" />
            <span className="hidden sm:inline">備份</span>
          </button>
        </div>
      </div>

      {/* ── 書本物件 ──────────────────────────────────────────────
          書脊（深紅）＋ 封面（暖紙）＋ 右側頁口（細線堆疊）。
          全書只有這一處使用陰影 e3——它是唯一真的「疊在桌面上」的東西。 */}
      <div
        className={`relative z-10 flex w-full max-w-5xl overflow-hidden rounded border border-warm-line bg-paper shadow-e3 transition-all duration-300 ease-out ${
          isOpening ? 'pointer-events-none scale-[0.98] opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* 書脊 */}
        <div className="hidden w-11 shrink-0 flex-col items-center justify-between bg-[#76252d] py-6 md:flex">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#f7f3e8]/45" />
          <div className="[writing-mode:vertical-rl] font-serif text-t12 font-semibold tracking-[0.42em] text-[#f7f3e8]">
            物語手帳 · 冒險典籍
          </div>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#f7f3e8]/45" />
        </div>

        {/* 封面正頁 */}
        <div className="flex min-w-0 flex-1 flex-col px-5 py-7 sm:px-8 sm:py-9 md:px-12 md:py-11">
          {/* 書名區：眉標 → 主標 → 副標，三級字級一次拉開 */}
          <header className="flex flex-col items-center text-center">
            <img
              src={appIcon}
              alt=""
              aria-hidden="true"
              className="mb-3 h-11 w-11 object-contain"
            />
            <p className="text-t12 font-medium tracking-[0.3em] text-ink-3">跑團綜合典籍</p>
            <h1 className="mt-1 font-serif text-t31 font-black tracking-[0.08em] text-ink sm:text-t39">
              物語手帳
            </h1>
            <p className="mt-2 text-t14 text-ink-2">
              角色卡 · NPC · 戰鬥 · 命刻，四卷合一
            </p>
          </header>

          <div aria-hidden="true" className="my-6 h-px w-full bg-warm-line sm:my-7" />

          {/* 章節入口：不靠邊框分格，靠底色差與留白 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {CHAPTERS.map((chap) => {
              const Icon = chap.icon;
              const isComplete = chap.status === 'complete';

              return (
                <button
                  key={chap.id}
                  type="button"
                  data-chapter-card={chap.id}
                  onClick={() => onSelectChapter(chap.id)}
                  className="group relative flex w-full flex-col gap-2 rounded bg-warm-1 p-4 text-left transition-colors duration-160 hover:bg-white active:bg-warm-2 sm:p-5"
                >
                  {/* 左側 2px 強調條：hover 才出現，用來指示「可進入」而不必加整圈邊框 */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-transparent transition-colors duration-160 group-hover:bg-signal-accent"
                  />

                  <span className="flex items-center gap-2.5">
                    <Icon
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 text-ink-3 transition-colors duration-160 group-hover:text-signal-accent"
                    />
                    <span className="font-serif text-t20 font-bold tracking-[0.02em] text-ink">
                      {chap.title}
                    </span>
                  </span>

                  <span className="pl-[30px] text-t14 text-ink-2">{chap.desc}</span>

                  <span className="flex items-center gap-1.5 pl-[30px] text-t12 text-ink-3">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${isComplete ? 'bg-signal-ok' : 'bg-signal-ip'}`}
                    />
                    {chap.statusLabel} · 點擊翻開
                  </span>
                </button>
              );
            })}
          </div>

          <div aria-hidden="true" className="my-6 h-px w-full bg-warm-line sm:my-7" />

          {/* 底部：一句提示（三級）＋ 唯一的主要動作 */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-t12 text-ink-2">
              <GiSpellBook aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              <span>點擊章節即以翻頁進入；退出後可再換卷。</span>
            </p>

            <button
              type="button"
              onClick={onOpenDice}
              className="inline-flex items-center justify-center gap-2 rounded bg-signal-accent px-4 py-2 text-t14 font-medium text-white transition-colors duration-160 hover:bg-[#8c3235] active:bg-[#76252d]"
            >
              <GiRollingDices aria-hidden="true" className="h-4 w-4" />
              <span>雙屬性擲骰盤</span>
            </button>
          </div>
        </div>

        {/* 右側頁口 */}
        <div
          aria-hidden="true"
          className="hidden w-2 shrink-0 md:block"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, #f4ebd9 0 1px, #fffdf9 1px 3px)',
          }}
        />
      </div>

      {/* ── 授權聲明 ──────────────────────────────────────────────
          改為左對齊、限寬、t12：原本是置中 11px 的長段英文，
          置中長文會讓每一行的起點都在跳動，讀起來比左對齊累得多。 */}
      <footer
        className={`relative z-10 mt-5 w-full max-w-3xl text-left text-t12 leading-relaxed text-ink-2 transition-opacity duration-200 ${
          isOpening ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <img src={modLogo} alt="Fabula Ultima Mod Logo" className="mb-2 h-6 object-contain opacity-70" />
        <div className="space-y-1">
          <p>
            <span className="font-semibold text-ink">《物語手帳》</span> is an independent production by{' '}
            <span className="font-semibold text-ink">ScarletVice</span>.
          </p>
          <p>
            It is <span className="font-semibold text-ink">not endorsed or sponsored in any way</span> by
            Need Games or Rooster Games.
          </p>
          <p>
            Published under the{' '}
            <a
              href="https://need.games/wp-content/uploads/2024/06/Fabula-Ultima-Third-Party-Tabletop-License-1.0.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-signal-accent underline underline-offset-2 hover:text-[#8c3235]"
            >
              Fabula Ultima Third-Party Tabletop License 1.0
            </a>
            .
          </p>
          <p>Fabula Ultima is &copy; Emanuele Galletto, Need Games and Rooster Games.</p>
          <p>
            This tool requires the <span className="font-semibold text-ink">Fabula Ultima Core Rulebook</span>.
          </p>
          <p className="pt-1">
            <span className="font-semibold text-ink">AI 生成內容聲明：</span>
            本工具的介面文案、規則文本整理與程式碼均由 AI 輔助產出，並經人工校對；規則數值一律逐條核對官方原書。
          </p>
          <p>
            本工具僅重製官方規則的<span className="font-semibold text-ink">機制</span>部分（數值、公式、費用、效果、表格），
            不重製官方原書的美術、世界觀敘述與畫風文字。
          </p>
        </div>
        <p className="mt-2 text-ink-3">《物語手帳》 · 純前端零伺服器架構 · 數據即時保存於瀏覽器</p>
      </footer>
    </div>
  );
}
