/**
 * 修補匠【小工具】的魔導科技分支 —— 官方公測文件 2026-10-01 版（PDF p.38–39）
 *
 * ## 為什麼要有這個檔
 *
 * p.38 的 `BRANCHING MAGITECH` 把修補匠的魔導科技**拆成兩條互斥分支**：
 *
 *   - `MAGITECH ARMAMENT`（魔導武裝）→ 核心書【小工具】第三軌的替代品
 *   - `MAGISPHERES`（魔法球）      → 另一條替代品，機制與核心的【魔法球原型】不同
 *
 * 官方只拆**第三軌**：煉金術與灌注術照舊。兩條分支**不可並存**——因為它們
 * 都取代同一個技能【小工具】，而 `skills[].variantId` 一次只能存一個值，
 * 互斥性由資料模型本身保證（不需要額外的檢查程式）。
 *
 * ## 與核心書的關係
 *
 * 本檔**只描述分支節點**（給科技樹彈窗與跑團速查用）。
 * 核心書的三軌節點原本寫在 `TinkererGadgetsModal.jsx` 的 `GADGET_TRACKS`，
 * 2026-10-22 搬到本檔的 `MAGITECH_CORE_NODES`——因為魔晶石制要**改寫這三軌**
 * （見下方 `resolveMagitechNodes`），而改寫規則必須與節點資料放在一起，
 * 否則「彈窗顯示兩檔、速查顯示三檔」這種分岔遲早會發生。
 * 變體的效果全文在 `coreBookVariants.js`——兩者是同一條規則的兩種呈現，
 * 數值必須一致（`tests/coreBookVariants.test.mjs` R 區段有對釘）。
 *
 * ## 原文位置
 *
 * - 分支宣告：p.38 `BRANCHING MAGITECH`（含「用魔導武裝就不能取【量子魔加農】」）
 * - 魔導武裝：p.39 基礎／高級／最高
 * - 魔法球：p.38 基礎／高級／最高
 * - 魔晶石制的改寫：科技奇幻手冊 p.133 `EQUIPMENT RULES CHANGES`
 */

/* ──────────────────────────────────────────────────────────────────────────
 * 魔法球（MAGISPHERES）的常數
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 「目標為至多三個生物」的咒語 —— 官方原文是 `target of "Up to three creatures"`。
 *
 * 資料層有兩種寫法（`至多3個生物` 7 筆、`至多三個生物` 9 筆），
 * 所以用正則同時吃阿拉伯數字與中文數字，不要寫死其中一種。
 */
export const MAGISPHERE_TARGET_PATTERN = /至多\s*[3三]\s*(?:個|隻)?\s*生物/;

/** 官方明訂不可選為魔法球的咒語（p.38 高級與最高各寫一次）。 */
export const MAGISPHERE_EXCLUDED_SPELLS = Object.freeze(['毀盪']);

/** 每個節點開發幾顆魔法球（基礎 2、高級再 2、最高再 2）。 */
export const MAGISPHERE_SPELLS_PER_TIER = 2;

/** 透過魔法球施展的咒語，魔法檢定一律用這組屬性（p.38）。 */
export const MAGISPHERE_MAGIC_CHECK = '【INS＋WLP】';

/** 高級魔法球對「攻擊性咒語（O）」的魔法檢定加值（p.38）。 */
export const MAGISPHERE_OFFENSIVE_BONUS = 2;

/** 三個學派——基礎與最高魔法球只能從這三張表挑。 */
export const MAGISPHERE_CORE_SCHOOLS = Object.freeze(['元素', '熵系', '靈魂']);

/* ──────────────────────────────────────────────────────────────────────────
 * 分支節點
 *
 * 節點形狀與 `GADGET_TRACKS.nodes` 一致（`tier / tierName / name / cost / dice / summary / desc`），
 * 讓彈窗可以整條軌道替換而不必改渲染邏輯。
 * ────────────────────────────────────────────────────────────────────────── */

const ARMAMENT_NODES = Object.freeze([
  Object.freeze({
    tier: 1,
    tierName: '基礎益處',
    name: '基礎武裝',
    cost: '2 IP',
    dice: '無檢定',
    summary:
      '執行庫存動作並花費 2 點 IP，創造一件魔導武裝（舊的隨之摧毀）：'
      + '自選類別、近戰或遠程、【DEX＋INS】＋1 或【INS＋MIG】＋1 命中，傷害【HR＋12】物理，雙手，無特性。',
    desc:
      '你可以執行使用庫存動作並花費 2 點庫存點，創造一件魔導武裝，並摧毀你先前創造的魔導武裝。'
      + '創造時選擇一個類別、選擇近戰或遠程、並在【DEX＋INS】＋1 與【INS＋MIG】＋1 之間選擇命中公式。'
      + '魔導武裝一律是雙手武器，傷害【HR＋12】物理，不能擁有任何特性。'
  }),
  Object.freeze({
    tier: 2,
    tierName: '高級益處',
    name: '高級武裝',
    cost: '2 IP',
    dice: '無檢定',
    summary:
      '創造武裝時若兩手皆空，可立即裝備並以它進行一次自由攻擊；'
      + '並可選擇風／電／土／火／冰，讓武裝改為造成該屬性傷害。',
    desc:
      '當你使用基礎武裝創造魔導武裝時，若你的兩個手部欄位皆為空，你可以立即裝備該武裝並以它進行一次自由攻擊。'
      + '此外，每當你創造魔導武裝，你可以選擇風、電、土、火或冰；若你這麼做，該武裝改為造成該屬性傷害而非物理。'
  }),
  Object.freeze({
    tier: 3,
    tierName: '最高益處',
    name: '最高武裝',
    cost: '—',
    dice: '技能動作',
    summary:
      '武裝裝備中時，可用技能動作昇華背包裡的一把武器：'
      + '武裝永遠擁有最後一次昇華武器的特性，並額外造成等同【小工具】技能等級的傷害。',
    desc:
      '只要你的魔導武裝處於裝備狀態，你可以執行技能動作，選擇背包裡的一把武器進行昇華。'
      + '被昇華的武器消失，先前被昇華的武器（若有）重新出現在背包裡。'
      + '你的魔導武裝永遠擁有最後一次昇華武器的特性，並額外造成等同你【小工具】技能等級的傷害。'
  })
]);

const MAGISPHERE_NODES = Object.freeze([
  Object.freeze({
    tier: 1,
    tierName: '基礎益處',
    name: '基礎魔法球',
    cost: '2 IP',
    dice: MAGISPHERE_MAGIC_CHECK,
    summary:
      '從元素／熵系／靈魂三張表挑**兩個目標為「至多三個生物」**的咒語各開發一顆魔法球；'
      + '庫存動作＋2 IP 即可免費執行咒語動作施展其中一顆，魔法檢定一律【INS＋WLP】。',
    desc:
      '從元素、熵系與靈魂學派的咒語表中，選擇兩個目標為「至多三個生物」的咒語（可同表或不同表），'
      + '為它們各開發一顆魔法球——這不算「學習」或「知曉」這些咒語。'
      + '你可以執行使用庫存動作並花費 2 點庫存點，免費執行咒語動作，施展其中一顆魔法球對應的咒語。'
      + '該咒語遵循正常規則（包含 MP 消耗與魔法檢定），而透過魔法球施展的魔法檢定為【INS＋WLP】。'
  }),
  Object.freeze({
    tier: 2,
    tierName: '高級益處',
    name: '高級魔法球',
    cost: '2 IP',
    dice: `${MAGISPHERE_MAGIC_CHECK}＋2`,
    summary:
      '再挑**兩個 NPC 咒語**（不可選【毀盪】）各開發一顆魔法球，並須自訂化；'
      + '透過魔法球施展的**攻擊性**咒語魔法檢定 +2。',
    desc:
      '從 NPC 咒語表（核心書 p.310）選擇兩個不同的咒語，不可選擇【毀盪】。'
      + '為它們各開發一顆魔法球（同樣不算學習或知曉），並在需要時自訂化這些咒語'
      + '（例如選了【詛咒之息】，可以指定屬性與狀態並改名為【凍結手榴彈】）。'
      + '此外，你透過魔法球施展的攻擊性咒語（O）魔法檢定獲得 +2 加值。'
  }),
  Object.freeze({
    tier: 3,
    tierName: '最高益處',
    name: '最高魔法球',
    cost: '2 IP',
    dice: `${MAGISPHERE_MAGIC_CHECK}＋2`,
    summary:
      '再挑**兩個**咒語（三學派與／或 NPC 咒語表，同樣不可選【毀盪】）各開發一顆魔法球。',
    desc:
      '從元素、熵系與靈魂學派的咒語表，以及／或 NPC 咒語表中，選擇兩個不同的咒語（可同表或不同表），'
      + '為它們各開發一顆魔法球；同樣不可選擇【毀盪】，且 NPC 咒語在需要時須自訂化。'
  })
]);

/**
 * 兩條分支。`id` 與 `coreBookVariants.js` 的變體 id **相同**——
 * 呼叫端拿 `skills[].variantId` 直接查這張表即可。
 */
export const MAGITECH_BRANCHES = Object.freeze({
  magitechArmament: Object.freeze({
    id: 'magitechArmament',
    name: '魔導武裝',
    en: 'MAGITECH ARMAMENT',
    origin: 'Playtest 2026-10-01 p.39',
    subtitle: '以庫存動作現場鍛造一把雙手武器（舊武裝隨之摧毀）',
    /** 這條分支沒有咒語挑選器。 */
    spellPicking: 'none',
    nodes: ARMAMENT_NODES
  }),
  magispheres: Object.freeze({
    id: 'magispheres',
    name: '魔法球',
    en: 'MAGISPHERES',
    origin: 'Playtest 2026-10-01 p.38',
    subtitle: '為咒語開發魔法球，以庫存動作＋2 IP 免費施展',
    /** 每個節點都開發 2 顆，需要挑咒語。 */
    spellPicking: 'perTier',
    nodes: MAGISPHERE_NODES
  })
});

/** 這個變體 id 是不是一條魔導科技分支（不是分支就回 null）。 */
export const getMagitechBranch = (variantId) => MAGITECH_BRANCHES[variantId] || null;

/**
 * 這條分支總共要挑幾顆魔法球（基礎 2、高級 4、最高 6）。
 * 非魔法球分支回 0。
 */
export const getMagisphereSlotCount = (tier, branchId = 'magispheres') => {
  if (branchId !== 'magispheres') return 0;
  const t = Math.max(0, Math.min(3, Number(tier) || 0));
  return t * MAGISPHERE_SPELLS_PER_TIER;
};

/** 攻擊性咒語的魔法檢定加值（高級以上才有）。 */
export const getMagisphereOffensiveBonus = (tier) =>
  (Number(tier) || 0) >= 2 ? MAGISPHERE_OFFENSIVE_BONUS : 0;

/** 這個咒語的目標是不是「至多三個生物」。 */
export const isUpToThreeCreaturesTarget = (target) =>
  MAGISPHERE_TARGET_PATTERN.test(String(target || ''));

/**
 * NPC 咒語的效果文帶有 `{spell_breath_type}` 這類佔位符（NPC 工坊要玩家自選）。
 * 魔法球清單只需要「看得懂」，所以把佔位符換成該選項的標籤，例如 `〔屬性〕`。
 * 剩下的未知佔位符一律顯示 `〔自訂〕`——官方本來就要求自訂化。
 */
export const resolveSpellPlaceholders = (effect = '', selectionsConfig = []) => {
  let out = String(effect || '');
  for (const sel of selectionsConfig || []) {
    if (!sel?.key) continue;
    out = out.split(`{${sel.key}}`).join(`〔${sel.label || '自訂'}〕`);
  }
  return out.replace(/\{[a-z0-9_]+\}/gi, '〔自訂〕');
};

const normalizeCoreSpell = (sp) => ({
  name: sp.name,
  school: sp.school,
  mp: sp.mp,
  target: sp.target,
  duration: sp.duration,
  effect: sp.effect || sp.desc || '',
  isOffensive: sp.isOffensive === true,
  source: 'core'
});

const normalizeNpcSpell = (name, sp) => ({
  name,
  school: 'NPC',
  mp: sp.mp,
  target: sp.target,
  duration: sp.duration,
  effect: resolveSpellPlaceholders(sp.effect || sp.desc || '', sp.selectionsConfig),
  isOffensive: sp.isOffensive === true,
  source: 'npc',
  /** NPC 咒語需要自訂化（官方原文：must customize … if required）。 */
  needsCustomization: true
});

/**
 * 這條分支在**當前階級**可以挑的咒語池（累積：基礎 2 顆的池 ＋ 高級的池 ＋ 最高的池）。
 *
 * @param {number} tier 已解鎖的節點數（0–3）
 * @param {object} sources
 * @param {Array} sources.coreSpells `rulesData.spells`（38 筆三學派咒語）
 * @param {object} sources.npcSpells  `SPELLS_DATA`（NPC 工坊的咒語表，鍵為咒語名）
 * @returns {Array} 正規化後的咒語（`source` 區分 core／npc）
 */
export const getMagispherePool = (tier, { coreSpells = [], npcSpells = {} } = {}) => {
  const t = Math.max(0, Math.min(3, Number(tier) || 0));
  if (t === 0) return [];

  const core = (coreSpells || []).filter((sp) => MAGISPHERE_CORE_SCHOOLS.includes(sp.school));
  const npcEntries = Object.entries(npcSpells || {})
    .filter(([name]) => !MAGISPHERE_EXCLUDED_SPELLS.includes(name))
    .map(([name, sp]) => normalizeNpcSpell(name, sp));

  const picked = [];

  // 基礎：三學派中「目標為至多三個生物」的咒語；最高則是三學派全部
  if (t >= 1) {
    const corePick = t >= 3 ? core : core.filter((s) => isUpToThreeCreaturesTarget(s.target));
    picked.push(...corePick.map(normalizeCoreSpell));
  }

  // 高級：NPC 咒語表（排除【毀盪】）
  if (t >= 2) {
    picked.push(...npcEntries);
  }

  // 同名去重（核心與 NPC 表有重疊 25 筆，例如【照明烈焰】）——先出現的（核心）優先
  const seen = new Set();
  return picked.filter((sp) => {
    if (seen.has(sp.name)) return false;
    seen.add(sp.name);
    return true;
  });
};

/* ──────────────────────────────────────────────────────────────────────────
 * 核心書的魔導科技三檔（`GADGET_TRACKS.magitech` 的唯一來源）
 *
 * 節點形狀與分支節點相同，多一個 `id` 讓「魔晶石制要刪哪一檔」不必靠名稱比對。
 * ────────────────────────────────────────────────────────────────────────── */

export const MAGITECH_CORE_NODES = Object.freeze([
  Object.freeze({
    id: 'magitechOverride',
    tier: 1,
    tierName: '基礎益處',
    name: '魔科技篡奪',
    cost: '10 MP',
    dice: '【INS + INS】',
    summary: '花費 10 MP 檢定奪取附近無心智士兵階構裝體的控制權至場景結束。',
    desc: '使用一個動作並花費 10 點 MP，對可見無心智的構裝體士兵執行對抗檢定【INS + INS】。成功則奪取其控制權至場景結束或遭受傷害為止。'
  }),
  Object.freeze({
    id: 'magicannon',
    tier: 2,
    tierName: '高級益處',
    name: '魔加農火器',
    cost: '2 IP',
    dice: '【DEX + INS】+1',
    summary: '消耗 2 IP 製造雙手遠程火器，傷害【HR + 10】自選屬性。',
    desc: '花費 2 點 IP 製造一把魔加農火器（摧毀舊有魔加農）。雙手遠程，命中【DEX + INS】+1，傷害【HR + 10】，可自選風/電/土/火/冰/物理屬性。'
  }),
  Object.freeze({
    id: 'magispheres',
    tier: 3,
    tierName: '最高益處',
    name: '魔法球原型',
    cost: '2 IP',
    dice: '咒語檢定',
    summary: '開發 3 個原型咒語（20級 5 個、40級 7 個），花費 2 IP 快捷施放。',
    desc: '自元素、熵系、靈魂學派目錄中自由研發魔法球原型。花費 2 點 IP 執行使用庫存動作並立即免費執行咒語動作施展已開發的原型咒語。'
  })
]);

/**
 * 魔晶石制下的魔導科技（科技奇幻手冊 p.133，逐字）：
 *
 *   > Any other equipment simply cannot exist. For this reason, you should ignore the
 *   > Dual Shieldbearer Skill from the Guardian Class … and **turn the magispheres from
 *   > the Tinkerer Class into an advanced magitech benefit, removing the magicannon
 *   > completely**.
 *
 * 兩個動作，理由不同：
 *
 * 1. **魔加農整檔刪除。** 它在核心書 p.215 是一把**武器**（`Firearm • Two-handed •
 *    Ranged • Cannot have Qualities`）。魔晶石制的裝備白名單只剩定制武器／防具／
 *    飾品／機師模組，它不在裡面；而且 `Cannot have Qualities` 意味著它**一顆魔石都
 *    鑲不了**（插槽來自 Slot α/β/γ/δ 品質）。留著只會讓玩家選一個不能用的東西。
 * 2. **魔法球原型往下兼容成「高級益處」**——原書說的是 `turn into an advanced
 *    magitech benefit`，不是刪除。它本來是最高檔（tier 3），魔晶石制下補上魔加農
 *    空出來的位置（tier 2），所以這一態的魔導科技**只有兩個益處**。
 *
 * ※ 原書**沒有給出**「advanced magitech benefit」的替代文本。這裡刻意**不改寫效果
 * 內容**，只改它在技能樹上的位置——因為「改成什麼」原書沒說，憑空補一段等於發明規則。
 * 裁定與理由見 `docs/decisions.md` §BX。
 *
 * @param {boolean} technoRestrictsEquipment 是否為「裝備受限」的魔晶石模式
 * @returns {ReadonlyArray} 兩檔或三檔節點
 */
export const resolveMagitechNodes = (technoRestrictsEquipment = false) => {
  if (!technoRestrictsEquipment) return MAGITECH_CORE_NODES;
  return MAGITECH_CORE_NODES
    .filter((node) => node.id !== 'magicannon')
    .map((node) => (node.id === 'magispheres'
      ? Object.freeze({ ...node, tier: 2, tierName: '高級益處' })
      : node));
};

/** 魔導科技這一軌在當前規則下的最高檔（核心 3、魔晶石制 2）。 */
export const magitechMaxTier = (technoRestrictsEquipment = false) =>
  (technoRestrictsEquipment ? 2 : 3);

/** 魔導科技第 `tier` 檔的節點（超出範圍回 null）。 */
export const magitechNodeAt = (tier, technoRestrictsEquipment = false) =>
  resolveMagitechNodes(technoRestrictsEquipment).find((n) => n.tier === Number(tier)) || null;