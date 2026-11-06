/**
 * 徽記師（Symbolist）子系統純函式模組
 *
 * 規則依據：官方原書《High Fantasy Atlas》p.142-143
 *
 * 核心機制：
 * 1. 【徽記學】：花費 1 個動作在一名自願生物或物體上刻劃一個已掌握的徽記。
 *    在世界上同時維持的徽記數量最多為【SL + 1】個。
 *    可花費 1 個動作摧毀由你刻劃的任意數量的徽記。
 * 2. 【咒語徽記】：施放目標為「你自己」的咒語時，可將目標改為由你刻劃了徽記的一名生物。
 */

import { SYMBOLIST_SYMBOLS } from '../data/skillSuboptionsData';

/**
 * 計算徽記師同時維持徽記的上限（SL + 1）。
 */
export function maxSymbolMarks(sl) {
  const safeSl = Math.max(1, Math.floor(Number(sl) || 1));
  return safeSl + 1;
}

/**
 * 取得角色當前維持的徽記實體清單。
 */
export function getSymbolMarks(character) {
  if (Array.isArray(character?.symbolMarks)) {
    return character.symbolMarks;
  }
  if (Array.isArray(character?.symbolistData?.marks)) {
    return character.symbolistData.marks;
  }
  return [];
}

/**
 * 檢查是否可再刻劃新徽記。
 */
export function canAddSymbolMark(character, sl) {
  const marks = getSymbolMarks(character);
  return marks.length < maxSymbolMarks(sl);
}

/**
 * 刻劃一個新徽記。
 * 回傳 { ok: true, character: nextChar, mark } 或 { ok: false, reason }。
 */
export function addSymbolMark(character, { symbolId, bearer, note = '' }, sl = 1) {
  const marks = getSymbolMarks(character);
  const max = maxSymbolMarks(sl);

  if (marks.length >= max) {
    return {
      ok: false,
      reason: `已達徽記維持上限（${max} 個），必須先摧毀既有徽記`
    };
  }

  const symDef = SYMBOLIST_SYMBOLS.find((s) => s.id === symbolId || s.name === symbolId);
  if (!symDef) {
    return {
      ok: false,
      reason: '未知的徽記種類'
    };
  }

  const safeBearer = typeof bearer === 'string' && bearer.trim() ? bearer.trim() : '自身';
  const newMark = {
    id: `mark_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    symbolId: symDef.id,
    symbolName: symDef.name,
    effect: symDef.effect,
    bearer: safeBearer,
    note: typeof note === 'string' ? note.trim() : '',
    createdAt: new Date().toISOString()
  };

  const nextMarks = [...marks, newMark];
  const nextChar = {
    ...character,
    symbolMarks: nextMarks,
    updatedAt: new Date().toISOString()
  };

  return {
    ok: true,
    character: nextChar,
    mark: newMark
  };
}

/**
 * 摧毀單個徽記。
 */
export function removeSymbolMark(character, markId) {
  const marks = getSymbolMarks(character);
  const nextMarks = marks.filter((m) => m.id !== markId);
  if (nextMarks.length === marks.length) {
    return { ok: false, character, reason: '找不到指定的徽記' };
  }
  return {
    ok: true,
    character: {
      ...character,
      symbolMarks: nextMarks,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * 摧毀全部徽記。
 */
export function clearSymbolMarks(character) {
  const marks = getSymbolMarks(character);
  if (marks.length === 0) {
    return { ok: false, character, reason: '目前沒有任何維持中的徽記' };
  }
  return {
    ok: true,
    character: {
      ...character,
      symbolMarks: [],
      updatedAt: new Date().toISOString()
    },
    count: marks.length
  };
}

/**
 * 取得目前被刻劃徽記的所有攜帶者（供【咒語徽記】讀取）。
 */
export function listSymbolMarkBearers(character) {
  const marks = getSymbolMarks(character);
  const bearers = [];
  for (const m of marks) {
    const b = m.bearer || '自身';
    if (!bearers.includes(b)) {
      bearers.push(b);
    }
  }
  return bearers;
}
