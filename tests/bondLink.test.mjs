/**
 * 羈絆 ⇄ NPC 檔案庫的連結（P3，2026-10-30）。
 *
 * 執行：`npm run test:bondlink`（已納入 `npm test` 串接）
 *
 * ── 這個檔案在守什麼 ────────────────────────────────────────
 *
 * 羈絆原本只有「對象名字 ＋ 情感」。加了 `npcId` 之後多出一個**新的失敗模式**：
 * 名冊裡那張卡被刪了，羈絆還指著它。這種「指向不存在的東西」最常見的錯法不是拋錯，
 * 而是**安靜地畫成別的樣子**——例如下拉選單對不上 value，瀏覽器就顯示第一個選項
 * （「不連結名冊」），看起來像玩家自己取消了連結。
 *
 * 所以這裡的核心不是「連得上會怎樣」，而是**三態要分得開**：
 *   none（刻意不連）／linked（連得上）／missing（連過但卡沒了）
 * 特別是 E3、E6、G5 那幾條**對照組**：一條沒有連結的羈絆，絕不能出現「名冊已無此人」。
 * 少了對照組，「missing 會顯示提示」這條在「所有羈絆都顯示提示」時照樣會過。
 *
 * ── 還有一條是「不准加回來」的 ──────────────────────────────
 *
 * H6／H7 守的是「羈絆沒有自由輸入的理由欄」。這一版**當天做過又拆掉**：
 * 多一個空白輸入框就是多一次「我該填什麼」的猶豫，而理由沒有規則可依，
 * 只會變成一片沒人寫的空格。護欄留著，是因為下一個 AI 很容易覺得
 * 「加一個理由欄不是更有代入感嗎」——那正是被否決過的想法。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import {
  resolveBondNpc,
  bondNpcSubtitle,
  buildBondLinkFields,
  applyBondLinkFields,
  describeBondEdit
} from '../src/features/character-sheet/utils/bondLink.js';

let results = [];

/**
 * 布林斷言。`ok` 必須是**已經比對過的布林值**，不是實際值本身。
 *
 * ※ 這裡踩過一次，值得留著：第一版把「期望值」寫進第三個參數（`detail`），
 *   於是 `ok` 拿到的是實際值——非空字串、非零數字全部為真，
 *   三十幾條**永遠會過**。紅燈只有 8 條，而那 8 條之所以紅，
 *   是因為實際值剛好是 `0`／`false`。也就是說：**會過的都不算，會紅的才是對的。**
 *   所以值比對一律用 `eq`，不要自己數參數。
 */
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
/** 值斷言：實際值與期望值真的相等才算過。 */
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    detail: ok ? '' : `期望 ${JSON.stringify(expected)}／實得 ${JSON.stringify(actual)}`
  });
};
const countOf = (hay, needle) => hay.split(needle).length - 1;

const NPC_POOL = [
  { id: 'npc1', name: '導師', role: '反派', level: 3, faction: '帝國', avatarBase64: 'data:image/png;base64,iVBORw0KGgo=' },
  { id: 'npc2', name: '艾蓮', role: '盟友', level: 2, faction: '', avatarBase64: '' }
];

const withBonds = (bonds) => {
  const ch = createNewCharacter({ name: '測試角色' });
  ch.bonds = bonds;
  return ch;
};

const render = (character, props = {}) =>
  renderToStaticMarkup(
    React.createElement(CharacterPlayHUD, {
      character,
      onChange: () => {},
      onBackToRoster: () => {},
      onOpenEditor: () => {},
      showToast: () => {},
      initialTab: 'bonds',
      ...props
    })
  );

/* ────────────────────────────────────────────────────────────────
   A. resolveBondNpc：三態要分得開
   ──────────────────────────────────────────────────────────────── */
eq('A1 沒有 npcId → none', resolveBondNpc({ target: '王國' }, NPC_POOL).status, 'none');
eq('A2 空字串 npcId 也是 none（不是 missing）',
  resolveBondNpc({ npcId: '' }, NPC_POOL).status, 'none');
eq('A3 連得上 → linked，而且拿得到那張卡',
  resolveBondNpc({ npcId: 'npc2' }, NPC_POOL).npc?.name, '艾蓮');
eq('A4 連不上 → missing（不是 none）',
  resolveBondNpc({ npcId: 'npc_deleted' }, NPC_POOL).status, 'missing');
eq('A5 名冊是空的也不算 missing（沒連結就沒有斷鏈可言）',
  resolveBondNpc({ target: '導師' }, []).status, 'none');
eq('A6 名冊不是陣列時不拋錯，當成空名冊',
  resolveBondNpc({ npcId: 'npc1' }, null).status, 'missing');
eq('A7 npcId 不是字串時不誤判（數字 id 當成沒連結）',
  resolveBondNpc({ npcId: 123 }, NPC_POOL).status, 'none');
eq('A8 名冊裡混進 null 不會炸',
  resolveBondNpc({ npcId: 'npc1' }, [null, ...NPC_POOL]).npc?.name, '導師');

/* ────────────────────────────────────────────────────────────────
   B. bondNpcSubtitle：缺哪一項就少哪一項
   ──────────────────────────────────────────────────────────────── */
eq('B1 三項都有就三項都寫', bondNpcSubtitle(NPC_POOL[0]), 'Lv.3 · 反派 · 帝國');
eq('B2 空字串的陣營不補佔位符', bondNpcSubtitle(NPC_POOL[1]), 'Lv.2 · 盟友');
eq('B3 沒有卡就回空字串（不是 "undefined"）',
  [bondNpcSubtitle(null), bondNpcSubtitle(undefined)], ['', '']);

/* ────────────────────────────────────────────────────────────────
   C. buildBondLinkFields / applyBondLinkFields
   ──────────────────────────────────────────────────────────────── */
eq('C1 沒有連結 → 一個鍵都不產生（舊存檔形狀不變）',
  Object.keys(buildBondLinkFields({ npcId: '' })), []);
eq('C2 有連結 → 只有 npcId 一個鍵',
  Object.keys(buildBondLinkFields({ npcId: 'npc1' })), ['npcId']);
eq('C3 前後空白被去掉', buildBondLinkFields({ npcId: '  npc1  ' }).npcId, 'npc1');
eq('C4 非字串的 id 不寫鍵（不是把 123 變成 "123"）',
  Object.keys(buildBondLinkFields({ npcId: 123 })), []);

const linked = { id: 'b1', target: '導師', feelings: ['loyalty'], npcId: 'npc1' };
eq('C5 取消連結後，舊的 npcId 真的消失（不是留著空字串）',
  'npcId' in applyBondLinkFields(linked, { npcId: '' }), false);
eq('C6 換一條連結會蓋掉舊的（不是兩條並存）',
  applyBondLinkFields(linked, { npcId: 'npc2' }).npcId, 'npc2');
eq('C7 其他欄位原封不動（情感與名字不受連結影響）',
  (({ target, feelings }) => [target, feelings])(applyBondLinkFields(linked, {})), ['導師', ['loyalty']]);
eq('C8 沒有連結的羈絆套用後仍然是「沒有這個鍵」（不是新增一個空鍵）',
  'npcId' in applyBondLinkFields({ id: 'b9', target: '王國', feelings: ['loyalty'] }, { npcId: '' }), false);

/* ────────────────────────────────────────────────────────────────
   D. describeBondEdit：只寫情感變化
   ──────────────────────────────────────────────────────────────── */
eq('D1 情感變了 → 寫出前後變化',
  describeBondEdit({ target: '導師', feelingsFrom: '忠誠', feelingsTo: '疑忌' }),
  '調整羈絆【導師】：忠誠 → 疑忌');
eq('D2 情感沒變 → 只留名字（不假裝有事發生）',
  describeBondEdit({ target: '導師', feelingsFrom: '忠誠', feelingsTo: '忠誠' }),
  '調整羈絆【導師】');
eq('D3 從無到有（不會印出 "undefined"）',
  describeBondEdit({ target: '導師', feelingsFrom: '', feelingsTo: '忠誠' }),
  '調整羈絆【導師】：（無） → 忠誠');
eq('D4 沒有名字時不會產生「調整羈絆【】」這種空括號以外的東西',
  describeBondEdit({ target: undefined, feelingsFrom: 'a', feelingsTo: 'b' }),
  '調整羈絆【】：a → b');

/* ────────────────────────────────────────────────────────────────
   E. 畫面上的三態（含對照組）
   ──────────────────────────────────────────────────────────────── */
const linkedMarkup = render(withBonds([{ ...linked }]), { npcLibrary: NPC_POOL });
eq('E1 連得上時畫出名冊上的職業與等級', countOf(linkedMarkup, 'Lv.3 · 反派 · 帝國'), 1);
eq('E2 連得上時畫出頭像', countOf(linkedMarkup, 'data:image/png;base64,iVBORw0KGgo='), 1);
eq('E3（對照組）連得上的羈絆不得出現「名冊已無此人」', countOf(linkedMarkup, '名冊已無此人'), 0);

const danglingMarkup = render(withBonds([{ ...linked, npcId: 'npc_deleted' }]), { npcLibrary: NPC_POOL });
eq('E4 斷鏈時說出「名冊已無此人」', countOf(danglingMarkup, '名冊已無此人'), 1);
eq('E5 斷鏈時保留玩家寫的名字（那是他寫的，不是連結的附屬品）',
  danglingMarkup.includes('>導師<'), true);

const plainMarkup = render(withBonds([{ id: 'b9', target: '王國', feelings: ['loyalty'] }]), { npcLibrary: NPC_POOL });
eq('E6（對照組）沒有連結的羈絆不得出現「名冊已無此人」', countOf(plainMarkup, '名冊已無此人'), 0);
eq('E7（對照組）沒有連結的羈絆不得畫出任何名冊資料',
  [countOf(plainMarkup, 'Lv.'), countOf(plainMarkup, 'data:image/png;base64')], [0, 0]);

/* ────────────────────────────────────────────────────────────────
   F. 建立彈窗：挑選器
   ──────────────────────────────────────────────────────────────── */
const creator = render(withBonds([]), { npcLibrary: NPC_POOL, initialBondModalOpen: true });
eq('F1 建立彈窗有挑選器', countOf(creator, 'data-testid="bond-new-npc"'), 1);
eq('F2 挑選器列出名冊上的人（帶職業與等級）',
  [creator.includes('導師（Lv.3 · 反派 · 帝國）'), creator.includes('艾蓮（Lv.2 · 盟友）')], [true, true]);
eq('F3 挑選器一定留著「不連結」這個選項（羈絆對象可以不是名冊裡的人）',
  creator.includes('不連結名冊（自由輸入名稱）'), true);

const emptyPoolCreator = render(withBonds([]), { npcLibrary: [], initialBondModalOpen: true });
eq('F4 名冊空的時候不是畫一個空下拉，而是教一件事',
  countOf(emptyPoolCreator, '名冊還沒有任何 NPC'), 1);
eq('F5 名冊空的時候仍然可以直接打名字（不擋人）',
  countOf(emptyPoolCreator, '羈絆對象名稱'), 1);

/* ────────────────────────────────────────────────────────────────
   G. 就地編輯面板：斷鏈要看得見
   ──────────────────────────────────────────────────────────────── */
const editDangling = render(withBonds([{ ...linked, npcId: 'npc_deleted' }]), {
  npcLibrary: NPC_POOL,
  initialEditingBondId: 'b1'
});
eq('G1 編輯面板出現挑選器', countOf(editDangling, 'data-testid="bond-edit-npc"'), 1);
eq('G2 斷鏈的連結在選單裡留下一顆看得見的殘留選項（不然會被畫成「不連結」）',
  editDangling.includes('（名冊已無此人，連結已失效）'), true);
eq('G3 斷鏈時「名冊已無此人」總共出現兩次（卡片一次、選單一次）',
  countOf(editDangling, '名冊已無此人'), 2);

const editLinked = render(withBonds([{ ...linked }]), {
  npcLibrary: NPC_POOL,
  initialEditingBondId: 'b1'
});
eq('G4（對照組）連結正常時選單不留殘留選項',
  editLinked.includes('（名冊已無此人，連結已失效）'), false);
// 抓「選中的情感鈕」要用**完整的 class 字串**，不能只抓 `bg-[#a63d40] text-[#fffdf9]`
// ——那三個 class 在別處也有（第一版數到 2，就是抓到別顆按鈕）。
eq('G5 編輯面板預填原本的情感（忠誠那顆是選中的）',
  countOf(editLinked, 'flex-1 py-1 rounded text-t11 font-bold transition-colors bg-[#a63d40] text-[#fffdf9]'), 1);

/* ────────────────────────────────────────────────────────────────
   H. 源碼護欄
   ──────────────────────────────────────────────────────────────── */
const hudSrc = fs.readFileSync(
  path.resolve('src/features/character-sheet/components/CharacterPlayHUD.jsx'),
  'utf8'
);
const linkSrc = fs.readFileSync(
  path.resolve('src/features/character-sheet/utils/bondLink.js'),
  'utf8'
);

/*
   H1 的比對刻意寫成「物件字面」而不是「任何 npcId 後面接空字串」。
   ※ 第一版用 `/npcId\s*:\s*''/`，結果抓到的是三元運算的回退：
     `typeof bond.npcId === 'string' ? bond.npcId : ''` ——那是**讀**，不是寫。
     掃描條件太寬會製造假紅，而假紅會讓人把整條護欄刪掉。
*/
eq('H1 元件裡沒有把「空連結」寫成物件字面（那會讓連結多出第二種表示法）',
  /[{,]\s*npcId\s*:\s*''/.test(hudSrc), false);
eq('H2 建立與就地編輯共用同一個挑選器（各寫一份就會有一邊漏掉斷鏈分支）',
  countOf(hudSrc, '<BondNpcSelect'), 2);
eq('H3 連結判定不在元件裡自己寫（一律走 bondLink 模組）',
  hudSrc.includes("from '../utils/bondLink'"), true);
eq('H4 卡片的三態走 resolveBondNpc（不是自己讀 bond.npcId 分支）',
  countOf(hudSrc, 'resolveBondNpc('), 1);
eq('H5 刪鍵的邏輯不在元件裡（在 applyBondLinkFields，那裡才測得到）',
  /delete\s+\w*\.?npcId/.test(hudSrc), false);

/* 不准加回來：自由輸入的「理由」欄（2026-10-30 當天做過又拆掉）。 */
eq('H6 羈絆沒有自由輸入的「理由」欄位（那是玩家的操作負擔，不是代入感）',
  /bond-(new|edit)-why/.test(hudSrc), false);
eq('H7 bondLink 模組沒有理由欄的殘留（normalizeBondWhy 等已移除）',
  /normalizeBondWhy|BOND_WHY_MAX/.test(linkSrc), false);
eq('H8 履歷不再寫理由（`note:` 不該出現在羈絆的記錄裡）',
  /kind:\s*'bond'[\s\S]{0,400}note:/.test(hudSrc), false);

/* ────────────────────────────────────────────────────────────────
   Z. 斷言器自我體檢
   ────────────────────────────────────────────────────────────────
   上面那批假綠燈就是「斷言器沒有體檢」造成的：一條永遠會過的斷言，
   和一條根本沒跑的斷言，在輸出上都長成 PASS。所以餵它一組一定不相等的值，
   它必須回 false——不然後面所有 PASS 都不算數。 */
const beforeSelfCheck = results.length;
eq('__selfcheck__', 1, 2);
const selfCheckOk = results.length === beforeSelfCheck + 1 && results[results.length - 1].ok === false;
results.pop();
check('Z1 斷言器本身會紅（餵不相等的值必須回 false）', selfCheckOk);

/* ────────────────────────────────────────────────────────────────
   總結
   ──────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log(`\n  羈絆不是六個標籤，是六段關係。`);
  console.log(`  「名冊已無此人」如果畫在沒有連結的羈絆上，就是在正確的東西上報錯。`);
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
