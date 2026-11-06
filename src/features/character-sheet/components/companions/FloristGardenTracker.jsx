
/**
 * 取得植物學家特定技能的 SL。
 */
export const getFloristSkillSL = (character, skillName) => {
  const florist = character?.classes?.find(c => c.className === '植物學家');
  const skill = florist?.skills?.find(s => s.name === skillName);
  return skill?.sl || 0;
};

/**
 * 檢查是否可播種（純函式）。
 */
export const canPlantSeed = (character, maxCapacity = 1, costMp = 20) => {
  const gardenList = character?.floristGarden || [];
  if (gardenList.length >= maxCapacity) {
    return { ok: false, reason: `花園容量已滿（上限 ${maxCapacity} 顆）！` };
  }
  const currentMp = character?.currentMp ?? character?.maxMp ?? 0;
  if (currentMp < costMp) {
    return { ok: false, reason: `MP 不足（需要 ${costMp}，現有 ${currentMp}）！` };
  }
  return { ok: true, currentMp };
};

/**
 * 執行播種：扣除 20 MP 並加入花園（純函式）。
 */
export const plantSeed = (character, seedName, { costMp = 20, maxCapacity = 1 } = {}) => {
  if (!seedName) return { ok: false, character, reason: '未指定種子' };
  const check = canPlantSeed(character, maxCapacity, costMp);
  if (!check.ok) return { ok: false, character, reason: check.reason };
  const gardenList = character?.floristGarden || [];
  const newEntry = {
    instanceId: `seed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    seedName,
    clock: 0,
    plantedAt: new Date().toISOString()
  };
  const nextChar = {
    ...character,
    currentMp: Math.max(0, check.currentMp - costMp),
    floristGarden: [...gardenList, newEntry],
    updatedAt: new Date().toISOString()
  };
  return { ok: true, character: nextChar, newEntry };
};

/**
 * 檢查是否可進行【嫁接】（純函式）。
 * 原書：只要生長命刻有 1 格或更多被填充（clock >= 1），可換成另一種已發現的不同種子並保持命刻格數。
 */
export const canGraftSeed = (character, instanceId, newSeedName) => {
  const garden = character?.floristGarden || [];
  const current = garden.find(i => i.instanceId === instanceId);
  if (!current) return { ok: false, reason: '花園中無此種子' };
  if ((current.clock || 0) < 1) return { ok: false, reason: '生長命刻必須至少有 1 格才能進行嫁接' };
  if (!newSeedName) return { ok: false, reason: '未指定要嫁接的新種子' };
  if (newSeedName === current.seedName) return { ok: false, reason: '必須嫁接不同種類的魔法種子' };
  return { ok: true, current };
};

/**
 * 執行【嫁接】（純函式）：換種並保留生長命刻格數。
 */
export const graftSeed = (character, instanceId, newSeedName) => {
  const check = canGraftSeed(character, instanceId, newSeedName);
  if (!check.ok) return { ok: false, character, reason: check.reason };
  const garden = character?.floristGarden || [];
  const updatedGarden = garden.map(item => {
    if (item.instanceId === instanceId) {
      return {
        ...item,
        seedName: newSeedName,
        // clock 保持不變！
        graftedAt: new Date().toISOString()
      };
    }
    return item;
  });
  return {
    ok: true,
    character: {
      ...character,
      floristGarden: updatedGarden,
      updatedAt: new Date().toISOString()
    }
  };
};

/**
 * 計算【生命之樹】治療量（純函式）：5 + (SL × 5)。
 */
export const getTreeOfLifeHeal = (sl = 1) => 5 + (sl * 5);

/**
 * 判定目標生物是否處於危機（純函式）。
 */
export const isCrisisState = (hp, maxHp) => {
  return (hp || 0) <= Math.floor((maxHp || 0) / 2);
};

/**
 * 移出花園並結算【生命之樹】（純函式）。
 */
export const removeSeedWithTreeOfLife = (
  character,
  instanceId,
  { treeOfLifeSL = 0, targetIsCrisis = false, healSelf = false } = {}
) => {
  const garden = character?.floristGarden || [];
  const removed = garden.find(i => i.instanceId === instanceId);
  if (!removed) return { ok: false, character, reason: '花園中無此種子' };
  const nextGarden = garden.filter(i => i.instanceId !== instanceId);
  let nextChar = {
    ...character,
    floristGarden: nextGarden,
    updatedAt: new Date().toISOString()
  };
  let healedAmount = 0;
  if (treeOfLifeSL > 0 && targetIsCrisis && healSelf) {
    healedAmount = getTreeOfLifeHeal(treeOfLifeSL);
    const curHp = nextChar.currentHp ?? nextChar.maxHp ?? 0;
    const maxHp = nextChar.maxHp ?? 999;
    nextChar.currentHp = Math.min(maxHp, curHp + healedAmount);
  }
  return {
    ok: true,
    character: nextChar,
    removedSeed: removed.seedName,
    clock: removed.clock || 0,
    healedAmount
  };
};

import React, { useState } from 'react';
import { GiSprout, GiFlowerPot, GiSparkles, GiCheckMark, GiHazardSign, GiPlantRoots } from 'react-icons/gi';
import EmptyState from '../../../../components/ui/EmptyState';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import CopyTextButton from '../../../../components/ui/CopyTextButton';
import { formatFloristSeedCopyText } from '../../utils/playCopyFormat';
import { FLORIST_MAGISEEDS, isSeedEffectActiveAt } from '../../data/skillSuboptionsData';

/**
 * 植物學家花園生長盤 (FloristGardenTracker)
 *
 * 專為植物學家【植生術】打造之跑團戰備追蹤盤：
 * 1. 花園**同時只能容納 1 顆魔法種子**——官方 Natural Fantasy 手冊 p.140 的 THE GARDEN
 *    寫得明確（`Your garden can only contain one magiseed at a time`），
 *    而且 CHLOROMANCY 的觸發條件是「if there are no magiseeds in your garden」、
 *    GRAFT／BRAMBLEHEART／GREATER CHLOROMANCY 也都以「花園裡的那一顆」為前提。
 *    ※ 舊版這個元件讓容量隨【植生術 SL】放大，那是錯的（本專案自己的規則速查
 *      `ruleCodexExpansion.js` 與跑團面板都採「一顆」模型，只有這裡例外）。
 * 2. 支援從已掌握的魔法種子中快速選擇並「播種至花園」。
 * 3. 每株已播種植物配備 0~4 格生長命刻，支援一鍵「+1 回合命刻」與「回合結束：花園全體生長」。
 * 4. 根據當前命刻（0~1格 / 2~3格 / 4格離園）即時高亮當前生效的機制效果，無需翻查手冊。
 */
export default function FloristGardenTracker({
  character,
  skillSL = 1,
  selectedOptions = [],
  onChange,
  showToast
}) {
  const [selectedSeedToPlant, setSelectedSeedToPlant] = useState('');
  const [graftingId, setGraftingId] = useState(null);
  const [graftTargetSeed, setGraftTargetSeed] = useState('');

  // 檢查是否掌握【嫁接】與【生命之樹】
  const hasGraft = getFloristSkillSL(character, '嫁接') > 0;
  const treeOfLifeSL = getFloristSkillSL(character, '生命之樹');

  // 取得角色當前花園資料
  const gardenList = character.floristGarden || [];
  // 官方上限就是 1（見檔頭）。`skillSL` 保留在 props 裡是為了「已掌握幾種種子」等其他用途，
  // 不再參與容量計算。
  const maxCapacity = 1;

  // 提取已掌握的種子定義清單
  const availableSeedNames = Array.isArray(selectedOptions) ? selectedOptions : [];
  const availableSeeds = FLORIST_MAGISEEDS.filter(s => availableSeedNames.includes(s.name));
  const fallbackSeeds = availableSeeds.length > 0 ? availableSeeds : FLORIST_MAGISEEDS;

  const updateGarden = (newGarden) => {
    if (!onChange) return;
    onChange({
      ...character,
      floristGarden: newGarden,
      updatedAt: new Date().toISOString()
    });
  };

  // 播種至花園
  const handlePlantSeed = (seedName) => {
    if (!seedName) return;
    const res = plantSeed(character, seedName, { costMp: 20, maxCapacity });
    if (!res.ok) {
      if (showToast) showToast(res.reason, 'warning');
      return;
    }
    if (onChange) onChange(res.character);
    setSelectedSeedToPlant('');
    if (showToast) showToast(`已將【${seedName}】播種至花園！消耗 20 MP，生長命刻：0 格。`, 'success');
  };

  // 執行【嫁接】換種
  const handleGraft = (instanceId, newSeed) => {
    const res = graftSeed(character, instanceId, newSeed);
    if (!res.ok) {
      if (showToast) showToast(res.reason, 'warning');
      return;
    }
    if (onChange) onChange(res.character);
    setGraftingId(null);
    setGraftTargetSeed('');
    if (showToast) showToast(`【嫁接】成功！已將種子換為【${newSeed}】，保留當前生長命刻！`, 'success');
  };

  // 推進單一植物命刻
  const handleStepClock = (instanceId, delta) => {
    const updated = gardenList.map(item => {
      if (item.instanceId === instanceId) {
        const nextClock = Math.max(0, Math.min(4, (item.clock || 0) + delta));
        return { ...item, clock: nextClock };
      }
      return item;
    });
    updateGarden(updated);
  };

  // 移出花園／收穫（結合【生命之樹】）
  const handleRemoveSeed = (instanceId, seedName) => {
    const maxHp = character?.maxHp ?? 999;
    const curHp = character?.currentHp ?? maxHp;
    const isSelfCrisis = isCrisisState(curHp, maxHp);

    const res = removeSeedWithTreeOfLife(character, instanceId, {
      treeOfLifeSL,
      targetIsCrisis: isSelfCrisis,
      healSelf: true
    });

    if (!res.ok) {
      if (showToast) showToast(res.reason, 'warning');
      return;
    }
    if (onChange) onChange(res.character);

    if (res.healedAmount > 0) {
      if (showToast) showToast(`已將【${seedName}】移出花園。觸發【生命之樹】！為處於危機的你恢復了 ${res.healedAmount} 點 HP！`, 'success');
    } else if (treeOfLifeSL > 0) {
      if (showToast) showToast(`已將【${seedName}】移出花園。【生命之樹】已就緒：可為一名處於危機的生物恢復 ${getTreeOfLifeHeal(treeOfLifeSL)} 點 HP！`, 'info');
    } else {
      if (showToast) showToast(`已將【${seedName}】移出花園。`, 'info');
    }
  };

  // 回合結束：花園全體生長 (+1 格)
  const handleAdvanceAll = () => {
    if (gardenList.length === 0) return;
    let fullSeeds = [];
    const updated = gardenList.map(item => {
      const nextClock = Math.min(4, (item.clock || 0) + 1);
      if (nextClock >= 4 && item.clock < 4) {
        fullSeeds.push(item.seedName);
      }
      return { ...item, clock: nextClock };
    });
    updateGarden(updated);

    if (fullSeeds.length > 0 && showToast) {
      showToast(`回合結束：花園全員推進 1 格！其中【${fullSeeds.join('、')}】已達 4 格，請於離園時結算效果！`, 'info');
    } else if (showToast) {
      showToast('回合結束：花園所有種子生長命刻推進 1 格！', 'success');
    }
  };

  return (
    <div className="p-3.5 rounded bg-[#fffdf9] border border-[#d6c7ab] space-y-3">
      {/* 頂部標題列 */}
      <div className="flex items-center justify-between border-b border-[#d6c7ab]/60 pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#245c45] text-white flex items-center justify-center shadow-e1 shrink-0">
            <GiFlowerPot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-[#245c45] tracking-wide font-serif flex items-center gap-1.5">
              <span>花園生長盤</span>
              <span className="font-mono text-t10 text-[#245c45] bg-[#f4ebd9] px-1.5 py-0.5 rounded border border-[#d6c7ab]">
                容量: {gardenList.length}/{maxCapacity}
              </span>
            </div>
            <div className="text-t10 text-[#245c45]/80">
              每回合結束推進 1 格生長命刻（滿 4 格離園）
            </div>
          </div>
        </div>

        {/* 全體回合推進按鈕 */}
        {gardenList.length > 0 && (
          <button
            type="button"
            onClick={handleAdvanceAll}
            className="px-2.5 py-1 rounded bg-[#245c45] hover:bg-[#1e4b39] text-white text-xs font-bold transition-all shadow-e1 flex items-center gap-1 cursor-pointer"
            title="回合結束時，將花園內所有植物命刻推進 1 格"
          >
            <GiSprout className="w-3.5 h-3.5" />
            <span>回合結束：花園全員 +1 格</span>
          </button>
        )}
      </div>

      {/* 播種操作列（未滿容量時顯示） */}
      {gardenList.length < maxCapacity && (
        <div className="flex items-center gap-2 p-2 bg-[#f4ebd9]/50 rounded border border-[#d6c7ab]/70 text-xs">
          <select
            value={selectedSeedToPlant}
            onChange={e => setSelectedSeedToPlant(e.target.value)}
            className="flex-1 bg-white border border-[#d6c7ab] rounded px-2.5 py-1 text-xs text-[#245c45] font-sans outline-none focus:ring-1 focus:ring-[#245c45] cursor-pointer"
          >
            <option value="">-- 選擇要播種的魔法種子 --</option>
            {fallbackSeeds.map(s => (
              <option key={s.id || s.name} value={s.name}>
                {s.name} ({s.duration || '至多 4 回合'})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handlePlantSeed(selectedSeedToPlant)}
            disabled={!selectedSeedToPlant}
            className="px-3 py-1 rounded bg-[#245c45] hover:bg-[#1e4b39] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>播種入園</span>
          </button>
        </div>
      )}

      {/* 已播種植物卡片列表 */}
      {gardenList.length > 0 ? (
        <div className="space-y-2">
          {gardenList.map(item => {
            const seedDef = FLORIST_MAGISEEDS.find(s => s.name === item.seedName);
            const clock = item.clock || 0;

            return (
              <div
                key={item.instanceId}
                className="p-3 rounded bg-white border border-[#d6c7ab] space-y-2 transition-all hover:border-[#245c45]"
              >
                {/* 植物抬頭與命刻控制 */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#245c45] shrink-0" />
                    <span className="font-serif font-black text-sm text-[#245c45]">
                      {item.seedName}
                    </span>
                    <span className="text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#245c45] border border-[#d6c7ab] font-bold">
                      {clock === 0 ? '剛播種 (0格)' : clock < 4 ? `第 ${clock === 1 ? '1' : clock} 回合 (${clock}/4 格)` : '滿 4 格（即將離園）'}
                    </span>
                  </div>

                  {/* 命刻步進與移出操作 */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <CopyTextButton
                      testId="copy-florist-seed"
                      toastLabel={item.seedName}
                      showToast={showToast}
                      getText={() =>
                        formatFloristSeedCopyText({
                          seedName: item.seedName,
                          clock,
                          seedDef,
                          characterName: character?.name || ''
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleStepClock(item.instanceId, -1)}
                      disabled={clock <= 0}
                      className="px-1.5 py-0.5 rounded text-t11 bg-[#f4ebd9] hover:bg-[#e8dcc4] disabled:opacity-30 text-[#3c2415] font-mono font-bold cursor-pointer"
                      title="後退 1 格"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepClock(item.instanceId, 1)}
                      disabled={clock >= 4}
                      className="px-2 py-0.5 rounded text-t11 bg-[#245c45] hover:bg-[#1e4b39] disabled:opacity-30 text-white font-mono font-bold transition-colors cursor-pointer flex items-center gap-0.5 shadow-e1"
                      title="前進 1 回合 (+1 格)"
                    >
                      <span>+1 格</span>
                    </button>
                    {hasGraft && clock >= 1 && (
                      <button
                        type="button"
                        data-testid="graft-seed"
                        onClick={() => {
                          if (graftingId === item.instanceId) {
                            setGraftingId(null);
                            setGraftTargetSeed('');
                          } else {
                            setGraftingId(item.instanceId);
                            setGraftTargetSeed('');
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-t11 font-bold transition-colors cursor-pointer border ${
                          graftingId === item.instanceId
                            ? 'bg-[#8c2d36] text-white border-[#8c2d36]'
                            : 'bg-[#f4ebd9] text-[#245c45] border-[#d6c7ab] hover:bg-[#e8dcc4]'
                        }`}
                        title="【嫁接】：換種並保留當前生長命刻格數"
                      >
                        <span>{graftingId === item.instanceId ? '取消嫁接' : '嫁接'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveSeed(item.instanceId, item.seedName)}
                      className="p-1 rounded text-[#6b5a4b] hover:text-[#8c2d36] transition-colors cursor-pointer"
                      title="移出花園"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 嫁接選擇列 */}
                {graftingId === item.instanceId && (
                  <div className="flex items-center gap-2 p-2 bg-[#f4ebd9] rounded border border-[#245c45] text-xs">
                    <span className="text-t11 font-bold text-[#245c45] shrink-0">嫁接為：</span>
                    <select
                      value={graftTargetSeed}
                      onChange={e => setGraftTargetSeed(e.target.value)}
                      className="flex-1 bg-white border border-[#d6c7ab] rounded px-2 py-1 text-xs text-[#245c45] font-sans outline-none focus:ring-1 focus:ring-[#245c45] cursor-pointer"
                    >
                      <option value="">-- 選擇新種子（保留 {clock} 格命刻）--</option>
                      {fallbackSeeds
                        .filter(s => s.name !== item.seedName)
                        .map(s => (
                          <option key={s.id || s.name} value={s.name}>
                            {s.name} ({s.duration || '至多 4 回合'})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!graftTargetSeed}
                      onClick={() => handleGraft(item.instanceId, graftTargetSeed)}
                      className="px-2.5 py-1 rounded bg-[#245c45] hover:bg-[#1e4b39] disabled:opacity-40 text-white font-bold text-xs transition-all shrink-0 cursor-pointer shadow-e1"
                    >
                      確認嫁接
                    </button>
                  </div>
                )}

                {/* 4 格命刻進度指示器 */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[1, 2, 3, 4].map(seg => {
                    const isFilled = clock >= seg;
                    const isCurrent = clock === seg || (clock === 0 && seg === 1);
                    return (
                      <div
                        key={seg}
                        onClick={() => {
                          if (clock === seg) {
                            handleStepClock(item.instanceId, -1);
                          } else {
                            handleStepClock(item.instanceId, seg - clock);
                          }
                        }}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          isFilled
                            ? 'bg-[#245c45] shadow-e1'
                            : 'bg-[#f4ebd9] border border-[#d6c7ab] hover:bg-[#f4ebd9]'
                        }`}
                        title={`點擊跳轉至命刻 ${seg} 格`}
                      />
                    );
                  })}
                </div>

                {/* 即時生效之階級效果（當前命刻高亮顯示） */}
                {seedDef?.effects && (
                  <div className="pt-1.5 space-y-1 text-xs">
                    {seedDef.effects.map((ef, efIdx) => {
                      // 判定此條目是否在當前生效 —— 一律走資料層的純函式，元件不自己比對字串。
                      // 舊版是在 clock 標籤上做子字串比對（找「0~1」「3 格」之類），把
                      // 「生長命刻 1~3 格」（熾焰菊／月光玉蘭／蒲公英之舞）與
                      // 「生長命刻 1~2 格」（朝聖者羚羊花）誤判成 2~3 格 → T = 1 時那一列不亮。
                      const isActive = isSeedEffectActiveAt(ef.clock, clock);

                      return (
                        <div
                          key={efIdx}
                          className={`p-1.5 rounded transition-all flex items-start gap-1.5 text-t11 leading-relaxed ${
                            isActive
                              ? 'bg-[#f4ebd9] border border-[#245c45] text-[#245c45] font-medium'
                              : 'text-[#6b5a4b] opacity-60'
                          }`}
                        >
                          <span className={`px-1.5 py-0.5 rounded text-t10 font-mono shrink-0 font-bold ${
                            isActive
                              ? 'bg-[#245c45] text-white'
                              : 'bg-[#f4ebd9] text-[#6b5a4b]'
                          }`}>
                            {ef.clock}
                          </span>
                          <span className="font-sans flex-1">
                            {renderTextWithAffinities(ef.text)}
                          </span>
                          {isActive && (
                            <span className="text-t10 text-[#245c45] font-bold shrink-0">
                              [生效中]
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          kind="florist-garden"
          icon={GiPlantRoots}
          title="花園裡還沒有種子"
          teach="挑一顆已掌握的魔法種子播下去，再用格子推進花期。"
        />
      )}
    </div>
  );
}
