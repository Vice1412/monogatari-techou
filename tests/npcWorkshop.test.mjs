/**
 * NPC 工坊引擎測試。
 *
 * 執行：`npm run test:npcworkshop`（已納入 `npm test` 串接）
 *
 * 為什麼要有這個檔案（2026-10-16 建立）：
 * `NPCWorkshop.jsx` 是 6,443 行的巨型檔案且**零測試護欄**（見
 * `docs/functional-audit-2026-10-16.md` §5）。拆檔之前必須先有護欄，
 * 否則「畫面悄悄變了但不會報錯」——正是 `AGENTS.md` §AW9 警告的型態。
 *
 * 本檔**不碰 UI**，只測 `utils/npcEngine.js` 與 `data/roles.js` 的純函式：
 * 配額、數值、物種相性、模板變數解析、戰鬥員轉換。這些是拆檔時最容易被
 * 搬錯、也最容易靜默壞掉的部分。
 *
 * ※ 本檔的期望值一律是**實測當下的行為**（快照護欄），不是我的推論。
 *   若某條與官方原書不符，會以 `★ 待核對` 明確標示，不擅自「修正」期望值。
 */
import {
  getDynamicValues,
  getInitialAffinities,
  getSpeciesAffinities,
  resolveTemplateVariables,
  calculateNpcBudgets,
  calculateNpcStats,
  createNewNPC,
  migrateNpcState,
  exportNpcToCombatant,
} from '../src/features/npc-workshop/utils/npcEngine.js';
import { ROLES_DATA, DAMAGE_TYPES } from '../src/features/npc-workshop/data/index.js';
import {
  getChineseKeyLabel,
  resolveTemplateVariablesForDisplay,
  getPlainText,
} from '../src/features/npc-workshop/utils/displayText.jsx';
import { buildNpcText } from '../src/features/npc-workshop/utils/npcTextExport.js';
import { THEMES } from '../src/features/npc-workshop/data/workshopThemes.js';
import fs from 'node:fs';

let pass = 0;
let fail = 0;
const lines = [];

/**
 * 正規化：遞迴排序物件鍵，但**保留陣列順序**。
 * 理由與 `tests/dataLayer.test.mjs` 相同——JS 物件的鍵序不具語意，
 * 用鍵序比較會讓測試因無關緊要的細節失敗。
 */
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc, k) => { acc[k] = canon(v[k]); return acc; }, {});
  }
  return v;
};

const check = (label, actual, expected) => {
  const a = JSON.stringify(canon(actual));
  const e = JSON.stringify(canon(expected));
  const ok = a === e;
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${e}\n          實得 ${a}`
  );
};

const section = (t) => lines.push(`\n=== ${t} ===`);

/** 建一個「乾淨的」NPC 物件，只覆寫測試關心的欄位。 */
const npc = (over = {}) => ({
  id: 'npc_test',
  name: '測試魔獸',
  role: '暴徒',
  level: 5,
  rank: '士兵',
  championMultiplier: 1,
  partyLevel: 5,
  selectedSpeciesId: null,
  speciesConfig: { selectedBenefits: [] },
  skills: [],
  affinities: getInitialAffinities(),
  customDice: {},
  overrideEnabled: false,
  ...over,
});

// ─────────────────────────────────────────────────────────── A
section('A. 動態數值（[少量]／[大量]／[巨量] 等依隊伍與 NPC 等級變動）');
{
  // 隊伍等級決定三檔基礎值
  check('隊伍 5 級', getDynamicValues(5, 5), {
    '[少量]': 10, '[大量]': 30, '[巨量]': 40, '[條件大量]': 10,
    '[消耗戰HP]': 5, '[消耗戰MP]': 10, '[臨時防禦]': 12, '[碾壓傷害]': 20,
  });
  check('隊伍 20 級', getDynamicValues(5, 20), {
    '[少量]': 20, '[大量]': 40, '[巨量]': 60, '[條件大量]': 20,
    '[消耗戰HP]': 5, '[消耗戰MP]': 10, '[臨時防禦]': 12, '[碾壓傷害]': 20,
  });
  check('隊伍 40 級', getDynamicValues(5, 40), {
    '[少量]': 30, '[大量]': 50, '[巨量]': 80, '[條件大量]': 30,
    '[消耗戰HP]': 5, '[消耗戰MP]': 10, '[臨時防禦]': 12, '[碾壓傷害]': 20,
  });

  // NPC 等級 30 是分水嶺
  const nl30 = getDynamicValues(30, 5);
  check('NPC 30 級：條件大量升級', nl30['[條件大量]'], 30);
  check('NPC 30 級：消耗戰 HP', nl30['[消耗戰HP]'], 10);
  check('NPC 30 級：消耗戰 MP', nl30['[消耗戰MP]'], 20);
  check('NPC 30 級：碾壓傷害', nl30['[碾壓傷害]'], 30);
  check('NPC 30 級：臨時防禦 12+1', nl30['[臨時防禦]'], 13);
  check('NPC 60 級：臨時防禦 12+3', getDynamicValues(60, 5)['[臨時防禦]'], 15);

  // 非數字一律退回 5 級，不得拋錯或回 NaN
  const bad = getDynamicValues('abc', 'abc');
  check('非法輸入退回 5 級', bad, getDynamicValues(5, 5));
  check('非法輸入無 NaN', Object.values(bad).some(Number.isNaN), false);
}

// ─────────────────────────────────────────────────────────── B
section('B. 初始屬性相性（九相，預設全為「一般」）');
{
  const init = getInitialAffinities();
  check('涵蓋九相', Object.keys(init).length, 9);
  check('九相與 DAMAGE_TYPES 一致', Object.keys(init).sort(), [...DAMAGE_TYPES].sort());
  check('全部為 normal', Object.values(init).every((v) => v === 'normal'), true);
}

// ─────────────────────────────────────────────────────────── C
section('C. 物種先天相性（官方：物種自帶抗性／免疫／弱點）');
{
  check('無物種 -> 空物件', getSpeciesAffinities(null, null), {});
  check('構造體：土抗性 + 毒免疫', getSpeciesAffinities('sp_construct', { selectedBenefits: [] }), { 土: 'res', 毒: 'imm' });
  check('構造體：額外弱點', getSpeciesAffinities('sp_construct', { selectedBenefits: [], sp_construct_extra_vul: '火' }), { 土: 'res', 毒: 'imm', 火: 'vul' });
  check('構造體：額外弱點為「無」時不加', getSpeciesAffinities('sp_construct', { selectedBenefits: [], sp_construct_extra_vul: '無' }), { 土: 'res', 毒: 'imm' });

  check('不死：暗免疫 + 毒免疫 + 光弱點', getSpeciesAffinities('sp_undead', { selectedBenefits: [] }), { 暗: 'imm', 毒: 'imm', 光: 'vul' });
  check('元素：毒免疫', getSpeciesAffinities('sp_element', { selectedBenefits: [] }), { 毒: 'imm' });

  // 惡魔的抗性欄位歷史上有「單一字串」與「陣列」兩種存法，兩者都要吃
  check('惡魔：單一字串抗性', getSpeciesAffinities('sp_demon', { selectedBenefits: [], sp_demon_resists: '火' }), { 火: 'res' });
  check('惡魔：陣列抗性', getSpeciesAffinities('sp_demon', { selectedBenefits: [], sp_demon_resists: ['火', '冰'] }), { 火: 'res', 冰: 'res' });
  check('惡魔：無抗性', getSpeciesAffinities('sp_demon', { selectedBenefits: [] }), {});

  check('類人：弱點', getSpeciesAffinities('sp_humanoid', { selectedBenefits: [], sp_humanoid_weakness: '光' }), { 光: 'vul' });
  check('類人：b1 才給抗性', getSpeciesAffinities('sp_humanoid', { selectedBenefits: [], sp_humanoid_resists: ['火'] }), {});
  check('類人：b1 給抗性', getSpeciesAffinities('sp_humanoid', { selectedBenefits: ['b1'], sp_humanoid_resists: ['火'] }), { 火: 'res' });

  check('植物：b2 才給抗性', getSpeciesAffinities('sp_plant', { selectedBenefits: [], sp_plant_weakness: '火', sp_plant_resists: ['冰'] }), { 火: 'vul' });
}

// ─────────────────────────────────────────────────────────── D
section('D. 模板變數解析（技能文字裡的 [少量] 與 {type}）');
{
  check('空字串 -> 空字串', resolveTemplateVariables('', {}), '');
  check('null -> 空字串', resolveTemplateVariables(null, {}), '');

  // 動態方括號依等級換成數字
  check('動態值：隊伍 5 級', resolveTemplateVariables('造成[少量]點傷害，[巨量]則…', {}, { npcLevel: 5, partyLevel: 5 }), '造成10點傷害，40則…');
  check('動態值：隊伍 20 級', resolveTemplateVariables('[少量]／[大量]／[巨量]', {}, { npcLevel: 5, partyLevel: 20 }), '20／40／60');
  check('動態值：NPC 30 級', resolveTemplateVariables('[碾壓傷害]／[消耗戰MP]', {}, { npcLevel: 30 }), '30／20');

  // 選擇槽
  check('選擇槽：已選', resolveTemplateVariables('選擇{type}', { type: '火' }), '選擇火');
  check('選擇槽：多選以 / 串接', resolveTemplateVariables('選擇{types}', { types: ['火', '冰'] }), '選擇火 / 冰');
  check('選擇槽：未選留空欄', resolveTemplateVariables('選擇{type}', {}), '選擇[ ___ ]');
  check('選擇槽：空陣列視為未選', resolveTemplateVariables('選擇{types}', { types: [] }), '選擇[ ___ ]');
  check('選擇槽：空字串視為未選', resolveTemplateVariables('選擇{type}', { type: '' }), '選擇[ ___ ]');

  // 多個槽一次換完
  check('多槽', resolveTemplateVariables('對{type}造成[大量]傷害（{distance}）', { type: '冰', distance: '遠程' }, { npcLevel: 5, partyLevel: 5 }), '對冰造成30傷害（遠程）');

  // 遞迴上限：不得無窮迴圈
  check('巢狀槽會迭代展開', resolveTemplateVariables('{a}', { a: '{b}', b: '完成' }), '完成');
  const deep = resolveTemplateVariables('{a}', { a: '{a}' }, { recursionLimit: 3 });
  check('自我引用不會無限迴圈', typeof deep, 'string');
}

// ─────────────────────────────────────────────────────────── E
section('E. NPC 數值計算（等級 × 階級 × 物種）');
{
  check('無 role -> 空物件', calculateNpcStats({ role: '不存在' }), {});
  check('null -> 空物件', calculateNpcStats(null), {});

  // 暴徒 30 級基準：官方表 hp 120 / mp 70 / acc 3 / dmg 5
  const brute30 = calculateNpcStats(npc({ level: 30 }));
  check('暴徒 30 級 HP', brute30.HP, 120);
  check('暴徒 30 級 MP', brute30.MP, 70);
  check('暴徒 30 級 命中', brute30.Acc, 3);
  check('暴徒 30 級 傷害', brute30.Dmg, 5);
  check('物防 = DEX 骰面 + 定位基礎', brute30.Def, 8);
  check('魔防 = INS 骰面 + 定位基礎', brute30.MDef, 8);
  check('先攻 = 定位基礎值', brute30.Init, 7);

  // 階級乘算
  check('精英：HP ×2', calculateNpcStats(npc({ level: 30, rank: '精英' })).HP, 240);
  check('精英：先攻 +2', calculateNpcStats(npc({ level: 30, rank: '精英' })).Init, 9);
  check('冠位 ×3：HP ×3', calculateNpcStats(npc({ level: 30, rank: '冠位', championMultiplier: 3 })).HP, 360);
  check('冠位 ×3：MP ×2', calculateNpcStats(npc({ level: 30, rank: '冠位', championMultiplier: 3 })).MP, 140);
  check('冠位 ×3：先攻 +3', calculateNpcStats(npc({ level: 30, rank: '冠位', championMultiplier: 3 })).Init, 10);
  check('冠位倍率非法 -> 視為 1', calculateNpcStats(npc({ level: 30, rank: '冠位', championMultiplier: 'x' })).HP, 120);

  // ★ 官方範例（NPC_WORKSHOP_REFACTOR_GUIDE.md §6 測試案例 1）
  //   等級 30、精英、構造體、暴徒。
  //   本檔只釘住「實測當下的行為」，不裁定對錯。
  //   ★ 待核對：該指南寫期望 HP 260（＝(基礎 120 + 客製化 10) × 精英 2）。
  //     但引擎的順序是「先乘階級、後加技能修正」，所以實得 250。
  //     客製化 +10 HP 是否應被階級倍率一起放大，需查《快速建構》官方原文才能定論。
  const officialBase = npc({ level: 30, rank: '精英', selectedSpeciesId: 'sp_construct' });
  check('官方範例：精英構造體暴徒 HP（無客製化）', calculateNpcStats(officialBase).HP, 240);
  check('官方範例：INS 提升為 d8', calculateNpcStats(officialBase).INS, 'd8');
  check('官方範例：先攻 7+2', calculateNpcStats(officialBase).Init, 9);
  check('官方範例：構造體自帶中毒免疫', calculateNpcStats(officialBase).statusImmunities, ['中毒']);

  const withCustom = { ...officialBase, skills: [{ id: 'brute_cust_0', source: 'customization', modifiers: { hp: 10 } }] };
  check('官方範例：加客製化 +10 HP 後為 250（非指南寫的 260）', calculateNpcStats(withCustom).HP, 250);
  check('士兵 + 客製化 = 130（無倍率時為純加算）', calculateNpcStats({ ...withCustom, rank: '士兵' }).HP, 130);

  // 物種 HP／MP 加成
  check('野獸 b1：HP +10', calculateNpcStats(npc({ level: 30, selectedSpeciesId: 'sp_beast', speciesConfig: { selectedBenefits: ['b1'] } })).HP, 130);
  check('野獸 b2：MP +10', calculateNpcStats(npc({ level: 30, selectedSpeciesId: 'sp_beast', speciesConfig: { selectedBenefits: ['b2'] } })).MP, 80);
  check('怪物 b5：HP +10', calculateNpcStats(npc({ level: 30, selectedSpeciesId: 'sp_monster', speciesConfig: { selectedBenefits: ['b5'] } })).HP, 130);
  check('植物 b3：MP +10', calculateNpcStats(npc({ level: 30, selectedSpeciesId: 'sp_plant', speciesConfig: { selectedBenefits: ['b3'] } })).MP, 80);

  // 物種狀態免疫
  check('植物：眩暈／動搖／憤怒免疫', calculateNpcStats(npc({ level: 30, selectedSpeciesId: 'sp_plant' })).statusImmunities, ['眩暈', '動搖', '憤怒']);
  check('構造體：中毒免疫', calculateNpcStats(npc({ level: 30, selectedSpeciesId: 'sp_construct' })).statusImmunities, ['中毒']);
  check('不死：中毒免疫', calculateNpcStats(npc({ level: 30, selectedSpeciesId: 'sp_undead' })).statusImmunities, ['中毒']);

  // 技能修正
  const withMods = calculateNpcStats(npc({
    level: 30,
    skills: [{ modifiers: { hp: 5, mp: 5, def: 2, mdef: 1, init: 1 } }],
  }));
  check('技能修正 HP', withMods.HP, 125);
  check('技能修正 MP', withMods.MP, 75);
  check('技能修正 物防', withMods.Def, 10);
  check('技能修正 魔防', withMods.MDef, 9);
  check('技能修正 先攻', withMods.Init, 8);

  // 手動覆寫優先於一切
  const over = calculateNpcStats(npc({
    level: 30,
    rank: '精英',
    overrideEnabled: true,
    overrides: { hp: 999, mp: 888, init: 7, def: 20, mdef: 21 },
  }));
  check('覆寫 HP', over.HP, 999);
  check('覆寫 MP', over.MP, 888);
  check('覆寫 先攻', over.Init, 7);
  check('覆寫 物防', over.Def, 20);
  check('覆寫 魔防', over.MDef, 21);
  check('未啟用覆寫時不生效', calculateNpcStats(npc({ level: 30, overrideEnabled: false, overrides: { hp: 999 } })).HP, 120);

  // 等級不在官方階梯上時退回 5 級（不拋錯）
  check('等級 7 退回 5 級表', calculateNpcStats(npc({ level: 7 })).HP, 70);
  check('等級 0 退回 5 級表', calculateNpcStats(npc({ level: 0 })).HP, 70);
}

// ─────────────────────────────────────────────────────────── F
section('F. 轉為戰鬥員（exportNpcToCombatant）');
{
  const c = exportNpcToCombatant(npc({ level: 30, rank: '精英', selectedSpeciesId: 'sp_construct' }));
  check('sourceType 為 npc', c.sourceType, 'npc');
  check('來源 id', c.sourceId, 'npc_test');
  check('HP 滿血', c.hp.current, 240);
  check('HP 上限', c.hp.max, 240);
  check('危機值 = 半血（無條件捨去）', c.hp.crisisThreshold, 120);
  check('MP 滿血', c.mp.current, 70);
  check('未行動', c.hasActed, false);
  check('六種狀態皆為 false', Object.values(c.statusEffects).every((v) => v === false), true);

  // 骰階轉為數字
  check('屬性轉數字：dex', c.attributes.dex, 8);
  check('屬性轉數字：mig', c.attributes.mig, 10);
  check('無 role 時給 0 而非 undefined', c.initiative, 9);

  // 技能被壓成最小欄位（廣播用），且一律未公開
  const withSkills = exportNpcToCombatant(npc({
    level: 5,
    skills: [{ id: 's1', name: '撲擊', category: 'attack', desc: '造成傷害' }],
  }));
  check('技能欄位集固定', Object.keys(withSkills.skills[0]).sort(), ['category', 'desc', 'id', 'isRevealed', 'name']);
  check('技能預設未公開', withSkills.skills[0].isRevealed, false);
  check('技能保留名稱', withSkills.skills[0].name, '撲擊');

  // 物種相性覆蓋 NPC 自身設定
  const merged = exportNpcToCombatant(npc({
    level: 30,
    selectedSpeciesId: 'sp_construct',
    affinities: { ...getInitialAffinities(), 土: 'vul', 火: 'res' },
  }));
  check('物種相性覆蓋 NPC 的同屬性設定', merged.affinities['土'], 'res');
  check('NPC 自己的其他相性保留', merged.affinities['火'], 'res');
  check('原始資料一併帶出（供本機檢視）', merged.rawNpcData.name, '測試魔獸');
}

// ─────────────────────────────────────────────────────────── G
section('G. 舊存檔遷移（migrateNpcState）');
{
  const fresh = migrateNpcState(null);
  check('null -> 建立新 NPC', fresh.role, '暴徒');
  check('新 NPC 有 id', typeof fresh.id === 'string' && fresh.id.length > 0, true);

  const partial = migrateNpcState({ role: '暴徒', level: 5 });
  check('補上 faction', partial.faction, '未分類');
  check('補上 tags', partial.tags, []);
  check('補上 affinities 九相', Object.keys(partial.affinities).length, 9);
  check('補上 customDice', partial.customDice, {});
  check('補上 villainTier', partial.villainTier, 'none');
  check('補上 id', typeof partial.id === 'string' && partial.id.length > 0, true);

  // 不得就地改動傳入的物件（遷移必須是純函式，否則會污染呼叫端 state）
  const original = { role: '暴徒', level: 5 };
  migrateNpcState(original);
  check('不就地改動傳入物件', Object.keys(original).sort(), ['level', 'role']);

  // 未知定位不得讓遷移爆掉
  const weird = migrateNpcState({ role: '不存在的定位', level: 5, skills: [] });
  check('未知定位仍可遷移', weird.role, '不存在的定位');
}

// ─────────────────────────────────────────────────────────── H
section('H. 配額：**實際生效**的那一套（roles.js 的 getAffinityBudgets）');
{
  // ※ 這是 UI 真正在用的來源（NPCWorkshop.jsx:2420）。
  //   每一條都是「官方快速建構」的配額表，動到就等於改了遊戲平衡，故全部釘死。
  const b = (role, lv, skills = []) => ROLES_DATA[role].getAffinityBudgets(lv, skills);

  check('暴徒 5 級', b('暴徒', 5), { vul: 2, res: 0, imm: 0, abs: 0 });
  check('暴徒 10 級解鎖 2 抗性', b('暴徒', 10), { vul: 2, res: 2, imm: 0, abs: 0 });
  check('暴徒 30 級解鎖 1 免疫', b('暴徒', 30), { vul: 2, res: 2, imm: 1, abs: 0 });

  check('獵人 5 級', b('獵人', 5), { vul: 1, res: 0, imm: 0, abs: 0 });
  check('獵人 30 級仍未解鎖', b('獵人', 30), { vul: 1, res: 0, imm: 0, abs: 0 });
  check('獵人 50 級解鎖 2 抗性（成長曲線不同）', b('獵人', 50), { vul: 1, res: 2, imm: 0, abs: 0 });

  check('法師 30 級解鎖 1 免疫', b('法師', 30), { vul: 1, res: 0, imm: 1, abs: 0 });
  check('破壞者 50 級解鎖 1 免疫', b('破壞者', 50), { vul: 1, res: 0, imm: 1, abs: 0 });

  check('衛士基礎弱點 2 個', b('衛士', 5).vul, 2);
  check('輔助基礎弱點 1 個', b('輔助', 5).vul, 1);

  // 技能修正：只有部分定位會讀 `skills` 參數（見下方 I 段的說明）
  check('法師：技能給額外抗性', b('法師', 5, [{ modifiers: { extraResistance: 2 } }]).res, 2);
  check('法師：技能給額外免疫', b('法師', 5, [{ modifiers: { extraImmunity: 1 } }]).imm, 1);
  check('輔助：技能給額外抗性', b('輔助', 5, [{ modifiers: { extraResistance: 2 } }]).res, 2);
  check('輔助：技能給額外免疫', b('輔助', 5, [{ modifiers: { extraImmunity: 1 } }]).imm, 1);
  check('衛士：技能給額外抗性', b('衛士', 5, [{ modifiers: { extraResistance: 2 } }]).res, 2);

  // ★ 已知不一致（見 I 段）：暴徒與獵人的版本**不讀** skills 參數
  check('暴徒：技能 modifier 目前不生效（已知不一致）', b('暴徒', 30, [{ modifiers: { extraResistance: 2 } }]).res, 2);
  check('獵人：技能 modifier 目前不生效（已知不一致）', b('獵人', 5, [{ modifiers: { extraResistance: 2 } }]).res, 0);

  // 六個定位都必須提供這個函式，否則 UI 會退回保守預設值
  const roles = Object.keys(ROLES_DATA);
  check('六個定位齊全', roles.length, 6);
  check('每個定位都有 getAffinityBudgets', roles.every((r) => typeof ROLES_DATA[r].getAffinityBudgets === 'function'), true);
}

// ─────────────────────────────────────────────────────────── I
section('I. ★ 死碼與分歧的護欄（calculateNpcBudgets）');
{
  // 背景（2026-10-16 健檢發現）：
  // `npcEngine.js` 的 `calculateNpcBudgets` 是**第二套**配額實作，
  // 但全 `src/` **零呼叫端**——UI 用的是 `roles.js` 的 `getAffinityBudgets`。
  //
  // 而且兩套的答案不一致：`calculateNpcBudgets` **完全不看技能的 modifiers**
  // （extraResistance／extraImmunity），所以它會漏算法師／衛士／輔助／破壞者
  // 由技能換來的配額。
  //
  // 危險之處：`NPC_WORKSHOP_REFACTOR_GUIDE.md` §4 明確指示「導出配額計算工具函數
  // calculateNpcBudgets」——**下一個照著那份指南做的人，會把錯的那一套接上去。**
  //
  // 本段刻意把「現況」與「分歧」都釘住：任何一方被改動都會在這裡叫。
  // 是否刪除／統整留給 GM 裁定（見 docs/functional-audit-2026-10-16.md）。
  const base = npc({ level: 30, role: '暴徒' });

  check('死碼仍存在（尚未裁定處置）', typeof calculateNpcBudgets, 'function');
  check('死碼：暴徒 30 級抗性上限', calculateNpcBudgets(base).resistances, { max: 2, used: 0 });
  check('死碼：暴徒 30 級免疫上限', calculateNpcBudgets(base).immunities, { max: 1, used: 0 });
  check('死碼：暴徒要求 2 個弱點', calculateNpcBudgets(base).weaknesses.min, 2);
  check('死碼：非暴徒要求 1 個弱點', calculateNpcBudgets(npc({ role: '法師', level: 30 })).weaknesses.min, 1);

  // 分歧點：技能 modifiers 完全不影響死碼的答案
  const withSkill = { ...base, skills: [{ modifiers: { extraResistance: 2, extraImmunity: 1 } }] };
  check('★ 分歧：死碼忽略技能 modifiers（抗性）', calculateNpcBudgets(withSkill).resistances.max, 2);
  check('★ 分歧：實際生效的版本會算進去', ROLES_DATA['法師'].getAffinityBudgets(5, [{ modifiers: { extraResistance: 2 } }]).res, 2);

  // 死碼的階級／等級加成（與 roles.js 的算法不同路徑，但結果需一致才有意義）
  check('死碼：精英 +1 定位技能', calculateNpcBudgets(npc({ level: 5, rank: '精英' })).roleSkills.max, 1);
  check('死碼：冠位 ×3 給 3 個', calculateNpcBudgets(npc({ level: 5, rank: '冠位', championMultiplier: 3 })).roleSkills.max, 3);
  check('死碼：20/40/60 級各 +1', calculateNpcBudgets(npc({ level: 60 })).roleSkills.max, 3);
  check('死碼：負面技能 +1', calculateNpcBudgets(npc({ level: 5, skills: [{ source: 'negativeSkill' }] })).roleSkills.max, 1);
  check('死碼：類人 +1', calculateNpcBudgets(npc({ level: 5, selectedSpeciesId: 'sp_humanoid' })).roleSkills.max, 1);
  check('死碼：物理弱點 +1', calculateNpcBudgets(npc({ level: 5, affinities: { ...getInitialAffinities(), 物理: 'vul' } })).roleSkills.max, 1);
  check('死碼：冠位 + 負面技能 = 2 個 Boss 技能', calculateNpcBudgets(npc({ level: 5, rank: '冠位', skills: [{ source: 'negativeSkill' }] })).bossSkills.max, 2);
  check('死碼：非冠位沒有 Boss 技能額度', calculateNpcBudgets(npc({ level: 5, rank: '精英' })).bossSkills.max, 0);
  check('死碼：null 輸入回保守預設', calculateNpcBudgets(null).roleSkills, { max: 0, used: 0 });

  // 已用配額的計數邏輯
  const counted = calculateNpcBudgets(npc({
    level: 5,
    skills: [
      { source: 'roleSkill' },
      { source: 'customization' },
      { category: 'boss', source: 'bossSkill' },
    ],
  }));
  check('死碼：已用定位技能', counted.roleSkills.used, 1);
  check('死碼：已用客製化', counted.customization.used, 1);
}

// ─────────────────────────────────────────────────────────── J. 同名函式分歧護欄
//
// 背景（2026-10-16 拆檔時發現）：`utils/npcEngine.js` 與 `NPCWorkshop.jsx`
// 原本各有一個 `resolveTemplateVariables`，**同名但行為不同**：
//   - npcEngine 版（匯出純文字用）：陣列接成 ' / '，且先把 [少量] 換成數字。
//   - NPCWorkshop 版（畫面顯示用）：陣列接成換行＋「●」，且不碰 [少量]。
// 只有 npcEngine 那份有測試，所以「測試全綠」時，畫面那一份壞掉也不會有人知道。
// 當時的處置是把 NPCWorkshop 那一份更名為 `resolveTemplateVariablesForDisplay`。
//
// 這一節就是那個處置的守門人：**如果有人日後把兩者「整理」成同一個名字、
// 或讓 NPCWorkshop 改去匯入 npcEngine 版，這裡會紅。**
{
  lines.push('');
  lines.push('J. 同名函式分歧護欄（防「合併重構」誤殺）');

  // J1/J2：先釘住 npcEngine 版的可觀察行為。
  check('npcEngine 版：陣列值以「 / 」串接', resolveTemplateVariables('{a}', { a: ['甲', '乙'] }), '甲 / 乙');
  check('npcEngine 版：會把 [少量] 代換成數字', resolveTemplateVariables('[少量]', {}, { npcLevel: 5, partyLevel: 5 }), '10');

  // J3-J6：再掃原始碼，確認「同名的另一份」沒有偷偷混回來。
  const workshopSrc = fs.readFileSync('src/features/npc-workshop/NPCWorkshop.jsx', 'utf8');
  const displaySrc = fs.readFileSync('src/features/npc-workshop/utils/displayText.jsx', 'utf8');

  check(
    '顯示用版本住在 displayText.jsx 且已更名為 ...ForDisplay',
    displaySrc.includes('export const resolveTemplateVariablesForDisplay'),
    true
  );
  check(
    'displayText.jsx 未再定義同名的 resolveTemplateVariables',
    !/const\s+resolveTemplateVariables\s*=/.test(displaySrc),
    true
  );
  check(
    'NPCWorkshop.jsx 也未定義同名的 resolveTemplateVariables',
    !/const\s+resolveTemplateVariables\s*=/.test(workshopSrc),
    true
  );

  const npcEngineImportLine = (workshopSrc.match(/import\s*\{[^}]*\}\s*from\s*'\.\/utils\/npcEngine'/s) || [''])[0];
  check(
    'NPCWorkshop 沒有匯入 npcEngine 的同名版本（避免兩份互相蓋掉）',
    npcEngineImportLine !== '' && !npcEngineImportLine.includes('resolveTemplateVariables'),
    true
  );

  // J7-J9：getDynamicValues 去重複（原本兩份逐字相同，測試只覆蓋 npcEngine 那份）。
  check(
    'NPCWorkshop 不再自帶一份 getDynamicValues',
    !/const\s+getDynamicValues\s*=/.test(workshopSrc),
    true
  );
  check(
    'displayText.jsx 也不再自帶一份 getDynamicValues',
    !/const\s+getDynamicValues\s*=/.test(displaySrc),
    true
  );
  check(
    'displayText.jsx 改為匯入 npcEngine 的 getDynamicValues',
    /import\s*\{[^}]*getDynamicValues[^}]*\}\s*from\s*'\.\/npcEngine'/.test(displaySrc),
    true
  );
}

// ─────────────────────────────────────────────────────────── K. 顯示用文字工具
//
// 這一段是「把函式抽出 `NPCWorkshop.jsx`」的**收益本身**（2026-10-16）。
// 抽出前這些函式埋在 6,400 行的元件檔裡，是純函式卻完全測不到；
// 現在可以直接餵字串、比字串。抽出不是為了好看，是為了能這樣測。
{
  lines.push('');
  lines.push('K. 顯示用文字工具（utils/displayText.jsx）');

  // 標籤解析：先查表，查不到才用關鍵字猜。
  check('getChineseKeyLabel：對照表命中', getChineseKeyLabel('distance'), '距離');
  check('getChineseKeyLabel：關鍵字退路（bg → 領域）', getChineseKeyLabel('sp_beast_bg'), '領域');
  check('getChineseKeyLabel：空值給「項目」', getChineseKeyLabel(''), '項目');

  // 顯示版模板代換。
  check('顯示版：單一變數', resolveTemplateVariablesForDisplay('{a}', { a: '甲' }), '甲');
  check(
    '顯示版：陣列接成換行＋「●」',
    resolveTemplateVariablesForDisplay('{a}', { a: ['甲', '乙'] }),
    '\n● 甲\n● 乙'
  );
  check('顯示版：未填的變數畫成空格提示', resolveTemplateVariablesForDisplay('{a}', {}), '[ ___ ]');
  // ★ 這一條是與 npcEngine 版的分界線：顯示版**不**碰 [少量]。
  check('顯示版：不代換 [少量]（交由 JSX 上色處理）', resolveTemplateVariablesForDisplay('[少量]', {}), '[少量]');

  // 純文字版（匯出／複製用）。
  check('純文字版：代換 [少量] 並補「點」', getPlainText('[少量]', {}, 5, 5), '10 點');
  check('純文字版：hideMeta 時整段 <meta> 連內容一起藏', getPlainText('<meta>隱藏</meta>可見', {}, 5, 5, true), '可見');
  check('純文字版：等級未達 <lv30+> 內容移除', getPlainText('<lv30+>強</lv30+>弱', {}, 5, 5), '弱');
  check('純文字版：等級達到 <lv30+> 內容保留', getPlainText('<lv30+>強</lv30+>弱', {}, 30, 5), '強弱');
}

// ─────────────────────────────────────────────────────────── L. 全文本輸出
//
// 這是拆檔第二批的**收益本身**（2026-10-16）：`handleCopyFullNpc` 原本是元件內
// 448 行的函式，**同時負責「組字串」與「複製到剪貼簿」**——有副作用、沒有回傳值，
// 所以完全無法被測試。抽出時刻意把它切成兩半：
//   - `buildNpcText(ctx, format)`：純函式，只回傳字串 ← 這裡測的就是它
//   - 剪貼簿與提示：留在呼叫端 `NPCWorkshop.jsx`
// 這正是 AGENTS.md §AW9 第 3 條「事件的邏輯要抽成純函式才測得到」的實作。
{
  lines.push('');
  lines.push('L. 全文本輸出 buildNpcText（utils/npcTextExport.js）');

  /** 建一個貼近真實的 ctx：state 用引擎產的，數值也真的算過。 */
  const mkCtx = (over = {}) => {
    const state = Object.assign(createNewNPC(), { name: '測試魔像' }, over.state || {});
    return Object.assign({
      state,
      revealLevel: 'full',
      currentTheme: THEMES.amber,
      mergedAffinities: { 物理: 'normal', 火: 'vul' },
      processedSkills: state.skills.map((s) => ({ ...s, isOverBudget: false })),
      calculateStats: () => calculateNpcStats(state),
      secretArtTarget: null,
    }, over);
  };

  const md = buildNpcText(mkCtx(), 'markdown');
  check('markdown：回傳字串', typeof md, 'string');
  check('markdown：含角色名', md.includes('### 測試魔像'), true);
  check('markdown：含等級', md.includes('Lv. 5'), true);
  check('markdown：HP 與 MP 在同一行', /HP:.*MP:/.test(md), true);

  // 格式真的分開：plain 不該有 Markdown 的粗體記號。
  const plain = buildNpcText(mkCtx(), 'plain');
  check('plain：不含 Markdown 粗體記號', plain.includes('**'), false);
  check('plain：與 markdown 內容不同', plain !== md, true);
  check('discord：回傳非空字串', buildNpcText(mkCtx(), 'discord').length > 0, true);

  // ccfolia 是「指令腳本」格式，最明顯的特徵是先攻檢定指令。
  check('ccfolia：含先攻檢定指令', buildNpcText(mkCtx(), 'ccfolia').includes('1d{DEX}+1d{INS}'), true);

  // 額度溢出（isOverBudget）的技能必須被排除——這是輸出正確性的核心。
  const withOver = mkCtx();
  withOver.processedSkills = [
    ...withOver.processedSkills,
    { id: 'x', originalName: '應被排除的技能', customName: '應被排除的技能', category: 'rule', isOverBudget: true, selections: {} },
  ];
  check('額度溢出的技能不會出現在輸出', buildNpcText(withOver, 'markdown').includes('應被排除的技能'), false);

  // 四個格式分支各自都有一份獨立的 `!isOverBudget` 過濾（markdown:425／plain:149／
  // discord:101／ccfolia:239）。只測 markdown 會漏掉另外三個——2026-10-16 做刻意破壞
  // 驗證時親眼看到：把 discord 分支的過濾改壞，測試仍然全綠。
  // 這裡改用「帶攻擊的溢額技能」，因為 ccfolia 分支只輸出 `s.attack` 存在的技能，
  // 不給 attack 的話那條斷言會恆真（假護欄）。
  const withOverAtk = mkCtx();
  withOverAtk.processedSkills = [
    ...withOverAtk.processedSkills,
    {
      id: 'z', originalName: '溢額攻擊技', customName: '溢額攻擊技',
      category: 'attack', isOverBudget: true, selections: {},
      attack: { distance: '近距離', formula: 'DEX+MIG', type: '物理', baseDmg: 5 },
    },
  ];
  ['plain', 'discord', 'ccfolia'].forEach((fmt) => {
    check(`${fmt}：溢額攻擊技不出現在輸出`, buildNpcText(withOverAtk, fmt).includes('溢額攻擊技'), false);
  });

  const withOk = mkCtx();
  withOk.processedSkills = [
    ...withOk.processedSkills,
    { id: 'y', originalName: '應出現的技能', customName: '應出現的技能', category: 'rule', isOverBudget: false, selections: {} },
  ];
  check('未溢出的技能會出現在輸出', buildNpcText(withOk, 'markdown').includes('應出現的技能'), true);

  // 揭露程度：等級 7 的版本必須比全開短（藏起來的區塊真的被藏起來）。
  const lv7 = buildNpcText(mkCtx({ revealLevel: '7' }), 'markdown');
  check('揭露程度 7 的輸出比全開短', lv7.length < md.length, true);

  // 尚未建立 NPC 時不輸出（與原本的 `if (!state) return;` 等價）。
  check('沒有 state 時回傳 undefined', buildNpcText(mkCtx({ state: null }), 'markdown'), undefined);
}

// ─────────────────────────────────────────────────────────── 結果
lines.push('\n' + '='.repeat(56));
lines.push(`  通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : `　失敗 ${fail}`}`);
lines.push('='.repeat(56));

console.log(lines.join('\n'));
if (fail > 0) process.exit(1);
