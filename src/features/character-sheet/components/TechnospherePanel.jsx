/**
 * 魔晶石面板（Technosphere Panel）
 *
 * 科技奇幻手冊 p.132–145 的選用規則。它與金手指、定制武器那種「多一批選項」不同：
 * 它**換掉整套裝備制度**（官方武器表與盾牌整份不可用），所以它住在建角第 4 步
 * 「裝備配置」裡，而不是第 5 步的特質區。
 *
 * ## 這個面板只做三件事
 *
 * ① **職業魔石**：角色持有的魔石清單。每顆有職業、等級（上限 5）與它提供的技能；
 *    5 級＝精通，要挑一個英雄技能。這裡**不**替玩家選技能——建角時一顆都沒有，
 *    與四維屬性、羈絆、金手指、底力技同一個原則。
 * ② **插槽品級**：每個裝備位一件物品可以掛 α／β／γ／δ 四種插槽（δ 只限武器），
 *    價格與容量見 `data/technospheres.js` 的 `SLOT_QUALITIES`。
 * ③ **插槽內容**：職業魔石與附魔魔石都塞進插槽。職業魔石要「裝備著」才會提供技能
 *    （p.136），所以「沒裝上去的魔石」是看得到、但沒有效果的東西——面板會把它標出來。
 *
 * ## 為什麼不自己算任何數值
 *
 * 容量、花費、合法性全部呼叫 `data/technospheres.js`——`computeSlotUsage`、
 * `getTechnosphereEquipmentSpend`、`validateTechnosphereState`。
 * 面板只負責把狀態改一改然後交出去。這樣創角清單（`validateCharacter`）、
 * 預算條（`CharacterEditor`）與面板看到的是同一份判定。
 */
import React, { useMemo, useState } from 'react';
import { GiCrystalShine, GiCutDiamond, GiOrbWand } from 'react-icons/gi';
import { heroicSkillsForClass, getCharacterLevel } from '../utils/characterEngine';
import { resolveCreationRules } from '../data/creationRules';
import {
  HOPLOSPHERES,
  HOPLOSPHERE_PRICE,
  MNEMOSPHERE_CLASSES,
  MNEMOSPHERE_MAX_LEVEL,
  MNEMOSPHERE_MASTERY_LEVEL,
  SLOT_QUALITIES,
  TECHNOSPHERE_MODES,
  computeSlotUsage,
  createMnemosphere,
  getAvailableSlotQualities,
  getIntegratedMnemosphereCap,
  getTechnosphereEquipmentSpend,
  isTechnosphereEnabled,
  modeAllowsDeltaSlot,
  modeHasHoplospheres,
  modeHasMnemospheres,
  modeRestrictsEquipment,
  modeUsesIntegratedCarrier,
  normalizeTechnosphereState,
  slotQualityMnemosphereCap
} from '../data/technospheres';

/** 四個裝備位（與 `equipmentRules.js` 的 `EQUIPMENT_SLOTS` 同一組鍵） */
const EQUIP_SLOTS = [
  { key: 'mainHand', label: '主手' },
  { key: 'offHand', label: '副手' },
  { key: 'armor', label: '防具' },
  { key: 'accessory', label: '飾品' }
];

/** 只有武器（主手／副手）能掛 δ 品級插槽（p.133：「Slot δ … weapons only」） */
const WEAPON_SLOT_KEYS = ['mainHand', 'offHand'];

const emptySlot = () => ({ quality: 'alpha', contents: [] });

export default function TechnospherePanel({ character, theme = {}, disabled = false, onChange }) {
  const rules = resolveCreationRules(character?.creationRules);
  const mode = rules.technospheres;
  const [pendingClass, setPendingClass] = useState('');
  const [pendingHoplosphere, setPendingHoplosphere] = useState({});

  const level = getCharacterLevel(character);
  const state = useMemo(
    () => normalizeTechnosphereState(character?.technospheres),
    [character?.technospheres]
  );

  // 規則沒開就整個區塊不存在——這不是「隱藏」，是這張卡沒有這套制度。
  if (!isTechnosphereEnabled(mode)) return null;

  const modeDef = TECHNOSPHERE_MODES[mode] || TECHNOSPHERE_MODES.full;
  const withMnemospheres = modeHasMnemospheres(mode);
  const withHoplospheres = modeHasHoplospheres(mode);
  const integrated = modeUsesIntegratedCarrier(mode);
  const spend = getTechnosphereEquipmentSpend(state);

  /** 把新的魔晶石狀態寫回角色。`meta` 讓成長履歷留下「動了什麼」。 */
  const commit = (patch, meta = null) => {
    onChange({ ...state, ...patch }, meta);
  };

  const addMnemosphere = () => {
    if (!pendingClass) return;
    const next = [...state.mnemospheres, createMnemosphere({ className: pendingClass })];
    setPendingClass('');
    commit({ mnemospheres: next }, {
      kind: 'technosphere',
      title: `取得職業魔石：${pendingClass}`
    });
  };

  const removeMnemosphere = (id) => {
    const target = state.mnemospheres.find((m) => m.id === id);
    const mnemospheres = state.mnemospheres.filter((m) => m.id !== id);
    // 同時把它從所有插槽裡拔掉，否則插槽會指向一顆已經不存在的魔石。
    const slots = {};
    Object.keys(state.slots).forEach((slotId) => {
      slots[slotId] = {
        ...state.slots[slotId],
        contents: state.slots[slotId].contents
          .filter((c) => !(c.kind === 'mnemosphere' && c.ref === id))
      };
    });
    commit({ mnemospheres, slots }, {
      kind: 'technosphere',
      title: `失去職業魔石：${target?.className || id}`
    });
  };

  const raiseMnemosphere = (id) => {
    const target = state.mnemospheres.find((m) => m.id === id);
    if (!target || target.level >= MNEMOSPHERE_MAX_LEVEL) return;
    const mnemospheres = state.mnemospheres.map((m) => (
      m.id === id ? { ...m, level: m.level + 1 } : m
    ));
    commit({ mnemospheres }, {
      kind: 'technosphere',
      title: `職業魔石升級：${target.className} → ${target.level + 1} 級`
    });
  };

  const lowerMnemosphere = (id) => {
    const target = state.mnemospheres.find((m) => m.id === id);
    if (!target || target.level <= 1) return;
    const mnemospheres = state.mnemospheres.map((m) => (
      m.id === id ? { ...m, level: m.level - 1 } : m
    ));
    commit({ mnemospheres });
  };

  const setHeroicSkill = (id, heroicSkill) => {
    const mnemospheres = state.mnemospheres.map((m) => (
      m.id === id ? { ...m, heroicSkill } : m
    ));
    commit({ mnemospheres }, heroicSkill
      ? { kind: 'technosphere', title: `職業魔石精通：${heroicSkill}` }
      : null);
  };

  const updateSlot = (slotId, patch, meta = null) => {
    const current = state.slots[slotId] || emptySlot();
    commit({ slots: { ...state.slots, [slotId]: { ...current, ...patch } } }, meta);
  };

  const addHoplosphere = (slotId, key) => {
    if (!key) return;
    const current = state.slots[slotId] || emptySlot();
    const sphere = HOPLOSPHERES.find((h) => h.key === key);
    updateSlot(slotId, {
      contents: [...current.contents, { kind: 'hoplosphere', ref: key }]
    }, {
      kind: 'technosphere',
      title: `鑲嵌附魔魔石：${sphere?.name || key}`
    });
    setPendingHoplosphere((prev) => ({ ...prev, [slotId]: '' }));
  };

  const removeContent = (slotId, index) => {
    const current = state.slots[slotId] || emptySlot();
    updateSlot(slotId, { contents: current.contents.filter((_, i) => i !== index) });
  };

  const attachMnemosphere = (slotId, id) => {
    if (!id) return;
    const current = state.slots[slotId] || emptySlot();
    updateSlot(slotId, {
      contents: [...current.contents, { kind: 'mnemosphere', ref: id }]
    }, {
      kind: 'technosphere',
      title: `裝備職業魔石：${state.mnemospheres.find((m) => m.id === id)?.className || id}`
    });
  };

  const equippedMnemosphereIds = new Set(
    Object.keys(state.slots).flatMap((slotId) => state.slots[slotId].contents
      .filter((c) => c.kind === 'mnemosphere')
      .map((c) => c.ref))
  );
  const idleMnemospheres = state.mnemospheres.filter((m) => !equippedMnemosphereIds.has(m.id));

  const inputClass = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border font-bold';
  const inputStyle = { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark };
  const smallBtn = 'px-2 py-0.5 rounded border text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      className="rounded-xl border shadow-xs overflow-hidden"
      style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
      data-testid="technosphere-panel"
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b flex-wrap"
        style={{ borderColor: theme.border }}
      >
        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: theme.textDark }}>
          <GiCrystalShine className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
          魔晶石
          <span className="text-[10px] font-normal" style={{ color: theme.textMuted }}>
            {modeDef.label}　{modeDef.short}
          </span>
        </span>
        <span className="font-mono text-[11px] font-bold" style={{ color: theme.accent }}>
          插槽與附魔魔石花費 {spend}z
        </span>
      </div>

      <div className="px-3 py-2.5 space-y-3">
        <p className="text-[10px] leading-relaxed" style={{ color: theme.textMuted }}>
          {modeDef.desc}
          {modeRestrictsEquipment(mode)
            ? '　官方武器表與盾牌整份不可用，只能裝備自訂武器、自訂防具與飾品（p.133）。'
            : null}
        </p>

        {/* ── 職業魔石 ─────────────────────────────────────── */}
        {withMnemospheres && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: theme.textDark }}>
                <GiOrbWand className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                職業魔石
                <span className="font-normal" style={{ color: theme.textMuted }}>
                  {state.mnemospheres.length} 顆，上限 {MNEMOSPHERE_MAX_LEVEL} 級
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <select
                  value={pendingClass}
                  disabled={disabled}
                  onChange={(e) => setPendingClass(e.target.value)}
                  className="rounded-lg px-2 py-1 text-[11px] outline-none border font-bold"
                  style={inputStyle}
                >
                  <option value="">選擇職業</option>
                  {MNEMOSPHERE_CLASSES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={disabled || !pendingClass}
                  onClick={addMnemosphere}
                  className={smallBtn}
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                >
                  取得
                </button>
              </span>
            </div>

            {state.mnemospheres.length === 0 ? (
              <p className="text-[10px] italic" style={{ color: theme.textMuted }}>
                尚未取得任何職業魔石。開局會免費獲得一顆 1 級魔石（p.134），請在這裡選定。
              </p>
            ) : (
              <div className="space-y-1.5">
                {state.mnemospheres.map((m) => {
                  const mastered = m.level >= MNEMOSPHERE_MASTERY_LEVEL;
                  const candidates = mastered ? heroicSkillsForClass(m.className) : [];
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border px-2 py-1.5 space-y-1"
                      style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>
                          {m.className}
                          <span className="font-mono ml-1.5" style={{ color: theme.accent }}>
                            {m.level} / {MNEMOSPHERE_MAX_LEVEL}
                          </span>
                          {mastered && (
                            <span className="ml-1.5 text-[10px] font-bold" style={{ color: theme.accent }}>
                              精通
                            </span>
                          )}
                          {!equippedMnemosphereIds.has(m.id) && (
                            <span className="ml-1.5 text-[10px] font-bold text-amber-700">未裝備（不提供技能）</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={disabled || m.level <= 1}
                            onClick={() => lowerMnemosphere(m.id)}
                            className={smallBtn}
                            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                          >
                            −1
                          </button>
                          <button
                            type="button"
                            disabled={disabled || m.level >= MNEMOSPHERE_MAX_LEVEL}
                            onClick={() => raiseMnemosphere(m.id)}
                            className={smallBtn}
                            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => removeMnemosphere(m.id)}
                            className={smallBtn}
                            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: '#b91c1c' }}
                          >
                            移除
                          </button>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px]" style={{ color: theme.textMuted }}>技能</span>
                        {(m.skills || []).length === 0 ? (
                          <span className="text-[10px] italic" style={{ color: theme.textMuted }}>尚未選技能</span>
                        ) : (
                          (m.skills || []).map((sk, i) => (
                            <span
                              key={`${m.id}_${sk.name}_${i}`}
                              className="text-[10px] px-1.5 py-0.5 rounded border font-bold"
                              style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                            >
                              {sk.name} SL{sk.sl}
                            </span>
                          ))
                        )}
                      </div>
                      {mastered && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] shrink-0" style={{ color: theme.textMuted }}>英雄技能</span>
                          <select
                            value={m.heroicSkill || ''}
                            disabled={disabled}
                            onChange={(e) => setHeroicSkill(m.id, e.target.value)}
                            className="flex-1 min-w-0 rounded-lg px-2 py-0.5 text-[10px] outline-none border font-bold"
                            style={inputStyle}
                          >
                            <option value="">尚未選擇</option>
                            {candidates.map((h) => (
                              <option key={h.name} value={h.name}>{h.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {idleMnemospheres.length > 0 && (
              <p className="text-[10px] leading-relaxed text-amber-700">
                有 {idleMnemospheres.length} 顆職業魔石沒有裝在任何插槽上——未裝備的魔石不提供任何技能（p.136）。
              </p>
            )}
          </div>
        )}

        {/* ── 內嵌裝置 ─────────────────────────────────────── */}
        {integrated && (
          <div className="rounded-lg border px-2 py-1.5" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>
              內嵌裝置
              <span className="font-normal ml-1.5" style={{ color: theme.textMuted }}>
                可容納 {getIntegratedMnemosphereCap(level)} 顆職業魔石（1 ＋ 每 15 級 1 顆）
              </span>
            </span>
            <p className="text-[10px] leading-relaxed mt-1" style={{ color: theme.textMuted }}>
              這一變體把職業魔石改掛在裝置或護腕上，裝備插槽只放附魔魔石，且不能使用 δ 品級。
            </p>
          </div>
        )}

        {/* ── 插槽 ─────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: theme.textDark }}>
            <GiCutDiamond className="w-3.5 h-3.5" style={{ color: theme.accent }} />
            裝備插槽
            <span className="font-normal" style={{ color: theme.textMuted }}>
              品級 α 免費；β {SLOT_QUALITIES.beta.cost}z／γ {SLOT_QUALITIES.gamma.cost}z／δ {SLOT_QUALITIES.delta.cost}z
            </span>
          </span>
          <div className="space-y-1.5">
            {EQUIP_SLOTS.map(({ key: slotId, label }) => {
              const itemName = character?.equipment?.[slotId];
              const hasItem = Boolean(itemName) && itemName !== '無';
              const slot = state.slots[slotId] || emptySlot();
              const qualityOptions = getAvailableSlotQualities(mode)
                .filter((q) => !q.weaponOnly || WEAPON_SLOT_KEYS.includes(slotId));
              const usage = computeSlotUsage(slot, state.mnemospheres);
              const pending = pendingHoplosphere[slotId] || '';
              return (
                <div
                  key={slotId}
                  className="rounded-lg border px-2 py-1.5 space-y-1"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>
                      {label}
                      <span className="font-normal ml-1.5" style={{ color: theme.textMuted }}>
                        {hasItem ? itemName : '未裝備'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <select
                        value={slot.quality}
                        disabled={disabled || !hasItem}
                        onChange={(e) => updateSlot(slotId, { quality: e.target.value }, {
                          kind: 'technosphere',
                          title: `插槽品級：${label} → ${e.target.value}`
                        })}
                        className="rounded-lg px-1.5 py-0.5 text-[10px] outline-none border font-bold"
                        style={inputStyle}
                      >
                        {qualityOptions.map((q) => (
                          <option key={q.key} value={q.key}>
                            {q.label}（{q.cost}z，{q.slots} 格）
                          </option>
                        ))}
                      </select>
                      <span className="font-mono text-[10px]" style={{ color: theme.textMuted }}>
                        {usage.used} / {usage.capacity} 格
                      </span>
                    </span>
                  </div>

                  {hasItem && (
                    <>
                      <div className="flex items-center gap-1 flex-wrap">
                        {slot.contents.length === 0 ? (
                          <span className="text-[10px] italic" style={{ color: theme.textMuted }}>插槽是空的</span>
                        ) : (
                          slot.contents.map((entry, index) => {
                            const label2 = entry.kind === 'mnemosphere'
                              ? `職業魔石 ${state.mnemospheres.find((m) => m.id === entry.ref)?.className || entry.ref}`
                              : (HOPLOSPHERES.find((h) => h.key === entry.ref)?.name || entry.ref);
                            const cost = entry.kind === 'mnemosphere' ? 0 : HOPLOSPHERE_PRICE;
                            return (
                              <span
                                key={`${slotId}_${entry.kind}_${entry.ref}_${index}`}
                                className="text-[10px] px-1.5 py-0.5 rounded border font-bold flex items-center gap-1"
                                style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                              >
                                {entry.kind === 'mnemosphere' ? '◇' : '◆'} {label2}
                                {cost > 0 ? <span style={{ color: theme.textMuted }}>{cost}z</span> : null}
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => removeContent(slotId, index)}
                                  className="cursor-pointer disabled:opacity-40"
                                  style={{ color: '#b91c1c' }}
                                >
                                  ✕
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {withHoplospheres && (
                          <>
                            <select
                              value={pending}
                              disabled={disabled}
                              onChange={(e) => setPendingHoplosphere((prev) => ({ ...prev, [slotId]: e.target.value }))}
                              className="rounded-lg px-1.5 py-0.5 text-[10px] outline-none border font-bold max-w-[13rem]"
                              style={inputStyle}
                            >
                              <option value="">附魔魔石</option>
                              {HOPLOSPHERES.map((h) => (
                                <option key={h.key} value={h.key}>
                                  {h.d66} {h.name}（{h.slots} 格{h.weaponOnly ? '，武器限定' : ''}）
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={disabled || !pending}
                              onClick={() => addHoplosphere(slotId, pending)}
                              className={smallBtn}
                              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                            >
                              鑲嵌
                            </button>
                          </>
                        )}
                        {withMnemospheres && !integrated && (
                          <select
                            value=""
                            disabled={disabled}
                            onChange={(e) => attachMnemosphere(slotId, e.target.value)}
                            className="rounded-lg px-1.5 py-0.5 text-[10px] outline-none border font-bold max-w-[13rem]"
                            style={inputStyle}
                          >
                            <option value="">裝入職業魔石</option>
                            {state.mnemospheres.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.className} {m.level} 級{equippedMnemosphereIds.has(m.id) ? '（已裝備）' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      {usage.mnemosphereOverflow && (
                        <p className="text-[10px] text-amber-700">
                          這個品級最多裝 {slotQualityMnemosphereCap(slot.quality)} 顆職業魔石。
                        </p>
                      )}
                      {usage.overflow && (
                        <p className="text-[10px] text-amber-700">
                          內容佔用超過插槽容量（{usage.used} / {usage.capacity} 格）。
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: theme.textMuted }}>
            {[
              withMnemospheres
                ? '同一件物品不能裝兩顆共享技能的職業魔石；角色也不能裝備「自己已經會那些技能」的魔石（p.135）。'
                : null,
              modeAllowsDeltaSlot(mode) ? null : '這一變體沒有 δ 品級。',
              withHoplospheres ? null : '這一變體沒有附魔魔石。'
            ].filter(Boolean).join('　')}
          </p>
        </div>
      </div>
    </div>
  );
}
