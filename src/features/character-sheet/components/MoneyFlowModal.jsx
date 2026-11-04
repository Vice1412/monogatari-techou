import React, { useMemo, useState } from 'react';
import { GiCoins, GiPayMoney, GiReceiveMoney } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import rulesData from '../data/rulesData.json';
import { EQUIPMENT_SLOTS } from '../utils/equipmentRules';
import {
  DIRECTION_LABELS,
  MONEY_DIRECTIONS,
  describeEquipmentRecord,
  describeMoneyFlow,
  formatZenit
} from '../utils/zenitFeedback';
import { buildPurchaseCatalog } from './PurchaseModal';
import { GATED_LABEL_CLASS, GATED_SHELL_CLASS } from '../utils/playAvailability';
import { createInventoryItem } from '../utils/inventory';
import { EquipmentPickerBody } from './EquipmentPickerModal';
import { calculateCharacterStats } from '../utils/characterEngine';
import EquipmentItemFields, { DEFAULT_GEAR } from './EquipmentItemFields';

/**
 * 收支對話框（P9-b，2026-10-31）
 *
 * ## 為什麼需要它
 *
 * 上一輪（§CI67）補了「買裝備」，但跑團中花錢的地方遠多於買裝備：住宿、餐費、
 * 修裝、賄賂、給嚮導的報酬……這些原本只能按錢包旁邊的 `−N`。
 * 按完之後履歷上寫的是「支出資金 350 → 300」——**沒有原因**。
 *
 * 使用者：「要讓玩家寫是花費/增加金錢是什麼原因。」
 *
 * 所以這個對話框把「金額」與「原因」綁在一起：**沒有原因不能送出**。
 * 不是為了嚴格，是因為沒有原因的支出事後一定會被自己問「這 300z 花在哪」。
 *
 * ## 裝備模板
 *
 * 使用者：「如果是裝備的話就要給一個模板，讓玩家可以把買到的裝備以正確的格式記錄在案。」
 *
 * 這裡的「選填：這是買裝備」區塊做的就是這件事：選了品項之後
 *   - 金額自動帶入書上的價格（可改——GM 可能給折扣）
 *   - 下方即時顯示**履歷會長什麼樣**（`購入 青銅劍` / `近戰武器 · … · 200z · 裝備到主手武器`）
 *   - 原因自動帶入品名（可改）
 *
 * 格式本身不在這裡寫，在 `describeEquipmentRecord`——與購買面板同一個函式，
 * 否則同一次購買會有兩種寫法。
 *
 * ## 與 `describeMoneyFlow` 的分工
 *
 * 判定（能不能送、餘額多少、算式怎麼寫）全部在純函式裡，這裡只負責畫。
 * 三個欄位的錯誤各自回一個字串，因為要**分別**標紅那一個欄位——
 * 全部擠在底部一行「請填寫完整」等於沒說哪裡沒填。
 */

/**
 * 快捷原因。**不是選單，是填空的起點**：點一下填進輸入框，玩家仍可改。
 *
 * 分成兩個方向而不是共用一份，因為「住宿」不會是收入、「報酬」不會是支出。
 * 這份清單刻意短——列太長就變成另一個要讀完的介面，而這裡只是「省打字」。
 */
export const MONEY_FLOW_PRESETS = Object.freeze({
  spend: ['住宿', '餐費', '交通', '情報', '修裝', '藥品', '賄賂'],
  gain: ['任務報酬', '戰利品', '變賣', '借貸', '補助']
});

/**
 * 一句話說明「這一格要填什麼」——隨方向改變。
 *
 * 同一個輸入框在兩個方向下問的是不同的問題（花在哪／從哪來），
 * 而 placeholder 是唯一會跟著變的提示。
 */
export const describeReasonHint = (direction) => (
  direction === MONEY_DIRECTIONS.gain
    ? '例：交了護衛任務的委託單'
    : '例：在旅店住了兩晚'
);

export function MoneyFlowModalBody({
  theme = {},
  character,
  wallet,
  onConfirm,
  onClose,
  // 從「收入」按鈕打開時，方向就已經決定了——不該讓玩家再選一次。
  // 方向仍然是可改的（按鈕就在上面），只是起點不同：玩家按的是「收入」，
  // 打開卻是「支出」，那一個動作就白做了。
  initialDirection = MONEY_DIRECTIONS.spend,
  // 注入點（生產端永不傳入）：讓截圖與測試能看到「勾選後」的兩個分支
  initialWantsItem = false,
  initialItemKind = 'equipment',
  initialShowPicker = false
}) {
  const [direction, setDirection] = useState(
    initialDirection === MONEY_DIRECTIONS.gain ? MONEY_DIRECTIONS.gain : MONEY_DIRECTIONS.spend
  );
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [wantsItem, setWantsItem] = useState(initialWantsItem);
  // 2026-11-03：使用者裁定「支出與購入意思重複，合併成一個」。
  // 所以這一筆支出可以**順便**帶回一件東西：先問「是不是裝備」，
  //   是 → 官方裝備表挑一件（可勾「同時裝備到槽位」），**一律收進行囊**
  //   否 → 像新增物品那樣自己填（名稱／類別／價值／效果）
  const [itemKind, setItemKind] = useState(initialItemKind);
  const [itemId, setItemId] = useState('');
  const [equipAfter, setEquipAfter] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherCategory, setOtherCategory] = useState('rare');
  const [otherEffect, setOtherEffect] = useState('');
  // 官方裝備改用建卡那一套篩選介面（使用者：「應該要像車卡選裝備一模一樣的界面」）
  const [equipSlot, setEquipSlot] = useState('mainHand');
  const [showPicker, setShowPicker] = useState(initialShowPicker);
  // 裝備分支的兩種取得方式：從官方表挑 / 自己寫（不在表上的裝備，2026-11-03 第二輪）
  const [equipMode, setEquipMode] = useState('table');
  const [gear, setGear] = useState({ ...DEFAULT_GEAR });

  const catalog = useMemo(() => buildPurchaseCatalog(rulesData.equipment), []);
  const stats = useMemo(() => calculateCharacterStats(character), [character]);
  const item = useMemo(
    () => catalog.find((entry) => entry.id === itemId) || null,
    [catalog, itemId]
  );

  const flow = describeMoneyFlow({ direction, amount, reason, wallet });
  const slotLabel = item ? (EQUIPMENT_SLOTS[item.slot]?.label || '') : '';
  const template = item ? describeEquipmentRecord(item, { equip: equipAfter, slotLabel }) : null;

  // 履歷會記成什麼：有裝備走模板，沒有走「支出 · 住宿」。
  const recordTitle = template ? template.title : flow.title;
  const recordNote = template ? template.note : '';

  const presets = MONEY_FLOW_PRESETS[direction] || [];


  const handleSubmit = () => {
    if (!flow.ok) return;

    // 這一筆有沒有「順便拿到東西」→ 轉成一筆行囊物品（形狀由 `createInventoryItem` 收斂）。
    // 裝備類一律**收進行囊**（使用者原話：「然後收進下面的行囊裡」），
    // 「同時裝備到槽位」只是可選的第二步，不影響它有沒有被記下來。
    let inventoryItem = null;
    if (wantsItem) {
      if (itemKind === 'equipment') {
        if (equipMode === 'custom') {
          // 自訂裝備：名稱必填，其餘欄位（傷害／屬性／檢定…）全部選填
          if (!otherName.trim()) return;
          inventoryItem = createInventoryItem({
            name: otherName,
            category: 'equipment',
            value: amount,
            effect: otherEffect,
            qty: 1,
            gear
          });
        } else {
          if (!item) return;
          inventoryItem = createInventoryItem({
            name: item.name,
            category: 'equipment',
            value: item.cost,
            effect: '',
            qty: 1,
            gear: null
          });
        }
      } else {
        if (!otherName.trim()) return;
        inventoryItem = createInventoryItem({
          name: otherName,
          category: otherCategory,
          // 價值預設就是這筆的金額——買多少錢就是它值多少，除非玩家自己改
          value: otherCategory === 'misc' ? '' : amount,
          effect: otherEffect,
          qty: 1
        });
      }
    }

    onConfirm({
      direction,
      amount: flow.amount,
      reason: flow.reason,
      item: itemKind === 'equipment' ? item : null,
      equip: itemKind === 'equipment' && item ? equipAfter : false,
      slotLabel,
      inventoryItem
    });
  };

  const isSpend = direction === MONEY_DIRECTIONS.spend;
  const DirectionIcon = isSpend ? GiPayMoney : GiReceiveMoney;

  return (
    <div className="space-y-3 text-xs">
      {/* 錢包 ＋ 方向 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border bg-[#fbf7ee] tabular-nums font-black text-[#3c2415]"
          style={{ borderColor: theme.border }}
        >
          <GiCoins className="w-4 h-4 text-[#6b5a4b]" />
          <span data-testid="moneyflow-wallet">{formatZenit(wallet)}</span>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="收支方向">
          {[MONEY_DIRECTIONS.spend, MONEY_DIRECTIONS.gain].map((dir) => {
            const active = direction === dir;
            const Icon = dir === MONEY_DIRECTIONS.spend ? GiPayMoney : GiReceiveMoney;
            return (
              <button
                key={dir}
                type="button"
                data-testid={`moneyflow-direction-${dir}`}
                aria-pressed={active}
                onClick={() => setDirection(dir)}
                className={`px-2.5 py-1 rounded border font-bold flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                    : 'bg-[#fbf7ee] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{DIRECTION_LABELS[dir]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 金額 */}
      <div className="space-y-1">
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold text-[#3c2415]">
            <DirectionIcon className="w-3.5 h-3.5 inline-block align-text-bottom text-[#6b5a4b]" />
            {' '}金額
          </span>
          {flow.errors.amount && (
            <span data-testid="moneyflow-error-amount" className="text-t11 text-[#8c3235]">
              {flow.errors.amount}
            </span>
          )}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            data-testid="moneyflow-amount"
            aria-label="金額"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="0"
            className={`w-28 px-2.5 py-1.5 rounded border bg-[#fffdf9] text-xs tabular-nums font-black text-[#3c2415] outline-none focus:border-[#3c2415] ${
              flow.errors.amount ? 'border-[#8c3235]' : 'border-[#e8dcc4]'
            }`}
          />
          <span className="text-[#6b5a4b]">z</span>
          {/* 算式：玩家要確認的是「這筆之後還剩多少」，不是「我填了幾位數」 */}
          <span data-testid="moneyflow-math" className="ml-auto tabular-nums font-black text-[#3c2415]">
            {flow.mathText || '—'}
          </span>
        </div>
      </div>

      {/* 原因（必填） */}
      <div className="space-y-1">
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold text-[#3c2415]">
            原因 <span className="font-normal text-[#6b5a4b]">（必填）</span>
          </span>
          {flow.errors.reason && (
            <span data-testid="moneyflow-error-reason" className="text-t11 text-[#8c3235]">
              {flow.errors.reason}
            </span>
          )}
        </label>
        <input
          type="text"
          data-testid="moneyflow-reason"
          aria-label="原因"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={describeReasonHint(direction)}
          className={`w-full px-2.5 py-1.5 rounded border bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415] ${
            flow.errors.reason ? 'border-[#8c3235]' : 'border-[#e8dcc4]'
          }`}
        />
        <div className="flex items-center gap-1 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`moneyflow-preset-${preset}`}
              onClick={() => setReason(preset)}
              className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#6b5a4b] text-t10 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* 選填：這筆有拿到東西（2026-11-03 取代原本的「買裝備」單一路徑） */}
      <div className="pt-2 border-t space-y-1.5" style={{ borderColor: theme.border }}>
        <label className="flex items-center gap-1.5 text-[#6b5a4b] cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="moneyflow-item-toggle"
            checked={wantsItem}
            onChange={(e) => {
              // 勾選**不自動選品項**：自動挑第一件會讓金額與原因被一段沒人要求的
              // 內容填滿（使用者只是勾了一個框，卻看到「青銅劍 200z」）。
              // 取消勾選才清掉，因為那時玩家已經明確說「這筆沒拿到東西」。
              setWantsItem(e.target.checked);
              if (!e.target.checked) setItemId('');
            }}
            className="accent-[#a63d40]"
          />
          <span>這筆有拿到東西</span>
        </label>

        {wantsItem && (
          <div className="space-y-1.5 pl-5">
            {/* 是不是裝備？兩條路後面的欄位完全不同，所以在這裡就分岔 */}
            <div className="flex items-center gap-1" role="group" aria-label="拿到的東西是裝備嗎">
              <span className="text-t11 text-[#6b5a4b]">是裝備嗎</span>
              {[{ key: 'equipment', label: '裝備' }, { key: 'other', label: '不是' }].map((k) => (
                <button
                  key={k.key}
                  type="button"
                  data-testid={`moneyflow-item-kind-${k.key}`}
                  aria-pressed={itemKind === k.key}
                  onClick={() => setItemKind(k.key)}
                  className={`px-2 py-0.5 rounded border text-t11 font-bold transition-colors ${
                    itemKind === k.key
                      ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                      : 'bg-[#fbf7ee] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {itemKind === 'equipment' ? (
              <div className="space-y-1.5">
                {/* 2026-11-03（使用者）：「裝備不能這樣選表，應該要像車卡選裝備一模一樣的界面
                    可以篩選，而且也要支持輸入自訂裝備的面板。」

                    所以官方裝備直接內嵌**建卡那一支** `EquipmentPickerBody`（搜尋／分類／
                    射程／雙手／只看買得起／排序全部照舊），不另外做一份簡化版。
                    四個欄位各自對應一張表，所以先選欄位再開清單。 */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-t11 text-[#6b5a4b]">欄位</span>
                  {Object.entries(EQUIPMENT_SLOTS).map(([key, def]) => (
                    <button
                      key={key}
                      type="button"
                      data-testid={`moneyflow-equip-slot-${key}`}
                      aria-pressed={equipSlot === key}
                      onClick={() => { setEquipSlot(key); setShowPicker(true); }}
                      className={`px-2 py-0.5 rounded border text-t10 font-bold transition-colors ${
                        equipSlot === key
                          ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                          : 'bg-[#fbf7ee] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                      }`}
                    >
                      {def.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    data-testid="moneyflow-equip-custom"
                    aria-pressed={equipMode === 'custom'}
                    onClick={() => setEquipMode(equipMode === 'custom' ? 'table' : 'custom')}
                    className={`px-2 py-0.5 rounded border text-t10 font-bold transition-colors ${
                      equipMode === 'custom'
                        ? 'bg-[#a63d40] text-[#fffdf9] border-[#8c3235]'
                        : 'bg-[#fffdf9] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                    }`}
                  >
                    自訂裝備
                  </button>
                </div>

                {equipMode === 'custom' ? (
                  /* 自訂裝備 = 不在官方表上的裝備（不是「不是裝備」）。
                     名稱、欄位、類別、遠近、手數、檢定、傷害式、傷害屬性，
                     全部都在 `EquipmentItemFields` 裡——與行囊的「新增物品」共用同一組欄位。 */
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      data-testid="moneyflow-gear-name"
                      aria-label="裝備名稱"
                      value={otherName}
                      onChange={(e) => setOtherName(e.target.value)}
                      placeholder="例：守墓人的鏽劍"
                      className="w-full px-2 py-1.5 rounded border border-[#e8dcc4] bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
                    />
                    <EquipmentItemFields value={gear} onChange={setGear} theme={theme} />
                  </div>
                ) : item ? (
                  <div className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee]">
                    <span className="font-bold text-[#3c2415] text-t11">
                      {item.name}
                      <span className="ml-1.5 font-normal text-[#6b5a4b]">{formatZenit(item.cost)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPicker(true)}
                      className="text-t10 font-bold text-[#8c3235] hover:underline"
                    >
                      重選
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="moneyflow-item-open"
                    onClick={() => setShowPicker((v) => !v)}
                    className="w-full px-2 py-1.5 rounded border border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#f4ebd9] text-[#6b5a4b] text-t11 font-bold"
                  >
                    {showPicker ? '收起清單' : '從裝備表挑（可篩選）'}
                  </button>
                )}

                {showPicker && equipMode === 'table' && (
                  <div className="max-h-[320px] overflow-y-auto overscroll-contain rounded border border-[#e8dcc4] bg-[#fbf7ee] p-2">
                    <EquipmentPickerBody
                      slot={equipSlot}
                      theme={theme}
                      character={character}
                      stats={stats}
                      onSelect={(name) => {
                        const picked = catalog.find((entry) => entry.name === name) || null;
                        if (picked) {
                          setItemId(picked.id);
                          setAmount(String(picked.cost));
                          setReason((prev) => (prev.trim() === '' ? picked.name : prev));
                        }
                        setShowPicker(false);
                      }}
                    />
                  </div>
                )}

                {item && (
                  <label className="flex items-center gap-1.5 text-[#6b5a4b] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      data-testid="moneyflow-equip-toggle"
                      checked={equipAfter}
                      onChange={(e) => setEquipAfter(e.target.checked)}
                      className="accent-[#a63d40]"
                    />
                    <span>順便裝備到{slotLabel || '對應欄位'}</span>
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  data-testid="moneyflow-other-name"
                  aria-label="物品名稱"
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                  placeholder="破咒之刃、祖傳懷錶……"
                  className="w-full px-2 py-1.5 rounded border border-[#e8dcc4] bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
                />
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { key: 'equipment', label: '裝備' },
                    { key: 'consumable', label: '消耗品' },
                    { key: 'rare', label: '稀有物品' },
                    { key: 'misc', label: '雜項' }
                  ].map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      data-testid={`moneyflow-other-cat-${c.key}`}
                      aria-pressed={otherCategory === c.key}
                      onClick={() => setOtherCategory(c.key)}
                      className={`px-2 py-0.5 rounded border text-t10 font-bold transition-colors ${
                        otherCategory === c.key
                          ? 'bg-[#a63d40] text-[#fffdf9] border-[#8c3235]'
                          : 'bg-[#fffdf9] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  data-testid="moneyflow-other-effect"
                  aria-label="效果"
                  value={otherEffect}
                  onChange={(e) => setOtherEffect(e.target.value)}
                  placeholder="效果（選填）"
                  className="w-full px-2 py-1.5 rounded border border-[#e8dcc4] bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 履歷會記成什麼——模板要在按之前看見，不是按完去履歷裡找 */}
      <div
        className="rounded border bg-[#fbf7ee] px-2.5 py-1.5 space-y-0.5"
        style={{ borderColor: theme.border }}
      >
        <span className="text-t10 text-[#6b5a4b] block">履歷會記成</span>
        <span data-testid="moneyflow-record-title" className="block font-bold text-[#3c2415]">
          {recordTitle || '（填完金額與原因後顯示）'}
        </span>
        {recordNote && (
          <span data-testid="moneyflow-record-note" className="block text-t10 text-[#6b5a4b]">
            {recordNote}
          </span>
        )}
      </div>

      {/* 送出 */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span data-testid="moneyflow-error-wallet" className="text-t11 text-[#8c3235]">
          {flow.errors.wallet}
        </span>
        <div className="flex items-center gap-2">
          <JRPGButton variant="outline" size="sm" onClick={onClose}>
            取消
          </JRPGButton>
          <JRPGButton
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            className={flow.ok ? '' : `${GATED_SHELL_CLASS} border-[#d6c7ab] bg-[#e8dcc4] text-[#6b5a4b] hover:bg-[#e8dcc4]`}
            {...(flow.ok ? {} : { 'aria-disabled': 'true', 'data-blocked': 'true' })}
          >
            <span className={flow.ok ? '' : GATED_LABEL_CLASS}>
              記錄這筆{DIRECTION_LABELS[direction]}
            </span>
          </JRPGButton>
        </div>
      </div>
    </div>
  );
}

/** 彈窗外殼：只負責標題與轉發 props。 */
export default function MoneyFlowModal({
  isOpen,
  onClose,
  theme,
  character,
  wallet,
  onConfirm,
  initialDirection
}) {
  // 標題跟著起點走：按「收入」打開時標題寫「記一筆收入」。
  // 這裡不判斷方向，只轉發——判斷在 body（`describeMoneyFlow` 那一側）。
  const title = initialDirection === MONEY_DIRECTIONS.gain ? '記一筆收入' : '記一筆支出';
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-lg" theme={theme}>
      <MoneyFlowModalBody
        theme={theme}
        character={character}
        wallet={wallet}
        onConfirm={onConfirm}
        onClose={onClose}
        initialDirection={initialDirection}
      />
    </JRPGModal>
  );
}
