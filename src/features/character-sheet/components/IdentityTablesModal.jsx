import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  GiSpellBook,
  GiRollingDices,
  GiCheckMark,
  GiMagnifyingGlass,
  GiSparkles
} from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import {
  OFFICIAL_IDENTITY_TABLES,
  rollOfficialIdentity,
  formatChineseIdentity
} from '../data/sourcebookConfig';

export default function IdentityTablesModal({
  isOpen,
  onClose,
  onSelectIdentity,
  currentIdentity = '',
  theme = null
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'concept', 'adj', 'detail'
  const [searchTerm, setSearchTerm] = useState('');
  const [rolledResult, setRolledResult] = useState(null);

  // Custom Assembly State
  const [pickedDetail, setPickedDetail] = useState(null);
  const [pickedAdj, setPickedAdj] = useState(null);
  const [pickedConcept, setPickedConcept] = useState(null);

  const handleRoll = () => {
    const result = rollOfficialIdentity();
    setRolledResult(result);
  };

  const handleApplyRolled = () => {
    if (!rolledResult) return;
    onSelectIdentity(rolledResult.fullZh);
    onClose();
  };

  const handleApplyPicked = () => {
    const assembled = formatChineseIdentity(pickedDetail, pickedAdj, pickedConcept);
    if (assembled) {
      onSelectIdentity(assembled);
      onClose();
    }
  };

  const assembledString = useMemo(() => {
    return formatChineseIdentity(pickedDetail, pickedAdj, pickedConcept);
  }, [pickedDetail, pickedAdj, pickedConcept]);

  // Filter items
  //
  // 搜尋同時比對英文：這是**檢索**用途，不是顯示（GEMINI.md 規則三管的是畫面上印什麼）。
  // 知道英文原名的玩家可以打 "knight" 找到「騎士」。
  const filterList = (items) => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      item => item.zh.toLowerCase().includes(term) || item.en.toLowerCase().includes(term)
    );
  };

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title="官方身份創建靈感對照表"
      maxWidth="max-w-4xl"
      theme={theme}
      actionButtons={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[#6b5a4b] font-medium hidden sm:block">
            點擊任一項目可自選組合，或直接擲骰一鍵套用
          </div>
          <div className="flex items-center gap-2">
            <JRPGButton variant="secondary" size="sm" onClick={onClose}>
              關閉
            </JRPGButton>
            {assembledString && (
              <JRPGButton variant={theme?.buttonVariant || 'primary'} size="sm" icon={GiCheckMark} onClick={handleApplyPicked}>
                套用自選身份: {assembledString}
              </JRPGButton>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-[#3c2415]">
        {/* Top Description & Official Rules Explanation */}
        <div
          className="rounded-xl p-3.5 space-y-2 border transition-colors"
          style={{ backgroundColor: theme?.panelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="font-serif font-bold text-sm flex items-center gap-1.5" style={{ color: theme?.textDark || '#3c2415' }}>
                <GiSpellBook className="w-4 h-4" style={{ color: theme?.accent || '#a63d40' }} />
                官方創角機制：核心概念 + 形容特質 + 身世細節
              </h4>
              <p className="text-t12 text-[#6b5a4b] mt-0.5">
                依據官方英文最新版手冊，共有 60 種身分、40 種特質與 20 種細節，各組均明確對應骰面。
              </p>
              {/*
                使用者裁定（2026-10-06）：「身份表照樣一個就可以了，這是官方給我們啟發用的，
                並非硬性規則，只要提醒好這點就行」「骰子隨機決定就是來給玩家新想法的」。

                所以這裡**不放**「還缺幾個」的進度、也不催玩家湊滿——原書 p.156 只寫
                「你可以投擲 d6 和 d20，或從這些表格中選擇條目」，而且開宗明義說
                「你不一定要按照這個確切的順序執行這些步驟」。它雖然允許核心概念與形容詞
                各取最多兩個，但湊滿不是義務；這個按鈕的用途是**產生新點子**。
              */}
              <p className="text-t12 mt-1 leading-relaxed" style={{ color: theme?.textMuted || '#7c6a58' }}>
                <span className="font-bold" style={{ color: theme?.textDark || '#3c2415' }}>這張表是靈感，不是規則</span>
                ：一次給你一組點子——不喜歡就再擲一次，或直接在「身分」欄自己寫。
              </p>
            </div>

            {/* Quick Roll Button */}
            <JRPGButton
              variant={theme?.buttonVariant || 'primary'}
              size="sm"
              icon={GiRollingDices}
              onClick={handleRoll}
            >
              投擲官方 1d6 + 1d20
            </JRPGButton>
          </div>

          {/* Rolled Result Card */}
          {rolledResult && (
            <div
              className="mt-2.5 p-3 rounded-lg border shadow-sm space-y-2 animate-fade-in"
              style={{ backgroundColor: theme?.cardBg || '#fffdf9', borderColor: theme?.border || '#d6c7ab' }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: theme?.textDark || '#3c2415' }}>
                  <GiSparkles className="w-3.5 h-3.5" style={{ color: theme?.accent || '#a63d40' }} />
                  <span>擲骰結算: </span>
                  <span className="font-serif text-sm underline" style={{ color: theme?.textDark || '#3c2415', textDecorationColor: theme?.accent || '#a63d40' }}>
                    {rolledResult.fullZh}
                  </span>
                  <span className="text-t11 text-[#6b5a4b] font-normal">
                    / {rolledResult.fullEn}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyRolled}
                  className="px-2.5 py-1 rounded text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                  style={{ backgroundColor: theme?.accent || '#78350f' }}
                >
                  <GiCheckMark className="w-3 h-3" />
                  <span>套用此擲骰身份</span>
                </button>
              </div>

              {/* Dice roll details breakdown (細節 - 特質 - 核心概念) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-t11 pt-1 border-t" style={{ borderColor: theme?.border || '#f4ebd9' }}>
                <div className="p-1.5 rounded border" style={{ backgroundColor: theme?.panelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}>
                  <span className="text-[#6b5a4b] block">1. 身世細節:</span>
                  <span className="font-mono font-bold" style={{ color: theme?.accent || '#78350f' }}>
                    d20=[#{rolledResult.rolls.detail.d20}]
                  </span>
                  <span className="font-bold block" style={{ color: theme?.textDark || '#3c2415' }}>
                    {rolledResult.rolls.detail.item.zh}
                  </span>
                </div>

                <div className="p-1.5 rounded border" style={{ backgroundColor: theme?.panelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}>
                  <span className="text-[#6b5a4b] block">2. 形容特質:</span>
                  <span className="font-mono font-bold" style={{ color: theme?.accent || '#78350f' }}>
                    d6=[{rolledResult.rolls.adjective.d6}] {rolledResult.rolls.adjective.group.split(' ')[0]} ➔ d20=[#{rolledResult.rolls.adjective.d20}]
                  </span>
                  <span className="font-bold block" style={{ color: theme?.textDark || '#3c2415' }}>
                    {rolledResult.rolls.adjective.item.zh}
                  </span>
                </div>

                <div className="p-1.5 rounded border" style={{ backgroundColor: theme?.panelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}>
                  <span className="text-[#6b5a4b] block">3. 核心概念:</span>
                  <span className="font-mono font-bold" style={{ color: theme?.accent || '#78350f' }}>
                    d6=[{rolledResult.rolls.concept.d6}] {rolledResult.rolls.concept.group.split(' ')[0]} ➔ d20=[#{rolledResult.rolls.concept.d20}]
                  </span>
                  <span className="font-bold block" style={{ color: theme?.textDark || '#3c2415' }}>
                    {rolledResult.rolls.concept.item.zh}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Custom Builder Bar (順序：身世細節 ➔ 形容特質 ➔ 核心身分) */}
        <div
          className="p-3 rounded-xl space-y-2 border transition-colors"
          style={{ backgroundColor: theme?.subpanelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: theme?.textDark || '#3c2415' }}>
              <GiSparkles className="w-3.5 h-3.5" style={{ color: theme?.accent || '#a63d40' }} />
              自選組合身份區（依照中文習慣：身世細節 ➔ 形容特質 ➔ 核心概念）:
            </span>
            {(pickedAdj || pickedConcept || pickedDetail) && (
              <button
                type="button"
                onClick={() => {
                  setPickedDetail(null);
                  setPickedAdj(null);
                  setPickedConcept(null);
                }}
                className="text-t10 text-[#6b5a4b] hover:text-[#3c2415] underline cursor-pointer"
              >
                重置清空
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 1. Picked Detail */}
            <div
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
                pickedDetail ? 'font-bold' : 'bg-white/60 border-[#d6c7ab] text-[#6b5a4b]'
              }`}
              style={pickedDetail ? { backgroundColor: theme?.cardBg || '#fffdf9', borderColor: theme?.accent || '#a63d40', color: theme?.textDark || '#3c2415' } : {}}
            >
              <span>1. 身世細節: {pickedDetail ? pickedDetail.zh : '尚未選取'}</span>
              {pickedDetail && (
                <button onClick={() => setPickedDetail(null)} className="text-[#6b5a4b] hover:text-[#3c2415]">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <span className="text-[#6b5a4b]">➔</span>

            {/* 2. Picked Adjective */}
            <div
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
                pickedAdj ? 'font-bold' : 'bg-white/60 border-[#d6c7ab] text-[#6b5a4b]'
              }`}
              style={pickedAdj ? { backgroundColor: theme?.cardBg || '#fffdf9', borderColor: theme?.accent || '#a63d40', color: theme?.textDark || '#3c2415' } : {}}
            >
              <span>2. 形容特質: {pickedAdj ? pickedAdj.zh : '尚未選取'}</span>
              {pickedAdj && (
                <button onClick={() => setPickedAdj(null)} className="text-[#6b5a4b] hover:text-[#3c2415]">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <span className="text-[#6b5a4b]">➔</span>

            {/* 3. Picked Concept */}
            <div
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
                pickedConcept ? 'font-bold' : 'bg-white/60 border-[#d6c7ab] text-[#6b5a4b]'
              }`}
              style={pickedConcept ? { backgroundColor: theme?.cardBg || '#fffdf9', borderColor: theme?.accent || '#a63d40', color: theme?.textDark || '#3c2415' } : {}}
            >
              <span>3. 核心身分: {pickedConcept ? pickedConcept.zh : '尚未選取'}</span>
              {pickedConcept && (
                <button onClick={() => setPickedConcept(null)} className="text-[#6b5a4b] hover:text-[#3c2415]">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {assembledString && (
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={handleApplyPicked}
                  className="px-3 py-1 rounded text-white font-bold text-xs shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                  style={{ backgroundColor: theme?.accent || '#78350f' }}
                >
                  <GiCheckMark className="w-3 h-3" />
                  <span>套用此組合: {assembledString}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter / Search & Tabs Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {[
              { id: 'all', label: '全部總覽' },
              { id: 'concept', label: '1. 核心概念 (60種)' },
              { id: 'adj', label: '2. 形容特質 (40種)' },
              { id: 'detail', label: '3. 身世細節 (20種)' }
            ].map(t => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border cursor-pointer"
                  style={
                    isActive
                      ? { backgroundColor: theme?.accent || '#78350f', borderColor: theme?.accentDark || '#76252d', color: '#fffdf9' }
                      : { backgroundColor: theme?.cardBg || '#fffdf9', borderColor: theme?.border || '#d6c7ab', color: theme?.textDark || '#334155' }
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜尋身份、特質、細節或英文..."
              className="w-full border rounded-lg pl-7 pr-3 py-1 text-xs outline-none shadow-2xs placeholder:text-[#6b5a4b]"
              style={{ backgroundColor: theme?.cardBg || '#fffdf9', borderColor: theme?.border || '#d6c7ab', color: theme?.textDark || '#0f172a' }}
            />
            <GiMagnifyingGlass className="w-3.5 h-3.5 absolute left-2 top-2" style={{ color: theme?.accent || '#94a3b8' }} />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1.5 text-[#6b5a4b] hover:text-[#3c2415] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ==================== TABLES DISPLAY ==================== */}
        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-1">

          {/* 1. Core Concepts */}
          {(activeTab === 'all' || activeTab === 'concept') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: theme?.border || '#d6c7ab' }}>
                <h5 className="font-serif font-black text-sm flex items-center gap-2" style={{ color: theme?.textDark || '#3c2415' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme?.accent || '#a63d40' }} />
                  {OFFICIAL_IDENTITY_TABLES.coreConcepts.title}
                </h5>
                <span className="text-t11 text-[#6b5a4b] font-mono">
                  {OFFICIAL_IDENTITY_TABLES.coreConcepts.rollDesc}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {OFFICIAL_IDENTITY_TABLES.coreConcepts.groups.map(grp => {
                  const filtered = filterList(grp.items);
                  if (filtered.length === 0) return null;

                  return (
                    <div
                      key={grp.d6Range}
                      className="rounded-xl border p-2.5 space-y-2 transition-colors"
                      style={{ backgroundColor: theme?.panelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}
                    >
                      <div className="flex items-center justify-between px-1 pb-1 border-b" style={{ borderColor: theme?.border || '#f4ebd9' }}>
                        <span className="text-xs font-bold font-mono" style={{ color: theme?.textDark || '#3c2415' }}>
                          {grp.title}
                        </span>
                        <span
                          className="text-t10 font-mono font-bold px-1.5 py-0.5 rounded border"
                          style={{ backgroundColor: theme?.subpanelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab', color: theme?.accent || '#78350f' }}
                        >
                          d6: {grp.d6Range}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {filtered.map(item => {
                          const isPicked = pickedConcept?.id === item.id && pickedConcept?.d6Range === grp.d6Range;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setPickedConcept({ ...item, d6Range: grp.d6Range })}
                              className="px-2 py-1 rounded text-xs flex items-center justify-between cursor-pointer transition-colors"
                              style={
                                isPicked
                                  ? { backgroundColor: theme?.accent || '#78350f', color: '#fffdf9', fontWeight: 'bold' }
                                  : { color: theme?.textDark || '#1e293b' }
                              }
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className={`font-mono text-t10 w-5 text-right font-bold ${
                                  isPicked ? 'text-white/80' : 'text-[#6b5a4b]'
                                }`}>
                                  #{item.id}
                                </span>
                                <span className="font-bold truncate">{item.zh}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Adjectives */}
          {(activeTab === 'all' || activeTab === 'adj') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: theme?.border || '#d6c7ab' }}>
                <h5 className="font-serif font-black text-sm flex items-center gap-2" style={{ color: theme?.textDark || '#3c2415' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme?.accent || '#a63d40' }} />
                  {OFFICIAL_IDENTITY_TABLES.adjectives.title}
                </h5>
                <span className="text-t11 text-[#6b5a4b] font-mono">
                  {OFFICIAL_IDENTITY_TABLES.adjectives.rollDesc}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {OFFICIAL_IDENTITY_TABLES.adjectives.groups.map(grp => {
                  const filtered = filterList(grp.items);
                  if (filtered.length === 0) return null;

                  return (
                    <div
                      key={grp.d6Range}
                      className="rounded-xl border p-2.5 space-y-2 transition-colors"
                      style={{ backgroundColor: theme?.panelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}
                    >
                      <div className="flex items-center justify-between px-1 pb-1 border-b" style={{ borderColor: theme?.border || '#f4ebd9' }}>
                        <span className="text-xs font-bold font-mono" style={{ color: theme?.textDark || '#3c2415' }}>
                          {grp.title}
                        </span>
                        <span
                          className="text-t10 font-mono font-bold px-1.5 py-0.5 rounded border"
                          style={{ backgroundColor: theme?.subpanelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab', color: theme?.accent || '#78350f' }}
                        >
                          d6: {grp.d6Range}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1">
                        {filtered.map(item => {
                          const isPicked = pickedAdj?.id === item.id && pickedAdj?.d6Range === grp.d6Range;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setPickedAdj({ ...item, d6Range: grp.d6Range })}
                              className="px-2 py-1 rounded text-xs flex items-center justify-between cursor-pointer transition-colors"
                              style={
                                isPicked
                                  ? { backgroundColor: theme?.accent || '#78350f', color: '#fffdf9', fontWeight: 'bold' }
                                  : { color: theme?.textDark || '#1e293b' }
                              }
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className={`font-mono text-t10 w-5 text-right font-bold ${
                                  isPicked ? 'text-white/80' : 'text-[#6b5a4b]'
                                }`}>
                                  #{item.id}
                                </span>
                                <span className="font-bold truncate">{item.zh}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Details */}
          {(activeTab === 'all' || activeTab === 'detail') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: theme?.border || '#d6c7ab' }}>
                <h5 className="font-serif font-black text-sm flex items-center gap-2" style={{ color: theme?.textDark || '#3c2415' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme?.accent || '#a63d40' }} />
                  {OFFICIAL_IDENTITY_TABLES.details.title}
                </h5>
                <span className="text-t11 text-[#6b5a4b] font-mono">
                  {OFFICIAL_IDENTITY_TABLES.details.rollDesc}
                </span>
              </div>

              <div
                className="rounded-xl border p-2.5 transition-colors"
                style={{ backgroundColor: theme?.panelBg || '#f4ebd9', borderColor: theme?.border || '#d6c7ab' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
                  {filterList(OFFICIAL_IDENTITY_TABLES.details.items).map(item => {
                    const isPicked = pickedDetail?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setPickedDetail(item)}
                        className="px-2 py-1 rounded text-xs flex items-center justify-between cursor-pointer transition-colors"
                        style={
                          isPicked
                            ? { backgroundColor: theme?.accent || '#78350f', color: '#fffdf9', fontWeight: 'bold' }
                            : { color: theme?.textDark || '#1e293b' }
                        }
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`font-mono text-t10 w-5 text-right font-bold ${
                            isPicked ? 'text-white/80' : 'text-[#6b5a4b]'
                          }`}>
                            #{item.id}
                          </span>
                          <span className="font-bold truncate">{item.zh}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </JRPGModal>
  );
}
