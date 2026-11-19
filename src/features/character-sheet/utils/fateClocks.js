/**
 * 個人命刻純函式模組（W7：命刻改由角色卡 `character.clocks` 持有）
 *
 * 設計規範（docs/plan/07-fateclocks-to-character.md）：
 * 1. **唯一真相在角色卡**：【能言善辯】與所有命刻操作統一改寫 `character.clocks[]`，
 *    不再與獨立 `FateClockPage` 各自維護兩份平行命刻。
 * 2. **不可變、夾邊界、缺欄容忍**：舊存檔中的命刻若缺少 `theme` 或 `type`，
 *    一律於正規化時安全補全（預設 `theme: 'amber'`、`type: 'circle'`）。
 * 3. **履歷一致**：推進／完成／回退／複製一律透過 `loggableChange` 寫入 `kind: 'clock'` 紀錄
 *    （技能如【能言善辯】需把變更合併進 `kind: 'skill'` 單筆履歷時，可傳 `{ skipLog: true }`）。
 */

import { loggableChange } from './characterLog';

const VALID_THEMES = new Set(['amber', 'red', 'blue', 'green', 'purple', 'gray']);
const VALID_TYPES = new Set(['circle', 'line']);

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * 正規化單一命刻物件，補齊缺少欄位並夾制格數與進度。
 */
export function normalizeClock(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const rawTotal = Number(raw.totalSegments);
  const totalSegments = Number.isFinite(rawTotal) ? clamp(Math.floor(rawTotal), 2, 12) : 6;
  const rawFilled = Number(raw.filledSegments);
  const filledSegments = Number.isFinite(rawFilled) ? clamp(Math.floor(rawFilled), 0, totalSegments) : 0;

  const rawTheme = raw.theme === 'emerald' ? 'green' : raw.theme;
  const theme = VALID_THEMES.has(rawTheme) ? rawTheme : 'amber';
  const type = VALID_TYPES.has(raw.type) ? raw.type : 'circle';
  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : `clk_${Date.now()}_${idx}`;
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim()
    : '未命名命刻';

  return {
    ...raw,
    id,
    title,
    totalSegments,
    filledSegments,
    theme,
    type
  };
}

/**
 * 將任意輸入正規化為乾淨的命刻陣列（缺值／非陣列一律回 []）。
 */
export function normalizeClocks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => normalizeClock(item, idx)).filter(Boolean);
}

/**
 * 依 `clockId` 查找角色身上的個人命刻（找不到回 `null`）。
 */
export function findClock(character, clockId) {
  if (!character || !clockId) return null;
  return normalizeClocks(character.clocks).find((c) => c.id === clockId) || null;
}

/**
 * 回傳角色目前已填滿（`filledSegments >= totalSegments`）的個人命刻清單。
 */
export function fullClocks(character) {
  return normalizeClocks(character?.clocks).filter((c) => c.filledSegments >= c.totalSegments);
}

/**
 * 將指定命刻的已填格數設為 `filled`（夾在 `0..totalSegments`），回傳不可變新角色物件。
 * 找不到 `clockId` 或數值無變化時，原樣回傳同一參考（不新增、不拋錯）。
 */
export function setClockSegments(character, clockId, filled, { skipLog = false } = {}) {
  if (!character || typeof character !== 'object' || !clockId) return character;
  const existing = Array.isArray(character.clocks) ? character.clocks : [];
  const targetIdx = existing.findIndex((c) => c && c.id === clockId);
  if (targetIdx < 0) return character;

  const current = normalizeClock(existing[targetIdx], targetIdx);
  if (!current) return character;

  const targetVal = Number(filled);
  const clamped = Number.isFinite(targetVal)
    ? clamp(Math.floor(targetVal), 0, current.totalSegments)
    : current.filledSegments;

  if (clamped === current.filledSegments) return character;

  const updatedClock = { ...current, filledSegments: clamped };
  const nextClocks = existing.map((c, idx) => (idx === targetIdx ? updatedClock : c));

  const nextBase = {
    ...character,
    clocks: nextClocks,
    updatedAt: new Date().toISOString()
  };

  if (skipLog) return nextBase;

  const title = clamped >= current.totalSegments
    ? `命刻【${current.title}】完成`
    : `命刻【${current.title}】${clamped > current.filledSegments ? '推進' : '回退'}`;

  return loggableChange(character, nextBase, {
    kind: 'clock',
    title,
    changes: [{ field: `clock:${current.title}`, from: current.filledSegments, to: clamped }]
  });
}

/**
 * 將指定命刻依 `delta` 推進或回退格數（支援正數與負數，夾在 `0..totalSegments`）。
 */
export function addClockSegments(character, clockId, delta = 1, options = {}) {
  const current = findClock(character, clockId);
  if (!current) return character;
  const step = Number(delta);
  if (!Number.isFinite(step) || step === 0) return character;
  return setClockSegments(character, clockId, current.filledSegments + Math.trunc(step), options);
}

/**
 * 將舊「命刻記錄」頁面的單顆命刻複製進指定角色卡（一律重新產生不撞號的 `id`，不覆蓋既有命刻）。
 */
export function copyClockToCharacter(character, sourceClock) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的目標角色' };
  }
  const normalized = normalizeClock(sourceClock);
  if (!normalized) {
    return { ok: false, character, reason: '無效的來源命刻資料' };
  }

  const existing = Array.isArray(character.clocks) ? character.clocks : [];
  const usedIds = new Set(existing.map((c) => c?.id).filter(Boolean));
  let newId = `clk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let guard = 0;
  while (usedIds.has(newId) && guard < 10) {
    newId = `clk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${guard}`;
    guard += 1;
  }

  const copied = {
    ...normalized,
    id: newId
  };

  const nextBase = {
    ...character,
    clocks: [...existing, copied],
    updatedAt: new Date().toISOString()
  };

  const logged = loggableChange(character, nextBase, {
    kind: 'clock',
    title: `由命刻記錄複製個人命刻【${copied.title}】`
  });

  return {
    ok: true,
    character: logged,
    clock: copied
  };
}
