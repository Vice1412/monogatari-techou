import React from 'react';
import {
  Swords,
  Skull,
  Eye,
} from 'lucide-react';
import {
  GiCheckedShield,
  GiCrystalBall,
  GiHealthNormal,
  GiLightningTear,
} from 'react-icons/gi';
import {
  calculateNpcStats,
  getSpeciesAffinities,
  resolveTemplateVariables,
  getDynamicValues
} from '../utils/npcEngine';
import {
  DAMAGE_TYPES,
  AFFINITY_STATES,
  VILLAIN_TIERS,
  TYPE_STYLES,
  ROLES_DATA,
  SPECIES_DATA,
  isOffensiveSpell,
  normalizeSpellName
} from '../data';
import StatBadge from '../../../components/ui/StatBadge';
import JRPGBadge from '../../../components/ui/JRPGBadge';

export default function NPCCardPreview({
  npc,
  showActions = true,
  className = '',
  onEdit = null
}) {
  if (!npc) return null;

  const stats = calculateNpcStats(npc);
  const speciesAffs = getSpeciesAffinities(npc.selectedSpeciesId, npc.speciesConfig);
  const finalAffs = { ...npc.affinities, ...speciesAffs };
  const speciesObj = SPECIES_DATA.find(s => s.id === npc.selectedSpeciesId);

  const maxHp = stats.HP || 50;
  const maxMp = stats.MP || 30;
  const crisisHp = Math.floor(maxHp / 2);

  // Group skills by category
  const skills = npc.skills || [];
  const attacks = skills.filter(s => s.category === 'attack');
  const spells = skills.filter(s => s.category === 'spell');
  const otherActions = skills.filter(s => s.category === 'action');
  const rules = skills.filter(s => s.category === 'rule');
  const bossSkills = skills.filter(s => s.category === 'boss');

  const renderDescription = (text, selections) => {
    if (!text) return '';
    let resolved = resolveTemplateVariables(text, selections, { npcLevel: npc.level, partyLevel: npc.partyLevel });
    const dyn = getDynamicValues(npc.level, npc.partyLevel);
    Object.keys(dyn).forEach(k => {
      resolved = resolved.replaceAll(k, `${dyn[k]} 點`);
    });
    return resolved;
  };

  return (
    <div className={`bg-[#fffdf9] rounded border-2 border-[#d6c7ab] shadow-md overflow-hidden text-[#2c221e] flex flex-col relative ${className}`}>
      {/* Top Amber Bar */}
      <div className="h-1.5 w-full bg-[#a63d40]" />

      {/* Header Profile */}
      <div className="p-4 sm:p-5 border-b border-[#d6c7ab] bg-[#f4ebd9] flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded bg-white border border-[#d6c7ab] overflow-hidden shrink-0 flex items-center justify-center font-serif text-2xl text-[#3c2415] font-bold">
          {npc.avatarBase64 ? (
            <img
              src={npc.avatarBase64}
              alt={npc.name}
              className="w-full h-full object-cover"
              style={{
                transform: `scale(${npc.avatarScale || 1}) translate(${npc.avatarOffsetX || 0}px, ${npc.avatarOffsetY || 0}px)`
              }}
            />
          ) : (
            npc.role?.[0] || '魔'
          )}
        </div>

        {/* Name, Level, Rank & Faction */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-serif font-black text-xl text-[#3c2415] truncate tracking-wide">
              {npc.name || '未命名實體'}
            </h3>
            <JRPGBadge variant="ink" size="xs">
              Lv {npc.level}
            </JRPGBadge>
            <JRPGBadge variant={npc.rank === '冠位' ? 'rank-top' : npc.rank === '精英' ? 'rank-mid' : 'slate'} size="xs">
              {npc.rank}
              {npc.rank === '冠位' && npc.championMultiplier > 1 && ` ×${npc.championMultiplier}`}
            </JRPGBadge>
            {npc.faction && (
              <JRPGBadge variant="zinc" size="xs">
                ◈ {npc.faction}
              </JRPGBadge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6b5a4b] mt-1 flex-wrap">
            <span>物種：<strong className="text-[#2c221e] font-sans font-bold">{speciesObj?.name || '無'}</strong></span>
            <span>·</span>
            <span>定位：<strong className="text-[#3c2415] font-sans font-bold">{npc.role}</strong></span>
            {npc.villainTier && npc.villainTier !== 'none' && (
              <span className="text-[#8c2d36] font-bold">★ {(VILLAIN_TIERS[npc.villainTier] || VILLAIN_TIERS.none).label}</span>
            )}
          </div>

          {npc.traits && (
            <p className="text-xs text-[#6b5a4b] italic mt-1 line-clamp-1">
              「{npc.traits}」
            </p>
          )}
        </div>

        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#e8dcc4] rounded transition-colors shrink-0"
            title="編輯 NPC"
          >
            ✎
          </button>
        )}
      </div>

      {/* Core Resources & Defenses Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[#fbf7ee] border-b border-[#d6c7ab]">
        {/* HP */}
        <div className="bg-[#f9f5eb] rounded p-2.5 border border-[#d6c7ab]">
          <div className="text-t10 text-[#6b5a4b] font-mono font-bold flex items-center gap-1">
            <GiHealthNormal className="w-3 h-3 text-[#6b5a4b]" /> HP 生命值
          </div>
          <div className="text-base font-mono font-black text-[#2c221e] mt-0.5">
            {maxHp}
            <span className="text-t10 text-[#6b5a4b] ml-1.5 font-bold inline-flex items-center gap-0.5" title={`危機值 ≤${crisisHp}`}>
              <span className="fu-icon text-xs leading-none translate-y-[1.5px]">w</span> {crisisHp}
            </span>
          </div>
        </div>

        {/* MP */}
        <div className="bg-[#f9f5eb] rounded p-2.5 border border-[#d6c7ab]">
          <div className="text-t10 text-[#6b5a4b] font-mono font-bold flex items-center gap-1">
            <GiLightningTear className="w-3 h-3 text-[#6b5a4b]" /> MP 魔力值
          </div>
          <div className="text-base font-mono font-black text-[#2c221e] mt-0.5">
            {maxMp}
          </div>
        </div>

        {/* Def */}
        <div className="bg-[#f9f5eb] rounded p-2.5 border border-[#d6c7ab]">
          <div className="text-t10 text-[#6b5a4b] font-mono font-bold flex items-center gap-1">
            <GiCheckedShield className="w-3 h-3 text-[#6b5a4b]" /> 物防 DEF
          </div>
          <div className="text-base font-mono font-black text-[#2c221e] mt-0.5">
            {stats.Def}
          </div>
        </div>

        {/* Magic Def & Initiative */}
        <div className="bg-[#f4ebd9] rounded p-2.5 border border-[#d6c7ab]">
          <div className="text-t10 text-[#6b5a4b] font-mono font-bold flex items-center gap-1">
            <GiCrystalBall className="w-3 h-3 text-[#6b5a4b]" /> 魔防 M.DEF / 先攻 INIT
          </div>
          <div className="text-base font-mono font-black text-[#2c221e] mt-0.5">
            {stats.MDef} <span className="text-xs text-[#6b5a4b] font-normal">/</span> +{stats.Init}
          </div>
        </div>
      </div>

      {/* Attributes Dices */}
      <div className="px-4 py-2.5 border-b border-[#d6c7ab] bg-[#f7f3e8] flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-[#3c2415]">四維屬性：</span>
        <div className="flex items-center gap-2 flex-wrap">
          <StatBadge stat="dex" value={stats.DEX} size="sm" />
          <StatBadge stat="ins" value={stats.INS} size="sm" />
          <StatBadge stat="mig" value={stats.MIG} size="sm" />
          <StatBadge stat="wlp" value={stats.WLP} size="sm" />
        </div>
      </div>

      {/* Affinities Matrix */}
      <div className="p-3.5 border-b border-[#d6c7ab] bg-[#fffdf9]">
        <div className="text-xs font-bold text-[#3c2415] mb-2 flex items-center justify-between">
          <span>屬性抗性矩陣</span>
          {stats.statusImmunities?.length > 0 && (
            <span className="text-t11 text-[#6b5a4b] font-medium">
              免疫: {stats.statusImmunities.join(', ')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 text-center font-mono text-xs">
          {DAMAGE_TYPES.map(type => {
            const aff = finalAffs[type] || 'normal';
            const stateCfg = AFFINITY_STATES[aff] || AFFINITY_STATES.normal;
            const style = TYPE_STYLES[type] || {};

            // 第二十二輪：這裡原本自帶一份 12 個色相令牌的狀態色表（第六份拷貝），
            // 與 AFFINITY_STATES 各自漂移。現在直接用同一張表的 chip。
            const badgeClass = stateCfg.chip;

            return (
              <div key={type} className={`rounded border p-1 flex flex-col items-center justify-center ${badgeClass}`}>
                <span className="text-t11 font-sans font-bold flex items-center gap-0.5">
                  <span className={`fu-icon text-xs ${style.color || ''}`}>{style.fuIcon}</span>
                  <span>{type}</span>
                </span>
                <span className="text-t11 mt-0.5">{stateCfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills & Actions List */}
      <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto bg-[#fffdf9]">
        {/* Attacks */}
        {attacks.length > 0 && (
          <div>
            <h4 className="text-xs font-mono font-bold text-[#3c2415] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-[#d6c7ab]/60 pb-1">
              <span className="fu-icon text-sm">m</span> 基本攻擊
            </h4>
            <div className="space-y-2">
              {attacks.map((att, idx) => {
                const attType = att.selections?.type || '物理';
                const style = TYPE_STYLES[attType] || TYPE_STYLES['物理'];
                return (
                  <div key={idx} className="bg-[#fbf7ee] rounded p-2.5 border border-[#d6c7ab] text-xs">
                    <div className="flex items-center justify-between font-bold text-[#3c2415] mb-1">
                      <span>{att.name || att.skillName || '普通攻擊'}</span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[#6b5a4b]">
                        <span className="inline-flex items-center gap-1 text-[#3c2415] bg-[#e8dcc4] px-1.5 py-0.5 rounded text-t11 font-bold leading-none shrink-0 shadow-e1">
                          <span className="fu-icon text-xs leading-none translate-y-[0.5px]">{(att.selections?.distance || '').includes('遠程') ? 'r' : 'm'}</span>
                          <span>{att.selections?.distance || '近戰'}</span>
                        </span>
                        <span>【{att.selections?.formula || 'DEX + MIG'}】+ {stats.Acc || 0}</span>
                      </span>
                    </div>
                    <p className="text-[#3c2415] leading-relaxed font-sans flex flex-wrap items-center gap-1">
                      <span>傷害: 【HR + {stats.Dmg || 5}】點</span>
                      <span className={`inline-flex items-center gap-0.5 ${style.color || ''}`}>
                        <span className="fu-icon text-xs leading-none translate-y-[0.5px]">{style.fuIcon}</span>
                        <strong>{attType}</strong>
                      </span>
                      <span>傷害。</span>
                      {att.desc && <span className="ml-1">{renderDescription(att.desc, att.selections)}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Spells */}
        {spells.length > 0 && (
          <div>
            <h4 className="text-xs font-mono font-bold text-[#3c2415] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-[#d6c7ab]/60 pb-1">
              <span className="fu-icon text-sm">c</span> 咒語
            </h4>
            <div className="space-y-2">
              {spells.map((sp, idx) => {
                const isOffensive = sp.isOffensive || isOffensiveSpell(sp.name) || isOffensiveSpell(sp.spellName) || (sp.desc && (sp.desc.includes('傷害') || sp.desc.includes('【HR+')));
                const rawName = normalizeSpellName(sp.name || sp.spellName || '法術');
                return (
                  <div key={idx} className="bg-[#fbf7ee] rounded p-2.5 border border-[#d6c7ab] text-xs">
                    <div className="flex items-center justify-between font-bold text-[#3c2415] mb-1">
                      <span className="flex items-center gap-1">
                        {isOffensive && <span className="fu-icon text-[#8c2d36] font-bold" title="攻擊性咒語">o</span>}
                        <span>{rawName}</span>
                      </span>
                      <span className="text-t11 font-mono text-[#6b5a4b]">
                        MP {sp.selections?.mpCost || 10} · {sp.selections?.target || '單體'}
                      </span>
                    </div>
                    <p className="text-[#3c2415] leading-relaxed font-sans">
                      {renderDescription(sp.desc || sp.customDesc, sp.selections)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other Actions */}
        {otherActions.length > 0 && (
          <div>
            <h4 className="text-xs font-mono font-bold text-[#3c2415] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-[#d6c7ab]/60 pb-1">
              <span className="fu-icon text-sm">s</span> 其餘行動
            </h4>
            <div className="space-y-2">
              {otherActions.filter(sk => !sk.hideInPreview).map((sk, idx) => {
                const nameText = sk.name || sk.originalName || sk.skillName || '行動';
                const descText = sk.desc || sk.originalDesc || sk.customDesc || '';
                return (
                  <div key={idx} className="bg-[#fbf7ee] rounded p-2.5 border border-[#d6c7ab] text-xs">
                    <div className="flex items-center justify-between font-bold text-[#3c2415] mb-1">
                      <span>{nameText}</span>
                      <span className="text-t10 font-mono px-1.5 py-0.5 rounded border bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]">
                        行動
                      </span>
                    </div>
                    <p className="text-[#3c2415] leading-relaxed font-sans">
                      {renderDescription(descText, sk.selections)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Boss Skills, Negative Skills & Special Rules */}
        {(bossSkills.length > 0 || rules.length > 0) && (
          <div>
            <h4 className="text-xs font-mono font-bold text-[#3c2415] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-[#d6c7ab]/60 pb-1">
              特殊規則
            </h4>
            <div className="space-y-2">
              {[...bossSkills, ...rules].filter(sk => !sk.hideInPreview).map((sk, idx) => {
                let badgeLabel = '特殊規則';
                // 徽章只講「這一條技能的來源」。來源是**出處**，不是身份——四類共用同一個中性晶片，
                // 分辨靠左邊的符號（✦ ❖ ★ ✕）與標籤文字。舊版四類各借一個色相家族
                // （琥珀／翠綠／紅／紫），等於用顏色說「這是四種不同的東西」；
                // 實際上它們的差別，文字已經講完了。
                const badgeClass = 'bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]';
                let icon = '';

                if (sk.source === 'customization') {
                  badgeLabel = '客製化';
                  icon = '✦';
                } else if (sk.source === 'roleSkill' || sk.isRoleSkill) {
                  badgeLabel = '定位技能';
                  icon = '❖';
                } else if (sk.category === 'boss' || sk.source === 'bossSkill') {
                  badgeLabel = 'Boss 技能';
                  icon = '★';
                } else if (sk.source === 'negativeSkill' || sk.category === 'negative') {
                  badgeLabel = '負面技能';
                  icon = '✕';
                }

                const nameText = sk.name || sk.originalName || sk.skillName || '技能';
                const descText = sk.desc || sk.originalDesc || sk.customDesc || '';

                return (
                  <div key={idx} className="bg-[#fbf7ee] rounded p-2.5 border border-[#d6c7ab] text-xs">
                    <div className="flex items-center justify-between font-bold text-[#3c2415] mb-1">
                      <span>{icon} {nameText}</span>
                      <span className={`text-t10 font-mono px-1.5 py-0.5 rounded border ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="text-[#3c2415] leading-relaxed font-sans">
                      {renderDescription(descText, sk.selections)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tactics & Narrative Story */}
        {(npc.tactics || npc.story) && (
          <div className="bg-[#f4ebd9] rounded p-3 border border-[#d6c7ab] text-xs space-y-1.5">
            {npc.tactics && (
              <div>
                <strong className="text-[#3c2415] font-mono">戰術方針: </strong>
                <span className="text-[#3c2415]">{npc.tactics}</span>
              </div>
            )}
            {npc.story && (
              <div>
                <strong className="text-[#3c2415] font-mono">背景記敘: </strong>
                <span className="text-[#6b5a4b] italic">{npc.story}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
