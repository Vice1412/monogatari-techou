import {
  DAMAGE_TYPES,
  ROLES_DATA,
  syncLevelPassives,
  SPECIES_DATA,
  stripLegacySentinel
} from '../data';
// 攻擊欄位的「選單 vs 寫死值」規則只有一份實作（2026-10-22，見 `docs/decisions.md` §BR）。
// 這裡只用到 `unfreezeAttackField`，且 `attackDisplay.js` 不 import 任何模組，無循環依賴。
import { unfreezeAttackField } from './attackDisplay';

/**
 * 舊版語意哨兵（U+26A1）。
 * 僅供遷移舊存檔使用；以跳脫序列表示，原始碼中不出現 Emoji 字面量（GEMINI.md 規則一軌道 3）。
 */
const LEGACY_OFFENSIVE_SENTINEL = '\u26A1';

export const getDynamicValues = (npcLevel, partyLevel = 5) => {
  const pl = parseInt(partyLevel) || 5;
  const nl = parseInt(npcLevel) || 5;

  let tier = 0;
  if (pl >= 40) tier = 2;
  else if (pl >= 20) tier = 1;

  let small, large, massive;
  if (tier === 0) { small = 10; large = 30; massive = 40; }
  else if (tier === 1) { small = 20; large = 40; massive = 60; }
  else { small = 30; large = 50; massive = 80; }

  const conditionLarge = nl >= 30 ? large : small;
  const attritionHp = nl >= 30 ? 10 : 5;
  const attritionMp = nl >= 30 ? 20 : 10;
  const tempDef = 12 + Math.floor(nl / 20);

  return {
    '[少量]': small,
    '[大量]': large,
    '[巨量]': massive,
    '[條件大量]': conditionLarge,
    '[消耗戰HP]': attritionHp,
    '[消耗戰MP]': attritionMp,
    '[臨時防禦]': tempDef,
    '[碾壓傷害]': nl >= 30 ? 30 : 20
  };
};

export const getInitialAffinities = () => {
  const init = {};
  DAMAGE_TYPES.forEach(type => { init[type] = 'normal'; });
  return init;
};

// ── 物種相性（唯一實作）──────────────────────────────────────────────
// 2026-10-21 階段 11 裁定：本檔這一份為準，`NPCWorkshop.jsx` 原本自帶的本地版已刪除。
// 兩份的差別只有「不死 b1」一處，而**差錯的是原本這一份**（把固定換暗寫成了讀
// `sp_undead_abs_choice`），詳見下方 `sp_undead` 分支的註解。
export const getSpeciesAffinities = (sid, sCfg) => {
  const affs = {};
  if (!sid || !sCfg) return affs;
  const sBenefits = sCfg.selectedBenefits || [];

  if (sid === 'sp_construct') {
    affs['土'] = 'res';
    affs['毒'] = 'imm';
    if (sCfg.sp_construct_extra_vul && sCfg.sp_construct_extra_vul !== '無') {
      affs[sCfg.sp_construct_extra_vul] = 'vul';
    }
  }

  if (sid === 'sp_demon') {
    const res = Array.isArray(sCfg.sp_demon_resists) ? sCfg.sp_demon_resists : (sCfg.sp_demon_resists ? [sCfg.sp_demon_resists] : []);
    res.forEach(t => { affs[t] = 'res'; });
    if (sBenefits.includes('b1') && sCfg.sp_demon_abs_choice) {
      affs[sCfg.sp_demon_abs_choice] = 'abs';
    }
  }

  if (sid === 'sp_element') {
    affs['毒'] = 'imm';
    if (sCfg.sp_element_immune) affs[sCfg.sp_element_immune] = 'imm';
    if (sCfg.sp_element_extra_vul && sCfg.sp_element_extra_vul !== '無') {
      affs[sCfg.sp_element_extra_vul] = 'vul';
    }
    if (sBenefits.includes('b1') && sCfg.sp_element_abs_choice) {
      if (sCfg.sp_element_abs_choice === '連結於免疫') {
        if (sCfg.sp_element_immune) affs[sCfg.sp_element_immune] = 'abs';
      } else {
        affs[sCfg.sp_element_abs_choice] = 'abs';
      }
    }
  }

  if (sid === 'sp_humanoid') {
    if (sCfg.sp_humanoid_weakness) affs[sCfg.sp_humanoid_weakness] = 'vul';
    if (sBenefits.includes('b1')) {
      const res = sCfg.sp_humanoid_resists || [];
      res.forEach(t => { affs[t] = 'res'; });
    }
  }

  if (sid === 'sp_monster') {
    if (sBenefits.includes('b1')) {
      const res = sCfg.sp_monster_resists || [];
      res.forEach(t => { affs[t] = 'res'; });
    }
  }

  if (sid === 'sp_plant') {
    if (sCfg.sp_plant_weakness) affs[sCfg.sp_plant_weakness] = 'vul';
    if (sBenefits.includes('b2')) {
      const res = sCfg.sp_plant_resists || [];
      res.forEach(t => { affs[t] = 'res'; });
    }
  }

  if (sid === 'sp_undead') {
    affs['光'] = 'vul';
    affs['暗'] = 'imm';
    affs['毒'] = 'imm';
    if (sCfg.sp_undead_extra_vul && sCfg.sp_undead_extra_vul !== '無') affs[sCfg.sp_undead_extra_vul] = 'vul';
    // b1 的原文（`data/speciesData.js:163`）是「將對暗傷害的免疫替換為對暗傷害的吸收」——
    // 固定換「暗」，沒有選擇項。這裡原本寫成 `sCfg.sp_undead_abs_choice`，
    // 而不死物種根本沒有這個 key（物種資料與 UI 都沒有），於是選了 b1 之後
    // 卡面（`NPCCardPreview` 走的就是這一份）仍然顯示「免疫」——選了等於沒選。
    // 2026-10-21 階段 11 裁定：以原書為準，固定換暗。
    if (sBenefits.includes('b1')) affs['暗'] = 'abs';
  }

  return affs;
};

export const resolveTemplateVariables = (text, selections, options = {}) => {
  if (!text) return "";
  const { recursionLimit = 3, npcLevel = 5, partyLevel = 5 } = options;

  let resolved = text;

  // Replace dynamic bracket values first (e.g. [少量], [大量], [巨量], [碾壓傷害])
  const dyn = getDynamicValues(npcLevel, partyLevel);
  Object.keys(dyn).forEach(k => {
    resolved = resolved.replaceAll(k, `${dyn[k]}`);
  });

  let loopCount = 0;
  while (resolved.includes('{') && loopCount < recursionLimit) {
    resolved = resolved.replace(/\{([^}]+)\}/g, (match, key) => {
      let val = selections?.[key];
      if (val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) return `[ ___ ]`;
      if (Array.isArray(val)) {
        return val.join(' / ');
      }
      return val;
    });
    loopCount++;
  }
  return resolved;
};

export const calculateNpcBudgets = (npc) => {
  if (!npc) return {
    roleSkills: { max: 0, used: 0 },
    customization: { max: 1, used: 0 },
    bossSkills: { max: 0, used: 0 },
    resistances: { max: 0, used: 0 },
    immunities: { max: 0, used: 0 },
    weaknesses: { min: 1, current: 0 }
  };

  const lvl = parseInt(npc.level) || 5;
  const rank = npc.rank || '士兵';

  // 1. Rank Bonus
  let rankBonus = 0;
  if (rank === '精英') rankBonus = 1;
  else if (rank === '冠位') rankBonus = Math.max(1, parseInt(npc.championMultiplier) || 1);

  // 2. Level Bonus
  let levelBonus = 0;
  if (lvl >= 20) levelBonus += 1;
  if (lvl >= 40) levelBonus += 1;
  if (lvl >= 60) levelBonus += 1;

  // 3. Negative Skill Bonus
  const skills = npc.skills || [];
  const hasNegativeSkill = skills.some(s => s.source === 'negativeSkill' || s.category === 'negative');
  const negBonus = hasNegativeSkill ? 1 : 0;

  // 4. Species Bonus
  let speciesBonus = 0;
  const sid = npc.selectedSpeciesId;
  const sBenefits = npc.speciesConfig?.selectedBenefits || [];
  if (sid === 'sp_humanoid') {
    speciesBonus += 1; // Humanoid inherent bonus
  }
  if (sid === 'sp_beast' && sBenefits.includes('b5')) speciesBonus += sBenefits.filter(b => b === 'b5').length;
  if (sid === 'sp_construct' && sBenefits.includes('b4')) speciesBonus += 1;
  if (sid === 'sp_demon' && sBenefits.includes('b4')) speciesBonus += 1;
  if (sid === 'sp_element' && sBenefits.includes('b4')) speciesBonus += 1;
  if (sid === 'sp_humanoid' && sBenefits.includes('b5')) speciesBonus += sBenefits.filter(b => b === 'b5').length;
  if (sid === 'sp_monster' && sBenefits.includes('b4')) speciesBonus += 1;
  if (sid === 'sp_plant' && sBenefits.includes('b4')) speciesBonus += 1;
  if (sid === 'sp_undead' && sBenefits.includes('b4')) speciesBonus += 1;

  // 5. Weakness Bonus (Physical vulnerability gives +1 skill)
  const weaknessBonus = (npc.affinities && npc.affinities['物理'] === 'vul') ? 1 : 0;

  const totalRoleSkills = rankBonus + levelBonus + negBonus + speciesBonus + weaknessBonus;

  // Used role skills count
  const usedRoleSkills = skills.filter(s =>
    s.source === 'roleSkill' ||
    s.isRoleSkill ||
    (s.category === 'rule' && s.source !== 'customization' && s.source !== 'negativeSkill' && s.source !== 'levelPassive' && s.source !== 'bossSkill')
  ).length;

  // Customization
  const usedCustomization = skills.filter(s => s.source === 'customization').length;

  // Boss Skills
  const maxBossSkills = rank === '冠位' ? (1 + (hasNegativeSkill ? 1 : 0)) : 0;
  const usedBossSkills = skills.filter(s => s.category === 'boss' || s.source === 'bossSkill').length;

  // Resistances and Immunities
  let maxRes = 0;
  let maxImm = 0;
  if (npc.role === '獵人') {
    if (lvl >= 50) maxRes = 2;
  } else {
    if (lvl >= 10) maxRes = 2;
    if (lvl >= 30) maxImm = 1;
  }

  const speciesAffs = getSpeciesAffinities(sid, npc.speciesConfig);
  let usedRes = 0;
  let usedImm = 0;
  let currentVul = 0;

  DAMAGE_TYPES.forEach(type => {
    const userAff = npc.affinities?.[type] || 'normal';
    const specAff = speciesAffs[type];

    if (userAff === 'res' && specAff !== 'res') usedRes++;
    if (userAff === 'imm' && specAff !== 'imm') usedImm++;
    if (userAff === 'vul') currentVul++;
  });

  const requiredVul = npc.role === '暴徒' ? 2 : 1;

  return {
    roleSkills: { max: totalRoleSkills, used: usedRoleSkills },
    customization: { max: 1, used: usedCustomization },
    bossSkills: { max: maxBossSkills, used: usedBossSkills },
    resistances: { max: maxRes, used: usedRes },
    immunities: { max: maxImm, used: usedImm },
    weaknesses: { min: requiredVul, current: currentVul }
  };
};

export const calculateNpcStats = (npc) => {
  if (!npc || !npc.role || !ROLES_DATA[npc.role]) return {};
  const roleData = ROLES_DATA[npc.role];
  const lvlData = roleData.levels[npc.level] || roleData.levels[5];

  const defaultDEX = lvlData.dex || roleData.base.DEX;
  const defaultINS = lvlData.ins || roleData.base.INS;
  const defaultMIG = lvlData.mig || roleData.base.MIG;
  const defaultWLP = lvlData.wlp || roleData.base.WLP;

  const customDice = npc.customDice || {};
  const isFree = npc.isFreeModeEnabled;

  const finalDEX = (isFree && customDice.DEX) ? customDice.DEX : defaultDEX;
  const finalINS = (isFree && customDice.INS) ? customDice.INS : defaultINS;
  const finalMIG = (isFree && customDice.MIG) ? customDice.MIG : defaultMIG;
  const finalWLP = (isFree && customDice.WLP) ? customDice.WLP : defaultWLP;

  const parseDice = d => parseInt(String(d).replace('d', ''), 10) || 8;
  const defMIGVal = parseDice(defaultMIG);
  const effMIGVal = parseDice(finalMIG);
  const defWLPVal = parseDice(defaultWLP);
  const effWLPVal = parseDice(finalWLP);
  const effDEXVal = parseDice(finalDEX);
  const effINSVal = parseDice(finalINS);

  let baseHP = lvlData.hp + (effMIGVal - defMIGVal) * 5;
  let baseMP = lvlData.mp + (effWLPVal - defWLPVal) * 5;

  let stats = {
    DEX: finalDEX,
    INS: finalINS,
    MIG: finalMIG,
    WLP: finalWLP,
    HP: baseHP,
    MP: baseMP,
    Init: roleData.base.initBase,
    Def: effDEXVal + roleData.base.def,
    MDef: effINSVal + roleData.base.mdef,
    Acc: lvlData.acc,
    Dmg: lvlData.dmg,
    MagicAccModifier: 0,
    statusImmunities: [],
    spellList: []
  };

  if (npc.rank === "精英") {
    stats.HP *= 2;
    stats.Init += 2;
  } else if (npc.rank === "冠位") {
    const mult = Math.max(1, parseInt(npc.championMultiplier) || 1);
    stats.HP *= mult;
    stats.MP *= 2;
    stats.Init += mult;
  }

  // Species adjustments
  if (npc.selectedSpeciesId) {
    const sid = npc.selectedSpeciesId;
    const sCfg = npc.speciesConfig || {};
    const sBenefits = sCfg.selectedBenefits || [];

    if (sid === 'sp_beast' && sBenefits.includes('b1')) stats.HP += 10;
    if (sid === 'sp_monster' && sBenefits.includes('b5')) stats.HP += 10;
    if (sid === 'sp_plant' && sBenefits.includes('b1')) stats.HP += 10;

    const mpBenefitIds = {
      sp_beast: ['b2'], sp_demon: ['b2'], sp_element: ['b2'],
      sp_humanoid: ['b2'], sp_monster: ['b2'], sp_plant: ['b3'], sp_undead: ['b2']
    };
    if (mpBenefitIds[sid]?.some(id => sBenefits.includes(id))) stats.MP += 10;

    if (sid === 'sp_plant') stats.statusImmunities.push('眩暈', '動搖', '憤怒');
    if (['sp_construct', 'sp_element', 'sp_undead'].includes(sid)) stats.statusImmunities.push('中毒');

    if (sid === 'sp_construct' && sBenefits.includes('b1')) {
      const chosen = sCfg.sp_construct_imm_status || [];
      chosen.forEach(s => {
        if (s && !stats.statusImmunities.includes(s)) stats.statusImmunities.push(s);
      });
    }
  }

  // Skills passive modifiers
  const skills = npc.skills || [];
  skills.forEach(skill => {
    if (skill.source === 'levelPassive') {
      if (skill.libId === "sab_p10" && skill.selections) {
        if (skill.selections.bonus === "命中檢定") stats.Acc += 3;
        if (skill.selections.bonus === "施法檢定") stats.MagicAccModifier += 3;
      }
      if (skill.libId === "hun_p10") stats.Acc += 3;
    }
    if (skill.modifiers) {
      if (skill.modifiers.hp) stats.HP += skill.modifiers.hp;
      if (skill.modifiers.mp) stats.MP += skill.modifiers.mp;
      if (skill.modifiers.def) stats.Def += skill.modifiers.def;
      if (skill.modifiers.mdef) stats.MDef += skill.modifiers.mdef;
      if (skill.modifiers.init) stats.Init += skill.modifiers.init;
      if (skill.modifiers.magicAcc) stats.MagicAccModifier += skill.modifiers.magicAcc;
    }
    if (skill.selectionsConfig && skill.selections) {
      skill.selectionsConfig.forEach(cfg => {
        const val = skill.selections[cfg.key];
        if (val && cfg.key.startsWith('imm') && !stats.statusImmunities.includes(val) && val !== "無") {
          stats.statusImmunities.push(val);
        }
      });
    }
  });

  if (npc.overrideEnabled && npc.overrides) {
    if (npc.overrides.hp) stats.HP = npc.overrides.hp;
    if (npc.overrides.mp) stats.MP = npc.overrides.mp;
    if (npc.overrides.init) stats.Init = npc.overrides.init;
    if (npc.overrides.def) stats.Def = npc.overrides.def;
    if (npc.overrides.mdef) stats.MDef = npc.overrides.mdef;
  }

  return stats;
};

export const createNewNPC = () => {
  let initialSkills = ROLES_DATA["暴徒"].defaultSkills.map(s => ({
    ...s,
    id: `${s.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    libId: s.id,
    isDefault: true
  }));
  initialSkills = syncLevelPassives("暴徒", 5, initialSkills);

  return {
    id: `npc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: "新創魔獸 / NPC",
    faction: "未分類",
    tags: ["野生魔獸"],
    traits: "兇猛、野性、敏銳",
    story: "",
    tactics: "優先攻擊落單或脆弱的敵人。",
    role: "暴徒",
    level: 5,
    rank: "士兵",
    championMultiplier: 1,
    partyLevel: 5,
    villainTier: "none",
    avatarBase64: null,
    avatarScale: 1,
    avatarFit: 'cover',
    avatarOffsetX: 0,
    avatarOffsetY: 0,
    skills: initialSkills,
    selectedSpeciesId: 'sp_beast',
    speciesConfig: { selectedBenefits: [] },
    overrideEnabled: false,
    overrides: { hp: 0, mp: 0, init: 0, def: 0, mdef: 0 },
    affinities: getInitialAffinities(),
    customDice: {},
    isFreeModeEnabled: false,
    updatedAt: new Date().toISOString()
  };
};

/**
 * 階段 1 遷移：清除舊存檔中的閃電語意哨兵（U+26A1），改由結構化 `isOffensive` 欄位表達。
 *
 * 舊存檔可能以三種形式攜帶哨兵：
 *   1. 技能名稱（`customName` / `originalName`）
 *   2. 咒語書選項（`spellConfig.options`）與已選咒語（`selectedSpells[].name`）
 *   3. 物種咒語（`speciesConfig.spell` 與 `speciesConfig.spellSelections` 的鍵）
 *
 * 純讀取路徑已由 `stripLegacySentinel` 容忍哨兵，但**名稱等值比較**
 * （如 `stats.spellList.some(s => s.name === spellName)`）必須靠本函式正規化，
 * 否則會產生重複咒語項目。
 *
 * @param {object} npc - NPC 狀態物件（不會被就地修改）
 * @returns {object} 已正規化的新物件
 */
export const migrateSpellSentinel = (npc) => {
  if (!npc || typeof npc !== 'object') return npc;
  const out = { ...npc };
  const hasSentinel = (v) => typeof v === 'string' && v.includes(LEGACY_OFFENSIVE_SENTINEL);

  // 1) 技能：名稱、咒語書選項、已選咒語
  if (Array.isArray(out.skills)) {
    out.skills = out.skills.map((sk) => {
      if (!sk || typeof sk !== 'object') return sk;
      const next = { ...sk };
      const wasOffensive = hasSentinel(next.customName) || hasSentinel(next.originalName);

      if (hasSentinel(next.customName)) next.customName = stripLegacySentinel(next.customName);
      if (hasSentinel(next.originalName)) next.originalName = stripLegacySentinel(next.originalName);

      if (next.spellConfig && Array.isArray(next.spellConfig.options)) {
        next.spellConfig = {
          ...next.spellConfig,
          options: next.spellConfig.options.map((o) => (hasSentinel(o) ? stripLegacySentinel(o) : o))
        };
      }

      if (Array.isArray(next.selectedSpells)) {
        next.selectedSpells = next.selectedSpells.map((sp) => {
          if (typeof sp === 'string') return hasSentinel(sp) ? stripLegacySentinel(sp) : sp;
          if (sp && typeof sp === 'object' && hasSentinel(sp.name)) return { ...sp, name: stripLegacySentinel(sp.name) };
          return sp;
        });
      }

      // 舊資料僅以哨兵表達攻擊性者，補上結構化欄位
      if (wasOffensive) {
        next.spellData = { ...(next.spellData || {}), isOffensive: true };
      }
      return next;
    });
  }

  // 2) 物種設定：咒語選擇與其 selections 的鍵
  if (out.speciesConfig && typeof out.speciesConfig === 'object') {
    const sc = { ...out.speciesConfig };
    Object.keys(sc).forEach((k) => {
      if (hasSentinel(sc[k])) sc[k] = stripLegacySentinel(sc[k]);
    });
    if (sc.spellSelections && typeof sc.spellSelections === 'object') {
      const nextSel = {};
      Object.entries(sc.spellSelections).forEach(([k, v]) => {
        nextSel[hasSentinel(k) ? stripLegacySentinel(k) : k] = v;
      });
      sc.spellSelections = nextSel;
    }
    out.speciesConfig = sc;
  }

  return out;
};

// ── 存檔遷移（唯一實作）──────────────────────────────────────────────
// 2026-10-21 階段 11 裁定：本檔這一份為準，`NPCWorkshop.jsx` 原本自帶的本地版已刪除。
//
// 為什麼要裁定：兩份並存時，同一張卡會依「誰先載入」而遷移成不同形狀——
// 工坊走本地版（補齊形狀、修舊技能 id、補齊定位預設技能），戰鬥房間走這一份（只補
// `affinities`／`customDice`／`villainTier`）。於是 `skills: undefined` 的壞卡在工坊裡
// 打得開，被 `CombatTracker` 載到就是 `reading 'map'`。這與 `getDynamicValues` 那次
// 收斂（見 `NPCWorkshop.jsx:73`）是同一個病：**測試綠燈只保證被測到的那一份正確。**
//
// 取捨：以本地版為主體（它才是 2026-10-21 階段 10 補過形狀保證的那一份），
// 併入本檔原本多出來的三件事——`!npc` 回傳全新卡、補 `id`、`faction` 預設「未分類」。
export const migrateNpcState = (npc) => {
  if (!npc || typeof npc !== 'object') return createNewNPC();
  const migrated = migrateSpellSentinel({ ...npc });

  // 0. 形狀保證（2026-10-21，階段 10）。
  //    舊檔、手改過的備份檔、被外部工具截斷的卡都可能缺欄位，或把陣列存成 null。
  //    以前這裡只補 `affinities` 與 `customDice`，於是 `skills: undefined` 一路活到
  //    編輯頁的 `.map`，一按「編輯」就是全頁 ErrorBoundary，而訊息只寫
  //    「Cannot read properties of undefined (reading 'map')」——看不出是哪張卡、哪個欄位。
  //    這裡只補型別、不動既有的合法值；補完之後下游才敢用 `.map`／`.filter`。
  const asArray = (v) => (Array.isArray(v) ? v : []);
  const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  ['skills', 'linkedNpcs', 'selectedNegativeSkills', 'selectedBossSkills', 'customRules', 'tags']
    .forEach((k) => { migrated[k] = asArray(migrated[k]); });
  ['speciesConfig', 'customDice', 'attributes'].forEach((k) => { migrated[k] = asObject(migrated[k]); });
  migrated.overrides = { hp: 0, mp: 0, init: 0, def: 0, mdef: 0, ...asObject(migrated.overrides) };
  ['name', 'traits', 'story', 'tactics', 'faction'].forEach((k) => {
    if (typeof migrated[k] !== 'string') migrated[k] = k === 'name' ? '未命名實體' : '';
  });
  // 職業與等級是整份面板的索引鍵：認不得的職業會讓右側每一步都讀到 undefined。
  // 但**只補缺、不改寫既有的值**——`role` 是字串就原樣留著，即使本版不認識它。
  // （`tests/npcWorkshop.test.mjs` G 段有一條「未知定位仍可遷移」在守這件事；
  //  真正該修的是渲染端：`case 4` 的兩個 `ROLES_DATA[state.role].availableSkills`
  //  已於 2026-10-21 階段 11 改成 `?.` ＋ 空陣列回退，所以未知定位不再崩頁。）
  if (typeof migrated.role !== 'string' || !migrated.role) migrated.role = '暴徒';
  const lv = Number(migrated.level);
  if (!Number.isFinite(lv) || lv <= 0) migrated.level = 5;
  if (!migrated.rank) migrated.rank = '士兵';

  if (!migrated.id) migrated.id = `npc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  if (!migrated.faction) migrated.faction = "未分類";
  if (!migrated.affinities) migrated.affinities = getInitialAffinities();
  else if (typeof migrated.affinities.vulnerabilities === 'string') migrated.affinities = getInitialAffinities();
  if (!migrated.villainTier) migrated.villainTier = "none";
  if (migrated.avatarScale === undefined) migrated.avatarScale = 1;
  if (!migrated.avatarFit) migrated.avatarFit = 'cover';
  if (migrated.avatarOffsetX === undefined) migrated.avatarOffsetX = 0;
  if (migrated.avatarOffsetY === undefined) migrated.avatarOffsetY = 0;

  if (migrated.role && ROLES_DATA[migrated.role]) {
    // 1. Repair: Ensure skills that look like defaults (legacy) have libId and isDefault
    migrated.skills = migrated.skills.map((s) => {
      // Legacy skills might have id 'b1', 'b2' but no libId or isDefault flag
      if (s && !s.libId && s.id && /^[bhmu][1-9]$/.test(s.id)) {
        return { ...s, libId: s.id, isDefault: true };
      }
      return s;
    }).filter((s) => s && typeof s === 'object');

    // 2. Sync level passives
    migrated.skills = syncLevelPassives(migrated.role, migrated.level || 5, migrated.skills);

    // 3. Ensure all default skills for current role exist
    ROLES_DATA[migrated.role].defaultSkills.forEach((ds) => {
      if (!migrated.skills.some((s) => s.libId === ds.id)) {
        migrated.skills.push({ ...ds, id: `${ds.id}_${Date.now()}`, libId: ds.id, isDefault: true });
      }
    });

    // 4. Final safety: Deduplicate default skills by libId (keep the first one found)
    const seenLibIds = new Set();
    migrated.skills = migrated.skills.filter((s) => {
      if (s.libId && /^[bhmu][1-9]$/.test(s.libId)) {
        if (seenLibIds.has(s.libId)) return false;
        seenLibIds.add(s.libId);
      }
      return true;
    });
  }

  // 5. 清掉舊版「凍結」在資料裡的攻擊欄位（2026-10-22，見 `docs/decisions.md` §BR／§BU）。
  //    舊版編輯面板會把字面值寫進 `attack.distance`／`formula`／`type`，那個值之後
  //    永遠蓋掉卡片選單——使用者看到的是「選了屬性卻不跟著、存檔後鎖死」。
  //    顯示端（`resolveAttack`）早就以選單為準，所以這一步**不改變任何畫面**，
  //    只是把資料清乾淨，免得下一個人打開備份檔還以為那裡的值有意義。
  //
  //    ※ 刻意比存檔路徑**保守**：只在「該欄位確實有選值」時才還原成 `{key}`。
  //      若選單是空的（例：使用者從沒選過距離），寫死的 `近戰` 是畫面上唯一的值，
  //      把它換成佔位符會讓卡片從「近戰」變成「待配置項目」——那是**畫面退化**，
  //      不是清理。存檔路徑不設這個條件，因為那是使用者自己按的動作，而且編輯面板
  //      就擺著一個空白的「選擇」下拉，狀態是可見的。
  migrated.skills = migrated.skills.map((s) => {
    if (!s || !s.attack || !Array.isArray(s.selectionsConfig)) return s;
    const next = { ...s.attack };
    let changed = false;
    ['distance', 'formula', 'type'].forEach((key) => {
      const picked = s.selections?.[key];
      if (picked === undefined || picked === null || picked === '') return;
      const unfrozen = unfreezeAttackField(s.attack[key], key, s.selectionsConfig);
      if (unfrozen !== s.attack[key]) {
        next[key] = unfrozen;
        changed = true;
      }
    });
    return changed ? { ...s, attack: next } : s;
  });

  return migrated;
};

// Convert NPC to Combatant specification for Combat Room
export const exportNpcToCombatant = (npc) => {
  const stats = calculateNpcStats(npc);
  const maxHp = stats.HP || 50;
  const maxMp = stats.MP || 30;

  // Species-derived affinities merge
  const speciesAffs = getSpeciesAffinities(npc.selectedSpeciesId, npc.speciesConfig);
  const finalAffs = { ...npc.affinities, ...speciesAffs };

  return {
    instanceId: `comb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sourceId: npc.id,
    sourceType: 'npc',
    name: npc.name || 'NPC',
    avatar: npc.avatarBase64 || null,
    faction: npc.faction || '敵方',
    level: npc.level || 5,
    rank: npc.rank || '士兵',
    role: npc.role || '暴徒',
    species: npc.selectedSpeciesId ? (SPECIES_DATA.find(s => s.id === npc.selectedSpeciesId)?.name || '未知') : '無',
    hp: {
      current: maxHp,
      max: maxHp,
      crisisThreshold: Math.floor(maxHp / 2)
    },
    mp: {
      current: maxMp,
      max: maxMp
    },
    attributes: {
      dex: parseInt(String(stats.DEX).replace('d', '')) || 8,
      ins: parseInt(String(stats.INS).replace('d', '')) || 8,
      mig: parseInt(String(stats.MIG).replace('d', '')) || 8,
      wlp: parseInt(String(stats.WLP).replace('d', '')) || 8
    },
    defense: stats.Def || 8,
    magicDefense: stats.MDef || 8,
    initiative: stats.Init || 0,
    hasActed: false,
    statusEffects: {
      slow: false,
      dazed: false,
      weak: false,
      shaken: false,
      enraged: false,
      poisoned: false
    },
    statusImmunities: stats.statusImmunities || [],
    affinities: finalAffs,
    skills: (npc.skills || []).map(sk => ({
      id: sk.id,
      name: sk.name || sk.skillName || '招式',
      category: sk.category || 'attack',
      desc: sk.desc || sk.customDesc || '',
      isRevealed: false // GM can reveal skills step by step to players in combat!
    })),
    rawNpcData: npc
  };
};
