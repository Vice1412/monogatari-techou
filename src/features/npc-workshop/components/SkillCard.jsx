/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */
import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Save, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { GiBroadsword } from 'react-icons/gi';
import { resolveTemplateVariablesForDisplay, renderFormattedText } from '../utils/displayText';

const SkillCard = ({ skill, isActive, isDisabled, isOverBudget, lockedMsg, onToggle, onSelectionChange, onUpdateSkill, npcLevel, partyLevel }) => {
  const isClickableTag = (tag) => ['select', 'input', 'textarea', 'button'].includes(tag);
  const textareaRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);

  // Reset editing mode if card is deselected
  useEffect(() => {
    if (!isActive) setIsEditing(false);
  }, [isActive]);

  let effectiveDesc = skill.originalDesc;
  if (!effectiveDesc && skill.category === 'attack' && skill.attack?.extra) {
    effectiveDesc = skill.attack.extra;
  }
  if (skill.selectionsConfig) {
    skill.selectionsConfig.forEach(cfg => {
      if (cfg.type === 'checkbox' && cfg.enhancedDesc && skill.selections?.[cfg.key]) effectiveDesc = cfg.enhancedDesc;
    });
  }
  const getCleanTextForEditor = (text) => {
    if (!text) return "";
    return text.replace(/<\/?(?:meta|status)[^>]*>/gi, '');
  };

  const currentDesc = skill.customDesc ?? effectiveDesc;

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (isActive) {
      adjustHeight();
    }
  }, [isActive, currentDesc]);

  return (
    <div className={`relative flex flex-col p-4 rounded border-2 transition-all duration-200 text-left overflow-hidden group ${lockedMsg ? 'bg-[#f4ebd9]/70 border-[#d6c7ab] opacity-60 grayscale cursor-not-allowed select-none' : isOverBudget && isActive ? 'bg-[#f9f5eb] border-[#8c2d36] opacity-90 shadow-md transform z-10' : isActive ? 'bg-[#f9f5eb] border-[#3c2415] shadow-md transform z-10' : isDisabled ? 'bg-[#f4ebd9]/50 border-[#d6c7ab] opacity-60 grayscale cursor-not-allowed' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#3c2415] hover:bg-[#fbf7ee] cursor-pointer'}`} onClick={(e) => { if (isClickableTag(e.target.tagName.toLowerCase())) return; if (lockedMsg && !isActive) return; if (!isDisabled || isActive) onToggle(); }}>
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
        {!isActive && <div className="w-5 h-5 rounded-full border-2 border-[#d6c7ab] group-hover:border-[#3c2415]"></div>}
        {isActive && (
          <div className="flex flex-col items-end gap-2">
            {!isOverBudget && <CheckCircle2 className="text-[#6b5a4b] drop-shadow-sm" size={24} />}
            {!isEditing ? (
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="p-1.5 bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] rounded hover:bg-[#e8dcc4] transition-all group/edit hide-on-export"
                title="編輯技能文字"
              >
                <Edit3 size={16} />
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
                className="p-1.5 bg-[#a63d40] text-[#fffdf9] rounded hover:bg-[#8c3235] transition-all shadow-sm hide-on-export"
                title="完成編輯"
              >
                <Save size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className={`font-bold text-t14 mb-2 pr-6 leading-tight flex flex-col sm:flex-row sm:items-center gap-2 ${lockedMsg ? 'text-[#6b5a4b]' : isOverBudget && isActive ? 'text-[#8c2d36]' : isActive ? 'text-[#2c221e]' : 'text-[#3c2415]'}`}>
        {isEditing ? (
          <div className="flex-1 relative group/input">
            <input
              type="text"
              className={`bg-transparent border border-transparent rounded px-1 -mx-1 outline-none w-full transition-colors hover:border-[#d6c7ab] hover:bg-[#fbf7ee] focus:border-[#3c2415] focus:bg-[#fffdf9] ${isOverBudget ? 'text-[#8c2d36]' : skill.customName !== undefined ? 'text-[#3c2415] font-bold' : 'text-[#2c221e]'}`}
              value={skill.customName !== undefined ? skill.customName : skill.originalName}
              onChange={(e) => onUpdateSkill(skill.id, { customName: e.target.value })}
              onBlur={(e) => { if (!e.target.value.trim()) onUpdateSkill(skill.id, { customName: undefined }); }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute -bottom-4 left-0 text-t10 text-[#6b5a4b] font-bold opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none">正在編輯自定義名稱</div>
          </div>
        ) : (
          <span className={skill.customName !== undefined ? 'text-[#3c2415] font-bold' : ''}>{skill.customName || skill.originalName}</span>
        )}
        {lockedMsg ? (
          <span className="text-t10 bg-[#e8dcc4] text-[#3c2415] border border-[#7c6a58] px-2 py-0.5 rounded flex items-center gap-1 shrink-0 w-fit font-bold"><Lock size={10} /> {lockedMsg}</span>
        ) : (
          isOverBudget && isActive && <span className="text-t10 bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36] px-2 py-0.5 rounded flex items-center gap-1 shrink-0 w-fit"><AlertCircle size={10} /> 額度溢出失效</span>
        )}
      </div>
      {skill.flavorText && (
        <div className="mb-2">
          <div className={`text-xs italic ${isOverBudget && isActive ? 'text-[#8c2d36]' : 'text-[#6b5a4b]'}`}>{skill.flavorText}</div>
          <div className={`border-b mt-2 ${isOverBudget && isActive ? 'border-[#8c2d36]/30' : 'border-[#d6c7ab]/50'}`}></div>
        </div>
      )}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className={`text-sm leading-relaxed w-full bg-transparent border border-transparent rounded px-1 -mx-1 outline-none resize-none overflow-hidden transition-colors hover:border-[#d6c7ab] hover:bg-[#f4ebd9] focus:border-[#a63d40] focus:bg-[#fffdf9] min-h-[3rem] ${isOverBudget ? 'text-[#8c2d36]' : skill.customDesc !== undefined ? 'text-[#2c221e]' : 'text-[#3c2415]'}`}
          value={resolveTemplateVariablesForDisplay(getCleanTextForEditor(skill.customDesc !== undefined ? skill.customDesc : effectiveDesc), skill.selections, { damageEmojis: true })}
          placeholder={resolveTemplateVariablesForDisplay(getCleanTextForEditor(effectiveDesc), skill.selections, { damageEmojis: true })}
          onChange={(e) => {
            onUpdateSkill(skill.id, { customDesc: e.target.value });
            adjustHeight();
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              onUpdateSkill(skill.id, { customDesc: undefined });
              setTimeout(adjustHeight, 0);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className={`text-sm leading-relaxed ${isOverBudget && isActive ? 'text-[#8c2d36]' : skill.customDesc !== undefined ? 'text-[#3c2415] font-medium' : 'text-[#6b5a4b]'}`}>{renderFormattedText(currentDesc, skill.selections, npcLevel, partyLevel)}</div>
      )}
      {/* 模板裡的 `{key}` 未填時畫成空虛線框，但那框沒有文字標籤——不點下去不知道要填什麼。
          這裡先講「有幾個欄位要填」，讓使用者知道那條虛線不是壞掉。 */}
      {!isActive && skill.category !== 'attack' && Array.isArray(skill.selectionsConfig) && skill.selectionsConfig.length > 0 && (
        <div className="mt-2 text-t10 text-[#3c2415] font-bold">選取後可填 {skill.selectionsConfig.length} 個欄位</div>
      )}
      {isActive && skill.selectionsConfig && skill.category !== 'attack' && (
        <div className={`mt-4 pt-3 border-t flex flex-col gap-2 animate-in slide-in-from-top-2 ${isOverBudget ? 'border-[#8c2d36]/50' : 'border-[#d6c7ab]/60'}`}>
          {skill.selectionsConfig
            .filter(cfg => (!cfg.showIfKey || (skill.selections?.[cfg.showIfKey] || "").includes(cfg.showIfValue)) && (!cfg.reqLevel || npcLevel >= cfg.reqLevel))
            .map(cfg => {
              if (cfg.type === 'multiselect') {
                const selected = Array.isArray(skill.selections?.[cfg.key]) ? skill.selections[cfg.key] : [];
                const maxReached = selected.length >= (cfg.max || Infinity);
                return (
                  <div key={cfg.key} className={`p-2 rounded border ${isOverBudget ? 'bg-[#f9f5eb] border-[#8c2d36]/50' : 'bg-[#f4ebd9]/60 border-[#d6c7ab]'}`} onClick={e => e.stopPropagation()}>
                    <div className={`flex justify-between items-center mb-2 text-xs font-bold ${isOverBudget ? 'text-[#8c2d36]' : 'text-[#3c2415]'}`}>
                      <span>{cfg.label}</span>
                      <span className={`px-2 py-0.5 rounded text-t10 ${selected.length < (cfg.min || 0) ? 'bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36]/50' : maxReached ? 'bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]' : 'bg-[#fffdf9] text-[#3c2415] border border-[#d6c7ab]'}`}>已選: {selected.length}/{cfg.max || '∞'}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {cfg.options.map(opt => {
                        const isChecked = selected.includes(opt);
                        const isDisabledOpt = !isChecked && maxReached;
                        return (
                          <label key={opt} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all cursor-pointer select-none ${isDisabledOpt ? 'opacity-40 cursor-not-allowed' : isChecked ? 'bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]' : 'hover:bg-[#e8dcc4]/50 text-[#3c2415] border border-transparent'}`}>
                            <input type="checkbox" className="accent-[#a63d40] w-3.5 h-3.5 shrink-0" checked={isChecked} disabled={isDisabledOpt} onChange={() => {
                              const newVal = isChecked ? selected.filter(v => v !== opt) : [...selected, opt];
                              onSelectionChange(skill.id, cfg.key, newVal);
                            }} />
                            <span className="font-bold">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              if (cfg.type === 'input') {
                return (
                  <label key={cfg.key} className={`flex flex-col gap-1.5 p-2 rounded border bg-[#f4ebd9]/60 ${isOverBudget ? 'text-[#8c2d36] border-[#8c2d36]/50' : 'text-[#3c2415] border-[#d6c7ab]'}`} onClick={e => e.stopPropagation()}>
                    <span className="text-xs font-bold">{cfg.label}</span>
                    <input
                      type="text"
                      className={`bg-[#fffdf9] text-[#2c221e] border p-1.5 rounded text-xs outline-none transition-colors border-[#d6c7ab] focus:border-[#3c2415]`}
                      placeholder={cfg.placeholder || "在此輸入..."}
                      value={skill.selections?.[cfg.key] || ''}
                      onChange={(e) => onSelectionChange(skill.id, cfg.key, e.target.value)}
                    />
                  </label>
                );
              }
              if (cfg.type === 'checkbox') {
                const isChecked = !!skill.selections?.[cfg.key];
                return (
                  <label key={cfg.key} className={`flex items-center gap-2 p-2 rounded border bg-[#f4ebd9]/60 cursor-pointer select-none transition-all ${isChecked ? (isOverBudget ? 'text-[#8c2d36] border-[#8c2d36] bg-[#f4ebd9]' : 'text-[#3c2415] border-[#3c2415] bg-[#f4ebd9]') : (isOverBudget ? 'text-[#8c2d36] border-[#8c2d36]/50' : 'text-[#3c2415] border-[#d6c7ab] hover:border-[#3c2415]')}`} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="accent-[#a63d40] w-3.5 h-3.5 shrink-0" checked={isChecked} onChange={() => onSelectionChange(skill.id, cfg.key, !isChecked)} />
                    <span className="text-xs font-bold">{cfg.label}</span>
                    {isChecked && <span className="text-t10 bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] px-1.5 py-0.5 rounded ml-auto">已啟用</span>}
                  </label>
                );
              }
              let finalOptions = cfg.options;
              if (skill.libId === 'bs_obj_1' && cfg.key === 'repeat_penalty') {
                const failureStatus = skill.selections?.failure_status;
                const statusPool = ['緩慢', '眩暈', '虛弱', '動搖'];
                const filteredStatuses = statusPool.filter(s => s !== failureStatus);
                finalOptions = [
                  '失去 [消耗戰HP] HP',
                  '失去 [消耗戰MP] MP',
                  ...filteredStatuses.map(s => `受到${s}狀態`)
                ];
              } else if (skill.id === 'ns_8' || skill.originalName === '狀態束縛') {
                const usedValues = Object.values(skill.selections || {});
                finalOptions = cfg.options.filter(opt => !usedValues.includes(opt) || opt === skill.selections?.[cfg.key]);
              }
              return (
                <label key={cfg.key} className={`flex justify-between items-center text-xs font-bold p-2 rounded border ${isOverBudget ? 'bg-[#f9f5eb] text-[#8c2d36] border-[#8c2d36]/50' : cfg.isLinked ? 'bg-[#f4ebd9]/80 text-[#3c2415] border-[#d6c7ab] ml-4 -mt-1' : 'bg-[#f4ebd9]/60 text-[#3c2415] border-[#d6c7ab]'}`}>
                  {cfg.label}
                  <select className={`bg-[#fffdf9] text-[#2c221e] border p-1 rounded outline-none w-32 transition-colors ${isOverBudget ? 'border-[#8c2d36] focus:border-[#8c2d36]' : cfg.isLinked ? 'border-[#7c6a58] focus:border-[#3c2415]' : 'border-[#d6c7ab] focus:border-[#3c2415]'}`} value={skill.selections?.[cfg.key] || ''} onChange={(e) => onSelectionChange(skill.id, cfg.key, e.target.value)} onClick={e => e.stopPropagation()} >
                    <option value="">選擇...</option>{finalOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
              );
            })}
        </div>
      )}
      {isActive && skill.category === 'attack' && <div className={`mt-3 pt-2 border-t text-t11 font-bold flex items-center gap-1 ${isOverBudget ? 'border-[#8c2d36]/50 text-[#8c2d36]' : 'border-[#d6c7ab]/50 text-[#3c2415]'}`}><GiBroadsword size={12} /> {isOverBudget ? '因額度溢出，此技能已從上方【基礎攻擊與核心能力】中移除。' : '已加入上方【基礎攻擊與核心能力】，請至該區塊配置詳細數值。'}</div>}
    </div>
  );
};

export default SkillCard;
