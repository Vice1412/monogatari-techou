/**
 * 職業資源池（Class Resource Pools）
 *
 * 這些是**跨場景累積、有上限、玩家必須記住**的計數器——屬於「動態狀態」類技能
 * （見 `docs/skill-coverage.md` 的 T3 分類）。它們不是「要去操作的工具」，
 * 而是「不能忘記的計數器」，因此渲染在跑團卡的常駐資源區，而非職業分頁。
 *
 * 本檔所有數值皆逐條核對官方英文原書（依 `GEMINI.md` 規則二.4）：
 *
 * | 資源 | 職業 | 上限／初始 | 官方原文出處 |
 * |---|---|---|---|
 * | 墳墓點 | 死靈術士 | `SL + 1` | Bonus Collection **p.13**：「You may never have more than (SL + 1) Grave Points」 |
 * | 貿易點數 | 商人 | `SL + 3` | Natural Fantasy **p.159**：「You may never have more than (SL + 3) Trade Points」 |
 * | 幸運數字 | 熵師 | 起始 `7` | Core **p.191**：「at the start of each session, that number is 7」 |
 *
 * **頁碼偏移因書而異**（Core +2、Bonus 0），上表皆為**印刷頁碼**。
 */

/**
 * 職業資源定義。新增資源時只需在此加一筆——UI 會自動長出來。
 *
 * `kind`：
 * - `pool`  —— `0 ~ max` 的資源池，可增減、可清空
 * - `value` —— 單一數值（非池），可設定、可重置為初始值
 */
export const CLASS_RESOURCES = [
  {
    id: 'gravePoints',
    kind: 'pool',
    className: '死靈術士',
    skillName: '超越死界',
    label: '墳墓點',
    maxFromSL: (sl) => sl + 1,
    // 原書有明確的清空時機（HP 歸零），故按鈕直接對應那個事件，而不是泛用「清空」。
    resetLabel: 'HP 歸零',
    resetTo: 0,
    hint: '上限 SL+1',
    source: 'Bonus Collection p.13',
  },
  {
    id: 'tradePoints',
    kind: 'pool',
    className: '商人',
    skillName: '貿易之風',
    label: '貿易點數',
    maxFromSL: (sl) => sl + 3,
    // 原書（Natural Fantasy p.159）：「如果你在角色創建時獲得此技能，你將以 2 點貿易點數開始遊戲。」
    // 這是「開卡時就有」的起點，不是每次聚會重置——所以用 `initial` 而不是 `resetTo`。
    // 已知近似：App 無法判斷技能是「開卡時」還是「升級時」拿到的，一律給 2；
    // 升級才取得的情況會多 2 點。hint 已寫明條件，讓 GM 自己扣。
    initial: 2,
    // 原書沒有「清空貿易點數」的規則——點數只會被花掉，不會被清掉。
    // 故不提供重置按鈕，避免暗示不存在的規則。
    resetLabel: null,
    resetTo: null,
    hint: '上限 SL+3；開卡時取得此技能者以 2 點開始',
    source: 'Natural Fantasy p.159',
  },
  {
    id: 'luckyNumber',
    kind: 'value',
    className: '熵師',
    skillName: '幸運七',
    label: '幸運數字',
    initial: 7,
    // 原書：每次聚會開始時該數字為 7。
    resetLabel: '歸 7',
    resetTo: 7,
    hint: '每次聚會開始時為 7',
    source: 'Core p.191',
  },

  // ── 英雄技能的資源池（2026-10-06，見 `docs/skill-coverage.md` 第六節）──────────
  // 這幾個是「跨場景累積、而且會被引用在傷害公式裡」的計數器。
  // 文字寫得再清楚，跑團時玩家仍然需要一個地方記住現在有幾點。
  {
    id: 'courage',
    kind: 'value',
    min: 0,
    heroicName: '怒潮拳',
    label: '勇氣',
    initial: 0,
    resetLabel: '歸零',
    resetTo: 0,
    hint: '無上限。未裝備職業防具與盾牌時，格鬥類近戰攻擊 +【2+勇氣】傷害；'
      + '場景結束、或回合結束時已累積 ≥5 就必須全部失去，若因此失去至少 1 點則恢復 10 HP 與 10 MP（固定，不是每點）',
    source: 'High Fantasy Atlas p.158',
  },
  {
    id: 'momentum',
    kind: 'pool',
    heroicName: '旋風攻勢',
    label: '氣勢',
    max: 5,
    resetLabel: '歸零',
    resetTo: 0,
    hint: '上限 5。投擲攻擊 +【氣勢】傷害；被命中時必須全消耗加物防；場景結束或裝備防具／盾牌時歸零',
    source: 'High Fantasy Atlas p.160',
  },
  {
    id: 'nebulization',
    kind: 'pool',
    heroicName: '藥水霧化',
    label: '霧化點',
    max: 5,
    resetLabel: '場景結束',
    resetTo: 0,
    hint: '上限 5，每場景結束清空。藥水與元素碎片 +【霧化點×2】傷害；恢復藥水 +【霧化點×5】',
    source: 'Techno Fantasy Atlas p.175',
  },

  // ── 金手指的資源池 ─────────────────────────────────────────────────────
  // ※ 這幾個只在「角色拿了那個金手指」時才顯示——所以啟用條件是 `quirkName`，
  //    不是職業技能。沒拿卻顯示一個用不到的計數器只是噪音。
  {
    id: 'fatigue',
    kind: 'pool',
    quirkName: '富家子弟',
    label: '疲勞值',
    max: 10,
    resetLabel: '每章節恢復 1d6',
    resetTo: 0,
    hint: '上限 10。每次使用保鑣增益累積 1d6；達 10 就不能再依賴他們；每章節恢復 1d6',
    source: 'Bonus Collection p.20',
  },
  {
    id: 'instability',
    kind: 'pool',
    quirkName: '實驗逃亡體',
    label: '不穩定值',
    max: 10,
    resetLabel: '歸零',
    resetTo: 0,
    hint: '上限 10。忽略 100 點以下的 HP/MP/IP 成本可換 1d8；每章節降 1d6；達 10 → HP 歸 0 並投降，然後歸零',
    source: 'Techno Fantasy p.122',
  },
  {
    id: 'subversion',
    kind: 'value',
    min: 0,
    quirkName: '棄暗投明之人',
    label: '顛覆點',
    initial: 0,
    resetLabel: null,
    resetTo: null,
    hint: '沒有上限，也不會被清空——只會被花掉。可代替 1 點物語點的花費',
    source: 'Techno Fantasy p.124',
  },
  {
    id: 'anomaly',
    kind: 'pool',
    quirkName: '遺物使用者',
    label: '異常值',
    max: 10,
    resetLabel: '歸零',
    resetTo: 0,
    hint: '上限 10。每次顯現能力累積 1d6；達 10 → 歸零並骰 d6（1-4 沉睡／5-6 毀滅性釋放）',
    source: 'Techno Fantasy p.125',
  },
  {
    id: 'doubt',
    kind: 'value',
    min: 0,
    quirkName: '固執的懷疑論者',
    label: '懷疑點',
    initial: 0,
    resetLabel: '歸零',
    resetTo: 0,
    hint: '每次效果生效 +1；每章節可再擲 2d20 賺 1；達 20 以上觸發回想記憶',
    source: 'Techno Fantasy p.126',
  },
];

/** 取得角色某職業某技能的 SL；沒有該職業或該技能時回傳 0。 */
export const getSkillSL = (character, className, skillName) => {
  const cls = (character?.classes || []).find((c) => c.className === className);
  if (!cls) return 0;
  const skill = (cls.skills || []).find((s) => s.name === skillName);
  return Math.max(0, Math.floor(Number(skill?.sl) || 0));
};

/**
 * 取得該角色「實際啟用」的職業資源清單（含各自的 max／初始值）。
 * 沒有對應職業、或該技能 SL 為 0 者不會出現——避免對其他角色造成噪音。
 *
 * @param {object} character
 * @returns {Array<{id:string, kind:string, label:string, hint:string|null,
 *                  max:number|null, initial:number|null, sl:number, source:string}>}
 */
export const getActiveClassResources = (character) => {
  const out = [];
  // 角色已取得的英雄技能名（`heroicSkills` 存的是物件，舊存檔可能是字串）
  const heroicNames = (character?.heroicSkills || [])
    .map((h) => (typeof h === 'string' ? h : h?.name))
    .filter(Boolean);
  const quirk = character?.quirk && character.quirk !== '無' ? character.quirk : null;

  for (const def of CLASS_RESOURCES) {
    let sl = 0;
    if (def.quirkName) {
      // 金手指的資源：只有拿了那個金手指才顯示（否則會憑空出現一個沒用的計數器）
      if (quirk !== def.quirkName) continue;
    } else if (def.heroicName) {
      // 英雄技能的資源：以「有沒有拿那個英雄技能」為準，不是職業技能等級
      if (!heroicNames.includes(def.heroicName)) continue;
    } else {
      sl = getSkillSL(character, def.className, def.skillName);
      if (sl <= 0) continue;
    }
    out.push({
      id: def.id,
      kind: def.kind,
      label: def.label,
      hint: def.hint,
      resetLabel: def.resetLabel,
      source: def.source,
      sl,
      max: def.kind === 'pool'
        ? (def.maxFromSL ? def.maxFromSL(sl) : def.max)
        : null,
      // `initial` 兩種 kind 都要傳：池型也可能有「開卡時的起點」（貿易點數＝2）。
      // 沒有標 initial 的池（氣勢、異常值）就是 null，讀取時退回 0。
      initial: def.initial ?? null,
      min: def.kind === 'value' ? (def.min ?? 1) : 0,
    });
  }
  return out;
};

/**
 * 讀取某資源目前的值。缺值時回傳合理預設（池為 0、單值為 initial）。
 *
 * **池型要分開「沒填過」與「填成 0」**：貿易點數的起點是 2，但玩家可以花到 0。
 * 若沿用「<=0 就當沒填」，花到 0 之後會**復活成 2 點**——這比原本的 bug 更糟。
 * 所以池型改看 `Number.isFinite`：NaN（從未寫入）才給 initial，0 就是 0。
 */
export const readResource = (character, resource) => {
  const raw = character?.classResources?.[resource.id];
  if (resource.kind === 'value') {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : resource.initial;
  }
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) {
    // 從未寫入 → 用起點（沒有 initial 的池退回 0），並夾在上限內
    return Math.min(Number(resource.initial) || 0, resource.max);
  }
  return Math.min(n, resource.max);
};

/**
 * 寫入某資源的新值，並依類型夾在合法範圍。
 * - `pool`：夾在 `0 ~ max`
 * - `value`：夾在 `min ~ ∞`。`min` 預設 1（幸運數字不會是 0），
 *   但勇氣／顛覆點／懷疑點的原書起點就是 0，所以它們的 def 標了 `min: 0`。
 */
export const clampResource = (resource, nextValue) => {
  const n = Math.floor(Number(nextValue));
  if (!Number.isFinite(n)) {
    // 池型的預設是「起點」（沒有 initial 就是 0），不是硬性 0——
    // 否則清空後再寫入會把貿易點數打回 0，跟 initial: 2 互相矛盾。
    const fallback = resource.kind === 'value' ? resource.initial : (Number(resource.initial) || 0);
    return resource.kind === 'value' ? fallback : Math.min(resource.max, fallback);
  }
  if (resource.kind === 'value') return Math.max(resource.min ?? 1, n);
  return Math.min(resource.max, Math.max(0, n));
};

/**
 * 建立新的 classResources 物件（不可變更新）。
 * @returns {object} 可直接寫回 character.classResources
 */
export const setResourceValue = (character, resource, nextValue) => ({
  ...(character?.classResources || {}),
  [resource.id]: clampResource(resource, nextValue),
});
