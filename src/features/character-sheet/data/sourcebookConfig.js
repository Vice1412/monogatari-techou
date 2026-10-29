/**
 * Fabula Ultima Sourcebook & Expansion Configuration
 * 官方手冊與拓展分類定義
 */

/**
 * 變體職業的唯一識別名。
 *
 * 2026-10-19 起官方只留一個職業級變體：Playtest Materials ENG 2026-10-01 p.24
 * 「ARCANIST (variant)」。中文名從舊的「秘儀師【Playtest】」改為「秘儀師【變體】」——
 * 【…】是「限定標記」而非書名，`【Playtest】` 會被誤讀成「這本手冊裡的版本」，
 * 而它其實是**同一個職業的另一版規則**（見 `docs/decisions.md` §BF）。
 *
 * 這個字串同時是 `rulesData.classes` 的鍵、`CLASS_METADATA` 的鍵、
 * 以及判斷「這個角色用的是變體規則嗎」的唯一依據，所以只准從這裡取。
 */
export const VARIANT_ARCANIST_CLASS_NAME = '秘儀師【變體】';

/**
 * 舊職業名 → 現名。
 *
 * 只處理「同一個職業換了名字」，**不做任何語意轉換**：
 * `秘儀師【Playtest】` 與 `秘儀師【變體】` 是同一份官方變體
 * （Playtest Materials ENG 2026-10-01 p.24），只是中文標記換了。
 *
 * 為什麼需要它：職業名同時是 `rulesData.classes` 的鍵。名字一改，舊存檔的
 * `char.classes[].className` 就查不到職業資料——技能、免費增益、衍生數值會
 * **安靜地歸零**（`classDef` 有 `|| {}` 保護，所以不會當掉，只會默默算錯）。
 * 讀名冊時就地正名，寫回時自然升級，全程不刪任何資料。
 */
const LEGACY_CLASS_RENAMES = Object.freeze({
  '秘儀師【Playtest】': VARIANT_ARCANIST_CLASS_NAME,
  '守護者【Playtest】': '守護者',
  '武器大師【Playtest】': '武器大師',
  '博學士【Playtest】': '博學士',
  '暗黑之刃【Playtest】': '暗黑之刃',
  '神射手【Playtest】': '神射手',
  '吟唱者【Playtest】': '吟唱者'
});

/**
 * 舊職業技能名 → 現行名稱（歷次正名對照）。
 */
export const LEGACY_SKILL_RENAMES = Object.freeze({
  '護衛': '保鏢',
  '盾反': '保鏢',
  '熵係魔法': '熵系魔法',
  '待會再見': '後會有期',
  '高速': '迅捷',
  '魔力套牌': '魔法卡組'
});

/**
 * 舊英雄技能名 → 現行名稱（簡繁字形與譯名校準）。
 */
export const LEGACY_HEROIC_SKILL_RENAMES = Object.freeze({
  '潔净月光': '潔淨月光'
});

/**
 * 舊裝備名 → 現行名稱（對照官方核心規則書裝備表正名）。
 */
export const LEGACY_EQUIPMENT_RENAMES = Object.freeze({
  '無手空拳': '徒手打擊',
  '闊劍': '巨劍',
  '長槍': '輕長矛',
  '重型塔盾': '符文圓盾'
});

const TRAILING_EN_PAREN_RE = /\s*\([A-Za-z][^()]*\)\s*$/;
const LEGACY_SPELL_SENTINEL_RE = /\s*\u26A1\s*$/;
const LEGACY_QUIRK_SUFFIX_RE = /\s*[（(](?:高奇|自奇|科奇)[）)]\s*$/;

/**
 * 把職業名正名為現行名稱；不是舊名就原樣回傳。
 * @param {string} className
 * @returns {string}
 */
export const normalizeClassName = (className) => (
  typeof className === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_CLASS_RENAMES, className)
    ? LEGACY_CLASS_RENAMES[className]
    : className
);

/**
 * 把職業技能名正名為現行名稱；不是舊名就原樣回傳。
 * @param {string} skillName
 * @returns {string}
 */
export const normalizeSkillName = (skillName) => (
  typeof skillName === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_SKILL_RENAMES, skillName)
    ? LEGACY_SKILL_RENAMES[skillName]
    : skillName
);

/**
 * 把英雄技能名正名為現行名稱；不是舊名就原樣回傳。
 * @param {string} name
 * @returns {string}
 */
export const normalizeHeroicSkillName = (name) => (
  typeof name === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_HEROIC_SKILL_RENAMES, name)
    ? LEGACY_HEROIC_SKILL_RENAMES[name]
    : name
);

/**
 * 把裝備名正名為現行名稱（剝除尾端英文括號並映射舊譯名）。
 * @param {string} name
 * @returns {string}
 */
export const normalizeEquipmentName = (name) => {
  if (typeof name !== 'string' || !name) return name;
  const stripped = name.replace(TRAILING_EN_PAREN_RE, '').trim();
  return Object.prototype.hasOwnProperty.call(LEGACY_EQUIPMENT_RENAMES, stripped)
    ? LEGACY_EQUIPMENT_RENAMES[stripped]
    : stripped;
};

/**
 * 把咒語名正名為現行名稱（剝除舊版尾端 U+26A1 哨兵字元）。
 * @param {string} name
 * @returns {string}
 */
export const normalizeSpellName = (name) => (
  typeof name === 'string' && LEGACY_SPELL_SENTINEL_RE.test(name)
    ? name.replace(LEGACY_SPELL_SENTINEL_RE, '').trim()
    : name
);

/**
 * 把金手指名正名為現行名稱（剝除舊版尾端手冊簡稱括號）。
 * @param {string} name
 * @returns {string}
 */
export const normalizeQuirkName = (name) => (
  typeof name === 'string' && LEGACY_QUIRK_SUFFIX_RE.test(name)
    ? name.replace(LEGACY_QUIRK_SUFFIX_RE, '').trim()
    : name
);

/**
 * 正名單一角色身上的舊識別字（職業、技能、子選項咒語、英雄技能、咒語、裝備、金手指）。
 * 若全部已是現行名稱，回傳原本的物件參考（`===`）。
 * @param {object} char
 * @returns {object}
 */
export const normalizeCharacterLegacyNames = (char) => {
  if (!char || typeof char !== 'object') return char;
  let charChanged = false;
  let nextChar = char;
  const patch = (key, val) => {
    if (!charChanged) {
      nextChar = { ...char };
      charChanged = true;
    }
    nextChar[key] = val;
  };

  if (Array.isArray(char.classes)) {
    let classesChanged = false;
    const classes = char.classes.map((cl) => {
      if (!cl || typeof cl !== 'object') return cl;
      let clChanged = false;
      const cName = normalizeClassName(cl.className);
      if (cName !== cl.className) clChanged = true;

      let skills = cl.skills;
      if (Array.isArray(cl.skills)) {
        let skillsChanged = false;
        const nextSkills = cl.skills.map((sk) => {
          if (!sk || typeof sk !== 'object') return sk;
          let skChanged = false;
          const sName = normalizeSkillName(sk.name);
          if (sName !== sk.name) skChanged = true;

          let selectedOptions = sk.selectedOptions;
          if (Array.isArray(sk.selectedOptions)) {
            let optsChanged = false;
            const nextOpts = sk.selectedOptions.map((opt) => {
              if (typeof opt !== 'string') return opt;
              const normOpt = normalizeSpellName(opt);
              if (normOpt !== opt) optsChanged = true;
              return normOpt;
            });
            if (optsChanged) {
              selectedOptions = nextOpts;
              skChanged = true;
            }
          }
          if (!skChanged) return sk;
          skillsChanged = true;
          return {
            ...sk,
            name: sName,
            ...(selectedOptions !== sk.selectedOptions ? { selectedOptions } : {})
          };
        });
        if (skillsChanged) {
          skills = nextSkills;
          clChanged = true;
        }
      }

      if (!clChanged) return cl;
      classesChanged = true;
      return {
        ...cl,
        className: cName,
        ...(skills !== cl.skills ? { skills } : {})
      };
    });
    if (classesChanged) patch('classes', classes);
  }

  if (Array.isArray(char.heroicSkills)) {
    let hsChanged = false;
    const heroicSkills = char.heroicSkills.map((hs) => {
      if (typeof hs === 'string') {
        const norm = normalizeHeroicSkillName(hs);
        if (norm !== hs) hsChanged = true;
        return norm;
      }
      if (hs && typeof hs === 'object') {
        const norm = normalizeHeroicSkillName(hs.name);
        if (norm !== hs.name) {
          hsChanged = true;
          return { ...hs, name: norm };
        }
      }
      return hs;
    });
    if (hsChanged) patch('heroicSkills', heroicSkills);
  }

  if (Array.isArray(char.spells)) {
    let spChanged = false;
    const spells = char.spells.map((sp) => {
      if (typeof sp === 'string') {
        const norm = normalizeSpellName(sp);
        if (norm !== sp) spChanged = true;
        return norm;
      }
      if (sp && typeof sp === 'object') {
        const norm = normalizeSpellName(sp.name);
        if (norm !== sp.name) {
          spChanged = true;
          return { ...sp, name: norm };
        }
      }
      return sp;
    });
    if (spChanged) patch('spells', spells);
  }

  if (char.equipment && typeof char.equipment === 'object') {
    let eqChanged = false;
    const nextEq = { ...char.equipment };
    ['mainHand', 'offHand', 'armor', 'accessory'].forEach((slot) => {
      if (typeof nextEq[slot] === 'string') {
        const norm = normalizeEquipmentName(nextEq[slot]);
        if (norm !== nextEq[slot]) {
          nextEq[slot] = norm;
          eqChanged = true;
        }
      }
    });
    if (eqChanged) patch('equipment', nextEq);
  }

  if (typeof char.quirk === 'string') {
    const normQuirk = normalizeQuirkName(char.quirk);
    if (normQuirk !== char.quirk) patch('quirk', normQuirk);
  }

  if (Array.isArray(char.tinkererData?.gadgets?.magitechSpells)) {
    let mtChanged = false;
    const nextMt = char.tinkererData.gadgets.magitechSpells.map((s) => {
      const norm = normalizeSpellName(s);
      if (norm !== s) mtChanged = true;
      return norm;
    });
    if (mtChanged) {
      patch('tinkererData', {
        ...char.tinkererData,
        gadgets: {
          ...char.tinkererData.gadgets,
          magitechSpells: nextMt
        }
      });
    }
  }

  if (Array.isArray(char.chimeristData?.spells)) {
    let chChanged = false;
    const nextCh = char.chimeristData.spells.map((sp) => {
      if (!sp || typeof sp !== 'object') return sp;
      const norm = normalizeSpellName(sp.name);
      if (norm !== sp.name) {
        chChanged = true;
        return { ...sp, name: norm };
      }
      return sp;
    });
    if (chChanged) {
      patch('chimeristData', {
        ...char.chimeristData,
        spells: nextCh
      });
    }
  }

  if (Array.isArray(char.technospheres?.mnemospheres)) {
    let mnChanged = false;
    const nextMn = char.technospheres.mnemospheres.map((mn) => {
      if (!mn || typeof mn !== 'object') return mn;
      let itemChanged = false;
      const cName = normalizeClassName(mn.className);
      if (cName !== mn.className) itemChanged = true;

      let skills = mn.skills;
      if (Array.isArray(mn.skills)) {
        let sksChanged = false;
        const nextSkills = mn.skills.map((sk) => {
          if (!sk || typeof sk !== 'object') return sk;
          let skChanged = false;
          const sName = normalizeSkillName(sk.name);
          if (sName !== sk.name) skChanged = true;

          let selectedOptions = sk.selectedOptions;
          if (Array.isArray(sk.selectedOptions)) {
            let optsChanged = false;
            const nextOpts = sk.selectedOptions.map((opt) => {
              if (typeof opt !== 'string') return opt;
              const normOpt = normalizeSpellName(opt);
              if (normOpt !== opt) optsChanged = true;
              return normOpt;
            });
            if (optsChanged) {
              selectedOptions = nextOpts;
              skChanged = true;
            }
          }
          if (!skChanged) return sk;
          sksChanged = true;
          return {
            ...sk,
            name: sName,
            ...(selectedOptions !== sk.selectedOptions ? { selectedOptions } : {})
          };
        });
        if (sksChanged) {
          skills = nextSkills;
          itemChanged = true;
        }
      }
      if (!itemChanged) return mn;
      mnChanged = true;
      return {
        ...mn,
        className: cName,
        ...(skills !== mn.skills ? { skills } : {})
      };
    });
    if (mnChanged) {
      patch('technospheres', {
        ...char.technospheres,
        mnemospheres: nextMn
      });
    }
  }

  return nextChar;
};

/**
 * 正名整份角色名冊。
 *
 * 回傳**新陣列**；若整份名冊都沒有舊名，回傳原本那個陣列（呼叫端可用參考相等
 * 判斷「有沒有需要寫回」，避免每次開頁都產生新物件）。
 * @param {Array} roster
 * @returns {Array}
 */
export const normalizeRosterClassNames = (roster) => {
  if (!Array.isArray(roster)) return roster;
  let rosterChanged = false;
  const next = roster.map((char) => {
    const norm = normalizeCharacterLegacyNames(char);
    if (norm !== char) rosterChanged = true;
    return norm;
  });
  return rosterChanged ? next : roster;
};

export const SOURCEBOOKS = {
  core: {
    id: 'core',
    name: '核心規則書',
    shortName: '核心',
    badgeColor: 'amber',
    desc: '《Fabula Ultima》核心 15 大經典職業，TRPG 冒險與創角基石。',
    defaultEnabled: true,
    locked: false,
    classes: [
      '秘儀師',
      '嵌合師',
      '暗黑之刃',
      '元素師',
      '熵師',
      '狂怒鬥士',
      '守護者',
      '博學士',
      '吟唱者',
      '遊蕩者',
      '神射手',
      '靈師',
      '修補匠',
      '旅人',
      '武器大師'
    ]
  },
  highFantasy: {
    id: 'highFantasy',
    name: '高度奇幻手冊',
    shortName: '高度奇幻',
    badgeColor: 'purple',
    desc: '史詩般的英雄宿命、誓約與魔法，包含指揮官、舞者、魔奏者、徽記師。',
    defaultEnabled: false,
    classes: ['指揮官', '舞者', '魔奏者', '徽記師']
  },
  technoFantasy: {
    id: 'technoFantasy',
    name: '科技奇幻手冊',
    shortName: '科技奇幻',
    badgeColor: 'cyan',
    desc: '魔導機械載具、超能心靈感應與基因突變，包含機師、靈能者、突變體。',
    defaultEnabled: false,
    classes: ['機師', '靈能者', '突變體']
  },
  naturalFantasy: {
    id: 'naturalFantasy',
    name: '自然奇幻手冊',
    shortName: '自然奇幻',
    badgeColor: 'emerald',
    desc: '大地生態共生、野味烹飪料理與行商契約，包含美食家、祈喚者、商人、植物學家。',
    defaultEnabled: false,
    classes: ['美食家', '祈喚者', '商人', '植物學家']
  },
  bonus: {
    id: 'bonus',
    name: '官方特典合輯',
    shortName: '特典合輯',
    badgeColor: 'indigo',
    desc: '官方特典合輯 Bonus Collection，包含卡牌大師與死靈術士。',
    defaultEnabled: false,
    classes: ['卡牌大師', '死靈術士']
  },
  playtest: {
    id: 'playtest',
    name: '官方公測修訂',
    shortName: '公測修訂',
    badgeColor: 'rose',
    desc: '官方釋出的實驗性規則：核心書技能的變體版本，以及重製版秘儀師。',
    defaultEnabled: false,
    /**
     * 只有**真的有官方對應**的職業才留在這裡。
     *
     * 2026-10-19 覆核最新修訂文件（Playtest Materials ENG 2026-10-01，45 頁）：
     * 整份文件只有一個職業級變體——p.24「ARCANIST (variant)」。
     * 舊版另外 6 個【Playtest】職業（守護者／武器大師／博學士／暗黑之刃／神射手／吟唱者）
     * 在文件裡**只作為英雄技能的前提被提到**（那是核心職業本身），沒有任何職業資料，
     * 屬系統自製內容，已依使用者裁定刪除（見 `AGENTS.md` §6.1 BC1、`docs/decisions.md` §BE）。
     */
    classes: [
      VARIANT_ARCANIST_CLASS_NAME
    ]
  }
};

/**
 * 官方職業中英文名稱、專屬圖標與一言風格速覽 (Class Metadata & Taglines)
 * 滿足創角時中英雙語對照與一目了然的職業戰鬥畫風
 */
export const CLASS_METADATA = {
  // 核心 15 職 (Core 15 Classes)
  '秘儀師': {
    name: '秘儀師',
    en: 'Arcanist',
    icon: 'GiCrystalBall',
    source: 'core',
    tagline: '召喚並役使阿爾卡納守護靈的秘術師。'
  },
  '嵌合師': {
    name: '嵌合師',
    en: 'Chimerist',
    icon: 'GiMonsterGrasp',
    source: 'core',
    tagline: '習得魔獸特技並化為己用的擬獸術士。'
  },
  '暗黑之刃': {
    name: '暗黑之刃',
    en: 'Darkblade',
    icon: 'GiDrippingSword',
    source: 'core',
    tagline: '燃燒生命與暗黑力量作戰的復仇劍士。'
  },
  '元素師': {
    name: '元素師',
    en: 'Elementalist',
    icon: 'GiFireRay',
    source: 'core',
    tagline: '掌控自然毀滅要素的大法師。'
  },
  '熵師': {
    name: '熵師',
    en: 'Entropist',
    icon: 'GiHourglass',
    source: 'core',
    tagline: '操縱時間、引力與混沌的時空術士。'
  },
  '狂怒鬥士': {
    name: '狂怒鬥士',
    en: 'Fury',
    icon: 'GiEnrage',
    source: 'core',
    tagline: '陷入危機時爆發極限力量的狂戰士。'
  },
  '守護者': {
    name: '守護者',
    en: 'Guardian',
    icon: 'GiShield',
    source: 'core',
    tagline: '護衛同伴並吸收衝擊的鐵壁守衛。'
  },
  '博學士': {
    name: '博學士',
    en: 'Loremaster',
    icon: 'GiScrollQuill',
    source: 'core',
    tagline: '洞悉魔物弱點與古老傳承的學者。'
  },
  '吟唱者': {
    name: '吟唱者',
    en: 'Orator',
    icon: 'GiPublicSpeaker',
    source: 'core',
    tagline: '以話語引導戰局與激勵同伴的雄辯家。'
  },
  '遊蕩者': {
    name: '遊蕩者',
    en: 'Rogue',
    icon: 'GiHoodedFigure',
    source: 'core',
    tagline: '伺機而動、精於偷襲與盜竊的刺客。'
  },
  '神射手': {
    name: '神射手',
    en: 'Sharpshooter',
    icon: 'GiCrossbow',
    source: 'core',
    tagline: '精準打擊遠方目標的狙擊專家。'
  },
  '靈師': {
    name: '靈師',
    en: 'Spiritist',
    icon: 'GiHealing',
    source: 'core',
    tagline: '治癒創傷並驅除邪穢的白魔法師。'
  },
  '修補匠': {
    name: '修補匠',
    en: 'Tinkerer',
    icon: 'GiCog',
    source: 'core',
    tagline: '善用工具、藥劑與奇妙發明的工匠。'
  },
  '旅人': {
    name: '旅人',
    en: 'Wayfarer',
    icon: 'GiCompass',
    source: 'core',
    tagline: '探索未知荒野並有魔寵相伴的行者。'
  },
  '武器大師': {
    name: '武器大師',
    en: 'Weaponmaster',
    icon: 'GiCrossedSwords',
    source: 'core',
    tagline: '精通各類兵器武技的近戰行家。'
  },

  // 高度奇幻 (High Fantasy)
  '指揮官': {
    name: '指揮官',
    en: 'Commander',
    icon: 'GiSpartanHelmet',
    source: 'highFantasy',
    tagline: '調度戰術隊形並引導同伴作戰的領袖。'
  },
  '舞者': {
    name: '舞者',
    en: 'Dancer',
    icon: 'GiFencer',
    source: 'highFantasy',
    tagline: '以優雅舞步施展戰鬥干擾的優雅戰士。'
  },
  '魔奏者': {
    name: '魔奏者',
    en: 'Chanter',
    icon: 'GiLyre',
    source: 'highFantasy',
    tagline: '以旋律編織魔力共鳴的吟遊詩人。'
  },
  '徽記師': {
    name: '徽記師',
    en: 'Symbolist',
    icon: 'GiRuneStone',
    source: 'highFantasy',
    tagline: '將魔力銘刻為持久戰鬥結界的刻印者。'
  },

  // 科技奇幻 (Techno Fantasy)
  '機師': {
    name: '機師',
    en: 'Pilot',
    icon: 'GiGears',
    source: 'technoFantasy',
    tagline: '駕駛魔導裝甲與科技載具的高速機師。'
  },
  '靈能者': {
    name: '靈能者',
    en: 'Esper',
    icon: 'GiPsychicWaves',
    source: 'technoFantasy',
    tagline: '運用精神念動力與思維屏障的超能者。'
  },
  '突變體': {
    name: '突變體',
    en: 'Mutant',
    icon: 'GiDna2',
    source: 'technoFantasy',
    tagline: '自如異化改造自身肉體的變異戰士。'
  },

  // 自然奇幻 (Natural Fantasy)
  '美食家': {
    name: '美食家',
    en: 'Gourmet',
    icon: 'GiCookingPot',
    source: 'naturalFantasy',
    tagline: '烹飪魔物珍饈為同伴提供增益的料理大師。'
  },
  '祈喚者': {
    name: '祈喚者',
    en: 'Invoker',
    icon: 'GiWizardStaff',
    source: 'naturalFantasy',
    tagline: '引導天地四時靈氣的大自然通靈者。'
  },
  '商人': {
    name: '商人',
    en: 'Merchant',
    icon: 'GiTwoCoins',
    source: 'naturalFantasy',
    tagline: '善用財富投資道具與雇傭特援的精明商賈。'
  },
  '植物學家': {
    name: '植物學家',
    en: 'Floralist',
    icon: 'GiSprout',
    source: 'naturalFantasy',
    tagline: '培育奇花異草與藥用孢子的園藝專家。'
  },

  // 特典合輯 (Bonus Collection)
  '卡牌大師': {
    name: '卡牌大師',
    en: 'Ace of Cards',
    icon: 'GiCardPlay',
    source: 'bonus',
    tagline: '運用實體套牌操縱機率與超自然運氣的牌靈師。'
  },
  '死靈術士': {
    name: '死靈術士',
    en: 'Necromancer',
    icon: 'GiScythe',
    source: 'bonus',
    tagline: '支配亡者怨念並操弄生死的通冥學者。'
  },

  // 公測修訂 (Playtest Variants)
  // ※ 2026-10-19 只留官方真的有對應的那一個（Playtest 2026-10-01 p.24「ARCANIST (variant)」）。
  //   其餘 6 個【Playtest】職業在文件裡沒有職業資料，已刪除（§BE）。
  //   【變體】是「同一職業的另一版規則」，不是另一本書（§BF）。
  [VARIANT_ARCANIST_CLASS_NAME]: {
    name: VARIANT_ARCANIST_CLASS_NAME,
    en: 'Arcanist (Variant)',
    icon: 'GiCrystalBall',
    source: 'playtest',
    tagline: '重製版秘儀師：召喚 30 點 MP，阿爾卡納多一層「脈衝」。'
  }
};

/**
 * 取得職業完整設定元資料（中文、英文、圖標與一句話風格）
 */
export function getClassInfo(className) {
  if (!className) return null;
  const clean = String(className).trim();
  const baseName = clean.replace(/【.*?】/g, '');
  const match = CLASS_METADATA[clean] || CLASS_METADATA[baseName];
  if (match) return match;

  return {
    name: clean,
    en: baseName,
    icon: clean,
    source: 'core',
    tagline: '踏上傳奇冒險征程的勇者。'
  };
}

/**
 * 官方標準推薦情感選項（三維六向）
 */
export const BOND_FEELINGS = [
  {
    category: 'pair1',
    label: '欽佩 vs 自卑',
    options: [
      { id: 'admiration', label: '欽佩', iconName: 'admiration' },
      { id: 'inferiority', label: '自卑', iconName: 'inferiority' }
    ]
  },
  {
    category: 'pair2',
    label: '忠誠 vs 疑忌',
    options: [
      { id: 'loyalty', label: '忠誠', iconName: 'loyalty' },
      { id: 'mistrust', label: '疑忌', iconName: 'mistrust' }
    ]
  },
  {
    category: 'pair3',
    label: '眷愛 vs 憎恨',
    options: [
      { id: 'affection', label: '眷愛', iconName: 'affection' },
      { id: 'hatred', label: '憎恨', iconName: 'hatred' }
    ]
  }
];

/**
 * 四維屬性的官方中文名。
 *
 * 譯名來源：**繁中版角色卡 Excel V2.17**（使用者裁定）；核心規則漢化 PDF 同義
 * （靈巧度／洞察力／力量值／意志力）。
 *
 * 為什麼要有這張表：這四個名字原本散在四處各自寫死——`StatBadge` 的 `STAT_CONFIG`、
 * `AttributeMatrixPicker` 的 `ATTRIBUTE_DETAILS`、`CharacterSheetExport` 的三頁表頭、
 * `CharacterPlayHUD` 的資源磚與下拉選單——而它們**當場就不一致**：
 * `StatBadge` 寫「力量」，其餘三處寫「體魄」。收斂成一張表之後，
 * `tests/characterSheetUi.test.mjs` 可以直接斷言這四個名字，不會再各自漂移。
 *
 * 注意：`敏捷`／`體魄` 是舊譯名（來源不明、`docs/` 內查無裁定紀錄），已全面汰換。
 * 但**「敏捷」本身仍是普通中文形容詞**——NPC 的特質輸入框拿它當範例
 * （`NPCWorkshop.jsx` 的 `placeholder="例如: 敏捷, 致命..."`）、Boss 敘述也用它形容動作快
 * （`bossSkillsData.js` 的「此 Boss 特別敏捷或隱蔽」）。那些地方**不是屬性名，不要改**。
 */
export const ATTRIBUTE_NAMES = Object.freeze({
  dex: '靈巧',
  ins: '洞察',
  mig: '力量',
  wlp: '意志'
});

/**
 * 四維屬性的識別字（順序即介面順序）。
 *
 * 以前這個陣列在三處各寫一份：`characterEngine` 的加總／範圍檢查與狀態減值推導、
 * `AttributeMatrixPicker` 的 `STAT_KEYS`。收斂成一份，動到屬性集合時才不會漏改。
 */
export const ATTRIBUTE_KEYS = Object.freeze(['dex', 'ins', 'mig', 'wlp']);

/**
 * 四維屬性的身份色（第二十一輪）。
 *
 * 這張表和 `ATTRIBUTE_NAMES` 放在一起，理由與那張表完全相同：**同一個身份只准有一份定義**。
 * 這一輪之前，四屬性的顏色有五份獨立的拷貝，而且**當場就不一致**：
 *
 * | 出處 | DEX | INS | MIG | WLP |
 * |---|---|---|---|---|
 * | `StatBadge` | amber-800 | blue-800 | red-800 | emerald-800 |
 * | `NPCWorkshop` 的兩張數值表 | blue-800 | emerald-800 | red-800 | purple-800 |
 * | `NPCWorkshop` 的屬性卡 | blue-900 | emerald-900 | red-900 | purple-900 |
 * | `WayfarerCompanionModal` | amber-600 | blue-600 | red-600 | purple-600 |
 * | `WayfarerCompanionSheet` | amber-700 | blue-700 | red-700 | purple-700 |
 *
 * 於是「靈巧」在角色卡上是琥珀、在 NPC 工坊是藍色。那不是深淺差，是**兩個身份**。
 *
 * **為什麼不用紅**：`#a63d40` 是強調色——它講的是「這裡可以按」。屬性色講的是「這是哪一個」。
 * 同一個訊號不能同時講兩件事，所以四屬性一律避開強調色所在的紅家族
 * （`#a63d40`／`#8c2d36`／`#76252d` 三個都在那一族裡）。
 *
 * 四個 hex 的挑法與九相相同：先量色相角（108° / 182° / 237° / 295°，
 * 相鄰差 74°／55°／58°），再量三面（`#fbf7ee`／`#f4ebd9`／`#fffdf9`）的對比，
 * 落在 **6.00–7.25:1**——與九相的 5.01–7.60 同一個帶。
 * 與九相的距離靠飽和度分：意志 237° ↔ 物理 215°（Δs 24）、力量 295° ↔ 暗 274°（Δs 24）。
 *
 * ※ 這裡寫的是**字面量 class**（`text-[#336327]`），不是 hex 變數：Tailwind 只掃字面量，
 * `text-[${hex}]` 不會生成任何 class。護欄 H15 擋「回退成色相令牌」與「四色撞色」，
 * H15-b 擋「再長出第六份拷貝」。
 */
export const ATTRIBUTE_COLORS = Object.freeze({
  dex: 'text-[#336327]',
  ins: 'text-[#216163]',
  mig: 'text-[#91259d]',
  wlp: 'text-[#3d458f]'
});

/**
 * 官方六大狀態異常 (Status Afflictions)
 */
export const STATUS_AFFLICTIONS = {
  dazed: {
    id: 'dazed',
    name: '眩暈',
    short: '眩暈',
    affectedStats: ['ins'],
    desc: '洞察 骰階下降 1 級 (最低降至 d6)'
  },
  enraged: {
    id: 'enraged',
    name: '憤怒',
    short: '憤怒',
    affectedStats: ['dex', 'ins'],
    desc: `${ATTRIBUTE_NAMES.dex} 與 ${ATTRIBUTE_NAMES.ins} 骰階下降 1 級 (最低降至 d6)`
  },
  poisoned: {
    id: 'poisoned',
    name: '中毒',
    short: '中毒',
    affectedStats: ['mig', 'wlp'],
    desc: `${ATTRIBUTE_NAMES.mig} 與 ${ATTRIBUTE_NAMES.wlp} 骰階下降 1 級 (最低降至 d6)`
  },
  shaken: {
    id: 'shaken',
    name: '動搖',
    short: '動搖',
    affectedStats: ['wlp'],
    desc: '意志 骰階下降 1 級 (最低降至 d6)'
  },
  slow: {
    id: 'slow',
    name: '緩慢',
    short: '緩慢',
    affectedStats: ['dex'],
    desc: `${ATTRIBUTE_NAMES.dex} 骰階下降 1 級 (最低降至 d6)`
  },
  weak: {
    id: 'weak',
    name: '虛弱',
    short: '虛弱',
    affectedStats: ['mig'],
    desc: `${ATTRIBUTE_NAMES.mig} 骰階下降 1 級 (最低降至 d6)`
  }
};

/**
 * 官方十個主題（Core p.158／核心規則漢化 p.158）。
 *
 * 譯名一律照官方核心規則漢化 PDF：`野心 憤怒 歸屬 懷疑 責任 內疚 希望 正義 慈悲 復仇`。
 * 舊版只有九個（漏了「憤怒」），而且「責任」「內疚」被寫成「職責」「負疚」。
 * `tests/creationRules.test.mjs` 有一條護欄把這裡綁在官方清單上。
 */
export const CANONICAL_THEMES = [
  '野心',
  '憤怒',
  '歸屬',
  '懷疑',
  '責任',
  '內疚',
  '希望',
  '正義',
  '慈悲',
  '復仇'
];

/**
 * 舊譯名 → 官方譯名的對照。
 *
 * 只有 `負疚`／`職責` 兩個：它們是本次修正之前寫進程式的名稱，可能已經落在玩家的存檔裡。
 * 讀取端一律經過 `normalizeTheme`，所以舊卡的主題會落在正確的選項上，
 * 而**不必改寫玩家的存檔**（比照「舊存檔沒有新欄位 → 一律視為舊行為」的處理原則）。
 */
export const THEME_ALIASES = Object.freeze({
  '負疚': '內疚',
  '職責': '責任'
});

/** 把舊譯名正規化成官方主題名；不認識的一律原樣傳回（＝玩家的自訂主題） */
export const normalizeTheme = (theme) => THEME_ALIASES[theme] || theme || '';

/**
 * 官方三大起始四維屬性陣列配置（Core p.162；總點數嚴格等於 32）。
 *
 * 名稱照官方核心規則漢化：`萬事通 d8d8d8d8`／`標準 d10d8d8d6`／`特化型 d10d10d6d6`。
 * 舊版把「標準」寫成「專精型」、「萬事通」寫成「均衡型」，於是「專精型」與「特化型」
 * 這兩個中文近義詞掛著完全不同的骰組；`tag` 原本還寫著「最推薦」——原書沒有推薦哪一組
 * （p.162 只說「選擇以下預設配置之一」），那句話沒有出處。
 *
 * 放在 data/ 而不是元件裡：骰組與名稱要能被 `tests/creationRules.test.mjs` 直接比對。
 */
export const ATTRIBUTE_PRESET_ARRAYS = [
  {
    id: 'specialized',
    name: '標準',
    tag: '一主一短',
    diceList: [10, 8, 8, 6],
    desc: 'd10, d8, d8, d6 —— 1 卓越專精、2 穩定基準、1 短板。'
  },
  {
    id: 'standard',
    name: '萬事通',
    tag: '四項均等',
    diceList: [8, 8, 8, 8],
    desc: 'd8, d8, d8, d8 —— 四項能力完全平衡，泛用穩健。'
  },
  {
    id: 'focused',
    name: '特化型',
    tag: '雙強雙弱',
    diceList: [10, 10, 6, 6],
    desc: 'd10, d10, d6, d6 —— 雙強雙弱，極度依賴隊友戰術互補。'
  }
];

/**
 * 官方身份創建完整靈感對照表 (Core Rulebook p. 158-159)
 * 嚴格遵循官方手冊三表骰階映射：
 * 1. 核心概念 (Core Concept): 1d6 [1-2, 3-4, 5-6] 決定組別 + 1d20 (共 60 種身分)
 * 2. 形容特質 (Adjective): 1d6 [1-3, 4-6] 決定組別 + 1d20 (共 40 種特質)
 * 3. 身世細節 (Detail): 1d20 (共 20 種細節)
 */
export const OFFICIAL_IDENTITY_TABLES = {
  coreConcepts: {
    title: '核心概念',
    rollDesc: '先投 1d6 決定組別，再投 1d20 決定身分 (共 60 種)',
    groups: [
      {
        d6Range: '1-2',
        title: '第一組 (d6: 1-2)',
        items: [
          { id: 1, zh: '騎士', en: 'Knight' },
          { id: 2, zh: '賞金獵人', en: 'Bounty Hunter' },
          { id: 3, zh: '武術家', en: 'Martial Artist' },
          { id: 4, zh: '尋寶獵人', en: 'Treasure Hunter' },
          { id: 5, zh: '異星來客', en: 'Alien' },
          { id: 6, zh: '祭司/神職者', en: 'Priest/ess' },
          { id: 7, zh: '學者/教授', en: 'Professor' },
          { id: 8, zh: '武士', en: 'Samurai' },
          { id: 9, zh: '吟遊詩人', en: 'Bard' },
          { id: 10, zh: '士兵', en: 'Soldier' },
          { id: 11, zh: '發明家', en: 'Inventor' },
          { id: 12, zh: '走私者', en: 'Smuggler' },
          { id: 13, zh: '自動人偶', en: 'Automaton' },
          { id: 14, zh: '忍者', en: 'Ninja' },
          { id: 15, zh: '外交官', en: 'Diplomat' },
          { id: 16, zh: '盜賊', en: 'Thief' },
          { id: 17, zh: '國王/女王', en: 'King/Queen' },
          { id: 18, zh: '法師', en: 'Mage' },
          { id: 19, zh: '角鬥士', en: 'Gladiator' },
          { id: 20, zh: '王子/公主', en: 'Prince/ss' }
        ]
      },
      {
        d6Range: '3-4',
        title: '第二組 (d6: 3-4)',
        items: [
          { id: 1, zh: '保鑣', en: 'Bodyguard' },
          { id: 2, zh: '強盜', en: 'Bandit' },
          { id: 3, zh: '工廠工人', en: 'Factory Worker' },
          { id: 4, zh: '學生', en: 'Student' },
          { id: 5, zh: '畫家', en: 'Painter' },
          { id: 6, zh: '魔導工程師', en: 'Magitech Engineer' },
          { id: 7, zh: '弓手', en: 'Archer' },
          { id: 8, zh: '秘術學者', en: 'Occultist' },
          { id: 9, zh: '聖武士', en: 'Paladin' },
          { id: 10, zh: '武僧', en: 'Monk' },
          { id: 11, zh: '槍手', en: 'Gunslinger' },
          { id: 12, zh: '黑騎士', en: 'Black Knight' },
          { id: 13, zh: '鍊金術士', en: 'Alchemist' },
          { id: 14, zh: '飛空艇駕駛員', en: 'Airship Pilot' },
          { id: 15, zh: '間諜', en: 'Spy' },
          { id: 16, zh: '聖殿騎士', en: 'Templar' },
          { id: 17, zh: '機械師', en: 'Mechanic' },
          { id: 18, zh: '舞者', en: 'Dancer' },
          { id: 19, zh: '砲手', en: 'Cannoneer' },
          { id: 20, zh: '商人', en: 'Merchant' }
        ]
      },
      {
        d6Range: '5-6',
        title: '第三組 (d6: 5-6)',
        items: [
          { id: 1, zh: '活動傀儡', en: 'Animated Puppet' },
          { id: 2, zh: '拾荒者', en: 'Scavenger' },
          { id: 3, zh: '反抗軍特工', en: 'Rebel Agent' },
          { id: 4, zh: '戰魔導士', en: 'Warrior Mage' },
          { id: 5, zh: '貴族', en: 'Noble' },
          { id: 6, zh: '決鬥者', en: 'Duelist' },
          { id: 7, zh: '怪物獵人', en: 'Monster Hunter' },
          { id: 8, zh: '軍醫', en: 'Medic' },
          { id: 9, zh: '變形者', en: 'Shapeshifter' },
          { id: 10, zh: '海盜', en: 'Pirate' },
          { id: 11, zh: '賭徒', en: 'Gambler' },
          { id: 12, zh: '浪人', en: 'Ronin' },
          { id: 13, zh: '雇傭兵', en: 'Mercenary' },
          { id: 14, zh: '廚師', en: 'Cook' },
          { id: 15, zh: '指揮官', en: 'Commander' },
          { id: 16, zh: '狙擊手', en: 'Sniper' },
          { id: 17, zh: '運動家', en: 'Athlete' },
          { id: 18, zh: '醫者', en: 'Healer' },
          { id: 19, zh: '惡魔獵人', en: 'Demon Hunter' },
          { id: 20, zh: '異形造物', en: 'Abomination' }
        ]
      }
    ]
  },
  adjectives: {
    title: '形容特質',
    rollDesc: '先投 1d6 決定組別，再投 1d20 決定特質 (共 40 種)',
    groups: [
      {
        d6Range: '1-3',
        title: '第一組 (d6: 1-3)',
        items: [
          { id: 1, zh: '迷人的', en: 'Charming' },
          { id: 2, zh: '破誓者', en: 'Oathbreaker' },
          { id: 3, zh: '被選中的', en: 'Chosen' },
          { id: 4, zh: '前帝國的', en: 'Former Imperial' },
          { id: 5, zh: '多災多難的', en: 'Troubled' },
          { id: 6, zh: '勇敢的', en: 'Brave' },
          { id: 7, zh: '熱愛動物的', en: 'Animal-loving' },
          { id: 8, zh: '失憶的', en: 'Amnesiac' },
          { id: 9, zh: '瀟灑的', en: 'Dashing' },
          { id: 10, zh: '帝國的', en: 'Imperial' },
          { id: 11, zh: '崇尚自由的', en: 'Free-spirited' },
          { id: 12, zh: '忠誠的', en: 'Loyal' },
          { id: 13, zh: '年邁的', en: 'Elderly' },
          { id: 14, zh: '恪守騎士道的', en: 'Chivalrous' },
          { id: 15, zh: '面帶微笑的', en: 'Smiling' },
          { id: 16, zh: '務實不苟的', en: 'No-nonsense' },
          { id: 17, zh: '見習學徒', en: 'Apprentice' },
          { id: 18, zh: '有影響力的', en: 'Influent' },
          { id: 19, zh: '脾氣暴躁的', en: 'Ill-tempered' },
          { id: 20, zh: '堅韌頑強的', en: 'Tough' }
        ]
      },
      {
        d6Range: '4-6',
        title: '第二組 (d6: 4-6)',
        items: [
          { id: 1, zh: '虔誠的', en: 'Devout' },
          { id: 2, zh: '最後的', en: 'Last' },
          { id: 3, zh: '遙遠的', en: 'Distant' },
          { id: 4, zh: '驕傲的', en: 'Proud' },
          { id: 5, zh: '被通緝的', en: 'Wanted' },
          { id: 6, zh: '膽怯多懼的', en: 'Fearful' },
          { id: 7, zh: '善良仁慈的', en: 'Kind' },
          { id: 8, zh: '受人敬重的', en: 'Respectable' },
          { id: 9, zh: '被污穢玷污的', en: 'Tainted' },
          { id: 10, zh: '年輕的', en: 'Young' },
          { id: 11, zh: '古怪奇特的', en: 'Eccentric' },
          { id: 12, zh: '人脈廣闊的', en: 'Well-connected' },
          { id: 13, zh: '天真純樸的', en: 'Naive' },
          { id: 14, zh: '被寵壞的', en: 'Spoiled' },
          { id: 15, zh: '天賦異稟的', en: 'Gifted' },
          { id: 16, zh: '王室貴胄的', en: 'Royal' },
          { id: 17, zh: '魯莽不羈的', en: 'Reckless' },
          { id: 18, zh: '隱秘潛行的', en: 'Furtive' },
          { id: 19, zh: '赫赫有名的', en: 'Famous' },
          { id: 20, zh: '非人類種族的', en: 'Non-human' }
        ]
      }
    ]
  },
  details: {
    title: '身世細節',
    rollDesc: '投 1d20 決定身世細節 (共 20 種)',
    items: [
      { id: 1, zh: '擁有遠古血脈', en: 'from an Ancient Bloodline' },
      { id: 2, zh: '逃亡中', en: 'on the Run' },
      { id: 3, zh: '古老信仰的信奉者', en: 'of the Old Faith' },
      { id: 4, zh: '尋求正義', en: 'Seeking Justice' },
      { id: 5, zh: '身陷恥辱/失寵蒙羞', en: 'in Disgrace' },
      { id: 6, zh: '來自深紅之翼艦隊', en: 'of the Crimson Wings' },
      { id: 7, zh: '來自最高學府', en: 'from the High Academy' },
      { id: 8, zh: '來自月球', en: 'from the Moon' },
      { id: 9, zh: '縱橫七海', en: 'of the Seven Seas' },
      { id: 10, zh: '來自未來', en: 'from the Future' },
      { id: 11, zh: '尋找答案', en: 'looking for Answers' },
      { id: 12, zh: '沒有故鄉', en: 'without a Homeland' },
      { id: 13, zh: '來自王家近衛軍', en: 'of the Royal Army' },
      { id: 14, zh: '來自異度次元', en: 'from Another Dimension' },
      { id: 15, zh: '來自沙漠氏族', en: 'of the Desert Clans' },
      { id: 16, zh: '來自風暴騎士團', en: 'of the Storm Knights' },
      { id: 17, zh: '擁有一顆金子般的心', en: 'with a Heart of Gold' },
      { id: 18, zh: '來自遠古森林', en: 'from the Ancient Forest' },
      { id: 19, zh: '來自過去歷史', en: 'from the Past' },
      { id: 20, zh: '聖火的信徒', en: 'of the Sacred Flame' }
    ]
  }
};

/**
 * 舊版相容靈感陣列
 */
export const CANONICAL_IDENTITY_TABLES = {
  adjectives: OFFICIAL_IDENTITY_TABLES.adjectives.groups.flatMap(g => g.items.map(i => `${i.zh} (${i.en})`)),
  roles: OFFICIAL_IDENTITY_TABLES.coreConcepts.groups.flatMap(g => g.items.map(i => `${i.zh} (${i.en})`)),
  details: OFFICIAL_IDENTITY_TABLES.details.items.map(i => `${i.zh} (${i.en})`)
};

/**
 * 格式化中文身分字串，嚴格遵循中文書寫習慣『細節 - 特質 - 核心概念』
 */
export const formatChineseIdentity = (detail, adjective, concept) => {
  const detZh = typeof detail === 'string' ? detail : detail?.zh || '';
  const adjZh = typeof adjective === 'string' ? adjective : adjective?.zh || '';
  const conZh = typeof concept === 'string' ? concept : concept?.zh || '';

  if (!detZh && !adjZh && !conZh) return '';

  let detailPart = detZh.trim();
  let adjPart = adjZh.trim();
  let conceptPart = conZh.trim();

  // 若有細節，且後面有接特質或核心概念，則細節結尾補上「的」（若尚未有「的」或「之」）
  if (detailPart && (adjPart || conceptPart)) {
    if (!detailPart.endsWith('的') && !detailPart.endsWith('之')) {
      detailPart = `${detailPart}的`;
    }
  }

  return `${detailPart}${adjPart}${conceptPart}`;
};

/**
 * 官方手冊 1d6+1d20 擲骰身份生成器
 */
export const rollOfficialIdentity = () => {
  // 1. 核心概念 (Core Concept) - 1d6 + 1d20
  const d6Concept = Math.floor(Math.random() * 6) + 1;
  const conceptGroupIdx = d6Concept <= 2 ? 0 : d6Concept <= 4 ? 1 : 2;
  const conceptGroup = OFFICIAL_IDENTITY_TABLES.coreConcepts.groups[conceptGroupIdx];
  const d20Concept = Math.floor(Math.random() * 20) + 1;
  const conceptItem = conceptGroup.items[d20Concept - 1];

  // 2. 形容特質 (Adjective) - 1d6 + 1d20
  const d6Adj = Math.floor(Math.random() * 6) + 1;
  const adjGroupIdx = d6Adj <= 3 ? 0 : 1;
  const adjGroup = OFFICIAL_IDENTITY_TABLES.adjectives.groups[adjGroupIdx];
  const d20Adj = Math.floor(Math.random() * 20) + 1;
  const adjItem = adjGroup.items[d20Adj - 1];

  // 3. 身世細節 (Detail) - 1d20
  const d20Detail = Math.floor(Math.random() * 20) + 1;
  const detailItem = OFFICIAL_IDENTITY_TABLES.details.items[d20Detail - 1];

  // 中文順序：細節 - 特質 - 核心概念（例如：來自遠古森林的失憶的騎士）
  const fullZh = formatChineseIdentity(detailItem, adjItem, conceptItem);
  // 英文維持官方格式：Adjective + Core Concept (Detail)
  const fullEn = `${adjItem.en} ${conceptItem.en} (${detailItem.en})`;

  return {
    fullZh,
    fullEn,
    rolls: {
      concept: { d6: d6Concept, d20: d20Concept, item: conceptItem, group: conceptGroup.title },
      adjective: { d6: d6Adj, d20: d20Adj, item: adjItem, group: adjGroup.title },
      detail: { d20: d20Detail, item: detailItem }
    }
  };
};

export const generateRandomIdentity = () => {
  const result = rollOfficialIdentity();
  return result.fullZh;
};


