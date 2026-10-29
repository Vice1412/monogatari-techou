/**
 * 修補匠【小工具】的**階級用詞**護欄。
 *
 * 執行：`npm run test:tinkerer`
 *
 * ## 為什麼要專門開一個檔守「三個字」
 *
 * 2026-10-29 GM 裁定：
 *
 *   > 修補匠的【小工具】技能，那些階級寫錯了。並非【基礎、進階、上位】，
 *   > 而是【基礎、高級、最高】。
 *
 * 官方原文（`scratch/complete_15_classes_raw.txt` L1172–1173，助手版與民間漢化版一致）：
 *
 *   > 你獲得它的**基礎增益**。當你再次獲得此技能時，選擇一個選項：
 *   > 你獲得一種新工具類型的**基礎增益**；或者你獲得一種你已經獲得基礎增益的
 *   > 小工具類型的**高級增益**；或者你獲得一種你已經獲得高級增益的小工具類型的**最高增益**。
 *
 * （本專案一律把「增益」寫成「益處」，這是全站既有譯法；本檔只守**階級那三個字**。）
 *
 * ## 這個錯誤為什麼難發現
 *
 * 它不會壞、不會紅、也不會讓任何計算變錯——只是**畫面上寫錯一個詞**。
 * 而且它同時住在六個地方（資料、兩條公測分支、彈窗、速查、速查索引、規則總覽），
 * 改了三處、漏了三處，看起來仍然「差不多」。
 *
 * 所以這裡用兩種手段：
 *   ① **資料斷言**：直接讀 `GADGET_TRACKS` / `MAGITECH_BRANCHES` 的 `tierName`，不看畫面文字
 *      （同 MEMORY 鐵則 13：`includes('x')` 只證明有人寫過，不證明資料是對的）。
 *   ② **全目錄原始碼掃描**：`src/` 遞迴，一個檔都不准漏
 *      （同 MEMORY 鐵則 13：手寫檔案清單漏掉的永遠是我沒想到的那一個）。
 *      掃描本身也自檢——餵它壞字串必須叫、餵它好字串必須不叫。
 *
 * ## 這一檔**不**守什麼
 *
 * 突變體的技能名【進階無拘形態】【進階蛻皮】【進階混合變形】**是對的**，
 * 那裡的「進階」不是小工具的階級。所以禁用詞刻意寫成「進階＋具體名詞」
 * 而不是光禿禿的「進階」——放行「一個位置」，不是放行「一整條」（MEMORY 鐵則 7）。
 * 檔尾 G 區有一條反向斷言釘住這件事。
 */
import fs from 'node:fs';
import path from 'node:path';
import { GADGET_TRACKS } from '../src/features/character-sheet/components/companions/TinkererGadgetsModal.jsx';
import {
  MAGITECH_BRANCHES,
  MAGITECH_CORE_NODES,
  resolveMagitechNodes,
  magitechNodeAt
} from '../src/features/character-sheet/data/gadgetBranches.js';
import { CORE_BOOK_VARIANTS } from '../src/features/character-sheet/data/coreBookVariants.js';
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

const section = (t) => lines.push(`\n=== ${t} ===`);

/* ─────────────────────────────────────────────────────────── 共用 */
const TIERS = ['基礎益處', '高級益處', '最高益處'];
const READ = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

const tinkererSkill = (rulesData.classes?.['修補匠']?.skills || [])
  .find((s) => s.name === '小工具') || null;

/* ─────────────────────────────────────────────────────────── A */
section('A. 三條核心軌道：每檔的 tierName 逐一點名');
const trackNames = GADGET_TRACKS.map((t) => t.name);
check('核心軌道就是這三條（多一條或少一條都要重新想這裡）', trackNames, ['煉金術', '灌注術', '魔導科技']);
for (const track of GADGET_TRACKS) {
  check(`${track.name}：三檔的階級名`,
    track.nodes.map((n) => n.tierName), TIERS);
}

/* ─────────────────────────────────────────────────────────── B */
section('B. 節點名稱不准夾帶舊階級字');
const BANNED_IN_NAME = ['進階', '上級', '上位'];
const allCoreNodes = GADGET_TRACKS.flatMap((t) => t.nodes.map((n) => ({ track: t.name, ...n })));
check('核心 9 個節點的名稱都不含 進階／上級／上位',
  allCoreNodes.filter((n) => BANNED_IN_NAME.some((w) => n.name.includes(w))).map((n) => `${n.track}/${n.name}`),
  []);
// 對照組：名稱真的會被讀到（不是因為節點陣列空掉才全綠）
check('（對照）核心節點確實有 9 個', allCoreNodes.length, 9);
check('（對照）核心節點名稱真的讀得到', allCoreNodes.map((n) => n.name).slice(0, 3),
  ['基礎混合藥劑', '高級混合藥劑', '最高混合藥劑']);

/* ─────────────────────────────────────────────────────────── C */
section('C. 兩條公測分支（p.38–39）的節點');
for (const key of ['magitechArmament', 'magispheres']) {
  const branch = MAGITECH_BRANCHES[key];
  check(`${branch.name}：三檔的階級名`, branch.nodes.map((n) => n.tierName), TIERS);
  check(`${branch.name}：節點名稱不含 進階／上級／上位`,
    branch.nodes.filter((n) => BANNED_IN_NAME.some((w) => n.name.includes(w))).map((n) => n.name), []);
}
check('魔導武裝的節點名就是這三個',
  MAGITECH_BRANCHES.magitechArmament.nodes.map((n) => n.name), ['基礎武裝', '高級武裝', '最高武裝']);
check('魔法球的節點名就是這三個',
  MAGITECH_BRANCHES.magispheres.nodes.map((n) => n.name), ['基礎魔法球', '高級魔法球', '最高魔法球']);

/* ─────────────────────────────────────────────────────────── D */
section('D. 魔晶石制：魔法球降檔後仍然是「高級」');
const technoNodes = resolveMagitechNodes(true);
check('魔晶石制只剩兩檔', technoNodes.map((n) => n.tier), [1, 2]);
check('兩檔的階級名', technoNodes.map((n) => n.tierName), ['基礎益處', '高級益處']);
check('魔法球原型降到第 2 檔', magitechNodeAt(2, true)?.name, '魔法球原型');
check('（對照）核心制是三檔且第 3 檔是最高益處',
  [MAGITECH_CORE_NODES.length, MAGITECH_CORE_NODES[2].tierName], [3, '最高益處']);

/* ─────────────────────────────────────────────────────────── E */
section('E. 技能說明文字（rulesData 的【小工具】）');
const gadgetDesc = String(tinkererSkill?.desc || '');
check('找得到【小工具】這條技能', Boolean(gadgetDesc), true);
check('說明裡寫「高級益處」', gadgetDesc.includes('高級益處'), true);
check('說明裡寫「最高益處」', gadgetDesc.includes('最高益處'), true);
check('說明裡不再有「進階益處」', gadgetDesc.includes('進階益處'), false);
check('說明裡不再有「上位益處」', gadgetDesc.includes('上位益處'), false);
// 出現次數照官方原文的句式：基礎 3 次（「獲得其基礎」「新類型的基礎」「已擁有基礎的」）、
// 高級 2 次（「獲得高級」「已擁有高級的」）、最高 1 次（只有結尾那句）。
// 這條守的是「三個階級都還在、而且句子結構沒被簡化掉」，不是「各出現一次」。
check('三個階級的出現次數與官方句式一致',
  ['基礎益處', '高級益處', '最高益處'].map((w) => gadgetDesc.split(w).length - 1), [3, 2, 1]);

/* ─────────────────────────────────────────────────────────── F */
section('F. 全目錄原始碼掃描（src/ 遞迴，一個檔都不准漏）');

/**
 * 禁用詞刻意寫成「階級字 ＋ 具體名詞」，不是光禿禿的「進階」。
 * 因為【進階混合變形】是突變體的技能名，那裡的「進階」是對的。
 */
const FORBIDDEN = [
  '上位',
  '進階益處',
  '上級益處',
  '進階武裝', '上級武裝',
  '進階魔法球', '上級魔法球',
  '進階灌注', '上級灌注',
  '進階混合藥劑', '上級混合藥劑',
  '進階再 2', '上級再 2',
  '基礎 2／進階 4／上級 6',
  '基礎 2、進階 4、上級 6'
];

const isForbidden = (text) => FORBIDDEN.filter((w) => text.includes(w));

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const TEXT_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html', '.md']);
const srcFiles = walk(path.resolve(process.cwd(), 'src'))
  .filter((f) => TEXT_EXT.has(path.extname(f)));

// 掃描器自檢：餵壞字串必須叫、餵好字串必須不叫（MEMORY 鐵則 7）
check('掃描器自檢：壞字串會被抓到',
  isForbidden("tierName: '上位益處'").length > 0, true);
check('掃描器自檢：另一個壞字串也會被抓到',
  isForbidden("name: '上級武裝'").length > 0, true);
check('掃描器自檢：正常字串不會誤報',
  isForbidden("tierName: '高級益處', name: '最高武裝'"), []);
check('掃描器自檢：突變體的【進階混合變形】不會誤報',
  isForbidden('**進階混合變形**：在衝突場景中'), []);

check('掃到的檔案數合理（少於 100 就是走錯目錄）', srcFiles.length > 100, true);

const hits = [];
for (const file of srcFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const bad = isForbidden(text);
  if (bad.length > 0) hits.push(`${path.relative(process.cwd(), file)} → ${bad.join('、')}`);
}
check('src/ 底下沒有任何一處還寫著舊階級字', hits, []);

/* ─────────────────────────────────────────────────────────── G */
section('G. 反向：這次改名不准誤傷突變體');
const heroicNames = (rulesData.heroicSkills || []).map((h) => h.name);
check('突變體的三個「進階」英雄技能一個都沒被動到（逐一點名）',
  ['進階無拘形態', '進階蛻皮', '進階混合變形'].filter((n) => !heroicNames.includes(n)), []);
check('（對照）英雄技能表真的讀得到（不是空陣列才全綠）', heroicNames.length >= 115, true);
const armamentVariant = CORE_BOOK_VARIANTS.find((v) => v.id === 'magitechArmament') || {};
check('混合變形變體裡對【進階混合變形】的引用還在',
  String(armamentVariant.desc || '').length > 0, true);
const thermoVariant = CORE_BOOK_VARIANTS.find((v) => v.id === 'theriomorphosisVariant') || {};
check('混合變形變體的說明仍然寫著【進階混合變形】',
  String(thermoVariant.desc || '').includes('【進階混合變形】'), true);

/* ─────────────────────────────────────────────────────────── 結果 */
lines.push('');
if (fail > 0) {
  lines.push(`\n失敗 ${fail} 項`);
}
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
lines.push('='.repeat(56));
console.log(lines.join('\n'));
process.exit(fail === 0 ? 0 : 1);
