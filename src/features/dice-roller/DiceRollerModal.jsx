import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import JRPGModal from '../../components/ui/JRPGModal';
import JRPGButton from '../../components/ui/JRPGButton';
import FUIcon from '../../components/ui/FUIcon';
import { GiSparkles, GiRollingDices, GiHazardSign, GiTrophyCup, GiCrossedSwords, GiHeartShield, GiCycle } from 'react-icons/gi';

const DICE_TIERS = [6, 8, 10, 12];

export default function DiceRollerModal({
  isOpen,
  onClose,
  initialConfig = null
}) {
  const [die1Type, setDie1Type] = useState(initialConfig?.die1 || 8);
  const [die2Type, setDie2Type] = useState(initialConfig?.die2 || 8);
  const [modifier, setModifier] = useState(initialConfig?.modifier !== undefined ? initialConfig.modifier : 0);
  const [rollLabel, setRollLabel] = useState(initialConfig?.label || '');
  const [rollResult, setRollResult] = useState(initialConfig?.initialRollResult || null);
  const [isRolling, setIsRolling] = useState(false);

  // 傷害結算狀態（由武器／攻擊咒語傳入 damageBonus 與 damageType 時自動啟用）
  const [damageBonus, setDamageBonus] = useState(
    initialConfig?.damageBonus !== undefined && initialConfig?.damageBonus !== null
      ? Number(initialConfig.damageBonus)
      : null
  );
  const [damageType, setDamageType] = useState(initialConfig?.damageType || '物理');
  const [zeroHr, setZeroHr] = useState(false);
  const [extraDamage, setExtraDamage] = useState(0);

  // 物語點（FP）重擲與羈絆激勵狀態（Core p.46）
  const [fpBonus, setFpBonus] = useState(0);
  const [usedBondName, setUsedBondName] = useState('');
  const [fpSpentCount, setFpSpentCount] = useState(0);
  const [fumbleClaimed, setFumbleClaimed] = useState(false);

  useEffect(() => {
    if (isOpen && initialConfig) {
      if (initialConfig.die1) setDie1Type(initialConfig.die1);
      if (initialConfig.die2) setDie2Type(initialConfig.die2);
      setModifier(initialConfig.modifier !== undefined ? initialConfig.modifier : 0);
      setRollLabel(initialConfig.label || '');
      setDamageBonus(
        initialConfig.damageBonus !== undefined && initialConfig.damageBonus !== null
          ? Number(initialConfig.damageBonus)
          : null
      );
      setDamageType(initialConfig.damageType || '物理');
      setZeroHr(false);
      setExtraDamage(0);
      setFpBonus(0);
      setUsedBondName('');
      setFpSpentCount(0);
      setFumbleClaimed(false);
      setRollResult(null);
    } else if (isOpen && !initialConfig) {
      setRollLabel('');
      setDamageBonus(null);
      setDamageType('物理');
      setZeroHr(false);
      setExtraDamage(0);
      setFpBonus(0);
      setUsedBondName('');
      setFpSpentCount(0);
      setFumbleClaimed(false);
    }
  }, [isOpen, initialConfig]);

  const computeRollOutcome = (r1, r2, mod) => {
    const total = r1 + r2 + mod;
    const hr = Math.max(r1, r2);
    const isCritical = r1 === r2 && r1 >= 6;
    const isFumble = r1 === 1 && r2 === 1;
    return {
      die1: r1,
      die2: r2,
      modifier: mod,
      total,
      hr,
      isCritical,
      isFumble
    };
  };

  const handleRoll = () => {
    setIsRolling(true);
    setTimeout(() => {
      const r1 = Math.floor(Math.random() * die1Type) + 1;
      const r2 = Math.floor(Math.random() * die2Type) + 1;
      const outcome = computeRollOutcome(r1, r2, modifier);

      setRollResult(outcome);
      setFpBonus(0);
      setUsedBondName('');
      setFumbleClaimed(false);
      setIsRolling(false);

      if (outcome.isCritical) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }, 200);
  };

  const character = initialConfig?.character || null;
  const onSpendFp = initialConfig?.onSpendFp || null;
  const onGainFp = initialConfig?.onGainFp || null;
  const availableFp = character
    ? Math.max(0, (character.fabulaPoints ?? 3) - fpSpentCount)
    : 0;

  // 引用特質重擲 1 顆或 2 顆骰子（Core p.46：消耗 1 點物語點，大失敗不可重擲）
  const handleRerollWithTrait = (target) => {
    if (!rollResult || rollResult.isFumble || availableFp <= 0) return;
    if (onSpendFp) onSpendFp('引用特質重擲檢定');
    setFpSpentCount(prev => prev + 1);

    const nextR1 = (target === 'die1' || target === 'both')
      ? Math.floor(Math.random() * die1Type) + 1
      : rollResult.die1;
    const nextR2 = (target === 'die2' || target === 'both')
      ? Math.floor(Math.random() * die2Type) + 1
      : rollResult.die2;
    const outcome = computeRollOutcome(nextR1, nextR2, rollResult.modifier);
    setRollResult(outcome);
    if (outcome.isCritical) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  // 激勵情感羈絆（Core p.46：每次檢定限一次，消耗 1 點物語點，加上該羈絆的情感強度）
  const handleInvokeBond = (bond) => {
    if (!rollResult || fpBonus > 0 || availableFp <= 0) return;
    const strength = Math.max(1, (bond.feelings || []).length);
    if (onSpendFp) onSpendFp(`激勵羈絆【${bond.target}】(+${strength})`);
    setFpSpentCount(prev => prev + 1);
    setFpBonus(strength);
    setUsedBondName(bond.target);
  };

  // 領取大失敗獎勵（Core p.44：雙 1 大失敗時獲得 1 點物語點）
  const handleClaimFumbleFp = () => {
    if (!rollResult?.isFumble || fumbleClaimed || !onGainFp) return;
    onGainFp('大失敗獲得物語點');
    setFumbleClaimed(true);
  };

  const finalCheckTotal = rollResult ? rollResult.total + fpBonus : 0;
  const effectiveHr = rollResult ? (zeroHr ? 0 : rollResult.hr) : 0;
  const hasDamageCalc = damageBonus !== null && damageBonus !== undefined && !Number.isNaN(damageBonus);
  const totalDamage = hasDamageCalc
    ? Math.max(0, effectiveHr + Number(damageBonus) + extraDamage)
    : null;

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title={rollLabel ? `FU 檢定擲骰 · ${rollLabel}` : "FU 雙屬性擲骰器"}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Dice selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f4ebd9] p-3 rounded border border-[#d6c7ab] flex flex-col items-center gap-1.5">
            <span className="text-xs text-[#6b5a4b] font-medium">第一顆骰階</span>
            <div className="flex gap-1">
              {DICE_TIERS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDie1Type(d)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors ${
                    die1Type === d
                      ? 'bg-[#a63d40] text-[#fffdf9] shadow-sm'
                      : 'bg-[#fffdf9] border border-[#d6c7ab] text-[#6b5a4b] hover:text-[#2c221e]'
                  }`}
                >
                  d{d}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#f4ebd9] p-3 rounded border border-[#d6c7ab] flex flex-col items-center gap-1.5">
            <span className="text-xs text-[#6b5a4b] font-medium">第二顆骰階</span>
            <div className="flex gap-1">
              {DICE_TIERS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDie2Type(d)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors ${
                    die2Type === d
                      ? 'bg-[#a63d40] text-[#fffdf9] shadow-sm'
                      : 'bg-[#fffdf9] border border-[#d6c7ab] text-[#6b5a4b] hover:text-[#2c221e]'
                  }`}
                >
                  d{d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modifier */}
        <div className="flex items-center justify-between bg-[#f4ebd9] p-3 rounded border border-[#d6c7ab] text-xs">
          <span className="text-[#2c221e] font-medium">檢定固定加值</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModifier(prev => prev - 1)}
              className="px-2.5 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-[#2c221e] font-mono hover:bg-[#f4ebd9]"
            >
              -
            </button>
            <span className="font-mono font-bold text-[#3c2415] text-sm w-8 text-center">
              {modifier >= 0 ? `+${modifier}` : modifier}
            </span>
            <button
              type="button"
              onClick={() => setModifier(prev => prev + 1)}
              className="px-2.5 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-[#2c221e] font-mono hover:bg-[#f4ebd9]"
            >
              +
            </button>
          </div>
        </div>

        {/* Roll Button */}
        <JRPGButton
          variant="primary"
          size="lg"
          className="w-full font-bold"
          icon={GiRollingDices}
          disabled={isRolling}
          onClick={handleRoll}
        >
          {isRolling ? '骰子旋轉中...' : `擲骰 【d${die1Type} + d${die2Type}】${modifier !== 0 ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ''}`}
        </JRPGButton>

        {/* Results Box */}
        {rollResult && (
          <div className={`p-4 rounded border flex flex-col items-center gap-2.5 text-center transition-all ${
            rollResult.isCritical
              ? 'bg-[#f9f5eb] border-[#3c2415] shadow-md'
              : rollResult.isFumble
                ? 'bg-[#f9f5eb] border-[#8c2d36] shadow-md'
                : 'bg-[#f4ebd9] border border-[#d6c7ab]'
          }`}>
            {rollResult.isCritical && (
              <div className="text-[#3c2415] font-bold text-sm flex items-center gap-1.5">
                <GiTrophyCup className="w-5 h-5 text-[#6b5a4b]" /> ✦ CRITICAL SUCCESS 大成功！ ✦
              </div>
            )}

            {rollResult.isFumble && (
              <div className="flex flex-col items-center gap-1.5">
                <div className="text-[#8c2d36] font-bold text-sm flex items-center gap-1.5">
                  <GiHazardSign className="w-5 h-5 text-[#8c2d36]" /> [FUMBLE 大失敗]（獲得 1 點物語點）
                </div>
                {onGainFp && (
                  <button
                    type="button"
                    disabled={fumbleClaimed}
                    onClick={handleClaimFumbleFp}
                    className="px-3 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] disabled:opacity-50 text-[#fffdf9] font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <GiSparkles className="w-3.5 h-3.5" />
                    <span>{fumbleClaimed ? '已入帳 +1 FP' : '領取大失敗獎勵 (+1 FP)'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Dice Values */}
            <div className="flex items-center gap-3 my-1 flex-wrap justify-center">
              <div className="w-14 h-14 rounded bg-[#fffdf9] border border-[#d6c7ab] flex flex-col items-center justify-center font-mono">
                <span className="text-t10 text-[#7c6a58]">d{die1Type}</span>
                <span className="text-2xl font-bold text-[#2c221e]">{rollResult.die1}</span>
              </div>
              <span className="text-[#7c6a58] font-mono text-xl font-bold">+</span>
              <div className="w-14 h-14 rounded bg-[#fffdf9] border border-[#d6c7ab] flex flex-col items-center justify-center font-mono">
                <span className="text-t10 text-[#7c6a58]">d{die2Type}</span>
                <span className="text-2xl font-bold text-[#2c221e]">{rollResult.die2}</span>
              </div>
              {rollResult.modifier !== 0 && (
                <>
                  <span className="text-[#7c6a58] font-mono text-xl font-bold">+</span>
                  <div className="w-10 h-10 rounded bg-[#fffdf9] border border-[#d6c7ab] flex items-center justify-center font-mono text-[#3c2415] font-bold text-sm">
                    {rollResult.modifier > 0 ? `+${rollResult.modifier}` : rollResult.modifier}
                  </div>
                </>
              )}
              {fpBonus > 0 && (
                <>
                  <span className="text-[#7c6a58] text-xl font-bold">+</span>
                  <div
                    className="px-2 h-10 rounded bg-[#fffdf9] border border-[#a63d40] flex flex-col items-center justify-center text-[#8c3235] font-bold text-xs"
                    title={`激勵羈絆：${usedBondName}`}
                  >
                    <span>+{fpBonus}</span>
                    <span className="text-t10">羈絆</span>
                  </div>
                </>
              )}
            </div>

            {/* Total & High Roll */}
            <div className="flex items-center gap-6 pt-1.5 border-t border-[#d6c7ab] w-full justify-center text-xs font-mono">
              <div>
                <span className="text-[#6b5a4b]">檢定總值: </span>
                <strong className="text-lg text-[#3c2415] font-bold">{finalCheckTotal}</strong>
              </div>
              <div>
                <span className="text-[#6b5a4b]">高點 HR: </span>
                <strong className="text-lg text-[#3c2415] font-bold">{effectiveHr}</strong>
                {zeroHr && <span className="text-t10 text-[#8c3235] ml-1">(視為0)</span>}
              </div>
            </div>

            {/* 一鍵傷害結算區（武器／攻擊咒語自動帶入） */}
            {hasDamageCalc && (
              <div className="w-full mt-1 p-3 rounded bg-[#fffdf9] border border-[#d6c7ab] space-y-2 text-left">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#3c2415] flex items-center gap-1">
                    <GiCrossedSwords className="w-3.5 h-3.5 text-[#8c3235]" />
                    <span>命中傷害直算</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setZeroHr(prev => !prev)}
                    className={`px-2 py-0.5 rounded border text-t11 font-bold transition-colors ${
                      zeroHr
                        ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]'
                        : 'bg-[#f4ebd9] border-[#d6c7ab] text-[#6b5a4b] hover:text-[#2c221e]'
                    }`}
                    title="部分特技或多重目標攻擊要求將高點（HR）視為 0"
                  >
                    將 HR 視為 0
                  </button>
                </div>

                <div className="flex items-baseline justify-between gap-2 bg-[#f4ebd9] px-3 py-2 rounded border border-[#e8dcc4]">
                  <span className="text-xs text-[#6b5a4b] font-bold">
                    【{zeroHr ? 'HR(0)' : `HR(${rollResult.hr})`} + {damageBonus}
                    {extraDamage !== 0 ? (extraDamage > 0 ? ` + ${extraDamage}` : ` - ${Math.abs(extraDamage)}`) : ''}】
                  </span>
                  <span className="text-base font-black text-[#8c3235] flex items-center gap-1">
                    <span>= {totalDamage} 點</span>
                    <FUIcon name={damageType} className="text-sm" />
                    <span className="text-xs font-bold text-[#3c2415]">{damageType}傷害</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1.5 text-t11">
                  <span className="text-[#6b5a4b]">額外傷害修正（特技／弱點前）：</span>
                  <div className="flex items-center gap-1">
                    {[-5, -1, 1, 5].map(delta => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => setExtraDamage(prev => prev + delta)}
                        className="px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] border border-[#d6c7ab] text-[#3c2415] font-bold"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                    {extraDamage !== 0 && (
                      <button
                        type="button"
                        onClick={() => setExtraDamage(0)}
                        className="px-1.5 py-0.5 rounded text-[#8c3235] hover:underline"
                      >
                        重設
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 物語點（FP）戰術介入：引用特質重擲 ＆ 激勵羈絆（Core p.46） */}
            {character && !rollResult.isFumble && (
              <div className="w-full mt-1 p-3 rounded bg-[#fffdf9] border border-[#d6c7ab] space-y-2 text-left text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#3c2415] flex items-center gap-1">
                    <GiSparkles className="w-3.5 h-3.5 text-[#6b5a4b]" />
                    <span>物語點介入</span>
                  </span>
                  <span className="text-t11 font-bold text-[#6b5a4b]">
                    可用 FP：{availableFp}
                  </span>
                </div>

                {(character.identity || character.theme || character.origin) && (
                  <p className="text-t12 text-[#6b5a4b] leading-snug bg-[#fbf7ee] px-2 py-1 rounded border border-[#e8dcc4]">
                    可引用特質：{character.identity || '無身份'} · {character.theme || '無主題'}
                    {character.origin ? ` · ${character.origin}` : ''}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={availableFp <= 0}
                    onClick={() => handleRerollWithTrait('die1')}
                    className="py-1 px-1.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] disabled:opacity-40 border border-[#d6c7ab] text-[#3c2415] font-bold text-t11 flex items-center justify-center gap-1 transition-colors"
                    title="消耗 1 FP 引用特質重擲第一顆骰子"
                  >
                    <GiCycle className="w-3 h-3 shrink-0" />
                    <span>重擲首顆({rollResult.die1})</span>
                  </button>
                  <button
                    type="button"
                    disabled={availableFp <= 0}
                    onClick={() => handleRerollWithTrait('die2')}
                    className="py-1 px-1.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] disabled:opacity-40 border border-[#d6c7ab] text-[#3c2415] font-bold text-t11 flex items-center justify-center gap-1 transition-colors"
                    title="消耗 1 FP 引用特質重擲第二顆骰子"
                  >
                    <GiCycle className="w-3 h-3 shrink-0" />
                    <span>重擲次顆({rollResult.die2})</span>
                  </button>
                  <button
                    type="button"
                    disabled={availableFp <= 0}
                    onClick={() => handleRerollWithTrait('both')}
                    className="py-1 px-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] disabled:opacity-40 text-[#fffdf9] font-bold text-t11 flex items-center justify-center gap-1 transition-colors"
                    title="消耗 1 FP 引用特質重擲兩顆骰子"
                  >
                    <GiCycle className="w-3 h-3 shrink-0" />
                    <span>雙骰重擲(-1FP)</span>
                  </button>
                </div>

                {(character.bonds || []).length > 0 && (
                  <div className="pt-1.5 border-t border-[#e8dcc4] space-y-1">
                    <span className="text-t11 font-bold text-[#6b5a4b] flex items-center gap-1">
                      <GiHeartShield className="w-3 h-3 text-[#8c3235]" />
                      <span>
                        {fpBonus > 0
                          ? `已激勵【${usedBondName}】獲得 +${fpBonus} 加值（每次檢定限一次）`
                          : '消耗 1 FP 激勵情感羈絆（加上情感數）：'}
                      </span>
                    </span>
                    {fpBonus === 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(character.bonds || []).map((b, idx) => {
                          const strength = Math.max(1, (b.feelings || []).length);
                          return (
                            <button
                              key={b.id || idx}
                              type="button"
                              disabled={availableFp <= 0}
                              onClick={() => handleInvokeBond(b)}
                              className="px-2 py-0.5 rounded bg-[#f4ebd9] hover:bg-[#e8dcc4] disabled:opacity-40 border border-[#d6c7ab] text-[#8c3235] font-bold text-t11 transition-colors"
                            >
                              {b.target} (+{strength})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </JRPGModal>
  );
}
