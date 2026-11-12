/**
 * NPC 全文本輸出（複製到 Discord／ccfolia／純文字）。
 *
 * 為什麼獨立成檔（2026-10-16 拆檔第二批）：
 * 這段原本是 `NPCWorkshop.jsx` 內 448 行的 `handleCopyFullNpc`。它的輸出**是字串**，
 * 不需要渲染就能比對——是全檔最容易「抽出去之後真的測得到」的區塊。
 *
 * 設計：以單一 `ctx` 物件注入依賴，而不是把 8 個變數散成 8 個參數。
 * `ctx` 需要的欄位：
 *   state            目前的 NPC 草稿狀態（`createNewNPC()` 的產物）
 *   revealLevel      揭露程度（'full' | '7' | '10' | '13'）
 *   currentTheme     目前卡片配色（讀取顏色用）
 *   mergedAffinities 物種＋手動調整後的相性總表
 *   processedSkills  已標好 `isOverBudget` 的技能（`processSkillBudgets()` 的產物）
 *   calculateStats   () => 最終數值
 *   secretArtTarget  秘奧指定對象（可能為 null）
 *
 * ※ **本函式是純函式**：只回傳字串，不碰剪貼簿、不呼叫 `showToast`。
 *   原本它同時負責「組字串」與「複製到剪貼簿」，副作用讓它完全無法被測試
 *   （沒有回傳值可比對）。剪貼簿與提示已留在呼叫端 `NPCWorkshop.jsx`。
 *
 * ※ 這裡**刻意不收 `validSkills`**：本檔在 ccfolia 分支自己用
 *   `processedSkills.filter(...)` 算了一份區域的 `validSkills`。
 *   若同時從 ctx 收一個同名變數進來，就會變成「兩個同名、其中一個永遠被遮蔽」——
 *   正是 `docs/decisions.md` §AX 記的那種同名陷阱。
 */
import { DAMAGE_TYPES, VILLAIN_TIERS, NEGATIVE_SKILLS_DATA, SPELLS_DATA, isOffensiveSpell, normalizeSpellName } from '../data';
import { getPlainText } from './displayText';
import { resolveAttack } from './attackDisplay';
import { SPECIES_DATA } from '../data/speciesData';

/**
 * 統一相性文字排版格式：
 * 『弱點（火、光）、抗性（暗、土）、免疫（冰、毒）、吸收（電）』
 */
export const formatAffinitiesText = (mergedAffinities) => {
  if (!mergedAffinities) return '';
  const affGroups = {
    vul: [],
    res: [],
    imm: [],
    abs: []
  };
  DAMAGE_TYPES.forEach(t => {
    const aff = mergedAffinities[t];
    if (aff && affGroups[aff]) {
      affGroups[aff].push(t);
    }
  });
  const affParts = [];
  if (affGroups.vul.length > 0) affParts.push(`弱點（${affGroups.vul.join('、')}）`);
  if (affGroups.res.length > 0) affParts.push(`抗性（${affGroups.res.join('、')}）`);
  if (affGroups.imm.length > 0) affParts.push(`免疫（${affGroups.imm.join('、')}）`);
  if (affGroups.abs.length > 0) affParts.push(`吸收（${affGroups.abs.join('、')}）`);
  return affParts.join('、');
};

export const buildNpcText = (ctx, format = 'markdown') => {
  const {
    state, revealLevel, currentTheme, mergedAffinities,
    processedSkills, calculateStats, secretArtTarget,
    groupedSkills,
  } = ctx;

  if (!state) return;
  const stats = calculateStats();

  const isRevealed = (category) => {
    if (revealLevel === 'full') return true;
    const lv = parseInt(revealLevel);
    if (category === 'basic') return true;
    if (category === 'stats' && lv >= 10) return true;
    if (category === 'combat' && lv >= 13) return true;
    return false;
  };

  let text = "";

  const filterBudget = (list) => (list || []).filter(s => !s.isOverBudget && !s.hideInPreview && s.source !== 'levelPassive');

  let attackSkills = [];
  let customSpells = [];
  let actionSkills = [];
  let ruleSkills = [];

  if (groupedSkills) {
    attackSkills = filterBudget(groupedSkills.attack);
    customSpells = filterBudget(groupedSkills.spell);
    actionSkills = filterBudget(groupedSkills.action);
    ruleSkills = filterBudget(groupedSkills.rule);
  } else {
    const valid = filterBudget(processedSkills);
    attackSkills = valid.filter(s => s.category === 'attack' || !!s.attack);
    customSpells = valid.filter(s => s.category === 'spell' || !!s.spellData);
    actionSkills = valid.filter(s => s.category === 'action');
    const explicitRules = valid.filter(s => (s.category === 'rule' || s.category === 'boss' || (!s.category && !s.attack && !s.spellData)));
    const negSkills = (state?.selectedNegativeSkills || []).map(neg => {
      const skillData = NEGATIVE_SKILLS_DATA.find(s => s.id === neg.id);
      if (!skillData) return null;
      return { ...skillData, ...neg, category: 'rule', source: 'negative' };
    }).filter(Boolean);
    ruleSkills = [...explicitRules, ...negSkills];
  }

  const hasSpellList = stats.spellList && stats.spellList.length > 0;
  const hasAnySpells = hasSpellList || customSpells.length > 0;

  if (format === 'discord') {
    const rankDisplay = state.rank === "冠位" ? `${state.rank} (${state.championMultiplier})` : state.rank;
    const villainTier = state.villainTier || 'none';
    const villainInfo = VILLAIN_TIERS[villainTier];
    text += "```yaml\n";
    text += `=== ${state.name || '未知實體'} (Lv.${state.level}) ===\n`;
    text += `【${rankDisplay}】${state.role}${villainTier !== 'none' && villainInfo && revealLevel === 'full' ? ` (${villainInfo.label} - 終結點 ${villainInfo.up})` : ''}\n`;
    text += "```\n";
    if (isRevealed('stats')) {
      if (state.traits) text += `*特質: ${state.traits}*\n`;
      text += `\`DEX d${stats.DEX.replace('d','')} | INS d${stats.INS.replace('d','')} | MIG d${stats.MIG.replace('d','')} | WLP d${stats.WLP.replace('d','')}\`\n`;
      text += `\`HP ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP ${stats.MP} | 先攻 ${stats.Init} | 物防 DEF ${stats.Def} | 魔防 M.DEF ${stats.MDef}\`\n`;
      const affText = formatAffinitiesText(mergedAffinities);
      if (affText) text += `*相性*: ${affText}\n`;
      if (stats.statusImmunities && stats.statusImmunities.length > 0) text += `*異常免疫*: ${stats.statusImmunities.join(', ')}\n`;
      text += `\n`;
    } else {
      text += `\`HP ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP ${stats.MP} | 先攻 ?? | 物防 DEF ?? | 魔防 M.DEF ??\`\n\n`;
    }

    if (isRevealed('combat')) {
      // 1. 基本攻擊
      if (attackSkills.length > 0) {
        text += `**基本攻擊**\n`;
        attackSkills.forEach(s => {
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          text += `> **${skillName}**\n`;
          if (s.attack) {
            const atk = resolveAttack(s.attack, s.selections, s.selectionsConfig);
            text += `> [${getPlainText(atk.distance, s.selections, state.level, state.partyLevel)}] [${getPlainText(atk.formula, s.selections, state.level, state.partyLevel)}] ${stats.Acc >= 0 ? '+' : '-'}${Math.abs(stats.Acc)} ✦ [HR + ${s.attack.baseDmg + stats.Dmg}] ${getPlainText(atk.type, s.selections, state.level, state.partyLevel)}傷害\n`;
          }
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          if (desc) {
            text += `> ${desc.split('\n').join('\n> ')}\n\n`;
          } else {
            text += `\n`;
          }
        });
      }

      // 2. 咒語
      if (hasAnySpells) {
        text += `**咒語**\n`;
        if (hasSpellList) {
          stats.spellList.forEach(spellObj => {
            const rawSpellName = spellObj.name;
            const selections = spellObj.selections || {};
            const cleanSpellName = normalizeSpellName(rawSpellName);
            const effectiveName = selections.customName !== undefined ? selections.customName : cleanSpellName;
            const spellData = SPELLS_DATA[cleanSpellName];
            const effectiveDesc = selections.customDesc !== undefined ? selections.customDesc : spellData?.effect || '';
            const isOffensive = isOffensiveSpell(rawSpellName);
            const totalMagicAcc = stats.Acc + stats.MagicAccModifier;
            const replacedTarget = getPlainText(spellData?.target, selections, state.level, state.partyLevel);
            const replacedEffect = getPlainText(effectiveDesc ? effectiveDesc.replace(/【HR\+(\d+)】/g, (match, p1) => `[HR + ${parseInt(p1) + stats.Dmg}]`) : '', selections, state.level, state.partyLevel, true);

            text += `> **${normalizeSpellName(effectiveName)}** (MP: ${spellData?.mp || '?'} | 目標: ${replacedTarget} | 持續: ${spellData?.duration || '瞬發'})\n`;
            if (isOffensive) {
              const accStr = totalMagicAcc >= 0 ? `+${totalMagicAcc}` : `${totalMagicAcc}`;
              text += `> ${state.magicFormula || '[INS + WLP]'} ${accStr} ✦ 攻擊性咒語\n`;
            }
            if (replacedEffect) {
              text += `> ${replacedEffect.split('\n').join('\n> ')}\n\n`;
            } else {
              text += `\n`;
            }
          });
        }
        customSpells.forEach(s => {
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          const spData = s.spellData || {};
          const spMp = spData.mp || '10';
          const spTarget = getPlainText(spData.target || '一個生物', s.selections, state.level, state.partyLevel);
          const spDuration = spData.duration || '瞬發';
          const isOffensive = spData.isOffensive || isOffensiveSpell(skillName);
          const totalMagicAcc = (stats.Acc || 0) + (stats.MagicAccModifier || 0);
          const accStr = totalMagicAcc >= 0 ? `+${totalMagicAcc}` : `${totalMagicAcc}`;
          const formulaDisplay = state.magicFormula || spData.formula || '[INS + WLP]';

          text += `> **${skillName}** (MP: ${spMp} | 目標: ${spTarget} | 持續: ${spDuration})\n`;
          if (isOffensive) {
            text += `> ${formulaDisplay} ${accStr} ✦ 攻擊性咒語\n`;
          }
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          if (desc) {
            text += `> ${desc.split('\n').join('\n> ')}\n\n`;
          } else {
            text += `\n`;
          }
        });
      }

      // 3. 其餘行動
      if (actionSkills.length > 0) {
        text += `**其餘行動**\n`;
        actionSkills.forEach(s => {
          if (revealLevel !== 'full' && s.source === 'bossSkill') return;
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          text += `> **${skillName}**\n`;
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          if (desc) {
            text += `> ${desc.split('\n').join('\n> ')}\n\n`;
          } else {
            text += `\n`;
          }
        });
      }

      // 4. 特殊規則
      if (ruleSkills.length > 0) {
        text += `**特殊規則**\n`;
        ruleSkills.forEach(s => {
          if (revealLevel !== 'full' && s.source === 'bossSkill') return;
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          text += `> **${skillName}**\n`;
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          if (desc) {
            text += `> ${desc.split('\n').join('\n> ')}\n\n`;
          } else {
            text += `\n`;
          }
        });
      }
    }
    if (revealLevel === 'full' && state.tactics) {
      text += `**戰術慣例**:\n${state.tactics}\n`;
    }
    // GM-09-01：三種文字格式原本都不輸出背景故事，只有 ccfolia 的 memo 有。
    // 同一顆「複製文本」按鈕，換格式就少一段，GM 不會發現。
    if (revealLevel === 'full' && state.story) {
      text += `\n**背景故事**:\n${state.story}\n`;
    }
  } else if (format === 'plain') {
    text += `${state.name} (Lv. ${state.level})\n`;
    const rankDisplay = state.rank === "冠位" ? `${state.rank} (${state.championMultiplier})` : state.rank;
    const villainTier = state.villainTier || 'none';
    const villainInfo = VILLAIN_TIERS[villainTier];
    text += `【${rankDisplay}】${state.role}${villainTier !== 'none' && villainInfo && revealLevel === 'full' ? ` (${villainInfo.label} - 終結點 ${villainInfo.up})` : ''}\n`;
    if (isRevealed('stats')) {
      if (state.traits) text += `特質: ${state.traits}\n`;
      text += `DEX d${stats.DEX.replace('d','')} | INS d${stats.INS.replace('d','')} | MIG d${stats.MIG.replace('d','')} | WLP d${stats.WLP.replace('d','')}\n`;
      text += `HP: ${stats.HP} (危機: ${Math.floor(stats.HP / 2)}) | MP: ${stats.MP} | 先攻 INIT: ${stats.Init} | 物防 DEF: ${stats.Def} | 魔防 M.DEF: ${stats.MDef}\n`;
      const affText = formatAffinitiesText(mergedAffinities);
      if (affText) text += `相性: ${affText}\n`;
      if (stats.statusImmunities && stats.statusImmunities.length > 0) text += `異常免疫: ${stats.statusImmunities.join('、')}\n`;
      text += `\n`;
    }
    if (isRevealed('combat')) {
      // 1. 基本攻擊
      if (attackSkills.length > 0) {
        text += `[ 基本攻擊 ]\n`;
        attackSkills.forEach(s => {
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          const atk = s.attack ? resolveAttack(s.attack, s.selections, s.selectionsConfig) : null;
          let atkStr = atk ? ` [${getPlainText(atk.distance, s.selections, state.level, state.partyLevel)}] [${getPlainText(atk.formula, s.selections, state.level, state.partyLevel)}] ${stats.Acc >= 0 ? '+' : '-'}${Math.abs(stats.Acc)} [HR + ${s.attack.baseDmg + stats.Dmg}] ${getPlainText(atk.type, s.selections, state.level, state.partyLevel)}傷害` : '';
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          text += `- ${skillName}${atkStr}\n  ${desc}\n`;
        });
        text += `\n`;
      }

      // 2. 咒語
      if (hasAnySpells) {
        text += `[ 咒語 ]\n`;
        if (hasSpellList) {
          stats.spellList.forEach(spellObj => {
            const rawSpellName = spellObj.name;
            const selections = spellObj.selections || {};
            const cleanSpellName = normalizeSpellName(rawSpellName);
            const effectiveName = selections.customName !== undefined ? selections.customName : cleanSpellName;
            const spellData = SPELLS_DATA[cleanSpellName];
            const effectiveDesc = selections.customDesc !== undefined ? selections.customDesc : spellData?.effect || '';
            const isOffensive = isOffensiveSpell(rawSpellName);
            const totalMagicAcc = stats.Acc + stats.MagicAccModifier;
            const replacedTarget = getPlainText(spellData?.target, selections, state.level, state.partyLevel);
            const replacedEffect = getPlainText(effectiveDesc ? effectiveDesc.replace(/【HR\+(\d+)】/g, (match, p1) => `[HR + ${parseInt(p1) + stats.Dmg}]`) : '', selections, state.level, state.partyLevel, true);
            let offensiveStr = '';
            if (isOffensive) {
              const accStr = totalMagicAcc >= 0 ? `+${totalMagicAcc}` : `${totalMagicAcc}`;
              offensiveStr = ` [${state.magicFormula || '[INS + WLP]'} ${accStr} ✦ 攻擊性咒語]`;
            }
            text += `- ${effectiveName} (MP: ${spellData?.mp || '?'} | 目標: ${replacedTarget} | 持續: ${spellData?.duration || '瞬發'})${offensiveStr}\n  ${replacedEffect}\n`;
          });
        }
        customSpells.forEach(s => {
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          const spData = s.spellData || {};
          const spMp = spData.mp || '10';
          const spTarget = getPlainText(spData.target || '一個生物', s.selections, state.level, state.partyLevel);
          const spDuration = spData.duration || '瞬發';
          const isOffensive = spData.isOffensive || isOffensiveSpell(skillName);
          let offensiveStr = '';
          if (isOffensive) {
            const totalMagicAcc = (stats.Acc || 0) + (stats.MagicAccModifier || 0);
            const accStr = totalMagicAcc >= 0 ? `+${totalMagicAcc}` : `${totalMagicAcc}`;
            const formulaDisplay = state.magicFormula || spData.formula || '[INS + WLP]';
            offensiveStr = ` [${formulaDisplay} ${accStr} ✦ 攻擊性咒語]`;
          }
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          text += `- ${skillName} (MP: ${spMp} | 目標: ${spTarget} | 持續: ${spDuration})${offensiveStr}\n  ${desc}\n`;
        });
        text += `\n`;
      }

      // 3. 其餘行動
      if (actionSkills.length > 0) {
        text += `[ 其餘行動 ]\n`;
        actionSkills.forEach(s => {
          if (revealLevel !== 'full' && s.source === 'bossSkill') return;
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          text += `- ${skillName}\n  ${desc}\n`;
        });
        text += `\n`;
      }

      // 4. 特殊規則
      if (ruleSkills.length > 0) {
        text += `[ 特殊規則 ]\n`;
        ruleSkills.forEach(s => {
          if (revealLevel !== 'full' && s.source === 'bossSkill') return;
          let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          text += `- ${skillName}\n  ${desc}\n`;
        });
        text += `\n`;
      }
    }
    if (revealLevel === 'full' && state.tactics) {
      text += `\n戰術慣例:\n${state.tactics}\n`;
    }
    if (revealLevel === 'full' && state.story) {
      text += `\n背景故事:\n${state.story}\n`;
    }
  } else if (format === 'ccfolia') {
    const rankDisplay = state.rank === "冠位" ? `${state.rank} (${state.championMultiplier})` : state.rank;
    const villainTier = state.villainTier || 'none';
    const villainInfo = VILLAIN_TIERS[villainTier] || { up: 0, label: '非反派' };
    // 純中文顯示（規則三）：物種取中文名，不再輸出英文標籤。
    const speciesName = state.selectedSpeciesId ? (SPECIES_DATA.find(sp => sp.id === state.selectedSpeciesId)?.name || '') : '';

    // 1. Build Memo (說明欄)
    const memoLines = [];
    memoLines.push(`【${rankDisplay}】${state.role}`);
    if (villainTier !== 'none' && revealLevel === 'full') {
      memoLines.push(`反派位階：${villainInfo.label} (終結點: ${villainInfo.up})`);
    }
    if (speciesName) {
      memoLines.push(`物種：${speciesName}`);
    }
    if (state.faction) {
      memoLines.push(`陣營：${state.faction}`);
    }
    if (isRevealed('stats')) {
      if (state.traits) {
        memoLines.push(`特質：${state.traits}`);
      }

      // 相性：『弱點（火、光）、抗性（暗、土）、免疫（冰、毒）、吸收（電）』
      const affText = formatAffinitiesText(mergedAffinities);
      if (affText) {
        memoLines.push(affText);
      }
      if (stats.statusImmunities && stats.statusImmunities.length > 0) {
        memoLines.push(`異常免疫：${stats.statusImmunities.join(', ')}`);
      }
    }
    // 依使用者指示：戰術慣例不用寫
    if (revealLevel === 'full' && state.story) {
      memoLines.push(`\n背景故事：\n${state.story}`);
    }

    // 2. Build Status (HP, MP, DEF, M.DEF, 終結點)
    const statusArr = [
      { label: "HP", value: stats.HP, max: stats.HP },
      { label: "MP", value: stats.MP, max: stats.MP },
      { label: "DEF", value: stats.Def, max: stats.Def },
      { label: "M.DEF", value: stats.MDef, max: stats.MDef }
    ];
    if (villainTier !== 'none' && villainInfo.up > 0) {
      statusArr.push({ label: "終結點", value: villainInfo.up, max: villainInfo.up });
    }

    // 3. Build Params (DEX, INS, MIG, WLP, INIT)
    const formatDie = (d) => String(d).startsWith('d') ? String(d) : `d${d}`;
    const paramsArr = [
      { label: "DEX", value: formatDie(stats.DEX) },
      { label: "INS", value: formatDie(stats.INS) },
      { label: "MIG", value: formatDie(stats.MIG) },
      { label: "WLP", value: formatDie(stats.WLP) },
      { label: "INIT", value: String(stats.Init) }
    ];

    // 4. Build Commands (Chat Palette / 聊天調色盤)
    // 依使用者指示：屬性檢定與先攻完全不需要寫
    const cmdLines = [];

    // 基本攻擊
    if (attackSkills.length > 0) {
      cmdLines.push(`// ===== 基本攻擊 =====`);
      attackSkills.forEach(s => {
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        const atk = resolveAttack(s.attack, s.selections, s.selectionsConfig);
        const dist = getPlainText(atk.distance, s.selections, state.level, state.partyLevel);
        const rawFormula = getPlainText(atk.formula, s.selections, state.level, state.partyLevel);
        const dmgType = getPlainText(atk.type, s.selections, state.level, state.partyLevel);
        const totalDmg = (s.attack?.baseDmg || 0) + (stats.Dmg || 0);

        let diceExpr = '1{DEX}+1{MIG}';
        const match = rawFormula.match(/([A-Za-z]+)\s*\+\s*([A-Za-z]+)/);
        if (match && match[1] && match[2]) {
          diceExpr = `1{${match[1].toUpperCase()}}+1{${match[2].toUpperCase()}}`;
        }

        const accMod = stats.Acc || 0;
        const accStr = accMod > 0 ? `+${accMod}` : accMod < 0 ? `${accMod}` : '';

        cmdLines.push(`${diceExpr}${accStr} 【${skillName}】命中檢定 [${dist}]`);
        const extraText = getPlainText(s.customDesc || s.originalDesc || s.attack?.extra || '', s.selections, state.level, state.partyLevel, true);
        const extraStr = extraText ? ` ✦ 效果：${extraText.replace(/\n+/g, ' ')}` : '';
        cmdLines.push(`【${dmgType}】HR + ${totalDmg}${extraStr}`);
      });
    }

    // 咒語
    if (hasAnySpells) {
      if (cmdLines.length > 0) cmdLines.push(``);
      cmdLines.push(`// ===== 咒語 =====`);

      if (hasSpellList) {
        stats.spellList.forEach(spellObj => {
          const rawSpellName = spellObj.name;
          const selections = spellObj.selections || {};
          const cleanSpellName = normalizeSpellName(rawSpellName);
          const effectiveName = selections.customName !== undefined ? selections.customName : cleanSpellName;
          const spellData = SPELLS_DATA[cleanSpellName];
          const effectiveDesc = selections.customDesc !== undefined ? selections.customDesc : spellData?.effect || '';
          const isOffensive = isOffensiveSpell(rawSpellName);
          const replacedTarget = getPlainText(spellData?.target, selections, state.level, state.partyLevel);
          const replacedEffect = getPlainText(
            effectiveDesc ? effectiveDesc.replace(/【HR\+(\d+)】/g, (match, p1) => `[HR + ${parseInt(p1) + stats.Dmg}]`) : '',
            selections, state.level, state.partyLevel, true
          );

          if (isOffensive) {
            const totalMagicAcc = (stats.Acc || 0) + (stats.MagicAccModifier || 0);
            const accStr = totalMagicAcc > 0 ? `+${totalMagicAcc}` : totalMagicAcc < 0 ? `${totalMagicAcc}` : '';
            let magicDice = '1{INS}+1{WLP}';
            const fMatch = (state.magicFormula || '').match(/([A-Za-z]+)\s*\+\s*([A-Za-z]+)/);
            if (fMatch && fMatch[1] && fMatch[2]) {
              magicDice = `1{${fMatch[1].toUpperCase()}}+1{${fMatch[2].toUpperCase()}}`;
            }
            cmdLines.push(`${magicDice}${accStr} 【${normalizeSpellName(effectiveName)}】施法檢定 (MP: ${spellData?.mp || '?'})`);
            if (replacedEffect) {
              cmdLines.push(`效果：${replacedEffect.replace(/\n+/g, ' ')}`);
            }
          } else {
            cmdLines.push(`【${normalizeSpellName(effectiveName)}】咒語發動 (MP: ${spellData?.mp || '?'} | 目標: ${replacedTarget})`);
            if (replacedEffect) {
              cmdLines.push(`效果：${replacedEffect.replace(/\n+/g, ' ')}`);
            }
          }
        });
      }

      customSpells.forEach(s => {
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        const desc = getPlainText(s.customDesc || s.originalDesc || '', s.selections, state.level, state.partyLevel, true);
        const spData = s.spellData || {};
        const isOffensive = spData.isOffensive || isOffensiveSpell(skillName);
        if (isOffensive) {
          const totalMagicAcc = (stats.Acc || 0) + (stats.MagicAccModifier || 0);
          const accStr = totalMagicAcc > 0 ? `+${totalMagicAcc}` : totalMagicAcc < 0 ? `${totalMagicAcc}` : '';
          let magicDice = '1{INS}+1{WLP}';
          const fMatch = (state.magicFormula || spData.formula || '').match(/([A-Za-z]+)\s*\+\s*([A-Za-z]+)/);
          if (fMatch && fMatch[1] && fMatch[2]) {
            magicDice = `1{${fMatch[1].toUpperCase()}}+1{${fMatch[2].toUpperCase()}}`;
          }
          cmdLines.push(`${magicDice}${accStr} 【${skillName}】施法檢定 (MP: ${spData.mp || '?'})`);
          if (desc) {
            cmdLines.push(`效果：${desc.replace(/\n+/g, ' ')}`);
          }
        } else {
          cmdLines.push(`【${skillName}】咒語發動 (MP: ${spData.mp || '?'} | 目標: ${spData.target || '一個生物'})`);
          if (desc) {
            cmdLines.push(`效果：${desc.replace(/\n+/g, ' ')}`);
          }
        }
      });
    }

    // 其餘行動
    if (actionSkills.length > 0) {
      if (cmdLines.length > 0) cmdLines.push(``);
      cmdLines.push(`// ===== 其餘行動 =====`);
      actionSkills.forEach(s => {
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        const desc = getPlainText(s.customDesc || s.originalDesc || '', s.selections, state.level, state.partyLevel, true);
        cmdLines.push(`【${skillName}】${desc.replace(/\n+/g, ' ')}`);
      });
    }

    // 特殊規則
    if (ruleSkills.length > 0) {
      if (cmdLines.length > 0) cmdLines.push(``);
      cmdLines.push(`// ===== 特殊規則 =====`);
      ruleSkills.forEach(s => {
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        const desc = getPlainText(s.customDesc || s.originalDesc || '', s.selections, state.level, state.partyLevel, true);
        cmdLines.push(`【${skillName}】${desc.replace(/\n+/g, ' ')}`);
      });
    }

    // 狀態管理快捷
    if (cmdLines.length > 0) cmdLines.push(``);
    cmdLines.push(`// ===== 狀態管理快捷 =====`);
    cmdLines.push(`:HP-`);
    cmdLines.push(`:HP+`);
    cmdLines.push(`:MP-`);
    cmdLines.push(`:MP+`);
    if (villainTier !== 'none' && villainInfo.up > 0) {
      cmdLines.push(`:終結點-1`);
    }

    const ccfoliaData = {
      kind: "character",
      data: {
        name: `${state.name || 'NPC'} (Lv.${state.level || 5})`,
        memo: memoLines.join('\n'),
        initiative: isRevealed('stats') ? (parseInt(stats.Init, 10) || 0) : 0,
        externalUrl: "",
        status: statusArr,
        params: paramsArr,
        color: currentTheme?.accent,
        commands: cmdLines.join('\n')
      }
    };

    text = JSON.stringify(ccfoliaData, null, 2);
  } else {
    let md = `### ${state.name} (Lv. ${state.level})\n`;
    const rankDisplay = state.rank === "冠位" ? `${state.rank} (${state.championMultiplier})` : state.rank;
    const villainTier = state.villainTier || 'none';
    const villainInfo = VILLAIN_TIERS[villainTier];
    md += `**【${rankDisplay}】${state.role}** ${villainTier !== 'none' && villainInfo && revealLevel === 'full' ? `(${villainInfo.label} - 終結點 ${villainInfo.up})` : ''}\n`;

    if (isRevealed('stats')) {
      if (state.traits) md += `*特質: ${state.traits}*\n`;
      md += `\n**DEX ${stats.DEX.startsWith('d') ? stats.DEX : 'd' + stats.DEX} | INS ${stats.INS.startsWith('d') ? stats.INS : 'd' + stats.INS} | MIG ${stats.MIG.startsWith('d') ? stats.MIG : 'd' + stats.MIG} | WLP ${stats.WLP.startsWith('d') ? stats.WLP : 'd' + stats.WLP}**\n`;
      md += `**HP: ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP: ${stats.MP} | 先攻: ${stats.Init} | 物防 DEF: ${stats.Def} | 魔防 M.DEF: ${stats.MDef}**\n\n`;

      const affText = formatAffinitiesText(mergedAffinities);
      if (affText) md += `* 相性: ${affText}\n`;
      if (stats.statusImmunities && stats.statusImmunities.length > 0) md += `* 異常免疫: ${stats.statusImmunities.join('、')}\n`;
      md += `\n`;
    } else {
      md += `**HP: ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP: ${stats.MP} | 先攻: ?? | 物防 DEF: ?? | 魔防 M.DEF: ??**\n\n`;
    }

    if (isRevealed('combat')) {
      const validNpcName = state.name && state.name.trim() !== "" && state.name !== "未知實體" ? state.name.trim() : null;

      // 1. 基本攻擊
      if (attackSkills.length > 0) {
        md += `#### 基本攻擊\n`;
        attackSkills.forEach(s => {
          let rawName = s.customName || s.originalName;
          let skillName = rawName.replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          md += `> **${skillName}**\n`;
          if (s.attack) {
            const atk = resolveAttack(s.attack, s.selections, s.selectionsConfig);
            md += `> [${getPlainText(atk.distance, s.selections, state.level, state.partyLevel)}] [${getPlainText(atk.formula, s.selections, state.level, state.partyLevel)}] ${stats.Acc >= 0 ? '+' : '-'}${Math.abs(stats.Acc)} ✦ [HR + ${s.attack.baseDmg + stats.Dmg}] ${getPlainText(atk.type, s.selections, state.level, state.partyLevel)}傷害\n`;
          }
          if (s.customDesc || s.originalDesc) {
            md += `> ${getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true)}\n`;
          }
          const isSecret = s.isSecretArt || (secretArtTarget && (secretArtTarget === rawName || secretArtTarget === skillName || secretArtTarget === s.originalName || secretArtTarget === s.customName));
          if (isSecret) {
            const label = s.attack ? '攻擊' : '技能';
            md += `> *(此${label}為祕技，除了目標之外沒有人會意識到那是什麼。)*\n`;
          }
          md += `\n`;
        });
      }

      // 2. 咒語
      if (hasAnySpells) {
        md += `#### 咒語\n`;
        if (hasSpellList) {
          stats.spellList.forEach(spellObj => {
            const rawSpellName = spellObj.name;
            const selections = spellObj.selections || {};
            const cleanSpellName = normalizeSpellName(rawSpellName);
            const effectiveName = selections.customName !== undefined ? selections.customName : cleanSpellName;
            const spellData = SPELLS_DATA[cleanSpellName];
            const effectiveDesc = selections.customDesc !== undefined ? selections.customDesc : spellData?.effect || '';
            const isOffensive = isOffensiveSpell(rawSpellName);
            const isSecretArtForSpell = cleanSpellName === secretArtTarget || rawSpellName === secretArtTarget;
            const totalMagicAcc = stats.Acc + stats.MagicAccModifier;

            let nameState = { used: false };
            const replaceNPC = (txt) => {
              if (typeof txt !== 'string' || !validNpcName) return txt;
              return txt.replace(/此\s?NPC\s?/g, () => {
                if (!nameState.used) { nameState.used = true; return `__NPC_NAME__${validNpcName}__NPC_END__`; }
                return "它";
              });
            };

            const replacedTarget = replaceNPC(spellData?.target);
            const rawEffectBase = effectiveDesc ? effectiveDesc.replace(/【HR\+(\d+)】/g, (match, p1) => `[HR + ${parseInt(p1) + stats.Dmg}]`) : '';
            const replacedEffect = replaceNPC(rawEffectBase);

            md += `> **${normalizeSpellName(effectiveName)}** (MP: ${spellData?.mp || '?'} | 目標: ${getPlainText(replacedTarget, selections, state.level, state.partyLevel)} | 持續: ${spellData?.duration || '瞬發'})\n`;
            if (isOffensive) {
              const accStr = totalMagicAcc > 0 ? ` +${totalMagicAcc}` : (totalMagicAcc < 0 ? ` - ${Math.abs(totalMagicAcc)}` : '');
              const formulaDisplay = state.magicFormula || '[INS + WLP]';
              md += `> ${formulaDisplay}${accStr} ✦ 攻擊性咒語\n`;
            }
            if (spellData && replacedEffect) {
              md += `> ${getPlainText(replacedEffect, selections, state.level, state.partyLevel, true).split('\n').join('\n> ')}\n`;
            }
            if (isSecretArtForSpell) {
              md += `> *(此咒語為祕技，除了目標之外沒有人會意識到那是什麼。)*\n`;
            }
            md += `\n`;
          });
        }
        customSpells.forEach(s => {
          let rawName = s.customName || s.originalName;
          let skillName = rawName.replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          const spData = s.spellData || {};
          const spMp = spData.mp || '10';
          const spTarget = getPlainText(spData.target || '一個生物', s.selections, state.level, state.partyLevel);
          const spDuration = spData.duration || '瞬發';
          md += `> **${skillName}** (MP: ${spMp} | 目標: ${spTarget} | 持續: ${spDuration})\n`;
          const isOffensive = spData.isOffensive || isOffensiveSpell(skillName);
          if (isOffensive) {
            const totalMagicAcc = (stats.Acc || 0) + (stats.MagicAccModifier || 0);
            const accStr = totalMagicAcc > 0 ? ` +${totalMagicAcc}` : (totalMagicAcc < 0 ? ` - ${Math.abs(totalMagicAcc)}` : '');
            const formulaDisplay = state.magicFormula || spData.formula || '[INS + WLP]';
            md += `> ${formulaDisplay}${accStr} ✦ 攻擊性咒語\n`;
          }
          const desc = getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true);
          if (desc) {
            md += `> ${desc.split('\n').join('\n> ')}\n`;
          }
          md += `\n`;
        });
      }

      // 3. 其餘行動
      if (actionSkills.length > 0) {
        md += `#### 其餘行動\n`;
        actionSkills.forEach(s => {
          if (revealLevel !== 'full' && s.source === 'bossSkill') return;
          let rawName = s.customName || s.originalName;
          let skillName = rawName.replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          md += `> **${skillName}**\n`;
          if (s.customDesc || s.originalDesc) {
            md += `> ${getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true)}\n`;
          }
          const isSecret = s.isSecretArt || (secretArtTarget && (secretArtTarget === rawName || secretArtTarget === skillName || secretArtTarget === s.originalName || secretArtTarget === s.customName));
          if (isSecret) {
            md += `> *(此技能為祕技，除了目標之外沒有人會意識到那是什麼。)*\n`;
          }
          md += `\n`;
        });
      }

      // 4. 特殊規則
      if (ruleSkills.length > 0) {
        md += `#### 特殊規則\n`;
        ruleSkills.forEach(s => {
          if (revealLevel !== 'full' && s.source === 'bossSkill') return;
          let rawName = s.customName || s.originalName;
          let skillName = rawName.replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
          md += `> **${skillName}**\n`;
          if (s.customDesc || s.originalDesc) {
            md += `> ${getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true)}\n`;
          }
          const isSecret = s.isSecretArt || (secretArtTarget && (secretArtTarget === rawName || secretArtTarget === skillName || secretArtTarget === s.originalName || secretArtTarget === s.customName));
          if (isSecret) {
            md += `> *(此技能為祕技，除了目標之外沒有人會意識到那是什麼。)*\n`;
          }
          md += `\n`;
        });
      }
    }

    if (revealLevel === 'full' && state.tactics) {
      md += `**戰術慣例**:\n${state.tactics}\n`;
    }
    if (revealLevel === 'full' && state.story) {
      md += `\n**背景故事**:\n${state.story}\n`;
    }
    text = md;
  }

  // 純函式：只回傳文字，不碰剪貼簿（剪貼簿副作用留在呼叫端，這樣才測得到）。
  return text.trim();
};
