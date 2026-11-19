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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm duration-200 animate-fade-in">
      <div className="bg-[#fffdf9] border-2 border-[#a63d40] rounded max-w-md w-full p-6 shadow-xl relative overflow-hidden duration-200 text-[#2c221e] animate-modal-pop">

        <div className="flex items-center gap-3 font-black text-lg mb-4">
          <div className="p-2.5 bg-[#f4ebd9] rounded border border-[#d6c7ab]">
            <Unlock size={24} className="text-[#a63d40]" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black tracking-widest text-[#3c2415]">切換至自由模式</h3>
            <p className="text-t12 text-[#6b5a4b] font-bold tracking-wider">解除 Quick Assembly 規則限制，保留原書數值對照</p>
          </div>
        </div>

        <div className="text-xs md:text-sm text-[#3c2415] space-y-3 leading-relaxed mb-6">
          <div className="bg-[#f9f5eb] border border-[#d6c7ab] p-3 rounded text-[#3c2415] text-xs flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-[#6b5a4b] mt-0.5" />
            <div>
              <span className="font-bold text-[#3c2415]">說明：</span>
              <span>開啟自由模式後，系統將解除以下限制，並在每個調整區旁顯示「原書算法」與「平衡尺度建議」，協助您掌控遭遇難度：</span>
            </div>
          </div>

          <ul className="list-disc list-inside text-xs text-[#6b5a4b] space-y-1.5 pl-1 bg-[#f4ebd9] p-3 rounded border border-[#d6c7ab]">
            <li><strong className="text-[#3c2415]">四維體質骰子</strong>：可自由調整 DEX／INS／MIG／WLP（d6–d12），HP、MP、物防、魔防與先攻自動連動。</li>
            <li><strong className="text-[#3c2415]">手動覆寫面板數值</strong>：可直接覆寫 HP、MP、先攻、物防、魔防（支援設為 0）。</li>
            <li><strong className="text-[#3c2415]">屬性相性與物種規則</strong>：解除額度上限、允許修改物種固有相性與加選物種增益。</li>
            <li><strong className="text-[#3c2415]">技能與咒語配置</strong>：解除等級、階級、前置與額度上限限制。</li>
          </ul>

          <p className="text-t12 text-[#7c6a58]">
            ※ 您可隨時切回「嚴謹模式」，未符合原書限制的設定會暫時停用但資料不會遺失。
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#d6c7ab]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded font-bold text-xs md:text-sm bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded font-bold text-xs md:text-sm bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] transition-colors flex items-center gap-1.5"
          >
            <Check size={16} /> 確認開啟自由模式
          </button>
        </div>
      </div>
    </div>
  );
}
