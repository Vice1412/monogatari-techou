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

export const buildNpcText = (ctx, format = 'markdown') => {
  const {
    state, revealLevel, currentTheme, mergedAffinities,
    processedSkills, calculateStats, secretArtTarget,
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

  if (format === 'discord') {
    const rankDisplay = state.rank === "冠位" ? `${state.rank} (${state.championMultiplier})` : state.rank;
    text += "```yaml\n";
    text += `=== ${state.name || '未知實體'} (Lv.${state.level}) ===\n`;
    text += `【${rankDisplay}】${state.role}${state.villainTier !== 'none' && revealLevel === 'full' ? ` (${VILLAIN_TIERS[state.villainTier].label})` : ''}\n`;
    text += "```\n";
    if (isRevealed('stats')) {
      if (state.traits) text += `*特質: ${state.traits}*\n`;
      text += `\`DEX d${stats.DEX.replace('d','')} | INS d${stats.INS.replace('d','')} | MIG d${stats.MIG.replace('d','')} | WLP d${stats.WLP.replace('d','')}\`\n`;
      text += `\`HP ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP ${stats.MP} | 先攻 ${stats.Init} | 物防 DEF ${stats.Def} | 魔防 M.DEF ${stats.MDef}\`\n`;
      let affs = [];
      DAMAGE_TYPES.forEach(t => {
        const aff = mergedAffinities[t];
        if (aff && aff !== 'normal') {
          const label = aff === 'vul' ? '弱點' : aff === 'res' ? '抗性' : aff === 'imm' ? '免疫' : '吸收';
          affs.push(`${t}:${label}`);
        }
      });
      if (affs.length > 0) text += `*相性*: ${affs.join(', ')}\n`;
      if (stats.statusImmunities.length > 0) text += `*異常免疫*: ${stats.statusImmunities.join(', ')}\n`;
      text += `\n`;
    } else {
      text += `\`HP ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP ${stats.MP} | 先攻 ?? | 物防 DEF ?? | 魔防 M.DEF ??\`\n\n`;
    }

    if (isRevealed('combat')) {
      if (stats.spellList && stats.spellList.length > 0) {
        text += `**咒語**\n`;
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
            text += `> *精確: ${state.magicFormula || '[INS + WLP]'} ${accStr}*\n`;
          }
          text += `> ${replacedEffect.split('\n').join('\n> ')}\n\n`;
        });
      }

      text += `**基本攻擊與行動**\n`;
      processedSkills.filter(s => !s.isOverBudget).forEach(s => {
        if (revealLevel !== 'full' && (s.source === 'bossSkill' || s.category === 'rule' || s.category === 'action')) return;
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        text += `> **${skillName}**\n`;
        if (s.attack) {
          const atk = resolveAttack(s.attack, s.selections, s.selectionsConfig);
          text += `> [${getPlainText(atk.distance, s.selections, state.level, state.partyLevel)}] [${getPlainText(atk.formula, s.selections, state.level, state.partyLevel)}] ${stats.Acc >= 0 ? '+' : '-'}${Math.abs(stats.Acc)} ✦ [HR + ${s.attack.baseDmg + stats.Dmg}] ${getPlainText(atk.type, s.selections, state.level, state.partyLevel)}傷害\n`;
        }
        text += `> ${getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true).split('\n').join('\n> ')}\n\n`;
      });
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
    text += `【${rankDisplay}】${state.role}\n`;
    if (isRevealed('stats')) {
      if (state.traits) text += `特質: ${state.traits}\n`;
      text += `DEX d${stats.DEX.replace('d','')} | INS d${stats.INS.replace('d','')} | MIG d${stats.MIG.replace('d','')} | WLP d${stats.WLP.replace('d','')}\n`;
      text += `HP: ${stats.HP} (危機: ${Math.floor(stats.HP / 2)}) | MP: ${stats.MP} | 先攻 INIT: ${stats.Init} | 物防 DEF: ${stats.Def} | 魔防 M.DEF: ${stats.MDef}\n`;
      DAMAGE_TYPES.forEach(t => {
        const aff = mergedAffinities[t];
        if (aff && aff !== 'normal') {
          const label = aff === 'vul' ? '弱點' : aff === 'res' ? '抗性' : aff === 'imm' ? '免疫' : '吸收';
          text += `${t}: ${label}\n`;
        }
      });
      if (stats.statusImmunities.length > 0) text += `異常免疫: ${stats.statusImmunities.join('、')}\n`;
      text += `\n`;
    }
    if (isRevealed('combat')) {
      if (stats.spellList && stats.spellList.length > 0) {
        text += `[ 咒語 ]\n`;
        stats.spellList.forEach(spellObj => {
          const rawSpellName = spellObj.name;
          const selections = spellObj.selections || {};
          const cleanSpellName = normalizeSpellName(rawSpellName);
          const effectiveName = selections.customName !== undefined ? selections.customName : cleanSpellName;
          const spellData = SPELLS_DATA[cleanSpellName];
          const effectiveDesc = selections.customDesc !== undefined ? selections.customDesc : spellData?.effect || '';
          const replacedTarget = getPlainText(spellData?.target, selections, state.level, state.partyLevel);
          const replacedEffect = getPlainText(effectiveDesc ? effectiveDesc.replace(/【HR\+(\d+)】/g, (match, p1) => `[HR + ${parseInt(p1) + stats.Dmg}]`) : '', selections, state.level, state.partyLevel, true);
          text += `- ${effectiveName} (MP: ${spellData?.mp || '?'} | 目標: ${replacedTarget} | 持續: ${spellData?.duration || '瞬發'})\n  ${replacedEffect}\n`;
        });
        text += `\n`;
      }
      text += `[ 基本攻擊與行動 ]\n`;
      processedSkills.filter(s => !s.isOverBudget).forEach(s => {
        if (revealLevel !== 'full' && (s.source === 'bossSkill' || s.category === 'rule' || s.category === 'action')) return;
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        const atk = s.attack ? resolveAttack(s.attack, s.selections, s.selectionsConfig) : null;
        let atkStr = atk ? ` [${getPlainText(atk.distance, s.selections, state.level, state.partyLevel)}] [${getPlainText(atk.formula, s.selections, state.level, state.partyLevel)}] ${stats.Acc >= 0 ? '+' : '-'}${Math.abs(stats.Acc)} [HR + ${s.attack.baseDmg + stats.Dmg}] ${getPlainText(atk.type, s.selections, state.level, state.partyLevel)}傷害` : '';
        text += `- ${skillName}${atkStr}\n  ${getPlainText(s.customDesc || s.originalDesc, s.selections, state.level, state.partyLevel, true)}\n`;
      });
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
    //
    // GM-09-02：ccfolia 分支原本**完全不理會 revealLevel**——研究檢定切到 10+ 之後，
    // 其餘三種格式都剔掉了故事與戰術、也把數值遮成 ??，只有這裡照樣全送，
    // 等於把 GM 刻意要藏的東西直接交到玩家手上。這裡補上與其他分支一致的閘門。
    const memoLines = [];
    memoLines.push(`【${rankDisplay}】${state.role}`);
    if (villainTier !== 'none' && revealLevel === 'full') {
      memoLines.push(`反派位階：${villainInfo.label} (UP: ${villainInfo.up})`);
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

      // 相性
      const affs = [];
      DAMAGE_TYPES.forEach(t => {
        const aff = mergedAffinities[t];
        if (aff && aff !== 'normal') {
          const label = aff === 'vul' ? '弱點' : aff === 'res' ? '抗性' : aff === 'imm' ? '免疫' : '吸收';
          affs.push(`${t}:${label}`);
        }
      });
      if (affs.length > 0) {
        memoLines.push(`相性：${affs.join(', ')}`);
      }
      if (stats.statusImmunities && stats.statusImmunities.length > 0) {
        memoLines.push(`異常免疫：${stats.statusImmunities.join(', ')}`);
      }
    }
    if (revealLevel === 'full' && state.tactics) {
      memoLines.push(`\n戰術慣例：\n${state.tactics}`);
    }
    if (revealLevel === 'full' && state.story) {
      memoLines.push(`\n背景故事：\n${state.story}`);
    }

    // 2. Build Status (HP, MP, UP)
    const statusArr = [
      { label: "HP", value: stats.HP, max: stats.HP },
      { label: "MP", value: stats.MP, max: stats.MP }
    ];
    if (villainTier !== 'none' && villainInfo.up > 0) {
      statusArr.push({ label: "UP", value: villainInfo.up, max: villainInfo.up });
    }

    // 3. Build Params (DEX, INS, MIG, WLP, DEF, M.DEF, INIT)
    const dexNum = String(stats.DEX).replace('d', '');
    const insNum = String(stats.INS).replace('d', '');
    const migNum = String(stats.MIG).replace('d', '');
    const wlpNum = String(stats.WLP).replace('d', '');
    const paramsArr = [
      { label: "DEX", value: dexNum },
      { label: "INS", value: insNum },
      { label: "MIG", value: migNum },
      { label: "WLP", value: wlpNum },
      { label: "DEF", value: String(stats.Def) },
      { label: "M.DEF", value: String(stats.MDef) },
      { label: "INIT", value: String(stats.Init) }
    ];

    // 4. Build Commands (Chat Palette / 聊天調色盤)
    const cmdLines = [];
    cmdLines.push(`// ===== 屬性檢定與先攻 (Fabula Ultima) =====`);
    cmdLines.push(`1d{DEX}+1d{INS} 【先攻檢定 DEX+INS】`);
    cmdLines.push(`1d{DEX}+1d{INS} 【靈巧+洞察檢定】`);
    cmdLines.push(`1d{DEX}+1d{MIG} 【靈巧+力量檢定】`);
    cmdLines.push(`1d{DEX}+1d{WLP} 【靈巧+意志檢定】`);
    cmdLines.push(`1d{INS}+1d{MIG} 【洞察+力量檢定】`);
    cmdLines.push(`1d{INS}+1d{WLP} 【洞察+意志檢定】`);
    cmdLines.push(`1d{MIG}+1d{WLP} 【力量+意志檢定】`);

    // 基本攻擊
    const validSkills = processedSkills.filter(s => !s.isOverBudget);
    const attackSkills = validSkills.filter(s => s.attack);
    if (attackSkills.length > 0) {
      cmdLines.push(``);
      cmdLines.push(`// ===== 基本攻擊 =====`);
      attackSkills.forEach(s => {
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        const atk = resolveAttack(s.attack, s.selections, s.selectionsConfig);
        const dist = getPlainText(atk.distance, s.selections, state.level, state.partyLevel);
        const rawFormula = getPlainText(atk.formula, s.selections, state.level, state.partyLevel);
        const dmgType = getPlainText(atk.type, s.selections, state.level, state.partyLevel);
        const totalDmg = (s.attack.baseDmg || 0) + (stats.Dmg || 0);

        let diceExpr = '1d{DEX}+1d{MIG}';
        const match = rawFormula.match(/([A-Za-z]+)\s*\+\s*([A-Za-z]+)/);
        if (match && match[1] && match[2]) {
          diceExpr = `1d{${match[1].toUpperCase()}}+1d{${match[2].toUpperCase()}}`;
        }

        const accMod = stats.Acc || 0;
        const accStr = accMod > 0 ? `+${accMod}` : accMod < 0 ? `${accMod}` : '';

        cmdLines.push(`${diceExpr}${accStr} 【${skillName}】命中檢定 [${dist}]`);
        cmdLines.push(`傷害：【${dmgType}】HR + ${totalDmg}`);

        const extraText = getPlainText(s.customDesc || s.originalDesc || s.attack.extra || '', s.selections, state.level, state.partyLevel, true);
        if (extraText) {
          cmdLines.push(`效果：${extraText.replace(/\n+/g, ' ')}`);
        }
      });
    }

    // 咒語
    if (stats.spellList && stats.spellList.length > 0) {
      cmdLines.push(``);
      cmdLines.push(`// ===== 咒語 =====`);
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
          let magicDice = '1d{INS}+1d{WLP}';
          const fMatch = (state.magicFormula || '').match(/([A-Za-z]+)\s*\+\s*([A-Za-z]+)/);
          if (fMatch && fMatch[1] && fMatch[2]) {
            magicDice = `1d{${fMatch[1].toUpperCase()}}+1d{${fMatch[2].toUpperCase()}}`;
          }
          cmdLines.push(`${magicDice}${accStr} 【${normalizeSpellName(effectiveName)}】魔攻檢定 (MP: ${spellData?.mp || '?'})`);
          cmdLines.push(`效果：${replacedEffect.replace(/\n+/g, ' ')}`);
        } else {
          cmdLines.push(`【${normalizeSpellName(effectiveName)}】咒語發動 (MP: ${spellData?.mp || '?'} | 目標: ${replacedTarget})`);
          cmdLines.push(`效果：${replacedEffect.replace(/\n+/g, ' ')}`);
        }
      });
    }

    // 特殊規則與能力
    const otherSkills = validSkills.filter(s => !s.attack);
    if (otherSkills.length > 0) {
      cmdLines.push(``);
      cmdLines.push(`// ===== 特殊規則與能力 =====`);
      otherSkills.forEach(s => {
        let skillName = (s.customName || s.originalName).replace(/^(技能|能力)：/, '').replace(/\(定位技能\)/, '').trim();
        const desc = getPlainText(s.customDesc || s.originalDesc || '', s.selections, state.level, state.partyLevel, true);
        cmdLines.push(`【${skillName}】${desc.replace(/\n+/g, ' ')}`);
      });
    }

    // 狀態管理快捷
    cmdLines.push(``);
    cmdLines.push(`// ===== 狀態管理快捷 =====`);
    cmdLines.push(`:HP-`);
    cmdLines.push(`:HP+`);
    cmdLines.push(`:MP-`);
    cmdLines.push(`:MP+`);
    if (villainTier !== 'none' && villainInfo.up > 0) {
      cmdLines.push(`:UP-1`);
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
    md += `**【${rankDisplay}】${state.role}** ${state.villainTier !== 'none' && revealLevel === 'full' ? `(${VILLAIN_TIERS[state.villainTier].label} - UP ${VILLAIN_TIERS[state.villainTier].up})` : ''}\n`;

    if (isRevealed('stats')) {
      if (state.traits) md += `*特質: ${state.traits}*\n`;
      md += `\n**DEX ${stats.DEX.startsWith('d') ? stats.DEX : 'd' + stats.DEX} | INS ${stats.INS.startsWith('d') ? stats.INS : 'd' + stats.INS} | MIG ${stats.MIG.startsWith('d') ? stats.MIG : 'd' + stats.MIG} | WLP ${stats.WLP.startsWith('d') ? stats.WLP : 'd' + stats.WLP}**\n`;
      md += `**HP: ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP: ${stats.MP} | 先攻: ${stats.Init} | 物防 DEF: ${stats.Def} | 魔防 M.DEF: ${stats.MDef}**\n\n`;

      let affStr = "";
      DAMAGE_TYPES.forEach(t => {
        const aff = mergedAffinities[t];
        if (aff && aff !== 'normal') {
          const label = aff === 'vul' ? '弱點' : aff === 'res' ? '抗性' : aff === 'imm' ? '免疫' : '吸收';
          affStr += `* ${t}: ${label}\n`;
        }
      });
      if (affStr) md += affStr;
      if (stats.statusImmunities.length > 0) md += `* 異常免疫: ${stats.statusImmunities.join('、')}\n`;
      md += `\n`;
    } else {
      md += `**HP: ${stats.HP} (危機 ${Math.floor(stats.HP / 2)}) | MP: ${stats.MP} | 先攻: ?? | 物防 DEF: ?? | 魔防 M.DEF: ??**\n\n`;
    }

    if (revealLevel === 'full' && (state.selectedNegativeSkills || []).length > 0) {
      md += `#### 負面技能\n`;
      state.selectedNegativeSkills.forEach(neg => {
        const skill = NEGATIVE_SKILLS_DATA.find(s => s.id === neg.id);
        if (skill) {
          md += `> **${skill.originalName}**\n`;
          md += `> ${getPlainText(skill.originalDesc, neg.selections, state.level, state.partyLevel, true)}\n\n`;
        }
      });
    }

    if (isRevealed('combat')) {
      const validNpcName = state.name && state.name.trim() !== "" && state.name !== "未知實體" ? state.name.trim() : null;

      if (stats.spellList && stats.spellList.length > 0) {
        md += `#### 咒語\n`;
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
            md += `> ${formulaDisplay}${accStr} ✦ 魔法攻擊\n`;
          }
          if (spellData) {
            md += `> ${getPlainText(replacedEffect, selections, state.level, state.partyLevel, true).split('\n').join('\n> ')}\n`;
          }
          if (isSecretArtForSpell) {
            md += `> *(此咒語為祕技，除了目標之外沒有人會意識到那是什麼。)*\n`;
          }
          md += `\n`;
        });
      }

      md += `#### 基本攻擊與行動\n`;
      processedSkills.filter(s => !s.isOverBudget).forEach(s => {
        if (revealLevel !== 'full' && (s.source === 'bossSkill' || s.category === 'rule' || s.category === 'action')) return;
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
          const label = s.attack ? '攻擊' : s.category === 'spell' ? '咒語' : '技能';
          md += `> *(此${label}為祕技，除了目標之外沒有人會意識到那是什麼。)*\n`;
        }
        md += `\n`;
      });
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
