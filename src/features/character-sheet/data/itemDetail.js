/**
 * 裝備品項的「這是什麼東西」——**一行說明與四個採購來源**（P11，2026-11-01）。
 *
 * ## 為什麼從 `PurchaseModal.jsx` 搬出來
 *
 * 這段程式原本住在購買面板裡（`const describeItem = …`），於是**只有購買面板算得出
 * 一個品項的說明**。P11 要記「開卡時買了哪幾件」，而那份記錄必須與購買面板寫出
 * 一模一樣的格式——否則同一件青銅劍在履歷上會有兩種寫法。
 *
 * 搬出來的第二個理由：`utils/startingFunds.js` 是純函式，不該 import 一個 `.jsx`。
 * 純資料與純格式化留在 `data/`，元件只負責畫。
 *
 * ## 刻意不寫期望值
 *
 * 說明裡沒有「平均傷害」這種統計量，也**不在這裡重算命中式**——命中式屬於角色、
 * 屬於 `equipmentRules`。這裡只回答「這是什麼東西」。
 */

/**
 * 四個採購來源。`slot` 是「購入後裝備到哪裡」，`source` 對應 `rulesData.equipment` 的鍵。
 *
 * 刻意**不含圖示**：圖示是 React 元件，屬呈現層。`PurchaseModal` 會把圖示接上去
 * （`PURCHASE_CATEGORIES`），純函式這邊只吃得到 id／label／slot。
 */
export const PURCHASE_SOURCES = Object.freeze([
  { id: 'weapons', label: '武器', source: 'weapons', slot: 'mainHand' },
  { id: 'shields', label: '盾牌', source: 'shields', slot: 'offHand' },
  { id: 'armors', label: '防具', source: 'armors', slot: 'armor' },
  { id: 'accessories', label: '飾品', source: 'accessories', slot: 'accessory' }
]);

/**
 * 一個品項的一行說明。
 *
 * @param {object} item `rulesData.equipment` 的原始品項
 * @param {'weapons'|'shields'|'armors'|'accessories'} categoryId
 * @returns {string}
 */
export const describeItem = (item, categoryId) => {
  if (!item) return '';
  if (categoryId === 'weapons') {
    return [item.category, item.attr, item.damage].filter(Boolean).join(' · ');
  }
  if (categoryId === 'shields') {
    const parts = [];
    if (item.defBonus) parts.push(`物防 +${item.defBonus}`);
    if (item.mdefBonus) parts.push(`魔防 +${item.mdefBonus}`);
    if (item.initMod) parts.push(`先攻 ${item.initMod > 0 ? '+' : ''}${item.initMod}`);
    return parts.join(' · ');
  }
  return item.desc || '';
};
