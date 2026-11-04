/**
 * 屬性檢定的「點擊語意」（2026-11-03）。
 *
 * ## 為什麼要有這支
 *
 * 使用者回報：「界面如此多按鈕，怎麼知道讓玩家該點哪個？點了還得跳個彈窗叫我選
 * 另一個骰子，我咋知道第二顆是什麼？」
 *
 * 舊版的答案是把「選第一顆」和「選第二顆」拆成兩種按鈕（大卡＝單屬性檢定、
 * 旁邊小鈕＝配對）。玩家要在兩處之間來回，而且**彈窗一開就蓋住整排屬性**。
 *
 * 新版的答案只有一句：**點第一張記住它，再點任何一張就擲那兩顆。**
 * 但這句話本身是一個判定（`firstKey` 有沒有值？跟下一張是不是同一張？），
 * 而判定寫在 `onClick` 裡就**SSR 測不到**（§AW6(b) 的老問題：SSR 不執行事件）。
 * 所以抽成純函式，讓「第一次點是選、第二次點是擲」有會失敗的斷言。
 *
 * ## 為什麼 label 要帶骰面
 *
 * `DEX(d8) + INS(d10)` 而不是 `DEX + INS`：玩家按下之後彈窗會蓋住屬性卡，
 * 唯一還看得到的線索就是這句話。少了骰面，他得先關掉彈窗才知道自己在擲什麼
 * ——那正是使用者抱怨的那件事。
 */

/** 四個屬性的鍵，順序即介面順序（與屬性橫排一致）。 */
export const ATTRIBUTE_CHECK_KEYS = ['dex', 'ins', 'mig', 'wlp'];

/**
 * 把「這次點擊」翻成「該做什麼」。
 *
 * @param {object}   args
 * @param {string|null} args.firstKey 目前記住的首骰（null＝還沒選）
 * @param {string}   args.nextKey     這次點到的屬性鍵
 * @param {(key:string)=>number} [args.dieOf] 取該屬性當前骰面
 * @returns {{mode:'select', key:string} | {mode:'roll', die1:number, die2:number, label:string}}
 */
export const describeAttributeCheck = ({ firstKey, nextKey, dieOf }) => {
  const die = (key) => {
    const v = typeof dieOf === 'function' ? Number(dieOf(key)) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 8;
  };
  if (!firstKey) return { mode: 'select', key: nextKey };

  const a = die(firstKey);
  const b = die(nextKey);
  const isSingle = firstKey === nextKey;
  return {
    mode: 'roll',
    die1: a,
    die2: b,
    // 同一張點兩次＝純屬性檢定（X+X）。原書的檢定永遠是兩顆骰，
    // 所以「只檢定一項屬性」也是同屬性兩顆，不是一顆。
    label: `${String(firstKey).toUpperCase()}(d${a}) + ${String(nextKey).toUpperCase()}(d${b})${isSingle ? ' 單項檢定' : ''}`
  };
};
