/**
 * NPC 工坊 UI 契約測試（SSR 冒煙測試）。
 *
 * 執行：`npm run test:npcworkshopui`（已納入 `npm test` 串接）
 *
 * 為什麼要有這個檔案（2026-10-16 建立）：
 * `NPCWorkshop.jsx` 是全專案最大的單一檔案（見 `docs/functional-audit-2026-10-16.md` §5）。
 * `tests/npcWorkshop.test.mjs` 只護住「引擎純函式」，**完全沒有護住元件本身**——
 * 也就是說，把 50 個 `useState` 搬位置、把 69 個 JSX 區塊拆出去時，
 * 打錯一個識別字並不會讓 `npm run build` 失敗（打包器對「未定義的自由變數」
 * 只會當成全域變數，不報錯），而是**執行期才炸，或更糟：靜默改畫面**。
 *
 * 本檔用 `react-dom/server` 真的把元件渲染一次，任何未定義識別字都會
 * 直接拋 `ReferenceError`，被這裡接住。這是拆檔前的最低限度安全網。
 *
 * ※ 這是**冒煙測試**，不是快照測試：只驗「渲染得出來 + 幾個關鍵字還在」。
 *   刻意的——版面細節會一直動，把版面寫死進斷言只會製造假警報。
 *
 * ※ 覆蓋範圍（2026-10-16 更新）：E 段透過元件的**測試注入點 props**
 *   （`initialDraft`／`initialMainTab`／`initialStep`）把 8 道建角步驟逐一渲染，
 *   因此 `renderStepContent`（約 2,100 行）**現在有護欄了**。
 *   過去它完全測不到——因為 `state` 只能由使用者點擊產生，而 SSR 不執行事件。
 * ※ 仍然誠實聲明**測不到的部分**：`onClick` 內的邏輯（SSR 不執行事件）。
 *   那部分依 §AW9 第 3 條，要抽成純函式才測得到（例如 `buildNpcText`）。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NPCWorkshop from '../src/features/npc-workshop/NPCWorkshop.jsx';
import CopyButton from '../src/features/npc-workshop/components/CopyButton.jsx';
import SectionAccordion from '../src/features/npc-workshop/components/SectionAccordion.jsx';
import SkillCard from '../src/features/npc-workshop/components/SkillCard.jsx';
import SpellCard from '../src/features/npc-workshop/components/SpellCard.jsx';
import EditableSkill from '../src/features/npc-workshop/components/EditableSkill.jsx';
import ReadOnlySkill from '../src/features/npc-workshop/components/ReadOnlySkill.jsx';
import FreeModeConfirmModal from '../src/features/npc-workshop/components/FreeModeConfirmModal.jsx';
import AvatarCropperModal from '../src/features/npc-workshop/components/AvatarCropperModal.jsx';
import { createNewNPC } from '../src/features/npc-workshop/utils/npcEngine.js';
// F 段（建角草稿讀回）需要注入儲存後端與權威鍵常數：
// 直接墊一個假 localStorage 會測到「假的 store」，而草稿的洞正是發生在真 store 上。
import { STORAGE_KEYS } from '../src/data/keys.js';
import { __setStorageBackend } from '../src/data/store.js';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, ok, detail = '') => {
  if (ok) { pass += 1; lines.push(`  ✓ ${label}`); }
  else { fail += 1; lines.push(`  ✗ ${label}${detail ? `　→ ${detail}` : ''}`); }
};

// ── 瀏覽器環境墊片 ────────────────────────────────────────────
// NPCWorkshop 在 `useState` 的初始值就直接讀 `window.innerWidth`（判斷是否手機版），
// 而 Node 沒有 window。SSR 不執行 useEffect，所以只需要「讀得到」即可。
// 這裡刻意只墊最小的表面，不引入 jsdom——墊得越多，測到的越不是真實行為。
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    confirm: () => false,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    activeElement: null,
    createElement: () => ({ style: {}, appendChild: () => {}, removeChild: () => {}, setAttribute: () => {} }),
    getElementById: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {}, removeChild: () => {} },
    head: { appendChild: () => {} },
  };
}

const renderWorkshop = (width) => {
  globalThis.window.innerWidth = width;
  return renderToStaticMarkup(React.createElement(NPCWorkshop, {
    setHeaderExtraLeft: () => {},
    setHeaderExtraRight: () => {},
    onSubNavChange: null,
  }));
};

// ── A. 桌機版渲染 ─────────────────────────────────────────────

lines.push('');
lines.push('A. 元件渲染冒煙測試（桌機 1280px）');

let desktopHtml = '';
let desktopError = null;
try {
  desktopHtml = renderWorkshop(1280);
} catch (e) {
  desktopError = e;
}

check(
  'NPCWorkshop 預設狀態可以渲染完成（不拋例外）',
  desktopError === null,
  desktopError ? `${desktopError.name}: ${desktopError.message}` : ''
);

if (desktopError === null) {
  check('輸出不是空字串', desktopHtml.length > 0, `長度 ${desktopHtml.length}`);
  check('輸出具備實質內容（> 2000 字元）', desktopHtml.length > 2000, `長度 ${desktopHtml.length}`);

  // 關鍵字：只挑「使用者一定看得到、且不該消失」的文案。
  // 這些字串是元件樹確實被走訪過的證據——若拆檔時某個區塊被漏掉，
  // 輸出會整段消失，這裡就會紅。
  const anchors = [
    // 2026-10-23（v5.1）：預設渲染是**空檔案庫**，此時工具列的「建立新 NPC」依設計
    // **不顯示**（同一動作不得有兩顆按鈕，見 `docs/decisions.md` §CI）。空狀態的
    // 「建立第一位 NPC」才是這一屏的主要動作，故錨點改指它。
    ['主要動作按鈕「建立第一位 NPC」', '建立第一位 NPC'],
    ['空檔案庫提示文案', '檔案庫目前空空如也'],
  ];
  anchors.forEach(([label, needle]) => {
    check(`輸出包含${label}`, desktopHtml.includes(needle), `找不到「${needle}」`);
  });
}

// ── B. 手機版渲染 ─────────────────────────────────────────────
// 同一個元件在 `isMobile` 為真時會走另一條 JSX 分支。
// 兩條分支都要渲染得出來，否則「桌機正常、手機白畫面」這種災難不會被發現。

lines.push('');
lines.push('B. 手機分支渲染（500px）');

let mobileError = null;
let mobileHtml = '';
try {
  mobileHtml = renderWorkshop(500);
} catch (e) {
  mobileError = e;
}

check(
  'isMobile 為真時仍可渲染完成（不拋例外）',
  mobileError === null,
  mobileError ? `${mobileError.name}: ${mobileError.message}` : ''
);
if (mobileError === null) {
  check('手機版輸出具備實質內容（> 2000 字元）', mobileHtml.length > 2000, `長度 ${mobileHtml.length}`);
}

// ── C. 抽出的獨立元件逐個渲染 ─────────────────────────────────
// 2026-10-16 拆檔第一批把 8 個元件搬出 `NPCWorkshop.jsx`。
// 搬家的最大風險是「新檔案漏了一個 import」——而打包器對未定義的自由變數
// **不會報錯**（只當成全域變數），所以「build 成功」不代表搬對了。
// 這一節把每個抽出的元件都真的渲染一次：漏 import 就會在這裡拋 ReferenceError。
//
// ※ 元件預設狀態不一定渲染得到（例如技能卡要在「已選取」時才長出子區塊），
//   因此每個元件都刻意用「已啟用」的 props 餵它，讓分支盡量被走到。

lines.push('');
lines.push('C. 抽出的獨立元件逐個渲染');

const noop = () => {};

const mockSkill = {
  id: 's_test', libId: 's_test', originalName: '測試技能', customName: undefined,
  originalDesc: '造成 {type} 傷害', customDesc: undefined, category: 'rule',
  flavorText: '測試用說明', selections: {}, selectionsConfig: null,
};
const mockAttackSkill = {
  ...mockSkill, id: 'a_test', libId: 'a_test', originalName: '測試攻擊', category: 'attack',
  attack: { distance: '近戰', formula: '【靈】+【靈】', baseDmg: 5, type: '物理' },
};
const mockStats = { Acc: 0, Dmg: 0 };

const RENDER_CASES = [
  ['CopyButton', CopyButton, { text: '要複製的內容' }],
  ['SectionAccordion', SectionAccordion, { title: '測試區塊', icon: null, current: 0, max: 1, children: '內容' }],
  ['SkillCard（一般技能）', SkillCard, {
    skill: mockSkill, isActive: true, isDisabled: false, isOverBudget: false, lockedMsg: null,
    onToggle: noop, onSelectionChange: noop, onUpdateSkill: noop, npcLevel: 5, partyLevel: 5,
  }],
  ['SkillCard（攻擊技能分支）', SkillCard, {
    skill: mockAttackSkill, isActive: true, isDisabled: false, isOverBudget: false, lockedMsg: null,
    onToggle: noop, onSelectionChange: noop, onUpdateSkill: noop, npcLevel: 5, partyLevel: 5,
  }],
  ['SpellCard', SpellCard, {
    skillId: 'sp1', spellName: '火球', isActive: true, isDisabled: false, isOverBudget: false,
    isClaimedElsewhere: false, onToggle: noop, selections: {}, selectionsConfig: null,
    onSelectionChange: noop, isSecretArt: false, npcLevel: 5, partyLevel: 5,
  }],
  ['EditableSkill', EditableSkill, {
    skill: mockSkill, rawSkill: mockSkill, onUpdate: noop, onDelete: noop,
    onUpdateSelection: noop, finalStats: mockStats, npcLevel: 5, partyLevel: 5,
  }],
  ['ReadOnlySkill', ReadOnlySkill, {
    skill: mockSkill, finalStats: mockStats, npcName: '測試 NPC',
    npcLevel: 5, partyLevel: 5, onInspectorClick: noop,
  }],
  ['FreeModeConfirmModal', FreeModeConfirmModal, { isOpen: true, onClose: noop, onConfirm: noop }],
  ['AvatarCropperModal', AvatarCropperModal, {
    isOpen: true, imageSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    onClose: noop, onConfirm: noop,
  }],
];

RENDER_CASES.forEach(([label, Component, props]) => {
  let err = null;
  let out = '';
  try {
    out = renderToStaticMarkup(React.createElement(Component, props));
  } catch (e) {
    err = e;
  }
  check(
    `${label} 可獨立渲染`,
    err === null && out.length > 0,
    err ? `${err.name}: ${err.message}` : `輸出長度 ${out.length}`
  );
});

// ── E. 建角流程 8 道步驟（2026-10-16 拆檔第三階段前置） ─────────
// 為什麼要有這一節：
// `renderStepContent`（約 2,100 行，佔全檔近一半）過去**完全沒有護欄**——
// 它需要 `state !== null` 才渲染，而 `state` 原本只能由使用者點擊產生，
// SSR 不執行事件，所以碰不到。
// 元件已加上三個**測試注入點** props（`initialDraft`／`initialMainTab`／`initialStep`），
// 生產端永不傳入。這一節利用它們把 8 道步驟逐一渲染一次。
//
// ※ 這一節**只是安全網的第一步**：它證明「每一步都渲染得出來、且關鍵文案還在」，
//   證明不了「版面一模一樣」。真正要搬這 2,100 行時，還需要逐步驟的內容斷言。

lines.push('');
lines.push('E. 建角流程 8 道步驟（桌機 1280px，測試注入點）');

const renderWizard = (step) => renderToStaticMarkup(React.createElement(NPCWorkshop, {
  setHeaderExtraLeft: () => {},
  setHeaderExtraRight: () => {},
  onSubNavChange: null,
  initialDraft: createNewNPC(),
  initialMainTab: 'build',
  initialStep: step,
}));

const stepHtml = {};
const stepErrors = {};
for (let step = 1; step <= 8; step += 1) {
  try {
    stepHtml[step] = renderWizard(step);
  } catch (e) {
    stepErrors[step] = e;
  }
}

for (let step = 1; step <= 8; step += 1) {
  const err = stepErrors[step];
  check(
    `第 ${step} 步渲染完成（不拋例外）`,
    err === undefined,
    err ? `${err.name}: ${err.message}` : ''
  );
}

// 步驟導覽本身一定在（左側 8 個步驟按鈕）——這是「確實走到建角流程」的證據。
const firstOk = stepHtml[1];
if (firstOk !== undefined) {
  check('建角流程外框有渲染（含步驟導覽）', firstOk.includes('建構步驟'), '找不到「建構步驟」');
  check('建角流程輸出有實質內容（> 2000 字元）', firstOk.length > 2000, `長度 ${firstOk.length}`);
}

// 每一步都要有實質輸出，且**彼此不同**（若某步渲染成空白，長度會塌掉）。
for (let step = 1; step <= 8; step += 1) {
  const html = stepHtml[step];
  if (html === undefined) continue;
  check(`第 ${step} 步輸出有實質內容（> 1500 字元）`, html.length > 1500, `長度 ${html.length}`);
}
const distinctCount = new Set(Object.values(stepHtml)).size;
check('8 道步驟的輸出彼此不同（不是同一份畫面）', distinctCount === 8, `相異輸出數 ${distinctCount}`);

// 逐步驟的內容錨點。這些字串是**機械掃描 8 份輸出後挑出的「只出現在該步」**的文案
// （不是手挑的、也不是導覽列文字——導覽列在 8 份裡都有，所以不可能被選中）。
// 它們的作用：若拆檔時某一步的內容被搬掉／漏渲染，該步的錨點會消失，這裡就會紅。
const STEP_ANCHORS = [
  [1, '選擇NPC的定位'],
  [2, '分配等級與階級'],
  [3, '設定物種'],
  [4, '調整數值與能力'],
  [5, '規則提醒'],
  [6, '配置負面技能'],
  [7, '設定稱呼與特質'],
  [8, '戰術與行動'],
];
STEP_ANCHORS.forEach(([step, needle]) => {
  const html = stepHtml[step];
  if (html === undefined) return;
  check(`第 ${step} 步含其專屬內容「${needle}」`, html.includes(needle), `找不到「${needle}」`);
});

// ── D. 護欄自我檢查 ───────────────────────────────────────────
// 這一節存在的理由＝AGENTS.md §AW9 第 1 條：「新增護欄後必須做一次刻意破壞驗證」。
// 但「刻意破壞」不能靠人記得做，所以把它變成可自動驗證的形式：
// 斷言「這份測試確實有渲染到真實輸出」。若哪天有人把 renderWorkshop 改成
// 回傳空字串，上面所有 `includes` 斷言會全部變成「找不到」，看起來像程式壞了，
// 但其實是測試壞了——這一節就是拿來分辨這兩種情況的。

lines.push('');
lines.push('D. 護欄自我檢查');
check('渲染輸出不是被 mock 掉的字串', desktopHtml.startsWith('<'), `開頭為「${desktopHtml.slice(0, 20)}」`);

// ── F. 建角草稿的讀回路徑 ─────────────────────────────────────
// 2026-10-22（`docs/decisions.md` §BS）。使用者實際踩到的洞是「換章節回來，八步建角
// 全部歸零」——那是元件被卸載、React state 消失，而 `beforeunload` 攔不到站內切換。
// 修法是每次改動寫進 `STORAGE_KEYS.npcDraft`，掛載時接回去。
//
// 這裡測的是**讀回**這一段：它發生在三個 `useState` 的初始器裡，屬純渲染路徑，
// SSR 走得到（寫入是 `useEffect`，SSR 不執行，故由 `scripts/audit-npc-workshop.mjs` 守）。
// 儲存後端用 `__setStorageBackend` 注入——不墊 localStorage，測到的才是真的 store。

lines.push('');
lines.push('F. 建角草稿讀回（儲存後端注入）');

const makeBackend = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
};

const withBackend = (entries, fn) => {
  __setStorageBackend(makeBackend(entries));
  try {
    return fn();
  } finally {
    __setStorageBackend(null);
  }
};

const renderPlain = (props = {}) => renderToStaticMarkup(React.createElement(NPCWorkshop, {
  setHeaderExtraLeft: () => {},
  setHeaderExtraRight: () => {},
  onSubNavChange: null,
  ...props,
}));

const DRAFT_BANNER = '上次有一份沒存進檔案庫的草稿';
const draftNpc = { ...createNewNPC(), name: '草稿測試體' };
const draftKey = STORAGE_KEYS.npcDraft;

// F1：離開時人在建角頁 → 直接接回同一頁、同一步。
const restoredBuild = withBackend(
  { [draftKey]: JSON.stringify({ npc: draftNpc, mainTab: 'build', step: 3, subTab: 'skills' }) },
  () => renderPlain()
);
check('草稿（建角頁離開）→ 回到建角流程而不是檔案庫', restoredBuild.includes('建構步驟'), '找不到「建構步驟」');
check('草稿記著的步驟被接回（第 3 步「設定物種」）', restoredBuild.includes('設定物種'), '找不到「設定物種」');
check('接回建角頁時不顯示接續提示條', !restoredBuild.includes(DRAFT_BANNER), '不該出現提示條');

// F2：離開時人在檔案庫 → 停在檔案庫，改由提示條提供選擇。
const restoredLib = withBackend(
  { [draftKey]: JSON.stringify({ npc: draftNpc, mainTab: 'library', step: 1, subTab: 'skills' }) },
  () => renderPlain()
);
check('草稿（檔案庫離開）→ 停在檔案庫', restoredLib.includes('檔案庫目前空空如也'), '找不到檔案庫空狀態文案');
check('檔案庫出現接續草稿提示條', restoredLib.includes(DRAFT_BANNER), '找不到提示條');
check('提示條提供「繼續編輯」', restoredLib.includes('繼續編輯'), '找不到「繼續編輯」');
check('提示條提供「丟棄」', restoredLib.includes('丟棄'), '找不到「丟棄」');

// F3：沒有草稿 → 提示條不得出現（「不傳時行為逐字不變」的同一條鐵律）。
const noDraft = withBackend({}, () => renderPlain());
check('沒有草稿時不顯示提示條', !noDraft.includes(DRAFT_BANNER), '不該出現提示條');
check('沒有草稿時停在檔案庫', noDraft.includes('檔案庫目前空空如也'), '找不到檔案庫空狀態文案');

// F4：壞掉的草稿不得讓工坊開不起來（手改備份檔／半截寫入）。
const badDrafts = {
  '空物件': '{}',
  'npc 為 null': '{"npc":null}',
  'npc 是陣列': '{"npc":[]}',
  '不是 JSON': 'not-json',
};
Object.entries(badDrafts).forEach(([label, raw]) => {
  let err = null;
  let html = '';
  try {
    html = withBackend({ [draftKey]: raw }, () => renderPlain());
  } catch (e) {
    err = e;
  }
  check(`壞掉的草稿（${label}）不拋例外`, err === null, err ? `${err.name}: ${err.message}` : '');
  if (err === null) {
    check(`壞掉的草稿（${label}）不顯示提示條`, !html.includes(DRAFT_BANNER), '不該出現提示條');
  }
});

// F5：測試注入點優先於真實草稿（否則測試會被使用者上一次的草稿污染）。
const injectedWins = withBackend(
  { [draftKey]: JSON.stringify({ npc: draftNpc, mainTab: 'build', step: 3, subTab: 'skills' }) },
  () => renderPlain({ initialDraft: { ...createNewNPC(), name: '注入體' }, initialMainTab: 'build', initialStep: 1 })
);
check('注入的 initialDraft 不被真實草稿覆蓋', injectedWins.includes('注入體'), '找不到「注入體」');
check('注入 initialDraft 時草稿內容不出現', !injectedWins.includes('草稿測試體'), '出現了草稿內容');

// F6：草稿記著的子頁被接回（第 4 步的「數值」頁）。
const restoredStats = withBackend(
  { [draftKey]: JSON.stringify({ npc: draftNpc, mainTab: 'build', step: 4, subTab: 'stats' }) },
  () => renderPlain()
);
check('草稿記著的第 4 步子頁被接回（數值頁）', restoredStats.includes('基礎數值與相性'), '找不到「基礎數值與相性」');

// ── G. 第 4 步的介面深度（2026-10-22，`docs/decisions.md` §BT）──
// 使用者的原話是「沒有必要把他們藏得這麼深」。修法是把子頁從三頁收成兩頁、
// 預設停在能力頁，並讓「基礎攻擊」「咒語書」預設展開。
// 這裡守的就是「不點任何東西也看得到」——SSR 沒有點擊可言，所以能直接斷言。

lines.push('');
lines.push('G. 第 4 步預設就看得到技能與咒語');

const step4Default = stepHtml[4] || '';
check('第 4 步預設顯示「技能・咒語・能力」子頁', step4Default.includes('技能・咒語・能力'), '找不到子頁標籤');
check('第 4 步預設就看得到「攻擊與技能庫」區塊', step4Default.includes('攻擊與技能庫'), '找不到區塊標題');
check('第 4 步預設就看得到「咒語與自訂能力」區塊', step4Default.includes('咒語與自訂能力'), '找不到區塊標題');
check(
  '「基礎攻擊與核心能力」預設展開（技能卡直接渲染出來）',
  step4Default.includes('skill-card-'),
  '找不到任何 skill-card'
);
check(
  '兩個子頁標籤同時存在（數值／能力）',
  step4Default.includes('基礎數值與相性') && step4Default.includes('技能・咒語・能力'),
  '子頁標籤不完整'
);


// ── 輸出 ──────────────────────────────────────────────────────

lines.push('');
lines.push(`通過 ${pass} / ${pass + fail}　${fail === 0 ? '（全部通過）' : `（${fail} 項失敗）`}`);
console.log(lines.join('\n'));
process.exit(fail === 0 ? 0 : 1);
