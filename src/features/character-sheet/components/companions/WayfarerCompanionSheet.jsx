import React, { useState } from 'react';
import {
  GiPawPrint,
  GiRollingDices,
  GiHeartMinus,
  GiHeartPlus,
  GiShield,
  GiBroadsword,
  GiQuillInk,
  GiHazardSign,
  GiSparkles
} from 'react-icons/gi';
import WayfarerCompanionModal from './WayfarerCompanionModal';
import { getCharacterLevel } from '../../utils/characterEngine';
import {
  calculateCompanionMaxHp,
  calculateCompanionCrisisHp,
  createDefaultCompanionData
} from '../../data/wayfarerCompanionData';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { ATTRIBUTE_COLORS } from '../../data/sourcebookConfig';

export default function WayfarerCompanionSheet({
  character,
  onChange,
  onOpenDice = null,
  showToast = () => {}
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const wayfarerClass = (character.classes || []).find(c => c.className === '旅人');
  const companionSkill = (wayfarerClass?.skills || []).find(s => s.name === '忠實夥伴');
  const companionSL = companionSkill?.sl || 1;
  const charLevel = getCharacterLevel(character);

  // 取得旅人夥伴數據
  const wayfarerData = character.wayfarerData || {};
  const comp = wayfarerData.companion || createDefaultCompanionData();

  const migDie = comp.mig || 10;
  const dexDie = comp.dex || 8;
  const insDie = comp.ins || 8;
  const wlpDie = comp.wlp || 6;

  // 最大 HP 公式：(SL × 夥伴基礎 MIG 骰尺寸) + 旅人等級的一半（向下取整）
  const maxHp = calculateCompanionMaxHp(companionSL, migDie, charLevel);
  const crisisHp = calculateCompanionCrisisHp(maxHp);
  const currentHp = comp.currentHp !== null && comp.currentHp !== undefined ? comp.currentHp : maxHp;
  const isCrisis = currentHp <= crisisHp;

  const updateCompanion = (updates) => {
    onChange({
      ...character,
      wayfarerData: {
        ...wayfarerData,
        companion: {
          ...comp,
          ...updates
        }
      },
      updatedAt: new Date().toISOString()
    });
  };

  const adjustHp = (delta) => {
    const next = Math.max(0, Math.min(maxHp, currentHp + delta));
    updateCompanion({ currentHp: next });
  };

  const handleRollAttack = (atk) => {
    if (!onOpenDice) return;
    const die1 = comp[atk.attr1?.toLowerCase()] || 8;
    const die2 = comp[atk.attr2?.toLowerCase()] || 8;
    onOpenDice({
      die1,
      die2,
      modifier: companionSL,
      label: `夥伴【${comp.name}】${atk.name} 命中檢定 [${atk.attr1} + ${atk.attr2} + ${companionSL}]`
    });
  };

  return (
    <div className="p-4 rounded-xl bg-[#fffdf9] border border-[#d6c7ab] space-y-4 text-xs">
      
      {/* 頂部標題與編輯按鈕 */}
      <div className="flex items-center justify-between border-b border-green-200 pb-2 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-green-600/10 text-green-600">
            <GiPawPrint className="text-xl" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-green-950 flex items-center gap-2">
              <span>{comp.name || '忠實夥伴'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-300">
                5 級 {comp.species || '野獸'} · SL {companionSL}
              </span>
            </h3>
            <p className="text-t12 text-[#7c6a58] font-mono">
              官方 5 級 NPC 隨從（參見手冊 p. 219 與 p. 302-317）
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditModalOpen(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer bg-white hover:bg-green-50 text-green-900 border border-green-300"
        >
          <GiQuillInk className="w-3.5 h-3.5 text-green-600" />
          <span>編輯隨從設定</span>
        </button>
      </div>

      {/* 生命值與危機儀表 */}
      <div className="p-3 rounded-xl bg-white border border-green-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#3c2415]">夥伴生命值 (HP):</span>
            <span className="font-mono font-black text-sm text-green-700">
              {currentHp} / {maxHp}
            </span>
            {isCrisis && (
              <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36]/50 flex items-center gap-1">
                <GiHazardSign className="text-xs" />
                <span>危機 (≤{crisisHp})</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => adjustHp(-5)}
              className="px-1.5 py-0.5 rounded bg-[#f9f5eb] hover:bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36]/30 font-mono font-bold"
              title="-5 HP"
            >
              -5
            </button>
            <button
              type="button"
              onClick={() => adjustHp(-1)}
              className="px-1.5 py-0.5 rounded bg-[#f9f5eb] hover:bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36]/30 font-mono font-bold"
              title="-1 HP"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => adjustHp(1)}
              className="px-1.5 py-0.5 rounded bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-mono font-bold"
              title="+1 HP"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => adjustHp(5)}
              className="px-1.5 py-0.5 rounded bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-mono font-bold"
              title="+5 HP"
            >
              +5
            </button>
          </div>
        </div>

        {/* HP 進度條 */}
        <div className="w-full h-2 rounded-full bg-[#e8dcc4] overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCrisis ? 'bg-[#8c2d36]' : 'bg-[#245c45]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, (currentHp / maxHp) * 100))}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-[#7c6a58] flex justify-between">
          <span>公式：(SL {companionSL} × MIG d{migDie}) + 等級({charLevel})/2 = {maxHp}</span>
          <span>防禦：DEF d{dexDie} | M.DEF d{insDie}</span>
        </div>
      </div>

      {/* 四維屬性骰展示 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 rounded-lg bg-white border border-[#d6c7ab] text-center space-y-0.5">
          <span className="text-[10px] text-[#7c6a58] block font-bold">DEX</span>
          <span className={`font-mono font-bold text-sm ${ATTRIBUTE_COLORS.dex}`}>d{dexDie}</span>
        </div>
        <div className="p-2 rounded-lg bg-white border border-[#d6c7ab] text-center space-y-0.5">
          <span className="text-[10px] text-[#7c6a58] block font-bold">INS</span>
          <span className={`font-mono font-bold text-sm ${ATTRIBUTE_COLORS.ins}`}>d{insDie}</span>
        </div>
        <div className="p-2 rounded-lg bg-white border border-[#d6c7ab] text-center space-y-0.5">
          <span className="text-[10px] text-[#7c6a58] block font-bold">MIG</span>
          <span className={`font-mono font-bold text-sm ${ATTRIBUTE_COLORS.mig}`}>d{migDie}</span>
        </div>
        <div className="p-2 rounded-lg bg-white border border-[#d6c7ab] text-center space-y-0.5">
          <span className="text-[10px] text-[#7c6a58] block font-bold">WLP</span>
          <span className={`font-mono font-bold text-sm ${ATTRIBUTE_COLORS.wlp}`}>d{wlpDie}</span>
        </div>
      </div>

      {/* 基礎攻擊欄位與一鍵擲骰 */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-[#6b5a4b]">基礎攻擊（命中檢定享有 +{companionSL} 加成）</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(comp.attacks || []).map((atk, idx) => (
            <div
              key={atk.id || idx}
              className="p-3 rounded-xl bg-white border border-green-200 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <strong className="text-[#2c221e] font-bold">{atk.name}</strong>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b]">
                  {atk.range === 'melee' || atk.type === 'melee' ? '近戰' : '遠程'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[11px] text-[#6b5a4b]">
                  【{atk.attr1} + {atk.attr2}】+{companionSL} | {renderTextWithAffinities(atk.damageText || atk.damage || '【HR + 5】物理')}
                </span>
                <button
                  type="button"
                  onClick={() => handleRollAttack(atk)}
                  className="px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs"
                >
                  <GiRollingDices className="text-xs" />
                  <span>攻擊</span>
                </button>
              </div>
              {atk.specialEffect && (
                <p className="text-[10px] text-[#6b5a4b] border-t border-green-100 pt-1 leading-relaxed">
                  {renderTextWithAffinities(atk.specialEffect)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 隨從咒語清單 */}
      {Array.isArray(comp.spells) && comp.spells.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#6b5a4b] flex items-center gap-1.5">
            <span className="fu-icon text-[#3c2415]">c</span>
            <span>隨從咒語（Core p. 306-317）</span>
          </span>
          <div className="space-y-2">
            {comp.spells.map((sp, idx) => (
              <div
                key={sp.id || idx}
                className="p-3 rounded-xl bg-white border border-[#d6c7ab] space-y-1.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`fu-icon text-sm font-bold ${sp.isOffensive ? 'text-[#8c2d36] ' : 'text-[#3c2415] '}`}>
                      {sp.isOffensive ? 'o' : 'c'}
                    </span>
                    <strong className="text-[#2c221e] font-bold">{sp.name || '未命名咒語'}</strong>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab]">
                    MP {sp.mp || 10} · {sp.target || '一個生物'} · {sp.duration || '瞬發'}
                  </span>
                </div>
                {sp.effect && (
                  <p className="text-[11px] text-[#6b5a4b] leading-relaxed border-t border-[#e2d6c1] pt-1">
                    {renderTextWithAffinities(sp.effect)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 其餘行動清單 */}
      {Array.isArray(comp.otherActions) && comp.otherActions.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#6b5a4b] flex items-center gap-1.5">
            <span className="fu-icon text-[#3c2415]">s</span>
            <span>其餘行動（Core p. 306-317）</span>
          </span>
          <div className="space-y-2">
            {comp.otherActions.map((act, idx) => (
              <div
                key={act.id || idx}
                className="p-3 rounded-xl bg-white border border-[#e8dcc4] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="fu-icon text-sm font-bold text-[#3c2415]">s</span>
                    <strong className="text-[#2c221e] font-bold">{act.name || '未命名行動'}</strong>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f9f5eb] text-[#3c2415] border border-[#e8dcc4]">
                    行動
                  </span>
                </div>
                {act.effect && (
                  <p className="text-[11px] text-[#6b5a4b] leading-relaxed border-t border-[#e8dcc4] pt-1">
                    {renderTextWithAffinities(act.effect)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 特殊規則清單 */}
      {Array.isArray(comp.specialRules) && comp.specialRules.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#6b5a4b] flex items-center gap-1.5">
            <GiSparkles className="text-emerald-600" />
            <span>特殊規則（Core p. 306-317）</span>
          </span>
          <div className="space-y-2">
            {comp.specialRules.map((rule, idx) => (
              <div
                key={rule.id || idx}
                className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-[#2c221e] font-bold">{rule.name || '未命名規則'}</strong>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    特殊規則
                  </span>
                </div>
                {rule.effect && (
                  <p className="text-[11px] text-[#6b5a4b] leading-relaxed border-t border-emerald-100 pt-1">
                    {renderTextWithAffinities(rule.effect)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 隨從設定編輯彈窗 */}
      <WayfarerCompanionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        companionData={comp}
        wayfarerSl={companionSL}
        characterLevel={charLevel}
        onSave={(newComp) => {
          updateCompanion(newComp);
          showToast(`已儲存【${newComp.name}】的隨從設定！`);
        }}
      />
    </div>
  );
}
