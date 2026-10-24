/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */

export const THEMES = {
  amber: {
    name: '琥珀棕',
    accent: '#9c4d16',
    accentHover: '#833f12',
    accentDark: '#693108',
    accentLight: '#f4ebd9',
    badgeBg: '#f4ebd9',
    border: '#d6c7ab',
    appBg: '#fbf7ee',
    cardBg: '#fffdf9',
    sheetBg: '#fbf7ee',
    panelBg: '#f4ebd9',
    subpanelBg: '#f4ebd9',
    headerBg: '#e8dcc4',
    exportBg: '#fbf7ee',
    textDark: '#3c2415'
  },
  blue: {
    name: '群青藍',
    accent: '#27527a',
    accentHover: '#214365',
    accentDark: '#17324c',
    accentLight: '#dde7f0',
    badgeBg: '#dde7f0',
    border: '#b6cad9',
    appBg: '#f2f5f8',
    cardBg: '#fffdf9',
    sheetBg: '#f2f5f8',
    panelBg: '#eaeff4',
    subpanelBg: '#dfe7ee',
    headerBg: '#dae3ec',
    exportBg: '#f2f5f8',
    textDark: '#142a3e'
  },
  crimson: {
    name: '硃砂紅',
    accent: '#8c2d36',
    accentHover: '#76252d',
    accentDark: '#58171e',
    accentLight: '#f5e6e7',
    badgeBg: '#f5e6e7',
    border: '#d8bec2',
    appBg: '#f8f4f5',
    cardBg: '#fffdf9',
    sheetBg: '#f8f4f5',
    panelBg: '#f2eaec',
    subpanelBg: '#ebdfe2',
    headerBg: '#e6d7db',
    exportBg: '#f8f4f5',
    textDark: '#421217'
  },
  emerald: {
    name: '翡翠青',
    accent: '#245c45',
    accentHover: '#1e4b39',
    accentDark: '#133829',
    accentLight: '#e1eee7',
    badgeBg: '#e1eee7',
    border: '#b2cdbe',
    appBg: '#f3f7f5',
    cardBg: '#fffdf9',
    sheetBg: '#f3f7f5',
    panelBg: '#ebf2ee',
    subpanelBg: '#e1ece5',
    headerBg: '#dae6df',
    exportBg: '#f3f7f5',
    textDark: '#133829'
  },
  purple: {
    name: '秘術紫',
    accent: '#5e387c',
    accentHover: '#4f2e67',
    accentDark: '#3a1f4f',
    accentLight: '#eee5f5',
    badgeBg: '#eee5f5',
    border: '#ccbfdb',
    appBg: '#f7f4f9',
    cardBg: '#fffdf9',
    sheetBg: '#f7f4f9',
    panelBg: '#f1eaf6',
    subpanelBg: '#e9dfef',
    headerBg: '#e3d6ea',
    exportBg: '#f7f4f9',
    textDark: '#321646'
  },
  slate: {
    name: '鐵石灰',
    accent: '#404a58',
    accentHover: '#303844',
    accentDark: '#20262f',
    accentLight: '#e6eaef',
    badgeBg: '#e6eaef',
    border: '#c0c8d2',
    appBg: '#f5f6f8',
    cardBg: '#fffdf9',
    sheetBg: '#f5f6f8',
    panelBg: '#eceff3',
    subpanelBg: '#e2e6ec',
    headerBg: '#d9dfe6',
    exportBg: '#f5f6f8',
    textDark: '#1b212b'
  }
};
