/**
 * 底力技的純函式層（ZERO POWERS）。
 *
 * 為什麼資料與邏輯分開：`data/zeroPowers.js` 是**規則文本**（七個觸發、十一個效果、
 * 兩張命名表），這裡是**可以被測試釘住的計算**。介面只呼叫這裡，不自己算。
 *
 * 這個分層不是潔癖——底力技有一半的規則住在「命刻現在幾格」「這回合能不能施展」
 * 「選了效果之後還缺哪個選擇」這些地方，而這些判斷若寫在 `onClick` 裡，
 * SSR 測不到（見 AGENTS.md §AW6(b)：`onClick` 內的邏輯 SSR 測不到，要抽成純函式）。
 */
import {
  ZERO_CLOCK_SECTIONS,
  ZERO_CLOCK_SECTIONS_COMBINED,
  ZERO_EFFECTS,
  ZERO_STATUS_EFFECTS,
  ZERO_DAMAGE_TYPES,
  ZERO_TRIGGERS,
  createZeroPowerState,
  normalizeZeroPower,
  zeroEffectById,
  zeroTriggerById
} from '../data/zeroPowers.js';

/** 底力命刻的刻度上限（【合體之力】變體是 4 格）。 */
export const zeroClockMax = (state) => {
  const s = normalizeZeroPower(state);
  return s.variant === 'combined' ? ZERO_CLOCK_SECTIONS_COMBINED : ZERO_CLOCK_SECTIONS;
};

/** 填充 n 個刻度，超出上限即停在滿格（回傳新的 state，不改原物件）。 */
export const fillZeroClock = (state, n = 1) => {
  const s = normalizeZeroPower(state);
  const max = zeroClockMax(s);
  const amount = Number.isFinite(Number(n)) ? Math.max(0, Math.trunc(Number(n))) : 0;
  return { ...s, clock: Math.min(max, s.clock + amount) };
};

/** 清空命刻（施展後、場景結束時、以及【零之機運】以外不得呼叫）。 */
export const clearZeroClock = (state) => ({ ...normalizeZeroPower(state), clock: 0 });

/** 命刻是否已滿。 */
export const isZeroClockFull = (state) => {
  const s = normalizeZeroPower(state);
  return s.clock >= zeroClockMax(s);
};

/**
 * 一次觸發實際填充幾個刻度。
 *
 * 【協同】是唯一的變動值：每個對該次傷害類型處於**弱點**的生物各 1 格。
 * 其餘六個是固定值。`weakTargets` 只在協同時有意義。
 */
export const zeroTriggerFill = (triggerId, { weakTargets = 0 } = {}) => {
  const trigger = zeroTriggerById(triggerId);
  if (!trigger) return 0;
  if (trigger.fill === 'varies') {
    const n = Number(weakTargets);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }
  return trigger.fill;
};

/** 效果需要的額外選擇種類（`null` 代表不需要）。 */
export const zeroChoiceRequirement = (effectId) => {
  const effect = zeroEffectById(effectId);
  return effect ? effect.choice : null;
};

/**
 * 選取效果時的必要選擇是否已完成。
 *
 * ※【零之機運】的奇偶選擇**不列入**：那是施展當下骰之前才決定的事，
 *   不是建角時要存的資料。同理【零之目標】的填充／清空是施展時的二選一。
 *   只有「選取效果時就必須固定下來」的兩種（元素、天災）算必要選擇。
 */
export const isZeroChoiceComplete = (state) => {
  const s = normalizeZeroPower(state);
  const need = zeroChoiceRequirement(s.effectId);
  if (need === 'damagePair') return s.choices.damagePair.length === 2;
  if (need === 'damagePlusStatuses') {
    return Boolean(s.choices.damageType) && s.choices.statuses.length === 2;
  }
  return true;
};

/**
 * 這個角色「現在實際持有的效果 id」。
 *
 * 標準模式與覺醒之力：效果在自己身上（`state.effectId`）。
 * **合體之力：效果在配對上**（原文 p.131「Each possible pair of PCs shares one
 * zero effect」），所以必須指定 `partnerId` 才回答得出來。
 */
export const zeroActiveEffectId = (state, partnerId = '') => {
  const s = normalizeZeroPower(state);
  if (s.variant !== 'combined') return s.effectId;
  const pair = s.combinedPairs.find((p) => p.partnerId === partnerId);
  return pair ? pair.effectId : '';
};

/** 合體之力：取某一組配對（沒有就回 `null`）。 */
export const zeroPairFor = (state, partnerId = '') => {
  const s = normalizeZeroPower(state);
  if (s.variant !== 'combined') return null;
  return s.combinedPairs.find((p) => p.partnerId === partnerId) || null;
};

/**
 * 現在能不能施展底力效果（**單一判定入口**）。
 *
 * 回傳 `{ ok, reason }`——介面用它決定按鈕要不要停用與停用的說明，
 * 護欄用它確認「前置條件」一個都沒漏。
 *
 * `partnerClockFull` 只對【合體之力】有意義，而且是**三態**：
 * `true`／`false`／`undefined`。`undefined` 代表「名冊不在手上、無法判斷」，
 * 此時不阻擋——跑團面板若拿不到隊友資料，寧可讓玩家自己看，也不要假裝知道。
 */
export const canUnleashZeroPower = (
  state,
  { inConflict = true, alreadyUnleashedThisTurn = false, partnerId = '', partnerClockFull = undefined } = {}
) => {
  const s = normalizeZeroPower(state);
  if (s.variant === 'awakened' && !s.awakened) {
    return { ok: false, reason: '尚未覺醒：覺醒之力要在角色瀕死或遭遇重大轉折時才會取得觸發' };
  }
  if (s.variant === 'combined') {
    if (s.combinedPairs.length === 0) return { ok: false, reason: '尚未設定合體之力的配對' };
    if (!partnerId) return { ok: false, reason: '尚未選擇要施展哪一組合體配對' };
    if (partnerClockFull === false) {
      return { ok: false, reason: '合體之力要雙方命刻皆滿（對方尚未全滿）' };
    }
  }
  if (!s.triggerId) return { ok: false, reason: '尚未選擇底力觸發' };
  const activeEffectId = zeroActiveEffectId(s, partnerId);
  if (!activeEffectId) return { ok: false, reason: '尚未選擇底力效果' };
  if (!isZeroChoiceComplete({ ...s, effectId: activeEffectId })) {
    return { ok: false, reason: '效果的必要選擇尚未完成' };
  }
  if (!inConflict) return { ok: false, reason: '底力效果只能在衝突場景中施展' };
  if (alreadyUnleashedThisTurn) return { ok: false, reason: '每回合只能施展一次' };
  if (!isZeroClockFull(s)) {
    return { ok: false, reason: `底力命刻尚未全滿（${s.clock}／${zeroClockMax(s)}）` };
  }
  return { ok: true, reason: '' };
};

/**
 * 施展：清空命刻（【合體之力】清空**雙方**命刻）。
 *
 * 刻意只回傳新 state 與一行紀錄文字，不碰任何 UI 狀態——
 * 施展的**其餘後果**（傷害、狀態、額外動作）是桌面上處理的事，
 * 本專案不做自動戰鬥結算（與 `initiativeVariant.describeInitiativeOrder` 同一個立場：
 * 純函式存在的理由是讓規則有可測的形狀，不是取代 GM）。
 *
 * `partnerCleared` 告訴呼叫端「對方那一格也要清」——本函式改不到別人的存檔，
 * 所以把「該清誰」交給持有名冊的那一層。
 */
export const unleashZeroPower = (state, { partnerId = '', partnerClockFull = undefined } = {}) => {
  const s = normalizeZeroPower(state);
  const gate = canUnleashZeroPower(s, { partnerId, partnerClockFull });
  if (!gate.ok) return { state: s, ok: false, message: gate.reason, partnerCleared: false };
  const effectId = zeroActiveEffectId(s, partnerId);
  const effect = zeroEffectById(effectId);
  const trigger = zeroTriggerById(s.triggerId);
  const name = effect ? effect.name : effectId;
  const triggerName = trigger ? trigger.name : s.triggerId;
  const combined = s.variant === 'combined';
  return {
    state: clearZeroClock(s),
    ok: true,
    partnerCleared: combined,
    message: combined
      ? `施展【${name}】（合體之力，觸發：${triggerName}），雙方底力命刻已清空`
      : `施展【${name}】（觸發：${triggerName}），底力命刻已清空`
  };
};

/**
 * 【覺醒之力】的覺醒動作（原文 p.130）。
 *
 * 原文的三件事一次做完：**回復等同危機值的 HP**、**當場選定觸發**、
 * **若在衝突中覺醒則命刻立即填滿**。每次戰役只能覺醒一次——
 * 所以 `awakened` 一旦為 `true` 就再也不受理。
 *
 * HP 由呼叫端扣加（`hpRecoveryFactor` 是危機值的倍數，目前恆為 1）：
 * 這層不碰角色數值，理由同 `unleashZeroPower`。
 */
export const awakenZeroPower = (state, { triggerId = '', inConflict = false } = {}) => {
  const s = normalizeZeroPower(state);
  if (s.variant !== 'awakened') {
    return { state: s, ok: false, message: '這個角色沒有啟用覺醒之力', hpRecoveryFactor: 0 };
  }
  if (s.awakened) {
    return { state: s, ok: false, message: '已經覺醒過（每次戰役只能覺醒一次）', hpRecoveryFactor: 0 };
  }
  const trigger = zeroTriggerById(triggerId);
  if (!trigger) {
    return { state: s, ok: false, message: '覺醒時要選定一個與事件相符的底力觸發', hpRecoveryFactor: 0 };
  }
  const next = { ...s, awakened: true, triggerId: trigger.id };
  if (inConflict) next.clock = zeroClockMax(next);
  return {
    state: next,
    ok: true,
    hpRecoveryFactor: 1,
    message: inConflict
      ? `覺醒底力技（觸發：${trigger.name}），立即回復等同危機值的 HP，底力命刻已填滿`
      : `覺醒底力技（觸發：${trigger.name}），立即回復等同危機值的 HP`
  };
};

/**
 * 【零之機運】的四個檔位，由弱到強。
 *
 * 原文的「或緊接在其上一行的效果」＝**較弱的一檔**（版面順序），
 * 所以 `previousTier` 往**前**找。零顆沒有上一行（回 `null`）。
 */
export const ZERO_CHANCE_TIERS = Object.freeze([
  { id: 'none', matches: 0, label: '零顆' },
  { id: 'one', matches: 1, label: '一顆' },
  { id: 'two', matches: 2, label: '兩顆' },
  { id: 'three', matches: 3, label: '三顆' }
]);

/** 由符合的骰數取得檔位。 */
export const zeroChanceTier = (matches) => {
  const n = Number(matches);
  const index = Number.isFinite(n) ? Math.min(3, Math.max(0, Math.trunc(n))) : 0;
  return ZERO_CHANCE_TIERS[index];
};

/** 這個檔位的「上一行」（較弱的一檔）；零顆回 `null`。 */
export const zeroChancePreviousTier = (tierId) => {
  const index = ZERO_CHANCE_TIERS.findIndex((t) => t.id === tierId);
  if (index <= 0) return null;
  return ZERO_CHANCE_TIERS[index - 1];
};

/** 介面顯示用：兩個可選檔位（對應檔 ＋ 上一行檔）。 */
export const zeroChanceOptions = (matches) => {
  const tier = zeroChanceTier(matches);
  const previous = zeroChancePreviousTier(tier.id);
  return previous ? [tier, previous] : [tier];
};

/** 一行摘要（角色卡與匯出用）。 */
export const describeZeroPower = (state) => {
  const s = normalizeZeroPower(state);
  const trigger = zeroTriggerById(s.triggerId);
  const combined = s.variant === 'combined';
  const activeEffectId = combined ? '' : s.effectId;
  const effect = zeroEffectById(activeEffectId);
  if (!trigger && !effect && s.combinedPairs.length === 0) return '尚未設定底力技';
  const parts = [];
  if (s.name) parts.push(s.name);
  parts.push(`觸發：${trigger ? trigger.name : '未選'}`);
  if (combined) {
    // 合體之力的效果在配對上：一組就寫名字，多組就寫數量（角色卡放不下 N 行）
    if (s.combinedPairs.length === 0) {
      parts.push('效果：未設定配對');
    } else if (s.combinedPairs.length === 1) {
      const pair = s.combinedPairs[0];
      const pe = zeroEffectById(pair.effectId);
      parts.push(`效果：${pe ? pe.name : '未選'}（與 ${pair.partnerId} 共用）`);
    } else {
      parts.push(`效果：${s.combinedPairs.length} 組配對`);
    }
  } else {
    parts.push(`效果：${effect ? effect.name : '未選'}`);
  }
  if (!combined && s.effectId === 'elements' && s.choices.damagePair.length === 2) {
    parts.push(`屬性：${s.choices.damagePair.join('／')}`);
  }
  if (!combined && s.effectId === 'scourge') {
    const bits = [];
    if (s.choices.damageType) bits.push(s.choices.damageType);
    if (s.choices.statuses.length > 0) bits.push(s.choices.statuses.join('、'));
    if (bits.length > 0) parts.push(`選擇：${bits.join('＋')}`);
  }
  if (s.variant === 'awakened') parts.push(s.awakened ? '覺醒之力（已覺醒）' : '覺醒之力（未覺醒）');
  if (combined) parts.push('合體之力');
  return parts.join('　');
};

/**
 * 底力技的設定是否完整（給 `validateCharacter` 用）。
 *
 * 只回傳「這個角色還缺什麼」。**團隊層面的取捨（同團是否重複）不在這裡**——
 * 使用者裁定（2026-10-21）：「團隊約束不需要，這個工作交給 GM 來審卡，
 * 而非開卡時的硬性規定。」所以本模組不提供任何跨角色的重複檢查，
 * 介面也不再把隊友已選的觸發／效果灰掉。
 *
 * **三種模式的必要條件不同**，這是原文的差異，不是實作方便：
 * - 標準：觸發 ＋ 效果。
 * - 覺醒之力（p.130）：建角時**只選效果、不選觸發**——所以覺醒前要求觸發會是假錯誤；
 *   覺醒後才要求觸發（那是覺醒動作的一部分，見 `awakenZeroPower`）。
 * - 合體之力（p.131）：觸發在自己身上，**效果在配對上**——所以要求的是「每組配對都有
 *   伙伴與效果」，而不是角色自己的 `effectId`。
 */
export const zeroPowerIssues = (state) => {
  const s = normalizeZeroPower(state);
  const issues = [];
  const combined = s.variant === 'combined';
  const awakeningPending = s.variant === 'awakened' && !s.awakened;

  if (combined) {
    if (s.combinedPairs.length === 0) {
      issues.push({ field: 'combinedPairs', type: 'warning', message: '【合體之力】至少要設定一組配對（每個其他玩家角色各一組）' });
    }
    s.combinedPairs.forEach((p, i) => {
      if (!p.effectId) {
        issues.push({
          field: `combinedPairs.${i}.effectId`,
          type: 'warning',
          message: '【合體之力】每一組配對都要指定一個共用的效果'
        });
      }
    });
  }

  if (awakeningPending) {
    if (!s.effectId) {
      issues.push({ field: 'effectId', type: 'info', message: '尚未選擇底力效果（覺醒之力在建角時只選效果）' });
    }
  } else if (!combined) {
    if (!s.triggerId) issues.push({ field: 'triggerId', type: 'info', message: '尚未選擇底力觸發' });
    if (!s.effectId) issues.push({ field: 'effectId', type: 'info', message: '尚未選擇底力效果' });
  } else if (!s.triggerId) {
    issues.push({ field: 'triggerId', type: 'info', message: '尚未選擇底力觸發' });
  }

  if (s.triggerId === 'love' && !s.loveTargetId) {
    issues.push({ field: 'loveTargetId', type: 'warning', message: '【愛】要綁定一個你所愛的玩家角色' });
  }
  if (!combined) {
    if (s.effectId === 'elements' && s.choices.damagePair.length !== 2) {
      issues.push({ field: 'choices', type: 'warning', message: '【零之元素】要選定兩種傷害類型' });
    }
    if (s.effectId === 'scourge') {
      if (!s.choices.damageType) {
        issues.push({ field: 'choices', type: 'warning', message: '【零之天災】要選定一種傷害類型' });
      }
      if (s.choices.statuses.length !== 2) {
        issues.push({ field: 'choices', type: 'warning', message: '【零之天災】要選定兩種狀態效果' });
      }
    }
  }
  return issues;
};

/** 空狀態與正規化的再匯出，讓介面不必同時 import 兩個模組。 */
export { createZeroPowerState, normalizeZeroPower };

/** 選項清單的再匯出（介面渲染下拉時只需要這個模組）。 */
export { ZERO_TRIGGERS, ZERO_EFFECTS, ZERO_DAMAGE_TYPES, ZERO_STATUS_EFFECTS };
