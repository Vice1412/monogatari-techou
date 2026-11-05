import React from 'react';
import { canUseBuff, recordIssues, EQUIPMENT_TRAITS } from '../utils/flowData';

/**
 * 通用流程資料面板（FlowDataPanel）—— W0 通用層元件。
 * 提供名冊編輯、增益選用按鈕、資源刻度與章節結算。
 * 不直接寫入，只透過回呼函式向上通知。
 */
/**
 * 單一記錄欄位的控件：依 `f` 的宣告決定要畫什麼。
 *
 * 為什麼要有這一層：`records.fields` 的宣告在第一輪只是文案（label／required／maxLength），
 * 全部畫成自由文字。於是【升級】的「特性」欄位可以打「飛彈」，
 * 而 `requires: { slotScope, maxCost: 1000 }` 沒有任何消費者——規則寫得再清楚也攔不住。
 *
 * 支援三種宣告：
 *  - `f.options`：靜態選項（例如類別：武器／護甲／盾牌）
 *  - `f.source === 'EQUIPMENT_TRAITS:1000'`：**依同一筆記錄的類別過濾**的特性清單（≤1000z）
 *  - `f.numeric`：數字輸入（支付金額）
 */
const SLOT_TO_EN = { 武器: 'weapon', 護甲: 'armor', 盾牌: 'shield' };

function fieldControl(f, rec, idx, testId, onRecordChange, spec, minRecords) {
  const id = `${testId}-record-${idx}-field-${f.key}`;
  const value = rec[f.key] === undefined || rec[f.key] === null ? '' : rec[f.key];

  if (f.source === 'EQUIPMENT_TRAITS:1000') {
    const slotEn = SLOT_TO_EN[rec.slot] || '';
    const options = slotEn ? EQUIPMENT_TRAITS.filter((t) => t.slots.includes(slotEn) && t.cost <= 1000) : [];
    return (
      <div className="space-y-0.5">
        <select
          data-testid={id}
          value={value}
          disabled={options.length === 0}
          onChange={(e) => onRecordChange(idx, { [f.key]: e.target.value })}
          className="w-full px-2 py-1 rounded border border-[#d6c7ab] text-t11 bg-[#fbf7ee] text-[#3c2415]"
        >
          <option value="">（先選類別）</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>{t.name}（{t.cost}z）</option>
          ))}
        </select>
        {options.length === 0 ? (
          <p className="text-t12 text-[#8c3235]">先在上面選「類別」，這裡才會列出可選的特性（≤1000z）。</p>
        ) : null}
      </div>
    );
  }

  if (Array.isArray(f.options) && f.options.length > 0) {
    return (
      <select
        data-testid={id}
        value={value}
        onChange={(e) => onRecordChange(idx, { [f.key]: e.target.value })}
        className="w-full px-2 py-1 rounded border border-[#d6c7ab] text-t11 bg-[#fbf7ee] text-[#3c2415]"
      >
        <option value="">（請選擇）</option>
        {f.options.map((o) => {
          const val = typeof o === 'object' ? o.value : o;
          const label = typeof o === 'object' ? (o.label || o.value) : o;
          return <option key={val} value={val}>{label}</option>;
        })}
      </select>
    );
  }

  if (f.numeric) {
    return (
      <input
        type="number"
        min={0}
        data-testid={id}
        value={value}
        onChange={(e) => onRecordChange(idx, { [f.key]: e.target.value })}
        className="w-full px-2 py-1 rounded border border-[#d6c7ab] text-t11 bg-[#fbf7ee] text-[#3c2415]"
      />
    );
  }

  if (f.multiline) {
    return (
      <textarea
        rows={2}
        maxLength={f.maxLength || 120}
        data-testid={id}
        value={value}
        onChange={(e) => onRecordChange(idx, { [f.key]: e.target.value })}
        className="w-full p-1.5 rounded border border-[#d6c7ab] text-t11 bg-[#fbf7ee] text-[#3c2415] leading-relaxed"
        placeholder={`填寫${f.label}...`}
      />
    );
  }

  return (
    <input
      type="text"
      maxLength={f.maxLength || 24}
      data-testid={id}
      value={value}
      onChange={(e) => onRecordChange(idx, { [f.key]: e.target.value })}
      className="w-full px-2 py-1 rounded border border-[#d6c7ab] text-t11 bg-[#fbf7ee] text-[#3c2415]"
      placeholder={`填寫${f.label}...`}
    />
  );
}

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
  // 記錄列上的「套用」：目前只有【升級】用得到（把一筆草稿結算成扣款＋履歷）。
  // 傳 null 就不畫按鈕——面板不替每一筆都長一顆用不到的按鈕。
  onApplyRecord = null,
  applyLabel = '套用',
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
                      {fieldControl(f, rec, idx, testId, onRecordChange, spec, minRecords)}
                    </div>
                  ))}
                  {/* 「套用」只出現在有給 `onApplyRecord` 的面板（目前是【升級】）。
                      做完就標成「已套用」並鎖住，避免同一筆重複扣款。 */}
                  {onApplyRecord && rec.applied ? (
                    <p
                      data-testid={`${testId}-applied-${idx}`}
                      className="text-t11 font-bold text-[#6b5a4b]"
                    >
                      ✓ 已套用（支付 {rec.paid}z）
                    </p>
                  ) : null}
                  {onApplyRecord && !rec.applied ? (
                    <button
                      type="button"
                      data-testid={`${testId}-apply-${idx}`}
                      onClick={() => onApplyRecord(idx)}
                      className="px-2.5 py-1 rounded bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-t11"
                    >
                      {applyLabel}
                    </button>
                  ) : null}
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
