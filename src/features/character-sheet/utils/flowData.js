/**
 * 流程額外資料純函式層（flowData.js）—— 通用資料存取與規則判定。
 * 純函式：不隨機擲骰、不讀寫時間、不讀寫 DOM / localStorage。
 */

import { FLOW_DATA_SPECS, specFor } from '../data/flowDataSpecs';

export { FLOW_DATA_SPECS, specFor };

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const normalizeFlowEntry = (character, itemId) => {
  const raw = character?.flowState?.[itemId];
  if (!raw || typeof raw !== 'object') {
    return { n: 0, on: false, choice: '', fields: {}, picks: [], text: '', list: [] };
  }
  return {
    n: Number.isFinite(raw.n) ? raw.n : 0,
    on: raw.on === true,
    choice: typeof raw.choice === 'string' ? raw.choice : '',
    fields: (raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields))
      ? clone(raw.fields)
      : {},
    picks: Array.isArray(raw.picks)
      ? Array.from(new Set(raw.picks.filter((p) => typeof p === 'string')))
      : [],
    text: typeof raw.text === 'string' ? raw.text : '',
    list: Array.isArray(raw.list) ? clone(raw.list) : []
  };
};

const getRecordKey = (spec) => spec?.records?.label || 'records';

export const readEntry = (character, itemId) => {
  const spec = specFor(itemId);
  const entry = normalizeFlowEntry(character, itemId);
  const recordKey = getRecordKey(spec);

  let records = entry.fields?.[recordKey];
  if (!Array.isArray(records)) {
    // 相容可能存在的 bodyguards 或自訂鍵
    records = entry.fields?.bodyguards || [];
  }
  return {
    records: Array.isArray(records) ? records : [],
    picks: entry.picks,
    fields: entry.fields,
    text: entry.text,
    list: entry.list,
    raw: entry
  };
};

export const recordIssues = (spec, entry) => {
  if (!spec?.records) return [];
  const issues = [];
  const label = spec.records.label || '記錄';
  const records = Array.isArray(entry?.records) ? entry.records : [];
  const min = spec.records.min ?? 0;
  const max = spec.records.max ?? Infinity;

  if (records.length < min) {
    issues.push({
      index: 0,
      field: '',
      message: `需要填寫至少 ${min} 位${label}（目前 ${records.length} 位）`
    });
  } else if (records.length > max) {
    issues.push({
      index: 0,
      field: '',
      message: `最多僅能登記 ${max} 位${label}（目前 ${records.length} 位）`
    });
  }

  const fields = spec.records.fields || [];
  records.forEach((rec, i) => {
    fields.forEach((f) => {
      if (f.required) {
        const val = rec?.[f.key];
        if (val === null || val === undefined || String(val).trim() === '') {
          issues.push({
            index: i + 1,
            field: f.key,
            message: `第 ${i + 1} 位${label}尚未填寫${f.label}`
          });
        }
      }
    });
  });

  return issues;
};

export const isEntryComplete = (spec, entry) => recordIssues(spec, entry).length === 0;

export const setRecord = (character, itemId, index, patch) => {
  const base = character && typeof character === 'object' ? clone(character) : {};
  const spec = specFor(itemId);
  const recordKey = getRecordKey(spec);
  const entry = normalizeFlowEntry(base, itemId);
  const currentList = Array.isArray(entry.fields[recordKey]) ? [...entry.fields[recordKey]] : [];

  if (index >= 0 && index < currentList.length) {
    currentList[index] = { ...currentList[index], ...patch };
  }

  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        fields: {
          ...entry.fields,
          [recordKey]: currentList
        }
      }
    }
  };
};

export const addRecord = (character, itemId) => {
  const base = character && typeof character === 'object' ? clone(character) : {};
  const spec = specFor(itemId);
  const recordKey = getRecordKey(spec);
  const entry = normalizeFlowEntry(base, itemId);
  const currentList = Array.isArray(entry.fields[recordKey]) ? [...entry.fields[recordKey]] : [];
  const max = spec?.records?.max ?? Infinity;

  if (currentList.length >= max) return character;

  const newRec = { id: `rec_${currentList.length + 1}` };
  (spec?.records?.fields || []).forEach((f) => {
    newRec[f.key] = '';
  });
  currentList.push(newRec);

  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        fields: {
          ...entry.fields,
          [recordKey]: currentList
        }
      }
    }
  };
};

export const removeRecord = (character, itemId, index) => {
  const base = character && typeof character === 'object' ? clone(character) : {};
  const spec = specFor(itemId);
  const recordKey = getRecordKey(spec);
  const entry = normalizeFlowEntry(base, itemId);
  const currentList = Array.isArray(entry.fields[recordKey]) ? [...entry.fields[recordKey]] : [];

  if (index >= 0 && index < currentList.length) {
    currentList.splice(index, 1);
  }

  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        fields: {
          ...entry.fields,
          [recordKey]: currentList
        }
      }
    }
  };
};

export const setPick = (character, itemId, pickKey, value) => {
  const base = character && typeof character === 'object' ? clone(character) : {};
  const entry = normalizeFlowEntry(base, itemId);
  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        choice: String(value)
      }
    }
  };
};

export const togglePick = (character, itemId, pickKey, value, { min = 0, max = Infinity } = {}) => {
  const base = character && typeof character === 'object' ? clone(character) : {};
  const entry = normalizeFlowEntry(base, itemId);
  const picks = Array.isArray(entry.picks) ? [...entry.picks] : [];
  const valStr = String(value);

  let nextPicks;
  if (picks.includes(valStr)) {
    if (picks.length <= min) return character;
    nextPicks = picks.filter((p) => p !== valStr);
  } else {
    if (picks.length >= max) return character;
    nextPicks = [...picks, valStr];
  }

  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        picks: Array.from(new Set(nextPicks))
      }
    }
  };
};

export const setText = (character, itemId, text) => {
  const base = character && typeof character === 'object' ? clone(character) : {};
  const entry = normalizeFlowEntry(base, itemId);
  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        text: String(text || '')
      }
    }
  };
};

export const upsertListRecord = (character, itemId, record) => {
  if (!record || !record.id) return character;
  const base = character && typeof character === 'object' ? clone(character) : {};
  const entry = normalizeFlowEntry(base, itemId);
  const list = Array.isArray(entry.list) ? [...entry.list] : [];
  const idx = list.findIndex((r) => r.id === record.id);

  if (idx !== -1) {
    list[idx] = { ...list[idx], ...record };
  } else {
    list.push({ ...record });
  }

  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        list
      }
    }
  };
};

export const removeListRecord = (character, itemId, recordId) => {
  if (!recordId) return character;
  const base = character && typeof character === 'object' ? clone(character) : {};
  const entry = normalizeFlowEntry(base, itemId);
  const list = Array.isArray(entry.list) ? entry.list.filter((r) => r.id !== recordId) : [];

  return {
    ...base,
    flowState: {
      ...(base.flowState || {}),
      [itemId]: {
        ...entry,
        list
      }
    }
  };
};

export const canUseBuff = (character, itemId, buffId) => {
  const spec = specFor(itemId);
  if (!spec) return { ok: false, reason: '找不到資料規格' };

  if (spec.requireRecordsForBuffs) {
    const entry = readEntry(character, itemId);
    const issues = recordIssues(spec, entry);
    if (issues.length > 0) {
      return {
        ok: false,
        reason: `尚未填齊${spec.records?.label || '名冊'}資料（${issues[0].message}）`
      };
    }
  }

  if (spec.clock?.resourceId) {
    const val = Number(character?.classResources?.[spec.clock.resourceId]) || 0;
    if (spec.clock.blockAt != null && val >= spec.clock.blockAt) {
      return {
        ok: false,
        reason: `${spec.clock.label}已達 ${val} / ${spec.clock.max}，無法再依賴${spec.title || '增益'}`
      };
    }
  }

  return { ok: true, reason: '' };
};

export const planBuffUse = (character, itemId, buffId, { roll } = {}) => {
  const spec = specFor(itemId);
  if (!spec) return { ok: false, reason: '找不到資料規格', patch: {}, log: null, toast: '' };

  const check = canUseBuff(character, itemId, buffId);
  if (!check.ok) {
    return { ok: false, reason: check.reason, patch: {}, log: null, toast: '' };
  }

  if (!Number.isFinite(roll)) {
    return { ok: false, reason: '未傳入有效擲骰數值（純函式不自行擲骰）', patch: {}, log: null, toast: '' };
  }

  const buff = (spec.buffs || []).find((b) => b.id === buffId);
  if (!buff) {
    return { ok: false, reason: `找不到增益 ${buffId}`, patch: {}, log: null, toast: '' };
  }

  const clock = spec.clock;
  const curVal = Number(character?.classResources?.[clock.resourceId]) || 0;
  const nextVal = Math.min(clock.max, curVal + roll);

  const patch = {
    classResources: {
      ...(character?.classResources || {}),
      [clock.resourceId]: nextVal
    }
  };

  const title = `使用【${spec.title}】增益【${buff.label}】（${clock.label} ${curVal} → ${nextVal}）`;
  const log = {
    kind: 'quirk',
    title,
    note: `${buff.describe}。擲出 ${buff.costDice} = ${roll}，${clock.label}由 ${curVal} 增至 ${nextVal}`
  };

  return {
    ok: true,
    patch,
    log,
    toast: title,
    roll
  };
};

export const planSettlement = (character, itemId, settlementId, { roll } = {}) => {
  const spec = specFor(itemId);
  if (!spec) return { ok: false, reason: '找不到資料規格', patch: {}, log: null, toast: '' };

  if (!Number.isFinite(roll)) {
    return { ok: false, reason: '未傳入有效擲骰數值（純函式不自行擲骰）', patch: {}, log: null, toast: '' };
  }

  const st = (spec.settlements || []).find((s) => s.id === settlementId);
  if (!st) {
    return { ok: false, reason: `找不到結算設定 ${settlementId}`, patch: {}, log: null, toast: '' };
  }

  const curVal = Number(character?.classResources?.[st.clockId]) || 0;
  const nextVal = Math.max(st.min ?? 0, curVal + (st.sign ?? -1) * roll);

  const patch = {
    classResources: {
      ...(character?.classResources || {}),
      [st.clockId]: nextVal
    }
  };

  const title = `【${spec.title}】${st.label}（${curVal} → ${nextVal}，擲出 ${roll}）`;
  const log = {
    kind: 'quirk',
    title,
    note: `週期結算擲出 ${st.dice} = ${roll}，數值由 ${curVal} 調整為 ${nextVal}`
  };

  return {
    ok: true,
    patch,
    log,
    toast: title,
    roll
  };
};
