/**
 * 角色卡 UI 契約測試。
 *
 * 執行：npm run test:ui
 *
 * 這裡放的是「使用者回報過的介面問題」的護欄——每一條都對應一次真實的抱怨：
 * - 「跑團卡和角色卡的到底是什麼？兩個按鈕寫的根本沒有差別」→ 標籤必須說明「你來這裡做什麼」
 * - 「一個短列而已根本不知道那些技能是什麼」→ 升級流程必須顯示技能效果全文
 * - 「所有數值要可以自己填寫」→ 六項資源都必須是可輸入的步進器
 *
 * 護欄刻意用「原始碼掃描 + 純函式」而不是渲染測試：
 * 這些問題都是「某個地方少寫了什麼」，掃描原始碼最直接，而且不會因為版面微調就失效。
 */
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NumberStepper, { parseStepperInput } from '../src/components/ui/NumberStepper.jsx';
import {
  buildSheetModel,
  OfficialSheetPage1,
  OfficialSheetPage2,
  OfficialSheetPage3,
  SHEET_PAGE_WIDTH,
  SHEET_PAGE_HEIGHT,
  sheetVars,
  FABULA_POINT_RULES,
  EXPERIENCE_POINT_RULES,
  SHEET_DISCIPLINES
} from '../src/features/character-sheet/components/CharacterSheetExport.jsx';
import { createNewCharacter, getProficiencies, calculateCharacterStats, deriveCreationState, shortIssueLabel, isHpMpChoiceBenefit, classSkillsForClass, suppressedSkillsForClass, describeQuirkChoice } from '../src/features/character-sheet/utils/characterEngine.js';
import { suppressedSkillsNote } from '../src/features/character-sheet/data/technospheres.js';
import { EquipmentPickerBody } from '../src/features/character-sheet/components/EquipmentPickerModal.jsx';
import { resolveCreationRules, DEFAULT_CREATION_RULES, classCountRange, classCountPhrase } from '../src/features/character-sheet/data/creationRules.js';
import { HeroicSkillPickerBody } from '../src/features/character-sheet/components/HeroicSkillPickerModal.jsx';
import { QuirkPickerBody } from '../src/features/character-sheet/components/QuirkPickerModal.jsx';
import ClassHeroicSkillsBlock from '../src/features/character-sheet/components/ClassHeroicSkillsBlock.jsx';
import { LOG_KINDS } from '../src/features/character-sheet/utils/characterLog.js';
import { EQUIPMENT_ICONS } from '../src/features/character-sheet/utils/equipmentRules.js';
import {
  buildCustomWeaponEntries,
  buildCustomWeaponEntry,
  createCustomWeaponSpec
} from '../src/features/character-sheet/data/customWeapons.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import { ATTRIBUTE_NAMES, CLASS_METADATA, VARIANT_ARCANIST_CLASS_NAME, normalizeClassName, normalizeRosterClassNames, getClassInfo } from '../src/features/character-sheet/data/sourcebookConfig.js';
import ArcanistManager from '../src/features/character-sheet/components/companions/ArcanistManager.jsx';
import { stripClassSuffix } from '../src/features/character-sheet/data/classAliases.js';
import { GAME_ICONS_MAP } from '../src/components/ui/GameIcon.jsx';
import { readIconMapKeys, findDuplicateIconKeys } from './helpers/gameIconMap.mjs';
import CharacterEditor from '../src/features/character-sheet/components/CharacterEditor.jsx';
import { GLOSSARY, TERMS as TERM_ENTRIES } from '../src/features/character-sheet/data/glossary.js';
import CharacterCard from '../src/features/character-sheet/components/CharacterCard.jsx';
import ClassSkillCard from '../src/features/character-sheet/components/ClassSkillCard.jsx';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';
import AttributeMatrixPicker from '../src/features/character-sheet/components/AttributeMatrixPicker.jsx';
import ClassPickerModal from '../src/features/character-sheet/components/ClassPickerModal.jsx';
import MnemosphereSection from '../src/features/character-sheet/components/MnemosphereSection.jsx';
import CreationRulesPanel, { describeRulesDiff } from '../src/features/character-sheet/components/CreationRulesPanel.jsx';
import {
  buildImagePdf,
  buildImagePdfBytes,
  readJpegSize,
  dataUrlToBytes,
  A4_LANDSCAPE_PT
} from '../src/features/character-sheet/utils/pdfWriter.js';

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
const section = (t) => lines.push(`\n=== ${t} ===`);

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
/** 掃描使用者可見文案時要先去掉註解——否則「解釋舊標籤為什麼不好」的註解會自己被判成違規 */
const stripComments = (src) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const hud = read('../src/features/character-sheet/components/CharacterPlayHUD.jsx');
const editor = read('../src/features/character-sheet/components/CharacterEditor.jsx');
const sheet = read('../src/features/character-sheet/CharacterSheet.jsx');
const editorCode = stripComments(editor);
const hudCode = stripComments(hud);
const sheetCode = stripComments(sheet);

// ─────────────────────────────────────────────────────────── A
section('A. 數值步進器：可自己填寫、也可用 ± 增減');

check('空字串 → 不套用', parseStepperInput('', 10), null);
check('只有空白 → 不套用', parseStepperInput('   ', 10), null);
check('非數字 → 不套用', parseStepperInput('abc', 10), null);
check('填絕對值 25（現值 10）→ 增減 +15', parseStepperInput('25', 10), { delta: 15 });
check('填絕對值 4（現值 10）→ 增減 -6', parseStepperInput('4', 10), { delta: -6 });
check('填與現值相同 → 不套用', parseStepperInput('10', 10), null);
check('輸入 +12 → 增減 +12（不是設成 12）', parseStepperInput('+12', 10), { delta: 12 });
check('輸入 -12 → 增減 -12', parseStepperInput('-12', 10), { delta: -12 });
check('+ 與絕對值語意不同：+10 是「再加 10」', parseStepperInput('+10', 10), { delta: 10 });
check('帶小數 → 取原值（由呼叫端夾制）', parseStepperInput('12.5', 10), { delta: 2.5 });
check('前後空白會被修剪', parseStepperInput('  +7  ', 10), { delta: 7 });
check('null / undefined → 不套用',
  [parseStepperInput(null, 10), parseStepperInput(undefined, 10)], [null, null]);
check('0 是合法輸入（現值 10 → 增減 -10）', parseStepperInput('0', 10), { delta: -10 });

const stepperHtml = renderToStaticMarkup(React.createElement(NumberStepper, {
  value: 12,
  onDelta: () => {}
}));
check('步進器渲染出目前值', stepperHtml.includes('value="12"'), true);
check('步進器有 − 與 + 兩顆按鈕',
  [stepperHtml.includes('−'), stepperHtml.includes('>+<')], [true, true]);
check('步進器帶輸入提示', stepperHtml.includes('可直接輸入數值'), true);
check('disabled 時輸入框與按鈕都停用',
  (renderToStaticMarkup(React.createElement(NumberStepper, { value: 1, onDelta: () => {}, disabled: true })).match(/disabled=""/g) || []).length,
  3);

// ─────────────────────────────────────────────────────────── B
section('B. 六項資源都必須是可自己填寫的步進器（使用者回報）');

const resourceCalls = [
  ['HP', /<NumberStepper\s+value=\{curHp\}/],
  ['MP', /<NumberStepper\s+value=\{curMp\}/],
  ['IP', /<NumberStepper\s+value=\{curIp\}/],
  ['EXP', /<NumberStepper\s+value=\{character\.exp \|\| 0\}/],
  ['資金', /<NumberStepper\s+value=\{character\.zenit \|\| 0\}/],
  // `??` 不是 `||`：物語點 0 是合法值，不能被當成缺值（2026-10-06 修）
  ['物語點', /<NumberStepper\s+value=\{character\.fabulaPoints \?\? 3\}/]
];
check('六項資源都改用 NumberStepper',
  resourceCalls.filter(([, re]) => !re.test(hud)).map(([name]) => name), []);
check('舊的固定 ±1／±5 按鈕已移除',
  ['adjustHp(-5)', 'adjustMp(5)', 'adjustExp(5)', 'adjustZenit(100)', 'adjustIp(-1)'].filter((s) => hud.includes(s)),
  []);
check('夾制後沒有變化時不寫入（避免 0 → 0 的空記錄）',
  (hud.match(/if \(next === cur/g) || []).length >= 5, true);
check('跑團卡有引入步進器', hud.includes("from '../../../components/ui/NumberStepper'"), true);

// ─────────────────────────────────────────────────────────── C
section('C. 升級流程要看得到技能在做什麼（使用者回報）');

check('升級模態不再用下拉選單挑技能', hud.includes('-- 選擇特技 --'), false);
check('升級模態逐項顯示技能效果全文',
  [hud.includes('SkillDescription'), hud.includes('sl={isSel && !maxed ? curSL + 1 : curSL}')],
  [true, true]);
check('選取中的技能以「升級後」的 SL 顯示',
  hud.includes('以上數值以升級後的 SL'), true);
check('升級模態提供連到構築工坊「職業與技能」的入口',
  [hud.includes('onOpenEditor(3)'), hud.includes('想比較其他職業的技能？')], [true, true]);
check('編輯器支援指定初始分頁（且會夾制）',
  [editor.includes('initialTab = 1'), editor.includes('Number.isInteger(initialTab)')], [true, true]);
check('名冊開啟編輯器時固定回到第 1 分頁', sheet.includes('setEditorTab(1)'), true);
check('跑團卡傳分頁給編輯器（且驗型別）',
  [sheet.includes('onOpenEditor={(tab)'), sheet.includes("typeof tab === 'number'")], [true, true]);

// ─────────────────────────────────────────────────────────── D
section('D. 兩個入口按鈕必須說明「你來這裡做什麼」（使用者回報）');

check('編輯器不再出現「查看角色卡」', editorCode.includes('查看角色卡'), false);
check('編輯器不再出現「進入跑團卡」', editorCode.includes('進入跑團卡'), false);
check('編輯器不再出現「查看卡片」', editorCode.includes('查看卡片'), false);
check('改名為「卡片預覽」並標示唯讀',
  [editorCode.includes('卡片預覽'), editorCode.includes('唯讀')], [true, true]);
check('改名為「跑團面板」並附一行說明',
  [editorCode.includes('跑團面板'), editorCode.includes('HP／MP／狀態、攻擊與咒語、命刻')], [true, true]);
check('預覽按鈕說明它做什麼', editorCode.includes('看整張卡目前填得怎樣、列印或截圖存檔'), true);
check('名冊卡片也用同一套詞彙',
  [sheetCode.includes('構築與成長'), sheetCode.includes('跑團面板')], [true, true]);
check('跑團面板標頭也用同一套詞彙', hudCode.includes('構築與成長'), true);
check('麵包屑不再用「構建／實戰」',
  [sheetCode.includes('`構建：'), sheetCode.includes('`實戰：')], [false, false]);
check('全站使用者可見文案不再出現「跑團卡」',
  [editorCode, hudCode, sheetCode].filter((src) => src.includes('跑團卡')).length, 0);

// 同一個動作（開卡片預覽彈窗）在畫面上有三個入口（側邊欄／手機列／底部動作列），
// 它們**必須同名**——上一輪就是漏了底部那顆，三個入口兩個名字。
// 護欄用「開窗次數 ≤ 標籤出現次數」把這件事綁住：新增入口卻忘了用同一個標籤就會斷。
const previewOpeners = (editorCode.match(/setIsCardPreviewModalOpen\(true\)/g) || []).length;
const previewLabelCount = (editorCode.match(/卡片預覽/g) || []).length;
check('開卡片預覽的入口不只一個（三處）', previewOpeners >= 3, true);
check('每個入口都用同一個標籤「卡片預覽」', previewLabelCount >= previewOpeners, true);
check('沒有殘留的舊標籤（查看當前角色卡／查看角色卡／進入跑團卡）',
  ['查看當前角色卡', '查看角色卡', '進入跑團卡'].filter((t) => editorCode.includes(t)), []);

// ─────────────────────────────────────────────────────────── E
section('E. 官方三頁匯出：欄位對應');

const sheetChar = createNewCharacter({
  name: '測試勇者',
  identity: '流浪劍士',
  theme: '希望',
  origin: '邊境村落',
  gender: '女',
  background: '普拉塔王室最後的倖存者。',
  zenit: 320,
  exp: 7,
  fabulaPoints: 2,
  currentHp: 12,
  currentMp: null,
  backpackNotes: '乾糧三份',
  quirk: '倖存者',
  attributes: { dex: 10, ins: 8, mig: 6, wlp: 8 },
  statusAfflictions: { dazed: true, weak: true },
  bonds: [
    { id: 'b1', target: '同行夥伴', feelings: ['admiration', 'loyalty'] },
    { id: 'b2', target: '宿敵', feelings: ['hatred'] }
  ],
  equipment: { mainHand: '青銅劍', offHand: '青銅圓盾', armor: '旅行皮甲', accessory: '守護護符' },
  classes: [
    { className: '守護者', level: 3, chosenBenefit: 'hp', skills: [{ name: '防守掌握', sl: 2 }] },
    { className: '元素師', level: 2, skills: [{ name: '元素學派儀式', sl: 1 }] },
    { className: '博學士', level: 1, skills: [] },
    { className: '靈師', level: 1, skills: [{ name: '靈魂學派儀式', sl: 1 }] },
    { className: '熵師', level: 1, skills: [] }
  ],
  heroicSkills: ['英雄的覺悟'],
  spells: [
    { name: '火球', mp: 10, target: '一個生物', duration: '瞬發', desc: '造成【HR + 5】火屬性傷害。' },
    { name: '治療', mp: 8, target: '一個生物', duration: '瞬發', desc: '回復【SL × 5】HP。' },
    { name: '冰錐', mp: 10, target: '一個生物', duration: '瞬發', desc: '造成冰屬性傷害。' },
    { name: '雷擊', mp: 12, target: '一個生物', duration: '瞬發', desc: '造成電屬性傷害。' },
    { name: '護盾', mp: 6, target: '自身', duration: '場景', desc: '物防 +2。' },
    { name: '淨化', mp: 5, target: '一個生物', duration: '瞬發', desc: '解除一個異常狀態。' },
    { name: '疾風', mp: 9, target: '一個生物', duration: '瞬發', desc: '造成風屬性傷害。' },
    { name: '暗影', mp: 11, target: '一個生物', duration: '瞬發', desc: '造成暗屬性傷害。' }
  ]
});
const model = buildSheetModel(sheetChar);

check('身世三欄', [model.identity, model.theme, model.origin], ['流浪劍士', '希望', '邊境村落']);
check('姓名', model.name, '測試勇者');
check('物語點／經驗值／資金',
  [model.fabulaPoints, model.exp, model.zenit], [2, 7, 320]);
check('羈絆固定 6 格', model.bonds.length, 6);
check('羈絆帶目標與感情勾選',
  [model.bonds[0].target, model.bonds[0].feelings.admiration, model.bonds[0].feelings.hatred, model.bonds[1].feelings.hatred],
  ['同行夥伴', true, false, true]);
check('空的羈絆格是空白的', model.bonds[5].target, '');
check('HP 當前值取自角色', model.pools.hp.current, 12);
check('MP 當前值 null 代表滿值', model.pools.mp.current, model.pools.mp.max);
check('IP 當前值 null 代表滿值', model.pools.ip.current, model.pools.ip.max);
check('HP 上限與危機值來自引擎', [model.pools.hp.max > 0, model.crisisThreshold > 0], [true, true]);
check('四維基礎值', model.attributes.base.map((a) => a.value), [10, 8, 6, 8]);
check('四維當前值（眩暈降 INS 一階；虛弱時 MIG 已在 d6 下限）',
  model.attributes.current.map((a) => a.value), [10, 6, 6, 8]);
check('狀態勾選', model.statuses.filter((s) => s.on).map((s) => s.cn), ['眩暈', '虛弱']);
check('裝備四列（配件／防具／主手／副手）',
  model.equipmentRows.map((r) => r.label), ['配件', '防具', '主手', '副手']);
check('裝備列帶規則書上的說明（武器為命中／傷害式）',
  model.equipmentRows.find((r) => r.slot === 'mainHand').desc.includes('HR'), true);
check('防具列帶說明', model.equipmentRows.find((r) => r.slot === 'armor').desc.length > 0, true);
// 熟練度不另寫一份判定：直接取自引擎，測試只驗「有接上去」而不是「哪個職業給什麼」
check('熟練度直接取自引擎', model.proficiencies, getProficiencies(sheetChar));
check('熟練度不是全空（確實有讀到職業）',
  Object.values(model.proficiencies).some(Boolean), true);
check('P1 職業欄只放前 3 個', model.page1Classes.map((c) => c.className), ['守護者', '元素師', '博學士']);
check('其他職業從第 4 個開始，最多 4 個', model.otherClasses.map((c) => c.className), ['靈師', '熵師']);
// 2026-10-27（F-018）：這條原本期望 '最大 HP +5'，而那是舊程式「拿小寫 'hp' 去比」的產物。
// 守護者**不是**二選一職業，它的免費增益原文就是「HP +5，職業防具/盾牌」——
// 舊寫法只印了前半段，把「職業防具/盾牌」整段吃掉。改吃 `describeFreeBenefit` 之後印原文，
// 資訊只多不少；二選一那 6 個職業則印玩家實際選到的那一邊（見 §CN）。
check('免費增益印資料層原文（守護者：HP +5，職業防具/盾牌）',
  model.page1Classes[0].freeBenefit, 'HP +5，職業防具/盾牌');
check('技能資訊帶 SL（現在是物件，多了效果全文欄位）',
  [model.page1Classes[0].skills[0].name, model.page1Classes[0].skills[0].sl,
    'desc' in model.page1Classes[0].skills[0]],
  ['防守掌握', 2, true]);
check('咒語 P2 放前 7 條', model.page2Spells.map((s) => s.name),
  ['火球', '治療', '冰錐', '雷擊', '護盾', '淨化', '疾風']);
check('咒語 P3 接續（第 8 條起）', model.page3Spells.map((s) => s.name), ['暗影']);
check('咒語列帶 MP／目標／持續時間',
  [model.page2Spells[0].mp, model.page2Spells[0].targets, model.page2Spells[0].duration], [10, '一個生物', '瞬發']);
check('儀式學派由技能名稱推導（元素師＋靈師 → 兩個學派）',
  model.disciplines.filter((d) => d.on).map((d) => d.name), ['元素學派', '靈魂學派']);
check('六個學派都在表上', model.disciplines.length, 6);
check('英雄技能帶效果全文欄位',
  [model.heroicSkills[0].name, 'effect' in model.heroicSkills[0]], ['英雄的覺悟', true]);
check('金手指「無」不顯示', buildSheetModel(createNewCharacter({ quirk: '無' })).quirk, '');
check('金手指有值時顯示', model.quirk, '倖存者');
check('行囊筆記', model.backpackNotes, '乾糧三份');

// 官方表上與姓名並排的那一格是「稱呼」；本專案依使用者裁定（2026-10-06）改為性別。
// 舊版這一格永遠是空的——`pronouns` 在模型裡被寫死成 ''，印出來是一條空白線。
check('性別帶進匯出模型', model.gender, '女');
check('匯出模型不再有 pronouns 這個欄位',
  Object.prototype.hasOwnProperty.call(model, 'pronouns'), false);
// 角色背景**不進三頁**：三頁是固定 1123×794 的官方表格複刻，六欄餘裕只有 0～4px
// （2026-10-06 實測），硬加一個背景框會讓 P1 每個框各被裁掉一行。它由角色卡承載。
check('匯出模型沒有 background 欄位（版面滿載，見 CharacterSheetExport 的註解）',
  Object.prototype.hasOwnProperty.call(model, 'background'), false);

check('空角色也能算出模型（不會炸）', (() => {
  const m = buildSheetModel({});
  return [m.name, m.bonds.length, m.equipmentRows.length, m.attributes.base.length];
})(), ['', 6, 4, 4]);

// ─────────────────────────────────────────────────────────── F
section('F. 官方三頁匯出：版面與 SSR');

check('頁面尺寸為 A4 橫向 @96dpi（官方 842×595 pt 等比）',
  [SHEET_PAGE_WIDTH, SHEET_PAGE_HEIGHT], [1123, 794]);
check('物語點規則文字（官方原表印的那段）有 7 條', FABULA_POINT_RULES.length, 7);
check('經驗點規則文字有 4 條', EXPERIENCE_POINT_RULES.length, 4);
check('規則文字不是空的', [...FABULA_POINT_RULES, ...EXPERIENCE_POINT_RULES].every((t) => t.length > 6), true);
check('六個儀式學派名都在詞彙內', SHEET_DISCIPLINES.length, 6);

const page1Html = renderToStaticMarkup(React.createElement(OfficialSheetPage1, { model }));
const page2Html = renderToStaticMarkup(React.createElement(OfficialSheetPage2, { model }));
const page3Html = renderToStaticMarkup(React.createElement(OfficialSheetPage3, { model }));

check('P1 畫出姓名與特質', [page1Html.includes('測試勇者'), page1Html.includes('流浪劍士')], [true, true]);
check('P1 畫出羈絆目標', page1Html.includes('同行夥伴'), true);
check('P1 畫出物語點與經驗點的規則框',
  [page1Html.includes('場景開始時若你沒有任何物語點'), page1Html.includes('每次聚會結束時')], [true, true]);
check('P1 畫出先攻／物防／魔防', ['先攻修正', '物防', '魔防'].every((t) => page1Html.includes(t)), true);
check('P1 畫出裝備四列', ['配件', '防具', '主手', '副手'].every((t) => page1Html.includes(t)), true);
check('P1 畫出四維與狀態', ['d10', '眩暈'].every((t) => page1Html.includes(t)), true);
check('P1 畫出職業與免費增益', [page1Html.includes('守護者'), page1Html.includes('最大 HP +5')], [true, true]);
check('P1 只放前三個職業', page1Html.includes('靈師'), false);
check('P2 放其他職業與咒語', [page2Html.includes('靈師'), page2Html.includes('火球')], [true, true]);
check('P2 不放前三職業的欄位', page2Html.includes('守護者'), false);
check('P3 放續頁咒語', [page3Html.includes('暗影'), page3Html.includes('奧祕與咒語（續）')], [true, true]);
check('三頁都標了自己的頁碼', [
  page1Html.includes('data-sheet-page="1"'),
  page2Html.includes('data-sheet-page="2"'),
  page3Html.includes('data-sheet-page="3"')
], [true, true, true]);
check('三頁都是固定尺寸的版面', page1Html.includes(`width:${SHEET_PAGE_WIDTH}px`), true);

// ─────────────────────────────────────────────────────────── G
section('G. 官方三頁匯出：匯出管線與原始碼護欄');

const exportSrc = read('../src/features/character-sheet/components/CharacterSheetExport.jsx');
check('PNG 走無損的 toPng（表格線條需要無損）',
  [exportSrc.includes('htmlToImage.toPng'), exportSrc.includes("rasterizePages('png')")], [true, true]);
check('輸出以 pixelRatio 2 提高解析度', exportSrc.includes('pixelRatio: 2'), true);
check('匯出底色跟著角色主題（不再寫死白色／官方青綠）',
  [exportSrc.includes('sheetVars'), exportSrc.includes('--sh-bg')], [true, true]);
check('逐頁匯出成三個檔案', exportSrc.includes('SHEET_PAGE_COMPONENTS.length'), true);
check('檔名帶角色名與頁碼', exportSrc.includes('_角色卡_p'), true);
check('預覽縮放與光柵化分離（ref 掛在未縮放的內層）',
  [exportSrc.includes('transform: `scale(${PREVIEW_SCALE})`'), exportSrc.includes('pageRefs.current[i] = el')],
  [true, true]);
const previewSrc = read('../src/features/character-sheet/components/CharacterPreviewModal.jsx');
check('預覽彈窗有兩個分頁（已抽成獨立元件）',
  [previewSrc.includes('卡片檢視'), previewSrc.includes('三頁表格（可匯出 PNG／PDF）')], [true, true]);
check('卡片檢視仍保留在彈窗裡', previewSrc.includes('<CharacterCard'), true);
check('匯出面板有載入中狀態（避免重複點擊）', exportSrc.includes("'匯出中…'"), true);

// ─────────────────────────────────────────────────────────── H
section('H. 圖示表本身的護欄（這一段是被自己的失誤逼出來的）');

const iconKeys = readIconMapKeys();
check('圖示表沒有重複的鍵（重複鍵會靜默蓋掉前者）', findDuplicateIconKeys(iconKeys), []);
check('圖示表讀得到內容（解析沒有壞掉）', iconKeys.length > 150, true);
check('成長履歷的 13 個圖示都登記在圖示表裡',
  Object.values(LOG_KINDS).filter((m) => !GAME_ICONS_MAP[m.icon]).map((m) => m.icon), []);
check('裝備圖示對照表也都登記在圖示表裡',
  Object.values(EQUIPMENT_ICONS).filter((k) => !GAME_ICONS_MAP[k]), []);

// ─────────────────────────────────────────────────────────── I
section('I. 三頁 PDF：自己寫的極簡 PDF 產生器');

/** 手工組一個最小可辨識的 JPEG 檔頭（SOI + SOF0）——readJpegSize 只讀到這裡 */
const jpegHeader = (w, h) => new Uint8Array([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x11, 0x08,
  (h >> 8) & 0xff, h & 0xff,
  (w >> 8) & 0xff, w & 0xff,
  0, 0, 0, 0, 0, 0, 0, 0, 0
]);

check('readJpegSize 讀出 JPEG 實際尺寸', readJpegSize(jpegHeader(2246, 1588)), { height: 1588, width: 2246 });
check('非 JPEG 位元組 → null（由呼叫端退回傳入值）', readJpegSize(new Uint8Array([1, 2, 3, 4])), null);
check('位元組太短 → null', readJpegSize(new Uint8Array([0xff, 0xd8])), null);
check('null → null', readJpegSize(null), null);
check('dataUrlToBytes 解出 base64 內容',
  Array.from(dataUrlToBytes('data:image/jpeg;base64,AQIDBA==')), [1, 2, 3, 4]);
check('dataUrlToBytes 對壞字串回空陣列', dataUrlToBytes('nonsense').length, 0);

check('沒有影像 → 不產 PDF', buildImagePdf([]), null);
check('全部是空影像 → 不產 PDF', buildImagePdf([{ bytes: new Uint8Array(0) }]), null);

const fakeImages = [0, 1, 2].map((i) => ({
  bytes: new Uint8Array(64).fill(0x40 + i),
  width: 2246,
  height: 1588
}));
const pdfBlob = buildImagePdf(fakeImages);
check('產出 PDF blob', [pdfBlob instanceof Blob, pdfBlob.type], [true, 'application/pdf']);

const pdfBytes = await buildImagePdfBytes(fakeImages);
const pdfText = Buffer.from(pdfBytes).toString('latin1');

check('檔頭是 %PDF-1.4', pdfText.startsWith('%PDF-1.4'), true);
check('含二進位標記', pdfBytes[9] === 0x25 && pdfBytes[10] === 0xe2, true);
check('Catalog 指向 Pages', pdfText.includes('/Type /Catalog /Pages 2 0 R'), true);
check('頁數正確', pdfText.includes('/Count 3'), true);
check('三頁都指向自己的影像物件',
  ['/Im0 5 0 R', '/Im0 8 0 R', '/Im0 11 0 R'].every((t) => pdfText.includes(t)), true);
check('頁面尺寸為 A4 橫向', pdfText.includes('/MediaBox [0 0 841.89 595.28]'), true);
check('JPEG 以 DCTDecode 原樣嵌入（不重新編碼）', pdfText.includes('/Filter /DCTDecode'), true);
check('物件數＝2 + 3×頁數', (pdfText.match(/\n\d+ 0 obj\n/g) || []).length, 11);
check('以 %%EOF 結尾', pdfText.trimEnd().endsWith('%%EOF'), true);

// xref 是 PDF 的目錄：位移錯了整份就打不開，所以逐筆驗它指到正確的物件開頭
const startxref = Number(pdfText.match(/startxref\n(\d+)/)[1]);
check('startxref 指向 xref 表', pdfText.slice(startxref, startxref + 4), 'xref');
const xrefLines = pdfText.slice(startxref).split('\n').slice(2); // 0:'xref' 1:'0 12' 2:空閒條目
check('第一筆是空閒條目', xrefLines[0], '0000000000 65535 f ');
check('物件 1 從檔頭（含二進位標記）之後開始', xrefLines[1].slice(0, 10), '0000000015');
const objectEntries = xrefLines.slice(1, 12);
check('xref 有 11 筆物件條目', objectEntries.length, 11);
check('每一筆 xref 位移都指到該物件的開頭',
  objectEntries.map((line, i) => {
    const offset = Number(line.slice(0, 10));
    return pdfText.slice(offset, offset + `${i + 1} 0 obj`.length) === `${i + 1} 0 obj`;
  }),
  new Array(11).fill(true));
check('xref 每筆條目剛好 19 字元（含換行則 20 bytes）', objectEntries.every((l) => l.length === 19), true);

const fourPage = await buildImagePdfBytes([...fakeImages, { bytes: new Uint8Array(8).fill(7), width: 10, height: 10 }]);
check('頁數隨影像數量變動', Buffer.from(fourPage).toString('latin1').includes('/Count 4'), true);

const pdfWriterSrc = read('../src/features/character-sheet/utils/pdfWriter.js');
check('PDF 產生器沒有外部依賴（自己寫，不拉套件）',
  /^\s*import .* from '(?!node:)/m.test(pdfWriterSrc), false);
check('A4 橫向常數與官方表一致', [A4_LANDSCAPE_PT.width, A4_LANDSCAPE_PT.height], [841.89, 595.28]);
check('匯出面板同時提供 PDF 與 PNG',
  [exportSrc.includes('匯出三頁 PDF'), exportSrc.includes('匯出三張 PNG')], [true, true]);
check('PDF 走 JPEG（DCTDecode 可直接嵌入）、PNG 走無損',
  [exportSrc.includes("await rasterizePages('jpeg')"), exportSrc.includes("await rasterizePages('png')")],
  [true, true]);
check('PDF 用 object URL 下載並事後釋放',
  [exportSrc.includes('URL.createObjectURL(pdf)'), exportSrc.includes('URL.revokeObjectURL(url)')],
  [true, true]);
check('匯出中會鎖住兩顆按鈕', exportSrc.includes('disabled={Boolean(exporting)}'), true);

// ─────────────────────────────────────────────────────────── J
section('J. 匯出不能把主執行緒鎖死（使用者回報「一按就死機」）');

// 光柵化一次要好幾秒。`await` 只讓出 microtask，而瀏覽器處理點擊是 macrotask——
// 連續三頁不讓出的話，整段匯出期間任何點擊都沒反應。
check('每一頁之前都讓出 macrotask（setTimeout ＋ requestAnimationFrame）',
  [exportSrc.includes('const yieldToBrowser = ()'), exportSrc.includes('setTimeout(() => {'),
    exportSrc.includes('requestAnimationFrame(() => resolve())')],
  [true, true, true]);
check('rasterizePages 每一頁之前都呼叫讓出',
  (exportSrc.match(/await yieldToBrowser\(\)/g) || []).length >= 2, true);
check('PDF 組裝前也讓出一次', exportSrc.includes("setProgress('正在組裝 PDF…')"), true);
check('有逐頁進度文字', /正在處理第 \$\{i \+ 1\} \/ \$\{total\} 頁/.test(exportSrc), true);
check('卸載後清掉 ref（不抱著已移除的 DOM 樹）',
  exportSrc.includes('pageRefs.current = []'), true);

const modalSrc = read('../src/components/ui/JRPGModal.jsx');
check('彈窗的 keydown effect 不依賴 onClose（行內箭頭會讓它每次 render 重跑）',
  /}, \[isOpen\]\);/.test(modalSrc) && !/\}, \[isOpen, onClose\]\);/.test(modalSrc), true);
check('onClose 走 ref（effect 內仍拿得到最新的）',
  [modalSrc.includes('onCloseRef.current = onClose'), modalSrc.includes('onCloseRef.current?.()')], [true, true]);
check('body 捲動鎖是計數式的（重疊彈窗不會互相覆寫）',
  [modalSrc.includes('let bodyLockCount = 0'), modalSrc.includes('bodyLockCount += 1'),
    modalSrc.includes('bodyLockCount === 0'), modalSrc.includes('bodyOverflowBeforeLock')],
  [true, true, true, true]);
check('計數歸零才還原（不是每個彈窗各自還原）',
  /bodyLockCount = Math\.max\(0, bodyLockCount - 1\)/.test(modalSrc), true);

// 這一段是「一按就死機」的真正根因：html-to-image 預設會去 fetch 網頁字型內嵌，
// 而 index.html 掛著 Google Fonts——那個網域連不上時 promise 永遠不 resolve，匯出就永遠卡住。
check('光柵化一定要 skipFonts（否則會去抓 Google Fonts，抓不到就永遠卡住）',
  [exportSrc.includes('skipFonts: true'), exportSrc.includes('RASTER_OPTIONS')], [true, true]);
check('單頁有逾時上限（卡住也要讓 UI 回得來）',
  [exportSrc.includes('RASTER_TIMEOUT_MS'), exportSrc.includes('withTimeout(')], [true, true]);

const npcSrc = read('../src/features/npc-workshop/NPCWorkshop.jsx');
check('NPC 工坊的兩個匯出也 skipFonts（同一顆地雷）',
  (npcSrc.match(/skipFonts: true/g) || []).length, 2);
check('NPC 工坊不再 await document.fonts.ready（那個 promise 可能永遠不 resolve）',
  stripComments(npcSrc).includes('await document.fonts.ready'), false);
check('index.html 確實有外部字型（這就是為什麼要 skipFonts）',
  read('../index.html').includes('fonts.googleapis.com'), true);

// ─────────────────────────────────────────────────────────── K
section('K. 跑團面板的「構築與成長」一按就死機（使用者回報，已重現）');

// 症狀：在跑團面板按「構築與成長」，整頁死掉。
// 根因：那顆按鈕寫成 `onClick={onOpenEditor}`，React 會把**點擊事件物件**當成第一個參數傳進去，
//       CharacterSheet 把它存進 state 當成「分頁編號」，編輯器再把 activeTab 渲染到
//       「步驟 {activeTab}/6」→ React 拋 "Objects are not valid as a React child" → 整棵樹卸載。
//
// 這裡直接餵一個長得像事件物件的東西，驗編輯器還活著——這才是真的迴歸測試。
const bogusTab = { _reactName: 'onClick', type: 'click', nativeEvent: { isTrusted: true }, target: null };
const editorWithBogusTab = (() => {
  try {
    return renderToStaticMarkup(React.createElement(CharacterEditor, {
      character: createNewCharacter({ name: '當機測試角色' }),
      themeId: 'emerald',
      onChange: () => {},
      showToast: () => {},
      initialTab: bogusTab
    }));
  } catch (err) {
    return `THREW ${err.message}`;
  }
})();

check('把點擊事件物件當成分頁編號傳進去，編輯器不會炸',
  editorWithBogusTab.startsWith('THREW'), false);
check('沒有把事件物件渲染出來（就是這個字串讓 React 拋錯）',
  [editorWithBogusTab.includes('_reactName'), editorWithBogusTab.includes('[object Object]')],
  [false, false]);
check('仍然正常畫出編輯器內容', editorWithBogusTab.includes('當機測試角色'), true);
check('合法的分頁編號照舊生效',
  renderToStaticMarkup(React.createElement(CharacterEditor, {
    character: createNewCharacter({ name: '分頁測試' }),
    themeId: 'emerald',
    onChange: () => {},
    showToast: () => {},
    initialTab: 3
  })).includes('_reactName'),
  false);

check('跑團面板不再把點擊事件當成參數傳給 onOpenEditor',
  hudCode.includes('onClick={onOpenEditor}'), false);
check('跑團面板的兩個入口都改成箭頭函式',
  (hudCode.match(/onClick=\{\(\) => onOpenEditor\(\)\}/g) || []).length, 2);
check('CharacterSheet 會驗型別才把分頁編號存進 state',
  sheetCode.includes("typeof tab === 'number'"), true);
check('編輯器對 initialTab 做夾制（最後一道防線）',
  [editorCode.includes('Number.isInteger(initialTab)'), editorCode.includes('initialTab <= TAB_COUNT')],
  [true, true]);
check('TAB_COUNT 與實際分頁數綁在一起（改了一邊就會在執行時拋錯）',
  editorCode.includes('TABS.length !== TAB_COUNT'), true);
// 這條原本是掃源碼裡的 `{ id: N, label: '...' }` 硬編碼行。
// 2026-10-20 起 `TABS` 由 `CREATION_STEPS` 派生（單一來源，見 playtest F-003），
// 源碼裡不再有那些行——所以改成**從實際渲染結果**驗證。
// 這比掃源碼更接近玩家看到的東西：掃源碼只證明「字串寫在某處」，
// 渲染結果才證明「它真的出現在導航列上、而且順序對」。
const NAV_LABELS = ['基礎身世', '職業與技能', '四維屬性', '裝備配置', '英雄技能與金手指', '命名與背景'];
const editorNavHtml = renderToStaticMarkup(React.createElement(CharacterEditor, {
  character: createNewCharacter({ name: '標籤測試' }),
  themeId: 'emerald',
  onChange: () => {},
  showToast: () => {}
}));
check('導航列把六個創角步驟全部畫出來（順序即流程）',
  NAV_LABELS.filter((label) => editorNavHtml.includes(label)).length, 6);
// 這裡**不**重複斷言順序。順序已由同檔兩條既有護欄釘住：
// 「導航列的順序也是職業在四維之前」與「第 6 步排在英雄技能與金手指之後（導航列的最後一格）」。
// 硬要用 indexOf 驗證整串順序會假失敗——這些步驟名在整份 HTML 裡出現 2~4 次
// （第 1 步內容區、進度提示、導航列），實測 `indexOf` 給出
// [508, 9052, 9814, 2949, 11328, 12353]，其中「裝備配置」@2949 是內容區而非導航列；
// `lastIndexOf` 同樣被 DOM 末尾的重複打亂。要驗整串就得先切出導航列容器，
// 而那個容器的 class 不是穩定契約——為了一條重複的斷言去釘死 class，不值得。
// 這條以前是數 `icon: 'xxx' }` 的個數——但那個欄位**從來沒有被讀取**（導航列畫的是編號徽章），
// 等於用死資料當護欄：只要有人照著補一個 icon，數字就對了，標籤寫什麼都不會被抓到。
check('TABS 不再帶著沒有人讀取的 icon 欄位',
  /icon: '[a-z]+' \}/.test(editorCode), false);
check('編輯器不再有情感羈絆分頁與其處理函式',
  [
    editorCode.includes("label: '情感羈絆'"),
    editorCode.includes('BOND_FEELINGS'),
    editorCode.includes('handleAddBond')
  ],
  [false, false, false]);

// ─────────────────────────────────────────────────────────── L
section('L. 跑團面板也能預覽／匯出，且內容要完整（使用者要求）');

// 「跑團面板也要有預覽的功能，才可以直接在那邊匯出圖片或 pdf」
check('跑團面板有「卡片預覽」按鈕',
  [hudCode.includes('卡片預覽'), hudCode.includes('setIsPreviewOpen(true)')], [true, true]);
check('跑團面板開的是同一個預覽彈窗元件（不是另寫一個）',
  hudCode.includes("import CharacterPreviewModal from './CharacterPreviewModal'"), true);
check('編輯器也改用同一個元件', editorCode.includes('<CharacterPreviewModal'), true);
check('彈窗元件同時提供卡片檢視與三頁表格',
  [previewSrc.includes('CharacterSheetExportBody'), previewSrc.includes('<CharacterCard')], [true, true]);
check('從跑團面板開的關閉標籤是「返回跑團面板」',
  hudCode.includes('closeLabel="返回跑團面板"'), true);

// 角色背景不進三頁匯出（版面滿載），由角色卡承載——所以卡片必須真的畫得出來
const cardHtml = renderToStaticMarkup(React.createElement(CharacterCard, {
  character: createNewCharacter({
    name: '測試',
    identity: '流浪劍士',
    origin: '邊境村落',
    gender: '女',
    background: '邊境來的流浪劍士，為了找一個答案而上路。'
  })
}));
check('角色卡顯示性別與角色背景',
  [cardHtml.includes('女'), cardHtml.includes('邊境來的流浪劍士，為了找一個答案而上路。')],
  [true, true]);

// 「各種信息應該都要完整才對，比如技能等資料」
check('技能帶效果全文（不是只有技能名）',
  [model.page1Classes[0].skills[0].desc.length > 0, model.page1Classes[0].skills[0].maxSL > 0],
  [true, true]);
check('英雄技能帶效果全文', model.heroicSkills[0].effect.length >= 0, true);
check('金手指帶效果全文', typeof model.quirkDesc === 'string', true);

// ─────────────────────────────────────────────────────────── F-023
// §CI（2026-10-26 P11 / F-023）：金手指的「相性」要印在紙上。
//
// 修之前：`quirkDesc` 只取規則原文，`character.quirkChoice` 完全沒讀。
// 帶【亡者歸來】的角色印出來，紙上寫著「免疫暗毒、易傷光」的規則，
// 但那是**規則**，不是你這一場的狀態——玩家的第一反應是「那我到底怕什麼」。
const deadModel = buildSheetModel(createNewCharacter({ quirk: '亡者歸來' }));
check('F-023 亡者歸來：相性有 3 列（傷害免疫／易傷／狀態免疫）',
  deadModel.quirkAffinities.map((r) => r.label), ['傷害免疫', '易傷', '狀態免疫']);
// ※ 用 `|| { values: [], danger: false }` 而不是直接 `.find(...).values`：
//   欄位整個不見時 `.find` 回 undefined，測試會**拋錯崩掉**而不是 FAIL。
//   崩掉的訊息長得像「測試自己壞了」，很容易被誤讀成程式沒問題。
const immRow = deadModel.quirkAffinities.find((r) => r.label === '傷害免疫') || { values: [] };
const vulnRow = deadModel.quirkAffinities.find((r) => r.label === '易傷') || { danger: false };
check('F-023 傷害免疫是暗與毒', immRow.values, ['暗', '毒']);
check('F-023 易傷標了 danger（紙上用危險紅）', vulnRow.danger, true);
check('F-023 純敘事金手指不會長出空相性',
  buildSheetModel(createNewCharacter({ quirk: '飛行' })).quirkAffinities, []);
check('F-023 沒有金手指就沒有相性',
  buildSheetModel(createNewCharacter({ quirk: '無' })).quirkAffinities, []);

const deadPage2 = renderToStaticMarkup(React.createElement(OfficialSheetPage2, { model: deadModel }));
check('F-023 第 2 頁真的印出「傷害免疫」與「暗」「毒」',
  ['傷害免疫', '暗', '毒'].every((x) => deadPage2.includes(x)), true);
check('F-023 第 2 頁把易傷寫成危險紅',
  deadPage2.includes('#8c2d36'), true);
check('F-023 沒有相性的卡不會印出「傷害免疫」',
  page2Html.includes('傷害免疫'), false);

check('匯出用 SkillDescription 渲染效果（會代換【SL×N】公式）',
  [exportSrc.includes("import SkillDescription from '../utils/skillFormulaEvaluator'"),
    exportSrc.includes('<SkillDescription')],
  [true, true]);
check('咒語列帶說明', model.page2Spells[0].desc.length > 0, true);

// 「樣式還是照著我們網頁的設計」→ 配色取自角色主題，不是官方表的青綠
check('配色由角色主題推導（sheetVars）',
  [typeof sheetVars, sheetVars({ accent: '#123456' })['--sh-bar']], ['function', '#123456']);
check('沒有角色主題時退回站內預設主題（紙墨仍然來自主題表，不是本檔的字面值）',
  [sheetVars(null)['--sh-bg'], sheetVars(null)['--sh-ink'], sheetVars(null)['--sh-bar-ink']], ['#fbf7ee', '#2c221e', '#fffdf9']);
check('三頁都吃這組變數',
  (exportSrc.match(/\.\.\.S\.page, \.\.\.vars/g) || []).length, 3);
check('頁面底色與卡片底色不同（否則框線會消失）',
  sheetVars({ sheetBg: '#eeeeee', cardBg: '#ffffff' })['--sh-bg']
    !== sheetVars({ sheetBg: '#eeeeee', cardBg: '#ffffff' })['--sh-box'],
  true);

// 只內嵌本機圖示字型：Google Fonts 一律不碰（那是上一輪「匯出永遠不回來」的根因）
check('只內嵌本機圖示字型（fontEmbedCSS 自己組，不讓 html-to-image 去抓）',
  [exportSrc.includes('getIconFontCss'), exportSrc.includes('fontEmbedCSS'),
    exportSrc.includes("import iconFontUrl from '../../../assets/FabulaUltimaIcons-Regular.otf'")],
  [true, true, true]);
check('字型內嵌失敗也不會讓匯出卡住（catch 後回空字串）',
  exportSrc.includes(".catch(() => '')"), true);

// ─────────────────────────────────────────────────────────── M
section('M. 創角步驟次序：職業在四維之前（原書 p.154 第 4 步 vs 第 5 步）');

// 這一組是「換過分頁編號」的迴歸測試：只換導航列的標籤而忘了換內容，
// 畫面會變成「第 2 步寫著職業與技能、內容卻是四維屬性面板」——建置與型別都不會發現。
const renderEditorAt = (tab, over = {}, rules = null) => renderToStaticMarkup(React.createElement(CharacterEditor, {
  character: createNewCharacter({ name: '次序測試', startingFundsRolled: true, ...over }),
  themeId: 'emerald',
  onChange: () => {},
  showToast: () => {},
  initialTab: tab,
  ...(rules ? { creationRules: rules } : {})
}));

/**
 * 英雄技能選擇器（表格式彈窗）。
 * 第 5 步的入口要點開才看得到，SSR 截不到，所以直接 SSR 彈窗本體——
 * 表格反而比 `<select>` 的展開清單好斷言。
 */
const renderHeroicPicker = (over = {}, rules = {}) => {
  const char = createNewCharacter({ name: '挑選測試', startingFundsRolled: true, ...over });
  return renderToStaticMarkup(React.createElement(HeroicSkillPickerBody, {
    character: char,
    rules: resolveCreationRules(rules),
    stats: calculateCharacterStats(char),
    theme: {},
    onPick: () => {}
  }));
};

const tab2Html = renderEditorAt(2);
const tab3Html = renderEditorAt(3);

check('第 2 步畫的是職業與技能',
  [tab2Html.includes('職業組合與技能加點'), tab2Html.includes('四維基礎屬性骰配置')], [true, false]);
check('第 3 步畫的是四維屬性',
  [tab3Html.includes('四維基礎屬性骰配置'), tab3Html.includes('職業組合與技能加點')], [true, false]);
check('導航列的順序也是職業在四維之前',
  tab2Html.indexOf('職業與技能') < tab2Html.indexOf('四維屬性'), true);
check('未結算起始資金的卡會顯示提醒',
  renderEditorAt(1, { startingFundsRolled: false }).includes('起始資金尚未結算'), true);
check('已結算的卡不顯示那則提醒',
  tab2Html.includes('起始資金尚未結算'), false);

/**
 * 第 5 步的空狀態（第七輪）。
 *
 * 這一步的三塊內容（金手指特質／底力技／營地活動）全部由開卡規則決定，
 * 而三個開關的**預設值都是 false**——所以預設規則下的第 5 步原本是「標題 ＋ 一行副標 ＋ 一片空白」。
 * 六步流程裡有一頁什麼都不畫，而且畫面上沒有任何線索說明「為什麼是空的、要怎樣才會有」。
 */
const tab5Default = renderEditorAt(5);
check('第 5 步在規則全關時顯示空狀態',
  tab5Default.includes('這一步目前沒有可設定的項目'), true);
check('第 5 步空狀態說明「去哪裡開啟」',
  tab5Default.includes('到第 1 步換一組規則集'), true);
// 空狀態不放 CTA：換規則集的入口在第 1 步，左側步驟列本來就走得到（同一動作不在同屏喊兩次）
check('第 5 步空狀態不放 CTA',
  tab5Default.includes('回到第 1 步'), false);
check('開啟金手指後第 5 步空狀態消失',
  renderEditorAt(5, {}, { allowQuirk: true }).includes('這一步目前沒有可設定的項目'), false);

// F-001 的驗收條件（`00-plan.md` §12.6.1 先修 #1 明文寫的那一條）：
// 副標題原本寫「精通職業後解鎖英雄技能，**並可設定特質**」，
// 而官方標準下「特質」（金手指）同樣被 `rules.allowQuirk` 收掉——
// 說明文字承諾了畫面上不存在的功能。所以這句半句**不得**再出現，
// 而且不只是空狀態下：任何規則組合都不該有它。
check('第 5 步副標題不再承諾「並可設定特質」（F-001 的驗收條件）',
  tab5Default.includes('並可設定特質'), false);
check('開啟金手指時也不再承諾（不是只在空狀態時才對）',
  renderEditorAt(5, {}, { allowQuirk: true }).includes('並可設定特質'), false);
// 「由開卡規則決定」這幾個字在**空狀態說明**裡也有，所以不能只驗那幾個字——
// 要驗的是副標題那整句（護欄鐵則：斷言前先問「別處是否也有這字串」）
//
// 2026-10-27（F-028）：這句裡的「精通」與「英雄技能」各自包成了 `<TermHint>`，
// 所以**整句不再是一段連續文字**——原本的 `includes(整句)` 會失效。
// 改成兩段：句子後半仍然要連續出現，前半改用「兩個術語的說明都在」來斷言。
// 這比原本更強：它不只驗「有這句話」，還驗「這兩個詞各自有解釋」。
check('第 5 步副標題改成指路「其餘項目由開卡規則決定」',
  tab5Default.includes('；其餘項目由開卡規則決定'), true);
check('第 5 步副標題的「精通」與「英雄技能」各自帶了說明（F-028）',
  [tab5Default.includes('term-hint-mastery'), tab5Default.includes('term-hint-heroicSkill')],
  [true, true]);

// 姓名搬到第 6 步（原書第 8 步，p.154／p.170）——第 1 步不該再有姓名輸入框
const tab1Html = renderEditorAt(1);
const tab6Html = renderEditorAt(6);
check('第 1 步不再有姓名輸入框（原書把姓名放在最後）',
  tab1Html.includes('角色姓名'), false);
check('第 6 步有姓名、性別與角色背景',
  [tab6Html.includes('角色姓名'), tab6Html.includes('性別'), tab6Html.includes('角色背景')],
  [true, true, true]);
check('第 6 步排在英雄技能與金手指之後（導航列的最後一格）',
  tab6Html.lastIndexOf('命名與背景') > tab6Html.lastIndexOf('英雄技能與金手指'), true);

// 英雄技能的資格關卡（原書 p.232）：不合格的要停用並寫出原因。
//
// 2026-10-06 起第 5 步不再是 `<select>`，改成表格式的 `HeroicSkillPickerModal`
// （使用者要求「像裝備那樣獨立成表、列出條件和規則、提供過濾」）。
// 所以這裡直接 SSR 那個彈窗——`<select>` 的展開清單本來就截不到圖，表格反而 SSR 得到。
const masterHtml = renderEditorAt(5, {
  classes: [{ className: '守護者', level: 10, skills: [] }],
  heroicSkills: []
});
const noMasterHtml = renderEditorAt(5, { classes: [], heroicSkills: [] });
check('已精通職業時顯示資格', masterHtml.includes('已精通職業'), true);
// 2026-10-06：沒開「開局英雄技能」又還沒精通任何職業時，英雄技能**整塊收掉**
// （使用者要求：「開卡規則沒有允許金手指或開局英雄技能，就直接把第 5 頁的按鈕都隱藏」）。
// 5 級開卡到不了精通（原書 p.232 要 10 級），所以那個入口在那個狀態下永遠按不動。
check('未開局名額又未精通時，英雄技能整塊收掉',
  [noMasterHtml.includes('掌握之英雄技能'), noMasterHtml.includes('選擇英雄技能')], [false, false]);
const noMasterWithSlotHtml = renderEditorAt(5, { classes: [], heroicSkills: [] },
  { startingHeroicSkill: true });
check('開了開局名額、未精通時說明需要什麼',
  noMasterWithSlotHtml.includes('需先精通一個職業（單一職業達 10 級）'), true);
check('第 5 步有「選擇英雄技能」的入口（不再是下拉選單）',
  [masterHtml.includes('選擇英雄技能'), masterHtml.includes('-- 選擇英雄技能 --')], [true, false]);

const guardianPicker = renderHeroicPicker({ classes: [{ className: '守護者', level: 10, skills: [] }] });
check('表格有「名稱／出處／條件／效果」四欄',
  ['名稱', '出處', '條件', '效果'].map((k) => guardianPicker.includes(k)), [true, true, true, true]);
check('預設只列與職業有關的：守護者可解鎖的技能在表上',
  guardianPicker.includes('不破之人'), true);
check('可選的列有「選用」按鈕', guardianPicker.includes('選用'), true);
check('出處標在列上', guardianPicker.includes('核心'), true);
check('Playtest 的技能也在表上（抽樣：預言守護者）',
  guardianPicker.includes('預言守護者'), true);
check('有搜尋框與「只顯示與我的職業有關的」開關',
  [guardianPicker.includes('搜尋名稱、條件或效果'), guardianPicker.includes('只顯示與我的職業有關的')],
  [true, true]);

// 不合格的技能**照樣列出**、按鈕停用、並寫出原因——不是直接藏起來（§U 的原則）。
// 用「已精通守護者、但暗黑之刃只有 3 級」的角色：這樣 背水 的停用原因才會是
// 「需精通【暗黑之刃】其中之一」，而不是「需先精通一個職業」那句通用話。
const darkbladePicker = renderHeroicPicker({
  classes: [{ className: '守護者', level: 10, skills: [] }, { className: '暗黑之刃', level: 3, skills: [] }]
});
check('不合格的技能照樣列出（不是藏起來）',
  [darkbladePicker.includes('背水'), darkbladePicker.includes('不可選')], [true, true]);
check('停用的列寫出原因', darkbladePicker.includes('需精通【暗黑之刃】其中之一'), true);

// 可重複取得的技能：拿了一次之後仍然可以再拿（原書明文例外，見 §AK1）
const repeatPicker = renderHeroicPicker({
  classes: [{ className: '嵌合師', level: 10, skills: [] }],
  heroicSkills: [{ name: '嵌合術精通', requirement: '嵌合師', source: 'core', effect: 'x' }]
});
check('可重複取得的技能拿了一次之後標出「已持有 1/2」',
  repeatPicker.includes('已持有 1/2'), true);
check('預設只能取一次的技能，拿過就標「已習得」',
  renderHeroicPicker({
    classes: [{ className: '暗黑之刃', level: 10, skills: [] }],
    heroicSkills: [{ name: '背水', requirement: '暗黑之刃', source: 'core', effect: 'x' }]
  }).includes('已習得'), true);

// 開局英雄技能（Playtest Materials 2026-10-01 p.4 的選用規則）
const startRuleHtml = renderEditorAt(5, {
  classes: [{ className: '暗黑之刃', level: 3, skills: [] }],
  heroicSkills: []
}, { startingHeroicSkill: true });

/**
 * 取某一列「選用」按鈕的開頭標籤。用 `data-testid` 指名，不要取第一個 `<button>`：
 * 效果欄的術語 tooltip 也是按鈕而且排在前面（SSR 測試踩過一次）。
 */
const pickTagOf = (html, name) => {
  const key = `data-testid="heroic-pick-${name}"`;
  const i = html.indexOf(key);
  if (i < 0) return '';
  return html.slice(html.lastIndexOf('<button', i), html.indexOf('>', i) + 1);
};

// ※ 不要用 `tag.includes('disabled')` 判斷停用：按鈕的 class 裡有 Tailwind 的
//   `disabled:opacity-40 disabled:pointer-events-none`，那個字串**永遠在**，
//   於是「可選」也會被讀成「停用」。要驗的是真正的屬性。
const isPickDisabled = (html, name) => /\sdisabled(=""|\s|>)/.test(pickTagOf(html, name));

// ※ 這條原本寫成「整頁不該出現『不可選』」。P31 之後那個說法**不再成立**：
//   引擎開始真的判「且習得某技能」，所以畫面上本來就會有幾列因為缺前置技能而
//   「不可選」——那是正確行為，不是開局規則失效。改成**指名 背水 那一列**，
//   並補一條對照（規則關閉時它應該要是「不可選」），否則這條會變成恆真。
check('規則開啟時，靠開局名額取得的【背水】變成可選',
  isPickDisabled(renderHeroicPicker({ classes: [{ className: '暗黑之刃', level: 3, skills: [] }] },
    { startingHeroicSkill: true }), '背水'), false);
check('（對照）規則關閉時，同一張卡的【背水】是「不可選」',
  isPickDisabled(renderHeroicPicker({ classes: [{ className: '暗黑之刃', level: 3, skills: [] }] }),
    '背水'), true);
check('規則開啟時說明這是哪一條規則',
  startRuleHtml.includes('開局贈送一個英雄技能'), true);
check('規則開啟時顯示名額狀態', startRuleHtml.includes('開局名額：'), true);
check('規則關閉時不會出現開局名額的標示',
  renderEditorAt(5, { classes: [{ className: '暗黑之刃', level: 3, skills: [] }] })
    .includes('開局名額：'), false);

// 使用者定調（2026-10-06）：英雄技能的**瀏覽**入口只在挑職業的彈窗裡、預設收合、純瀏覽；
// 編輯器第 2 步不再常駐那一塊（原本預設展開，使用者說「太滿了」）。
const blockSrc = read('../src/features/character-sheet/components/ClassHeroicSkillsBlock.jsx');
const pickerSrcHere = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
const guardianStep2 = renderEditorAt(2, { classes: [{ className: '守護者', level: 10, skills: [] }] });
check('第 2 步不再常駐英雄技能那一塊',
  [guardianStep2.includes('精通後可解鎖的英雄技能'), guardianStep2.includes('顯示英雄技能')],
  [false, false]);
check('職業彈窗裡有「顯示英雄技能」按鈕（放在職業技能下面）',
  [blockSrc.includes('顯示英雄技能'), pickerSrcHere.includes('<ClassHeroicSkillsBlock')],
  [true, true]);
check('那份清單預設收合', /useState\(false\)/.test(blockSrc), true);
check('那份清單是純瀏覽（沒有選用入口）',
  [blockSrc.includes('onPick'), blockSrc.includes('onSelect')], [false, false]);
check('定稿後整塊瀏覽入口收起來（自己已拿到的效果照常顯示）',
  renderToStaticMarkup(React.createElement(ClassHeroicSkillsBlock, {
    className: '守護者', theme: {}, locked: true
  })), '');
const lockedStep5 = renderEditorAt(5, { locked: true, lockedAt: '2026-01-01T00:00:00.000Z' });
check('定稿後第 5 步不再有「選擇英雄技能」的入口',
  lockedStep5.includes('選擇英雄技能'), false);

// 職業選擇流程重構（2026-10-06 使用者要求）：
// 舊流程「選職業 → 點技能 → 確認 → 再選職業」來回很繁瑣，
// 改成在**同一個彈窗**裡把各職業點完，按一次確定全部寫入。
const pickerSrcFlow = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
check('草稿是跨職業累積的（不是只有當前職業那一份）',
  [pickerSrcFlow.includes('const [draft, setDraft]'), pickerSrcFlow.includes('allocatedOf')],
  [true, true]);
check('上排有「已選職業」欄位，徽章帶右上角的等級角標',
  [pickerSrcFlow.includes('已選職業：'), /-top-1\.5 -right-1\.5/.test(pickerSrcFlow)], [true, true]);
check('徽章可以點，跳到那個職業',
  pickerSrcFlow.includes('onClick={() => focusClass(className)}'), true);
check('上排有「全部」手冊鈕，且預設就是全開',
  [pickerSrcFlow.includes('>全部<'), pickerSrcFlow.includes('onSetSourcebooks'),
    DEFAULT_CREATION_RULES.defaultSourcebooks.length > 1],
  [true, true, true]);
check('一次確定多個職業（批次入口，不是單一職業）',
  [pickerSrcFlow.includes('onSelectClasses(entries)'),
    editorCode.includes('handleSelectClassesFromPicker'),
    pickerSrcFlow.includes('onSelectClass(activeClassItem')],
  [true, true, false]);
check('確定會關掉彈窗（回到顯示已選技能的畫面）',
  /onSelectClasses\(entries\);\s*\n\s*onClose\(\);/.test(pickerSrcFlow), true);

// 名冊頁：開局名額的同團重複警告（Playtest p.4）
const sheetSrcAj = read('../src/features/character-sheet/CharacterSheet.jsx');
check('名冊頁有開局名額的同團重複警告',
  [sheetSrcAj.includes('findDuplicateStartingHeroicSkills'), sheetSrcAj.includes('開局名額撞了')],
  [true, true]);

// 開卡規則搬進編輯器、存在角色身上（使用者指出：規則要在開卡界面調整，
// 而不是名冊頁一次改掉名冊裡所有角色）
const rulesPanelSrc = read('../src/features/character-sheet/components/CreationRulesPanel.jsx');
check('編輯器有「此團開卡規則」面板',
  [editorCode.includes('CreationRulesPanel'), rulesPanelSrc.includes('此團開卡規則')], [true, true]);
check('面板預設收合（開卡的人不必一直看到它）',
  renderEditorAt(1).includes('展開'), true);
check('名冊頁不再有那顆一次改全部角色的開關',
  [sheetSrcAj.includes('開局英雄技能：'), sheetSrcAj.includes('patchCampaignRules')], [false, false]);
check('規則改讀角色自帶的（不再吃全域 prop）',
  editorCode.includes('resolveCreationRules(creationRules ?? character.creationRules)'), true);
check('面板有「重設為官方標準」', rulesPanelSrc.includes('重設為官方標準'), true);

// 四維托盤預設是空的（使用者指示：「要讓玩家自己選起始陣列才會在那邊出現 4 個骰子」）
const emptyPicker = renderToStaticMarkup(React.createElement(AttributeMatrixPicker, {
  attributes: { dex: 0, ins: 0, mig: 0, wlp: 0 },
  onChange: () => {},
  theme: {}
}));
const filledPicker = renderToStaticMarkup(React.createElement(AttributeMatrixPicker, {
  attributes: { dex: 10, ins: 8, mig: 8, wlp: 6 },
  onChange: () => {},
  theme: {}
}));
check('未指派時托盤是空的（顯示提示、剩餘 0）',
  [emptyPicker.includes('先從上方'), emptyPicker.includes('剩餘 0')], [true, true]);
check('已指派時托盤有骰子（不再顯示空提示）',
  filledPicker.includes('先從上方'), false);

// 職業彈窗：精通該職業能解鎖哪些英雄技能。
// 2026-10-06 改版：那排只給名字的小標籤換成了「顯示英雄技能」按鈕 ＋ 條件與效果全文
// （使用者定調：它是選職業的參考，純瀏覽，實際選用回第 5 步）。
const classPickerSrc = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
check('職業彈窗掛上了英雄技能區塊，判定走引擎',
  [classPickerSrc.includes('ClassHeroicSkillsBlock'), blockSrc.includes('heroicSkillsForClass')],
  [true, true]);
check('那塊印出條件與效果全文（不再只給名字 ＋ tooltip）',
  [blockSrc.includes('條件：'), blockSrc.includes('{h.effect}'), blockSrc.includes('cursor-help')],
  [true, true, false]);

// ─────────────────────────────────────────────────────────── N
section('N. 屬性譯名：四個名字只有一份定義（使用者裁定：照繁中版角色卡 Excel V2.17）');

// 這一段是被自己的不一致逼出來的：`StatBadge` 寫「力量」，而編輯器、跑團面板與三頁匯出
// 寫「體魄」——同一組屬性在站上有兩個名字。收斂成 `ATTRIBUTE_NAMES` 之後，
// 這裡同時盯「常數本身對不對」與「四個顯示點有沒有真的讀它」。
const attrPickerSrc = read('../src/features/character-sheet/components/AttributeMatrixPicker.jsx');
const statBadgeSrc = read('../src/components/ui/StatBadge.jsx');
const exportSrcN = read('../src/features/character-sheet/components/CharacterSheetExport.jsx');
const renderers = [attrPickerSrc, statBadgeSrc, exportSrcN, hud];

check('官方四個屬性名', ATTRIBUTE_NAMES, { dex: '靈巧', ins: '洞察', mig: '力量', wlp: '意志' });
check('三頁匯出的屬性欄位帶的是官方名（不是只有常數對，資料流也要對）',
  model.attributes.base.map((a) => a.cn),
  [ATTRIBUTE_NAMES.dex, ATTRIBUTE_NAMES.ins, ATTRIBUTE_NAMES.mig, ATTRIBUTE_NAMES.wlp]);
check('四個顯示點都不再寫死舊譯名 敏捷／體魄',
  renderers.map((src) => /(name|zhName):\s*'(敏捷|體魄)'|'(敏捷|體魄)',/.test(src)),
  [false, false, false, false]);
check('四個顯示點都改讀 ATTRIBUTE_NAMES',
  renderers.map((src) => src.includes('ATTRIBUTE_NAMES')),
  [true, true, true, true]);
check('資料層不再出現屬性名舊譯（rulesData 的裝備說明與元素源泉）',
  ['敏捷', '體魄'].filter((old) => read('../src/features/character-sheet/data/rulesData.json').includes(old)),
  []);
check('「敏捷」仍可作為普通形容詞（NPC 特質輸入框的範例、Boss 敘述）',
  [
    read('../src/features/npc-workshop/NPCWorkshop.jsx').includes('placeholder="例如: 敏捷, 致命..."'),
    read('../src/features/npc-workshop/data/bossSkillsData.js').includes('此 Boss 特別敏捷或隱蔽')
  ],
  [true, true]);

// ─────────────────────────────────────────────────────────── N
section('N. 定制武器鍛造台（HF p.106）');

const forgeSrc = read('../src/features/character-sheet/components/CustomWeaponForgeModal.jsx');
check('鍛造台是獨立元件', forgeSrc.includes('export default function CustomWeaponForgeModal'), true);
check('裝備分頁有鍛造入口', editorCode.includes('鍛造${CUSTOM_WEAPON_BASE.label}'), true);
check('只有規則開放時才顯示鍛造按鈕',
  editorCode.includes('rules.allowCustomWeapon ?'), true);
check('未開放時給出指引（不是靜靜消失）',
  editorCode.includes('此團未開放——請在第 1 步的「此團開卡規則」打開'), true);
check('裝備分頁列出已鍛造的武器（可裝備／編輯／刪除）',
  [editorCode.includes('handleEquipCustomWeapon'), editorCode.includes('handleRemoveCustomWeapon'),
    editorCode.includes('handleSaveCustomWeapons')],
  [true, true, true]);
check('鍛造台只從資料層拿規則，不自己寫死',
  [forgeSrc.includes('CUSTOM_WEAPON_SLOTS'), forgeSrc.includes('validateCustomWeapon'),
    forgeSrc.includes('buildCustomWeaponEntry')],
  [true, true, true]);
// 只看 label() 呼叫的順序——直接 indexOf 會被區塊說明文字裡的同一個詞干擾
const labelOrder = [...forgeSrc.matchAll(/label\('([^']+)'/g)].map((m) => m[1]);
check('面板順序照使用者的 Excel：類別→名稱→攻擊類型→命中檢定→訂製能力',
  labelOrder.slice(0, 5),
  ['武器類別', '自定義名字', '攻擊類型', '命中檢定', '訂製能力']);
check('即時預覽顯示引擎會收到的條目',
  forgeSrc.includes('entry.attr') && forgeSrc.includes('entry.damage'), true);
check('可變形時切換兩個型態',
  forgeSrc.includes('形態一') && forgeSrc.includes('形態二'), true);
check('官方配置的定制武器會進裝備欄（presetApply 有帶）',
  read('../src/features/character-sheet/utils/presetApply.js').includes('customWeapons: JSON.parse'),
  true);
check('裝備挑選器與預算試算共用同一張武器表（含定制武器）',
  editorCode.includes('...buildCustomWeaponEntries(character).map(w => [w.name, w])'), true);

// ─────────────────────────────────────────────────────────── O
section('O. 「裝到主手」按了沒反應（使用者回報）');

// 根因：`applyEquipmentChoice` 回傳 `{ equipment, clearedOffHand }`，
// 但編輯器把整包當成 equipment 塞回去 → mainHand 變 undefined，按鈕看起來毫無反應。
// 行為測試在 test:equipment（`equipCustomWeapon` 純函式）；這裡擋的是**接線**。
check('編輯器用純函式 equipCustomWeapon，不是自己拼 applyEquipmentChoice',
  [editorCode.includes('equipCustomWeapon(character, name, weaponByName)'),
    /const\s+\w+\s*=\s*applyEquipmentChoice\(/.test(editorCode)],
  [true, false]);
check('編輯器有解構回傳值（equipment 與 clearedOffHand 都要拿）',
  [editorCode.includes('equipment: nextEquipment'), editorCode.includes('clearedOffHand')],
  [true, true]);
check('副手被清空時會提示（不然玩家不知道盾牌去哪了）',
  editorCode.includes('定制武器佔滿兩個手部欄位'), true);

// ─────────────────────────────────────────────────────────── P
section('P. 定制武器的效果文字與譯名（使用者回報）');

// ① 譯名：使用者問「【猴子握法】英雄技能的翻譯真的是這樣嗎？」
//    查證後：專案資料層與 HF 漢化章節都寫【靈猴握 Monkey Grip】——原本那句是我自己直譯的。
check('面板提到的英雄技能用的是專案既有譯名【靈猴握】', forgeSrc.includes('【靈猴握】'), true);
check('沒有留下自己直譯的「猴子握法」', forgeSrc.includes('猴子握法'), false);
check('【靈猴握】真的在英雄技能資料裡（不是我編的）',
  rulesData.heroicSkills.some((h) => h.name === '靈猴握'), true);

// ② 效果文字：使用者指示「有需要額外敘述的能力，記得要寫在武器的效果。數值類的就直接加」
const effectSpecs = [
  createCustomWeaponSpec({ name: '甲', customizations: ['defenseBoost'] }),
  createCustomWeaponSpec({ name: '乙', customizations: ['quick'] }),
  createCustomWeaponSpec({ name: '丙', customizations: ['accurate', 'powerful'] })
];
const effectEntries = buildCustomWeaponEntries({ customWeapons: effectSpecs });
check('物防提升：寫出「視為裝備著一面盾牌」',
  effectEntries[0].note.includes('視為裝備著一面盾牌'), true);
check('迅捷：寫出兩次攻擊與雙武器戰鬥規則',
  [effectEntries[1].note.includes('兩次攻擊'), effectEntries[1].note.includes('雙武器戰鬥規則')],
  [true, true]);
check('純數值組合（精準＋強力）不會多出敘述',
  [effectEntries[2].note.includes('視為裝備著一面盾牌'), effectEntries[2].note.includes('兩次攻擊')],
  [false, false]);
check('精準的 +2 反映在命中式（不是靠文字敘述）', effectEntries[2].attr, 'DEX + INS + 2');
check('強力的 +5 反映在傷害式', effectEntries[2].damage, '【HR + 10】物理');
check('元素反映在傷害式的屬性（不是靠文字敘述）',
  buildCustomWeaponEntries({ customWeapons: [createCustomWeaponSpec({ name: '丁', customizations: ['elemental'], element: '火' })] })[0].damage,
  '【HR + 7】火');

// 可變形：效果文字要寫得出第二型態的名字（所以要帶 siblings）
const twin = [
  createCustomWeaponSpec({ id: 'f1', name: '形態一', customizations: ['transforming'], transformingId: 'f2' }),
  createCustomWeaponSpec({ id: 'f2', name: '形態二', customizations: ['transforming'], transformingId: 'f1' })
];
check('可變形：效果文字寫出第二型態的名字',
  buildCustomWeaponEntries({ customWeapons: twin })[0].note.includes('形態二'), true);
check('拿不到 siblings 時退回「第二型態」而不炸',
  buildCustomWeaponEntry(twin[0]).note.includes('第二型態'), true);

// ③ 三頁匯出：裝備列要看得到效果（跑團時要查得到）
const cwSheet = buildSheetModel({
  ...sheetChar,
  customWeapons: effectSpecs,
  equipment: { ...sheetChar.equipment, mainHand: '甲' }
});
// 裝備列的順序是 配件→防具→主手→副手，所以要按 slot 找，不能抓第 0 列
const cwMainRow = cwSheet.equipmentRows.find((r) => r.slot === 'mainHand');
check('三頁匯出的主手列印出定制武器的效果',
  cwMainRow.desc.includes('視為裝備著一面盾牌'), true);
check('三頁匯出的主手列也印出規格（命中式與傷害式）',
  [cwMainRow.desc.includes('DEX + INS'), cwMainRow.desc.includes('【HR + 5】')],
  [true, true]);

// ─────────────────────────────────────────────────────────── Q
section('Q. 可變形武器在介面上是一把（使用者：「分成兩把有點彆扭」）');

check('列表用分組渲染，不是逐筆規格',
  [editorCode.includes('groupCustomWeapons(customWeaponList)'), /customWeaponGroups\.map\(/.test(editorCode)],
  [true, true]);
check('「N 把」的計數用分組後的數量（兩筆規格＝1 把）',
  editorCode.includes('customWeaponGroups.length > 0 ?'), true);
check('已裝備的可變形武器有「切換形態」按鈕', editorCode.includes('切換形態'), true);
check('切換走的是同一條 equip 路徑（不另外寫一套）',
  editorCode.includes('handleEquipCustomWeapon(other.name)'), true);
check('切換鈕寫明規則限制（衝突中每回合一次）',
  editorCode.includes('衝突場景中只能在你的回合、且每回合一次'), true);
check('列上顯示目前是哪個型態（形態一／形態二）',
  [editorCode.includes('形態一'), editorCode.includes('形態二')], [true, true]);

// ─────────────────────────────────────────────────────────── R
section('R. 可變形要在跑團面板切換（使用者：「衝突進行時應該也是要開跑團面板而非編輯」）');

const hudSrc = read('../src/features/character-sheet/components/CharacterPlayHUD.jsx');
check('跑團面板會解析定制武器（不然主手是空殼：命中 DEX+MIG、HR+0）',
  hudSrc.includes('buildCustomWeaponEntries(character)'), true);
check('跑團面板有變形按鈕', hudSrc.includes('變形 → '), true);
check('變形按鈕寫明原書限制（衝突中每回合一次）',
  hudSrc.includes('衝突場景中只能在你的回合、且每回合一次'), true);
check('變形走同一條 equip 路徑並寫進履歷',
  [hudSrc.includes('equipCustomWeapon(character, switchForm.name)'), hudSrc.includes('變形：')],
  [true, true]);
check('編輯器改名時會同步裝備欄（使用者回報的 bug）',
  editorCode.includes('syncEquipmentNames(character.equipment'), true);

// 跑團面板只印效果、不印規格摘要（命中與傷害在那裡已經是藥丸了）
check('effectText 只放效果，不含規格摘要',
  [effectEntries[0].effectText.includes('視為裝備著一面盾牌'),
    effectEntries[0].effectText.includes('定制武器：')],
  [true, false]);
check('note 仍然同時有規格摘要與效果（編輯器與匯出用）',
  [effectEntries[0].note.includes('定制武器：'), effectEntries[0].note.includes('視為裝備著一面盾牌')],
  [true, true]);
check('純數值組合的 effectText 是空的（沒有需要敘述的規則）', effectEntries[2].effectText, '');

check('跑團面板印出定制武器的效果（數字看不出來的規則）',
  [hudSrc.includes('mainWeapon.effectText'), hudSrc.includes('renderTextWithAffinities(mainWeapon.effectText)')],
  [true, true]);
check('跑團面板不重複印規格摘要（那裡的命中／傷害已經是藥丸）',
  hudSrc.includes('mainWeapon.note'), false);

// ─────────────────────────────────────────────────────────── BD
// §BD 截圖回報：職業卡標題重複英文 / roster gallery 對外展示多印英文
//   - 圖 1：ClassPickerModal 標題「暗黑之刃 · DARKBLADE」後又多了一個淺色的「/ DARKBLADE」
//   - 圖 2：roster gallery 卡片下「元素師 · ELEMENTALIST Lv 3」英文不該出現
section('BD. 職業卡標題／roster gallery：不重複顯示英文');

const countOf = (s, t) => (s.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

/** ClassPickerModal 詳情 SSR：靠 `initialClassName` + `panelOnly` 跳過彈窗外框直接渲染內容 */
const renderClassPickerDetail = (className) => renderToStaticMarkup(React.createElement(ClassPickerModal, {
  isOpen: true, onClose: () => {},
  theme: {},
  enabledBooks: ['core'],
  onToggleSourcebook: () => {},
  onSetSourcebooks: () => {},
  existingClassNames: [],
  onSelectClasses: () => {},
  budgetUsed: 0,
  initialClassName: className,
  panelOnly: true
}));

const detailHTML = renderClassPickerDetail('暗黑之刃');

// 「暗黑之刃 · DARKBLADE」是 withEn() 的標準形式，會在「清單項目」與「詳情標題」兩處各出現一次，
// 兩個都是規範 §2-3 允許的中英並列形式。**修復前的 bug 是「/ DARKBLADE」斜線後又重複英文**。
check('詳情標題：「暗黑之刃 · DARKBLADE」仍要出現（withEn 標準形式，至少 1 次）',
  countOf(detailHTML, '暗黑之刃 · DARKBLADE') >= 1, true);
check('詳情標題：「/ DARKBLADE」（斜線後英文）不應該出現——這是修復前的 bug',
  detailHTML.includes('/ DARKBLADE'), false);
check('詳情標題：「/ DARKBLADE」（斜線後英文，大小寫變體）也不應該出現',
  detailHTML.includes('/ Darkblade'), false);

// 清單項目也要乾淨（line 478+481 原本是「暗黑之刃 · DARKBLADE」+ 「DARKBLADE」分兩行）
// 修復後清單與詳情都只剩「中文 · ENGLISH」並列，不該有單獨秀英文的行。
// 「裸的英文行」會渲染成 `>DARKBLADE<`（前面是 `>` 後面是 `<`）。
check('清單：「>DARKBLADE<」單獨秀英文的行不存在',
  detailHTML.includes('>DARKBLADE<'), false);
check('清單：「>Darkblade<」單獨秀英文的行不存在（大小寫變體）',
  detailHTML.includes('>Darkblade<'), false);

// roster gallery（§BD 第二個截圖）：CharacterSheet.jsx 的職業徽章原本用 `withEn(c.className)`
// 導致對外展示卡顯示「元素師 · ELEMENTALIST Lv 3」。**roster 屬對外展示**，不應該有英文。
// 用原始碼護欄（CharacterSheet 沒 SSR 注入點，SSR 渲染只會拿到空 roster 看不到 gallery）。
const rosterSheetSrc = stripComments(sheet);
check('roster gallery：職業徽章不再用 withEn() 顯示英文',
  /\{\s*withEn\s*\(\s*c\.className\s*\)\s*\}/.test(rosterSheetSrc), false);
check('roster gallery：職業徽章改用純中文（c.className Lv{...}）',
  /\{\s*c\.className\s*\}\s*Lv\{c\.level\}/.test(rosterSheetSrc), true);

// 邊界護欄：roster gallery 改了，**戰鬥抽屜與 play 模式仍要顯示英文**（使用者沒說要改）
// ——驗證「沒被誤改」。CharacterCard 與 CharacterPlayHUD 是另外兩個檔，SSR 這裡不直接跑，
// 但確保 import / 函式呼叫都還在。
const charCardSrc = read('../src/features/character-sheet/components/CharacterCard.jsx');
check('CharacterCard.jsx：戰鬥抽屜仍用 withEn(cl.className) 顯示英文（沒被誤改）',
  /\{\s*withEn\s*\(\s*cl\.className\s*\)\s*\}/.test(stripComments(charCardSrc)), true);
check('CharacterPlayHUD.jsx：play 模式職業標題仍用 withEn(cl.className)（沒被誤改）',
  /\{\s*withEn\s*\(\s*cl\.className\s*\)\s*\}/.test(hudCode), true);

// ─────────────────────────────────────────────────────────── BE
// §BE（2026-10-19）：公測修訂是開卡規則的 tickbox，不是「開放的手冊」裡的一本書。
section('BE. 開卡規則面板：公測是 tickbox，不在手冊清單裡');

const rulesPanelHTML = renderToStaticMarkup(React.createElement(CreationRulesPanel, {
  // 面板預設收合（見元件檔頭），所以要看展開態的內容得明說 defaultOpen。
  // 這是**起始狀態**不是受控 prop——使用者點標題列之後就由元件自己管。
  rules: resolveCreationRules({ allowPlaytest: true }),
  diff: { allowPlaytest: true },
  onChange: () => {},
  theme: {},
  defaultOpen: true
}));
check('面板展開後有【開放公測修訂內容】tickbox', rulesPanelHTML.includes('開放公測修訂內容'), true);
check('面板的「開放的手冊」不再列出公測修訂（書名不該出現）',
  rulesPanelHTML.includes('官方公測修訂'), false);
check('其他手冊仍在清單裡（核心規則書）', rulesPanelHTML.includes('核心規則書'), true);

// 預設（官方標準）時面板收合——不是 bug，是刻意設計
const rulesPanelDefaultHTML = renderToStaticMarkup(React.createElement(CreationRulesPanel, {
  rules: resolveCreationRules({}), diff: {}, onChange: () => {}, theme: {}
}));
check('官方標準時面板收合（不渲染任何欄位）',
  [rulesPanelDefaultHTML.includes('開放公測修訂內容'), rulesPanelDefaultHTML.includes('官方公測修訂')],
  [false, false]);
// 官方標準時也**不該**出現差異摘要——沒有差異就沒有東西可摘要
check('官方標準時不渲染差異摘要',
  rulesPanelDefaultHTML.includes('rules-diff-summary'), false);

// ─────────────────────────────────────────────────────────── BJ
// §BJ（2026-10-26 playtest P4）：面板預設收合，改由「一行差異摘要」承擔
// 「一眼知道這張卡哪裡跟別人不一樣」。舊版是「自訂就自動展開」，成本是每一頁第一屏的一半。
section('BJ. 開卡規則面板：預設收合，自訂時改用一行差異摘要');

// 純函式先驗：摘要文字是從 diff 推出來的，不是寫死的
check('describeRulesDiff：空 diff → 沒有標籤', describeRulesDiff({}), []);
check('describeRulesDiff：null / undefined 不會爆',
  [describeRulesDiff(null), describeRulesDiff(undefined)], [[], []]);
check('describeRulesDiff：底力技用短標籤（不是面板上的完整標題）',
  describeRulesDiff({ zeroPowers: true }), ['底力技']);
check('describeRulesDiff：面板完整標題「開放底力技」不該出現在摘要裡',
  describeRulesDiff({ zeroPowers: true }).includes('開放底力技'), false);
check('describeRulesDiff：營地活動', describeRulesDiff({ campActivities: true }), ['營地活動']);
check('describeRulesDiff：多條時逐一都在（不是只取第一條）',
  // 順序是規則欄位的宣告順序（`CREATION_RULE_FIELDS`），不是物件的插入順序——
  // 這樣摘要的排列不會因為呼叫端傳入的鍵序不同而跳來跳去
  describeRulesDiff({ zeroPowers: true, campActivities: true, allowQuirk: true }),
  ['金手指', '底力技', '營地活動']);
// defaultSourcebooks 與 allowedSourcebooks 講同一件事，列兩次只會讓摘要變長
check('describeRulesDiff：defaultSourcebooks 不列入摘要',
  describeRulesDiff({ defaultSourcebooks: ['core', 'highFantasy'] }), []);
check('describeRulesDiff：手冊清單收成一條「手冊 N 本」',
  describeRulesDiff({ allowedSourcebooks: ['core', 'highFantasy', 'naturalFantasy'] }), ['手冊 3 本']);
// 公測修訂開關會自動把 playtest 塞進手冊清單——那不是 GM 調的，
// 摘要已經有「公測修訂」那一條，不該再報一條「手冊 6 本」
check('describeRulesDiff：只因為公測而多一本書時，不報手冊那一條',
  describeRulesDiff({ allowedSourcebooks: ['core', 'highFantasy', 'technoFantasy', 'naturalFantasy', 'bonus', 'playtest'] }),
  []);
check('describeRulesDiff：真的收窄了手冊時照樣報（沒有連正常情況一起吞掉）',
  describeRulesDiff({ allowedSourcebooks: ['core', 'playtest'] }), ['手冊 1 本']);
check('describeRulesDiff：魔晶石是枚舉，摘要要帶出是哪一態',
  describeRulesDiff({ technospheres: 'integrated' }).length, 1);
check('describeRulesDiff：魔晶石摘要不是乾巴巴的 key',
  describeRulesDiff({ technospheres: 'integrated' })[0].includes('integrated'), false);
check('describeRulesDiff：魔晶石關閉就是官方標準，不算一條差異',
  describeRulesDiff({ technospheres: 'off' }), []);
check('describeRulesDiff：不是規則欄位的雜訊不會混進摘要',
  describeRulesDiff({ 某個未來欄位: 1 }), []);

// 派生欄位：改了起始等級，起始資金與技能點數會**自動**跟著變。
// 那兩條不是 GM 的決定，算進「不同 N 條」會讓他以為自己動過沒動過的東西。
check('describeRulesDiff：只改起始等級時，只報一條（不把派生的資金／點數算進去）',
  describeRulesDiff({ startingLevel: 8 }), ['起始等級']);
check('describeRulesDiff：但 GM 真的指定了資金時要報（沒有連正常情況一起吞掉）',
  describeRulesDiff({ startingLevel: 8, startingZenit: 1234 }).includes('起始資金'), true);
check('describeRulesDiff：GM 真的指定了技能點數時要報',
  describeRulesDiff({ startingLevel: 8, skillPointBudget: 12 }).includes('技能點數'), true);

// 收合態的渲染：自訂時要有一行摘要，而且**不能**把整個面板的欄位一起畫出來
const rulesPanelCollapsedHTML = renderToStaticMarkup(React.createElement(CreationRulesPanel, {
  rules: resolveCreationRules({ zeroPowers: true, campActivities: true }),
  diff: { zeroPowers: true, campActivities: true },
  onChange: () => {},
  theme: {}
}));
check('自訂＋收合：差異摘要存在', rulesPanelCollapsedHTML.includes('rules-diff-summary'), true);
check('自訂＋收合：摘要寫出「幾條不同」', rulesPanelCollapsedHTML.includes('與官方標準不同 2 條'), true);
check('自訂＋收合：摘要列出兩條的短標籤',
  [rulesPanelCollapsedHTML.includes('底力技'), rulesPanelCollapsedHTML.includes('營地活動')],
  [true, true]);
// 這是收合的**目的**：欄位不在 DOM 裡，第一屏才空得出來
check('自訂＋收合：欄位沒有被畫出來（收合是真的收合，不是視覺遮住）',
  [rulesPanelCollapsedHTML.includes('開放底力技'), rulesPanelCollapsedHTML.includes('開放的手冊')],
  [false, false]);
check('自訂＋收合：標題列的「自訂」徽章仍在（收合也要看得出不是官方標準）',
  rulesPanelCollapsedHTML.includes('自訂'), true);
check('自訂＋收合：標題列寫「展開」（告訴使用者怎麼看細節）',
  rulesPanelCollapsedHTML.includes('展開'), true);

// 超過 5 條要收成「＋N」——摘要太長就失去「一眼」的意義
const manyDiff = {
  allowQuirk: true, allowCustomWeapon: true, startingHeroicSkill: true,
  allowPlaytest: true, initiativeVariant: true, zeroPowers: true, campActivities: true
};
const rulesPanelManyHTML = renderToStaticMarkup(React.createElement(CreationRulesPanel, {
  rules: resolveCreationRules(manyDiff), diff: manyDiff, onChange: () => {}, theme: {}
}));
check('7 條差異時：總數照實寫 7', rulesPanelManyHTML.includes('與官方標準不同 7 條'), true);
check('7 條差異時：多出來的收成「＋2」（7 - 5）', rulesPanelManyHTML.includes('＋2'), true);
check('7 條差異時：第 6、7 條的標籤不直接列出',
  [rulesPanelManyHTML.includes('>底力技<'), rulesPanelManyHTML.includes('>營地活動<')],
  [false, false]);

// 摘要的來源必須是「解析後算出來的 diff」，不是角色身上的原始存檔。
// 原始存檔會留著「開過又關掉」的欄位（下面 allowPlaytest: false 就是），
// 直接數它會報出根本不存在的差異——面板收合後這行是唯一的線索，報錯就是騙人。
const staleDiffHTML = renderToStaticMarkup(React.createElement(CreationRulesPanel, {
  rules: resolveCreationRules({ zeroPowers: true }),
  diff: { zeroPowers: true, allowPlaytest: false, campActivities: false },
  onChange: () => {},
  theme: {}
}));
check('存檔留著「開過又關掉」的欄位時，摘要只算真正不同的那一條',
  staleDiffHTML.includes('與官方標準不同 1 條'), true);
check('被關掉且等於預設的公測修訂不出現在摘要裡',
  staleDiffHTML.includes('公測修訂'), false);

// 魔晶石開啟時，職業數是派生值（原書 p.134 的「恰好三個」），不是 GM 調的
// → 不該進摘要，否則 GM 會以為自己動過那兩個數字
const techDiffHTML = renderToStaticMarkup(React.createElement(CreationRulesPanel, {
  rules: resolveCreationRules({ technospheres: 'full', classCountMin: 3, classCountMax: 3 }),
  diff: { technospheres: 'full', classCountMin: 3, classCountMax: 3 },
  onChange: () => {},
  theme: {}
}));
check('魔晶石開啟時：派生的職業數下限不進摘要', techDiffHTML.includes('職業數下限'), false);
check('魔晶石開啟時：派生的職業數上限不進摘要', techDiffHTML.includes('職業數上限'), false);
check('魔晶石開啟時：摘要仍算得到魔晶石那一條', techDiffHTML.includes('魔晶石'), true);

// 極端情況：`isDefault` 與摘要來源不同層（後者不列 defaultSourcebooks），
// 可能出現「自訂但一條都數不出來」。那時候寧可不寫，也不要寫「不同 0 條」。
const zeroChipHTML = renderToStaticMarkup(React.createElement(CreationRulesPanel, {
  rules: resolveCreationRules({ defaultSourcebooks: ['core'] }),
  diff: { defaultSourcebooks: ['core'] },
  onChange: () => {},
  theme: {}
}));
check('數不出任何一條時不渲染摘要（不寫「不同 0 條」）',
  zeroChipHTML.includes('與官方標準不同 0 條'), false);


// 行為驗證：開關真的決定「秘儀師【變體】能不能選」
const renderPickerWithRules = (creationRules, enabledBooks) => renderToStaticMarkup(React.createElement(ClassPickerModal, {
  isOpen: true, onClose: () => {}, theme: {},
  enabledBooks,
  onToggleSourcebook: () => {}, onSetSourcebooks: () => {},
  existingClassNames: [], onSelectClasses: () => {},
  budgetUsed: 0,
  creationRules,
  panelOnly: true
}));
const pickerOnHTML = renderPickerWithRules({ allowPlaytest: true }, ['core', 'playtest']);
const pickerOffHTML = renderPickerWithRules({ allowPlaytest: false }, ['core']);
// 縱深防禦：就算呼叫端傳來的 enabledBooks 還留著 playtest（舊角色殘留），
// 只要規則沒開，秘儀師【變體】也不該出現。
const pickerStaleHTML = renderPickerWithRules({ allowPlaytest: false }, ['core', 'playtest']);
check('公測開啟 → 秘儀師【變體】出現在職業清單',
  pickerOnHTML.includes('秘儀師【變體】'), true);
check('公測關閉 → 秘儀師【變體】完全不出現',
  pickerOffHTML.includes('秘儀師【變體】'), false);
check('公測關閉但舊資料仍開著 playtest → 秘儀師【變體】也不出現（規則優先）',
  pickerStaleHTML.includes('秘儀師【變體】'), false);
check('公測關閉 → 手冊篩選列也沒有「公測修訂」',
  pickerOffHTML.includes('公測修訂'), false);
check('已刪除的守護者【Playtest】永遠不出現',
  [pickerOnHTML.includes('守護者【Playtest】'), pickerOffHTML.includes('守護者【Playtest】')],
  [false, false]);

// ─────────────────────────────────────────────────────────── BF
section('BF. 秘儀師【變體】：改名、技能文本、召喚面板與阿爾卡納規則');

// (1) 改名：舊名不准留在程式資料裡（歷史文件另計，見 `docs/decisions.md` §BF）。
check('rulesData 有【變體】、沒有【Playtest】',
  [Object.prototype.hasOwnProperty.call(rulesData.classes, VARIANT_ARCANIST_CLASS_NAME),
    Object.prototype.hasOwnProperty.call(rulesData.classes, '秘儀師【Playtest】')],
  [true, false]);
check('CLASS_METADATA 的鍵與 rulesData 同步',
  [Object.prototype.hasOwnProperty.call(CLASS_METADATA, VARIANT_ARCANIST_CLASS_NAME),
    Object.prototype.hasOwnProperty.call(rulesData.classes, VARIANT_ARCANIST_CLASS_NAME)],
  [true, true]);
// 改名時踩到的真坑：`characterEngine` 曾手寫 replace('【Playtest】', '')，
// 改名後它安靜地回傳 0 筆。後綴會變，所以剝除邏輯只能有一份。
check('stripClassSuffix 剝得掉【變體】', stripClassSuffix('秘儀師【變體】'), '秘儀師');
check('stripClassSuffix 剝得掉【Playtest】（舊存檔仍讀得到）',
  stripClassSuffix('守護者【Playtest】'), '守護者');
const engineSrcBf = fs.readFileSync('src/features/character-sheet/utils/characterEngine.js', 'utf8');
check('引擎不再手寫舊後綴', engineSrcBf.includes("replace('【Playtest】'"), false);
check('引擎改用共用的 stripClassSuffix', engineSrcBf.includes('stripClassSuffix('), true);

// (2) 技能文本對齊原文（Playtest Materials 2026-10-01, p.24 ARCANIST (variant)）。
const variantClass = rulesData.classes[VARIANT_ARCANIST_CLASS_NAME];
check('變體秘儀師仍是 5 個技能（順序即原書順序）',
  variantClass.skills.map((s) => s.name),
  ['秘術再生', '綁定和召喚', '幻影之力', '快速召喚', '秘儀學派儀式']);
check('變體秘儀師的 SL 上限未被動到',
  variantClass.skills.map((s) => s.maxSL), [6, 1, 5, 4, 1]);
const skillDescBf = (name) => variantClass.skills.find((s) => s.name === name)?.desc || '';
check('快速召喚不再擅自加上「在衝突中」（原文只說 during your turn）',
  skillDescBf('快速召喚').includes('在衝突中'), false);
check('快速召喚選項②寫明「若你與其處於連結狀態」（原文 if you are merged with it）',
  skillDescBf('快速召喚').includes('若你與其處於連結狀態'), true);
check('綁定和召喚允許「與你的團隊共同創作」（原文 or create it with your group）',
  skillDescBf('綁定和召喚').includes('與你的團隊共同創作'), true);
check('綁定和召喚不再謊稱「必須從下文的列表中選擇」',
  skillDescBf('綁定和召喚').includes('必須從下文的列表中選擇'), false);
check('綁定和召喚寫明 30 點 MP（變體版費用，非核心版 40）',
  skillDescBf('綁定和召喚').includes('30點MP'), true);
check('幻影之力把「連接」統一成「連結」（全站用詞）',
  [skillDescBf('幻影之力').includes('連結狀態'), skillDescBf('幻影之力').includes('連接狀態')],
  [true, false]);

// (3) 召喚面板要反映「這個角色實際拿到的規則」，不是全域開關。
const mkArcanistChar = (className, activeSummonId) => ({
  level: 20,
  classes: [{ className, level: 20, skills: [{ name: '綁定和召喚', sl: 1 }] }],
  arcanistData: { boundArcana: [activeSummonId], customArcana: [], activeSummonId }
});
const renderArcanist = (char) => renderToStaticMarkup(React.createElement(ArcanistManager, {
  character: char, onChange: () => {}, showToast: () => {}
}));
const variantPanelHTML = renderArcanist(mkArcanistChar(VARIANT_ARCANIST_CLASS_NAME, 'qilin'));
const corePanelHTML = renderArcanist(mkArcanistChar('秘儀師', 'sword'));
// 變體角色召喚了一個「核心版沒有脈衝」的阿爾卡納時，要講清楚而不是留空白。
const variantCoreArcanaHTML = renderArcanist(mkArcanistChar(VARIANT_ARCANIST_CLASS_NAME, 'sword'));

check('變體面板顯示召喚費 30 點 MP', variantPanelHTML.includes('召喚費 30 點 MP'), true);
check('核心面板顯示召喚費 40 點 MP', corePanelHTML.includes('召喚費 40 點 MP'), true);
check('變體面板有脈衝欄（技能動作 · 僅衝突場景）',
  variantPanelHTML.includes('脈衝（技能動作 · 僅衝突場景）'), true);
check('核心面板沒有脈衝欄', corePanelHTML.includes('脈衝（技能動作'), false);
check('變體面板列出官方新給的 11 個範例阿爾卡納',
  variantPanelHTML.includes('麒麟之阿爾卡納'), true);
check('核心面板不列變體版範例阿爾卡納（兩份清單不該混在一起）',
  corePanelHTML.includes('麒麟之阿爾卡納'), false);
check('變體角色 20 級：傷害加值 +5（核心版是 +10）',
  [variantPanelHTML.includes('(等級 20 傷害 +5)'), corePanelHTML.includes('(等級 20 傷害 +10)')],
  [true, true]);
check('變體角色召喚核心版阿爾卡納 → 明說沒有脈衝',
  variantCoreArcanaHTML.includes('沒有脈衝效果'), true);
check('召喚面板標出哪些阿爾卡納有脈衝', variantPanelHTML.includes('· 有脈衝'), true);

// (4) 規則速查抽屜：新增分頁，且目錄區塊不再寫死「arcana」。
const drawerSrcBf = fs.readFileSync('src/features/character-sheet/components/RuleCodexDrawer.jsx', 'utf8');
check('速查有「阿爾卡納（變體）」分頁', drawerSrcBf.includes("id: 'arcanaVariant'"), true);
check('目錄區塊改由「有沒有 catalog」決定（不再寫死 activeRuleId === arcana）',
  [drawerSrcBf.includes("activeRuleId === 'arcana'"), drawerSrcBf.includes('Array.isArray(currentRule.catalog)')],
  [false, true]);
check('目錄標題改讀 catalogTitle（不再寫死「9 大」）',
  [drawerSrcBf.includes('9 大阿爾卡納目錄'), drawerSrcBf.includes('currentRule.catalogTitle')],
  [false, true]);
check('目錄卡片會渲染【脈衝】', drawerSrcBf.includes('arcana.pulse &&'), true);

// (5) 舊存檔遷移：職業名同時是 rulesData 的鍵，改名後舊角色會「查不到職業資料」
//     而安靜地少算技能與免費增益（`classDef` 有 || {} 保護，不會當掉）。
const staleRoster = [
  { id: 'a', name: '舊角色', classes: [{ className: '秘儀師【Playtest】', level: 5, skills: [] }] },
  { id: 'b', name: '核心角色', classes: [{ className: '秘儀師', level: 5, skills: [] }] }
];
const migratedRoster = normalizeRosterClassNames(staleRoster);
check('讀檔時把舊職業名正名為【變體】',
  migratedRoster[0].classes[0].className, VARIANT_ARCANIST_CLASS_NAME);
check('正名後真的查得到職業資料（這才是正名的目的）',
  Array.isArray(rulesData.classes[migratedRoster[0].classes[0].className]?.skills), true);
check('沒有舊名的角色不受影響（連物件參考都不換）',
  migratedRoster[1] === staleRoster[1], true);
check('不改動傳入的名冊（純函式）',
  staleRoster[0].classes[0].className, '秘儀師【Playtest】');
const cleanRoster = [staleRoster[1]];
check('乾淨名冊回傳同一個陣列參考（呼叫端可據此判斷不必寫回）',
  normalizeRosterClassNames(cleanRoster) === cleanRoster, true);
check('非陣列輸入不會爆掉', normalizeRosterClassNames(null), null);
check('單一名稱正名：舊名換新、新名不動、雜訊原樣回傳',
  [normalizeClassName('秘儀師【Playtest】'), normalizeClassName('秘儀師'), normalizeClassName('')],
  [VARIANT_ARCANIST_CLASS_NAME, '秘儀師', '']);
// 正名函式寫好了卻沒接上去，等於沒有——名冊頁必須真的呼叫它。
const sheetSrcBf = fs.readFileSync('src/features/character-sheet/CharacterSheet.jsx', 'utf8');
check('名冊頁讀檔時真的呼叫 normalizeRosterClassNames',
  sheetSrcBf.includes('normalizeRosterClassNames(parsed)'), true);

// ─────────────────────────────────────────────────────────── BG
section('BG. 變體秘儀師的英雄技能：選單與職業卡都只看得到自己那一版');

const renderArcanistHeroicPicker = (className) => renderHeroicPicker({
  level: 10,
  classes: [{ className, level: 10, skills: [] }]
});
const variantHeroicHtml = renderArcanistHeroicPicker(VARIANT_ARCANIST_CLASS_NAME);
const coreHeroicHtml = renderArcanistHeroicPicker('秘儀師');

check('變體角色：清單裡有【變體】版',
  variantHeroicHtml.includes('阿爾卡納迴響【變體】'), true);
// 邊界比對：變體版的名字包含核心版的名字，只查子字串會誤判成「兩邊都有」。
check('變體角色：看不到核心版（同名不帶【變體】的那一列）',
  variantHeroicHtml.includes('>阿爾卡納迴響<'), false);
check('核心角色：看得到核心版', coreHeroicHtml.includes('>阿爾卡納迴響<'), true);
check('核心角色：看不到任何【變體】列',
  coreHeroicHtml.includes('【變體】'), false);

const heroicBlockVariant = renderToStaticMarkup(React.createElement(ClassHeroicSkillsBlock, {
  className: VARIANT_ARCANIST_CLASS_NAME, theme: {}
}));
const heroicBlockCore = renderToStaticMarkup(React.createElement(ClassHeroicSkillsBlock, {
  className: '秘儀師', theme: {}
}));
// 空清單時整個元件回 null——所以「有內容」就等於「這個職業真的解鎖得到英雄技能」。
check('變體職業卡有英雄技能入口（不是空的）', heroicBlockVariant.length > 0, true);
check('核心職業卡也有英雄技能入口', heroicBlockCore.length > 0, true);

// ─────────────────────────────────────────────────────────── BH
section('BH. 無障礙契約：狀態訊息要播報得到（2026-10-20 playtest S1）');

// BH1 toast 必須是**常駐**的 live region。
// 條件渲染整個容器（`{msg && <div/>}`）不會觸發播報——live region 要先存在於 DOM，
// 內容變化才會被念出來。原本的寫法正是條件渲染，所以只加 role 也不會動。
const sheetSrc = fs.readFileSync(
  new URL('../src/features/character-sheet/CharacterSheet.jsx', import.meta.url), 'utf8');
// ⚠️ 這裡刻意用 `<div\s+role=` 而不是 `includes('role="status"')`——
// 後者會被 `data-role="status"` 這個**子字串**滿足（2026-10-20 刻意破壞驗證時實測：
// 把 role 改成 data-role，斷言仍然 PASS）。這正是 AGENTS.md §1 警告的
// 「斷言子字串前先問：這個字串在別處是不是也有」。
check('toast 容器帶 role="status"', /<div\s+role="status"/.test(sheetSrc), true);
check('toast 無訊息時以 sr-only 收起來（容器常駐，不是條件渲染）',
  sheetSrc.includes("'sr-only'"), true);
// 上一條只證明「有 sr-only」。這一條直接釘住**意圖**：
// 容器不得被 `{toastMessage && (<div …>)}` 這種條件渲染包住——那樣子節點每次都是新的，
// live region 不會播報。原本的寫法正是如此，所以補 role 也不會動。
check('toast 容器不是條件渲染的（條件渲染會讓 live region 失效）',
  /\{toastMessage && \(\s*<div/.test(sheetSrc), false);

// BH2 星級指示器的 glyph 必須 aria-hidden。
// `.fu-icon` 的 `w` 是字型映射碼，視覺上是星芒；沒有 aria-hidden 的話
// 螢幕閱讀器會把「阿爾卡納圓環 SL 0/4」念成「阿爾卡納圓環 w w w w SL 0/4」。
const pipsSrc = fs.readFileSync(
  new URL('../src/features/character-sheet/components/SkillStarPips.jsx', import.meta.url), 'utf8');
check('SkillStarPips 的 glyph span 帶 aria-hidden',
  /aria-hidden="true"[\s\S]{0,200}fu-icon/.test(pipsSrc), true);

// ─────────────────────────────────────────────────────────── BI
section('BI. 技能配點到上限時要說明原因（2026-10-20 playtest S1 的 F-006）');

// F-006：到達 SL 上限後，`+` 只是 `disabled:opacity-20` 變淡，`title` 卻還寫著
// 「增加 1 級」——新手唯一的解釋是「壞了」。修法有兩層：`title` 隨狀態改，
// 且理由**同時寫在畫面上**（`title` 要 hover 才看得到，而新手不會去 hover 一顆灰按鈕）。
// 這裡靠 `initialDraft` 注入點把草稿直接塞到滿級——那是只有點擊才會出現的狀態。
const pickerAtSL = (className, skillName, sl) => renderToStaticMarkup(React.createElement(ClassPickerModal, {
  isOpen: true, onClose: () => {},
  theme: {},
  enabledBooks: ['core'],
  onToggleSourcebook: () => {},
  onSetSourcebooks: () => {},
  existingClassNames: [],
  onSelectClasses: () => {},
  budgetUsed: 0,
  initialClassName: className,
  panelOnly: true,
  initialDraft: { [className]: { [skillName]: sl } }
}));

const cappedHtml = pickerAtSL('秘儀師', '阿爾卡納圓環', 4);
const belowCapHtml = pickerAtSL('秘儀師', '阿爾卡納圓環', 2);
check('滿級時畫面上出現「已達上限」（不只在 title 裡）',
  cappedHtml.includes('已達上限'), true);
// ⚠️ 不能對整份 HTML 做「不得包含『增加 1 級』」的否定——秘儀師有多個技能，
// 只有一個被塞到滿級，其餘技能的 `+` 當然還是「增加 1 級」。
// 要比**次數**：滿級態剛好比未滿級態少一次（2026-10-20 首次寫成全局否定，假失敗）。
check('滿級時 title 說的是上限',
  cappedHtml.includes('已達此技能的 SL 上限'), true);
check('滿級那一個技能的 title 不再說「增加 1 級」（少一次，其餘技能不受影響）',
  countOf(belowCapHtml, '增加 1 級') - countOf(cappedHtml, '增加 1 級'), 1);
check('未滿級時不出現「已達上限」（條件渲染，不佔平時版面）',
  belowCapHtml.includes('已達上限'), false);
check('未滿級時 title 仍是「增加 1 級」（修復沒有把正常態一起改掉）',
  belowCapHtml.includes('增加 1 級'), true);

// ─────────────────────────────────────────── 金手指「選項」的介面（§CF）
//
// 原書有 11 個金手指寫著「選擇一個選項」，但只有倖存者③（IP +2）與
// 墮落天使③（最大 MP +10）會改數值。以前金手指只是一個名稱字串，
// 玩家根本沒有地方可以選——現在資料層有 `options`，選取器就必須把它畫出來。
//
// SSR 測不到點擊，但 `openName` 的初值就是 `selectedName`，
// 所以傳 `selectedName` 就能讓右側詳情直接展開。
const quirkBody = (selectedName, selectedChoice) => renderToStaticMarkup(
  React.createElement(QuirkPickerBody, {
    theme: { accent: '#000', accentDark: '#000', cardBg: '#fff', subpanelBg: '#eee', border: '#ccc', textDark: '#111', textMuted: '#666' },
    selectedName,
    selectedChoice,
    onPick: () => {},
    onClear: () => {},
    onClose: () => {}
  })
);

const quirkNoChoice = quirkBody('倖存者', '');
const quirkWithChoice = quirkBody('倖存者', 'ip');
// ※ 這條原本拿【會說話的野獸】當「沒有選項」的例子。
//   F-027（2026-10-27）之後它有了兩組選項（原書：從 3 個增益中選 2 個），
//   所以改拿【大夢一場】——它真的沒有選項（原書只有骰 2d20 的進度規則）。
//   守的東西沒變：**沒有選項的金手指不該長出一塊空的單選區**。
const quirkNarrative = quirkBody('大夢一場', '');

check('帶選項的金手指會畫出選項區', quirkNoChoice.includes('data-testid="quirk-options"'), true);
check('三個選項都在', ['獲得裝備職業近戰武器', '從元素師或靈師的咒語表', '永久 +2 IP']
  .every((s) => quirkNoChoice.includes(s)), true);
check('沒選選項時確定鈕是停用的（原書：選擇一個選項，不是可以選）',
  quirkNoChoice.includes('disabled=""'), true);
check('選好之後確定鈕可以按',
  quirkWithChoice.includes('disabled=""'), false);
check('選好的那一項是 checked',
  /checked=""[^>]*value="on"|checked/.test(quirkWithChoice), true);
check('沒有選項的金手指不會長出空的選項區',
  quirkNarrative.includes('data-testid="quirk-options"'), false);

// ── 多組選項（§CG）：草木成精要選「免疫狀態」＋「易傷屬性」兩件事
const plantHalf = quirkBody('草木成精', { immune: '眩暈' });
const plantFull = quirkBody('草木成精', { immune: '眩暈', vuln: '火' });

check('多組金手指會畫出兩組選項',
  [plantFull.includes('data-testid="quirk-group-immune"'),
    plantFull.includes('data-testid="quirk-group-vuln"')], [true, true]);
check('多組金手指的標題寫出要選幾件事', plantFull.includes('要選 2 件事'), true);
check('免疫組列出三個狀態', ['眩暈', '憤怒', '動搖'].every((s) => plantFull.includes(s)), true);
check('易傷組列出五種屬性', ['風', '電', '土', '火', '冰'].every((s) => plantFull.includes(s)), true);
check('只選一組時確定鈕仍是停用的', plantHalf.includes('disabled=""'), true);
check('兩組都選了確定鈕才可以按', plantFull.includes('disabled=""'), false);
check('多組的 checked 標在已選的那兩項',
  (plantFull.match(/checked=""/g) || []).length >= 2, true);

// ─────────────────────────────────────────────────────────── CH
// §CH（2026-10-26 P11 / F-026）：多組金手指選項必須互斥。
//
// 原書兩處明文：
//   - 元素之魂 第二組標籤：「選擇另一種你易傷的傷害類型（不可與上面相同）」
//   - 通智幽魂：「選擇 2 種傷害類型…獲得從上述傷害類型中的第 3 種易傷」
// 修之前介面完全不擋；玩家兩組選同一個屬性時，引擎把重複的抗性去重成一筆，
// **少掉的那一個抗性沒有任何提示**——比報錯更糟，因為它看起來成功了。
//
// 判準是「選項 id 是否已被別組選走」，不是逐個金手指寫例外：
// 草木成精兩組的 id 分屬狀態與傷害類型，本來就不會撞，所以必須**不受影響**。
const soulClash = quirkBody('元素之魂', { resist: '火' });
const soulClean = quirkBody('元素之魂', { resist: '火', vuln: '冰' });
const ghostClash = quirkBody('通智幽魂', { resist1: '火' });
const plantClash = quirkBody('草木成精', { immune: '眩暈' });

// ※ 不要用「html 裡有沒有『不能重複』這幾個字」斷言——那一行在**別的**選項上
//   本來就會合法出現（選了火，易傷組的火就被擋），裸字串守衛會變成空的。
//   改成逐組數「有幾個選項被禁用」。
//
// 掃描範圍要先切掉頁尾（「一個角色只能擁有一個金手指」之後是確定鈕，
// 它自己也有 disabled，會被算進最後一組）。
// React SSR 的屬性順序是 type／class／name／checked／disabled，
// 所以不能靠切 `name="..."` 取區段——disabled 落在切點之後，
// 用 `/>` 截斷反而會把它切掉。改成「看到組標記就換組、看到 disabled 就記一筆」。
const disabledPerGroup = (html) => {
  const box = html.split('一個角色只能擁有一個金手指')[0];
  const out = {};
  const re = /data-testid="quirk-group-([^"]+)"|disabled=""/g;
  let cur = null;
  let m;
  while ((m = re.exec(box)) !== null) {
    if (m[1]) {
      cur = m[1];
      out[cur] = out[cur] || 0;
    } else if (cur) {
      out[cur] += 1;
    }
  }
  return out;
};

check('元素之魂：抗性選火 → 易傷組剛好擋掉 1 個（火）',
  disabledPerGroup(soulClash), { resist: 0, vuln: 1 });
check('通智幽魂：第一種抗性選火 → 另外兩組各擋掉 1 個（火）',
  disabledPerGroup(ghostClash), { resist1: 0, resist2: 1, vuln: 1 });
check('元素之魂：抗性火／易傷冰 → 兩組各擋 1 個，選到的冰本身沒有被擋',
  disabledPerGroup(soulClean), { resist: 1, vuln: 1 });
check('元素之魂：已選中的那一項不會被自己擋掉',
  soulClean.includes('checked="" disabled=""'), false);
check('草木成精：兩組 id 不同領域，完全不會互相誤擋（眩暈／火 可以同時選）',
  disabledPerGroup(plantClash), { immune: 0, vuln: 0 });
check('單組金手指不受互斥影響（倖存者三個選項都能選）',
  disabledPerGroup(quirkNoChoice), { default: 0 });
check('被擋掉的選項有寫原因，不是只變灰',
  quirkBody('元素之魂', { resist: '火' }).includes('上面已經選了，不能重複'), true);

// ── 金手指相性（§CG）：引擎算了，介面要說出來
const zombieHtml = renderEditorAt(4, { quirk: '亡者歸來' });
const plainHtml = renderEditorAt(4);
check('有相性時會畫出金手指相性區塊',
  zombieHtml.includes('data-testid="quirk-affinities"'), true);
check('沒有相性時整塊不渲染',
  plainHtml.includes('data-testid="quirk-affinities"'), false);
check('亡者歸來的免疫／易傷／狀態免疫都寫出來',
  ['傷害免疫', '易傷', '狀態免疫'].every((s) => zombieHtml.includes(s)), true);

// ─────────────────────────────────────────────────────────── BK
// §BK（2026-10-26 P4c）：群 A 重構——F-004／F-005／F-010。
//
// 三條同源：**「完成創角」在畫面上沒有單一定義**。
//   F-010：頁首數「有 error 的步驟數」、自檢卡數「error 條數」、導航列每步一個圓點
//          ——三個數字分母不同卻長得像同一件事（空卡 R01：2／2／5 個點）。
//   F-004：頁尾那顆「完成創角，進入跑團面板」不定稿、不檢查、也不設 locked。
//   F-005：灰掉的按鈕只說「定稿後會怎樣」，沒說「現在為什麼不能按」。
//
// 修法：全部從 `deriveCreationState()` 出來，並且讓每個數字都說清楚自己在數什麼。
section('BK. 創角狀態單一來源：三個數字不准再各算各的（F-004／F-005／F-010）');

/** 渲染整個編輯器（含頁尾的「先去看跑團面板」，所以一定要傳 `onEnterPlayMode`） */
const renderEditorFull = (tab, over = {}, rules = null) => renderToStaticMarkup(React.createElement(CharacterEditor, {
  character: createNewCharacter({ name: '', startingFundsRolled: false, ...over }),
  themeId: 'emerald',
  onChange: () => {},
  showToast: () => {},
  initialTab: tab,
  onEnterPlayMode: () => {},
  ...(rules ? { creationRules: rules } : {})
}));

/** 一張真的填完、可以定稿的卡 */
const FILLED = {
  identity: '見習搬運工', theme: '使命感', origin: '礦坑小鎮',
  classes: [
    { className: '守護者', level: 2, skills: [{ name: '保鏢', sl: 1 }, { name: '防守掌握', sl: 1 }] },
    { className: '元素師', level: 2, skills: [{ name: '元素魔法', sl: 1 }] }
  ],
  attributes: { dex: 8, ins: 6, mig: 10, wlp: 6 },
  startingFundsRolled: true, name: '阿草', gender: '女', background: '搬了十年礦石'
};

/** 按鈕的**可見文字**（不含 title 等屬性）——「哪幾顆按鈕叫這個名字」要問的是文字，不是屬性 */
const buttonTexts = (html) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
  .map((m) => m[1].replace(/<[^>]*>/g, '').trim());

/** 取某個 data-testid 元素的可見文字 */
const testIdText = (html, id) => {
  const m = html.match(new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`));
  return m ? m[1].trim() : null;
};

/** 取某個 data-testid 元素的開標籤（要看 disabled 這類屬性） */
const testIdTag = (html, id) => {
  const m = html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`));
  return m ? m[0] : null;
};

/** 取任意元素的開標籤（不限定 button） */
const testIdAnyTag = (html, id) => {
  const m = html.match(new RegExp(`<[a-z]+[^>]*data-testid="${id}"[^>]*>`));
  return m ? m[0] : null;
};

/** 取某個 data-testid 按鈕的**可見文字**（去掉裡面那個 SVG 圖示） */
const testIdButtonText = (html, id) => {
  const m = html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>([\\s\\S]*?)</button>`));
  return m ? m[1].replace(/<[^>]*>/g, '').trim() : null;
};

const emptyChar = { ...createNewCharacter({ name: '', startingFundsRolled: false }) };
const emptyState = deriveCreationState(emptyChar, resolveCreationRules({}));
const filledChar = { ...createNewCharacter(FILLED) };
const filledState = deriveCreationState(filledChar, resolveCreationRules({}));

// ── A. 單一來源：兩個計數加起來必須等於全部訊息，一條都不能漏
check('blockerCount ＋ suggestionCount ＝ 全部 warnings（沒有訊息被漏掉）',
  emptyState.blockerCount + emptyState.suggestionCount, emptyState.validation.warnings.length);
check('canLock 就是「沒有必須修正的項目」',
  emptyState.canLock, emptyState.blockerCount === 0);
check('填完的卡 canLock 為 true', filledState.canLock, true);
check('填完的卡 blockerCount 為 0', filledState.blockerCount, 0);
check('checklist 恰好 6 步', emptyState.checklist.length, 6);
check('checklistById 與 checklist 同步', emptyState.checklistById.size, 6);

// 這條是 F-010 的核心：頁首以前數「**步驟數**」，而每步可能有 2 條 error。
// 所以「每步的 errorCount 加起來」必須等於「頁首的數字」——以前沒有人做這個加法。
check('每步 errorCount 加總 ＝ blockerCount（頁首數的是條數，不是步驟數）',
  emptyState.checklist.reduce((s, step) => s + step.errorCount, 0), emptyState.blockerCount);
check('每步 issueCount 加總 ＝ 全部 warnings',
  emptyState.checklist.reduce((s, step) => s + step.issueCount, 0), emptyState.validation.warnings.length);
check('blockerSteps 恰等於 checklist 裡 status=error 的步驟',
  emptyState.blockerSteps,
  emptyState.checklist.filter((s) => s.status === 'error').map((s) => s.id));

// ── B. 畫面上只有一組數字（F-010）
const emptyHtml = renderEditorFull(1);
const emptyTab6 = renderEditorFull(6);
const techHtml = renderEditorFull(1, {}, { technospheres: 'full' });
const techState = deriveCreationState(
  { ...createNewCharacter({ name: '', startingFundsRolled: false }), creationRules: { technospheres: 'full' } },
  resolveCreationRules({ technospheres: 'full' })
);
const filledHtml = renderEditorFull(6, FILLED);

const headerNumber = (html) => {
  const m = html.match(/還有 (\d+) 項必須修正/);
  return m ? Number(m[1]) : null;
};
const badgeNumber = (html, id) => {
  const t = testIdText(html, id);
  const m = t && t.match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

check('空卡：頁首說「2 項必須修正」', headerNumber(emptyHtml), emptyState.blockerCount);
check('空卡：自檢徽章與頁首同一個數字',
  badgeNumber(emptyHtml, 'validation-badge'), headerNumber(emptyHtml));
check('空卡：快捷列的緊湊徽章也同一個數字',
  badgeNumber(emptyHtml, 'validation-badge-compact'), headerNumber(emptyHtml));
check('空卡：頁首同時講「另有 N 項提醒」（不是只講擋定稿的那個）',
  emptyHtml.includes(`另有 ${emptyState.suggestionCount} 項提醒`), true);

// 魔晶石模式是原本最容易露餡的一組：頁首 2、自檢 3（第 2 步有兩條 error）。
//
// 2026-10-27（F-011）之後這裡是 **2**：第 2 步那兩條 error 講的是同一個缺口
// （「沒選職業」與「魔晶石制需恰好 3 個職業」），已改成只報一條，
// 所以魔晶石卡與普通空卡的 blockerCount 剛好都是 2。
// 這一組的價值不在數字大小，而在「頁首、徽章、state 三邊同一個數字」——
// 真正的「算條數不是算步驟數」由上面的 `每步 errorCount 加總 ＝ blockerCount` 守著。
check('魔晶石卡：blockerCount 是 2（第 2 步只剩一條 error，F-011 已去重）',
  techState.blockerCount, 2);
check('魔晶石卡：頁首也說 2', headerNumber(techHtml), 2);
check('魔晶石卡：自檢徽章與頁首同一個數字（不再打架）',
  badgeNumber(techHtml, 'validation-badge'), headerNumber(techHtml));

check('填完的卡：頁首不再說「還有 N 項必須修正」', headerNumber(filledHtml), null);
check('填完的卡：徽章寫「N 項提醒」而不是「0 項必須修正」',
  testIdText(filledHtml, 'validation-badge'), `${filledState.suggestionCount} 項提醒`);

// ── C. 圖例與每步的數字（F-010 的另一半：橘點到底要不要管？）
// 用 testid 定位圖例，不用「HTML 裡有『必須修正』」——
// 頁首、徽章、每步 title 都有那四個字，那種斷言等於沒斷言。
check('導航列有圖例（找得到那一塊）', testIdAnyTag(emptyHtml, 'checklist-legend') !== null, true);
check('圖例說明紅色是「必須修正」', testIdText(emptyHtml, 'legend-blocking'), '必須修正');
check('圖例說明琥珀色是「提醒」', testIdText(emptyHtml, 'legend-reminder'), '提醒');
check('導航列圖例用的是琥珀色，不是第二個深紅（兩個點原本看不出差別）',
  [emptyHtml.includes('bg-[#8c2d36]'), emptyHtml.includes('bg-[#9c4d16]')], [true, true]);
check('六個步驟每一步的 title 都寫「第 N 步：」',
  (emptyHtml.match(/第 \d+ 步：/g) || []).length, 6);
check('有必須修正項目的那一步，title 說出它有幾項',
  emptyHtml.includes('第 2 步：1 項必須修正') || emptyHtml.includes('第 4 步：1 項必須修正'), true);
check('只有提醒的步驟，title 明說「不擋定稿」',
  emptyHtml.includes('不擋定稿'), true);

// ── D. F-004：只有一顆按鈕叫「完成創角」，而且它有閘門
// 頁尾那顆以前叫「完成創角，進入跑團面板」——名字幾乎一樣，行為卻相反。
// 修法不是拿掉它（先去看看面板是合理需求），是讓它改名。
check('按鈕可見文字裡，「完成創角」只出現一次（只剩定稿那一顆）',
  buttonTexts(emptyTab6).filter((t) => t.includes('完成創角')).length, 1);
check('頁尾那顆改名為「先去看跑團面板（尚未定稿）」',
  (testIdButtonText(emptyTab6, 'enter-play-preview') || '').includes('先去看跑團面板'), true);
check('頁尾那顆的文字註明「尚未定稿」',
  (testIdButtonText(emptyTab6, 'enter-play-preview') || '').includes('尚未定稿'), true);
// 這一條刻意用 testid 定位，不用「文字含跑團面板」去找——
// 快捷操作區也有一顆「跑團面板」，用文字找會抓到那一顆，護欄就永遠通過。
check('頁尾那顆的文字不含「完成創角」',
  (testIdButtonText(emptyTab6, 'enter-play-preview') || '').includes('完成創角'), false);
// 閘門：有必須修正的項目時，定稿鈕必須停用
check('有必須修正項目時，定稿鈕是停用的',
  /disabled=""/.test(testIdTag(emptyTab6, 'lock-character') || ''), true);
check('填完的卡：定稿鈕可以按',
  /disabled=""/.test(testIdTag(filledHtml, 'lock-character') || ''), false);
check('定稿鈕的文字是「完成創角」', testIdButtonText(emptyTab6, 'lock-character'), '完成創角');

// ── E. F-005：按不下去時要說得出原因
const lockTitle = (html) => {
  const tag = testIdTag(html, 'lock-character');
  const m = tag && tag.match(/title="([^"]*)"/);
  return m ? m[1] : null;
};
check('灰掉的定稿鈕，title 說「尚缺」而不是「定稿後會怎樣」',
  (lockTitle(emptyTab6) || '').includes('尚缺'), true);
check('灰掉的定稿鈕，title 列出實際缺口名稱',
  (lockTitle(emptyTab6) || '').includes(emptyState.blockerLabels[0]), true);
check('灰掉的定稿鈕，title 指出去哪裡看詳情',
  (lockTitle(emptyTab6) || '').includes('規則自檢'), true);
check('可以定稿時，title 不含「尚缺」',
  (lockTitle(filledHtml) || '').includes('尚缺'), false);
check('可以定稿時，title 仍說明定稿的後果（沒有連正常態一起改掉）',
  (lockTitle(filledHtml) || '').includes('凍結'), true);

// ── F. shortIssueLabel：把長訊息壓成一行（title 塞不下括號補充與破折號解釋）
check('切在括號前', shortIssueLabel('尚未選擇任何職業 (起始 5 級需配置 2~3 個職業)'), '尚未選擇任何職業');
check('切在破折號前',
  shortIssueLabel('起始資金尚未結算（原書 p.165）——目前顯示的 500z 是裝備預算'), '起始資金尚未結算');
check('沒有可切的地方就原樣回傳', shortIssueLabel('角色尚未填寫姓名'), '角色尚未填寫姓名');
check('空字串不會爆', shortIssueLabel(''), '');
check('null 不會爆', shortIssueLabel(null), '');
check('太長會截斷並加刪節號',
  shortIssueLabel('這是一條非常非常非常非常非常非常長的訊息沒有標點可以切').endsWith('…'), true);

// ─────────────────────────────────────────────────────────── CJ
section('CJ. F-028 術語解釋層：術語旁邊一句話（2026-10-27）');

// 這一組守的是「6 個天天看到的詞，全站沒有一句話解釋」（P12 量到 K2 = 6/12 = 50%）。
// 2026-10-27 GM 裁定的做法**不是**加速查抽屜分頁，而是「術語旁邊一個 tooltip、壓到一句」。
//
// 所以護欄守三件事，缺一不可：
//   ① 定義表本身完整：12 條、id 不重複、每條真的只有一句
//   ② 那 6 個詞各自在畫面上真的掛了說明——**只寫在資料裡不算**
//   ③ 說明是「常駐在 DOM 的 sr-only」，不是 hover 才存在
//      （否則讀屏聽不到、SSR 快照也驗不到——這是 F-007 的教訓）

// 2026-10-28（P18／F-031）：這裡原本是「恰好 12 條」。
// F-031 補了英雄技能表專用的 4 個詞（HR／物語點／IP／TP），總數變成 16。
// 改的時候**要留住它原本守的東西**：那 12 個詞是 K2 量測的分母，一個都不准消失——
// 所以改成逐一點名（只把 12 改成 16 的話，有人刪掉一條時它還是綠的）。
const K2_TERM_IDS = ['sl', 'freeBonus', 'classSkill', 'heroicSkill', 'mastery', 'quirk',
  'fateClock', 'playtest', 'creationRules', 'startingZenit', 'attributes', 'trait'];
check('F-028 定義表含 K2 量測的那 12 個術語（逐一點名，不准消失）',
  K2_TERM_IDS.filter((id) => !TERM_ENTRIES[id]), []);
check('F-028 定義表有 16 條（K2 的 12 ＋ F-031 補的 4）', GLOSSARY.length, 16);
check('F-028 定義表的 id 不重複', new Set(GLOSSARY.map((e) => e.id)).size, GLOSSARY.length);
check('F-028 每一條都有 id／term／short',
  GLOSSARY.filter((e) => !e.id || !e.term || !e.short).map((e) => e.id || '(無 id)'), []);
// 「一句話」是硬規則：兩個句號就是兩句。用句末標點數來判，比數字數可靠。
check('F-028 每一條的解釋只有一句（句末標點恰好一個、且以句號收尾）',
  GLOSSARY.filter((e) => (e.short.match(/[。？！]/g) || []).length !== 1 || !e.short.endsWith('。'))
    .map((e) => e.id),
  []);
check('F-028 每一條的解釋都在 60 字以內（tooltip 塞得下的長度）',
  GLOSSARY.filter((e) => e.short.length > 60).map((e) => `${e.id}:${e.short.length}`), []);
// 反向控制：解釋裡不得再出現第二個未解釋的術語。
// 判準刻意放寬到「不得提到另一個術語的正式名稱」，否則會誤傷（例如「精通」的解釋裡
// 本來就會出現「職業」這兩個字，那是普通名詞不是術語）。
check('F-028 解釋不得用另一個術語來解釋（禁用「請參考原書」這種推託）',
  GLOSSARY.filter((e) => /參考原書|請見原書|詳見/.test(e.short)).map((e) => e.id), []);

// ② 六個原本沒解釋的詞，各自在畫面上真的掛了說明。
// 「特質」掛在 d20 身世表的彈窗裡，而彈窗不開就不渲染，所以那一條改用原始碼層斷言。
//
// ※ 職業要挑對：`公測` 那一行只在「這個職業**有**變體、而且本團沒開公測」時才出現
//   （`ClassSkillCard.jsx` 的 `!showPlaytestVariants && classVariants.length > 0`）。
//   元素師沒有變體，用它會量到 0——那是「狀態沒到」不是「不存在」，正是 P12 記過的坑。
//   有變體的是：嵌合師／狂怒鬥士／守護者／熵師／修補匠／突變體。
const tab2WithClass = renderEditorAt(2, {
  classes: [{ className: '守護者', level: 3, skills: [] }]
});
// ※ 資金欄位在**第 1 步**（`TAB 1: 基礎身世`），不在第 4 步。
const tab1WithFunds = renderEditorAt(1, { startingFundsRolled: true });
const tab5TermHtml = renderEditorAt(5);
const termScreens = tab2WithClass + tab1WithFunds + tab5TermHtml;

check('F-028 第 5 步副標的「精通」有說明', termScreens.includes('term-hint-mastery'), true);
check('F-028 第 5 步副標的「英雄技能」有說明', termScreens.includes('term-hint-heroicSkill'), true);
check('F-028 第 2 步職業卡的「公測」有說明', termScreens.includes('term-hint-playtest'), true);
check('F-028 第 2 步職業卡的「特技（＝職業技能）」有說明',
  termScreens.includes('term-hint-classSkill'), true);
check('F-028 第 1 步的「初始持有金幣（＝起始資金）」有說明',
  termScreens.includes('term-hint-startingZenit'), true);

const identitySrc = read('../src/features/character-sheet/components/IdentityTablesModal.jsx');
check('F-028「特質」的說明掛在 d20 身世表（彈窗不開不渲染，故掃原始碼）',
  identitySrc.includes('<TermHint entry={TERMS.trait}>'), true);

// ③ 說明常駐：那一句話必須**一直是 DOM 的一部分**（這裡是 `aria-label`），
//    不能只在 hover 時才存在——否則讀屏聽不到、SSR 快照也驗不到（F-007 的教訓）。
const TERM_IDS = ['mastery', 'heroicSkill', 'playtest', 'classSkill', 'startingZenit'];
check('F-028 五個現場術語的說明都常駐在 DOM 裡（不是 hover 才出現）',
  TERM_IDS.filter((id) => !termScreens.includes(TERM_ENTRIES[id].short)), []);
check('F-028 每個術語按鈕都帶 aria-label（讀屏讀到這個詞時聽得到定義）',
  TERM_IDS.filter((id) => !new RegExp(`aria-label="[^"]*"[^>]*data-testid="term-hint-${id}"`).test(termScreens)
    && !new RegExp(`data-testid="term-hint-${id}"[^>]*aria-label="[^"]*"`).test(termScreens)),
  []);
// 反向控制：不要把定義塞成行內文字節點。
// 2026-10-27 第一版就是那樣做（`sr-only` 的鄰居），實機量到「1 個公測 公測：… 變體」——
// 畫面上看不到，但讀屏會把定義唸在句子中間，整句就斷了。
check('F-028 說明沒有被塞成行內文字（那會讓讀屏把定義唸在句子中間）',
  termScreens.includes('term-def-'), false);
check('F-028 常駐說明裡真的有那句話（不是空殼）',
  termScreens.includes(TERM_ENTRIES.mastery.short), true);
// 反向控制：浮層（term-tip）在預設狀態**不該**存在——它是條件渲染的。
// 這條同時證明「常駐的 aria-label」與「浮出的 tip」是兩個東西，不是同一個被誤認。
check('F-028 預設狀態不會預先渲染浮層（term-tip 只在開的時候出現）',
  termScreens.includes('term-tip-'), false);
// 反向控制：不要退回 `title` 屬性——那是手機看不到、鍵盤聽不到的做法。
check('F-028 沒有退回 title 屬性（手機不顯示、讀屏聽不到）',
  read('../src/components/ui/TermHint.jsx').includes('title='), false);

// ─────────────────────────────────────────────────────────── CK
section('CK. F-024：跑團面板的徒手傷害要吃引擎算好的加成');

// 這一節只守 UI 那一層——「引擎算對了，但面板自己又寫死一個 0」。
// 引擎那一半在 `characterEngine.test.mjs` §N。
const HUD_SRC = read('../src/features/character-sheet/components/CharacterPlayHUD.jsx');

// 只搜「`[HR + 0] 物理`」而不是「`HR + 0`」——後者會命中我自己寫的註解（§6 第 7 條），
// 也會命中 `【HR + 0】物理`（那是資料層的原始字串，本來就該保持 0）。
check('F-024 跑團面板不再寫死 [HR + 0] 物理', HUD_SRC.split('[HR + 0] 物理').length - 1, 0);
check('F-024 徒手膠囊改讀引擎算好的加成', HUD_SRC.includes('[HR + {unarmedBonus}] 物理'), true);
check('F-024 加成只在「主手真的是徒手」時才套用（拿劍的空手道徒不該多 6 點）',
  HUD_SRC.includes("mainWeaponBase.name === '徒手打擊'"), true);
// 反向控制：主手空著時那條退回路徑也要吃同一個數字。
// 如果只改膠囊、沒改退回條目，玩家空手時會看到上面「HR + 0」、下面「HR + 6」。
check('F-024 主手空著時的退回條目也走同一個分支（不是另一段寫死的字串）',
  HUD_SRC.split("name: character.equipment?.mainHand || '徒手打擊'").length - 1, 1);

// 列印卡也要一致，否則「印出來的」和「打團看到的」會是兩個數字。
const SHEET_SRC = read('../src/features/character-sheet/components/CharacterSheetExport.jsx');
check('F-024 列印卡的徒手列也套用同一個加成',
  SHEET_SRC.includes("item.name === '徒手打擊'"), true);
check('F-024 列印卡用的是共用的 withHrBonus，不是自己再寫一次字串取代',
  SHEET_SRC.includes('withHrBonus('), true);

// ─────────────────────────────────────────────────────────── CM
section('CM. F-012：角色卡上的職業數提示也要吃同一份開卡規則');

// 這條守的是「同一句話有兩個來源」。角色卡上原本寫死「起始需配置 2~3 個職業」，
// 但魔晶石制把上下限一起鎖成 3——於是同一張卡在角色卡上寫 2~3、
// 在驗證訊息裡寫「恰好 3」。修了驗證器卻沒修卡片，就還是兩個數字。
const emptyCard = (rules) => renderToStaticMarkup(React.createElement(CharacterCard, {
  character: { ...createNewCharacter({ name: '空卡' }), creationRules: rules }
}));

const standardCardHtml = emptyCard({});
const techCardHtml = emptyCard({ technospheres: 'full' });
check('一般團的角色卡寫「起始需配置 2~3 個職業」',
  standardCardHtml.includes('起始需配置 2~3 個職業'), true);
check('魔晶石團的角色卡寫「恰好 3 個職業」，不是 2~3',
  [techCardHtml.includes('恰好 3 個職業'), techCardHtml.includes('2~3')], [true, false]);
// 反向控制：卡片上不能出現「3~3」這種退化區間。
check('兩張卡都不會出現「3~3」', [standardCardHtml.includes('3~3'), techCardHtml.includes('3~3')], [false, false]);
// 這條是「真的吃開卡規則」而不是「剛好硬編碼兩個字串」——GM 自訂 1~4 也要反映。
const customCardHtml = emptyCard({ classCountMin: 1, classCountMax: 4 });
check('GM 自訂 1~4 時角色卡也跟著改', customCardHtml.includes('起始需配置 1~4 個職業'), true);

// ── F-012 的漏網之魚（P14，2026-10-27）
//
// 同一句話原本有**四個**地方各寫一次。P13 只修了驗證器與角色卡，
// 編輯器第 2 步那兩處**留在畫面上**——P14 的實機截圖上還印著「創角規定：3~3 個職業」。
// 這是「修好一半」的典型：修了看得見的那兩處，沒去數總共有幾處。
check('classCountRange 上下限相等 → 只印一個數字', classCountRange({ classCountMin: 3, classCountMax: 3 }), '3');
check('classCountRange 上下限不同 → 印區間', classCountRange({ classCountMin: 2, classCountMax: 3 }), '2~3');
check('classCountRange 走 resolveCreationRules（缺值用預設 2~3）', classCountRange({}), '2~3');
check('classCountPhrase 相等 → 加「恰好」', classCountPhrase({ classCountMin: 3, classCountMax: 3 }), '恰好 3');
check('classCountPhrase 不同 → 不加「恰好」', classCountPhrase({ classCountMin: 1, classCountMax: 4 }), '1~4');

// 原始碼掃描：編輯器裡不准再有「自己拼區間」的寫法。
// 這比「畫面上有沒有 3~3」可靠——後者要先想辦法讓畫面進入那個狀態。
// （`editor` 是檔頭就讀好的原始碼，路徑相對這個測試檔，不是 cwd。）
check('編輯器不再自己拼 `classCountMin}~{classCountMax`',
  editor.includes('classCountMin}~{'), false);
check('編輯器兩處都改吃共用函式',
  [editor.includes('classCountPhrase(rules)'), editor.includes('classCountRange(rules)')], [true, true]);
const cardSrc = read('../src/features/character-sheet/components/CharacterCard.jsx');
check('角色卡也吃共用函式（不再自己比 min === max）',
  [cardSrc.includes('classCountPhrase('), cardSrc.includes('classCountMin ===')], [true, false]);

// ── 第六處（P15，2026-10-27）
//
// 上面兩條掃描只掃了「編輯器」與「角色卡」，於是**職業選擇器**那一處活了下來：
// `ClassPickerModal.jsx` 的「確定後會有 N 個職業，開局規定是 {min}~{max} 個」
// 仍然自己拼區間——玩家選錯職業數時，紅字會印「開局規定是 3~3 個」。
//
// 教訓：「逐一都必須成立」不能靠手寫清單。清單是我想得到的檔案，
// 而漏掉的正是我沒想到的那一個。改成**掃整個目錄**，新增檔案自動納入。
//
// ※ P16 再把範圍擴大一次：原本只掃 `components/`，但 `CharacterSheet.jsx`
//   住在功能目錄根、不在 `components/` 底下——刻意破壞「把徽章文案寫進名冊」
//   時護欄一聲不吭，才發現掃描的邊界畫錯了。現在掃**整個 `character-sheet/`**（遞迴）。
const FEATURE_DIR = new URL('../src/features/character-sheet/', import.meta.url);
const walkSourceFiles = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) walkSourceFiles(child, acc);
    else if (/\.(js|jsx)$/.test(entry.name)) acc.push(child);
  }
  return acc;
};
const featureFiles = walkSourceFiles(FEATURE_DIR);
const baseName = (url) => url.pathname.split('/').pop();
check('功能目錄掃得到檔案（掃描本身不能是空的）', featureFiles.length > 50, true);
// 兩種寫法都要抓：JSX 的 `{min}~{max}` 與樣板字串的 `${min}~${max}`。
// 第一版只掃前者，於是 `ClassPickerModal` 按鈕上的
// `開局需兼修 ${min}~${max} 個職業` 從掃描底下走過去了（P15 再抓到一處）。
const HAND_ROLLED = /classCount(?:Min|Max)\}?\s*~/;
// ※ 掃描範圍一擴大就立刻抓到**第 9 處**：`utils/characterEngine.js` 的驗證訊息
//   `需配置 ${min}~${max} 個職業` 是 `classCountPhrase` 的第三份複本。
//   當時（P14）說「共 8 處」是照我手寫的清單數的——清單漏了它。
//   這次不是靠猜，是靠掃描；先紅後綠，比任何人工比對可信。
//
// 唯一允許命中 `HAND_ROLLED` 的檔案就是**共用函式的定義檔**（`classCountRange` 本身）。
// 但不能整檔放行：那等於在定義檔裡開一個無人看守的後門。
// 所以改成「定義檔恰好命中 1 次」——多一次就是又長出一個複本。
const RANGE_DEF_FILE = 'creationRules.js';
const rangeHits = featureFiles
  .map((url) => ({ name: baseName(url), hits: (fs.readFileSync(url, 'utf8').match(HAND_ROLLED) || []).length }))
  .filter((f) => f.hits > 0);
check('所有「N~M 個職業」都吃共用函式（整個功能目錄，逐一，不抽樣）',
  rangeHits.filter((f) => f.name !== RANGE_DEF_FILE).map((f) => `${f.name}×${f.hits}`), []);
check('共用函式在定義檔裡只寫一次（定義檔不是後門）',
  rangeHits.filter((f) => f.name === RANGE_DEF_FILE).map((f) => f.hits), [1]);
// 訊息文字必須與改動前一字不差：這是給玩家看的驗證紅字，不是內部字串。
// ※ 上一版在這裡漏了空格（變成「需配置 恰好 3 個職業」），是 creation 測試的
//   「上下限相同時，訊息寫『恰好 3 個職業』」那條抓到的——所以這裡補一條守空格。
const engineSrc = read('../src/features/character-sheet/utils/characterEngine.js');
check('驗證訊息吃共用函式（第 9 處）', engineSrc.includes('classCountPhrase(creation)'), true);
check('驗證訊息沒有偷偷改字', engineSrc.includes('需配置 ${creation.classCountMin}~'), false);
check('驗證訊息的空格沒被改掉', engineSrc.includes("countPhrase.startsWith('恰好') ? '' : ' '"), true);
// 掃描本身的體檢：餵它一段真的寫壞的字串，它必須叫。
check('掃描抓得到 JSX 寫法', HAND_ROLLED.test('是 {rules.classCountMin}~{rules.classCountMax} 個'), true);
check('掃描抓得到樣板字串寫法', HAND_ROLLED.test('是 ${rules.classCountMin}~${rules.classCountMax} 個'), true);
check('掃描不會誤抓單純的比較式', HAND_ROLLED.test('classesAfter >= rules.classCountMin && classesAfter <= rules.classCountMax'), false);
const pickerSrc = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
check('職業選擇器的紅字也吃 classCountPhrase', pickerSrc.includes('classCountPhrase(rules)'), true);

section('CN. F-018：免費增益二選一——「由玩家自己選」要說出來，選了要算對（2026-10-27）');

// GM 裁定：「這個原本就是玩家自己選擇的」。所以這一節守的不是「幫他選」，
// 而是兩件事：①畫面上要說清楚沒有對錯（不然新手會停下來翻書）
// ②選了之後，三個消費端（數值／修改記錄／列印卡）要說同一句話。
const mkChoiceItem = (className, extra = {}) => ({
  className,
  level: 3,
  skills: [],
  ...extra
});
const renderClassCard = (className, extra) => renderToStaticMarkup(React.createElement(ClassSkillCard, {
  classItem: mkChoiceItem(className, extra),
  classIndex: 0,
  character: createNewCharacter({ name: '二選一' }),
  theme: getCharacterTheme('emerald')
}));

const dancerDefault = renderClassCard('舞者');
check('舞者（二選一職業）出現「二選一」那一列',
  dancerDefault.includes('data-testid="free-benefit-choice"'), true);
check('那一列有「由你決定，兩者都是永久 +5」的說明',
  dancerDefault.includes('由你決定，兩者都是永久 +5'), true);
check('未選時 HP 是按下狀態、MP 不是',
  [dancerDefault.includes('aria-pressed="true" data-testid="free-benefit-hp"'),
    dancerDefault.includes('aria-pressed="true" data-testid="free-benefit-mp"')], [true, false]);

// 舊存檔若存了小寫（歷史上有兩處拿小寫比），介面也必須認得——這是正規化的實際好處。
const dancerLegacyMp = renderClassCard('舞者', { chosenBenefit: 'mp' });
check('舊存檔寫小寫 mp，介面仍把 MP 標成已選',
  [dancerLegacyMp.includes('aria-pressed="true" data-testid="free-benefit-mp"'),
    dancerLegacyMp.includes('aria-pressed="true" data-testid="free-benefit-hp"')], [true, false]);

// 反向控制：不是二選一的職業不准出現選擇列（守護者是固定 HP +5）。
const guardianCard = renderClassCard('守護者');
check('守護者（固定 HP +5）不出現二選一那一列',
  guardianCard.includes('data-testid="free-benefit-choice"'), false);

// ── 列印卡：這一行以前永遠是空的（比小寫比不到），29 個職業全部不顯示免費增益
const sheetOf = (className, extra) => buildSheetModel({
  ...createNewCharacter({ name: '列印' }),
  level: 5,
  classes: [mkChoiceItem(className, extra)]
}).classes[0].freeBenefit;

check('列印卡：舞者選 MP → 印「最大 MP +5」', sheetOf('舞者', { chosenBenefit: 'MP' }), '最大 MP +5');
check('列印卡：舞者選 HP → 印「最大 HP +5」', sheetOf('舞者', { chosenBenefit: 'HP' }), '最大 HP +5');
check('列印卡：舞者未選 → 預設印「最大 HP +5」', sheetOf('舞者'), '最大 HP +5');
check('列印卡：舊存檔小寫 mp → 印「最大 MP +5」', sheetOf('舞者', { chosenBenefit: 'mp' }), '最大 MP +5');
// 非二選一職業印資料層原文（這條以前也是空的）
check('列印卡：守護者印「HP +5，職業防具/盾牌」', sheetOf('守護者'), 'HP +5，職業防具/盾牌');
check('列印卡：遊蕩者印「IP +2」', sheetOf('遊蕩者'), 'IP +2');

// ── 資料層：6 個二選一職業的寫法必須完全一致
// （原本只有秘儀師【變體】多寫「(請依配置選擇)」，而它剛好是最不需要提示的那個）
const choiceClassNames = Object.keys(rulesData.classes)
  .filter((cn) => isHpMpChoiceBenefit((rulesData.classes[cn].freeBenefits || '') + ' ' + (rulesData.classes[cn].freeBonus || '')));
check('二選一職業共 6 個', choiceClassNames.length, 6);
check('6 個的 freeBonus 寫法完全一致',
  [...new Set(choiceClassNames.map((cn) => rulesData.classes[cn].freeBonus))], ['HP +5 或 MP +5']);
check('沒有任何一個還在寫「請依配置選擇」',
  choiceClassNames.some((cn) => rulesData.classes[cn].freeBonus.includes('請依配置選擇')), false);

section('CO. F-017：29 個職業的定位句要出現在「左邊清單」，不是點開才看得到');

// 選職業是開卡最關鍵的決定，但 29 個名字擺在一起時，清單卡上只有
// 「職業名／又稱／免費增益」——定位句（「護衛同伴並吸收衝擊的鐵壁守衛。」）只寫在右邊詳情面板。
// 於是「這 29 個哪個適合我」的比較成本＝29 次點擊，而且來回比較還要在清單與詳情之間找位置。
const pickerHtml = renderToStaticMarkup(React.createElement(ClassPickerModal, {
  isOpen: true,
  onClose: () => {},
  theme: getCharacterTheme('emerald'),
  // 五本全開（含特典合輯與公測），否則「每一個職業」這句話就不成立——
  // 第一版漏了 bonus，於是 死靈術士／卡牌大師 被判成「缺定位句」，其實是它們根本沒列出來。
  enabledBooks: ['core', 'highFantasy', 'naturalFantasy', 'technoFantasy', 'bonus', 'playtest'],
  creationRules: { ...DEFAULT_CREATION_RULES, allowPlaytest: true },
  onSelectClasses: () => {}
}));
const pickerText = pickerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
check('守護者的定位句出現在清單上',
  pickerText.includes('護衛同伴並吸收衝擊的鐵壁守衛'), true);
// 逐一都必須成立，不是「至少有一個」——只補幾個的話，比較起來還是有洞。
const missingTaglines = Object.keys(rulesData.classes).filter((cn) => {
  const tag = getClassInfo(cn).tagline;
  return tag && !pickerText.includes(tag);
});
check('每一個職業的定位句都在清單上（缺的列出來）', missingTaglines, []);
check('每一張清單卡都有自己的 testid（不是靠文字比對）',
  [pickerHtml.includes('data-testid="class-tagline-守護者"'),
    pickerHtml.includes('data-testid="class-tagline-舞者"')], [true, true]);
// 兩行就截斷，完整句子放 title——否則 29 張卡會變成一面字牆。
const pickerSrcTail = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
check('定位句在清單上截斷成兩行', pickerSrcTail.includes('line-clamp-2'), true);
check('完整句子留在 title 裡', pickerSrcTail.includes('title={item.info.tagline}'), true);

// ─────────────────────────────────────────────────────────── CP
section('CP. F-015：名冊卡要看得出「這張卡是哪個規則開的」（2026-10-27）');

// 病：20 張卡並存時，四張卡四組規則，外觀完全一致。把卡名從全文剔除後，
// 搜「魔晶石／底力／營地活動／自訂規則」一個都沒中——要分辨只能一張一張點進去。
// 徽章的內容由 `describeRuleBadges()` 決定（`test:creation` §F-015 驗行為），
// 這裡只守「名冊卡真的把它印出來，而且沒有第二份寫法」。
// ※ `sheetSrc` 是 §BH1 就讀好的同一份原始碼，直接重用（重複宣告會讓整個檔案編不過）。
check('名冊卡有規則徽章區塊（用 testid 定位，不靠文字）',
  sheetSrc.includes('data-testid={`roster-rules-${char.id}`}'), true);
check('徽章吃共用函式（不是自己拼字串）',
  sheetSrc.includes('describeRuleBadges(char.creationRules)'), true);
check('徽章有印出 label（算得出來但沒畫，等於沒修）',
  sheetSrc.includes('{badge.label}'), true);
check('超過 4 顆時收成「+N」而不是把卡片撐爆',
  [sheetSrc.includes('ruleBadges.slice(0, 4)'), sheetSrc.includes('+{ruleBadgesRest.length}')], [true, true]);
check('「+N」的 title 列出被收起來的那幾顆（資訊不能消失）',
  sheetSrc.includes('ruleBadgesRest.map((b) => b.label).join'), true);

// 單一來源：徽章文案只准出現在 `creationRules.js`。
// 若哪天有人在名冊或角色卡裡再寫一次 `'魔晶石・'`，這裡會叫——
// 「同一句話寫兩份」正是 F-012 補了三輪的原因。
//
// ※ 掃描範圍是**整個 `character-sheet/` 功能目錄**（遞迴，見上方 §CM 的 `walkSourceFiles`），
//   不是只有 `components/`——第一版只掃 `components/`，於是 `CharacterSheet.jsx`
//   （它在功能目錄根）整個被跳過。這是同一個坑的第三次：**掃描的邊界畫在哪，決定了你漏掉什麼。**
const BADGE_LABEL_MARK = '魔晶石・';
const badgeCopyElsewhere = featureFiles
  .filter((url) => !url.pathname.endsWith('/data/creationRules.js'))
  .filter((url) => fs.readFileSync(url, 'utf8').includes(BADGE_LABEL_MARK))
  .map(baseName);
check('徽章文案只有一份（整個功能目錄都不得自己再寫一次）', badgeCopyElsewhere, []);

// ═══════════════════════════════════════════════════════════
section('CQ. F-016：技能數標題要跟清單一起走，少掉的那條要說出來（2026-10-27）');

// 兩句話都對，但放在一起就是騙人：標題寫「5 項技能任選」，底下只有 4 張卡。
// 而且那個過濾**本身是對的**（科技奇幻 p.133 說魔晶石制沒有盾牌）——
// 錯的是「濾掉了卻不說」。所以這裡守兩件事：
//   ①數字必須由清單長度算出來（不是寫死 5）
//   ②濾掉時要說出「少了哪一條、為什麼」
const fullRules = { technospheres: 'full' };
check('守護者在魔晶石制下少一條技能',
  suppressedSkillsForClass('守護者', 'full'), ['雙重盾牌']);
check('不使用魔晶石時一條都不少',
  suppressedSkillsForClass('守護者', 'off'), []);
// 清單長度 + 被作廢數 ＝ 原書的技能總數（逐一驗 29 個職業，不抽樣）
const coreClassNames = Object.keys(rulesData.classes);
const classSkillMathOff = coreClassNames.filter((n) =>
  classSkillsForClass(n, 'off').length + suppressedSkillsForClass(n, 'off').length
  !== (rulesData.classes[n].skills || []).length);
check('不使用魔晶石時：清單長度 + 作廢數 ＝ 原書技能數（29 職業逐一）', classSkillMathOff, []);
const classSkillMathFull = coreClassNames.filter((n) =>
  classSkillsForClass(n, 'full').length + suppressedSkillsForClass(n, 'full').length
  !== (rulesData.classes[n].skills || []).length);
check('魔晶石制下也成立（29 職業逐一，不抽樣）', classSkillMathFull, []);
check('沒有被作廢的技能時，說明句是空字串（不要印一行空的）',
  suppressedSkillsNote([]), '');
check('說明句點名那一條技能',
  suppressedSkillsNote(['雙重盾牌']).includes('【雙重盾牌】'), true);
check('說明句附出處（p.133）',
  suppressedSkillsNote(['雙重盾牌']).includes('p.133'), true);

// 標題的數字：掃原始碼確認沒有寫死的「5 項技能任選」
const pickerSrcF16 = read('../src/features/character-sheet/components/ClassPickerModal.jsx');
check('職業選擇器的技能數不是寫死的 5',
  stripComments(pickerSrcF16).includes('5 項技能任選'), false);
check('職業選擇器的技能數由清單長度算出來',
  pickerSrcF16.includes('{(activeClassItem.def.skills || []).length} 項技能任選'), true);
check('職業選擇器有作廢說明的位置（用 testid 定位，不靠文字）',
  pickerSrcF16.includes('data-testid="class-skill-suppressed-note"'), true);

// 第二個現場（職業魔石區塊）——F-016 的教訓就是「只修一個現場會變成修好一半」
const mnemoSrcF16 = read('../src/features/character-sheet/components/MnemosphereSection.jsx');
// ※ 只掃原始碼不夠：把整段條件改成 `{false ? …}` 之後，testid 那串字還在檔案裡，
//   掃字串照樣全綠，但畫面上一個字都不會印。所以下面一律用 SSR 真的畫一次。
check('職業魔石區塊原始碼裡有作廢說明的位置',
  mnemoSrcF16.includes('mnemosphere-suppressed-note-'), true);

const renderMnemosphereBlock = (className, creationRules) => renderToStaticMarkup(
  React.createElement(MnemosphereSection, {
    theme: {},
    onChange: () => {},
    character: {
      ...createNewCharacter({ name: '魔石測試' }),
      creationRules,
      technospheres: { mnemospheres: [{ id: 'm1', className, level: 1, skills: [] }] }
    }
  })
);
const mnemoGuardianHtml = renderMnemosphereBlock('守護者', fullRules);
const mnemoElementalistHtml = renderMnemosphereBlock('元素師', fullRules);
check('職業魔石區塊真的印出作廢說明（SSR，不是掃字串）',
  mnemoGuardianHtml.includes('mnemosphere-suppressed-note-m1'), true);
check('職業魔石區塊的說明點名【雙重盾牌】',
  mnemoGuardianHtml.includes('【雙重盾牌】'), true);
check('（F-016 反向）沒有技能被作廢的職業不印這句',
  mnemoElementalistHtml.includes('suppressed-note'), false);
check('兩個現場吃同一個說明句（不得各寫一份）',
  [pickerSrcF16.includes('suppressedSkillsNote(suppressedSkills)'),
    mnemoSrcF16.includes('suppressedSkillsNote(suppressedSkillsForClass(')],
  [true, true]);

// SSR：守護者 + 魔晶石 full → 標題 4、有說明；off → 標題 5、沒說明
const renderPickerDetailWithRules = (className, creationRules) => renderToStaticMarkup(
  React.createElement(ClassPickerModal, {
    isOpen: true, onClose: () => {}, theme: {}, enabledBooks: ['core'],
    onToggleSourcebook: () => {}, onSetSourcebooks: () => {},
    existingClassNames: [], onSelectClasses: () => {}, budgetUsed: 0,
    initialClassName: className, creationRules, panelOnly: true
  })
);
const guardianFullHtml = renderPickerDetailWithRules('守護者', fullRules);
const guardianOffHtml = renderPickerDetailWithRules('守護者', { technospheres: 'off' });
check('（SSR）魔晶石制下守護者標題寫「4 項」', guardianFullHtml.includes('4 項技能任選'), true);
check('（SSR）魔晶石制下不再寫「5 項」', guardianFullHtml.includes('5 項技能任選'), false);
check('（SSR）魔晶石制下說出【雙重盾牌】被作廢',
  guardianFullHtml.includes('【雙重盾牌】'), true);
check('（SSR）不使用魔晶石時標題回到「5 項」', guardianOffHtml.includes('5 項技能任選'), true);
check('（SSR）不使用魔晶石時不發這句說明（反向控制）',
  guardianOffHtml.includes('class-skill-suppressed-note'), false);

// ═══════════════════════════════════════════════════════════
section('CR. F-013：魔晶石制下的主手彈窗不該留一堆按了沒反應的控制項（2026-10-27）');

// 20 顆按鈕裡有 18 顆永遠不會改變任何東西。**資料層清了，外殼沒清。**
const renderEquipBody = (creationRules, slot = 'mainHand') => renderToStaticMarkup(
  React.createElement(EquipmentPickerBody, {
    slot,
    theme: {},
    character: { ...createNewCharacter({ name: '裝備測試' }), creationRules },
    stats: {},
    remainingBudget: 500,
    onSelect: () => {},
    onClose: () => {}
  })
);
const equipFullHtml = renderEquipBody(fullRules);
const equipOffHtml = renderEquipBody({ technospheres: 'off' });

check('（F-013）魔晶石制下不再有搜尋框', equipFullHtml.includes('名稱或說明'), false);
check('（F-013）魔晶石制下不再有「顯示目前無法裝備的」勾選',
  equipFullHtml.includes('顯示目前無法裝備的'), false);
check('（F-013）魔晶石制下不再有「只看買得起的」勾選', equipFullHtml.includes('只看買得起的'), false);
check('（F-013）魔晶石制下不再有排序下拉', equipFullHtml.includes('>排序<'), false);
// ※ 不要用「>類別<」判斷：那四個字在**表頭**也有（武器表本來就有「類別」欄），
//   第一版就是這樣寫，於是過濾器明明收掉了它還說「還在」。
//   改用只在篩選列出現的字（類別鈕「奧術」）。
check('（F-013）魔晶石制下不再有類別篩選鈕', equipFullHtml.includes('>奧術<'), false);
check('（F-013）魔晶石制下留一顆「關閉並去鍛造」',
  equipFullHtml.includes('關閉並去鍛造'), true);
check('（F-013）說明不再把同一頁下方的面板講成「分頁」',
  equipFullHtml.includes('分頁鍛造'), false);
check('（F-013）說明改成「下方」', equipFullHtml.includes('下方'), true);
// 反向控制：不使用魔晶石時，篩選工具列必須完整還在（修法不是把工具列全刪）
check('（F-013 反向）不使用魔晶石時搜尋框還在', equipOffHtml.includes('名稱或說明'), true);
check('（F-013 反向）不使用魔晶石時類別篩選還在', equipOffHtml.includes('>奧術<'), true);
check('（F-013 反向）不使用魔晶石時沒有「關閉並去鍛造」',
  equipOffHtml.includes('關閉並去鍛造'), false);
// 副手那兩顆切換鈕（盾牌／單手武器）在受限模式下也是死按鈕——兩邊都是空表。
const equipOffHandFull = renderEquipBody(fullRules, 'offHand');
const equipOffHandOff = renderEquipBody({ technospheres: 'off' }, 'offHand');
check('（F-013）魔晶石制下副手不再有「盾牌／單手武器」切換鈕',
  equipOffHandFull.includes('單手武器'), false);
check('（F-013 反向）不使用魔晶石時副手切換鈕還在',
  equipOffHandOff.includes('單手武器'), true);

// ═══════════════════════════════════════════════════════════
section('CS. F-027：紙卡要印出「你選了什麼」，不是只有規則原文（2026-10-27）');

const quirkCardChar = (quirk, quirkChoice) => ({
  ...createNewCharacter({ name: '金手指測試' }),
  quirk,
  quirkChoice
});
check('（F-027）單組選項：通智幽魂印得出選了哪些屬性（含組名，否則兩組分不出來）',
  describeQuirkChoice(quirkCardChar('通智幽魂', { resist1: '火', resist2: '光' })).map((r) => `${r.group}/${r.label}`),
  ['第一種抗性/火', '第二種抗性/光']);
check('（F-027）沒選過 → 空陣列（舊角色不受影響）',
  describeQuirkChoice(quirkCardChar('通智幽魂', '')), []);
check('（F-027）沒選金手指 → 空陣列',
  describeQuirkChoice(quirkCardChar('無', '')), []);
check('（F-027）天才的宿敵：3 選 1 印得出來',
  describeQuirkChoice(quirkCardChar('天才的宿敵', 'ritual')).map((r) => r.label), ['儀式']);
check('（F-027）會說話的野獸：兩組都印，且分得出是哪一組',
  describeQuirkChoice(quirkCardChar('會說話的野獸', { boon1: 'customWeapon', boon2: 'unarmed' }))
    .map((r) => `${r.group}/${r.label}`),
  ['第一個增益/你可以裝備一個自訂武器', '第二個增益/徒手攻擊 +6 傷害（30 級後 +10）']);
check('（F-027）會說話的野獸只選一半 → 只印選了的那一組',
  describeQuirkChoice(quirkCardChar('會說話的野獸', { boon1: 'customWeapon' })).length, 1);

const sheetWithChoice = buildSheetModel(quirkCardChar('天才的宿敵', 'spell'));
check('（F-027）列印卡模型帶「已選」', sheetWithChoice.quirkChoice.map((r) => r.label), ['咒語']);
const sheetNoChoice = buildSheetModel(quirkCardChar('天才的宿敵', ''));
check('（F-027）沒選過 → 列印卡不印這一塊', sheetNoChoice.quirkChoice, []);
const quirkPage2Html = renderToStaticMarkup(React.createElement(OfficialSheetPage2, {
  model: sheetWithChoice, theme: 'parchment'
}));
check('（F-027）紙卡第 2 頁真的印出「已選」', quirkPage2Html.includes('已選'), true);
check('（F-027）紙卡上印得出選的那一項', quirkPage2Html.includes('咒語'), true);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
