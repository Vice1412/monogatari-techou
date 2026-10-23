/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */
import React, { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; textArea.style.left = "-999999px"; textArea.style.top = "-999999px";
    document.body.appendChild(textArea); textArea.focus(); textArea.select();
    try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (err) { console.error('複製失敗:', err); }
    finally { document.body.removeChild(textArea); }
  };
  return (
    <button onClick={handleCopy} className="ml-auto text-[#6b5a4b] hover:text-[#2c221e] transition-colors flex items-center gap-1 bg-[#f4ebd9] px-2 py-0.5 rounded border border-[#d6c7ab] hover:border-[#3c2415] hide-on-export" title="複製為 Markdown">
      {copied ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
      {copied ? <span className="text-[10px] text-green-700">已複製</span> : <span className="text-[10px]">複製文本</span>}
    </button>
  );
};

export default CopyButton;
