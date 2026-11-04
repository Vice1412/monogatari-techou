# 08 · AGY 施工規則、回報格式與 commit 切法

> 本檔是計劃書的分冊（給 Antigravity 分冊閱讀）；入口與施工順序看 `docs/plan/README.md`。

## 0. 怎麼讀（**先看這一節**）

- 你的規則檔有單檔上限，所以計劃書刻意拆成 < 12 KB 的分冊。
  **一次只讀一冊，做完再讀下一冊**；不要把 `docs/plan/` 全部塞進同一個 context。
- 檔名數字＝**閱讀順序**；**施工順序在 `README.md` §0**。
- 逐筆的原文引用與行號在 `appendix-*.md`（34–52 KB）。**只在需要某一筆時去 grep**：
  `Select-String -Path docs/plan/appendix-quirk-needs.md -Pattern "富家子弟"`。不要整份讀。
- 已裁定的決策在 `README.md` §2（D1–D9）。**照做，不要再問**；有新問題寫進回報的「待裁定」。

## 1. 施工規則（每一條都要遵守）

1. **一次一冊**。每完成一冊：`npm test`（61 道）＋ `npm run build` 都要綠，才進下一冊。
2. **不要新增履歷 kind**；不要改 `characterLog.LOG_FIELDS` 的既有鍵。
   金手指用 `quirk`、英雄技能用 `heroic`、職業技能用 `skill`、命刻用 `clock`（全部已註冊）。
3. **刻度只有一個存放處**：`classResources`（W0-8 就是收斂這件事）。
4. **純函式不得擲骰、不得讀時間**（`Date.now` 只在呼叫端或 UI）。
5. **SSR 測不到 `onClick`**：把「按了會怎樣」抽成純函式（`planBuffUse` 等）並測它；
   UI 只測「按鈕在不在、是否 disabled、那行原因有沒有印出來」。
6. **不要用文字當錨點**：一律 `data-testid`。
7. 動到 `CharacterPlayHUD` 的掛載點時，先跑 `test:playhudempty`（83）與 `test:ui`（654）確認沒回歸。
8. 每一筆都要**刻意破壞驗證 ≥2 條**（改壞 → 紅 → 還原 → 綠），並把結果寫進回報。
9. **資料一律改 `scratch/flows/*.json`，再跑 `npm run build:flows`**；**不要手改**
   `src/features/character-sheet/data/effectFlows.json`（那是產物，手改會在下次 build 消失）。
10. **`flowState[id].fields` 不得被任何重置清掉**（`resetFlowScope` 只清 `n`/`on`/`picks`/`text`/`list`）。
11. 改 `classResources`／`cost`／`apply.via` 前，先問「**有沒有第二條扣款路徑**」——
    【植生術】就是通用按鈕與花園盤各扣一半（W0-9）。
12. 禁 Emoji；字級只用 `text-t10`…`text-t39`；顏色取自 `theme`；純中文顯示。

## 2. 回報格式（每冊一份，缺一項就算沒做完）

```
## 這一冊做了什麼
- 改了：<檔案:行數>（逐檔列出）
- 新增：<檔案:行數>
- 沒做／延後：<條目＋理由>

## 測試
- npm test：<總關卡數> 全綠（新增 <test:xxx> <N> 條）
- npm run build：exit 0（<秒數>）
- test:emoji：0 命中

## 刻意破壞驗證
1. <改壞什麼> → 紅 <N> 條 → 還原 → 綠
2. …

## 待裁定（沒有就寫「無」）
- <一句話問題＋你目前的做法>
```

## 3. commit 切法

- **一冊一個 commit**（例：`feat(flowdata): W0 先行件與資料容器`）。
  分冊之間有依賴，混在一起之後回退任何一冊都會牽動其他冊。
- 同一冊內若同時有「資料（JSON）」與「程式」，可拆兩個：`feat(flowdata): <功能>` 與
  `data(flows): <條目宣告>`——本專案的產物與來源要分得開。
- 訊息用專案格式：`feat(scope): 中文一句話`；說明段寫「為什麼」，不要只寫「改了什麼」。

## 4. 驗收清單（Lead 檢查用；AGY 交件前自檢）

- [ ] `npm test` 61 道以上全綠（含新增的 `test:flowdata`）
- [ ] `npm run build` exit 0
- [ ] `npm run test:emoji` 0 命中
- [ ] 舊存檔（沒有 `flowState[id].fields`/`picks`/`text`/`list`）打開跑團卡不炸、不顯示空面板
- [ ] 該冊列出的每一筆：**未填資料時**按鈕禁用且寫得出原因；**填完後**可按；
      **達門檻後**禁用並寫得出門檻
- [ ] 履歷上看得出「哪一個增益／哪條技能、數值從幾到幾」
- [ ] 「場景結束／休息／章節結束」三顆重置鈕真的會重置，而且**不會清掉玩家填的名字**
- [ ] 跑團卡上**沒有重複的計數器**（貿易點數只剩一個、疲勞值只剩一個）
- [ ] `data/effectFlows.json` 與 `flowDataSpecs` 沒有同時對同一筆提供操作入口（避免兩顆按鈕）
