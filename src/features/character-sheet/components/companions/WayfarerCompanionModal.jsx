import React, { useState, useMemo } from 'react';
import {
  GiPawPrint,
  GiCrossedSwords,
  GiShield,
  GiCheckMark,
  GiHazardSign,
  GiCancel,
  GiHeartPlus,
  GiSparkles,
  GiTrashCan
} from 'react-icons/gi';
import {
  COMPANION_SPECIES,
  COMPANION_ATTRIBUTE_ARRAYS,
  DAMAGE_TYPES,
  ATTRIBUTE_KEYS,
  calculateCompanionMaxHp,
  calculateCompanionCrisisHp,
  createDefaultCompanionData
} from '../../data/wayfarerCompanionData';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { ATTRIBUTE_NAMES, ATTRIBUTE_COLORS } from '../../data/sourcebookConfig';

export default function WayfarerCompanionModal({
  isOpen,
  onClose,
  companionData,
  wayfarerSl = 1,
  characterLevel = 5,
  onSave
}) {
  if (!isOpen) return null;

  // 初始化本地編輯狀態
  const [formData, setFormData] = useState(() => {
    const base = companionData ? { ...companionData } : createDefaultCompanionData();
    return {
      name: base.name || '忠實夥伴',
      species: base.species || '野獸',
      arrayType: base.arrayType || 'standard',
      dex: base.dex || 8,
      ins: base.ins || 8,
      mig: base.mig || 10,
      wlp: base.wlp || 6,
      currentHp: base.currentHp !== undefined ? base.currentHp : null,
      attacks: Array.isArray(base.attacks) && base.attacks.length > 0
        ? base.attacks.map((atk, i) => ({
            id: atk.id || `atk_${Date.now()}_${i}`,
            name: atk.name || '基礎攻擊',
            range: atk.range || 'melee',
            attr1: atk.attr1 || 'MIG',
            attr2: atk.attr2 || 'DEX',
            damageType: atk.damageType || 'physical',
            damageText: atk.damageText || '【HR + 5】物理',
            specialEffect: atk.specialEffect || ''
          }))
        : createDefaultCompanionData().attacks,
      spells: Array.isArray(base.spells)
        ? base.spells.map((sp, i) => ({
            id: sp.id || `spell_${Date.now()}_${i}`,
            name: sp.name || '',
            isOffensive: !!sp.isOffensive,
            mp: sp.mp || '10',
            target: sp.target || '一個生物',
            duration: sp.duration || '瞬發',
            effect: sp.effect || ''
          }))
        : [],
      otherActions: Array.isArray(base.otherActions)
        ? base.otherActions.map((act, i) => ({
            id: act.id || `act_${Date.now()}_${i}`,
            name: act.name || '',
            effect: act.effect || ''
          }))
        : [],
      specialRules: Array.isArray(base.specialRules)
        ? base.specialRules.map((sr, i) => ({
            id: sr.id || `sr_${Date.now()}_${i}`,
            name: sr.name || '',
            effect: sr.effect || ''
          }))
        : []
    };
  });

  const [errorMessage, setErrorMessage] = useState('');

  // 取得選取的體質配置方案
  const selectedArray = useMemo(() => {
    return COMPANION_ATTRIBUTE_ARRAYS.find(a => a.id === formData.arrayType) || COMPANION_ATTRIBUTE_ARRAYS[1];
  }, [formData.arrayType]);

  // 驗證當前四維是否合法吻合該體質骰面組合
  const isAttributesValid = useMemo(() => {
    const targetDice = [...selectedArray.dice].sort((a, b) => a - b);
    const currentDice = [formData.dex, formData.ins, formData.mig, formData.wlp].sort((a, b) => a - b);
    return JSON.stringify(targetDice) === JSON.stringify(currentDice);
  }, [selectedArray, formData.dex, formData.ins, formData.mig, formData.wlp]);

  // 即時計算衍生數值
  const maxHp = useMemo(() => {
    return calculateCompanionMaxHp(wayfarerSl, formData.mig, characterLevel);
  }, [wayfarerSl, formData.mig, characterLevel]);

  const crisisHp = useMemo(() => calculateCompanionCrisisHp(maxHp), [maxHp]);

  // 切換體質方案時，重設四維為該方案的預設排列
  const handleSelectArrayType = (typeId) => {
    setErrorMessage('');
    const arr = COMPANION_ATTRIBUTE_ARRAYS.find(a => a.id === typeId) || COMPANION_ATTRIBUTE_ARRAYS[0];
    const [d1, d2, d3, d4] = arr.dice;
    setFormData(prev => ({
      ...prev,
      arrayType: typeId,
      dex: d2,
      ins: d3,
      mig: d1,
      wlp: d4
    }));
  };

  // 修改攻擊項目
  const handleUpdateAttack = (index, updates) => {
    setFormData(prev => {
      const nextAttacks = [...prev.attacks];
      nextAttacks[index] = { ...nextAttacks[index], ...updates };
      return { ...prev, attacks: nextAttacks };
    });
  };

  // 新增攻擊項目
  const handleAddAttack = () => {
    setFormData(prev => ({
      ...prev,
      attacks: [
        ...prev.attacks,
        {
          id: `atk_${Date.now()}`,
          name: '新攻擊',
          range: 'melee',
          attr1: 'MIG',
          attr2: 'DEX',
          damageType: 'physical',
          damageText: '【HR + 5】物理',
          specialEffect: ''
        }
      ]
    }));
  };

  // 刪除攻擊項目
  const handleDeleteAttack = (index) => {
    setFormData(prev => ({
      ...prev,
      attacks: prev.attacks.filter((_, i) => i !== index)
    }));
  };

  // 咒語管理
  const handleAddSpell = (isOffensive = false) => {
    setFormData(prev => ({
      ...prev,
      spells: [
        ...prev.spells,
        {
          id: `spell_${Date.now()}`,
          name: isOffensive ? '攻擊咒語' : '隨從咒語',
          isOffensive,
          mp: '10',
          target: '一個生物',
          duration: '瞬發',
          effect: ''
        }
      ]
    }));
  };

  const handleUpdateSpell = (index, updates) => {
    setFormData(prev => {
      const next = [...prev.spells];
      next[index] = { ...next[index], ...updates };
      return { ...prev, spells: next };
    });
  };

  const handleDeleteSpell = (index) => {
    setFormData(prev => ({
      ...prev,
      spells: prev.spells.filter((_, i) => i !== index)
    }));
  };

  // 其餘行動管理
  const handleAddOtherAction = () => {
    setFormData(prev => ({
      ...prev,
      otherActions: [
        ...prev.otherActions,
        {
          id: `act_${Date.now()}`,
          name: '特殊行動',
          effect: ''
        }
      ]
    }));
  };

  const handleUpdateOtherAction = (index, updates) => {
    setFormData(prev => {
      const next = [...prev.otherActions];
      next[index] = { ...next[index], ...updates };
      return { ...prev, otherActions: next };
    });
  };

  const handleDeleteOtherAction = (index) => {
    setFormData(prev => ({
      ...prev,
      otherActions: prev.otherActions.filter((_, i) => i !== index)
    }));
  };

  // 特殊規則管理
  const handleAddSpecialRule = () => {
    setFormData(prev => ({
      ...prev,
      specialRules: [
        ...prev.specialRules,
        {
          id: `sr_${Date.now()}`,
          name: '特殊規則',
          effect: ''
        }
      ]
    }));
  };

  const handleUpdateSpecialRule = (index, updates) => {
    setFormData(prev => {
      const next = [...prev.specialRules];
      next[index] = { ...next[index], ...updates };
      return { ...prev, specialRules: next };
    });
  };

  const handleDeleteSpecialRule = (index) => {
    setFormData(prev => ({
      ...prev,
      specialRules: prev.specialRules.filter((_, i) => i !== index)
    }));
  };

  // 儲存送出
  const handleSave = () => {
    if (!isAttributesValid) {
      setErrorMessage(`四維屬性骰分配不符合【${selectedArray.name}】體質組合（需完整分配 ${selectedArray.dice.map(d => `d${d}`).join(', ')}）。`);
      return;
    }
    onSave({
      ...formData,
      maxHp,
      crisisHp,
      def: formData.dex,
      mdef: formData.ins,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white border border-[#d6c7ab] shadow-e3 overflow-hidden text-[#3c2415] text-xs">
        
        {/* 頂部 Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#d6c7ab] bg-[#fbf7ee] flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#f4ebd9] text-[#6b5a4b]">
              <GiPawPrint className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#2c221e]">
                  忠實夥伴隨從檔案
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]">
                  5 級生物 NPC · 旅人 SL {wayfarerSl}
                </span>
              </div>
              <p className="text-t12 text-[#6b5a4b]">
                依據官方核心手冊 p. 219（忠實夥伴）與 p. 302-317（NPC 規則）配置隨從體質與自訂能力
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="夥伴自訂名稱"
              className="px-2.5 py-1 text-xs rounded-lg border border-[#d6c7ab] bg-white font-bold outline-none focus:border-[#3c2415] w-32"
            />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7c6a58] hover:text-[#3c2415] hover:bg-[#e8dcc4] transition"
              title="關閉"
            >
              <GiCancel className="text-base" />
            </button>
          </div>
        </div>

        {/* 錯誤警示 */}
        {errorMessage && (
          <div className="px-5 py-2 bg-[#f9f5eb] border-b border-[#8c2d36]/30 text-[#8c2d36] flex items-center gap-2">
            <GiHazardSign className="text-sm shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 滾動內容區 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* 一、生物物種選擇 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#3c2415] flex items-center gap-1.5">
              <GiSparkles className="text-[#6b5a4b]" />
              <span>1. 夥伴物種</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COMPANION_SPECIES.map(sp => {
                const isSelected = formData.species === sp.name;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, species: sp.name }))}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition ${ isSelected ? 'border-[#3c2415] bg-[#f9f5eb] text-[#3c2415] ring-1 ring-[#3c2415]' : 'border-[#d6c7ab] hover:border-[#a63d40] text-[#3c2415] ' }`}
                  >
                    {sp.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 二、四維體質方案選取 (官方四大體質) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#3c2415] flex items-center gap-1.5">
                <GiHeartPlus className="text-[#6b5a4b]" />
                <span>2. 官方 NPC 四大體質方案（Core p. 302）</span>
              </label>
              {!isAttributesValid && (
                <span className="text-[11px] font-bold text-[#8c2d36]">
                  屬性骰分配與方案不合！
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COMPANION_ATTRIBUTE_ARRAYS.map(arr => {
                const isSelected = formData.arrayType === arr.id;
                return (
                  <button
                    key={arr.id}
                    type="button"
                    onClick={() => handleSelectArrayType(arr.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${ isSelected ? 'border-[#3c2415] bg-[#f9f5eb] ring-1 ring-[#3c2415]' : 'border-[#d6c7ab] bg-white hover:border-[#d6c7ab]' }`}
                  >
                    <span className="font-bold text-[#2c221e]">{arr.name}</span>
                    <span className="text-[11px] font-mono text-[#3c2415] font-bold mt-1">
                      {arr.dice.map(d => `d${d}`).join(', ')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 四維屬性骰下拉分配 */}
            <div className="p-3 rounded-xl bg-[#fbf7ee] border border-[#d6c7ab] grid grid-cols-4 gap-2 text-center">
              <div>
                <span className={`block text-[10px] font-bold mb-1 ${ATTRIBUTE_COLORS.dex}`}>{ATTRIBUTE_NAMES.dex} DEX</span>
                <select
                  value={formData.dex}
                  onChange={e => setFormData(prev => ({ ...prev, dex: Number(e.target.value) }))}
                  className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white font-mono font-bold text-center"
                >
                  {[6, 8, 10, 12].map(d => (
                    <option key={d} value={d}>d{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className={`block text-[10px] font-bold mb-1 ${ATTRIBUTE_COLORS.ins}`}>{ATTRIBUTE_NAMES.ins} INS</span>
                <select
                  value={formData.ins}
                  onChange={e => setFormData(prev => ({ ...prev, ins: Number(e.target.value) }))}
                  className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white font-mono font-bold text-center"
                >
                  {[6, 8, 10, 12].map(d => (
                    <option key={d} value={d}>d{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className={`block text-[10px] font-bold mb-1 ${ATTRIBUTE_COLORS.mig}`}>{ATTRIBUTE_NAMES.mig} MIG</span>
                <select
                  value={formData.mig}
                  onChange={e => setFormData(prev => ({ ...prev, mig: Number(e.target.value) }))}
                  className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white font-mono font-bold text-center"
                >
                  {[6, 8, 10, 12].map(d => (
                    <option key={d} value={d}>d{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className={`block text-[10px] font-bold mb-1 ${ATTRIBUTE_COLORS.wlp}`}>{ATTRIBUTE_NAMES.wlp} WLP</span>
                <select
                  value={formData.wlp}
                  onChange={e => setFormData(prev => ({ ...prev, wlp: Number(e.target.value) }))}
                  className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white font-mono font-bold text-center"
                >
                  {[6, 8, 10, 12].map(d => (
                    <option key={d} value={d}>d{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 三、衍生戰鬥數值即時看板 */}
          <div className="p-3 rounded-xl bg-[#f9f5eb] border border-[#d6c7ab] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div>
              <span className="text-[10px] text-[#6b5a4b] block">最大生命 (HP)</span>
              <strong className="text-sm font-mono text-[#3c2415] font-black">{maxHp}</strong>
              <span className="text-[9px] text-[#7c6a58] block font-mono">({wayfarerSl}×{formData.mig})+{Math.floor(characterLevel/2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#6b5a4b] block">危機值</span>
              <strong className="text-sm font-mono text-[#8c2d36] font-black">{crisisHp}</strong>
              <span className="text-[9px] text-[#7c6a58] block font-mono">≤{crisisHp}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#6b5a4b] block">物理防禦 (DEF)</span>
              <strong className="text-sm font-mono text-[#3c2415] font-bold">{formData.dex}</strong>
              <span className="text-t12 text-[#6b5a4b] block font-mono">DEX 骰面</span>
            </div>
            <div>
              <span className="text-[10px] text-[#6b5a4b] block">魔法防禦 (M.DEF)</span>
              <strong className="text-sm font-mono text-[#3c2415] font-bold">{formData.ins}</strong>
              <span className="text-t12 text-[#6b5a4b] block font-mono">INS 骰面</span>
            </div>
          </div>

          {/* 四、基礎攻擊配置 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-[#3c2415] flex items-center gap-1.5">
                  <GiCrossedSwords className="text-[#6b5a4b]" />
                  <span>3. 基礎攻擊配置（Core p. 303：命中加成 +{wayfarerSl}）</span>
                </label>
                <span className="text-[10px] text-[#7c6a58]">官方建議至多 2 種，可自由調整公式與傷害</span>
              </div>
              <button
                type="button"
                onClick={handleAddAttack}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f9f5eb] text-[#3c2415] border border-[#d6c7ab] hover:bg-[#f4ebd9] transition flex items-center gap-1"
              >
                <span>+ 新增攻擊</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formData.attacks.map((atk, idx) => (
                <div
                  key={atk.id || idx}
                  className="p-3 rounded-xl border border-[#d6c7ab] bg-white space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#3c2415]">基礎攻擊 #{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={atk.range}
                        onChange={e => handleUpdateAttack(idx, { range: e.target.value })}
                        className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[11px] font-bold"
                      >
                        <option value="melee">近戰</option>
                        <option value="ranged">遠程</option>
                      </select>
                      {formData.attacks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttack(idx)}
                          className="p-1 rounded text-[#8c2d36] hover:text-[#76252d] hover:bg-[#f9f5eb] transition"
                          title="刪除此攻擊"
                        >
                          <GiTrashCan className="text-xs" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 攻擊名稱 */}
                  <input
                    type="text"
                    value={atk.name}
                    onChange={e => handleUpdateAttack(idx, { name: e.target.value })}
                    placeholder="攻擊名稱（例如：猛撲撕咬）"
                    className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold outline-none"
                  />

                  {/* 屬性組合選擇 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-[#7c6a58]">判定屬性一</span>
                      <select
                        value={atk.attr1}
                        onChange={e => handleUpdateAttack(idx, { attr1: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-mono font-bold"
                      >
                        {ATTRIBUTE_KEYS.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#7c6a58]">判定屬性二</span>
                      <select
                        value={atk.attr2}
                        onChange={e => handleUpdateAttack(idx, { attr2: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-mono font-bold"
                      >
                        {ATTRIBUTE_KEYS.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 傷害類型快速填寫與手動自訂 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-[#7c6a58]">快速填入傷害屬性</span>
                      <select
                        value={atk.damageType || 'physical'}
                        onChange={e => {
                          const dt = e.target.value;
                          const typeName = DAMAGE_TYPES.find(d => d.id === dt)?.name || '物理';
                          handleUpdateAttack(idx, { damageType: dt, damageText: `【HR + 5】${typeName}` });
                        }}
                        className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold"
                      >
                        {DAMAGE_TYPES.map(dt => (
                          <option key={dt.id} value={dt.id}>{dt.name} 傷害</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] text-[#7c6a58]">傷害公式手寫</span>
                      <input
                        type="text"
                        value={atk.damageText}
                        onChange={e => handleUpdateAttack(idx, { damageText: e.target.value })}
                        placeholder="例如：【HR + 5】物理"
                        className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* 額外特殊效果 */}
                  <div>
                    <span className="block text-[10px] text-[#7c6a58]">額外機制效果（選填）</span>
                    <input
                      type="text"
                      value={atk.specialEffect || ''}
                      onChange={e => handleUpdateAttack(idx, { specialEffect: e.target.value })}
                      placeholder="選填：例如 擊中時使目標陷入中毒狀態"
                      className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs outline-none"
                    />
                  </div>

                  {/* 即時檢定公式預覽 */}
                  <div className="pt-1.5 border-t border-[#d6c7ab] text-[11px] font-mono text-[#3c2415] flex justify-between">
                    <span>命中：【{atk.attr1} + {atk.attr2}】+{wayfarerSl}</span>
                    <span>傷害：{renderTextWithAffinities(atk.damageText)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 五、特殊能力與擴充規則（參照 Core p. 306-317 或 NPC 工坊） */}
          <div className="space-y-3 pt-3 border-t border-[#d6c7ab]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="text-xs font-bold text-[#3c2415] flex items-center gap-1.5">
                  <GiSparkles className="text-[#6b5a4b]" />
                  <span>4. 特殊能力與擴充規則（參照 Core 手冊 p. 306-317 或 NPC 工坊）</span>
                </label>
                <p className="text-t12 text-[#6b5a4b]">
                  若經 GM 許可或技能等級提升，可自訂隨從掌握的咒語、行動或被動特質（Core p. 306-317）
                </p>
              </div>

              {/* 三顆新增按鈕 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddSpell(false)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] hover:bg-[#e8dcc4] transition flex items-center gap-1"
                >
                  <span className="fu-icon text-xs">c</span>
                  <span>+ 咒語</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddOtherAction}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f9f5eb] text-[#3c2415] border border-[#d6c7ab] hover:bg-[#f4ebd9] transition flex items-center gap-1"
                >
                  <span className="fu-icon text-xs">s</span>
                  <span>+ 其餘行動</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddSpecialRule}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] hover:bg-[#e8dcc4] transition flex items-center gap-1"
                >
                  <span>+ 特殊規則</span>
                </button>
              </div>
            </div>

            {/* 空狀態提示 */}
            {formData.spells.length === 0 && formData.otherActions.length === 0 && formData.specialRules.length === 0 && (
              <div className="p-4 rounded-xl border border-dashed border-[#d6c7ab] text-center text-[#7c6a58] text-xs">
                目前尚未配置自訂咒語、行動或特殊規則。請點擊上方按鈕自訂新增（查閱 Core 手冊 p. 306-317）。
              </div>
            )}

            {/* 咒語清單 */}
            {formData.spells.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#6b5a4b] flex items-center gap-1">
                  <span className="fu-icon text-xs">c</span>
                  <span>隨從咒語（{formData.spells.length}）</span>
                </span>
                <div className="space-y-2">
                  {formData.spells.map((sp, idx) => (
                    <div key={sp.id || idx} className="p-3 rounded-xl border border-[#d6c7ab] bg-white space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`fu-icon text-sm font-bold ${sp.isOffensive ? 'text-[#8c2d36]' : 'text-[#3c2415]'}`}>
                            {sp.isOffensive ? 'o' : 'c'}
                          </span>
                          <input
                            type="text"
                            value={sp.name}
                            onChange={e => handleUpdateSpell(idx, { name: e.target.value })}
                            placeholder="咒語名稱（例如：治癒之風、自然祈禱）"
                            className="flex-1 px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold outline-none"
                          />
                        </div>

                        <label className="flex items-center gap-1 text-[11px] cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={sp.isOffensive}
                            onChange={e => handleUpdateSpell(idx, { isOffensive: e.target.checked })}
                            className="rounded border-[#d6c7ab] text-[#8c2d36] focus:ring-[#8c2d36]"
                          />
                          <span className="text-[#6b5a4b] font-bold">攻擊性 (o)</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleDeleteSpell(idx)}
                          className="p-1 rounded text-[#8c2d36] hover:text-[#76252d] hover:bg-[#f9f5eb] transition shrink-0"
                          title="刪除此咒語"
                        >
                          <GiTrashCan className="text-sm" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="block text-[10px] text-[#7c6a58]">MP 消耗</span>
                          <input
                            type="text"
                            value={sp.mp}
                            onChange={e => handleUpdateSpell(idx, { mp: e.target.value })}
                            placeholder="例: 10 或 5 × T"
                            className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#7c6a58]">目標</span>
                          <input
                            type="text"
                            value={sp.target}
                            onChange={e => handleUpdateSpell(idx, { target: e.target.value })}
                            placeholder="例: 一個生物、自身"
                            className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs outline-none"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#7c6a58]">持續時間</span>
                          <input
                            type="text"
                            value={sp.duration}
                            onChange={e => handleUpdateSpell(idx, { duration: e.target.value })}
                            placeholder="例: 瞬發、場景"
                            className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs outline-none"
                          />
                        </div>
                      </div>

                      <textarea
                        value={sp.effect}
                        onChange={e => handleUpdateSpell(idx, { effect: e.target.value })}
                        placeholder="輸入咒語機制效果描述...（提及屬性傷害時將自動渲染圖標與色彩）"
                        rows={2}
                        className="w-full p-2 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs outline-none resize-none leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 其餘行動清單 */}
            {formData.otherActions.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#3c2415] flex items-center gap-1">
                  <span className="fu-icon text-xs">s</span>
                  <span>其餘行動（{formData.otherActions.length}）</span>
                </span>
                <div className="space-y-2">
                  {formData.otherActions.map((act, idx) => (
                    <div key={act.id || idx} className="p-3 rounded-xl border border-[#e8dcc4] bg-white space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="fu-icon text-sm font-bold text-[#3c2415]">s</span>
                          <input
                            type="text"
                            value={act.name}
                            onChange={e => handleUpdateOtherAction(idx, { name: e.target.value })}
                            placeholder="行動名稱（例如：守護咆哮、干擾突襲）"
                            className="flex-1 px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteOtherAction(idx)}
                          className="p-1 rounded text-[#8c2d36] hover:text-[#76252d] hover:bg-[#f9f5eb] transition shrink-0"
                          title="刪除此行動"
                        >
                          <GiTrashCan className="text-sm" />
                        </button>
                      </div>

                      <textarea
                        value={act.effect}
                        onChange={e => handleUpdateOtherAction(idx, { effect: e.target.value })}
                        placeholder="輸入行動機制效果描述..."
                        rows={2}
                        className="w-full p-2 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs outline-none resize-none leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 特殊規則清單 */}
            {formData.specialRules.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#3c2415] flex items-center gap-1">
                  <GiSparkles className="text-xs" />
                  <span>特殊規則（{formData.specialRules.length}）</span>
                </span>
                <div className="space-y-2">
                  {formData.specialRules.map((rule, idx) => (
                    <div key={rule.id || idx} className="p-3 rounded-xl border border-[#d6c7ab] bg-white space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={rule.name}
                          onChange={e => handleUpdateSpecialRule(idx, { name: e.target.value })}
                          placeholder="規則特質名稱（例如：飛行能力、水中呼吸、劇毒體質）"
                          className="flex-1 px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs font-bold outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteSpecialRule(idx)}
                          className="p-1 rounded text-[#8c2d36] hover:text-[#76252d] hover:bg-[#f9f5eb] transition shrink-0"
                          title="刪除此規則"
                        >
                          <GiTrashCan className="text-sm" />
                        </button>
                      </div>

                      <textarea
                        value={rule.effect}
                        onChange={e => handleUpdateSpecialRule(idx, { effect: e.target.value })}
                        placeholder="輸入特殊規則或特性描述..."
                        rows={2}
                        className="w-full p-2 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-xs outline-none resize-none leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部按鈕區 */}
        <div className="px-5 py-3 border-t border-[#d6c7ab] bg-[#fbf7ee] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold border border-[#d6c7ab] text-[#3c2415] hover:bg-[#f4ebd9] transition"
          >
            取消返回
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-1.5 rounded-lg text-xs font-bold bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] shadow-xs flex items-center gap-1.5 transition"
          >
            <GiCheckMark className="text-xs" />
            <span>確認並儲存夥伴設定</span>
          </button>
        </div>
      </div>
    </div>
  );
}
