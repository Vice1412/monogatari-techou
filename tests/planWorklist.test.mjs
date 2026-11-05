/**
 * 逐筆工單（worklist）的覆蓋率護欄。
 *
 * 為什麼要有它：85 筆的工單只要漏抄一筆，AGY 就會少做一筆，
 * 而「漏做」在畫面上與「還沒輪到」長得一模一樣——沒有人會發現。
 * 這一支把「附錄裡有哪些筆」與「工單上有哪些筆」變成可自動比對的兩份資料。
 *
 * 執行：npm run test:planworklist
 */
import fs from 'node:fs';
import path from 'node:path';

const PLAN = 'docs/plan';
const worklist = JSON.parse(fs.readFileSync(path.join(PLAN, 'worklist.json'), 'utf8'));
const flow = JSON.parse(fs.readFileSync('src/features/character-sheet/data/effectFlows.json', 'utf8'));
const md = fs.readFileSync(path.join(PLAN, 'worklist.md'), 'utf8');

let pass = 0;
const fails = [];
const ok = (name, cond, detail = '') => { if (cond) pass += 1; else fails.push(`${name}${detail ? `｜${detail}` : ''}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `期望 ${JSON.stringify(b)}／實得 ${JSON.stringify(a)}`);

/** 與產生器同一套解析規則（故意重寫一份：兩邊同時錯才不會互相掩護）。 */
const parseAppendix = (file) => {
  const text = fs.readFileSync(path.join(PLAN, file), 'utf8');
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('### ')) continue;
    let body = line.slice(4).trim();
    if (!/^(class|heroic|quirk):/.test(body)) continue;
    const m = /^(.*?)[　\s]*[（(]([ABG][^）)]*)[）)]$/.exec(body);
    if (m) body = m[1].trim();
    if (/已列於上/.test(body)) continue;
    out.push(body);
  }
  return out;
};

const appx = {
  quirk: parseAppendix('appendix-quirk-needs.md'),
  heroic: parseAppendix('appendix-heroic-needs.md'),
  class: parseAppendix('appendix-class-needs.md')
};

const rows = worklist.rows || [];
const byCat = rows.reduce((a, r) => { a[r.category] = (a[r.category] || 0) + 1; return a; }, {});

// ── A. 覆蓋：工單與附錄一筆不差
eq('A1 金手指令數與附錄相同', byCat.quirk, appx.quirk.length);
eq('A2 英雄技能筆數與附錄相同', byCat.heroic, appx.heroic.length);
eq('A3 職業技能筆數與附錄相同', byCat.class, appx.class.length);
eq('A4 系統工作 1 筆（命刻搬家）', byCat.system, 1);
eq('A5 總筆數 = 三類＋系統', rows.length, appx.quirk.length + appx.heroic.length + appx.class.length + 1);
eq('A6 附錄的每一筆都出現在工單（金手指）',
  appx.quirk.filter((id) => !rows.some((r) => r.id === id)), []);
eq('A7 附錄的每一筆都出現在工單（英雄技能）',
  appx.heroic.filter((id) => !rows.some((r) => r.id === id)), []);
eq('A8 附錄的每一筆都出現在工單（職業技能）',
  appx.class.filter((id) => !rows.some((r) => r.id === id)), []);
eq('A9 工單沒有附錄以外的 id',
  rows.map((r) => r.id).filter((id) => !id.startsWith('system:')
    && !appx.quirk.includes(id) && !appx.heroic.includes(id) && !appx.class.includes(id)), []);
eq('A10 id 不重複', rows.length, new Set(rows.map((r) => r.id)).size);

// ── B. 形狀：每一筆都要能施工
ok('B1 每一筆都有 wave', rows.every((r) => /^W[1-7]$/.test(r.wave || '')));
ok('B2 每一筆都有群別', rows.every((r) => /^(G[1-6]|C[1-8]|Q[124]|W6)$/.test(r.group || '')));
ok('B3 每一筆都有「要做什麼」', rows.every((r) => typeof r.need === 'string' && r.need.length >= 4));
ok('B4 每一筆都有「驗收」', rows.every((r) => typeof r.accept === 'string' && r.accept.length >= 4));
ok('B5 status 只有 done／todo', rows.every((r) => ['done', 'todo'].includes(r.status)));
eq('B6 波次只用到 W1–W7', [...new Set(rows.map((r) => r.wave))].sort(), ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']);
ok('B7 金手指的已做項為 W1／W2／W5 那批',
  rows.filter((r) => r.category === 'quirk' && r.status === 'done')
    .every((r) => r.wave === 'W1' || r.wave === 'W2' || r.wave === 'W5'));

// ── C. 與真實資料交叉核對（不是只看工單自己說）
const w2 = rows.filter((r) => r.wave === 'W2');
ok('C1 W2 的每一筆在資料裡真的有多顆控件',
  w2.every((r) => {
    const item = flow.items.find((i) => i.name === r.name)
      || flow.items.find((i) => i.name.includes(r.name.split(/[／\\]/)[0]));
    return Array.isArray(item?.controls) && item.controls.length > 1;
  }), w2.map((r) => r.name).join('、'));
ok('C2 W6（職業技能）的每一筆都真的存在於 effectFlows',
  rows.filter((r) => r.wave === 'W6').every((r) => flow.items.some((i) => i.id === r.id)));
ok('C3 W4（英雄技能）的每一筆都真的存在於 effectFlows',
  rows.filter((r) => r.wave === 'W4').every((r) => flow.items.some((i) => i.id === r.id)));

// ── C4. 「已完成的英雄技能」必須符合該群應有的控件形狀
// 這一條是防「手工把 ☐ 改成 ✓」：判定寫在產生器，測試再從資料反過來驗一次。
// G4／G6 刻意不在表內（完成條件不是 control 形狀）。
const EXPECTED = { G1: 'select', G2: 'multiSelect', G3: 'text', G5: 'recordList' };
const heroicDone = rows.filter((r) => r.category === 'heroic' && r.status === 'done');
const wrongShape = heroicDone.filter((r) => {
  const expected = EXPECTED[r.group];
  if (!expected) return false;
  const item = flow.items.find((i) => i.name === r.name);
  const kinds = (Array.isArray(item?.controls) ? item.controls : [item?.control]).map((c) => c && c.kind);
  return !kinds.includes(expected);
});
ok('C4 已完成的英雄技能都符合該群應該長出來的控件形狀', wrongShape, wrongShape.map((r) => `${r.name}(${r.group})`));

const w5 = rows.filter((r) => r.wave === 'W5');
ok('C5 W5 金手指 18 筆在資料裡全數具備 controls',
  w5.every((r) => {
    const item = flow.items.find((i) => i.name === r.name)
      || flow.items.find((i) => i.name.includes(r.name.split(/[／\\]/)[0]));
    return Array.isArray(item?.controls) && item.controls.length > 0;
  }), w5.map((r) => r.name).join('、'));

// ── D. 人看的表格與 JSON 同步
const doneRows = (md.match(/^\| ✓ \|/gm) || []).length;
const todoRows = (md.match(/^\| ☐ \|/gm) || []).length;
eq('D1 worklist.md 的列數等於 JSON 筆數', doneRows + todoRows, rows.length);
eq('D2 md 的 ✓ 數量等於 JSON 的 done 數量', doneRows, rows.filter((r) => r.status === 'done').length);

// ── E. 工單與文件沒有互相矛盾（README 指到它）
const readme = fs.readFileSync(path.join(PLAN, 'README.md'), 'utf8');
ok('E1 README 有指到 worklist', /worklist\.md/.test(readme));
// 開工清單與待裁定清單也要有入口，否則它們會變成兩個沒人讀的檔案。
ok('E2 README 有指到 W6 開工清單', /w6-kickoff\.md/.test(readme));
ok('E3 README 有指到待裁定清單', /decisions-pending\.md/.test(readme));
const kickoff = fs.readFileSync(path.join(PLAN, 'w6-kickoff.md'), 'utf8');
ok('E4 開工清單列出 C5／C3 的收尾（A1／A2／B1）',
  ['A1', 'A2', 'B1'].every((id) => kickoff.includes(`| ${id} |`)));
ok('E5 開工清單指到 decisions-pending', /decisions-pending\.md/.test(kickoff));
const pending = fs.readFileSync(path.join(PLAN, 'decisions-pending.md'), 'utf8');
ok('E6 待裁定清單有 6 個編號題（1–6）',
  ['## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.'].every((h) => pending.includes(h)));
// 裁定回覆後，答案要留在兩處：待裁定清單的摘要、決策紀錄的 DA 條目。
// 只寫在其中一處的話，下一次接手的人會以為還沒裁定（AGENTS.md §7.2：同一事實只寫一處，
// 但「裁定結果」屬於決策，必須落在 decisions.md；清單只放摘要與連結）。
const RULINGS = ['1A', '2A', '3A', '4A', '5A', '6C'];
ok('E7 待裁定清單記下了六個裁定（1A…6C）',
  pending.includes('1A 2A 3A 4A 5A 6C'), true);
const decisions = fs.readFileSync('docs/decisions.md', 'utf8');
ok('E8 決策紀錄有 DA 條目（裁定結果的正本）', decisions.includes('### DA. W6 前的六項裁定'));
ok('E9 DA 索引列存在', /\| DA \|/.test(decisions));
ok('E10 開工清單已把「需裁定」改寫掉（不再有待裁定字樣）',
  !/需裁定（/.test(kickoff), true);

console.log(`\n通過 ${pass} / ${pass + fails.length}${fails.length ? `　失敗 ${fails.length}` : '　（全部通過）'}`);
fails.forEach((f) => console.log('  FAIL  ' + f));
if (fails.length) process.exit(1);
