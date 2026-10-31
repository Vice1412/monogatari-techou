/**
 * 起始資金的履歷（P11，2026-11-01）
 *
 * ## 使用者的原話
 *
 * 「這個是開卡過後的結果。我完全看不到我初始買了什麼，我2d6又得到了多少。」
 *
 * ## 量到的現況（改動前）
 *
 * 結算只寫**一筆** `kind: 'zenit'`，標題「擲起始資金 2d6 × 10」，`changes` 是
 * 「裝備預算 500 → 結算後 390」。於是明細上那一列寫著 **-110z**，而 -110 這個數字
 * 既不是「我買了什麼」（那 110 是差額，不是任何一件東西的價格），
 * 也不是「我 2d6 得到多少」（骰到的錢是**加項**，被抵銷掉了）。
 *
 * 三個具體的錯：
 *
 * 1. **方向錯**：擲骰是收入，卻被記成支出（因為它跟花費混在同一個差額裡）。
 * 2. **沒有品項**：買了三件東西，履歷上一個名字都沒有。
 * 3. **沒有骰值**：`2d6 × 10` 的結果沒有寫進去，事後無法對帳。
 *
 * ## 改成什麼
 *
 * 一次結算寫成**一串有先後關係的事件**，每一筆的 `from` 都是前一筆的 `to`：
 *
 * ```
 * 起始裝備預算        500z   （from: null → 500，這是「開帳」）
 * 購入 青銅劍        -200z   （500 → 300）
 * 購入 旅行皮甲      -100z   （300 → 200）
 * 起始資金 2d6 × 10   +70z   （200 → 270）
 * ```
 *
 * 於是「累計收入 570z／累計支出 300z／餘 270z」對得上，而且**每一件東西都有名字**。
 *
 * ## 為什麼 `from: null` 是「開帳」而不是「不知道」
 *
 * 結算前角色身上根本沒有錢包（`zenit` 只是預算的佔位值），所以那一筆沒有「前值」。
 * 硬寫 `from: 0` 會斷言「他本來有 0z」——那是我們不知道的事。
 * `buildMoneyLedger` 因此把「有終值、沒有前值」讀成**開帳**（差額 ＝ 終值）。
 *
 * ## 舊存檔：一次性修補
 *
 * 已經被舊寫法寫壞的那一筆，可以用**推導**還原（見 `repairStartingFundsLog`）：
 * `2d6 × 10 = 結算後餘額 − 剩餘裝備預算`。但只有在**整份履歷剛好只有那一筆動到錢**
 * 的時候才修——只要玩家事後買過任何東西，裝備就不再是「開卡當下那一套」，
 * 推導出來的骰值會是錯的，而錯的骰值比沒有更糟。
 *
 * 修補會做**自我驗證**：重建出來的終點必須等於原本的餘額，否則放棄。
 * 這是「寧可少修一筆，也不要寫進一個看起來合理的錯數字」。
 */
import rulesData from '../data/rulesData.json';
import { PURCHASE_SOURCES, describeItem } from '../data/itemDetail';
import { buildOwnedWeaponItems } from '../data/customWeapons';
import { resolveCreationRules } from '../data/creationRules';
import { getTechnosphereEquipmentSpend, isTechnosphereEnabled } from '../data/technospheres';
import { describeEquipmentRecord, formatZenit } from './zenitFeedback';
import { EQUIPMENT_SLOTS, totalStartingEquipCost } from './equipmentRules';
import { asCount } from './playAvailability';

/** 算進起始預算的三個槽（原書 p.164）。飾品是稀有物品，不從預算出。 */
const BUDGET_SLOTS = ['mainHand', 'offHand', 'armor'];

/** 舊寫法留下的那筆結算的標題。修補只認這一個字串。 */
export const LEGACY_STARTING_FUNDS_TITLE = '擲起始資金 2d6 × 10';

/**
 * 名稱 → 品項。書上的四類 ＋ 角色自己寫的武器（`customWeapons`）。
 *
 * 為什麼自訂武器也要進來：開卡時買一把 300z 的定制武器是合法的，
 * 而它不在 `rulesData.equipment` 裡——只查書上的表會讓那 300z 憑空消失
 * （金額對不上，明細就會出現一筆沒有來源的差額）。
 */
const buildItemLookup = (character) => {
  const map = new Map();

  // 先放自訂武器：同名的話以角色身上的那一把為準（價格是玩家填的）。
  buildOwnedWeaponItems(character).forEach((item) => {
    if (item?.name && !map.has(item.name)) map.set(item.name, item);
  });

  PURCHASE_SOURCES.forEach((source) => {
    const list = Array.isArray(rulesData.equipment?.[source.source]) ? rulesData.equipment[source.source] : [];
    list.forEach((raw) => {
      if (!raw?.name || map.has(raw.name)) return;
      map.set(raw.name, {
        name: raw.name,
        cost: Number(raw.cost) || 0,
        categoryId: source.id,
        slot: source.slot,
        detail: describeItem(raw, source.id)
      });
    });
  });

  return map;
};

/**
 * 這一隻角色在開卡時買了什麼（推導，不新增欄位）。
 *
 * @returns {{ items: Array<{slot:string,name:string,cost:number,record:{title:string,note:string}}>,
 *             extraSpend:number, totalSpend:number }}
 *   `totalSpend` 用 `totalStartingEquipCost` 算——那是預算條與載入檢查共用的同一支，
 *   所以明細的合計一定等於畫面上「已花費」那個數字。
 */
export const resolveStartingEquipment = (character) => {
  const equipment = character?.equipment || {};
  const lookup = buildItemLookup(character);

  const items = [];
  BUDGET_SLOTS.forEach((slot) => {
    const name = equipment[slot];
    if (!name) return;
    const item = lookup.get(name);
    const cost = Number(item?.cost) || 0;
    // 0z 的品項不記：`徒手打擊`／`無盾牌` 是空槽的替身，不是買來的東西。
    if (cost <= 0) return;
    items.push({
      slot,
      name,
      cost,
      record: describeEquipmentRecord(item, {
        equip: true,
        slotLabel: EQUIPMENT_SLOTS[slot]?.label || ''
      })
    });
  });

  const rules = resolveCreationRules(character?.creationRules);
  const extraSpend = isTechnosphereEnabled(rules.technospheres)
    ? getTechnosphereEquipmentSpend(character?.technospheres)
    : 0;

  const totalSpend = totalStartingEquipCost(equipment, {
    weaponMap: lookup,
    shieldMap: lookup,
    armorMap: lookup,
    extraSpend
  });

  return { items, extraSpend, totalSpend };
};

/**
 * 把一次結算寫成**一串**履歷條目（`appendLog` 可以直接吃）。
 *
 * 三種情況各自處理，因為「錢不夠」的時候沒有「一件一件買」的順序可言——
 * 硬列會讓某一列的餘額變成負數，而那在畫面上看起來像 bug。
 *
 * @param {object} input
 * @param {number} input.budget 起始裝備預算（規則）
 * @param {Array}  input.items  `resolveStartingEquipment().items`
 * @param {number} [input.extraSpend] 裝備以外的同筆預算（魔晶石插槽）
 * @param {number} [input.totalSpend] 權威合計；不給就用 items ＋ extraSpend
 * @param {number} [input.rollSum] 2d6 × 10；不給就是 0（修補時骰值未知）
 * @param {number[]|null} [input.dice] `[d1, d2]`；null 表示「骰值未記錄」
 * @param {string} [input.rollTitle] 覆寫最後一筆的標題（經典搭配走的是「原書印製」而不是擲骰）
 * @param {string} [input.rollNote]  覆寫最後一筆的說明；不給就依 `dice` 自動組
 * @returns {{ entries: Array, finalZenit: number, spent: number }}
 */
export const buildStartingFundsEntries = ({
  budget,
  items = [],
  extraSpend = 0,
  totalSpend = null,
  rollSum = 0,
  dice = null,
  rollTitle = null,
  rollNote = null
} = {}) => {
  const start = Math.max(0, asCount(budget) ?? 0);
  const entries = [];
  let balance = start;

  // ① 開帳。`from: null` ＝ 結算前沒有錢包（不是「本來有 0z」）。
  entries.push({
    kind: 'creation',
    title: '起始裝備預算',
    note: '原書 p.165：起始資金 ＝ 剩餘裝備預算 ＋ 2d6 × 10',
    changes: [{ field: 'zenit', from: null, to: start }]
  });

  const itemSum = items.reduce((sum, item) => sum + (Number(item?.cost) || 0), 0);
  const extra = Number(extraSpend) || 0;
  const spent = totalSpend === null ? itemSum + extra : Math.max(0, asCount(totalSpend) ?? 0);

  if (spent <= start) {
    // ② 一件一件買。每一筆的 `from` 都是前一筆的 `to`，所以明細可以逐列對帳。
    items.forEach((item) => {
      const cost = Number(item?.cost) || 0;
      if (cost <= 0) return;
      const from = balance;
      balance -= cost;
      entries.push({
        kind: 'trade',
        title: item?.record?.title || `購入 ${item?.name || '裝備'}`,
        note: item?.record?.note || '',
        changes: [{ field: 'zenit', from, to: balance }]
      });
    });

    if (extra > 0) {
      const from = balance;
      balance -= extra;
      entries.push({
        kind: 'trade',
        title: '魔晶石（插槽品級／附魔）',
        note: '與裝備同一筆起始預算（TF p.133）',
        changes: [{ field: 'zenit', from, to: balance }]
      });
    }

    // ③ 防禦性對帳：`items` 是「認得出名字的」，`totalSpend` 是權威合計。
    // 兩者不一致時補一列，否則明細的合計會與畫面上的「已花費」差一截，
    // 而那種差額在畫面上看起來像漏記了一筆。
    const gap = spent - (itemSum + extra);
    if (gap > 0) {
      const from = balance;
      balance -= gap;
      entries.push({
        kind: 'trade',
        title: '其他起始裝備',
        note: '未能逐一列出的部分（合計仍等於「已花費」）',
        changes: [{ field: 'zenit', from, to: balance }]
      });
    }
  } else {
    // 超支：錢不夠就沒有購買順序可言，硬列會出現負餘額。
    entries.push({
      kind: 'trade',
      title: `購入起始裝備（共 ${items.length} 件）`,
      note: `共 ${formatZenit(spent)}，超出預算 ${formatZenit(spent - start)}（不從錢包扣）`,
      changes: [{ field: 'zenit', from: start, to: 0 }]
    });
    balance = 0;
  }

  // ④ 骰到的錢。**這是收入**，不是支出——舊寫法把它跟花費混成一個差額，
  // 於是「擲 2d6 得到 70z」在明細上長得像「花了 110z」。
  const roll = Math.max(0, asCount(rollSum) ?? 0);
  const from = balance;
  balance += roll;
  entries.push({
    kind: 'creation',
    title: rollTitle || LEGACY_STARTING_FUNDS_TITLE,
    note: rollNote || (Array.isArray(dice) && dice.length === 2
      ? `2d6（${dice[0]} + ${dice[1]}）× 10 ＝ ${formatZenit(roll)}`
      : `2d6 × 10 ＝ ${formatZenit(roll)}（骰值未個別記錄）`),
    changes: [{ field: 'zenit', from, to: balance }]
  });

  return { entries, finalZenit: balance, spent };
};

/** 履歷裡所有「動到錢」的條目。 */
const zenitEntriesOf = (log) => (Array.isArray(log) ? log : []).filter(
  (entry) => Array.isArray(entry?.changes) && entry.changes.some((change) => change?.field === 'zenit')
);

/**
 * 結算當下給玩家看的那一段文字（原生 alert 用）。
 *
 * 為什麼要有這個：明細是**事後**才去翻的。結算那一刻如果只印「已結算為 120z」，
 * 玩家看到的就是一個沒有來源的數字——而使用者的抱怨正是「看不到我買了什麼」。
 * 同一串履歷換一種排版就變成了結算說明書，不必再維護第二份事實。
 */
export const describeStartingFundsSettlement = (entries) => {
  const rows = zenitEntriesOf(entries);
  if (rows.length === 0) return '';
  return rows.map((entry) => {
    const change = entry.changes.find((c) => c?.field === 'zenit');
    const to = asCount(change.to) ?? 0;
    const label = String(entry.title || '').replace(/^購入\s*/, '');
    if (change.from === null) return `起始裝備預算　${formatZenit(to)}`;
    const delta = to - (asCount(change.from) ?? 0);
    return delta < 0
      ? `− ${label}　${formatZenit(-delta)}　→ 餘 ${formatZenit(to)}`
      : `＋ ${label}　${formatZenit(delta)}　→ 餘 ${formatZenit(to)}`;
  }).join('\n');
};

/** 經典職業搭配那一筆的標題。它與擲骰的差別是「沒有人真的擲過」。 */
export const PRINTED_STARTING_FUNDS_TITLE = '起始資金（原書印製）';

/** 2d6 × 10 只可能是 20–120，而且是 10 的倍數。回推骰值時唯一的客觀判準。 */
const isPlausibleRoll = (value) => Number.isInteger(value) && value % 10 === 0 && value >= 20 && value <= 120;

/**
 * 經典職業搭配（原書 p.172–175）的起始資金履歷。
 *
 * 官方印的是**結算後剩餘**，不是骰值——所以不能說「他擲了 70」，只能說
 * 「原書印 170，扣掉裝備 400／預算 500 之後回推為 70」。回推得出來的才寫，
 * 回推不出來就照實寫「無法回推」。
 *
 * 兩趟：先用 `rollSum: 0` 建一次拿到「買完之後的餘額」，再補上差額重建。
 * 這樣無論超支與否，終點都精確等於原書印的數字。
 *
 * 三種回推結果，三種寫法（實測 83 組經典搭配，其中 4 組落在第三種）：
 *   1. 回推得出 2d6 × 10 → 正常的一串，最後一筆是「起始資金（原書印製）」。
 *   2. 差額剛好 0 → **不要再補一列 0**：`normalizeChange` 會把 `from === to` 丟掉，
 *      那一筆最後只剩標題、沒有金額，在履歷上像一筆壞資料。
 *   3. 回推不出來（負數或不在 20–120）→ 裝備花得比「印製金額 ＋ 預算」還多。
 *      此時**不編一個骰值**，只留一列差額並寫清楚為什麼對不上。
 */
export const buildPrintedStartingFundsEntries = (character, printedZenit) => {
  const rules = resolveCreationRules(character?.creationRules);
  const budget = Math.max(0, asCount(rules.startingZenit) ?? 0);
  const { items, extraSpend, totalSpend } = resolveStartingEquipment(character);
  const printed = Math.max(0, asCount(printedZenit) ?? 0);

  const probe = buildStartingFundsEntries({ budget, items, extraSpend, totalSpend, rollSum: 0 });
  const remaining = probe.finalZenit;
  const derived = printed - remaining;

  if (derived === 0) return probe;

  if (isPlausibleRoll(derived)) {
    return buildStartingFundsEntries({
      budget, items, extraSpend, totalSpend, rollSum: derived,
      rollTitle: PRINTED_STARTING_FUNDS_TITLE,
      rollNote: `原書 p.172–175 印製剩餘 ${formatZenit(printed)}；扣掉剩餘裝備預算 ${formatZenit(remaining)} 回推 2d6 × 10 ＝ ${formatZenit(derived)}`
    });
  }

  return {
    ...probe,
    entries: [
      ...probe.entries,
      {
        kind: 'creation',
        title: PRINTED_STARTING_FUNDS_TITLE,
        note: `原書 p.172–175 印製剩餘 ${formatZenit(printed)}；裝備花掉 ${formatZenit(probe.spent)}，與印製金額相差 ${formatZenit(Math.abs(derived))}（回推不出 2d6 × 10）`,
        changes: [{ field: 'zenit', from: remaining, to: printed }]
      }
    ],
    finalZenit: printed
  };
};

/**
 * 把舊寫法寫壞的那一筆結算換成完整的一串（一次性、可重複呼叫）。
 *
 * **五道閘門，任一不過就原樣回傳**（寧可少修一筆，也不要寫進一個看起來合理的錯數字）：
 *
 * 1. 角色已結算（`startingFundsRolled === true`）
 * 2. 整份履歷**剛好一筆**動到錢——只要事後買過任何東西，裝備就不是開卡那一套了
 * 3. 那一筆的標題就是舊結算，而且前值是數字
 * 4. 前值等於規則的起始預算（確認 `from` 是預算，不是某個錢包）
 * 5. 推導出來的骰值合理（整數、10 的倍數、2d6 的範圍內），
 *    而且**重建的終點等於原本的餘額**
 *
 * @returns {object} 同一個物件（沒修）或新的角色（修了）
 */
export const repairStartingFundsLog = (character) => {
  if (!character || character.startingFundsRolled !== true) return character;

  const log = Array.isArray(character.log) ? character.log : [];
  const zenitEntries = zenitEntriesOf(log);
  if (zenitEntries.length !== 1) return character;

  const legacy = zenitEntries[0];
  if (legacy.title !== LEGACY_STARTING_FUNDS_TITLE) return character;

  const change = legacy.changes.find((c) => c?.field === 'zenit');
  const from = asCount(change?.from);
  const to = asCount(change?.to);
  if (from === null || to === null) return character;

  const rules = resolveCreationRules(character.creationRules);
  const budget = Math.max(0, asCount(rules.startingZenit) ?? 0);
  if (from !== budget) return character;

  const { items, extraSpend, totalSpend } = resolveStartingEquipment(character);
  const remaining = Math.max(0, budget - totalSpend);
  const rollSum = to - remaining;
  // 2d6 × 10 只可能是 20–120，而且是 10 的倍數。不符合就是「裝備已經變過了」。
  if (!Number.isInteger(rollSum) || rollSum % 10 !== 0 || rollSum < 20 || rollSum > 120) return character;

  const { entries, finalZenit } = buildStartingFundsEntries({
    budget, items, extraSpend, totalSpend, rollSum, dice: null
  });
  // 自我驗證：重建出來的終點必須等於原本的餘額。差一個數字就放棄。
  if (finalZenit !== to) return character;

  // 沿用原本的時間戳——修補不該讓這件事看起來發生在「現在」。
  const stamped = entries.map((entry) => ({ ...entry, at: legacy.at }));
  const index = log.indexOf(legacy);
  const nextLog = [...log.slice(0, index), ...stamped, ...log.slice(index + 1)];

  return { ...character, log: nextLog, updatedAt: new Date().toISOString() };
};

/** 對整份名冊做修補；沒有任何一支被改就回傳同一個陣列（讓 `useState` 不必重繪）。 */
export const repairRosterStartingFunds = (roster) => {
  if (!Array.isArray(roster)) return roster;
  let changed = false;
  const next = roster.map((character) => {
    const repaired = repairStartingFundsLog(character);
    if (repaired !== character) changed = true;
    return repaired;
  });
  return changed ? next : roster;
};
