import React, { useState } from 'react';
import { GiScrollUnfurled } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import EmptyState from '../../../components/ui/EmptyState';
import { chapterSettlementItems, planChapterSettlement } from '../utils/chapterSettlement';

/**
 * 章節結束統一結算內容體（ChapterSettlementPanelBody）—— W0-5 先行件。
 * 列出當前角色在章節結束時可執行的結算項目。
 */
export function ChapterSettlementPanelBody({
  character,
  onApply = () => {},
  showToast = () => {},
  onClose = () => {},
  theme = null,
  testId = 'chapter-settlement-panel'
}) {
  const items = chapterSettlementItems(character);
  const [settledIds, setSettledIds] = useState({});

  if (items.length === 0) {
    return (
      <EmptyState
        kind="chapter-settlement"
        dense
        icon={GiScrollUnfurled}
        title="目前沒有需要章節結算的效果條目"
        teach="角色習得帶有章節結算效果的金手指或特質時，會在此列出擲骰結算項目。"
      />
    );
  }

  const handleRollItem = (item) => {
    let roll = 1;
    if (item.dice === '1d6') {
      roll = Math.floor(Math.random() * 6) + 1;
    } else if (item.dice === '2d20') {
      const d1 = Math.floor(Math.random() * 20) + 1;
      const d2 = Math.floor(Math.random() * 20) + 1;
      roll = d1 + d2;
    }

    const plan = planChapterSettlement(character, item.itemId, { roll });
    if (plan.ok) {
      setSettledIds((prev) => ({ ...prev, [item.itemId]: true }));
      onApply(plan);
      if (showToast && plan.toast) {
        showToast(plan.toast, 'success');
      }
    } else if (showToast && plan.reason) {
      showToast(plan.reason, 'warning');
    }
  };

  return (
    <div
      data-testid={testId}
      className="space-y-3 text-xs"
    >
      <div className="flex items-center justify-between text-t12 text-[#6b5a4b]">
        <span>在章節結束時依原書規則擲骰結算資源變動：</span>
        <span className="tabular-nums">共 {items.length} 項</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const isSettled = Boolean(settledIds[item.itemId]);
          return (
            <div
              key={item.itemId}
              className="flex items-center justify-between p-3 rounded bg-[#fffdf9] border border-[#d6c7ab] text-xs"
            >
              <div className="flex flex-col pr-2">
                <span className="font-bold text-[#3c2415]">{item.label}</span>
                <span className="text-t10 text-[#6b5a4b] tabular-nums">
                  規則判定規格：{item.dice}
                </span>
              </div>
              <button
                type="button"
                data-testid={`settle-btn-${item.itemId}`}
                disabled={isSettled}
                onClick={() => handleRollItem(item)}
                className={`px-3 py-1.5 rounded font-bold text-xs transition-colors cursor-pointer ${
                  isSettled
                    ? 'bg-[#e8dcc4] text-[#6b5a4b] cursor-not-allowed'
                    : 'bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9]'
                }`}
              >
                {isSettled ? '已結算' : `擲 ${item.dice}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end pt-2">
        <JRPGButton variant="outline" size="sm" onClick={onClose}>
          完成
        </JRPGButton>
      </div>
    </div>
  );
}

/**
 * 章節結束結算彈窗外殼（ChapterSettlementModal）。
 */
export default function ChapterSettlementModal({
  isOpen,
  onClose,
  character,
  onApply,
  showToast,
  theme
}) {
  if (!isOpen) return null;

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title="章節結束結算"
      maxWidth="max-w-md"
      theme={theme}
    >
      <ChapterSettlementPanelBody
        character={character}
        onApply={onApply}
        showToast={showToast}
        onClose={onClose}
        theme={theme}
      />
    </JRPGModal>
  );
}
