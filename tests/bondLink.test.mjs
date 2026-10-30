/**
 * 羈絆 ⇄ NPC 檔案庫的連結，與「為什麼有這份情感」的註記（P3，2026-10-30）。
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
 * 特別是 G3、G6、J5 那幾條**對照組**：一條沒有連結的羈絆，絕不能出現「名冊已無此人」。
 * 少了對照組，「missing 會顯示提示」這條在「所有羈絆都顯示提示」時照樣會過。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterPlayHUD from '../src/features/character-sheet/components/CharacterPlayHUD.jsx';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import {
  BOND_WHY_MAX,
  normalizeBondWhy,
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
 *   A／B／C／F 四段三十幾條**永遠會過**。紅燈只有 8 條，而那 8 條之所以紅，
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
   A. normalizeBondWhy：一句理由，不是一段筆記
   ──────────────────────────────────────────────────────────────── */
eq('A1 前後空白被去掉', normalizeBondWhy('  他在城門前替我擋了一刀  '), '他在城門前替我擋了一刀');
eq('A2 換行壓成一個空白（不是留著換行）', normalizeBondWhy('第一句\n第二句'), '第一句 第二句');
eq('A3 超長會被截到上限', normalizeBondWhy('字'.repeat(BOND_WHY_MAX + 50)).length, BOND_WHY_MAX);
eq('A4 空值一律回空字串（不是 "null"／"undefined"）',
  [normalizeBondWhy(null), normalizeBondWhy(undefined), normalizeBondWhy(0)], ['', '', '']);
eq('A5 只有空白等於沒有理由', normalizeBondWhy('   \n  '), '');

/* ────────────────────────────────────────────────────────────────
   B. resolveBondNpc：三態要分得開
   ──────────────────────────────────────────────────────────────── */
eq('B1 沒有 npcId → none', resolveBondNpc({ target: '王國' }, NPC_POOL).status, 'none');
eq('B2 空字串 npcId 也是 none（不是 missing）',
  resolveBondNpc({ npcId: '' }, NPC_POOL).status, 'none');
eq('B3 連得上 → linked，而且拿得到那張卡',
  resolveBondNpc({ npcId: 'npc2' }, NPC_POOL).npc?.name, '艾蓮');
eq('B4 連不上 → missing（不是 none）',
  resolveBondNpc({ npcId: 'npc_deleted' }, NPC_POOL).status, 'missing');
eq('B5 名冊是空的也不算 missing（沒連結就沒有斷鏈可言）',
  resolveBondNpc({ target: '導師' }, []).status, 'none');
eq('B6 名冊不是陣列時不拋錯，當成空名冊',
  resolveBondNpc({ npcId: 'npc1' }, null).status, 'missing');
eq('B7 npcId 不是字串時不誤判（數字 id 當成沒連結）',
  resolveBondNpc({ npcId: 123 }, NPC_POOL).status, 'none');
eq('B8 名冊裡混進 null 不會炸',
  resolveBondNpc({ npcId: 'npc1' }, [null, ...NPC_POOL]).npc?.name, '導師');

/* ────────────────────────────────────────────────────────────────
   C. bondNpcSubtitle：缺哪一項就少哪一項
   ──────────────────────────────────────────────────────────────── */
eq('C1 三項都有就三項都寫', bondNpcSubtitle(NPC_POOL[0]), 'Lv.3 · 反派 · 帝國');
eq('C2 空字串的陣營不補佔位符', bondNpcSubtitle(NPC_POOL[1]), 'Lv.2 · 盟友');
eq('C3 沒有卡就回空字串（不是 "undefined"）',
  [bondNpcSubtitle(null), bondNpcSubtitle(undefined)], ['', '']);

/* ────────────────────────────────────────────────────────────────
   D. buildBondLinkFields：空的欄位不寫鍵
   ──────────────────────────────────────────────────────────────── */
eq('D1 兩項都空 → 一個鍵都不產生（舊存檔形狀不變）',
  Object.keys(buildBondLinkFields({ npcId: '', why: '' })), []);
eq('D2 只有理由 → 只有 why 一個鍵',
  Object.keys(buildBondLinkFields({ npcId: '', why: '他救過我' })), ['why']);
eq('D3 只有連結 → 只有 npcId 一個鍵',
  Object.keys(buildBondLinkFields({ npcId: 'npc1', why: '   ' })), ['npcId']);
eq('D4 理由存進去之前就收斂（不是畫的時候才處理）',
  buildBondLinkFields({ why: '  他  救過我 \n' }).why, '他 救過我');

/* ────────────────────────────────────────────────────────────────
   E. applyBondLinkFields：表單是完整的事實
   ──────────────────────────────────────────────────────────────── */
const linked = { id: 'b1', target: '導師', feelings: ['loyalty'], npcId: 'npc1', why: '他教會我握劍' };
eq('E1 取消連結後，舊的 npcId 真的消失（不是留著空字串）',
  'npcId' in applyBondLinkFields(linked, { npcId: '', why: '他教會我握劍' }), false);
eq('E2 清掉理由後，舊的 why 真的消失',
  'why' in applyBondLinkFields(linked, { npcId: 'npc1', why: '' }), false);
eq('E3 換一條連結會蓋掉舊的（不是兩條並存）',
  applyBondLinkFields(linked, { npcId: 'npc2', why: '' }).npcId, 'npc2');
eq('E4 其他欄位原封不動（情感與名字不受連結影響）',
  (({ target, feelings }) => [target, feelings])(applyBondLinkFields(linked, {})), ['導師', ['loyalty']]);

/* ────────────────────────────────────────────────────────────────
   F. describeBondEdit：情感與理由分開寫
   ──────────────────────────────────────────────────────────────── */
eq('F1 只改情感 → 寫出前後變化',
  describeBondEdit({ target: '導師', feelingsFrom: '忠誠', feelingsTo: '疑忌' }),
  '調整羈絆【導師】：忠誠 → 疑忌');
eq('F2 只補理由 → 說「補記理由」（不是只寫「調整羈絆」）',
  describeBondEdit({ target: '導師', feelingsFrom: '忠誠', feelingsTo: '忠誠', whyFrom: '', whyTo: '他救過我' }),
  '調整羈絆【導師】：補記理由');
eq('F3 改寫理由 → 說「理由已改寫」',
  describeBondEdit({ target: '導師', whyFrom: '他救過我', whyTo: '他騙過我' }),
  '調整羈絆【導師】：理由已改寫');
eq('F4 刪掉理由 → 說「刪去理由」',
  describeBondEdit({ target: '導師', whyFrom: '他救過我', whyTo: '' }),
  '調整羈絆【導師】：刪去理由');
eq('F5 什麼都沒改 → 只留名字（不假裝有事發生）',
  describeBondEdit({ target: '導師', feelingsFrom: '忠誠', feelingsTo: '忠誠', whyFrom: '他救過我', whyTo: '他救過我' }),
  '調整羈絆【導師】');
eq('F6 兩者都改 → 兩件事都寫出來',
  describeBondEdit({ target: '導師', feelingsFrom: '忠誠', feelingsTo: '疑忌', whyFrom: '', whyTo: '他騙過我' }),
  '調整羈絆【導師】：忠誠 → 疑忌，補記理由');

/* ────────────────────────────────────────────────────────────────
   G. 畫面上的三態（含對照組）
   ──────────────────────────────────────────────────────────────── */
const linkedMarkup = render(withBonds([{ ...linked }]), { npcLibrary: NPC_POOL });
eq('G1 連得上時畫出名冊上的職業與等級', countOf(linkedMarkup, 'Lv.3 · 反派 · 帝國'), 1);
eq('G2 連得上時畫出頭像', countOf(linkedMarkup, 'data:image/png;base64,iVBORw0KGgo='), 1);
eq('G3（對照組）連得上的羈絆不得出現「名冊已無此人」', countOf(linkedMarkup, '名冊已無此人'), 0);

const danglingMarkup = render(withBonds([{ ...linked, npcId: 'npc_deleted' }]), { npcLibrary: NPC_POOL });
eq('G4 斷鏈時說出「名冊已無此人」', countOf(danglingMarkup, '名冊已無此人'), 1);
eq('G5 斷鏈時保留玩家寫的名字（那是他寫的，不是連結的附屬品）',
  danglingMarkup.includes('>導師<'), true);

const plainMarkup = render(withBonds([{ id: 'b9', target: '王國', feelings: ['loyalty'] }]), { npcLibrary: NPC_POOL });
eq('G6（對照組）沒有連結的羈絆不得出現「名冊已無此人」', countOf(plainMarkup, '名冊已無此人'), 0);
eq('G7（對照組）沒有連結的羈絆不得畫出任何名冊資料',
  [countOf(plainMarkup, 'Lv.'), countOf(plainMarkup, 'data:image/png;base64')], [0, 0]);

/* ────────────────────────────────────────────────────────────────
   H. 「為什麼」在卡片上
   ──────────────────────────────────────────────────────────────── */
eq('H1 有理由就畫成一句引文', countOf(linkedMarkup, '「他教會我握劍」'), 1);
eq('H2 沒有理由就不畫引文（不是畫一對空引號）', countOf(plainMarkup, '「」'), 0);

/* ────────────────────────────────────────────────────────────────
   I. 建立彈窗：挑選器與理由輸入
   ──────────────────────────────────────────────────────────────── */
const creator = render(withBonds([]), { npcLibrary: NPC_POOL, initialBondModalOpen: true });
eq('I1 建立彈窗有挑選器', countOf(creator, 'data-testid="bond-new-npc"'), 1);
eq('I2 建立彈窗有理由輸入', countOf(creator, 'data-testid="bond-new-why"'), 1);
eq('I3 挑選器列出名冊上的人（帶職業與等級）',
  [creator.includes('導師（Lv.3 · 反派 · 帝國）'), creator.includes('艾蓮（Lv.2 · 盟友）')], [true, true]);
eq('I4 挑選器一定留著「不連結」這個選項（羈絆對象可以不是名冊裡的人）',
  creator.includes('不連結名冊（自由輸入名稱）'), true);
eq('I5 理由欄有長度上限（不會變成第二個背景故事欄）',
  countOf(creator, `maxLength="${BOND_WHY_MAX}"`) + countOf(creator, `maxlength="${BOND_WHY_MAX}"`), 1);

const emptyPoolCreator = render(withBonds([]), { npcLibrary: [], initialBondModalOpen: true });
eq('I6 名冊空的時候不是畫一個空下拉，而是教一件事',
  countOf(emptyPoolCreator, '名冊還沒有任何 NPC'), 1);
eq('I7 名冊空的時候仍然可以直接打名字（不擋人）',
  countOf(emptyPoolCreator, '羈絆對象名稱'), 1);

/* ────────────────────────────────────────────────────────────────
   J. 就地編輯面板：斷鏈要看得見
   ──────────────────────────────────────────────────────────────── */
const editDangling = render(withBonds([{ ...linked, npcId: 'npc_deleted' }]), {
  npcLibrary: NPC_POOL,
  initialEditingBondId: 'b1'
});
eq('J1 編輯面板出現挑選器', countOf(editDangling, 'data-testid="bond-edit-npc"'), 1);
eq('J2 編輯面板預填原本的理由', editDangling.includes('他教會我握劍'), true);
eq('J3 斷鏈的連結在選單裡留下一顆看得見的殘留選項（不然會被畫成「不連結」）',
  editDangling.includes('（名冊已無此人，連結已失效）'), true);
eq('J4 斷鏈時「名冊已無此人」總共出現兩次（卡片一次、選單一次）',
  countOf(editDangling, '名冊已無此人'), 2);

const editLinked = render(withBonds([{ ...linked }]), {
  npcLibrary: NPC_POOL,
  initialEditingBondId: 'b1'
});
eq('J5（對照組）連結正常時選單不留殘留選項',
  editLinked.includes('（名冊已無此人，連結已失效）'), false);

/* ────────────────────────────────────────────────────────────────
   K. 源碼護欄
   ──────────────────────────────────────────────────────────────── */
const hudSrc = fs.readFileSync(
  path.resolve('src/features/character-sheet/components/CharacterPlayHUD.jsx'),
  'utf8'
);

/*
   K1 的比對刻意寫成「物件字面」而不是「任何 npcId 後面接空字串」。
   ※ 第一版用 `/npcId\s*:\s*''/`，結果抓到的是三元運算的回退：
     `typeof bond.npcId === 'string' ? bond.npcId : ''` ——那是**讀**，不是寫。
     掃描條件太寬會製造假紅，而假紅會讓人把整條護欄刪掉。
*/
eq('K1 元件裡沒有把「空連結」寫成物件字面（那會讓連結多出第二種表示法）',
  /[{,]\s*npcId\s*:\s*''/.test(hudSrc), false);
eq('K2 建立與就地編輯共用同一個挑選器（各寫一份就會有一邊漏掉斷鏈分支）',
  countOf(hudSrc, '<BondNpcSelect'), 2);
eq('K3 連結判定不在元件裡自己寫（一律走 bondLink 模組）',
  hudSrc.includes("from '../utils/bondLink'"), true);
eq('K4 卡片的三態走 resolveBondNpc（不是自己讀 bond.npcId 分支）',
  countOf(hudSrc, 'resolveBondNpc('), 1);
eq('K5 刪鍵的邏輯不在元件裡（在 applyBondLinkFields，那裡才測得到）',
  /delete\s+\w*\.?npcId/.test(hudSrc), false);

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
