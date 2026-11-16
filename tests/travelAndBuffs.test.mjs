/**
 * W6/W8 旅行骰與跨角色暫存增益純函式測試（對齊官方英文原書規則）
 *
 * 執行：npm run test:travelbuffs
 */
import assert from 'node:assert/strict';
import {
  resolveTravelDie,
  dieSides,
  evalTravelRoll,
  applyTravelOutcome
} from '../src/features/character-sheet/utils/travelRoll.js';
import {
  getPendingBuffs,
  addPendingBuff,
  removePendingBuff,
  clearPendingBuffs,
  clearScenePendingBuffs,
  arcaneWeaponStatus,
  applySupportMagic,
  applyIBelieveInYou,
  applySmoothTalker,
  applyCompressionTechnique
} from '../src/features/character-sheet/utils/pendingBuffs.js';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, ok, detail = '') => {
  if (ok) pass += 1;
  else fail += 1;
  lines.push(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  —— ${detail}` : ''}`);
};

const baseStats = { maxHp: 50, maxMp: 50, maxIp: 6 };

// ── A. 通曉道路骰階降階（Core p.217：降低一階，最低 d6，不疊加） ──
check('A1 通曉道路 SL0 維持原威脅骰 d10', resolveTravelDie('d10', 0) === 'd10', resolveTravelDie('d10', 0));
check('A2 通曉道路將 d20 降至 d12', resolveTravelDie('d20', 1) === 'd12', resolveTravelDie('d20', 1));
check('A3 通曉道路將 d12 降至 d10', resolveTravelDie('d12', 1) === 'd10', resolveTravelDie('d12', 1));
check('A4 通曉道路將 d10 降至 d8', resolveTravelDie('d10', 1) === 'd8', resolveTravelDie('d10', 1));
check('A5 通曉道路將 d8 降至 d6', resolveTravelDie('d8', 1) === 'd6', resolveTravelDie('d8', 1));
check('A6 通曉道路遇到 d6 維持最低 d6', resolveTravelDie('d6', 1) === 'd6', resolveTravelDie('d6', 1));
check('A7 通曉道路不疊加（SL 2 仍只降一階）', resolveTravelDie('d20', 2) === 'd12', resolveTravelDie('d20', 2));
check('A8 dieSides 正確轉回數值', dieSides('d12') === 12 && dieSides('d20') === 20, '12, 20');

// ── B. 旅行骰結算（Core p.106-107, p.217 & NF p.149-150） ──
const dangerRoll = evalTravelRoll({ roll: 6, die: 'd8', wellPreparedSL: 2, treasureHunterSL: 2 });
check('B1 旅行骰擲出 6 為遭遇危險（6 或更高）', dangerRoll.isDanger === true && dangerRoll.isDiscovery === false && dangerRoll.ipGain === 2, `${dangerRoll.outcomeLabel}, +${dangerRoll.ipGain} IP`);

const roll1NoHunter = evalTravelRoll({ roll: 1, die: 'd6', treasureHunterSL: 0 });
const roll2NoHunter = evalTravelRoll({ roll: 2, die: 'd6', treasureHunterSL: 0 });
check('B2 無寶藏獵人時僅擲出 1 獲發現（擲 2 為平安）',
  roll1NoHunter.isDiscovery === true && roll2NoHunter.isDiscovery === false && roll2NoHunter.isCalm === true,
  '1=發現, 2=平安');

const rollTreasure = evalTravelRoll({
  roll: 3,
  die: 'd8',
  treasureHunterSL: 2,
  wellPreparedSL: 3,
  prepareDelicaciesSL: 2,
  cookingSL: 1,
  tasteRolls: [1, 2, 4, 6],
  chosenTaste: '鮮味'
});
check('B3 寶藏獵人 SL2 使擲出 3（≤ SL+1）亦獲得發現',
  rollTreasure.isDiscovery === true && rollTreasure.discoveryThreshold === 3 && rollTreasure.isDanger === false,
  `門檻 ${rollTreasure.discoveryThreshold}`);
check('B4 有備無患 SL3 + 準備食材 SL2（有烹飪）產出 +3 IP 與 4 份扁平食材',
  rollTreasure.ipGain === 3
  && rollTreasure.ingredientGain === 4
  && rollTreasure.newIngredients.length === 4
  && rollTreasure.newIngredients.map((it) => it.taste).join(',') === '苦味,鹹味,甜味,鮮味',
  rollTreasure.newIngredients.map((it) => it.taste).join(','));

const noCookingRoll = evalTravelRoll({ roll: 4, die: 'd6', prepareDelicaciesSL: 3, cookingSL: 0 });
check('B5 未習得【烹飪】時準備食材不會產生食材並給阻擋原因',
  noCookingRoll.ingredientGain === 0 && noCookingRoll.newIngredients.length === 0 && Boolean(noCookingRoll.blockedPrepareReason),
  noCookingRoll.blockedPrepareReason);

const preIngs = Array.from({ length: 13 }, (_, idx) => ({ id: `old_${idx}`, name: '舊食材', taste: '苦味' }));
const explorerChar = {
  name: '阿爾伯特',
  currentIp: 4,
  classes: [{ className: '美食家', level: 2, skills: [{ name: '烹飪', sl: 1 }, { name: '準備食材', sl: 2 }] }],
  gourmetData: { ingredients: preIngs, cookbook: {} }
};
const appliedTravel = applyTravelOutcome(explorerChar, rollTreasure, baseStats);
check('B6 applyTravelOutcome 正確恢復並夾制 IP 至 maxIp（4 + 3 -> 6）且扁平追加不爆背包上限（13 + 4 -> 15）',
  appliedTravel.ok
  && appliedTravel.character.currentIp === 6
  && appliedTravel.ipDelta === 2
  && appliedTravel.character.gourmetData.ingredients.length === 15
  && appliedTravel.addedIngredients.length === 2
  && appliedTravel.discardedIngredients.length === 2
  && !Array.isArray(appliedTravel.character.gourmetData.ingredients[0]),
  `IP=${appliedTravel.character.currentIp}, 食材=${appliedTravel.character.gourmetData.ingredients.length}`);

// ── C. 暫存增益佇列操作與場景清空 ──
let hero = {
  name: '靈魂旅者',
  pendingBuffs: [],
  currentHp: 40,
  currentMp: 50,
  currentIp: 4,
  fabulaPoints: 2,
  equipment: { mainHand: '法杖', offHand: '', armor: '' },
  bonds: [
    { id: 'b_valkyrie', target: '瓦爾基麗', feelings: ['欽佩', '忠誠', '喜愛'] },
    { id: 'b_celty', target: '塞爾提', feelings: ['信任'] }
  ],
  clocks: [
    { id: 'clk_treaty', title: '達成停戰協議', filledSegments: 2, totalSegments: 6 }
  ],
  classes: [
    { className: '靈師', level: 2, skills: [{ name: '支援魔法', sl: 1 }] },
    { className: '吟唱者', level: 3, skills: [{ name: '我相信你', sl: 2 }, { name: '能言善辯', sl: 2 }] },
    { className: '機師', level: 1, skills: [{ name: '壓縮技術', sl: 1 }] }
  ],
  pilotVehicle: {
    name: '赤紅騎士',
    frameId: 'mecha',
    isMounted: true,
    inWorld: true,
    activeModules: []
  }
};

const resAddScene = addPendingBuff(hero, { sourceSkill: '測試', targetName: '艾倫', effectDesc: '+1 檢定', scope: 'scene' });
const resAddPersist = addPendingBuff(resAddScene.character, { sourceSkill: '長期', targetName: '艾倫', effectDesc: '持久效果', scope: 'persistent' });
check('C1 成功新增場景與長期兩筆增益', getPendingBuffs(resAddPersist.character).length === 2, '2 筆');
const resDelOne = removePendingBuff(resAddPersist.character, resAddScene.buff.id);
check('C2 成功移除單筆增益', getPendingBuffs(resDelOne.character).length === 1, '餘 1 筆');
const afterSceneClear = clearScenePendingBuffs(resAddPersist.character);
check('C3 clearScenePendingBuffs 只清空場景增益、保留長期增益',
  getPendingBuffs(afterSceneClear).length === 1 && getPendingBuffs(afterSceneClear)[0].scope === 'persistent',
  '保留長期');
const resClearAll = clearPendingBuffs(afterSceneClear);
check('C4 clearPendingBuffs 全數清空', getPendingBuffs(resClearAll.character).length === 0, '0 筆');

// ── D. 靈師【支援魔法】／吟唱者【我相信你】／【能言善辯】／機師【壓縮技術】 ──
// D1 支援魔法（Core p.207）：0 MP + 奧術武器 + 羈絆強度
const unarmedChar = { ...hero, equipment: { mainHand: '青銅劍', offHand: '', armor: '' }, pilotVehicle: { ...hero.pilotVehicle, isMounted: false } };
const supBlockedNoArcane = applySupportMagic(unarmedChar, { bondId: 'b_valkyrie' });
check('D1 未裝備奧術武器時阻擋【支援魔法】', supBlockedNoArcane.ok === false, supBlockedNoArcane.reason);

const supBlockedNoBond = applySupportMagic(hero, { targetName: '路人甲' });
check('D2 對無羈絆目標阻擋【支援魔法】', supBlockedNoBond.ok === false, supBlockedNoBond.reason);

const resSup = applySupportMagic(hero, { bondId: 'b_valkyrie' });
check('D3 支援魔法成功（0 MP，取羈絆強度 +3）',
  resSup.ok
  && resSup.character.currentMp === 50
  && resSup.outcome.mpCost === 0
  && resSup.outcome.bonus === 3
  && getPendingBuffs(resSup.character).length === 1
  && resSup.buff.effectDesc.includes('+3'),
  `MP=${resSup.character.currentMp}, +${resSup.outcome.bonus}`);

const pilotArcaneHero = {
  ...unarmedChar,
  pilotVehicle: { frameId: 'exoskeleton', isMounted: true, inWorld: true, activeModules: ['arcane_module'] }
};
check('D3b 駕駛啟用奧術模組之個人載具亦視同裝備奧術武器',
  arcaneWeaponStatus(pilotArcaneHero) === 'true' && applySupportMagic(pilotArcaneHero, { bondId: 'b_celty' }).ok === true,
  '載具奧術模組通過');

// D4 我相信你（Core p.201）：花費 1 點物語點，若具備羈絆目標額外回 SL×10 MP
const zeroFpChar = { ...resSup.character, fabulaPoints: 0 };
const believeBlocked = applyIBelieveInYou(zeroFpChar, { targetName: '塞爾提', sl: 2 });
check('D4 物語點為 0 時阻擋【我相信你】', believeBlocked.ok === false, believeBlocked.reason);

const resBelieveBonded = applyIBelieveInYou(resSup.character, { targetName: '塞爾提', sl: 2, traitOrBond: '守護之心' });
check('D5 我相信你（有羈絆、SL2）消耗 1 FP（2 -> 1）並標註回 20 MP',
  resBelieveBonded.ok
  && resBelieveBonded.character.fabulaPoints === 1
  && resBelieveBonded.character.currentMp === 50
  && resBelieveBonded.outcome.fpCost === 1
  && resBelieveBonded.outcome.allyMpRecovery === 20
  && getPendingBuffs(resBelieveBonded.character).length === 2,
  `FP=${resBelieveBonded.character.fabulaPoints}, allyMP=+${resBelieveBonded.outcome.allyMpRecovery}`);

const resBelieveUnbonded = applyIBelieveInYou(resBelieveBonded.character, { targetName: '阿爾弗雷德', sl: 2 });
check('D6 我相信你（無羈絆時）消耗 1 FP（1 -> 0），目標回 MP 為 0',
  resBelieveUnbonded.ok
  && resBelieveUnbonded.character.fabulaPoints === 0
  && resBelieveUnbonded.outcome.hasBond === false
  && resBelieveUnbonded.outcome.allyMpRecovery === 0,
  `FP=${resBelieveUnbonded.character.fabulaPoints}`);

// D7 能言善辯（Core p.201）：每花 20 MP 額外填滿／清除 1 格（上限 SL）
const smoothExceed = applySmoothTalker(resBelieveUnbonded.character, { ticks: 2, sl: 1 }, baseStats);
check('D7 能言善辯 SL1 要求 2 格時拒絕', smoothExceed.ok === false, smoothExceed.reason);

const smoothLowMp = applySmoothTalker({ ...resBelieveUnbonded.character, currentMp: 35 }, { ticks: 2, sl: 2 }, baseStats);
check('D8 MP 不足 40 時拒絕【能言善辯】2 格', smoothLowMp.ok === false, smoothLowMp.reason);

const resSmoothFill = applySmoothTalker(resBelieveUnbonded.character, { ticks: 2, sl: 2, clockId: 'clk_treaty', clockAction: 'fill', approach: '外交' }, baseStats);
check('D9 能言善辯（SL2, 2 格）扣除 40 MP（50 -> 10）並將個人命刻推進 2 -> 4',
  resSmoothFill.ok
  && resSmoothFill.character.currentMp === 10
  && resSmoothFill.outcome.mpCost === 40
  && resSmoothFill.outcome.clockAdvance === 2
  && resSmoothFill.character.clocks[0].filledSegments === 4,
  `MP=${resSmoothFill.character.currentMp}, clock=${resSmoothFill.character.clocks[0].filledSegments}/6`);

// D10 機師壓縮技術（TF p.159 & p.165）：無人駕駛 0 IP 收納；2 IP（外骨骼 0 IP）召喚並免費進入
const stowBlockedMounted = applyCompressionTechnique(resSmoothFill.character, { action: 'stow' }, baseStats);
check('D10 載具仍有人駕駛（isMounted=true）時阻擋收納', stowBlockedMounted.ok === false, stowBlockedMounted.reason);

const unmountedHero = {
  ...resSmoothFill.character,
  pilotVehicle: { ...resSmoothFill.character.pilotVehicle, isMounted: false, inWorld: true }
};
const resStow = applyCompressionTechnique(unmountedHero, { action: 'stow' }, baseStats);
check('D11 無人駕駛時【壓縮技術】收納花費 0 IP，將載具移出世界（inWorld=false）',
  resStow.ok
  && resStow.character.currentIp === 4
  && resStow.outcome.ipCost === 0
  && resStow.character.pilotVehicle.inWorld === false
  && resStow.character.pilotVehicle.isMounted === false,
  `IP=${resStow.character.currentIp}, inWorld=${resStow.character.pilotVehicle.inWorld}`);

const summonLowIp = applyCompressionTechnique({ ...resStow.character, currentIp: 1 }, { action: 'summon' }, baseStats);
check('D12 一般載具僅剩 1 IP 時阻擋召喚（需要 2 IP）', summonLowIp.ok === false, summonLowIp.reason);

const resSummonStride = applyCompressionTechnique(resStow.character, { action: 'summon' }, baseStats);
check('D13 一般載具召喚消耗 2 IP（4 -> 2）並免費進入駕駛（inWorld=true, isMounted=true）',
  resSummonStride.ok
  && resSummonStride.character.currentIp === 2
  && resSummonStride.outcome.ipCost === 2
  && resSummonStride.character.pilotVehicle.inWorld === true
  && resSummonStride.character.pilotVehicle.isMounted === true,
  `IP=${resSummonStride.character.currentIp}, mounted=${resSummonStride.character.pilotVehicle.isMounted}`);

const exoStowed = {
  ...resStow.character,
  currentIp: 0,
  pilotVehicle: { ...resStow.character.pilotVehicle, frameId: 'exoskeleton' }
};
const resSummonExo = applyCompressionTechnique(exoStowed, { action: 'summon' }, baseStats);
check('D14 外骨骼骨架即使 0 IP 亦可免費召喚並進入駕駛',
  resSummonExo.ok
  && resSummonExo.character.currentIp === 0
  && resSummonExo.outcome.ipCost === 0
  && resSummonExo.character.pilotVehicle.inWorld === true
  && resSummonExo.character.pilotVehicle.isMounted === true,
  `IP=${resSummonExo.character.currentIp}, cost=${resSummonExo.outcome.ipCost}`);

for (const line of lines) console.log(line);
console.log(`\n  通過 ${pass} / ${pass + fail}${fail ? `　失敗 ${fail}` : '　（全部通過）'}`);
if (fail > 0) process.exit(1);
assert.equal(fail, 0);
