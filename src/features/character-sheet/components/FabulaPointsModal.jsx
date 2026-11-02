import React, { useState } from 'react';
import { GiPayMoney, GiReceiveMoney, GiSparkles } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import {
  FP_DIRECTIONS,
  FP_DIRECTION_LABELS,
  FP_GAIN_PRESETS,
  FP_SPEND_PRESETS,
  describeFabulaPointsFlow
} from '../utils/fabulaPointsFlow';
import { GATED_LABEL_CLASS, GATED_SHELL_CLASS } from '../utils/playAvailability';

/**
 * 物語點收支對話框（P12，2026-11-02）
 *
 * ## 它取代了什麼
 *
 * 一張 `−`／`+` 步進器。那個步進器寫出的履歷是「消耗物語點 3 → 2」——
 * 玩家兩小時後回頭看，只知道少了 1 點，不知道是重擲還是激勵羈絆。
 * 而物語點是這張卡上**最需要原因**的資源：書上七條用途，三條要花點，
 * 三條的價錢都是 1 點，所以在數字上完全一樣。
 *
 * ## 與金錢收支對話框的差別
 *
 * 錢要填「多少錢」，這裡多半是 1 點——所以數量給的是 `1`／`2` 兩顆快捷，
 * 而不是一個要打字的輸入框（打字是為了「350」這種數字，不是為了「1」）。
 * 投降可以一次拿 2 點，這是唯一常出現的 2。
 *
 * ## 判定不在這裡
 *
 * 「夠不夠扣」「還剩幾點」「哪一格沒填」全部問 `describeFabulaPointsFlow`。
 * 這裡只負責把 `flow.errors` 標到對應的欄位上——三格各標各的，
 * 擠在底部一行「請填寫完整」等於沒說哪裡沒填。
 */

export function FabulaPointsModalBody({
  theme = {},
  current = 0,
  onConfirm,
  onClose,
  initialDirection = FP_DIRECTIONS.spend
}) {
  const [direction, setDirection] = useState(
    initialDirection === FP_DIRECTIONS.gain ? FP_DIRECTIONS.gain : FP_DIRECTIONS.spend
  );
  // 預設 1：跑團中九成的物語點花費就是 1 點。空字串會讓玩家每次都要多按一下。
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');

  const flow = describeFabulaPointsFlow({ direction, amount, reason, current });
  const presets = direction === FP_DIRECTIONS.gain ? FP_GAIN_PRESETS : FP_SPEND_PRESETS;
  const isSpend = direction === FP_DIRECTIONS.spend;
  const DirectionIcon = isSpend ? GiPayMoney : GiReceiveMoney;

  const handleSubmit = () => {
    if (!flow.ok) return;
    onConfirm({ direction, amount: flow.amount, reason: flow.reason });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 現在幾點 ＋ 方向 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border bg-[#fbf7ee] tabular-nums font-black text-[#3c2415]"
          style={{ borderColor: theme.border }}
        >
          <GiSparkles className="w-4 h-4 text-[#6b5a4b]" />
          <span data-testid="fpflow-current">{current} FP</span>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="物語點方向">
          {[FP_DIRECTIONS.spend, FP_DIRECTIONS.gain].map((dir) => {
            const active = direction === dir;
            const Icon = dir === FP_DIRECTIONS.spend ? GiPayMoney : GiReceiveMoney;
            return (
              <button
                key={dir}
                type="button"
                data-testid={`fpflow-direction-${dir}`}
                aria-pressed={active}
                onClick={() => setDirection(dir)}
                className={`px-2.5 py-1 rounded border font-bold flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                    : 'bg-[#fbf7ee] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{FP_DIRECTION_LABELS[dir]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 點數：1／2 兩顆快捷 ＋ 可打字（投降 2 點、連續兩次重擲都要用得到） */}
      <div className="space-y-1">
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold text-[#3c2415]">
            <DirectionIcon className="w-3.5 h-3.5 inline-block align-text-bottom text-[#6b5a4b]" />
            {' '}點數
          </span>
          {flow.errors.amount && (
            <span data-testid="fpflow-error-amount" className="text-t11 text-[#8c3235]">
              {flow.errors.amount}
            </span>
          )}
        </label>
        <div className="flex items-center gap-1.5">
          {[1, 2].map((value) => (
            <button
              key={value}
              type="button"
              data-testid={`fpflow-amount-${value}`}
              aria-pressed={String(value) === amount}
              onClick={() => setAmount(String(value))}
              className={`px-3 py-1 rounded border font-black tabular-nums transition-colors ${
                String(value) === amount
                  ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                  : 'bg-[#fbf7ee] text-[#6b5a4b] border-[#d6c7ab] hover:bg-[#f4ebd9]'
              }`}
            >
              {value}
            </button>
          ))}
          <input
            type="text"
            inputMode="numeric"
            data-testid="fpflow-amount"
            aria-label="點數"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            className={`w-14 px-2 py-1 rounded border bg-[#fffdf9] text-xs tabular-nums font-black text-[#3c2415] outline-none focus:border-[#3c2415] ${
              flow.errors.amount ? 'border-[#8c3235]' : 'border-[#e8dcc4]'
            }`}
          />
          <span className="text-[#6b5a4b]">FP</span>
          {/* 算式：玩家要確認的是「扣完還剩幾點」 */}
          <span data-testid="fpflow-math" className="ml-auto tabular-nums font-black text-[#3c2415]">
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
            <span data-testid="fpflow-error-reason" className="text-t11 text-[#8c3235]">
              {flow.errors.reason}
            </span>
          )}
        </label>
        <input
          type="text"
          data-testid="fpflow-reason"
          aria-label="原因"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isSpend ? '例：引用【劍聖】重擲命中' : '例：反派在遺跡登場'}
          className={`w-full px-2.5 py-1.5 rounded border bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415] ${
            flow.errors.reason ? 'border-[#8c3235]' : 'border-[#e8dcc4]'
          }`}
        />
        <div className="flex items-center gap-1 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`fpflow-preset-${preset}`}
              onClick={() => setReason(preset)}
              className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#6b5a4b] text-t10 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* 履歷會記成什麼——按之前就要看見 */}
      <div
        className="rounded border bg-[#fbf7ee] px-2.5 py-1.5 space-y-0.5"
        style={{ borderColor: theme.border }}
      >
        <span className="text-t10 text-[#6b5a4b] block">履歷會記成</span>
        <span data-testid="fpflow-record-title" className="block font-bold text-[#3c2415]">
          {flow.title || '（填完點數與原因後顯示）'}
        </span>
        <span data-testid="fpflow-record-note" className="block text-t10 text-[#6b5a4b]">
          {flow.reason || '（原因會寫在下一行，明細才看得出為什麼）'}
        </span>
      </div>

      {/* 送出 */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span data-testid="fpflow-error-current" className="text-t11 text-[#8c3235]">
          {flow.errors.current || ''}
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
              記錄這筆{FP_DIRECTION_LABELS[direction]}
            </span>
          </JRPGButton>
        </div>
      </div>
    </div>
  );
}

/** 彈窗外殼：只負責標題與轉發 props。 */
export default function FabulaPointsModal({
  isOpen,
  onClose,
  theme,
  current,
  onConfirm,
  initialDirection
}) {
  const title = initialDirection === FP_DIRECTIONS.gain ? '獲得物語點' : '消耗物語點';
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-lg" theme={theme}>
      <FabulaPointsModalBody
        theme={theme}
        current={current}
        onConfirm={onConfirm}
        onClose={onClose}
        initialDirection={initialDirection}
      />
    </JRPGModal>
  );
}
