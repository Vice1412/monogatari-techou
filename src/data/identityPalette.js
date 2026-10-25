/**
 * 六個身份色：全站**唯一**的定義。
 *
 * ## 為什麼要有這支（第三十八輪 §CI46）
 *
 * 這六組 `accent`／`dark` 原本存在於**兩個地方**：
 *
 * | 位置 | 用途 | 寫法 |
 * |---|---|---|
 * | `features/character-sheet/utils/characterThemes.js` | 角色卡的六個主題色 | `accent` / `accentDark` |
 * | `components/ui/ClockTracker.jsx` | 命刻的六種顏色 | `fill` / `stroke` |
 *
 * 兩邊的色碼**一字不差**，欄位名卻不一樣（`accent`/`accentDark` vs `fill`/`stroke`）。
 * 這種「同一個值、兩個名字」的抄本，正是第三十五輪 `workshopThemes` 的同一個病：
 * 抄的那一刻是對的，之後只要有人改一邊，兩邊就分家了，而**畫面上不會有任何錯誤**。
 *
 * ## 為什麼不放進 `features/character-sheet`
 *
 * `ClockTracker` 是通用元件（角色卡、戰鬥輪次、命刻頁、工匠工坊都在用），
 * 反過來 import 角色卡的模組會讓依賴方向倒過來。所以身份色放在 `src/data/`，
 * 兩邊都往下取。
 *
 * ## 三個欄位：`accent`／`dark`／`light`
 *
 * 一個身份不是一個顏色，是**一個色相的三個明度**——這是第十二輪那條判準的推論：
 *
 * > 身份可以用色相；量只能用深淺。
 *
 * `accent` 是身份本身（頭像環、頁籤、圖示、命刻的填色）；`dark` 是同一色相的
 * 深階（命刻的描邊、按鈕邊界、深底標題）；`light` 是同一色相的淺底
 * （靈力零式選中底、名詞表已選底）。
 *
 * 三個欄位都必須**單調**：`light` 最淺、`accent` 中間、`dark` 最深。
 * 這一條有護欄（H36-c）——因為「深階比本體還淺」是那種改一個字元、
 * 畫面只暗一格、看起來像設計過的錯。
 *
 * ## 為什麼 `light` 第三十八輪才搬進來
 *
 * 它原本留在 `characterThemes` 裡，理由是「六個值各用一次，是另一筆債」。
 * 但那句話是錯的：`accentLight` 用的地方是**身份色的淺底**，它跟 `accent`
 * 是同一個色相家族，不是另一個東西。留在外面就等於留一份可以各自漂移的
 * 第三份拷貝——正是這支檔案存在的理由。
 */
export const IDENTITY = Object.freeze({
  emerald: Object.freeze({ accent: '#245c45', dark: '#133829', light: '#e1eee7' }),
  amber: Object.freeze({ accent: '#9c4d16', dark: '#693108', light: '#f4ebd9' }),
  blue: Object.freeze({ accent: '#27527a', dark: '#17324c', light: '#dde7f0' }),
  crimson: Object.freeze({ accent: '#8c2d36', dark: '#58171e', light: '#f5e6e7' }),
  purple: Object.freeze({ accent: '#5e387c', dark: '#3a1f4f', light: '#eee5f5' }),
  slate: Object.freeze({ accent: '#404a58', dark: '#20262f', light: '#e6eaef' }),
});
