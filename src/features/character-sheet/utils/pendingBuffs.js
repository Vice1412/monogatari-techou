/**
 * 場景與回合跨角色暫存增益隊列及技能執行模組
 *
 * 規則依據（依官方英文正式版為準）：
 * 1. 【靈師：支援魔法】（Core p.207，maxSL 1）：
 *    - 花費 0 MP；須裝備奧術武器，並選擇 1 名對其擁有羈絆的盟友作為目標。
 *    - 該盟友在當前場景中進行的下一次檢定獲得【對該盟友之羈絆強度】的加值。
 * 2. 【吟唱者：我相信你】（Core p.201，maxSL 2）：
 *    - 花費 1 點物語點（FP），引用能聽見你的另一名 PC 之特質或羈絆，讓其重擲骰子或改善檢定結果；
 *    - 若你對該角色擁有羈絆，其額外恢復【SL × 10】點 MP。
 * 3. 【吟唱者：能言善辯】（Core p.201，maxSL 2）：
 *    - 透過魅力／外交／欺騙／威嚇成功推進或清除命刻時，花費最多【SL × 20】點 MP，
 *      每花費 20 點 MP 可額外推進或清除 1 格刻度。
 * 4. 【機師：壓縮技術】（TF Atlas p.159 & p.165，maxSL 1）：
 *    - 收納（需載具無人駕駛 `!isMounted`）：0 IP，安全將個人載具從遊戲世界中移除（`inWorld: false`）。
 *    - 召喚（當 `inWorld === false` 且空間足夠）：執行使用庫存動作花費 2 IP（外骨骼骨架 0 IP），
 *      讓載具重新出現並立即免費進入駕駛狀態（`inWorld: true, isMounted: true`）。
 */

import { resolveVitalResources, getCharacterSkillSL } from './characterEngine';
import { loggableChange } from './characterLog';
import { applyFabulaPointsFlow, FP_DIRECTIONS } from './fabulaPointsFlow';
import { evaluateCondition } from './effectConditions';
import { PILOT_FRAMES, PILOT_WEAPON_MODULES } from '../data/pilotVehicleData';
import { findClock, addClockSegments } from './fateClocks';

/**
 * 讀取角色的暫存增益陣列。
 */
export function getPendingBuffs(character) {
  return Array.isArray(character?.pendingBuffs) ? character.pendingBuffs : [];
}

/**
 * 新增一條暫存增益（純函式）。
 */
export function addPendingBuff(character, buff) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的角色物件' };
  }
  const buffs = getPendingBuffs(character);
  const newBuff = {
    id: `buff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sourceSkill: buff?.sourceSkill || '未知技能',
    targetName: buff?.targetName || '隊友',
    effectDesc: buff?.effectDesc || '待生效增益',
    scope: buff?.scope === 'persistent' ? 'persistent' : 'scene',
    meta: buff?.meta && typeof buff.meta === 'object' ? buff.meta : {},
    createdAt: new Date().toISOString()
  };

  return {
    ok: true,
    buff: newBuff,
    character: {
      ...character,
      pendingBuffs: [...buffs, newBuff],
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * 移除指定 ID 的暫存增益（純函式）。
 */
export function removePendingBuff(character, buffId) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的角色物件' };
  }
  const buffs = getPendingBuffs(character);
  const nextBuffs = buffs.filter((b) => b.id !== buffId);
  return {
    ok: true,
    character: {
      ...character,
      pendingBuffs: nextBuffs,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * 清空全部暫存增益（純函式）。
 */
export function clearPendingBuffs(character) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的角色物件' };
  }
  return {
    ok: true,
    character: {
      ...character,
      pendingBuffs: [],
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * 清空「場景級（scope === 'scene'）」的暫存增益（於重置場景時同步呼叫）。
 */
export function clearScenePendingBuffs(character) {
  if (!character || typeof character !== 'object') return character;
  const buffs = getPendingBuffs(character);
  if (buffs.length === 0) return character;
  const kept = buffs.filter((b) => b && b.scope === 'persistent');
  if (kept.length === buffs.length) return character;
  return {
    ...character,
    pendingBuffs: kept,
    updatedAt: new Date().toISOString()
  };
}

/**
 * 檢查角色目前是否裝備「奧術」類別武器（支援主副手標準/自訂武器，以及機師已駕駛且啟用奧術模組的載具）。
 * 回傳 `'true' | 'false' | 'unknown'`（複用效果條件引擎的裝備解析）。
 */
export function arcaneWeaponStatus(character) {
  if (!character || typeof character !== 'object') return 'false';
  const vehicle = character.pilotVehicle;
  if (vehicle && vehicle.inWorld !== false && vehicle.isMounted) {
    const activeIds = Array.isArray(vehicle.activeModules) ? vehicle.activeModules : [];
    const hasArcaneModule = PILOT_WEAPON_MODULES.some(
      (m) => activeIds.includes(m.id) && m.category === '奧術'
    );
    if (hasArcaneModule) return 'true';
  }
  return evaluateCondition({ kind: 'equippedCategoryCount', category: '奧術', min: 1 }, character);
}

/**
 * 1. 【靈師：支援魔法】（Core p.207）
 * 花費 0 MP，須裝備奧術武器並對目標盟友擁有羈絆；
 * 該盟友在當前場景的下次檢定獲得【對該盟友之羈絆強度】加值。
 */
export function applySupportMagic(character, options = {}) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的角色物件' };
  }
  const {
    targetName: rawTarget = '',
    bondId = '',
    bondStrength: explicitStrength = null,
    effectDesc: customDesc = ''
  } = options || {};

  const arcaneStatus = arcaneWeaponStatus(character);
  if (arcaneStatus === 'false') {
    return {
      ok: false,
      character,
      reason: '發動【支援魔法】需要裝備「奧術」類別武器（目前未裝備）'
    };
  }

  const bonds = Array.isArray(character.bonds) ? character.bonds : [];
  const matchedBond = bonds.find((b) => {
    if (!b) return false;
    if (bondId && b.id === bondId) return true;
    const t = String(rawTarget || '').trim();
    return Boolean(t) && String(b.target || '').trim() === t;
  }) || null;

  const targetName = String(matchedBond?.target || rawTarget || '').trim();
  if (!targetName) {
    return { ok: false, character, reason: '請選擇一位擁有羈絆的目標盟友' };
  }

  const computedBondStrength = matchedBond
    ? (Array.isArray(matchedBond.feelings) ? matchedBond.feelings.length : 0)
    : Math.max(0, Math.floor(Number(explicitStrength) || 0));

  if (computedBondStrength <= 0) {
    return {
      ok: false,
      character,
      reason: `你目前對「${targetName}」沒有建立帶情感的羈絆，無法發動【支援魔法】`
    };
  }

  const effectDesc = customDesc
    || `本場景下一次檢定獲得 +${computedBondStrength} 加值（等於羈絆強度 · 需已對其施放咒語）`;

  const res = addPendingBuff(character, {
    sourceSkill: '支援魔法',
    targetName,
    effectDesc,
    scope: 'scene',
    meta: { mpCost: 0, bonus: computedBondStrength, bondId: matchedBond?.id || '' }
  });
  if (!res.ok) return res;

  const logged = loggableChange(character, res.character, {
    kind: 'skill',
    title: `發動【支援魔法】：${targetName} 本場景下次檢定 +${computedBondStrength}`,
    note: '消耗 0 MP（裝備奧術武器＋以羈絆強度加成）'
  });

  return {
    ok: true,
    character: logged,
    buff: res.buff,
    outcome: { mpCost: 0, targetName, bonus: computedBondStrength }
  };
}

/**
 * 2. 【吟唱者：我相信你】（Core p.201）
 * 花費 1 點物語點（FP），觸發能聽見你之另一名 PC 的特質或羈絆以重擲或改善檢定結果；
 * 若你對該角色擁有羈絆，該角色額外恢復【SL × 10】點 MP。
 */
export function applyIBelieveInYou(character, options = {}) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的角色物件' };
  }
  const {
    targetName: rawTarget = '',
    sl: passedSL = null,
    hasBond: explicitBond = null,
    traitOrBond = '',
    mode = 'reroll',
    effectDesc: customDesc = ''
  } = options || {};

  const targetName = String(rawTarget || '').trim();
  if (!targetName) {
    return { ok: false, character, reason: '請指定支援的玩家角色名稱' };
  }

  const skillSL = passedSL !== null && passedSL !== undefined
    ? Math.max(1, Math.min(2, Math.floor(Number(passedSL) || 1)))
    : Math.max(1, Math.min(2, getCharacterSkillSL(character, '我相信你') || 1));

  const bonds = Array.isArray(character.bonds) ? character.bonds : [];
  const matchedBond = bonds.find((b) => b && String(b.target || '').trim() === targetName) || null;
  const isBonded = explicitBond === null ? Boolean(matchedBond) : Boolean(explicitBond);
  const allyMpRecovery = isBonded ? skillSL * 10 : 0;

  const trimmedTrait = String(traitOrBond || '').trim();
  const fpReason = `發動【我相信你】支援 ${targetName}${trimmedTrait ? `（引用：${trimmedTrait}）` : ''}`;

  const fpResult = applyFabulaPointsFlow(character, {
    direction: FP_DIRECTIONS.spend,
    amount: 1,
    reason: fpReason
  });
  if (!fpResult.ok) {
    return {
      ok: false,
      character,
      reason: fpResult.flow?.errors?.amount || fpResult.flow?.errors?.reason || '物語點不足（需要 1 點 FP）'
    };
  }

  const modeDesc = mode === 'bonus'
    ? '提升該次檢定結果 +2'
    : '重擲該次檢定中的部分或全部骰子';
  const recoveryText = allyMpRecovery > 0
    ? `；因具備羈絆，${targetName} 恢復 ${allyMpRecovery} 點 MP`
    : '';
  const traitText = trimmedTrait ? `（引用特質／羈絆：${trimmedTrait}）` : '';
  const effectDesc = customDesc || `消耗 1 點物語點讓 ${targetName} ${modeDesc}${traitText}${recoveryText}`;

  const buffRes = addPendingBuff(fpResult.character, {
    sourceSkill: '我相信你',
    targetName,
    effectDesc,
    scope: 'scene',
    meta: { fpCost: 1, sl: skillSL, hasBond: isBonded, allyMpRecovery, mode, traitOrBond: trimmedTrait }
  });
  if (!buffRes.ok) return buffRes;

  return {
    ok: true,
    character: buffRes.character,
    buff: buffRes.buff,
    outcome: {
      fpCost: 1,
      sl: skillSL,
      hasBond: isBonded,
      allyMpRecovery,
      targetName,
      remainingFp: fpResult.flow.next
    }
  };
}

/**
 * 3. 【吟唱者：能言善辯】（Core p.201）
 * 依魅力／外交／欺騙／威嚇進行命刻檢定成功後，花費 `ticks × 20` 點 MP（至多 SL 格 / SL × 20 MP），
 * 每 20 MP 額外填滿或清除 1 格命刻刻度。
 */
export function applySmoothTalker(character, options = {}, statsOverride = null) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的角色物件' };
  }
  const {
    ticks: rawTicks = 1,
    sl: passedSL = null,
    clockId = '',
    clockAction = 'fill',
    approach = '外交',
    clockLabel = ''
  } = options || {};

  const skillSL = passedSL !== null && passedSL !== undefined
    ? Math.max(1, Math.min(2, Math.floor(Number(passedSL) || 1)))
    : Math.max(1, Math.min(2, getCharacterSkillSL(character, '能言善辯') || 1));

  const ticks = Math.max(1, Math.floor(Number(rawTicks) || 1));
  if (ticks > skillSL) {
    return {
      ok: false,
      character,
      reason: `目前【能言善辯】為 SL ${skillSL}，單次最多額外影響 ${skillSL} 格命刻（至多 ${skillSL * 20} MP）`
    };
  }

  const mpCost = ticks * 20;
  const { curMp } = resolveVitalResources(character, statsOverride);
  if (curMp < mpCost) {
    return {
      ok: false,
      character,
      reason: `MP 不足！額外${clockAction === 'erase' ? '清除' : '填滿'} ${ticks} 格需要 ${mpCost} 點 MP（目前僅 ${curMp} 點）`
    };
  }

  const nextMp = curMp - mpCost;
  const prevClock = clockId ? findClock(character, clockId) : null;
  let updatedClock = null;

  const changes = [{ field: 'currentMp', from: curMp, to: nextMp }];

  const mpPatched = {
    ...character,
    currentMp: nextMp,
    updatedAt: new Date().toISOString()
  };

  let clockPatched = mpPatched;
  if (prevClock) {
    const delta = clockAction === 'erase' ? -ticks : ticks;
    clockPatched = addClockSegments(mpPatched, prevClock.id, delta, { skipLog: true });
    updatedClock = findClock(clockPatched, prevClock.id);
    if (updatedClock && prevClock.filledSegments !== updatedClock.filledSegments) {
      changes.push({
        field: `clock:${prevClock.title || '未命名命刻'}`,
        from: prevClock.filledSegments,
        to: updatedClock.filledSegments
      });
    }
  }

  const actionWord = clockAction === 'erase' ? '清除' : '填滿';
  const targetDisplay = updatedClock?.title || clockLabel || '場景／對話命刻';

  const baseNext = clockPatched;

  let afterBuff = baseNext;
  let createdBuff = null;
  if (!updatedClock) {
    const buffRes = addPendingBuff(baseNext, {
      sourceSkill: '能言善辯',
      targetName: targetDisplay,
      effectDesc: `透過【${approach}】額外${actionWord} ${ticks} 格刻度（已扣除 ${mpCost} MP）`,
      scope: 'scene',
      meta: { mpCost, ticks, clockAction, approach }
    });
    if (buffRes.ok) {
      afterBuff = buffRes.character;
      createdBuff = buffRes.buff;
    }
  }

  const logged = loggableChange(character, afterBuff, {
    kind: 'skill',
    title: `發動【能言善辯】：透過${approach}為「${targetDisplay}」額外${actionWord} ${ticks} 格（−${mpCost} MP）`,
    changes
  });

  return {
    ok: true,
    character: logged,
    buff: createdBuff,
    outcome: {
      mpCost,
      ticks,
      clockAdvance: ticks,
      clockAction,
      approach,
      targetDisplay,
      updatedClock,
      remainingMp: nextMp
    }
  };
}

/**
 * 4. 【機師：壓縮技術】（TF Atlas p.159 & p.165）
 * - 收納（`action: 'stow'`）：必須載具無人駕駛（`!isMounted`），花費 0 IP，將 `inWorld` 設為 `false`。
 * - 召喚（`action: 'summon'`）：當 `inWorld === false` 時，花費 2 IP（外骨骼骨架 0 IP）使其重現並免費進入（`inWorld: true, isMounted: true`）。
 */
export function applyCompressionTechnique(character, options = {}, statsOverride = null) {
  if (!character || typeof character !== 'object') {
    return { ok: false, character, reason: '無效的角色物件' };
  }
  const vehicle = character.pilotVehicle || {
    name: '個人載具',
    frameId: 'exoskeleton',
    unlockedModules: [],
    activeModules: [],
    antiElementChoice: '風',
    secondaryOffensiveWeaponId: '',
    isMounted: false,
    inWorld: true
  };

  const inWorld = vehicle.inWorld !== false;
  const isMounted = Boolean(vehicle.isMounted);
  const resolvedFrameId = vehicle.frameId || 'exoskeleton';
  const frame = options?.frame
    || PILOT_FRAMES.find((f) => f.id === resolvedFrameId)
    || { id: resolvedFrameId, name: vehicle.name || '個人載具', ipFreeCompression: false };

  const resolvedAction = options?.action || (inWorld ? 'stow' : 'summon');
  const vehicleLabel = vehicle.name || '個人載具';

  if (resolvedAction === 'stow') {
    if (!inWorld) {
      return { ok: false, character, reason: `「${vehicleLabel}」目前已處於壓縮收納狀態` };
    }
    if (isMounted) {
      return {
        ok: false,
        character,
        reason: '載具上目前有人駕駛，請先點擊「離開載具」後再執行【壓縮技術】收納（0 IP）'
      };
    }
    const baseNext = {
      ...character,
      pilotVehicle: {
        ...vehicle,
        inWorld: false,
        isMounted: false
      },
      updatedAt: new Date().toISOString()
    };
    const logged = loggableChange(character, baseNext, {
      kind: 'skill',
      title: `發動【壓縮技術】：將「${vehicleLabel}」安全收納離開遊戲世界（0 IP）`
    });
    return {
      ok: true,
      character: logged,
      outcome: {
        action: 'stow',
        inWorld: false,
        isMounted: false,
        ipCost: 0
      }
    };
  }

  // Summon branch
  if (inWorld) {
    return { ok: false, character, reason: `「${vehicleLabel}」已位於遊戲世界中，不需重新召喚` };
  }

  const ipCost = frame?.ipFreeCompression ? 0 : 2;
  const { curIp } = resolveVitalResources(character, statsOverride);
  if (curIp < ipCost) {
    return {
      ok: false,
      character,
      reason: `IP 不足！召喚「${frame?.name || vehicleLabel}」需要 ${ipCost} 點 IP（目前僅 ${curIp} 點）`
    };
  }

  const nextIp = curIp - ipCost;
  const baseNext = {
    ...character,
    ...(ipCost > 0 ? { currentIp: nextIp } : {}),
    pilotVehicle: {
      ...vehicle,
      inWorld: true,
      isMounted: true
    },
    updatedAt: new Date().toISOString()
  };

  const changes = ipCost > 0 ? [{ field: 'currentIp', from: curIp, to: nextIp }] : [];
  const logged = loggableChange(character, baseNext, {
    kind: 'skill',
    title: `發動【壓縮技術】：召喚「${vehicleLabel}」並免費進入駕駛（${ipCost > 0 ? `−${ipCost} IP` : '外骨骼 0 IP'}）`,
    changes
  });

  return {
    ok: true,
    character: logged,
    outcome: {
      action: 'summon',
      inWorld: true,
      isMounted: true,
      ipCost,
      remainingIp: nextIp
    }
  };
}
