import React, { useMemo, useState } from 'react';
import {
  GiBackpack,
  GiTakeMyMoney,
  GiTrashCan,

  GiChest,
  GiCutDiamond,
  GiPotionBall,
  GiKnapsack
} from 'react-icons/gi';
import { Plus } from 'lucide-react';
import { formatZenit } from '../utils/zenitFeedback';
import EmptyState from '../../../components/ui/EmptyState';
import {
  INVENTORY_CATEGORIES,
  inventoryCategoryLabel,
  describeInventoryTotal,
  describeGearSummary,
  readInventory
} from '../utils/inventory';

/**
 * 行囊物品（遊戲背包，2026-11-03）。
 *
 * 使用者的說法：「可以的話請把這個界面做得更像是遊戲裡的背包界面一些。」
 *
 * ## 為什麼是格子而不是清單
 *
 * 跑團時看行囊只有一個問題：「我身上有什麼？」——那是**掃視**，不是閱讀。
 * 一列一列的文字清單要從左讀到右；格子只要眼睛掃過去就知道有幾個、哪一類。
 * 所以主體是 4×n 的方框格，名稱截斷、數量做成右下角角標，詳細資料留給選中之後的詳情區。
 *
 * ## 沒有稀有度
 *
 * 《FU》的物品沒有「白／綠／藍／紫」這種稀有度分級，所以這裡也**不做**顏色漸層的等級框
 * （那會是憑空發明的規則）。格子的邊框只有兩種狀態：普通、選中。
 * 真正的分類是官方那三個（裝備／消耗品／稀有物品）＋ 一個「雜項」收納格。
 *
 * ## 賣出要輸入金額
 *
 * 原書沒有公定售價，所以按「賣出」會展開一個金額欄，預設填物品價值（最常見的成交價），
 * 玩家可以改。確認之後才移除物品並入帳——**在同一次寫入裡完成**（見 `utils/inventory.js`）。
 */

const ICONS = {
  equipment: GiChest,
  consumable: GiPotionBall,
  rare: GiCutDiamond,
  misc: GiKnapsack
};

const CARD_BASE = 'rounded border transition-colors';

export default function BackpackGrid({
  character,
  theme,
  onChange,
  onAdd,
  onSell,
  onDiscard,
  showToast,
  // 截圖與測試用的注入點：生產端永不傳入（不傳時行為逐字不變）
  initialSelectedId = null
}) {
  const items = readInventory(character);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  // 金額預填「選中那件的價值」——那是最常見的成交價，不是規則（原書沒有公定售價）。
  // 用 lazy initializer 是為了讓注入點（`initialSelectedId`）一進來就有對應金額，
  // 不必等玩家先點一次。生產端不傳注入點時，這一段就是空字串。
  const [sellAmount, setSellAmount] = useState(() => {
    const first = items.find((it) => it.id === initialSelectedId);
    return first && first.value !== null ? String(first.value) : '';
  });

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((it) => it.category === filter)),
    [items, filter]
  );
  const selected = items.find((it) => it.id === selectedId) || null;
  const total = describeInventoryTotal(character);

  const pick = (item) => {
    setSelectedId(item.id);
    // 金額預填物品價值——那是最常見的成交價，不是規則（原書沒有公定售價）
    setSellAmount(item.value === null ? '' : String(item.value));
  };

  const confirmSell = () => {
    if (!selected) return;
    const result = onSell(selected.id, sellAmount);
    if (result?.ok) setSelectedId(null);
  };

  const counts = useMemo(() => {
    const map = { all: items.length };
    INVENTORY_CATEGORIES.forEach((c) => { map[c.key] = 0; });
    items.forEach((it) => { map[it.category] = (map[it.category] || 0) + 1; });
    return map;
  }, [items]);

  return (
    <div className="space-y-2" data-testid="hud-backpack">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
          <GiBackpack className="w-4 h-4 text-[#6b5a4b]" />
          <span>行囊物品</span>
          <span className="text-t10 tabular-nums text-[#7c6a58]">{items.length} 件</span>
        </span>
        <span className="text-t11 text-[#6b5a4b]">
          估值 <strong className="tabular-nums text-[#3c2415]">{formatZenit(total)}</strong>
        </span>
      </div>

      {/* 分類列：全部 ＋ 三個官方類別 ＋ 雜項（括號是件數） */}
      <div className="flex items-center gap-1 flex-wrap">
        {[{ key: 'all', label: '全部' }, ...INVENTORY_CATEGORIES].map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              data-testid={`backpack-filter-${c.key}`}
              aria-pressed={active}
              onClick={() => setFilter(c.key)}
              className={`px-2 py-0.5 rounded border text-t10 font-bold transition-colors ${
                active
                  ? 'bg-[#a63d40] border-[#8c3235] text-[#fffdf9]'
                  : 'bg-[#fffdf9] border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#f4ebd9]'
              }`}
            >
              {c.label}
              <span className={`ml-1 tabular-nums ${active ? 'opacity-80' : 'text-[#7c6a58]'}`}>
                {counts[c.key] || 0}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          data-testid="backpack-add"
          onClick={onAdd}
          className="ml-auto px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] font-bold text-t10 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" />
          新增物品
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          kind="backpack"
          icon={GiBackpack}
          title="行囊是空的"
          teach="冒險途中拿到的裝備、消耗品與稀有物品都可以記在這裡。"
          action={{ label: '新增物品', onClick: onAdd }}
        />
      ) : visible.length === 0 ? (
        <p className="p-4 text-center text-t12 text-[#6b5a4b]">這個分類沒有東西。</p>
      ) : (
        /* 格子：4 欄，一格 1:1 的方框。名稱在圖示下面截斷，數量做成右下角角標。 */
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {visible.map((it) => {
            const Icon = ICONS[it.category] || GiKnapsack;
            const active = it.id === selectedId;
            return (
              <button
                key={it.id}
                type="button"
                data-testid={`backpack-item-${it.id}`}
                aria-pressed={active}
                onClick={() => pick(it)}
                title={`${it.name}${it.value !== null ? ` · ${it.value}z` : ''}`}
                className={`${CARD_BASE} relative aspect-square flex flex-col items-center justify-center gap-0.5 p-1 ${
                  active
                    ? 'bg-[#f4ebd9] border-[#a63d40]'
                    : 'bg-[#fffdf9] border-[#d6c7ab] hover:bg-[#fbf7ee] hover:border-[#3c2415]/40'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-[#8c3235]' : 'text-[#6b5a4b]'}`} />
                <span className="w-full text-t12 font-bold text-[#3c2415] text-center truncate leading-tight">
                  {it.name}
                </span>
                {it.qty > 1 && (
                  <span className="absolute bottom-0.5 right-1 tabular-nums text-t10 font-black text-[#3c2415]">
                    ×{it.qty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 詳情區：選中一格才出現。賣出是展開式金額欄，不另開彈窗。 */}
      {selected && (
        <div
          data-testid="backpack-detail"
          className="p-2.5 rounded border space-y-1.5"
          style={{ borderColor: '#e8dcc4', backgroundColor: '#fbf7ee' }}
        >
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="font-serif font-black text-sm text-[#3c2415]">{selected.name}</span>
            <span className="text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#6b5a4b] font-bold">
              {inventoryCategoryLabel(selected.category)}
            </span>
          </div>
          <div className="text-t11 text-[#6b5a4b] tabular-nums">
            {selected.value === null ? '價值未定' : `價值 ${formatZenit(selected.value)}`}
            {selected.qty > 1 ? ` · 數量 ${selected.qty}` : ''}
          </div>
          {describeGearSummary(selected.gear) && (
            <div data-testid="backpack-gear-summary" className="text-t11 text-[#2c221e] font-bold">
              {describeGearSummary(selected.gear)}
            </div>
          )}
          {selected.effect && (
            <p className="text-t11 text-[#3c2415] leading-relaxed whitespace-pre-wrap">{selected.effect}</p>
          )}

          {/* 賣出金額**常駐**（2026-11-03 第二版）：使用者要的是「輸入金額才把東西賣出去」，
              做成「先按賣出、再展開金額」等於多一層點擊。金額預設填物品價值（最常見的成交價），
              玩家可以改——原書沒有公定售價，賣多少由 GM 與情境決定。 */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-t11 text-[#6b5a4b] font-bold">售出金額</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              data-testid="backpack-sell-amount"
              placeholder="0"
              className="w-20 px-1.5 py-0.5 rounded border border-[#d6c7ab] bg-[#fffdf9] font-mono text-t11 text-[#3c2415]"
            />
            <span className="text-t11 text-[#6b5a4b]">z</span>
            <button
              type="button"
              data-testid="backpack-sell-confirm"
              onClick={confirmSell}
              className="px-2 py-0.5 rounded bg-[#245c45] hover:bg-[#1e4b39] text-[#fffdf9] font-bold text-t11 flex items-center gap-1"
            >
              <GiTakeMyMoney className="w-3 h-3" />
              賣出
            </button>
            <button
              type="button"
              data-testid="backpack-discard"
              onClick={() => { onDiscard(selected.id); setSelectedId(null); }}
              className="ml-auto px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#f4ebd9] text-[#8c3235] font-bold text-t11 flex items-center gap-1"
            >
              <GiTrashCan className="w-3 h-3" />
              丟棄
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
