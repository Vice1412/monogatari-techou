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
  GiCycle,
  GiLaurelCrown,
  GiCampfire
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
// F-020（2026-10-27）：職業面板「住哪個分頁」與指路句的唯一來源。
import { classPanelHint, isClassPanelActive } from '../data/classPanels';
import CampActivitiesBlock from './CampActivitiesBlock';
import { resolveCreationRules } from '../data/creationRules';
import { modeRestrictsEquipment, isTechnosphereEnabled, isSkillSuppressedByTechnospheres, getLevelUpMnemosphereCandidates, MNEMOSPHERE_MAX_LEVEL } from '../data/technospheres';
import ZeroPowerBlock from './ZeroPowerBlock';
import { getCharacterTheme } from '../utils/characterThemes';
import { getDualShieldState, withHrBonus } from '../utils/equipmentRules';
import {
  buildCustomWeaponEntries,
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
// 羈絆 ⇄ NPC 檔案庫的連結（2026-10-30，P3）。
// 判定（含「名冊已無此人」）只寫在 bondLink.js，這裡只負責畫。
import {
  BOND_WHY_MAX,
  normalizeBondWhy,
  resolveBondNpc,
  bondNpcSubtitle,
  buildBondLinkFields,
  applyBondLinkFields,
  describeBondEdit
} from '../utils/bondLink';
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
import { shouldRenderArcanistPanel } from '../utils/arcanist';
import { withEn } from '../../../utils/properNouns';
import { STORAGE_KEYS } from '../../../data/keys';
import { readJSON, writeJSON } from '../../../data/store';

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
  // 初始分頁：跑團面板的六個分頁各自有一段「空清單」畫面，而 SSR 不執行點擊，
  // 沒有這個入口就永遠測不到。不傳時就是原本的 `'attacks'`。
  initialTab = 'attacks',
  // 羈絆的兩個彈窗／面板（P3）。同樣是 SSR 測不到的區塊：建立彈窗與就地編輯面板
  // 都只能靠點擊打開，而裡面正是「名冊斷鏈」與「為什麼」唯一會出現的地方。
  // 生產端永不傳入，不傳時就是原本的 `false`／`null`。
  initialBondModalOpen = false,
  initialEditingBondId = null
}) {
  // Tabs: attacks (武器與防衛) | spells (咒語與魔法) | skills (職業特技) | bonds (情感羈絆) | clocks (命刻) | notes (行囊日誌)
  const [activeTab, setActiveTab] = useState(initialTab);

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
  const [newBondWhy, setNewBondWhy] = useState('');
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
  const [editBondWhy, setEditBondWhy] = useState(
    typeof seededEditingBond?.why === 'string' ? seededEditingBond.why : ''
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

  // 升級後若解鎖職業精通（Lv 10）或帶子項目的特技，給出跳轉編輯器提示橫幅
  const [postLevelUpHint, setPostLevelUpHint] = useState(null);

  // Clock creator modal
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [newClockTitle, setNewClockTitle] = useState('');
  const [newClockSegments, setNewClockSegments] = useState(6);

  // 場次收場彈窗（2026-10-30）：本場小結 ＋ 一句自由註記
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
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
  const curHp = character.currentHp !== null && character.currentHp !== undefined ? character.currentHp : stats.maxHp;
  const curMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : stats.maxMp;
  const curIp = character.currentIp !== null && character.currentIp !== undefined ? character.currentIp : stats.maxIp;
  const isCrisis = curHp <= stats.crisisThreshold;
  // 四維還沒指派完 → 六項數值不成立（見 `calculateCharacterStats` 的 `attributesUnset`）
  const statsUnset = Boolean(stats.attributesUnset);
  const isReadyToLevelUp = canLevelUp(character);

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

  // 呼叫全域擲骰器時自動附帶角色特質、羈絆與物語點回呼（支援重擲、羈絆激勵與大失敗領取 FP）
  const openCharacterDice = (config) => {
    if (!onOpenDice) return;
    onOpenDice({
      ...config,
      character,
      onSpendFp: (reason) => {
        adjustFp(-1);
        showToast(`${reason}（消耗 1 點物語點）`);
      },
      onGainFp: (reason) => {
        adjustFp(1);
        showToast(`${reason}（獲得 1 點物語點）`);
      }
    });
  };

  // 營地／旅店一鍵休整（Core p.91：回滿 HP 與 MP，並解除所有異常狀態）
  const handleCampRest = () => {
    const clearedAff = {};
    Object.keys(STATUS_AFFLICTIONS).forEach(k => { clearedAff[k] = false; });
    const nextChar = {
      ...character,
      currentHp: stats.maxHp,
      currentMp: stats.maxMp,
      statusAfflictions: clearedAff,
      updatedAt: new Date().toISOString()
    };
    const changes = [];
    if (curHp !== stats.maxHp) changes.push({ field: 'currentHp', from: curHp, to: stats.maxHp });
    if (curMp !== stats.maxMp) changes.push({ field: 'currentMp', from: curMp, to: stats.maxMp });
    onChange(loggableChange(character, nextChar, {
      kind: 'hp',
      title: '營地休整：回滿 HP／MP 並解除全部異常狀態',
      changes
    }));
    showToast('已完成營地休整！HP 與 MP 全滿，所有異常狀態已解除。');
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
    if (type === 'remedy' || type === 'potion') {
      if (curIp < 3) { showToast('道具點不足 3 點（大補藥需 3 IP）', 'warning'); return; }
      const heal = 50 + remedyBonus;
      const nextIp = Math.max(0, curIp - 3);
      const nextHp = Math.max(0, Math.min(stats.maxHp, curHp + heal));
      const base = {
        ...character,
        currentIp: nextIp,
        currentHp: nextHp,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用大補藥（-3 IP，回復 ${heal} HP）`,
        changes: [
          { field: 'currentIp', from: curIp, to: nextIp },
          { field: 'currentHp', from: curHp, to: nextHp }
        ]
      }));
      showToast(`使用【大補藥】！回復 ${heal} 點 HP（消耗 3 IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'elixir') {
      if (curIp < 3) { showToast('道具點不足 3 點（萬靈藥需 3 IP）', 'warning'); return; }
      const heal = 50 + remedyBonus;
      const nextIp = Math.max(0, curIp - 3);
      const nextMp = Math.max(0, Math.min(stats.maxMp, curMp + heal));
      const base = {
        ...character,
        currentIp: nextIp,
        currentMp: nextMp,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用萬靈藥（-3 IP，回復 ${heal} MP）`,
        changes: [
          { field: 'currentIp', from: curIp, to: nextIp },
          { field: 'currentMp', from: curMp, to: nextMp }
        ]
      }));
      showToast(`使用【萬靈藥】！回復 ${heal} 點 MP（消耗 3 IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'tonic' || type === 'antidote') {
      if (curIp < 2) { showToast('道具點不足 2 點（滋補藥需 2 IP）', 'warning'); return; }
      const nextIp = Math.max(0, curIp - 2);
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
        title: '使用滋補藥（-2 IP，解除全部異常狀態）',
        changes: [{ field: 'currentIp', from: curIp, to: nextIp }]
      }));
      showToast(`使用【滋補藥】！已解除所有異常狀態（消耗 2 IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'elementalShard') {
      if (curIp < 2) { showToast('道具點不足 2 點（元素碎片需 2 IP）', 'warning'); return; }
      const dmg = 10 + shardBonus;
      const nextIp = Math.max(0, curIp - 2);
      const base = {
        ...character,
        currentIp: nextIp,
        updatedAt: new Date().toISOString()
      };
      onChange(loggableChange(character, base, {
        kind: 'ip',
        title: `使用元素碎片（-2 IP，造成 ${dmg} 點${shardElement}屬性傷害）`,
        changes: [{ field: 'currentIp', from: curIp, to: nextIp }]
      }));
      showToast(`投擲【元素碎片】！對單一目標造成 ${dmg} 點【${shardElement}】傷害（消耗 2 IP，剩餘 ${nextIp} IP）`, 'success');
    } else if (type === 'magicTent') {
      if (curIp < 4) { showToast('道具點不足 4 點（魔法帳篷需 4 IP）', 'warning'); return; }
      const nextIp = Math.max(0, curIp - 4);
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
        title: '使用魔法帳篷（-4 IP，野外休息回滿 HP／MP 並清狀態）',
        changes: [
          { field: 'currentIp', from: curIp, to: nextIp },
          ...(curHp !== stats.maxHp ? [{ field: 'currentHp', from: curHp, to: stats.maxHp }] : []),
          ...(curMp !== stats.maxMp ? [{ field: 'currentMp', from: curMp, to: stats.maxMp }] : [])
        ]
      }));
      showToast(`搭設【魔法帳篷】完成野外休息！HP／MP 全滿且異常狀態全解（消耗 4 IP，剩餘 ${nextIp} IP）`, 'success');
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
    if (!selectedSkillForLevelUp) {
      showToast('請選擇要升級的職業與特技');
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
      showToast('請選擇要升級的職業與特技');
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
    setEditBondWhy(typeof bond.why === 'string' ? bond.why : '');
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
    const linkFields = buildBondLinkFields({ npcId: editBondNpcId, why: editBondWhy });
    const target = editBondTarget.trim();
    const updatedBonds = (character.bonds || []).map(b =>
      b.id === editingBondId
        // 「表單是完整的事實」：清掉連結就真的不再連，清掉理由就真的沒有理由。
        // 刪鍵與否的判斷在 `applyBondLinkFields`（那裡才測得到）。
        ? applyBondLinkFields({ ...b, target, feelings: editBondFeelings }, { npcId: editBondNpcId, why: editBondWhy })
        : b
    );
    // 2026-10-30：這裡原本傳 `kind: 'bond'`，但 `LOG_KINDS` 沒有這個詞彙
    // → `createLogEntry` 靜默拒收 → **羈絆調整從來沒有進過履歷**。
    // 現在詞彙補上了，而且標題寫出情感的前後變化（只寫「調整羈絆」看不出改了什麼）。
    const feelingText = (list) => (list || []).map(f => FEELING_LABELS[f] || f).join('、');
    updateField('bonds', updatedBonds, {
      kind: 'bond',
      // 情感的變化與理由的變化分開寫：情感是規則層（激勵加值＝情感數），
      // 理由是敘事層。只寫「調整羈絆」的話，兩者都看不出來。
      title: describeBondEdit({
        target,
        feelingsFrom: feelingText(before?.feelings),
        feelingsTo: feelingText(editBondFeelings),
        whyFrom: before?.why || '',
        whyTo: editBondWhy
      }),
      fields: [],
      // 把「為什麼」帶進履歷：三個月後回頭看，這一行比情感標籤有用得多。
      note: linkFields.why || ''
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
  const handleLearnSpell = (spell) => {
    const currentSpells = resolveCharacterSpells(character);
    const resolved = resolveSpellEntry(spell);
    if (currentSpells.some(s => s.name === resolved.name)) {
      showToast('已掌握此咒語');
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
    setNewBondWhy('');
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
      // 空的連結與空的理由**不寫鍵**，與舊存檔的形狀保持一致。
      ...buildBondLinkFields({ npcId: newBondNpcId, why: newBondWhy })
    };
    updateField('bonds', [...currentBonds, newBond], {
      kind: 'bond',
      title: `締結羈絆【${newBond.target}】（${newBondFeelings.map(f => FEELING_LABELS[f] || f).join('、')}）`,
      fields: [],
      note: newBond.why || ''
    });
    setNewBondTarget('');
    setNewBondFeelings(['admiration']);
    setNewBondNpcId('');
    setNewBondWhy('');
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

  const isInActiveCombat = useMemo(() => {
    const activeCombat = readJSON(STORAGE_KEYS.activeCombat, null);
    return Array.isArray(activeCombat?.combatants) && activeCombat.combatants.some(c => c && c.sourceId === character.id);
  }, [character.id, character.updatedAt]);

  return (
    <div className="space-y-4 text-[#3c2415] animate-fade-in">
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
                  : '請前往「構築與成長」第 2 步挑選此特技的子項目（如咒語、舞步、曲風、符號等）。'}
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
        data-testid="jrpg-character-hub"
        className="rounded p-4 sm:p-5 space-y-4 border-2 transition-colors duration-200"
        style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
      >
        {/* Top Utility & Sync Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b pb-3" style={{ borderColor: theme.border }}>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* LEFT WING (col-span-4): Vital Resource Gauges (HP / MP / IP) & Official 5 Consumables */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            {/* HP Gauge */}
            <div className={`rounded p-3.5 border-2 transition-all ${
              isCrisis
                ? 'bg-[#f4ebd9] border-[#a63d40] ring-2 ring-[#a63d40]/60'
                : 'bg-[#fffdf9] border-[#d6c7ab]'
            }`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5 font-bold text-[#8c3235]">
                  <GiHealthNormal className="w-4 h-4 text-[#8c3235]" />
                  <span>生命值</span>
                  {isCrisis && (
                    <span className="text-t12 text-[#8c3235] font-mono font-black flex items-center gap-0.5">
                      <FUIcon name="crisis" className="text-xs" />
                      <span>CRISIS 危機</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleFormula('hp')}
                  title="點擊查看公式"
                  className="font-mono font-black text-base text-[#8c3235] hover:underline decoration-dotted underline-offset-2 cursor-pointer"
                >
                  {statsUnset ? '—' : <>{curHp} <span className="text-xs text-[#7c6a58] font-normal">/ {stats.maxHp}</span></>}
                </button>
              </div>

              <div className="w-full bg-[#f4ebd9] h-2.5 rounded-full overflow-hidden mb-2.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isCrisis ? 'bg-[#a63d40]' : 'bg-gauge-hp'}`}
                  style={{ width: `${Math.min(100, (curHp / stats.maxHp) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-1">
                <NumberStepper
                  value={curHp}
                  onDelta={adjustHp}
                  ariaLabel="生命值"
                  width="w-14"
                  inputClassName="text-[#8c3235]"
                />
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
                  className="px-2 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#8c3235] font-bold text-xs"
                >
                  全滿
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
            <div className="rounded p-3.5 border border-[#d6c7ab] bg-[#fffdf9]">
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5 font-bold text-[#6b5a4b]">
                  <GiLightningTear className="w-4 h-4 text-[#6b5a4b]" />
                  <span>魔力值</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFormula('mp')}
                  title="點擊查看公式"
                  className="font-mono font-black text-base text-[#3c2415] hover:underline decoration-dotted underline-offset-2 cursor-pointer"
                >
                  {statsUnset ? '—' : <>{curMp} <span className="text-xs text-[#7c6a58] font-normal">/ {stats.maxMp}</span></>}
                </button>
              </div>

              <div className="w-full bg-[#f4ebd9] h-2.5 rounded-full overflow-hidden mb-2.5">
                <div
                  className="bg-gauge-mp h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (curMp / stats.maxMp) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-1">
                <NumberStepper
                  value={curMp}
                  onDelta={adjustMp}
                  ariaLabel="魔力值"
                  width="w-14"
                  inputClassName="text-[#3c2415]"
                />
                <button
                  onClick={() => updateField('currentMp', stats.maxMp)}
                  className="px-2 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#3c2415] font-bold text-xs"
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

            {/* IP Gauge & Official 5 Consumables (Core p.104) */}
            <div className="rounded p-3.5 border border-[#d6c7ab] bg-[#fffdf9] space-y-2.5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#6b5a4b]">
                    <GiBackpack className="w-4 h-4 text-[#6b5a4b]" />
                    <span>道具點</span>
                    {secretFormulaSL > 0 && (
                      <span className="text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415]">
                        秘密配方 SL{secretFormulaSL}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFormula('ip')}
                    title="點擊查看公式"
                    className="font-mono font-black text-base text-[#3c2415] hover:underline decoration-dotted underline-offset-2 cursor-pointer"
                  >
                    {curIp} <span className="text-xs text-[#7c6a58] font-normal">/ {stats.maxIp}</span>
                  </button>
                </div>

                <div className="w-full bg-[#f4ebd9] h-2.5 rounded-full overflow-hidden mb-2.5">
                  <div
                    className="bg-gauge-ip h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (curIp / stats.maxIp) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-1">
                  <NumberStepper
                    value={curIp}
                    onDelta={adjustIp}
                    ariaLabel="物品點"
                    width="w-14"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('currentIp', stats.maxIp)}
                    className="px-2 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#3c2415] font-bold text-xs"
                  >
                    全滿
                  </button>
                </div>
              </div>

              {/* 官方五種基本 IP 消耗品（Core p.104） */}
              <div data-testid="hud-ip-consumables" className="pt-2 border-t border-[#e8dcc4] space-y-1.5">
                <div className="flex items-center justify-between text-t11 text-[#6b5a4b]">
                  <span className="font-bold">官方消耗品捷徑 (點擊扣 IP 結算)</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUseConsumable('remedy')}
                    className="px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#8c3235] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between"
                    title={`大補藥（消耗 3 IP）：恢復 ${50 + secretFormulaSL * 5} 點 HP`}
                  >
                    <span>大補藥 (+{50 + secretFormulaSL * 5}HP)</span>
                    <span className="text-t10">3IP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseConsumable('elixir')}
                    className="px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between"
                    title={`萬靈藥（消耗 3 IP）：恢復 ${50 + secretFormulaSL * 5} 點 MP`}
                  >
                    <span>萬靈藥 (+{50 + secretFormulaSL * 5}MP)</span>
                    <span className="text-t10">3IP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseConsumable('tonic')}
                    className="px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#6b5a4b] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between"
                    title="滋補藥（消耗 2 IP）：解除所有異常狀態"
                  >
                    <span>滋補藥 (解全狀態)</span>
                    <span className="text-t10">2IP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseConsumable('magicTent')}
                    className="px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] text-t11 font-bold text-left flex items-center justify-between"
                    title="魔法帳篷（消耗 4 IP）：野外休息回滿 HP／MP 並解除全部狀態"
                  >
                    <span>魔法帳篷 (全滿)</span>
                    <span className="text-t10">4IP</span>
                  </button>
                </div>

                {/* 元素碎片（2 IP，選風／電／土／火／冰，10+秘密配方SL 點傷害） */}
                <div className="flex items-center gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleUseConsumable('elementalShard')}
                    className="flex-1 px-2 py-1 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#8c3235] border border-[#d6c7ab] text-t11 font-bold flex items-center justify-between"
                    title={`元素碎片（消耗 2 IP）：對單一目標造成 ${10 + secretFormulaSL} 點【${shardElement}】傷害`}
                  >
                    <span>元素碎片 ({10 + secretFormulaSL}點{shardElement}傷)</span>
                    <span className="text-t10">2IP</span>
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

              <StatFormulaPanel
                isOpen={openFormula === 'ip'}
                title="最大道具點"
                breakdown={breakdown.ip}
                onClose={() => setOpenFormula(null)}
              />
            </div>
          </div>

          {/* CENTERPIECE (col-span-4): JRPG Character Portrait Standee & Surrounding Command Buttons */}
          <div
            className="lg:col-span-4 rounded p-4 border-2 bg-[#fffdf9] flex flex-col items-center justify-between text-center gap-3"
            style={{ borderColor: theme.border }}
          >
            {/* Portrait Frame & Identity */}
            <div className="flex flex-col items-center w-full space-y-2">
              <div className="relative">
                <div
                  onClick={() => onOpenEditor()}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded border-2 flex items-center justify-center font-serif text-2xl font-bold overflow-hidden shadow-inner bg-[#fbf7ee] cursor-pointer hover:ring-2 transition-all group relative"
                  style={{ borderColor: theme.accent, color: theme.accent }}
                  title="點擊前往「構築與成長」更換或調整角色立繪／頭像"
                >
                  {character.avatar ? (
                    character.avatar.startsWith('http') || character.avatar.startsWith('data:') ? (
                      <img src={character.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <GameIcon name={character.avatar} className="w-14 h-14" style={{ color: theme.accent }} />
                    )
                  ) : (
                    <GameIcon name={character.classes?.[0]?.className || 'GiSparkles'} className="w-14 h-14" style={{ color: theme.accent }} />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-t12 font-bold">
                    更換肖像
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <JRPGBadge variant={theme.badgeVariant} size="sm">
                    Lv {getCharacterLevel(character)}
                  </JRPGBadge>
                </div>
              </div>

              <div className="pt-1.5 space-y-1 w-full">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <h3 className="font-serif font-black text-xl tracking-wide" style={{ color: theme.textDark }}>
                    {character.name || '冒險者'}
                  </h3>
                  {isCrisis && (
                    <JRPGBadge variant="danger" size="xs" className="flex items-center gap-1">
                      <FUIcon name="crisis" className="text-xs leading-none" />
                      <span>CRISIS 危機</span>
                    </JRPGBadge>
                  )}
                </div>

                <p className="text-xs text-[#6b5a4b] leading-relaxed">
                  {character.identity || '未設定身份'} · <strong style={{ color: theme.accent }}>{character.theme || '未設定主題'}</strong>
                  {character.origin && ` · 來自 ${character.origin}`}
                </p>

                {/* Classes Pills */}
                {(character.classes || []).length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                    {(character.classes || []).map((cl, idx) => {
                      const cName = normalizeClassName(cl.className);
                      return (
                        <span
                          key={idx}
                          className="text-t11 px-2 py-0.5 rounded bg-[#fbf7ee] border border-[#d6c7ab] font-bold text-[#3c2415] flex items-center gap-1"
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

            {/* JRPG Command Ring: 6 Tactical Panel Buttons around the Character */}
            <div className="w-full pt-2 border-t border-[#e8dcc4] space-y-1.5">
              <span className="text-t11 font-bold text-[#7c6a58] block">
                ✦ 點擊指令切換下方戰術分頁 ✦
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'attacks', label: '武器與戰鬥', sub: '命中 · 防禦 · 變形', icon: GiCrossedSwords },
                  { id: 'spells', label: `咒語與魔法 (${resolveCharacterSpells(character).length})`, sub: '施法 · 儀式計算', icon: GiSpellBook },
                  { id: 'skills', label: '職業特技', sub: '特技 · 英雄 · 金手指', icon: GiBroadsword },
                  { id: 'bonds', label: `情感羈絆 (${(character.bonds || []).length})`, sub: '激勵 · 編輯 · 營地', icon: GiHeartShield },
                  { id: 'clocks', label: `個人命刻 (${(character.clocks || []).length})`, sub: '進度鐘 · 底力技', icon: GiPocketWatch },
                  { id: 'notes', label: '行囊日誌', sub: '裝備總覽 · 筆記', icon: GiBackpack }
                ].map(tab => {
                  const IconComp = tab.icon;
                  const isTabActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`p-2 rounded border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        isTabActive
                          ? 'text-white'
                          : 'bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]'
                      }`}
                      style={isTabActive ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#fffdf9' } : {}}
                    >
                      <IconComp className="w-4 h-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{tab.label}</div>
                        <div className={`text-t10 truncate ${isTabActive ? 'text-[#fffdf9]/90' : 'text-[#7c6a58]'}`}>
                          {tab.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT WING (col-span-4): Four Attributes + Quick Dual-Attribute Combo, Defenses, EXP / Zenit / FP */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-3">
            {/* Four Attributes & Dual-Attribute Quick Check */}
            <div className="rounded p-3.5 border border-[#d6c7ab] bg-[#fffdf9] space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#3c2415] flex items-center gap-1">
                  <GiRollingDices className="w-4 h-4 text-[#6b5a4b]" />
                  <span>四維屬性與雙屬性檢定</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFreeRollModalOpen(true)}
                  className="text-t11 font-bold text-[#6b5a4b] hover:text-[#2c221e] underline"
                >
                  進階修正檢定
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'dex', enName: 'DEX', zhName: ATTRIBUTE_NAMES.dex, cur: stats.currentDex, base: stats.baseDex },
                  { key: 'ins', enName: 'INS', zhName: ATTRIBUTE_NAMES.ins, cur: stats.currentIns, base: stats.baseIns },
                  { key: 'mig', enName: 'MIG', zhName: ATTRIBUTE_NAMES.mig, cur: stats.currentMig, base: stats.baseMig },
                  { key: 'wlp', enName: 'WLP', zhName: ATTRIBUTE_NAMES.wlp, cur: stats.currentWlp, base: stats.baseWlp }
                ].map(attr => {
                  const isFirstSelected = comboFirstAttr === attr.key;
                  return (
                    <div key={attr.key} className="space-y-1">
                      <div className="flex items-stretch gap-1">
                        <button
                          type="button"
                          onClick={() => openCharacterDice({
                            die1: attr.cur,
                            die2: attr.cur,
                            modifier: 0,
                            label: `${attr.enName} (${attr.zhName}) 單項檢定`
                          })}
                          className="flex-1 rounded p-2 border flex flex-col items-center justify-center transition-all text-center group bg-[#fbf7ee] hover:bg-[#f4ebd9]"
                          style={{ borderColor: theme.border }}
                          title={`點擊進行【${attr.enName} + ${attr.enName}】純屬性檢定`}
                        >
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-black tracking-wider text-[#2c221e] font-mono">
                              {attr.enName}
                            </span>
                            <span className="text-t11 text-[#7c6a58] font-sans">
                              {attr.zhName}
                            </span>
                          </div>
                          <div className="text-lg font-serif font-black flex items-baseline gap-1" style={{ color: theme.textDark }}>
                            <span>d{attr.cur}</span>
                            {attr.cur < attr.base && (
                              <span className="text-t11 text-[#8c3235] line-through font-mono">d{attr.base}</span>
                            )}
                          </div>
                        </button>

                        {/* 雙屬性配對鈕：點第 1 顆選首屬性，點第 2 顆直接組合擲骰 */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!comboFirstAttr) {
                              setComboFirstAttr(attr.key);
                            } else {
                              const getDie = (k) => {
                                if (k === 'dex') return stats.currentDex;
                                if (k === 'ins') return stats.currentIns;
                                if (k === 'mig') return stats.currentMig;
                                if (k === 'wlp') return stats.currentWlp;
                                return 8;
                              };
                              const firstKey = comboFirstAttr;
                              setComboFirstAttr(null);
                              openCharacterDice({
                                die1: getDie(firstKey),
                                die2: getDie(attr.key),
                                modifier: 0,
                                label: `組合檢定 [${firstKey.toUpperCase()} + ${attr.enName}]`
                              });
                            }
                          }}
                          className={`px-1.5 rounded border text-t10 font-bold transition-colors flex flex-col items-center justify-center ${
                            isFirstSelected
                              ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]'
                              : comboFirstAttr
                                ? 'bg-[#f4ebd9] border-[#a63d40] text-[#8c3235] hover:bg-[#e8dcc4]'
                                : 'bg-[#fffdf9] border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#f4ebd9]'
                          }`}
                          title={
                            isFirstSelected
                              ? `已選 ${attr.enName} 為第一屬性，再點一次即可擲雙 ${attr.enName}`
                              : comboFirstAttr
                                ? `點擊立即擲骰 [${comboFirstAttr.toUpperCase()} + ${attr.enName}]`
                                : `選取 ${attr.enName} 作為雙屬性檢定的第一顆骰`
                          }
                        >
                          <span>{isFirstSelected ? '首骰' : comboFirstAttr ? '+配對' : '配對'}</span>
                        </button>
                      </div>

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

              {/* 常用雙屬性一鍵檢定列 */}
              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-[#e8dcc4]">
                <span className="text-t10 text-[#7c6a58] font-bold">常用檢定:</span>
                {[
                  { a1: 'dex', a2: 'ins', label: 'DEX+INS' },
                  { a1: 'ins', a2: 'wlp', label: 'INS+WLP' },
                  { a1: 'dex', a2: 'mig', label: 'DEX+MIG' },
                  { a1: 'mig', a2: 'wlp', label: 'MIG+WLP' }
                ].map(pair => {
                  const getDie = (k) => (k === 'dex' ? stats.currentDex : k === 'ins' ? stats.currentIns : k === 'mig' ? stats.currentMig : stats.currentWlp);
                  return (
                    <button
                      key={pair.label}
                      type="button"
                      onClick={() => openCharacterDice({
                        die1: getDie(pair.a1),
                        die2: getDie(pair.a2),
                        modifier: 0,
                        label: `常用檢定 [${pair.label}]`
                      })}
                      className="px-1.5 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-[#3c2415] font-bold text-t10 transition-colors"
                    >
                      {pair.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EXP / Zenit / Fabula Points Compact Cards */}
            <div className="grid grid-cols-1 gap-2">
              {/* EXP Progress & Session EXP Settlement */}
              <div className="bg-[#fffdf9] rounded p-3 border space-y-1.5" style={{ borderColor: theme.border }}>
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
                <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#f4ebd9]">
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
              </div>

              {/* Zenit & Fabula Points Side by Side */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#fffdf9] rounded p-3 border flex flex-col justify-between" style={{ borderColor: theme.border }}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold flex items-center gap-1" style={{ color: theme.textDark }}>
                      <GiCoins className="w-3.5 h-3.5 text-[#6b5a4b]" />
                      金幣錢包
                    </span>
                    <span className="font-mono font-black text-xs text-[#3c2415]">
                      {character.zenit || 0} z
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <NumberStepper
                      value={character.zenit || 0}
                      onDelta={adjustZenit}
                      ariaLabel="金幣"
                      width="w-16"
                      inputClassName="text-[#6b5a4b]"
                    />
                  </div>
                </div>

                <div className="bg-[#fffdf9] rounded p-3 border flex flex-col justify-between" style={{ borderColor: theme.border }}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold flex items-center gap-1" style={{ color: theme.textDark }}>
                      <GiSparkles className="w-3.5 h-3.5 text-[#6b5a4b]" />
                      物語點
                    </span>
                    <span className="font-mono font-black text-xs text-[#3c2415]">
                      {character.fabulaPoints ?? 3} FP
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <NumberStepper
                      value={character.fabulaPoints ?? 3}
                      onDelta={adjustFp}
                      ariaLabel="物語點"
                      width="w-12"
                      inputClassName="text-[#3c2415]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 職業資源池（只有對應職業才出現；數值見 data/classResources.js） */}
      <ClassResourceStrip
        character={character}
        onChange={onChange}
        showToast={showToast}
      />

      {/* 4. Status Afflictions (六大狀態異常) */}
      <div className="p-3.5 rounded bg-white border border-[#e8dcc4] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#3c2415] flex items-center gap-1">
            <GiHazardSign className="w-3.5 h-3.5 text-[#6b5a4b]" />
            <span>狀態異常監控</span>
          </span>
          <span className="text-t12 text-[#6b5a4b] font-mono">點擊直接切換狀態</span>
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
                className={`py-1.5 px-2 rounded border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  isActive
                    ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]'
                    : 'bg-[#f4ebd9] border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#e8dcc4]'
                }`}
                title={aff.desc}
              >
                <span>{aff.short}</span>
                {isActive && <span className="text-t12 opacity-90 font-mono">(-1階)</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4b. 金手指相性（F-023，2026-10-26 P11） */}
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

      {/* 6. Sub-Tabs: 武器與戰鬥 | 咒語與魔法 | 職業特技 | 情感羈絆 | 個人命刻 | 行囊日誌 */}
      <div className="bg-[#fffdf9] rounded border-2 overflow-hidden" style={{ borderColor: theme.border }}>
        <div
          className="flex items-center gap-1 p-2 border-b overflow-x-auto transition-colors duration-200"
          style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}
        >
          {[
            { id: 'attacks', label: '武器與戰鬥', icon: GiCrossedSwords },
            { id: 'spells', label: `咒語與魔法 (${resolveCharacterSpells(character).length})`, icon: GiSpellBook },
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
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isTabActive
                    ? 'text-white'
                    : 'text-[#6b5a4b] hover:bg-black/5'
                }`}
                style={isTabActive ? { backgroundColor: theme.accent, color: '#fffdf9' } : {}}
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
                  <span>當前武裝與命中公式膠囊 (點擊公式直接擲骰)</span>
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
                      <span className="text-[#6b5a4b] block font-sans">副手/盾牌:</span>
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
                      <span className="text-[#6b5a4b] block font-sans">防具裝甲:</span>
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
                      <span className="text-[#6b5a4b] block font-sans">佩戴飾品:</span>
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

          {/* TAB 2: 咒語與魔法 (Dedicated Spells Tab) */}
          {activeTab === 'spells' && (() => {
            const resolvedSpells = resolveCharacterSpells(character);
            return (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
                  <GiSpellBook className="w-4 h-4 text-[#6b5a4b]" />
                  <span>已掌握的咒語與儀式</span>
                </span>
                {/* 清單為空時**收起**標頭這顆：空狀態裡已經有一顆講得更清楚的
                    「從規則庫選擇習得咒語」。同一屏兩顆按鈕做同一件事，
                    使用者會以為它們不一樣（§3.4 立過此例，工坊那次是反過來收空狀態那顆）。 */}
                {resolvedSpells.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSpellModalOpen(true)}
                    className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>學習新咒語</span>
                  </button>
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
                            <button
                              type="button"
                              onClick={() => handleCastSpell(sp)}
                              className="px-2.5 py-1 rounded bg-[#e8dcc4] hover:bg-[#d6c7ab] text-[#3c2415] font-bold text-xs transition-colors flex items-center gap-1"
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
              ) : (
                <div className="p-8 text-center bg-[#fbf7ee] rounded border border-dashed border-[#d6c7ab] flex flex-col items-center justify-center">
                  <GiSpellBook className="w-9 h-9 text-[#6b5a4b]" />
                  <p className="mt-2.5 font-bold text-[#3c2415] text-sm tracking-wide">尚未掌握任何咒語</p>
                  <p className="mt-1 text-[#6b5a4b] text-xs leading-relaxed max-w-md">
                    咒語分攻擊與輔助兩種，學習時從規則庫挑選並扣除對應的 MP 上限；不走施法路線的角色可以整段略過。
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSpellModalOpen(true)}
                    className="mt-4 px-3.5 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] active:bg-[#8c3235] text-[#fffdf9] font-bold text-xs shadow-e1 transition-colors"
                  >
                    從規則庫選擇習得咒語
                  </button>
                </div>
              )}

              {/* 儀式魔法速查與施展計算器（Core p.118–121） */}
              {(() => {
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
                const RITUAL_SKILLS = [
                  { skill: '秘儀學派儀式', name: '秘儀學派', formula: 'WLP + WLP' },
                  { skill: '嵌合學派儀式', name: '嵌合學派', formula: 'INS + WLP' },
                  { skill: '元素學派儀式', name: '元素學派', formula: 'INS + WLP' },
                  { skill: '熵系學派儀式', name: '熵系學派', formula: 'INS + WLP' },
                  { skill: '靈魂學派儀式', name: '靈魂學派', formula: 'INS + WLP' },
                  { skill: '儀式學派', name: '儀式學派', formula: 'INS + WLP' }
                ];
                const learnedRituals = [];
                (character.classes || []).forEach(cl => {
                  (cl.skills || []).forEach(sk => {
                    if ((sk.sl || 0) <= 0) return;
                    const normName = normalizeSkillName(sk.name);
                    const found = RITUAL_SKILLS.find(r => r.skill === normName);
                    if (found && !learnedRituals.some(x => x.name === found.name)) {
                      learnedRituals.push(found);
                    }
                    if (normName === '儀式學派' && Array.isArray(sk.selectedOptions)) {
                      sk.selectedOptions.forEach(opt => {
                        if (!learnedRituals.some(x => x.name === opt)) {
                          learnedRituals.push({ skill: '儀式學派', name: opt, formula: opt.includes('秘儀') ? 'WLP + WLP' : 'INS + WLP' });
                        }
                      });
                    }
                  });
                });
                const pot = POTENCY_MAP[ritualPotency] || POTENCY_MAP.minor;
                const ar = AREA_MAP[ritualArea] || AREA_MAP.individual;
                const rawMp = pot.mp * ar.mult;
                const finalMp = ritualHasIngredient ? Math.floor(rawMp / 2) : rawMp;

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
                      <span className="text-[#6b5a4b] font-bold">已掌握儀式學派:</span>
                      {learnedRituals.length > 0 ? learnedRituals.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-[#3c2415] font-bold"
                        >
                          ✦ {r.name} [{r.formula}]
                        </span>
                      )) : (
                        <span className="text-[#7c6a58]">尚未習得儀式特技（同伴施展儀式時仍可參與團隊檢定協助）</span>
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

                      <button
                        type="button"
                        onClick={() => {
                          if (curMp < finalMp) {
                            showToast(`MP 不足！施展此儀式需要 ${finalMp} 點 MP`, 'warning');
                            return;
                          }
                          adjustMp(-finalMp);
                          const formulaStr = learnedRituals[0]?.formula || 'INS + WLP';
                          const rCheck = parseCheckFormula(formulaStr, stats);
                          openCharacterDice({
                            die1: rCheck.die1,
                            die2: rCheck.die2,
                            modifier: rCheck.mod,
                            label: `施展儀式（效力${pot.label}×${ar.label}，DL ${pot.dl}）[${formulaStr}]`
                          });
                        }}
                        className="px-3 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs flex items-center gap-1"
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

          {/* TAB 3: 職業特技 (Class Skills - Streamlined) */}
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
                      以前「武器與戰鬥」與「職業特技」各掛一次同一份面板（DOM 加倍），
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
                                  <span>規則概念速查</span>
                                </button>
                              )}
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]">
                                SL {sk.sl} / {display.maxSL || 5}
                              </span>
                            </div>
                          </div>

                          <div className="text-t14 text-[#6b5a4b] leading-relaxed">
                            <div className={isExpanded ? '' : 'line-clamp-2'}>
                              <SkillDescription desc={display.desc || '暫無描述'} sl={sk.sl} refSource={display.name} />
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
                            {sourceLabel && (
                              <span className="text-t11 px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#e8dcc4] text-[#6b5a4b]">
                                {sourceLabel}{resolved.class ? ` · ${resolved.class}` : ''}
                              </span>
                            )}
                          </div>
                          {effectText && (
                            <p className="text-t12 text-[#6b5a4b] leading-relaxed whitespace-pre-wrap">
                              {renderTextWithAffinities(effectText)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 金手指特質全文 (Quirk Full Text & Selected Effect) */}
              {character.quirk && character.quirk !== '無' && (() => {
                const quirkDef = (rulesData.quirks || []).find(q => q.name === character.quirk);
                const choiceRows = describeQuirkChoice(character);
                const choiceSummary = choiceRows
                  .map(r => (r.group ? `${r.group}：${r.label}` : r.label))
                  .join('、');
                return (
                  <div data-testid="hud-quirk-detail" className="pt-3 border-t space-y-2" style={{ borderColor: theme.border }}>
                    <div className="font-serif font-black text-sm flex items-center gap-1.5 text-[#3c2415]">
                      <GiSparkles className="w-4 h-4 text-[#a63d40]" />
                      <span>金手指特質：{character.quirk}</span>
                    </div>
                    <div className="p-3 rounded bg-[#fbf7ee] border border-[#d6c7ab] space-y-1.5">
                      {choiceSummary && (
                        <div className="text-t11 font-bold text-[#8c3235] bg-[#f4ebd9] px-2 py-1 rounded border border-[#e8dcc4]">
                          ✦ 已選效果：{choiceSummary}
                        </div>
                      )}
                      {quirkDef?.effect ? (
                        <p className="text-t12 text-[#6b5a4b] leading-relaxed whitespace-pre-wrap">
                          {renderTextWithAffinities(quirkDef.effect)}
                        </p>
                      ) : (
                        <p className="text-t12 text-[#7c6a58]">已啟用金手指【{character.quirk}】。</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 4: 情感羈絆 (Bonds) */}
          {activeTab === 'bonds' && (
            <div className="space-y-3 animate-fade-in text-xs">
              {/* 營地活動：休息場景的一部分（原書 p.130「進行活動與調整羈絆可以同時做」）。
                  規則沒開、金手指也沒給 → 整塊不出現（與底力技同一個原則）。 */}
              {campAccess.enabled && (
                <CampActivitiesBlock
                  character={character}
                  theme={theme}
                  mode="play"
                  allowance={campAccess.allowance}
                  quirkGrant={campAccess.quirkGrant}
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
                        className="px-3 py-1.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-[#8c3235] font-bold text-xs shrink-0"
                        title="開啟擲骰器，擲完骰後套用這條羈絆的情感加值（消耗 1 物語點）"
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

                  {/* 「為什麼有這份情感」。這一行是羈絆從「六個標籤」變成「一段關係」的地方，
                      所以它排在情感標籤下面、編輯面板上面——先讀到理由，再決定要不要改。
                      墨色用四階墨裡的主墨（`#3c2415`）：這是內容，不是標籤。 */}
                  {bond.why && (
                    <div
                      className="text-t12 text-[#3c2415] bg-[#fbf7ee] border-l-2 pl-2 py-1 leading-relaxed"
                      style={{ borderColor: '#d6c7ab' }}
                    >
                      「{bond.why}」
                    </div>
                  )}

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
                      <div className="space-y-1">
                        <span className="text-t11 font-bold text-[#6b5a4b] block">
                          為什麼有這份情感？（選填，會寫進履歷）
                        </span>
                        <textarea
                          data-testid="bond-edit-why"
                          value={editBondWhy}
                          onChange={e => setEditBondWhy(e.target.value)}
                          maxLength={BOND_WHY_MAX}
                          rows={2}
                          placeholder="例如：他在城門前替我擋了一刀。"
                          className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fffdf9] text-t12 text-[#3c2415] resize-none"
                        />
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
                  teach="羈絆是對某人某物的三維情感（欽佩／忠誠／喜愛…）；激勵時消耗 1 物語點，檢定加值等於情感數。最多 6 條。"
                />
              )}
            </div>
          )}

          {/* TAB 5: 個人命刻 (Clocks) */}
          {activeTab === 'clocks' && (
            <div className="space-y-4 animate-fade-in">
              {/* 底力命刻（高度奇幻手冊 p.124–131）：規則沒開就完全不出現。
                  它與下面的「個人命刻」是兩種東西——個人命刻是玩家自建的進度鐘，
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
                  teach="個人命刻是這名角色自己的進度鐘（例如「傷勢惡化」「與導師的約定」）；章節層級的情勢命刻請到「命刻記錄」那一章。"
                />
              )}
            </div>
          )}

          {/* TAB 6: 行囊日誌 (Notes & Inventory) */}
          {activeTab === 'notes' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="p-3.5 rounded bg-[#fbf7ee] border border-[#e8dcc4] space-y-2">
                <span className="font-bold text-[#3c2415] block">冒險者行囊物品與武裝</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#3c2415] font-mono">
                  <div>主手武器: <strong>{character.equipment?.mainHand || '空手'}</strong></div>
                  <div>副手武裝: <strong>{character.equipment?.offHand || '無'}</strong></div>
                  <div>防具裝甲: <strong>{character.equipment?.armor || '無'}</strong></div>
                  <div>佩戴飾品: <strong>{character.equipment?.accessory || '無'}</strong></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-[#3c2415] block">冒險筆記本</span>
                <textarea
                  value={character.backpackNotes || ''}
                  onChange={e => updateField('backpackNotes', e.target.value)}
                  placeholder="在此記錄冒險日記、行囊物品、NPC 線索或秘密契約..."
                  rows={6}
                  className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded p-3 text-xs text-[#3c2415] outline-none focus:border-[#3c2415] leading-relaxed shadow-inner"
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
                    disabled={isLearned}
                    className="px-3 py-1.5 rounded text-white font-bold text-xs shrink-0 disabled:opacity-40 disabled:bg-[#e8dcc4]"
                    style={{ backgroundColor: isLearned ? '#6b5a4b' : theme.accent }}
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
            升級將消耗 <strong>10 點 EXP</strong>，角色等級提升 1 級，最大 HP +1、最大 MP +1，並可選擇分配 1 點特技！
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

          <div>
            <label className="font-bold text-[#3c2415] block mb-1">為什麼有這份情感？（選填，會寫進履歷）:</label>
            <textarea
              data-testid="bond-new-why"
              value={newBondWhy}
              onChange={e => setNewBondWhy(e.target.value)}
              maxLength={BOND_WHY_MAX}
              rows={2}
              placeholder="例如：他在城門前替我擋了一刀。"
              className="w-full p-2 rounded border border-[#e8dcc4] bg-white text-t12 resize-none"
            />
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
