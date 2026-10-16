/**
 * classAliases.js — 職業別稱（官方原書職業頁的「ALSO:」行）
 *
 * ## 這份資料是什麼
 *
 * 官方原書在每個職業頁的標題下方印一行 `ALSO:`，列出這個職業在其他世界觀、
 * 其他作品裡可能叫什麼（例：遊蕩者 = 強盜、忍者、盜賊）。用途不是機制，
 * 而是讓玩家從「我想演什麼」而不是「規則上叫什麼」去挑職業。
 *
 * ## 資料來源（2026-10-16 抽取）
 *
 * - **英文 ＝ 官方原書 `ALSO:` 的原文**（權威）。以下 `src` 一律標**印刷頁碼**；
 *   核心書與三本手冊為「印刷 = PDF − 2」，官方特典合輯**無偏移**（`AGENTS.md` §1.1）。
 * - **中文 ＝ 專案內既有中文資料的譯法**：
 *   - 核心 15 職 → 核心規則書漢化節錄（`resources/角色卡/01_Core_Rulebook/`，
 *     原文作「同时也可以叫做：」或「别称：」）
 *   - 三大手冊與特典 → CHM 測試版漢化（`resources/角色卡/` 各手冊目錄下的 `CHM_Playtest_中文翻译/`）
 *   - 兩份來源都是**簡體**，本檔一律轉為**繁體**（全站介面語言）。
 *
 * ## 四個欄位的分工（重要，別混用）
 *
 * | 欄位 | 內容 | 顯示 | 檢索 |
 * |---|---|---|---|
 * | `en` | 官方原書 `ALSO:` 的英文原詞 | ✕（規則三：只有職業／範本／物種可用「中文 · ENGLISH」） | ✓ |
 * | `zh` | 對應 `en` 逐詞的中文譯名（**長度與順序與 `en` 一致**） | ✓ | ✓ |
 * | `zhDerived` | `zh` 之中**由 GM 裁定以語義補譯**的英文詞（見下） | — | — |
 * | `zhExtra` | **測試版漢化獨有**、正式版原書已無此詞者 | ✕ | ✓ |
 *
 * **`zhExtra` 為什麼不顯示**：顯示了等於宣稱「原書這樣寫」，而原書不是。
 * 例：植物學家在測試版漢化是「森林女巫」（對應舊版 `Witch of the Woods`），
 * 正式版原書已改成 `Bloomblade`。搜尋仍可用「森林女巫」找到植物學家，
 * 但它不會出現在「又稱」那一行。
 *
 * ## `zhDerived`：GM 裁定的語義補譯（2026-10-16）
 *
 * 正式版有、漢化查無譯名的 5 個詞（`Bloomblade`／`Ascetic`／`Antiquarian`／
 * `Pharmacist`／`Experiment`）原本依「寧缺勿造」只留英文。**GM 裁定推翻此處理**：
 *
 * > 「那些沒有中文翻譯的你可以按照語義寫個適合的翻譯。因為這只是別稱而已，
 * > 　不會影響到遊戲機制。」
 *
 * 裁定生效的**範圍僅限別稱**——理由是別稱屬**敘事層**（給玩家想像空間用），
 * 不承載任何數值、檢定或階級，寫錯不會造成規則錯誤。
 * **同一條裁定不得外推到技能／裝備／咒語**：那些仍受「嚴禁憑記憶編造」約束
 * （`AGENTS.md` §2 第 6 條）。
 *
 * `zhDerived` 逐筆記下「哪幾個英文詞是補譯的」，讓來源可回溯——沒有這個欄位，
 * 半年後沒人分得出哪個中文是漢化原有的、哪個是本專案自己寫的。
 *
 * ## 已知的撞名（不是 bug）
 *
 * `鬥士` 同時是狂怒鬥士（`Brawler`）與武器大師（`Fighter`）的別稱——漢化本身
 * 就撞名。搜尋「鬥士」同時命中兩職，是正確行為，不要「修」掉。
 */

/**
 * 職業別稱總表。鍵與 `SOURCEBOOKS` 的職業名一致（不含【Playtest】後綴，
 * 公測變體由 `getClassAliases` 剝除後綴後沿用本表）。
 */
export const CLASS_ALIASES = {
  // ---------------------------------------------------------------- 核心 15 職
  '秘儀師': {
    zh: ['神通', '天選者', '召喚師'],
    en: ['Avatar', 'Chosen', 'Summoner'],
    src: '核心規則書 p.176'
  },
  '嵌合師': {
    zh: ['德魯伊', '變形者', '荒野法師'],
    en: ['Druid', 'Shapeshifter', 'Wild Mage'],
    src: '核心規則書 p.182'
  },
  '暗黑之刃': {
    zh: ['復仇者', '黑暗騎士', '死亡騎士'],
    en: ['Avenger', 'Black Knight', 'Death Knight'],
    src: '核心規則書 p.184'
  },
  '元素師': {
    zh: ['戰鬥法師', '地術士', '巫師'],
    en: ['Battle Mage', 'Geomancer', 'Sorcerer'],
    src: '核心規則書 p.186'
  },
  '熵師': {
    zh: ['占星師', '混沌法師', '賭徒'],
    en: ['Astromancer', 'Chaos Mage', 'Gambler'],
    src: '核心規則書 p.190'
  },
  '狂怒鬥士': {
    zh: ['狂戰士', '鬥士', '維京人'],
    en: ['Berserker', 'Brawler', 'Viking'],
    src: '核心規則書 p.194'
  },
  '守護者': {
    zh: ['聖騎士', '士兵', '用心棒'],
    en: ['Paladin', 'Soldier', 'Yōjinbō'],
    src: '核心規則書 p.196'
  },
  '博學士': {
    zh: ['檔案管理者', '賢者', '學者'],
    en: ['Archivist', 'Sage', 'Scholar'],
    src: '核心規則書 p.198'
  },
  '吟唱者': {
    zh: ['大使', '外交官', '藝人'],
    en: ['Ambassador', 'Diplomat', 'Entertainer'],
    src: '核心規則書 p.200'
  },
  '遊蕩者': {
    zh: ['強盜', '忍者', '盜賊'],
    en: ['Bandit', 'Ninja', 'Thief'],
    src: '核心規則書 p.202'
  },
  '神射手': {
    zh: ['弓箭手', '槍手', '狙擊手'],
    en: ['Archer', 'Gunslinger', 'Sniper'],
    src: '核心規則書 p.204'
  },
  '靈師': {
    zh: ['癒師', '牧師', '女巫'],
    en: ['Healer', 'Priest', 'Witch'],
    src: '核心規則書 p.206'
  },
  '修補匠': {
    zh: ['煉金術士', '魔科技工程師', '機甲師'],
    en: ['Alchemist', 'Magitech Engineer', 'Mechanic'],
    src: '核心規則書 p.210'
  },
  '旅人': {
    zh: ['冒險家', '探索者', '寶藏獵人'],
    en: ['Adventurer', 'Explorer', 'Treasure Hunter'],
    src: '核心規則書 p.216'
  },
  '武器大師': {
    zh: ['鬥士', '浪人', '戰士'],
    en: ['Fighter', 'Rōnin', 'Warrior'],
    src: '核心規則書 p.218'
  },

  // ---------------------------------------------------------------- 高度奇幻手冊
  '魔奏者': {
    zh: ['詩人', '偶像', '吟遊詩人'],
    en: ['Bard', 'Idol', 'Troubadour'],
    src: '高度奇幻手冊 p.136'
  },
  '指揮官': {
    zh: ['親王', '女王', '將軍'],
    en: ['Prince', 'Queen', 'Shōgun'],
    src: '高度奇幻手冊 p.140'
  },
  '舞者': {
    zh: ['雜技家', '弄臣', '遊蕩劍客'],
    en: ['Acrobat', 'Jester', 'Swashbuckler'],
    src: '高度奇幻手冊 p.142'
  },
  '徽記師': {
    zh: ['書法家', '畫家', '符文師'],
    en: ['Calligrapher', 'Painter', 'Runemaker'],
    src: '高度奇幻手冊 p.146'
  },

  // ---------------------------------------------------------------- 自然奇幻手冊
  '植物學家': {
    // 官方英文 Bloomblade／Gardener／Herbalist。漢化只譯得出後兩個，
    // Bloomblade 由 GM 裁定以語義補譯（見檔頭 `zhDerived`）。
    zh: ['花刃', '園丁', '藥師'],
    en: ['Bloomblade', 'Gardener', 'Herbalist'],
    zhDerived: ['Bloomblade'],
    zhExtra: ['森林女巫'],
    src: '自然奇幻手冊 p.138'
  },
  '美食家': {
    zh: ['釀酒師', '大廚', '糕點師'],
    en: ['Brewer', 'Chef', 'Patissier'],
    src: '自然奇幻手冊 p.148'
  },
  '祈喚者': {
    // 官方英文 Ascetic／Channeler／Five-Soul Master。漢化只譯得出後兩個，
    // Ascetic 由 GM 裁定以語義補譯（見檔頭 `zhDerived`）。
    zh: ['苦行者', '通靈師', '五行宗師'],
    en: ['Ascetic', 'Channeler', 'Five-Soul Master'],
    zhDerived: ['Ascetic'],
    zhExtra: ['陰陽師', '元素薩滿'],
    src: '自然奇幻手冊 p.154'
  },
  '商人': {
    // 官方英文 Antiquarian／Collector／Pharmacist。漢化只譯得出 Collector，
    // Antiquarian 與 Pharmacist 由 GM 裁定以語義補譯（見檔頭 `zhDerived`）。
    zh: ['古董商', '收藏家', '藥劑師'],
    en: ['Antiquarian', 'Collector', 'Pharmacist'],
    zhDerived: ['Antiquarian', 'Pharmacist'],
    zhExtra: ['企業家', '繼承人'],
    src: '自然奇幻手冊 p.158'
  },

  // ---------------------------------------------------------------- 科技奇幻手冊
  '靈能者': {
    zh: ['讀心師', '心靈術士', '靈魂駭客'],
    en: ['Empath', 'Psion', 'Soul Hacker'],
    src: '科技奇幻手冊 p.150'
  },
  '突變體': {
    // 官方英文 Abomination／Experiment／Lycanthrope。漢化只譯得出前後兩個，
    // Experiment 由 GM 裁定以語義補譯（見檔頭 `zhDerived`）。
    zh: ['憎惡', '實驗體', '獸化人'],
    en: ['Abomination', 'Experiment', 'Lycanthrope'],
    zhDerived: ['Experiment'],
    zhExtra: ['賽博人'],
    src: '科技奇幻手冊 p.154'
  },
  '機師': {
    zh: ['飛車黨', '機甲駕駛員', '天空海盜'],
    en: ['Biker', 'Mecha Pilot', 'Sky Pirate'],
    src: '科技奇幻手冊 p.158'
  },

  // ---------------------------------------------------------------- 官方特典合輯
  '卡牌大師': {
    zh: ['牌靈師', '命運決鬥者', '豪賭客'],
    en: ['Deckmancer', 'Destiny Duelist', 'High Roller'],
    src: '官方特典合輯 p.6'
  },
  '死靈術士': {
    zh: ['墳墓女王', '復生者', '吸血鬼'],
    en: ['Grave Queen', 'Reanimator', 'Vampire'],
    src: '官方特典合輯 p.12'
  }
};

/** 尾端的【…】限定標記（如 `【Playtest】`）；查表時剝除。 */
const SUFFIX_RE = /【[^】]*】\s*$/;

/**
 * 取得職業別稱。公測變體（`秘儀師【Playtest】`）剝除後綴後沿用本表。
 * @param {string} className
 * @returns {{zh?: string[], en?: string[], zhExtra?: string[], src?: string}|null}
 */
export function getClassAliases(className) {
  if (typeof className !== 'string' || !className.trim()) return null;
  const raw = className.trim();
  const base = raw.replace(SUFFIX_RE, '').trim();
  return CLASS_ALIASES[raw] || CLASS_ALIASES[base] || null;
}

/**
 * 顯示用的中文別稱字串（以「、」串接）。
 * **只回傳 `zh`**——`zhExtra` 是測試版漢化獨有詞，依檔頭說明不列入顯示。
 * @param {string} className
 * @returns {string|null} 例：`強盜、忍者、盜賊`；查無回傳 null
 */
export function formatClassAliases(className) {
  const aliases = getClassAliases(className);
  if (!aliases || !Array.isArray(aliases.zh) || aliases.zh.length === 0) return null;
  return aliases.zh.join('、');
}

/**
 * 別稱的出處（純中文字串，供 UI 標示）。
 * @param {string} className
 * @returns {string|null} 例：`核心規則書 p.202`
 */
export function classAliasSource(className) {
  return getClassAliases(className)?.src || null;
}

/**
 * 某個職業的全部可檢索詞彙（一律小寫）。
 *
 * **這支是「搜尋」與「測試」共用的唯一實作**——測試不會另外抄一份比對邏輯，
 * 所以「測試綠燈」等於「搜尋真的比對到這些字」。
 *
 * @param {{className?: string, info?: {en?: string, tagline?: string}|null, bookName?: string}} item
 * @returns {string[]}
 */
export function classSearchTokens(item = {}) {
  const { className = '', info = null, bookName = '' } = item || {};
  const aliases = getClassAliases(className);
  return [
    className,
    info?.en,
    info?.tagline,
    bookName,
    ...(aliases?.en || []),
    ...(aliases?.zh || []),
    ...(aliases?.zhExtra || [])
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

/**
 * 職業是否命中搜尋字串（純函式，無副作用）。
 *
 * 比對範圍：中文職業名／英文職業名／風格速覽／手冊名／別稱（中英，含測試版漢化詞）。
 * 空查詢一律視為命中（＝不過濾）。
 *
 * @param {{className?: string, info?: object|null, bookName?: string}} item
 * @param {string} query
 * @returns {boolean}
 */
export function matchesClassQuery(item, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  return classSearchTokens(item).some((token) => token.includes(q));
}
