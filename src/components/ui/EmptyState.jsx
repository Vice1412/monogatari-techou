// SSR 護欄（`tests/*.test.mjs` 用 esbuild 打包，預設 classic JSX runtime）需要 `React` 在作用域內，
// 所以這裡保留顯式匯入——只寫 JSX 而不匯入，`npm test` 會在 render 時才炸 `React is not defined`。
import React from 'react';

/**
 * `EmptyState` —— 空狀態的唯一語法（v5.1，第十一輪）
 *
 * 為什麼要有這支元件
 * ------------------
 * 「空狀態」在這本書裡原本是**複製貼上的樣板**：十一個畫面各自抄一份虛線框＋圖示＋標題＋
 * 一句解釋，抄對的看起來一致，抄錯的（戰鬥追蹤、記錄、NPC 工坊的自訂能力）就變成
 * **一行灰字**或**一整塊靛藍**——而它們壞掉的方式一模一樣：
 *
 *   1. 只說「空」，不說「怎麼不空」（使用者看完仍然不知道下一步）
 *   2. 用 `font-mono` 寫散文（等寬字是給數字與代號的）
 *   3. 用了羊皮紙書裡不存在的色系（`indigo`／`amber-300`／`slate-500`）
 *
 * 把語法寫成元件，上面三件事就從「靠自律」變成「靠呼叫」。
 *
 * 文法（四件事，缺一不可）
 * ------------------------
 *   虛線框（`border-dashed`）　＋　`gi` 敘事圖示　＋　粗體標題　＋　一句教學
 *   第五件是選用的：**最多一個** CTA。
 *
 * 為什麼 CTA 最多一個：同一個動作在同一屏喊兩次，等於告訴使用者「這裡有兩件不同的事」。
 * 如果標頭已經有一顆「新增」，空狀態就不要再放一顆。
 *
 * 空 ≠ 查無
 * ---------
 * 這裡只服務「**空**」（還沒有東西 → 教他怎麼生出第一個）。
 * 「**查無**」（搜尋失敗 → 換個關鍵字）請留在原地，因為那時候要保留搜尋框與已輸入的字，
 * 而空狀態的職責是「從零開始」，兩者的下一步完全不同。
 *
 * @param {object}   props
 * @param {Component} props.icon    `react-icons/gi` 的敘事圖示元件（**不接受** lucide）
 * @param {string}   props.title   粗體標題：說「這裡沒有什麼」
 * @param {string}   props.teach   一句教學：說「怎麼讓它不空」
 * @param {object}   [props.action] 最多一個動作 `{ label, onClick, icon? }`
 * @param {string}   [props.kind]  `data-empty-state` 的值，供測試與截圖定位
 * @param {'paper'|'inset'} [props.tone]  `paper` = `#fffdf9`（預設）、`inset` = `#f4ebd9`
 * @param {boolean}  [props.dense]  窄欄用（托盤、側欄）：留白與圖示縮一級，文法四件不變
 * @param {string}   [props.minHeight]  例如 `'260px'`；有值時垂直置中
 * @param {string}   [props.className]  追加樣式（外距、欄寬）
 */

const TONES = {
  paper: 'bg-[#fffdf9]',
  inset: 'bg-[#f4ebd9]/60',
};

// 第十二輪：`dense` 給**窄欄**用（例：屬性矩陣的托盤只有 176px）。
// 文法不變——虛線框、gi 圖示、粗體標題、一句教學，四件都還在；只是把留白與圖示縮一級。
// 沒有這個開關的話，窄欄會逼呼叫端自己手抄一份小號空狀態，於是語法又開始分岔。
const DENSITY = {
  normal: { pad: 'px-6 py-8', icon: 'w-9 h-9', title: 'mt-2.5 text-t14' },
  dense: { pad: 'px-3 py-4', icon: 'w-6 h-6', title: 'mt-2 text-t12' },
};

export default function EmptyState({
  icon: Icon,
  title,
  teach,
  action,
  kind = 'generic',
  tone = 'paper',
  dense = false,
  minHeight,
  className = '',
}) {
  const d = DENSITY[dense ? 'dense' : 'normal'];
  return (
    <div
      data-empty-state={kind}
      style={minHeight ? { minHeight } : undefined}
      className={`text-center ${d.pad} rounded border border-[#d6c7ab] border-dashed flex flex-col items-center justify-center ${TONES[tone] || TONES.paper} ${className}`}
    >
      {Icon ? <Icon className={`${d.icon} text-[#8b5e34]`} aria-hidden="true" /> : null}
      <p className={`${d.title} font-bold text-[#2c221e] tracking-wide`}>{title}</p>
      <p className="mt-1 text-[#6b5a4b] text-t12 leading-relaxed max-w-xl">{teach}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 bg-[#8b5e34] hover:bg-[#78350f] text-[#fffdf9] px-4 py-2 rounded font-bold text-t12 flex items-center gap-1.5 transition-colors"
        >
          {action.icon ? <action.icon className="w-3.5 h-3.5" aria-hidden="true" /> : null}
          <span>{action.label}</span>
        </button>
      ) : null}
    </div>
  );
}
