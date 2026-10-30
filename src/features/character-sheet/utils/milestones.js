/**
 * 里程碑：讓「走了多遠」看得見（P4，2026-10-30）。
 *
 * ── 這不是成就系統 ────────────────────────────────────────
 *
 * 這裡的每一條都**只記錄，不給任何數值加成**。一旦給了加值，它就不是記錄而是規則，
 * 而原書沒有這條規則——那會變成「App 自己發明的機制」，比沒有更糟。
 *
 * ── 全部由既有資料推導，玩家一個字都不用填 ──────────────────
 *
 * 這是刻意的：多一個要填的欄位就是多一次「我該填什麼」的猶豫。
 * 所以這裡沒有 `character.milestones` 這種欄位，也沒有任何寫入端——
 * 純函式、每次算、算出來的東西不會過期。
 *
 * ── 兩條原本想做的，做不到，所以沒做 ──────────────────────
 *
 * 1. **「初次危機」（HP 掉到一半以下）算不出來。**
 *    履歷只記 `currentHp` 的前後值，沒有記「當時的 maxHp」。
 *    用現在的 maxHp 回推，角色升級之後那條里程碑會自己消失——
 *    一個會消失的里程碑比沒有更糟（玩家會以為自己弄壞了什麼）。
 *    → 改用**精確**的那一個：`初次倒下`（HP 歸零）。這個事件在履歷裡是明確的 `to === 0`。
 * 2. **「初次大失敗」算不出來。**
 *    擲骰器目前只把大失敗換成 1 點物語點，履歷裡留下的是一筆普通的 FP 變動，
 *    看不出那是大失敗。要做的話得先讓擲骰器把「大失敗」寫進履歷——
 *    那是另一件事（新增寫入端），不在這一批裡。
 */
import { getCharacterLevel, CLASS_MAX_LEVEL } from './characterEngine';
import { getLog, getSessionCount, summarizeLog } from './characterLog';

/**
 * 里程碑定義。順序＝由近到遠（玩家最容易先碰到什麼）。
 *
 * `hint` 是一句白話說明。專案的 GM 與玩家不一定熟規則書用語，
 * 一個只寫「精通職業」的徽章對他們沒有意義——要說出「這代表什麼」。
 *
 * ※ 每一條都先 `Array.isArray`。這不是防禦性寫法的潔癖：
 *   `(character.bonds || []).length` 在 `bonds` 是**字串**時會回傳字串長度
 *   （`'not-an-array'.length === 12`），於是「第一條羈絆」與「三條羈絆」同時亮起來——
 *   而畫面上看起來完全正常。這個坑是 `test:milestones` 的 D1 抓出來的。
 */
export const MILESTONES = Object.freeze([
  {
    id: 'firstBond',
    label: '第一條羈絆',
    hint: '開始有「在乎的人」——羈絆是這套系統裡最重要的東西之一。',
    test: (ch) => Array.isArray(ch?.bonds) && ch.bonds.length >= 1
  },
  {
    id: 'firstDown',
    label: '初次倒下',
    hint: 'HP 第一次歸零。那通常是這一團最記得的一晚。',
    test: (ch) => getLog(ch).some((e) => (e.changes || []).some(
      (c) => c.field === 'currentHp' && c.to === 0
    ))
  },
  {
    id: 'firstClockDone',
    label: '完成第一個命刻',
    hint: '自己立的目標真的走完了——不是別人派的任務。',
    test: (ch) => Array.isArray(ch?.clocks) && ch.clocks.some(
      (c) => Number(c?.totalSegments) > 0 && Number(c?.filledSegments) >= Number(c?.totalSegments)
    )
  },
  {
    id: 'firstSession',
    label: '走過第一場',
    hint: '第一次完整跑完「開場 → 衝突 → 休息 → 收場」。',
    test: (ch) => getSessionCount(ch) >= 1
  },
  {
    id: 'threeBonds',
    label: '三條羈絆',
    hint: '隊伍之外也開始有牽掛——三條羈絆是六格的一半。',
    test: (ch) => Array.isArray(ch?.bonds) && ch.bonds.length >= 3
  },
  {
    id: 'exp100',
    label: '累計 100 EXP',
    hint: '成長履歷裡入帳的 EXP 總和。',
    test: (ch) => summarizeLog(getLog(ch)).expGained >= 100
  },
  {
    id: 'levelTen',
    label: '十級',
    hint: '角色等級到 10——已經是能獨當一面的英雄。',
    test: (ch) => getCharacterLevel(ch) >= 10
  },
  {
    id: 'masterClass',
    label: '精通一個職業',
    hint: `某個職業練到 ${CLASS_MAX_LEVEL} 級，解鎖它的精通技能。`,
    test: (ch) => Array.isArray(ch?.classes) && ch.classes.some((c) => Number(c?.level) >= CLASS_MAX_LEVEL)
  },
  {
    id: 'tenthSession',
    label: '第十場',
    hint: '十場不是小數字——那是一個真的走過一段路的團。',
    test: (ch) => getSessionCount(ch) >= 10
  }
]);

/**
 * 算出這張卡拿到哪些里程碑。
 *
 * 回傳 `{ total, achieved, list }`：
 *   - `list` 依 `MILESTONES` 的順序，每項 `{ id, label, hint, achieved }`
 *   - `achieved` 是已達成的那些（給「只畫已達成」的畫面用）
 *   - `total` 是總數（給 `3 / 9` 這種計數用）
 *
 * **單一條目算錯不該讓整排消失**：`test` 拋錯時當成未達成，而不是讓整個面板炸掉。
 * 這些判定會讀 `character` 的各個角落，任何一個欄位變成奇怪的形狀都可能拋錯，
 * 而里程碑只是錦上添花——它沒有資格讓跑團面板掛掉。
 */
export const deriveMilestones = (character) => {
  const list = MILESTONES.map((m) => {
    let achieved = false;
    try {
      achieved = Boolean(m.test(character));
    } catch (e) {
      achieved = false;
    }
    return { id: m.id, label: m.label, hint: m.hint, achieved };
  });
  return {
    total: list.length,
    achieved: list.filter((m) => m.achieved),
    list
  };
};

/** `3 / 9` 這種計數字串。 */
export const milestoneCountText = (summary) =>
  `${summary?.achieved?.length || 0} / ${summary?.total || 0}`;
