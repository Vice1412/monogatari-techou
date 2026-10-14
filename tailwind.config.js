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

        /* ── v5 共用墨色（兩區皆用，確保文字對比一致）────────────────── */
        ink: {
          DEFAULT: '#2a3240',
          2: '#5c6878',
          3: '#8b95a3',
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
      /* v5：硬邊為主，圓角上限 2px */
      borderRadius: {
        DEFAULT: '2px',
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
