/**
 * 把一段純文字裡的術語包成 `TermHint`（F-031，2026-10-28）。
 *
 * ## 為甚麼需要它
 *
 * 英雄技能的「效果」欄是**原書逐字照抄**的長段落，裡面藏著 HR、物語點、IP、TP。
 * 這四個詞在 115 條裡出現 27 次，但 F-028 的術語表只有 12 條、不含它們——
 * 因為建表那一輪的分母是「天天看到的詞」，而英雄技能那一批**從來沒跑過**。
 *
 * ## 為甚麼不把 `TermHint` 直接寫進 115 條資料
 *
 * 那會讓 `rulesData.json` 從「純文字」變成「帶標記的文字」，
 * 而那份資料同時被匯出、被列印、被測試逐字比對。**文字層不該知道畫面長什麼樣。**
 * 所以維持資料是純文字，在**渲染時**才標——與 `renderTextWithAffinities` 同一個做法。
 *
 * ## 兩個容易寫錯的地方
 *
 * 1. **ASCII 詞要有邊界。** `HR` 不能命中 `HRX`，也不能命中英文單字裡的片段。
 *    中文詞沒有這個問題，所以只對純 ASCII 的術語做前後字元檢查。
 * 2. **一次只標一個。** 同一格裡「物語點」出現三次時，標三次只是噪音——
 *    而且會讓同一句話長出三個按鈕，鍵盤使用者要 Tab 三次才過得去。
 *    所以預設「每個術語每段文字只標第一次」（`oncePerTerm`）。
 *
 * @param {string} text 要渲染的文字（可含 `\n`，外層容器負責 `whitespace-pre-line`）
 * @param {Array} entries `glossary.js` 的條目（通常傳 `TERMS` 的子集）
 * @param {{oncePerTerm?: boolean}} [options]
 * @returns {Array|string} 有命中就回節點陣列，沒命中就回原字串（呼叫端不必判斷）
 */
import React from 'react';
import TermHint from './TermHint';

const isAsciiWord = (s) => /^[A-Za-z]+$/.test(s);

export const renderTextWithTerms = (text, entries, { oncePerTerm = true } = {}) => {
  const src = String(text ?? '');
  if (!src || !Array.isArray(entries) || entries.length === 0) return src;

  // 長詞優先：先比對「物語點」再比對更短的詞，避免被短詞切開
  const sorted = [...entries]
    .filter((e) => e && e.term)
    .sort((a, b) => b.term.length - a.term.length);

  const used = new Set();
  const out = [];
  let buf = '';
  let i = 0;
  let key = 0;

  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = '';
    }
  };

  while (i < src.length) {
    let hit = null;
    for (const e of sorted) {
      if (oncePerTerm && used.has(e.id)) continue;
      if (!src.startsWith(e.term, i)) continue;
      if (isAsciiWord(e.term)) {
        const before = src[i - 1] || '';
        const after = src[i + e.term.length] || '';
        if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) continue;
      }
      hit = e;
      break;
    }

    if (hit) {
      used.add(hit.id);
      flush();
      out.push(<TermHint key={`term_${hit.id}_${key}`} entry={hit} />);
      key += 1;
      i += hit.term.length;
    } else {
      buf += src[i];
      i += 1;
    }
  }
  flush();
  return out.length === 1 && typeof out[0] === 'string' ? out[0] : out;
};

export default renderTextWithTerms;
