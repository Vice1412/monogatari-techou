# 06 · 裝備／飾品特性清單（【升級】用的「1000z 以下」篩選結果）

> 用途：【升級】原文「每次休息時 1 次，選擇為任意數量武器／護甲／盾牌添加或替換一個特性
> （**1000Z 以下的特性**，需支付其【Z − 高瞻遠矚SL × 100】的費用）」。
> 這份清單是**資料**，不是文案：AGY 要把它寫成 `data/equipmentTraits.js`，並讓 `FlowDataPanel`
> 用 `multiSelect`（可加可換）挑選。原文只說「武器／護甲／盾牌」，**飾品特性不在【升級】範圍**，
> 但同一批資料要留著給飾品用（欄位 `slots`）。

## 6.1 武器特性（`slots: ['weapon']`，≤1000z）

| id | 名稱 | 花費 | 效果（原文） | 需要玩家再選？ |
|---|---|---:|---|---|
| `traitState` | 反狀態 | 500 | 你對一種狀態效果免疫 | ✅ 選一種狀態 |
| `traitResist` | 抵抗力 | 700 | 你獲得對一種傷害類型（非物理）的抗性 | ✅ 選一種非物理傷害類型 |
| `traitCharm` | 護身符 | 800 | 你的魔防 +1 | — |
| `traitBulwark` | 壁壘 | 800 | 你的物防 +1 | — |
| `traitDoubleResist` | 雙重抵抗 | 1000 | 你獲得對兩種傷害類型（非物理）的抗性 | ✅ 選兩種 |
| `traitSwordbreaker` | 破劍者 | 1000 | 你獲得對物理傷害的抗性 | — |
| `traitArcane` | 魔能 | 100 | 該武器攻擊對抗的是魔防，而不是物防 | — |
| `traitHunter` | 獵人 | 300 | 該武器對某一特定物種的生物造成 5 點額外傷害 | ✅ 選一種物種 |
| `traitPierce` | 穿刺 | 400 | 該武器造成的傷害無視抗性 | — |
| `traitDoubleHunter` | 雙重獵人 | 500 | 該武器對屬於兩個特定物種的生物造成額外 5 點傷害 | ✅ 選兩種物種 |
| `traitMulti` | 多重 | 1000 | 使用該武器的攻擊具有多重（2） | — |

> **超過 1000z，【升級】不能選**：免疫 1500／狀態 1500／全能盾 2000／完美健康 2000／狀態+ 2000。
> 仍要寫進資料（標 `cost`），因為它們是**購買裝備時**就存在的特性，不是升級才加的。

## 6.2 防具／盾牌特性（`slots: ['armor','shield']`，≤1000z）

| id | 名稱 | 花費 | 效果（原文） | 需要玩家再選？ |
|---|---|---:|---|---|
| `traitState` | 反狀態 | 500 | 你對一種狀態效果免疫 | ✅ |
| `traitResist` | 抗性 | 700 | 你獲得對一種傷害類型（非物理）的抗性 | ✅ |
| `traitCharm` | 護身符 | 800 | 你的魔防 +1 | — |
| `traitBulwark` | 壁壘 | 800 | 你的物防 +1 | — |
| `traitDoubleResist` | 雙重抗性 | 1000 | 你獲得對兩種傷害類型（非物理）的抗性 | ✅ |
| `traitSwordbreaker` | 破劍者 | 1000 | 你獲得對物理傷害的抗性 | — |

> 超過 1000z：免疫 1500／完美健康 2000／全能盾 2000（全能盾只在防具那張表出現）。

## 6.3 飾品特性（`slots: ['accessory']`，≤1000z；**不在【升級】範圍**，僅供選購與顯示）

| id | 名稱 | 花費 | 效果（原文） | 需要玩家再選？ |
|---|---|---:|---|---|
| `traitDamageConvert` | 傷害轉換 | 300 | 你的武器、咒語、技能所造成的傷害全部轉換為一個特定的傷害類型 | ✅ 選一種傷害類型 |
| `traitInitUp` | 先攻提高 | 500 | 如果你在衝突開始時裝備著這個飾品，你的先攻 +4 | — |
| `traitHitUp` | 命中提高 | 1000 | 你的命中檢定 +1 | — |
| `traitMagicUp` | 魔法提高 | 1000 | 你的施法檢定 +1 | — |
| `traitVigor` | 生命力強化 | 1000 | 當你恢復 HP 時，額外恢復 5 點 HP | — |

> 超過 1000z：癒合力強化 1500／咒語強化 2000／武具強化 2000（武具強化在創造時選近戰或遠程）。

## 6.4 資料形狀（請照抄）

```js
// src/features/character-sheet/data/equipmentTraits.js
export const EQUIPMENT_TRAITS = Object.freeze([
  { id: 'traitArcane', name: '魔能', cost: 100, slots: ['weapon'],
    effect: '該武器攻擊對抗的是魔防，而不是物防' },
  { id: 'traitState', name: '反狀態', cost: 500, slots: ['weapon', 'armor', 'shield'],
    effect: '你對一種狀態效果免疫',
    choice: { key: 'status', label: '免疫的狀態', options: ['眩暈', '動搖', '緩慢', '虛弱', '憤怒', '中毒'] } },
  { id: 'traitHunter', name: '獵人', cost: 300, slots: ['weapon'],
    effect: '該武器對某一特定物種的生物造成 5 點額外傷害',
    choice: { key: 'species', label: '物種', options: ['野獸', '類人', '怪物', '植物', '不死', '惡魔', '元素', '構裝體'] } }
  // …其餘照 §6.1–6.3 補齊
]);

/** 這個欄位（weapon／armor／shield／accessory）能選哪些特性，且花費 ≤ 上限。 */
export const traitsFor = (slot, maxCost = Infinity) =>
  EQUIPMENT_TRAITS.filter((t) => t.slots.includes(slot) && t.cost <= maxCost);

/** 【升級】的實際支付金額：Z − 高瞻遠矚SL × 100（最低 0）。 */
export const traitPrice = (trait, foresightSL = 0) =>
  Math.max(0, trait.cost - Math.max(0, Number(foresightSL) || 0) * 100);
```

## 6.5 【升級】的流程（`flowDataSpecs.js` 的一筆）

```js
'heroic:升級': {
  title: '升級：每次休息一次，為裝備添加／替換特性',
  settlements: [{ id: 'rest', label: '休息：挑選要改的裝備與特性', dice: null }],
  // 用 recordList：每一次休息一筆，記錄「哪件裝備、原本的特性、換成什麼、付了多少」
  records: {
    label: '本次休息的改造',
    min: 0, max: 8,
    fields: [
      { key: 'itemName', label: '裝備名稱', required: true, maxLength: 32 },
      { key: 'slot', label: '類別', required: true, options: ['武器', '護甲', '盾牌'] },
      { key: 'traitId', label: '特性', required: true, source: 'EQUIPMENT_TRAITS:1000' },
      { key: 'replaced', label: '被替換的舊特性', required: false, maxLength: 32 },
      { key: 'paid', label: '支付金額', required: true, numeric: true }
    ]
  },
  requires: { slotScope: ['weapon', 'armor', 'shield'], maxCost: 1000 }
}
```

**驗收（≥6 條）**
1. `traitsFor('weapon', 1000)` 不含 `免疫`（1500）與 `多重`？——**含**多重（1000）；不含 `完美健康`。
2. `traitsFor('accessory', 1000)` 不含 `咒語強化`（2000）。
3. `traitPrice({cost:700}, 0) === 700`；`traitPrice({cost:700}, 3) === 400`；`traitPrice({cost:700}, 9) === 0`。
4. 清單裡每一筆的 `slots` 都非空、`cost` 都是正整數、`choice` 若有則 `options` 至少 2 項。
5. 每一筆 `choice.options` 都在對應的封閉詞彙內（狀態用 `STATUS_AFFLICTIONS` 的鍵、傷害類型用九相、物種用 `SPECIES_THEMES`）。
6. 資料層沒有重複 `id`；`反狀態` 同時出現在 weapon 與 armor／shield 時**共用同一個 id**（不要造兩個）。

## 6.6 刻意不做

- **不自動套用特性效果**（例如「穿刺無視抗性」只在戰鬥結算時有用）——那是戰鬥視窗的事。
  這一輪只做「選得到、記得下、付得出錢」。
- **不改共用的驗證函式**（`customWeapons`／`buildLoadoutIssues`）去檢查價值上限，
  在面板上顯示提示即可（會波及其他來源）。
