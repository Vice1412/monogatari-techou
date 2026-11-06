import React, { useState } from 'react';
import {
  GiTrident,
  GiTrashCan,
  GiCheckMark,
  GiHazardSign
} from 'react-icons/gi';
import { Plus } from 'lucide-react';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { SYMBOLIST_SYMBOLS } from '../../data/skillSuboptionsData';
import {
  getSymbolMarks,
  maxSymbolMarks,
  canAddSymbolMark,
  addSymbolMark,
  removeSymbolMark,
  clearSymbolMarks
} from '../../utils/symbolist';

export default function SymbolistMarks({
  character,
  skillSL = 1,
  selectedOptions = [],
  onChange = () => {},
  showToast = () => {}
}) {
  const [isOpenAdd, setIsOpenAdd] = useState(false);
  const [selectedSymbolId, setSelectedSymbolId] = useState('');
  const [bearerName, setBearerName] = useState('自身');
  const [markNote, setMarkNote] = useState('');

  const marks = getSymbolMarks(character);
  const max = maxSymbolMarks(skillSL);
  const canAdd = canAddSymbolMark(character, skillSL);

  // 取得角色已掌握的徽記清單（若未選取子選項，預設全部可選作為降級）
  const knownSymbols = Array.isArray(selectedOptions) && selectedOptions.length > 0
    ? SYMBOLIST_SYMBOLS.filter((s) => selectedOptions.includes(s.name) || selectedOptions.includes(s.id))
    : SYMBOLIST_SYMBOLS;

  const handleAdd = () => {
    const symId = selectedSymbolId || (knownSymbols[0]?.id || '');
    if (!symId) {
      showToast('請先選擇要刻劃的徽記種類', 'warning');
      return;
    }

    const res = addSymbolMark(
      character,
      {
        symbolId: symId,
        bearer: bearerName.trim() || '自身',
        note: markNote.trim()
      },
      skillSL
    );

    if (!res.ok) {
      showToast(res.reason, 'warning');
      return;
    }

    onChange(res.character);
    showToast(`成功在【${bearerName.trim() || '自身'}】上刻劃【${res.mark.symbolName}】`, 'success');
    setIsOpenAdd(false);
    setBearerName('自身');
    setMarkNote('');
    setSelectedSymbolId('');
  };

  const handleRemove = (markId, name) => {
    const res = removeSymbolMark(character, markId);
    if (res.ok) {
      onChange(res.character);
      showToast(`已摧毀徽記【${name}】`, 'info');
    }
  };

  const handleClearAll = () => {
    const res = clearSymbolMarks(character);
    if (res.ok) {
      onChange(res.character);
      showToast(`已摧毀全部 ${res.count} 個維持中的徽記`, 'info');
    }
  };

  return (
    <div
      data-testid="symbolist-marks-tracker"
      className="p-2.5 rounded border space-y-2 bg-[#f4ebd9] border-[#d6c7ab]"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-t12 text-[#3c2415] flex items-center gap-1.5">
          <GiTrident className="w-4 h-4 text-[#8c3235]" />
          <span>維持中的徽記實體</span>
          <span
            data-testid="symbol-marks-quota"
            className="text-t11 tabular-nums px-1.5 py-0.5 rounded bg-[#fffdf9] border border-[#d6c7ab] text-[#6b5a4b]"
          >
            {marks.length} / {max}
          </span>
        </span>

        <div className="flex items-center gap-1 ml-auto">
          {marks.length > 0 && (
            <button
              type="button"
              data-testid="symbol-marks-clear-all"
              onClick={handleClearAll}
              className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#fbf7ee] text-[#8c3235] text-t11 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <GiTrashCan className="w-3 h-3" />
              <span>全部摧毀</span>
            </button>
          )}

          <button
            type="button"
            data-testid="symbol-marks-open-add"
            disabled={!canAdd}
            onClick={() => setIsOpenAdd((v) => !v)}
            className={`px-2 py-0.5 rounded border text-t11 font-bold flex items-center gap-1 transition-colors ${
              canAdd
                ? 'bg-[#245c45] border-[#1e4b39] text-[#fffdf9] hover:bg-[#1e4b39] cursor-pointer'
                : 'bg-[#e8dcc4] border-[#d6c7ab] text-[#7c6a58] cursor-not-allowed'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>刻劃徽記</span>
          </button>
        </div>
      </div>

      {/* 刻劃徽記展開表單 */}
      {isOpenAdd && (
        <div
          data-testid="symbol-marks-add-form"
          className="p-2 rounded bg-[#fffdf9] border border-[#d6c7ab] space-y-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-t10 font-bold text-[#6b5a4b] mb-0.5">選擇徽記種類</label>
              <select
                data-testid="symbol-marks-select-symbol"
                value={selectedSymbolId || knownSymbols[0]?.id || ''}
                onChange={(e) => setSelectedSymbolId(e.target.value)}
                className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-t11 text-[#3c2415]"
              >
                {knownSymbols.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-t10 font-bold text-[#6b5a4b] mb-0.5">刻劃對象（攜帶者）</label>
              <input
                type="text"
                data-testid="symbol-marks-input-bearer"
                value={bearerName}
                onChange={(e) => setBearerName(e.target.value)}
                placeholder="自身、盟友姓名或物體"
                className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-t11 text-[#3c2415]"
              />
            </div>
          </div>

          <div>
            <label className="block text-t10 font-bold text-[#6b5a4b] mb-0.5">附註備忘（可選）</label>
            <input
              type="text"
              data-testid="symbol-marks-input-note"
              value={markNote}
              onChange={(e) => setMarkNote(e.target.value)}
              placeholder="例：戰前刻印在盾牌上"
              className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-[#fbf7ee] text-t11 text-[#3c2415]"
            />
          </div>

          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsOpenAdd(false)}
              className="px-2 py-1 rounded border border-[#d6c7ab] text-t11 text-[#6b5a4b] hover:bg-[#f4ebd9] cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              data-testid="symbol-marks-submit-add"
              onClick={handleAdd}
              className="px-2.5 py-1 rounded bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] text-t11 font-bold flex items-center gap-1 cursor-pointer"
            >
              <GiCheckMark className="w-3 h-3" />
              <span>確認刻劃</span>
            </button>
          </div>
        </div>
      )}

      {/* 徽記卡片清單 */}
      {marks.length === 0 ? (
        <p className="text-t12 text-[#6b5a4b] text-center py-1">
          目前世界上尚未維持任何由你刻劃的徽記。
        </p>
      ) : (
        <div className="space-y-1.5" data-testid="symbol-marks-list">
          {marks.map((m) => (
            <div
              key={m.id}
              data-testid={`symbol-mark-card-${m.id}`}
              className="p-2 rounded bg-[#fffdf9] border border-[#d6c7ab] space-y-1"
            >
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="font-bold text-t11 text-[#3c2415] flex items-center gap-1">
                  <span>【{m.symbolName}】</span>
                  <span className="text-t10 px-1 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#6b5a4b]">
                    攜帶者：{m.bearer}
                  </span>
                </span>

                <button
                  type="button"
                  data-testid={`symbol-mark-remove-${m.id}`}
                  onClick={() => handleRemove(m.id, m.symbolName)}
                  title="摧毀此徽記"
                  className="px-1.5 py-0.5 rounded border border-[#d6c7ab] hover:bg-[#f4ebd9] text-[#8c3235] text-t10 font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <GiTrashCan className="w-2.5 h-2.5" />
                  <span>摧毀</span>
                </button>
              </div>

              <p className="text-t12 text-[#3c2415] leading-relaxed">
                {renderTextWithAffinities(m.effect)}
              </p>

              {m.note && (
                <p className="text-t12 text-[#6b5a4b]">
                  ※ 備忘：{m.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
