/**
 * 術語表（F-028，2026-10-27）。
 *
 * ## 為甚麼要有這個檔
 *
 * P12 量 K2（畫面自足率）量到 **6/12 ＝ 50%**：12 個天天看到的術語，
 * 有一半在畫面上**從來沒有一句話解釋**。失敗的 6 個是
 * `職業技能`、`英雄技能`、`精通`、`公測`、`起始資金`、`特質`。
 *
 * 根因不是「少了一句提示」，而是**這套 App 沒有詞彙層**：
 * 速查抽屜 `RuleCodexDrawer` 的定位是「職業子系統目錄」（阿爾卡納／儀式／小工具／
 * 造物／夥伴／法術書），不是術語辭典。於是每個詞都只在「使用」它，沒有在「說明」它。
 *
 * ## 為甚麼是 tooltip 而不是速查抽屜分頁
 *
 * F-028 條目原本建議「速查抽屜加一個術語分頁」（C=2）。2026-10-27 GM 裁定改成
 * **術語旁邊一個 tooltip，壓到一句話**（C=1）：
 *
 * - 分頁要玩家**離開正在做的事**去查，查到還要自己找回原本的位置；
 * - tooltip 就在那個詞上面，**零移動成本**。
 *
 * 代價是每句話只能有一句——所以 `short` 的寫作規則很硬：
 * **一句話、不用第二個術語解釋第一個術語、不寫「請參考原書」。**
 *
 * ## 每一條定義的出處（不要憑記憶改）
 *
 * 依專案鐵律「效果文本必須先核對官方原書」。下表左欄是這個檔的依據，
 * 改任何一條之前先去那裡確認：
 *
 * | 術語 | 出處 |
 * |---|---|
 * | 精通 | Core p.228「You can never have more than ten levels in a Class. Once you put the tenth level in a Class, that Class has been mastered」→ 引擎 `CLASS_MAX_LEVEL = 10`、`masteredClasses = level >= 10` |
 * | 英雄技能 | Core p.232 的前提系統；開局名額見 Playtest Materials 2026-10-01 p.4 |
 * | 公測 | 官方 Playtest Materials（2026-10-01）；本專案 §BE 裁定它是「開卡規則開關」不是手冊 |
 * | 起始資金 | 建角流程第 4 步「擲起始資金 2d6 × 10」（`CharacterEditor.jsx` 的 `kind: 'zenit'`） |
 * | 技能等級 | `rulesData.json` 每條技能有 `maxSL`，實測值域 1–10，**不是固定 5** |
 * | 職業技能 | 29 個職業各 5 條技能（`rulesData.json` 實測 145 條） |
 * | 金手指 | 三大奇幻手冊的選用規則；本專案 §AR |
 * | 命刻 | 跑團用的進度鐘；本專案 §BF 的名詞裁定「生長命刻」 |
 *
 * ※ **「精通 ＝ 5 條技能全滿」是錯的。** `findings.md` 的 F-028 條目這樣寫過，
 * 但引擎與原書都是「該職業達 10 級」。2026-10-27 修這條時一併更正。
 */

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} id     程式內部鍵（同時當 `data-testid` 後綴）
 * @property {string} term   正式名稱（tooltip 標題）
 * @property {string} [alias] 畫面上實際用的說法（跟 `term` 不一樣時才填）
 * @property {string} short  **一句話**的解釋
 */

/** @type {GlossaryEntry[]} */
export const GLOSSARY = [
  {
    id: 'sl',
    term: '技能等級（SL）',
    short: '這條職業技能點到第幾級，每條技能能點的上限不一樣。'
  },
  {
    id: 'freeBonus',
    term: '免費增益',
    short: '有些職業一入門就送的固定好處，不佔技能點數。'
  },
  {
    id: 'classSkill',
    term: '職業技能',
    alias: '特技',
    short: '每個職業的專屬能力，點高就是該職業的戰力。'
  },
  {
    id: 'heroicSkill',
    term: '英雄技能',
    short: '把一個職業練到精通之後，才能額外挑選的強力技能。'
  },
  {
    id: 'mastery',
    term: '精通',
    short: '同一個職業升到 10 級就算精通，之後不能再往那個職業投等級。'
  },
  {
    id: 'quirk',
    term: '金手指',
    short: '選用規則，替角色加一個特殊身世；不選也完全可以。'
  },
  {
    id: 'fateClock',
    term: '命刻',
    short: '一格一格的進度鐘，跑團時由 GM 和玩家一起推動。'
  },
  {
    id: 'playtest',
    term: '公測',
    short: '官方還沒定稿、先放出來試玩的修訂內容；本團不開也能正常玩。'
  },
  {
    id: 'creationRules',
    term: '開卡規則',
    short: '這一團自己定的規矩，跟官方標準不同時以這裡為準。'
  },
  {
    id: 'startingZenit',
    term: '起始資金',
    alias: '初始持有金幣',
    short: '開卡時擲 2d6 × 10 得到的 zenit，之後打團才會增減。'
  },
  {
    id: 'attributes',
    term: '四維屬性',
    short: 'DEX、INS、MIG、WLP 四項，決定命中、閃避、傷害與魔法。'
  },
  {
    id: 'trait',
    term: '特質',
    short: 'd20 身世表擲出的性格特徵，只當扮演提示，不影響任何數值。'
  }
];

/** 以 `id` 取用：`TERMS.mastery`。呼叫端不要自己寫字串。 */
export const TERMS = Object.fromEntries(GLOSSARY.map((e) => [e.id, e]));

/**
 * 取一條定義；找不到回 `null`。
 * 給「不確定有沒有這條」的地方用（例如依資料驅動的畫面）。
 */
export const getTerm = (id) => TERMS[id] || null;
