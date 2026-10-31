import React, { useMemo } from 'react';
import { GiCoins } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import EmptyState from '../../../components/ui/EmptyState';
import { buildMoneyLedger, formatZenit } from '../utils/zenitFeedback';
import { formatLogTime } from '../utils/characterLog';

/**
 * 金錢明細（P10，2026-11-01）
 *
 * 使用者的原話：
 *   「金幣錢包的部分不要有 +- 和自己修改內容了。下面的按鈕改大，只要收入和支出和明細
 *     兩三按鈕。金錢也很重要，做明顯一點。」
 *
 * ## 為什麼「明細」是一顆按鈕，而不是把最近一筆印在錢包下面
 *
 * 原本錢包下方那一條只印**最近一筆**（`findLastZenitEvent`），而且和兩顆按鈕擠在同一行。
 * 最近一筆回答了「剛剛發生什麼」，但玩家真正會問的是「我這趟到底把錢花去哪」——
 * 那個問題需要一張帳，不是一行字。
 *
 * ## 這張帳不是新資料
 *
 * 每一筆都從履歷推導（`buildMoneyLedger`）：`zenit` 的每一次變動本來就寫在履歷裡
 * （購買、收支、起始資金結算都走 `loggableChange`）。所以：
 *   - 不新增欄位、不寫入存檔 → 舊存檔打開就有明細
 *   - 明細與履歷**永遠一致**（同一份事實，兩個看法）
 *
 * ## 為什麼餘額要印「當時」的
 *
 * 每一列右邊的 `餘 380z` 是**那一筆之後**的餘額（`change.to`），不是現在的錢包。
 * 明細要回答「那時候剩多少」；印現在的值會讓十二列都寫著同一個數字，
 * 而那正好是玩家已經知道的資訊。
 */

/** 一列的數字顏色：收入綠、支出紅（與履歷的 `deltaText` 同一個語意）。 */
const deltaTone = (delta) => (delta < 0 ? '#8c3235' : delta > 0 ? '#245c45' : '#6b5a4b');

/**
 * 合計要帶號，但 **0 不要印成 `+0z`／`-0z`**——那讀起來像「有動，只是很小」。
 * 沒有任何收支時就老實寫 `0z`。
 */
const signedTotal = (value, sign) => (value > 0 ? `${sign}${formatZenit(value)}` : formatZenit(0));

export function MoneyLedgerModalBody({ theme = {}, character, onClose }) {
  const ledger = useMemo(() => buildMoneyLedger(character?.log), [character?.log]);
  const balance = character?.zenit;

  return (
    <div className="space-y-3 text-xs">
      {/* 三格總覽：現在有多少、這段時間進了多少、出了多少。
          順序刻意是「餘額 → 收入 → 支出」，因為玩家打開明細的第一個問題是「我還有多少」。 */}
      <div
        data-testid="ledger-summary"
        className="grid grid-cols-3 gap-2 rounded border bg-[#fbf7ee] p-2.5"
        style={{ borderColor: theme.border }}
      >
        <div className="min-w-0">
          <span className="block text-t10 text-[#6b5a4b]">目前餘額</span>
          <span data-testid="ledger-balance" className="block tabular-nums font-black text-t16 text-[#3c2415]">
            {formatZenit(balance)}
          </span>
        </div>
        <div className="min-w-0">
          <span className="block text-t10 text-[#6b5a4b]">累計收入</span>
          <span data-testid="ledger-income" className="block tabular-nums font-black text-t16 text-[#245c45]">
            {signedTotal(ledger.income, '+')}
          </span>
        </div>
        <div className="min-w-0">
          <span className="block text-t10 text-[#6b5a4b]">累計支出</span>
          <span data-testid="ledger-expense" className="block tabular-nums font-black text-t16 text-[#8c3235]">
            {signedTotal(ledger.expense, '-')}
          </span>
        </div>
      </div>

      {ledger.count === 0 ? (
        /* 空狀態走 `EmptyState`（全站唯一的語法：虛線框＋gi 圖示＋粗體標題＋一句教學）。
           手抄一份「一行灰字」正是那條護欄在擋的東西——而且空帳要教玩家
           **怎麼讓它有帳**，否則打開只看到一片空白。 */
        <EmptyState
          kind="money-ledger"
          dense
          icon={GiCoins}
          title="還沒有任何金錢記錄"
          teach="用「收入」或「支出」記一筆，明細就會從那裡長出來；買裝備也會自動留下一筆。"
        />
      ) : (
        <div data-testid="ledger-list" className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
          {ledger.rows.map((row, index) => (
            <div
              key={row.id || `${row.at}_${index}`}
              data-testid={`ledger-row-${index}`}
              className="flex items-start justify-between gap-2 rounded border border-[#e8dcc4] bg-[#fffdf9] px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1">
                <span
                  data-testid={`ledger-title-${index}`}
                  className="block font-bold text-[#3c2415] truncate"
                  title={row.title}
                >
                  {row.title || '（未命名）'}
                </span>
                {/* 時間與備註同一行：時間是次要資訊，但沒有它這一列就無法對帳。 */}
                <span className="block text-t10 text-[#6b5a4b] truncate" title={row.note}>
                  {[formatLogTime(row.at), row.note].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  data-testid={`ledger-delta-${index}`}
                  className="block tabular-nums font-black"
                  style={{ color: deltaTone(row.delta) }}
                >
                  {row.deltaText}
                </span>
                <span className="block text-t10 tabular-nums text-[#6b5a4b]">
                  餘 {formatZenit(row.balance)}
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
export default function MoneyLedgerModal({ isOpen, onClose, theme, character }) {
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title="金錢明細" maxWidth="max-w-lg" theme={theme}>
      <MoneyLedgerModalBody theme={theme} character={character} onClose={onClose} />
    </JRPGModal>
  );
}
