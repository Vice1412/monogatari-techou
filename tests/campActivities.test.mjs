/**
 * 營地活動（CAMP ACTIVITIES）護欄 —— 自然奇幻手冊 p.130–133 的選用規則。
 *
 * 執行：`npm run test:campactivities`
 *
 * 官方依據：*Fabula Ultima — Atlas: Natural Fantasy*，印刷 p.130–133
 * （此書 PDF 偏移 +2，抽取指令見 `docs/rulebooks.md`）。
 * 中文譯名依繁中版角色卡 V2.17；CHM 漢化是測試版，五處數字落差記在
 * `src/features/character-sheet/data/campActivities.js` 檔頭，本檔逐條釘住。
 *
 * ## 這道關卡守的是「一條選用規則在五個層面同時生效」
 *
 *   ① 開卡規則開關（`creationRules.campActivities`，預設 false）
 *   ② 角色資料（`character.campActivities = { picked, used }`；舊存檔沒有 → 空狀態）
 *   ③ 上限（2 種；金手指【老大哥／歐尼醬】→ 3 種，且團隊沒開規則時仍可用）
 *   ④ 建角驗證（第 5 步：未選滿／超過上限；規則關閉時**不出現任何訊息**）
 *   ⑤ 介面入口（規則與金手指都沒開時整個區塊不存在，不是停用）
 *
 * 任何一處漏掉，畫面看起來都正常——這正是要把它們釘死的原因
 * （同 `tests/zeroPowers.test.mjs` 檔頭的理由）。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CAMP_ACTIVITIES,
  CAMP_ACTIVITY_IDS,
  CAMP_ACTIVITY_BASE_COUNT,
  CAMP_ACTIVITY_FIELD,
  CAMP_ACTIVITY_SOURCE,
  CAMP_ACTIVITY_TARGETS,
  campActivityAccess,
  campActivityAllowance,
  campActivityById,
  campActivityIssues,
  campActivityName,
  campActivityTargetLabel,
  createCampActivityState,
  isCampActivitiesEnabled,
  normalizeCampActivities,
  quirkCampActivityCount,
  resetCampActivityUses,
  setCampActivityUsed,
  toggleCampActivity
} from '../src/features/character-sheet/data/campActivities.js';
import {
  DEFAULT_CREATION_RULES,
  CREATION_RULE_FIELDS,
  diffCreationRules,
  isDefaultCreationRules,
  resolveCreationRules
} from '../src/features/character-sheet/data/creationRules.js';
import {
  createNewCharacter,
  validateCharacter
} from '../src/features/character-sheet/utils/characterEngine.js';
import { LOG_FIELD_LABELS } from '../src/features/character-sheet/utils/characterLog.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import CampActivitiesBlock from '../src/features/character-sheet/components/CampActivitiesBlock.jsx';
import { buildSheetModel } from '../src/features/character-sheet/components/CharacterSheetExport.jsx';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';

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

/** SSR 標記 → 純文字（去掉 React 的文字節點註解與標籤） */
const plain = (html) => String(html)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]*>/g, '');

const READ = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
const theme = getCharacterTheme('parchment');

const OFF_RULES = resolveCreationRules({});
const ON_RULES = resolveCreationRules({ campActivities: true });

// ─────────────────────────────────────────────────────────── A
section('A. 資料層：15 種活動（p.131–133）');

check('活動數量為 15', CAMP_ACTIVITIES.length, 15);
check('活動 id 唯一', new Set(CAMP_ACTIVITY_IDS).size, 15);
/**
 * 中文名逐字沿用繁中版角色卡 V2.17（`附加表` 15 筆）。
 * 這條同時是「不得自行改譯」的護欄：改一個字就會在這裡失敗。
 */
check('中文名（V2.17 逐字）', CAMP_ACTIVITIES.map((a) => a.name), [
  '營地打造', '地圖測繪', '戰鬥課程', '白日夢', '雙倍分量',
  '探索', '採集', '魔法課程', '武術練習', '按摩',
  '抱佛腳', '鼓舞士氣', '提前規劃', '酣睡', '自行訓練'
]);
check('每筆都有規則文', CAMP_ACTIVITIES.every((a) => typeof a.desc === 'string' && a.desc.length > 10), true);
check('每筆都有目標', CAMP_ACTIVITIES.every((a) => Boolean(CAMP_ACTIVITY_TARGETS[a.target])), true);
check('目標只有四種合法值', [...new Set(CAMP_ACTIVITIES.map((a) => a.target))].sort(),
  ['ally', 'gourmet', 'self', 'selfOrAlly']);
check('目標標籤', CAMP_ACTIVITIES.filter((a) => a.target === 'gourmet').map(campActivityTargetLabel),
  ['擁有美食家職業的角色']);
check('頁碼都落在 p.131–133', CAMP_ACTIVITIES.every((a) => ['p.131', 'p.132', 'p.133'].includes(a.page)), true);
check('出處字串', CAMP_ACTIVITY_SOURCE, '自然奇幻手冊 p.130–133');
check('欄位名', CAMP_ACTIVITY_FIELD, 'campActivities');
check('基準上限為 2（原書 p.130 two different Camp Activities）', CAMP_ACTIVITY_BASE_COUNT, 2);

// 1d6 表格：只有探索與採集有，且各 4 列
const tabular = CAMP_ACTIVITIES.filter((a) => Array.isArray(a.table));
check('只有探索與採集有 1d6 表格', tabular.map((a) => a.name), ['探索', '採集']);
check('兩張表各 4 列', tabular.map((a) => a.table.length), [4, 4]);
check('表格列號', tabular.map((a) => a.table.map((r) => r.roll)),
  [['1', '2', '3–5', '6'], ['1', '2', '3–5', '6']]);

check('依 id 取活動', campActivityById('massage').name, '按摩');
check('未知 id 回 null', campActivityById('不存在'), null);
check('未知 id 的名稱回空字串', campActivityName('不存在'), '');

// ─────────────────────────────────────────────────────────── B
section('B. 官方數值逐條（CHM 測試版五處落差，一律以英文正式版為準）');

const byId = (id) => campActivityById(id);
// ① 探索 1：正式版是「恢復一半」，CHM 寫「不能恢復」
check('探索 1 = 恢復正常一半的 HP 與 MP',
  byId('exploration').table[0].text.includes('恢復正常一半'), true);
check('探索 1 不是「不能恢復」', byId('exploration').table[0].text.includes('不能恢復'), false);
// ② 探索 2：正式版 2 點 IP，CHM 寫 1 點
check('探索 2 = 2 點庫存點', byId('exploration').table[1].text.includes('2 點庫存點'), true);
// ③ 探索 6：正式版含 3 點 IP + 等級 × 50 z
check('探索 6 = 3 點庫存點 + 等級 × 50 z',
  [byId('exploration').table[3].text.includes('3 點庫存點'),
    byId('exploration').table[3].text.includes('等級 × 50')],
  [true, true]);
// ④ 抱佛腳：正式版 3 點進度，CHM 寫 2 點
check('抱佛腳 = 3 點造物專案進度', byId('midnightOil').desc.includes('3 點進度'), true);
check('抱佛腳不是 2 點', byId('midnightOil').desc.includes('2 點進度'), false);
// ⑤ 採集 6：味道各自任選；提前規劃：團體檢定（不是先攻）
check('採集 6 = 3 份食材，味道各自任選', byId('gathering').table[3].text.includes('味道各自任選'), true);
check('提前規劃 = 團體檢定（CHM 誤作先攻）',
  [byId('planning').desc.includes('團體檢定'), byId('planning').desc.includes('先攻')],
  [true, false]);
check('採集 1 = 休息結束時與團隊等級同級的簡單衝突',
  byId('gathering').table[0].text.includes('簡單衝突'), true);
check('按摩不能用在儀式的 MP 成本上', byId('massage').desc.includes('不能用在儀式的 MP 成本上'), true);
check('酣睡的額外行動限裝備／阻礙／庫存',
  ['裝備', '阻礙', '庫存'].every((w) => byId('sleepSoundly').desc.includes(w)), true);
check('武術練習 = 多重（2）或 +1', byId('martialPractice').desc.includes('多重（2）'), true);

// 「直到下一次休息前限一次」的活動才有 once 標記（探索／採集／抱佛腳是當場結算）
check('非限一次的活動只有三個',
  CAMP_ACTIVITIES.filter((a) => !a.once).map((a) => a.name), ['探索', '採集', '抱佛腳']);

// ─────────────────────────────────────────────────────────── C
section('C. 開卡規則開關（預設 false）');

check('預設不開放營地活動', DEFAULT_CREATION_RULES.campActivities, false);
check('欄位集含 campActivities', CREATION_RULE_FIELDS.includes('campActivities'), true);
check('resolve 帶出 campActivities', resolveCreationRules({}).campActivities, false);
check('壞資料（字串 "true"）不開啟', resolveCreationRules({ campActivities: 'true' }).campActivities, false);
check('壞資料（1）不開啟', resolveCreationRules({ campActivities: 1 }).campActivities, false);
check('明確 true 才開啟', resolveCreationRules({ campActivities: true }).campActivities, true);
check('明確 false 關閉', resolveCreationRules({ campActivities: false }).campActivities, false);
check('預設規則仍算官方標準', isDefaultCreationRules({}), true);
check('開了就不是官方標準', isDefaultCreationRules({ campActivities: true }), false);
check('diff 只帶不同的欄位', diffCreationRules({ campActivities: true }), { campActivities: true });
check('diff 不回填預設值', diffCreationRules({}), {});
check('resolve 的輸出欄位集與預設一致',
  Object.keys(resolveCreationRules({})).sort(), [...CREATION_RULE_FIELDS].sort());

// ─────────────────────────────────────────────────────────── D
section('D. 角色資料：空狀態與舊存檔正規化');

check('新狀態是空的（不替玩家挑）', createCampActivityState(), { picked: [], used: [] });
check('舊存檔 undefined → 空狀態', normalizeCampActivities(undefined), { picked: [], used: [] });
check('舊存檔 null → 空狀態', normalizeCampActivities(null), { picked: [], used: [] });
check('未知 id 被丟棄',
  normalizeCampActivities({ picked: ['massage', '不存在', 42, null] }).picked, ['massage']);
check('重複項去重',
  normalizeCampActivities({ picked: ['massage', 'massage', 'training'] }).picked, ['massage', 'training']);
check('used 必須是 picked 的子集',
  normalizeCampActivities({ picked: ['massage'], used: ['massage', 'training'] }).used, ['massage']);
check('物件形式的項目也認（{ id }）',
  normalizeCampActivities({ picked: [{ id: 'cartography' }] }).picked, ['cartography']);
check('陣列形式的舊資料視為 picked',
  normalizeCampActivities(['cartography', 'daydream']), { picked: ['cartography', 'daydream'], used: [] });
/**
 * 正規化**不依上限截斷**：上限是規則，資料是玩家的選擇。
 * 規則改動不該默默刪掉他的東西——超出由驗證回報。
 */
check('正規化不截斷到上限（3 筆照留）',
  normalizeCampActivities({ picked: ['massage', 'training', 'daydream'] }).picked.length, 3);

// ─────────────────────────────────────────────────────────── E
section('E. 上限與金手指【老大哥／歐尼醬】（3 種，且團隊沒開也能用）');

const quirkDef = (rulesData.quirks || []).find((q) => q.name === '老大哥\\歐尼醬');
check('金手指資料存在', Boolean(quirkDef), true);
check('金手指有結構化欄位 campActivityCount', quirkDef?.campActivityCount, 3);
check('沒有金手指 → 上限 2', campActivityAllowance({ quirk: '無' }), 2);
check('金手指【老大哥／歐尼醬】→ 上限 3', campActivityAllowance({ quirk: '老大哥\\歐尼醬' }), 3);
check('其他金手指不改上限', campActivityAllowance({ quirk: '倖存者' }), 2);
check('quirkCampActivityCount 對空角色回 0', quirkCampActivityCount(undefined), 0);

check('規則關閉 + 無金手指 → 不可用', campActivityAccess({ quirk: '無' }, OFF_RULES).enabled, false);
check('規則開啟 → 可用', campActivityAccess({ quirk: '無' }, ON_RULES).enabled, true);
check('規則關閉 + 金手指 → 仍然可用（原書明文）',
  campActivityAccess({ quirk: '老大哥\\歐尼醬' }, OFF_RULES).enabled, true);
check('金手指給的會標記來源', campActivityAccess({ quirk: '老大哥\\歐尼醬' }, OFF_RULES).quirkGrant, true);
check('規則開啟時不標記金手指', campActivityAccess({ quirk: '無' }, ON_RULES).quirkGrant, false);
check('規則開啟 + 金手指 → 上限 3',
  campActivityAccess({ quirk: '老大哥\\歐尼醬' }, ON_RULES).allowance, 3);
check('不傳 rules 時讀角色自己的 creationRules',
  campActivityAccess({ quirk: '無', creationRules: { campActivities: true } }).enabled, true);
check('角色 creationRules 為壞資料 → 不可用',
  campActivityAccess({ quirk: '無', creationRules: { campActivities: 'true' } }).enabled, false);

// ─────────────────────────────────────────────────────────── F
section('F. 純函式：選取／已使用／休息回充');

const empty = createCampActivityState();
const one = toggleCampActivity(empty, 'massage', 2);
check('選第一個', one.picked, ['massage']);
const two = toggleCampActivity(one, 'training', 2);
check('選第二個', two.picked, ['massage', 'training']);
const full = toggleCampActivity(two, 'daydream', 2);
check('選滿後再選無效（上限 2）', full.picked, ['massage', 'training']);
check('上限 3 時可以選第三個',
  toggleCampActivity(two, 'daydream', 3).picked, ['massage', 'training', 'daydream']);
check('取消選取', toggleCampActivity(two, 'massage', 2).picked, ['training']);
check('取消選取同時清掉它的已使用標記',
  toggleCampActivity({ picked: ['massage'], used: ['massage'] }, 'massage', 2),
  { picked: [], used: [] });
check('未知 id 不會被選進', toggleCampActivity(empty, '不存在', 2).picked, []);
check('切換不變動傳入物件', empty.picked, []);

check('標記已使用', setCampActivityUsed(two, 'massage', true).used, ['massage']);
check('重複標記不會重複', setCampActivityUsed({ picked: ['massage'], used: ['massage'] }, 'massage', true).used,
  ['massage']);
check('取消已使用', setCampActivityUsed({ picked: ['massage'], used: ['massage'] }, 'massage', false).used, []);
check('沒選的活動不能標記', setCampActivityUsed(two, 'daydream', true).used, []);
check('休息回充清空 used',
  resetCampActivityUses({ picked: ['massage', 'training'], used: ['massage'] }),
  { picked: ['massage', 'training'], used: [] });

// ─────────────────────────────────────────────────────────── G
section('G. 建角驗證（第 5 步）');

check('未選滿 → 警告', campActivityIssues(empty, { allowance: 2 }).map((i) => i.type), ['warning']);
check('未選滿的訊息寫出已選／上限',
  campActivityIssues(one, { allowance: 2 })[0].message.includes('已選 1／2'), true);
check('選滿 → 沒有訊息', campActivityIssues(two, { allowance: 2 }), []);
check('超過上限 → 警告（不擋存檔）',
  campActivityIssues({ picked: ['massage', 'training', 'daydream'] }, { allowance: 2 }).map((i) => i.message),
  ['營地活動選了 3 種，超過上限 2 種']);
check('金手指上限 3 → 三筆選滿就沒有訊息',
  campActivityIssues({ picked: ['massage', 'training', 'daydream'] }, { allowance: 3 }), []);
check('警告的欄位名是 campActivities',
  campActivityIssues(empty, { allowance: 2 })[0].field, 'campActivities');

const campWarnings = (char, rules) => validateCharacter(char, rules)
  .warnings.filter((w) => w.field === 'campActivities');
const blank = (overrides = {}, rules = OFF_RULES) => ({
  ...createNewCharacter({}, rules),
  creationRules: rules,
  ...overrides
});

check('規則關閉 → 不產生營地活動警告', campWarnings(blank(), OFF_RULES), []);
check('規則開啟但沒選 → 產生警告', campWarnings(blank({}, ON_RULES), ON_RULES).length, 1);
check('規則開啟且選滿 → 沒有警告',
  campWarnings(blank({ campActivities: { picked: ['massage', 'training'], used: [] } }, ON_RULES), ON_RULES), []);
check('規則關閉時舊資料不會變成警告',
  campWarnings(blank({ campActivities: { picked: ['massage'], used: [] } }, OFF_RULES), OFF_RULES), []);
check('規則關閉但金手指給了 → 仍然驗證（金手指的明文例外）',
  campWarnings(blank({ quirk: '老大哥\\歐尼醬' }, OFF_RULES), OFF_RULES).length, 1);
check('金手指給的上限是 3 → 選 3 種就沒有警告',
  campWarnings(
    blank({ quirk: '老大哥\\歐尼醬', campActivities: { picked: ['massage', 'training', 'daydream'], used: [] } }, OFF_RULES),
    OFF_RULES
  ),
  []);
check('驗證訊息掛在第 5 步',
  campWarnings(blank({}, ON_RULES), ON_RULES)[0].step, 5);
check('驗證不會擋存檔（營地活動只出 warning，不進 errors）',
  validateCharacter(blank({}, ON_RULES), ON_RULES).errors.filter((w) => w.field === 'campActivities'), []);

// ─────────────────────────────────────────────────────────── H
section('H. 引擎整合：新角色的預設值');

const fresh = createNewCharacter();
check('新角色有 campActivities 欄位', Boolean(fresh.campActivities), true);
check('新角色營地活動為空狀態', fresh.campActivities, createCampActivityState());
check('新角色不預選活動', fresh.campActivities.picked, []);
check('履歷欄位有中文標籤', LOG_FIELD_LABELS.campActivities, '營地活動');

// ─────────────────────────────────────────────────────────── I
section('I. 介面：入口存在且有門禁');

const panelSrc = READ('src/features/character-sheet/components/CreationRulesPanel.jsx');
const editorSrc = READ('src/features/character-sheet/components/CharacterEditor.jsx');
const hudSrc = READ('src/features/character-sheet/components/CharacterPlayHUD.jsx');
const blockSrc = READ('src/features/character-sheet/components/CampActivitiesBlock.jsx');

check('開卡規則面板有這個開關', panelSrc.includes("'campActivities'"), true);
check('編輯器有匯入區塊元件', editorSrc.includes("from './CampActivitiesBlock'"), true);
/**
 * 門禁必須是 `campAccess.enabled`（規則**或**金手指），不是 `rules.campActivities`——
 * 後者會讓【老大哥／歐尼醬】的明文例外失效。
 */
check('編輯器的門禁用 campAccess.enabled', /\{campAccess\.enabled && \(\s*<CampActivitiesBlock/.test(editorSrc), true);
check('編輯器不是只看開關', /\{rules\.campActivities && \(\s*<CampActivitiesBlock/.test(editorSrc), false);
check('編輯器把上限與金手指來源傳進去',
  [editorSrc.includes('allowance={campAccess.allowance}'), editorSrc.includes('quirkGrant={campAccess.quirkGrant}')],
  [true, true]);
check('跑團面板有 play 區塊', /mode="play"/.test(hudSrc), true);
check('跑團面板的門禁同樣用 campAccess.enabled',
  /\{campAccess\.enabled && \(\s*<CampActivitiesBlock/.test(hudSrc), true);
check('跑團面板把它放在羈絆分頁（休息場景）',
  hudSrc.indexOf("{activeTab === 'bonds'") < hudSrc.indexOf('<CampActivitiesBlock'), true);

// 建角模式：15 張卡、計數、選中後展開全文
const editHtml = renderToStaticMarkup(
  React.createElement(CampActivitiesBlock, {
    character: { campActivities: { picked: ['massage'], used: [] } },
    theme,
    mode: 'edit',
    allowance: 2,
    onChange: () => {}
  })
);
const editText = plain(editHtml);
check('建角模式渲染出來', editHtml.includes('data-testid="camp-activities-block"'), true);
check('建角模式列出全部 15 種',
  CAMP_ACTIVITIES.every((a) => editText.includes(a.name)), true);
check('建角模式顯示已選數', editText.includes('已選 1／2 種'), true);
check('建角模式顯示出處', editText.includes(CAMP_ACTIVITY_SOURCE), true);
check('建角模式展開已選活動的全文', editText.includes('將該次 MP 成本減半'), true);
check('建角模式對未選的活動不展開全文', editText.includes('將該次恢復的 HP 加倍'), false);

const quirkHtml = renderToStaticMarkup(
  React.createElement(CampActivitiesBlock, {
    character: { campActivities: createCampActivityState() },
    theme,
    mode: 'edit',
    allowance: 3,
    quirkGrant: true,
    onChange: () => {}
  })
);
const quirkText = plain(quirkHtml);
check('金手指開啟時上限顯示 3', quirkText.includes('已選 0／3 種'), true);
check('金手指開啟時說明來源', quirkText.includes('老大哥'), true);

// 跑團模式：標記使用、休息回充、未選提示
const playHtml = renderToStaticMarkup(
  React.createElement(CampActivitiesBlock, {
    character: { campActivities: { picked: ['massage', 'exploration', 'training'], used: ['massage'] } },
    theme,
    mode: 'play',
    allowance: 3,
    onChange: () => {}
  })
);
const playText = plain(playHtml);
check('跑團模式渲染出來', playHtml.includes('data-testid="camp-activities-play"'), true);
check('跑團模式顯示已使用狀態', playText.includes('本次休息已使用'), true);
check('跑團模式提供標記使用', playText.includes('標記使用'), true);
check('跑團模式提供休息回充', playText.includes('下一次休息（清空已使用）'), true);
check('跑團模式列出已選的活動全文', playText.includes('將該次 MP 成本減半'), true);
check('跑團模式不列未選的活動全文', playText.includes('簡單衝突'), false);
check('跑團模式帶 1d6 表格', playText.includes('中大獎'), true);

const playEmpty = plain(renderToStaticMarkup(
  React.createElement(CampActivitiesBlock, {
    character: { campActivities: createCampActivityState() },
    theme,
    mode: 'play',
    allowance: 2,
    onChange: () => {}
  })
));
check('跑團模式未選時提示去第 5 步選', playEmpty.includes('請在角色編輯第 5 步選 2 種'), true);

// ─────────────────────────────────────────────────────────── J
section('J. 紙卡匯出：選了哪幾種要看得到');

const modelOn = buildSheetModel({
  ...createNewCharacter(),
  creationRules: { campActivities: true },
  campActivities: { picked: ['massage', 'training'], used: [] }
});
check('匯出模型帶營地活動', modelOn.campActivities.map((a) => a.name), ['按摩', '自行訓練']);
check('匯出模型帶目標', modelOn.campActivities.map((a) => a.target), ['一個盟友', '自身']);

const modelOff = buildSheetModel({
  ...createNewCharacter(),
  campActivities: { picked: ['massage'], used: [] }
});
check('規則關閉時匯出模型不帶（舊角色不受影響）', modelOff.campActivities, []);

const modelQuirk = buildSheetModel({
  ...createNewCharacter(),
  quirk: '老大哥\\歐尼醬',
  campActivities: { picked: ['massage'], used: [] }
});
check('金手指給了就照樣匯出', modelQuirk.campActivities.map((a) => a.name), ['按摩']);

// ─────────────────────────────────────────────────────────── K
section('K. 原始碼衛生：判定不靠名稱硬編碼、不直接讀 localStorage');

check('上限判定讀結構化欄位 campActivityCount', blockSrc.includes('campActivityCount') ||
  READ('src/features/character-sheet/data/campActivities.js').includes('campActivityCount'), true);
check('區塊不直接碰 localStorage', blockSrc.includes('localStorage'), false);
check('資料層不直接碰 localStorage',
  READ('src/features/character-sheet/data/campActivities.js').includes('localStorage'), false);

// ─────────────────────────────────────────────────────────── 結果
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
if (fail > 0) lines.push(`\n失敗 ${fail} 項`);
console.log(lines.join('\n'));
process.exit(fail > 0 ? 1 : 0);
