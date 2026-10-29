/**
 * 核心書技能變體（Core Book Variants）—— 官方公測文件 2026-10-01 版
 *
 * ## 這一層的鐵律（使用者裁定）
 *
 * 這些變體是**選用**的：只有勾選【官方公測修訂】時才出現，
 * **絕對不可以改到原版規則書的內容**。勾選後，變體要**與原版並存**，
 * 標上【公測】，並把**與原版不同的機制粗體化**讓使用者看見。
 *
 * 所以本檔**只新增、不覆寫**。原版的職業技能仍然在 `rulesData.json` 裡原封不動。
 *
 * ## 來源
 *
 * `Fabula Ultima Playtest Materials (ENG) (October 1st, 2026)` 的
 * `VARIANT RULES AND SKILLS` 段。使用者裁定該版為唯一基準，先前所有 Playtest 內容作廢。
 *
 * 每一筆的 `replaces` 指向原版技能（`rulesData.json` 的職業技能），
 * `origin` 記官方頁碼。譯文以官方英文為唯一來源。
 *
 * ## 粗體標記的判準
 *
 * `desc` 用 `**...**` 標出**與原版機制不同**的地方。判準是「機制有沒有變」，
 * 不是「文字有沒有變」——純措辭差異不標，否則整段都會是粗體，等於沒標。
 * 若整支技能被換掉（例如【暴怒】→【勇猛打手】），則標出**核心機制**那一句。
 */

/** 變體取代的原版技能、以及它屬於哪個職業。 */
export const CORE_BOOK_VARIANTS = Object.freeze([
  {
    id: 'spellBuffet',
    className: '嵌合師',
    replaces: '咒語模仿',
    name: '咒語自助餐',
    en: 'SPELL BUFFET',
    maxSL: 6,
    origin: 'Playtest 2026-10-01（嵌合師 p.183 的變體）',
    /** 選用此變體後**不可**取得的英雄技能（官方原文寫在效果文末）。 */
    excludesHeroicSkills: ['嵌合精通'],
    desc:
      '你隨時知道你看得見的非類人敵人中，哪些當前 HP 等於或低於【20＋你等級的一半】。\n'
      + '在衝突中，你可以使用一個動作選擇其中一個敵人：該敵人 HP 降至 0，且 GM 揭露牠知道的全部咒語。'
      + '然後，你可以**學會其中任意數量的咒語**成為你自己的嵌合師咒語；'
      + '若你這麼做，記錄你是從哪個物種的敵人身上學到的。\n'
      + '首次取得此技能時，選擇【INS＋WLP】或【MIG＋WLP】。'
      + '**此後你的攻擊性嵌合師咒語一律使用所選屬性進行魔法檢定**，'
      + '不論你當初是從哪個生物身上學到那些咒語。\n'
      + '你以此方式記憶的嵌合師咒語上限為**【SL＋4】**。若已達上限又想記新的，'
      + '必須遺忘一個舊咒語並以新咒語取代。\n'
      + '就英雄技能的要求而言，此技能的名稱視為「咒語模仿」。'
      + '**若你使用此變體，你不能取得【嵌合精通】英雄技能。**',
  },
  {
    id: 'braveBrawler',
    className: '狂怒鬥士',
    replaces: '暴怒',
    name: '勇猛打手',
    en: 'BRAVE BRAWLER',
    maxSL: 3,
    origin: 'Playtest 2026-10-01（狂怒鬥士 p.195 的變體）',
    desc:
      '你以**鬥毆、匕首、連枷、重型與投擲**武器進行的命中檢定獲得等同【SL】的加值。\n'
      + '你的**徒手打擊額外造成【4＋SL×2】傷害**，且**不能**受益於金手指或'
      + '【無拘形態】技能提供的額外傷害。\n'
      + '**若你達到 20 級或更高，你的徒手打擊再額外造成 5 點傷害，且其傷害無視抗性。**',
  },
  {
    id: 'meteorSlam',
    className: '狂怒鬥士',
    replaces: '暴怒',
    name: '隕石猛擊',
    en: 'METEOR SLAM',
    maxSL: 3,
    origin: 'Playtest 2026-10-01（狂怒鬥士 p.195 的變體）',
    desc:
      '你可以使用一個動作並花費 5 點 MP，以你裝備的一把武器進行一次**自由攻擊**。\n'
      + '該攻擊的命中檢定獲得等同【SL】的加值；若你使用的是**鬥毆、匕首、連枷或投擲**武器，'
      + '它額外造成【SL×2】傷害。\n'
      + '**所有因此攻擊而失去 HP 的敵人，直到牠們下個回合結束前，不能進行自由攻擊、也不能執行防禦動作。**',
  },
  {
    id: 'agileDefender',
    className: '守護者',
    replaces: '保鏢',
    name: '靈巧防禦者',
    en: 'AGILE DEFENDER',
    maxSL: 4,
    origin: 'Playtest 2026-10-01（守護者 p.197 的變體）',
    desc:
      '在衝突場景中，**只要你沒有裝備職業防具與盾牌**，你獲得以下好處：\n'
      + '· 當一次攻擊或攻擊性咒語（O）**未命中你**時，若你自上次回合結束以來**恰好使用過一次**'
      + '【保護】技能，你恢復它的使用次數。\n'
      + '· 當你使用【保護】技能時，你的物防與魔防獲得等同【SL＋1】的加值，直到本回合結束。',
  },
  {
    id: 'secondSlicer',
    className: '熵師',
    replaces: '竊取時間',
    name: '二度斬擊',
    en: 'SECOND SLICER',
    maxSL: 4,
    origin: 'Playtest 2026-10-01（熵師【竊取時間】的變體）',
    desc:
      '你可以使用一個動作並花費 10 點 MP，以你裝備的一把武器進行一次**自由攻擊**；'
      + '該攻擊**必須以單一敵人為目標**，命中檢定獲得等同【SL】的加值。\n'
      + '**命中時，目標陷入緩慢**；且若目標原本就已處於緩慢，**或你使用匕首進行此攻擊**，'
      + '你可以選擇至多兩個選項：該攻擊額外造成【SL＋1】傷害；或目標失去【SL×10】點 MP；'
      + '或一個你能看見的生物從緩慢中恢復；或一個你能看見、且本輪尚未行動的盟友'
      + '可以在你之後立即行動。\n'
      + '就英雄技能的要求而言，此技能的名稱視為「竊取時間」。',
  },
  {
    id: 'magitechArmament',
    className: '修補匠',
    replaces: '小工具',
    name: '魔導武裝',
    en: 'MAGITECH ARMAMENT',
    maxSL: 5,
    origin: 'Playtest 2026-10-01（修補匠的魔導科技分支之一）',
    excludesHeroicSkills: ['量子魔加農'],
    desc:
      '**基礎武裝**：你可以執行**庫存動作並花費 2 點庫存點**，創造一件魔導武裝'
      + '（並摧毀你先前創造的魔導武裝）。創造時選擇一個類別、選擇近戰或遠程，'
      + '並在【DEX＋INS】＋1 與【INS＋MIG】＋1 之間選擇一個命中公式。'
      + '魔導武裝一律是**雙手**武器，傷害為【HR＋12】物理，**不能擁有任何特性**。\n'
      + '**高級武裝**：當你創造魔導武裝時，若你的兩個手部欄位皆為空，'
      + '你可以立即裝備它並以它進行一次自由攻擊。此外，創造時可以選擇風、電、土、火或冰，'
      + '讓它改為造成該屬性傷害。\n'
      + '**最高武裝**：只要你的魔導武裝處於裝備狀態，你可以執行**技能動作**'
      + '選擇背包裡的一把武器進行**昇華**。被昇華的武器消失，'
      + '先前被昇華的武器（若有）重新出現在背包裡。你的魔導武裝永遠擁有'
      + '最後一次昇華武器的特性，並額外造成等同你【小工具】技能等級的傷害。\n'
      + '**若你使用此變體，你不能取得【量子魔加農】英雄技能。**',
  },
  {
    id: 'magispheres',
    className: '修補匠',
    replaces: '小工具',
    name: '魔法球',
    en: 'MAGISPHERES',
    maxSL: 5,
    origin: 'Playtest 2026-10-01（修補匠的魔導科技分支之一）',
    desc:
      '**基礎魔法球**：從元素、熵系與靈魂學派的咒語表中，選擇**兩個目標為「至多三個生物」**的咒語，'
      + '為它們各開發一顆魔法球（**這不算「學習」或「知曉」這些咒語**）。'
      + '你可以執行**庫存動作並花費 2 點庫存點**，免費執行咒語動作施展其中一顆；'
      + '該咒語遵循正常規則（含 MP 消耗與魔法檢定），而**透過魔法球施展的魔法檢定一律為【INS＋WLP】**。\n'
      + '**高級魔法球**：從 **NPC 咒語表**再選兩個不同的咒語（**不可選【毀盪】**），各開發一顆魔法球，'
      + '並在需要時**自訂化**它們。此外，**你透過魔法球施展的攻擊性咒語（O）魔法檢定獲得 +2 加值**。\n'
      + '**最高魔法球**：從三學派與／或 NPC 咒語表**再選兩個**（同樣**不可選【毀盪】**），各開發一顆魔法球。\n'
      + '此分支與【魔導武裝】**互斥**（同一個技能只能選一條分支）；'
      + '選用此分支**沒有**【量子魔加農】的限制（該限制只屬於魔導武裝）。',
  },
  {
    id: 'theriomorphosisVariant',
    className: '突變體',
    replaces: '混合變形',
    name: '混合變形（變體）',
    en: 'THERIOMORPHOSIS (variant)',
    maxSL: 6,
    origin: 'Playtest 2026-10-01（科技奇幻手冊 p.155 的變體）',
    desc:
      '每次取得此技能時，你學會一個突變型態。\n'
      + '**你可以使用一個動作並花費 20 點 HP**，顯現你已學會的**至多兩個**突變型態的效果'
      + '（原版是消耗當前 HP 的三分之一）。\n'
      + '然後，若你不是透過【基因分析】執行此技能，**你可以以你裝備的一把武器進行一次自由攻擊。'
      + '若你這麼做，在決定該攻擊造成的傷害時，將你的高擲視為 0。**\n'
      + '**若你使用此變體，【進階混合變形】的文本改為：**在衝突場景中，當你在你的回合內使用'
      + '混合變形技能後，若這不是透過【基因分析】技能觸發，你可以顯性表達出**三個**'
      + '你已習得的混合形態（而非原來的兩個）。'
      + '**（變體版本不提供追加動作。）**',
  },
]);

/** 依原版技能名反查變體（一個原版技能可能有多個變體，例如【暴怒】有兩個）。 */
export const getVariantsForSkill = (skillName) =>
  CORE_BOOK_VARIANTS.filter((v) => v.replaces === skillName);

/** 依職業反查變體。 */
export const getVariantsForClass = (className) =>
  CORE_BOOK_VARIANTS.filter((v) => v.className === className);

/** 依 id 反查單一變體（選用狀態存的是 id）。 */
export const getVariantById = (variantId) =>
  CORE_BOOK_VARIANTS.find((v) => v.id === variantId) || null;

/* ──────────────────────────────────────────────────────────────────────────
 * 選用狀態的資料模型（GM 裁定 2026-10-14）
 *
 * ## 官方規則（Playtest 2026-10-01, PDF p.34 原文）
 *
 *   「Variant rules must be equally adopted by the entire group.
 *     Variant Skills, on the other hand, are **a choice each Player may make
 *     individually**.」
 *
 * → **職業技能變體是玩家各自選的**，不是 GM 開關。所以狀態存在**角色身上**，
 *   欄位是 `classes[].skills[].variantId`。
 *
 * ## 為什麼保留原版技能名（最關鍵的一個設計決定）
 *
 * 選用變體後，`skills[]` 的 `name` **仍然寫原版技能名**（例如「咒語模仿」），
 * 只多一個 `variantId: 'spellBuffet'`。
 *
 * 理由：【小工具】在專案裡有 20 處硬編查詢、【咒語模仿】7 處、【混合變形】5 處
 * （修補匠工坊、嵌合師管理器、載具表、跑團面板…）。若把 `name` 改成變體名，
 * **所有 `skills.find(s => s.name === '小工具')` 會當場找不到而靜默失效**。
 *
 * 而官方本身也支持這個模型——變體自己的效果文就寫著：
 *   「就英雄技能的要求而言，此技能的名稱視為『咒語模仿』。」
 * 變體就是「同一個技能的另一種版本」，不是新技能。
 *
 * → 所以：**`name` 是識別字（不變），`variantId` 是顯示與說明層（可變）。**
 *   這讓全部既有讀取端（引擎、子系統、匯出）**一行都不用改**。
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 這個技能條目選用了哪個變體（沒選回 null）。
 * 舊存檔沒有這個欄位 → 回 null，行為與以往完全相同。
 */
export const getSkillVariant = (skill) => getVariantById(skill?.variantId);

/**
 * 選用／取消選用某個變體，回傳**新的**技能條目（不改原物件）。
 *
 * @param {object} skill 既有技能條目 `{ name, sl, selectedOptions }`
 * @param {string|null} variantId 變體 id；傳 null 表示取消選用、回到原版
 * @param {object} [opts]
 * @param {number} [opts.maxSL] 原版技能的 SL 上限——切換變體時用來重新夾住 sl
 * @returns {object} 新的技能條目
 *
 * 兩個要處理的邊界：
 *  1. **SL 上限可能不同**（【咒語模仿】上限 5、【咒語自助餐】上限 6；
 *     【暴怒】上限 5、【勇猛打手】上限 3）。切換時要重新夾住，否則會出現
 *     超出上限的 SL。取消選用時也一樣要夾回原版的上限。
 *  2. **取消選用**要真的把 `variantId` 拿掉，不是設成 null——
 *     這樣存檔形狀與舊版一致。
 */
export const withSkillVariant = (skill, variantId, { maxSL } = {}) => {
  const next = { ...skill };
  if (variantId) {
    next.variantId = variantId;
  } else {
    delete next.variantId;
  }

  const variant = getVariantById(variantId);
  const cap = variant ? variant.maxSL : maxSL;
  if (Number.isFinite(cap) && Number.isFinite(next.sl)) {
    next.sl = Math.min(cap, next.sl);
  }
  return next;
};

/**
 * 組出一筆要寫進 `skills[]` 的條目。
 *
 * ## 這支函式為什麼存在（它是被一個**沒抓到的 bug** 逼出來的）
 *
 * 儲存技能配置時是**重建**整個 `skills[]`（只留 SL >= 1 的），不是在原物件上改。
 * 所以「把 `variantId` 一起帶過去」這一步必須手寫，而**漏寫不會有任何錯誤訊息**——
 * 玩家選了變體、按了儲存，選用狀態就無聲消失。
 *
 * 這個 bug 用 SSR 測試**抓不到**（`handleSave` 只在 onClick 裡，SSR 不跑事件）。
 * 所以把這段邏輯抽成純函式，讓它可以被直接呼叫、直接斷言。
 *
 * @param {string} name           原版技能名（**識別字**，永遠不改）
 * @param {number} sl            要寫入的等級
 * @param {object} opts
 * @param {string|null} opts.variantId  選用的變體（null＝用原版）
 * @param {number} opts.originalMaxSL   原版技能上限（沒選變體時用它夾）
 * @param {string[]} opts.selectedOptions 子項目
 * @returns {{name:string, sl:number, selectedOptions:string[], variantId?:string}}
 */
export const buildSkillEntry = (name, sl, { variantId = null, originalMaxSL, selectedOptions = [] } = {}) => {
  const variant = getVariantById(variantId);
  const cap = variant ? (variant.maxSL || originalMaxSL || 5) : (originalMaxSL || 5);
  const entry = {
    name,
    sl: Math.min(cap, sl),
    selectedOptions: selectedOptions || []
  };
  if (variantId) entry.variantId = variantId;
  return entry;
};

/**
 * 這個技能「實際顯示」的內容——原版或變體。
 *
 * 顯示端（角色卡、跑團面板、三頁匯出、編輯器）一律走這裡取
 * `{ name, en, desc, maxSL, isVariant, variant }`，不要自己去 `find` 原版定義，
 * 否則選了變體卻顯示原版的說明。
 *
 * @param {object} skill 技能條目
 * @param {object} fallbackDef 原版技能定義（`rulesData.classes[c].skills[]` 的那一筆）
 */
export const resolveSkillDisplay = (skill, fallbackDef) => {
  const variant = getSkillVariant(skill);
  if (variant) {
    return {
      className: variant.className,
      name: variant.name,
      en: variant.en,
      desc: variant.desc,
      maxSL: variant.maxSL,
      isVariant: true,
      variant,
      /** 這個變體取代掉的原版技能名——顯示端可用來寫「取代【咒語模仿】」。 */
      replaces: variant.replaces,
    };
  }
  return {
    name: fallbackDef?.name ?? skill?.name ?? '',
    en: fallbackDef?.en,
    desc: fallbackDef?.desc ?? '',
    maxSL: fallbackDef?.maxSL ?? 5,
    isVariant: false,
    variant: null,
    replaces: null,
  };
};

/**
 * 從「這個角色已選的技能」收集出**被選用的變體**清單。
 * 用來檢查變體自帶的互斥條款（例如選了【咒語自助餐】就不能取【嵌合精通】）。
 *
 * @param {object} character
 * @returns {Array<{variant: object, className: string}>}
 */
export const getAdoptedVariants = (character) => {
  const out = [];
  for (const cls of character?.classes || []) {
    for (const sk of cls?.skills || []) {
      const v = getSkillVariant(sk);
      if (v) out.push({ variant: v, className: cls.className });
    }
  }
  return out;
};

/**
 * 檢查「變體 ↔ 英雄技能」的互斥條款。
 *
 * 三筆變體的效果文各自寫了一條「若你使用此變體，你不能取得【某某】英雄技能」：
 *   - 【咒語自助餐】→ 不可取【嵌合精通】
 *   - 【魔導武裝】  → 不可取【量子魔加農】
 * （其餘變體無此條款，所以 `excludesHeroicSkills` 不存在。）
 *
 * 這個檢查以前**完全不存在**——那些條款只是 desc 裡的自由文字。
 *
 * @returns {Array<{variantName: string, heroicSkill: string, message: string}>}
 */
export const findVariantHeroicSkillConflicts = (character) => {
  const adopted = getAdoptedVariants(character);
  if (adopted.length === 0) return [];

  const owned = (character?.heroicSkills || []).map((h) =>
    typeof h === 'string' ? h : h?.name
  ).filter(Boolean);

  const conflicts = [];
  for (const { variant } of adopted) {
    for (const blocked of variant.excludesHeroicSkills || []) {
      if (owned.includes(blocked)) {
        conflicts.push({
          variantName: variant.name,
          heroicSkill: blocked,
          message: `【${variant.name}】與英雄技能【${blocked}】不能並存——使用此變體就不能取得該英雄技能。`,
        });
      }
    }
  }
  return conflicts;
};
