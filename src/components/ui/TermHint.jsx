/**
 * TermHint — 術語的「一句話說明」。
 *
 * ## 這是甚麼
 *
 * 把一個畫面本來就在用的詞包起來，滑過去（或點一下、或用鍵盤 Tab 到）就浮出一句話，
 * 說明那個詞是甚麼。定義本體在 `src/features/character-sheet/data/glossary.js`，
 * **這個元件不自己寫文案**——呼叫端傳 `entry` 進來。
 *
 * ## 為甚麼不用 `title` 屬性
 *
 * `title` 是最省的做法，但它有三個問題，而三個都剛好打中這個 App 的使用情境：
 *
 * 1. **手機和平板完全不顯示。** 這個 App 是拿來開團的，GM 桌上放的多半是平板。
 * 2. **要停 1 秒以上才會出來**，而且不能選字、不能複製。
 * 3. **鍵盤使用者聽不到**（`title` 不進無障礙樹的說明欄）。
 *
 * 所以做成真的元素：視覺使用者看到浮層，讀屏使用者在讀到這個詞時聽到定義。
 *
 * ## 為甚麼說明放進 `aria-label` 而不是 `sr-only` 的鄰居
 *
 * 第一版做成「按鈕 ＋ 旁邊一個 `sr-only` 的說明」。那是錯的，而且是**量出來的**：
 * 實機讀 `innerText` 得到「此職業有 1 個公測 **公測：官方還沒定稿…** 變體」——
 * 說明被塞進了句子的正中間。畫面上看不到（`sr-only` 被裁掉），但讀屏會照唸，
 * 於是「1 個公測變體」變成「1 個公測。官方還沒定稿…。變體」。
 *
 * 改成把那一句話放進按鈕自己的 `aria-label`：
 * 讀屏在讀到這個詞時會把定義一起唸出來，**而且不會多出一個打斷句子的文字節點**。
 * 定義仍然常駐在 DOM（是屬性，不是條件渲染），所以 SSR 快照照樣驗得到——
 * F-007 的教訓（「條件渲染的東西在快照裡跟不存在一樣」）仍然守著。
 *
 * ## 開關模型（為甚麼只有兩個狀態）
 *
 * `shown ＝ hovered 或 focused`。刻意**不做「點一下釘住」**：
 *
 * - 滑鼠：移進去開、移出去關，符合直覺；
 * - 觸控：點一下會讓按鈕取得焦點 → 開；點畫面別處 → 失焦 → 關；
 * - 鍵盤：Tab 到就開，Tab 走就關。
 *
 * 三種輸入都靠「瀏覽器本來就會做的事」（hover／focus），不需要自己判斷裝置類型——
 * 判斷裝置類型正是這一類元件最常寫錯的地方（觸控會同時觸發 mouseenter 與 click，
 * 自己寫 toggle 會變成「開了立刻又關」）。
 *
 * ## 形狀
 *
 * 術語本身：**虛線底線**（`border-b border-dotted`）——這是「這裡有東西可看」的通用記號，
 * 而且不用圖示，所以不會跟專案的「圖示三軌」規則打架。
 * 浮層：紙白底 ＋ 1px 細框 ＋ 術語粗體 ＋ 一句話，**不用 box-shadow**（v5 紅線）。
 *
 * @param {Object}  props.entry        `glossary.js` 的一筆（`{ id, term, short, alias }`）
 * @param {node}    [props.children]   畫面上要顯示的字；省略時用 `entry.term`
 * @param {string}  [props.className]  追加樣式
 * @param {'start'|'end'} [props.align='start']  浮層靠哪一邊對齊（靠右的欄位用 `end`）
 */
import React, { useState } from 'react';

export default function TermHint({ entry, children, className = '', align = 'start' }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const shown = hovered || focused;

  const label = children == null ? entry.term : children;

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        data-testid={`term-hint-${entry.id}`}
        aria-label={`${entry.term}：${entry.short}`}
        aria-expanded={shown}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setHovered(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={(e) => {
          // 這個按鈕常常長在別人的 <label> 或「整張卡可點」的容器裡。
          // 不擋掉的話，點它會順手觸發外層的選取行為。
          e.preventDefault();
          e.stopPropagation();
        }}
        className="text-left font-bold border-b border-dotted border-[#6b5a4b] hover:border-[#3c2415] focus:outline-none focus:border-[#3c2415] cursor-help"
      >
        {label}
      </button>

      {shown && (
        <span
          role="tooltip"
          data-testid={`term-tip-${entry.id}`}
          className={`absolute top-full mt-1 z-50 block w-56 max-w-[80vw] px-2.5 py-2 rounded border border-[#d6c7ab] bg-[#fffdf9] text-t11 leading-relaxed font-normal text-[#3c2415] ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          <span className="block font-bold text-[#2c221e]">{entry.term}</span>
          <span className="block mt-0.5">{entry.short}</span>
        </span>
      )}
    </span>
  );
}
