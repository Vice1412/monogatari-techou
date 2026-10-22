/**
 * 攻擊欄位解析契約測試（`utils/attackDisplay.js`）。
 *
 * 執行：`npm run test:npcattack`（已納入 `npm test` 串接）
 *
 * 為什麼要有這個檔案（2026-10-22 使用者回報）：
 * 使用者回報「自定義攻擊時屬性沒有照著已選的內容」與「改了內容保存之後就亂掉、強制固定」。
 * 根因是**同一欄位有兩個寫入端**：
 *   1. 卡片上的「距離／屬性」選單（寫進 `skill.selections`）；
 *   2. 編輯面板的 距離／屬性 下拉（直接寫進 `skill.attack`）。
 * 而顯示端原本只在「值是 `{key}` 佔位符」時才讀選單，於是編輯面板一旦寫死，
 * 選單就永久失效，且那個寫死值會跟著存檔。
 *
 * 本檔護住三件事：
 *   - **選單是唯一真相**：只要技能宣告了同名選單，顯示值一律以選單為準（含舊存檔修復）。
 *   - **沒有同名選單時不得亂改**：寫死的值要原樣保留（例如「強力攻擊一律近戰」）。
 *   - **儲存端不得再把選單欄位寫死**：`unfreezeAttackField` 的行為 + 元件原始碼守門。
 */
import { ROLES_DATA } from '../src/features/npc-workshop/data/roles.js';
import {
  hasSelectionKey,
  resolveAttackField,
  resolveAttack,
  unfreezeAttackField,
} from '../src/features/npc-workshop/utils/attackDisplay.js';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, ok, detail = '') => {
  if (ok) { pass += 1; lines.push(`  ✓ ${label}`); }
  else { fail += 1; lines.push(`  ✗ ${label}${detail ? `　→ ${detail}` : ''}`); }
};
const eq = (label, actual, expected) => check(label, actual === expected, `實際=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);

const brute = ROLES_DATA['暴徒'];
const normalAttack = brute.defaultSkills.find(s => s.originalName === '普通攻擊');
const strongAttack = brute.defaultSkills.find(s => s.originalName === '強力攻擊');

lines.push('');
lines.push('A. hasSelectionKey');
eq('普通攻擊宣告了 distance 選單', hasSelectionKey(normalAttack.selectionsConfig, 'distance'), true);
eq('普通攻擊宣告了 type 選單', hasSelectionKey(normalAttack.selectionsConfig, 'type'), true);
eq('強力攻擊沒有宣告 distance 選單', hasSelectionKey(strongAttack.selectionsConfig, 'distance'), false);
eq('undefined 設定不算宣告', hasSelectionKey(undefined, 'type'), false);
eq('空陣列不算宣告', hasSelectionKey([], 'type'), false);

lines.push('');
lines.push('B. resolveAttackField：選單優先');
eq('選單值勝過寫死值（舊存檔修復的核心）',
  resolveAttackField('冰', 'type', { type: '暗' }, normalAttack.selectionsConfig), '暗');
eq('選單值勝過佔位符',
  resolveAttackField('{type}', 'type', { type: '火' }, normalAttack.selectionsConfig), '火');
eq('佔位符由 selections 解析',
  resolveAttackField('{type}', 'type', { type: '雷' }, undefined), '雷');
eq('沒有同名選單 → 寫死值原樣保留',
  resolveAttackField('近戰', 'distance', { distance: '遠程' }, strongAttack.selectionsConfig), '近戰');
eq('沒有選單也沒有佔位符 → 原樣',
  resolveAttackField('【靈】+【靈】', 'formula', undefined, undefined), '【靈】+【靈】');
eq('選單空字串不算已選，退回佔位符原樣',
  resolveAttackField('{type}', 'type', { type: '' }, normalAttack.selectionsConfig), '{type}');
eq('選單未設定 → 退回佔位符原樣',
  resolveAttackField('{type}', 'type', {}, normalAttack.selectionsConfig), '{type}');
eq('非字串值（undefined）原樣',
  resolveAttackField(undefined, 'type', {}, undefined), undefined);

lines.push('');
lines.push('C. resolveAttack：整組欄位');
const fresh = resolveAttack(normalAttack.attack, { distance: '遠程', type: '暗' }, normalAttack.selectionsConfig);
eq('距離解析成選單值', fresh.distance, '遠程');
eq('屬性解析成選單值', fresh.type, '暗');
eq('未宣告選單的欄位不動（formula 仍是字面）', fresh.formula, '[DEX + MIG]');
eq('baseDmg 不受影響', fresh.baseDmg, 5);
eq('extra 不受影響', fresh.extra, '此攻擊具有多重（2）。');

// 使用者截圖 3 的實際狀態：選單顯示「暗」，卡片卻顯示「冰」——舊存檔把 type 寫死了。
const legacyFrozen = { ...normalAttack.attack, type: '冰', distance: '近戰' };
const healed = resolveAttack(legacyFrozen, { distance: '遠程', type: '暗' }, normalAttack.selectionsConfig);
eq('舊存檔：寫死的屬性被選單覆蓋', healed.type, '暗');
eq('舊存檔：寫死的距離被選單覆蓋', healed.distance, '遠程');

const strongResolved = resolveAttack(strongAttack.attack, { type: '毒' }, strongAttack.selectionsConfig);
eq('強力攻擊：屬性走選單', strongResolved.type, '毒');
eq('強力攻擊：距離維持寫死的近戰', strongResolved.distance, '近戰');

eq('null 攻擊原樣回傳', resolveAttack(null, {}, undefined), null);

lines.push('');
lines.push('D. unfreezeAttackField：儲存端不得鎖死選單');
eq('有同名選單 + 寫死值 → 還原成佔位符',
  unfreezeAttackField('冰', 'type', normalAttack.selectionsConfig), '{type}');
eq('有同名選單 + 已是佔位符 → 不動',
  unfreezeAttackField('{type}', 'type', normalAttack.selectionsConfig), '{type}');
eq('沒有同名選單 → 寫死值不動',
  unfreezeAttackField('近戰', 'distance', strongAttack.selectionsConfig), '近戰');
eq('空字串不動', unfreezeAttackField('', 'type', normalAttack.selectionsConfig), '');
eq('非字串不動', unfreezeAttackField(7, 'type', normalAttack.selectionsConfig), 7);

lines.push('');
lines.push('E. 元件原始碼守門（防止第二個寫入端回歸）');
const fs = await import('node:fs/promises');
const read = (p) => fs.readFile(`src/features/npc-workshop/${p}`, 'utf8');
const editableSrc = await read('components/EditableSkill.jsx');
const readonlySrc = await read('components/ReadOnlySkill.jsx');
const exportSrc = await read('utils/npcTextExport.js');

const unfreezeOnSave = (editableSrc.match(/unfreezeAttackField\(editAttack\./g) || []).length;
const unfreezeOnSeed = (editableSrc.match(/unfreezeAttackField\(base\./g) || []).length;
check('EditableSkill 存檔前逐一 unfreeze 距離／公式／屬性（3 個）', unfreezeOnSave >= 3, `實際 ${unfreezeOnSave} 個`);
check('EditableSkill 編輯狀態起點也先 unfreeze（舊存檔可自癒）', unfreezeOnSeed >= 3, `實際 ${unfreezeOnSeed} 個`);
check('EditableSkill 不再把 editAttack 整包直接寫回',
  !/attack:\s*skill\.category === 'attack'\s*\?\s*editAttack\s*[,}]/.test(editableSrc));
check('EditableSkill 的編輯面板改用 onUpdateSelection 綁定選單欄位',
  /selCfg\('type'\)[\s\S]{0,200}onUpdateSelection\(skill\.id, 'type'/.test(editableSrc));
check('EditableSkill 顯示端改用 resolveAttack',
  /const atk = resolveAttack\(skill\.attack/.test(editableSrc));
check('ReadOnlySkill 顯示端改用 resolveAttack',
  /const atk = skill\.attack \? resolveAttack\(/.test(readonlySrc));
check('npcTextExport 四種格式都改用 resolveAttack',
  (exportSrc.match(/resolveAttack\(s\.attack/g) || []).length >= 4);
check('npcTextExport 不再輸出英文物種標籤（SPECIES_THEMES.label）',
  !/SPECIES_THEMES\[[^\]]*\]\?\.label/.test(exportSrc));

lines.push('');
lines.push('F. 真的渲染一次（SSR）：卡片顯示與選單方塊必須是同一份值');
// 為什麼要渲染：E 段是「原始碼長相」守門，證明不了使用者眼睛看到的東西。
// 這裡用與 `test:npcworkshopui` 相同的 SSR 手法，把「舊存檔（attack 已寫死）」餵進去，
// 斷言畫面出來的是選單值，而且選單方塊本身也停在選單值上。
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const EditableSkill = (await import('../src/features/npc-workshop/components/EditableSkill.jsx')).default;
const ReadOnlySkill = (await import('../src/features/npc-workshop/components/ReadOnlySkill.jsx')).default;

const finalStats = { Acc: 2, Dmg: 1, 'M.DEF': 0 };
const legacySkill = {
  ...normalAttack,
  id: 'skill_test_normal',
  selections: { distance: '遠程', type: '暗' },
  attack: { ...normalAttack.attack, distance: '近戰', type: '冰' },  // 舊存檔的凍結值
};

const noop = () => {};
const readOnlyHtml = renderToStaticMarkup(
  React.createElement(ReadOnlySkill, {
    skill: legacySkill, finalStats, npcName: '', npcLevel: 5, partyLevel: 5, onInspectorClick: noop,
  })
);
check('ReadOnlySkill：畫面出現選單值「暗」', readOnlyHtml.includes('暗'));
check('ReadOnlySkill：畫面不再出現寫死值「冰」', !readOnlyHtml.includes('冰'), readOnlyHtml.slice(0, 160));
check('ReadOnlySkill：距離顯示「遠程」', readOnlyHtml.includes('遠程'));

const editableHtml = renderToStaticMarkup(
  React.createElement(EditableSkill, {
    skill: legacySkill, rawSkill: legacySkill, onUpdate: noop, onDelete: noop, onUpdateSelection: noop,
    finalStats, npcLevel: 5, partyLevel: 5,
  })
);
// 屬性下拉的 <option> 清單本來就含「冰」——先把 option 全部剝掉，才驗得到「摘要」。
const editableHtmlNoOptions = editableHtml.replace(/<option[^>]*>[^<]*<\/option>/g, '');
check('EditableSkill：摘要顯示選單值「暗」', editableHtmlNoOptions.includes('暗'));
check('EditableSkill：摘要不再出現寫死值「冰」', !editableHtmlNoOptions.includes('冰'), editableHtmlNoOptions.slice(0, 200));
check('EditableSkill：選單方塊的屬性下拉停在「暗」（value 綁 selections，不是 attack）',
  /<option value="暗" selected=""/.test(editableHtml),
  (editableHtml.match(/<select[^>]*>[\s\S]{0,200}?<\/select>/g) || []).slice(0, 2).join(' | '));

lines.push('');
lines.push(`  通過 ${pass} / ${pass + fail}`);
console.log(lines.join('\n'));
if (fail > 0) {
  console.error(`\n[FAIL] ${fail} 項未通過`);
  process.exit(1);
}
