/**
 * 官方經典職業搭配：套用邏輯（純函式）。
 *
 * 從 `CharacterEditor.jsx` 抽出的理由：這段邏輯（覆寫官方欄位 → 寫入職業子系統 → 保留玩家自訂欄位）
 * 沒有任何 React 相依，抽成純函式後可被 `tests/starterPresets.test.mjs` 直接覆蓋。
 *
 * **不覆寫**身分／主題／出身／羈絆 —— 官方原書不提供這些欄位，屬玩家自訂（見 `docs/decisions.md` §P3）。
 */

import { createDefaultVehicleData } from '../data/pilotVehicleData';
import {
  createMnemosphere,
  makeMnemosphereId,
  normalizeTechnosphereState
} from '../data/technospheres';

/**
 * 把一個經典職業搭配套用到角色上，回傳新的角色物件（不修改輸入）。
 *
 * @param {object} character 目前角色
 * @param {object} preset 經典職業搭配
 * @returns {object} 新的角色物件
 */
export const applyPreset = (character, preset) => {
  const base = character || {};
  const book = preset.sourcebook || 'core';

  const enabledBooks = new Set(base.enabledSourcebooks ?? ['core']);
  enabledBooks.add(book);

  const next = {
    ...base,
    name: preset.title,
    attributes: { ...preset.attributes },
    // 深拷貝：`selectedOptions` 等子選擇內嵌在技能上，會一併帶入
    classes: JSON.parse(JSON.stringify(preset.classes)),
    equipment: { ...preset.equipment },
    // 官方配置的【定制武器】（HF p.106）。深拷貝，避免套用後改動污染預設資料。
    // 沒有這一行的話，`equipment.mainHand` 會指向一個官方武器表裡不存在的名字，
    // 裝備欄就只會顯示「找不到」——那正是這批 preset 長久以來的狀況。
    customWeapons: JSON.parse(JSON.stringify(preset.customWeapons || [])),
    zenit: preset.zenit,
    // 官方經典搭配的 zenit 是原書印好的剩餘金額（p.172–175），等於已經結算過，
    // 所以不再要求玩家按「擲 2d6 × 10 結算」（見 characterEngine 的 startingFundsRolled）。
    startingFundsRolled: true,
    enabledSourcebooks: Array.from(enabledBooks),
    updatedAt: new Date().toISOString()
  };

  // 秘儀師【綁定和召喚】：起始自選一個已綁定的阿爾卡納
  if (preset.arcana) {
    next.arcanistData = {
      customArcana: [],
      activeSummonId: null,
      ...(base.arcanistData || {}),
      boundArcana: [...preset.arcana]
    };
  }

  // 修補匠【小工具】：煉金術／灌注術／魔導科技的階級
  if (preset.gadgets) {
    next.tinkererData = {
      ...(base.tinkererData || {}),
      gadgets: {
        ...preset.gadgets,
        magitechSpells: [...(preset.gadgets.magitechSpells || [])]
      }
    };
  }

  // 機師【個人載具】：寫入框架與已掌握模組；啟用狀態交由載具面板（避免與槽位／武器上限衝突）
  if (preset.vehicle) {
    next.pilotVehicle = {
      ...(base.pilotVehicle || createDefaultVehicleData()),
      frameId: preset.vehicle.frameId,
      unlockedModules: [...preset.vehicle.modules],
      activeModules: [],
      isMounted: false
    };
  }

  if (preset.quirk) next.quirk = preset.quirk;

  // 職業魔石（科技奇幻手冊 p.134）：官方配搭配的初始魔石。
  //
  // 以前 `preset.mnemosphere` 只是一句說明字串（`'極性魔晶石（視同元素師 1 級）'`），
  // 只被拿來顯示——套用之後玩家其實**沒有**那顆魔石，畫面上卻寫著他有。
  // 2026-10-22（§CF）把資料改成結構化之後，這裡真的把它寫進 `technospheres`。
  //
  // ※ 不碰 `creationRules.technospheres`：那是團規，不是配搭配的內容。
  //   魔晶石關閉時 `getActiveMnemospheres` 自然不會回傳它，行為與以前相同。
  //
  // id 由 preset id 派生而不是亂數：同一個預設套用兩次不會長出兩顆同職業的魔石
  // （先濾掉同 id 再 append），測試也才有東西可以斷言。
  if (preset.mnemosphere) {
    const state = normalizeTechnosphereState(base.technospheres);
    const created = createMnemosphere({
      id: makeMnemosphereId(preset.mnemosphere.className, `preset-${preset.id}`),
      className: preset.mnemosphere.className,
      level: preset.mnemosphere.level
    });
    next.technospheres = {
      ...state,
      mnemospheres: [...state.mnemospheres.filter((m) => m.id !== created.id), created]
    };
  }

  return next;
};
