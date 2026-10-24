/** @type {import('tailwindcss').Config} */

/**
 * 《物語手帳》設計權杖（v5「全程淺色 · 冷暖分層」）
 *
 * 設計裁決基準見 `design-mockups/design-tokens-v5.html`（非版控）。
 * 核心原則：**全程淺底 ＋ 深字**，層次靠「冷暖溫差」而非「明暗對比」。
 *
 * ⚠️ 這是過渡期設定。`theme.extend.colors` 同時保留 v1 的 `parchment`
 * 與 v5 的 `cool` / `warm` / `ink` / `signal`，讓 v1 舊稿與 v5 新稿並存，
 * 可逐畫面遷移、不必一次全改。遷移完成後 `parchment` 整組應移除。
 */
export default {
  /**
   * `darkMode: 'class'` —— 這一鍵是「全程淺色」的守門人（2026-10-23，第十三輪）。
   *
   * 沒有這一鍵時，Tailwind 預設 `media`：**作業系統是深色的使用者，會自動拿到
   * `dark:` 那一套 slate 深色面板**。那不是這本書——本書的深淺由 `data-theme`
   * （`cool` 操作區／`warm` 閱讀區）承擔，是同一套色票的兩種溫度，不是亮版／暗版。
   *
   * 現在 `dark:` 令牌已全數刪除（1,323 個），這一行是**第二道鎖**：
   * 日後若有人再寫 `dark:`，`class` 模式下沒有 `.dark` 祖先，它永遠不會生效。
   */
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── v5 冷區：操作型畫面（戰鬥輪次、建角流程、擲骰結算）───────── */
        cool: {
          0: '#e9edf0',
          1: '#dfe5ea',
          2: '#ccd6dd',
          line: '#a8b6c0',
          'line-2': '#8a9aa6',
        },

        /* ── v5 暖區：閱讀型畫面（角色卡、規則速查、NPC 工坊）─────────── */
        warm: {
          0: '#f7f3e8',
          1: '#efeade',
          2: '#e4dcc9',
          line: '#c5bba4',
          'line-2': '#a1957c',
        },

        /* ── v5 共用墨色（兩區皆用，確保文字對比一致）──────────────────
           2026-10-23（v5.1）：`ink.3` 由 `#8b95a3` 改為 `#5f6a78`。
           實測 `#8b95a3` 在 `#fffdf7` 上只有 **2.98:1**、在 `#f7f3e8` 上 **2.73:1**，
           低於 WCAG AA 的 4.5:1——它原本被當成「三級文字色」使用，等於全站
           最小最淡的那批字全部不合規（Refactoring UI「Accessible doesn't have
           to mean ugly」）。新值在 paper 上 5.41:1、ui-0 上 4.96:1、ui-2 上 4.58:1。
           ※ 這是**文字色**；純裝飾線請用 `warm.line` / `cool.line`，別拿 ink.3 當邊框。 */
        ink: {
          DEFAULT: '#2a3240',
          2: '#5c6878',
          3: '#5f6a78',
        },

        /* ── v5 訊號色（資源與狀態，跨區統一）──────────────────────── */
        signal: {
          accent: '#a63d40',
          hp: '#b83b34',
          mp: '#3a6f96',
          ip: '#a8781f',
          ok: '#3d7a55',
        },

        /* ── v1 羊皮紙色盤（過渡期保留，逐畫面淘汰）────────────────────
           來源：專案初始版本。與 v5 並存中，勿在新稿使用。 */
        parchment: {
          DEFAULT: '#fbf7ee',
          card: '#fffdf9',
          panel: '#f5efdf',
          subpanel: '#f4ebd9',
          header: '#f4ebd9',
          border: '#d6c7ab',
          'border-light': '#e4d9c0',
          text: '#2c221e',
          dark: '#3c2415',
          muted: '#6b5a4b',
          amber: '#b45309',
          'amber-hover': '#92400e',
          'amber-dark': '#8b5e34',
          'amber-light': '#fef3c7',
          badge: '#fbf3de'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', '"微軟正黑體"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Cinzel"', '"Noto Serif TC"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        fu: ['"Fabula Ultima Icons"', 'sans-serif'],
        /* v5：像素基因只給數字／英文／拉丁標籤（中文無可讀像素字型） */
        pixel: ['"Press Start 2P"', '"JetBrains Mono"', 'monospace'],
      },
      /* v5.1 字級階梯（Refactoring UI「Establish a type scale」）
         ────────────────────────────────────────────────────────────
         七級，比例約 1.25（16 → 20 → 25 → 31 → 39），向下兩級 14 / 12。
         行高與字級**成反比**（大字 1.1、內文 1.6、小字 1.6）——這是書中
         「Line-height is proportional」的實作：小字需要更多相對行距才不會黏成一團。

         ## 第三十五輪（2026-10-24 §CI43）：微字階 t10／t11 正式登記

         原本這裡只有七級，而全站有 **775 處** `text-[10px]`／`text-[11px]`。
         這不是「有人偷懶」——是這本書真的需要一個**微字階**：屬性矩陣的欄頭、
         骰面、`d6`／`+3` 這種晶片、密集表格的列標籤。七級裡最接近的是 t12，
         但把它們全部抬到 12px 會擠壞 `max-w-[54px]` 這一類固定寬度的格子。

         所以判準與第三十四輪登記珠色相同：**這是真的階梯，不是漂移 → 登記它。**
         真正是漂移的是另外 26 處（8／9／13／15／16／17／22px），它們收斂到最近的階。

         ⚠️ `t10`／`t11` **刻意不設 lineHeight**，與其他七級不同。
         理由：這兩階只用在表格列與晶片，列高由 padding 決定，設了 leading 會把
         密集表格撐開；而且這樣 `text-t10` 的計算值與 `text-[10px]` **完全相同**
         （兩者都繼承父層的 `normal`），775 處改寫不會動到一行版面。
         其餘五級照舊帶行高——它們是給句子用的。 */
      fontSize: {
        t10: ['10px'],
        t11: ['11px'],
        t12: ['12px', { lineHeight: '1.6' }],
        t14: ['14px', { lineHeight: '1.55' }],
        t16: ['16px', { lineHeight: '1.6' }],
        t20: ['20px', { lineHeight: '1.45' }],
        t25: ['25px', { lineHeight: '1.3' }],
        t31: ['31px', { lineHeight: '1.2' }],
        t39: ['39px', { lineHeight: '1.1' }],
      },
      /* v5.1 高度階梯（Refactoring UI「Shadows can have two parts」）
         每一級都是「貼身陰影 ＋ 遠景陰影」兩層：單層陰影是 CSS 的特徵，
         兩層才是自然光。只用於**真的浮起來的東西**（浮層、模態、書本物件）；
         一般面板靠冷暖和色差分層，不加陰影（見 index.css 的 v5 註解）。 */
      boxShadow: {
        e1: '0 1px 1px rgba(42, 50, 64, 0.05), 0 2px 4px -1px rgba(42, 50, 64, 0.06)',
        e2: '0 2px 4px -1px rgba(42, 50, 64, 0.07), 0 8px 16px -4px rgba(42, 50, 64, 0.10)',
        e3: '0 4px 8px -2px rgba(42, 50, 64, 0.08), 0 18px 36px -12px rgba(42, 50, 64, 0.16)',
      },
      /* v5：硬邊為主。2026-10-23 把階梯收斂成 2/3/4 三級——
         原本 `rounded-xl` 是 12px、`rounded-2xl` 是 16px，與 v5 的「圓角上限 2px」
         直接矛盾，而全站有 341 處 `rounded-xl`、41 處 `rounded-2xl`。
         這裡用**設定層**一次收斂（圓角不影響版面尺寸，不會爆版），
         而不是逐檔手改 380 處。 */
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '3px',
        lg: '3px',
        xl: '3px',
        '2xl': '4px',
        '3xl': '6px',
        ui: '2px',
        book: '4px',
      },
      /* v5：操作回饋 120–200ms，不用彈性曲線 */
      transitionDuration: {
        120: '120ms',
        160: '160ms',
        200: '200ms',
      },
    },
  },
  plugins: [],
}
