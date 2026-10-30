import React from 'react';

/**
 * 資源條 (GaugeBar)：主條 ＋ 尾影。
 *
 * ## 為什麼不是一條 `div` 加 `width`
 *
 * 原本 HP／MP／IP／EXP 四條資源條都是「一條外框 div ＋ 一條內層 div，
 * 內層只設 `width` 百分比，外層 `overflow-hidden` 把它裁成膠囊」。
 * 換句話說：**只有 `width` 在動，而且只有一條在動**。玩家按下 `−8` 之後看到的
 * 是一個從 62% 平滑滑到 30% 的條子——滑完就沒了，沒有任何東西告訴他「剛剛少了多少」。
 * 使用者的說法是「不呆板，而是有系統互動的實感」，而這一條正是最呆板的地方。
 *
 * ※ 這裡刻意**不貼範例 JSX**：`tests/uiSystem.test.mjs` 的 H29-b 會逐行比對
 *   「有 `className` 的行不能被當成註解塗白」，而一段貼在註解裡的 JSX 正好會被
 *   那條護欄當成「真實的 JSX 被吃掉了」。護欄是對的，是範例該換個寫法。
 *
 * 尾影（trail）是格鬥遊戲血條的老手法：主條立刻縮到新值，尾影慢半拍跟上，
 * 兩者之間露出來的那一段就是**剛剛失去的量**。它不需要任何額外狀態——
 * 兩條 `div` 在同一次 render 拿到同一個 `width`，差別只在 CSS 的
 * `transition-duration` 與 `transition-delay`（`.gauge-fill` / `.gauge-trail`）。
 *
 * 換句話說：**尾影不是算出來的，是「慢」出來的。** 所以它不會跟主條對不上，
 * 也沒有第二份「上一次的值」需要維護。
 *
 * ## 為什麼要有 `trailPercent` 這個參數
 *
 * 預設等於 `percent`。留這個參數是為了讓呼叫端在「上限改變」（例如升級後 maxHp 變大）
 * 時可以選擇不要讓尾影跟著亂跳——但絕大多數情況不必傳。
 */

const clampPercent = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
};

export default function GaugeBar({
  percent,
  trailPercent,
  fillClassName = '',
  fillStyle = null,
  trackClassName = 'bg-[#f4ebd9]',
  trailClassName = 'bg-[#d6c7ab]',
  height = 'h-2.5',
  className = '',
  testId
}) {
  const main = clampPercent(percent);
  const trail = clampPercent(Number.isFinite(Number(trailPercent)) ? trailPercent : percent);

  return (
    <div
      data-testid={testId}
      className={`relative w-full ${height} rounded-full overflow-hidden ${trackClassName} ${className}`}
    >
      {/* 尾影先畫，主條疊在上面——順序就是圖層，不必 z-index */}
      <div
        data-testid={testId ? `${testId}-trail` : undefined}
        className={`gauge-trail absolute inset-y-0 left-0 rounded-full ${trailClassName}`}
        style={{ width: `${trail}%` }}
      />
      <div
        data-testid={testId ? `${testId}-fill` : undefined}
        className={`gauge-fill absolute inset-y-0 left-0 rounded-full ${fillClassName}`}
        style={fillStyle ? { ...fillStyle, width: `${main}%` } : { width: `${main}%` }}
      />
    </div>
  );
}
