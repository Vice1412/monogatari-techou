/**
 * 跑團面板（CharacterPlayHUD）空狀態契約測試。
 *
 * 執行：`npm run test:playhudempty`（已納入 `npm test` 串接）
 *
 * 為什麼要有這個檔案（2026-10-23，第四輪稽核）：
 * 跑團面板是**跑團當下就開在旁邊**的那一屏，而它的三個清單原本各只有一行灰字：
 *   - 羈絆：「尚未建立羈絆。」 `text-slate-400` → 白底 **2.56:1**（連大字門檻都不到）
 *   - 命刻：「暫無個人命刻。」 `text-slate-400` → 同上
 *   - 咒語：空狀態寫得不錯，但**標頭與空狀態各有一顆做同一件事的按鈕**
 * 這三條都不是「風格偏好」：前兩條是對比度不合格，第三條是同一屏兩個同一動作。
 *
 * ※ 測不到的部分（誠實聲明）：`onClick`（SSR 不執行事件）。所以「按了會開彈窗」
 *   不在這裡，這裡只鎖「畫面上有沒有那段字、按鈕有幾顆」。
 */
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';

let results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const render = (character, props = {}) =>
  renderToStaticMarkup(
    React.createElement(CharacterPlayHUD, {
      character,
      onChange: () => {},
      onBackToRoster: () => {},
      onOpenEditor: () => {},
      showToast: () => {},
      ...props
    })
  );
const countOf = (hay, needle) => hay.split(needle).length - 1;

const bare = () => createNewCharacter({ name: '測試角色' });

/* ────────────────────────────────────────────────────────────────
   A. 不傳 initialTab：預設仍是「武器與戰鬥」
   ──────────────────────────────────────────────────────────────── */
const def = render(bare());
check('A1 預設分頁不是羈絆／命刻／咒語', countOf(def, '還沒有任何羈絆') === 0 && countOf(def, '還沒有個人命刻') === 0 && countOf(def, '尚未掌握任何咒語') === 0, '三段空狀態皆 0 次');
check('A2 預設仍渲染武器分頁', countOf(def, '武器與戰鬥') >= 1, `${countOf(def, '武器與戰鬥')} 次`);

/* ────────────────────────────────────────────────────────────────
   B. 羈絆：空 → 教學型空狀態；有資料 → 不出現
   ──────────────────────────────────────────────────────────────── */
const bondEmpty = render(bare(), { initialTab: 'bonds' });
check('B1 羈絆空狀態有標題', countOf(bondEmpty, '還沒有任何羈絆') === 1, `${countOf(bondEmpty, '還沒有任何羈絆')} 次`);
check('B2 羈絆空狀態有教學句（不只是「沒有」）', countOf(bondEmpty, '羈絆是對某人某物的三維情感') === 1, `${countOf(bondEmpty, '羈絆是對某人某物的三維情感')} 次`);
check('B3 羈絆空狀態不放重複 CTA（標頭已有新增羈絆）', countOf(bondEmpty, '新增羈絆') === 1, `新增羈絆 ${countOf(bondEmpty, '新增羈絆')} 顆`);

const withBond = bare();
withBond.bonds = [{ id: 'b1', target: '導師', feelings: ['loyalty'] }];
const bondFilled = render(withBond, { initialTab: 'bonds' });
check('B4 有羈絆時空狀態消失', countOf(bondFilled, '還沒有任何羈絆') === 0, '0 次');
check('B5 有羈絆時仍顯示該條', countOf(bondFilled, '導師') >= 1, `${countOf(bondFilled, '導師')} 次`);

/* ────────────────────────────────────────────────────────────────
   C. 命刻：空 → 教學型空狀態（含「去哪裡建」的指路）
   ──────────────────────────────────────────────────────────────── */
const clockEmpty = render(bare(), { initialTab: 'clocks' });
check('C1 命刻空狀態有標題', countOf(clockEmpty, '還沒有個人命刻') === 1, `${countOf(clockEmpty, '還沒有個人命刻')} 次`);
check('C2 命刻空狀態區分「個人」與「章節」命刻', countOf(clockEmpty, '命刻記錄」那一章') === 1, `${countOf(clockEmpty, '命刻記錄」那一章')} 次`);

const withClock = bare();
withClock.clocks = [{ id: 'c1', title: '傷勢惡化', totalSegments: 6, filledSegments: 2 }];
const clockFilled = render(withClock, { initialTab: 'clocks' });
check('C3 有命刻時空狀態消失', countOf(clockFilled, '還沒有個人命刻') === 0, '0 次');

/* ────────────────────────────────────────────────────────────────
   D. 咒語：空時只留一顆 CTA（空狀態那顆）
   ──────────────────────────────────────────────────────────────── */
const spellEmpty = render(bare(), { initialTab: 'spells' });
check('D1 空清單時標頭的「學習新咒語」收起', countOf(spellEmpty, '學習新咒語') === 0, `${countOf(spellEmpty, '學習新咒語')} 次`);
check('D2 空清單時空狀態的 CTA 仍在', countOf(spellEmpty, '從規則庫選擇習得咒語') === 1, `${countOf(spellEmpty, '從規則庫選擇習得咒語')} 次`);
check('D3 空狀態說明仍在', countOf(spellEmpty, '尚未掌握任何咒語') === 1, `${countOf(spellEmpty, '尚未掌握任何咒語')} 次`);
check('D6 咒語空狀態也有教學句（不只是「沒有」）', countOf(spellEmpty, '咒語分攻擊與輔助兩種') === 1, `${countOf(spellEmpty, '咒語分攻擊與輔助兩種')} 次`);

const withSpell = bare();
withSpell.spells = [{ name: '火焰', effect: '造成【HR + 5】的火屬性傷害。' }];
const spellFilled = render(withSpell, { initialTab: 'spells' });
check('D4 有咒語時標頭按鈕回來', countOf(spellFilled, '學習新咒語') === 1, `${countOf(spellFilled, '學習新咒語')} 次`);
check('D5 有咒語時空狀態消失', countOf(spellFilled, '從規則庫選擇習得咒語') === 0, '0 次');

/* ────────────────────────────────────────────────────────────────
   E. 碼面：這三段空狀態不得再用 text-slate-400（2.56:1）
   ──────────────────────────────────────────────────────────────── */
const hudSrc = fs
  .readFileSync(new URL('../src/features/character-sheet/components/CharacterPlayHUD.jsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const anchor = (start, len = 700) => {
  const i = hudSrc.indexOf(start);
  return i < 0 ? '' : hudSrc.slice(i, i + len);
};
const bondBlock = anchor('還沒有任何羈絆', 900);
const clockBlock = anchor('還沒有個人命刻', 900);
check('E1 羈絆空狀態區塊不再用 text-slate-400', bondBlock.length > 0 && !bondBlock.includes('text-slate-400'), `區塊長度 ${bondBlock.length}`);
check('E2 命刻空狀態區塊不再用 text-slate-400', clockBlock.length > 0 && !clockBlock.includes('text-slate-400'), `區塊長度 ${clockBlock.length}`);
/* 第十一輪：這兩段空狀態收進 `EmptyState`，所以「說明文字用什麼顏色」不再是這兩處的事，
   而是元件的事（`text-[#6b5a4b]`，6.58:1）。這裡改為驗「有沒有走元件」——
   否則斷言會黏在一個已經搬走的 class 上，下一次改色票時它又紅一次。 */
check(
  'E3 兩段空狀態都走 EmptyState（教學句由元件統一）',
  hudSrc.includes('kind="bonds"') && hudSrc.includes('kind="personal-clocks"'),
  `羈絆 ${hudSrc.includes('kind="bonds"')}／命刻 ${hudSrc.includes('kind="personal-clocks"')}`
);

/* ────────────────────────────────────────────────────────────────
   F. 美食家食譜書：把「空」與「查無」分開
   ──────────────────────────────────────────────────────────────── */
const cookSrc = fs
  .readFileSync(
    new URL('../src/features/character-sheet/components/companions/GourmetCookbook.jsx', import.meta.url),
    'utf8'
  )
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
check(
  'F1 不再有單行灰字佔位（尚無食材／這個口味沒有食材 的 <p> 形態）',
  !/<p className="[^"]*text-slate-400[^"]*">\s*(尚無食材|這個口味沒有食材)/.test(cookSrc),
  '單行 p 形態已移除'
);
check(
  'F2 空食材有自己的教學句',
  cookSrc.includes('食材在旅途中採集取得'),
  cookSrc.includes('食材在旅途中採集取得') ? '1 句' : '缺'
);
check(
  'F3 查無食材有自己的離開指引',
  cookSrc.includes('手上的食材不在這個口味裡'),
  cookSrc.includes('手上的食材不在這個口味裡') ? '1 句' : '缺'
);
/* 第十一輪：虛線框搬進 `EmptyState`，所以這裡驗「兩塊都走元件」而不是數 `border-dashed`。 */
check(
  'F4 兩者都走 EmptyState（虛線框由元件統一）',
  (cookSrc.match(/<EmptyState/g) || []).length >= 2,
  `${(cookSrc.match(/<EmptyState/g) || []).length} 處`
);

/* ────────────────────────────────────────────────────────────────
   G. 全站護欄：段落說明文字不得用 text-slate-400（白底 2.56:1）
   ──────────────────────────────────────────────────────────────── */
const allJsx = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jsx')) allJsx.push(p);
  }
};
walk('src');
const offenders = [];
for (const f of allJsx) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    // `dark:text-slate-400` 不算：本專案沒有深色模式，那個變體永遠不生效。
    if (/<p[^>]*text-slate-400/.test(l) && !l.includes('dark:text-slate-400')) offenders.push(`${f}:${i + 1}`);
  });
}
check('G1 全站沒有任何 <p> 用 text-slate-400（2.56:1）', offenders.length === 0, offenders.length ? offenders.join('、') : `${allJsx.length} 個檔案掃過，0 處`);

const aceSrc = fs.readFileSync(
  new URL('../src/features/character-sheet/components/companions/AceOfCardsTable.jsx', import.meta.url),
  'utf8'
);
check('G2 空手牌有自己的教學句', aceSrc.includes('打出的牌會進棄牌堆'), aceSrc.includes('打出的牌會進棄牌堆') ? '1 句' : '缺');

/* ────────────────────────────────────────────────────────────────
   H. 全站標籤對比預算（第五輪）：`text-slate-400` 只能減不能增
   ────────────────────────────────────────────────────────────────
   判準與 `scratch/ui-audit/slate400_stats.mjs` 相同，這裡獨立實作一次是刻意的：
   測試不依賴 `scratch/`（不在版控內），否則護欄會與被測物一起消失。

   「真文字」＝ 不是註解、不是 disabled／placeholder、不是 hover 才變色的圖示按鈕、
   而且這一行或**接下來兩行**有中文。跨行判 CJK 是必要的：`<span className="…">`
   與它顯示的中文經常不在同一行——第一版只掃同行，因此漏掉 9 處。
   ──────────────────────────────────────────────────────────────── */
const SKIP_400 = [
  /cursor-not-allowed/,
  /disabled:/,
  /aria-disabled/,
  /placeholder:/,
  /hover:text-/,
  /line-through/,
  /opacity-/,
  /dark:/,
];
const CJK_RE = /[\u4e00-\u9fff]/;
// 深底例外必須**顯式標記**，不能靠「上下幾行有沒有 bg-slate-8」猜：
// `text-slate-400` 在 `bg-slate-900` 上是 5.9:1（合格），改成 600 反而掉到 2.3:1。
// 但深底宣告常常在 9 行以外（屬性矩陣的托盤就是），猜不準就等於留一個後門。
// 規則：要在深底上用 400，就在該行寫 `{/* slate400-on-dark */}`，並在註解說明理由。
const DARK_OK = 'slate400-on-dark';
const realText400 = [];
let total400 = 0;
for (const f of allJsx) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  let inBlock = false;
  lines.forEach((line, i) => {
    const startsInBlock = inBlock;
    const opensBlock = /\/\*/.test(line) && !/\*\//.test(line);
    if (!inBlock && opensBlock) inBlock = true;
    else if (inBlock && /\*\//.test(line)) inBlock = false;
    if (!line.includes('text-slate-400')) return;
    total400++;
    if (startsInBlock || opensBlock || /^\s*\/\//.test(line)) return;
    if (SKIP_400.some((re) => re.test(line))) return;
    if (line.includes(DARK_OK)) return;
    const window = `${line}\n${lines[i + 1] ?? ''}\n${lines[i + 2] ?? ''}`;
    if (!CJK_RE.test(window)) return;
    realText400.push(`${f}:${i + 1}`);
  });
}
check('H1 全站沒有「讀不到的中文標籤」（真文字 slate-400 = 0）', realText400.length === 0, realText400.length ? realText400.join('、') : `${allJsx.length} 檔掃過`);
check('H2 text-slate-400 總量 ≤ 62（只能減）', total400 <= 62, `${total400} / 上限 62`);

/* ────────────────────────────────────────────────────────────────
   F-023（2026-10-26 P11）：金手指相性要出現在跑團面板
   ────────────────────────────────────────────────────────────────
   修之前：`stats.quirkEffects` 全專案只有編輯器第 4 頁一個消費端。
   帶【亡者歸來】的角色進跑團面板，整頁 621 字裡沒有任何相性字樣——
   打團當下算錯傷害，而且看不出是 App 沒畫。

   ※ 這裡只斷言**結構**（testid／列標籤／值），不斷言整句文案：
     文案會調，結構不會。 */
const withQuirk = (quirk, quirkChoice = '') =>
  createNewCharacter({ name: '相性測試', quirk, quirkChoice });

const deadHtml = render(withQuirk('亡者歸來'));
check('F-023 有相性時跑團面板畫出 hud-affinities',
  deadHtml.includes('data-testid="hud-affinities"'), true);
check('F-023 亡者歸來：傷害免疫／易傷／狀態免疫三列都在',
  ['傷害免疫', '易傷', '狀態免疫'].every((x) => deadHtml.includes(x)), true);
check('F-023 免疫的「暗」「毒」與易傷的「光」都寫出來',
  ['暗', '毒', '光'].every((x) => deadHtml.includes(x)), true);

const ghostHtml = render(withQuirk('通智幽魂', { resist1: '火', resist2: '光', vuln: '冰' }));
check('F-023 通智幽魂：抗性列有火與光',
  ['抗性', '火', '光'].every((x) => ghostHtml.includes(x)), true);
check('F-023 通智幽魂：易傷列有冰', ghostHtml.includes('冰'), true);

// ※「不該出現」的斷言要把結果**取反**再傳給 ok：
//   直接把 includes(...) 當 ok，等於在斷言「它存在」，意思剛好相反。
check('F-023 純敘事金手指（飛行）不會長出相性區塊',
  !render(withQuirk('飛行')).includes('data-testid="hud-affinities"'), true);
check('F-023 沒有金手指就沒有相性區塊',
  !render(bare()).includes('data-testid="hud-affinities"'), true);
check('F-023 相性區塊只出現一次（不會每個分頁各畫一份）',
  countOf(deadHtml, 'data-testid="hud-affinities"'), 1);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  跑團面板是「跑團當下就開在旁邊」的那一屏：`);
  console.log(`  它的空狀態不是空白，是玩家正在看的地方。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
