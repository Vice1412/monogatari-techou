import React, { useState } from 'react';
import {
  GiSteeringWheel,
  GiCrossedSwords,
  GiShield,
  GiRollingDices,
  GiLightningTear,
  GiBackpack,
  GiUpgrade,
  GiRobotLeg,
  GiWingedSword
} from 'react-icons/gi';
import {
  findFrameById,
  PILOT_ARMOR_MODULES,
  PILOT_WEAPON_MODULES,
  PILOT_SUPPORT_MODULES
} from '../../data/pilotVehicleData';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { calculateCharacterStats } from '../../utils/characterEngine';

export default function PilotVehicleCombatSheet({
  character,
  onChange,
  onOpenDice = null,
  showToast = () => {}
}) {
  const pilotClass = (character.classes || []).find(c => c.className === '機師');
  const vehicleSkill = (pilotClass?.skills || []).find(s => s.name === '個人載具');
  const pilotSl = vehicleSkill?.sl || 1;

  // 取得強力握持技能
  const strongGripSkill = (pilotClass?.skills || []).find(s => s.name === '強力握持');
  const hasStrongGrip = !!strongGripSkill;

  // 取得引擎之心技能
  const engineHeartSkill = (pilotClass?.skills || []).find(s => s.name === '引擎之心');
  const engineHeartSl = engineHeartSkill?.sl || 0;

  // 取得壓縮技術技能
  const compressionSkill = (pilotClass?.skills || []).find(s => s.name === '壓縮技術');

  const vehicle = character.pilotVehicle || {
    name: '個人載具',
    frameId: 'exoskeleton',
    unlockedModules: [],
    activeModules: [],
    antiElementChoice: '風',
    secondaryOffensiveWeaponId: '',
    isMounted: false
  };

  const frame = findFrameById(vehicle.frameId);
  const isMounted = !!vehicle.isMounted;

  // 解析啟用的各類模組
  const activeWeapons = (vehicle.activeModules || [])
    .map(id => PILOT_WEAPON_MODULES.find(w => w.id === id))
    .filter(Boolean);

  const activeArmor = (vehicle.activeModules || [])
    .map(id => PILOT_ARMOR_MODULES.find(a => a.id === id))
    .filter(Boolean);

  const activeSupport = (vehicle.activeModules || [])
    .map(id => PILOT_SUPPORT_MODULES.find(s => s.id === id))
    .filter(Boolean);

  const updateVehicle = (updates) => {
    onChange({
      ...character,
      pilotVehicle: {
        ...vehicle,
        ...updates
      },
      updatedAt: new Date().toISOString()
    });
  };

  const toggleMounted = () => {
    const nextMounted = !isMounted;
    updateVehicle({ isMounted: nextMounted });
    showToast(nextMounted ? `搭乘【${vehicle.name}】（已套用載具裝備）` : `離開【${vehicle.name}】（恢復角色常規裝備）`);
  };

  // 一鍵擲骰武器模組
  const handleRollWeapon = (weapon, useStrongGrip = false) => {
    if (!onOpenDice) return;
    const stats = character.attributes || { dex: 8, ins: 8, mig: 8, wlp: 8 };

    let attr1Key = weapon.attr1?.toLowerCase() || 'dex';
    let attr2Key = weapon.attr2?.toLowerCase() || 'ins';

    if (useStrongGrip && hasStrongGrip) {
      // 強力握持：將其中一項屬性替換為 MIG
      attr1Key = 'mig';
    }

    const die1 = stats[attr1Key] || 8;
    const die2 = stats[attr2Key] || 8;

    onOpenDice({
      die1,
      die2,
      modifier: weapon.modifier || 0,
      label: `載具武裝【${weapon.name}】命中檢定 [${attr1Key.toUpperCase()} + ${attr2Key.toUpperCase()}${weapon.modifier > 0 ? ` + ${weapon.modifier}` : ''}]`
    });
  };

  // 發動引擎之心
  const handleTriggerEngineHeart = (optionText) => {
    const cost = frame.mpFreeHeart ? 0 : 10;
    const stats = calculateCharacterStats(character);
    const curMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : (stats.maxMp || 40);
    if (curMp < cost) {
      showToast(`MP 不足！發動引擎之心需要 ${cost} MP`);
      return;
    }
    const nextMp = Math.max(0, curMp - cost);
    onChange({
      ...character,
      currentMp: nextMp,
      updatedAt: new Date().toISOString()
    });
    showToast(`發動【引擎之心】（消耗 ${cost} MP）：${optionText}`);
  };

  return (
    <div className="p-4 rounded-xl bg-[#fffdf9] border border-[#d6c7ab] space-y-3 text-xs">
      
      {/* 頂部標題列與搭乘切換開關 */}
      <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-[#27527a]/10 text-[#27527a]">
            <GiSteeringWheel className="text-xl" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#27527a] flex items-center gap-2">
              <span>{vehicle.name || '個人載具'}</span>
              <span className="text-t10 font-mono px-2 py-0.5 rounded bg-[#f4ebd9] text-[#27527a] border border-[#27527a]">
                {frame.name} · 機師 SL {pilotSl}
              </span>
            </h3>
            <p className="text-t12 text-[#6b5a4b]">
              乘客：{frame.passengers} 名 | 距離：{frame.distanceModifier} | 啟用模組：{(vehicle.activeModules || []).length} 個
            </p>
          </div>
        </div>

        {/* 搭乘開關按鈕 */}
        <button
          type="button"
          onClick={toggleMounted}
 className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${ isMounted ? 'bg-[#27527a] hover:bg-[#214365] text-white ring-2 ring-[#27527a]/40' : 'bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] ' }`}
        >
          <GiSteeringWheel className="text-sm" />
          <span>{isMounted ? '駕駛中（點擊離開）' : '步行中（點擊搭乘）'}</span>
        </button>
      </div>

      {/* 駕駛狀態橫幅提示 */}
      {isMounted ? (
        <div className="p-2.5 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#27527a]" />
            <strong className="text-[#27527a]">
              載具已就位
            </strong>
            <span className="text-[#6b5a4b]">
              {activeArmor.length > 0 ? `防具已切換為【${activeArmor[0].name}】` : '使用角色原防具'}
            </span>
          </div>

          {/* 機師快捷技能按鈕 */}
          <div className="flex items-center gap-1.5">
            {engineHeartSkill && (
              <button
                type="button"
                onClick={() => handleTriggerEngineHeart(`下次造成傷害 +${engineHeartSl * 2}`)}
                className="px-2 py-0.5 rounded bg-white border border-[#27527a] text-[#27527a] font-bold hover:bg-[#f4ebd9] transition"
                title={`引擎之心：消耗 ${frame.mpFreeHeart ? 0 : 10} MP，下次傷害 +${engineHeartSl * 2}，或減傷 ${engineHeartSl * 2}，或解除緩慢/虛弱`}
              >
                引擎之心 ({frame.mpFreeHeart ? '0' : '10'} MP)
              </button>
            )}

            {compressionSkill && (
              <button
                type="button"
                onClick={() => showToast(frame.ipFreeCompression ? '【壓縮技術】外骨骼免費收納/召喚 (0 IP)' : '【壓縮技術】消耗 2 IP 收納/召喚載具')}
                className="px-2 py-0.5 rounded bg-white border border-[#27527a] text-[#27527a] font-bold hover:bg-[#f4ebd9] transition"
              >
                壓縮技術 ({frame.ipFreeCompression ? '0' : '2'} IP)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2 rounded-lg bg-[#f4ebd9]/80 border border-[#d6c7ab] text-t11 text-[#6b5a4b] flex items-center justify-between">
          <span>目前處於步行狀態。戰鬥中可執行「目標」動作搭乘載具。</span>
          <span className="font-mono">{renderTextWithAffinities(frame.specialRule)}</span>
        </div>
      )}

      {/* 啟用的武裝模組清單與一鍵攻擊 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
            <GiCrossedSwords className="text-[#27527a]" />
            <span>載具武裝（{activeWeapons.length} / {frame.maxWeapons}）</span>
          </span>
          {hasStrongGrip && (
            <span className="text-t10 text-[#9c4d16] font-bold">
              ✦ 強力握持：可用體質 (MIG) 替換其中一項命中屬性
            </span>
          )}
        </div>

        {activeWeapons.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-[#d6c7ab] text-center text-[#7c6a58]">
            載具目前未裝備任何啟用的武裝模組
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeWeapons.map(w => {
              if (w.isShield) {
                return (
                  <div
                    key={w.id}
                    className="p-2.5 rounded-xl bg-white border border-[#d6c7ab] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <GiShield className="text-base text-[#27527a]" />
                      <div>
                        <strong className="text-[#2c221e] font-bold block">{w.name}</strong>
                        <span className="text-t10 text-[#7c6a58] font-mono">DEF +2 | M.DEF +2（盾牌）</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={w.id}
                  className="p-2.5 rounded-xl bg-white border border-[#d6c7ab] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-[#2c221e] font-bold">{w.name}</strong>
                    <span className="text-t10 font-mono px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b]">
                      {w.category} · {w.range === 'melee' ? '近戰' : '遠程'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-t11 text-[#6b5a4b]">
                      【{w.attr1} + {w.attr2}】{w.modifier > 0 ? `+${w.modifier}` : ''} | {renderTextWithAffinities(w.damage)}
                    </span>

                    <div className="flex items-center gap-1">
                      {hasStrongGrip && (
                        <button
                          type="button"
                          onClick={() => handleRollWeapon(w, true)}
                          className="px-2 py-0.5 rounded bg-[#9c4d16] hover:bg-[#833f12] text-white font-bold text-t10 shadow-2xs"
                          title="使用強力握持：MIG 替換屬性檢定"
                        >
                          MIG檢定
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRollWeapon(w, false)}
                        className="px-2.5 py-1 rounded bg-[#27527a] hover:bg-[#214365] text-white font-bold text-xs flex items-center gap-1 shadow-2xs"
                      >
                        <GiRollingDices className="text-xs" />
                        <span>攻擊</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 支援模組與反元素抗性展示 */}
      {activeSupport.length > 0 && (
        <div className="pt-2 border-t border-[#d6c7ab] flex flex-wrap gap-1.5 items-center">
          <span className="text-t11 text-[#7c6a58] font-bold">已啟用支援模組：</span>
          {activeSupport.map(s => (
            <span
              key={s.id}
              title={s.description}
              className="text-t10 font-mono px-2 py-0.5 rounded bg-white text-[#27527a] border border-[#d6c7ab]"
            >
              {s.name}
              {s.id === 'anti_element_module' && (
                <span className="ml-1">（{renderTextWithAffinities((vehicle.antiElementChoice || '風') + '抗性')}）</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
