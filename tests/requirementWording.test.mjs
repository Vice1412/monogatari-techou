/**
 * 前提條件的「寫法只有一種」（F-044，P34）
 *
 * ## 這條護欄在守什麼
 *
 * GM 的原話：
 *
 *   > 我發現同樣的東西卻有好幾個寫法。比如英雄技能要小工具【必須透過】、
 *   > 【必須獲得】、【已從小工具技能取得】……幫我統一這些翻譯，
 *   > 推斷基準是使用率最高的術語，就直接跟著那個翻譯。同樣的內容不能有不同的寫法。
 *
 * 量完 167 條，同一件事有 **8 種**寫法：
 *
 * | 寫法 | 條數 | 例 |
 * |---|---|---|
 * | `，且必須獲得X技能` | 8 | 誘餌 |
 * | `，且已習得X技能` | 8 | 解剖學家 |
 * | `，並學會X技能` | 7 | 過載爆發 |
 * | `，且已取得【X】` | 7 | 指節三明治 |
 * | `，且習得X技能` | 3 | 瞬息之間 |
 * | `，且必須學會X` | 3 | 子彈時間 |
 * | `，X技能`（只有逗號） | 3 | 英雄級夥伴 |
 * | `，並且學習了…` | 1 | 模擬同化 |
 *
 * 基準怎麼挑的：**只算「動詞後面接技能名」的用法**（那才是「你會不會這招」），
 * 習得 11 條 > 獲得 9 條 > 學會 5 條 > 取得 1 條；連接詞「且」29 條 > 「並」8 條。
 * 所以定為 **「，且已習得【X】」**：連接詞「且」、助動詞「已」、動詞「習得」、
 * 技能名一律加【】、不再接「技能」二字（【】已經說明那是技能）。
 *
 * 小工具那四條另有一個句式（因為它要講的不是技能名，是「哪一軌的第幾檔」）：
 * **「，且小工具【軌名】已達某益處」**。
 *
 * ## 為什麼要寫成護欄，而不是「改完就好」
 *
 * 這 46 條是**手動一次改完的**。改完之後沒有人會再回頭看，所以下一個人加一條新技能時
 * 很容易又寫出第 9 種寫法——而且**不會有任何東西叫**。
 * 這條護欄掃的是 `HEROIC_SKILLS`（167 條的聯集，也就是**畫面上真的會出現的那些**），
 * 不是某幾個檔案——新增資料檔也會被掃到。
 *
 * ## 掃描自己也要體檢（MEMORY 鐵則 7）
 *
 * 下面有一組「餵它壞字串必須叫、餵它正常字串必須不叫」的斷言。
 * 沒有這一組，這整支檔案可能在**什麼都沒掃到**的狀態下全綠。
 */
import { HEROIC_SKILLS, heroicSkillExtraPrerequisite } from '../src/features/character-sheet/utils/characterEngine.js';

let pass = 0;
const fails = [];
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass += 1; return; }
  fails.push({ name, actual: a, expected: e });
};
const section = (t) => console.log(`\n=== ${t} ===`);

/* ────────────────────────────────────────────────────────────
 * 0. 樣本
 * ──────────────────────────────────────────────────────────── */
section('0. 樣本：掃的是畫面上那 167 條，不是某幾個檔案');

check('HEROIC_SKILLS 是 167 條（分母換了就要重問「我掃的還是同一群人嗎」）',
  HEROIC_SKILLS.length, 167);

/** 團務限制句（「同一團中…」）是官方原文的一整句，不屬於「技能前提」的句式，先抽掉。 */
const TEAM_NOTE = /同一團[^。]*。?/g;
const extraOf = (h) => heroicSkillExtraPrerequisite(h);

/* ────────────────────────────────────────────────────────────
 * 1. 句式：只有這六種，第七種就會紅
 * ──────────────────────────────────────────────────────────── */
section('1. 額外前提的句式只有這六種');

const SHAPES = [
  // ① 一個或多個技能，全部都要
  { name: '已習得【A】（和【B】…）', re: /^已習得【[^】]+】(和【[^】]+】)*$/ },
  // ② 任一個就好
  { name: '已習得【A】或【B】', re: /^已習得【[^】]+】(或【[^】]+】)+$/ },
  // ③ 忠實夥伴的物種（物種寫在括號裡）
  { name: '已習得【忠實夥伴】（X物種）', re: /^已習得【忠實夥伴】（[^）]+物種）(和【[^】]+】)*$/ },
  // ④ 攻擊性咒語的數量
  { name: '已習得至少N個攻擊性咒語', re: /^已習得至少[一二兩三四五六\d]+個攻擊性咒語$/ },
  // ⑤ 技能等級門檻
  { name: '【X】達到技能等級 N 或更高', re: /^【[^】]+】達到技能等級 \d+ 或更高$/ },
  // ⑥ 小工具的軌與檔次
  { name: '小工具【軌】已達某益處', re: /^小工具【[^】]+】已達(基礎|高級|最高)益處$/ }
];

const withExtra = HEROIC_SKILLS.filter((h) => extraOf(h) !== '');
check('有額外前提的條數（不是 0 條——否則下面每一條都是恆真的）', withExtra.length > 0, true);

const badShape = withExtra
  .filter((h) => !SHAPES.some((s) => s.re.test(extraOf(h))))
  .map((h) => `${h.name}｜${extraOf(h)}`);
check('每一條的額外前提都落在這六種句式裡', badShape, []);

// 逐個句式都要**真的有條目用到**，否則那個句式是「寫了但沒在用」的死規則。
const shapeUse = SHAPES.map((s) => [s.name, withExtra.filter((h) => s.re.test(extraOf(h))).length]);
check('六種句式每一種都至少有一條在用（沒有死句式）',
  shapeUse.filter(([, n]) => n === 0).map(([name]) => name), []);

/* ────────────────────────────────────────────────────────────
 * 2. 舊寫法：一個都不准留
 * ──────────────────────────────────────────────────────────── */
section('2. 舊寫法一條都不准留（這些是「同樣的內容」的另外七種說法）');

/** 把團務限制句抽掉之後再驗——那句話裡的「已取得」是官方原文，不是技能前提的動詞。 */
const extraNoTeamNote = (h) => extraOf(h).replace(TEAM_NOTE, '').trim();
/** 整句（職業段＋額外前提），同樣抽掉團務限制句。 */
const fullNoTeamNote = (h) => h.requirement.replace(TEAM_NOTE, '').trim();

/**
 * 每一條都標了 `scope`：**這個缺陷會落在哪一段**。
 *
 * - `extra`：動詞句本身（「必須獲得X技能」）。掃「額外前提」那一段。
 * - `full`：職業段與額外前提**之間**的接法（「，並」「職業，且」「中，且」）。
 *
 * 為什麼非分不可（P34 破壞驗證抓到的）：
 *
 * 1. 「職業，且」「中，且」的缺陷在**職業段**。但額外前提是從「，且」後面才開始的，
 *    所以這兩個特徵**永遠不可能**出現在 extra 裡。原本三條全掃 extra，
 *    等於這兩個是**死規則**——弄壞了也不會叫（MEMORY 鐵則 19：看起來像保險的空殼）。
 * 2. 反過來，「必須」不能掃完整字串：等級門檻句「且你的角色等級必須為30或更高」
 *    有 3 條（雙重詠唱／偉大召喚／偉大召喚【變體】），那句的「必須」是官方原文的
 *    合法用法，掃 full 會把它們誤判成違規。所以「必須」留在 extra。
 *
 * 其餘 9 條在完整字串上實測都是 0 命中，但留在 extra 是刻意的：
 * 它們描述的是「動詞怎麼寫」，而動詞只住在 extra 裡。範圍放寬不會多抓到東西，
 * 只會讓下一條真的寫錯時，紅燈指向一個看不出因果的位置。
 */
const BANNED = [
  { name: '「必須」（多餘的助動詞，統一用「已」）', re: /必須/, scope: 'extra' },
  { name: '「透過」（「必須透過小工具技能獲得」）', re: /透過/, scope: 'extra' },
  { name: '「學會」（統一用「習得」）', re: /學會/, scope: 'extra' },
  { name: '「取得」（統一用「習得」）', re: /取得/, scope: 'extra' },
  { name: '「獲得」（統一用「習得」）', re: /獲得/, scope: 'extra' },
  { name: '「學習了」（統一用「習得」）', re: /學習了/, scope: 'extra' },
  // 「習得」後面只能接【名稱】或「至少」。接別的字就是舊寫法（「習得招架反擊技能」）。
  { name: '「習得」後面沒有【】（名稱要加括號）', re: /習得(?![【至])/, scope: 'extra' },
  // 【】已經說明那是技能／咒語／增益，再接一次就是重複。
  { name: '「】技能」「】咒語」「】增益」（括號後又多接一次）', re: /】(技能|咒語|增益)/, scope: 'extra' },
  { name: '「，」後面直接接動詞（少了「且」）', re: /，(已|必須|習得|學會|取得|獲得|學習了)/, scope: 'extra' },
  // 連接詞只有「，且」一種；職業段不要多餘的語尾。這三條住在接縫／職業段 → 掃 full。
  { name: '「，並」（統一用「，且」）', re: /，並/, scope: 'full' },
  { name: '「職業，且」（職業名本身就夠了）', re: /職業，且/, scope: 'full' },
  { name: '「中，且」（職業名後面多一個「中」）', re: /中，且/, scope: 'full' }
];

for (const b of BANNED) {
  // full 掃全部 167 條（整句都驗得到）；extra 掃「有額外前提」的那些。
  const pool = b.scope === 'full' ? HEROIC_SKILLS : withExtra;
  const text = b.scope === 'full' ? fullNoTeamNote : extraNoTeamNote;
  const hits = pool.filter((h) => b.re.test(text(h))).map((h) => h.name);
  check(`不准出現：${b.name}`, hits, []);
}

/* ────────────────────────────────────────────────────────────
 * 3. 職業段：一律「職業名 ＋ ，且」
 * ──────────────────────────────────────────────────────────── */
section('3. 職業段與額外前提之間，一律用「，且」接起來');

// 做法：額外前提必須是**原文裡的連續一段**（不是拼出來的），
// 它前面那一段就是職業段，而職業段只能是空字串或以「，且」結尾。
// 抽得出位置，才驗得到「接法」；抽不出位置就代表句子結構不是我們以為的那樣，要回報。
const notContiguous = withExtra.filter((h) => h.requirement.indexOf(extraOf(h)) < 0).map((h) => h.name);
check('額外前提都是原文裡連續的一段（不是事後拼出來的）', notContiguous, []);

const badJoin = withExtra
  .filter((h) => h.requirement.indexOf(extraOf(h)) >= 0)
  .map((h) => {
    const before = h.requirement.slice(0, h.requirement.indexOf(extraOf(h)));
    return { name: h.name, before };
  })
  .filter((x) => x.before !== '' && !x.before.endsWith('，且'))
  .map((x) => `${x.name}｜前面是「${x.before}」`);
check('額外前提前面要嘛沒有東西（【躍空】直接開頭），要嘛以「，且」結尾', badJoin, []);

/* ────────────────────────────────────────────────────────────
 * 4. 小工具四條：同一個句式，四條都一樣
 * ──────────────────────────────────────────────────────────── */
section('4. 小工具的四條：同一件事，同一個句式');

const GADGET_FOUR = ['藥水霧化', '量子魔加農', '大鍋秘方', '爆裂藝術家'];
const gadgetExtras = GADGET_FOUR.map((n) => {
  const h = HEROIC_SKILLS.find((x) => x.name === n);
  return [n, h ? extraOf(h) : '(找不到這條)'];
});
check('四條小工具前提都長成「小工具【軌】已達某益處」',
  gadgetExtras.filter(([, t]) => !/^小工具【[^】]+】已達(基礎|高級|最高)益處$/.test(t)), []);
// 四條的**骨架**必須一字不差（只有軌名與檔次可以不同）——這才是「同樣的寫法」。
const skeletons = [...new Set(gadgetExtras.map(([, t]) => t.replace(/【[^】]+】/, '【軌】').replace(/(基礎|高級|最高)益處/, '檔益處')))];
check('四條的骨架一字不差', skeletons, ['小工具【軌】已達檔益處']);

/* ────────────────────────────────────────────────────────────
 * 5. 掃描自己也要體檢（鐵則 7：餵它壞字串必須叫、餵正常字串必須不叫）
 * ──────────────────────────────────────────────────────────── */
section('5. 掃描自己的體檢');

const looksCanonical = (text) => SHAPES.some((s) => s.re.test(text))
  && BANNED.every((b) => !b.re.test(text));

check('（體檢）餵它一個合格的字串 → 必須不叫', looksCanonical('已習得【招架反擊】'), true);
check('（體檢）餵它一個合格的多名額字串 → 必須不叫', looksCanonical('已習得【抽取精魂】和【抽取活力】'), true);
check('（體檢）餵它「必須獲得X技能」→ 必須叫', looksCanonical('必須獲得招架反擊技能'), false);
check('（體檢）餵它「並學會X技能」→ 必須叫', looksCanonical('並學會招架反擊技能'), false);
check('（體檢）餵它「習得X技能」（名稱沒有【】）→ 必須叫', looksCanonical('已習得招架反擊技能'), false);
check('（體檢）餵它「小工具【煉金術】已達高級益處」→ 必須不叫',
  looksCanonical('小工具【煉金術】已達高級益處'), true);
check('（體檢）餵它「小工具技能中的高級煉金術技能」（舊寫法）→ 必須叫',
  looksCanonical('必須獲得小工具技能中的高級煉金術技能'), false);
check('（體檢）餵它「已習得至少兩個攻擊性咒語」→ 必須不叫（這裡的「咒語」是名詞，不是重複的語尾）',
  looksCanonical('已習得至少兩個攻擊性咒語'), true);

/**
 * `scope: 'full'` 那一組不能借 `looksCanonical` 體檢。
 * 那支要求「整串符合六種句式之一」，而完整條件（含職業段）永遠不符合，
 * 所以它給的 `false` 是**因為別的理由**——看起來像通過，其實什麼都沒驗到（鐵則 25）。
 * 改成「同一個字串，有缺陷 vs 沒缺陷」成對驗：前者必須叫，後者必須安靜。
 */
const bannedIn = (text, scope) => BANNED.filter((b) => b.scope === scope && b.re.test(text)).map((b) => b.name);

check('（體檢）職業段多一個「職業」→ 必須叫',
  bannedIn('修補匠職業，且小工具【煉金術】已達高級益處', 'full'),
  ['「職業，且」（職業名本身就夠了）']);
check('（體檢）同一個字串拿掉「職業」→ 必須不叫（上一條的對照組）',
  bannedIn('修補匠，且小工具【煉金術】已達高級益處', 'full'), []);
check('（體檢）職業名後面多一個「中」→ 必須叫',
  bannedIn('修補匠中，且小工具【煉金術】已達高級益處', 'full'),
  ['「中，且」（職業名後面多一個「中」）']);
check('（體檢）「，且」寫成「，並」→ 必須叫',
  bannedIn('修補匠，並小工具【煉金術】已達高級益處', 'full'),
  ['「，並」（統一用「，且」）']);
check('（體檢）接法正確的那一條 → 必須不叫（上一條的對照組）',
  bannedIn('熵師或遊蕩者，且已習得【迅捷】或【竊取時間】', 'full'), []);

/* ────────────────────────────────────────────────────────────
 * 6. 出處
 * ──────────────────────────────────────────────────────────── */
section('6. 這 46 條改在哪幾個檔（改完之後分佈要合理）');

const bySource = {};
for (const h of withExtra) bySource[h.source || 'core'] = (bySource[h.source || 'core'] || 0) + 1;
// 這一條守的是「掃到的還是同一群人」：出處集合變了，就代表有新的手冊／新的資料檔
// 進來，那時候要重問一次「新那批的寫法跟舊的一樣嗎」。
check('額外前提的分佈（出處集合，新的手冊進來就要回來看）',
  Object.keys(bySource).sort(),
  ['bonus', 'core', 'highFantasy', 'naturalFantasy', 'playtest', 'technoFantasy']);
check('每一條都有出處（沒有 undefined 混進來）',
  Object.keys(bySource).filter((k) => !k || k === 'undefined'), []);

/* ──────────────────────────────────────────────────────────── */
console.log('\n' + '='.repeat(56));
if (fails.length) {
  for (const f of fails) {
    console.log(`  FAIL  ${f.name}`);
    console.log(`          期望 ${f.expected}`);
    console.log(`          實得 ${f.actual}`);
  }
  console.log(`\n  通過 ${pass} / ${pass + fails.length}　失敗 ${fails.length}`);
  console.log('='.repeat(56));
  process.exit(1);
}
console.log(`  通過 ${pass} / ${pass}　（全部通過）`);
console.log('='.repeat(56));
