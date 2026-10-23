import React, { useMemo, useState } from 'react';
import {
  GiCardPlay,
  GiCardRandom,
  GiCardPickup,
  GiCardDiscard,
  GiCardJoker,
  GiCardDraw,
  GiTrapMask,
  GiRollingDices,
  GiSpades,
  GiHearts,
  GiDiamonds,
  GiClubs,
  GiScrollUnfurled,
  GiHazardSign,
  GiCheckMark,
  GiDiceTwentyFacesTwenty
} from 'react-icons/gi';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { STATUS_AFFLICTIONS } from '../../data/sourcebookConfig';
import {
  SUITS,
  SUIT_KEYS,
  CARDS_PER_SUIT,
  DECK_SIZE,
  STARTING_HAND,
  MAX_VANGUARD,
  DAMAGE_TYPES,
  DEFAULT_SUIT_TYPES,
  isValidSuitAssignment,
  suitName,
  createDeck,
  shuffle,
  drawCards,
  cardLabel,
  detectSets,
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
  isFullyAssigned,
  suggestJokerAssignment,
  isDeckInConflict,
  idleDeckState
} from '../../data/aceOfCardsData';

/**
 * 卡牌大師牌桌（Ace of Cards Table）
 *
 * ## 為什麼需要這個元件
 *
 * 這是全專案最複雜的職業：需要一整套**牌組狀態**（牌庫／手牌／棄牌堆／先鋒卡），
 * 而組合效果是**精確比對**的（4 張同值才算四條頭獎，5 張不算）。用文字描述完全無法在跑團時使用。
 *
 * ## 規則要點（原書特典合輯 p.7–p.11）
 *
 * - 牌組恰好 30 張；衝突開始洗牌抽 5 張；衝突結束全部洗回
 * - 4 個花色各對應一種傷害類型（必須互異）
 * - 結算：花 `張數 × 5` MP（上限 `10 + SL×5`）→ 從手牌打出該張數構成一組 → 結算後補抽等量
 * - 同時符合多個效果時**只能選一個**；組合沒有對應效果時仍可打出（原書「the effect of the set (if any)」）
 * - 【牌運亨通】依結算牌是否含小丑牌／1／7 產生 +SL 傷害／減傷 SL／回復 SL×2 HP
 * - 【再調度】命中敵人後，**由玩家自選**至多 `SL + 1` 張棄掉並補抽
 *   —— ※ **原書沒有次數限制**（`When you hit one or more enemies with an attack during your
 *   turn, you may discard up to (SL + 1) cards.`）。舊版自己加了「每回合一次」，已移除。
 * - 【陷阱卡】敵人結算動作後，棄至多 `SL + 1` 張「小丑牌或花色對應該動作」的牌並補抽，
 *   然後可免費施放總 MP ≤ `SL × 5` 的咒語；**同一回合不能再使用**（這條限制原書有明文）
 *
 * > 英雄技能（黑與白／先鋒卡／決鬥大師／禁忌儀式）需精通職業（Lv 10）才可習得，尚未實作。
 */

const T = {
  bg: 'bg-[#f5efdf]',
  border: 'border-[#d6c7ab]',
  text: 'text-[#3c2415]',
  sub: 'text-[#6b5a4b]'
};

/**
 * 花色 → Game-Icons 圖示。
 *
 * **不要用 `GiSpade`（單數）**——那是**鏟子**（工具），不是花色。
 * 四個花色一律是複數：`GiSpades`／`GiHearts`／`GiDiamonds`／`GiClubs`
 * （已實際把 SVG 畫出來逐一目視確認，見 `scratch/render_gi_icons.py`）。
 *
 * 用圖示取代 `♠♥♦♣` 字元還有個附帶好處：`♥`／`♦` 在部分平台會渲染成彩色 emoji，
 * 與規則一軌道 3（零 Emoji）衝突。圖示沒有這個問題。
 */
const SUIT_ICON = {
  spade: GiSpades,
  heart: GiHearts,
  diamond: GiDiamonds,
  club: GiClubs
};

/**
 * 花色 → 牌面顏色。
 *
 * 撲克牌的慣例：紅心／方塊為紅，黑桃／梅花為黑。這是**辨識用的既有慣例**，不是裝飾，
 * 所以即使全站是羊皮紙色調也保留（參考 888poker 的 hand rankings 表）。
 */
const SUIT_TEXT = {
  diamond: 'text-red-600',
  heart: 'text-red-600',
  club: 'text-[#2c221e]',
  spade: 'text-[#2c221e]'
};

/** 小丑牌未指定花色與數值時的顏色。 */
const JOKER_TEXT = 'text-[#6b5a4b]';

/** 牌面尺寸：`md` 手牌、`sm` 其他小區塊、`xs` 棄牌堆。 */
const CARD_SIZE = {
  md: { box: 'min-w-[44px] px-1.5 py-1 rounded-[5px]', glyph: 'text-[17px]', icon: 'w-[17px] h-[17px]' },
  sm: { box: 'min-w-[38px] px-1.5 py-1 rounded-[5px]', glyph: 'text-[15px]', icon: 'w-[15px] h-[15px]' },
  xs: { box: 'min-w-[30px] px-1 py-0.5 rounded-[4px]', glyph: 'text-[12px]', icon: 'w-[12px] h-[12px]' }
};

/** 小顆的區塊標題。 */
const SectionTitle = ({ icon: Icon, children, right = null }) => (
  <div className="flex items-center justify-between gap-2 mb-1.5">
    <span className={`text-[11px] font-bold ${T.text} flex items-center gap-1.5`}>
      {Icon && <Icon className="w-3.5 h-3.5 text-[#6b5a4b]" />}
      <span>{children}</span>
    </span>
    {right}
  </div>
);

export default function AceOfCardsTable({
  character,
  onChange,
  onAdjustHp = () => {},
  onAdjustMp = () => {},
  onClearStatuses = () => {},
  showToast = () => {}
}) {
  const data = character?.aceOfCards || {};
  const suitTypes = data.suitTypes || DEFAULT_SUIT_TYPES;
  const deck = data.deck || [];
  const hand = data.hand || [];
  const discard = data.discard || [];
  const vanguard = data.vanguard || [];
  const usedThisTurn = data.usedThisTurn || emptyTurnUsage();
  const highOrLow = data.highOrLow || null;

  const [picked, setPicked] = useState([]);
  const [chosenEffect, setChosenEffect] = useState(null);
  const [statusPicked, setStatusPicked] = useState([]);
  const [mulliganPicked, setMulliganPicked] = useState([]);
  const [trapActionKey, setTrapActionKey] = useState(null);
  const [trapPicked, setTrapPicked] = useState([]);
  const [trapDiscarded, setTrapDiscarded] = useState(false);
  /** 玩家為小丑牌指定的花色與數值：`{ [cardId]: { suit, value } }`（原書 p.8）。 */
  const [jokerAssign, setJokerAssign] = useState({});

  const aceClass = (character?.classes || []).find((c) => c.className === '卡牌大師');
  const skillSL = (name) =>
    Math.max(0, Math.floor(Number((aceClass?.skills || []).find((s) => s.name === name)?.sl) || 0));

  const magicCardsSL = skillSL('魔法卡組');
  const highOrLowSL = skillSL('牌運亨通');
  const mulliganSL = skillSL('再調度');
  const trapSL = skillSL('陷阱卡');

  const level = Math.max(1, Math.floor(Number(character?.level) || 1));
  const currentMp = character?.currentMp ?? 0;
  const knownHeroicSkills = useMemo(
    () => (character?.heroicSkills || []).map((h) => (typeof h === 'string' ? h : h?.name)).filter(Boolean),
    [character?.heroicSkills]
  );

  const write = (patch) => {
    onChange({
      ...character,
      aceOfCards: { ...data, ...patch },
      updatedAt: new Date().toISOString()
    });
  };

  // 未習得【魔法卡組】就完全不渲染
  if (magicCardsSL <= 0) return null;

  // 牌桌狀態判準抽在資料層（`isDeckInConflict`）——舊版用 `deck.length > 0`，
  // 導致【衝突結束】把 30 張收回牌庫後判準永遠為 true，再也回不到「衝突開始」。
  const inConflict = isDeckInConflict(data);
  const maxCards = maxSetSizeForSL(magicCardsSL);
  const mpCap = maxMpForSL(magicCardsSL);
  const suitOk = isValidSuitAssignment(suitTypes);

  const pickedCards = picked.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const pickedJokers = pickedCards.filter((c) => c.joker);
  const jokersAssigned = isFullyAssigned(pickedCards, jokerAssign);
  const matches = detectSets(pickedCards, level, { knownHeroicSkills, jokerAssignment: jokerAssign });
  const effective = matches.find((m) => m.id === chosenEffect) || matches[0] || null;
  const mpCost = mpCostForSet(pickedCards.length);
  const enoughMp = mpCost <= currentMp;
  // 原書：「After you resolve the effect of the set (if any)」——沒有對應效果的組合仍可打出（等於花 MP 濾牌）
  const canResolve = pickedCards.length >= 2 && pickedCards.length <= maxCards && enoughMp;

  const trapAction = TRAP_ACTIONS.find((a) => a.key === trapActionKey) || null;
  const trapEligible = trapAction ? eligibleTrapCards(hand, trapAction.type, suitTypes) : [];
  const trapCap = trapSpellMpCap(trapSL);
  const trapSpells = castableTrapSpells(character?.spells, trapSL);

  // ── 動作 ────────────────────────────────────────────────
  const resetTable = () => {
    setPicked([]);
    setChosenEffect(null);
    setStatusPicked([]);
    setMulliganPicked([]);
    setTrapActionKey(null);
    setTrapPicked([]);
    setTrapDiscarded(false);
    setJokerAssign({});
  };

  const startConflict = () => {
    const fresh = shuffle(createDeck());
    const r = drawCards(fresh, [], STARTING_HAND);
    write({
      active: true,
      deck: r.deck,
      hand: r.drawn,
      discard: [],
      vanguard: [],
      highOrLow: null,
      usedThisTurn: emptyTurnUsage()
    });
    resetTable();
    showToast(`衝突開始：洗牌 30 張，抽 ${STARTING_HAND} 張`, 'success');
  };

  const endConflict = () => {
    write(idleDeckState());
    resetTable();
    showToast('衝突結束：30 張全部洗回牌庫並收起來', 'info');
  };

  const startTurn = () => {
    write({ usedThisTurn: emptyTurnUsage() });
    setTrapDiscarded(false);
    setTrapActionKey(null);
    setTrapPicked([]);
    setMulliganPicked([]);
    showToast('新回合：【陷阱卡】的每回合限制已解除', 'info');
  };

  const togglePick = (id) => {
    setChosenEffect(null);
    setStatusPicked([]);
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxCards) {
        showToast(`目前最多只能結算 ${maxCards} 張（SL ${magicCardsSL}）`, 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleTrapPick = (id) => {
    setTrapPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const limit = trapDiscardLimit(trapSL);
      if (prev.length >= limit) {
        showToast(`陷阱卡最多只能棄 ${limit} 張（SL ${trapSL} + 1）`, 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleMulliganPick = (id) => {
    setMulliganPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const limit = mulliganLimit(mulliganSL);
      if (prev.length >= limit) {
        showToast(`再調度最多只能棄 ${limit} 張（SL ${mulliganSL} + 1）`, 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleStatusPick = (key) => {
    setStatusPicked((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) return [prev[1], key];
      return [...prev, key];
    });
  };

  /** 結算一組：付出 MP → 打出選取的牌 → 補抽等量 → 套用牌運亨通與自身受益。 */
  const resolveSet = () => {
    if (!canResolve) return;
    const ids = new Set(picked);
    const played = hand.filter((c) => ids.has(c.id));
    const rest = hand.filter((c) => !ids.has(c.id));
    const r = drawCards(deck, [...discard, ...played], played.length);

    const hol = highOrLowState(played, highOrLowSL);
    const benefit = effective ? selfBenefitForEffect(effective.id, { total: effective.total }) : { hp: 0, mp: 0 };
    const heal = benefit.hp + hol.heal;
    const clearsStatuses =
      effective?.id === 'fullStatus' && effective.highest % 2 === 0 && statusPicked.length === 2;

    write({
      deck: r.deck,
      discard: r.discard,
      hand: [...rest, ...r.drawn],
      highOrLow: hasHighOrLowState(hol) ? hol : null
    });

    onAdjustMp(-mpCost);
    if (benefit.mp > 0) onAdjustMp(benefit.mp);
    if (heal > 0) onAdjustHp(heal);
    if (clearsStatuses) onClearStatuses(statusPicked);

    const bits = [effective ? `結算【${effective.name}】` : '打出無對應效果的組合'];
    bits.push(`花費 ${mpCost} MP`);
    if (r.drawn.length > 0) bits.push(`補抽 ${r.drawn.length} 張`);
    if (heal > 0) bits.push(`回復 ${heal} HP`);
    if (benefit.mp > 0) bits.push(`回復 ${benefit.mp} MP`);
    if (hol.extraDamage > 0) bits.push(`牌運亨通：+${hol.extraDamage} 傷害`);
    if (hol.damageReduction > 0) bits.push(`牌運亨通：減傷 ${hol.damageReduction}`);
    if (effective?.id === 'fullStatus') {
      const names = statusPicked.map((k) => STATUS_AFFLICTIONS[k]?.name).filter(Boolean);
      if (effective.highest % 2 === 0) {
        bits.push(names.length === 2 ? `解除：${names.join('、')}` : '請選兩種要解除的狀態');
      } else {
        bits.push(names.length === 2 ? `敵人陷入：${names.join('、')}` : '請選兩種要施加的狀態');
      }
    }
    showToast(bits.join('、'), 'success');

    setPicked([]);
    setChosenEffect(null);
    setStatusPicked([]);
    setJokerAssign({});
  };

  /**
   * 再調度：玩家自選至多 SL+1 張棄掉後補抽等量。
   *
   * ※ **沒有每回合一次的限制**——原書（特典合輯 p.9）只寫
   * `When you hit one or more enemies with an attack during your turn, you may discard up to
   * (SL + 1) cards. If you do, draw that many cards.`
   * 有次數限制的是【陷阱卡】（`you cannot use this Skill again until the start of your next turn`），
   * 舊版把兩者混為一談、一併鎖了每回合一次。
   */
  const doMulligan = () => {
    if (mulliganSL <= 0) {
      showToast('尚未習得【再調度】', 'warning');
      return;
    }
    const pick = pickMulligan(hand, mulliganPicked, mulliganSL);
    if (!pick.ok) {
      showToast(pick.reason, 'warning');
      return;
    }
    const r = drawCards(deck, [...discard, ...pick.cards], pick.cards.length);
    write({
      deck: r.deck,
      discard: r.discard,
      hand: [...pick.rest, ...r.drawn]
    });
    setMulliganPicked([]);
    showToast(`再調度：棄 ${pick.cards.length} 張、抽 ${r.drawn.length} 張`, 'success');
  };

  /** 陷阱卡第一步：棄掉符合條件的牌並補抽。 */
  const confirmTrapDiscard = () => {
    if (trapSL <= 0) {
      showToast('尚未習得【陷阱卡】', 'warning');
      return;
    }
    if (usedThisTurn.trap) {
      showToast('本回合已使用過【陷阱卡】，請先推進回合', 'warning');
      return;
    }
    if (!trapAction) {
      showToast('請先選擇敵人剛結算的動作類型', 'warning');
      return;
    }
    const pick = pickTrapDiscard(hand, trapPicked, trapSL, trapAction.type, suitTypes);
    if (!pick.ok) {
      showToast(pick.reason, 'warning');
      return;
    }
    const r = drawCards(deck, [...discard, ...pick.cards], pick.cards.length);
    write({
      deck: r.deck,
      discard: r.discard,
      hand: [...pick.rest, ...r.drawn],
      usedThisTurn: { ...usedThisTurn, trap: true }
    });
    setTrapPicked([]);
    setTrapDiscarded(true);
    showToast(
      `陷阱卡：棄 ${pick.cards.length} 張、抽 ${r.drawn.length} 張——可免費施放總 MP ≤ ${trapCap} 的咒語`,
      'success'
    );
  };

  /** 陷阱卡第二步：免費執行咒語動作（MP 仍自付）。 */
  const castTrapSpell = (spell) => {
    const cost = spellMpCost(spell);
    if (cost > trapCap) {
      showToast(`【${spell.name}】需要 ${cost} MP，超過上限 ${trapCap}`, 'warning');
      return;
    }
    if (cost > currentMp) {
      showToast(`MP 不足（需 ${cost}，現有 ${currentMp}）`, 'warning');
      return;
    }
    onAdjustMp(-cost);
    setTrapDiscarded(false);
    setTrapActionKey(null);
    showToast(`陷阱卡免費施法：【${spell.name}】支付 ${cost} MP`, 'success');
  };

  const applyRecommendedSuits = () => {
    write({ suitTypes: { ...DEFAULT_SUIT_TYPES } });
    showToast('已套用建議對應：方塊風、梅花土、紅心火、黑桃冰', 'info');
  };

  // ── 小丑牌指定（原書 p.8：由玩家指定花色與數值） ──────────
  const setJokerSuit = (cardId, suit) => {
    setChosenEffect(null);
    setJokerAssign((prev) => ({ ...prev, [cardId]: { suit, value: prev[cardId]?.value ?? 1 } }));
  };

  const setJokerValue = (cardId, value) => {
    setChosenEffect(null);
    setJokerAssign((prev) => ({ ...prev, [cardId]: { suit: prev[cardId]?.suit ?? SUIT_KEYS[0], value } }));
  };

  const applySuggestedJokers = () => {
    const s = suggestJokerAssignment(pickedCards, level, { knownHeroicSkills });
    if (!s) {
      showToast('這組牌無論怎麼指定小丑牌都湊不出效果', 'warning');
      return;
    }
    setChosenEffect(null);
    setJokerAssign((prev) => ({ ...prev, ...s }));
    showToast('已套用建議指定', 'info');
  };

  const clearJokerAssign = () => {
    setChosenEffect(null);
    setJokerAssign((prev) => {
      const next = { ...prev };
      pickedJokers.forEach((c) => { delete next[c.id]; });
      return next;
    });
  };

  // ── 顯示 ────────────────────────────────────────────────
  /**
   * 牌面（撲克牌樣式）。
   *
   * 參考 888poker 的 hand rankings 表：**白底圓角長方形，數字與花色並排且一樣大**，
   * 顏色依花色（紅心／方塊紅、黑桃／梅花黑）。小丑牌在指定花色與數值後，
   * 牌面直接顯示指定的內容——玩家看得到自己送出了什麼。
   */
  const renderCard = (card, { selectable = true, selected = false, onToggle, dim = false, size = 'md' } = {}) => {
    const s = CARD_SIZE[size] || CARD_SIZE.md;
    const assigned = card.joker ? jokerAssign[card.id] : null;
    const suit = card.joker ? assigned?.suit : card.suit;
    const value = card.joker ? assigned?.value : card.value;
    const SuitIcon = suit ? SUIT_ICON[suit] : GiCardJoker;
    const tone = suit ? SUIT_TEXT[suit] || JOKER_TEXT : JOKER_TEXT;
    const type = suit && suitTypes[suit] ? suitTypes[suit] : null;
    const label = card.joker
      ? assigned
        ? `小丑牌 → ${suitName(assigned.suit)} ${assigned.value}${type ? `（${type}）` : ''}`
        : '小丑牌（尚未指定花色與數值）'
      : type
        ? `${cardLabel(card)}（${type}）`
        : cardLabel(card);

    return (
      <button
        key={card.id}
        type="button"
        disabled={!selectable}
        onClick={() => selectable && onToggle && onToggle(card.id)}
        title={label}
        aria-label={label}
        className={`bg-white border border-[#d6c7ab] flex items-center justify-center gap-[3px] leading-none transition-all ${s.box} ${
          selectable ? 'cursor-pointer' : 'cursor-default'
        } ${selected ? 'ring-2 ring-[#3c2415] -translate-y-0.5' : ''} ${
          dim ? 'opacity-30 grayscale' : ''
        }`}
      >
        <span className={`${s.glyph} font-black ${tone}`}>
          {card.joker && !assigned ? '丑' : value}
        </span>
        {SuitIcon && <SuitIcon className={`${s.icon} ${tone} shrink-0`} />}
      </button>
    );
  };

  const chip = (text, tone = 'neutral') => {
    const tones = {
      neutral: `bg-white border ${T.border} ${T.text}`,
      warn: 'bg-[#f9f5eb] border-[#d6c7ab] text-[#3c2415]',
      ok: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      bad: 'bg-red-50 border-red-300 text-red-900'
    };
    return <span className={`px-2 py-1 rounded-lg border text-xs font-bold ${tones[tone]}`}>{text}</span>;
  };

  return (
    <div className="rounded-2xl bg-white border border-[#d6c7ab] overflow-hidden">
      {/* 標題列 */}
      <div className={`px-3.5 py-2.5 ${T.bg} border-b ${T.border} flex items-center justify-between flex-wrap gap-2`}>
        <span className={`font-bold text-sm ${T.text} flex items-center gap-1.5`}>
          <GiCardPlay className="w-4 h-4 text-[#6b5a4b]" />
          <span>卡牌大師牌桌</span>
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {chip(
            <>
              牌庫 <span className="text-base font-black">{deck.length}</span>
              <span className={T.sub}> / {DECK_SIZE}</span>
            </>
          )}
          {chip(
            <>
              手牌 <span className="text-base font-black">{hand.length}</span>
            </>
          )}
          {chip(
            <>
              棄牌 <span className="text-base font-black">{discard.length}</span>
            </>
          )}
          {vanguard.length > 0 && chip(`先鋒 ${vanguard.length} / ${MAX_VANGUARD}`)}
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {/* 花色對應 */}
        <div className={`p-2.5 rounded-xl ${suitOk ? T.bg : 'bg-red-50'} border ${suitOk ? T.border : 'border-red-300'}`}>
          <SectionTitle
            icon={GiSpades}
            right={
              !suitOk && (
                <button
                  type="button"
                  onClick={applyRecommendedSuits}
                  className="px-2 py-0.5 rounded-lg border border-red-300 bg-white text-[10px] font-bold text-red-800 cursor-pointer"
                >
                  套用建議對應
                </button>
              )
            }
          >
            花色對應傷害類型（建立角色時指定，四個花色必須互異）
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {SUITS.map((s) => {
              const SuitIcon = SUIT_ICON[s.key];
              return (
                <label key={s.key} className="flex items-center gap-1.5 text-[11px] font-bold">
                  {SuitIcon && <SuitIcon className="w-3.5 h-3.5 shrink-0" />}
                  <span className={T.text}>{s.name}</span>
                  <select
                    value={suitTypes[s.key] || s.defaultType}
                    onChange={(e) => write({ suitTypes: { ...suitTypes, [s.key]: e.target.value } })}
                    className={`flex-1 px-1 py-0.5 rounded border ${T.border} bg-white text-[11px] ${T.text} cursor-pointer`}
                  >
                    {DAMAGE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          {!suitOk && (
            <p className="mt-1.5 text-t12 font-bold text-red-800 flex items-center gap-1">
              <GiHazardSign className="w-3 h-3 shrink-0" />
              <span>有花色對應到同一種傷害類型——原書要求四個花色各不相同</span>
            </p>
          )}
        </div>

        {/* 衝突控制 */}
        {!inConflict ? (
          <button
            type="button"
            onClick={startConflict}
            className="w-full px-3 py-2.5 rounded-xl bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <GiCardRandom className="w-4 h-4" />
            <span>衝突開始：洗牌 30 張並抽 {STARTING_HAND} 張</span>
          </button>
        ) : (
          <>
            {/* 手牌 */}
            <div>
              <SectionTitle
                icon={GiCardPickup}
                right={
                  <span className={`text-[10px] font-mono ${T.sub}`}>
                    已選 {pickedCards.length} 張 / 需 {mpCost} MP（上限 {mpCap}）
                  </span>
                }
              >
                手牌（點擊選取，最多 {maxCards} 張）
              </SectionTitle>
              {hand.length === 0 ? (
                /* 空手牌：原本是 `text-[#6b5a4b]` 的一行「手牌已空」（白底 2.56:1）。
                   這裡說兩件事——牌去哪了、怎麼拿回來；否則玩家只會看到一個空白區塊。 */
                <div className="py-5 px-4 text-center bg-[#fbf7ee] rounded-xl border border-dashed border-[#d6c7ab] flex flex-col items-center justify-center">
                  <GiCardPickup className="w-7 h-7 text-[#7c6a58]" />
                  <p className="mt-2 font-bold text-[#3c2415] text-xs tracking-wide">手牌已空</p>
                  <p className="mt-1 text-[#6b5a4b] text-t12 leading-relaxed max-w-xs">
                    打出的牌會進棄牌堆；這一輪用完之後，下次抽牌的時機會重新發滿。
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                  {hand.map((c) =>
                    renderCard(c, {
                      selected: picked.includes(c.id),
                      onToggle: togglePick
                    })
                  )}
                </div>
              )}
            </div>

            {/* 小丑牌指定 */}
            {pickedJokers.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[#f9f5eb] border border-[#d6c7ab]">
                <SectionTitle
                  icon={GiCardJoker}
                  right={
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={applySuggestedJokers}
                        className="px-2 py-0.5 rounded-lg border border-[#d6c7ab] bg-white text-[10px] font-bold text-[#3c2415] cursor-pointer"
                      >
                        套用建議
                      </button>
                      <button
                        type="button"
                        onClick={clearJokerAssign}
                        className="px-2 py-0.5 rounded-lg border border-[#d6c7ab] bg-white text-[10px] font-bold text-[#3c2415] cursor-pointer"
                      >
                        清除指定
                      </button>
                    </div>
                  }
                >
                  小丑牌指定（原書：結算含小丑牌的組合時，由你指定其花色與數值 1～7）
                </SectionTitle>
                <div className="space-y-1.5">
                  {pickedJokers.map((c) => {
                    const a = jokerAssign[c.id];
                    return (
                      <div key={c.id} className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-[#3c2415]">小丑牌</span>
                        <select
                          value={a?.suit || ''}
                          onChange={(e) => e.target.value && setJokerSuit(c.id, e.target.value)}
                          className="px-1 py-0.5 rounded border border-[#d6c7ab] bg-white text-[11px] text-[#3c2415] cursor-pointer"
                        >
                          <option value="">花色…</option>
                          {SUITS.map((s) => (
                            <option key={s.key} value={s.key}>{s.name}</option>
                          ))}
                        </select>
                        <select
                          value={a?.value ?? ''}
                          onChange={(e) => e.target.value && setJokerValue(c.id, Number(e.target.value))}
                          className="px-1 py-0.5 rounded border border-[#d6c7ab] bg-white text-[11px] text-[#3c2415] cursor-pointer"
                        >
                          <option value="">數值…</option>
                          {Array.from({ length: CARDS_PER_SUIT }, (_, i) => i + 1).map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        {a && (
                          <span className="text-[10px] font-mono text-[#3c2415]">
                            → {suitName(a.suit)} {a.value}
                            {suitTypes[a.suit] ? `（${suitTypes[a.suit]}屬性）` : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-[#3c2415] flex items-start gap-1">
                  {jokersAssigned ? (
                    <GiCheckMark className="w-3 h-3 mt-0.5 shrink-0" />
                  ) : (
                    <GiHazardSign className="w-3 h-3 mt-0.5 shrink-0" />
                  )}
                  <span>
                    {jokersAssigned
                      ? '已指定——效果以你指定的花色與數值結算'
                      : '尚未全部指定——目前由程式窮舉所有可能（每張 28 種）自動判定；指定後花色才會影響傷害類型'}
                  </span>
                </p>
              </div>
            )}

            {/* 符合的效果 */}
            {pickedCards.length >= 2 && (
              <div className={`p-2.5 rounded-xl border ${matches.length > 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-[#fbf7ee] border-[#d6c7ab]'}`}>
                <div className="flex items-center gap-1.5 text-[11px] font-bold mb-1.5">
                  {matches.length > 0 ? (
                    <GiCheckMark className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <GiHazardSign className="w-3.5 h-3.5 text-[#6b5a4b]" />
                  )}
                  <span className={matches.length > 0 ? 'text-emerald-900' : 'text-[#3c2415]'}>
                    {matches.length === 0
                      ? '這組牌不符合任何效果——仍可打出（花 MP、棄牌、補抽），但不會產生效果'
                      : matches.length === 1
                        ? '符合一個效果'
                        : `符合 ${matches.length} 個效果——只能選一個套用`}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {matches.map((m) => {
                    const on = (chosenEffect || matches[0]?.id) === m.id;
                    // 【禁忌帝王】是全牌組最難湊齊的組合（4 張同值 ＋ 1 張小丑牌，共 5 張），
                    // 而且要先拿【被封印的儀式】才會出現在清單裡——給它一段專屬視覺。
                    const isMonarch = m.id === 'forbiddenMonarch';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setChosenEffect(m.id);
                          setStatusPicked([]);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                          isMonarch
                            ? on
                              ? 'bg-[#f4ebd9] border-[#3c2415] ring-2 ring-[#3c2415]'
                              : 'bg-[#fffdf9] border-[#d6c7ab]'
                            : on
                              ? 'bg-white border-emerald-500 ring-2 ring-emerald-400'
                              : 'bg-white/60 border-emerald-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {isMonarch && (
                            <span className="fu-icon text-[#6b5a4b] text-base leading-none" title="禁忌組合">
                              ◆
                            </span>
                          )}
                          <span className={`font-bold ${isMonarch ? 'text-[#2c221e]' : 'text-[#3c2415]'}`}>
                            {m.name}
                          </span>
                          <span className={`font-mono text-[10px] ${T.sub}`}>（{m.requirement}）</span>
                          {isMonarch && (
                            <span className="text-t12 font-bold px-1.5 py-0.5 rounded border border-[#3c2415] bg-[#f4ebd9] text-[#3c2415]">
                              禁忌
                            </span>
                          )}
                        </span>
                        <span
                          className={`block mt-0.5 ${isMonarch ? 'text-[#3c2415] font-bold' : 'text-[#3c2415]'}`}
                        >
                          {renderTextWithAffinities(m.describe)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 狀態滿貫：選兩種狀態 */}
                {effective?.id === 'fullStatus' && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    <div className={`text-[11px] font-bold ${T.text} mb-1`}>
                      {effective.highest % 2 === 0
                        ? '選兩種狀態：你與每個可見盟友從這兩種狀態恢復（需已選 2 種）'
                        : '選兩種狀態：每個可見敵人陷入這兩種狀態（需已選 2 種）'}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {FULL_STATUS_CHOICES.map((k) => {
                        const on = statusPicked.includes(k);
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => toggleStatusPick(k)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                              on ? 'bg-white border-emerald-500 ring-2 ring-emerald-400 text-emerald-900' : 'bg-white/60 border-emerald-200 text-[#6b5a4b]'
                            }`}
                          >
                            {STATUS_AFFLICTIONS[k]?.name || k}
                          </button>
                        );
                      })}
                      <span className={`text-[10px] font-mono ${T.sub}`}>已選 {statusPicked.length} / 2</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 結算 */}
            <button
              type="button"
              disabled={!canResolve}
              onClick={resolveSet}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 ${
                canResolve
                  ? 'bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] cursor-pointer'
                  : 'bg-[#f4ebd9] text-[#7c6a58] border border-[#e8dcc4] cursor-not-allowed'
              }`}
            >
              <GiDiceTwentyFacesTwenty className="w-4 h-4" />
              <span>
                {canResolve
                  ? effective
                    ? `結算【${effective.name}】——花費 ${mpCost} MP`
                    : `打出無效果組合——花費 ${mpCost} MP、補抽 ${pickedCards.length} 張`
                  : pickedCards.length < 2
                    ? '請至少選 2 張牌'
                    : pickedCards.length > maxCards
                      ? `最多只能選 ${maxCards} 張（SL ${magicCardsSL}）`
                      : !enoughMp
                        ? `MP 不足（需 ${mpCost}，現有 ${currentMp}）`
                        : '目前無法結算'}
              </span>
            </button>

            {/* 牌運亨通目前狀態 */}
            {hasHighOrLowState(highOrLow) && (
              <div className="p-2.5 rounded-xl bg-[#f9f5eb] border border-[#d6c7ab]">
                <SectionTitle icon={GiRollingDices}>牌運亨通（生效至你的下個回合開始）</SectionTitle>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {highOrLow.extraDamage > 0 && chip(`+${highOrLow.extraDamage} 傷害`, 'ok')}
                  {highOrLow.damageReduction > 0 && chip(`減傷 ${highOrLow.damageReduction}（親和之前）`, 'ok')}
                </div>
              </div>
            )}

            {/* 每回合限制（只有【陷阱卡】有；【再調度】原書沒有次數限制） */}
            <div className={`p-2.5 rounded-xl ${T.bg} border ${T.border} flex items-center justify-between flex-wrap gap-2`}>
              <span className={`text-[11px] font-bold ${T.text}`}>
                本回合：陷阱卡 {usedThisTurn.trap ? '已使用' : '未使用'}
                <span className={`font-normal ${T.sub}`}>（再調度沒有次數限制）</span>
              </span>
              <button
                type="button"
                onClick={startTurn}
                className={`px-2.5 py-1 rounded-lg border ${T.border} bg-white hover:bg-[#ebdcc4] text-[11px] font-bold ${T.sub} cursor-pointer`}
              >
                推進到下個回合
              </button>
            </div>

            {/* 再調度 */}
            {mulliganSL > 0 && (
              <details className={`p-2.5 rounded-xl bg-white border ${T.border}`} open={mulliganPicked.length > 0}>
                <summary className={`text-[11px] font-bold ${T.text} cursor-pointer flex items-center gap-1.5`}>
                  <GiCardRandom className="w-3.5 h-3.5 text-[#6b5a4b]" />
                  <span>再調度（SL {mulliganSL}：命中敵人後，自選至多 {mulliganLimit(mulliganSL)} 張棄掉並補抽）</span>
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono ${T.sub}`}>已選 {mulliganPicked.length} / {mulliganLimit(mulliganSL)}</span>
                    {hand.map((c) =>
                      renderCard(c, {
                        selected: mulliganPicked.includes(c.id),
                        onToggle: toggleMulliganPick
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={mulliganPicked.length === 0}
                    onClick={doMulligan}
                    className={`w-full px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      mulliganPicked.length === 0
                        ? 'bg-[#f4ebd9] text-[#7c6a58] border border-[#e8dcc4] cursor-not-allowed'
                        : 'bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] cursor-pointer'
                    }`}
                  >
                    {`棄 ${mulliganPicked.length} 張並補抽 ${mulliganPicked.length} 張`}
                  </button>
                </div>
              </details>
            )}

            {/* 陷阱卡 */}
            {trapSL > 0 && (
              <details className={`p-2.5 rounded-xl bg-white border ${T.border}`}>
                <summary className={`text-[11px] font-bold ${T.text} cursor-pointer flex items-center gap-1.5`}>
                  <GiTrapMask className="w-3.5 h-3.5 text-[#6b5a4b]" />
                  <span>陷阱卡（SL {trapSL}：敵人結算動作後，棄至多 {trapDiscardLimit(trapSL)} 張換免費施法）</span>
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <div className={`text-[10px] font-bold ${T.text} mb-1`}>
                      敵人剛結算的動作（花色需對應其傷害類型）
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {TRAP_ACTIONS.map((a) => {
                        const on = trapActionKey === a.key;
                        return (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => {
                              setTrapActionKey(a.key);
                              setTrapPicked([]);
                            }}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                              on ? 'bg-white border-[#3c2415] ring-2 ring-[#3c2415] text-[#3c2415]' : 'bg-white/60 border-[#d6c7ab] text-[#6b5a4b]'
                            }`}
                          >
                            {a.name}
                            <span className={`ml-1 text-[9px] font-mono ${T.sub}`}>{a.type}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {trapAction && (
                    <div>
                      <div className={`text-[10px] font-mono ${T.sub} mb-1`}>
                        符合的牌 {trapEligible.length} 張（小丑牌，或花色為{trapAction.type}）／已選 {trapPicked.length} / {trapDiscardLimit(trapSL)}
                      </div>
                      {trapEligible.length === 0 ? (
                        <p className="text-t12 text-[#6b5a4b]">手牌中沒有符合的牌——陷阱卡這次無法使用</p>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {hand.map((c) =>
                            renderCard(c, {
                              selectable: isTrapEligible(c, trapAction.type, suitTypes),
                              selected: trapPicked.includes(c.id),
                              onToggle: toggleTrapPick,
                              dim: !isTrapEligible(c, trapAction.type, suitTypes)
                            })
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={trapPicked.length === 0 || usedThisTurn.trap}
                        onClick={confirmTrapDiscard}
                        className={`mt-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                          trapPicked.length === 0 || usedThisTurn.trap
                            ? 'bg-[#f4ebd9] text-[#7c6a58] border border-[#e8dcc4] cursor-not-allowed'
                            : 'bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] cursor-pointer'
                        }`}
                      >
                        {usedThisTurn.trap
                          ? '本回合已使用過陷阱卡'
                          : `棄 ${trapPicked.length} 張並補抽 ${trapPicked.length} 張`}
                      </button>
                    </div>
                  )}

                  {trapDiscarded && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-300">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 mb-1">
                        <GiCardDraw className="w-3.5 h-3.5" />
                        <span>免費咒語動作：總 MP ≤ {trapCap}（MP 仍須自付）</span>
                      </div>
                      {trapSpells.length === 0 ? (
                        <p className="text-t12 text-emerald-900">
                          沒有總 MP ≤ {trapCap} 的咒語可施放
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {trapSpells.map((sp) => {
                            const cost = spellMpCost(sp);
                            const affordable = cost <= currentMp;
                            return (
                              <button
                                key={`${sp.school || ''}-${sp.name}`}
                                type="button"
                                disabled={!affordable}
                                onClick={() => castTrapSpell(sp)}
                                className={`w-full text-left px-2 py-1 rounded-lg border text-[11px] ${
                                  affordable
                                    ? 'bg-white border-emerald-400 cursor-pointer hover:bg-emerald-100'
                                    : 'bg-[#fffdf9] border-[#e8dcc4] text-[#7c6a58] cursor-not-allowed'
                                }`}
                              >
                                <span className="font-bold text-[#3c2415]">{sp.name}</span>
                                <span className={`font-mono text-[10px] ${T.sub} ml-1`}>
                                  {cost} MP{sp.mp && String(sp.mp) !== String(cost) ? `（${sp.mp}）` : ''}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* 其他動作 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={endConflict}
                className={`px-2.5 py-1.5 rounded-lg border ${T.border} bg-white hover:bg-[#ebdcc4] text-[11px] font-bold ${T.sub} cursor-pointer`}
              >
                衝突結束（全部洗回）
              </button>
            </div>

            {/* 棄牌堆 */}
            {discard.length > 0 && (
              <div>
                <SectionTitle icon={GiCardDiscard}>
                  棄牌堆（{discard.length} 張，順序不可改，任何人可查看）
                </SectionTitle>
                <div className="flex items-center gap-1 flex-wrap">
                  {discard.map((c) => renderCard(c, { selectable: false, size: 'xs' }))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 組合效果速查 */}
        <details className={`p-2.5 rounded-xl bg-white border ${T.border}`}>
          <summary className={`text-[11px] font-bold ${T.text} cursor-pointer flex items-center gap-1.5`}>
            <GiScrollUnfurled className="w-3.5 h-3.5 text-[#6b5a4b]" />
            <span>組合效果速查（{SET_EFFECTS.length} 種）</span>
          </summary>
          <div className="mt-2 space-y-2">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className={T.sub}>
                  <th className="text-left font-bold pb-1 pr-1 w-20">效果</th>
                  <th className="text-left font-bold pb-1 pr-1 w-24">需求</th>
                  <th className="text-left font-bold pb-1">效果內容</th>
                </tr>
              </thead>
              <tbody>
                {SET_EFFECTS.map((e) => (
                  <tr key={e.id} className="align-top border-t border-[#e8dfcb]">
                    <td className={`py-1 pr-1 font-bold ${T.text}`}>
                      {e.name}
                      {e.heroic && <span className={`block font-mono text-t12 ${T.sub}`}>需英雄技能</span>}
                    </td>
                    <td className={`py-1 pr-1 ${T.sub}`}>{e.requirement}</td>
                    <td className="py-1 text-[#3c2415]">{renderTextWithAffinities(e.reference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`text-t12 font-mono ${T.sub}`}>
              推薦花色對應：風(♦)、土(♣)、火(♥)、冰(♠)
            </p>
            <p className={`text-t12 font-mono ${T.sub}`}>
              炫目順子／雙重麻煩／魔法同花順：L20+ 額外 10 傷害、L40+ 額外 20 傷害
            </p>
            <p className={`text-t12 font-mono ${T.sub}`}>
              陷阱卡的動作對應：攻擊＝冰、目標＝火、技能＝土、咒語＝風
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
