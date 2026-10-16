/**
 * 植物學家【植生術】：花園／生長命刻的「哪一階生效」，以及建角預覽。
 *
 * 執行：npm run test:florist
 *
 * 這道關卡守三件事：
 *  A. **解析**：官方 43 列種子效果的標籤有 5 種寫法（`0~1`／`2~3`／`1~3`／`1`／
 *     `滿 4 格離園時`），`getSeedClockRange()` 必須**全部**解析得出來，且落在 0~4 內。
 *  B. **回歸**：`生長命刻 1~3 格`（熾焰菊／月光玉蘭／蒲公英之舞）與
 *     `生長命刻 1~2 格`（朝聖者羚羊花）在 **T = 1** 必須生效。
 *     舊版 `FloristGardenTracker` 用 `clock.includes('3 格')` 之類的字串猜階級，
 *     把這兩類誤判成 2~3 格 → T = 1 那一列不亮，玩家會以為該格數沒有效果。
 *  C. **接線**：建角（`ClassSkillCard`）真的渲染得出花園預覽；跑團盤
 *     （`FloristGardenTracker`）不得再自己比對字串。
 *
 * ※ 「哪一階生效」一律走資料層的 `isSeedEffectActiveAt()`。
 *   SSR 不跑 onClick，所以預覽盤吃一個 `initialClock` 測試注入點
 *   （**不傳時＝0，正式行為完全不變**）。
 */
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  FLORIST_MAGISEEDS,
  GROWTH_CLOCK_MAX,
  getSeedClockRange,
  isSeedEffectActiveAt
} from '../src/features/character-sheet/data/skillSuboptionsData.js';
import FloristGardenPreview from '../src/features/character-sheet/components/companions/FloristGardenPreview.jsx';
import ClassSkillCard from '../src/features/character-sheet/components/ClassSkillCard.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
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

const seed = (name) => FLORIST_MAGISEEDS.find((s) => s.name === name);
/** 該種子在指定格數下「生效中」的那些列（＝畫面上會亮起來的） */
const activeLabelsAt = (seedName, clock) =>
  (seed(seedName).effects || [])
    .filter((ef) => isSeedEffectActiveAt(ef.clock, clock))
    .map((ef) => ef.clock);

// ─────────────────────────────────────────────────────────── A
section('A. 解析：43 列標籤全部要解析得出命刻區間，且落在 0~4');
const ALL_EFFECTS = FLORIST_MAGISEEDS.flatMap((s) =>
  (s.effects || []).map((ef) => ({ seed: s.name, clock: ef.clock }))
);
check('魔法種子共 20 顆', FLORIST_MAGISEEDS.length, 20);
check('效果列共 43 列（與規則速查的表格列數一致）', ALL_EFFECTS.length, 43);
check('每一列都解析得出區間（有值＝解析失敗）',
  ALL_EFFECTS.filter((e) => getSeedClockRange(e.clock) === null)
    .map((e) => `${e.seed} → ${e.clock}`),
  []);
check('所有區間都落在 0~4 之內（官方生長命刻 4 格）',
  ALL_EFFECTS.filter((e) => {
    const r = getSeedClockRange(e.clock);
    return !r || r.min < 0 || r.max > GROWTH_CLOCK_MAX;
  }).map((e) => `${e.seed} → ${e.clock}`),
  []);
check('區間不得顛倒（min ≤ max）',
  ALL_EFFECTS.filter((e) => {
    const r = getSeedClockRange(e.clock);
    return r && r.min > r.max;
  }).map((e) => `${e.seed} → ${e.clock}`),
  []);
check('生長命刻總格數是 4', GROWTH_CLOCK_MAX, 4);

// 五種實際寫法逐一點名（改資料若動到這些格式，這裡會先叫）
check('寫法 1：區間 0~1', getSeedClockRange('第 1 回合（生長命刻 0~1 格）'), { min: 0, max: 1 });
check('寫法 2：區間 2~3', getSeedClockRange('第 2~3 回合（生長命刻 2~3 格）'), { min: 2, max: 3 });
check('寫法 3：區間 1~3（前段「第 1~3 回合」不得被誤抓）',
  getSeedClockRange('第 1~3 回合（生長命刻 1~3 格）'), { min: 1, max: 3 });
check('寫法 4：單一值 3', getSeedClockRange('第 3 回合結束（生長命刻 3 格）'), { min: 3, max: 3 });
check('寫法 5：不帶「生長命刻」四字的離園列',
  getSeedClockRange('滿 4 格離園時（第 4 回合結束或主動離園）'), { min: 4, max: 4 });
check('解析不出來時回 null（不得靜默回 0~0）', getSeedClockRange('無法辨識的標籤'), null);
check('空值回 null', getSeedClockRange(undefined), null);

// ─────────────────────────────────────────────────────────── B
section('B. 回歸：舊版把「1~3」「1~2」誤判成 2~3 格 → T=1 不亮');
// 這 4 列是實際受害的資料。舊演算法（includes('0~1') / includes('3 格')）對它們
// 一律判成 tier2，所以 clock=1 時 isActive 為 false。
check('熾焰菊：T=1 生效（單列 1~3）', activeLabelsAt('熾焰菊', 1).length, 1);
check('月光玉蘭：T=1 生效（單列 1~3）', activeLabelsAt('月光玉蘭', 1).length, 1);
check('蒲公英之舞：T=1 生效（單列 1~3）', activeLabelsAt('蒲公英之舞', 1).length, 1);
check('朝聖者羚羊花：T=1 生效（首列 1~2）',
  activeLabelsAt('朝聖者羚羊花', 1), ['第 1~2 回合結束（生長命刻 1~2 格）']);
check('熾焰菊：T=0 不生效（1~3 不含 0）', activeLabelsAt('熾焰菊', 0).length, 0);
check('熾焰菊：T=4 不生效（1~3 不含 4）', activeLabelsAt('熾焰菊', 4).length, 0);

// 對照組：常見的兩列型種子，逐格驗「只套用完全相同的那一階」
check('極地水仙：T=0 → 首列', activeLabelsAt('極地水仙', 0), ['第 1 回合（生長命刻 0~1 格）']);
check('極地水仙：T=1 → 首列', activeLabelsAt('極地水仙', 1), ['第 1 回合（生長命刻 0~1 格）']);
check('極地水仙：T=2 → 次列', activeLabelsAt('極地水仙', 2), ['第 2~3 回合（生長命刻 2~3 格）']);
check('極地水仙：T=3 → 次列', activeLabelsAt('極地水仙', 3), ['第 2~3 回合（生長命刻 2~3 格）']);
check('極地水仙：T=4 → 兩列都不亮（種子已離園）', activeLabelsAt('極地水仙', 4), []);

// 三列型：每一格剛好亮一列
check('海洋蓮花：逐格各亮一列',
  [0, 1, 2, 3, 4].map((t) => activeLabelsAt('海洋蓮花', t).length), [1, 1, 1, 1, 0]);
// 離園型：只有 T=4 生效
check('憤怒康乃馨：只有 T=4 生效',
  [0, 1, 2, 3, 4].map((t) => activeLabelsAt('憤怒康乃馨', t).length), [0, 0, 0, 0, 1]);

// ─────────────────────────────────────────────────────────── C
section('C. 建角預覽（SSR）：撥到哪一格，就顯示那一格生效的效果');
const previewAt = (clock, seeds = ['熾焰菊', '極地水仙']) => renderToStaticMarkup(
  React.createElement(FloristGardenPreview, {
    selectedOptions: seeds,
    skillName: '植生術',
    // 測試注入點：SSR 不跑 onClick，靠它渲染到指定格數。
    initialClock: clock
  })
);

const p1 = previewAt(1);
check('T=1 時熾焰菊的列出現（就是舊版不會亮的那些）',
  p1.includes('自身與全隊傷害轉化為該屬性'), true);
check('T=1 時顯示的是「1~3」那一列', p1.includes('生長命刻 1~3 格'), true);
// 極地水仙的 0~1 列在 T=1 也該亮。注意 `renderTextWithAffinities` 會把「土屬性」
// 「冰屬性傷害」整段包進圖示 span，句子會被切開，所以只驗不會被切到的尾段。
check('T=1 時極地水仙的列也在（0~1 含 1）', p1.includes('生長命刻 0~1 格'), true);
check('T=1 時極地水仙的效果文字渲染出來', p1.includes('具有抗性'), true);

const p0 = previewAt(0);
check('T=0 時熾焰菊顯示「此格數沒有對應效果」',
  p0.includes('此格數沒有對應效果'), true);
check('T=0 時熾焰菊的傷害轉化文字不出現',
  p0.includes('自身與全隊傷害轉化為該屬性'), false);

check('畫面上有花園鐵則（同時只容納 1 顆）', p1.includes('同時只容納'), true);
check('畫面上有「只套用完全相同」的提醒', p1.includes('完全相同'), true);
check('撥盤提示跟著當前格數（T=1）', p1.includes('只套用與 1 格'), true);
check('撥盤提示跟著當前格數（T=3）', previewAt(3).includes('只套用與 3 格'), true);
check('有規則速查入口（查得到才會渲染）', p1.includes('規則速查：花園與魔法種子'), true);
check('未配置種子時給提示，不給空清單',
  previewAt(0, []).includes('尚未配置魔法種子'), true);

// ─────────────────────────────────────────────────────────── D
section('D. 接線：職業技能卡真的掛上預覽，且只在【植生術】掛');
const theme = getCharacterTheme('emerald');
const NEUTRAL = { mainHand: '無武器', offHand: '無盾牌', armor: '無防具', accessory: '' };
const mkChar = (books) => {
  const c = createNewCharacter({ equipment: NEUTRAL, startingFundsRolled: 0 });
  c.enabledSourcebooks = books;
  return c;
};
const mkClassItem = (className, skills = []) => ({
  className, skills, level: skills.reduce((s, k) => s + k.sl, 0)
});
const renderCard = (className, skills) => renderToStaticMarkup(
  React.createElement(ClassSkillCard, {
    classItem: mkClassItem(className, skills),
    classIndex: 0,
    character: mkChar(['core']),
    theme
  })
);

const floralistCard = renderCard('植物學家', [
  { name: '植生術', sl: 3, selectedOptions: ['熾焰菊'] }
]);
check('植物學家【植生術】：建角看得到花園預覽',
  floralistCard.includes('florist-garden-preview'), true);
check('植物學家【植生術】：預覽裡帶出已挑選的種子',
  floralistCard.includes('熾焰菊'), true);

const floralistOtherSkill = renderCard('植物學家', [
  { name: '戰地園藝', sl: 1, selectedOptions: [] }
]);
check('同職業但非【植生術】：不掛預覽',
  floralistOtherSkill.includes('florist-garden-preview'), false);

// 其他職業（用該職業真實存在的第一個技能名，避免靠「技能不存在」而恆真）
const OTHER_CLASS = '武器大師';
const OTHER_SKILL = rulesData.classes[OTHER_CLASS].skills[0].name;
const otherCard = renderCard(OTHER_CLASS, [{ name: OTHER_SKILL, sl: 1, selectedOptions: [] }]);
check(`其他職業（${OTHER_CLASS}／${OTHER_SKILL}）：不掛預覽`,
  otherCard.includes('florist-garden-preview'), false);
check('反向確認上面那張卡確實渲染了（否則斷言恆真）',
  otherCard.includes(OTHER_SKILL), true);

// ─────────────────────────────────────────────────────────── E
section('E. 原始碼護欄：階級判斷只有一個來源');
const trackerSrc = readFileSync(
  new URL('../src/features/character-sheet/components/companions/FloristGardenTracker.jsx', import.meta.url),
  'utf8');
const previewSrc = readFileSync(
  new URL('../src/features/character-sheet/components/companions/FloristGardenPreview.jsx', import.meta.url),
  'utf8');

check('跑團盤：已改用純函式', trackerSrc.includes('isSeedEffectActiveAt'), true);
check('跑團盤：不得再用字串猜階級（`ef.clock.includes(` 必須絕跡）',
  /\.clock\s*\.includes\(/.test(trackerSrc), false);
check('跑團盤：舊的 isTier1/2/3 三分桶已移除',
  /isTier[123]/.test(trackerSrc), false);
check('建角預覽：也走同一支純函式', previewSrc.includes('isSeedEffectActiveAt'), true);
check('建角預覽：不得自己比對 clock 字串',
  /\.clock\s*\.includes\(/.test(previewSrc), false);

// 跑團卡不得再有第二套生長命刻（純量 growthClock）——一個計數器只能有一個控制項
const playHudSrc = readFileSync(
  new URL('../src/features/character-sheet/components/CharacterPlayHUD.jsx', import.meta.url),
  'utf8');
check('跑團卡：不再讀寫 growthClock 純量',
  /updateField\(\s*'growthClock'/.test(playHudSrc), false);

// 速查頁的欄位名要跟資料層同一個詞（不得再寫 T）
const codexSrc = readFileSync(
  new URL('../src/features/character-sheet/data/ruleCodexExpansion.js', import.meta.url),
  'utf8');
check('速查頁欄位名已統一為「生長命刻」（不得再出現孤立的 T 欄）',
  codexSrc.includes("columns: ['魔法種子', '生長命刻', '效果']"), true);

// ─────────────────────────────────────────────────────────── 收尾
console.log(lines.join('\n'));
console.log(`\n通過 ${pass}，失敗 ${fail}`);
if (fail > 0) process.exit(1);
