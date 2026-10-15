# 連線房間同步 — 實作計畫草案 v1

> **依 `GEMINI.md` 規則四 / `AGENTS.md` §2，本草案須經使用者確認後方可實裝。**
> 建立：2026-10-04　｜　狀態：**待使用者裁定（前置條件已滿足，可開工）**
> 本文件取代既有 `peerSync.js` 的 P2P 方案（該方案經實測無法連線，見 §1.2）。
>
> ⚠️ **2026-10-15 複驗**：本檔的**前置條件（階段 0）已全部完成**（資料層收斂，見 §1.3 註記）。
> **剩下的只有「要不要做」這個裁定本身**，以及開工後的階段 1。

---

## 0. 一句話

把「一個房間」做成 Cloudflare 上的一個 Durable Object，房間狀態由伺服器當唯一權威，
玩家端只送「事件」、只收「變化」，GM 是唯一有發布權的角色。**目標月費 $0。**

---

## 1. 現況與前置條件

### 1.1 現況（以當前源碼為準，依規則六）

| 項目 | 現況 |
|---|---|
| 前端 | Vite 6 + React 19 純靜態 SPA，`base: './'` |
| 部署 | GitHub Pages（`.github/workflows/deploy.yml`，push 時跑 `npm test` 再 build） |
| 資料層 | ~~純 localStorage，無抽象層~~ → ✅ **已收斂為單一存取層** `src/data/store.js`（階段 0 完成，見 `AGENTS.md` §1 與 `docs/decisions.md` §L） |
| 後端 | **無** |
| 現有同步 | `src/features/combat-tracker/utils/peerSync.js`（PeerJS／WebRTC） |

### 1.2 既有同步方案的實證缺陷（必須移除，不是修補）

| # | 缺陷 | 證據 |
|---|---|---|
| 1 | **玩家根本連不上房主**：房主 Peer ID 帶時間戳後綴，玩家端連的是不帶後綴的 ID，兩者永不相等 | `peerSync.js:23` vs `:66`（`:64` 的註解顯示發現機制寫一半） |
| 2 | **玩家改自己 HP/MP 不會傳出去**：全專案僅一處廣播，且被 `isHost` 鎖住 | `CombatTracker.jsx:96` |
| 3 | **「同步角色進房間」是假的**：只寫本機 localStorage 就跳成功提示，封包無發送端 | `CharacterPlayHUD.jsx:347`；`PUSH_CHARACTER` 僅有接收端 `CombatTracker.jsx:107` |
| 4 | 新玩家進房不補送當前狀態、無斷線重連、房間隨 GM 關分頁消失 | 通篇 |
| 5 | 傳輸寄生在 PeerJS 免費公共伺服器，且未設 TURN 中繼 | `peerSync.js:23`、`:61` |

### 1.3 前置缺陷：資料層未收斂（**動工前必須先修**）—— ✅ 已於 2026-10-04 修完（階段 0）

> ⚠️ **2026-10-15 狀態註記**：本節列的三個前置缺陷（NPC 庫三 key 互不相通、戰鬥狀態被五處直寫、
> key 數目記載不實）**已於階段 0 全部收斂完畢**——`src/data/store.js` 現為全站唯一存取層、
> `src/data/keys.js` 為唯一鍵註冊表、`src/` 內**零**直接 `localStorage` 呼叫（見 `docs/decisions.md` §L）。
> 另：本檔 §1.1 表格曾寫「資料層：純 localStorage，無抽象層」——**該行亦已不成立**，以 `AGENTS.md` §1 為準。
> **剩下未完成的只有「開工」本身**（階段 1 未動），前置條件已滿足。

**（A）NPC 檔案庫有三個互不相通的 key**

| key | 讀取點 | 寫入點 |
|---|---|---|
| `fabula-npc-library-v2` | `NPCWorkshop.jsx:1672` | `NPCWorkshop.jsx:1682` |
| `fu_companion_npc_library` | `App.jsx:139`、`CombatTracker.jsx:76` | 僅 `App.jsx:163`（備份還原） |
| `fu_npc_library` | **無** | `NPCWorkshop.jsx:2026` |

後果：戰鬥追蹤器讀不到 NPC 工坊的產出；全站備份備不到真正的 NPC 庫；`fu_npc_library` 是死 key。

**（B）`fu_companion_active_combat` 被五個檔案直接寫入**

`NPCWorkshop.jsx:1814`、`CharacterSheet.jsx:183`、`CombatTracker.jsx:87`、
`CharacterPlayHUD.jsx:348`、`ErrorBoundary.jsx:30`（移除）。

**（C）`AGENTS.md §1` 記載「四個 key」，實際至少九個**

新增未記載者：`fu_companion_sound_enabled`、`fu_companion_character_theme`、
`fabula-npc-library-v2`、`fabula-npc-card-theme`／`fabula-npc-theme`、`fu_npc_library`。

> **為什麼這是伺服器的前置條件**：同步層的作用是攔截所有狀態變更並轉發。
> 目前有 5 個直接寫入點、3 個不一致的 key，同步層會直接與之衝突。

### 1.4 前置缺陷：角色卡數值引擎無測試

`AGENTS.md §4 E` 已自承這是覆蓋缺口。HP/MP/IP 與所有衍生數值皆由其決定，
若計算有誤，同步層只會忠實同步錯誤數字。**這是先修項，不是並行項。**

---

## 2. 目標架構

```
瀏覽器（React SPA，GitHub Pages，靜態）
   │  WebSocket（wss）
   ▼
Cloudflare Worker ── 路由 /room/:code/ws
   │
   ▼
Durable Object「RoomDO」＝ 一個房間
   • SQLite storage：權威狀態
   • WebSocket Hibernation：閒置不計 duration
   • 廣播：只送 delta，不送全份狀態
```

**權威來源**：伺服器。前端只送意圖（intent），由 RoomDO 驗證後套用並廣播。
**GM 權限**：建房者持有 room token，僅該 token 可執行 `round:next`、`combatant:*`、`reward:publish`。
**玩家權限**：僅可改自己角色的 HP/MP/IP/狀態、標記自己已行動。

---

## 3. 為什麼是這個架構（免費額度的算術）

依 Cloudflare 官方定價文件，**Workers 免費方案**：

| 項目 | 免費額度 |
|---|---|
| 請求 | 100,000 / 日 |
| Duration | 13,000 GB-s / 日 |
| SQLite-backed Durable Objects | **免費方案僅能用 SQLite 後端**（KV 後端需付費） |

**請求的計費方式**：HTTP 請求、RPC session、**WebSocket 訊息**、alarm 皆算一次請求。

**事件成本**：一次事件 = 1 進 + N 出。六人團 = 7 請求。

| 情境 | 4 小時團的請求數 | 佔免費額度 |
|---|---|---|
| 每分鐘 10 個事件（合理） | 2,400 × 7 = 16,800 | 17% |
| 每分鐘 50 個事件（激烈） | 12,000 × 7 = 84,000 | 84% |
| **狀態一變就廣播全份**（現行做法） | 拖一次血量轉盤即可破百次 | **一小時內爆額度** |

**Duration 的陷阱**：DO 常駐 128 MB × 86,400 秒 = 10,800 GB-s，
幾乎吃滿 13,000 GB-s 的免費額度。**故必須啟用 WebSocket Hibernation**，
讓閒置房間休眠、不計 duration。

> **結論**：免費與付費的分界不在「幾個人」，而在**同步設計紀律**。
> 三個必須遵守的規則見 §5.3。

---

## 4. 資料契約（`shared/schema.js`，前端與 Worker 共用）

同步的邊界刻意**收窄**：只同步「衝突中」的狀態，不同步整個角色庫與 NPC 庫。

```js
// 房間狀態（權威）
RoomState = {
  schemaVersion: 1,
  rev: 0,                       // 單調遞增；前端據此判斷是否漏收
  roomCode: 'FU-8821',
  gmToken: '...',               // 僅建房者持有
  round: 1,
  combatants: [Combatant],
  sceneClocks: [Clock],
  rewards: [Reward],            // GM 發布的獎勵紀錄
  peers: [{ peerId, displayName, role }]
}

Combatant = {
  instanceId, sourceType: 'character'|'npc',
  name, faction,
  hp: { current, max },
  mp: { current, max },
  ip: { current, max },
  statuses: [string],
  hasActed: bool,
  ownerPeerId,                  // 誰有權改這隻
  snapshotRef                   // 只帶顯示所需欄位，不帶整張卡
}

Reward = { id, text, recipients:[instanceId], createdAt, publishedBy }
```

**明確不同步**：完整角色卡、完整 NPC 卡、名冊、命刻頁、金手指、造物專案。
玩家端顯示的詳細資料仍由本機資料提供，房間只承載「衝突中的數字」。

---

## 5. 元件清單與檔案佈局

### 5.1 新增

```
shared/
  schema.js            資料契約 + 版本號（前端與 Worker 共用）
  protocol.js          訊息型別常數（單一來源）
worker/
  index.js             Worker 入口：靜態資源 + /room/:code/ws 路由
  RoomDO.js            Durable Object：權威狀態、驗證、廣播、hibernation
  roomCode.js          房號產生與驗證
wrangler.toml          Cloudflare 設定（DO binding、migrations）
src/data/
  keys.js              localStorage key 註冊表（唯一事實來源）
  store.js             單一存取層：read/write/subscribe/remove
src/features/combat-tracker/utils/
  roomClient.js        WebSocket 客戶端（重連、送出佇列、修補套用）— 取代 peerSync.js
```

### 5.2 修改

| 檔案 | 改動 |
|---|---|
| `App.jsx` | 備份/還原改走 `store.js`；修正 NPC 庫 key |
| `NPCWorkshop.jsx` | 三個 key 收斂為一個；`activeCombat` 寫入改走 `store.js` |
| `CharacterSheet.jsx` | `roster` 與 `activeCombat` 改走 `store.js` |
| `CharacterPlayHUD.jsx` | 「同步至戰鬥房間」改為真正送出 `hp/mp` 事件 |
| `CombatTracker.jsx` | 移除 `peerSync`；房間列改接 `roomClient` |
| `ErrorBoundary.jsx` | 改走 `store.js` |

### 5.3 同步設計紀律（決定免費或付費）

1. **事件驅動，非狀態驅動**：只在離散事件送出（HP 由 12 變 8、輪次 +1、發布獎勵）。
2. **提交時送，拖動時不送**：HP 輸入用確認鈕或失焦，**嚴禁用 `onChange` 即時廣播**。
3. **連線時快照、之後增量**：`snapshot` 只在 WebSocket 開啟時送一次，其後一律 `patch`。

---

## 6. 分階段實作與驗收

### 階段 0 — 前置（不碰伺服器，但兩邊都要用）

| 步 | 工作 | 驗收 |
|---|---|---|
| 0.1 | 建 `src/data/keys.js` 註冊表 | 九個 key 全部登記，無散落字面量 |
| 0.2 | 建 `src/data/store.js` 存取層 | 五個 `activeCombat` 寫入點全改走它 |
| 0.3 | 修 NPC 庫三 key 不一致 | 實測：NPC 工坊產出在戰鬥追蹤器看得到 |
| 0.4 | 凍結 `shared/schema.js` | 版本號 + 單一來源 |
| 0.5 | 補 `characterEngine.js` 測試 | 對照原書數值，HP/MP/IP 全對 |

**出口條件**：`npm test` 全綠、`npm run build` exit 0、`§1.3` 三項缺陷實測已消失。

### 階段 1 — 本機驗證（不打雲、不花錢）

| 步 | 工作 | 驗收 |
|---|---|---|
| 1.1 | `wrangler.toml` + Worker + RoomDO 骨架 | `wrangler dev` 本機跑起來 |
| 1.2 | 實作協定：join / snapshot / patch / presence | 協定單元測試 |
| 1.3 | 前端 `roomClient.js` | 取代 `peerSync.js` |

**出口條件**：兩個瀏覽器視窗——A 改 HP，B 立即看到；關掉 B 再開，B 收到完整狀態。

### 階段 2 — UI 接線

| 步 | 工作 |
|---|---|
| 2.1 | 房間列：建立／加入／連線狀態／線上名單／GM 權限 |
| 2.2 | 玩家端改自己 HP/MP 的送出點 |
| 2.3 | GM 發布獎勵 |

> ⚠️ **本階段涉及面向使用者的文字，依規則四必須先通過 §7 文案預審方可實裝。**

### 階段 3 — 上線

`wrangler deploy` → 前端環境變數指向 Worker → 實測免費額度用量。

---

## 7. 面向使用者的文案（**待確認，未經確認不得實裝**）

依規則三：介面標題一律純中文，無英文附註。

| 位置 | 草案文案 |
|---|---|
| 房間列按鈕 | `開創房間`、`加入房間`、`斷開連線` |
| 房號欄 | 佔位字 `輸入房間碼` |
| 已連線 | `GM 房間建立完成`、`已連線房間`、`線上 {n} 人` |
| 未連線 | `當前為本地單機模式` |
| 連線中 | `連線中…`、`已離線，正在重連…` |
| 失敗 | `房間不存在或已關閉`、`房間碼格式不正確` |
| 玩家端 | `我的角色狀態已送出`、`僅 GM 可執行此操作` |
| GM 端 | `發布獎勵`、`已發布給全團` |

**待你裁定**：以上文案是否採用、是否要改字。

---

## 8. 明確不在本次範圍

- **帳號系統**：先用房間碼 + 顯示名稱，不做密碼與註冊。
- **雲端角色庫**：角色卡與 NPC 卡仍留在本機；只同步衝突中的數字（§4）。
- **語音／視訊**：不做，沿用既有語音工具。
- **地圖／棋子／視野**：不做。
- **跨房間持久化**：房間結束即釋放，不做長期存檔（避免吃 SQLite 免費額度）。

---

## 9. 風險與未驗證項（**不得當作已保證**）

| # | 項目 | 狀態 |
|---|---|---|
| 1 | 本 repo 目前能否部署到 Cloudflare | **未驗證**——尚無 `wrangler.toml`，需先確認帳號與 CLI |
| 2 | 每日 10 萬請求是否足夠 | 取決於 §5.3 紀律；事件密度未實測 |
| 3 | WebSocket Hibernation 的實際 duration 節省 | **未實測**，依官方文件推論 |
| 4 | `§1.3` NPC 庫三 key 不一致 | **靜態分析結論**，需實跑確認 |
| 5 | 前端由 GitHub Pages 轉為 Worker 託管的必要性 | 未定；兩者可並存，Worker 只做房間 API |
| 6 | 免費方案僅支援 SQLite 後端 DO | 官方文件已載明 |

> ⚠️ 本計畫**不含**任何「已保證可行」的承諾。階段 0 的出口條件通過前，
> 階段 1 之後的估時皆不成立。

---

## 10. 建議的第一步

只做 **階段 0**。它不碰伺服器、不花錢、不需要你決定任何架構問題，
而且它會順手修好「戰鬥追蹤器讀不到 NPC 庫」這個你現在就在承受的 bug。
做完之後再回頭決定要不要進階段 1。
