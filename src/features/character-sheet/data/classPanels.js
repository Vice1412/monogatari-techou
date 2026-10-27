/**
 * 職業專屬面板「住在哪個分頁」的唯一來源（F-020，2026-10-27）。
 *
 * 為什麼需要它：原本每個面板都是**逐處手寫條件渲染**，於是同一份 UI 會被掛兩次，
 * 而「面板在哪個分頁」每個職業答案都不同——玩家只能一個一個分頁找。
 *
 * 實測到的三種病（P3 掃 6 個分頁 ＋ P15 複驗）：
 *   ①旅人夥伴與機師載具在「武器與戰鬥」與「職業特技」**各掛一次**（DOM 加倍）
 *   ②嵌合師的模仿咒語同樣掛兩次（「咒語與魔法」與「職業特技」）
 *   ③死靈術士的僕從**只**掛在「武器與戰鬥」，而玩家學會【殘酷的誕生】之後
 *     會去「職業特技」找（那裡才是放職業技能的地方）→ 找不到就以為功能沒做
 *
 * 這張表只回答兩個問題：**這個面板住哪個分頁**、**它什麼時候才存在**。
 * 指路句（「夥伴卡在『武器與戰鬥』分頁」）也從這裡派生，所以文案不會各寫一份。
 */

/** 跑團面板的分頁 id → 給人看的分頁名。id 與 `CharacterPlayHUD` 的 `activeTab` 一致。 */
export const PLAY_TAB_LABELS = Object.freeze({
  attacks: '武器與戰鬥',
  spells: '咒語與魔法',
  skills: '職業特技'
});

/**
 * 面板 → 它**唯一**的分頁。
 *
 * 判準是「這個面板管的東西屬於哪一種操作」，不是「哪個分頁比較好找」：
 * 載具／夥伴／僕從是**戰鬥中的實體**（要算先攻、要標 HP），所以住戰鬥分頁；
 * 模仿咒語管的是**咒語清單**，所以住咒語分頁；其餘是職業的養成／收藏，住職業特技。
 */
export const CLASS_PANEL_HOME = Object.freeze({
  pilotVehicle: 'attacks',
  wayfarerCompanion: 'attacks',
  necromancerMinions: 'attacks',
  chimerist: 'spells',
  arcanist: 'skills',
  tinkerer: 'skills',
  gourmet: 'skills',
  aceOfCards: 'skills'
});

/** 面板的中文短名（指路句用；不要在這裡寫整句）。 */
export const CLASS_PANEL_LABEL = Object.freeze({
  pilotVehicle: '載具卡',
  wayfarerCompanion: '夥伴卡',
  necromancerMinions: '僕從卡',
  chimerist: '模仿咒語',
  arcanist: '阿爾卡納管理器',
  tinkerer: '工坊',
  gourmet: '食譜',
  aceOfCards: '牌組'
});

/**
 * 職業 → 面板，以及**面板什麼時候才存在**。
 *
 * `skill`：該職業的這個技能 `sl > 0` 才出現（原書：學了才有東西可管）。
 * `heroic`：持有這個英雄技能才出現（死靈術士的僕從不是職業技能，是【殘酷的誕生】）。
 */
export const CLASS_PANEL_OWNER = Object.freeze({
  機師: { panel: 'pilotVehicle', skill: '個人載具' },
  旅人: { panel: 'wayfarerCompanion', skill: '忠實夥伴' },
  嵌合師: { panel: 'chimerist', skill: '咒語模仿' },
  死靈術士: { panel: 'necromancerMinions', heroic: '殘酷的誕生' }
});

/** 英雄技能可能是字串，也可能是 `{ name }`（兩種存法都存在於既有存檔）。 */
const heroicSkillName = (entry) => (typeof entry === 'string' ? entry : entry?.name);

/**
 * 這個職業的面板「現在」該不該出現。
 *
 * 抽成純函式的原因：這段判斷原本在 JSX 裡寫了三次（三個面板各一次），
 * 而 JSX 裡的條件測不到——重複掛載就是這樣長出來的。
 */
export const isClassPanelActive = (character, className) => {
  const owner = CLASS_PANEL_OWNER[className];
  if (!owner) return false;

  if (owner.skill) {
    const classItem = (character?.classes || []).find((c) => c.className === className);
    if (!classItem) return false;
    return (classItem.skills || []).some(
      (s) => s?.name === owner.skill && Number(s?.sl) > 0
    );
  }

  return (character?.heroicSkills || []).some((h) => heroicSkillName(h) === owner.heroic);
};

/**
 * 指路句：面板不在當前分頁時，告訴玩家它在哪。
 *
 * 回空字串代表「不用說」——面板就在這一頁，或這個面板根本沒有家。
 * 空字串是**呼叫端的判斷依據**，所以不要回 `null`（`{null ? ... : null}` 這種死分支踩過一次）。
 */
export const panelHomeHint = (panelKey, currentTab) => {
  const home = CLASS_PANEL_HOME[panelKey];
  if (!home) return '';
  if (home === currentTab) return '';
  const label = CLASS_PANEL_LABEL[panelKey] || '面板';
  return `${label}在「${PLAY_TAB_LABELS[home]}」分頁`;
};

/**
 * 職業卡上的指路句：`className` 這個職業的面板若不在 `currentTab`，就說它在哪。
 *
 * 三種情況都回空字串：①這職業沒有專屬面板 ②面板還沒解鎖（學了才有） ③面板就在這一頁。
 */
export const classPanelHint = (character, className, currentTab) => {
  const owner = CLASS_PANEL_OWNER[className];
  if (!owner) return '';
  if (!isClassPanelActive(character, className)) return '';
  return panelHomeHint(owner.panel, currentTab);
};
