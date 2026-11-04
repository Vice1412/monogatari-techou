/**
 * 屬性檢定的「點擊語意」契約（`utils/attributeCheck.js`）。
 *
 * 執行：`npm run test:attrcheck`（已納入 `npm test` 串接）
 *
 * ## 為什麼要有這支（2026-11-03）
 *
 * 使用者：「界面如此多按鈕，怎麼知道讓玩家該點哪個？點了還得跳個彈窗叫我選另一個
 * 骰子，我咋知道第二顆是什麼？都被你彈窗擋住了。」
 *
 * 舊版每一格有兩顆按鈕（大卡＝單屬性檢定、旁邊小鈕＝配對），玩家要在兩處之間來回。
 * 新版只有一句話：**點第一張記住它，再點任何一張就擲那兩顆。**
 *
 * 但「這句話」是一個判定，而判定原本寫在 `onClick` 裡——SSR 不執行事件，測不到。
 * 所以抽成純函式之後，這裡守三件事：
 *   ① 第一次點一定是「選」，不會擲骰（不然玩家點第一下就冒出彈窗）
 *   ② 第二次點任何一張（含同一張）都要變成「擲」，而且兩顆骰面帶對
 *   ③ label 必須寫出**骰面**，因為彈窗會蓋住屬性卡——那是玩家唯一的線索
 *
 * ## 第二批（同日，使用者第二次回報）
 *
 * 「點擊屬性的話就不要再讓玩家選骰子大小了，直接把你上面的標題 DEX d6 + MIG d10
 * 放下來就一目了然。」
 *
 * 所以 F 段驗彈窗本身：從屬性卡進來時（`lockDice: true`）**不該有骰階選擇器**，
 * 而該用大字寫出那兩顆；自由擲骰與進階修正仍然保留選擇器（那裡本來就要挑）。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DiceRollerModal from '../src/features/dice-roller/DiceRollerModal.jsx';
import {
  ATTRIBUTE_CHECK_KEYS,
  describeAttributeCheck
} from '../src/features/character-sheet/utils/attributeCheck.js';

let results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const DICE = { dex: 8, ins: 10, mig: 6, wlp: 12 };
const dieOf = (k) => DICE[k];

/* ────────────────────────────────────────────────────────────────
   A. 第一次點：只選，不擲
   ──────────────────────────────────────────────────────────────── */
const first = describeAttributeCheck({ firstKey: null, nextKey: 'dex', dieOf });
check('A1 還沒選首骰時，第一次點是「選」', first.mode === 'select', first.mode);
check('A2 選中的就是被點的那一張', first.key === 'dex', first.key);
check('A3 選的階段不帶骰面（呼叫端不該拿它去擲骰）', first.die1 === undefined && first.die2 === undefined, `${first.die1}/${first.die2}`);

/* ────────────────────────────────────────────────────────────────
   B. 第二次點：不同屬性 → 組合檢定
   ──────────────────────────────────────────────────────────────── */
const combo = describeAttributeCheck({ firstKey: 'dex', nextKey: 'ins', dieOf });
check('B1 第二張不同屬性 → 立刻變「擲」', combo.mode === 'roll', combo.mode);
check('B2 兩顆骰面各自對應（DEX d8 / INS d10）', combo.die1 === 8 && combo.die2 === 10, `${combo.die1}/${combo.die2}`);
check('B3 label 寫出兩個屬性與各自骰面', combo.label === 'DEX(d8) + INS(d10)', combo.label);
check('B4 組合檢定不標「單項檢定」', !(combo.label || '').includes('單項檢定'), combo.label || '(缺 label)');

/* ────────────────────────────────────────────────────────────────
   C. 第二次點同一張 → 同屬性兩顆（原書的檢定永遠是兩顆骰）
   ──────────────────────────────────────────────────────────────── */
const single = describeAttributeCheck({ firstKey: 'wlp', nextKey: 'wlp', dieOf });
check('C1 同一張點兩次 → 擲「WLP + WLP」', single.mode === 'roll' && single.die1 === 12 && single.die2 === 12, `${single.mode} ${single.die1}/${single.die2}`);
check('C2 label 標明這是單項檢定', (single.label || '').includes('單項檢定'), single.label || '(缺 label)');
check('C3 label 仍寫出骰面（不是只有名字）', (single.label || '').includes('(d12)'), single.label || '(缺 label)');

/* ────────────────────────────────────────────────────────────────
   D. 防禦性：骰面缺漏／壞值
   ──────────────────────────────────────────────────────────────── */
const noDie = describeAttributeCheck({ firstKey: 'dex', nextKey: 'ins' });
check('D1 沒傳 dieOf 時退回 d8（不是 crash、也不是 0）', noDie.die1 === 8 && noDie.die2 === 8, `${noDie.die1}/${noDie.die2}`);
const badDie = describeAttributeCheck({ firstKey: 'dex', nextKey: 'ins', dieOf: () => NaN });
check('D2 骰面是 NaN 時也退回 d8（畫面不能出現 dNaN）', badDie.die1 === 8 && !(badDie.label || '').includes('NaN'), badDie.label || '(缺 label)');
const zeroDie = describeAttributeCheck({ firstKey: 'dex', nextKey: 'ins', dieOf: () => 0 });
check('D3 骰面 0 視為未指派 → d8（與 `attributesUnset` 的語意一致）', zeroDie.die1 === 8, `${zeroDie.die1}`);

/* ────────────────────────────────────────────────────────────────
   E. 鍵集合：介面四張卡與判定用的是同一份
   ──────────────────────────────────────────────────────────────── */
check('E1 四個屬性鍵齊備且順序固定', ATTRIBUTE_CHECK_KEYS.join(',') === 'dex,ins,mig,wlp', ATTRIBUTE_CHECK_KEYS.join(','));
check('E2 每個鍵都能組成檢定（跑一遍全部組合）',
  ATTRIBUTE_CHECK_KEYS.every((a) => ATTRIBUTE_CHECK_KEYS.every((b) => {
    const r = describeAttributeCheck({ firstKey: a, nextKey: b, dieOf });
    return r.mode === 'roll' && Number.isFinite(r.die1) && Number.isFinite(r.die2) && (r.label || '').includes('(d');
  })),
  `${ATTRIBUTE_CHECK_KEYS.length}×${ATTRIBUTE_CHECK_KEYS.length} 組`);

/* ────────────────────────────────────────────────────────────────
   F. 彈窗：骰階鎖定（使用者第二次回報）
   ──────────────────────────────────────────────────────────────── */
const renderModal = (cfg) => renderToStaticMarkup(
  React.createElement(DiceRollerModal, { isOpen: true, onClose: () => {}, initialConfig: cfg })
);

const locked = renderModal({ die1: 6, die2: 10, modifier: 0, label: 'DEX(d6) + MIG(d10)', lockDice: true });
check('F1 從屬性卡進來時，不再出現「第一顆骰階」選擇器',
  !locked.includes('第一顆骰階'), locked.includes('第一顆骰階') ? '仍出現' : '已隱藏');
check('F2 也不再出現「第二顆骰階」', !locked.includes('第二顆骰階'), locked.includes('第二顆骰階') ? '仍出現' : '已隱藏');
check('F3 改成大字寫出那兩顆（括號換成空格，可直接唸）',
  locked.includes('DEX d6 + MIG d10'), 'DEX d6 + MIG d10');
check('F4 仍然可以直接擲（按鈕寫出 d6 + d10）',
  locked.includes('d6 + d10'), 'd6 + d10');
check('F5 標題不再重複那串屬性（它已經在內文）',
  locked.includes('FU 檢定擲骰') && !locked.includes('FU 檢定擲骰 · DEX'), 'FU 檢定擲骰');

const free = renderModal({ die1: 8, die2: 8, modifier: 0, label: '', lockDice: false });
check('F6 自由擲骰仍保留兩組骰階（那裡本來就要挑）',
  [free.includes('第一顆骰階'), free.includes('第二顆骰階'), free.includes('DEX d6 + MIG d10')],
  [true, true, false]);

const noCfg = renderToStaticMarkup(React.createElement(DiceRollerModal, { isOpen: true, onClose: () => {}, initialConfig: null }));
check('F7 完全沒有 initialConfig 時也保留選擇器（書封／章節入口的自由擲骰）',
  noCfg.includes('第一顆骰階'), noCfg.includes('第一顆骰階') ? '在' : '缺');

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  —— ${r.detail}` : ''}`);
console.log(`\n  通過 ${results.length - failed.length} / ${results.length}${failed.length ? `　失敗 ${failed.length}` : '　（全部通過）'}`);
if (failed.length) {
  console.log('\n  屬性檢定只有一句話：點第一張選它，再點任何一張就擲那兩顆。');
  console.log('  第一次點就跳彈窗、或 label 沒寫骰面，都是在破壞那句話。');
}
console.log(`${'='.repeat(56)}`);
process.exit(failed.length ? 1 : 0);
