/**
 * 底力技區塊（ZERO POWERS）—— 高度奇幻手冊 p.124–131 的選用規則。
 *
 * ## 兩種模式，同一份資料
 *
 * - `mode="edit"`：建角第 5 步。選觸發、選效果、做效果的必要選擇、取名。
 * - `mode="play"`：跑團面板的命刻分頁。推進命刻、施展、清空。
 *
 * 兩者共用 `character.zeroPower` 與 `utils/zeroPower.js` 的純函式。
 * **刻意不做成兩個元件**：它們讀寫同一份資料，拆開之後「編輯端能選的組合」
 * 與「跑團端認得的組合」遲早會分歧——那正是本專案已經吃過幾次的虧
 * （見 AGENTS.md §AW「測試與生產分歧」）。
 *
 * ## 為什麼選項用按鈕而不是下拉
 *
 * 七個觸發、十一個效果，每個都要看得到**填充數量**與**是否已被隊友佔用**。
 * 原文的團隊限制是「不得有兩名以上角色擁有相同的觸發或效果」，
 * 而一個 `<select>` 只能顯示名字——玩家選完才發現撞了，還得再改一次。
 */
import React, { useState } from 'react';
import { GiSparkles, GiPocketWatch, GiRollingDices } from 'react-icons/gi';
import JRPGButton from '../../../components/ui/JRPGButton';
import { JRPGInput } from '../../../components/ui/JRPGInput';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';
import {
  ZERO_TRIGGERS,
  ZERO_EFFECTS,
  ZERO_DAMAGE_TYPES,
  ZERO_STATUS_EFFECTS,
  ZERO_VARIANTS,
  ZERO_NAME_ACTIONS,
  ZERO_NAME_ORIGINS,
  ZERO_POWER_SOURCE,
  generateZeroPowerName,
  zeroEffectById,
  zeroTriggerById
} from '../data/zeroPowers';
import {
  normalizeZeroPower,
  zeroClockMax,
  fillZeroClock,
  clearZeroClock,
  isZeroClockFull,
  canUnleashZeroPower,
  unleashZeroPower,
  awakenZeroPower,
  zeroActiveEffectId,
  zeroPowerTakenBy
} from '../utils/zeroPower';

/** 小圓角標籤按鈕（觸發與效果共用）。 */
function ChoiceChip({ active, disabled, title, subtitle, onClick, theme }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="text-left rounded-lg border px-2.5 py-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
      style={{
        backgroundColor: active ? theme.accentSoft || theme.subpanelBg : theme.cardBg,
        borderColor: active ? theme.accent : theme.border,
        color: theme.textDark
      }}
    >
      <span className="block font-serif font-black text-xs">{title}</span>
      {subtitle ? (
        <span className="block text-[10px] leading-tight" style={{ color: theme.textMuted }}>
          {subtitle}
        </span>
      ) : null}
    </button>
  );
}

/** 命刻刻度（跑團用；可點擊設定已填充數）。 */
function ClockStrip({ filled, max, onSet, theme, readonly = false }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => {
        const on = i < filled;
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            title={`${i + 1} 格`}
            onClick={() => onSet(on ? i : i + 1)}
            className="w-6 h-6 rounded-full border transition-all cursor-pointer disabled:cursor-default"
            style={{
              backgroundColor: on ? theme.accent : 'transparent',
              borderColor: theme.accent
            }}
          />
        );
      })}
      <span className="text-[11px] font-mono font-bold ml-1" style={{ color: theme.textMuted }}>
        {filled}／{max}
      </span>
    </div>
  );
}

export default function ZeroPowerBlock({
  character,
  theme = {},
  mode = 'edit',
  roster = [],
  onChange,
  onPartnerCleared = null,
  onRecoverHp = null,
  showToast = null
}) {
  const state = normalizeZeroPower(character && character.zeroPower);
  const [nameColumn, setNameColumn] = useState(0);
  const [originColumn, setOriginColumn] = useState(0);
  const [lastRoll, setLastRoll] = useState(null);
  /** 【合體之力】跑團時「這一回合要施展哪一組配對」——只存在於畫面狀態，不進存檔。 */
  const [partnerId, setPartnerId] = useState('');
  /** 【覺醒之力】覺醒當下要選的觸發（原文 p.130：覺醒時才選）。 */
  const [awakenTriggerId, setAwakenTriggerId] = useState('');
  /** 覺醒是否發生在衝突中（衝突中覺醒 → 命刻立即填滿）。瀕死覺醒必然在衝突中，故預設 true。 */
  const [awakenInConflict, setAwakenInConflict] = useState(true);

  const patch = (partial) => {
    if (typeof onChange === 'function') onChange({ ...state, ...partial });
  };

  /** 【合體之力】配對清單的三個操作（新增／改一組／移除）。 */
  const setPairs = (combinedPairs) => patch({ combinedPairs });
  const updatePair = (index, partial) =>
    setPairs(state.combinedPairs.map((p, i) => (i === index ? { ...p, ...partial } : p)));
  const removePair = (index) => setPairs(state.combinedPairs.filter((_, i) => i !== index));
  const addPair = () => setPairs([...state.combinedPairs, { partnerId: '', effectId: '', nickname: '' }]);

  const max = zeroClockMax(state);
  const full = isZeroClockFull(state);
  const taken = zeroPowerTakenBy(roster, character && character.id);
  const combined = state.variant === 'combined';
  const trigger = zeroTriggerById(state.triggerId);
  const activeEffectId = zeroActiveEffectId(state, partnerId);
  const effect = zeroEffectById(activeEffectId);
  const partnerChar = combined && partnerId ? roster.find((c) => c && c.id === partnerId) || null : null;
  const partnerState = partnerChar ? normalizeZeroPower(partnerChar.zeroPower) : null;
  const partnerClockFull = partnerState ? isZeroClockFull(partnerState) : undefined;

  const inputClass = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border font-mono font-bold';
  const inputStyle = { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark };

  /** 覺醒：一次做完「回復 HP、選定觸發、（衝突中）填滿命刻」。 */
  const doAwaken = () => {
    const result = awakenZeroPower(state, { triggerId: awakenTriggerId, inConflict: awakenInConflict });
    if (!result.ok) {
      if (typeof showToast === 'function') showToast(result.message);
      return;
    }
    if (typeof onChange === 'function') onChange(result.state);
    if (result.hpRecoveryFactor > 0 && typeof onRecoverHp === 'function') onRecoverHp(result.hpRecoveryFactor);
    if (typeof showToast === 'function') showToast(result.message);
  };

  const awakenArea = () => {
    if (state.variant !== 'awakened' || state.awakened) return null;
    return (
      <div className="rounded-lg border p-2.5 space-y-1.5" style={{ borderColor: theme.accent, backgroundColor: theme.cardBg }}>
        <span className="block text-[11px] font-bold" style={{ color: theme.textDark }}>
          覺醒之力：尚未覺醒
        </span>
        <p className="text-[10px] leading-relaxed" style={{ color: theme.textMuted }}>
          角色在衝突中 HP 歸零（取代投降或犧牲），或面對重大轉折時覺醒。覺醒時回復等同危機值的 HP，並當場選定一個與事件相符的觸發。
          {mode === 'edit' ? '（HP 回復由跑團面板自動計算；在這裡覺醒只記錄狀態。）' : ''}
        </p>
        <div className="flex flex-wrap gap-1">
          {ZERO_TRIGGERS.map((t) => {
            const holder = taken.triggers.get(t.id);
            return (
              <button
                key={t.id}
                type="button"
                disabled={Boolean(holder)}
                title={holder ? `隊友已選：${holder}` : t.desc}
                onClick={() => setAwakenTriggerId(awakenTriggerId === t.id ? '' : t.id)}
                className="text-[11px] px-2 py-0.5 rounded border cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                style={{
                  backgroundColor: awakenTriggerId === t.id ? theme.accentSoft || theme.subpanelBg : theme.cardBg,
                  borderColor: awakenTriggerId === t.id ? theme.accent : theme.border,
                  color: theme.textDark
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.textDark }}>
          <input
            type="checkbox"
            checked={awakenInConflict}
            onChange={(e) => setAwakenInConflict(e.target.checked)}
          />
          在衝突中覺醒（命刻立即填滿）
        </label>
        <JRPGButton
          variant="primary"
          size="xs"
          icon={GiSparkles}
          onClick={doAwaken}
          disabled={!awakenTriggerId}
        >
          覺醒
        </JRPGButton>
      </div>
    );
  };

  // ───────────────────────────────────────────── 跑團模式
  if (mode === 'play') {
    const gate = canUnleashZeroPower(state, { partnerId, partnerClockFull });
    const doUnleash = () => {
      const result = unleashZeroPower(state, { partnerId, partnerClockFull });
      if (result.ok) {
        if (typeof onChange === 'function') onChange(result.state);
        if (result.partnerCleared && typeof onPartnerCleared === 'function') onPartnerCleared(partnerId);
        if (typeof showToast === 'function') showToast(result.message);
      } else if (typeof showToast === 'function') {
        showToast(result.message);
      }
    };
    return (
      <div className="rounded-xl border p-3 space-y-2.5" style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }} data-testid="zero-power-play">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="font-serif font-black text-sm flex items-center gap-1.5" style={{ color: theme.textDark }}>
            <GiPocketWatch className="w-4 h-4" style={{ color: theme.accent }} />
            底力命刻
          </span>
          <span className="text-[10px]" style={{ color: theme.textMuted }}>{ZERO_POWER_SOURCE}</span>
        </div>

        <ClockStrip
          filled={state.clock}
          max={max}
          theme={theme}
          onSet={(n) => patch({ clock: n })}
        />

        <p className="text-[11px] leading-relaxed" style={{ color: theme.textDark }}>
          {state.triggerId || activeEffectId || combined
            ? `${trigger ? trigger.name : '未選觸發'}・${effect ? effect.name : combined ? '未選配對效果' : '未選效果'}`
            : '尚未設定底力技——請在角色編輯第 5 步設定'}
        </p>

        {awakenArea()}

        {combined ? (
          <div className="space-y-1">
            <label className="text-[11px] font-bold" style={{ color: theme.textDark }}>要施展哪一組配對</label>
            <select
              className={inputClass}
              style={inputStyle}
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">尚未選擇</option>
              {state.combinedPairs.map((p) => {
                const pe = zeroEffectById(p.effectId);
                const partner = roster.find((c) => c && c.id === p.partnerId);
                return (
                  <option key={p.partnerId} value={p.partnerId}>
                    {`${p.nickname || (pe ? pe.name : '未選效果')}（與 ${partner ? partner.name : p.partnerId} 共用）`}
                  </option>
                );
              })}
            </select>
            {partnerState ? (
              <p className="text-[10px]" style={{ color: isZeroClockFull(partnerState) ? theme.accent : theme.textMuted }}>
                {`對方的底力命刻：${partnerState.clock}／${zeroClockMax(partnerState)}`}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 flex-wrap">
          <JRPGButton
            variant={theme.outlineButtonVariant || 'outline'}
            size="xs"
            icon={GiSparkles}
            onClick={() => patch(fillZeroClock(state, 1))}
            disabled={full}
          >
            填充 1 格
          </JRPGButton>
          <JRPGButton
            variant={theme.outlineButtonVariant || 'outline'}
            size="xs"
            icon={GiPocketWatch}
            onClick={() => patch(clearZeroClock(state))}
            disabled={state.clock === 0}
          >
            清空
          </JRPGButton>
          <JRPGButton
            variant="primary"
            size="xs"
            icon={GiSparkles}
            onClick={doUnleash}
            disabled={!gate.ok}
          >
            施展
          </JRPGButton>
        </div>

        <p className="text-[10px] leading-relaxed" style={{ color: gate.ok ? theme.accent : theme.textMuted }}>
          {gate.ok ? '命刻全滿，可執行技能動作施展底力效果（每回合一次）。' : gate.reason}
        </p>
      </div>
    );
  }

  // ───────────────────────────────────────────── 建角模式
  return (
    <div className="space-y-3" data-testid="zero-power-block">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <label className="text-xs font-bold" style={{ color: theme.textDark }}>
          底力技
        </label>
        <span className="text-[10px]" style={{ color: theme.textMuted }}>
          {ZERO_POWER_SOURCE}　選用規則
        </span>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
        從七個觸發與十一個效果中各選一個。整團不得有兩名以上角色擁有相同的觸發，也不得有兩名以上擁有相同的效果。
      </p>

      {/* 名字（p.128–129 命名表） */}
      <div className="space-y-1.5">
        <JRPGInput
          label="底力技名稱"
          value={state.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="例：王家之刃"
          theme={theme}
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px]" style={{ color: theme.textMuted }}>動作</span>
          {ZERO_NAME_ACTIONS.columns.map((col, i) => (
            <button
              key={col}
              type="button"
              onClick={() => setNameColumn(i)}
              className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer"
              style={{
                backgroundColor: nameColumn === i ? theme.accentSoft || theme.subpanelBg : 'transparent',
                borderColor: nameColumn === i ? theme.accent : theme.border,
                color: theme.textDark
              }}
            >
              {col}
            </button>
          ))}
          <span className="text-[10px] ml-1" style={{ color: theme.textMuted }}>由來</span>
          {ZERO_NAME_ORIGINS.columns.map((col, i) => (
            <button
              key={col}
              type="button"
              onClick={() => setOriginColumn(i)}
              className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer"
              style={{
                backgroundColor: originColumn === i ? theme.accentSoft || theme.subpanelBg : 'transparent',
                borderColor: originColumn === i ? theme.accent : theme.border,
                color: theme.textDark
              }}
            >
              {col}
            </button>
          ))}
          <JRPGButton
            variant={theme.outlineButtonVariant || 'outline'}
            size="xs"
            icon={GiRollingDices}
            onClick={() => {
              const actionRoll = 1 + Math.floor(Math.random() * ZERO_NAME_ACTIONS.rows.length);
              const originRoll = 1 + Math.floor(Math.random() * ZERO_NAME_ORIGINS.rows.length);
              const rolled = generateZeroPowerName({
                actionRoll,
                actionColumn: nameColumn,
                originRoll,
                originColumn
              });
              setLastRoll(rolled);
              patch({ name: rolled.name });
            }}
          >
            骰出名字
          </JRPGButton>
        </div>
        {lastRoll ? (
          <p className="text-[10px] font-mono" style={{ color: theme.textMuted }}>
            {`動作 ${lastRoll.action}・由來 ${lastRoll.origin}`}
          </p>
        ) : null}
      </div>

      {/* 觸發 */}
      {state.variant === 'awakened' && !state.awakened ? (
        <div className="rounded-lg border px-2.5 py-2 space-y-1" style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}>
          <span className="block text-[11px] font-bold" style={{ color: theme.textDark }}>觸發</span>
          <p className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
            覺醒之力建角時不選觸發——觸發在覺醒當下才選定，所以這裡留白是正確狀態，不是漏填。
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>觸發</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ZERO_TRIGGERS.map((t) => {
              const holder = taken.triggers.get(t.id);
              return (
                <ChoiceChip
                  key={t.id}
                  theme={theme}
                  active={state.triggerId === t.id}
                  disabled={Boolean(holder) && state.triggerId !== t.id}
                  title={t.name}
                  subtitle={holder ? `隊友已選：${holder}` : (t.fill === 'varies' ? '變動格數' : `每次 ${t.fill} 格`)}
                  onClick={() => patch({ triggerId: state.triggerId === t.id ? '' : t.id })}
                />
              );
            })}
          </div>
          {trigger ? (
            <p className="text-[11px] leading-relaxed rounded-lg border px-2.5 py-2" style={{ color: theme.textDark, borderColor: theme.border, backgroundColor: theme.cardBg }}>
              {renderTextWithAffinities(trigger.desc)}
            </p>
          ) : null}
        </div>
      )}

      {/* 觸發．愛的綁定 */}
      {state.triggerId === 'love' ? (
        <div className="space-y-1">
          <label className="text-[11px] font-bold" style={{ color: theme.textDark }}>你所愛的玩家角色</label>
          <select
            className={inputClass}
            style={inputStyle}
            value={state.loveTargetId}
            onChange={(e) => patch({ loveTargetId: e.target.value })}
          >
            <option value="">尚未選擇</option>
            {roster
              .filter((c) => c && c.id && c.id !== (character && character.id))
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
          </select>
        </div>
      ) : null}

      {/* 效果（合體之力：效果在配對上，不在角色上） */}
      {combined ? (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>
            合體配對（每個其他玩家角色各一組）
          </span>
          {state.combinedPairs.map((pair, index) => (
            <div key={`pair-${index}`} className="flex items-center gap-1.5 flex-wrap">
              <select
                className={inputClass}
                style={inputStyle}
                value={pair.partnerId}
                onChange={(e) => updatePair(index, { partnerId: e.target.value })}
              >
                <option value="">選擇伙伴</option>
                {roster
                  .filter((c) => c && c.id && c.id !== (character && character.id))
                  .filter((c) => !state.combinedPairs.some((q, j) => j !== index && q.partnerId === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.id}</option>
                  ))}
              </select>
              <select
                className={inputClass}
                style={inputStyle}
                value={pair.effectId}
                onChange={(e) => updatePair(index, { effectId: e.target.value })}
              >
                <option value="">選擇效果</option>
                {ZERO_EFFECTS.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                style={inputStyle}
                value={pair.nickname}
                placeholder="這一招的別稱"
                onChange={(e) => updatePair(index, { nickname: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removePair(index)}
                className="text-[11px] px-2 py-0.5 rounded border cursor-pointer"
                style={{ borderColor: theme.border, color: theme.textMuted, backgroundColor: theme.cardBg }}
              >
                移除
              </button>
            </div>
          ))}
          <JRPGButton
            variant={theme.outlineButtonVariant || 'outline'}
            size="xs"
            icon={GiSparkles}
            onClick={addPair}
            disabled={state.combinedPairs.length >= Math.max(1, roster.length - 1)}
          >
            新增配對
          </JRPGButton>
          <p className="text-[10px] leading-relaxed" style={{ color: theme.textMuted }}>
            四人團＝每人三組配對、全團共六個效果；效果允許重複，觸發仍應盡量不同。
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>效果</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ZERO_EFFECTS.map((e) => {
              const holder = taken.effects.get(e.id);
              return (
                <ChoiceChip
                  key={e.id}
                  theme={theme}
                  active={state.effectId === e.id}
                  disabled={Boolean(holder) && state.effectId !== e.id}
                  title={e.name}
                  subtitle={holder ? `隊友已選：${holder}` : '底力效果'}
                  onClick={() => patch({ effectId: state.effectId === e.id ? '' : e.id })}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 效果的必要選擇（合體之力的選擇在施展當下確認，故不在此列） */}
      {!combined && state.effectId === 'elements' ? (
        <div className="space-y-1">
          <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>
            選定兩種傷害類型（施展時再從這兩種中選一種）
          </span>
          <div className="flex flex-wrap gap-1">
            {ZERO_DAMAGE_TYPES.map((type) => {
              const picked = state.choices.damagePair.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const cur = state.choices.damagePair;
                    const next = picked ? cur.filter((x) => x !== type) : [...cur, type].slice(-2);
                    patch({ choices: { ...state.choices, damagePair: next } });
                  }}
                  className="text-[11px] px-2 py-0.5 rounded border cursor-pointer"
                  style={{
                    backgroundColor: picked ? theme.accentSoft || theme.subpanelBg : theme.cardBg,
                    borderColor: picked ? theme.accent : theme.border,
                    color: theme.textDark
                  }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!combined && state.effectId === 'scourge' ? (
        <div className="space-y-1.5">
          <div className="space-y-1">
            <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>選定一種傷害類型</span>
            <div className="flex flex-wrap gap-1">
              {ZERO_DAMAGE_TYPES.map((type) => {
                const picked = state.choices.damageType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => patch({ choices: { ...state.choices, damageType: picked ? '' : type } })}
                    className="text-[11px] px-2 py-0.5 rounded border cursor-pointer"
                    style={{
                      backgroundColor: picked ? theme.accentSoft || theme.subpanelBg : theme.cardBg,
                      borderColor: picked ? theme.accent : theme.border,
                      color: theme.textDark
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>選定兩種狀態效果</span>
            <div className="flex flex-wrap gap-1">
              {ZERO_STATUS_EFFECTS.map((status) => {
                const picked = state.choices.statuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      const cur = state.choices.statuses;
                      const next = picked ? cur.filter((x) => x !== status) : [...cur, status].slice(-2);
                      patch({ choices: { ...state.choices, statuses: next } });
                    }}
                    className="text-[11px] px-2 py-0.5 rounded border cursor-pointer"
                    style={{
                      backgroundColor: picked ? theme.accentSoft || theme.subpanelBg : theme.cardBg,
                      borderColor: picked ? theme.accent : theme.border,
                      color: theme.textDark
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {effect ? (
        <p className="text-[11px] leading-relaxed rounded-lg border px-2.5 py-2" style={{ color: theme.textDark, borderColor: theme.border, backgroundColor: theme.cardBg }}>
          {renderTextWithAffinities(effect.desc)}
        </p>
      ) : null}

      {/* 變體規則 */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>變體規則</span>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => patch({ variant: '', awakened: false, combinedPairs: [] })}
            className="text-[11px] px-2 py-0.5 rounded border cursor-pointer"
            style={{
              backgroundColor: state.variant === '' ? theme.accentSoft || theme.subpanelBg : theme.cardBg,
              borderColor: state.variant === '' ? theme.accent : theme.border,
              color: theme.textDark
            }}
          >
            不使用
          </button>
          {ZERO_VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => patch({ variant: v.id })}
              className="text-[11px] px-2 py-0.5 rounded border cursor-pointer"
              style={{
                backgroundColor: state.variant === v.id ? theme.accentSoft || theme.subpanelBg : theme.cardBg,
                borderColor: state.variant === v.id ? theme.accent : theme.border,
                color: theme.textDark
              }}
            >
              {v.name}
            </button>
          ))}
        </div>
        {state.variant ? (
          <p className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
            {ZERO_VARIANTS.find((v) => v.id === state.variant)?.desc}
          </p>
        ) : null}
        {state.variant === 'awakened' ? (
          state.awakened ? (
            <p className="text-[11px] leading-relaxed" style={{ color: theme.textDark }}>
              已覺醒（每次戰役一次）：觸發已選定，可正常累積與施展。
            </p>
          ) : awakenArea()
        ) : null}
        {state.variant === 'combined' ? (
          <div className="space-y-1">
            <p className="text-[10px]" style={{ color: theme.textMuted }}>
              合體之力下命刻只有 {max} 格；效果由配對共用，雙方命刻皆滿才能施展，施展後兩邊一起清空。
              {state.combinedPairs.length > 0 ? `目前已設定 ${state.combinedPairs.length} 組配對。` : ''}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
