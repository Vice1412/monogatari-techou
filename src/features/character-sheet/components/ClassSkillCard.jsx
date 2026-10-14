import React, { useState } from 'react';
import {
  GiSparkles,
  GiCheckMark,
  GiHazardSign,
  GiTrashCan,
  GiUpgrade,
  GiSaveArrow,
  GiQuillInk,
  GiSteeringWheel,
  GiPawPrint,
  GiGears
} from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import JRPGButton from '../../../components/ui/JRPGButton';
import SkillStarPips from './SkillStarPips';
import CoreBookVariantCard from './CoreBookVariantCard';
import {
  getVariantsForClass,
  getVariantById,
  getSkillVariant,
  withSkillVariant,
  resolveSkillDisplay,
  buildSkillEntry
} from '../data/coreBookVariants';
import { resolveCreationRules } from '../data/creationRules';
import SkillDescription from '../utils/skillFormulaEvaluator';
import SkillSuboptionModal from './SkillSuboptionModal';
import SuboptionDetailsList from './SuboptionDetailsList';
import PilotVehicleModal from './companions/PilotVehicleModal';
import WayfarerCompanionModal from './companions/WayfarerCompanionModal';
import TinkererGadgetsModal from './companions/TinkererGadgetsModal';
import {
  getSkillSuboptionConfig,
  calculateSkillSuboptionMax
} from '../data/skillSuboptionsData';
import {
  findFrameById,
  getUnlockedModuleQuota,
  getActiveModuleCapacity
} from '../data/pilotVehicleData';
import {
  calculateCompanionMaxHp,
  createDefaultCompanionData
} from '../data/wayfarerCompanionData';
import { getClassInfo } from '../data/sourcebookConfig';
import { isHpMpChoiceBenefit, getCharacterLevel } from '../utils/characterEngine';
import rulesData from '../data/rulesData.json';
import { withEn } from '../../../utils/properNouns';

/**
 * 子項目狀態與配置條 (SkillSuboptionBar)
 */
function SkillSuboptionBar({
  className,
  skillName,
  sl,
  selectedOptions = [],
  onOpenModal
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getSkillSuboptionConfig(className, skillName);
  if (!config || sl <= 0) return null;

  const maxQuota = calculateSkillSuboptionMax(className, skillName, sl);

  // 整理顯示清單
  let selectedList = [];
  let selectedCount = 0;
  if (Array.isArray(selectedOptions)) {
    selectedList = selectedOptions;
    selectedCount = selectedOptions.length;
  } else if (selectedOptions && typeof selectedOptions === 'object') {
    const keys = selectedOptions.keys || [];
    const tones = selectedOptions.tones || [];
    selectedList = [
      ...keys.map(k => `音調: ${k}`),
      ...tones.map(t => `曲風: ${t}`)
    ];
    selectedCount = keys.length + tones.length;
  }

  const isComplete = selectedCount === maxQuota;
  const isOver = selectedCount > maxQuota;
  const isUnder = selectedCount < maxQuota;

  return (
    <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* 配額狀態指示徽章 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedCount === 0 ? (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-dashed border-slate-300 font-bold">
              尚未配置任何項目
            </span>
          ) : isComplete ? (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1">
              <GiCheckMark className="w-3 h-3 text-emerald-700" />
              <span>已掌握 {selectedCount} / {maxQuota}（已完成構築）</span>
            </span>
          ) : isOver ? (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-bold flex items-center gap-1">
              <GiHazardSign className="w-3 h-3 text-rose-700" />
              <span>已掌握 {selectedCount} / {maxQuota}（超出 {selectedCount - maxQuota} 個，請刪減）</span>
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
              <GiSparkles className="w-3 h-3 text-amber-600" />
              <span>已掌握 {selectedCount} / {maxQuota}（尚餘 {maxQuota - selectedCount} 個名額）</span>
            </span>
          )}
        </div>

        {/* 右側按鈕群（展開效果詳情 + 調整按鈕） */}
        <div className="flex items-center gap-1.5">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 shadow-2xs"
            >
              <span>{isExpanded ? '收合效果詳情' : `展開效果詳情 (${selectedCount})`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal();
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              selectedCount === 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                : 'bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs'
            }`}
          >
            <GiQuillInk className="w-3.5 h-3.5" />
            <span>{selectedCount === 0 ? `配置${config.itemTypeTitle}` : `調整${config.itemTypeTitle}`}</span>
          </button>
        </div>
      </div>

      {/* 展開詳情清單 OR 緊湊標籤列 */}
      {selectedCount > 0 ? (
        isExpanded ? (
          <div className="pt-1">
            <SuboptionDetailsList
              className={className}
              skillName={skillName}
              selectedOptions={selectedOptions}
              showVolumeBlock={true}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {selectedList.map((item, idx) => {
              const isOffensiveSpell = (rulesData.spells || []).some(s => s.name === item && s.isOffensive);
              return (
                <span
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                  }}
                  title="點擊展開查看效果詳情"
                  className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                >
                  {isOffensiveSpell ? (
                    <span className="fu-icon text-red-600 font-bold" title="攻擊性咒語">o</span>
                  ) : (
                    <span className="text-amber-500">✦</span>
                  )}
                  <span>{item}</span>
                </span>
              );
            })}
          </div>
        )
      ) : (
        <p className="text-[11px] text-slate-500 italic">
          尚未選擇任何項目。請點擊上方按鈕展開清單完成角色構築。
        </p>
      )}
    </div>
  );
}

/**
 * 機師個人載具狀態與管理條 (PilotVehicleSkillBar)
 */
function PilotVehicleSkillBar({
  sl,
  vehicleData,
  onOpenModal
}) {
  if (sl <= 0) return null;
  const frame = findFrameById(vehicleData?.frameId || 'exoskeleton');
  const unlockedQuota = getUnlockedModuleQuota(sl);
  const activeCapacity = getActiveModuleCapacity(sl);
  const unlockedCount = (vehicleData?.unlockedModules || []).length;
  const activeCount = (vehicleData?.activeModules || []).length;
  const isConfigured = unlockedCount > 0;

  return (
    <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {!isConfigured ? (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-dashed border-slate-300 font-bold">
              尚未配置個人載具
            </span>
          ) : (
            <>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-300 font-bold">
                {frame.name} · {vehicleData?.name || '個人載具'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold">
                解鎖 {unlockedCount}/{unlockedQuota} · 啟用 {activeCount}/{activeCapacity} 槽
              </span>
              {vehicleData?.isMounted && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-600 text-white font-bold">
                  駕駛中
                </span>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal();
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white shadow-2xs"
        >
          <GiSteeringWheel className="w-3.5 h-3.5" />
          <span>{isConfigured ? '管理個人載具' : '配置個人載具'}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 旅人忠實夥伴隨從狀態與編輯條 (WayfarerCompanionSkillBar)
 */
function WayfarerCompanionSkillBar({
  sl,
  companionData,
  characterLevel = 5,
  onOpenModal
}) {
  if (sl <= 0) return null;
  const comp = companionData || createDefaultCompanionData();
  const maxHp = calculateCompanionMaxHp(sl, comp.mig || 8, characterLevel);
  const isConfigured = !!companionData?.species;

  return (
    <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
            {comp.species || '野獸'} · {comp.name || '忠實夥伴'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-green-100 text-green-800 border border-green-300 font-mono font-bold">
            HP {maxHp} · DEF d{comp.dex || 8} | M.DEF d{comp.ins || 8}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal();
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
        >
          <GiPawPrint className="w-3.5 h-3.5" />
          <span>{isConfigured ? '編輯忠實夥伴' : '配置忠實夥伴'}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 修補匠小工具科技樹狀態與管理條 (TinkererGadgetsSkillBar)
 */
function TinkererGadgetsSkillBar({
  sl,
  gadgetsData,
  onOpenModal
}) {
  if (sl <= 0) return null;
  const alchemy = gadgetsData?.alchemy || 0;
  const infusion = gadgetsData?.infusion || 0;
  const magitech = gadgetsData?.magitech || 0;
  const allocated = alchemy + infusion + magitech;
  const isConfigured = allocated > 0;

  const getTierText = (tier) => (tier === 0 ? '無' : tier === 1 ? '基礎' : tier === 2 ? '進階' : '最高');

  return (
    <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {!isConfigured ? (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-dashed border-slate-300 font-bold">
              尚未配置科技樹節點 (可分配 {sl} 點)
            </span>
          ) : (
            <>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                煉金 {getTierText(alchemy)} · 灌注 {getTierText(infusion)} · 魔導 {getTierText(magitech)}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-bold ${
                allocated >= sl
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                已分配 {allocated} / {sl} 節點
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal();
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
        >
          <GiGears className="w-3.5 h-3.5" />
          <span>{isConfigured ? '管理小工具' : '配置科技樹'}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 職業特技管理卡片 (ClassSkillCard)
 * 滿足需求 1, 2, 3 與子項目挑選構築：
 * 1. 中英文名、專屬圖標並存，附帶一目了然的一句話風格描述。
 * 2. 展開點選模式：列出所有特技，Max SL 星星視覺化，點擊變色；點選儲存後恢復簡潔，僅顯示已學習特技。
 * 3. 動態公式求值：未點時顯示計算公式，點亮後自動算好精準數值。
 * 4. 子項目專屬挑選：為 9 大技能提供即時配額標籤與構建抽屜。
 * 5. 獨立實體/載具副卡：為機師【個人載具】與旅人【忠實夥伴】提供專屬配置條與管理彈窗。
 */
export default function ClassSkillCard({
  classItem,
  classIndex,
  character = {},
  theme,
  isInitialEdit = false,
  onUpdateSkills,
  onUpdateClassBenefit,
  onRemoveClass,
  onUpdateCharacter
}) {
  const [isEditing, setIsEditing] = useState(isInitialEdit);

  const className = classItem.className;
  const classInfo = getClassInfo(className);
  const classDef = rulesData.classes[className] || {};
  const allAvailableSkills = classDef.skills || [];

  // 核心書技能變體是**選用**的：只有勾選【官方公測修訂】才顯示（GM 口頭告知的團規則）。
  // ※ 來源是 `character.enabledSourcebooks`，不是 `resolveCreationRules()` 的回傳——
  //   後者**沒有** `enabledSourcebooks` 這個欄位（見 §AV1）。
  const showPlaytestVariants = (
    character?.enabledSourcebooks
    ?? resolveCreationRules(character?.creationRules || {}).defaultSourcebooks
    ?? []
  ).includes('playtest');

  /** 這個技能條目目前選用了哪個變體（沒選回 null）。 */
  const adoptedVariantId = (skillName) => {
    const entry = (classItem.skills || []).find(s => s.name === skillName);
    return entry?.variantId || null;
  };
  /** 某個變體是否正被這個職業的某個技能使用中。 */
  const isVariantAdopted = (variantId) => {
    const v = getVariantById(variantId);
    if (!v) return false;
    return (classItem.skills || []).some(s => s.variantId === variantId);
  };

  /**
   * 選用／取消選用變體。
   *
   * 這裡**直接寫回**（不走 draft），因為選用是「這個技能是哪一版」的決定，
   * 與配點的草稿是兩件事——配點可以按取消放棄，但選用一旦按下就該生效，
   * 否則玩家會以為選了卻沒存到。
   *
   * 三件必須同時做的事：
   *  1. 該技能必須**存在**於 `skills[]`（未配點的技能沒有條目可改）。
   *     若玩家還沒配點就按選用，先幫他建立一個 sl=1 的條目——否則選用無處可存。
   *  2. `sl` 要用新版本的 maxSL 重新夾住（【暴怒】5 ↔【勇猛打手】3）。
   *  3. 選用變體後，**原版技能在這個職業裡就沒有別的條目了**——
   *     因為變體是「取代」原版，`name` 保持不變，所以同一列會顯示變體內容。
   */
  const handleToggleVariant = (skillName, variantId) => {
    const variant = getVariantById(variantId);
    const classSkills = JSON.parse(JSON.stringify(classItem.skills || []));
    const idx = classSkills.findIndex(s => s.name === skillName);
    const rawDef = allAvailableSkills.find(s => s.name === skillName);

    if (idx >= 0) {
      classSkills[idx] = withSkillVariant(classSkills[idx], variantId, { maxSL: rawDef?.maxSL });
    } else {
      // 還沒配點 → 先給他 1 級，否則選用狀態無處可存
      classSkills.push(withSkillVariant(
        { name: skillName, sl: 1, selectedOptions: [] },
        variantId,
        { maxSL: rawDef?.maxSL }
      ));
    }

    onUpdateSkills(classIndex, classSkills);
  };

  // 免費增益二選一：只有「最大 HP 或 最大 MP」的職業需要玩家指定（引擎未指定時預設 HP）
  const isHpMpChoice = isHpMpChoiceBenefit((classDef.freeBenefits || '') + ' ' + (classDef.freeBonus || ''));
  const chosenBenefit = classItem.chosenBenefit || 'HP';

  // 子項目構築彈窗目標特技 { skillName, sl, selectedOptions }
  const [suboptionModalSkill, setSuboptionModalSkill] = useState(null);

  // 個人載具、忠實夥伴與修補匠小工具彈窗狀態
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isCompanionModalOpen, setIsCompanionModalOpen] = useState(false);
  const [isGadgetsModalOpen, setIsGadgetsModalOpen] = useState(false);
  const [currentPilotSl, setCurrentPilotSl] = useState(1);
  const [currentWayfarerSl, setCurrentWayfarerSl] = useState(1);
  const [currentTinkererSl, setCurrentTinkererSl] = useState(1);

  // 暫存的特技配置字典 (用於編輯模式，保存點選狀態)
  const [draftSkills, setDraftSkills] = useState(() => {
    const map = {};
    allAvailableSkills.forEach(sk => {
      const existing = (classItem.skills || []).find(s => s.name === sk.name);
      map[sk.name] = existing ? existing.sl : 0;
    });
    return map;
  });

  // 暫存的子項目配置字典 (用於編輯模式，保存各特技的子項目選項)
  const [draftSuboptions, setDraftSuboptions] = useState(() => {
    const map = {};
    allAvailableSkills.forEach(sk => {
      const existing = (classItem.skills || []).find(s => s.name === sk.name);
      map[sk.name] = existing?.selectedOptions || [];
    });
    return map;
  });

  // 當切換到編輯模式時，同步最新的 classItem.skills
  const handleStartEdit = () => {
    const map = {};
    const subMap = {};
    allAvailableSkills.forEach(sk => {
      const existing = (classItem.skills || []).find(s => s.name === sk.name);
      map[sk.name] = existing ? existing.sl : 0;
      subMap[sk.name] = existing?.selectedOptions || [];
    });
    setDraftSkills(map);
    setDraftSuboptions(subMap);
    setIsEditing(true);
  };

  // 調整特技點數
  const handleSetSkillSL = (skillName, newSL) => {
    setDraftSkills(prev => ({
      ...prev,
      [skillName]: Math.max(0, newSL)
    }));
  };

  // 計算暫存總 SL
  const draftTotalSL = Object.values(draftSkills).reduce((sum, sl) => sum + sl, 0);

  // 儲存配置：僅保留 SL >= 1 的特技，恢復簡潔模式
  const handleSave = () => {
    const activeSkills = [];
    allAvailableSkills.forEach(sk => {
      const sl = draftSkills[sk.name] || 0;
      if (sl > 0) {
        // ※ 這裡是**重建** `skills[]`，所以每一個要保留的欄位都得自己帶上。
        //   忘記帶 `variantId` 的後果是：玩家選了變體、按了儲存，選用狀態就被無聲清掉。
        //   （這個 bug SSR 測試抓不到，所以邏輯抽到 `buildSkillEntry` 單獨測。）
        activeSkills.push(buildSkillEntry(sk.name, sl, {
          variantId: adoptedVariantId(sk.name),
          originalMaxSL: sk.maxSL,
          selectedOptions: draftSuboptions[sk.name] || []
        }));
      }
    });

    onUpdateSkills(classIndex, activeSkills);
    setIsEditing(false);
  };

  // 取消編輯
  const handleCancel = () => {
    setIsEditing(false);
  };

  // 開啟子項目彈窗
  const handleOpenSuboptionModal = (skillName, currentSL, currentSelected) => {
    setSuboptionModalSkill({
      skillName,
      sl: currentSL,
      selectedOptions: currentSelected
    });
  };

  // 儲存子項目彈窗選擇結果
  const handleSaveSuboptions = (newOptions) => {
    if (!suboptionModalSkill) return;
    const targetSkillName = suboptionModalSkill.skillName;

    if (isEditing) {
      setDraftSuboptions(prev => ({
        ...prev,
        [targetSkillName]: newOptions
      }));
    } else {
      const curSkills = JSON.parse(JSON.stringify(classItem.skills || []));
      const target = curSkills.find(s => s.name === targetSkillName);
      if (target) {
        target.selectedOptions = newOptions;
        onUpdateSkills(classIndex, curSkills);
      }
    }
    setSuboptionModalSkill(null);
  };

  return (
    <div
      className="rounded-xl border transition-all duration-200 overflow-hidden shadow-sm"
      style={{
        backgroundColor: theme.panelBg,
        borderColor: isEditing ? theme.accent : theme.border
      }}
    >
      {/* ================= 卡片頂部標題區 ================= */}
      <div
        className="p-3.5 sm:p-4 border-b flex flex-col gap-2 transition-colors"
        style={{
          backgroundColor: isEditing ? theme.subpanelBg : theme.panelBg,
          borderColor: theme.border
        }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* 中英文名 + 圖標 */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-lg border flex items-center justify-center shadow-xs shrink-0"
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
                color: theme.accent
              }}
            >
              <GameIcon name={classInfo.icon || className} size={22} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-serif font-black text-base tracking-wide" style={{ color: theme.textDark }}>
                  {classInfo.name}
                </h4>
                <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-wider">
                  / {classInfo.en}
                </span>
                <JRPGBadge variant={theme.badgeVariant} size="xs">
                  Lv {isEditing ? draftTotalSL : classItem.level}
                </JRPGBadge>
              </div>

              {/* 免費職業福利 */}
              {classDef.freeBonus && (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-xs font-mono font-bold text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                    <SkillDescription desc={classDef.freeBonus} />
                  </span>
                  {classDef.freeBenefits && (
                    <span className="text-xs text-slate-600 line-clamp-1" title={classDef.freeBenefits}>
                      <SkillDescription desc={classDef.freeBenefits} />
                    </span>
                  )}
                </div>
              )}

              {/* 免費增益二選一：僅「最大 HP 或 最大 MP」的職業需要指定，選了才會反映在角色體質上 */}
              {isHpMpChoice && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span className="text-[10px] font-bold text-slate-500">二選一</span>
                  {['HP', 'MP'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onUpdateClassBenefit && onUpdateClassBenefit(classIndex, opt)}
                      title={`將此職業的免費增益設為 ${opt} +5`}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        chosenBenefit === opt
                          ? 'bg-emerald-600 border-emerald-700 text-white'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-emerald-50'
                      }`}
                    >
                      {opt} +5
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右側按鈕區 */}
          <div className="flex items-center gap-1.5 ml-auto">
            {!isEditing ? (
              <JRPGButton
                variant={theme.buttonVariant || 'primary'}
                size="xs"
                icon={GiQuillInk}
                onClick={handleStartEdit}
                title="點擊展開此職業的所有技能進行加點或調整"
              >
                配置技能
              </JRPGButton>
            ) : (
              <button
                type="button"
                onClick={handleCancel}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 rounded font-medium cursor-pointer"
              >
                取消
              </button>
            )}

            <button
              type="button"
              onClick={() => onRemoveClass(className)}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
              title={`移除職業【${withEn(className)}】`}
            >
              <GiTrashCan className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 風格/戰鬥畫風敘述 */}
        <p className="text-xs text-slate-600 italic leading-relaxed pl-2 border-l-2" style={{ borderColor: theme.accent }}>
          {classInfo.tagline}
        </p>
      </div>

      {/* ================= 模式 A：簡潔檢視模式 (Compact / Saved Mode) ================= */}
      {!isEditing && (
        <div className="p-3.5 sm:p-4 space-y-2.5">
          {(!classItem.skills || classItem.skills.length === 0) ? (
            <div
              className="p-4 rounded-xl border border-dashed text-center text-xs space-y-1.5"
              style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
            >
              <div className="font-bold text-slate-700">尚未分配技能點數</div>
              <p className="text-slate-500 text-[11px]">
                點擊「配置技能」展開查看全部特技，投入點數。
              </p>
              <JRPGButton
                variant={theme.buttonVariant || 'primary'}
                size="xs"
                icon={GiSparkles}
                onClick={handleStartEdit}
                className="mt-1"
              >
                配置技能
              </JRPGButton>
            </div>
          ) : (
            <div className="space-y-2">
              {classItem.skills.map((sk, sIdx) => {
                const rawDef = allAvailableSkills.find(s => s.name === sk.name);
                // 選了變體就顯示變體的內容；`sk.name` 是識別字仍保持原版技能名
                // （見 coreBookVariants.js 的說明：改了會讓 20 處子系統找不到）。
                const disp = resolveSkillDisplay(sk, rawDef);
                const maxSL = disp.maxSL || 5;

                return (
                  <div
                    key={sIdx}
                    className="p-3 rounded-xl border text-xs space-y-1.5 transition-colors shadow-2xs"
                    style={{
                      backgroundColor: theme.cardBg,
                      borderColor: disp.isVariant ? theme.accent : theme.border,
                      borderWidth: disp.isVariant ? 2 : 1
                    }}
                  >
                    {/* 手機版直向堆疊：技能名自己一行、星星在下面。
                        原本是橫向列，技能名是可壓縮的 flex 項目——窄螢幕上會被擠成直排
                        （SL 星星越多越嚴重，例如【咒語模仿】5 顆）。 */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                      <span
                        className="font-bold flex items-center gap-1.5 text-sm sm:text-base whitespace-nowrap shrink-0 flex-wrap"
                        style={{ color: theme.textDark }}
                      >
                        <span style={{ color: theme.accent }}>✦</span>
                        {disp.name}
                        {disp.isVariant && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded border"
                            style={{ borderColor: theme.accent, color: theme.accent }}>
                            公測
                          </span>
                        )}
                      </span>

                      {/* 視覺化星芒 */}
                      <SkillStarPips
                        maxSL={maxSL}
                        currentSL={sk.sl}
                        disabled={true}
                        size={18}
                      />
                    </div>

                    {/* 自動算好數值的動態公式 */}
                    <div className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-sans pt-0.5">
                      <SkillDescription desc={disp.desc} sl={sk.sl} />
                    </div>

                    {/* 子項目狀態與配置條 / 個人載具條 / 忠實夥伴條 */}
                    {sk.name === '個人載具' ? (
                      <PilotVehicleSkillBar
                        sl={sk.sl}
                        vehicleData={character?.pilotVehicle}
                        onOpenModal={() => {
                          setCurrentPilotSl(sk.sl);
                          setIsVehicleModalOpen(true);
                        }}
                      />
                    ) : sk.name === '忠實夥伴' ? (
                      <WayfarerCompanionSkillBar
                        sl={sk.sl}
                        companionData={character?.wayfarerData?.companion}
                        characterLevel={getCharacterLevel(character)}
                        onOpenModal={() => {
                          setCurrentWayfarerSl(sk.sl);
                          setIsCompanionModalOpen(true);
                        }}
                      />
                    ) : sk.name === '小工具' ? (
                      <TinkererGadgetsSkillBar
                        sl={sk.sl}
                        gadgetsData={character?.tinkererData?.gadgets}
                        onOpenModal={() => {
                          setCurrentTinkererSl(sk.sl);
                          setIsGadgetsModalOpen(true);
                        }}
                      />
                    ) : (
                      <SkillSuboptionBar
                        className={className}
                        skillName={sk.name}
                        sl={sk.sl}
                        selectedOptions={sk.selectedOptions || []}
                        onOpenModal={() => handleOpenSuboptionModal(sk.name, sk.sl, sk.selectedOptions || [])}
                      />
                    )}
                  </div>
                );
              })}

            </div>
          )}

          {/* 核心書技能變體（Core Book Variants）——勾選【官方公測修訂】才出現。
              這裡是**檢視模式**，只顯示「這個職業有哪些變體、哪個正在使用中」，
              不提供選用／取消（選用只發生在編輯模式，避免瀏覽時誤觸）。
              ※ 放在空狀態判斷**外面**：變體是「這個職業有變體」的事實，
                與「這個角色配了幾點技能」無關，沒配點時也該看得到。
              ※ 職業名一律讀 `className`（元件在第 370 行就算好了）。
                `classItem` 來自 `rulesData.classes[...]`，那裡**沒有 `name` 欄位**。
              ※ `data-testid`：測試要能把「技能列」與「這一區」分開檢查。
                沒有這個錨點的話，「技能列忘了顯示變體」的 bug 會被這一區的
                同名文字蓋掉——護欄會永遠為真（見 §AV 的刻意破壞驗證紀錄）。 */}
          <div data-testid="variant-browse">
            {showPlaytestVariants && getVariantsForClass(className).map((v) => (
              <CoreBookVariantCard
                key={v.id}
                variant={v}
                theme={theme}
                isSelected={isVariantAdopted(v.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ================= 模式 B：展開點選模式 (Full Allocation / Edit Mode) ================= */}
      {isEditing && (
        <div className="p-3.5 sm:p-4 space-y-3.5 bg-amber-50/20">
          <div className="flex items-center justify-between text-xs text-slate-600 border-b pb-2" style={{ borderColor: theme.border }}>
            <span className="font-bold flex items-center gap-1">
              <GiSparkles className="w-3.5 h-3.5" style={{ color: theme.accent }} />
              點擊星星或卡片分配技能等級 (SL)，再次點擊已亮星星可降級：
            </span>
            <span className="font-mono font-bold" style={{ color: theme.textDark }}>
              本職等級合計：<strong className="text-amber-800 text-sm">Lv {draftTotalSL}</strong>
            </span>
          </div>

          {/* 列出該職業的所有技能 */}
          <div className="space-y-2.5">
            {allAvailableSkills.map((sk) => {
              const currentSL = draftSkills[sk.name] || 0;
              const maxSL = sk.maxSL || 5;
              const isLearned = currentSL > 0;
              const currentSuboptions = draftSuboptions[sk.name] || [];

              // 這個技能選用了哪個變體（null＝用原版）。
              // ※ 讀的是 `classItem.skills`（已存的狀態），不是 draft——選用是立即生效的。
              const activeVariantId = adoptedVariantId(sk.name);
              const activeVariant = getVariantById(activeVariantId);
              // 選用變體後：這一列顯示變體的名稱／描述／上限，原版內容收起來。
              const disp = activeVariant
                ? resolveSkillDisplay({ name: sk.name, variantId: activeVariantId }, sk)
                : null;
              const rowMaxSL = activeVariant ? (activeVariant.maxSL || maxSL) : maxSL;

              return (
                <div
                  key={sk.name}
                  onClick={() => {
                    // 點擊卡片若未習得則設為 1，若已習得且小於上限則加 1，若滿了則循環為 0
                    if (currentSL < rowMaxSL) {
                      handleSetSkillSL(sk.name, currentSL + 1);
                    } else {
                      handleSetSkillSL(sk.name, 0);
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all duration-200 cursor-pointer select-none ${
                    isLearned
                      ? 'bg-amber-50/80 border-amber-400 shadow-xs ring-1 ring-amber-400/40'
                      : 'bg-white/60 border-slate-200/90 hover:bg-white hover:border-slate-300 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          isLearned ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-slate-300'
                        }`}
                      />
                      <span
                        className={`text-sm sm:text-base tracking-wide font-black ${
                          isLearned ? 'text-amber-950 font-serif' : 'text-slate-700'
                        }`}
                      >
                        {activeVariant ? activeVariant.name : sk.name}
                      </span>
                      {/* 選用變體時：顯示【公測】徽章＋原版技能名（讓玩家知道取代了什麼） */}
                      {activeVariant ? (
                        <>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                            公測
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            取代【{sk.name}】
                          </span>
                        </>
                      ) : (
                        isLearned && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono">
                            已學習
                          </span>
                        )
                      )}
                    </div>

                    {/* 星星指示器 + 加減快捷鍵 */}
                    <div className="flex items-center gap-2">
                      <SkillStarPips
                        maxSL={rowMaxSL}
                        currentSL={currentSL}
                        onChange={(newSL) => handleSetSkillSL(sk.name, newSL)}
                        size={18}
                      />

                      <div className="flex items-center gap-1 border-l pl-2 border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleSetSkillSL(sk.name, currentSL - 1)}
                          disabled={currentSL <= 0}
                          className="w-6 h-6 rounded border flex items-center justify-center font-bold text-xs disabled:opacity-20 hover:bg-white active:scale-95 transition-all cursor-pointer"
                          style={{ borderColor: theme.border, color: theme.textDark }}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetSkillSL(sk.name, currentSL + 1)}
                          disabled={currentSL >= rowMaxSL}
                          className="w-6 h-6 rounded border flex items-center justify-center font-bold text-xs disabled:opacity-20 hover:bg-white active:scale-95 transition-all cursor-pointer"
                          style={{ borderColor: theme.border, color: theme.textDark }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 動態公式求值 (未點時展示公式，點亮後展示精算結果)
                      ※ 選用變體後顯示變體描述；原版描述收起來（GM 裁定：選用之後原版要收起來）。 */}
                  <div className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-sans pl-4 border-l border-slate-200">
                    <SkillDescription desc={activeVariant ? activeVariant.desc : sk.desc} sl={currentSL} />
                    {activeVariant && (
                      <div className="mt-1 text-[10px] text-violet-800 font-bold">
                        原版〈{sk.name}〉暫不適用（已由【{activeVariant.name}】取代）
                      </div>
                    )}
                  </div>

                  {/* 子項目狀態與配置條 / 個人載具條 / 忠實夥伴條 */}
                  <div onClick={e => e.stopPropagation()}>
                    {sk.name === '個人載具' ? (
                      <PilotVehicleSkillBar
                        sl={currentSL}
                        vehicleData={character?.pilotVehicle}
                        onOpenModal={() => {
                          setCurrentPilotSl(currentSL);
                          setIsVehicleModalOpen(true);
                        }}
                      />
                    ) : sk.name === '忠實夥伴' ? (
                      <WayfarerCompanionSkillBar
                        sl={currentSL}
                        companionData={character?.wayfarerData?.companion}
                        characterLevel={getCharacterLevel(character)}
                        onOpenModal={() => {
                          setCurrentWayfarerSl(currentSL);
                          setIsCompanionModalOpen(true);
                        }}
                      />
                    ) : sk.name === '小工具' ? (
                      <TinkererGadgetsSkillBar
                        sl={currentSL}
                        gadgetsData={character?.tinkererData?.gadgets}
                        onOpenModal={() => {
                          setCurrentTinkererSl(currentSL);
                          setIsGadgetsModalOpen(true);
                        }}
                      />
                    ) : (
                      <SkillSuboptionBar
                        className={className}
                        skillName={sk.name}
                        sl={currentSL}
                        selectedOptions={currentSuboptions}
                        onOpenModal={() => handleOpenSuboptionModal(sk.name, currentSL, currentSuboptions)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ======= 核心書技能變體（Core Book Variants）選用區 =======
              只在勾選【官方公測修訂】時出現。

              ※ 誰按：**玩家**。GM 只口頭告知團開哪些書，按鈕由玩家在自己的角色卡上按。
              ※ 何時生效：**立刻**，不等「儲存技能配置」——選用是「這技能是哪一版」的決定，
                與配點草稿是兩件事；混在一起會讓玩家按了取消後以為選用也取消了。
              ※ 選用後：上面那一列直接改成變體的內容，原版收起來（GM 裁定）。
              ※ 一個技能只能選一個變體；同職業不同技能可以各選各的（官方 p.34：
                變體**規則**須全團一致，變體**技能**是每位玩家的個人選擇）。 */}
          {showPlaytestVariants && getVariantsForClass(className).length > 0 && (
            <div className="pt-3 border-t space-y-2.5" style={{ borderColor: theme.border }}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <GiSparkles className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                核心書技能變體（公測）
                <span className="text-[10px] font-normal text-slate-500">
                  —— 選用後原版技能會收起來，一次只能選一個
                </span>
              </div>

              <div className="space-y-2">
                {getVariantsForClass(className).map((v) => (
                  <CoreBookVariantCard
                    key={v.id}
                    variant={v}
                    theme={theme}
                    isSelected={isVariantAdopted(v.id)}
                    onToggle={(vid) => handleToggleVariant(v.replaces, vid)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 底部儲存確認列 */}
          <div className="pt-2 border-t flex items-center justify-between gap-3" style={{ borderColor: theme.border }}>
            <div className="text-xs text-slate-500 font-mono">
              已選技能：<strong className="text-slate-800">{Object.values(draftSkills).filter(sl => sl > 0).length}</strong> / {allAvailableSkills.length} 個
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-lg border text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
              >
                取消變更
              </button>

              <JRPGButton
                variant={theme.buttonVariant || 'primary'}
                size="sm"
                icon={GiSaveArrow}
                onClick={handleSave}
                title="儲存配置並恢復簡潔顯示"
              >
                儲存技能配置
              </JRPGButton>
            </div>
          </div>
        </div>
      )}

      {/* ================= 子項目構築彈窗 ================= */}
      {suboptionModalSkill && (
        <SkillSuboptionModal
          isOpen={true}
          onClose={() => setSuboptionModalSkill(null)}
          className={className}
          skillName={suboptionModalSkill.skillName}
          sl={suboptionModalSkill.sl}
          selectedOptions={suboptionModalSkill.selectedOptions}
          onSave={handleSaveSuboptions}
          theme={theme}
        />
      )}

      {/* ================= 機師個人載具管理彈窗 ================= */}
      <PilotVehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        vehicleData={character?.pilotVehicle}
        pilotSl={currentPilotSl}
        onSave={(newVehicleData) => {
          if (onUpdateCharacter) {
            onUpdateCharacter({
              ...character,
              pilotVehicle: newVehicleData
            });
          }
        }}
      />

      {/* ================= 旅人忠實夥伴隨從彈窗 ================= */}
      <WayfarerCompanionModal
        isOpen={isCompanionModalOpen}
        onClose={() => setIsCompanionModalOpen(false)}
        companionData={character?.wayfarerData?.companion}
        wayfarerSl={currentWayfarerSl}
        characterLevel={getCharacterLevel(character)}
        onSave={(newCompData) => {
          if (onUpdateCharacter) {
            onUpdateCharacter({
              ...character,
              wayfarerData: {
                ...(character?.wayfarerData || {}),
                companion: newCompData
              }
            });
          }
        }}
      />

      {/* ================= 修補匠小工具科技樹彈窗 ================= */}
      <TinkererGadgetsModal
        isOpen={isGadgetsModalOpen}
        onClose={() => setIsGadgetsModalOpen(false)}
        gadgetsData={character?.tinkererData?.gadgets}
        tinkererSL={currentTinkererSl}
        characterLevel={getCharacterLevel(character)}
        onSave={(newGadgetsData) => {
          if (onUpdateCharacter) {
            onUpdateCharacter({
              ...character,
              tinkererData: {
                ...(character?.tinkererData || {}),
                gadgets: newGadgetsData
              }
            });
          }
        }}
      />
    </div>
  );
}
