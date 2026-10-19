/**
 * 規則概念速查（Rule Codex）測試。
 *
 * 執行：npm run test:codex
 *
 * 守三件事：
 * 1. **覆蓋率**——有「額外子系統章節」的職業，其引用技能都必須接得上速查條目
 * 2. **關鍵字唯一性**——同一關鍵字不得指向兩個條目（`findCodexRule` 只回第一個）
 * 3. **授權合規**——不得收錄畫風／敘述文字與具名範例作品
 *
 * 覆蓋率清單的來源：各書**目錄的頁碼間距**（基準 2 頁，多出來的就是額外章節），
 * 再逐頁翻開確認。詳見 `docs/agents-changelog.md`。
 */
import { RULE_CODEX, findCodexRule } from '../src/features/character-sheet/data/ruleCodexData.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  DANCER_DANCES, CHANTER_DATA, ESPER_GIFTS,
  MUTANT_THERIOFORMS, FLORIST_MAGISEEDS, SYMBOLIST_SYMBOLS,
  SUBOPTION_SKILLS_CONFIG
} from '../src/features/character-sheet/data/skillSuboptionsData.js';
import {
  PILOT_FRAMES, PILOT_ARMOR_MODULES, PILOT_WEAPON_MODULES, PILOT_SUPPORT_MODULES
} from '../src/features/character-sheet/data/pilotVehicleData.js';
import { SET_EFFECTS } from '../src/features/character-sheet/data/aceOfCardsData.js';

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
const checkTrue = (label, cond) => check(label, !!cond, true);
const section = (t) => lines.push(`\n=== ${t} ===`);

const CLASSES = rulesData.classes || {};

// ─────────────────────────────────────────────────────────── A
section('A. 條目完整性');
const ids = Object.keys(RULE_CODEX);
check('共 17 條（核心 6 + 擴充 10 + 公測 1）', ids.length, 17);

const CORE_IDS = ['arcana', 'rituals', 'gadgets', 'projects', 'companion', 'spellbooks'];
const EXPANSION_IDS = [
  'chanter', 'dancer', 'symbolist',
  'floralist', 'gourmet', 'invoker',
  'esper', 'mutant', 'pilot',
  'aceOfCards'
];
const PLAYTEST_IDS = ['arcanaVariant'];
check('核心 6 條齊全', CORE_IDS.every((x) => ids.includes(x)), true);
check('擴充 10 條齊全', EXPANSION_IDS.every((x) => ids.includes(x)), true);
check('公測 1 條齊全', PLAYTEST_IDS.every((x) => ids.includes(x)), true);

for (const id of ids) {
  const e = RULE_CODEX[id];
  checkTrue(`${id}：有 title`, e.title);
  checkTrue(`${id}：有 page`, e.page);
  checkTrue(`${id}：有 summary`, e.summary);
  checkTrue(`${id}：有 keywords`, Array.isArray(e.keywords) && e.keywords.length > 0);
  checkTrue(`${id}：id 與鍵一致`, e.id === id);
}

// ─────────────────────────────────────────────────────────── B
section('B. 關鍵字唯一性（findCodexRule 只回第一個符合者）');
const kwOwner = {};
for (const id of ids) {
  for (const k of RULE_CODEX[id].keywords) {
    (kwOwner[k] = kwOwner[k] || []).push(id);
  }
}
const conflicts = Object.entries(kwOwner).filter(([, v]) => v.length > 1);
check('沒有關鍵字同時指向兩個條目', conflicts.map(([k]) => k), []);
check('每個關鍵字都能查到條目',
  Object.keys(kwOwner).every((k) => findCodexRule(k) !== null), true);
check('查不到的詞回傳 null', findCodexRule('這個詞不存在'), null);
check('空字串回傳 null', findCodexRule(''), null);

// ─────────────────────────────────────────────────────────── C
section('C. 覆蓋率：有額外子系統章節的職業，其引用技能必須接得上');
// 職業 → 對應速查條目（來源：各書目錄頁碼間距 + 逐頁確認）
const CLASS_CODEX = {
  魔奏者: 'chanter',
  舞者: 'dancer',
  徽記師: 'symbolist',
  植物學家: 'floralist',
  美食家: 'gourmet',
  祈喚者: 'invoker',
  靈能者: 'esper',
  突變體: 'mutant',
  機師: 'pilot',
  卡牌大師: 'aceOfCards'
};
check('對應表 10 個職業', Object.keys(CLASS_CODEX).length, 10);

for (const [cls, codexId] of Object.entries(CLASS_CODEX)) {
  const c = CLASSES[cls];
  if (!c) {
    checkTrue(`${cls}：存在於 rulesData`, false);
    continue;
  }
  const kws = RULE_CODEX[codexId].keywords;
  const skills = c.skills || [];
  const linked = skills.filter((s) => kws.some((k) => (s.desc || '').includes(k)));
  checkTrue(`${cls}：至少一個技能接得上（${linked.length}/${skills.length}）`, linked.length > 0);
}

section('C2. 每個子系統都至少被一個技能引用');
for (const codexId of EXPANSION_IDS) {
  const kws = RULE_CODEX[codexId].keywords;
  let hits = 0;
  for (const c of Object.values(CLASSES)) {
    for (const s of c.skills || []) {
      if (kws.some((k) => (s.desc || '').includes(k))) hits += 1;
    }
  }
  checkTrue(`${RULE_CODEX[codexId].title}：被 ${hits} 個技能引用`, hits > 0);
}

section('C3. 技能文字裡的「見【X】」交叉引用必須解析得到速查條目');
// 為什麼要有這一節：§C 只驗「該職業至少有一個關鍵詞命中技能描述」——太寬。
// 2026-10-17 實測發現 5 個職業的交叉引用有 4 個是死引用（舞步表／徽記表／祈喚表／園藝表），
// 全部因為「有別的關鍵詞命中」而通過了 §C。
//
// 根因：漢化把英文的頁碼指路（see next page／see page 144）翻成了不存在的「XX表」表名，
// 而本專案的速查頁名取自**機制名**（舞步／徽記／元素源泉／花園與魔法種子），兩邊對不上。
// 這裡逐一要求：技能文字裡寫的每一個表名，`findCodexRule` 都必須查得到。
const crossRefs = [];
for (const [cls, c] of Object.entries(CLASSES)) {
  for (const s of c.skills || []) {
    const re = /見【([^】]+)】/g;
    let m;
    while ((m = re.exec(s.desc || '')) !== null) crossRefs.push([cls, s.name, m[1]]);
  }
}
checkTrue(`掃到交叉引用（現有 ${crossRefs.length} 處）`, crossRefs.length >= 6);
const unresolved = crossRefs.filter(([, , term]) => findCodexRule(term) === null);
check(
  '每個交叉引用都查得到速查條目（有值＝死引用）',
  unresolved.map(([cls, sk, term]) => `${cls}／${sk} → 【${term}】`),
  []
);

section('C4. 每個子項目技能的「規則速查」入口都必須按得動');
// `SkillSuboptionModal` 的「規則速查」按鈕以 `findCodexRule(skillName)` 為顯示條件——
// 查不到就不顯示。這裡反過來要求：9 個有子項目的技能**全部**都要查得到，
// 否則那個技能就少了一個入口（而且不會有任何錯誤訊息，只是安靜地不出現）。
const suboptionPairs = [];
for (const [cls, skills] of Object.entries(SUBOPTION_SKILLS_CONFIG)) {
  for (const skillName of Object.keys(skills)) suboptionPairs.push([cls, skillName]);
}
checkTrue(`子項目技能共 ${suboptionPairs.length} 個`, suboptionPairs.length >= 9);
check(
  '每個子項目技能都查得到速查條目（有值＝按鈕不會出現）',
  suboptionPairs.filter(([, sk]) => findCodexRule(sk) === null).map(([c, s]) => `${c}／${s}`),
  []
);

// ─────────────────────────────────────────────────────────── D
section('D. 無額外子系統章節的職業，不應有專屬速查條目');
// 基準 2 頁者無額外章節；4 頁者多出來的是「法術列表」而非新機制。
const NO_EXTRA = [
  '嵌合師', '暗黑之刃', '元素師', '熵師', '狂怒鬥士', '守護者', '博學士',
  '吟唱者', '遊蕩者', '神射手', '靈魂術士', '武器大師',
  '指揮官', '商人', '死靈術士'
];
const classTitles = new Set(Object.values(RULE_CODEX).map((e) => e.title));
for (const cls of NO_EXTRA) {
  checkTrue(`${cls}：沒有專屬速查條目`, !classTitles.has(cls));
}

// ─────────────────────────────────────────────────────────── E
section('E. 擴充條目的資料結構');
for (const id of EXPANSION_IDS) {
  const e = RULE_CODEX[id];
  checkTrue(`${id}：使用 sections 陣列`, Array.isArray(e.sections) && e.sections.length > 0);
  const kinds = new Set(e.sections.map((s) => s.kind));
  checkTrue(`${id}：section kind 皆為 rules/table/cards`,
    [...kinds].every((k) => ['rules', 'table', 'cards'].includes(k)));
  for (const sec of e.sections) {
    checkTrue(`${id}／${sec.title}：有 title`, !!sec.title);
    if (sec.kind === 'rules') {
      checkTrue(`${id}／${sec.title}：items 非空`,
        Array.isArray(sec.items) && sec.items.length > 0);
    }
    if (sec.kind === 'table') {
      checkTrue(`${id}／${sec.title}：columns 非空`,
        Array.isArray(sec.columns) && sec.columns.length > 0);
      checkTrue(`${id}／${sec.title}：每列欄數與表頭一致`,
        sec.rows.every((r) => r.length === sec.columns.length));
    }
    if (sec.kind === 'cards') {
      checkTrue(`${id}／${sec.title}：items 非空`,
        Array.isArray(sec.items) && sec.items.length > 0);
      checkTrue(`${id}／${sec.title}：每張卡都有 name 與 body`,
        sec.items.every((i) => i.name && i.body));
    }
  }
}

section('E2. 關鍵數據抽查（逐條對照原書）');
const findSection = (id, titlePart, kind) =>
  RULE_CODEX[id].sections.find(
    (s) => s.title.includes(titlePart) && (!kind || s.kind === kind)
  );

check('魔奏者：音量 3 級', findSection('chanter', '音量', 'table').rows.length, 3);
check('魔奏者：音調 8 種', findSection('chanter', '音調', 'table').rows.length, 8);
check('魔奏者：曲風 7 種', findSection('chanter', '曲風').items.length, 7);
check('舞者：舞步 17 個', findSection('dancer', '舞步', 'table').rows.length, 17);
check('徽記師：徽記 19 個', findSection('symbolist', '徽記一覽', 'table').rows.length, 19);
check('徽記師：特殊規則 10 條', RULE_CODEX.symbolist.sections[0].items.length, 10);
check('植物學家：魔法種子條目 43 列（20 顆 × 各 1~3 個 T 階段）',
  findSection('floralist', '魔法種子一覽', 'table').rows.length, 43);
check('植物學家：20 顆魔法種子',
  new Set(findSection('floralist', '魔法種子一覽', 'table').rows.map((r) => r[0])).size, 20);
check('植物學家：生長命刻 4 格',
  RULE_CODEX.floralist.sections[1].items.some((s) => s.includes('4 格')), true);
check('美食家：口味表 6 面', findSection('gourmet', '食材口味', 'table').rows.length, 6);
check('美食家：效果表 12 條', findSection('gourmet', '美食效果', 'table').rows.length, 12);
check('祈喚者：祈喚 20 個', findSection('invoker', '元素源泉與祈喚', 'table').rows.length, 20);
check('靈能者：天賦 9 個', findSection('esper', '天賦一覽', 'table').rows.length, 9);
check('突變體：混合形態 12 個', findSection('mutant', '混合形態一覽', 'table').rows.length, 12);
check('機師：框架 3 種', findSection('pilot', '框架', 'table').rows.length, 3);
check('機師：防具模組 4 種', findSection('pilot', '防具模組', 'table').rows.length, 4);
check('機師：武裝模組 17 種', findSection('pilot', '武裝模組', 'table').rows.length, 17);
check('機師：支援模組 14 種', findSection('pilot', '支援模組', 'table').rows.length, 14);
check('卡牌大師：效果 8 種', findSection('aceOfCards', '組合效果', 'table').rows.length, 8);

// 譯名同步護欄：同一組 8 個效果在「資料層」與「速查手冊」必須逐字相同。
// 2026-10-05 之前兩邊各有一套譯名（鬼牌／滿貫／魔法同花／炫目同花／滿貫狀態 vs
// 小丑牌／頭獎／魔力同花順／盲目同花順／滿堂彩），使用者裁定後統一為
// 小丑牌／四條頭獎／魔法同花順／炫目順子／狀態滿貫。此後任一邊改名都會在這裡撞牆。
const ACE_ROWS = findSection('aceOfCards', '組合效果', 'table').rows;
check('卡牌大師：效果名稱與資料層逐字相同（含順序）',
  ACE_ROWS.map((r) => String(r[0]).replace('（需英雄技能）', '')),
  SET_EFFECTS.map((e) => e.name));
check('卡牌大師：需求欄位與資料層逐字相同（含順序）',
  ACE_ROWS.map((r) => r[1]),
  SET_EFFECTS.map((e) => e.requirement));

// ─────────────────────────────────────────────────────────── F
section('F. 授權合規：不得收錄畫風／敘述與具名範例作品');
// §1 明定官方原書的美術、文字、素材、商業外觀均為保留材料。
// 依 §3，只有「規則、文字與機制」可被引用；本專案採更保守的作法：只收機制。
check('projects 不含具名範例作品', RULE_CODEX.projects?.samples, undefined);
check('rituals 不含敘事範例', RULE_CODEX.rituals?.examples, undefined);
check('gadgets 的煉金術不含畫風描述', RULE_CODEX.gadgets?.alchemy?.desc, undefined);
check('gadgets 的魔科技不含畫風描述', RULE_CODEX.gadgets?.magitech?.desc, undefined);
check('rituals 的學派不含畫風描述',
  (RULE_CODEX.rituals?.disciplines || []).every((d) => d.desc === undefined), true);
check('機師不含具名範例載具',
  RULE_CODEX.pilot.sections.every((s) =>
    !(s.kind === 'table' && s.rows.some((r) => r[0] === '星際戰機' || r[0] === '懸浮滑板'))), true);

// ─────────────────────────────────────────────────────────── G
section('G. 譯名一致性：速查子項目名稱必須與定譯表逐字相同');
// 定譯表來源：繁中版角色卡 Excel V2.17（`skillSuboptionsData.js`／`pilotVehicleData.js`
// 檔頭已各自註明）。核心 6 條的定譯來源是官方核心規則漢化 PDF。
//
// 這道關卡是為 2026-10-05 的失誤而加：速查當時是從英文原書**自行翻譯**的，
// 約 140 處名稱與定譯表不同（舞步 17/17、徽記 9/19、魔法種子 13/20、混合形態 12/12、
// 心靈天賦 7/9、機師支援模組 14/14…），而既有的 A~F 區段**一項都驗不到**——
// 它們只驗結構、數量、關鍵字唯一性與授權合規，驗不到「名稱對不對」。
const normName = (s) => String(s).replace(/（[^）]*）/g, '').replace(/✦/g, '').trim();
const col0 = (rows) => rows.map((r) => normName(r[0]));
const matchNames = (label, expected, actual) => {
  const missing = expected.filter((n) => !actual.includes(normName(n)));
  check(`${label}：${expected.length} 個名稱全部命中定譯`, missing, []);
};

matchNames('舞者',
  DANCER_DANCES.map((d) => d.name),
  col0(findSection('dancer', '舞步', 'table').rows));
matchNames('魔奏者音調',
  CHANTER_DATA.keys.map((k) => k.name),
  col0(findSection('chanter', '音調', 'table').rows));
matchNames('魔奏者曲風',
  CHANTER_DATA.tones.map((t) => t.name),
  findSection('chanter', '曲風').items.map((i) => i.name));
matchNames('徽記師',
  SYMBOLIST_SYMBOLS.map((s) => s.name),
  col0(findSection('symbolist', '徽記一覽', 'table').rows));
matchNames('植物學家',
  FLORIST_MAGISEEDS.map((s) => s.name),
  col0(findSection('floralist', '魔法種子一覽', 'table').rows));
matchNames('靈能者',
  ESPER_GIFTS.map((g) => g.name),
  col0(findSection('esper', '天賦一覽', 'table').rows));
matchNames('突變體',
  MUTANT_THERIOFORMS.map((f) => f.name),
  col0(findSection('mutant', '混合形態一覽', 'table').rows));
matchNames('機師框架',
  PILOT_FRAMES.map((f) => f.name),
  col0(findSection('pilot', '框架', 'table').rows));
matchNames('機師防具模組',
  PILOT_ARMOR_MODULES.map((m) => m.name),
  col0(findSection('pilot', '防具模組', 'table').rows));
matchNames('機師武裝模組',
  PILOT_WEAPON_MODULES.map((m) => m.name),
  col0(findSection('pilot', '武裝模組', 'table').rows));
matchNames('機師支援模組',
  PILOT_SUPPORT_MODULES.map((m) => m.name),
  col0(findSection('pilot', '支援模組', 'table').rows));

// 徽記同時維持上限＝SL + 1（已對照原書；`skillSuboptionsData` 的 quotaHint 同值）
checkTrue('徽記師：同時維持上限為 SL+1',
  RULE_CODEX.symbolist.sections[0].items.some((s) => s.includes('加 1')));

// ─────────────────────────────────────────────────────────── H
section('H. 阿爾卡納變體（§BF：ARCANIST (variant), Playtest 2026-10-01 p.24~33）');
// 這條速查的意義是「兩版並列」：核心版 9 個（無脈衝）與變體版 11 個（有脈衝）
// 必須同時存在、互不覆寫。任何一邊被合併掉，下面就會撞牆。
const ARC_CORE = RULE_CODEX.arcana;
const ARC_VAR = RULE_CODEX.arcanaVariant;

check('核心版仍是 9 個阿爾卡納', ARC_CORE.catalog.length, 9);
check('變體版是 11 個範例阿爾卡納', ARC_VAR.catalog.length, 11);
check('核心版目錄標題未被改寫', ARC_CORE.catalogTitle, '9 大阿爾卡納目錄');
check('變體版目錄標題', ARC_VAR.catalogTitle, '11 個範例阿爾卡納');
check('變體版條目掛在「公測修訂」這本書下（分頁分隔線靠它）',
  ARC_VAR.page.split(/\s+/)[0], '公測修訂');

// 兩版的差別本身要被守住：核心版**不該**有脈衝，變體版**必須**有。
check('核心版 9 個都沒有脈衝（這是兩版的根本差別）',
  ARC_CORE.catalog.filter((a) => a.pulse !== undefined).map((a) => a.id), []);
check('變體版 11 個都真的有脈衝',
  ARC_VAR.catalog.filter((a) => typeof a.pulse !== 'string' || !a.pulse.trim()).map((a) => a.id), []);
check('變體版每一筆都有 id／名稱／領域／連結／脈衝／解除',
  ARC_VAR.catalog.filter((a) => !(a.id && a.name && a.domains && a.merge && a.pulse && a.dismiss)).map((a) => a.id), []);
check('變體版 id 不與核心版撞號（撞號會讓召喚面板指錯人）',
  ARC_VAR.catalog.filter((a) => ARC_CORE.catalog.some((c) => c.id === a.id)).map((a) => a.id), []);
check('變體版 id 彼此不重複',
  ARC_VAR.catalog.length - new Set(ARC_VAR.catalog.map((a) => a.id)).size, 0);

// 規則數字（p.25）：召喚 30 點 MP、等級 +5／+10。抄錯就會變成核心版的 40／10／20。
const arcVarRules = ARC_VAR.rules.join('\n');
checkTrue('變體規則寫明召喚費 30 點 MP', arcVarRules.includes('30 點 MP'));
checkTrue('變體規則寫明 20 級 +5', /20 級以上額外 5 點/.test(arcVarRules));
checkTrue('變體規則寫明 40 級 +10', /40 級以上額外 10 點/.test(arcVarRules));
checkTrue('變體規則寫明脈衝只能在衝突場景使用', arcVarRules.includes('衝突場景'));
checkTrue('變體規則寫明自動解除不觸發解除效果', arcVarRules.includes('不會觸發'));
// 核心版仍是 40／10／20，不能被順手改成變體數字。
const arcCoreRules = ARC_CORE.rules.join('\n');
checkTrue('核心版規則仍是 40 點 MP', arcCoreRules.includes('40 點 MP'));
checkTrue('核心版等級加值仍是 10／20', /額外造成 10 點傷害/.test(arcCoreRules) && /額外造成 20 點傷害/.test(arcCoreRules));

// 官方 p.33 指名 5 個「直接對應」的改寫版，缺一個就代表範例抄漏了。
const DIRECT_EQUIVALENTS = ['莫羅茲', '妮妙', '奧法尼爾', '麒麟', '土八該隱'];
check('5 個「直接對應核心版」的範例阿爾卡納都在',
  DIRECT_EQUIVALENTS.filter((n) => !ARC_VAR.catalog.some((a) => a.name.includes(n))), []);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
