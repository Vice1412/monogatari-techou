/**
 * 條目交叉引用（Cross-reference）
 *
 * ## 為什麼需要人工規則，而不是「全自動比對名稱」
 *
 * 專案裡有 344 個條目名稱（英雄技能 115、金手指 46、咒語 38、職業技能 145）。
 * 如果單純把「文字中出現的名稱」全部變成連結，會連出一堆**假連結**——
 * 實測掃描 46 條金手指，命中 22 次，其中真正的引用只有 8 次，其餘是普通詞：
 *
 * | 誤連 | 實際語意 |
 * |---|---|
 * | 天才的宿敵 → 升級 | 「他升級為了實力更強的反派」＝動詞 |
 * | 應劫之人 → 彗星 | 「超大彗星」＝天體 |
 * | 武器縛靈 → 消失 | 「你會立即消失」＝動詞 |
 * | 固執的懷疑論者 → 覺醒 | 「力量也開始覺醒」＝動詞 |
 *
 * 所以這裡只認**三種確定是引用的情況**：
 *
 * 1. **明確清單**（`EXPLICIT_REFS`）——原文用頓號並列、沒有動詞線索的引用，
 *    例如神秘魔法書的「彗星、額外咒語、希望和火山」。這類只能人工列出。
 * 2. **引用線索**（`CITATION_CUES`）——名稱前後緊接「使用／獲得／學會／施展／
 *    習得／選擇／見於」或後接「技能／咒語／金手指」。實測 50 筆，逐筆看過都是真引用。
 * 3. **【】書名括號**——專案既有的引用慣例，例如「（可見於【定制武器說明】）」。
 *
 * 三者取聯集，再過濾掉「索引裡查不到的名字」，最後依長度降序（避免短名蓋掉長名）。
 */

import rulesData from './rulesData.json';
import { ZERO_EFFECTS } from './zeroPowers.js';
import { CAMP_ACTIVITIES } from './campActivities.js';

/** 條目類型 → 顯示名稱。 */
export const REF_KIND_LABEL = Object.freeze({
  heroic: '英雄技能',
  quirk: '金手指',
  spell: '咒語',
  class: '職業技能',
  zero: '底力技',
  camp: '營地活動',
});

/** 英雄技能的 `source` 代碼 → 出處書名。 */
const HEROIC_SOURCE_LABEL = Object.freeze({
  core: '核心規則',
  bonus: '官方特典',
  highFantasy: '高度奇幻手冊',
  technoFantasy: '科技奇幻手冊',
  naturalFantasy: '自然奇幻手冊',
  playtest: '公測素材',
});

/**
 * 原文用頓號並列、句中沒有動詞線索的引用。**只能人工維護。**
 *
 * 神秘魔法書「隱藏的魔法」列了四個英雄技能、「推薦的金手指」列了四個金手指——
 * 這八個名字全部是引用，但句型是「你可以在 A、B、C 和 D 中選擇」，
 * 沒有「使用」之類的線索，自動規則抓不到。
 */
const EXPLICIT_REFS = Object.freeze({
  神秘魔法書: Object.freeze([
    '彗星', '額外咒語', '希望', '火山',
    '草木成精', '機器人', '會說話的野獸', '大夢一場',
  ]),
  // 「當你透過植生術技能種下一顆魔法種子後（非透過嫁接）」——嫁接是植物學家的技能，
  // 但括號裡的寫法沒有任何引用線索（「透過」已被排除，見 CUE_BEFORE）。
  戰地園藝: Object.freeze(['嫁接']),
});

/**
 * 名稱「之前」出現這些詞＝引用。
 *
 * **刻意不收「透過」**：實測它會把「透過探索和故事推進獲得新的阿爾卡納」的
 * 「探索」連成技能（那是普通名詞）。線索寧可少，不可誤。
 */
const CUE_BEFORE = /(使用|獲得|學會|習得|施展|選擇|見於|可見於|參見)$/;
/** 名稱「之後」出現這些詞＝引用。 */
const CUE_AFTER = /^(技能|咒語|金手指|效果|動作)/;

/** 建立索引：名稱 → 條目。同名時依 `KIND_PRIORITY` 決定誰代表它。 */
const KIND_PRIORITY = ['heroic', 'quirk', 'spell', 'class', 'zero', 'camp'];

function buildIndex() {
  const buckets = { heroic: [], quirk: [], spell: [], class: [], zero: [], camp: [] };

  rulesData.heroicSkills.forEach((h) => buckets.heroic.push({
    name: h.name,
    kind: 'heroic',
    meta: [
      ['前提', h.requirement || '—'],
      ['出處', HEROIC_SOURCE_LABEL[h.source] || h.source || '—'],
    ],
    body: h.effect || '',
  }));

  rulesData.quirks.forEach((q) => buckets.quirk.push({
    name: q.name,
    kind: 'quirk',
    meta: [],
    body: q.desc || '',
    flavor: q.flavor || '',
  }));

  rulesData.spells.forEach((s) => buckets.spell.push({
    name: s.name,
    kind: 'spell',
    meta: [
      ['學派', s.school || '—'],
      ['MP', String(s.mp ?? '—')],
      ['目標', s.target || '—'],
      ['持續', s.duration || '—'],
    ],
    body: s.effect || '',
  }));

  Object.entries(rulesData.classes).forEach(([className, cls]) => {
    (cls.skills || []).forEach((s) => buckets.class.push({
      name: s.name,
      kind: 'class',
      meta: [
        ['職業', className],
        ['SL 上限', String(s.maxSL ?? '—')],
      ],
      body: s.desc || '',
    }));
  });

  ZERO_EFFECTS.forEach((z) => buckets.zero.push({
    name: z.name,
    kind: 'zero',
    meta: [['別名', (z.alias || []).join('、') || '—']],
    body: z.desc || '',
  }));

  CAMP_ACTIVITIES.forEach((c) => buckets.camp.push({
    name: c.name,
    kind: 'camp',
    meta: [
      ['摘要', c.summary || '—'],
      ['出處', `自然奇幻手冊 ${c.page || ''}`.trim()],
    ],
    body: c.desc || '',
  }));

  const index = new Map();
  KIND_PRIORITY.forEach((kind) => {
    buckets[kind].forEach((entry) => {
      if (!entry.name || index.has(entry.name)) return;
      index.set(entry.name, { ...entry, kindLabel: REF_KIND_LABEL[kind] });
    });
  });
  return index;
}

const INDEX = buildIndex();

/** 所有可被引用的名稱（依長度降序，供正則交替使用）。 */
export const REF_NAMES = Object.freeze(
  [...INDEX.keys()].filter((n) => n.length >= 2).sort((a, b) => b.length - a.length),
);

export function lookupEntry(name) {
  return INDEX.get(name) || null;
}

export function hasEntry(name) {
  return INDEX.has(name);
}

/** 並列連接詞：`主教法令、騎兵衝鋒或帝王堅壘` 這種句型只有第一個名稱吃得到線索。 */
const LIST_SEPARATORS = '、或和與及／/';

/**
 * 把並列清單補齊。
 *
 * 原句「當你使用主教法令、騎兵衝鋒或帝王堅壘技能後…」只有「主教法令」前面有「使用」，
 * 後面兩個名稱前後都只是頓號與連接詞。既然其中一個已經被判定為引用，
 * 同一串並列裡的鄰居就是同一種引用——往左右兩側沿著分隔符擴散。
 */
function expandListNeighbours(text, set) {
  let changed = true;
  let guard = 0;
  while (changed && guard < 4) {
    changed = false;
    guard += 1;
    for (const name of [...set]) {
      let i = text.indexOf(name);
      while (i >= 0) {
        // 往右：名稱 + 分隔符 + 名稱
        let right = i + name.length;
        while (LIST_SEPARATORS.includes(text[right])) {
          right += 1;
          const hit = REF_NAMES.find((n) => text.startsWith(n, right));
          if (!hit) break;
          if (!set.has(hit)) { set.add(hit); changed = true; }
          right += hit.length;
        }
        // 往左：名稱 + 分隔符 + 名稱
        let left = i - 1;
        while (LIST_SEPARATORS.includes(text[left])) {
          left -= 1;
          const hit = REF_NAMES.find((n) => text.slice(0, left + 1).endsWith(n));
          if (!hit) break;
          if (!set.has(hit)) { set.add(hit); changed = true; }
          left -= hit.length;
        }
        i = text.indexOf(name, i + 1);
      }
    }
  }
  return set;
}

/**
 * 掃描單一條目的文字，找出它引用了哪些其他條目。
 * 只在模組載入時跑一次（每條目一次），結果快取。
 */
function scanCitations(ownName, text) {
  const found = new Set();
  if (!text) return found;
  for (const name of REF_NAMES) {
    if (name === ownName) continue;
    let i = text.indexOf(name);
    while (i >= 0) {
      const before = text.slice(Math.max(0, i - 6), i);
      const after = text.slice(i + name.length, i + name.length + 6);
      if (CUE_BEFORE.test(before) || CUE_AFTER.test(after)) {
        found.add(name);
        break;
      }
      i = text.indexOf(name, i + 1);
    }
  }
  found.delete(ownName);
  return expandListNeighbours(text, found);
}

let citationCache = null;

function citationMap() {
  if (citationCache) return citationCache;
  const map = new Map();
  const put = (name, text) => {
    if (!name || !text) return;
    map.set(name, scanCitations(name, text));
  };
  rulesData.heroicSkills.forEach((h) => put(h.name, h.effect));
  rulesData.quirks.forEach((q) => put(q.name, q.desc));
  rulesData.spells.forEach((s) => put(s.name, s.effect));
  Object.values(rulesData.classes).forEach((cls) => (cls.skills || []).forEach((s) => put(s.name, s.desc)));
  ZERO_EFFECTS.forEach((z) => put(z.name, z.desc));
  CAMP_ACTIVITIES.forEach((c) => put(c.name, c.desc));
  citationCache = map;
  return map;
}

/**
 * 給定「這是一段屬於誰的文字」，回傳這段文字裡應該變成連結的名稱。
 *
 * @param {string} text        要渲染的文字（用來抓【】引用）
 * @param {string} [sourceName] 這段文字所屬的條目名稱（用來套明確清單與線索掃描）
 * @returns {string[]} 依長度降序的名稱
 */
export function resolveRefNames(text, sourceName) {
  const set = new Set();

  if (sourceName) {
    const explicit = EXPLICIT_REFS[sourceName];
    if (explicit) explicit.forEach((n) => set.add(n));
    const scanned = citationMap().get(sourceName);
    if (scanned) scanned.forEach((n) => set.add(n));
  }

  if (text) {
    const bracket = text.matchAll(/【([^】]{1,20})】/g);
    for (const m of bracket) {
      if (INDEX.has(m[1])) set.add(m[1]);
    }
  }

  return [...set].filter((n) => INDEX.has(n)).sort((a, b) => b.length - a.length);
}

/** 開啟條目查閱視窗（全域事件，掛載點在 App.jsx）。 */
export function openEntryRef(name) {
  if (typeof window === 'undefined' || !name) return;
  window.dispatchEvent(new CustomEvent('fu:open-entry-ref', { detail: { name } }));
}
