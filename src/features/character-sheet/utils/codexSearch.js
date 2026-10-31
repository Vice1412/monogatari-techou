/**
 * 規則索引的搜尋（純函式，零副作用、不 import React、不碰 localStorage）。
 *
 * 為什麼要有這支模組
 * ------------------
 * 18 節規則原本只能「一顆一顆點開看」——搜尋只覆蓋阿爾卡納目錄與法術書兩節
 * （`RuleCodexDrawer` 的 `searchTerm`），其餘 16 節沒有任何入口。
 * 而「找得到」這件事不該靠排版，該靠**索引**：先把每一節攤成可搜尋的欄位，
 * 再讓搜尋回報「命中在哪一層」。
 *
 * 為什麼要回報欄位名稱
 * --------------------
 * 同樣是「MP」，它可能出現在摘要、條文、表格或咒語裡。只回一句「3 節命中」等於
 * 叫使用者自己去翻；回「核心法術書 · 咒語 · …花費 8 MP…」才是答案。
 *
 * 純函式的好處是它可以被測試直接餵壞資料：`buildCodexIndex(null)`、
 * `searchCodex(index, '   ')` 都必須安靜地回空陣列，而不是拋錯把整個抽屜打掛。
 */

/** 命中欄位的中文名稱。新增欄位時這裡沒補，`label` 會落回「條文」而不是空白。 */
export const CODEX_FIELD_LABEL = {
  title: '標題',
  book: '原書',
  page: '頁碼',
  keyword: '關鍵詞',
  summary: '摘要',
  rule: '條文',
  item: '條目',
  row: '表格',
  spell: '咒語'
};

const FIELD_ORDER = ['title', 'book', 'page', 'keyword', 'summary', 'rule', 'item', 'row', 'spell'];

const asText = (value) => (typeof value === 'string' ? value : '');

const pushField = (fields, field, text) => {
  const t = asText(text).trim();
  if (t) fields.push({ field, text: t });
};

/**
 * 把一節的內容攤成 `{ field, text }` 清單。
 * 只認得**已知的形狀**（`rules`／`sections`／`schools`／`catalog`／`keywords`），
 * 不遞迴整棵物件樹——遞迴會把 `id`、`icon` 這種代號也收進來，
 * 於是搜「a」全站命中（代號幾乎都含 a）。
 */
const collectFields = (rule) => {
  const fields = [];

  pushField(fields, 'title', rule.title);
  pushField(fields, 'book', String(asText(rule.page)).split(/\s+/)[0]);
  pushField(fields, 'page', rule.page);
  pushField(fields, 'keyword', (rule.keywords || []).join(' '));
  pushField(fields, 'summary', rule.summary);

  for (const r of rule.rules || []) pushField(fields, 'rule', r);

  for (const sec of rule.sections || []) {
    pushField(fields, 'item', sec.title);
    for (const it of sec.items || []) {
      if (typeof it === 'string') pushField(fields, 'rule', it);
      else if (it && typeof it === 'object') {
        pushField(fields, 'item', it.name);
        pushField(fields, 'item', it.body);
      }
    }
    for (const row of sec.rows || []) {
      if (Array.isArray(row)) pushField(fields, 'row', row.join(' '));
    }
  }

  for (const school of rule.schools || []) {
    pushField(fields, 'item', school.name);
    for (const sp of school.spells || []) {
      pushField(fields, 'spell', sp.name);
      pushField(fields, 'spell', sp.desc);
    }
  }

  for (const arcana of rule.catalog || []) {
    pushField(fields, 'item', arcana.name);
    pushField(fields, 'item', arcana.domains);
    pushField(fields, 'item', arcana.merge);
    pushField(fields, 'item', arcana.dismiss);
    pushField(fields, 'item', arcana.pulse);
  }

  return fields;
};

/**
 * @param {object} codex `RULE_CODEX`（id → 條目）
 * @returns {Array<{id:string,title:string,book:string,fields:Array<{field:string,text:string}>}>}
 */
export const buildCodexIndex = (codex) => {
  if (!codex || typeof codex !== 'object') return [];
  return Object.keys(codex).map((id) => {
    const rule = codex[id] && typeof codex[id] === 'object' ? codex[id] : {};
    return {
      id,
      title: asText(rule.title) || id,
      book: String(asText(rule.page)).split(/\s+/)[0],
      fields: collectFields(rule)
    };
  });
};

/** 片段：命中字前後各留幾個字，太長就加省略號。 */
const snippetOf = (text, term, pad = 14) => {
  const lowerText = text.toLowerCase();
  const at = lowerText.indexOf(term.toLowerCase());
  if (at < 0) return text.slice(0, pad * 2);
  const start = Math.max(0, at - pad);
  const end = Math.min(text.length, at + term.length + pad);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};

/**
 * 搜尋：回**每一節一筆**（不是每一個欄位一筆）。
 * 一節命中五個欄位時，目錄上出現五列同名條目只是噪音；
 * 使用者要的是「這一節有中，中在條文，共 3 處」。
 *
 * @param {ReturnType<typeof buildCodexIndex>} index
 * @param {string} rawTerm 使用者輸入
 * @returns {Array<{id,title,book,field,label,snippet,count}>}
 */
export const searchCodex = (index, rawTerm) => {
  const term = asText(rawTerm).trim();
  if (!term || !Array.isArray(index)) return [];
  const needle = term.toLowerCase();

  const results = [];
  for (const entry of index) {
    const hits = (entry.fields || []).filter(
      (f) => asText(f.text).toLowerCase().includes(needle)
    );
    if (hits.length === 0) continue;

    // 命中的欄位照 `FIELD_ORDER` 排，回報最靠近「標題」的那一層：
    // 標題命中比條文命中更接近使用者想找的東西。
    const best = hits.slice().sort(
      (a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field)
    )[0];

    results.push({
      id: entry.id,
      title: entry.title,
      book: entry.book,
      field: best.field,
      label: CODEX_FIELD_LABEL[best.field] || '條文',
      snippet: snippetOf(best.text, term),
      count: hits.length
    });
  }

  // 標題命中的排前面（找「阿爾卡納」時，阿爾卡納那一節要第一筆），其餘照原書順序。
  const rank = (r) => (r.field === 'title' ? 0 : r.field === 'book' ? 2 : 1);
  return results.sort((a, b) => rank(a) - rank(b));
};
