/**
 * 「角色卡上看得到嗎」的護欄：`via: 'existing'` 的條目必須**真的被某個元件接到**。
 *
 * 為什麼要這一支：W6 的 travelRoll／pendingBuffs 是純函式模組，檔案存在、也提到技能名，
 * 但**沒有任何元件 import 它們**——於是 8 筆職業技能在角色卡上完全沒有入口。
 * 之前的檢查只問「檔案在不在、有沒有提到」，那證明不了玩家看得到。
 *
 * 判定順序：
 *   ① evidence 指的檔案本身是 .jsx（元件）→ 可達
 *   ② 是 .js 模組 → 必須有 .jsx 用 `from '.../<模組名>'` 匯入
 *   ③ 兩者都不是 → 不可達
 *
 * 已知不可達會列在 `KNOWN_UNREACHABLE`（白名單**只能縮小**）。
 * 這份名單就是 `manual-checklist.md` §9 對外公告的缺口。
 */
import fs from 'node:fs';
import path from 'node:path';
import { FLOW_ITEMS } from '../src/features/character-sheet/utils/effectFlow.js';

/** 2026-11-07 實測不可達；補上入口後把名字刪掉（測試會逼你刪）。 */
const KNOWN_UNREACHABLE = new Set([
  '有備無患', '寶藏獵人', '通曉道路', '準備食材',
  '支援魔法', '我相信你', '能言善辯', '壓縮技術'
]);

let pass = 0;
const fails = [];
const ok = (n, c, d = '') => { if (c) pass += 1; else fails.push(`${n}${d ? `｜${d}` : ''}`); };

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (['.js', '.jsx'].includes(path.extname(e.name))) out.push(f.split(path.sep).join('/'));
  }
  return out;
};
const SRC = walk('src');
const JSX = SRC.filter((f) => f.endsWith('.jsx'));
const fileOf = (s) => {
  const m = /([A-Za-z0-9_\-./\\]+\.(?:jsx|js|mjs|json))/.exec(String(s || ''));
  return m ? m[1].replace(/\\/g, '/') : '';
};

const appx = fs.readFileSync('docs/plan/appendix-class-needs.md', 'utf8')
  .split('\n').filter((l) => l.trim().startsWith('### class:'))
  .map((l) => l.trim().slice(4).trim());
const existing = appx
  .map((id) => FLOW_ITEMS.find((i) => i.id === id))
  .filter((i) => i && i.apply?.via === 'existing');

const reachable = [];
const unreachable = [];
for (const item of existing) {
  const files = [...(item.apply.evidence || []), item.apply.at || ''].map(fileOf).filter(Boolean);
  const uniq = [...new Set(files)];
  const direct = uniq.some((f) => f.endsWith('.jsx'));
  const importers = uniq.filter((f) => f.endsWith('.js'))
    .filter((f) => {
      const base = path.basename(f, '.js');
      return JSX.some((jsx) => new RegExp(`from\\s+['\"][^'\"]*${base}['\"]`).test(fs.readFileSync(jsx, 'utf8')));
    });
  (direct || importers.length ? reachable : unreachable).push(item.name);
}

ok('R1 每個 existing 條目都有可達路徑或列在已知缺口',
  unreachable.filter((n) => !KNOWN_UNREACHABLE.has(n)), []);
// 名單只能縮小：補好了卻沒刪名字 → 紅（逼人回頭更新這份清單與對外文件）
ok('R2 已知缺口名單沒有殘留（補好就要刪）',
  [...KNOWN_UNREACHABLE].filter((n) => !unreachable.includes(n)), []);
ok('R3 可達的條目數 ≥ 12（W6 驗收當時的實測下限）', reachable.length >= 12, `${reachable.length} 筆`);
ok('R4 缺口數 ≤ 8（不可再增加）', unreachable.length <= 8, `${unreachable.length} 筆：${unreachable.join('、')}`);

console.log(`\n可達 ${reachable.length}／existing ${existing.length}；缺口 ${unreachable.length}`);
console.log(`\n通過 ${pass} / ${pass + fails.length}${fails.length ? `　失敗 ${fails.length}` : '　（全部通過）'}`);
fails.forEach((f) => console.log('  FAIL  ' + f));
if (fails.length) process.exit(1);
