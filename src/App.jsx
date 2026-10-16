import React, { useState, lazy, Suspense } from 'react';
import {
  GiRollingDices,
  GiDragonHead,
  GiVisoredHelm,
  GiSwordClash,
  GiPocketWatch
} from 'react-icons/gi';
import BookCoverHub from './components/book/BookCoverHub';
import ChapterHeader from './components/book/ChapterHeader';
import BookPageFlipOverlay from './components/book/BookPageFlipOverlay';
import DiceRollerModal from './features/dice-roller/DiceRollerModal';
import ChapterDevWarningModal from './components/book/ChapterDevWarningModal';
import RuleCodexDrawer from './features/character-sheet/components/RuleCodexDrawer';
import { openRuleCodex } from './features/character-sheet/utils/skillFormulaEvaluator';
import { playPageFlipSound } from './utils/soundEffects';
import { STORAGE_KEYS } from './data/keys';
import { readJSON, writeJSON } from './data/store';

// ── 四個章節改為「按需下載」（2026-10-16）────────────────────
//
// 為什麼：實測打包後單一 chunk 2,265 kB（gzip 655 kB），而**「角色卡」一章就佔 50.7%**
// （1,148 kB／gzip 304 kB）。`App.jsx` 本來就是「一次只顯示一個章節」，
// 所以讓瀏覽器「用到哪一章才下載哪一章」是零架構成本的事。
//
// 實測效果（`npm run build`，2026-10-16）：
//   首屏 JS  gzip 655.42 kB → 251.82 kB（**省 403.6 kB，約 −62%**）
//   之後按需要才下載：角色卡 283 kB／NPC 工坊 83 kB／戰鬥輪次 37 kB／命刻 11 kB（皆 gzip）
//
// ※ 刻意**不引入路由**：章節切換沿用既有的 `activeChapter` 狀態，
//   這裡只把 import 換成 `lazy()`，其餘邏輯一行未動。
const CHAPTER_LOADERS = {
  workshop: () => import('./features/npc-workshop/NPCWorkshop'),
  character: () => import('./features/character-sheet/CharacterSheet'),
  combat: () => import('./features/combat-tracker/CombatTracker'),
  clocks: () => import('./features/clocks/FateClockPage'),
};

const NPCWorkshop = lazy(CHAPTER_LOADERS.workshop);
const CharacterSheet = lazy(CHAPTER_LOADERS.character);
const CombatTracker = lazy(CHAPTER_LOADERS.combat);
const FateClockPage = lazy(CHAPTER_LOADERS.clocks);

/**
 * 章節載入中的過場。
 * 正常情況下**看不到**——翻頁動畫有 550ms，而 `proceedToChapter` 會在那段時間
 * 先偷跑下載（見該函式）。只有在網路極慢時才會短暫出現，故做成安靜的置中文字。
 */
const ChapterLoading = () => (
  <div className="flex-1 flex items-center justify-center py-16 text-xs text-[#8c7b6c] font-serif">
    正在展開章節……
  </div>
);

const CHAPTER_METAS = {
  character: {
    id: 'character',
    title: '角色卡助手',
    subtitle: '管理與檢視您創建的所有冒險者角色',
    icon: GiVisoredHelm,
    color: 'emerald'
  },
  workshop: {
    id: 'workshop',
    title: 'NPC工坊',
    subtitle: '管理與檢視您創建的所有自定義 NPC',
    icon: GiDragonHead,
    color: 'amber'
  },
  combat: {
    id: 'combat',
    title: '戰鬥輪次',
    subtitle: '管理遭遇戰動態輪次與各參戰者狀態',
    icon: GiSwordClash,
    color: 'rose'
  },
  clocks: {
    id: 'clocks',
    title: '命刻記錄',
    subtitle: '管理情勢命刻、進度時鐘與場景危機',
    icon: GiPocketWatch,
    color: 'cyan'
  }
};

export default function App() {
  // null represents the Book Cover; string ID represents the exclusive chapter screen
  const [activeChapter, setActiveChapter] = useState(null);
  const [transitionState, setTransitionState] = useState(null); // 'opening' | 'closing' | null
  const [targetChapterId, setTargetChapterId] = useState(null);
  const [pendingDevChapterId, setPendingDevChapterId] = useState(null);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [diceModalConfig, setDiceModalConfig] = useState(null);
  const [headerExtraLeft, setHeaderExtraLeft] = useState(null);
  const [headerExtraRight, setHeaderExtraRight] = useState(null);
  const [characterSubNav, setCharacterSubNav] = useState(null);
  const [workshopSubNav, setWorkshopSubNav] = useState(null);

  const handleOpenDice = (config = null) => {
    setDiceModalConfig(config);
    setIsDiceModalOpen(true);
  };

  // 規則概念速查抽屜為純事件驅動（監聽 fu:open-rule-codex），
  // 不帶關鍵字即開啟於預設條目；由章節標頭的速查按鈕派送。
  const handleOpenCodex = () => openRuleCodex();

  // 實際執行章節翻書切換動作
  const proceedToChapter = (chapterId) => {
    if (transitionState) return;

    // 偷跑：翻頁動畫有 550ms，趁這段時間先把該章的程式碼抓下來，
    // 讓使用者在章節真正出現時不需要等。動態 import 由瀏覽器快取，
    // 這裡先呼叫不會造成重複下載（`lazy()` 之後取的是同一份模組）。
    // 失敗不處理——真的載不到時，`lazy()` 那一側會照常拋錯給 ErrorBoundary。
    CHAPTER_LOADERS[chapterId]?.().catch(() => {});

    playPageFlipSound();
    setCharacterSubNav(null);
    setWorkshopSubNav(null);
    setTargetChapterId(chapterId);
    setTransitionState('opening');

    // Page flip timing: at 550ms switch views while overlay page is wide open
    setTimeout(() => {
      setActiveChapter(chapterId);
    }, 550);

    setTimeout(() => {
      setTransitionState(null);
      setTargetChapterId(null);
    }, 850);
  };

  // Trigger opening page flip to feature
  const handleSelectChapter = (chapterId) => {
    if (transitionState) return;

    // 目前完成的只有NPC工坊的功能完全完整。
    // 在剩下的那三個功能裡（角色卡助手、戰鬥輪次、命刻記錄），
    // 點進章節時跳出提醒視窗，說明此功能仍在開發中、未完善使用，按確定後才可進入。
    if (chapterId !== 'workshop') {
      setPendingDevChapterId(chapterId);
      return;
    }

    proceedToChapter(chapterId);
  };

  const handleConfirmDevWarning = () => {
    if (!pendingDevChapterId) return;
    const target = pendingDevChapterId;
    setPendingDevChapterId(null);
    proceedToChapter(target);
  };

  const handleCancelDevWarning = () => {
    setPendingDevChapterId(null);
  };

  // Trigger closing page flip back to cover
  const handleExitToCover = () => {
    if (transitionState) return;
    setCharacterSubNav(null);
    setWorkshopSubNav(null);
    setTransitionState('closing');

    // Page flip timing: at 380ms switch view back to cover so it fades in smoothly under the closing book
    setTimeout(() => {
      setActiveChapter(null);
    }, 380);

    setTimeout(() => {
      setTransitionState(null);
      setTargetChapterId(null);
    }, 850);
  };

  // 全站備份：涵蓋四個資料類權威鍵（NPC 檔案庫、角色名冊、進行中的戰鬥、命刻）。
  // 不含偏好設定類的鍵（音效、配色）—— 那些不隨備份搬移。
  const handleFullBackup = () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      npcLibrary: readJSON(STORAGE_KEYS.npcLibrary, []),
      characterRoster: readJSON(STORAGE_KEYS.characterRoster, []),
      activeCombat: readJSON(STORAGE_KEYS.activeCombat, {}),
      fateClocks: readJSON(STORAGE_KEYS.fateClocks, [])
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monogatari_techou_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Full site restore
  const handleFullRestore = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.npcLibrary) writeJSON(STORAGE_KEYS.npcLibrary, parsed.npcLibrary);
        if (parsed.characterRoster) writeJSON(STORAGE_KEYS.characterRoster, parsed.characterRoster);
        if (parsed.activeCombat) writeJSON(STORAGE_KEYS.activeCombat, parsed.activeCombat);
        if (parsed.fateClocks) writeJSON(STORAGE_KEYS.fateClocks, parsed.fateClocks);

        alert('完整資料備份還原成功！將為您刷新頁面以載入數據。');
        window.location.reload();
      } catch (err) {
        alert('備份檔解析失敗，請確認檔案格式正確。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentMeta = activeChapter ? CHAPTER_METAS[activeChapter] : null;
  const targetMeta = targetChapterId ? CHAPTER_METAS[targetChapterId] : null;

  const CHAPTER_PAGE_THEMES = {
    workshop: 'bg-[#fbf7ee] text-[#2c221e] selection:bg-amber-200 selection:text-amber-900',
    character: 'bg-[#f4fbf7] text-[#1e293b] selection:bg-emerald-200 selection:text-emerald-900',
    combat: 'bg-[#fdf4f5] text-[#1e293b] selection:bg-rose-200 selection:text-rose-900',
    clocks: 'bg-[#f0f9ff] text-[#1e293b] selection:bg-cyan-200 selection:text-cyan-900',
  };

  const CHAPTER_FOOTER_THEMES = {
    character: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/70',
      number: 'text-emerald-900',
      text: 'text-emerald-800',
      button: 'text-emerald-800 hover:text-emerald-950',
      subtext: 'text-emerald-600/80',
    },
    combat: {
      border: 'border-rose-200',
      bg: 'bg-rose-50/70',
      number: 'text-rose-900',
      text: 'text-rose-800',
      button: 'text-rose-800 hover:text-rose-950',
      subtext: 'text-rose-600/80',
    },
    clocks: {
      border: 'border-sky-200',
      bg: 'bg-sky-50/70',
      number: 'text-sky-900',
      text: 'text-sky-800',
      button: 'text-sky-800 hover:text-sky-950',
      subtext: 'text-sky-600/80',
    },
  };

  const activePageTheme = (activeChapter && CHAPTER_PAGE_THEMES[activeChapter]) || 'bg-[#f0f7f9] text-[#1e293b] selection:bg-cyan-200 selection:text-cyan-900';
  const footerTheme = (activeChapter && CHAPTER_FOOTER_THEMES[activeChapter]) || {
    border: 'border-[#d6c7ab]',
    bg: 'bg-[#f5efdf]/60',
    number: 'text-amber-900',
    text: 'text-[#6b5a4b]',
    button: 'text-amber-800 hover:text-amber-950',
    subtext: 'text-[#8c7b6c]',
  };

  return (
    <div
      className={`min-h-screen ${activePageTheme} flex flex-col relative transition-colors duration-300`}
      style={activeChapter === 'character' && characterSubNav?.theme ? { backgroundColor: characterSubNav.theme.appBg } : {}}
    >
      
      {/* 3D Page Flip Transition Overlay */}
      {transitionState && (
        <BookPageFlipOverlay
          direction={transitionState === 'opening' ? 'open' : 'close'}
          targetChapter={targetMeta || currentMeta}
        />
      )}

      {/* Screen 1: The Book Cover Hub (書的封面入口頁) */}
      {!activeChapter && (
        <div
          className={`flex-1 flex flex-col transition-all duration-500 ease-out ${
            transitionState === 'opening'
              ? 'opacity-0 scale-[0.96] pointer-events-none'
              : transitionState === 'closing'
              ? 'animate-page-dissolve-in'
              : 'opacity-100 scale-100'
          }`}
        >
          <BookCoverHub
            onSelectChapter={handleSelectChapter}
            onOpenDice={handleOpenDice}
            onBackup={handleFullBackup}
            onRestore={handleFullRestore}
            isOpening={transitionState === 'opening'}
          />
        </div>
      )}

      {/* Screen 2: The Exclusive Chapter Workspace (點擊後完全呈現該功能) */}
      {activeChapter && currentMeta && (
        <div
          className={`flex-1 flex flex-col ${
            transitionState === 'closing'
              ? 'opacity-0 scale-[0.98] transition-all duration-350 ease-out pointer-events-none'
              : 'animate-page-dissolve-in'
          }`}
        >
          {/* Dedicated Chapter Header with Exit to Cover */}
          <ChapterHeader
            chapter={currentMeta}
            onExitToCover={handleExitToCover}
            backOverride={
              activeChapter === 'character'
                ? characterSubNav
                : activeChapter === 'workshop'
                  ? workshopSubNav
                  : null
            }
            onOpenDice={handleOpenDice}
            onOpenCodex={handleOpenCodex}
            onBackup={handleFullBackup}
            onRestore={handleFullRestore}
            extraLeft={activeChapter === 'workshop' ? headerExtraLeft : null}
            extraRight={activeChapter === 'workshop' ? headerExtraRight : null}
          />

          {/* Exclusive Main Body —— 章節程式碼按需下載，載入期間顯示極簡過場 */}
          <Suspense fallback={<ChapterLoading />}>
          {activeChapter === 'workshop' ? (
            <main className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
              <NPCWorkshop
                setHeaderExtraLeft={setHeaderExtraLeft}
                setHeaderExtraRight={setHeaderExtraRight}
                onSubNavChange={setWorkshopSubNav}
              />
            </main>
          ) : (
            <>
              <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
                {activeChapter === 'character' && (
                  <CharacterSheet
                    onOpenDice={handleOpenDice}
                    onSubNavChange={setCharacterSubNav}
                  />
                )}
                {activeChapter === 'combat' && <CombatTracker />}
                {activeChapter === 'clocks' && <FateClockPage />}
              </main>

              {/* Dedicated Feature Footer */}
              <footer
                className={`border-t ${footerTheme.border} py-4 px-4 text-center text-xs ${footerTheme.text} font-medium flex flex-col sm:flex-row items-center justify-between gap-2 ${footerTheme.bg} mt-auto max-w-7xl mx-auto w-full transition-colors duration-300`}
                style={activeChapter === 'character' && characterSubNav?.theme ? {
                  borderColor: characterSubNav.theme.border,
                  backgroundColor: `${characterSubNav.theme.headerBg}cc`,
                  color: characterSubNav.theme.textDark
                } : {}}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-serif font-bold ${footerTheme.number}`}
                    style={activeChapter === 'character' && characterSubNav?.theme ? { color: characterSubNav.theme.accent } : {}}
                  >
                    {currentMeta.number}
                  </span>
                  <span>· {currentMeta.title}</span>
                </div>
                <button
                  onClick={handleExitToCover}
                  className={`${footerTheme.button} font-serif font-bold underline underline-offset-2 flex items-center gap-1 text-xs`}
                  style={activeChapter === 'character' && characterSubNav?.theme ? { color: characterSubNav.theme.accentDark } : {}}
                >
                  <span>合上本卷並返回封面目錄</span>
                </button>
                <p
                  className={`text-[11px] ${footerTheme.subtext}`}
                  style={activeChapter === 'character' && characterSubNav?.theme ? { color: characterSubNav.theme.textMuted } : {}}
                >
                  純前端零伺服器架構 · 數據即時自動保存
                </p>
              </footer>
            </>
          )}
          </Suspense>
        </div>
      )}

      {/* Floating Dice Roller Modal */}
      <DiceRollerModal
        isOpen={isDiceModalOpen}
        initialConfig={diceModalConfig}
        onClose={() => {
          setIsDiceModalOpen(false);
          setDiceModalConfig(null);
        }}
      />

      {/* Chapter Development Warning Confirmation Modal (未完成章節提醒彈窗) */}
      <ChapterDevWarningModal
        isOpen={Boolean(pendingDevChapterId)}
        chapter={pendingDevChapterId ? CHAPTER_METAS[pendingDevChapterId] : null}
        onConfirm={handleConfirmDevWarning}
        onClose={handleCancelDevWarning}
      />

      {/* Global Rule Codex Drawer (規則概念速查手冊) */}
      <RuleCodexDrawer />
    </div>
  );
}
