/**
 * 魔晶石面板（Technosphere Panel）—— 建角第 4 步「裝備配置」的**裝載**那一半
 *
 * 科技奇幻手冊 p.132–145 的選用規則。它與金手指、定制武器那種「多一批選項」不同：
 * 它**換掉整套裝備制度**（官方武器表與盾牌整份不可用），所以它住在建角第 4 步
 * 「裝備配置」裡，而不是第 5 步的特質區。
 *
 * ## 2026-10-22 拆一半：成長搬去第 2 步
 *
 * 原書把職業魔石切成兩個獨立的決定，它們分屬兩個步驟：
 *
 * | 決定 | 原文 | 現在在哪 |
 * |---|---|---|
 * | 投等級、分配技能 | p.134「invest 1 level into **an Innate Class or into a mnemosphere**」；p.135「**just as with standard Class advancement**」 | `MnemosphereSection`（第 2 步） |
 * | 塞進哪個插槽 | p.135「**As long as** … **equipped** … **As soon as the item is unequipped, they lose all of its benefits**」 | **本檔**（第 4 步） |
 *
 * 拆之前整塊都在第 4 步，後果是 `skillLevelCeiling` 跨步驟斷裂——玩家在第 2 步
 * 分配起始等級時看到的技能上限不含魔石，跳到第 4 步裝上才變，**同一個數字兩個答案**。
 *
 * ## 這個面板只做三件事
 *
 * ① **職業魔石（唯讀摘要）**：只顯示「有哪些魔石可以裝」。等級、技能、精通英雄技能
 *    全部在第 2 步設定——這裡**不提供任何修改入口**。兩邊都能改等級，遲早出現
 *    「卡片寫 3 級、引擎算 2 級」這種沒人查得出來的漂移。
 * ② **插槽品級**：每個裝備位一件物品可以掛 α／β／γ／δ 四種插槽（δ 只限武器），
 *    價格與容量見 `data/technospheres.js` 的 `SLOT_QUALITIES`。
 * ③ **插槽內容**：職業魔石與附魔魔石都塞進插槽。職業魔石要「裝備著」才會提供技能
 *    （p.136），所以「沒裝上去的魔石」是看得到、但沒有效果的東西——面板會把它標出來。
 *    **「未裝載」的警告屬於這一格**：第 2 步管成長，在那裡亮警告等於把正常狀態說成錯誤。
 *
 * ## 視覺：珠子嵌進珠座
 *
 * 這套規則的動詞是**鑲嵌**，所以插槽畫成一排**珠座**（`TechnosphereBead`／
 * `EmptyBeadSocket`）：珠子是圓的、有等級環與高光，空位是虛線凹槽。
 * 職業魔石用該職業自己的 gi 圖示（`GameIcon` 查 `CLASS_METADATA`）；
 * 附魔魔石 36 顆不可能各給一個圖示，統一用一顆泛指晶石，靠傷害屬性上色區分。
 *
 * ## 為什麼不自己算任何數值
 *
 * 容量、花費、合法性全部呼叫 `data/technospheres.js`——`computeSlotUsage`、
 * `listHoplosphereEffects`、`getTechnosphereEquipmentSpend`、`validateTechnosphereState`。
 * 面板只負責把狀態改一改然後交出去。這樣創角清單（`validateCharacter`）、
 * 預算條（`CharacterEditor`）與面板看到的是同一份判定。
 */
import React, { useMemo, useState } from 'react';
import { GiCrystalShine, GiCutDiamond, GiOrbWand } from 'react-icons/gi';
import { getCharacterLevel } from '../utils/characterEngine';
import { resolveCreationRules } from '../data/creationRules';
import TechnosphereBead, { EmptyBeadSocket } from './TechnosphereBead';
import {
  HOPLOSPHERES,
  HOPLOSPHERE_PRICE,
  MNEMOSPHERE_MAX_LEVEL,
  SLOT_QUALITIES,
  TECHNOSPHERE_MODES,
  computeSlotUsage,
  getAvailableSlotQualities,
  getHoplosphere,
  getHoplosphereBeadTint,
  getIntegratedMnemosphereCap,
  getMnemosphereBeadTint,
  getTechnosphereEquipmentSpend,
  isTechnosphereEnabled,
  listHoplosphereEffects,
  modeAllowsDeltaSlot,
  modeHasHoplospheres,
  modeHasMnemospheres,
  modeRestrictsEquipment,
  modeUsesIntegratedCarrier,
  normalizeTechnosphereState,
  slotQualityMnemosphereCap,
  slotSupportsQuality
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

/** 凝聚等級 → 珠座徽記用的菱形記號（dingbat，非 emoji） */
const TIER_MARK = { base: '◆', coag2: '◆◆', coag3: '◆◆◆' };
const TIER_LABEL = { base: '', coag2: '凝聚 2：', coag3: '凝聚 3：' };

export default function TechnospherePanel({ character, theme = {}, disabled = false, onChange }) {
  const rules = resolveCreationRules(character?.creationRules);
  const mode = rules.technospheres;
  const [pendingHoplosphere, setPendingHoplosphere] = useState({});
  const [pendingIntegrated, setPendingIntegrated] = useState('');

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
  const integratedCap = getIntegratedMnemosphereCap(level);

  /** 把新的魔晶石狀態寫回角色。`meta` 讓成長履歷留下「動了什麼」。 */
  const commit = (patch, meta = null) => {
    onChange({ ...state, ...patch }, meta);
  };

  const updateSlot = (slotId, patch, meta = null) => {
    const current = state.slots[slotId] || emptySlot();
    commit({ slots: { ...state.slots, [slotId]: { ...current, ...patch } } }, meta);
  };

  const addHoplosphere = (slotId, key) => {
    if (!key) return;
    const current = state.slots[slotId] || emptySlot();
    const sphere = getHoplosphere(key);
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

  const embedIntegrated = (id) => {
    if (!id) return;
    if (state.integrated.includes(id)) return;
    if (state.integrated.length >= integratedCap) return;
    setPendingIntegrated('');
    commit({ integrated: [...state.integrated, id] }, {
      kind: 'technosphere',
      title: `內嵌職業魔石：${state.mnemospheres.find((m) => m.id === id)?.className || id}`
    });
  };

  const unembedIntegrated = (id) => {
    commit({ integrated: state.integrated.filter((x) => x !== id) });
  };

  const equippedMnemosphereIds = new Set([
    ...Object.keys(state.slots).flatMap((slotId) => state.slots[slotId].contents
      .filter((c) => c.kind === 'mnemosphere')
      .map((c) => c.ref)),
    ...state.integrated
  ]);
  const idleMnemospheres = state.mnemospheres.filter((m) => !equippedMnemosphereIds.has(m.id));

  const inputClass = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border font-bold';
  const inputStyle = { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark };
  const smallBtn = 'px-2 py-0.5 rounded border text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const miniSelect = 'rounded-lg px-1.5 py-0.5 text-[10px] outline-none border font-bold max-w-[13rem]';

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

        {/* ── 職業魔石（唯讀摘要）─────────────────────────────
            等級、技能、精通英雄技能全部在創角第 2 步「職業與技能」設定。
            p.134 說升級點是「投進固有職業**或**職業魔石」，那是成長，不是裝備；
            p.135 才說「裝備著才生效」，那才是這一格的事。
            這裡刻意**不提供任何修改入口**——兩邊都能改等級，遲早出現
            「卡片寫 3 級、引擎算 2 級」這種沒人查得出來的漂移。 */}
        {withMnemospheres && state.mnemospheres.length > 0 && (
          <div
            className="rounded-lg border px-2 py-1.5 space-y-1"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            data-testid="mnemosphere-summary"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap" style={{ color: theme.textDark }}>
              <GiOrbWand className="w-3.5 h-3.5" style={{ color: theme.accent }} />
              職業魔石
              <span className="font-normal" style={{ color: theme.textMuted }}>
                {state.mnemospheres.length} 顆——等級與技能在第 2 步「職業與技能」設定
              </span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {state.mnemospheres.map((m) => (
                <span key={`summary_${m.id}`} className="inline-flex items-center gap-1">
                  <TechnosphereBead
                    iconName={m.className}
                    tint={getMnemosphereBeadTint(m.className)}
                    level={m.level}
                    dim={!equippedMnemosphereIds.has(m.id)}
                    size={26}
                    title={`${m.className}　${m.level} / ${MNEMOSPHERE_MAX_LEVEL} 級`}
                    testId={`bead-summary-${m.id}`}
                  />
                  <span className="text-[10px] font-bold" style={{ color: theme.textDark }}>
                    {m.className} {m.level} 級
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {withMnemospheres && state.mnemospheres.length === 0 && (
          <p className="text-t12 italic" style={{ color: theme.textMuted }} data-testid="mnemosphere-empty">
            尚未取得職業魔石。開局免費一顆 1 級魔石在創角第 2 步「職業與技能」選定（p.134）。
          </p>
        )}

        {/* 「未裝載」的警告留在這一格，不留在第 2 步——因為 p.136 的條件是
            「裝備著才生效」，而第 2 步管的是成長。玩家在投點時魔石本來就多半沒裝上，
            在那裡亮警告等於把正常狀態說成錯誤。 */}
        {withMnemospheres && idleMnemospheres.length > 0 && (
          <p className="text-t12 leading-relaxed text-[#6b5a4b]" data-testid="idle-mnemosphere-warning">
            有 {idleMnemospheres.length} 顆職業魔石沒有裝在任何插槽上——未裝備的魔石不提供任何技能（p.136）。
          </p>
        )}

        {/* ── 內嵌裝置（integrated 變體）────────────────────── */}
        {integrated && (
          <div
            className="rounded-lg border px-2 py-1.5 space-y-1.5"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            data-testid="integrated-carrier"
          >
            <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>
              內嵌裝置
              <span className="font-normal ml-1.5" style={{ color: theme.textMuted }}>
                可容納 {integratedCap} 顆職業魔石（1 ＋ 每 15 級 1 顆；目前 {state.integrated.length} 顆）
              </span>
            </span>
            <p className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
              這一變體把職業魔石改掛在裝置或護腕上，裝備插槽只放附魔魔石，且不能使用 δ 品級。
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {state.integrated.map((id) => {
                const m = state.mnemospheres.find((x) => x.id === id);
                return (
                  <span key={`integrated_${id}`} className="inline-flex items-center gap-0.5">
                    <TechnosphereBead
                      iconName={m?.className}
                      tint={getMnemosphereBeadTint(m?.className)}
                      level={m?.level || 0}
                      size={30}
                      title={m ? `${m.className}　${m.level} 級（內嵌）` : id}
                      testId={`bead-integrated-${id}`}
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => unembedIntegrated(id)}
                      className="cursor-pointer text-[10px] disabled:opacity-40"
                      style={{ color: '#8c2d36' }}
                      title="從內嵌裝置取下"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
              {Array.from({ length: Math.max(0, integratedCap - state.integrated.length) }).map((_, i) => (
                <EmptyBeadSocket key={`integrated_empty_${i}`} size={30} />
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <select
                value={pendingIntegrated}
                disabled={disabled || state.integrated.length >= integratedCap}
                onChange={(e) => setPendingIntegrated(e.target.value)}
                className={miniSelect}
                style={inputStyle}
                data-testid="integrated-picker"
              >
                <option value="">選擇要內嵌的魔石</option>
                {state.mnemospheres
                  .filter((m) => !state.integrated.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.className} {m.level} 級</option>
                  ))}
              </select>
              <button
                type="button"
                disabled={disabled || !pendingIntegrated}
                onClick={() => embedIntegrated(pendingIntegrated)}
                className={smallBtn}
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
              >
                嵌入
              </button>
            </div>
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
              const canSocket = slotSupportsQuality(slotId);
              const slot = state.slots[slotId] || emptySlot();
              const qualityOptions = getAvailableSlotQualities(mode)
                .filter((q) => !q.weaponOnly || WEAPON_SLOT_KEYS.includes(slotId));
              const usage = computeSlotUsage(slot, state.mnemospheres);
              const pending = pendingHoplosphere[slotId] || '';
              const { entries: effectEntries, damageTypeConflicts } = listHoplosphereEffects(slot.contents);
              const emptySockets = canSocket ? Math.max(0, usage.remaining) : 0;
              return (
                <div
                  key={slotId}
                  className="rounded-lg border px-2 py-1.5 space-y-1"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                  data-testid={`slot-${slotId}`}
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
                        disabled={disabled || !hasItem || !canSocket}
                        onChange={(e) => updateSlot(slotId, { quality: e.target.value }, {
                          kind: 'technosphere',
                          title: `插槽品級：${label} → ${e.target.value}`
                        })}
                        className="rounded-lg px-1.5 py-0.5 text-[10px] outline-none border font-bold"
                        style={inputStyle}
                        data-testid={`quality-${slotId}`}
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

                  {!canSocket && (
                    <p className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
                      只有自訂武器與自訂防具可以有魔石插槽；飾品與機師模組沒有（p.133）。
                    </p>
                  )}

                  {hasItem && canSocket && (
                    <>
                      {/* 珠座：一排凹槽，已鑲的珠子躺在裡面，沒鑲的是虛線空位 */}
                      <div className="flex items-center gap-1.5 flex-wrap" data-testid={`sockets-${slotId}`}>
                        {slot.contents.length === 0 && emptySockets === 0 ? (
                          <span className="text-[10px] italic" style={{ color: theme.textMuted }}>插槽是空的</span>
                        ) : null}
                        {slot.contents.map((entry, index) => {
                          const mnemosphere = entry.kind === 'mnemosphere'
                            ? state.mnemospheres.find((m) => m.id === entry.ref)
                            : null;
                          const hop = entry.kind === 'hoplosphere' ? getHoplosphere(entry.ref) : null;
                          const beadLabel = entry.kind === 'mnemosphere'
                            ? (mnemosphere?.className || entry.ref)
                            : (hop?.name || entry.ref);
                          const cost = entry.kind === 'mnemosphere' ? 0 : HOPLOSPHERE_PRICE;
                          const tint = entry.kind === 'mnemosphere'
                            ? getMnemosphereBeadTint(mnemosphere?.className)
                            : getHoplosphereBeadTint(hop);
                          return (
                            <span key={`${slotId}_${entry.kind}_${entry.ref}_${index}`} className="relative inline-flex items-start">
                              <TechnosphereBead
                                iconName={entry.kind === 'mnemosphere' ? mnemosphere?.className : null}
                                iconComponent={entry.kind === 'hoplosphere' ? GiCrystalShine : null}
                                tint={tint}
                                level={entry.kind === 'mnemosphere' ? (mnemosphere?.level || 0) : 0}
                                maxLevel={entry.kind === 'mnemosphere' ? MNEMOSPHERE_MAX_LEVEL : 1}
                                size={30}
                                badge={hop ? String(hop.slots) : null}
                                title={[
                                  beadLabel,
                                  cost > 0 ? `${cost}z` : null,
                                  hop ? `${hop.slots} 格` : null,
                                  hop?.damageType ? `${hop.damageType}屬性` : null,
                                  hop?.effect || null
                                ].filter(Boolean).join('｜')}
                                testId={`bead-socket-${slotId}-${index}`}
                              />
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => removeContent(slotId, index)}
                                className="absolute -bottom-0.5 -right-0.5 cursor-pointer text-t12 leading-none disabled:opacity-40"
                                style={{ color: '#8c2d36' }}
                                title="從插槽取下"
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                        {Array.from({ length: emptySockets }).map((_, i) => (
                          <EmptyBeadSocket key={`${slotId}_empty_${i}`} size={30} label={String(slot.contents.length + i + 1)} />
                        ))}
                      </div>

                      {/* 逐筆效果：原書 p.139 的寫法就是逐顆、逐凝聚各算一筆 */}
                      {effectEntries.length > 0 && (
                        <ul
                          className="text-[10px] leading-relaxed space-y-0.5 pl-1"
                          style={{ color: theme.textMuted }}
                          data-testid={`hoplosphere-effects-${slotId}`}
                        >
                          {effectEntries.map((eff, i) => (
                            <li key={`${slotId}_eff_${i}`} className="flex items-start gap-1">
                              <span className="shrink-0 font-bold" style={{ color: eff.tier === 'base' ? theme.textMuted : theme.accent }}>
                                {TIER_MARK[eff.tier]}
                              </span>
                              <span>
                                <span className="font-bold" style={{ color: theme.textDark }}>【{eff.name}】</span>
                                {TIER_LABEL[eff.tier]}
                                {eff.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {damageTypeConflicts.length > 1 && (
                        <p className="text-t12 text-[#6b5a4b]">
                          同一把武器不能混用不同傷害屬性的附魔魔石（目前混了：{damageTypeConflicts.join('、')}，p.141）。
                        </p>
                      )}

                      <div className="flex items-center gap-1 flex-wrap">
                        {withHoplospheres && (
                          <>
                            <select
                              value={pending}
                              disabled={disabled}
                              onChange={(e) => setPendingHoplosphere((prev) => ({ ...prev, [slotId]: e.target.value }))}
                              className={miniSelect}
                              style={inputStyle}
                              data-testid={`hoplosphere-picker-${slotId}`}
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
                            className={miniSelect}
                            style={inputStyle}
                            data-testid={`mnemosphere-picker-${slotId}`}
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
                        <p className="text-t12 text-[#6b5a4b]">
                          這個品級最多裝 {slotQualityMnemosphereCap(slot.quality)} 顆職業魔石。
                        </p>
                      )}
                      {usage.overflow && (
                        <p className="text-t12 text-[#6b5a4b]">
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