import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  GiGearHammer,
  GiRoundBottomFlask,
  GiBroadsword,
  GiGears,
  GiSparkles,
  GiCoins,
  GiCancel,
  GiCheckMark,
  GiHazardSign,
  GiCrystalBall,
  GiCrossedSwords,
  GiDiceSixFacesFive,
  GiRollingDices,
  GiSpellBook
} from 'react-icons/gi';
import { Plus } from 'lucide-react';
import ClockTracker from '../../../../components/ui/ClockTracker';
import JRPGButton from '../../../../components/ui/JRPGButton';
import EmptyState from '../../../../components/ui/EmptyState';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { calculateCharacterStats, getCharacterLevel } from '../../utils/characterEngine';
import { openRuleCodex } from '../../utils/skillFormulaEvaluator';
import rulesData from '../../data/rulesData.json';
import {
  PROJECT_POTENCY_OPTIONS,
  PROJECT_AREA_OPTIONS,
  PROJECT_USES_OPTIONS,
  calcProjectCost,
  calcDailyProgress,
  applyDailyProgress,
  helperHireCost,
  DEFAULT_DAILY_INPUT
} from '../../data/tinkererProjects';
import { resolveCreationRules } from '../../data/creationRules';
import { modeRestrictsEquipment } from '../../data/technospheres';

// 官方修補匠煉金術【目標表】(Core Rulebook p. 212)
export const ALCHEMY_TARGET_TABLE = [
  { id: 't1', min: 1, max: 6, range: '1~6', label: '單體友方', desc: '你或者在場景中的一名你看得見的盟友' },
  { id: 't2', min: 7, max: 11, range: '7~11', label: '單體敵方', desc: '場景中的一名你看得見的敵人' },
  { id: 't3', min: 12, max: 16, range: '12~16', label: '群體友方', desc: '你與場景中你看得見的所有盟友' },
  { id: 't4', min: 17, max: 20, range: '17~20', label: '群體敵方', desc: '場景中的每名敵人' }
];

// 官方修補匠煉金術【效果表】(Core Rulebook p. 213)
export const getAlchemyEffectRows = (level = 5) => {
  const dmg = level >= 40 ? 40 : level >= 20 ? 30 : 20;
  return [
    {
      id: 'any_poison',
      isAny: true,
      diceLabel: '任意',
      category: '保底備選',
      label: `受到 ${dmg} 點毒屬性傷害`,
      fallbackKey: 'poison'
    },
    {
      id: 'any_heal',
      isAny: true,
      diceLabel: '任意',
      category: '保底備選',
      label: '恢復 30 點 HP',
      fallbackKey: 'heal'
    },
    {
      id: 'e1',
      dice: [1],
      diceLabel: '1',
      category: '屬性提昇',
      label: '【DEX】與【MIG】骰尺寸提升一階（最高為 d12），持續至你的下個回合結束'
    },
    {
      id: 'e2',
      dice: [2],
      diceLabel: '2',
      category: '屬性提昇',
      label: '【INS】與【WLP】骰尺寸提升一階（最高為 d12），持續至你的下個回合結束'
    },
    {
      id: 'e3',
      dice: [3],
      diceLabel: '3',
      category: '屬性傷害',
      label: `受到 ${dmg} 點風屬性傷害`
    },
    {
      id: 'e4',
      dice: [4],
      diceLabel: '4',
      category: '屬性傷害',
      label: `受到 ${dmg} 點電屬性傷害`
    },
    {
      id: 'e5',
      dice: [5],
      diceLabel: '5',
      category: '屬性傷害',
      label: `受到 ${dmg} 點暗屬性傷害`
    },
    {
      id: 'e6',
      dice: [6],
      diceLabel: '6',
      category: '屬性傷害',
      label: `受到 ${dmg} 點土屬性傷害`
    },
    {
      id: 'e7',
      dice: [7],
      diceLabel: '7',
      category: '屬性傷害',
      label: `受到 ${dmg} 點火屬性傷害`
    },
    {
      id: 'e8',
      dice: [8],
      diceLabel: '8',
      category: '屬性傷害',
      label: `受到 ${dmg} 點冰屬性傷害`
    },
    {
      id: 'e9',
      dice: [9],
      diceLabel: '9',
      category: '元素抗性',
      label: '獲得對風屬性與火屬性傷害的抗性，持續至場景結束'
    },
    {
      id: 'e10',
      dice: [10],
      diceLabel: '10',
      category: '元素抗性',
      label: '獲得對電屬性與冰屬性傷害的抗性，持續至場景結束'
    },
    {
      id: 'e11',
      dice: [11],
      diceLabel: '11',
      category: '元素抗性',
      label: '獲得對暗屬性與土屬性傷害的抗性，持續至場景結束'
    },
    {
      id: 'e12',
      dice: [12],
      diceLabel: '12',
      category: '異常狀態',
      label: '陷入憤怒狀態'
    },
    {
      id: 'e13',
      dice: [13],
      diceLabel: '13',
      category: '異常狀態',
      label: '陷入中毒狀態'
    },
    {
      id: 'e14',
      dice: [14],
      diceLabel: '14',
      category: '複合異常',
      label: '同時陷入眩暈、動搖、緩慢與虛弱狀態'
    },
    {
      id: 'e15',
      dice: [15],
      diceLabel: '15',
      category: '狀態解除',
      label: '解除所有狀態效果'
    },
    {
      id: 'e16_17',
      dice: [16, 17],
      diceLabel: '16~17',
      category: '強效回復',
      label: '恢復 50 點 HP 與 50 點 MP'
    },
    {
      id: 'e18',
      dice: [18],
      diceLabel: '18',
      category: '極限回復',
      label: '恢復 100 點 HP'
    },
    {
      id: 'e19',
      dice: [19],
      diceLabel: '19',
      category: '極限回復',
      label: '恢復 100 點 MP'
    },
    {
      id: 'e20',
      dice: [20],
      diceLabel: '20',
      category: '神蹟回復',
      label: '恢復 100 點 HP 與 100 點 MP'
    }
  ];
};

/**
 * 智慧解析外部骰點文本（相容 Discord / CCFOLIA / BCDice / 純數字等多樣格式）
 * 範例 1 (Discord BCDice): (4D20) ＞ 46[14,17,7,8] ＞ 46 -> [14, 17, 7, 8]
 * 範例 2 (CCFOLIA): : 4D20 (4D20) ＞ 46[14, 17, 7, 8] ＞ 46 -> [14, 17, 7, 8]
 * 範例 3 (純數字): 14, 17, 7, 8 -> [14, 17, 7, 8]
 */
export const parseExternalDiceRolls = (text, count = 4) => {
  if (!text || typeof text !== 'string') return [];
  // 策略 1：優先提取方括號 [14, 17, 7, 8]
  const bracketMatch = text.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    const nums = (bracketMatch[1].match(/\b\d+\b/g) || [])
      .map(Number)
      .filter(n => n >= 1 && n <= 20);
    if (nums.length > 0) return nums.slice(0, count);
  }

  // 策略 2：過濾骰子指令如 (4D20) 或 4d20，避免將指令中的 4 或 20 誤判為出目
  const cleaned = text.replace(/\(?\b\d+[dD]\d+\b\)?/gi, '');
  const nums = (cleaned.match(/\b\d+\b/g) || [])
    .map(Number)
    .filter(n => n >= 1 && n <= 20);
  return nums.slice(0, count);
};

export default function TinkererWorkshop({
  character,
  onChange,
  onOpenDice = () => {},
  showToast = () => {}
}) {
  const stats = calculateCharacterStats(character);
  const curHp = character.currentHp !== null && character.currentHp !== undefined ? character.currentHp : (stats.maxHp || 50);
  const curMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : (stats.maxMp || 40);
  const curIp = character.currentIp !== null && character.currentIp !== undefined ? character.currentIp : (stats.maxIp || 6);
  const maxIp = stats.maxIp || 6;
  const maxMp = stats.maxMp || 40;

  const tinkererClass = (character.classes || []).find(c => c.className === '修補匠');
  const gadgetSkill = (tinkererClass?.skills || []).find(s => s.name === '小工具');
  const gadgetSL = gadgetSkill?.sl || 0;

  const visionarySkill = (tinkererClass?.skills || []).find(s => s.name === '高瞻遠矚');
  const visionarySL = visionarySkill?.sl || 0;
  const freeCostDiscount = visionarySL * 100;
  const extraProgressPerDay = visionarySL;

  const characterLevel = getCharacterLevel(character);

  /**
   * 魔晶石是否處於「裝備受限」模式（科技奇幻手冊 p.133）。
   * 為 true 時魔導科技只剩兩個益處：魔加農整檔不存在，魔法球原型降為進階。
   * 與 `EquipmentPickerModal`／`characterEngine` 共用 `modeRestrictsEquipment` 這一個判定。
   */
  const technoRestrictsEquipment = modeRestrictsEquipment(
    resolveCreationRules(character?.creationRules).technospheres
  );
  /** 魔法球原型的檔位：核心在最高檔（3），魔晶石制降到進階（2）——這一軌只剩兩檔。 */
  const magisphereTier = technoRestrictsEquipment ? 2 : 3;

  // 修補匠資料
  const tinkererData = character.tinkererData || {};
  const projects = tinkererData.projects || [];
  const gadgets = tinkererData.gadgets || {
    alchemy: 0,
    infusion: 0,
    magitech: 0,
    magitechSpells: []
  };

  const hasGadgets = gadgetSL > 0;

  // 主標籤切換（若有小工具預設為小工具工坊，否則為造物專案）
  const [activeTab, setActiveTab] = useState(hasGadgets ? 'gadgets' : 'projects');

  // 小工具子標籤（煉金術、灌注術、魔導科技）
  const [activeGadgetSubTab, setActiveGadgetSubTab] = useState(
    gadgets.alchemy > 0 ? 'alchemy' : gadgets.infusion > 0 ? 'infusion' : 'magitech'
  );

  // ----------------------------------------------------
  // 造物專案狀態 (Core Rulebook p.134~139 官方六大步驟)
  // ----------------------------------------------------
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPotency, setNewPotency] = useState('小');
  const [newArea, setNewArea] = useState('個體');
  const [newUses, setNewUses] = useState('消耗品');
  const [newHasFlaw, setNewHasFlaw] = useState(false);
  const [newFlawDesc, setNewFlawDesc] = useState('');
  const [newSpecialIngredient, setNewSpecialIngredient] = useState('');

  // 彈窗鍵盤 ESC 與鎖定頁面滾動
  useEffect(() => {
    if (!isAddModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsAddModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isAddModalOpen]);

  // 造物專案即時計算公式
  const selectedPotencyObj = PROJECT_POTENCY_OPTIONS.find(p => p.key === newPotency) || PROJECT_POTENCY_OPTIONS[0];
  const selectedAreaObj = PROJECT_AREA_OPTIONS.find(a => a.key === newArea) || PROJECT_AREA_OPTIONS[0];
  const selectedUsesObj = PROJECT_USES_OPTIONS.find(u => u.key === newUses) || PROJECT_USES_OPTIONS[0];

  // 官方三乘數模型（Core p.134-137）；進度換算為 floor，非 ceil——
  // 依原書官方範例 Magitech Suit：1750z -> 17 格（見 tinkererProjects.js 說明）。
  const {
    rawCost: calcRawCost,
    flawDiscount: calcFlawDiscount,
    discountedCost: calcDiscountedCost,
    finalPay: calcFinalPay,
    requiredProgress: calcRequiredClock
  } = calcProjectCost({
    potencyCost: selectedPotencyObj.cost,
    areaMult: selectedAreaObj.mult,
    usesMult: selectedUsesObj.mult,
    hasFlaw: newHasFlaw,
    visionarySL
  });
  const isSpecialRequired = selectedPotencyObj.needsSpecial;

  // ----------------------------------------------------
  // 每日推進狀態（官方 Core p.134 / p.211 / p.137）
  // ----------------------------------------------------
  const [advancingId, setAdvancingId] = useState(null);
  const [advanceInput, setAdvanceInput] = useState(DEFAULT_DAILY_INPUT);
  const dailyPreview = calcDailyProgress({ ...advanceInput, visionarySL });

  // ----------------------------------------------------
  // 煉金術狀態
  // ----------------------------------------------------
  const [rolledDice, setRolledDice] = useState([]); // [d20, d20, ...]
  const [targetDieIndex, setTargetDieIndex] = useState(null);
  const [effectDieIndex, setEffectDieIndex] = useState(null);
  const [useFallbackEffect, setUseFallbackEffect] = useState(null); // 'poison' or 'heal' or null
  const [manualValues, setManualValues] = useState({ die0: '10', die1: '10', die2: '10', die3: '10' });
  const [pasteInputText, setPasteInputText] = useState('');

  // ----------------------------------------------------
  // 灌注術狀態
  // ----------------------------------------------------
  const [activeInfusion, setActiveInfusion] = useState(null);

  // ----------------------------------------------------
  // 魔導科技狀態
  // ----------------------------------------------------
  const [magcannonAffinity, setMagcannonAffinity] = useState('火');

  const updateCharacterData = (newTinkererData, vitalChanges = {}) => {
    onChange({
      ...character,
      ...vitalChanges,
      tinkererData: {
        ...tinkererData,
        ...newTinkererData
      },
      updatedAt: new Date().toISOString()
    });
  };

  // 道具點 (IP) 與魔力值 (MP) 扣除輔助函式
  const consumeIp = (amount, label = '道具點') => {
    if (curIp < amount) {
      showToast(`【${label}】不足！需要 ${amount} 點，目前僅剩 ${curIp} 點。`, 'warning');
      return null;
    }
    return Math.max(0, curIp - amount);
  };

  const consumeMp = (amount, label = '魔力值') => {
    if (curMp < amount) {
      showToast(`【${label}】不足！需要 ${amount} 點，目前僅剩 ${curMp} 點。`, 'warning');
      return null;
    }
    return Math.max(0, curMp - amount);
  };

  // ----------------------------------------------------
  // 造物專案處理
  // ----------------------------------------------------
  const handleClockChange = (projId, newFilled) => {
    const updated = projects.map(p => {
      if (p.id === projId) {
        const isDone = newFilled >= p.totalClock;
        return { ...p, filledClock: newFilled, completed: isDone };
      }
      return p;
    });
    updateCharacterData({ projects: updated });
    const target = projects.find(p => p.id === projId);
    if (newFilled >= target.totalClock) {
      showToast(`專案【${target.name}】命刻已填滿！可以完工入庫！`, 'success');
    }
  };

  const handleAddProject = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      showToast('請輸入發明專案名稱', 'warning');
      return;
    }
    if (isSpecialRequired && !newSpecialIngredient.trim()) {
      showToast('中等及以上效力造物必須填寫 GM 指定的特殊材料！', 'warning');
      return;
    }

    const created = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      description: newDescription.trim(),
      potency: newPotency,
      area: newArea,
      uses: newUses,
      hasFlaw: newHasFlaw,
      flaw: newFlawDesc.trim(),
      specialIngredient: newSpecialIngredient.trim(),
      rawCost: calcRawCost,
      discountedCost: calcDiscountedCost,
      zenit: calcFinalPay,
      totalClock: calcRequiredClock,
      filledClock: 0,
      completed: false,
      createdAt: new Date().toISOString()
    };

    updateCharacterData({ projects: [created, ...projects] });
    setNewProjectName('');
    setNewDescription('');
    setNewPotency('小');
    setNewArea('個體');
    setNewUses('消耗品');
    setNewHasFlaw(false);
    setNewFlawDesc('');
    setNewSpecialIngredient('');
    setIsAddModalOpen(false);
    showToast(`已建立新造物專案【${created.name}】！所需進度 ${created.totalClock} 格。`, 'success');
  };

  const handleDeleteProject = (projId) => {
    const updated = projects.filter(p => p.id !== projId);
    updateCharacterData({ projects: updated });
    showToast('已移除造物專案');
  };

  // 開啟推進面板：帶入上次的參與設定，沒有則用最常見情境
  const handleOpenAdvance = (proj) => {
    setAdvanceInput({
      workers: Math.max(1, proj.dailyWorkers ?? DEFAULT_DAILY_INPUT.workers),
      tinkererWorkers: Math.max(0, proj.dailyTinkerers ?? DEFAULT_DAILY_INPUT.tinkererWorkers),
      helpers: Math.max(0, proj.helpers ?? 0)
    });
    setAdvancingId(proj.id);
  };

  // 確認推進一天（原書：每日結束時結算）
  const handleConfirmAdvance = (proj) => {
    const daily = calcDailyProgress({ ...advanceInput, visionarySL });
    if (daily.total <= 0) {
      showToast('今日無人參與，進度不會推進。', 'warning');
      return;
    }
    const next = applyDailyProgress(proj, daily);
    const updated = projects.map(p => p.id === proj.id ? {
      ...p,
      filledClock: next.filledClock,
      completed: next.completed,
      daysWorked: next.daysWorked,
      helpers: advanceInput.helpers,
      dailyWorkers: advanceInput.workers,
      dailyTinkerers: advanceInput.tinkererWorkers
    } : p);
    updateCharacterData({ projects: updated });
    setAdvancingId(null);

    const overflowNote = next.overflow > 0 ? '，超額' + next.overflow + '格（一至兩小時內完成）' : '';
    if (next.completed && !proj.completed) {
      showToast('專案【' + proj.name + '】推進了' + daily.total + '格，已完工！' + overflowNote, 'success');
    } else if (next.completed) {
      showToast('專案【' + proj.name + '】已完工，進度維持' + next.filledClock + '/' + proj.totalClock + '格。', 'info');
    } else {
      showToast('專案【' + proj.name + '】推進了' + daily.total + '格（' + next.filledClock + '/' + proj.totalClock + '）。', 'success');
    }
  };

  // ----------------------------------------------------
  // 煉金術調配計算
  // ----------------------------------------------------
  const alchemyTier = gadgets.alchemy || 0;
  const alchemyDiceCount = alchemyTier === 1 ? 2 : alchemyTier === 2 ? 3 : 4;
  const alchemyIpCost = alchemyTier === 1 ? 3 : alchemyTier === 2 ? 4 : 5;

  const handleRollAlchemy = () => {
    if (alchemyTier <= 0) return;
    const nextIp = consumeIp(alchemyIpCost, '道具點');
    if (nextIp === null) return;

    // 擲指定數量的 d20
    const results = [];
    for (let i = 0; i < alchemyDiceCount; i++) {
      results.push(Math.floor(Math.random() * 20) + 1);
    }
    setRolledDice(results);
    setTargetDieIndex(0);
    setEffectDieIndex(results.length > 1 ? 1 : 0);
    setUseFallbackEffect(null);

    const newManual = {};
    results.forEach((val, idx) => {
      newManual[`die${idx}`] = String(val);
    });
    setManualValues(newManual);

    updateCharacterData(tinkererData, { currentIp: nextIp });
    showToast(`消耗 ${alchemyIpCost} 道具點現場調配！擲出 [${results.join(',')}]，剩餘 ${nextIp} 道具點。`, 'success');
  };

  const handleApplyManualDice = (shouldDeductIp = false) => {
    const results = [];
    for (let i = 0; i < alchemyDiceCount; i++) {
      const val = parseInt(manualValues[`die${i}`], 10) || 10;
      results.push(Math.min(20, Math.max(1, val)));
    }
    setRolledDice(results);
    if (targetDieIndex === null || targetDieIndex >= results.length) {
      setTargetDieIndex(0);
    }
    if (effectDieIndex === null || effectDieIndex >= results.length) {
      setEffectDieIndex(results.length > 1 ? 1 : 0);
    }
    setUseFallbackEffect(null);

    if (shouldDeductIp) {
      const nextIp = consumeIp(alchemyIpCost, '道具點');
      if (nextIp !== null) {
        updateCharacterData(tinkererData, { currentIp: nextIp });
        showToast(`已套用外部骰點 [${results.join(',')}] 並扣除 ${alchemyIpCost} 道具點！剩餘 ${nextIp} 道具點。`, 'success');
        return;
      }
    }
    showToast(`已套用外部骰點 [${results.join(',')}]！雙表已即時高亮所有命中項。`, 'info');
  };

  const handleManualDieChange = (idx, valueStr) => {
    const nextManual = { ...manualValues, [`die${idx}`]: valueStr };
    setManualValues(nextManual);

    // 同步即時高亮雙表
    const val = parseInt(valueStr, 10);
    if (!isNaN(val) && val >= 1 && val <= 20) {
      const nextRolled = [...(rolledDice.length === alchemyDiceCount ? rolledDice : Array.from({ length: alchemyDiceCount }, () => 10))];
      nextRolled[idx] = val;
      setRolledDice(nextRolled);
      if (targetDieIndex === null) setTargetDieIndex(0);
      if (effectDieIndex === null) setEffectDieIndex(nextRolled.length > 1 ? 1 : 0);
    }
  };

  const handleSelectTarget = (diceIdx) => {
    if (effectDieIndex === diceIdx && useFallbackEffect === null) {
      setEffectDieIndex(null);
    }
    setTargetDieIndex(diceIdx);
  };

  const handleSelectEffect = (diceIdx) => {
    setUseFallbackEffect(null);
    if (targetDieIndex === diceIdx) {
      setTargetDieIndex(null);
    }
    setEffectDieIndex(diceIdx);
  };

  const handleSelectFallbackEffect = (fallbackKey) => {
    setUseFallbackEffect(fallbackKey);
    setEffectDieIndex(null);
  };

  const handleResetAlchemy = () => {
    setRolledDice([]);
    setTargetDieIndex(null);
    setEffectDieIndex(null);
    setUseFallbackEffect(null);
  };

  // 取得目標解析
  const getAlchemyTargetInfo = (roll) => {
    if (!roll) return { label: '未選定目標（請由左側目標表點選）', range: '' };
    const row = ALCHEMY_TARGET_TABLE.find(t => roll >= t.min && roll <= t.max);
    return row ? { label: row.desc, range: row.range, category: row.label } : { label: '未知目標', range: '' };
  };

  // 取得效果解析
  const getAlchemyEffectInfo = (roll) => {
    if (useFallbackEffect === 'poison') {
      const dmg = characterLevel >= 40 ? 40 : characterLevel >= 20 ? 30 : 20;
      return { label: `受到 ${dmg} 點毒屬性傷害`, isFallback: true, category: '保底備選' };
    }
    if (useFallbackEffect === 'heal') {
      return { label: '恢復 30 點 HP', isFallback: true, category: '保底備選' };
    }
    if (!roll) return { label: '未選定效果（請由右側效果表點選）', desc: '' };

    const rows = getAlchemyEffectRows(characterLevel);
    const row = rows.find(r => !r.isAny && r.dice.includes(roll));
    return row ? { label: row.label, category: row.category } : { label: '未知效果' };
  };

  const targetDieValue = targetDieIndex !== null && rolledDice[targetDieIndex] !== undefined ? rolledDice[targetDieIndex] : null;
  const effectDieValue = effectDieIndex !== null && rolledDice[effectDieIndex] !== undefined ? rolledDice[effectDieIndex] : null;
  const currentTargetInfo = getAlchemyTargetInfo(targetDieValue);
  const currentEffectInfo = getAlchemyEffectInfo(effectDieValue);

  const handleParseExternalDice = (text) => {
    if (!text || !text.trim()) {
      showToast('請先貼入含有骰子出目的文字內容', 'warning');
      return;
    }
    const parsed = parseExternalDiceRolls(text, alchemyDiceCount);
    if (parsed.length === 0) {
      showToast('未能從貼入內容中識別出 1~20 的出目，請檢查格式', 'warning');
      return;
    }

    const newManual = { ...manualValues };
    parsed.forEach((val, idx) => {
      newManual[`die${idx}`] = String(val);
    });
    setManualValues(newManual);
    setRolledDice(parsed);
    setTargetDieIndex(0);
    setEffectDieIndex(parsed.length > 1 ? 1 : 0);
    setUseFallbackEffect(null);
    showToast(`已智慧解析 ${parsed.length} 顆出目：[${parsed.join(',')}]，雙表已即時高亮！`, 'success');
  };

  const handleCopyPotion = () => {
    const tierTitle = alchemyTier === 1 ? '【基礎煉金術】' : alchemyTier === 2 ? '【高級煉金術】' : '【最高煉金術】';
    const targetText = currentTargetInfo.label || '未選定目標';
    const effectText = currentEffectInfo.label || '未選定效果';
    const targetPart = `${targetText}${targetDieValue ?` (出目 ${targetDieValue})` : ''}`;
    const effectPart = `${effectText}${useFallbackEffect ? '(任意保底)' : effectDieValue ? `(出目 ${effectDieValue})` : ''}`;
    const text = `${tierTitle}\n消耗：${alchemyIpCost} 道具點\n目標：${targetPart}\n效果：${effectPart}`;
    navigator.clipboard.writeText(text);
    showToast(`已複製${tierTitle}效果至剪貼簿！`, 'info');
  };

  // ----------------------------------------------------
  // 灌注術處理
  // ----------------------------------------------------
  const handleApplyInfusion = (inf) => {
    const nextIp = consumeIp(2, '道具點');
    if (nextIp === null) return;

    setActiveInfusion(inf);
    updateCharacterData(tinkererData, { currentIp: nextIp });
    showToast(`已消耗 2 道具點套用灌注【${inf.name}】！剩餘 ${nextIp} 道具點。`, 'success');
  };

  // ----------------------------------------------------
  // 魔導科技處理
  // ----------------------------------------------------
  const handleUsurpConstruct = () => {
    const nextMp = consumeMp(10, '魔力值');
    if (nextMp === null) return;

    updateCharacterData(tinkererData, { currentMp: nextMp });
    showToast(`已消耗 10 點魔力值發起【魔科技篡奪】！剩餘 ${nextMp} MP。請執行【INS + INS】檢定。`, 'info');
    onOpenDice('魔科技篡奪檢定', {
      attr1: character.attributes?.ins || 8,
      attr2: character.attributes?.ins || 8,
      modifier: 0
    });
  };

  const handleBuildMagcannon = () => {
    const nextIp = consumeIp(2, '道具點');
    if (nextIp === null) return;

    const newMagcannonWeapon = {
      id: `magcannon_${Date.now()}`,
      name: `魔加農【${magcannonAffinity}】`,
      category: '火器',
      hands: '雙手',
      range: '遠程',
      attr1: 'dex',
      attr2: 'ins',
      accuracyMod: 1,
      damage: `【HR + 10】${magcannonAffinity}`,
      equipped: true,
      cost: 0,
      quality: '魔科技造物，無法擁有特性'
    };

    // 將角色目前現有的魔加農移除（規則：一旦建立新的，先前的就會碎裂）
    const existingWeapons = (character.weapons || []).filter(w => !w.name.startsWith('魔加農'));

    onChange({
      ...character,
      currentIp: nextIp,
      weapons: [newMagcannonWeapon, ...existingWeapons],
      updatedAt: new Date().toISOString()
    });

    showToast(`消耗 2 道具點成功製造【${newMagcannonWeapon.name}】並已裝備！剩餘 ${nextIp} 道具點。`, 'success');
  };

  const handleCastSpellOrb = (spellName) => {
    const spellDef = (rulesData.spells || []).find(s => s.name === spellName);
    if (!spellDef) return;

    const nextIp = consumeIp(2, '道具點');
    if (nextIp === null) return;

    const spellMp = parseInt(spellDef.mp, 10) || 10;
    const nextMp = consumeMp(spellMp, '魔力值');
    if (nextMp === null) return;

    updateCharacterData(tinkererData, { currentIp: nextIp, currentMp: nextMp });
    showToast(`消耗 2 道具點與 ${spellMp} 點魔力值快捷施放魔法球【${spellName}】！剩餘 ${nextIp} 道具點、${nextMp} MP。`, 'success');

    // 開啟施法檢定
    onOpenDice(`魔法球施法：${spellName}`, {
      attr1: character.attributes?.ins || 8,
      attr2: character.attributes?.wlp || 8,
      modifier: 0
    });
  };

  return (
    <div className="p-4 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] space-y-4 text-xs font-sans text-[#2c221e]">
      
      {/* 標頭切換列 */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#d6c7ab] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-ui bg-[#a63d40] text-[#fffdf9]">
            <GiGearHammer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#2c221e] flex items-center gap-2">
              <span>修補匠工坊</span>
              <span className="text-t12 font-mono px-2 py-0.5 rounded-full bg-[#f4ebd9] text-[#78350f] font-bold border border-[#d6c7ab]">
                道具點：{curIp} / {maxIp}
              </span>
            </h3>
            <p className="text-t12 text-[#6b5a4b]">
              {hasGadgets ? '小工具科技實裝調配與造物專案追蹤' : '造物專案推進與工藝研發'}
            </p>
          </div>
        </div>

        {/* 操作與標籤按鈕組 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openRuleCodex(activeTab === 'projects' ? '造物專案' : '小工具')}
            className="px-2.5 py-1.5 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#78350f] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title={activeTab === 'projects' ? '開啟造物專案官方手冊完整速查 (手冊 p.134~139)' : '開啟小工具官方手冊完整速查大表 (手冊 p.212~216)'}
          >
            <GiSpellBook className="w-4 h-4 text-[#8b5e34]" />
            <span>規則概念速查</span>
          </button>

          {/* 標籤按鈕組 */}
          <div className="flex items-center gap-1.5 bg-[#f4ebd9] p-1 rounded-ui border border-[#d6c7ab]">
            {hasGadgets && (
              <button
                type="button"
                onClick={() => setActiveTab('gadgets')}
                className={`px-3 py-1.5 rounded-ui font-bold transition-all cursor-pointer flex items-center gap-1.5 ${ activeTab === 'gadgets' ? 'bg-[#a63d40] text-[#fffdf9]' : 'text-[#6b5a4b] hover:bg-[#e8dcc4]' }`}
              >
                <GiGears className="w-4 h-4" />
                <span>小工具工坊</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('projects')}
              className={`px-3 py-1.5 rounded-ui font-bold transition-all cursor-pointer flex items-center gap-1.5 ${ activeTab === 'projects' ? 'bg-[#a63d40] text-[#fffdf9]' : 'text-[#6b5a4b] hover:bg-[#e8dcc4]' }`}
            >
              <GiGearHammer className="w-4 h-4" />
              <span>造物專案 ({projects.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 標籤頁 1：小工具工坊 (Gadgets) */}
      {/* ======================================================== */}
      {activeTab === 'gadgets' && hasGadgets && (
        <div className="space-y-4 animate-fade-in">
          
          {/* 小工具三大派系切換按鈕 */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveGadgetSubTab('alchemy')}
              className={`p-2.5 rounded-ui border font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${ activeGadgetSubTab === 'alchemy' ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : 'bg-[#fffdf9] border-[#d6c7ab] text-[#3c2415] hover:border-[#d6c7ab]' }`}
            >
              <GiRoundBottomFlask className="w-4 h-4" />
              <span>煉金術</span>
              <span className="text-t12 px-1.5 py-0.2 rounded-ui bg-[#2c221e]/10 font-mono">
                Tier {gadgets.alchemy || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveGadgetSubTab('infusion')}
              className={`p-2.5 rounded-ui border font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${ activeGadgetSubTab === 'infusion' ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : 'bg-[#fffdf9] border-[#d6c7ab] text-[#3c2415] hover:border-[#d6c7ab]' }`}
            >
              <GiBroadsword className="w-4 h-4" />
              <span>灌注術</span>
              <span className="text-t12 px-1.5 py-0.2 rounded-ui bg-[#2c221e]/10 font-mono">
                Tier {gadgets.infusion || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveGadgetSubTab('magitech')}
              className={`p-2.5 rounded-ui border font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${ activeGadgetSubTab === 'magitech' ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : 'bg-[#fffdf9] border-[#d6c7ab] text-[#3c2415] hover:border-[#d6c7ab]' }`}
            >
              <GiGears className="w-4 h-4" />
              <span>魔導科技</span>
              <span className="text-t12 px-1.5 py-0.2 rounded-ui bg-[#2c221e]/10 font-mono">
                Tier {gadgets.magitech || 0}
              </span>
            </button>
          </div>

          {/* ① 煉金術調配台 */}
          {activeGadgetSubTab === 'alchemy' && (
            <div className="p-4 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#d6c7ab] pb-2.5">
                <div>
                  <h4 className="font-bold text-sm text-[#2c221e] flex items-center gap-2">
                    <GiRoundBottomFlask className="w-5 h-5 text-[#8b5e34]" />
                    <span>煉金術混合調配台</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-ui bg-[#f4ebd9] text-[#78350f] font-bold">
                      {alchemyTier === 0 ? '尚未研發' : alchemyTier === 1 ? '基礎混合 (2d20 · 3 IP)' : alchemyTier === 2 ? '進階混合 (3d20 · 4 IP)' : '最高混合 (4d20 · 5 IP)'}
                    </span>
                  </h4>
                  <p className="text-t12 text-[#6b5a4b]">
                    隨機調配藥劑：擲出 d20 骰組後，選擇一顆指派給【目標】、一顆指派給【效果】
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openRuleCodex('小工具')}
                  className="px-2 py-1 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#78350f] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="開啟小工具官方手冊完整速查大表 (手冊 p.212~216)"
                >
                  <GiSpellBook className="text-[#8b5e34] text-xs" />
                  <span>規則概念速查</span>
                </button>
              </div>

              {alchemyTier === 0 ? (
                <div className="p-4 rounded-ui border border-dashed border-[#d6c7ab] text-center text-[#6b5a4b] space-y-1">
                  <p className="font-bold">尚未解鎖煉金術派系</p>
                  <p className="text-t12">請在角色卡技能配置中將【小工具】投入煉金術分支。</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ① 投擲與外部填寫雙軌控制台 */}
                  <div className="p-3.5 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[#78350f] flex items-center gap-1.5">
                          <GiRollingDices className="text-[#8b5e34] text-base" />
                          <span>即席混合骰組：共需 {alchemyDiceCount} 顆 d20（消耗 {alchemyIpCost} 道具點）</span>
                        </div>
                        <div className="text-t12 text-[#6b5a4b]">
                          可直接點擊「現場調配」由系統擲骰，或在右側手動填入 Discord / CCFOLIA 擲出的出目
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <JRPGButton
                          variant="primary"
                          size="sm"
                          icon={GiRollingDices}
                          onClick={handleRollAlchemy}
                        >
                          現場調配 ({alchemyIpCost} IP · 擲 {alchemyDiceCount}d20)
                        </JRPGButton>

                        <button
                          type="button"
                          onClick={() => handleApplyManualDice(true)}
                          className="px-3 py-1.5 rounded-ui bg-[#f4ebd9] hover:bg-[#a63d40] text-[#fffdf9] font-bold text-xs cursor-pointer transition-all flex items-center gap-1"
                          title="套用當前輸入框中的數值並扣除 IP"
                        >
                          <span>扣 {alchemyIpCost} IP 並套用</span>
                        </button>
                      </div>
                    </div>

                    {/* 外部骰點智慧解析與微調 */}
                    <div className="pt-2 border-t border-[#d6c7ab] space-y-2.5 text-xs">
                      {/* 智慧貼上外部出目列 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#3c2415] text-t12 shrink-0">
                          快速貼上外部出目：
                        </span>
                        <div className="flex-1 min-w-[260px] flex items-center gap-1.5">
                          <input
                            type="text"
                            value={pasteInputText}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPasteInputText(val);
                              // 若包含方括號或長字串，自動嘗試解析
                              if (val.includes('[') || val.length >= 6) {
                                const parsed = parseExternalDiceRolls(val, alchemyDiceCount);
                                if (parsed.length > 0) {
                                  handleParseExternalDice(val);
                                }
                              }
                            }}
                            placeholder="直接貼上 Discord / CCFOLIA 訊息，如：(4D20) ＞ 46[14,17,7,8] ＞ 46 或純出目"
                            className="flex-1 px-2.5 py-1 rounded-ui border border-[#d6c7ab] bg-[#fffdf9] text-xs text-[#2c221e] placeholder:text-[#7c6a58] focus:border-[#a63d40] outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleParseExternalDice(pasteInputText)}
                            className="px-2.5 py-1 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs cursor-pointer transition-all shrink-0"
                          >
                            智慧解析
                          </button>
                        </div>
                      </div>

                      {/* 手動微調數值列與當前骰池視覺化 */}
                      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#3c2415] text-t12">
                            個別出目微調：
                          </span>
                          {Array.from({ length: alchemyDiceCount }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-1 bg-[#fffdf9] px-2 py-1 rounded-ui border border-[#d6c7ab]">
                              <span className="font-mono text-t12 text-[#78350f] font-bold">#{idx + 1}:</span>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={manualValues[`die${idx}`] ?? ''}
                                onChange={(e) => handleManualDieChange(idx, e.target.value)}
                                placeholder="1~20"
                                className="w-12 px-1 py-0.5 rounded-ui border border-[#d6c7ab] font-mono text-center text-xs font-bold text-[#2c221e] outline-none focus:border-[#a63d40]"
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleApplyManualDice(false)}
                            className="px-2.5 py-1 rounded-ui bg-[#e8dcc4] hover:bg-[#f4ebd9] text-[#3c2415] font-bold text-xs cursor-pointer transition-colors"
                          >
                            即時套用
                          </button>
                        </div>

                        {/* 當前骰池徽章狀態 */}
                        {rolledDice.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-t12 text-[#6b5a4b]">當前出目池：</span>
                            {rolledDice.map((val, idx) => {
                              const isTarget = targetDieIndex === idx;
                              const isEffect = effectDieIndex === idx && useFallbackEffect === null;
                              const isDiscarded = !isTarget && !isEffect;

                              return (
                                <div
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-ui font-mono text-xs font-bold border flex items-center gap-1 transition-all ${ isTarget ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : isEffect ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : 'bg-[#f4ebd9] text-[#6b5a4b] border-[#d6c7ab] opacity-60' }`}
                                >
                                  <span>#{idx + 1}: {val}</span>
                                  <span className="text-t12 font-sans font-normal opacity-90">
                                    {isTarget ? '目標' : isEffect ? '效果' : '捨棄'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ② 規則書雙表（目標表 + 效果表） */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    
                    {/* 左側：【目標表】(Target Table - 佔 5 欄) */}
                    <div className="lg:col-span-5 space-y-2">
                      <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-1.5">
                        <div className="flex items-center gap-1.5 text-[#3c2415] font-bold text-xs">
                          <GiRoundBottomFlask className="text-base text-[#6b5a4b]" />
                          <span>【目標表】(手冊 p.212)</span>
                        </div>
                        <span className="text-t12 text-[#6b5a4b]">
                          點選行或出目指派
                        </span>
                      </div>

                      <div className="space-y-2">
                        {ALCHEMY_TARGET_TABLE.map((row) => {
                          const matchingDice = rolledDice
                            .map((val, idx) => ({ val, idx }))
                            .filter(d => d.val >= row.min && d.val <= row.max);
                          const isHit = matchingDice.length > 0;
                          const isSelected = targetDieIndex !== null && rolledDice[targetDieIndex] >= row.min && rolledDice[targetDieIndex] <= row.max;

                          return (
                            <div
                              key={row.id}
                              onClick={() => {
                                if (matchingDice.length > 0) {
                                  handleSelectTarget(matchingDice[0].idx);
                                }
                              }}
                              className={`p-2.5 rounded-ui border transition-all text-xs space-y-1.5 ${ isSelected ? 'bg-[#f4ebd9] border-[#a63d40] ring-2 ring-[#a63d40] text-[#3c2415] cursor-pointer' : isHit ? 'bg-[#fbf7ee] border-[#d6c7ab] text-[#2c221e] hover:bg-[#f4ebd9] cursor-pointer' : 'bg-[#fbf7ee] border-[#d6c7ab] text-[#7c6a58] opacity-60' }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-mono text-xs font-black px-1.5 py-0.5 rounded-ui ${ isSelected ? 'bg-[#a63d40] text-[#fffdf9]' : isHit ? 'bg-[#e8dcc4] text-[#3c2415] font-bold' : 'bg-[#e8dcc4] text-[#6b5a4b]' }`}>
                                    {row.range}
                                  </span>
                                  <span className="font-bold text-t12 px-1.5 py-0.2 rounded-ui bg-[#fffdf9] border border-current">
                                    {row.label}
                                  </span>
                                </div>

                                {isSelected ? (
                                  <span className="px-2 py-0.5 rounded-ui bg-[#a63d40] text-[#fffdf9] font-bold text-t12 flex items-center gap-1 shrink-0">
                                    <GiCheckMark className="text-xs" /> 已選為目標
                                  </span>
                                ) : isHit ? (
                                  <div className="flex items-center gap-1 flex-wrap shrink-0" onClick={e => e.stopPropagation()}>
                                    {matchingDice.map(m => (
                                      <button
                                        key={m.idx}
                                        type="button"
                                        onClick={() => handleSelectTarget(m.idx)}
                                        className="px-2 py-0.5 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-mono font-bold text-t12 transition-all cursor-pointer"
                                        title={`指派骰子 #${m.idx + 1} (出目 ${m.val}) 作為目標`}
                                      >
                                        指派 #{m.idx + 1} ({m.val})
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-t12 text-[#7c6a58] font-mono">未命中</span>
                                )}
                              </div>

                              <p className="text-xs leading-relaxed font-medium">
                                {row.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 右側：【效果表】(Effect Table - 佔 7 欄) */}
                    <div className="lg:col-span-7 space-y-2">
                      <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-1.5">
                        <div className="flex items-center gap-1.5 text-[#3c2415] font-bold text-xs">
                          <GiSparkles className="text-base text-[#a63d40]" />
                          <span>【效果表】(手冊 p.213)</span>
                        </div>
                        <span className="text-t12 text-[#a63d40]">
                          點選行或出目指派 · 保底隨時可選
                        </span>
                      </div>

                      {/* 效果條目可滾動列表 */}
                      <div className="max-h-[580px] overflow-y-auto space-y-1.5 pr-1.5">
                        
                        {/* 2 項「任意」保底條目 */}
                        <div
                          onClick={() => handleSelectFallbackEffect('poison')}
                          className={`p-2 rounded-ui border transition-all text-xs flex items-center justify-between gap-2 cursor-pointer ${ useFallbackEffect === 'poison' ? 'bg-[#f4ebd9] border-[#a63d40] ring-2 ring-[#a63d40] text-[#3c2415]' : 'bg-[#fbf7ee] border-[#d6c7ab] text-[#2c221e] hover:bg-[#f4ebd9]' }`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded-ui bg-[#a63d40] text-[#fffdf9]">
                              任意
                            </span>
                            <span className="font-bold text-t12 px-1.5 py-0.2 rounded-ui bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] shrink-0">
                              保底備選
                            </span>
                            <div className="font-medium text-xs">
                              {renderTextWithAffinities(`受到 ${characterLevel >= 40 ? 40 : characterLevel >= 20 ? 30 : 20} 點毒屬性傷害`)}
                            </div>
                          </div>
                          {useFallbackEffect === 'poison' ? (
                            <span className="px-2 py-0.5 rounded-ui bg-[#a63d40] text-[#fffdf9] font-bold text-t12 flex items-center gap-1 shrink-0">
                              <GiCheckMark className="text-xs" /> 已選為效果
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectFallbackEffect('poison'); }}
                              className="px-2 py-0.5 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t12 transition-all shrink-0 cursor-pointer"
                            >
                              指派備選
                            </button>
                          )}
                        </div>

                        <div
                          onClick={() => handleSelectFallbackEffect('heal')}
                          className={`p-2 rounded-ui border transition-all text-xs flex items-center justify-between gap-2 cursor-pointer ${ useFallbackEffect === 'heal' ? 'bg-[#f4ebd9] border-[#a63d40] ring-2 ring-[#a63d40] text-[#3c2415]' : 'bg-[#fbf7ee] border-[#d6c7ab] text-[#2c221e] hover:bg-[#f4ebd9]' }`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded-ui bg-[#a63d40] text-[#fffdf9]">
                              任意
                            </span>
                            <span className="font-bold text-t12 px-1.5 py-0.2 rounded-ui bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] shrink-0">
                              保底備選
                            </span>
                            <div className="font-medium text-xs">
                              恢復 30 點 HP
                            </div>
                          </div>
                          {useFallbackEffect === 'heal' ? (
                            <span className="px-2 py-0.5 rounded-ui bg-[#a63d40] text-[#fffdf9] font-bold text-t12 flex items-center gap-1 shrink-0">
                              <GiCheckMark className="text-xs" /> 已選為效果
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectFallbackEffect('heal'); }}
                              className="px-2 py-0.5 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t12 transition-all shrink-0 cursor-pointer"
                            >
                              指派備選
                            </button>
                          )}
                        </div>

                        {/* 1 ~ 20 手冊效果條目 */}
                        {getAlchemyEffectRows(characterLevel).filter(r => !r.isAny).map((row) => {
                          const matchingDice = rolledDice
                            .map((val, idx) => ({ val, idx }))
                            .filter(d => row.dice.includes(d.val));
                          const isHit = matchingDice.length > 0;
                          const isSelected = useFallbackEffect === null && effectDieIndex !== null && row.dice.includes(rolledDice[effectDieIndex]);

                          return (
                            <div
                              key={row.id}
                              onClick={() => {
                                if (matchingDice.length > 0) {
                                  handleSelectEffect(matchingDice[0].idx);
                                }
                              }}
                              className={`p-2 rounded-ui border transition-all text-xs flex items-center justify-between gap-2 ${ isSelected ? 'bg-[#f4ebd9] border-[#a63d40] ring-2 ring-[#a63d40] text-[#3c2415] cursor-pointer' : isHit ? 'bg-[#fbf7ee] border-[#d6c7ab] text-[#2c221e] hover:bg-[#f4ebd9] cursor-pointer' : 'bg-[#fbf7ee] border-[#d6c7ab] text-[#7c6a58] opacity-60' }`}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className={`font-mono text-xs font-black px-1.5 py-0.5 rounded-ui ${ isSelected ? 'bg-[#a63d40] text-[#fffdf9]' : isHit ? 'bg-[#e8dcc4] text-[#3c2415] font-bold' : 'bg-[#e8dcc4] text-[#6b5a4b]' }`}>
                                  {row.diceLabel}
                                </span>
                                <span className="font-bold text-t12 px-1.5 py-0.2 rounded-ui bg-[#fffdf9] border border-current shrink-0">
                                  {row.category}
                                </span>
                                <div className="text-xs leading-relaxed font-medium min-w-0">
                                  {renderTextWithAffinities(row.label)}
                                </div>
                              </div>

                              {isSelected ? (
                                <span className="px-2 py-0.5 rounded-ui bg-[#a63d40] text-[#fffdf9] font-bold text-t12 flex items-center gap-1 shrink-0">
                                  <GiCheckMark className="text-xs" /> 已選為效果
                                </span>
                              ) : isHit ? (
                                <div className="flex items-center gap-1 flex-wrap shrink-0" onClick={e => e.stopPropagation()}>
                                  {matchingDice.map(m => (
                                    <button
                                      key={m.idx}
                                      type="button"
                                      onClick={() => handleSelectEffect(m.idx)}
                                      className="px-2 py-0.5 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-mono font-bold text-t12 transition-all cursor-pointer"
                                      title={`指派骰子 #${m.idx + 1} (出目 ${m.val}) 作為效果`}
                                    >
                                      指派 #{m.idx + 1} ({m.val})
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-t12 text-[#7c6a58] font-mono shrink-0">未命中</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* ③ 調配成果匯總卡片 */}
                  <div className="p-3.5 rounded-ui border border-[#d6c7ab] bg-[#fffdf9] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-ui bg-[#a63d40] text-[#fffdf9]">
                          <GiRoundBottomFlask className="text-base" />
                        </div>
                        <h5 className="font-bold text-sm text-[#2c221e] flex items-center gap-1.5">
                          <span>即席混合藥劑調配成果</span>
                          <span className="text-t12 font-mono px-1.5 py-0.5 rounded-ui bg-[#f4ebd9] text-[#78350f] border border-[#d6c7ab]">
                            消耗 {alchemyIpCost} 道具點
                          </span>
                        </h5>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyPotion}
                          className="px-3 py-1 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <GiSparkles className="text-xs" />
                          <span>複製藥劑效果</span>
                        </button>
                        {rolledDice.length > 0 && (
                          <button
                            type="button"
                            onClick={handleResetAlchemy}
                            className="px-2.5 py-1 rounded-ui border border-[#d6c7ab] hover:bg-[#f4ebd9] text-[#6b5a4b] font-bold text-xs cursor-pointer transition-colors"
                          >
                            重置
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* 目標結果 */}
                      {/* 空 / 已填是兩種不同的東西：空的時候用第十一輪的空狀態文法
                          （虛線框＋gi 圖示＋粗體標題＋一句教學），填好之後才回到實線卡面。
                          以前這裡無論如何都是同一張實線卡，只把「未指定」三個字塞進角落——
                          那等於叫使用者自己發現「這一格是空的、而且要知道去哪一格點」。 */}
                      {targetDieValue === null ? (
                        <EmptyState
                          kind="tinkerer-target"
                          icon={GiRoundBottomFlask}
                          title="尚未指派藥劑目標"
                          teach="在左側【目標表】點一行，把骰子派給它。"
                          tone="paper"
                          dense
                        />
                      ) : (
                      <div className="p-3 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] space-y-1">
                        <div className="flex items-center justify-between text-[#3c2415] font-bold">
                          <span className="flex items-center gap-1"><GiRoundBottomFlask className="text-[#6b5a4b] text-sm" /> 藥劑目標</span>
                          <span className="font-mono text-t12">
                            {`出目: ${targetDieValue}`}
                          </span>
                        </div>
                        <p className="text-[#2c221e] font-bold text-xs sm:text-sm">
                          {currentTargetInfo.label}
                        </p>
                      </div>
                      )}

                      {/* 效果結果 */}
                      {effectDieValue === null && !useFallbackEffect ? (
                        <EmptyState
                          kind="tinkerer-effect"
                          icon={GiSparkles}
                          title="尚未指派藥劑效果"
                          teach="在右側【效果表】點一行；也可以直接選保底備選。"
                          tone="paper"
                          dense
                        />
                      ) : (
                      <div className="p-3 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] space-y-1">
                        <div className="flex items-center justify-between text-[#3c2415] font-bold">
                          <span className="flex items-center gap-1"><GiSparkles className="text-[#a63d40] text-sm" /> 藥劑效果</span>
                          <span className="font-mono text-t12">
                            {useFallbackEffect ? '任意保底' : `出目: ${effectDieValue}`}
                          </span>
                        </div>
                        <div className="text-[#2c221e] font-bold text-xs sm:text-sm leading-relaxed">
                          {renderTextWithAffinities(currentEffectInfo.label)}
                        </div>
                      </div>
                      )}
                    </div>

                    {/* 捨棄骰子提示 */}
                    {rolledDice.length > 0 && (
                      <div className="text-t12 text-[#6b5a4b] flex items-center justify-between pt-1 border-t border-[#e8dcc4] flex-wrap gap-1">
                        <span>
                          未選定之其餘骰子：
                          <strong className="font-mono ml-1 text-[#3c2415]">
                            {rolledDice.filter((_, idx) => idx !== targetDieIndex && (useFallbackEffect !== null || idx !== effectDieIndex)).join(',') || '無'}
                          </strong>
                          （依手冊規則已自動棄置）
                        </span>
                        <span className="font-mono">
                          出目總覽: [{rolledDice.join(',')}]
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ② 武器灌注選單 */}
          {activeGadgetSubTab === 'infusion' && (
            <div className="p-4 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#d6c7ab] pb-2.5">
                <div>
                  <h4 className="font-bold text-sm text-[#2c221e] flex items-center gap-2">
                    <GiBroadsword className="w-5 h-5 text-[#6b5a4b]" />
                    <span>武器灌注工藝</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-ui bg-[#f4ebd9] text-[#3c2415] font-bold">
                      {gadgets.infusion === 0 ? '尚未研發' : gadgets.infusion === 1 ? '基礎灌注' : gadgets.infusion === 2 ? '進階灌注' : '最高灌注'}
                    </span>
                  </h4>
                  <p className="text-t12 text-[#6b5a4b]">
                    攻擊命中後花費 2 IP 注入特定元素屬性，使傷害轉型並附加特殊異常
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openRuleCodex('小工具')}
                    className="px-2 py-1 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#3c2415] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                    title="開啟小工具官方手冊完整速查大表 (手冊 p.212~216)"
                  >
                    <GiSpellBook className="text-[#6b5a4b] text-xs" />
                    <span>規則概念速查</span>
                  </button>

                  {activeInfusion && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-ui bg-[#f4ebd9] text-[#3c2415] font-bold text-xs border border-[#d6c7ab]">
                      <GiCheckMark className="w-3.5 h-3.5" />
                      <span>已套用【{activeInfusion.name}】</span>
                      <button
                        type="button"
                        onClick={() => setActiveInfusion(null)}
                        className="ml-1 text-[#6b5a4b] hover:text-[#3c2415] cursor-pointer"
                        title="清除"
                      >
                        <GiCancel className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {gadgets.infusion === 0 ? (
                <div className="p-4 rounded-ui border border-dashed border-[#d6c7ab] text-center text-[#6b5a4b] space-y-1">
                  <p className="font-bold">尚未解鎖灌注術派系</p>
                  <p className="text-t12">請在角色卡技能配置中將【小工具】投入灌注術分支。</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* 基礎灌注 */}
                  {[
                    { name: '低溫', affinity: '冰', desc: '額外造成 5 點傷害，傷害類型轉為【冰】屬性。' },
                    { name: '焦火', affinity: '火', desc: '額外造成 5 點傷害，傷害類型轉為【火】屬性。' },
                    { name: '電壓', affinity: '電', desc: '額外造成 5 點傷害，傷害類型轉為【電】屬性。' }
                  ].map((inf) => (
                    <div
                      key={inf.name}
                      className="p-3 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] flex flex-col justify-between space-y-2"
                    >
                      <div>
                        <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-[#2c221e]">
                          <span className="flex items-center gap-1.5">
                            <GiBroadsword className="w-3.5 h-3.5 text-[#6b5a4b]" />
                            {inf.name}
                          </span>
                          <span className="font-mono text-t12 text-[#6b5a4b] font-bold bg-[#fbf7ee] px-1.5 py-0.5 rounded-ui">
                            2 IP
                          </span>
                        </div>
                        <p className="text-t12 text-[#6b5a4b] mt-1 leading-relaxed">
                          {renderTextWithAffinities(inf.desc)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyInfusion(inf)}
                        className="w-full mt-2 py-1 px-2 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs transition-colors cursor-pointer"
                      >
                        套用此灌注 (2 IP)
                      </button>
                    </div>
                  ))}

                  {/* 進階灌注 */}
                  {gadgets.infusion >= 2 && [
                    { name: '疾風', affinity: '風', desc: '額外造成 5 點傷害，傷害類型轉為【風】屬性。' },
                    { name: '驅邪', affinity: '光', desc: '額外造成 5 點傷害，傷害類型轉為【光】屬性。' },
                    { name: '地震', affinity: '土', desc: '額外造成 5 點傷害，傷害類型轉為【土】屬性。' },
                    { name: '暗影', affinity: '暗', desc: '額外造成 5 點傷害，傷害類型轉為【暗】屬性。' }
                  ].map((inf) => (
                    <div
                      key={inf.name}
                      className="p-3 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] flex flex-col justify-between space-y-2"
                    >
                      <div>
                        <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-[#2c221e]">
                          <span className="flex items-center gap-1.5">
                            <GiBroadsword className="w-3.5 h-3.5 text-[#6b5a4b]" />
                            {inf.name}
                          </span>
                          <span className="font-mono text-t12 text-[#6b5a4b] font-bold bg-[#fbf7ee] px-1.5 py-0.5 rounded-ui">
                            2 IP
                          </span>
                        </div>
                        <p className="text-t12 text-[#6b5a4b] mt-1 leading-relaxed">
                          {renderTextWithAffinities(inf.desc)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyInfusion(inf)}
                        className="w-full mt-2 py-1 px-2 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs transition-colors cursor-pointer"
                      >
                        套用此灌注 (2 IP)
                      </button>
                    </div>
                  ))}

                  {/* 最高灌注 */}
                  {gadgets.infusion >= 3 && [
                    { name: '吸血', affinity: '物理', desc: '（限單體目標）恢復攻擊目標所受傷害半數之 HP 或 MP。' },
                    { name: '毒液', affinity: '毒', desc: '額外造成 5 點傷害，傷害類型轉為【毒】且令每個被命中的生物陷入中毒狀態。' }
                  ].map((inf) => (
                    <div
                      key={inf.name}
                      className="p-3 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] flex flex-col justify-between space-y-2"
                    >
                      <div>
                        <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-[#2c221e]">
                          <span className="flex items-center gap-1.5 text-[#3c2415]">
                            <GiBroadsword className="w-3.5 h-3.5 text-[#6b5a4b]" />
                            {inf.name} (最高)
                          </span>
                          <span className="font-mono text-t12 text-[#6b5a4b] font-bold bg-[#f4ebd9] px-1.5 py-0.5 rounded-ui">
                            2 IP
                          </span>
                        </div>
                        <p className="text-t12 text-[#6b5a4b] mt-1 leading-relaxed">
                          {renderTextWithAffinities(inf.desc)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyInfusion(inf)}
                        className="w-full mt-2 py-1 px-2 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs transition-colors cursor-pointer"
                      >
                        套用此灌注 (2 IP)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ③ 魔導科技工坊 */}
          {activeGadgetSubTab === 'magitech' && (
            <div className="p-4 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#d6c7ab] pb-2.5">
                <div>
                  <h4 className="font-bold text-sm text-[#2c221e] flex items-center gap-2">
                    <GiGears className="w-5 h-5 text-[#6b5a4b]" />
                    <span>魔導科技工坊</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-ui bg-[#f4ebd9] text-[#3c2415] font-bold">
                      {gadgets.magitech === 0
                        ? '尚未研發'
                        : technoRestrictsEquipment
                          ? (gadgets.magitech >= 2 ? '魔法球原型' : '基礎篡奪')
                          : (gadgets.magitech === 1 ? '基礎篡奪' : gadgets.magitech === 2 ? '魔加農火器' : '魔法球原型')}
                    </span>
                  </h4>
                  <p className="text-t12 text-[#6b5a4b]">
                    {technoRestrictsEquipment
                      ? '奪取士兵構裝體控制權、快捷施放魔法球原型咒語（魔晶石制：魔加農不存在，p.133）'
                      : '奪取士兵構裝體控制權、製造尖端魔加農火器、快捷施放魔法球原型咒語'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openRuleCodex('小工具')}
                  className="px-2 py-1 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#3c2415] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="開啟小工具官方手冊完整速查大表 (手冊 p.212~216)"
                >
                  <GiSpellBook className="text-[#6b5a4b] text-xs" />
                  <span>規則概念速查</span>
                </button>
              </div>

              {gadgets.magitech === 0 ? (
                <div className="p-4 rounded-ui border border-dashed border-[#d6c7ab] text-center text-[#6b5a4b] space-y-1">
                  <p className="font-bold">尚未解鎖魔導科技派系</p>
                  <p className="text-t12">請在角色卡技能配置中將【小工具】投入魔導科技分支。</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 基礎：魔科技篡奪 */}
                  <div className="p-3.5 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] space-y-2">
                    <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-[#2c221e]">
                      <span className="flex items-center gap-1.5">
                        <GiGears className="w-4 h-4 text-[#6b5a4b]" />
                        魔科技篡奪（基礎）
                      </span>
                      <span className="font-mono text-xs text-[#6b5a4b] font-bold">
                        10 MP · 動作
                      </span>
                    </div>
                    <p className="text-t12 text-[#6b5a4b] leading-relaxed">
                      使用動作花費 10 MP，對附近可見的無心智士兵級構裝體執行對抗檢定【INS + INS】。成功則奪取其控制權至場景結束（受傷解除）。
                    </p>
                    <div className="flex justify-end pt-1">
                      <JRPGButton
                        variant="secondary"
                        size="xs"
                        icon={GiDiceSixFacesFive}
                        onClick={handleUsurpConstruct}
                      >
                        發起篡奪檢定 (10 MP)
                      </JRPGButton>
                    </div>
                  </div>

                  {/* 進階：魔加農火器 —— 魔晶石制下整檔不存在（p.133 removing the magicannon completely） */}
                  {gadgets.magitech >= 2 && !technoRestrictsEquipment && (
                    <div className="p-3.5 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] space-y-2.5">
                      <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-[#2c221e]">
                        <span className="flex items-center gap-1.5">
                          <GiCrossedSwords className="w-4 h-4 text-[#6b5a4b]" />
                          魔加農火器製造（進階）
                        </span>
                        <span className="font-mono text-xs text-[#6b5a4b] font-bold">
                          2 IP · 火器武器
                        </span>
                      </div>

                      <div className="p-2.5 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] text-xs flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="font-bold text-[#2c221e]">
                            魔加農【雙手 · 遠程 · 無特性】
                          </div>
                          <div className="text-t12 text-[#6b5a4b] font-mono mt-0.5">
                            命中：【DEX + INS】+1 | 傷害：【HR + 10】{renderTextWithAffinities(magcannonAffinity)}
                          </div>
                        </div>

                        {/* 傷害屬性選擇器 */}
                        <div className="flex items-center gap-1">
                          <span className="text-t12 text-[#6b5a4b]">屬性：</span>
                          {['火', '冰', '電', '風', '土', '物理'].map((aff) => (
                            <button
                              key={aff}
                              type="button"
                              onClick={() => setMagcannonAffinity(aff)}
                              className={`px-1.5 py-0.5 rounded-ui text-t12 font-bold cursor-pointer transition-all ${ magcannonAffinity === aff ? 'bg-[#a63d40] text-[#fffdf9]' : 'bg-[#f4ebd9] text-[#6b5a4b] hover:bg-[#e8dcc4]' }`}
                            >
                              {aff}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-t12 text-[#6b5a4b] pt-1">
                        <span>製造後將自動裝備，並使先前舊有的魔加農碎裂銷毀</span>
                        <JRPGButton
                          variant="primary"
                          size="xs"
                          icon={GiBroadsword}
                          onClick={handleBuildMagcannon}
                        >
                          製造魔加農 (2 IP)
                        </JRPGButton>
                      </div>
                    </div>
                  )}

                  {/* 魔法球原型：核心在最高檔；魔晶石制下往下兼容成進階檔（p.133） */}
                  {gadgets.magitech >= magisphereTier && (
                    <div className="p-3.5 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] space-y-3">
                      <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-[#2c221e]">
                        <span className="flex items-center gap-1.5">
                          <GiCrystalBall className="w-4 h-4 text-[#6b5a4b]" />
                          {technoRestrictsEquipment ? '魔法球原型施放（高級）' : '魔法球原型施放（最高）'}
                        </span>
                        <span className="font-mono text-xs text-[#6b5a4b] font-bold">
                          2 IP · 瞬發咒語
                        </span>
                      </div>

                      {(!gadgets.magitechSpells || gadgets.magitechSpells.length === 0) ? (
                        <div className="p-3 rounded-ui border border-dashed border-[#d6c7ab] text-center text-t12 text-[#3c2415]">
                          尚未配置原型咒語，請在角色卡技能頁點擊「配置小工具科技樹」進行挑選。
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {gadgets.magitechSpells.map((spName) => {
                            const spDef = (rulesData.spells || []).find(s => s.name === spName);
                            if (!spDef) return null;

                            return (
                              <div
                                key={spName}
                                className="p-2.5 rounded-ui border border-[#d6c7ab] bg-[#fffdf9] flex flex-col justify-between space-y-2"
                              >
                                <div>
                                  <div className="flex items-center justify-between font-bold text-xs text-[#2c221e]">
                                    <span className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        'bg-[#6b5a4b]'
                                      }`} />
                                      {spName}
                                    </span>
                                    <span className="font-mono text-t12 text-[#6b5a4b] font-bold">
                                      {spDef.mp} MP
                                    </span>
                                  </div>
                                  <p className="text-t12 text-[#6b5a4b] mt-1 line-clamp-2 leading-relaxed">
                                    {renderTextWithAffinities(spDef.effect || spDef.desc)}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleCastSpellOrb(spName)}
                                  className="w-full py-1 px-2 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <GiCrystalBall className="w-3.5 h-3.5" />
                                  <span>施放魔法球 (2 IP + {spDef.mp} MP)</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* 標籤頁 2：造物專案 (Projects) */}
      {/* ======================================================== */}
      {activeTab === 'projects' && (
        <div className="space-y-4 animate-fade-in">
          {/* 特技加成提示列 */}
          {visionarySL > 0 && (
            <div className="p-3 rounded-ui bg-[#f4ebd9] border border-[#d6c7ab] flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="font-bold text-[#78350f] flex items-center gap-1.5">
                <GiSparkles className="w-4 h-4 text-[#8b5e34]" />
                <span>特技【高瞻遠矚】生效中 (SL {visionarySL})</span>
              </span>
              <div className="flex items-center gap-3 font-mono font-bold text-[#78350f] text-t12">
                <span>材料抵扣：-{freeCostDiscount} z</span>
                <span>每日額外進度：+{extraProgressPerDay} 點/天</span>
              </div>
            </div>
          )}

          {/* 專案列表操作列 */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
              <GiGearHammer className="w-4 h-4 text-[#8b5e34]" />
              <span>進行中的造物專案 ({projects.filter(p => !p.completed).length} 個未完成)</span>
            </span>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>發起新專案</span>
            </button>
          </div>

          {/* 專案卡片列表 */}
          {projects.length === 0 ? (
            <EmptyState
              kind="tinkerer-projects"
              icon={GiGearHammer}
              title="還沒有進行中的造物專案"
              teach="點「發起新專案」把一個造物計畫填進時鐘格；格子填滿時專案就完成了。"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((proj) => {
                const isDone = proj.filledClock >= proj.totalClock;

                return (
                  <div
                    key={proj.id}
                    className={`p-3.5 rounded-ui border transition-all flex flex-col justify-between space-y-3 ${ isDone ? 'bg-[#fbf7ee] border-[#d6c7ab]' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#a63d40]' }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isDone ? 'bg-[#a63d40]' : 'bg-[#d6c7ab]'}`} />
                          <h4 className="font-bold text-sm text-[#2c221e]">{proj.name}</h4>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-t12 px-2 py-0.5 rounded-full bg-[#f4ebd9] text-[#78350f] font-bold border border-[#d6c7ab] font-mono">
                            {proj.potency ? `${proj.potency}效力` : (proj.tier || '專案')}
                          </span>
                          {proj.area && (
                            <span className="text-t12 px-2 py-0.5 rounded-full bg-[#f4ebd9] text-[#6b5a4b] font-mono">
                              {proj.area}
                            </span>
                          )}
                          {proj.uses && (
                            <span className="text-t12 px-2 py-0.5 rounded-full bg-[#f4ebd9] text-[#6b5a4b] font-mono">
                              {proj.uses}
                            </span>
                          )}
                        </div>
                      </div>

                      {proj.description && (
                        <p className="text-t12 text-[#6b5a4b] leading-relaxed line-clamp-2">
                          {proj.description}
                        </p>
                      )}

                      {proj.specialIngredient && (
                        <div className="p-1.5 rounded-ui bg-[#fbf7ee] border border-[#d6c7ab] text-t12 text-[#3c2415] flex items-center gap-1.5">
                          <GiSparkles className="w-3.5 h-3.5 text-[#6b5a4b] shrink-0" />
                          <span className="font-bold">特殊材料：</span>
                          <span className="truncate">{proj.specialIngredient}</span>
                        </div>
                      )}

                      {proj.hasFlaw && (
                        <div className="p-1.5 rounded-ui bg-[#fbf7ee] border border-[#d6c7ab] text-t12 text-[#3c2415] flex items-center gap-1.5">
                          <GiHazardSign className="w-3.5 h-3.5 text-[#a63d40] shrink-0" />
                          <span className="font-bold">致命缺陷 (-25%)：</span>
                          <span className="truncate">{proj.flaw || '已協商缺陷'}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-1 text-t12 text-[#6b5a4b] font-mono">
                        <span className="flex items-center gap-1">
                          <GiCoins className="w-3.5 h-3.5 text-[#8b5e34]" />
                          材料花費：{proj.zenit} z
                        </span>
                        {proj.rawCost && proj.rawCost !== proj.zenit && (
                          <span className="text-[#6b5a4b] line-through">
                            (原價 {proj.rawCost} z)
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[#6b5a4b] font-bold flex items-center gap-1">
                            <GiCheckMark className="w-3.5 h-3.5" />
                            <span>完工入庫</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 命刻時鐘 */}
                    <div className="pt-2 border-t border-[#e8dcc4] flex items-center justify-between">
                      <ClockTracker
                        totalSegments={proj.totalClock}
                        filledSegments={proj.filledClock}
                        onChange={(newFilled) => handleClockChange(proj.id, newFilled)}
                        size={60}
                      />

                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-xs font-bold text-[#3c2415]">
                          進度 {proj.filledClock} / {proj.totalClock} 格
                        </span>
                        {!isDone && (
                          <button
                            type="button"
                            onClick={() => (advancingId === proj.id ? setAdvancingId(null) : handleOpenAdvance(proj))}
                            className="text-t12 font-bold text-[#8b5e34] hover:text-[#78350f] transition-colors cursor-pointer"
                          >
                            {advancingId === proj.id ? '收起' : '推進一天'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(proj.id)}
                          className="text-t12 text-[#6b5a4b] hover:text-[#a63d40] transition-colors cursor-pointer"
                        >
                          移除專案
                        </button>
                      </div>

                      {/* 每日推進面板（官方 Core p.134 / p.211 / p.137） */}
                      {advancingId === proj.id && !isDone && (
                        <div className="mt-2 p-2.5 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-t12 font-bold text-[#78350f]">推進一天</span>
                            <span className="text-t12 font-mono font-bold text-[#78350f]">
                              每日合計 +{dailyPreview.total} 格
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { key: 'workers', label: '參與人數' },
                              { key: 'tinkererWorkers', label: '其中修補匠' },
                              { key: 'helpers', label: '幫手' }
                            ].map(({ key, label }) => (
                              <div key={key} className="flex flex-col items-center gap-1">
                                <span className="text-t12 text-[#78350f] text-center">{label}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setAdvanceInput(v => ({ ...v, [key]: Math.max(0, v[key] - 1) }))}
                                    className="w-5 h-5 rounded-ui border border-[#d6c7ab] text-[#78350f] text-xs leading-none cursor-pointer hover:bg-[#f4ebd9]"
                                  >
                                    -
                                  </button>
                                  <span className="w-5 text-center font-mono text-xs font-bold text-[#78350f]">
                                    {advanceInput[key]}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAdvanceInput(v => ({ ...v, [key]: v[key] + 1 }))}
                                    className="w-5 h-5 rounded-ui border border-[#d6c7ab] text-[#78350f] text-xs leading-none cursor-pointer hover:bg-[#f4ebd9]"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="text-t12 text-[#78350f] font-mono leading-relaxed">
                            參與 {dailyPreview.workers} + 修補匠 {dailyPreview.tinkererBonus}
                            {dailyPreview.visionary > 0 ? '+ 高瞻遠矚' + dailyPreview.visionary : ''}
                            {dailyPreview.helpers > 0 ? '+ 幫手' + dailyPreview.helpers : ''}
                            {advanceInput.helpers > 0 && (
                              <span className="block text-[#8b5e34]">
                                幫手要價：每人 {helperHireCost(proj.zenit)} z（總成本一半）
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleConfirmAdvance(proj)}
                              className="px-3 py-1 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] text-t12 font-bold cursor-pointer transition-colors"
                            >
                              確認推進
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdvancingId(null)}
                              className="px-3 py-1 rounded-ui border border-[#d6c7ab] text-[#78350f] text-t12 font-bold cursor-pointer hover:bg-[#f4ebd9] transition-colors"
                            >
                              取消
                            </button>
                            {proj.daysWorked > 0 && (
                              <span className="ml-auto text-t12 text-[#8b5e34] font-mono">
                                已作業 {proj.daysWorked} 天
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 新增專案彈窗 (官方六大步驟三乘數計算器) */}
      {isAddModalOpen && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-[#2c221e]/55 backdrop-blur-xs overflow-y-auto animate-fade-in">
          {/* 背景點擊關閉 */}
          <div className="fixed inset-0 -z-10" onClick={() => setIsAddModalOpen(false)} />

          <div
            className="relative w-full max-w-xl bg-[#fffdf9] border-2 border-[#d6c7ab] rounded-ui shadow-e3 overflow-hidden my-auto flex flex-col max-h-[92vh] text-[#2c221e] text-xs font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 頂部裝飾條 */}
            <div className="h-1.5 w-full bg-[#8b5e34] shrink-0" />

            {/* 彈窗 Header */}
            <div className="px-5 py-3.5 bg-[#3c2415] text-[#f7f3e8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GiGearHammer className="w-5 h-5 text-[#e8dcc4]" />
                <h3 className="font-bold text-sm sm:text-base tracking-wide flex items-center gap-2">
                  <span>發起新造物專案</span>
                  <span className="text-t12 font-normal text-[#e8dcc4] font-mono bg-[#2c221e] px-2 py-0.5 rounded-ui border border-[#6b5a4b]">
                    核心手冊 134~139 頁
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-ui text-[#e8dcc4] hover:text-[#fffdf9] hover:bg-[#2c221e] transition-colors cursor-pointer"
                title="關閉 (ESC)"
              >
                <GiCancel className="w-4 h-4" />
              </button>
            </div>

            {/* 表單主滾動容器 */}
            <form onSubmit={handleAddProject} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* 步驟 1：名稱與描述 */}
              <div className="space-y-3 p-3.5 rounded-ui bg-[#fffdf9] border border-[#d6c7ab]">
                <div>
                  <label className="block text-t12 font-bold text-[#3c2415] mb-1">
                    發明專案名稱 <span className="text-[#a63d40]">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="例如：磁力靴、探索者號飛空艇、加特林魔像"
                    className="w-full px-3 py-2 rounded-ui border border-[#d6c7ab] bg-[#fffdf9] text-xs focus:ring-1 focus:ring-[#a63d40] focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-t12 font-bold text-[#3c2415] mb-1">
                    功能描述與運作原理 (GM 裁定可行性)
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="描述發明效果、如何運作、所需能源與具體益處。"
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-ui border border-[#d6c7ab] bg-[#fffdf9] text-xs focus:ring-1 focus:ring-[#a63d40] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 步驟 2~3：官方三乘數計算器 */}
              <div className="space-y-3.5 p-3.5 rounded-ui bg-[#fbf7ee] border border-[#d6c7ab]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#78350f] flex items-center gap-1.5">
                    <GiGearHammer className="w-4 h-4 text-[#8b5e34]" />
                    <span>官方三乘數計算器 (效力 × 範圍 × 使用次數)</span>
                  </span>
                  <span className="text-t12 font-mono text-[#6b5a4b]">
                    手冊 p.135
                  </span>
                </div>

                {/* 乘數 1：基礎效力 */}
                <div className="space-y-1.5">
                  <label className="block text-t12 font-bold text-[#3c2415]">
                    1. 基礎效力：
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {PROJECT_POTENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNewPotency(opt.key)}
                        className={`p-2 rounded-ui border text-left transition-all cursor-pointer flex flex-col justify-between ${ newPotency === opt.key ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#a63d40] text-[#3c2415]' }`}
                      >
                        <span className="font-bold text-xs">{opt.label}</span>
                        <span className={`text-t12 font-mono mt-0.5 ${newPotency === opt.key ? 'text-[#a63d40]' : 'text-[#6b5a4b]'}`}>
                          {opt.needsSpecial ? '需特殊材料' : '基礎成本'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-t12 text-[#6b5a4b] bg-[#fffdf9] p-2 rounded-ui border border-[#d6c7ab] leading-relaxed">
                    <strong>{selectedPotencyObj.label}：</strong>{selectedPotencyObj.desc}
                  </p>
                </div>

                {/* 乘數 2：範圍倍率 */}
                <div className="space-y-1.5">
                  <label className="block text-t12 font-bold text-[#3c2415]">
                    2. 範圍倍率：
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {PROJECT_AREA_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNewArea(opt.key)}
                        className={`p-2 rounded-ui border text-center transition-all cursor-pointer ${ newArea === opt.key ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#a63d40] text-[#3c2415]' }`}
                      >
                        <span className="font-bold text-xs block">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-t12 text-[#6b5a4b] bg-[#fffdf9] p-2 rounded-ui border border-[#d6c7ab] leading-relaxed">
                    <strong>{selectedAreaObj.label}：</strong>{selectedAreaObj.desc}
                  </p>
                </div>

                {/* 乘數 3：使用次數倍率 */}
                <div className="space-y-1.5">
                  <label className="block text-t12 font-bold text-[#3c2415]">
                    3. 使用次數倍率：
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PROJECT_USES_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNewUses(opt.key)}
                        className={`p-2 rounded-ui border text-center transition-all cursor-pointer ${ newUses === opt.key ? 'bg-[#a63d40] text-[#fffdf9] border-[#a63d40]' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#a63d40] text-[#3c2415]' }`}
                      >
                        <span className="font-bold text-xs block">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-t12 text-[#6b5a4b] bg-[#fffdf9] p-2 rounded-ui border border-[#d6c7ab] leading-relaxed">
                    <strong>{selectedUsesObj.label}：</strong>{selectedUsesObj.desc}
                  </p>
                </div>
              </div>

              {/* 步驟 4：致命缺陷協商 */}
              <div className="p-3.5 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[#2c221e] select-none">
                  <input
                    type="checkbox"
                    checked={newHasFlaw}
                    onChange={(e) => setNewHasFlaw(e.target.checked)}
                    className="w-4 h-4 rounded-ui text-[#8b5e34] focus:ring-[#a63d40] cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <GiHazardSign className="w-4 h-4 text-[#8b5e34]" />
                    <span>協商致命缺陷 (總成本減免 25%)</span>
                  </span>
                </label>

                {newHasFlaw && (
                  <div className="pt-2 border-t border-[#e8dcc4] space-y-1 animate-fade-in">
                    <label className="block text-t12 font-bold text-[#6b5a4b]">
                      缺陷具體限制 (選填)
                    </label>
                    <input
                      type="text"
                      value={newFlawDesc}
                      onChange={(e) => setNewFlawDesc(e.target.value)}
                      placeholder="例如：需定期回充能源、極不可靠、體積笨重噪音巨大、或具電屬性弱點。"
                      className="w-full px-3 py-1.5 rounded-ui border border-[#d6c7ab] bg-[#fbf7ee] text-xs focus:ring-1 focus:ring-[#a63d40] focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* 步驟 5：特殊成分材料備忘 (中等以上效力必填) */}
              {isSpecialRequired && (
                <div className="p-3.5 rounded-ui bg-[#fbf7ee] border border-[#d6c7ab] space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-[#3c2415] font-bold text-xs">
                    <GiSparkles className="w-4 h-4 text-[#6b5a4b]" />
                    <span>冒險焦點：特殊材料 (中等以上效力必備)</span>
                  </div>
                  <p className="text-t12 text-[#3c2415] leading-relaxed">
                    官方規則明文規範：中等及以上效力之發明，GM 會指定一項無法以金幣購買的珍稀原料，作為 1~2 場跑團冒險焦點。
                  </p>
                  <div>
                    <label className="block text-t12 font-bold text-[#3c2415] mb-1">
                      特殊原料名稱與獲取線索 <span className="text-[#a63d40]">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSpecialIngredient}
                      onChange={(e) => setNewSpecialIngredient(e.target.value)}
                      placeholder="例如：元素史萊姆的黏性核心、上古空艇浮空石、火山結晶火精髓。"
                      className="w-full px-3 py-1.5 rounded-ui border border-[#d6c7ab] bg-[#fffdf9] text-xs focus:ring-1 focus:ring-[#a63d40] focus:outline-hidden"
                      required={isSpecialRequired}
                    />
                  </div>
                </div>
              )}

              {/* 步驟 6：成本結算與進度命刻即時儀表板 */}
              <div className="p-4 rounded-ui bg-[#fffdf9] border border-[#d6c7ab] space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2">
                  <span className="font-bold text-[#78350f] flex items-center gap-1.5 text-xs">
                    <GiCoins className="w-4 h-4 text-[#8b5e34]" />
                    <span>成本結算與進度命刻即時儀表板</span>
                  </span>
                  <span className="font-mono text-t12 text-[#78350f] font-bold">
                    每 100z = 1 點進度
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[#6b5a4b] font-mono">
                    <span>基礎算式：</span>
                    <span>{selectedPotencyObj.cost} z × {selectedAreaObj.mult} × {selectedUsesObj.mult} = {calcRawCost} z</span>
                  </div>

                  {newHasFlaw && (
                    <div className="flex items-center justify-between text-[#a63d40] font-mono">
                      <span>致命缺陷減免 (-25%)：</span>
                      <span>-{calcFlawDiscount} z (折減後 {calcDiscountedCost} z)</span>
                    </div>
                  )}

                  {freeCostDiscount > 0 && (
                    <div className="flex items-center justify-between text-[#8b5e34] font-mono">
                      <span>特技【高瞻遠矚】抵扣 (SL {visionarySL})：</span>
                      <span>-{Math.min(calcDiscountedCost, freeCostDiscount)} z</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#d6c7ab] flex items-center justify-between flex-wrap gap-2 text-sm">
                    <div className="font-bold text-[#78350f] flex items-center gap-1">
                      <span>最終材料花費：</span>
                      <span className="font-mono text-base text-[#8b5e34]">{calcFinalPay} z</span>
                    </div>

                    <div className="font-bold text-[#2c221e] flex items-center gap-1">
                      <span>所需推進進度：</span>
                      <span className="font-mono text-base text-[#8b5e34]">{calcRequiredClock} 格</span>
                    </div>
                  </div>

                  <p className="text-t12 text-[#6b5a4b] pt-1">
                    每日團隊推進：每位參與 PC +1，每位修補匠 +1{visionarySL > 0 ? `，高瞻遠矚 +${visionarySL}` : ''}，幫手 +1。
                  </p>
                </div>
              </div>

              {/* 底部按鈕 */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[#d6c7ab] shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-ui border border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#f4ebd9] font-bold cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-ui bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <GiGearHammer className="w-4 h-4" />
                  <span>確認發起專案</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
