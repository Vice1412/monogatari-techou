/**
 * 暫存增益效果表（Pending Buffs）純函式模組
 *
 * 規則依據：
 * - 裁定 D5：不做跨卡寫入，只在本卡記錄「待生效暫存增益」
 * - 靈師【支援魔法】：花 5 MP 延長法術或給予目標下次檢定加值
 * - 吟唱者【我相信你】：花 5 MP 激勵盟友重擲或數值增益
 * - 吟唱者【能言善辯】：花 10 MP 推進 1 格命刻
 * - 機師【壓縮技術】：花 2 IP 收納/召喚載具
 */

export function getPendingBuffs(character) {
  return Array.isArray(character?.pendingBuffs) ? character.pendingBuffs : [];
}

export function addPendingBuff(character, { sourceSkill, targetName = '盟友', effectDesc, duration = '直到下個回合' }) {
  const buffs = getPendingBuffs(character);
  const newBuff = {
    id: `buff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sourceSkill: typeof sourceSkill === 'string' ? sourceSkill.trim() : '通用增益',
    targetName: typeof targetName === 'string' && targetName.trim() ? targetName.trim() : '盟友',
    effectDesc: typeof effectDesc === 'string' ? effectDesc.trim() : '',
    duration: typeof duration === 'string' ? duration.trim() : '直到下個回合',
    createdAt: new Date().toISOString()
  };

  return {
    ok: true,
    character: {
      ...character,
      pendingBuffs: [...buffs, newBuff],
      updatedAt: new Date().toISOString()
    },
    buff: newBuff
  };
}

export function removePendingBuff(character, buffId) {
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

export function clearPendingBuffs(character) {
  const buffs = getPendingBuffs(character);
  return {
    ok: true,
    character: {
      ...character,
      pendingBuffs: [],
      updatedAt: new Date().toISOString()
    },
    count: buffs.length
  };
}

/**
 * 【支援魔法】動作：花 5 MP 登記一筆支援增益。
 */
export function applySupportMagic(character, { targetName, effectDesc = '下次檢定獲得 +SL 加值' }, sl = 1) {
  const curMp = Number(character?.currentMp) || 0;
  if (curMp < 5) {
    return { ok: false, character, reason: 'MP 不足（需要 5 點 MP）' };
  }
  const nextChar = {
    ...character,
    currentMp: curMp - 5,
    updatedAt: new Date().toISOString()
  };
  return addPendingBuff(nextChar, {
    sourceSkill: '支援魔法',
    targetName,
    effectDesc: effectDesc.replace('SL', String(sl)),
    duration: '下次檢定'
  });
}

/**
 * 【我相信你】動作：花 5 MP 登記一筆激勵增益。
 */
export function applyIBelieveInYou(character, { targetName, effectDesc = '下次檢定可重擲一顆骰子' }) {
  const curMp = Number(character?.currentMp) || 0;
  if (curMp < 5) {
    return { ok: false, character, reason: 'MP 不足（需要 5 點 MP）' };
  }
  const nextChar = {
    ...character,
    currentMp: curMp - 5,
    updatedAt: new Date().toISOString()
  };
  return addPendingBuff(nextChar, {
    sourceSkill: '我相信你',
    targetName,
    effectDesc,
    duration: '下次檢定'
  });
}

/**
 * 【能言善辯】動作：花 10 MP 推進 1 格命刻。
 */
export function applySmoothTalker(character) {
  const curMp = Number(character?.currentMp) || 0;
  if (curMp < 10) {
    return { ok: false, character, reason: 'MP 不足（需要 10 點 MP）' };
  }
  const nextChar = {
    ...character,
    currentMp: curMp - 10,
    updatedAt: new Date().toISOString()
  };
  return {
    ok: true,
    character: nextChar,
    outcome: {
      clockAdvance: 1,
      message: '花費 10 MP 發動【能言善辯】，交涉命刻推進 1 格！'
    }
  };
}

/**
 * 【壓縮技術】動作：花 2 IP 收納/展開載具。
 */
export function applyCompressionTechnique(character) {
  const curIp = Number(character?.currentIp) || 0;
  if (curIp < 2) {
    return { ok: false, character, reason: 'IP 不足（需要 2 點 IP）' };
  }
  const curVehicle = character?.pilotVehicle || {};
  const isCompressed = !curVehicle.isCompressed;
  const nextChar = {
    ...character,
    currentIp: curIp - 2,
    pilotVehicle: {
      ...curVehicle,
      isCompressed
    },
    updatedAt: new Date().toISOString()
  };
  return {
    ok: true,
    character: nextChar,
    isCompressed,
    message: isCompressed
      ? '花費 2 IP 發動【壓縮技術】：載具已模組化收納！'
      : '花費 2 IP 發動【壓縮技術】：載具已展開就緒！'
  };
}

