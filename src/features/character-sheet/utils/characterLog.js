/**
 * 角色成長履歷 (Character Log)
 *
 * 為什麼要有這份資料：
 * 使用者對這張卡的願景是「開好角色後基本固定，玩家一路玩一路記錄該記錄的東西——
 * HP／MP／IP／物語點／經驗值、升級後點哪一個技能、拿錢買了什麼裝備，而且要有日期」。
 * 在那之前，角色卡**完全沒有記錄欄位**：`keys.js` 沒有對應的鍵，
 * 角色的狀態只有「現在是什麼」，沒有「怎麼變成這樣的」。
 *
 * 設計原則：
 * 1. **append-only**。記錄只增不改——這樣它才能當成長履歷與 GM 審卡的依據。
 * 2. **帶前後值**（`changes: [{ field, from, to }]`）。只寫「HP 變成 8」沒有用，
 *    要寫「HP 12 → 8」才知道發生過什麼；這也讓未來的「回溯」有原料。
 * 3. **存在角色物件內**（`character.log`），不另開 storage 鍵——
 *    角色名冊本來就是單一 blob，記錄跟著它走，同步與備份都免費。
 * 4. **種類是封閉詞彙**（`LOG_KINDS`）。沒有登記的 kind 一律拒收，
 *    避免出現只有一處在寫、沒有地方讀得懂的記錄。
 * 5. **連續同值合併**。跑團時 HP 加加減減會產生大量碎記錄，
 *    因此每種 kind 可以宣告 `coalesce` 毫秒數：同一欄位的連續變動在時窗內合併成一筆
 *    （保留最初的 from、最新的 to）。這是「可用的履歷」與「雜訊」的分界。
 *
 * ── 2026-10-30：場次（session）────────────────────────────────
 *
 * 在那之前，履歷是一條沒有分段的長河：摘要只給「累計 EXP／升級次數」，
 * 回答不了「上次那場我們做了什麼」。跑團玩家記得的單位是**場**，不是欄位。
 *
 * 做法是「角色身上掛一個進行中的場次」：
 *   `character.activeSession = { number, startedAt }`（開場時寫入、收場時清空）
 *   `character.sessionCount`（已完成的場次數，收場時遞增）
 * 開場期間寫入的每一筆記錄都會被蓋上 `session: number`；收場時再補一筆 `session`
 * 記錄把這一場收尾。分組只在顯示層做，儲存層仍然是同一條 append-only 陣列——
 * 這樣舊存檔（沒有 activeSession）的行為逐字不變，也不會出現兩份事實。
 *
 * ※ 場次邊界只有桌邊的人知道。App 不猜、不自動開場、不自動收場；
 *   玩家沒按，記錄就全部落在「未分場」那一組。
 */

/** 記錄種類：kind → 顯示與合併策略（封閉詞彙，未登記者一律拒收） */
export const LOG_KINDS = Object.freeze({
  creation: { label: '建卡', icon: 'GiScrollQuill', coalesce: 0 },
  levelup: { label: '等級', icon: 'GiUpCard', coalesce: 60000 },
  skill: { label: '技能', icon: 'GiScrollUnfurled', coalesce: 60000 },
  equipment: { label: '裝備', icon: 'GiChest', coalesce: 0 },
  hp: { label: 'HP', icon: 'GiHealthNormal', coalesce: 120000 },
  mp: { label: 'MP', icon: 'GiLightningTear', coalesce: 120000 },
  ip: { label: 'IP', icon: 'GiBackpack', coalesce: 120000 },
  fp: { label: '物語點', icon: 'GiSparkles', coalesce: 120000 },
  exp: { label: 'EXP', icon: 'GiProgression', coalesce: 120000 },
  zenit: { label: '資金', icon: 'GiTwoCoins', coalesce: 120000 },
  reward: { label: '團務獎勵', icon: 'GiTrophyCup', coalesce: 0 },
  lock: { label: '定稿', icon: 'GiPadlock', coalesce: 0 },
  note: { label: '記事', icon: 'GiQuillInk', coalesce: 0 },
  // ── 2026-10-30 新增：這四種是「長期跑團卡」的核心敘事事件 ──
  // 它們原本完全不在履歷裡（羈絆調整甚至傳了一個不存在的 kind，被靜默拒收）。
  // 一律 `coalesce: 0`：每一次都是獨立事件，合併會吃掉「什麼時候變的」。
  bond: { label: '羈絆', icon: 'GiHeartShield', coalesce: 0 },
  clock: { label: '命刻', icon: 'GiPocketWatch', coalesce: 0 },
  camp: { label: '營地', icon: 'GiCampfire', coalesce: 0 },
  session: { label: '場次', icon: 'GiScrollUnfurled', coalesce: 0 },
  // ── 2026-10-31 新增：擲骰 ──
  // 跑團最高頻的動作，卻一直沒有記錄（`DiceRollerModal` 從建立起零寫回）。
  // 只記大成功／大失敗與玩家手動標記的那幾擲，不是每一擲都記——
  // 全記會把履歷淹掉，那正是 `coalesce` 想解決的同一種雜訊。
  // `coalesce: 0`：兩次擲骰即使相隔 1 秒也是兩件事，合併會吃掉「哪一次大成功」。
  dice: { label: '擲骰', icon: 'GiRollingDices', coalesce: 0 },
  // ── 2026-10-31 新增：交易（P9） ──
  // **`zenit` 與 `trade` 是同一個欄位的兩種語意，不是同一種東西。**
  // `zenit` 是「手動微調錢包」——連按四下 `-1` 是雜訊，合併成一筆才看得下去；
  // `trade` 是「買了一件東西」——每一次都是獨立事件，標題帶品名，
  // 合併會吃掉「我到底買了哪三樣」。
  //
  // 判準與 `dice` 相同：**合併是給雜訊用的，不是給事件用的。**
  // 兩者都寫 `field: 'zenit'` 的 change，所以 `summarizeLog` 的
  // `zenitDelta` 不必改一行——統計看的是欄位，敘事看的是 kind。
  trade: { label: '交易', icon: 'GiTakeMyMoney', coalesce: 0 }
});

/** 欄位顯示名（`formatChange` 用） */
export const LOG_FIELD_LABELS = Object.freeze({
  level: '等級',
  exp: 'EXP',
  zenit: '資金',
  fabulaPoints: '物語點',
  currentHp: 'HP',
  currentMp: 'MP',
  currentIp: 'IP',
  mainHand: '主手',
  offHand: '副手',
  armor: '防具',
  accessory: '飾品',
  classes: '職業',
  spells: '咒語',
  // 開卡規則現在存在角色身上（`char.creationRules`），調整它要留痕——
  // 否則「為什麼這張卡的職業數上限跟別人不一樣」在履歷上查不到
  creationRules: '開卡規則',
  name: '姓名',
  identity: '身分',
  theme: '主題',
  origin: '故鄉',
  quirk: '金手指',
  // 營地活動（自然奇幻手冊 p.130–133）：建角選的兩種與跑團時「本次休息已使用」都會變動，
  // 兩者都是這張卡的決定——沒有標籤的話履歷上只會出現 `[object Object]`。
  campActivities: '營地活動'
});

/** 預設保留的最大條目數（超過時丟棄最舊的） */
export const LOG_LIMIT = 1000;

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const toIso = (value) => {
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return new Date().toISOString();
};

const normalizeChange = (change) => {
  if (!isPlainObject(change) || typeof change.field !== 'string' || !change.field) return null;
  const from = change.from === undefined ? null : change.from;
  const to = change.to === undefined ? null : change.to;
  // 值沒變就不是一次變更
  if (JSON.stringify(from) === JSON.stringify(to)) return null;
  return { field: change.field, from, to };
};

/** 安全讀取記錄（舊存檔沒有這個欄位） */
export const getLog = (character) => (Array.isArray(character?.log) ? character.log : []);

/** 把單一變更寫成人看得懂的一行：「HP 12 → 8」 */
export const formatChange = (change) => {
  if (!change) return '';
  const label = LOG_FIELD_LABELS[change.field]
    || (change.field.startsWith('skill:') ? `【${change.field.slice(6)}】SL` : null)
    // 命刻沒有固定欄位名，欄位本身就是識別字（`clock:傷勢惡化`）。
    // 少了這一段，履歷上會直接印出 `clock:傷勢惡化 2 → 3`。
    || (change.field.startsWith('clock:') ? `命刻【${change.field.slice(6)}】` : null)
    || change.field;
  const show = (v) => {
    if (v === null || v === undefined || v === '') return '（空）';
    if (Array.isArray(v)) return `${v.length} 項`;
    return String(v);
  };
  return `${label} ${show(change.from)} → ${show(change.to)}`;
};

/**
 * 正規化一筆記錄。kind 未登記、或沒有任何變更也沒有標題時回傳 null（拒收）。
 *
 * `session` 是場次編號；由 `appendLog` 依角色當下的 `activeSession` 自動蓋上，
 * 呼叫端通常不需要傳（收場那一筆例外——它要在清掉 activeSession 之後才寫）。
 */
export const createLogEntry = (input = {}, { at } = {}) => {
  if (!isPlainObject(input)) return null;
  const kind = input.kind;
  if (!LOG_KINDS[kind]) return null;

  const changes = (Array.isArray(input.changes) ? input.changes : [])
    .map(normalizeChange)
    .filter(Boolean);

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title && changes.length === 0) return null;

  const session = Number.isInteger(input.session) && input.session > 0 ? input.session : null;

  return {
    id: `log_${Date.parse(toIso(at ?? input.at))}_${Math.random().toString(36).slice(2, 7)}`,
    at: toIso(at ?? input.at),
    kind,
    title: title || changes.map(formatChange).join('、'),
    changes,
    note: typeof input.note === 'string' ? input.note.trim() : '',
    // 沒有場次就不寫這個鍵——舊存檔與「未開場」的記錄形狀保持一致
    ...(session ? { session } : {})
  };
};

/** 兩份物件在指定欄位上的差異（只收真的有變的） */
export const diffFields = (before, after, fields = []) =>
  fields
    .map((field) => normalizeChange({ field, from: before?.[field], to: after?.[field] }))
    .filter(Boolean);

const sameChangeShape = (a, b) =>
  a.length === 1 && b.length === 1 && a[0].field === b[0].field;

/**
 * 追加記錄。回傳**新的角色物件**（不就地修改）。
 *
 * 合併規則：kind 宣告了 `coalesce > 0`、且最後一筆是同 kind、同一個欄位、
 * 兩者時間差在時窗內時，合併成一筆（保留最初的 from、取最新的 to）。
 *
 * 場次蓋章：角色有 `activeSession` 時，沒有指明 `session` 的記錄一律蓋上它的編號。
 * 只蓋「沒有」的——收場那一筆自帶編號，不能被覆寫成 null。
 */
export const appendLog = (character, entryOrEntries, { limit = LOG_LIMIT } = {}) => {
  const incoming = (Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries])
    .filter(Boolean);
  if (incoming.length === 0) return character;

  const log = [...getLog(character)];
  const activeNumber = Number.isInteger(character?.activeSession?.number)
    ? character.activeSession.number
    : null;

  incoming.forEach((raw) => {
    const created = createLogEntry(raw);
    if (!created) return;
    const entry = created.session || activeNumber === null
      ? created
      : { ...created, session: activeNumber };

    const window = LOG_KINDS[entry.kind].coalesce || 0;
    const last = log[log.length - 1];

    if (
      window > 0 &&
      last &&
      last.kind === entry.kind &&
      sameChangeShape(last.changes, entry.changes) &&
      Date.parse(entry.at) - Date.parse(last.at) <= window &&
      Date.parse(entry.at) >= Date.parse(last.at)
    ) {
      log[log.length - 1] = {
        ...last,
        at: entry.at,
        changes: [{ field: last.changes[0].field, from: last.changes[0].from, to: entry.changes[0].to }],
        title: entry.title,
        note: entry.note || last.note
      };
      return;
    }

    log.push(entry);
  });

  const trimmed = log.length > limit ? log.slice(log.length - limit) : log;
  return { ...character, log: trimmed, updatedAt: new Date().toISOString() };
};

/**
 * 一站式：算出變更、寫成一筆記錄、回傳新角色。
 *
 * `changes` 可直接給（值已經被換算過，例如 currentHp 的 null＝滿血）；
 * 否則用 `fields` 自動比對前後物件。
 */
export const loggableChange = (before, after, meta = {}) => {
  const changes = Array.isArray(meta.changes) && meta.changes.length > 0
    ? meta.changes
    : diffFields(before, after, meta.fields || []);

  // 沒有變更、也沒有標題＝什麼都沒發生。
  // 但**有標題就代表呼叫端確定發生了一件事**（例如職業／技能這種陣列變更，
  // 差異寫不成前後值，只留標題）——所以不能只看 changes 是否為空。
  const hasTitle = typeof meta.title === 'string' && meta.title.trim() !== '';
  if (changes.length === 0 && !hasTitle) return after;

  const entry = createLogEntry({
    kind: meta.kind,
    title: meta.title,
    changes,
    note: meta.note,
    at: meta.at,
    session: meta.session
  });
  if (!entry) return after;

  return appendLog(after, entry, { limit: meta.limit });
};

/** 依 kind 篩選（空陣列＝全部） */
export const filterLog = (entries, kinds = []) =>
  kinds.length === 0 ? entries : entries.filter((e) => kinds.includes(e.kind));

/** 時間倒序（顯示用；儲存一律時間正序） */
export const sortLogDesc = (entries) => [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

/**
 * 履歷摘要：條目數、期間、累計 EXP／資金／等級增減。
 * 全部由 `changes` 推導，不額外儲存任何統計欄位（避免兩份事實）。
 */
export const summarizeLog = (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  const sumField = (field) => list.reduce((total, entry) => {
    const change = (entry.changes || []).find((c) => c.field === field);
    if (!change || typeof change.from !== 'number' || typeof change.to !== 'number') return total;
    return total + (change.to - change.from);
  }, 0);

  const times = list.map((e) => Date.parse(e.at)).filter(Number.isFinite);
  const countKind = (kind) => list.filter((e) => e.kind === kind).length;

  return {
    count: list.length,
    firstAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    lastAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    expGained: sumField('exp'),
    zenitDelta: sumField('zenit'),
    levelGained: sumField('level'),
    levelUpCount: countKind('levelup'),
    rewardCount: countKind('reward'),
    equipmentCount: countKind('equipment')
  };
};

/* ─────────────────────────────────────────────────────────────
   場次（session）
   ───────────────────────────────────────────────────────────── */

/** 進行中的場次編號；沒有開場回 null */
export const getSessionNumber = (character) =>
  (Number.isInteger(character?.activeSession?.number) ? character.activeSession.number : null);

/** 已完成的場次數（舊存檔沒有這個欄位 → 0） */
export const getSessionCount = (character) =>
  (Number.isInteger(character?.sessionCount) ? character.sessionCount : 0);

/** 取某一場的所有記錄（時間正序）。`null` ＝ 未分場的那一組 */
export const getSessionEntries = (character, number) => {
  const list = getLog(character);
  if (number === null) return list.filter((e) => !Number.isInteger(e.session));
  return list.filter((e) => e.session === number);
};

/**
 * 一場的摘要。全部由該場的記錄推導——不另存統計欄位（同 `summarizeLog` 的原則）。
 *
 * `hpLost` 取的是「扣血」那一側的絕對值總和：跑團時玩家想知道的是「這一場被打掉多少」，
 * 而不是「HP 淨變化」（補血會把它抵銷成好看的數字）。
 * `clockSteps` 只算正推進，因為命刻只前進不後退（回退是刪掉重畫，那是另一件事）。
 */
export const summarizeSession = (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  const times = list.map((e) => Date.parse(e.at)).filter(Number.isFinite);

  let fpDelta = 0;
  let hpLost = 0;
  let clockSteps = 0;
  let expGained = 0;

  list.forEach((entry) => {
    (entry.changes || []).forEach((c) => {
      if (typeof c.from !== 'number' || typeof c.to !== 'number') return;
      const delta = c.to - c.from;
      if (c.field === 'fabulaPoints') fpDelta += delta;
      if (c.field === 'exp') expGained += delta;
      if (c.field === 'currentHp' && delta < 0) hpLost += -delta;
      if (c.field.startsWith('clock:') && delta > 0) clockSteps += delta;
    });
  });

  return {
    count: list.length,
    firstAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    lastAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    fpDelta,
    hpLost,
    clockSteps,
    expGained,
    bondChanges: list.filter((e) => e.kind === 'bond').length,
    clockEvents: list.filter((e) => e.kind === 'clock').length,
    campCount: list.filter((e) => e.kind === 'camp').length
  };
};

/** 把一場的摘要寫成一句話（收場那一筆的說明欄用） */
export const sessionSummaryText = (summary) => {
  if (!summary || !summary.count) return '這一場沒有留下任何記錄。';
  const parts = [`本場 ${summary.count} 筆`];
  if (summary.expGained) parts.push(`EXP ${summary.expGained > 0 ? '+' : ''}${summary.expGained}`);
  if (summary.fpDelta) parts.push(`物語點 ${summary.fpDelta > 0 ? '+' : ''}${summary.fpDelta}`);
  if (summary.hpLost) parts.push(`受傷 ${summary.hpLost}`);
  if (summary.clockSteps) parts.push(`推進命刻 ${summary.clockSteps} 格`);
  if (summary.bondChanges) parts.push(`羈絆 ${summary.bondChanges} 次`);
  if (summary.campCount) parts.push(`營地 ${summary.campCount} 次`);
  return parts.join(' · ');
};

/**
 * 開場：寫入 `activeSession` 並留下一筆 `session` 記錄。
 *
 * 已經有進行中的場次時**原樣回傳**——不自動開新的。
 * 這條不是防呆，是「場次邊界只有玩家知道」：忘記收場的人不該被 App 偷偷切成兩場。
 */
export const startSession = (character, { at } = {}) => {
  if (!character || character.activeSession) return character;
  const number = getSessionCount(character) + 1;
  const startedAt = toIso(at ?? new Date());
  const opened = {
    ...character,
    activeSession: { number, startedAt },
    updatedAt: startedAt
  };
  return appendLog(opened, createLogEntry({
    kind: 'session',
    title: `第 ${number} 場開始`,
    at: startedAt
  }));
};

/**
 * 收場：補一筆帶摘要的 `session` 記錄，清掉 `activeSession`，場次數 +1。
 *
 * 沒有進行中的場次時原樣回傳（不寫空記錄）。
 */
export const endSession = (character, { at, note } = {}) => {
  const active = character?.activeSession;
  if (!character || !active) return character;
  const number = active.number;
  const endedAt = toIso(at ?? new Date());
  const summary = summarizeSession(getSessionEntries(character, number));
  const auto = sessionSummaryText(summary);
  const playerNote = typeof note === 'string' ? note.trim() : '';
  const closed = {
    ...character,
    activeSession: null,
    sessionCount: Math.max(getSessionCount(character), number),
    updatedAt: endedAt
  };
  return appendLog(closed, createLogEntry({
    kind: 'session',
    title: `第 ${number} 場結束`,
    note: playerNote ? `${auto}　※ ${playerNote}` : auto,
    at: endedAt,
    session: number
  }));
};

/**
 * 把記錄依場次分組（顯示用，新的一場在前；未分場永遠排最後）。
 *
 * 回傳 `[{ number, entries, firstAt, lastAt }]`，`number` 為 `null` ＝ 未分場。
 * 只分組、不改資料——儲存層仍然是同一條 append-only 陣列。
 */
export const groupLogBySession = (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  const buckets = new Map();
  list.forEach((entry) => {
    const key = Number.isInteger(entry.session) ? entry.session : null;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  });
  return [...buckets.entries()]
    .map(([number, group]) => {
      const times = group.map((e) => Date.parse(e.at)).filter(Number.isFinite);
      return {
        number,
        entries: [...group].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
        firstAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
        lastAt: times.length ? new Date(Math.max(...times)).toISOString() : null
      };
    })
    .sort((a, b) => {
      if (a.number === null) return 1;
      if (b.number === null) return -1;
      return b.number - a.number;
    });
};

/** 把 ISO 時間寫成在地的簡短顯示（只到分） */
export const formatLogTime = (iso) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 只到日（場次標頭用） */
export const formatLogDate = (iso) => formatLogTime(iso).slice(0, 10);
