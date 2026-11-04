import React, { useMemo } from 'react';
import { GiSparkles } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import EmptyState from '../../../components/ui/EmptyState';
import { buildFabulaPointLedger } from '../utils/fabulaPointsFlow';
import { formatLogTime } from '../utils/characterLog';

/**
 * 物語點明細（P12，2026-11-02）
 *
 * 與金錢明細（`MoneyLedgerModal`）同一個做法：**從成長履歷推導**，不另開一本帳。
 * 差別只在一個：這裡每一列的重點是 `note`（原因），不是差額。
 *
 * 為什麼原因要獨立一行：物語點的價錢幾乎永遠是 1 點，
 * 所以「−1」本身沒有資訊量——玩家要讀的是「為了什麼」。
 * 把原因塞進標題（`消耗【引用特質重擲檢定】`）在中文裡會變成
 * `消耗【激勵羈絆【勇氣】】`——括號套括號，讀不出哪一層是什麼。
 */

const deltaTone = (delta) => (delta < 0 ? '#8c3235' : '#245c45');

export function FabulaPointLedgerModalBody({ theme = {}, character, onClose }) {
  const ledger = useMemo(() => buildFabulaPointLedger(character?.log), [character?.log]);
  const current = character?.fabulaPoints ?? 3;

  return (
    <div className="space-y-3 text-xs">
      <div
        data-testid="fp-ledger-summary"
        className="grid grid-cols-3 gap-2 rounded border bg-[#fbf7ee] p-2.5"
        style={{ borderColor: theme.border }}
      >
        <div className="min-w-0">
          <span className="block text-t10 text-[#6b5a4b]">目前</span>
          <span data-testid="fp-ledger-balance" className="block tabular-nums font-black text-t16 text-[#3c2415]">
            {current} FP
          </span>
        </div>
        <div className="min-w-0">
          <span className="block text-t10 text-[#6b5a4b]">累計獲得</span>
          <span data-testid="fp-ledger-gained" className="block tabular-nums font-black text-t16 text-[#245c45]">
            {ledger.gained > 0 ? `+${ledger.gained}` : '0'}
          </span>
        </div>
        <div className="min-w-0">
          <span className="block text-t10 text-[#6b5a4b]">累計消耗</span>
          <span data-testid="fp-ledger-spent" className="block tabular-nums font-black text-t16 text-[#8c3235]">
            {ledger.spent > 0 ? `−${ledger.spent}` : '0'}
          </span>
        </div>
      </div>

      {ledger.count === 0 ? (
        <EmptyState
          kind="fp-ledger"
          dense
          icon={GiSparkles}
          title="還沒有任何物語點記錄"
          teach="用「獲得」或「消耗」記一筆；重擲與羈絆激勵會自動記錄。"
        />
      ) : (
        <div data-testid="fp-ledger-list" className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
          {ledger.rows.map((row, index) => (
            <div
              key={row.id || `${row.at}_${index}`}
              data-testid={`fp-ledger-row-${index}`}
              className="flex items-start justify-between gap-2 rounded border border-[#e8dcc4] bg-[#fffdf9] px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1">
                <span
                  data-testid={`fp-ledger-title-${index}`}
                  className="block font-bold text-[#3c2415] truncate"
                  title={row.title}
                >
                  {row.title || '（未命名）'}
                </span>
                <span
                  data-testid={`fp-ledger-note-${index}`}
                  className="block text-t10 text-[#6b5a4b] truncate"
                  title={row.note}
                >
                  {[formatLogTime(row.at), row.note].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  data-testid={`fp-ledger-delta-${index}`}
                  className="block tabular-nums font-black"
                  style={{ color: deltaTone(row.delta) }}
                >
                  {row.deltaText}
                </span>
                <span className="block text-t10 tabular-nums text-[#6b5a4b]">
                  餘 {row.balance}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-t10 text-[#6b5a4b]">
          {ledger.count > 0 ? `共 ${ledger.count} 筆，由成長履歷推導（沒有另外存一份帳）` : ''}
        </span>
        <JRPGButton variant="outline" size="sm" onClick={onClose}>
          關閉
        </JRPGButton>
      </div>
    </div>
  );
}

/** 彈窗外殼：只負責標題與轉發 props。 */
export default function FabulaPointLedgerModal({ isOpen, onClose, theme, character }) {
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title="物語點明細" maxWidth="max-w-lg" theme={theme}>
      <FabulaPointLedgerModalBody theme={theme} character={character} onClose={onClose} />
    </JRPGModal>
  );
}
