/**
 * 跑團卡 Discord 文字團複製格式與按鈕護欄（Play Copy Format & UI Guardrail）
 *
 * 執行：`npm run test:playcopy`
 *
 * 涵蓋：
 *   A. 純文字清理、Discord 引用區塊轉換、技能 SL 動態算式展開（`evaluateSkillDescForCopy`）
 *   B. 跑團卡核心複製格式（技能／子項目／英雄技能／金手指／咒語／武器／裝備）
 *   C. 職業子系統與選用規則複製格式（阿爾卡納核心與變體等級傷害／奇美拉／花藝師嫁接クロック／底力技／營地活動／隨從與載具）
 *   D. 擲骰結果複製格式（含大成功、大失敗、羈絆激勵、HR 視為 0、命中傷害直算）
 *   E. SSR 渲染驗證（確認各分頁與子系統面板皆渲染對應 `data-testid="copy-..."` 控件，且空狀態不誤出按鈕）
 *   F. 輸出字串零 Emoji 與純中文合規檢查
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  cleanCopyInlineText,
  toDiscordQuoteBlock,
  evaluateSkillDescForCopy,
  formatSkillCopyText,
  formatSuboptionCopyText,
  formatHeroicSkillCopyText,
  formatQuirkCopyText,
  formatSpellCopyText,
  formatWeaponCopyText,
  formatEquipmentCopyText,
  formatArcanaCopyText,
  formatChimeristSpellCopyText,
  formatFloristSeedCopyText,
  formatZeroPowerCopyText,
  formatCampActivityCopyText,
  formatCompanionItemCopyText,
  formatRollResultCopyText
} from '../src/features/character-sheet/utils/playCopyFormat.js';
import CopyTextButton from '../src/components/ui/CopyTextButton.jsx';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import SuboptionDetailsList from '../src/features/character-sheet/components/SuboptionDetailsList.jsx';
import ArcanistManager from '../src/features/character-sheet/components/companions/ArcanistManager.jsx';
import ChimeristManager from '../src/features/character-sheet/components/companions/ChimeristManager.jsx';
import FloristGardenTracker from '../src/features/character-sheet/components/companions/FloristGardenTracker.jsx';
import TinkererGadgetsQuickRef from '../src/features/character-sheet/components/companions/TinkererGadgetsQuickRef.jsx';
import WayfarerCompanionSheet from '../src/features/character-sheet/components/companions/WayfarerCompanionSheet.jsx';
import PilotVehicleCombatSheet from '../src/features/character-sheet/components/companions/PilotVehicleCombatSheet.jsx';
import NecromancerMinionSheet from '../src/features/character-sheet/components/companions/NecromancerMinionSheet.jsx';
import rulesData from '../src/features/character-sheet/data/rulesData.json';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};

const section = (title) => lines.push(`\n=== ${title} ===`);

const EMOJI_RE = /[\uD83C-\uDBFF\uDC00-\uDFFF\u26A1\u26A0\u2705\u274C\u26D3\u2620\u2744\u2600\u23F3\u270F\u2728\u2694\u2714\u2716]/;

// ─────────────────────────────────────────────────────────── A
section('A. 純文字清理、Discord 引用區塊與 SL 動態算式展開');

check(
  'cleanCopyInlineText 剝除攻擊咒語舊哨兵 U+26A1 並轉換 (o)',
  cleanCopyInlineText('冰霜吐息 \u26A1 (o)'),
  '冰霜吐息 （攻擊性咒語）'
);
check(
  'cleanCopyInlineText 行首 (o) 轉換為【攻】',
  cleanCopyInlineText('(o) 冰霜吐息 \u26A1'),
  '【攻】冰霜吐息'
);
check(
  'toDiscordQuoteBlock 為每行加上 > 前綴',
  toDiscordQuoteBlock('第一行\n第二行'),
  '> 第一行\n> 第二行'
);
check(
  'evaluateSkillDescForCopy：SL=3 時將【SL × 2】展開為**【6】**',
  evaluateSkillDescForCopy('你的先攻值獲得【SL】加值，且造成額外【SL × 2】點傷害。', 3),
  '你的先攻值獲得**【3】**加值，且造成額外**【6】**點傷害。'
);
check(
  'evaluateSkillDescForCopy：SL=0 時保留原始公式文字',
  evaluateSkillDescForCopy('造成額外【SL × 2】點傷害。', 0),
  '造成額外【SL × 2】點傷害。'
);

// ─────────────────────────────────────────────────────────── B
section('B. 跑團卡核心複製格式（技能／子項目／英雄技能／金手指／咒語／武器／裝備）');

const skillOut = formatSkillCopyText({
  className: '武器大師',
  skillName: '破甲斬',
  sl: 3,
  maxSl: 4,
  desc: '造成額外【SL × 2】點傷害。',
  isVariant: true,
  suboptions: ['碎骨（屬性）', '破盾'],
  characterName: '艾莉絲'
});
check('技能複製：標頭含角色名、職業、技能名與 SL', skillOut.includes('**艾莉絲 ▸ 【武器大師｜破甲斬】**（SL 3/4 · 公測變體）'), true);
check('技能複製：內文已展開 SL 算式', skillOut.includes('**【6】**'), true);
check('技能複製：列出已選子項目', skillOut.includes('已選細項：碎骨（屬性）、破盾'), true);

const suboptOut = formatSuboptionCopyText({
  parentSkillName: '舞步',
  suboptionCategory: '舞步類型',
  detail: {
    name: '獅鷲之舞',
    mp: '10 MP',
    duration: '直到下回合開始',
    effect: '下次造成的風屬性傷害 +5。'
  },
  characterName: '艾莉絲'
});
check('子項目複製：標頭含父技能與子項目名', suboptOut.includes('**艾莉絲 ▸ 【舞步｜獅鷲之舞】**'), true);
check('子項目複製：中繼列含消耗與持續時間', suboptOut.includes('消耗：10 MP ｜ 持續：直到下回合開始'), true);
check('子項目複製：引用區塊含效果說明', suboptOut.includes('> 下次造成的風屬性傷害 +5。'), true);

const suboptSeedOut = formatSuboptionCopyText({
  parentSkillName: '魔法種植',
  detail: {
    name: '紅蓮薔薇',
    effects: [
      { clock: '1', text: '火屬性傷害 +2' },
      { clock: '2-3', text: '火屬性傷害 +4' }
    ]
  }
});
check('子項目複製（陣列 effects）：逐階列出成長時鐘', suboptSeedOut.includes('> 【2-3】火屬性傷害 +4'), true);

const heroicOut = formatHeroicSkillCopyText({
  name: '超越極限',
  classReq: '狂戰士',
  reqText: '處於危機狀態',
  desc: '你在危機狀態下造成的傷害額外 +5。',
  characterName: '雷恩'
});
check('英雄技能複製：含職業需求與條件', heroicOut.includes('**雷恩 ▸ ★【狂戰士｜超越極限】**') && heroicOut.includes('前置需求：處於危機狀態'), true);
check('英雄技能複製：含效果說明', heroicOut.includes('> 你在危機狀態下造成的傷害額外 +5。'), true);

const quirkOut = formatQuirkCopyText({
  name: '宿命之子',
  type: '敘事特質',
  desc: '每次大休息結束時獲得 1 點物語點。',
  effectSummary: '大休息 +1 FP',
  characterName: '雷恩'
});
check('金手指複製：含名稱與類型', quirkOut.includes('**雷恩 ▸ ✦【金手指｜宿命之子】**（敘事特質）'), true);
check('金手指複製：含效果與已選配置', quirkOut.includes('已選配置：大休息 +1 FP') && quirkOut.includes('> 每次大休息結束時獲得 1 點物語點。'), true);

const spellOut = formatSpellCopyText({
  name: '連鎖閃電 \u26A1',
  className: '元素使',
  mp: '10×T',
  target: '至多三個生物',
  duration: '瞬發',
  isOffensive: true,
  checkFormula: '【INS + WLP】+2',
  damageFormula: '【HR + 15】電',
  desc: '對每個目標造成【HR + 15】點電屬性傷害。',
  characterName: '菲奧娜'
});
check('咒語複製：剝除哨兵並標註攻擊性咒語', spellOut.includes('**菲奧娜 ▸ 【元素使咒語｜連鎖閃電】**（攻擊性咒語）'), true);
check('咒語複製：含 MP、目標、持續時間與施法檢定', spellOut.includes('消耗：10×T ｜ 目標：至多三個生物 ｜ 持續時間：瞬發') && spellOut.includes('魔法檢定：【INS + WLP】+2 ｜ 傷害：【HR + 15】電'), true);
check('咒語複製：含效果內文', spellOut.includes('> 對每個目標造成【HR + 15】點電屬性傷害。'), true);

const weaponOut = formatWeaponCopyText({
  slotLabel: '主手武器',
  weapon: {
    name: '鋼鐵大劍',
    category: '重武器',
    type: '近戰',
    hands: 2,
    quality: '命中檢定 +1。'
  },
  check: { formula: '【DEX + MIG】+2', diceStr: 'd8+d10+2' },
  damage: { text: '【HR + 12】', type: '物理' },
  characterName: '雷恩'
});
check('武器複製：含槽位、名稱、分類與射程', weaponOut.includes('**雷恩 ▸ 【主手武器｜鋼鐵大劍】**（近戰 · 重武器 · 2手）'), true);
check('武器複製：含命中與傷害公式', weaponOut.includes('命中：【DEX + MIG】+2 (d8+d10+2) ｜ 傷害：【HR + 12】 物理'), true);
check('武器複製：含特殊品質', weaponOut.includes('> 命中檢定 +1。'), true);

const equipOut = formatEquipmentCopyText({
  slotLabel: '防具',
  item: {
    name: '旅人斗篷',
    def: 'DEX 骰 + 1',
    mdef: 'INS 骰 + 1',
    init: -1,
    desc: '旅途檢定 +1。'
  },
  characterName: '雷恩'
});
check('防具複製：含防禦、魔防、先攻與特效', equipOut.includes('物防：DEX 骰 + 1 ｜ 魔防：INS 骰 + 1 ｜ 先攻 -1') && equipOut.includes('> 旅途檢定 +1。'), true);

// ─────────────────────────────────────────────────────────── C
section('C. 職業子系統與選用規則複製格式');

const arcanaCoreOut = formatArcanaCopyText({
  arcana: {
    name: '鍛爐之阿爾卡納',
    domains: '火焰、高熱、金屬',
    merge: '獲得火焰抗性。',
    pulse: '對全體敵人造成 10 點火屬性傷害。',
    dismiss: '對全體敵人造成 20 點火屬性傷害。'
  },
  hasPulseSkill: true,
  characterLevel: 25,
  characterName: '賽巴斯'
});
check(
  '阿爾卡納（核心 Lv25）：顯示脈衝並提示 Lv20+ 傷害 +10',
  arcanaCoreOut.includes('> 【脈衝（技能動作）】（等級 25 傷害 +10）') &&
    arcanaCoreOut.includes('> 對全體敵人造成 10 點火屬性傷害。'),
  true
);

const arcanaVariantOut = formatArcanaCopyText({
  arcana: {
    name: '鍛爐之阿爾卡納（變體）',
    domains: '火焰、金屬',
    merge: '獲得火焰抗性。',
    pulse: '造成 5 點火屬性傷害。',
    dismiss: '造成 10 點火屬性傷害。',
    isVariant: true
  },
  hasPulseSkill: true,
  characterLevel: 40
});
check(
  '阿爾卡納（公測變體 Lv40）：提示變體傷害加成 +10（非核心 +20）',
  arcanaVariantOut.includes('> 【脈衝（技能動作）】（等級 40 傷害 +10）'),
  true
);

const chimeristOut = formatChimeristSpellCopyText({
  spell: {
    name: '石化凝視',
    species: '怪物',
    fromMonster: '美杜莎',
    attr: 'INS+WLP',
    mp: '10',
    target: '一個生物',
    duration: '瞬發',
    isOffensive: true,
    effect: '目標陷入緩慢狀態。'
  },
  hasViciousCycle: true,
  characterName: '奇美拉使'
});
check(
  '奇美拉複製：含來源魔物與惡性循環提示',
  chimeristOut.includes('（來源：美杜莎 · 怪物）（攻擊性）') &&
    chimeristOut.includes('> ※【惡性循環】若目標是怪物，目標同時陷入中毒狀態。'),
  true
);

const floristOut = formatFloristSeedCopyText({
  seedName: '極地冰蓮',
  clockFilled: 2,
  detail: {
    effects: [
      { clock: '第 1 回合（生長命刻 0~1 格）', text: '冰屬性傷害 +2' },
      { clock: '第 2~3 回合（生長命刻 2~3 格）', text: '冰屬性傷害 +4' },
      { clock: '滿 4 格離園時', text: '冰屬性傷害 +6' }
    ]
  },
  characterName: '花藝師'
});
check(
  '花藝師複製：正確標出當前格數生效中的那一階',
  floristOut.includes('> ✦ [生效中]【第 2~3 回合（生長命刻 2~3 格）】冰屬性傷害 +4') &&
    floristOut.includes('> ·【滿 4 格離園時】冰屬性傷害 +6'),
  true
);

const zeroOut = formatZeroPowerCopyText({
  name: '王家之刃',
  triggerName: '復仇',
  triggerText: '當你在場景中第一次進入危機狀態時發動。',
  effectName: '零之疾襲',
  effectText: '你以每一把已裝備的武器各進行一次自由攻擊。',
  clockFilled: 6,
  clockMax: 6,
  characterName: '阿爾'
});
check(
  '底力技複製：含名稱、命刻進度、觸發與效果',
  zeroOut.includes('**阿爾 ▸ ★【底力技｜王家之刃】**（命刻：6/6）') &&
    zeroOut.includes('> 【底力觸發：復仇】') &&
    zeroOut.includes('> 【底力效果：零之疾襲】'),
  true
);

const campOut = formatCampActivityCopyText({
  name: '探索',
  targetLabel: '自身',
  page: 'p.132',
  desc: '擲 1d6 決定探索收穫。',
  table: [
    { roll: '1', text: '恢復正常一半的 HP 與 MP' },
    { roll: '6', text: '中大獎' }
  ],
  once: false,
  used: false,
  characterName: '阿爾'
});
check(
  '營地活動複製：含 1d6 表格',
  campOut.includes('> · 【d6 = 1】恢復正常一半的 HP 與 MP') &&
    campOut.includes('> · 【d6 = 6】中大獎'),
  true
);

const companionOut = formatCompanionItemCopyText({
  category: '修補匠小工具',
  name: '灌注術 · 熾熱',
  meta: '階級：基礎 ｜ 消耗：2 IP',
  desc: '攻擊額外造成 5 點火屬性傷害。',
  characterName: '艾莉絲'
});
check(
  '隨身子系統複製：含分類、名稱、中繼列與引用效果',
  companionOut.includes('**艾莉絲 ▸ 【修補匠小工具｜灌注術 · 熾熱】**') &&
    companionOut.includes('階級：基礎 ｜ 消耗：2 IP') &&
    companionOut.includes('> 攻擊額外造成 5 點火屬性傷害。'),
  true
);

// ─────────────────────────────────────────────────────────── D
section('D. 擲骰結果複製格式');

const rollCritOut = formatRollResultCopyText({
  label: '武器攻擊【鋼鐵大劍】',
  die1Type: 10,
  die2Type: 8,
  die1: 8,
  die2: 8,
  modifier: 2,
  fpBonus: 3,
  bondName: '莉莉絲',
  total: 21,
  hr: 8,
  zeroHr: false,
  isCritical: true,
  isFumble: false,
  damageBonus: 12,
  extraDamage: 5,
  totalDamage: 25,
  damageType: '火',
  characterName: '雷恩'
});
check(
  '擲骰結果複製：含大成功標記、羈絆激勵與命中傷害直算',
  rollCritOut.includes('**雷恩 ▸ 【檢定｜武器攻擊【鋼鐵大劍】】【大成功！】 總計 21**') &&
    rollCritOut.includes('+ 羈絆 3（莉莉絲） = **21** ｜ HR **8**') &&
    rollCritOut.includes('> 傷害結算：HR 8 + 17 = **25**（火）'),
  true
);

// ─────────────────────────────────────────────────────────── E
section('E. SSR 渲染驗證（跑團面板各分頁與子系統面板複製按鈕）');

const sampleShieldName = rulesData.equipment.shields[0].name;
const sampleArmorName = rulesData.equipment.armors[0].name;

const richChar = {
  id: 'char-copy-test',
  name: '艾莉絲',
  level: 10,
  attributes: { dex: 8, ins: 8, mig: 10, wlp: 8 },
  currentHp: 50,
  currentMp: 40,
  currentIp: 6,
  fabulaPoints: 3,
  zenit: 500,
  quirk: '宿命之子',
  quirkType: '敘事特質',
  quirkDesc: '每次大休息結束時獲得 1 點物語點。',
  quirkEffect: '大休息 +1 FP',
  equipment: {
    mainHand: '鐵劍',
    offHand: sampleShieldName,
    armor: sampleArmorName,
    accessory: ''
  },
  weapons: [
    { name: '鐵劍', category: '劍', range: 'melee', hands: 1, attr1: 'DEX', attr2: 'MIG', accuracyMod: 1, damageBonus: 6, damageType: '物理', quality: '精良' }
  ],
  spells: [
    { name: '火焰彈', className: '元素使', mp: '10', target: '一個生物', duration: '瞬發', isOffensive: true, attr1: 'INS', attr2: 'WLP', desc: '造成【HR + 15】火屬性傷害。' }
  ],
  classes: [
    {
      className: '元素使',
      level: 5,
      skills: [
        { name: '元素魔法', sl: 3, maxSl: 10, desc: '習得元素使咒語。' }
      ]
    }
  ],
  heroicSkills: [
    { name: '超越極限', classReq: '元素使', desc: '危機時傷害 +5。' }
  ],
  creationRules: { zeroPowers: true, campActivities: true },
  zeroPower: {
    name: '紅蓮覺醒',
    triggerId: 'revenge',
    effectId: 'blitz',
    clock: 3,
    variant: '',
    awakened: false,
    loveTargetId: '',
    combinedPairs: [],
    choices: { damagePair: [], damageType: '', statuses: [] }
  },
  campActivities: {
    picked: ['massage'],
    used: []
  }
};

const attacksHtml = renderToStaticMarkup(
  React.createElement(CharacterPlayHUD, {
    character: richChar,
    onChange: () => {},
    onOpenEditor: () => {},
    initialTab: 'attacks'
  })
);
check('攻擊分頁渲染主手武器複製按鈕', attacksHtml.includes('data-testid="copy-main-weapon"'), true);
check('攻擊分頁渲染護盾複製按鈕', attacksHtml.includes('data-testid="copy-shield"'), true);
check('攻擊分頁渲染防具複製按鈕', attacksHtml.includes('data-testid="copy-armor"'), true);
check('未裝備飾品時不渲染飾品複製按鈕', attacksHtml.includes('data-testid="copy-accessory"'), false);

const spellsHtml = renderToStaticMarkup(
  React.createElement(CharacterPlayHUD, {
    character: richChar,
    onChange: () => {},
    onOpenEditor: () => {},
    initialTab: 'spells'
  })
);
check('咒語分頁渲染咒語複製按鈕', spellsHtml.includes('data-testid="copy-spell-0"'), true);

const skillsHtml = renderToStaticMarkup(
  React.createElement(CharacterPlayHUD, {
    character: richChar,
    onChange: () => {},
    onOpenEditor: () => {},
    initialTab: 'skills'
  })
);
check('技能分頁渲染職業技能複製按鈕', skillsHtml.includes('data-testid="copy-skill-元素使-元素魔法"'), true);
check('技能分頁渲染英雄技能複製按鈕', skillsHtml.includes('data-testid="copy-heroic-0"'), true);
check('技能分頁渲染金手指複製按鈕', skillsHtml.includes('data-testid="copy-quirk"'), true);

const bondsHtml = renderToStaticMarkup(
  React.createElement(CharacterPlayHUD, {
    character: richChar,
    onChange: () => {},
    onOpenEditor: () => {},
    initialTab: 'bonds'
  })
);
check('羈絆分頁渲染營地活動複製按鈕', bondsHtml.includes('data-testid="copy-camp-massage"'), true);

const clocksHtml = renderToStaticMarkup(
  React.createElement(CharacterPlayHUD, {
    character: richChar,
    onChange: () => {},
    onOpenEditor: () => {},
    initialTab: 'clocks'
  })
);
check('命刻分頁渲染底力技複製按鈕', clocksHtml.includes('data-testid="copy-zero-power"'), true);

const suboptHtml = renderToStaticMarkup(
  React.createElement(SuboptionDetailsList, {
    className: '舞者',
    skillName: '起舞',
    selectedOptions: ['獅鷲形'],
    characterName: '艾莉絲'
  })
);
check('SuboptionDetailsList 渲染子項目複製按鈕', suboptHtml.includes('data-testid="copy-suboption-0"'), true);

const arcanistHtml = renderToStaticMarkup(
  React.createElement(ArcanistManager, {
    character: {
      ...richChar,
      arcanistData: {
        activeSummonId: 'sword',
        boundArcana: ['sword']
      }
    },
    onChange: () => {}
  })
);
check('ArcanistManager 渲染已召喚阿爾卡納複製按鈕', arcanistHtml.includes('data-testid="copy-active-arcana"'), true);
check('ArcanistManager 渲染契約阿爾卡納複製按鈕', arcanistHtml.includes('data-testid="copy-arcana-sword"'), true);

const chimeristHtml = renderToStaticMarkup(
  React.createElement(ChimeristManager, {
    character: {
      ...richChar,
      classes: [{ className: '奇美拉', skills: [{ name: '擬態', sl: 2 }] }],
      chimeristData: {
        spells: [{ id: 'sp1', name: '石化凝視', species: '怪物', mp: '10', target: '一個生物', duration: '瞬發', effect: '目標緩慢。' }]
      }
    },
    onChange: () => {}
  })
);
check('ChimeristManager 渲染怪獸咒語複製按鈕', chimeristHtml.includes('data-testid="copy-chimerist-sp1"'), true);

const floristHtml = renderToStaticMarkup(
  React.createElement(FloristGardenTracker, {
    character: {
      ...richChar,
      classes: [{ className: '花藝師', skills: [{ name: '魔法種植', sl: 2, suboptions: ['星辰花'] }] }],
      floristGarden: [
        { instanceId: 'seed-1', seedName: '星辰花', clock: 2 }
      ]
    },
    onChange: () => {}
  })
);
check('FloristGardenTracker 渲染播種魔種複製按鈕', floristHtml.includes('data-testid="copy-florist-seed"'), true);

const gadgetsHtml = renderToStaticMarkup(
  React.createElement(TinkererGadgetsQuickRef, {
    gadgetsData: { infusion: 2, magitech: 2, alchemy: 1 },
    sl: 5,
    characterName: '艾莉絲'
  })
);
check(
  'TinkererGadgetsQuickRef 渲染灌注術、魔科技、煉金術複製按鈕',
  gadgetsHtml.includes('data-testid="copy-gadget-infusion"') &&
    gadgetsHtml.includes('data-testid="copy-gadget-override"') &&
    gadgetsHtml.includes('data-testid="copy-gadget-magicannon"') &&
    gadgetsHtml.includes('data-testid="copy-gadget-alchemy"'),
  true
);

const wayfarerHtml = renderToStaticMarkup(
  React.createElement(WayfarerCompanionSheet, {
    character: {
      ...richChar,
      classes: [{ className: '旅人', skills: [{ name: '忠實夥伴', sl: 2 }] }]
    },
    onChange: () => {}
  })
);
check('WayfarerCompanionSheet 渲染複製隨從按鈕', wayfarerHtml.includes('data-testid="copy-wayfarer-companion"'), true);

const pilotHtml = renderToStaticMarkup(
  React.createElement(PilotVehicleCombatSheet, {
    character: {
      ...richChar,
      classes: [{ className: '機師', skills: [{ name: '個人載具', sl: 2 }] }]
    },
    onChange: () => {}
  })
);
check('PilotVehicleCombatSheet 渲染複製載具按鈕', pilotHtml.includes('data-testid="copy-pilot-vehicle"'), true);

const necroHtml = renderToStaticMarkup(
  React.createElement(NecromancerMinionSheet, {
    character: {
      ...richChar,
      necroData: {
        minion: { active: true, name: '白骨侍從', npcLevel: 5, currentHp: 20, currentMp: 10 }
      }
    },
    onChange: () => {}
  })
);
check('NecromancerMinionSheet 渲染複製僕從按鈕', necroHtml.includes('data-testid="copy-necro-minion"'), true);

const btnHtml = renderToStaticMarkup(
  React.createElement(CopyTextButton, {
    getText: () => '測試',
    label: '複製效果',
    testId: 'copy-unit-btn'
  })
);
check('CopyTextButton 渲染指定標籤與 testId', btnHtml.includes('data-testid="copy-unit-btn"') && btnHtml.includes('複製效果'), true);

// ─────────────────────────────────────────────────────────── F
section('F. 輸出字串零 Emoji 合規檢查');

const allSamples = [
  skillOut,
  suboptOut,
  suboptSeedOut,
  heroicOut,
  quirkOut,
  spellOut,
  weaponOut,
  equipOut,
  arcanaCoreOut,
  arcanaVariantOut,
  chimeristOut,
  floristOut,
  zeroOut,
  campOut,
  companionOut,
  rollCritOut
];
check('所有格式化樣本皆不含任何彩色或 BMP Emoji 字元', allSamples.some((s) => EMOJI_RE.test(s)), false);

// ─────────────────────────────────────────────────────────── 結果
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
if (fail > 0) lines.push(`\n失敗 ${fail} 項`);
console.log(lines.join('\n'));
process.exit(fail > 0 ? 1 : 0);
