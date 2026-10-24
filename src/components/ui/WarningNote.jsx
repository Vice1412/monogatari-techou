/**
 * WarningNote — 「提醒／違規」這一類警示面的**唯一**形狀。
 *
 * ## 為甚麼要有這個元件（量測，不是推理）
 *
 * §CI34（第二十六輪）把警示的顏色拿掉，改成「零色 ＋ `▲` ＋ 墨左條 ＋ 粗體標題」。
 * 第二十七輪的殘債清單第一條是「警示的可讀性沒有實測」，連列兩輪。第二十八輪把它量了
 * （`scratch/r28_shot.mjs`，截圖 `scratch/r28-*-before.png`）：
 *
 * | 情境 | 量到的形狀 | 讀得出來嗎 |
 * |---|---|---|
 * | `ErrorBoundary` inline | 紙底 ＋ 細框 ＋ 方形圖示磚 ＋ 紅色「重試載入」按鈕 | **是**——紅在按鈕上，不在框上 |
 * | `ChapterDevWarningModal` | 紙底 ＋ 細框 ＋ **方形圖示磚** ＋ 粗體標題 ＋ WIP 徽章 | **是** |
 * | Boss 技能超額 | 紙底 ＋ 細框 ＋ 裸 `▲` ＋ 粗體標題 | **否**——跟「步驟 N」導言一模一樣 |
 *
 * 所以問題不在「零色讓警示消失」（§CI34 的取捨是對的），而在**形狀沒有所有權**：
 * `NPCWorkshop` 有 8 個「步驟 N：…」的導言穿著同一組 class
 * （`bg-[#f4ebd9] border-l-4 border-[#3c2415] p-4 rounded …`），
 * 於是「紙底 ＋ 左條 ＋ 粗體標題」在畫面上等於「章節導言」，不等於「這裡有事」。
 *
 * ## 這個元件的形狀是「抄」來的，不是發明的
 *
 * 上表唯一讀得出來的**頁內**警示（Boss 那兩個是失敗案例，彈窗是不同情境）用的是
 * **方形圖示磚**。所以這個元件就長那樣：
 *
 *   紙底 `#f9f5eb` ＋ 1px 細框 ＋ 7×7 的方形圖示磚（`#f4ebd9` 底 ＋ `#d6c7ab` 框）＋ 粗體標題 ＋ 墨階內文
 *
 * ## 為甚麼**沒有**左條
 *
 * 左條在 §CI34 之後已經被**出處**用掉了：`EditableSkill`／`ReadOnlySkill`／咒語卡
 * 用 `border-l-4` 標「這張技能卡從哪來」。如果警示也用左條，就變成「一個形狀兩個意思」——
 * 那正是這一輪要修的病。所以警示改用**圖示磚**，把左條完整留給出處。
 *
 * ## 語氣
 *
 * | tone | 什麼時候用 | 長什麼樣 |
 * |---|---|---|
 * | `note`（預設） | 手冊建議、資料落差——**不會壞事** | 墨圖示 ＋ 墨標題，**零色相** |
 * | `danger` | 違規、超額、重複——**已經出事了** | 登記危險紅 `#8c2d36` 的圖示、標題與 50% 框 |
 *
 * @param {node}    props.title    一句話說「什麼事」（粗體，`text-t12`）
 * @param {node}    [props.children]  一句話說「所以呢」（可省略）
 * @param {'note'|'danger'} [props.tone='note']
 * @param {string}  [props.className]  追加樣式（外距）
 */
import React from 'react';
import { GiHazardSign } from 'react-icons/gi';

const TONES = {
  note: {
    wrap: 'bg-[#f9f5eb] border-[#d6c7ab]',
    tile: 'bg-[#f4ebd9] border-[#d6c7ab]',
    icon: 'text-[#6b5a4b]',
    title: 'text-[#2c221e]',
    body: 'text-[#3c2415]',
  },
  danger: {
    wrap: 'bg-[#f9f5eb] border-[#8c2d36]/50',
    tile: 'bg-[#f4ebd9] border-[#8c2d36]/50',
    icon: 'text-[#8c2d36]',
    title: 'text-[#8c2d36]',
    body: 'text-[#3c2415]',
  },
};

export default function WarningNote({ title, children, tone = 'note', className = '' }) {
  const t = TONES[tone] || TONES.note;
  return (
    <div data-warning-note={tone} className={`border rounded px-3.5 py-3 ${t.wrap} ${className}`}>
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`w-7 h-7 rounded border flex items-center justify-center shrink-0 ${t.tile}`}
        >
          <GiHazardSign className={`w-4 h-4 ${t.icon}`} />
        </span>
        <div className="min-w-0">
          <p className={`font-bold text-t12 ${t.title}`}>{title}</p>
          {children ? <p className={`mt-1 text-t12 leading-relaxed ${t.body}`}>{children}</p> : null}
        </div>
      </div>
    </div>
  );
}
