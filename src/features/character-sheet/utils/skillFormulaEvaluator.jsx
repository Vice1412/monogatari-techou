import { RULE_CODEX } from '../data/ruleCodexData';
import React, { useState } from 'react';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';

/**
 * 技能公式動態解析與求值器 (Skill Formula Evaluator)
 * 嚴格遵循官方核心與拓展開發手冊之【SL】動態數值公式。
 * 
 * 體驗保證：
 * 1. 在點亮特技前 (SL = 0)：明確標註公式本身（例如【SL × 5】），讓玩家瞭解點數成長率與計算方式。
 * 2. 在點亮特技後 (SL >= 1)：自動計算精確數值（例如【10】），點擊數值徽章可於『計算結果』與『原始算式』間切換。
 * 3. 支援 Markdown **粗體** 樣式高亮渲染，1:1 對照官方規則書重點。
 * 4. 支援點擊非通用專屬規則關鍵詞（阿爾卡納、儀式學派、小工具、造物專案、忠實夥伴等），平滑開啟規則速查手冊。
 */

/**
 * 支援的專有規則速查關鍵詞。
 *
 * **由 `RULE_CODEX` 自動產生**，不再手動維護——否則新增速查條目時，
 * 這裡的靜態清單會與資料脫鉤（該清單原本只涵蓋核心手冊的 6 條）。
 * 依字元長度降序排列，避免短詞覆蓋長詞（例如「儀式」蓋掉「秘儀學派儀式」）。
 */
const CODEX_KEYWORDS = [
  ...new Set(Object.values(RULE_CODEX).flatMap((r) => r.keywords || []))
].sort((a, b) => b.length - a.length);

export function parseSkillFormulaSegments(text, sl = 0) {
  if (!text) return [];

  // 防禦性標準化：若出現常數與括號分離（如 10+【SL×5】或 【SL×5】+10），自動合併為標準複合算式
  const sanitizedText = text
    .replace(/(\d+)\s*([+＋])\s*【([^】]*SL[^】]*)】/g, '【$1 + ($3)】')
    .replace(/【([^】]*SL[^】]*)】\s*([+＋])\s*(\d+)/g, '【($1) + $3】');

  // 匹配所有【...SL...】或【SL】公式區塊
  const regex = /【([^】]*SL[^】]*)】/gi;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(sanitizedText)) !== null) {
    // 匹配前文字
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: sanitizedText.substring(lastIndex, match.index)
      });
    }

    const rawFormula = match[1].replace(/\*\*/g, '');
    const evaluated = evaluateFormulaString(rawFormula, sl);

    segments.push({
      type: 'formula',
      raw: match[0],
      formula: rawFormula,
      rawFormula: evaluated.rawFormula || rawFormula,
      evaluatedText: evaluated.text,
      computedValue: evaluated.value,
      formulaNote: evaluated.note,
      isCalculated: sl > 0 && evaluated.isCalculated
    });

    lastIndex = regex.lastIndex;
  }

  // 剩餘文字
  if (lastIndex < sanitizedText.length) {
    segments.push({
      type: 'text',
      content: sanitizedText.substring(lastIndex)
    });
  }

  return segments;
}

function evaluateFormulaString(formulaStr, sl) {
  const trimmed = formulaStr.trim();

  // 若 SL 為 0，不計算直接展示公式
  if (sl <= 0) {
    return {
      text: `【${trimmed}】`,
      value: null,
      rawFormula: trimmed,
      note: `公式基準：${trimmed}（尚未分配特技點數）`,
      isCalculated: false
    };
  }

  // 符號正規化：將全形括號、全形加減符號標準化
  const norm = trimmed
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[＋]/g, '+')
    .replace(/[－]/g, '-')
    .replace(/[×*xX]/g, '×');

  // 1. 複合乘加：如 10 + (SL × 5)、10 + SL × 5、5 + (SL × 5)
  const compoundMatch1 = norm.match(/^(\d+)\s*\+\s*\(?SL\s*×\s*(\d+)\)?$/i);
  if (compoundMatch1) {
    const base = Number(compoundMatch1[1]);
    const mult = Number(compoundMatch1[2]);
    const res = base + (sl * mult);
    return {
      text: `【${res}】`,
      value: res,
      rawFormula: trimmed,
      note: `${base} + (SL ${sl} × ${mult}) = ${res}`,
      isCalculated: true
    };
  }
  const compoundMatch2 = norm.match(/^\(?SL\s*×\s*(\d+)\)?\s*\+\s*(\d+)$/i);
  if (compoundMatch2) {
    const mult = Number(compoundMatch2[1]);
    const base = Number(compoundMatch2[2]);
    const res = base + (sl * mult);
    return {
      text: `【${res}】`,
      value: res,
      rawFormula: trimmed,
      note: `(SL ${sl} × ${mult}) + ${base} = ${res}`,
      isCalculated: true
    };
  }

  // 2. 乘法：如 SL × 5, SL × 10, SL × 2, SL × 20, SL × 100
  const multMatch = norm.match(/^SL\s*×\s*(\d+)$/i);
  if (multMatch) {
    const mult = Number(multMatch[1]);
    const res = sl * mult;
    return {
      text: `【${res}】`,
      value: res,
      rawFormula: trimmed,
      note: `SL ${sl} × ${mult} = ${res}`,
      isCalculated: true
    };
  }

  // 3. 乘法反向：如 10 × SL
  const revMultMatch = norm.match(/^(\d+)\s*×\s*SL$/i);
  if (revMultMatch) {
    const mult = Number(revMultMatch[1]);
    const res = sl * mult;
    return {
      text: `【${res}】`,
      value: res,
      rawFormula: trimmed,
      note: `${mult} × SL ${sl} = ${res}`,
      isCalculated: true
    };
  }

  // 4. 加法：如 SL + 1, SL + 2, SL + 3
  const addMatch = norm.match(/^SL\s*\+\s*(\d+)$/i);
  if (addMatch) {
    const add = Number(addMatch[1]);
    const res = sl + add;
    return {
      text: `【${res}】`,
      value: res,
      rawFormula: trimmed,
      note: `SL ${sl} + ${add} = ${res}`,
      isCalculated: true
    };
  }

  // 5. 純 SL：如 【SL】
  if (/^SL$/i.test(norm)) {
    return {
      text: `【${sl}】`,
      value: sl,
      rawFormula: trimmed,
      note: `特技等級 SL = ${sl}`,
      isCalculated: true
    };
  }

  // 6. 包含 SL × 數字 的混合文字公式：如 【你等級的一半 + (SL × 10)】
  if (/\bSL\s*×\s*(\d+)/i.test(norm)) {
    const subbedFormula = norm.replace(/\(?\bSL\s*×\s*(\d+)\)?/gi, (_, mStr) => {
      const multVal = Number(mStr);
      return String(sl * multVal);
    });
    return {
      text: `【${subbedFormula}】`,
      value: null,
      rawFormula: trimmed,
      note: `公式代入：${trimmed}（SL ${sl}）`,
      isCalculated: true
    };
  }

  // 7. 帶變數的加法：如 SL + 力量骰數值、SL + 目標身上狀態效果數量
  const varAddMatch = norm.match(/^SL\s*\+\s*(.+)$/i);
  if (varAddMatch) {
    const varName = varAddMatch[1];
    return {
      text: `【${sl} + ${varName}】`,
      value: null,
      rawFormula: trimmed,
      note: `公式：SL(${sl}) + ${varName}`,
      isCalculated: true
    };
  }

  // 8. 帶變數的乘法：如 SL × 夥伴基礎力量骰尺寸
  const varMultMatch = norm.match(/^SL\s*×\s*(.+)$/i);
  if (varMultMatch) {
    const varName = varMultMatch[1];
    return {
      text: `【${sl} × ${varName}】`,
      value: null,
      rawFormula: trimmed,
      note: `公式：SL(${sl}) × ${varName}`,
      isCalculated: true
    };
  }

  // 9. 預設替換所有的單獨 SL 詞彙
  const dynamicSubbed = norm.replace(/\bSL\b/g, String(sl));
  return {
    text: `【${dynamicSubbed}】`,
    value: null,
    rawFormula: trimmed,
    note: `公式計算替換：${trimmed} -> ${dynamicSubbed}`,
    isCalculated: true
  };
}

/**
 * 觸發開啟規則速查手冊全域事件
 */
export function openRuleCodex(keyword) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fu:open-rule-codex', { detail: { keyword } }));
  }
}

/**
 * 渲染單一純字串片段中的關鍵詞與攻擊性咒語圖標
 */
function renderWordsAndKeywords(text, keyPrefix = '', linkCodex = true) {
  if (!text || typeof text !== 'string') return text;

  // 組合正則：攻擊性咒語（（o）/(o)，另相容舊版閃電哨兵 U+26A1）以及非通用規則關鍵字
  const escapedKeywords = CODEX_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const combinedRegex = new RegExp(`(（[oO\u26A1]）|\\([oO\u26A1]\\)|${escapedKeywords})`, 'g');

  const parts = text.split(combinedRegex);
  if (parts.length === 1) return renderTextWithAffinities(text);

  return parts.map((part, pIdx) => {
    if (!part) return null;
    const k = `${keyPrefix}-${pIdx}`;

    // 1. 攻擊性咒語官方紅色閃電圖標
    if (/^(（[oO\u26A1]）|\([oO\u26A1]\))$/.test(part)) {
      return (
        <span key={k} className="inline text-red-600 font-bold select-none mx-0.5">
          （<span className="fu-icon text-sm leading-none drop-shadow-2xs" title="攻擊性咒語">
            o
          </span>）
        </span>
      );
    }

    // 2. 規則速查關鍵詞（`linkCodex === false` 時不連結——金手指用）
    if (linkCodex && CODEX_KEYWORDS.includes(part)) {
      return (
        <span
          key={k}
          onClick={(e) => {
            e.stopPropagation();
            openRuleCodex(part);
          }}
          className="inline cursor-pointer border-b border-dashed border-amber-600/70 text-amber-900 font-bold hover:text-amber-600 hover:border-amber-500 transition-colors mx-0.5"
          title={`點擊速查「${part}」官方規則`}
        >
          {part}
        </span>
      );
    }

    // 3. 一般文字片段進行九相傷害屬性解析
    return <React.Fragment key={k}>{renderTextWithAffinities(part)}</React.Fragment>;
  });
}

/**
 * 渲染行內富文字（解析 **粗體** 與其中的關鍵詞）
 */
function renderInlineRichText(line, linePrefix = '', linkCodex = true) {
  if (!line) return null;

  // 匹配 **粗體內容**
  const boldRegex = /(\*\*.*?\*\*)/g;
  const parts = line.split(boldRegex);

  return parts.map((chunk, cIdx) => {
    if (!chunk) return null;
    const k = `${linePrefix}-chunk-${cIdx}`;

    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      const innerText = chunk.slice(2, -2);
      return (
        <strong key={k} className="font-bold text-[#2c221e]">
          {renderWordsAndKeywords(innerText, `${k}-bold`, linkCodex)}
        </strong>
      );
    }

    return (
      <React.Fragment key={k}>
        {renderWordsAndKeywords(chunk, `${k}-plain`, linkCodex)}
      </React.Fragment>
    );
  });
}

/**
 * 完整渲染富文本區塊（解析 \n 換行、**粗體**、關鍵詞、公式）
 */
export function renderRichTextContent(content, prefix = '', linkCodex = true) {
  if (!content || typeof content !== 'string') return content;

  const lines = content.split('\n');
  if (lines.length === 1) {
    return renderInlineRichText(content, prefix);
  }

  return lines.map((line, lIdx) => (
    <React.Fragment key={`${prefix}-line-${lIdx}`}>
      {renderInlineRichText(line, `${prefix}-line-${lIdx}`, linkCodex)}
      {lIdx < lines.length - 1 && <br className="my-1" />}
    </React.Fragment>
  ));
}

/**
 * 技能公式數值徽章 (點擊可在『計算結果』與『原始算式』之間平滑切換)
 * 嚴格遵循官方字型與排印基線 0px 偏差鐵律（使用 inline-block align-baseline，禁絕 inline-flex）
 */
function FormulaBadge({ seg, sl }) {
  const [showFormula, setShowFormula] = useState(false);

  // 未點亮 (SL = 0) 或純公式展示
  if (!seg.isCalculated) {
    return (
      <span
        className="inline-block align-baseline px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-amber-800 bg-amber-50 border border-amber-300/80 cursor-help"
        title={seg.formulaNote}
      >
        {seg.evaluatedText}
      </span>
    );
  }

  const handleToggle = (e) => {
    e.stopPropagation();
    setShowFormula(prev => !prev);
  };

  const rawDisplay = `【${seg.rawFormula || seg.formula}】`;

  return (
    <span
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShowFormula(prev => !prev);
        }
      }}
      className={`inline-block align-baseline px-1.5 py-0.5 mx-0.5 rounded font-mono select-none cursor-pointer transition-all duration-150 ${ showFormula ? 'font-bold text-amber-950 bg-amber-100 border border-dashed border-amber-500 hover:bg-amber-200/80 active:scale-95' : 'font-black text-amber-900 bg-amber-200/90 border border-amber-400 hover:bg-amber-300 active:scale-95' }`}
      title={
        showFormula
          ? `點擊切換回計算結果：${seg.evaluatedText}（當前 SL: ${sl}）`
          : `點擊切換顯示原始算式：${seg.rawFormula || seg.formula}（公式：${seg.formulaNote}）`
      }
    >
      {showFormula ? rawDisplay : seg.evaluatedText}
    </span>
  );
}

/**
 * 技能動態敘述渲染組件
 *
 * `linkCodex`：要不要把 `CODEX_KEYWORDS` 裡的詞變成可點擊的規則速查連結。
 * **金手指一律傳 `false`**——金手指的效果文剛好含有很多規則詞，但語意上大多無關，
 * 使用者回報「有很多是剛好字對得上然後就被連過去了，實際完全沒有關係」。
 */
export default function SkillDescription({ desc, sl = 0, className = '', linkCodex = true }) {
  if (!desc) return null;

  const segments = parseSkillFormulaSegments(desc, sl);

  return (
    <span className={`inline leading-relaxed ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return (
            <React.Fragment key={idx}>
              {renderRichTextContent(seg.content, `seg-${idx}`, linkCodex)}
            </React.Fragment>
          );
        }

        return <FormulaBadge key={idx} seg={seg} sl={sl} />;
      })}
    </span>
  );
}

