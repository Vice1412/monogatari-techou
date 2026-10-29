/**
 * 官方經典職業搭配資料測試。
 *
 * 執行：npm run test:presets
 *
 * 全部資料的權威來源為官方英文正式版原書（印刷頁碼）：
 *   核心規則書     CLASSIC CHARACTERS          p.172–175  20 組
 *   高度奇幻手冊   NEW CLASSIC CHARACTERS      p.132–135  18 組
 *   自然奇幻手冊   NEW CLASSIC CHARACTERS      p.134–137  18 組
 *   科技奇幻手冊   NEW CLASSIC CHARACTERS      p.146–149  17 組
 *   官方特典合輯   HALLOWEEN CHARACTERS        p.24–25     8 組
 *
 * 本測試只驗證「資料自洽 + 與 rulesData 對得上」，不重抄官方數值；
 * 官方數值本身記錄於 `implementation_plan-classic-presets.md` §6。
 */
import { readFileSync } from 'node:fs';
import { ALL_STARTER_PRESETS, STARTER_PRESETS } from '../src/features/character-sheet/data/starterPresets.js';
import { EXPANSION_PRESETS } from '../src/features/character-sheet/data/expansionPresets.js';
import { SOURCEBOOKS } from '../src/features/character-sheet/data/sourcebookConfig.js';
import { buildPresetSections } from '../src/features/character-sheet/utils/presetFilters.js';
import { applyPreset } from '../src/features/character-sheet/utils/presetApply.js';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';
import { createNewCharacter } from '../src/features/character-sheet/utils/characterEngine.js';
import { StarterPresetsPanel } from '../src/features/character-sheet/components/StarterPresetsModal.jsx';
import {
  getSkillSuboptionConfig,
  calculateSkillSuboptionMax,
  DANCER_DANCES,
  CHANTER_DATA,
  ESPER_GIFTS,
  MUTANT_THERIOFORMS,
  FLORIST_MAGISEEDS,
  SYMBOLIST_SYMBOLS
} from '../src/features/character-sheet/data/skillSuboptionsData.js';
import {
  PILOT_FRAMES,
  findModuleById,
  getUnlockedModuleQuota
} from '../src/features/character-sheet/data/pilotVehicleData.js';
import { RULE_CODEX } from '../src/features/character-sheet/data/ruleCodexData.js';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};
const section = (t) => lines.push(`\n=== ${t} ===`);

const VALID_SOURCEBOOKS = Object.keys(SOURCEBOOKS);
const DIE_FACES = [6, 8, 10];

// ─────────────────────────────────────────────────────────── A
section('A. 規模與分佈（對照官方五本手冊）');
// 2026-10-06：+2 = 特典合輯的兩組卡牌大師範例（Bonus Collection 印刷 p.11 的 SAMPLE CHARACTERS）。
check('總組數 = 83', ALL_STARTER_PRESETS.length, 83);
check('核心 20', STARTER_PRESETS.length, 20);
check('擴充 63', EXPANSION_PRESETS.length, 63);
check('ALL = 核心 + 擴充',
  ALL_STARTER_PRESETS.length, STARTER_PRESETS.length + EXPANSION_PRESETS.length);

const byBook = (book) => ALL_STARTER_PRESETS.filter((p) => (p.sourcebook || 'core') === book);
check('核心 20', byBook('core').length, 20);
check('高度奇幻 18（印刷 p.132-135）', byBook('highFantasy').length, 18);
check('自然奇幻 18（印刷 p.134-137）', byBook('naturalFantasy').length, 18);
check('科技奇幻 17（印刷 p.146-149）', byBook('technoFantasy').length, 17);
// 2026-10-06：+2 = 卡牌大師的兩組範例（印刷 p.11 的 SAMPLE CHARACTERS，與 p.24-25 的 Halloween 系列不同節）。
check('特典合輯 10（p.24-25 的 Halloween 8 ＋ p.11 的卡牌大師 2）', byBook('bonus').length, 10);

// ─────────────────────────────────────────────────────────── B
section('B. 識別字與欄位完整性');
check('id 全部唯一', new Set(ALL_STARTER_PRESETS.map((p) => p.id)).size, ALL_STARTER_PRESETS.length);
check('sourcebook 全部合法', ALL_STARTER_PRESETS.every((p) => VALID_SOURCEBOOKS.includes(p.sourcebook || 'core')), true);
check('title 非空', ALL_STARTER_PRESETS.every((p) => typeof p.title === 'string' && p.title.trim().length > 0), true);
check('en 非空', ALL_STARTER_PRESETS.every((p) => typeof p.en === 'string' && p.en.trim().length > 0), true);
check('group 為 null 或 {id,title}',
  ALL_STARTER_PRESETS.every((p) => p.group === null || (typeof p.group?.id === 'string' && typeof p.group?.title === 'string')), true);
check('group 與 sourcebook 同源（預組不會跨手冊）',
  ALL_STARTER_PRESETS.every((p) => {
    if (!p.group) return true;
    const members = ALL_STARTER_PRESETS.filter((q) => q.group?.id === p.group.id);
    return members.every((q) => (q.sourcebook || 'core') === (p.sourcebook || 'core'));
  }), true);

// ─────────────────────────────────────────────────────────── C
section('C. 四維屬性：官方 32 點陣列、骰階僅 d6/d8/d10');
// 官方原書在 Techno Fantasy Atlas p.147 把「魂流靈刃」印成 d6/d6/d8/d10（＝30），
// 是**筆誤**：全 81 組中僅此組不成官方 32 點陣列。使用者裁定依技能與武器組合補回
// 靈巧 d6 → d8，成為正典 (10,8,8,6)。詳見 docs/decisions.md §P5。
check('四維總和皆為 32',
  [...new Set(ALL_STARTER_PRESETS.map((p) => p.attributes.dex + p.attributes.ins + p.attributes.mig + p.attributes.wlp))],
  [32]);
check('骰階皆為 6/8/10',
  [...new Set(ALL_STARTER_PRESETS.flatMap((p) => Object.values(p.attributes)))].sort((a, b) => a - b),
  DIE_FACES);
check('屬性鍵固定為 dex/ins/mig/wlp',
  [...new Set(ALL_STARTER_PRESETS.flatMap((p) => Object.keys(p.attributes).sort().join(',')))],
  ['dex,ins,mig,wlp']);
// 官方範本一律使用三種正典陣列之一；這是「筆誤 vs 刻意」的客觀判準
const CANONICAL_SHAPES = ['10,8,8,6', '10,10,6,6', '8,8,8,8'];
const offShape = ALL_STARTER_PRESETS
  .map((p) => {
    const shape = Object.values(p.attributes).sort((a, b) => b - a).join(',');
    return CANONICAL_SHAPES.includes(shape) ? null : `${p.id} → ${shape}`;
  })
  .filter(Boolean);
check('每組都是官方三種正典陣列之一（10/8/8/6、10/10/6/6、8/8/8/8）', offShape, []);
check('魂流靈刃已修正為正典陣列',
  ALL_STARTER_PRESETS.find((p) => p.id === 'tf_soulstream_psyblade').attributes,
  { dex: 8, ins: 6, mig: 8, wlp: 10 });

// ─────────────────────────────────────────────────────────── D
section('D. 職業：必須存在於 rulesData，且等級 = 技能 SL 總和');
const badClass = [];
const badLevel = [];
ALL_STARTER_PRESETS.forEach((p) => {
  p.classes.forEach((c) => {
    if (!rulesData.classes[c.className]) badClass.push(`${p.id} → ${c.className}`);
    const sum = c.skills.reduce((acc, s) => acc + s.sl, 0);
    if (sum !== c.level) badLevel.push(`${p.id} → ${c.className}（宣告 ${c.level}，實得 ${sum}）`);
  });
});
check('全部職業名存在於 rulesData.classes', badClass, []);
check('每個職業的等級 = 技能 SL 總和', badLevel, []);

// 角色等級 5：官方範本全部為 5 級角色 → 技能總點數必為 5
const badTotal = ALL_STARTER_PRESETS
  .map((p) => ({ id: p.id, total: p.classes.reduce((acc, c) => acc + c.level, 0) }))
  .filter((x) => x.total !== 5);
check('每組的總技能點數 = 5（官方 5 級角色）', badTotal, []);

// ─────────────────────────────────────────────────────────── E
section('E. 技能：名稱必須存在於該職業的技能表，SL 不得超過 maxSL');
const badSkill = [];
const badSL = [];
ALL_STARTER_PRESETS.forEach((p) => {
  p.classes.forEach((c) => {
    const def = rulesData.classes[c.className];
    if (!def) return;
    const names = def.skills.map((s) => s.name);
    c.skills.forEach((s) => {
      if (!names.includes(s.name)) badSkill.push(`${p.id} → ${c.className}.${s.name}`);
      const skillDef = def.skills.find((d) => d.name === s.name);
      if (skillDef && s.sl > skillDef.maxSL) badSL.push(`${p.id} → ${c.className}.${s.name} SL${s.sl} > ${skillDef.maxSL}`);
      if (!Number.isInteger(s.sl) || s.sl < 1) badSL.push(`${p.id} → ${c.className}.${s.name} SL 非正整數（${s.sl}）`);
    });
    // 同一職業內不得重複同一技能
    const dup = c.skills.map((s) => s.name).filter((n, i, arr) => arr.indexOf(n) !== i);
    if (dup.length) badSkill.push(`${p.id} → ${c.className} 技能重複：${dup.join('、')}`);
  });
});
check('全部技能名存在於對應職業', badSkill, []);
check('SL 皆為正整數且不超過 maxSL', badSL, []);

// ─────────────────────────────────────────────────────────── F
section('F. 裝備：名稱必須存在於 rulesData.equipment');
const weaponNames = new Set(rulesData.equipment.weapons.map((w) => w.name));
const shieldNames = new Set(rulesData.equipment.shields.map((s) => s.name));
const armorNames = new Set(rulesData.equipment.armors.map((a) => a.name));
const accessoryNames = new Set(rulesData.equipment.accessories.map((a) => a.name));
const badEquip = [];
ALL_STARTER_PRESETS.forEach((p) => {
  const e = p.equipment;
  // 定制武器（HF p.106）不在 rulesData 的武器表裡——它是角色自己鍛造的，
  // 所以主手除了官方武器名，也接受該配置自己帶的定制武器名。
  const ownCustom = new Set((p.customWeapons || []).map((w) => w.name));
  if (!(weaponNames.has(e.mainHand) || ownCustom.has(e.mainHand))) badEquip.push(`${p.id} 主手 ${e.mainHand}`);
  if (!(shieldNames.has(e.offHand) || weaponNames.has(e.offHand))) badEquip.push(`${p.id} 副手 ${e.offHand}`);
  if (!armorNames.has(e.armor)) badEquip.push(`${p.id} 防具 ${e.armor}`);
  if (e.accessory && !accessoryNames.has(e.accessory)) badEquip.push(`${p.id} 飾品 ${e.accessory}`);
});
check('全部裝備名存在於 rulesData.equipment', badEquip, []);

// ─────────────────────────────────────────────────────────── G
section('G. 金手指：僅特典合輯可帶，名稱須逐字對上 rulesData.quirks');
const quirkNames = new Set(rulesData.quirks.map((q) => q.name));
const badQuirk = [];
ALL_STARTER_PRESETS.forEach((p) => {
  if (!p.quirk) return;
  if ((p.sourcebook || 'core') !== 'bonus') badQuirk.push(`${p.id} 非特典卻帶金手指`);
  if (!quirkNames.has(p.quirk)) badQuirk.push(`${p.id} 金手指名不存在：${p.quirk}`);
});
check('金手指名全部存在且僅見於特典合輯', badQuirk, []);
check('特典合輯 8 組全部帶金手指', byBook('bonus').filter((p) => !!p.quirk).length, 8);

// ─────────────────────────────────────────────────────────── H
section('H. 資金：官方皆為 10 的倍數且為正');
check('資金皆為正整數且為 10 的倍數',
  ALL_STARTER_PRESETS.every((p) => Number.isInteger(p.zenit) && p.zenit > 0 && p.zenit % 10 === 0), true);

// ─────────────────────────────────────────────────────────── I
section('I. 預組隊伍：官方共 6 隊，成員數與手冊一致');
const groupCount = {};
ALL_STARTER_PRESETS.forEach((p) => {
  if (!p.group) return;
  groupCount[p.group.id] = (groupCount[p.group.id] || 0) + 1;
});
check('預組隊伍數 = 6', Object.keys(groupCount).length, 6);
check('英雄小隊 4 名', groupCount.hf_company_of_heroes, 4);
check('樂團 4 名', groupCount.hf_the_band, 4);
check('童年好友 4 名', groupCount.nf_childhood_friends, 4);
check('廚房兵團 4 名', groupCount.nf_kitchen_brigade, 4);
check('反抗細胞 3 名', groupCount.tf_rebel_cell, 3);
check('機師們 4 名', groupCount.tf_the_pilots, 4);
check('預組成員共 23 名', Object.values(groupCount).reduce((a, b) => a + b, 0), 23);
check('同一預組的 title 一致',
  new Set(ALL_STARTER_PRESETS.filter((p) => p.group?.id === 'hf_the_band').map((p) => p.group.title)).size, 1);

// ─────────────────────────────────────────────────────────── J
section('J. 護欄：經典搭配只收官方欄位，不得回退成風味文案');
const FLAVOR_KEYS = ['subtitle', 'tagline', 'avatar', 'identity', 'theme', 'origin', 'bonds'];
const flavorLeaks = [];
ALL_STARTER_PRESETS.forEach((p) => {
  FLAVOR_KEYS.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(p, k)) flavorLeaks.push(`${p.id}.${k}`);
  });
});
check('不得含身分／主題／出身／格言／羈絆欄位（使用者 2026-10-05 裁定）', flavorLeaks, []);
check('自訂武器僅作註記字串',
  ALL_STARTER_PRESETS.every((p) => p.customWeapon === undefined || (typeof p.customWeapon === 'string' && p.customWeapon.length > 0)), true);
check('魔晶石是結構化資料，不是說明字串（§CF）',
  ALL_STARTER_PRESETS.every((p) => p.mnemosphere === undefined
    || (typeof p.mnemosphere === 'object'
      && typeof p.mnemosphere.className === 'string'
      && typeof p.mnemosphere.label === 'string'
      && Number.isInteger(p.mnemosphere.level))),
  true);

// 套用之後**真的**拿到那顆魔石。以前 `preset.mnemosphere` 只是一句說明字串
// （`'極性魔晶石（視同元素師 1 級）'`），只被拿來顯示——畫面上寫著他有，角色身上沒有。
const mysticPreset = ALL_STARTER_PRESETS.find((p) => p.id === 'tf_courageous_mystic');
const mysticChar = applyPreset({}, mysticPreset);
check('套用預設後真的多一顆元素師 1 級魔晶石',
  mysticChar.technospheres?.mnemospheres.map((m) => [m.className, m.level]),
  [['元素師', 1]]);
check('再套用一次不會長出第二顆（id 由 preset id 派生，先濾同 id 再 append）',
  applyPreset(mysticChar, mysticPreset).technospheres?.mnemospheres.length, 1);

// ─────────────────────────────────────────────────────────── K
section('K. 篩選與分組（純函式，Modal 與測試共用）');
const all = buildPresetSections(ALL_STARTER_PRESETS);
check('不篩選時全部 83 組都在', all.reduce((a, s) => a + s.items.length, 0), 83);
check('不篩選時切成 83 - 23 + 6 = 66 個區塊（預組收攏）', all.length, 66);
check('第一個區塊是核心單人配置', [all[0].gid, all[0].title, all[0].items.length], [null, null, 1]);

const hfOnly = buildPresetSections(ALL_STARTER_PRESETS, { sourcebook: 'highFantasy' });
check('高度奇幻 18 組', hfOnly.reduce((a, s) => a + s.items.length, 0), 18);
check('高度奇幻切成 10 個人 + 2 隊 = 12 個區塊', hfOnly.length, 12);
check('預組區塊標題正確', hfOnly.filter((s) => s.gid === 'hf_the_band')[0].title, '樂團：這節奏將拯救世界！');
check('預組區塊成員數正確', hfOnly.filter((s) => s.gid === 'hf_the_band')[0].items.length, 4);
check('單人配置不會被誤併（gid 為 null 者各自獨立）',
  hfOnly.filter((s) => s.gid === null).every((s) => s.items.length === 1), true);

check('關鍵字命中角色名（舞巫）', buildPresetSections(ALL_STARTER_PRESETS, { search: '舞巫' }).length, 1);
const idsOf = (sections) => sections.flatMap((s) => s.items.map((p) => p.id));
check('關鍵字命中職業名（舞者）', idsOf(buildPresetSections(ALL_STARTER_PRESETS, { search: '舞者' })),
  ['hf_acrobat', 'hf_dancing_witch', 'hf_fencer', 'hf_goth_diva', 'bc_mellow_gang']);
check('關鍵字命中技能名（混合變形）', idsOf(buildPresetSections(ALL_STARTER_PRESETS, { search: '混合變形' })),
  ['tf_chimeric_hunter', 'tf_cybervampire', 'tf_test_subject']);
check('關鍵字命中英文名（PSYBLADE）',
  buildPresetSections(ALL_STARTER_PRESETS, { search: 'psyblade' }).length, 1);
check('關鍵字命中預組隊名（廚房兵團 → 4 組）',
  buildPresetSections(ALL_STARTER_PRESETS, { search: '廚房兵團' }).reduce((a, s) => a + s.items.length, 0), 4);
check('關鍵字與手冊篩選同時生效（舞者 + 高度奇幻）',
  idsOf(buildPresetSections(ALL_STARTER_PRESETS, { search: '舞者', sourcebook: 'highFantasy' })),
  ['hf_acrobat', 'hf_dancing_witch', 'hf_fencer', 'hf_goth_diva']);
check('查無結果回傳空陣列', buildPresetSections(ALL_STARTER_PRESETS, { search: '不存在的搭配名' }), []);
check('大小寫不敏感（SOULSTREAM）',
  buildPresetSections(ALL_STARTER_PRESETS, { search: 'SOULSTREAM' }).length, 1);
check('前後空白會被修剪',
  buildPresetSections(ALL_STARTER_PRESETS, { search: '  忍者  ' }).reduce((a, s) => a + s.items.length, 0), 1);

// ─────────────────────────────────────────────────────────── L
section('L. 渲染煙霧測試（SSR）：面板真的渲染得出來，且關鍵文案出現在輸出 HTML');
const theme = getCharacterTheme('emerald');
const html = renderToStaticMarkup(
  React.createElement(StarterPresetsPanel, { theme, onApply: () => {} })
);
// 內容斷言用這一份：SSR 沒辦法「點開」，所以直接把全部 id 傳進去讓它一開始就展開。
// 這樣「折疊」不會讓原本的內容覆蓋憑空消失，而是分成兩組斷言各驗各的。
const htmlAll = renderToStaticMarkup(
  React.createElement(StarterPresetsPanel, {
    theme, onApply: () => {}, initialExpandedIds: ALL_STARTER_PRESETS.map((p) => p.id)
  })
);
// 組數由 presets 現算，不寫死——所以斷言也跟著資料走。
check('渲染成功且含規模說明',
  [html.includes('組經典職業搭配'), html.includes(`共 <strong>${ALL_STARTER_PRESETS.length}</strong> 組`)],
  [true, true]);
check('含五本手冊篩選鈕',
  ['全部', '核心', '高度奇幻', '自然奇幻', '科技奇幻', '特典合輯'].every((n) => html.includes(n)), true);
check('含預組隊伍區塊標題', html.includes('樂團：這節奏將拯救世界！'), true);
check('含預組成員數', html.includes('4 名成員'), true);
// 2026-10-06：搭配卡改成**預設收合**（使用者：「全部配置太多了…讓它們更容易掃過這些搭配的名字」），
// 所以配置內容不再出現在預設的 SSR 輸出裡。註記本身改用原始碼確認還在。
check('預設收合：配置內容不出現在預設 HTML 裡',
  [html.includes('習得技能'), html.includes('套用此經典配置'), html.includes('定制武器:')],
  [false, false, false]);
// 收合指示用的是規則一允許的封閉詞彙（△ ▽ ▼ ◆ 那一組）。
check('預設收合：每張卡都有收合指示', html.includes('▽'), true);
// 讀元件原始碼：SSR 沒辦法「點開」折疊區，所以展開後才會出現的內容只能用原始碼確認。
const panelSrc = readFileSync(
  new URL('../src/features/character-sheet/components/StarterPresetsModal.jsx', import.meta.url), 'utf8');
check('註記前綴仍在原始碼裡（展開後會渲染）',
  [panelSrc.includes('定制武器:'), panelSrc.includes('魔晶石:'), panelSrc.includes('金手指:')],
  [true, true, true]);
check('含金手指註記前綴', htmlAll.includes('金手指:'), true);
check('職業只顯示中文（不帶英文名）', htmlAll.includes('舞者 Lv'), true);
check('技能清單的職業前綴亦為純中文', htmlAll.includes('舞者:'), true);
check('不得渲染任何官方英文角色名或職業英文名',
  ALL_STARTER_PRESETS.map((p) => p.en).filter((en) => htmlAll.includes(en)), []);
check('不得出現「中文 · ENGLISH」並列格式', htmlAll.includes(' · '), false);
check('擴充職業圖示槽位有渲染', htmlAll.includes('Lv3'), true);
check('渲染輸出不含 undefined（無漏欄位）', htmlAll.includes('undefined'), false);
check('渲染輸出不含風味欄位殘留文案', htmlAll.includes('tagline') || htmlAll.includes('identity'), false);

// ─────────────────────────────────────────────────────────── M
section('M. 技能子選擇（套用時連咒語一起選好）');
const schoolSpells = (school) => rulesData.spells.filter((s) => s.school === school).map((s) => s.name);
const OPTION_POOL = {
  '元素魔法': schoolSpells('元素'),
  '靈魂魔法': schoolSpells('靈魂'),
  '熵系魔法': schoolSpells('熵系'),
  '起舞': DANCER_DANCES.map((d) => d.name),
  '心靈天賦': ESPER_GIFTS.map((g) => g.name),
  '混合變形': MUTANT_THERIOFORMS.map((f) => f.name),
  '植生術': FLORIST_MAGISEEDS.map((s) => s.name),
  '徽記學': SYMBOLIST_SYMBOLS.map((s) => s.name)
};
const CHANTER_KEYS = CHANTER_DATA.keys.map((k) => k.name);
const CHANTER_TONES = CHANTER_DATA.tones.map((t) => t.name);

const subErrors = [];
const missingSub = [];
let withSub = 0;
ALL_STARTER_PRESETS.forEach((p) => {
  p.classes.forEach((c) => {
    c.skills.forEach((sk) => {
      const cfg = getSkillSuboptionConfig(c.className, sk.name);
      const where = `${p.id} → ${c.className}.${sk.name}`;

      if (sk.selectedOptions === undefined) {
        if (cfg) missingSub.push(where);
        return;
      }
      withSub += 1;
      if (!cfg) {
        subErrors.push(`${where}：該技能沒有子選項配置`);
        return;
      }
      const max = calculateSkillSuboptionMax(c.className, sk.name, sk.sl);

      if (sk.name === '魔法演奏') {
        if (Array.isArray(sk.selectedOptions) || typeof sk.selectedOptions !== 'object') {
          subErrors.push(`${where}：魔奏者應為 { keys, tones } 物件`);
          return;
        }
        const keys = sk.selectedOptions.keys || [];
        const tones = sk.selectedOptions.tones || [];
        keys.forEach((k) => { if (!CHANTER_KEYS.includes(k)) subErrors.push(`${where}：音調不存在「${k}」`); });
        tones.forEach((t) => { if (!CHANTER_TONES.includes(t)) subErrors.push(`${where}：曲風不存在「${t}」`); });
        if (keys.length === 0) subErrors.push(`${where}：至少需 1 項音調`);
        if (tones.length === 0) subErrors.push(`${where}：至少需 1 項曲風`);
        if (keys.length + tones.length > max) subErrors.push(`${where}：選了 ${keys.length + tones.length} 項，超過上限 ${max}`);
        if (new Set([...keys, ...tones]).size !== keys.length + tones.length) subErrors.push(`${where}：音調／曲風重複`);
        return;
      }

      if (!Array.isArray(sk.selectedOptions)) {
        subErrors.push(`${where}：應為名稱陣列`);
        return;
      }
      const pool = OPTION_POOL[sk.name] || [];
      sk.selectedOptions.forEach((n) => {
        if (!pool.includes(n)) subErrors.push(`${where}：選項不存在「${n}」`);
      });
      if (sk.selectedOptions.length > max) subErrors.push(`${where}：選了 ${sk.selectedOptions.length} 項，超過上限 ${max}`);
      if (sk.selectedOptions.length === 0) subErrors.push(`${where}：空陣列`);
      if (new Set(sk.selectedOptions).size !== sk.selectedOptions.length) subErrors.push(`${where}：選項重複`);
    });
  });
});
check('子選擇全部合法（名稱存在於資料庫、數量未超上限、無重複）', subErrors, []);
check('凡有子選項配置的技能都必須帶 selectedOptions', missingSub, []);
// 2026-10-06：59 -> 60（新加的 TRICKSTER 有熵系魔法的咒語子選項）。
check('帶子選擇的技能數 = 60', withSub, 60);

// 抽樣核對官方原文（HF p.132 / TF p.147 / Bonus p.24）
const findSkill = (pid, skill) => ALL_STARTER_PRESETS
  .find((p) => p.id === pid).classes
  .flatMap((c) => c.skills).find((s) => s.name === skill);
check('雜技師：舞步 SL2 = 鳳凰、銜尾蛇', findSkill('hf_acrobat', '起舞').selectedOptions, ['鳳凰', '銜尾蛇']);
check('偶像：魔法演奏 SL3 = 熾熱 ＋ 冷靜／生動／莊嚴',
  findSkill('hf_idol', '魔法演奏').selectedOptions, { keys: ['熾熱'], tones: ['冷靜', '生動', '莊嚴'] });
check('年少賢者：元素魔法 SL3 = 電流術、冰川覆裂、伊格尼斯之火',
  findSkill('hf_young_sage', '元素魔法').selectedOptions, ['電流術', '冰川覆裂', '伊格尼斯之火']);
check('嵌合獵人：混合變形 SL3 = 追獵、放電、毒物',
  findSkill('tf_chimeric_hunter', '混合變形').selectedOptions, ['追獵形態', '放電形態', '毒物形態']);
check('賢者：元素魔法 SL3（Core p.174）',
  findSkill('sage', '元素魔法').selectedOptions, ['電流術', '冰川覆裂', '伊格尼斯之火']);
check('沼澤女巫：元素魔法 = 冰凍堡壘（Bonus p.24）',
  findSkill('bc_bog_witch', '元素魔法').selectedOptions, ['冰凍堡壘']);

// ─────────────────────────────────────────────────────────── N
section('N. 職業子系統（小工具／阿爾卡納／個人載具）');
const arcanaIds = RULE_CODEX.arcana.catalog.map((a) => a.id);
const frameIds = PILOT_FRAMES.map((f) => f.id);
const sysErrors = [];
let gadgetCount = 0;
let arcanaCount = 0;
let vehicleCount = 0;
ALL_STARTER_PRESETS.forEach((p) => {
  const classOf = (n) => p.classes.find((c) => c.className === n);
  const skillOf = (cls, sk) => classOf(cls)?.skills.find((s) => s.name === sk);

  if (p.gadgets) {
    gadgetCount += 1;
    const gadgetSkill = skillOf('修補匠', '小工具');
    if (!gadgetSkill) { sysErrors.push(`${p.id}：帶 gadgets 卻沒有修補匠【小工具】`); }
    ['alchemy', 'infusion', 'magitech'].forEach((k) => {
      const v = p.gadgets[k];
      if (!Number.isInteger(v) || v < 0 || v > 3) sysErrors.push(`${p.id}：gadgets.${k} = ${v}`);
    });
    const tierSum = p.gadgets.alchemy + p.gadgets.infusion + p.gadgets.magitech;
    if (gadgetSkill && tierSum !== gadgetSkill.sl) sysErrors.push(`${p.id}：小工具階級總和 ${tierSum} != SL ${gadgetSkill.sl}`);
    const spellNames = new Set(rulesData.spells.map((s) => s.name));
    (p.gadgets.magitechSpells || []).forEach((n) => {
      if (!spellNames.has(n)) sysErrors.push(`${p.id}：魔法球咒語不存在「${n}」`);
    });
    if ((p.gadgets.magitechSpells || []).length > 0 && p.gadgets.magitech < 3) {
      sysErrors.push(`${p.id}：未達魔導科技最高檔卻帶魔法球咒語`);
    }
  }

  if (p.arcana) {
    arcanaCount += 1;
    const bindSkill = skillOf('秘儀師', '綁定和召喚');
    if (!bindSkill) sysErrors.push(`${p.id}：帶 arcana 卻沒有秘儀師【綁定和召喚】`);
    p.arcana.forEach((id) => { if (!arcanaIds.includes(id)) sysErrors.push(`${p.id}：阿爾卡納 id 不存在「${id}」`); });
    if (new Set(p.arcana).size !== p.arcana.length) sysErrors.push(`${p.id}：阿爾卡納重複`);
    if (bindSkill && p.arcana.length > bindSkill.sl) sysErrors.push(`${p.id}：綁定數量 ${p.arcana.length} 超過 SL ${bindSkill.sl}`);
  }

  if (p.vehicle) {
    vehicleCount += 1;
    const vehicleSkill = skillOf('機師', '個人載具');
    if (!vehicleSkill) sysErrors.push(`${p.id}：帶 vehicle 卻沒有機師【個人載具】`);
    if (!frameIds.includes(p.vehicle.frameId)) sysErrors.push(`${p.id}：框架不存在「${p.vehicle.frameId}」`);
    p.vehicle.modules.forEach((id) => { if (!findModuleById(id)) sysErrors.push(`${p.id}：模組不存在「${id}」`); });
    if (new Set(p.vehicle.modules).size !== p.vehicle.modules.length) sysErrors.push(`${p.id}：模組重複`);
    if (vehicleSkill) {
      const quota = getUnlockedModuleQuota(vehicleSkill.sl);
      if (p.vehicle.modules.length > quota) sysErrors.push(`${p.id}：已掌握模組 ${p.vehicle.modules.length} 超過上限 ${quota}`);
    }
  }
});
check('小工具／阿爾卡納／載具設定全部合法', sysErrors, []);
check('帶小工具的配置 = 7 組', gadgetCount, 7);
check('帶阿爾卡納的配置 = 4 組', arcanaCount, 4);
check('帶載具的配置 = 7 組', vehicleCount, 7);
check('小工具階級總和 = SL（官方每級一階）', ALL_STARTER_PRESETS
  .filter((p) => p.gadgets)
  .map((p) => p.gadgets.alchemy + p.gadgets.infusion + p.gadgets.magitech), [1, 2, 3, 1, 1, 1, 1]);

// ─────────────────────────────────────────────────────────── O
section('O. 套用邏輯（純函式）：官方欄位覆寫、玩家欄位保留');
const baseChar = createNewCharacter({
  name: '自訂名字',
  identity: '自訂身分',
  theme: '希望',
  origin: '自訂出身',
  bonds: [{ target: '自訂羈絆', feelings: ['trust'] }]
});
const presetOf = (id) => ALL_STARTER_PRESETS.find((p) => p.id === id);

const appliedWalpurgis = applyPreset(baseChar, presetOf('tf_m005_walpurgis'));
check('覆寫名稱／四維／資金',
  [appliedWalpurgis.name, appliedWalpurgis.attributes.dex, appliedWalpurgis.zenit],
  ['M005：瓦普吉斯', 8, 70]);
check('不覆寫玩家自填的身分／主題／出身／羈絆',
  [appliedWalpurgis.identity, appliedWalpurgis.theme, appliedWalpurgis.origin, appliedWalpurgis.bonds.length],
  ['自訂身分', '希望', '自訂出身', 1]);
check('sourcebook 併入 enabledSourcebooks',
  appliedWalpurgis.enabledSourcebooks.includes('technoFantasy'), true);
check('技能子選擇一併帶入',
  appliedWalpurgis.classes.flatMap((c) => c.skills).find((s) => s.name === '熵系魔法').selectedOptions,
  ['加速', '半影']);
check('載具寫入框架與已掌握模組',
  [appliedWalpurgis.pilotVehicle.frameId, appliedWalpurgis.pilotVehicle.unlockedModules.length, appliedWalpurgis.pilotVehicle.activeModules.length],
  ['mecha', 5, 0]);

const appliedSummoner = applyPreset(baseChar, presetOf('summoner'));
check('阿爾卡納寫入 boundArcana', appliedSummoner.arcanistData.boundArcana, ['grimoire']);
check('阿爾卡納不影響既有欄位（activeSummonId 為 null）', appliedSummoner.arcanistData.activeSummonId, null);

const appliedAlchemist = applyPreset(baseChar, presetOf('alchemist'));
check('小工具寫入 gadgets', appliedAlchemist.tinkererData.gadgets.alchemy, 1);
check('小工具未使用欄位歸零',
  [appliedAlchemist.tinkererData.gadgets.infusion, appliedAlchemist.tinkererData.gadgets.magitech],
  [0, 0]);

const appliedZombie = applyPreset(baseChar, presetOf('bc_zombie_maid'));
check('金手指寫入 quirk', appliedZombie.quirk, '亡者歸來');

check('原角色不被修改（純函式）',
  [baseChar.classes.length, baseChar.name, baseChar.zenit],
  [0, '自訂名字', baseChar.zenit]);
check('回傳物件與 preset 不共用參照（深拷貝）', (() => {
  const p = presetOf('hf_young_sage');
  const before = p.classes[0].skills[0].selectedOptions.length;
  const applied = applyPreset(baseChar, p);
  applied.classes[0].skills[0].selectedOptions.push('汙染');
  return [p.classes[0].skills[0].selectedOptions.length, before];
})(), [3, 3]);

check('全部 81 組都能套用且不拋錯', ALL_STARTER_PRESETS
  .filter((p) => {
    try { applyPreset(baseChar, p); return false; } catch { return true; }
  }), []);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
