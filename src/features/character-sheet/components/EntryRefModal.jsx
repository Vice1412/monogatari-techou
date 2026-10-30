/**
 * 條目查閱視窗（Entry Reference Modal）
 *
 * ## 用途
 *
 * 規則書正文常常寫「當你使用【暗影突襲】技能時…」，但玩家當下手上沒有另一頁。
 * 這個視窗讓任何被引用的條目名稱**點一下就展開全文**——不必離開當前畫面、
 * 不必回頭翻書、也不必記住上一個條目在哪。
 *
 * ## 三個設計決定
 *
 * 1. **可連續跳轉**：視窗裡的文字同樣可點（引用是遞迴的：進階蛻皮 → 蛻皮 →
 *    混合變形…），所以內部維護一個堆疊，左上角「返回」回到上一個條目。
 * 2. **只顯示原文，不摘要**：這是工具書。內容一律取自資料層的原始欄位
 *    （`effect` / `desc`），這個元件不生成任何句子。
 * 3. **事件驅動**：與 `RuleCodexDrawer` 同一套模式（`fu:open-entry-ref`），
 *    這樣任何深度的子元件都能開啟它，不必把 state 一層層往下傳。
 *
 * ## 樣式全部走設計系統（`npm run test:uiSystem` 是硬零關卡）
 *
 * - 字級只用階梯令牌（`text-t10`／`t11`／`t12`／`t14`／`t16`），不用 `text-[13px]`。
 * - 顏色只用登記色票；六種條目類型用**已登記的六個身份色**，不新增色值。
 * - 圓角只有 `rounded`，陰影只有 `shadow-e3`（v5 的層級靠冷暖，不靠陰影）。
 */

import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, ArrowLeft, BookOpen } from 'lucide-react';
import { lookupEntry } from '../data/crossRefs';
import SkillDescription from '../utils/skillFormulaEvaluator';
import { splitParagraphs } from '../utils/paragraphs';

/**
 * 六種條目的識別色——全部取自 `identityPalette` 的登記色。
 * 用途只有一個：讓玩家在「這是技能還是金手指」之間掃一眼就分得出來，
 * 所以是**身份**（離散的六類），不是量，可以用色相。
 */
const KIND_TONE = {
  heroic: '#8c2d36', // 英雄技能：紅
  quirk: '#5e387c', // 金手指：紫
  spell: '#27527a', // 咒語：藍
  class: '#245c45', // 職業技能：綠
  zero: '#9c4d16', // 底力技：赭
  camp: '#404a58', // 營地活動：灰藍
};

export default function EntryRefModal() {
  const [stack, setStack] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleOpen = (e) => {
      const { name } = e.detail || {};
      if (!name || !lookupEntry(name)) return;
      setStack((prev) => (prev[prev.length - 1] === name ? prev : [...prev, name]));
    };
    window.addEventListener('fu:open-entry-ref', handleOpen);
    return () => window.removeEventListener('fu:open-entry-ref', handleOpen);
  }, []);

  const close = useCallback(() => setStack([]), []);

  const isOpen = stack.length > 0;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : []));
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const name = stack[stack.length - 1];
  const entry = lookupEntry(name);
  if (!entry) return null;

  const tone = KIND_TONE[entry.kind] || KIND_TONE.class;

  const content = (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      data-testid="entry-ref-modal"
    >
      {/* 遮罩：點一下就關 */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-2xl bg-[#fffdf9] border-2 border-[#d6c7ab] rounded shadow-e3 overflow-hidden my-auto flex flex-col max-h-[86vh] text-[#2c221e] animate-modal-pop z-10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.kindLabel}：${entry.name}`}
      >
        {/* 標題列 */}
        <div className="flex items-start gap-2 px-4 py-3 border-b border-[#e8dcc4] bg-[#f4ebd9] shrink-0">
          {stack.length > 1 && (
            <button
              type="button"
              onClick={() => setStack((prev) => prev.slice(0, -1))}
              className="mt-1 p-1 rounded hover:bg-[#e8dcc4] transition-colors"
              title="返回上一個條目"
              aria-label="返回上一個條目"
            >
              <ArrowLeft className="w-4 h-4 text-[#6b5a4b]" />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-t10 font-bold px-1.5 py-0.5 rounded border shrink-0 bg-[#fffdf9]"
                style={{ color: tone, borderColor: tone }}
              >
                {entry.kindLabel}
              </span>
              <h3 className="font-serif font-black text-t16 leading-snug text-[#2c221e]">
                {entry.name}
              </h3>
            </div>

            {entry.meta.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {entry.meta.map(([label, value]) => (
                  <span key={label} className="text-t11 text-[#6b5a4b]">
                    <span className="font-bold">{label}</span>
                    <span className="mx-1 text-[#a63d40]">·</span>
                    {value}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={close}
            className="p-1 rounded hover:bg-[#e8dcc4] transition-colors shrink-0"
            title="關閉（Esc）"
            aria-label="關閉"
          >
            <X className="w-4 h-4 text-[#6b5a4b]" />
          </button>
        </div>

        {/* 內文：一律是資料層原文，這個元件不生成句子 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {entry.flavor && (
            <p className="text-t12 italic leading-relaxed p-2.5 rounded border border-[#e8dcc4] bg-[#f9f5eb] text-[#6b5a4b] mb-3">
              <SkillDescription desc={entry.flavor} linkCodex={false} refSource={entry.name} />
            </p>
          )}

          <div className="text-t14 leading-relaxed space-y-2.5 text-[#2c221e]">
            {splitParagraphs(entry.body).map((block, bi) => (
              <div key={bi} className="space-y-1">
                {block.map((line, li) => (
                  <p key={li}>
                    <SkillDescription desc={line} sl={1} linkCodex={false} refSource={entry.name} />
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-[#e8dcc4] bg-[#f9f5eb] text-t10 text-[#7c6a58] flex items-center gap-1.5 shrink-0">
          <BookOpen className="w-3 h-3 shrink-0" />
          <span>內容取自資料層原文；視窗內以虛線標示的名稱可以繼續點開</span>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
