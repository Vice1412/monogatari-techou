/**
 * 章節狀態的唯一來源（F-008，2026-10-27）。
 *
 * 為什麼要抽出來：狀態原本寫在 `BookCoverHub` 的 `CHAPTERS` 陣列裡（`status: 'wip'`），
 * 而「點進去要不要彈開發中提醒」寫在 `App.jsx` 的 `chapterId !== 'workshop'`。
 * 兩份判斷各說各的，於是**角色卡助手在封面標「開發中」、進站也被攔**，
 * 但它其實是整個專案做完最多輪測試、結論寫著「能上桌」的那一章
 * （`docs/playtest/99-summary.md` §〇）。
 *
 * 判準：
 * - `complete`：功能範圍已定，驗收走完。
 * - `usable`：能上桌用，但有已知的小缺陷（目前 3 條 3 分，見 99-summary §3.2）。
 * - `wip`：還沒做完，進去前要提醒一次。
 *
 * ※ 改這裡之前先問一句：**這是在改狀態，還是在改事實？**
 *   狀態應該跟著事實走，不是跟著「感覺做完了」走。
 */

export const CHAPTER_STATUS = Object.freeze({
  character: 'usable',
  workshop: 'complete',
  combat: 'wip',
  clocks: 'wip'
});

export const CHAPTER_STATUS_LABEL = Object.freeze({
  complete: '完整功能',
  usable: '可用',
  wip: '開發中'
});

/** 沒登記的章節一律當成施工中——寧可多攔一次，也不要讓半成品看起來像完成品。 */
export const chapterStatusOf = (chapterId) => CHAPTER_STATUS[chapterId] || 'wip';

export const chapterStatusLabelOf = (chapterId) => CHAPTER_STATUS_LABEL[chapterStatusOf(chapterId)];

/** 進去之前要不要攔一次？只有 `wip` 要。 */
export const needsDevWarning = (chapterId) => chapterStatusOf(chapterId) === 'wip';
