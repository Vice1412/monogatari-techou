import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import JRPGModal from '../../components/ui/JRPGModal';
import JRPGButton from '../../components/ui/JRPGButton';
import { GiSparkles, GiRollingDices, GiHazardSign, GiTrophyCup } from 'react-icons/gi';

const DICE_TIERS = [6, 8, 10, 12];

export default function DiceRollerModal({
  isOpen,
  onClose,
  initialConfig = null
}) {
  const [die1Type, setDie1Type] = useState(8);
  const [die2Type, setDie2Type] = useState(8);
  const [modifier, setModifier] = useState(0);
  const [rollLabel, setRollLabel] = useState('');
  const [rollResult, setRollResult] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (isOpen && initialConfig) {
      if (initialConfig.die1) setDie1Type(initialConfig.die1);
      if (initialConfig.die2) setDie2Type(initialConfig.die2);
      if (initialConfig.modifier !== undefined) setModifier(initialConfig.modifier);
      if (initialConfig.label) setRollLabel(initialConfig.label);
      setRollResult(null);
    } else if (isOpen && !initialConfig) {
      setRollLabel('');
    }
  }, [isOpen, initialConfig]);

  const handleRoll = () => {
    setIsRolling(true);
    setTimeout(() => {
      const r1 = Math.floor(Math.random() * die1Type) + 1;
      const r2 = Math.floor(Math.random() * die2Type) + 1;
      const total = r1 + r2 + modifier;
      const hr = Math.max(r1, r2);
      const isCritical = r1 === r2 && r1 >= 6;
      const isFumble = r1 === 1 && r2 === 1;

      setRollResult({
        die1: r1,
        die2: r2,
        modifier,
        total,
        hr,
        isCritical,
        isFumble
      });
      setIsRolling(false);

      if (isCritical) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }, 200);
  };

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title={rollLabel ? `FU 檢定擲骰 · ${rollLabel}` : "FU 雙屬性擲骰器"}
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        {/* Dice selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f5efdf] p-3 rounded-xl border border-[#d6c7ab] flex flex-col items-center gap-1.5">
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

          <div className="bg-[#f5efdf] p-3 rounded-xl border border-[#d6c7ab] flex flex-col items-center gap-1.5">
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
        <div className="flex items-center justify-between bg-[#f5efdf] p-3 rounded-xl border border-[#d6c7ab] text-xs">
          <span className="text-[#2c221e] font-medium">檢定固定加值</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModifier(prev => prev - 1)}
              className="px-2.5 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-[#2c221e] font-mono hover:bg-[#eee6d3]"
            >
              -
            </button>
            <span className="font-mono font-bold text-[#3c2415] text-sm w-8 text-center">
              {modifier >= 0 ? `+${modifier}` : modifier}
            </span>
            <button
              onClick={() => setModifier(prev => prev + 1)}
              className="px-2.5 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-[#2c221e] font-mono hover:bg-[#eee6d3]"
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
          <div className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
            rollResult.isCritical
              ? 'bg-[#f9f5eb] border-[#3c2415] shadow-md'
              : rollResult.isFumble
                ? 'bg-[#f9f5eb] border-[#8c2d36] shadow-md'
                : 'bg-[#f5efdf] border border-[#d6c7ab]'
          }`}>
            {rollResult.isCritical && (
              <div className="text-[#3c2415] font-bold text-sm flex items-center gap-1.5">
                <GiTrophyCup className="w-5 h-5 text-[#6b5a4b]" /> ✦ CRITICAL SUCCESS 大成功！ ✦
              </div>
            )}

            {rollResult.isFumble && (
              <div className="text-[#8c2d36] font-bold text-sm flex items-center gap-1.5">
                <GiHazardSign className="w-5 h-5 text-[#8c2d36]" /> [FUMBLE 大失敗]（獲得 1 點物語點）
              </div>
            )}

            {/* Dice Values */}
            <div className="flex items-center gap-4 my-1">
              <div className="w-14 h-14 rounded-xl bg-[#fffdf9] border border-[#d6c7ab] flex flex-col items-center justify-center font-mono">
                <span className="text-[10px] text-[#7c6a58]">d{die1Type}</span>
                <span className="text-2xl font-bold text-[#2c221e]">{rollResult.die1}</span>
              </div>
              <span className="text-[#7c6a58] font-mono text-xl font-bold">+</span>
              <div className="w-14 h-14 rounded-xl bg-[#fffdf9] border border-[#d6c7ab] flex flex-col items-center justify-center font-mono">
                <span className="text-[10px] text-[#7c6a58]">d{die2Type}</span>
                <span className="text-2xl font-bold text-[#2c221e]">{rollResult.die2}</span>
              </div>
              {rollResult.modifier !== 0 && (
                <>
                  <span className="text-[#7c6a58] font-mono text-xl font-bold">+</span>
                  <div className="w-10 h-10 rounded-lg bg-[#fffdf9] border border-[#d6c7ab] flex items-center justify-center font-mono text-[#3c2415] font-bold text-sm">
                    {rollResult.modifier > 0 ? `+${rollResult.modifier}` : rollResult.modifier}
                  </div>
                </>
              )}
            </div>

            {/* Total & High Roll */}
            <div className="flex items-center gap-6 pt-1 border-t border-[#d6c7ab] w-full justify-center text-xs font-mono">
              <div>
                <span className="text-[#6b5a4b]">檢定總值: </span>
                <strong className="text-lg text-[#3c2415] font-bold">{rollResult.total}</strong>
              </div>
              <div>
                <span className="text-[#6b5a4b]">高點 HR: </span>
                <strong className="text-lg text-sky-800 font-bold">{rollResult.hr}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </JRPGModal>
  );
}
