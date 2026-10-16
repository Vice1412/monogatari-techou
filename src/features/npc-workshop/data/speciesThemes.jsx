/**
 * 物種的顯示用中繼資料（圖示／配色／標籤）。
 *
 * 為什麼獨立成檔（2026-10-16 拆檔第二批）：
 * 它同時被主元件與 `utils/npcTextExport.js` 使用。若留在 `NPCWorkshop.jsx`，
 * 兩邊就會形成**循環匯入**（主檔 → 匯出工具 → 主檔）。
 *
 * ※ 這裡是「純資料 ＋ 圖示」，不含任何狀態。
 */
import React from 'react';
import { GiPawPrint, GiGearHammer, GiDevilMask, GiSparkSpirit, GiHumanPyramid, GiTentacleStrike, GiFern, GiGhost } from 'react-icons/gi';

export const SPECIES_THEMES = {
  sp_beast: { color: 'amber', icon: <GiPawPrint size={24} />, label: 'BEAST', bg: 'bg-amber-50/80', border: 'border-amber-400/60', text: 'text-amber-900 font-bold' },
  sp_construct: { color: 'stone', icon: <GiGearHammer size={24} />, label: 'CONSTRUCT', bg: 'bg-stone-100/80', border: 'border-stone-400/60', text: 'text-stone-800 font-bold' },
  sp_demon: { color: 'red', icon: <GiDevilMask size={24} />, label: 'DEMON', bg: 'bg-red-50/80', border: 'border-red-400/60', text: 'text-red-900 font-bold' },
  sp_element: { color: 'cyan', icon: <GiSparkSpirit size={24} />, label: 'ELEMENTAL', bg: 'bg-cyan-50/80', border: 'border-cyan-400/60', text: 'text-cyan-900 font-bold' },
  sp_humanoid: { color: 'blue', icon: <GiHumanPyramid size={24} />, label: 'HUMANOID', bg: 'bg-blue-50/80', border: 'border-blue-400/60', text: 'text-blue-900 font-bold' },
  sp_monster: { color: 'purple', icon: <GiTentacleStrike size={24} />, label: 'MONSTER', bg: 'bg-purple-50/80', border: 'border-purple-400/60', text: 'text-purple-900 font-bold' },
  sp_plant: { color: 'emerald', icon: <GiFern size={24} />, label: 'PLANT', bg: 'bg-emerald-50/80', border: 'border-emerald-400/60', text: 'text-emerald-900 font-bold' },
  sp_undead: { color: 'indigo', icon: <GiGhost size={24} />, label: 'UNDEAD', bg: 'bg-indigo-50/80', border: 'border-indigo-400/60', text: 'text-indigo-900 font-bold' },
};
