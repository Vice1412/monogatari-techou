import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  SlidersHorizontal,
  Play,
  Check
} from 'lucide-react';
import {
  GiSparkles,
  GiPadlock,
  GiCrossedSwords,
  GiBroadsword,
  GiShield,
  GiPocketWatch,
  GiSpellBook,
  GiHazardSign,
  GiCheckMark,
  GiQuillInk,
  GiCoins,
  GiRollingDices,
  GiLaurelCrown,
  GiScrollUnfurled,
  GiPalette,
  GiRoundShield,
  GiCrystalBall,
  GiAnvil
} from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import JRPGButton from '../../../components/ui/JRPGButton';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import { JRPGInput } from '../../../components/ui/JRPGInput';
import StatBadge from '../../../components/ui/StatBadge';
import JRPGModal from '../../../components/ui/JRPGModal';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';
import IdentityTablesModal from './IdentityTablesModal';
import AttributeMatrixPicker from './AttributeMatrixPicker';
import ClassSkillCard from './ClassSkillCard';
import ClassPickerModal from './ClassPickerModal';
import ArcanistStarterBinding from './ArcanistStarterBinding';
import EquipmentPickerModal from './EquipmentPickerModal';
import CustomWeaponForgeModal from './CustomWeaponForgeModal';
import {
  CUSTOM_WEAPON_BASE,
  buildCustomWeaponEntries,
  describeCustomWeapon,
  equipCustomWeapon,
  groupCustomWeapons,
  equippedFormIndex,
  nextFormFor,
  syncEquipmentNames
} from '../data/customWeapons';
import EquipmentSlotCard from './EquipmentSlotCard';
import rulesData from '../data/rulesData.json';
import { DEFAULT_CREATION_RULES, resolveCreationRules, PLAYTEST_SOURCEBOOK_KEY } from '../data/creationRules';
import { loggableChange, formatLogTime } from '../utils/characterLog';
import { splitParagraphs } from '../utils/paragraphs';
import CharacterAvatarUploader from './CharacterAvatarUploader';
import { getCharacterTheme, CHARACTER_THEMES } from '../utils/characterThemes';
import {
  SOURCEBOOKS,
  CANONICAL_THEMES,
  normalizeTheme,
  generateRandomIdentity,
  getClassInfo
} from '../data/sourcebookConfig';
import StarterPresetsModal from './StarterPresetsModal';
import CharacterPreviewModal from './CharacterPreviewModal';
import CreationRulesPanel from './CreationRulesPanel';
import HeroicSkillPickerModal from './HeroicSkillPickerModal';
import QuirkPickerModal from './QuirkPickerModal';

/** 編輯器的分頁數量。夾制 initialTab 時不能讀 TABS（宣告在下面，會踩 TDZ），所以另存常數。 */
const TAB_COUNT = 6;
import { applyPreset } from '../utils/presetApply';
import {
  calculateCharacterStats,
  validateCharacter,
  isCharacterLocked,
  lockCharacter,
  unlockCharacter,
  buildCreationChecklist,
  LOCKED_CREATION_TABS,
  getCharacterLevel,
  checkHeroicSkillRequirement,
  heroicSkillMaxAcquisitions,
  attributeDieUpgradesAllowed,
  attributeDieUpgradesUsed,
  HEROIC_SKILLS,
  HEROIC_SKILL_SOURCE_LABELS
} from '../utils/characterEngine';
import {
  EQUIPMENT_SLOTS,
  diceFromStats,
  evaluateWeapon,
  computeArmorOutcome,
  computeShieldOutcome,
  checkEquippable,
  buildLoadoutIssues,
  totalStartingEquipCost,
  getEquipmentIcon,
  getDualShieldState,
  applyEquipmentChoice,
  isTwoHanded,
  CATEGORY_ICON
} from '../utils/equipmentRules';
import ErrorBoundary from '../../../components/ui/ErrorBoundary';
import { withEn } from '../../../utils/properNouns';

export default function CharacterEditor({
  character,
  themeId = null,
  onSelectGlobalTheme = null,
  onChange,
  onBackToRoster,
  onEnterPlayMode = null,
  showToast = null,
  // 開卡規則：預設為官方核心規則；GM 自訂開局時由上游傳入該團的規則
  // （見 data/creationRules.js——起始等級、起始資金、必修職業、開放拓展都由此決定）
  creationRules = null,
  // 開啟時要停在哪一個分頁（例如從跑團卡的升級流程連過來看「職業與技能」）
  initialTab = 1
}) {
  // 分頁編號一定要是合法數字。這裡是最後一道防線：
  // 曾經有一次呼叫端寫成 `onClick={onOpenEditor}`，React 就把**點擊事件物件**當成分頁編號傳進來，
  // 而編輯器會把 activeTab 直接渲染在「步驟 {activeTab}/{TABS.length}」上——
  // 於是 React 拋出 "Objects are not valid as a React child"，整棵樹被卸載、畫面全黑。
  // 就算呼叫端再犯，這裡也不會讓它變成當機。
  // 註：不能在這裡讀 TABS——它宣告在下面，useState 的初始值會在那一行之前執行（TDZ）。
  const [activeTab, setActiveTab] = useState(
    () => (Number.isInteger(initialTab) && initialTab >= 1 && initialTab <= TAB_COUNT ? initialTab : 1)
  );
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [isCardPreviewModalOpen, setIsCardPreviewModalOpen] = useState(false);
  // 舊譯名（負疚／職責）先正規化成官方主題名，否則舊卡的選單會落在「自訂」那一側
  const [isCustomTheme, setIsCustomTheme] = useState(() => !CANONICAL_THEMES.includes(normalizeTheme(character?.theme)) && Boolean(character?.theme));
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const [newlyAddedClassName, setNewlyAddedClassName] = useState(null);
  // 英雄技能選擇器（表格式，見 HeroicSkillPickerModal）
  const [isHeroicPickerOpen, setIsHeroicPickerOpen] = useState(false);
  // 金手指選擇器（只列題目、點開看細節，見 QuirkPickerModal）
  const [isQuirkPickerOpen, setIsQuirkPickerOpen] = useState(false);
  // 目前開啟中的裝備選擇欄位（null = 未開啟）
  const [pickerSlot, setPickerSlot] = useState(null);
  // 定制武器鍛造台（`forgeEditingId` 為空字串＝開一把全新的）
  const [isForgeOpen, setIsForgeOpen] = useState(false);
  const [forgeEditingId, setForgeEditingId] = useState('');
  const customWeaponList = character.customWeapons || [];
  // 可變形的兩個型態是同一把武器（見 data/customWeapons.js 的 groupCustomWeapons），
  // 所以列表與「N 把」的計數都用**分組後**的數量。
  const customWeaponGroups = groupCustomWeapons(customWeaponList);

  /** 鍛造完成：同 id 覆蓋、新 id 追加（可變形會一次交出兩個型態） */
  const handleSaveCustomWeapons = (specs) => {
    const list = [...(character.customWeapons || [])];
    specs.forEach((spec) => {
      const idx = list.findIndex((x) => x.id === spec.id);
      if (idx >= 0) list[idx] = spec; else list.push(spec);
    });
    // 改名要跟著改裝備欄（裝備記的是名字，不是 id）——不然主手會留著一個不存在的名字，
    // 可變形武器也會退回顯示第一個型態。見 data/customWeapons.js 的 syncEquipmentNames。
    const { equipment, renamed } = syncEquipmentNames(character.equipment, character.customWeapons, list);
    const patch = { customWeapons: list };
    if (renamed) patch.equipment = equipment;
    updateField(patch, {
      kind: 'equipment',
      title: `鍛造${CUSTOM_WEAPON_BASE.label}：${specs[0]?.name || ''}`
    });
    setIsForgeOpen(false);
  };

  /** 刪除一把（可變形的話連第二型態一起刪，否則會留下孤兒型態） */
  const handleRemoveCustomWeapon = (id) => {
    const target = (character.customWeapons || []).find((w) => w.id === id);
    const keep = (character.customWeapons || []).filter((w) => (
      w.id !== id && w.id !== target?.transformingId
    ));
    // 被刪掉的正好是主手 → 回到徒手打擊，不要留著一個不存在的武器名
    const equipment = target && character.equipment?.mainHand === target.name
      ? { ...character.equipment, mainHand: '徒手打擊' }
      : character.equipment;
    updateField({ customWeapons: keep, equipment }, {
      kind: 'equipment',
      title: `移除${CUSTOM_WEAPON_BASE.label}：${target?.name || ''}`
    });
  };

  /**
   * 裝到主手。
   *
   * 這裡**必須**解構 `{ equipment, clearedOffHand }`——`applyEquipmentChoice` 回傳的是
   * 包裝過的結果，不是裝備物件本身。原本寫成 `const next = applyEquipmentChoice(...)` 再
   * `updateField('equipment', next)`，等於把整包塞進 equipment 欄位，`mainHand` 變成 undefined，
   * 按鈕看起來完全沒反應（而且污染裝備物件）。現在邏輯在 `equipCustomWeapon` 純函式裡，測試驗得到。
   */
  const handleEquipCustomWeapon = (name) => {
    const { equipment: nextEquipment, clearedOffHand } = equipCustomWeapon(character, name, weaponByName);
    updateField('equipment', nextEquipment, {
      kind: 'equipment',
      title: `更換主手武器：${name}`
    });
    if (clearedOffHand && showToast) {
      showToast(`已卸下副手「${clearedOffHand}」——定制武器佔滿兩個手部欄位`);
    }
  };

  if (!character) return null;

  const theme = getCharacterTheme(character.themeColor || themeId);

  // 開卡規則（起始等級／起始資金／必修職業／開放拓展…）
  //
  // **規則存在角色身上**（`character.creationRules`，存的是與官方預設不同的欄位 diff）。
  // 舊存檔沒有這個欄位 → `resolveCreationRules(undefined)` 補成官方標準，行為與以前相同。
  // `creationRules` 這個 prop 保留給呼叫端明確覆寫（測試與未來的 GM 需求匯入用）。
  const rules = resolveCreationRules(creationRules ?? character.creationRules);

  // Validation checklist（以這一團的規則驗證，不是寫死的官方標準）
  const validation = validateCharacter(character, rules);
  const stats = calculateCharacterStats(character);

  // 等級獎勵：屬性骰 +1 階（原書 p.229：20／40 級各一次）。傳給四維選擇器顯示升級列。
  const remainingDieUpgrades = Math.max(
    0,
    attributeDieUpgradesAllowed(character.level) - (attributeDieUpgradesUsed(character.attributes) ?? 0)
  );

  // 創角進度：同一份驗證結果按步驟整理成主線（導航列本身就是進度表）
  const checklist = buildCreationChecklist(character, rules);
  const checklistById = new Map(checklist.map((item) => [item.id, item]));
  const blockedCount = checklist.filter((item) => item.status === 'error').length;
  const canLock = blockedCount === 0;

  // 英雄技能的前提（原書 p.232；開局名額見 Playtest Materials 2026-10-01 p.4）：
  // **不能選的原因要在選之前看見**，不是選完才被擋。判定與 `validateCharacter` 共用同一份。
  const ownedClassNames = (character.classes || []).map((c) => c.className);
  const charLevel = getCharacterLevel(character);

  // 開局名額只有一個（Playtest 原文：an additional Heroic Skill）。
  // 「用到名額」＝這個技能已經取得，而且它**不是**靠精通拿的（精通路徑不受名額限制）。
  //
  // 舊版是從 `heroicOptions` 反推（`o.already && o.needsSlot`）。那個陣列已經移除——
  // 逐列判定搬到 `HeroicSkillPickerModal`（表格要顯示「為什麼不能選」），
  // 但名額狀態還要在第 5 步的標題上顯示，所以在這裡獨立算一次。
  const creationSlotUsed = (character.heroicSkills || []).filter((entry) => {
    const def = HEROIC_SKILLS.find((h) => h.name === (entry?.name || entry));
    if (!def) return false;
    const byMastery = checkHeroicSkillRequirement(def, {
      masteredClasses: stats.masteredClasses,
      classes: ownedClassNames,
      level: charLevel
    }).ok;
    if (byMastery) return false;
    return checkHeroicSkillRequirement(def, {
      classes: ownedClassNames,
      level: charLevel,
      atCreation: true
    }).ok;
  }).length;
  const creationSlotFull = Boolean(rules.startingHeroicSkill) && creationSlotUsed >= 1;

  // 英雄技能的出處（使用者要求「必須要標出出處」）。
  // 舊存檔的技能物件沒有 `source`，所以一律回查 `HEROIC_SKILLS` 而不是只讀物件上的欄位。
  const heroicSourceOf = (entry) => {
    const name = entry?.name || entry;
    const found = HEROIC_SKILLS.find((x) => x.name === name);
    return HEROIC_SKILL_SOURCE_LABELS[entry?.source || found?.source] || '';
  };

  // 定稿狀態：創角欄位凍結，只留成長相關的欄位可以動
  const locked = isCharacterLocked(character);
  const frozenTab = locked && LOCKED_CREATION_TABS.includes(activeTab);

  const handleLock = () => {
    onChange(lockCharacter(character));
    if (showToast) showToast('已定稿——創角欄位凍結，成長仍可繼續');
  };

  const handleUnlock = () => {
    if (typeof window !== 'undefined' && !window.confirm('解除定稿會重新開放身世與四維屬性，確定嗎？')) return;
    onChange(unlockCharacter(character));
    if (showToast) showToast('已解除定稿——創角欄位重新開放');
  };

  /**
   * 所有欄位變更的唯一出口。
   *
   * `field` 可傳字串（單一欄位）或物件（一次改多個欄位）。物件形式是必要的：
   * 結算起始資金要同時寫入 `zenit` 與 `startingFundsRolled`，分兩次呼叫會各自
   * 以同一個過期的 `character` 為基礎，第二次會把第一次的結果蓋掉。
   *
   * `meta` 有值時會留下一筆成長履歷（見 utils/characterLog.js）；
   * `fields: []` 表示「只留標題、不比對欄位」（用於職業／技能這類陣列變更）。
   */
  const updateField = (field, value, meta = null) => {
    const patch = typeof field === 'object' && field !== null ? field : { [field]: value };
    const base = {
      ...character,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    const changedFields = Object.keys(patch);
    onChange(meta ? loggableChange(character, base, { fields: changedFields, ...meta }) : base);
  };

  const updateAttribute = (attr, val) => {
    onChange({
      ...character,
      attributes: {
        ...(character.attributes || {}),
        [attr]: val
      },
      updatedAt: new Date().toISOString()
    });
  };

  const toggleSourcebook = (sbKey) => {
    const cur = character.enabledSourcebooks ?? rules.defaultSourcebooks;
    const exists = cur.includes(sbKey);
    // 超出這一團開放的上限時直接拒絕（GM 自訂開局）
    if (!exists && !rules.allowedSourcebooks.includes(sbKey)) {
      if (showToast) showToast(`此團未開放《${SOURCEBOOKS[sbKey]?.name || sbKey}》`);
      return;
    }
    const updated = exists ? cur.filter(k => k !== sbKey) : [...cur, sbKey];
    updateField('enabledSourcebooks', updated);
  };

  // Filter available classes according to enabled sourcebooks
  //
  // 公測修訂**不是手冊**（2026-10-19 使用者裁定，§BE）：它由開卡規則的
  // 【開放公測修訂內容】單獨控制。所以這裡把 `playtest` 當成「規則算出來的隱含來源」——
  // 開關開著就補進清單（秘儀師【變體】可選），關著就剝掉；
  // **不改寫角色身上既有的 `enabledSourcebooks`**（舊資料不覆寫）。
  const enabledBooks = (() => {
    const base = character.enabledSourcebooks ?? rules.defaultSourcebooks;
    const withoutPlaytest = base.filter((k) => k !== PLAYTEST_SOURCEBOOK_KEY);
    return rules.allowPlaytest
      ? [...withoutPlaytest, PLAYTEST_SOURCEBOOK_KEY]
      : withoutPlaytest;
  })();
  const availableClassNames = [
    ...new Set(
      Object.keys(SOURCEBOOKS)
        .filter(sbKey => enabledBooks.includes(sbKey))
        .flatMap(sbKey => SOURCEBOOKS[sbKey].classes)
        .filter(cName => rulesData.classes[cName])
    )
  ];

  // Class & Skill handlers
  /**
   * 一次確認多個職業（使用者要求：在同一個彈窗裡把各職業的技能點完再一次確定，
   * 不要再「選職業 → 點技能 → 確認 → 再選職業」來回）。
   *
   * `entries` = `[{ className, skills: [{ name, sl }] }]`，只含真的有點到等級的職業。
   */
  const handleSelectClassesFromPicker = (entries = []) => {
    const curClasses = character.classes || [];
    const additions = [];
    (entries || []).forEach(({ className, skills }) => {
      if (!className || !rulesData.classes[className]) return;
      if (curClasses.some((c) => c.className === className)) return;
      const activeSkills = (skills || []).filter((s) => s.sl > 0);
      const totalLevel = activeSkills.reduce((sum, s) => sum + s.sl, 0);
      if (totalLevel < 1) return;
      additions.push({ className, level: totalLevel, skills: activeSkills });
    });
    if (additions.length === 0) return;

    const summary = additions.map((a) => `【${a.className}】${a.level} 級`).join('、');
    updateField('classes', [...curClasses, ...additions], {
      kind: 'skill',
      title: `修習 ${summary}`,
      fields: []
    });
    setNewlyAddedClassName(additions[additions.length - 1].className);
  };

  /** 一次把某幾本手冊設為開放／關閉（上排「全部」鈕用；逐本呼叫會遺失更新） */
  const setEnabledSourcebooks = (keys) => {
    const wanted = (keys || []).filter((k) => rules.allowedSourcebooks.includes(k));
    if (wanted.length === 0) return;
    updateField('enabledSourcebooks', wanted);
  };

  // 既有職業已經吃掉的技能等級——一次確定多個職業時要把總額算進去（見 ClassPickerModal）
  const usedSkillLevels = (character.classes || []).reduce(
    (sum, c) => sum + (c.skills || []).reduce((s, sk) => s + (sk.sl || 0), 0),
    0
  );

  // 免費增益二選一（最大 HP 或 最大 MP）：寫入 classes[].chosenBenefit，引擎據此決定 +5 落在 HP 還是 MP
  const handleUpdateClassBenefit = (classIdx, benefit) => {
    const curClasses = JSON.parse(JSON.stringify(character.classes || []));
    if (!curClasses[classIdx]) return;
    curClasses[classIdx].chosenBenefit = benefit;
    updateField('classes', curClasses, {
      kind: 'skill',
      title: `【${curClasses[classIdx].className}】免費增益改為 ${benefit === 'mp' ? '最大 MP +5' : '最大 HP +5'}`,
      fields: []
    });
  };

  const handleUpdateClassSkills = (classIdx, updatedSkills) => {
    const curClasses = JSON.parse(JSON.stringify(character.classes || []));
    if (!curClasses[classIdx]) return;
    const beforeSkills = (character.classes || [])[classIdx]?.skills || [];
    curClasses[classIdx].skills = updatedSkills;
    curClasses[classIdx].level = updatedSkills.reduce((sum, s) => sum + s.sl, 0);

    // 同步特技中所選的咒語至 character.spells
    const allKnownSpellNames = new Set();
    curClasses.forEach(cl => {
      (cl.skills || []).forEach(sk => {
        if (['元素魔法', '靈魂魔法', '熵系魔法'].includes(sk.name) && Array.isArray(sk.selectedOptions)) {
          sk.selectedOptions.forEach(spName => allKnownSpellNames.add(spName));
        }
      });
    });

    const currentSpells = character.spells || [];
    // 保留非三大核心學派的法術（如自訂或其它來源）
    const nonCoreSpells = currentSpells.filter(sp => !['元素', '靈魂', '熵系'].includes(sp.school));
    const newClassSpells = Array.from(allKnownSpellNames).map(spName => {
      const found = (rulesData.spells || []).find(s => s.name === spName);
      return found ? { ...found } : { name: spName };
    });

    const className = curClasses[classIdx].className;
    // 逐技能比對 SL，記錄「升級後把點數加在哪一個技能上」
    const skillChanges = updatedSkills
      .map(sk => ({
        field: `skill:${sk.name}`,
        from: beforeSkills.find(b => b.name === sk.name)?.sl ?? 0,
        to: sk.sl
      }))
      .filter(c => c.from !== c.to);

    onChange(loggableChange(character, {
      ...character,
      classes: curClasses,
      spells: [...nonCoreSpells, ...newClassSpells],
      updatedAt: new Date().toISOString()
    }, {
      kind: 'skill',
      title: `調整【${className}】的技能`,
      changes: skillChanges
    }));
  };

  const handleRemoveClass = (classNameToRemove) => {
    const remainingClasses = (character.classes || []).filter(c => c.className !== classNameToRemove);
    const allKnownSpellNames = new Set();
    remainingClasses.forEach(cl => {
      (cl.skills || []).forEach(sk => {
        if (['元素魔法', '靈魂魔法', '熵系魔法'].includes(sk.name) && Array.isArray(sk.selectedOptions)) {
          sk.selectedOptions.forEach(spName => allKnownSpellNames.add(spName));
        }
      });
    });

    const currentSpells = character.spells || [];
    const nonCoreSpells = currentSpells.filter(sp => !['元素', '靈魂', '熵系'].includes(sp.school));
    const newClassSpells = Array.from(allKnownSpellNames).map(spName => {
      const found = (rulesData.spells || []).find(s => s.name === spName);
      return found ? { ...found } : { name: spName };
    });

    onChange(loggableChange(character, {
      ...character,
      classes: remainingClasses,
      spells: [...nonCoreSpells, ...newClassSpells],
      updatedAt: new Date().toISOString()
    }, {
      kind: 'skill',
      title: `移除職業【${classNameToRemove}】`,
      fields: []
    }));
    if (newlyAddedClassName === classNameToRemove) {
      setNewlyAddedClassName(null);
    }
  };

  // 情感羈絆在編輯器裡沒有處理函式：羈絆不屬創角（原書 p.154 的八步驟沒有羈絆；
  // p.57 說明羈絆於休息場景建立），所以這個分頁已移除。
  // 羈絆一律在跑團面板（CharacterPlayHUD 的「情感羈絆」分頁）新增與調整。

  // Apply Starter Preset
  // 官方經典職業搭配只提供官方欄位（屬性／職業技能／裝備／資金／金手指）；
  // 身分、主題、出身、羈絆屬玩家自訂，套用時一律保留現值不動。
  // 技能子選擇（咒語／舞步／音調曲風／天賦／混合形態／魔法種子／徽記）內嵌在
  // `classes[].skills[].selectedOptions`，隨 `classes` 深拷貝一併帶入。
  // 純邏輯抽在 `utils/presetApply.js`，以便測試覆蓋。
  const handleApplyPreset = (preset) => {
    onChange(applyPreset(character, preset));
    setIsPresetsModalOpen(false);
  };

  // 命刻的增刪已移除——創角八步驟（原書 p.154）沒有這一項，命刻是跑團中的 GM 工具。
  // 跑團面板（CharacterPlayHUD）的「個人命刻」分頁仍有完整的增刪與填充。

  // 創角步驟＝原書 p.154 的八個步驟（身世／四維／職業與技能／裝備／特質與命刻，
  // 其中「名字」併入身世、「HP/MP/IP 等數值」由引擎自動算）。
  // **沒有情感羈絆**：羈絆不屬創角，見 CREATION_STEPS 的說明。
  // 分頁標籤描述的是「玩家在這裡做什麼決定」，不是「角色卡的章節」（見 §V1 的診斷）。
  //
  // 原本每列還帶著一個 `icon` 欄位，但**它從來沒有被讀取**——導航列畫的是編號徽章
  // （見下面的 `{t.id}`），而 `test:ui` 卻用它來數分頁，等於用死資料當護欄。
  // 2026-10-06 移除，護欄改成直接比對標籤序列。
  const TABS = [
    { id: 1, label: '基礎身世' },
    { id: 2, label: '職業與技能' },
    { id: 3, label: '四維屬性' },
    { id: 4, label: '裝備配置' },
    { id: 5, label: '英雄技能與特質' },
    { id: 6, label: '命名與背景' }
  ];
  // 上面那個 useState 的夾制用 TAB_COUNT（不能讀 TABS，會踩 TDZ）；test:ui 有一條護欄綁住兩者相等。
  if (TABS.length !== TAB_COUNT) {
    throw new Error(`TABS 有 ${TABS.length} 個分頁，但 TAB_COUNT 是 ${TAB_COUNT}——請一起改`);
  }

  // Attribute sum
  const attrSum = (character.attributes?.dex || 0) + (character.attributes?.ins || 0) + (character.attributes?.mig || 0) + (character.attributes?.wlp || 0);

  // ── 裝備配置：所有顯示數字都以「目前這張卡的四維骰」即時換算。
  // 換算規則集中在 utils/equipmentRules.js，選裝彈窗與這裡共用同一份實作，
  // 避免「選單上算一套、角色卡上算另一套」。
  const equipDice = diceFromStats(stats);
  const weaponByName = new Map([
    ...rulesData.equipment.weapons.map(w => [w.name, w]),
    // 定制武器（HF p.106）也要進這張表——裝備挑選器、預算試算、載入衝突檢查
    // 全部共用它，所以只要進來一次，底下每一處都會自動認得這把武器。
    ...buildCustomWeaponEntries(character).map(w => [w.name, w])
  ]);
  const armorByName = new Map(rulesData.equipment.armors.map(a => [a.name, a]));
  const shieldByName = new Map(rulesData.equipment.shields.map(s => [s.name, s]));
  const accessoryByName = new Map(rulesData.equipment.accessories.map(a => [a.name, a]));

  // 起始裝備花費（原書 p.164）：只計**基本武器／防具／盾牌**。
  // 飾品是稀有物品，不從起始預算出——以前這裡把飾品算進去，而 equipmentRules 的
  // buildLoadoutIssues 不算，同一張卡在兩處得到不同的「已花費」。現在兩邊共用同一支函式。
  const totalEquipCost = totalStartingEquipCost(character.equipment, {
    weaponMap: weaponByName,
    shieldMap: shieldByName,
    armorMap: armorByName
  });
  const remainingBudget = rules.startingZenit - totalEquipCost;

  const handleRollStartingZenit = () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const rollSum = (d1 + d2) * 10;
    const finalZenit = Math.max(0, remainingBudget) + rollSum;
    // 一次寫入兩個欄位（`updateField` 的物件形式）：`startingFundsRolled` 是
    // 「起始資金尚未結算」那條提醒的開關，分兩次呼叫會互相蓋掉。
    updateField(
      { zenit: finalZenit, startingFundsRolled: true },
      null,
      { kind: 'zenit', title: '擲起始資金 2d6 × 10' }
    );
    alert(`[2d6 擲骰] [${d1}] + [${d2}] = ${d1 + d2} (× 10 = ${rollSum}z)！\n加上剩餘裝備預算 ${Math.max(0, remainingBudget)}z，角色的起始儲蓄已結算為 ${finalZenit}z！`);
  };

  const mainHandName = character.equipment?.mainHand || '';
  const mainShield = shieldByName.get(mainHandName) || null;
  // 空手＝原書 p.130 的徒手打擊：空格的手部欄位自動視為裝備它
  const mainWeapon = mainShield
    ? null
    : (weaponByName.get(mainHandName) || (mainHandName ? null : weaponByName.get('徒手打擊')));

  const offHandName = character.equipment?.offHand || '';
  const offShield = shieldByName.get(offHandName) || null;
  const offWeapon = offShield ? null : (weaponByName.get(offHandName) || null);
  const offWeaponEval = offWeapon ? evaluateWeapon(offWeapon, equipDice) : null;
  const offShieldOutcome = computeShieldOutcome(offShield);

  // 守護者【雙重盾牌】：兩手皆盾時合併視為格鬥類別雙手近戰武器「雙盾」，
  // 攻擊改用該技能的命中與傷害公式——盾牌本身沒有攻擊資料。
  const dualShield = getDualShieldState(character, {
    mainIsShield: Boolean(mainShield),
    offIsShield: Boolean(offShield)
  });
  const mainAttack = dualShield.active ? dualShield.weapon : mainWeapon;
  const mainWeaponEval = mainAttack ? evaluateWeapon(mainAttack, equipDice) : null;

  const armorName = character.equipment?.armor || '無裝甲 / 冒險服';
  const armor = armorByName.get(armorName) || null;
  const armorOutcome = computeArmorOutcome(armor, equipDice);

  const accessoryName = character.equipment?.accessory || '';
  const accessory = accessoryByName.get(accessoryName) || null;

  const mainProficiency = mainShield
    ? checkEquippable(mainShield, 'mainHand', stats.profs, { isShield: true })
    : checkEquippable(mainWeapon, 'mainHand', stats.profs);
  const offProficiency = offShield
    ? checkEquippable(offShield, 'offHand', stats.profs, { isShield: true })
    : checkEquippable(offWeapon, 'offHand', stats.profs);
  const armorProficiency = checkEquippable(armor, 'armor', stats.profs);

  const offHandOccupied = Boolean(offHandName) && offHandName !== '無盾牌';
  // 雙手武器佔滿兩個手部欄位（Core p.131）：副手格會被主手吃掉
  const mainTakesBothHands = isTwoHanded(mainWeapon);
  const twoHandedConflict = mainTakesBothHands && offHandOccupied;

  const loadoutIssues = buildLoadoutIssues({
    character,
    stats,
    weaponMap: weaponByName,
    armorMap: armorByName,
    shieldMap: shieldByName,
    accessoryMap: accessoryByName
  });

  // 更換某個欄位時，該欄位原本的花費會被釋出，所以可動用預算要把它的成本加回去
  const slotCost = {
    mainHand: (mainWeapon || mainShield)?.cost || 0,
    offHand: (offShield || offWeapon)?.cost || 0,
    armor: armor?.cost || 0,
    accessory: 0
  };
  const pickerBudget = Math.max(0, rules.startingZenit - (totalEquipCost - (slotCost[pickerSlot] || 0)));

  const mainHandMetrics = mainWeaponEval
    ? [
        { label: '命中檢定', value: mainWeaponEval.accuracyLabel },
        { label: '傷害', value: mainWeaponEval.damageFormula },
        { label: '價格', value: `${mainAttack.cost}z` }
      ]
    : [];
  const mainHandNote = dualShield.active
    ? `兩手皆盾，合併視為格鬥類別雙手近戰武器；傷害 ${dualShield.weapon.damage}${dualShield.defenseMasterySL > 0 ? `，額外 +${dualShield.defenseMasterySL}（防守掌握 SL）` : ''}`
    : (mainWeaponEval
        ? `${mainAttack.category} · ${mainAttack.hands === 2 ? '雙手' : '單手'}${mainAttack.range}${mainAttack.note ? ` · ${mainAttack.note}` : ''}`
        : (mainShield ? '單獨一面盾牌不能攻擊；需與副手盾牌合併為「雙盾」' : null));
  const mainHandBadges = [];
  if (dualShield.active) {
    mainHandBadges.push({ label: '雙盾', variant: theme.badgeVariant });
  } else if (mainWeapon?.category) {
    mainHandBadges.push({ label: mainWeapon.category, variant: theme.badgeVariant });
  }
  if (mainTakesBothHands) mainHandBadges.push({ label: '雙手', variant: 'zinc' });
  if (mainWeapon?.martial || mainShield?.martial) mainHandBadges.push({ label: '職業', variant: 'rose' });

  const offHandMetrics = offShield
    ? [
        { label: '物防', value: `+${offShieldOutcome.defBonus}` },
        { label: '魔防', value: `+${offShieldOutcome.mdefBonus}` },
        { label: '先攻', value: offShieldOutcome.initMod === 0 ? '±0' : String(offShieldOutcome.initMod) }
      ]
    : (offWeaponEval
        ? [
            { label: '命中檢定', value: offWeaponEval.accuracyLabel },
            { label: '傷害', value: offWeaponEval.damageFormula },
            { label: '價格', value: `${offWeapon.cost}z` }
          ]
        : []);

  const armorMetrics = [
    { label: '物防', value: String(armorOutcome.def) },
    { label: '魔防', value: String(armorOutcome.mdef) },
    { label: '先攻', value: armorOutcome.initMod === 0 ? '±0' : String(armorOutcome.initMod) }
  ];

  const mainHandWarning = twoHandedConflict
    ? '雙手武器佔滿兩個手部欄位，副手必須空出'
    : (mainShield && !dualShield.learned
        ? '盾牌裝備於主手需要守護者【雙重盾牌】'
        : (mainProficiency.ok ? null : mainProficiency.reason));
  const offHandWarning = offHandOccupied && !offProficiency.ok ? offProficiency.reason : null;
  const armorWarningText = armorProficiency.ok ? null : armorProficiency.reason;

  const mainHandLabel = mainShield?.name || mainWeapon?.name || (mainHandName || '未設定');
  const offHandLabel = offShield?.name || offWeapon?.name || (offHandName || '無盾牌');
  const armorLabel = armor?.name || armorName;
  const accessoryLabel = accessory?.name || (accessoryName || '不佩戴飾品');

  // 裝備圖示一律取自使用者的裝備設計器對照表（見 equipmentRules.js 的 EQUIPMENT_ICONS）
  // 定制武器沒有自己的圖示（名字是玩家取的）→ 退回**該類別**的圖示，
  // 一把定制的弓就該長得像弓，而不是每個人都一把劍。
  const customMainIcon = mainWeapon?.isCustomWeapon ? (CATEGORY_ICON[mainWeapon.category] || 'cat_sword') : null;
  const mainHandIcon = customMainIcon || getEquipmentIcon(
    dualShield.active ? '雙盾' : (mainShield?.name || mainWeapon?.name || ''),
    'slot_mainhand'
  );
  const offHandIcon = offShield
    ? getEquipmentIcon(offShield.name, 'slot_offhand')
    : (offWeapon ? getEquipmentIcon(offWeapon.name, 'slot_offhand') : 'slot_offhand');
  const armorIcon = getEquipmentIcon(armor?.name || '', 'slot_armor');

  const mainHandMissing = Boolean(mainHandName) && !mainWeapon && !mainShield;
  const offHandMissing = Boolean(offHandName) && !offShield && !offWeapon;
  const armorMissing = Boolean(character.equipment?.armor) && !armor;
  const accessoryMissing = Boolean(accessoryName) && !accessory;

  return (
    <div className="space-y-4">
      {/* 桌面與手機自適應架構：仿 NPC 工坊的左側導航清單 */}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        
        {/* ==================== 桌面端左側邊欄 (Left Sidebar - md+ 顯示) ==================== */}
        <div className="hidden md:flex w-60 shrink-0 flex-col gap-3 sticky top-4">
          {/* 角色卡身分小卡 */}
          <div
            className="rounded-xl p-3.5 border shadow-xs transition-colors"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
          >
            <div className="flex items-center gap-3">
              <div
                onClick={() => setActiveTab(1)}
                className="w-11 h-11 rounded-xl bg-white border overflow-hidden shrink-0 flex items-center justify-center font-serif shadow-inner cursor-pointer group relative"
                style={{ borderColor: theme.border }}
                title="點擊前往基礎身世設定更換或調整頭像"
              >
                {character.avatar && (character.avatar.startsWith('http') || character.avatar.startsWith('data:')) ? (
                  <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                ) : (
                  <GameIcon
                    name={character.avatar || character.classes?.[0]?.className || 'sword'}
                    size={26}
                    style={{ color: theme.accent }}
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-bold">
                  更換
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                  <h3 className="font-serif font-black text-sm truncate" style={{ color: theme.textDark }}>
                    {character.name || '新冒險者'}
                  </h3>
                  <JRPGBadge variant={theme.badgeVariant} size="xs">
                    Lv {getCharacterLevel(character)}
                  </JRPGBadge>
                </div>
                <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                  {character.identity || '未設定身份'}
                </p>
              </div>
            </div>
          </div>

          {/* 經典職業搭配快捷入口 */}
          <button
            type="button"
            onClick={() => setIsPresetsModalOpen(true)}
            disabled={locked}
            className="w-full inline-flex items-center justify-between px-3.5 py-2.5 rounded-xl border font-bold transition-all shadow-xs hover:scale-102 group text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.subpanelBg,
              color: theme.textDark
            }}
            title={locked ? '已定稿——套用官方配置會重寫屬性與職業，請先解除定稿' : '一鍵套用官方經典職業搭配（職業、特技、屬性骰、裝備配置）'}
          >
            <div className="flex items-center gap-2">
              <GiSparkles className="w-4 h-4 group-hover:scale-110 transition-transform shrink-0" style={{ color: theme.accent }} />
              <span className="text-xs font-black">經典職業搭配</span>
            </div>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 transition-colors"
              style={{ borderColor: theme.border, color: theme.accent, backgroundColor: theme.cardBg }}
            >
              一鍵套用
            </span>
          </button>

          {/* 定稿狀態卡：「還在創角」與「已經在跑」的分界 */}
          <div
            className="rounded-xl border shadow-xs p-3 flex flex-col gap-2 transition-colors"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: locked ? theme.accent : theme.border
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <GameIcon name="GiPadlock" size={13} style={{ color: locked ? theme.accent : theme.textMuted }} />
                <span className="text-[11px] font-black" style={{ color: theme.textDark }}>
                  {locked ? '已定稿' : '創角中'}
                </span>
              </div>
              {locked && character.lockedAt && (
                <span className="text-[9px] font-mono shrink-0" style={{ color: theme.textMuted }}>
                  {formatLogTime(character.lockedAt)}
                </span>
              )}
            </div>

            <p className="text-[10px] leading-relaxed" style={{ color: theme.textMuted }}>
              {locked
                ? '身世與四維屬性已凍結；等級、技能、裝備仍可隨時調整。'
                : canLock
                  ? `${TABS.length} 個步驟都通過規則檢查，可以定稿了。定稿後創角欄位會凍結。`
                  : `還有 ${blockedCount} 項未符合規則，補完後即可定稿。`}
            </p>

            <button
              type="button"
              onClick={locked ? handleUnlock : handleLock}
              disabled={!locked && !canLock}
              className={`w-full text-[11px] font-bold px-2.5 py-2 rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                locked ? 'hover:bg-rose-50' : 'hover:scale-101'
              }`}
              style={{
                backgroundColor: locked ? theme.cardBg : (canLock ? '#059669' : theme.subpanelBg),
                borderColor: locked ? theme.border : (canLock ? '#047857' : theme.border),
                color: locked ? theme.textDark : (canLock ? '#ffffff' : theme.textMuted)
              }}
              title={locked ? '解除定稿會重新開放身世與四維屬性' : '定稿後創角欄位凍結，只留成長相關欄位'}
            >
              <GiPadlock className="w-3.5 h-3.5" />
              {locked ? '解鎖編輯' : '完成創角'}
            </button>
          </div>

          {/* 創角流程縱向清單（步驟數＝TABS，不含情感羈絆） */}
          <div
            className="rounded-xl border shadow-xs p-2 flex flex-col gap-1 transition-colors"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
          >
            <div className="px-2 py-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              創角流程
            </div>

            {TABS.map(t => {
              const step = checklistById.get(t.id) || { status: 'todo', message: '', issueCount: 0 };
              const isTabActive = activeTab === t.id;
              const isFrozen = locked && LOCKED_CREATION_TABS.includes(t.id);

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer ${
                    isTabActive
                      ? 'text-white shadow-sm'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                  style={isTabActive ? { backgroundColor: theme.accent, color: '#ffffff' } : {}}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-black shrink-0 transition-colors ${
                        isTabActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      {t.id}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold leading-tight flex items-center gap-1">
                        {t.label}
                        {isFrozen && <GameIcon name="GiPadlock" size={10} className="shrink-0" />}
                      </div>
                      {/* 這一行以前是標籤的重複；改成「這一格還缺什麼」，導航列就變成進度表 */}
                      <div className={`text-[10px] leading-tight mt-0.5 truncate ${
                        isTabActive ? 'text-white/80' : 'text-slate-400'
                      }`}>
                        {step.message}
                      </div>
                    </div>
                  </div>

                  {/* 狀態：完成打勾、待處理黃點、有問題紅點 */}
                  {step.status === 'error' ? (
                    <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-200 shrink-0" title="有未符合規則的項目" />
                  ) : step.status === 'todo' ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="還有提醒項目" />
                  ) : (
                    <GiCheckMark className={`w-3.5 h-3.5 shrink-0 ${isTabActive ? 'text-white' : 'text-emerald-600'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* 創角完整度自檢：常駐即時狀態卡 */}
          <button
            type="button"
            onClick={() => setIsValidationModalOpen(true)}
            className={`w-full text-left p-3 rounded-xl border transition-all shadow-xs flex flex-col gap-1.5 hover:scale-101 cursor-pointer ${
              validation.errors.length > 0
                ? 'bg-rose-50/90 border-rose-300 hover:border-rose-400'
                : validation.hasWarnings
                  ? 'bg-amber-50/90 border-amber-300 hover:border-amber-400'
                  : 'bg-emerald-50/90 border-emerald-300 hover:border-emerald-400'
            }`}
            title="點擊查看完整官方創角規則驗證報告"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                {validation.errors.length > 0 ? (
                  <GiHazardSign className="w-4 h-4 text-rose-600 shrink-0" />
                ) : validation.hasWarnings ? (
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <GiCheckMark className="w-4 h-4 text-emerald-700 shrink-0" />
                )}
                <span className={
                  validation.errors.length > 0
                    ? 'text-rose-950'
                    : validation.hasWarnings
                      ? 'text-amber-950'
                      : 'text-emerald-950'
                }>
                  規則自檢
                </span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                validation.errors.length > 0
                  ? 'bg-rose-200 text-rose-900'
                  : validation.hasWarnings
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
              }`}>
                {validation.errors.length > 0
                  ? `${validation.errors.length} 項待修正`
                  : validation.hasWarnings
                    ? `${validation.warnings.length} 項提醒`
                    : '100% 合規'}
              </span>
            </div>
            <p className={`text-[11px] leading-tight ${
              validation.errors.length > 0
                ? 'text-rose-700'
                : validation.hasWarnings
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            }`}>
              {validation.errors.length > 0
                ? '尚有未符規則項目，點擊查看詳情'
                : validation.hasWarnings
                  ? '基本合規，有可優化提醒'
                  : '已符合官方標準創角規範'}
            </p>
          </button>

          {/* 快捷操作區 (預覽、跑團) */}
          <div
            className="rounded-xl border shadow-xs p-2.5 flex flex-col gap-2 transition-colors"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
          >

            {/* 卡片預覽：唯讀。標籤說的是「你來這裡做什麼」，不是內部概念——
                舊的「查看角色卡／進入跑團卡」對新玩家來說兩個都一樣。 */}
            <button
              type="button"
              onClick={() => setIsCardPreviewModalOpen(true)}
              className="w-full text-left px-3 py-2 rounded-xl border transition-all shadow-2xs hover:opacity-90 cursor-pointer"
              style={{ borderColor: theme.border, color: theme.textDark, backgroundColor: theme.cardBg }}
              title="唯讀：看這張卡目前長什麼樣，也可以列印或截圖"
            >
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <GiScrollUnfurled className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
                <span>卡片預覽</span>
                <span
                  className="ml-auto text-[9px] font-mono px-1 py-0.5 rounded border shrink-0"
                  style={{ borderColor: theme.border, color: theme.textMuted }}
                >
                  唯讀
                </span>
              </span>
              <span className="block text-[10px] leading-tight mt-0.5" style={{ color: theme.textMuted }}>
                看整張卡目前填得怎樣、列印或截圖存檔
              </span>
            </button>

            {/* 跑團面板：跑團中操作的介面 */}
            {onEnterPlayMode && (
              <JRPGButton
                variant={theme.buttonVariant || 'primary'}
                size="sm"
                icon={Play}
                onClick={onEnterPlayMode}
                className="w-full justify-center"
              >
                <span className="flex flex-col items-center leading-tight">
                  <span>跑團面板</span>
                  <span className="text-[9px] font-normal opacity-90">HP／MP／狀態、攻擊與咒語、命刻</span>
                </span>
              </JRPGButton>
            )}
          </div>
        </div>

        {/* ==================== 手機端頂部步驟條 (Mobile Header - md 以下顯示) ==================== */}
        <div
          className="md:hidden w-full flex flex-col gap-2 rounded-xl p-3 border shadow-xs transition-colors"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="font-serif font-black text-xs truncate" style={{ color: theme.textDark }}>
                {character.name || '新冒險者'}
              </span>
              <JRPGBadge variant={theme.badgeVariant} size="xs">
                Lv {getCharacterLevel(character)}
              </JRPGBadge>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setIsPresetsModalOpen(true)}
                className="px-2 py-1 rounded-md border text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                style={{ borderColor: theme.border, color: theme.textDark, backgroundColor: theme.cardBg }}
                title="經典職業搭配"
              >
                <GiSparkles className="w-3 h-3" style={{ color: theme.accent }} />
                <span>職業搭配</span>
              </button>
              <button
                type="button"
                onClick={() => setIsValidationModalOpen(true)}
                className={`px-2 py-1 rounded-md border text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer ${
                  validation.errors.length > 0
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : validation.hasWarnings
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
                title="創角規則自檢"
              >
                {validation.errors.length > 0 ? (
                  <GiHazardSign className="w-3 h-3 text-rose-600" />
                ) : validation.hasWarnings ? (
                  <Info className="w-3 h-3 text-amber-600" />
                ) : (
                  <GiCheckMark className="w-3 h-3 text-emerald-700" />
                )}
                <span>
                  {validation.errors.length > 0
                    ? `${validation.errors.length}待修正`
                    : validation.hasWarnings
                      ? `${validation.warnings.length}提醒`
                      : '合規'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsCardPreviewModalOpen(true)}
                className="px-2 py-1 rounded-md border text-[11px] font-bold shadow-2xs cursor-pointer"
                style={{ borderColor: theme.border, color: theme.textDark, backgroundColor: theme.cardBg }}
              >
                卡片預覽
              </button>
              {onEnterPlayMode && (
                <button
                  type="button"
                  onClick={onEnterPlayMode}
                  className="px-2 py-1 rounded-md text-white text-[11px] font-bold shadow-2xs cursor-pointer"
                  style={{ backgroundColor: theme.accent }}
                >
                  跑團面板
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: theme.border }}>
            <span className="text-[11px] font-bold text-slate-500 shrink-0">步驟 {activeTab}/{TABS.length}:</span>
            <select
              value={activeTab}
              onChange={e => setActiveTab(Number(e.target.value))}
              className="flex-1 text-xs font-bold border rounded-lg px-2.5 py-1 outline-none"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
            >
              {TABS.map(t => {
                const step = checklistById.get(t.id);
                const mark = step?.status === 'done' ? '✓' : step?.status === 'todo' ? '△' : '✕';
                return (
                  <option key={t.id} value={t.id}>{t.id}. {mark} {t.label}</option>
                );
              })}
            </select>
          </div>
        </div>

        {/* ==================== 主編輯區域 (Right Main Canvas) ==================== */}
        <div
          className="flex-1 w-full min-w-0 rounded-xl border p-4 sm:p-7 shadow-xs space-y-6 transition-colors"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
        >
          <ErrorBoundary inline label={TABS.find(t => t.id === activeTab)?.label || '編輯步驟'}>
          {/* 此團開卡規則：放在 fieldset 外面，定稿後仍可調整——它是 GM 的需求，
              不是玩家的創角決定（改動只影響這一張卡，不會追溯其他角色）。 */}
          <CreationRulesPanel
            rules={rules}
            diff={character.creationRules || {}}
            onChange={(next) => updateField('creationRules', next, { kind: 'note', title: '調整開卡規則' })}
            theme={theme}
          />

          {/* 定稿後凍結創角分頁：`fieldset[disabled]` 會連同內部所有表單控件一起停用，
              所以不必逐個 input 加 disabled（也才不會漏掉任何一個） */}
          <fieldset
            disabled={frozenTab}
            className="border-0 p-0 m-0 min-w-0 disabled:opacity-60"
          >

          {/* ==================== TAB 1: 基礎身世 ==================== */}
          {activeTab === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h4 className="font-serif font-black text-lg flex items-center gap-2" style={{ color: theme.textDark }}>
                  <span style={{ color: theme.accent }}>1.</span> 角色核心身份
                </h4>
                <button
                  type="button"
                  onClick={() => setIsPresetsModalOpen(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 shadow-2xs hover:scale-102 cursor-pointer"
                  style={{
                    backgroundColor: theme.subpanelBg,
                    borderColor: theme.border,
                    color: theme.textDark
                  }}
                  title="一鍵套用官方經典職業搭配（職業、特技、屬性骰、裝備配置）"
                >
                  <GiSparkles className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
                  <span>套用經典職業搭配</span>
                </button>
              </div>

              {/* 角色肖像與頭像上傳 (參照 NPC 工坊規格) */}
              <CharacterAvatarUploader
                character={character}
                onChange={onChange}
                theme={theme}
                onToast={showToast}
              />

              {/* 姓名不在這裡——原書第 8 步把它放在最後，見分頁 6「命名與背景」 */}

              {/* 角色等級：由開卡規則決定（GM 在「此團開卡規則」設定起始等級）。
                  ※ **刻意做成唯讀**——升級走跑團面板的「經驗升級」（消耗 10 EXP，
                  見 CharacterPlayHUD）。以前這裡是可輸入的數字框，玩家會誤以為可以自己調，
                  而實際上那是 GM 在規則面板調的東西。 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold" style={{ color: theme.textDark }}>
                    角色等級
                  </label>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors"
                    style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                  >
                    由開卡規則決定
                  </span>
                </div>
                <div
                  className="w-full rounded-lg px-3 py-2 text-xs border shadow-sm font-mono font-bold flex items-center justify-between gap-2"
                  style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                >
                  <span>{character.level || rules.startingLevel} 級</span>
                  <span className="text-[10px] font-sans font-normal" style={{ color: theme.textMuted }}>
                    升級請用跑團面板的「經驗升級」
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold" style={{ color: theme.textDark }}>
                    身份
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsIdentityModalOpen(true)}
                      className="text-[11px] px-2.5 py-1 rounded border font-bold transition-colors flex items-center gap-1.5 shadow-2xs hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                      title="點開查看官方 60 種身分、40 種特質與 20 種細節對照表 (d6+d20)"
                    >
                      <GiSpellBook className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      <span>靈感對照表</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = generateRandomIdentity();
                        updateField('identity', newId);
                      }}
                      className="text-[11px] px-2 py-1 rounded border font-bold transition-colors flex items-center gap-1 shadow-2xs hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                      title="投擲 1d6+1d20 隨機生成身份"
                    >
                      <GiRollingDices className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      <span>隨機</span>
                    </button>
                  </div>
                </div>
                <JRPGInput
                  value={character.identity || ''}
                  onChange={e => updateField('identity', e.target.value)}
                  placeholder="例：失去記憶的原帝國魔導兵、被神明驅逐的聖樂使"
                  theme={theme}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold" style={{ color: theme.textDark }}>
                        主題
                      </label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer font-medium select-none" style={{ color: theme.textMuted }}>
                        <input
                          type="checkbox"
                          checked={isCustomTheme}
                          onChange={e => {
                            const checked = e.target.checked;
                            setIsCustomTheme(checked);
                            if (!checked && !CANONICAL_THEMES.includes(normalizeTheme(character.theme))) {
                              // 從自訂切回清單時**不代選**——退回「請選擇主題」，讓玩家自己挑
                              updateField('theme', '');
                            }
                          }}
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                          style={{ accentColor: theme.accent }}
                        />
                        <span>自訂</span>
                      </label>
                    </div>
                    {isCustomTheme ? (
                      <JRPGInput
                        value={character.theme || ''}
                        onChange={e => updateField('theme', e.target.value)}
                        placeholder="例：救贖、追尋..."
                        theme={theme}
                      />
                    ) : (
                      <select
                        value={normalizeTheme(character.theme)}
                        onChange={e => updateField('theme', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-xs outline-none shadow-sm border cursor-pointer"
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                      >
                        {/* 主題預設是空的——**不替玩家先選一個**。原書 p.158 說「如果這是你的
                            第一位角色，強烈建議你從下面的列表選擇」，那是建議玩家選，不是系統代選。 */}
                        <option value="">請選擇主題</option>
                        {CANONICAL_THEMES.map(tName => (
                          <option key={tName} value={tName}>{tName}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <JRPGInput
                    label="故鄉"
                    value={character.origin || ''}
                    onChange={e => updateField('origin', e.target.value)}
                    placeholder="例：浮空島王國、千年翡翠古林"
                    theme={theme}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* 初始持有金幣：由開卡規則決定（GM 在「此團開卡規則」設定起始金額），
                      或由「擲 2d6 × 10」／官方經典職業搭配一次寫入。
                      ※ **刻意做成唯讀**——玩家在跑團中花錢、賺錢是跑團面板的事，
                      這裡不該是一個可以隨手改的數字框。 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold" style={{ color: theme.textDark }}>
                        初始持有金幣
                      </label>
                      <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                        由開卡規則決定
                      </span>
                    </div>
                    <div
                      className="w-full rounded-lg px-3 py-2 text-xs border shadow-sm font-mono font-bold"
                      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                    >
                      {character.zenit !== undefined ? character.zenit : rules.startingZenit} z
                    </div>
                  </div>
                  <JRPGInput
                    label="初始物語點"
                    type="number"
                    value={character.fabulaPoints !== undefined ? character.fabulaPoints : 3}
                    onChange={e => updateField('fabulaPoints', parseInt(e.target.value, 10) || 3)}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: 四維屬性 ====================
              排在職業之後：原書的順序是先選職業（第 4 步）再分配屬性（第 5 步），
              且 p.162 明說分配屬性骰時要考慮職業與技能的選擇。 */}
          {activeTab === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h4 className="font-serif font-black text-lg flex items-center gap-2" style={{ color: theme.textDark }}>
                  <span style={{ color: theme.accent }}>3.</span> 四維基礎屬性骰配置
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  四維屬性代表骰子面數（d6~d12），將骰子分配至各項體質。
                </p>
              </div>

              {/* 2x2 四宮格拖曳分配矩陣 */}
              <AttributeMatrixPicker
                attributes={character.attributes || { dex: 8, ins: 8, mig: 8, wlp: 8 }}
                remainingUpgrades={remainingDieUpgrades}
                onChange={(newAttrs) => {
                  onChange({
                    ...character,
                    attributes: newAttrs,
                    updatedAt: new Date().toISOString()
                  });
                }}
                theme={theme}
              />
            </div>
          )}

          {/* ==================== TAB 2: 職業與技能 ==================== */}
          {activeTab === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h4 className="font-serif font-black text-lg flex items-center gap-2" style={{ color: theme.textDark }}>
                  <span style={{ color: theme.accent }}>2.</span> 職業組合與技能加點
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  起始 {rules.startingLevel} 級必須分配在 {rules.classCountMin}~{rules.classCountMax} 個不同職業中，每級獲得 1 點技能。
                </p>
              </div>

              {/* Sourcebook Expansion Toggles */}
              <div
                className="p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 transition-colors"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
              >
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.textDark }}>
                  <GiSpellBook className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                  官方拓展職業:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 公測修訂不在這裡——它是開卡規則的【開放公測修訂內容】開關（§BE） */}
                  {Object.keys(SOURCEBOOKS)
                    .filter((sbKey) => sbKey !== PLAYTEST_SOURCEBOOK_KEY)
                    .map(sbKey => {
                      const sb = SOURCEBOOKS[sbKey];
                      const isEnabled = enabledBooks.includes(sbKey);

                      return (
                        <button
                          key={sbKey}
                          type="button"
                          onClick={() => toggleSourcebook(sbKey)}
                          className="text-xs px-2.5 py-1 rounded-lg border font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                          style={
                            isEnabled
                              ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#ffffff' }
                              : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
                          }
                        >
                          {isEnabled ? <GiCheckMark className="w-3 h-3" /> : null}
                          <span>{sb.shortName}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Level Budget Guard Bar */}
              <div
                className="p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-colors"
                style={
                  stats.isLevelMatched
                    ? { backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }
                    : { backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }
                }
              >
                <span>
                  已分配技能: <strong>{stats.totalSkillLevels}</strong> / {getCharacterLevel(character)} 級
                </span>
                <span className="flex items-center gap-1">
                  {stats.isLevelMatched ? (
                    <>
                      <GiCheckMark className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      <span>分配完整</span>
                    </>
                  ) : (
                    <>
                      <GiHazardSign className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      <span>
                        {stats.totalSkillLevels < (getCharacterLevel(character))
                          ? `尚缺 ${(getCharacterLevel(character)) - stats.totalSkillLevels} 點`
                          : `超出 ${stats.totalSkillLevels - (getCharacterLevel(character))} 點`}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Action Bar */}
              <div
                className="flex items-center justify-between p-3.5 rounded-xl border transition-colors flex-wrap gap-2"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    目前已選擇 <strong className="font-mono text-sm" style={{ color: theme.accent }}>{(character.classes || []).length}</strong> 個職業
                    {character.level <= rules.startingLevel && <span className="text-[11px] text-slate-500 ml-1">（創角規定：{rules.classCountMin}~{rules.classCountMax} 個職業）</span>}
                  </span>
                </div>

                <JRPGButton
                  variant={theme.buttonVariant || 'primary'}
                  size="sm"
                  icon={Plus}
                  onClick={() => setIsClassPickerOpen(true)}
                  disabled={locked || ((character.classes || []).length >= rules.classCountMax && (character.level || rules.startingLevel) <= rules.startingLevel)}
                  title={locked ? '已定稿——新增職業屬創角決定，請先解除定稿' : undefined}
                >
                  選擇職業
                </JRPGButton>
              </div>

              {/* Configured Classes & Skills */}
              <div className="space-y-4">
                {(!character.classes || character.classes.length === 0) ? (
                  <div
                    className="p-8 rounded-2xl border border-dashed text-center space-y-3"
                    style={{ borderColor: theme.border, backgroundColor: theme.panelBg }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center border shadow-xs"
                      style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.accent }}
                    >
                      <GiBroadsword size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-serif font-black text-sm text-slate-800">尚未選擇任何職業</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        《Fabula Ultima》開局角色需要在 {rules.classCountMin}~{rules.classCountMax} 個職業中探索分配起始 {rules.startingLevel} 級。
                      </p>
                    </div>
                    <JRPGButton
                      variant={theme.buttonVariant || 'primary'}
                      size="sm"
                      icon={Plus}
                      onClick={() => setIsClassPickerOpen(true)}
                      disabled={locked}
                      title={locked ? '已定稿——新增職業屬創角決定，請先解除定稿' : undefined}
                    >
                      選擇職業
                    </JRPGButton>
                  </div>
                ) : (
                  (character.classes || []).map((cl, cIdx) => (
                    <ClassSkillCard
                      key={cl.className}
                      classItem={cl}
                      classIndex={cIdx}
                      character={character}
                      theme={theme}
                      isInitialEdit={newlyAddedClassName === cl.className}
                      onUpdateSkills={handleUpdateClassSkills}
                      onUpdateClassBenefit={handleUpdateClassBenefit}
                      onRemoveClass={handleRemoveClass}
                      onUpdateCharacter={onChange}
                    />
                  ))
                )}
              </div>

              {/* 開局自選阿爾卡納：只在角色真的持有【綁定和召喚】時出現（見 ArcanistStarterBinding） */}
              <ArcanistStarterBinding character={character} onChange={onChange} locked={locked} />

              {/* 職業選擇器彈窗 */}
              <ClassPickerModal
                isOpen={isClassPickerOpen}
                onClose={() => setIsClassPickerOpen(false)}
                theme={theme}
                enabledBooks={enabledBooks}
                onToggleSourcebook={toggleSourcebook}
                existingClassNames={(character.classes || []).map(c => c.className)}
                onSelectClasses={handleSelectClassesFromPicker}
                onSetSourcebooks={setEnabledSourcebooks}
                budgetUsed={usedSkillLevels}
                creationRules={rules}
                locked={locked}
              />
            </div>
          )}

          {/* ==================== TAB 4: 裝備配置 ==================== */}
          {activeTab === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h4 className="font-serif font-black text-lg flex items-center gap-2" style={{ color: theme.textDark }}>
                  <span style={{ color: theme.accent }}>4.</span> 裝備配置
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  以目前的四維骰即時換算期望命中、期望傷害與防禦結果；不能裝備的原因直接標在選項上。
                </p>
              </div>

              {/* 即時結算：裝備一改，這三個數字就是玩家最在意的結果 */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'def', label: '物理防禦', value: stats.def, icon: GiRoundShield },
                  { key: 'mdef', label: '魔法防禦', value: stats.mdef, icon: GiCrystalBall },
                  { key: 'init', label: '先攻修正', value: stats.init, icon: GiPocketWatch }
                ].map((tile) => {
                  const TileIcon = tile.icon;
                  return (
                    <div
                      key={tile.key}
                      className="rounded-xl border p-2.5 flex items-center gap-2.5"
                      style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                    >
                      <span
                        className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                        style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.accent }}
                      >
                        <TileIcon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold truncate" style={{ color: theme.textMuted }}>
                          {tile.label}
                        </div>
                        <div className="font-mono font-black text-lg leading-tight" style={{ color: theme.textDark }}>
                          {stats.attributesUnset
                            ? '—'
                            : (tile.key === 'init' && tile.value > 0 ? `+${tile.value}` : tile.value)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Proficiencies Indicator */}
              <div
                className="p-3 rounded-xl border flex items-center justify-between text-xs flex-wrap gap-2"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
              >
                <span className="font-bold" style={{ color: theme.textDark }}>職業裝備熟練度:</span>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-bold border"
                    style={stats.profs.martialMelee ? { backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark } : { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', color: '#64748b' }}
                  >
                    職業近戰 {stats.profs.martialMelee ? '✓' : '✗'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-bold border"
                    style={stats.profs.martialRanged ? { backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark } : { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', color: '#64748b' }}
                  >
                    職業遠程 {stats.profs.martialRanged ? '✓' : '✗'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-bold border"
                    style={stats.profs.martialArmor ? { backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark } : { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', color: '#64748b' }}
                  >
                    職業防具 {stats.profs.martialArmor ? '✓' : '✗'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-bold border"
                    style={stats.profs.martialShields ? { backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark } : { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', color: '#64748b' }}
                  >
                    職業盾牌 {stats.profs.martialShields ? '✓' : '✗'}
                  </span>
                </div>
              </div>

              {/* 500 Zenit Starting Budget Tracker */}
              <div
                className="p-3 rounded-xl border space-y-2 shadow-2xs"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
              >
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 font-bold" style={{ color: theme.textDark }}>
                    <GiCoins className="w-4 h-4" style={{ color: theme.accent }} />
                    <span>起始裝備預算 {rules.startingZenit}z</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span>已花費: <strong style={{ color: theme.accent }}>{totalEquipCost}z</strong> / {rules.startingZenit}z</span>
                    <span className={remainingBudget < 0 ? 'text-red-700 font-bold' : 'font-bold'} style={remainingBudget >= 0 ? { color: theme.accent } : undefined}>
                      剩餘: {remainingBudget}z
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t flex-wrap gap-2 text-xs" style={{ borderColor: `${theme.border}80` }}>
                  <span className="text-xs text-slate-500">
                    剩餘預算 + 2d6 × 10 結算為開局金幣
                  </span>
                  <button
                    type="button"
                    onClick={handleRollStartingZenit}
                    className="px-2.5 py-1 rounded-lg border text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                    style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                  >
                    <GiRollingDices className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                    <span>擲 2d6 × 10 結算</span>
                  </button>
                </div>
              </div>

              {/* 載入衝突：規則上明確不成立的組合，選完立刻看得到，不用等跑團才被 GM 抓 */}
              {loadoutIssues.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs space-y-1">
                  {loadoutIssues.map((issue, idx) => (
                    <div key={`${issue.message}_${idx}`} className="flex items-center gap-1.5">
                      <GiHazardSign className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 四個槽位：每格直接顯示「這一格換算成什麼」，要比較時才開選擇彈窗。
                  主手換成雙手武器時，這張卡會平滑長成滿版、並把副手格吃進來（虛線佔位），
                  讓「這件武器佔了兩隻手」是看得見的事實，而不是一行要自己讀的警告。 */}
              <div className="flex flex-wrap gap-3 items-stretch">
                <div
                  className="min-w-0"
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: mainTakesBothHands ? '100%' : 'calc(50% - 0.375rem)',
                    minWidth: 'min(100%, 250px)',
                    transition: 'flex-basis 340ms cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <EquipmentSlotCard
                    theme={theme}
                    slotDef={EQUIPMENT_SLOTS.mainHand}
                    itemName={mainHandLabel}
                    itemIcon={mainHandIcon}
                    itemMissing={mainHandMissing}
                    badges={mainHandBadges}
                    metrics={mainHandMetrics}
                    note={mainHandNote}
                    warning={mainHandWarning}
                    mergedNote={mainTakesBothHands ? '被主手佔用（雙手武器）' : null}
                    onOpen={() => setPickerSlot('mainHand')}
                  />
                </div>

                {!mainTakesBothHands && (
                  <div
                    className="min-w-0"
                    style={{
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 'calc(50% - 0.375rem)',
                      minWidth: 'min(100%, 250px)'
                    }}
                  >
                    <EquipmentSlotCard
                      theme={theme}
                      slotDef={EQUIPMENT_SLOTS.offHand}
                      itemName={offHandLabel}
                      itemIcon={offHandIcon}
                      itemMissing={offHandMissing}
                      badges={offShield?.martial ? [{ label: '職業', variant: 'rose' }] : []}
                      metrics={offHandMetrics}
                      note={offShield?.desc || null}
                      warning={offHandWarning}
                      onOpen={() => setPickerSlot('offHand')}
                    />
                  </div>
                )}

                <div
                  className="min-w-0"
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 'calc(50% - 0.375rem)',
                    minWidth: 'min(100%, 250px)'
                  }}
                >
                  <EquipmentSlotCard
                    theme={theme}
                    slotDef={EQUIPMENT_SLOTS.armor}
                    itemName={armorLabel}
                    itemIcon={armorIcon}
                    itemMissing={armorMissing}
                    badges={armor?.martial ? [{ label: '職業', variant: 'rose' }] : []}
                    metrics={armorMetrics}
                    note={armor?.desc || null}
                    warning={armorWarningText}
                    onOpen={() => setPickerSlot('armor')}
                  />
                </div>

                <div
                  className="min-w-0"
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 'calc(50% - 0.375rem)',
                    minWidth: 'min(100%, 250px)'
                  }}
                >
                  <EquipmentSlotCard
                    theme={theme}
                    slotDef={EQUIPMENT_SLOTS.accessory}
                    itemName={accessoryLabel}
                    itemIcon="slot_accessory"
                    itemMissing={accessoryMissing}
                    badges={accessory ? [{ label: '稀有物品', variant: 'zinc' }] : []}
                    metrics={[]}
                    note={accessory?.desc || '飾品在原書中一律屬稀有物品，需與團員討論後取得。'}
                    onOpen={() => setPickerSlot('accessory')}
                  />
                </div>
              </div>

              {/* 定制武器（高度奇幻手冊 p.106 的選用規則）——只在規則開放時出現 */}
              <div className="p-3 rounded-lg border space-y-2" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <GameIcon name="cat_sword" size={16} />
                    <span className="text-xs font-bold" style={{ color: theme.textDark }}>{CUSTOM_WEAPON_BASE.label}</span>
                    <span className="text-[11px] text-slate-500">
                      {customWeaponGroups.length > 0 ? `${customWeaponGroups.length} 把` : '尚未鍛造'}
                    </span>
                  </div>
                  {rules.allowCustomWeapon ? (
                    <button
                      type="button"
                      onClick={() => { setForgeEditingId(''); setIsForgeOpen(true); }}
                      className="px-2.5 py-1 rounded-lg border text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                      style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                    >
                      <GiAnvil className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      <span>鍛造{CUSTOM_WEAPON_BASE.label}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      此團未開放——請在第 1 步的「此團開卡規則」打開
                    </span>
                  )}
                </div>

                {customWeaponGroups.length > 0 && (
                  <div className="space-y-1.5">
                    {customWeaponGroups.map((group) => {
                      // 可變形的兩個型態是**同一把武器**（原書 p.107：只有一個特性，兩型態共用）。
                      // 規格層存成兩筆只是因為兩個型態各自要有類別／命中／傷害，
                      // 介面照規格層分兩列的話，玩家看到的會是「兩把武器」——那不對。
                      const idx = equippedFormIndex(group, character.equipment?.mainHand);
                      const isEquipped = idx >= 0;
                      const shown = isEquipped ? group.forms[idx] : group.forms[0];
                      const other = group.isTransforming ? nextFormFor(group, character.equipment?.mainHand) : null;
                      return (
                        <div
                          key={group.id}
                          className="flex items-center gap-2 p-2 rounded-lg border text-xs"
                          style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }}
                        >
                          <GameIcon name={CATEGORY_ICON[shown.category] || 'cat_sword'} size={16} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold" style={{ color: theme.textDark }}>{group.name}</span>
                              {group.isTransforming && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.textDark }}>
                                  可變形
                                </span>
                              )}
                              {shown.martial && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.accent }}>
                                  職業武器
                                </span>
                              )}
                              {isEquipped && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.accent }}>
                                  已裝備主手
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] truncate" style={{ color: theme.textDark }}>
                              {group.isTransforming && (
                                <span className="font-bold">〔{idx === 0 ? '形態一' : idx === 1 ? '形態二' : '未裝備'}〕</span>
                              )}
                              {describeCustomWeapon(shown)}
                            </p>
                          </div>
                          {isEquipped && other ? (
                            // 已裝備的可變形武器：一顆按鈕切換形態（原書：衝突中每回合一次）
                            <button
                              type="button"
                              onClick={() => handleEquipCustomWeapon(other.name)}
                              title="衝突場景中只能在你的回合、且每回合一次（HF p.107）"
                              className="px-2 py-1 rounded border text-[11px] font-bold shrink-0 cursor-pointer"
                              style={{ borderColor: theme.border, color: theme.accent }}
                            >
                              切換形態
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEquipCustomWeapon(shown.name)}
                              className="px-2 py-1 rounded border text-[11px] font-bold shrink-0 cursor-pointer"
                              style={{ borderColor: theme.border, color: theme.textDark }}
                            >
                              裝到主手
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setForgeEditingId(group.id); setIsForgeOpen(true); }}
                            className="px-2 py-1 rounded border text-[11px] font-bold shrink-0 cursor-pointer"
                            style={{ borderColor: theme.border, color: theme.textDark }}
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomWeapon(group.id)}
                            className="px-2 py-1 rounded border text-[11px] font-bold shrink-0 cursor-pointer"
                            style={{ borderColor: theme.border, color: '#9f1239' }}
                          >
                            刪除
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 裝備選擇彈窗 */}
              <EquipmentPickerModal
                isOpen={pickerSlot !== null}
                slot={pickerSlot || 'mainHand'}
                onClose={() => setPickerSlot(null)}
                theme={theme}
                character={character}
                stats={stats}
                remainingBudget={pickerBudget}
                onSelect={(name) => {
                  if (!pickerSlot) return;
                  // 換上雙手武器時副手必須空出——由規則層判定，這裡只負責提示與記錄
                  const { equipment: nextEquipment, clearedOffHand } = applyEquipmentChoice(
                    character.equipment,
                    pickerSlot,
                    name,
                    weaponByName
                  );
                  const base = {
                    ...character,
                    equipment: nextEquipment,
                    updatedAt: new Date().toISOString()
                  };
                  const changes = [{
                    field: pickerSlot,
                    from: character.equipment?.[pickerSlot] || '',
                    to: name
                  }];
                  if (clearedOffHand) {
                    changes.push({ field: 'offHand', from: clearedOffHand, to: '無盾牌' });
                  }
                  onChange(loggableChange(character, base, {
                    kind: 'equipment',
                    title: `更換${EQUIPMENT_SLOTS[pickerSlot].label}`,
                    changes
                  }));
                  if (clearedOffHand && showToast) {
                    showToast(`已卸下副手「${clearedOffHand}」——雙手武器佔滿兩個手部欄位`);
                  }
                }}
              />
            </div>
          )}

          {/* 定制武器鍛造台（HF p.106）：與裝備挑選器並列，只在裝備分頁渲染 */}
          <CustomWeaponForgeModal
            isOpen={isForgeOpen}
            onClose={() => setIsForgeOpen(false)}
            theme={theme}
            character={character}
            editingId={forgeEditingId}
            onSave={handleSaveCustomWeapons}
          />

          {/* ==================== TAB 5: 英雄技能與特質 ==================== */}
          {activeTab === 5 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h4 className="font-serif font-black text-lg flex items-center gap-2" style={{ color: theme.textDark }}>
                  <span style={{ color: theme.accent }}>5.</span> 英雄技能與特質
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  精通職業後解鎖英雄技能，並可設定特質。
                </p>
              </div>

              {/* 金手指特質：開卡規則沒開就直接整塊收掉。
                  ※ 沒開的話清單裡只剩「無特殊金手指」，留一個只能選「無」的下拉是純噪音
                  （見 §U 的「不能選的原因要在選之前看見」——那是對**選項**的要求；
                  整條規則關閉時，這個入口本身就不該存在）。 */}
              {rules.allowQuirk && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-bold" style={{ color: theme.textDark }}>
                      金手指
                    </label>
                    <JRPGButton
                      variant={theme.outlineButtonVariant || 'outline'}
                      size="xs"
                      icon={GiSparkles}
                      onClick={() => setIsQuirkPickerOpen(true)}
                    >
                      {character.quirk && character.quirk !== '無' ? '更換金手指' : '選擇金手指'}
                    </JRPGButton>
                  </div>

                  {character.quirk && character.quirk !== '無' ? (
                    <div
                      className="rounded-xl p-3 border space-y-1.5 shadow-2xs"
                      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.accent }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif font-black text-sm" style={{ color: theme.textDark }}>
                          {character.quirk}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateField('quirk', '無')}
                          className="text-[11px] text-slate-400 hover:text-red-700 cursor-pointer"
                        >
                          移除
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {splitParagraphs(rulesData.quirks.find(q => q.name === character.quirk)?.desc).map((block, bi) => (
                          <div key={bi} className="space-y-0.5">
                            {block.map((line, li) => (
                              <p key={li} className="text-[11px] leading-relaxed" style={{ color: theme.textDark }}>
                                {renderTextWithAffinities(line)}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px]" style={{ color: theme.textMuted }}>
                      尚未選擇。金手指是選用規則（三大奇幻手冊才推出）——不選也完全可以。
                    </p>
                  )}
                </div>
              )}

              {/* 英雄技能：開卡規則沒開「開局英雄技能」、又還沒精通任何職業時，這裡
                  **完全沒有可做的事**——原書 p.232 的取得條件是「將一個職業提升到 10 級」，
                  5 級開卡根本到不了。留一個按了也只會被停用的入口只是噪音，所以整塊收掉
                  （使用者要求：「開卡規則沒有允許金手指或開局英雄技能，就直接把第 5 頁的
                  按鈕都隱藏」）。升級到精通之後它會自己回來——那時才真的有東西可選。
                  個別技能另有指定的職業與等級前提，不合格的選項直接停用並寫出原因。 */}
              {(rules.startingHeroicSkill || stats.masteredClasses.length > 0) && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-bold" style={{ color: theme.textDark }}>
                    英雄技能
                  </label>
                  <span className="flex items-center gap-2 flex-wrap">
                    {stats.masteredClasses.length > 0 ? (
                      <span className="text-xs font-bold font-mono" style={{ color: theme.textDark }}>
                        已精通職業: {stats.masteredClasses.join('、')} 【具備英雄技能資格】
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold" style={{ color: '#b45309' }}>
                        需先精通一個職業（單一職業達 10 級）
                      </span>
                    )}
                    {rules.startingHeroicSkill && (
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: creationSlotFull ? '#b45309' : theme.accent }}
                      >
                        開局名額：{creationSlotFull ? '已使用' : '還有一個'}
                      </span>
                    )}
                  </span>
                </div>

                {rules.startingHeroicSkill && (
                  <p className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
                    此團使用官方選用規則「開局贈送一個英雄技能」（Playtest Materials 2026-10-01）：
                    開局可多拿一個，但第一次因精通職業而該拿到英雄技能時改為不拿。
                    標著 ◈ 的技能靠這個名額取得（需要該職業，但不必精通）。
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {/* 舊版這裡是一個 `<select>` ＋「添加」鈕：條件與效果都看不到，158 筆擠在
                      一個下拉裡也沒辦法過濾。改成開表格（見 HeroicSkillPickerModal）。
                      **不因為「沒精通」而停用**——停用等於看不到有哪些技能可以往哪走；
                      表格會逐列寫出「為什麼現在不能選」。
                      **定稿後整個入口收起來**（使用者裁定：目錄是創角輔助；已經拿到的技能
                      在下面的清單與角色卡／跑團面板照常顯示）。 */}
                  {!locked && (
                    <>
                      <JRPGButton
                        variant={theme.buttonVariant || 'primary'}
                        size="xs"
                        icon={GiLaurelCrown}
                        onClick={() => setIsHeroicPickerOpen(true)}
                      >
                        選擇英雄技能
                      </JRPGButton>
                      <span className="text-[11px]" style={{ color: theme.textMuted }}>
                        表格列出每一條的條件與效果，預設只顯示與你的職業有關的
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  {(character.heroicSkills || []).map((hs, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg p-3 border text-xs flex items-start justify-between gap-3 shadow-sm"
                      style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-1.5" style={{ color: theme.textDark }}>
                          <GiLaurelCrown className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
                          <span>{hs.name}</span>
                          {heroicSourceOf(hs) && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0"
                              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textMuted }}
                            >
                              {heroicSourceOf(hs)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{renderTextWithAffinities(hs.effect)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateField('heroicSkills', character.heroicSkills.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-400 hover:text-red-700 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* 個人誓約命刻：**已移除**（2026-10-06 使用者裁定）。
                  原書的創角八步驟（p.154）沒有命刻這一項——命刻是**跑團中**由 GM 用來追蹤
                  進度的工具（Core 的 Clocks 規則），不是開卡時要玩家自己種幾座的東西。
                  跑團面板的「個人命刻」分頁仍然保留，那裡才是它的位置。 */}
            </div>
          )}

          {/* ==================== TAB 6: 命名與背景 ====================
              原書第 8 步（p.154）：「描述你的角色並選擇名字和稱呼」。
              p.170 說明了為什麼放在最後——「先掌握了角色的外貌與能力，取名就容易多了」。
              官方角色卡上與姓名並排的那一格是「稱呼」，本專案依使用者裁定改為**性別**；
              原書同一步的「外貌描述」改為**角色背景**（頭像已由分頁 1 的頭像上傳承載）。 */}
          {activeTab === 6 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h4 className="font-serif font-black text-lg flex items-center gap-2" style={{ color: theme.textDark }}>
                  <span style={{ color: theme.accent }}>6.</span> 命名與背景
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  最後一步。看過職業、屬性與裝備之後再取名字，通常比一開始就想容易得多。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <JRPGInput
                  label="角色姓名"
                  value={character.name || ''}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="例：雷恩"
                  theme={theme}
                />
                <JRPGInput
                  label="性別"
                  value={character.gender || ''}
                  onChange={e => updateField('gender', e.target.value)}
                  placeholder="例：女"
                  theme={theme}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold" style={{ color: theme.textDark }}>
                  角色背景
                </label>
                <textarea
                  value={character.background || ''}
                  onChange={e => updateField('background', e.target.value)}
                  rows={7}
                  placeholder="他從哪裡來、經歷過什麼、為什麼會走上這條路……（NPC 工坊也有一格同樣用途的「背景故事」）"
                  className="w-full rounded-lg px-3.5 py-2.5 text-xs outline-none shadow-sm border leading-relaxed resize-y"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                />
              </div>
            </div>
          )}
          </fieldset>
          </ErrorBoundary>

          {/* 英雄技能選擇器（表格式：條件與效果全文 ＋ 過濾）。
              ※ **必須掛在這裡（`fieldset` 外面、不分頁）**——它原本被我放在 `activeTab === 2`
              的區塊裡，於是在第 5 步按「選擇英雄技能」只改了 state、彈窗根本沒掛載，
              要切回第 2 頁才會冒出來。使用者回報「按了沒有直接跳出技能視窗」。 */}
          <HeroicSkillPickerModal
            isOpen={isHeroicPickerOpen}
            onClose={() => setIsHeroicPickerOpen(false)}
            character={character}
            rules={rules}
            stats={stats}
            theme={theme}
            slotBlocked={creationSlotFull}
            onPick={(skill) => {
              updateField('heroicSkills', [...(character.heroicSkills || []), skill]);
            }}
          />

          {/* 金手指選擇器：只列題目，點進去看細節。與英雄技能同一個理由掛在最外層。 */}
          <QuirkPickerModal
            isOpen={isQuirkPickerOpen}
            onClose={() => setIsQuirkPickerOpen(false)}
            theme={theme}
            selectedName={character.quirk === '無' ? '' : (character.quirk || '')}
            onPick={(q) => updateField('quirk', q.name)}
            onClear={() => updateField('quirk', '無')}
          />

          {/* Wizard Footer Navigation Bar */}
          <div className="pt-5 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: theme.border }}>
            <button
              type="button"
              disabled={activeTab <= 1}
              onClick={() => setActiveTab(prev => Math.max(1, prev - 1))}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              style={{ borderColor: theme.border, color: theme.textDark }}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>上一步</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsCardPreviewModalOpen(true)}
                className="px-4 py-2 rounded-lg border bg-white hover:bg-slate-50 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                style={{ borderColor: theme.border, color: theme.textDark }}
                title="唯讀：看這張卡目前長什麼樣，也可以列印、截圖或匯出成 PNG／PDF"
              >
                <GiScrollUnfurled className="w-4 h-4" style={{ color: theme.accent }} />
                <span>卡片預覽</span>
              </button>

              {activeTab < TABS.length ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(prev => Math.min(TABS.length, prev + 1))}
                  className="px-5 py-2 rounded-lg text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  style={{ backgroundColor: theme.accent }}
                >
                  <span>下一步</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                onEnterPlayMode && (
                  <JRPGButton
                    variant={theme.buttonVariant || 'primary'}
                    size="md"
                    icon={Play}
                    onClick={onEnterPlayMode}
                  >
                    完成創角，進入跑團面板
                  </JRPGButton>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Character Card View Modal（抽成元件，跑團面板也能開同一個） */}
      <CharacterPreviewModal
        isOpen={isCardPreviewModalOpen}
        onClose={() => setIsCardPreviewModalOpen(false)}
        character={character}
        stats={stats}
        theme={theme}
        themeId={themeId}
        showToast={showToast}
        closeLabel="返回編輯"
        secondaryAction={onEnterPlayMode ? { label: '進入跑團實戰', onClick: onEnterPlayMode } : null}
        onAvatarClick={() => {
          setIsCardPreviewModalOpen(false);
          setActiveTab(1);
        }}
      />


      {/* Starter Presets Modal */}
      <StarterPresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        theme={theme}
        onApply={handleApplyPreset}
      />

      {/* Validation Checklist Drawer / Modal */}
      <JRPGModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        title="創角完整度自檢清單"
        maxWidth="max-w-lg"
        theme={theme}
        actionButtons={
          <JRPGButton
            variant={theme.buttonVariant || 'primary'}
            size="sm"
            onClick={() => setIsValidationModalOpen(false)}
          >
            我知道了，關閉
          </JRPGButton>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed -mt-1">
            本清單為輔助提醒，未填寫項<strong>不會強制阻擋</strong>您的儲存或跑團，您可以隨時返回修改。
          </p>

          <div className="space-y-2">
            {validation.warnings.map((w, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setActiveTab(w.step);
                  setIsValidationModalOpen(false);
                }}
                className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01] shadow-sm ${
                  w.type === 'error'
                    ? 'border-red-300 bg-red-50 text-red-900'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {w.type === 'error' ? (
                    <GiHazardSign className="w-4 h-4 text-red-600 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{w.message}</span>
                </div>
                <span className="font-bold underline shrink-0 text-[11px]">跳轉至步驟 {w.step} ➔</span>
              </div>
            ))}

            {validation.warnings.length === 0 && (
              <div
                className="p-4 rounded-xl border text-center text-xs font-bold flex items-center justify-center gap-2"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
              >
                <GiCheckMark className="w-5 h-5" style={{ color: theme.accent }} />
                <span>恭喜！角色卡所有核心規則與內容完全合規！</span>
              </div>
            )}
          </div>
        </div>
      </JRPGModal>

      {/* Official Identity Tables Inspiration Modal */}
      <IdentityTablesModal
        isOpen={isIdentityModalOpen}
        onClose={() => setIsIdentityModalOpen(false)}
        onSelectIdentity={(idStr) => updateField('identity', idStr)}
        currentIdentity={character.identity || ''}
        theme={theme}
      />
    </div>
  );
}
