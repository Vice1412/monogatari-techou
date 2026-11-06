/**
 * 行囊物品（2026-11-03）。
 *
 * ## 為什麼要有這一層
 *
 * 使用者的問題：「冒險的途中，可能會拿到一些裝備、一些特殊物品或紀念品、一些神器等等。
 * 以目前跑團卡的狀況來看，該記錄在哪裡？」
 *
 * 當時的答案是「只能寫進冒險筆記本」——一個 `textarea`。它能記，但不能用：
 * 算不出價值、標不了類別、賣掉時也沒有金額可以扣。
 *
 * 這一層把物品變成結構化資料：`{ id, name, category, value, effect, qty }`。
 *
 * ## 類別只有三個是官方的
 *
 * 核心手冊把冒險中拿到的東西分成：**裝備**（Equipment）、**消耗品**（Items，用道具點買）、
 * **稀有物品**（Rare Items，GM 獎勵，有 zenit 價值，可從範例表挑或全團一起設計）。
 * `misc`（雜項）**不是官方分類**，它只是「其餘」的收納格——所以它的標籤就叫「雜項」，
 * 不假裝是一個規則術語。
 *
 * ## 賣出為什麼要輸入金額
 *
 * 原書沒有「售價＝半價」這種通則，賣多少由 GM 與情境決定。所以金額是**玩家輸入**的，
 * 預設填物品價值（那是最常見的成交價），但可以改——改了就是改了，不留第二套算法。
 */
import { loggableChange } from './characterLog';

/** 三個官方類別 ＋ 一個收納格。順序＝介面順序。 */
export const INVENTORY_CATEGORIES = Object.freeze([
  { key: 'equipment', label: '裝備', icon: 'weapon' },
  { key: 'consumable', label: '消耗品', icon: 'item' },
  { key: 'rare', label: '稀有物品', icon: 'treasure' },
  { key: 'misc', label: '雜項', icon: 'backpack' }
]);

const CATEGORY_KEYS = new Set(INVENTORY_CATEGORIES.map((c) => c.key));

/** 類別標籤；不認得的鍵回「雜項」（舊資料或手改存檔不該讓整格空白）。 */
export const inventoryCategoryLabel = (key) => (
  INVENTORY_CATEGORIES.find((c) => c.key === key)?.label || '雜項'
);

/** 收斂 category：只接受登記過的鍵，其餘一律 misc。 */
const normalizeCategory = (key) => (CATEGORY_KEYS.has(key) ? key : 'misc');

/** 價值：只接受非負數；空白／壞值 → `null`（＝「不知道」，不是 0）。 */
export const normalizeInventoryValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
};

/** 數量：至少 1，整數。 */
const normalizeQty = (qty) => {
  const n = Number(qty);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
};

let seq = 0;
/** 穩定前綴 ＋ 遞增序號 ＋ 亂數：同一次 render 內連續新增也不會撞號。 */
export const makeInventoryItemId = () => {
  seq += 1;
  return `inv_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 6)}`;
};

/**
 * 裝備的詳細欄位（2026-11-03，使用者第二輪）。
 *
 * > 「自訂裝備是代表不是在列表上的，而不代表不是裝備……你應該也要給他輸入傷害、
 * >  輸入類別、輸入屬性類型、輸入效果、輸入檢定之類的。」
 *
 * 所以裝備類的物品除了名稱／價值／效果之外，還帶一組 `gear`：
 * 欄位、武器類別、遠近、手數、命中檢定、傷害式、傷害屬性。
 * **全部選填**：只有「不在官方表上」的東西才需要寫這些，寫不出來就留空。
 */
export const GEAR_SLOTS = Object.freeze([
  { key: 'mainHand', label: '主手武器' },
  { key: 'offHand', label: '副手武器' },
  { key: 'armor', label: '身體防具' },
  { key: 'accessory', label: '佩戴飾品' }
]);

const GEAR_SLOT_KEYS = new Set(GEAR_SLOTS.map((s) => s.key));

/** 收斂裝備欄位：只留登記過的鍵與字串值（手改存檔不該帶進奇怪的東西）。 */
export const normalizeGear = (gear) => {
  if (!gear || typeof gear !== 'object') return null;
  const str = (v, max = 40) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const next = {
    slot: GEAR_SLOT_KEYS.has(gear.slot) ? gear.slot : 'mainHand',
    category: str(gear.category, 20),
    range: str(gear.range, 10),
    hands: Number(gear.hands) === 2 ? 2 : 1,
    check: str(gear.check, 30),
    damage: str(gear.damage, 30),
    damageType: str(gear.damageType, 10)
  };
  return (next.category || next.range || next.check || next.damage || next.damageType) ? next : null;
};

/** 裝備的一行摘要（詳情區與匯出用）：`劍 · 近戰 · DEX + MIG · 【HR + 6】物理` */
export const describeGearSummary = (gear) => {
  if (!gear) return '';
  return [
    gear.category,
    gear.range,
    gear.hands === 2 ? '雙手' : '',
    gear.check,
    [gear.damage, gear.damageType].filter(Boolean).join('')
  ].filter(Boolean).join(' · ');
};

/**
 * 正規化消耗品/物品效果模型（可選）。
 */
export const normalizeEffectModel = (model) => {
  if (!model || typeof model !== 'object') return null;
  return {
    healHp: Math.max(0, Math.floor(Number(model.healHp) || 0)),
    healMp: Math.max(0, Math.floor(Number(model.healMp) || 0)),
    isPotion: Boolean(model.isPotion),
    isDelicacy: Boolean(model.isDelicacy),
    damage: Math.max(0, Math.floor(Number(model.damage) || 0)),
    damageType: typeof model.damageType === 'string' ? model.damageType.trim() : '',
    targets: Math.max(1, Math.floor(Number(model.targets) || 1))
  };
};

/**
 * 建立一筆物品資料。`name` 空白的回 `null`——沒有名字的物品沒有意義，
 * 讓呼叫端直接不新增，而不是塞一筆空白進清單。
 */
export const createInventoryItem = ({ name, category, value, effect, qty, gear, effectModel } = {}) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return null;
  const nextCategory = normalizeCategory(category);
  const normalizedModel = normalizeEffectModel(effectModel);
  return {
    id: makeInventoryItemId(),
    name: trimmed,
    category: nextCategory,
    value: normalizeInventoryValue(value),
    effect: typeof effect === 'string' ? effect.trim() : '',
    qty: normalizeQty(qty),
    // 只有裝備類才帶 gear；其餘品類即使傳了也不留（避免資料長出沒有意義的欄位）
    ...(nextCategory === 'equipment' ? { gear: normalizeGear(gear) } : {}),
    ...(normalizedModel ? { effectModel: normalizedModel } : {})
  };
};

/** 讀出清單（舊存檔沒有這個欄位 → 空陣列，不是 undefined）。 */
export const readInventory = (character) => (
  Array.isArray(character?.inventory) ? character.inventory : []
);

/**
 * 加入一筆物品。回新角色（含更新時間）。
 * 同一次寫入包含 `inventory` 與 `updatedAt`——分兩次 onChange 會寫到舊角色（MEMORY §D.24）。
 */
export const addInventoryItem = (character, item) => {
  const record = item && item.id ? item : createInventoryItem(item);
  if (!record) return character;
  return {
    ...character,
    inventory: [...readInventory(character), record],
    updatedAt: new Date().toISOString()
  };
};

/** 移除一筆（賣出／丟棄都由這裡走）。找不到就回原物件，呼叫端可據此判斷有沒有動到。 */
export const removeInventoryItem = (character, itemId) => {
  const list = readInventory(character);
  const next = list.filter((it) => it && it.id !== itemId);
  if (next.length === list.length) return character;
  return { ...character, inventory: next, updatedAt: new Date().toISOString() };
};

/** 全部物品的估值合計（`value` 為 `null` 的不計）。 */
export const describeInventoryTotal = (character) => (
  readInventory(character).reduce((sum, it) => sum + (Number(it?.value) || 0) * normalizeQty(it?.qty), 0)
);

/**
 * 賣出一筆物品：**移除物品 ＋ 入帳 ＋ 留痕，在同一次寫入裡完成**。
 *
 * 為什麼不拆兩步：`zenit` 與 `inventory` 分兩次 `onChange`，第二次讀到的是這一輪開始前的
 * 角色（MEMORY §D.24），於是「錢加了、東西還在」或「東西沒了、錢沒加」。
 * `applyPurchase`（買）用的就是同一個模式，這裡刻意對稱。
 *
 * @param {object} character
 * @param {{ itemId: string, amount: number|string }} args 金額由玩家輸入（原書沒有公定售價）
 * @returns {{ ok: boolean, character: object, reason?: string, gain?: number, item?: object }}
 */
export const applySellItem = (character, { itemId, amount } = {}) => {
  const list = readInventory(character);
  const item = list.find((it) => it && it.id === itemId);
  if (!item) return { ok: false, character, reason: '找不到這件物品' };

  const gain = normalizeInventoryValue(amount);
  if (gain === null) return { ok: false, character, reason: '請輸入售出金額' };
  if (gain <= 0) return { ok: false, character, reason: '售出金額要大於 0' };

  const from = Number(character?.zenit) || 0;
  const to = from + gain;
  const base = {
    ...character,
    zenit: to,
    inventory: list.filter((it) => it && it.id !== itemId),
    updatedAt: new Date().toISOString()
  };
  const next = loggableChange(character, base, {
    kind: 'trade',
    title: `賣出 ${item.name}`,
    note: item.category === 'rare' ? '稀有物品' : inventoryCategoryLabel(item.category),
    changes: [{ field: 'zenit', from, to }]
  });
  return { ok: true, character: next, gain, item };
};

/**
 * 消耗品使用（支援修補匠【藥水雨】與商人【過期食品】）。
 *
 * @param {object} character
 * @param {string} itemId
 * @param {object} options
 * @returns {{ ok: boolean, character: object, reason?: string, outcome?: object }}
 */
export const consumeInventoryItem = (character, itemId, options = {}) => {
  const list = readInventory(character);
  const itemIndex = list.findIndex((it) => it && it.id === itemId);
  if (itemIndex < 0) {
    return { ok: false, character, reason: '找不到這件物品' };
  }

  const targetItem = list[itemIndex];
  const curQty = normalizeQty(targetItem.qty);
  if (curQty <= 0) {
    return { ok: false, character, reason: '物品數量不足' };
  }

  const nextList = [...list];
  if (curQty > 1) {
    nextList[itemIndex] = { ...targetItem, qty: curQty - 1 };
  } else {
    nextList.splice(itemIndex, 1);
  }

  let nextChar = {
    ...character,
    inventory: nextList,
    updatedAt: new Date().toISOString()
  };

  const model = targetItem.effectModel || {};
  let baseHp = model.healHp || 0;
  let baseMp = model.healMp || 0;

  if (baseHp === 0 && baseMp === 0 && targetItem.effect) {
    const hpMatch = targetItem.effect.match(/回復\s*(\d+)\s*點?\s*HP|恢復\s*(\d+)\s*點?\s*HP/i);
    if (hpMatch) baseHp = Number(hpMatch[1] || hpMatch[2]) || 0;
    const mpMatch = targetItem.effect.match(/回復\s*(\d+)\s*點?\s*MP|恢復\s*(\d+)\s*點?\s*MP/i);
    if (mpMatch) baseMp = Number(mpMatch[1] || mpMatch[2]) || 0;
  }

  // 1. 商人【過期食品】模式：轉為毒屬性傷害
  if (options.isSpoiledFood) {
    const poisonDamage = baseHp > 0 ? baseHp : 40;
    return {
      ok: true,
      character: nextChar,
      outcome: {
        type: 'spoiledFood',
        item: targetItem,
        poisonDamage,
        message: `將【${targetItem.name}】投擲為過期食品，造成 ${poisonDamage} 點毒屬性傷害！`
      }
    };
  }

  // 2. 修補匠【藥水雨】模式：恢復量折半，影響最多 SL+1 個生物
  if (options.isPotionRain) {
    const sl = Math.max(1, Math.floor(Number(options.potionRainSL) || 1));
    const targets = sl + 1;
    const halvedHp = Math.floor(baseHp / 2);
    const halvedMp = Math.floor(baseMp / 2);

    if (halvedHp > 0 && typeof nextChar.currentHp === 'number') {
      const maxHp = Number(nextChar.maxHp) || 999;
      nextChar.currentHp = Math.min(maxHp, nextChar.currentHp + halvedHp);
    }
    if (halvedMp > 0 && typeof nextChar.currentMp === 'number') {
      const maxMp = Number(nextChar.maxMp) || 999;
      nextChar.currentMp = Math.min(maxMp, nextChar.currentMp + halvedMp);
    }

    return {
      ok: true,
      character: nextChar,
      outcome: {
        type: 'potionRain',
        item: targetItem,
        targets,
        halvedHp,
        halvedMp,
        message: `發動【藥水雨】：藥水化為細雨影響最多 ${targets} 個生物（每人回復 ${halvedHp} HP / ${halvedMp} MP）！`
      }
    };
  }

  // 3. 一般消耗
  if (baseHp > 0 && typeof nextChar.currentHp === 'number') {
    const maxHp = Number(nextChar.maxHp) || 999;
    nextChar.currentHp = Math.min(maxHp, nextChar.currentHp + baseHp);
  }
  if (baseMp > 0 && typeof nextChar.currentMp === 'number') {
    const maxMp = Number(nextChar.maxMp) || 999;
    nextChar.currentMp = Math.min(maxMp, nextChar.currentMp + baseMp);
  }

  return {
    ok: true,
    character: nextChar,
    outcome: {
      type: 'normal',
      item: targetItem,
      healedHp: baseHp,
      healedMp: baseMp,
      message: `使用了【${targetItem.name}】` + (baseHp > 0 || baseMp > 0 ? `（回復 ${baseHp} HP / ${baseMp} MP）` : '。')
    }
  };
};
