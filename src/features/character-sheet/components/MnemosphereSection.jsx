/**
 * 職業魔石區（建角第 2 步「職業與技能」）
 *
 * ## 為什麼住在第 2 步，而不是跟魔晶石面板一起住第 4 步
 *
 * 因為原書把「職業魔石」切成**兩個獨立的決定**，而它們分屬兩個步驟：
 *
 * | 決定 | 原文 | 步驟 |
 * |---|---|---|
 * | 投等級、分配技能 | p.134「invest 1 level into **an Innate Class or into a mnemosphere**」；p.135「develops a new Skill … **just as with standard Class advancement**」 | 第 2 步 |
 * | 塞進哪個插槽 | p.135「**As long as** … **equipped** … **As soon as the item is unequipped, they lose all of its benefits**」 | 第 4 步 |
 *
 * 第一列說的是**成長**：升級點投給魔石，等同投給職業——成長方式逐字相同
 * （`just as with standard Class advancement`）。那屬於「職業與技能」。
 * 第二列說的是**生效**：練得再高，沒裝上去什麼都不給。那屬於「裝備配置」。
 *
 * ## 這一區只做成長，不做裝載
 *
 * 取得、等級 ±1、技能分配、5 級精通挑英雄技能——全部在這裡。
 * 「裝進哪個插槽」在 `TechnospherePanel`（第 4 步）。**兩邊都不重複對方的操作**：
 * 等級 ±1 只在這裡出現，插槽只在對面出現，否則就是「一個概念兩個來源」。
 *
 * 這裡會顯示每顆魔石的**裝載狀態**，但那是唯讀的，而且用中性色——
 * 不是警告。玩家在第 2 步投點時，魔石本來就多半還沒裝上。
 *
 * ## 為什麼底部要印「技能水準相當於幾級」
 *
 * p.134 的例子是「5 級角色 ＋ 5 級守護者魔石 ＋ 3 級元素師魔石 → 技能水準相當於
 * 13 級角色」。玩家在第 2 步正在分配那 5 個起始等級，他需要當場看到「若把持有的
 * 魔石都裝上，這張卡的技能水準會到哪」——否則他做的是一個殘缺的分配決定。
 *
 * 這個數字由 `calculateCharacterStats` 的 `heldSkillLevelCeiling` 提供，
 * **與實際生效的 `skillLevelCeiling` 是兩個不同的值**，不可互換。
 */
import React, { useMemo, useState } from 'react';
import { GiOrbWand } from 'react-icons/gi';
import {
  classSkillsForClass,
  getCharacterLevel,
  heroicSkillsForClass
} from '../utils/characterEngine';
import { resolveCreationRules } from '../data/creationRules';
import TechnosphereBead, { EmptyBeadSocket } from './TechnosphereBead';
import ClassSkillPickerList from './ClassSkillPickerList';
import {
  MNEMOSPHERE_CLASSES,
  MNEMOSPHERE_MAX_LEVEL,
  MNEMOSPHERE_MASTERY_LEVEL,
  buildInitialMnemosphere,
  createMnemosphere,
  getActiveMnemospheres,
  getHeldMnemospheres,
  getInitialMnemosphereLevels,
  getMnemosphereBeadTint,
  getSkillLevelCeiling,
  isTechnosphereEnabled,
  modeHasMnemospheres,
  normalizeTechnosphereState
} from '../data/technospheres';

export default function MnemosphereSection({ character, theme = {}, disabled = false, onChange }) {
  const rules = resolveCreationRules(character?.creationRules);
  const mode = rules.technospheres;
  const [pendingClass, setPendingClass] = useState('');
  const [adding, setAdding] = useState(false);

  const level = getCharacterLevel(character);
  const state = useMemo(
    () => normalizeTechnosphereState(character?.technospheres),
    [character?.technospheres]
  );

  // 規則沒開就整個區塊不存在——這不是「隱藏」，是這張卡沒有這套制度。
  if (!isTechnosphereEnabled(mode)) return null;
  if (!modeHasMnemospheres(mode)) return null;

  /** 把新的魔晶石狀態寫回角色。`meta` 讓成長履歷留下「動了什麼」。 */
  const commit = (patch, meta = null) => {
    onChange({ ...state, ...patch }, meta);
  };

  /**
   * 取得一顆魔石。
   *
   * 開局那幾顆**不需要玩家按「取得」**——p.134「Each Player Character also receives
   * a level 1 mnemosphere of a Class of their choice upon creation」，選了職業就成立。
   * 第 2 顆以後分兩種：p.140 的高階角色額外魔石（0 級，開卡即有）仍是選了就成立；
   * 只有 p.137 的 GM 獎勵（`TECHNOSPHERES AS REWARDS`）才要明確動作。
   *
   * `grantIndex` 決定「這一顆屬於免費額度的第幾顆」：
   * - 給了索引 → `buildInitialMnemosphere` 依 p.134／p.140 決定等級（第 0 顆 1 級、其餘 0 級）
   * - `null`（GM 獎勵）→ 1 級，與建角那顆一致
   *
   * 等級**不可以留在這裡算**：寫在事件處理器裡就測不到，而這裡正好發生過那個 bug
   * （漏傳等級 → `createMnemosphere` 的預設值 0 生效 → 文案寫 1 級、實際 0 級）。
   */
  const addMnemosphere = (className, grantIndex = null) => {
    const name = className || pendingClass;
    if (!name) return;
    const bead = grantIndex === null
      ? createMnemosphere({ className: name, level: 1 })
      : buildInitialMnemosphere(name, grantIndex);
    const next = [...state.mnemospheres, bead];
    setPendingClass('');
    setAdding(false);
    commit({ mnemospheres: next }, {
      kind: 'technosphere',
      title: `取得職業魔石：${name}`
    });
  };

  const removeMnemosphere = (id) => {
    const target = state.mnemospheres.find((m) => m.id === id);
    const mnemospheres = state.mnemospheres.filter((m) => m.id !== id);
    // 同時把它從所有插槽與內嵌清單裡拔掉，否則它們會指向一顆已經不存在的魔石。
    const slots = {};
    Object.keys(state.slots).forEach((slotId) => {
      slots[slotId] = {
        ...state.slots[slotId],
        contents: state.slots[slotId].contents
          .filter((c) => !(c.kind === 'mnemosphere' && c.ref === id))
      };
    });
    commit({ mnemospheres, slots, integrated: state.integrated.filter((x) => x !== id) }, {
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
    // 降級時若已分配的技能點超過新等級，多的點數必須收回——否則存檔會停在
    // 一個「3 級魔石吃掉 5 點技能」的非法狀態，而玩家看不出為什麼。
    const nextLevel = target.level - 1;
    let budget = nextLevel;
    const skills = [];
    (target.skills || []).forEach((sk) => {
      if (budget <= 0) return;
      const take = Math.min(sk.sl, budget);
      if (take > 0) {
        skills.push({ name: sk.name, sl: take });
        budget -= take;
      }
    });
    const mnemospheres = state.mnemospheres.map((m) => (
      m.id === id ? { ...m, level: nextLevel, skills } : m
    ));
    commit({ mnemospheres });
  };

  /**
   * 整份技能表一次寫回（`ClassSkillPickerList` 的 `onChange`）。
   *
   * 為什麼不是「加一點／減一點」兩個函式：星星可以一次跳到第 n 顆，也可以把
   * 已亮的星星點掉。用增量 API 描述「從 SL 2 跳到 SL 0」要呼叫兩次，中間那一步
   * 會先寫進存檔；一次寫回整份陣列則只有一個合法狀態。
   *
   * 順序一律照 `classSkillsForClass` 的順序（由 `ClassSkillPickerList` 正規化），
   * 不照點擊順序——否則同一份點數會因為「先點哪個」而排出不同的卡片。
   */
  const setSkills = (id, nextSkills) => {
    const target = state.mnemospheres.find((m) => m.id === id);
    if (!target) return;
    const before = (target.skills || []).reduce((sum, sk) => sum + (Number(sk.sl) || 0), 0);
    const after = (nextSkills || []).reduce((sum, sk) => sum + (Number(sk.sl) || 0), 0);
    // 預算是最後一道門。`ClassSkillPickerList` 已經夾過一次，這裡再夾一次是因為
    // 它只認得 `budget` 這個數字，不認得「魔石等級」——兩者哪天不同步時，
    // 存檔要停在合法的那一邊。
    if (after > target.level || after < 0) return;
    const mnemospheres = state.mnemospheres.map((m) => (
      m.id === id ? { ...m, skills: nextSkills } : m
    ));
    commit({ mnemospheres }, after === before ? null : {
      kind: 'technosphere',
      title: `職業魔石技能：${target.className} ${before} → ${after} 級`
    });
  };

  const setHeroicSkill = (id, heroicSkill) => {
    const mnemospheres = state.mnemospheres.map((m) => (
      m.id === id ? { ...m, heroicSkill } : m
    ));
    commit({ mnemospheres }, heroicSkill
      ? { kind: 'technosphere', title: `職業魔石精通：${heroicSkill}` }
      : null);
  };

  // 「已裝在某個插槽裡」——不傳 `equippedSlots`，所以只看有沒有被裝進插槽，
  // 不看那個插槽是不是真的裝著東西。這正是第 2 步要的唯讀狀態。
  const slottedIds = new Set(getActiveMnemospheres(state).map((m) => m.id));
  const held = getHeldMnemospheres(state);
  const heldLevelTotal = held.reduce((sum, m) => sum + (Number(m.level) || 0), 0);
  const previewCeiling = getSkillLevelCeiling(level, held);

  /**
   * 開卡時**免費**贈送的職業魔石，逐顆的等級（p.134 的 1 顆 1 級 ＋ p.140 的 0 級追加）。
   *
   * 顆數看的是 `rules.startingLevel`（起始等級），**不是** `level`（角色當前等級）：
   * p.140 寫的是 `When you create a character with a level higher than 5`，只管開卡那一刻。
   * 用 `char.level` 的話，一個從 5 級練到 15 級的角色會憑空多出一顆免費魔石。
   */
  const initialLevels = getInitialMnemosphereLevels(rules.startingLevel);
  const pendingFree = Math.max(0, initialLevels.length - held.length);

  const inputStyle = { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark };
  const smallBtn = 'px-2 py-0.5 rounded border text-t11 font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      className="rounded border shadow-e1 overflow-hidden"
      style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
      data-testid="mnemosphere-section"
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b flex-wrap"
        style={{ borderColor: theme.border }}
      >
        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: theme.textDark }}>
          <GiOrbWand className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
          職業魔石
          <span className="text-t10 font-normal" style={{ color: theme.textMuted }}>
            投等級與技能（p.134）
          </span>
        </span>
        <span className="font-mono text-t11 font-bold" style={{ color: theme.accent }}>
          {held.length} 顆，合計 {heldLevelTotal} 級
          {pendingFree > 0 && (
            <span className="ml-1.5 font-normal" style={{ color: theme.textMuted }}>
              （免費額度 {initialLevels.length} 顆，還差 {pendingFree} 顆）
            </span>
          )}
        </span>
      </div>

      <div className="px-3 py-2.5 space-y-2">
        <p className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
          升級時那一點可以投進固有職業，也可以投進職業魔石——兩者是同一個池子，
          魔石的成長方式與職業逐字相同。起始等級同樣在這個池子裡分配，
          但三個固有職業合計至少要 5 級（p.140）。裝進插槽是第 4 步「裝備配置」的事。
        </p>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-t11 font-bold" style={{ color: theme.textDark }}>
            {pendingFree > 0 ? '開局免費魔石' : '取得魔石'}
            <span className="font-normal ml-1.5" style={{ color: theme.textMuted }}>
              {pendingFree > 0
                ? (initialLevels.length > 1
                  ? `${initialLevels.length} 顆（1 級＋0 級，p.134／p.140）——選職業即成立`
                  : '1 級（p.134）——選職業即成立')
                : '由 GM 作為獎勵發放（p.137）'}
            </span>
          </span>
          {held.length > 0 && pendingFree === 0 && (
            <span className="flex items-center gap-1.5">
              {adding ? (
                <>
                  <select
                    value={pendingClass}
                    disabled={disabled}
                    onChange={(e) => {
                      setPendingClass(e.target.value);
                      addMnemosphere(e.target.value);
                    }}
                    className="rounded px-2 py-1 text-t11 outline-none border font-bold"
                    style={inputStyle}
                    data-testid="mnemosphere-class-picker"
                  >
                    <option value="">選擇職業</option>
                    {MNEMOSPHERE_CLASSES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setPendingClass('');
                    }}
                    className={smallBtn}
                    style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textMuted }}
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setAdding(true)}
                  className={smallBtn}
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
                  data-testid="add-mnemosphere"
                >
                  ＋ 再取得一顆
                </button>
              )}
            </span>
          )}
        </div>

        {pendingFree > 0 && (
          <div className="space-y-1.5">
            {Array.from({ length: pendingFree }, (_, offset) => {
              const index = held.length + offset;
              const grantLevel = initialLevels[index] ?? 0;
              const isFirst = index === 0;
              return (
                <div
                  key={`free-slot-${index}`}
                  className="rounded border border-dashed px-2 py-1.5 flex items-center gap-2 flex-wrap"
                  style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
                  data-testid="free-mnemosphere-slot"
                  data-slot-index={index}
                  data-slot-level={grantLevel}
                >
                  <EmptyBeadSocket size={36} />
                  <span className="text-t11 font-bold" style={{ color: theme.textDark }}>
                    {isFirst
                      ? '開局會免費獲得一顆 1 級魔石'
                      : '高階角色額外獲得一顆 0 級魔石'}
                  </span>
                  <span className="text-t10" style={{ color: theme.textMuted }}>
                    {isFirst
                      ? '（p.134）選好職業，它就變成你的第一顆'
                      : '（p.140）起始等級超過 5，每 10 級一顆'}
                  </span>
                  <select
                    value={pendingClass}
                    disabled={disabled}
                    onChange={(e) => {
                      setPendingClass(e.target.value);
                      addMnemosphere(e.target.value, index);
                    }}
                    className="ml-auto rounded px-2 py-1 text-t11 outline-none border font-bold"
                    style={inputStyle}
                    data-testid="mnemosphere-class-picker"
                  >
                    <option value="">選擇職業</option>
                    {MNEMOSPHERE_CLASSES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {held.length > 0 && (
          <div className="space-y-1.5">
            {held.map((m) => {
              const mastered = m.level >= MNEMOSPHERE_MASTERY_LEVEL;
              const candidates = mastered ? heroicSkillsForClass(m.className) : [];
              const skillDefs = classSkillsForClass(m.className, mode);
              const spent = (m.skills || []).reduce((sum, sk) => sum + (Number(sk.sl) || 0), 0);
              const slotted = slottedIds.has(m.id);
              const tint = getMnemosphereBeadTint(m.className);
              return (
                <div
                  key={m.id}
                  className="rounded border px-2 py-1.5 space-y-1"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2 min-w-0">
                      <TechnosphereBead
                        iconName={m.className}
                        tint={tint}
                        level={m.level}
                        dim={!slotted}
                        size={36}
                        title={`${m.className}　${m.level} / ${MNEMOSPHERE_MAX_LEVEL} 級`}
                        testId={`bead-mnemosphere-${m.id}`}
                      />
                      <span className="text-t11 font-bold flex flex-wrap items-center gap-x-1.5" style={{ color: theme.textDark }}>
                        {m.className}
                        <span className="font-mono" style={{ color: theme.accent }}>
                          {m.level} / {MNEMOSPHERE_MAX_LEVEL} 級
                        </span>
                        {mastered && (
                          <span className="text-t10 font-bold" style={{ color: theme.accent }}>
                            精通
                          </span>
                        )}
                        <span className="text-t10 font-normal" style={{ color: theme.textMuted }}>
                          {slotted ? '已裝入插槽' : '未裝入插槽（第 4 步）'}
                        </span>
                      </span>
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
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: '#8c2d36' }}
                      >
                        移除
                      </button>
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-t10 font-bold" style={{ color: theme.textDark }}>
                        技能
                        <span className="font-mono ml-1" style={{ color: spent > m.level ? '#8c2d36' : theme.textMuted }}>
                          {spent} / {m.level}
                        </span>
                      </span>
                      <span className="text-t10" style={{ color: theme.textMuted }}>
                        每一級給該職業的一個技能等級，單一技能上限 5 級（p.135）
                      </span>
                    </div>
                    <ClassSkillPickerList
                      skills={skillDefs}
                      value={m.skills || []}
                      budget={m.level}
                      disabled={disabled}
                      theme={theme}
                      onChange={(next) => setSkills(m.id, next)}
                      testIdPrefix={`skill-picker-${m.id}`}
                      emptyHint="這個職業沒有技能表"
                    />
                  </div>

                  {mastered && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-t10 shrink-0" style={{ color: theme.textMuted }}>英雄技能</span>
                      <select
                        value={m.heroicSkill || ''}
                        disabled={disabled}
                        onChange={(e) => setHeroicSkill(m.id, e.target.value)}
                        className="flex-1 min-w-0 rounded px-2 py-0.5 text-t10 outline-none border font-bold"
                        style={inputStyle}
                        data-testid={`heroic-picker-${m.id}`}
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

        {held.length > 0 && (
          <p
            className="text-t10 leading-relaxed pt-1 border-t"
            style={{ color: theme.textMuted, borderColor: theme.border }}
            data-testid="held-skill-ceiling"
          >
            角色等級 {level}　＋　持有魔石 {heldLevelTotal} 級　→{' '}
            <span className="font-bold" style={{ color: theme.accent }}>
              技能水準相當於 {previewCeiling} 級
            </span>
            {' '}（全部裝上時；p.134 的例子就是這個算法）
          </p>
        )}
      </div>
    </div>
  );
}
