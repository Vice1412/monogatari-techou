import React, { useState, useEffect } from 'react';
import {
  GiSparkles,
  GiD12,
  GiD10,
  GiDiceEightFacesEight,
  GiDiceSixFacesSix
} from 'react-icons/gi';
import { Info, X, RotateCcw, Check } from 'lucide-react';
// 三大屬性陣列與四個屬性名都是**資料**，放在 data/ 讓測試可以直接匯入（不必把 React 拉進 node 測試）
import { ATTRIBUTE_PRESET_ARRAYS, ATTRIBUTE_NAMES, ATTRIBUTE_KEYS } from '../data/sourcebookConfig';
import { ATTRIBUTE_DICE_TIERS } from '../utils/characterEngine';
import {
  buildTrayPool,
  assignPoolInOrder,
  applyPreset as applyPresetToPool
} from '../utils/attributePresets';

/**
 * 骰階色彩漸層配置（視覺直覺區分，無文字贅述）：
 * - d12 / d10（最大/強勢）：青色 (Cyan / Teal 漸層)
 * - d8（第二/基準）：深琥珀金黃色 (Amber / Golden Honey，加深對比，杜絕刺眼)
 * - d6（最小/短板）：紅色 (Rose / Red 漸層)
 */
export const getDiceColorConfig = (val) => {
  if (val >= 12) {
    return {
      bgClass: 'bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-600',
      borderClass: 'border-teal-400',
      textClass: 'text-slate-950 font-black',
      glow: 'shadow-teal-500/40 ring-2 ring-cyan-300'
    };
  }
  if (val === 10) {
    return {
      bgClass: 'bg-gradient-to-br from-cyan-400 via-teal-500 to-teal-700',
      borderClass: 'border-teal-500',
      textClass: 'text-slate-950 font-black',
      glow: 'shadow-teal-600/30 ring-1 ring-teal-400/50'
    };
  }
  if (val === 8) {
    // 沉穩飽和的琥珀深金色，字體與圖標採用深黑純色，保證高對比與清晰度
    return {
      bgClass: 'bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600',
      borderClass: 'border-amber-600',
      textClass: 'text-slate-950 font-black',
      glow: 'shadow-amber-600/40 ring-1 ring-amber-500/60'
    };
  }
  // d6 或更低
  return {
    bgClass: 'bg-gradient-to-br from-rose-500 via-red-600 to-rose-700',
    borderClass: 'border-rose-700',
    textClass: 'text-white font-black',
    glow: 'shadow-rose-600/30 ring-1 ring-rose-400/50'
  };
};

/**
 * 根據骰階面數獲取對應的 Game-Icon 多面骰幾何標誌
 */
export const getDieIcon = (val) => {
  if (val >= 12) return GiD12;
  if (val === 10) return GiD10;
  if (val === 8) return GiDiceEightFacesEight;
  return GiDiceSixFacesSix;
};

/**
 * 四大屬性特質簡明解讀 (按需透過 ⓘ 彈窗查看)
 * 嚴格遵循：先寫 DEX 再寫中文，無圖標干擾
 */
const ATTRIBUTE_DETAILS = {
  dex: {
    key: 'dex',
    enName: 'DEX',
    name: ATTRIBUTE_NAMES.dex,
    tags: '先攻順序 · 輕刃/遠程命中 · 基礎迴避 DEF',
    mechanics: [
      { label: '命中判定', desc: '單手劍、匕首、弓弩、投擲武器的主判定骰' },
      { label: '先攻速度', desc: '決定戰鬥輪次的先手判定加值' },
      { label: '物理迴避', desc: `未著重鎧甲時，直接以${ATTRIBUTE_NAMES.dex}骰階作為 DEF` },
      { label: '狀態扣減', desc: '陷入【緩慢】或【憤怒】時下降一階' }
    ]
  },
  ins: {
    key: 'ins',
    enName: 'INS',
    name: ATTRIBUTE_NAMES.ins,
    tags: '法術導引 · 弱點研究 · 基礎魔防 M.DEF',
    mechanics: [
      { label: '法術命中', desc: '攻擊性咒語、法杖導引與秘術奇蹟核心判定' },
      { label: '魔法防禦', desc: '未著魔防護具時，直接以洞察骰階作為 M.DEF' },
      { label: '情報研究', desc: '戰鬥中執行「研究」剖析敵方相性與弱點' },
      { label: '狀態扣減', desc: '陷入【眩暈】或【憤怒】時下降一階' }
    ]
  },
  mig: {
    key: 'mig',
    enName: 'MIG',
    name: ATTRIBUTE_NAMES.mig,
    tags: '生命上限 HP · 危機門檻 Crisis · 重兵器',
    mechanics: [
      { label: '生命上限', desc: `HP MAX 核心基底：【${ATTRIBUTE_NAMES.mig}骰面 × 5 ＋ 等級】` },
      { label: '危機門檻', desc: '生命上限的一半（≤ 此值觸發英雄特技加成）' },
      { label: '重型近戰', desc: '巨劍、巨錘、戰斧之命中判定與主要威力來源' },
      { label: '狀態扣減', desc: '陷入【虛弱】或【中毒】時下降一階' }
    ]
  },
  wlp: {
    key: 'wlp',
    enName: 'WLP',
    name: ATTRIBUTE_NAMES.wlp,
    tags: '魔力上限 MP · 奇蹟燃料 · 心智抗性',
    mechanics: [
      { label: '魔力上限', desc: 'MP MAX 核心基底：【意志骰面 × 5 ＋ 等級】' },
      { label: '法術燃料', desc: '施展咒語、維持結界與儀式之能量儲備' },
      { label: '心智耐受', desc: '抵抗恐懼、魅惑、心靈震懾檢定之關鍵防線' },
      { label: '狀態扣減', desc: '陷入【動搖】或【中毒】時下降一階' }
    ]
  }
};

const STAT_KEYS = ATTRIBUTE_KEYS;

export default function AttributeMatrixPicker({
  // 預設是空的（0 = 尚未指派）——不替玩家先套「萬事通」，見 createNewCharacter 的註解。
  attributes = { dex: 0, ins: 0, mig: 0, wlp: 0 },
  onChange = () => {},
  // 等級獎勵還能用幾次（原書 p.229：20／40 級各一次）。0 = 不顯示升級列。
  remainingUpgrades = 0,
  theme = {}
}) {
  // 4 顆骰子物件（每個骰子有獨立 ID、面數、以及當前放置在何處 assignedTo: 'dex'|'ins'|'mig'|'wlp'|null）
  //
  // 四維還沒指派時（`createNewCharacter` 的預設 0）**托盤是空的**——使用者指示：
  // 「要讓玩家自己選起始陣列才會在那邊出現 4 個骰子」。舊版會在空托盤先放
  // d10/d8/d8/d6（正好是「標準」那四顆），等於又替玩家選了一次。
  const [dicePool, setDicePool] = useState(() => {
    const hasInitialAttrs = attributes && (attributes.dex || attributes.ins || attributes.mig || attributes.wlp);
    if (!hasInitialAttrs) return [];
    return [
      { id: 'd_0', val: attributes.dex || 10, assignedTo: 'dex' },
      { id: 'd_1', val: attributes.ins || 8, assignedTo: 'ins' },
      { id: 'd_2', val: attributes.mig || 8, assignedTo: 'mig' },
      { id: 'd_3', val: attributes.wlp || 6, assignedTo: 'wlp' }
    ];
  });

  // 浮動拿起狀態（跟隨滑鼠）
  const [floatingDieId, setFloatingDieId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: -999, y: -999 });

  // 拖曳狀態
  const [draggedDieId, setDraggedDieId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [isTrayDragOver, setIsTrayDragOver] = useState(false);

  // ⓘ 說明彈窗
  const [infoModalKey, setInfoModalKey] = useState(null);

  // 全局滑鼠追蹤：當有骰子被「拿起浮動」時，即時更新游標座標
  useEffect(() => {
    if (!floatingDieId) return;

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFloatingDieId(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [floatingDieId]);

  // 當前指派映射
  const assignedDiceMap = {};
  dicePool.forEach(die => {
    if (die.assignedTo) {
      assignedDiceMap[die.assignedTo] = die;
    }
  });

  // 托盤中未指派的骰子
  const unassignedDice = dicePool.filter(d => !d.assignedTo);

  // 統計已分配數量與總點數
  const assignedCount = dicePool.filter(d => d.assignedTo).length;
  const currentTotalFace = dicePool.filter(d => d.assignedTo).reduce((sum, d) => sum + d.val, 0);

  // 當前正在浮動的骰子資料
  const floatingDie = floatingDieId ? dicePool.find(d => d.id === floatingDieId) : null;
  const floatingCol = floatingDie ? getDiceColorConfig(floatingDie.val) : null;
  const FloatingDieIcon = floatingDie ? getDieIcon(floatingDie.val) : null;

  /**
   * 等級獎勵：把某一顆屬性骰 +1 階（原書 p.229）。
   * 上限 d12——已經是 d12 的那顆，按鈕會停用。
   */
  const handleUpgradeDie = (statKey) => {
    const idx = dicePool.findIndex((d) => d.assignedTo === statKey);
    if (idx < 0) return;
    const at = ATTRIBUTE_DICE_TIERS.indexOf(dicePool[idx].val);
    if (at < 0 || at >= ATTRIBUTE_DICE_TIERS.length - 1) return;
    const next = dicePool.map((d, i) => (i === idx ? { ...d, val: ATTRIBUTE_DICE_TIERS[at + 1] } : d));
    setDicePool(next);
    notifyParent(next);
  };

  // 同步通知父層
  const notifyParent = (newPool) => {    const newAttrs = { ...attributes };
    let anyAssigned = false;
    newPool.forEach(d => {
      if (d.assignedTo) {
        newAttrs[d.assignedTo] = d.val;
        anyAssigned = true;
      }
    });
    if (anyAssigned) {
      onChange(newAttrs);
    }
  };

  // 1. 選擇預設起始陣列：骰子直接入座並寫回屬性。
  //
  // 舊版只把骰子丟進左側托盤、**不通知父層**，所以點「萬事通」之後四維仍是 0——
  // 玩家會以為卡片壞了（實測確實如此）。預設卡本身就把四個數值寫在卡面上，
  // 按下去卻沒有任何一格被填，這個落差沒有任何人能從畫面上推出來。
  // 現在改成一步到位（依 DEX／INS／MIG／WLP 的固定順序入座），
  // 想自己排的人按「全部清空回托盤」再拖曳即可。
  const handleApplyPreset = (preset) => {
    const { pool, attributes: nextAttrs } = applyPresetToPool(preset, `d_${Date.now()}`);
    setDicePool(pool);
    setFloatingDieId(null);
    if (nextAttrs) onChange(nextAttrs);
  };

  // 2. 一鍵填滿（按順序快速入座）
  const handleAutoFill = () => {
    const source = dicePool.length > 0
      ? dicePool
      : buildTrayPool(ATTRIBUTE_PRESET_ARRAYS[0], 'd_auto');
    const newPool = assignPoolInOrder(source);
    setDicePool(newPool);
    setFloatingDieId(null);
    notifyParent(newPool);
  };

  // 3. 全部清空回托盤
  const handleClearToTray = () => {
    const newPool = dicePool.map(die => ({
      ...die,
      assignedTo: null
    }));
    setDicePool(newPool);
    setFloatingDieId(null);
  };

  // 4. 點選托盤中的實體骰子（點一下拿起跟隨滑鼠，或放回）
  const handleTrayDieClick = (dieId, e) => {
    e?.stopPropagation();
    if (floatingDieId === dieId) {
      // 再次點擊自己：放下取消
      setFloatingDieId(null);
    } else if (floatingDieId) {
      // 拿著別的骰子點擊托盤中的骰子：將手上的骰子放回托盤
      const newPool = dicePool.map(d => d.id === floatingDieId ? { ...d, assignedTo: null } : d);
      setDicePool(newPool);
      setFloatingDieId(null);
      notifyParent(newPool);
    } else {
      // 拿起這顆骰子跟隨滑鼠浮動！
      setFloatingDieId(dieId);
      if (e) setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // 5. 點選體質宮格 (Slot Click Handler)
  const handleSlotClick = (statKey, e) => {
    const currentSlottedDie = assignedDiceMap[statKey];

    // 如果手上正拿著浮動的骰子 -> 放進此宮格！
    if (floatingDieId) {
      const activeDie = dicePool.find(d => d.id === floatingDieId);
      if (!activeDie) return;

      // 如果點擊的是這顆骰子原本就所在的宮格，則直接放下取消
      if (activeDie.assignedTo === statKey) {
        setFloatingDieId(null);
        return;
      }

      const newPool = dicePool.map(d => {
        // 目標格子若原本已有骰子，則該骰子移到浮動骰子的原位置 (互換)，若原無位置則退回托盤
        if (d.assignedTo === statKey) {
          return { ...d, assignedTo: activeDie.assignedTo || null };
        }
        // 浮動骰子放入此宮格
        if (d.id === floatingDieId) {
          return { ...d, assignedTo: statKey };
        }
        return d;
      });

      setDicePool(newPool);
      setFloatingDieId(null);
      notifyParent(newPool);
    } else {
      // 手上沒拿骰子時，點擊已有骰子的宮格 -> 拿起這顆骰子跟隨滑鼠浮動！
      if (currentSlottedDie) {
        setFloatingDieId(currentSlottedDie.id);
        if (e) setMousePos({ x: e.clientX, y: e.clientY });
      }
    }
  };

  // 6. 點選托盤背景：若手上拿著浮動骰子，點擊托盤即可將其收回托盤！
  const handleTrayClick = () => {
    if (floatingDieId) {
      const newPool = dicePool.map(d => d.id === floatingDieId ? { ...d, assignedTo: null } : d);
      setDicePool(newPool);
      setFloatingDieId(null);
      notifyParent(newPool);
    }
  };

  // 7. 點選托盤上的虛線凹槽 (Ghost Socket)
  const handleGhostSocketClick = (dieId, e) => {
    e?.stopPropagation();
    if (floatingDieId) {
      // 手上有浮動骰子，放回托盤
      handleTrayClick();
    } else {
      // 手上沒拿骰子時，點擊凹槽可直接把該體質內的骰子抓到手上浮動！
      setFloatingDieId(dieId);
      if (e) setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // 8. Drag & Drop: 開始拖曳
  const handleDragStart = (dieId, e) => {
    setDraggedDieId(dieId);
    setFloatingDieId(null); // 進入原生拖曳時關閉點擊浮動
    e.dataTransfer.setData('text/plain', dieId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 9. Drag & Drop: 拖進體質宮格
  const handleDragOver = (statKey, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== statKey) setDragOverKey(statKey);
  };

  const handleDragLeave = (statKey) => {
    if (dragOverKey === statKey) setDragOverKey(null);
  };

  const handleDrop = (statKey, e) => {
    e.preventDefault();
    setDragOverKey(null);
    const dieId = e.dataTransfer.getData('text/plain') || draggedDieId;
    if (!dieId) return;

    const draggedDie = dicePool.find(d => d.id === dieId);
    if (!draggedDie) return;

    const newPool = dicePool.map(d => {
      if (d.assignedTo === statKey) {
        return { ...d, assignedTo: draggedDie.assignedTo || null };
      }
      if (d.id === dieId) {
        return { ...d, assignedTo: statKey };
      }
      return d;
    });

    setDicePool(newPool);
    setDraggedDieId(null);
    setFloatingDieId(null);
    notifyParent(newPool);
  };

  // 10. Drag & Drop: 拖回托盤！
  const handleTrayDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isTrayDragOver) setIsTrayDragOver(true);
  };

  const handleTrayDragLeave = () => {
    setIsTrayDragOver(false);
  };

  const handleDropToTray = (e) => {
    e.preventDefault();
    setIsTrayDragOver(false);
    const dieId = e.dataTransfer.getData('text/plain') || draggedDieId;
    if (!dieId) return;

    const newPool = dicePool.map(d => {
      if (d.id === dieId) {
        return { ...d, assignedTo: null };
      }
      return d;
    });

    setDicePool(newPool);
    setDraggedDieId(null);
    setFloatingDieId(null);
    notifyParent(newPool);
  };

  // 判斷當前是否與三大預設完全吻合
  const poolSortedVals = [...dicePool].map(d => d.val).sort((a, b) => b - a);

  return (
    <div className="space-y-4 relative">
      {/* ==================== 浮動骰子跟隨游標 (Click-to-Pick-up Mouse Follower) ==================== */}
      {floatingDie && mousePos.x > 0 && (
        <div
          className="fixed pointer-events-none z-[99999] transition-transform duration-75 ease-out flex flex-col items-center select-none"
          style={{
            left: `${mousePos.x}px`,
            top: `${mousePos.y}px`,
            transform: 'translate(-50%, -50%) scale(1.08)',
          }}
        >
          <div
            className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-1 shadow-2xl ring-4 ring-amber-400/90 ${floatingCol.bgClass} ${floatingCol.borderClass} ${floatingCol.glow}`}
          >
            <FloatingDieIcon className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 ${floatingCol.textClass} drop-shadow-md`} />
            <span className={`font-mono text-base sm:text-lg font-black ${floatingCol.textClass} drop-shadow-md mt-1 leading-none`}>
              d{floatingDie.val}
            </span>
          </div>
          <div className="mt-2 px-2.5 py-0.5 rounded-full bg-slate-950/90 text-white text-[10px] font-bold border border-slate-700 shadow-xl whitespace-nowrap">
            點擊體質入座 · ESC 取消
          </div>
        </div>
      )}

      {/* ==================== 頂部：三大起始陣列 ＋ 快捷功能按鈕 ==================== */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border shadow-xs" style={{ borderColor: theme.border || '#e2e8f0' }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <GiSparkles className="w-4 h-4" style={{ color: theme.accent || '#059669' }} />
            <span className="font-serif font-black text-xs sm:text-sm text-slate-900">
              選擇起始陣列
            </span>
          </div>

          {/* 快捷操作按鈕 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFill}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
              style={{ backgroundColor: theme.subpanelBg || '#ecfdf5', color: theme.textDark || '#064e3b', borderColor: theme.border || '#a7f3d0' }}
              title="按預設順序一鍵填入四個體質"
            >
              <Check className="w-3.5 h-3.5" style={{ color: theme.accent || '#059669' }} />
              <span>一鍵填入</span>
            </button>
            <button
              type="button"
              onClick={handleClearToTray}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 shadow-2xs"
              title="將所有已放出的骰子收回黑色托盤"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>清空回盤</span>
            </button>
          </div>
        </div>

        {/* 三套起始陣列卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ATTRIBUTE_PRESET_ARRAYS.map(preset => {
            // 「目前」只有在四顆骰子都真的指派完、且組合等於這一組時才顯示。
            // 空托盤本來就放著「標準」那四顆（d10/d8/d8/d6），少了 assignedCount 這一項，
            // 一個還沒選配置的角色會被標成「標準（目前）」——等於又替他選了一次。
            const isMatch = assignedCount === 4 && preset.diceList.every((v, i) => v === poolSortedVals[i]);

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                  isMatch
                    ? 'shadow-xs ring-2'
                    : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200'
                }`}
                style={isMatch ? {
                  backgroundColor: theme.subpanelBg || '#fef3c7',
                  borderColor: theme.accent || '#b45309',
                  '--tw-ring-color': theme.border || '#cbd5e1'
                } : {}}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900 transition-colors" style={isMatch ? { color: theme.textDark } : {}}>
                      {preset.name}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.2 rounded font-medium"
                      style={isMatch ? { backgroundColor: theme.cardBg || '#ffffff', color: theme.textDark || '#0f172a', fontWeight: 'bold' } : { backgroundColor: '#e2e8f0', color: '#475569' }}
                    >
                      {isMatch ? '目前' : preset.tag}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {preset.diceList.map((dVal, dIdx) => {
                      const col = getDiceColorConfig(dVal);
                      const DieIcon = getDieIcon(dVal);
                      return (
                        <span
                          key={dIdx}
                          className={`font-mono font-black text-[11px] px-2 py-0.5 rounded shadow-2xs flex items-center gap-1 ${col.bgClass} ${col.textClass}`}
                        >
                          <DieIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span>d{dVal}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================== 等級獎勵：屬性骰 +1 階（原書 p.229） ==================== */}
      {remainingUpgrades > 0 && (
        <div
          className="rounded-xl border-2 px-3 py-2.5 space-y-2"
          style={{ backgroundColor: theme.subpanelBg || '#f5efdf', borderColor: theme.accent || '#b45309' }}
        >
          <div className="text-xs leading-relaxed" style={{ color: theme.textDark || '#3c2415' }}>
            <strong>等級獎勵：可以選一顆屬性骰 +1 階</strong>
            <span className="text-[11px] ml-1.5 opacity-80">
              （20 級與 40 級各一次，上限 d12，加在<strong>基礎</strong>骰上；還剩 {remainingUpgrades} 次）
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ATTRIBUTE_KEYS.map((key) => {
              const die = dicePool.find((d) => d.assignedTo === key);
              const at = die ? ATTRIBUTE_DICE_TIERS.indexOf(die.val) : -1;
              const maxed = at >= ATTRIBUTE_DICE_TIERS.length - 1;
              const next = at >= 0 ? ATTRIBUTE_DICE_TIERS[at + 1] : null;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!die || maxed}
                  onClick={() => handleUpgradeDie(key)}
                  title={!die ? '先把骰子分配到這一項' : maxed ? '已經是 d12（上限）' : `把 ${ATTRIBUTE_NAMES[key]} 從 d${die.val} 升到 d${next}`}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  style={{ backgroundColor: theme.cardBg || '#fffdf9', borderColor: theme.border || '#d6c7ab', color: theme.textDark || '#3c2415' }}
                >
                  {key.toUpperCase()} {die ? `d${die.val}` : '—'}
                  {!maxed && next ? ` ➔ d${next}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 狀態指示列 ==================== */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs px-1">
        <span className="text-xs text-slate-400">
          點擊或拖曳骰子分配至體質（支援拖回收回）
        </span>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-500">
            已分配: <strong className="text-slate-900">{assignedCount}/4</strong>
          </span>
          {assignedCount === 4 && (
            <span
              className="font-bold px-2 py-0.5 rounded border text-[11px] transition-colors"
              style={{ backgroundColor: theme.subpanelBg || '#f5efdf', color: theme.textDark || '#3c2415', borderColor: theme.border || '#d6c7ab' }}
            >
              已完成
            </span>
          )}
        </div>
      </div>

      {/* ==================== 主工作區：【直列排布】左側托盤 ⟷ 右側四大體質直列 ==================== */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        
        {/* ==================== 黑色托盤 (Dice Tray) - 正方形骰子框 ＋ 支援拖回/點擊收回 ==================== */}
        <div
          onDragOver={handleTrayDragOver}
          onDragLeave={handleTrayDragLeave}
          onDrop={handleDropToTray}
          onClick={handleTrayClick}
          className={`w-full md:w-44 lg:w-48 shrink-0 bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-md border transition-all flex flex-col justify-between cursor-pointer select-none ${
            isTrayDragOver || (floatingDieId && floatingDie?.assignedTo)
              ? 'ring-4 ring-amber-400 border-amber-400 bg-slate-800 scale-[1.02]'
              : 'border-slate-800 hover:border-slate-700'
          }`}
          title={floatingDieId ? '點擊此處收回' : '點選或拖曳骰子；體質內的骰子可直接拖回此處收回'}
        >
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-[10px] font-mono text-slate-400">
                {isTrayDragOver ? (
                  <span className="text-amber-300 font-bold animate-pulse">放開收回</span>
                ) : (
                  <span>剩餘 {unassignedDice.length}</span>
                )}
              </span>
            </div>

            {/* 托盤空的時候給一句提示——不然整塊會看起來像壞掉 */}
            {dicePool.length === 0 && (
              <div className="flex justify-center items-center py-3">
                <span className="text-[10px] leading-snug text-slate-500 text-center">
                  先從上方<br />選一組起始陣列
                </span>
              </div>
            )}

            {/* 托盤內的 4 個正方形骰子位置：手機橫向 4 個，桌面直列 4 個 */}
            <div className="flex md:flex-col justify-center md:items-center gap-2.5">
              {dicePool.map((die) => {
                const isAssigned = !!die.assignedTo;
                const isFloating = floatingDieId === die.id;
                const col = getDiceColorConfig(die.val);
                const DieIcon = getDieIcon(die.val);

                if (isAssigned) {
                  // 已被拿走的骰子留下虛線凹槽 (Ghost Square Socket)
                  const targetDetail = ATTRIBUTE_DETAILS[die.assignedTo];

                  return (
                    <div
                      key={die.id}
                      onClick={(e) => handleGhostSocketClick(die.id, e)}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsTrayDragOver(true); }}
                      onDrop={handleDropToTray}
                      className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 aspect-square rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-1 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        isFloating ? 'ring-2 ring-amber-400 border-amber-400 opacity-30' : 'hover:border-slate-600 hover:bg-slate-900/60'
                      }`}
                      title={`已分配至【${targetDetail?.enName} ${targetDetail?.name}】。點擊可拿起此骰子浮動`}
                    >
                      <DieIcon className="w-5 h-5 text-slate-600 shrink-0" />
                      <span className="text-[11px] font-mono text-slate-500 font-black mt-0.5 leading-none">
                        d{die.val}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 px-1.5 py-0.2 rounded bg-slate-800/80 truncate max-w-[54px]">
                        {targetDetail?.enName}
                      </span>
                    </div>
                  );
                }

                // 躺在托盤中的正方形實體骰子
                return (
                  <div
                    key={die.id}
                    draggable
                    onDragStart={(e) => handleDragStart(die.id, e)}
                    onClick={(e) => handleTrayDieClick(die.id, e)}
                    className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 aspect-square rounded-2xl border-2 p-1 flex flex-col items-center justify-center select-none cursor-grab active:cursor-grabbing transition-all ${
                      col.bgClass
                    } ${col.borderClass} ${col.glow} ${
                      isFloating
                        ? 'opacity-25 scale-90 border-dashed ring-2 ring-white/50'
                        : 'hover:scale-105 shadow-sm'
                    }`}
                    title="點擊一下即可跟隨滑鼠浮動，再點擊放入體質；亦支援按住拖曳"
                  >
                    <DieIcon className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 ${col.textClass} drop-shadow-xs`} />
                    <span className={`font-mono text-base sm:text-lg font-black ${col.textClass} drop-shadow-xs mt-1 leading-none`}>
                      d{die.val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================== 四大體質直列清單 (Vertical Attribute List) ==================== */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {STAT_KEYS.map(statKey => {
            const detail = ATTRIBUTE_DETAILS[statKey];
            const slottedDie = assignedDiceMap[statKey];
            const isDragOver = dragOverKey === statKey;
            const isFloatingThis = slottedDie && floatingDieId === slottedDie.id;

            return (
              <div
                key={statKey}
                onDragOver={(e) => handleDragOver(statKey, e)}
                onDragLeave={() => handleDragLeave(statKey)}
                onDrop={(e) => handleDrop(statKey, e)}
                onClick={(e) => handleSlotClick(statKey, e)}
                className={`rounded-2xl border-2 p-3 sm:p-4 bg-white transition-all cursor-pointer select-none flex items-center justify-between gap-3 sm:gap-4 shadow-xs ${
                  isDragOver || (floatingDieId && !isFloatingThis)
                    ? 'hover:border-amber-500 hover:shadow-md'
                    : 'hover:border-slate-400 hover:shadow-sm'
                } ${
                  isDragOver
                    ? 'ring-4 ring-amber-400 bg-amber-50/60 border-amber-600 scale-[1.01]'
                    : ''
                }`}
                style={{ borderColor: isDragOver ? '#059669' : theme.border || '#cbd5e1' }}
              >
                {/* 左側：DEX 加粗，中文名稱字體小一號 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono font-black text-2xl sm:text-3xl text-slate-900 tracking-wide">
                      {detail.enName}
                    </span>
                    <span className="font-serif font-bold text-lg sm:text-xl text-slate-700">
                      {detail.name}
                    </span>

                    {/* ⓘ 說明按鈕 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoModalKey(statKey);
                      }}
                      className="w-5 h-5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center ml-0.5"
                      title="查看特質機制說明"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mt-1 truncate" title={detail.tags}>
                    {detail.tags}
                  </p>
                </div>

                {/* 右側：正方形插槽 (支援點擊浮動拿起、點擊放入、拖曳對調) */}
                <div className="shrink-0">
                  {slottedDie ? (
                    (() => {
                      const col = getDiceColorConfig(slottedDie.val);
                      const DieIcon = getDieIcon(slottedDie.val);

                      return (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(slottedDie.id, e)}
                          className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-1 shadow-md cursor-grab active:cursor-grabbing relative group transition-transform ${
                            col.bgClass
                          } ${col.borderClass} ${col.glow} ${
                            isFloatingThis
                              ? 'opacity-25 scale-90 border-dashed ring-2 ring-amber-400'
                              : 'hover:scale-105'
                          }`}
                          title="點擊一下即可拿起跟隨滑鼠，再點擊其他體質對調或點托盤收回；亦可直接拖曳"
                        >
                          <DieIcon className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 ${col.textClass} drop-shadow-xs`} />
                          <span className={`font-mono text-base sm:text-lg font-black ${col.textClass} drop-shadow-xs mt-1 leading-none`}>
                            d{slottedDie.val}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    // 空白正方形插槽 (Empty Square Socket)
                    <div
                      className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                        floatingDieId
                          ? 'border-amber-600 bg-amber-50/60 text-amber-900 animate-pulse scale-102'
                          : 'border-slate-300 bg-slate-50/80 text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      <span className="text-[11px] font-black">
                        {floatingDieId ? '點擊放入' : '空置'}
                      </span>
                      <span className="text-[9px] font-mono opacity-70 mt-0.5">
                        {floatingDieId ? 'Click to Slot' : '拖入 / 點入'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== ⓘ 屬性機制詳情彈窗 (按需查看，不霸佔版面) ==================== */}
      {infoModalKey && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-black text-xl text-slate-900">
                  {ATTRIBUTE_DETAILS[infoModalKey].enName}
                </span>
                <span className="font-serif font-black text-xl text-slate-900">
                  {ATTRIBUTE_DETAILS[infoModalKey].name}
                </span>
                <span className="text-xs text-slate-500 font-medium ml-1">特質機制解讀</span>
              </div>
              <button
                type="button"
                onClick={() => setInfoModalKey(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="text-slate-600 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                {ATTRIBUTE_DETAILS[infoModalKey].tags}
              </p>

              <div className="space-y-2 pt-1">
                <span className="font-bold text-slate-800 text-[11px] block">
                  該屬性在遊戲中主導的連動機制：
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {ATTRIBUTE_DETAILS[infoModalKey].mechanics.map((item, mIdx) => (
                    <div key={mIdx} className="p-2 rounded-lg bg-slate-50/80 border border-slate-200/60 flex items-start gap-2">
                      <span className="font-bold text-slate-800 shrink-0 w-16 text-[11px]">
                        • {item.label}:
                      </span>
                      <span className="text-slate-600 text-[11px] leading-relaxed">
                        {item.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModalKey(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
