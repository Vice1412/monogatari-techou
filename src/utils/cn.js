import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * 全站唯一的 class 合併器。
 *
 * ## 為什麼不能直接用 `twMerge`
 *
 * `tailwind-merge` 只認識 Tailwind **內建**的字級階梯（`text-xs`／`text-sm`／
 * `text-2xl`…）。專案的字級是自訂令牌（`text-t10`…`text-t39`，見
 * `tailwind.config.js` 的 `fontSize`），它不認得，於是 `text-t12` 落進
 * **「文字顏色」**那一組。
 *
 * 而 `twMerge` 的規則是「同一組只留最後一個」——所以：
 *
 * ```js
 * twMerge('text-[#fffdf9] text-t12')
 * // → 'text-t12'      ← 顏色被刪掉了，不是被覆蓋，是消失了
 * ```
 *
 * 第四十三輪量到的後果：`JRPGButton` 的 `variantStyles` 在前、`sizeStyles` 在後，
 * 於是 **58 顆按鈕的顏色全部被自己的字級吃掉**。其中 36 顆是 `primary`
 * （深紅底 `#a63d40` ＋ 預期淺字 `#fffdf9`）——顏色沒了，字就繼承父層的墨色，
 * 變成**深紅底配深墨字，整個讀不到**。另外 22 顆（secondary／outline／ghost）
 * 是淺底深字，繼承來的墨色剛好對，所以**同一個 bug 在四分之三的按鈕上看不出來**。
 *
 * 同一個病也在 `JRPGBadge` 的 `rank-top`（`#2c221e` 底 ＋ `#e8dcc4` 字）與
 * `rank-mid`（`#7c6a58` 底 ＋ `#fbf7ee` 字）上——冠位徽章的字同樣是淺色被刪。
 *
 * ## 修法
 *
 * 把專案的字級令牌登記進 `font-size` 組，讓 `text-t12` 與 `text-[#fffdf9]`
 * 分屬兩組、互不衝突。
 *
 * ## 這份清單必須跟 `tailwind.config.js` 的 `fontSize` 一致
 *
 * 兩邊不一致的話，新加的字級令牌會**安靜地回到「顏色」組**，
 * 於是同樣的 bug 再長一次。`tests/uiSystem.test.mjs` 的 `H40-b` 逐鍵比對
 * 兩份清單（從 `twConfig` 讀，不另外抄一份），漏登記就會紅。
 *
 * ## 全站只准這裡 import `tailwind-merge`
 *
 * `H40` 是硬零：其他檔案直接 `import { twMerge } from 'tailwind-merge'`
 * 就等於繞過這份設定。要合併 class 一律用 `cn()`。
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      /* 與 tailwind.config.js 的 theme.extend.fontSize 一一對應 */
      'font-size': [{ text: ['t10', 't11', 't12', 't14', 't16', 't20', 't25', 't31', 't39'] }],
    },
  },
});

/**
 * 合併 class 字串：`clsx` 負責條件與陣列，`twMerge` 負責去重。
 *
 * @param {...any} inputs 任意 `clsx` 接受的輸入
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
