import React from 'react';
import {
  // 20 Starter Archetypes from Game-Icons.net
  GiRoundBottomFlask,
  GiBlackKnightHelm,
  GiCardDraw,
  GiPistolGun,
  GiHealing,
  GiGears,
  GiWolfHead,
  GiNinjaHead,
  GiPirateCaptain,
  GiPunchBlast,
  GiBowman,
  GiWizardStaff,
  GiWhiteBook,
  GiKatana,
  GiSpartanHelmet,
  GiFencer,
  GiCrystalBall,
  GiHoodedFigure,
  GiLyre,
  GiWingedSword,

  // Core 15 & Extended Classes from Game-Icons.net
  GiMonsterGrasp,
  GiDrippingSword,
  GiFireball,
  GiHourglass,
  GiEnrage,
  GiShield,
  GiScrollQuill,
  GiPublicSpeaker,
  GiCrossbow,
  GiCog,
  GiCompass,
  GiCrossedSwords,
  GiScythe,
  GiRuneStone,
  GiThirdEye,
  GiDna2,
  GiSprout,
  GiCookingPot,
  GiCampfire,
  GiPsychicWaves,
  GiFireRay,
  GiCrownCoin,
  GiTwoCoins,
  // 交易（P9）：履歷的 `trade` kind 用它。沒有登記的話 `GameIcon` 會**安靜地**
  // 退回 `GiSparkles`——圖示錯了，但沒有任何東西會紅。
  GiTakeMyMoney,

  // Bond Feelings
  GiBrokenHeart,
  GiEyeball,
  GiHeartShield,

  // Resources & UI Elements from Game-Icons.net
  GiHeartPlus,
  GiHealthNormal,
  GiLightningTear,
  GiBackpack,
  GiCoins,
  GiSparkles,
  GiUpgrade,
  GiPocketWatch,
  GiBroadsword,
  GiSpellBook,
  GiCheckMark,
  GiHazardSign,
  GiMagnifyingGlass,
  GiSaveArrow,
  GiRollingDices,
  GiTrashCan,
  GiQuillInk,
  GiLaurelCrown,
  GiScrollUnfurled,
  GiUpCard,
  GiChest,
  GiProgression,
  GiTrophyCup,
  GiPadlock,

  // Equipment Categories & Slots (武器十大類別與四個裝備欄位)
  GiPocketBow,
  GiPlainDagger,
  GiMusket,
  GiFlail,
  GiWarhammer,
  GiSpears,
  GiShuriken,
  GiRoundShield,
  GiBreastplate,
  GiRing,

  // Equipment Item Icons (裝備設計器逐項對照；見 equipmentRules.js 的 EQUIPMENT_ICONS)
  GiBrassKnuckles,
  GiSacrificialDagger,
  GiRevolver,
  GiFlatHammer,
  GiBatteredAxe,
  GiBattleAxe,
  GiGlaive,
  GiBarbedSpear,
  GiGladius,
  GiSwitchblade,
  GiPunch,
  GiWoodClub,
  GiSling,
  GiDragonShield,
  GiClothes,
  GiShirt,
  GiPirateCoat,
  GiNinjaArmor,
  GiRobe,
  GiChainMail,
  GiLeatherArmor,
  GiHeartArmor,
  GiLamellar
} from 'react-icons/gi';

export const GAME_ICONS_MAP = {
  // 20 Official Archetypes
  alchemist: GiRoundBottomFlask,
  black_knight: GiBlackKnightHelm,
  gambler: GiCardDraw,
  gunslinger: GiPistolGun,
  healer: GiHealing,
  magitechnician: GiGears,
  monster_mage: GiWolfHead,
  ninja: GiNinjaHead,
  pirate: GiPirateCaptain,
  pugilist: GiPunchBlast,
  ranger: GiBowman,
  red_sorcerer: GiWizardStaff,
  sage: GiWhiteBook,
  samurai: GiKatana,
  soldier: GiSpartanHelmet,
  spell_fencer: GiFencer,
  summoner: GiCrystalBall,
  thief: GiHoodedFigure,
  troubadour: GiLyre,
  valkyrie: GiWingedSword,

  // Core 15 Classes (官方核心 15 職 - 15 個完全無重疊的專屬圖標)
  '秘儀師': GiCrystalBall,
  'arcanist': GiCrystalBall,
  '秘術師': GiCrystalBall,

  '嵌合師': GiMonsterGrasp,
  'chimerist': GiMonsterGrasp,
  '奇美拉術士': GiMonsterGrasp,

  '暗黑之刃': GiDrippingSword,
  'darkblade': GiDrippingSword,
  '黑刃': GiDrippingSword,

  '元素師': GiFireRay,
  'elementalist': GiFireRay,
  '元素使': GiFireRay,

  '熵師': GiHourglass,
  'entropist': GiHourglass,
  '混沌術士': GiHourglass,
  '熵術士': GiHourglass,

  '狂怒鬥士': GiEnrage,
  'fury': GiEnrage,
  '狂戰士': GiEnrage,

  '守護者': GiShield,
  'guardian': GiShield,
  '守衛者': GiShield,

  '博學士': GiScrollQuill,
  'loremaster': GiScrollQuill,
  '博學者': GiScrollQuill,
  '傳承學者': GiScrollQuill,

  '吟唱者': GiPublicSpeaker,
  'orator': GiPublicSpeaker,
  '演說家': GiPublicSpeaker,
  '雄辯家': GiPublicSpeaker,

  '遊蕩者': GiHoodedFigure,
  'rogue': GiHoodedFigure,
  '盜賊': GiHoodedFigure,
  '潛行者': GiHoodedFigure,

  '神射手': GiCrossbow,
  'sharpshooter': GiCrossbow,

  '靈師': GiHealing,
  'spiritist': GiHealing,
  '心靈使': GiHealing,
  '靈魂術士': GiHealing,

  '修補匠': GiCog,
  'tinkerer': GiCog,
  '工匠': GiCog,

  '旅人': GiCompass,
  'wayfarer': GiCompass,
  '行者': GiCompass,

  '武器大師': GiCrossedSwords,
  'weaponmaster': GiCrossedSwords,

  // Extended Classes (拓展職業專屬圖標 - 與核心 15 職 100% 互不重疊)
  '死靈術士': GiScythe,
  'necromancer': GiScythe,

  '徽記師': GiRuneStone,
  'symbolist': GiRuneStone,

  '魔奏者': GiLyre,
  'chanter': GiLyre,

  '舞者': GiFencer,
  'dancer': GiFencer,

  '指揮官': GiSpartanHelmet,
  'commander': GiSpartanHelmet,

  '機師': GiGears,
  'pilot': GiGears,

  '靈能者': GiPsychicWaves,
  'psychic': GiPsychicWaves,

  '突變體': GiDna2,
  'mutant': GiDna2,

  '美食家': GiCookingPot,
  'gourmet': GiCookingPot,

  '祈喚者': GiWizardStaff,
  'invoker': GiWizardStaff,

  '商人': GiTwoCoins,
  'merchant': GiTwoCoins,

  '植物學家': GiSprout,
  'flora': GiSprout,

  // Direct Game-Icons.net component names support
  GiTwoCoins,
  // 交易（P9）：`LOG_KINDS.trade.icon` 用的是**元件名**，不是語意 key，
  // 所以它必須登記在這裡。少了這一行的話 `GameIcon` 會安靜地退回 GiSparkles，
  // 而 `tests/characterLog.test.mjs` 的「每個 LOG_KINDS 圖示都登記了」會紅。
  GiTakeMyMoney,
  GiPsychicWaves,
  GiFireRay,
  GiCrownCoin,
  GiCookingPot,
  GiRoundBottomFlask,
  GiBlackKnightHelm,
  GiCardDraw,
  GiPistolGun,
  GiHealing,
  GiGears,
  GiWolfHead,
  GiNinjaHead,
  GiPirateCaptain,
  GiPunchBlast,
  GiBowman,
  GiWizardStaff,
  GiWhiteBook,
  GiKatana,
  GiSpartanHelmet,
  GiFencer,
  GiCrystalBall,
  GiHoodedFigure,
  GiLyre,
  GiWingedSword,
  GiMonsterGrasp,
  GiDrippingSword,
  GiFireball,
  GiHourglass,
  GiEnrage,
  GiShield,
  GiScrollQuill,
  GiPublicSpeaker,
  GiCrossbow,
  GiCog,
  GiCompass,
  GiCrossedSwords,
  GiScythe,
  GiRuneStone,
  GiThirdEye,
  GiDna2,
  GiSprout,

  // Bond Feelings
  admiration: GiSparkles,
  inferiority: GiBrokenHeart,
  loyalty: GiShield,
  mistrust: GiEyeball,
  affection: GiHeartShield,
  hatred: GiLightningTear,

  // Common UI tags
  hp: GiHealthNormal,
  heart: GiHealthNormal,
  mp: GiLightningTear,
  zap: GiLightningTear,
  ip: GiBackpack,
  backpack: GiBackpack,
  zenit: GiCoins,
  coins: GiCoins,
  trade: GiTakeMyMoney,
  buy: GiTakeMyMoney,
  fabula: GiSparkles,
  sparkles: GiSparkles,
  exp: GiUpgrade,
  upgrade: GiUpgrade,
  sword: GiBroadsword,
  swords: GiCrossedSwords,
  shield: GiShield,
  clock: GiPocketWatch,
  camp: GiCampfire,
  dice: GiRollingDices,
  search: GiMagnifyingGlass,
  check: GiCheckMark,
  warning: GiHazardSign,
  book: GiSpellBook,
  trash: GiTrashCan,
  edit: GiQuillInk,
  save: GiSaveArrow,
  crown: GiLaurelCrown,
  scroll: GiScrollUnfurled,

  // Equipment Categories (武器十大類別，Core p.129)
  cat_arcane: GiWizardStaff,
  cat_bow: GiPocketBow,
  cat_brawling: GiPunchBlast,
  cat_dagger: GiPlainDagger,
  cat_firearm: GiMusket,
  cat_flail: GiFlail,
  cat_heavy: GiWarhammer,
  cat_spear: GiSpears,
  cat_sword: GiBroadsword,
  cat_thrown: GiShuriken,

  // Equipment Slots (四個裝備欄位)
  slot_mainhand: GiBroadsword,
  slot_offhand: GiRoundShield,
  slot_armor: GiBreastplate,
  slot_accessory: GiRing,

  // Character Log (成長履歷；由 characterLog.js 的 LOG_KINDS[].icon 指定元件名)
  // 註：GiScrollQuill／GiTwoCoins 已在上方登記，這裡不重複——
  //     重複的鍵在物件字面量裡是合法的，後者會靜默蓋掉前者（test:ui 有護欄擋這件事）。
  GiUpCard,
  GiScrollUnfurled,
  GiChest,
  GiHealthNormal,
  GiLightningTear,
  GiBackpack,
  GiSparkles,
  GiProgression,
  GiTrophyCup,
  GiQuillInk,
  GiPadlock,
  GiHeartShield,
  GiPocketWatch,
  GiCampfire,
  // 2026-10-31：擲骰留痕（`LOG_KINDS.dice`）。跑團最高頻的動作原本完全不在履歷裡，
  // 圖示也一起沒登記——只加 kind 不加這裡，履歷上那一列就沒有圖。
  GiRollingDices,

  // Equipment Items (裝備設計器逐項對照；由 equipmentRules.js 的 EQUIPMENT_ICONS 指定元件名)
  GiSpellBook,
  GiPocketBow,
  GiFlail,
  GiBroadsword,
  GiShuriken,
  GiSpears,
  GiMusket,
  GiBrassKnuckles,
  GiSacrificialDagger,
  GiRevolver,
  GiFlatHammer,
  GiBatteredAxe,
  GiBattleAxe,
  GiGlaive,
  GiBarbedSpear,
  GiGladius,
  GiSwitchblade,
  GiPunch,
  GiWoodClub,
  GiSling,
  GiDragonShield,
  GiClothes,
  GiShirt,
  GiPirateCoat,
  GiNinjaArmor,
  GiRobe,
  GiChainMail,
  GiLeatherArmor,
  GiHeartArmor,
  GiLamellar
};

/**
 * GameIcon component for rendering Game-Icons.net icons.
 * Supports passing archetype keys ('alchemist'), class names ('守護者'),
 * UI keys ('hp', 'mp', 'zenit'), or bond feelings ('admiration', 'loyalty').
 */
export default function GameIcon({ name, className = '', size = 18, ...props }) {
  if (!name) return null;
  const cleanName = String(name).trim();
  const IconComp = GAME_ICONS_MAP[cleanName]
    || GAME_ICONS_MAP[cleanName.replace(/【.*?】/g, '')]
    || GAME_ICONS_MAP[cleanName.toLowerCase()];

  if (!IconComp) {
    // Fallback icon to prevent crash
    return <GiSparkles className={`inline-block shrink-0 ${className}`} size={size} {...props} />;
  }

  return <IconComp className={`inline-block shrink-0 ${className}`} size={size} {...props} />;
}
