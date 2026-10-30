/**
 * 羈絆 ⇄ NPC 檔案庫的連結（2026-10-30，P3）。
 *
 * ── 為什麼需要一個獨立模組 ──────────────────────────────────
 *
 * 羈絆的「對象」原本只是一行自由文字。玩家打「導師」，NPC 檔案庫裡那張卡也叫「導師」，
 * 但兩者之間沒有任何關係——跑團面板不知道那個人長什麼樣、什麼職業、還在不在名冊裡。
 * 於是羈絆只是六行標籤，不是「我認識的人」。
 *
 * 補上 `npcId` 之後就出現一個**新的失敗模式**：名冊裡那張卡被刪掉了。
 * 這種「指向不存在的東西」的狀態如果交給元件自己判斷，六個畫面會長出六種行為
 * （有的當沒連結、有的顯示 undefined、有的直接拋錯）。所以判定只寫在這裡，
 * 元件只負責把 `status` 畫出來。
 *
 * ── 三種狀態不是兩種 ──────────────────────────────────────
 *
 *   `none`    沒有連結。玩家刻意讓羈絆對象不是名冊裡的人（王國、一把劍、死去的人）。
 *   `linked`  連得上，而且那張卡還在。
 *   `missing` 連過，但那張卡已經不在名冊裡了。
 *
 * `none` 與 `missing` **必須分開**：前者是玩家的選擇，不該有任何提示；
 * 後者是資料壞了，要告訴玩家「名冊已無此人」並且**保留原本的名字**（那是他寫的）。
 * 把兩者合併成「找不到」＝每次都在已經正確的羈絆上報錯。
 *
 * ── 這裡刻意沒有「為什麼有這份情感」的自由輸入框（2026-10-30 當天移除）──────
 *
 * 第一版做過：一句 120 字的理由，畫在羈絆卡上、帶進履歷。**當天就拆掉了**，
 * 理由是 GM 的判準——「讓玩家自己知道就好，不要加重操作負擔，他們會不知道要寫什麼」。
 *
 * 這個判準值得留在檔案裡，因為它會一再出現：
 * **畫面上多一個空白輸入框，就是多一次「我該填什麼」的猶豫。**
 * 羈絆的情感（欽佩／忠誠／喜愛）已經是封閉的六選項，那是規則給的；
 * 理由沒有規則可依，所以它只會變成一片沒人寫的空格。
 * 要增加代入感，該做的是**讓既有資料變得有意義**（名冊連結就是這樣），
 * 不是再開一個欄位讓玩家自己想。
 */

/**
 * 羈絆與名冊的關係。回傳 `{ status, npc }`。
 *
 * `pool` 不是陣列時當作空名冊（不是拋錯）：呼叫端可能還沒載入完，
 * 而「還沒載入」在畫面上應該長得像「沒有連結」，不該讓整個面板炸掉。
 */
export const resolveBondNpc = (bond, pool) => {
  const npcId = typeof bond?.npcId === 'string' ? bond.npcId.trim() : '';
  if (!npcId) return { status: 'none', npc: null };
  const list = Array.isArray(pool) ? pool : [];
  const npc = list.find((n) => n && typeof n === 'object' && n.id === npcId) || null;
  return npc ? { status: 'linked', npc } : { status: 'missing', npc: null };
};

/**
 * 名冊上那張卡的一行副標（`Lv.3 · 反派 · 帝國`）。
 * 缺哪一項就少哪一項，不補佔位符——「Lv. · · 」比什麼都不顯示更難看。
 */
export const bondNpcSubtitle = (npc) => {
  if (!npc || typeof npc !== 'object') return '';
  const bits = [];
  if (Number.isFinite(npc.level) && npc.level > 0) bits.push(`Lv.${npc.level}`);
  if (typeof npc.role === 'string' && npc.role.trim()) bits.push(npc.role.trim());
  if (typeof npc.faction === 'string' && npc.faction.trim()) bits.push(npc.faction.trim());
  return bits.join(' · ');
};

/**
 * 把表單狀態收成要寫進 bond 的欄位。
 *
 * **空的欄位不寫鍵。** 舊存檔的羈絆沒有 `npcId`，若這裡一律寫 `npcId: ''`，
 * 每一條既有羈絆在存檔裡都會長出一個空鍵——看起來像「被改過」，
 * 而且會讓「有沒有連結」多出第二種表示法（空字串 vs 沒有這個鍵）。
 */
export const buildBondLinkFields = ({ npcId } = {}) => {
  const out = {};
  const id = typeof npcId === 'string' ? npcId.trim() : '';
  if (id) out.npcId = id;
  return out;
};

/**
 * 把表單狀態套到一條既有羈絆上。
 *
 * 這裡的關鍵是「**表單是完整的事實**」：表單說沒有連結，結果就沒有連結。
 * 所以先把舊的 `npcId` 刪掉，再併入新的。
 *
 * 為什麼不能只寫 `{ ...bond, ...buildBondLinkFields(...) }`：
 * `buildBondLinkFields` 在欄位為空時**刻意不寫鍵**（見上），所以舊值會留下來——
 * 玩家把連結改成「不連結名冊」之後存檔，那條羈絆還指著原來那張卡。
 * 這一段在元件裡寫不出測試（SSR 不執行 onClick），所以放在這裡。
 */
export const applyBondLinkFields = (bond, form) => {
  const next = { ...(bond || {}) };
  delete next.npcId;
  return { ...next, ...buildBondLinkFields(form) };
};

/**
 * 編輯羈絆時履歷要寫什麼。
 *
 * 只寫「調整羈絆」的話，三個月後回頭看履歷，看不出那次的情感怎麼變的。
 * 情感是規則層（激勵加值＝情感數），所以它值得一行字。
 *
 * 傳入的是**已經格式化好的字串**（`欽佩、忠誠`），不是情感鍵陣列：
 * 這個模組不該知道 `FEELING_LABELS` 長什麼樣，那是顯示層的事。
 */
export const describeBondEdit = ({ target, feelingsFrom, feelingsTo } = {}) => {
  const name = String(target ?? '').trim();
  const fFrom = String(feelingsFrom ?? '').trim();
  const fTo = String(feelingsTo ?? '').trim();
  return fFrom !== fTo
    ? `調整羈絆【${name}】：${fFrom || '（無）'} → ${fTo || '（無）'}`
    : `調整羈絆【${name}】`;
};
