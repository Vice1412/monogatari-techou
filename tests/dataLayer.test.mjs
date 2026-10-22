/**
 * 資料層測試（階段 0）。
 *
 * 執行：npm run test:datalayer
 *
 * 涵蓋三個模組：
 * - `src/data/keys.js`    鍵註冊表
 * - `src/data/store.js`   單一存取層與舊鍵遷移
 * - `shared/schema.js`    房間同步契約
 *
 * 這裡最重要的是 D 區段（遷移）與 F 區段（同步邊界）。
 * 遷移會動到使用者的 NPC 檔案庫，所以每一條安全保證都必須被斷言；
 * 同步邊界則決定了未來免費額度會不會爆掉。
 */
import { STORAGE_KEYS, LEGACY_KEYS, ALL_STORAGE_KEYS } from '../src/data/keys.js';
import {
  __setStorageBackend,
  readRaw,
  writeRaw,
  readJSON,
  writeJSON,
  removeKey,
  clearAll,
  subscribe,
  migrateLegacyStorage,
} from '../src/data/store.js';
import {
  SCHEMA_VERSION,
  ROOM_MESSAGE_TYPES,
  ROOM_ROLES,
  isGmOnlyType,
  clampResource,
  applyResourceDelta,
  toCombatantSnapshot,
  createEmptyRoomState,
  createReward,
} from '../shared/schema.js';

let pass = 0;
let fail = 0;
const lines = [];

/**
 * 正規化：遞迴排序物件鍵，但**保留陣列順序**。
 *
 * 為什麼不直接用 JSON.stringify 比較：JS 物件的鍵序不具語意，卻會被
 * JSON.stringify 忠實反映。例如 `applyResourceDelta({max:10}, -3)` 回傳的是
 * `{max:10, current:7}`，而 `{current:7, max:10}` 是同一件事。用鍵序比較會
 * 讓測試因為無關緊要的細節而失敗，也會掩蓋真正該抓的差異。
 * 陣列順序**有**語意，故不排序。
 */
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc, k) => { acc[k] = canon(v[k]); return acc; }, {});
  }
  return v;
};

const check = (label, actual, expected) => {
  const ok = JSON.stringify(canon(actual)) === JSON.stringify(canon(expected));
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};
const section = (t) => lines.push(`\n=== ${t} ===`);

/** 建一個乾淨的模擬後端。 */
const mockBackend = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    dump: () => Object.fromEntries(map),
  };
};

/** 每個區段開頭重設後端，避免互相污染。 */
const reset = (initial = {}) => {
  const b = mockBackend(initial);
  __setStorageBackend(b);
  return b;
};

// ─────────────────────────────────────────────────────────── A
section('A. 鍵註冊表完整性');
{
  const values = Object.values(STORAGE_KEYS);
  check('每個權威鍵都是非空字串', values.every((v) => typeof v === 'string' && v.length > 0), true);
  check('權威鍵之間無重複', new Set(values).size, values.length);

  const legacyValues = Object.values(LEGACY_KEYS);
  check('每個舊鍵都是非空字串', legacyValues.every((v) => typeof v === 'string' && v.length > 0), true);
  check('舊鍵之間無重複', new Set(legacyValues).size, legacyValues.length);

  // 舊鍵與權威鍵不得共用同一個字串，否則遷移邏輯會自我覆寫
  const overlap = values.filter((v) => legacyValues.includes(v));
  check('舊鍵與權威鍵無交集', overlap, []);

  check('ALL_STORAGE_KEYS 為兩者聯集', ALL_STORAGE_KEYS.length, values.length + legacyValues.length);

  // 這三條是本次修 bug 的核心：NPC 檔案庫只能有一個權威鍵
  check('NPC 檔案庫權威鍵', STORAGE_KEYS.npcLibrary, 'monogatari_techou_npc_library');
  check('NPC 工坊舊鍵仍登記為舊鍵', LEGACY_KEYS.npcLibraryV2, 'fabula-npc-library-v2');
  check('死鍵仍登記為舊鍵', LEGACY_KEYS.npcLibraryStray, 'fu_npc_library');

  // ── 2026-10-16 前綴更名（fu_companion_ → monogatari_techou_）的護欄 ──
  // 這一組是「舊名不得再出現在權威鍵上」的機器守門人，取代過去的人工檢查。
  const DEPRECATED_PREFIX = 'fu_companion_';
  check('所有權威鍵都使用新前綴', values.every((v) => v.startsWith('monogatari_techou_')), true);
  check('權威鍵不得含舊前綴', values.filter((v) => v.includes(DEPRECATED_PREFIX)), []);
  check('權威鍵不得含 fabula 字樣（授權 §8 禁止語）', values.filter((v) => /fabula/i.test(v)), []);

  // 世代 2 的 6 個舊鍵必須全部登記，否則使用者資料會被留在無人讀取的抽屜裡
  const GEN2_LEGACY = [
    LEGACY_KEYS.npcLibraryLegacy,
    LEGACY_KEYS.characterRosterLegacy,
    LEGACY_KEYS.activeCombatLegacy,
    LEGACY_KEYS.fateClocksLegacy,
    LEGACY_KEYS.soundEnabledLegacy,
    LEGACY_KEYS.characterThemeLegacy,
  ];
  check('世代 2 的 6 個舊鍵全部登記', GEN2_LEGACY.every((k) => typeof k === 'string' && k.startsWith(DEPRECATED_PREFIX)), true);
  check('世代 2 舊鍵之間無重複', new Set(GEN2_LEGACY).size, 6);
  // 世代 2 舊鍵與權威鍵的對應關係。扣掉的兩個是**本來就沒有世代 2 舊鍵**的鍵：
  //   - `npcCardTheme`：舊鍵是 `fabula-npc-card-theme`（世代 1）
  //   - `npcDraft`（2026-10-22 新增）：全新寫入端，沒有任何前身
  check('世代 2 舊鍵與權威鍵一對一對應', GEN2_LEGACY.length, values.length - 2);

  // 每一個「由舊鍵更名而來」的權威鍵都必須有對應的舊鍵可遷移（否則更名等於直接刪資料）。
  // `npcDraft` 不在此列：它是 2026-10-22 新增的鍵，不是任何舊鍵的新名字。
  const CANONICAL_WITH_LEGACY = [
    STORAGE_KEYS.npcLibrary,
    STORAGE_KEYS.characterRoster,
    STORAGE_KEYS.activeCombat,
    STORAGE_KEYS.fateClocks,
    STORAGE_KEYS.soundEnabled,
    STORAGE_KEYS.characterTheme,
    STORAGE_KEYS.npcCardTheme,
  ];
  check('7 個由更名而來的權威鍵全部列入遷移計畫', CANONICAL_WITH_LEGACY.length, values.length - 1);
  check('npcDraft 沒有任何舊鍵（全新寫入端）', CANONICAL_WITH_LEGACY.includes(STORAGE_KEYS.npcDraft), false);
  check('NPC 卡片配色舊鍵（世代 2）', LEGACY_KEYS.npcCardThemeLegacy, 'fabula-npc-card-theme');
  check('NPC 卡片配色舊鍵（世代 1）', LEGACY_KEYS.npcCardThemeV1, 'fabula-npc-theme');
}

// ─────────────────────────────────────────────────────────── B
section('B. 存取層基本讀寫');
{
  reset();
  check('讀不存在的鍵 -> fallback', readJSON('nothing', 'fb'), 'fb');
  check('讀不存在的原始鍵 -> null', readRaw('nothing'), null);

  writeJSON('k1', { a: 1 });
  check('JSON 往返', readJSON('k1', null), { a: 1 });
  check('原始字串可見 JSON 編碼', readRaw('k1'), '{"a":1}');

  writeRaw('k2', 'amber');
  check('原始字串往返', readRaw('k2'), 'amber');
  check('原始字串以 writeJSON 讀會回退', readJSON('k2', 'fb'), 'fb');

  writeJSON('k3', [1, 2, 3]);
  check('陣列往返', readJSON('k3', null), [1, 2, 3]);

  check('空字串視為無值 -> fallback', (() => { writeRaw('k4', ''); return readJSON('k4', 'fb'); })(), 'fb');

  check('寫入回傳 true', writeJSON('k5', 1), true);
  removeKey('k5');
  check('移除後讀不到', readRaw('k5'), null);
}

// ─────────────────────────────────────────────────────────── C
section('C. 壞資料不得讓程式崩潰');
{
  reset({ broken: '{不是合法 JSON', nullish: 'null', arr: '[]' });
  check('損壞 JSON -> fallback', readJSON('broken', 'fb'), 'fb');
  check('字面 null -> fallback', readJSON('nullish', 'fb'), 'fb');
  check('空陣列是合法值', readJSON('arr', 'fb'), []);

  const b = reset({ a: '1', b: '2', c: '3' });
  check('clearAll 清空全部鍵', (() => { clearAll(); return b.length; })(), 0);

  // 訂閱：寫入要通知、退訂後不再通知
  reset();
  let seen = null;
  const off = subscribe('sub', (v) => { seen = v; });
  writeJSON('sub', { n: 1 });
  check('訂閱者收到寫入', seen, { n: 1 });
  off();
  seen = null;
  writeJSON('sub', { n: 2 });
  check('退訂後不再收到', seen, null);

  // 訂閱者拋錯不得中斷寫入
  reset();
  subscribe('boom', () => { throw new Error('listener 壞了'); });
  check('訂閱者拋錯時寫入仍成功', writeJSON('boom', 1), true);
}

// ─────────────────────────────────────────────────────────── D
section('D. 舊鍵遷移（動到使用者資料，每一條安全保證都必須被斷言）');
{
  // D1 舊鍵有資料、權威鍵為空 -> 搬移
  let b = reset({ [LEGACY_KEYS.npcLibraryLegacy]: '[{"id":"npc1"}]' });
  let rep = migrateLegacyStorage();
  check('D1 回報已遷移', rep.migrated, [{ canonical: STORAGE_KEYS.npcLibrary, from: LEGACY_KEYS.npcLibraryLegacy }]);
  check('D1 權威鍵取得內容', readJSON(STORAGE_KEYS.npcLibrary, null), [{ id: 'npc1' }]);
  check('D1 舊鍵未被刪除（可逆）', readRaw(LEGACY_KEYS.npcLibraryLegacy), '[{"id":"npc1"}]');

  // D2 權威鍵已有資料 -> 絕不覆寫
  b = reset({
    [STORAGE_KEYS.npcLibrary]: '[{"id":"new"}]',
    [LEGACY_KEYS.npcLibraryLegacy]: '[{"id":"old"}]',
  });
  rep = migrateLegacyStorage();
  check('D2 回報跳過', rep.skipped, [STORAGE_KEYS.npcLibrary]);
  check('D2 權威鍵內容未被覆寫', readJSON(STORAGE_KEYS.npcLibrary, null), [{ id: 'new' }]);
  check('D2 未誤報遷移', rep.migrated.length, 0);

  // D3 兩邊都空 -> 什麼都不做（7 個權威鍵全部回報 empty）
  reset();
  rep = migrateLegacyStorage();
  check('D3 七個鍵全部回報 empty', rep.empty.length, 7);
  check('D3 未產生權威鍵', readRaw(STORAGE_KEYS.npcLibrary), null);

  // D4 舊鍵內容損壞 -> 不升級成權威資料
  reset({ [LEGACY_KEYS.npcLibraryLegacy]: '{壞掉的' });
  rep = migrateLegacyStorage();
  check('D4 未遷移', rep.migrated.length, 0);
  check('D4 權威鍵仍為空', readRaw(STORAGE_KEYS.npcLibrary), null);
  check('D4 有記錄跳過原因', rep.skipped.length, 1);

  // D5 死鍵可作為次要來源
  reset({ [LEGACY_KEYS.npcLibraryStray]: '[{"id":"stray"}]' });
  rep = migrateLegacyStorage();
  check('D5 從死鍵遷移', rep.migrated, [{ canonical: STORAGE_KEYS.npcLibrary, from: LEGACY_KEYS.npcLibraryStray }]);

  // D6 冪等：連跑兩次不得有副作用
  b = reset({ [LEGACY_KEYS.npcLibraryLegacy]: '[{"id":"npc1"}]' });
  migrateLegacyStorage();
  const afterFirst = readRaw(STORAGE_KEYS.npcLibrary);
  const rep2 = migrateLegacyStorage();
  check('D6 第二次執行沒有任何遷移', rep2.migrated.length, 0);
  check('D6 第二次執行把已遷移的鍵列為跳過', rep2.skipped, [STORAGE_KEYS.npcLibrary]);
  check('D6 第二次執行未改變內容', readRaw(STORAGE_KEYS.npcLibrary), afterFirst);

  // D7 遷移優先取較新的舊鍵（世代 2 勝過世代 1）
  reset({
    [LEGACY_KEYS.npcLibraryLegacy]: '[{"id":"gen2"}]',
    [LEGACY_KEYS.npcLibraryV2]: '[{"id":"gen1"}]',
    [LEGACY_KEYS.npcLibraryStray]: '[{"id":"stray"}]',
  });
  rep = migrateLegacyStorage();
  check('D7 優先來源為世代 2', rep.migrated[0].from, LEGACY_KEYS.npcLibraryLegacy);

  // D8 世代 2 不存在時，世代 1 仍可作為來源
  reset({
    [LEGACY_KEYS.npcLibraryV2]: '[{"id":"gen1"}]',
    [LEGACY_KEYS.npcLibraryStray]: '[{"id":"stray"}]',
  });
  rep = migrateLegacyStorage();
  check('D8 世代 1 可作為來源', rep.migrated[0].from, LEGACY_KEYS.npcLibraryV2);

  // ── D9 起：2026-10-16 前綴更名（fu_companion_ → monogatari_techou_）新增的覆蓋 ──
  // 這是本次最危險的一步：7 個權威鍵同時換名。以下幾條確保「沒有任何一個鍵漏掉」。

  // D9 全部 7 個舊鍵都有資料時，7 個權威鍵都必須被搬移
  const ALL_GEN2_SEED = {
    [LEGACY_KEYS.npcLibraryLegacy]: '[]',
    [LEGACY_KEYS.characterRosterLegacy]: '[]',
    [LEGACY_KEYS.activeCombatLegacy]: '{}',
    [LEGACY_KEYS.fateClocksLegacy]: '[]',
    [LEGACY_KEYS.soundEnabledLegacy]: 'true',
    [LEGACY_KEYS.characterThemeLegacy]: 'amber',
    [LEGACY_KEYS.npcCardThemeLegacy]: 'amber',
  };
  reset(ALL_GEN2_SEED);
  rep = migrateLegacyStorage();
  check('D9 七個權威鍵全部遷移', rep.migrated.length, 7);
  check('D9 沒有任何鍵被跳過', rep.skipped, []);
  check('D9 沒有空的鍵', rep.empty, []);

  // D10 原始字串鍵不得被 JSON 驗證擋下（'amber' 不是合法 JSON）
  reset({ [LEGACY_KEYS.characterThemeLegacy]: 'amber' });
  rep = migrateLegacyStorage();
  check('D10 原始字串鍵成功遷移', readRaw(STORAGE_KEYS.characterTheme), 'amber');
  check('D10 未被誤判為壞資料', rep.skipped, []);

  reset({ [LEGACY_KEYS.soundEnabledLegacy]: 'false' });
  migrateLegacyStorage();
  check('D10 音效開關遷移', readRaw(STORAGE_KEYS.soundEnabled), 'false');

  // D11 NPC 卡片配色：世代 2 優先，世代 1 可退回
  reset({ [LEGACY_KEYS.npcCardThemeLegacy]: 'forest', [LEGACY_KEYS.npcCardThemeV1]: 'amber' });
  migrateLegacyStorage();
  check('D11 配色優先取世代 2', readRaw(STORAGE_KEYS.npcCardTheme), 'forest');

  reset({ [LEGACY_KEYS.npcCardThemeV1]: 'amber' });
  migrateLegacyStorage();
  check('D11 配色可退回世代 1', readRaw(STORAGE_KEYS.npcCardTheme), 'amber');

  // D12 某一個鍵壞掉不得拖累其他鍵
  reset({
    [LEGACY_KEYS.npcLibraryLegacy]: '{壞掉的',
    [LEGACY_KEYS.characterRosterLegacy]: '[{"id":"c1"}]',
  });
  rep = migrateLegacyStorage();
  check('D12 壞掉的鍵被跳過', rep.skipped, [`${STORAGE_KEYS.npcLibrary}（來源 ${LEGACY_KEYS.npcLibraryLegacy} 無法解析）`]);
  check('D12 其他鍵仍完成遷移', readJSON(STORAGE_KEYS.characterRoster, null), [{ id: 'c1' }]);

  // D13 舊鍵永不刪除 → 完全可逆（這是「更名不會害使用者掉資料」的最強保證）
  b = reset(ALL_GEN2_SEED);
  const beforeDump = b.dump();
  migrateLegacyStorage();
  const afterDump = b.dump();
  const legacyStillThere = Object.values(LEGACY_KEYS).every(
    (k) => !(k in beforeDump) || afterDump[k] === beforeDump[k]
  );
  check('D13 遷移後舊鍵的值一字未改', legacyStillThere, true);
  check('D13 七個舊鍵仍在', Object.values(LEGACY_KEYS).filter((k) => k in afterDump).length, 7);
  check('D13 七個新鍵已產生', Object.values(STORAGE_KEYS).filter((k) => k in afterDump).length, 7);
}

// ─────────────────────────────────────────────────────────── E
section('E. 資源夾值（伺服器與前端共用，兩邊必須算出同一結果）');
{
  check('一般夾值', clampResource(7, 10), 7);
  check('超過上限 -> 上限', clampResource(99, 10), 10);
  check('負數 -> 0', clampResource(-5, 10), 0);
  check('非數字 -> 0', clampResource('abc', 10), 0);
  check('max 非數字 -> 0', clampResource(5, 'abc'), 0);
  check('max 為 0 -> 0', clampResource(5, 0), 0);
  check('字串數字可解析', clampResource('8', 10), 8);
  check('小數無條件捨去', clampResource(7.9, 10), 7);

  check('增量：正常', applyResourceDelta({ current: 5, max: 10 }, 3), { current: 8, max: 10 });
  check('增量：夾到上限', applyResourceDelta({ current: 5, max: 10 }, 99), { current: 10, max: 10 });
  check('增量：夾到 0', applyResourceDelta({ current: 5, max: 10 }, -99), { current: 0, max: 10 });
  check('增量：current 缺值時以 max 為起點', applyResourceDelta({ max: 10 }, -3), { current: 7, max: 10 });
  check('增量：非數字視為 0', applyResourceDelta({ current: 5, max: 10 }, 'x'), { current: 5, max: 10 });
}

// ─────────────────────────────────────────────────────────── F
section('F. 同步邊界：哪些欄位可以進廣播');
{
  const character = {
    instanceId: 'comb_1',
    sourceId: 'char_1',
    sourceType: 'character',
    name: '卡蜜拉',
    faction: '玩家隊伍',
    level: 5,
    avatar: 'data:image/png;base64,' + 'A'.repeat(5000),
    hp: { current: 40, max: 40, crisisThreshold: 20 },
    mp: { current: 50, max: 50 },
    ip: { current: 6, max: 6 },
    attributes: { dex: 8, ins: 10, mig: 6, wlp: 8 },
    defense: 8,
    magicDefense: 10,
    initiative: 0,
    hasActed: false,
    statusEffects: { slow: false },
    skills: [{ id: 's1', name: '鐵壁 (SL 3)' }],
    rawCharData: { 大物件: 'A'.repeat(5000) },
  };

  const snap = toCombatantSnapshot(character);
  check('保留 instanceId', snap.instanceId, 'comb_1');
  check('保留 HP', snap.hp, { current: 40, max: 40, crisisThreshold: 20 });
  check('保留 MP', snap.mp, { current: 50, max: 50 });
  check('玩家角色保留 IP', snap.ip, { current: 6, max: 6 });

  // 這是本區段存在的理由：體積最大的欄位必須被剝掉
  check('剝除 skills', 'skills' in snap, false);
  check('剝除 rawCharData', 'rawCharData' in snap, false);
  check('剝除 avatar', 'avatar' in snap, false);

  const npc = {
    instanceId: 'comb_2',
    sourceType: 'npc',
    name: '哥布林',
    hp: { current: 30, max: 30 },
    mp: { current: 10, max: 10 },
    statusEffects: {},
  };
  const npcSnap = toCombatantSnapshot(npc);
  check('NPC 無 IP 時為 null（官方規則中 NPC 不持有 IP）', npcSnap.ip, null);
  check('NPC 危機值自動補算為半血', npcSnap.hp.crisisThreshold, 15);
  check('NPC 預設陣營為敵方', npcSnap.faction, '敵方');
  check('NPC 預設 hasActed 為 false', npcSnap.hasActed, false);

  check('current 超過 max 時夾住', toCombatantSnapshot({ hp: { current: 999, max: 40 }, mp: {} }).hp.current, 40);
  check('空輸入回傳 null', toCombatantSnapshot(null), null);
  check('ownerPeerId 預設為 null', snap.ownerPeerId, null);
}

// ─────────────────────────────────────────────────────────── G
section('G. 房間契約與權限');
{
  check('契約版本為正整數', Number.isInteger(SCHEMA_VERSION) && SCHEMA_VERSION > 0, true);

  check('空房間初始輪次為 1', createEmptyRoomState('FU-1234').round, 1);
  check('空房間帶入房號', createEmptyRoomState('FU-1234').roomCode, 'FU-1234');
  check('空房間 rev 為 0', createEmptyRoomState('FU-1234').rev, 0);
  check('空房間無參戰者', createEmptyRoomState('FU-1234').combatants, []);

  const r = createReward({ text: '全團 +1 物語點' });
  check('獎勵帶入文字', r.text, '全團 +1 物語點');
  check('獎勵 recipients 預設為空陣列', r.recipients, []);
  check('獎勵有建立時間', typeof r.createdAt, 'string');

  // 權限：僅 GM 可改戰場結構
  check('推輪次僅限 GM', isGmOnlyType(ROOM_MESSAGE_TYPES.ROUND_NEXT), true);
  check('發布獎勵僅限 GM', isGmOnlyType(ROOM_MESSAGE_TYPES.REWARD_PUBLISH), true);
  check('新增參戰者僅限 GM', isGmOnlyType(ROOM_MESSAGE_TYPES.COMBATANT_ADD), true);
  check('HP 變動開放給玩家', isGmOnlyType(ROOM_MESSAGE_TYPES.HP_DELTA), false);
  check('MP 變動開放給玩家', isGmOnlyType(ROOM_MESSAGE_TYPES.MP_DELTA), false);
  check('標記已行動開放給玩家', isGmOnlyType(ROOM_MESSAGE_TYPES.ACT_TOGGLE), false);

  // fail closed：未知型別一律視為受限
  check('未知型別視為受限（fail closed）', isGmOnlyType('some:unknown'), true);
  check('空字串視為受限', isGmOnlyType(''), true);

  check('GM 角色常數', ROOM_ROLES.GM, 'gm');
  check('玩家角色常數', ROOM_ROLES.PLAYER, 'player');
}

// ─────────────────────────────────────────────────────────── 結果
__setStorageBackend(null);

console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
