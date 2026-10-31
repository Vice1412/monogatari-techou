import React, { useMemo, useState } from 'react';
import {
  GiCoins,
  GiMagnifyingGlass,
  GiCrossedSwords,
  GiRoundShield,
  GiChest,
  GiRing,
  GiQuillInk
} from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import rulesData from '../data/rulesData.json';
import { describeItem, PURCHASE_SOURCES } from '../data/itemDetail';
import { EQUIPMENT_SLOTS } from '../utils/equipmentRules';
import { describePurchase, formatZenit } from '../utils/zenitFeedback';
import WeaponTemplateFields from './WeaponTemplateFields';
import {
  GATED_BUTTON_CLASS,
  GATED_LABEL_CLASS,
  GATED_SHELL_CLASS
} from '../utils/playAvailability';

/**
 * 購買彈窗（P9，2026-10-31）
 *
 * ## 為什麼需要這個彈窗
 *
 * 改動前，「買東西」在 App 裡**不是一個動作**，是一個心算過程：
 * 玩家看裝備選單的價格 → 回面板按 `−200` → 自己想辦法記住買了什麼。
 * 價格與扣款之間沒有任何連線，所以錢自然「沒有表現出來」——
 * 它根本沒有參與那件事。
 *
 * 這個彈窗把三件事綁在同一個地方：
 *   1. **價格**（書上的 `cost`，唯一來源 `rulesData.equipment`）
 *   2. **算式**（`500z - 200z = 300z`——玩家要確認的是「買完還剩多少」）
 *   3. **後果**（買不起差多少、裝備會覆蓋哪一件）
 *
 * ## 呈現原則（沿用 `EquipmentPickerModal` 的四條）
 *
 * - 顯示後果，不顯示規格：飾品寫效果，武器寫命中與傷害式。
 * - **不能買的原因要在按之前看見**，而且寫在按鈕旁邊（不是 tooltip 裡）。
 * - 買不起**不隱藏**——隱藏會讓人以為「這東西不存在」，而不是「我買不起」。
 *   這是與裝備選單刻意不同的地方：那裡隱藏的是「職業裝備不了」（永久），
 *   這裡隱藏的是「錢不夠」（暫時）。
 * - 價格一律走 `formatZenit`，不要在這裡自己拼字串。
 *
 * 內容本體 `PurchaseModalBody` 與外殼分離，前者可獨立做 SSR 煙霧測試
 * （`JRPGModal` 以掛載後的 effect 為閘門，SSR 時不渲染 children）。
 */

/**
 * 四個採購分類。`slot` 是「購入後裝備到哪裡」；`source` 對應 `rulesData.equipment` 的鍵。
 *
 * 純資料（id／label／source／slot）住在 `data/itemDetail.js`，這裡只把**圖示**接上去。
 * 分開的理由：`utils/startingFunds.js` 也要認得同一份來源，而它是純函式、不該 import `.jsx`。
 */
export const PURCHASE_CATEGORIES = Object.freeze(
  PURCHASE_SOURCES.map((source) => ({
    ...source,
    icon: {
      weapons: GiCrossedSwords,
      shields: GiRoundShield,
      armors: GiChest,
      accessories: GiRing
    }[source.id]
  }))
);

/**
 * 把四類裝備攤平成「可以買的清單」。
 *
 * `cost <= 0` 一律不收：`徒手打擊`、`臨時武器`、`無盾牌`、`無裝甲` 是
 * **空槽位的替身**，不是商品。把它們列出來等於叫玩家花 0z 買「空手」。
 */
export const buildPurchaseCatalog = (equipment = rulesData.equipment) => {
  const list = [];
  PURCHASE_CATEGORIES.forEach((category) => {
    const items = Array.isArray(equipment?.[category.source]) ? equipment[category.source] : [];
    items.forEach((item) => {
      const cost = Number(item?.cost);
      if (!item?.name || !Number.isFinite(cost) || cost <= 0) return;
      list.push({
        id: `${category.id}:${item.name}`,
        name: item.name,
        cost,
        categoryId: category.id,
        categoryLabel: category.label,
        slot: category.slot,
        detail: describeItem(item, category.id)
      });
    });
  });
  return list;
};

/** 篩選 ＋ 排序：先分類，再名稱搜尋；同類內由便宜到貴（買東西的人在意的是價格）。 */
export const filterCatalog = (catalog = [], { categoryId = 'all', query = '' } = {}) => {
  const keyword = String(query || '').trim();
  return catalog
    .filter((item) => (categoryId === 'all' ? true : item.categoryId === categoryId))
    .filter((item) => (keyword === '' ? true : item.name.includes(keyword) || item.detail.includes(keyword)))
    .sort((a, b) => (a.cost - b.cost) || a.name.localeCompare(b.name, 'zh-Hant'));
};

/**
 * 結帳鈕為什麼不能按——**三種狀態、三句話**。
 *
 * 這三句必須分開，因為它們在斷言三件不同的事：
 *   - 「先選一件品項」＝ 還沒決定要買什麼（不是錢的問題）
 *   - 「錢包金額尚未記錄」＝ **我不知道你有多少錢**（不是你不夠）
 *   - 「資金不足：還差 300z」＝ 我知道，而且不夠
 *
 * 第一版把「沒選東西」也歸進第二句，於是剛打開彈窗就說「錢包金額尚未記錄」——
 * 錢包明明寫在左上角。測試 G8 抓到的就是這個：**同一個空值被講成兩件事**。
 */
export const describeCheckoutBlock = ({ hasSelection, gate } = {}) => {
  if (!hasSelection) return '先選一件品項';
  if (gate?.affordable === true) return '';
  if (gate?.affordable === null) return '錢包金額尚未記錄，無法結帳';
  return `資金不足：${gate?.shortText || ''}`;
};

export function PurchaseModalBody({
  theme = {},
  character,
  wallet,
  onConfirm,
  onClose
}) {
  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [equipAfter, setEquipAfter] = useState(true);
  // `'list'` ＝ 書上的品項；`'custom'` ＝ 自己寫一把（P9-c）。
  // 用模式而不是第五個分類，因為它不是「一類商品」——它沒有價格、沒有規格，
  // 它是一個**空白的表格**。放進分類列會讓它看起來像「書上有一類叫自訂武器」。
  const [mode, setMode] = useState('list');

  const catalog = useMemo(() => buildPurchaseCatalog(rulesData.equipment), []);
  const visible = useMemo(
    () => filterCatalog(catalog, { categoryId, query }),
    [catalog, categoryId, query]
  );

  const selected = useMemo(
    () => catalog.find((item) => item.id === selectedId) || null,
    [catalog, selectedId]
  );

  const gate = describePurchase({ price: selected?.cost, wallet });
  const slotLabel = selected ? (EQUIPMENT_SLOTS[selected.slot]?.label || '') : '';
  const currentInSlot = selected && character?.equipment ? character.equipment[selected.slot] : '';
  const willReplace = equipAfter && selected && currentInSlot && currentInSlot !== selected.name;

  // 只有 `affordable === true` 才放行。`null`（不知道錢包有多少）不放行，
  // 但**文案不同**——說「買不起」是在斷言一件我們其實不知道的事。
  const blockedReason = describeCheckoutBlock({ hasSelection: Boolean(selected), gate });

  const handleConfirm = () => {
    if (!selected) return;
    if (gate.affordable !== true) return;
    onConfirm(selected, { equip: equipAfter });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 錢包 ＋ 搜尋 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border bg-[#fbf7ee] tabular-nums font-black text-[#3c2415]"
          style={{ borderColor: theme.border }}
        >
          <GiCoins className="w-4 h-4 text-[#6b5a4b]" />
          <span data-testid="purchase-wallet">{formatZenit(wallet)}</span>
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <GiMagnifyingGlass className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7c6a58]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋品項名稱或效果"
            aria-label="搜尋品項"
            className="w-full pl-8 pr-2.5 py-1.5 rounded border border-[#e8dcc4] bg-[#fbf7ee] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
          />
        </div>
      </div>

      {/* 自己寫一把（P9-c）：書上只有基礎武器，而跑團現場會出現書上沒有的東西。 */}
      {mode === 'custom' && (
        <WeaponTemplateFields
          theme={theme}
          wallet={wallet}
          submitLabel="購入並裝備"
          onSubmit={({ item, spec }) => onConfirm(item, { equip: true, spec })}
          onBack={() => setMode('list')}
        />
      )}

      {mode === 'list' && (
        <>
        {/* 分類 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[{ id: 'all', label: '全部' }, ...PURCHASE_CATEGORIES].map((cat) => {
            const active = categoryId === cat.id;
            const IconComp = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                data-testid={`purchase-cat-${cat.id}`}
                aria-pressed={active}
                onClick={() => setCategoryId(cat.id)}
                className={`px-2.5 py-1 rounded border font-bold flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                    : 'bg-[#fbf7ee] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                }`}
              >
                {IconComp ? <IconComp className="w-3.5 h-3.5" /> : null}
                <span>{cat.label}</span>
              </button>
            );
          })}
          {/* 第五顆不是分類，是「書上沒有的東西」的出口。
              放在分類列的最右邊，因為玩家的心智動線是「我要買武器 → 找不到 → 那我自己寫」。 */}
          <button
            type="button"
            data-testid="purchase-cat-custom"
            onClick={() => setMode('custom')}
            className="px-2.5 py-1 rounded border border-dashed border-[#a63d40] bg-[#fffdf9] text-[#8c3235] font-bold flex items-center gap-1 hover:bg-[#f9f5eb] transition-colors"
          >
            <GiQuillInk className="w-3.5 h-3.5" />
            <span>自訂武器</span>
          </button>
        </div>

        {/* 清單 */}
        <div data-testid="purchase-list" className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
          {visible.length === 0 ? (
            <div className="py-8 text-center text-[#6b5a4b]">沒有符合條件的品項。</div>
          ) : visible.map((item) => {
            const active = item.id === selectedId;
            const rowGate = describePurchase({ price: item.cost, wallet });
            const affordable = rowGate.affordable !== false;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`purchase-item-${item.name}`}
                aria-pressed={active}
                onClick={(e) => {
                  setSelectedId(item.id);
                  // 選了就把那一列帶進視野：鍵盤使用者按 Enter 之後，
                  // 清單不一定停在那一列，而結帳條在下方——不帶進視野就等於
                  // 「按了沒反應」。`nearest` 才不會把整頁捲走。
                  e.currentTarget.scrollIntoView({ block: 'nearest' });
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded border flex items-center justify-between gap-2 transition-colors ${
                  active
                    ? 'bg-[#f4ebd9] border-[#3c2415]'
                    : 'bg-[#fffdf9] border-[#e8dcc4] hover:border-[#3c2415]/40'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-[#3c2415]">{item.name}</span>
                  <span className="block text-t10 text-[#6b5a4b] truncate" title={item.detail}>
                    {item.categoryLabel} · {item.detail || '—'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block tabular-nums font-black text-[#3c2415]">{formatZenit(item.cost)}</span>
                  {/* 買不起的短少量印在列上，不是等按下去才知道 */}
                  {!affordable && (
                    <span className="block text-t10 text-[#8c3235]">{rowGate.shortText}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* 結帳條：算式 ＋ 後果 ＋ 動作 */}
        <div className="pt-2.5 border-t space-y-2" style={{ borderColor: theme.border }}>
          {selected ? (
            <>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-[#6b5a4b]">
                  已選 <strong className="text-[#3c2415]">{selected.name}</strong>
                </span>
                <span
                  data-testid="purchase-math"
                  className="tabular-nums font-black text-[#3c2415]"
                >
                  {gate.mathText || '—'}
                </span>
              </div>

              <label className="flex items-center gap-1.5 text-[#6b5a4b] cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="purchase-equip-toggle"
                  checked={equipAfter}
                  onChange={(e) => setEquipAfter(e.target.checked)}
                  className="accent-[#a63d40]"
                />
                <span>購入後裝備到{slotLabel}</span>
                {willReplace && (
                  <span className="text-t10 text-[#8c3235]">（會覆蓋目前的 {currentInSlot}）</span>
                )}
              </label>
            </>
          ) : (
            <div className="text-[#6b5a4b]">選一件品項，這裡會算出買完還剩多少。</div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span data-testid="purchase-blocked-reason" className="text-t11 text-[#8c3235]">
              {blockedReason}
            </span>
            <div className="flex items-center gap-2">
              <JRPGButton variant="outline" size="sm" onClick={onClose}>
                取消
              </JRPGButton>
              <JRPGButton
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                className={gate.affordable === true ? '' : `${GATED_SHELL_CLASS} border-[#d6c7ab] bg-[#e8dcc4] text-[#6b5a4b] hover:bg-[#e8dcc4]`}
                {...(gate.affordable === true
                  ? {}
                  : { 'aria-disabled': 'true', 'data-blocked': 'true', title: blockedReason })}
              >
                <span className={gate.affordable === true ? '' : GATED_LABEL_CLASS}>
                  購入{selected ? ` ${gate.priceText}` : ''}
                </span>
              </JRPGButton>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

/** 彈窗外殼：只負責標題與轉發 props。 */
export default function PurchaseModal({
  isOpen,
  onClose,
  theme,
  character,
  wallet,
  onConfirm
}) {
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title="購買裝備" maxWidth="max-w-2xl" theme={theme}>
      <PurchaseModalBody
        theme={theme}
        character={character}
        wallet={wallet}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </JRPGModal>
  );
}
