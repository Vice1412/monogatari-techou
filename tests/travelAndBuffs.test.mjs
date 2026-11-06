import {
  resolveTravelDie,
  evalTravelRoll,
  applyTravelOutcome
} from '../src/features/character-sheet/utils/travelRoll.js';
import {
  getPendingBuffs,
  addPendingBuff,
  removePendingBuff,
  clearPendingBuffs,
  applySupportMagic,
  applyIBelieveInYou,
  applySmoothTalker,
  applyCompressionTechnique
} from '../src/features/character-sheet/utils/pendingBuffs.js';

let results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: detail || (ok ? '通過' : '失敗') });
};

// ── A. 旅行骰階換算（通曉道路）──
check('A1 SL 0 為預設 d6', resolveTravelDie(0) === 'd6', 'd6');
check('A2 SL 1 升為 d8', resolveTravelDie(1) === 'd8', 'd8');
check('A3 SL 2 升為 d10', resolveTravelDie(2) === 'd10', 'd10');
check('A4 SL 3 升為 d12', resolveTravelDie(3) === 'd12', 'd12');

// ── B. 旅行骰結果評估（有備無患、寶藏獵人、準備食材）──
const rollDanger = evalTravelRoll({ roll: 1, die: 'd8', wellPreparedSL: 2 });
check('B1 擲出 1 判定為危險且可重擲（有備無患）', rollDanger.isDanger && rollDanger.canReroll, '可重擲');

const rollDangerNoReroll = evalTravelRoll({ roll: 1, die: 'd8', wellPreparedSL: 0 });
check('B2 無有備無患時不可重擲', rollDangerNoReroll.isDanger && !rollDangerNoReroll.canReroll, '不可重擲');

const rollTreasure = evalTravelRoll({ roll: 7, die: 'd10', treasureHunterSL: 3, prepareDelicaciesSL: 2 });
check('B3 擲出 ≥6 觸發寶藏獵人獲得 SL*100z（300z）', rollTreasure.hasTreasure && rollTreasure.zenitGain === 300, '300z');
check('B4 觸發準備食材獲得 SL*2 份食材（4 份）', rollTreasure.ingredientGain === 4, '4 份');

const charWithTravel = applyTravelOutcome({ zenit: 100 }, rollTreasure);
check('B5 結算金幣成功入帳（100 + 300 = 400z）', charWithTravel.zenit === 400, '400z');

// ── C. 暫存增益表基礎操作 ──
let hero = { pendingBuffs: [], currentMp: 30, currentIp: 5 };
const resAdd = addPendingBuff(hero, { sourceSkill: '支援魔法', targetName: '雷恩', effectDesc: '下次檢定 +2' });
check('C1 成功新增暫存增益', resAdd.ok && resAdd.character.pendingBuffs.length === 1, '1 筆');
hero = resAdd.character;

const buffId = hero.pendingBuffs[0].id;
const resDel = removePendingBuff(hero, buffId);
check('C2 成功移除單筆暫存增益', resDel.ok && resDel.character.pendingBuffs.length === 0, '清空');
hero = resDel.character;

// ── D. 技能動作（支援魔法、我相信你、能言善辯、壓縮技術）──
hero.currentMp = 30;
hero.currentIp = 5;

// 1. 支援魔法：花 5 MP
const resSup = applySupportMagic(hero, { targetName: '瓦爾基麗' }, 2);
check('D1 支援魔法成功扣除 5 MP（30 -> 25）並登記增益', resSup.ok && resSup.character.currentMp === 25 && resSup.character.pendingBuffs.length === 1, '25 MP');
hero = resSup.character;

// 2. 我相信你：花 5 MP
const resBelieve = applyIBelieveInYou(hero, { targetName: '塞爾提' });
check('D2 我相信你成功扣除 5 MP（25 -> 20）並登記增益', resBelieve.ok && resBelieve.character.currentMp === 20 && resBelieve.character.pendingBuffs.length === 2, '20 MP');
hero = resBelieve.character;

// 3. 能言善辯：花 10 MP 推進 1 格命刻
const resSmooth = applySmoothTalker(hero);
check('D3 能言善辯成功扣除 10 MP（20 -> 10）並推進命刻', resSmooth.ok && resSmooth.character.currentMp === 10 && resSmooth.outcome.clockAdvance === 1, '10 MP, 1 格');
hero = resSmooth.character;

// 4. 壓縮技術：花 2 IP 收納載具
const resComp = applyCompressionTechnique(hero);
check('D4 壓縮技術成功扣除 2 IP（5 -> 3）並切換壓縮狀態', resComp.ok && resComp.character.currentIp === 3 && resComp.character.pilotVehicle.isCompressed === true, '3 IP, 壓縮');

// MP 不足時被擋
hero.currentMp = 2;
const resBlocked = applySupportMagic(hero, { targetName: '雷恩' });
check('D5 MP 不足 5 點時支援魔法被擋', !resBlocked.ok && resBlocked.reason.includes('MP 不足'), resBlocked.reason);

// ── 輸出 ──
const fails = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  —— ${r.detail}`);
}
console.log(`\n  通過 ${results.length - fails.length} / ${results.length}`);
if (fails.length > 0) process.exit(1);
