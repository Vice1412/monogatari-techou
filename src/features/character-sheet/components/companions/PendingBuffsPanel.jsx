import React, { useMemo, useState } from 'react';
import {
  GiSparkles,
  GiPocketWatch,
  GiCheckMark,
  GiShield,
  GiHazardSign
} from 'react-icons/gi';
import { Trash2 } from 'lucide-react';
import {
  getPendingBuffs,
  removePendingBuff,
  clearPendingBuffs,
  arcaneWeaponStatus,
  applySupportMagic,
  applyIBelieveInYou,
  applySmoothTalker
} from '../../utils/pendingBuffs';
import { getCharacterSkillSL, resolveVitalResources } from '../../utils/characterEngine';
import { resolveFabulaPoints } from '../../utils/fabulaPointsFlow';
import { formatCompanionItemCopyText } from '../../utils/playCopyFormat';
import CopyTextButton from '../../../../components/ui/CopyTextButton';
import EmptyState from '../../../../components/ui/EmptyState';

/**
 * 判斷角色是否需要顯示跨角色支援／場景暫存增益面板。
 */
export function hasPendingBuffFeatures(character) {
  return (
    getCharacterSkillSL(character, '支援魔法') > 0
    || getCharacterSkillSL(character, '我相信你') > 0
    || getCharacterSkillSL(character, '能言善辯') > 0
    || getPendingBuffs(character).length > 0
  );
}

/**
 * 場景增益與隊友支援面板（Pending Buffs Panel）
 * 承載靈師【支援魔法】、吟唱者【我相信你】與【能言善辯】，並管理本場景待生效增益。
 */
export default function PendingBuffsPanel({
  character,
  stats = null,
  onChange,
  showToast = () => {}
}) {
  const supportMagicSL = getCharacterSkillSL(character, '支援魔法');
  const believeSL = getCharacterSkillSL(character, '我相信你');
  const smoothTalkerSL = getCharacterSkillSL(character, '能言善辯');

  const buffs = getPendingBuffs(character);
  const bonds = useMemo(
    () => (Array.isArray(character?.bonds) ? character.bonds : []),
    [character?.bonds]
  );
  const feltBonds = useMemo(
    () => bonds.filter((b) => b && b.target && Array.isArray(b.feelings) && b.feelings.length > 0),
    [bonds]
  );
  const clocks = useMemo(
    () => (Array.isArray(character?.clocks) ? character.clocks : []),
    [character?.clocks]
  );

  const arcaneStatus = arcaneWeaponStatus(character);
  const { curMp, maxMp } = resolveVitalResources(character, stats);
  const curFp = resolveFabulaPoints(character);

  const [selectedBondId, setSelectedBondId] = useState(feltBonds[0]?.id || '');
  const [believeTarget, setBelieveTarget] = useState(bonds[0]?.target || '');
  const [believeTrait, setBelieveTrait] = useState('');
  const [believeMode, setBelieveMode] = useState('reroll');

  const [smoothApproach, setSmoothApproach] = useState('外交');
  const [smoothAction, setSmoothAction] = useState('fill');
  const [smoothTicks, setSmoothTicks] = useState(1);
  const [smoothClockId, setSmoothClockId] = useState('');

  if (!hasPendingBuffFeatures(character)) {
    return null;
  }

  const effectiveBondId = feltBonds.some((b) => b.id === selectedBondId)
    ? selectedBondId
    : (feltBonds[0]?.id || '');

  const effectiveTicks = Math.max(1, Math.min(Math.max(1, smoothTalkerSL), smoothTicks));
  const smoothMpCost = effectiveTicks * 20;

  const handleSupportMagic = () => {
    const res = applySupportMagic(character, { bondId: effectiveBondId });
    if (!res.ok) {
      showToast(res.reason, 'warning');
      return;
    }
    onChange(res.character);
    showToast(`已登記【支援魔法】：${res.outcome.targetName} 本場景下次檢定 +${res.outcome.bonus}（0 MP）`, 'success');
  };

  const handleIBelieve = () => {
    const res = applyIBelieveInYou(character, {
      targetName: believeTarget,
      sl: believeSL,
      traitOrBond: believeTrait,
      mode: believeMode
    });
    if (!res.ok) {
      showToast(res.reason, 'warning');
      return;
    }
    onChange(res.character);
    setBelieveTrait('');
    const mpMsg = res.outcome.allyMpRecovery > 0
      ? `（具備羈絆，目標額外恢復 ${res.outcome.allyMpRecovery} 點 MP）`
      : '';
    showToast(`已花費 1 點物語點發動【我相信你】支援 ${res.outcome.targetName}${mpMsg}`, 'success');
  };

  const handleSmoothTalker = () => {
    const res = applySmoothTalker(
      character,
      {
        ticks: effectiveTicks,
        sl: smoothTalkerSL,
        clockId: smoothClockId,
        clockAction: smoothAction,
        approach: smoothApproach
      },
      stats
    );
    if (!res.ok) {
      showToast(res.reason, 'warning');
      return;
    }
    onChange(res.character);
    const word = smoothAction === 'erase' ? '清除' : '填滿';
    showToast(`已消耗 ${res.outcome.mpCost} 點 MP 透過${smoothApproach}為「${res.outcome.targetDisplay}」額外${word} ${res.outcome.ticks} 格`, 'success');
  };

  const handleRemoveBuff = (buffId) => {
    const res = removePendingBuff(character, buffId);
    if (!res.ok) return;
    onChange(res.character);
    showToast('已移除該條待生效增益', 'info');
  };

  const handleClearBuffs = () => {
    const res = clearPendingBuffs(character);
    if (!res.ok) return;
    onChange(res.character);
    showToast('已清空全部暫存增益', 'info');
  };

  return (
    <div
      data-testid="pending-buffs-panel"
      className="p-3 rounded bg-[#fbf7ee] border border-[#d6c7ab] space-y-3 text-xs"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#e8dcc4] pb-2">
        <div className="font-serif font-black text-sm text-[#3c2415] flex items-center gap-1.5">
          <GiSparkles className="w-4 h-4 text-[#8c3235]" />
          <span>場景支援與暫存增益</span>
        </div>
        {buffs.length > 0 && (
          <button
            type="button"
            data-testid="clear-buffs-btn"
            onClick={handleClearBuffs}
            className="px-2 py-0.5 rounded bg-[#fffdf9] hover:bg-[#f4ebd9] border border-[#d6c7ab] text-[#6b5a4b] hover:text-[#8c3235] font-bold text-t11 inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>清空增益（{buffs.length}）</span>
          </button>
        )}
      </div>

      {/* 1. 靈師【支援魔法】 */}
      {supportMagicSL > 0 && (
        <div
          data-testid="skill-panel-support-magic"
          className="p-2.5 rounded bg-[#fffdf9] border border-[#e8dcc4] space-y-2"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[#3c2415] inline-flex items-center gap-1">
              <GiShield className="w-3.5 h-3.5 text-[#27527a]" />
              <span>支援魔法（消耗 0 MP）</span>
            </span>
            {arcaneStatus === 'true' ? (
              <span className="text-t11 font-bold text-[#245c45] inline-flex items-center gap-1">
                <GiCheckMark className="w-3 h-3" />
                <span>已裝備奧術武器</span>
              </span>
            ) : arcaneStatus === 'false' ? (
              <span className="text-t11 font-bold text-[#8c3235] inline-flex items-center gap-1">
                <GiHazardSign className="w-3 h-3" />
                <span>須先裝備奧術類別武器</span>
              </span>
            ) : (
              <span className="text-t11 font-bold text-[#6b5a4b]">
                ※ 請自行確認已裝備奧術武器
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {feltBonds.length > 0 ? (
              <>
                <select
                  data-testid="support-magic-bond-select"
                  value={effectiveBondId}
                  onChange={(e) => setSelectedBondId(e.target.value)}
                  className="flex-1 min-w-[160px] px-2 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
                >
                  {feltBonds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.target}（羈絆強度 +{b.feelings.length}）
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="support-magic-btn"
                  onClick={handleSupportMagic}
                  className="px-3 py-1.5 rounded bg-[#27527a] hover:bg-[#3c2415] text-[#fffdf9] font-bold text-xs cursor-pointer transition-colors"
                >
                  為盟友登記 +羈絆強度加值
                </button>
              </>
            ) : (
              <p className="text-t12 text-[#8c3235]">
                需先於「情感羈絆」分頁建立帶情感的羈絆，才可對目標發動【支援魔法】。
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2. 吟唱者【我相信你】 */}
      {believeSL > 0 && (
        <div
          data-testid="skill-panel-believe-in-you"
          className="p-2.5 rounded bg-[#fffdf9] border border-[#e8dcc4] space-y-2"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[#3c2415] inline-flex items-center gap-1">
              <GiSparkles className="w-3.5 h-3.5 text-[#8c3235]" />
              <span>我相信你 SL {believeSL}（消耗 1 點物語點）</span>
            </span>
            <span className="text-t11 font-bold text-[#6b5a4b] tabular-nums">
              現有物語點：{curFp} 點 · 有羈絆時目標回 {believeSL * 10} MP
            </span>
          </div>

          {bonds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {bonds.filter((b) => b && b.target).map((b, idx) => (
                <button
                  key={b.id || idx}
                  type="button"
                  data-testid={`believe-preset-${idx}`}
                  onClick={() => setBelieveTarget(b.target)}
                  className={`px-2 py-0.5 rounded border text-t11 font-bold cursor-pointer transition-colors ${
                    believeTarget === b.target
                      ? 'bg-[#f4ebd9] border-[#8c3235] text-[#8c3235]'
                      : 'bg-[#fbf7ee] border-[#d6c7ab] text-[#6b5a4b] hover:text-[#3c2415]'
                  }`}
                >
                  {b.target}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
            <input
              type="text"
              data-testid="believe-target-input"
              value={believeTarget}
              onChange={(e) => setBelieveTarget(e.target.value)}
              placeholder="輸入隊友角色名稱"
              className="px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
            />
            <input
              type="text"
              data-testid="believe-trait-input"
              value={believeTrait}
              onChange={(e) => setBelieveTrait(e.target.value)}
              placeholder="引用特質或羈絆（選填）"
              className="px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] text-xs"
            />
            <select
              data-testid="believe-mode-select"
              value={believeMode}
              onChange={(e) => setBelieveMode(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
            >
              <option value="reroll">效果：重擲檢定骰子</option>
              <option value="bonus">效果：檢定結果 +2</option>
            </select>
            <button
              type="button"
              data-testid="believe-btn"
              onClick={handleIBelieve}
              className="px-3 py-1.5 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs whitespace-nowrap cursor-pointer transition-colors"
            >
              花費 1 點物語點支援
            </button>
          </div>
        </div>
      )}

      {/* 3. 吟唱者【能言善辯】 */}
      {smoothTalkerSL > 0 && (
        <div
          data-testid="skill-panel-smooth-talker"
          className="p-2.5 rounded bg-[#fffdf9] border border-[#e8dcc4] space-y-2"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[#3c2415] inline-flex items-center gap-1">
              <GiPocketWatch className="w-3.5 h-3.5 text-[#27527a]" />
              <span>能言善辯 SL {smoothTalkerSL}（每 20 MP 額外影響 1 格）</span>
            </span>
            <span className="text-t11 font-bold text-[#6b5a4b] tabular-nums">
              現有 MP：{curMp} / {maxMp}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
            <select
              data-testid="smooth-approach-select"
              value={smoothApproach}
              onChange={(e) => setSmoothApproach(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
            >
              <option value="魅力">手段：魅力</option>
              <option value="外交">手段：外交</option>
              <option value="欺騙">手段：欺騙</option>
              <option value="威嚇">手段：威嚇</option>
            </select>

            <select
              data-testid="smooth-action-select"
              value={smoothAction}
              onChange={(e) => setSmoothAction(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
            >
              <option value="fill">額外填滿刻度</option>
              <option value="erase">額外清除刻度</option>
            </select>

            <select
              data-testid="smooth-ticks-select"
              value={effectiveTicks}
              onChange={(e) => setSmoothTicks(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold tabular-nums text-xs"
            >
              {Array.from({ length: Math.min(2, smoothTalkerSL) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  +{n} 格（{n * 20} MP）
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
            <select
              data-testid="smooth-clock-select"
              value={smoothClockId}
              onChange={(e) => setSmoothClockId(e.target.value)}
              className="sm:col-span-2 px-2.5 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] font-bold text-xs"
            >
              <option value="">場景／GM 命刻（只扣 MP 並留存提示）</option>
              {clocks.map((c) => (
                <option key={c.id} value={c.id}>
                  個人命刻：{c.title || '未命名'}（{c.filledSegments}/{c.totalSegments}）
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="smooth-btn"
              onClick={handleSmoothTalker}
              className="px-3 py-1.5 rounded bg-[#245c45] hover:bg-[#3c2415] text-[#fffdf9] font-bold text-xs tabular-nums whitespace-nowrap cursor-pointer transition-colors"
            >
              扣除 {smoothMpCost} MP 推進
            </button>
          </div>
        </div>
      )}

      {/* 4. 待生效暫存增益佇列 */}
      <div data-testid="pending-buffs-queue" className="space-y-1.5">
        <div className="text-t11 font-bold text-[#6b5a4b]">
          本場景待生效增益佇列（{buffs.length}）
        </div>
        {buffs.length === 0 ? (
          <EmptyState
            dense
            kind="pending-buffs"
            icon={GiSparkles}
            title="目前佇列沒有待生效增益"
            teach="透過上方【支援魔法】、【我相信你】或【能言善辯】發動的效果會暫存於此，供全隊參考。"
          />
        ) : (
          <div className="space-y-1.5">
            {buffs.map((buff, idx) => (
              <div
                key={buff.id || idx}
                data-testid={`pending-buff-card-${idx}`}
                className="p-2 rounded bg-[#fffdf9] border border-[#d6c7ab] flex items-start justify-between gap-2 flex-wrap"
              >
                <div className="space-y-0.5 flex-1 min-w-[200px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#8c3235] font-bold text-t11">
                      {buff.sourceSkill}
                    </span>
                    <span className="font-bold text-[#3c2415]">
                      對象：{buff.targetName}
                    </span>
                  </div>
                  <p className="text-t12 text-[#6b5a4b] leading-snug">
                    {buff.effectDesc}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <CopyTextButton
                    testId={`copy-buff-${idx}`}
                    toastLabel={buff.sourceSkill}
                    showToast={showToast}
                    getText={() =>
                      formatCompanionItemCopyText({
                        category: '場景暫存增益',
                        name: `【${buff.sourceSkill}】➔ ${buff.targetName}`,
                        subtitle: '本場景待生效',
                        lines: [buff.effectDesc],
                        characterName: character?.name || ''
                      })
                    }
                  />
                  <button
                    type="button"
                    data-testid={`remove-buff-${buff.id}`}
                    onClick={() => handleRemoveBuff(buff.id)}
                    className="px-2 py-0.5 rounded bg-[#fbf7ee] hover:bg-[#f4ebd9] border border-[#d6c7ab] text-[#6b5a4b] hover:text-[#245c45] font-bold text-t11 cursor-pointer transition-colors"
                  >
                    ✓ 已生效移除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
