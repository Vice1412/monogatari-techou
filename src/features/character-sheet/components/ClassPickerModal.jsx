import React, { useState, useMemo, useEffect } from 'react';
import {
  GiSparkles,
  GiCheckMark,
  GiMagnifyingGlass,
  GiHazardSign,
  GiSpellBook
} from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import JRPGButton from '../../../components/ui/JRPGButton';
import SkillStarPips from './SkillStarPips';
import SkillDescription from '../utils/skillFormulaEvaluator';
import CoreBookVariantCard from './CoreBookVariantCard';
import { getVariantsForClass, getVariantById, buildSkillEntry } from '../data/coreBookVariants';
import { SOURCEBOOKS, getClassInfo } from '../data/sourcebookConfig';
import { matchesClassQuery, formatClassAliases, classAliasSource } from '../data/classAliases';
import { DEFAULT_CREATION_RULES, resolveCreationRules, PLAYTEST_SOURCEBOOK_KEY } from '../data/creationRules';
import { isSkillSuppressedByTechnospheres } from '../data/technospheres';
import rulesData from '../data/rulesData.json';
import { withEn } from '../../../utils/properNouns';
import ClassHeroicSkillsBlock from './ClassHeroicSkillsBlock';

/**
 * 上排「官方拓展職業」只列**真正的手冊**。
 * 公測修訂是開卡規則的選用開關（`allowPlaytest`），不是一本書——見 §BE。
 */
const BOOK_KEYS = Object.freeze(
  Object.keys(SOURCEBOOKS).filter((key) => key !== PLAYTEST_SOURCEBOOK_KEY)
);

/**
 * 職業選擇與技能分配彈窗 (ClassPickerModal)
 *
 * ## 一次挑完所有職業（2026-10-06 使用者要求的流程重構）
 *
 * 舊流程是「選擇職業 → 點職業 → 點技能 → 確認 → 再按選擇職業 → 重複」——
 * 使用者說「我覺得很繁瑣」。現在**草稿是跨職業累積的**（`draft` 是
 * `{ 職業名: { 技能名: 級數 } }`），所以在同一個彈窗裡把 2~3 個職業點完，
 * **按一次確定就全部寫進去**，然後回到顯示已選技能的畫面。
 *
 * ## 上排的「已選職業」欄位
 *
 * 使用者要求：「顯示目前已經給哪個職業點了幾級……一個標誌然後職業名字，用小框框起來，
 * 然後那個框的右上角有寫一個數字」。所以每一顆徽章是 `圖示 ＋ 職業名 ＋ 右上角角標（投入等級）`，
 * **點它就跳到那個職業**，可以立刻去別的職業繼續點。
 *
 * ## 佈局
 *
 * 1. 電腦端 (≥ md)：左右雙欄並排 (Master-Detail)，左側名冊即時聯動右側詳情。
 * 2. 手機端：'list'（挑職業）與 'detail'（配點）兩步，用 `mobileStep` 切換。
 * 3. 全面呈現免費增益：完整對齊官方規則與繁中 Excel 角色卡名詞。
 */
/**
 * 魔晶石制下被原書作廢的技能（p.133 的守護者【雙重盾牌】）不該出現在創角流程——
 * 盾牌整類不存在，這個技能買了也不會生效。這裡把 `def.skills` 濾掉再往下傳，
 * 於是草稿初始化、卡片渲染、按下確定時的寫入全部共用同一份清單，不會漏掉某一條路徑。
 *
 * 沒有東西要濾時回傳**原物件**：這個 helper 掛在 `useMemo` 的依賴鏈上，
 * 每次都產生新物件會讓下游白白重算。
 */
const withSuppressedSkillsFiltered = (def, mode) => {
  const skills = def.skills || [];
  if (!skills.some((sk) => isSkillSuppressedByTechnospheres(sk.name, mode))) return def;
  return { ...def, skills: skills.filter((sk) => !isSkillSuppressedByTechnospheres(sk.name, mode)) };
};

export default function ClassPickerModal({
  isOpen,
  onClose,
  theme,
  enabledBooks = ['core'],
  onToggleSourcebook,
  /** 一次把某幾本手冊設為開放（上排「全部」鈕）；逐本呼叫會遺失更新，所以是獨立 prop */
  onSetSourcebooks,
  existingClassNames = [],
  /** `(entries) => void`，entries = `[{ className, skills: [{ name, sl }] }]`（只含有配點的） */
  onSelectClasses,
  /** 既有職業已經吃掉的技能等級總數——一次確定多個職業時要把總額算進去 */
  budgetUsed = 0,
  // 開卡規則：技能點數上限與職業數上下限由此決定（見 data/creationRules.js）
  creationRules = DEFAULT_CREATION_RULES,
  // 角色已定稿 → 收掉英雄技能的**瀏覽**入口（目錄是創角輔助；自己已拿到的效果照常顯示）
  locked = false,
  /**
   * **測試注入點**（生產端永不傳入）：讓 SSR 護欄能直接渲染到「右側詳情」，
   * 因為詳情是靠 `useEffect` 在使用者開啟彈窗時才選定職業的，而 SSR 不執行 effect
   * ——等於詳情區塊原本完全沒有護欄（`AGENTS.md` §AW9）。
   * **不傳時行為逐字不變**（維持 null，由 effect 決定）。
   */
  initialClassName = null,
  /**
   * **測試注入點**（生產端永不傳入）：跳過彈窗外框直接渲染內容。
   * 見下方 `Panel` 的說明；**不傳時行為逐字不變**。
   */
  panelOnly = false,
  /**
   * **測試注入點**（生產端永不傳入）：預先塞入技能配點草稿
   * （`{ 職業名: { 技能名: 級數 } }`），讓 SSR 護欄能渲染到
   * 「某個技能已達 SL 上限」這種**只有點擊才會出現**的狀態——
   * SSR 不執行事件，否則滿級提示（`docs/playtest/findings.md` F-006）永遠測不到
   * （`AGENTS.md` §AW9 同型）。
   * **不傳時行為逐字不變**（維持 `{}`）。
   */
  initialDraft = null
}) {
  const rules = resolveCreationRules(creationRules);
  // 核心書技能變體是**選用**的：只有【開放公測修訂內容】勾起來才顯示。
  // ※ 選用後**原版技能收起來**（GM 裁定 2026-10-14），由玩家自己按——見 coreBookVariants.js。
  // ※ 2026-10-19 起改由 `rules.allowPlaytest` 單一判定（§BE）——
  //   公測是規則開關，不是一本手冊，所以不再看 `enabledBooks`。
  const showVariants = rules.allowPlaytest === true;
  const [search, setSearch] = useState('');
  const [activeClassName, setActiveClassName] = useState(initialClassName || null);
  /**
   * 這一次挑選的草稿：`{ 職業名: { 技能名: 級數 } }`。
   * **跨職業累積**——這是流程重構的核心，舊版只存「當前職業」那一份，
   * 所以一次只能確定一個職業。
   */
  const [draft, setDraft] = useState(initialDraft || {});
  /**
   * 變體選用草稿：`{ 職業名: { 原版技能名: 變體id } }`。
   * **與配點草稿分開**——因為配點是按「確定」才寫入，而變體選用也是。
   * 但兩者的 key 不同層（一個是技能、一個是變體），硬塞進同一個字典會讓兩邊都很難讀。
   */
  const [draftVariants, setDraftVariants] = useState({});
  // 手機端導航步驟：'list' (挑選名冊) | 'detail' (技能加點與確認)
  const [mobileStep, setMobileStep] = useState('list');

  // 取得所有可用職業清單
  // ※ 公測修訂**由規則把關**（§BE）：即使呼叫端傳來的 `enabledBooks` 還留著 playtest
  //   （舊角色的殘留資料），只要【開放公測修訂內容】沒勾，秘儀師【變體】就不該出現。
  //   這是一層縱深防禦——生產端的 `CharacterEditor` 已經先算過一次。
  const availableClasses = useMemo(() => {
    const list = Object.keys(SOURCEBOOKS)
      .filter(sbKey => enabledBooks.includes(sbKey))
      .filter(sbKey => rules.allowPlaytest || sbKey !== PLAYTEST_SOURCEBOOK_KEY)
      .flatMap(sbKey => {
        const book = SOURCEBOOKS[sbKey];
        return (book.classes || []).map(cName => ({
          className: cName,
          bookKey: sbKey,
          bookName: book.shortName || book.name,
          badgeColor: book.badgeColor || 'amber',
          info: getClassInfo(cName),
          def: withSuppressedSkillsFiltered(rulesData.classes[cName] || {}, rules.technospheres)
        }));
      })
      .filter(item => item.def && (item.def.skills || item.def.source));

    const seen = new Set();
    return list.filter(item => {
      if (seen.has(item.className)) return false;
      seen.add(item.className);
      return true;
    });
  }, [enabledBooks, rules.allowPlaytest, rules.technospheres]);

  // 搜尋過濾
  //
  // 比對範圍（含**官方別稱**）集中在資料層的 `matchesClassQuery`——
  // 官方原書在每個職業頁印了一行「ALSO:」（例：遊蕩者也叫強盜／忍者／盜賊），
  // 那些別稱同樣要能被搜到，見 `data/classAliases.js`。
  // ※ 抽成純函式放資料層的理由：`filter()` 回呼裡的邏輯 SSR 測不到（`AGENTS.md` §AW9）。
  const filteredClasses = useMemo(
    () => availableClasses.filter((c) => matchesClassQuery(c, search)),
    [availableClasses, search]
  );

  /** 某個職業在草稿裡的技能表（沒有就補一份全 0 的） */
  const draftSkillsOf = (cName) => {
    if (!cName) return {};
    if (draft[cName]) return draft[cName];
    const map = {};
    ((rulesData.classes[cName] || {}).skills || []).forEach(sk => { map[sk.name] = 0; });
    return map;
  };

  /** 把某個職業加進草稿（全 0）並切換到它 */
  const focusClass = (cName) => {
    setActiveClassName(cName);
    setDraft(prev => (prev[cName] ? prev : { ...prev, [cName]: draftSkillsOf(cName) }));
    setMobileStep('detail');
  };

  // 彈窗開啟／關閉時的狀態管理
  useEffect(() => {
    if (isOpen) {
      setMobileStep('list');
      if (!activeClassName || !availableClasses.some(c => c.className === activeClassName)) {
        const firstAvailable = availableClasses.find(c => !existingClassNames.includes(c.className));
        if (firstAvailable) focusClass(firstAvailable.className);
      }
    } else {
      // 關掉就整份草稿清空——沒有「確定」的配點不該留著
      setActiveClassName(null);
      setDraft({});
      setDraftVariants({});
      setSearch('');
      setMobileStep('list');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // 拓展切換時若當前職業被停用，自動切換到下一個可用職業（草稿保留）
  useEffect(() => {
    if (isOpen && activeClassName && !availableClasses.some(c => c.className === activeClassName)) {
      const firstAvailable = availableClasses.find(c => !existingClassNames.includes(c.className));
      if (firstAvailable) focusClass(firstAvailable.className);
      else setActiveClassName(null);
    }
  }, [availableClasses, isOpen, activeClassName, existingClassNames]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeClassItem = useMemo(() => {
    if (!activeClassName) return null;
    return availableClasses.find(c => c.className === activeClassName);
  }, [availableClasses, activeClassName]);

  const activeDraftSkills = draftSkillsOf(activeClassName);

  /** 某個職業投入了幾級 */
  const allocatedOf = (cName) => Object.values(draft[cName] || {}).reduce((s, v) => s + v, 0);

  /** 這次挑選的總投入 */
  const draftTotal = useMemo(
    () => Object.values(draft).reduce(
      (sum, skills) => sum + Object.values(skills).reduce((a, b) => a + b, 0), 0
    ),
    [draft]
  );

  /** 這次有配點的職業（徽章列與確定都用它；依名冊順序，不會跳來跳去） */
  const assignedEntries = useMemo(
    () => availableClasses
      .filter(c => allocatedOf(c.className) >= 1)
      .map(c => ({ className: c.className, total: allocatedOf(c.className), info: c.info })),
    [availableClasses, draft] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const remainingBudget = Math.max(0, rules.skillPointBudget - budgetUsed);
  const classesAfter = existingClassNames.length + assignedEntries.length;
  const countOk = classesAfter >= rules.classCountMin && classesAfter <= rules.classCountMax;
  const budgetOk = draftTotal >= 1 && draftTotal <= remainingBudget;
  const canConfirm = countOk && budgetOk;

  // 調整技能等級（寫進當前職業那一份草稿）
  const handleSetSkillSL = (skillName, newSL) => {
    if (!activeClassName) return;
    setDraft(prev => ({
      ...prev,
      [activeClassName]: {
        ...(prev[activeClassName] || draftSkillsOf(activeClassName)),
        [skillName]: Math.max(0, newSL)
      }
    }));
  };

  /** 某個技能在草稿裡選用了哪個變體（null＝用原版） */
  const activeVariantOf = (skillName) => (draftVariants[activeClassName] || {})[skillName] || null;

  /**
   * 選用／取消選用變體（草稿）。
   *
   * ※ 這裡是**創角流程**，草稿按「確定」才寫入——與 `ClassSkillCard` 的編輯模式不同
   *   （那邊是已存在的角色，選用立即生效）。同一個概念在兩處有不同時序，是刻意的：
   *   創角時整包一起決定，改卡時單項即時生效。
   */
  const handleToggleVariant = (skillName, variantId) => {
    if (!activeClassName) return;
    setDraftVariants(prev => {
      const forClass = { ...(prev[activeClassName] || {}) };
      if (variantId) forClass[skillName] = variantId;
      else delete forClass[skillName];
      return { ...prev, [activeClassName]: forClass };
    });
  };

  /** 把草稿轉成 `onSelectClasses` 要的形狀 */
  const handleConfirm = () => {
    if (!canConfirm) return;
    const entries = assignedEntries.map(({ className }) => {
      const allSkills = (rulesData.classes[className] || {}).skills || [];
      const forClassVariants = draftVariants[className] || {};
      const skills = [];
      allSkills.forEach(sk => {
        const sl = draft[className]?.[sk.name] || 0;
        if (sl > 0) {
          // ※ 別忘了 `variantId`——漏了它，玩家在創角時選的變體會在按下確定後消失。
          //   上限也要用「當前版本」的：選用變體後是變體的上限（【暴怒】5 →【勇猛打手】3）。
          //   邏輯集中在 `buildSkillEntry`（純函式，可單測）。
          skills.push(buildSkillEntry(sk.name, sl, {
            variantId: forClassVariants[sk.name] || null,
            originalMaxSL: sk.maxSL
          }));
        }
      });
      return { className, skills };
    }).filter(e => e.skills.length > 0);
    if (entries.length === 0) return;
    onSelectClasses(entries);
    onClose();
  };

  const allBooksOn = BOOK_KEYS.every(k => enabledBooks.includes(k));

  /**
   * **測試注入點**（生產端永不傳入）：`panelOnly` 為 true 時跳過彈窗外框。
   *
   * 為什麼需要：`JRPGModal` 內部是 `createPortal` ＋ 一個 `mounted` effect，
   * 而 **SSR 不執行 effect**，所以整個彈窗內容在 SSR 一律渲染成 null——
   * 等於底下五百多行 JSX 一道護欄都沒有（`AGENTS.md` §AW9 的「加測試注入點」）。
   * **不傳時走原本的 `JRPGModal`，行為逐字不變。**
   */
  const Panel = panelOnly ? React.Fragment : JRPGModal;

  return (
    <Panel
      {...(panelOnly ? {} : {
        isOpen,
        onClose,
        title: '選擇職業與技能分配',
        maxWidth: 'max-w-5xl'
      })}
    >
      <div className="flex flex-col h-[82vh] md:h-[76vh] max-h-[730px] overflow-hidden -m-1">
        {/* ==================== 頂部上排：拓展開關 ＋ 已選職業配點 ==================== */}
        <div
          className="px-3 py-2 rounded-xl border flex flex-col gap-2 transition-colors mb-2.5 shrink-0"
          style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.textDark }}>
              <GiSpellBook className="w-3.5 h-3.5" style={{ color: theme.accent }} />
              官方拓展職業:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 使用者要求：開一個「全部」，而且預設就是全部，免得切來切去 */}
              <button
                type="button"
                onClick={() => onSetSourcebooks && onSetSourcebooks([...BOOK_KEYS])}
                className="text-xs px-2.5 py-1 rounded-lg border font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                style={
                  allBooksOn
                    ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#ffffff' }
                    : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
                }
                title="一次開啟全部手冊（預設）"
              >
                {allBooksOn ? <GiCheckMark className="w-3 h-3" /> : null}
                <span>全部</span>
              </button>

              {BOOK_KEYS.map(sbKey => {
                const sb = SOURCEBOOKS[sbKey];
                const isEnabled = enabledBooks.includes(sbKey);

                return (
                  <button
                    key={sbKey}
                    type="button"
                    onClick={() => onToggleSourcebook && onToggleSourcebook(sbKey)}
                    className="text-xs px-2.5 py-1 rounded-lg border font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    style={
                      isEnabled
                        ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#ffffff' }
                        : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
                    }
                  >
                    {isEnabled ? <GiCheckMark className="w-3 h-3" /> : null}
                    <span>{sb.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 已選職業與配點：點徽章跳去那個職業；右上角角標＝投入等級 */}
          <div
            className="flex items-center gap-1.5 flex-wrap pt-2 border-t"
            style={{ borderColor: theme.border }}
          >
            <span className="text-[11px] font-bold shrink-0" style={{ color: theme.textMuted }}>
              已選職業：
            </span>
            {assignedEntries.length === 0 ? (
              <span className="text-[11px]" style={{ color: theme.textMuted }}>
                還沒配點——在右邊點技能加號，可以連續挑好幾個職業再一起確定
              </span>
            ) : (
              assignedEntries.map(({ className, total, info }) => {
                const isActive = activeClassName === className;
                return (
                  <button
                    key={className}
                    type="button"
                    onClick={() => focusClass(className)}
                    title={`${className}：投入 ${total} 級（點一下跳到它）`}
                    className="relative flex items-center gap-1 pl-1.5 pr-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all active:scale-95"
                    style={
                      isActive
                        ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#ffffff' }
                        : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
                    }
                  >
                    <GameIcon name={info?.icon || className} size={13} />
                    <span className="truncate max-w-[7rem]">{className}</span>
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-mono font-black flex items-center justify-center border"
                      style={{
                        backgroundColor: theme.accentDark || theme.accent,
                        borderColor: theme.panelBg,
                        color: '#ffffff'
                      }}
                    >
                      {total}
                    </span>
                  </button>
                );
              })
            )}
            <span className="text-[11px] font-mono font-bold ml-auto shrink-0" style={{ color: theme.textMuted }}>
              這次配了 {draftTotal} 級 ／ 還能配 {remainingBudget} 級
            </span>
          </div>
        </div>

        {/* 雙欄主容器：左側名冊與右側詳情 */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 flex-1 min-h-0 overflow-hidden">
          {/* ================= 左側欄：職業名冊與搜尋 (手機端步驟 1) ================= */}
          <div
            className={`w-full md:w-72 lg:w-80 shrink-0 flex-col border-b md:border-b-0 md:border-r pr-0 md:pr-3 pb-2 md:pb-0 h-full overflow-hidden ${
              mobileStep === 'list' ? 'flex' : 'hidden md:flex'
            }`}
            style={{ borderColor: theme.border }}
          >
          {/* 手機端步驟引導 */}
          <div className="flex md:hidden items-center justify-between pb-1.5 mb-1 text-[#6b5a4b]">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <GiSparkles className="w-3.5 h-3.5 text-[#6b5a4b]" />
              步驟 1/2：請點選欲修習的職業
            </span>
            <span className="text-[11px] font-mono text-[#6b5a4b]">
              共 {filteredClasses.length} 職
            </span>
          </div>

          {/* 搜尋欄位 */}
          <div className="relative mb-2.5 shrink-0">
            <GiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b5a4b] w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋職業名稱（中文 / 英文 / 別稱 / 特性關鍵字）..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border outline-none font-sans shadow-inner transition-colors"
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
                color: theme.textDark
              }}
            />
          </div>

          {/* 職業清單（單一滾動容器，絕不卡死） */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {filteredClasses.map((item) => {
              const isSelected = activeClassName === item.className;
              const isAdded = existingClassNames.includes(item.className);
              const allocated = allocatedOf(item.className);

              return (
                <div
                  key={item.className}
                  onClick={() => {
                    if (!isAdded) focusClass(item.className);
                  }}
                  className={`relative p-2.5 rounded-xl border transition-all text-left flex flex-col gap-1.5 cursor-pointer select-none ${
                    isAdded
                      ? 'opacity-40 bg-[#f4ebd9]/60 border-[#d6c7ab] cursor-not-allowed'
                      : isSelected
                        ? 'ring-2 shadow-sm scale-101'
                        : 'hover:border-[#7c6a58] hover:shadow-2xs active:scale-98'
                  }`}
                  style={{
                    backgroundColor: isSelected ? theme.subpanelBg : theme.cardBg,
                    borderColor: isSelected ? theme.accent : theme.border,
                    '--tw-ring-color': theme.accent
                  }}
                >
                  {/* 這個職業已經配了幾級（跟上面的徽章同一個數字，方便對照） */}
                  {allocated > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-black flex items-center justify-center border"
                      style={{ backgroundColor: theme.accent, borderColor: theme.panelBg, color: '#ffffff' }}
                    >
                      {allocated}
                    </span>
                  )}

                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: theme.panelBg,
                          borderColor: theme.border,
                          color: theme.accent
                        }}
                      >
                        <GameIcon name={item.info.icon || item.className} size={16} />
                      </div>
                      <div className="min-w-0">
                        {/* 職業標題：withEn() 已含「中文 · ENGLISH」並列（規範 §2-3），
                            不再外加 info.en，否則會重複顯示英文（清單變成「暗黑之刃 · DARKBLADE\nDARKBLADE」）。 */}
                        <div className="font-serif font-black text-xs text-[#3c2415] truncate">
                          {withEn(item.className)}
                        </div>
                        {/* 官方別稱（原書職業頁的「ALSO:」行）。沒有的一律不顯示，不補佔位符。 */}
                        {formatClassAliases(item.className) && (
                          <div
                            className="text-[10px] text-[#6b5a4b] truncate"
                            title={classAliasSource(item.className) || undefined}
                          >
                            又稱：{formatClassAliases(item.className)}
                          </div>
                        )}
                      </div>
                    </div>

                    <JRPGBadge variant={item.badgeColor} size="xs">
                      {item.bookName}
                    </JRPGBadge>
                  </div>

                  {/* 免費增益摘要標籤 */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#e8dcc4] font-mono">
                    <span className="text-[#3c2415] font-bold truncate bg-[#f4ebd9] px-1.5 py-0.5 rounded" title={item.def.freeBonus}>
                      {item.def.freeBonus || ''}
                    </span>
                    {isAdded ? (
                      <span className="text-[#6b5a4b] font-bold">已修習</span>
                    ) : (
                      <span className="text-[#6b5a4b] font-bold flex items-center gap-0.5">
                        <span className="text-[11px]">配點</span> →
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= 右側欄：職業詳情、技能分配與確認操作 (手機端步驟 2) ================= */}
        <div
          className={`flex-1 min-w-0 flex-col justify-between pl-0 md:pl-2 h-full overflow-hidden ${
            mobileStep === 'detail' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeClassItem ? (
            <div className="flex-1 flex flex-col overflow-hidden space-y-2.5 sm:space-y-3 min-h-0">
              {/* 手機端專屬頂部返回按鈕 */}
              <div className="flex md:hidden items-center justify-between pb-1.5 border-b shrink-0" style={{ borderColor: theme.border }}>
                <button
                  type="button"
                  onClick={() => setMobileStep('list')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3c2415] bg-[#f4ebd9] hover:bg-[#e8dcc4] active:scale-95 px-3 py-1.5 rounded-lg border border-[#d6c7ab] transition-all cursor-pointer"
                >
                  <span>← 選擇其它職業</span>
                </button>
                <span className="text-xs font-bold text-[#6b5a4b] font-mono">步驟 2/2：技能分配</span>
              </div>

              {/* 頂部職業標題與風格敘述 */}
              <div
                className="p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-3 shrink-0 shadow-2xs"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-xs"
                    style={{
                      backgroundColor: theme.cardBg,
                      borderColor: theme.border,
                      color: theme.accent
                    }}
                  >
                    <GameIcon name={activeClassItem.info.icon || activeClassItem.className} size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 職業標題：withEn() 已含「中文 · ENGLISH」並列（規範 §2-3），
                          不再外加 / {info.en}，否則會變成「暗黑之刃 · DARKBLADE / DARKBLADE」重複。 */}
                      <h3 className="font-serif font-black text-base" style={{ color: theme.textDark }}>
                        {withEn(activeClassItem.className)}
                      </h3>
                      <JRPGBadge variant={activeClassItem.badgeColor} size="xs">
                        {activeClassItem.bookName}
                      </JRPGBadge>
                    </div>
                    <p className="text-xs text-[#6b5a4b] italic mt-0.5 truncate">
                      {activeClassItem.info.tagline}
                    </p>
                    {/* 官方別稱 ＋ 出處頁碼：原書每個職業頁標題下的「ALSO:」行。
                        出處一定要跟著顯示——沒有出處的別稱無法回溯核對（比照 NPC 檢定的規矩）。 */}
                    {formatClassAliases(activeClassItem.className) && (
                      <p className="text-t12 mt-0.5 truncate" style={{ color: theme.textDark }}>
                        <span className="font-bold">又稱</span>
                        <span className="mx-1">·</span>
                        {formatClassAliases(activeClassItem.className)}
                        <span className="text-[#6b5a4b] ml-2 font-mono text-[10px]">
                          ※ {classAliasSource(activeClassItem.className)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 滾動內容容器：包含職業免費增益、技能指引與 5 項技能（隨頁面一同平滑滾動） */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 min-h-0">
                {/* 職業免費增益區塊 */}
                <div
                  className="p-2.5 sm:p-3 rounded-xl border space-y-1 shadow-2xs"
                  style={{ backgroundColor: theme.subpanelBg, borderColor: theme.accent }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: theme.textDark }}>
                      <GiSparkles className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      職業免費增益
                    </span>
                    {activeClassItem.def.freeBonus && (
                      <span className="text-xs font-mono font-bold text-[#2c221e] bg-[#e8dcc4] border border-[#d6c7ab] px-2 py-0.5 rounded">
                        <SkillDescription desc={activeClassItem.def.freeBonus} />
                      </span>
                    )}
                  </div>
                  {activeClassItem.def.freeBenefits && (
                    <p className="text-xs sm:text-[13px] text-[#3c2415] leading-relaxed font-sans">
                      <SkillDescription desc={activeClassItem.def.freeBenefits} />
                    </p>
                  )}
                </div>

                {/* 職業技能清單指示標題 */}
                <div className="flex items-center justify-between text-xs text-[#6b5a4b] pt-1 px-0.5">
                  <span className="font-bold">
                    職業技能清單（點擊星星或加號分配等級）：
                  </span>
                  <span className="font-mono font-bold text-[#6b5a4b]">
                    5 項技能任選
                  </span>
                </div>

                {/* 5 項技能卡片 */}
                {(activeClassItem.def.skills || []).map((sk) => {
                  const currentSL = activeDraftSkills[sk.name] || 0;
                  // 選用變體後：這一列顯示變體的名稱／描述，原版收起來（GM 裁定）。
                  const pickedVariantId = showVariants ? activeVariantOf(sk.name) : null;
                  const pickedVariant = getVariantById(pickedVariantId);
                  const maxSL = pickedVariant ? (pickedVariant.maxSL || sk.maxSL || 5) : (sk.maxSL || 5);

                  return (
                    <div
                      key={sk.name}
                      className="p-2.5 sm:p-3 rounded-xl border space-y-2 shadow-2xs"
                      style={{
                        backgroundColor: currentSL > 0 ? theme.subpanelBg : theme.cardBg,
                        borderColor: pickedVariant
                          ? theme.accent
                          : (currentSL > 0 ? theme.accent : theme.border)
                      }}
                    >
                      {/* 手機版直向堆疊：技能名自己一行、控制項在下面。
                          原本是 `flex-wrap` 的橫向列，但技能名是可壓縮的 flex 項目——
                          在窄螢幕上（尤其 SL 星星多的技能，例如【咒語模仿】5 顆）
                          名字會被擠到逐字換行，變成很難讀的直排。
                          加上 `whitespace-nowrap shrink-0` 讓名字永不被壓縮。 */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span
                          className="font-serif font-black text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 flex-wrap"
                          style={{ color: theme.textDark }}
                        >
                          {pickedVariant ? pickedVariant.name : sk.name}
                          {pickedVariant && (
                            <>
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab]">
                                △ 公測
                              </span>
                              <span className="text-[10px] text-[#6b5a4b] font-bold">
                                取代【{sk.name}】
                              </span>
                            </>
                          )}
                        </span>

                        <div className="flex items-center gap-2 flex-wrap">
                          <SkillStarPips
                            currentSL={currentSL}
                            maxSL={maxSL}
                            onChange={(v) => handleSetSkillSL(sk.name, v)}
                          />
                          <div className="flex items-center gap-1 font-mono">
                            <button
                              type="button"
                              onClick={() => handleSetSkillSL(sk.name, currentSL - 1)}
                              disabled={currentSL <= 0}
                              className="w-6 h-6 rounded border flex items-center justify-center font-bold text-xs disabled:opacity-20 hover:bg-white active:scale-95 transition-all cursor-pointer"
                              style={{ borderColor: theme.border, color: theme.textDark }}
                              title={currentSL <= 0 ? '已經是最低（SL 0）' : '減少 1 級'}
                            >
                              −
                            </button>
                            <span className="w-6 text-center font-black text-sm" style={{ color: theme.textDark }}>
                              {currentSL}
                            </span>
                            {/* ※ 這顆 `+` 的 `title` 必須隨狀態改變。
                                2026-10-20 實測（playtest F-006）：到達 SL 上限後按鈕只是
                                `disabled:opacity-20` 變淡，`title` 卻還寫著「增加 1 級」——
                                新手看到的是「一顆淡掉的加號 + 一句『增加 1 級』」，
                                唯一的解釋是「壞了」。專案自己的原則（`docs/decisions.md` §U）
                                是「不能選的原因要在選之前看見」，所以理由要寫在 `title` 裡。 */}
                            <button
                              type="button"
                              onClick={() => handleSetSkillSL(sk.name, currentSL + 1)}
                              disabled={currentSL >= maxSL}
                              className="w-6 h-6 rounded border flex items-center justify-center font-bold text-xs disabled:opacity-20 hover:bg-white active:scale-95 transition-all cursor-pointer"
                              style={{ borderColor: theme.border, color: theme.textDark }}
                              title={currentSL >= maxSL
                                ? `已達此技能的 SL 上限（${maxSL}）——請把剩下的等級分配給其他技能`
                                : '增加 1 級'}
                            >
                              +
                            </button>
                          </div>
                          {/* `title` 要 hover 才看得到，新手不會去 hover 一顆灰掉的按鈕。
                              所以理由**同時**寫在畫面上。只在真的滿級時出現，不佔平時的版面。 */}
                          {currentSL >= maxSL && (
                            <span className="text-[10px] font-bold text-[#3c2415] bg-[#f9f5eb] border border-[#d6c7ab] rounded px-1.5 py-0.5 whitespace-nowrap">
                              已達上限 {maxSL}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 需求：技能規則說明字體放大
                          ※ 選用變體後顯示變體描述；原版描述收起來。 */}
                      <div className="text-xs sm:text-[13px] text-[#3c2415] leading-relaxed font-sans pl-3 border-l-2 border-[#d6c7ab]">
                        <SkillDescription
                          desc={pickedVariant ? pickedVariant.desc : sk.desc}
                          sl={currentSL}
                        />
                        {pickedVariant && (
                          <div className="mt-1 text-[10px] text-[#6b5a4b] font-bold">
                            原版〈{sk.name}〉暫不適用（已由【{pickedVariant.name}】取代）
                          </div>
                        )}
                      </div>

                      {/* 這個技能有變體可選 → 開一顆切換鈕。
                          ※ 只在勾選【官方公測修訂】時出現。
                          ※ 已配點也照樣可以選：選用會沿用目前的級數。 */}
                      {showVariants && getVariantsForClass(activeClassItem.className)
                        .filter(v => v.replaces === sk.name)
                        .map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleToggleVariant(sk.name, pickedVariantId === v.id ? null : v.id)}
                            className="w-full text-left text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all active:scale-[.99] cursor-pointer flex items-center gap-1.5"
                            style={
                              pickedVariantId === v.id
                                ? { backgroundColor: theme.accent, borderColor: theme.accentDark || theme.accent, color: '#ffffff' }
                                : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
                            }
                            title={pickedVariantId === v.id ? '改回原版技能' : `選用【${v.name}】取代【${sk.name}】`}
                          >
                            {pickedVariantId === v.id ? <GiCheckMark className="w-3 h-3 shrink-0" /> : <GiSparkles className="w-3 h-3 shrink-0" />}
                            <span>{pickedVariantId === v.id ? `使用中：${v.name}（點此改回原版）` : `選用公測變體【${v.name}】`}</span>
                          </button>
                        ))}
                    </div>
                  );
                })}

                {/* 核心書技能變體——**沒有對應原版技能**的那些（例如無人能用的新技能）。
                    有 `replaces` 的已在上面各技能卡片裡就地選用，這裡只列剩下的，
                    避免同一個變體出現兩次、出現兩個入口。 */}
                {showVariants && getVariantsForClass(activeClassItem.className)
                  .filter(v => {
                    const skillNames = (activeClassItem.def.skills || []).map(s => s.name);
                    return !skillNames.includes(v.replaces);
                  })
                  .map((v) => (
                    <CoreBookVariantCard key={v.id} variant={v} theme={theme} />
                  ))}

                {/* 精通這個職業之後能解鎖哪些英雄技能——放在**職業技能下面**，
                    預設收合、按鈕展開（使用者定調：它是選職業的參考，不是常駐面板）。
                    純瀏覽，沒有選用鈕；定稿後整塊收起來。 */}
                <ClassHeroicSkillsBlock
                  className={activeClassItem.className}
                  theme={theme}
                  locked={locked}
                />
              </div>

              {/* ================= 底部確認操作列（手機端吸底，大拇指單手操作） ================= */}
              <div
                className="pt-2.5 sm:pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 shrink-0 bg-[#fffdf9]"
                style={{ borderColor: theme.border }}
              >
                {/* 投入等級統計與正確認知規則引導 */}
                <div className="text-xs space-y-0.5 text-center sm:text-left w-full sm:w-auto">
                  <div className="font-bold flex items-center justify-center sm:justify-start gap-1.5" style={{ color: theme.textDark }}>
                    <span>這次總共投入：</span>
                    <strong className={`font-mono text-sm px-1.5 py-0.2 rounded ${
                      draftTotal === 0
                        ? 'text-[#6b5a4b] bg-[#f4ebd9]'
                        : !budgetOk
                          ? 'text-[#8c2d36] bg-[#f4ebd9]'
                          : 'text-[#3c2415] bg-[#f4ebd9]'
                    }`}>
                      {draftTotal} 級
                    </strong>
                    <span className="text-[#6b5a4b] font-normal">
                      （{assignedEntries.length} 個職業）
                    </span>
                  </div>
                  <p className="text-t12 text-[#6b5a4b]">
                    {draftTotal === 0 ? (
                      <span className="text-[#6b5a4b]">請至少為一個職業分配 1 級技能</span>
                    ) : draftTotal > remainingBudget ? (
                      <span className="text-[#8c2d36] font-bold flex items-center justify-center sm:justify-start gap-1">
                        <GiHazardSign className="w-3.5 h-3.5 shrink-0" />
                        超出可分配等級：這次 {draftTotal} 級，但只剩 {remainingBudget} 級
                      </span>
                    ) : !countOk ? (
                      <span className="text-[#8c2d36] font-bold flex items-center justify-center sm:justify-start gap-1">
                        <GiHazardSign className="w-3.5 h-3.5 shrink-0" />
                        確定後會有 {classesAfter} 個職業，開局規定是 {rules.classCountMin}~{rules.classCountMax} 個
                      </span>
                    ) : (
                      <span>
                        確定後共 {classesAfter} 個職業；可以在上面繼續挑別的職業再一起確定
                      </span>
                    )}
                  </p>
                </div>

                {/* 確認按鈕 */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs text-[#6b5a4b] hover:text-[#3c2415] rounded font-medium cursor-pointer"
                  >
                    取消
                  </button>

                  <JRPGButton
                    variant={theme.buttonVariant || 'primary'}
                    size="sm"
                    icon={canConfirm ? GiCheckMark : GiSparkles}
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className="w-full sm:w-auto min-h-[38px]"
                  >
                    {draftTotal === 0
                      ? '請先分配技能等級'
                      : !budgetOk
                        ? '等級超出上限'
                        : !countOk
                          ? `開局需兼修 ${rules.classCountMin}~${rules.classCountMax} 個職業`
                          : `確定修習 ${assignedEntries.length} 個職業（共 ${draftTotal} 級）`}
                  </JRPGButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#6b5a4b] space-y-2">
              <GiSparkles className="w-8 h-8 opacity-40" />
              <p className="text-xs">請從左側名冊中選擇一個職業以查看其技能與免費增益。</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </Panel>
  );
}
