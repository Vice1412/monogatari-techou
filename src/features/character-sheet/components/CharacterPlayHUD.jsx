import React, { useState, useMemo, useRef } from 'react';
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
  GiCycle,
  GiLaurelCrown,
  GiCampfire,
  // P10：錢包上的三顆按鈕（收入／支出／明細）。收入與支出用一對鏡像圖示，
  // 明細用卷軸——三顆長得一樣的話，玩家要靠讀字才知道哪一顆是哪一顆。
  GiReceiveMoney,
  GiPayMoney,
  GiCharacter
} from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import EmptyState from '../../../components/ui/EmptyState';
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
  classSkillsForClass,
  getCharacterLevel,
  resolveSpellEntry,
  resolveCharacterSpells,
  resolveHeroicSkillEntry,
  describeFreeBenefit,
  describeQuirkChoice,
  // 金手指效果全文的唯一來源（`quirks[]` 的欄位是 `desc`，不是 `effect`）。
  // 以前跑團面板直接讀 `quirkDef.effect` → 46 條全部只印一句「已啟用金手指【X】。」。
  quirkEffectText,
  // 【大口袋】的IP 折扣：門檻與扣點共用同一組函式，避免「按鈕亮著、按下去說不足」。
  ipCostDiscount,
  applyIpDiscount,
  HEROIC_SKILL_SOURCE_LABELS,
  CLASS_MAX_LEVEL,
  MAX_NON_MASTERED_CLASSES,
  LEVEL_UP_NEW_CLASS_PREFIX,
  parseLevelUpClassValue
} from '../utils/characterEngine';
import rulesData from '../data/rulesData.json';
import CharacterPreviewModal from './CharacterPreviewModal';
import { STATUS_AFFLICTIONS, ATTRIBUTE_NAMES, normalizeClassName, normalizeSkillName, normalizeEquipmentName } from '../data/sourcebookConfig';
import { resolveSkillDisplay } from '../data/coreBookVariants';
import { hasGreaterTheriomorphosis } from '../data/theriomorphosisVariant';
import { formatInitiative, isInitiativeVariant } from '../data/initiativeVariant';
import { isZeroPowersEnabled } from '../data/zeroPowers';
import { campActivityAccess } from '../data/campActivities';
// 營地休整要一起回充「本次休息已使用」：兩件事是同一次休息的兩半。
import { normalizeCampActivities, resetCampActivityUses } from '../data/campActivities';
// 效果流程（373 條規則物件 → 跑團卡上的計數器／開關／按鈕）
import {
  flowItemForClassSkill,
  flowItemForHeroic,
  flowItemForQuirk,
  readFlowState,
  clampFlowState,
  withFlowState,
  flowResetState,
  flowActionPlan,
  flowVarsFor,
  characterFlowItems,
  controlsOf,
  resetScopeLabel,
  resetFlowScope
} from '../utils/effectFlow';
import ChapterSettlementModal from './ChapterSettlementPanel';
import { chapterSettlementItems } from '../utils/chapterSettlement';
import SkillFlowControls from './SkillFlowControls';
// F-020（2026-10-27）：職業面板「住哪個分頁」與指路句的唯一來源。
import { classPanelHint, isClassPanelActive } from '../data/classPanels';
import CampActivitiesBlock from './CampActivitiesBlock';
// 營地活動「按了會發生什麼」的純函式層（擲 d6、查表、夾上限、算錢、列 manual）。
// 履歷與錢包都走它，不要在 JSX 裡再算一份。
import { applyCampPlan, describeCampOutcome } from '../utils/campOutcome';
import { resolveCreationRules } from '../data/creationRules';
import { modeRestrictsEquipment, isTechnosphereEnabled, isSkillSuppressedByTechnospheres, getLevelUpMnemosphereCandidates, MNEMOSPHERE_MAX_LEVEL } from '../data/technospheres';
import ZeroPowerBlock from './ZeroPowerBlock';
import { specFor, readEntry, setRecord, addRecord, removeRecord, planBuffUse, planSettlement } from '../utils/flowData';
import FlowDataPanel from './FlowDataPanel';
import { getCharacterTheme } from '../utils/characterThemes';
import { getDualShieldState, withHrBonus, EQUIPMENT_SLOTS, applyEquipmentChoice } from '../utils/equipmentRules';
// 金錢回饋（P9，2026-10-31）：判定與金額格式的唯一來源。
// 面板只負責畫，不在這裡自己拼 `…z` 或自己算「還差多少」。
import { formatZenit, describePurchase, MONEY_DIRECTIONS } from '../utils/zenitFeedback';
// 寫入層（P9-b）：扣款 → 換裝備 → 留履歷必須同一次寫入。
// 編輯器、購買面板、收支對話框三個入口共用同一支，否則它們總有一天會算出不同的錢。
import { applyPurchase, applyMoneyFlow, describeMoneyToast } from '../utils/moneyFlow';
import MoneyFlowModal from './MoneyFlowModal';
import MoneyLedgerModal from './MoneyLedgerModal';
import EquipmentSlotModal from './EquipmentSlotModal';
// 物語點（P12，2026-11-02）：與錢包同一條路——有原因才寫，明細從履歷推導。
// 步進器移除之後，這裡是物語點**唯一**的寫入入口（擲骰器也走這支）。
import FabulaPointsModal from './FabulaPointsModal';
import FabulaPointLedgerModal from './FabulaPointLedgerModal';
// DQ 風格視窗與指令列（P13，2026-11-02）：使用者挑的參考骨架是 Dragon Quest。
// 借的是「一個視窗一件事」的分割方式與 ▶ 指令游標，不是 DQ 的深藍配色。
import { HudWindow, HudCommandList } from './HudWindow';
import {
  FP_DIRECTIONS,
  applyFabulaPointsFlow,
  describeFabulaPointsToast,
  resolveFabulaPoints
} from '../utils/fabulaPointsFlow';
import {
  buildCustomWeaponEntries,
  buildCustomWeaponEntry,
  attachCustomWeapon,
  equipCustomWeapon,
  groupCustomWeapons,
  equippedFormIndex,
  nextFormFor
} from '../data/customWeapons';
import {
  loggableChange,
  getLog,
  getSessionNumber,
  getSessionEntries,
  summarizeSession,
  sessionSummaryText,
  startSession,
  endSession,
  formatLogDate
} from '../utils/characterLog';
import { buildRollRecord, shouldAutoRecordRoll } from '../utils/rollRecord';
// 羈絆 ⇄ NPC 檔案庫的連結（2026-10-30，P3）。
// 判定（含「名冊已無此人」）只寫在 bondLink.js，這裡只負責畫。
// ※ 這裡刻意沒有「為什麼有這份情感」的輸入框：多一個空白欄位就是多一次
//   「我該填什麼」的猶豫，而那不會讓羈絆變得更有代入感。詳見 bondLink.js 檔頭。
import {
  resolveBondNpc,
  bondNpcSubtitle,
  buildBondLinkFields,
  applyBondLinkFields,
  describeBondEdit
} from '../utils/bondLink';
import NumberStepper from '../../../components/ui/NumberStepper';
import GaugeBar from './GaugeBar';
import { useResourceDelta, ResourceDeltaBadge } from './ResourceDeltaBadge';
// 角色檔案（2026-10-30，P5-b）：面板要能讀到「這個角色是誰」。
// 純推導、零寫入、零輸入框——性別與背景是玩家在創角第 6 步寫下的東西，
// 在這一輪之前它們在跑團面板上一次都沒出現過。詳見 characterDossier.js 檔頭。
import { buildDossier, backgroundDisplayText } from '../utils/characterDossier';
// 事前可用性（2026-10-30，P6）：把「按下才知道 MP 不足」改成「看就知道還差多少」。
// 判定收斂在 playAvailability.js，按下後的守衛**照舊存在**而且是唯一權威。
import { describeCostGate, gateButtonAttrs, GATED_BUTTON_CLASS, GATED_SHELL_CLASS, GATED_LABEL_CLASS, GATE_UNITS } from '../utils/playAvailability';
import UnavailableHint from './UnavailableHint';
// 狀態異常的效果碼（2026-10-30，P7）：一律由 affectedStats 推導，不另立對照表。
import { buildAfflictionRows } from '../utils/afflictionDisplay';
import SkillDescription, { openRuleCodex } from '../utils/skillFormulaEvaluator';
// 咒語與儀式的「取得資格」（2026-11-02）：這一屏原本對**任何**角色都給
// 「從規則庫選擇習得咒語」與「扣除 MP 並擲儀式檢定」。那兩顆按鈕在《FU》裡是無中生有——
// 咒語只能經由【元素／熵系／靈魂魔法】、【咒語模仿】或英雄技能【額外咒語】取得；
// 儀式需要對應學派的職業技能或職業免費能力。判定收斂在 spellGrants.js，
// 這裡只負責畫，並且**不自己重算規則**。
import { describeSpellGrants, describeRitualRights } from '../utils/spellGrants';
import { describeAttributeCheck } from '../utils/attributeCheck';
// 行囊物品（2026-11-03）：冒險途中拿到的裝備／消耗品／稀有物品／雜項。
// 形狀與算術都在 `utils/inventory.js`，這裡只負責接線與說話。
import { addInventoryItem, removeInventoryItem, applySellItem } from '../utils/inventory';
import BackpackGrid from './BackpackGrid';
import BackpackItemModal from './BackpackItemModal';
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
import { shouldRenderArcanistPanel } from '../utils/arcanist';
import { withEn } from '../../../utils/properNouns';
import { STORAGE_KEYS } from '../../../data/keys';
import { readJSON, writeJSON } from '../../../data/store';
import CopyTextButton from '../../../components/ui/CopyTextButton';
import {
  formatSkillCopyText,
  formatHeroicSkillCopyText,
  formatQuirkCopyText,
  formatSpellCopyText,
  formatWeaponCopyText,
  formatEquipmentCopyText
} from '../utils/playCopyFormat';

/**
 * 六種情感的顯示名（原書 p.91 的三組對立情感）。
 *
 * 原本只在羈絆卡的 JSX 裡用一條三元鏈寫死，而 2026-10-30 要拿它組履歷標題
 * （「調整羈絆【X】：欽佩 → 疑忌」），所以抽成一份——兩個地方各寫一次，
 * 總有一天會有一邊漏改。
 */
const FEELING_LABELS = Object.freeze({
  admiration: '欽佩',
  inferiority: '自卑',
  loyalty: '忠誠',
  mistrust: '疑忌',
  affection: '喜愛',
  hatred: '仇恨'
});

/**
 * 羈絆對象的名冊挑選器（建立彈窗與就地編輯共用一份）。
 *
 * 為什麼抽成元件而不是兩處各寫一次 `<select>`：這顆控件有一個很容易漏掉的分支——
 * **目前連結的那張卡已經不在名冊裡了**。那時 `value` 對不上任何 `option`，
 * 瀏覽器會安靜地顯示第一個選項（「不連結名冊」），畫面上看起來像玩家自己取消了連結，
 * 但他什麼都沒按。所以斷鏈要有一顆殘留的 disabled 選項把它顯示出來。
 * 這段邏輯寫兩次就會有一邊漏掉。
 */
function BondNpcSelect({ value, pool, onChange, onPick, testId }) {
  const list = (Array.isArray(pool) ? pool : []).filter((n) => n && n.id);
  const current = typeof value === 'string' ? value.trim() : '';
  const dangling = current && !list.some((n) => n.id === current);

  if (list.length === 0 && !dangling) {
    return (
      <p className="text-t12 text-[#7c6a58] leading-relaxed" data-testid={`${testId}-empty`}>
        名冊還沒有任何 NPC。可以先直接打名字，日後到 NPC 工坊建卡再回來連結。
      </p>
    );
  }

  return (
    <select
      data-testid={testId}
      value={current}
      onChange={(e) => {
        const id = e.target.value;
        onChange(id);
        // 選了名冊上的卡就把名字帶進來——這是「一鍵連結」的全部意義。
        // 只填名字，不動情感與理由：那些是玩家的判斷，不是名冊的資料。
        if (id && onPick) {
          const npc = list.find((n) => n.id === id);
          if (npc) onPick(npc);
        }
      }}
      className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fffdf9] text-xs font-bold text-[#3c2415]"
    >
      <option value="">不連結名冊（自由輸入名稱）</option>
      {dangling && (
        <option value={current} disabled>
          （名冊已無此人，連結已失效）
        </option>
      )}
      {list.map((n) => {
        const sub = bondNpcSubtitle(n);
        const name = n.name || '未命名';
        return (
          <option key={n.id} value={n.id}>
            {sub ? `${name}（${sub}）` : name}
          </option>
        );
      })}
    </select>
  );
}


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
  roster = [],
  // NPC 檔案庫（羈絆可以連到名冊上的某張卡）。
  // 不傳時自己從 store 讀——生產端不傳，SSR 測試可以注入一組固定的名冊，
  // 不必為了測「連結／斷鏈」去偽造 localStorage。
  npcLibrary = null,
  onPartnerCleared = null,
  showToast = () => {},
  // 測試注入點（`AGENTS.md` §1「SSR 測不到的區塊，優先加測試注入點」）。
  // 生產端**永不傳入**；不傳時行為逐字不變（`false`／`'class'`／`''` 就是原本的初始值）。
  // 沒有這三個，升級彈窗只能靠點擊打開，SSR 永遠看不到它。
  initialLevelUpOpen = false,
  initialLevelUpTarget = 'class',
  initialLevelUpMnemosphereId = '',
  initialLevelUpSkillName = '',
  initialLevelUpClass = '',
  // 初始分頁：跑團面板的每個分頁各自有一段「空清單」畫面，而 SSR 不執行點擊，
  // 沒有這個入口就永遠測不到。不傳時就是預設的 `'profile'`——P14 起，
  // 「個人資料」是第一頁（狀態與屬性住在那裡），開卡就該看到自己剩多少。
  initialTab = 'profile',
  // 羈絆的兩個彈窗／面板（P3）。同樣是 SSR 測不到的區塊：建立彈窗與就地編輯面板
  // 都只能靠點擊打開，而裡面正是「名冊斷鏈」與「為什麼」唯一會出現的地方。
  // 生產端永不傳入，不傳時就是原本的 `false`／`null`。
  initialBondModalOpen = false,
  initialEditingBondId = null,
  // 角色檔案（P5-b）：收合是預設，展開只能靠點擊，所以 SSR 看不到展開後的內容。
  // 生產端永不傳入，不傳時就是原本的 `false`。
  initialDossierOpen = false
}) {
  // 七個分頁（P13，2026-11-02）：原本是六個，`notes` 從「行囊日誌」擴成
  // 「行囊與道具」（左翼的消耗品捷徑搬進來），另外新增 `money`——
  // 使用者裁定「左翼消耗品池與右翼錢包各自收成一頁」。
  // 指令窗與內容頁共用這一份清單，**只有這一份**（以前是格子＋sticky 列兩份）。
  const [activeTab, setActiveTab] = useState(initialTab);
  const characterLevel = getCharacterLevel(character);
  const hudTabItems = useMemo(() => [
    // P14：`profile` 是預設頁——「最基本的默認信息」。
    // 它同時是 HP／MP／IP 步進器的家，所以開卡第一眼就看到自己剩多少。
    { id: 'profile', label: '個人資料', icon: GiCharacter, sub: '狀態 · 屬性 · 成長' },
    { id: 'attacks', label: '武器與戰鬥', icon: GiCrossedSwords, sub: '命中 · 防禦 · 變形' },
    { id: 'spells', label: '咒語與儀式', icon: GiSpellBook, sub: '施法 · 儀式計算', count: resolveCharacterSpells(character).length },
    { id: 'skills', label: '職業技能', icon: GiBroadsword, sub: '技能 · 英雄 · 金手指' },
    { id: 'bonds', label: '情感羈絆', icon: GiHeartShield, sub: '激勵 · 編輯 · 營地', count: (character.bonds || []).length },
    { id: 'clocks', label: '個人命刻', icon: GiPocketWatch, sub: '命刻 · 底力技', count: (character.clocks || []).length },
    { id: 'notes', label: '行囊與道具', icon: GiBackpack, sub: '消耗品 · 裝備 · 筆記' },
    { id: 'money', label: '金錢與物語點', icon: GiCoins, sub: '收支 · 履歷 · 物語點' }
  ], [character]);
  const hudTabLabel = (hudTabItems.find((t) => t.id === activeTab) || hudTabItems[0]).label;
  // 右翼那扇窗的標題圖示跟著指令換（以前是固定的「狀態」）。
  const activeTabIcon = (hudTabItems.find((t) => t.id === activeTab) || hudTabItems[0]).icon;

  // Level up modal
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(initialLevelUpOpen);
  // 角色卡預覽（含三頁表格的匯出）
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedClassForLevelUp, setSelectedClassForLevelUp] = useState(initialLevelUpClass);
  const [selectedSkillForLevelUp, setSelectedSkillForLevelUp] = useState(initialLevelUpSkillName);
  // 升級的那一點要投進**固有職業**還是**職業魔石**——p.134 的原文是
  // 「invest 1 level into an Innate Class **or** into a mnemosphere」，是同一個池子
  // 的兩個出口。缺了這一半，開了魔晶石制的角色升級時只能投固有職業，
  // 魔石永遠長不大（§BY7 缺口 D）。
  const [levelUpTarget, setLevelUpTarget] = useState(initialLevelUpTarget);
  const [selectedMnemosphereForLevelUp, setSelectedMnemosphereForLevelUp] = useState(initialLevelUpMnemosphereId);

  // 升級時投給「還沒有的職業」（Core p.228：「you gain your first level in a Class you
  // didn't already have」）。原本 `isNewClassLevelUp` 是一個**有 setter 卻沒有控件**的
  // 死 state——引擎的 `isNewClass` 分支從 §BO 起就寫好也測好了，玩家卻永遠碰不到。
  // 改成從下拉的值派生：新職業用前綴標記，拆解邏輯在資料層
  // （`parseLevelUpClassValue`），不另存一份布林值——兩個來源總有一天會對不上。
  const levelUpSelected = parseLevelUpClassValue(selectedClassForLevelUp);
  const levelUpSelectedIsNew = levelUpSelected.isNew;
  const levelUpSelectedClassName = levelUpSelected.className;
  // 魔石出口是否存在：只有開了魔晶石制才有「投魔石」這條路（p.134）。
  const levelUpTechOn = isTechnosphereEnabled(resolveCreationRules(character?.creationRules).technospheres);
  // 可以「開新職業」的兩個條件（Core p.228）：
  // ① 未精通的職業不到三個（精通一個 10 級職業就能再開一個）；
  // ② 魔晶石制下不得取得新職業（p.134「cannot acquire new Classes」）。
  const levelUpNonMasteredCount = (character?.classes || [])
    .filter((c) => (c.level || 0) < CLASS_MAX_LEVEL).length;
  const levelUpCanAddClass = !levelUpTechOn && levelUpNonMasteredCount < MAX_NON_MASTERED_CLASSES;
  const levelUpNewClassOptions = levelUpCanAddClass
    ? Object.keys(rulesData.classes || {}).filter(
        (name) => !(character?.classes || []).some((c) => c.className === name)
      )
    : [];

  // 升級彈窗的兩個出口。魔石那條只有在「開了魔晶石制」且「手上有未滿 5 級的魔石」時
  // 才存在——p.136 的上限是 5 級，滿級的魔石不再吃點數。
  const levelUpMnemospheres = levelUpTechOn
    ? getLevelUpMnemosphereCandidates(character?.technospheres)
    : [];
  const levelUpMnemosphere = levelUpMnemospheres.find((m) => m.id === selectedMnemosphereForLevelUp) || null;
  const levelUpIsMnemosphere = levelUpTarget === 'mnemosphere' && Boolean(levelUpMnemosphere);
  // 技能清單的資料源：魔石走**它自己那個職業**的技能表（p.135「just as with standard
  // Class advancement」），職業（含新開的）走 rulesData。三邊的卡片長得一樣，
  // 只有 SL 的來源不同——新職業在 `character.classes` 裡還不存在，SL 自然是 0。
  //
  // 魔晶石制下兩條路都要濾掉原書明文作廢的技能（p.133 的守護者【雙重盾牌】）：
  // 盾牌整類不存在，這個技能買了也不會生效。兩條分支的資料源不同，所以各濾一次。
  const levelUpTechnosphereMode = resolveCreationRules(character?.creationRules).technospheres;
  const levelUpSkills = levelUpIsMnemosphere
    ? classSkillsForClass(levelUpMnemosphere.className, levelUpTechnosphereMode)
    : (rulesData.classes[levelUpSelectedClassName]?.skills || [])
      .filter((sk) => !isSkillSuppressedByTechnospheres(sk.name, levelUpTechnosphereMode));
  const levelUpCurrentSL = (name) => {
    if (levelUpIsMnemosphere) {
      return (levelUpMnemosphere.skills || []).find((s) => s.name === name)?.sl || 0;
    }
    const cl = (character.classes || []).find((c) => c.className === levelUpSelectedClassName);
    return cl?.skills?.find((s) => s.name === name)?.sl || 0;
  };

  // 立繪框的比例（2026-11-03，使用者：「不能讓框隨著放進去的圖片長寬調整嗎？」）
  //
  // 框原本寫死 3:4，玩家的圖是 1:1／4:3／9:16 時 `object-contain` 一定留白，
  // 於是上一輪用「同圖模糊鋪滿」去補——使用者的評語是「放在上面真的很難看」。
  // 正確的方向是**讓框去配合圖**，留白從源頭就不存在；模糊只在框被
  // `minHeight`／`maxHeight` 夾住（比例過扁或過長）時才露出來當襯底。
  //
  // 比例要等圖片載入才知道（`naturalWidth` / `naturalHeight`），SSR 沒有這個資訊，
  // 所以 `null` ＝ 用 3:4 撐住版面；載入後才換成真實比例。
  const [portraitRatio, setPortraitRatio] = useState(null);

  // 行囊物品：新增／賣出／丟棄（2026-11-03）
  const [isBackpackAddOpen, setIsBackpackAddOpen] = useState(false);

  // 行囊物品：新增／賣出／丟棄（2026-11-03）
  //
  // 三個動作都走「讀最新角色 → 一次寫入 → 說話」的同一個模式。
  // 賣出**不能**拆成「先移除物品、再加錢」兩次 onChange：第二次讀到的是這一輪開始前的
  // 角色（MEMORY §D.24），結果就是「東西沒了、錢沒加」。算術與履歷在 `applySellItem`。
  const handleAddInventoryItem = (item) => {
    const before = characterRef.current;
    const next = addInventoryItem(before, item);
    if (next === before) return;
    commit(next);
    setIsBackpackAddOpen(false);
    showToast(`已記下【${item.name}】`);
  };

  const handleSellInventoryItem = (itemId, amount) => {
    const result = applySellItem(characterRef.current, { itemId, amount });
    if (!result.ok) {
      showToast(result.reason, 'warning');
      return result;
    }
    commit(result.character);
    showToast(`賣出【${result.item.name}】，+${formatZenit(result.gain)}`);
    return result;
  };

  const handleDiscardInventoryItem = (itemId) => {
    const before = characterRef.current;
    const next = removeInventoryItem(before, itemId);
    if (next === before) return;
    commit(next);
    showToast('已丟棄');
  };

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

  // JRPG Hub 雙屬性快速組合檢定（點第一屬性、再點第二屬性即可擲骰）
  const [comboFirstAttr, setComboFirstAttr] = useState(null);

  // 聚會 EXP 結算小工具（Core p.227：基礎 5 EXP ＋ 全團消耗物語點 ÷ 人數 ＋ 反派終結點）
  const [isExpSettlementOpen, setIsExpSettlementOpen] = useState(false);
  const [sessionFpGain, setSessionFpGain] = useState(0);
  const [sessionUltimaSpent, setSessionUltimaSpent] = useState(0);

  // 元素碎片（2 IP）所選傷害屬性（風／電／土／火／冰，Core p.104）
  const [shardElement, setShardElement] = useState('火');

  // 購買裝備（P9，2026-10-31）：跑團中買東西的**唯一**入口。
  // 建卡時的預算制（`CharacterEditor` 的 `startingZenit` 條）不適用於跑團——
  // 那條算的是「還沒結算的起始預算」，不是「你現在有多少錢」。

  // 收支（P9-b）：住宿、餐費、報酬……**有原因**的金錢流動。
  // 與購買面板分開，因為那裡只有「買裝備」一種原因，而跑團中花錢的地方遠多於裝備。
  const [isMoneyFlowOpen, setIsMoneyFlowOpen] = useState(false);

  // 收支對話框從哪個方向開始（P10）。
  // 錢包上有「收入」與「支出」兩顆按鈕——按了「收入」卻打開一個預設「支出」的對話框，
  // 那一下點擊就白做了。方向仍然可以在對話框裡改（按鈕就在上面），這只是起點。
  const [moneyFlowDirection, setMoneyFlowDirection] = useState(MONEY_DIRECTIONS.spend);

  // 金錢明細（P10）：把履歷裡動到錢的條目整理成一張帳。
  // 它是錢包下方「明細」按鈕的內容，取代原本只印最近一筆的那一條。
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);

  // 物語點（P12，2026-11-02）：與錢包同一個形狀——獲得／消耗／明細三顆按鈕。
  // 步進器在這一輪移除：它寫出的履歷沒有原因，而物語點的三種用途價錢都是 1 點，
  // 沒有原因就等於三件事在履歷上長得一模一樣。
  const [isFpFlowOpen, setIsFpFlowOpen] = useState(false);
  const [fpFlowDirection, setFpFlowDirection] = useState(FP_DIRECTIONS.spend);
  const [isFpLedgerOpen, setIsFpLedgerOpen] = useState(false);

  // 行囊分頁的單槽選擇器（P9-b）：`null` ＝ 關著，其餘是槽位鍵。
  // 存「哪一個槽」而不是「開著還是關著」，因為四顆按鈕共用同一個彈窗，
  // 而標題與清單都取決於槽位——兩個 state 會有一天不同步。
  const [slotPicker, setSlotPicker] = useState(null);

  // 儀式魔法（Core p.118）效力×範圍速查計算器狀態
  const [ritualPotency, setRitualPotency] = useState('minor');
  const [ritualArea, setRitualArea] = useState('individual');
  const [ritualHasIngredient, setRitualHasIngredient] = useState(false);

  // Bond creator & editor modal
  const [isBondModalOpen, setIsBondModalOpen] = useState(initialBondModalOpen);
  const [newBondTarget, setNewBondTarget] = useState('');
  const [newBondFeelings, setNewBondFeelings] = useState(['admiration']);
  // 羈絆可以指向 NPC 檔案庫上的某張卡（P3）。
  // `npcId` 是**選填**的：羈絆對象本來就可以是王國、一把劍、死去的人，
  // 那些不在名冊裡，硬要連結等於逼玩家先建一張 NPC 才能寫羈絆。
  const [newBondNpcId, setNewBondNpcId] = useState('');
  // 測試注入點用：直接把某一條羈絆擺進「編輯中」狀態，面板才會出現在 SSR 輸出裡。
  // 生產端永不傳入（`initialEditingBondId` 是 null），行為與原本完全相同。
  const seededEditingBond = initialEditingBondId
    ? (character?.bonds || []).find((b) => b.id === initialEditingBondId) || null
    : null;
  const [editingBondId, setEditingBondId] = useState(seededEditingBond ? seededEditingBond.id : null);
  const [editBondTarget, setEditBondTarget] = useState(seededEditingBond?.target || '');
  const [editBondFeelings, setEditBondFeelings] = useState(
    Array.isArray(seededEditingBond?.feelings) ? [...seededEditingBond.feelings] : []
  );
  const [editBondNpcId, setEditBondNpcId] = useState(
    typeof seededEditingBond?.npcId === 'string' ? seededEditingBond.npcId : ''
  );

  /**
   * 名冊快照。
   *
   * 刻意在「開啟羈絆彈窗／開始編輯」的當下重讀，而不是 mount 時讀一次：
   * 玩家可能剛在 NPC 工坊建了一張卡再切回來，而跑團面板不會因此重新掛載
   * （章節切換是條件渲染，但面板在同一個章節內不會卸載）。
   * 讀一次就定終身的話，新建的 NPC 要重新整理才看得到。
   */
  const [npcPool, setNpcPool] = useState(() =>
    Array.isArray(npcLibrary) ? npcLibrary : readJSON(STORAGE_KEYS.npcLibrary, [])
  );
  const refreshNpcPool = () => {
    setNpcPool(Array.isArray(npcLibrary) ? npcLibrary : readJSON(STORAGE_KEYS.npcLibrary, []));
  };

  // 升級後若解鎖職業精通（Lv 10）或帶子項目的技能，給出跳轉編輯器提示橫幅
  const [postLevelUpHint, setPostLevelUpHint] = useState(null);

  // Clock creator modal
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [newClockTitle, setNewClockTitle] = useState('');
  const [newClockSegments, setNewClockSegments] = useState(6);

  // 場次收場彈窗（2026-10-30）：本場小結 ＋ 一句自由註記
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isChapterSettlementOpen, setIsChapterSettlementOpen] = useState(false);
  const [sessionNote, setSessionNote] = useState('');


  if (!character) return null;

  const theme = getCharacterTheme(character.themeColor || themeId);
  const stats = calculateCharacterStats(character);
  // 營地活動（自然奇幻手冊 p.130–133）：規則或金手指【老大哥／歐尼醬】任一成立就顯示。
  // 休息場景的區塊放在「羈絆」分頁最上面——原書 p.130 明寫兩件事在同一個場景裡發生：
  // 「Whether they perform a Camp Activity or not, characters may still use the resting
  // scene to adjust their Bonds」。
  const campAccess = campActivityAccess(character);
  // 先攻變體（公測 p.34）：先攻值不存在 → 顯示「不計」，副標改寫成變體說明。
  const initiativeVariant = isInitiativeVariant(character);
  const breakdown = stats.breakdown || {};

  // ── 屬性檢定（2026-11-03 重做）────────────────────────────────
  // 舊版每一格有兩顆按鈕（大卡＝單屬性、旁邊小鈕＝配對），玩家要在兩處之間來回，
  // 而且彈窗一開就蓋住整排屬性，看不到自己剛選了哪兩顆。
  // 現在：點第一張＝記住它；再點任何一張（含同一張）＝立刻擲那兩顆。
  // 判定與 label 都抽到 `utils/attributeCheck.js`（純函式），這裡只負責套用——
  // `onClick` 裡的邏輯 SSR 測不到，抽出去才有會失敗的斷言。
  const attrDie = (key) => {
    if (key === 'dex') return stats.currentDex;
    if (key === 'ins') return stats.currentIns;
    if (key === 'mig') return stats.currentMig;
    if (key === 'wlp') return stats.currentWlp;
    return 8;
  };
  const handleAttributeRoll = (attr) => {
    const next = describeAttributeCheck({ firstKey: comboFirstAttr, nextKey: attr.key, dieOf: attrDie });
    if (next.mode === 'select') {
      setComboFirstAttr(next.key);
      return;
    }
    setComboFirstAttr(null);
    openCharacterDice({
      die1: next.die1,
      die2: next.die2,
      modifier: 0,
      label: next.label,
      // 骰階已經由屬性決定了，彈窗不該再擺兩組 d6/d8/d10/d12 讓人以為要自己挑。
      // 自由擲骰與「進階修正檢定」仍然保留選擇器（那裡本來就要挑）。
      lockDice: true
    });
  };
  const curHp = character.currentHp !== null && character.currentHp !== undefined ? character.currentHp : stats.maxHp;
  const curMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : stats.maxMp;
  const curIp = character.currentIp !== null && character.currentIp !== undefined ? character.currentIp : stats.maxIp;
  const isCrisis = curHp <= stats.crisisThreshold;

  /* ── 立繪圖源（2026-11-02，P12-b）───────────────────────────────
     `avatar` 可能是三種東西：圖片 data URL／圖片 http 網址／**圖示名稱**
     （`CharacterAvatarUploader` 的「用圖示代替照片」就存圖示名）。
     所以不能只看「有沒有值」，要看「是不是圖」。
     優先序：`avatarRaw`（裁切前的原圖）→ `avatar`。
     裁切過的方圖塞進直式框會把人物上下切掉，而使用者要的是「完整」。 */
  const portraitSrc = character.avatarRaw || character.avatar || '';
  const portraitIsImage = typeof portraitSrc === 'string'
    && (portraitSrc.startsWith('http') || portraitSrc.startsWith('data:'));

  /* ── 事前可用性（2026-10-30，P6）───────────────────────────────
     同一個門檻原本在八個地方各寫一次，而且全部是「按下之後才用 toast 說不行」。
     這裡先算一次，讓按鈕在按下去之前就灰掉並寫出還差多少。

     **按下後的守衛一個都沒拆**——它們仍然是唯一權威，這裡只是提前告知。
     這樣即使這裡的判定與守衛有出入，最壞情況也只是「提示不準」，
     不會變成「按了沒反應」或「擋掉本來可以做得到的事」。

     刻意**不擋「用了沒意義」**（HP 全滿還吃大補藥、沒有異常還喝滋補藥）：
     那是玩家的判斷，不是系統的權限。 */
  const fpCurrent = character.fabulaPoints !== null && character.fabulaPoints !== undefined
    ? character.fabulaPoints
    : 3;

  // 【大口袋】的庫存點折扣（英雄技能）。門檻與實際扣點**必須吃同一個數字**，
  // 否則會出現「按鈕亮著、按下去說不足」這種最難相信的畫面。
  const ipDiscount = ipCostDiscount(character);
  const consumableGates = {
    remedy: describeCostGate({ cost: applyIpDiscount(3, ipDiscount), current: curIp, unit: GATE_UNITS.ip }),
    elixir: describeCostGate({ cost: applyIpDiscount(3, ipDiscount), current: curIp, unit: GATE_UNITS.ip }),
    tonic: describeCostGate({ cost: applyIpDiscount(2, ipDiscount), current: curIp, unit: GATE_UNITS.ip }),
    magicTent: describeCostGate({ cost: applyIpDiscount(4, ipDiscount), current: curIp, unit: GATE_UNITS.ip }),
    elementalShard: describeCostGate({ cost: applyIpDiscount(2, ipDiscount), current: curIp, unit: GATE_UNITS.ip })
  };
  const bondInspireGate = describeCostGate({ cost: 1, current: fpCurrent, unit: GATE_UNITS.fp });
  // 屬性還沒指派完 → 六項數值不成立（見 `calculateCharacterStats` 的 `attributesUnset`）
  const statsUnset = Boolean(stats.attributesUnset);
  const isReadyToLevelUp = canLevelUp(character);

  /* ── 狀態異常的顯示列（2026-10-30，P7）─────────────────────────
     順序與效果碼**全部從資料層推導**（`STATUS_AFFLICTION_ORDER` ＋ `affectedStats`），
     這裡不決定任何一個字。所以改資料就會改畫面，不會出現「畫面寫 A、資料是 B」。
     這一支沒有任何 setter，切換仍然走既有的 `handleToggleAffliction`。 */
  const afflictionRows = buildAfflictionRows();

  /* ── 資源變動的即時回饋（2026-10-30，P5-a）─────────────────────
     每個值各一支 hook，回傳的是「剛剛那一下」的增減（0.9 秒後自己消失）。
     刻意**不寫入任何地方**：這是視覺回饋，不是記錄——記錄是履歷的工作，
     而履歷記的是「發生過什麼」，這裡講的是「你剛剛按了什麼」。

     為什麼放在 `if (!character) return null` 之後仍然安全：這四個值都從
     `character` 派生，而父層只在有角色時才掛這個元件（同下方既有的 useMemo）。 */
  const hpDelta = useResourceDelta(curHp);
  const mpDelta = useResourceDelta(curMp);
  const ipDelta = useResourceDelta(curIp);
  const expDelta = useResourceDelta(Number(character.exp) || 0);

  /* ── 錢包的回饋（2026-10-31，P9）────────────────────────────────
     上面四條是「比率型」資源，浮字飄在條子上方的空白。
     錢包是「存量型」：它沒有上限、沒有條、卡片上也沒有空白，
     所以浮字改成**行內版**貼在金額右側（`inline`，見 ResourceDeltaBadge）。

     `?? null` 不是防禦性寫法：`useResourceDelta` 只接受真正的數字，
     `null` 代表「不知道」→ 不畫。傳 `|| 0` 的話，舊存檔沒有 `zenit` 時
     會浮出一個假的 `-500`（MEMORY §D.21 的空值語意）。 */
  const zenitDelta = useResourceDelta(character.zenit ?? null);

  /* 最近一筆動到錢的履歷（推導，零寫入）。
     錢包卡只說「現在有多少」，它不說「為什麼是這個數字」。
     這一筆就是那句話——而且它對舊存檔一樣有效，因為它讀的是既有的 `log`。 */

  /* 武器名 → 武器定義。只給「雙手武器佔滿兩個手部欄位」這一條規則用。
     定制武器也要進來，否則在跑團面板買一把自己鍛的雙手武器時，副手不會被清空
     ——而那正是玩家最可能買的一把（他特地鍛的）。 */
  const weaponByName = useMemo(() => new Map([
    ...((rulesData.equipment?.weapons) || []).map((weapon) => [weapon.name, weapon]),
    ...buildCustomWeaponEntries(character).map((weapon) => [weapon.name, weapon])
  ]), [character]);

  /* ── 角色檔案（2026-10-30，P5-b）────────────────────────────────
     性別與背景是玩家自己寫的散文，跑團時卻一次都看不到。
     這裡只**讀**：`buildDossier` 沒有任何 setter，要改請去「構築與成長」第 6 步。 */
  const [isDossierOpen, setIsDossierOpen] = useState(initialDossierOpen);
  const dossier = buildDossier(character);
  const dossierTeaser = dossier.teaser
    || (dossier.backgroundEmpty ? '背景尚未填寫' : '');

  // 場次（2026-10-30）：進行中的那一場與它的即時小結。
  // 小結全部由這一場的記錄推導，不另存統計欄位——同 `summarizeLog` 的原則。
  // 沒有開場時是空集合，畫面顯示「尚未開場」，不會謊報一個第 0 場。
  const activeSessionNumber = getSessionNumber(character);
  const sessionSummary = useMemo(
    () => summarizeSession(
      activeSessionNumber === null ? [] : getSessionEntries(character, activeSessionNumber)
    ),
    [character, activeSessionNumber]
  );

  /**
   * 「跨 modal 生命週期」的 callback 要讀**當下**的角色，不是被打開那一刻的角色。
   *
   * 擲骰器是另一個元件的 state（`App` 的 `diceModalConfig`）：`openCharacterDice`
   * 把 callback 塞進 config 之後，HUD 再怎麼重渲染，那份閉包都不會更新。
   * 於是「激勵羈絆 → 重擲」兩次都從同一個 FP 值開始算——UI 顯示扣了 2 點、
   * 存檔只扣 1 點。那不是延遲，是**兩份事實**。
   *
   * 一般點擊用的 `updateField` 不需要這個（每次 render 都重建閉包，永遠是最新的）。
   */
  const characterRef = useRef(character);
  // 頁名條上的「▲ 指令」要能跳回指令窗（P13）
  const hubRef = useRef(null);
  characterRef.current = character;

  /**
   * 寫入角色，並**同步**更新 ref。
   *
   * `onChange` 是 React 的 setState，要等下一次 render 才生效。而同一輪事件裡
   * 可能連續寫兩次——重擲就是：先扣 FP（`onSpendFp`），再寫履歷（`onRecordRoll`）。
   * 第二次若讀 `character` 閉包或「還沒 render 的 ref」，拿到的是**這一輪開始前**的角色，
   * 於是把第一次的 FP 變化蓋掉（UI 說扣 2、存檔只扣 1）。
   *
   * 所以 ref 在 `commit` 就更新，不等 render。所有寫入都走這裡。
   */
  const commit = (next) => {
    characterRef.current = next;
    onChange(next);
  };

  /**
   * 所有數值變更的唯一出口。
   * `meta` 有值時會留下一筆成長履歷（見 utils/characterLog.js）——
   * HP／MP／IP／EXP／資金／物語點都是「跑團中一路記錄」的對象。
   * `from` 一律傳**顯示值**（currentHp 的 null 代表滿血，記錄裡不該出現 null）。
   */
  const updateField = (field, val, meta = null) => {
    const before = characterRef.current;
    const base = {
      ...before,
      [field]: val,
      updatedAt: new Date().toISOString()
    };
    commit(meta ? loggableChange(before, base, meta) : base);
  };

  /* ── 效果流程（`data/effectFlows.json` ＋ `utils/effectFlow.js`）────────────
     373 條規則物件裡，以前只有 38 條真的「做得到」——其餘的在卡上寫著效果，
     按不到、算不出、記不住。這裡是那 335 條的**唯一操作入口**：

       · 計數器（`counter`）→ 加減與重置，值存在 `character.flowState[item.id]`
       · 開關（`toggle`）  → 本次場景／回合的旗標
       · 按鈕（`button`）  → `flowActionPlan` 算出「會發生什麼」，再一次寫入

     **寫入只有一條路**：`applyFlowPlan`。它與 HP／MP 那些步進器共用 `commit`
     ＋`loggableChange`，所以履歷上的「使用【X】」與「回復 HP」長得一樣、
     而且不會出現「UI 說扣了、存檔沒扣」（同 `handlePurchase` 的理由）。 */
  const applyFlowPlan = (plan) => {
    if (!plan || !plan.ok) {
      if (plan?.reason && typeof showToast === 'function') showToast(plan.reason, 'warning');
      return;
    }
    const before = characterRef.current;
    const base = {
      ...before,
      ...(plan.patch || {}),
      updatedAt: new Date().toISOString()
    };
    commit(plan.log ? loggableChange(before, base, plan.log) : base);
    if (plan.toast && typeof showToast === 'function') showToast(plan.toast, 'success');
  };

  /** 計數器加減／重置：只寫 `flowState`，不進履歷（那不是「發生了什麼事」，是一個刻度）。 */
  const adjustFlowCounter = (item, nextState) => {
    const before = characterRef.current;
    const clamped = clampFlowState(before, item, nextState);
    commit(withFlowState(before, item.id, clamped));
  };

  /**
   * 一條條目的控件（沒有控件就回 `null`）。
   *
   * `apply.via === 'existing'` 的條目**不畫操作控件**：那 38 條已經有專屬面板在做
   * （修補匠工坊、牌桌、召喚流程…），再畫一顆按鈕等於同一個效果兩條扣款路徑——
   * 而重複扣款在畫面上完全看不出來。
   */
  const renderFlowControls = (item, sl, testId) => {
    if (!item) return null;
    if (item.apply?.via === 'existing') return null;
    if (specFor(item.id)) return null;
    if (!item.control || item.control.kind === 'none') return null;
    const state = readFlowState(character, item);
    // 上限算式會用到**其他技能的 SL**（【陷阱大師】的「1 + 有備無患SL」）。
    // 這一份是角色身上所有技能 SL 的快照，交給元件去算；沒有它那兩條會一直顯示成「無上限」。
    const vars = flowVarsFor(character);
    let costBlocked = null;
    if (item.control.kind === 'button') {
      const plan = flowActionPlan(item, character, { sl, level: characterLevel, stats });
      if (!plan.ok) costBlocked = { blocked: true, reason: plan.reason || '現在不能使用' };
    }
    return (
      <SkillFlowControls
        item={item}
        sl={sl}
        level={characterLevel}
        vars={vars}
        theme={theme}
        state={state}
        costBlocked={costBlocked}
        onAdjust={(delta) => adjustFlowCounter(item, { ...state, n: state.n + delta })}
        onReset={() => adjustFlowCounter(item, flowResetState(character, item))}
        onToggle={() => adjustFlowCounter(item, { ...state, on: !state.on })}
        // `select`（第三期）：「選一個」的條目。【類別訓練】的所選類別就寫在這裡，
        // 引擎（`getProficiencies`）讀 `flowState[id].choice` 才知道要給哪一項熟練度。
        onChoice={(value) => adjustFlowCounter(item, { ...state, choice: value })}
        onAct={() => applyFlowPlan(flowActionPlan(item, character, { sl, level: characterLevel, stats }))}
        testId={testId}
      />
    );
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

  // 錢包上的 `−`／`+` 步進器在 P10 移除（使用者：「不要有 +- 和自己修改內容了」）。
  // 這不只是「使用者說要」：那顆按鈕寫的是 `kind: 'zenit'`（合併成一筆「支出資金 350 → 300」），
  // **沒有原因**；而 P9-b 之後每一筆錢都走 `applyMoneyFlow`／`applyPurchase`（原因必填）。
  // 留著它等於留著第二條寫入路，而那條路寫出來的帳對不上明細。

  /** 打開收支對話框，並決定它從哪個方向開始（錢包上的「收入」／「支出」共用這一個）。 */
  const openMoneyFlow = (direction) => {
    setMoneyFlowDirection(direction === MONEY_DIRECTIONS.gain ? MONEY_DIRECTIONS.gain : MONEY_DIRECTIONS.spend);
    setIsMoneyFlowOpen(true);
  };

  /**
   * 購入一件裝備（P9，2026-10-31）。
   *
   * 這是「錢」第一次真的參與一件事：**扣款、入袋、留痕在同一次寫入裡完成**。
   * 三個欄位（`zenit`／`equipment`／`log`）分兩次 `onChange` 會出兩種事：
   * 第二次讀到的是這一輪開始前的角色（MEMORY §D.24），於是「UI 扣了 200、
   * 存檔只扣一次」或「裝備進去了、錢沒扣」。
   *
   * 實際的算術與履歷格式都在 `applyPurchase`（P9-b 抽出去的純函式）——
   * 編輯器的「已定稿角色換裝備」走的是同一支。這個函式只負責
   * **讀最新的角色 → 存檔 → 關窗 → 說話**。
   */
  const handlePurchase = (item, { equip = false, spec = null } = {}) => {
    const before = characterRef.current;
    const result = applyPurchase(before, item, {
      equip,
      slotLabel: equip && item?.slot ? (EQUIPMENT_SLOTS[item.slot]?.label || '') : '',
      // 雙手武器換上主手時副手必須空出（Core p.126）。這條判定住在 `equipmentRules`，
      // 由呼叫端傳進來——否則同一條規則會有兩份實作。
      //
      // 現場寫的那把武器**還沒進 `character.customWeapons`**，所以不在 `weaponByName` 裡。
      // 不補進去的話「買一把雙手的自訂武器」會漏掉清空副手這一步——
      // 而且會安靜地漏：武器裝上去了、盾也還在，畫面上兩個格子都有東西。
      resolveEquipment: (equipment, slot, name) => {
        const map = spec
          ? new Map([...weaponByName, [spec.name, buildCustomWeaponEntry(spec)]])
          : weaponByName;
        return applyEquipmentChoice(equipment, slot, name, map);
      }
    });

    // `ok: false` 只有兩種原因（買不起／錢包未記錄），兩種都要說話。
    // 說「買不起」與說「不知道你有多少錢」是兩件事，所以文案從 `gate` 來。
    if (!result.ok) {
      const gate = result.gate || describePurchase({ price: item?.cost, wallet: before.zenit });
      showToast(
        gate.shortText ? `資金不足：${gate.shortText}` : '錢包金額尚未記錄，無法結帳',
        'warning'
      );
      return;
    }

    // 現場寫的那把武器要**同時**存進 `customWeapons`，而且要在同一次 `commit` 裡：
    // 只留一筆交易的話，玩家把這把劍換下來之後就再也裝不回去——
    // 裝備欄存的是名字，而沒有任何地方記得「這把劍存在」。
    commit(spec ? attachCustomWeapon(result.character, spec) : result.character);
    // 同一支也會被行囊分頁的單槽選擇器呼叫；兩個彈窗都關，避免「買完之後
    // 底下的選擇器還開著、而且還停在舊的槽位」。
    setSlotPicker(null);
    // 一句話講完三件事：買了什麼 → 錢動多少 → 還剩多少。
    // 副手被清掉時要另外說：那是玩家沒有要求、但規則替他做了的改動。
    const toast = describeMoneyToast(result);
    showToast(
      result.cleared
        ? `${toast}（副手「${result.cleared}」已卸下——雙手武器佔滿兩個手部欄位）`
        : toast,
      'success'
    );
  };

  /**
   * 記一筆收支（P9-b）：住宿、餐費、報酬……**原因必填**。
   *
   * 與購買的差別只在「錢從哪來／為什麼走」，寫入路徑完全一樣（都走 `applyMoneyFlow`／
   * `applyPurchase` → `loggableChange`），所以履歷上不會出現兩種記帳法。
   */
  const handleMoneyFlow = (input) => {
    const before = characterRef.current;
    const result = applyMoneyFlow(before, input);

    if (!result.ok) {
      // 三個欄位的錯誤各有各的話；這裡只挑第一個非空的說，因為 toast 只有一行。
      const errors = result.flow?.errors || {};
      const first = errors.amount || errors.reason || errors.wallet;
      showToast(first || '這筆收支還沒填完', 'warning');
      return;
    }

    commit(result.character);
    setIsMoneyFlowOpen(false);
    showToast(describeMoneyToast(result), 'success');
  };

  /**
   * 行囊分頁換裝（P9-b）。
   *
   * 兩種情況分開處理，因為它們**不是同一件事**：
   *   - 已持有（在別的槽）→ 只是換位置。收第二次錢會讓「守護者把盾從副手換到主手」
   *     變成一個要付費的動作，而玩家其實一件東西都沒買。
   *   - 沒有 → 走 `handlePurchase`，與購買面板完全同一條路（含買不起的擋法）。
   *
   * 換位置用 `kind: 'equipment'`（不合併、標題帶品名），
   * 而不是 `trade`——履歷上的「交易」必須真的動到錢。
   */
  const handleEquipFromPack = (item, { owned = false, spec = null } = {}) => {
    const before = characterRef.current;

    if (!owned) {
      handlePurchase(item, { equip: true, spec });
      return;
    }

    const slotLabel = EQUIPMENT_SLOTS[item.slot]?.label || '';
    const equipment = { ...(before.equipment || {}) };

    // 同一件東西不得同時佔兩個槽：從原本那個槽拿下來。
    // 不這樣做的話，「換到主手」之後副手還留著同一個名字，而畫面上兩格都說有盾。
    Object.keys(EQUIPMENT_SLOTS).forEach((key) => {
      if (key !== item.slot && equipment[key] === item.name) {
        equipment[key] = EQUIPMENT_SLOTS[key].emptyValue;
      }
    });

    // 再過一次規則層：這一件若是雙手武器，副手仍然要空出。
    const { equipment: finalEquipment, clearedOffHand } = applyEquipmentChoice(
      equipment,
      item.slot,
      item.name,
      weaponByName
    );

    const from = before.equipment?.[item.slot] || '';
    const changes = [{ field: item.slot, from, to: item.name }];
    if (clearedOffHand) {
      changes.push({ field: 'offHand', from: clearedOffHand, to: '無盾牌' });
    }

    commit(loggableChange(
      before,
      { ...before, equipment: finalEquipment, updatedAt: new Date().toISOString() },
      {
        kind: 'equipment',
        title: `換上 ${item.name}`,
        note: `裝備到${slotLabel}`,
        changes
      }
    ));

    setSlotPicker(null);
    showToast(`${item.name} 已換到${slotLabel}（已持有的裝備，不另收費）`, 'success');
  };

  /**
   * 物語點的**唯一**寫入出口（P12，2026-11-02）。
   *
   * 以前這裡是 `adjustFp(delta)`——一個沒有原因的 `−1`／`+1`。
   * 現在連擲骰器的回呼都走這支，所以「重擲」與「激勵羈絆」留下的履歷
   * 真的寫著它們的名字，而不是兩筆一模一樣的「消耗物語點 3 → 2」。
   *
   * 讀 ref 而不是閉包：這個函式會被塞進擲骰器的 config（`onSpendFp`／`onGainFp`），
   * 在 modal 開著的整段時間裡被呼叫多次。用閉包的話第二次會從同一個舊值起算，
   * UI 說扣了 2 點、存檔只扣 1 點。
   *
   * 失敗時**什麼都不寫**，也不靜默——把第一個錯誤丟給 toast。
   * 靜默失敗會讓玩家以為扣到了（畫面沒變，但他已經按下去了）。
   */
  const applyFpFlow = (input) => {
    const result = applyFabulaPointsFlow(characterRef.current, input);
    if (!result.ok) {
      const reason = result.flow.errors.amount
        || result.flow.errors.reason
        || result.flow.errors.current
        || '物語點沒有變動';
      showToast(reason, 'error');
      return result;
    }
    commit(result.character);
    return result;
  };

  /** 打開物語點對話框，並決定它從哪個方向開始（卡片上的「獲得」／「消耗」共用一個）。 */
  const openFpFlow = (direction) => {
    setFpFlowDirection(direction === FP_DIRECTIONS.gain ? FP_DIRECTIONS.gain : FP_DIRECTIONS.spend);
    setIsFpFlowOpen(true);
  };

  /**
   * 把一擲寫進成長履歷（P8）。
   *
   * 「值不值得記」的判定在這裡，不在擲骰器——那邊只回報事實（`auto: true`）。
   * 自動的只有大成功／大失敗會過關；玩家手動按「記下這一擲」的一律寫，
   * 因為那是他的判斷，不是系統的。
   *
   * 擲骰**不改變任何欄位**，所以 `before` 與 `after` 是同一個物件——
   * 靠 `title` 讓 `loggableChange` 認出「確實發生了一件事」。
   * 讀 ref 的理由同上：這個 callback 在 modal 生命週期內被呼叫。
   */
  const recordRoll = (outcome, info = {}) => {
    const isAuto = info.auto === true;
    if (isAuto && !shouldAutoRecordRoll(outcome)) return;
    const record = buildRollRecord(outcome, {
      label: info.label,
      die1Type: info.die1Type,
      die2Type: info.die2Type,
      fpBonus: info.fpBonus,
      bondName: info.bondName,
      reroll: info.reroll === true
    });
    if (!record) return;
    const latest = characterRef.current;
    commit(loggableChange(latest, latest, {
      kind: 'dice',
      title: record.title,
      note: record.note
    }));
  };

  // 呼叫全域擲骰器時自動附帶角色特質、羈絆與物語點回呼（支援重擲、羈絆激勵與大失敗領取 FP）
  const openCharacterDice = (config) => {
    if (!onOpenDice) return;
    onOpenDice({
      ...config,
      character,
      // 擲骰留痕：擲骰器每次擲完都回報一次，這裡決定要不要寫進履歷。
      onRecordRoll: recordRoll,
      onSpendFp: (reason) => {
        const result = applyFpFlow({ direction: FP_DIRECTIONS.spend, amount: 1, reason });
        if (result.ok) showToast(describeFabulaPointsToast(result), 'success');
      },
      onGainFp: (reason) => {
        const result = applyFpFlow({ direction: FP_DIRECTIONS.gain, amount: 1, reason });
        if (result.ok) showToast(describeFabulaPointsToast(result), 'success');
      }
    });
  };

  const handleResetScope = (scope) => {
    const nextChar = resetFlowScope(character, scope);
    if (nextChar === character) {
      showToast(`目前沒有【${resetScopeLabel(scope)}】可重置的條目`, 'info');
      return;
    }
    const items = characterFlowItems(character).map((ci) => ci.item);
    const count = items.filter((it) => controlsOf(it).some((ctrl) => ctrl?.reset === scope)).length;
    onChange({
      ...nextChar,
      updatedAt: new Date().toISOString()
    });
    showToast(`已重置 ${count} 條【${resetScopeLabel(scope)}】效果`, 'info');
  };

  // 營地／旅店一鍵休整（Core p.91：回滿 HP 與 MP，並解除所有異常狀態）
  const handleCampRest = () => {
    const clearedAff = {};
    Object.keys(STATUS_AFFLICTIONS).forEach(k => { clearedAff[k] = false; });
    // 營地活動的「本次休息已使用」必須跟著休整一起回充（原書 p.131 的效益都在休息時結束）。
    // 以前這裡只回滿 HP/MP，`used` 還亮著 → 玩家休完整團卻看到「已使用」，
    // 只能自己去營地區塊按那顆小的「下一次休息」。兩件事其實是同一件事。
    const campBefore = normalizeCampActivities(character.campActivities);
    const campAfter = resetCampActivityUses(campBefore);
    const campReset = campBefore.used.length > 0;
    let nextChar = {
      ...character,
      currentHp: stats.maxHp,
      currentMp: stats.maxMp,
      statusAfflictions: clearedAff,
      ...(campReset ? { campActivities: campAfter } : {}),
      updatedAt: new Date().toISOString()
    };
    nextChar = resetFlowScope(nextChar, 'rest');
    const changes = [];
    if (curHp !== stats.maxHp) changes.push({ field: 'currentHp', from: curHp, to: stats.maxHp });
    if (curMp !== stats.maxMp) changes.push({ field: 'currentMp', from: curMp, to: stats.maxMp });
    onChange(loggableChange(character, nextChar, {
      kind: 'hp',
      title: '營地休整：回滿 HP／MP 並解除全部異常狀態',
      changes
    }));
    showToast(
      campReset
        ? '已完成營地休整！HP 與 MP 全滿、異常狀態已解除，營地活動次數也回充了。'
        : '已完成營地休整！HP 與 MP 全滿，所有異常狀態已解除。'
    );
  };

  /* ── 場次（2026-10-30）───────────────────────────────────────
     為什麼要有這兩顆按鈕：玩家記得的是「第七場我們在鐘塔上」，
     而履歷原本只有「HP 12 → 8」。場次是長期跑團唯一的分段單位。

     邊界一律由玩家決定：App 不自動開場、不自動收場，也不會因為
     「超過 N 小時」自己切一刀——那會把一次熬夜的長場切成兩場。
     ─────────────────────────────────────────────────────────── */
  const handleStartSession = () => {
    const next = startSession(character);
    if (next === character) {
      showToast('這一場還沒收場，先收場才能開下一場');
      return;
    }
    onChange(next);
    showToast(`第 ${getSessionNumber(next)} 場開始，這一場的變動會自動歸在一起`);
  };

  const handleEndSession = () => {
    const number = activeSessionNumber;
    const next = endSession(character, { note: sessionNote });
    if (next === character) {
      showToast('現在沒有進行中的場次');
      return;
    }
    onChange(next);
    setSessionNote('');
    setIsSessionModalOpen(false);
    showToast(`第 ${number} 場已收場，小結寫進成長履歷`);
    if (chapterSettlementItems(next).length > 0) {
      setIsChapterSettlementOpen(true);
    }
  };


  // 修補匠【秘密配方】SL（Core p.210：回復 HP/MP 消耗品額外 +SL×5，傷害消耗品額外 +SL）
  const secretFormulaSL = useMemo(() => {
    let sl = 0;
    (character.classes || []).forEach(cl => {
      if (normalizeClassName(cl.className) === '修補匠') {
        (cl.skills || []).forEach(sk => {
          if (normalizeSkillName(sk.name) === '秘密配方') sl += (sk.sl || 0);
        });
      }
    });
    return sl;
  }, [character.classes]);

  // Toggle Status Afflictions
  const handleToggleAffliction = (affKey) => {
    const curAff = character.statusAfflictions || {};
    const updated = {
      ...curAff,
      [affKey]: !curAff[affKey]
    };
    updateField('statusAfflictions', updated);
  };

  // 官方五種基本 IP 消耗品（Core p.104，自動計入修補匠【秘密配方】加值並記錄進成長履歷）
  const handleUseConsumable = (type) => {
    const remedyBonus = secretFormulaSL * 5;
    const shardBonus = secretFormulaSL;
    // 【大口袋】（英雄技能）：「使用庫存點時，消耗量減少 1（最小為 1）」。
    // 以前這裡是五個寫死的 3／3／2／4／2，選了這條英雄技能的角色照樣被扣 3 點，
    // 而且成本門檻、履歷標題、toast 四處都會繼續說「消耗 3 IP」——按鈕在說謊。
    const ipCostOf = (base) => applyIpDiscount(base, ipDiscount);
    if (type === 'remedy' || type === 'potion') {
      const cost = ipCostOf(3);
      if (curIp < cost) { showToast(`道具點不足 ${cost} 點（大補藥需 ${cost} IP）`, 'warning'); return; }
      const heal = 50 + remedyBonus;
      const nextIp = Math.max(0, curIp - cost);
      const nextHp = Math.max(0, Math.min(stats.maxHp, curHp + heal));
      const base = {
        ...character,
        currentIp: nextIp,
        currentHp: nextHp,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用大補藥（-${cost} IP，回復 ${heal} HP）`,
        changes: [
          { field: 'currentIp', from: curIp, to: nextIp },
          { field: 'currentHp', from: curHp, to: nextHp }
        ]
      }));
      showToast(`使用【大補藥】！回復 ${heal} 點 HP（消耗 ${cost} IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'elixir') {
      const cost = ipCostOf(3);
      if (curIp < cost) { showToast(`道具點不足 ${cost} 點（萬靈藥需 ${cost} IP）`, 'warning'); return; }
      const heal = 50 + remedyBonus;
      const nextIp = Math.max(0, curIp - cost);
      const nextMp = Math.max(0, Math.min(stats.maxMp, curMp + heal));
      const base = {
        ...character,
        currentIp: nextIp,
        currentMp: nextMp,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用萬靈藥（-${cost} IP，回復 ${heal} MP）`,
        changes: [
          { field: 'currentIp', from: curIp, to: nextIp },
          { field: 'currentMp', from: curMp, to: nextMp }
        ]
      }));
      showToast(`使用【萬靈藥】！回復 ${heal} 點 MP（消耗 ${cost} IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'tonic' || type === 'antidote') {
      const cost = ipCostOf(2);
      if (curIp < cost) { showToast(`道具點不足 ${cost} 點（滋補藥需 ${cost} IP）`, 'warning'); return; }
      const nextIp = Math.max(0, curIp - cost);
      const clearedAff = {};
      Object.keys(STATUS_AFFLICTIONS).forEach(k => { clearedAff[k] = false; });
      const base = {
        ...character,
        currentIp: nextIp,
        statusAfflictions: clearedAff,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用滋補藥（-${cost} IP，解除全部異常狀態）`,
        changes: [{ field: 'currentIp', from: curIp, to: nextIp }]
      }));
      showToast(`使用【滋補藥】！已解除所有異常狀態（消耗 ${cost} IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'elementalShard') {
      const cost = ipCostOf(2);
      if (curIp < cost) { showToast(`道具點不足 ${cost} 點（元素碎片需 ${cost} IP）`, 'warning'); return; }
      const dmg = 10 + shardBonus;
      const nextIp = Math.max(0, curIp - cost);
      const base = {
        ...character,
        currentIp: nextIp,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用元素碎片（-${cost} IP，造成 ${dmg} 點${shardElement}屬性傷害）`,
        changes: [{ field: 'currentIp', from: curIp, to: nextIp }]
      }));
      showToast(`投擲【元素碎片】！對單一目標造成 ${dmg} 點【${shardElement}】傷害（消耗 ${cost} IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'magicTent') {
      const cost = ipCostOf(4);
      if (curIp < cost) { showToast(`道具點不足 ${cost} 點（魔法帳篷需 ${cost} IP）`, 'warning'); return; }
      const nextIp = Math.max(0, curIp - cost);
      const clearedAff = {};
      Object.keys(STATUS_AFFLICTIONS).forEach(k => { clearedAff[k] = false; });
      const base = {
        ...character,
        currentIp: nextIp,
        currentHp: stats.maxHp,
        currentMp: stats.maxMp,
        statusAfflictions: clearedAff,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用魔法帳篷（-${cost} IP，野外休息回滿 HP／MP 並清狀態）`,
        changes: [
          { field: 'currentIp', from: curIp, to: nextIp },
          ...(curHp !== stats.maxHp ? [{ field: 'currentHp', from: curHp, to: stats.maxHp }] : []),
          ...(curMp !== stats.maxMp ? [{ field: 'currentMp', from: curMp, to: stats.maxMp }] : [])
        ]
      }));
      showToast(`搭設【魔法帳篷】完成野外休息！HP／MP 全滿且異常狀態全解（消耗 ${cost} IP，剩餘 ${nextIp} IP）`, 'success');
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
          desc: `【${cl.className}】技能`,
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
    if (!selectedSkillForLevelUp) {
      showToast('請選擇要升級的職業與技能');
      return;
    }

    // ── 出口 A：這一點投進職業魔石（p.134）────────────────────────────
    // 不碰 `char.classes`：那一點沒有進固有職業，而是讓某顆魔石升級。
    // 角色等級照樣 +1（那是獨立的計數器），所以升級後「職業技能總和」會小於
    // 角色等級——合法，`isLevelMatched` 在魔晶石制下已放寬成「不得超過」。
    if (levelUpIsMnemosphere) {
      const updatedM = applyLevelUp(character, {
        className: levelUpMnemosphere.className,
        skillName: selectedSkillForLevelUp,
        mnemosphereId: levelUpMnemosphere.id
      });
      onChange(loggableChange(character, updatedM, {
        kind: 'levelup',
        title: `升級：職業魔石【${withEn(levelUpMnemosphere.className)}】${selectedSkillForLevelUp}`,
        fields: ['level', 'exp']
      }));
      setIsLevelUpModalOpen(false);
      setLevelUpTarget('class');
      setSelectedMnemosphereForLevelUp('');
      setSelectedSkillForLevelUp('');
      showToast(`恭喜！等級提升至 Level ${updatedM.level}，魔石也長了一級！`);
      return;
    }

    // ── 出口 B：投進職業（既有職業，或 p.228 的「第一次拿到某個職業」）──────────
    if (!levelUpSelectedClassName) {
      showToast('請選擇要升級的職業與技能');
      return;
    }

    const updated = applyLevelUp(character, {
      className: levelUpSelectedClassName,
      skillName: selectedSkillForLevelUp,
      isNewClass: levelUpSelectedIsNew
    });

    // 成長履歷：升級是最重要的一筆——等級、EXP，以及點在哪個職業的哪個技能
    onChange(loggableChange(character, updated, {
      kind: 'levelup',
      title: `升級：${withEn(levelUpSelectedClassName)}【${selectedSkillForLevelUp}】${levelUpSelectedIsNew ? '（新職業）' : ''}`,
      fields: ['level', 'exp']
    }));

    // 檢查升級後是否達成職業精通（Lv 10）或點了帶子項目的技能，給出跳轉編輯器提示橫幅
    const updatedClassEntry = (updated.classes || []).find(
      c => normalizeClassName(c.className) === normalizeClassName(levelUpSelectedClassName)
    );
    const reachedMastery = (updatedClassEntry?.level || 0) >= CLASS_MAX_LEVEL;
    const skillDefAfter = (rulesData.classes?.[normalizeClassName(levelUpSelectedClassName)]?.skills || [])
      .find(s => normalizeSkillName(s.name) === normalizeSkillName(selectedSkillForLevelUp));
    const hasSuboptions = Boolean(skillDefAfter?.suboptions);
    if (reachedMastery || hasSuboptions) {
      setPostLevelUpHint({
        className: normalizeClassName(levelUpSelectedClassName),
        skillName: normalizeSkillName(selectedSkillForLevelUp),
        reachedMastery,
        hasSuboptions
      });
    }

    setIsLevelUpModalOpen(false);
    setSelectedClassForLevelUp('');
    setSelectedSkillForLevelUp('');
    showToast(`恭喜！等級提升至 Level ${updated.level}！`);
  };

  // 開啟編輯既有羈絆彈窗
  const handleOpenEditBond = (bond) => {
    // 名冊可能在這張卡開著的期間變過（去 NPC 工坊改了名字、刪了一張卡），
    // 所以進編輯的當下重讀一次，畫面才不會拿著舊快照判斷「連結還在」。
    refreshNpcPool();
    setEditingBondId(bond.id);
    setEditBondTarget(bond.target || '');
    setEditBondFeelings(Array.isArray(bond.feelings) ? [...bond.feelings] : []);
    setEditBondNpcId(typeof bond.npcId === 'string' ? bond.npcId : '');
  };

  // 儲存編輯後的既有羈絆（Core p.91：休息場景可調整羈絆情感）
  const handleSaveEditedBond = () => {
    if (!editingBondId) return;
    if (!editBondTarget.trim()) {
      showToast('請輸入羈絆對象名稱');
      return;
    }
    if (editBondFeelings.length === 0) {
      showToast('請至少保留 1 項情感');
      return;
    }
    const before = (character.bonds || []).find(b => b.id === editingBondId);
    const target = editBondTarget.trim();
    const updatedBonds = (character.bonds || []).map(b =>
      b.id === editingBondId
        // 「表單是完整的事實」：清掉連結就真的不再連。
        // 刪鍵與否的判斷在 `applyBondLinkFields`（那裡才測得到）。
        ? applyBondLinkFields({ ...b, target, feelings: editBondFeelings }, { npcId: editBondNpcId })
        : b
    );
    // 2026-10-30：這裡原本傳 `kind: 'bond'`，但 `LOG_KINDS` 沒有這個詞彙
    // → `createLogEntry` 靜默拒收 → **羈絆調整從來沒有進過履歷**。
    // 現在詞彙補上了，而且標題寫出情感的前後變化（只寫「調整羈絆」看不出改了什麼）。
    const feelingText = (list) => (list || []).map(f => FEELING_LABELS[f] || f).join('、');
    updateField('bonds', updatedBonds, {
      kind: 'bond',
      title: describeBondEdit({
        target,
        feelingsFrom: feelingText(before?.feelings),
        feelingsTo: feelingText(editBondFeelings)
      }),
      fields: []
    });
    setEditingBondId(null);
    showToast(`已更新對【${target}】的情感羈絆！`);
  };

  // Equipments resolution
  const mainShieldEquipped = rulesData.equipment.shields.find(s => s.name === character.equipment?.mainHand);
  const offShield = rulesData.equipment.shields.find(s => s.name === character.equipment?.offHand);

  // 守護者【雙重盾牌】：兩手皆盾時合併視為「雙盾」，
  // 攻擊改用該技能的命中【MIG + MIG】與傷害【HR + 5】——盾牌本身沒有攻擊資料。
  // 魔晶石制下這條技能失效（科技奇幻手冊 p.133），所以要把團規帶進來。
  const dualShield = getDualShieldState(character, {
    mainIsShield: Boolean(mainShieldEquipped),
    offIsShield: Boolean(offShield),
    technosphereMode: resolveCreationRules(character?.creationRules).technospheres
  });

  // 定制武器（HF p.106）也是武器：官方武器表找不到時，改找**這個角色自己鍛造的那些**。
  // 沒有這一段的話，主手是定制武器時跑團面板會退回一個沒數值的空殼（命中 DEX+MIG、HR+0），
  // 玩家在衝突中看到的就是錯的數字。
  const ownCustomWeapons = buildCustomWeaponEntries(character);
  const resolveWeapon = (name) => rulesData.equipment.weapons.find(w => w.name === name)
    || ownCustomWeapons.find(w => w.name === name);

  // 空手道的徒手傷害加成（F-024，2026-10-27）。
  // 引擎已經把它併進 `stats.mainHandWeapon.damage`，但跑團面板的兩處徒手顯示
  // 都是**自己寫死 `HR + 0`** 的：① 主手空著時的退回條目、② 下面那顆「徒手／自由打擊」膠囊。
  // 兩處都要吃同一個數字，否則會出現「膠囊 +6、上面的主手武器 +0」這種自相矛盾。
  const unarmedBonus = stats.quirkEffects?.unarmedDamageBonus || 0;

  // 徒手時把加成併進傷害式。這一步對「武器表查到的徒手打擊」與「查不到時的退回條目」
  // 都成立（兩者的基礎都是 `HR + 0`），所以只寫一次。
  const mainWeaponBase = dualShield.active
    ? dualShield.weapon
    : (resolveWeapon(character.equipment?.mainHand) || {
        name: character.equipment?.mainHand || '徒手打擊',
        attr: 'DEX + MIG',
        damage: '【HR + 0】物理',
        range: '近戰',
        category: '鬥毆'
      });
  const mainWeapon = (mainWeaponBase.name === '徒手打擊' && unarmedBonus > 0)
    ? { ...mainWeaponBase, damage: withHrBonus(mainWeaponBase.damage, unarmedBonus) }
    : mainWeaponBase;

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
  // 徒手打擊的傷害式不再在這裡寫死。原本這裡有一行
  // `const unarmedDamage = parseDamageFormula('【HR + 0】物理')`，宣告了卻從沒被用過——
  // 真正顯示的地方自己又寫了一次 `[HR + 0]`。兩份寫死的字串就是 F-024 的成因，
  // 所以移除這一行，改由上面 `unarmedBonus`（來自引擎）統一供應。

  // Toggle expand for skills/spells
  const toggleSkillExpand = (key) => {
    setExpandedSkills(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSpellExpand = (key) => {
    setExpandedSpells(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Add spell to character
  //
  // 2026-11-02：以前這裡只有「重複」一道檢查，所以任何角色都能把規則庫的 38 條咒語
  // 一條一條灌進 `character.spells`——咒語在《FU》裡不是自由選購的。
  // 現在多兩道：學派必須是這個角色真的有額度的那一份，而且額度不能是 0。
  const handleLearnSpell = (spell) => {
    const currentSpells = resolveCharacterSpells(character);
    const resolved = resolveSpellEntry(spell);
    if (currentSpells.some(s => s.name === resolved.name)) {
      showToast('已掌握此咒語');
      return;
    }

    const grants = describeSpellGrants(character, currentSpells);
    if (!grants.allowedSchools.includes(resolved.school)) {
      showToast(`【${resolved.school}】不在你的咒語清單裡——咒語只能經由職業技能取得`, 'warning');
      return;
    }
    if (!grants.canLearn) {
      showToast(grants.hasExtraGrant
        ? `咒語額度已滿（${grants.used} / ${grants.capacity}），再學要等升級或再拿一次【額外咒語】`
        : `咒語額度已滿（${grants.used} / ${grants.capacity}）——提升對應魔法技能的 SL 才會多一格`, 'warning');
      return;
    }

    const newSpells = [...currentSpells, resolved];

    updateField('spells', newSpells);
    showToast(`已掌握咒語【${resolved.name}】！`);
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

  // 開啟「建立羈絆」彈窗
  const handleOpenBondModal = () => {
    // 名冊要在玩家挑選的那一刻是新鮮的（可能剛從 NPC 工坊回來）。
    refreshNpcPool();
    setNewBondTarget('');
    setNewBondFeelings(['admiration']);
    setNewBondNpcId('');
    setIsBondModalOpen(true);
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
      feelings: newBondFeelings,
      // 空的連結**不寫鍵**，與舊存檔的形狀保持一致。
      ...buildBondLinkFields({ npcId: newBondNpcId })
    };
    updateField('bonds', [...currentBonds, newBond], {
      kind: 'bond',
      title: `締結羈絆【${newBond.target}】（${newBondFeelings.map(f => FEELING_LABELS[f] || f).join('、')}）`,
      fields: []
    });
    setNewBondTarget('');
    setNewBondFeelings(['admiration']);
    setNewBondNpcId('');
    setIsBondModalOpen(false);
    showToast('已建立新情感羈絆！');
  };

  const handleDeleteBond = (bondId) => {
    const target = (character.bonds || []).find(b => b.id === bondId);
    const updated = (character.bonds || []).filter(b => b.id !== bondId);
    updateField('bonds', updated, {
      kind: 'bond',
      title: target ? `解除羈絆【${target.target}】` : '解除羈絆',
      fields: []
    });
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
    updateField('clocks', [...currentClocks, newClock], {
      kind: 'clock',
      title: `建立命刻【${newClock.title}】（${newClock.totalSegments} 格）`,
      fields: []
    });
    setNewClockTitle('');
    setIsClockModalOpen(false);
    showToast('已建立新個人命刻！');
  };

  const handleDeleteClock = (clockId) => {
    const target = (character.clocks || []).find(c => c.id === clockId);
    const updated = (character.clocks || []).filter(c => c.id !== clockId);
    updateField('clocks', updated, {
      kind: 'clock',
      title: target ? `刪除命刻【${target.title}】` : '刪除命刻',
      fields: []
    });
    showToast('已刪除個人命刻');
  };

  // 咒語額度與儀式權限（2026-11-02）。放在元件頂層而不是分頁裡，是因為
  // 學習彈窗（MODAL 1）也要用它過濾清單——兩處各算一次就會漂移。
  const spellGrants = useMemo(
    () => describeSpellGrants(character, resolveCharacterSpells(character)),
    [character]
  );
  const ritualRights = useMemo(() => describeRitualRights(character), [character]);

  // Filter available spells for modal
  const availableRulesSpells = useMemo(() => {
    const spells = rulesData.spells || [];
    // 彗星／火山／希望／瘴氣四條標了 `grantOnly`：官方只能由**點名授予**的英雄技能取得，
    // 不能當成「這個學派的普通咒語」在清單裡挑。沒有這道過濾，元素師一打開清單
    // 就會看到【火山】——而他的元素魔法學派根本不該給他那一條。
    const grantedNames = new Set(
      (spellGrants.grants || [])
        .map((g) => g.spell)
        .filter(Boolean)
    );
    return spells.filter(s => {
      // 只列出「這個角色真的有額度、而且清單對得上」的咒語。
      // 沒有授予來源時 `allowedSchools` 是空的，清單就是空的——這正是官方規則，
      // 不是資料沒載入。空清單的解釋由彈窗自己給。
      if (s.grantOnly && !grantedNames.has(s.name)) return false;
      if (!spellGrants.allowedSchools.includes(s.school)) return false;
      const matchSearch = (s.name || '').toLowerCase().includes(spellSearchQuery.toLowerCase()) ||
                          (s.effect || '').toLowerCase().includes(spellSearchQuery.toLowerCase());
      const matchSchool = selectedSpellSchool === 'all' || s.school === selectedSpellSchool;
      return matchSearch && matchSchool;
    });
  }, [spellSearchQuery, selectedSpellSchool, spellGrants.allowedSchools, spellGrants.grants]);

  // 原本這裡有一個 `spellSchools`（掃 rulesData 收集全部學派）給彈窗的下拉用。
  // 2026-11-02 起下拉只列「這個角色有額度的學派」（`spellGrants.allowedSchools`），
  // 它就成了死碼——宣告了卻沒有消費者的常量比沒有更糟，所以直接移除。

  const isInActiveCombat = useMemo(() => {
    const activeCombat = readJSON(STORAGE_KEYS.activeCombat, null);
    return Array.isArray(activeCombat?.combatants) && activeCombat.combatants.some(c => c && c.sourceId === character.id);
  }, [character.id, character.updatedAt]);

  return (
    /* 2026-11-03（使用者）：「上下滑動時頭像那個欄位應該要鎖住」＋「滑鼠指在左右邊就可以
       滑動相應的欄位，而不是在任何地方滑動大家一起動」。

       做法是把這一屏從「整頁一直往下長」改成**視口高度內的固定舞台**：
       根容器在 `lg` 以上鎖成 `100vh − 標頭 − 邊距`，中間那列 `flex-1 min-h-0`，
       於是捲動不再發生在 `<body>`，而是分別發生在左右兩翼自己的 `overflow-y-auto`。

       為什麼不是「中欄 sticky」就好：sticky 只保證它留在視窗裡，**整頁還是會捲**，
       而且滑到右翼底部時左翼指令窗會被推走。改成固定舞台之後，三欄各自釘在
       自己的位置上，只有「你想捲的那一欄」會動。

       `overscroll-contain` 是必要的：沒有它，某一欄捲到底之後滾輪會「傳染」給
       下一層容器（滾動鏈），又變回「大家一起動」。 */
    <div data-testid="play-hud-root" className="space-y-4 text-[#3c2415] animate-fade-in lg:flex lg:flex-col lg:gap-4 lg:space-y-0 lg:h-[calc(100vh-var(--chapter-header-h,52px)-2rem)] lg:min-h-[560px] lg:overflow-hidden">
      {/* 升級後若解鎖職業精通（Lv 10）或子項目技能，給出明確跳轉導引 */}
      {postLevelUpHint && (
        <div
          data-testid="post-levelup-banner"
          className="p-3.5 rounded bg-[#fffdf9] border-2 border-[#a63d40] flex items-center justify-between gap-3 flex-wrap"
        >
          <div className="text-xs text-[#3c2415] space-y-0.5">
            <div className="font-bold flex items-center gap-1.5 text-[#8c3235]">
              <GiLaurelCrown className="w-4 h-4 shrink-0" />
              <span>
                {postLevelUpHint.reachedMastery
                  ? `恭喜精通【${postLevelUpHint.className}】（Lv 10）！可獲得 1 個英雄技能名額`
                  : `【${postLevelUpHint.skillName}】需要挑選對應的子項目或法術`}
              </span>
            </div>
            <p className="text-t12 text-[#6b5a4b]">
              {postLevelUpHint.reachedMastery && postLevelUpHint.hasSuboptions
                ? '請前往「構築與成長」挑選此技能的子項目，並於第 5 步領取精通解鎖的英雄技能。'
                : postLevelUpHint.reachedMastery
                  ? '請前往「構築與成長」第 5 步挑選新解鎖的英雄技能。'
                  : '請前往「構築與成長」第 2 步挑選此技能的子項目（如咒語、舞步、曲風、符號等）。'}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {postLevelUpHint.hasSuboptions && onOpenEditor && (
              <button
                type="button"
                onClick={() => { setPostLevelUpHint(null); onOpenEditor(2); }}
                className="px-3 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-[#3c2415] font-bold text-xs"
              >
                挑選技能子項目 (步驟2)
              </button>
            )}
            {postLevelUpHint.reachedMastery && onOpenEditor && (
              <button
                type="button"
                onClick={() => { setPostLevelUpHint(null); onOpenEditor(5); }}
                className="px-3 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs"
              >
                領取英雄技能 (步驟5)
              </button>
            )}
            <button
              type="button"
              onClick={() => setPostLevelUpHint(null)}
              className="px-2 py-1 text-t11 text-[#7c6a58] hover:text-[#2c221e]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 1. JRPG 角色狀態與指令中樞（以角色肖像居中，左右環繞核心資源、檢定與戰術分頁按鈕） */}
      <div
        ref={hubRef}
        data-testid="jrpg-character-hub"
        className="rounded p-4 sm:p-5 space-y-4 border-2 transition-colors duration-200 overflow-clip"
        style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
      >
        <div
          data-testid="hud-theme-bar"
          className="h-1.5 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 transition-colors duration-200"
          style={{ backgroundColor: theme.accent }}
        />
        {/* Top Utility & Sync Bar */}
        <div
          data-testid="hud-utility-bar"
          className="flex items-center justify-between flex-wrap gap-2 border-b -mx-4 sm:-mx-5 -mt-4 px-4 sm:px-5 py-2.5 transition-colors duration-200"
          style={{ backgroundColor: theme.accentLight, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif font-black text-sm tracking-wider flex items-center gap-1.5" style={{ color: theme.textDark }}>
              <GiSparkles className="w-4 h-4" style={{ color: theme.accent }} />
              <span>JRPG 角色戰術主控台</span>
            </span>
            {isInActiveCombat && (
              <span
                data-testid="combat-sync-badge"
                className="px-2 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-t11 font-bold text-[#3c2415]"
                title="此角色目前在【戰鬥輪次】名單中，HP／MP／IP／FP 與異常狀態已啟用雙向即時同步"
              >
                ● 已連動戰鬥輪次
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {isReadyToLevelUp && (
              <button
                type="button"
                onClick={() => setIsLevelUpModalOpen(true)}
                className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1.5"
              >
                <GiUpgrade className="w-4 h-4" />
                <span>可升級！</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCampRest}
              className="px-3 py-1.5 rounded bg-[#fffdf9] hover:bg-[#f4ebd9] border text-xs font-bold transition-colors flex items-center gap-1.5"
              style={{ borderColor: theme.border, color: theme.textDark }}
              title="營地或旅店休息：一鍵回滿 HP 與 MP 並解除所有異常狀態"
            >
              <GiCampfire className="w-3.5 h-3.5" style={{ color: theme.accent }} />
              <span>營地休整</span>
            </button>

            <div className="flex items-center gap-1 border-l border-[#d6c7ab]/60 pl-2">
              <button
                type="button"
                data-testid="reset-scope-scene"
                onClick={() => handleResetScope('scene')}
                className="px-2 py-1 rounded bg-[#fffdf9] hover:bg-[#f4ebd9] border text-t10 font-bold transition-colors"
                style={{ borderColor: theme.border, color: theme.textDark }}
                title="重置場景效果"
              >
                重置場景
              </button>
              <button
                type="button"
                data-testid="reset-scope-rest"
                onClick={() => handleResetScope('rest')}
                className="px-2 py-1 rounded bg-[#fffdf9] hover:bg-[#f4ebd9] border text-t10 font-bold transition-colors"
                style={{ borderColor: theme.border, color: theme.textDark }}
                title="重置休息效果"
              >
                重置休息
              </button>
              <button
                type="button"
                data-testid="reset-scope-chapter"
                onClick={() => handleResetScope('chapter')}
                className="px-2 py-1 rounded bg-[#fffdf9] hover:bg-[#f4ebd9] border text-t10 font-bold transition-colors"
                style={{ borderColor: theme.border, color: theme.textDark }}
                title="重置章節效果"
              >
                重置章節
              </button>
            </div>

            <button
              onClick={handleSendToCombat}
              className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="將角色即時狀態同步至戰鬥追蹤器"
            >
              <GiCrossedSwords className="w-3.5 h-3.5" />
              <span>推入戰鬥</span>
            </button>

            <button
              onClick={() => setIsPreviewOpen(true)}
              className="px-3 py-1.5 rounded bg-white hover:bg-[#f4ebd9] border text-xs font-bold transition-colors flex items-center gap-1"
              style={{ borderColor: theme.border, color: theme.textDark }}
              title="看整張卡現在長什麼樣，也可以直接匯出 PNG／PDF"
            >
              <GiScrollUnfurled className="w-3.5 h-3.5" />
              <span>卡片預覽</span>
            </button>

            <button
              onClick={() => onOpenEditor()}
              className="px-3 py-1.5 rounded bg-white hover:bg-[#f4ebd9] border text-xs font-bold transition-colors flex items-center gap-1"
              style={{ borderColor: theme.border, color: theme.textDark }}
            >
              <span>構築與成長</span>
            </button>

            {onOpenLog && (
              <button
                onClick={onOpenLog}
                className="px-3 py-1.5 rounded bg-white hover:bg-[#f4ebd9] border text-xs font-bold transition-colors flex items-center gap-1"
                style={{ borderColor: theme.border, color: theme.textDark }}
                title="成長履歷：HP／MP／EXP／資金／升級／換裝的完整記錄"
              >
                <GiScrollQuill className="w-3.5 h-3.5" />
                <span>履歷</span>
              </button>
            )}
          </div>
        </div>

        {/* 本場狀態帶（2026-10-30）：長期跑團唯一的分段單位。
            玩家記得的是「第七場我們在鐘塔上」，而履歷原本只記得「HP 12 → 8」。
            沒開場時這條帶子只教一件事：按「開場」之後，變動才會歸在一起。 */}
        <div
          data-testid="session-strip"
          className="rounded border px-3 py-2 flex items-center justify-between flex-wrap gap-2"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-t11 font-bold flex items-center gap-1" style={{ color: theme.textDark }}>
              <GiScrollUnfurled className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
              <span>{activeSessionNumber === null ? '尚未開場' : `第 ${activeSessionNumber} 場 · 進行中`}</span>
            </span>
            {activeSessionNumber === null ? (
              <span className="text-t11" style={{ color: theme.textMuted }}>
                按「開場」之後，這一場的變動會自動歸在一起，收場時寫成一頁小結
              </span>
            ) : (
              <>
                <span className="text-t11" style={{ color: theme.textMuted }}>
                  自 {formatLogDate(character.activeSession?.startedAt)} 起
                </span>
                <span
                  className="text-t10 px-1.5 py-0.5 rounded border"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
                >
                  {sessionSummary.count} 筆
                </span>
                <span
                  className="text-t10 px-1.5 py-0.5 rounded border"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
                >
                  物語點 {sessionSummary.fpDelta >= 0 ? '+' : ''}{sessionSummary.fpDelta}
                </span>
                <span
                  className="text-t10 px-1.5 py-0.5 rounded border"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
                >
                  受傷 {sessionSummary.hpLost}
                </span>
                <span
                  className="text-t10 px-1.5 py-0.5 rounded border"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
                >
                  命刻 {sessionSummary.clockSteps} 格
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeSessionNumber === null ? (
              <button
                type="button"
                onClick={handleStartSession}
                className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t11 transition-colors"
              >
                開場
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(true)}
                className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t11 transition-colors"
              >
                收場
              </button>
            )}
          </div>
        </div>

        {/* 3-Column JRPG Hub Stage: Left Vitals & IP | Center Portrait & Command Ring | Right Attributes & Resources */}
        {/* P14 的副作用：左欄不再撐高之後，這一列的列高變成由中欄自己決定，
            立繪就從 813px 塌回 459px（寬 344 × 3:4）——那違反上一輪「圖必須是主體」
            的裁定（CY 段）。所以給這一列一個下限，圖才回得去。
            這也順便給指令窗留出 sticky 的移動距離。 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:auto-rows-[minmax(0,1fr)] gap-4 items-stretch lg:flex-1 lg:min-h-0">
          {/* LEFT WING（col-span-2）：DQ 指令窗
              ────────────────────────────────────────────────────────────
              P14 使用者原話：「不要这么宽松的话，我建议把左栏的长压缩，
              给右栏更多显示信息的空间」——所以欄寬 3 → 2、列高不再撐滿欄位。
              這裡原本是三張資源卡（HP／MP／IP）＋ 官方五種消耗品捷徑。
              三件事同時壞掉：
              1. 中欄的六顆指令格與下方 sticky 分頁列是**同一份六個標籤**——
                 同一份清單印兩次，這是「訊息太多」的來源之一。
              2. 最後一張 IP 卡吃 `flex-1`，再用 `justify-between` 把剩餘高度
                 丟到卡片中間 → 左翼一塊約 300px 的空白，看起來像壞掉。
              3. 資源與能力分在畫面兩側，跑團時眼睛要橫跨整個立繪。
              現在：左翼只放**一個指令窗**，八列各 44px（`self-start`＝窗貼齊頂端，
              不再被拉到和右翼一樣高）；HP／MP／IP 搬到右翼的狀態窗，與屬性、
              狀態異常放在一起；消耗品搬進行囊分頁。
              ──────────────────────────────────────────────────────────── */}
          {/* P14：指令窗**自己**釘住（`self-start` ＋ `sticky`）。
              右翼那扇窗換頁之後會很長（武器清單、咒語全文），捲下去之後
              如果指令窗跟著跑掉，就得再滾回來才能換頁——那正是使用者抱怨的
              「要特地滑下去」。釘住之後，捲到哪裡都還按得到指令。
              `top` 讀 `--chapter-header-h`（`ChapterHeader` 用 ResizeObserver
              寫上去），不是寫死 52——標頭是 `min-h-[52px]`，52 是下限。 */}
          {/* P14 的 sticky 在 2026-11-03 之後改成「固定舞台 ＋ 各欄自滾」：
              父層不再捲動，所以 sticky 沒有東西可以相對，指令窗只要
              `self-start`（貼齊頂端、不被拉伸）＋ 自己的 `overflow-y-auto`
              （指令變多時也不會把整頁推走）。 */}
          <div className="order-2 lg:order-none lg:col-span-2 lg:max-h-[calc(100vh-var(--chapter-header-h,52px)-9rem)] lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain flex flex-col gap-3 min-w-0">
            <HudWindow
              title="指令"
              icon={GiCrossedSwords}
              testId="hud-command-window"
              bodyClassName="flex flex-col"
              frameColor={theme.border}
              right={(
                <span className="text-t10 font-mono text-[#7c6a58] shrink-0">{hudTabItems.length} 項</span>
              )}
            >
              <HudCommandList
                items={hudTabItems}
                value={activeTab}
                onChange={setActiveTab}
                testId="hud-command-list"
                activeColor={theme.accent}
                activeBorder={theme.accentDark}
              />
            </HudWindow>
          </div>

          {/* CENTERPIECE (col-span-4): JRPG Character Portrait Standee & Surrounding Command Buttons */}
          <div
            data-testid="hud-center-column"
            className="order-1 lg:order-none lg:col-span-4 lg:max-h-[calc(100vh-var(--chapter-header-h,52px)-9rem)] lg:min-h-0 rounded p-4 border-2 bg-[#fffdf9] flex flex-col items-center justify-between text-center gap-3 overflow-hidden"
            style={{ borderColor: theme.border }}
          >
            <div
              className="h-1 w-full -mt-4 mb-1 shrink-0 transition-colors duration-200"
              style={{ backgroundColor: theme.accent, width: 'calc(100% + 2rem)' }}
            />
            {/* Portrait Frame & Identity（2026-11-02，P12-b）
                ─────────────────────────────────────────────────────────────
                使用者的原話（他對 Antigravity 說的，這一段我上一輪漏掉了）：
                  「照片太小了，必須要大的。……玩家們很多時候都是放人物完整立繪，
                    所以這個跑團卡必須完整呈現玩家的精美人設才行，圖必須是主體，
                    你放這麼小個頭像看什麼？」
                ─────────────────────────────────────────────────────────────
                所以頭像從 96/112px 的方框改成**整欄寬的直式立繪**（3:4），
                名字／身分／等級疊在圖的下緣，不再各佔一行。
                圖源優先用 `avatarRaw`（裁切前的原圖）：裁切過的方圖放進直式框
                會把人物切掉，而使用者要的是「完整」。

                **這裡刻意不用漸層**：名牌放在圖的下方、紙底深字，不壓在圖上。
                設計系統的「漸層只存在於登記過的檔案」是硬規則，而它抓的正是
                「一條吃主題色的漸層會變成第二套顏色系統」。
                ───────────────────────────────────────────────────────────── */}
            {/* 立繪吸收中欄剩下的高度（`flex-1`）：欄位用 `justify-between` 排，
                剩餘高度原本全部掉在「角色檔案」與指令格之間，變成一塊空白。
                空白餵給圖，圖就真的是主體。手機上欄位沒有固定高度，
                `flex-1` 分不到東西，`aspect-ratio` 就回到 3:4——同一段碼兩種情況都對。 */}
            {/* 2026-11-03（第二版）：框的高度改成**跟著圖片比例**，不再寫死 3:4。
                上一版是「框固定 3:4 ＋ 模糊鋪滿去補白」，使用者的評語是
                「同圖模糊放在上面真的很難看」——問題不在模糊，在**框沒有配合圖**。
                現在：`aspectRatio` 由圖片載入後的 `naturalWidth / naturalHeight` 決定，
                框和圖同比例時 `contain` 本來就不留白，模糊層自然退到看不見。
                只有比例過扁／過長被 `minHeight`／`maxHeight` 夾住時，才會露出襯底。
                外層 `justify-between` 讓常駐細條貼底，框與細條之間的空隙留在紙底上。 */}
            <div className="w-full gap-2 flex-1 flex flex-col min-h-0 justify-start">
              <div
                data-testid="hud-portrait"
                onClick={() => onOpenEditor()}
                className="relative w-full rounded border-2 overflow-hidden cursor-pointer group shadow-inner shrink-0"
                style={{
                  borderColor: theme.accent,
                  backgroundColor: theme.accentLight,
                  aspectRatio: portraitRatio || '3 / 4',
                  /* 極端比例（超寬或超長）會把中欄撐壞，所以兩端各夾一個界線。
                     上限用 `min(62vh, 100%)`：`100%` 是**這一欄分到的實際高度**
                     （2026-11-03 之後中欄不再被頁面捲動，高度是確定的），
                     `62vh` 是沒有父層約束時的兜底。被夾住時 `contain` 必然留白
                     ——那才輪到暈染上場。 */
                  minHeight: '240px',
                  maxHeight: 'min(62vh, calc(100% - 240px))'
                }}
                title="點擊前往「構築與成長」更換或調整角色立繪"
              >
                {portraitIsImage ? (
                  <div className="absolute inset-0">
                    {/* ① 暈染襯底（2026-11-03 第二版）。
                        它現在只在「框被 min/max 夾住」時才看得到——因為框與圖同比例時，
                        主體會把整個框填滿，這一層被完全蓋住。
                        參數刻意收斂：`blur-md`（不是 lg）、`scale-105`（不是 110）、
                        `opacity 0.28`。使用者說上一版「放在上面真的很難看」，
                        原因就是它太濃、放太大，變成第二張圖而不是背景。 */}
                    <img
                      src={portraitSrc}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover scale-105 blur-md"
                      style={{ opacity: 0.28 }}
                    />
                    {/* ② 主體：完整、不裁切、貼底。
                        `onLoad` 讀出真實比例回寫給框——這是「框隨圖」的唯一資訊來源。 */}
                    <img
                      src={portraitSrc}
                      alt={`${character.name || '角色'}的立繪`}
                      className="relative w-full h-full object-contain object-bottom"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (!img.naturalWidth || !img.naturalHeight) return;
                        const next = `${img.naturalWidth} / ${img.naturalHeight}`;
                        setPortraitRatio((prev) => (prev === next ? prev : next));
                      }}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <GameIcon
                      name={portraitSrc || character.classes?.[0]?.className || 'sword'}
                      className="w-20 h-20"
                      style={{ color: theme.accent }}
                    />
                    <span className="text-t12 font-bold" style={{ color: theme.accent }}>尚未上傳立繪</span>
                    
                  </div>
                )}

                {/* 等級與危機狀態貼在圖的角落，不另外佔版面 */}
                <div className="absolute top-2 left-2">
                  <JRPGBadge variant={theme.badgeVariant} size="sm">
                    Lv {getCharacterLevel(character)}
                  </JRPGBadge>
                </div>
                {isCrisis && (
                  <div className="absolute top-2 right-2">
                    <JRPGBadge variant="danger" size="xs" className="flex items-center gap-1">
                      <FUIcon name="crisis" className="text-xs leading-none" />
                      <span>危機</span>
                    </JRPGBadge>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-t12 font-bold">
                  更換立繪
                </div>
              </div>

              {/* 常駐狀態條（P14）
                  ─────────────────────────────────────────────────────────────
                  使用者的裁定是「按了按鈕就把右邊那扇窗整個替換掉」。
                  但 HP／MP／IP 不能跟著被換走——跑團時那是每 30 秒要看一次的東西，
                  換到「武器與戰鬥」就看不到自己剩多少血，那張卡就不能用了。
                  所以把它壓成一條常駐細條，掛在**立繪身上**（這三個數字本來就是
                  「這個角色現在怎麼樣」），右翼那扇窗才真的可以整個換掉。

                  純顯示、不寫入：步進器在「個人資料」頁，點這條就跳過去。
                  `statsUnset` 時印「—」而不是 0／0——「不知道」與「沒有」不一樣
                  （MEMORY §D.17）。
                  ───────────────────────────────────────────────────────────── */}
              <button
                type="button"
                data-testid="hud-vitals-strip"
                onClick={() => setActiveTab('profile')}
                title="點擊前往「個人資料」調整 HP／MP／IP"
                className="w-full shrink-0 rounded border px-2 py-1.5 text-left space-y-1 transition-colors hover:bg-[#f4ebd9]"
                style={{ borderColor: theme.border, backgroundColor: theme.panelBg }}
              >
                {[
                  // 顏色走 `gauge` 令牌（2026-11-03）：原本這裡是三個手寫 hex
                  // （HP 暗紅 #8c3235／MP 墨 #3c2415／IP 灰褐 #6b5a4b），
                  // 跟右翼那三條主資源條**不同色**——同一個 HP 在同一屏上有兩種顏色。
                  // 改成同一組令牌之後，「HP 是綠的」這件事只有一個定義處。
                  //
                  // ※ 類名必須是**完整字面量**（`'bg-gauge-hp'`），不能寫 `bg-gauge-${x}`：
                  // Tailwind 的 JIT 是靜態掃描原始碼，拼接出來的名字它看不到，那個 class
                  // 永遠不會被生成，顏色會**安靜地**退回繼承色（不會報錯）。
                  { key: 'hp', label: 'HP', cur: curHp, max: stats.maxHp, bar: isCrisis ? 'bg-gauge-crisis' : 'bg-gauge-hp', text: isCrisis ? 'text-gauge-crisis' : 'text-gauge-hp', unknown: statsUnset },
                  { key: 'mp', label: 'MP', cur: curMp, max: stats.maxMp, bar: 'bg-gauge-mp', text: 'text-gauge-mp', unknown: statsUnset },
                  { key: 'ip', label: 'IP', cur: curIp, max: stats.maxIp, bar: 'bg-gauge-ip', text: 'text-gauge-ip', unknown: false }
                ].map((row) => (
                  <span key={row.key} className="flex items-center gap-1.5">
                    {/* 這兩格刻意**不用** `font-mono`：設計系統有全域預算（481），
                        而數字的對齊由 `tabular-nums` 就夠了（MEMORY §E.27 的鄰居：
                        同一個效果不要用第二種寫法去換）。 */}
                    <span className={`w-5 shrink-0 font-black text-t10 ${row.text}`}>
                      {row.label}
                    </span>
                    <span className="flex-1 min-w-0 h-1.5 rounded bg-[#e8dcc4] overflow-hidden">
                      <span
                        data-testid={`hud-strip-${row.key}`}
                        data-value={row.unknown ? '' : row.cur}
                        className={`block h-full ${row.bar}`}
                        style={{ width: `${row.max > 0 ? Math.min(100, (row.cur / row.max) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="shrink-0 tabular-nums text-t10 text-[#3c2415]">
                      {row.unknown ? '—' : `${row.cur}/${row.max}`}
                    </span>
                  </span>
                ))}
              </button>

              {/* 名牌放在圖**下方**，不壓在圖上。
                  使用者要的是「完整呈現玩家的精美人設」——全身立繪的腳就是人設的一部分，
                  一條貼在底部的深色帶會把它蓋掉。所以圖一格、字一格。 */}
              <div className="w-full px-1 pt-0.5 text-left" data-testid="hud-nameplate">
                <h3 className="font-serif font-black text-xl tracking-wide leading-tight" style={{ color: theme.textDark }}>
                  {character.name || '冒險者'}
                </h3>
                <p className="text-t12 leading-snug text-[#6b5a4b]">
                  {character.identity || '未設定身份'}
                  {character.theme && character.theme !== character.identity && (
                    <> · <strong className="text-[#2c221e]">{character.theme}</strong></>
                  )}
                  {character.origin && ` · 來自 ${character.origin}`}
                </p>
              </div>

              <div className="space-y-1 w-full">
                {/* Classes Pills */}
                {(character.classes || []).length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                    {(character.classes || []).map((cl, idx) => {
                      const cName = normalizeClassName(cl.className);
                      return (
                        <span
                          key={idx}
                          data-testid="hud-class-pill"
                          className="text-t11 px-2 py-0.5 rounded border font-bold flex items-center gap-1 transition-colors"
                          style={{ backgroundColor: theme.accentLight, borderColor: theme.accent, color: theme.accentDark }}
                        >
                          <GameIcon name={cName} size={12} style={{ color: theme.accent }} />
                          <span>{cName} Lv{cl.level}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── 角色檔案（2026-10-30，P5-b）───────────────────────────────
                玩家在創角時寫下的性別與背景，在這一輪之前跑團面板一次都讀不到。
                這裡**只讀不寫**：沒有輸入框、沒有「儲存」，要改請去第 6 步。

                收合狀態也要有字（`dossierTeaser`）：一個看起來空的抽屜沒有人會去點，
                而角色的故事如果只在「展開之後」才存在，那它跟不存在沒有兩樣。 */}
            <div
              data-testid="character-dossier"
              className="w-full pt-2 border-t border-[#e8dcc4] text-left"
            >
              <button
                type="button"
                onClick={() => setIsDossierOpen((prev) => !prev)}
                aria-expanded={isDossierOpen}
                className="w-full flex items-center gap-1.5 text-left group"
                title="這個角色是誰：性別、出身、身份、主題與你寫下的背景"
              >
                <GiScrollUnfurled className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
                <span className="text-t11 font-bold text-[#7c6a58] shrink-0">角色檔案</span>
                <span className="text-t11 text-[#6b5a4b] truncate flex-1 min-w-0 group-hover:text-[#3c2415]">
                  {dossierTeaser}
                </span>
                <span className="text-t10 text-[#7c6a58] shrink-0" aria-hidden="true">
                  {isDossierOpen ? '▾' : '▸'}
                </span>
              </button>

              {isDossierOpen && (
                <div className="mt-2 space-y-2">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {dossier.rows.map((row) => (
                      <div key={row.key} className="min-w-0">
                        <dt className="text-t10 text-[#7c6a58]">{row.label}</dt>
                        <dd
                          data-testid={`dossier-${row.key}`}
                          className={`text-t12 font-bold truncate ${row.empty ? 'text-[#7c6a58]' : 'text-[#3c2415]'}`}
                          title={row.empty ? '' : row.value}
                        >
                          {row.empty ? '未填' : row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="space-y-0.5">
                    <span className="text-t10 text-[#7c6a58] block">背景</span>
                    <p
                      data-testid="dossier-background"
                      className={`text-t12 leading-relaxed whitespace-pre-wrap ${dossier.backgroundEmpty ? 'text-[#7c6a58]' : 'text-[#3c2415]'}`}
                    >
                      {backgroundDisplayText(dossier)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-t10 text-[#7c6a58]">
                      已填 {dossier.filledCount} / {dossier.totalCount} 項
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenEditor(6)}
                      className="text-t11 font-bold text-[#8c3235] hover:underline"
                    >
                      前往第 6 步修改
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT WING（col-span-6）：一扇窗，內容跟著指令換
              ────────────────────────────────────────────────────────────
              使用者的原話（P14）：
                「点了之后还要特地滑下去才看得到视窗，操作很反人类诶。
                  我建议可以点了按纽就会把立绘右边的视窗直接整个替换掉。」
              所以內容不再印在 hub 下方，而是**就在右翼這扇窗裡換**——
              按鈕與內容同一個視野，不必再滾。
              `個人資料`（預設）放最基本的東西：狀態、屬性、狀態異常、成長、資產。
              ──────────────────────────────────────────────────────────── */}
          {/* RIGHT WING（col-span-6）：這一欄才是真正會很長的一欄（武器清單、咒語全文、
              職業面板），所以它自己吃 `overflow-y-auto`。`overscroll-contain` 讓它捲到盡頭
              時不要把捲動傳給頁面（那正是使用者說的「在任何地方滑動大家一起動」）。
              `pr-1` 是給捲軸留的位子，避免內容被壓在捲軸底下。 */}
          <div className="order-3 lg:order-none lg:col-span-6 lg:max-h-[calc(100vh-var(--chapter-header-h,52px)-9rem)] lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 space-y-3 min-w-0">
            {activeTab === 'profile' ? (
              <>
              <HudWindow
                title="狀態"
                icon={GiHealthNormal}
                testId="hud-vitals-window"
                frameColor={theme.border}
                bodyClassName="p-3 space-y-3"
                right={<span className="text-t10 font-mono text-[#7c6a58] shrink-0">Lv {characterLevel}</span>}
              >
                {/* 生命值（危機時整列脈動；`hp-crisis-pulse` 全檔只有一份） */}
                <div className="relative rounded px-1.5 py-1 -mx-1.5">
                  {isCrisis && (
                    <span
                      data-testid="hp-crisis-pulse"
                      aria-hidden="true"
                      className="crisis-pulse-active pointer-events-none absolute inset-0 rounded border-2"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-t12 text-[#8c3235] min-w-0">
                      <GiHealthNormal className="w-3.5 h-3.5 shrink-0" />
                      <span className="shrink-0">生命值</span>
                      {isCrisis && (
                        <span className="text-t10 font-mono font-black flex items-center gap-0.5 shrink-0">
                          <FUIcon name="crisis" className="text-t10" />
                          <span>危機</span>
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFormula('hp')}
                      title="點擊查看公式"
                      className="font-mono font-black text-t14 text-[#8c3235] tabular-nums hover:underline decoration-dotted underline-offset-2 cursor-pointer shrink-0"
                    >
                      {statsUnset ? '—' : <>{curHp} <span className="text-t11 text-[#7c6a58] font-normal">/ {stats.maxHp}</span></>}
                    </button>
                  </div>
                  <div className="relative mb-1.5">
                    <GaugeBar
                      testId="gauge-hp"
                      percent={stats.maxHp > 0 ? (curHp / stats.maxHp) * 100 : 0}
                      fillClassName={isCrisis ? 'bg-gauge-crisis' : 'bg-gauge-hp'}
                    />
                    <ResourceDeltaBadge flash={hpDelta} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <NumberStepper value={curHp} onDelta={adjustHp} ariaLabel="生命值" width="w-14" inputClassName="text-[#8c3235]" />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleFormula('crisis')}
                        title="點擊查看公式"
                        className="text-t11 font-mono font-bold text-[#8c3235] hover:underline decoration-dotted underline-offset-2 cursor-pointer"
                      >
                        危機門檻 {statsUnset ? '—' : stats.crisisThreshold}
                      </button>
                      <button
                        onClick={() => updateField('currentHp', stats.maxHp)}
                        className="px-2 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#8c3235] font-bold text-t11"
                      >
                        全滿
                      </button>
                    </div>
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

                {/* 魔力值 */}
                <div className="rounded px-1.5 py-1 -mx-1.5 border-t border-[#e8dcc4] pt-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-t12 text-[#6b5a4b] min-w-0">
                      <GiLightningTear className="w-3.5 h-3.5 shrink-0" />
                      <span className="shrink-0">魔力值</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFormula('mp')}
                      title="點擊查看公式"
                      className="font-mono font-black text-t14 text-[#3c2415] tabular-nums hover:underline decoration-dotted underline-offset-2 cursor-pointer shrink-0"
                    >
                      {statsUnset ? '—' : <>{curMp} <span className="text-t11 text-[#7c6a58] font-normal">/ {stats.maxMp}</span></>}
                    </button>
                  </div>
                  <div className="relative mb-1.5">
                    <GaugeBar
                      testId="gauge-mp"
                      percent={stats.maxMp > 0 ? (curMp / stats.maxMp) * 100 : 0}
                      fillClassName="bg-gauge-mp"
                    />
                    <ResourceDeltaBadge flash={mpDelta} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <NumberStepper value={curMp} onDelta={adjustMp} ariaLabel="魔力值" width="w-14" inputClassName="text-[#3c2415]" />
                    <button
                      onClick={() => updateField('currentMp', stats.maxMp)}
                      className="px-2 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#3c2415] font-bold text-t11"
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

                {/* 道具點（消耗品捷徑已搬到「行囊與道具」分頁） */}
                <div className="rounded px-1.5 py-1 -mx-1.5 border-t border-[#e8dcc4] pt-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-t12 text-[#6b5a4b] min-w-0">
                      <GiBackpack className="w-3.5 h-3.5 shrink-0" />
                      <span className="shrink-0">道具點</span>
                      {secretFormulaSL > 0 && (
                        <span className="text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415] shrink-0">
                          秘密配方 SL{secretFormulaSL}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFormula('ip')}
                      title="點擊查看公式"
                      className="font-mono font-black text-t14 text-[#3c2415] tabular-nums hover:underline decoration-dotted underline-offset-2 cursor-pointer shrink-0"
                    >
                      {curIp} <span className="text-t11 text-[#7c6a58] font-normal">/ {stats.maxIp}</span>
                    </button>
                  </div>
                  <div className="relative mb-1.5">
                    <GaugeBar
                      testId="gauge-ip"
                      percent={stats.maxIp > 0 ? (curIp / stats.maxIp) * 100 : 0}
                      fillClassName="bg-gauge-ip"
                    />
                    <ResourceDeltaBadge flash={ipDelta} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <NumberStepper value={curIp} onDelta={adjustIp} ariaLabel="物品點" width="w-14" />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('notes')}
                        title="官方五種消耗品捷徑都在「行囊與道具」分頁"
                        className="text-t11 font-bold text-[#6b5a4b] hover:text-[#2c221e] underline"
                      >
                        消耗品
                      </button>
                      <button
                        onClick={() => updateField('currentIp', stats.maxIp)}
                        className="px-2 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#3c2415] font-bold text-t11"
                      >
                        全滿
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
              </HudWindow>

              <HudWindow
                title="能力"
                icon={GiRollingDices}
                testId="hud-ability-window"
                frameColor={theme.border}
                bodyClassName="p-3 space-y-2.5"
              >

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#3c2415] flex items-center gap-1">
                    <GiRollingDices className="w-4 h-4 text-[#6b5a4b]" />
                    <span>屬性與雙屬性檢定</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFreeRollModalOpen(true)}
                    className="text-t11 font-bold text-[#6b5a4b] hover:text-[#2c221e] underline"
                  >
                    進階修正檢定
                  </button>
                </div>

              {/* 屬性橫排（P14）＋「點兩張就擲骰」（2026-11-03）
                  ─────────────────────────────────────────────────────────────
                  使用者的回報：「界面如此多按鈕，怎麼知道讓玩家該點哪個？點了還得跳個
                  彈窗叫我選另一個骰子，我咋知道第二顆是什麼？都被你彈窗擋住了。」

                  舊版每一格有**兩顆**按鈕：大卡＝單屬性檢定、旁邊小鈕＝「配對」。
                  玩家得先把 A 設成首骰、再去點 B 的配對鈕——兩個動作分在兩處，
                  而且按下之後彈窗蓋住整排屬性，看不到自己剛剛選了哪兩顆。

                  現在整張卡就是按鈕：
                    ① 點第一張 → 記住它（整卡轉成強調色，底下寫「首骰 · 再點一顆」）
                    ② 再點任何一張（含同一張）→ 立刻擲那兩顆
                       同一張點兩次就是 DEX + DEX 的純屬性檢定。
                  標籤直接寫出兩顆骰面（DEX(d8) + INS(d10)），彈窗一開就知道在擲什麼。
                  每格因此從 2 顆按鈕降到 1 顆，「該點哪個」不再是一個問題。 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                    { key: 'dex', enName: 'DEX', zhName: ATTRIBUTE_NAMES.dex, cur: stats.currentDex, base: stats.baseDex },
                    { key: 'ins', enName: 'INS', zhName: ATTRIBUTE_NAMES.ins, cur: stats.currentIns, base: stats.baseIns },
                    { key: 'mig', enName: 'MIG', zhName: ATTRIBUTE_NAMES.mig, cur: stats.currentMig, base: stats.baseMig },
                    { key: 'wlp', enName: 'WLP', zhName: ATTRIBUTE_NAMES.wlp, cur: stats.currentWlp, base: stats.baseWlp }
                  ].map(attr => {
                    const isFirstSelected = comboFirstAttr === attr.key;
                    return (
                      <div key={attr.key} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => handleAttributeRoll(attr)}
                          aria-pressed={isFirstSelected}
                          data-testid={`attr-roll-${attr.key}`}
                          className={`w-full rounded p-2 border flex flex-col items-center justify-center transition-all text-center ${
                            isFirstSelected
                              ? 'bg-[#a63d40] border-[#8c3235]'
                              : comboFirstAttr
                                ? 'bg-[#f4ebd9] border-[#a63d40] hover:bg-[#e8dcc4]'
                                : 'bg-[#fbf7ee] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                          }`}
                          title={
                            isFirstSelected
                              ? `已選 ${attr.enName}：再點一顆骰子組成檢定（再點這張＝${attr.enName}+${attr.enName}）`
                              : comboFirstAttr
                                ? `點擊立即擲骰 [${comboFirstAttr.toUpperCase()} + ${attr.enName}]`
                                : `點擊選 ${attr.enName} 為第一顆骰`
                          }
                        >
                          <div className="flex items-baseline gap-1">
                            <span className={`text-xs font-black tracking-wider font-mono ${isFirstSelected ? 'text-[#fffdf9]' : 'text-[#2c221e]'}`}>
                              {attr.enName}
                            </span>
                            <span className={`text-t11 font-sans ${isFirstSelected ? 'text-[#fffdf9]/85' : 'text-[#7c6a58]'}`}>
                              {attr.zhName}
                            </span>
                          </div>
                          <div
                            className="text-lg font-serif font-black flex items-baseline gap-1"
                            style={{ color: isFirstSelected ? '#fffdf9' : theme.textDark }}
                          >
                            <span>d{attr.cur}</span>
                            {attr.cur < attr.base && (
                              <span className={`text-t11 line-through font-mono ${isFirstSelected ? 'text-[#fffdf9]/70' : 'text-[#8c3235]'}`}>
                                d{attr.base}
                              </span>
                            )}
                          </div>
                          {/* 第三行平常是空的，但要**佔位**：不然選首骰時整排卡片會跳一下。 */}
                          <span className={`text-t10 font-bold h-3 leading-none ${isFirstSelected ? 'text-[#fffdf9]/85' : 'text-[#7c6a58]'}`}>
                            {isFirstSelected ? '首骰 · 再點一顆' : comboFirstAttr ? '+ 配對' : ''}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFormula(`attr:${attr.key}`)}
                          title="點擊查看公式"
                          className="w-full text-t10 font-bold text-[#7c6a58] hover:text-[#3c2415] py-0.5 rounded border border-dashed border-[#d6c7ab] transition-colors cursor-pointer"
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
                    );
                  })}
              </div>

              {/* ── 效果加成（條件式，2026-11-03）────────────────────────────
                  121 條「修飾值」型的規則物件裡，真正能無條件折進數值的只是少數；
                  其餘是「對非集群 +5 傷害」「未裝備武器時 +N 物防」這種**要看場合**的加值。
                  它們算不進任何一個數字，但也不該只是技能卡上的一段文字——
                  跑團時玩家要問的正是「我現在 +多少、什麼時候算」。

                  所以這裡把它們逐條列出來：來源名稱、數字、條件原文。
                  刻意**不做成可勾選的開關**：App 不知道「這一擊是不是對非集群」，
                  替玩家判定就等於替 GM 改規則。 */}
              {stats.flowConditional.length > 0 ? (
                (() => {
                  // 只有「現在拿得到的」才列：`existing` 的條目已經有專屬面板在解釋，
                  // 列進來只會讓同一件事在卡上出現兩次（而兩次說法不同時更糟）。
                  const rows = stats.flowConditional.filter((c) => !c.existing);
                  if (rows.length === 0) return null;
                  return (
                    <div
                      data-testid="hud-flow-conditional"
                      className="pt-2 border-t border-[#e8dcc4] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-t11 font-bold text-[#3c2415] flex items-center gap-1">
                          <GiSparkles className="w-3.5 h-3.5 text-[#6b5a4b]" />
                          <span>效果加成（依條件）</span>
                        </span>
                        <span className="text-t10 text-[#7c6a58]">{rows.length} 條</span>
                      </div>
                      <ul className="space-y-0.5">
                        {rows.map((row, i) => (
                          <li
                            key={`${row.source}-${row.target}-${i}`}
                            data-testid="flow-conditional-row"
                            className="text-t12 leading-relaxed text-[#6b5a4b]"
                          >
                            <span className="font-bold text-[#3c2415]">{row.source}</span>
                            <span className="mx-1">·</span>
                            <span>{row.label}</span>
                            {row.condition ? (
                              <>
                                <span className="mx-1">—</span>
                                <span>{row.condition}</span>
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()
              ) : null}


                {/* ── 狀態異常（2026-10-30 P7 立；2026-11-03 改成 4＋2）────────────
                    使用者的回報：「狀態異常監控的按鈕太長了信息量低，能否直接 1x6 排好
                    或者 4+2，讓每個狀態異常可以直接對應各自的屬性？」

                    舊版是 2 欄 × 3 列的橫條（名稱在左、效果碼在右），每顆將近半版寬，
                    而它承載的資訊只有「兩個字 ＋ 一個屬性縮寫」。

                    現在改成 **4 ＋ 2**：
                      · 上排四格正好在四張屬性卡下面 —— 緩慢↔DEX、眩暈↔INS、
                        虛弱↔MIG、動搖↔WLP，**垂直對齊**讓「哪個狀態打哪一項」不用讀字。
                      · 下排兩格各佔兩欄 —— 憤怒（DEX·INS）、中毒（MIG·WLP），
                        跨度剛好對上它影響的屬性數。

                    順序仍由 `STATUS_AFFLICTION_ORDER` 決定（它本身就是按受影響屬性排的），
                    這裡只負責把「單屬性／雙屬性」翻成 1 欄／2 欄。 */}
                <div
                  data-testid="hud-afflictions"
                  className="pt-2 border-t border-[#e8dcc4] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-t11 font-bold text-[#3c2415] flex items-center gap-1">
                      <GiHazardSign className="w-3.5 h-3.5 text-[#6b5a4b]" />
                      <span>狀態異常監控</span>
                    </span>
                    <span className="text-t10 text-[#7c6a58]">點擊切換</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {afflictionRows.map((row) => {
                      const isActive = !!character.statusAfflictions?.[row.key];
                      // 打兩個屬性的（憤怒／中毒）佔兩欄，跨度本身就是它的意思
                      const span = row.stats.length > 1 ? 'col-span-2' : 'col-span-1';
                      return (
                        <button
                          key={row.key}
                          type="button"
                          data-testid={`affliction-${row.key}`}
                          aria-pressed={isActive}
                          onClick={() => handleToggleAffliction(row.key)}
                          className={`${span} py-1 px-1 rounded border text-center transition-all ${
                            isActive
                              ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]'
                              : 'bg-[#f4ebd9] border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#e8dcc4]'
                          }`}
                          title={`${row.name}：${row.desc}`}
                        >
                          <span className="block text-t12 font-bold truncate leading-tight">{row.short}</span>
                          <span className={`block text-t10 font-mono leading-tight ${isActive ? 'opacity-90' : 'text-[#7c6a58]'}`}>
                            {row.effect}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </HudWindow>

              {/* EXP / Zenit / Fabula Points Compact Cards
                  （這行字是 afflictionOrder G4 的錨點：狀態異常必須排在 EXP 之前） */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <HudWindow
                  title="成長"
                  icon={GiUpgrade}
                  testId="hud-exp-window"
                  frameColor={theme.border}
                  bodyClassName="p-3 space-y-1.5"
                >

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold flex items-center gap-1" style={{ color: theme.textDark }}>
                      <GiUpgrade className="w-3.5 h-3.5 text-[#6b5a4b]" />
                      經驗升級 ({character.exp || 0} / 10)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsExpSettlementOpen(prev => !prev)}
                      className="text-t11 font-bold text-[#8c3235] hover:underline"
                    >
                      {isExpSettlementOpen ? '收合結算' : '✦ 聚會結算'}
                    </button>
                  </div>
                  <div className="relative">
                    <GaugeBar
                      testId="gauge-exp"
                      height="h-1.5"
                      percent={((Number(character.exp) || 0) / 10) * 100}
                      fillStyle={{ backgroundColor: theme.accent }}
                    />
                    <ResourceDeltaBadge flash={expDelta} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <NumberStepper
                      value={character.exp || 0}
                      onDelta={adjustExp}
                      ariaLabel="經驗值"
                      width="w-14"
                    />
                    <span className="text-t11 text-[#6b5a4b] font-mono">10 EXP 升 1 級</span>
                  </div>

                  {/* 聚會結束 EXP 結算器（Core p.227：5 基礎 ＋ FP 獎勵 ＋ 終結點） */}
                  {isExpSettlementOpen && (
                    <div
                      data-testid="exp-settlement-panel"
                      className="mt-2 pt-2 border-t border-[#e8dcc4] space-y-2 text-t11 bg-[#fbf7ee] p-2.5 rounded"
                    >
                      <div className="font-bold text-[#3c2415]">聚會結束 EXP 結算（核心 p.227）</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[#6b5a4b] block">物語點分配獎勵:</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <button type="button" onClick={() => setSessionFpGain(v => Math.max(0, v - 1))} className="px-1.5 py-0.5 rounded bg-white border border-[#d6c7ab]">-</button>
                            <span className="font-bold w-6 text-center">{sessionFpGain}</span>
                            <button type="button" onClick={() => setSessionFpGain(v => v + 1)} className="px-1.5 py-0.5 rounded bg-white border border-[#d6c7ab]">+</button>
                          </div>
                        </div>
                        <div>
                          <span className="text-[#6b5a4b] block">反派花費終結點:</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <button type="button" onClick={() => setSessionUltimaSpent(v => Math.max(0, v - 1))} className="px-1.5 py-0.5 rounded bg-white border border-[#d6c7ab]">-</button>
                            <span className="font-bold w-6 text-center">{sessionUltimaSpent}</span>
                            <button type="button" onClick={() => setSessionUltimaSpent(v => v + 1)} className="px-1.5 py-0.5 rounded bg-white border border-[#d6c7ab]">+</button>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const gain = 5 + sessionFpGain + sessionUltimaSpent;
                          adjustExp(gain);
                          setIsExpSettlementOpen(false);
                          setSessionFpGain(0);
                          setSessionUltimaSpent(0);
                          showToast(`聚會結算完成！獲得 ${gain} 點 EXP（基礎 5 + 物語點 ${sessionFpGain} + 終結點 ${sessionUltimaSpent}）`);
                        }}
                        className="w-full py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs"
                      >
                        入帳 +{5 + sessionFpGain + sessionUltimaSpent} EXP（基礎 5 + {sessionFpGain} + {sessionUltimaSpent}）
                      </button>
                    </div>
                  )}
                </HudWindow>

                {/* 資產窗（P13）：使用者裁定「錢包收成一頁」。
                    主畫面只留兩個數字與一個入口——收支、履歷、物語點的
                    六顆按鈕全部搬到「金錢與物語點」分頁，不再擠在右翼。 */}
                <HudWindow
                  title="資產"
                  icon={GiCoins}
                  testId="hud-assets-window"
                  frameColor={theme.border}
                  bodyClassName="p-3 space-y-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-t11 font-bold text-[#6b5a4b] flex items-center gap-1">
                      <GiCoins className="w-3.5 h-3.5" />
                      資金
                    </span>
                    <span data-testid="hud-asset-zenit" className="tabular-nums font-black text-t16 text-[#3c2415]">
                      {formatZenit(character.zenit)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-t11 font-bold text-[#6b5a4b] flex items-center gap-1">
                      <GiSparkles className="w-3.5 h-3.5" />
                      物語點
                    </span>
                    <span data-testid="hud-asset-fp" className="tabular-nums font-black text-t16 text-[#3c2415]">
                      {resolveFabulaPoints(character)} <span className="text-t11 font-normal text-[#7c6a58]">FP</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="hud-assets-open"
                    onClick={() => setActiveTab('money')}
                    title="收入、支出、明細與物語點都在「金錢與物語點」分頁"
                    className="w-full py-2 rounded border border-[#d6c7ab] bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] font-bold text-t12 flex items-center justify-center gap-1 transition-colors"
                  >
                    <GiScrollUnfurled className="w-3.5 h-3.5" />
                    收支與履歷
                  </button>
                </HudWindow>
              </div>
              </>
            ) : (
              <HudWindow
                title={hudTabLabel}
                icon={activeTabIcon}
                testId="hud-panel-window"
                headerTestId="hud-panel-header"
                className="flex-1"
                frameColor={theme.border}
                headerColor={theme.accentLight}
                bodyClassName="p-3 sm:p-4"
                right={(
                  <span className="text-t10 font-mono text-[#7c6a58] shrink-0">
                    第 {hudTabItems.findIndex((t) => t.id === activeTab) + 1} / {hudTabItems.length} 頁
                  </span>
                )}
              >
                <ErrorBoundary
                  inline
                  label={
                    hudTabLabel
                  }
                >
                  {/* TAB 1: 武器與戰鬥 (Formula Pills & Combat Matrix) */}
                  {activeTab === 'attacks' && (
                  <div className="space-y-4 animate-fade-in text-xs">
                    {/* Defense & Initiative Dashboard */}
                    <div className="space-y-2">
                      <div
                        className="grid grid-cols-3 gap-3 p-3 rounded border text-center font-mono"
                        style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFormula('def')}
                          title="點擊查看公式"
                          className="p-2 rounded bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#3c2415]/30 transition-colors cursor-pointer"
                        >
                          <span className="text-[#7c6a58] block text-t12 font-sans font-medium">物理防禦</span>
                          <span className="text-2xl font-black" style={{ color: theme.textDark }}>{statsUnset ? '—' : stats.def}</span>
                          <span className="text-t12 text-[#6b5a4b] block mt-0.5 leading-tight">
                            {stats.currentDex !== stats.def ? `DEX(d${stats.currentDex}) + 盾/裝甲` : `當前 DEX(d${stats.currentDex})`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFormula('mdef')}
                          title="點擊查看公式"
                          className="p-2 rounded bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#3c2415]/30 transition-colors cursor-pointer"
                        >
                          <span className="text-[#6b5a4b] block text-t12 font-sans font-medium">魔法防禦</span>
                          <span className="text-2xl font-black text-[#3c2415]">{stats.mdef}</span>
                          <span className="text-t12 text-[#6b5a4b] block mt-0.5 leading-tight">
                            {stats.currentIns !== stats.mdef ? `INS(d${stats.currentIns}) + 盾/加值` : `當前 INS(d${stats.currentIns})`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFormula('init')}
                          title="點擊查看公式"
                          className="p-2 rounded bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#3c2415]/30 transition-colors cursor-pointer"
                        >
                          <span className="text-[#7c6a58] block text-t12 font-sans font-medium">先攻修正</span>
                          <span className="text-2xl font-black text-[#3c2415]">{formatInitiative(stats.init, initiativeVariant)}</span>
                          <span className="text-t12 text-[#6b5a4b] block mt-0.5 leading-tight">
                            {initiativeVariant ? '本團採用先攻變體' : '裝備與防具修正'}
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
                      <span className="font-bold text-[#3c2415] text-xs flex items-center gap-1.5">
                        <GiCrossedSwords className="w-3.5 h-3.5 text-[#6b5a4b]" />
                        <span>當前武裝與命中公式</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsFreeRollModalOpen(true)}
                        className="px-2.5 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] text-t12 font-bold flex items-center gap-1 transition-colors"
                      >
                        <GiRollingDices className="w-3.5 h-3.5 text-[#6b5a4b]" />
                        <span>自由雙屬性檢定</span>
                      </button>
                    </div>

                    {/* Main Hand Weapon Pill Card */}
                    <div
       className="p-3.5 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdf9]"
                      style={{ borderColor: theme.border }}
                    >
                      <div>
                        <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: theme.textDark }}>
                          <FUIcon name={mainWeapon.range?.includes('遠程') ? 'ranged' : 'melee'} className="text-base shrink-0" style={{ color: theme.accent }} />
                          <span>{mainWeapon.name}</span>
                          <span className="text-t12 font-mono px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#e8dcc4]">
                            主手 · {mainWeapon.range || '近戰'}
                          </span>
                          {/* 可變形武器：衝突中就靠這一顆換型態（原書 p.107：每回合一次） */}
                          {switchForm && (
                            <button
                              type="button"
                              onClick={handleSwitchForm}
                              title="可變形武器：隨時可切換型態。衝突場景中只能在你的回合、且每回合一次（HF p.107）"
                              className="text-t12 px-2 py-0.5 rounded border font-bold flex items-center gap-1 transition-colors"
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
                            onClick={() => openCharacterDice({
                              die1: mainCheck.die1,
                              die2: mainCheck.die2,
                              modifier: mainCheck.mod,
                              damageBonus: mainDamage.hrBonus,
                              damageType: mainDamage.damageType,
                              label: `${mainWeapon.name} 命中判定 [${mainCheck.attr1} + ${mainCheck.attr2}]`
                            })}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded font-mono font-bold text-xs bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] transition-all"
                            title="點擊直接擲骰命中檢定（自動附帶 HR 傷害計算）"
                          >
                            <GiRollingDices className="w-3.5 h-3.5 text-[#6b5a4b]" />
                            <span>[{mainCheck.attr1} + {mainCheck.attr2}]{mainCheck.mod !== 0 ? ` + ${mainCheck.mod}` : ''}</span>
                            <span className="text-t12 text-[#6b5a4b] font-normal">
                              (d{mainCheck.die1}+d{mainCheck.die2})
                            </span>
                          </button>

                          {/* Damage Formula Pill */}
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded font-mono font-bold text-xs bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415]">
                            <span>[HR + {mainDamage.hrBonus}]</span>
                            <FUIcon name={mainDamage.damageType} className="text-sm shrink-0" />
                            <span className="text-t12 font-sans text-[#6b5a4b]">{mainDamage.damageType}</span>
                          </span>
                        </div>

                        {/* 定制武器或制式武器的特殊規則描述 */}
                        {mainWeapon.isCustomWeapon && mainWeapon.effectText ? (
                          <p
                            className="text-t12 mt-2 leading-relaxed"
                            style={{ color: theme.textMuted }}
                          >
                            {renderTextWithAffinities(mainWeapon.effectText)}
                          </p>
                        ) : (mainWeapon.desc && mainWeapon.desc !== '無特殊效果' && (
                          <p
                            className="text-t12 mt-2 leading-relaxed"
                            style={{ color: theme.textMuted }}
                          >
                            {renderTextWithAffinities(mainWeapon.desc)}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <CopyTextButton
                          testId="copy-main-weapon"
                          toastLabel={mainWeapon.name}
                          showToast={showToast}
                          getText={() =>
                            formatWeaponCopyText({
                              weapon: {
                                ...mainWeapon,
                                type: mainWeapon.range || mainWeapon.type || '近戰'
                              },
                              slotLabel: '主手武裝',
                              check: {
                                formula: `[${mainCheck.attr1} + ${mainCheck.attr2}]${mainCheck.mod !== 0 ? ` + ${mainCheck.mod}` : ''}`,
                                diceStr: `d${mainCheck.die1}+d${mainCheck.die2}`
                              },
                              damage: {
                                text: `[HR + ${mainDamage.hrBonus}]`,
                                type: mainDamage.damageType
                              },
                              characterName: character.name
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => openCharacterDice({
                            die1: mainCheck.die1,
                            die2: mainCheck.die2,
                            modifier: mainCheck.mod,
                            damageBonus: mainDamage.hrBonus,
                            damageType: mainDamage.damageType,
                            label: `${mainWeapon.name} 命中檢定`
                          })}
                          className="px-3 py-1.5 rounded text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
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
                        className="p-3.5 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdf9]"
                        style={{ borderColor: theme.border }}
                      >
                        <div>
                          <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: theme.textDark }}>
                            <FUIcon name={offWeapon.range?.includes('遠程') ? 'ranged' : 'melee'} className="text-base shrink-0" style={{ color: theme.accent }} />
                            <span>{offWeapon.name}</span>
                            <span className="text-t12 font-mono px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#e8dcc4]">
                              副手 · {offWeapon.range || '近戰'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openCharacterDice({
                                die1: offCheck.die1,
                                die2: offCheck.die2,
                                modifier: offCheck.mod,
                                damageBonus: offDamage.hrBonus,
                                damageType: offDamage.damageType,
                                label: `${offWeapon.name} 命中判定 [${offCheck.attr1} + ${offCheck.attr2}]`
                              })}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded font-mono font-bold text-xs bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] transition-all"
                              title="點擊直接擲骰命中檢定（自動附帶 HR 傷害計算）"
                            >
                              <GiRollingDices className="w-3.5 h-3.5 text-[#6b5a4b]" />
                              <span>[{offCheck.attr1} + {offCheck.attr2}]{offCheck.mod !== 0 ? ` + ${offCheck.mod}` : ''}</span>
                              <span className="text-t12 text-[#6b5a4b] font-normal">
                                (d{offCheck.die1}+d{offCheck.die2})
                              </span>
                            </button>

                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded font-mono font-bold text-xs bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415]">
                              <span>[HR + {offDamage.hrBonus}]</span>
                              <FUIcon name={offDamage.damageType} className="text-sm shrink-0" />
                              <span className="text-t12 font-sans text-[#6b5a4b]">{offDamage.damageType}</span>
                            </span>
                          </div>

                          {offWeapon.desc && offWeapon.desc !== '無特殊效果' && (
                            <p
                              className="text-t12 mt-2 leading-relaxed"
                              style={{ color: theme.textMuted }}
                            >
                              {renderTextWithAffinities(offWeapon.desc)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <CopyTextButton
                            testId="copy-off-weapon"
                            toastLabel={offWeapon.name}
                            showToast={showToast}
                            getText={() =>
                              formatWeaponCopyText({
                                weapon: {
                                  ...offWeapon,
                                  type: offWeapon.range || offWeapon.type || '近戰'
                                },
                                slotLabel: '副手武裝',
                                check: {
                                  formula: `[${offCheck.attr1} + ${offCheck.attr2}]${offCheck.mod !== 0 ? ` + ${offCheck.mod}` : ''}`,
                                  diceStr: `d${offCheck.die1}+d${offCheck.die2}`
                                },
                                damage: {
                                  text: `[HR + ${offDamage.hrBonus}]`,
                                  type: offDamage.damageType
                                },
                                characterName: character.name
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => openCharacterDice({
                              die1: offCheck.die1,
                              die2: offCheck.die2,
                              modifier: offCheck.mod,
                              damageBonus: offDamage.hrBonus,
                              damageType: offDamage.damageType,
                              label: `${offWeapon.name} 命中檢定`
                            })}
                            className="px-3 py-1.5 rounded text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
                            style={{ backgroundColor: theme.accent }}
                          >
                            <GiRollingDices className="w-4 h-4" />
                            <span>擲骰</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Free Unarmed Strike Shortcut */}
                    <div className="p-2.5 rounded border border-dashed border-[#d6c7ab] bg-[#fbf7ee] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap font-mono text-t12">
                        <span className="font-bold text-[#3c2415] font-sans">徒手/自由打擊:</span>
                        <button
                          type="button"
                          onClick={() => openCharacterDice({
                            die1: unarmedCheck.die1,
                            die2: unarmedCheck.die2,
                            modifier: 0,
                            damageBonus: unarmedBonus,
                            damageType: '物理',
                            label: '徒手打擊 命中判定 [DEX + MIG]'
                          })}
                          className="px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#e8dcc4] font-bold"
                        >
                          [DEX + MIG]
                        </button>
                        <span className="text-[#6b5a4b] font-bold">[HR + {unarmedBonus}] 物理</span>
                      </div>
                    </div>

                    {/* Equipment Breakdown (with special rules desc for shield, armor, and accessory) */}
                    {(() => {
                      const offHandName = normalizeEquipmentName(character.equipment?.offHand || '');
                      const armorName = normalizeEquipmentName(character.equipment?.armor || '');
                      const accName = normalizeEquipmentName(character.equipment?.accessory || '');
                      const shieldDef = offHandName
                        ? (rulesData.equipment?.shields || []).find(s => s.name === offHandName)
                        : null;
                      const armorDef = armorName
                        ? (rulesData.equipment?.armors || []).find(a => a.name === armorName)
                        : null;
                      const accDef = accName
                        ? (rulesData.equipment?.accessories || []).find(a => a.name === accName)
                        : null;
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-t12 pt-2 border-t">
                          <div className="p-2.5 rounded bg-[#fbf7ee] border border-[#e8dcc4] space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#6b5a4b] block font-sans">副手/盾牌:</span>
                              {shieldDef && (
                                <CopyTextButton
                                  testId="copy-shield"
                                  toastLabel={offHandName}
                                  showToast={showToast}
                                  getText={() =>
                                    formatEquipmentCopyText({
                                      slotLabel: '副手盾牌',
                                      item: shieldDef,
                                      characterName: character.name
                                    })
                                  }
                                />
                              )}
                            </div>
                            <strong className="text-[#3c2415] block">{offHandName || '無'}</strong>
                            {shieldDef && (
                              <div className="font-sans text-t11 text-[#6b5a4b] leading-snug">
                                <span>物防 {shieldDef.def || '+0'} / 魔防 {shieldDef.mdef || '+0'}</span>
                                {shieldDef.desc && shieldDef.desc !== '無特殊效果' && (
                                  <p className="mt-0.5 text-[#3c2415]">{renderTextWithAffinities(shieldDef.desc)}</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="p-2.5 rounded bg-[#fbf7ee] border border-[#e8dcc4] space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#6b5a4b] block font-sans">防具裝甲:</span>
                              {armorDef && (
                                <CopyTextButton
                                  testId="copy-armor"
                                  toastLabel={armorName}
                                  showToast={showToast}
                                  getText={() =>
                                    formatEquipmentCopyText({
                                      slotLabel: '防具裝甲',
                                      item: armorDef,
                                      characterName: character.name
                                    })
                                  }
                                />
                              )}
                            </div>
                            <strong className="text-[#3c2415] block">{armorName || '無'}</strong>
                            {armorDef && (
                              <div className="font-sans text-t11 text-[#6b5a4b] leading-snug">
                                <span>物防 {armorDef.def} / 魔防 {armorDef.mdef}</span>
                                {armorDef.desc && armorDef.desc !== '無特殊效果' && (
                                  <p className="mt-0.5 text-[#3c2415]">{renderTextWithAffinities(armorDef.desc)}</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="p-2.5 rounded bg-[#fbf7ee] border border-[#e8dcc4] space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#6b5a4b] block font-sans">佩戴飾品:</span>
                              {(accDef || accName) && (
                                <CopyTextButton
                                  testId="copy-accessory"
                                  toastLabel={accName}
                                  showToast={showToast}
                                  getText={() =>
                                    formatEquipmentCopyText({
                                      slotLabel: '佩戴飾品',
                                      item: accDef || { name: accName, desc: '無特殊效果' },
                                      characterName: character.name
                                    })
                                  }
                                />
                              )}
                            </div>
                            <strong className="text-[#3c2415] block">{accName || '無'}</strong>
                            {accDef?.desc && accDef.desc !== '無特殊效果' && (
                              <p className="font-sans text-t12 text-[#3c2415] leading-snug">
                                {renderTextWithAffinities(accDef.desc)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Pilot Personal Vehicle in Combat (if active) */}
                    {isClassPanelActive(character, '機師') && (
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
                    {isClassPanelActive(character, '旅人') && (
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
                    {isClassPanelActive(character, '死靈術士') && (
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

                {/* TAB 2: 咒語與儀式 (Dedicated Spells Tab) */}
                {activeTab === 'spells' && (() => {
                  const resolvedSpells = resolveCharacterSpells(character);
                  // 額度與權限在元件頂層算過一次，這裡只取用（見 `spellGrants`／`ritualRights`）。
                  const grants = spellGrants;
                  const rights = ritualRights;
                  return (
                  <div className="space-y-4 animate-fade-in text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
                        <GiSpellBook className="w-4 h-4 text-[#6b5a4b]" />
                        <span>已掌握的咒語與儀式</span>
                        {/* 額度不是裝飾：沒有它，玩家只會看到「學習新咒語」突然消失，
                            不知道是壞掉還是滿了。只在真的有額度可算時才顯示。 */}
                        {grants.hasPath && grants.capacity > 0 && (
                          <span
                            data-testid="spell-quota"
                            className={`text-t11 px-1.5 py-0.5 rounded border font-bold ${
                              grants.canLearn
                                ? 'bg-[#f4ebd9] text-[#6b5a4b] border-[#d6c7ab]'
                                : 'bg-[#f4ebd9]/60 text-[#8c3235] border-[#d6c7ab]'
                            }`}
                            title={grants.summary}
                          >
                            {grants.used} / {grants.capacity}
                          </span>
                        )}
                      </span>
                      {/* 學習入口的三道門檻，缺一就不畫按鈕：
                          ① 清單非空——空狀態那顆講得更清楚，同一屏兩顆同義按鈕是 §3.4 的老毛病
                          ② 這個角色**本來就沒有咒語額度**——非施法者不該有學習入口
                          ③ 額度已用完——按下去只會被擋，不如直接說滿了 */}
                      {resolvedSpells.length > 0 && grants.canLearn && (
                        <button
                          type="button"
                          onClick={() => setIsSpellModalOpen(true)}
                          className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>學習新咒語</span>
                        </button>
                      )}
                      {resolvedSpells.length > 0 && grants.hasPath && !grants.canLearn && (
                        <span className="text-t11 text-[#7c6a58] font-bold">
                          額度已滿，提升對應魔法技能的 SL 才會多一格
                        </span>
                      )}
                    </div>

                    {/* Spells Cards List */}
                    {resolvedSpells.length > 0 ? (
                      <div className="space-y-2.5">
                        {resolvedSpells.map((sp, idx) => {
                          const isOffensive = Boolean(sp.isOffensive);
                          const spellCheck = parseCheckFormula('INS + WLP', stats);
                          const spellDamage = parseDamageFormula(sp.effect || '');
                          const isExpanded = !!expandedSpells[sp.name];
                          // 事前可用性：這一條咒語現在付不付得起。`sp.mp` 缺漏時
                          // `describeCostGate` 回「沒有成本」→ 不擋（不知道就不嚇人）。
                          const spellGate = describeCostGate({ cost: sp.mp, current: curMp, unit: GATE_UNITS.mp });

                          return (
                            <div
                              key={idx}
                              className="p-3.5 rounded border bg-white space-y-2 transition-all hover:border-[#3c2415]"
                              style={{ borderColor: theme.border }}
                            >
                              {/* Spell Header */}
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="w-6 h-6 rounded bg-[#f4ebd9] border border-[#d6c7ab] flex items-center justify-center shrink-0">
                                    <FUIcon name={isOffensive ? 'offensive' : 'spell'} className="text-sm" />
                                  </div>
                                  <h4 className="font-serif font-black text-sm text-[#3c2415] flex items-center gap-1.5">
                                    {isOffensive && <span className="fu-icon text-[#8c3235] font-bold" title="攻擊性咒語">o</span>}
                                    <span>{sp.name}</span>
                                  </h4>
                                  <span className="text-t12 px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab] font-bold">
                                    {sp.school || '通用'}
                                  </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <CopyTextButton
                                    testId={`copy-spell-${idx}`}
                                    toastLabel={sp.name}
                                    showToast={showToast}
                                    getText={() =>
                                      formatSpellCopyText({
                                        spell: sp,
                                        checkFormula: isOffensive
                                          ? `[INS + WLP] (d${spellCheck.die1}+d${spellCheck.die2})${spellCheck.mod !== 0 ? ` + ${spellCheck.mod}` : ''}`
                                          : '',
                                        damageFormula:
                                          isOffensive && spellDamage.damageType
                                            ? `[HR + ${spellDamage.hrBonus}] ${spellDamage.damageType}`
                                            : '',
                                        characterName: character.name
                                      })
                                    }
                                  />
                                  <UnavailableHint gate={spellGate} testId={`gate-spell-${idx}`} />
                                  <button
                                    type="button"
                                    onClick={() => handleCastSpell(sp)}
                                    className={`px-2.5 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#3c2415] font-bold text-xs transition-colors flex items-center gap-1 ${spellGate.blocked ? GATED_BUTTON_CLASS : ''}`}
                                    {...gateButtonAttrs(spellGate)}
                                  >
                                    <span>施放 (-{sp.mp})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleForgetSpell(sp.name)}
                                    className="p-1 rounded text-[#7c6a58] hover:text-[#8c3235] transition-colors"
                                    title="遺忘咒語"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Formula Pills Row */}
                              <div className="flex items-center gap-2 flex-wrap font-mono text-t12">
                                <span className="px-2 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#e8dcc4] font-bold">
                                  {sp.mp} MP
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#fbf7ee] text-[#3c2415] border border-[#e8dcc4] font-sans">
                                  {sp.target || '單體'}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#fbf7ee] text-[#3c2415] border border-[#e8dcc4] font-sans">
                                  {sp.duration || '瞬發'}
                                </span>

                                {/* Offensive Check Pill */}
                                {isOffensive && (
                                  <button
                                    type="button"
                                    onClick={() => openCharacterDice({
                                      die1: spellCheck.die1,
                                      die2: spellCheck.die2,
                                      modifier: spellCheck.mod,
                                      damageBonus: spellDamage.hrBonus,
                                      damageType: spellDamage.damageType || '無',
                                      label: `${sp.name} 魔法判定 [INS + WLP]`
                                    })}
                                    className="px-2.5 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] font-bold flex items-center gap-1 transition-colors"
                                    title="點擊直接擲骰魔法判定（自動附帶 HR 傷害計算）"
                                  >
                                    <GiRollingDices className="w-3.5 h-3.5 text-[#6b5a4b]" />
                                    <span>[INS + WLP]</span>
                                    <span className="text-t12 text-[#6b5a4b] font-normal">(d{spellCheck.die1}+d{spellCheck.die2})</span>
                                  </button>
                                )}

                                {isOffensive && spellDamage.damageType && (
                                  <span className="px-2 py-0.5 rounded bg-[#f4ebd9] text-[#8c3235] border border-[#e8dcc4] font-bold flex items-center gap-1">
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
                                    className="text-t12 text-[#7c6a58] hover:text-[#2c221e] flex items-center gap-1 font-medium mb-1"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    <span>{isExpanded ? '收合效果詳情' : '展開效果詳情'}</span>
                                  </button>
                                  {isExpanded && (
                                    <p className="text-t12 text-[#6b5a4b] bg-[#fbf7ee] p-2.5 rounded border border-[#e8dcc4] leading-relaxed whitespace-pre-wrap">
                                      {renderTextWithAffinities(sp.effect)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : grants.capacity > 0 ? (
                      /* 有額度、還沒學：給他「怎麼學」而不是「隨便挑」。 */
                      <EmptyState
                        kind="spells-ready"
                        icon={GiSpellBook}
                        title="尚未掌握任何咒語"
                        teach={`你的${grants.summary}可以學 ${grants.remaining} 個咒語。每次獲得對應的魔法技能學一個同清單咒語，選定後在角色卡上扣除對應的 MP 上限。`}
                        action={{ label: '從可選清單挑選咒語', onClick: () => setIsSpellModalOpen(true) }}
                      />
                    ) : grants.chimerist ? (
                      /* 嵌合師：額度有、來源不在規則庫。這裡給的是一句規則，不是誘餌按鈕。 */
                      <EmptyState
                        kind="spells-chimerist"
                        icon={GiSpellBook}
                        title="還沒有記錄任何嵌合師咒語"
                        teach={`【咒語模仿 SL ${grants.chimerist.sl}】最多可同時記憶 ${grants.chimerist.capacity} 個咒語，但只能在衝突中親眼看見野獸、魔獸或植物施展並結算之後記錄下來——這份清單不在規則庫裡，所以沒有「挑選」入口。`}
                      />
                    ) : (
                      /* 完全沒有來源：非施法者。這裡**不給學習入口**，給的是「這條路怎麼走」
                         以及「去哪裡看本職業到底有什麼」。 */
                      <div className="space-y-2">
                        <EmptyState
                          kind="spells-unavailable"
                          icon={GiSpellBook}
                          title="本職業沒有咒語學派"
                          teach="咒語不是自由選購的（核心手冊 188~210 頁）：只能經由【元素魔法】、【熵系魔法】、【靈魂魔法】（每次獲得該技能學一個同清單咒語）、嵌合師的【咒語模仿】（上限 SL＋2），或英雄技能【額外咒語】（再添 2 個）取得。"
                          action={{ label: '前往職業技能分頁', onClick: () => setActiveTab('skills') }}
                        />
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => openRuleCodex('核心職業法術書')}
                            className="text-t11 text-[#7c6a58] hover:text-[#2c221e] underline underline-offset-2 font-bold transition-colors"
                          >
                            到規則庫查閱核心職業法術書
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 儀式魔法速查與施展計算器（Core p.118–121） */}
                    {(() => {
                      // 沒有儀式權限的人**看不到計算器**，更看不到施放按鈕。
                      //
                      // 原本這裡無條件渲染計算器，而「扣除 X MP 並擲儀式檢定」也照樣可按——
                      // 等於任何非施法者都能真的扣 MP 擲一次儀式檢定。核心手冊 p.118~121 的
                      // 要求是：施展儀式需要對應學派的職業技能，或職業免費能力賦予的
                      // 儀式學派權限；沒有的人只能在同伴施展時參與團隊檢定協助。
                      // 判定在 `describeRitualRights`，這裡只負責畫。
                      if (!rights.canPerform) {
                        return (
                          <div
                            data-testid="hud-ritual-unavailable"
                            className="p-3.5 rounded bg-[#fbf7ee] border border-[#d6c7ab] space-y-2"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-bold text-xs text-[#3c2415] flex items-center gap-1.5">
                                <GiCrystalBall className="w-4 h-4 text-[#7c6a58]" />
                                <span>儀式魔法（本角色尚無施展權）</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => openRuleCodex('儀式魔法')}
                                className="px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-t11 font-bold text-[#3c2415]"
                              >
                                儀式規則速查
                              </button>
                            </div>
                            <p className="text-t12 text-[#6b5a4b] leading-relaxed">
                              施展儀式需要對應學派的職業技能（秘儀／嵌合／元素／熵系／靈魂學派儀式），
                              或職業免費能力賦予的儀式學派權限。這一頁不替你扣 MP、也不替你擲檢定。
                            </p>
                            <p className="text-t12 text-[#6b5a4b] leading-relaxed flex items-start gap-1.5">
                              <span className="text-[#8c3235] font-bold shrink-0">✦</span>
                              <span>
                                同伴施展儀式時你仍可參與——
                                核心手冊 p.121：施法檢定會轉化為團隊檢定，由儀式發起者擔任領隊，
                                <span className="text-[#3c2415] font-bold">即使協助者本身不具備儀式施法能力</span>。
                              </span>
                            </p>
                          </div>
                        );
                      }
                      const POTENCY_MAP = {
                        minor: { key: 'minor', label: '小', mp: 20, dl: 7, clock: '4 格' },
                        medium: { key: 'medium', label: '中', mp: 30, dl: 10, clock: '6 格' },
                        major: { key: 'major', label: '大', mp: 40, dl: 13, clock: '6 格' },
                        extreme: { key: 'extreme', label: '強', mp: 50, dl: 16, clock: '8 格' }
                      };
                      const AREA_MAP = {
                        individual: { key: 'individual', label: '個體 ×1', mult: 1 },
                        small: { key: 'small', label: '小型 ×2', mult: 2 },
                        large: { key: 'large', label: '大型 ×3', mult: 3 },
                        huge: { key: 'huge', label: '巨型 ×4', mult: 4 }
                      };
                      // 學派清單改由 `describeRitualRights` 供應。原本這裡手抄一份
                      // `RITUAL_SKILLS` 再掃技能——那份清單漏了「職業免費能力賦予的
                      // 儀式學派權限」，所以元素師／熵師／靈師／嵌合師會被誤判成
                      // 「尚未習得儀式技能」，而判定規則又只活在 JSX 裡，測不到。
                      const learnedRituals = rights.schools;
                      const pot = POTENCY_MAP[ritualPotency] || POTENCY_MAP.minor;
                      const ar = AREA_MAP[ritualArea] || AREA_MAP.individual;
                      const rawMp = pot.mp * ar.mult;
                      const finalMp = ritualHasIngredient ? Math.floor(rawMp / 2) : rawMp;
                      const ritualGate = describeCostGate({ cost: finalMp, current: curMp, unit: GATE_UNITS.mp });

                      return (
                        <div
                          data-testid="hud-ritual-calculator"
                          className="p-3.5 rounded bg-[#fbf7ee] border border-[#d6c7ab] space-y-2.5"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-bold text-xs text-[#3c2415] flex items-center gap-1.5">
                              <GiCrystalBall className="w-4 h-4 text-[#8c3235]" />
                              <span>儀式魔法（效力 × 範圍 MP 與難度計算器）</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => openRuleCodex('儀式魔法')}
                              className="px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-t11 font-bold text-[#3c2415]"
                            >
                              儀式規則速查
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-t11">
                            <span className="text-[#6b5a4b] font-bold">可施展的儀式學派:</span>
                            {learnedRituals.length > 0 ? learnedRituals.map((r, rIdx) => (
                              <span
                                key={rIdx}
                                className="px-2 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-[#3c2415] font-bold"
                                title={`來源：${r.from}`}
                              >
                                ✦ {r.name} [{r.formula}]
                              </span>
                            )) : (
                              <span className="text-[#7c6a58]">—</span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-t11">
                            <div className="space-y-1">
                              <span className="text-[#6b5a4b] font-bold block">1. 儀式效力（決定基礎 MP 與難度 DL）</span>
                              <div className="grid grid-cols-4 gap-1">
                                {Object.values(POTENCY_MAP).map(item => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setRitualPotency(item.key)}
                                    className={`py-1 px-1.5 rounded border font-bold transition-colors ${
                                      ritualPotency === item.key
                                        ? 'bg-[#a63d40] text-[#fffdf9] border-[#8c3235]'
                                        : 'bg-[#fffdf9] text-[#3c2415] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                                    }`}
                                  >
                                    <div>{item.label} ({item.mp})</div>
                                    <div className="text-t10 opacity-90">DL {item.dl}</div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[#6b5a4b] font-bold block">2. 影響範圍（決定 MP 倍率）</span>
                              <div className="grid grid-cols-4 gap-1">
                                {Object.values(AREA_MAP).map(item => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setRitualArea(item.key)}
                                    className={`py-1.5 px-1 rounded border font-bold transition-colors ${
                                      ritualArea === item.key
                                        ? 'bg-[#a63d40] text-[#fffdf9] border-[#8c3235]'
                                        : 'bg-[#fffdf9] text-[#3c2415] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="pt-1 border-t border-[#e8dcc4] flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3 flex-wrap text-t12">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-[#3c2415]">
                                <input
                                  type="checkbox"
                                  checked={ritualHasIngredient}
                                  onChange={e => setRitualHasIngredient(e.target.checked)}
                                  className="rounded border-[#d6c7ab]"
                                />
                                <span>提供稀有材料（MP 減半）</span>
                              </label>
                              <span className="font-bold text-[#8c3235]">
                                總消耗：{finalMp} MP · 難度 DL {pot.dl} · 衝突命刻 {pot.clock}
                              </span>
                            </div>

                            <UnavailableHint gate={ritualGate} testId="gate-ritual" />
                            <button
                              type="button"
                              onClick={() => {
                                if (curMp < finalMp) {
                                  showToast(`MP 不足！施展此儀式需要 ${finalMp} 點 MP`, 'warning');
                                  return;
                                }
                                adjustMp(-finalMp);
                                const primary = rights.primary;
                                const formulaStr = primary?.formula || 'INS + WLP';
                                const rCheck = parseCheckFormula(formulaStr, stats);
                                openCharacterDice({
                                  die1: rCheck.die1,
                                  die2: rCheck.die2,
                                  modifier: rCheck.mod,
                                  label: `施展儀式（${primary?.name || ''}學派 · 效力${pot.label}×${ar.label}，DL ${pot.dl}）[${formulaStr}]`
                                });
                              }}
                              className={`px-3 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1 ${ritualGate.blocked ? GATED_BUTTON_CLASS : ''}`}
                              {...gateButtonAttrs(ritualGate)}
                            >
                              <GiRollingDices className="w-3.5 h-3.5" />
                              <span>扣除 {finalMp} MP 並擲儀式檢定 (DL {pot.dl})</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Chimerist Spells in Magic Tab (if active) */}
                    {isClassPanelActive(character, '嵌合師') && (
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
                  );
                })()}

                {/* TAB 3: 職業技能 (Class Skills - Streamlined) */}
                {activeTab === 'skills' && (
                  <div className="space-y-4 animate-fade-in text-xs">
                    {(character.classes || []).map((cl, cIdx) => {
                      const cName = normalizeClassName(cl.className);
                      const classDef = rulesData.classes[cName];
                      const freeBenefitLabel = describeFreeBenefit(classDef, cl);
                      return (
                      <div key={cIdx} className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap border-b pb-1" style={{ borderColor: theme.border }}>
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-black text-sm" style={{ color: theme.textDark }}>{withEn(cName)}</span>
                            <JRPGBadge variant={theme.badgeVariant} size="xs">Lv {cl.level}</JRPGBadge>
                          </div>
                          {freeBenefitLabel && (
                            <span className="text-t11 px-2 py-0.5 rounded bg-[#fbf7ee] border border-[#e8dcc4] text-[#6b5a4b]">
                              免費增益：{freeBenefitLabel}
                            </span>
                          )}
                        </div>

                        {/* F-020（2026-10-27）：這個職業的面板不在這一頁時，直接說它在哪。
                            以前「武器與戰鬥」與「職業技能」各掛一次同一份面板（DOM 加倍），
                            而死靈術士只在「武器與戰鬥」——玩家學了【殘酷的誕生】會來這裡找，然後以為沒做。
                            現在面板只掛一次，這一頁只負責指路。文案與判斷都來自 `data/classPanels.js`。 */}
                        {classPanelHint(character, cName, 'skills') ? (
                          <p
                            className="text-t11 leading-relaxed rounded border-l-2 pl-2 py-1"
                            style={{ color: theme.textMuted, borderColor: theme.accent }}
                            data-testid={`class-panel-hint-${cName}`}
                          >
                            ※ {classPanelHint(character, cName, 'skills')}
                          </p>
                        ) : null}

                        <div className="space-y-2">
                          {(cl.skills || []).map((sk, sIdx) => {
                            const normSkName = normalizeSkillName(sk.name);
                            const skillDef = classDef?.skills?.find(s => s.name === normSkName);
                            const display = resolveSkillDisplay({ ...sk, name: normSkName }, skillDef);
                            const isExpanded = !!expandedSkills[`${cName}_${normSkName}`];

                            return (
                              <div key={sIdx} className="p-3 bg-white rounded border transition-all hover:border-[#3c2415]" style={{ borderColor: theme.border }}>
                                <div className="flex items-center justify-between font-bold mb-1">
                                  <span className="flex items-center gap-1.5" style={{ color: theme.textDark }}>
                                    <span style={{ color: theme.accent }}>✦</span>
                                    <span>{display.name}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {cName === '修補匠' && normSkName === '小工具' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openRuleCodex('小工具');
                                        }}
                                        className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] font-bold text-t12 flex items-center gap-1 transition-all cursor-pointer"
                                        title="開啟小工具官方手冊完整速查大表 (手冊 p.212~216)"
                                      >
                                        <GiSpellBook className="text-[#6b5a4b] text-xs" />
                                        <span>規則索引</span>
                                      </button>
                                    )}
                                    <CopyTextButton
                                      testId={`copy-skill-${cName}-${normSkName}`}
                                      toastLabel={display.name}
                                      showToast={showToast}
                                      getText={() =>
                                        formatSkillCopyText({
                                          className: cName,
                                          name: display.name,
                                          sl: sk.sl,
                                          maxSL: display.maxSL || 5,
                                          desc: display.desc || '',
                                          characterName: character.name,
                                          characterLevel,
                                          character
                                        })
                                      }
                                    />
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]">
                                      SL {sk.sl} / {display.maxSL || 5}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-t14 text-[#6b5a4b] leading-relaxed">
                                  <div className={isExpanded ? '' : 'line-clamp-2'}>
                                    <SkillDescription desc={display.desc || '暫無描述'} sl={sk.sl} characterLevel={characterLevel} character={character} refSource={display.name} />
                                  </div>
                                  {display.desc && display.desc.length > 80 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleSkillExpand(`${cName}_${normSkName}`)}
                                      className="text-t12 text-[#3c2415] font-bold mt-1 flex items-center gap-0.5 cursor-pointer"
                                    >
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      <span>{isExpanded ? '收合' : '展開完整效果'}</span>
                                    </button>
                                  )}
                                </div>

                                {/* 效果流程：這一條技能在桌上真的做得到的事（計數器／開關／按鈕）。
                                    沒有流程的條目（純敘事）不會長出任何東西——不畫空框。 */}
                                <div className="mt-2">
                                  {renderFlowControls(
                                    flowItemForClassSkill(cName, normSkName),
                                    sk.sl,
                                    `flow-skill-${cName}-${normSkName}`
                                  )}
                                </div>

                                {/* 子項目已掌握清單與專屬機制 */}
                                {sk.selectedOptions && (Array.isArray(sk.selectedOptions) ? sk.selectedOptions.length > 0 : ((sk.selectedOptions.keys || []).length > 0 || (sk.selectedOptions.tones || []).length > 0)) && (
                                  <div className="mt-2.5 pt-2 border-t border-[#e8dcc4] space-y-2.5">
                                    {/* 1. 若為魔奏者【魔法演奏】，常駐渲染即時合成器 */}
                                    {cName === '魔奏者' && normSkName === '魔法演奏' && (
                                      <ChanterComposer
                                        character={character}
                                        selectedOptions={sk.selectedOptions}
                                        onConsumeMp={(mpCost) => adjustMp(-mpCost)}
                                        showToast={showToast}
                                      />
                                    )}

                                    {/* 2. 若為植物學家【植生術】，常駐渲染花園生長盤 */}
                                    {cName === '植物學家' && normSkName === '植生術' && (
                                      <FloristGardenTracker
                                        character={character}
                                        skillSL={sk.sl}
                                        selectedOptions={sk.selectedOptions}
                                        onChange={onChange}
                                        showToast={showToast}
                                      />
                                    )}

                                    {/* 3. 子項目效果速查清單與視圖切換 */}
                                    <div className="flex items-center justify-between text-t12 font-bold text-[#3c2415]">
                                      <span className="flex items-center gap-1 text-[#6b5a4b]">
                                        <GiSparkles className="w-3.5 h-3.5 text-[#6b5a4b]" />
                                        <span>已掌握項目戰鬥速查：</span>
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const key = `${cName}_${normSkName}`;
                                          setCollapsedSuboptions(prev => ({ ...prev, [key]: !prev[key] }));
                                        }}
                                        className="text-t12 px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#6b5a4b] font-normal transition-colors cursor-pointer"
                                      >
                                        {collapsedSuboptions[`${cName}_${normSkName}`] ? '展開效果卡片' : '收合為標籤'}
                                      </button>
                                    </div>

                                    {collapsedSuboptions[`${cName}_${normSkName}`] ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {Array.isArray(sk.selectedOptions) ? (
                                          sk.selectedOptions.map((optName, oIdx) => (
                                            <span
                                              key={oIdx}
                                              onClick={() => {
                                                const key = `${cName}_${normSkName}`;
                                                setCollapsedSuboptions(prev => ({ ...prev, [key]: false }));
                                              }}
                                              title="點擊展開查看效果"
                                              className="text-t12 px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#e8dcc4] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                              <span className="text-[#6b5a4b]">✦</span>
                                              <span>{optName}</span>
                                            </span>
                                          ))
                                        ) : (
                                          <>
                                            {(sk.selectedOptions.keys || []).map((k, kIdx) => (
                                              <span
                                                key={`k_${kIdx}`}
                                                onClick={() => {
                                                  const key = `${cName}_${normSkName}`;
                                                  setCollapsedSuboptions(prev => ({ ...prev, [key]: false }));
                                                }}
                                                title="點擊展開查看效果"
                                                className="text-t12 px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#e8dcc4] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                              >
                                                <span className="text-[#6b5a4b] text-t12">音調</span>
                                                <span>{k}</span>
                                              </span>
                                            ))}
                                            {(sk.selectedOptions.tones || []).map((t, tIdx) => (
                                              <span
                                                key={`t_${tIdx}`}
                                                onClick={() => {
                                                  const key = `${cName}_${normSkName}`;
                                                  setCollapsedSuboptions(prev => ({ ...prev, [key]: false }));
                                                }}
                                                title="點擊展開查看效果"
                                                className="text-t12 px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                              >
                                                <span className="text-[#6b5a4b] text-t12">曲風</span>
                                                <span>{t}</span>
                                              </span>
                                            ))}
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <SuboptionDetailsList
                                        className={cName}
                                        skillName={normSkName}
                                        selectedOptions={sk.selectedOptions}
                                        showVolumeBlock={true}
                                        variantId={sk.variantId || null}
                                        hasGreaterTheriomorphosis={hasGreaterTheriomorphosis(character)}
                                        characterName={character.name}
                                        showToast={showToast}
                                      />
                                    )}

                                    {/* 靈能者專屬靈刻時鐘 */}
                                    {cName === '靈能者' && normSkName === '心靈天賦' && (
                                      <div className="mt-2 p-2.5 bg-[#f4ebd9] rounded border border-[#d6c7ab] flex items-center justify-between gap-3 flex-wrap">
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
                                            <div className="font-bold text-xs text-[#3c2415] flex items-center gap-1.5">
                                              <span>靈刻時鐘</span>
                                              <span className="font-mono text-xs text-[#6b5a4b] font-bold">({character.brainwaveClock || 0} / 4)</span>
                                            </div>
                                            <p className="text-t12 text-[#7c6a58] leading-tight">
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
                                            className="px-2 py-1 text-xs rounded bg-white hover:bg-[#e8dcc4] disabled:opacity-30 border border-[#d6c7ab] text-[#3c2415] font-bold transition-colors cursor-pointer"
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
                                            className="px-2.5 py-1 text-xs rounded bg-[#a63d40] hover:bg-[#8c3235] disabled:opacity-30 text-[#fffdf9] font-bold transition-colors cursor-pointer"
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
                                            className="px-2 py-1 text-xs rounded bg-white hover:bg-[#f4ebd9] disabled:opacity-30 border border-[#d6c7ab] text-[#6b5a4b] hover:text-[#8c3235] font-medium transition-colors cursor-pointer"
                                            title="重設靈刻"
                                          >
                                            重設
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 修補匠小工具專屬戰鬥速查 */}
                                {cName === '修補匠' && normSkName === '小工具' && (
                                  <TinkererGadgetsQuickRef
                                    gadgetsData={character.tinkererData?.gadgets}
                                    sl={sk.sl}
                                    onOpenCodex={() => openRuleCodex('小工具')}
                                    characterLevel={getCharacterLevel(character)}
                                    characterName={character.name}
                                    showToast={showToast}
                                    variantId={sk.variantId || null}
                                    technoRestrictsEquipment={
                                      modeRestrictsEquipment(resolveCreationRules(character?.creationRules).technospheres)
                                    }
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* 職業專屬機制互動工具 (Subsystem Companions) */}
                        {shouldRenderArcanistPanel(character, cl.className) && (
                          <div className="mt-3">
                            <ArcanistManager
                              character={character}
                              onChange={onChange}
                              onOpenDice={onOpenDice}
                              showToast={showToast}
                            />
                          </div>
                        )}

                        {cName === '修補匠' && (
                          <div className="mt-3">
                            <TinkererWorkshop
                              character={character}
                              onChange={onChange}
                              onOpenDice={onOpenDice}
                              showToast={showToast}
                            />
                          </div>
                        )}

                        {cName === '美食家' && (cl.skills || []).some(s => normalizeSkillName(s.name) === '烹飪' && s.sl > 0) && (
                          <div className="mt-3">
                            <GourmetCookbook
                              character={character}
                              onChange={onChange}
                              showToast={showToast}
                            />
                          </div>
                        )}

                        {cName === '卡牌大師' && (cl.skills || []).some(s => normalizeSkillName(s.name) === '魔法卡組' && s.sl > 0) && (
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
                      );
                    })}

                    {/* 掌握之英雄技能 (Heroic Skills) */}
                    {(character.heroicSkills || []).length > 0 && (
                      <div data-testid="hud-heroic-skills" className="pt-3 border-t space-y-2" style={{ borderColor: theme.border }}>
                        <div className="font-serif font-black text-sm flex items-center gap-1.5 text-[#3c2415]">
                          <GiLaurelCrown className="w-4 h-4 text-[#a63d40]" />
                          <span>掌握之英雄技能</span>
                        </div>
                        <div className="space-y-2">
                          {(character.heroicSkills || []).map((hs, idx) => {
                            const resolved = resolveHeroicSkillEntry(hs, character);
                            if (!resolved) return null;
                            const sourceLabel = HEROIC_SKILL_SOURCE_LABELS[resolved.source] || '';
                            const effectText = resolved.effect || resolved.desc || '';
                            return (
                              <div key={idx} className="p-3 rounded bg-[#fbf7ee] border border-[#d6c7ab] space-y-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-[#3c2415] flex items-center gap-1.5">
                                    <span className="text-[#a63d40]">★</span>
                                    <span>{resolved.name}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {sourceLabel && (
                                      <span className="text-t11 px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#e8dcc4] text-[#6b5a4b]">
                                        {sourceLabel}{resolved.class ? ` · ${resolved.class}` : ''}
                                      </span>
                                    )}
                                    <CopyTextButton
                                      testId={`copy-heroic-${idx}`}
                                      toastLabel={resolved.name}
                                      showToast={showToast}
                                      getText={() =>
                                        formatHeroicSkillCopyText({
                                          name: resolved.name,
                                          className: resolved.class || '',
                                          sourceLabel,
                                          effect: effectText,
                                          characterName: character.name,
                                          characterLevel,
                                          character
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                {effectText && (
                                  <div className="text-t12 text-[#6b5a4b] leading-relaxed whitespace-pre-wrap">
                                    <SkillDescription desc={effectText} characterLevel={characterLevel} character={character} linkCodex={false} refSource={resolved.name} />
                                  </div>
                                )}
                                {/* 英雄技能的流程控件。167 條裡以前只有 4 條真的算得出來
                                    （額外HP／IP／MP／預言守護者），其餘只能靠玩家記在紙上。 */}
                                <div className="pt-1">
                                  {renderFlowControls(
                                    flowItemForHeroic(resolved.name),
                                    0,
                                    `flow-heroic-${idx}`
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 金手指特質全文 (Quirk Full Text & Selected Effect) */}
                    {character.quirk && character.quirk !== '無' && (() => {
                      // 效果全文的唯一來源是引擎（`quirkEffectText`）：這裡以前讀 `quirkDef?.effect`，
                      // 而 46 個金手指的欄位叫 `desc`——於是跑團時 46 條全部只印「已啟用金手指【X】。」。
                      const quirkText = quirkEffectText(character.quirk);
                      const choiceRows = describeQuirkChoice(character);
                      const choiceSummary = choiceRows
                        .map(r => (r.group ? `${r.group}：${r.label}` : r.label))
                        .join('、');
                      return (
                        <div data-testid="hud-quirk-detail" className="pt-3 border-t space-y-2" style={{ borderColor: theme.border }}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="font-serif font-black text-sm flex items-center gap-1.5 text-[#3c2415]">
                              <GiSparkles className="w-4 h-4 text-[#a63d40]" />
                              <span>金手指特質：{character.quirk}</span>
                            </div>
                            <CopyTextButton
                              testId="copy-quirk"
                              toastLabel={character.quirk}
                              showToast={showToast}
                              getText={() =>
                                formatQuirkCopyText({
                                  name: character.quirk,
                                  choiceSummary,
                                  effect: quirkText,
                                  characterName: character.name,
                                  characterLevel,
                                  character
                                })
                              }
                            />
                          </div>
                          <div className="p-3 rounded bg-[#fbf7ee] border border-[#d6c7ab] space-y-1.5">
                            {choiceSummary && (
                              <div className="text-t11 font-bold text-[#8c3235] bg-[#f4ebd9] px-2 py-1 rounded border border-[#e8dcc4]">
                                ✦ 已選效果：{choiceSummary}
                              </div>
                            )}
                            {quirkText ? (
                              <div className="text-t12 text-[#6b5a4b] leading-relaxed whitespace-pre-wrap" data-testid="hud-quirk-effect">
                                <SkillDescription desc={quirkText} characterLevel={characterLevel} character={character} linkCodex={false} refSource={character.quirk} />
                              </div>
                            ) : (
                              <p className="text-t12 text-[#7c6a58]">已啟用金手指【{character.quirk}】。</p>
                            )}
                            {/* 金手指的流程控件（專屬 FlowDataPanel 或通用計數器／開關／按鈕） */}
                            {(() => {
                              const itemId = `quirk:${character.quirk}`;
                              const spec = specFor(itemId);
                              if (spec) {
                                const entry = readEntry(character, itemId);
                                const clockRes = spec.clock?.resourceId ? (character.classResources || {})[spec.clock.resourceId] : null;
                                const clockMax = spec.clock?.max ?? 10;
                                const clockObj = spec.clock ? {
                                  value: Number.isFinite(clockRes) ? clockRes : 0,
                                  max: clockMax,
                                  label: spec.clock.label || '疲勞值'
                                } : null;

                                return (
                                  <div className="pt-2">
                                    <FlowDataPanel
                                      character={character}
                                      itemId={itemId}
                                      spec={spec}
                                      entry={entry}
                                      theme={theme}
                                      clock={clockObj}
                                      onRecordChange={(index, patch) => {
                                        const nextChar = setRecord(character, itemId, index, patch);
                                        onChange({
                                          ...nextChar,
                                          updatedAt: new Date().toISOString()
                                        });
                                      }}
                                      onAddRecord={() => {
                                        const nextChar = addRecord(character, itemId, { name: '', look: '' });
                                        onChange({
                                          ...nextChar,
                                          updatedAt: new Date().toISOString()
                                        });
                                      }}
                                      onRemoveRecord={(index) => {
                                        const nextChar = removeRecord(character, itemId, index);
                                        onChange({
                                          ...nextChar,
                                          updatedAt: new Date().toISOString()
                                        });
                                      }}
                                      onUseBuff={(buffId) => {
                                        const roll = Math.floor(Math.random() * 6) + 1;
                                        const plan = planBuffUse(character, itemId, buffId, { roll });
                                        if (!plan.ok) {
                                          showToast(plan.reason, 'warning');
                                          return;
                                        }
                                        const { classResources: patchResources, ...patchRest } = plan.patch || {};
                                        const nextChar = {
                                          ...character,
                                          ...patchRest,
                                          ...(patchResources ? {
                                            classResources: {
                                              ...(character.classResources || {}),
                                              ...patchResources
                                            }
                                          } : {}),
                                          updatedAt: new Date().toISOString()
                                        };
                                        if (plan.log) {
                                          onChange(loggableChange(character, nextChar, plan.log));
                                        } else {
                                          onChange(nextChar);
                                        }
                                        showToast(plan.toast, 'success');
                                      }}
                                      onSettle={(settleId) => {
                                        const roll = Math.floor(Math.random() * 6) + 1;
                                        const plan = planSettlement(character, itemId, settleId || 'chapter', { roll });
                                        if (!plan.ok) {
                                          showToast(plan.reason, 'warning');
                                          return;
                                        }
                                        const { classResources: patchResources, ...patchRest } = plan.patch || {};
                                        const nextChar = {
                                          ...character,
                                          ...patchRest,
                                          ...(patchResources ? {
                                            classResources: {
                                              ...(character.classResources || {}),
                                              ...patchResources
                                            }
                                          } : {}),
                                          updatedAt: new Date().toISOString()
                                        };
                                        if (plan.log) {
                                          onChange(loggableChange(character, nextChar, plan.log));
                                        } else {
                                          onChange(nextChar);
                                        }
                                        showToast(plan.toast, 'success');
                                      }}
                                      testId={`flowdata-quirk-${character.quirk}`}
                                    />
                                  </div>
                                );
                              }
                              return (
                                <div className="pt-1">
                                  {renderFlowControls(
                                    flowItemForQuirk(character.quirk),
                                    0,
                                    'flow-quirk'
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 4: 情感羈絆 (Bonds) */}
                {activeTab === 'bonds' && (
                  <div className="space-y-3 animate-fade-in text-xs">
                    {/* 羈絆激勵的門檻是**全域**的（物語點共用），所以提示放一行在這裡，
                        而不是每條羈絆各掛一個「差 1 物語點」——六條羈絆會變成六行噪音。 */}
                    {bondInspireGate.blocked && (
                      <div data-testid="gate-bonds-notice" className="px-2.5 py-1.5 rounded bg-[#fbf7ee] border border-[#d6c7ab] text-t12 font-bold text-[#8c3235]">
                        物語點不足（現有 {bondInspireGate.current} 點，激勵羈絆需要 1 點），下方「激勵」按鈕暫時不能用。
                      </div>
                    )}
                    {/* 營地活動：休息場景的一部分（原書 p.130「進行活動與調整羈絆可以同時做」）。
                        規則沒開、金手指也沒給 → 整塊不出現（與底力技同一個原則）。 */}
                    {campAccess.enabled && (
                      <CampActivitiesBlock
                        character={character}
                        theme={theme}
                        mode="play"
                        allowance={campAccess.allowance}
                        quirkGrant={campAccess.quirkGrant}
                        // 算上限（IP 夾制）要的是引擎算出來的那份 stats；
                        // 不傳的話 IP 一律進「要玩家自己做」清單（不猜上限）。
                        stats={stats}
                        // 營地活動的後果以前**完全不存在**：按下「標記使用」只改一個旗標，
                        // HP／MP／IP／資金／食材／專案進度一個都不會動。
                        // `applyCampPlan` 是唯一寫入路（含錢包走 `applyMoneyFlow`、履歷走 `kind:'camp'`），
                        // 所以這裡只負責「算好的 plan → 存檔 → 說話」，不在 JSX 裡重算一次。
                        onApply={(plan) => {
                          if (!plan || !plan.ok) {
                            if (plan?.reason) showToast(plan.reason, 'warning');
                            return;
                          }
                          commit(applyCampPlan(characterRef.current, plan));
                          showToast(describeCampOutcome(plan), 'success');
                        }}
                        onChange={(campActivities) => {
                          // 營地活動有兩種變動：改「選了哪兩種」與「本次休息用了哪一種」。
                          // 兩者都是這張卡的決定，但履歷上要分得出來——標題寫一樣就等於沒寫。
                          const beforePicked = (character.campActivities?.picked || []).join('|');
                          const afterPicked = (campActivities?.picked || []).join('|');
                          updateField('campActivities', campActivities, {
                            kind: 'camp',
                            title: beforePicked === afterPicked ? '營地活動：本次休息的使用記錄' : '調整營地活動選擇',
                            fields: []
                          });
                        }}
                        showToast={showToast}
                      />
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
                        <GiHeartShield className="w-4 h-4 text-[#8c3235]" />
                        <span>三維六向情感羈絆 (最多 6 個)</span>
                      </span>
                      {(character.bonds || []).length < 6 && (
                        <button
                          type="button"
                          onClick={handleOpenBondModal}
                          className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>新增羈絆</span>
                        </button>
                      )}
                    </div>

                    {(character.bonds || []).map((bond, bIdx) => {
                      const isEditingThis = editingBondId === bond.id;
                      // 名冊關係：none（刻意不連）／linked（連得上）／missing（那張卡被刪了）。
                      // 三者要畫成三種樣子——把 none 與 missing 畫成一樣，等於每次都在
                      // 一條本來就正確的羈絆上報錯。
                      const link = resolveBondNpc(bond, npcPool);
                      const npcSubtitle = bondNpcSubtitle(link.npc);
                      const FEELING_PAIRS = [
                        [{ k: 'admiration', l: '欽佩' }, { k: 'inferiority', l: '自卑' }],
                        [{ k: 'loyalty', l: '忠誠' }, { k: 'mistrust', l: '疑忌' }],
                        [{ k: 'affection', l: '喜愛' }, { k: 'hatred', l: '仇恨' }]
                      ];
                      return (
                      <div key={bIdx} className="p-3.5 bg-white rounded border space-y-2.5" style={{ borderColor: theme.border }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {link.status === 'linked' && link.npc.avatarBase64 && (
                              <img
                                src={link.npc.avatarBase64}
                                alt=""
                                className="w-9 h-9 rounded object-cover border shrink-0"
                                style={{ borderColor: theme.border }}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-[#2c221e]">{bond.target}</div>
                              {link.status === 'linked' && npcSubtitle && (
                                <div className="text-t11 text-[#7c6a58] mt-0.5">{npcSubtitle}</div>
                              )}
                              {link.status === 'missing' && (
                                /* 名冊那張卡被刪了。**名字要留著**——那是玩家自己寫的，
                                   不是連結的附屬品。這裡只說明「連結斷了」，不代替他決定要改什麼。 */
                                <div className="text-t11 text-[#8c3235] mt-0.5">名冊已無此人（連結已失效）</div>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {(bond.feelings || []).map(f => (
                                  <span key={f} className="px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#e8dcc4] text-t12 text-[#8c3235] font-bold">
                                    {FEELING_LABELS[f] || f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const strength = bond.feelings?.length || 1;
                                if ((character.fabulaPoints ?? 3) <= 0) {
                                  showToast('物語點不足');
                                  return;
                                }
                                // 2026-10-30：這顆按鈕原本只扣 1 FP 並跳一句「+N 加值」，
                                // 而**加值從來沒有加到任何地方**——真正的激勵在擲骰器裡
                                // （`DiceRollerModal.handleInvokeBond`）。同一個規則兩個入口，
                                // 其中一個只記帳，等於按鈕在說謊。
                                // 現在它把玩家送到那個會真的算加值的地方，FP 也只在那裡扣一次。
                                if (!onOpenDice) {
                                  showToast('擲骰器沒有開啟，請從上方「擲骰」進入後再激勵羈絆');
                                  return;
                                }
                                openCharacterDice({
                                  label: `激勵羈絆【${bond.target}】`,
                                  presetBondId: bond.id
                                });
                                showToast(`擲完骰後點【${bond.target}】套用 +${strength}（消耗 1 物語點）`);
                              }}
                              className={`px-3 py-1.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-[#8c3235] font-bold text-xs shrink-0 ${bondInspireGate.blocked ? GATED_BUTTON_CLASS : ''}`}
                              title="開啟擲骰器，擲完骰後套用這條羈絆的情感加值（消耗 1 物語點）"
                              {...gateButtonAttrs(bondInspireGate)}
                            >
                              激勵 (+{bond.feelings?.length || 1})
                            </button>
                            <button
                              type="button"
                              onClick={() => isEditingThis ? setEditingBondId(null) : handleOpenEditBond(bond)}
                              className="px-2 py-1.5 rounded bg-[#fbf7ee] hover:bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415] font-bold text-xs"
                              title="休息場景調整羈絆情感"
                            >
                              ✎ 調整
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBond(bond.id)}
                              className="p-1 rounded text-[#7c6a58] hover:text-[#8c3235] transition-colors"
                              title="刪除羈絆"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isEditingThis && (
                          <div className="pt-2.5 border-t border-[#e8dcc4] bg-[#fbf7ee] p-2.5 rounded space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-t11 font-bold text-[#6b5a4b] shrink-0">對象名稱:</span>
                              <input
                                type="text"
                                value={editBondTarget}
                                onChange={e => setEditBondTarget(e.target.value)}
                                className="flex-1 px-2 py-1 rounded border border-[#d6c7ab] bg-[#fffdf9] text-xs font-bold text-[#3c2415]"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-t11 font-bold text-[#6b5a4b] block">對應 NPC 檔案庫（選填）:</span>
                              <BondNpcSelect
                                testId="bond-edit-npc"
                                value={editBondNpcId}
                                pool={npcPool}
                                onChange={setEditBondNpcId}
                                onPick={(npc) => setEditBondTarget(npc.name || '')}
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-t11 font-bold text-[#6b5a4b] block">三維情感（每組對立情感最多選 1 項）：</span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                {FEELING_PAIRS.map((pair, pIdx) => (
                                  <div key={pIdx} className="flex items-center gap-1 bg-[#fffdf9] p-1 rounded border border-[#e8dcc4]">
                                    {pair.map(item => {
                                      const active = editBondFeelings.includes(item.k);
                                      const otherKey = pair.find(x => x.k !== item.k).k;
                                      return (
                                        <button
                                          key={item.k}
                                          type="button"
                                          onClick={() => {
                                            setEditBondFeelings(prev => {
                                              if (prev.includes(item.k)) return prev.filter(x => x !== item.k);
                                              return [...prev.filter(x => x !== otherKey), item.k];
                                            });
                                          }}
                                          className={`flex-1 py-1 rounded text-t11 font-bold transition-colors ${
                                            active
                                              ? 'bg-[#a63d40] text-[#fffdf9]'
                                              : 'bg-[#f4ebd9] text-[#3c2415] hover:bg-[#e8dcc4]'
                                          }`}
                                        >
                                          {item.l}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingBondId(null)}
                                className="px-2.5 py-1 rounded bg-[#f4ebd9] text-[#6b5a4b] font-bold text-t11"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEditedBond}
                                className="px-3 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t11"
                              >
                                儲存羈絆變更
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}

                    {(character.bonds || []).length === 0 && (
                      /* 空狀態：2026-10-23（v5.1 第三輪）
                         原本只有一行 `text-[#7c6a58]` 的「尚未建立羈絆。」——
                         ① 對比 2.56:1，連大字門檻都不到（實測見 docs/state.md §8.5）；
                         ② 它只說「沒有」，沒說「羈絆是什麼、為什麼要建」。
                         §8.4：空狀態是使用者保證會看到的畫面，要**教一件事**。
                         這裡不放 CTA——標頭那顆「新增羈絆」就在同一屏，重複兩顆等於兩件事。 */
                      <EmptyState
                        kind="bonds"
                        icon={GiHeartShield}
                        title="還沒有任何羈絆"
                        teach="激勵時消耗 1 物語點，檢定加值等於情感數；最多 6 條。"
                      />
                    )}
                  </div>
                )}

                {/* TAB 5: 個人命刻 (Clocks) */}
                {activeTab === 'clocks' && (
                  <div className="space-y-4 animate-fade-in">
                    {/* 底力命刻（高度奇幻手冊 p.124–131）：規則沒開就完全不出現。
                        它與下面的「個人命刻」是兩種東西——個人命刻是玩家自己建的命刻，
                        底力命刻是規則給的那一條，只有 6 格（合體之力 4 格）且填充方式受限。 */}
                    {isZeroPowersEnabled(character) && (
                      <ZeroPowerBlock
                        character={character}
                        theme={getCharacterTheme(character.themeColor)}
                        mode="play"
                        roster={roster}
                        onChange={(zeroPower) => updateField('zeroPower', zeroPower)}
                        onPartnerCleared={onPartnerCleared}
                        onRecoverHp={(factor) => {
                          /* 【覺醒之力】：回復等同危機值的 HP（原文 p.130）。 */
                          const gain = Math.max(0, Math.trunc(stats.crisisThreshold * factor));
                          const next = Math.min(stats.maxHp, curHp + gain);
                          if (gain === 0 || next === curHp) return;
                          updateField('currentHp', next, {
                            kind: 'hp',
                            title: '覺醒：回復 HP',
                            changes: [{ field: 'currentHp', from: curHp, to: next }]
                          });
                        }}
                        showToast={showToast}
                      />
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-[#3c2415] text-xs flex items-center gap-1.5">
                        <GiPocketWatch className="w-4 h-4 text-[#6b5a4b]" />
                        <span>個人命刻時鐘</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsClockModalOpen(true)}
                        className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1 transition-colors"
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
                              const prev = clk.filledSegments || 0;
                              const total = clk.totalSegments || 6;
                              if (newVal === prev) return;
                              const updated = (character.clocks || []).map(c => c.id === clk.id ? { ...c, filledSegments: newVal } : c);
                              // 命刻填滿是「目標達成」，跟「再推進一格」不是同一件事——
                              // 履歷上要分得出來，否則完成的時刻會混在一堆推進裡。
                              updateField('clocks', updated, {
                                kind: 'clock',
                                title: newVal >= total
                                  ? `命刻【${clk.title}】完成`
                                  : `命刻【${clk.title}】${newVal > prev ? '推進' : '回退'}`,
                                changes: [{ field: `clock:${clk.title}`, from: prev, to: newVal }]
                              });
                            }}
                          />
                          <button
                            onClick={() => handleDeleteClock(clk.id)}
                            className="absolute top-2 right-2 p-1 rounded bg-white/80 hover:bg-[#f4ebd9] text-[#7c6a58] hover:text-[#8c3235] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="刪除命刻"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {(character.clocks || []).length === 0 && (
                      /* 同上一條：原本是 `text-[#7c6a58]` 的一行「暫無個人命刻。」（2.56:1）。
                         這裡多教一件事——**個人命刻與章節命刻是兩種東西**，
                         使用者最容易搞混的就是「我該在這裡建，還是去『命刻記錄』那一章」。 */
                      <EmptyState
                        kind="personal-clocks"
                        icon={GiPocketWatch}
                        title="還沒有個人命刻"
                        teach="自己推動的命刻（例如「傷勢惡化」）；章節層級的在「命刻記錄」。"
                      />
                    )}
                  </div>
                )}

                {/* TAB 6: 行囊日誌 (Notes & Inventory) */}
                {/* TAB 7: 金錢與物語點（P13，2026-11-02）
                    ────────────────────────────────────────────────────────────
                    使用者裁定「右翼錢包收成一頁」。主畫面的資產窗只留兩個數字與
                    一個入口；收支／明細／物語點的六顆按鈕全部搬到這裡。
                    兩張卡**原樣搬過來**（不是重寫）：它們各自帶著
                    「原因必填」「明細由履歷推導」的既有契約，重寫等於多一條寫入路徑。
                    ──────────────────────────────────────────────────────────── */}
                {activeTab === 'money' && (
                  <div className="space-y-4 animate-fade-in text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* 金幣錢包 ＋ 物語點（P10 重排）
                        ─────────────────────────────────────────────────────────────
                        使用者：「金幣錢包的部分不要有 +- 和自己修改內容了。下面的按鈕改大，
                        只要收入和支出和明細兩三按鈕。金錢也很重要，做明顯一點。」

                        三件事各自有理由，不只是照做：
                        1. **拿掉 `−`／`+` 與可編輯輸入框**：那條路寫的是 `kind: 'zenit'`（合併、
                           沒有原因），與 P9-b 的「原因必填」是兩套記帳法。留著它，明細上就會出現
                           一堆沒有事由的「支出資金 350 → 300」，而那些列**對不上任何一件事**。
                        2. **三顆按鈕放進卡片裡**：原本它們擠在卡片下方的一條細帶上（與「最近一筆」
                           共用一行），高度只有 `py-0.5`——那不是「按得到」，是「看得到」。
                        3. **金額 25px**：面板上其他數字都是 12–16px。錢包是玩家最常低頭看的一格，
                           它應該比旁邊的屬性更顯眼，而不是一樣大。
                        ───────────────────────────────────────────────────────────── */}
                    <div data-testid="wallet-card" className="bg-[#fffdf9] rounded p-3 border space-y-2" style={{ borderColor: theme.border }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-t11 flex items-center gap-1.5" style={{ color: theme.textDark }}>
                          <GiCoins className="w-4 h-4" style={{ color: theme.accent }} />
                          金幣錢包
                        </span>
                        {/* 行內浮字：卡片上沒有空白可以讓浮字飄，所以貼在標題右側 */}
                        <ResourceDeltaBadge flash={zenitDelta} inline className="text-t11" />
                      </div>

                      {/* 金額自己一行、自己一個尺寸。`formatZenit(null)` 印破折號而不是 `0z`——
                          沒有 `zenit` 欄位的舊存檔是「不知道」，不是「沒錢」。 */}
                      <span
                        data-testid="wallet-amount"
                        className="block tabular-nums font-black text-t25 leading-none text-[#3c2415]"
                      >
                        {formatZenit(character.zenit)}
                      </span>

                      {/* 三顆按鈕：收入／支出／明細。點擊高度 `py-2`（原本 0.5），字級 t12（原本 t10）。 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          data-testid="wallet-income"
                          onClick={() => openMoneyFlow(MONEY_DIRECTIONS.gain)}
                          title="記一筆進帳（報酬、戰利品、借貸……）"
                          className="py-2 rounded border border-[#245c45] bg-[#245c45] hover:bg-[#1e4b39] text-[#fffdf9] font-bold text-t12 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiReceiveMoney className="w-3.5 h-3.5" />
                          收入
                        </button>
                        <button
                          type="button"
                          data-testid="wallet-expense"
                          onClick={() => openMoneyFlow(MONEY_DIRECTIONS.spend)}
                          title="記一筆花費（住宿、餐費、修裝……）"
                          className="py-2 rounded border border-[#a63d40] bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t12 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiPayMoney className="w-3.5 h-3.5" />
                          支出
                        </button>
                        <button
                          type="button"
                          data-testid="wallet-ledger"
                          onClick={() => setIsLedgerOpen(true)}
                          title="看這筆錢是怎麼進出的（由成長履歷推導）"
                          className="py-2 rounded border border-[#d6c7ab] bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] font-bold text-t12 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiScrollUnfurled className="w-3.5 h-3.5" />
                          明細
                        </button>
                      </div>

                    </div>

      {/* 物語點（P12，2026-11-02）：從「一行數字＋步進器」改成**第二個錢包**。
                        ─────────────────────────────────────────────────────────────
                        為什麼要拆掉步進器（這是使用者裁定的第 2 題）：
                        物語點是這張卡最後一個「有數字、沒原因」的資源。書上七條用途裡
                        三條要花 1 點（重擲／激勵羈絆／改變故事），價錢完全一樣——
                        所以履歷只寫「消耗物語點 3 → 2」時，玩家分不出那 1 點是為了什麼。
                        而擲骰器其實**早就把原因傳進來了**（`onSpendFp('引用特質重擲檢定')`），
                        只是那句話進了 toast 就消失。現在它寫進履歷的 `note`。
                        ───────────────────────────────────────────────────────────── */}
                    <div data-testid="fp-card" className="bg-[#fffdf9] rounded px-3 py-2 border space-y-2" style={{ borderColor: theme.border }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-t11 flex items-center gap-1.5" style={{ color: theme.textDark }}>
                          <GiSparkles className="w-4 h-4 text-[#6b5a4b]" />
                          物語點
                        </span>
                        <span data-testid="fp-amount" className="tabular-nums font-black text-t16 text-[#3c2415]">
                          {resolveFabulaPoints(character)} FP
                        </span>
                      </div>
                      {/* 三顆按鈕與錢包同一個排法：獲得（綠）／消耗（紅）／明細（米）。
                          高度 `py-1.5` 比錢包的 `py-2` 矮一級——物語點不搶錢包的重量。 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          data-testid="fp-gain"
                          onClick={() => openFpFlow(FP_DIRECTIONS.gain)}
                          title="記一筆獲得（反派登場、大失敗、投降……）"
                          className="py-1.5 rounded border border-[#245c45] bg-[#245c45] hover:bg-[#1e4b39] text-[#fffdf9] font-bold text-t12 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiReceiveMoney className="w-3.5 h-3.5" />
                          獲得
                        </button>
                        <button
                          type="button"
                          data-testid="fp-spend"
                          onClick={() => openFpFlow(FP_DIRECTIONS.spend)}
                          title="記一筆消耗（重擲、激勵羈絆、改變故事）"
                          className="py-1.5 rounded border border-[#a63d40] bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t12 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiPayMoney className="w-3.5 h-3.5" />
                          消耗
                        </button>
                        <button
                          type="button"
                          data-testid="fp-ledger"
                          onClick={() => setIsFpLedgerOpen(true)}
                          title="看每一點是為了什麼花掉的（由成長履歷推導）"
                          className="py-1.5 rounded border border-[#d6c7ab] bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] font-bold text-t12 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiScrollUnfurled className="w-3.5 h-3.5" />
                          明細
                        </button>
                      </div>
                    </div>
                    </div>
                    <div
                      data-testid="money-page-note"
                      className="p-3 rounded bg-[#fbf7ee] border border-[#e8dcc4] text-t11 text-[#6b5a4b] leading-relaxed"
                    >
                      資金與物語點只有「收入／支出／獲得／消耗」四個入口，而且<strong className="text-[#3c2415]">原因必填</strong>。
                      上面的明細是從成長履歷推導出來的，不另外存一份帳——同一個事實只有一個來源。
                    </div>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-4 animate-fade-in text-xs">
                    {/* 消耗品捷徑（P13）：原本在左翼的 IP 卡裡，與資源條搶同一個高度。
                        使用者裁定「左翼消耗品池收成一頁」——搬來行囊，
                        因為「我身上有什麼可以馬上用」本來就是行囊的事。 */}
                    <div className="p-3.5 rounded bg-[#fbf7ee] border border-[#e8dcc4] space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-[#3c2415] block">官方消耗品捷徑</span>
                        <span className="text-t11 text-[#6b5a4b]">
                          道具點 <strong className="font-mono text-[#3c2415]">{curIp}</strong> / {stats.maxIp}
                        </span>
                      </div>
                    {/* 官方五種基本 IP 消耗品（Core p.104） */}
                    <div data-testid="hud-ip-consumables" className="pt-2 border-t border-[#e8dcc4] space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUseConsumable('remedy')}
                          className={`px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#8c3235] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between ${consumableGates.remedy.blocked ? GATED_SHELL_CLASS : ''}`}
                          title={`大補藥（消耗 3 IP）：恢復 ${50 + secretFormulaSL * 5} 點 HP`}
                          {...gateButtonAttrs(consumableGates.remedy)}
                        >
                          <span className={consumableGates.remedy.blocked ? GATED_LABEL_CLASS : ''}>大補藥 (+{50 + secretFormulaSL * 5}HP)</span>
                          {consumableGates.remedy.blocked ? (
                            <UnavailableHint gate={consumableGates.remedy} testId="gate-consumable-remedy" />
                          ) : (
                            <span className="text-t10">3IP</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseConsumable('elixir')}
                          className={`px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between ${consumableGates.elixir.blocked ? GATED_SHELL_CLASS : ''}`}
                          title={`萬靈藥（消耗 3 IP）：恢復 ${50 + secretFormulaSL * 5} 點 MP`}
                          {...gateButtonAttrs(consumableGates.elixir)}
                        >
                          <span className={consumableGates.elixir.blocked ? GATED_LABEL_CLASS : ''}>萬靈藥 (+{50 + secretFormulaSL * 5}MP)</span>
                          {consumableGates.elixir.blocked ? (
                            <UnavailableHint gate={consumableGates.elixir} testId="gate-consumable-elixir" />
                          ) : (
                            <span className="text-t10">3IP</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseConsumable('tonic')}
                          className={`px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#6b5a4b] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between ${consumableGates.tonic.blocked ? GATED_SHELL_CLASS : ''}`}
                          title="滋補藥（消耗 2 IP）：解除所有異常狀態"
                          {...gateButtonAttrs(consumableGates.tonic)}
                        >
                          <span className={consumableGates.tonic.blocked ? GATED_LABEL_CLASS : ''}>滋補藥 (解全狀態)</span>
                          {consumableGates.tonic.blocked ? (
                            <UnavailableHint gate={consumableGates.tonic} testId="gate-consumable-tonic" />
                          ) : (
                            <span className="text-t10">2IP</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseConsumable('magicTent')}
                          className={`px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between ${consumableGates.magicTent.blocked ? GATED_SHELL_CLASS : ''}`}
                          title="魔法帳篷（消耗 4 IP）：野外休息回滿 HP／MP 並解除全部狀態"
                          {...gateButtonAttrs(consumableGates.magicTent)}
                        >
                          <span className={consumableGates.magicTent.blocked ? GATED_LABEL_CLASS : ''}>魔法帳篷 (全滿)</span>
                          {consumableGates.magicTent.blocked ? (
                            <UnavailableHint gate={consumableGates.magicTent} testId="gate-consumable-magicTent" />
                          ) : (
                            <span className="text-t10">4IP</span>
                          )}
                        </button>
                      </div>

                      {/* 元素碎片（2 IP，選風／電／土／火／冰，10+秘密配方SL 點傷害） */}
                      <div className="flex items-center gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleUseConsumable('elementalShard')}
                          className={`flex-1 px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#8c3235] border border-[#d6c7ab] text-t11 font-bold flex items-center justify-between ${consumableGates.elementalShard.blocked ? GATED_SHELL_CLASS : ''}`}
                          title={`元素碎片（消耗 2 IP）：對單一目標造成 ${10 + secretFormulaSL} 點【${shardElement}】傷害`}
                          {...gateButtonAttrs(consumableGates.elementalShard)}
                        >
                          <span className={consumableGates.elementalShard.blocked ? GATED_LABEL_CLASS : ''}>元素碎片 ({10 + secretFormulaSL}點{shardElement}傷)</span>
                          {consumableGates.elementalShard.blocked ? (
                            <UnavailableHint gate={consumableGates.elementalShard} testId="gate-consumable-elementalShard" />
                          ) : (
                            <span className="text-t10">2IP</span>
                          )}
                        </button>
                        <div className="flex items-center gap-0.5 bg-[#fbf7ee] p-0.5 rounded border border-[#d6c7ab]">
                          {['風', '電', '土', '火', '冰'].map(el => (
                            <button
                              key={el}
                              type="button"
                              onClick={() => setShardElement(el)}
                              className={`px-1.5 py-0.5 rounded text-t10 font-bold transition-colors ${
                                shardElement === el
                                  ? 'bg-[#a63d40] text-[#fffdf9]'
                                  : 'text-[#6b5a4b] hover:text-[#2c221e]'
                              }`}
                              title={`切換元素碎片屬性：${el}`}
                            >
                              {el}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    </div>
                    <div className="p-3.5 rounded bg-[#fbf7ee] border border-[#e8dcc4] space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-[#3c2415] block">冒險者行囊物品與武裝</span>
                        {/* 錢要出現在「做決定的地方」：這裡是看裝備的分頁，
                            所以餘額與購買入口都放這裡，而不是只留在主面板。
                            `formatZenit` 自己處理 `null`（＝不知道）→ 破折號。
                            原本寫 `character.zenit || 0`，那會把「還沒記錄」印成 `0z`，
                            而 `0z` 是一個合法的「你沒錢」——兩件事不該長得一樣。 */}
                        <span data-testid="pack-wallet" className="tabular-nums font-black text-t14 text-[#3c2415]">
                          錢包 {formatZenit(character.zenit)}
                        </span>
                      </div>
                      {/* 四顆按鈕（P10）：與主面板的錢包卡同一套語彙。
                          這裡不放「收支」那種一顆按鈕包兩種方向的做法——
                          點下去還要再選一次「這是收入還是支出」，等於把決定推遲到下一步。
                          2026-11-03：使用者裁定「支出與購入意思重複」——「購入」那顆整個拿掉，
                          改由「支出」在對話框裡勾「這筆有拿到東西」帶回物品（裝備／非裝備兩條路）。
                          所以這一列只剩三顆：收入／支出／明細。 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          data-testid="pack-money-flow"
                          onClick={() => openMoneyFlow(MONEY_DIRECTIONS.gain)}
                          title="記一筆進帳（報酬、戰利品、借貸……）"
                          className="py-1.5 rounded border border-[#245c45] bg-[#245c45] hover:bg-[#1e4b39] text-[#fffdf9] font-bold text-t11 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiReceiveMoney className="w-3 h-3" />
                          收入
                        </button>
                        <button
                          type="button"
                          data-testid="pack-money-spend"
                          onClick={() => openMoneyFlow(MONEY_DIRECTIONS.spend)}
                          title="記一筆花費（住宿、餐費、修裝……）"
                          className="py-1.5 rounded border border-[#a63d40] bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t11 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiPayMoney className="w-3 h-3" />
                          支出
                        </button>
                        <button
                          type="button"
                          data-testid="pack-ledger"
                          onClick={() => setIsLedgerOpen(true)}
                          title="看這筆錢是怎麼進出的（由成長履歷推導）"
                          className="py-1.5 rounded border border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#f4ebd9] text-[#3c2415] font-bold text-t11 flex items-center justify-center gap-1 transition-colors"
                        >
                          <GiScrollUnfurled className="w-3 h-3 text-[#6b5a4b]" />
                          明細
                        </button>
                      </div>
                      {/* 四個槽位改成按鈕（P9-b）。
                          原本是四行唯讀文字——看得到、換不了，唯一的換裝入口在編輯器，
                          而編輯器是「建卡的地方」。跑團中要換裝備不該先離開跑團面板。
                          每一格都標「換」，因為一格空白（未裝備）與一格滿的長得一樣，
                          沒有動詞就沒有人會去點它。 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.keys(EQUIPMENT_SLOTS).map((slotKey) => {
                          const slotMeta = EQUIPMENT_SLOTS[slotKey];
                          const value = character.equipment?.[slotKey];
                          return (
                            <button
                              key={slotKey}
                              type="button"
                              data-testid={`pack-slot-${slotKey}`}
                              onClick={() => setSlotPicker(slotKey)}
                              title={`更換${slotMeta.label}`}
                              className="group w-full text-left px-2 py-1.5 rounded border border-[#e8dcc4] bg-[#fffdf9] hover:border-[#3c2415]/40 hover:bg-[#f4ebd9] transition-colors flex items-center justify-between gap-2"
                            >
                              <span className="min-w-0">
                                <span className="block text-t10 text-[#6b5a4b]">{slotMeta.label}</span>
                                <span className={`block font-bold truncate ${value ? 'text-[#3c2415]' : 'text-[#7c6a58]'}`}>
                                  {value || slotMeta.emptyValue}
                                </span>
                              </span>
                              <span className="shrink-0 text-t10 text-[#6b5a4b] group-hover:text-[#3c2415] font-bold">
                                換
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 行囊物品（2026-11-03）：裝備槽只記「正在穿的」，
                        冒險途中拿到／買到的東西全部落在這裡。 */}
                    <div className="pt-2 border-t border-[#e8dcc4]">
                      <BackpackGrid
                        character={character}
                        theme={theme}
                        onChange={onChange}
                        onAdd={() => setIsBackpackAddOpen(true)}
                        onSell={handleSellInventoryItem}
                        onDiscard={handleDiscardInventoryItem}
                        showToast={showToast}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-bold text-[#3c2415] block">冒險筆記本</span>
                      <textarea
                        value={character.backpackNotes || ''}
                        onChange={e => updateField('backpackNotes', e.target.value)}
                        placeholder="在此記錄冒險日記、NPC 線索或秘密契約..."
                        rows={6}
                        className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded p-3 text-xs text-[#3c2415] outline-none focus:border-[#3c2415] leading-relaxed shadow-inner"
                      />
                    </div>
                  </div>
                )}
                </ErrorBoundary>
              </HudWindow>
            )}
          </div>
        </div>
      </div>

      {/* 3. 職業資源池（只有對應職業才出現；數值見 data/classResources.js） */}
      <ClassResourceStrip
        character={character}
        onChange={onChange}
        showToast={showToast}
      />

      {/* 4. 金手指相性（F-023，2026-10-26 P11） */}
      {(() => {
        const fx = stats.quirkEffects || {};
        const rows = [
          { label: '傷害免疫', values: fx.immuneDamage, tone: '#2c221e' },
          { label: '抗性', values: fx.resistances, tone: '#2c221e' },
          { label: '易傷', values: fx.vulnerabilities, tone: '#8c2d36' },
          { label: '吸收', values: fx.absorption, tone: '#2c221e' },
          { label: '狀態免疫', values: fx.immuneStatuses, tone: '#2c221e' },
          { label: '徒手傷害', values: fx.unarmedDamageBonus ? [`+${fx.unarmedDamageBonus}`] : [], tone: '#2c221e' }
        ].filter((row) => Array.isArray(row.values) && row.values.length > 0);
        if (rows.length === 0) return null;
        return (
          <div
            data-testid="hud-affinities"
            className="p-3.5 rounded bg-white border border-[#e8dcc4] space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#3c2415] flex items-center gap-1">
                <GiHeartShield className="w-3.5 h-3.5 text-[#6b5a4b]" />
                <span>金手指相性</span>
              </span>
              <span className="text-t12 text-[#6b5a4b] font-mono">{character.quirk}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {rows.map((row) => (
                <span key={row.label} className="text-t11 flex items-baseline gap-1.5">
                  <span className="font-bold text-[#6b5a4b] shrink-0">{row.label}</span>
                  <span style={{ color: row.tone }}>
                    {renderTextWithAffinities(row.values.join('、'))}
                  </span>
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 6. Sub-Tabs: 武器與戰鬥 | 咒語與儀式 | 職業技能 | 情感羈絆 | 個人命刻 | 行囊日誌
          ─────────────────────────────────────────────────────────────────────────
          P12（2026-11-02）：分頁列**釘住**（使用者裁定的第 1 題）。
          量到的問題：桌面 1414×1100 時分頁列在 1064px——第一屏看得到標籤，
          看不到標籤底下的內容；手機要滾 2.6 屏才碰到「武器與戰鬥」。
          而跑團時每 30 秒就要按一次攻擊，那顆按鈕永遠在最下面。
          ─────────────────────────────────────────────────────────────────────────
          兩個實作細節，少一個就沒效：
          1. 外層**不能是 `overflow-hidden`**——那會讓 sticky 變成「在一個不會滾動的
             容器裡黏住」，等於完全沒作用。改用 `overflow-clip`：一樣裁切圓角，
             但不建立滾動容器（`overflow-clip` 不影響 sticky 的參照）。
             上面 `jrpg-character-hub` 的 `overflow-hidden` 同理，一起改掉了。
          2. `top` 要避開章節標頭（`ChapterHeader` 是 `sticky top-0 z-40`）。
             寫死 52 會差 3px——標頭是 `min-h-[52px]`，52 是**下限**，實測 55px，
             於是分頁列的上緣被標頭蓋掉，看起來像「邊框不見了」。
             所以讀 `--chapter-header-h`（`ChapterHeader` 用 ResizeObserver 寫上去，
             fallback 52）。`top-0` 更糟：整條被標頭蓋住＝按不到。 */}

      {/* 2026-11-03：購買彈窗退場——「支出」現在可以順便記下拿到的東西（見 MODAL 0-b），
          兩顆按鈕講同一件事只會讓人猜哪一顆才對。`PurchaseModal` 檔案留著，
          它匯出的 `buildPurchaseCatalog` 仍是裝備表的唯一來源。 */}

      {/* MODAL 0-b: 收支（P9-b）——住宿、餐費、報酬……原因必填。
          P10：方向由外面決定（錢包上「收入」／「支出」各一顆），彈窗不再問一次。 */}
      <MoneyFlowModal
        isOpen={isMoneyFlowOpen}
        onClose={() => setIsMoneyFlowOpen(false)}
        theme={theme}
        character={character}
        wallet={character.zenit}
        initialDirection={moneyFlowDirection}
        onConfirm={handleMoneyFlow}
      />

      {/* MODAL 0-b-2: 金錢明細（P10）——不是另一份帳，是把成長履歷裡
          所有動到 `zenit` 的事件倒著列出來（`buildMoneyLedger`）。
          所以這裡**沒有任何寫入**：能看不能改，帳才不會有第二個版本。 */}
      <MoneyLedgerModal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        theme={theme}
        character={character}
      />

      {/* MODAL 0-b-3: 物語點收支（P12）——原因必填，與錢包同一個形狀。
          擲骰器的重擲／羈絆激勵**不開這個窗**：那兩件事的原因由擲骰器自己講
          （`onSpendFp('引用特質重擲檢定')`），再問一次只是多一次點擊。 */}
      <FabulaPointsModal
        isOpen={isFpFlowOpen}
        onClose={() => setIsFpFlowOpen(false)}
        theme={theme}
        current={resolveFabulaPoints(character)}
        initialDirection={fpFlowDirection}
        onConfirm={(input) => {
          const result = applyFpFlow(input);
          if (result.ok) {
            showToast(describeFabulaPointsToast(result), 'success');
            setIsFpFlowOpen(false);
          }
        }}
      />

      {/* MODAL 0-b-4: 物語點明細（P12）——同樣是履歷的另一個看法，只讀不寫。 */}
      <FabulaPointLedgerModal
        isOpen={isFpLedgerOpen}
        onClose={() => setIsFpLedgerOpen(false)}
        theme={theme}
        character={character}
      />

      {/* MODAL 0-c: 單槽換裝（P9-b）——行囊分頁的四個槽共用這一個彈窗 */}
      <EquipmentSlotModal
        isOpen={slotPicker !== null}
        onClose={() => setSlotPicker(null)}
        theme={theme}
        character={character}
        slot={slotPicker}
        wallet={character.zenit}
        onConfirm={handleEquipFromPack}
      />

      {/* MODAL 0-d: 行囊物品新增（2026-11-03） */}
      <BackpackItemModal
        isOpen={isBackpackAddOpen}
        onClose={() => setIsBackpackAddOpen(false)}
        onSubmit={handleAddInventoryItem}
      />

      {/* MODAL 1: Spell Picker / Learner Modal
          2026-11-02：標題與清單都收斂到「這個角色真的有額度的學派」。
          原本清單是整個規則庫 38 條，任何角色都能一條一條點「習得」——
          那等於把咒語當成自由選購的商品，而官方不是這樣設計的。 */}
      <JRPGModal
        isOpen={isSpellModalOpen}
        onClose={() => setIsSpellModalOpen(false)}
        title="從職業咒語清單習得"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3.5 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 text-t11">
            <span className="text-[#6b5a4b] leading-relaxed">
              {spellGrants.summary ? `額度來源：${spellGrants.summary}。` : ''}
              每次習得扣除對應的 MP 上限，選定後不易更改。
            </span>
            <span
              data-testid="spell-modal-quota"
              className={`px-2 py-0.5 rounded border font-bold shrink-0 ${
                spellGrants.canLearn
                  ? 'bg-[#f4ebd9] text-[#6b5a4b] border-[#d6c7ab]'
                  : 'bg-[#f4ebd9]/60 text-[#8c3235] border-[#d6c7ab]'
              }`}
            >
              剩餘 {spellGrants.remaining} / {spellGrants.capacity}
            </span>
          </div>

          {/* Search & School filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7c6a58]" />
              <input
                type="text"
                value={spellSearchQuery}
                onChange={e => setSpellSearchQuery(e.target.value)}
                placeholder="搜尋法術名稱、效果描述..."
                className="w-full pl-9 pr-3 py-1.5 rounded border border-[#e8dcc4] bg-[#fbf7ee] text-xs focus:outline-none focus:ring-2 focus:ring-[#3c2415]"
              />
            </div>
            <select
              value={selectedSpellSchool}
              onChange={e => setSelectedSpellSchool(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-[#e8dcc4] bg-[#fbf7ee] text-xs text-[#3c2415] focus:outline-none"
            >
              <option value="all">全部學派</option>
              {/* 只列這個角色有額度的學派。沒有的學派連選項都不該出現——
                  出現一個「選了會查無」的選項，比沒有選項更難懂。 */}
              {spellGrants.allowedSchools.map(sch => (
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
                  className="p-3 rounded border bg-white flex items-start justify-between gap-3 hover:border-[#3c2415] transition-colors"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FUIcon name={isOffensive ? 'offensive' : 'spell'} className="text-sm" />
                      <span className="font-bold text-sm text-[#3c2415] flex items-center gap-1.5">
                        {isOffensive && <span className="fu-icon text-[#8c3235] font-bold" title="攻擊性咒語">o</span>}
                        <span>{sp.name}</span>
                      </span>
                      <span className="text-t12 px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab] font-bold">
                        {sp.school}
                      </span>
                      <span className="font-mono text-t12 text-[#6b5a4b] font-bold">
                        {sp.mp} MP
                      </span>
                      <span className="text-t12 text-[#7c6a58]">
                        {sp.target} · {sp.duration}
                      </span>
                    </div>
                    <p className="text-t12 text-[#6b5a4b] leading-relaxed whitespace-pre-wrap">
                      {renderTextWithAffinities(sp.effect)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLearnSpell(sp)}
                    disabled={isLearned || !spellGrants.canLearn}
                    className="px-3 py-1.5 rounded text-white font-bold text-xs shrink-0 disabled:opacity-40 disabled:bg-[#e8dcc4]"
                    style={{ backgroundColor: isLearned ? '#6b5a4b' : theme.accent }}
                  >
                    {isLearned ? '已習得' : (spellGrants.canLearn ? '習得' : '額度已滿')}
                  </button>
                </div>
              );
            })}
            {/* 空清單的兩種原因寫清楚：一種是沒額度（非施法者開不到這裡，但防禦性保留），
                一種是搜尋沒中。原本這裡什麼都沒有，一片空白看起來像載入失敗。 */}
            {availableRulesSpells.length === 0 && (
              <p className="p-6 text-center text-t12 text-[#6b5a4b] leading-relaxed">
                {spellGrants.allowedSchools.length === 0
                  ? '這個角色沒有可用的咒語清單——咒語只能經由職業技能取得（核心手冊 188~210 頁）。'
                  : '這個學派底下沒有符合的咒語。換個關鍵字，或把學派篩選改回「全部學派」。'}
              </p>
            )}
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
          <p className="text-[#6b5a4b] leading-relaxed">
            自由選擇兩項屬性骰與修正值，即可一鍵呼叫骰盅擲骰：
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#3c2415] block mb-1">第一屬性:</label>
              <select
                value={freeRollAttr1}
                onChange={e => setFreeRollAttr1(e.target.value)}
                className="w-full p-2 rounded border border-[#e8dcc4] bg-white font-mono font-bold"
              >
                <option value="dex">DEX ({ATTRIBUTE_NAMES.dex} d{stats.currentDex})</option>
                <option value="ins">INS (洞察 d{stats.currentIns})</option>
                <option value="mig">MIG ({ATTRIBUTE_NAMES.mig} d{stats.currentMig})</option>
                <option value="wlp">WLP (意志 d{stats.currentWlp})</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-[#3c2415] block mb-1">第二屬性:</label>
              <select
                value={freeRollAttr2}
                onChange={e => setFreeRollAttr2(e.target.value)}
                className="w-full p-2 rounded border border-[#e8dcc4] bg-white font-mono font-bold"
              >
                <option value="dex">DEX ({ATTRIBUTE_NAMES.dex} d{stats.currentDex})</option>
                <option value="ins">INS (洞察 d{stats.currentIns})</option>
                <option value="mig">MIG ({ATTRIBUTE_NAMES.mig} d{stats.currentMig})</option>
                <option value="wlp">WLP (意志 d{stats.currentWlp})</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-[#3c2415] block mb-1">檢定固定修正:</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFreeRollModifier(prev => prev - 1)}
                className="px-3 py-1 rounded bg-[#f4ebd9] border text-sm font-bold"
              >
                -1
              </button>
              <span className="font-mono font-bold text-base w-12 text-center text-[#3c2415]">
                {freeRollModifier >= 0 ? `+${freeRollModifier}` : freeRollModifier}
              </span>
              <button
                type="button"
                onClick={() => setFreeRollModifier(prev => prev + 1)}
                className="px-3 py-1 rounded bg-[#f4ebd9] border text-sm font-bold"
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
            className="w-full py-2.5 rounded text-white font-bold text-xs flex items-center justify-center gap-1.5 mt-2"
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
              disabled={!selectedSkillForLevelUp || (!levelUpIsMnemosphere && !levelUpSelectedClassName)}
            >
              確認升級 (-10 EXP)
            </JRPGButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[#6b5a4b] leading-relaxed -mt-1">
            升級將消耗 <strong>10 點 EXP</strong>，角色等級提升 1 級，最大 HP +1、最大 MP +1，並可選擇分配 1 點技能等級！
          </p>

          <div className="space-y-3 pt-1">
            {/* 升級的那一點有兩個出口（p.134：invest 1 level into an Innate Class
                **or** into a mnemosphere）。只有開了魔晶石制才畫這一塊——
                標準規則下「投魔石」這條路根本不存在，畫出來只會多一個永遠點不動的按鈕。 */}
            {levelUpTechOn && (
              <div>
                <label className="text-xs font-bold text-[#3c2415] block mb-1">
                  這一點要投在哪裡？
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLevelUpTarget('class');
                      setSelectedSkillForLevelUp('');
                    }}
                    className="text-left rounded border p-2 transition-all cursor-pointer hover:border-[#3c2415]"
                    style={{
                      backgroundColor: levelUpTarget === 'class' ? '#f4ebd9' : '#fffdf9',
                      borderColor: levelUpTarget === 'class' ? '#3c2415' : '#d6c7ab'
                    }}
                  >
                    <span className="block text-xs font-bold text-[#3c2415]">固有職業</span>
                    <span className="block text-t12 text-[#7c6a58] leading-snug mt-0.5">
                      讓既有職業的技能升級
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={levelUpMnemospheres.length === 0}
                    onClick={() => {
                      setLevelUpTarget('mnemosphere');
                      setSelectedSkillForLevelUp('');
                    }}
                    className={`text-left rounded border p-2 transition-all ${
                      levelUpMnemospheres.length === 0
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:border-[#3c2415]'
                    }`}
                    style={{
                      backgroundColor: levelUpTarget === 'mnemosphere' ? '#f4ebd9' : '#fffdf9',
                      borderColor: levelUpTarget === 'mnemosphere' ? '#3c2415' : '#d6c7ab'
                    }}
                  >
                    <span className="block text-xs font-bold text-[#3c2415]">職業魔石</span>
                    <span className="block text-t12 text-[#7c6a58] leading-snug mt-0.5">
                      {levelUpMnemospheres.length === 0
                        ? '沒有可成長的魔石（5 級為止）'
                        : `${levelUpMnemospheres.length} 顆可成長（上限 5 級）`}
                    </span>
                  </button>
                </div>

                {levelUpTarget === 'mnemosphere' && levelUpMnemospheres.length > 0 && (
                  <select
                    value={selectedMnemosphereForLevelUp}
                    onChange={e => {
                      setSelectedMnemosphereForLevelUp(e.target.value);
                      setSelectedSkillForLevelUp('');
                    }}
                    className="w-full mt-2 bg-[#fffdf9] border border-[#d6c7ab] rounded px-3 py-2 text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
                  >
                    <option value="" disabled>-- 選擇魔石 --</option>
                    {levelUpMnemospheres.map(m => (
                      <option key={m.id} value={m.id}>
                        {withEn(m.className)}　Lv {m.level} / {MNEMOSPHERE_MAX_LEVEL}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {levelUpTarget !== 'mnemosphere' && (
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
                  className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded px-3 py-2 text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
                >
                  <option value="" disabled>-- 選擇職業 --</option>
                  <optgroup label="既有職業">
                    {(character.classes || []).map(cl => (
                      <option key={cl.className} value={cl.className}>
                        {withEn(cl.className)} (目前 Lv {cl.level})
                      </option>
                    ))}
                  </optgroup>
                  {/* Core p.228：「you gain your first level in a Class you didn't already have」。
                      只在「未精通的職業不到三個」且「不是魔晶石制」時才列——那兩條限制
                      寫在資料層（`levelUpCanAddClass`），不是靠這裡少畫幾行。 */}
                  {levelUpNewClassOptions.length > 0 && (
                    <optgroup label={`新職業（未精通 ${levelUpNonMasteredCount} / ${MAX_NON_MASTERED_CLASSES}）`}>
                      {levelUpNewClassOptions.map(name => (
                        <option key={name} value={`${LEVEL_UP_NEW_CLASS_PREFIX}${name}`}>
                          ＋ {withEn(name)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {(levelUpIsMnemosphere || levelUpSelectedClassName) && (
              <div>
                <label className="text-xs font-bold text-[#3c2415] block mb-1">
                  {levelUpIsMnemosphere
                    ? `選擇要成長的技能（${withEn(levelUpMnemosphere.className)}魔石）:`
                    : '選擇欲升級或習得的技能:'}
                </label>
                {/* 舊版是一個下拉選單，一行「技能名 (SL 0/5)」根本看不出這技能在做什麼。
                    這裡改成直接列出效果全文，並把選取中的那一項以**升級後**的 SL 顯示——
                    讓你看到的是「買到之後數字長什麼樣」，而不是現在的數字。
                    魔石那條走同一份渲染，差別只在資料源（它自己那個職業的技能表）。 */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {levelUpSkills.map(sk => {
                    const curSL = levelUpCurrentSL(sk.name);
                    const maxed = curSL >= sk.maxSL;
                    const isSel = selectedSkillForLevelUp === sk.name;
                    return (
                      <button
                        key={sk.name}
                        type="button"
                        disabled={maxed}
                        onClick={() => setSelectedSkillForLevelUp(sk.name)}
                        className={`w-full text-left rounded border p-2.5 transition-all ${
                          maxed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#3c2415]'
                        } ${isSel ? 'ring-2 ring-[#a63d40]' : ''}`}
                        style={{
                          backgroundColor: isSel ? '#f4ebd9' : '#fffdf9',
                          borderColor: isSel ? '#3c2415' : '#d6c7ab'
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-t14 font-bold text-[#3c2415]">{sk.name}</span>
                          <span className="text-t12 font-mono text-[#7c6a58] shrink-0">
                            SL {curSL} / {sk.maxSL}{maxed ? '　已升滿' : ''}
                          </span>
                        </div>
                        <p className="text-t14 text-[#6b5a4b] leading-relaxed mt-1">
                          <SkillDescription
                            desc={sk.desc || '（無效果描述）'}
                            sl={isSel && !maxed ? curSL + 1 : curSL}
                            characterLevel={isSel && !maxed ? characterLevel + 1 : characterLevel}
                            character={character}
                            refSource={sk.name}
                          />
                        </p>
                        {isSel && !maxed && (
                          <span className="text-t12 text-[#3c2415] font-bold mt-1 inline-block">
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
                    className="mt-2 text-t12 text-[#3c2415] font-bold hover:underline flex items-center gap-1 cursor-pointer"
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
            <label className="font-bold text-[#3c2415] block mb-1">羈絆對象名稱:</label>
            <input
              type="text"
              data-testid="bond-new-target"
              value={newBondTarget}
              onChange={e => setNewBondTarget(e.target.value)}
              placeholder="例如：王國騎士長、幼時好友、仇敵宿敵..."
              className="w-full p-2 rounded border border-[#e8dcc4] bg-white"
            />
          </div>

          <div>
            <label className="font-bold text-[#3c2415] block mb-1">對應 NPC 檔案庫（選填）:</label>
            <BondNpcSelect
              testId="bond-new-npc"
              value={newBondNpcId}
              pool={npcPool}
              onChange={setNewBondNpcId}
              onPick={(npc) => setNewBondTarget(npc.name || '')}
            />
          </div>

          <div>
            <label className="font-bold text-[#3c2415] block mb-1.5">選擇初生情感 (可選 1~3 項):</label>
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
                    className={`p-2 rounded border text-xs font-bold transition-all text-left ${
                      isSelected ? 'bg-[#f4ebd9] border-[#a63d40] text-[#8c3235]' : 'bg-[#fbf7ee] border-[#e8dcc4] text-[#6b5a4b]'
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
            className="w-full py-2.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs mt-2"
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
            <label className="font-bold text-[#3c2415] block mb-1">命刻標題:</label>
            <input
              type="text"
              value={newClockTitle}
              onChange={e => setNewClockTitle(e.target.value)}
              placeholder="例如：復仇的倒計時、解開封印進度..."
              className="w-full p-2 rounded border border-[#e8dcc4] bg-white"
            />
          </div>

          <div>
            <label className="font-bold text-[#3c2415] block mb-1">命刻總格數:</label>
            <div className="flex gap-2">
              {[4, 6, 8, 10, 12].map(seg => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setNewClockSegments(seg)}
                  className={`flex-1 py-1.5 rounded border font-mono font-bold ${
                    newClockSegments === seg ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]' : 'bg-[#fbf7ee] border-[#e8dcc4] text-[#3c2415]'
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
            className="w-full py-2.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs mt-2"
          >
            確認建立命刻
          </button>
        </div>
      </JRPGModal>

      {/* 章節結束結算彈窗 —— W0-5 先行件 */}
      <ChapterSettlementModal
        isOpen={isChapterSettlementOpen}
        onClose={() => setIsChapterSettlementOpen(false)}
        character={character}
        onApply={(plan) => {
          if (!plan?.ok) return;
          const { classResources: patchResources, ...patchRest } = plan.patch || {};
          const nextChar = {
            ...character,
            ...patchRest,
            ...(patchResources ? {
              classResources: {
                ...(character.classResources || {}),
                ...patchResources
              }
            } : {}),
            updatedAt: new Date().toISOString()
          };
          if (plan.log) {
            onChange(loggableChange(character, nextChar, plan.log));
          } else {
            onChange(nextChar);
          }
        }}
        showToast={showToast}
        theme={theme}
      />

      {/* MODAL 6: 收場（場次小結）——2026-10-30 */}
      <JRPGModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        title={activeSessionNumber === null ? '收場' : `收場 · 第 ${activeSessionNumber} 場`}
        maxWidth="max-w-md"
        theme={theme}
      >
        <div className="space-y-3.5 text-xs">
          <p className="leading-relaxed" style={{ color: theme.textMuted }}>
            收場只做一件事：把這一場的記錄收成一段，寫進成長履歷。EXP 入帳仍然走「聚會結算」。
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              ['本場記錄', `${sessionSummary.count} 筆`],
              ['EXP 入帳', `${sessionSummary.expGained >= 0 ? '+' : ''}${sessionSummary.expGained}`],
              ['物語點', `${sessionSummary.fpDelta >= 0 ? '+' : ''}${sessionSummary.fpDelta}`],
              ['受傷', `${sessionSummary.hpLost}`],
              ['推進命刻', `${sessionSummary.clockSteps} 格`],
              ['羈絆變動', `${sessionSummary.bondChanges} 次`]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded border px-2 py-1.5 flex flex-col items-center justify-center"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
              >
                <span className="text-t10" style={{ color: theme.textMuted }}>{label}</span>
                <span className="text-xs font-bold mt-0.5" style={{ color: theme.textDark }}>{value}</span>
              </div>
            ))}
          </div>

          {sessionSummary.expGained === 0 && (
            <button
              type="button"
              onClick={() => { setIsSessionModalOpen(false); setIsExpSettlementOpen(true); }}
              className="w-full text-left px-2.5 py-2 rounded border font-bold text-t11"
              style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
            >
              這一場還沒入帳 EXP？先做聚會結算（右側「聚會結算」）
            </button>
          )}

          <div>
            <label className="font-bold block mb-1" style={{ color: theme.textDark }}>
              這一場的一句話（可留白）
            </label>
            <input
              type="text"
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="例如：在鐘塔上攔下信使，代價是導師的信任"
              className="w-full px-2.5 py-2 rounded border outline-none text-xs"
              style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
            />
          </div>

          <button
            type="button"
            onClick={handleEndSession}
            className="w-full py-2.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs"
          >
            確認收場並寫入履歷
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
