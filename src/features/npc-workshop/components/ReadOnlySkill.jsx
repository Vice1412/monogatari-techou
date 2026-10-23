/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */
import React from 'react';
import { DAMAGE_TYPES, TYPE_STYLES, BOSS_SKILLS_DATA, isOffensiveSpell, normalizeSpellName } from '../data';
import { getPlainText, renderFormattedText } from '../utils/displayText';
import { resolveAttack } from '../utils/attackDisplay';
import CopyButton from './CopyButton';

const ReadOnlySkill = ({ skill, finalStats, npcName, npcLevel, partyLevel, onInspectorClick }) => {
  let nameState = { used: false };
  const replaceNPC = (text) => {
    if (typeof text !== 'string' || !npcName) return text;
    return text.replace(/此\s?NPC\s?/g, () => {
      if (!nameState.used) { nameState.used = true; return `__NPC_NAME__${npcName}__NPC_END__`; }
      return "它";
    });
  };

  // 距離／公式／屬性一律先過 utils/attackDisplay.js 的解析：宣告了同名選單就以選單為準，
  // 這樣「顯示」「複製文字」與「卡片選單」才會是同一份值。
  const atk = skill.attack ? resolveAttack(skill.attack, skill.selections, skill.selectionsConfig) : null;
  const replacedDist = replaceNPC(atk?.distance); const replacedForm = replaceNPC(atk?.formula); const replacedType = replaceNPC(atk?.type);
  let effectiveOrigDesc = skill.originalDesc || "";
  if (skill.selectionsConfig) {
    const libSkill = BOSS_SKILLS_DATA.find(bs => bs.id === skill.libId);
    const cfgSource = libSkill?.selectionsConfig || skill.selectionsConfig;
    cfgSource?.forEach(cfg => {
      if (cfg.type === 'checkbox' && cfg.enhancedDesc && skill.selections?.[cfg.key]) effectiveOrigDesc = cfg.enhancedDesc;
    });
  }

  const hasCustomDesc = skill.customDesc !== undefined && skill.customDesc.trim() !== '';
  let displayDesc = effectiveOrigDesc;
  let displayExtra = skill.attack?.extra;

  if (skill.category === 'attack' && !effectiveOrigDesc) {
    if (hasCustomDesc) {
      displayDesc = "";
      displayExtra = skill.customDesc;
    }
  } else if (hasCustomDesc) {
    displayDesc = skill.customDesc;
  }

  const replacedDesc = replaceNPC(displayDesc);
  const replacedExtra = replaceNPC(displayExtra);

  let textToCopy = "";
  let displaySkillName = skill.customName?.trim() ? skill.customName : skill.originalName;
  displaySkillName = displaySkillName.replace(/Lv\.\d+\s解鎖天賦：/, '').replace(/^(技能|能力)：/, '').replace(/（(獨特動作|特殊規則)）/, '').replace(/\(定位技能\)/, '').trim();

  
  const isSpellCategory = skill.category === 'spell' || skill.spellData;
  const showOffensiveIcon = isSpellCategory && (skill.spellData?.isOffensive || isOffensiveSpell(displaySkillName));
  const totalMagicAcc = (finalStats.Acc || 0) + (finalStats.MagicAccModifier || 0);

  if (isSpellCategory) {
    const spMp = skill.spellData?.mp || '10';
    const spTarget = getPlainText(replaceNPC(skill.spellData?.target || '一個生物'), skill.selections, npcLevel, partyLevel, true);
    const spDuration = skill.spellData?.duration || '瞬發';
    textToCopy += `> ${normalizeSpellName(displaySkillName)} (MP: ${spMp} | 目標: ${spTarget} | 持續: ${spDuration})\n`;
    if (showOffensiveIcon) {
      const accStr = totalMagicAcc > 0 ? ` +${totalMagicAcc}` : (totalMagicAcc < 0 ? ` - ${Math.abs(totalMagicAcc)}` : '');
      const formulaDisplay = finalStats.magicFormula || '[INS + WLP]';
      textToCopy += `> ${formulaDisplay}${accStr} ✦ 魔法攻擊\n`;
    }
    if (replacedDesc) textToCopy += `> ${getPlainText(replacedDesc, skill.selections, npcLevel, partyLevel, true).split('\n').join('\n> ')}\n`;
  } else {
    textToCopy += `> ${displaySkillName}\n`;
    if (skill.attack) {
      const dist = getPlainText(replacedDist, skill.selections, npcLevel, partyLevel, true); const form = getPlainText(replacedForm, skill.selections, npcLevel, partyLevel, true); const accStr = finalStats.Acc > 0 ? ` +${finalStats.Acc}` : (finalStats.Acc < 0 ? ` - ${Math.abs(finalStats.Acc)}` : ''); const dmg = skill.attack.baseDmg + finalStats.Dmg; const type = getPlainText(replacedType, skill.selections, npcLevel, partyLevel, true);
      textToCopy += `> [${dist}] ${form}${accStr} ✦ [HR + ${dmg}] ${type}傷害\n`;
      if (replacedExtra) textToCopy += `> ${getPlainText(replacedExtra, skill.selections, npcLevel, partyLevel, true).split('\n').join('\n> ')}\n`;
    }
    if (replacedDesc) textToCopy += `> ${getPlainText(replacedDesc, skill.selections, npcLevel, partyLevel, true).split('\n').join('\n> ')}\n`;
    if (skill.isSecretArt) {
      const label = skill.attack ? '攻擊' : isSpellCategory ? '咒語' : '技能';
      textToCopy += `> *(此${label}為祕技，除了目標之外沒有人會意識到那是什麼。)*\n`;
    }
  }
  textToCopy = textToCopy.trim();

  if (npcName) {
    let mdUsed = false;
    textToCopy = textToCopy.replace(/此\s?NPC\s?/g, () => { if (!mdUsed) { mdUsed = true; return `**${npcName}**`; } return "它"; });
  }

  const handleCardClick = (e) => {
    if (e.target.closest('button')) return;
    if (onInspectorClick && (skill.id || skill.libId)) {
      onInspectorClick(skill.id || skill.libId, skill.source === 'bossSkill' ? 'boss' : skill.category === 'spell' ? 'spells' : 'skills');
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`mb-4 break-inside-avoid p-2.5 rounded-lg border transition-all ${onInspectorClick ? 'cursor-pointer hover:border-[#3c2415] hover:shadow-md hover:ring-1 hover:ring-[#3c2415]/40 group/inspector' : ''} ${skill.isSecretArt ? 'border-[#3c2415]/40 bg-[#fffdf9]' : skill.category === 'boss' ? 'border-[#d6c7ab] bg-[#f9f5eb]' : 'border-[#d6c7ab] bg-[#fbf7ee]/40'}`}
      title={onInspectorClick ? "點擊反向定位至編輯表單" : ""}
    >
      <div className={`font-bold text-[15px] mb-1 flex flex-wrap items-center gap-2 ${skill.isSecretArt || skill.category === 'boss' ? 'text-[#3c2415]' : 'text-[#2c221e]'}`}>
        <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${skill.isSecretArt || isSpellCategory ? 'bg-[#3c2415]' : 'bg-[#7c6a58]'}`}></span>{showOffensiveIcon && <span className="fu-icon text-xl text-[#8c2d36] drop-shadow-sm mr-1 shrink-0" title="攻擊性咒語">{TYPE_STYLES['攻擊性咒語']?.fuIcon || 'o'}</span>}{normalizeSpellName(displaySkillName)}{skill.isSecretArt && (
          <span className="text-[10px] text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab] px-1 rounded font-normal">※ 祕技</span>
        )}
        <CopyButton text={textToCopy} />
      </div>

      {isSpellCategory && (
        <div className="flex flex-wrap items-center gap-2 text-[#6b5a4b] text-xs font-bold tracking-wider bg-[#fffdf9] px-2 py-1 my-1 ml-2 md:ml-4 rounded border border-[#d6c7ab] w-fit">
          <span>MP: <span className="text-blue-700 font-bold">{skill.spellData?.mp || '10'}</span></span>
          <span className="text-[#d6c7ab] hidden sm:inline">|</span>
          <span>目標: <span className="text-[#2c221e]">{renderFormattedText(replaceNPC(skill.spellData?.target || '一個生物'), skill.selections, npcLevel, partyLevel, true)}</span></span>
          <span className="text-[#d6c7ab] hidden sm:inline">|</span>
          <span>持續: <span className="text-[#2c221e]">{skill.spellData?.duration || '瞬發'}</span></span>
        </div>
      )}

      {showOffensiveIcon && (
        <div className="text-[#8c2d36] text-[13px] font-bold mb-1.5 ml-2 md:ml-4 flex items-center gap-1.5">
          <span className="text-[#2c221e] tracking-widest">{finalStats.magicFormula || '[INS + WLP]'}</span> {totalMagicAcc !== 0 && <span className="text-[#3c2415]">{totalMagicAcc > 0 ? `+ ${totalMagicAcc}` : `- ${Math.abs(totalMagicAcc)}`}</span>} ✦ 魔法攻擊
        </div>
      )}

      {skill.attack && (() => {
        // 與 EditableSkill 共用同一套解析：宣告了同名選單就以選單為準（utils/attackDisplay.js）。
        const resolvedType = atk.type;
        const typeInfo = TYPE_STYLES[resolvedType];
        const isRanged = String(atk.distance).includes('遠程');

        return (
          <div className={`bg-[#fffdf9] border-l-4 p-2.5 my-1 text-sm ml-2 md:ml-4 rounded-r border border-[#d6c7ab] ${skill.isSecretArt ? 'border-l-[#3c2415]' : skill.category === 'boss' ? 'border-l-[#3c2415]' : 'border-l-[#8c2d36]'}`}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-flex items-center gap-1 text-[#3c2f21] bg-[#e8dec8] px-2 py-0.5 rounded text-xs font-bold shrink-0 shadow-2xs">
                <span className="fu-icon text-sm leading-none translate-y-[0.5px]">{isRanged ? 'r' : 'm'}</span>
                <span>{renderFormattedText(atk.distance, skill.selections, npcLevel, partyLevel, true)}</span>
              </span>
              <span className="text-blue-900 font-bold inline-flex items-center gap-1">
                <span>{renderFormattedText(atk.formula, skill.selections, npcLevel, partyLevel, true)}</span>
                {finalStats.Acc !== 0 && (
                  <span className="text-[#6b5a4b] font-bold">
                    {finalStats.Acc > 0 ? `+ ${finalStats.Acc}` : `- ${Math.abs(finalStats.Acc)}`}
                  </span>
                )}
              </span>
              <span className="text-[#7c6a58] text-xs select-none">✦</span>
              <span className="inline-flex items-center gap-1 font-bold text-[#8c2d36]">
                <span>[HR + <span className="font-extrabold">{skill.attack.baseDmg + finalStats.Dmg}</span>]</span>
                {DAMAGE_TYPES.includes(resolvedType) ? (
                  <span className={`inline-flex items-center gap-0.5 ${typeInfo?.color || 'text-[#8c2d36]'}`}>
                    {typeInfo?.fuIcon && (
                      <span className="fu-icon text-sm leading-none translate-y-[0.5px]">{typeInfo.fuIcon}</span>
                    )}
                    <span>{resolvedType}</span>
                  </span>
                ) : (
                  renderFormattedText(replacedType, skill.selections, npcLevel, partyLevel, true)
                )}
                <span>傷害</span>
              </span>
            </div>
            {replacedExtra && <div className="text-[#3c2415] mt-1.5 pt-1.5 border-t border-[#d6c7ab] leading-relaxed text-xs whitespace-pre-wrap">{renderFormattedText(replacedExtra, skill.selections, npcLevel, partyLevel, true)}</div>}
          </div>
        );
      })()}
      {(!skill.attack || replacedDesc) && <div className="text-sm text-[#3c2415] leading-relaxed whitespace-pre-wrap ml-2 md:ml-4">{renderFormattedText(replacedDesc, skill.selections, npcLevel, partyLevel, true)}</div>}
      {skill.isSecretArt && (
        <div className="text-[#6b5a4b] mt-1.5 ml-2 md:ml-4 text-xs font-bold">
          *(此{skill.attack ? '攻擊' : isSpellCategory ? '咒語' : '技能'}為祕技，除了目標之外沒有人會意識到那是什麼。)*
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---

export default ReadOnlySkill;
