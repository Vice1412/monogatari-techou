/**
 * 底力技（ZERO POWERS）護欄 —— 高度奇幻手冊 p.124–131 的選用規則。
 *
 * 執行：`npm run test:zeropower`
 *
 * 官方依據：*Fabula Ultima — Atlas: High Fantasy*，印刷 p.124–131（此書 PDF 偏移 +2）。
 * 定譯與 CHM 比對見 `docs/zero-powers-hf.md`；規則原文的兩處內部矛盾與四處歧義裁定見該文 §3。
 *
 * ## 這道關卡守的是「一條選用規則在五個層面同時生效」
 *
 *   ① 開卡規則開關（`creationRules.zeroPowers`，預設 false）
 *   ② 角色資料（`character.zeroPower`，舊存檔沒有 → 收斂成空狀態，行為不變）
 *   ③ 命刻計算（6 格／合體之力 4 格、填充夾制、施展清空）
 *   ④ 團隊約束**已移除**（2026-10-21 使用者裁定：交給 GM 審卡，不是開卡硬規定）
 *   ⑤ 介面入口（規則關閉時**整個區塊不存在**，不是停用）
 *   ⑥ 看得懂（七個觸發／十一個效果可點開看全文；選齊後最下面有完整卡片）
 *
 * 任何一處漏掉，畫面看起來都正常——這正是要把它們釘死的原因
 * （同 `tests/initiativeVariant.test.mjs` 檔頭的理由）。
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ZERO_TRIGGERS,
  ZERO_EFFECTS,
  ZERO_VARIANTS,
  ZERO_NAME_ACTIONS,
  ZERO_NAME_ORIGINS,
  ZERO_DAMAGE_TYPES,
  ZERO_STATUS_EFFECTS,
  ZERO_CLOCK_SECTIONS,
  ZERO_CLOCK_SECTIONS_COMBINED,
  ZERO_POWER_FIELD,
  ZERO_POWER_SOURCE,
  ZERO_POWER_NOTES,
  generateZeroPowerName,
  zeroNameTableGroups,
  isZeroPowersEnabled,
  createZeroPowerState,
  normalizeZeroPower,
  zeroTriggerById,
  zeroEffectById
} from '../src/features/character-sheet/data/zeroPowers.js';
import {
  zeroClockMax,
  fillZeroClock,
  clearZeroClock,
  isZeroClockFull,
  zeroTriggerFill,
  zeroChoiceRequirement,
  isZeroChoiceComplete,
  canUnleashZeroPower,
  unleashZeroPower,
  awakenZeroPower,
  zeroActiveEffectId,
  zeroPairFor,
  describeZeroPower,
  zeroPowerIssues,
  ZERO_CHANCE_TIERS,
  zeroChanceTier,
  zeroChancePreviousTier,
  zeroChanceOptions
} from '../src/features/character-sheet/utils/zeroPower.js';
/** 整個模組的命名空間——用來驗「某些函式**不存在**」（團隊約束已移除，見 §H）。 */
import * as zeroPowerUtils from '../src/features/character-sheet/utils/zeroPower.js';
import {
  DEFAULT_CREATION_RULES,
  CREATION_RULE_FIELDS,
  resolveCreationRules
} from '../src/features/character-sheet/data/creationRules.js';
import {
  createNewCharacter,
  validateCharacter
} from '../src/features/character-sheet/utils/characterEngine.js';
import ZeroPowerBlock from '../src/features/character-sheet/components/ZeroPowerBlock.jsx';
import { ZeroPowerNameTablesBody } from '../src/features/character-sheet/components/ZeroPowerNameTablesModal.jsx';
import {
  ZeroPowerGlossaryBody,
  zeroTriggerFillLabel,
  GLOSSARY_TAB_TRIGGER,
  GLOSSARY_TAB_EFFECT
} from '../src/features/character-sheet/components/ZeroPowerGlossaryModal.jsx';
import { getCharacterTheme } from '../src/features/character-sheet/utils/characterThemes.js';

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

/** SSR 標記 → 純文字（去掉 React 的文字節點註解與標籤） */
const plain = (html) => String(html)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]*>/g, '');

const READ = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
const theme = getCharacterTheme('parchment');

// ─────────────────────────────────────────────────────────── A
section('A. 觸發（p.125，七個）');

check('觸發數量為 7', ZERO_TRIGGERS.length, 7);
check('觸發 id 唯一', new Set(ZERO_TRIGGERS.map((t) => t.id)).size, 7);
check('觸發名稱', ZERO_TRIGGERS.map((t) => t.name), ['憐憫', '挑戰', '愛', '復仇', '連續', '戰略', '協同']);
check('固定填充量（協同為變動）', ZERO_TRIGGERS.map((t) => t.fill), [1, 1, 1, 3, 2, 1, 'varies']);
check('只有【愛】需要綁定角色', ZERO_TRIGGERS.filter((t) => t.special === 'bindToPc').map((t) => t.id), ['love']);
check('每個觸發都有說明文字', ZERO_TRIGGERS.every((t) => typeof t.desc === 'string' && t.desc.length > 20), true);
check('每個觸發都有英文檢索名', ZERO_TRIGGERS.every((t) => typeof t.en === 'string' && t.en.length > 2), true);
check('zeroTriggerById 取得憐憫', zeroTriggerById('compassion').name, '憐憫');
check('zeroTriggerById 對未知 id 回 null', zeroTriggerById('nope'), null);

check('協同依弱點目標數計算', zeroTriggerFill('synergy', { weakTargets: 3 }), 3);
check('協同沒有弱點目標時為 0', zeroTriggerFill('synergy'), 0);
check('協同的負數收斂為 0', zeroTriggerFill('synergy', { weakTargets: -2 }), 0);
check('復仇固定 3 格', zeroTriggerFill('revenge'), 3);
check('連續固定 2 格', zeroTriggerFill('sequence'), 2);
check('未知觸發填充 0 格', zeroTriggerFill('nope'), 0);

// ─────────────────────────────────────────────────────────── B
section('B. 效果（p.126–127，十一個）');

check('效果數量為 11', ZERO_EFFECTS.length, 11);
check('效果 id 唯一', new Set(ZERO_EFFECTS.map((e) => e.id)).size, 11);
check('效果名稱', ZERO_EFFECTS.map((e) => e.name), [
  '零之疾襲', '零之機運', '零之成本', '零之元素', '零之極限', '零之魔法',
  '零之目標', '零之救濟', '零之天災', '零之盾', '零之三角'
]);
check('每個效果都有說明文字', ZERO_EFFECTS.every((e) => typeof e.desc === 'string' && e.desc.length > 30), true);
check('每個效果都有 CHM 舊名可檢索', ZERO_EFFECTS.every((e) => Array.isArray(e.alias) && e.alias.length > 0), true);
check(
  '需要額外選擇的四種效果',
  ZERO_EFFECTS.filter((e) => e.choice).map((e) => [e.id, e.choice]),
  [['chance', 'oddOrEven'], ['elements', 'damagePair'], ['objective', 'fillOrErase'], ['scourge', 'damagePlusStatuses']]
);
check('zeroEffectById 取得零之盾', zeroEffectById('shield').name, '零之盾');
check('zeroEffectById 對未知 id 回 null', zeroEffectById('nope'), null);

check('傷害類型八種且不含物理', ZERO_DAMAGE_TYPES, ['風', '電', '暗', '土', '火', '冰', '光', '毒']);
check('零之天災可選四種狀態', ZERO_STATUS_EFFECTS, ['眩暈', '動搖', '緩慢', '虛弱']);
check('效果選擇需求的查詢入口', zeroChoiceRequirement('elements'), 'damagePair');
check('不需要選擇的效果回 null', zeroChoiceRequirement('blitz'), null);

// ─────────────────────────────────────────────────────────── C
section('C. 命名表（p.128–129，CHM 未收錄）');

check('動作表三欄', ZERO_NAME_ACTIONS.columns.length, 3);
check('動作表 1d20 → 20 列', ZERO_NAME_ACTIONS.rows.length, 20);
check('動作表每列三格', ZERO_NAME_ACTIONS.rows.every((r) => r.length === 3), true);
check('動作表每欄無重複', ZERO_NAME_ACTIONS.columns.map((_, c) => new Set(ZERO_NAME_ACTIONS.rows.map((r) => r[c])).size), [20, 20, 20]);
check('由來表六欄', ZERO_NAME_ORIGINS.columns.length, 6);
check('由來表 1d10 → 10 列', ZERO_NAME_ORIGINS.rows.length, 10);
check('由來表每列六格', ZERO_NAME_ORIGINS.rows.every((r) => r.length === 6), true);
check('由來表每欄無重複', ZERO_NAME_ORIGINS.columns.map((_, c) => new Set(ZERO_NAME_ORIGINS.rows.map((r) => r[c])).size), [10, 10, 10, 10, 10, 10]);
check('兩張表共 120 個詞', ZERO_NAME_ACTIONS.rows.length * 3 + ZERO_NAME_ORIGINS.rows.length * 6, 120);
check('沒有空格子', [...ZERO_NAME_ACTIONS.rows.flat(), ...ZERO_NAME_ORIGINS.rows.flat()].every((w) => typeof w === 'string' && w.trim().length > 0), true);

check('名詞性由來補「之」', generateZeroPowerName({ actionRoll: 1, actionColumn: 0, originRoll: 1, originColumn: 0 }), {
  action: '咬噬', origin: '迅捷', name: '迅捷之咬噬'
});
check('形容詞性由來直接串接', generateZeroPowerName({ actionRoll: 2, actionColumn: 0, originRoll: 9, originColumn: 0 }), {
  action: '刃', origin: '王家的', name: '王家的刃'
});
check('野獸欄取名', generateZeroPowerName({ actionRoll: 9, actionColumn: 0, originRoll: 10, originColumn: 1 }), {
  action: '獠牙', origin: '狼', name: '狼之獠牙'
});
check('可反轉語序', generateZeroPowerName({ actionRoll: 2, actionColumn: 0, originRoll: 9, originColumn: 0, reversed: true }).name, '刃·王家的');
check('骰值超界夾到最後一列', generateZeroPowerName({ actionRoll: 99, actionColumn: 99, originRoll: 99, originColumn: 99 }), {
  action: '法輪', origin: '緋紅', name: '緋紅之法輪'
});
check('骰值 0 夾到第一列', generateZeroPowerName({ actionRoll: 0, actionColumn: 0, originRoll: 0, originColumn: 0 }).name, '迅捷之咬噬');
check('無參數時取第一格', generateZeroPowerName().name, '迅捷之咬噬');

// ─────────────────────────────────────────────────────────── D
section('D. 底力命刻（6 格／合體 4 格）');

check('標準刻度數', ZERO_CLOCK_SECTIONS, 6);
check('合體之力刻度數', ZERO_CLOCK_SECTIONS_COMBINED, 4);
check('預設上限 6', zeroClockMax(createZeroPowerState()), 6);
check('合體之力上限 4', zeroClockMax({ ...createZeroPowerState(), variant: 'combined' }), 4);
check('舊存檔 undefined 不炸', zeroClockMax(undefined), 6);

const empty = createZeroPowerState();
check('空命刻', empty.clock, 0);
check('填充 1 格', fillZeroClock(empty, 1).clock, 1);
check('填充夾制在上限', fillZeroClock({ ...empty, clock: 5 }, 3).clock, 6);
check('合體之力夾制在 4', fillZeroClock({ ...empty, clock: 3, variant: 'combined' }, 3).clock, 4);
check('負數填充不動', fillZeroClock({ ...empty, clock: 2 }, -5).clock, 2);
check('填充不改原物件', empty.clock, 0);
check('清空歸零', clearZeroClock({ ...empty, clock: 6 }).clock, 0);
check('未滿判定', isZeroClockFull({ ...empty, clock: 5 }), false);
check('全滿判定', isZeroClockFull({ ...empty, clock: 6 }), true);
check('合體之力 4 格即滿', isZeroClockFull({ ...empty, clock: 4, variant: 'combined' }), true);
check('合體之力 4 格在標準規則下未滿', isZeroClockFull({ ...empty, clock: 4 }), false);

// ─────────────────────────────────────────────────────────── E
section('E. 零之機運的檔位（原文「上一行」＝較弱的一檔）');

check('四個檔位', ZERO_CHANCE_TIERS.map((t) => t.id), ['none', 'one', 'two', 'three']);
check('零顆', zeroChanceTier(0).id, 'none');
check('兩顆', zeroChanceTier(2).id, 'two');
check('超界夾到三顆', zeroChanceTier(9).id, 'three');
check('負數夾到零顆', zeroChanceTier(-1).id, 'none');
check('三顆的上一行是兩顆', zeroChancePreviousTier('three').id, 'two');
check('兩顆的上一行是一顆', zeroChancePreviousTier('two').id, 'one');
check('一顆的上一行是零顆', zeroChancePreviousTier('one').id, 'none');
check('零顆沒有上一行', zeroChancePreviousTier('none'), null);
check('三顆給兩個選項（對應＋較弱）', zeroChanceOptions(3).map((t) => t.id), ['three', 'two']);
check('零顆只給一個選項', zeroChanceOptions(0).map((t) => t.id), ['none']);

// ─────────────────────────────────────────────────────────── F
section('F. 施展的前置條件');

const ready = {
  ...createZeroPowerState(),
  triggerId: 'revenge',
  effectId: 'blitz',
  clock: 6
};
check('條件齊備可施展', canUnleashZeroPower(ready).ok, true);
check('未選觸發', canUnleashZeroPower({ ...ready, triggerId: '' }).reason, '尚未選擇底力觸發');
check('未選效果', canUnleashZeroPower({ ...ready, effectId: '' }).reason, '尚未選擇底力效果');
check('命刻未滿', canUnleashZeroPower({ ...ready, clock: 5 }).ok, false);
check('命刻未滿寫出格數', canUnleashZeroPower({ ...ready, clock: 5 }).reason, '底力命刻尚未全滿（5／6）');
check('非衝突場景', canUnleashZeroPower(ready, { inConflict: false }).reason, '底力效果只能在衝突場景中施展');
check('本回合已施展', canUnleashZeroPower(ready, { alreadyUnleashedThisTurn: true }).reason, '每回合只能施展一次');
check('覺醒之力未覺醒', canUnleashZeroPower({ ...ready, variant: 'awakened' }).ok, false);
check('覺醒之力已覺醒', canUnleashZeroPower({ ...ready, variant: 'awakened', awakened: true }).ok, true);
check(
  '零之元素選擇未完成',
  canUnleashZeroPower({ ...ready, effectId: 'elements' }).reason,
  '效果的必要選擇尚未完成'
);
check(
  '零之元素選滿兩種即可',
  canUnleashZeroPower({ ...ready, effectId: 'elements', choices: { ...ready.choices, damagePair: ['火', '冰'] } }).ok,
  true
);
check(
  '零之天災只選屬性不算完成',
  canUnleashZeroPower({ ...ready, effectId: 'scourge', choices: { ...ready.choices, damageType: '暗' } }).ok,
  false
);
check(
  '零之天災選滿 1 屬性 2 狀態即可',
  canUnleashZeroPower({
    ...ready,
    effectId: 'scourge',
    choices: { ...ready.choices, damageType: '暗', statuses: ['眩暈', '緩慢'] }
  }).ok,
  true
);

check('選擇完整性：不需選擇的效果', isZeroChoiceComplete({ ...ready, effectId: 'shield' }), true);
check('選擇完整性：機運不要求在建立時固定奇偶', isZeroChoiceComplete({ ...ready, effectId: 'chance' }), true);
check('選擇完整性：目標不要求在建立時固定填充或清空', isZeroChoiceComplete({ ...ready, effectId: 'objective' }), true);

const unleashed = unleashZeroPower(ready);
check('施展成功', unleashed.ok, true);
check('施展清空命刻', unleashed.state.clock, 0);
check('施展訊息含效果名與觸發名', unleashed.message, '施展【零之疾襲】（觸發：復仇），底力命刻已清空');
const refused = unleashZeroPower({ ...ready, clock: 2 });
check('條件不足時施展失敗', refused.ok, false);
check('條件不足時命刻不變', refused.state.clock, 2);

// ─────────────────────────────────────────────────────────── G
section('G. 資料正規化（舊存檔與壞資料）');

check('undefined → 空狀態', normalizeZeroPower(undefined), createZeroPowerState());
check('null → 空狀態', normalizeZeroPower(null), createZeroPowerState());
check('陣列 → 空狀態', normalizeZeroPower([1, 2]), createZeroPowerState());
check('字串 → 空狀態', normalizeZeroPower('nope'), createZeroPowerState());
check('未知觸發 id 被剔除', normalizeZeroPower({ triggerId: 'nope' }).triggerId, '');
check('未知效果 id 被剔除', normalizeZeroPower({ effectId: 'nope' }).effectId, '');
check('合法 id 保留', normalizeZeroPower({ triggerId: 'love', effectId: 'magic' }).effectId, 'magic');
check('命刻字串轉數字', normalizeZeroPower({ clock: '3' }).clock, 3);
check('命刻超界夾制', normalizeZeroPower({ clock: 99 }).clock, 6);
check('合體之力命刻夾制在 4', normalizeZeroPower({ clock: 99, variant: 'combined' }).clock, 4);
check('命刻負數歸零', normalizeZeroPower({ clock: -3 }).clock, 0);
check('非數字命刻歸零', normalizeZeroPower({ clock: 'abc' }).clock, 0);
check('非法變體被剔除', normalizeZeroPower({ variant: 'nope' }).variant, '');
check('合法變體保留', normalizeZeroPower({ variant: 'combined' }).variant, 'combined');
check('非法傷害類型被濾掉', normalizeZeroPower({ choices: { damageType: 'bolt' } }).choices.damageType, '');
check('合法傷害類型保留', normalizeZeroPower({ choices: { damageType: '電' } }).choices.damageType, '電');
check('元素對只留合法值且最多兩個', normalizeZeroPower({ choices: { damagePair: ['火', 'bolt', '冰', '光'] } }).choices.damagePair, ['火', '冰']);
check('狀態只留合法值且最多兩個', normalizeZeroPower({ choices: { statuses: ['眩暈', '中毒', '虛弱'] } }).choices.statuses, ['眩暈', '虛弱']);
check('choices 是陣列時收斂成空', normalizeZeroPower({ choices: [] }).choices.damageType, '');
check('awakened 只認 true', normalizeZeroPower({ awakened: 'true' }).awakened, false);
check('name 非字串時歸零', normalizeZeroPower({ name: 42 }).name, '');
check('未知欄位不外洩', Object.keys(normalizeZeroPower({ evil: 1 })), Object.keys(createZeroPowerState()));

// ─────────────────────────────────────────────────────────── H
section('H. 團隊約束已移除（交給 GM 審卡，不是開卡硬規定）');

/*
 * 使用者裁定（2026-10-21）：「團隊約束不需要，這個工作交給 GM 來審卡，
 * 而非開卡時的硬性規定。」
 *
 * 所以這一節的斷言方向**整個反過來**：不再驗「有沒有抓到重複」，
 * 而是驗「這一層根本不存在」——模組不匯出跨角色檢查，角色層的驗證也不報團隊問題。
 * 留著一個沒有消費者的重複檢查函式，就是 §U 說的「幻覺欄位」：
 * 看起來有把關，其實沒人呼叫。介面層（不灰、不鎖）見 §Q。
 */
check('工具層不再提供跨角色重複檢查', typeof zeroPowerUtils.findDuplicateZeroPowers, 'undefined');
check('工具層不再提供佔用查詢', typeof zeroPowerUtils.zeroPowerTakenBy, 'undefined');

const roster = [
  { id: 'pc1', name: '阿爾', zeroPower: { triggerId: 'revenge', effectId: 'blitz' } },
  { id: 'pc2', name: '貝菈', zeroPower: { triggerId: 'revenge', effectId: 'shield' } },
  { id: 'pc3', name: '席恩', zeroPower: { triggerId: 'love', effectId: 'shield' } }
];
check('同一個觸發可以被兩個角色同時選中', normalizeZeroPower(roster[1].zeroPower).triggerId, 'revenge');
check('同一個效果也可以被兩個角色同時選中', normalizeZeroPower(roster[2].zeroPower).effectId, 'shield');
check(
  '撞了觸發的角色自己仍然通過驗證（缺的只有愛的綁定）',
  zeroPowerIssues(roster[1].zeroPower).map((i) => i.field),
  []
);
check(
  '角色層驗證不產生任何團隊級訊息',
  zeroPowerIssues(roster[2].zeroPower).some((i) => i.message.includes('隊友') || i.message.includes('重複')),
  false
);

// ─────────────────────────────────────────────────────────── I
section('I. 開卡規則欄位');

check('欄位集含 zeroPowers', CREATION_RULE_FIELDS.includes(ZERO_POWER_FIELD), true);
check('預設關閉', DEFAULT_CREATION_RULES.zeroPowers, false);
check('resolve 保留 true', resolveCreationRules({ zeroPowers: true }).zeroPowers, true);
check('resolve 保留 false', resolveCreationRules({ zeroPowers: false }).zeroPowers, false);
check('resolve 對非布林退回預設', resolveCreationRules({ zeroPowers: 'true' }).zeroPowers, false);
check('resolve 對 undefined 退回預設', resolveCreationRules({}).zeroPowers, false);
check('resolve 對壞輸入退回預設', resolveCreationRules(null).zeroPowers, false);

check('角色物件判定：開啟', isZeroPowersEnabled({ creationRules: { zeroPowers: true } }), true);
check('角色物件判定：關閉', isZeroPowersEnabled({ creationRules: { zeroPowers: false } }), false);
check('角色物件判定：缺欄位', isZeroPowersEnabled({ creationRules: {} }), false);
check('規則物件判定：開啟', isZeroPowersEnabled({ zeroPowers: true }), true);
check('字串 true 不算開啟', isZeroPowersEnabled({ zeroPowers: 'true' }), false);
check('null 不算開啟', isZeroPowersEnabled(null), false);

// ─────────────────────────────────────────────────────────── J
section('J. 引擎整合（新角色與驗證）');

const fresh = createNewCharacter();
check('新角色有 zeroPower 欄位', Boolean(fresh.zeroPower), true);
check('新角色底力技為空狀態', fresh.zeroPower, createZeroPowerState());
check('新角色不預選觸發', fresh.zeroPower.triggerId, '');
check('新角色不預選效果', fresh.zeroPower.effectId, '');

const offRules = resolveCreationRules({});
const onRules = resolveCreationRules({ zeroPowers: true });
const blankZero = (rules) => ({ ...createNewCharacter({}, rules), creationRules: rules });

check(
  '規則關閉時不產生底力技警告',
  validateCharacter(blankZero(offRules)).warnings.filter((w) => w.field === 'triggerId' || w.field === 'effectId'),
  []
);
const onWarnings = validateCharacter(blankZero(onRules)).warnings.filter((w) => w.field === 'triggerId' || w.field === 'effectId');
check('規則開啟時提醒未選觸發與效果', onWarnings.length, 2);
check('底力技警告掛在第 5 步', onWarnings.every((w) => w.step === 5), true);

const loveNoTarget = {
  ...blankZero(onRules),
  zeroPower: { ...createZeroPowerState(), triggerId: 'love', effectId: 'blitz' }
};
check(
  '【愛】未綁定角色時提出警告',
  validateCharacter(loveNoTarget).warnings.filter((w) => w.field === 'loveTargetId').length,
  1
);

const scourgeIncomplete = {
  ...blankZero(onRules),
  zeroPower: { ...createZeroPowerState(), triggerId: 'revenge', effectId: 'scourge' }
};
check(
  '【零之天災】未選屬性與狀態時兩條警告',
  validateCharacter(scourgeIncomplete).warnings.filter((w) => w.field === 'choices').length,
  2
);

const complete = {
  ...blankZero(onRules),
  zeroPower: {
    ...createZeroPowerState(),
    triggerId: 'revenge',
    effectId: 'elements',
    choices: { damagePair: ['火', '光'], damageType: '', statuses: [] }
  }
};
check(
  '設定完整時沒有底力技警告',
  validateCharacter(complete).warnings.filter((w) => ['triggerId', 'effectId', 'choices', 'loveTargetId', 'combinedPairs'].includes(w.field)),
  []
);

check('設定問題清單：全空兩筆', zeroPowerIssues(createZeroPowerState()).length, 2);
check(
  '設定問題清單：完整為零筆',
  zeroPowerIssues({
    triggerId: 'revenge',
    effectId: 'shield',
    choices: { damagePair: [], damageType: '', statuses: [] }
  }),
  []
);
check(
  '合體之力未設定配對',
  zeroPowerIssues({ triggerId: 'revenge', effectId: 'shield', variant: 'combined' }).map((i) => i.field),
  ['combinedPairs']
);

// ─────────────────────────────────────────────────────────── K
section('K. 摘要文字');

check(
  '摘要含名稱、觸發與效果',
  describeZeroPower({
    name: '王家之刃',
    triggerId: 'revenge',
    effectId: 'elements',
    choices: { damagePair: ['火', '冰'] }
  }),
  '王家之刃　觸發：復仇　效果：零之元素　屬性：火／冰'
);
check('未設定時的摘要', describeZeroPower(undefined), '尚未設定底力技');
check(
  '天災摘要帶屬性與狀態',
  describeZeroPower({
    triggerId: 'revenge',
    effectId: 'scourge',
    choices: { damagePair: [], damageType: '暗', statuses: ['眩暈', '虛弱'] }
  }),
  '觸發：復仇　效果：零之天災　選擇：暗＋眩暈、虛弱'
);
check(
  '覺醒未覺醒寫在摘要裡',
  describeZeroPower({ triggerId: 'revenge', effectId: 'shield', variant: 'awakened' }).includes('未覺醒'),
  true
);
check('規則摘要非空', ZERO_POWER_NOTES.length >= 3, true);
check('出處寫明高度奇幻手冊', ZERO_POWER_SOURCE, '高度奇幻手冊 p.124–131');

// ─────────────────────────────────────────────────────────── L
section('L. SSR（建角模式與跑團模式）');

const renderEdit = (character, roster = []) => plain(renderToStaticMarkup(React.createElement(ZeroPowerBlock, {
  character, theme, mode: 'edit', roster
})));
const renderPlay = (character, roster = []) => plain(renderToStaticMarkup(React.createElement(ZeroPowerBlock, {
  character, theme, mode: 'play', roster
})));

const editHtml = renderEdit(fresh);
check('建角模式顯示標題', editHtml.includes('底力技'), true);
check('建角模式列出全部七個觸發', ZERO_TRIGGERS.every((t) => editHtml.includes(t.name)), true);
check('建角模式列出全部十一個效果', ZERO_EFFECTS.every((e) => editHtml.includes(e.name)), true);
check('建角模式把重複問題交給 GM 審卡', editHtml.includes('那是 GM 審卡時的裁定'), true);
check('建角模式不再宣稱「整團不得重複」是硬規定', editHtml.includes('整團不得有兩名以上'), false);
check('建角模式有變體規則', editHtml.includes('變體規則') && editHtml.includes('覺醒之力') && editHtml.includes('合體之力'), true);
check('未選效果時不顯示效果全文', editHtml.includes('你以每一把已裝備的武器各進行一次自由攻擊'), false);

const editScourge = renderEdit({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), triggerId: 'revenge', effectId: 'scourge' }
});
check('選了零之天災才顯示傷害類型選擇', editScourge.includes('選定一種傷害類型'), true);
check('選了零之天災才顯示狀態選擇', editScourge.includes('選定兩種狀態效果'), true);
check('零之天災的效果全文出現', editScourge.includes('你對每個目標造成'), true);

const editElements = renderEdit({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), triggerId: 'revenge', effectId: 'elements' }
});
check('零之元素顯示兩種屬性的選擇', editElements.includes('選定兩種傷害類型'), true);
check('零之元素不顯示天災的狀態選擇', editElements.includes('選定兩種狀態效果'), false);

const editLove = renderEdit({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), triggerId: 'love', effectId: 'shield' }
});
check('【愛】才顯示綁定下拉', editLove.includes('你所愛的玩家角色'), true);

const editCombined = renderEdit(
  {
    ...fresh,
    zeroPower: {
      ...createZeroPowerState(),
      triggerId: 'revenge',
      variant: 'combined',
      combinedPairs: [{ partnerId: 'pc2', effectId: '', nickname: '' }]
    }
  },
  [{ id: 'pc2', name: '貝菈' }, { id: 'pc3', name: '席恩' }]
);
check('合體之力顯示配對區', editCombined.includes('合體配對'), true);
check('合體之力說明 4 格命刻', editCombined.includes('命刻只有 4 格'), true);
check('合體之力不顯示單一效果 chips', editCombined.includes('底力效果'), false);
check('合體之力列出隊友可選', editCombined.includes('貝菈') && editCombined.includes('席恩'), true);
check('合體之力說明四人團六個效果', editCombined.includes('全團共六個效果'), true);

const playEmpty = renderPlay(fresh);
check('跑團模式顯示命刻格數', playEmpty.includes('0／6'), true);
check('跑團模式說明來源', playEmpty.includes(ZERO_POWER_SOURCE), true);
check('空白狀態先提醒未選觸發', playEmpty.includes('尚未選擇底力觸發'), true);

const playReady = renderPlay({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), triggerId: 'revenge', effectId: 'blitz', clock: 6 }
});
check('全滿時顯示可施展', playReady.includes('6／6'), true);
check('全滿時提示每回合一次', playReady.includes('每回合只能施展一次') || playReady.includes('每回合一次'), true);
check('全滿時不再顯示未滿提示', playReady.includes('底力命刻尚未全滿'), false);

const playCombined = renderPlay({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), triggerId: 'revenge', effectId: 'shield', variant: 'combined', clock: 4 }
});
check('合體之力顯示 4 格', playCombined.includes('4／4'), true);

// ─────────────────────────────────────────────────────────── N
section('N. 覺醒之力（p.130）');

const awakening = { ...createZeroPowerState(), variant: 'awakened', effectId: 'blitz' };

check('覺醒前不必選觸發', zeroPowerIssues(awakening).map((i) => i.field), []);
check('覺醒前提醒效果', zeroPowerIssues({ ...awakening, effectId: '' }).map((i) => i.field), ['effectId']);
check('覺醒前不能施展', canUnleashZeroPower({ ...awakening, clock: 6 }).ok, false);
check(
  '覺醒前的說明指出要先覺醒',
  canUnleashZeroPower({ ...awakening, clock: 6 }).reason.startsWith('尚未覺醒'),
  true
);

const awakenEvent = awakenZeroPower(awakening, { triggerId: 'revenge', inConflict: false });
check('覺醒成功', awakenEvent.ok, true);
check('覺醒取得觸發', awakenEvent.state.triggerId, 'revenge');
check('覺醒標記為已覺醒', awakenEvent.state.awakened, true);
check('覺醒回復危機值倍數 1', awakenEvent.hpRecoveryFactor, 1);
check('非衝突覺醒不填命刻', awakenEvent.state.clock, 0);
check('非衝突覺醒訊息不提填滿', awakenEvent.message.includes('已填滿'), false);

const awakenInFight = awakenZeroPower(awakening, { triggerId: 'love', inConflict: true });
check('衝突中覺醒命刻立即全滿', awakenInFight.state.clock, 6);
check('衝突中覺醒訊息說明填滿', awakenInFight.message.includes('已填滿'), true);
check('衝突中覺醒的訊息含觸發名', awakenInFight.message.includes('愛'), true);

check('沒選觸發不能覺醒', awakenZeroPower(awakening, {}).ok, false);
check('沒選觸發的訊息', awakenZeroPower(awakening, {}).message, '覺醒時要選定一個與事件相符的底力觸發');
check('未知觸發不能覺醒', awakenZeroPower(awakening, { triggerId: 'nope' }).ok, false);
check('標準模式不能覺醒', awakenZeroPower({ ...ready, variant: '' }, { triggerId: 'revenge' }).ok, false);
check('標準模式的覺醒訊息', awakenZeroPower({ ...ready, variant: '' }, { triggerId: 'revenge' }).message, '這個角色沒有啟用覺醒之力');

const twice = awakenZeroPower(awakenEvent.state, { triggerId: 'love', inConflict: true });
check('每次戰役只能覺醒一次', twice.ok, false);
check('第二次覺醒的訊息', twice.message, '已經覺醒過（每次戰役只能覺醒一次）');
check('第二次覺醒不改狀態', twice.state.triggerId, 'revenge');
check('覺醒後恢復可施展判定', canUnleashZeroPower(awakenInFight.state).ok, true);
check('覺醒後摘要寫已覺醒', describeZeroPower(awakenInFight.state).includes('已覺醒'), true);

// ─────────────────────────────────────────────────────────── O
section('O. 合體之力（p.131）');

const combinedState = {
  ...createZeroPowerState(),
  variant: 'combined',
  triggerId: 'revenge',
  combinedPairs: [
    { partnerId: 'pc2', effectId: 'shield', nickname: '子彈斬' },
    { partnerId: 'pc3', effectId: 'scourge', nickname: '' }
  ],
  clock: 4
};

check('合體之力命刻上限 4', zeroClockMax(combinedState), 4);
check('取配對效果：pc2', zeroActiveEffectId(combinedState, 'pc2'), 'shield');
check('取配對效果：pc3', zeroActiveEffectId(combinedState, 'pc3'), 'scourge');
check('未配對的伙伴沒有作用中的效果', zeroActiveEffectId(combinedState, 'pc9'), '');
check('標準模式的作用中效果就是自己的', zeroActiveEffectId(ready, 'pc2'), 'blitz');
check('取配對物件', zeroPairFor(combinedState, 'pc2').nickname, '子彈斬');
check('標準模式沒有配對物件', zeroPairFor(ready, 'pc2'), null);

check('未選配對不能施展', canUnleashZeroPower(combinedState).reason, '尚未選擇要施展哪一組合體配對');
check(
  '對方命刻未滿不能施展',
  canUnleashZeroPower(combinedState, { partnerId: 'pc2', partnerClockFull: false }).reason,
  '合體之力要雙方命刻皆滿（對方尚未全滿）'
);
check(
  '不知道對方命刻時不阻擋',
  canUnleashZeroPower(combinedState, { partnerId: 'pc2' }).ok,
  true
);
check(
  '雙方皆滿可施展',
  canUnleashZeroPower(combinedState, { partnerId: 'pc2', partnerClockFull: true }).ok,
  true
);
check(
  '合體之力沒有配對時先提醒',
  canUnleashZeroPower({ ...combinedState, combinedPairs: [] }, { partnerId: 'pc2' }).reason,
  '尚未設定合體之力的配對'
);

const combinedUnleash = unleashZeroPower(combinedState, { partnerId: 'pc2', partnerClockFull: true });
check('合體施展成功', combinedUnleash.ok, true);
check('合體施展清空自己命刻', combinedUnleash.state.clock, 0);
check('合體施展要求清空對方命刻', combinedUnleash.partnerCleared, true);
check(
  '合體施展訊息用配對效果名',
  combinedUnleash.message,
  '施展【零之盾】（合體之力，觸發：復仇），雙方底力命刻已清空'
);
check('標準施展不要求清空別人', unleashed.partnerCleared, false);

const sharedEffectPairs = {
  ...combinedState,
  combinedPairs: [
    { partnerId: 'pc2', effectId: 'shield', nickname: '' },
    { partnerId: 'pc3', effectId: 'shield', nickname: '' }
  ]
};
check(
  '合體之力的多組配對可以共用同一個效果（p.131 明文允許）',
  normalizeZeroPower(sharedEffectPairs).combinedPairs.map((p) => p.effectId),
  ['shield', 'shield']
);
check('共用效果時角色層驗證不報錯', zeroPowerIssues(sharedEffectPairs), []);
check(
  '兩個角色的觸發可以相同（團隊層已不檢查）',
  [combinedState, { ...combinedState, triggerId: 'revenge' }].map((s) => normalizeZeroPower(s).triggerId),
  ['revenge', 'revenge']
);

check(
  '合體之力摘要寫出配對對象',
  describeZeroPower({ ...combinedState, combinedPairs: [{ partnerId: '貝菈', effectId: 'shield' }] }),
  '觸發：復仇　效果：零之盾（與 貝菈 共用）　合體之力'
);
check(
  '多組配對時摘要只寫組數',
  describeZeroPower(combinedState).includes('效果：2 組配對'),
  true
);

check(
  '配對缺少效果時提出警告',
  zeroPowerIssues({
    ...combinedState,
    combinedPairs: [{ partnerId: 'pc2', effectId: '' }]
  }).map((i) => i.field),
  ['combinedPairs.0.effectId']
);

// 舊存檔遷移：只有 combinedWith 的資料升格成一組配對
const migrated = normalizeZeroPower({ variant: 'combined', triggerId: 'revenge', effectId: 'shield', combinedWith: 'pc2' });
check('舊 combinedWith 遷移成一組配對', migrated.combinedPairs, [{ partnerId: 'pc2', effectId: 'shield', nickname: '' }]);
check('遷移後不再有 combinedWith 欄位', 'combinedWith' in migrated, false);
check('壞配對項目被剔除', normalizeZeroPower({ combinedPairs: [null, { partnerId: '' }, { partnerId: 'pc2', effectId: 'nope' }] }).combinedPairs, [{ partnerId: 'pc2', effectId: '', nickname: '' }]);
check('配對的別稱保留', normalizeZeroPower({ combinedPairs: [{ partnerId: 'pc2', effectId: 'shield', nickname: '子彈斬' }] }).combinedPairs[0].nickname, '子彈斬');

// ─────────────────────────────────────────────────────────── M
section('M. 原始碼護欄（入口必須有條件，數字不得硬編碼）');

const editorSrc = READ('src/features/character-sheet/components/CharacterEditor.jsx');
const hudSrc = READ('src/features/character-sheet/components/CharacterPlayHUD.jsx');
const dataSrc = READ('src/features/character-sheet/data/zeroPowers.js');
const utilSrc = READ('src/features/character-sheet/utils/zeroPower.js');
const panelSrc = READ('src/features/character-sheet/components/CreationRulesPanel.jsx');

check('編輯器以規則為條件渲染底力技區塊', /\{rules\.zeroPowers && \(\s*<ZeroPowerBlock/.test(editorSrc), true);
check('編輯器把隊友名冊傳進區塊', editorSrc.includes('roster={roster}'), true);
check('跑團面板以 isZeroPowersEnabled 為條件', hudSrc.includes('isZeroPowersEnabled(character)'), true);
check('開卡規則面板有底力技開關', panelSrc.includes("key: 'zeroPowers'"), true);
check('命刻上限不是硬編碼 6', utilSrc.includes('ZERO_CLOCK_SECTIONS'), true);
check('合體之力的 4 也來自常數', utilSrc.includes('ZERO_CLOCK_SECTIONS_COMBINED'), true);
check('資料層不再自稱「原書特典」', dataSrc.includes('原書特典'), false);
check('開卡規則檔已更正出處', READ('src/features/character-sheet/data/creationRules.js').includes('原書特典的底力技（Zero Power）、'), false);
check('資料層已無單一配對欄位（只留舊存檔遷移）', /combinedWith:\s*''/.test(dataSrc), false);
check('跑團面板把名冊傳進區塊', hudSrc.includes('roster={roster}'), true);
check('跑團面板接上伙伴命刻清空', hudSrc.includes('onPartnerCleared={onPartnerCleared}'), true);
check('覺醒的 HP 回復用危機值而非硬編碼', hudSrc.includes('stats.crisisThreshold * factor'), true);
check('覺醒動作存在於純函式層', utilSrc.includes('export const awakenZeroPower'), true);
check('合體配對的效果由配對決定', utilSrc.includes('s.combinedPairs.find'), true);

// ─────────────────────────────────────────────────────────── P
section('P. 命名表瀏覽（與身份表同一個入口形狀）');

const actionGroups = zeroNameTableGroups('action');
const originGroups = zeroNameTableGroups('origin');

check('動作表轉置成三欄', actionGroups.map((g) => g.column), ['攻擊性', '防禦性', '強化']);
check('動作每一欄都是 20 個詞', actionGroups.map((g) => g.rows.length), [20, 20, 20]);
check('動作欄的骰面是 d20', actionGroups[0].die, 'd20');
check('動作欄的 #id 就是骰值', actionGroups[0].rows.slice(0, 3).map((r) => r.id), [1, 2, 3]);
check('動作欄第 12 個詞是衝擊', actionGroups[0].rows[11].zh, '衝擊');
check('防禦欄第 16 個詞是盾', actionGroups[1].rows[15].zh, '盾');
check('起源表轉置成六欄', originGroups.map((g) => g.column).length, 6);
check('起源每一欄都是 10 個詞', originGroups.map((g) => g.rows.length), [10, 10, 10, 10, 10, 10]);
check('由來欄的骰面是 d10', originGroups[0].die, 'd10');
check('自然元素欄第 9 個詞是雷鳴', originGroups[2].rows[8].zh, '雷鳴');
check('兵法欄第 10 個詞是君主的', originGroups[0].rows[9].zh, '君主的');
check('未知種類回退成動作表', zeroNameTableGroups('nope').length, 3);

/*
 * `JRPGModal` 在 SSR 下必定回 `null`（`mounted` 只能由 `useEffect` 設起來），
 * 所以測內容元件而不是彈窗殼——依 AGENTS.md「優先加注入點、不要放棄覆蓋」。
 */
const tablesBody = (props = {}) =>
  plain(renderToStaticMarkup(React.createElement(ZeroPowerNameTablesBody, { theme, ...props })));

const tablesIdle = tablesBody();
check(
  '命名表列出全部動作欄',
  ['攻擊性', '防禦性', '強化'].every((c) => tablesIdle.includes(c)),
  true
);
check(
  '命名表列出全部由來欄',
  ['兵法', '獸與魔物', '自然元素', '內在之力', '神聖與瀆神', '不可解'].every((c) => tablesIdle.includes(c)),
  true
);
check('命名表說明兩顆骰怎麼投', tablesIdle.includes('動作骰 1d20、由來骰 1d10'), true);
check('命名表說明是靈感不是規則', tablesIdle.includes('這張表是靈感，不是規則'), true);
check('未擲骰時沒有結算卡', tablesIdle.includes('擲骰結算'), false);
check('空白狀態提示「尚未選取」', tablesIdle.includes('尚未選取'), true);
check(
  '分頁標籤列出詞數',
  tablesIdle.includes('1. 動作（60 詞）') && tablesIdle.includes('2. 由來（60 詞）'),
  true
);
check('詞表以骰面編號', tablesIdle.includes('#12') && tablesIdle.includes('#9'), true);

const tablesRolled = tablesBody({
  rolledResult: {
    actionRoll: 12,
    originRoll: 9,
    action: '衝擊',
    origin: '雷鳴',
    name: '雷鳴之衝擊',
    actionColumn: 0,
    originColumn: 2
  }
});
check('擲骰結果顯示名稱', tablesRolled.includes('雷鳴之衝擊'), true);
check('擲骰結果拆出由來骰面', tablesRolled.includes('d10 = 9 → 雷鳴'), true);
check('擲骰結果拆出動作骰面', tablesRolled.includes('d20 = 12 → 衝擊'), true);
check('擲骰結果標出所屬欄位', tablesRolled.includes('自然元素'), true);

const tablesPicked = tablesBody({
  pickedAction: { id: 16, column: 1, zh: '盾' },
  pickedOrigin: { id: 10, column: 0, zh: '君主的' },
  assembledName: '君主的盾'
});
check(
  '自選組合顯示兩個已選詞',
  tablesPicked.includes('1. 由來: 君主的') && tablesPicked.includes('2. 動作: 盾'),
  true
);
check('自選組合顯示串好的名稱', tablesPicked.includes('套用此組合: 君主的盾'), true);

const tablesSearch = tablesBody({ searchTerm: '龍' });
check('搜尋命中時仍看得到該詞', tablesSearch.includes('龍'), true);
check('搜尋時不相關的詞被濾掉', tablesSearch.includes('獠牙'), false);

// ─────────────────────────────────────────────────────────── Q
section('Q. 團隊約束已移除（介面層）');

const blockSrc = READ('src/features/character-sheet/components/ZeroPowerBlock.jsx');

check(
  '工具層原始碼沒有殘留這兩個函式',
  /export const (findDuplicateZeroPowers|zeroPowerTakenBy)/.test(utilSrc),
  false
);
check('chip 元件不再接受 disabled（團隊約束的唯一來源）', blockSrc.includes('function ChoiceChip({ active, title'), true);
check('區塊不再呼叫佔用查詢', blockSrc.includes('zeroPowerTakenBy'), false);
check('區塊不再有 taken 佔用表', blockSrc.includes('taken.'), false);
check('名冊仍然傳進區塊（合體配對與愛的綁定要用）', blockSrc.includes('roster'), true);
check('說明文字把重複問題交給 GM', blockSrc.includes('那是 GM 審卡時的裁定'), true);

const dupEditHtml = renderEdit(
  {
    ...fresh,
    id: 'pc9',
    zeroPower: { ...createZeroPowerState(), triggerId: 'revenge', effectId: 'shield' }
  },
  [
    { id: 'pc1', name: '阿爾', zeroPower: { triggerId: 'revenge', effectId: 'shield' } },
    { id: 'pc2', name: '貝菈', zeroPower: { triggerId: 'revenge', effectId: 'blitz' } }
  ]
);
check('不再顯示「隊友已選」的副標', dupEditHtml.includes('隊友已選'), false);
check('隊友撞了觸發，七個觸發仍全部列出', ZERO_TRIGGERS.every((t) => dupEditHtml.includes(t.name)), true);
check('隊友撞了效果，十一個效果仍全部列出', ZERO_EFFECTS.every((e) => dupEditHtml.includes(e.name)), true);

// ─────────────────────────────────────────────────────────── R
section('R. 完整卡片（選齊觸發與效果後擺在最下面）');

const showcaseOf = (character, roster = []) =>
  plain(renderToStaticMarkup(React.createElement(ZeroPowerBlock, {
    character, theme, mode: 'edit', roster
  })));

const showcaseEmpty = showcaseOf(fresh);
check(
  '未選齊時位置仍然在（避免版面突然長出一塊）',
  showcaseEmpty.includes('選好觸發與效果後，這裡會出現這一招的完整卡片'),
  true
);
check('空白狀態的佔位列出還缺兩項', showcaseEmpty.includes('還缺：觸發、效果'), true);
check('空白狀態沒有施展條件行', showcaseEmpty.includes('施展：命刻全滿'), false);

const onlyTrigger = showcaseOf({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), triggerId: 'revenge' }
});
check('只選觸發時還缺效果', onlyTrigger.includes('還缺：效果'), true);
check('只選觸發時不把觸發列為缺項', onlyTrigger.includes('還缺：觸發'), false);

const onlyEffect = showcaseOf({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), effectId: 'shield' }
});
check('只選效果時還缺觸發', onlyEffect.includes('還缺：觸發'), true);

const showcase = showcaseOf({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), name: '王家之盾', triggerId: 'revenge', effectId: 'shield' }
});
check('完整卡片顯示自取名稱', showcase.includes('王家之盾'), true);
check('完整卡片把效果與觸發並列', showcase.includes('【零之盾】· 觸發【復仇】'), true);
check(
  '完整卡片帶效果全文',
  showcase.includes('你與場景中在場的每一位盟友受到的所有傷害減半'),
  true
);
check('完整卡片標出施展條件', showcase.includes('施展：命刻全滿（6／6）'), true);
check('完整卡片提醒每回合一次', showcase.includes('每回合一次'), true);
check('完整卡片提醒要在衝突場景中', showcase.includes('衝突場景中'), true);
check('完整卡片標明出處', showcase.includes(ZERO_POWER_SOURCE), true);
check('選齊之後佔位提示消失', showcase.includes('選好觸發與效果後'), false);
check(
  '完整卡片位於變體規則之後（真的在最下面）',
  showcase.indexOf('變體規則') < showcase.indexOf('施展：命刻全滿'),
  true
);

const unnamedShowcase = showcaseOf({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), triggerId: 'revenge', effectId: 'shield' }
});
check('還沒取名時卡片給佔位名', unnamedShowcase.includes('（尚未命名）'), true);

/** 外觀是「特別的框」——漸層描邊、四角符號、進場動畫，三者都在原始碼裡。 */
check('卡片用漸層描邊外框', blockSrc.includes('linear-gradient(135deg'), true);
check('卡片四角各有角標', blockSrc.split('pointer-events-none absolute').length - 1, 4);
check('角標用的是軌道 3 允許的排版字符', blockSrc.includes('❖'), true);
check('卡片有進場動畫', blockSrc.includes('animate-fade-in'), true);
check('卡片名稱用襯線大字', blockSrc.includes('font-serif font-black text-xl'), true);
check(
  '卡片刻意不是一般淡框（不用 rounded-lg border px-2.5 py-2）',
  blockSrc.includes('rounded-2xl'),
  true
);

const combinedShowcase = showcaseOf(
  {
    ...fresh,
    zeroPower: {
      ...createZeroPowerState(),
      variant: 'combined',
      triggerId: 'revenge',
      name: '彈斬',
      combinedPairs: [
        { partnerId: 'pc1', effectId: 'scourge', nickname: '' },
        { partnerId: 'pc2', effectId: 'shield', nickname: '鐵壁' }
      ]
    }
  },
  [{ id: 'pc1', name: '阿爾' }, { id: 'pc2', name: '貝菈' }]
);
check(
  '合體之力每組配對各一張卡',
  combinedShowcase.includes('與 阿爾 共用') && combinedShowcase.includes('與 貝菈 共用'),
  true
);
check('合體之力卡片用配對別稱', combinedShowcase.includes('鐵壁'), true);
check('合體之力沒別稱時退回角色名稱', blockSrc.includes('row.pair.nickname || state.name'), true);
check('合體之力卡片提醒雙方命刻皆滿', combinedShowcase.includes('雙方命刻皆滿'), true);
check('合體之力卡片用 4 格命刻', combinedShowcase.includes('施展：命刻全滿（4／4）'), true);

const combinedNoPairs = showcaseOf({
  ...fresh,
  zeroPower: { ...createZeroPowerState(), variant: 'combined', triggerId: 'revenge' }
});
check('合體之力還沒配對時佔位', combinedNoPairs.includes('還缺：配對效果'), true);

// ─────────────────────────────────────────────────────────── S
section('S. 名詞說明彈窗（七個觸發與十一個效果）');

const glossaryBody = (props = {}) =>
  plain(renderToStaticMarkup(React.createElement(ZeroPowerGlossaryBody, { theme, ...props })));

check('分頁常數：觸發', GLOSSARY_TAB_TRIGGER, 'trigger');
check('分頁常數：效果', GLOSSARY_TAB_EFFECT, 'effect');

const glossaryTriggers = glossaryBody();
check('預設分頁是觸發', glossaryTriggers.includes('七個觸發（7）'), true);
check('分頁標籤同時列出效果數', glossaryTriggers.includes('十一個效果（11）'), true);
check('說明卡解釋兩者的分工', glossaryTriggers.includes('觸發決定命刻什麼時候填'), true);
check('觸發分頁列出全部七個名字', ZERO_TRIGGERS.every((t) => glossaryTriggers.includes(t.name)), true);
check(
  '觸發分頁列出全部七段敘述',
  ZERO_TRIGGERS.every((t) => glossaryTriggers.includes(t.desc.slice(0, 10))),
  true
);
check('觸發分頁不列效果名', glossaryTriggers.includes('零之疾襲'), false);
check(
  '觸發分頁標出填充格數',
  glossaryTriggers.includes('每次 3 格') && glossaryTriggers.includes('變動格數'),
  true
);
check('未傳 onPick 時沒有選取按鈕（注入點鐵律）', glossaryTriggers.includes('選這個'), false);

const glossaryEffects = glossaryBody({ activeTab: GLOSSARY_TAB_EFFECT });
check('效果分頁列出全部十一個名字', ZERO_EFFECTS.every((e) => glossaryEffects.includes(e.name)), true);
check(
  '效果分頁列出全部十一段敘述',
  ZERO_EFFECTS.every((e) => glossaryEffects.includes(e.desc.slice(0, 10))),
  true
);
check('效果分頁不列觸發名', glossaryEffects.includes('憐憫'), false);
check('效果分頁標示「底力效果」', glossaryEffects.includes('底力效果'), true);

const glossaryPicked = glossaryBody({ selectedTriggerId: 'love', onPickTrigger: () => {} });
check('已選的觸發標記為目前選擇', glossaryPicked.includes('✓ 目前選擇（再點一次取消）'), true);
check('傳了 onPick 才出現選取按鈕', glossaryPicked.includes('選這個'), true);
check('只有一項被標成已選', glossaryPicked.split('✓ 目前選擇').length - 1, 1);

check(
  '填充標籤：固定格數',
  zeroTriggerFillLabel(ZERO_TRIGGERS.find((t) => t.id === 'revenge')),
  '每次 3 格'
);
check(
  '填充標籤：變動格數',
  zeroTriggerFillLabel(ZERO_TRIGGERS.find((t) => t.id === 'synergy')),
  '變動格數'
);
check('填充標籤：沒有觸發時回空字串', zeroTriggerFillLabel(null), '');

check('建角模式有觸發說明入口', editHtml.includes('七個觸發的敘述'), true);
check('建角模式有效果說明入口', editHtml.includes('十一個效果的敘述'), true);
check(
  '未選觸發時敘述不會自動露出（這就是需要說明入口的原因）',
  editHtml.includes('當你恢復一個或多個盟友的 HP'),
  false
);
check('說明入口是真的按鈕，不只是 title 提示', blockSrc.includes('openGlossary(GLOSSARY_TAB_TRIGGER)'), true);
check('合體模式也有說明入口', blockSrc.split('openGlossary(GLOSSARY_TAB_EFFECT)').length - 1, 2);

// ─────────────────────────────────────────────────────────── 結果
lines.push(`\n通過 ${pass} / ${pass + fail}${fail === 0 ? '　（全部通過）' : ''}`);
if (fail > 0) lines.push(`\n失敗 ${fail} 項`);
console.log(lines.join('\n'));
process.exit(fail > 0 ? 1 : 0);
