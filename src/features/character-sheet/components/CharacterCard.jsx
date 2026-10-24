import React, { useState } from 'react';
import {
  GiHealthNormal,
  GiLightningTear,
  GiBackpack,
  GiSparkles,
  GiShield,
  GiCrossedSwords,
  GiQuillInk,
  GiSpellBook,
  GiPocketWatch,
  GiLaurelCrown,
  GiHeartPlus,
  GiHazardSign
} from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import FUIcon from '../../../components/ui/FUIcon';
import { calculateCharacterStats, getCharacterLevel, HEROIC_SKILLS, HEROIC_SKILL_SOURCE_LABELS } from '../utils/characterEngine';
import StatBadge from '../../../components/ui/StatBadge';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import ClockTracker from '../../../components/ui/ClockTracker';
import SkillDescription from '../utils/skillFormulaEvaluator';
import StatFormulaPanel, { STAT_FORMULA_NOTE } from './StatFormulaPanel';
import rulesData from '../data/rulesData.json';
import { getCharacterTheme } from '../utils/characterThemes';
import { resolveHeroicSkillEffect } from '../data/theriomorphosisVariant';
import { formatInitiative, isInitiativeVariant } from '../data/initiativeVariant';
import { withEn } from '../../../utils/properNouns';

export default function CharacterCard({
  character,
  themeId = null,
  onEdit = null,
  onUpdateClock = null,
  onAvatarClick = null,
  className = ''
}) {
  // 數值構成公式面板：一次只開一個，key 如 'hp' / 'mp' / 'ip' / 'def' / 'mdef' / 'init'
  const [openFormula, setOpenFormula] = useState(null);
  const toggleFormula = (key) => setOpenFormula(prev => (prev === key ? null : key));

  if (!character) return null;

  const theme = getCharacterTheme(character.themeColor || themeId);
  const stats = calculateCharacterStats(character);
  // 先攻變體（公測 p.34）：這張卡所屬的團如果開了，先攻值不存在 → 顯示「不計」。
  const initiativeVariant = isInitiativeVariant(character);
  const breakdown = stats.breakdown || {};
  const curHp = character.currentHp !== null && character.currentHp !== undefined ? character.currentHp : stats.maxHp;
  const curMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : stats.maxMp;
  const isCrisis = curHp <= stats.crisisThreshold;
  // 四維還沒指派完 → 六項數值還不成立（見 `calculateCharacterStats` 的 `attributesUnset`）。
  // 顯示「—」而不是拿 0 算出來的假數字；卡片其他地方也已經用「尚未設定…」表達同一件事。
  const statsUnset = Boolean(stats.attributesUnset);

  return (
    <div
      className={`bg-[#fffdf9] rounded border-2 shadow-md overflow-hidden text-[#2c221e] flex flex-col relative transition-colors duration-200 ${isCrisis ? 'crisis-pulse-active border-[#8c2d36]' : ''} ${className}`}
      style={{ borderColor: isCrisis ? '#8c2d36' : theme.border }}
    >
      {/* Top Banner（第十五輪：實心 accent，不再是漸層） */}
      <div className="h-1.5 w-full" style={{ backgroundColor: theme.accent }} />

      {/* Header Profile */}
      <div
        className="p-4 sm:p-5 border-b flex items-start gap-4 transition-colors duration-200"
        style={{ backgroundColor: theme.headerBg, borderColor: theme.border }}
      >
        {/* Avatar - Game-Icons.net or Custom Photo */}
        <div
          onClick={onAvatarClick || undefined}
          className={`w-16 h-16 rounded bg-[#fffdf9] border overflow-hidden shrink-0 flex items-center justify-center font-serif text-2xl font-bold shadow-inner ${
            onAvatarClick ? 'cursor-pointer hover:ring-2 hover:ring-[#3c2415]/40 hover:scale-105 transition-all' : ''
          }`}
          style={{ borderColor: theme.border, color: theme.accent }}
          title={onAvatarClick ? "點擊更換或調整頭像肖像" : character.name}
        >
          {character.avatar && (character.avatar.startsWith('http') || character.avatar.startsWith('data:')) ? (
            <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
          ) : (
            <GameIcon
              name={character.avatar || character.classes?.[0]?.className || 'sword'}
              size={36}
              className="text-inherit"
              style={{ color: theme.accent }}
            />
          )}
        </div>

        {/* Identity & Origin */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="font-serif font-black text-xl tracking-wide truncate"
              style={{ color: theme.textDark }}
            >
              {character.name && character.name.trim() ? (
                character.name
              ) : (
                <span className="text-[#a08f7f] italic font-mono border-b border-dashed border-[#d6c7ab] pb-0.5">
                  【 ______ 尚未命名冒險者 】
                </span>
              )}
            </h3>
            <JRPGBadge variant={theme.badgeVariant} size="xs">
              Lv {getCharacterLevel(character)}
            </JRPGBadge>
            {isCrisis && (
              <JRPGBadge variant="danger" size="xs" className="flex items-center gap-1">
                <FUIcon name="crisis" className="text-sm leading-none" />
                <span>CRISIS 危機狀態</span>
              </JRPGBadge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6b5a4b] mt-1 font-mono flex-wrap">
            <span>
              身份:{' '}
              {character.identity && character.identity.trim() ? (
                <strong className="font-sans font-bold" style={{ color: theme.textDark }}>
                  {character.identity}
                </strong>
              ) : (
                <span className="text-[#a08f7f] italic font-normal border-b border-dashed border-[#d6c7ab]">
                  【 尚未設定身份 】
                </span>
              )}
            </span>
            <span>·</span>
            <span>
              主題:{' '}
              {character.theme && character.theme.trim() ? (
                <strong className="font-sans font-bold" style={{ color: theme.accent }}>
                  {character.theme}
                </strong>
              ) : (
                <span className="text-[#a08f7f] italic font-normal border-b border-dashed border-[#d6c7ab]">
                  【 尚未設定主題 】
                </span>
              )}
            </span>
            <span>·</span>
            <span>
              故鄉:{' '}
              {character.origin && character.origin.trim() ? (
                <strong className="font-sans font-bold" style={{ color: theme.textDark }}>
                  {character.origin}
                </strong>
              ) : (
                <span className="text-[#a08f7f] italic font-normal border-b border-dashed border-[#d6c7ab]">
                  【 尚未設定故鄉 】
                </span>
              )}
            </span>
            <span>·</span>
            <span>
              性別:{' '}
              {character.gender && character.gender.trim() ? (
                <strong className="font-sans font-bold" style={{ color: theme.textDark }}>
                  {character.gender}
                </strong>
              ) : (
                <span className="text-[#a08f7f] italic font-normal border-b border-dashed border-[#d6c7ab]">
                  【 尚未設定性別 】
                </span>
              )}
            </span>
          </div>

          {/* Classes pill tags with Game-Icons */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {(!character.classes || character.classes.length === 0) ? (
              <span className="text-t11 px-2 py-0.5 rounded border border-dashed border-[#d6c7ab] bg-[#f4ebd9] text-[#2c221e] font-mono italic">
                【 尚未配置職業 (起始需配置 2~3 個職業) 】
              </span>
            ) : (
              <>
                {character.classes.map((cl, idx) => (
                  <span
                    key={idx}
                    className="text-t11 px-2 py-0.5 rounded border font-mono font-bold flex items-center gap-1"
                    style={{
                      backgroundColor: '#fffdf9',
                      borderColor: theme.border,
                      color: theme.textDark
                    }}
                  >
                    <GameIcon name={cl.className} size={13} style={{ color: theme.accent }} />
                    {withEn(cl.className)} (Lv {cl.level})
                  </span>
                ))}
                {/* Check if total SL is below required level */}
                {(() => {
                  const totalSL = character.classes.reduce((sum, c) => sum + (c.skills || []).reduce((s, sk) => s + (sk.sl || 0), 0), 0);
                  const reqSL = getCharacterLevel(character);
                  if (totalSL < reqSL) {
                    return (
                      <span className="text-t10 px-2 py-0.5 rounded border border-dashed border-[#d6c7ab] bg-[#f9f5eb] text-[#3c2415] font-mono font-bold">
                        尚餘 {reqSL - totalSL} 點特技未分配
                      </span>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>

          {/* 角色背景：只在填過之後才顯示——空白時不佔卡片版面 */}
          {character.background && character.background.trim() ? (
            <div
              className="mt-2 p-2 rounded border text-t11 leading-relaxed whitespace-pre-wrap"
              style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
            >
              {character.background}
            </div>
          ) : null}
        </div>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="p-2 text-[#7c6a58] hover:bg-black/5 rounded transition-colors shrink-0"
            title="編輯角色卡"
          >
            <GiQuillInk className="w-4 h-4" style={{ color: theme.accent }} />
          </button>
        )}
      </div>

      {/* Core Resources Grid */}
      <div className="space-y-2 p-3.5 border-b transition-colors duration-200" style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* HP */}
          <div className="bg-[#f9f5eb] rounded p-2.5 border border-[#d6c7ab]">
            <div className="text-t10 text-[#3c2415] font-mono font-bold flex items-center gap-1">
              <GiHealthNormal className="w-3.5 h-3.5 text-[#6b5a4b]" /> HP 生命值
            </div>
            <button
              type="button"
              onClick={() => toggleFormula('hp')}
              title="點擊查看公式"
              className="text-base font-mono font-black text-[#2c221e] mt-0.5 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              {statsUnset ? '—' : <>{curHp} <span className="text-xs text-[#6b5a4b] font-normal">/ {stats.maxHp}</span></>}
            </button>
          </div>

          {/* MP */}
          <div className="bg-[#f9f5eb] rounded p-2.5 border border-[#d6c7ab]">
            <div className="text-t10 text-[#3c2415] font-mono font-bold flex items-center gap-1">
              <GiLightningTear className="w-3.5 h-3.5 text-[#6b5a4b]" /> MP 魔力值
            </div>
            <button
              type="button"
              onClick={() => toggleFormula('mp')}
              title="點擊查看公式"
              className="text-base font-mono font-black text-[#2c221e] mt-0.5 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              {statsUnset ? '—' : <>{curMp} <span className="text-xs text-[#6b5a4b] font-normal">/ {stats.maxMp}</span></>}
            </button>
          </div>

          {/* IP */}
          <div className="bg-[#f9f5eb] rounded p-2.5 border border-[#d6c7ab]">
            <div className="text-t10 text-[#3c2415] font-mono font-bold flex items-center gap-1">
              <GiBackpack className="w-3.5 h-3.5 text-[#6b5a4b]" /> IP 庫存點
            </div>
            <button
              type="button"
              onClick={() => toggleFormula('ip')}
              title="點擊查看公式"
              className="text-base font-mono font-black text-[#2c221e] mt-0.5 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              {character.currentIp ?? stats.maxIp} <span className="text-xs text-[#6b5a4b] font-normal">/ {stats.maxIp}</span>
            </button>
          </div>

          {/* FP */}
          <div className="bg-[#f9f5eb] rounded p-2.5 border border-[#d6c7ab]">
            <div className="text-t10 text-[#3c2415] font-mono font-bold flex items-center gap-1">
              <GiSparkles className="w-3.5 h-3.5 text-[#6b5a4b]" /> 物語點
            </div>
            <div className="text-base font-mono font-black text-[#2c221e] mt-0.5">
              {character.fabulaPoints ?? 3}
            </div>
          </div>
        </div>

        <StatFormulaPanel
          isOpen={openFormula === 'hp'}
          title="最大生命值"
          breakdown={breakdown.hp}
          note={STAT_FORMULA_NOTE}
          onClose={() => setOpenFormula(null)}
        />
        <StatFormulaPanel
          isOpen={openFormula === 'mp'}
          title="最大魔力值"
          breakdown={breakdown.mp}
          note={STAT_FORMULA_NOTE}
          onClose={() => setOpenFormula(null)}
        />
        <StatFormulaPanel
          isOpen={openFormula === 'ip'}
          title="最大庫存點"
          breakdown={breakdown.ip}
          onClose={() => setOpenFormula(null)}
        />
      </div>

      {/* Attributes & Defenses */}
      <div
        className="p-3.5 border-b space-y-2 transition-colors duration-200"
        style={{ backgroundColor: theme.appBg, borderColor: theme.border }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Dice */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatBadge stat="dex" value={stats.currentDex || stats.baseDex || 8} size="sm" />
            <StatBadge stat="ins" value={stats.currentIns || stats.baseIns || 8} size="sm" />
            <StatBadge stat="mig" value={stats.currentMig || stats.baseMig || 8} size="sm" />
            <StatBadge stat="wlp" value={stats.currentWlp || stats.baseWlp || 8} size="sm" />
          </div>

          {/* Def & MDef & Init */}
          <div className="flex items-center gap-3 font-mono text-xs text-[#3c2415]">
            <button
              type="button"
              onClick={() => toggleFormula('def')}
              title="點擊查看公式"
              className="flex items-center gap-1 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              <GiShield className="w-3.5 h-3.5" style={{ color: theme.accent }} />
              <span>物防: <strong className="font-bold" style={{ color: theme.textDark }}>{statsUnset ? '—' : stats.def}</strong></span>
            </button>
            <button
              type="button"
              onClick={() => toggleFormula('mdef')}
              title="點擊查看公式"
              className="flex items-center gap-1 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              <GiShield className="w-3.5 h-3.5 text-[#7c6a58]" />
              <span>魔防: <strong className="text-[#3c2415] font-bold">{statsUnset ? '—' : stats.mdef}</strong></span>
            </button>
            <button
              type="button"
              onClick={() => toggleFormula('init')}
              title="點擊查看公式"
              className="flex items-center gap-1 hover:underline decoration-dotted underline-offset-2 cursor-pointer"
            >
              <GiPocketWatch className="w-3.5 h-3.5 text-[#7c6a58]" />
              <span>先攻: <strong className="text-[#3c2415]">{formatInitiative(stats.init, initiativeVariant)}</strong></span>
            </button>
          </div>
        </div>

        <StatFormulaPanel
          isOpen={openFormula === 'def'}
          title="物理防禦"
          breakdown={breakdown.def}
          note={STAT_FORMULA_NOTE}
          onClose={() => setOpenFormula(null)}
        />
        <StatFormulaPanel
          isOpen={openFormula === 'mdef'}
          title="魔法防禦"
          breakdown={breakdown.mdef}
          note={STAT_FORMULA_NOTE}
          onClose={() => setOpenFormula(null)}
        />
        <StatFormulaPanel
          isOpen={openFormula === 'init'}
          title="先攻修正"
          breakdown={breakdown.init}
          onClose={() => setOpenFormula(null)}
        />
      </div>

      {/* Equipment List */}
      <div className="p-4 border-b bg-[#fffdf9] text-xs" style={{ borderColor: theme.border }}>
        <h4
          className="text-t11 font-mono font-bold tracking-wider mb-2 flex items-center gap-1.5 border-b pb-1"
          style={{ color: theme.textDark, borderColor: theme.border }}
        >
          <GiCrossedSwords className="w-3.5 h-3.5" style={{ color: theme.accent }} /> 裝備配置
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#3c2415] font-mono">
          <div className="p-2 rounded border" style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}>
            <span className="text-[#7c6a58]">主手: </span>
            {character.equipment?.mainHand && character.equipment.mainHand !== '無' ? (
              <span className="font-bold font-sans" style={{ color: theme.textDark }}>{character.equipment.mainHand}</span>
            ) : (
              <span className="text-[#a08f7f] italic font-sans font-normal border-b border-dashed border-[#d6c7ab]">[ 空格 / 未裝備 ]</span>
            )}
          </div>
          <div className="p-2 rounded border" style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}>
            <span className="text-[#7c6a58]">副手/盾: </span>
            {character.equipment?.offHand && character.equipment.offHand !== '無' && character.equipment.offHand !== '無盾牌' ? (
              <span className="font-bold font-sans" style={{ color: theme.textDark }}>{character.equipment.offHand}</span>
            ) : (
              <span className="text-[#a08f7f] italic font-sans font-normal border-b border-dashed border-[#d6c7ab]">[ 空格 / 未裝備 ]</span>
            )}
          </div>
          <div className="p-2 rounded border" style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}>
            <span className="text-[#7c6a58]">防具: </span>
            {character.equipment?.armor && character.equipment.armor !== '無' ? (
              <span className="font-bold font-sans" style={{ color: theme.textDark }}>{character.equipment.armor}</span>
            ) : (
              <span className="text-[#a08f7f] italic font-sans font-normal border-b border-dashed border-[#d6c7ab]">[ 空格 / 未裝備 ]</span>
            )}
          </div>
          <div className="p-2 rounded border" style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}>
            <span className="text-[#7c6a58]">飾品: </span>
            {character.equipment?.accessory && character.equipment.accessory !== '無' ? (
              <span className="font-bold font-sans" style={{ color: theme.textDark }}>{character.equipment.accessory}</span>
            ) : (
              <span className="text-[#a08f7f] italic font-sans font-normal border-b border-dashed border-[#d6c7ab]">[ 空格 / 未裝備 ]</span>
            )}
          </div>
        </div>
      </div>

      {/* Classes & Skills Details */}
      <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto bg-[#fffdf9]">
        <div>
          <h4
            className="text-xs font-mono font-bold tracking-wider mb-2 border-b pb-1 flex items-center gap-1.5"
            style={{ color: theme.textDark, borderColor: theme.border }}
          >
            <GiSpellBook className="w-3.5 h-3.5" style={{ color: theme.accent }} /> 職業特技清單
          </h4>
          {(!character.classes || character.classes.flatMap(c => c.skills || []).length === 0) ? (
            <div className="p-3.5 rounded border border-dashed border-[#d6c7ab] bg-[#f4ebd9]/60 text-[#7c6a58] text-xs text-center font-mono">
              【 尚未配置任何職業特技 】（起始 5 級請於步驟 3 分配特技點數）
            </div>
          ) : (
            <div className="space-y-2">
              {(character.classes || []).map((cl, cIdx) => (
                <div key={cIdx} className="space-y-1.5">
                  {(cl.skills || []).map((sk, sIdx) => {
                    const classDef = rulesData.classes[cl.className];
                    const skillDef = classDef?.skills?.find(s => s.name === sk.name);
                    return (
                      <div
                        key={sIdx}
                        className="rounded p-2.5 border text-xs"
                        style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
                      >
                        <div className="flex items-center justify-between font-bold mb-1" style={{ color: theme.textDark }}>
                          <span className="flex items-center gap-1.5">
                            <GameIcon name={cl.className} size={14} style={{ color: theme.accent }} />
                            {sk.name}
                          </span>
                          <span className="font-mono text-[#7c6a58] text-t11">
                            SL {sk.sl} / {skillDef?.maxSL || 5}
                          </span>
                        </div>
                        <div className="text-[#574c43] leading-relaxed font-sans text-t11">
                          <SkillDescription desc={skillDef?.desc || '暫無說明'} sl={sk.sl} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Heroic Skills */}
        {character.heroicSkills && character.heroicSkills.length > 0 && (
          <div>
            <h4
              className="text-xs font-mono font-bold tracking-wider mb-2 border-b pb-1 flex items-center gap-1.5"
              style={{ color: theme.textDark, borderColor: theme.border }}
            >
              <GiLaurelCrown className="w-3.5 h-3.5" style={{ color: theme.accent }} /> 英雄技能
            </h4>
            <div className="space-y-2">
              {character.heroicSkills.map((hs, idx) => (
                <div
                  key={idx}
                  className="rounded p-2.5 border text-xs"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
                >
                  <div className="font-bold mb-1 flex items-center gap-1.5" style={{ color: theme.textDark }}>
                    <GiLaurelCrown className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                    {hs.name}
                    {/* 出處（使用者要求「必須要標出出處」）：Playtest 那批還沒進正式規則書 */}
                    {(() => {
                      const found = HEROIC_SKILLS.find((x) => x.name === hs.name);
                      const label = HEROIC_SKILL_SOURCE_LABELS[hs.source || found?.source];
                      return label ? (
                        <span
                          className="text-t10 px-1.5 py-0.5 rounded border font-bold shrink-0"
                          style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.accent }}
                        >
                          {label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-[#574c43] leading-relaxed font-sans text-t11">{resolveHeroicSkillEffect(hs.name, hs.effect, character)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bonds */}
        <div>
          <h4
            className="text-xs font-mono font-bold tracking-wider mb-2 flex items-center gap-1.5 border-b pb-1"
            style={{ color: theme.textDark, borderColor: theme.border }}
          >
            <GiHeartPlus className="w-3.5 h-3.5" style={{ color: theme.accent }} /> 情感羈絆
          </h4>
          {(!character.bonds || character.bonds.length === 0) ? (
            <div className="p-3 rounded border border-dashed border-[#d6c7ab] bg-[#f4ebd9]/60 text-[#7c6a58] text-xs flex items-center justify-between">
              <span>【 尚未締結任何情感羈絆 】（可建立最多 6 組羈絆）</span>
              <span className="font-mono text-t10 text-[#a08f7f]">0 / 6</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {character.bonds.map((bond, idx) => (
                <div
                  key={idx}
                  className="rounded p-2.5 border text-xs flex items-center justify-between gap-2"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
                >
                  <div className="font-bold" style={{ color: theme.textDark }}>{bond.target}</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(bond.feelings || []).map(f => (
                      <span
                        key={f}
                        className="px-1.5 py-0.5 rounded border text-t10 font-bold"
                        style={{ backgroundColor: '#fffdf9', borderColor: theme.border, color: theme.textDark }}
                      >
                        {f}
                      </span>
                    ))}
                    <span className="text-t10 font-mono font-bold" style={{ color: theme.accent }}>
                      (+{bond.feelings?.length || 0})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personal Clocks */}
        <div>
          <h4
            className="text-xs font-mono font-bold tracking-wider mb-2 flex items-center gap-1.5 border-b pb-1"
            style={{ color: theme.textDark, borderColor: theme.border }}
          >
            <GiPocketWatch className="w-3.5 h-3.5" style={{ color: theme.accent }} /> 個人命刻
          </h4>
          {(!character.clocks || character.clocks.length === 0) ? (
            <div className="p-3 rounded border border-dashed border-[#d6c7ab] bg-[#f4ebd9]/60 text-[#7c6a58] text-xs">
              <span>【 尚未添加個人命刻 】（可在特質與命刻步驟添加時鐘推進個人目標）</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {character.clocks.map((clock, idx) => (
                <ClockTracker
                  key={clock.id || idx}
                  title={clock.title}
                  totalSegments={clock.totalSegments || 6}
                  filledSegments={clock.filledSegments || 0}
                  theme={clock.theme || theme.id}
                  type={clock.type || 'circle'}
                  size={100}
                  onChange={onUpdateClock ? (newVal => onUpdateClock(clock.id, newVal)) : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
