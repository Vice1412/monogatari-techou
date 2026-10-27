/**
 * 裝備配置規則層 (equipmentRules)
 *
 * 為什麼要有這一層：
 * 原書的裝備表只寫「規格」——`HR + 6`、`DEX + MIG`、`先攻 -2`；
 * 但玩家選裝備時想知道的是「這件裝備在我身上會變成什麼」。
 * 同一件賢者長袍，靈巧 d6 與 d10 的角色物防差 4 點；原書把這件事寫在說明文字裡
 * （Core p.127：物防／魔防取**當前**骰尺寸），資料表卻看不出來。
 *
 * 本模組把「規格 → 對這個角色的後果」集中成一處純函式：
 * 命中檢定用哪兩顆骰、傷害式是什麼、物防／魔防／先攻結果、熟練度需求、載入衝突、
 * 以及雙重盾牌（守護者）合併成「雙盾」的判定。
 * 無 React 依賴，供 UI 與 `tests/equipmentRules.test.mjs` 共用同一份實作。
 *
 * 資料來源：官方英文核心規則書 v1.1
 * - 基本武器表 p.130–131（十個類別）
 * - 基本防具／盾牌表 p.132–133（含先攻欄）
 * - 裝備章總則 p.126–127（職業武裝的職業對應、物防／魔防公式）
 * - 守護者【雙重盾牌】：主手可裝備盾牌；兩手皆盾時合併視為格鬥類別雙手近戰武器「雙盾」
 * - 起始裝備預算 500z p.164–165（僅限基本武器／防具／盾牌；飾品為稀有物品，不列入）
 */

import { getArmorProfile } from '../data/initiativeVariant';
// 魔晶石制下【雙重盾牌】失效（科技奇幻手冊 p.133）——判定在 `technospheres.js`，
// 該檔零 import，這裡加一條單向邊不會成環。
import { isSkillSuppressedByTechnospheres } from '../data/technospheres';
import { resolveCreationRules } from '../data/creationRules';

/** 四維屬性鍵（順序即原書 DEX / INS / MIG / WLP） */
export const DICE_ATTRS = ['DEX', 'INS', 'MIG', 'WLP'];

/**
 * 武器十大類別（Core p.129）。
 * 圖示為敘事槽位，依 `GEMINI.md` 規則一軌道 2 一律走 `react-icons/gi`。
 */
export const WEAPON_CATEGORIES = [
  { key: '奧術', icon: 'cat_arcane' },
  { key: '弓', icon: 'cat_bow' },
  { key: '鬥毆', icon: 'cat_brawling' },
  { key: '匕首', icon: 'cat_dagger' },
  { key: '火器', icon: 'cat_firearm' },
  { key: '連枷', icon: 'cat_flail' },
  { key: '重型', icon: 'cat_heavy' },
  { key: '矛', icon: 'cat_spear' },
  { key: '劍', icon: 'cat_sword' },
  { key: '投擲', icon: 'cat_thrown' }
];

/** 類別 → 圖示鍵；資料表出現未預期類別時回退到通用劍圖示 */
export const CATEGORY_ICON = WEAPON_CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.icon;
  return acc;
}, {});

/**
 * 裝備圖示對照表（名稱 → `react-icons/gi` 元件名）。
 *
 * 來源：使用者自製「裝備設計器」Google Sheets 各分頁左上角的 IMAGE() 公式格，
 * 該處每個原型都以 game-icons 圖示匯出。本表為該批圖示的逐一比對結果
 * （比對方法：把 4,036 個 gi 圖示光柵化後與設計器的 PNG 做 IoU 比對，
 * 並先剔除右下角的職業徽章；命中者 IoU 皆 ≥ 0.80）。
 */
export const EQUIPMENT_ICONS = {
  // ── 武器（設計器【武器】分頁）
  法杖: 'GiWizardStaff',
  魔導書: 'GiSpellBook',
  戰弓: 'GiCrossbow',
  短弓: 'GiPocketBow',
  鐵指虎: 'GiBrassKnuckles',
  短匕首: 'GiSacrificialDagger',
  手槍: 'GiRevolver',
  鎖鏈鞭: 'GiFlail',
  鐵錘: 'GiFlatHammer',
  闊斧: 'GiBatteredAxe',
  戰斧: 'GiBattleAxe',
  輕長矛: 'GiGlaive',
  重長矛: 'GiBarbedSpear',
  青銅劍: 'GiGladius',
  巨劍: 'GiBroadsword',
  武士刀: 'GiKatana',
  刺劍: 'GiSwitchblade',
  手裡劍: 'GiShuriken',
  // 設計器未收錄者，依同批語彙補齊
  徒手打擊: 'GiPunch',
  '臨時武器（近戰）': 'GiWoodClub',
  '臨時武器（遠程）': 'GiSling',

  // ── 盾牌與防具（設計器【盾牌、防具】分頁）
  無盾牌: 'GiShield',
  青銅圓盾: 'GiShield',
  符文圓盾: 'GiDragonShield',
  '無裝甲 / 冒險服': 'GiClothes',
  絲綢外衣: 'GiShirt',
  旅行皮甲: 'GiPirateCoat',
  戰鬥輕甲: 'GiNinjaArmor',
  賢者長袍: 'GiRobe',
  板條甲: 'GiChainMail',
  青銅胸甲: 'GiLeatherArmor',
  符文甲冑: 'GiHeartArmor',
  鋼鐵板甲: 'GiLamellar',

  // ── 雙重盾牌合併後的虛擬武器
  雙盾: 'GiDragonShield'
};

/** 名稱查不到時，依類別／欄位退回通用圖示 */
export const getEquipmentIcon = (name, fallback = 'cat_sword') => EQUIPMENT_ICONS[name] || fallback;

/** 四個裝備欄位的定義（標籤一律純中文，依 `GEMINI.md` 規則三） */
export const EQUIPMENT_SLOTS = {
  mainHand: {
    id: 'mainHand',
    label: '主手武器',
    icon: 'slot_mainhand',
    emptyValue: '徒手打擊',
    emptyLabel: '空手（自動視為徒手打擊）'
  },
  offHand: {
    id: 'offHand',
    label: '副手武裝',
    icon: 'slot_offhand',
    emptyValue: '無盾牌',
    emptyLabel: '空手（不裝備副手）'
  },
  armor: {
    id: 'armor',
    label: '身體防具',
    icon: 'slot_armor',
    emptyValue: '無裝甲 / 冒險服',
    emptyLabel: '不穿防具'
  },
  accessory: {
    id: 'accessory',
    label: '佩戴飾品',
    icon: 'slot_accessory',
    emptyValue: '',
    emptyLabel: '不佩戴飾品'
  }
};

/** 由引擎回傳的 stats 取出「當前」四維骰（狀態減值後），供裝備換算使用 */
export const diceFromStats = (stats = {}) => ({
  DEX: stats.currentDex ?? stats.baseDex ?? 8,
  INS: stats.currentIns ?? stats.baseIns ?? 8,
  MIG: stats.currentMig ?? stats.baseMig ?? 8,
  WLP: stats.currentWlp ?? stats.baseWlp ?? 8
});

// ─────────────────────────────────────────────────────────── 條目解析

/**
 * 解析命中屬性字串（例：`DEX + INS + 1`、`MIG + MIG`）。
 * 原書把命中加值直接寫在屬性欄後面（`(DEX + INS) +1`），資料表沿用同一寫法，
 * 因此這裡拆成「屬性清單」與「命中加值」兩部分。
 */
export const parseAccuracy = (attr = '') => {
  const bonusMatch = String(attr).match(/\+\s*(\d+)/);
  const accuracyBonus = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;
  const attrs = String(attr)
    .split('+')
    .map((part) => part.trim())
    .filter((part) => DICE_ATTRS.includes(part));
  return { accuracyBonus, attrs };
};

/** 解析傷害字串（例：`【HR + 6】物理`）→ 傷害加值與傷害類型 */
export const parseDamage = (damage = '') => {
  const text = String(damage);
  const bonusMatch = text.match(/HR\s*\+\s*(\d+)/);
  const damageBonus = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;
  const typeMatch = text.match(/】\s*([^\s【]+)/);
  const damageType = typeMatch ? typeMatch[1] : '物理';
  return { damageBonus, damageType };
};

/**
 * 把傷害式的 HR 加值往上加（F-024，2026-10-27）。
 *
 * `【HR + 0】物理` ＋ 6 → `【HR + 6】物理`
 *
 * 為甚麼要有這一個小函式，而不是在呼叫端寫字串取代：
 * 傷害式的寫法在資料裡至少有兩種（`【HR + 0】物理`、`(HR + 8) 物理`），
 * 而且數字可能不只一位。集中在這裡，改格式時只會有一個地方要改。
 * 找不到 `HR + N` 就原樣回傳——寧可少加，也不要生出一段壞掉的字串。
 */
export const withHrBonus = (damage = '', bonus = 0) => {
  const text = String(damage);
  if (!bonus) return text;
  const m = text.match(/HR\s*\+\s*(\d+)/);
  if (!m) return text;
  return text.replace(/HR\s*\+\s*\d+/, `HR + ${parseInt(m[1], 10) + bonus}`);
};

/** 防具的物防／魔防公式種類（Core p.127：固定值 或 當前骰 + 加值） */
export const parseArmorFormula = (formula = '') => {
  const text = String(formula).trim();
  const fixed = parseInt(text, 10);
  if (!Number.isNaN(fixed)) return { kind: 'fixed', value: fixed };
  const match = text.match(/^(dex|ins)(?:\+(\d+))?$/i);
  if (!match) return { kind: 'unknown', value: 0 };
  return {
    kind: match[1].toLowerCase(),
    bonus: match[2] ? parseInt(match[2], 10) : 0
  };
};

// ─────────────────────────────────────────────────────────── 武器換算

/**
 * 把一件武器換算成「對持有該骰組的角色而言」的實際數字。
 *
 * 這裡刻意**不**提供期望值：玩家在表上要看的是「命中檢定擲哪兩顆骰、傷害式加多少」，
 * 期望傷害是統計量，不是規則書上的數字，寫出來反而干擾閱讀。
 * 因此只把屬性代號換成該角色的實際骰（`DEX + INS` → `DEX d8 + INS d6`）。
 */
export const evaluateWeapon = (weapon, dice = {}) => {
  const { accuracyBonus, attrs } = parseAccuracy(weapon?.attr);
  const { damageBonus, damageType } = parseDamage(weapon?.damage);

  const dieA = dice[attrs[0]] ?? dice.DEX ?? 8;
  const dieB = dice[attrs[1]] ?? dieA;

  return {
    attrs,
    accuracyBonus,
    damageBonus,
    damageType,
    dieA,
    dieB,
    accuracyFormula: attrs.length ? attrs.join(' + ') : '—',
    accuracyDiceLabel: attrs.map((a) => `${a} d${dice[a] ?? 8}`).join(' + '),
    accuracyLabel: `${attrs.map((a) => `${a} d${dice[a] ?? 8}`).join(' + ')}${accuracyBonus > 0 ? ` +${accuracyBonus}` : ''}`,
    damageFormula: `HR + ${damageBonus}`,
    damageLabel: `HR + ${damageBonus} ${damageType}`
  };
};

/** 是否為雙手武器（佔滿兩個手部欄位，Core p.131） */
export const isTwoHanded = (item) => Number(item?.hands) === 2;

/** 是否為徒手打擊（原書 p.130：空格手部欄位自動視為徒手打擊） */
export const isUnarmedStrike = (weapon) => weapon?.name === '徒手打擊';

/** 是否為盾牌條目（盾牌有 defBonus 欄位；武器沒有） */
export const isShieldItem = (item) => Boolean(item) && item.defBonus !== undefined;

/**
 * 套用一次裝備變更，並回傳需要連帶處理的結果。
 *
 * 目前唯一的連帶規則是：**主手換成雙手武器時，副手必須空出**（Core p.131——
 * 雙手武器佔滿兩個手部欄位）。純函式，讓 UI 與測試共用同一份判定。
 *
 * `clearedOffHand` 只在「真的有東西被卸下」時才有值——
 * 副手本來就是空的、或只是徒手打擊時不提示（那是「空手」的另一種寫法，不是被換掉的裝備）。
 */
export const applyEquipmentChoice = (equipment, slot, name, weaponMap) => {
  const next = { ...(equipment || {}), [slot]: name };
  let clearedOffHand = null;

  if (slot === 'mainHand' && isTwoHanded(weaponMap?.get?.(name))) {
    const previous = next.offHand;
    if (previous && previous !== '無盾牌') {
      if (previous !== '徒手打擊') clearedOffHand = previous;
      next.offHand = '無盾牌';
    }
  }

  return { equipment: next, clearedOffHand };
};

// ─────────────────────────────────────────────────────────── 熟練度

/**
 * 取得該裝備所需的職業熟練度鍵；不需要熟練度時回傳 null。
 * 對應關係依 Core p.126：
 * - 職業近戰武器：暗黑之刃、狂怒鬥士、武器大師
 * - 職業遠程武器：神射手、指揮官、機師
 * - 職業防具：暗黑之刃、狂怒鬥士、守護者
 * - 職業盾牌：守護者、神射手、武器大師
 */
export const requiredProficiency = (item, slot) => {
  if (!item) return null;
  if (slot === 'mainHand' || slot === 'offHand') {
    if (!item.martial) return null;
    return item.range === '遠程' ? 'martialRanged' : 'martialMelee';
  }
  if (slot === 'armor') {
    if (item.martial === true) return 'martialArmor';
    // 舊資料沒有 martial 欄位時的相容判定：固定值物防即為職業防具
    return parseArmorFormula(item.defFormula).kind === 'fixed' ? 'martialArmor' : null;
  }
  return null;
};

/** 盾牌另有一條熟練度規則（職業盾牌），與武器的判定分開 */
export const shieldProficiency = (shield) => (shield?.martial ? 'martialShields' : null);

/** 判斷某件裝備在目前職業組合下是否真的能裝備，並回傳原因 */
export const checkEquippable = (item, slot, profs = {}, { isShield = false } = {}) => {
  if (!item) return { ok: true, reason: null };
  // 盾牌佔用的是主手或副手，兩者都吃「職業盾牌」熟練度
  const shieldLike = isShield || isShieldItem(item);
  const key = shieldLike ? shieldProficiency(item) : requiredProficiency(item, slot);
  if (!key) return { ok: true, reason: null };
  if (profs[key]) return { ok: true, reason: null };

  const labels = {
    martialMelee: '職業近戰武器',
    martialRanged: '職業遠程武器',
    martialArmor: '職業防具',
    martialShields: '職業盾牌'
  };
  return { ok: false, reason: `需要${labels[key]}熟練度` };
};

// ─────────────────────────────────────────────────────────── 防具與盾牌

/**
 * 防具對這個角色的實際結果。
 * 回傳 `def` / `mdef` / `initMod`，語意與 `characterEngine` 完全一致
 * （物防／魔防取「當前骰」，不是基礎骰——原書 p.126）。
 *
 * `initiativeVariant` 為真時改用先攻變體側寫（公測 p.34）：先攻減值歸零、
 * 戰鬥輕甲改物防 +2／魔防 +0。判定本身在 `data/initiativeVariant.js` 的
 * `getArmorProfile`——這裡只負責套公式，不自己再判斷一次規則。
 */
export const computeArmorOutcome = (armor, dice = {}, { initiativeVariant = false } = {}) => {
  const dex = dice.DEX ?? 8;
  const ins = dice.INS ?? 8;
  if (!armor) return { def: dex, mdef: ins, initMod: 0 };

  const profile = getArmorProfile(armor, initiativeVariant) || armor;
  const defFormula = parseArmorFormula(profile.defFormula);
  const mdefFormula = parseArmorFormula(profile.mdefFormula);

  const def = defFormula.kind === 'fixed'
    ? defFormula.value
    : (defFormula.kind === 'dex' ? dex + (defFormula.bonus || 0) : dex);
  const mdef = mdefFormula.kind === 'fixed'
    ? mdefFormula.value
    : (mdefFormula.kind === 'ins' ? ins + (mdefFormula.bonus || 0) : ins);

  return { def, mdef, initMod: profile.initMod || 0 };
};

/** 盾牌對這個角色的實際加值 */
export const computeShieldOutcome = (shield) => ({
  defBonus: shield?.defBonus || 0,
  mdefBonus: shield?.mdefBonus || 0,
  initMod: shield?.initMod || 0
});

// ─────────────────────────────────────────────────────────── 職業技能查詢

/** 該角色是否已學會某技能（任一職業，SL ≥ 1） */
export const hasSkill = (character, skillName) => (
  (character?.classes || []).some((cl) =>
    (cl.skills || []).some((sk) => sk.name === skillName && (sk.sl || 0) > 0))
);

/** 該技能的 SL（找不到時回傳 0，不臆測） */
export const getSkillLevel = (character, skillName) => {
  let best = 0;
  (character?.classes || []).forEach((cl) => {
    (cl.skills || []).forEach((sk) => {
      if (sk.name === skillName && (sk.sl || 0) > best) best = sk.sl || 0;
    });
  });
  return best;
};

/**
 * 守護者【雙重盾牌】的合併武器。
 * 原書：主手可裝備盾牌；兩手皆盾時可合併視為格鬥類別雙手近戰武器「雙盾」——
 * 命中【MIG + MIG】、傷害【HR + 5】物理，額外造成《防守掌握》SL 點傷害。
 */
export const DUAL_SHIELD = {
  name: '雙盾',
  category: '鬥毆',
  cost: 0,
  hands: 2,
  attr: 'MIG + MIG',
  damage: '【HR + 5】物理',
  range: '近戰',
  note: '守護者【雙重盾牌】：兩手皆盾時合併視為此武器'
};

/**
 * 判斷目前是否成立「雙盾」狀態。
 * `active` 為真時，主手的攻擊應改用 `weapon`（＝雙盾）的命中與傷害公式，
 * 而不是任何一件盾牌本身的數值——盾牌本身沒有攻擊資料。
 */
export const getDualShieldState = (character, { mainIsShield = false, offIsShield = false, technosphereMode = null } = {}) => {
  // 魔晶石制下守護者的【雙重盾牌】失效（科技奇幻手冊 p.133：
  // 「ignore the Guardian's Dual Shield skill」）。
  //
  // 技能本身仍寫在角色卡上——已投入的技能點不會退還（`validateCharacter` 會給
  // 「已作廢」的提醒），但**不能拿它把盾牌裝到主手**，也不能合併成雙盾。
  // 這裡是唯一判定點：`learned` 一假，`active` 與所有下游（主手盾牌合法性、
  // 雙盾的命中／傷害公式）全部跟著失效。
  const learned = hasSkill(character, '雙重盾牌')
    && !isSkillSuppressedByTechnospheres('雙重盾牌', technosphereMode);
  const defenseMasterySL = getSkillLevel(character, '防守掌握');
  return {
    learned,
    active: learned && mainIsShield && offIsShield,
    defenseMasterySL,
    weapon: DUAL_SHIELD
  };
};

// ─────────────────────────────────────────────────────────── 載入衝突

/**
 * 檢查整套裝備的合法性，回傳問題清單。
 *
 * 這裡只回報「規則上明確不成立」的組合，不做風格建議：
 * 1. 雙手主手武器佔滿兩手 → 副手必須空出（Core p.131）
 * 2. 職業武裝需要對應職業（Core p.126）
 * 3. 起始 500z 預算（Core p.164；飾品屬稀有物品，不計入）
 * 4. 資料表中查無該名稱（自訂或匯入的字串）
 */
/**
 * 起始裝備預算的實際花費（原書 p.164）。
 *
 * 只計**基本武器／防具／盾牌**——飾品屬稀有物品，原書說要另外與團隊討論，不從起始預算出
 * （見檔頭說明）。主手可能是盾牌（守護者【雙重盾牌】），所以兩張表都要查。
 *
 * 這是唯一的計算處：編輯器的預算追蹤條、`validateCharacter` 與 `buildLoadoutIssues`
 * 都讀這裡，同一張卡不會再出現兩個不同的「已花費」。
 */
export const totalStartingEquipCost = (equipment = {}, { weaponMap, shieldMap, armorMap, extraSpend = 0 } = {}) => {
  const costOf = (name, ...maps) => {
    if (!name) return 0;
    for (const map of maps) {
      const item = map?.get(name);
      if (item) return Number(item.cost) || 0;
    }
    return 0;
  };
  return costOf(equipment.mainHand, weaponMap, shieldMap)
    + costOf(equipment.offHand, weaponMap, shieldMap)
    + costOf(equipment.armor, armorMap)
    // 裝備本體以外的花費：目前只有魔晶石的插槽品級（α 免費／β +600／γ +1500／δ +1800）。
    // 它算在**同一筆裝備預算**裡——原書 p.133 把插槽品級列在裝備規則的價格表上，
    // 不是另一本帳。由呼叫端算好傳進來，這裡不必知道魔晶石是什麼。
    + (Number(extraSpend) || 0);
};

export const buildLoadoutIssues = ({
  character,
  stats,
  weaponMap,
  armorMap,
  shieldMap,
  accessoryMap,
  budget = 500,
  extraSpend = 0
}) => {
  const issues = [];
  const equipment = character?.equipment || {};
  const profs = stats?.profs || {};

  const mainWeapon = weaponMap?.get(equipment.mainHand) || null;
  const mainShield = shieldMap?.get(equipment.mainHand) || null;
  const offShield = shieldMap?.get(equipment.offHand) || null;
  const offWeapon = offShield ? null : (weaponMap?.get(equipment.offHand) || null);
  const armor = armorMap?.get(equipment.armor) || null;

  // 1. 持握衝突（雙重盾牌狀態下，兩手皆盾是合法的）
  //    魔晶石制下【雙重盾牌】失效 → `dual.learned` 為假 → 主手盾牌立刻變成 error。
  const dual = getDualShieldState(character, {
    mainIsShield: Boolean(mainShield),
    offIsShield: Boolean(offShield),
    technosphereMode: resolveCreationRules(character?.creationRules).technospheres
  });
  if (isTwoHanded(mainWeapon) && equipment.offHand && equipment.offHand !== '無盾牌') {
    issues.push({
      level: 'error',
      message: `${mainWeapon.name}是雙手武器，副手必須空出`
    });
  }

  // 2. 熟練度
  if (mainWeapon) {
    const main = checkEquippable(mainWeapon, 'mainHand', profs);
    if (!main.ok) issues.push({ level: 'error', message: `主手${mainWeapon.name}：${main.reason}` });
  }
  if (mainShield) {
    if (!dual.learned) {
      issues.push({ level: 'error', message: `主手${mainShield.name}：盾牌需有守護者【雙重盾牌】才能裝備於主手` });
    } else {
      const main = checkEquippable(mainShield, 'mainHand', profs, { isShield: true });
      if (!main.ok) issues.push({ level: 'error', message: `主手${mainShield.name}：${main.reason}` });
    }
  }
  if (offShield) {
    const off = checkEquippable(offShield, 'offHand', profs, { isShield: true });
    if (!off.ok) issues.push({ level: 'error', message: `副手${offShield.name}：${off.reason}` });
  } else if (offWeapon) {
    const off = checkEquippable(offWeapon, 'offHand', profs);
    if (!off.ok) issues.push({ level: 'error', message: `副手${offWeapon.name}：${off.reason}` });
  }
  if (armor) {
    const arm = checkEquippable(armor, 'armor', profs);
    if (!arm.ok) issues.push({ level: 'error', message: `${armor.name}：${arm.reason}` });
  }

  // 3. 起始預算（飾品為稀有物品，不計入）——與編輯器的追蹤條共用同一支函式
  const spent = totalStartingEquipCost(equipment, { weaponMap, shieldMap, armorMap, extraSpend });
  if (spent > budget) {
    issues.push({ level: 'error', message: `起始裝備花費 ${spent}z 超出 ${budget}z 預算` });
  }

  // 4. 查無此裝備
  const unknown = [];
  if (equipment.mainHand && !mainWeapon && !mainShield) unknown.push(`主手「${equipment.mainHand}」`);
  if (equipment.offHand && !offShield && !offWeapon) unknown.push(`副手「${equipment.offHand}」`);
  if (equipment.armor && !armor) unknown.push(`防具「${equipment.armor}」`);
  if (equipment.accessory && accessoryMap && !accessoryMap.get(equipment.accessory)) {
    unknown.push(`飾品「${equipment.accessory}」`);
  }
  if (unknown.length) {
    issues.push({ level: 'warn', message: `資料表中查無：${unknown.join('、')}（不計入預算，請確認是否為自訂名稱）` });
  }

  return issues;
};

// ─────────────────────────────────────────────────────────── 篩選與排序

/**
 * 篩選武器列。
 *
 * `showAll` 預設為 **false**：目前職業組合裝備不了的武器一律不顯示
 * （玩家不需要在 22 把武器裡自己挑出 10 把能用的），要看得勾選「顯示目前無法裝備的」。
 */
export const filterWeapons = (rows, filters = {}) => {
  const {
    category = '全部',
    range = '全部',
    hands = '全部',
    showAll = false,
    affordableOnly = false,
    query = ''
  } = filters;

  const q = query.trim().toLowerCase();

  return rows.filter((row) => {
    if (!showAll && !row.equippable.ok) return false;
    if (category !== '全部' && row.weapon.category !== category) return false;
    if (range !== '全部' && row.weapon.range !== range) return false;
    if (hands !== '全部' && Number(row.weapon.hands) !== Number(hands)) return false;
    if (affordableOnly && row.weapon.cost > row.remainingBudget) return false;
    if (q) {
      const hay = `${row.weapon.name} ${row.weapon.category} ${row.weapon.attr} ${row.weapon.damage}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
};

/** 可排序欄位。預設以「傷害加值」遞減——那是原書表上唯一能直接比較的數字 */
export const SORT_OPTIONS = [
  { key: 'damageBonus', label: '傷害加值', direction: 'desc' },
  { key: 'cost', label: '價格', direction: 'asc' },
  { key: 'category', label: '類別', direction: 'asc' },
  { key: 'name', label: '名稱', direction: 'asc' }
];

export const sortWeapons = (rows, sortKey = 'damageBonus', direction = 'desc') => {
  const dir = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va;
    let vb;
    switch (sortKey) {
      case 'damageBonus': va = a.eval.damageBonus; vb = b.eval.damageBonus; break;
      case 'cost': va = a.weapon.cost; vb = b.weapon.cost; break;
      case 'category': va = a.weapon.category; vb = b.weapon.category; break;
      default: va = a.weapon.name; vb = b.weapon.name;
    }
    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb), 'zh-Hant') * dir;
    }
    if (va === vb) return a.weapon.name.localeCompare(b.weapon.name, 'zh-Hant') * dir;
    return (va - vb) * dir;
  });
};
