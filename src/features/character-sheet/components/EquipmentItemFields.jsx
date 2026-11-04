import React from 'react';
import { CUSTOM_WEAPON_CATEGORIES, CUSTOM_WEAPON_RANGES } from '../data/customWeapons';
// 九種傷害屬性（與 Npc 工坊共用同一份清單，避免兩處漂移）
import { DAMAGE_TYPES } from '../../npc-workshop/data/constants';
import { GEAR_SLOTS } from '../utils/inventory';

/**
 * 自訂裝備的欄位組（2026-11-03，使用者第二輪）。
 *
 * > 「自訂裝備是代表不是在列表上的，而不代表不是裝備……你應該也要給他輸入傷害、
 * >  輸入類別、輸入屬性類型、輸入效果、輸入檢定之類的。
 * >  同等，在外面新增物品時，也要用同樣的方式來輸入裝備資訊。」
 *
 * ## 為什麼是「一組欄位」而不是「一支表單」
 *
 * 它被兩個地方用，兩邊的**外殼不同**：
 *   ① 行囊「新增物品」→ 類別選「裝備」時展開
 *   ② 支出對話框「自訂裝備」→ 勾了「這筆有拿到東西」之後展開
 * 但填的東西一模一樣。所以這裡只負責欄位與受控介面（`value` / `onChange`），
 * 送出鈕與驗證留在外殼——那才是兩邊真正不同的地方。
 *
 * ## 全部選填
 *
 * 只有名稱是必填（在外殼擋）。傷害式、屬性、檢定都可以留空——
 * 「GM 給了一把不知道怎麼算的劍」也該記得住，不必為了填滿而編數字。
 */

/** 類別 → 常見傷害式的填空起點（可改，不是規則）。 */
const DAMAGE_HINT = '【HR + 6】';
const CHECK_HINT = 'DEX + MIG';

export const DEFAULT_GEAR = Object.freeze({
  slot: 'mainHand',
  category: '',
  range: '',
  hands: 1,
  check: '',
  damage: '',
  damageType: ''
});

export default function EquipmentItemFields({ value, onChange, theme = {} }) {
  const gear = { ...DEFAULT_GEAR, ...(value || {}) };
  const patch = (changes) => onChange({ ...gear, ...changes });
  const inputClass = 'w-full px-2 py-1 rounded border border-[#e8dcc4] bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]';
  const labelClass = 'block text-t10 text-[#6b5a4b] mb-0.5';

  return (
    <div
      data-testid="equipment-item-fields"
      className="space-y-2 rounded border p-2"
      style={{ borderColor: '#e8dcc4' }}
    >
      {/* 欄位 ＋ 手數 */}
      <div className="space-y-1">
        <span className={labelClass}>裝備欄位</span>
        <div className="flex items-center gap-1 flex-wrap">
          {GEAR_SLOTS.map((s) => (
            <button
              key={s.key}
              type="button"
              data-testid={`gear-slot-${s.key}`}
              aria-pressed={gear.slot === s.key}
              onClick={() => patch({ slot: s.key })}
              className={`px-2 py-0.5 rounded border text-t10 font-bold transition-colors ${
                gear.slot === s.key
                  ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                  : 'bg-[#fffdf9] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 類別 ＋ 遠近 ＋ 手數 */}
      <div className="grid grid-cols-3 gap-1.5">
        <label className="space-y-1">
          <span className={labelClass}>類別</span>
          <select
            data-testid="gear-category"
            aria-label="裝備類別"
            value={gear.category}
            onChange={(e) => patch({ category: e.target.value })}
            className={inputClass}
          >
            <option value="">未分類</option>
            {CUSTOM_WEAPON_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            {['防具', '盾牌', '飾品'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>遠近</span>
          <select
            data-testid="gear-range"
            aria-label="遠近"
            value={gear.range}
            onChange={(e) => patch({ range: e.target.value })}
            className={inputClass}
          >
            <option value="">—</option>
            {CUSTOM_WEAPON_RANGES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className={labelClass}>手數</span>
          <div className="flex items-center gap-1" role="group" aria-label="手數">
            {[1, 2].map((h) => (
              <button
                key={h}
                type="button"
                data-testid={`gear-hands-${h}`}
                aria-pressed={gear.hands === h}
                onClick={() => patch({ hands: h })}
                className={`flex-1 px-1 py-1 rounded border text-t10 font-bold transition-colors ${
                  gear.hands === h
                    ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                    : 'bg-[#fffdf9] text-[#6b5a4b] border-[#e8dcc4] hover:bg-[#f4ebd9]'
                }`}
              >
                {h === 1 ? '單手' : '雙手'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 檢定 ＋ 傷害 ＋ 屬性 */}
      <div className="grid grid-cols-3 gap-1.5">
        <label className="space-y-1">
          <span className={labelClass}>命中檢定</span>
          <input
            type="text"
            data-testid="gear-check"
            aria-label="命中檢定"
            value={gear.check}
            onChange={(e) => patch({ check: e.target.value })}
            placeholder={CHECK_HINT}
            className={inputClass}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>傷害式</span>
          <input
            type="text"
            data-testid="gear-damage"
            aria-label="傷害式"
            value={gear.damage}
            onChange={(e) => patch({ damage: e.target.value })}
            placeholder={DAMAGE_HINT}
            className={inputClass}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>傷害屬性</span>
          <select
            data-testid="gear-damage-type"
            aria-label="傷害屬性"
            value={gear.damageType}
            onChange={(e) => patch({ damageType: e.target.value })}
            className={inputClass}
          >
            <option value="">—</option>
            {(DAMAGE_TYPES || []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
