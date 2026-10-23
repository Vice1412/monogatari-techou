/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */
import React, { useState, useEffect } from 'react';
import { Edit3, Save, Trash2, X, Lock } from 'lucide-react';
import { DAMAGE_TYPES, CATEGORIES, TYPE_STYLES, isOffensiveSpell, normalizeSpellName } from '../data';
import { renderFormattedText } from '../utils/displayText';
import { resolveAttack, unfreezeAttackField } from '../utils/attackDisplay';

const EditableSkill = ({ skill, rawSkill, onUpdate, onDelete, onUpdateSelection, finalStats, npcLevel, partyLevel }) => {
  const baseSkill = rawSkill || skill;

  // 距離／公式／屬性只要技能宣告了同名選單欄位，選單就是唯一真相（見 utils/attackDisplay.js）。
  // 這裡把「被寫死的舊值」還原成佔位符再當成編輯狀態的起點，存檔才不會把選單鎖死。
  const seedAttack = (a) => {
    const base = a || { distance: '近戰', formula: '【靈】+【靈】', baseDmg: 5, type: '物理' };
    return {
      ...base,
      distance: unfreezeAttackField(base.distance, 'distance', skill.selectionsConfig),
      formula: unfreezeAttackField(base.formula, 'formula', skill.selectionsConfig),
      type: unfreezeAttackField(base.type, 'type', skill.selectionsConfig),
    };
  };
  const selCfg = (key) => (Array.isArray(skill.selectionsConfig)
    ? skill.selectionsConfig.find((cfg) => cfg && cfg.key === key)
    : undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(skill.customName || skill.originalName);
  const [editDesc, setEditDesc] = useState(
    skill.customDesc !== undefined ? skill.customDesc :
    (skill.originalDesc || (baseSkill.category === 'attack' ? baseSkill.attack?.extra || "" : ""))
  );
  const [editAttack, setEditAttack] = useState(() => seedAttack(baseSkill.attack));

  const initialTargetType = skill.spellData?.targetType || (skill.spellData?.target?.includes('至多') ? '至多 X 個生物' : skill.spellData?.target || '一個生物');
  const initialMaxTargets = skill.spellData?.maxTargets || (skill.spellData?.target?.match(/\d+/) ? skill.spellData.target.match(/\d+/)[0] : '3');
  const initialBaseMp = skill.spellData?.baseMp || (skill.spellData?.mp ? skill.spellData.mp.replace(/×\s*T/gi, '').trim() : '10');

  const [editSpellData, setEditSpellData] = useState({
    baseMp: initialBaseMp,
    targetType: initialTargetType,
    maxTargets: initialMaxTargets,
    duration: skill.spellData?.duration || '瞬發',
    isOffensive: skill.spellData?.isOffensive || isOffensiveSpell(skill.customName || skill.originalName),
    formula: skill.spellData?.formula || '[INS + WLP]'
  });

  const isDefault = skill.isDefault || (!skill.source && skill.category === 'attack' && !skill.id.startsWith('custom_')) || skill.source === 'levelPassive';

  useEffect(() => {
    if (!isEditing) {
      setEditName(skill.customName || skill.originalName);
      setEditDesc(
        skill.customDesc !== undefined ? skill.customDesc :
        (skill.originalDesc || (baseSkill.category === 'attack' ? baseSkill.attack?.extra || "" : ""))
      );
      setEditAttack(seedAttack(baseSkill.attack));
      
      const tType = skill.spellData?.targetType || (skill.spellData?.target?.includes('至多') ? '至多 X 個生物' : skill.spellData?.target || '一個生物');
      const mTargets = skill.spellData?.maxTargets || (skill.spellData?.target?.match(/\d+/) ? skill.spellData.target.match(/\d+/)[0] : '3');
      const bMp = skill.spellData?.baseMp || (skill.spellData?.mp ? skill.spellData.mp.replace(/×\s*T/gi, '').trim() : '10');
      
      setEditSpellData({
        baseMp: bMp,
        targetType: tType,
        maxTargets: mTargets,
        duration: skill.spellData?.duration || '瞬發',
        isOffensive: skill.spellData?.isOffensive || isOffensiveSpell(skill.customName || skill.originalName),
        formula: skill.spellData?.formula || '[INS + WLP]'
      });
    }
  }, [isEditing, skill, baseSkill]);

  const handleSave = () => {
    let computedTarget = editSpellData.targetType;
    if (editSpellData.targetType === '至多 X 個生物') {
      computedTarget = `至多 ${editSpellData.maxTargets.trim() || '3'} 個生物`;
    }
    let cleanBaseMp = editSpellData.baseMp.replace(/×\s*T/gi, '').trim() || '10';
    let computedMp = editSpellData.targetType === '至多 X 個生物' ? `${cleanBaseMp} × T` : cleanBaseMp;

    const finalName = editName.trim();

    onUpdate(skill.id, {
      customName: finalName === (skill.originalName || '') ? undefined : finalName,
      customDesc: editDesc,
      attack: skill.category === 'attack' ? {
        ...editAttack,
        // 有同名選單的欄位一律存回佔位符：寫死等於把選單永久鎖住（見 utils/attackDisplay.js）。
        distance: unfreezeAttackField(editAttack.distance, 'distance', skill.selectionsConfig),
        formula: unfreezeAttackField(editAttack.formula, 'formula', skill.selectionsConfig),
        type: unfreezeAttackField(editAttack.type, 'type', skill.selectionsConfig),
      } : undefined,
      spellData: skill.category === 'spell' ? {
        mp: computedMp,
        baseMp: cleanBaseMp,
        targetType: editSpellData.targetType,
        maxTargets: editSpellData.maxTargets,
        target: computedTarget,
        duration: editSpellData.duration?.trim() || '瞬發',
        isOffensive: editSpellData.isOffensive,
        formula: editSpellData.isOffensive ? (editSpellData.formula || '[INS + WLP]') : undefined
      } : undefined
    });
    setIsEditing(false);
  };
  const handleCategoryChange = (e) => onUpdate(skill.id, { category: e.target.value });

  if (isEditing) {
    return (
      <div className="border-2 border-dashed border-[#a63d40] p-3 mb-3 bg-[#fffdf9] rounded-lg text-[#2c221e]">
        <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-[#6b5a4b]">編輯名稱：</span><input type="text" className="flex-1 bg-[#fbf7ee] border border-[#d6c7ab] p-1.5 rounded text-sm text-[#2c221e] font-bold outline-none focus:border-[#3c2415]" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>

        {skill.category === 'attack' && (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1 bg-[#f8f3e6] p-2 rounded border border-[#e2d6c1] text-xs">
            <div><label className="block text-[#6b5a4b] mb-1 font-bold">距離</label>
              {selCfg('distance') ? (
                <select className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e]" value={skill.selections?.distance || ''} onChange={e => onUpdateSelection(skill.id, 'distance', e.target.value)}><option value="">選擇</option>{selCfg('distance').options.map(o => <option key={o} value={o}>{o}</option>)}</select>
              ) : (
                <select className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e]" value={editAttack.distance} onChange={e => setEditAttack({ ...editAttack, distance: e.target.value })}><option value="近戰">近戰</option><option value="遠程">遠程</option></select>
              )}
            </div>
            <div><label className="block text-[#6b5a4b] mb-1 font-bold">檢定公式</label>
              {selCfg('formula') ? (
                <select className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e]" value={skill.selections?.formula || ''} onChange={e => onUpdateSelection(skill.id, 'formula', e.target.value)}><option value="">選擇</option>{selCfg('formula').options.map(o => <option key={o} value={o}>{o}</option>)}</select>
              ) : (
                <input type="text" className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e]" value={editAttack.formula} onChange={e => setEditAttack({ ...editAttack, formula: e.target.value })} />
              )}
            </div>
            <div><label className="block text-[#6b5a4b] mb-1 font-bold font-mono">基礎傷害 HR+</label><input type="number" className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e]" value={editAttack.baseDmg} onChange={e => setEditAttack({ ...editAttack, baseDmg: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="block text-[#6b5a4b] mb-1 font-bold">屬性</label>
              {selCfg('type') ? (
                <select className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e]" value={skill.selections?.type || ''} onChange={e => onUpdateSelection(skill.id, 'type', e.target.value)}><option value="">選擇</option>{selCfg('type').options.map(o => <option key={o} value={o}>{o}</option>)}</select>
              ) : (
                <select className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e]" value={editAttack.type} onChange={e => setEditAttack({ ...editAttack, type: e.target.value })}>{DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              )}
            </div>
          </div>
          {(selCfg('distance') || selCfg('formula') || selCfg('type')) && (
            <p className="text-t12 text-[#3c2415] font-bold mb-2 leading-relaxed">
              ※ 距離／公式／屬性與卡片上的同名選單是同一份設定——在這裡改就是改那裡，不會另外鎖死一份值。
            </p>
          )}
          </>
        )}

        {skill.category === 'spell' && (
          <div className="flex flex-col gap-3 w-full bg-[#f8f3e6] p-2.5 rounded border border-[#e2d6c1] text-xs mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[#6b5a4b] mb-1 font-bold">目標</label>
                <select
                  className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e] font-bold"
                  value={editSpellData.targetType}
                  onChange={e => setEditSpellData({ ...editSpellData, targetType: e.target.value })}
                >
                  <option value="一個生物">一個生物</option>
                  <option value="自身">自身</option>
                  <option value="至多 X 個生物">至多 X 個生物</option>
                  <option value="特殊">特殊</option>
                </select>
              </div>

              {editSpellData.targetType === '至多 X 個生物' ? (
                <div>
                  <label className="block text-[#6b5a4b] mb-1 font-bold">目標數量</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e] font-bold"
                    placeholder="例: 3"
                    value={editSpellData.maxTargets}
                    onChange={e => setEditSpellData({ ...editSpellData, maxTargets: e.target.value })}
                  />
                </div>
              ) : (
                <div className="hidden sm:block"></div>
              )}

              <div>
                <label className="block text-[#6b5a4b] mb-1 font-bold">
                  MP 消耗 {editSpellData.targetType === '至多 X 個生物' && <span className="text-[#3c2415] font-normal">(自動填寫 × T)</span>}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e] font-bold"
                    placeholder="例: 10"
                    value={editSpellData.baseMp}
                    onChange={e => setEditSpellData({ ...editSpellData, baseMp: e.target.value })}
                  />
                  {editSpellData.targetType === '至多 X 個生物' && (
                    <span className="text-[#2c221e] font-extrabold text-sm shrink-0">× T</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[#6b5a4b] mb-1 font-bold">持續時間</label>
                <select
                  className="w-full bg-[#fffdf9] border border-[#d6c7ab] p-1 rounded text-[#2c221e] font-bold"
                  value={editSpellData.duration}
                  onChange={e => setEditSpellData({ ...editSpellData, duration: e.target.value })}
                >
                  <option value="瞬發">瞬發</option>
                  <option value="場景">場景</option>
                  <option value="特別">特別</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-[#d6c7ab]">
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#3c2415]">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-[#a63d40]"
                  checked={editSpellData.isOffensive}
                  onChange={e => setEditSpellData({ ...editSpellData, isOffensive: e.target.checked })}
                />
                <span>攻擊性咒語 (包含魔法檢定)</span>
              </label>

              {editSpellData.isOffensive && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#6b5a4b]">魔法檢定公式:</span>
                  <select
                    className="bg-[#fffdf9] text-[#2c221e] text-xs font-bold border border-[#d6c7ab] p-1 rounded outline-none"
                    value={editSpellData.formula}
                    onChange={e => setEditSpellData({ ...editSpellData, formula: e.target.value })}
                  >
                    <option value="[INS + WLP]">【INS + WLP】(洞察 + 意志)</option>
                    <option value="[MIG + WLP]">【MIG + WLP】(體格 + 意志)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        <textarea className="w-full bg-[#fbf7ee] text-[#2c221e] p-2 border border-[#d6c7ab] outline-none h-24 resize-none rounded leading-relaxed text-sm focus:border-[#3c2415]" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder={skill.category === 'attack' ? "輸入自訂的額外效果..." : "技能效果與敘述..."} />
        <div className="flex justify-end gap-2 mt-3"><button onClick={() => setIsEditing(false)} className="text-sm px-3 py-1 bg-[#eee6d3] hover:bg-[#e4d9c0] text-[#3c2f21] rounded transition-colors border border-[#d6c7ab]">取消</button><button onClick={handleSave} className="text-sm px-3 py-1 bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] rounded flex items-center gap-1 transition-colors"><Save size={14} /> 保存</button></div>
      </div>
    );
  }

  return (
    <div className={`group relative border-l-4 ${skill.source === 'levelPassive' ? 'border-[#3c2415] bg-[#f9f5eb]' : 'border-[#7c6a58] bg-[#fffdf9]'} hover:bg-[#fbf7ee] transition-colors rounded-r py-2.5 pl-3 mb-3 border border-[#d6c7ab] ${skill.isSecretArt ? 'ring-1 ring-[#3c2415]/30 bg-[#fffdf9]' : ''}`}>
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#fffdf9] p-1 rounded shadow border border-[#d6c7ab] z-10"><button onClick={() => setIsEditing(true)} className="p-1 hover:text-[#3c2415]" title="編輯"><Edit3 size={14} /></button>{!isDefault && <button onClick={() => onDelete(skill.id)} className="p-1 hover:text-[#76252d]" title="刪除"><Trash2 size={14} /></button>}</div>
      <div className="font-bold text-[15px] mb-1 flex items-center gap-2 text-[#3c2415]"><span className="text-[#6b5a4b] text-xs bg-[#f4ebd9] px-1.5 py-0.5 rounded border border-[#d6c7ab]">{CATEGORIES.find(c => c.id === skill.category)?.name || '未分類'}</span>{normalizeSpellName(skill.customName || skill.originalName)}
          {skill.isSecretArt && (
            <span className="text-[10px] text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab] px-1 rounded font-normal">※ 祕技</span>
          )}{isOffensiveSpell(skill.customName || skill.originalName) && <span className="fu-icon text-[#8c2d36] drop- text-lg ml-0.5">{TYPE_STYLES['攻擊性咒語']?.fuIcon || 'o'}</span>}{!isDefault && <span className="text-[10px] text-[#8c2d36] border border-[#8c2d36]/50 bg-[#f9f5eb] px-1 rounded">自訂</span>}{skill.source === 'levelPassive' && <span className="text-[10px] text-[#3c2415] border border-[#d6c7ab] bg-[#f4ebd9] px-1 rounded"><Lock size={10} className="inline mr-1 mb-0.5" />等級解鎖</span>}</div>
      {skill.selectionsConfig && (
        <div className={`mt-2 flex flex-col gap-2 p-2 bg-[#f8f3e6] border border-[#e2d6c1] rounded text-xs border-l-2 ${skill.source === 'levelPassive' ? 'border-[#3c2415]' : 'border-[#8c2d36]'} mb-2`}>
          {skill.selectionsConfig
            .filter(cfg => (!cfg.showIfKey || (skill.selections?.[cfg.showIfKey] || "").includes(cfg.showIfValue)) && (!cfg.reqLevel || npcLevel >= cfg.reqLevel))
            .map(cfg => (
              <label key={cfg.key} className={`flex items-center gap-2 font-bold p-1.5 rounded border ${cfg.isLinked ? 'bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab] ml-4 -mt-1' : 'text-[#3c2f21] border-transparent'}`}>{cfg.label}:
                <select className={`bg-[#fffdf9] text-[#2c221e] border border-[#d6c7ab] p-1 rounded outline-none max-w-[200px] truncate transition-colors ${cfg.isLinked ? 'focus:border-[#3c2415]' : skill.source === 'levelPassive' ? 'focus:border-[#3c2415]' : 'focus:border-[#8c2d36]'}`} value={skill.selections?.[cfg.key] || ''} onChange={(e) => onUpdateSelection(skill.id, cfg.key, e.target.value)}>
                  <option value="">選擇</option>{cfg.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
            ))}
        </div>
      )}

      {(skill.category === 'spell' || skill.spellData) && (
        <div className="bg-[#f8f3e6] border border-[#e2d6c1] p-1.5 my-1 rounded text-xs text-[#6b5a4b] font-bold flex flex-wrap gap-2 items-center w-fit">
          <span>MP: <span className="text-blue-800">{skill.spellData?.mp || '10'}</span></span>
          <span className="text-[#d6c7ab]">|</span>
          <span>目標: <span className="text-[#2c221e]">{skill.spellData?.target || '一個生物'}</span></span>
          <span className="text-[#d6c7ab]">|</span>
          <span>持續: <span className="text-[#2c221e]">{skill.spellData?.duration || '瞬發'}</span></span>
        </div>
      )}

      {(() => {
        const hasCustomDesc = skill.customDesc !== undefined && skill.customDesc.trim() !== '';
        let displayDesc = skill.originalDesc || "";
        let displayExtra = skill.attack?.extra;

        if (skill.category === 'attack' && !skill.originalDesc) {
          if (hasCustomDesc) {
            displayDesc = "";
            displayExtra = skill.customDesc;
          }
        } else if (hasCustomDesc) {
          displayDesc = skill.customDesc;
        }

        return (
          <>
            {skill.attack && (() => {
              // 顯示端與儲存端共用同一套解析規則：宣告了同名選單就以選單為準。
              const atk = resolveAttack(skill.attack, skill.selections, skill.selectionsConfig);
              const resolvedType = atk.type;
              const typeInfo = TYPE_STYLES[resolvedType];
              const isRanged = String(atk.distance).includes('遠程');

              return (
                <div className="bg-[#f8f3e6] border border-[#e2d6c1] p-2 my-1 rounded text-sm">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-1">
                    <span className="inline-flex items-center gap-1 text-[#3c2f21] bg-[#e8dec8] px-2 py-0.5 rounded text-xs font-bold shrink-0 shadow-2xs">
                      <span className="fu-icon text-sm leading-none translate-y-[0.5px]">{isRanged ? 'r' : 'm'}</span>
                      <span>{renderFormattedText(atk.distance, skill.selections, npcLevel, partyLevel)}</span>
                    </span>
                    <span className="text-blue-900 font-bold">
                      {renderFormattedText(atk.formula, skill.selections, npcLevel, partyLevel)}
                    </span>
                    <span className="text-[#7c6a58] text-xs select-none">✦</span>
                    <span className="inline-flex items-center gap-1 font-bold text-[#8c2d36]">
                      <span>[HR + {skill.attack.baseDmg}]</span>
                      {DAMAGE_TYPES.includes(resolvedType) ? (
                        <span className={`inline-flex items-center gap-0.5 ${typeInfo?.color || 'text-[#8c2d36]'}`}>
                          {typeInfo?.fuIcon && (
                            <span className="fu-icon text-sm leading-none translate-y-[0.5px]">{typeInfo.fuIcon}</span>
                          )}
                          <span>{resolvedType}</span>
                        </span>
                      ) : (
                        renderFormattedText(atk.type, skill.selections, npcLevel, partyLevel)
                      )}
                      <span>傷害</span>
                    </span>
                  </div>
                  {displayExtra && <div className="text-[#574c43] mt-1 text-xs border-t border-[#d6c7ab]/60 pt-1 whitespace-pre-wrap">{renderFormattedText(displayExtra, skill.selections, npcLevel, partyLevel)}</div>}
                </div>
              );
            })()}
            {displayDesc && (
              <div className="text-sm text-[#3c2415] leading-relaxed whitespace-pre-wrap mt-1">{renderFormattedText(displayDesc, skill.selections, npcLevel, partyLevel)}</div>
            )}
            {skill.isSecretArt && (
              <div className="text-[#6b5a4b] mt-1.5 text-xs font-bold">
                *(此{skill.attack ? '攻擊' : skill.category === 'spell' ? '咒語' : '技能'}為祕技，除了目標之外沒有人會意識到那是什麼。)*
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default EditableSkill;
