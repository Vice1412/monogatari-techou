/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */
import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { GiSparkles } from 'react-icons/gi';
import WarningNote from '../../../components/ui/WarningNote';

const SectionAccordion = ({ title, icon, current, max, hideIfZeroMax = false, defaultExpanded = false, alwaysComplete = false, forceOverflow = false, children, titleColor = "text-[#2c221e]", borderColor = "border-[#d6c7ab]", isExpanded: propExpanded, onToggle, stickyTop = "top-0", isFreeMode = false }) => {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const isExpanded = propExpanded !== undefined ? propExpanded : localExpanded;

  const handleToggle = () => {
    if (onToggle) onToggle(!isExpanded);
    else setLocalExpanded(!isExpanded);
  };

  if (hideIfZeroMax && max === 0 && !forceOverflow && !isFreeMode) return null;
  const isOverflow = isFreeMode ? false : (forceOverflow || (max > 0 && current > max)); const isComplete = alwaysComplete || (current >= max) || isFreeMode;
  let statusBadge = null;
  if (isFreeMode) {
    statusBadge = <span className="flex items-center gap-1 text-[10px] text-[#6b5a4b] bg-[#f4ebd9] border border-[#d6c7ab] px-2 py-0.5 rounded-full ml-1 md:ml-2 font-bold"><GiSparkles size={12} /> <span className="hidden md:inline">解鎖限制</span> ({current}/∞)</span>;
  } else if (!alwaysComplete) {
    if (isOverflow) statusBadge = <span className="flex items-center gap-1 text-[10px] text-[#8c2d36] bg-[#f4ebd9] border border-[#8c2d36]/50 px-2 py-0.5 rounded-full ml-1 md:ml-2 font-bold"><AlertCircle size={12} /> <span className="hidden md:inline">超額失效</span> ({current}/{max})</span>;
    else if (isComplete) statusBadge = <span className="flex items-center gap-1 text-[10px] text-[#3c2415] bg-[#f4ebd9] border border-[#d6c7ab] px-2 py-0.5 rounded-full ml-1 md:ml-2 font-bold"><CheckCircle2 size={12} /> <span className="hidden md:inline">已完成</span> ({current}/{max})</span>;
    else statusBadge = <span className="flex items-center gap-1 text-[10px] text-[#3c2415] bg-[#f4ebd9] border border-[#d6c7ab] px-2 py-0.5 rounded-full ml-1 md:ml-2 font-bold"><AlertCircle size={12} /> <span className="hidden md:inline">待配置</span> ({current}/{max})</span>;
  } else statusBadge = <span className="flex items-center gap-1 text-[10px] text-[#574c43] bg-[#e8dec8] border border-[#d6c7ab] px-2 py-0.5 rounded-full ml-1 md:ml-2 font-bold"><GiSparkles size={12} /> {current > 0 ? `已加入 ${current} 項` : '選用區塊'}</span>;

  return (
    <div className={`bg-[#fffdf9] border ${isOverflow ? 'border-[#8c2d36]' : 'border-[#d6c7ab]'} rounded-lg mb-4 transition-all duration-300 relative ${!isComplete && !alwaysComplete && !isOverflow ? 'ring-1 ring-[#3c2415]/40 shadow-md' : isOverflow ? 'ring-1 ring-[#8c2d36]/50 shadow-md' : ''}`}>
      <button className={`w-full flex justify-between items-center p-4 hover:bg-[#f4ebd9] transition-colors outline-none sticky ${stickyTop} z-20 bg-[#fffdf9]/95 backdrop-blur ${isExpanded ? 'border-b border-[#d6c7ab] rounded-t-lg' : 'rounded-lg'}`} onClick={handleToggle}>
        <div className="flex items-center gap-3"><span className={isOverflow ? 'text-[#8c2d36]' : titleColor}>{icon}</span><h2 className={`text-sm font-bold ${isOverflow ? 'text-[#8c2d36]' : titleColor} text-left`}>{title}</h2>{statusBadge}</div>
        <div className="flex items-center gap-2">{!isExpanded && !isComplete && !alwaysComplete && <span className="text-[10px] text-[#6b5a4b] font-bold hidden md:block">點擊展開</span>}{isExpanded ? <ChevronUp size={18} className="text-[#6b5a4b]" /> : <ChevronDown size={18} className="text-[#6b5a4b]" />}</div>
      </button>
      {isExpanded && (
        <div className="p-4 bg-[#fbf7ee]/60 animate-in slide-in-from-top-2 rounded-b-lg">
          {isOverflow && <WarningNote tone="danger" title="額度溢出警告" className="mb-4">您目前的選擇已超過系統允許的上限或缺少前置技能。所有標記為紅色的技能將<strong>強制失效</strong>。</WarningNote>}
          {children}
        </div>
      )}
    </div>
  );
};

export default SectionAccordion;
