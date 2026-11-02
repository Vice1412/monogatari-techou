import React from 'react';

/**
 * DQ 風格視窗框（2026-11-02，P13）
 * ────────────────────────────────────────────────────────────────
 * 使用者的原話（他對 Antigravity 說的）：
 *   「我觉得目前的跑团界面讯息太多了，有点冗长。我希望能更有 RPG 游戏的
 *     menu 界面的感觉，让玩家操作起来更有玩 RPG 的感觉。」
 * 他挑的參考骨架是 **Dragon Quest**。
 *
 * DQ 的選單長什麼樣（骨架，不是配色）：**一個視窗就是一件事**。
 * 外框一條粗線、裡面再一條細線（雙線框），左上角一枚菱形當視窗標記，
 * 標題寫在框頂，內容在框內。全站羊皮紙暖色調不變——借的是**分割方式**，
 * 不是 DQ 的深藍底。
 *
 * 為什麼不直接做成一張大卡：大卡把「資源」「能力」「指令」全放在同一個
 * 平面裡，玩家要自己找。切成一格一格的視窗之後，「這塊在講什麼」由框自己回答。
 *
 * 顏色全部用既有的羊皮紙階（`#fbf7ee`／`#fffdf9`／`#f4ebd9`／`#e8dcc4`／
 * `#d6c7ab`），**沒有一條漸層、沒有一個 rgba**——設計系統的
 * 「漸層只存在於登記過的檔案」與 H36-a 在這裡不適用，因為這裡根本沒用到。
 */
export const HudWindow = ({
  title,
  icon: Icon = null,
  right = null,
  children,
  testId,
  headerTestId = null,
  className = '',
  bodyClassName = '',
  frameColor = '#d6c7ab',
  headerColor = '#f4ebd9'
}) => (
  <section
    data-testid={testId}
    className={`flex flex-col min-h-0 rounded border-2 p-[3px] bg-[#fbf7ee] ${className}`}
    style={{ borderColor: frameColor }}
  >
    <div className="flex-1 min-h-0 flex flex-col rounded border border-[#e8dcc4] bg-[#fffdf9] overflow-hidden">
      {title ? (
        <header
          data-testid={headerTestId || undefined}
          className="flex items-center justify-between gap-2 px-2.5 py-1 border-b border-[#e8dcc4] shrink-0"
          style={{ backgroundColor: headerColor }}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-t10 leading-none shrink-0 text-[#a63d40]" aria-hidden="true">◆</span>
            {Icon ? <Icon className="w-3.5 h-3.5 shrink-0 text-[#6b5a4b]" /> : null}
            <span className="font-serif font-black text-t12 tracking-wide text-[#2c221e] truncate">{title}</span>
          </span>
          {right}
        </header>
      ) : null}
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </div>
  </section>
);

/**
 * DQ 指令窗（垂直清單 ＋ ▶ 游標）
 * ────────────────────────────────────────────────────────────────
 * 原本中欄是**六顆 2×3 的格子**，底下 sticky 分頁列又是**同一份六個標籤**——
 * 同一份清單出現兩次，這就是「訊息太多」的來源之一。
 *
 * 現在只剩這一份，而且是 DQ 的樣子：一列一個指令，選中的那一列左邊有 `▶`、
 * 整列反白。
 *
 * **列高固定 44px（P14）**，不再 `flex-1` 撐滿欄位。使用者的原話：
 *   「不要这么宽松的话，我建议把左栏的长压缩，给右栏更多显示信息的空间」
 * P13 讓列撐滿是為了吃掉左翼的空白；P14 內容搬到右翼之後，左翼本來就該短，
 * 撐滿反而把「一份清單」變成「八條巨大的橫幅」——而且按下之後要滾很遠才看到內容。
 * 撐滿消失後，空白落在**窗戶下方**（不是窗戶裡面），看起來是留白而不是壞掉。
 *
 * `sub` 不放進列裡（那就是「字太多」），改放 `title`——
 * 滑過去或長按才看到說明。這正是使用者要的「說明改成 hover 才出現」。
 */
export const HudCommandList = ({
  items,
  value,
  onChange,
  testId,
  activeColor = '#a63d40',
  activeBorder = '#8c3235'
}) => (
  <div data-testid={testId} className="flex flex-col gap-1 p-1.5">
    {items.map((item) => {
      const Icon = item.icon;
      const active = item.id === value;
      return (
        <button
          key={item.id}
          type="button"
          data-testid={`hud-cmd-${item.id}`}
          data-active={active ? 'true' : 'false'}
          aria-current={active ? 'page' : undefined}
          onClick={() => onChange(item.id)}
          title={item.sub ? `${item.label}：${item.sub}` : item.label}
          className={`shrink-0 min-h-[44px] w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-left transition-colors ${
            active
              ? 'text-[#fffdf9]'
              // 未選中的列**不帶框**：帶了框就變成「七張卡」，而指令窗是一份清單。
              // 只有選中的那一列有底色與框——這正是 DQ 的游標語彙。
              : 'bg-transparent hover:bg-[#f4ebd9] text-[#3c2415] border-transparent'
          }`}
          style={active ? { backgroundColor: activeColor, borderColor: activeBorder, color: '#fffdf9' } : {}}
        >
          <span className="w-2.5 shrink-0 text-t10 font-black leading-none" aria-hidden="true">
            {active ? '▶' : ''}
          </span>
          {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
          {/* 列的高度由欄位決定（`flex-1`），所以列裡要裝得下「不只是標題」：
              標題一行的話，129px 的列看起來就是一個空按鈕。
              兩行（名稱＋說明）之後，列越高越像一個真的指令，
              而不是一個被拉長的空白。說明本來放在 title（hover 才看得到），
              這裡再印一次小字——不是重複，是因為列已經夠高，不印才是浪費。 */}
          <span className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
            <span className="font-bold text-t14 truncate">{item.label}</span>
            {item.sub ? (
              <span className={`text-t11 truncate ${active ? 'text-[#fffdf9]/80' : 'text-[#7c6a58]'}`}>
                {item.sub}
              </span>
            ) : null}
          </span>
          {item.count != null ? (
            <span className={`shrink-0 font-mono tabular-nums text-t12 ${active ? 'text-[#fffdf9]/85' : 'text-[#7c6a58]'}`}>
              {item.count}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

export default HudWindow;
