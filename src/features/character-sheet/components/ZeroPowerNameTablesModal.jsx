/**
 * 底力技命名表（高度奇幻手冊 p.128–129）—— CHM 漢化完全未收錄。
 *
 * ## 為什麼是一個彈窗，而不是內嵌兩排 chips
 *
 * 上一版把「動作欄 3 個 ＋ 由來欄 6 個」的 chips 直接塞在名稱輸入框下面。
 * 玩家看得到**可以選哪一欄**，卻看不到**那一欄裡有什麼詞**——按一次骰子才知道結果，
 * 也不知道自己錯過了什麼。
 *
 * 身份表（`IdentityTablesModal`）的做法是「先看全表、再擲或自選」。
 * 同一個機制應該長同一個樣子，所以本檔的編排逐段對齊身份表
 * （使用者裁定 2026-10-21：「這兩個功能類似的內容編排UI/UX應該也要類似」）：
 *
 *   說明卡 → 擲骰結果卡 → 自選組合條 → 分頁與搜尋 → 一欄一張卡的詞表 → 底部套用
 *
 * ## 骰面即索引
 *
 * `rows[i]` 的索引就是骰值減一，所以 `#12` 就是「d20 擲出 12」。
 * **不要重排資料**——`test:zeropower` 逐格比對順序。
 *
 * ## 為什麼內容抽成 `ZeroPowerNameTablesBody`
 *
 * `JRPGModal` 在 SSR 下必定回 `null`（`mounted` 只能由 `useEffect` 設起來，
 * 而 SSR 不跑 effect），所以整份表格在伺服器渲染時是**測不到的**。
 * 依 AGENTS.md「SSR 測不到的區塊優先加注入點、不要放棄覆蓋」，這裡把內容抽成
 * 一個**純展示元件**：彈窗殼持有狀態，內容只收 props。護欄直接渲染內容元件。
 */
import React, { useMemo, useState } from 'react';
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
  ZERO_NAME_ACTIONS,
  ZERO_NAME_ORIGINS,
  generateZeroPowerName,
  rollZeroPowerName,
  zeroNameTableGroups
} from '../data/zeroPowers';

/** 表格資料是凍結的，模組層算一次就好（也讓 SSR 與護欄拿到同一份）。 */
const ACTION_GROUPS = zeroNameTableGroups('action');
const ORIGIN_GROUPS = zeroNameTableGroups('origin');

/** 一欄的標題徽章：動作是 d20、由來是 d10。 */
function DieBadge({ die, count, theme }) {
  return (
    <span
      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
      style={{
        backgroundColor: theme?.subpanelBg || '#ede4d1',
        borderColor: theme?.border || '#d6c7ab',
        color: theme?.accent || '#78350f'
      }}
    >
      {`${die}: ${count}`}
    </span>
  );
}

/** 欄位選擇的一顆小按鈕（動作 3 欄／由來 6 欄共用）。 */
function ColumnChip({ active, label, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer"
      style={{
        backgroundColor: active ? theme?.accentSoft || theme?.subpanelBg || '#ede4d1' : 'transparent',
        borderColor: active ? theme?.accent || '#a63d40' : theme?.border || '#d6c7ab',
        color: theme?.textDark || '#3c2415'
      }}
    >
      {label}
    </button>
  );
}

/**
 * 內容本體（純展示）。
 *
 * 所有狀態由彈窗殼提供；不傳時行為等於「空白但完整」——護欄就是靠這點渲染兩態。
 */
export function ZeroPowerNameTablesBody({
  theme = null,
  activeTab = 'all',
  onTabChange = () => {},
  searchTerm = '',
  onSearchChange = () => {},
  actionColumn = 0,
  onActionColumnChange = () => {},
  originColumn = 0,
  onOriginColumnChange = () => {},
  onRoll = () => {},
  rolledResult = null,
  onApplyRolled = () => {},
  pickedAction = null,
  pickedOrigin = null,
  onPick = () => {},
  onClearPicks = () => {},
  assembledName = '',
  onApplyPicked = () => {}
}) {
  /** 搜尋只在中文詞上比對——這兩張表沒有英文對照欄（原文是英文，但介面依規則三純中文）。 */
  const filterRows = (rows) => {
    const term = searchTerm.trim();
    if (!term) return rows;
    return rows.filter((row) => row.zh.includes(term));
  };

  const showActions = activeTab === 'all' || activeTab === 'action';
  const showOrigins = activeTab === 'all' || activeTab === 'origin';

  const pickedStyle = (picked) =>
    picked
      ? {
          backgroundColor: theme?.cardBg || '#ffffff',
          borderColor: theme?.accent || '#a63d40',
          color: theme?.textDark || '#3c2415'
        }
      : {};

  const renderGroup = (group, kind) => {
    const rows = filterRows(group.rows);
    if (rows.length === 0) return null;
    const isAction = kind === 'action';
    return (
      <div
        key={`${kind}-${group.column}`}
        className="rounded-xl p-2.5 space-y-1.5 border"
        style={{ backgroundColor: theme?.panelBg || '#f5efdf', borderColor: theme?.border || '#d6c7ab' }}
      >
        <div
          className="flex items-center justify-between px-1 pb-1 border-b"
          style={{ borderColor: theme?.border || '#ede4d1' }}
        >
          <span className="text-xs font-bold font-mono" style={{ color: theme?.textDark || '#3c2415' }}>
            {group.column}
          </span>
          <DieBadge die={group.die} count={group.rows.length} theme={theme} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {rows.map((row) => {
            const picked = isAction
              ? Boolean(pickedAction) && pickedAction.id === row.id && pickedAction.column === group.columnIndex
              : Boolean(pickedOrigin) && pickedOrigin.id === row.id && pickedOrigin.column === group.columnIndex;
            return (
              <button
                key={`${kind}-${group.column}-${row.id}`}
                type="button"
                onClick={() => onPick(kind, { id: row.id, column: group.columnIndex, zh: row.zh })}
                className="rounded-lg border px-1.5 py-1 text-left transition-colors cursor-pointer"
                style={
                  picked
                    ? {
                        backgroundColor: theme?.accent || '#78350f',
                        borderColor: theme?.accent || '#78350f',
                        color: '#ffffff',
                        fontWeight: 'bold'
                      }
                    : { backgroundColor: theme?.cardBg || '#ffffff', borderColor: theme?.border || '#d6c7ab', color: theme?.textDark || '#1e293b' }
                }
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`font-mono text-[10px] w-5 text-right font-bold ${picked ? 'text-white/80' : 'text-[#6b5a4b]'}`}
                  >
                    {`#${row.id}`}
                  </span>
                  <span className="font-bold truncate">{row.zh}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-[#3c2415]">
      {/* 說明卡 */}
      <div
        className="rounded-xl p-3.5 space-y-2 border transition-colors"
        style={{ backgroundColor: theme?.panelBg || '#f5efdf', borderColor: theme?.border || '#d6c7ab' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4
              className="font-serif font-bold text-sm flex items-center gap-1.5"
              style={{ color: theme?.textDark || '#3c2415' }}
            >
              <GiSpellBook className="w-4 h-4" style={{ color: theme?.accent || '#a63d40' }} />
              官方命名機制：由來 ＋ 動作
            </h4>
            <p className="text-t12 text-[#6b5a4b] mt-0.5">
              高度奇幻手冊 p.128–129。動作骰 1d20、由來骰 1d10；兩張表都是「先依底力技的定位選一欄，再依骰面取詞」。
            </p>
            <p className="text-t12 mt-1 leading-relaxed" style={{ color: theme?.textMuted || '#7c6a58' }}>
              <span className="font-bold" style={{ color: theme?.textDark || '#3c2415' }}>這張表是靈感，不是規則</span>
              ：原文允許調整語序與所有格（王家之刃／刃・王家）。一次給你一個名字——不喜歡就再擲一次，或直接在「底力技名稱」欄自己寫。
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <JRPGButton
              variant={theme?.buttonVariant || 'primary'}
              size="sm"
              icon={GiRollingDices}
              onClick={onRoll}
            >
              投擲 1d20 ＋ 1d10
            </JRPGButton>
          </div>
        </div>

        {/* 欄位選擇：兩張表各自「先選一欄」 */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px]" style={{ color: theme?.textMuted || '#7c6a58' }}>動作欄</span>
          {ZERO_NAME_ACTIONS.columns.map((col, i) => (
            <ColumnChip
              key={`action-col-${col}`}
              active={actionColumn === i}
              label={col}
              onClick={() => onActionColumnChange(i)}
              theme={theme}
            />
          ))}
          <span className="text-[10px] ml-1" style={{ color: theme?.textMuted || '#7c6a58' }}>由來欄</span>
          {ZERO_NAME_ORIGINS.columns.map((col, i) => (
            <ColumnChip
              key={`origin-col-${col}`}
              active={originColumn === i}
              label={col}
              onClick={() => onOriginColumnChange(i)}
              theme={theme}
            />
          ))}
        </div>

        {/* 擲骰結果卡 */}
        {rolledResult ? (
          <div
            className="mt-2.5 p-3 rounded-lg border shadow-sm space-y-2 animate-fade-in"
            style={{ backgroundColor: theme?.cardBg || '#ffffff', borderColor: theme?.border || '#d6c7ab' }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div
                className="flex items-center gap-1.5 text-xs font-bold"
                style={{ color: theme?.textDark || '#3c2415' }}
              >
                <GiSparkles className="w-3.5 h-3.5" style={{ color: theme?.accent || '#a63d40' }} />
                <span>擲骰結算: </span>
                <span
                  className="font-serif text-sm underline"
                  style={{ color: theme?.textDark || '#3c2415', textDecorationColor: theme?.accent || '#a63d40' }}
                >
                  {rolledResult.name}
                </span>
              </div>
              <button
                type="button"
                onClick={onApplyRolled}
                className="px-2.5 py-1 rounded text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: theme?.accent || '#78350f' }}
              >
                <GiCheckMark className="w-3 h-3" />
                <span>套用此擲骰名稱</span>
              </button>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t"
              style={{ borderColor: theme?.border || '#ede4d1' }}
            >
              <div
                className="p-1.5 rounded border"
                style={{ backgroundColor: theme?.panelBg || '#f5efdf', borderColor: theme?.border || '#d6c7ab' }}
              >
                <span className="text-[#6b5a4b] block">1. 由來:</span>
                <span className="font-mono font-bold" style={{ color: theme?.accent || '#78350f' }}>
                  {`d10 = ${rolledResult.originRoll} → ${rolledResult.origin}`}
                </span>
                <span className="block text-[#6b5a4b]">{ZERO_NAME_ORIGINS.columns[rolledResult.originColumn]}</span>
              </div>
              <div
                className="p-1.5 rounded border"
                style={{ backgroundColor: theme?.panelBg || '#f5efdf', borderColor: theme?.border || '#d6c7ab' }}
              >
                <span className="text-[#6b5a4b] block">2. 動作:</span>
                <span className="font-mono font-bold" style={{ color: theme?.accent || '#78350f' }}>
                  {`d20 = ${rolledResult.actionRoll} → ${rolledResult.action}`}
                </span>
                <span className="block text-[#6b5a4b]">{ZERO_NAME_ACTIONS.columns[rolledResult.actionColumn]}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* 自選組合條 */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          <div
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
              pickedOrigin ? 'font-bold' : 'bg-white/60 border-[#d6c7ab] text-[#6b5a4b]'
            }`}
            style={pickedStyle(pickedOrigin)}
          >
            <span>{`1. 由來: ${pickedOrigin ? pickedOrigin.zh : '尚未選取'}`}</span>
            {pickedOrigin ? (
              <button type="button" onClick={() => onPick('origin', null)} className="text-[#6b5a4b] hover:text-[#3c2415]">
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>

          <span className="text-[#6b5a4b]">➔</span>

          <div
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
              pickedAction ? 'font-bold' : 'bg-white/60 border-[#d6c7ab] text-[#6b5a4b]'
            }`}
            style={pickedStyle(pickedAction)}
          >
            <span>{`2. 動作: ${pickedAction ? pickedAction.zh : '尚未選取'}`}</span>
            {pickedAction ? (
              <button type="button" onClick={() => onPick('action', null)} className="text-[#6b5a4b] hover:text-[#3c2415]">
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>

          {(pickedAction || pickedOrigin) && (
            <button
              type="button"
              onClick={onClearPicks}
              className="text-[10px] text-[#6b5a4b] hover:text-[#3c2415] underline cursor-pointer"
            >
              重置清空
            </button>
          )}

          {assembledName ? (
            <div className="ml-auto">
              <button
                type="button"
                onClick={onApplyPicked}
                className="px-3 py-1 rounded text-white font-bold text-xs shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                style={{ backgroundColor: theme?.accent || '#78350f' }}
              >
                <GiCheckMark className="w-3 h-3" />
                <span>{`套用此組合: ${assembledName}`}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* 分頁與搜尋 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {[
            { id: 'all', label: '全部總覽' },
            { id: 'action', label: `1. 動作（${ZERO_NAME_ACTIONS.columns.length * ZERO_NAME_ACTIONS.rows.length} 詞）` },
            { id: 'origin', label: `2. 由來（${ZERO_NAME_ORIGINS.columns.length * ZERO_NAME_ORIGINS.rows.length} 詞）` }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className="px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border cursor-pointer"
                style={
                  isActive
                    ? {
                        backgroundColor: theme?.accent || '#78350f',
                        borderColor: theme?.accentDark || '#76252d',
                        color: '#ffffff'
                      }
                    : {
                        backgroundColor: theme?.cardBg || '#ffffff',
                        borderColor: theme?.border || '#d6c7ab',
                        color: theme?.textDark || '#334155'
                      }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[200px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜尋動作或由來的詞..."
            className="w-full border rounded-lg pl-7 pr-3 py-1 text-xs outline-none shadow-2xs placeholder:text-[#6b5a4b]"
            style={{
              backgroundColor: theme?.cardBg || '#ffffff',
              borderColor: theme?.border || '#d6c7ab',
              color: theme?.textDark || '#0f172a'
            }}
          />
          <GiMagnifyingGlass
            className="w-3.5 h-3.5 absolute left-2 top-2"
            style={{ color: theme?.accent || '#94a3b8' }}
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1.5 text-[#6b5a4b] hover:text-[#3c2415] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      </div>

      {/* 詞表：一欄一張卡 */}
      <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-1">
        {showActions ? (
          <div className="space-y-2">
            <h5
              className="text-xs font-black font-serif flex items-center gap-1.5"
              style={{ color: theme?.textDark || '#3c2415' }}
            >
              <GiRollingDices className="w-3.5 h-3.5" style={{ color: theme?.accent || '#a63d40' }} />
              動作（骰 1d20，依底力技的定位選欄）
            </h5>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {ACTION_GROUPS.map((group) => renderGroup(group, 'action'))}
            </div>
          </div>
        ) : null}

        {showOrigins ? (
          <div className="space-y-2">
            <h5
              className="text-xs font-black font-serif flex items-center gap-1.5"
              style={{ color: theme?.textDark || '#3c2415' }}
            >
              <GiSparkles className="w-3.5 h-3.5" style={{ color: theme?.accent || '#a63d40' }} />
              由來（骰 1d10，依底力技的起源選欄）
            </h5>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {ORIGIN_GROUPS.map((group) => renderGroup(group, 'origin'))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ZeroPowerNameTablesModal({
  isOpen,
  onClose,
  onSelectName,
  currentName = '',
  theme = null
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionColumn, setActionColumn] = useState(0);
  const [originColumn, setOriginColumn] = useState(0);
  const [rolledResult, setRolledResult] = useState(null);
  const [pickedAction, setPickedAction] = useState(null);
  const [pickedOrigin, setPickedOrigin] = useState(null);

  const handleRoll = () => {
    setRolledResult(rollZeroPowerName({ actionColumn, originColumn }));
  };

  const apply = (name) => {
    if (!name) return;
    if (typeof onSelectName === 'function') onSelectName(name);
    if (typeof onClose === 'function') onClose();
  };

  const assembledName = useMemo(() => {
    if (!pickedAction || !pickedOrigin) return '';
    return generateZeroPowerName({
      actionRoll: pickedAction.id,
      actionColumn: pickedAction.column,
      originRoll: pickedOrigin.id,
      originColumn: pickedOrigin.column
    }).name;
  }, [pickedAction, pickedOrigin]);

  /** `entry` 傳 `null` 表示清掉那一格（自選條上的叉叉）。 */
  const handlePick = (kind, entry) => {
    if (kind === 'action') setPickedAction(entry);
    else setPickedOrigin(entry);
  };

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title="底力技命名對照表"
      maxWidth="max-w-4xl"
      theme={theme}
      actionButtons={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[#6b5a4b] font-medium hidden sm:block">
            點擊任一詞可自選組合，或直接擲骰一鍵套用
            {currentName ? `（目前名稱：${currentName}）` : ''}
          </div>
          <div className="flex items-center gap-2">
            <JRPGButton variant="secondary" size="sm" onClick={onClose}>
              關閉
            </JRPGButton>
            {assembledName ? (
              <JRPGButton
                variant={theme?.buttonVariant || 'primary'}
                size="sm"
                icon={GiCheckMark}
                onClick={() => apply(assembledName)}
              >
                {`套用自選名稱: ${assembledName}`}
              </JRPGButton>
            ) : null}
          </div>
        </div>
      }
    >
      <ZeroPowerNameTablesBody
        theme={theme}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        actionColumn={actionColumn}
        onActionColumnChange={setActionColumn}
        originColumn={originColumn}
        onOriginColumnChange={setOriginColumn}
        onRoll={handleRoll}
        rolledResult={rolledResult}
        onApplyRolled={() => apply(rolledResult && rolledResult.name)}
        pickedAction={pickedAction}
        pickedOrigin={pickedOrigin}
        onPick={handlePick}
        onClearPicks={() => {
          setPickedAction(null);
          setPickedOrigin(null);
        }}
        assembledName={assembledName}
        onApplyPicked={() => apply(assembledName)}
      />
    </JRPGModal>
  );
}
