import React, { useState, useMemo } from 'react';
import {
  GiSteeringWheel,
  GiCrossedSwords,
  GiShield,
  GiWrench,
  GiCheckMark,
  GiHazardSign,
  GiCancel,
  GiCheckeredFlag,
  GiHorseHead,
  GiRobotLeg,
  GiSuitcase
} from 'react-icons/gi';
import {
  PILOT_FRAMES,
  PILOT_ARMOR_MODULES,
  PILOT_WEAPON_MODULES,
  PILOT_SUPPORT_MODULES,
  getUnlockedModuleQuota,
  getActiveModuleCapacity,
  findFrameById,
  createDefaultVehicleData
} from '../../data/pilotVehicleData';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';

export default function PilotVehicleModal({
  isOpen,
  onClose,
  vehicleData,
  pilotSl = 1,
  onSave
}) {
  if (!isOpen) return null;

  // 初始化本地編輯狀態
  const [formData, setFormData] = useState(() => {
    const base = vehicleData ? { ...vehicleData } : createDefaultVehicleData();
    return {
      name: base.name || '個人載具',
      frameId: base.frameId || 'exoskeleton',
      unlockedModules: Array.isArray(base.unlockedModules) ? [...base.unlockedModules] : [],
      activeModules: Array.isArray(base.activeModules) ? [...base.activeModules] : [],
      antiElementChoice: base.antiElementChoice || '風',
      secondaryOffensiveWeaponId: base.secondaryOffensiveWeaponId || '',
      isMounted: !!base.isMounted
    };
  });

  const [activeTab, setActiveTab] = useState('weapons'); // 'weapons' | 'armor' | 'support'
  const [errorMessage, setErrorMessage] = useState('');

  const currentFrame = useMemo(() => findFrameById(formData.frameId), [formData.frameId]);
  const unlockedQuota = useMemo(() => getUnlockedModuleQuota(pilotSl), [pilotSl]);
  const activeCapacity = useMemo(() => getActiveModuleCapacity(pilotSl), [pilotSl]);

  // 計算已啟用的槽位開銷
  const { activeSlotsCost, activeWeapons, activeArmor, activeSupport, hasBulkyWeapon } = useMemo(() => {
    let slots = 0;
    const weapons = [];
    const armor = [];
    const support = [];
    let bulky = false;

    formData.activeModules.forEach(modId => {
      const w = PILOT_WEAPON_MODULES.find(m => m.id === modId);
      if (w) {
        weapons.push(w);
        slots += 1;
        if (w.isBulky) bulky = true;
        return;
      }
      const a = PILOT_ARMOR_MODULES.find(m => m.id === modId);
      if (a) {
        armor.push(a);
        slots += 1;
        return;
      }
      const s = PILOT_SUPPORT_MODULES.find(m => m.id === modId);
      if (s) {
        support.push(s);
        slots += (s.slotsCost || 1);
        return;
      }
    });

    return {
      activeSlotsCost: slots,
      activeWeapons: weapons,
      activeArmor: armor,
      activeSupport: support,
      hasBulkyWeapon: bulky
    };
  }, [formData.activeModules]);

  // 切換框架
  const handleSelectFrame = (frameId) => {
    setErrorMessage('');
    const newFrame = findFrameById(frameId);
    // 檢查現有已啟用的武器數量或專屬模組是否超標，必要時給予提示或自動調整
    setFormData(prev => {
      let nextActive = [...prev.activeModules];
      // 戰馬武裝上限為 1
      if (newFrame.maxWeapons === 1 && activeWeapons.length > 1) {
        // 保留第 1 個武裝模組，其餘移出啟用狀態
        const keepWeaponId = activeWeapons[0]?.id;
        nextActive = nextActive.filter(id => {
          const isW = PILOT_WEAPON_MODULES.some(w => w.id === id);
          return !isW || id === keepWeaponId;
        });
      }
      // 移除不符合新框架的模組 (如盾牌、高出力、次要攻擊限外骨骼/機甲)
      nextActive = nextActive.filter(id => {
        const mod = PILOT_SUPPORT_MODULES.find(s => s.id === id) || PILOT_WEAPON_MODULES.find(w => w.id === id);
        if (mod?.frameRestrictions && !mod.frameRestrictions.includes(frameId)) {
          return false;
        }
        return true;
      });

      return {
        ...prev,
        frameId,
        activeModules: nextActive
      };
    });
  };

  // 切換解鎖狀態（加入/移出模組庫）
  const handleToggleUnlock = (moduleId) => {
    setErrorMessage('');
    const isUnlocked = formData.unlockedModules.includes(moduleId);
    if (isUnlocked) {
      // 移出模組庫，同時取消啟用
      setFormData(prev => ({
        ...prev,
        unlockedModules: prev.unlockedModules.filter(id => id !== moduleId),
        activeModules: prev.activeModules.filter(id => id !== moduleId)
      }));
    } else {
      // 檢查是否超過解鎖庫配額
      if (formData.unlockedModules.length >= unlockedQuota) {
        setErrorMessage(`已達到解鎖庫上限（最多 ${unlockedQuota} 種模組），請先取消其他模組。`);
        return;
      }
      setFormData(prev => ({
        ...prev,
        unlockedModules: [...prev.unlockedModules, moduleId]
      }));
    }
  };

  // 切換啟用狀態（裝載/卸下）
  const handleToggleActive = (moduleId) => {
    setErrorMessage('');
    const isActive = formData.activeModules.includes(moduleId);

    if (isActive) {
      // 卸下模組
      setFormData(prev => ({
        ...prev,
        activeModules: prev.activeModules.filter(id => id !== moduleId)
      }));
      return;
    }

    // 尚未解鎖時不可啟用
    if (!formData.unlockedModules.includes(moduleId)) {
      setErrorMessage('請先將此模組勾選「解鎖」加入庫存，方可裝載啟用。');
      return;
    }

    // 檢查模組類型與約束
    const weaponMod = PILOT_WEAPON_MODULES.find(m => m.id === moduleId);
    const armorMod = PILOT_ARMOR_MODULES.find(m => m.id === moduleId);
    const supportMod = PILOT_SUPPORT_MODULES.find(m => m.id === moduleId);

    // 1. 檢查框架限制
    const targetMod = weaponMod || armorMod || supportMod;
    if (targetMod?.frameRestrictions && !targetMod.frameRestrictions.includes(formData.frameId)) {
      setErrorMessage(`此模組無法在【${currentFrame.name}】框架上裝載。`);
      return;
    }

    // 2. 檢查總槽位容量
    const additionalCost = supportMod?.slotsCost || 1;
    if (activeSlotsCost + additionalCost > activeCapacity) {
      setErrorMessage(`超出載具啟用槽位上限（目前可用容量 ${activeCapacity} 槽）。`);
      return;
    }

    // 3. 武裝模組特定約束
    if (weaponMod) {
      if (activeWeapons.length >= currentFrame.maxWeapons) {
        setErrorMessage(`【${currentFrame.name}】框架至多可裝載 ${currentFrame.maxWeapons} 個武裝模組。`);
        return;
      }
      // 雙手笨重武器佔用全部欄位
      if (weaponMod.isBulky && activeWeapons.length > 0) {
        setErrorMessage(`【${weaponMod.name}】佔用全部武裝欄位，無法與其他武裝模組同時裝備。`);
        return;
      }
      if (hasBulkyWeapon) {
        setErrorMessage('載具目前已裝備佔用全部欄位的雙手武裝，無法再裝備其他武器。');
        return;
      }
    }

    // 4. 防具模組特定約束
    if (armorMod) {
      if (activeArmor.length >= 1) {
        setErrorMessage('載具至多只能裝載 1 個防具模組。請先卸下目前的防具鍍層。');
        return;
      }
    }

    // 5. 支援模組同名不可重複（由 ID 唯一保證）

    setFormData(prev => ({
      ...prev,
      activeModules: [...prev.activeModules, moduleId]
    }));
  };

  // 儲存
  const handleSave = () => {
    onSave({
      ...formData,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  // 一鍵重設
  const handleReset = () => {
    setFormData(createDefaultVehicleData());
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm duration-200 animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded bg-white border border-[#d6c7ab] shadow-e3 overflow-hidden text-[#3c2415]">
        
        {/* 頂部 Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#d6c7ab] bg-[#fbf7ee] flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded bg-[#27527a]/10 text-[#27527a]">
              <GiSteeringWheel className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#2c221e]">
                  個人載具工程機庫
                </h2>
                <span className="text-t11 font-mono px-2 py-0.5 rounded bg-[#f4ebd9] text-[#27527a] border border-[#27527a]">
                  機師 SL {pilotSl}
                </span>
              </div>
              <p className="text-t12 text-[#6b5a4b]">
                配置載具框架、解鎖模組總庫與啟用裝備狀態
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="載具自訂名稱"
              className="px-2.5 py-1 text-xs rounded border border-[#d6c7ab] bg-white font-bold outline-none focus:border-[#27527a] w-36"
            />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-[#7c6a58] hover:text-[#3c2415] hover:bg-[#e8dcc4] transition"
              title="關閉"
            >
              <GiCancel className="text-base" />
            </button>
          </div>
        </div>

        {/* 狀態配額指示條 */}
        <div className="px-5 py-2.5 bg-[#f4ebd9]/70 border-b border-[#d6c7ab] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* 解鎖庫配額 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#6b5a4b]">解鎖模組庫：</span>
              <span className={`font-mono font-bold ${ formData.unlockedModules.length > unlockedQuota ? 'text-[#8c2d36]' : formData.unlockedModules.length === unlockedQuota ? 'text-[#245c45] ' : 'text-[#9c4d16] ' }`}>
                {formData.unlockedModules.length} / {unlockedQuota} 種
              </span>
              <span className="text-t10 text-[#7c6a58]">
                （尚可解鎖 {Math.max(0, unlockedQuota - formData.unlockedModules.length)} 種）
              </span>
            </div>

            {/* 啟用槽位配額 */}
            <div className="flex items-center gap-1.5 border-l border-[#d6c7ab] pl-3">
              <span className="text-[#6b5a4b]">啟用槽位：</span>
              <span className={`font-mono font-bold ${ activeSlotsCost > activeCapacity ? 'text-[#8c2d36]' : activeSlotsCost === activeCapacity ? 'text-[#245c45] ' : 'text-[#27527a] ' }`}>
                {activeSlotsCost} / {activeCapacity} 槽
              </span>
              <span className="text-t10 text-[#7c6a58]">
                （剩餘 {Math.max(0, activeCapacity - activeSlotsCost)} 槽）
              </span>
            </div>

            {/* 武器槽位 */}
            <div className="flex items-center gap-1 border-l border-[#d6c7ab] pl-3">
              <span className="text-[#6b5a4b]">武裝：</span>
              <span className="font-mono font-bold text-[#3c2415]">
                {activeWeapons.length} / {currentFrame.maxWeapons}
              </span>
            </div>

            {/* 防具槽位 */}
            <div className="flex items-center gap-1 border-l border-[#d6c7ab] pl-3">
              <span className="text-[#6b5a4b]">防具：</span>
              <span className="font-mono font-bold text-[#3c2415]">
                {activeArmor.length} / 1
              </span>
            </div>
          </div>

          {/* 駕駛狀態標籤 */}
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, isMounted: !prev.isMounted }))}
            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${ formData.isMounted ? 'bg-[#27527a] text-white shadow-e1' : 'bg-[#e8dcc4] text-[#6b5a4b] hover:bg-[#d6c7ab]' }`}
          >
            <GiSteeringWheel className="text-xs" />
            <span>{formData.isMounted ? '駕駛中' : '步行中'}</span>
          </button>
        </div>

        {/* 錯誤警示條 */}
        {errorMessage && (
          <div className="px-5 py-2 bg-[#f4ebd9] border-b border-[#d6c7ab] text-[#8c2d36] text-xs flex items-center gap-2">
            <GiHazardSign className="text-sm shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 內容主滾動區 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* 一、框架選擇 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#2c221e] flex items-center gap-1.5">
                <GiRobotLeg className="text-[#27527a]" />
                <span>1. 選擇載具框架</span>
              </h3>
              <span className="text-t11 text-[#7c6a58]">框架決定載具移動距離、武裝槽位與專屬機制</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PILOT_FRAMES.map(f => {
                const isSelected = formData.frameId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFrame(f.id)}
                    className={`p-3.5 rounded text-left border transition relative flex flex-col justify-between space-y-2 ${ isSelected ? 'border-[#27527a] bg-[#f4ebd9]/60 ring-1 ring-[#27527a]' : 'border-[#d6c7ab] bg-white hover:border-[#d6c7ab] ' }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-sm font-bold text-[#2c221e] flex items-center gap-1.5">
                          {f.name}
                        </strong>
                        {isSelected && (
                          <span className="p-0.5 rounded-full bg-[#27527a] text-white">
                            <GiCheckMark className="text-xs" />
                          </span>
                        )}
                      </div>
                      <div className="text-t11 font-mono text-[#6b5a4b] space-x-2">
                        <span>乘客：{f.passengers} 名</span>
                        <span>距離：{f.distanceModifier}</span>
                        <span>武裝：至多 {f.maxWeapons} 個</span>
                      </div>
                    </div>

                    <p className="text-xs text-[#6b5a4b] pt-1 border-t border-[#d6c7ab]/60 leading-relaxed">
                      {renderTextWithAffinities(f.specialRule)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 二、模組庫分類標籤與清單 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2">
              <h3 className="text-xs font-bold text-[#2c221e] flex items-center gap-1.5">
                <GiWrench className="text-[#27527a]" />
                <span>2. 載具模組庫配置（勾選「解鎖」加入庫存，切換「啟用」裝載於載具）</span>
              </h3>

              <div className="flex items-center gap-1 bg-[#f4ebd9] p-0.5 rounded text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('weapons')}
                  className={`px-3 py-1 rounded transition ${ activeTab === 'weapons' ? 'bg-white text-[#27527a] shadow-e1' : 'text-[#6b5a4b] hover:text-[#2c221e] ' }`}
                >
                  武裝模組 (17)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('armor')}
                  className={`px-3 py-1 rounded transition ${ activeTab === 'armor' ? 'bg-white text-[#27527a] shadow-e1' : 'text-[#6b5a4b] hover:text-[#2c221e] ' }`}
                >
                  防具模組 (4)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('support')}
                  className={`px-3 py-1 rounded transition ${ activeTab === 'support' ? 'bg-white text-[#27527a] shadow-e1' : 'text-[#6b5a4b] hover:text-[#2c221e] ' }`}
                >
                  支援模組 (14)
                </button>
              </div>
            </div>

            {/* TAB 1: 武裝模組清單 */}
            {activeTab === 'weapons' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {PILOT_WEAPON_MODULES.map(w => {
                  const isUnlocked = formData.unlockedModules.includes(w.id);
                  const isActive = formData.activeModules.includes(w.id);
                  const isRestricted = w.frameRestrictions && !w.frameRestrictions.includes(formData.frameId);

                  return (
                    <div
                      key={w.id}
                      className={`p-3 rounded border transition flex flex-col justify-between space-y-2 ${ isActive ? 'border-[#27527a] bg-[#f4ebd9]/40 ' : isUnlocked ? 'border-[#d6c7ab] bg-white ' : 'border-[#d6c7ab] bg-[#fbf7ee]/50 opacity-75' }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-xs font-bold text-[#2c221e]">
                              {w.name}
                            </strong>
                            <span className="text-t10 font-mono px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b]">
                              {w.category} · {w.range === 'melee' ? '近戰' : '遠程'}
                            </span>
                            {w.isBulky && (
                              <span className="text-t10 font-bold px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#9c4d16]">
                                雙手佔槽
                              </span>
                            )}
                          </div>
                          <div className="text-t11 font-mono text-[#27527a] mt-1">
                            {w.damage ? (
                              <span>
                                檢定：【{w.attr1} + {w.attr2}】{w.modifier > 0 ? `+${w.modifier}` : ''} | 傷害：{renderTextWithAffinities(w.damage)}
                              </span>
                            ) : (
                              <span>DEF +2 | M.DEF +2（盾牌）</span>
                            )}
                          </div>
                        </div>

                        {/* 操作按鈕組 */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* 解鎖核取方塊 */}
                          <label className="flex items-center gap-1 text-t11 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isUnlocked}
                              onChange={() => handleToggleUnlock(w.id)}
                              className="rounded border-[#d6c7ab] text-[#27527a] focus:ring-[#27527a]"
                            />
                            <span className="text-[#6b5a4b]">解鎖</span>
                          </label>

                          {/* 啟用切換開關 */}
                          <button
                            type="button"
                            disabled={!isUnlocked || isRestricted}
                            onClick={() => handleToggleActive(w.id)}
                            className={`px-2.5 py-1 rounded text-t11 font-bold transition ${ isActive ? 'bg-[#27527a] text-white' : isUnlocked && !isRestricted ? 'bg-[#e8dcc4] text-[#3c2415] hover:bg-[#d6c7ab]' : 'bg-[#f4ebd9] text-[#7c6a58] cursor-not-allowed' }`}
                          >
                            {isActive ? '已啟用' : '啟用'}
                          </button>
                        </div>
                      </div>

                      {/* 特殊規則 */}
                      {w.specialRule !== '無' && (
                        <p className="text-t11 text-[#6b5a4b] border-t border-[#d6c7ab] pt-1 leading-relaxed">
                          {renderTextWithAffinities(w.specialRule)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: 防具模組清單 */}
            {activeTab === 'armor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PILOT_ARMOR_MODULES.map(a => {
                  const isUnlocked = formData.unlockedModules.includes(a.id);
                  const isActive = formData.activeModules.includes(a.id);

                  return (
                    <div
                      key={a.id}
                      className={`p-3 rounded border transition flex items-center justify-between gap-3 ${ isActive ? 'border-[#27527a] bg-[#f4ebd9]/40 ' : isUnlocked ? 'border-[#d6c7ab] bg-white ' : 'border-[#d6c7ab] bg-[#fbf7ee]/50 opacity-75' }`}
                    >
                      <div>
                        <strong className="text-xs font-bold text-[#2c221e] block">
                          {a.name}
                        </strong>
                        <div className="text-xs font-mono font-bold text-[#27527a] mt-1">
                          DEF {a.defFormula} | M.DEF {a.mdefFormula}
                        </div>
                      </div>

                      {/* 操作按鈕組 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="flex items-center gap-1 text-t11 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isUnlocked}
                            onChange={() => handleToggleUnlock(a.id)}
                            className="rounded border-[#d6c7ab] text-[#27527a] focus:ring-[#27527a]"
                          />
                          <span className="text-[#6b5a4b]">解鎖</span>
                        </label>

                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => handleToggleActive(a.id)}
                          className={`px-2.5 py-1 rounded text-t11 font-bold transition ${ isActive ? 'bg-[#27527a] text-white' : isUnlocked ? 'bg-[#e8dcc4] text-[#3c2415] hover:bg-[#d6c7ab]' : 'bg-[#f4ebd9] text-[#7c6a58] cursor-not-allowed' }`}
                        >
                          {isActive ? '已啟用' : '啟用'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: 支援模組清單 */}
            {activeTab === 'support' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {PILOT_SUPPORT_MODULES.map(s => {
                  const isUnlocked = formData.unlockedModules.includes(s.id);
                  const isActive = formData.activeModules.includes(s.id);
                  const isRestricted = s.frameRestrictions && !s.frameRestrictions.includes(formData.frameId);

                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded border transition flex flex-col justify-between space-y-2 ${ isActive ? 'border-[#27527a] bg-[#f4ebd9]/40 ' : isUnlocked ? 'border-[#d6c7ab] bg-white ' : 'border-[#d6c7ab] bg-[#fbf7ee]/50 opacity-75' }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-xs font-bold text-[#2c221e]">
                              {s.name}
                            </strong>
                            {s.slotsCost > 1 && (
                              <span className="text-t10 font-bold px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#9c4d16]">
                                佔 {s.slotsCost} 槽
                              </span>
                            )}
                            {s.frameRestrictions && (
                              <span className="text-t10 font-mono px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b]">
                                僅限 {s.frameRestrictions.map(fid => findFrameById(fid).name).join('/')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 操作按鈕組 */}
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="flex items-center gap-1 text-t11 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isUnlocked}
                              onChange={() => handleToggleUnlock(s.id)}
                              className="rounded border-[#d6c7ab] text-[#27527a] focus:ring-[#27527a]"
                            />
                            <span className="text-[#6b5a4b]">解鎖</span>
                          </label>

                          <button
                            type="button"
                            disabled={!isUnlocked || isRestricted}
                            onClick={() => handleToggleActive(s.id)}
                            className={`px-2.5 py-1 rounded text-t11 font-bold transition ${ isActive ? 'bg-[#27527a] text-white' : isUnlocked && !isRestricted ? 'bg-[#e8dcc4] text-[#3c2415] hover:bg-[#d6c7ab]' : 'bg-[#f4ebd9] text-[#7c6a58] cursor-not-allowed' }`}
                          >
                            {isActive ? '已啟用' : '啟用'}
                          </button>
                        </div>
                      </div>

                      {/* 子項目自選（反元素抗性選擇） */}
                      {s.hasSubchoice && isActive && (
                        <div className="p-2 rounded bg-white border border-[#d6c7ab] flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#3c2415]">
                            抗性屬性選擇（{renderTextWithAffinities(formData.antiElementChoice + '抗性')}）：
                          </span>
                          <select
                            value={formData.antiElementChoice}
                            onChange={e => setFormData(prev => ({ ...prev, antiElementChoice: e.target.value }))}
                            className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold"
                          >
                            {s.choiceOptions.map(opt => (
                              <option key={opt} value={opt}>{opt} 屬性抗性</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* 次要攻擊模組選擇 */}
                      {s.hasWeaponChoice && isActive && (
                        <div className="p-2 rounded bg-white border border-[#d6c7ab] flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#3c2415]">連動停用武器：</span>
                          <select
                            value={formData.secondaryOffensiveWeaponId}
                            onChange={e => setFormData(prev => ({ ...prev, secondaryOffensiveWeaponId: e.target.value }))}
                            className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold"
                          >
                            <option value="">選擇停用武裝...</option>
                            {formData.unlockedModules
                              .filter(id => !formData.activeModules.includes(id))
                              .map(id => {
                                const w = PILOT_WEAPON_MODULES.find(m => m.id === id);
                                if (!w) return null;
                                return <option key={id} value={id}>{w.name}</option>;
                              })}
                          </select>
                        </div>
                      )}

                      <p className="text-t11 text-[#6b5a4b] border-t border-[#d6c7ab] pt-1 leading-relaxed">
                        {renderTextWithAffinities(s.description)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 底部按鈕區 */}
        <div className="px-5 py-3 border-t border-[#d6c7ab] bg-[#fbf7ee] flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded text-xs font-bold text-[#6b5a4b] hover:text-[#3c2415] hover:bg-[#e8dcc4] transition"
          >
            清空已選配置
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs font-bold border border-[#d6c7ab] text-[#3c2415] hover:bg-[#f4ebd9] transition"
            >
              取消返回
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded text-xs font-bold bg-[#27527a] hover:bg-[#214365] text-white shadow-e1 flex items-center gap-1.5 transition"
            >
              <GiCheckMark className="text-xs" />
              <span>確認並儲存載具配置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
