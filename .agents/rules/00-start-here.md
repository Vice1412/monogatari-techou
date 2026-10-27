---
trigger: always_on
description: 《物語手帳》專案入口。開場必讀、五條紅線、現況取得方式、收場義務。
---

# 開場：你是《物語手帳》的接手者

這是一個給 TRPG（桌上角色扮演遊戲）玩家用的**純前端**角色卡工具。
技術：Vite 6 + React 19 + Tailwind 3，**零伺服器、零後端**，所有資料存在瀏覽器 localStorage。
使用者是 GM（遊戲主持人，負責帶團的人），**程式基礎薄弱**——
技術術語第一次出現時，用一句白話解釋，不要假設他看得懂 `useMemo`、`chunk` 這類詞。

## 你現在只有 30 秒的注意力，先做這三件事

1. `Read docs/antigravity-brief.md` —— 完整交接簡報：這專案在做什麼、為什麼長這樣、你要避開什麼。
2. `Read docs/playtest/resume.md` —— 續傳卡：現在做到哪、下一步是哪三條。
3. 跑 `npm run handoff` —— 生成 `docs/STATE-LIVE.md`，現況數字由腳本實測，不是誰憑記憶寫的。

**不要**一次讀完 `AGENTS.md`（31 KB，超過 Antigravity 單檔 24 KB 上限會被截斷，且它只是 DeepSeek Harness 的執行細則）。
**不要**讀 `docs/decisions.md`（1 MB，那是「為什麼這樣決定」的紀錄，不是規範；要查特定決策請用 grep 找節號）。
**不要**相信任何寫死的進度數字，包括這份檔案裡的。

## 五條紅線（違反等於白做）

1. **回覆一律繁體中文。** 識別字、指令、log 保留原文。
2. **零 Emoji。** 掃描範圍 `src/` 與 `shared/`，關卡是 `npm run test:emoji`。
   排版字符 `★ ❖ ✦ ✕ ※ △ ◈ ▽ ▼ ◆ ● ◷ ✎ ✓ ✗ ➔ ①~⑤` 允許。
   **連你自己的程式註解也不能用**——這個坑已踩過六次。
3. **介面文字純中文。** 只有「職業／範本／物種」可用「中文 · ENGLISH」，
   禁「中文（English）」這種括號附註。
4. **事實基準＝當前源碼。** `PROJECT_CHANGELOG.md`、`PROJECT_SPEC.md`、任何歷史報告
   都**不得**作為現況結論（前者有三處「零 Emoji 合規」宣稱與實測嚴重不符）。
5. **效果數值必須核對官方原書。** 嚴禁憑記憶編造檢定、數值、等級階級。
   原書在專案目錄之外，路徑與頁碼偏移見 `docs/antigravity-brief.md` §5。

## 改完東西的收場義務（是義務，不是建議）

```bash
npm test        # 31 道關卡，必須全綠
npm run build   # 必須 exit 0（chunk-size 警告是既有現象，不是新問題）
```

然後**寫兩份變更紀錄**，缺一不可：

- 專案內：`docs/agents-changelog.md`
- 專案外：DevVault（使用者的第二大腦筆記庫）—— 專案日誌
  與 `00-Dashboard\01_Changelog_Stream.md`。**絕對路徑見 `.agents/rules/00-local-paths.md`**。

沒寫完不要宣稱完成。

## 這個專案最貴的教訓（先看這條，能省你半天）

**「護欄綠燈」不等於「行為正確」。**
專案有 5,000 多條斷言，全綠只證明「沒有弄壞以前測過的東西」。
唯一的分辨法是**故意弄壞，看它會不會叫**——
但前提是你確定自己真的弄壞了，否則「全綠」有兩種意思而你分不出來。

其他不會過時的坑在 `docs/handoff.md`；濃縮版在 `docs/antigravity-brief.md` §4。

## 不要在元件裡重新發明入口

這個專案已把重複邏輯收斂成單一入口。遇到以下需求，**先找既有函式**：

| 你要做的事 | 唯一入口 |
|---|---|
| 顯示技能（含變體） | `resolveSkillDisplay` |
| 重建技能條目 | `buildSkillEntry` |
| 免費增益二選一（HP／MP） | `resolveChosenBenefit()` |
| 「N~M 個職業」這句話 | `classCountRange()` / `classCountPhrase()` |
| 金手指效果 | `getQuirkEffects(char)` |
| 換金手指改起始資金 | `buildQuirkPatch` |
| localStorage 存取 | `src/data/store.js`（`src/` 內**禁止**直接呼叫 `localStorage`） |
| 九相屬性內聯 | `renderTextWithAffinities` |

完整清單與理由見 `docs/antigravity-brief.md` §6。

## 遇到「原書沒說」的時候

先問一句：**補了會不會拿走玩家的選擇權？**
會 → 那不是漏寫，是設計（例：HP／MP 二選一本來就是玩家自己的選擇）。
先把問題回報給使用者裁定，不要自己替他決定。
