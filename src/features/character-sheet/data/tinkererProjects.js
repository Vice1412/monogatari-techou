/**
 * 修補匠造物專案（Tinkerer Projects）——官方三乘數成本模型。
 *
 * **官方依據**：Core Rulebook, printed p.134–137（PDF p.136–139）
 * 「PROJECTS」章節與「SAMPLE PROJECTS」表（printed p.138）。
 *
 * ## 成本公式（原書逐字）
 *
 * > By consulting the **area, potency, and uses** tables, the GM determines the
 * > invention's total cost in materials, to be paid immediately.
 *
 * **總成本 = 效力基礎價 × 範圍倍率 × 使用次數倍率**
 *
 * | 表 | 值 |
 * |---|---|
 * | Potency Base Cost | Minor 100 / Medium 200 / Major 400 / Extreme 800 zenit |
 * | Area Multiplier | Individual ×1 / Small ×2 / Large ×3 / Huge ×4 |
 * | Uses Multiplier | Consumable ×1 / Permanent ×5 |
 *
 * 缺陷（flaw）：
 * > You may negotiate a terrible flaw with the Game Master … This flaw reduces the
 * > total cost of the Project by **25%**.
 *
 * ## 進度需求 —— 原書是「無條件捨去」，不是四捨五入也不是進位
 *
 * > you must reach an amount of progress equal to **one for every 100 zenit** of
 * > material costs (**minimum one progress required**).
 *
 * **判定證據**：原書官方範例 `Magitech Suit`（printed p.138）為兩個中效力專案
 * （各 200 × 1 × 5 = 1000），其中**一個**加了缺陷：
 * `1000 + (1000 − 25%) = 1000 + 750 = 1750 zenit`，而原書標示
 * **Progress Required: 17** —— 即 `750 → 7 格`（`floor(7.5)`）。
 * 若用進位會得到 8 格、合計 18，與官方範例不符。
 *
 * 因此：`進度 = max(1, floor(折後成本 / 100))`
 *
 * ## 高瞻遠矚（VISIONARY）—— 只減少「支付」，不減少「進度需求」
 *
 * > When you work on a Project, up to **(SL × 100) zenit of material costs are
 * > automatically paid**; additionally, you generate an additional **(SL) progress**
 * > every day. If multiple characters with this Skill work on the same Project, the
 * > effects will be cumulative.
 *
 * 材料成本**仍然發生**（只是被技能代付），故**進度需求仍以折後成本計算**，
 * 只有玩家實際掏出的 zenit 減少。
 */

// ── 效力基礎價表（Core printed p.135）──────────────────────────
export const PROJECT_POTENCY_OPTIONS = [
  {
    key: '小',
    cost: 100,
    label: '小效力 (100z)',
    shortLabel: '小效力',
    desc: '提供照明、在陸地或水上運輸人員或貨物、獲得有限形式的保護（限消耗品單一抗性）。',
    needsSpecial: false
  },
  {
    key: '中',
    cost: 200,
    label: '中效力 (200z)',
    shortLabel: '中效力',
    desc: '在水下旅行、壓制某種魔法效果、傳遞聲音或語言、代替發明者執行特定操作、提供短期能量。（需特殊原料）',
    needsSpecial: true
  },
  {
    key: '大',
    cost: 400,
    label: '大效力 (400z)',
    shortLabel: '大效力',
    desc: '飛行、短時間改變一處區域性質、消除魔法效果、擁有次級智慧、能與發明者並肩作戰、提供長期能量、捕獲或固定目標。（需特殊原料）',
    needsSpecial: true
  },
  {
    key: '強',
    cost: 800,
    label: '強效力 (800z)',
    shortLabel: '強效力',
    desc: '長時間改變一處區域性質、壓制惡魔力量、防止天災浩劫、擁有完整人格與自主心智。（需特殊原料）',
    needsSpecial: true
  }
];

// ── 範圍倍率表（Core printed p.135）────────────────────────────
export const PROJECT_AREA_OPTIONS = [
  { key: '個體', mult: 1, label: '個體 (×1)', shortLabel: '個體', desc: '一個人大小的生物、一扇門、一棵樹、一件武器。' },
  { key: '小型', mult: 2, label: '小型 (×2)', shortLabel: '小型', desc: '幾個人大小的生物、一個大生物、一小塊空地、一個房間、一節車廂、一間小屋。' },
  { key: '大型', mult: 3, label: '大型 (×3)', shortLabel: '大型', desc: '一群人、小森林、一艘飛空艇或大帆船、城堡大廳、一所房屋、一頭巨型生物。' },
  { key: '巨型', mult: 4, label: '巨型 (×4)', shortLabel: '巨型', desc: '要塞、湖泊、山頂、村莊、城市街區。' }
];

// ── 使用次數倍率表（Core printed p.135）────────────────────────
export const PROJECT_USES_OPTIONS = [
  { key: '消耗品', mult: 1, label: '消耗品 (×1)', shortLabel: '消耗品', desc: '一次性使用。啟動後失去效能，除非發明家另外再製造一個複製品。' },
  { key: '永久', mult: 5, label: '永久使用 (×5)', shortLabel: '永久使用', desc: '永久可用。在不同的情況與場景下皆能重複保持其功用。' }
];

/** 缺陷減免比例（原書：reduces the total cost of the Project by 25%）。 */
export const FLAW_DISCOUNT_RATE = 0.25;

/**
 * 依官方三乘數模型計算單一造物專案的成本與進度需求。
 *
 * @param {object} p
 * @param {number} p.potencyCost 效力基礎價（100/200/400/800）
 * @param {number} p.areaMult    範圍倍率（1~4）
 * @param {number} p.usesMult    使用次數倍率（1 或 5）
 * @param {boolean} [p.hasFlaw]  是否協商致命缺陷（−25%）
 * @param {number} [p.visionarySL] 高瞻遠矚技能等級（代付 SL×100z，並每日 +SL 進度）
 * @returns {{rawCost:number, flawDiscount:number, discountedCost:number,
 *            finalPay:number, requiredProgress:number, extraProgressPerDay:number}}
 */
export const calcProjectCost = ({
  potencyCost,
  areaMult,
  usesMult,
  hasFlaw = false,
  visionarySL = 0
}) => {
  const rawCost = potencyCost * areaMult * usesMult;
  const flawDiscount = hasFlaw ? Math.floor(rawCost * FLAW_DISCOUNT_RATE) : 0;
  const discountedCost = rawCost - flawDiscount;

  // 高瞻遠矚只代付 zenit，不改變進度需求（材料成本仍然發生）。
  const finalPay = Math.max(0, discountedCost - visionarySL * 100);

  // 原書：one for every 100 zenit（minimum one）→ 無條件捨去。
  const requiredProgress = Math.max(1, Math.floor(discountedCost / 100));

  return {
    rawCost,
    flawDiscount,
    discountedCost,
    finalPay,
    requiredProgress,
    extraProgressPerDay: visionarySL
  };
};

/**
 * 原書官方範例（Core printed p.138–139「SAMPLE PROJECTS」）。
 * 供測試逐筆驗證公式，**數值一律取自原書，不得修改**。
 */
export const OFFICIAL_SAMPLE_PROJECTS = [
  { name: 'The "Discovery"', potency: '大', area: '大型', uses: '永久', hasFlaw: false, cost: 6000, progress: 60 },
  { name: 'Gatling Golem', potency: '大', area: '個體', uses: '永久', hasFlaw: true, cost: 1500, progress: 15 },
  { name: 'Mag Boots', potency: '中', area: '個體', uses: '永久', hasFlaw: false, cost: 1000, progress: 10 },
  { name: 'Negator Spike', potency: '大', area: '小型', uses: '消耗品', hasFlaw: true, cost: 600, progress: 6 },
  { name: 'Puredust', potency: '大', area: '小型', uses: '消耗品', hasFlaw: false, cost: 800, progress: 8 },
  { name: 'Pyro Oil', potency: '中', area: '大型', uses: '消耗品', hasFlaw: false, cost: 600, progress: 6 },
  { name: 'Sleep Gas', potency: '大', area: '小型', uses: '消耗品', hasFlaw: false, cost: 800, progress: 8 },
  { name: 'Underwater Helm', potency: '中', area: '個體', uses: '永久', hasFlaw: false, cost: 1000, progress: 10 }
];

// ══════════════════════════════════════════════════════════════
//  每日推進（Daily Advancement）
// ══════════════════════════════════════════════════════════════

/**
 * 原書每日推進規則（Core printed p.134）：
 *
 * > At the end of each day, the Project will advance as follows:
 * > - **+1 progress for every Player Character who worked on the Project today.**
 * > - **+1 extra progress for every Player Character with one or more levels in the
 * >   Tinkerer Class who worked on the Project today.**
 *
 * 高瞻遠矚（VISIONARY，Core printed p.211）：
 *
 * > When you work on a Project, up to (SL × 100) zenit of material costs are
 * > automatically paid; additionally, **you generate an additional (SL) progress
 * > every day**. If multiple characters with this Skill work on the same Project,
 * > the effects will be cumulative.
 *
 * 僱用幫手（HIRING HELPERS，Core printed p.137）：
 *
 * > **Each helper will generate 1 additional progress at the end of each day.**
 *
 * ## 語意細節（不得想當然）
 *
 * - **修補匠加成是「額外 +1」，不是取代**。一名有修補匠等級的參與者貢獻 2 格/日。
 * - **修補匠人數不可能超過參與人數**，超出者會被夾住（防呆）。
 * - **高瞻遠矚必須「有參與」才生效**（原文 `When you work on a Project`）；
 *   若當日無人參與，則不產生高瞻遠矚進度。
 *
 * @param {object} p
 * @param {number} [p.workers]          今日參與的玩家角色數（含自己）
 * @param {number} [p.tinkererWorkers]  其中具修補匠等級者的人數
 * @param {number} [p.visionarySL]      參與者中高瞻遠矚的合計 SL（可累加）
 * @param {number} [p.helpers]          僱用的幫手數
 * @returns {{workers:number, tinkererBonus:number, visionary:number, helpers:number, total:number}}
 */
export const calcDailyProgress = ({
  workers = 1,
  tinkererWorkers = 0,
  visionarySL = 0,
  helpers = 0
} = {}) => {
  const w = Math.max(0, Math.floor(Number(workers) || 0));
  const t = Math.min(w, Math.max(0, Math.floor(Number(tinkererWorkers) || 0)));
  const v = w > 0 ? Math.max(0, Math.floor(Number(visionarySL) || 0)) : 0;
  const h = Math.max(0, Math.floor(Number(helpers) || 0));

  return {
    workers: w,
    tinkererBonus: t,
    visionary: v,
    helpers: h,
    total: w + t + v + h
  };
};

/**
 * 推進一天後的專案狀態。
 *
 * 原書（Core printed p.134）：
 * > Once the required amount of progress is reached, the invention is created!
 * > **If you can generate more progress in a day than what is currently needed to
 * > complete the Project, it will be ready within one or two hours.**
 *
 * 故超額推進不算浪費，但也不會溢出到別的專案——進度會夾在總格數，並標記完工。
 *
 * @param {object} project 專案（需含 totalClock / filledClock）
 * @param {object} daily   calcDailyProgress 的輸出
 * @returns {{filledClock:number, completed:boolean, overflow:number, daysWorked:number}}
 */
export const applyDailyProgress = (project, daily) => {
  const total = Math.max(1, Math.floor(Number(project?.totalClock) || 1));
  const filled = Math.max(0, Math.floor(Number(project?.filledClock) || 0));
  const add = Math.max(0, Math.floor(Number(daily?.total) || 0));
  const wasComplete = filled >= total;
  const raw = filled + add;
  const clamped = Math.min(total, raw);

  return {
    filledClock: clamped,
    completed: clamped >= total,
    // 超額只在「本次推進才完工」時有意義（原書：一至兩小時內完成）。
    // 已完工的專案再推進不產生新超額。
    overflow: wasComplete ? 0 : Math.max(0, raw - total),
    daysWorked: Math.max(0, Math.floor(Number(project?.daysWorked) || 0)) + 1
  };
};

/** 僱用幫手的要價：原書為「總成本的一半」（Core printed p.137）。 */
export const helperHireCost = (projectTotalCost) =>
  Math.floor(Math.max(0, Number(projectTotalCost) || 0) / 2);

/** 推進一天表單的預設值（最常見情境：修補匠自己一人動手）。 */
export const DEFAULT_DAILY_INPUT = {
  workers: 1,
  tinkererWorkers: 1,
  helpers: 0
};
