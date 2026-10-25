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
import { CATEGORIES, TYPE_STYLES, SPELLS_DATA, isOffensiveSpell, normalizeSpellName } from '../data';
import { resolveTemplateVariablesForDisplay, renderFormattedText } from '../utils/displayText';

const SpellCard = ({ skillId, spellName, isActive, isDisabled, isOverBudget, isClaimedElsewhere, onToggle, selections, selectionsConfig, onSelectionChange, isSecretArt, npcLevel, partyLevel }) => {
  const isClickableTag = (tag) => ['select', 'input', 'textarea', 'button'].includes(tag);
  const textareaRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isActive) setIsEditing(false);
  }, [isActive]);

  const isOffensive = isOffensiveSpell(spellName);
  const isMaxMp = spellName === "最大 MP +10";
  const cleanSpellName = normalizeSpellName(spellName);
  const spellData = SPELLS_DATA[cleanSpellName];

  const getCleanTextForEditor = (text) => {
    if (!text) return "";
    return text.replace(/<\/?(?:meta|status)[^>]*>/gi, '');
  };

  const effectiveDesc = spellData?.effect || "無詳細資料。";
  const currentDesc = selections?.customDesc !== undefined ? selections.customDesc : effectiveDesc;

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
    <div className={`relative flex flex-col p-4 rounded border-2 transition-all duration-200 text-left overflow-hidden group ${isClaimedElsewhere ? 'bg-[#f4ebd9]/50 border-[#d6c7ab] opacity-60 cursor-not-allowed' : isOverBudget && isActive ? 'bg-[#f9f5eb] border-[#8c2d36] opacity-90 shadow-md transform z-10' : isActive ? 'bg-[#fffdf9] border-[#3c2415] shadow-md transform z-10' : isDisabled ? 'bg-[#f4ebd9]/50 border-[#d6c7ab] opacity-60 grayscale cursor-not-allowed' : 'bg-[#fffdf9] border-[#d6c7ab] hover:border-[#3c2415] hover:bg-[#fbf7ee] cursor-pointer'}`} onClick={(e) => { if (isClickableTag(e.target.tagName.toLowerCase())) return; if (isClaimedElsewhere) return; if (!isDisabled || isActive) onToggle(); }}>
      {isClaimedElsewhere ? <div className="absolute top-3 right-3 text-t10 bg-[#f4ebd9] text-[#6b5a4b] px-2 py-0.5 rounded border border-[#d6c7ab] font-bold flex items-center gap-1"><Lock size={10} /> 已學習</div> : <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-10">
        {!isActive && <div className="w-5 h-5 rounded-full border-2 border-[#d6c7ab] group-hover:border-[#3c2415]"></div>}
        {isActive && (
          <div className="flex flex-col items-end gap-2">
            {!isOverBudget && <CheckCircle2 className="drop-shadow-sm text-[#3c2415]" size={24} />}
            {!isMaxMp && (
              !isEditing ? (
                <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1.5 bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415] rounded transition-colors group/edit hide-on-export" title="編輯咒語文字"><Edit3 size={16} className="" /></button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} className="p-1.5 text-[#e8dcc4] bg-[#3c2415] hover:bg-[#2c221e] rounded transition-colors hide-on-export" title="完成編輯"><Save size={16} /></button>
              )
            )}
          </div>
        )}
      </div>}
      <div className={`font-bold text-t16 mb-2 pr-6 flex flex-col sm:flex-row sm:items-center gap-1 ${isOverBudget && isActive ? 'text-[#8c2d36]' : isActive ? 'text-[#3c2415]' : 'text-[#6b5a4b]'}`}>
        <div className="flex items-center gap-1 w-full">
          {isMaxMp ? '●' : <span className="fu-icon text-xl text-[#3c2415] drop-shadow-sm shrink-0">{CATEGORIES.find(c => c.id === 'spell')?.fuIcon || 'c'}</span>}
          {isEditing ? (
            <div className="flex-1 relative group/input">
              <input type="text" className={`bg-transparent border border-transparent rounded px-1 -mx-1 outline-none w-full transition-colors hover:border-[#d6c7ab] hover:bg-[#fbf7ee] focus:border-[#3c2415] focus:bg-[#fffdf9] ${isOverBudget ? 'text-[#8c2d36]' : selections?.customName !== undefined ? 'text-[#3c2415] font-bold' : 'text-[#3c2415]'}`} value={selections?.customName !== undefined ? selections.customName : cleanSpellName} onChange={(e) => onSelectionChange(skillId, spellName, 'customName', e.target.value)} onBlur={(e) => { if (!e.target.value.trim()) onSelectionChange(skillId, spellName, 'customName', undefined); }} onClick={(e) => e.stopPropagation()} />
              <div className="absolute -bottom-4 left-0 text-t10 text-[#6b5a4b] font-bold opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none">正在編輯自定義名稱</div>
            </div>
          ) : (
            <span className={`flex items-center gap-1 ${selections?.customName !== undefined ? 'text-[#3c2415] font-bold' : ''}`}>
              {isOffensive && <span className="fu-icon text-lg text-[#8c2d36] drop-shadow-sm shrink-0" title="攻擊性咒語">{TYPE_STYLES['攻擊性咒語']?.fuIcon || 'o'}</span>}
              <span>{renderFormattedText(normalizeSpellName(selections?.customName !== undefined ? selections.customName : cleanSpellName), selections, npcLevel, partyLevel)}</span>
            </span>
          )}
          {isOverBudget && isActive && <span className="text-t10 bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36] px-2 py-0.5 rounded flex items-center gap-1 shrink-0 w-fit ml-2"><AlertCircle size={10} /> 失效</span>}
        </div>
      </div>
      {isMaxMp ? <div className={`text-sm font-bold mt-1 ${isOverBudget && isActive ? 'text-[#8c2d36]' : 'text-[#3c2415]'}`}>增加 10 點最大 MP</div> : <>
        <div className={`flex flex-wrap gap-2 text-t11 font-bold mb-2 bg-[#fffdf9] p-1.5 rounded w-fit border ${isOverBudget && isActive ? 'text-[#8c2d36] border-[#8c2d36]/50' : 'text-[#6b5a4b] border-[#d6c7ab]'}`}><span>MP: <span className={isOverBudget && isActive ? 'text-[#8c2d36]' : 'text-[#3c2415] font-bold'}>{spellData?.mp || '?'}</span></span><span className="text-[#d6c7ab]">|</span><span>目標: <span className={isOverBudget && isActive ? 'text-[#8c2d36]' : 'text-[#2c221e]'}>{spellData ? renderFormattedText(spellData.target, selections, npcLevel, partyLevel) : '?'}</span></span><span className="text-[#d6c7ab]">|</span><span>持續: <span className={isOverBudget && isActive ? 'text-[#8c2d36]' : 'text-[#2c221e]'}>{spellData?.duration || '?'}</span></span></div>
        {isEditing ? (
          <textarea ref={textareaRef} className={`text-sm leading-relaxed w-full bg-transparent border border-transparent rounded px-1 -mx-1 outline-none resize-none overflow-hidden transition-colors hover:border-[#d6c7ab] hover:bg-[#fbf7ee] focus:border-[#3c2415] focus:bg-[#fffdf9] min-h-[3rem] ${isOverBudget ? 'text-[#8c2d36]' : selections?.customDesc !== undefined ? 'text-[#3c2415] font-medium' : 'text-[#6b5a4b]'}`} value={resolveTemplateVariablesForDisplay(getCleanTextForEditor(selections?.customDesc !== undefined ? selections.customDesc : effectiveDesc), selections, { damageEmojis: true })} placeholder={resolveTemplateVariablesForDisplay(getCleanTextForEditor(effectiveDesc), selections, { damageEmojis: true })} onChange={(e) => { onSelectionChange(skillId, spellName, 'customDesc', e.target.value); adjustHeight(); }} onBlur={(e) => { if (!e.target.value.trim()) { onSelectionChange(skillId, spellName, 'customDesc', undefined); setTimeout(adjustHeight, 0); } }} onClick={(e) => e.stopPropagation()} />
        ) : (
          <div className={`text-xs leading-relaxed ${isOverBudget && isActive ? 'text-[#8c2d36]' : selections?.customDesc !== undefined ? 'text-[#3c2415] font-medium' : 'text-[#6b5a4b]'}`}>{renderFormattedText(currentDesc, selections, npcLevel, partyLevel)}{isSecretArt && isActive && !isOverBudget && <div className="text-[#6b5a4b] mt-1 text-t11 font-bold">*(此咒語為祕技，除了目標之外沒有人會意識到那是什麼。)*</div>}</div>
        )}
      </>}
      {isActive && selectionsConfig && <div className={`mt-4 pt-3 border-t flex flex-col gap-2 animate-fade-in${isOverBudget ? 'border-[#8c2d36]/50' : 'border-[#d6c7ab]'}`}>
        {selectionsConfig.filter(cfg => !cfg.showIfKey || (selections?.[cfg.showIfKey] || "").includes(cfg.showIfValue)).map(cfg => (
          <label key={cfg.key} className={`flex justify-between items-center text-xs font-bold bg-[#fffdf9] p-2 rounded border ${isOverBudget ? 'text-[#8c2d36] border-[#8c2d36]/50' : 'text-[#3c2415] border-[#d6c7ab]'}`}>{cfg.label}
            <select className={`bg-[#fbf7ee] text-[#2c221e] border p-1 rounded outline-none w-32 transition-colors ${isOverBudget ? 'border-[#8c2d36] focus:border-[#8c2d36]' : 'border-[#d6c7ab] focus:border-[#3c2415]'}`} value={selections?.[cfg.key] || ''} onChange={(e) => onSelectionChange(skillId, spellName, cfg.key, e.target.value)} onClick={e => e.stopPropagation()} >
              <option value="">選擇...</option>{cfg.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
        ))}
      </div>
      }
    </div>
  );
};

export default SpellCard;
