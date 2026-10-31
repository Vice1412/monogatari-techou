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
import { buildPurchaseCatalog, PURCHASE_CATEGORIES } from './PurchaseModal';
import { GATED_LABEL_CLASS, GATED_SHELL_CLASS } from '../utils/playAvailability';

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
  onClose
}) {
  const [direction, setDirection] = useState(MONEY_DIRECTIONS.spend);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [wantsItem, setWantsItem] = useState(false);
  const [itemId, setItemId] = useState('');
  const [equipAfter, setEquipAfter] = useState(true);

  const catalog = useMemo(() => buildPurchaseCatalog(rulesData.equipment), []);
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

  /**
   * 選了裝備之後的三件連動：金額、原因、以及「會換掉哪一件」。
   *
   * 金額只在**玩家沒手動改過**時才覆寫——用「目前金額是否等於上一個品項的價格」
   * 判斷，而不是記一個 `touched` 旗標：旗標會在使用者清空輸入框後永遠卡住。
   */
  const handlePickItem = (nextId) => {
    setItemId(nextId);
    const picked = catalog.find((entry) => entry.id === nextId) || null;
    if (!picked) return;

    setAmount(String(picked.cost));
    // 原因只在空白或「還是上一個品項的名字」時才換，避免蓋掉玩家自己寫的字。
    setReason((prev) => (prev.trim() === '' || catalog.some((entry) => entry.name === prev.trim())
      ? picked.name
      : prev));
  };

  const handleSubmit = () => {
    if (!flow.ok) return;
    onConfirm({
      direction,
      amount: flow.amount,
      reason: flow.reason,
      item,
      equip: item ? equipAfter : false,
      slotLabel
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

      {/* 選填：這是買裝備 */}
      <div className="pt-2 border-t space-y-1.5" style={{ borderColor: theme.border }}>
        <label className="flex items-center gap-1.5 text-[#6b5a4b] cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="moneyflow-item-toggle"
            checked={wantsItem}
            onChange={(e) => {
              // 勾選**不自動選品項**：自動挑第一件會讓金額與原因被一段沒人要求的
              // 內容填滿（使用者只是勾了一個框，卻看到「青銅劍 200z」）。
              // 取消勾選才清掉，因為那時玩家已經明確說「這不是買裝備」。
              setWantsItem(e.target.checked);
              if (!e.target.checked) setItemId('');
            }}
            className="accent-[#a63d40]"
          />
          <span>這筆是買裝備（套用記錄模板）</span>
        </label>

        {wantsItem && (
          <div className="space-y-1.5 pl-5">
            <select
              data-testid="moneyflow-item"
              aria-label="購買品項"
              value={itemId}
              onChange={(e) => handlePickItem(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[#e8dcc4] bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
            >
              <option value="">選擇品項…</option>
              {PURCHASE_CATEGORIES.map((category) => (
                <optgroup key={category.id} label={category.label}>
                  {catalog
                    .filter((entry) => entry.categoryId === category.id)
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}（{formatZenit(entry.cost)}）
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>

            {item && (
              <label className="flex items-center gap-1.5 text-[#6b5a4b] cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="moneyflow-equip-toggle"
                  checked={equipAfter}
                  onChange={(e) => setEquipAfter(e.target.checked)}
                  className="accent-[#a63d40]"
                />
                <span>同時裝備到{slotLabel || '對應欄位'}</span>
              </label>
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
  onConfirm
}) {
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title="記一筆收支" maxWidth="max-w-lg" theme={theme}>
      <MoneyFlowModalBody
        theme={theme}
        character={character}
        wallet={wallet}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </JRPGModal>
  );
}
