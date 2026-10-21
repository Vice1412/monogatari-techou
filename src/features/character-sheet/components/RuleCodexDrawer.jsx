import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  GiSpellBook,
  GiSparkles,
  GiCauldron,
  GiGearHammer,
  GiPawPrint,
  GiScrollQuill,
  GiCoins,
  GiShield,
  GiBroadsword
} from 'react-icons/gi';
import { X, Search } from 'lucide-react';
import {
  GiMusicalNotes,
  GiSonicShoes,
  GiQuillInk,
  GiFlowerPot,
  GiCookingPot,
  GiStoneSphere,
  GiBrain,
  GiWolfHead,
  GiSteeringWheel,
  GiCrystalShine,
  GiCardPlay
} from 'react-icons/gi';
import { RULE_CODEX, findCodexRule } from '../data/ruleCodexData';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';

/**
 * 分頁所屬的原書 —— 直接由 `RULE_CODEX[id].page` 推導
 * （例：「高度奇幻手冊 138~139 頁」→「高度奇幻手冊」），不另外維護對照表，免得新增條目時漏改。
 */
const bookOfCodex = (id) => String(RULE_CODEX[id]?.page || '').split(/\s+/)[0];

export default function RuleCodexDrawer({
  isOpen: propIsOpen,
  onClose: propOnClose,
  initialRuleId = null
}) {
  const [mounted, setMounted] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [activeRuleId, setActiveRuleId] = useState('arcana');
  const [searchTerm, setSearchTerm] = useState('');
  const contentScrollRef = useRef(null);
  const activeTabRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 當切換標籤頁或開啟速查時，確保滾動容器回到最頂端
  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [activeRuleId, internalIsOpen]);

  // 由技能關鍵詞深連結開啟時（例：點技能裡的「魔法種子」跳到花園），把當前分頁捲進視野——
  // 窄視窗的分頁列仍是橫向滑動的，不捲的話使用者看不到自己被切到哪一頁。
  useEffect(() => {
    if (!internalIsOpen) return;
    activeTabRef.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [internalIsOpen, activeRuleId]);

  // 分頁列在窄視窗仍需橫向捲動時，讓滑鼠滾輪直接左右滑（原本只能去拖那條細捲軸）。
  const handleTabStripWheel = (e) => {
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    el.scrollLeft += e.deltaY;
  };

  // 支援全域事件 fu:open-rule-codex
  useEffect(() => {
    const handleGlobalOpen = (e) => {
      const { ruleId, keyword } = e.detail || {};
      if (ruleId && RULE_CODEX[ruleId]) {
        setActiveRuleId(ruleId);
      } else if (keyword) {
        const found = findCodexRule(keyword);
        if (found) {
          setActiveRuleId(found.id);
        }
      }
      setInternalIsOpen(true);
    };

    window.addEventListener('fu:open-rule-codex', handleGlobalOpen);
    return () => window.removeEventListener('fu:open-rule-codex', handleGlobalOpen);
  }, []);

  // 監聽 prop 變化
  useEffect(() => {
    if (propIsOpen !== undefined) {
      setInternalIsOpen(propIsOpen);
    }
  }, [propIsOpen]);

  useEffect(() => {
    if (initialRuleId && RULE_CODEX[initialRuleId]) {
      setActiveRuleId(initialRuleId);
    }
  }, [initialRuleId]);

  // ESC 鍵關閉與鎖定背景滾動
  useEffect(() => {
    if (!internalIsOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = originalOverflow;
    };
  }, [internalIsOpen]);

  const handleClose = () => {
    setInternalIsOpen(false);
    setSearchTerm('');
    if (propOnClose) propOnClose();
  };

  if (!internalIsOpen || !mounted || typeof document === 'undefined') return null;

  const currentRule = RULE_CODEX[activeRuleId] || RULE_CODEX.arcana;

  // 分頁順序＝原書的章節順序（核心 → 高度 → 自然 → 科技 → 特典）。
  const navItems = [
    { id: 'arcana', label: '阿爾卡納', icon: GiSparkles },
    { id: 'rituals', label: '儀式', icon: GiScrollQuill },
    { id: 'gadgets', label: '小工具', icon: GiCauldron },
    { id: 'projects', label: '造物專案', icon: GiGearHammer },
    { id: 'companion', label: '忠實夥伴', icon: GiPawPrint },
    { id: 'spellbooks', label: '核心法術書', icon: GiSpellBook },
    { id: 'chanter', label: '樂句與音調', icon: GiMusicalNotes },
    { id: 'dancer', label: '舞步', icon: GiSonicShoes },
    { id: 'symbolist', label: '徽記', icon: GiQuillInk },
    { id: 'floralist', label: '花園與魔法種子', icon: GiFlowerPot },
    { id: 'gourmet', label: '食材與美食', icon: GiCookingPot },
    { id: 'invoker', label: '元素源泉', icon: GiStoneSphere },
    { id: 'esper', label: '天賦', icon: GiBrain },
    { id: 'mutant', label: '混合形態', icon: GiWolfHead },
    { id: 'pilot', label: '個人載具', icon: GiSteeringWheel },
    { id: 'technospheres', label: '魔晶石', icon: GiCrystalShine },
    { id: 'aceOfCards', label: '牌組與組合', icon: GiCardPlay },
    // 公測修訂（§BF）：變體秘儀師的阿爾卡納規則與核心版並存，不互相覆寫。
    { id: 'arcanaVariant', label: '阿爾卡納（變體）', icon: GiSparkles }
  ];

  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* 點擊遮罩背景 */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs animate-backdrop-fade"
        onClick={handleClose}
      />

      {/* 居中焦點典籍卡片 */}
      <div
        className="relative w-full max-w-3xl bg-[#fffdf9] dark:bg-slate-900 border-2 border-[#d6c7ab] dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[88vh] text-[#2c221e] dark:text-stone-200 animate-modal-pop z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 頂部裝飾條 */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 shrink-0" />

        {/* 典籍標題 Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-amber-50 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center space-x-2.5">
            <GiSpellBook className="text-2xl text-amber-200" />
            <div>
              <h2 className="text-base font-black tracking-wide flex items-center gap-2">
                <span>規則概念速查</span>
                <span className="text-xs font-normal text-amber-200/90 font-mono bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30">
                  {currentRule.page}
                </span>
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-amber-800/80 transition-colors"
            title="關閉速查 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 類別切換標籤頁 (Tabs)
            18 個分頁在 max-w-3xl 的面板裡排不進一列。sm 以上改成自動換行（全部可見、零橫向捲動，
            並以細分隔線標出原書分界）；手機維持單列橫向滑動，另讓滑鼠滾輪也能左右滑。 */}
        <div
          className="flex flex-nowrap sm:flex-wrap items-center gap-1 p-2 bg-[#f4ece1] dark:bg-slate-950 border-b border-[#e2d5c3] dark:border-slate-800 overflow-x-auto sm:overflow-x-visible shrink-0"
          onWheel={handleTabStripWheel}
        >
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeRuleId === item.id;
            const book = bookOfCodex(item.id);
            const startsBook = idx > 0 && book !== bookOfCodex(navItems[idx - 1].id);
            return (
              <React.Fragment key={item.id}>
                {startsBook && (
                  <span
                    aria-hidden
                    className="shrink-0 w-px self-stretch my-1 mx-1 bg-[#d9cbb4] dark:bg-slate-700"
                  />
                )}
                <button
                  type="button"
                  ref={isActive ? activeTabRef : undefined}
                  title={RULE_CODEX[item.id]?.page}
                  onClick={() => {
                    setActiveRuleId(item.id);
                    setSearchTerm('');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-[#eae0d2] dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="text-sm" />
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* 內容主滾動容器 */}
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-[#2c221e] dark:text-stone-200 text-xs sm:text-sm leading-relaxed">
          {/* 當前概念頭銜 */}
          <div className="border-b border-[#e6dbc9] dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black text-[#1a1412] dark:text-amber-100">
                {currentRule.title}
              </h1>
            </div>
            <p className="mt-2 text-stone-700 dark:text-stone-300 text-xs leading-relaxed bg-[#fbf7ee] dark:bg-slate-950/60 p-3 rounded-lg border border-[#e8ddcc] dark:border-slate-800">
              {currentRule.summary}
            </p>
          </div>

          {/* 條列規則 */}
          {currentRule.rules && currentRule.rules.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">核心運作規則：</h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 dark:text-stone-300 pl-1">
                {currentRule.rules.map((r, rIdx) => (
                  <li key={rIdx} className="leading-relaxed">
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 通用區塊渲染（擴充手冊的 11 個子系統） */}
          {currentRule.sections && (
            <div className="space-y-5">
              {currentRule.sections.map((sec, si) => (
                <div key={si} className="space-y-2">
                  <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                    {sec.title}
                  </h3>

                  {sec.kind === 'rules' && (
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 dark:text-stone-300 pl-1 leading-relaxed">
                      {sec.items.map((r, ri) => (
                        <li key={ri}>{renderTextWithAffinities(r)}</li>
                      ))}
                    </ul>
                  )}

                  {sec.kind === 'table' && (
                    <div className="overflow-x-auto rounded-xl border border-[#ded2be] dark:border-slate-700 shadow-2xs">
                      <table className="w-full text-left text-xs bg-white dark:bg-slate-800">
                        <thead className="bg-[#f5ecdf] dark:bg-slate-950 text-stone-700 dark:text-stone-300 font-bold border-b border-[#ded2be] dark:border-slate-700">
                          <tr>
                            {sec.columns.map((c, ci) => (
                              <th key={ci} className="p-2.5 whitespace-nowrap">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-slate-700">
                          {sec.rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-amber-50/40 dark:hover:bg-slate-700/50 align-top">
                              {row.map((cell, ci) => (
                                <td
                                  key={ci}
                                  className={
                                    ci === 0
                                      ? 'p-2.5 font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap align-top'
                                      : 'p-2.5 text-stone-600 dark:text-stone-400 leading-relaxed align-top'
                                  }
                                >
                                  {renderTextWithAffinities(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {sec.kind === 'cards' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      {sec.items.map((it, ii) => (
                        <div
                          key={ii}
                          className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-slate-700 pb-1">
                            <strong className="text-stone-900 dark:text-stone-100">{it.name}</strong>
                            {it.meta && (
                              <span className="text-[10px] font-mono text-amber-800 dark:text-amber-400 font-bold whitespace-nowrap">
                                {it.meta}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                            {renderTextWithAffinities(it.body)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 1. 阿爾卡納目錄展示
              核心版（9 個，無脈衝）與變體版（11 個，含脈衝）共用同一段渲染：
              判準是「這條有沒有 catalog」，不是「這條叫不叫 arcana」——
              否則每加一版阿爾卡納就要再複製一段 JSX。 */}
          {Array.isArray(currentRule.catalog) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                  {currentRule.catalogTitle || '阿爾卡納目錄'}
                </h3>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜尋阿爾卡納或領域..."
                    className="px-2.5 py-1 text-xs rounded-lg border border-[#d6c7ab] dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-800 dark:text-stone-200 pr-7 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2 top-2 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentRule.catalog
                  .filter(a => !searchTerm || a.name.includes(searchTerm) || a.domains.includes(searchTerm))
                  .map((arcana) => (
                    <div
                      key={arcana.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-700 pb-1.5">
                        <span className="font-bold text-sm text-amber-950 dark:text-amber-200">
                          {arcana.name}
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">{arcana.domains}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div>
                          <strong className="text-amber-800 dark:text-amber-400 font-bold">【連結】：</strong>
                          <span className="text-stone-700 dark:text-stone-300">{renderTextWithAffinities(arcana.merge)}</span>
                        </div>
                        {arcana.pulse && (
                          <div>
                            <strong className="text-sky-800 dark:text-sky-400 font-bold">【脈衝】：</strong>
                            <span className="text-stone-700 dark:text-stone-300">{renderTextWithAffinities(arcana.pulse)}</span>
                          </div>
                        )}
                        <div>
                          <strong className="text-rose-800 dark:text-rose-400 font-bold">【解除】：</strong>
                          <span className="text-stone-700 dark:text-stone-300">{renderTextWithAffinities(arcana.dismiss)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 2. 儀式展示 */}
          {activeRuleId === 'rituals' && (
            <div className="space-y-5">
              {/* 六大學派表格 */}
              <div className="space-y-2">
                <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                  六大學派與施法檢定
                </h3>
                <div className="overflow-x-auto rounded-xl border border-[#ded2be] dark:border-slate-700 shadow-2xs">
                  <table className="w-full text-left text-xs bg-white dark:bg-slate-800">
                    <thead className="bg-[#f5ecdf] dark:bg-slate-950 text-stone-700 dark:text-stone-300 font-bold border-b border-[#ded2be] dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 w-20">學派</th>
                        <th className="p-2.5">施法檢定</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-slate-700">
                      {currentRule.disciplines.map((d, dIdx) => (
                        <tr key={dIdx} className="hover:bg-amber-50/40 dark:hover:bg-slate-700/50">
                          <td className="p-2.5 font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">{d.name}</td>
                          <td className="p-2.5 font-mono font-bold text-amber-800 dark:text-amber-400 whitespace-nowrap">{d.formula}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 儀式五大禁忌 */}
              <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 space-y-2 shadow-2xs">
                <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                  記住，儀式魔法永遠不能完成以下任何一項：
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 dark:text-stone-300 pl-1 leading-relaxed">
                  {currentRule.restrictions.map((r, rIdx) => (
                    <li key={rIdx}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* 施法三步驟與計算表 */}
              <div className="space-y-3">
                <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                  施法流程與費用計算
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-stone-700 dark:text-stone-300 pl-1 leading-relaxed">
                  {currentRule.steps.map((s, sIdx) => (
                    <li key={sIdx}>{s}</li>
                  ))}
                </ol>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                  {/* 效力表 */}
                  <div className="overflow-x-auto rounded-xl border border-[#ded2be] dark:border-slate-700 shadow-2xs">
                    <table className="w-full text-left text-xs bg-white dark:bg-slate-800">
                      <thead className="bg-[#f5ecdf] dark:bg-slate-950 text-stone-700 dark:text-stone-300 font-bold border-b border-[#ded2be] dark:border-slate-700">
                        <tr>
                          <th className="p-2 w-12 text-center">效力</th>
                          <th className="p-2 w-12 text-center">MP</th>
                          <th className="p-2 w-12 text-center">DL</th>
                          <th className="p-2">例子</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-slate-700">
                        {currentRule.potencyTable.map((p, pIdx) => (
                          <tr key={pIdx} className="hover:bg-amber-50/40 dark:hover:bg-slate-700/50">
                            <td className="p-2 font-bold text-stone-900 dark:text-stone-100 text-center">{p.tier}</td>
                            <td className="p-2 font-mono text-amber-800 dark:text-amber-400 font-bold text-center">{p.mp}</td>
                            <td className="p-2 font-mono font-bold text-center">{p.dl}</td>
                            <td className="p-2 text-stone-600 dark:text-stone-400">{p.example}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 範圍表 */}
                  <div className="overflow-x-auto rounded-xl border border-[#ded2be] dark:border-slate-700 shadow-2xs">
                    <table className="w-full text-left text-xs bg-white dark:bg-slate-800">
                      <thead className="bg-[#f5ecdf] dark:bg-slate-950 text-stone-700 dark:text-stone-300 font-bold border-b border-[#ded2be] dark:border-slate-700">
                        <tr>
                          <th className="p-2 w-14 text-center">範圍</th>
                          <th className="p-2 w-16 text-center">MP 倍率</th>
                          <th className="p-2">例子</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-slate-700">
                        {currentRule.areaTable.map((a, aIdx) => (
                          <tr key={aIdx} className="hover:bg-amber-50/40 dark:hover:bg-slate-700/50">
                            <td className="p-2 font-bold text-stone-900 dark:text-stone-100 text-center">{a.area}</td>
                            <td className="p-2 font-mono text-amber-800 dark:text-amber-400 font-bold text-center">{a.multiplier}</td>
                            <td className="p-2 text-stone-600 dark:text-stone-400">{a.example}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 團隊檢定與減少成本 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-1.5 shadow-2xs">
                  <h4 className="font-bold text-amber-900 dark:text-amber-300 border-b border-stone-100 dark:border-slate-700 pb-1">
                    團隊檢定下的儀式魔法
                  </h4>
                  <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                    {currentRule.groupCheck}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-1.5 shadow-2xs">
                  <h4 className="font-bold text-amber-900 dark:text-amber-300 border-b border-stone-100 dark:border-slate-700 pb-1">
                    減少儀式的成本
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-stone-600 dark:text-stone-400 leading-relaxed pl-1">
                    {currentRule.costReduction.map((c, cIdx) => (
                      <li key={cIdx}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 衝突期間的儀式 */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-700 pb-1.5">
                  <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                    衝突期間的儀式
                  </h3>
                  <span className="text-xs text-stone-500 font-normal">{currentRule.conflict.intro}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {currentRule.conflict.clocks.map((c, cIdx) => (
                    <div key={cIdx} className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-center">
                      <span className="text-stone-700 dark:text-stone-300 font-bold block">{c.tier}效力</span>
                      <span className="text-amber-900 dark:text-amber-300 font-mono font-bold text-sm">{c.clock}</span>
                    </div>
                  ))}
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-stone-600 dark:text-stone-400 leading-relaxed pl-1">
                  {currentRule.conflict.steps.map((s, sIdx) => (
                    <li key={sIdx}>{s}</li>
                  ))}
                </ol>
              </div>

            </div>
          )}

          {/* 3. 小工具發明展示 */}
          {activeRuleId === 'gadgets' && (
            <div className="space-y-5">
              {/* 煉金術 */}
              {currentRule.alchemy && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-3.5 shadow-2xs">
                  <div className="border-b border-stone-100 dark:border-slate-700 pb-2">
                    <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm flex items-center justify-between">
                      <span>{currentRule.alchemy.title}</span>
                      <span className="text-xs font-normal text-stone-500">使用庫存動作調配</span>
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{currentRule.alchemy.desc}</p>
                  </div>

                  {/* 混合藥劑規格表 */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block">混合藥劑規格與消耗：</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {currentRule.alchemy.mixes.map((m, mIdx) => (
                        <div key={mIdx} className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                          <div className="flex justify-between font-bold mb-1">
                            <span className="text-amber-950 dark:text-amber-200">{m.tier}</span>
                            <span className="font-mono text-amber-800 dark:text-amber-400">{m.cost}</span>
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">{m.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 目標表與效果表 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs pt-1">
                    {/* 目標表 */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block">目標表（分配 1 個 d20）：</span>
                      <div className="rounded-lg border border-[#ded2be] dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-[#f5ecdf] dark:bg-slate-950 font-bold border-b border-[#ded2be] dark:border-slate-700">
                            <tr>
                              <th className="p-2 w-16 text-center">骰值</th>
                              <th className="p-2">影響目標</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-[11px]">
                            {currentRule.alchemy.targets.map((t, tIdx) => (
                              <tr key={tIdx}>
                                <td className="p-1.5 text-center font-mono font-bold text-amber-800 dark:text-amber-400">{t.roll}</td>
                                <td className="p-1.5 text-stone-700 dark:text-stone-300">{t.target}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 效果表 */}
                    <div className="lg:col-span-2 space-y-1.5">
                      <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block">效果表（分配 1 個 d20）：</span>
                      <div className="rounded-lg border border-[#ded2be] dark:border-slate-700 overflow-hidden max-h-60 overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#f5ecdf] dark:bg-slate-950 font-bold border-b border-[#ded2be] dark:border-slate-700 sticky top-0">
                            <tr>
                              <th className="p-2 w-24 text-center">骰值</th>
                              <th className="p-2">藥劑效果</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-[11px]">
                            {currentRule.alchemy.effects.map((e, eIdx) => (
                              <tr key={eIdx}>
                                <td className="p-1.5 text-center font-mono font-bold text-amber-800 dark:text-amber-400">{e.roll}</td>
                                <td className="p-1.5 text-stone-700 dark:text-stone-300">{renderTextWithAffinities(e.effect)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 灌注術 */}
              {currentRule.infusions && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-3.5 shadow-2xs">
                  <div className="border-b border-stone-100 dark:border-slate-700 pb-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                        {currentRule.infusions.title}
                      </h4>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-300/40">
                        技能對象：{currentRule.infusions.target}
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-xs text-stone-600 dark:text-stone-400 mt-2 pl-1">
                      {currentRule.infusions.rules.map((ir, irIdx) => (
                        <li key={irIdx}>{ir}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-stone-800 dark:text-stone-200 block mb-1">基礎灌注 (2 IP)：</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {currentRule.infusions.basic.map((item, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700">
                            <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">{item.name} ({item.cost})</span>
                            <span className="text-[11px] text-stone-600 dark:text-stone-400">{renderTextWithAffinities(item.desc)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-stone-800 dark:text-stone-200 block mb-1">高級灌注 (2 IP)：</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {currentRule.infusions.advanced.map((item, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700">
                            <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">{item.name} ({item.cost})</span>
                            <span className="text-[11px] text-stone-600 dark:text-stone-400">{renderTextWithAffinities(item.desc)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-stone-800 dark:text-stone-200 block mb-1">最高灌注 (2 IP)：</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentRule.infusions.superior.map((item, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700">
                            <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">{item.name} ({item.cost})</span>
                            <span className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">{renderTextWithAffinities(item.desc)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 魔科技 */}
              {currentRule.magitech && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-3.5 shadow-2xs">
                  <div className="border-b border-stone-100 dark:border-slate-700 pb-2">
                    <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm flex items-center justify-between">
                      <span>{currentRule.magitech.title}</span>
                      <span className="text-xs font-normal text-stone-500">官方最新勘誤版機制</span>
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{currentRule.magitech.desc}</p>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* 基礎：魔科技篡奪 */}
                    <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-amber-950 dark:text-amber-200">{currentRule.magitech.basic.name}</span>
                        <span className="font-mono text-amber-800 dark:text-amber-400">{currentRule.magitech.basic.cost}</span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">
                        {currentRule.magitech.basic.desc}
                      </p>
                    </div>

                    {/* 高級：魔加農 */}
                    <div className="p-3 rounded-lg bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 space-y-2">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-teal-950 dark:text-teal-200">{currentRule.magitech.advanced.name}</span>
                        <span className="font-mono text-teal-800 dark:text-teal-400">{currentRule.magitech.advanced.cost}</span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">
                        {renderTextWithAffinities(currentRule.magitech.advanced.desc)}
                      </p>
                      {/* 武器數據表 */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 p-2 bg-white/80 dark:bg-slate-900/80 rounded border border-teal-200/60 dark:border-teal-900/60 text-[11px]">
                        <div><span className="text-stone-500 block">類別</span><span className="font-bold text-stone-800 dark:text-stone-200">{currentRule.magitech.advanced.weaponStats.category}</span></div>
                        <div><span className="text-stone-500 block">持握</span><span className="font-bold text-stone-800 dark:text-stone-200">{currentRule.magitech.advanced.weaponStats.hands}</span></div>
                        <div><span className="text-stone-500 block">射程</span><span className="font-bold text-stone-800 dark:text-stone-200">{currentRule.magitech.advanced.weaponStats.range}</span></div>
                        <div><span className="text-stone-500 block">命中檢定</span><span className="font-bold text-stone-800 dark:text-stone-200 font-mono">{currentRule.magitech.advanced.weaponStats.accuracy}</span></div>
                        <div><span className="text-stone-500 block">傷害</span><span className="font-bold text-stone-800 dark:text-stone-200 font-mono">{currentRule.magitech.advanced.weaponStats.damage}</span></div>
                        <div><span className="text-stone-500 block">特性</span><span className="font-bold text-stone-800 dark:text-stone-200">{currentRule.magitech.advanced.weaponStats.quality}</span></div>
                      </div>
                    </div>

                    {/* 最高：魔法球 */}
                    <div className="p-3 rounded-lg bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-purple-950 dark:text-purple-200">{currentRule.magitech.superior.name}</span>
                        <span className="font-mono text-purple-800 dark:text-purple-400">{currentRule.magitech.superior.cost}</span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">
                        {currentRule.magitech.superior.desc}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. 造物專案官方體系 */}
          {activeRuleId === 'projects' && (
            <div className="space-y-6">
              {/* 六大造物流程步驟 */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-3 shadow-2xs">
                <div className="border-b border-stone-100 dark:border-slate-700 pb-2">
                  <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                    造物流程六大步驟（核心手冊 134~137 頁）
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    修補匠的自訂發明體系。任何發明皆依據以下六個標準步驟推進研發。
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  {currentRule.steps.map((st, stIdx) => (
                    <div key={stIdx} className="p-2.5 rounded-lg bg-stone-50 dark:bg-slate-900/60 border border-stone-200 dark:border-slate-700 space-y-1">
                      <span className="font-bold text-amber-900 dark:text-amber-300 block">{st.step}</span>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">{st.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 成本計算公式與三大乘數表 */}
              <div className="space-y-3">
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-amber-950 dark:text-amber-200">材料總成本計算公式：</span>
                    <span className="font-mono font-bold text-amber-800 dark:text-amber-400">總成本 = 基礎效力 × 範圍倍率 × 使用次數倍率</span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                    若為發明協商加入一項致命缺陷（如定時充電、極不可靠、笨重或巨大噪音等），總成本直接減免 25%（× 0.75）。中等以上效力必須包含一項跑團冒險焦點的特殊材料。
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                  {/* 效力表 */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block">1. 效力表（基礎成本）：</span>
                    <div className="rounded-lg border border-[#ded2be] dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-[#f5ecdf] dark:bg-slate-950 font-bold border-b border-[#ded2be] dark:border-slate-700">
                          <tr>
                            <th className="p-2 w-12 text-center">效力</th>
                            <th className="p-2 w-16 text-center">基礎</th>
                            <th className="p-2">效果範例</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-[11px]">
                          {currentRule.potencyTable.map((p, pIdx) => (
                            <tr key={pIdx}>
                              <td className="p-1.5 text-center font-bold text-stone-900 dark:text-stone-100">{p.tier}</td>
                              <td className="p-1.5 text-center font-mono font-bold text-amber-800 dark:text-amber-400">{p.cost}</td>
                              <td className="p-1.5 text-stone-600 dark:text-stone-400 leading-tight">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 範圍表 */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block">2. 範圍表（成本倍率）：</span>
                    <div className="rounded-lg border border-[#ded2be] dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-[#f5ecdf] dark:bg-slate-950 font-bold border-b border-[#ded2be] dark:border-slate-700">
                          <tr>
                            <th className="p-2 w-12 text-center">範圍</th>
                            <th className="p-2 w-14 text-center">倍率</th>
                            <th className="p-2">影響範例</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-[11px]">
                          {currentRule.areaTable.map((a, aIdx) => (
                            <tr key={aIdx}>
                              <td className="p-1.5 text-center font-bold text-stone-900 dark:text-stone-100">{a.area}</td>
                              <td className="p-1.5 text-center font-mono font-bold text-amber-800 dark:text-amber-400">{a.multiplier}</td>
                              <td className="p-1.5 text-stone-600 dark:text-stone-400 leading-tight">{a.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 使用次數表 */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-xs text-stone-800 dark:text-stone-200 block">3. 使用次數表（成本倍率）：</span>
                    <div className="rounded-lg border border-[#ded2be] dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-[#f5ecdf] dark:bg-slate-950 font-bold border-b border-[#ded2be] dark:border-slate-700">
                          <tr>
                            <th className="p-2 w-16 text-center">類型</th>
                            <th className="p-2 w-14 text-center">倍率</th>
                            <th className="p-2">持續性說明</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-[11px]">
                          {currentRule.usesTable.map((u, uIdx) => (
                            <tr key={uIdx}>
                              <td className="p-1.5 text-center font-bold text-stone-900 dark:text-stone-100">{u.use}</td>
                              <td className="p-1.5 text-center font-mono font-bold text-amber-800 dark:text-amber-400">{u.multiplier}</td>
                              <td className="p-1.5 text-stone-600 dark:text-stone-400 leading-tight">{u.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* 進度與推進機制 */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 space-y-2 shadow-2xs text-xs">
                <h4 className="font-bold text-amber-900 dark:text-amber-300 border-b border-stone-100 dark:border-slate-700 pb-1 flex items-center justify-between">
                  <span>進度計算與每日自動累積</span>
                  <span className="font-mono text-xs text-stone-500 font-normal">所需進度 = 最終總成本 / 100z</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700">
                    <strong className="text-stone-900 dark:text-stone-100 block mb-0.5">每位參與 PC</strong>
                    <span className="text-stone-600 dark:text-stone-400">每日結束時自動 +1 進度</span>
                  </div>
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700">
                    <strong className="text-stone-900 dark:text-stone-100 block mb-0.5">每位修補匠 (1級+)</strong>
                    <span className="text-stone-600 dark:text-stone-400">額外 +1 進度（基礎一人 2 點）</span>
                  </div>
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700">
                    <strong className="text-stone-900 dark:text-stone-100 block mb-0.5">特技《高瞻遠矚》</strong>
                    <span className="text-stone-600 dark:text-stone-400">每日額外 +SL 進度並抵扣【SL × 100】z</span>
                  </div>
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700">
                    <strong className="text-stone-900 dark:text-stone-100 block mb-0.5">招聘幫手 (半價薪酬)</strong>
                    <span className="text-stone-600 dark:text-stone-400">每名幫手每日額外 +1 進度</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 5. 忠實夥伴詳細規格 */}
          {activeRuleId === 'companion' && (
            <div className="space-y-4">
              <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                忠實夥伴面板規格與戰鬥機制
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 shadow-2xs space-y-2">
                  <span className="font-bold text-stone-900 dark:text-stone-100 block border-b border-stone-100 dark:border-slate-700 pb-1">
                    基礎屬性配置方案
                  </span>
                  <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-[11px]">
                    從【d8, d8, d8, d8】、【d10, d8, d8, d6】、【d10, d10, d6, d6】或【d12, d8, d6, d6】中任選一組分配至 DEX, INS, MIG, WLP。固定為 5 級，物種可選野獸、構造體、元素或植物。
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 shadow-2xs space-y-2">
                  <span className="font-bold text-stone-900 dark:text-stone-100 block border-b border-stone-100 dark:border-slate-700 pb-1">
                    最大 HP 動態公式
                  </span>
                  <div className="font-mono text-amber-800 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/60 p-1.5 rounded">
                    最大 HP = (SL × 夥伴基礎 MIG) + ⌊旅人等級 / 2⌋
                  </div>
                  <p className="text-stone-500 text-[11px]">危機值為最大 HP / 2。物防等於當前 DEX 骰，魔防等於當前 INS 骰。</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 shadow-2xs space-y-2 text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-300 block border-b border-stone-100 dark:border-slate-700 pb-1">
                  行動指揮與基礎攻擊
                </span>
                <ul className="list-disc list-inside space-y-1.5 text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed pl-1">
                  <li>夥伴最多擁有 2 種基礎攻擊（傷害為【HR + 5】），其命中檢定與魔法檢定獲得等於【SL】的加值。</li>
                  <li>夥伴在衝突中沒有獨立回合；在旅人回合中，旅人可花費一個動作讓夥伴執行動作（每回合限一次）。</li>
                  <li>當 HP 降至 0 時夥伴逃離戰場；在旅人登場的下一場景以危機 HP 重新歸隊。</li>
                </ul>
              </div>
            </div>
          )}

          {/* 6. 核心法術書展示 */}
          {activeRuleId === 'spellbooks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                  三大核心法術書（共 38 門咒語）
                </h3>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜尋咒語名稱或效果..."
                    className="px-2.5 py-1 text-xs rounded-lg border border-[#d6c7ab] dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-800 dark:text-stone-200 pr-7 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2 top-2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-5">
                {currentRule.schools.map((school, sIdx) => {
                  const filteredSpells = school.spells.filter(
                    sp => !searchTerm || sp.name.includes(searchTerm) || sp.desc.includes(searchTerm)
                  );
                  if (filteredSpells.length === 0) return null;
                  return (
                    <div key={sIdx} className="space-y-2">
                      <div className="flex items-center justify-between border-b border-[#e2d7c5] dark:border-slate-700 pb-1">
                        <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                          {school.name}
                        </h4>
                        <span className="text-xs font-mono font-bold text-stone-500">
                          施法檢定：{school.check}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {filteredSpells.map((sp, spIdx) => (
                          <div key={spIdx} className="p-2.5 rounded bg-white dark:bg-slate-800 border border-[#ded2be] dark:border-slate-700 text-xs space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                                {sp.offensive && (
                                  <span className="fu-icon text-red-600 font-bold" title="攻擊性咒語">
                                    o
                                  </span>
                                )}
                                <span>{sp.name}</span>
                              </span>
                              <span className="text-[11px] font-mono text-stone-500">
                                MP: {sp.mp} | 目標: {sp.target} | 持續: {sp.duration}
                              </span>
                            </div>
                            <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">{renderTextWithAffinities(sp.desc)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部 Footer */}
        <div className="p-3 bg-[#f5ecdf] dark:bg-slate-950 border-t border-[#ded2be] dark:border-slate-800 flex justify-between items-center text-xs text-stone-500 shrink-0">
          <span className="text-[11px] text-stone-600 dark:text-stone-400">
            提示：按 ESC 或點擊視窗外空白處即可關閉並返回
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold transition-colors shadow-2xs flex items-center gap-1"
          >
            <span>關閉並返回</span>
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
