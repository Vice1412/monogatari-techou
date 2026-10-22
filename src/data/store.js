/**
 * 單一儲存存取層。
 *
 * 目的：全站所有持久化狀態只經過這裡。呼叫端不再直接碰 localStorage。
 *
 * 為什麼要收斂（2026-10-04 建立）：
 * 連線房間同步的作用是「攔截所有狀態變更並轉發給其他玩家」。
 * 若狀態仍由 5 個檔案各自直接寫入 localStorage（`activeCombat` 就是如此），
 * 同步層必須與這 5 個寫入點逐一打架。收斂成單一入口後，未來只要在
 * `writeJSON` 加一個轉發鉤子，就能接上遠端同步，不必改動任何呼叫端。
 *
 * 設計取捨：
 * - 提供 `subscribe`：**目前沒有任何生產端呼叫端**（2026-10-16 實測；只有
 *   `tests/dataLayer.test.mjs` 覆蓋它）。它是為「未來接上遠端快照套用」預留的掛鉤，
 *   不是已實作的功能——不要把它當成跨分頁同步已經做好了。跨分頁需另接 `storage` 事件。
 * - 儲存後端可抽換：Node 測試環境沒有 localStorage，故內建記憶體後備。
 */

import { STORAGE_KEYS, LEGACY_KEYS } from './keys.js';

// ── 儲存後端 ────────────────────────────────────────────────

/** 記憶體後備：Node 測試與無 localStorage 環境使用。 */
const createMemoryBackend = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
};

const pickDefaultBackend = () => {
  try {
    const ls = globalThis.localStorage;
    if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') return ls;
  } catch (e) {
    // 無 localStorage（Node／SSR／隱私模式），改用記憶體後備
  }
  return createMemoryBackend();
};

let backend = pickDefaultBackend();

/** 測試用：替換儲存後端。傳入 null 可還原為預設後端。 */
export const __setStorageBackend = (next) => { backend = next || pickDefaultBackend(); };

// ── 變更訂閱 ────────────────────────────────────────────────

const listeners = new Map(); // key -> Set<listener>

const emit = (key, value) => {
  const set = listeners.get(key);
  if (!set || set.size === 0) return;
  // 複製一份再走訪，避免 listener 在回呼中退訂造成走訪中變動
  Array.from(set).forEach((fn) => {
    try { fn(value, key); } catch (e) { console.error(`store 訂閱者發生例外（${key}）:`, e); }
  });
};

/**
 * 訂閱某個鍵的變更。回傳退訂函式。
 *
 * ※ 現況（2026-10-16 實測）：**生產端 0 個呼叫端**，只有測試在用。
 * 因此「跨分頁同步」「遠端快照套用」都**尚未實作**——這裡只是預留的掛鉤。
 * 另外注意：目前只涵蓋「同一個分頁內」的寫入，跨分頁需另接 `storage` 事件。
 */
export const subscribe = (key, fn) => {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => { listeners.get(key)?.delete(fn); };
};

// ── 基本讀寫 ────────────────────────────────────────────────

/** 讀取原始字串。讀不到或後端拋錯時一律回傳 null。 */
export const readRaw = (key) => {
  try { return backend.getItem(key); } catch (e) { return null; }
};

/**
 * 讀取並解析 JSON。
 * 空值、解析失敗、null 都回傳 `fallback`，讓呼叫端不必再包 try/catch。
 */
export const readJSON = (key, fallback = null) => {
  const raw = readRaw(key);
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    console.error(`store 解析失敗（${key}）:`, e);
    return fallback;
  }
};

/** 寫入 JSON 並通知訂閱者。回傳是否成功。 */
export const writeJSON = (key, value) => {
  try {
    backend.setItem(key, JSON.stringify(value));
    emit(key, value);
    return true;
  } catch (e) {
    // 配額爆掉（QuotaExceededError）最常見，例如角色頭像存成 base64
    console.error(`store 寫入失敗（${key}）:`, e);
    return false;
  }
};

/**
 * 寫入原始字串（不經 JSON 編碼）。
 *
 * 供「本來就存純字串」的鍵使用 —— 例如卡片配色（`'amber'`）與音效開關（`'true'`）。
 * 這些鍵若改用 `writeJSON` 會被包成 `'"amber"'`，而讀取端若用 `readJSON` 對
 * 既有資料解析則會直接失敗。兩種格式必須涇渭分明，故本層同時提供兩組 API。
 */
export const writeRaw = (key, value) => {
  try {
    backend.setItem(key, String(value));
    emit(key, value);
    return true;
  } catch (e) {
    console.error(`store 寫入失敗（${key}）:`, e);
    return false;
  }
};

/** 移除單一鍵。 */
export const removeKey = (key) => {
  try {
    backend.removeItem(key);
    emit(key, null);
    return true;
  } catch (e) {
    console.error(`store 移除失敗（${key}）:`, e);
    return false;
  }
};

/**
 * 清空全部鍵。語意等同原本的 localStorage.clear()。
 *
 * ※ **這是不可逆的資料破壞操作**：它會連 `LEGACY_KEYS` 一起清掉，因此
 * 「舊鍵永不刪除、遷移完全可逆」的保證在呼叫它之後不再成立。
 * 現況（2026-10-16）：生產端 **0 個呼叫端**——原本唯一的使用者是
 * `ErrorBoundary` 的 `handleHardReset`，該函式因文案誤導（只寫「清除暫存」，
 * 實際會刪光角色名冊與 NPC 檔案庫）已於同日移除。
 * 本函式保留給測試與未來的「使用者明確要求重置全部資料」流程使用；
 * **任何要接上 UI 的用法都必須先列出會被刪除的資料並要求二次確認。**
 */
export const clearAll = () => {
  try {
    const keys = [];
    for (let i = 0; i < backend.length; i += 1) {
      const k = backend.key(i);
      if (k !== null && k !== undefined) keys.push(k);
    }
    keys.forEach((k) => backend.removeItem(k));
    return true;
  } catch (e) {
    console.error('store 清空失敗:', e);
    return false;
  }
};

// ── 一次性舊鍵遷移 ──────────────────────────────────────────

/**
 * 遷移計畫：權威鍵 → 依優先序排列的來源舊鍵。
 *
 * `format` 決定要不要驗證內容：
 *   - `'json'`：內容必須能通過 `JSON.parse` 才搬移（避免把壞資料升級成權威資料）。
 *   - `'raw'` ：內容本來就是純字串（`'true'`／`'amber'`），**不可**用 JSON 驗證——
 *     否則 `amber` 會被判為壞資料而**靜默不搬**，等於使用者設定消失。
 *     （`npcCardTheme` 與 `soundEnabled` 就是這一類，見 `docs/decisions.md` §L2。）
 *
 * ※ 來源順序＝優先序，**最新的世代排最前面**。以 NPC 檔案庫為例：
 *   世代 2 的 `fu_companion_npc_library` 才是 2026-10-04 之後真正被寫入的鍵，
 *   世代 1 的 `fabula-npc-library-v2` 在更名後就不再更新（內容可能較舊）。
 */
const MIGRATION_PLAN = Object.freeze([
  {
    canonical: STORAGE_KEYS.npcLibrary,
    sources: [LEGACY_KEYS.npcLibraryLegacy, LEGACY_KEYS.npcLibraryV2, LEGACY_KEYS.npcLibraryStray],
    format: 'json',
  },
  { canonical: STORAGE_KEYS.characterRoster, sources: [LEGACY_KEYS.characterRosterLegacy], format: 'json' },
  { canonical: STORAGE_KEYS.activeCombat, sources: [LEGACY_KEYS.activeCombatLegacy], format: 'json' },
  { canonical: STORAGE_KEYS.fateClocks, sources: [LEGACY_KEYS.fateClocksLegacy], format: 'json' },
  { canonical: STORAGE_KEYS.soundEnabled, sources: [LEGACY_KEYS.soundEnabledLegacy], format: 'raw' },
  { canonical: STORAGE_KEYS.characterTheme, sources: [LEGACY_KEYS.characterThemeLegacy], format: 'raw' },
  {
    canonical: STORAGE_KEYS.npcCardTheme,
    sources: [LEGACY_KEYS.npcCardThemeLegacy, LEGACY_KEYS.npcCardThemeV1],
    format: 'raw',
  },
]);

/**
 * 把舊鍵的內容搬到權威鍵。
 *
 * 策略（刻意保守，因為這是使用者資料）：
 *   1. 權威鍵**已有內容**時一律跳過，絕不覆寫。
 *   2. 只在權威鍵為空時，才從舊鍵複製。
 *   3. 舊鍵**永不刪除** —— 因此本操作完全可逆。
 *   4. `json` 格式的內容必須能通過 `JSON.parse` 才會搬移，避免把壞資料升級成權威資料。
 *
 * 可重複執行（idempotent）：跑第二次不會有任何副作用。
 *
 * ※ 2026-10-16 起涵蓋全部 7 個權威鍵（前綴由 `fu_companion_` 改為 `monogatari_techou_`），
 *   不再只有 NPC 檔案庫。`LEGACY_KEYS.creationRulesCampaign` 刻意不在計畫內——
 *   它沒有任何寫入端，本來就是空的。
 *   `STORAGE_KEYS.npcDraft`（2026-10-22 新增）同樣不在計畫內：它是全新的寫入端，
 *   **沒有前身可搬**，登記在計畫裡只會讓「每個權威鍵都有舊鍵」這條護欄變成假的。
 *
 * @returns {{migrated: Array<{canonical:string, from:string}>, skipped: string[], empty: string[]}}
 *   回傳報告而非只做事，是為了讓它能在 Node 中被測試。
 */
export const migrateLegacyStorage = () => {
  const report = { migrated: [], skipped: [], empty: [] };

  const isBlank = (v) => v === null || v === undefined || v === '';

  const migrateKey = (canonical, legacyKeys, format) => {
    if (!isBlank(readRaw(canonical))) {
      report.skipped.push(canonical);
      return;
    }
    const source = legacyKeys.find((k) => !isBlank(readRaw(k)));
    if (!source) {
      report.empty.push(canonical);
      return;
    }
    const raw = readRaw(source);
    if (format === 'json') {
      try {
        JSON.parse(raw);
      } catch (e) {
        // 不靜默：壞掉的舊資料會讓使用者看到「資料不見了」，這裡留下線索供排障。
        console.error(`store 遷移跳過（來源 ${source} 無法解析為 JSON）:`, e);
        report.skipped.push(`${canonical}（來源 ${source} 無法解析）`);
        return;
      }
    }
    try {
      backend.setItem(canonical, raw);
      report.migrated.push({ canonical, from: source });
    } catch (e) {
      console.error(`store 遷移寫入失敗（${canonical}）:`, e);
      report.skipped.push(`${canonical}（寫入失敗）`);
    }
  };

  MIGRATION_PLAN.forEach(({ canonical, sources, format }) => migrateKey(canonical, sources, format));

  return report;
};

