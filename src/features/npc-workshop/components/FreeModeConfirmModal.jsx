/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */
import React from 'react';
import { Unlock, AlertTriangle, Check } from 'lucide-react';

export default function FreeModeConfirmModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#fffdf9] border-2 border-fuchsia-600 rounded-2xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-200 text-[#2c221e]">

        <div className="flex items-center gap-3 text-fuchsia-900 font-black text-lg mb-4">
          <div className="p-2.5 bg-fuchsia-100 rounded-xl border border-fuchsia-300 shadow-inner">
            <Unlock size={24} className="animate-bounce text-fuchsia-800" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black tracking-widest text-fuchsia-900">開啟自定義模式</h3>
            <p className="text-[11px] text-fuchsia-700 font-bold uppercase tracking-wider">Free Edit Mode</p>
          </div>
        </div>

        <div className="text-xs md:text-sm text-[#3c2f21] space-y-3 leading-relaxed mb-6">
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-amber-900 text-xs flex items-start gap-2.5 shadow-sm">
            <AlertTriangle size={18} className="shrink-0 text-amber-700 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900">警示：</span>
              <span>開啟自定義模式將解除官方平衡規則限制。</span>
            </div>
          </div>

          <p className="text-[#3c2f21]">
            解鎖後，您將獲得以下權限：
          </p>

          <ul className="list-disc list-inside text-xs text-[#574c43] space-y-1.5 pl-1 bg-[#f4ebd9] p-3 rounded-xl border border-[#d6c7ab]">
            <li>自由調整 NPC 的 <strong className="text-fuchsia-900">體質骰子大小</strong>。</li>
            <li><strong className="text-amber-800">HP, MP, 物防, 魔防</strong> 將依據 Fabula Ultima 體質公式自動連動重算。</li>
            <li>無視等級、職能與技能額度上限限制，自由組合技能與能力。</li>
          </ul>

          <p className="text-[11px] text-[#8c7b6c] italic">
            此模式適合設計獨特遭遇、強大 Boss 或測試家規。您可隨時點擊右上角按鈕恢復嚴謹模式。
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#d6c7ab]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-bold text-xs md:text-sm bg-[#eee6d3] hover:bg-[#e4d9c0] text-[#3c2f21] border border-[#d6c7ab] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-lg font-bold text-xs md:text-sm bg-fuchsia-700 hover:bg-fuchsia-600 text-white shadow-md transition-all hover:scale-105 flex items-center gap-1.5"
          >
            <Check size={16} /> 確認開啟自定義
          </button>
        </div>
      </div>
    </div>
  );
}
