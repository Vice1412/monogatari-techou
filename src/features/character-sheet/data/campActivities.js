/**
 * 營地活動（CAMP ACTIVITIES）——《自然奇幻手冊》第三章選用規則，印刷 p.130–133
 * （PDF p.132–135，此書頁碼偏移 +2）。
 *
 * ## 出處與權威
 *
 * 官方英文原書 *Fabula Ultima — Atlas: Natural Fantasy*。
 * **中文譯名**取自繁中版角色卡 V2.17（`附加表`，15 筆：營地打造／地圖測繪／戰鬥課程／
 * 白日夢／雙倍分量／探索／採集／魔法課程／武術練習／按摩／抱佛腳／鼓舞士氣／提前規劃／
 * 酣睡／自行訓練）——那一份只有名字與目標，沒有規則文，所以規則文一律照英文原書寫。
 *
 * ## 為什麼是獨立模組
 *
 * 它與金手指、定制武器那種「多一批選項」不同，是**開卡流程多一個必選欄位**：
 * 原書 p.130「each Player Character gains access to two different Camp Activities,
 * chosen during character creation」。少了這個欄位，玩家照著官方規則開卡會少一半的
 * 休息場景選項，而畫面上完全看不出來——這正是要把它做成模組的理由
 * （同 `zeroPowers.js` 檔頭）。
 *
 * ## CHM 漢化（測試版）與正式版的五處落差
 *
 * 逐條核對 `resources/角色卡/03_Natural_Fantasy_自然奇幻/CHM_Playtest_中文翻译/
 * 06_可选规则_营地活动Camp_Activities.md`，本檔**一律照正式版**：
 *
 * ① 探索 1：「你這次休息不能恢復 HP 和 MP」→ 正式版是「**恢復一半**」（Ouch! You recover
 *    half the normal amount of HP and MP during this rest）。
 * ② 探索 2：CHM 寫「恢復 1 點 IP」→ 正式版是 **2 點**（regains 2 Inventory Points）。
 * ③ 探索 6：CHM 只寫「獲得等級 ×50 的 zenit 等價物」→ 正式版還有**額外 3 點 IP**。
 * ④ 抱佛腳：CHM 寫「**2** 個進度」→ 正式版是 **3 點**（generate 3 points of progress）。
 * ⑤ 採集 6／提前規劃：CHM 寫「3 種自定口味」「作為領隊進行一次**先攻**檢定」→
 *    正式版是「3 份食材，味道**各自**任選」與「作為領袖進行**團體檢定**（Group Check）」。
 *
 * ## 團隊約束不進程式
 *
 * 原書 p.130「Make sure to avoid redundant Camp Activities within the same group」是
 * **桌上約定**，與底力技的「不得重複」同一類。使用者裁定（2026-10-21）團隊級約束交給
 * GM 審卡，不是開卡時的硬性規定——所以這裡不讀隊友、不灰選項。
 */

import rulesData from './rulesData.json';

/** `creationRules` 上的欄位名（整團一層的開關）。 */
export const CAMP_ACTIVITY_FIELD = 'campActivities';

/** 出處（介面與測試共用，避免各處自己打字）。 */
export const CAMP_ACTIVITY_SOURCE = '自然奇幻手冊 p.130–133';

/** 每個角色可選的活動數（原書 p.130：two different Camp Activities）。 */
export const CAMP_ACTIVITY_BASE_COUNT = 2;

/**
 * 金手指【老大哥／歐尼醬】額外給的一種活動（見 `rulesData.quirks[].campActivityCount`）。
 * 該金手指同時允許「團隊沒開這條規則時，角色仍然可以使用它」。
 */
export const CAMP_ACTIVITY_QUIRK_BONUS = 1;

/** 活動的目標類型（顯示用；`selfOrAlly` 與 `gourmet` 是原書的特例）。 */
export const CAMP_ACTIVITY_TARGETS = Object.freeze({
  self: '自身',
  ally: '一個盟友',
  selfOrAlly: '你或一個盟友',
  gourmet: '擁有美食家職業的角色'
});

/**
 * 15 種營地活動（原書 p.131–133，順序照原書）。
 *
 * `desc` 是規則文（`\n` 分段）；`table` 是 1d6 表格（探索／採集才有）。
 * `once` 代表「直到下一次休息前限一次」——跑團面板用它決定要不要顯示「已使用」開關。
 */
export const CAMP_ACTIVITIES = Object.freeze([
  {
    id: 'campForge',
    name: '營地打造',
    en: 'Camp Forge',
    page: 'p.131',
    target: 'self',
    once: true,
    summary: '修復、免費打造基礎裝備，或拆解成材料',
    desc: '選擇一個選項：修復團隊擁有的一件受損物品；或免費製作一件你選擇的基礎武器、防具或盾牌（見《核心規則》p.130–133）；或摧毀團隊擁有的一件裝備，換得一塊價值等於該裝備價格的材料（材料見《核心規則》p.74）。'
  },
  {
    id: 'cartography',
    name: '地圖測繪',
    en: 'Cartography',
    page: 'p.131',
    target: 'self',
    once: true,
    summary: '旅行移動骰可以重骰一次',
    desc: '直到下一次休息前限一次：在團隊進行旅行移動骰之後，你可以重骰並採用新的結果。'
  },
  {
    id: 'combatLesson',
    name: '戰鬥課程',
    en: 'Combat Lesson',
    page: 'p.131',
    target: 'ally',
    once: true,
    summary: '攻擊或攻擊性咒語的檢定 +4',
    desc: '直到下一次休息前限一次：目標在為攻擊或攻擊性咒語進行命中檢定或魔法檢定之後，可以在該次檢定結果上加 +4。'
  },
  {
    id: 'daydream',
    name: '白日夢',
    en: 'Daydream',
    page: 'p.132',
    target: 'self',
    once: true,
    summary: '一次 HP 損失減半',
    desc: '直到下一次休息前限一次：當你因任何原因失去 HP 時，可以選擇將該次 HP 損失減半。'
  },
  {
    id: 'doublePortion',
    name: '雙倍分量',
    en: 'Double Portion',
    page: 'p.132',
    target: 'ally',
    once: true,
    summary: '一次 HP 恢復加倍',
    desc: '直到下一次休息前限一次：當目標即將恢復 HP 時，可以將該次恢復的 HP 加倍。'
  },
  {
    id: 'exploration',
    name: '探索',
    en: 'Exploration',
    page: 'p.132',
    target: 'selfOrAlly',
    once: false,
    summary: '骰 1d6 找有用的東西',
    desc: '你花時間尋找有用的東西；描述你怎麼找，然後骰 1d6。',
    table: Object.freeze([
      { roll: '1', text: '哎呀！這次休息你只恢復正常一半的 HP 與 MP。' },
      { roll: '2', text: '不是我要找的東西……目標回復 2 點庫存點。' },
      { roll: '3–5', text: '哦，這能派上用場！目標回復 3 點庫存點。' },
      { roll: '6', text: '中大獎！目標回復 3 點庫存點，你另外找到價值等於（角色等級 × 50）z 的資金。' }
    ])
  },
  {
    id: 'gathering',
    name: '採集',
    en: 'Gathering',
    page: 'p.132',
    target: 'gourmet',
    once: false,
    summary: '骰 1d6 找食材（美食家）',
    desc: '你在附近尋找食材；描述你怎麼找，然後骰 1d6。',
    table: Object.freeze([
      { roll: '1', text: '救、救命！這次休息結束時，整團會捲入一場與團隊等級同級威脅的簡單衝突。' },
      { roll: '2', text: '這些沒問題吧……目標獲得 2 份味道隨機的食材。' },
      { roll: '3–5', text: '看起來很好吃！目標獲得 3 份味道隨機的食材。' },
      { roll: '6', text: '就是這些！目標獲得 3 份食材，味道各自任選。' }
    ])
  },
  {
    id: 'magicLesson',
    name: '魔法課程',
    en: 'Magic Lesson',
    page: 'p.132',
    target: 'ally',
    once: true,
    summary: '盟友可施展你指定的咒語一次',
    desc: '從你習得的咒語中選擇一個。直到下一次休息前限一次：目標可以使用咒語動作施展你選擇的那個咒語（仍須支付 MP，需要時也照常進行魔法檢定）。'
  },
  {
    id: 'martialPractice',
    name: '武術練習',
    en: 'Martial Practice',
    page: 'p.132',
    target: 'self',
    once: true,
    summary: '一次攻擊獲得多重（2）或 +1 多重',
    desc: '直到下一次休息前限一次：當你進行攻擊時，可以讓該次攻擊獲得多重（2），或將其多重屬性提高 1 點。'
  },
  {
    id: 'massage',
    name: '按摩',
    en: 'Massage',
    page: 'p.133',
    target: 'ally',
    once: true,
    summary: '一次 MP 成本減半（不含儀式）',
    desc: '直到下一次休息前限一次：當目標即將支付 MP 成本時，可以將該次 MP 成本減半。此效果不能用在儀式的 MP 成本上。'
  },
  {
    id: 'midnightOil',
    name: '抱佛腳',
    en: 'Midnight Oil',
    page: 'p.133',
    target: 'self',
    once: false,
    summary: '一個造物專案 +3 進度',
    desc: '你為自己所選的一個造物專案產生 3 點進度。'
  },
  {
    id: 'pepTalk',
    name: '鼓舞士氣',
    en: 'Pep Talk',
    page: 'p.133',
    target: 'ally',
    once: true,
    summary: '一次 MP 恢復加倍',
    desc: '直到下一次休息前限一次：當目標即將恢復 MP 時，可以將該次恢復的 MP 加倍。'
  },
  {
    id: 'planning',
    name: '提前規劃',
    en: 'Planning',
    page: 'p.133',
    target: 'ally',
    once: true,
    summary: '團體檢定或調查檢定 +4',
    desc: '直到下一次休息前限一次：目標以領袖身分進行團體檢定，或進行調查某人、某物的檢定之後，可以在該次檢定結果上加 +4。'
  },
  {
    id: 'sleepSoundly',
    name: '酣睡',
    en: 'Sleep Soundly',
    page: 'p.133',
    target: 'self',
    once: true,
    summary: '衝突中多一個裝備／阻礙／庫存行動',
    desc: '直到下一次休息前限一次：在衝突場景中，你可以在自己的回合多進行一個行動。該行動必須用於裝備、阻礙或庫存行動。'
  },
  {
    id: 'training',
    name: '自行訓練',
    en: 'Training',
    page: 'p.133',
    target: 'self',
    once: true,
    summary: '一次免疫同一來源的狀態效果',
    desc: '直到下一次休息前限一次：當你即將因同一個來源受到一種或多種狀態效果時，可以選擇完全不受這些狀態效果影響。'
  }
]);

/** 活動 id 清單（正規化與測試共用）。 */
export const CAMP_ACTIVITY_IDS = Object.freeze(CAMP_ACTIVITIES.map((a) => a.id));

/** 依 id 取活動（找不到回 `null`）。 */
export const campActivityById = (id) => CAMP_ACTIVITIES.find((a) => a.id === id) || null;

/** 依 id 取中文名（找不到就回空字串，避免介面出現 `undefined`）。 */
export const campActivityName = (id) => campActivityById(id)?.name || '';

/** 目標的中文標籤。 */
export const campActivityTargetLabel = (activity) =>
  CAMP_ACTIVITY_TARGETS[activity?.target] || CAMP_ACTIVITY_TARGETS.self;

/**
 * 這條規則是否開啟（**單一判定入口**，與 `isZeroPowersEnabled` 同一個形狀）。
 *
 * 接受角色物件（讀 `character.creationRules`）或規則物件本身。
 * 只認真正的布林 `true`：存檔裡出現字串 `'true'` 不算——壞資料不該默默打開一整套規則。
 */
export const isCampActivitiesEnabled = (characterOrRules) => {
  if (!characterOrRules || typeof characterOrRules !== 'object') return false;
  const rules = characterOrRules.creationRules && typeof characterOrRules.creationRules === 'object'
    ? characterOrRules.creationRules
    : characterOrRules;
  return rules[CAMP_ACTIVITY_FIELD] === true;
};

/**
 * 金手指【老大哥／歐尼醬】給的活動數（沒有就是 0）。
 *
 * 資料層寫在 `rulesData.quirks[].campActivityCount`，不在程式裡比對名字：
 * §CG 的教訓是「會改角色卡數字的金手指效果要有欄位放，而且要有東西讀那個欄位」。
 * 名字比對只當退路（金手指名稱可能被舊存檔寫成簡寫）。
 */
export const quirkCampActivityCount = (character) => {
  const raw = typeof character?.quirk === 'string' ? character.quirk.trim() : '';
  if (!raw || raw === '無') return 0;
  const quirks = Array.isArray(rulesData.quirks) ? rulesData.quirks : [];
  const def = quirks.find((q) => q.name === raw)
    || quirks.find((q) => q.name.includes(raw) || raw.includes(q.name));
  const n = Number(def?.campActivityCount);
  return Number.isFinite(n) && n > CAMP_ACTIVITY_BASE_COUNT ? Math.trunc(n) : 0;
};

/**
 * 這個角色可以選幾種活動。
 *
 * 原書是 2；金手指【老大哥／歐尼醬】是 3（該金手指的原文：「你的角色可以選擇 3 種不同的
 * 營地活動，而不像通常只能選擇 2 種」——團隊已使用本規則時則是「再額外選擇一種」，
 * 兩句話的結果都是 3）。
 */
export const campActivityAllowance = (character) =>
  Math.max(CAMP_ACTIVITY_BASE_COUNT, quirkCampActivityCount(character));

/**
 * 這個角色能不能用營地活動，以及可以用幾種。
 *
 * 三個值都要給呼叫端，因為「能不能用」與「是誰開的」在介面上要說清楚：
 * 規則沒開但金手指有給 → 仍然可用，而且要在區塊上註明是金手指給的
 * （否則玩家會以為 GM 開了規則）。
 */
export const campActivityAccess = (character, rules = null) => {
  const ruleOn = rules ? isCampActivitiesEnabled(rules) : isCampActivitiesEnabled(character);
  const allowance = campActivityAllowance(character);
  const quirkGrant = allowance > CAMP_ACTIVITY_BASE_COUNT;
  return {
    enabled: ruleOn || quirkGrant,
    ruleOn,
    quirkGrant,
    allowance
  };
};

/**
 * 新角色的營地活動資料。
 *
 * **空的就是空的**：建角時不替玩家挑活動（與屬性骰、羈絆、金手指、底力技同一個原則）。
 * `used` 是「直到下一次休息前限一次」的追蹤欄位——跑團面板會寫它，休息時清空。
 */
export const createCampActivityState = () => ({
  /** 建角時選定的活動 id（順序＝玩家選擇的順序） */
  picked: [],
  /** 本次休息已使用過的活動 id（`once` 為真的活動才會有） */
  used: []
});

/**
 * 正規化營地活動資料（舊存檔沒有這個欄位 → 空狀態）。
 *
 * 收斂規則：只留認得的 id、去重、`used` 必須是 `picked` 的子集。
 * **不依上限截斷**——上限是規則，資料是玩家的選擇；規則改動不該默默刪掉他的東西
 * （超出的部分由驗證回報，讓 GM 與玩家自己處理）。
 * 陣列形式（早期手寫存檔）視為 `picked`。
 */
export const normalizeCampActivities = (raw) => {
  const toIds = (value) => (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .filter((id) => typeof id === 'string' && CAMP_ACTIVITY_IDS.includes(id));
  const source = Array.isArray(raw) ? { picked: raw, used: [] } : (raw || {});
  const picked = [...new Set(toIds(source.picked))];
  const used = [...new Set(toIds(source.used))].filter((id) => picked.includes(id));
  return { picked, used };
};

/**
 * 切換一個活動（純函式，SSR 測得到）。
 *
 * 已達上限時**原樣回傳**：呼叫端用「回傳物件與傳入物件相同」判斷要不要提示
 * （`docs/decisions.md` §AW6(b)：`onClick` 裡的邏輯 SSR 測不到，所以抽到資料層）。
 */
export const toggleCampActivity = (state, id, allowance = CAMP_ACTIVITY_BASE_COUNT) => {
  const current = normalizeCampActivities(state);
  if (!campActivityById(id)) return current;
  if (current.picked.includes(id)) {
    return {
      picked: current.picked.filter((x) => x !== id),
      used: current.used.filter((x) => x !== id)
    };
  }
  if (current.picked.length >= allowance) return current;
  return { ...current, picked: [...current.picked, id] };
};

/** 標記／取消標記「本次休息已使用」（只有選定的活動能標）。 */
export const setCampActivityUsed = (state, id, used) => {
  const current = normalizeCampActivities(state);
  if (!current.picked.includes(id)) return current;
  const next = used
    ? [...new Set([...current.used, id])]
    : current.used.filter((x) => x !== id);
  return { ...current, used: next };
};

/** 下一次休息：清空所有「已使用」標記（原書 p.131 的效益都在休息時回充）。 */
export const resetCampActivityUses = (state) => ({
  ...normalizeCampActivities(state),
  used: []
});

/**
 * 建角驗證（第 5 步）——只回報「還缺什麼／超過上限」，不擋存檔。
 *
 * 與 `zeroPowerIssues` 同一個形狀：`{ field, type, message }`。
 * 規則關閉時呼叫端**不要呼叫**這個函式（見 `characterEngine.validateCharacter`），
 * 否則舊角色身上的殘留資料會在關閉後變成警告。
 */
export const campActivityIssues = (state, { allowance = CAMP_ACTIVITY_BASE_COUNT } = {}) => {
  const s = normalizeCampActivities(state);
  const issues = [];
  if (s.picked.length < allowance) {
    issues.push({
      field: 'campActivities',
      type: 'warning',
      message: `營地活動尚未選滿（已選 ${s.picked.length}／${allowance} 種）`
    });
  }
  if (s.picked.length > allowance) {
    issues.push({
      field: 'campActivities',
      type: 'warning',
      message: `營地活動選了 ${s.picked.length} 種，超過上限 ${allowance} 種`
    });
  }
  return issues;
};
