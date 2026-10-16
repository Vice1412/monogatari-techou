import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Search
} from 'lucide-react';
import {
  GiHealthNormal,
  GiLightningTear,
  GiBackpack,
  GiSparkles,
  GiCoins,
  GiUpgrade,
  GiScrollQuill,
  GiScrollUnfurled,
  GiRollingDices,
  GiHazardSign,
  GiCrossedSwords,
  GiBroadsword,
  GiShield,
  GiSpellBook,
  GiHeartShield,
  GiPocketWatch,
  GiRoundBottomFlask,
  GiCrystalBall,
  GiCheckMark,
  GiCycle
} from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import FUIcon, { renderTextWithAffinities } from '../../../components/ui/FUIcon';
import JRPGButton from '../../../components/ui/JRPGButton';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import JRPGModal from '../../../components/ui/JRPGModal';
import ClockTracker from '../../../components/ui/ClockTracker';
import { hasLegacyOffensiveSentinel } from '../../npc-workshop/data/spells';
import {
  calculateCharacterStats,
  canLevelUp,
  applyLevelUp,
  getCharacterLevel
} from '../utils/characterEngine';
import rulesData from '../data/rulesData.json';
import CharacterPreviewModal from './CharacterPreviewModal';
import { STATUS_AFFLICTIONS, ATTRIBUTE_NAMES } from '../data/sourcebookConfig';
import { getCharacterTheme } from '../utils/characterThemes';
import { getDualShieldState } from '../utils/equipmentRules';
import {
  buildCustomWeaponEntries,
  equipCustomWeapon,
  groupCustomWeapons,
  equippedFormIndex,
  nextFormFor
} from '../data/customWeapons';
import { loggableChange } from '../utils/characterLog';
import NumberStepper from '../../../components/ui/NumberStepper';
import SkillDescription, { openRuleCodex } from '../utils/skillFormulaEvaluator';
import ArcanistManager from './companions/ArcanistManager';
import ChimeristManager from './companions/ChimeristManager';
import WayfarerCompanionSheet from './companions/WayfarerCompanionSheet';
import NecromancerMinionSheet from './companions/NecromancerMinionSheet';
import PilotVehicleCombatSheet from './companions/PilotVehicleCombatSheet';
import TinkererWorkshop from './companions/TinkererWorkshop';
import GourmetCookbook from './companions/GourmetCookbook';
import AceOfCardsTable from './companions/AceOfCardsTable';
import ClassResourceStrip from './ClassResourceStrip';
import StatFormulaPanel, { STAT_FORMULA_NOTE } from './StatFormulaPanel';
import TinkererGadgetsQuickRef from './companions/TinkererGadgetsQuickRef';
import SuboptionDetailsList from './SuboptionDetailsList';
import ChanterComposer from './companions/ChanterComposer';
import FloristGardenTracker from './companions/FloristGardenTracker';
import ErrorBoundary from '../../../components/ui/ErrorBoundary';
import { withEn } from '../../../utils/properNouns';
import { STORAGE_KEYS } from '../../../data/keys';
import { readJSON, writeJSON } from '../../../data/store';

/**
 * 輔助解析武器/咒語命中檢定公式 (如 "DEX + MIG" 或 "INS + WLP")
 */
const parseCheckFormula = (formulaStr, stats) => {
  let attr1 = 'DEX';
  let attr2 = 'MIG';
  let mod = 0;

  if (formulaStr) {
    const upper = formulaStr.toUpperCase();
    const parts = upper.split('+').map(s => s.trim());

    if (parts[0]) {
      if (parts[0].includes('DEX')) attr1 = 'DEX';
      else if (parts[0].includes('INS')) attr1 = 'INS';
      else if (parts[0].includes('MIG')) attr1 = 'MIG';
      else if (parts[0].includes('WLP')) attr1 = 'WLP';
    }

    if (parts[1]) {
      if (parts[1].includes('DEX')) attr2 = 'DEX';
      else if (parts[1].includes('INS')) attr2 = 'INS';
      else if (parts[1].includes('MIG')) attr2 = 'MIG';
      else if (parts[1].includes('WLP')) attr2 = 'WLP';
    }

    const modMatch = upper.match(/([+-]\s*\d+)$/);
    if (modMatch) {
      mod = parseInt(modMatch[1].replace(/\s+/g, ''), 10) || 0;
    }
  }

  const getDie = (name) => {
    if (name === 'DEX') return stats.currentDex;
    if (name === 'INS') return stats.currentIns;
    if (name === 'MIG') return stats.currentMig;
    if (name === 'WLP') return stats.currentWlp;
    return 8;
  };

  return {
    attr1,
    attr2,
    die1: getDie(attr1),
    die2: getDie(attr2),
    mod
  };
};

/**
 * 輔助解析傷害公式 (如 "【HR + 6】物理" 或 "[HR + 15] 火")
 */
const parseDamageFormula = (dmgStr) => {
  if (!dmgStr) return { hrBonus: 0, damageType: '物理', raw: '【HR + 0】物理' };
  const bonusMatch = dmgStr.match(/HR\s*\+\s*(\d+)/i);
  const hrBonus = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;
  let damageType = '物理';
  const types = ['物理', '風', '電', '暗', '土', '火', '冰', '光', '毒'];
  for (const t of types) {
    if (dmgStr.includes(t)) {
      damageType = t;
      break;
    }
  }
  return {
    hrBonus,
    damageType,
    raw: dmgStr
  };
};

export default function CharacterPlayHUD({
  character,
  themeId = null,
  onSelectGlobalTheme = null,
  onChange,
  onBackToRoster,
  onOpenEditor,
  onOpenLog = null,
  onOpenDice = null,
  showToast = () => {}
}) {
  // Tabs: attacks (武器與防衛) | spells (咒語與魔法) | skills (職業特技) | bonds (情感羈絆) | clocks (命刻) | notes (行囊日誌)
  const [activeTab, setActiveTab] = useState('attacks');

  // Level up modal
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  // 角色卡預覽（含三頁表格的匯出）
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedClassForLevelUp, setSelectedClassForLevelUp] = useState('');
  const [selectedSkillForLevelUp, setSelectedSkillForLevelUp] = useState('');
  const [isNewClassLevelUp, setIsNewClassLevelUp] = useState(false);

  // Spell picker modal
  const [isSpellModalOpen, setIsSpellModalOpen] = useState(false);
  const [spellSearchQuery, setSpellSearchQuery] = useState('');
  const [selectedSpellSchool, setSelectedSpellSchool] = useState('all');

  // Expanded cards tracker (for skills and spells details)
  const [expandedSkills, setExpandedSkills] = useState({});
  const [expandedSpells, setExpandedSpells] = useState({});
  const [collapsedSuboptions, setCollapsedSuboptions] = useState({});

  // 數值構成公式面板：一次只開一個，key 如 'hp' / 'mp' / 'ip' / 'crisis' / 'def' / 'mdef' / 'init' / 'attr:dex'
  const [openFormula, setOpenFormula] = useState(null);
  const toggleFormula = (key) => setOpenFormula(prev => (prev === key ? null : key));

  // Free roll picker modal
  const [isFreeRollModalOpen, setIsFreeRollModalOpen] = useState(false);
  const [freeRollAttr1, setFreeRollAttr1] = useState('dex');
  const [freeRollAttr2, setFreeRollAttr2] = useState('ins');
  const [freeRollModifier, setFreeRollModifier] = useState(0);

  // Bond creator modal
  const [isBondModalOpen, setIsBondModalOpen] = useState(false);
  const [newBondTarget, setNewBondTarget] = useState('');
  const [newBondFeelings, setNewBondFeelings] = useState(['admiration']);

  // Clock creator modal
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [newClockTitle, setNewClockTitle] = useState('');
  const [newClockSegments, setNewClockSegments] = useState(6);

  if (!character) return null;

  const theme = getCharacterTheme(character.themeColor || themeId);
  const stats = calculateCharacterStats(character);
  const breakdown = stats.breakdown || {};
  const curHp = character.currentHp !== null && character.currentHp !== undefined ? character.currentHp : stats.maxHp;
  const curMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : stats.maxMp;
  const curIp = character.currentIp !== null && character.currentIp !== undefined ? character.currentIp : stats.maxIp;
  const isCrisis = curHp <= stats.crisisThreshold;
  // 四維還沒指派完 → 六項數值不成立（見 `calculateCharacterStats` 的 `attributesUnset`）
  const statsUnset = Boolean(stats.attributesUnset);
  const isReadyToLevelUp = canLevelUp(character);

  /**
   * 所有數值變更的唯一出口。
   * `meta` 有值時會留下一筆成長履歷（見 utils/characterLog.js）——
   * HP／MP／IP／EXP／資金／物語點都是「跑團中一路記錄」的對象。
   * `from` 一律傳**顯示值**（currentHp 的 null 代表滿血，記錄裡不該出現 null）。
   */
  const updateField = (field, val, meta = null) => {
    const base = {
      ...character,
      [field]: val,
      updatedAt: new Date().toISOString()
    };
    onChange(meta ? loggableChange(character, base, meta) : base);
  };

  // Adjust Vital Resources
  // 夾制後沒有實際變化時直接結束：不寫 localStorage、也不留下一筆「0 → 0」的空記錄
  const adjustHp = (delta) => {
    const next = Math.max(0, Math.min(stats.maxHp, curHp + delta));
    if (next === curHp) return;
    updateField('currentHp', next, {
      kind: 'hp',
      title: delta < 0 ? '承受傷害' : '回復 HP',
      changes: [{ field: 'currentHp', from: curHp, to: next }]
    });
  };

  const adjustMp = (delta) => {
    const next = Math.max(0, Math.min(stats.maxMp, curMp + delta));
    if (next === curMp) return;
    updateField('currentMp', next, {
      kind: 'mp',
      title: delta < 0 ? '消耗 MP' : '回復 MP',
      changes: [{ field: 'currentMp', from: curMp, to: next }]
    });
  };

  const adjustIp = (delta) => {
    const next = Math.max(0, Math.min(stats.maxIp, curIp + delta));
    if (next === curIp) return;
    updateField('currentIp', next, {
      kind: 'ip',
      title: delta < 0 ? '消耗 IP' : '回復 IP',
      changes: [{ field: 'currentIp', from: curIp, to: next }]
    });
  };

  const adjustExp = (delta) => {
    const cur = character.exp || 0;
    const next = Math.max(0, cur + delta);
    if (next === cur) return;
    updateField('exp', next, {
      kind: 'exp',
      title: delta < 0 ? '扣除 EXP' : '獲得 EXP',
      changes: [{ field: 'exp', from: cur, to: next }]
    });
  };

  const adjustZenit = (delta) => {
    const cur = character.zenit || 0;
    const next = Math.max(0, cur + delta);
    if (next === cur) return;
    updateField('zenit', next, {
      kind: 'zenit',
      title: delta < 0 ? '支出資金' : '獲得資金',
      changes: [{ field: 'zenit', from: cur, to: next }]
    });
  };

  const adjustFp = (delta) => {
    const cur = character.fabulaPoints ?? 3;
    const next = Math.max(0, cur + delta);
    if (next === cur) return;
    updateField('fabulaPoints', next, {
      kind: 'fp',
      title: delta < 0 ? '消耗物語點' : '獲得物語點',
      changes: [{ field: 'fabulaPoints', from: cur, to: next }]
    });
  };

  // Toggle Status Afflictions
  const handleToggleAffliction = (affKey) => {
    const curAff = character.statusAfflictions || {};
    const updated = {
      ...curAff,
      [affKey]: !curAff[affKey]
    };
    updateField('statusAfflictions', updated);
  };

  // Consumable shortcut using IP
  const handleUseConsumable = (type) => {
    if (type === 'potion') {
      if (curIp < 2) { showToast('道具點不足 2 點', 'warning'); return; }
      const nextIp = Math.max(0, curIp - 2);
      const nextHp = Math.max(0, Math.min(stats.maxHp, curHp + 40));
      onChange({
        ...character,
        currentIp: nextIp,
        currentHp: nextHp,
        updatedAt: new Date().toISOString()
      });
      showToast(`使用治療藥水！回復 40 點 HP (消耗 2 IP，剩餘 ${nextIp} IP)`, 'success');
    } else if (type === 'elixir') {
      if (curIp < 2) { showToast('道具點不足 2 點', 'warning'); return; }
      const nextIp = Math.max(0, curIp - 2);
      const nextMp = Math.max(0, Math.min(stats.maxMp, curMp + 40));
      onChange({
        ...character,
        currentIp: nextIp,
        currentMp: nextMp,
        updatedAt: new Date().toISOString()
      });
      showToast(`使用魔力萬能藥！回復 40 點 MP (消耗 2 IP，剩餘 ${nextIp} IP)`, 'success');
    } else if (type === 'antidote') {
      if (curIp < 1) { showToast('道具點不足 1 點', 'warning'); return; }
      const nextIp = Math.max(0, curIp - 1);
      onChange({
        ...character,
        currentIp: nextIp,
        statusAfflictions: { ...(character.statusAfflictions || {}), poisoned: false },
        updatedAt: new Date().toISOString()
      });
      showToast(`使用解毒劑！解除中毒狀態 (消耗 1 IP，剩餘 ${nextIp} IP)`, 'success');
    } else if (type === 'tonic') {
      if (curIp < 1) { showToast('道具點不足 1 點', 'warning'); return; }
      const nextIp = Math.max(0, curIp - 1);
      onChange({
        ...character,
        currentIp: nextIp,
        statusAfflictions: {
          ...(character.statusAfflictions || {}),
          dazed: false,
          shaken: false
        },
        updatedAt: new Date().toISOString()
      });
      showToast(`使用提神藥！解除眩暈與動搖狀態 (消耗 1 IP，剩餘 ${nextIp} IP)`, 'success');
    }
  };

  // Send Character to Combat Tracker
  const handleSendToCombat = () => {
    try {
      const activeCombat = readJSON(STORAGE_KEYS.activeCombat, { combatants: [] });
      const combatants = activeCombat.combatants || [];

      const existingIdx = combatants.findIndex(c => c.sourceId === character.id);
      const combatantData = {
        instanceId: `comb_${character.id}_${Date.now()}`,
        sourceId: character.id,
        sourceType: 'character',
        name: character.name || '冒險者',
        avatar: character.avatar || null,
        faction: '玩家隊伍',
        level: getCharacterLevel(character),
        rank: '玩家',
        role: (character.classes || []).map(c => c.className).join(' / ') || '冒險者',
        species: '玩家',
        hp: {
          current: curHp,
          max: stats.maxHp,
          crisisThreshold: stats.crisisThreshold
        },
        mp: {
          current: curMp,
          max: stats.maxMp
        },
        ip: {
          current: curIp,
          max: stats.maxIp
        },
        fabulaPoints: character.fabulaPoints ?? 3,
        attributes: {
          dex: stats.currentDex,
          ins: stats.currentIns,
          mig: stats.currentMig,
          wlp: stats.currentWlp
        },
        defense: stats.def,
        magicDefense: stats.mdef,
        initiative: stats.init,
        hasActed: false,
        statusEffects: { ...character.statusAfflictions },
        skills: (character.classes || []).flatMap(cl => (cl.skills || []).map(sk => ({
          id: `${cl.className}_${sk.name}`,
          name: `${sk.name} (SL ${sk.sl})`,
          category: 'skill',
          desc: `【${cl.className}】特技`,
          isRevealed: true
        }))),
        rawCharData: character
      };

      if (existingIdx >= 0) {
        combatants[existingIdx] = combatantData;
      } else {
        combatants.push(combatantData);
      }

      activeCombat.combatants = combatants;
      writeJSON(STORAGE_KEYS.activeCombat, activeCombat);
      showToast(`已將【${character.name}】同步至戰鬥房間！`);
    } catch (e) {
      console.error(e);
      showToast('入戰失敗，請重試。');
    }
  };

  // Level Up logic
  const handleExecuteLevelUp = () => {
    if (!selectedClassForLevelUp || !selectedSkillForLevelUp) {
      showToast('請選擇要升級的職業與特技');
      return;
    }

    const updated = applyLevelUp(character, {
      className: selectedClassForLevelUp,
      skillName: selectedSkillForLevelUp,
      isNewClass: isNewClassLevelUp
    });

    // 成長履歷：升級是最重要的一筆——等級、EXP，以及點在哪個職業的哪個技能
    onChange(loggableChange(character, updated, {
      kind: 'levelup',
      title: `升級：${withEn(selectedClassForLevelUp)}【${selectedSkillForLevelUp}】${isNewClassLevelUp ? '（新職業）' : ''}`,
      fields: ['level', 'exp']
    }));
    setIsLevelUpModalOpen(false);
    setSelectedClassForLevelUp('');
    setSelectedSkillForLevelUp('');
    setIsNewClassLevelUp(false);
    showToast(`恭喜！等級提升至 Level ${updated.level}！`);
  };

  // Equipments resolution
  const mainShieldEquipped = rulesData.equipment.shields.find(s => s.name === character.equipment?.mainHand);
  const offShield = rulesData.equipment.shields.find(s => s.name === character.equipment?.offHand);

  // 守護者【雙重盾牌】：兩手皆盾時合併視為「雙盾」，
  // 攻擊改用該技能的命中【MIG + MIG】與傷害【HR + 5】——盾牌本身沒有攻擊資料。
  const dualShield = getDualShieldState(character, {
    mainIsShield: Boolean(mainShieldEquipped),
    offIsShield: Boolean(offShield)
  });

  // 定制武器（HF p.106）也是武器：官方武器表找不到時，改找**這個角色自己鍛造的那些**。
  // 沒有這一段的話，主手是定制武器時跑團面板會退回一個沒數值的空殼（命中 DEX+MIG、HR+0），
  // 玩家在衝突中看到的就是錯的數字。
  const ownCustomWeapons = buildCustomWeaponEntries(character);
  const resolveWeapon = (name) => rulesData.equipment.weapons.find(w => w.name === name)
    || ownCustomWeapons.find(w => w.name === name);

  const mainWeapon = dualShield.active
    ? dualShield.weapon
    : (resolveWeapon(character.equipment?.mainHand) || {
        name: character.equipment?.mainHand || '徒手打擊',
        attr: 'DEX + MIG',
        damage: '【HR + 0】物理',
        range: '近戰',
        category: '鬥毆'
      });

  const offWeapon = resolveWeapon(character.equipment?.offHand);

  // 可變形武器：**跑團時就在這裡切換型態**（原書 p.107 說裝備其中一種型態就能隨時變形，
  // 所以玩家在衝突中需要的是這一顆按鈕，而不是回編輯器改裝備）。
  const transformingGroup = groupCustomWeapons(character.customWeapons || [])
    .find((g) => g.isTransforming && equippedFormIndex(g, character.equipment?.mainHand) >= 0);
  const switchForm = transformingGroup
    ? nextFormFor(transformingGroup, character.equipment?.mainHand)
    : null;

  const handleSwitchForm = () => {
    if (!switchForm) return;
    const { equipment } = equipCustomWeapon(character, switchForm.name);
    onChange(loggableChange(character, { ...character, equipment }, {
      kind: 'equipment',
      title: `變形：${character.equipment?.mainHand} → ${switchForm.name}`
    }));
  };

  // Parse weapon checks & damage
  const mainCheck = parseCheckFormula(mainWeapon.attr, stats);
  const mainDamage = parseDamageFormula(mainWeapon.damage);

  const offCheck = offWeapon ? parseCheckFormula(offWeapon.attr, stats) : null;
  const offDamage = offWeapon ? parseDamageFormula(offWeapon.damage) : null;

  // Unarmed check
  const unarmedCheck = parseCheckFormula('DEX + MIG', stats);
  const unarmedDamage = parseDamageFormula('【HR + 0】物理');

  // Toggle expand for skills/spells
  const toggleSkillExpand = (key) => {
    setExpandedSkills(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSpellExpand = (key) => {
    setExpandedSpells(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Add spell to character
  const handleLearnSpell = (spell) => {
    const currentSpells = character.spells || [];
    if (currentSpells.some(s => s.name === spell.name)) {
      showToast('已掌握此咒語');
      return;
    }

    const newSpells = [...currentSpells, {
      name: spell.name,
      school: spell.school || '通用',
      mp: spell.mp || '10',
      target: spell.target || '單體',
      duration: spell.duration || '瞬發',
      isOffensive: !!spell.isOffensive || hasLegacyOffensiveSentinel(spell.name) || spell.effect?.includes('（o）') || spell.effect?.includes('受到'),
      effect: spell.effect || ''
    }];

    updateField('spells', newSpells);
    showToast(`已掌握咒語【${spell.name}】！`);
    setIsSpellModalOpen(false);
  };

  const handleForgetSpell = (spellName) => {
    const newSpells = (character.spells || []).filter(s => s.name !== spellName);
    updateField('spells', newSpells);
    showToast(`已移除咒語【${spellName}】`);
  };

  const handleCastSpell = (spell) => {
    const costMatch = String(spell.mp).match(/\d+/);
    const mpCost = costMatch ? parseInt(costMatch[0], 10) : 10;
    if (curMp < mpCost) {
      showToast(`MP 不足！施放此咒語需要 ${mpCost} 點 MP`);
      return;
    }
    adjustMp(-mpCost);
    showToast(`施放【${spell.name}】！消耗 ${mpCost} 點 MP`);
  };

  // Add new bond
  const handleAddBond = () => {
    if (!newBondTarget.trim()) {
      showToast('請輸入羈絆目標名稱');
      return;
    }
    const currentBonds = character.bonds || [];
    if (currentBonds.length >= 6) {
      showToast('已達羈絆上限 (最多 6 個)');
      return;
    }
    const newBond = {
      id: `bond_${Date.now()}`,
      target: newBondTarget.trim(),
      feelings: newBondFeelings
    };
    updateField('bonds', [...currentBonds, newBond]);
    setNewBondTarget('');
    setNewBondFeelings(['admiration']);
    setIsBondModalOpen(false);
    showToast('已建立新情感羈絆！');
  };

  const handleDeleteBond = (bondId) => {
    const updated = (character.bonds || []).filter(b => b.id !== bondId);
    updateField('bonds', updated);
    showToast('已移除羈絆');
  };

  // Add new clock
  const handleAddClock = () => {
    if (!newClockTitle.trim()) {
      showToast('請輸入命刻主題');
      return;
    }
    const currentClocks = character.clocks || [];
    const newClock = {
      id: `clock_${Date.now()}`,
      title: newClockTitle.trim(),
      totalSegments: newClockSegments,
      filledSegments: 0,
      theme: 'amber',
      type: 'circle'
    };
    updateField('clocks', [...currentClocks, newClock]);
    setNewClockTitle('');
    setIsClockModalOpen(false);
    showToast('已建立新個人命刻！');
  };

  const handleDeleteClock = (clockId) => {
    const updated = (character.clocks || []).filter(c => c.id !== clockId);
    updateField('clocks', updated);
    showToast('已刪除個人命刻');
  };

  // Filter available spells for modal
  const availableRulesSpells = useMemo(() => {
    const spells = rulesData.spells || [];
    return spells.filter(s => {
      const matchSearch = (s.name || '').toLowerCase().includes(spellSearchQuery.toLowerCase()) ||
                          (s.effect || '').toLowerCase().includes(spellSearchQuery.toLowerCase());
      const matchSchool = selectedSpellSchool === 'all' || s.school === selectedSpellSchool;
      return matchSearch && matchSchool;
    });
  }, [spellSearchQuery, selectedSpellSchool]);

  const spellSchools = useMemo(() => {
    const set = new Set();
    (rulesData.spells || []).forEach(s => {
      if (s.school) set.add(s.school);
    });
    return Array.from(set);
  }, []);

  return (
    <div className="space-y-4 text-slate-800 animate-fade-in">
      {/* 1. Top Play HUD Dashboard Banner */}
      <div
        className="rounded-xl p-4 sm:p-5 shadow-sm space-y-4 border-2 transition-colors duration-200"
        style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
      >
        {/* Header Profile Row */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b pb-3" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-3">
            <div
              onClick={() => onOpenEditor()}
              className="w-11 h-11 rounded-xl border flex items-center justify-center font-serif text-lg font-bold overflow-hidden shadow-inner shrink-0 bg-white cursor-pointer hover:ring-2 hover:scale-105 transition-all group relative"
              style={{ borderColor: theme.border, color: theme.accent }}
              title="點擊前往「構築與成長」更換或調整頭像"
            >
              {character.avatar ? (
                character.avatar.startsWith('http') || character.avatar.startsWith('data:') ? (
                  <img src={character.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <GameIcon name={character.avatar} className="w-7 h-7" style={{ color: theme.accent }} />
                )
              ) : (
                <GameIcon name={character.classes?.[0]?.className || 'GiSparkles'} className="w-7 h-7" style={{ color: theme.accent }} />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-bold">
                更換
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-black text-xl tracking-wide" style={{ color: theme.textDark }}>
                  {character.name || '冒險者'}
                </h3>
                <JRPGBadge variant={theme.badgeVariant} size="sm">
                  Lv {getCharacterLevel(character)}
                </JRPGBadge>
                {isCrisis && (
                  <JRPGBadge variant="rose" size="xs" className="flex items-center gap-1 font-mono animate-pulse">
                    <FUIcon name="crisis" className="text-xs leading-none" />
                    <span>CRISIS 危機</span>
                  </JRPGBadge>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {character.identity || '未設定身份'} · <strong style={{ color: theme.accent }}>{character.theme || '未設定主題'}</strong>
                {character.origin && ` · 來自 ${character.origin}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {isReadyToLevelUp && (
              <button
                type="button"
                onClick={() => setIsLevelUpModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md animate-bounce flex items-center gap-1.5"
              >
                <GiUpgrade className="w-4 h-4" />
                <span>可升級！</span>
              </button>
            )}

            <button
              onClick={handleSendToCombat}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
              title="將角色即時狀態同步至戰鬥追蹤器"
            >
              <GiCrossedSwords className="w-3.5 h-3.5" />
              <span>推入戰鬥</span>
            </button>

            <button
              onClick={() => setIsPreviewOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
              style={{ borderColor: theme.border, color: theme.textDark }}
              title="看整張卡現在長什麼樣，也可以直接匯出 PNG／PDF"
            >
              <GiScrollUnfurled className="w-3.5 h-3.5" />
              <span>卡片預覽</span>
            </button>

            <button
              onClick={() => onOpenEditor()}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
              style={{ borderColor: theme.border, color: theme.textDark }}
            >
              <span>構築與成長</span>
            </button>

            {onOpenLog && (
              <button
                onClick={onOpenLog}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 border text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                style={{ borderColor: theme.border, color: theme.textDark }}
                title="成長履歷：HP／MP／EXP／資金／升級／換裝的完整記錄"
              >
                <GiScrollQuill className="w-3.5 h-3.5" />
                <span>履歷</span>
              </button>
            )}
          </div>
        </div>

        {/* Level Growth, Zenit Wallet, Fabula Points Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* EXP Progress */}
          <div className="bg-[#fffdf9] rounded-xl p-3 border shadow-xs flex flex-col justify-between" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono font-bold flex items-center gap-1" style={{ color: theme.textDark }}>
                <GiUpgrade className="w-3.5 h-3.5 text-amber-700" />
                經驗升級
              </span>
              <span className="font-mono text-xs font-bold text-slate-700">
                {character.exp || 0} / 10
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden mb-2 bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  backgroundColor: theme.accent,
                  width: `${Math.min(100, ((character.exp || 0) / 10) * 100)}%`
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-1">
              <NumberStepper
                value={character.exp || 0}
                onDelta={adjustExp}
                ariaLabel="經驗值"
                width="w-14"
              />
              <span className="text-[10px] text-slate-400 font-mono">10 EXP 升 1 級</span>
            </div>
          </div>

          {/* Zenit Wallet */}
          <div className="bg-[#fffdf9] rounded-xl p-3 border shadow-xs flex flex-col justify-between" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono font-bold flex items-center gap-1" style={{ color: theme.textDark }}>
                <GiCoins className="w-3.5 h-3.5 text-amber-600" />
                金幣錢包
              </span>
              <span className="font-mono font-black text-sm text-amber-900">
                {character.zenit || 0} z
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-auto pt-2">
              <NumberStepper
                value={character.zenit || 0}
                onDelta={adjustZenit}
                ariaLabel="金幣"
                width="w-20"
                inputClassName="text-amber-900"
              />
              <span className="text-[10px] text-slate-400 font-mono">z</span>
            </div>
          </div>

          {/* Fabula Points */}
          <div className="bg-[#fffdf9] rounded-xl p-3 border shadow-xs flex flex-col justify-between" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono font-bold flex items-center gap-1" style={{ color: theme.textDark }}>
                <GiSparkles className="w-3.5 h-3.5 text-indigo-600" />
                物語點
              </span>
              <span className="font-mono font-black text-sm text-indigo-950">
                {character.fabulaPoints ?? 3} FP
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-auto pt-2">
              <NumberStepper
                value={character.fabulaPoints ?? 3}
                onDelta={adjustFp}
                ariaLabel="物語點"
                width="w-14"
                inputClassName="text-indigo-950"
              />
              <span className="text-[10px] text-slate-400 font-mono">FP</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Vital Resource Gauges (HP / MP / IP) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* HP Gauge */}
        <div className={`rounded-xl p-4 border-2 transition-all shadow-xs ${
          isCrisis
            ? 'bg-red-50/90 border-red-500 ring-2 ring-red-300/60'
            : 'bg-[#fffdf9] border-[#d6c7ab]'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-red-900">
              <GiHealthNormal className="w-4 h-4 text-red-600" />
              <span>生命值</span>
              {isCrisis && (
                <span className="text-[10px] text-red-700 font-mono font-black flex items-center gap-0.5">
                  <FUIcon name="crisis" className="text-xs" />
                  <span>CRISIS 危機</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleFormula('hp')}
              title="點擊查看公式"
              className="font-mono font-black text-base text-red-950 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              {statsUnset ? '—' : <>{curHp} <span className="text-xs text-slate-500 font-normal">/ {stats.maxHp}</span></>}
            </button>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isCrisis ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}
              style={{ width: `${Math.min(100, (curHp / stats.maxHp) * 100)}%` }}
            />
          </div>

            <div className="flex items-center justify-between gap-1 mt-auto pt-2">
              {/* 數值可直接填寫；輸入 +N／-N 以增減計算（見 NumberStepper） */}
              <NumberStepper
                value={curHp}
                onDelta={adjustHp}
                ariaLabel="生命值"
                width="w-14"
                inputClassName="text-red-950"
              />
              <button
                onClick={() => updateField('currentHp', stats.maxHp)}
                className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-950 font-bold text-xs"
              >
                全滿
              </button>
            </div>

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => toggleFormula('crisis')}
              title="點擊查看公式"
              className="text-[10px] font-mono font-bold text-red-900 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              危機門檻 {statsUnset ? '—' : stats.crisisThreshold}
            </button>
          </div>

          <StatFormulaPanel
            isOpen={openFormula === 'hp'}
            title="最大生命值"
            breakdown={breakdown.hp}
            note={STAT_FORMULA_NOTE}
            onClose={() => setOpenFormula(null)}
          />

          <StatFormulaPanel
            isOpen={openFormula === 'crisis'}
            title="危機門檻"
            breakdown={breakdown.crisis}
            onClose={() => setOpenFormula(null)}
          />
        </div>

        {/* MP Gauge */}
        <div className="rounded-xl p-4 border border-[#d6c7ab] bg-[#fffdf9] shadow-xs">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <GiLightningTear className="w-4 h-4 text-blue-600" />
              <span>魔力值</span>
            </div>
            <button
              type="button"
              onClick={() => toggleFormula('mp')}
              title="點擊查看公式"
              className="font-mono font-black text-base text-blue-950 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              {statsUnset ? '—' : <>{curMp} <span className="text-xs text-slate-500 font-normal">/ {stats.maxMp}</span></>}
            </button>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (curMp / stats.maxMp) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-1">
            <NumberStepper
              value={curMp}
              onDelta={adjustMp}
              ariaLabel="魔力值"
              width="w-14"
              inputClassName="text-blue-950"
            />
            <button
              onClick={() => updateField('currentMp', stats.maxMp)}
              className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold text-xs"
            >
              全滿
            </button>
          </div>

          <StatFormulaPanel
            isOpen={openFormula === 'mp'}
            title="最大魔力值"
            breakdown={breakdown.mp}
            note={STAT_FORMULA_NOTE}
            onClose={() => setOpenFormula(null)}
          />
        </div>

        {/* IP Gauge & Consumables */}
        <div className="rounded-xl p-4 border border-[#d6c7ab] bg-[#fffdf9] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <GiBackpack className="w-4 h-4 text-emerald-600" />
                <span>道具點</span>
              </div>
              <button
                type="button"
                onClick={() => toggleFormula('ip')}
                title="點擊查看公式"
                className="font-mono font-black text-base text-emerald-950 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
              >
                {curIp} <span className="text-xs text-slate-500 font-normal">/ {stats.maxIp}</span>
              </button>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (curIp / stats.maxIp) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 flex-wrap">
            <NumberStepper
              value={curIp}
              onDelta={adjustIp}
              ariaLabel="物品點"
              width="w-14"
            />
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => handleUseConsumable('potion')}
                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 text-[11px] font-bold"
                title="治療藥水: 回復 40 HP (消耗 2 IP)"
              >
                藥水(2)
              </button>
              <button
                onClick={() => handleUseConsumable('elixir')}
                className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[11px] font-bold"
                title="魔力萬能藥: 回復 40 MP (消耗 2 IP)"
              >
                魔藥(2)
              </button>
              <button
                onClick={() => handleUseConsumable('antidote')}
                className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold"
                title="解毒劑: 解除中毒 (消耗 1 IP)"
              >
                解毒(1)
              </button>
            </div>
          </div>

          <StatFormulaPanel
            isOpen={openFormula === 'ip'}
            title="最大道具點"
            breakdown={breakdown.ip}
            onClose={() => setOpenFormula(null)}
          />
        </div>
      </div>

      {/* 3. 職業資源池（只有對應職業才出現；數值見 data/classResources.js） */}
      <ClassResourceStrip
        character={character}
        onChange={onChange}
        showToast={showToast}
      />

      {/* 4. Status Afflictions (六大狀態異常) */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <GiHazardSign className="w-3.5 h-3.5 text-amber-600" />
            <span>狀態異常監控</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">點擊直接切換狀態</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {Object.keys(STATUS_AFFLICTIONS).map(key => {
            const aff = STATUS_AFFLICTIONS[key];
            const isActive = !!character.statusAfflictions?.[key];

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleToggleAffliction(key)}
                className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm ${
                  isActive
                    ? 'bg-red-600 border-red-700 text-white animate-pulse'
                    : 'bg-[#f5efdf] border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#ebdcc4]'
                }`}
                title={aff.desc}
              >
                <span>{aff.short}</span>
                {isActive && <span className="text-[10px] opacity-90 font-mono">(-1階)</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Four Attributes Block (DEX / INS / MIG / WLP - Click-to-Roll) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'dex', enName: 'DEX', zhName: ATTRIBUTE_NAMES.dex, cur: stats.currentDex, base: stats.baseDex },
          { key: 'ins', enName: 'INS', zhName: ATTRIBUTE_NAMES.ins, cur: stats.currentIns, base: stats.baseIns },
          { key: 'mig', enName: 'MIG', zhName: ATTRIBUTE_NAMES.mig, cur: stats.currentMig, base: stats.baseMig },
          { key: 'wlp', enName: 'WLP', zhName: ATTRIBUTE_NAMES.wlp, cur: stats.currentWlp, base: stats.baseWlp }
        ].map(attr => (
          <div key={attr.key} className="space-y-1.5">
            <button
              type="button"
              onClick={() => onOpenDice && onOpenDice({
                die1: attr.cur,
                die2: attr.cur,
                modifier: 0,
                label: `${attr.enName} (${attr.zhName}) 單項檢定`
              })}
              className="w-full rounded-xl p-3.5 border flex flex-col items-center gap-1 shadow-xs transition-all text-center group bg-[#fffdf9] hover:shadow-md hover:scale-[1.01]"
              style={{ borderColor: theme.border }}
              title={`點擊使用 ${attr.enName} 擲骰`}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black tracking-wider text-slate-900 font-mono">
                  {attr.enName}
                </span>
                <span className="text-xs text-slate-500 font-sans">
                  {attr.zhName}
                </span>
              </div>

              <div className="text-2xl font-serif font-black flex items-baseline gap-1 mt-0.5" style={{ color: theme.textDark }}>
                <span>d{attr.cur}</span>
                {attr.cur < attr.base && (
                  <span className="text-xs text-red-500 line-through font-mono">d{attr.base}</span>
                )}
              </div>

              <span className="text-[10px] text-slate-400 font-sans group-hover:text-amber-800 flex items-center gap-1 transition-colors">
                <GiRollingDices className="w-3 h-3" />
                <span>點擊檢定</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleFormula(`attr:${attr.key}`)}
              title="點擊查看公式"
              className="w-full text-[10px] font-bold text-[#7c6a58] hover:text-[#3c2415] py-0.5 rounded-lg border border-dashed border-[#d6c7ab] hover:border-[#3c2415]/30 transition-colors cursor-pointer"
            >
              ✦ 公式
            </button>

            <StatFormulaPanel
              isOpen={openFormula === `attr:${attr.key}`}
              title={`${attr.enName} 當前骰`}
              breakdown={breakdown.attributes?.[attr.key]}
              onClose={() => setOpenFormula(null)}
            />
          </div>
        ))}
      </div>

      {/* 6. Sub-Tabs: 武器與戰鬥 | 咒語與魔法 | 職業特技 | 情感羈絆 | 個人命刻 | 行囊日誌 */}
      <div className="bg-[#fffdf9] rounded-xl border-2 overflow-hidden shadow-sm" style={{ borderColor: theme.border }}>
        <div
          className="flex items-center gap-1 p-2 border-b overflow-x-auto transition-colors duration-200"
          style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}
        >
          {[
            { id: 'attacks', label: '武器與戰鬥', icon: GiCrossedSwords },
            { id: 'spells', label: `咒語與魔法 (${(character.spells || []).length})`, icon: GiSpellBook },
            { id: 'skills', label: '職業特技', icon: GiBroadsword },
            { id: 'bonds', label: `情感羈絆 (${(character.bonds || []).length})`, icon: GiHeartShield },
            { id: 'clocks', label: `個人命刻 (${(character.clocks || []).length})`, icon: GiPocketWatch },
            { id: 'notes', label: '行囊日誌', icon: GiBackpack }
          ].map(tab => {
            const IconComp = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isTabActive
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:bg-black/5'
                }`}
                style={isTabActive ? { backgroundColor: theme.accent, color: '#ffffff' } : {}}
              >
                <IconComp className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">
          <ErrorBoundary
            inline
            label={
              activeTab === 'attacks' ? '武器與戰鬥' :
              activeTab === 'spells' ? '咒語與魔法' :
              activeTab === 'skills' ? '職業特技' :
              activeTab === 'bonds' ? '情感羈絆' :
              activeTab === 'clocks' ? '個人命刻' : '行囊日誌'
            }
          >
            {/* TAB 1: 武器與戰鬥 (Formula Pills & Combat Matrix) */}
            {activeTab === 'attacks' && (
            <div className="space-y-4 animate-fade-in text-xs">
              {/* Defense & Initiative Dashboard */}
              <div className="space-y-2">
                <div
                  className="grid grid-cols-3 gap-3 p-3 rounded-xl border text-center font-mono"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
                >
                  <button
                    type="button"
                    onClick={() => toggleFormula('def')}
                    title="點擊查看公式"
                    className="p-2 rounded-lg bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#3c2415]/30 transition-colors cursor-pointer"
                  >
                    <span className="text-slate-500 block text-[11px] font-sans font-medium">物理防禦</span>
                    <span className="text-2xl font-black" style={{ color: theme.textDark }}>{statsUnset ? '—' : stats.def}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      {stats.currentDex !== stats.def ? `DEX(d${stats.currentDex}) + 盾/裝甲` : `當前 DEX(d${stats.currentDex})`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFormula('mdef')}
                    title="點擊查看公式"
                    className="p-2 rounded-lg bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#3c2415]/30 transition-colors cursor-pointer"
                  >
                    <span className="text-blue-700 block text-[11px] font-sans font-medium">魔法防禦</span>
                    <span className="text-2xl font-black text-blue-950">{stats.mdef}</span>
                    <span className="text-[10px] text-blue-700/60 block mt-0.5 truncate">
                      {stats.currentIns !== stats.mdef ? `INS(d${stats.currentIns}) + 盾/加值` : `當前 INS(d${stats.currentIns})`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFormula('init')}
                    title="點擊查看公式"
                    className="p-2 rounded-lg bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#3c2415]/30 transition-colors cursor-pointer"
                  >
                    <span className="text-slate-500 block text-[11px] font-sans font-medium">先攻修正</span>
                    <span className="text-2xl font-black text-slate-800">{stats.init >= 0 ? `+${stats.init}` : stats.init}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      裝備與防具修正
                    </span>
                  </button>
                </div>

                <StatFormulaPanel
                  isOpen={openFormula === 'def'}
                  title="物理防禦"
                  breakdown={breakdown.def}
                  note={STAT_FORMULA_NOTE}
                  onClose={() => setOpenFormula(null)}
                />
                <StatFormulaPanel
                  isOpen={openFormula === 'mdef'}
                  title="魔法防禦"
                  breakdown={breakdown.mdef}
                  note={STAT_FORMULA_NOTE}
                  onClose={() => setOpenFormula(null)}
                />
                <StatFormulaPanel
                  isOpen={openFormula === 'init'}
                  title="先攻修正"
                  breakdown={breakdown.init}
                  onClose={() => setOpenFormula(null)}
                />
              </div>

              {/* Weapon Attacks Title & Free Roller Button */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <GiCrossedSwords className="w-3.5 h-3.5 text-amber-700" />
                  <span>當前武裝與命中公式膠囊 (點擊公式直接擲骰)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFreeRollModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#f5efdf] hover:bg-[#ebdcc4] text-[#3c2415] border border-[#d6c7ab] text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  <GiRollingDices className="w-3.5 h-3.5 text-amber-700" />
                  <span>自由雙屬性檢定</span>
                </button>
              </div>

              {/* Main Hand Weapon Pill Card */}
              <div
                className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs bg-[#fffdf9]"
                style={{ borderColor: theme.border }}
              >
                <div>
                  <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: theme.textDark }}>
                    <FUIcon name={mainWeapon.range?.includes('遠程') ? 'ranged' : 'melee'} className="text-base shrink-0" style={{ color: theme.accent }} />
                    <span>{mainWeapon.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      主手 · {mainWeapon.range || '近戰'}
                    </span>
                    {/* 可變形武器：衝突中就靠這一顆換型態（原書 p.107：每回合一次） */}
                    {switchForm && (
                      <button
                        type="button"
                        onClick={handleSwitchForm}
                        title="可變形武器：隨時可切換型態。衝突場景中只能在你的回合、且每回合一次（HF p.107）"
                        className="text-[10px] px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 transition-colors"
                        style={{ borderColor: theme.border, color: theme.accent, backgroundColor: theme.cardBg }}
                      >
                        <GiCycle className="w-3 h-3" />
                        <span>變形 → {switchForm.name}</span>
                      </button>
                    )}
                  </div>

                  {/* Formula Pills */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Check Formula Pill */}
                    <button
                      type="button"
                      onClick={() => onOpenDice && onOpenDice({
                        die1: mainCheck.die1,
                        die2: mainCheck.die2,
                        modifier: mainCheck.mod,
                        label: `${mainWeapon.name} 命中判定 [${mainCheck.attr1} + ${mainCheck.attr2}]`
                      })}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                      title="點擊直接擲骰命中檢定"
                    >
                      <GiRollingDices className="w-3.5 h-3.5 text-amber-700" />
                      <span>[{mainCheck.attr1} + {mainCheck.attr2}]{mainCheck.mod !== 0 ? ` + ${mainCheck.mod}` : ''}</span>
                      <span className="text-[10px] text-amber-700 font-normal">
                        (d{mainCheck.die1}+d{mainCheck.die2})
                      </span>
                    </button>

                    {/* Damage Formula Pill */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-bold text-xs bg-[#f5efdf] border border-[#d6c7ab] text-[#3c2415]">
                      <span>[HR + {mainDamage.hrBonus}]</span>
                      <FUIcon name={mainDamage.damageType} className="text-sm shrink-0" />
                      <span className="text-[11px] font-sans text-slate-600">{mainDamage.damageType}</span>
                    </span>
                  </div>

                  {/* 定制武器的效果：物防提升＝視為裝備盾牌、迅捷＝打兩次、可變形＝切換型態。
                      這些是**數字看不出來的規則**，跑團當下就要查得到，所以跟著主手卡片一起顯示。
                      只印效果、不印規格摘要——命中與傷害上面已經有藥丸了。 */}
                  {mainWeapon.isCustomWeapon && mainWeapon.effectText && (
                    <p
                      className="text-[10px] mt-2 leading-relaxed"
                      style={{ color: theme.textMuted }}
                    >
                      {renderTextWithAffinities(mainWeapon.effectText)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onOpenDice && onOpenDice({
                      die1: mainCheck.die1,
                      die2: mainCheck.die2,
                      modifier: mainCheck.mod,
                      label: `${mainWeapon.name} 命中檢定`
                    })}
                    className="px-3 py-1.5 rounded-lg text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0"
                    style={{ backgroundColor: theme.accent }}
                  >
                    <GiRollingDices className="w-4 h-4" />
                    <span>擲骰</span>
                  </button>
                </div>
              </div>

              {/* Off Hand Weapon or Shield Pill Card */}
              {offWeapon && (
                <div
                  className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs bg-[#fffdf9]"
                  style={{ borderColor: theme.border }}
                >
                  <div>
                    <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: theme.textDark }}>
                      <FUIcon name={offWeapon.range?.includes('遠程') ? 'ranged' : 'melee'} className="text-base shrink-0" style={{ color: theme.accent }} />
                      <span>{offWeapon.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        副手 · {offWeapon.range || '近戰'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenDice && onOpenDice({
                          die1: offCheck.die1,
                          die2: offCheck.die2,
                          modifier: offCheck.mod,
                          label: `${offWeapon.name} 命中判定 [${offCheck.attr1} + ${offCheck.attr2}]`
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        title="點擊直接擲骰命中檢定"
                      >
                        <GiRollingDices className="w-3.5 h-3.5 text-amber-700" />
                        <span>[{offCheck.attr1} + {offCheck.attr2}]{offCheck.mod !== 0 ? ` + ${offCheck.mod}` : ''}</span>
                        <span className="text-[10px] text-amber-700 font-normal">
                          (d{offCheck.die1}+d{offCheck.die2})
                        </span>
                      </button>

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-bold text-xs bg-[#f5efdf] border border-[#d6c7ab] text-[#3c2415]">
                        <span>[HR + {offDamage.hrBonus}]</span>
                        <FUIcon name={offDamage.damageType} className="text-sm shrink-0" />
                        <span className="text-[11px] font-sans text-slate-600">{offDamage.damageType}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onOpenDice && onOpenDice({
                        die1: offCheck.die1,
                        die2: offCheck.die2,
                        modifier: offCheck.mod,
                        label: `${offWeapon.name} 命中檢定`
                      })}
                      className="px-3 py-1.5 rounded-lg text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0"
                      style={{ backgroundColor: theme.accent }}
                    >
                      <GiRollingDices className="w-4 h-4" />
                      <span>擲骰</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Free Unarmed Strike Shortcut */}
              <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                  <span className="font-bold text-slate-700 font-sans">徒手/自由打擊:</span>
                  <button
                    type="button"
                    onClick={() => onOpenDice && onOpenDice({
                      die1: unarmedCheck.die1,
                      die2: unarmedCheck.die2,
                      modifier: 0,
                      label: '徒手打擊 命中判定 [DEX + MIG]'
                    })}
                    className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold"
                  >
                    [DEX + MIG]
                  </button>
                  <span className="text-slate-600 font-bold">[HR + 0] 物理</span>
                </div>
              </div>

              {/* Equipment Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-2 border-t">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-sans">副手/盾牌:</span>
                  <strong className="text-slate-800">{character.equipment?.offHand || '無'}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-sans">防具裝甲:</span>
                  <strong className="text-slate-800">{character.equipment?.armor || '無'}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-sans">佩戴飾品:</span>
                  <strong className="text-slate-800">{character.equipment?.accessory || '無'}</strong>
                </div>
              </div>

              {/* Pilot Personal Vehicle in Combat (if active) */}
              {(character.classes || []).some(c => c.className === '機師' && (c.skills || []).some(s => s.name === '個人載具' && s.sl > 0)) && (
                <div className="pt-2 border-t">
                  <PilotVehicleCombatSheet
                    character={character}
                    onChange={onChange}
                    onOpenDice={onOpenDice}
                    showToast={showToast}
                  />
                </div>
              )}

              {/* Wayfarer Companion in Combat (if active) */}
              {(character.classes || []).some(c => c.className === '旅人' && (c.skills || []).some(s => s.name === '忠實夥伴' && s.sl > 0)) && (
                <div className="pt-2 border-t">
                  <WayfarerCompanionSheet
                    character={character}
                    onChange={onChange}
                    onOpenDice={onOpenDice}
                    showToast={showToast}
                  />
                </div>
              )}

              {/* 死靈術士【殘酷的誕生】的僕從。條件是「有沒有拿那個英雄技能」——
                  僕從的有無則看 `necroData.minion.active`，摧毀後面板會回到空狀態。 */}
              {(character.heroicSkills || []).some(
                (h) => (typeof h === 'string' ? h : h?.name) === '殘酷的誕生'
              ) && (
                <div className="pt-2 border-t">
                  <NecromancerMinionSheet
                    character={character}
                    onChange={onChange}
                    showToast={showToast}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 咒語與魔法 (Dedicated Spells Tab) */}
          {activeTab === 'spells' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <GiSpellBook className="w-4 h-4 text-purple-700" />
                  <span>已掌握的咒語與儀式</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsSpellModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>學習新咒語</span>
                </button>
              </div>

              {/* Spells Cards List */}
              {(character.spells || []).length > 0 ? (
                <div className="space-y-2.5">
                  {(character.spells || []).map((sp, idx) => {
                    const rulesSpell = (rulesData.spells || []).find(s => s.name === sp.name);
                    const isOffensive = sp.isOffensive ?? rulesSpell?.isOffensive ?? (hasLegacyOffensiveSentinel(sp.name) || sp.effect?.includes('傷害') || sp.effect?.includes('（o）'));
                    const spellCheck = parseCheckFormula('INS + WLP', stats);
                    const spellDamage = parseDamageFormula(sp.effect || '');
                    const isExpanded = !!expandedSpells[sp.name];

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border bg-white shadow-sm space-y-2 transition-all hover:border-purple-300"
                        style={{ borderColor: theme.border }}
                      >
                        {/* Spell Header */}
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                              <FUIcon name={isOffensive ? 'offensive' : 'spell'} className="text-sm" />
                            </div>
                            <h4 className="font-serif font-black text-sm text-purple-950 flex items-center gap-1.5">
                              {isOffensive && <span className="fu-icon text-red-600 font-bold" title="攻擊性咒語">o</span>}
                              <span>{sp.name}</span>
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              {sp.school || '通用'}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleCastSpell(sp)}
                              className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-xs transition-colors flex items-center gap-1"
                            >
                              <span>施放 (-{sp.mp})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleForgetSpell(sp.name)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                              title="遺忘咒語"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Formula Pills Row */}
                        <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold">
                            {sp.mp} MP
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 font-sans">
                            {sp.target || '單體'}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 font-sans">
                            {sp.duration || '瞬發'}
                          </span>

                          {/* Offensive Check Pill */}
                          {isOffensive && (
                            <button
                              type="button"
                              onClick={() => onOpenDice && onOpenDice({
                                die1: spellCheck.die1,
                                die2: spellCheck.die2,
                                modifier: spellCheck.mod,
                                label: `${sp.name} 魔法判定 [INS + WLP]`
                              })}
                              className="px-2.5 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold flex items-center gap-1 transition-colors"
                              title="點擊直接擲骰魔法判定"
                            >
                              <GiRollingDices className="w-3.5 h-3.5 text-amber-700" />
                              <span>[INS + WLP]</span>
                              <span className="text-[10px] text-amber-700 font-normal">(d{spellCheck.die1}+d{spellCheck.die2})</span>
                            </button>
                          )}

                          {isOffensive && spellDamage.damageType && (
                            <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-900 border border-red-200 font-bold flex items-center gap-1">
                              <span>[HR + {spellDamage.hrBonus}]</span>
                              <FUIcon name={spellDamage.damageType} className="text-xs" />
                            </span>
                          )}
                        </div>

                        {/* Expandable description */}
                        {sp.effect && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleSpellExpand(sp.name)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium mb-1"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              <span>{isExpanded ? '收合效果詳情' : '展開效果詳情'}</span>
                            </button>
                            {isExpanded && (
                              <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                                {renderTextWithAffinities(sp.effect)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 space-y-2">
                  <GiSpellBook className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs font-medium">尚未掌握任何咒語。</p>
                  <button
                    type="button"
                    onClick={() => setIsSpellModalOpen(true)}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                  >
                    + 從規則庫選擇習得咒語
                  </button>
                </div>
              )}

              {/* Chimerist Spells in Magic Tab (if active) */}
              {(character.classes || []).some(c => c.className === '嵌合師' && (c.skills || []).some(s => s.name === '咒語模仿' && s.sl > 0)) && (
                <div className="pt-2 border-t">
                  <ChimeristManager
                    character={character}
                    onChange={onChange}
                    onOpenDice={onOpenDice}
                    showToast={showToast}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 職業特技 (Class Skills - Streamlined) */}
          {activeTab === 'skills' && (
            <div className="space-y-4 animate-fade-in text-xs">
              {(character.classes || []).map((cl, cIdx) => (
                <div key={cIdx} className="space-y-2">
                  <div className="flex items-center gap-2 border-b pb-1" style={{ borderColor: theme.border }}>
                    <span className="font-serif font-black text-sm" style={{ color: theme.textDark }}>{withEn(cl.className)}</span>
                    <JRPGBadge variant={theme.badgeVariant} size="xs">Lv {cl.level}</JRPGBadge>
                  </div>

                  <div className="space-y-2">
                    {(cl.skills || []).map((sk, sIdx) => {
                      const classDef = rulesData.classes[cl.className];
                      const skillDef = classDef?.skills?.find(s => s.name === sk.name);
                      const isExpanded = !!expandedSkills[`${cl.className}_${sk.name}`];

                      return (
                        <div key={sIdx} className="p-3 bg-white rounded-xl border shadow-sm transition-all hover:border-amber-400" style={{ borderColor: theme.border }}>
                          <div className="flex items-center justify-between font-bold mb-1">
                            <span className="flex items-center gap-1.5" style={{ color: theme.textDark }}>
                              <span style={{ color: theme.accent }}>✦</span>
                              <span>{sk.name}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {cl.className === '修補匠' && sk.name === '小工具' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRuleCodex('小工具');
                                  }}
                                  className="px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                                  title="開啟小工具官方手冊完整速查大表 (手冊 p.212~216)"
                                >
                                  <GiSpellBook className="text-amber-600 dark:text-amber-400 text-xs" />
                                  <span>規則概念速查</span>
                                </button>
                              )}
                              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]">
                                SL {sk.sl} / {skillDef?.maxSL || 5}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-600 leading-relaxed">
                            <div className={isExpanded ? '' : 'line-clamp-2'}>
                              <SkillDescription desc={skillDef?.desc || '暫無描述'} sl={sk.sl} />
                            </div>
                            {skillDef?.desc && skillDef.desc.length > 80 && (
                              <button
                                type="button"
                                onClick={() => toggleSkillExpand(`${cl.className}_${sk.name}`)}
                                className="text-[10px] text-amber-800 font-bold mt-1 flex items-center gap-0.5 cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                <span>{isExpanded ? '收合' : '展開完整效果'}</span>
                              </button>
                            )}
                          </div>

                          {/* 子項目已掌握清單與專屬機制 */}
                          {sk.selectedOptions && (Array.isArray(sk.selectedOptions) ? sk.selectedOptions.length > 0 : ((sk.selectedOptions.keys || []).length > 0 || (sk.selectedOptions.tones || []).length > 0)) && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2.5">
                              {/* 1. 若為魔奏者【魔法演奏】，常駐渲染即時合成器 */}
                              {cl.className === '魔奏者' && sk.name === '魔法演奏' && (
                                <ChanterComposer
                                  character={character}
                                  selectedOptions={sk.selectedOptions}
                                  onConsumeMp={(mpCost) => adjustMp(-mpCost)}
                                  showToast={showToast}
                                />
                              )}

                              {/* 2. 若為植物學家【植生術】，常駐渲染花園生長盤 */}
                              {cl.className === '植物學家' && sk.name === '植生術' && (
                                <FloristGardenTracker
                                  character={character}
                                  skillSL={sk.sl}
                                  selectedOptions={sk.selectedOptions}
                                  onChange={onChange}
                                  showToast={showToast}
                                />
                              )}

                              {/* 3. 子項目效果速查清單與視圖切換 */}
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                <span className="flex items-center gap-1 text-amber-900">
                                  <GiSparkles className="w-3.5 h-3.5 text-amber-600" />
                                  <span>已掌握項目戰鬥速查：</span>
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const key = `${cl.className}_${sk.name}`;
                                    setCollapsedSuboptions(prev => ({ ...prev, [key]: !prev[key] }));
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-normal transition-colors cursor-pointer"
                                >
                                  {collapsedSuboptions[`${cl.className}_${sk.name}`] ? '展開效果卡片' : '收合為標籤'}
                                </button>
                              </div>

                              {collapsedSuboptions[`${cl.className}_${sk.name}`] ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {Array.isArray(sk.selectedOptions) ? (
                                    sk.selectedOptions.map((optName, oIdx) => (
                                      <span
                                        key={oIdx}
                                        onClick={() => {
                                          const key = `${cl.className}_${sk.name}`;
                                          setCollapsedSuboptions(prev => ({ ...prev, [key]: false }));
                                        }}
                                        title="點擊展開查看效果"
                                        className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                      >
                                        <span className="text-amber-500">✦</span>
                                        <span>{optName}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <>
                                      {(sk.selectedOptions.keys || []).map((k, kIdx) => (
                                        <span
                                          key={`k_${kIdx}`}
                                          onClick={() => {
                                            const key = `${cl.className}_${sk.name}`;
                                            setCollapsedSuboptions(prev => ({ ...prev, [key]: false }));
                                          }}
                                          title="點擊展開查看效果"
                                          className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                        >
                                          <span className="text-amber-600 text-[10px]">音調</span>
                                          <span>{k}</span>
                                        </span>
                                      ))}
                                      {(sk.selectedOptions.tones || []).map((t, tIdx) => (
                                        <span
                                          key={`t_${tIdx}`}
                                          onClick={() => {
                                            const key = `${cl.className}_${sk.name}`;
                                            setCollapsedSuboptions(prev => ({ ...prev, [key]: false }));
                                          }}
                                          title="點擊展開查看效果"
                                          className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-200 font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                        >
                                          <span className="text-purple-600 text-[10px]">曲風</span>
                                          <span>{t}</span>
                                        </span>
                                      ))}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <SuboptionDetailsList
                                  className={cl.className}
                                  skillName={sk.name}
                                  selectedOptions={sk.selectedOptions}
                                  showVolumeBlock={true}
                                />
                              )}

                              {/* 靈能者專屬靈刻時鐘 */}
                              {cl.className === '靈能者' && sk.name === '心靈天賦' && (
                                <div className="mt-2 p-2.5 bg-purple-50/80 rounded-xl border border-purple-200/90 flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-3">
                                    <ClockTracker
                                      title=""
                                      totalSegments={4}
                                      filledSegments={character.brainwaveClock || 0}
                                      theme="purple"
                                      size={54}
                                      compact={true}
                                      onChange={(newVal) => {
                                        updateField('brainwaveClock', newVal);
                                      }}
                                    />
                                    <div>
                                      <div className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                                        <span>靈刻時鐘</span>
                                        <span className="font-mono text-xs text-purple-700 font-bold">({character.brainwaveClock || 0} / 4)</span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 leading-tight">
                                        每次使用天賦後填入 1 格。消耗 MP：【靈刻格數 × 5】（最少 5 點）
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = character.brainwaveClock || 0;
                                        updateField('brainwaveClock', Math.max(0, cur - 1));
                                      }}
                                      disabled={(character.brainwaveClock || 0) <= 0}
                                      className="px-2 py-1 text-xs rounded-lg bg-white hover:bg-purple-100 disabled:opacity-30 border border-purple-200 text-purple-900 font-bold transition-colors cursor-pointer"
                                      title="靈刻 -1"
                                    >
                                      -1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = character.brainwaveClock || 0;
                                        updateField('brainwaveClock', Math.min(4, cur + 1));
                                      }}
                                      disabled={(character.brainwaveClock || 0) >= 4}
                                      className="px-2.5 py-1 text-xs rounded-lg bg-purple-700 hover:bg-purple-800 disabled:opacity-30 text-white font-bold transition-colors cursor-pointer shadow-2xs"
                                      title="靈刻 +1"
                                    >
                                      +1 格
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateField('brainwaveClock', 0);
                                        showToast('已清空靈刻時鐘');
                                      }}
                                      disabled={(character.brainwaveClock || 0) === 0}
                                      className="px-2 py-1 text-xs rounded-lg bg-white hover:bg-rose-50 disabled:opacity-30 border border-purple-200 text-slate-600 hover:text-rose-700 font-medium transition-colors cursor-pointer"
                                      title="重設靈刻"
                                    >
                                      重設
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* 植物學家專屬生長命刻：**已移除**（2026-10-16）。
                                  這裡原本是第二個「生長命刻」控制項（讀寫 `character.growthClock` 純量），
                                  與同一區塊上方【植生術】常駐的 `FloristGardenTracker` 並存——
                                  同一個計數器兩套資料（`floristGarden` 陣列 vs `growthClock` 純量）、
                                  兩個可各自設定不同數字的控制項。官方只有**一條**生長命刻
                                  （`ruleCodexExpansion.js`「生長命刻」節），而花園生長盤是完整的那一套
                                  （綁種子、高亮當前階級、結算離園），所以留它、移掉這裡的殘留。 */}
                            </div>
                          )}

                          {/* 修補匠小工具專屬戰鬥速查 */}
                          {cl.className === '修補匠' && sk.name === '小工具' && (
                            <TinkererGadgetsQuickRef
                              gadgetsData={character.tinkererData?.gadgets}
                              sl={sk.sl}
                              onOpenCodex={() => openRuleCodex('小工具')}
                              characterLevel={getCharacterLevel(character)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 職業專屬機制互動工具 (Subsystem Companions) */}
                  {cl.className === '秘儀師' && (cl.skills || []).some(s => s.name === '綁定和召喚' && s.sl > 0) && (
                    <div className="mt-3">
                      <ArcanistManager
                        character={character}
                        onChange={onChange}
                        onOpenDice={onOpenDice}
                        showToast={showToast}
                      />
                    </div>
                  )}

                  {cl.className === '嵌合師' && (cl.skills || []).some(s => s.name === '咒語模仿' && s.sl > 0) && (
                    <div className="mt-3">
                      <ChimeristManager
                        character={character}
                        onChange={onChange}
                        onOpenDice={onOpenDice}
                        showToast={showToast}
                      />
                    </div>
                  )}

                  {cl.className === '旅人' && (cl.skills || []).some(s => s.name === '忠實夥伴' && s.sl > 0) && (
                    <div className="mt-3">
                      <WayfarerCompanionSheet
                        character={character}
                        onChange={onChange}
                        onOpenDice={onOpenDice}
                        showToast={showToast}
                      />
                    </div>
                  )}

                  {cl.className === '機師' && (cl.skills || []).some(s => s.name === '個人載具' && s.sl > 0) && (
                    <div className="mt-3">
                      <PilotVehicleCombatSheet
                        character={character}
                        onChange={onChange}
                        onOpenDice={onOpenDice}
                        showToast={showToast}
                      />
                    </div>
                  )}

                  {cl.className === '修補匠' && (
                    <div className="mt-3">
                      <TinkererWorkshop
                        character={character}
                        onChange={onChange}
                        onOpenDice={onOpenDice}
                        showToast={showToast}
                      />
                    </div>
                  )}

                  {cl.className === '美食家' && (cl.skills || []).some(s => s.name === '烹飪' && s.sl > 0) && (
                    <div className="mt-3">
                      <GourmetCookbook
                        character={character}
                        onChange={onChange}
                        showToast={showToast}
                      />
                    </div>
                  )}

                  {cl.className === '卡牌大師' && (cl.skills || []).some(s => s.name === '魔法卡組' && s.sl > 0) && (
                    <div className="mt-3">
                      <AceOfCardsTable
                        character={character}
                        onChange={onChange}
                        onAdjustHp={(delta) => adjustHp(delta)}
                        onAdjustMp={(delta) => adjustMp(delta)}
                        onClearStatuses={(keys) => {
                          const cur = character.statusAfflictions || {};
                          const next = { ...cur };
                          (keys || []).forEach(k => { next[k] = false; });
                          updateField('statusAfflictions', next);
                        }}
                        showToast={showToast}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: 情感羈絆 (Bonds) */}
          {activeTab === 'bonds' && (
            <div className="space-y-3 animate-fade-in text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <GiHeartShield className="w-4 h-4 text-rose-700" />
                  <span>三維六向情感羈絆 (最多 6 個)</span>
                </span>
                {(character.bonds || []).length < 6 && (
                  <button
                    type="button"
                    onClick={() => setIsBondModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增羈絆</span>
                  </button>
                )}
              </div>

              {(character.bonds || []).map((bond, bIdx) => (
                <div key={bIdx} className="p-3.5 bg-white rounded-xl border shadow-sm flex items-center justify-between gap-3" style={{ borderColor: theme.border }}>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{bond.target}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {(bond.feelings || []).map(f => (
                        <span key={f} className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-[11px] text-rose-900 font-bold">
                          {f === 'admiration' ? '欽佩' :
                           f === 'inferiority' ? '自卑' :
                           f === 'loyalty' ? '忠誠' :
                           f === 'mistrust' ? '疑忌' :
                           f === 'affection' ? '喜愛' :
                           f === 'hatred' ? '仇恨' : f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if ((character.fabulaPoints ?? 3) <= 0) {
                          showToast('物語點不足');
                          return;
                        }
                        adjustFp(-1);
                        showToast(`消耗 1 FP 激活對【${bond.target}】之羈絆！檢定獲得 +${bond.feelings?.length || 1} 點加值！`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-950 font-bold text-xs shrink-0"
                    >
                      激勵 (+{bond.feelings?.length || 1})
                    </button>
                    <button
                      onClick={() => handleDeleteBond(bond.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                      title="刪除羈絆"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {(character.bonds || []).length === 0 && (
                <p className="text-center text-slate-400 py-6">尚未建立羈絆。</p>
              )}
            </div>
          )}

          {/* TAB 5: 個人命刻 (Clocks) */}
          {activeTab === 'clocks' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <GiPocketWatch className="w-4 h-4 text-amber-700" />
                  <span>個人命刻時鐘</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsClockModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增命刻</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(character.clocks || []).map(clk => (
                  <div key={clk.id} className="relative group">
                    <ClockTracker
                      title={clk.title}
                      totalSegments={clk.totalSegments || 6}
                      filledSegments={clk.filledSegments || 0}
                      theme={clk.theme || 'amber'}
                      type={clk.type || 'circle'}
                      size={90}
                      onChange={newVal => {
                        const updated = (character.clocks || []).map(c => c.id === clk.id ? { ...c, filledSegments: newVal } : c);
                        updateField('clocks', updated);
                      }}
                    />
                    <button
                      onClick={() => handleDeleteClock(clk.id)}
                      className="absolute top-2 right-2 p-1 rounded-lg bg-white/80 hover:bg-rose-50 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="刪除命刻"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {(character.clocks || []).length === 0 && (
                <p className="text-center text-slate-400 py-6 text-xs">暫無個人命刻。</p>
              )}
            </div>
          )}

          {/* TAB 6: 行囊日誌 (Notes & Inventory) */}
          {activeTab === 'notes' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">冒險者行囊物品與武裝</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 font-mono">
                  <div>主手武器: <strong>{character.equipment?.mainHand || '空手'}</strong></div>
                  <div>副手武裝: <strong>{character.equipment?.offHand || '無'}</strong></div>
                  <div>防具裝甲: <strong>{character.equipment?.armor || '無'}</strong></div>
                  <div>佩戴飾品: <strong>{character.equipment?.accessory || '無'}</strong></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 block">冒險筆記本</span>
                <textarea
                  value={character.backpackNotes || ''}
                  onChange={e => updateField('backpackNotes', e.target.value)}
                  placeholder="在此記錄冒險日記、行囊物品、NPC 線索或秘密契約..."
                  rows={6}
                  className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded-xl p-3 text-xs text-[#3c2415] outline-none focus:border-amber-600 leading-relaxed shadow-inner"
                />
              </div>
            </div>
          )}
          </ErrorBoundary>
        </div>
      </div>

      {/* MODAL 1: Spell Picker / Learner Modal */}
      <JRPGModal
        isOpen={isSpellModalOpen}
        onClose={() => setIsSpellModalOpen(false)}
        title="從官方規則庫學習咒語"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3.5 text-xs">
          {/* Search & School filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={spellSearchQuery}
                onChange={e => setSpellSearchQuery(e.target.value)}
                placeholder="搜尋法術名稱、效果描述..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={selectedSpellSchool}
              onChange={e => setSelectedSpellSchool(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">全部學派</option>
              {spellSchools.map(sch => (
                <option key={sch} value={sch}>{sch}</option>
              ))}
            </select>
          </div>

          {/* Spell List */}
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {availableRulesSpells.map((sp, idx) => {
              const isLearned = (character.spells || []).some(s => s.name === sp.name);
              const isOffensive = sp.isOffensive || hasLegacyOffensiveSentinel(sp.name) || sp.effect?.includes('傷害') || sp.effect?.includes('（o）');

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border bg-white flex items-start justify-between gap-3 shadow-sm hover:border-purple-300 transition-colors"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FUIcon name={isOffensive ? 'offensive' : 'spell'} className="text-sm" />
                      <span className="font-bold text-sm text-purple-950 flex items-center gap-1.5">
                        {isOffensive && <span className="fu-icon text-red-600 font-bold" title="攻擊性咒語">o</span>}
                        <span>{sp.name}</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                        {sp.school}
                      </span>
                      <span className="font-mono text-[10px] text-blue-700 font-bold">
                        {sp.mp} MP
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {sp.target} · {sp.duration}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {renderTextWithAffinities(sp.effect)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLearnSpell(sp)}
                    disabled={isLearned}
                    className="px-3 py-1.5 rounded-lg text-white font-bold text-xs shrink-0 disabled:opacity-40 disabled:bg-slate-300"
                    style={{ backgroundColor: isLearned ? '#94a3b8' : theme.accent }}
                  >
                    {isLearned ? '已習得' : '習得'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </JRPGModal>

      {/* MODAL 2: Free Dual-Dice Check Roller */}
      <JRPGModal
        isOpen={isFreeRollModalOpen}
        onClose={() => setIsFreeRollModalOpen(false)}
        title="自由雙屬性檢定"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            自由選擇兩項屬性骰與修正值，即可一鍵呼叫骰盅擲骰：
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">第一屬性:</label>
              <select
                value={freeRollAttr1}
                onChange={e => setFreeRollAttr1(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 bg-white font-mono font-bold"
              >
                <option value="dex">DEX ({ATTRIBUTE_NAMES.dex} d{stats.currentDex})</option>
                <option value="ins">INS (洞察 d{stats.currentIns})</option>
                <option value="mig">MIG ({ATTRIBUTE_NAMES.mig} d{stats.currentMig})</option>
                <option value="wlp">WLP (意志 d{stats.currentWlp})</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">第二屬性:</label>
              <select
                value={freeRollAttr2}
                onChange={e => setFreeRollAttr2(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 bg-white font-mono font-bold"
              >
                <option value="dex">DEX ({ATTRIBUTE_NAMES.dex} d{stats.currentDex})</option>
                <option value="ins">INS (洞察 d{stats.currentIns})</option>
                <option value="mig">MIG ({ATTRIBUTE_NAMES.mig} d{stats.currentMig})</option>
                <option value="wlp">WLP (意志 d{stats.currentWlp})</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">檢定固定修正:</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFreeRollModifier(prev => prev - 1)}
                className="px-3 py-1 rounded bg-slate-100 border text-sm font-bold"
              >
                -1
              </button>
              <span className="font-mono font-bold text-base w-12 text-center text-slate-800">
                {freeRollModifier >= 0 ? `+${freeRollModifier}` : freeRollModifier}
              </span>
              <button
                type="button"
                onClick={() => setFreeRollModifier(prev => prev + 1)}
                className="px-3 py-1 rounded bg-slate-100 border text-sm font-bold"
              >
                +1
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const getDie = (key) => {
                if (key === 'dex') return stats.currentDex;
                if (key === 'ins') return stats.currentIns;
                if (key === 'mig') return stats.currentMig;
                if (key === 'wlp') return stats.currentWlp;
                return 8;
              };
              setIsFreeRollModalOpen(false);
              if (onOpenDice) {
                onOpenDice({
                  die1: getDie(freeRollAttr1),
                  die2: getDie(freeRollAttr2),
                  modifier: freeRollModifier,
                  label: `自由檢定 [${freeRollAttr1.toUpperCase()} + ${freeRollAttr2.toUpperCase()}]`
                });
              }
            }}
            className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 mt-2"
            style={{ backgroundColor: theme.accent }}
          >
            <GiRollingDices className="w-4 h-4" />
            <span>擲骰檢定</span>
          </button>
        </div>
      </JRPGModal>

      {/* MODAL 3: Level Up Modal */}
      <JRPGModal
        isOpen={isLevelUpModalOpen}
        onClose={() => setIsLevelUpModalOpen(false)}
        title={`角色升級 (Level Up: Lv ${character.level} 至 Lv ${character.level + 1})`}
        maxWidth="max-w-md"
        actionButtons={
          <>
            <JRPGButton
              variant="ghost"
              size="sm"
              onClick={() => setIsLevelUpModalOpen(false)}
            >
              取消
            </JRPGButton>
            <JRPGButton
              variant="primary"
              size="sm"
              onClick={handleExecuteLevelUp}
              disabled={!selectedClassForLevelUp || !selectedSkillForLevelUp}
            >
              確認升級 (-10 EXP)
            </JRPGButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed -mt-1">
            升級將消耗 <strong>10 點 EXP</strong>，角色等級提升 1 級，最大 HP +1、最大 MP +1，並可選擇分配 1 點特技！
          </p>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-bold text-[#3c2415] block mb-1">
                選擇欲升級的職業:
              </label>
              <select
                value={selectedClassForLevelUp}
                onChange={e => {
                  setSelectedClassForLevelUp(e.target.value);
                  setSelectedSkillForLevelUp('');
                }}
                className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded-lg px-3 py-2 text-xs text-[#3c2415] outline-none focus:border-amber-600 shadow-sm"
              >
                <option value="" disabled>-- 選擇職業 --</option>
                {(character.classes || []).map(cl => (
                  <option key={cl.className} value={cl.className}>
                    {withEn(cl.className)} (目前 Lv {cl.level})
                  </option>
                ))}
              </select>
            </div>

            {selectedClassForLevelUp && (
              <div>
                <label className="text-xs font-bold text-[#3c2415] block mb-1">
                  選擇欲升級或習得的技能:
                </label>
                {/* 舊版是一個下拉選單，一行「技能名 (SL 0/5)」根本看不出這技能在做什麼。
                    這裡改成直接列出效果全文，並把選取中的那一項以**升級後**的 SL 顯示——
                    讓你看到的是「買到之後數字長什麼樣」，而不是現在的數字。 */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {(rulesData.classes[selectedClassForLevelUp]?.skills || []).map(sk => {
                    const curClass = (character.classes || []).find(c => c.className === selectedClassForLevelUp);
                    const curSk = curClass?.skills?.find(s => s.name === sk.name);
                    const curSL = curSk?.sl || 0;
                    const maxed = curSL >= sk.maxSL;
                    const isSel = selectedSkillForLevelUp === sk.name;
                    return (
                      <button
                        key={sk.name}
                        type="button"
                        disabled={maxed}
                        onClick={() => setSelectedSkillForLevelUp(sk.name)}
                        className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                          maxed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-amber-400'
                        } ${isSel ? 'ring-2 ring-amber-400' : ''}`}
                        style={{
                          backgroundColor: isSel ? '#fffbeb' : '#fffdf9',
                          borderColor: isSel ? '#f59e0b' : '#d6c7ab'
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#3c2415]">{sk.name}</span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            SL {curSL} / {sk.maxSL}{maxed ? '　已升滿' : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                          <SkillDescription
                            desc={sk.desc || '（無效果描述）'}
                            sl={isSel && !maxed ? curSL + 1 : curSL}
                          />
                        </p>
                        {isSel && !maxed && (
                          <span className="text-[10px] text-amber-800 font-bold mt-1 inline-block">
                            以上數值以升級後的 SL {curSL + 1} 顯示
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 想比較別的職業時，直接連到構築工坊的「職業與技能」分頁 */}
                {onOpenEditor && (
                  <button
                    type="button"
                    onClick={() => { setIsLevelUpModalOpen(false); onOpenEditor(3); }}
                    className="mt-2 text-[11px] text-amber-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <GiScrollUnfurled className="w-3.5 h-3.5" />
                    <span>想比較其他職業的技能？到構築工坊的「職業與技能」</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </JRPGModal>

      {/* MODAL 4: Bond Creator Modal */}
      <JRPGModal
        isOpen={isBondModalOpen}
        onClose={() => setIsBondModalOpen(false)}
        title="建立新情感羈絆"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">羈絆對象名稱:</label>
            <input
              type="text"
              value={newBondTarget}
              onChange={e => setNewBondTarget(e.target.value)}
              placeholder="例如：王國騎士長、幼時好友、仇敵宿敵..."
              className="w-full p-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1.5">選擇初生情感 (可選 1~3 項):</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'admiration', label: '欽佩' },
                { id: 'inferiority', label: '自卑' },
                { id: 'loyalty', label: '忠誠' },
                { id: 'mistrust', label: '疑忌' },
                { id: 'affection', label: '喜愛' },
                { id: 'hatred', label: '仇恨' }
              ].map(f => {
                const isSelected = newBondFeelings.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setNewBondFeelings(prev => prev.filter(x => x !== f.id));
                      } else {
                        if (newBondFeelings.length >= 3) {
                          showToast('最多選擇 3 種情感');
                          return;
                        }
                        setNewBondFeelings(prev => [...prev, f.id]);
                      }
                    }}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all text-left ${
                      isSelected ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddBond}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm mt-2"
          >
            確認建立羈絆
          </button>
        </div>
      </JRPGModal>

      {/* MODAL 5: Clock Creator Modal */}
      <JRPGModal
        isOpen={isClockModalOpen}
        onClose={() => setIsClockModalOpen(false)}
        title="建立個人命刻時鐘"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">命刻標題:</label>
            <input
              type="text"
              value={newClockTitle}
              onChange={e => setNewClockTitle(e.target.value)}
              placeholder="例如：復仇的倒計時、解開封印進度..."
              className="w-full p-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">命刻總格數:</label>
            <div className="flex gap-2">
              {[4, 6, 8, 10, 12].map(seg => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setNewClockSegments(seg)}
                  className={`flex-1 py-1.5 rounded-xl border font-mono font-bold ${
                    newClockSegments === seg ? 'bg-amber-600 border-amber-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {seg} 格
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddClock}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm mt-2"
          >
            確認建立命刻
          </button>
        </div>
      </JRPGModal>

      {/* 角色卡預覽（與「構築與成長」共用同一個彈窗）——跑團時可以直接在這裡匯出 PNG／PDF */}
      <CharacterPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        character={character}
        theme={theme}
        themeId={themeId}
        showToast={showToast}
        closeLabel="返回跑團面板"
      />
    </div>
  );
}
