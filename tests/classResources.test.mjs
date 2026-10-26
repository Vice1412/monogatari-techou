/**
 * 職業資源池測試。
 *
 * 執行：npm run test:resources
 *
 * 全部期望值取自官方英文原書（印刷頁碼）：
 * - 墳墓點上限 `SL+1`  ← Bonus Collection p.13
 * - 貿易點數上限 `SL+3` ← Natural Fantasy p.159
 * - 幸運數字起始 `7`    ← Core p.191
 */
import {
  CLASS_RESOURCES,
  getSkillSL,
  getActiveClassResources,
  readResource,
  clampResource,
  setResourceValue
} from '../src/features/character-sheet/data/classResources.js';

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

/** 造一個測試角色 */
const mkChar = (classes, classResources) => ({ classes, classResources });

const NECRO = { className: '死靈術士', level: 5, skills: [{ name: '超越死界', sl: 3 }] };
const MERCHANT = { className: '商人', level: 3, skills: [{ name: '貿易之風', sl: 2 }] };
const ENTROPIST = { className: '熵師', level: 4, skills: [{ name: '幸運七', sl: 1 }] };
const FURY = { className: '狂怒鬥士', level: 2, skills: [{ name: '腎上腺素', sl: 2 }] };

// ─────────────────────────────────────────────────────────── A
section('A. getSkillSL：找不到時回傳 0（不得臆測）');
check('有該職業與技能', getSkillSL(mkChar([NECRO]), '死靈術士', '超越死界'), 3);
check('有職業但無該技能', getSkillSL(mkChar([NECRO]), '死靈術士', '不存在的技能'), 0);
check('無該職業', getSkillSL(mkChar([FURY]), '死靈術士', '超越死界'), 0);
check('空角色', getSkillSL({}, '死靈術士', '超越死界'), 0);
check('null 角色', getSkillSL(null, '死靈術士', '超越死界'), 0);

// ─────────────────────────────────────────────────────────── B
section('B. 啟用判定：沒有該職業就不該出現');
check('死靈術士 -> 只有墳墓點', getActiveClassResources(mkChar([NECRO])).map((r) => r.id), ['gravePoints']);
check('商人 -> 只有貿易點數', getActiveClassResources(mkChar([MERCHANT])).map((r) => r.id), ['tradePoints']);
check('熵師 -> 只有幸運數字', getActiveClassResources(mkChar([ENTROPIST])).map((r) => r.id), ['luckyNumber']);
check('狂怒鬥士 -> 無任何資源（純文字型職業）', getActiveClassResources(mkChar([FURY])), []);
check('空角色 -> 無任何資源', getActiveClassResources({}), []);
check('兼職：死靈術士 + 商人 -> 兩個資源',
  getActiveClassResources(mkChar([NECRO, MERCHANT])).map((r) => r.id), ['gravePoints', 'tradePoints']);
check('技能 SL 為 0 時不出現',
  getActiveClassResources(mkChar([{ className: '死靈術士', skills: [{ name: '超越死界', sl: 0 }] }])), []);

// ─────────────────────────────────────────────────────────── C
section('C. 上限公式（逐字核對原書）');
check('墳墓點 SL3 -> 上限 4（SL+1）', getActiveClassResources(mkChar([NECRO]))[0].max, 4);
check('貿易點數 SL2 -> 上限 5（SL+3）', getActiveClassResources(mkChar([MERCHANT]))[0].max, 5);
check('墳墓點 SL5 -> 上限 6',
  getActiveClassResources(mkChar([{ className: '死靈術士', skills: [{ name: '超越死界', sl: 5 }] }]))[0].max, 6);
check('貿易點數 SL5 -> 上限 8',
  getActiveClassResources(mkChar([{ className: '商人', skills: [{ name: '貿易之風', sl: 5 }] }]))[0].max, 8);
check('幸運數字無上限', getActiveClassResources(mkChar([ENTROPIST]))[0].max, null);
check('幸運數字初始值 7', getActiveClassResources(mkChar([ENTROPIST]))[0].initial, 7);

// ─────────────────────────────────────────────────────────── D
section('D. readResource：缺值時的預設');
const gp = getActiveClassResources(mkChar([NECRO]))[0];       // max 4
const tp = getActiveClassResources(mkChar([MERCHANT]))[0];    // max 5
const ln = getActiveClassResources(mkChar([ENTROPIST]))[0];   // initial 7
check('池：未設定 -> 0', readResource(mkChar([NECRO]), gp), 0);
check('池：有值 -> 原值', readResource(mkChar([NECRO], { gravePoints: 2 }), gp), 2);
check('池：超出上限 -> 夾到上限', readResource(mkChar([NECRO], { gravePoints: 99 }), gp), 4);
check('單值：未設定 -> 初始 7', readResource(mkChar([ENTROPIST]), ln), 7);
check('單值：有值 -> 原值', readResource(mkChar([ENTROPIST], { luckyNumber: 13 }), ln), 13);
check('單值：0 視為無效 -> 回到 7', readResource(mkChar([ENTROPIST], { luckyNumber: 0 }), ln), 7);
check('null 角色 -> 池為 0', readResource(null, gp), 0);
check('null 角色 -> 單值為初始', readResource(null, ln), 7);

// ─────────────────────────────────────────────────────────── E
section('E. clampResource：夾值規則');
check('池：負數 -> 0', clampResource(gp, -5), 0);
check('池：超上限 -> 上限', clampResource(gp, 10), 4);
check('池：正常值', clampResource(gp, 3), 3);
check('池：非數字 -> 0', clampResource(gp, 'abc'), 0);
check('單值：0 -> 1（幸運數字不會是 0）', clampResource(ln, 0), 1);
check('單值：負數 -> 1', clampResource(ln, -3), 1);
check('單值：超過 20 仍允許（原書明示可產生不可能的結果）', clampResource(ln, 25), 25);
check('單值：非數字 -> 初始 7', clampResource(ln, 'abc'), 7);

// ─────────────────────────────────────────────────────────── F
section('F. setResourceValue：不可變更新');
const before = mkChar([NECRO], { gravePoints: 1 });
const after = setResourceValue(before, gp, 3);
check('新值正確', after.gravePoints, 3);
check('原物件未被修改', before.classResources.gravePoints, 1);
check('不會覆蓋其他資源', setResourceValue(mkChar([NECRO], { gravePoints: 1, tradePoints: 2 }), gp, 3).tradePoints, 2);
check('classResources 缺失時可建立', setResourceValue(mkChar([NECRO]), gp, 2).gravePoints, 2);
check('夾值生效', setResourceValue(mkChar([NECRO]), gp, 99).gravePoints, 4);

// ─────────────────────────────────────────────────────────── G
section('G. 設定完整性（防止新增資源時漏欄位）');
for (const r of CLASS_RESOURCES) {
  // 2026-10-06：資源的「啟用條件」有三種——職業技能（className＋skillName）、
  // 英雄技能（heroicName）、金手指（quirkName）。三者取其一即可。
  const hasGate = !!(r.className && r.skillName) || !!r.heroicName || !!r.quirkName;
  const ok = !!(r.id && r.kind && hasGate && r.label && r.source);
  check(`${r.id || '(未命名)'} 欄位齊備`, ok, true);
  check(`${r.id} kind 合法`, ['pool', 'value'].includes(r.kind), true);
  // 有 resetLabel 就必須有 resetTo（反之亦然）——避免出現按了沒作用的按鈕
  check(`${r.id} resetLabel/resetTo 成對`,
    (r.resetLabel === null) === (r.resetTo === null), true);
}
// 3（墳墓點／貿易點數／幸運數字）＋ 8（英雄技能 3 ＋ 金手指 5，2026-10-06）
check('資源總數 = 11', CLASS_RESOURCES.length, 11);
check('每個資源都有官方出處', CLASS_RESOURCES.every((r) => /p\.\d+/.test(r.source)), true);

// ─────────────────────────────────────────────────────────── H
section('H. 重置按鈕必須對應原書真實存在的規則');
// 墳墓點：原書「When you are reduced to 0 Hit Points, you lose all Grave Points」→ 有清空時機
const gpDef = CLASS_RESOURCES.find((r) => r.id === 'gravePoints');
check('墳墓點有重置按鈕', !!gpDef.resetLabel, true);
check('墳墓點重置為 0', gpDef.resetTo, 0);
// 貿易點數：原書沒有任何「清空」規則 → 不該有按鈕
const tpDef = CLASS_RESOURCES.find((r) => r.id === 'tradePoints');
check('貿易點數無重置按鈕（原書無此規則）', tpDef.resetLabel, null);
// 幸運數字：原書「at the start of each session, that number is 7」→ 有重置
const lnDef = CLASS_RESOURCES.find((r) => r.id === 'luckyNumber');
check('幸運數字有重置按鈕', !!lnDef.resetLabel, true);
check('幸運數字重置為 7', lnDef.resetTo, 7);
check('幸運數字 resetTo 等於 initial', lnDef.resetTo, lnDef.initial);

// ─────────────────────────────────────────────────────────── I
section('I. 貿易點數起點 2 點（playtest P4 的 F-019）');
// 原書 Natural Fantasy p.159：「If you gain this Skill at character creation,
// you start the game with 2 Trade Points.」
// → 這是**開卡時的起點**，不是每次聚會的重置值，所以住 `initial` 不住 `resetTo`。
check('定義裡標了 initial: 2', tpDef.initial, 2);
check('起點不是用 resetTo 表達（原書沒有清空規則）', tpDef.resetTo, null);
// bug 的成因：`initial` 原本只傳給單值型，池型一律變成 null，
// 於是商人一輩子顯示 0 點，玩家只能自己記在紙上。
check('池型資源也要把 initial 傳出來（不是 null）', tp.initial, 2);
check('沒有 initial 的池仍為 null（墳墓點不該憑空長出起點）', gp.initial, null);

// 讀取：分清楚「沒填過」與「填成 0」
check('商人從未記過 -> 2（不是 0）', readResource(mkChar([MERCHANT]), tp), 2);
check('記成 0 -> 就是 0（花光了不會復活成 2）',
  readResource(mkChar([MERCHANT], { tradePoints: 0 }), tp), 0);
check('記成 3 -> 3', readResource(mkChar([MERCHANT], { tradePoints: 3 }), tp), 3);
check('超過上限 -> 夾到上限 5', readResource(mkChar([MERCHANT], { tradePoints: 99 }), tp), 5);
check('起點本身也夾在上限內（SL 若被改小也不會超過）',
  readResource(mkChar([MERCHANT]), { ...tp, max: 1 }), 1);
// 修 F-019 不能順手把別的池一起改成 2
check('墳墓點從未記過仍是 0（沒被順手改壞）', readResource(mkChar([NECRO]), gp), 0);

// 寫入：非數字時退回起點，不是硬性 0
check('池：非數字 -> 退回起點 2', clampResource(tp, 'abc'), 2);
check('池：負數 -> 0（花到 0 是合法的，不是錯誤輸入）', clampResource(tp, -5), 0);
check('池：正常值', clampResource(tp, 4), 4);
check('池：超過上限 -> 5', clampResource(tp, 99), 5);
check('沒有起點的池：非數字仍是 0（沒被順手改壞）', clampResource(gp, 'abc'), 0);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
