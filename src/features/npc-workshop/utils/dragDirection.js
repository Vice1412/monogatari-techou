/**
 * 步驟一定位輪播的「拖曳方向」判定。
 *
 * 為什麼要抽成純函式：這段判斷原本埋在 `NPCWorkshop.jsx` 的 `onMouseUp` 裡，
 * 而 `onClick` / `onMouseUp` 這類事件處理器在 SSR 測試中不會被執行——
 * 等於「拖多少才算換一張」這件事**完全沒有護欄**。
 * 2026-10-21 的 GM 開卡實測就是靠人工點出來的（拖曳整個失效，見
 * `docs/npc-workshop-gm-test.md` `GM-02-01`）。
 *
 * 方向約定：往左拖（dx < 0）＝ 看下一張 → 回傳 `1`；
 * 往右拖（dx > 0）＝ 看上一張 → 回傳 `-1`；未達門檻或數值異常 → `0`。
 *
 * @param {number} dx 放手點 x 減去按下點 x（像素）
 * @param {number} threshold 觸發換頁的最小位移（像素），必須為正
 * @returns {-1|0|1}
 */
export function resolveDragDirection(dx, threshold) {
  if (!Number.isFinite(dx) || !Number.isFinite(threshold) || threshold <= 0) return 0;
  if (dx > threshold) return -1;
  if (dx < -threshold) return 1;
  return 0;
}

export default resolveDragDirection;
