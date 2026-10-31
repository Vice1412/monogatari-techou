import React, { useMemo, useState } from 'react';
import { GiCoins, GiMagnifyingGlass, GiBackpack, GiQuillInk } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import { EQUIPMENT_SLOTS } from '../utils/equipmentRules';
import { describePurchase, formatZenit } from '../utils/zenitFeedback';
import { buildPurchaseCatalog, PURCHASE_CATEGORIES } from './PurchaseModal';
import { buildOwnedWeaponItems } from '../data/customWeapons';
import WeaponTemplateFields from './WeaponTemplateFields';
import { GATED_LABEL_CLASS, GATED_SHELL_CLASS } from '../utils/playAvailability';

/**
 * 單一裝備槽的選擇器（P9-b，2026-10-31）
 *
 * ## 為什麼需要它
 *
 * 使用者：「然後背包也要可以選到所有的裝備。」
 *
 * 改動前，行囊分頁的四個槽位是四行**唯讀文字**：
 * `主手武器: 青銅劍`。看得到、換不了，而唯一的換裝入口在編輯器——
 * 但編輯器是「建卡的地方」，跑團中回去改一張已定稿的卡是另一回事。
 *
 * ## 三種狀態，三種價錢
 *
 * 每一列都在回答「我按下去會發生什麼」：
 *   - **目前裝備** → 按了不會有事（灰掉，並說明它就是現在這一件）
 *   - **已在別的槽** → 免費搬過來（同一件東西換位置，不該再收一次錢）
 *   - **還沒有** → 要付標價，買不起就當場說差多少
 *
 * 這三態是這個檔案存在的理由。若只做「一律走購買面板」，
 * 玩家把副手的盾換到主手（守護者【雙重盾牌】）會被收第二次錢。
 *
 * ## 與 `PurchaseModal` 的關係
 *
 * 目錄、分類、價格格式全部沿用 `PurchaseModal` 的 `buildPurchaseCatalog`——
 * 兩個地方各建一份目錄，遲早會有一邊少一件裝備。
 * 差別只在這裡**鎖定一個槽**（`slot`），所以沒有分類切換。
 */

/** 這個槽可以放哪些分類：主手／副手都可能放盾（守護者雙盾），所以用 `slots` 陣列比對。 */
export const slotAccepts = (category, slot) => {
  if (!category || !slot) return false;
  if (category.slot === slot) return true;
  // 守護者【雙重盾牌】：主手也能放盾。判定在 `equipmentRules`，這裡只做清單篩選。
  return slot === 'mainHand' && category.slot === 'offHand';
};

/** 這個槽的候選品項（全部，不篩錢——買不起要看得見，才知道要存多少）。 */
export const catalogForSlot = (catalog = [], slot) => catalog.filter((item) => {
  const category = PURCHASE_CATEGORIES.find((c) => c.id === item.categoryId);
  return slotAccepts(category, slot);
});

/**
 * 一件品項在這個角色身上的持有狀態。
 *
 * 四態而不是布林，因為它們對玩家是**四件不同的事**：
 *   - `current`   已經裝在這個槽 → 按了不會有事
 *   - `elsewhere` 已經有一件、但在別的槽 → 按了是搬家（免費）
 *   - `owned`     你身上有這一把、只是沒裝備 → 按了是裝上去（免費）
 *   - `none`      你沒有 → 按了要付錢
 *
 * `owned` 與 `elsewhere` 的價錢一樣（都免費），但**話不一樣**：
 * 「已在副手武裝，換過來不收費」說的是位置，「你已經有這一把」說的是擁有。
 * 併成一態的話，玩家會看到「已在副手武裝」而自己手上根本沒有盾。
 */
export const describeHeldState = (item, character, slot) => {
  const equipment = character?.equipment || {};
  const holders = Object.keys(EQUIPMENT_SLOTS)
    .filter((key) => equipment[key] === item?.name);

  if (holders.includes(slot)) return { state: 'current', holders };
  if (holders.length > 0) return { state: 'elsewhere', holders };
  // 自己寫／自己鍛的武器：在 `character.customWeapons` 裡，只是還沒裝上去。
  if (item?.owned) return { state: 'owned', holders: [] };
  return { state: 'none', holders };
};

/** 持有狀態 → 畫面上那句話。`''` 代表「不用說，右邊已經印了價格」。 */
export const describeHeldLabel = (held, slot) => {
  if (held?.state === 'current') return '目前裝備';
  if (held?.state === 'elsewhere') {
    const other = held.holders[0];
    return `已在${EQUIPMENT_SLOTS[other]?.label || other}，換過來不收費`;
  }
  if (held?.state === 'owned') return '你已經有這一把，換上去不收費';
  return '';
};

/**
 * 結帳鈕為什麼不能按——**四種狀態、四句話**。
 *
 * 這四句必須分開，因為它們在斷言四件不同的事：
 *   - 「先選一件裝備」＝ 還沒決定（不是錢的問題）
 *   - 「這一件已經裝在這裡了」＝ 按了也不會有變化（不是不能，是不必）
 *   - 「錢包金額尚未記錄」＝ **我不知道你有多少錢**（不是你不夠）
 *   - 「資金不足：還差 300z」＝ 我知道，而且不夠
 *
 * 第一版的第三與第四句是同一句（都印「資金不足」），於是錢包未記錄時
 * 畫面在指控玩家沒錢——而它其實什麼都不知道（MEMORY §D.21）。
 *
 * 抽成純函式而不是寫在 JSX 裡，是為了讓它驗得到：
 * 「還沒選東西」這個狀態在 SSR 裡沒有辦法用點擊製造出來。
 */
export const describeSlotBlock = ({ hasSelection, held, gate } = {}) => {
  if (!hasSelection) return '先選一件裝備';
  if (held?.state === 'current') return '這一件已經裝在這裡了';
  // 已持有（在別的槽，或在自己身上只是沒裝）→ 免費，沒有理由可說。
  if (held?.state === 'elsewhere' || held?.state === 'owned') return '';
  if (gate?.affordable === null) return '錢包金額尚未記錄，無法結帳';
  if (gate?.affordable === false) return `資金不足：${gate?.shortText || ''}`;
  return '';
};

export function EquipmentSlotModalBody({
  theme = {},
  character,
  slot,
  wallet,
  onConfirm,
  onClose
}) {
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  // `'list'` ＝ 書上的品項 ＋ 自己已經有的；`'custom'` ＝ 現場寫一把（P9-c）。
  const [mode, setMode] = useState('list');

  const slotMeta = EQUIPMENT_SLOTS[slot] || {};
  const current = character?.equipment?.[slot] || '';

  const all = useMemo(() => buildPurchaseCatalog(), []);
  // 自己已經有的武器（定制／自訂）也要列進來——不然跑團中換掉之後就再也裝不回去，
  // 因為裝備欄存的是名字，而清單裡沒有那個名字。
  const ownWeapons = useMemo(() => buildOwnedWeaponItems(character), [character]);
  const options = useMemo(
    () => catalogForSlot([...all, ...ownWeapons], slot),
    [all, ownWeapons, slot]
  );

  const visible = useMemo(() => {
    const keyword = query.trim();
    if (keyword === '') return options;
    return options.filter(
      (item) => item.name.includes(keyword) || item.detail.includes(keyword)
    );
  }, [options, query]);

  const selected = useMemo(
    () => options.find((item) => item.name === selectedName) || null,
    [options, selectedName]
  );

  const held = selected ? describeHeldState(selected, character, slot) : null;
  // 免費換裝的兩種情況：在別的槽（搬家）、或本來就是你的（裝上去）。
  const freeSwap = held?.state === 'elsewhere' || held?.state === 'owned';
  const gate = describePurchase({ price: selected?.cost, wallet });

  // 四種狀態四句話（判定在 `describeSlotBlock`，這裡只負責畫）。
  const blockedReason = describeSlotBlock({ hasSelection: Boolean(selected), held, gate });
  const heldLabel = selected ? describeHeldLabel(held, slot) : '';

  const canConfirm = Boolean(selected) && (freeSwap || gate.affordable === true);

  // 自由武器只可能是武器，所以只有接受武器的槽（主手）才給這個入口。
  const canWriteWeapon = slotAccepts(
    PURCHASE_CATEGORIES.find((category) => category.id === 'weapons'),
    slot
  );

  const handleConfirm = () => {
    if (!canConfirm || !selected) return;
    // 覆寫 `slot`：主手可以放盾（守護者【雙重盾牌】），而目錄上的 `slot`
    // 是分類給的 `offHand`。不覆寫的話「在主手換上盾牌」會裝到副手去，
    // 而且畫面上會顯示成功——錯誤發生在看不出來的地方。
    onConfirm({ ...selected, slot }, { owned: freeSwap });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 標題列：槽位 ＋ 現在裝什麼 ＋ 錢包 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border bg-[#fbf7ee] text-[#3c2415]"
          style={{ borderColor: theme.border }}
        >
          <GiBackpack className="w-4 h-4 text-[#6b5a4b]" />
          <span className="font-bold">{slotMeta.label || slot}</span>
          <span className="text-[#6b5a4b]">·</span>
          <span data-testid="slot-current" className="font-black">
            {current || '未裝備'}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border bg-[#fbf7ee] tabular-nums font-black text-[#3c2415]"
          style={{ borderColor: theme.border }}
        >
          <GiCoins className="w-4 h-4 text-[#6b5a4b]" />
          <span data-testid="slot-wallet">{formatZenit(wallet)}</span>
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <GiMagnifyingGlass className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7c6a58]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`搜尋${slotMeta.label || '裝備'}`}
            aria-label="搜尋裝備"
            className="w-full pl-8 pr-2.5 py-1.5 rounded border border-[#e8dcc4] bg-[#fbf7ee] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
          />
        </div>
      </div>

      {/* 現場寫一把（P9-c）：書上只有基礎武器，而跑團現場會出現書上沒有的東西。 */}
      {mode === 'custom' && (
        <WeaponTemplateFields
          theme={theme}
          wallet={wallet}
          submitLabel="購入並裝備"
          onSubmit={({ item, spec }) => onConfirm({ ...item, slot }, { owned: false, spec })}
          onBack={() => setMode('list')}
        />
      )}

      {mode === 'list' && (
        <>
        {canWriteWeapon && (
          <button
            type="button"
            data-testid="slot-write-weapon"
            onClick={() => setMode('custom')}
            className="w-full px-2.5 py-1.5 rounded border border-dashed border-[#a63d40] bg-[#fffdf9] hover:bg-[#f9f5eb] text-[#8c3235] font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <GiQuillInk className="w-3.5 h-3.5" />
            書上沒有這把？自己寫一把
          </button>
        )}

        {/* 清單 */}
        <div data-testid="slot-list" className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
          {visible.length === 0 ? (
            <div className="py-8 text-center text-[#6b5a4b]">沒有符合條件的裝備。</div>
          ) : visible.map((item) => {
            const active = item.name === selectedName;
            const rowHeld = describeHeldState(item, character, slot);
            const rowGate = describePurchase({ price: item.cost, wallet });
            const rowFree = rowHeld.state === 'elsewhere' || rowHeld.state === 'owned';
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`slot-item-${item.name}`}
                aria-pressed={active}
                onClick={() => setSelectedName(item.name)}
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
                  {rowHeld.state === 'current' ? (
                    <span className="block font-black text-[#245c45]">目前裝備</span>
                  ) : rowFree ? (
                    <span className="block font-black text-[#245c45]">
                      {rowHeld.state === 'owned' ? '已擁有' : '已持有'}
                    </span>
                  ) : (
                    <>
                      <span className="block tabular-nums font-black text-[#3c2415]">{formatZenit(item.cost)}</span>
                      {rowGate.affordable === false && (
                        <span className="block text-t10 text-[#8c3235]">{rowGate.shortText}</span>
                      )}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* 結帳條 */}
        <div className="pt-2.5 border-t space-y-2" style={{ borderColor: theme.border }}>
          {selected ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-[#6b5a4b]">
                  已選 <strong className="text-[#3c2415]">{selected.name}</strong>
                </span>
                <span data-testid="slot-math" className="tabular-nums font-black text-[#3c2415]">
                  {freeSwap ? '換裝不收費' : (gate.mathText || '—')}
                </span>
              </div>
              {/* 「已在副手武裝，換過來不收費」——這句話不能只寫在列上。
                  列上寫「已持有」只回答了「我有沒有」，沒有回答「要不要付錢」，
                  而那是玩家按下這顆按鈕前唯一在意的事。 */}
              {heldLabel && (
                <span data-testid="slot-held-label" className="block text-t10 text-[#245c45]">
                  {heldLabel}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[#6b5a4b]">選一件裝備，這裡會算出換上去要花多少。</div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span data-testid="slot-blocked-reason" className="text-t11 text-[#8c3235]">
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
                className={canConfirm ? '' : `${GATED_SHELL_CLASS} border-[#d6c7ab] bg-[#e8dcc4] text-[#6b5a4b] hover:bg-[#e8dcc4]`}
                {...(canConfirm ? {} : { 'aria-disabled': 'true', 'data-blocked': 'true', title: blockedReason })}
              >
                <span className={canConfirm ? '' : GATED_LABEL_CLASS}>
                  {freeSwap ? '換到這裡' : `購入並裝備${selected ? ` ${gate.priceText}` : ''}`}
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

/** 彈窗外殼：`slot` 是唯一新增的參數，其餘與其他彈窗一致。 */
export default function EquipmentSlotModal({
  isOpen,
  onClose,
  theme,
  character,
  slot,
  wallet,
  onConfirm
}) {
  const title = `更換${EQUIPMENT_SLOTS[slot]?.label || '裝備'}`;
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-2xl" theme={theme}>
      <EquipmentSlotModalBody
        theme={theme}
        character={character}
        slot={slot}
        wallet={wallet}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </JRPGModal>
  );
}
