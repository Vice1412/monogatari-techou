import React, { useMemo, useState } from 'react';
import {
  GiCompass,
  GiRollingDices,
  GiBackpack,
  GiCookingPot,
  GiSparkles,
  GiHazardSign
} from 'react-icons/gi';
import {
  TRAVEL_THREAT_LEVELS,
  resolveTravelDie,
  dieSides,
  evalTravelRoll,
  applyTravelOutcome
} from '../../utils/travelRoll';
import { getCharacterSkillSL } from '../../utils/characterEngine';
import { TASTES, ingredientCapacity } from '../../data/gourmetData';
import { formatCompanionItemCopyText } from '../../utils/playCopyFormat';
import CopyTextButton from '../../../../components/ui/CopyTextButton';

/**
 * 判斷角色是否持有任一旅行移動相關職業技能。
 */
export function hasTravelSkills(character) {
  return (
    getCharacterSkillSL(character, '有備無患') > 0
    || getCharacterSkillSL(character, '寶藏獵人') > 0
    || getCharacterSkillSL(character, '通曉道路') > 0
    || getCharacterSkillSL(character, '準備食材') > 0
  );
}

/**
 * 旅行移動骰結算面板（Travel Roll Panel）
 * 承載旅人【通曉道路】、【有備無患】、【寶藏獵人】與美食家【準備食材】。
 */
export default function TravelRollPanel({
  character,
  stats = null,
  onChange,
  showToast = () => {}
}) {
  const [threatDie, setThreatDie] = useState('d10');
  const [chosenTaste, setChosenTaste] = useState(TASTES[0]);
  const [manualRollInput, setManualRollInput] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const wellPreparedSL = getCharacterSkillSL(character, '有備無患');
  const treasureHunterSL = getCharacterSkillSL(character, '寶藏獵人');
  const knowRoadsSL = getCharacterSkillSL(character, '通曉道路');
  const prepareDelicaciesSL = getCharacterSkillSL(character, '準備食材');
  const cookingSL = getCharacterSkillSL(character, '烹飪');

  const actualDie = useMemo(
    () => resolveTravelDie(threatDie, knowRoadsSL),
    [threatDie, knowRoadsSL]
  );
  const sides = dieSides(actualDie);
  const discoveryMax = 1 + Math.min(2, treasureHunterSL);

  const existingIngredients = Array.isArray(character?.gourmetData?.ingredients)
    ? character.gourmetData.ingredients
    : [];
  const ingCapacity = cookingSL > 0 ? ingredientCapacity(cookingSL) : 0;

  if (!hasTravelSkills(character)) {
    return null;
  }

  const handleRollAndApply = () => {
    const parsedManual = manualRollInput.trim() === ''
      ? null
      : Math.floor(Number(manualRollInput));

    if (
      parsedManual !== null
      && (!Number.isFinite(parsedManual) || parsedManual < 1 || parsedManual > sides)
    ) {
      showToast(`手動輸入的點數須介於 1 ~ ${sides} 之間（${actualDie}）`, 'warning');
      return;
    }

    const rollValue = parsedManual !== null
      ? parsedManual
      : (Math.floor(Math.random() * sides) + 1);

    const expectedCount = cookingSL > 0 && prepareDelicaciesSL > 0 ? prepareDelicaciesSL * 2 : 0;
    const tasteRolls = Array.from({ length: expectedCount }, () => Math.floor(Math.random() * 6) + 1);

    const outcome = evalTravelRoll({
      roll: rollValue,
      die: actualDie,
      wellPreparedSL,
      treasureHunterSL,
      prepareDelicaciesSL,
      cookingSL,
      tasteRolls,
      chosenTaste
    });

    const applied = applyTravelOutcome(character, outcome, stats);
    if (!applied.ok) {
      showToast(applied.reason || '旅行結算失敗', 'warning');
      return;
    }

    onChange(applied.character);
    setLastResult({
      outcome,
      ipDelta: applied.ipDelta,
      nextIp: applied.nextIp,
      maxIp: applied.maxIp,
      addedIngredients: applied.addedIngredients,
      discardedIngredients: applied.discardedIngredients,
      summary: applied.summary
    });
    showToast(applied.summary, outcome.isDanger ? 'warning' : 'success');
  };

  return (
    <div
      data-testid="travel-roll-panel"
      className="p-3 rounded bg-[#fbf7ee] border border-[#d6c7ab] space-y-3 text-xs"
    >
      {/* 標題與持有技能提示 */}
      <div className="flex items-start justify-between gap-2 flex-wrap border-b border-[#e8dcc4] pb-2">
        <div className="space-y-1">
          <div className="font-serif font-black text-sm text-[#3c2415] flex items-center gap-1.5">
            <GiCompass className="w-4 h-4 text-[#8c3235]" />
            <span>旅行移動骰結算</span>
          </div>
          <p className="text-t12 text-[#6b5a4b]">
            擲出 6 或更高遭遇危險，擲出 1（含寶藏獵人加成後 ≤ {discoveryMax}）獲得意外發現。
          </p>
        </div>

        {lastResult && (
          <CopyTextButton
            testId="copy-travel-result"
            label="複製結果"
            toastLabel="旅行移動結果"
            showToast={showToast}
            getText={() =>
              formatCompanionItemCopyText({
                category: '旅行移動結算',
                name: `${lastResult.outcome.die} 擲出 ${lastResult.outcome.roll}`,
                subtitle: lastResult.outcome.outcomeLabel,
                lines: [
                  lastResult.ipDelta > 0 ? `▸ 有備無患：IP +${lastResult.ipDelta}（現有 ${lastResult.nextIp}/${lastResult.maxIp}）` : null,
                  lastResult.addedIngredients.length > 0
                    ? `▸ 準備食材：獲得 ${lastResult.addedIngredients.map((it) => it.taste).join('、')}`
                    : null,
                  lastResult.discardedIngredients.length > 0
                    ? `▸ 背包已滿：另有 ${lastResult.discardedIngredients.length} 份食材未收入`
                    : null
                ].filter(Boolean),
                characterName: character?.name || ''
              })
            }
          />
        )}
      </div>

      {/* 生效中的旅行技能標籤 */}
      <div className="flex flex-wrap gap-1.5">
        {knowRoadsSL > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#245c45] font-bold text-t11">
            ✦ 通曉道路 SL {knowRoadsSL}（旅行骰降一階，最低 d6）
          </span>
        )}
        {wellPreparedSL > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415] font-bold text-t11 inline-flex items-center gap-1">
            <GiBackpack className="w-3 h-3 text-[#8c3235]" />
            <span>有備無患 SL {wellPreparedSL}（每次 +{wellPreparedSL} IP）</span>
          </span>
        )}
        {treasureHunterSL > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#27527a] font-bold text-t11 inline-flex items-center gap-1">
            <GiSparkles className="w-3 h-3 text-[#27527a]" />
            <span>寶藏獵人 SL {treasureHunterSL}（擲出 ≤ {discoveryMax} 獲發現）</span>
          </span>
        )}
        {prepareDelicaciesSL > 0 && cookingSL > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415] font-bold text-t11 inline-flex items-center gap-1">
            <GiCookingPot className="w-3 h-3 text-[#8c3235]" />
            <span>準備食材 SL {prepareDelicaciesSL}（+{prepareDelicaciesSL * 2} 份｜背包 {existingIngredients.length}/{ingCapacity}）</span>
          </span>
        )}
        {prepareDelicaciesSL > 0 && cookingSL <= 0 && (
          <span className="px-2 py-0.5 rounded bg-[#f9f5eb] border border-[#8c3235] text-[#8c3235] font-bold text-t11 inline-flex items-center gap-1">
            <GiHazardSign className="w-3 h-3" />
            <span>準備食材需先習得【烹飪】才能收集食材</span>
          </span>
        )}
      </div>

      {/* 操作控制列 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end bg-[#fffdf9] p-2.5 rounded border border-[#e8dcc4]">
        <label className="block space-y-1">
          <span className="block text-t11 font-bold text-[#6b5a4b]">區域威脅等級</span>
          <select
            data-testid="travel-threat-select"
            value={threatDie}
            onChange={(e) => setThreatDie(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
          >
            {TRAVEL_THREAT_LEVELS.map((lv) => (
              <option key={lv.die} value={lv.die}>
                {lv.label}（{lv.die}）
              </option>
            ))}
          </select>
        </label>

        {prepareDelicaciesSL > 0 && cookingSL > 0 ? (
          <label className="block space-y-1">
            <span className="block text-t11 font-bold text-[#6b5a4b]">口味骰 6 時自選口味</span>
            <select
              data-testid="travel-chosen-taste"
              value={chosenTaste}
              onChange={(e) => setChosenTaste(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
            >
              {TASTES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="text-t11 text-[#6b5a4b] px-2.5 py-1.5 rounded bg-[#f9f5eb] border border-[#e8dcc4]">
            {knowRoadsSL > 0 && actualDie !== threatDie
              ? `通曉道路生效：${threatDie} ➔ ${actualDie}`
              : `本次擲骰規格：${actualDie}`}
          </div>
        )}

        <label className="block space-y-1">
          <span className="block text-t11 font-bold text-[#6b5a4b]">指定點數（留空則隨機）</span>
          <input
            type="number"
            min={1}
            max={sides}
            data-testid="travel-manual-roll"
            value={manualRollInput}
            onChange={(e) => setManualRollInput(e.target.value)}
            placeholder={`1 ~ ${sides}（選填）`}
            className="w-full px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold tabular-nums text-xs"
          />
        </label>

        <button
          type="button"
          data-testid="travel-roll-btn"
          onClick={handleRollAndApply}
          className="w-full px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
        >
          <GiRollingDices className="w-4 h-4 shrink-0" />
          <span>擲 {actualDie} 並結算</span>
        </button>
      </div>

      {knowRoadsSL > 0 && prepareDelicaciesSL > 0 && cookingSL > 0 && (
        <div className="text-t11 font-bold text-[#245c45]">
          ※ {actualDie !== threatDie
            ? `通曉道路已將威脅骰由 ${threatDie} 降至 ${actualDie}。`
            : `威脅骰已達最低規格 ${actualDie}。`}
        </div>
      )}

      {/* 最近一次結算卡片 */}
      {lastResult && (
        <div
          data-testid="travel-last-outcome"
          className="p-2.5 rounded bg-[#fffdf9] border border-[#d6c7ab] space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[#3c2415] tabular-nums">
              {lastResult.outcome.die} 擲出 {lastResult.outcome.roll}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-t11 font-bold border ${
                lastResult.outcome.isDanger
                  ? 'bg-[#f9f5eb] border-[#8c3235] text-[#8c3235]'
                  : lastResult.outcome.isDiscovery
                    ? 'bg-[#f4ebd9] border-[#245c45] text-[#245c45]'
                    : 'bg-[#f4ebd9] border-[#d6c7ab] text-[#3c2415]'
              }`}
            >
              {lastResult.outcome.outcomeLabel}
            </span>
          </div>

          <div className="text-t12 text-[#6b5a4b] space-y-0.5">
            {wellPreparedSL > 0 && (
              <div>
                ▸ 有備無患：{lastResult.ipDelta > 0
                  ? `恢復 ${lastResult.ipDelta} 點 IP（現有 ${lastResult.nextIp}/${lastResult.maxIp}）`
                  : `IP 已滿（${lastResult.nextIp}/${lastResult.maxIp}）`}
              </div>
            )}
            {lastResult.outcome.tasteRollBreakdown.length > 0 && (
              <div>
                ▸ 準備食材：
                {lastResult.outcome.tasteRollBreakdown.map((item, idx) => (
                  <span key={idx} className="inline-block mr-2">
                    [d6={item.roll} {item.wasPlayerChoice ? `自選 ➔ ${item.taste}` : item.taste}]
                  </span>
                ))}
                {lastResult.discardedIngredients.length > 0 && (
                  <span className="text-[#8c3235] font-bold">
                    （背包已滿，{lastResult.discardedIngredients.length} 份未收入）
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
