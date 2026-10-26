/**
 * P1 探測：二十個規則情境的資料層斷言（C 類，不開瀏覽器）
 *
 * 目的：把 `00-plan.md` §14.4 的 5 條斷言裡「能在資料層驗的」先驗掉，
 * 只把「畫面顯示與資料是否一致」留給 A 類（瀏覽器）。
 *
 * 用法：
 *   node node_modules/esbuild/bin/esbuild scripts/p1-rule-states.mjs --bundle \
 *     --platform=node --format=esm --loader:.json=json \
 *     --outfile=scratch/p1-rule-states.build.mjs --log-level=error
 *   node scratch/p1-rule-states.build.mjs
 */
import {
  resolveCreationRules,
  diffCreationRules
} from '../src/features/character-sheet/data/creationRules.js';
import { createNewCharacter, validateCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import {
  TECHNOSPHERE_MODE_KEYS,
  isTechnosphereEnabled,
  modeRestrictsEquipment,
  modeHasMnemospheres,
  modeHasHoplospheres,
  modeGrantsInnateBonus,
  modeGrantsMartialWeaponProficiency,
  modeAllowsDeltaSlot
} from '../src/features/character-sheet/data/technospheres.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json' with { type: 'json' };

// ── §14.9 的真值表（文件裡寫的那張），用來對照實際函式 ──
const EXPECTED = {
  off: [0, 0, 0, 0, 0, 0, 0],
  full: [1, 1, 1, 1, 1, 1, 1],
  integrated: [1, 1, 1, 1, 1, 1, 0],
  mnemospheresOnly: [1, 0, 1, 0, 1, 0, 1],
  hoplospheresOnly: [1, 1, 0, 1, 0, 1, 0]
};

const COLS = [
  ['職業鎖3', isTechnosphereEnabled],
  ['裝備白名單', modeRestrictsEquipment],
  ['職業魔石', modeHasMnemospheres],
  ['附魔魔石', modeHasHoplospheres],
  ['+5 HP/MP', modeGrantsInnateBonus],
  ['武器熟練', modeGrantsMartialWeaponProficiency],
  ['δ 品級', modeAllowsDeltaSlot]
];

const fails = [];
const blankErrorCounts = [];
const notes = [];
const fail = (id, msg) => fails.push(`[${id}] ${msg}`);

// ── A2：真值表逐格比對 ──
for (const mode of TECHNOSPHERE_MODE_KEYS) {
  const actual = COLS.map(([, fn]) => (fn(mode) ? 1 : 0));
  const exp = EXPECTED[mode];
  if (!exp) {
    fail('A2', `真值表缺 ${mode} 這一列`);
    continue;
  }
  actual.forEach((v, i) => {
    if (v !== exp[i]) fail('A2', `${mode} × ${COLS[i][0]}：文件寫 ${exp[i]}，函式回 ${v}`);
  });
}

// ── 20 組情境 ──
const combos = [];
let n = 0;
for (const mode of TECHNOSPHERE_MODE_KEYS) {
  for (const zp of [false, true]) {
    for (const camp of [false, true]) {
      n += 1;
      combos.push({ id: `R${String(n).padStart(2, '0')}`, mode, zeroPowers: zp, campActivities: camp });
    }
  }
}

const shieldName = rulesData.equipment.shields?.[0]?.name || '圓盾';


for (const c of combos) {
  const given = { technospheres: c.mode, zeroPowers: c.zeroPowers, campActivities: c.campActivities };
  const rules = resolveCreationRules(given);

  // A1：職業數鎖 3（所有非 off 的模式）
  const locked = rules.classCountMin === 3 && rules.classCountMax === 3;
  if (isTechnosphereEnabled(c.mode) && !locked) {
    fail(c.id, `職業數未鎖 3（min=${rules.classCountMin}, max=${rules.classCountMax}）`);
  }
  if (!isTechnosphereEnabled(c.mode) && locked) {
    fail(c.id, 'off 模式卻鎖了職業數 3');
  }

  // A5：diff 不得含職業數（那兩格是派生值，不該進 diff）
  const diff = diffCreationRules(given);
  const diffList = Array.isArray(diff) ? diff : Object.keys(diff || {});
  if (diffList.includes('classCountMin') || diffList.includes('classCountMax')) {
    fail(c.id, `diff 含派生欄位：${diffList.join(',')}`);
  }

  // A3：空卡驗證——**不比對文案**（那會變成「照著答案寫測試」），只比對
  //     「阻斷型 error 的條數是否與 off 基準一致」。空卡的完成度不該因規則而變。
  const blank = createNewCharacter({}, rules);
  const v = validateCharacter(blank, rules);
  const list = Array.isArray(v) ? v : (v?.warnings || v?.issues || []);
  const errors = list.filter((w) => w.type === 'error');
  blankErrorCounts.push({ id: c.id, mode: c.mode, count: errors.length, msgs: errors.map((w) => w.message) });

  // A4：污染測試——**守護者 ＋【雙重盾牌】＋ 主手盾牌**，這是唯一能繞過一般規則的組合。
  //     在 off 下合法；切到「裝備白名單」模式後盾牌應該不存在，且技能應被標「已作廢」。
  const guardian = {
    ...blank,
    classes: [{ name: '守護者', level: 5, skills: [{ name: '雙重盾牌', sl: 1 }] }],
    equipment: { ...(blank.equipment || {}), mainHand: shieldName, offHand: shieldName },
    creationRules: given
  };
  const gv = validateCharacter(guardian, rules);
  const glist = Array.isArray(gv) ? gv : (gv?.warnings || gv?.issues || []);
  const shieldComplaint = glist.filter((w) => /盾/.test(w.message || ''));
  const deadComplaint = glist.filter((w) => /作廢/.test(w.message || ''));
  notes.push({
    id: c.id,
    mode: c.mode,
    restricts: modeRestrictsEquipment(c.mode),
    shield: shieldComplaint.map((w) => `${w.type}:${w.message}`),
    dead: deadComplaint.map((w) => `${w.type}:${w.message}`)
  });
}

// ── 報告 ──
console.log('=== 真值表（實跑） ===');
console.log('| 模式 | ' + COLS.map((c) => c[0]).join(' | ') + ' |');
for (const mode of TECHNOSPHERE_MODE_KEYS) {
  console.log('| ' + mode + ' | ' + COLS.map(([, fn]) => (fn(mode) ? '✓' : '✕')).join(' | ') + ' |');
}

console.log('\n=== A1／A5：20 組 ===');
console.log(fails.length ? fails.join('\n') : '全部通過');

console.log('\n=== A3：空卡的阻斷型 error 條數（應與 off 基準一致） ===');
const base = blankErrorCounts.find((b) => b.mode === 'off')?.count;
for (const b of blankErrorCounts) {
  const flag = b.count === base ? '  ' : '※ ';
  console.log(`${flag}${b.id} ${b.mode.padEnd(18)} error=${b.count}` + (b.count === base ? '' : `  ${b.msgs.join(' ｜ ')}`));
}
console.log(`（off 基準 = ${base}）`);

console.log('\n=== A4：守護者＋雙重盾牌＋主手盾牌，切到各模式後 ===');
const byMode = {};
for (const n2 of notes) {
  byMode[n2.mode] = byMode[n2.mode] || { restricts: n2.restricts, shield: 0, dead: 0, total: 0, sample: '' };
  byMode[n2.mode].total += 1;
  if (n2.shield.length) byMode[n2.mode].shield += 1;
  if (n2.dead.length) byMode[n2.mode].dead += 1;
  if (!byMode[n2.mode].sample) byMode[n2.mode].sample = n2.dead[0] || n2.shield[0] || '（沒有任何盾牌相關訊息）';
}
for (const [mode, s] of Object.entries(byMode)) {
  console.log(
    `${mode.padEnd(18)} 白名單=${s.restricts ? '是' : '否'}  盾牌被擋 ${s.shield}/${s.total}  標「已作廢」 ${s.dead}/${s.total}`
  );
  console.log(`   例：${s.sample}`);
}

console.log('\n=== 總結 ===');
console.log(`失敗 ${fails.length} 條`);
