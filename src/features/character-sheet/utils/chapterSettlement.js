/**
 * 章節結束統一結算（Chapter Settlement）純函式層 —— W0-5 先行件。
 * 純函式：不隨機擲骰、不讀寫 localStorage。
 */

export const chapterSettlementItems = (character) => {
  if (!character || typeof character !== 'object') return [];
  const items = [];
  const quirk = character.quirk;

  if (quirk === '富家子弟') {
    items.push({
      itemId: 'quirk:富家子弟',
      label: '章節結束：恢復 1d6 疲勞值（最低 0）',
      dice: '1d6',
      kind: 'recoverFatigue'
    });
  } else if (quirk === '實驗逃亡體') {
    items.push({
      itemId: 'quirk:實驗逃亡體',
      label: '章節結束：降低 1d6 不穩定值（最低 0）',
      dice: '1d6',
      kind: 'reduceInstability'
    });
  } else if (quirk === '固執的懷疑論者') {
    items.push({
      itemId: 'quirk:固執的懷疑論者',
      label: '2d20 ≤ 等級 → +1 懷疑點',
      dice: '2d20',
      kind: 'rollBelowLevel'
    });
  }

  return items;
};

export const planChapterSettlement = (character, itemId, { roll } = {}) => {
  if (!character || typeof character !== 'object') {
    return { ok: false, reason: '角色無效', patch: {}, log: null, toast: '' };
  }
  if (!Number.isFinite(roll)) {
    return { ok: false, reason: '未傳入有效擲骰結果', patch: {}, log: null, toast: '' };
  }

  const res = character.classResources || {};

  if (itemId === 'quirk:富家子弟') {
    const cur = Number.isFinite(res.fatigue) ? res.fatigue : 0;
    const next = Math.max(0, cur - roll);
    const patch = {
      classResources: {
        ...res,
        fatigue: next
      }
    };
    const title = `【富家子弟】章節結算：疲勞值 ${cur} → ${next}（−1d6 = ${roll}）`;
    return {
      ok: true,
      patch,
      log: {
        kind: 'quirk',
        title,
        note: `章節結算擲出 1d6 = ${roll}，疲勞值由 ${cur} 降為 ${next}`
      },
      toast: title,
      roll
    };
  }

  if (itemId === 'quirk:實驗逃亡體') {
    const cur = Number.isFinite(res.instability) ? res.instability : 0;
    const next = Math.max(0, cur - roll);
    const patch = {
      classResources: {
        ...res,
        instability: next
      }
    };
    const title = `【實驗逃亡體】章節結算：不穩定值 ${cur} → ${next}（−1d6 = ${roll}）`;
    return {
      ok: true,
      patch,
      log: {
        kind: 'quirk',
        title,
        note: `章節結算擲出 1d6 = ${roll}，不穩定值由 ${cur} 降為 ${next}`
      },
      toast: title,
      roll
    };
  }

  if (itemId === 'quirk:固執的懷疑論者') {
    const lvl = Number.isFinite(character.level) ? character.level : 5;
    const cur = Number.isFinite(res.doubt) ? res.doubt : 0;
    if (roll <= lvl) {
      const next = cur + 1;
      const patch = {
        classResources: {
          ...res,
          doubt: next
        }
      };
      const title = `【固執的懷疑論者】章節結算判定成功（2d20 = ${roll} ≤ 等級 ${lvl}）：懷疑點 +1（${cur} → ${next}）`;
      return {
        ok: true,
        patch,
        log: {
          kind: 'quirk',
          title,
          note: `2d20 擲出 ${roll} ≤ 等級 ${lvl}，獲得 1 點懷疑點`
        },
        toast: title,
        roll
      };
    }
    const title = `【固執的懷疑論者】章節結算判定未通過（2d20 = ${roll} > 等級 ${lvl}）：未獲得懷疑點`;
    return {
      ok: true,
      patch: {},
      log: {
        kind: 'quirk',
        title,
        note: `2d20 擲出 ${roll} > 等級 ${lvl}，未獲得懷疑點`
      },
      toast: title,
      roll
    };
  }

  return { ok: false, reason: `未知結算條目 ${itemId}`, patch: {}, log: null, toast: '' };
};

