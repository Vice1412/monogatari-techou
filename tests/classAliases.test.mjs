/**
 * 職業別稱測試（官方原書職業頁的「ALSO:」行）。
 *
 * 執行：npm run test:aliases
 *
 * 這道關卡守三件事：
 *  1. **覆蓋率**：`SOURCEBOOKS` 的每個職業都要有別稱，且別稱表不得出現孤兒鍵
 *     （兩張表分開維護，所以「雙向」才擋得住漂移）。
 *  2. **與官方原書一致**：28 個職業的英文別稱與出處頁碼**逐條釘死在本檔**。
 *     改了資料卻沒改這裡 = 測試會叫；改了這裡而沒核對原書 = 留下一份可回溯的 diff。
 *  3. **顯示與檢索分流**：`zh` 才顯示，`zhExtra`（測試版漢化獨有詞）只作檢索。
 *
 * 另外用 SSR 煙霧確認「又稱」真的出現在畫面上，且 `zhExtra` 沒有漏出來。
 *
 * ※ 抽不到官方 PDF 的環境（本專案的 shell 對 PDF 有安全規則）：
 *   英文別稱取自 `scratch/core_full.txt`、`scratch/atlas_high|natural|techno.txt`、
 *   `scratch/bonus.txt` 的完整抽取（頁數與 `AGENTS.md` §1.1 記載的原書頁數一致），
 *   中文取自 `scratch/_zh_classes_pdf.txt`／`chinese_core_skills.txt`／`_zh_wayfarer_pdf.txt`
 *   與 `resources/角色卡/` 各手冊目錄下 `CHM_Playtest_中文翻译/` 的 `.md`。
 */
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CLASS_ALIASES,
  getClassAliases,
  formatClassAliases,
  classAliasSource,
  classSearchTokens,
  matchesClassQuery
} from '../src/features/character-sheet/data/classAliases.js';
import { SOURCEBOOKS, getClassInfo } from '../src/features/character-sheet/data/sourcebookConfig.js';
import ClassPickerModal from '../src/features/character-sheet/components/ClassPickerModal.jsx';
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

const SUFFIX_RE = /【[^】]*】\s*$/;
const baseOf = (name) => String(name).replace(SUFFIX_RE, '').trim();

/** 全部可選職業（含公測變體），形狀與 `ClassPickerModal` 傳給搜尋的一模一樣 */
const ITEMS = Object.keys(SOURCEBOOKS).flatMap((sbKey) => {
  const book = SOURCEBOOKS[sbKey];
  return (book.classes || []).map((className) => ({
    className,
    bookKey: sbKey,
    bookName: book.shortName || book.name,
    info: getClassInfo(className)
  }));
});

/** 命中查詢的職業（以「主名」去重，公測變體不重複計） */
const findBase = (query) =>
  [...new Set(ITEMS.filter((item) => matchesClassQuery(item, query)).map((i) => baseOf(i.className)))];

// ─────────────────────────────────────────────────────────── A
section('A. 官方原書「ALSO:」逐條（英文 ＋ 出處頁碼，釘死）');
/**
 * [職業名, 出處（印刷頁碼）, 官方英文別稱]
 * 來源：核心規則書／三本手冊／官方特典合輯的職業頁標題下方 `ALSO:` 行。
 */
const OFFICIAL = [
  ['秘儀師', '核心規則書 p.176', ['Avatar', 'Chosen', 'Summoner']],
  ['嵌合師', '核心規則書 p.182', ['Druid', 'Shapeshifter', 'Wild Mage']],
  ['暗黑之刃', '核心規則書 p.184', ['Avenger', 'Black Knight', 'Death Knight']],
  ['元素師', '核心規則書 p.186', ['Battle Mage', 'Geomancer', 'Sorcerer']],
  ['熵師', '核心規則書 p.190', ['Astromancer', 'Chaos Mage', 'Gambler']],
  ['狂怒鬥士', '核心規則書 p.194', ['Berserker', 'Brawler', 'Viking']],
  ['守護者', '核心規則書 p.196', ['Paladin', 'Soldier', 'Yōjinbō']],
  ['博學士', '核心規則書 p.198', ['Archivist', 'Sage', 'Scholar']],
  ['吟唱者', '核心規則書 p.200', ['Ambassador', 'Diplomat', 'Entertainer']],
  ['遊蕩者', '核心規則書 p.202', ['Bandit', 'Ninja', 'Thief']],
  ['神射手', '核心規則書 p.204', ['Archer', 'Gunslinger', 'Sniper']],
  ['靈師', '核心規則書 p.206', ['Healer', 'Priest', 'Witch']],
  ['修補匠', '核心規則書 p.210', ['Alchemist', 'Magitech Engineer', 'Mechanic']],
  ['旅人', '核心規則書 p.216', ['Adventurer', 'Explorer', 'Treasure Hunter']],
  ['武器大師', '核心規則書 p.218', ['Fighter', 'Rōnin', 'Warrior']],
  ['魔奏者', '高度奇幻手冊 p.136', ['Bard', 'Idol', 'Troubadour']],
  ['指揮官', '高度奇幻手冊 p.140', ['Prince', 'Queen', 'Shōgun']],
  ['舞者', '高度奇幻手冊 p.142', ['Acrobat', 'Jester', 'Swashbuckler']],
  ['徽記師', '高度奇幻手冊 p.146', ['Calligrapher', 'Painter', 'Runemaker']],
  ['植物學家', '自然奇幻手冊 p.138', ['Bloomblade', 'Gardener', 'Herbalist']],
  ['美食家', '自然奇幻手冊 p.148', ['Brewer', 'Chef', 'Patissier']],
  ['祈喚者', '自然奇幻手冊 p.154', ['Ascetic', 'Channeler', 'Five-Soul Master']],
  ['商人', '自然奇幻手冊 p.158', ['Antiquarian', 'Collector', 'Pharmacist']],
  ['靈能者', '科技奇幻手冊 p.150', ['Empath', 'Psion', 'Soul Hacker']],
  ['突變體', '科技奇幻手冊 p.154', ['Abomination', 'Experiment', 'Lycanthrope']],
  ['機師', '科技奇幻手冊 p.158', ['Biker', 'Mecha Pilot', 'Sky Pirate']],
  ['卡牌大師', '官方特典合輯 p.6', ['Deckmancer', 'Destiny Duelist', 'High Roller']],
  ['死靈術士', '官方特典合輯 p.12', ['Grave Queen', 'Reanimator', 'Vampire']]
];

check('官方表共 28 職', OFFICIAL.length, 28);
check('英文別稱逐條相符',
  OFFICIAL.map(([name]) => getClassAliases(name)?.en), OFFICIAL.map(([, , en]) => en));
check('出處頁碼逐條相符',
  OFFICIAL.map(([name]) => getClassAliases(name)?.src), OFFICIAL.map(([, src]) => src));
check('每職恰好 3 個官方英文別稱', OFFICIAL.map(([, , en]) => en.length), Array(28).fill(3));

// ─────────────────────────────────────────────────────────── B
section('B. 覆蓋率：SOURCEBOOKS ↔ CLASS_ALIASES 雙向');
const ALL_CLASS_NAMES = ITEMS.map((i) => i.className);
const ALL_BASE_NAMES = [...new Set(ALL_CLASS_NAMES.map(baseOf))];

check('可選職業（含公測變體）共 29', ALL_CLASS_NAMES.length, 29);
check('主名共 28（15 核心 ＋ 4 高 ＋ 4 自 ＋ 3 科 ＋ 2 特典）', ALL_BASE_NAMES.length, 28);
check('每個主名都有別稱（無缺漏）',
  ALL_BASE_NAMES.filter((n) => !getClassAliases(n)), []);
check('別稱表沒有孤兒鍵（每筆都對得上真實職業）',
  Object.keys(CLASS_ALIASES).filter((n) => !ALL_BASE_NAMES.includes(n)), []);
check('公測變體沿用主名的別稱',
  getClassAliases('秘儀師【變體】')?.en, getClassAliases('秘儀師')?.en);
check('別稱表的鍵數 = 28', Object.keys(CLASS_ALIASES).length, 28);

// ─────────────────────────────────────────────────────────── C
section('C. 中文別稱：結構、格式與「寧缺勿造」');
check('每職 zh 恰好 3 個（與官方 en 一一對應）',
  Object.entries(CLASS_ALIASES).filter(([, a]) => (a.zh || []).length !== 3).map(([n]) => n), []);
check('每職 zh 長度 = en 長度（逐詞對齊，順序不可錯位）',
  Object.entries(CLASS_ALIASES).filter(([, a]) => (a.zh || []).length !== (a.en || []).length).map(([n]) => n), []);
check('每職 zh 都是非空字串',
  Object.entries(CLASS_ALIASES).flatMap(([n, a]) => (a.zh || []).filter((z) => !z || !z.trim()).map(() => n)), []);
check('同一職業內 zh 不得重複',
  Object.entries(CLASS_ALIASES).filter(([, a]) => new Set(a.zh || []).size !== (a.zh || []).length)
    .map(([n]) => n), []);
check('同一職業內 zhExtra 不得與 zh 重複',
  Object.entries(CLASS_ALIASES)
    .filter(([, a]) => (a.zhExtra || []).some((x) => (a.zh || []).includes(x)))
    .map(([n]) => n), []);
check('別稱不得就是該職業自己的名字',
  Object.entries(CLASS_ALIASES)
    .filter(([name, a]) => [...(a.zh || []), ...(a.zhExtra || [])].some((x) => x === name))
    .map(([n]) => n), []);
// 純中文顯示鐵律：別稱是顯示文本，不得夾帶英文／數字／標點。
check('所有中文別稱皆為純漢字',
  Object.values(CLASS_ALIASES)
    .flatMap((a) => [...(a.zh || []), ...(a.zhExtra || [])])
    .filter((x) => !/^[\u3400-\u9FFF]+$/.test(x)), []);
// 「職業」定譯鐵律：Martial 系列一律譯「職業」，嚴禁「軍用」。
check('別稱不得出現「軍用」（職業定譯鐵律）',
  Object.values(CLASS_ALIASES)
    .flatMap((a) => [...(a.zh || []), ...(a.zhExtra || [])])
    .filter((x) => x.includes('軍用')), []);
// GM 裁定（2026-10-16）：別稱屬**敘事層**，允許語義補譯，不受「寧缺勿造」約束。
// 但代價是**必須逐筆登記在 `zhDerived`**——沒有這個欄位，半年後沒人分得出
// 哪個中文是漢化原有的、哪個是本專案自己寫的。
const DERIVED_ALLOWED = ['Bloomblade', 'Ascetic', 'Antiquarian', 'Pharmacist', 'Experiment'];
const derived = Object.entries(CLASS_ALIASES).flatMap(([name, a]) =>
  (a.zhDerived || []).map((word) => [name, word]));
check('語義補譯共 5 筆，且正好是那 5 個正式版獨有詞',
  derived.map(([, w]) => w).sort(), [...DERIVED_ALLOWED].sort());
check('zhDerived 必須是該職業 `en` 裡的詞（不得記錯職業）',
  derived.filter(([name, w]) => !(CLASS_ALIASES[name].en || []).includes(w)), []);
check('zhDerived 登記數不得超過該職業 zh 的詞數',
  Object.entries(CLASS_ALIASES).filter(([, a]) => (a.zhDerived || []).length > (a.zh || []).length)
    .map(([n]) => n), []);
check('補譯的職業 zh 全滿（3 個），缺口已補齊',
  Object.entries(CLASS_ALIASES)
    .filter(([n, a]) => DERIVED_ALLOWED.some((w) => (a.en || []).includes(w)) && (a.zh || []).length !== 3)
    .map(([n]) => n), []);

// ─────────────────────────────────────────────────────────── D
section('D. 顯示與檢索分流（zhExtra 只搜不顯示）');
check('遊蕩者顯示別稱', formatClassAliases('遊蕩者'), '強盜、忍者、盜賊');
check('植物學家顯示三個（含補譯的 Bloomblade）', formatClassAliases('植物學家'), '花刃、園丁、藥師');
check('祈喚者顯示三個（含補譯的 Ascetic）', formatClassAliases('祈喚者'), '苦行者、通靈師、五行宗師');
check('商人顯示三個（含補譯的 Antiquarian／Pharmacist）', formatClassAliases('商人'), '古董商、收藏家、藥劑師');
check('突變體顯示三個（含補譯的 Experiment）', formatClassAliases('突變體'), '憎惡、實驗體、獸化人');
check('公測變體沿用主名的顯示字串',
  formatClassAliases('秘儀師【變體】'), formatClassAliases('秘儀師'));
check('查無職業回傳 null', [formatClassAliases('不存在'), formatClassAliases(''), formatClassAliases(null)],
  [null, null, null]);
check('出處：植物學家', classAliasSource('植物學家'), '自然奇幻手冊 p.138');
check('出處：查無職業回傳 null', classAliasSource('不存在'), null);

// ─────────────────────────────────────────────────────────── E
section('E. 搜尋純函式（matchesClassQuery）');
check('空查詢＝不過濾', findBase('').length, 28);
check('中文名：盜賊 → 遊蕩者', findBase('盜賊'), ['遊蕩者']);
check('英文名：Thief → 遊蕩者', findBase('Thief'), ['遊蕩者']);
check('大小寫不敏感：THIEF → 遊蕩者', findBase('THIEF'), ['遊蕩者']);
check('大小寫不敏感：arcanist → 秘儀師', findBase('ARCANIST'), ['秘儀師']);
check('別稱：忍者 → 遊蕩者', findBase('忍者'), ['遊蕩者']);
check('別稱：狙擊手 → 神射手', findBase('狙擊手'), ['神射手']);
check('別稱：用心棒 → 守護者（帶長音符的日文借詞）', findBase('用心棒'), ['守護者']);
check('別稱：Rōnin → 武器大師（長音符 o 不得被吃掉）', findBase('Rōnin'), ['武器大師']);
check('別稱：牌靈師 → 卡牌大師', findBase('牌靈師'), ['卡牌大師']);
check('別稱：墳墓女王 → 死靈術士', findBase('墳墓女王'), ['死靈術士']);
check('別稱：天空海盜 → 機師', findBase('天空海盜'), ['機師']);
check('別稱：Mecha Pilot → 機師', findBase('Mecha Pilot'), ['機師']);
// 子字串比對的必然結果：`Mechanic`（修補匠）也含 `mecha`。這是正確行為，不是 bug。
check('子字串撞名：mecha → 修補匠（Mechanic）＋ 機師（Mecha Pilot）',
  findBase('mecha').sort(), ['修補匠', '機師'].sort());
check('zhExtra 仍可檢索：陰陽師 → 祈喚者', findBase('陰陽師'), ['祈喚者']);
check('zhExtra 仍可檢索：森林女巫 → 植物學家', findBase('森林女巫'), ['植物學家']);
check('zhExtra 仍可檢索：賽博人 → 突變體', findBase('賽博人'), ['突變體']);
// 漢化本身的撞名：搜「鬥士」本來就該同時命中兩職（不要「修」掉）。
check('撞名別稱：鬥士 → 狂怒鬥士 ＋ 武器大師', findBase('鬥士').sort(), ['狂怒鬥士', '武器大師'].sort());
check('風格速覽仍可搜（原有行為不得退化）', findBase('白魔法師'), ['靈師']);
check('手冊名仍可搜：核心 → 15 職', findBase('核心').length, 15);
check('手冊名仍可搜：高度奇幻 → 4 職', findBase('高度奇幻').length, 4);
check('手冊名仍可搜：特典合輯 → 2 職', findBase('特典合輯').length, 2);
check('查無結果回傳空陣列', findBase('這個職業不存在'), []);
// 寧缺勿造：官方沒寫的詞不得因為「聽起來很像」就被加進去。
check('未收錄的通俗詞不會命中（小偷）', findBase('小偷'), []);
check('未收錄的通俗詞不會命中（扒手）', findBase('扒手'), []);
check('前後空白會被修剪', findBase('  忍者  '), ['遊蕩者']);
check('別稱確實在檢索詞彙集裡（詞彙集為小寫）',
  classSearchTokens({ className: '遊蕩者', info: getClassInfo('遊蕩者'), bookName: '核心' })
    .includes('thief'), true);

// ─────────────────────────────────────────────────────────── F
section('F. 渲染煙霧（SSR）：又稱出現在畫面上，且 zhExtra 不外洩');
const theme = getCharacterTheme('emerald');
const renderPicker = (enabledBooks, initialClassName) => renderToStaticMarkup(
  React.createElement(ClassPickerModal, {
    isOpen: true,
    onClose: () => {},
    theme,
    enabledBooks,
    existingClassNames: [],
    onSelectClasses: () => {},
    // 測試注入點：`JRPGModal` 是 portal ＋ effect，SSR 一定渲染成 null，所以繞過外框。
    panelOnly: true,
    // 測試注入點：SSR 不跑 useEffect，詳情區塊要靠它才渲染得出來。
    ...(initialClassName ? { initialClassName } : {})
  })
);

const ALL_BOOKS = ['core', 'highFantasy', 'naturalFantasy', 'technoFantasy', 'bonus'];
// 名冊上「會顯示又稱」的職業數。公測變體沿用主名的別稱，所以以**主名**去重再算。
const aliasedInCore = [...new Set(ITEMS.map((i) => baseOf(i.className)))]
  .filter((n) => SOURCEBOOKS.core.classes.includes(n) && formatClassAliases(n)).length;
const aliasedInAll = [...new Set(ITEMS.map((i) => baseOf(i.className)))]
  .filter((n) => formatClassAliases(n)).length;
check('會顯示又稱的職業數：核心 15／全部 28', [aliasedInCore, aliasedInAll], [15, 28]);

// 名冊（左欄）：不傳注入點時詳情是空狀態，所以「又稱」只來自名冊。
const htmlCore = renderPicker(['core']);
check('核心名冊：又稱出現次數 = 15 職', (htmlCore.match(/又稱/g) || []).length, aliasedInCore);
check('搜尋框提示已含「別稱」', htmlCore.includes('別稱'), true);
check('名冊項目把出處放在 title（可回溯）', htmlCore.includes('title="核心規則書 p.202"'), true);

// 詳情（右欄）：靠注入點渲染到指定職業。
const htmlDetail = renderPicker(['core'], '遊蕩者');
check('詳情標頭：又稱 ＋ 出處',
  [htmlDetail.includes('強盜、忍者、盜賊'), htmlDetail.includes('核心規則書 p.202')],
  [true, true]);
check('詳情標頭：又稱出現次數 = 名冊 15 ＋ 詳情 1',
  (htmlDetail.match(/又稱/g) || []).length, aliasedInCore + 1);

// 全開 ＋ 停在植物學家：檢驗 zhExtra 不外洩。
const htmlAll = renderPicker(ALL_BOOKS, '植物學家');
check('全開名冊：又稱出現次數 = 28 職 ＋ 詳情 1',
  (htmlAll.match(/又稱/g) || []).length, aliasedInAll + 1);
check('顯示的別稱確實渲染出來（遊蕩者）', htmlAll.includes('強盜、忍者、盜賊'), true);
check('zhExtra 不外洩：森林女巫（植物學家）', htmlAll.includes('森林女巫'), false);
check('zhExtra 不外洩：陰陽師（祈喚者）', htmlAll.includes('陰陽師'), false);
check('zhExtra 不外洩：企業家（商人）', htmlAll.includes('企業家'), false);
check('zhExtra 不外洩：賽博人（突變體）', htmlAll.includes('賽博人'), false);
// 反向確認：這些職業確實有渲染（避免上面的斷言靠「整段沒渲染」而恆真）。
check('植物學家的三個別稱都在（含補譯）', htmlAll.includes('花刃、園丁、藥師'), true);
check('靈師的正牌別稱仍在（女巫）', htmlAll.includes('癒師、牧師、女巫'), true);
check('商人的三個別稱都在（含補譯）', htmlAll.includes('古董商、收藏家、藥劑師'), true);
check('補譯的別稱確實渲染出來（苦行者）', htmlAll.includes('苦行者'), true);
check('正式版獨有英文不出現在顯示層', htmlAll.includes('Bloomblade'), false);
check('顯示層的別稱不含 ASCII 字母',
  (htmlAll.match(/又稱：(?:<!-- -->)?([^<\n]*)/g) || [])
    .map((s) => s.replace(/又稱：(?:<!-- -->)?/, '').trim())
    .filter((s) => /[A-Za-z0-9]/.test(s)), []);

// 原始碼護欄：搜尋過濾必須走資料層的純函式，不得在元件裡自己抄一份比對邏輯。
const pickerSrc = readFileSync(
  new URL('../src/features/character-sheet/components/ClassPickerModal.jsx', import.meta.url), 'utf8');
check('元件不得自建搜尋比對（必須用 matchesClassQuery）',
  [pickerSrc.includes('matchesClassQuery'), /\.includes\(\s*q\s*\)/.test(pickerSrc)], [true, false]);
check('別稱顯示必須走 formatClassAliases', pickerSrc.includes('formatClassAliases'), true);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
