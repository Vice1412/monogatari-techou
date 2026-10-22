/**
 * localStorage 鍵註冊表 —— 全站唯一事實來源。
 *
 * 為什麼要有這張表（2026-10-04 建立）：
 * 在此之前，全站有 9 個鍵散落在 7 個檔案裡直接呼叫 localStorage，而且
 * NPC 檔案庫同時存在三個互不相通的鍵：
 *
 *   - `fabula-npc-library-v2`      NPC 工坊實際讀寫（真正的資料在這裡）
 *   - `fu_companion_npc_library`   App 全站備份與戰鬥追蹤器讀取（永遠讀不到東西）
 *   - `fu_npc_library`             匯入時寫入，但沒有任何地方讀取（死鍵）
 *
 * 直接後果：戰鬥追蹤器的「從怪物庫派兵」看不到 NPC 工坊的產出，
 * 而全站備份也備不到真正的 NPC 檔案庫。
 *
 * 本表確立單一權威鍵。舊鍵降級為 LEGACY_KEYS，僅供一次性遷移讀取，不得再寫入。
 *
 * ── 2026-10-16：前綴由 `fu_companion_` 更名為 `monogatari_techou_` ──
 *
 * 背景：`FU Companion` 是已因版權問題廢棄的舊名（見 `docs/decisions.md` 命名節），
 * 但 6 個權威鍵仍帶著舊名前綴，而本 repo 是**公開的**——舊名因此仍公開可見。
 *
 * 這**不是單純改字串**：這些鍵承載使用者資料，直接改會讓既有玩家的角色卡全部讀不到。
 * 因此走 `LEGACY_KEYS` ＋ `store.migrateLegacyStorage()` 的漸進遷移：
 *
 *   1. 權威鍵改用新前綴
 *   2. 舊名整批降級進 `LEGACY_KEYS`
 *   3. 遷移策略：**權威鍵為空才複製、絕不覆寫、舊鍵永不刪除** → 冪等且完全可逆
 *
 * ※ 這**覆寫**了 `docs/decisions.md` 命名節「刻意不改 keys.js 的 fu_companion_*」的舊決定。
 *   舊決定的理由是「改了會讓使用者資料讀不到」——該理由在遷移機制建立後已不成立。
 *   完整理由與回滾方式見 `docs/decisions.md` 的 2026-10-16 條目。
 */

/**
 * 現行權威鍵。
 * 讀寫一律走 `src/data/store.js`，不得再直接呼叫 localStorage。
 */
export const STORAGE_KEYS = Object.freeze({
  /** NPC 檔案庫（NPC 工坊的產出） */
  npcLibrary: 'monogatari_techou_npc_library',
  /** 角色名冊（角色卡的集合） */
  characterRoster: 'monogatari_techou_character_roster',
  /** 進行中的戰鬥（輪次、參戰者、場景命刻） */
  activeCombat: 'monogatari_techou_active_combat',
  /** 命刻記錄頁的獨立命刻 */
  fateClocks: 'monogatari_techou_fate_clocks',
  /** 音效開關 */
  soundEnabled: 'monogatari_techou_sound_enabled',
  /** NPC 卡片配色 */
  npcCardTheme: 'monogatari_techou_npc_card_theme',
  /** 角色卡配色 */
  characterTheme: 'monogatari_techou_character_theme',
  /**
   * NPC 工坊的建角草稿（2026-10-22 新增，見 `docs/decisions.md` §BS）。
   *
   * 為什麼需要它：八步建角是十幾分鐘的工序，而草稿原本只活在 React state 裡——
   * 回封面、換章節、重新整理、關分頁，全部歸零，畫面上沒有任何提示
   * （`beforeunload` 只攔「真的離開頁面」，攔不到站內換章節）。
   *
   * ※ 這個鍵**沒有舊鍵**：它不是任何舊資料的更名，純粹是新寫入端，
   *   因此不在 `store.MIGRATION_PLAN` 內（沒有東西可搬）。
   */
  npcDraft: 'monogatari_techou_npc_draft',
});

/**
 * 舊鍵 —— 只讀不寫。
 *
 * 遷移時機：`store.migrateLegacyStorage()`，於 `main.jsx` 首次渲染前執行。
 * 遷移採「權威鍵為空才複製」策略，且**永不刪除舊鍵**，因此完全可逆。
 */
export const LEGACY_KEYS = Object.freeze({
  // ── 世代 2：2026-10-16 更名前綴時降級 ──────────────────────
  /** NPC 檔案庫的 `fu_companion_` 前綴版 */
  npcLibraryLegacy: 'fu_companion_npc_library',
  /** 角色名冊的 `fu_companion_` 前綴版 */
  characterRosterLegacy: 'fu_companion_character_roster',
  /** 進行中戰鬥的 `fu_companion_` 前綴版 */
  activeCombatLegacy: 'fu_companion_active_combat',
  /** 命刻的 `fu_companion_` 前綴版 */
  fateClocksLegacy: 'fu_companion_fate_clocks',
  /** 音效開關的 `fu_companion_` 前綴版 */
  soundEnabledLegacy: 'fu_companion_sound_enabled',
  /** 角色卡配色的 `fu_companion_` 前綴版 */
  characterThemeLegacy: 'fu_companion_character_theme',
  /** NPC 卡片配色的 `fabula-npc-card-theme` 版 */
  npcCardThemeLegacy: 'fabula-npc-card-theme',

  // ── 世代 1：2026-10-04 資料層收斂時降級 ────────────────────
  /** NPC 工坊在 2026-10-04 之前實際使用的鍵 */
  npcLibraryV2: 'fabula-npc-library-v2',
  /** 匯入備份時誤寫的鍵，從未有讀取端 */
  npcLibraryStray: 'fu_npc_library',
  /** NPC 卡片配色的舊版鍵 */
  npcCardThemeV1: 'fabula-npc-theme',
  /**
   * 團務層級的開卡規則（2026-10-06 短暫存在過）。
   *
   * 當時把開卡規則放在名冊層級、並在名冊頁放了一顆「開局英雄技能」開關。使用者指出
   * 那會**一次改掉名冊裡所有角色**（包括別的團的），與「GM 列出需求 → 玩家照著建角色」
   * 的流程不符。規則已改為**存在角色身上**（`char.creationRules`，見 `CreationRulesPanel`），
   * 這個鍵不再有任何寫入端。保留在舊鍵表是為了不刪使用者資料。
   */
  creationRulesCampaign: 'fu_companion_creation_rules',
});

/** 全部鍵的聯集，供測試與稽核使用。 */
export const ALL_STORAGE_KEYS = Object.freeze([
  ...Object.values(STORAGE_KEYS),
  ...Object.values(LEGACY_KEYS),
]);
