/**
 * 卡牌大師（Ace of Cards）測試。
 *
 * 執行：npm run test:cards
 *
 * 全部期望值取自官方特典合輯 **p.7–p.11**（印刷頁碼，該書偏移為 0）。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SUITS,
  SUIT_KEYS,
  CARDS_PER_SUIT,
  JOKER_COUNT,
  DECK_SIZE,
  STARTING_HAND,
  MAX_SET_SIZE,
  MAX_VANGUARD,
  DAMAGE_TYPES,
  DEFAULT_SUIT_TYPES,
  isValidSuitAssignment,
  createDeck,
  shuffle,
  drawCards,
  cardLabel,
  suitByKey,
  suitName,
  expandJokers,
  detectSets,
  isValidSet,
  levelDamageBonus,
  maxSetSizeForSL,
  mpCostForSet,
  maxMpForSL,
  SET_EFFECTS,
  highOrLowState,
  hasHighOrLowState,
  mulliganLimit,
  pickMulligan,
  TRAP_ACTIONS,
  trapDiscardLimit,
  trapSpellMpCap,
  isTrapEligible,
  eligibleTrapCards,
  pickTrapDiscard,
  spellMpCost,
  castableTrapSpells,
  selfBenefitForEffect,
  FULL_STATUS_CHOICES,
  emptyTurnUsage,
  applyJokerAssignment,
  isFullyAssigned,
  suggestJokerAssignment,
  isDeckInConflict,
  idleDeckState
} from '../src/features/character-sheet/data/aceOfCardsData.js';

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
const checkTrue = (label, cond) => check(label, !!cond, true);

/** 造牌的小工具。 */
const C = (suit, value) => ({ id: `${suit}_${value}`, suit, value, joker: false });
const J = (n = 1) => ({ id: `joker_${n}`, suit: null, value: null, joker: true });

/** 取符合的效果 id 清單。 */
const ids = (cards, level = 1, opts = {}) => detectSets(cards, level, opts).map((s) => s.id);

// ─────────────────────────────────────────────────────────── A
section('A. 花色（原書 p.9 建議對應）');
check('共 4 花色', SUITS.length, 4);
check('花色鍵', SUIT_KEYS, ['diamond', 'club', 'heart', 'spade']);
check('方塊 -> 風', suitByKey('diamond').defaultType, '風');
check('梅花 -> 土', suitByKey('club').defaultType, '土');
check('紅心 -> 火', suitByKey('heart').defaultType, '火');
check('黑桃 -> 冰', suitByKey('spade').defaultType, '冰');
check('中文名', SUITS.map((s) => s.name), ['方塊', '梅花', '紅心', '黑桃']);
check('每個花色 7 張', CARDS_PER_SUIT, 7);

// ─────────────────────────────────────────────────────────── B
section('B. 牌組組成（原書 p.8：恰好 30 張 = 2 小丑牌 + 4×7）');
const deck = createDeck();
check('總張數 30', deck.length, DECK_SIZE);
check('DECK_SIZE 常數 = 30', DECK_SIZE, 30);
check('小丑牌 2 張', deck.filter((c) => c.joker).length, JOKER_COUNT);
check('非小丑牌 28 張', deck.filter((c) => !c.joker).length, 28);
check('每花色 7 張', SUIT_KEYS.map((s) => deck.filter((c) => c.suit === s).length), [7, 7, 7, 7]);
check('每花色的數值為 1~7',
  SUIT_KEYS.every((s) => {
    const vs = deck.filter((c) => c.suit === s).map((c) => c.value).sort((a, b) => a - b);
    return JSON.stringify(vs) === JSON.stringify([1, 2, 3, 4, 5, 6, 7]);
  }), true);
check('id 不重複', new Set(deck.map((c) => c.id)).size, 30);
check('起始手牌 5 張', STARTING_HAND, 5);
check('單次最多結算 5 張', MAX_SET_SIZE, 5);
check('先鋒卡上限 2 張', MAX_VANGUARD, 2);

section('B2. 洗牌與抽牌');
const shuffled = shuffle(deck);
check('洗牌後張數不變', shuffled.length, 30);
check('洗牌後 id 集合不變',
  new Set(shuffled.map((c) => c.id)).size, new Set(deck.map((c) => c.id)).size);
check('洗牌不改動原陣列', deck[0].id, 'diamond_1');
const d1 = drawCards(deck, [], 5);
check('抽 5 張', d1.drawn.length, 5);
check('牌庫剩 25', d1.deck.length, 25);
check('抽出的牌來自牌庫', d1.drawn.every((c) => deck.some((x) => x.id === c.id)), true);

section('B3. 牌庫不足時把棄牌堆洗回（原書 p.8）');
const smallDeck = [C('spade', 1), C('spade', 2)];
const bigDiscard = [C('heart', 3), C('heart', 4), C('club', 5)];
const d2 = drawCards(smallDeck, bigDiscard, 4);
check('抽到 4 張（含洗回的棄牌）', d2.drawn.length, 4);
check('抽完後牌庫剩 1', d2.deck.length, 1);
check('棄牌堆清空', d2.discard.length, 0);
const d3 = drawCards([], [], 3);
check('兩邊都空 -> 抽 0 張', d3.drawn.length, 0);

section('B4. 牌面文字');
check('小丑牌', cardLabel(J()), '小丑牌');
check('黑桃 3', cardLabel(C('spade', 3)), '黑桃 3');
check('方塊 7', cardLabel(C('diamond', 7)), '方塊 7');
check('null -> 空字串', cardLabel(null), '');

// ─────────────────────────────────────────────────────────── C
section('C. 四條頭獎 Jackpot：4 張同值，且都不是小丑牌（原書 p.9）');
check('4 張 5 -> 四條頭獎', ids([C('spade', 5), C('heart', 5), C('club', 5), C('diamond', 5)]), ['jackpot']);
check('3 張同值不算', ids([C('spade', 5), C('heart', 5), C('club', 5)]).includes('jackpot'), false);
check('4 張不同值不算', ids([C('spade', 1), C('heart', 2), C('club', 3), C('diamond', 4)]).includes('jackpot'), false);
// 原書明例：5 張同值「不」符合 Jackpot（必須恰好 4 張）
check('★ 原書明例：5 張同值不符合四條頭獎',
  ids([C('spade', 5), C('heart', 5), C('club', 5), C('diamond', 5), J()]).includes('jackpot'), false);
check('含小丑牌的 4 張不算四條頭獎（原書明示 none of which is a joker）',
  ids([C('spade', 5), C('heart', 5), C('club', 5), J()]).includes('jackpot'), false);

// ─────────────────────────────────────────────────────────── D
section('D. 魔法同花順 Magic Flush：4 張連續且同花色');
check('同花色 3,4,5,6 -> 魔法同花順',
  ids([C('spade', 3), C('spade', 4), C('spade', 5), C('spade', 6)]).includes('magicFlush'), true);
check('不同花色不算',
  ids([C('spade', 3), C('heart', 4), C('spade', 5), C('spade', 6)]).includes('magicFlush'), false);
check('不連續不算',
  ids([C('spade', 3), C('spade', 4), C('spade', 5), C('spade', 7)]).includes('magicFlush'), false);
check('1,2,3,4 是連續',
  ids([C('club', 1), C('club', 2), C('club', 3), C('club', 4)]).includes('magicFlush'), true);
check('4,5,6,7 是連續',
  ids([C('club', 4), C('club', 5), C('club', 6), C('club', 7)]).includes('magicFlush'), true);

section('D2. 同花必然同時符合炫目順子（原書「只能選一個」的來源）');
const flush = [C('spade', 3), C('spade', 4), C('spade', 5), C('spade', 6)];
check('同花符合兩個效果', ids(flush).sort(), ['blindingFlush', 'magicFlush']);

// ─────────────────────────────────────────────────────────── E
section('E. 炫目順子 Blinding Flush：4 張連續（不限花色）');
check('不同花色的連續 -> 炫目順子',
  ids([C('spade', 3), C('heart', 4), C('club', 5), C('diamond', 6)]).includes('blindingFlush'), true);
check('不連續不算',
  ids([C('spade', 3), C('heart', 4), C('club', 5), C('diamond', 7)]).includes('blindingFlush'), false);
check('3 張連續不算（必須恰好 4 張）',
  ids([C('spade', 3), C('heart', 4), C('club', 5)]).includes('blindingFlush'), false);

// ─────────────────────────────────────────────────────────── F
section('F. 狀態滿貫 Full Status：3 張同值 + 2 張同值');
check('3+2 -> 狀態滿貫',
  ids([C('spade', 4), C('heart', 4), C('club', 4), C('diamond', 2), C('spade', 2)]).includes('fullStatus'), true);
check('必須恰好 5 張',
  ids([C('spade', 4), C('heart', 4), C('club', 4), C('diamond', 2)]).includes('fullStatus'), false);
check('3+1+1 不算',
  ids([C('spade', 4), C('heart', 4), C('club', 4), C('diamond', 2), C('spade', 3)]).includes('fullStatus'), false);
check('5 張同值不算（兩組數值須不同）',
  ids([C('spade', 4), C('heart', 4), C('club', 4), C('diamond', 4), C('spade', 4)]).includes('fullStatus'), false);

section('F2. 三重支援 Triple Support：3 張同值');
check('3 張同值 -> 三重支援',
  ids([C('spade', 4), C('heart', 4), C('club', 4)]).includes('tripleSupport'), true);
check('2 張不算',
  ids([C('spade', 4), C('heart', 4)]).includes('tripleSupport'), false);

// ─────────────────────────────────────────────────────────── G
section('G. 雙重麻煩 Double Trouble：2 張同值 + 2 張同值');
check('2+2 -> 雙重麻煩',
  ids([C('spade', 3), C('heart', 3), C('club', 5), C('diamond', 5)]).includes('doubleTrouble'), true);
check('4 張同值不算（兩組數值須不同）',
  ids([C('spade', 3), C('heart', 3), C('club', 3), C('diamond', 3)]).includes('doubleTrouble'), false);
check('2+1+1 不算',
  ids([C('spade', 3), C('heart', 3), C('club', 5), C('diamond', 6)]).includes('doubleTrouble'), false);

section('G2. 魔法對子 Magic Pair：2 張同值');
check('2 張同值 -> 魔法對子',
  ids([C('spade', 3), C('heart', 3)]).includes('magicPair'), true);
check('2 張不同值不算',
  ids([C('spade', 3), C('heart', 4)]).includes('magicPair'), false);

// ─────────────────────────────────────────────────────────── H
section('H. 小丑牌：由玩家指定花色與數值（原書 p.8）');
check('小丑牌可展開為 4 花色 × 7 數值 = 28 種', expandJokers([J()]).length, 28);
check('兩張小丑牌 = 28² = 784 種', expandJokers([J(1), J(2)]).length, 784);
check('無小丑牌 -> 只有原本那一種', expandJokers([C('spade', 1)]).length, 1);
check('3,4,5+小丑牌 -> 可補成 6 成炫目順子',
  ids([C('spade', 3), C('heart', 4), C('club', 5), J()]).includes('blindingFlush'), true);
check('2,2+小丑牌 -> 可補成 2 成三重支援',
  ids([C('spade', 2), C('heart', 2), J()]).includes('tripleSupport'), true);
check('3,3,5,5 不需要小丑牌就是雙重麻煩',
  ids([C('spade', 3), C('heart', 3), C('club', 5), C('diamond', 5)]).includes('doubleTrouble'), true);
check('1,1+小丑牌 -> 三重支援',
  ids([C('spade', 1), C('heart', 1), J()]).includes('tripleSupport'), true);
check('3 張不同值+小丑牌 -> 湊不出三重支援',
  ids([C('spade', 1), C('heart', 2), C('club', 3), J()]).includes('tripleSupport'), false);

// ─────────────────────────────────────────────────────────── I
section('I. 等級傷害加成（原書 p.9：L20+ 加 10、L40+ 加 20）');
check('L1 -> 0', levelDamageBonus(1), 0);
check('L19 -> 0', levelDamageBonus(19), 0);
check('L20 -> 10', levelDamageBonus(20), 10);
check('L39 -> 10', levelDamageBonus(39), 10);
check('L40 -> 20', levelDamageBonus(40), 20);
check('L50 -> 20', levelDamageBonus(50), 20);
check('非數字 -> 0', levelDamageBonus(undefined), 0);

section('I2. 傷害公式（原書 p.9 逐條）');
// 炫目順子：15 + 牌值總和（+ 等級加成）
const blind = detectSets([C('spade', 3), C('heart', 4), C('club', 5), C('diamond', 6)], 1)
  .find((s) => s.id === 'blindingFlush');
check('炫目順子 L1 = 15 + 18 = 33', blind.describe.includes('33'), true);
check('炫目順子 最高值 6（偶數）-> 光', blind.describe.includes('光'), true);
const blindOdd = detectSets([C('spade', 1), C('heart', 2), C('club', 3), C('diamond', 4)], 1)
  .find((s) => s.id === 'blindingFlush');
check('炫目順子 最高值 4（偶數）-> 光', blindOdd.describe.includes('光'), true);
const blindOdd2 = detectSets([C('spade', 2), C('heart', 3), C('club', 4), C('diamond', 5)], 1)
  .find((s) => s.id === 'blindingFlush');
check('炫目順子 最高值 5（奇數）-> 暗', blindOdd2.describe.includes('暗'), true);
check('炫目順子 L20 = 15 + 18 + 10 = 43',
  detectSets([C('spade', 3), C('heart', 4), C('club', 5), C('diamond', 6)], 20)
    .find((s) => s.id === 'blindingFlush').describe.includes('43'), true);
check('炫目順子 L40 = 15 + 18 + 20 = 53',
  detectSets([C('spade', 3), C('heart', 4), C('club', 5), C('diamond', 6)], 40)
    .find((s) => s.id === 'blindingFlush').describe.includes('53'), true);

// 魔法同花順：25 + 牌值總和
const mflush = detectSets([C('spade', 3), C('spade', 4), C('spade', 5), C('spade', 6)], 1)
  .find((s) => s.id === 'magicFlush');
check('魔法同花順 L1 = 25 + 18 = 43', mflush.describe.includes('43'), true);
check('魔法同花順 類型為黑桃 -> 冰', mflush.describe.includes('冰'), true);

// 三重支援：總和 × 3
const triple = detectSets([C('spade', 4), C('heart', 4), C('club', 4)], 1)
  .find((s) => s.id === 'tripleSupport');
check('三重支援 = 12 × 3 = 36', triple.describe.includes('36'), true);

// 雙重麻煩：10 + 最高值
const dbl = detectSets([C('spade', 3), C('heart', 3), C('club', 5), C('diamond', 5)], 1)
  .find((s) => s.id === 'doubleTrouble');
check('雙重麻煩 = 10 + 5 = 15', dbl.describe.includes('15'), true);

// 狀態滿貫：最高值奇偶決定方向
const fsEven = detectSets([C('spade', 4), C('heart', 4), C('club', 4), C('diamond', 2), C('spade', 2)], 1)
  .find((s) => s.id === 'fullStatus');
check('狀態滿貫 最高值 4（偶數）-> 恢復', fsEven.describe.includes('恢復'), true);
const fsOdd = detectSets([C('spade', 3), C('heart', 3), C('club', 3), C('diamond', 2), C('spade', 2)], 1)
  .find((s) => s.id === 'fullStatus');
check('狀態滿貫 最高值 3（奇數）-> 敵人陷入', fsOdd.describe.includes('敵人陷入'), true);

// 四條頭獎：固定 777
check('四條頭獎固定 777',
  detectSets([C('spade', 5), C('heart', 5), C('club', 5), C('diamond', 5)], 1)[0].describe.includes('777'), true);

// ─────────────────────────────────────────────────────────── J
section('J. 英雄技能：禁忌君王（原書 p.11）');
const fm = [C('spade', 5), C('heart', 5), C('club', 5), C('diamond', 5), J()];
check('未習得時不列出', ids(fm).includes('forbiddenMonarch'), false);
check('習得後列出', ids(fm, 1, { knownHeroicSkills: ['forbiddenRite'] }).includes('forbiddenMonarch'), true);
check('傷害固定 777',
  detectSets(fm, 1, { knownHeroicSkills: ['forbiddenRite'] })
    .find((s) => s.id === 'forbiddenMonarch').describe.includes('777'), true);
check('4 張同值 5（奇數）-> 暗',
  detectSets(fm, 1, { knownHeroicSkills: ['forbiddenRite'] })
    .find((s) => s.id === 'forbiddenMonarch').describe.includes('暗'), true);
check('需要恰好 1 張小丑牌',
  ids([C('spade', 5), C('heart', 5), C('club', 5), C('diamond', 5), C('spade', 5)], 1, { knownHeroicSkills: ['forbiddenRite'] })
    .includes('forbiddenMonarch'), false);

// ─────────────────────────────────────────────────────────── K
section('K. 邊界與防護');
check('少於 2 張 -> 無效果', ids([C('spade', 1)]), []);
check('超過 5 張 -> 無效果', ids([C('spade', 1), C('spade', 2), C('spade', 3), C('spade', 4), C('spade', 5), C('spade', 6)]), []);
check('空陣列 -> 無效果', ids([]), []);
check('null -> 無效果', ids(null), []);
check('兩張不同花色同值 -> 魔法對子',
  ids([C('spade', 3), C('heart', 3)]), ['magicPair']);
check('每張牌都有 id / name / requirement / describe',
  SET_EFFECTS.every((e) => e.id && e.name && e.requirement && typeof e.describe === 'function'), true);
check('效果總數 = 8（7 個基本 + 1 個英雄技能）', SET_EFFECTS.length, 8);
check('isValidSet 對合法組合為 true',
  isValidSet([C('spade', 3), C('heart', 3)]), true);
check('isValidSet 對不合法組合為 false',
  isValidSet([C('spade', 3), C('heart', 4)]), false);

// ─────────────────────────────────────────────────────────── L
section('L. 魔力套牌的 MP 與張數換算（原書 p.7）');
// 原書：spend up to (10 + SLx5) MP, 1 card per 5 MP, max 5 cards
check('SL1 -> 最多 3 張', maxSetSizeForSL(1), 3);
check('SL2 -> 最多 4 張', maxSetSizeForSL(2), 4);
check('SL3 -> 最多 5 張', maxSetSizeForSL(3), 5);
check('SL5 仍夾在 5 張', maxSetSizeForSL(5), 5);
check('SL0 -> 2 張（至少 10 MP）', maxSetSizeForSL(0), 2);
check('非數字 -> 2 張', maxSetSizeForSL(undefined), 2);
check('2 張 = 10 MP', mpCostForSet(2), 10);
check('3 張 = 15 MP', mpCostForSet(3), 15);
check('5 張 = 25 MP', mpCostForSet(5), 25);
check('0 張 = 0 MP', mpCostForSet(0), 0);
check('MP 上限 SL1 = 15', maxMpForSL(1), 15);
check('MP 上限 SL3 = 25', maxMpForSL(3), 25);
check('MP 上限 SL5 = 35', maxMpForSL(5), 35);
check('MP 上限與張數換算一致（SL3：5 張 = 25 MP）',
  mpCostForSet(maxSetSizeForSL(3)), maxMpForSL(3));
check('MP 上限與張數換算一致（SL1：3 張 = 15 MP）',
  mpCostForSet(maxSetSizeForSL(1)), maxMpForSL(1));

// ─────────────────────────────────────────────────────────── M
section('M. 花色對應必須互異（原書 p.8：associate each suit to a different damage type）');
check('建議對應合法', isValidSuitAssignment(DEFAULT_SUIT_TYPES), true);
check('四色皆風 -> 不合法', isValidSuitAssignment({ diamond: '風', club: '風', heart: '風', spade: '風' }), false);
check('兩色重複 -> 不合法', isValidSuitAssignment({ diamond: '風', club: '風', heart: '火', spade: '冰' }), false);
check('另一組排列合法', isValidSuitAssignment({ diamond: '冰', club: '火', heart: '土', spade: '風' }), true);
check('含非法傷害類型 -> 不合法', isValidSuitAssignment({ diamond: '光', club: '土', heart: '火', spade: '冰' }), false);
check('未設定 -> 以預設值判定為合法', isValidSuitAssignment(undefined), true);
check('傷害類型只有四種', DAMAGE_TYPES, ['風', '土', '火', '冰']);

// ─────────────────────────────────────────────────────────── N
section('N. 牌運亨通 High or Low（原書 p.7）');
const hol = (cards, sl) => highOrLowState(cards, sl);
const ZERO_HOL = { extraDamage: 0, damageReduction: 0, heal: 0 };
check('含 7 -> +SL 傷害、無減傷',
  hol([C('spade', 4), C('spade', 5), C('spade', 6), C('spade', 7)], 3),
  { extraDamage: 3, damageReduction: 0, heal: 0 });
check('含 1 -> 減傷 SL、無額外傷害',
  hol([C('club', 1), C('club', 2), C('club', 3), C('club', 4)], 3),
  { extraDamage: 0, damageReduction: 3, heal: 0 });
check('含小丑牌 -> 同時 +SL 與減傷 SL',
  hol([C('spade', 5), C('heart', 5), C('club', 5), C('diamond', 5), J()], 2),
  { extraDamage: 2, damageReduction: 2, heal: 0 });
check('★ 同時含 1 與 7（3 張 1 + 2 張 7）-> 兩條都成立',
  hol([C('spade', 1), C('heart', 1), C('club', 1), C('diamond', 7), C('spade', 7)], 4),
  { extraDamage: 4, damageReduction: 4, heal: 0 });
check('無小丑牌/1/7 -> 回復 SL×2',
  hol([C('spade', 3), C('heart', 4), C('club', 5), C('diamond', 6)], 5),
  { extraDamage: 0, damageReduction: 0, heal: 10 });
check('SL 0 -> 全 0', hol([C('spade', 3), C('heart', 4)], 0), ZERO_HOL);
check('空組合 -> 全 0', hol([], 3), ZERO_HOL);
check('非數字 SL -> 全 0', hol([C('spade', 3)], undefined), ZERO_HOL);
check('hasHighOrLowState：純回復 -> false', hasHighOrLowState({ extraDamage: 0, damageReduction: 0, heal: 10 }), false);
check('hasHighOrLowState：+傷害 -> true', hasHighOrLowState({ extraDamage: 1, damageReduction: 0, heal: 0 }), true);
check('hasHighOrLowState：null -> false', hasHighOrLowState(null), false);

// ─────────────────────────────────────────────────────────── O
section('O. 再調度 Mulligan（原書 p.7：由玩家自選至多 SL+1 張）');
check('SL1 -> 上限 2', mulliganLimit(1), 2);
check('SL2 -> 上限 3', mulliganLimit(2), 3);
check('SL0 -> 上限 1', mulliganLimit(0), 1);
check('非數字 -> 上限 1', mulliganLimit(undefined), 1);
const hand5 = [C('spade', 1), C('heart', 2), C('club', 3), C('diamond', 4), J()];
const mull1 = pickMulligan(hand5, ['spade_1', 'club_3'], 1);
check('自選 2 張通過（SL1）', mull1.ok, true);
check('回傳的是自選的那兩張', mull1.cards.map((c) => c.id), ['spade_1', 'club_3']);
check('其餘手牌保持原順序', mull1.rest.map((c) => c.id), ['heart_2', 'diamond_4', 'joker_1']);
const mull2 = pickMulligan(hand5, ['spade_1', 'club_3', 'diamond_4'], 1);
check('超過 SL+1 -> 不通過', mull2.ok, false);
check('超過上限的原因文字', mull2.reason.includes('最多只能棄 2 張'), true);
check('未選牌 -> 不通過', pickMulligan(hand5, [], 2).ok, false);
check('未選牌的原因文字', pickMulligan(hand5, [], 2).reason.includes('至少選 1 張'), true);
check('選到不在手牌的 id -> 視為未選', pickMulligan(hand5, ['nope'], 2).ok, false);

// ─────────────────────────────────────────────────────────── P
section('P. 陷阱卡 Trap Card（原書 p.7：ice(Attack) / fire(Objective) / earth(Skill) / air(Spell)）');
check('動作對應表',
  TRAP_ACTIONS.map((a) => [a.name, a.type]),
  [['攻擊', '冰'], ['目標', '火'], ['技能', '土'], ['咒語', '風']]);
check('SL1 -> 可棄 2 張', trapDiscardLimit(1), 2);
check('SL2 -> 可棄 3 張', trapDiscardLimit(2), 3);
check('SL2 -> 咒語 MP 上限 10', trapSpellMpCap(2), 10);
check('SL0 -> 咒語 MP 上限 0', trapSpellMpCap(0), 0);
const ST = { diamond: '風', club: '土', heart: '火', spade: '冰' };
check('小丑牌永遠符合', isTrapEligible(J(), '冰', ST), true);
check('黑桃（冰）對「攻擊」-> 符合', isTrapEligible(C('spade', 3), '冰', ST), true);
check('黑桃（冰）對「咒語」-> 不符合', isTrapEligible(C('spade', 3), '風', ST), false);
check('方塊（風）對「咒語」-> 符合', isTrapEligible(C('diamond', 3), '風', ST), true);
check('未指定花色對應 -> 用預設值判定', isTrapEligible(C('heart', 3), '火', undefined), true);
check('eligibleTrapCards 篩選小丑牌與對應花色',
  eligibleTrapCards([C('spade', 1), C('heart', 1), J()], '冰', ST).map((c) => c.id),
  ['spade_1', 'joker_1']);
const trapHand = [C('spade', 1), C('heart', 1), J()];
const trap1 = pickTrapDiscard(trapHand, ['spade_1', 'joker_1'], 1, '冰', ST);
check('合格選擇通過', trap1.ok, true);
check('其餘手牌正確', trap1.rest.map((c) => c.id), ['heart_1']);
const trap2 = pickTrapDiscard(trapHand, ['heart_1'], 1, '冰', ST);
check('花色不符 -> 不通過', trap2.ok, false);
check('花色不符的原因文字', trap2.reason.includes('不是小丑牌'), true);
const trap3 = pickTrapDiscard([C('spade', 1), C('spade', 2), C('spade', 3)], ['spade_1', 'spade_2', 'spade_3'], 1, '冰', ST);
check('超過 SL+1 -> 不通過', trap3.ok, false);
check('咒語 MP：變動消耗取首個數字', spellMpCost({ mp: '5 × T' }), 5);
check('咒語 MP：純數字', spellMpCost({ mp: '20' }), 20);
check('咒語 MP：缺欄位 -> 0', spellMpCost({}), 0);
check('castableTrapSpells 以 SL×5 過濾',
  castableTrapSpells([{ name: 'a', mp: '10' }, { name: 'b', mp: '20' }, { name: 'c', mp: '5 × T' }], 2).map((s) => s.name),
  ['a', 'c']);

// ─────────────────────────────────────────────────────────── Q
section('Q. 結算的自身受益與速查欄位');
check('四條頭獎 -> HP 777 / MP 777', selfBenefitForEffect('jackpot', {}), { hp: 777, mp: 777 });
check('三重支援 -> 牌值總和 × 3', selfBenefitForEffect('tripleSupport', { total: 12 }), { hp: 36, mp: 0 });
check('炫目順子 -> 無自身受益', selfBenefitForEffect('blindingFlush', { total: 18 }), { hp: 0, mp: 0 });
check('未知效果 -> 全 0', selfBenefitForEffect('nope', { total: 9 }), { hp: 0, mp: 0 });
check('狀態滿貫可選的 4 種狀態', FULL_STATUS_CHOICES, ['dazed', 'shaken', 'slow', 'weak']);
check('每回合使用記錄初始為未使用（只有陷阱卡有次數限制）', emptyTurnUsage(), { trap: false });
check('每個效果都有靜態速查文字',
  SET_EFFECTS.every((e) => typeof e.reference === 'string' && e.reference.length > 10), true);
check('狀態滿貫的動態敘述列出 4 種狀態',
  detectSets([C('spade', 4), C('heart', 4), C('club', 4), C('diamond', 2), C('spade', 2)], 1)
    .find((s) => s.id === 'fullStatus').describe.includes('眩暈、動搖、緩慢、虛弱'), true);

// ─────────────────────────────────────────────────────────── R
section('R. 小丑牌指定：由玩家指定花色與數值（原書 p.8「you choose their suit and value」）');
check('指定後小丑牌被填成具體牌',
  applyJokerAssignment([C('spade', 3), J()], { joker_1: { suit: 'heart', value: 6 } })
    .map((c) => `${c.suit}:${c.value}`),
  ['spade:3', 'heart:6']);
check('未指定的小丑牌維持原樣',
  applyJokerAssignment([J()], {}).map((c) => c.joker),
  [true]);
check('非小丑牌不受影響',
  applyJokerAssignment([C('spade', 3)], { spade_3: { suit: 'heart', value: 6 } })[0].suit,
  'spade');
check('isFullyAssigned：全部指定 -> true',
  isFullyAssigned([C('spade', 3), J()], { joker_1: { suit: 'heart', value: 6 } }), true);
check('isFullyAssigned：部分指定 -> false',
  isFullyAssigned([J(1), J(2)], { joker_1: { suit: 'heart', value: 6 } }), false);
check('isFullyAssigned：沒有小丑牌 -> true', isFullyAssigned([C('spade', 3)], {}), true);

// ★ 指定值會改變判定結果
check('3,3+小丑牌指定為 3 -> 三重支援',
  ids([C('spade', 3), C('heart', 3), J()], 1, { jokerAssignment: { joker_1: { suit: 'club', value: 3 } } })
    .includes('tripleSupport'), true);
check('3,3+小丑牌指定為 5 -> 無效果（不再是三重支援）',
  ids([C('spade', 3), C('heart', 3), J()], 1, { jokerAssignment: { joker_1: { suit: 'club', value: 5 } } })
    .length, 0);
check('★ 花色會決定傷害類型：指定黑桃 -> 魔法同花順（冰）',
  detectSets([C('spade', 3), C('spade', 4), C('spade', 5), J()], 1, {
    jokerAssignment: { joker_1: { suit: 'spade', value: 6 } }
  }).map((s) => s.id).sort(),
  ['blindingFlush', 'magicFlush']);
check('★ 同一組牌改指定紅心 -> 只剩炫目順子（不同花色）',
  detectSets([C('spade', 3), C('spade', 4), C('spade', 5), J()], 1, {
    jokerAssignment: { joker_1: { suit: 'heart', value: 6 } }
  }).map((s) => s.id),
  ['blindingFlush']);
check('指定黑桃時傷害類型為冰',
  detectSets([C('spade', 3), C('spade', 4), C('spade', 5), J()], 1, {
    jokerAssignment: { joker_1: { suit: 'spade', value: 6 } }
  }).find((s) => s.id === 'magicFlush').describe.includes('冰'), true);
check('只指定部分小丑牌 -> 退回窮舉（仍找得到效果）',
  ids([C('spade', 3), C('heart', 3), J(1), J(2)], 1, { jokerAssignment: { joker_1: { suit: 'club', value: 3 } } })
    .length > 0, true);

// 建議指定
check('建議指定：3,3+小丑牌 -> 梅花? 不，取展開順序第一組（方塊 3）',
  suggestJokerAssignment([C('spade', 3), C('heart', 3), J()], 1),
  { joker_1: { suit: 'diamond', value: 3 } });
check('建議指定：1,2,4+小丑牌 -> 補成連續（方塊 3）',
  suggestJokerAssignment([C('spade', 1), C('heart', 2), C('club', 4), J()], 1),
  { joker_1: { suit: 'diamond', value: 3 } });
check('建議指定：沒有小丑牌 -> null', suggestJokerAssignment([C('spade', 3), C('heart', 3)], 1), null);
check('建議指定：湊不出效果 -> null', suggestJokerAssignment([C('spade', 1), C('heart', 3), C('club', 5), J()], 1), null);

// ─────────────────────────────────────────────────────────── S
section('S. 牌桌狀態：衝突結束後必須回得到「衝突開始」（使用者回報的 bug）');
const idle = idleDeckState();
check('衝突結束狀態：active=false', idle.active, false);
check('衝突結束狀態：牌庫 30 張', idle.deck.length, DECK_SIZE);
check('衝突結束狀態：手牌清空', idle.hand.length, 0);
check('衝突結束狀態：棄牌堆清空', idle.discard.length, 0);
check('衝突結束狀態：牌運亨通狀態清空', idle.highOrLow, null);
check('衝突結束狀態：每回合記錄歸零', idle.usedThisTurn, { trap: false });
// ★ 這兩條就是「再也抽不了卡」的回歸護欄
check('★ 衝突結束後 -> 不在衝突中（舊版判準 deck.length > 0 會誤判為 true）',
  isDeckInConflict(idle), false);
check('★ 舊存檔（無 active 欄位、30 張在牌庫、手牌空）-> 不在衝突中',
  isDeckInConflict({ deck: createDeck(), hand: [], discard: [] }), false);
check('衝突開始後（active=true）-> 在衝突中',
  isDeckInConflict({ active: true, deck: createDeck(), hand: [], discard: [] }), true);
check('衝突中（牌庫 25 + 手牌 5）-> 在衝突中',
  isDeckInConflict({ deck: createDeck().slice(0, 25), hand: createDeck().slice(25) }), true);
check('棄牌堆非空 -> 在衝突中',
  isDeckInConflict({ deck: createDeck().slice(0, 28), hand: [], discard: createDeck().slice(28) }), true);
check('空物件 -> 不在衝突中', isDeckInConflict({}), false);
check('undefined -> 不在衝突中', isDeckInConflict(undefined), false);
check('active=false 優先於啟發式（牌庫不足 30 仍視為已收起）',
  isDeckInConflict({ active: false, deck: createDeck().slice(0, 10), hand: [] }), false);
check('★ 結束 -> 開始 -> 結束 的往返不卡死',
  (() => {
    const a = idleDeckState();
    const b = { ...a, active: true, deck: a.deck.slice(0, 25), hand: a.deck.slice(25) };
    return [isDeckInConflict(a), isDeckInConflict(b), isDeckInConflict(idleDeckState())];
  })(),
  [false, true, false]);

// ─────────────────────────────────────────────────────────── T
section('T. 渲染器同步：牌桌必須走共用判準，不得長回舊寫法');
const tableSource = fs.readFileSync(
  path.join(process.cwd(), 'src/features/character-sheet/components/companions/AceOfCardsTable.jsx'),
  'utf8'
);
checkTrue('牌桌使用 isDeckInConflict 判準', tableSource.includes('isDeckInConflict(data)'));
check('牌桌已無舊判準（deck.length > 0 當衝突中）',
  /const inConflict = deck\.length/.test(tableSource), false);
checkTrue('衝突開始會寫 active: true', tableSource.includes('active: true'));
checkTrue('衝突結束會寫 idleDeckState()', tableSource.includes('idleDeckState()'));
checkTrue('結算把小丑牌指定傳進 detectSets', tableSource.includes('jokerAssignment: jokerAssign'));
checkTrue('有小丑牌指定面板', tableSource.includes('小丑牌指定'));
/**
 * 牌面數字與花色圖示同尺寸——三階逐一檢查（第三十五輪 §CI43 改成對照組）。
 *
 * 原本釘死單一數字（`text-[17px]` ＋ `w-[17px]`），所以任意字級改成型階梯令牌時
 * 這條會紅，而它紅的理由不是「壞了」，是「字面值變了」。
 * 改成三階各自比對「字級令牌 ↔ 圖示寬度」是否同值：
 * 這是那條規則**真正的意思**，也對排版與令牌重構免疫。
 */
const CARD_SIZE_PAIRS = [
  ["glyph: 'text-t16'", "icon: 'w-4 h-4'"],
  ["glyph: 'text-t14'", "icon: 'w-3.5 h-3.5'"],
  ["glyph: 'text-t12'", "icon: 'w-3 h-3'"],
];
checkTrue(
  '牌面數字與花色同尺寸（三階）',
  CARD_SIZE_PAIRS.every(([g, i]) => tableSource.includes(g) && tableSource.includes(i))
);
check('已無舊的彩色底牌面（SUIT_STYLE）', tableSource.includes('SUIT_STYLE'), false);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
