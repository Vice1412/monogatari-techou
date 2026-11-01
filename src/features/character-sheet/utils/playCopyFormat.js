/**
 * 跑團面板（CharacterPlayHUD）與隨身子系統 —— Discord 文字團專用複製格式器。
 *
 * 設計原則（對應 GEMINI.md 與 .agents/rules/10-code-rules.md）：
 * 1. 單一入口（Single Source of Truth）：所有「複製到剪貼簿」的文字組裝一律走本模組純函式，
 *    避免散落在各 JSX 的 onClick 內導致 SSR 無法測試。
 * 2. 動態數值展開：特技說明中的【SL × N】等公式，於複製時依角色當前 SL 即時算出數值，
 *    貼上 Discord 時隊友與 GM 直接看到最終數字，不需再心算 SL。
 * 3. 純中文與零 Emoji 鐵律：輸出文本嚴禁任何彩色 Emoji，僅使用封閉排版符號
 *    （【】、▸、｜、·、★、✦、❖）與 Discord 原生 Markdown（**粗體**、> 引用區塊）。
 * 4. 內部哨兵清理：自動清除舊版攻擊性咒語哨兵（\u26A1）與（o）/(o) 標記，轉為可讀文字。
 */

import { parseSkillFormulaSegments } from './skillFormulaEvaluator.jsx';
import { isSeedEffectActiveAt } from '../data/skillSuboptionsData.js';

const OFFENSIVE_SENTINEL = '\u26A1';

/**
 * 清理單行或多行文本中的內部標記（如 \u26A1、（o）、多餘空白）。
 * @param {string} text
 * @returns {string}
 */
export function cleanCopyInlineText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replaceAll(OFFENSIVE_SENTINEL, '')
    .replace(/^\s*[（(]o[)）]\s*/gm, '【攻】')
    .replace(/[（(]o[)）]/g, '（攻擊性咒語）')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * 將多行說明文字轉為 Discord 引用區塊（每行加上 `> `）。
 * @param {string} text
 * @returns {string}
 */
export function toDiscordQuoteBlock(text) {
  const cleaned = cleanCopyInlineText(text);
  if (!cleaned) return '';
  return cleaned
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimEnd();
      return trimmed ? `> ${trimmed}` : '>';
    })
    .join('\n');
}

/**
 * 將特技說明中的【SL】公式依當前 SL 展開為實際數值，供複製到 Discord 使用。
 * - 當 sl > 0 時：`【SL × 5】`（SL=3）→ `**【15】**`
 * - 當 sl <= 0 時：保留原始公式文字並清理內部標記
 *
 * @param {string} desc
 * @param {number} sl
 * @returns {string}
 */
export function evaluateSkillDescForCopy(desc, sl = 0, options = {}) {
  if (!desc || typeof desc !== 'string') return '';
  const numericSl = Number(sl) || 0;
  const segments = parseSkillFormulaSegments(desc, numericSl, options);
  const assembled = segments
    .map((seg) => {
      if (seg.type === 'formula') {
        if (seg.isCalculated && seg.evaluatedText) {
          return `**${seg.evaluatedText}**`;
        }
        return seg.evaluatedText || seg.raw || '';
      }
      if (seg.type === 'bold') {
        return `**${seg.content}**`;
      }
      return seg.content || '';
    })
    .join('');
  return cleanCopyInlineText(assembled);
}

/**
 * 組裝角色前綴（若有角色名稱則顯示 `角色名 ▸ `）。
 * @param {string} characterName
 * @returns {string}
 */
function buildCharPrefix(characterName) {
  const name = cleanCopyInlineText(characterName);
  return name ? `${name} ▸ ` : '';
}

/**
 * 1. 職業特技（Class Skill）複製格式
 */
export function formatSkillCopyText({
  className = '',
  name = '',
  skillName = '',
  sl = 0,
  maxSL = 0,
  maxSl = 0,
  desc = '',
  isVariant = false,
  suboptions = [],
  characterLevel = 0,
  character = null,
  characterName = ''
} = {}) {
  const cleanName = cleanCopyInlineText(name || skillName);
  if (!cleanName) return '';
  const cleanClass = cleanCopyInlineText(className);
  const numSl = Number(sl) || 0;
  const numMax = Number(maxSL || maxSl) || 0;
  const variantBit = isVariant ? ' · 公測變體' : '';
  const slTag =
    numSl > 0
      ? numMax > 0
        ? `（SL ${numSl}/${numMax}${variantBit}）`
        : `（SL ${numSl}${variantBit}）`
      : isVariant
        ? '（公測變體）'
        : '';
  const titleInner = cleanClass ? `${cleanClass}｜${cleanName}` : cleanName;
  const header = `**${buildCharPrefix(characterName)}【${titleInner}】**${slTag}`;
  const evaluated = evaluateSkillDescForCopy(desc, numSl, {
    level: characterLevel,
    characterLevel,
    character
  });
  const bodyLines = [evaluated || '無效果說明'];
  if (Array.isArray(suboptions) && suboptions.length > 0) {
    bodyLines.push(`已選細項：${suboptions.map(cleanCopyInlineText).filter(Boolean).join('、')}`);
  }
  const quote = toDiscordQuoteBlock(bodyLines.join('\n'));
  return quote ? `${header}\n${quote}` : header;
}

/**
 * 2. 技能子項目（舞步、音調、曲風、心靈天賦、突變形態、魔法種子、徽記等）複製格式
 */
export function formatSuboptionCopyText({
  className = '',
  skillName = '',
  parentSkillName = '',
  categoryLabel = '',
  suboptionCategory = '',
  detail = null,
  characterName = ''
} = {}) {
  if (!detail || typeof detail !== 'object') return '';
  const rawName = String(detail.name || '').trim();
  if (!rawName) return '';

  const hasOffensive =
    /^\s*[（(]o[)）]/.test(rawName) || rawName.includes(OFFENSIVE_SENTINEL) || Boolean(detail.isOffensive);
  const cleanName = rawName
    .replaceAll(OFFENSIVE_SENTINEL, '')
    .replace(/^\s*[（(]o[)）]\s*/, '')
    .trim();
  if (!cleanName) return '';

  const context = cleanCopyInlineText(
    skillName || parentSkillName || categoryLabel || suboptionCategory || className || '子項目'
  );
  const header = `**${buildCharPrefix(characterName)}【${context}｜${cleanName}】**${hasOffensive ? '（攻擊性）' : ''}`;

  const metaParts = [];
  const rawMp = detail.cost || (detail.mp ? (String(detail.mp).toUpperCase().includes('MP') ? String(detail.mp) : `${detail.mp} MP`) : '');
  if (rawMp) metaParts.push(`消耗：${cleanCopyInlineText(rawMp)}`);
  if (detail.target) metaParts.push(`目標：${cleanCopyInlineText(detail.target)}`);
  if (detail.duration) metaParts.push(`持續：${cleanCopyInlineText(detail.duration)}`);
  if (detail.event) metaParts.push(`時機：${cleanCopyInlineText(detail.event)}`);

  const bodyLines = [];
  if (detail.quote) {
    bodyLines.push(`「${cleanCopyInlineText(detail.quote)}」`);
  }
  if (detail.examples) {
    bodyLines.push(`象徵範例：${cleanCopyInlineText(detail.examples)}`);
  }
  if (Array.isArray(detail.effects) && detail.effects.length > 0) {
    for (const ef of detail.effects) {
      if (ef && ef.text) {
        bodyLines.push(`【${cleanCopyInlineText(ef.clock || '效果')}】${cleanCopyInlineText(ef.text)}`);
      }
    }
  } else if (detail.effects && typeof detail.effects === 'object') {
    for (const [k, v] of Object.entries(detail.effects)) {
      if (!v) continue;
      const tierLabel = k === '0-3' ? '0~3 格' : `${k} 格`;
      bodyLines.push(`【${tierLabel}】${cleanCopyInlineText(v)}`);
    }
  } else {
    const rawBody = detail.effect || detail.desc || '';
    if (rawBody) bodyLines.push(cleanCopyInlineText(rawBody));
  }

  const lines = [header];
  if (metaParts.length > 0) lines.push(metaParts.join(' ｜ '));
  const quote = toDiscordQuoteBlock(bodyLines.join('\n'));
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 3. 英雄技能（Heroic Skill）複製格式
 */
export function formatHeroicSkillCopyText({
  name = '',
  className = '',
  classReq = '',
  sourceLabel = '',
  reqText = '',
  effect = '',
  desc = '',
  characterLevel = 0,
  character = null,
  characterName = ''
} = {}) {
  const cleanName = cleanCopyInlineText(name);
  if (!cleanName) return '';
  const tag = cleanCopyInlineText(className || classReq || sourceLabel || '英雄技能');
  const header = `**${buildCharPrefix(characterName)}★【${tag}｜${cleanName}】**`;
  const lines = [header];
  const cleanReq = cleanCopyInlineText(reqText);
  if (cleanReq) lines.push(`前置需求：${cleanReq}`);
  const rawBody = effect || desc || '無效果說明';
  const evaluated = evaluateSkillDescForCopy(rawBody, 0, {
    level: characterLevel,
    characterLevel,
    character
  });
  const quote = toDiscordQuoteBlock(evaluated);
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 4. 金手指（Quirk）複製格式
 */
export function formatQuirkCopyText({
  name = '',
  type = '',
  choiceSummary = '',
  effectSummary = '',
  effect = '',
  desc = '',
  characterLevel = 0,
  character = null,
  characterName = ''
} = {}) {
  const cleanName = cleanCopyInlineText(name);
  if (!cleanName) return '';
  const typeTag = type ? `（${cleanCopyInlineText(type)}）` : '';
  const header = `**${buildCharPrefix(characterName)}✦【金手指｜${cleanName}】**${typeTag}`;
  const lines = [header];
  const cleanChoice = cleanCopyInlineText(choiceSummary || effectSummary);
  if (cleanChoice) lines.push(`已選配置：${cleanChoice}`);
  const rawBody = effect || desc || '無效果說明';
  const evaluated = evaluateSkillDescForCopy(rawBody, 0, {
    level: characterLevel,
    characterLevel,
    character
  });
  const quote = toDiscordQuoteBlock(evaluated);
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 5. 咒語（Spell）複製格式
 */
export function formatSpellCopyText({
  spell = null,
  name = '',
  school = '',
  className = '',
  mp = '',
  target = '',
  duration = '',
  isOffensive: flatOffensive = false,
  effect = '',
  desc = '',
  checkFormula = '',
  damageFormula = '',
  characterName = ''
} = {}) {
  const sp = spell && typeof spell === 'object'
    ? spell
    : { name, school: school || className, mp, target, duration, isOffensive: flatOffensive, effect: effect || desc };
  const rawName = String(sp.name || '').trim();
  if (!rawName) return '';

  const isOffensive =
    Boolean(sp.isOffensive) ||
    rawName.includes(OFFENSIVE_SENTINEL) ||
    /^\s*[（(]o[)）]/.test(rawName);
  const cleanName = rawName
    .replaceAll(OFFENSIVE_SENTINEL, '')
    .replace(/^\s*[（(]o[)）]\s*/, '')
    .trim();
  if (!cleanName) return '';

  const schoolRaw = sp.school || sp.className || '';
  const schoolTag = schoolRaw ? `${cleanCopyInlineText(schoolRaw)}咒語` : '咒語';
  const header = `**${buildCharPrefix(characterName)}【${schoolTag}｜${cleanName}】**${isOffensive ? '（攻擊性咒語）' : ''}`;

  const mpText = cleanCopyInlineText(sp.mp || '—');
  const targetText = cleanCopyInlineText(sp.target || '—');
  const durationText = cleanCopyInlineText(sp.duration || '瞬發');
  const metaLine = `消耗：${mpText} ｜ 目標：${targetText} ｜ 持續時間：${durationText}`;

  const lines = [header, metaLine];
  if (isOffensive && (checkFormula || damageFormula)) {
    const formulaParts = [];
    if (checkFormula) formulaParts.push(`魔法檢定：${cleanCopyInlineText(checkFormula)}`);
    if (damageFormula) formulaParts.push(`傷害：${cleanCopyInlineText(damageFormula)}`);
    if (formulaParts.length > 0) lines.push(formulaParts.join(' ｜ '));
  }

  const quote = toDiscordQuoteBlock(sp.effect || sp.desc || '無效果說明');
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 6. 武器（Weapon）複製格式
 */
export function formatWeaponCopyText({
  weapon = null,
  slotLabel = '武器',
  check = null,
  damage = null,
  characterName = ''
} = {}) {
  if (!weapon || typeof weapon !== 'object') return '';
  const cleanName = cleanCopyInlineText(weapon.name);
  if (!cleanName) return '';

  const tags = [
    cleanCopyInlineText(weapon.type || weapon.range),
    cleanCopyInlineText(weapon.category),
    weapon.hands ? `${weapon.hands}手` : ''
  ].filter(Boolean);
  const tagSuffix = tags.length > 0 ? `（${tags.join(' · ')}）` : '';
  const header = `**${buildCharPrefix(characterName)}【${cleanCopyInlineText(slotLabel || '武器')}｜${cleanName}】**${tagSuffix}`;

  const statParts = [];
  if (check && check.formula) {
    statParts.push(`命中：${cleanCopyInlineText(check.formula)}${check.diceStr ? ` (${cleanCopyInlineText(check.diceStr)})` : ''}`);
  }
  if (damage && damage.text) {
    statParts.push(`傷害：${cleanCopyInlineText(damage.text)}${damage.type ? ` ${cleanCopyInlineText(damage.type)}` : ''}`);
  }
  const defMod = Number(weapon.defBonus) || 0;
  const mdefMod = Number(weapon.mdefBonus) || 0;
  if (defMod !== 0) statParts.push(`物防 ${defMod > 0 ? `+${defMod}` : defMod}`);
  if (mdefMod !== 0) statParts.push(`魔防 ${mdefMod > 0 ? `+${mdefMod}` : mdefMod}`);

  const lines = [header];
  if (statParts.length > 0) lines.push(statParts.join(' ｜ '));

  const rawDesc = weapon.desc || weapon.effectText || weapon.quality || '無特殊效果';
  const quote = toDiscordQuoteBlock(rawDesc);
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 7. 防具／盾牌／飾品（Equipment）複製格式
 */
export function formatEquipmentCopyText({
  slotLabel = '裝備',
  item = null,
  characterName = ''
} = {}) {
  if (!item || typeof item !== 'object') return '';
  const cleanName = cleanCopyInlineText(item.name);
  if (!cleanName) return '';

  const header = `**${buildCharPrefix(characterName)}【${cleanCopyInlineText(slotLabel || '裝備')}｜${cleanName}】**`;
  const statParts = [];
  if (item.def !== undefined && item.def !== null && item.def !== '') {
    statParts.push(`物防：${cleanCopyInlineText(item.def)}`);
  }
  if (item.mdef !== undefined && item.mdef !== null && item.mdef !== '') {
    statParts.push(`魔防：${cleanCopyInlineText(item.mdef)}`);
  }
  const defBonus = Number(item.defBonus) || 0;
  const mdefBonus = Number(item.mdefBonus) || 0;
  if (defBonus !== 0) statParts.push(`物防 ${defBonus > 0 ? `+${defBonus}` : defBonus}`);
  if (mdefBonus !== 0) statParts.push(`魔防 ${mdefBonus > 0 ? `+${mdefBonus}` : mdefBonus}`);
  const initMod = Number(item.init) || 0;
  if (initMod !== 0) statParts.push(`先攻 ${initMod > 0 ? `+${initMod}` : initMod}`);

  const lines = [header];
  if (statParts.length > 0) lines.push(statParts.join(' ｜ '));
  const quote = toDiscordQuoteBlock(item.desc || item.effectText || item.quality || '無特殊效果');
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 8. 秘儀師阿爾卡納（Arcana）複製格式
 */
export function formatArcanaCopyText({
  arcana = null,
  sections = [],
  usesVariant = false,
  hasPulseSkill = false,
  charLevel = 1,
  characterLevel = null,
  onlyKey = '',
  characterName = ''
} = {}) {
  if (!arcana || typeof arcana !== 'object') return '';
  const cleanName = cleanCopyInlineText(arcana.name);
  if (!cleanName) return '';

  const isVariant = Boolean(usesVariant || arcana.isVariant);
  const showPulse = Boolean(isVariant || hasPulseSkill);
  const titleSuffix = arcana.title ? ` — ${cleanCopyInlineText(arcana.title)}` : '';
  const header = `**${buildCharPrefix(characterName)}✦【阿爾卡納｜${cleanName}${titleSuffix}】**`;
  const lines = [header];

  if (arcana.domains) {
    lines.push(`領域：${cleanCopyInlineText(arcana.domains)}`);
  }

  const numLv = Number(characterLevel ?? charLevel) || 1;
  const levelDamageBonus = isVariant
    ? (numLv >= 40 ? 10 : numLv >= 20 ? 5 : 0)
    : (numLv >= 40 ? 20 : numLv >= 20 ? 10 : 0);
  const resolvedSections =
    Array.isArray(sections) && sections.length > 0
      ? sections
      : [
          { key: 'merge', label: '連攜常駐增益', text: arcana.merge || '' },
          ...(showPulse
            ? [{ key: 'pulse', label: '脈衝（技能動作）', text: arcana.pulse || '此阿爾卡納為核心版，沒有脈衝效果。' }]
            : []),
          { key: 'dismiss', label: '解除爆發效果', text: arcana.dismiss || '' }
        ];
  const filtered = onlyKey
    ? resolvedSections.filter((s) => s.key === onlyKey)
    : resolvedSections;

  const bodyParts = filtered.map((sec) => {
    const label = cleanCopyInlineText(sec.label || sec.key);
    const text = cleanCopyInlineText(sec.text || '尚未填寫效果。');
    const bonusNote =
      levelDamageBonus > 0 && (sec.key === 'pulse' || sec.key === 'dismiss')
        ? `（等級 ${numLv} 傷害 +${levelDamageBonus}）`
        : '';
    return `【${label}】${bonusNote}\n${text}`;
  });

  const quote = toDiscordQuoteBlock(bodyParts.join('\n\n'));
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 9. 擬態師／青魔法（Chimerist Spell）複製格式
 */
export function formatChimeristSpellCopyText({
  spell = null,
  checkFormula = '',
  hasViciousCycle = false,
  characterName = ''
} = {}) {
  if (!spell || typeof spell !== 'object') return '';
  const rawName = String(spell.name || '').trim();
  if (!rawName) return '';

  const isOffensive =
    Boolean(spell.isOffensive) ||
    rawName.includes(OFFENSIVE_SENTINEL) ||
    /^\s*[（(]o[)）]/.test(rawName);
  const cleanName = rawName
    .replaceAll(OFFENSIVE_SENTINEL, '')
    .replace(/^\s*[（(]o[)）]\s*/, '')
    .trim();
  if (!cleanName) return '';

  const originBits = [cleanCopyInlineText(spell.fromMonster), cleanCopyInlineText(spell.species)].filter(Boolean);
  const speciesTag = originBits.length > 0 ? `（來源：${originBits.join(' · ')}）` : '';
  const header = `**${buildCharPrefix(characterName)}【青魔法｜${cleanName}】**${speciesTag}${isOffensive ? '（攻擊性）' : ''}`;

  const metaParts = [
    `消耗：${cleanCopyInlineText(spell.mp || '—')}`,
    `目標：${cleanCopyInlineText(spell.target || '—')}`,
    `持續時間：${cleanCopyInlineText(spell.duration || '瞬發')}`
  ];
  if (checkFormula || spell.attr) metaParts.push(`檢定：${cleanCopyInlineText(checkFormula || spell.attr)}`);

  const bodyLines = [cleanCopyInlineText(spell.effect || spell.desc || '無效果說明')];
  if (hasViciousCycle) {
    bodyLines.push(`※【惡性循環】若目標是${cleanCopyInlineText(spell.species || '該種族')}，目標同時陷入中毒狀態。`);
  }

  const lines = [header, metaParts.join(' ｜ ')];
  const quote = toDiscordQuoteBlock(bodyLines.join('\n'));
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 10. 花匠培育盆栽（Florist Magiseed）複製格式
 */
export function formatFloristSeedCopyText({
  seedName = '',
  clock = 0,
  clockFilled = null,
  seedDef = null,
  detail = null,
  characterName = ''
} = {}) {
  const def = seedDef || detail;
  const cleanName = cleanCopyInlineText(seedName || def?.name || '');
  if (!cleanName) return '';

  const numClock = Math.max(0, Math.min(4, Number(clockFilled ?? clock) || 0));
  const statusTag =
    numClock === 0 ? '剛播種' : numClock >= 4 ? '滿 4 格離園' : `第 ${numClock} 回合`;
  const header = `**${buildCharPrefix(characterName)}【花匠花園｜${cleanName}】**（生長命刻：${numClock}/4 格 · ${statusTag}）`;

  const bodyLines = [];
  const effects = def?.effects;
  if (Array.isArray(effects) && effects.length > 0) {
    for (const ef of effects) {
      if (!ef || !ef.text) continue;
      const active = isSeedEffectActiveAt(ef.clock, numClock);
      const marker = active ? '✦ [生效中]' : '·';
      bodyLines.push(`${marker}【${cleanCopyInlineText(ef.clock)}】${cleanCopyInlineText(ef.text)}`);
    }
  } else if (effects && typeof effects === 'object') {
    if (numClock >= 1 && numClock <= 3 && effects[numClock]) {
      bodyLines.push(`✦ [生效中]【${numClock} 格】${cleanCopyInlineText(effects[numClock])}`);
    }
    for (const tier of [1, 2, 3]) {
      if (effects[tier] && tier !== numClock) {
        bodyLines.push(`·【${tier} 格】${cleanCopyInlineText(effects[tier])}`);
      }
    }
  }

  const lines = [header];
  const quote = toDiscordQuoteBlock(bodyLines.join('\n'));
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 11. 底力技（Zero Power）複製格式
 */
export function formatZeroPowerCopyText({
  name = '',
  triggerName = '',
  triggerFillLabel = '',
  triggerText = '',
  effectName = '',
  effectText = '',
  filled = 0,
  clockFilled = null,
  max = 6,
  clockMax = null,
  partnerName = '',
  characterName = '',
  characterLevel = null,
  character = null
} = {}) {
  const cleanName = cleanCopyInlineText(name) || '未命名底力技';
  const cleanTrig = cleanCopyInlineText(triggerName);
  const cleanEff = cleanCopyInlineText(effectName);
  if (!cleanTrig && !cleanEff && !cleanCopyInlineText(name)) return '';

  const evalOptions = { level: characterLevel, characterLevel, character };
  const evaluatedTrigger = evaluateSkillDescForCopy(triggerText, 0, evalOptions);
  const evaluatedEffect = evaluateSkillDescForCopy(effectText, 0, evalOptions);

  const numFilled = Math.max(0, Number(clockFilled ?? filled) || 0);
  const numMax = Math.max(1, Number(clockMax ?? max) || 6);
  const partnerBit = partnerName ? ` · 與 ${cleanCopyInlineText(partnerName)} 合體` : '';
  const header = `**${buildCharPrefix(characterName)}★【底力技｜${cleanName}】**（命刻：${numFilled}/${numMax}${partnerBit}）`;

  const bodyLines = [];
  if (cleanTrig || triggerText) {
    const fillSuffix = triggerFillLabel ? `（${cleanCopyInlineText(triggerFillLabel)}）` : '';
    bodyLines.push(`【底力觸發：${cleanTrig || '未選擇'}】${fillSuffix}`);
    if (evaluatedTrigger) bodyLines.push(cleanCopyInlineText(evaluatedTrigger));
  }
  if (cleanEff || effectText) {
    if (bodyLines.length > 0) bodyLines.push('');
    bodyLines.push(`【底力效果：${cleanEff || '未選擇'}】`);
    if (evaluatedEffect) bodyLines.push(cleanCopyInlineText(evaluatedEffect));
  }

  const lines = [header];
  const quote = toDiscordQuoteBlock(bodyLines.join('\n'));
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 12. 營地活動（Camp Activity）複製格式
 */
export function formatCampActivityCopyText({
  activity = null,
  name = '',
  targetLabel = '',
  page = '',
  desc = '',
  table = null,
  once = false,
  used = false,
  modeNote = '',
  characterName = ''
} = {}) {
  const act = activity && typeof activity === 'object'
    ? activity
    : { name, target: targetLabel, page, desc, table, once };
  const cleanName = cleanCopyInlineText(act.name);
  if (!cleanName) return '';

  const targetStr = cleanCopyInlineText(targetLabel || act.target || '');
  const usedBit = used ? ' · 本次休息已使用' : '';
  const targetSuffix = targetStr ? `（目標：${targetStr}${usedBit}）` : usedBit ? `（${usedBit.slice(3)}）` : '';
  const header = `**${buildCharPrefix(characterName)}【營地活動｜${cleanName}】**${targetSuffix}`;

  const bodyLines = [];
  if (act.desc) bodyLines.push(cleanCopyInlineText(act.desc));
  if (modeNote) bodyLines.push(`※ ${cleanCopyInlineText(modeNote)}`);
  if (Array.isArray(act.table) && act.table.length > 0) {
    for (const row of act.table) {
      const rowText = row && (row.text || row.effect);
      if (row && row.roll && rowText) {
        bodyLines.push(`· 【d6 = ${cleanCopyInlineText(row.roll)}】${cleanCopyInlineText(rowText)}`);
      }
    }
  }
  if (act.once) {
    bodyLines.push('※ 直到下一次休息前限一次。');
  }

  const lines = [header];
  const quote = toDiscordQuoteBlock(bodyLines.join('\n'));
  if (quote) lines.push(quote);
  return lines.join('\n');
}

/**
 * 13. 通用隨身子系統條目（修補匠小工具、機師模組、旅人夥伴、亡靈僕從、王牌卡牌等）複製格式
 */
export function formatCompanionItemCopyText({
  category = '',
  name = '',
  meta = '',
  subtitle = '',
  desc = '',
  lines: bodyArr = [],
  characterName = ''
} = {}) {
  const cleanName = cleanCopyInlineText(name);
  if (!cleanName) return '';
  const cleanCat = cleanCopyInlineText(category);
  const titleInner = cleanCat ? `${cleanCat}｜${cleanName}` : cleanName;
  const header = `**${buildCharPrefix(characterName)}【${titleInner}】**`;

  const outLines = [header];
  const cleanMeta = cleanCopyInlineText(meta || subtitle);
  if (cleanMeta) outLines.push(cleanMeta);
  const rawBody = Array.isArray(bodyArr) && bodyArr.length > 0 ? bodyArr.join('\n') : desc;
  const quote = toDiscordQuoteBlock(rawBody || '無效果說明');
  if (quote) outLines.push(quote);
  return outLines.join('\n');
}

/**
 * 14. 擲骰結果（Dice Roller Result）複製格式
 */
export function formatRollResultCopyText({
  label = '',
  die1Type = 8,
  die2Type = 8,
  rollResult = null,
  die1 = null,
  die2 = null,
  modifier = 0,
  total = null,
  hr = null,
  isCritical = false,
  isFumble = false,
  fpBonus = 0,
  usedBondName = '',
  bondName = '',
  finalCheckTotal = null,
  effectiveHr = null,
  zeroHr = false,
  totalDamage = null,
  damageBonus = 0,
  extraDamage = 0,
  damageType = '',
  isRerolled = false,
  characterName = ''
} = {}) {
  const res = rollResult && typeof rollResult === 'object'
    ? rollResult
    : { die1, die2, modifier, total, hr, isCritical, isFumble };
  if (typeof res.total !== 'number' || Number.isNaN(res.total)) return '';

  const totalVal =
    typeof finalCheckTotal === 'number' && !Number.isNaN(finalCheckTotal)
      ? finalCheckTotal
      : typeof rollResult?.total === 'number'
        ? rollResult.total + (Number(fpBonus) || 0)
        : res.total;
  const hrVal =
    typeof effectiveHr === 'number' && !Number.isNaN(effectiveHr)
      ? effectiveHr
      : zeroHr === true
        ? 0
        : res.hr;

  let outcomeTag = '';
  if (res.isCritical === true) outcomeTag = '【大成功！】';
  else if (res.isFumble === true) outcomeTag = '【大失敗！】';
  else if (isRerolled === true) outcomeTag = '【重擲】';

  const cleanLabel = cleanCopyInlineText(label) || '屬性檢定';
  const header = `**${buildCharPrefix(characterName)}【檢定｜${cleanLabel}】${outcomeTag} 總計 ${totalVal}**`;

  const d1Label = die1Type ? `d${die1Type}` : '骰';
  const d2Label = die2Type ? `d${die2Type}` : '骰';
  const diceParts = [];
  if (typeof res.die1 === 'number') diceParts.push(`${d1Label}[${res.die1}]`);
  if (typeof res.die2 === 'number') diceParts.push(`${d2Label}[${res.die2}]`);

  let breakdown = diceParts.join(' + ');
  const mod = Number(res.modifier) || 0;
  if (mod > 0) breakdown += ` + ${mod}`;
  else if (mod < 0) breakdown += ` - ${Math.abs(mod)}`;

  const bondMod = Number(fpBonus) || 0;
  if (bondMod > 0) {
    const cleanBond = cleanCopyInlineText(usedBondName || bondName);
    breakdown += ` + 羈絆 ${bondMod}${cleanBond ? `（${cleanBond}）` : ''}`;
  }
  breakdown += ` = **${totalVal}**`;
  if (typeof hrVal === 'number' && !Number.isNaN(hrVal)) {
    breakdown += ` ｜ HR **${hrVal}**${zeroHr === true ? '（視為 0）' : ''}`;
  }

  const bodyLines = [breakdown];
  if (typeof totalDamage === 'number' && !Number.isNaN(totalDamage)) {
    const flatBonus = (Number(damageBonus) || 0) + (Number(extraDamage) || 0);
    const cleanDmgType = cleanCopyInlineText(damageType);
    bodyLines.push(
      `傷害結算：HR ${hrVal ?? 0} + ${flatBonus} = **${totalDamage}**${cleanDmgType ? `（${cleanDmgType}）` : ''}`
    );
  }

  const quote = toDiscordQuoteBlock(bodyLines.join('\n'));
  return quote ? `${header}\n${quote}` : header;
}

/**
 * 瀏覽器剪貼簿寫入輔助（含舊版 execCommand 回退與 SSR 安全防呆）。
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  if (!text || typeof text !== 'string') return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 繼續嘗試下方 textarea 回退
    }
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch {
      return false;
    }
  }
  return false;
}
