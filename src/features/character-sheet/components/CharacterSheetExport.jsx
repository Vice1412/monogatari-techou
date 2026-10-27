import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import { GiScrollUnfurled, GiCheckMark } from 'react-icons/gi';
import JRPGButton from '../../../components/ui/JRPGButton';
import GameIcon from '../../../components/ui/GameIcon';
import rulesData from '../data/rulesData.json';
import SkillDescription from '../utils/skillFormulaEvaluator';
import iconFontUrl from '../../../assets/FabulaUltimaIcons-Regular.otf';
import { calculateCharacterStats, getProficiencies, getCharacterLevel, HEROIC_SKILLS, describeFreeBenefit, describeQuirkChoice } from '../utils/characterEngine';
import { withHrBonus } from '../utils/equipmentRules';
import { ATTRIBUTE_NAMES } from '../data/sourcebookConfig';
import { buildCustomWeaponEntries } from '../data/customWeapons';
import { resolveHeroicSkillEffect } from '../data/theriomorphosisVariant';
import { getCharacterTheme } from '../utils/characterThemes';
import { isInitiativeVariant } from '../data/initiativeVariant';
import {
  CAMP_ACTIVITY_SOURCE,
  campActivityAccess,
  campActivityById,
  campActivityTargetLabel,
  normalizeCampActivities
} from '../data/campActivities';
import { buildImagePdf, dataUrlToBytes } from '../utils/pdfWriter';

/**
 * 官方角色卡三頁匯出 (Official Sheet Export)
 *
 * 依 `Fabula-Ultima-Character-Sheet.pdf`（官方三頁橫向 A4 表格）的**版面**重繪，
 * 內容全部換成本專案這張卡的實際資料：
 *   P1 主卡：姓名／特質／羈絆／物語點／經驗點／先攻與防禦／裝備／行囊／資金
 *           ｜肖像／四維與狀態／HP·MP·IP／職業×3
 *   P2 續頁：其他職業×4／英雄技能 ｜ 奧祕與咒語×7／儀式學派
 *   P3 續頁：奧祕與咒語×14／儀式學派
 *
 * 幾個刻意的決定：
 * 1. **版面照官方，文字用中文。** 依 `GEMINI.md` 規則三（純中文顯示鐵律），
 *    欄位標題一律中文；官方原表是英文，但本專案不是英文介面。
 * 2. **配色照官方**（深青綠標題條 ＋ 淺灰欄位底 ＋ 白底）。這是「印出來的文件」，
 *    不是應用程式介面，所以不套羊皮紙色系。
 * 3. **物語點／經驗點框裡印的是官方原表自己印的那段規則文字**，
 *    來源就是這張官方表格（不是憑記憶編的）；中文用本專案的既有定譯
 *    （物語點／反派／大失敗／羈絆強度／終結點／特質）。
 * 4. **儀式學派的勾選是資料推導的**：角色實際持有的技能名稱裡若含某學派名
 *    （例如「元素學派儀式」），就勾該學派——不是靠「哪個職業對應哪個學派」的記憶。
 * 5. 版面固定 1123×794 px（A4 橫向 @96dpi），與官方 842×595 pt 等比。
 *
 * `buildSheetModel` 是純函式：所有欄位對應都在那裡，測試直接驗它，
 * 不必渲染整張表。
 */

/** A4 橫向 @96dpi（官方為 842×595 pt） */
export const SHEET_PAGE_WIDTH = 1123;
export const SHEET_PAGE_HEIGHT = 794;

/**
 * 三頁表格的配色。
 *
 * **樣式照站內設計，不照官方表的青綠色**（使用者裁定）：
 * 官方表是深青綠標題條＋灰白欄位，那是「別人家的文件」；
 * 這張表是《物語手帳》印出來的東西，所以用站內的羊皮紙色系，
 * 標題條取**該角色自己的主題色**（跟畫面上的卡片一致）。
 *
 * 用 CSS 變數而不是把調色盤傳進每個子元件：三頁裡有十幾個小元件，
 * 逐一傳 prop 只為了換顏色並不值得；變數掛在最外層，`html-to-image`
 * 取 computed style 時會拿到解析後的值，所以複製出去的節點一樣正確。
 */
export const sheetVars = (theme = null) => {
  /* 第三十七輪（§CI45）：這裡原本每一個變數都掛著 `|| '#hex'` 的保險。
   * 那是全站唯一**真的會被取用**的一組——匯出頁可以沒有角色主題（`theme` 為 null），
   * 而畫布必須有具體的紙色，`undefined` 會匯出一張沒有底色的圖。
   *
   * 所以修法不是「拿掉保險」，是「把保險換成具名來源」：
   * 沒有主題時就用站內預設主題（`getCharacterTheme(null)` → amber），
   * 於是紙、墨、邊界仍然只有一個答案，而那個答案是**主題表**，不是這支檔案裡的字面值。
   *
   * 順帶修掉一個不一致：原本 `--sh-ink` 的保險是 `#3c2415`，但主題真正的
   * `textDark` 是 `#2c221e`——也就是說「有主題」和「沒主題」的墨是兩個顏色。
   * 現在兩條路都走主題表。 */
  const t = theme || getCharacterTheme(null);
  return {
    // 頁面底色用主題的「頁面底」（比卡片深一階），卡片用主題的「卡片底」——
    // 這樣才會有站內那種「淡色底 ＋ 白卡片」的層次；兩者同色的話框線會整個消失。
    '--sh-bg': t.sheetBg || t.appBg,
    '--sh-box': t.cardBg,
    '--sh-bar': t.accent,
    '--sh-bar-ink': t.cardBg,
    '--sh-border': t.border,
    '--sh-soft': t.subpanelBg,
    '--sh-ink': t.textDark,
    '--sh-faint': t.textMuted,
  };
};

const C = {
  bar: 'var(--sh-bar)',
  barText: 'var(--sh-bar-ink)',
  border: 'var(--sh-border)',
  soft: 'var(--sh-soft)',
  box: 'var(--sh-box)',
  ink: 'var(--sh-ink)',
  faint: 'var(--sh-faint)'
};

/**
 * 匯出頁的字級階梯（第三十九輪 §CI47）。
 *
 * ## 為什麼匯出頁需要自己的一套
 *
 * 螢幕的型階梯是 `t10`–`t39`（10/11/12/14/16/20/25/31/39），最低階就是 10px。
 * 匯出頁是一張 **1123×794 的固定畫布**，要塞進三頁角色的全部技能、裝備、
 * 關係與日誌——技能描述動輒兩三百字。用 10px 排版一定溢出，而溢出在
 * `overflow: hidden` 的畫布上等於**內容直接被裁掉**，不是「醜一點」。
 *
 * 所以匯出頁的字級不是漂移，是**另一條真實存在的階梯**。問題是它從來沒有名字：
 * 49 處 `fontSize: 'Npx'` 散在檔案各處，11 個不同值（含 13 處半像素），
 * 而 `H33`（全站零任意字級）只認得 `text-[13px]` 這個**形狀**——
 * 換成行內樣式就完全繞過去了。
 *
 * ## 這條階梯長什麼樣
 *
 * `7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 16`——8 到 14 是 **1px 的線性階梯**，
 * 這是密集表格的常見做法（步距 7–12%，比模組化比例更適合「同一頁塞很多層」）。
 * 剛好也是 **9 階**，與螢幕型階梯同數。
 *
 * ## 半像素為什麼要收掉
 *
 * 原本有 7.5／8.5／9.5 三個半像素值，共 13 處。它們**不是層級，是雜訊**：
 *
 * - 8px → 8.5px 是 **6.3%**，而螢幕階梯最小的步距是 10px → 11px ＝ **10%**。
 *   也就是說這半步比設計系統自己允許的最小步距還小一半——它不構成可辨的層級。
 * - `html-to-image` 光柵化時，小數字級在不同 DPR 下的捨入方向不一致，
 *   同一張表在不同機器上可能一行高一px。
 *
 * 一律**向下取整**（7.5→7、8.5→8、9.5→9），理由是版面安全：
 * 固定畫布上「變小」不會溢出，「變大」會。副作用正好是把 CSS 裡
 * `.sheet-skill-desc` 的 7px 收進同一條階梯，CSS 與 JS 不再是兩套。
 */
const T = {
  s7: '7px', // 技能描述全文（最窄的一欄，也是 CSS `.sheet-skill-desc` 的值）
  s8: '8px', // 表格內最小字：勾選格、情緒格、註記
  s9: '9px', // 欄位標籤（粗體 ＋ 字距）、格線內文
  s10: '10px', // 一般值、說明文字
  s11: '11px', // 區塊標題條
  s12: '12px', // 資源池數值
  s13: '13px', // 角色名、主值
  s14: '14px', // 先攻表頭
  s16: '16px' // 禪特——整頁最大的數字
};

const S = {
  page: {
    width: SHEET_PAGE_WIDTH,
    height: SHEET_PAGE_HEIGHT,
    backgroundColor: C.box,
    color: C.ink,
    padding: '16px 18px',
    boxSizing: 'border-box',
    display: 'flex',
    gap: '16px',
    fontFamily: '"Segoe UI", "Microsoft JhengHei", "Noto Sans TC", sans-serif',
    overflow: 'hidden'
  },
  col: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 },
  box: {
    border: `1px solid ${C.border}`,
    borderRadius: '2px',
    overflow: 'hidden',
    backgroundColor: C.box
  },
  bar: {
    backgroundColor: C.bar,
    color: C.barText,
    fontSize: T.s11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    padding: '2px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  barNote: { fontSize: T.s8, fontWeight: 400, opacity: 0.92 },
  body: { padding: '4px 7px' },
  label: { fontSize: T.s9, fontWeight: 700, color: C.ink, letterSpacing: '0.04em' },
  value: { fontSize: T.s10, color: C.ink },
  faint: { fontSize: T.s8, color: C.faint },
  line: { borderBottom: `1px solid ${C.border}`, minHeight: '14px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' },
  cell: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: T.s9 },
  tableHead: {
    display: 'grid',
    fontSize: T.s8,
    fontWeight: 700,
    color: C.faint,
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${C.border}`,
    paddingBottom: '2px'
  }
};

const Check = ({ on }) => (
  <span
    style={{
      width: '10px',
      height: '10px',
      border: `1px solid ${C.ink}`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: T.s9,
      lineHeight: 1,
      flex: '0 0 auto',
      backgroundColor: on ? C.ink : C.box,
      color: on ? C.barText : 'transparent'
    }}
  >
    {on ? '✓' : ''}
  </span>
);

const Line = ({ children, grow = false }) => (
  <span style={{ ...S.line, flex: grow ? '1 1 auto' : '0 0 auto', minWidth: grow ? 0 : '60px' }}>
    <span style={S.value}>{children || ''}</span>
  </span>
);

const Box = ({ title, note, children, style, bodyStyle }) => (
  <div style={{ ...S.box, ...style }}>
    <div style={S.bar}>
      <span>{title}</span>
      {note ? <span style={S.barNote}>{note}</span> : null}
    </div>
    <div style={{ ...S.body, ...bodyStyle }}>{children}</div>
  </div>
);

/** 官方原表 P1 印的物語點規則（中文用本專案既有定譯） */
export const FABULA_POINT_RULES = Object.freeze([
  '場景開始時若你沒有任何物語點，獲得 1 點。',
  '反派登場時，獲得 1 點。',
  '你在大失敗時，獲得 1 點。',
  '你在 0 HP 時投降，獲得 2 點。',
  '執行檢定後花費 1 點，觸發一項特質，重擲一顆或兩顆骰子（大失敗時不能）。',
  '執行檢定後花費 1 點，觸發一項羈絆，將其強度加到結果上（每次檢定一次）。',
  '花費 1 點來改變故事；若要改動既有的設定，需取得引入該設定者的同意。'
]);

/** 官方原表 P1 印的經驗點規則 */
export const EXPERIENCE_POINT_RULES = Object.freeze([
  '每次聚會結束時，你自動獲得 5 點經驗值。然後：',
  '獲得等同於【團隊花費的物語點 × 玩家角色人數】的經驗值。',
  '獲得等同於【反派花費的終結點】的經驗值。',
  '最後，若你有 10 點以上經驗值，失去 10 點並提升 1 級。'
]);

/** 儀式六學派（取自本專案技能名稱所用的學派詞） */
export const SHEET_DISCIPLINES = Object.freeze([
  '秘儀學派', '嵌合學派', '元素學派', '熵系學派', '靈魂學派', '儀式學派'
]);

const FEELINGS = Object.freeze([
  ['admiration', '欽佩'],
  ['inferiority', '自卑'],
  ['loyalty', '忠誠'],
  ['mistrust', '不信任'],
  ['affection', '親愛'],
  ['hatred', '憎恨']
]);

const ATTRIBUTES = Object.freeze([
  ['dex', 'DEX', ATTRIBUTE_NAMES.dex],
  ['ins', 'INS', ATTRIBUTE_NAMES.ins],
  ['mig', 'MIG', ATTRIBUTE_NAMES.mig],
  ['wlp', 'WLP', ATTRIBUTE_NAMES.wlp]
]);

/** 引擎算出來的「當前骰階」欄位名（狀態減值只影響這裡） */
const CURRENT_ATTR_KEYS = Object.freeze({
  dex: 'currentDex',
  ins: 'currentIns',
  mig: 'currentMig',
  wlp: 'currentWlp'
});

const STATUSES = Object.freeze([
  ['slow', '緩慢'],
  ['dazed', '眩暈'],
  ['weak', '虛弱'],
  ['poisoned', '中毒'],
  ['shaken', '動搖'],
  ['enraged', '憤怒']
]);

const EQUIP_SLOTS = Object.freeze([
  ['accessory', '配件'],
  ['armor', '防具'],
  ['mainHand', '主手'],
  ['offHand', '副手']
]);

/** 空插槽（官方表就是留空格給手寫） */
const blanks = (n) => Array.from({ length: n }, () => null);

/**
 * 把角色資料整理成三頁要用的欄位。純函式，不碰 DOM。
 */
export const buildSheetModel = (character, stats = null) => {
  const ch = character || {};
  const s = stats || calculateCharacterStats(ch);
  const profs = getProficiencies(ch);
  const equipment = ch.equipment || {};

  const resolve = (cur, max) => (cur === null || cur === undefined ? max : cur);

  // 羈絆：固定 6 格，把 feelings 轉成勾選狀態
  const bonds = blanks(6).map((_, i) => {
    const bond = (ch.bonds || [])[i];
    return {
      index: i + 1,
      target: bond?.target || '',
      feelings: FEELINGS.reduce((acc, [key]) => {
        acc[key] = Boolean(bond?.feelings?.includes(key));
        return acc;
      }, {})
    };
  });

  // 裝備：四列，各自帶規則書上的說明
  // 官方武器表找不到時，改找**這個角色自己鍛造的定制武器**（HF p.106）。
  // 沒有這一行的話，主手是定制武器時裝備列只會印出一個光禿禿的名字、說明全空。
  const ownCustomWeapons = buildCustomWeaponEntries(ch);
  const findWeapon = (n) => rulesData.equipment.weapons.find((w) => w.name === n)
    || ownCustomWeapons.find((w) => w.name === n);
  const findShield = (n) => rulesData.equipment.shields.find((x) => x.name === n);
  const findArmor = (n) => rulesData.equipment.armors.find((x) => x.name === n);
  const findAccessory = (n) => rulesData.equipment.accessories.find((x) => x.name === n);
  const describe = (item) => {
    if (!item) return '';
    // 定制武器的「物防提升＝視為裝備盾牌」「迅捷＝打兩次」「可變形＝切換型態」
    // 是數字看不出來的規則，跑團時要查得到，所以跟著裝備列一起印。
    const effects = item.isCustomWeapon && item.note ? ` ｜ ${item.note}` : '';
    // 徒手打擊要把【空手道】的加成算進去（F-024，2026-10-27）。
    // 不處理的話，列印卡印「HR + 0」而跑團面板顯示「+6」——同一張角色卡兩個數字，
    // 正是 F-024 那一類「印出來的和算出來的不一致」。
    const damage = item.name === '徒手打擊'
      ? withHrBonus(item.damage, s.quirkEffects?.unarmedDamageBonus || 0)
      : item.damage;
    if (item.damage) return `${item.attr} ｜ ${damage} ｜ ${item.range}${effects}`;
    return item.desc || '';
  };
  const equipmentRows = EQUIP_SLOTS.map(([slot, label]) => {
    const name = equipment[slot] || '';
    const item = slot === 'armor'
      ? findArmor(name)
      : (slot === 'accessory' ? findAccessory(name) : (findShield(name) || findWeapon(name)));
    return { slot, label, name: item ? item.name : name, desc: describe(item) };
  });

  // 技能名稱裡含學派名 → 該學派打勾（資料推導，不靠職業對應的記憶）
  const skillNames = (ch.classes || []).flatMap((cl) => (cl.skills || []).map((sk) => sk.name));
  const disciplines = SHEET_DISCIPLINES.map((name) => ({
    name,
    on: skillNames.some((sn) => sn.includes(name))
  }));

  // 咒語：官方表的每一列是 名稱／MP／目標／持續時間 ＋ 說明
  const spellRows = (ch.spells || []).map((sp) => ({
    name: sp.name || '',
    mp: sp.mp || '',
    targets: sp.target || sp.targets || '',
    duration: sp.duration || '',
    desc: sp.desc || sp.effect || ''
  }));

  // 職業與技能：**帶效果全文**（使用者要的是「丟進 TTS 給玩家隨時查」，不能只有技能名）
  const classes = (ch.classes || []).map((cl) => {
    const classDef = rulesData.classes?.[cl.className];
    return {
      className: cl.className,
      level: cl.level || 0,
      // F-018（2026-10-27）：原本這裡比小寫 `'mp'`／`'hp'`，而 UI 寫的是大寫，
      // 於是 `freeBenefit` 永遠是空字串——**列印卡上 29 個職業的免費增益全部消失**
      // （不只二選一那 6 個）。改吃 `describeFreeBenefit`，二選一印玩家選到的那一邊，
      // 其餘職業印資料層原文。
      freeBenefit: describeFreeBenefit(classDef, cl),
      skills: (cl.skills || []).map((sk) => {
        const skillDef = (classDef?.skills || []).find((s) => s.name === sk.name);
        return {
          name: sk.name,
          sl: sk.sl,
          maxSL: skillDef?.maxSL || 0,
          desc: skillDef?.desc || ''
        };
      })
    };
  });

  return {
    name: ch.name || '',
    // 用角色自己的等級，不是職業等級的總和——兩者漂移時以前會顯示不同的數字
    level: getCharacterLevel(ch),
    // 官方角色卡上與姓名並排的那一格是「稱呼」；本專案依使用者裁定改為性別。
    //
    // 角色背景**不在三頁匯出裡**：三頁是固定 1123×794 的官方表格複刻，
    // 2026-10-06 實測六個欄位的餘裕都只有 0～4px，塞不下任何新的敘事區塊
    // （硬加一個背景框會讓 P1 的每個框各被裁掉一行，而且是靜默裁掉）。
    // 它顯示在編輯器分頁 6 與角色卡（CharacterCard，不限高）。
    gender: ch.gender || '',
    identity: ch.identity || '',
    theme: ch.theme || '',
    origin: ch.origin || '',
    bonds,
    fabulaPoints: ch.fabulaPoints ?? 3,
    exp: ch.exp || 0,
    zenit: ch.zenit || 0,
    initiative: s.init ?? 0,
    // 先攻變體（公測 p.34）：三頁表格上的「先攻修正」印「不計」而不是 0——
    // 0 是「算出來剛好 0」，這兩件事在桌上不一樣。
    initiativeVariant: isInitiativeVariant(ch),
    defense: s.def ?? 0,
    magicDefense: s.mdef ?? 0,
    crisisThreshold: s.crisisThreshold ?? 0,
    // 四維還沒指派完 → 六項數值不成立（見 calculateCharacterStats 的 attributesUnset）。
    // 三頁表格照樣可以預覽，但數值欄位印「—」而不是拿 0 算出來的假數字。
    attributesUnset: Boolean(s.attributesUnset),
    proficiencies: profs,
    equipmentRows,
    backpackNotes: ch.backpackNotes || '',
    avatar: ch.avatar || null,
    attributes: {
      base: ATTRIBUTES.map(([key, en, cn]) => ({ key, en, cn, value: ch.attributes?.[key] || 0 })),
      current: ATTRIBUTES.map(([key, en, cn]) => ({
        key,
        en,
        cn,
        value: s[CURRENT_ATTR_KEYS[key]] ?? (ch.attributes?.[key] || 0)
      }))
    },
    statuses: STATUSES.map(([key, cn]) => ({ key, cn, on: Boolean(ch.statusAfflictions?.[key]) })),
    pools: {
      hp: { max: s.maxHp ?? 0, current: resolve(ch.currentHp, s.maxHp ?? 0) },
      mp: { max: s.maxMp ?? 0, current: resolve(ch.currentMp, s.maxMp ?? 0) },
      ip: { max: s.maxIp ?? 0, current: resolve(ch.currentIp, s.maxIp ?? 0) }
    },
    classes,
    page1Classes: classes.slice(0, 3),
    otherClasses: classes.slice(3, 7),
    // 英雄技能也帶效果全文（同樣是為了「丟進 TTS 給玩家查」）
    heroicSkills: (ch.heroicSkills || []).map((h) => {
      const name = typeof h === 'string' ? h : h.name;
      const sl = typeof h === 'string' ? null : h.sl;
      const def = HEROIC_SKILLS.find((x) => x.name === name);
      return {
        name,
        sl,
        requirement: def?.requirement || '',
        // 選了混合變形變體（公測 p.40）時，【進階混合變形】的文本要換成變體版本。
        effect: resolveHeroicSkillEffect(name, def?.effect || '', ch)
      };
    }),
    spells: spellRows,
    page2Spells: spellRows.slice(0, 7),
    page3Spells: spellRows.slice(7, 21),
    disciplines,
    quirk: ch.quirk && ch.quirk !== '無' ? ch.quirk : '',
    // 營地活動（自然奇幻手冊 p.130–133）：表上只印「選了哪幾種＋目標」，
    // 規則全文與 1d6 表格留在跑團面板（那張表在紙上會把 P2 擠爆）。
    // 規則沒開、金手指也沒給 → 空陣列，整格不出現（舊角色不受影響）。
    campActivities: (() => {
      if (!campActivityAccess(ch).enabled) return [];
      return normalizeCampActivities(ch.campActivities).picked
        .map((id) => campActivityById(id))
        .filter(Boolean)
        .map((a) => ({ id: a.id, name: a.name, target: campActivityTargetLabel(a) }));
    })(),
    // 金手指的效果全文（表上原本只有名字，等於什麼都沒說）
    quirkDesc: (() => {
      const name = ch.quirk && ch.quirk !== '無' ? ch.quirk : '';
      if (!name) return '';
      return (rulesData.quirks || []).find((x) => x.name === name)?.desc || '';
    })(),
    // 金手指「你選了什麼」（F-027，2026-10-27）：原文寫「選擇一項…」，紙上卻只有原文。
    // 與編輯器的金手指選擇器吃同一份 `quirkChoice`，不另算一套。
    quirkChoice: describeQuirkChoice(ch),
    // 金手指相性（F-023）：紙卡原本只有規則原文，玩家印出來就不知道自己是免疫什麼、怕什麼。
    // 與編輯器第 4 頁、跑團面板吃的是同一份 stats.quirkEffects，不另算一套。
    quirkAffinities: (() => {
      const name = ch.quirk && ch.quirk !== '無' ? ch.quirk : '';
      if (!name) return [];
      const fx = s.quirkEffects || {};
      return [
        { label: '傷害免疫', values: fx.immuneDamage || [], danger: false },
        { label: '抗性', values: fx.resistances || [], danger: false },
        { label: '易傷', values: fx.vulnerabilities || [], danger: true },
        { label: '吸收', values: fx.absorption || [], danger: false },
        { label: '狀態免疫', values: fx.immuneStatuses || [], danger: false }
      ].filter((row) => row.values.length > 0);
    })()
  };
};

// ───────────────────────────────────────── 共用小區塊

const NameHeader = ({ model, full = false }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '4px' }}>
    <span style={{ ...S.label, fontSize: T.s10 }}>姓名</span>
    <span style={{ ...S.line, flex: '1 1 auto', minWidth: 0, fontSize: T.s13, fontWeight: 700 }}>
      {model.name}
    </span>
    {!full && (
      <>
        <span style={{ ...S.label, fontSize: T.s10, marginLeft: '8px' }}>性別</span>
        <span style={{ ...S.line, flex: '0 0 120px' }}>{model.gender}</span>
      </>
    )}
  </div>
);

const TraitsBox = ({ model }) => (
  <Box title="特質">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ ...S.label, flex: '0 0 34px' }}>身分</span>
        <Line grow>{model.identity}</Line>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ ...S.label, flex: '0 0 34px' }}>主題</span>
        <Line grow>{model.theme}</Line>
        <span style={{ ...S.label, flex: '0 0 34px' }}>出身</span>
        <Line grow>{model.origin}</Line>
      </div>
    </div>
  </Box>
);

const BondsBox = ({ model }) => (
  <Box title="羈絆">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
      {model.bonds.map((bond) => (
        <div key={bond.index} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ ...S.faint, width: '8px' }}>{bond.index}</span>
          <span style={{ ...S.line, flex: '0 0 74px', fontSize: T.s9 }}>{bond.target}</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', flex: '1 1 auto' }}>
            {FEELINGS.map(([key, cn]) => (
              <span key={key} style={{ ...S.cell, fontSize: T.s8, gap: '2px' }}>
                <Check on={bond.feelings[key]} />
                {cn}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  </Box>
);

const RulesList = ({ lines }) => (
  <ul style={{ margin: 0, paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '1.5px' }}>
    {lines.map((t) => (
      <li key={t} style={{ fontSize: T.s7, lineHeight: 1.22 }}>{t}</li>
    ))}
  </ul>
);

const ClassSlot = ({ slot }) => (
  <div style={{ ...S.box, display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: '104px' }}>
    {/* 標題列與數值列合併成一列——固定版面裡每一列都很貴，省下來給技能效果 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: `1px solid ${C.border}`, padding: '2px 6px' }}>
      <span style={{ fontSize: T.s11, fontWeight: 700 }}>
        {slot ? `${slot.className}　Lv ${slot.level}` : ''}
      </span>
      {slot?.freeBenefit ? (
        <span style={{ marginLeft: 'auto', fontSize: T.s8, color: C.faint }}>
          免費增益：{slot.freeBenefit}
        </span>
      ) : null}
    </div>
    <div style={{ flex: '1 1 auto', padding: '2px 6px', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {(slot?.skills || []).map((sk) => (
          <div key={sk.name}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: T.s9, fontWeight: 700 }}>{sk.name}</span>
              <span style={{ fontSize: T.s8, color: C.faint }}>
                SL {sk.sl}{sk.maxSL ? ` / ${sk.maxSL}` : ''}
              </span>
            </div>
            {/* 效果全文：使用者要的是「丟進 TTS 給玩家隨時查」，所以不能只有技能名 */}
            {sk.desc ? (
              <SkillDescription desc={sk.desc} sl={sk.sl} className="sheet-skill-desc" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SpellTable = ({ rows, count }) => {
  const filled = rows.length > 0 ? rows : [];
  const blanksNeeded = Math.max(0, count - filled.length);
  const cols = '1.6fr 0.45fr 1fr 0.85fr';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
      {/* 官方表只有一列標題，不是每一條咒語都重印一次 */}
      <div style={{ ...S.tableHead, gridTemplateColumns: cols }}>
        <span>名稱</span><span>MP</span><span>目標</span><span>持續時間</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
        {filled.map((sp) => (
          <div key={sp.name} style={{ borderBottom: `1px solid ${C.border}`, padding: '2px 0 3px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, fontSize: T.s9, fontWeight: 700 }}>
              <span>{sp.name}</span><span>{sp.mp}</span><span>{sp.targets}</span><span>{sp.duration}</span>
            </div>
            {sp.desc ? (
              <div style={{ fontSize: T.s8, lineHeight: 1.3, color: C.ink, whiteSpace: 'pre-wrap' }}>{sp.desc}</div>
            ) : null}
          </div>
        ))}
        {Array.from({ length: blanksNeeded }).map((_, i) => (
          <div
            key={`blank-${i}`}
            style={{
              borderBottom: `1px solid ${C.border}`,
              flex: '1 1 auto',
              minHeight: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              padding: '2px 0'
            }}
          >
            <div style={{ height: '13px', backgroundColor: C.soft, borderRadius: '2px' }} />
            <div style={{ flex: '1 1 auto', backgroundColor: C.box, borderRadius: '2px' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

const RitualBox = ({ model }) => (
  <Box title="儀式">
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ ...S.label }}>學派：</span>
      {model.disciplines.map((d) => (
        <span key={d.name} style={{ ...S.cell, fontSize: T.s9 }}>
          <Check on={d.on} />
          {d.name}
        </span>
      ))}
    </div>
  </Box>
);

// ───────────────────────────────────────── 三頁

export const OfficialSheetPage1 = ({ model, vars = null }) => (
  <div style={{ ...S.page, ...vars }} data-sheet-page="1">
    {/* 左欄 */}
    <div style={{ ...S.col, flex: '0 0 528px' }}>
      <NameHeader model={model} />
      <TraitsBox model={model} />
      <BondsBox model={model} />

      <Box title="物語點" note={`目前：${model.fabulaPoints}`}>
        <RulesList lines={FABULA_POINT_RULES} />
      </Box>

      <div style={{ display: 'flex', gap: '7px', alignItems: 'stretch' }}>
        <Box title="經驗點" note={`目前：${model.exp}`} style={{ flex: '1 1 60%' }}>
          <RulesList lines={EXPERIENCE_POINT_RULES} />
        </Box>
        <div style={{ ...S.box, flex: '1 1 40%' }}>
          <div style={S.bar}><span>先攻修正</span></div>
          <div style={{ padding: '4px 8px', fontSize: T.s14, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>
            {model.attributesUnset ? (
              <span style={{ fontSize: T.s14, fontWeight: 700 }}>—</span>
            ) : (model.initiativeVariant ? '不計' : model.initiative)}
          </div>
          <div style={S.bar}><span>物防</span></div>
          <div style={{ padding: '4px 8px', fontSize: T.s14, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>
            {model.attributesUnset ? '—' : model.defense}
          </div>
          <div style={S.bar}><span>魔防</span></div>
          <div style={{ padding: '4px 8px', fontSize: T.s14, fontWeight: 700 }}>
            {model.attributesUnset ? '—' : model.magicDefense}
          </div>
        </div>
      </div>

      <Box
        title="裝備"
        note="可裝備："
        style={{ flex: '1 1 auto' }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '5px' }}>
          {[['martialArmor', '職業防具'], ['martialShields', '職業盾牌'], ['martialMelee', '職業近戰武器'], ['martialRanged', '職業遠程武器']]
            .map(([key, cn]) => (
              <span key={key} style={{ ...S.cell, fontSize: T.s9 }}>
                <Check on={Boolean(model.proficiencies[key])} />
                {cn}
              </span>
            ))}
        </div>
        <div style={{ ...S.tableHead, gridTemplateColumns: '120px 1fr', marginBottom: '2px' }}>
          <span>已裝備項目</span><span>說明</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {model.equipmentRows.map((row) => (
            <div
              key={row.slot}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                borderTop: `1px solid ${C.border}`,
                padding: '2px 0',
                alignItems: 'start'
              }}
            >
              <div>
                <div style={{ ...S.faint, fontSize: T.s7 }}>{row.label}</div>
                <div style={{ fontSize: T.s10, fontWeight: 700 }}>{row.name}</div>
              </div>
              <div style={{ fontSize: T.s8, lineHeight: 1.3 }}>{row.desc}</div>
            </div>
          ))}
        </div>
      </Box>

      <div style={{ display: 'flex', gap: '7px', alignItems: 'stretch' }}>
        <Box title="行囊與筆記" style={{ flex: '1 1 auto' }}>
          <div style={{ fontSize: T.s9, lineHeight: 1.35, whiteSpace: 'pre-wrap', minHeight: '44px' }}>
            {model.backpackNotes}
          </div>
        </Box>
        <div style={{ ...S.box, flex: '0 0 120px' }}>
          <div style={S.bar}><span>資金</span></div>
          <div style={{ padding: '8px', textAlign: 'center', fontSize: T.s16, fontWeight: 700 }}>
            {model.zenit}<span style={{ fontSize: T.s10 }}> z</span>
          </div>
        </div>
      </div>
    </div>

    {/* 右欄 */}
    <div style={{ ...S.col, flex: '1 1 auto' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <div
          style={{
            ...S.box,
            flex: '0 0 132px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '120px'
          }}
        >
          {model.avatar && (model.avatar.startsWith('http') || model.avatar.startsWith('data:')) ? (
            <img src={model.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : model.avatar ? (
            <GameIcon name={model.avatar} size={72} style={{ color: C.bar }} />
          ) : (
            <span style={S.faint}>肖像</span>
          )}
        </div>

        {/* 四維／狀態／三項資源合成一格：固定版面裡「一個標題條 ＋ 一格間距」很貴，
            合併後直接讓出三十幾像素給下面的技能效果全文。 */}
        <Box title="屬性・狀態・資源" style={{ flex: '1 1 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', ...S.faint, fontSize: T.s8 }}>
              <span /><span>基礎</span><span>當前</span>
            </div>
            {model.attributes.base.map((a, i) => (
              <div key={a.key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', alignItems: 'center' }}>
                <span style={{ fontSize: T.s9, fontWeight: 700 }}>{a.cn} {a.en}</span>
                <span style={{ fontSize: T.s11, fontWeight: 700 }}>{model.attributesUnset ? '—' : `d${a.value}`}</span>
                <span style={{ fontSize: T.s11, fontWeight: 700 }}>
                  {model.attributesUnset ? '—' : `d${model.attributes.current[i].value}`}
                </span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px 6px', marginTop: '2px' }}>
              {model.statuses.map((st) => (
                <span key={st.key} style={{ ...S.cell, fontSize: T.s8 }}>
                  <Check on={st.on} />
                  {st.cn}
                </span>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '3px', paddingTop: '3px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr', gap: '1px 8px', alignItems: 'center' }}>
                <span />
                <span style={{ ...S.faint, fontSize: T.s8 }}>上限</span>
                <span style={{ ...S.faint, fontSize: T.s8 }}>當前</span>
                {[['hp', 'HP', '生命值'], ['mp', 'MP', '魔力值'], ['ip', 'IP', '物品點']].map(([key, en, cn]) => (
                  <React.Fragment key={key}>
                    <span style={{ fontSize: T.s10, fontWeight: 700 }}>{en}</span>
              <span style={{ fontSize: T.s12, fontWeight: 700 }}>{model.attributesUnset ? '—' : model.pools[key].max}</span>
              <span style={{ fontSize: T.s13, fontWeight: 700 }}>
                {model.attributesUnset ? '—' : model.pools[key].current}
                {key === 'hp' && !model.attributesUnset ? (
                  <span style={{ ...S.faint, fontSize: T.s8, marginLeft: '6px' }}>
                    危機 {model.crisisThreshold}
                  </span>
                ) : null}
              </span>
            </React.Fragment>
          ))}
              </div>
            </div>
          </div>
        </Box>
      </div>

      <Box
        title="角色等級"
        note={`Lv ${model.level}`}
        style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 auto' }}>
          {blanks(3).map((_, i) => (
            <ClassSlot key={i} slot={model.page1Classes[i]} />
          ))}
        </div>
      </Box>
    </div>
  </div>
);

export const OfficialSheetPage2 = ({ model, vars = null }) => (
  <div style={{ ...S.page, ...vars }} data-sheet-page="2">
    <div style={{ ...S.col, flex: '0 0 528px' }}>
      <NameHeader model={model} full />
      <Box
        title="其他職業"
        note="最多 3 個未精通職業"
        style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 auto' }}>
          {blanks(4).map((_, i) => (
            <ClassSlot key={i} slot={model.otherClasses[i]} />
          ))}
        </div>
      </Box>
      {/* 金手指：原本只有名字（等於什麼都沒說），改成連效果一起印。
          放 P2 是因為 P1 的左欄已經滿了，而且金手指的效果文字本來就長。 */}
      {model.quirk ? (
        <Box title="金手指" style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: T.s10, fontWeight: 700, marginBottom: '1px' }}>{model.quirk}</div>
          {model.quirkDesc ? (
            <SkillDescription desc={model.quirkDesc} sl={1} className="sheet-skill-desc" />
          ) : null}
          {/* F-027：原文寫「選擇一項…」時，紙上要印出你選了哪一個。
              沒選過就整行不出現（舊角色不受影響）。 */}
          {model.quirkChoice.length ? (
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '1px 8px', marginTop: '2px' }}
              data-testid="sheet-quirk-choice"
            >
              {model.quirkChoice.map((row, i) => (
                <span key={`${row.group}-${row.label}-${i}`} style={{ fontSize: T.s9 }}>
                  <span style={{ fontWeight: 700, color: C.faint }}>{row.group ? `${row.group}　` : '已選　'}</span>
                  <span style={{ fontWeight: 700, color: C.ink }}>{row.label}</span>
                </span>
              ))}
            </div>
          ) : null}
          {model.quirkAffinities.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px 8px', marginTop: '2px' }}>
              {model.quirkAffinities.map((row) => (
                <span key={row.label} style={{ fontSize: T.s9 }}>
                  <span style={{ fontWeight: 700, color: C.faint }}>{row.label}　</span>
                  <span style={{ fontWeight: 700, color: row.danger ? '#8c2d36' : C.ink }}>
                    {row.values.join('、')}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </Box>
      ) : null}

      {/* 營地活動：建角時選的兩種是**規則決定**，不印在卡上就得每次回頭查編輯器。
          只印名字與目標；「本次休息已使用」是跑團狀態，屬面板不屬紙卡。 */}
      {model.campActivities.length ? (
        <Box title="營地活動" note={CAMP_ACTIVITY_SOURCE} style={{ flex: '0 0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {model.campActivities.map((a) => (
              <div key={a.id} style={{ fontSize: T.s10, fontWeight: 700 }}>
                {a.name}
                <span style={{ fontSize: T.s8, color: C.faint, fontWeight: 400 }}>（{a.target}）</span>
              </div>
            ))}
          </div>
        </Box>
      ) : null}

      <Box title="英雄技能" style={{ flex: '0 0 auto' }}>        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '40px' }}>
          {model.heroicSkills.map((hs) => (
            <div key={hs.name}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: T.s9, fontWeight: 700 }}>{hs.name}</span>
                {hs.sl ? <span style={{ fontSize: T.s8, color: C.faint }}>SL {hs.sl}</span> : null}
                {hs.requirement ? (
                  <span style={{ fontSize: T.s8, color: C.faint }}>（{hs.requirement}）</span>
                ) : null}
              </div>
              {hs.effect ? (
                <SkillDescription desc={hs.effect} sl={hs.sl || 1} className="sheet-skill-desc" />
              ) : null}
            </div>
          ))}
        </div>
      </Box>
    </div>
    <div style={{ ...S.col, flex: '1 1 auto' }}>
      <NameHeader model={model} full />
      <Box
        title="奧祕與咒語"
        note="已習得咒語與已綁定阿爾卡納"
        style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
      >
        <SpellTable rows={model.page2Spells} count={7} />
      </Box>
      <RitualBox model={model} />
    </div>
  </div>
);

export const OfficialSheetPage3 = ({ model, vars = null }) => (
  <div style={{ ...S.page, ...vars }} data-sheet-page="3">
    <div style={{ ...S.col, flex: '1 1 1' }}>
      <NameHeader model={model} full />
      <Box
        title="奧祕與咒語（續）"
        style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
      >
        <SpellTable rows={model.page3Spells.slice(0, 7)} count={7} />
      </Box>
    </div>
    <div style={{ ...S.col, flex: '1 1 1' }}>
      <NameHeader model={model} full />
      <Box
        title="奧祕與咒語（續）"
        style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
      >
        <SpellTable rows={model.page3Spells.slice(7, 14)} count={7} />
      </Box>
      <RitualBox model={model} />
    </div>
  </div>
);

export const SHEET_PAGE_COMPONENTS = [OfficialSheetPage1, OfficialSheetPage2, OfficialSheetPage3];

// ───────────────────────────────────────── 匯出面板

const PREVIEW_SCALE = 0.46;

/**
 * 讓瀏覽器有機會重繪與處理點擊。
 *
 * **這不是可有可無的**：光柵化是同步的 DOM 複製 ＋ SVG 序列化 ＋ canvas 繪製，
 * 一次要好幾秒。`await` 只會讓出 microtask，**瀏覽器處理點擊是 macrotask**——
 * 所以連續三頁不讓出的話，整段匯出期間畫面是死的、任何點擊都沒反應，
 * 使用者看到的就是「一按就死機」。
 * `setTimeout`（macrotask）＋ `requestAnimationFrame`（等一次重繪）才真的讓得出去。
 */
const yieldToBrowser = () => new Promise((resolve) => {
  setTimeout(() => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else resolve();
  }, 0);
});

/**
 * 光柵化的選項。**`skipFonts` 是修一個「一按就死機」的關鍵。**
 *
 * `html-to-image` 預設會把頁面上的網頁字型「抓下來內嵌」：它對每一張
 * `document.styleSheets` 的 `href` 發 `fetch()`，再對 CSS 裡的每個 `url(...)`
 * 抓字型檔轉成 data URL（`embed-webfonts.js` 的 `fetchCSS`／`embedResources`）。
 * 本專案 `index.html` 掛著 Google Fonts（Cinzel／JetBrains Mono／Noto Sans TC／Noto Serif TC），
 * 於是**只要那個網域連不上或很慢，這個 promise 就永遠不會 resolve**——
 * 匯出卡住、兩顆按鈕永遠停用、彈窗關不掉，看起來就是整頁死掉。
 *
 * `skipFonts: true` 讓它整段跳過（`embedWebFonts` 直接回傳 null），
 * 改由瀏覽器在 foreignObject 裡用**系統字型**渲染；本表本來就用
 * `"Segoe UI", "Microsoft JhengHei", ...` 這種系統字型堆疊，外觀不受影響。
 */
const RASTER_OPTIONS = Object.freeze({
  pixelRatio: 2,
  width: SHEET_PAGE_WIDTH,
  height: SHEET_PAGE_HEIGHT
});

/**
 * 單頁光柵化的上限。就算真的卡住，也要讓 UI 有辦法回來，而不是永遠轉圈。
 * 放寬到 45 秒：光柵化本身就慢（實測一頁 toPng 要好幾秒），
 * 這裡的用意是「永遠不會卡死」，不是「失敗要快」。
 */
const RASTER_TIMEOUT_MS = 45000;

const withTimeout = (promise, label) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} 逾時（${RASTER_TIMEOUT_MS / 1000} 秒）`)), RASTER_TIMEOUT_MS);
  })
]);

/**
 * 只內嵌「本機圖示字型」的 CSS，其餘一律不管。
 *
 * 為什麼要自己組這一小段：`html-to-image` 預設會去抓**所有**樣式表的字型
 * （包含 `index.html` 掛的 Google Fonts），抓不到就永遠不 resolve（＝匯出卡死）；
 * 但完全跳過字型（`skipFonts: true`）又會讓 `.fu-icon` 的官方屬性圖示變成空白方塊。
 *
 * 所以：本機那顆 `.otf`（74 KB，同源、離線可用）轉成 data URL 內嵌，
 * **Google 的一律不碰**。`fontEmbedCSS` 的優先序高於 `skipFonts`，
 * 所以兩者同時給也安全（前者勝出）。
 */
const ICON_FONT_CSS = `@font-face { font-family: 'Fabula Ultima Icons'; src: url(ICON_FONT_URL) format('opentype'); font-weight: normal; font-style: normal; }`;

let iconFontCssPromise = null;
const getIconFontCss = () => {
  if (!iconFontCssPromise) {
    iconFontCssPromise = Promise.resolve()
      .then(() => fetch(iconFontUrl))
      .then((res) => res.blob())
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => ICON_FONT_CSS.replace('ICON_FONT_URL', dataUrl))
      .catch(() => '');
  }
  return iconFontCssPromise;
};

/**
 * 匯出面板：三頁預覽 ＋ 匯出三個 PNG 或一個三頁 PDF。
 * 預覽用 `transform: scale()` 縮小，但**光柵化的是未縮放的節點**，
 * 所以輸出仍是 1123×794 × pixelRatio 的原始尺寸。
 */
export function CharacterSheetExportBody({ character, stats = null, theme = null, showToast = null }) {
  const model = useMemo(() => buildSheetModel(character, stats), [character, stats]);
  const vars = useMemo(() => sheetVars(theme), [theme]);
  const pageRefs = useRef([]);
  const [exporting, setExporting] = useState(null); // null | 'png' | 'pdf'
  const [progress, setProgress] = useState('');

  // 匯出結束／元件卸載後，ref 還指著已經被移除的 DOM 節點；清掉才不會抱著整棵樹不放
  useEffect(() => () => { pageRefs.current = []; }, []);

  const safeName = (model.name || '冒險者').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = (ext, index) => (index ? `${safeName}_角色卡_p${index}.${ext}` : `${safeName}_角色卡.${ext}`);

  /** 逐頁光柵化；PNG 走無損、PDF 內嵌 JPEG（DCTDecode 可直接原樣嵌入） */
  const rasterizePages = async (type) => {
    const out = [];
    const total = SHEET_PAGE_COMPONENTS.length;
    const fontEmbedCSS = await getIconFontCss();
    const options = {
      ...RASTER_OPTIONS,
      fontEmbedCSS,
      backgroundColor: vars['--sh-bg']
    };
    for (let i = 0; i < total; i += 1) {
      const node = pageRefs.current[i];
      if (!node) continue;
      setProgress(`正在處理第 ${i + 1} / ${total} 頁…`);
      // 每一頁之前都先讓出，否則從第一頁開始畫面就是死的
      await yieldToBrowser();
      const dataUrl = await withTimeout(
        type === 'jpeg'
          ? htmlToImage.toJpeg(node, { ...options, quality: 0.95 })
          : htmlToImage.toPng(node, options),
        `第 ${i + 1} 頁`
      );
      out.push({ index: i + 1, dataUrl });
    }
    return out;
  };

  const downloadHref = (href, name) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportPng = async () => {
    if (exporting) return;
    setExporting('png');
    let done = 0;
    try {
      const pages = await rasterizePages('png');
      for (const page of pages) {
        downloadHref(page.dataUrl, fileName('png', page.index));
        done += 1;
        // 讓瀏覽器有時間處理「允許多檔案下載」提示
        await new Promise((r) => setTimeout(r, 250));
      }
      if (showToast) showToast(`已匯出 ${done} 張 PNG（官方三頁格式）`);
    } catch (err) {
      if (showToast) showToast('匯出失敗，請再試一次');
    } finally {
      setExporting(null);
      setProgress('');
    }
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting('pdf');
    try {
      const pages = await rasterizePages('jpeg');
      setProgress('正在組裝 PDF…');
      await yieldToBrowser();
      const pdf = buildImagePdf(pages.map((page) => ({
        bytes: dataUrlToBytes(page.dataUrl),
        // 尺寸由 JPEG 檔頭讀出（pdfWriter 內部處理），這裡不必傳
        width: SHEET_PAGE_WIDTH * 2,
        height: SHEET_PAGE_HEIGHT * 2
      })));
      if (!pdf) {
        if (showToast) showToast('這一張卡沒有可匯出的頁面');
        return;
      }
      const url = URL.createObjectURL(pdf);
      downloadHref(url, fileName('pdf'));
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (showToast) showToast('已匯出三頁 PDF（A4 橫向）');
    } catch (err) {
      if (showToast) showToast('匯出失敗，請再試一次');
    } finally {
      setExporting(null);
      setProgress('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: theme?.textMuted }}>
          依官方三頁橫向 A4 表格的版面重繪，配色沿用站內樣式與這個角色的主題色。
          選圖片會得到三個 PNG 檔（瀏覽器可能會詢問是否允許下載多個檔案）；選 PDF 會得到單一三頁檔案。
          {progress ? <span className="font-bold" style={{ color: theme?.accent }}>　{progress}</span> : null}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <JRPGButton
            variant="primary"
            size="sm"
            icon={GiScrollUnfurled}
            onClick={handleExportPdf}
            disabled={Boolean(exporting)}
          >
            {exporting === 'pdf' ? '匯出中…' : '匯出三頁 PDF'}
          </JRPGButton>
          <JRPGButton
            variant="ghost"
            size="sm"
            icon={GiScrollUnfurled}
            onClick={handleExportPng}
            disabled={Boolean(exporting)}
          >
            {exporting === 'png' ? '匯出中…' : '匯出三張 PNG'}
          </JRPGButton>
        </div>
      </div>

      <div className="space-y-3">
        {SHEET_PAGE_COMPONENTS.map((Page, i) => (
          <div key={i} className="rounded border overflow-hidden" style={{ borderColor: theme?.border }}>
            <div
              className="flex items-center gap-1.5 px-2 py-1 text-t11 font-bold"
              style={{ backgroundColor: theme?.accentDark || theme?.accent, color: '#fffdf9' }}
            >
              <GiCheckMark className="w-3 h-3" />
              第 {i + 1} 頁
            </div>
            {/* 外層負責縮放，內層才是被光柵化的原始尺寸節點 */}
            <div style={{ width: SHEET_PAGE_WIDTH * PREVIEW_SCALE, height: SHEET_PAGE_HEIGHT * PREVIEW_SCALE, overflow: 'hidden' }}>
              <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                <div ref={(el) => { pageRefs.current[i] = el; }}>
                  <Page model={model} vars={vars} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CharacterSheetExportBody;
