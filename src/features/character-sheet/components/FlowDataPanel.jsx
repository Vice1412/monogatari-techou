import React from 'react';
import { canUseBuff, recordIssues } from '../utils/flowData';

/**
 * 通用流程資料面板（FlowDataPanel）—— W0 通用層元件。
 * 提供名冊編輯、增益選用按鈕、資源刻度與章節結算。
 * 不直接寫入，只透過回呼函式向上通知。
 */
export default function FlowDataPanel({
  spec,
  entry,
  character,
  itemId,
  theme,
  completeness,
  clock,
  onRecordChange = () => {},
  onAddRecord = () => {},
  onRemoveRecord = () => {},
  onPick = () => {},
  onUseBuff = () => {},
  onSettle = () => {},
  testId = `flowdata-${itemId}`
}) {
  if (!spec) return null;

  const records = entry?.records || [];
  const maxRecords = spec.records?.max ?? Infinity;
  const minRecords = spec.records?.min ?? 0;
  const issues = completeness?.issues || (spec ? recordIssues(spec, entry) : []);
  const isComplete = issues.length === 0;

  return (
    <div
      data-testid={testId}
      className="p-3 rounded border space-y-3 bg-[#fbf7ee] border-[#d6c7ab]"
    >
      {/* 標題與來源 */}
      <div className="flex items-center justify-between border-b border-[#e8dcc4] pb-2">
        <div className="flex items-center gap-1.5 font-bold text-t14 text-[#3c2415]">
          <span>{spec.title}</span>
          {spec.source && (
            <span className="text-t11 text-[#6b5a4b] font-normal">
              （{spec.source}）
            </span>
          )}
        </div>
        {clock && (
          <div data-testid={`${testId}-clock`} className="text-t12 font-bold tabular-nums text-[#3c2415]">
            {clock.label}：{clock.value} / {clock.max}
          </div>
        )}
      </div>

      {/* A. 名冊區塊 */}
      {spec.records && (
        <div data-testid={`${testId}-records`} className="space-y-2">
          <div className="flex items-center justify-between text-t12 font-bold text-[#3c2415]">
            <span>{spec.records.label}名冊</span>
            <div className="flex items-center gap-2">
              <span className="text-t10 text-[#6b5a4b]">
                {records.length} / {spec.records.max}
              </span>
              <button
                type="button"
                data-testid={`${testId}-add-record`}
                disabled={records.length >= maxRecords}
                onClick={onAddRecord}
                className="px-2 py-0.5 rounded border border-[#d6c7ab] text-t11 font-bold bg-white text-[#3c2415] hover:bg-[#f4ebd9] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:text-[#d6c7ab]"
              >
                ＋ 新增{spec.records.label}
              </button>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="p-2.5 rounded border border-dashed border-[#d6c7ab] text-t11 text-center text-[#6b5a4b]">
              尚未登記{spec.records.label}資料，請點擊上方「＋ 新增」按鈕填寫。
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((rec, idx) => (
                <div
                  key={rec.id || idx}
                  data-testid={`${testId}-record-${idx}`}
                  className="p-2.5 rounded border border-[#d6c7ab] bg-white space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-t11 font-bold text-[#6b5a4b]">
                      第 {idx + 1} 位{spec.records.label}
                    </span>
                    {records.length > minRecords && (
                      <button
                        type="button"
                        data-testid={`${testId}-remove-record-${idx}`}
                        onClick={() => onRemoveRecord(idx)}
                        className="text-t11 text-[#a63d40] hover:text-[#8c3235] font-bold px-1"
                      >
                        ✕ 刪除
                      </button>
                    )}
                  </div>
                  {spec.records.fields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="block text-t10 font-bold text-[#3c2415]">
                        {f.label}{f.required && <span className="text-[#a63d40] font-bold ml-0.5">*</span>}
                      </label>
                      {f.multiline ? (
                        <textarea
                          rows={2}
                          maxLength={f.maxLength || 120}
                          value={rec[f.key] || ''}
                          onChange={(e) => onRecordChange(idx, { [f.key]: e.target.value })}
                          className="w-full p-1.5 rounded border border-[#d6c7ab] text-t11 bg-[#fbf7ee] text-[#3c2415] leading-relaxed"
                          placeholder={`填寫${f.label}...`}
                        />
                      ) : (
                        <input
                          type="text"
                          maxLength={f.maxLength || 24}
                          value={rec[f.key] || ''}
                          onChange={(e) => onRecordChange(idx, { [f.key]: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-[#d6c7ab] text-t11 bg-[#fbf7ee] text-[#3c2415]"
                          placeholder={`填寫${f.label}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!isComplete && (
            <div data-testid={`${testId}-issues`} className="p-2 rounded bg-[#fbf7ee] border border-[#d6c7ab] text-t11 text-[#6b5a4b] space-y-0.5">
              <span className="font-bold text-[#a63d40]">△ 尚未填齊資料：</span>
              <ul className="list-disc list-inside">
                {issues.map((iss, i) => (
                  <li key={i}>{iss.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* B. 增益選用按鈕 */}
      {spec.buffs && spec.buffs.length > 0 && (
        <div data-testid={`${testId}-buffs`} className="space-y-1.5">
          <div className="text-t12 font-bold text-[#3c2415]">可用增益</div>
          <div className="space-y-1.5">
            {spec.buffs.map((buff) => {
              const check = character ? canUseBuff(character, itemId, buff.id) : { ok: true };
              return (
                <div
                  key={buff.id}
                  data-testid={`${testId}-buff-${buff.id}`}
                  className="p-2 rounded border border-[#e8dcc4] bg-white flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#3c2415]">{buff.label}</span>
                    <button
                      type="button"
                      data-testid={`${testId}-use-buff-${buff.id}`}
                      disabled={!check.ok}
                      onClick={() => onUseBuff(buff.id)}
                      className="px-2.5 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-[#d6c7ab]"
                    >
                      使用（{buff.costDice}）
                    </button>
                  </div>
                  <p className="text-t11 text-[#6b5a4b] leading-relaxed">{buff.describe}</p>
                  {!check.ok && (
                    <p data-testid={`${testId}-buff-disabled-${buff.id}`} className="text-t10 text-[#a63d40] font-bold">
                      {check.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* C. 結算按鈕 */}
      {spec.settlements && spec.settlements.length > 0 && (
        <div data-testid={`${testId}-settlements`} className="pt-2 border-t border-[#e8dcc4] flex flex-wrap gap-2">
          {spec.settlements.map((st) => (
            <button
              key={st.id}
              type="button"
              data-testid={`${testId}-settle-${st.id}`}
              onClick={() => onSettle(st.id)}
              className="px-2.5 py-1 rounded border border-[#d6c7ab] bg-white hover:bg-[#f4ebd9] text-xs font-bold text-[#3c2415] transition-colors cursor-pointer"
            >
              {st.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
