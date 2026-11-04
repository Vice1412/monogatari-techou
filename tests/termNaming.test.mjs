/**
 * 角色卡術語命名契約。
 *
 * 執行：`npm run test:terms`（已納入 `npm test` 串接）
 *
 * ## 為什麼要有這個檔案（2026-11-03，使用者回報）
 *
 * 使用者原話：「整個角色卡常常有【職業特技】這四個字，規則書裡根本就沒這種東西。
 * 諸如此類的情形還有很多，AI 在編寫內容時用了很多規則書裡不存在的術語。」
 *
 * 量到的結果（證據在 `docs/rulebooks.md` §2、§3）：
 *
 * | 專案原本寫 | 官方資料 | 判定 |
 * |---|---|---|
 * | 職業特技（17 處） | 漢化「职业技能」410 處；官方繁中角色卡有一張「職業技能合集」 | 專案自造 |
 * | 特技（當成 Class Skill） | 官方角色卡「特技」只 1 處，且是舞者職業的敘事文本（體操特技） | 專案自造 |
 * | 特技等級／特技點數 | 官方角色卡「技能等級」4 處、漢化「技能等级」7 處 | 應為「技能等級」 |
 * | 四維屬性（29 處） | 官方只有「屬性」（角色卡 283 處／漢化 207 處） | 專案自造 |
 * | 體質（29 處） | 角色卡 0 處、漢化 0 處；漢化有「屬性骰」7 處 | 專案自造 |
 * | 進度鐘 | 官方一律「命刻」（角色卡 52 處／漢化 33 處） | 專案自造 |
 *
 * ## 這支測試守什麼
 *
 * 它不是「文案品味檢查」，而是**防止下一個 AI 再發明一次**：
 * 一個詞只要在介面上散開，就會被下一個讀程式碼的人當成專案慣例照抄。
 * 唯一擋得住的方法是讓它一出現就變紅，而且指名檔案與行號。
 *
 * ※ 白名單是**逐條具名**的，不是「跳過整個檔案」——後者等於留一個後門。
 */
import fs from 'node:fs';
import path from 'node:path';

let results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const ROOTS = ['src/features/character-sheet', 'src/features/dice-roller'];
const files = ROOTS.flatMap((root) =>
  fs
    .readdirSync(root, { recursive: true })
    .filter((f) => typeof f === 'string' && /\.(js|jsx)$/.test(f))
    .map((f) => path.join(root, f))
);

const scan = (needle, allow = []) => {
  const hits = [];
  for (const file of files) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (!line.includes(needle)) return;
      if (allow.some((a) => line.includes(a))) return;
      hits.push(`${path.basename(file)}:${i + 1}`);
    });
  }
  return hits;
};

/* ────────────────────────────────────────────────────────────────
   A. 規則書上不存在的術語：一律零容忍
   ──────────────────────────────────────────────────────────────── */
const teqi = scan('特技');
check('A1 角色卡沒有任何「特技」（官方一律「技能」）', teqi.length === 0, teqi.length ? teqi.join('、') : `${files.length} 檔掃過`);

const siwei = scan('四維');
check('A2 角色卡沒有任何「四維」（官方只有「屬性」）', siwei.length === 0, siwei.length ? siwei.join('、') : `${files.length} 檔掃過`);

const tizhi = scan('體質', ['劇毒體質']);
check('A3 角色卡沒有「體質」（官方用「屬性」／「屬性骰」）', tizhi.length === 0, tizhi.length ? tizhi.join('、') : `${files.length} 檔掃過`);

const jinduzhong = scan('進度鐘');
check('A4 角色卡沒有「進度鐘」（官方一律「命刻」）', jinduzhong.length === 0, jinduzhong.length ? jinduzhong.join('、') : `${files.length} 檔掃過`);

/* ────────────────────────────────────────────────────────────────
   B. 白名單本身要成立（不是空殼）
   ──────────────────────────────────────────────────────────────── */
const keep = scan('劇毒體質');
check('B1 白名單「劇毒體質」確實還在（否則 A3 的白名單是空的）', keep.length === 1, `${keep.length} 處`);

/* ────────────────────────────────────────────────────────────────
   C. 正向：畫面上用的是官方說法
   ──────────────────────────────────────────────────────────────── */
const classPanels = fs.readFileSync('src/features/character-sheet/data/classPanels.js', 'utf8');
check('C1 分頁標籤是「職業技能」（不是「職業特技」）', classPanels.includes("skills: '職業技能'"), 'classPanels.js');

const glossary = fs.readFileSync('src/features/character-sheet/data/glossary.js', 'utf8');
check('C2 術語表把 Class Skill 定義成「職業技能」', glossary.includes("term: '職業技能'"), 'glossary.js');
check('C3 術語表沒有把「特技」留成別名', !glossary.includes("alias: '特技'"), 'glossary.js');
check('C4 術語表的「技能等級」條目還在（SL 的正式說法）', glossary.includes('技能等級（SL）'), 'glossary.js');
check('C5 術語表的屬性條目叫「屬性」而不是「四維屬性」', glossary.includes("term: '屬性'"), 'glossary.js');

/* ────────────────────────────────────────────────────────────────
   D. 反向控制：這幾條護欄本來就會抓到
   （如果掃描器本身壞掉，A1~A4 會全部「通過」——那時看起來一模一樣）
   ──────────────────────────────────────────────────────────────── */
const fake = 'src/features/character-sheet/data/glossary.js';
const hasProbe = fs.readFileSync(fake, 'utf8').includes('職業技能');
check('D1 掃描器讀得到檔案內容（不是讀空字串）', hasProbe, `${files.length} 檔`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log('\n  規則書上沒有的詞，寫進介面就會變成「專案慣例」。');
  console.log('  官方譯名一律以 resources/角色卡 的漢化與繁中角色卡為準（docs/rulebooks.md §2）。');
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
