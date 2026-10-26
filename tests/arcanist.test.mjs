/**
 * 秘儀師（核心／變體）阿爾卡納規則護欄 —— `npm run test:arcanist`
 *
 * 為什麼要有這道關卡：
 * 2026-10-19 實際以玩家身分走完一次「秘儀師車卡」後，抓到五個互相掩護的缺陷：
 *   1. 變體角色在跑團面板**完全沒有**阿爾卡納面板（HUD 寫死核心職業名比對）
 *   2. 創角六步**沒有任何一處**能完成「開局自選一個阿爾卡納」
 *   3. `ArcanistManager` 預設 `boundArcana: ['sword']`，等於送一個沒選過的契約
 *   4. 面板寫了召喚費，卻不扣 MP、不擋付不起的召喚、不算【緊急秘儀】折扣、
 *      不結算【阿爾卡納再生】／【秘術再生】、【快速召喚】的兩個選項都不存在
 *   5. 屬性預設卡按下去只把骰子丟進托盤，不寫回四維
 *
 * 其中第 1 項之所以能活這麼久，是因為舊護欄把 `ArcanistManager` **單獨 SSR** 起來測，
 * 而「面板會不會出現」寫在 `CharacterPlayHUD` 的條件式裡、只用**原始碼字串**斷言。
 * 兩者都綠，缺陷照樣存在。所以這裡除了測純函式，也直接測 **HUD 的顯示判定**本身。
 */
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNewCharacter, calculateCharacterStats, validateCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import { ATTRIBUTE_PRESET_ARRAYS } from '../src/features/character-sheet/data/sourcebookConfig.js';
import {
  ARCANIST_CLASS_NAME,
  ARCANIST_VARIANT_CLASS_NAME,
  isArcanistClassName,
  getArcanistClass,
  usesVariantArcanist,
  getArcanistSkillLevel,
  shouldRenderArcanistPanel,
  getArcanistSummonCost,
  getArcanistSummonHeal,
  getArcanistDismissHeal,
  getStartingArcanaQuota,
  buildArcanaEffectSections,
  isInCrisis
} from '../src/features/character-sheet/utils/arcanist.js';
import { RULE_CODEX } from '../src/features/character-sheet/data/ruleCodexData.js';
import { applyPreset, buildTrayPool, assignPoolInOrder, attributesFromPool } from '../src/features/character-sheet/utils/attributePresets.js';
import ArcanistManager from '../src/features/character-sheet/components/companions/ArcanistManager.jsx';
import ArcanistStarterBinding from '../src/features/character-sheet/components/ArcanistStarterBinding.jsx';

const lines = [];
let pass = 0;
let fail = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass += 1; lines.push(`  PASS  ${label}`); }
  else { fail += 1; lines.push(`  FAIL  ${label}\n        期望 ${e}\n        實得 ${a}`); }
};
const section = (t) => lines.push(`\n=== ${t} ===`);

/** 造一個可控的秘儀師角色（等級與屬性固定，避免依賴引擎預設值） */
const mkChar = ({
  className = ARCANIST_CLASS_NAME,
  skills = [{ name: '綁定和召喚', sl: 1 }],
  bound = [],
  currentHp = null,
  currentMp = null
} = {}) => ({
  ...createNewCharacter({ name: '秘儀師測試' }),
  level: 10,
  attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
  classes: [{ className, level: 10, skills }],
  arcanistData: { boundArcana: bound, customArcana: [], activeSummonId: null },
  currentHp,
  currentMp
});

// ─────────────────────────────────────────────────────────────
section('A. 職業判定：核心與變體是同一家族');
check('秘儀師是秘儀師家族', isArcanistClassName('秘儀師'), true);
check('秘儀師【變體】也是秘儀師家族', isArcanistClassName(ARCANIST_VARIANT_CLASS_NAME), true);
check('博學士不是', isArcanistClassName('博學士'), false);
check('undefined 不會炸', isArcanistClassName(undefined), false);

const coreChar = mkChar();
const variantChar = mkChar({ className: ARCANIST_VARIANT_CLASS_NAME });
check('核心角色取得到職業條目', getArcanistClass(coreChar)?.className, ARCANIST_CLASS_NAME);
check('變體角色取得到職業條目', getArcanistClass(variantChar)?.className, ARCANIST_VARIANT_CLASS_NAME);
check('核心角色 usesVariantArcanist = false', usesVariantArcanist(coreChar), false);
check('變體角色 usesVariantArcanist = true', usesVariantArcanist(variantChar), true);
check('沒有秘儀師職業的角色回 null', getArcanistClass(mkChar({ className: '博學士', skills: [] })), null);

// ─────────────────────────────────────────────────────────────
section('B. 面板顯示判定：變體角色必須出現（這是 2026-10-19 的主缺陷）');
check('核心秘儀師 → 顯示', shouldRenderArcanistPanel(coreChar, ARCANIST_CLASS_NAME), true);
check('變體秘儀師 → 顯示（舊版寫死 === 秘儀師，這裡曾是 false）',
  shouldRenderArcanistPanel(variantChar, ARCANIST_VARIANT_CLASS_NAME), true);
check('有職業但沒有【綁定和召喚】→ 不顯示',
  shouldRenderArcanistPanel(mkChar({ skills: [{ name: '阿爾卡納圓環', sl: 1 }] }), ARCANIST_CLASS_NAME), false);
check('技能 SL 為 0 → 不顯示',
  shouldRenderArcanistPanel(mkChar({ skills: [{ name: '綁定和召喚', sl: 0 }] }), ARCANIST_CLASS_NAME), false);
check('非秘儀師職業 → 不顯示',
  shouldRenderArcanistPanel(mkChar({ className: '博學士', skills: [{ name: '綁定和召喚', sl: 1 }] }), '博學士'), false);
check('同一角色，但 HUD 傳的是別職業名 → 不顯示（面板不會掛錯職業底下）',
  shouldRenderArcanistPanel(coreChar, '博學士'), false);

// 原始碼護欄：HUD 不得再寫死職業名比對
const hudSrc = fs.readFileSync('src/features/character-sheet/components/CharacterPlayHUD.jsx', 'utf8');
check('HUD 不再用 cl.className === 秘儀師 當阿爾卡納面板的閘門',
  hudSrc.includes("cl.className === '秘儀師'"), false);
check('HUD 改呼叫共用的 shouldRenderArcanistPanel', hudSrc.includes('shouldRenderArcanistPanel(character, cl.className)'), true);

// ─────────────────────────────────────────────────────────────
section('C. 召喚費：40／30、【緊急秘儀】只在危機、【快速召喚】是選項');
const costCore = getArcanistSummonCost(coreChar);
check('核心基礎 40', costCore.base, 40);
check('核心無折扣時 40', costCore.cost, 40);
check('核心沒有危機時 emergencyDiscount = 0', costCore.emergencyDiscount, 0);
check('核心沒有快速召喚折扣', costCore.quickDiscount, 0);

const costVariant = getArcanistSummonCost(variantChar);
check('變體基礎 30', costVariant.base, 30);
check('變體無折扣時 30', costVariant.cost, 30);

// 危機判定：危機值 = 最大 HP 的一半（向下取整）
const crisisProbe = mkChar();
const probeStats = calculateCharacterStats(crisisProbe);
const threshold = probeStats.crisisThreshold;
check('危機值 = 最大 HP 的一半', threshold, Math.floor(probeStats.maxHp / 2));
check('HP 高於危機值 → 不在危機', isInCrisis({ ...crisisProbe, currentHp: threshold + 1 }), false);
check('HP 等於危機值 → 在危機', isInCrisis({ ...crisisProbe, currentHp: threshold }), true);
check('HP 低於危機值 → 在危機', isInCrisis({ ...crisisProbe, currentHp: Math.max(1, threshold - 1) }), true);
check('HP 為 0（倒地）→ 不算危機（不能靠倒地吃折扣）', isInCrisis({ ...crisisProbe, currentHp: 0 }), false);
check('currentHp 為 null（視為滿血）→ 不在危機', isInCrisis({ ...crisisProbe, currentHp: null }), false);

const coreEmergency = mkChar({ skills: [{ name: '綁定和召喚', sl: 1 }, { name: '緊急秘儀', sl: 3 }] });
const costCoreCrisis = getArcanistSummonCost({ ...coreEmergency, currentHp: threshold });
check('核心【緊急秘儀】SL3 在危機時折 15', costCoreCrisis.emergencyDiscount, 15);
check('核心危機時召喚費 40 − 15 = 25', costCoreCrisis.cost, 25);
const costCoreCalm = getArcanistSummonCost({ ...coreEmergency, currentHp: probeStats.maxHp });
check('同一角色不在危機時沒有折扣（緊急秘儀不是常駐）', costCoreCalm.cost, 40);

const variantQuick = mkChar({ className: ARCANIST_VARIANT_CLASS_NAME, skills: [{ name: '綁定和召喚', sl: 1 }, { name: '快速召喚', sl: 4 }] });
check('變體【快速召喚】不勾選時不折扣', getArcanistSummonCost(variantQuick).cost, 30);
check('變體【快速召喚】勾選時折 SL×5 = 20', getArcanistSummonCost(variantQuick, { quickSummon: true }).quickDiscount, 20);
check('變體快速召喚後 30 − 20 = 10', getArcanistSummonCost(variantQuick, { quickSummon: true }).cost, 10);
check('核心角色即使傳 quickSummon 也不會折（那是變體技能）',
  getArcanistSummonCost(mkChar({ skills: [{ name: '綁定和召喚', sl: 1 }, { name: '快速召喚', sl: 4 }] }), { quickSummon: true }).quickDiscount, 0);

// 費用不得為負（SL 疊加超過基礎值時）
const overStack = mkChar({ className: ARCANIST_VARIANT_CLASS_NAME, skills: [{ name: '綁定和召喚', sl: 1 }, { name: '快速召喚', sl: 9 }] });
check('折扣超過基礎值時費用夾在 0', getArcanistSummonCost(overStack, { quickSummon: true }).cost, 0);

check('MP 不足時 affordable = false', getArcanistSummonCost({ ...coreChar, currentMp: 39 }).affordable, false);
check('MP 剛好足夠時 affordable = true', getArcanistSummonCost({ ...coreChar, currentMp: 40 }).affordable, true);
check('MP 足夠時 affordable = true', getArcanistSummonCost({ ...coreChar, currentMp: 60 }).affordable, true);
check('currentMp 為 null 時視為滿 MP', getArcanistSummonCost({ ...coreChar, currentMp: null }).curMp, probeStats.maxMp);

// ─────────────────────────────────────────────────────────────
section('D. 治療：【阿爾卡納再生】只在核心、【秘術再生】只在變體且必須危機');
check('核心【阿爾卡納再生】SL2 → 召喚時回 10 HP',
  getArcanistSummonHeal(mkChar({ skills: [{ name: '綁定和召喚', sl: 1 }, { name: '阿爾卡納再生', sl: 2 }] })), 10);
check('沒有【阿爾卡納再生】→ 0', getArcanistSummonHeal(coreChar), 0);
check('變體沒有【阿爾卡納再生】（那不是變體技能）',
  getArcanistSummonHeal(mkChar({ className: ARCANIST_VARIANT_CLASS_NAME, skills: [{ name: '綁定和召喚', sl: 1 }, { name: '阿爾卡納再生', sl: 2 }] })), 0);

const variantRegen = mkChar({ className: ARCANIST_VARIANT_CLASS_NAME, skills: [{ name: '綁定和召喚', sl: 1 }, { name: '秘術再生', sl: 6 }] });
check('變體【秘術再生】SL6 在危機時回 30 HP', getArcanistDismissHeal({ ...variantRegen, currentHp: threshold }), 30);
check('同一角色不在危機時回 0（解除效果有前置條件）',
  getArcanistDismissHeal({ ...variantRegen, currentHp: probeStats.maxHp }), 0);
check('核心角色沒有【秘術再生】',
  getArcanistDismissHeal(mkChar({ skills: [{ name: '綁定和召喚', sl: 1 }, { name: '秘術再生', sl: 6 }], currentHp: threshold })), 0);

check('開局可自選 1 個（有綁定和召喚）', getStartingArcanaQuota(coreChar), 1);
check('沒有綁定和召喚 → 0', getStartingArcanaQuota(mkChar({ skills: [] })), 0);

// ─────────────────────────────────────────────────────────────
section('E. 新角色不得預先綁定任何阿爾卡納（舊版預設 sword）');
const fresh = createNewCharacter({ name: '全新角色' });
check('createNewCharacter 帶 arcanistData 欄位', !!fresh.arcanistData, true);
check('boundArcana 是空陣列', fresh.arcanistData.boundArcana, []);
check('activeSummonId 是 null', fresh.arcanistData.activeSummonId, null);
const arcanistSrc = fs.readFileSync('src/features/character-sheet/components/companions/ArcanistManager.jsx', 'utf8');
check('面板原始碼不再有 sword 預設', arcanistSrc.includes("boundArcana: ['sword']"), false);

// ─────────────────────────────────────────────────────────────
section('F. 規則自檢：有【綁定和召喚】卻沒選開局阿爾卡納 → 提醒');
const unbound = { ...mkChar(), arcanistData: { boundArcana: [], customArcana: [], activeSummonId: null } };
const unboundResult = validateCharacter(unbound);
const hasBindingWarning = unboundResult.warnings.some((w) => String(w.message || '').includes('綁定和召喚'));
check('未選開局阿爾卡納 → 出現提醒', hasBindingWarning, true);
check('提醒指向第 2 步（職業與技能）',
  unboundResult.warnings.filter((w) => String(w.message || '').includes('綁定和召喚')).every((w) => w.step === 2), true);
check('提醒不升級成錯誤（玩家仍可存檔／試算）',
  unboundResult.errors.some((e) => String(e.message || '').includes('綁定和召喚')), false);

const boundOk = { ...mkChar(), arcanistData: { boundArcana: ['sword'], customArcana: [], activeSummonId: null } };
check('已選開局阿爾卡納 → 不再提醒',
  validateCharacter(boundOk).warnings.some((w) => String(w.message || '').includes('綁定和召喚')), false);
const nonArcanist = mkChar({ className: '博學士', skills: [] });
check('非秘儀師角色不受影響',
  validateCharacter(nonArcanist).warnings.some((w) => String(w.message || '').includes('綁定和召喚')), false);

// ─────────────────────────────────────────────────────────────
section('G. 屬性預設卡：點擊起始陣列先出現在托盤（尚未入座），再由使用者拖曳或一鍵填入');
check('官方三組起始陣列都在', ATTRIBUTE_PRESET_ARRAYS.length, 3);
ATTRIBUTE_PRESET_ARRAYS.forEach((preset) => {
  const trayPool = buildTrayPool(preset);
  check(`【${preset.name}】點選後托盤 4 顆`, trayPool.length, 4);
  check(`【${preset.name}】初始皆未入座（在托盤待拖曳）`, trayPool.every((d) => d.assignedTo === null), true);
  const { pool, attributes } = applyPreset(preset);
  check(`【${preset.name}】一鍵填入四顆都入座`, pool.every((d) => !!d.assignedTo), true);
  check(`【${preset.name}】推出四維 4 個鍵`, Object.keys(attributes || {}).length, 4);
  check(`【${preset.name}】四維值＝該組骰值`,
    Object.values(attributes || {}).slice().sort((a, b) => b - a), preset.diceList.slice().sort((a, b) => b - a));
});
check('托盤階段（未入座）不會推出半套屬性',
  attributesFromPool(buildTrayPool(ATTRIBUTE_PRESET_ARRAYS[0])), null);
check('一鍵填入是依 DEX→INS→MIG→WLP 的固定順序',
  assignPoolInOrder(buildTrayPool(ATTRIBUTE_PRESET_ARRAYS[0])).map((d) => d.assignedTo), ['dex', 'ins', 'mig', 'wlp']);

const pickerSrc = fs.readFileSync('src/features/character-sheet/components/AttributeMatrixPicker.jsx', 'utf8');
check('預設卡 onClick 會將骰子放入托盤並同步通知',
  /handleApplyPreset[\s\S]{0,400}?buildTrayPool[\s\S]{0,400}?notifyParent/.test(pickerSrc), true);

// ─────────────────────────────────────────────────────────────
section('H. SSR：面板與創角綁定區塊');
const renderPanel = (char, props = {}) => renderToStaticMarkup(React.createElement(ArcanistManager, {
  character: char, onChange: () => {}, showToast: () => {}, ...props
}));

const variantPanel = renderPanel(mkChar({
  className: ARCANIST_VARIANT_CLASS_NAME,
  skills: [{ name: '綁定和召喚', sl: 1 }, { name: '快速召喚', sl: 4 }],
  bound: ['qilin']
}));
check('變體面板顯示本次消耗 30 點 MP', variantPanel.includes('本次召喚消耗 30 點 MP'), true);
check('變體面板提供【快速召喚】勾選', variantPanel.includes('使用【快速召喚】①'), true);
check('變體面板的召喚鈕標出費用', variantPanel.includes('召喚（30 MP）'), true);

const corePanel = renderPanel(mkChar({ bound: ['sword'] }));
check('核心面板顯示本次消耗 40 點 MP', corePanel.includes('本次召喚消耗 40 點 MP'), true);
check('核心面板不提供【快速召喚】勾選', corePanel.includes('使用【快速召喚】①'), false);
check('核心面板沒有「已契約 1 種」以外的假預設（未綁定時是 0）',
  renderPanel(mkChar()).includes('已契約: 0 種'), true);

const brokePanel = renderPanel({ ...mkChar({ bound: ['sword'] }), currentMp: 10 });
check('MP 不足時召喚鈕停用', brokePanel.includes('disabled=""'), true);
check('MP 不足時召喚鈕標題說明原因', brokePanel.includes('MP 不足：需要 40 點'), true);

check('未綁定時面板提示開局可自選 1 個',
  renderPanel(mkChar()).includes('尚未綁定任何阿爾卡納'), true);

const renderStarter = (char) => renderToStaticMarkup(React.createElement(ArcanistStarterBinding, {
  character: char, onChange: () => {}, locked: false
}));
const starterHtml = renderStarter(mkChar());
check('創角綁定區塊會渲染', starterHtml.includes('開局自選阿爾卡納'), true);
check('創角綁定區塊列出核心 9 個阿爾卡納', (starterHtml.match(/name="starting-arcana"/g) || []).length, 9);
const starterVariantHtml = renderStarter(mkChar({ className: ARCANIST_VARIANT_CLASS_NAME }));
check('變體角色在創角時也能看到變體範例阿爾卡納（9 + 11）',
  (starterVariantHtml.match(/name="starting-arcana"/g) || []).length, 20);
check('沒有【綁定和召喚】的角色不渲染這塊（不干擾其他職業的創角畫面）',
  renderStarter(mkChar({ className: '博學士', skills: [] })), '');
check('未選時明說這格空著不算完成創角',
  starterHtml.includes('這一格空著不算完成創角'), true);

// ─────────────────────────────────────────────────────────────
section('I. 名額未滿的提示要指向真實存在的介面（原本寫「特技分頁」）');
const engineSrc = fs.readFileSync('src/features/character-sheet/utils/characterEngine.js', 'utf8');
check('不再指引玩家去不存在的「特技分頁」（只檢查 message 內容，註解提及不算）',
  /message:[^\n]*特技分頁/.test(engineSrc), false);
check('改為指向第 2 步的職業技能卡', engineSrc.includes('請回到第 2 步「職業與技能」'), true);
const quotaChar = {
  ...mkChar({ className: '元素師', skills: [] }),
  classes: [{ className: '元素師', level: 10, skills: [{ name: '元素魔法', sl: 4, selectedOptions: [] }] }]
};
const quotaWarning = validateCharacter(quotaChar).warnings.find((w) => String(w.message || '').includes('名額未滿'));
check('名額未滿仍會提醒（沒有把護欄改壞）', !!quotaWarning, true);
check('提醒文字裡有真實的按鈕名稱線索', /配置|調整/.test(String(quotaWarning?.message || '')), true);

// ─────────────────────────────────────────────────────────────
section('J. 效果要看得見（挑開局契約不能只靠名字下注）');

const swordArcana = RULE_CODEX.arcana.catalog.find((a) => a.id === 'sword');
const variantArcana = RULE_CODEX.arcanaVariant.catalog[0];

const coreSections = buildArcanaEffectSections(swordArcana);
check('核心阿爾卡納的段落標籤是「連攜／解除」', coreSections.map((s) => s.label), ['連攜', '解除']);
check('連攜段落帶出效果原文', coreSections[0].text.includes('5 點額外傷害'), true);
check('沒有脈衝的核心阿爾卡納不會硬塞脈衝段',
  coreSections.some((s) => s.key === 'pulse'), false);
check('變體阿爾卡納的段落標籤是「連結／脈衝／解除」',
  buildArcanaEffectSections(variantArcana, { variant: true }).map((s) => s.label),
  ['連結', '脈衝', '解除']);
check('空資料回空陣列（呼叫端不必自己防護）', buildArcanaEffectSections(null), []);
check('空白字串欄位會被濾掉',
  buildArcanaEffectSections({ merge: '  ', pulse: '', dismiss: '解除效果' }).map((s) => s.label),
  ['解除']);

check('核心 9 張卡都印出連攜預覽（不是只有名稱＋領域）',
  (starterHtml.match(/連攜：/g) || []).length, 9);
check('效果原文真的在畫面上（CSS 截行不代表內容被砍掉）',
  starterHtml.includes('5 點額外傷害'), true);
check('變體清單改用原文的「連結」措辭',
  (starterVariantHtml.match(/連結：/g) || []).length, 20);
check('有脈衝的變體阿爾卡納標出「脈衝」徽章',
  (starterVariantHtml.match(/脈衝/g) || []).length > 0, true);
check('效果文本走九相屬性渲染（規則七：不是純文字）',
  starterHtml.includes('class="fu-icon'), true);

const starterPicked = renderStarter(mkChar({ bound: ['sword'] }));
check('選定後出現完整效果面板',
  starterPicked.includes('data-testid="arcanist-starter-detail"'), true);
check('完整面板連解除效果都列出來',
  starterPicked.includes('劍之阿爾卡納沒有自願解除效果'), true);
check('未選定時不渲染完整面板',
  starterHtml.includes('data-testid="arcanist-starter-detail"'), false);

// ─────────────────────────────────────────────────────────────
lines.push(`\n通過 ${pass} / ${pass + fail}　${fail === 0 ? '（全部通過）' : `（失敗 ${fail}）`}`);
console.log(lines.join('\n'));
if (fail > 0) process.exit(1);
