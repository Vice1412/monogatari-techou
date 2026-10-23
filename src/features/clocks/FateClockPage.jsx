import React, { useState, useEffect } from 'react';
import { GiSparkles, GiTrashCan, GiPocketWatch, GiPalette, GiCheckMark, GiClockwork } from 'react-icons/gi';
import EmptyState from '../../components/ui/EmptyState';
import JRPGButton from '../../components/ui/JRPGButton';
import ClockTracker, { CLOCK_THEMES } from '../../components/ui/ClockTracker';
import { JRPGInput } from '../../components/ui/JRPGInput';
import { STORAGE_KEYS } from '../../data/keys';
import { readJSON, writeJSON } from '../../data/store';

const STORAGE_KEY = STORAGE_KEYS.fateClocks;

export default function FateClockPage({ initialClocks } = {}) {
  const [clocks, setClocks] = useState(() => {
    // 測試注入點（生產端永不傳入；不傳時行為逐字不變，見 AGENTS.md §1）。
    // SSR 不執行事件，沒有這個入口就永遠測不到空狀態那一段。
    if (Array.isArray(initialClocks)) return initialClocks;
    const saved = readJSON(STORAGE_KEY, null);
    if (saved) return saved;
    return [
      { id: 'fc_1', title: '深淵魔神的甦醒儀式', totalSegments: 8, filledSegments: 3, theme: 'red', type: 'circle' },
      { id: 'fc_2', title: '王國皇家禁衛隊抵達', totalSegments: 6, filledSegments: 2, theme: 'amber', type: 'line' },
      { id: 'fc_3', title: '古代禁咒解析進度', totalSegments: 6, filledSegments: 5, theme: 'blue', type: 'circle' }
    ];
  });

  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    writeJSON(STORAGE_KEY, clocks);
  }, [clocks]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAddClock = () => {
    const newClock = {
      id: `fc_${Date.now()}`,
      title: '新命刻進度',
      totalSegments: 6,
      filledSegments: 0,
      theme: 'amber',
      type: 'circle'
    };
    setClocks(prev => [newClock, ...prev]);
    showToast('已新增命刻！');
  };

  const handleUpdateClock = (clkId, patch) => {
    setClocks(prev => prev.map(c => c.id === clkId ? { ...c, ...patch } : c));
  };

  const handleDeleteClock = (clkId) => {
    setClocks(prev => prev.filter(c => c.id !== clkId));
    showToast('已刪除命刻');
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
            《物語手帳》進度時鐘工作台 · 支援圓盤切片與線形進度 · 多主題色調與即時互動
          </p>
        </div>

        {clocks.length > 0 && (
          <JRPGButton
            variant="primary"
            size="sm"
            icon={GiSparkles}
            onClick={handleAddClock}
          >
            新增進度命刻
          </JRPGButton>
        )}
      </div>

      {/* Clocks Grid */}
      {clocks.length === 0 ? (
        /* 空狀態：2026-10-23（v5.1）
           這章原本**完全沒有空狀態**——把三顆範例命刻刪光之後，畫面只剩標題、
           一顆按鈕與一大片空白（`clocks.map` 對空陣列就是什麼都不畫）。
           Refactoring UI §8.4：空狀態是使用者**保證會看到**的畫面，不是例外。
           做法與 NPC 工坊一致（同一個視覺語法：虛線框＋敘事圖示＋一句解釋＋唯一動作），
           並且在空狀態時**不顯示**標頭那顆「新增進度命刻」——
           同一個動作在一屏裡喊兩次，等於告訴使用者「這裡有兩件不同的事」。 */
        <EmptyState
          kind="fate-clocks"
          icon={GiClockwork}
          title="還沒有任何命刻"
          teach="命刻用來記錄反派陰謀、倒數計時與場景危機的推進；先建立一個，再逐格填滿它。"
          action={{ label: '建立第一個命刻', onClick: handleAddClock, icon: GiSparkles }}
          minHeight="260px"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clocks.map(clk => (
          <div
            key={clk.id}
            className="bg-[#fffdf9] rounded-xl border border-[#d6c7ab] hover:border-[#3c2415] p-5 hover:shadow-md transition-all flex flex-col items-center gap-4 relative group"
          >
            {/* Top Toolbar */}
            <div className="w-full flex items-center justify-between border-b border-[#d6c7ab]/80 pb-2">
              <input
                type="text"
                value={clk.title}
                onChange={e => handleUpdateClock(clk.id, { title: e.target.value })}
                placeholder="命刻名稱..."
                className="bg-transparent font-serif font-bold text-base text-[#2c221e] outline-none flex-1 border-b border-transparent focus:border-[#3c2415] mr-2"
              />

              <button
                type="button"
                onClick={() => handleDeleteClock(clk.id)}
                className="text-[#7c6a58] hover:text-rose-700 p-1 transition-colors"
                title="刪除命刻"
              >
                <GiTrashCan className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Clock Tracker */}
            <ClockTracker
              totalSegments={clk.totalSegments || 6}
              filledSegments={clk.filledSegments || 0}
              theme={clk.theme || 'amber'}
              type={clk.type || 'circle'}
              size={135}
              onChange={newVal => handleUpdateClock(clk.id, { filledSegments: newVal })}
              compact={false}
              showControls={true}
            />

            {/* Config Toolbar */}
            <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t border-[#d6c7ab]/80 text-xs">
              {/* Type toggle */}
              <select
                value={clk.type || 'circle'}
                onChange={e => handleUpdateClock(clk.id, { type: e.target.value })}
                className="bg-[#fffdf9] border border-[#d6c7ab] rounded px-2 py-1 text-[#2c221e] text-xs outline-none font-medium"
              >
                <option value="circle">圓盤時鐘</option>
                <option value="line">線形進度</option>
              </select>

              {/* Segments count */}
              <select
                value={clk.totalSegments || 6}
                onChange={e => {
                  const seg = parseInt(e.target.value, 10);
                  handleUpdateClock(clk.id, {
                    totalSegments: seg,
                    filledSegments: Math.min(clk.filledSegments || 0, seg)
                  });
                }}
                className="bg-[#fffdf9] border border-[#d6c7ab] rounded px-2 py-1 text-[#2c221e] text-xs outline-none font-mono font-bold"
              >
                <option value={4}>4 格</option>
                <option value={6}>6 格</option>
                <option value={8}>8 格</option>
                <option value={10}>10 格</option>
                <option value={12}>12 格</option>
              </select>

              {/* Theme color */}
              <select
                value={clk.theme || 'amber'}
                onChange={e => handleUpdateClock(clk.id, { theme: e.target.value })}
                className="bg-[#fffdf9] border border-[#d6c7ab] rounded px-2 py-1 text-[#2c221e] text-xs outline-none font-medium"
              >
                {Object.keys(CLOCK_THEMES).map(tKey => (
                  <option key={tKey} value={tKey}>
                    {CLOCK_THEMES[tKey].name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#fffdf9] border border-[#3c2415] text-[#2c221e] px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 font-medium text-xs animate-fade-in">
          <GiCheckMark className="w-4 h-4 text-[#6b5a4b] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
