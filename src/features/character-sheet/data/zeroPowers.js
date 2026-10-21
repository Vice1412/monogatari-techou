/**
 * 底力技（ZERO POWERS）—— 《高度奇幻手冊》第三章選用規則，印刷 p.124–131（PDF p.126–133）。
 *
 * ## 出處與權威
 *
 * 官方英文原書 *Fabula Ultima — Atlas: High Fantasy*。**它不在官方特典合輯裡**，
 * 也不在自然奇幻／科技奇幻手冊裡（實測全文掃描 `ZERO POWER`：NF 0 命中、TF 0 命中）。
 * 早期文件把它寫成「官方特典的子系統」是錯的，見 `docs/zero-powers-hf.md` §0。
 *
 * 中文譯名取自**繁中版角色卡 V2.17**（`附加表!B205–AH208`）：`底力技`／`觸發`／
 * `填充數量`／`效果`／`傷害親和度`。效果名官方沒有逐筆譯名（該區塊是空白模板），
 * 本專案採「零之X」體系——理由見 `docs/zero-powers-hf.md` §4.1：
 * CHM 的裸詞譯名（成本／元素／極限／目標）在規則書靠粗體就能分辨，放進選單
 * 會與角色卡上天天出現的通用詞撞車。CHM 舊名保留在 `alias` 供檢索，不顯示。
 *
 * ## 為什麼是獨立模組
 *
 * 這條規則不是「一個開關」，它是一個子系統：一個新資源（底力命刻）、
 * 七個觸發、十一個效果、一張 120 詞的命名表、兩個改變資料模型的變體。
 * 把它拆在引擎與介面各寫一份的後果，與 `initiativeVariant.js` 檔頭寫的是同一件事——
 * 漏改的那一處，畫面看起來永遠正常。
 *
 * ## 原文的兩處內部不一致（本模組的裁定）
 *
 * ① 零之機運的「上一行的效果」：依版面順序＝**較弱的一檔**（三顆→兩顆→一顆→零顆）。
 * ② 零之天災：前句要求「選兩種狀態」，後句寫 `the chosen status effect`（單數）——
 *    取**兩種都施加**。兩條都記在 `docs/zero-powers-hf.md` §3。
 */

/** `creationRules` 上的欄位名。 */
export const ZERO_POWER_FIELD = 'zeroPowers';

/** 出處（介面與測試共用，避免各處自己打字）。 */
export const ZERO_POWER_SOURCE = '高度奇幻手冊 p.124–131';

/** 標準底力命刻的刻度數。 */
export const ZERO_CLOCK_SECTIONS = 6;

/** 【合體之力】變體下的刻度數（原文：a 4-section Zero Clock）。 */
export const ZERO_CLOCK_SECTIONS_COMBINED = 4;

/** 施展時可用的傷害類型（原文只列這八種，不含物理）。 */
export const ZERO_DAMAGE_TYPES = Object.freeze(['風', '電', '暗', '土', '火', '冰', '光', '毒']);

/** 【零之天災】可選的狀態效果（原文只列這四種，不含中毒與憤怒）。 */
export const ZERO_STATUS_EFFECTS = Object.freeze(['眩暈', '動搖', '緩慢', '虛弱']);

/** 底力技的兩個變體規則。 */
export const ZERO_VARIANTS = Object.freeze([
  { id: 'awakened', name: '覺醒之力', page: 'p.130', desc: '建角時只選效果、不選觸發；角色在瀕死或遭遇重大轉折時才覺醒並取得觸發。' },
  { id: 'combined', name: '合體之力', page: 'p.131', desc: '命刻改為 4 格；每一對玩家角色共用一個效果，雙方命刻皆滿才能施展。' }
]);

/**
 * 底力觸發（ZERO TRIGGERS）。
 *
 * `fill` 是填充刻度數；`'varies'` 代表依情境計算（【協同】：每個處於弱點的目標 1 格）。
 * `special` 標記需要額外欄位或額外規則的觸發。
 */
export const ZERO_TRIGGERS = Object.freeze([
  {
    id: 'compassion',
    name: '憐憫',
    en: 'Compassion',
    fill: 1,
    desc: '當你恢復一個或多個盟友的 HP 和／或 MP 時發動。只限本身就會恢復 HP 或 MP 的效果——因另一個效果而提高恢復量的不算。'
  },
  {
    id: 'defiance',
    name: '挑戰',
    en: 'Defiance',
    fill: 1,
    desc: '在衝突中，你的回合開始時，若場景中存在一個或多個反派和／或冠位階級的敵人，則發動。'
  },
  {
    id: 'love',
    name: '愛',
    en: 'Love',
    fill: 1,
    special: 'bindToPc',
    desc: '選擇這個觸發時，將它綁定到另一個你愛上的玩家角色。當他失去 HP（非自己造成）和／或投降時，只要你看得見他，就發動。若他犧牲自己且你目睹了那次犧牲，填滿你的底力命刻，並在該場景結束時改選另一個觸發。',
    /**
     * 綁定對象確定後改寫的版本（完整卡片用）。
     *
     * `desc` 是「還沒綁定時」的說明（名詞彈窗用），開頭那句「選擇這個觸發時…」
     * 是給還在選的人看的；已經綁好了就不該再讀到它——使用者原話：
     * 「愛觸發改成自己寫名字」。`{who}` 由 `describeZeroTrigger` 代入角色名。
     */
    boundDesc: '當【{who}】失去 HP（非自己造成）和／或投降時，只要你看得見【{who}】，就發動。若【{who}】犧牲自己且你目睹了那次犧牲，填滿你的底力命刻，並在該場景結束時改選另一個觸發。'
  },
  {
    id: 'revenge',
    name: '復仇',
    en: 'Revenge',
    fill: 3,
    desc: '當你在一個場景中第一次進入危機狀態時發動。'
  },
  {
    id: 'sequence',
    name: '連續',
    en: 'Sequence',
    fill: 2,
    desc: '當一個你能看見的盟友施展其底力效果時發動。'
  },
  {
    id: 'strategy',
    name: '戰略',
    en: 'Strategy',
    fill: 1,
    desc: '在衝突中，你的回合結束時，若場景中存在的一個或多個敵人合計承受兩種或以上的不同狀態效果，則發動。'
  },
  {
    id: 'synergy',
    name: '協同',
    en: 'Synergy',
    fill: 'varies',
    desc: '當你對一個或多個生物造成傷害時發動：每有一個對該次傷害類型處於弱點的生物，填充 1 個刻度。'
  }
]);

/**
 * 底力效果（ZERO EFFECTS）。
 *
 * `choice` 描述施展或選取時要玩家做的額外選擇——`null` 代表沒有。
 * 形狀刻意是資料而不是 if：介面靠它決定要開哪一種選擇器，
 * 護欄靠它確認「十一種效果裡需要選擇的那四種」沒有被漏掉。
 */
export const ZERO_EFFECTS = Object.freeze([
  {
    id: 'blitz',
    name: '零之疾襲',
    en: 'Zero Blitz',
    alias: ['閃電戰'],
    choice: null,
    desc: '你以每一把已裝備的武器各進行一次自由攻擊。若你只裝備一把武器，該攻擊額外造成 20 點傷害；若你裝備兩把以上武器，則每次攻擊的命中檢定獲得 +5 加值。'
  },
  {
    id: 'chance',
    name: '零之機運',
    en: 'Zero Chance',
    alias: ['把握機會'],
    choice: 'oddOrEven',
    desc: '選擇奇數或偶數，骰 3d6，看有幾顆符合。接著套用對應的效果，或緊接在其上一行的效果——由你選擇。零顆：填充你的底力命刻 3 個刻度、每個你能看見的其他玩家角色 1 個刻度，然後執行一個額外動作。一顆：以一把已裝備的武器自由攻擊，額外造成 3d6 總和的傷害。兩顆：對一個你能看見的生物造成 30 ＋ 等級一半 ＋ 3d6 總和的傷害，此傷害沒有類型（無視親和度）。三顆：你與每個你能看見的盟友從所有狀態效果中恢復，並恢復危機值 ＋ 3d6 總和的 HP 與 MP。最後，若三顆骰子點數相同，你可以在本回合再執行一個額外動作。'
  },
  {
    id: 'cost',
    name: '零之成本',
    en: 'Zero Cost',
    alias: ['成本'],
    choice: null,
    desc: '直到場景結束前，你所有的庫存點成本視為減半（向下取整）。你也可以立即免費執行庫存動作。'
  },
  {
    id: 'elements',
    name: '零之元素',
    en: 'Zero Elements',
    alias: ['元素'],
    choice: 'damagePair',
    desc: '選擇這個效果時，從八種傷害類型中選擇兩種。施展時從這兩種中選定一種：你造成的所有傷害都變成該類型、無法被其他效果改變、且無視吸收免疫與抗性，並額外造成 5 點傷害。持續到場景結束、直到你再次施展，或直到你主動結束它。你也能在本回合執行一個額外動作。',
    /**
     * 兩種傷害類型選好後改寫的版本（完整卡片用）。
     *
     * 原句「選擇這個效果時，從八種傷害類型中選擇兩種」在建角時就已經執行完了，
     * 卡片上再讀一次只會讓人以為還沒選。`{pair}` 由 `describeZeroEffect` 代入。
     */
    resolvedDesc: '施展時在{pair}之中選定一種：你造成的所有傷害都變成該類型、無法被其他效果改變、且無視吸收免疫與抗性，並額外造成 5 點傷害。持續到場景結束、直到你再次施展，或直到你主動結束它。你也能在本回合執行一個額外動作。'
  },
  {
    id: 'limits',
    name: '零之極限',
    en: 'Zero Limits',
    alias: ['極限'],
    choice: null,
    desc: '直到場景結束前，你的所有屬性視為提升一階骰尺寸（最高 d12）。你也能在本回合執行一個額外動作。'
  },
  {
    id: 'magic',
    name: '零之魔法',
    en: 'Zero Magic',
    alias: ['咒語'],
    choice: null,
    desc: '你免費執行咒語動作，施展一個你已學會的咒語，該咒語的總 MP 消耗視為 0（含因技能與效果而增加的任何消耗）。該咒語額外造成 10 點傷害；若它是攻擊性咒語，你的魔法檢定獲得 +5 加值。'
  },
  {
    id: 'objective',
    name: '零之目標',
    en: 'Zero Objective',
    alias: ['目標'],
    choice: 'fillOrErase',
    desc: '選擇一項：填充與當前場景相關的一個命刻的 3 個刻度；或清空與當前場景相關的一個命刻的 3 個刻度。兩句各寫「一個命刻」，所以填充與清空可以指向不同的命刻。'
  },
  {
    id: 'remedy',
    name: '零之救濟',
    en: 'Zero Remedy',
    alias: ['救濟'],
    choice: null,
    desc: '你與任意數量你能看見的盟友從所有狀態效果中恢復，並恢復 40 ＋ 等級一半的 HP。'
  },
  {
    id: 'scourge',
    name: '零之天災',
    en: 'Zero Scourge',
    alias: ['天災'],
    choice: 'damagePlusStatuses',
    desc: '選擇這個效果時，從八種傷害類型中選擇一種，再從眩暈動搖緩慢虛弱中選擇兩種狀態效果。施展時選擇任意數量你能看見的生物：你對每個目標造成 30 ＋ 等級一半的該類型傷害，且他們承受所選的狀態效果。',
    /** 傷害類型與兩種狀態選好後改寫的版本（完整卡片用），同【零之元素】的理由。 */
    resolvedDesc: '施展時選擇任意數量你能看見的生物：你對每個目標造成 30 ＋ 等級一半的{type}傷害，且他們承受{statuses}。'
  },
  {
    id: 'shield',
    name: '零之盾',
    en: 'Zero Shield',
    alias: ['屏障'],
    choice: null,
    desc: '直到你的下一個回合開始前，你與場景中在場的每一位盟友受到的所有傷害減半（在計算親和度之前）。'
  },
  {
    id: 'triangle',
    name: '零之三角',
    en: 'Zero Triangle',
    alias: ['三角'],
    choice: null,
    desc: '你與至多兩名你能看見的盟友，以你裝備的一把武器各進行一次自由攻擊（若他們是 NPC，則改為進行一次基本攻擊）。這些攻擊的命中檢定獲得 +5 加值。'
  }
]);

/**
 * 底力技命名表（印刷 p.128–129）——CHM 漢化完全未收錄。
 *
 * 原文的用法是「由來 ＋ 動作」串起來：`Royal Blade`＝王家之刃、
 * `Lady Luck's Wheel`＝幸運女神之法輪、`Blade of Memory`＝記憶之刃。
 * 兩個表各自獨立骰：動作 1d20 選一欄，由來 1d10 選一欄。
 *
 * `rows[i]` 的索引就是骰值減一——**不要重排**，護欄逐格比對順序。
 */
export const ZERO_NAME_ACTIONS = Object.freeze({
  columns: Object.freeze(['攻擊性', '防禦性', '強化']),
  rows: Object.freeze([
    ['咬噬', '障壁', '靈氣'],
    ['刃', '堡壘', '覺醒'],
    ['吐息', '覆被', '祝福'],
    ['彈', '圓陣', '綻放'],
    ['鎖鏈', '陣圖', '氣息'],
    ['爪', '擁抱', '斗篷'],
    ['舞', '陣形', '恩寵'],
    ['爆裂', '要塞', '本能'],
    ['獠牙', '守護者', '吻'],
    ['連擊', '手', '解放'],
    ['瞪視', '祈喚', '冥想'],
    ['衝擊', '霧', '奇蹟'],
    ['電擊', '網', '道途'],
    ['漩渦', '反射', '祈禱'],
    ['拳', '環', '秘奧'],
    ['斬', '盾', '傳說'],
    ['槍', '符印', '觸碰'],
    ['刺針', '歌', '幻視'],
    ['風暴', '螺旋', '誓約'],
    ['群襲', '帷幕', '法輪']
  ])
});

export const ZERO_NAME_ORIGINS = Object.freeze({
  columns: Object.freeze(['兵法', '獸與魔物', '自然元素', '內在之力', '神聖與瀆神', '不可解']),
  rows: Object.freeze([
    ['迅捷', '烏鴉', '靜電', '先祖的', '天使', '幸運女神的'],
    ['爆發', '龍', '冰寒', '終焉', '聖化', '混沌'],
    ['鋼鐵', '蜻蜓', '熾炭', '柔', '魔性', '星辰'],
    ['神盾', '鷹', '露珠', '孤', '神性', '夢'],
    ['塵土', '狐', '落雨', '破碎之心', '永恆', '以太'],
    ['霸將的', '猿', '虹', '記憶', '墳墓', '隱秘'],
    ['軍團', '鳳凰', '震地', '漂泊者的', '地獄', '月'],
    ['老兵的', '巨蛇', '旋流', '狂怒', '破滅', '蒼白'],
    ['王家的', '泰坦', '雷鳴', '靈性', '輝光', '稜彩'],
    ['君主的', '狼', '和風', '超音速', '幽魂', '緋紅']
  ])
});

/** 本身已是形容詞的由來詞——直接接動作，不補「之」（王家之刃 vs 王家刃）。 */
const ADJECTIVAL_ORIGINS = Object.freeze([
  '先祖的', '終焉', '柔', '孤', '永恆', '霸將的', '老兵的', '王家的', '君主的',
  '漂泊者的', '狂怒', '靈性', '超音速', '幸運女神的', '神性', '魔性'
]);

const clampIndex = (value, length) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(length - 1, Math.max(0, Math.trunc(n)));
};

/**
 * 把命名表整理成「一欄一張卡」的清單，給介面與護欄共用。
 *
 * 介面需要的是**欄**（一張卡＝一欄），而 `rows` 是列優先的——這個轉置放在資料層，
 * 護欄才能與畫面共用同一份整形結果，而不是各寫一次（那正是 §AW6 的坑）。
 *
 * @param {'action'|'origin'} kind
 * @returns {Array<{column:string, columnIndex:number, die:string, rows:Array<{id:number, zh:string}>}>}
 */
export const zeroNameTableGroups = (kind) => {
  const isOrigin = kind === 'origin';
  const table = isOrigin ? ZERO_NAME_ORIGINS : ZERO_NAME_ACTIONS;
  const die = isOrigin ? 'd10' : 'd20';
  return table.columns.map((column, columnIndex) => ({
    column,
    columnIndex,
    die,
    rows: table.rows.map((row, rowIndex) => ({ id: rowIndex + 1, zh: row[columnIndex] }))
  }));
};

/**
 * 由兩顆骰的結果組出一個底力技名稱。
 *
 * 串接規則：由來詞本身已是形容詞（「王家的」「終焉」「幸運女神的」）→ 直接接動作；
 * 其餘名詞性的由來（「烏鴉」「雷鳴」「記憶」）→ 中間補「之」。
 * `reversed` 給「動作在前」的命名口味（`刃・王家`）。
 *
 * @param {{actionRoll:number, actionColumn:number, originRoll:number, originColumn:number, reversed?:boolean}} input
 * @returns {{action:string, origin:string, name:string}}
 */
export const generateZeroPowerName = ({
  actionRoll = 1,
  actionColumn = 0,
  originRoll = 1,
  originColumn = 0,
  reversed = false
} = {}) => {
  const actionRows = ZERO_NAME_ACTIONS.rows;
  const originRows = ZERO_NAME_ORIGINS.rows;
  const action = actionRows[clampIndex(actionRoll - 1, actionRows.length)][
    clampIndex(actionColumn, ZERO_NAME_ACTIONS.columns.length)
  ];
  const origin = originRows[clampIndex(originRoll - 1, originRows.length)][
    clampIndex(originColumn, ZERO_NAME_ORIGINS.columns.length)
  ];
  let name;
  if (reversed) {
    name = `${action}·${origin}`;
  } else if (ADJECTIVAL_ORIGINS.includes(origin)) {
    name = `${origin}${action}`;
  } else {
    name = `${origin}之${action}`;
  }
  return { action, origin, name };
};

/**
 * 直接擲一次名字（1d20 動作 ＋ 1d10 由來）。
 *
 * 抽成純函式是為了讓「隨機」按鈕長在**外面**——命名表彈窗裡也用它，
 * 兩邊才是同一套骰法。使用者裁定 2026-10-21：表和隨機都該擺在外面，
 * 「要隨機測試還要點進表」是多餘的一層。
 *
 * 欄位預設取第一欄；命名表的欄位選擇是「先看全表再挑口味」的輔助，
 * 外面的隨機按鈕沒有那個上下文，所以用預設欄。
 */
export const rollZeroPowerName = ({ actionColumn = 0, originColumn = 0, reversed = false } = {}) => {
  const actionRoll = 1 + Math.floor(Math.random() * ZERO_NAME_ACTIONS.rows.length);
  const originRoll = 1 + Math.floor(Math.random() * ZERO_NAME_ORIGINS.rows.length);
  const rolled = generateZeroPowerName({ actionRoll, actionColumn, originRoll, originColumn, reversed });
  return { ...rolled, actionRoll, originRoll, actionColumn, originColumn };
};

/** 依 id 取觸發（找不到回 `null`，呼叫端自己決定怎麼處理）。 */
export const zeroTriggerById = (id) => ZERO_TRIGGERS.find((t) => t.id === id) || null;

/** 依 id 取效果。 */
export const zeroEffectById = (id) => ZERO_EFFECTS.find((e) => e.id === id) || null;

/**
 * 底力技是否開啟（**單一判定入口**）。
 *
 * 接受角色物件（讀 `character.creationRules`）或規則物件本身。
 * 只認真正的布林 `true`：存檔裡出現字串 `'true'` 不算——
 * 壞資料不該默默打開一整套子系統。
 */
export const isZeroPowersEnabled = (characterOrRules) => {
  if (!characterOrRules || typeof characterOrRules !== 'object') return false;
  const rules = characterOrRules.creationRules && typeof characterOrRules.creationRules === 'object'
    ? characterOrRules.creationRules
    : characterOrRules;
  return rules[ZERO_POWER_FIELD] === true;
};

/**
 * 新角色的底力技資料。
 *
 * **空的就是空的**：建角時不替玩家選觸發或效果（與屬性骰、羈絆、金手指同一個原則——
 * 見 `characterEngine.createNewCharacter` 的註解）。`clock` 也不預先填，
 * 因為填幾格是跑團時的事，不是建角時的事。
 */
export const createZeroPowerState = () => ({
  /** 底力技自己的名字（p.128–129 的命名表），與角色姓名無關 */
  name: '',
  triggerId: '',
  effectId: '',
  /** 觸發．愛 綁定的玩家角色 id */
  loveTargetId: '',
  /** 效果需要的額外選擇（形狀由 `ZERO_EFFECTS[].choice` 決定） */
  choices: {
    /** 零之元素：選定的兩種傷害類型 */
    damagePair: [],
    /** 零之天災：選定的傷害類型 */
    damageType: '',
    /** 零之天災：選定的兩種狀態效果 */
    statuses: []
  },
  /** 底力命刻的已填充刻度（0 代表空） */
  clock: 0,
  /** 變體：'' | 'awakened' | 'combined' */
  variant: '',
  /** 覺醒之力：是否已覺醒 */
  awakened: false,
  /**
   * 合體之力：**每一個其他玩家角色各一組配對**。
   *
   * 原文 p.131：「Each Player Character gains one zero effect for each other Player
   * Character – decide together what they are. Each possible pair of PCs shares one
   * zero effect.」四人團 → 每人三組、全團 C(4,2)=6 個效果，正是原文範例的數字。
   *
   * 所以這裡**不能**只存一個 `combinedWith`：那等於假設只有兩人團。
   * 每組 `{ partnerId, effectId, nickname }`；`effectId` 存在**配對**上，不在角色上。
   */
  combinedPairs: []
});

/**
 * 合體之力的配對清單正規化（含舊存檔遷移）。
 *
 * 舊版只存一個 `combinedWith`，且效果放在角色自己的 `effectId` 上——
 * 那是「兩人團」的形狀。讀到這種資料就**就地升格**成一組配對，
 * 效果沿用當時的 `effectId`（當時唯一的語意就是配對效果）。
 */
const normalizeCombinedPairs = (raw, effectId) => {
  const list = Array.isArray(raw.combinedPairs) ? raw.combinedPairs : null;
  if (list) {
    return list
      .filter((p) => p && typeof p === 'object' && !Array.isArray(p))
      .map((p) => ({
        partnerId: typeof p.partnerId === 'string' ? p.partnerId : '',
        effectId: zeroEffectById(p.effectId) ? p.effectId : '',
        nickname: typeof p.nickname === 'string' ? p.nickname : ''
      }))
      .filter((p) => p.partnerId)
      .slice(0, 8);
  }
  if (typeof raw.combinedWith === 'string' && raw.combinedWith) {
    return [{ partnerId: raw.combinedWith, effectId, nickname: '' }];
  }
  return [];
};

/**
 * 把任何來源的底力技資料正規化成可安全讀取的形狀。
 *
 * 舊存檔沒有這個欄位（`undefined`）→ 回傳空狀態，行為與以前完全相同。
 * 壞資料（`clock` 是字串、`choices` 是陣列）不拋錯、不開規則，只收斂成合法值。
 */
export const normalizeZeroPower = (raw) => {
  const base = createZeroPowerState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const choices = raw.choices && typeof raw.choices === 'object' && !Array.isArray(raw.choices)
    ? raw.choices
    : {};
  const pair = Array.isArray(choices.damagePair)
    ? choices.damagePair.filter((t) => ZERO_DAMAGE_TYPES.includes(t)).slice(0, 2)
    : [];
  const statuses = Array.isArray(choices.statuses)
    ? choices.statuses.filter((s) => ZERO_STATUS_EFFECTS.includes(s)).slice(0, 2)
    : [];
  const max = raw.variant === 'combined' ? ZERO_CLOCK_SECTIONS_COMBINED : ZERO_CLOCK_SECTIONS;
  const clock = Number.isFinite(Number(raw.clock))
    ? Math.min(max, Math.max(0, Math.trunc(Number(raw.clock))))
    : 0;
  const effectId = zeroEffectById(raw.effectId) ? raw.effectId : '';
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    triggerId: zeroTriggerById(raw.triggerId) ? raw.triggerId : '',
    effectId,
    loveTargetId: typeof raw.loveTargetId === 'string' ? raw.loveTargetId : '',
    choices: {
      damagePair: pair,
      damageType: ZERO_DAMAGE_TYPES.includes(choices.damageType) ? choices.damageType : '',
      statuses
    },
    clock,
    variant: ZERO_VARIANTS.some((v) => v.id === raw.variant) ? raw.variant : '',
    awakened: raw.awakened === true,
    combinedPairs: normalizeCombinedPairs(raw, effectId)
  };
};

/** 介面上的規則摘要（純中文，供開卡規則面板與速查使用）。 */
export const ZERO_POWER_NOTES = Object.freeze([
  '底力命刻有 6 個刻度：花費物語點、失去 HP、觸發條件發動時充能。',
  '命刻全滿時，在自己的回合執行技能動作施展底力效果，每回合只能施展一次。',
  '每次施展清空命刻；場景結束時也自動清空。',
  '除規則列舉的方式、或透過【零之機運】之外，命刻不得以任何方式填充或清空。',
  '同一團隊不得有兩名以上角色擁有相同的底力觸發，也不得有兩名以上擁有相同的效果。',
  '【合體之力】：命刻改為 4 格，每個「其他玩家角色」各共用一個效果（四人團＝6 個效果）；雙方命刻皆滿才能施展，施展後兩邊一起清空。此時效果允許重複，觸發仍應盡量不同。',
  '【覺醒之力】：建角時只選效果，不選觸發；覺醒時回復等同危機值的 HP 並當場選定觸發（衝突中覺醒則命刻立即填滿），每次戰役僅能覺醒一次。'
]);
