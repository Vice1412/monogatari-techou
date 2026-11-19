import React, { useState } from 'react';
import { GiSparkles, GiPocketWatch, GiCheckMark, GiClockwork } from 'react-icons/gi';
import EmptyState from '../../components/ui/EmptyState';
import JRPGButton from '../../components/ui/JRPGButton';
import ClockTracker, { CLOCK_THEMES } from '../../components/ui/ClockTracker';
import { STORAGE_KEYS } from '../../data/keys';
import { readJSON, writeJSON } from '../../data/store';
import { copyClockToCharacter, normalizeClocks } from '../character-sheet/utils/fateClocks';

const STORAGE_KEY = STORAGE_KEYS.fateClocks;

const DEFAULT_SAMPLE_CLOCKS = [
  { id: 'fc_1', title: '深淵魔神的甦醒儀式', totalSegments: 8, filledSegments: 3, theme: 'red', type: 'circle' },
  { id: 'fc_2', title: '王國皇家禁衛隊抵達', totalSegments: 6, filledSegments: 2, theme: 'amber', type: 'line' },
  { id: 'fc_3', title: '古代禁咒解析進度', totalSegments: 6, filledSegments: 5, theme: 'blue', type: 'circle' }
];

export default function FateClockPage({ initialClocks, initialRoster } = {}) {
  const [clocks] = useState(() => {
    // 測試注入點（生產端永不傳入；不傳時行為逐字不變，見 AGENTS.md §1）。
    if (Array.isArray(initialClocks)) return normalizeClocks(initialClocks);
    const saved = readJSON(STORAGE_KEY, null);
    if (Array.isArray(saved)) return normalizeClocks(saved);
    return normalizeClocks(DEFAULT_SAMPLE_CLOCKS);
  });

  const [roster, setRoster] = useState(() => {
    if (Array.isArray(initialRoster)) return initialRoster;
    const saved = readJSON(STORAGE_KEYS.characterRoster, []);
    return Array.isArray(saved) ? saved : [];
  });

  const [selectedCharId, setSelectedCharId] = useState(() => (
    Array.isArray(roster) && roster.length > 0 ? (roster[0]?.id || '') : ''
  ));
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  const activeTargetChar = roster.find((c) => c && c.id === selectedCharId) || roster[0] || null;

  const handleCopyToCharacter = (clk) => {
    const latestRoster = Array.isArray(initialRoster)
      ? roster
      : readJSON(STORAGE_KEYS.characterRoster, []);
    const targetList = Array.isArray(latestRoster) ? latestRoster : [];
    const target = targetList.find((c) => c && c.id === (activeTargetChar?.id || '')) || targetList[0];
    if (!target) {
      showToast('找不到可複製的目標角色，請先於「角色卡助手」建立角色');
      return;
    }
    const res = copyClockToCharacter(target, clk);
    if (!res.ok) {
      showToast(res.reason || '複製命刻失敗');
      return;
    }
    const nextRoster = targetList.map((c) => (c && c.id === target.id ? res.character : c));
    if (!Array.isArray(initialRoster)) {
      writeJSON(STORAGE_KEYS.characterRoster, nextRoster);
    }
    setRoster(nextRoster);
    showToast(`已將「${res.clock.title}」複製到「${target.name || '未命名角色'}」的個人命刻！`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#d6c7ab]">
        <div>
          <h2 className="font-serif font-black text-2xl text-[#2c221e] flex items-center gap-2.5 tracking-wide">
            <span className="text-[#6b5a4b]">◷</span> 命刻編織者
          </h2>
          <p className="text-xs text-[#6b5a4b] mt-0.5">
            《物語手帳》命刻記錄典藏檢視 · 已整合至角色卡「個人命刻」分頁
          </p>
        </div>

        <span
          data-testid="fate-clock-readonly-badge"
          className="px-2.5 py-1 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#6b5a4b] font-bold text-t12 inline-flex items-center gap-1.5"
        >
          <GiPocketWatch className="w-3.5 h-3.5 text-[#8c3235]" />
          <span>唯讀保留中</span>
        </span>
      </div>

      {/* W7 第一階段：轉為唯讀並引導複製至角色卡 */}
      <div
        data-testid="fate-clock-readonly-banner"
        className="p-3.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] flex items-center justify-between flex-wrap gap-3 text-xs text-[#3c2415]"
      >
        <div className="space-y-1 flex-1 min-w-[240px]">
          <div className="font-bold text-[#8c3235] flex items-center gap-1.5">
            <GiSparkles className="w-3.5 h-3.5 shrink-0" />
            <span>命刻已改由角色卡持有（本頁轉為唯讀查閱）</span>
          </div>
          <p className="text-t12 text-[#6b5a4b] leading-relaxed">
            新的個人命刻請直接至「角色卡助手 → 跑團面板 → 個人命刻」建立與推進（技能【能言善辯】僅會推進角色卡內的命刻）。您可於下方將既有的舊命刻單顆複製到指定角色卡。
          </p>
        </div>

        {clocks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {roster.length > 0 ? (
              <label className="flex items-center gap-1.5 font-bold text-[#3c2415]">
                <span className="text-t11 text-[#6b5a4b]">複製目標角色：</span>
                <select
                  data-testid="fate-clock-target-char"
                  value={activeTargetChar?.id || ''}
                  onChange={(e) => setSelectedCharId(e.target.value)}
                  className="bg-[#fffdf9] border border-[#d6c7ab] rounded px-2.5 py-1 text-[#2c221e] text-xs font-bold outline-none"
                >
                  {roster.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name || '新冒險者'}（Lv {ch.level || 5}）
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="text-t11 font-bold text-[#7c6a58]">
                角色名冊為空，請先至「角色卡助手」建立角色
              </span>
            )}
          </div>
        )}
      </div>

      {/* Clocks Grid (Read-Only) */}
      {clocks.length === 0 ? (
        <EmptyState
          kind="fate-clocks"
          icon={GiClockwork}
          title="還沒有任何命刻"
          teach="命刻已整合至角色卡的「個人命刻」分頁；本獨立頁面現為唯讀典藏，不再新增命刻。"
          minHeight="260px"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clocks.map((clk) => {
            const themeName = CLOCK_THEMES[clk.theme || 'amber']?.name || '琥珀棕';
            return (
              <div
                key={clk.id}
                data-testid={`readonly-clock-card-${clk.id}`}
                className="bg-[#fffdf9] rounded border border-[#d6c7ab] p-5 transition-all flex flex-col items-center gap-4"
              >
                {/* Header */}
                <div className="w-full flex items-center justify-between gap-2 border-b border-[#e8dcc4] pb-2">
                  <h3 className="font-serif font-bold text-base text-[#2c221e] truncate">
                    {clk.title}
                  </h3>
                  <span className="text-t11 font-bold text-[#6b5a4b] tabular-nums shrink-0">
                    {clk.filledSegments} / {clk.totalSegments}
                  </span>
                </div>

                {/* Read-Only Clock Tracker */}
                <ClockTracker
                  totalSegments={clk.totalSegments || 6}
                  filledSegments={clk.filledSegments || 0}
                  theme={clk.theme || 'amber'}
                  type={clk.type || 'circle'}
                  size={135}
                  onChange={null}
                  compact={false}
                  showControls={false}
                />

                {/* Metadata + Copy to Character */}
                <div className="w-full pt-2 border-t border-[#e8dcc4] flex items-center justify-between gap-2 flex-wrap text-xs">
                  <span className="text-t11 text-[#6b5a4b]">
                    {clk.type === 'line' ? '線形進度' : '圓盤時鐘'} · {themeName}
                  </span>
                  <JRPGButton
                    variant="secondary"
                    size="xs"
                    icon={GiSparkles}
                    data-testid={`copy-clock-${clk.id}`}
                    disabled={!activeTargetChar}
                    onClick={() => handleCopyToCharacter(clk)}
                  >
                    複製到目前角色
                  </JRPGButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#fffdf9] border border-[#3c2415] text-[#2c221e] px-4 py-2.5 rounded flex items-center gap-2 font-medium text-xs animate-fade-in">
          <GiCheckMark className="w-4 h-4 text-[#245c45] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
