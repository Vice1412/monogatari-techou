/**
 * NPC 助手：自訂能力擴充、自由模式、Quick Assembly 原書校準與匯出防退化護欄。
 *
 * 執行：npm run test:npccustom
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getDynamicValues,
  calculateNpcStats,
  calculateNpcBudgets,
  getInitialAffinities,
  exportNpcToCombatant,
  moveCustomSkill,
  duplicateCustomSkill,
  convertSkillCategory,
  getFreeModeDeviations,
  hasNumericOverride,
} from '../src/features/npc-workshop/utils/npcEngine.js';
import { buildNpcText, parseFormulaToCcfoliaDice } from '../src/features/npc-workshop/utils/npcTextExport.js';
import { SPECIES_DATA, SPELLS_DATA } from '../src/features/npc-workshop/data/index.js';
import EditableSkill from '../src/features/npc-workshop/components/EditableSkill.jsx';
import NPCWorkshop from '../src/features/npc-workshop/NPCWorkshop.jsx';

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 1440,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
}

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, cond, detail = '') => {
  if (cond) {
    pass += 1;
    lines.push(`  PASS  ${label}`);
  } else {
    fail += 1;
    lines.push(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
  }
};

const section = (title) => lines.push(`\n=== ${title} ===`);

const makeNpc = (over = {}) => ({
  id: 'npc_qa_test',
  name: '霜焰傀儡',
  role: '暴徒',
  level: 30,
  rank: '精英',
  championMultiplier: 1,
  partyLevel: 5,
  villainTier: 'none',
  selectedSpeciesId: 'sp_construct',
  speciesConfig: { selectedBenefits: [] },
  skills: [],
  selectedNegativeSkills: [],
  affinities: getInitialAffinities(),
  customDice: {},
  isFreeModeEnabled: false,
  overrideEnabled: false,
  overrides: { hp: '', mp: '', init: '', def: '', mdef: '' },
  ...over,
});

// ─── A. Bestiary Vol. 1 Quick Assembly 原書規則校準 ───────────────────────────
section('A. Quick Assembly 原書規則校準');
{
  const dyn20 = getDynamicValues(20, 5);
  check('R1：[少量]/[大量]/[巨量] 依 NPC 等級（Lv.20 -> 20/40/60）',
    dyn20['[少量]'] === 20 && dyn20['[大量]'] === 40 && dyn20['[巨量]'] === 60);

  const juggernaut = makeNpc({
    skills: [{ id: 'brute_cust_0_1', libId: 'brute_cust_0', source: 'customization', modifiers: { hp: 10 } }],
  });
  const jStats = calculateNpcStats(juggernaut);
  check('R2：Lv.30 精英暴徒 INS 升 d8 後先攻 = (8+8)/2 + 2 = 10', jStats.Init === 10, `實得 ${jStats.Init}`);
  check('R3：暴徒客製化 +10 HP 乘以精英 ×2 = 260', jStats.HP === 260, `實得 ${jStats.HP}`);

  const physVulBudgets = calculateNpcBudgets(makeNpc({
    level: 5,
    rank: '士兵',
    selectedSpeciesId: null,
    affinities: { ...getInitialAffinities(), 物理: 'vul' },
  }));
  check('R4：物理弱點提供 +1 定位技能額度', physVulBudgets.roleSkills.max === 1, `實得 ${physVulBudgets.roleSkills.max}`);

  const humanoid = SPECIES_DATA.find(s => s.id === 'sp_humanoid');
  check('R5：類人物種弱點選項包含「物理」',
    Boolean(humanoid?.mandatorySelections?.[0]?.options?.includes('物理')));

  const undead = SPECIES_DATA.find(s => s.id === 'sp_undead');
  const undeadSpellOpts = undead?.benefitsConfig?.options?.find(o => o.id === 'b2')?.selectionConfig?.options || [];
  check('R6：不死物種咒語選項為「詛咒」而非「大詛咒」',
    undeadSpellOpts.includes('詛咒') && !undeadSpellOpts.includes('大詛咒'));
  check('R6-b：SPELLS_DATA 已收錄「詛咒」（Core p.310, MP 5, 攻擊性）',
    SPELLS_DATA['詛咒']?.mp === 5 && SPELLS_DATA['詛咒']?.isOffensive === true);

  const element = SPECIES_DATA.find(s => s.id === 'sp_element');
  check('R9：元素物種額外弱點選項已排除「毒」',
    !element?.optionalDrawback?.selectionConfig?.options?.includes('毒'));

  const plantB6 = calculateNpcBudgets(makeNpc({
    level: 5, rank: '士兵', selectedSpeciesId: 'sp_plant',
    speciesConfig: { selectedBenefits: ['b6'] },
  }));
  check('R8：植物物種額外定位技能為 b6（非 b4）', plantB6.roleSkills.max === 1, `實得 ${plantB6.roleSkills.max}`);

  const monsterTwice = calculateNpcBudgets(makeNpc({
    level: 5, rank: '士兵', selectedSpeciesId: 'sp_monster',
    speciesConfig: { selectedBenefits: ['b4', 'b4'] },
  }));
  check('R8-b：魔獸物種 b4 選兩次計 +2', monsterTwice.roleSkills.max === 2, `實得 ${monsterTwice.roleSkills.max}`);

  const plantWithBind = calculateNpcStats(makeNpc({
    selectedSpeciesId: 'sp_plant',
    selectedNegativeSkills: [{ id: 'ns_8', selections: {} }],
  }));
  check('R7：【狀態束縛】移除植物既有的眩暈／動搖免疫，保留憤怒免疫',
    !plantWithBind.statusImmunities.includes('眩暈')
    && !plantWithBind.statusImmunities.includes('動搖')
    && plantWithBind.statusImmunities.includes('憤怒'),
    `實得 ${JSON.stringify(plantWithBind.statusImmunities)}`);
}

// ─── B. 自訂能力：排序／複製／改分類／入戰轉換 ─────────────────────────────────
section('B. 自訂能力操作與入戰資料轉換');
{
  const skills = [
    { id: 'def_1', originalName: '普通攻擊', category: 'attack' },
    { id: 'custom_a', originalName: '雷霆吐息', customName: '雷霆吐息', category: 'attack', source: 'custom' },
    { id: 'custom_b', originalName: '霜凍護盾', customName: '霜凍護盾', category: 'rule', source: 'custom' },
  ];

  const movedUp = moveCustomSkill(skills, 'custom_b', 'up');
  check('moveCustomSkill：上移僅交換自訂能力相對順序',
    movedUp[0].id === 'def_1' && movedUp[1].id === 'custom_b' && movedUp[2].id === 'custom_a');

  const movedDown = moveCustomSkill(movedUp, 'custom_b', 'down');
  check('moveCustomSkill：下移還原順序',
    movedDown[1].id === 'custom_a' && movedDown[2].id === 'custom_b');

  const duped = duplicateCustomSkill(skills, 'custom_a');
  check('duplicateCustomSkill：於原項目正後方插入副本',
    duped.length === 4 && duped[2].id !== 'custom_a' && duped[2].customName === '雷霆吐息（副本）');

  const toAttack = convertSkillCategory({ id: 'custom_x', category: 'rule', customDesc: '擊倒目標' }, 'attack');
  check('convertSkillCategory：轉為基本攻擊時自動補齊 attack 結構',
    toAttack.category === 'attack' && toAttack.attack?.distance === '近戰' && toAttack.attack?.formula === '[DEX + MIG]');

  const toSpell = convertSkillCategory(toAttack, 'spell');
  check('convertSkillCategory：轉為咒語時移除 attack 並補齊 spellData',
    toSpell.category === 'spell' && !toSpell.attack && toSpell.spellData?.mp === '10');

  const comb = exportNpcToCombatant(makeNpc({
    skills: [
      { id: 'custom_1', category: 'rule', originalName: '舊名', customName: '深淵咆哮', originalDesc: '舊敘述', customDesc: '全體動搖', source: 'custom' },
      { id: 'b1', category: 'attack', originalName: '普通攻擊', attack: { extra: '多重（2）' } },
    ],
  }));
  check('exportNpcToCombatant：正確帶出 customName 與 customDesc',
    comb.skills[0].name === '深淵咆哮' && comb.skills[0].desc === '全體動搖');
  check('exportNpcToCombatant：內建攻擊保留 originalName 與 attack.extra',
    comb.skills[1].name === '普通攻擊' && comb.skills[1].desc === '多重（2）');
}

// ─── C. 自由模式手動覆寫（含 0 值）與偏離摘要 ────────────────────────────────
section('C. 自由模式覆寫 0 值與偏離摘要');
{
  check('hasNumericOverride：數字 0 為有效覆寫', hasNumericOverride(0) === true);
  check('hasNumericOverride：空字串為無覆寫', hasNumericOverride('') === false);

  const zeroMp = calculateNpcStats(makeNpc({
    isFreeModeEnabled: true,
    overrideEnabled: true,
    overrides: { hp: '', mp: 0, init: 0, def: '', mdef: '' },
  }));
  check('手動覆寫 MP=0 與先攻=0 確實生效', zeroMp.MP === 0 && zeroMp.Init === 0, `MP=${zeroMp.MP}, Init=${zeroMp.Init}`);
  check('baseStats 保留覆寫前原書標準值', zeroMp.baseStats?.MP === 70 && zeroMp.baseStats?.Init === 10);

  const devs = getFreeModeDeviations(makeNpc({
    isFreeModeEnabled: true,
    customDice: { MIG: 'd12' },
    overrideEnabled: true,
    overrides: { hp: '', mp: 0, init: '', def: '', mdef: '' },
  }), { overBudgetSkillCount: 1 });
  check('getFreeModeDeviations：列出體質骰子、手動覆寫與超額技能',
    devs.includes('體質骰子 1 項') && devs.includes('手動覆寫 1 項') && devs.includes('超額技能 1 項'),
    devs.join(' / '));
}

// ─── D. 匯出修復（中文公式／attack.extra／研究檢定防劇透） ──────────────────
section('D. 文字與 ccfolia 匯出修復');
{
  check('parseFormulaToCcfoliaDice：解析英文 [DEX + INS]',
    parseFormulaToCcfoliaDice('[DEX + INS]') === '1{DEX}+1{INS}');
  check('parseFormulaToCcfoliaDice：解析中文 【洞】+【意】',
    parseFormulaToCcfoliaDice('【洞】+【意】') === '1{INS}+1{WLP}');
  check('parseFormulaToCcfoliaDice：解析中文 力量 + 意志',
    parseFormulaToCcfoliaDice('力量 + 意志') === '1{MIG}+1{WLP}');

  const exportNpc = makeNpc({
    skills: [
      { id: 'atk1', category: 'attack', originalName: '烈焰斬', attack: { distance: '近戰', formula: '【靈】+【力】', baseDmg: 5, type: '火', extra: '目標陷入動搖' } },
      { id: 'act1', category: 'action', originalName: '秘密行動', originalDesc: '只應在完整視角出現', source: 'custom' },
      { id: 'rul1', category: 'rule', originalName: '隱藏被動', originalDesc: '研究 13+ 不應洩漏', source: 'custom' },
    ],
  });
  const ctxBase = {
    state: exportNpc,
    currentTheme: { accent: '#a63d40' },
    mergedAffinities: getInitialAffinities(),
    processedSkills: exportNpc.skills,
    calculateStats: () => calculateNpcStats(exportNpc),
    secretArtTarget: null,
  };

  const mdFull = buildNpcText({ ...ctxBase, revealLevel: 'full' }, 'markdown');
  check('Markdown 完整視角包含基本攻擊的 attack.extra', mdFull.includes('目標陷入動搖'));

  const md13 = buildNpcText({ ...ctxBase, revealLevel: '13' }, 'markdown');
  check('Markdown 研究檢定 13+ 不洩漏其餘行動與特殊規則',
    md13.includes('烈焰斬') && !md13.includes('秘密行動') && !md13.includes('隱藏被動'));

  const ccf7 = buildNpcText({ ...ctxBase, revealLevel: '7' }, 'ccfolia');
  check('ccfolia 研究檢定 7+ 不洩漏基本攻擊與秘密行動',
    !ccf7.includes('烈焰斬') && !ccf7.includes('秘密行動'));
}

// ─── E. SSR 介面守門（自訂基本攻擊／自由模式橫幅與平衡參考／攻擊性咒語圖示） ──
section('E. SSR 介面渲染守門');
{
  const customOffSpell = {
    id: 'custom_sp_1',
    category: 'spell',
    originalName: '紅蓮斬',
    customName: '紅蓮斬',
    originalDesc: '造成 20 點火屬性傷害',
    customDesc: '造成 20 點火屬性傷害',
    source: 'custom',
    spellData: { mp: '15', target: '一個生物', duration: '瞬發', isOffensive: true },
  };
  const noop = () => {};
  const edHtml = renderToStaticMarkup(React.createElement(EditableSkill, {
    skill: customOffSpell,
    onUpdate: noop,
    onDelete: noop,
    onUpdateSelection: noop,
    onDuplicate: noop,
    onMoveUp: noop,
    onMoveDown: noop,
    canMoveUp: true,
    canMoveDown: true,
    allowCategoryChange: true,
    finalStats: { Acc: 2, MagicAccModifier: 0, magicFormula: '[INS + WLP]' },
    npcLevel: 20,
    partyLevel: 20,
  }));
  check('EditableSkill：自訂攻擊性咒語標題顯示官方攻擊性咒語圖示', edHtml.includes('title="攻擊性咒語"'));
  check('EditableSkill：常駐顯示上移／下移／複製／編輯／刪除操作列',
    edHtml.includes('title="上移"') && edHtml.includes('title="下移"') && edHtml.includes('title="複製"') && !edHtml.includes('opacity-0 group-hover:opacity-100'));

  const freeDraft = makeNpc({ isFreeModeEnabled: true });
  const step4Html = renderToStaticMarkup(React.createElement(NPCWorkshop, {
    initialDraft: freeDraft,
    initialMainTab: 'build',
    initialStep: 4,
  }));
  check('步驟 4：側邊欄渲染獨立的「規則模式」切換卡片', step4Html.includes('data-testid="sidebar-rule-mode"'));
  check('步驟 4：頂部 HUD 自由模式藥丸僅限手機（md:hidden），桌面不與側邊欄重複',
    step4Html.includes('data-testid="hud-free-mode-toggle"') && /data-testid="hud-free-mode-toggle"[^>]*md:hidden/.test(step4Html));
  const bannerMatch = step4Html.match(/data-testid="free-mode-banner"[\s\S]*?<\/div><div class="flex-1 flex overflow-hidden/);
  const bannerHtml = bannerMatch ? bannerMatch[0] : '';
  check('步驟 4：自由模式渲染常駐橫幅與查看平衡參考按鈕（橫幅內不再重複放切回按鈕）',
    step4Html.includes('data-testid="free-mode-banner"') && bannerHtml.includes('查看平衡參考') && !bannerHtml.includes('切回嚴謹模式'));
  check('步驟 4：自訂能力表單提供「基本攻擊」分類選項',
    step4Html.includes('data-testid="custom-skill-category"') && step4Html.includes('<option value="attack">基本攻擊</option>'));

  const step8Html = renderToStaticMarkup(React.createElement(NPCWorkshop, {
    initialDraft: freeDraft,
    initialMainTab: 'build',
    initialStep: 8,
  }));
  check('步驟 8：不再重複出現「立即查看角色卡」與底部「預覽角色卡」兩顆主鈕',
    step8Html.includes('預覽角色卡') && !step8Html.includes('立即查看角色卡'));

  const previewHtml = renderToStaticMarkup(React.createElement(NPCWorkshop, {
    initialDraft: freeDraft,
    initialMainTab: 'preview',
    initialStep: 1,
  }));
  check('預覽頁：工具列不再重複渲染「卡片風格」下拉選單（統一由頂部色點切換）',
    !previewHtml.includes('選擇角色卡風格'));
}

console.log(lines.join('\n'));
console.log(`\n========================================================\n  通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : `　失敗 ${fail}`}\n========================================================`);
if (fail > 0) process.exit(1);
