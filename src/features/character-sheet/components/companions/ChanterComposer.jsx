import React, { useState, useMemo } from 'react';
import { GiMusicalNotes, GiCheckMark, GiSparkles, GiHazardSign } from 'react-icons/gi';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { CHANTER_DATA, composeChanterSong } from '../../data/skillSuboptionsData';
import { calculateCharacterStats } from '../../utils/characterEngine';

/**
 * 魔奏者魔法演奏即時合成器 (ChanterComposer)
 *
 * 專為跑團實戰打造：
 * 讓玩家在 HUD 中任意切換「音量 + 音調 + 曲風」，系統自動置換曲風變量，
 * 合成出最終的歌曲名稱、MP 消耗、目標與完整效果，並提供一鍵發動演奏（扣除 MP）與複製。
 */
export default function ChanterComposer({
  character,
  selectedOptions = {},
  onConsumeMp,
  showToast
}) {
  const stats = calculateCharacterStats(character);
  const currentMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : (stats.maxMp || 40);
  // 提取已掌握的音調與曲風
  const { availableKeys, availableTones } = useMemo(() => {
    let keys = [];
    let tones = [];

    if (Array.isArray(selectedOptions)) {
      selectedOptions.forEach(opt => {
        if (typeof opt === 'string') {
          if (opt.startsWith('音調:')) keys.push(opt.replace('音調:', '').trim());
          else if (opt.startsWith('曲風:')) tones.push(opt.replace('曲風:', '').trim());
          else {
            // 自動比對
            if (CHANTER_DATA.keys.some(k => k.name === opt)) keys.push(opt);
            else if (CHANTER_DATA.tones.some(t => t.name === opt)) tones.push(opt);
          }
        }
      });
    } else if (selectedOptions && typeof selectedOptions === 'object') {
      keys = selectedOptions.keys || [];
      tones = selectedOptions.tones || [];
    }

    return {
      availableKeys: keys.length > 0 ? keys : CHANTER_DATA.keys.map(k => k.name).slice(0, 2),
      availableTones: tones.length > 0 ? tones : CHANTER_DATA.tones.map(t => t.name).slice(0, 2)
    };
  }, [selectedOptions]);

  // 選中狀態
  const [selectedVolId, setSelectedVolId] = useState('vol_med'); // 預設中音 20 MP
  const [selectedKeyName, setSelectedKeyName] = useState(() => availableKeys[0] || '熾熱');
  const [selectedToneName, setSelectedToneName] = useState(() => availableTones[0] || '冷靜');
  const [copied, setCopied] = useState(false);

  // 合成當前歌曲
  const currentSong = useMemo(() => {
    return composeChanterSong(selectedVolId, selectedKeyName, selectedToneName);
  }, [selectedVolId, selectedKeyName, selectedToneName]);

  const isMpSufficient = currentMp >= (currentSong?.mp || 0);

  // 發動演奏
  const handlePerformSong = () => {
    if (!currentSong) return;

    if (!isMpSufficient) {
      if (showToast) showToast(`目前 MP (${currentMp}) 不足以支付該歌曲 (${currentSong.mp} MP)！`, 'warning');
      return;
    }

    if (onConsumeMp) {
      onConsumeMp(currentSong.mp);
      if (showToast) {
        showToast(`已成功演奏「${currentSong.songTitle}」，扣除 ${currentSong.mp} MP！`, 'success');
      }
    }
  };

  // 複製歌曲描述
  const handleCopySong = async () => {
    if (!currentSong) return;
    const textToCopy = `【${currentSong.songTitle}】\n消耗：${currentSong.mp} MP | 目標：${currentSong.target}\n效果：${currentSong.composedEffect}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (showToast) showToast('已複製歌曲效果到剪貼簿！', 'info');
    } catch {
      // fallback
    }
  };

  return (
    <div className="p-3.5 rounded bg-[#fffdf9] border border-[#d6c7ab] space-y-3">
      {/* 頂部標題列 */}
      <div className="flex items-center justify-between border-b border-[#d6c7ab]/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#5e387c] text-white flex items-center justify-center shadow-e1">
            <GiMusicalNotes className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-[#5e387c] tracking-wide font-serif">
              魔法演奏即時合成器
            </div>
            <div className="text-t10 text-[#5e387c]/80">
              選擇音量、音調與曲風，實時動態合成歌曲與消耗
            </div>
          </div>
        </div>

        <div className="text-t11 font-mono font-bold px-2 py-0.5 rounded bg-[#f4ebd9] text-[#5e387c] border border-[#d6c7ab]">
          當前 MP: {currentMp}
        </div>
      </div>

      {/* 選擇欄位 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        {/* ① 選擇音量 */}
        <div className="space-y-1.5 bg-white/80 p-2 rounded border border-[#d6c7ab]">
          <div className="font-bold text-t11 text-[#5e387c] flex items-center justify-between">
            <span>① 選擇音量</span>
            <span className="text-t10 text-[#6b5a4b]">消耗與目標</span>
          </div>
          <div className="flex flex-col gap-1">
            {CHANTER_DATA.volumes.map(vol => {
              const isSelected = selectedVolId === vol.id;
              return (
                <button
                  key={vol.id}
                  type="button"
                  onClick={() => setSelectedVolId(vol.id)}
                  className={`px-2 py-1.5 rounded text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#5e387c] text-white font-bold shadow-e1'
                      : 'bg-[#f4ebd9]/60 hover:bg-[#f4ebd9]/80 text-[#5e387c] border border-[#d6c7ab]'
                  }`}
                >
                  <span className="font-serif">{vol.name}</span>
                  <span className={`font-mono text-t10 px-1.5 py-0.5 rounded ${isSelected ? 'bg-[#5e387c]/90 text-white' : 'bg-white text-[#5e387c]'}`}>
                    {vol.mp} MP
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ② 選擇音調 */}
        <div className="space-y-1.5 bg-white/80 p-2 rounded border border-[#d6c7ab]">
          <div className="font-bold text-t11 text-[#9c4d16] flex items-center justify-between">
            <span>② 選擇音調</span>
            <span className="text-t10 text-[#6b5a4b]">已掌握</span>
          </div>
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-0.5">
            {availableKeys.map(kName => {
              const isSelected = selectedKeyName === kName;
              const keyData = CHANTER_DATA.keys.find(k => k.name === kName);
              return (
                <button
                  key={kName}
                  type="button"
                  onClick={() => setSelectedKeyName(kName)}
                  className={`px-2 py-1.5 rounded text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#9c4d16] text-white font-bold shadow-e1'
                      : 'bg-[#f4ebd9]/60 hover:bg-[#f4ebd9]/80 text-[#9c4d16] border border-[#d6c7ab]'
                  }`}
                >
                  <span className="font-serif truncate">{kName}</span>
                  {keyData && (
                    <span className={`text-t10 px-1 rounded ${isSelected ? 'bg-[#9c4d16]/90 text-white' : 'bg-white text-[#9c4d16]'}`}>
                      {keyData.damageType}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ③ 選擇曲風 */}
        <div className="space-y-1.5 bg-white/80 p-2 rounded border border-[#d6c7ab]">
          <div className="font-bold text-t11 text-[#5e387c] flex items-center justify-between">
            <span>③ 選擇曲風</span>
            <span className="text-t10 text-[#6b5a4b]">已掌握</span>
          </div>
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-0.5">
            {availableTones.map(tName => {
              const isSelected = selectedToneName === tName;
              return (
                <button
                  key={tName}
                  type="button"
                  onClick={() => setSelectedToneName(tName)}
                  className={`px-2 py-1.5 rounded text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#5e387c] text-white font-bold shadow-e1'
                      : 'bg-[#f4ebd9]/60 hover:bg-[#f4ebd9]/80 text-[#5e387c] border border-[#d6c7ab]'
                  }`}
                >
                  <span className="font-serif truncate">{tName}</span>
                  {isSelected && <GiCheckMark className="w-2.5 h-2.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 合成結果預覽展示卡 */}
      {currentSong && (
        <div className="p-3 bg-white rounded border-2 border-[#5e387c] space-y-2">
          {/* 歌名與數據標籤 */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#d6c7ab] pb-2">
            <div className="flex items-center gap-1.5">
              <GiSparkles className="w-4 h-4 text-[#5e387c] shrink-0" />
              <span className="font-bold text-sm text-[#5e387c] font-serif tracking-wide">
                {currentSong.songTitle}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="px-2 py-0.5 rounded-full bg-[#f4ebd9] text-[#27527a] font-bold border border-[#d6c7ab]">
                消耗：{currentSong.mp} MP
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] font-sans">
                目標：{currentSong.target}
              </span>
            </div>
          </div>

          {/* 音調特性輔助標籤 */}
          {currentSong.key && (
            <div className="flex flex-wrap gap-1.5 text-t10">
              <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#9c4d16] border border-[#d6c7ab]">
                傷害【{currentSong.key.damageType}】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#8c2d36] border border-[#d6c7ab]">
                狀態【{currentSong.key.status}】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#27527a] border border-[#d6c7ab] font-mono">
                屬性【{currentSong.key.attribute}】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#245c45] border border-[#d6c7ab]">
                恢復【{currentSong.key.recovery}】
              </span>
            </div>
          )}

          {/* 置換後的完整機制效果文本（透過 renderTextWithAffinities 帶官方字型符號高亮） */}
          <div className="text-xs text-[#3c2415] leading-relaxed font-sans bg-[#f4ebd9]/40 p-2.5 rounded border border-[#d6c7ab]/80">
            {renderTextWithAffinities(currentSong.composedEffect)}
          </div>

          {/* 操作按鈕 */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopySong}
              className="px-3 py-1.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              {copied ? <GiCheckMark className="w-3.5 h-3.5 text-[#245c45]" /> : null}
              <span>{copied ? '已複製！' : '複製歌曲效果'}</span>
            </button>

            <button
              type="button"
              onClick={handlePerformSong}
              disabled={!isMpSufficient}
              className={`px-4 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shadow-e1 cursor-pointer ${
                isMpSufficient
                  ? 'bg-[#5e387c] hover:bg-[#4f2e67] text-white shadow-[#3c2415]/30'
                  : 'bg-[#e8dcc4] text-[#7c6a58] cursor-not-allowed'
              }`}
            >
              <GiMusicalNotes className="w-3.5 h-3.5" />
              <span>發動演奏（消耗 {currentSong.mp} MP）</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
