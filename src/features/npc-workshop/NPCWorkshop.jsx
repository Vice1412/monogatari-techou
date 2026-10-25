import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as htmlToImage from 'html-to-image';
import {
  Copy,
  Edit3,
  Save,
  Upload,
  Image as ImageIcon,
  FileText,
  Trash2,
  PlusCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Eye,
  Settings,
  Download,
  CheckCircle2,
  Lock,
  Unlock,
  AlertCircle,
  ChevronDown,
  Link,
  AlertTriangle,
  Search,
  Check,
  Crop,
  RotateCcw,
  Palette,
  Filter,
  ArrowUpDown,
  MessageSquare,
  FileCode,
} from 'lucide-react';
import {
  GiArchiveResearch,
  GiBrain,
  GiBroadsword,
  GiCheckedShield,
  GiCrossedSwords,
  GiDeathSkull,
  GiDna2,
  GiDragonHead,
  GiLaurelCrown,
  GiMonsterGrasp,
  GiPositionMarker,
  GiRollingDices,
  GiScrollQuill,
  GiScrollUnfurled,
  GiSparkles,
  GiSpellBook,
  GiStarSwirl,
  GiUpgrade,
} from 'react-icons/gi';

import EmptyState from '../../components/ui/EmptyState';
import WarningNote from '../../components/ui/WarningNote';

import {
  DAMAGE_TYPES,
  AFFINITY_STATES,
  LEVELS,
  RANKS,
  CATEGORIES,
  TYPE_STYLES,
  ROLE_DESCRIPTIONS,
  ROLE_ICONS,
  VILLAIN_TIERS,
  BOSS_SKILLS_DATA,
  NEGATIVE_SKILLS_DATA,
  SPELLS_DATA,
  ROLES_DATA,
  SPECIES_DATA,
  syncLevelPassives,
  isOffensiveSpell,
  normalizeSpellName,
} from './data';
// `getDynamicValues` 的兩份重複實作已於 2026-10-16 收斂成一份（在 `utils/npcEngine.js`）。
// 本檔原本自帶一份逐字相同的實作，而 `tests/npcWorkshop.test.mjs` 測的是 npcEngine 那一份——
// 兩份並存時「測試綠燈」只保證 npcEngine 那份正確，**生產端用的是沒被測到的那份**。
// 現在本檔已不再需要它（唯一的使用點隨顯示用文字工具搬到 `utils/displayText.jsx`），
// 故不再匯入。護欄見 `tests/npcWorkshop.test.mjs` J 段。
import { exportNpcToCombatant, migrateNpcState, getSpeciesAffinities, getInitialAffinities } from './utils/npcEngine';
import { resolveDragDirection } from './utils/dragDirection';
// 顯示用文字工具（2026-10-16 抽出）：純函式，原本埋在下面，抽出去才測得到。
import { getPlainText, renderFormattedText } from './utils/displayText';
import { SPECIES_THEMES } from './data/speciesThemes';
import { buildNpcText } from './utils/npcTextExport';
import { STORAGE_KEYS, LEGACY_KEYS } from '../../data/keys';
import { ATTRIBUTE_COLORS } from '../character-sheet/data/sourcebookConfig';
import { readJSON, writeJSON, readRaw, writeRaw, removeKey } from '../../data/store';

// 以下 8 個元件與 1 份卡片配色表已抽到獨立檔案（2026-10-16 拆檔第一批）。
import CopyButton from './components/CopyButton';
import SectionAccordion from './components/SectionAccordion';
import SkillCard from './components/SkillCard';
import SpellCard from './components/SpellCard';
import EditableSkill from './components/EditableSkill';
import ReadOnlySkill from './components/ReadOnlySkill';
import FreeModeConfirmModal from './components/FreeModeConfirmModal';
import AvatarCropperModal from './components/AvatarCropperModal';
import { THEMES } from './data/workshopThemes';

// --- COMPONENTS ---


// `getInitialAffinities`／`migrateNpcState`／`getSpeciesAffinities` 的三份本地重複實作
// 已於 2026-10-21 階段 11 刪除，改為匯入 `utils/npcEngine.js` 的單一實作。
// 與 `getDynamicValues` 那次收斂（見上方註解）同一個病：兩份並存時，同一張卡會依
// 「誰先載入」而得到不同結果，而測試只保證被測到的那一份正確。
// 裁定理由與當時量到的行為差異，寫在 `utils/npcEngine.js` 那三個函式的檔頭。

/**
 * ※ 測試注入點（2026-10-16 拆檔第三階段前置）：
 *   `initialDraft` / `initialMainTab` / `initialStep` 三個 props **只為 SSR 護欄而存在**。
 *   理由：8 道建角步驟（`renderStepContent`，約 2,100 行）需要 `state !== null`
 *   才會渲染，而 `state` 原本只能由使用者點擊「建立新 NPC」產生——SSR 不執行事件，
 *   於是這 2,100 行**在拆檔前完全沒有護欄**。沒有護欄就搬它，等於把
 *   「搬錯只會靜默改畫面」的風險放大好幾倍（見 `docs/decisions.md` §AY）。
 *   **生產端永不傳入這三個 props；不傳時行為與過去逐字相同。**
 */

/**
 * 讀回上次未完成的建角草稿（2026-10-22，見 `docs/decisions.md` §BS）。
 *
 * 放在模組層的理由：它只依賴 `readJSON` 與「有沒有測試注入」，不依賴任何元件狀態，
 * 因此可以被掛載時的三個 `useState` 初始器共用同一份結果（元件內宣告會晚於那些初始器）。
 *
 * 回傳 `null` 的三種情況：測試注入了草稿（不得被真實草稿覆蓋）、鍵不存在、
 * 內容不是「有 npc 物件」的形狀（手改備份檔或半截寫入）。
 */
const readDraftSnapshot = (injectedDraft) => {
  if (injectedDraft) return null;
  const snap = readJSON(STORAGE_KEYS.npcDraft, null);
  if (!snap || typeof snap !== 'object') return null;
  if (!snap.npc || typeof snap.npc !== 'object' || Array.isArray(snap.npc)) return null;
  return snap;
};

export default function App({
  setHeaderExtraLeft, setHeaderExtraRight, onSubNavChange = null,
  initialDraft = null, initialMainTab = 'library', initialStep = 1,
}) {
  const sheetRef = useRef(null);

  const [library, setLibrary] = useState(() => {
    // 權威鍵為 `monogatari_techou_npc_library`（2026-10-16 前綴更名）。
    // 舊鍵 `fu_companion_npc_library` 與更早的 `fabula-npc-library-v2` 的內容，
    // 已由 store.migrateLegacyStorage() 在首次渲染前搬移（見 main.jsx）。
    const parsed = readJSON(STORAGE_KEYS.npcLibrary, []);
    // 陣列裡可能混進 null／字串（手改備份檔、被截斷的寫入）。留著它們等於讓
    // 檔案庫列表和後續的 `.map` 在第一次渲染就炸掉，故只收物件。
    return Array.isArray(parsed) ? parsed.filter((n) => n && typeof n === 'object' && !Array.isArray(n)).map(migrateNpcState) : [];
  });

  useEffect(() => { writeJSON(STORAGE_KEYS.npcLibrary, library); }, [library]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── 建角草稿（2026-10-22，見 `docs/decisions.md` §BS）───────────────────────
  // 八步建角是十幾分鐘的工序，而草稿原本只活在 React state 裡：回封面、換章節
  // （章節切換是條件渲染，元件一卸載 state 就沒了）、重新整理、關分頁，全部歸零。
  // `beforeunload` 只攔「真的離開頁面」，攔不到站內換章節——這是使用者實際踩到的洞。
  // 現在每次改動都寫進 `STORAGE_KEYS.npcDraft`，回到工坊時接回去。
  const [draftSnapshot] = useState(() => readDraftSnapshot(initialDraft));
  // 檔案庫頁的「接續草稿」提示。預設就是快照本身，使用者選擇接續或丟棄後清空。
  const [draftOffer, setDraftOffer] = useState(draftSnapshot);

  const [activeMainTab, setActiveMainTab] = useState(() => {
    if (initialMainTab !== 'library') return initialMainTab;
    // 只有「離開時人在建角頁」才自動接回去；從檔案庫離開的就留在檔案庫，
    // 改由檔案庫頁的提示條提供「繼續編輯」。
    return draftSnapshot?.mainTab === 'build' ? 'build' : 'library';
  });
  const [state, setState] = useState(() => {
    if (initialDraft) return initialDraft;
    return draftSnapshot?.mainTab === 'build' ? draftSnapshot.npc : null;
  });
  // 「最新草稿」ref（latest-ref）：ChapterHeader 的「儲存」按鈕與「返回檔案庫」都是
  // 由 useEffect 推上去的，而那些 effect 的依賴陣列刻意只列 `state?.name`（列整個 `state`
  // 等於每敲一個字就重建一次 header）。代價是：只要改的不是名字，按鈕上持有的
  // `handleSaveToLibrary` 就還停在「上一次改名字」那次 render 的閉包裡，存下去的是舊草稿。
  // 實測（2026-10-21，階段 10）：只改背景故事 → 按「儲存」→ 故事整段消失，
  // 而且還彈「已成功儲存」；同一份內容改用 Ctrl+S（那條 effect 的依賴陣列含 `state`）
  // 就存得進去。改成名字與故事交替編輯時，又會「有時候成功」。
  // 修法：存檔讀 ref 而不是閉包，按鈕與 Ctrl+S 兩條路徑就都拿到最新草稿。
  const stateRef = useRef(initialDraft);
  useEffect(() => { stateRef.current = state; });
  // 未存草稿的離場警告（2026-10-21，階段 10）。
  // 八步建角是十幾分鐘的工序，重新載入或關掉分頁就全部消失，而畫面上沒有任何提示。
  // 只在「畫面上的草稿 ≠ 檔案庫裡那張卡」時才攔，已存過的卡不會被這個對話框騷擾。
  // 比對刻意放在事件裡做（而不是每次 render 算簽章）：`beforeunload` 一次只跑一次，
  // 帶 6,000 字背景故事或 base64 頭像的草稿也付得起。
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeMainTab === 'library') return;
      const cur = stateRef.current;
      if (!cur) return;
      const strip = (o) => {
        if (!o) return '';
        const { updatedAt, ...rest } = o;
        return JSON.stringify(rest);
      };
      const saved = library.find((n) => n.id === cur.id);
      if (strip(cur) === strip(saved)) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [library, activeMainTab]);
  const [currentStep, setCurrentStep] = useState(() => {
    if (initialStep !== 1) return initialStep;
    return draftSnapshot?.mainTab === 'build' ? (draftSnapshot.step || 1) : 1;
  });
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // 這裡原本還有一個 `dragStartX` state，但拖曳事件讀的是 `.current`（ref 寫法）。
  // 對一個 number 賦 `.current` 會拋 TypeError，整個拖曳因此失效——只留 ref。
  const dragStartXRef = useRef(0);
  // 步驟一的換頁函式（latest-ref）：拖曳放手要延到下一輪事件迴圈才呼叫，
  // 用 ref 取「當下最新」的閉包，避免讀到舊的 visualIndex。
  const stepMoveRef = useRef(null);
  const [visualIndex, setVisualIndex] = useState(0);
  const [activeAffinityTab, setActiveAffinityTab] = useState('vul');
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const avatarDragCounter = useRef(0);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSource, setCropImageSource] = useState(null);
  const [pendingRawSource, setPendingRawSource] = useState(null);
  const [isFreeModeConfirmOpen, setIsFreeModeConfirmOpen] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  // 2026-10-22：子頁由三頁收斂成兩頁（'stats' | 'skills'），並預設停在「技能」。
  // 理由見 `docs/decisions.md` §BT——舊版預設停在「基礎數值與相性」，而
  // 「基礎攻擊與核心能力」還要再點一次子頁＋一次折疊標題才看得到，等於三層。
  const [step4SubTab, setStep4SubTab] = useState(() => {
    const saved = draftSnapshot?.subTab;
    return saved === 'stats' || saved === 'skills' ? saved : 'skills';
  }); // 'stats' | 'skills'

  // 草稿自動暫存（2026-10-22，見 `docs/decisions.md` §BS）。
  // debounce 600ms：`state` 可能夾著 base64 頭像或幾千字背景故事，每個按鍵都序列化不划算，
  // 而 600ms 的視窗遠小於「切章節／關分頁」的操作間隔，實務上等於不會漏。
  // 這裡刻意不擋「已存進檔案庫」的草稿：留著它，下次進來才接得回同一個工作現場。
  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => {
      writeJSON(STORAGE_KEYS.npcDraft, {
        npc: state,
        mainTab: activeMainTab,
        step: currentStep,
        subTab: step4SubTab,
        savedAt: new Date().toISOString(),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [state, activeMainTab, currentStep, step4SubTab]);
  const [roleSkillSearch, setRoleSkillSearch] = useState('');
  const [spellSearch, setSpellSearch] = useState('');
  const [copyFormatDropdownOpen, setCopyFormatDropdownOpen] = useState(false);
  const [highlightedSkillId, setHighlightedSkillId] = useState(null);

  // Library Search, Filter & Sort State
  const [libSearchQuery, setLibSearchQuery] = useState('');
  const [libRoleFilter, setLibRoleFilter] = useState('all');
  const [libRankFilter, setLibRankFilter] = useState('all');
  const [libSortBy, setLibSortBy] = useState('recent'); // 'recent' | 'name_asc' | 'level_desc' | 'level_asc'

  const availableLibRoles = useMemo(() => {
    const set = new Set();
    library.forEach(n => { if (n.role) set.add(n.role); });
    return Array.from(set).sort();
  }, [library]);

  const availableLibRanks = useMemo(() => {
    const set = new Set();
    library.forEach(n => { if (n.rank) set.add(n.rank); });
    return Array.from(set).sort();
  }, [library]);

  const filteredLibrary = useMemo(() => {
    let list = [...library];

    // Search keyword
    if (libSearchQuery.trim()) {
      const q = libSearchQuery.toLowerCase().trim();
      list = list.filter(npc => {
        const nameMatch = (npc.name || '').toLowerCase().includes(q);
        const roleMatch = (npc.role || '').toLowerCase().includes(q);
        const rankMatch = (npc.rank || '').toLowerCase().includes(q);
        const traitsMatch = (npc.traits || '').toLowerCase().includes(q);
        const tacticsMatch = (npc.tactics || '').toLowerCase().includes(q);
        const storyMatch = (npc.story || '').toLowerCase().includes(q);
        const factionMatch = (npc.faction || '').toLowerCase().includes(q);
        const speciesLabel = npc.selectedSpeciesId ? (SPECIES_THEMES[npc.selectedSpeciesId]?.label || '') : '';
        // 搜尋框的 placeholder 寫的是「物種」，玩家會輸入中文物種名（如「野獸」）。
        // 只比對英文 label 等於照著提示操作反而搜不到，所以中文名與英文標籤兩者都比。
        const speciesName = npc.selectedSpeciesId ? (SPECIES_DATA.find(s => s.id === npc.selectedSpeciesId)?.name || '') : '';
        const speciesMatch = speciesLabel.toLowerCase().includes(q) || speciesName.toLowerCase().includes(q);
        const skillsMatch = (npc.skills || []).some(s => (s.name || '').toLowerCase().includes(q));
        return nameMatch || roleMatch || rankMatch || traitsMatch || tacticsMatch || storyMatch || factionMatch || speciesMatch || skillsMatch;
      });
    }

    // Role filter
    if (libRoleFilter !== 'all') {
      list = list.filter(npc => npc.role === libRoleFilter);
    }

    // Rank filter
    if (libRankFilter !== 'all') {
      list = list.filter(npc => npc.rank === libRankFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (libSortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (libSortBy === 'level_desc') {
        return (parseInt(b.level, 10) || 5) - (parseInt(a.level, 10) || 5);
      }
      if (libSortBy === 'level_asc') {
        return (parseInt(a.level, 10) || 5) - (parseInt(b.level, 10) || 5);
      }
      // 'recent'
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (parseInt((a.id || '').replace(/\D/g, ''), 10) || 0);
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (parseInt((b.id || '').replace(/\D/g, ''), 10) || 0);
      return timeB - timeA;
    });

    return list;
  }, [library, libSearchQuery, libRoleFilter, libRankFilter, libSortBy]);
  const [isWindowDraggingFile, setIsWindowDraggingFile] = useState(false);
  const bottomSheetRef = useRef(null);
  const bsDragStartY = useRef(0);
  const bsDragOffset = useRef(0);

  const handleFreeModeToggleClick = () => {
    if (!state) return;
    if (!state.isFreeModeEnabled) {
      setIsFreeModeConfirmOpen(true);
    } else {
      setState(prev => ({ ...prev, isFreeModeEnabled: false }));
    }
  };

  // 切回嚴謹模式時，自訂骰子會停止套用（資料仍在），但畫面上只會看到數字變回去。
  // 這段提示改在 effect 裡讀「切換後」的 state：在 onClick 裡讀 state.customDice 拿到的是切換前的值，
  // 實測會誤判成「沒有自訂骰子」，於是新手只看到數字悄悄變回標準值。
  const wasFreeModeRef = useRef(false);
  useEffect(() => {
    if (!state) return;
    const was = wasFreeModeRef.current;
    wasFreeModeRef.current = !!state.isFreeModeEnabled;
    if (was && !state.isFreeModeEnabled) {
      const hadCustomDice = !!state.customDice && Object.keys(state.customDice).some(k => state.customDice[k]);
      showToast(hadCustomDice
        ? '已恢復嚴謹模式：自訂骰子已還原為標準值（設定仍保留，再開自由模式即恢復），技能額度與規則限制重新計算。'
        : '已恢復嚴謹模式：重新計算技能額度與規則限制。', 'success');
    }
  }, [state && state.isFreeModeEnabled]);

  const handleConfirmFreeMode = () => {
    setIsFreeModeConfirmOpen(false);
    if (!state) return;
    setState(prev => ({ ...prev, isFreeModeEnabled: true }));
    showToast('已解除規則限制：現在可以自由編輯體質骰子與技能額度！', 'success');
  };

  const [toast, setToast] = useState(null);
  const handleSendToCombat = (npc) => {
    try {
      const combatant = exportNpcToCombatant(npc);
      const activeCombat = readJSON(STORAGE_KEYS.activeCombat, {});
      const combatants = activeCombat.combatants || [];
      combatants.push(combatant);
      activeCombat.combatants = combatants;
      writeJSON(STORAGE_KEYS.activeCombat, activeCombat);
      showToast(`已將【${npc.name || 'NPC'}】推入戰鬥房間！`, 'success');
    } catch (e) {
      console.error('Failed to send to combat:', e);
      showToast('入戰失敗，請確認怪物數據完整。', 'error');
    }
  };

  const [expandedBossGroups, setExpandedBossGroups] = useState({});
  const [activeBossTab, setActiveBossTab] = useState(null);
  const [revealLevel, setRevealLevel] = useState('full'); // 'full', '7', '10', '13'
  const [roleDrafts, setRoleDrafts] = useState({});
  const [cardTheme, setCardTheme] = useState(() => {
    // 配色存的是原始字串（如 `'amber'`）而非 JSON，故走 readRaw 而非 readJSON。
    // 舊鍵依序退回：`fabula-npc-card-theme`（世代 2）→ `fabula-npc-theme`（世代 1）。
    // 正常情況下 migrateLegacyStorage() 已在啟動時把值搬到權威鍵，這裡的退回鏈是保險。
    const saved = readRaw(STORAGE_KEYS.npcCardTheme)
      || readRaw(LEGACY_KEYS.npcCardThemeLegacy)
      || readRaw(LEGACY_KEYS.npcCardThemeV1);
    return saved && THEMES[saved] ? saved : 'amber';
  });
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Workshop UI itself is fixed to its classic warm beige/amber parchment palette
  const workshopTheme = THEMES.amber;
  // Card Preview Theme is customizable
  const currentTheme = THEMES[cardTheme] || THEMES.amber;

  // Clear extra header on left (palette moved to character preview toolbar)
  useEffect(() => {
    if (setHeaderExtraLeft) {
      setHeaderExtraLeft(null);
    }
    return () => {
      if (setHeaderExtraLeft) setHeaderExtraLeft(null);
    };
  }, [setHeaderExtraLeft]);

  // Synchronize subNav with ChapterHeader (Aligns with Character Sheet)
  useEffect(() => {
    if (!onSubNavChange) return;

    if (activeMainTab !== 'library') {
      onSubNavChange({
        label: '返回檔案庫',
        subTitle: `構建：${state?.name || '自訂 NPC'}`,
        onBack: () => {
          handleSaveToLibrary();
          setActiveMainTab('library');
        }
      });
    } else {
      onSubNavChange(null);
    }
  }, [activeMainTab, state?.name, onSubNavChange]);

  // Push NPC Workshop action controls to upper ChapterHeader right side
  useEffect(() => {
    if (setHeaderExtraRight) {
      if (activeMainTab === 'library') {
        setHeaderExtraRight(null);
      } else {
        setHeaderExtraRight(
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 6 色卡片主題切換圓圈 (與角色卡助手完全對齊) */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/80 border border-[#d6c7ab]">
              {Object.keys(THEMES).map(t => {
                const themeObj = THEMES[t];
                const isSelected = cardTheme === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setCardTheme(t);
                      writeRaw(STORAGE_KEYS.npcCardTheme, t);
                    }}
                    className={`w-5 h-5 rounded-full transition-all relative flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'shadow-xs ring-2 ring-offset-1'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: themeObj.accent,
                      borderColor: themeObj.accentDark,
                      ringColor: themeObj.accent
                    }}
                    title={`卡片風格：${themeObj.name}`}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white block shadow-xs" />}
                  </button>
                );
              })}
            </div>

            {/* 規則模式切換 (自由 / 嚴謹) */}
            {state && (
              <button
                type="button"
                onClick={handleFreeModeToggleClick}
                className={`px-2.5 py-1.5 rounded font-bold transition-all flex items-center gap-1 text-xs shadow-2xs border cursor-pointer ${
                  state.isFreeModeEnabled
                    ? 'bg-[#fffdf9] text-[#a63d40] border-[#a63d40] ring-1 ring-[#a63d40]/40 hover:bg-[#f4ebd9]'
                    : 'bg-white text-[#3c2415] border-[#d6c7ab] hover:bg-[#e8dcc4]'
                }`}
                title={state.isFreeModeEnabled ? '規則限制已解除（點擊恢復嚴謹模式）' : '點擊解除規則限制'}
              >
                {state.isFreeModeEnabled ? <Unlock size={13} className="text-[#a63d40]" /> : <Lock size={13} className="text-[#3c2415]" />}
                <span className="hidden sm:inline">
                  {state.isFreeModeEnabled ? '自由模式' : '嚴謹模式'}
                </span>
              </button>
            )}

            {/* 儲存按鈕 */}
            <button
              type="button"
              onClick={handleSaveToLibrary}
              className="text-[#fffdf9] px-3 py-1.5 rounded font-bold transition-all shadow-xs text-xs flex items-center gap-1.5 cursor-pointer bg-[#8c3235] hover:bg-[#a63d40]"
              title="儲存至 NPC 檔案庫 (Ctrl+S)"
            >
              <Save size={13} />
              <span>儲存</span>
            </button>
          </div>
        );
      }
    }
    return () => {
      if (setHeaderExtraRight) setHeaderExtraRight(null);
    };
  }, [
    activeMainTab,
    cardTheme,
    state?.name,
    state?.isFreeModeEnabled,
    setHeaderExtraRight
  ]);

  // --- Task 3.1: Global Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

      // Ctrl+S / Cmd+S: Save NPC
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (state && activeMainTab !== 'library') {
          handleSaveToLibrary();
        }
        return;
      }

      // Escape: Close modals/dropdowns/cropper
      if (e.key === 'Escape') {
        if (isCropModalOpen) { setIsCropModalOpen(false); return; }
        if (isFreeModeConfirmOpen) { setIsFreeModeConfirmOpen(false); return; }
        if (copyFormatDropdownOpen) { setCopyFormatDropdownOpen(false); return; }
        if (isBottomSheetOpen) { setIsBottomSheetOpen(false); return; }
      }

      // Alt+Left / Alt+Right: Step navigation
      if (!isTyping && e.altKey) {
        if (e.key === 'ArrowLeft' && activeMainTab === 'build' && currentStep > 1) {
          e.preventDefault();
          setCurrentStep(p => Math.max(1, p - 1));
        } else if (e.key === 'ArrowRight' && activeMainTab === 'build' && currentStep < 8) {
          e.preventDefault();
          setCurrentStep(p => Math.min(8, p + 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, activeMainTab, currentStep, isCropModalOpen, isFreeModeConfirmOpen, copyFormatDropdownOpen, isBottomSheetOpen]);

  // --- Task 3.2: Window Drag and Drop JSON Import ---
  useEffect(() => {
    const handleWindowDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsWindowDraggingFile(true);
      }
    };

    const handleWindowDragLeave = (e) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsWindowDraggingFile(false);
      }
    };

    const handleWindowDrop = (e) => {
      e.preventDefault();
      setIsWindowDraggingFile(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.json')) {
        showToast("請拖曳 .json 格式的 NPC 檔案", "warning");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed)) {
            setLibrary(prev => {
              const newLib = [...prev];
              parsed.forEach(item => {
                if (item.id && !newLib.some(existing => existing.id === item.id)) {
                  newLib.push(migrateNpcState(item));
                }
              });
              return newLib;
            });
            showToast(`成功備份/匯入 ${parsed.length} 個 NPC 至檔案庫！`, "success");
            setActiveMainTab('library');
          } else if (parsed && typeof parsed === 'object') {
            const migrated = migrateNpcState(parsed);
            setState(migrated);
            setActiveMainTab('build');
            showToast(`已讀取「${migrated.name || 'NPC'}」——按右上「儲存」才會進檔案庫`, "success");
          }
        } catch (err) {
          showToast("JSON 格式解析失敗，請確認檔案內容是否正確！", "error");
        }
      };
      reader.readAsText(file);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // --- Task 3.2: Backup All NPCs ---
  const handleBackupAllNPCs = () => {
    if (!library || library.length === 0) {
      showToast("檔案庫目前為空，無可備份的 NPC", "warning");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(library, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `monogatari_techou_npc_library_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`已成功備份包含 ${library.length} 個 NPC 的全庫檔案！`, "success");
  };

  // --- Task 3.3: Reverse Card Inspector Click Handler ---
  const handleInspectorClick = (skillId, subTabHint = 'skills') => {
    if (!skillId) return;
    if (activeMainTab !== 'build') {
      setActiveMainTab('build');
    }
    if (subTabHint === 'boss') {
      setCurrentStep(5);
    } else {
      setCurrentStep(4);
      // 2026-10-22：子頁只剩「數值」與「技能・咒語・能力」兩頁（§BT）。任何其他提示值
      // 一律落到技能頁，否則會出現「切到步驟 4、兩頁條件都不符合、整頁空白」。
      setStep4SubTab(subTabHint === 'stats' ? 'stats' : 'skills');
    }
    setHighlightedSkillId(skillId);
    showToast("已反向定位至該技能配置卡片", "info");

    setTimeout(() => {
      const el = document.getElementById(`skill-card-${skillId}`) || document.getElementById(`boss-skill-${skillId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    setTimeout(() => {
      setHighlightedSkillId(null);
    }, 2500);
  };

  const [newCustomSkill, setNewCustomSkill] = useState({
    name: '',
    desc: '',
    category: 'action',
    isOffensiveSpell: false,
    baseMp: '10',
    targetType: '一個生物',
    maxTargets: '3',
    duration: '瞬發',
    formula: '[INS + WLP]'
  });

  const handleAddCustomSkill = () => {
    if (!newCustomSkill.name.trim() || !newCustomSkill.desc.trim()) {
      showToast('名稱與效果敘述不可為空！', 'error');
      return;
    }

    // 攻擊性與否改由結構化欄位 spellData.isOffensive 承載（見下方 onAdd），
    // 不再以名稱後綴哨兵標記（AGENTS.md §3.1）。
    let finalName = newCustomSkill.name.trim();

    let computedTarget = newCustomSkill.targetType;
    if (newCustomSkill.targetType === '至多 X 個生物') {
      computedTarget = `至多 ${newCustomSkill.maxTargets.trim() || '3'} 個生物`;
    }

    let cleanBaseMp = newCustomSkill.baseMp.replace(/×\s*T/gi, '').trim() || '10';
    let computedMp = newCustomSkill.targetType === '至多 X 個生物' ? `${cleanBaseMp} × T` : cleanBaseMp;

    const newSkill = {
      id: `custom_${Date.now()}`,
      category: newCustomSkill.category,
      originalName: finalName,
      originalDesc: newCustomSkill.desc.trim(),
      customName: finalName,
      customDesc: newCustomSkill.desc.trim(),
      isModified: true,
      source: 'custom',
      ...(newCustomSkill.category === 'spell' ? {
        spellData: {
          mp: computedMp,
          baseMp: cleanBaseMp,
          targetType: newCustomSkill.targetType,
          maxTargets: newCustomSkill.maxTargets || '3',
          target: computedTarget,
          duration: newCustomSkill.duration?.trim() || '瞬發',
          isOffensive: newCustomSkill.isOffensiveSpell,
          formula: newCustomSkill.isOffensiveSpell ? (newCustomSkill.formula || '[INS + WLP]') : undefined
        }
      } : {})
    };

    setState(prev => ({ ...prev, skills: [...prev.skills, newSkill] }));
    setNewCustomSkill({
      name: '',
      desc: '',
      category: 'action',
      isOffensiveSpell: false,
      baseMp: '10',
      targetType: '一個生物',
      maxTargets: '3',
      duration: '瞬發',
      formula: '[INS + WLP]'
    });
    showToast(`成功新增自訂技能：「${finalName}」`, 'success');
  };

  const speciesAffinities = useMemo(() => getSpeciesAffinities(state?.selectedSpeciesId, state?.speciesConfig), [state?.selectedSpeciesId, state?.speciesConfig]);

  // 徽章只統計「手動分配」的額度（`currentAffinities` 讀的是 `state.affinities`），
  // 物種自帶的抗性走 `speciesAffinities`／`mergedAffinities`，不佔額度。
  // 兩套資料在畫面上只出現一套數字，新手會誤判「物種抗性沒生效」——這裡把物種那段摘要出來。
  const speciesAffinitySummary = useMemo(() => {
    const marks = { vul: '弱', res: '抗', imm: '免', abs: '吸' };
    return Object.entries(speciesAffinities)
      .map(([type, value]) => (marks[value] ? `${type}${marks[value]}` : null))
      .filter(Boolean)
      .join('、');
  }, [speciesAffinities]);

  const mergedAffinities = useMemo(() => {
    if (!state) return getInitialAffinities();
    const affs = { ...state.affinities };
    Object.entries(speciesAffinities).forEach(([type, value]) => {
      affs[type] = value;
    });
    return affs;
  }, [state?.affinities, speciesAffinities]);

  const allLearnedSpells = useMemo(() => {
    if (!state) return [];
    const spells = [];
    // From Species
    if (state.speciesConfig?.spell) spells.push(state.speciesConfig.spell);
    // From Skills (Role, Boss, etc)
    (state.skills || []).forEach(s => {
      if (s.selectedSpells) {
        s.selectedSpells.forEach(sp => {
          const name = typeof sp === 'string' ? sp : sp.name;
          if (name && name !== "最大 MP +10") spells.push(name);
        });
      }
    });
    return [...new Set(spells)];
  }, [state?.speciesConfig?.spell, state?.skills]);

  useEffect(() => {
    if (!window.html2canvas) {
      const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"; document.head.appendChild(script);
    }
  }, []);

  // 前一個提示的定時器必須先清掉。否則「匯入 → 儲存」這種連續操作裡，
  // 前一個提示的 3 秒到點時會把**新**提示一起清掉（實測新提示只活 1.6 秒）。
  const toastTimerRef = useRef(null);
  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  };

  const createNewNPC = () => {
    let initialSkills = ROLES_DATA["暴徒"].defaultSkills.map(s => ({ ...s, id: `${s.id}_${Date.now()}`, libId: s.id, isDefault: true }));
    initialSkills = syncLevelPassives("暴徒", 5, initialSkills);
    const newNpc = {
      id: `npc_${Date.now()}`,
      name: "未知實體", traits: "", story: "", tactics: "", role: "暴徒", level: 5, rank: "士兵", championMultiplier: 1, partyLevel: 5,
      villainTier: "none",
      avatarBase64: null, avatarScale: 1, avatarFit: 'cover', avatarOffsetX: 0, avatarOffsetY: 0, skills: initialSkills,
      selectedSpeciesId: null,
      speciesConfig: { selectedBenefits: [] },
      overrideEnabled: false, overrides: { hp: 0, mp: 0, init: 0, def: 0, mdef: 0 }, affinities: getInitialAffinities(),
      customDice: {},
      isFreeModeEnabled: false
    };
    setState(newNpc);
    const roles = Object.keys(ROLES_DATA);
    setVisualIndex(roles.indexOf("暴徒") + 100 * roles.length);
    setActiveMainTab('build');
    setCurrentStep(1);
  };

  const getReconciledLibrary = (currentState, currentLibrary) => {
    let newLib = [...currentLibrary];
    const idx = newLib.findIndex(n => n.id === currentState.id);
    if (idx >= 0) newLib[idx] = currentState;
    else newLib.unshift(currentState);

    const currentGroup = [currentState.id, ...(currentState.linkedNpcs || [])];

    return newLib.map(npc => {
      if (npc.id === currentState.id) return npc;

      const npcLinks = npc.linkedNpcs || [];
      const wasInGroup = npcLinks.includes(currentState.id);
      const isNowInGroup = currentGroup.includes(npc.id);

      if (isNowInGroup) {
        // Force sync the entire group to this NPC
        return { ...npc, linkedNpcs: currentGroup.filter(id => id !== npc.id) };
      } else if (wasInGroup && !isNowInGroup) {
        // NPC was kicked out of the group by currentState.
        // It loses connections to everyone in the currentGroup.
        return { ...npc, linkedNpcs: npcLinks.filter(id => !currentGroup.includes(id) && id !== currentState.id) };
      }

      // Clean up stray links to currentState if it's no longer in the group
      if (npcLinks.includes(currentState.id)) {
        return { ...npc, linkedNpcs: npcLinks.filter(id => id !== currentState.id) };
      }

      return npc;
    });
  };

  const handleSaveToLibrary = () => {
    // 一律讀 stateRef（見 stateRef 宣告處的註解）：header 的「儲存」與「返回檔案庫」
    // 拿到的是舊閉包，讀閉包會把剛編輯的欄位整批蓋回舊值，而且照樣彈成功提示。
    const latest = stateRef.current;
    if (!latest) return;
    // 檔案庫的「最近更新」排序讀的是 updatedAt，但過去全檔只讀不寫——
    // 於是排序實際上 fallback 到 id 裡的數字（匯入的卡 id 不是純數字，恆排最後）。
    // 存檔時蓋章，排序標籤才對得上它承諾的行為。
    const stamped = { ...latest, updatedAt: new Date().toISOString() };
    setRoleDrafts({});
    setLibrary(prevLib => getReconciledLibrary(stamped, prevLib));
    showToast(`已成功儲存「${latest.name || "未知實體"}」！`, 'success');
  };

  // ── 檔案庫頁的「接續草稿」提示條（2026-10-22，見 `docs/decisions.md` §BS）─────
  // 只在「草稿跟檔案庫裡那張卡不一樣」時才提示。一樣就沒什麼好接續的，
  // 出現只是噪音（例如：存檔後按「返回檔案庫」再離開）。
  const hasUnsavedDraft = (offer) => {
    if (!offer?.npc) return false;
    const strip = (o) => {
      if (!o) return '';
      const { updatedAt, ...rest } = o;
      return JSON.stringify(rest);
    };
    const saved = library.find((n) => n.id === offer.npc.id);
    return strip(saved) !== strip(offer.npc);
  };

  const handleResumeDraft = () => {
    if (!draftOffer?.npc) return;
    setState(draftOffer.npc);
    setCurrentStep(draftOffer.step || 1);
    if (draftOffer.subTab === 'stats' || draftOffer.subTab === 'skills') {
      setStep4SubTab(draftOffer.subTab);
    }
    setActiveMainTab('build');
    setDraftOffer(null);
    showToast(`已接續「${draftOffer.npc.name || '未命名 NPC'}」的未完成草稿`, 'info');
  };

  const handleDiscardDraft = () => {
    removeKey(STORAGE_KEYS.npcDraft);
    setDraftOffer(null);
    showToast('已丟棄未完成的草稿', 'info');
  };

  const handleToggleNPCLink = (targetId) => {
    setState(prev => {
      const currentLinks = prev.linkedNpcs || [];
      const isLinked = currentLinks.includes(targetId);

      if (isLinked) {
        return { ...prev, linkedNpcs: currentLinks.filter(id => id !== targetId) };
      } else {
        const targetNpc = library.find(n => n.id === targetId);
        const targetLinks = targetNpc?.linkedNpcs || [];
        const newLinks = Array.from(new Set([...currentLinks, targetId, ...targetLinks]));
        return { ...prev, linkedNpcs: newLinks };
      }
    });
  };

  const handleJumpToNPC = (targetId) => {
    if (!state) return;
    // Auto-save before jumping
    const updatedLibrary = getReconciledLibrary(state, library);
    setLibrary(updatedLibrary);

    const targetNPC = updatedLibrary.find(n => n.id === targetId);
    if (targetNPC) {
      setState(targetNPC);
      showToast(`已切換至「${targetNPC.name || "未知實體"}」`);
    }
  };

  const processSkillBudgets = () => {
    if (!state) return { processedSkills: [], maxCustomizations: 0, maxRoleSkills: 0, maxBossSkills: 0, maxAllowedBossSkills: 0, hasChampSupport: false, isRoleSlotOccupiedByBoss: false, bonusSkillFromNegative: 0 };
    let processedSkills = state.skills.map(s => ({ ...s, isOverBudget: false }));
    const maxCustomizations = (state.rank === "士兵" || state.rank === "精英") ? 1 : 0;

    let currentCust = 0;
    const hasChampSupport = processedSkills.some(s => s.libId === 'su_skill_5' && !s.isOverBudget);
    processedSkills.filter(s => s.source === 'customization').forEach(s => {
      if (hasChampSupport && (s.libId === 'su_cust_1' || s.libId === 'su_cust_2')) { } else { currentCust++; }
      if (currentCust > maxCustomizations) s.isOverBudget = true;
    });

    let extraRoleSkills = 0;
    processedSkills.forEach(s => { if (s.source === 'customization' && !s.isOverBudget && s.modifiers?.extraRoleSkill) extraRoleSkills += s.modifiers.extraRoleSkill; });

    const baseRoleSkills = (state.level >= 20 ? 1 : 0) + (state.level >= 40 ? 1 : 0) + (state.level >= 60 ? 1 : 0) + (state.rank === "精英" ? 1 : (state.rank === "冠位" ? state.championMultiplier : 0));
    const bonusSkillFromNegative = (state.selectedNegativeSkills || []).length;

    // Calculate Species Bonus Skills
    let bonusSkillsFromSpecies = 0;
    if (state.selectedSpeciesId && state.speciesConfig.selectedBenefits) {
      const bonusIds = {
        sp_beast: 'b5', sp_construct: 'b4', sp_demon: 'b4', sp_element: 'b4',
        sp_humanoid: 'b5', sp_monster: 'b4', sp_plant: 'b6', sp_undead: 'b4'
      };
      const targetId = bonusIds[state.selectedSpeciesId];
      if (targetId) {
        bonusSkillsFromSpecies = state.speciesConfig.selectedBenefits.filter(b => b === targetId).length;
      }
    }

    let availableRoleSkillsBudget = baseRoleSkills + extraRoleSkills + bonusSkillFromNegative + bonusSkillsFromSpecies;

    const baseBossSkills = state.rank === "冠位" ? 1 : 0;
    let currentBossSkills = 0;
    let usedRoleSkillForBoss = 0;
    let bossSubCategories = new Set();
    let hasDuplicateBossSubCategory = false;

    processedSkills.filter(s => s.source === 'bossSkill').forEach(s => {
      // Check subcategory duplication
      const dbSkill = BOSS_SKILLS_DATA.find(db => db.id === s.libId);
      if (dbSkill) {
        if (bossSubCategories.has(dbSkill.subCategory)) hasDuplicateBossSubCategory = true;
        bossSubCategories.add(dbSkill.subCategory);
      }

      currentBossSkills++;
      if (currentBossSkills <= baseBossSkills) {
        // Free Boss Skill slot
      } else {
        // Check if we can use a role skill slot
        if (availableRoleSkillsBudget - usedRoleSkillForBoss > 0) {
          usedRoleSkillForBoss++;
        } else {
          s.isOverBudget = true;
        }
      }
    });

    const isMoreThanTwoBossSkills = currentBossSkills > 2;
    const maxRoleSkills = Math.max(0, availableRoleSkillsBudget - usedRoleSkillForBoss);
    const maxBossSkills = baseBossSkills + usedRoleSkillForBoss;
    const maxAllowedBossSkills = baseBossSkills + availableRoleSkillsBudget;
    const isRoleSlotOccupiedByBoss = usedRoleSkillForBoss > 0;

    // Result will be returned at the end of function

    let currentRole = 0;
    processedSkills.filter(s => s.source === 'roleSkill').forEach(s => {
      currentRole++;
      if (currentRole > maxRoleSkills) s.isOverBudget = true;
    });

    let changed = true;
    while (changed) {
      changed = false;
      processedSkills.forEach(s => {
        if (!s.isOverBudget && s.libId) {
          let dbSkill = ROLES_DATA[state.role].availableSkills.find(db => db.id === s.libId);
          if (!dbSkill) dbSkill = BOSS_SKILLS_DATA.find(db => db.id === s.libId);

          if (dbSkill?.requires) {
            const hasValidReq = dbSkill.requires.every(reqId => processedSkills.some(ps => ps.libId === reqId && !ps.isOverBudget));
            if (!hasValidReq) { s.isOverBudget = true; changed = true; }
          }
          if (dbSkill?.reqRank && !dbSkill.reqRank.includes(state.rank)) { s.isOverBudget = true; changed = true; }
          if (dbSkill?.reqLevel && state.level < dbSkill.reqLevel) { s.isOverBudget = true; changed = true; }
        }
      });
    }

    const secretSkill = processedSkills.find(s => s.libId === 's_skill_7');
    if (secretSkill && !secretSkill.isOverBudget) {
      let availableTargets = [];
      processedSkills.forEach(s => {
        if (!s.isOverBudget) {
          if (s.source !== 'levelPassive' && (s.isDefault || s.category === 'attack')) { if (s.customName || s.originalName) availableTargets.push(s.customName || s.originalName); }
          if (s.spellConfig && s.selectedSpells) {
            s.selectedSpells.slice(0, s.spellConfig.capacity).forEach(sp => {
              const spName = typeof sp === 'string' ? sp : sp.name;
              if (spName !== "最大 MP +10") availableTargets.push(spName);
            });
          }
        }
      });
      availableTargets = [...new Set(availableTargets)].filter(Boolean);
      secretSkill.selectionsConfig = [{ key: "secretArtTarget", label: "▶ 指定祕技目標", options: availableTargets, isLinked: true }];
    }
    if (state.isFreeModeEnabled) {
      processedSkills.forEach(s => {
        s.isOverBudget = false;
      });
    }

    return { processedSkills, maxCustomizations, maxRoleSkills, maxBossSkills, maxAllowedBossSkills, hasChampSupport, isRoleSlotOccupiedByBoss, bonusSkillFromNegative, isMoreThanTwoBossSkills, hasDuplicateBossSubCategory, usedRoleSkillForBoss };
  };

  const { processedSkills, maxCustomizations, maxRoleSkills, maxBossSkills, maxAllowedBossSkills, hasChampSupport, isRoleSlotOccupiedByBoss, bonusSkillFromNegative, isMoreThanTwoBossSkills, hasDuplicateBossSubCategory, usedRoleSkillForBoss } = processSkillBudgets();
  const validSkills = processedSkills.filter(s => !s.isOverBudget);

  const affinityBudgets = state ? (ROLES_DATA[state.role]?.getAffinityBudgets ? ROLES_DATA[state.role].getAffinityBudgets(state.level, validSkills) : { vul: 1, res: 0, imm: 0, abs: 0 }) : { vul: 1, res: 0, imm: 0, abs: 0 };
  const currentAffinities = { vul: 0, res: 0, imm: 0, abs: 0 };
  if (state) {
    DAMAGE_TYPES.forEach(t => {
      const aff = state.affinities[t];
      // Count all manual player selections, even if they are currently locked/overridden by species benefits
      if (aff && aff !== 'normal') currentAffinities[aff]++;
    });
  }

  const handleAffinityClick = (type) => {
    if (!activeAffinityTab || speciesAffinities[type]) return;
    const currentState = state.affinities[type] || 'normal';
    if (currentState === activeAffinityTab) { setState(prev => ({ ...prev, affinities: { ...prev.affinities, [type]: 'normal' } })); return; }
    if (!state.isFreeModeEnabled && currentAffinities[activeAffinityTab] >= affinityBudgets[activeAffinityTab]) return;
    setState(prev => ({ ...prev, affinities: { ...prev.affinities, [type]: activeAffinityTab } }));
  };

  const handleNegativeSkillToggle = (skillId) => {
    setState(prev => {
      const selected = prev.selectedNegativeSkills || [];
      const isSelected = selected.some(s => s.id === skillId);
      let newSelected;
      if (isSelected) {
        newSelected = selected.filter(s => s.id !== skillId);
      } else {
        const skillData = NEGATIVE_SKILLS_DATA.find(s => s.id === skillId);
        if (!skillData) return prev;
        newSelected = [...selected, { id: skillId, selections: {} }];
      }
      return { ...prev, selectedNegativeSkills: newSelected };
    });
  };

  const handleNegativeSkillSelectionChange = (skillId, key, value) => {
    setState(prev => {
      const newSelected = (prev.selectedNegativeSkills || []).map(s =>
        s.id === skillId ? { ...s, selections: { ...s.selections, [key]: value } } : s
      );
      return { ...prev, selectedNegativeSkills: newSelected };
    });
  };

  const handleNegativeSkillUpdate = (skillId, updates) => {
    setState(prev => {
      const newSelected = (prev.selectedNegativeSkills || []).map(s =>
        s.id === skillId ? { ...s, ...updates } : s
      );
      return { ...prev, selectedNegativeSkills: newSelected };
    });
  };

  const handleSpeciesChange = (speciesId) => {
    if (!state || speciesId === state.selectedSpeciesId) return;
    const cfg = state.speciesConfig || {};
    const hasSpeciesConfig = (cfg.selectedBenefits || []).length > 0
      || Object.entries(cfg).some(([k, v]) => (
        k !== 'selectedBenefits'
        && v !== undefined && v !== null && v !== ''
        && !(Array.isArray(v) && v.length === 0)
      ));
    const hasManualAffinity = Object.values(state.affinities || {}).some(v => v && v !== 'normal');
    if (hasSpeciesConfig || hasManualAffinity) {
      const what = [hasSpeciesConfig ? '物種設定' : null, hasManualAffinity ? '手動分配的抗性' : null]
        .filter(Boolean).join('與');
      // SSR 沒有 window.confirm：那裡本來就不會執行 onClick，回 true 讓行為維持不變。
      const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`切換物種會清空目前的${what}，而且切換回來不會恢復。要繼續嗎？`)
        : true;
      if (!ok) return;
    }
    setState(prev => ({
      ...prev,
      selectedSpeciesId: speciesId,
      speciesConfig: { selectedBenefits: [] },
      affinities: getInitialAffinities()
    }));
  };

  const handleSpeciesConfigChange = (key, value) => {
    setState(prev => ({
      ...prev,
      speciesConfig: { ...prev.speciesConfig, [key]: value }
    }));
  };

  const handleSpeciesSpellSelectionChange = (spellName, key, value) => {
    setState(prev => ({
      ...prev,
      speciesConfig: {
        ...prev.speciesConfig,
        spellSelections: {
          ...(prev.speciesConfig.spellSelections || {}),
          [spellName]: {
            ...((prev.speciesConfig.spellSelections && prev.speciesConfig.spellSelections[spellName]) || {}),
            [key]: value
          }
        }
      }
    }));
  };

  const handleSpeciesConfigMultiToggle = (key, value, maxPicks) => {
    setState(prev => {
      const current = prev.speciesConfig[key] || [];
      const isSelected = current.includes(value);
      let next;
      if (isSelected) {
        next = current.filter(item => item !== value);
      } else {
        if (maxPicks && current.length >= maxPicks) {
          next = [...current.slice(1), value];
        } else {
          next = [...current, value];
        }
      }
      return {
        ...prev,
        speciesConfig: { ...prev.speciesConfig, [key]: next }
      };
    });
  };

  const handleBenefitToggle = (benefitId, maxAllowed, isMulti = false) => {
    setState(prev => {
      const selected = prev.speciesConfig?.selectedBenefits || [];
      const currentCount = selected.filter(b => b === benefitId).length;
      let newSelected = [...selected];

      if (isMulti) {
        // Counter logic: 0 -> 1 -> 2 -> 0
        if (currentCount === 0) {
          if (selected.length < maxAllowed) newSelected.push(benefitId);
        } else if (currentCount === 1) {
          if (selected.length < maxAllowed) newSelected.push(benefitId);
          else newSelected = newSelected.filter(b => b !== benefitId);
        } else {
          newSelected = newSelected.filter(b => b !== benefitId);
        }
      } else {
        const isSelected = selected.includes(benefitId);
        if (isSelected) {
          newSelected = selected.filter(b => b !== benefitId);
        } else if (selected.length < maxAllowed) {
          newSelected.push(benefitId);
        }
      }

      // Auto-clear configuration if a benefit that needs selection is removed
      const newSpeciesConfig = { ...prev.speciesConfig, selectedBenefits: newSelected };
      const sp = SPECIES_DATA.find(s => s.id === prev.selectedSpeciesId);
      const isStillIn = newSelected.includes(benefitId);
      if (!isStillIn) {
        const opt = sp.benefitsConfig.options.find(o => o.id === benefitId);
        if (opt?.needsSelection && opt?.selectionConfig?.key) {
          delete newSpeciesConfig[opt.selectionConfig.key];
        }
      }

      return {
        ...prev,
        speciesConfig: newSpeciesConfig
      };
    });
  };

  const calculateStats = () => {
    if (!state) return {};
    // 未知定位（舊卡、改名過的職業、手改備份檔）沒有 levels／base，直接讀就是白頁。
    // 2026-10-21 階段 11：這裡只影響數值計算，卡片自己的 role 字串不動——
    // migrateNpcState 依 tests/npcWorkshop.test.mjs G 段「未知定位仍可遷移」只補缺、不改寫既有值。
    // 代價是這種卡會用暴徒的基準值算 HP／MP／防禦，這是刻意的取捨：有數值可看 > 白頁。
    const roleData = ROLES_DATA[state.role] || ROLES_DATA['暴徒'];
    const lvlData = roleData.levels[state.level];

    const defaultDEX = lvlData.dex || roleData.base.DEX;
    const defaultINS = lvlData.ins || roleData.base.INS;
    const defaultMIG = lvlData.mig || roleData.base.MIG;
    const defaultWLP = lvlData.wlp || roleData.base.WLP;

    const customDice = state.customDice || {};
    const isFree = state.isFreeModeEnabled;

    const finalDEX = (isFree && customDice.DEX) ? customDice.DEX : defaultDEX;
    const finalINS = (isFree && customDice.INS) ? customDice.INS : defaultINS;
    const finalMIG = (isFree && customDice.MIG) ? customDice.MIG : defaultMIG;
    const finalWLP = (isFree && customDice.WLP) ? customDice.WLP : defaultWLP;

    const parseDice = d => parseInt(String(d).replace('d', ''), 10) || 8;
    const defMIGVal = parseDice(defaultMIG);
    const effMIGVal = parseDice(finalMIG);
    const defWLPVal = parseDice(defaultWLP);
    const effWLPVal = parseDice(finalWLP);
    const effDEXVal = parseDice(finalDEX);
    const effINSVal = parseDice(finalINS);

    // HP & MP base formula adjustments based on MIG and WLP dice sizes (5 HP/MP per die size step)
    let baseHP = lvlData.hp + (effMIGVal - defMIGVal) * 5;
    let baseMP = lvlData.mp + (effWLPVal - defWLPVal) * 5;

    let stats = {
      DEX: finalDEX,
      INS: finalINS,
      MIG: finalMIG,
      WLP: finalWLP,
      HP: baseHP,
      MP: baseMP,
      Init: roleData.base.initBase,
      Def: effDEXVal + roleData.base.def,
      MDef: effINSVal + roleData.base.mdef,
      Acc: lvlData.acc,
      Dmg: lvlData.dmg,
      MagicAccModifier: 0,
      statusImmunities: [],
      spellList: []
    };

    if (state.rank === "精英") { stats.HP *= 2; stats.Init += 2; }
    else if (state.rank === "冠位") { stats.HP *= state.championMultiplier; stats.MP *= 2; stats.Init += state.championMultiplier; }

    // --- Species Stat & Status Bonuses ---
    if (state.selectedSpeciesId) {
      const sid = state.selectedSpeciesId;
      const sCfg = state.speciesConfig;
      const sBenefits = sCfg.selectedBenefits || [];

      // Fixed HP Bonuses (Removed for beast/monster as requested)

      // Benefit HP Bonuses
      if (sid === 'sp_beast' && sBenefits.includes('b1')) stats.HP += 10;
      if (sid === 'sp_monster' && sBenefits.includes('b5')) stats.HP += 10;
      if (sid === 'sp_plant' && sBenefits.includes('b1')) stats.HP += 10;

      // Benefit MP Bonuses (b1 for beast, b2/b3 for others)
      const mpBenefitIds = {
        sp_beast: ['b2'], sp_demon: ['b2'], sp_element: ['b2'],
        sp_humanoid: ['b2'], sp_monster: ['b2'], sp_plant: ['b3'], sp_undead: ['b2']
      };
      if (mpBenefitIds[sid]?.some(id => sBenefits.includes(id))) stats.MP += 10;

      // Fixed Status Immunities
      if (sid === 'sp_plant') stats.statusImmunities.push('眩暈', '動搖', '憤怒');
      if (['sp_construct', 'sp_element', 'sp_undead'].includes(sid)) stats.statusImmunities.push('中毒');

      // Selectable Status Immunities
      if (sid === 'sp_construct' && sBenefits.includes('b1')) {
        const chosen = sCfg.sp_construct_imm_status || [];
        chosen.forEach(s => { if (s && !stats.statusImmunities.includes(s)) stats.statusImmunities.push(s); });
      }

      // Benefit Spells
      if (sCfg.spell) {
        if (!stats.spellList.some(s => s.name === sCfg.spell)) {
          const sel = sCfg.spellSelections?.[sCfg.spell] || (sCfg.spellSelections?.customName !== undefined || sCfg.spellSelections?.customDesc !== undefined ? sCfg.spellSelections : {});
          stats.spellList.push({ name: sCfg.spell, selections: sel });
        }
      }
    }

    validSkills.forEach(skill => {
      if (skill.source === 'levelPassive') {
        if (skill.libId === "sab_p10" && skill.selections) { if (skill.selections.bonus === "命中檢定") stats.Acc += 3; if (skill.selections.bonus === "施法檢定") stats.MagicAccModifier += 3; }
        if (skill.libId === "hun_p10") stats.Acc += 3;
      }
      if (skill.modifiers) {
        if (skill.modifiers.hp) stats.HP += skill.modifiers.hp; if (skill.modifiers.mp) stats.MP += skill.modifiers.mp;
        if (skill.modifiers.def) stats.Def += skill.modifiers.def; if (skill.modifiers.mdef) stats.MDef += skill.modifiers.mdef;
        if (skill.modifiers.init) stats.Init += skill.modifiers.init; if (skill.modifiers.magicAcc) stats.MagicAccModifier += skill.modifiers.magicAcc;
      }
      if (skill.selectionsConfig && skill.selections) {
        skill.selectionsConfig.forEach(cfg => {
          const val = skill.selections[cfg.key]; if (!val) return;
          if (cfg.key.startsWith('imm')) { if (!stats.statusImmunities.includes(val) && val !== "無") stats.statusImmunities.push(val); }
        });
      }
      if (skill.spellConfig && skill.selectedSpells) {
        const safeSpells = skill.selectedSpells.slice(0, skill.spellConfig.capacity);
        safeSpells.forEach(sp => {
          const spellName = typeof sp === 'string' ? sp : sp.name;
          if (spellName === "最大 MP +10") stats.MP += 10;
          else if (!stats.spellList.some(s => s.name === spellName)) stats.spellList.push(typeof sp === 'string' ? { name: sp, selections: {} } : sp);
        });
      }
      if (skill.libId === 'bs_dest_4') {
        if (!stats.spellList.some(s => s.name === "毀盪")) stats.spellList.push({ name: "毀盪", selections: {} });
      }
    });

    if (state.overrideEnabled) {
      if (state.overrides.hp) stats.HP = state.overrides.hp; if (state.overrides.mp) stats.MP = state.overrides.mp;
      if (state.overrides.init) stats.Init = state.overrides.init; if (state.overrides.def) stats.Def = state.overrides.def; if (state.overrides.mdef) stats.MDef = state.overrides.mdef;
    }
    return stats;
  };

  const finalStats = calculateStats();

  const validSkillsClone = JSON.parse(JSON.stringify(validSkills));
  const integratedSkills = state && ROLES_DATA[state.role]?.onSkillIntegrate ? ROLES_DATA[state.role].onSkillIntegrate(validSkillsClone) : validSkillsClone;

  let usedRoleSkills = 0;
  if (state) state.skills.forEach(s => { if (s.source === 'roleSkill') usedRoleSkills++; });
  let usedCustomizations = 0;
  if (state) state.skills.forEach(s => { if (s.source === 'customization') { if (hasChampSupport && (s.libId === 'su_cust_1' || s.libId === 'su_cust_2')) return; usedCustomizations++; } });
  let usedBossSkills = 0;
  if (state) state.skills.forEach(s => { if (s.source === 'bossSkill') usedBossSkills++; });

  const groupedSkills = {
    attack: integratedSkills.filter(s => s.category === 'attack' && !s.hideInPreview),
    spell: integratedSkills.filter(s => s.category === 'spell' && !s.hideInPreview),
    action: integratedSkills.filter(s => s.category === 'action' && !s.hideInPreview),
    rule: [
      ...integratedSkills.filter(s => {
        if (s.category !== 'rule' && s.category !== 'boss' && s.category !== undefined) return false;
        if (s.hideInPreview) return false;
        return true;
      }),
      // Inject negative skills as rules
      ...(state?.selectedNegativeSkills || []).map(neg => {
        const skillData = NEGATIVE_SKILLS_DATA.find(s => s.id === neg.id);
        if (!skillData) return null;
        return { ...skillData, ...neg, category: 'rule', source: 'negative' };
      }).filter(Boolean),
      // Inject species special rules
      ...(state && state.selectedSpeciesId && state.speciesConfig.selectedBenefits ?
        (() => {
          const sp = SPECIES_DATA.find(s => s.id === state.selectedSpeciesId);
          if (!sp) return [];
          const rules = [];

          // 1. Scan Fixed Description for Mechanical Rules
          if (sp.fixedDesc.includes('受到恢復 HP 效果的傷害')) {
            rules.push({
              id: 'species_fixed_undead',
              originalName: "不死生物",
              originalDesc: "不死生物會受到恢復 HP 效果的傷害。",
              category: 'rule',
              source: 'species'
            });
          }

          // 2. Scan Benefits for Mechanical Rules
          sp.benefitsConfig.options
            .filter(o => state.speciesConfig.selectedBenefits.includes(o.id))
            .filter(o => o.text.includes('飛行技能') || o.text.includes('身體能力') || o.text.includes('獨特設計') || o.text.includes('sp_humanoid_bg') || o.text.includes('sp_construct_domain') || o.text.includes('【荊棘】'))
            .forEach(o => {
              let name = "特殊規則";
              if (o.text.includes('飛行技能')) name = "飛行";
              else if (o.text.includes('獨特設計') || o.text.includes('sp_construct_domain')) name = "獨特設計";
              else if (o.text.includes('身體能力')) name = "身體能力";
              else if (o.text.includes('sp_humanoid_bg')) name = "背景與訓練";
              else if (o.text.includes('【荊棘】')) name = "荊棘";

              let finalDesc = o.text;
              if (name === "飛行") finalDesc = o.text.replace(/^飛行技能。\s*/, '');
              else if (name === "荊棘") finalDesc = o.text.replace(/^添加特殊規則【荊棘】：\s*/, '');

              rules.push({
                id: `species_${o.id}`,
                originalName: name,
                originalDesc: finalDesc,
                selections: state.speciesConfig,
                category: 'rule',
                source: 'species'
              });
            });

          return rules;
        })() : [])
    ]
  };

  const globalUniqueSpells = new Set();
  validSkills.forEach(skill => {
    if (skill.spellConfig && skill.selectedSpells) {
      skill.selectedSpells.slice(0, skill.spellConfig.capacity).forEach(sp => {
        const spellName = typeof sp === 'string' ? sp : sp.name;
        if (spellName !== "最大 MP +10") globalUniqueSpells.add(spellName);
      });
    }
  });

  const secretArtSkill = validSkills.find(s => s.libId === 's_skill_7' || s.id === 's_skill_7');
  const secretArtTarget = secretArtSkill?.selections?.secretArtTarget;

  if (secretArtTarget) {
    integratedSkills.forEach(skill => {
      const skillName = skill.customName || skill.originalName;
      const cleanName = skillName ? skillName.replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim() : '';
      if (secretArtTarget === skillName || secretArtTarget === cleanName || secretArtTarget === skill.originalName || secretArtTarget === skill.customName) {
        skill.isSecretArt = true;
      }
    });
  }

  const isBasicCore = s => s.source !== 'levelPassive' && (s.isDefault || s.category === 'attack');
  const basicCoreSkillsForCount = validSkills.filter(s => isBasicCore(s) && !s.spellConfig && !s.id.startsWith('custom_'));
  let basicCoreMax = 0; let basicCoreCurrent = 0;
  basicCoreSkillsForCount.forEach(skill => {
    if (skill.selectionsConfig) {
      const visibleConfigs = skill.selectionsConfig.filter(cfg => !cfg.showIfKey || (skill.selections?.[cfg.showIfKey] || "").includes(cfg.showIfValue));
      basicCoreMax += visibleConfigs.length;
      visibleConfigs.forEach(cfg => { if (skill.selections && skill.selections[cfg.key] && skill.selections[cfg.key] !== "") basicCoreCurrent += 1; });
    }
  });

  const basicAttacksToRender = integratedSkills.filter(s => isBasicCore(s) && !s.spellConfig && !s.id.startsWith('custom_'));
  const allSpellbooksToRender = integratedSkills.filter(s => !!s.spellConfig);
  const levelPassivesToRender = integratedSkills.filter(s => s.source === 'levelPassive');

  const hasOffensiveSpells = (() => {
    if (!state) return false;
    const hasListSpell = finalStats.spellList?.some(s => isOffensiveSpell(s.name));
    const hasSpellbookOption = allSpellbooksToRender?.some(s => s.spellConfig?.options?.some(opt => isOffensiveSpell(opt)));
    const hasCustomOffensiveSpell = state.skills?.some(s => s.category === 'spell' && (s.spellData?.isOffensive || isOffensiveSpell(s.customName || s.originalName)));
    return hasListSpell || hasSpellbookOption || hasCustomOffensiveSpell;
  })();

  const unlockedPassives = state ? state.skills.filter(s => s.source === 'levelPassive') : [];
  const systemMilestones = state && ROLES_DATA[state.role]?.getSystemMilestones ? ROLES_DATA[state.role].getSystemMilestones(state.level) : [];
  const displayMilestones = [...unlockedPassives, ...systemMilestones].sort((a, b) => (a.unlockLevel || 0) - (b.unlockLevel || 0));

  // --- Handlers ---
  const handleRoleChange = (eOrString) => {
    const newRole = typeof eOrString === 'string' ? eOrString : eOrString.target.value;
    setState(prev => {
      if (prev.role === newRole) return prev;

      const prevRole = prev.role;
      const prevRoleData = ROLES_DATA[prevRole];

      // 定義哪些技能屬於「前一個定位專屬」
      const isRoleSpecific = (s) => {
        if (s.source === 'levelPassive') return true;
        if (!prevRoleData) return false;
        const isDefault = prevRoleData.defaultSkills.some(ds => ds.id === s.libId);
        const isAvailable = prevRoleData.availableSkills.some(as => as.id === s.libId);
        return isDefault || isAvailable;
      };

      // 提取當前定位專屬技能
      const roleSpecificSkills = prev.skills.filter(isRoleSpecific);
      // 提取非定位的共用技能 (Boss 技能, 自訂技能等)
      const genericSkills = prev.skills.filter(s => !isRoleSpecific(s));

      // 儲存當前草稿
      setRoleDrafts(drafts => ({ ...drafts, [prevRole]: roleSpecificSkills }));

      // 載入新草稿或重置
      let newRoleSkills = [];
      if (roleDrafts[newRole]) {
        newRoleSkills = roleDrafts[newRole];
      } else {
        newRoleSkills = ROLES_DATA[newRole].defaultSkills.map(s => ({ ...s, id: `${s.id}_${Date.now()}`, libId: s.id, isDefault: true }));
      }

      let newSkills = syncLevelPassives(newRole, prev.level, [...genericSkills, ...newRoleSkills]);
      return { ...prev, role: newRole, skills: newSkills };
    });
  };
  const handleLevelChange = (e) => { const newLevel = Number(e.target.value); setState(prev => ({ ...prev, level: newLevel, skills: syncLevelPassives(prev.role, newLevel, prev.skills) })); };

  const handleRankChange = (eOrString) => {
    const newRank = typeof eOrString === 'string' ? eOrString : eOrString.target.value;
    setState(prev => ({
      ...prev,
      rank: newRank,
      // 如果切換到非冠位，重置倍率為 1
      championMultiplier: newRank === "冠位" ? prev.championMultiplier : 1
    }));
  };

  const handleMultiplierChange = (val) => {
    setState(prev => ({ ...prev, championMultiplier: val }));
  };

  const updateSkill = (id, changes) => { setState(prev => ({ ...prev, skills: prev.skills.map(s => s.id === id ? { ...s, ...changes } : s) })); };

  const deleteSkill = (id) => {
    setState(prev => {
      const skillToDelete = prev.skills.find(s => s.id === id); if (!skillToDelete) return prev;

      let dbEntry = ROLES_DATA[state.role].availableSkills.find(db => db.id === skillToDelete.libId);
      if (!dbEntry) dbEntry = BOSS_SKILLS_DATA.find(db => db.id === skillToDelete.libId);

      const dependents = prev.skills.filter(s => {
        let depEntry = ROLES_DATA[state.role].availableSkills.find(db => db.id === s.libId);
        if (!depEntry) depEntry = BOSS_SKILLS_DATA.find(db => db.id === s.libId);
        return depEntry?.requires?.includes(skillToDelete.libId);
      });
      const dependentIds = dependents.map(d => d.id);
      return { ...prev, skills: prev.skills.filter(s => s.id !== id && !dependentIds.includes(s.id)) };
    });
  };
  const updateSelection = (id, key, value) => {
    setState(prev => {
      const updatedSkills = prev.skills.map(s => {
        if (s.id !== id) return s;
        let newSelections = { ...(s.selections || {}), [key]: value };
        if (s.libId === 'bs_obj_1' && key === 'failure_status') {
          if (newSelections.repeat_penalty && newSelections.repeat_penalty.includes(value)) {
            newSelections.repeat_penalty = '失去 [消耗戰HP] 點 HP';
          }
        }
        if (s.libId === 'bs_surv_1') {
          if (key === 'adaptive_30_abs' && value === true) {
            newSelections.adaptive_30_imm = false;
          } else if (key === 'adaptive_30_imm' && value === true) {
            newSelections.adaptive_30_abs = false;
          }
        }
        return { ...s, selections: newSelections };
      });
      return { ...prev, skills: updatedSkills };
    });
  };
  const addEmptySkill = () => { setState(prev => ({ ...prev, skills: [...prev.skills, { id: `custom_${Date.now()}`, category: "rule", originalName: "自訂技能", originalDesc: "請輸入效果敘述...", customName: "自訂技能", customDesc: "請輸入效果敘述...", isModified: true, source: 'custom' }] })); };

  const toggleLibrarySkill = (libSkill) => {
    const isAdded = state.skills.some(s => s.libId === libSkill.id);
    if (isAdded) {
      setState(prev => {
        const dependents = prev.skills.filter(s => {
          let dbEntry = ROLES_DATA[state.role].availableSkills.find(db => db.id === s.libId);
          if (!dbEntry) dbEntry = BOSS_SKILLS_DATA.find(db => db.id === s.libId);
          return dbEntry?.requires?.includes(libSkill.id);
        });
        const dependentIds = dependents.map(d => d.id);
        return { ...prev, skills: prev.skills.filter(s => s.libId !== libSkill.id && !dependentIds.includes(s.id)) };
      });
    } else {
      if (!state.isFreeModeEnabled) {
        if (libSkill.reqLevel && state.level < libSkill.reqLevel) return;
        if (libSkill.reqRank && Array.isArray(libSkill.reqRank) && !libSkill.reqRank.includes(state.rank)) return;
        if (libSkill.requires && !libSkill.requires.every(req => validSkills.some(s => s.libId === req))) return;
      }
      setState(prev => ({ ...prev, skills: [...prev.skills, { ...libSkill, id: `skill_${Date.now()}`, libId: libSkill.id, selectedSpells: [] }] }));
    }
  };

  const toggleSpell = (skillId, spellName, capacity) => {
    setState(prev => ({
      ...prev,
      skills: prev.skills.map(s => {
        if (s.id !== skillId) return s;
        // Check if spell is already claimed by species
        if (prev.speciesConfig?.spell === spellName) return s;

        const currentSpells = s.selectedSpells || []; const isSelected = currentSpells.some(sp => (typeof sp === 'string' ? sp : sp.name) === spellName);
        if (isSelected) return { ...s, selectedSpells: currentSpells.filter(sp => (typeof sp === 'string' ? sp : sp.name) !== spellName) };
        else { if (currentSpells.length >= capacity) return s; return { ...s, selectedSpells: [...currentSpells, { name: spellName, selections: {} }] }; }
      })
    }));
  };
  const updateSpellSelection = (skillId, spellName, key, value) => {
    setState(prev => ({
      ...prev,
      skills: prev.skills.map(s => {
        if (s.id !== skillId) return s;
        return {
          ...s, selectedSpells: (s.selectedSpells || []).map(sp => {
            const name = typeof sp === 'string' ? sp : sp.name;
            if (name !== spellName) return sp;
            const currentSelections = typeof sp === 'string' ? {} : (sp.selections || {});
            return { name, selections: { ...currentSelections, [key]: value } };
          })
        };
      })
    }));
  };

  const processImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast("請選擇正確的圖片檔案 (JPG, PNG, GIF, WebP)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target.result;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1200;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          } else {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setCropImageSource(compressedDataUrl);
          setPendingRawSource(compressedDataUrl);
        } else {
          setCropImageSource(rawDataUrl);
          setPendingRawSource(rawDataUrl);
        }
        setIsCropModalOpen(true);
      };
      img.onerror = () => {
        setCropImageSource(rawDataUrl);
        setPendingRawSource(rawDataUrl);
        setIsCropModalOpen(true);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      showToast("讀取檔案失敗", "error");
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = '';
  };

  const handleLoadImageUrl = (urlToLoad) => {
    const url = (urlToLoad || imageUrlInput || '').trim();
    if (!url) {
      showToast("請輸入有效的圖片網址", "warning");
      return;
    }
    setIsUrlLoading(true);
    showToast("正在讀取網路圖片...", "info");

    if (url.startsWith('data:image/')) {
      setCropImageSource(url);
      setPendingRawSource(url);
      setImageUrlInput('');
      setIsUrlLoading(false);
      setIsCropModalOpen(true);
      return;
    }

    const tryLoadImage = (targetUrl, isProxy = false) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const MAX_DIM = 1200;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setCropImageSource(dataUrl);
          setPendingRawSource(dataUrl);
        } catch (canvasErr) {
          setCropImageSource(targetUrl);
          setPendingRawSource(targetUrl);
        }
        setImageUrlInput('');
        setIsUrlLoading(false);
        setIsCropModalOpen(true);
      };

      img.onerror = () => {
        if (!isProxy && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
          // Retry using CORS proxy fallback
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
          tryLoadImage(proxyUrl, true);
        } else {
          setIsUrlLoading(false);
          showToast("無法載入該網址的圖片，請確認連結正確或下載後拖曳上傳", "error");
        }
      };

      img.src = targetUrl;
    };

    tryLoadImage(url, false);
  };

  const handleReCrop = () => {
    const src = state?.avatarRawBase64 || state?.avatarBase64;
    if (!src) return;
    setCropImageSource(src);
    setPendingRawSource(src);
    setIsCropModalOpen(true);
  };

  const handleConfirmCrop = (croppedDataUrl) => {
    setState(p => ({
      ...p,
      avatarBase64: croppedDataUrl,
      avatarRawBase64: pendingRawSource || p.avatarRawBase64 || croppedDataUrl
    }));
    setIsCropModalOpen(false);
    showToast("頭像裁切與調整完成！");
  };

  const handleAvatarDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    avatarDragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleAvatarDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAvatarDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    avatarDragCounter.current--;
    if (avatarDragCounter.current <= 0) {
      avatarDragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleAvatarDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    avatarDragCounter.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processImageFile(file);
      } else {
        showToast("請拖曳圖片檔案 (JPG, PNG, GIF, WebP)", "error");
      }
      return;
    }

    const draggedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (draggedUrl && (draggedUrl.startsWith('http://') || draggedUrl.startsWith('https://') || draggedUrl.startsWith('data:image/'))) {
      handleLoadImageUrl(draggedUrl);
    }
  };


  const handleExportJPG = async () => {
    if (!sheetRef.current) return;

    setRoleDrafts({});
    showToast("正在處理並匯出高畫質 JPG，請稍候...");

    try {
      // 不要 await document.fonts.ready：
      // 本頁掛著 Google Fonts（index.html 的 <link>），那個網域連不上或很慢時
      // 這個 promise 永遠不會 resolve，匯出就卡死、按鈕永遠停用——看起來像整頁當掉。
      // 字型改用系統字型堆疊渲染即可（見下方 skipFonts）。

      const dataUrl = await htmlToImage.toJpeg(sheetRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: currentTheme.exportBg,
        // 不要讓 html-to-image 去抓網頁字型內嵌（同一顆地雷，見上）
        skipFonts: true,
        filter: (node) => {
          if (node?.classList?.contains('hide-on-export')) {
            return false;
          }
          return true;
        },
        style: {
          textRendering: 'geometricPrecision',
          fontSmooth: 'always',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${state.name || 'NPC'}_Card.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast("角色卡已成功匯出！", "success");
    } catch (error) {
      console.error('Export failed:', error);
      showToast("匯出失敗，請重試或更換瀏覽器。", "error");
    }
  };

  const handleCopyJPG = async () => {
    if (!sheetRef.current) return;

    setRoleDrafts({});
    showToast("正在處理圖片並複製到剪貼簿，請稍候...");

    try {
      // 同上：不要 await document.fonts.ready，也不要讓 html-to-image 去抓網頁字型

      // 剪貼簿 API 在多數瀏覽器中僅支援寫入 image/png
      const blob = await htmlToImage.toBlob(sheetRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: currentTheme.exportBg,
        skipFonts: true,
        filter: (node) => {
          if (node?.classList?.contains('hide-on-export')) {
            return false;
          }
          return true;
        },
        style: {
          textRendering: 'geometricPrecision',
          fontSmooth: 'always',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }
      });

      if (!blob) throw new Error("無法生成圖片資料");

      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);

      showToast("圖片已成功複製到剪貼簿！", "success");
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      showToast("複製失敗，您的瀏覽器可能不支援直接複製圖片，請嘗試匯出。", "error");
    }
  };

  // GM-09-04：這個 handler 原本是**死碼**——全檔沒有任何按鈕接上它，
  // 所以「匯出單張 NPC 的 JSON」在介面上根本不存在，GM 只能靠「備份全庫」。
  // 現在由檔案庫每張卡的「匯出」按鈕呼叫，並接受傳入的 npc（預設仍為目前草稿）。
  const handleExportJSON = (npc = state) => {
    if (!npc) return;
    setRoleDrafts({});
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(npc, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${npc.name || 'npc'}_fabula_ultima.json`;
    a.click();
    showToast(`成功匯出「${npc.name || 'NPC'}」的存檔資料！`, 'success');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // 同一個檔案連續匯入兩次不會再觸發 change，清空才能重試。
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (event) => {
      let parsed;
      try {
        parsed = JSON.parse(event.target.result);
      } catch (err) {
        showToast("無效的 JSON 檔案！請確認格式是否正確。", 'error');
        return;
      }

      // GM-01-01：「備份全庫」產出的是**陣列**，「匯出 JSON」產出的是**物件**。
      // 過去不判型別，陣列被直接塞進 setState，下一個渲染週期就在某個 `.map`
      // 上炸成 ErrorBoundary——而 GM 手上唯一的保險正是那個備份檔。
      if (Array.isArray(parsed)) {
        const incoming = parsed.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
        if (incoming.length === 0) {
          showToast("這個備份檔裡沒有可用的 NPC 資料。", 'error');
          return;
        }
        const normalized = incoming.map(migrateNpcState);
        const existingIds = new Set(library.map((n) => n.id));
        const addedCount = normalized.filter((n) => !existingIds.has(n.id)).length;
        const updatedCount = normalized.length - addedCount;
        setLibrary((prevLib) => {
          const next = [...prevLib];
          normalized.forEach((npc) => {
            const idx = next.findIndex((n) => n.id === npc.id);
            if (idx >= 0) next[idx] = { ...next[idx], ...npc };
            else next.push(npc);
          });
          return next;
        });
        setActiveMainTab('library');
        showToast(`已從備份檔匯入 ${normalized.length} 個 NPC（新增 ${addedCount}、覆蓋 ${updatedCount}）`, 'success');
        return;
      }

      if (!parsed || typeof parsed !== 'object') {
        showToast("無效的 JSON 檔案！請確認格式是否正確。", 'error');
        return;
      }

      try {
        const loadedState = migrateNpcState(parsed);
        setState(loadedState);
        setActiveMainTab('build');
        showToast(`已讀取「${loadedState.name || 'NPC'}」——按右上「儲存」才會進檔案庫`);
      } catch (err) {
        showToast("無效的 JSON 檔案！請確認格式是否正確。", 'error');
      }
    };
    reader.readAsText(file);
  };

  const nextStep = () => {
    // 步驟 3（物種）是核心欄位，但系統允許留空（`selectedSpeciesId` 初值就是 null，
    // 自由模式與「不明生物」都靠它）。不阻擋，只提醒一次——否則新手會一路做到匯出
    // 才發現角色卡上沒有物種那一段。
    if (currentStep === 3 && state && !state.selectedSpeciesId) {
      showToast('還沒選物種：角色卡上不會有物種與物種抗性。要保留無物種可以忽略這個提示。', 'warning');
    }
    setCurrentStep(p => Math.min(p + 1, 8));
  };
  const prevStep = () => setCurrentStep(p => Math.max(p - 1, 1));

  const steps = [
    { num: 1, title: "定位", icon: <GiPositionMarker size={18} /> }, { num: 2, title: "等級", icon: <GiUpgrade size={18} /> }, { num: 3, title: "物種", icon: <GiDna2 size={18} /> },
    { num: 4, title: "能力", icon: <GiBroadsword size={18} /> }, { num: 5, title: "Boss", icon: <GiLaurelCrown size={18} /> }, { num: 6, title: "負面", icon: <GiDeathSkull size={18} /> },
    { num: 7, title: "特質", icon: <GiScrollUnfurled size={18} /> }, { num: 8, title: "戰術", icon: <GiBrain size={18} /> }
  ];

  const renderCharacterCard = () => {
    if (!state) return null;
    const validNpcName = state.name && state.name.trim() !== "" && state.name !== "未知實體" ? state.name.trim() : null;
    const validLinks = (state.linkedNpcs || []).map(id => library.find(n => n.id === id)).filter(Boolean);

    const isRevealed = (category) => {
      if (revealLevel === 'full') return true;
      const lv = parseInt(revealLevel);
      if (category === 'basic') return true; // Level, Species, HP, MP
      if (category === 'stats' && lv >= 10) return true; // Attributes, Def, MDef, Affinities, Traits
      if (category === 'combat' && lv >= 13) return true; // Attacks, Spells
      return false;
    };

    return (
      <div className="w-full max-w-4xl flex flex-col gap-2">
        {validLinks.length > 0 && (
          <div className="bg-[#f4ebd9] border border-[#d6c7ab] p-2.5 flex flex-wrap gap-2 items-center justify-center relative overflow-hidden rounded text-[#2c221e]">
            <span className="text-xs text-[#3c2415] font-bold mr-2 tracking-wider flex items-center z-10"><Link size={14} className="mr-1" />關聯實體快速跳轉：</span>
            {validLinks.map(link => (
              <button key={link.id} onClick={() => handleJumpToNPC(link.id)} className="bg-[#fffdf9] hover:bg-[#f4ebd9] text-[#3c2415] text-t11 font-bold px-3 py-1 rounded-full border border-[#d6c7ab] hover:border-[#3c2415] transition-all flex items-center z-10">
                {link.name || "未知"}
              </button>
            ))}
          </div>
        )}
        <div ref={sheetRef} className="border-[6px] border-double p-1 w-full shadow-[6px_6px_20px_rgba(44,34,30,0.12)] transition-colors duration-300" style={{ backgroundColor: currentTheme.sheetBg, borderColor: currentTheme.accentDark, color: currentTheme.textDark, fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <div className="border p-4 md:p-8 relative transition-colors duration-300" style={{ backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center sm:items-start border-b-4 pb-5 mb-5 gap-4 sm:gap-0" style={{ borderColor: currentTheme.accentDark }}>
              <div className="flex-1 w-full text-center sm:text-left sm:pr-4 flex flex-col items-center sm:items-start">
                <div className="flex flex-wrap items-end justify-center sm:justify-start gap-3 mb-2">
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-widest leading-none drop-shadow-sm text-center sm:text-left" style={{ color: currentTheme.textDark }}>{state.name}</h2>
                  <span className="text-xl font-bold tracking-widest drop-shadow-sm" style={{ color: currentTheme.accent }}>Lv. {state.level}</span>
                  {state.villainTier !== 'none' && (
                    <span className={`sm:ml-auto text-xl font-bold ${VILLAIN_TIERS[state.villainTier].chip} px-3 py-1 rounded border tracking-wider`}>
                      UP {VILLAIN_TIERS[state.villainTier].up}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
                  <div className="text-xs font-bold tracking-widest px-3 py-1 border shadow-inner flex flex-wrap justify-center sm:justify-start items-center gap-1 text-center sm:text-left transition-colors duration-300" style={{ backgroundColor: currentTheme.subpanelBg, borderColor: currentTheme.border, color: currentTheme.textDark }}>
                    {[
                      state.villainTier !== 'none' && revealLevel === 'full' ? `★ ${VILLAIN_TIERS[state.villainTier].label}` : null,
                      `Lv ${state.level}`,
                      state.rank === "冠位" ? `${state.rank} (${state.championMultiplier})` : state.rank,
                      SPECIES_DATA.find(s => s.id === state.selectedSpeciesId)?.name
                    ].filter(Boolean).join(' | ')}
                  </div>
                </div>

                {state.traits && isRevealed('stats') && <div className="text-sm font-bold italic mb-2" style={{ color: currentTheme.accentDark }}>特質: <span className="font-normal text-[#2c221e]">{state.traits}</span></div>}
                {state.story && revealLevel === 'full' && <div className="text-xs text-[#6b5a4b] leading-relaxed border-l-2 pl-3 italic mb-2" style={{ borderLeftColor: currentTheme.accent }}>{state.story}</div>}
                {state.tactics && revealLevel === 'full' && <div className="text-xs text-[#3c2415] leading-relaxed bg-[#f9f5eb] border border-[#d6c7ab] p-2 rounded mt-2"><span className="font-bold">戰術：</span>{state.tactics}</div>}
              </div>
              <div
                onDragEnter={handleAvatarDragEnter}
                onDragOver={handleAvatarDragOver}
                onDragLeave={handleAvatarDragLeave}
                onDrop={handleAvatarDrop}
                className={`relative w-24 h-24 md:w-32 md:h-32 border-2 bg-[#f4ebd9] flex-shrink-0 group overflow-hidden shadow-md select-none block transition-all duration-200 ${
                  isDraggingOver ? 'border-[#3c2415] ring-2 ring-[#3c2415]/50' : 'border-[#d6c7ab] hover:border-[#3c2415]'
                }`}
                title={state.avatarBase64 ? "NPC 頭像" : "點擊上傳或拖曳圖片至此"}
              >
                {state.avatarBase64 ? (
                  <>
                    <img
                      src={state.avatarBase64}
                      alt="Avatar"
                      draggable={false}
                      className="w-full h-full object-cover pixelated select-none"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="hide-on-export absolute inset-0 bg-[#2c221e]/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1 backdrop-blur-[1px]">
                      <button
                        type="button"
                        onClick={handleReCrop}
                        className="px-2 py-1 bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] rounded text-t10 font-bold transition flex items-center gap-1 shadow"
                      >
                        <Crop size={11} /> 調整大小
                      </button>
                      <label className="cursor-pointer px-2 py-1 bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] rounded text-t10 font-bold transition flex items-center gap-1 border border-[#d6c7ab]">
                        <Upload size={11} /> 更換
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full text-[#7c6a58] cursor-pointer">
                    <ImageIcon size={32} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            {isRevealed('stats') && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-5">
                {[{ label: 'DEX', val: finalStats.DEX, c: ATTRIBUTE_COLORS.dex }, { label: 'INS', val: finalStats.INS, c: ATTRIBUTE_COLORS.ins }, { label: 'MIG', val: finalStats.MIG, c: ATTRIBUTE_COLORS.mig }, { label: 'WLP', val: finalStats.WLP, c: ATTRIBUTE_COLORS.wlp }].map(s => (
                  <div key={s.label} className="border p-2 md:p-3 text-center shadow-sm rounded transition-colors duration-300" style={{ backgroundColor: currentTheme.subpanelBg, borderColor: currentTheme.border }}><div className="text-xs font-bold tracking-widest" style={{ color: currentTheme.accentDark }}>{s.label}</div><div className={`text-2xl md:text-3xl font-bold ${s.c} drop-shadow-sm`}>{s.val}</div></div>
                ))}
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-4 mb-5 border p-4 justify-between lg:items-center shadow-sm rounded transition-colors duration-300" style={{ backgroundColor: currentTheme.subpanelBg, borderColor: currentTheme.border }}>
              <div className="flex gap-6 justify-center lg:justify-start border-b lg:border-b-0 border-[#e8dcc4] pb-3 lg:pb-0">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-[#7c6a58] font-bold mb-1 tracking-widest">HP</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-[#8c2d36] drop-shadow-sm">{finalStats.HP}</span>
                    <span className="text-xs font-bold text-[#8c2d36] bg-[#f4ebd9] border border-[#8c2d36]/50 px-1.5 py-0.5 rounded flex items-center gap-1" title={`危機生命值 (Crisis Threshold ≤ ${Math.floor(finalStats.HP / 2)})`}>
                      <span className="fu-icon text-xs leading-none translate-y-[1.5px]">w</span> {Math.floor(finalStats.HP / 2)}
                    </span>
                  </div>
                </div>
                <div className="w-px bg-[#d6c7ab]"></div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-[#7c6a58] font-bold mb-1 tracking-widest">MP</span>
                  <span className="text-2xl font-bold text-[#3c2415] drop-shadow-sm">{finalStats.MP}</span>
                </div>
              </div>
              <div className="flex gap-4 sm:gap-6 justify-center lg:justify-end flex-wrap">
                <div className="flex flex-col items-center"><span className="text-xs text-[#7c6a58] font-bold mb-1 tracking-widest">先攻 INIT</span><span className="text-2xl font-bold text-[#6b5a4b] drop-shadow-sm">{isRevealed('stats') ? finalStats.Init : '??'}</span></div><div className="w-px bg-[#d6c7ab]"></div>
                <div className="flex flex-col items-center"><span className="text-xs text-[#7c6a58] font-bold mb-1 tracking-widest">物防 DEF</span><span className="text-xl sm:text-2xl font-bold text-[#2c221e] drop-shadow-sm mt-auto">{isRevealed('stats') ? finalStats.Def : '??'}</span></div><div className="w-px bg-[#d6c7ab]"></div>
                <div className="flex flex-col items-center"><span className="text-xs text-[#7c6a58] font-bold mb-1 tracking-widest">魔防 M.DEF</span><span className="text-xl sm:text-2xl font-bold text-[#2c221e] drop-shadow-sm mt-auto">{isRevealed('stats') ? finalStats.MDef : '??'}</span></div>
              </div>
            </div>

            {/* 屬性相性 (弱點 VUL / 抗性 RES / 免疫 IMM / 吸收 ABS 區塊化分類顯示) */}
            {(() => {
              const categories = [
                { key: 'vul', label: AFFINITY_STATES.vul.label, color: AFFINITY_STATES.vul.ink },
                { key: 'res', label: AFFINITY_STATES.res.label, color: AFFINITY_STATES.res.ink },
                { key: 'imm', label: AFFINITY_STATES.imm.label, color: AFFINITY_STATES.imm.ink },
                { key: 'abs', label: AFFINITY_STATES.abs.label, color: AFFINITY_STATES.abs.ink }
              ];

              const groupedAffs = categories.map(cat => ({
                ...cat,
                types: DAMAGE_TYPES.filter(t => (mergedAffinities[t] || 'normal') === cat.key)
              })).filter(cat => cat.types.length > 0);

              if (groupedAffs.length === 0 && (!finalStats.statusImmunities || finalStats.statusImmunities.length === 0)) return null;

              return (
                <div
                  className="mb-5 border p-3.5 sm:p-4 rounded shadow-xs transition-colors duration-300 space-y-3.5 overflow-hidden"
                  style={{ backgroundColor: currentTheme.subpanelBg, borderColor: currentTheme.border }}
                >
                  {groupedAffs.length > 0 && (
                    <div className="flex flex-wrap gap-x-6 gap-y-4 items-start">
                      {groupedAffs.map(cat => (
                        <div key={cat.key} className="flex flex-col gap-1.5 min-w-[140px] max-w-full flex-1 sm:flex-initial">
                          {/* 類別標題 (弱點 VUL / 抗性 RES / 免疫 IMM / 吸收 ABS) */}
                          <div className={`text-xs font-black tracking-wider ${cat.color} flex items-center gap-1 border-b border-[#d6c7ab]/70 pb-1.5 mb-1`}>
                            {cat.label}
                          </div>
                          {/* 該類別對應的屬性徽章列表 */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {cat.types.map(t => {
                              const styleInfo = TYPE_STYLES[t] || {};
                              return (
                                <div
                                  key={t}
                                  className="bg-[#fffdf9] border border-[#d6c7ab] px-2.5 py-1 rounded flex items-center gap-1.5 text-xs font-bold transition-all hover:border-[#3c2415] shrink-0"
                                >
                                  <span className={`inline-flex items-center gap-1 ${styleInfo.color || 'text-[#3c2415]'}`}>
                                    <span className="fu-icon text-base leading-none translate-y-[0.5px]">{styleInfo.fuIcon}</span>
                                    <span>{t}</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {finalStats.statusImmunities && finalStats.statusImmunities.length > 0 && (
                    <div className={`pt-2 flex flex-wrap items-center gap-2 text-xs font-bold ${groupedAffs.length > 0 ? 'border-t border-[#d6c7ab]/70' : ''}`}>
                      <span className="text-[#3c2415] font-black tracking-wider shrink-0 flex items-center gap-1">◆ 異常免疫：</span>
                      <div className="flex flex-wrap gap-1.5">
                        {finalStats.statusImmunities.map(status => (
                          <span key={status} className="bg-[#fffdf9] border border-[#d6c7ab] px-2.5 py-1 rounded text-xs font-bold text-[#3c2415]">
                            {status}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const sp = SPECIES_DATA.find(s => s.id === state.selectedSpeciesId);
              if (!sp) return null;

              const benefits = state.speciesConfig.selectedBenefits || [];
              const selectedTexts = sp.benefitsConfig.options
                .filter(o => benefits.includes(o.id))
                .filter(o => {
                  const text = o.text;
                  if (text.includes('飛行技能') || text.includes('身體能力') || text.includes('獨特設計') || text.includes('背景或訓練') || text.includes('sp_construct_domain') || text.includes('【荊棘】')) return false;
                  if (text.includes('最大 HP 增加') || text.includes('最大 MP 增加')) return false;
                  if (text.includes('定位技能')) return false;
                  if (text.includes('狀態效果的免疫') || text.includes('狀態效果免疫')) return false;
                  if (text.includes('抗性') || text.includes('替換為吸收') || text.includes('免疫') || text.includes('吸收')) return false;
                  if (text.includes('學習一個咒語') && state.speciesConfig.spell) return false;
                  return true;
                })
                .map(o => o.text.replace(/，並將最大 MP 增加 10 點。/g, '').replace(/、/g, '、').trim());

              const isPureNumericalFixed = ['sp_construct', 'sp_demon', 'sp_element', 'sp_humanoid', 'sp_plant', 'sp_undead'].includes(state.selectedSpeciesId);
              const content = [isPureNumericalFixed ? null : sp.fixedDesc, ...selectedTexts].filter(Boolean).join(' ');

              if (!content) return null;

              return (
                <div className="bg-[#f4ebd9]/60 p-3.5 rounded border border-[#d6c7ab]/80 text-xs text-[#6b5a4b] leading-relaxed shadow-inner">
                  <div className="font-bold text-[#3c2415] mb-1 flex items-center gap-1.5 text-sm">
                    <span>✦ 物種特質 / 背景說明</span>
                  </div>
                  <div>{renderFormattedText(content, state.speciesConfig, state.level, state.partyLevel)}</div>
                </div>
              );
            })()}

            {/* 技能與咒語列表 */}
            {isRevealed('combat') && (
              <>
                {groupedSkills.attack.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold border-b-2 mb-3 flex items-center gap-2 tracking-widest" style={{ borderBottomColor: currentTheme.accent, color: currentTheme.accentDark }}><span className="fu-icon text-t20 drop-shadow-sm translate-y-[1px]">m</span> 基本攻擊</h3>
                    <div className="flex flex-col gap-3 mb-4 ml-2">
                      {groupedSkills.attack.map(skill => (
                        <ReadOnlySkill key={skill.id} skill={skill} finalStats={finalStats} npcName={validNpcName} npcLevel={state.level} partyLevel={state.partyLevel} onInspectorClick={handleInspectorClick} />
                      ))}
                    </div>
                  </div>
                )}
                {(finalStats.spellList.length > 0 || groupedSkills.spell.length > 0) && (
                    <div>
                      <h3 className="text-lg font-bold border-b-2 mb-3 flex items-center gap-2 tracking-widest" style={{ borderBottomColor: currentTheme.accent, color: currentTheme.accentDark }}><span className="fu-icon text-t20 drop-shadow-sm translate-y-[1px]">c</span> 咒語</h3>
                      {finalStats.spellList.length > 0 && (
                        <div className="flex flex-col gap-3 mb-4 ml-2">
                          {finalStats.spellList.map((spellObj, i) => {
                            const rawSpellName = spellObj.name;
                            const selections = spellObj.selections || {};
                            const cleanSpellName = normalizeSpellName(rawSpellName);
                            const effectiveName = selections.customName !== undefined ? selections.customName : cleanSpellName;
                            const spellData = SPELLS_DATA[cleanSpellName];
                            const effectiveDesc = selections.customDesc !== undefined ? selections.customDesc : spellData?.effect || '';
                            const isOffensive = isOffensiveSpell(rawSpellName);
                            const isSecretArtForSpell = cleanSpellName === secretArtTarget || rawSpellName === secretArtTarget;
                            const totalMagicAcc = finalStats.Acc + finalStats.MagicAccModifier;

                            let nameState = { used: false };
                            const replaceNPC = (txt) => {
                              if (typeof txt !== 'string' || !validNpcName) return txt;
                              return txt.replace(/此\s?NPC\s?/g, () => {
                                if (!nameState.used) { nameState.used = true; return `__NPC_NAME__${validNpcName}__NPC_END__`; }
                                return "它";
                              });
                            };

                            const replacedTarget = replaceNPC(spellData?.target);
                            const rawEffectBase = effectiveDesc.replace(/【HR\+(\d+)】/g, (match, p1) => `[HR + ${parseInt(p1) + finalStats.Dmg}]`);
                            const replacedEffect = replaceNPC(rawEffectBase);

                            let spellTextToCopy = `> ${isOffensive ? '【攻擊性咒語】' : '【咒語】'} ${getPlainText(normalizeSpellName(effectiveName), selections, state.level, state.partyLevel)}`;
                            if (spellData) {
                              spellTextToCopy += ` (MP: ${spellData.mp} | 目標: ${getPlainText(replacedTarget, selections, state.level, state.partyLevel)} | 持續: ${spellData.duration})\n`;
                              if (isOffensive) {
                                const accStr = totalMagicAcc > 0 ? ` +${totalMagicAcc}` : (totalMagicAcc < 0 ? ` - ${Math.abs(totalMagicAcc)}` : '');
                                const formulaDisplay = state.magicFormula || '[INS + WLP]';
                                spellTextToCopy += `> ${formulaDisplay}${accStr} ✦ 魔法攻擊\n`;
                              }
                              let effectText = effectiveDesc.replace(/【HR\+(\d+)】/g, (match, p1) => `[HR + ${parseInt(p1) + finalStats.Dmg}]`);
                              spellTextToCopy += `> ${getPlainText(effectText, selections, state.level, state.partyLevel).split('\n').join('\n> ')}`;
                              if (isSecretArtForSpell) {
                                spellTextToCopy += `
> *(此咒語為祕技，除了目標之外沒有人會意識到那是什麼。)*`;
                              }
                            }

                            if (validNpcName) {
                              let mdUsed = false;
                              spellTextToCopy = spellTextToCopy.replace(/此\s?NPC\s?/g, () => {
                                if (!mdUsed) { mdUsed = true; return `**${validNpcName}**`; }
                                return "它";
                              });
                            }

                            return (
                              <div key={i} className={`bg-[#f9f5eb] border-l-4 p-3 text-sm break-inside-avoid rounded-r border border-[#e8dcc4] ${isSecretArtForSpell ? 'border-l-[#3c2415] bg-[#fffdf9] ring-1 ring-[#d6c7ab]' : 'border-l-[#7c6a58]'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8dcc4] pb-2 mb-2">
                                  <span className="font-bold text-t16 flex flex-wrap items-center gap-1 text-[#3c2415]">
                                    <span className="fu-icon text-xl drop-shadow-sm shrink-0">{CATEGORIES.find(c => c.id === 'spell')?.fuIcon || 'c'}</span> {isOffensive && <span className="fu-icon text-xl text-[#8c2d36] drop-shadow-sm mr-0.5 shrink-0" title="攻擊性咒語">{TYPE_STYLES['攻擊性咒語']?.fuIcon || 'o'}</span>}<span className={selections.customName !== undefined ? 'text-[#3c2415] font-bold' : ''}>{renderFormattedText(normalizeSpellName(effectiveName), selections, state.level, state.partyLevel)}</span>
                                    {isSecretArtForSpell && (
                                      <span className="text-t10 text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab] px-1 rounded font-normal">※ 祕技</span>
                                    )}
                                    <CopyButton text={spellTextToCopy} />
                                  </span>
                                </div>

                                {spellData && (
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6b5a4b] font-bold tracking-wider bg-[#fffdf9] px-2.5 py-1 mb-2 rounded border border-[#d6c7ab] w-fit">
                                    <span>MP: <span className="text-[#3c2415] font-bold">{spellData.mp}</span></span>
                                    <span className="text-[#d6c7ab]">|</span>
                                    <span>目標: <span className="text-[#2c221e]">{renderFormattedText(replacedTarget, selections, state.level, state.partyLevel)}</span></span>
                                    <span className="text-[#d6c7ab]">|</span>
                                    <span>持續: <span className="text-[#2c221e]">{spellData.duration}</span></span>
                                  </div>
                                )}

                                {isOffensive && <div className="text-[#8c2d36] text-t12 font-bold mb-1.5 flex items-center gap-1.5"><span className="text-[#2c221e] tracking-widest">{state.magicFormula || '[INS + WLP]'}</span> {totalMagicAcc !== 0 && <span className="text-[#3c2415]">{totalMagicAcc > 0 ? `+ ${totalMagicAcc}` : `- ${Math.abs(totalMagicAcc)}`}</span>} ✦ 魔法攻擊</div>}

                                <div className={`text-sm leading-relaxed ${selections.customDesc !== undefined ? 'text-[#3c2415] font-medium' : 'text-[#3c2415]'}`}>
                                  {spellData ? renderFormattedText(replacedEffect, selections, state.level, state.partyLevel) : "無詳細資料。"}
                                  {isSecretArtForSpell && <div className="text-[#6b5a4b] mt-1.5 text-xs font-bold">*(此咒語為祕技，除了目標之外沒有人會意識到那是什麼。)*</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {groupedSkills.spell.map(skill => (
                        <ReadOnlySkill key={skill.id} skill={skill} finalStats={finalStats} npcName={validNpcName} npcLevel={state.level} partyLevel={state.partyLevel} onInspectorClick={handleInspectorClick} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {revealLevel === 'full' && (
                <>
                  {groupedSkills.action.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold border-b-2 mb-3 flex items-center gap-2 tracking-widest" style={{ borderBottomColor: currentTheme.accent, color: currentTheme.accentDark }}><span className="fu-icon text-t20 drop-shadow-sm translate-y-[1px]">s</span> 其餘行動</h3>
                      {groupedSkills.action.map(skill => (
                        <ReadOnlySkill key={skill.id} skill={skill} finalStats={finalStats} npcName={validNpcName} npcLevel={state.level} partyLevel={state.partyLevel} onInspectorClick={handleInspectorClick} />
                      ))}
                    </div>
                  )}
                  {groupedSkills.rule.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold border-b-2 mb-3 flex items-center gap-2 tracking-widest" style={{ borderBottomColor: currentTheme.accent, color: currentTheme.accentDark }}><span className="text-lg">✦</span> 特殊規則</h3>
                      {groupedSkills.rule.map(skill => (
                        <ReadOnlySkill key={skill.id} skill={skill} finalStats={finalStats} npcName={validNpcName} npcLevel={state.level} partyLevel={state.partyLevel} onInspectorClick={handleInspectorClick} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
    );
  };

  // 本體已抽到 `utils/npcTextExport.js`（2026-10-16 拆檔第二批）。
  // 拆成兩半：`buildNpcText` 是**純函式**（只回字串，可被測試），
  // 這裡只負責「把元件作用域的依賴打包成 ctx」與「複製到剪貼簿」的副作用。
  const handleCopyFullNpc = (format = 'markdown') => {
    const trimmedText = buildNpcText({
      state, revealLevel, currentTheme, mergedAffinities,
      processedSkills, calculateStats, secretArtTarget,
    }, format);
    if (trimmedText === undefined) return; // 尚未建立 NPC 時不動作（與原本的 `if (!state) return` 等價）

    const handleSuccessToast = () => {
      // GM-09-03：非「完整」視角時輸出會剔除背景故事與戰術，但提示語照樣說
      // 「全文本」——GM 會以為玩家拿到的是完整資料。
      const revealNote = revealLevel === 'full' ? '' : `（${revealLevel}+ 視角：不含背景故事與戰術）`;
      if (format === 'ccfolia') {
        showToast(`已複製 ccfolia 棋子！請至 ccfolia 房間按 Ctrl+V 貼上${revealNote}`, 'success');
      } else {
        const formatName = format === 'discord' ? 'Discord' : format === 'plain' ? '純文字筆記' : 'Markdown';
        showToast(`已複製${revealLevel === 'full' ? '全文本' : ''}角色卡 (${formatName})${revealNote}`, 'success');
      }
    };

    const copyViaTextArea = () => {
      const textArea = document.createElement("textarea");
      textArea.value = trimmedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      handleSuccessToast();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(trimmedText).then(() => {
        handleSuccessToast();
      }).catch(copyViaTextArea);
    } else {
      copyViaTextArea();
    }
  };
  const renderStepContent = () => {
    if (!state) return null;
    switch (currentStep) {
      case 1:
        const roles = Object.keys(ROLES_DATA);

        const handleMove = (dir) => {
          const newIdx = visualIndex + dir;
          const newRoleName = roles[((newIdx % roles.length) + roles.length) % roles.length];
          setVisualIndex(newIdx);
          handleRoleChange(newRoleName);
        };
        stepMoveRef.current = handleMove;

        const onMouseDown = (e) => {
          setIsDragging(true);
          dragStartXRef.current = e.clientX;
        };

        const onMouseMove = (e) => {
          if (!isDragging) return;
          setDragOffset(e.clientX - dragStartXRef.current);
        };

        // 松手時用「事件座標 − 按下座標」現算位移，而不是讀 dragOffset state。
        // state 要等一次重繪才更新，快速甩動後立刻松手會讀到舊值（甚至還是 0）——
        // 拖了半個螢幕卻沒反應，新手只會以為「這東西不能拖」。
        // 換頁還要延到下一輪事件迴圈：在 mouseup 的同步棧裡呼叫 handleMove，
        // 會和 setIsDragging 觸發的重繪撞在一起，setVisualIndex 直接落空（實測）。
        const finishDrag = (endX, threshold) => {
          const dx = endX - dragStartXRef.current;
          setIsDragging(false);
          setDragOffset(0);
          const dir = resolveDragDirection(dx, threshold);
          if (dir !== 0) setTimeout(() => stepMoveRef.current?.(dir), 0);
        };

        const onMouseUp = (e) => {
          if (!isDragging) return;
          finishDrag(e.clientX, 80);
        };

        const onTouchStart = (e) => {
          setIsDragging(true);
          dragStartXRef.current = e.touches[0].clientX;
        };

        const onTouchMove = (e) => {
          if (!isDragging) return;
          setDragOffset(e.touches[0].clientX - dragStartXRef.current);
        };

        const onTouchEnd = (e) => {
          if (!isDragging) return;
          const t = e.changedTouches?.[0];
          finishDrag(t ? t.clientX : dragStartXRef.current, 50);
        };

        // （原「渲染範圍：visualIndex 前後各 3 個」的 renderRange 已於 2026-10-21 階段 11 刪除：
        //   它算完之後沒有任何地方讀取，實際渲染的是下面 Array.from({ length: 201 }) 全量輸出。）

        // 2026-10-21 階段 11：定位字串有值但本版不認得（舊卡、改名、手改備份檔）時，
        // 上面的轉盤只畫得出六個已知定位，於是畫面會停在「某個」定位上，而卡片裡其實是別的字。
        // 不把值改掉（存檔原樣保留），但一定要說出來，否則 GM 會以為卡片就是畫面上那個定位。
        const unknownRole = !!state.role && !ROLES_DATA[state.role];

        return (
          <div className="flex flex-col h-full space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-5xl mx-auto relative pb-10 select-none">
            {unknownRole && (
              <WarningNote title={<>這張卡的定位「{state.role}」不在本版資料裡</>}>
                存檔會原樣保留這個字，但畫面上的數值與技能是以暴徒的基準算的。選任一個定位就會覆蓋掉原本的值。
              </WarningNote>
            )}
            <div>
              <h3 className="font-bold text-t16 text-[#2c221e]">步驟 1：選擇NPC的定位</h3>
              <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">每個定位都擁有獨特的成長屬性。環狀捲軸已開啟，您可以無限滑動來挑選。</p>
            </div>

            {/* Carousel Outer Container */}
            <div
              className="relative py-12 px-4 flex items-center justify-center overflow-hidden h-[500px]"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
            >
              {/* Navigation Arrows */}
              <button onClick={(e) => { e.stopPropagation(); handleMove(-1); }} className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-[#fffdf9] border border-[#d6c7ab] text-[#3c2415] hover:bg-[#f4ebd9] hover:border-[#3c2415] hover:text-[#2c221e] transition-all shadow-md">
                <ChevronLeft size={32} strokeWidth={3} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleMove(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-[#fffdf9] border border-[#d6c7ab] text-[#3c2415] hover:bg-[#f4ebd9] hover:border-[#3c2415] hover:text-[#2c221e] transition-all shadow-md">
                <ChevronRight size={32} strokeWidth={3} />
              </button>

              {/* The Sliding Track */}
              <div
                className="relative flex items-center transition-all duration-500 ease-out w-0 h-full"
                style={{
                  transform: `translateX(calc(${isMobile ? '-7rem' : '-12rem'} - (${visualIndex} * ${isMobile ? '16rem' : '27rem'}) + ${dragOffset}px))`
                }}
              >
                {/* 我們渲染一個足夠大的範圍來涵蓋目前的視角 */}
                {/* 為了簡化，我們直接渲染 visualIndex 附近的卡片 */}
                {Array.from({ length: 201 }).map((_, idx) => {
                  const itemIndex = idx + visualIndex - 100;
                  const roleName = roles[((itemIndex % roles.length) + roles.length) % roles.length];
                  const isActive = itemIndex === visualIndex;
                  const distance = Math.abs(itemIndex - visualIndex);

                  // 只渲染視線範圍內的卡片以節省效能
                  if (distance > 4) return null;

                  return (
                    <div
                      key={itemIndex}
                      onClick={() => {
                        if (!isActive) {
                          setVisualIndex(itemIndex);
                          handleRoleChange(roleName);
                        }
                      }}
                      className={`flex-shrink-0 transition-all duration-500 cursor-pointer relative ${isMobile ? 'w-56' : 'w-96'}`}
                      style={{
                        transform: `scale(${isActive ? 1.05 : 0.8}) rotateY(${(itemIndex - visualIndex) * -15}deg)`,
                        opacity: isActive ? 1 : 0.2 / Math.max(1, distance),
                        filter: isActive ? 'none' : `blur(${distance * 1}px) grayscale(100%)`,
                        position: 'absolute',
                        left: `calc(${itemIndex} * ${isMobile ? '16rem' : '27rem'})`
                      }}
                    >
                      <div className={`bg-[#fffdf9] p-4 sm:p-8 rounded border-2 transition-all duration-300 ${isActive ? 'border-[#3c2415] shadow-xl' : 'border-[#d6c7ab]'} relative overflow-hidden group`}>
                        {/* Background Watermark Icon */}
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-[#6b5a4b] pointer-events-none transition-transform duration-1000">
                          {(() => {
                            const WatermarkIcon = ROLE_ICONS[roleName] || ROLE_DESCRIPTIONS[roleName]?.Icon;
                            return WatermarkIcon ? (
                              <WatermarkIcon className="w-48 h-48 sm:w-56 sm:h-56 -rotate-12 transform translate-x-8 -translate-y-8" />
                            ) : null;
                          })()}
                        </div>

                        <div className="relative z-10 flex flex-col items-center text-center gap-4">
                          <div className={`w-28 h-28 rounded-full flex items-center justify-center border transition-all duration-500 ${isActive ? 'bg-[#f4ebd9] border-[#3c2415] shadow-md text-[#3c2415]' : 'bg-[#f4ebd9] border-[#d6c7ab] text-[#6b5a4b]'}`}>
                            {(() => {
                              const CardIcon = ROLE_ICONS[roleName] || ROLE_DESCRIPTIONS[roleName]?.Icon;
                              return CardIcon ? (
                                <CardIcon className="w-14 h-14" />
                              ) : null;
                            })()}
                          </div>
                          <div>
                            <h2 className="text-3xl sm:text-4xl font-black text-[#3c2415] tracking-[0.15em] mb-1">{roleName}</h2>
                            <div className={`inline-block px-3 py-0.5 rounded-full text-t10 font-bold tracking-widest uppercase ${isActive ? 'bg-[#e8dcc4] text-[#2c221e] border border-[#d6c7ab]' : 'bg-[#f4ebd9] text-[#6b5a4b]'}`}>
                              {ROLE_DESCRIPTIONS[roleName].subtitle}
                            </div>
                          </div>
                          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#d6c7ab] to-transparent"></div>
                          <p className="text-[#6b5a4b] leading-relaxed text-sm font-medium h-24 overflow-hidden line-clamp-4">
                            {ROLE_DESCRIPTIONS[roleName].desc}
                          </p>
                        </div>

                        {isActive && (
                          <>
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#3c2415] rounded-tl opacity-80"></div>
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#3c2415] rounded-tr opacity-80"></div>
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#3c2415] rounded-bl opacity-80"></div>
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#3c2415] rounded-br opacity-80"></div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Role Quick Select Bar */}
            <div className="grid grid-cols-3 sm:flex sm:justify-center gap-2 sm:gap-4 mt-2 px-4 w-full max-w-[280px] sm:max-w-none mx-auto">
              {roles.map((r) => {
                const isCurrent = roles[((visualIndex % roles.length) + roles.length) % roles.length] === r;
                const QuickIcon = ROLE_ICONS[r] || ROLE_DESCRIPTIONS[r]?.Icon;
                return (
                  <button
                    key={r}
                    onClick={() => {
                      const rolesArr = Object.keys(ROLES_DATA);
                      const targetBaseIdx = rolesArr.indexOf(r);
                      const currentBaseIdx = ((visualIndex % rolesArr.length) + rolesArr.length) % rolesArr.length;
                      let diff = targetBaseIdx - currentBaseIdx;
                      if (diff > rolesArr.length / 2) diff -= rolesArr.length;
                      if (diff < -rolesArr.length / 2) diff += rolesArr.length;
                      setVisualIndex(v => v + diff);
                      handleRoleChange(r);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded transition-all duration-300 w-full aspect-square sm:w-20 sm:h-20 border-2 ${isCurrent ? 'bg-[#f4ebd9] border-[#3c2415] shadow-md z-10' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#3c2415] hover:bg-[#fbf7ee] opacity-80 hover:opacity-100'}`}
                  >
                    <div className={`mb-1 drop-shadow-sm flex items-center justify-center ${isCurrent ? 'text-[#3c2415]' : 'text-[#6b5a4b]'}`}>
                      {QuickIcon ? (
                        <QuickIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                      ) : null}
                    </div>
                    <div className={`text-t10 sm:text-t11 font-black tracking-widest ${isCurrent ? 'text-[#3c2415]' : 'text-[#6b5a4b]'}`}>{r}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center mt-4">
              <button
                onClick={nextStep}
                style={{ backgroundColor: workshopTheme.accent }}
                className="group relative px-10 py-4 text-white font-black tracking-[0.2em] rounded shadow-md transition-all hover:brightness-110 flex items-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-[-20deg]"></div>
                確認定位 <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-300 max-w-3xl relative">
            <div className="flex-1 overflow-y-auto pr-1 pb-16 space-y-6 custom-scrollbar">
              <div>
                <h3 className="font-bold text-t16 text-[#2c221e]">步驟 2：分配等級與階級</h3>
                <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">切換下方的等級與階級時，系統會自動為你結算基礎數值的成長，並解鎖對應的天賦里程碑！</p>
              </div>

              <div className="bg-[#fffdf9] p-5 rounded border border-[#d6c7ab]">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-t11 font-bold text-[#3c2415] tracking-widest bg-[#f4ebd9] px-2 py-0.5 rounded border border-[#d6c7ab]">即時體質監控</span>
                  <div className="h-px bg-[#d6c7ab] flex-1"></div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[{ label: 'DEX', val: finalStats.DEX, c: ATTRIBUTE_COLORS.dex }, { label: 'INS', val: finalStats.INS, c: ATTRIBUTE_COLORS.ins }, { label: 'MIG', val: finalStats.MIG, c: ATTRIBUTE_COLORS.mig }, { label: 'WLP', val: finalStats.WLP, c: ATTRIBUTE_COLORS.wlp }].map(s => (
                      <div key={s.label} className="bg-[#f7f3e8] border border-[#e8dcc4] p-2 text-center rounded"><div className="text-t10 text-[#7c6a58] font-bold tracking-widest">{s.label}</div><div className={`text-lg md:text-xl font-bold ${s.c} drop- leading-none mt-1`}>{s.val}</div></div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center bg-[#f7f3e8] border border-[#e8dcc4] p-3 rounded">
                    <div className="flex gap-4 md:gap-8 px-2 md:px-4">
                      <div className="flex flex-col items-center"><span className="text-t10 text-[#7c6a58] font-bold tracking-widest">HP</span><span className="text-sm md:text-base font-bold text-[#8c2d36] leading-none mt-1">{finalStats.HP}</span></div>
                      <div className="w-px bg-[#d6c7ab]"></div>
                      <div className="flex flex-col items-center"><span className="text-t10 text-[#7c6a58] font-bold tracking-widest">MP</span><span className="text-sm md:text-base font-bold text-[#3c2415] leading-none mt-1">{finalStats.MP}</span></div>
                    </div>
                    <div className="flex gap-4 md:gap-8 px-2 md:px-4">
                      <div className="flex flex-col items-center"><span className="text-t10 text-[#7c6a58] font-bold tracking-widest">先攻</span><span className="text-sm md:text-base font-bold text-[#6b5a4b] leading-none mt-1">{finalStats.Init}</span></div>
                      <div className="w-px bg-[#d6c7ab]"></div>
                      <div className="flex flex-col items-center"><span className="text-t10 text-[#7c6a58] font-bold tracking-widest">物防</span><span className="text-sm md:text-base font-bold text-[#2c221e] leading-none mt-1">{finalStats.Def}</span></div>
                      <div className="w-px bg-[#d6c7ab]"></div>
                      <div className="flex flex-col items-center"><span className="text-t10 text-[#7c6a58] font-bold tracking-widest">魔防</span><span className="text-sm md:text-base font-bold text-[#2c221e] leading-none mt-1">{finalStats.MDef}</span></div>
                    </div>
                  </div>
                </div>

                {displayMilestones.length > 0 && (
                  <div className="mt-8 border-t border-[#d6c7ab] pt-6">
                    <h4 className="text-sm font-bold text-[#3c2415] mb-4 flex items-center gap-2"><GiStarSwirl size={18} className="text-[#6b5a4b]" /> 達到等級解鎖的天賦里程碑</h4>
                    <div className="space-y-3">
                      {displayMilestones.map(skill => (
                        <div key={skill.id} className={`bg-[#f9f5eb] border border-[#d6c7ab] rounded p-4 flex flex-col gap-2 relative overflow-hidden group hover:bg-[#f4ebd9] transition-colors`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${skill.isSystem ? 'bg-[#7c6a58]' : 'bg-[#3c2415]'}`}></div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-2">
                            <span className="bg-[#3c2415] text-[#fbf7ee] text-t11 font-extrabold px-2 py-0.5 rounded shadow-sm w-fit shrink-0">Lv. {skill.unlockLevel}</span>
                            <span className="font-bold text-[#3c2415] text-t14">{skill.originalName.replace(/Lv\.\d+\s解鎖天賦：/, '')}</span>
                          </div>
                          <div className="text-sm text-[#3c2415] leading-relaxed pl-2 mt-1">{renderFormattedText(skill.originalDesc, skill.selections, state.level, state.partyLevel)}</div>

                          {!skill.isSystem && skill.selectionsConfig && skill.selectionsConfig.length > 0 && (
                            <div className="mt-2 pl-2 pt-2 border-t border-[#d6c7ab] flex flex-wrap gap-3">
                              {skill.selectionsConfig.map(cfg => {
                                if (cfg.showIfKey && (!skill.selections || !skill.selections[cfg.showIfKey] || !skill.selections[cfg.showIfKey].includes(cfg.showIfValue))) return null;
                                return (
                                  <div key={cfg.key} className="flex items-center gap-2 bg-[#fffdf9] rounded pr-2 border border-[#d6c7ab] overflow-hidden">
                                    <span className="text-t10 font-bold text-[#3c2415] tracking-widest uppercase bg-[#f4ebd9] px-2 py-1.5 h-full flex items-center border-r border-[#d6c7ab]">{cfg.label}</span>
                                    <select
                                      className="bg-transparent border-none text-xs text-[#2c221e] focus:outline-none cursor-pointer py-1"
                                      value={skill.selections?.[cfg.key] || ""}
                                      onChange={(e) => updateSelection(skill.id, cfg.key, e.target.value)}
                                    >
                                      <option value="" className="bg-[#fffdf9] text-[#6b5a4b]">選擇...</option>
                                      {cfg.options.map(opt => <option key={opt} value={opt} className="bg-[#fffdf9] text-[#2c221e]">{opt}</option>)}
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative mt-6 bg-[#f4ebd9]/95 backdrop-blur-md p-4 md:p-6 rounded border border-[#d6c7ab] shadow-md">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-[#3c2415] mb-2 font-bold tracking-widest flex items-center gap-2">等級</label>
                  <div className="relative">
                    <select className="w-full bg-[#fffdf9] border-2 border-[#d6c7ab] rounded p-3 text-[#2c221e] outline-none focus:border-[#3c2415] transition-colors cursor-pointer appearance-none font-bold" value={state.level} onChange={handleLevelChange}>{LEVELS.map(l => <option key={l} value={l}>Lv. {l}</option>)}</select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5a4b] w-5 h-5 pointer-events-none" />
                  </div>
                  {/* 2026-10-21 階段 11（GM-10-04 裁定）：這七個檔位是原書的等級階級，不是任意整數。
                      新手會想「先做一個 Lv.7 的雜兵」，卻只看到 5/10/20/30/40/50/60 而不知道為什麼不能打數字，
                      所以把理由寫在控制項旁邊，而不是等他去翻規則書。 */}
                  <p className="mt-2 text-t12 leading-relaxed text-[#6b5a4b]">
                    原書的等級是階級制，只能選這七個檔位（不是任意整數）。
                  </p>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-[#3c2415] mb-2 font-bold tracking-widest flex items-center gap-2">階級</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex bg-[#fffdf9] border-2 border-[#d6c7ab] rounded p-1 gap-1 shadow-inner relative overflow-hidden">
                      {RANKS.map(r => (
                        <button
                          key={r}
                          onClick={() => handleRankChange(r)}
                          className={`flex-1 py-3 px-2 rounded text-t11 font-black transition-all duration-300 tracking-widest relative z-10 ${state.rank === r
                            ? 'bg-[#a63d40] text-[#fffdf9] shadow-md'
                            : 'text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#f4ebd9]'
                            }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    {state.rank === "冠位" && (
                      <div className="bg-[#f9f5eb] border border-[#d6c7ab] p-4 rounded animate-in slide-in-from-top-4 fade-in duration-500 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-10 rotate-12 pointer-events-none text-[#3c2415]"><GiLaurelCrown size={80} /></div>

                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <div className="flex flex-col flex-1 min-w-0 pr-3">
                            {/* 原本是「冠位等級 / Champion Level」——括號式英文附註違反純中文鐵律（規則三）。
                                第六輪截圖時順手清掉：這一行是標籤，不是檢索欄位，英文沒有保留理由。
                                `flex-1 min-w-0 pr-3` 是 9px→12px 之後補的：句子在 12px 會折成兩行，
                                沒有這三個類別就會貼到右邊的 HP 倍率圓標上。 */}
                            <span className="text-t10 font-black text-[#3c2415] tracking-[0.2em] uppercase">冠位等級</span>
                            <span className="text-t12 text-[#6b5a4b] font-bold mt-0.5">此級別將倍增 HP 並增加可配置技能數</span>
                          </div>
                          <div className="shrink-0 bg-[#fffdf9] px-3 py-1 rounded-full border border-[#d6c7ab]">
                            <span className="text-xs font-black text-[#3c2415] font-mono tracking-tighter">HP x{state.championMultiplier}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 relative z-10">
                          {[1, 2, 3, 4, 5, 6].map(num => (
                            <button
                              key={num}
                              onClick={() => handleMultiplierChange(num)}
                              className={`flex-1 h-12 rounded font-black text-base transition-all duration-300 flex items-center justify-center border-2 ${state.championMultiplier === num
                                ? 'bg-[#a63d40] text-[#fffdf9] border-[#8c3235] shadow-md'
                                : 'bg-[#fffdf9] text-[#6b5a4b] border-[#d6c7ab] hover:border-[#3c2415] hover:text-[#2c221e]'
                                }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 flex items-center gap-2 px-1">
                          <div className="h-px bg-[#d6c7ab] flex-1"></div>
                          <p className="text-t12 text-[#7c6a58] font-bold italic tracking-tight">冠位 ({state.championMultiplier})：當前可額外配置 {state.championMultiplier} 個定位技能</p>
                          <div className="h-px bg-[#d6c7ab] flex-1"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4 animate-in fade-in duration-300 max-w-3xl pb-10">
            <div>
              <h3 className="font-bold text-t16 text-[#2c221e]">步驟 3：設定物種</h3>
              <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">物種決定了 NPC 的基本屬性、抗性加成以及獨特能力。</p>
            </div>

            <div className={`p-6 md:p-8 rounded border transition-all duration-300 ${state.selectedSpeciesId ? 'bg-[#fffdf9] border-[#d6c7ab] shadow-md' : 'bg-[#fffdf9]/60 border-[#d6c7ab] opacity-70'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded ${state.selectedSpeciesId ? 'bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]' : 'bg-[#f4ebd9] text-[#6b5a4b]'}`}>
                  <GiMonsterGrasp size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#3c2415] tracking-widest">物種選擇</h3>
                  <p className="text-xs text-[#6b5a4b]">從 8 種大類中選擇 NPC 的起源。</p>
                </div>
              </div>

              {/* Species Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {SPECIES_DATA.map(sp => {
                  const speciesTheme = SPECIES_THEMES[sp.id] || { color: 'gray', icon: <GiMonsterGrasp size={20} />, label: '未知' };
                  const isSelected = state.selectedSpeciesId === sp.id;

                  return (
                    <button
                      key={sp.id}
                      onClick={() => handleSpeciesChange(sp.id)}
                      className={`relative flex flex-col items-center justify-center p-4 rounded border-2 transition-all duration-300 ${isSelected ? 'bg-[#f4ebd9] border-[#3c2415] shadow-md z-10' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#3c2415] hover:bg-[#fbf7ee]'}`}
                    >
                      <div className={`p-2.5 rounded-full mb-2 transition-all ${isSelected ? 'bg-[#a63d40] text-[#fffdf9]' : 'bg-[#f4ebd9] text-[#6b5a4b]'}`}>
                        {speciesTheme.icon}
                      </div>
                      <span className={`text-t12 font-bold tracking-tight text-center leading-tight ${isSelected ? 'text-[#3c2415]' : 'text-[#6b5a4b]'}`}>
                        {sp.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {state.selectedSpeciesId && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">
                  {(() => {
                    const sp = SPECIES_DATA.find(s => s.id === state.selectedSpeciesId);
                    if (!sp) return null;
                    const selectedTheme = SPECIES_THEMES[sp.id] || { color: 'gray', icon: <GiMonsterGrasp size={20} />, bg: 'bg-[#f4ebd9]', border: 'border-[#d6c7ab]', text: 'text-[#3c2415]', label: '未知' };

                    return (
                      <>
                        <div className={`p-5 rounded border-2 animate-in fade-in slide-in-from-top-2 duration-500 shadow-sm ${selectedTheme.bg} ${selectedTheme.border}`}>
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`p-3 rounded bg-[#fffdf9] ${selectedTheme.text} border border-[#d6c7ab]`}>
                              {selectedTheme.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`text-lg font-black tracking-[2px] ${selectedTheme.text}`}>{sp.name}</h4>
                              </div>
                              <p className="text-t12 font-bold text-[#6b5a4b] tracking-widest uppercase mt-0.5">固定物種特性</p>
                            </div>
                          </div>
                          <p className="text-sm text-[#2c221e] leading-relaxed font-medium pl-3 border-l-2 border-[#3c2415] italic">
                            {sp.fixedDesc || "此物種無額外的固定特性。"}
                          </p>
                        </div>

                        {sp.mandatorySelections.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sp.mandatorySelections.map(cfg => (
                              <div key={cfg.key} className="flex flex-col gap-2">
                                <label className="text-t11 font-bold text-[#6b5a4b] tracking-wider flex items-center gap-1.5 uppercase">
                                  <GiSparkles size={12} className="text-[#6b5a4b]" /> {cfg.label}
                                </label>
                                {(cfg.type === 'multiselect_2' || cfg.type === 'multiselect') ? (
                                  <div className="flex flex-wrap gap-2">
                                    {cfg.options.map(option => {
                                      const selectedItems = state.speciesConfig[cfg.key] || [];
                                      const isSel = Array.isArray(selectedItems) ? selectedItems.includes(option) : selectedItems === option;
                                      const max = cfg.type === 'multiselect_2' ? 2 : 99;
                                      return (
                                        <button
                                          key={option}
                                          className={`px-3 py-1.5 rounded text-xs font-bold transition-all border-2 ${isSel ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]' : 'bg-[#fffdf9] border-[#d6c7ab] text-[#6b5a4b] hover:border-[#3c2415]'}`}
                                          onClick={() => handleSpeciesConfigMultiToggle(cfg.key, option, max)}
                                        >
                                          {isSel && <span className="mr-1">✓</span>}
                                          {option}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <select
                                    className="bg-[#fffdf9] border border-[#d6c7ab] p-2.5 rounded text-sm text-[#2c221e] focus:border-[#3c2415] outline-none font-bold"
                                    value={state.speciesConfig[cfg.key] || ''}
                                    onChange={(e) => handleSpeciesConfigChange(cfg.key, e.target.value)}
                                  >
                                    <option value="">選擇...</option>
                                    {cfg.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {sp.optionalDrawback && (
                          <div className="bg-[#f9f5eb] border border-[#8c2d36]/30 p-4 rounded">
                            <label className="text-t11 font-bold text-[#8c2d36] tracking-wider flex items-center gap-1.5 uppercase mb-3 text-center">
                              △ 額外代償選項
                            </label>
                            <p className="text-xs text-[#6b5a4b] mb-3 text-center italic">{sp.optionalDrawback.desc}</p>
                            <div className="flex justify-center">
                              <select
                                className="bg-[#fffdf9] border border-[#8c2d36]/50 p-2 rounded text-sm text-[#8c2d36] focus:border-[#8c2d36] outline-none min-w-[200px] font-bold"
                                value={state.speciesConfig[sp.optionalDrawback.selectionConfig.key] || '無'}
                                onChange={(e) => handleSpeciesConfigChange(sp.optionalDrawback.selectionConfig.key, e.target.value)}
                              >
                                <option value="無">-- 不啟動代價 --</option>
                                {sp.optionalDrawback.selectionConfig.options.filter(o => o !== '無').map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                        )}

                        {(() => {
                          const drawbackVal = state.speciesConfig[sp.benefitsConfig.conditionKey] || '無';
                          const isConditionMet = !sp.benefitsConfig.conditionKey || drawbackVal !== '無';

                          if (!isConditionMet) {
                            return (
                              <div className="bg-[#f4ebd9] border border-dashed border-[#d6c7ab] p-8 rounded text-center">
                                <Lock size={24} className="mx-auto mb-2 text-[#7c6a58]" />
                                <p className="text-xs text-[#7c6a58] font-bold uppercase tracking-widest">選取上方代價以解鎖物種增益</p>
                              </div>
                            );
                          }

                          const selectedCount = (state.speciesConfig.selectedBenefits || []).length;
                          const maxPicks = sp.benefitsConfig.maxPicks;

                          return (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center border-b border-[#d6c7ab] pb-2">
                                <label className="text-t11 font-black text-[#3c2415] tracking-widest uppercase flex items-center gap-2">
                                  <GiStarSwirl size={14} /> 物種增益選擇 (Pick {maxPicks})
                                </label>
                                <span className={`text-t11 font-black tracking-widest px-2 py-0.5 rounded ${selectedCount >= maxPicks ? 'bg-[#a63d40] text-[#fffdf9]' : 'bg-[#f4ebd9] text-[#6b5a4b]'}`}>
                                  {selectedCount} / {maxPicks}
                                </span>
                              </div>
                              {selectedCount >= maxPicks && (
                                <p className="text-t12 font-bold text-[#3c2415]">
                                  已選滿 {maxPicks} 項，要改選請先取消其中一項。
                                </p>
                              )}
                              <div className="grid grid-cols-1 gap-4">
                                {sp.benefitsConfig.options.map(opt => {
                                  const count = (state.speciesConfig.selectedBenefits || []).filter(b => b === opt.id).length;
                                  const isChecked = count > 0;
                                  const isFull = selectedCount >= maxPicks;
                                  const isDisabled = !isChecked && isFull;

                                  return (
                                    <div key={opt.id} className="space-y-3">
                                      <div
                                        role="button"
                                        aria-pressed={isChecked}
                                        aria-disabled={isDisabled}
                                        tabIndex={isDisabled ? -1 : 0}
                                        className={`p-4 rounded border-2 transition-all flex flex-col gap-3 relative overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3c2415]/50 ${isChecked ? 'bg-[#f9f5eb] border-[#3c2415] shadow-md' : isDisabled ? 'bg-[#f4ebd9]/50 border-[#d6c7ab] opacity-50 cursor-not-allowed' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#3c2415] hover:bg-[#fbf7ee] cursor-pointer'}`}
                                        onClick={() => !isDisabled && handleBenefitToggle(opt.id, maxPicks, opt.canPickTwice)}
                                        onKeyDown={(e) => {
                                          // 這張卡是 div 不是 button，鍵盤原本完全按不到（Tab 直接跳過整區）。
                                          // 補 role／tabIndex 之後，Enter 與空白鍵要跟滑鼠點擊同一條路徑。
                                          if (e.key !== 'Enter' && e.key !== ' ') return;
                                          e.preventDefault();
                                          if (!isDisabled) handleBenefitToggle(opt.id, maxPicks, opt.canPickTwice);
                                        }}
                                      >
                                        <div className="flex items-center gap-4">
                                          {opt.canPickTwice ? (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              {[1, 2].map(i => (
                                                <div key={i} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${count >= i ? 'bg-[#3c2415] border-[#2c221e] text-[#fbf7ee]' : 'border-[#d6c7ab]'}`}>
                                                  {count >= i && <CheckCircle2 size={12} className="text-[#fbf7ee]" strokeWidth={3} />}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all shrink-0 ${isChecked ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]' : 'border-[#d6c7ab]'}`}>
                                              {isChecked && <CheckCircle2 size={16} className="text-white" strokeWidth={3} />}
                                            </div>
                                          )}
                                          <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                              <p className={`text-t12 font-bold leading-relaxed ${isChecked ? 'text-[#3c2415]' : 'text-[#6b5a4b]'}`}>{renderFormattedText(opt.text, state.speciesConfig, state.level, state.partyLevel)}</p>
                                              {opt.canPickTwice && isChecked && (
                                                <span className="text-t10 font-black bg-[#f4ebd9] text-[#3c2415] px-2 py-0.5 rounded border border-[#d6c7ab] ml-2">累計: {count}/2</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Selection Area (Multiselect / Select / Text) */}
                                      {isChecked && opt.needsSelection && opt.selectionConfig?.type !== 'spellbook' && (
                                        <div className="pl-10 pb-2 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                          {opt.selectionConfig.type === 'text' && (
                                            <div className="max-w-md mt-1">
                                              {opt.selectionConfig.label && (
                                                <label className="block text-xs font-bold text-[#3c2415] mb-1 flex items-center gap-1">
                                                  <span>✦ {opt.selectionConfig.label}：</span>
                                                </label>
                                              )}
                                              <input
                                                type="text"
                                                className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-2 rounded text-sm text-[#2c221e] focus:border-[#3c2415] outline-none placeholder-[#7c6a58] font-bold shadow-inner"
                                                placeholder={opt.selectionConfig.placeholder || ""}
                                                value={state.speciesConfig[opt.selectionConfig.key] || ''}
                                                onChange={(e) => handleSpeciesConfigChange(opt.selectionConfig.key, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                            </div>
                                          )}
                                          {(opt.selectionConfig.type === 'multiselect_2' || opt.selectionConfig.type === 'multiselect') && (
                                            <div className="flex flex-wrap gap-2">
                                              {opt.selectionConfig.options.map(option => {
                                                const selectedItems = state.speciesConfig[opt.selectionConfig.key] || [];
                                                const isSel = selectedItems.includes(option);
                                                const max = opt.selectionConfig.type === 'multiselect_2' ? 2 : 99;
                                                return (
                                                  <button
                                                    key={option}
                                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all border-2 ${isSel ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]' : 'bg-[#fffdf9] border-[#d6c7ab] text-[#6b5a4b] hover:border-[#3c2415]'}`}
                                                    onClick={() => handleSpeciesConfigMultiToggle(opt.selectionConfig.key, option, max)}
                                                  >
                                                    {isSel && <span className="mr-1">✓</span>}
                                                    {option}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {opt.selectionConfig.type === 'select' && (
                                            <div className="max-w-xs">
                                              <select
                                                className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-2 rounded text-sm text-[#2c221e] focus:border-[#3c2415] outline-none font-bold"
                                                value={state.speciesConfig[opt.selectionConfig.key] || ''}
                                                onChange={(e) => handleSpeciesConfigChange(opt.selectionConfig.key, e.target.value)}
                                              >
                                                <option value="">選擇...</option>
                                                {(() => {
                                                  let finalOptions = opt.selectionConfig.options;
                                                  if (state.selectedSpeciesId === 'sp_demon' && opt.id === 'b1') {
                                                    const chosenResists = Array.isArray(state.speciesConfig?.sp_demon_resists) ? state.speciesConfig.sp_demon_resists : (state.speciesConfig?.sp_demon_resists ? [state.speciesConfig.sp_demon_resists] : []);
                                                    finalOptions = chosenResists;
                                                  } else if (state.selectedSpeciesId === 'sp_element' && opt.id === 'b1') {
                                                    const chosenImm = state.speciesConfig?.sp_element_immune;
                                                    finalOptions = ['毒', chosenImm].filter(Boolean);
                                                  }
                                                  return finalOptions.map(o => <option key={o} value={o}>{o}</option>);
                                                })()}
                                              </select>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Selection Area (Spellbook) */}
                                      {isChecked && opt.needsSelection && opt.selectionConfig?.type === 'spellbook' && (
                                        <div className="pl-10 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-300">
                                          {opt.selectionConfig.options.map(spellName => {
                                            const isSelected = state.speciesConfig[opt.selectionConfig.key] === spellName;
                                            const isClaimedElsewhere = allLearnedSpells.includes(spellName) && !isSelected;
                                            const hasSelectedAny = !!state.speciesConfig[opt.selectionConfig.key];
                                            const levelMatch = spellName.match(/\(Lv(\d+)\+\)/);
                                            const reqLevel = levelMatch ? parseInt(levelMatch[1], 10) : 0;
                                            const isLevelLocked = state.level < reqLevel;
                                            const isDisabled = isLevelLocked || (!isSelected && hasSelectedAny);
                                            return (
                                              <SpellCard
                                                key={spellName}
                                                skillId="species_spell"
                                                spellName={spellName}
                                                isActive={isSelected}
                                                isDisabled={isDisabled}
                                                isOverBudget={isSelected && isLevelLocked}
                                                isClaimedElsewhere={isClaimedElsewhere}
                                                onToggle={() => !isClaimedElsewhere && handleSpeciesConfigChange(opt.selectionConfig.key, isSelected ? '' : spellName)}
                                                npcLevel={state.level}
                                                partyLevel={state.partyLevel}
                                                selections={state.speciesConfig?.spellSelections?.[spellName] || (state.speciesConfig?.spellSelections?.customName !== undefined ? state.speciesConfig.spellSelections : {})}
                                                selectionsConfig={SPELLS_DATA[spellName.replace(/\(Lv30\+\)/g, '').trim()]?.selectionsConfig}
                                                onSelectionChange={(skillId, spName, key, value) => handleSpeciesSpellSelectionChange(spName, key, value)}
                                              />
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl pb-10">
            <div>
              <h3 className="font-bold text-t16 text-[#2c221e]">步驟 4：調整數值與能力</h3>
              <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">系統會根據你的定位與等級自動為你計算可用額度。請展開下方區塊完成配置。</p>
            </div>
            {/* Step 4 Sub-tabs */}
            <div className="flex bg-[#e8dcc4] rounded p-1 gap-1 border border-[#d6c7ab] shadow-inner">
              {[
                { id: 'stats', label: '基礎數值與相性', Icon: GiRollingDices },
                { id: 'skills', label: '技能・咒語・能力', Icon: GiCrossedSwords },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStep4SubTab(tab.id)}
                  className={`flex-1 py-2.5 px-2 rounded text-xs font-black tracking-wide transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    step4SubTab === tab.id
                      ? 'bg-[#fbf7ee] text-[#2c221e] shadow-sm'
                      : 'text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#e8dcc4]/60'
                  }`}
                  style={step4SubTab === tab.id ? { borderBottom: `2px solid ${workshopTheme.accent}` } : {}}
                >
                  <tab.Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.id === 'stats' ? '數值' : '能力'}</span>
                </button>
              ))}
            </div>

            {/* Sub-tab: 基礎數值與相性 */}
            {step4SubTab === 'stats' && (
              <div className="space-y-6">

            {/* Attribute Dice Customization Card (僅在開啟自定義模式時顯示) */}
            {state.isFreeModeEnabled && (
              <div className="p-5 md:p-6 rounded border-2 transition-all duration-300 relative overflow-hidden bg-[#fffdf9] border-[#a63d40] animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-[#d6c7ab] pb-4">
                  <div>
                    <h4 className="text-base md:text-lg font-black tracking-widest text-[#3c2415] flex items-center gap-2">
                      <GiSparkles size={20} className="text-[#a63d40]" />
                      自定義 NPC 體質與基礎骰子
                    </h4>
                    <p className="text-xs text-[#6b5a4b] mt-1 leading-relaxed">
                      自定義模式已啟動：可自由調整 DEX, INS, MIG, WLP 骰子大小。HP/MP/物防/魔防將自動連動計算調整。
                    </p>
                  </div>
                  {state.customDice && Object.keys(state.customDice).some(k => state.customDice[k]) && (
                    <button
                      type="button"
                      onClick={() => setState(prev => ({ ...prev, customDice: {} }))}
                      className="px-3 py-1.5 text-xs font-bold text-[#3c2415] hover:text-[#2c221e] bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] rounded transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      <RotateCcw size={14} /> 重置體質骰子
                    </button>
                  )}
                </div>

                {/* Attribute Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {[
                    { key: 'DEX', label: '靈巧 DEX', color: ATTRIBUTE_COLORS.dex, defaultDie: (ROLES_DATA[state.role]?.levels[state.level]?.dex || ROLES_DATA[state.role]?.base?.DEX) },
                    { key: 'INS', label: '洞察 INS', color: ATTRIBUTE_COLORS.ins, defaultDie: (ROLES_DATA[state.role]?.levels[state.level]?.ins || ROLES_DATA[state.role]?.base?.INS) },
                    { key: 'MIG', label: '力量 MIG', color: ATTRIBUTE_COLORS.mig, defaultDie: (ROLES_DATA[state.role]?.levels[state.level]?.mig || ROLES_DATA[state.role]?.base?.MIG) },
                    { key: 'WLP', label: '意志 WLP', color: ATTRIBUTE_COLORS.wlp, defaultDie: (ROLES_DATA[state.role]?.levels[state.level]?.wlp || ROLES_DATA[state.role]?.base?.WLP) }
                  ].map(attr => {
                    const currentDie = finalStats[attr.key];
                    const isCustomized = state.customDice?.[attr.key] && state.customDice[attr.key] !== attr.defaultDie;
                    const parseDice = d => parseInt(String(d).replace('d', ''), 10) || 8;
                    const roleData = ROLES_DATA[state.role] || ROLES_DATA['暴徒'];

                    let impactText = "";
                    if (attr.key === 'MIG') {
                      const diff = parseDice(currentDie) - parseDice(attr.defaultDie);
                      const mult = state.rank === '精英' ? 2 : state.rank === '冠位' ? state.championMultiplier : 1;
                      const hpChange = diff * 5 * mult;
                      impactText = `HP ${hpChange >= 0 ? '+' : ''}${hpChange} (${diff >= 0 ? '+' : ''}${diff * 5} Base)`;
                    } else if (attr.key === 'WLP') {
                      const diff = parseDice(currentDie) - parseDice(attr.defaultDie);
                      const mult = state.rank === '冠位' ? 2 : 1;
                      const mpChange = diff * 5 * mult;
                      impactText = `MP ${mpChange >= 0 ? '+' : ''}${mpChange} (${diff >= 0 ? '+' : ''}${diff * 5} Base)`;
                    } else if (attr.key === 'DEX') {
                      impactText = `物防 Base = ${parseDice(currentDie)} + ${roleData.base.def}`;
                    } else if (attr.key === 'INS') {
                      impactText = `魔防 Base = ${parseDice(currentDie)} + ${roleData.base.mdef}`;
                    }

                    return (
                      <div key={attr.key} className="p-3.5 rounded border border-[#d6c7ab] bg-[#fffdf9] flex flex-col gap-2.5 relative">
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-black tracking-wider uppercase ${attr.color}`}>{attr.label}</span>
                          {isCustomized ? (
                            <span className="text-t10 font-bold px-1.5 py-0.5 rounded text-[#3c2415]">
                              已自定義
                            </span>
                          ) : (
                            <span className="text-t10 font-bold opacity-70">
                              預設 {attr.defaultDie}
                            </span>
                          )}
                        </div>

                        {/* Dice Selector Buttons */}
                        <div className="grid grid-cols-4 gap-1">
                          {['d6', 'd8', 'd10', 'd12'].map(die => {
                            const isActive = currentDie === die;
                            const isDefault = attr.defaultDie === die;
                            return (
                              <button
                                key={die}
                                type="button"
                                onClick={() => {
                                  setState(prev => ({
                                    ...prev,
                                    customDice: {
                                      ...(prev.customDice || {}),
                                      [attr.key]: die === attr.defaultDie ? undefined : die
                                    }
                                  }));
                                }}
                                className={`py-1.5 text-xs font-black rounded transition-all duration-200 relative ${
                                  isActive
                                    ? 'bg-[#a63d40] text-[#fffdf9] font-extrabold shadow-sm z-10'
                                    : 'bg-[#fffdf9] hover:bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]'
                                }`}
                              >
                                {die}
                                {isDefault && (
                                  <span className="absolute -top-1 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#a63d40]" title="預設體質" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="text-t11 font-bold opacity-80 text-center tracking-tight pt-1.5 border-t border-black/10">
                          {impactText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 反派等級 */}
            <div className="bg-[#fffdf9] border border-[#d6c7ab] rounded p-6 overflow-hidden relative group">
              <label className="block text-sm text-[#3c2415] mb-4 font-bold tracking-[0.2em] flex items-center gap-2 uppercase">
                <GiLaurelCrown size={18} className="text-[#8c2d36]" /> 反派等級
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(VILLAIN_TIERS).map(([key, tier]) => (
                  <button
                    key={key}
                    onClick={() => setState(prev => ({ ...prev, villainTier: key }))}
                    className={`flex flex-col items-center justify-center p-3 rounded border-2 transition-colors duration-200 ${state.villainTier === key ? 'border-[#3c2415] bg-[#fffdf9] text-[#2c221e]' : 'border-[#d6c7ab] bg-[#fffdf9] text-[#6b5a4b] hover:border-[#3c2415] hover:text-[#2c221e]'}`}
                  >
                    <span className="text-xs font-black tracking-widest mb-1">{tier.label}</span>
                    <span className="text-t10 font-bold opacity-80">{tier.up} UP</span>
                  </button>
                ))}
              </div>
              {state.villainTier !== 'none' && (
                <div className={`mt-4 text-t11 font-bold ${VILLAIN_TIERS[state.villainTier].ink} flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2`}>
                  <AlertCircle size={12} /> 已賦予 {VILLAIN_TIERS[state.villainTier].up} 點終極點數，可用於發動反派能力。
                </div>
              )}
            </div>

            {/* 屬性相性配置 */}
            <div className="bg-[#fffdf9] border border-[#d6c7ab] rounded p-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-[#d6c7ab] pb-2">
                <h2 className="text-sm font-bold text-[#3c2415]">屬性相性配置</h2>
                {bonusSkillFromNegative > 0 && (
                  <div className="text-t10 bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] px-2 py-0.5 rounded-full font-bold">
                    (包含負面技能獎勵 +{bonusSkillFromNegative})
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-4">
                {['vul', 'res', 'imm', 'abs'].map(st => {
                  const max = affinityBudgets[st];
                  const curr = currentAffinities[st];
                  const isFull = curr >= max;
                  const isDisabled = !state.isFreeModeEnabled && (max === 0 && curr === 0);
                  const isActive = activeAffinityTab === st;
                  const conf = {
                    vul: { l: AFFINITY_STATES.vul.label, c: AFFINITY_STATES.vul.ink, activeBorder: 'border-[#3c2415]', activeBg: 'bg-[#fffdf9]' },
                    res: { l: AFFINITY_STATES.res.label, c: AFFINITY_STATES.res.ink, activeBorder: 'border-[#3c2415]', activeBg: 'bg-[#fffdf9]' },
                    imm: { l: AFFINITY_STATES.imm.label, c: AFFINITY_STATES.imm.ink, activeBorder: 'border-[#3c2415]', activeBg: 'bg-[#fffdf9]' },
                    abs: { l: AFFINITY_STATES.abs.label, c: AFFINITY_STATES.abs.ink, activeBorder: 'border-[#3c2415]', activeBg: 'bg-[#fffdf9]' }
                  };
                  return (
                    <button key={st} onClick={() => !isDisabled && setActiveAffinityTab(st)} disabled={isDisabled} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-t border-b-4 transition-all duration-200 ${isDisabled ? 'opacity-40 cursor-not-allowed border-[#d6c7ab] bg-[#f4ebd9] grayscale' : isActive ? `${conf[st].activeBorder} ${conf[st].activeBg} z-10` : 'border-[#d6c7ab] bg-[#f9f5eb] hover:bg-[#f4ebd9]'}`}>
                      <span className={`text-t10 sm:text-xs font-bold mb-1 ${isDisabled ? 'text-[#7c6a58]' : conf[st].c}`}>{conf[st].l}</span>
                      <span className={`text-sm font-extrabold ${!isDisabled && isFull && max > 0 && !state.isFreeModeEnabled ? 'text-[#3c2415] font-black' : isDisabled ? 'text-[#7c6a58]' : 'text-[#2c221e]'}`}>{curr} <span className="text-[#7c6a58] font-normal mx-0.5">/</span> {state.isFreeModeEnabled ? '∞' : max}</span>
                    </button>
                  );
                })}
              </div>

              {/* 為什麼有分頁是灰的：額度為 0 時按鈕會 disabled，若不說明，新手會以為壞了 */}
              {!state.isFreeModeEnabled && ['vul', 'res', 'imm', 'abs'].some(st => affinityBudgets[st] === 0 && currentAffinities[st] === 0) && (
                <p className="text-t12 text-[#6b5a4b] mb-3 -mt-1 leading-relaxed">
                  灰色的分頁額度為 0（由職業與等級決定）。升到對應等級會自動解鎖，屆時分頁會亮起來。
                </p>
              )}

              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 p-4 rounded-b rounded-tr border-2 border-[#d6c7ab] bg-[#f9f5eb] transition-colors duration-300">
                {DAMAGE_TYPES.map(type => {
                  const playerState = state.affinities[type] || 'normal';
                  const typeStyle = TYPE_STYLES[type];
                  const speciesVal = speciesAffinities[type];
                  const isSpeciesLocked = !!speciesVal;
                  const effectiveState = isSpeciesLocked ? speciesVal : playerState;
                  const style = AFFINITY_STATES[effectiveState];
                  const isCurrentTabFull = currentAffinities[activeAffinityTab] >= affinityBudgets[activeAffinityTab];
                  const isDisabled = isSpeciesLocked || (!state.isFreeModeEnabled && playerState !== activeAffinityTab && isCurrentTabFull);

                  return (
                    <button
                      key={type}
                      onClick={() => !isSpeciesLocked && handleAffinityClick(type)}
                      disabled={isDisabled}
                      className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded border-2 border-[#d6c7ab] bg-[#fffdf9] transition-all transform relative ${isSpeciesLocked ? 'opacity-100 border-dashed cursor-default saturate-[1.2] ring-1 ring-[#3c2415]' : isDisabled ? 'opacity-40 cursor-not-allowed saturate-50' : 'cursor-pointer hover:border-[#3c2415]'}`}
                    >
                      {/* 狀態的極性：只有 4px，只在左緣。面全部相同（第十五輪）。 */}
                      <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${style.bar}`} aria-hidden="true" />
                      {isSpeciesLocked && (
                        <div className="absolute -top-2 -right-1 bg-[#fffdf9] border-2 border-[#3c2415] text-[#3c2415] px-1.5 py-0.5 rounded-full shadow z-20 flex items-center gap-0.5" title="此相性由物種提供，不能手動修改；換物種才會變">
                          <Lock size={9} strokeWidth={3} />
                          <span className="text-t12 font-bold leading-none">物種</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 mb-1.5">
                        <span className={`text-xl sm:text-2xl drop-shadow-sm ${isDisabled && !isSpeciesLocked && playerState === 'normal' ? 'text-[#7c6a58]' : typeStyle.color}`}><span className="fu-icon">{typeStyle.fuIcon}</span></span>
                        <span className={`text-lg sm:text-xl font-extrabold tracking-widest ${isDisabled && !isSpeciesLocked && playerState === 'normal' ? 'text-[#7c6a58]' : typeStyle.color}`}>{type}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-t10 sm:text-xs font-bold tracking-widest border ${style.chip}`}>{style.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 攻擊性咒語檢定公式選擇區塊 */}
            {hasOffensiveSpells && (
              <div className="bg-[#fffdf9] border border-[#d6c7ab] rounded p-5 overflow-hidden relative group animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="block text-sm text-[#3c2415] mb-3 font-bold tracking-[0.2em] flex items-center gap-2 uppercase">
                  <span className="fu-icon text-lg">c</span> 攻擊性咒語檢定公式
                </label>
                <p className="text-xs text-[#6b5a4b] mb-4">此 NPC 獲得了攻擊性咒語。請選擇所有攻擊性咒語適用的精確度檢定公式：</p>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  {[
                    { value: '[INS + WLP]', label: '【洞察】+ 【意志】', desc: '標準魔法檢定' },
                    { value: '[MIG + WLP]', label: '【力量】+ 【意志】', desc: '近戰/力量魔法檢定' }
                  ].map((opt) => {
                    const isSelected = (state.magicFormula || '[INS + WLP]') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setState(prev => ({ ...prev, magicFormula: opt.value }))}
                        className={`flex flex-col items-center justify-center p-3 rounded border-2 transition-all duration-200 ${isSelected
                          ? 'border-[#3c2415] bg-[#fffdf9] text-[#2c221e]'
                          : 'border-[#d6c7ab] bg-[#fffdf9] text-[#6b5a4b] hover:border-[#7c6a58] hover:text-[#2c221e]'
                          }`}
                      >
                        <span className="text-xs font-black tracking-widest mb-1">{opt.value}</span>
                        <span className="text-t10 font-bold opacity-80">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

              </div>
            )}
            {/* Sub-tab: 技能・咒語・能力（2026-10-22 由「攻擊與技能庫」＋「咒語與自訂能力」
                兩頁合併而成，見 `docs/decisions.md` §BT。以下三個區塊共用同一個子頁，
                因此「基礎攻擊」「咒語書」各留一個小標題當定位錨點。） */}
            {step4SubTab === 'skills' && (
              <div className="space-y-6">

            <div className="flex items-center gap-2">
              <GiCrossedSwords size={16} className="text-[#3c2415]" />
              <h3 className="text-sm font-black text-[#3c2415] tracking-wide">攻擊與技能庫</h3>
            </div>

            {/* 額度為 0 時，「定位技能」面板會整個不渲染（SectionAccordion 的 hideIfZeroMax）。
                新手因此不知道有這個系統，也不知道它會在升級後冒出來——所以在這裡留一句說明。 */}
            {!state.isFreeModeEnabled && maxRoleSkills === 0 && (
              <p className="text-t12 text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab] rounded px-3 py-2 leading-relaxed">
                「定位技能」的額度由職業與等級決定，目前是 0，所以這一區暫時不會出現。升級或換職業後會自動解鎖。
              </p>
            )}

            {/* 基礎攻擊與核心能力 (Basic Attacks)
                `defaultExpanded`：這是全卡最常改的一區（距離／屬性／傷害），預設收合等於白做一層。 */}
            {basicAttacksToRender.length > 0 && (
              <SectionAccordion title="基礎攻擊與核心能力" icon={<GiCrossedSwords size={16} />} current={basicAttacksToRender.length} max={basicAttacksToRender.length} hideIfZeroMax={false} defaultExpanded={true} titleColor="text-[#3c2415]" borderColor="border-[#d6c7ab]" isFreeMode={state.isFreeModeEnabled}>
                <div className="space-y-4">
                  {basicAttacksToRender.map(skill => (
                    <div key={skill.id} id={`skill-card-${skill.id}`} className={`transition-all duration-300 ${highlightedSkillId === skill.id ? 'ring-4 ring-[#3c2415] bg-[#f4ebd9] rounded p-1 shadow-lg' : ''}`}>
                      <EditableSkill skill={skill} rawSkill={validSkills.find(v => v.id === skill.id) || skill} onUpdate={updateSkill} onDelete={deleteSkill} onUpdateSelection={updateSelection} finalStats={finalStats} npcLevel={state.level} partyLevel={state.partyLevel} />
                    </div>
                  ))}
                </div>
              </SectionAccordion>
            )}

            <SectionAccordion title="客製化規則" icon={<Settings size={16} />} current={usedCustomizations} max={maxCustomizations} hideIfZeroMax={!hasChampSupport} titleColor="text-[#3c2415]" borderColor="border-[#d6c7ab]" isFreeMode={state.isFreeModeEnabled}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(ROLES_DATA[state.role]?.availableSkills || []).filter(s => s.source === 'customization').map(skill => {
                  const activeSkillData = processedSkills.find(s => s.libId === skill.id);
                  const isActive = !!activeSkillData;

                  const isRankLocked = skill.reqRank && Array.isArray(skill.reqRank) && !skill.reqRank.includes(state.rank);
                  const isLevelLocked = skill.reqLevel && state.level < skill.reqLevel;
                  const isReqLocked = skill.requires && Array.isArray(skill.requires) && !skill.requires.every(reqId => validSkills.some(s => s.libId === reqId));
                  const isRequirementLocked = !state.isFreeModeEnabled && (isRankLocked || isLevelLocked || isReqLocked);
                  const lockedMsg = !state.isFreeModeEnabled ? (
                    isRankLocked ? `需階級：${skill.reqRank.join('/')}` :
                    isLevelLocked ? `需等級：Lv.${skill.reqLevel}` :
                    isReqLocked ? '需前置技能' : null
                  ) : null;

                  const isOverBudget = isActive && activeSkillData?.isOverBudget && !lockedMsg;
                  // 額度用完時，其餘卡片會變灰；沒有文字說明就只是「不敢動」（GM-12-01）。
                  const isBudgetLocked = !isActive && !state.isFreeModeEnabled && usedCustomizations >= maxCustomizations;
                  const budgetMsg = isBudgetLocked ? '客製化額度已滿' : null;
                  const isDisabled = isRequirementLocked || isBudgetLocked;
                  const targetId = activeSkillData?.id || skill.id;

                  return (
                    <div key={skill.id} id={`skill-card-${targetId}`} className={`transition-all duration-300 ${highlightedSkillId === targetId || highlightedSkillId === skill.id ? 'ring-4 ring-[#3c2415] bg-[#f4ebd9] rounded p-1 shadow-lg' : ''}`}>
                      <SkillCard
                        skill={activeSkillData || skill}
                        isActive={isActive}
                        isDisabled={isDisabled}
                        isOverBudget={isOverBudget}
                        lockedMsg={lockedMsg}
                        onToggle={() => toggleLibrarySkill(skill)}
                        onSelectionChange={updateSelection}
                        onUpdateSkill={updateSkill}
                        npcLevel={state.level}
                        partyLevel={state.partyLevel}
                      />
                    </div>
                  );
                })}
              </div>
            </SectionAccordion>

            <SectionAccordion title="定位技能" icon={<GiCheckedShield size={16} />} current={usedRoleSkills} max={maxRoleSkills} hideIfZeroMax={true} titleColor="text-[#2c221e]" borderColor="border-[#d6c7ab]" isFreeMode={state.isFreeModeEnabled}>
              {usedRoleSkillForBoss > 0 && !state.isFreeModeEnabled && (
                <div className="mb-4 bg-[#f9f5eb] border border-[#d6c7ab] p-3 rounded text-t11 text-[#3c2415] flex items-center gap-2">
                  <AlertTriangle size={14} className="text-[#6b5a4b]" />
                  <span>注意：您已將 {usedRoleSkillForBoss} 個定位技能額度轉換為額外的 Boss 技能。</span>
                </div>
              )}
              {/* Search box for role skills */}
              <div className="mb-3 relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7c6a58] pointer-events-none" />
                <input
                  type="text"
                  placeholder="搜尋定位技能..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#fffdf9] border border-[#d6c7ab] rounded outline-none focus:border-[#a63d40] text-[#2c221e] placeholder:text-[#7c6a58] transition-colors"
                  value={roleSkillSearch}
                  onChange={e => setRoleSkillSearch(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(ROLES_DATA[state.role]?.availableSkills || []).filter(s => s.source === 'roleSkill').filter(skill => !roleSkillSearch || (skill.originalName || '').toLowerCase().includes(roleSkillSearch.toLowerCase()) || (skill.originalDesc || '').toLowerCase().includes(roleSkillSearch.toLowerCase())).map(skill => {
                  const activeSkillData = processedSkills.find(s => s.libId === skill.id);
                  const isActive = !!activeSkillData;

                  const isRankLocked = skill.reqRank && Array.isArray(skill.reqRank) && !skill.reqRank.includes(state.rank);
                  const isLevelLocked = skill.reqLevel && state.level < skill.reqLevel;
                  const isReqLocked = skill.requires && Array.isArray(skill.requires) && !skill.requires.every(reqId => validSkills.some(s => s.libId === reqId));
                  const isRequirementLocked = !state.isFreeModeEnabled && (isRankLocked || isLevelLocked || isReqLocked);
                  const lockedMsg = !state.isFreeModeEnabled ? (
                    isRankLocked ? `需階級：${skill.reqRank.join('/')}` :
                    isLevelLocked ? `需等級：Lv.${skill.reqLevel}` :
                    isReqLocked ? '需前置技能' : null
                  ) : null;

                  const isOverBudget = isActive && activeSkillData?.isOverBudget && !lockedMsg;
                  const isDisabled = isRequirementLocked || (!isActive && !state.isFreeModeEnabled && usedRoleSkills >= maxRoleSkills);
                  const targetId = activeSkillData?.id || skill.id;

                  return (
                    <div key={skill.id} id={`skill-card-${targetId}`} className={`transition-all duration-300 ${highlightedSkillId === targetId || highlightedSkillId === skill.id ? 'ring-4 ring-[#3c2415] bg-[#f4ebd9] rounded p-1 shadow-lg' : ''}`}>
                      <SkillCard
                        skill={activeSkillData || skill}
                        isActive={isActive}
                        isDisabled={isDisabled}
                        isOverBudget={isOverBudget}
                        lockedMsg={lockedMsg}
                        onToggle={() => toggleLibrarySkill(skill)}
                        onSelectionChange={updateSelection}
                        onUpdateSkill={updateSkill}
                        npcLevel={state.level}
                        partyLevel={state.partyLevel}
                      />
                    </div>
                  );
                })}
              </div>
            </SectionAccordion>

              </div>
            )}
            {/* 咒語與自訂能力（2026-10-22 起與「攻擊與技能庫」同屬一個子頁，見 §BT） */}
            {step4SubTab === 'skills' && (
              <div className="space-y-6">

            <div className="flex items-center gap-2 pt-2 border-t border-[#d6c7ab]">
              <GiSpellBook size={16} className="text-[#3c2415]" />
              <h3 className="text-sm font-black text-[#3c2415] tracking-wide">咒語與自訂能力</h3>
            </div>

            {allSpellbooksToRender.length > 0 && (
              <SectionAccordion title="咒語書配置" icon={<GiSpellBook size={16} />} current={allSpellbooksToRender.reduce((sum, s) => sum + (s.selectedSpells || []).length, 0)} max={allSpellbooksToRender.reduce((sum, s) => sum + (s.spellConfig?.capacity || 0), 0)} defaultExpanded={true} titleColor="text-[#3c2415]" borderColor="border-[#d6c7ab]" isFreeMode={state.isFreeModeEnabled}>
                <div className="space-y-4">
                  {/* Search box for spells */}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7c6a58] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="搜尋咒語..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#fffdf9] border border-[#d6c7ab] rounded outline-none focus:border-[#3c2415] text-[#2c221e] placeholder:text-[#7c6a58] transition-colors"
                      value={spellSearch}
                      onChange={e => setSpellSearch(e.target.value)}
                    />
                  </div>
                  {allSpellbooksToRender.map(skill => (
                    <div key={skill.id} id={`skill-card-${skill.id}`} className={`pt-2 border-t border-[#d6c7ab] mt-4 first:mt-0 first:pt-0 first:border-0 transition-all duration-300 ${highlightedSkillId === skill.id ? 'ring-4 ring-[#3c2415] bg-[#f4ebd9] rounded p-2 shadow-lg' : ''}`}>
                      <EditableSkill skill={skill} rawSkill={validSkills.find(v => v.id === skill.id) || skill} onUpdate={updateSkill} onDelete={deleteSkill} onUpdateSelection={updateSelection} finalStats={finalStats} npcLevel={state.level} partyLevel={state.partyLevel} />
                      <div className="flex justify-between items-center mt-3 mb-2 pl-6 pr-2">
                        <span className="text-xs font-bold text-[#6b5a4b]">已選咒語 ({(skill.selectedSpells || []).length} / {skill.spellConfig.capacity})</span>
                      </div>
                      <div className="pl-6 grid grid-cols-1 gap-3 border-l-2 border-[#d6c7ab]">
                        {skill.spellConfig.options.filter(spellName => !spellSearch || spellName.toLowerCase().includes(spellSearch.toLowerCase())).map(spellName => {
                          const isSelected = (skill.selectedSpells || []).some(sp => (typeof sp === 'string' ? sp : sp.name) === spellName);
                          const isClaimedElsewhere = allLearnedSpells.includes(spellName) && !isSelected;
                          const isAtCapacity = (skill.selectedSpells || []).length >= skill.spellConfig.capacity;
                          const levelMatch = spellName.match(/\(Lv(\d+)\+\)/);
                          const reqLevel = levelMatch ? parseInt(levelMatch[1], 10) : 0;
                          const isLevelLocked = !state.isFreeModeEnabled && reqLevel > 0 && state.level < reqLevel;
                          const lockedMsg = isLevelLocked ? `需等級：Lv.${reqLevel}` : null;
                          const isDisabled = isLevelLocked || (!state.isFreeModeEnabled && !isSelected && isAtCapacity);
                          const overBudgetCheck = state.isFreeModeEnabled ? false : (isSelected && isLevelLocked && !lockedMsg);
                          return (
                            <SpellCard
                              key={spellName}
                              skillId={skill.id}
                              spellName={spellName}
                              isActive={isSelected}
                              isDisabled={isDisabled}
                              isOverBudget={overBudgetCheck}
                              lockedMsg={lockedMsg}
                              isClaimedElsewhere={isClaimedElsewhere}
                              onToggle={() => !isClaimedElsewhere && !isDisabled && toggleSpell(skill.id, spellName, skill.spellConfig.capacity)}
                              selections={(skill.selectedSpells || []).find(sp => (typeof sp === 'string' ? sp : sp.name) === spellName)?.selections || {}}
                              selectionsConfig={SPELLS_DATA[spellName.replace(/\(Lv30\+\)/g, '').trim()]?.selectionsConfig}
                              onSelectionChange={updateSpellSelection}
                              npcLevel={state.level}
                              partyLevel={state.partyLevel}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionAccordion>
            )}

            {/* Custom Abilities Section (Permanent / 常駐) */}
            <SectionAccordion title="完全自訂技能" icon={<GiSparkles size={16} />} current={state.skills.filter(s => s.id.startsWith('custom_')).length} max={0} titleColor="text-[#3c2415]" borderColor="border-[#d6c7ab]" alwaysComplete={true} isFreeMode={state.isFreeModeEnabled} defaultExpanded={true}>
              <div className="bg-[#f9f5eb] border border-[#d6c7ab] p-4 rounded mb-6">
                <h4 className="text-[#3c2415] text-xs font-bold mb-3 flex items-center gap-2"><PlusCircle size={14} /> 快速新增自訂能力</h4>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    className="w-full bg-[#fffdf9] text-[#3c2415] font-bold p-2 border border-[#d6c7ab] outline-none rounded focus:border-[#3c2415] transition-colors"
                    placeholder="能力名稱"
                    value={newCustomSkill.name}
                    onChange={(e) => setNewCustomSkill(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <textarea
                    className="w-full bg-[#fffdf9] text-[#3c2415] p-2 border border-[#d6c7ab] outline-none h-20 resize-none rounded text-sm focus:border-[#3c2415] transition-colors"
                    placeholder="輸入效果與敘述..."
                    value={newCustomSkill.desc}
                    onChange={(e) => setNewCustomSkill(prev => ({ ...prev, desc: e.target.value }))}
                  />
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <select
                        className="bg-[#fbf7ee] text-[#3c2415] text-xs font-bold border border-[#d6c7ab] p-2 rounded outline-none focus:border-[#3c2415]"
                        value={newCustomSkill.category}
                        onChange={(e) => setNewCustomSkill(prev => ({ ...prev, category: e.target.value }))}
                      >
                        <option value="spell">咒語</option>
                        <option value="action">其餘行動</option>
                        <option value="rule">特殊規則</option>
                      </select>

                      {newCustomSkill.category === 'spell' && (
                        <div className="flex flex-col gap-3 w-full bg-[#f4ebd9] p-3 rounded border border-[#d6c7ab] text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[#3c2415] font-bold mb-1">目標</label>
                              <select
                                className="w-full bg-[#fffdf9] text-[#3c2415] font-bold p-1.5 border border-[#d6c7ab] rounded outline-none focus:border-[#3c2415]"
                                value={newCustomSkill.targetType}
                                onChange={(e) => setNewCustomSkill(prev => ({ ...prev, targetType: e.target.value }))}
                              >
                                <option value="一個生物">一個生物</option>
                                <option value="自身">自身</option>
                                <option value="至多 X 個生物">至多 X 個生物</option>
                                <option value="特殊">特殊</option>
                              </select>
                            </div>

                            {newCustomSkill.targetType === '至多 X 個生物' ? (
                              <div>
                                <label className="block text-[#3c2415] font-bold mb-1">目標數量</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  className="w-full bg-[#fffdf9] text-[#3c2415] font-bold p-1.5 border border-[#d6c7ab] rounded outline-none focus:border-[#3c2415]"
                                  placeholder="例: 3"
                                  value={newCustomSkill.maxTargets}
                                  onChange={(e) => setNewCustomSkill(prev => ({ ...prev, maxTargets: e.target.value }))}
                                />
                              </div>
                            ) : (
                              <div className="hidden sm:block"></div>
                            )}

                            <div>
                              <label className="block text-[#3c2415] font-bold mb-1">
                                MP 消耗 {newCustomSkill.targetType === '至多 X 個生物' && <span className="text-[#6b5a4b] font-normal">(自動填寫 × T)</span>}
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  className="w-full bg-[#fffdf9] text-[#3c2415] font-bold p-1.5 border border-[#d6c7ab] rounded outline-none focus:border-[#3c2415]"
                                  placeholder="例: 10"
                                  value={newCustomSkill.baseMp}
                                  onChange={(e) => setNewCustomSkill(prev => ({ ...prev, baseMp: e.target.value }))}
                                />
                                {newCustomSkill.targetType === '至多 X 個生物' && (
                                  <span className="text-[#3c2415] font-extrabold text-sm shrink-0">× T</span>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[#3c2415] font-bold mb-1">持續時間</label>
                              <select
                                className="w-full bg-[#fffdf9] text-[#3c2415] font-bold p-1.5 border border-[#d6c7ab] rounded outline-none focus:border-[#3c2415]"
                                value={newCustomSkill.duration}
                                onChange={(e) => setNewCustomSkill(prev => ({ ...prev, duration: e.target.value }))}
                              >
                                <option value="瞬發">瞬發</option>
                                <option value="場景">場景</option>
                                <option value="特別">特別</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-[#e8dcc4]">
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-[#7c6a58] accent-[#a63d40] bg-[#fffdf9] focus:ring-[#a63d40] focus:ring-2"
                                checked={newCustomSkill.isOffensiveSpell}
                                onChange={(e) => setNewCustomSkill(prev => ({ ...prev, isOffensiveSpell: e.target.checked }))}
                              />
                              <span className="text-xs font-bold text-[#3c2415] group-hover:text-[#2c221e] transition-colors">攻擊性咒語 (包含魔法命中檢定)</span>
                            </label>

                            {newCustomSkill.isOffensiveSpell && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#3c2415]">魔法檢定公式:</span>
                                <select
                                  className="bg-[#fffdf9] text-[#3c2415] text-xs font-bold border border-[#d6c7ab] p-1.5 rounded outline-none focus:border-[#3c2415]"
                                  value={newCustomSkill.formula}
                                  onChange={(e) => setNewCustomSkill(prev => ({ ...prev, formula: e.target.value }))}
                                >
                                  <option value="[INS + WLP]">【INS + WLP】(洞察 + 意志)</option>
                                  <option value="[MIG + WLP]">【MIG + WLP】(體格 + 意志)</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleAddCustomSkill}
                      className="px-4 py-2 bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] text-xs font-bold rounded flex items-center gap-2 transition-all w-full sm:w-auto justify-center"
                    >
                      <PlusCircle size={14} /> 加入能力清單
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {state.skills.filter(s => s.id.startsWith('custom_')).map(skill => (
                  <EditableSkill
                    key={skill.id}
                    skill={skill}
                    onUpdate={updateSkill}
                    onDelete={deleteSkill}
                    onUpdateSelection={updateSelection}
                    finalStats={finalStats}
                    npcLevel={state.level}
                    partyLevel={state.partyLevel}
                  />
                ))}
                {state.skills.filter(s => s.id.startsWith('custom_')).length === 0 && (
                  <EmptyState
                    kind="npc-custom-skill"
                    icon={GiScrollQuill}
                    title="還沒有自訂能力"
                    teach="自訂能力是這隻 NPC 獨有的招式，不從技能表挑；用上方「新增自訂能力」寫下名稱與效果即可。"
                  />
                )}
              </div>
            </SectionAccordion>

              </div>
            )}
          </div>
        );
      case 5:
        return (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl pb-10 relative">
            <div>
              <h3 className="font-bold text-t16 text-[#2c221e]">步驟 5：Boss 技能</h3>
              <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">這些強大且顛覆規則的能力，只有「冠位」級別的敵人才有資格獲得。</p>
              <p className="mt-2 text-t12 text-[#6b5a4b] leading-relaxed">※ 規則提醒：您可以透過替換掉相同數量的「定位技能」來獲得額外的 Boss 技能。</p>
            </div>

            {/* Global Sticky Block for Step 5 */}
            <div className="sticky top-2 z-40 space-y-3 animate-in slide-in-from-top-4 duration-300">

              {/* Active Boss Skills Global Sticky Nav */}
              {processedSkills.filter(s => s.source === 'bossSkill').length > 0 && (
                <div className="bg-[#f4ebd9]/95 backdrop-blur-md p-3 rounded border border-[#d6c7ab] shadow-md flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-[#6b5a4b] mr-1 flex items-center gap-1"><GiLaurelCrown size={14} className="text-[#6b5a4b]" /> 技能導航：</span>
                  {processedSkills.filter(s => s.source === 'bossSkill').map(activeSkill => {
                    const dbSkill = BOSS_SKILLS_DATA.find(db => db.id === activeSkill.libId);
                    const cat = dbSkill?.subCategory || '未分類';
                    return (
                      <button
                        key={activeSkill.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBossTab(cat);
                          setTimeout(() => {
                            const el = document.getElementById(`boss-skill-${activeSkill.libId}`);
                            if (el) {
                              const container = el.closest('.overflow-y-auto');
                              if (container) {
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                const relativeTop = elRect.top - containerRect.top + container.scrollTop;
                                container.scrollTo({ top: relativeTop - 180, behavior: 'smooth' });
                              } else {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                              el.classList.add('ring-4', 'ring-[#3c2415]', 'ring-offset-4', 'ring-offset-[#fbf7ee]', 'transition-all', 'duration-500', '', 'z-10');
                              setTimeout(() => {
                                el.classList.remove('ring-4', 'ring-[#3c2415]', 'ring-offset-4', 'ring-offset-[#fbf7ee]', '', 'z-10');
                              }, 1500);
                            }
                          }, 100);
                        }}
                        className="text-xs text-[#3c2415] font-bold border border-[#d6c7ab] bg-[#f4ebd9] px-3 py-1.5 rounded-full hover:bg-[#e8dcc4] transition-all cursor-pointer"
                      >
                        {activeSkill.originalName}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Rules Warnings */}
              {(isMoreThanTwoBossSkills || hasDuplicateBossSubCategory) && (
                <div className="space-y-3">
                  {isMoreThanTwoBossSkills && (
                    <WarningNote title="過多的 Boss 技能">
                      手冊建議：在給予同一個 Boss 超過兩個 Boss 技能時要非常小心，這可能會導致戰鬥過於複雜或難以平衡。
                    </WarningNote>
                  )}
                  {hasDuplicateBossSubCategory && (
                    <WarningNote tone="danger" title="技能列表重複">
                      手冊建議：應避免給予 Boss 來自同一個技能列表（子類別）的多個技能。請嘗試選擇不同類型的能力以增加戰術多樣性。
                    </WarningNote>
                  )}
                </div>
              )}
            </div>
            {state.rank !== '冠位' ? (
              <div className="bg-[#fffdf9] p-8 md:p-12 rounded border border-[#d6c7ab] shadow-md flex flex-col items-center justify-center text-center relative overflow-hidden group mt-4">
                <GiLaurelCrown size={80} className="text-[#e8dcc4] mb-6 drop-shadow-sm" />
                <h3 className="text-3xl font-black text-[#3c2415] tracking-widest mb-3">力量尚未覺醒</h3>
                <p className="text-[#6b5a4b] max-w-md mx-auto mb-8 leading-relaxed">您的 NPC 目前是「{state.rank}」。<br />解鎖強大的 Boss 技能需要「冠位」階級。</p>

                <div className="w-full max-w-lg">
                  <div className="text-sm font-bold text-[#3c2415] mb-3 tracking-widest uppercase flex items-center justify-center gap-2">
                    <GiLaurelCrown size={14} /> 選擇冠位倍率以一鍵覺醒 <GiLaurelCrown size={14} />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(mult => (
                      <button
                        key={mult}
                        onClick={() => {
                          setState(prev => ({ ...prev, rank: '冠位', championMultiplier: mult }));
                          showToast(`成功覺醒為冠位 (倍率 x${mult})！`, 'success');
                        }}
                        className="flex flex-col items-center justify-center py-3 bg-[#f4ebd9] border border-[#d6c7ab] rounded hover:bg-[#f4ebd9] hover:border-[#3c2415] transition-all"
                      >
                        <span className="text-xl font-black text-[#3c2415] transition-colors drop-shadow-sm">{mult}</span>
                        <span className="text-t10 text-[#3c2415] font-bold">倍率</span>
                      </button>
                    ))}
                  </div>
                  {/* 這 6 顆按鈕同時改階級和倍率，但外觀只像「選一個數字」。
                      階級可以在步驟 2 改回（可逆），所以不攔，只把後果寫出來。 */}
                  <p className="text-t12 text-[#6b5a4b] mt-3 leading-relaxed text-center">
                    覺醒會把階級改為「冠位」並套用所選倍率。想改回其他階級，回步驟 2 調整即可。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const bossSkillCategories = BOSS_SKILLS_DATA.reduce((acc, skill) => {
                    const cat = skill.subCategory || '未分類';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(skill);
                    return acc;
                  }, {});
                  const categories = Object.keys(bossSkillCategories);
                  const currentActiveTab = activeBossTab || categories[0];

                  return (
                    <div className="flex flex-col gap-4">
                      {/* Tabs Navigation */}
                      <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                        {categories.map(cat => {
                          const isActive = currentActiveTab === cat;
                          const selectedCount = processedSkills.filter(s => s.source === 'bossSkill' && (BOSS_SKILLS_DATA.find(db => db.id === s.libId)?.subCategory || '未分類') === cat).length;
                          return (
                            <button
                              key={cat}
                              onClick={() => setActiveBossTab(cat)}
                              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded border-2 font-bold tracking-widest transition-all ${isActive ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9] shadow-md' : 'bg-[#fffdf9] border-[#d6c7ab] text-[#6b5a4b] hover:border-[#3c2415] hover:text-[#2c221e]'}`}
                            >
                              <span>{cat}</span>
                              {selectedCount > 0 && (
                                <span className={`text-t10 px-1.5 py-0.5 rounded-full shadow-inner ${isActive ? 'bg-[#fffdf9] text-[#3c2415] font-bold' : 'bg-[#f4ebd9] text-[#3c2415]'}`}>{selectedCount}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Tab Content */}
                      <div className="bg-[#fffdf9] border border-[#d6c7ab] rounded p-4 md:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-4">
                          {bossSkillCategories[currentActiveTab].map(skill => {
                            const activeSkillData = processedSkills.find(s => s.libId === skill.id);
                            const isActive = !!activeSkillData;

                            const isRankLocked = skill.reqRank && Array.isArray(skill.reqRank) && !skill.reqRank.includes(state.rank);
                            const isLevelLocked = skill.reqLevel && state.level < skill.reqLevel;
                            const isReqLocked = skill.requires && Array.isArray(skill.requires) && !skill.requires.every(reqId => validSkills.some(s => s.libId === reqId));
                            const isRequirementLocked = !state.isFreeModeEnabled && (isRankLocked || isLevelLocked || isReqLocked);
                            const lockedMsg = !state.isFreeModeEnabled ? (
                              isRankLocked ? `需階級：${skill.reqRank.join('/')}` :
                              isLevelLocked ? `需等級：Lv.${skill.reqLevel}` :
                              isReqLocked ? '需前置技能' : null
                            ) : null;

                            const isOverBudget = isActive && activeSkillData?.isOverBudget && !lockedMsg;
                            const isDisabled = isRequirementLocked || (!isActive && !state.isFreeModeEnabled && state.skills.filter(s => s.source === 'bossSkill').length >= maxAllowedBossSkills);
                            return (
                              <div key={skill.id} id={`boss-skill-${skill.id}`}>
                                <SkillCard
                                  skill={activeSkillData || skill}
                                  isActive={isActive}
                                  isDisabled={isDisabled}
                                  isOverBudget={isOverBudget}
                                  lockedMsg={lockedMsg}
                                  onToggle={() => toggleLibrarySkill(skill)}
                                  onSelectionChange={updateSelection}
                                  onUpdateSkill={updateSkill}
                                  npcLevel={state.level}
                                  partyLevel={state.partyLevel}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      case 6:
        return (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl pb-10">
            <div>
              <h3 className="font-bold text-t16 text-[#2c221e]">步驟 6：配置負面技能</h3>
              <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">為你的 NPC 配備一個顯著的弱點以換取額外的額度。</p>
              {/* 「換取額度」原本兌現時沒有任何回饋——額度只反映在左側面板的數字上，
                  而「(包含負面技能獎勵 +N)」那行寫在步驟 4。所以在這裡把兌現結果說出來。
                  第二十八輪：`emerald-800` 換成墨階 ＋ `✓`。這是「標記」（已選定），不是成功度。 */}
              {(state.selectedNegativeSkills || []).length > 0 && (
                <p className="mt-2 text-t12 text-[#3c2415] font-bold">
                  ✓ 已選定弱點：定位技能額度 +{(state.selectedNegativeSkills || []).length}（在步驟 4 的「定位技能」可以看到）
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {NEGATIVE_SKILLS_DATA.map(skill => {
                const selection = (state.selectedNegativeSkills || []).find(s => s.id === skill.id);
                const isActive = !!selection;

                const isRankLocked = skill.reqRank && Array.isArray(skill.reqRank) && !skill.reqRank.includes(state.rank);
                const isLevelLocked = skill.reqLevel && state.level < skill.reqLevel;
                const isRequirementLocked = !state.isFreeModeEnabled && (isRankLocked || isLevelLocked);
                const lockedMsg = !state.isFreeModeEnabled ? (
                  isRankLocked ? `需階級：${skill.reqRank.join('/')}` :
                  isLevelLocked ? `需等級：Lv.${skill.reqLevel}` : null
                ) : null;

                const isDisabled = isRequirementLocked || (!isActive && !state.isFreeModeEnabled && (state.selectedNegativeSkills || []).length >= 1);
                return (
                  <div key={skill.id} id={`negative-skill-${skill.id}`}>
                    <SkillCard
                      skill={isActive ? { ...skill, ...selection } : skill}
                      isActive={isActive}
                      isDisabled={isDisabled}
                      lockedMsg={lockedMsg}
                      onToggle={() => handleNegativeSkillToggle(skill.id)}
                      onSelectionChange={handleNegativeSkillSelectionChange}
                      onUpdateSkill={handleNegativeSkillUpdate}
                      npcLevel={state.level}
                      partyLevel={state.partyLevel}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4 animate-in fade-in duration-300 max-w-3xl pb-10">
            <div>
              <h3 className="font-bold text-t16 text-[#2c221e]">步驟 7：設定稱呼與特質</h3>
              <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">為你的 NPC 起個名字，並設定頭像、特質與背景故事。</p>
            </div>
            <div className="bg-[#fffdf9] p-6 rounded border border-[#d6c7ab] space-y-5">
              <div>
                <label className="block text-sm text-[#3c2415] mb-2 font-bold">實體名稱</label>
                <input type="text" className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded p-3 text-[#2c221e] outline-none focus:border-[#3c2415] text-lg font-bold tracking-wider" value={state.name} onChange={e => setState({ ...state, name: e.target.value })} placeholder="輸入名稱..." />
              </div>

              {/* NPC 頭像照片上傳與進階設定 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[#3c2415] font-bold flex items-center gap-1.5">
                    <ImageIcon size={16} className="text-[#6b5a4b]" /> NPC 頭像與肖像
                  </label>
                  {state.avatarBase64 && (
                    <button
                      type="button"
                      onClick={() => {
                        setState(p => ({ ...p, avatarBase64: null, avatarScale: 1, avatarFit: 'cover' }));
                        showToast("已清除頭像圖片");
                      }}
                      className="text-xs text-[#8c2d36] hover:text-[#76252d] flex items-center gap-1 transition-colors font-bold"
                    >
                      <Trash2 size={13} /> 移除圖片
                    </button>
                  )}
                </div>

                {/* 支援拖曳上傳與網址載入的面板 */}
                <div
                  onDragEnter={handleAvatarDragEnter}
                  onDragOver={handleAvatarDragOver}
                  onDragLeave={handleAvatarDragLeave}
                  onDrop={handleAvatarDrop}
                  className={`relative transition-all duration-200 border-2 rounded p-4 ${
                    isDraggingOver
                      ? 'border-[#3c2415] bg-[#f9f5eb] shadow-md ring-2 ring-[#3c2415]/40'
                      : 'border-[#d6c7ab] bg-[#fffdf9] hover:border-[#3c2415]'
                  }`}
                >
                  {isDraggingOver && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#fffdf9]/90 backdrop-blur-sm rounded border-2 border-dashed border-[#3c2415] text-[#3c2415] pointer-events-none animate-in fade-in duration-150">
                      <Upload size={36} className="mb-2 text-[#6b5a4b]" />
                      <span className="font-bold text-sm">釋放滑鼠以上傳圖片或網址</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* 縮圖預覽框 */}
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded border-2 border-[#d6c7ab] bg-[#f4ebd9] flex-shrink-0 overflow-hidden flex items-center justify-center shadow-inner group select-none">
                      {state.avatarBase64 ? (
                        <img
                          src={state.avatarBase64}
                          alt="Avatar Preview"
                          draggable={false}
                          className="w-full h-full object-cover pixelated select-none"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[#7c6a58] gap-1 p-2 text-center">
                          <ImageIcon size={28} />
                          <span className="text-t10 text-[#7c6a58]">可拖曳圖片至此</span>
                        </div>
                      )}
                    </div>

                    {/* 上傳控制區與網址輸入 */}
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] text-xs font-bold rounded transition shadow-sm">
                          <Upload size={14} />
                          {state.avatarBase64 ? '更換本地檔案' : '上傳本地照片'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>

                        {state.avatarBase64 && (
                          <>
                            <button
                              type="button"
                              onClick={handleReCrop}
                              className="px-3 py-2 bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] text-xs font-bold rounded transition flex items-center gap-1.5"
                            >
                              <Crop size={14} />
                              重新調整大小
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setState(p => ({ ...p, avatarBase64: null, avatarRawBase64: null }));
                                showToast("已清除頭像圖片");
                              }}
                              className="px-3 py-2 bg-[#f9f5eb] hover:bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36]/30 text-xs font-bold rounded transition"
                            >
                              清除圖片
                            </button>
                          </>
                        )}

                        <span className="text-t11 text-[#7c6a58] hidden sm:inline font-bold">
                          或拖曳圖片檔案至此
                        </span>
                      </div>

                      {/* 圖片網址輸入 */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="url"
                            placeholder="或輸入圖片網址... 例如: https://.../pic.png"
                            value={imageUrlInput}
                            onChange={(e) => setImageUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleLoadImageUrl();
                              }
                            }}
                            className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded px-3 py-1.5 text-xs text-[#2c221e] placeholder-[#7c6a58] outline-none focus:border-[#3c2415] transition-colors font-bold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLoadImageUrl()}
                          disabled={isUrlLoading}
                          className="px-3 py-1.5 bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] rounded text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                        >
                          <Link size={13} />
                          {isUrlLoading ? '載入中...' : '網址載入'}
                        </button>
                      </div>

                      <p className="text-xs text-[#6b5a4b] leading-relaxed">
                        支援 JPG、PNG、GIF、WebP。上傳或載入時會自動開啟調整視窗，可自由放大（最高至 500%）並拖曳移動畫面範圍。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div><label className="block text-sm text-[#3c2415] mb-2 font-bold">特質</label><input type="text" className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded p-3 text-[#2c221e] outline-none focus:border-[#3c2415] font-bold" value={state.traits} onChange={e => setState({ ...state, traits: e.target.value })} placeholder="例如: 敏捷, 致命..." /></div>
              <div><label className="block text-sm text-[#3c2415] mb-2 font-bold">背景故事</label><textarea className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded p-3 text-[#2c221e] outline-none h-32 resize-none focus:border-[#3c2415] font-medium" value={state.story || ""} onChange={e => setState({ ...state, story: e.target.value })} placeholder="簡短描述其起源或動機..." /></div>
            </div>

            {/* 關聯實體設置區塊 */}
            <div className="bg-[#fffdf9] p-6 rounded border border-[#d6c7ab] space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#3c2415] font-bold tracking-widest flex items-center gap-2 uppercase">
                  <Link size={16} className="text-[#6b5a4b]" /> 關聯實體設置
                </label>
                <span className="text-t10 text-[#3c2415] font-bold bg-[#f4ebd9] px-2 py-0.5 rounded border border-[#d6c7ab]">
                  雙向自動關聯
                </span>
              </div>

              <p className="text-xs text-[#6b5a4b] leading-relaxed">
                連結至檔案庫中的其他實體，以便在角色卡預覽中快速跳轉。儲存後將自動建立雙向連結。
              </p>

              {library.length <= 1 ? (
                <EmptyState
                  kind="npc-library-link"
                  icon={GiArchiveResearch}
                  title="檔案庫裡沒有其他實體"
                  teach="連結需要兩個對象；先存檔並建立第二個 NPC，回到這裡就能互相連結。"
                  tone="inset"
                />
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c6a58] w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="搜尋實體名稱..."
                      className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded pl-9 pr-3 py-2 text-sm text-[#2c221e] outline-none focus:border-[#3c2415] transition-colors font-bold"
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {library
                      .filter(n => n.id !== state.id)
                      .filter(n => (n.name || "未知").toLowerCase().includes(linkSearchQuery.toLowerCase()))
                      .sort((a, b) => {
                        const aLinked = (state.linkedNpcs || []).includes(a.id);
                        const bLinked = (state.linkedNpcs || []).includes(b.id);
                        if (aLinked && !bLinked) return -1;
                        if (!aLinked && bLinked) return 1;
                        return (a.name || "").localeCompare(b.name || "");
                      })
                      .map(npc => {
                        const isLinked = (state.linkedNpcs || []).includes(npc.id);
                        return (
                          <button
                            key={npc.id}
                            onClick={() => handleToggleNPCLink(npc.id)}
                            className={`flex items-center justify-between p-3 rounded border-2 transition-all text-left ${isLinked
                              ? 'bg-[#f4ebd9] border-[#3c2415] text-[#3c2415]'
                              : 'bg-[#fffdf9] border-[#d6c7ab] text-[#6b5a4b] hover:border-[#3c2415] hover:text-[#2c221e]'
                              }`}
                          >
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                              <span className="text-sm font-bold truncate">{npc.name || "未知"}</span>
                              <span className="text-t10 opacity-70 tracking-tight">Lv. {npc.level} | {npc.role}</span>
                            </div>
                            {isLinked ? (
                              <div className="bg-[#a63d40] text-[#fffdf9] rounded-full p-1 shadow-sm">
                                <CheckCircle2 size={12} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-[#d6c7ab]"></div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 8:
        return (
          <div className="space-y-4 animate-in fade-in duration-300 max-w-3xl pb-10">
            <div>
              <h3 className="font-bold text-t16 text-[#2c221e]">步驟 8：戰術與行動</h3>
              <p className="mt-1 text-t12 text-[#6b5a4b] leading-relaxed">最後決定 NPC 的戰術。</p>
            </div>
            <div className="bg-[#fffdf9] p-4 rounded border border-[#d6c7ab] mb-6">
              <textarea className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded p-3 text-[#2c221e] outline-none h-48 resize-none focus:border-[#3c2415] text-sm leading-relaxed font-medium" value={state.tactics || ""} onChange={e => setState({ ...state, tactics: e.target.value })} placeholder="描述這個 NPC 在戰鬥中會怎麼行動。例如：優先攻擊施法者；血量低於一半時退到後排，改用遠程攻擊。" />
            </div>
            <div className="flex justify-end"><button onClick={() => setActiveMainTab('preview')} className="bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] px-6 py-3 rounded flex items-center gap-2 font-bold shadow-md transition-colors"><Eye size={18} /> 立即查看角色卡</button></div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-53px)] min-h-[650px] w-full font-sans flex flex-col overflow-hidden relative bg-[#fbf7ee] text-[#3c2415]">

      {/* 全域浮動提示 (Toast Notification) */}
      <AvatarCropperModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSource}
        onClose={() => setIsCropModalOpen(false)}
        onConfirm={handleConfirmCrop}
      />

      <FreeModeConfirmModal
        isOpen={isFreeModeConfirmOpen}
        onClose={() => setIsFreeModeConfirmOpen(false)}
        onConfirm={handleConfirmFreeMode}
      />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 fade-in duration-300">
          <div className={`backdrop-blur px-6 py-3 rounded-full shadow-md font-bold flex items-center gap-2 border ${
            toast.type === 'error' ? 'bg-[#f9f5eb] text-[#8c2d36] border-[#8c2d36]/50' :
            toast.type === 'warning' ? 'bg-[#f9f5eb] text-[#3c2415] border-[#d6c7ab]' :
            'bg-[#fffdf9] text-[#3c2415] border-[#d6c7ab]'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={18} /> : toast.type === 'warning' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {toast.message}
          </div>
        </div>
      )}

      {activeMainTab !== 'library' && (
        <div className="flex border-b-2 flex-shrink-0 bg-[#f4ebd9] border-[#d6c7ab]">
          <button
            onClick={() => setActiveMainTab('build')}
            className={`flex-1 py-2 sm:py-3.5 text-sm sm:text-base font-bold tracking-widest flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2 transition-all duration-200 ${
              activeMainTab === 'build'
                ? 'bg-[#fbf7ee] text-[#3c2415] border-b-[3px] border-[#3c2415]'
                : 'text-[#6b5a4b] hover:bg-[#f4ebd9]/60'
            }`}
          >
            <Settings size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" /> 構築頁面
          </button>
          <button
            onClick={() => setActiveMainTab('preview')}
            className={`flex-1 py-2 sm:py-3.5 text-sm sm:text-base font-bold tracking-widest flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2 transition-all duration-200 ${
              activeMainTab === 'preview'
                ? 'bg-[#fbf7ee] text-[#3c2415] border-b-[3px] border-[#3c2415]'
                : 'text-[#6b5a4b] hover:bg-[#f4ebd9]/60'
            }`}
          >
            <Eye size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" /> 角色卡預覽
          </button>
        </div>
      )}

      {/* 檔案庫 Tab 內容 (Library View) */}
      {activeMainTab === 'library' && (
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar animate-in fade-in bg-[#fbf7ee]">
          <div className="max-w-6xl mx-auto flex flex-col min-h-full">
            {/* 接續草稿提示條（2026-10-22，見 `docs/decisions.md` §BS）：
                使用者從檔案庫離開、下次再進來時，未存進檔案庫的草稿不會自己跳出來搶畫面，
                改由這條提示提供「繼續編輯／丟棄」兩個明確選擇。 */}
            {draftOffer && hasUnsavedDraft(draftOffer) && (
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f9f5eb] border border-[#d6c7ab] rounded px-4 py-3">
                <div className="flex items-start gap-2 min-w-0">
                  <GiScrollUnfurled size={18} className="text-[#3c2415] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#3c2415] leading-relaxed">
                    <strong className="font-black">上次有一份沒存進檔案庫的草稿</strong>
                    <span className="text-[#6b5a4b]">　「{draftOffer.npc?.name || '未命名 NPC'}」</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleResumeDraft}
                    className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] text-xs font-bold shadow-sm transition-colors"
                  >
                    繼續編輯
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="px-3 py-1.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-[#3c2415] text-xs font-bold transition-colors"
                  >
                    丟棄
                  </button>
                </div>
              </div>
            )}
            {/* Top Control Bar: Search & Filters on left, Actions on right (Matches Character Sheet hierarchy) */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pb-4 mb-6 border-b border-[#d6c7ab]">
              {/* Search Input & Filter Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6b5a4b]/70 pointer-events-none" />
                  <input
                    type="text"
                    value={libSearchQuery}
                    onChange={(e) => setLibSearchQuery(e.target.value)}
                    placeholder="搜尋姓名、定位、物種、位階、技能..."
                    className="w-full pl-9 pr-3 py-2 rounded border border-[#d6c7ab] bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3c2415]/20 text-xs text-[#3c2415] placeholder:text-[#6b5a4b]/50 transition-all"
                  />
                </div>

                {availableLibRoles.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white border border-[#d6c7ab] px-2.5 py-1.5 rounded">
                    <Filter className="w-3.5 h-3.5 text-[#3c2415]" />
                    <select
                      value={libRoleFilter}
                      onChange={(e) => setLibRoleFilter(e.target.value)}
                      className="bg-transparent text-xs font-medium text-[#3c2415] focus:outline-none cursor-pointer"
                    >
                      <option value="all">全部定位（{library.length}）</option>
                      {availableLibRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                )}

                {availableLibRanks.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white border border-[#d6c7ab] px-2.5 py-1.5 rounded">
                    <Filter className="w-3.5 h-3.5 text-[#3c2415]" />
                    <select
                      value={libRankFilter}
                      onChange={(e) => setLibRankFilter(e.target.value)}
                      className="bg-transparent text-xs font-medium text-[#3c2415] focus:outline-none cursor-pointer"
                    >
                      <option value="all">全部位階</option>
                      {availableLibRanks.map(rank => (
                        <option key={rank} value={rank}>{rank}</option>
                      ))}
                    </select>
                  </div>
                )}

                {library.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-white border border-[#d6c7ab] px-2.5 py-1.5 rounded">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#3c2415]" />
                    <select
                      value={libSortBy}
                      onChange={(e) => setLibSortBy(e.target.value)}
                      className="bg-transparent text-xs font-medium text-[#3c2415] focus:outline-none cursor-pointer"
                    >
                      <option value="recent">最近更新</option>
                      <option value="name_asc">NPC 名稱（筆劃/字母）</option>
                      <option value="level_desc">等級（高至低）</option>
                      <option value="level_asc">等級（低至高）</option>
                    </select>
                  </div>
                )}

                {(libSearchQuery || libRoleFilter !== 'all' || libRankFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => { setLibSearchQuery(''); setLibRoleFilter('all'); setLibRankFilter('all'); }}
                    className="text-xs px-2.5 py-1.5 rounded text-[#3c2415] hover:bg-[#f4ebd9] transition-colors font-medium"
                  >
                    重設
                  </button>
                )}
              </div>

              {/* Actions: Count, Import, Backup, Create */}
              <div className="flex items-center gap-2 justify-end shrink-0 flex-wrap">
                {library.length > 0 && (
                  <span className="text-xs font-mono font-medium text-[#7c6a58] mr-1 hidden md:inline">
                    顯示 {filteredLibrary.length} / 共 {library.length} 隻
                  </span>
                )}

                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                  <span
                    className="bg-white hover:bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] px-3.5 py-2 rounded font-bold flex items-center gap-1.5 transition-all justify-center text-xs cursor-pointer"
                    title="匯入單張 NPC 的 JSON 檔案（載入後還要按「儲存」才會進檔案庫）"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#3c2415]" />
                    <span>匯入單張 NPC</span>
                  </span>
                </label>

                <button
                  onClick={handleBackupAllNPCs}
                  className="bg-white hover:bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] px-3.5 py-2 rounded font-bold flex items-center gap-1.5 transition-all justify-center text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#3c2415]" />
                  <span>備份全庫</span>
                </button>

                {/* 2026-10-23（v5.1）：檔案庫為空時**不**顯示這顆主要按鈕。
                    空狀態裡已經有一顆「建立第一位 NPC」，兩顆同時出現等於同一個動作
                    在一屏裡喊兩次（Refactoring UI「Empty states are a feature」：
                    空狀態應該是那個畫面唯一的主要動作，不是旁邊再放一顆一樣的）。 */}
                {library.length > 0 && (
                  <button
                    onClick={createNewNPC}
                    className="bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] px-4 py-2 rounded font-bold flex items-center gap-1.5 shadow-e1 transition-colors justify-center text-t12"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>建立新 NPC</span>
                  </button>
                )}
              </div>
            </div>

            {library.length === 0 ? (
              /* 空狀態：2026-10-23（v5.1）
                 - 高度由 py-20（320px 上下留白）收到 py-12，圖示 80px → 56px：
                   原本在一屏 900px 裡，這個空盒子佔掉 700px，卻只有兩行字。
                 - 移除背後的 blur 光暈（純裝飾，且讓圖示邊緣發毛）。
                 - 文案改掉「點擊右上方按鈕」：那顆按鈕在空狀態時已經不顯示了，
                   留著會指到不存在的東西。 */
              <div className="flex-1 min-h-[260px] text-center px-6 py-12 bg-[#fffdf9] rounded border border-[#d6c7ab] border-dashed flex flex-col items-center justify-center">
                <GiDragonHead className="w-14 h-14 text-[#7c6a58]" />
                <p className="mt-4 text-[#3c2415] font-bold tracking-widest text-t20">檔案庫目前空空如也</p>
                <p className="text-[#6b5a4b] text-t14 mt-1.5 max-w-md">
                  先建立一位 NPC，之後可以逐步補完物種、定位與技能。
                </p>
                <button
                  type="button"
                  onClick={createNewNPC}
                  className="mt-5 bg-[#a63d40] hover:bg-[#76252d] active:bg-[#76252d] text-[#fffdf9] px-5 py-2.5 rounded font-bold flex items-center gap-2 shadow-e1 transition-colors text-t14"
                >
                  <PlusCircle size={18} /> 建立第一位 NPC
                </button>
              </div>
            ) : filteredLibrary.length === 0 ? (
              <div className="text-center px-6 py-12 bg-[#fffdf9] rounded border border-[#d6c7ab] border-dashed flex flex-col items-center justify-center">
                <p className="text-[#3c2415] font-bold text-t16">找不到符合條件的 NPC</p>
                <p className="text-[#6b5a4b] text-t12 mt-1">請嘗試變更搜尋關鍵字、定位或位階篩選。</p>
                <button
                  type="button"
                  onClick={() => { setLibSearchQuery(''); setLibRoleFilter('all'); setLibRankFilter('all'); }}
                  className="mt-4 text-xs font-bold text-[#3c2415] hover:underline"
                >
                  清除所有篩選條件
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredLibrary.map(npc => (
                  <div key={npc.id} className="bg-[#fffdf9] border border-[#d6c7ab] rounded overflow-hidden shadow-md flex flex-col group hover:border-[#3c2415] transition-all hover:shadow-lg">
                    <div className="h-32 bg-[#f4ebd9] relative flex items-center justify-center border-b border-[#d6c7ab] overflow-hidden">
                      {npc.avatarBase64 ? (
                        <img
                          src={npc.avatarBase64}
                          className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500 pixelated"
                          style={{
                            imageRendering: 'pixelated',
                            objectFit: npc.avatarFit || 'cover',
                            transform: `translate(${npc.avatarOffsetX || 0}px, ${npc.avatarOffsetY || 0}px) scale(${npc.avatarScale || 1})`,
                            transformOrigin: 'center center'
                          }}
                        />
                      ) : (
                        <ImageIcon size={32} className="text-[#7c6a58]" />
                      )}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="bg-[#fffdf9]/90 text-[#a63d40] text-t10 font-bold px-2 py-0.5 rounded border border-[#d6c7ab]">Lv. {npc.level}</span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-[#3c2415] mb-1 truncate drop-shadow-sm">{npc.name || "未知實體"}</h3>
                      <p className="text-xs text-[#6b5a4b] font-bold tracking-wider mb-5 flex items-center gap-1.5">
                        <span className="text-[#6b5a4b]">【{npc.rank}】</span>
                        {(() => {
                          const LibRoleIcon = ROLE_ICONS[npc.role] || ROLE_DESCRIPTIONS[npc.role]?.Icon;
                          return LibRoleIcon ? <LibRoleIcon className="w-3.5 h-3.5 text-[#3c2415] shrink-0 inline" /> : null;
                        })()}
                        <span>{npc.role}</span>
                      </p>
                      <div className="mt-auto flex gap-2">
                        <button onClick={() => { setState(npc); setActiveMainTab('build'); }} className="flex-1 bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] py-2 rounded text-sm font-bold flex justify-center items-center gap-1 transition-colors border border-[#d6c7ab]"><Edit3 size={14} /> 編輯</button>
                        <button onClick={() => { setState(npc); setActiveMainTab('preview'); }} className="flex-1 bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] py-2 rounded text-sm font-bold flex justify-center items-center gap-1 transition-colors border border-[#d6c7ab]"><Eye size={14} /> 預覽</button>
                        <button onClick={() => handleExportJSON(npc)} className="bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] px-3 py-2 rounded transition-colors border border-[#d6c7ab] flex justify-center items-center" title={`匯出「${npc.name || "未知實體"}」的 JSON 存檔`} aria-label={`匯出「${npc.name || "未知實體"}」的 JSON 存檔`}><Download size={16} /></button>
                <button onClick={() => handleSendToCombat(npc)} className="bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#8c2d36] px-3 py-2 rounded text-sm font-bold flex justify-center items-center gap-1 transition-colors border border-[#8c2d36]/50" title="推入戰鬥房間"><GiCrossedSwords size={14} /> 入戰</button>
                        <button onClick={() => {
                          if (window.confirm(`確定要刪除「${npc.name || "未知實體"}」嗎？此操作無法復原。`)) {
                            setLibrary(prev => {
                              let newLib = prev.filter(n => n.id !== npc.id);
                              newLib = newLib.map(n => ({
                                ...n,
                                linkedNpcs: (n.linkedNpcs || []).filter(id => id !== npc.id)
                              }));
                              return newLib;
                            });
                            showToast(`已刪除「${npc.name || "未知實體"}」`);
                          }
                        }} title={`刪除「${npc.name || "未知實體"}」`} aria-label={`刪除「${npc.name || "未知實體"}」`} className="bg-[#f9f5eb] hover:bg-[#f4ebd9] text-[#8c2d36] px-3 py-2 rounded transition-colors border border-[#8c2d36]/30"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Global Budgets HUD - shows when in build mode with an NPC */}
      {activeMainTab === 'build' && state && (
        <>
          <div className="flex-shrink-0 bg-[#f4ebd9]/95 backdrop-blur border-b border-[#d6c7ab] px-3 py-1.5 flex flex-wrap items-center gap-2">
            {/* 定位技能 */}
            {maxRoleSkills > 0 && (
              <button
                onClick={() => { setCurrentStep(4); setStep4SubTab('skills'); }}
                className={`flex items-center gap-1.5 text-t10 font-bold px-2.5 py-1 rounded-full border transition-all hover:border-[#3c2415] ${
                  usedRoleSkills > maxRoleSkills
                    ? 'bg-[#f4ebd9] text-[#8c2d36] border-[#8c2d36]'
                    : usedRoleSkills >= maxRoleSkills
                    ? 'bg-[#f4ebd9] text-[#3c2415] border-[#3c2415]'
                    : 'bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]'
                }`}
                title="點擊前往定位技能配置"
              >
                ❖ 定位技能 {usedRoleSkills}/{maxRoleSkills}
              </button>
            )}
            {/* 咒語容量 */}
            {allSpellbooksToRender.length > 0 && (() => {
              const usedSpells = allSpellbooksToRender.reduce((s, b) => s + (b.selectedSpells || []).length, 0);
              const maxSpells = allSpellbooksToRender.reduce((s, b) => s + (b.spellConfig?.capacity || 0), 0);
              return (
                <button
                  onClick={() => { setCurrentStep(4); setStep4SubTab('skills'); }}
                  className={`flex items-center gap-1.5 text-t10 font-bold px-2.5 py-1 rounded-full border transition-all hover:border-[#3c2415] ${
                    usedSpells > maxSpells
                      ? 'bg-[#f4ebd9] text-[#8c2d36] border-[#8c2d36]'
                      : usedSpells >= maxSpells
                      ? 'bg-[#f4ebd9] text-[#3c2415] border-[#3c2415]'
                      : 'bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]'
                  }`}
                  title="點擊前往咒語配置"
                >
                  ✦ 咒語容量 {usedSpells}/{maxSpells}
                </button>
              );
            })()}
            {/* 屬性相性 (弱點 / 抗性 / 免疫) */}
            <button
              onClick={() => { setCurrentStep(4); setStep4SubTab('stats'); }}
              className="flex items-center gap-1.5 text-t10 font-bold px-2.5 py-1 rounded-full border border-[#d6c7ab] bg-[#f9f5eb] text-[#3c2415] transition-all hover:border-[#3c2415] ml-auto md:ml-0"
              title="數字只計算你手動分配的額度；物種自帶的抗性另計、不佔額度。點擊前往相性配置"
            >
              <span className="text-t12 font-normal opacity-70">手動</span>
              ▽ 弱 {currentAffinities.vul} | ▼ 抗 {currentAffinities.res} | ◆ 免 {currentAffinities.imm}
              {speciesAffinitySummary && (
                <span className="hidden md:inline ml-1 pl-1.5 border-l border-[#d6c7ab] text-[#6b5a4b] font-normal">
                  物種：{speciesAffinitySummary}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden relative">
            {/* 步驟側邊欄 ( md:flex, 手機端隱藏轉為頂部條 ) */}
            <div className="hidden md:flex w-64 bg-[#f4ebd9] border-r border-[#d6c7ab] flex-col overflow-y-auto custom-scrollbar flex-shrink-0">
              <div className="p-4 border-b border-[#d6c7ab]">
                <h2 className="text-xs font-black text-[#6b5a4b] uppercase tracking-wider">建構步驟</h2>
              </div>
              <div className="p-2 space-y-1">
                {steps.map((s) => (
                  <button
                    key={s.num}
                    onClick={() => setCurrentStep(s.num)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-left transition-all ${
                      currentStep === s.num
                        ? 'bg-[#fffdf9] text-[#2c221e] font-black border border-[#d6c7ab]'
                        : 'text-[#6b5a4b] hover:bg-[#e8dcc4] hover:text-[#2c221e]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          currentStep === s.num
                            ? 'text-white'
                            : 'bg-[#d6c7ab] text-[#6b5a4b]'
                        }`}
                        style={{ backgroundColor: currentStep === s.num ? workshopTheme.accent : undefined }}
                      >
                        {s.num}
                      </span>
                      <span className="font-bold text-sm tracking-widest whitespace-nowrap">{s.num}. {s.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 主表單與桌面雙欄容器 */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-[#fbf7ee]">
              {/* 手機頂部橫向步驟指示條 */}
              <div className="md:hidden sticky top-0 z-30 backdrop-blur border-b px-3 py-2 flex items-center gap-2 bg-[#f4ebd9] border-[#d6c7ab]">
                <span className="text-xs font-black tracking-wide shrink-0 text-[#3c2415]">步驟 {currentStep}/{steps.length}</span>
                <div className="flex-1 rounded-full h-1.5 overflow-hidden bg-[#d6c7ab]">
                  <div className="h-full rounded-full transition-all duration-500 bg-[#a63d40]" style={{ width: `${(currentStep / steps.length) * 100}%` }}></div>
                </div>
                <select
                  className="text-xs font-bold border px-2 py-1 rounded outline-none max-w-[140px] truncate bg-[#fffdf9] border-[#d6c7ab] text-[#3c2415]"
                  value={currentStep}
                  onChange={e => setCurrentStep(Number(e.target.value))}
                >
                  {steps.map(s => <option key={s.num} value={s.num}>{s.num}. {s.title}</option>)}
                </select>
              </div>

              {/* 可滾動的主內容區 (桌面雙欄 xl+) */}
              <div className="flex-1 overflow-hidden flex">
                {/* 左半欄：步驟表單 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                  <div className="mx-auto flex flex-col min-h-full max-w-4xl px-4 py-6 md:px-8 md:py-8 relative xl:max-w-none xl:px-6">
                    {renderStepContent()}
                  </div>
                </div>

                {/* 右半欄：常駐角色卡預覽 (僅 xl+ 顯示) */}
                <div className="hidden xl:flex w-[45%] flex-shrink-0 border-l flex-col overflow-y-auto custom-scrollbar bg-[#f4ebd9] border-[#d6c7ab]">
                  <div className="sticky top-0 z-10 backdrop-blur border-b px-4 py-2 flex items-center gap-2 bg-[#f4ebd9] border-[#d6c7ab]">
                    <Eye size={14} className="text-[#6b5a4b]" />
                    <span className="text-xs font-black tracking-widest text-[#3c2415]">即時預覽</span>
                    <span className="text-t10 ml-auto border px-2 py-0.5 rounded bg-[#fffdf9] border-[#d6c7ab] text-[#3c2415]">修改左側數值，預覽即時同步</span>
                  </div>
                  <div className="px-4 py-4">
                    {renderCharacterCard()}
                  </div>
                </div>
              </div>

              {/* 固定在底部的全局導航按鈕 (除了步驟一保留原樣) */}
              {currentStep !== 1 && (
                <div className="w-full border-t py-3 shrink-0 z-50 relative shadow-[0_-10px_20px_-10px_rgba(44,34,30,0.1)] bg-[#f4ebd9] border-[#d6c7ab]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                  <div className="max-w-4xl mx-auto flex justify-between items-center px-4 md:px-8">
                    <button onClick={prevStep} title="上一步（Alt + ←）" className="flex items-center gap-2 px-5 py-2.5 rounded font-bold transition-all text-sm text-[#3c2415] bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab]">
                      <ChevronLeft size={16} /> 上一步
                    </button>

                    {currentStep === 8 ? (
                      <button onClick={() => setActiveMainTab('preview')} className="flex items-center gap-2 px-8 py-2.5 rounded font-bold transition-all shadow-md text-sm text-[#fffdf9] bg-[#a63d40] hover:bg-[#8c3235]">
                        <Check size={16} /> 預覽角色卡
                      </button>
                    ) : (
                      <button onClick={nextStep} title="下一步（Alt + →）" className="flex items-center gap-2 px-8 py-2.5 rounded font-bold transition-all shadow-md text-sm text-[#fffdf9] bg-[#a63d40] hover:bg-[#8c3235]">
                        下一步 <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 移動端 Bottom Sheet 懸浮按鈕 (FAB) - 僅在大螢幕 xl 以下顯示 */}
          <div className="xl:hidden fixed bottom-16 right-4 z-40">
            <button
              onClick={() => setIsBottomSheetOpen(true)}
              className="bg-[#8c3235] hover:bg-[#a63d40] text-[#fffdf9] p-3.5 rounded-full shadow-e3 flex items-center gap-2 font-bold transition-all duration-300 border-2 border-[#d6c7ab]"
              title="查看角色卡預覽"
            >
              <Eye size={20} />
              <span className="text-xs font-black hidden sm:inline">預覽卡片</span>
            </button>
          </div>

          {/* Bottom Sheet Overlay */}
          {isBottomSheetOpen && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setIsBottomSheetOpen(false)}
              />
              <div
                ref={bottomSheetRef}
                className="relative z-10 bg-[#fbf7ee] rounded-t shadow-e3 max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300"
                onTouchStart={e => { bsDragStartY.current = e.touches[0].clientY; bsDragOffset.current = 0; }}
                onTouchMove={e => {
                  const dy = e.touches[0].clientY - bsDragStartY.current;
                  bsDragOffset.current = dy;
                  if (dy > 0 && bottomSheetRef.current) bottomSheetRef.current.style.transform = `translateY(${dy}px)`;
                }}
                onTouchEnd={() => {
                  if (bsDragOffset.current > 80) { setIsBottomSheetOpen(false); }
                  if (bottomSheetRef.current) bottomSheetRef.current.style.transform = '';
                }}
              >
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1.5 bg-[#d6c7ab] rounded-full" />
                </div>
                <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-[#d6c7ab]">
                  <span className="text-sm font-black tracking-widest text-[#3c2415] flex items-center gap-2"><Eye size={14} className="text-[#6b5a4b]" /> 角色卡預覽</span>
                  <button onClick={() => setIsBottomSheetOpen(false)} className="text-[#6b5a4b] hover:text-[#2c221e] transition-colors p-1 rounded hover:bg-[#e8dcc4]" title="關閉預覽">
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto custom-scrollbar px-3 py-3">
                  {renderCharacterCard()}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeMainTab === 'preview' && state && (
        <div className="flex-1 overflow-y-auto bg-[#fbf7ee] custom-scrollbar animate-in fade-in">
          <div className="mx-auto flex flex-col items-center px-4 py-6 md:px-8 md:py-8 min-h-full max-w-4xl">
            <div className="w-full flex flex-wrap justify-between items-center mb-4 bg-[#f4ebd9]/95 backdrop-blur p-3 rounded border border-[#d6c7ab] shadow-md sticky top-0 z-20 gap-2">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[#3c2415] text-sm font-bold flex items-center gap-1.5"><Eye size={16} className="text-[#6b5a4b]" /> 研究檢定</span>
                  <div className="flex bg-[#fffdf9] rounded p-1 border border-[#d6c7ab] shadow-inner overflow-hidden">
                    {['full', '7', '10', '13'].map(lv => (
                      <button
                        key={lv}
                        onClick={() => setRevealLevel(lv)}
                        className={`px-3 py-1 rounded text-t11 font-black transition-all ${revealLevel === lv
                          ? 'bg-[#a63d40] text-[#fffdf9] shadow-sm'
                          : 'text-[#6b5a4b] hover:text-[#2c221e]'
                          }`}
                      >
                        {lv === 'full' ? '完整' : `${lv}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 角色卡配色風格選擇器 (專屬移至預覽工具列) */}
                <div className="relative">
                  <button
                    onClick={() => setIsPaletteOpen(prev => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border bg-[#fffdf9] border-[#d6c7ab] hover:border-[#3c2415] text-xs font-bold text-[#3c2415] transition-all"
                    title="切換角色卡配色風格"
                  >
                    <Palette size={15} style={{ color: currentTheme.accent }} />
                    <span className="hidden sm:inline">卡片風格：</span>
                    <span>{currentTheme.name}</span>
                    <ChevronDown size={13} className={`transition-transform duration-200 ${isPaletteOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isPaletteOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsPaletteOpen(false)} />
                      <div className="absolute left-0 top-full mt-1.5 bg-[#fffdf9] border-2 border-[#d6c7ab] rounded shadow-e3 p-2.5 z-50 min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="text-t11 font-bold text-[#6b5a4b] mb-2 px-1 flex items-center justify-between border-b border-[#d6c7ab]/60 pb-1.5">
                          <span className="flex items-center gap-1"><Palette size={12} /> 選擇角色卡風格</span>
                          <span className="text-t10 text-[#3c2415] font-mono">6 種經典主題</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.keys(THEMES).map(t => {
                            const theme = THEMES[t];
                            const isSelected = cardTheme === t;
                            return (
                              <button
                                key={t}
                                onClick={() => {
                                  setCardTheme(t);
                                  writeRaw(STORAGE_KEYS.npcCardTheme, t);
                                  setIsPaletteOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded border text-left transition-all text-xs font-bold ${
                                  isSelected
                                    ? 'border-[#3c2415] bg-[#f9f5eb] text-[#2c221e] ring-1 ring-[#3c2415]/35'
                                    : 'border-[#d6c7ab]/80 bg-[#fffdf9] text-[#6b5a4b] hover:bg-[#f4ebd9] hover:border-[#7c6a58]'
                                }`}
                              >
                                <div
                                  className="w-3.5 h-3.5 rounded-full shrink-0 border shadow-xs"
                                  style={{ backgroundColor: theme.accent, borderColor: theme.accentDark }}
                                />
                                <span className="truncate">{theme.name}</span>
                                {isSelected && <Check size={12} className="ml-auto text-[#3c2415] shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Multi-format copy dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setCopyFormatDropdownOpen(prev => !prev)}
                    className="bg-[#8c3235] hover:bg-[#a63d40] text-[#fffdf9] px-3 py-2 rounded flex items-center gap-1.5 font-bold shadow transition-colors text-sm"
                  >
                    <FileText size={15} /> 複製文本 ▾
                  </button>
                  {copyFormatDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-[#fffdf9] border border-[#d6c7ab] rounded shadow-xl z-30 min-w-[170px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <button
                        onClick={() => { handleCopyFullNpc('discord'); setCopyFormatDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#2c221e] hover:bg-[#f4ebd9] transition-colors text-left font-bold"
                      >
                        <MessageSquare size={14} className="text-[#3c2415]" /> Discord 格式
                      </button>
                      <button
                        onClick={() => { handleCopyFullNpc('markdown'); setCopyFormatDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#2c221e] hover:bg-[#f4ebd9] transition-colors text-left font-bold"
                      >
                        <FileCode size={14} className="text-[#6b5a4b]" /> Markdown 格式
                      </button>
                      <button
                        onClick={() => { handleCopyFullNpc('plain'); setCopyFormatDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#2c221e] hover:bg-[#f4ebd9] transition-colors text-left border-t border-[#d6c7ab] font-bold"
                      >
                        <FileText size={14} className="text-[#6b5a4b]" /> 純文字筆記格式
                      </button>
                      <button
                        onClick={() => { handleCopyFullNpc('ccfolia'); setCopyFormatDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#2c221e] bg-[#f9f5eb] hover:bg-[#e8dcc4] transition-colors text-left border-t border-[#d6c7ab] font-bold cursor-pointer"
                        title="複製為 ccfolia 格式，至房間直接按 Ctrl+V 貼上即可生成棋子"
                      >
                        <GiRollingDices size={16} className="text-[#3c2415]" /> ccfolia 棋子 (Ctrl+V)
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={handleCopyJPG} className="bg-[#3c2415] hover:bg-[#2c221e] text-[#e8dcc4] px-4 py-2 rounded flex items-center gap-2 font-bold shadow transition-colors text-sm">
                  <Copy size={16} /> 複製圖片
                </button>
                <button onClick={handleExportJPG} className="bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] px-4 py-2 rounded flex items-center gap-2 font-bold shadow transition-colors text-sm">
                  <Download size={16} /> 匯出 JPG
                </button>
              </div>
            </div>
            {/* GM-08-02／GM-08-03：揭示等級是跨頁籤保留的狀態，而背景故事與戰術
                只在「完整」才渲染。少了這條提示，GM 切過 10+ 之後再回來改故事，
                會以為自己寫的東西被吃掉了；`??` 也會被讀成資料缺失而不是刻意遮蔽。 */}
            {revealLevel !== 'full' && (
              <div className="w-full mb-3 flex items-start gap-2 rounded border border-[#3c2415] bg-[#f9f5eb] px-3 py-2 text-t12 leading-relaxed text-[#2c221e]">
                <Eye size={14} className="mt-0.5 shrink-0 text-[#6b5a4b]" />
                <span>
                  目前是研究檢定視角（<span className="font-black">{revealLevel}+</span>）：背景故事與戰術不會顯示
                  {revealLevel === '7' && <>，數值欄位中的 <span className="font-mono font-black">??</span> 代表「尚未揭示」</>}
                  。切回「<span className="font-black">完整</span>」可以看到全部內容。
                </span>
              </div>
            )}
            {renderCharacterCard()}

            <div className="h-20 w-full flex-shrink-0"></div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d6c7ab; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #d6c7ab; }
        
        /* 修正匯出圖片時的文字與圖示對齊問題 */
        svg {
          vertical-align: middle;
          display: inline-block;
        }
        
        @media print {
          .no-print { display: none; }
        }
      `}} />
    </div>
  );
}
