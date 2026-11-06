import React, { useEffect, useState } from 'react';
import JRPGModal from '../../../components/ui/JRPGModal';
import { INVENTORY_CATEGORIES } from '../utils/inventory';
import EquipmentItemFields, { DEFAULT_GEAR } from './EquipmentItemFields';

/**
 * 新增／編輯行囊物品（2026-11-03）。
 *
 * 只有四個欄位，因為跑團中記東西的時間很短：**名稱、類別、價值、效果**。
 * 數量預設 1，只有真的需要堆疊時才改——多一個常駐欄位就是多一次「這格要填嗎」的猶豫。
 */
export default function BackpackItemModal({ isOpen, onClose, onSubmit, initial = null }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('equipment');
  const [value, setValue] = useState('');
  const [effect, setEffect] = useState('');
  const [qty, setQty] = useState('1');
  // 裝備類才有的欄位（2026-11-03 使用者第二輪）：傷害／類別／屬性／檢定……
  const [gear, setGear] = useState({ ...DEFAULT_GEAR });
  // 消耗品專屬效果模型
  const [healHp, setHealHp] = useState('');
  const [healMp, setHealMp] = useState('');
  const [isPotion, setIsPotion] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(initial?.name || '');
    setCategory(initial?.category || 'equipment');
    setValue(initial?.value === null || initial?.value === undefined ? '' : String(initial.value));
    setEffect(initial?.effect || '');
    setQty(String(initial?.qty || 1));
    setGear({ ...DEFAULT_GEAR, ...(initial?.gear || {}) });
    setHealHp(initial?.effectModel?.healHp ? String(initial.effectModel.healHp) : '');
    setHealMp(initial?.effectModel?.healMp ? String(initial.effectModel.healMp) : '');
    setIsPotion(Boolean(initial?.effectModel?.isPotion));
  }, [isOpen, initial]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const effectModel = category === 'consumable' && (healHp || healMp || isPotion)
      ? {
          healHp: Math.max(0, parseInt(healHp, 10) || 0),
          healMp: Math.max(0, parseInt(healMp, 10) || 0),
          isPotion
        }
      : undefined;
    onSubmit({ name: trimmed, category, value, effect, qty, gear, effectModel });
  };

  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title="記一件物品" maxWidth="max-w-md">
      <div className="space-y-3 text-xs">
        <div>
          <label className="font-bold text-[#3c2415] block mb-1">名稱</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="backpack-form-name"
            placeholder="破咒之刃"
            className="w-full px-2 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415]"
          />
        </div>

        <div>
          <label className="font-bold text-[#3c2415] block mb-1">類別</label>
          <div className="flex gap-1 flex-wrap">
            {INVENTORY_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                aria-pressed={category === c.key}
                data-testid={`backpack-form-cat-${c.key}`}
                className={`px-2 py-0.5 rounded border text-t11 font-bold transition-colors ${
                  category === c.key
                    ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]'
                    : 'bg-[#fffdf9] border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#f4ebd9]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-bold text-[#3c2415] block mb-1">價值（z）</label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="backpack-form-value"
              placeholder="留空＝未定"
              className="w-full px-2 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] tabular-nums text-[#3c2415]"
            />
          </div>
          <div>
            <label className="font-bold text-[#3c2415] block mb-1">數量</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] tabular-nums text-[#3c2415]"
            />
          </div>
        </div>

        {category === 'equipment' && (
          <EquipmentItemFields value={gear} onChange={setGear} />
        )}

        {category === 'consumable' && (
          <div className="p-2 rounded bg-[#f4ebd9] border border-[#d6c7ab] space-y-2">
            <span className="font-bold text-t11 text-[#3c2415] block">消耗品效果參數（供戰鬥/藥水雨/過期食品結算）</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-t10 font-bold text-[#6b5a4b] block mb-0.5">回復 HP 點數</label>
                <input
                  type="number"
                  min="0"
                  value={healHp}
                  onChange={(e) => setHealHp(e.target.value)}
                  placeholder="例：40"
                  className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fffdf9] text-[#3c2415]"
                />
              </div>
              <div>
                <label className="text-t10 font-bold text-[#6b5a4b] block mb-0.5">回復 MP 點數</label>
                <input
                  type="number"
                  min="0"
                  value={healMp}
                  onChange={(e) => setHealMp(e.target.value)}
                  placeholder="例：40"
                  className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fffdf9] text-[#3c2415]"
                />
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-t11 font-bold text-[#3c2415] cursor-pointer">
              <input
                type="checkbox"
                checked={isPotion}
                onChange={(e) => setIsPotion(e.target.checked)}
                className="rounded border-[#d6c7ab]"
              />
              <span>此消耗品屬於「藥水／靈藥（Potion/Elixir）」</span>
            </label>
          </div>
        )}

        <div>
          <label className="font-bold text-[#3c2415] block mb-1">效果</label>
          <textarea
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            rows={3}
            placeholder="對魔法生物傷害 +5"
            className="w-full px-2 py-1.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-[#3c2415] leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded border border-[#d6c7ab] bg-[#fffdf9] text-[#6b5a4b] font-bold"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            data-testid="backpack-form-submit"
            className="px-3 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold"
          >
            記下
          </button>
        </div>
      </div>
    </JRPGModal>
  );
}
