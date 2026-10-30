/**
 * 里程碑（P4，2026-10-30）。
 *
 * 執行：`npm run test:milestones`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 里程碑是「成就感」最便宜的來源，也最容易變成**假的成就感**：
 * 判定條件寫鬆一格，玩家什麼都沒做也會亮一整排；寫緊一格，走過十場卻一顆都沒有。
 * 所以每一條都要有**正例與反例成對**：
 *   兩條羈絆**不該**點亮「三條羈絆」；99 EXP **不該**點亮「累計 100 EXP」。
 * 只有正例的話，「條件永遠為真」和「條件寫對了」在輸出上長得一模一樣。
 *
 * ── 還有一條是「不准寫入」的 ────────────────────────────────
 *
 * F 段守的是「這個模組沒有任何寫入端」。里程碑一旦需要玩家維護，
 * 它就會走鐘、會忘記更新、會和真實資料對不上——而它本來只是資料的鏡子。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import {
  MILESTONES,
  deriveMilestones,
  milestoneCountText
} from '../src/features/character-sheet/utils/milestones.js';
import CharacterCard from '../src/features/character-sheet/components/CharacterCard.jsx';
import { CharacterLogBody } from '../src/features/character-sheet/components/CharacterLogModal.jsx';

let results = [];
/**
 * 值斷言：實際值與期望值真的相等才算過。
 *
 * ※ 專案踩過一次：把「期望值」寫進 `check(name, ok, detail)` 的 `detail` 欄位，
 *   `ok` 拿到實際值本身，非空字串／非零數字全部為真，幾十條永遠會過。
 *   所以這裡只用 `eq`，不提供那種會默默變綠的 `check`。
 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const countOf = (hay, needle) => hay.split(needle).length - 1;

const bare = () => createNewCharacter({ name: '里程碑測試' });

/** 已達成的 id 清單（排序後，方便直接比對） */
const idsOf = (ch) => deriveMilestones(ch).achieved.map((m) => m.id);

const hpEntry = (to, at = '2026-10-01T10:00:00.000Z') => ({
  id: `log_${to}_${at}`, at, kind: 'hp', title: '承受傷害',
  changes: [{ field: 'currentHp', from: to + 5, to }], note: ''
});
const expEntry = (amount, at = '2026-10-01T11:00:00.000Z') => ({
  id: `log_exp_${amount}`, at, kind: 'exp', title: '獲得 EXP',
  changes: [{ field: 'exp', from: 0, to: amount }], note: ''
});

/* ────────────────────────────────────────────────────────────────
   A. 定義本身
   ──────────────────────────────────────────────────────────────── */
eq('A1 九條里程碑（新增或刪除都要先想清楚）', MILESTONES.length, 9);
eq('A2 每條都有 id／label／hint／test 四欄，一個都不缺',
  MILESTONES.every((m) => m.id && m.label && m.hint && typeof m.test === 'function'), true);
eq('A3 id 不重複', new Set(MILESTONES.map((m) => m.id)).size, MILESTONES.length);
eq('A4 每條的 hint 都寫成一句話（不是只有標籤）',
  MILESTONES.every((m) => m.hint.length >= 12), true);

/* ────────────────────────────────────────────────────────────────
   B. 新卡：一顆都不該亮
   ──────────────────────────────────────────────────────────────── */
eq('B1 全新角色沒有任何里程碑', idsOf(bare()), []);
eq('B2 全新角色的計數是 0 / 9', milestoneCountText(deriveMilestones(bare())), '0 / 9');
eq('B3 全新角色的 list 仍然是九條（畫面要能算分母）',
  deriveMilestones(bare()).list.length, 9);

/* ────────────────────────────────────────────────────────────────
   C. 逐條：正例與反例成對
   ──────────────────────────────────────────────────────────────── */
// 第一條羈絆
const oneBond = bare();
oneBond.bonds = [{ id: 'b1', target: '導師', feelings: ['loyalty'] }];
eq('C1 一條羈絆 → 點亮「第一條羈絆」', idsOf(oneBond), ['firstBond']);

// 三條羈絆（反例：兩條不能點亮）
const twoBonds = bare();
twoBonds.bonds = [
  { id: 'b1', target: 'A', feelings: ['loyalty'] },
  { id: 'b2', target: 'B', feelings: ['affection'] }
];
eq('C2（反例）兩條羈絆不得點亮「三條羈絆」', idsOf(twoBonds), ['firstBond']);

const threeBonds = bare();
threeBonds.bonds = [
  { id: 'b1', target: 'A', feelings: ['loyalty'] },
  { id: 'b2', target: 'B', feelings: ['affection'] },
  { id: 'b3', target: 'C', feelings: ['admiration'] }
];
eq('C3 三條羈絆 → 兩顆都亮', idsOf(threeBonds), ['firstBond', 'threeBonds']);

// 初次倒下
const down = bare();
down.log = [hpEntry(0)];
eq('C4 HP 歸零 → 點亮「初次倒下」', idsOf(down), ['firstDown']);

const hurt = bare();
hurt.log = [hpEntry(3)];
eq('C5（反例）HP 掉到 3 但沒歸零，不得點亮「初次倒下」', idsOf(hurt), []);

// 完成的命刻
const clockDone = bare();
clockDone.clocks = [{ id: 'c1', title: '復仇', totalSegments: 6, filledSegments: 6 }];
eq('C6 命刻填滿 → 點亮「完成第一個命刻」', idsOf(clockDone), ['firstClockDone']);

const clockHalf = bare();
clockHalf.clocks = [{ id: 'c1', title: '復仇', totalSegments: 6, filledSegments: 5 }];
eq('C7（反例）5 / 6 格不得點亮「完成第一個命刻」', idsOf(clockHalf), []);

const clockZero = bare();
clockZero.clocks = [{ id: 'c1', title: '空的', totalSegments: 0, filledSegments: 0 }];
eq('C8（反例）總格數 0 的壞資料不得被算成「完成」（0 >= 0）', idsOf(clockZero), []);

// 場次
const oneSession = bare();
oneSession.sessionCount = 1;
eq('C9 走過一場 → 點亮「走過第一場」', idsOf(oneSession), ['firstSession']);

const nineSessions = bare();
nineSessions.sessionCount = 9;
eq('C10（反例）九場不得點亮「第十場」', idsOf(nineSessions), ['firstSession']);

const tenSessions = bare();
tenSessions.sessionCount = 10;
eq('C11 十場 → 兩顆都亮', idsOf(tenSessions), ['firstSession', 'tenthSession']);

// EXP
const exp99 = bare();
exp99.log = [expEntry(99)];
eq('C12（反例）99 EXP 不得點亮「累計 100 EXP」', idsOf(exp99), []);

const exp100 = bare();
exp100.log = [expEntry(100)];
eq('C13 100 EXP → 點亮「累計 100 EXP」', idsOf(exp100), ['exp100']);

const expSpent = bare();
expSpent.log = [expEntry(60), expEntry(60)];
eq('C14 兩筆 60 EXP 加起來過 100（不是只看單筆）', idsOf(expSpent), ['exp100']);

// 等級
const lv10 = bare();
lv10.level = 10;
eq('C15 角色等級 10 → 點亮「十級」', idsOf(lv10), ['levelTen']);

const lv9 = bare();
lv9.level = 9;
eq('C16（反例）9 級不得點亮「十級」', idsOf(lv9), []);

// 精通職業
const master = bare();
master.classes = [{ className: '守護者', level: 10, skills: [] }];
eq('C17 職業 10 級 → 點亮「精通一個職業」', idsOf(master).includes('masterClass'), true);

const notMaster = bare();
notMaster.classes = [{ className: '守護者', level: 9, skills: [] }];
eq('C18（反例）職業 9 級不得點亮「精通一個職業」', idsOf(notMaster).includes('masterClass'), false);

/* ────────────────────────────────────────────────────────────────
   D. 壞資料不得讓整排消失
   ──────────────────────────────────────────────────────────────── */
const broken = {
  bonds: 'not-an-array',
  clocks: null,
  classes: 42,
  log: 'nope',
  sessionCount: 'many',
  level: NaN
};
eq('D1 殘缺的角色不會拋錯，只是全部未達成', idsOf(broken), []);
eq('D2 殘缺的角色仍然回得出 9 條（畫面算得出分母）',
  deriveMilestones(broken).total, 9);
eq('D3 完全沒有角色物件也不拋錯', idsOf(null), []);

/* ────────────────────────────────────────────────────────────────
   E. 全達成
   ──────────────────────────────────────────────────────────────── */
const everything = bare();
everything.bonds = [
  { id: 'b1', target: 'A', feelings: ['loyalty'] },
  { id: 'b2', target: 'B', feelings: ['affection'] },
  { id: 'b3', target: 'C', feelings: ['admiration'] }
];
everything.clocks = [{ id: 'c1', title: '復仇', totalSegments: 4, filledSegments: 4 }];
everything.sessionCount = 12;
everything.level = 12;
everything.classes = [{ className: '守護者', level: 10, skills: [] }];
everything.log = [hpEntry(0), expEntry(150)];
eq('E1 全部條件成立 → 九顆全亮', deriveMilestones(everything).achieved.length, 9);
eq('E2 全亮的計數是 9 / 9', milestoneCountText(deriveMilestones(everything)), '9 / 9');

/* ────────────────────────────────────────────────────────────────
   F. 源碼護欄：這個模組是唯讀的
   ──────────────────────────────────────────────────────────────── */
const src = fs.readFileSync(
  path.resolve('src/features/character-sheet/utils/milestones.js'),
  'utf8'
);
eq('F1 里程碑模組沒有任何寫入端（不是一份要玩家維護的清單）',
  /writeJSON|localStorage|onChange/.test(src), false);
eq('F2 沒有把里程碑存進角色身上（一旦存了就會過期）',
  /character\.milestones\s*=/.test(src), false);
eq('F3 沒有給任何數值加成（一旦給加值，它就不是記錄而是規則）',
  /(bonus|modifier|加成)\s*[:=]\s*\d/.test(src), false);

/* ────────────────────────────────────────────────────────────────
   G. 畫面
   ──────────────────────────────────────────────────────────────── */
const cardMarkup = (ch) => renderToStaticMarkup(
  React.createElement(CharacterCard, {
    character: ch, onUpdateClock: null, className: ''
  })
);

const emptyCard = cardMarkup(bare());
eq('G1 新卡不畫里程碑那一列（不給一排空殼）',
  countOf(emptyCard, 'data-testid="card-milestones"'), 0);

const richCard = cardMarkup(threeBonds);
eq('G2 有里程碑時畫出那一列', countOf(richCard, 'data-testid="card-milestones"'), 1);
eq('G3 卡片上列出已達成的名字', countOf(richCard, '>第一條羈絆<'), 1);
eq('G4 卡片上不列未達成的（那不是待辦清單）', countOf(richCard, '>十級<'), 0);
eq('G5 卡片上有 N / M 的計數', countOf(richCard, '2 / 9'), 1);

const logMarkup = (ch) => renderToStaticMarkup(
  React.createElement(CharacterLogBody, {
    theme: {
      panelBg: '#f4ebd9', cardBg: '#fffdf9', border: '#d6c7ab',
      textDark: '#3c2415', textMuted: '#6b5a4b', accent: '#a63d40', badgeVariant: 'amber'
    },
    character: ch,
    onChange: () => {},
    showToast: () => {}
  })
);

const logEmpty = logMarkup(bare());
eq('G6 履歷畫出「這張卡走了多遠」', countOf(logEmpty, '這張卡走了多遠'), 1);
eq('G7 沒有里程碑時給的是教學句，不是空白', countOf(logEmpty, '還沒有任何里程碑'), 1);
eq('G8 教學句說清楚「只記錄，不影響數值」（紅線寫在畫面上）',
  countOf(logEmpty, '不影響任何數值'), 1);

const logRich = logMarkup(threeBonds);
eq('G9 有里程碑時履歷列出名字', countOf(logRich, '>第一條羈絆<'), 1);
eq('G10 履歷的計數是 2 / 9', countOf(logRich, '2 / 9'), 1);
eq('G11 有里程碑時不再出現空狀態教學句', countOf(logRich, '還沒有任何里程碑'), 0);

/* ────────────────────────────────────────────────────────────────
   Z. 斷言器自我體檢
   ──────────────────────────────────────────────────────────────── */
const before = results.length;
eq('__selfcheck__', 1, 2);
const selfOk = results.length === before + 1 && results[results.length - 1].ok === false;
results.pop();
eq('Z1 斷言器本身會紅（餵不相等的值必須回 false）', selfOk, true);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  里程碑是成就感的來源，也最容易變成假的成就感。`);
  console.log(`  條件鬆一格，什麼都沒做也會亮一整排。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
