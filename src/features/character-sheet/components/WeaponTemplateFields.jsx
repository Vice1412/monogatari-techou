import React, { useMemo, useState } from 'react';
import { GiQuillInk } from 'react-icons/gi';
import JRPGButton from '../../../components/ui/JRPGButton';
import {
  CUSTOM_WEAPON_CATEGORIES,
  CUSTOM_WEAPON_RANGES,
  buildFreeformWeaponItem,
  createFreeformWeaponSpec,
  validateFreeformWeapon
} from '../data/customWeapons';
import { describeEquipmentRecord, describePurchase, formatZenit } from '../utils/zenitFeedback';
import { GATED_LABEL_CLASS, GATED_SHELL_CLASS } from '../utils/playAvailability';

/**
 * 自由武器模板（P9-c，2026-10-31）
 *
 * 使用者：「武器並不是只有基礎武器而已，請你開放自由的武器模板讓玩家寫資訊。」
 *
 * ## 這一支不是「第二個鍛造台」
 *
 * 專案裡已經有【定制武器】（HF p.106）——300z、雙手、+5 傷害、三個訂製名額。
 * 那是一張考卷：很好，但它只能生出「規則允許的武器」。
 *
 * 跑團現場真正會出現的是 GM 隨手給的那把東西：「守墓人的鏽劍」「缺角的柴刀」
 * 「公會發的制式長槍」。它們沒有訂製能力、價格不是 300z、傷害也不是 HR + 5。
 * 所以這裡**一格公式都不套**——玩家寫什麼就記什麼。
 *
 * ## 兩件事仍然是硬的
 *
 * 1. **名稱與價格必填。** 沒有名字的武器在裝備欄裡叫 `''`，畫面上是一格空白；
 *    沒有價格就算不出餘額（`applyPurchase` 需要算術）。想寫 0 元就填 0。
 * 2. **記錄格式仍然走 `describeEquipmentRecord`。** 同一次購買不該有兩種寫法——
 *    書上的劍與自己寫的劍，在履歷上要長得一樣，只差內容。
 *
 * ## 為什麼表單與外殼分開
 *
 * 它被兩個地方使用（購買面板的「＋ 自訂武器」與換裝彈窗的「＋ 自訂武器」），
 * 兩邊的**動作不同**（一個是純購買、一個是購買並裝備），但**填的東西一樣**。
 * 所以表單只負責填與驗，送出後把 `{ item, spec }` 交回呼叫端。
 */

/** 類別 → 這個類別常見的傷害式，當作填空的起點（可改）。 */
const DAMAGE_HINT = {
  奧術: '【HR + 0】物理',
  弓: '【HR + 0】物理',
  鬥毆: '【HR + 0】物理',
  匕首: '【HR + 0】物理',
  火器: '【HR + 0】物理',
  連枷: '【HR + 0】物理',
  重型: '【HR + 0】物理',
  矛: '【HR + 0】物理',
  劍: '【HR + 0】物理',
  投擲: '【HR + 0】物理'
};

/**
 * 送出鈕為什麼不能按——**四種狀態、四句話**（與結帳鈕同一個原則）。
 *
 * 「還有欄位沒填」與「錢不夠」與「不知道你有多少錢」是三件不同的事，
 * 併成一句的話，玩家填錯一格會被說成沒錢。
 */
export const describeTemplateBlock = ({ issues = [], gate } = {}) => {
  if (issues.length > 0) return issues[0].message;
  if (gate?.affordable === true) return '';
  if (gate?.affordable === null) return '錢包金額尚未記錄，無法結帳';
  return `資金不足：${gate?.shortText || ''}`;
};

export function WeaponTemplateFields({
  theme = {},
  wallet,
  submitLabel = '購入並裝備',
  onSubmit,
  onBack
}) {
  const [spec, setSpec] = useState(() => createFreeformWeaponSpec());

  const { ok, issues } = useMemo(() => validateFreeformWeapon(spec), [spec]);
  const item = useMemo(() => buildFreeformWeaponItem(spec), [spec]);
  const gate = describePurchase({ price: item.cost, wallet });
  const record = describeEquipmentRecord(item, { equip: true, slotLabel: '主手武器' });
  const blockedReason = describeTemplateBlock({ issues, gate });
  const canSubmit = ok && gate.affordable === true;

  const patch = (changes) => setSpec((prev) => ({ ...prev, ...changes }));
  const issueFor = (field) => issues.find((i) => i.field === field)?.message || '';

  const fieldClass = (field) => `w-full px-2 py-1.5 rounded border bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415] ${
    issueFor(field) ? 'border-[#8c3235]' : 'border-[#e8dcc4]'
  }`;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ item, spec });
  };

  return (
    <div className="space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
          <GiQuillInk className="w-3.5 h-3.5 text-[#6b5a4b]" />
          自己寫一把武器
        </span>
        <button
          type="button"
          data-testid="weapon-template-back"
          onClick={onBack}
          className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#fbf7ee] hover:bg-[#f4ebd9] text-[#6b5a4b] font-bold text-t10 transition-colors"
        >
          返回清單
        </button>
      </div>

      {/* 名稱 */}
      <div className="space-y-1">
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold text-[#3c2415]">名稱</span>
          {issueFor('name') && (
            <span data-testid="weapon-template-error-name" className="text-t11 text-[#8c3235]">
              {issueFor('name')}
            </span>
          )}
        </label>
        <input
          type="text"
          data-testid="weapon-template-name"
          aria-label="武器名稱"
          value={spec.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="例：守墓人的鏽劍"
          className={fieldClass('name')}
        />
      </div>

      {/* 類別 ＋ 遠近 ＋ 單雙手 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="block text-t10 text-[#6b5a4b]">類別</span>
          <select
            data-testid="weapon-template-category"
            aria-label="武器類別"
            value={spec.category}
            onChange={(e) => patch({ category: e.target.value })}
            className={fieldClass('category')}
          >
            {CUSTOM_WEAPON_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-t10 text-[#6b5a4b]">遠近</span>
          <select
            data-testid="weapon-template-range"
            aria-label="遠近"
            value={spec.range}
            onChange={(e) => patch({ range: e.target.value })}
            className={fieldClass('range')}
          >
            {CUSTOM_WEAPON_RANGES.map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className="block text-t10 text-[#6b5a4b]">手數</span>
          <div className="flex items-center gap-1" role="group" aria-label="手數">
            {[1, 2].map((hands) => {
              const active = spec.hands === hands;
              return (
                <button
                  key={hands}
                  type="button"
                  data-testid={`weapon-template-hands-${hands}`}
                  aria-pressed={active}
                  onClick={() => patch({ hands })}
                  className={`flex-1 px-2 py-1.5 rounded border font-bold transition-colors ${
                    active
                      ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                      : 'bg-[#fffdf9] text-[#6b5a4b] border-[#e8dcc4] hover:bg-[#f4ebd9]'
                  }`}
                >
                  {hands === 1 ? '單手' : '雙手'}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* 雙手武器會清空副手——要在選的當下就說，不是買完才說。 */}
      {spec.hands === 2 && (
        <span data-testid="weapon-template-hands-note" className="block text-t10 text-[#8c3235]">
          雙手武器會佔滿兩個手部欄位，裝備時副手會自動卸下。
        </span>
      )}

      {/* 命中 ＋ 傷害 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="flex items-center justify-between gap-2">
            <span className="text-t10 text-[#6b5a4b]">命中檢定</span>
            {issueFor('attr') && (
              <span data-testid="weapon-template-error-attr" className="text-t11 text-[#8c3235]">
                {issueFor('attr')}
              </span>
            )}
          </label>
          <input
            type="text"
            data-testid="weapon-template-attr"
            aria-label="命中檢定屬性"
            value={spec.attr}
            onChange={(e) => patch({ attr: e.target.value })}
            placeholder="DEX + MIG"
            className={fieldClass('attr')}
          />
        </div>
        <div className="space-y-1">
          <label className="flex items-center justify-between gap-2">
            <span className="text-t10 text-[#6b5a4b]">傷害式</span>
            {issueFor('damage') && (
              <span data-testid="weapon-template-error-damage" className="text-t11 text-[#8c3235]">
                {issueFor('damage')}
              </span>
            )}
          </label>
          <input
            type="text"
            data-testid="weapon-template-damage"
            aria-label="傷害式"
            value={spec.damage}
            onChange={(e) => patch({ damage: e.target.value })}
            placeholder={DAMAGE_HINT[spec.category] || '【HR + 0】物理'}
            className={fieldClass('damage')}
          />
        </div>
      </div>

      {/* 價格 ＋ 職業武器 */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <label className="flex items-center justify-between gap-2">
            <span className="text-t10 text-[#6b5a4b]">價格</span>
            {issueFor('cost') && (
              <span data-testid="weapon-template-error-cost" className="text-t11 text-[#8c3235]">
                {issueFor('cost')}
              </span>
            )}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              data-testid="weapon-template-cost"
              aria-label="價格"
              value={String(spec.cost ?? '')}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '');
                // 空字串要留著（不是 0）——`0` 是「我知道，而且是免費」，
                // `''` 是「還沒填」。把空字串轉成 0 會讓「還沒填」變成一個合法的價格。
                patch({ cost: digits === '' ? '' : Number(digits) });
              }}
              placeholder="0"
              className={`w-24 px-2 py-1.5 rounded border bg-[#fffdf9] text-xs tabular-nums font-black text-[#3c2415] outline-none focus:border-[#3c2415] ${
                issueFor('cost') ? 'border-[#8c3235]' : 'border-[#e8dcc4]'
              }`}
            />
            <span className="text-[#6b5a4b]">z</span>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-[#6b5a4b] cursor-pointer select-none pb-1.5">
          <input
            type="checkbox"
            data-testid="weapon-template-martial"
            checked={spec.martial}
            onChange={(e) => patch({ martial: e.target.checked })}
            className="accent-[#a63d40]"
          />
          <span>職業武器（需要對應職業才裝得上）</span>
        </label>
        <span data-testid="weapon-template-math" className="ml-auto pb-1.5 tabular-nums font-black text-[#3c2415]">
          {gate.mathText || '—'}
        </span>
      </div>

      {/* 效果／備註 */}
      <div className="space-y-1">
        <span className="block text-t10 text-[#6b5a4b]">效果或備註（選填）</span>
        <input
          type="text"
          data-testid="weapon-template-note"
          aria-label="效果或備註"
          value={spec.note}
          onChange={(e) => patch({ note: e.target.value })}
          placeholder="例：對亡靈額外 2 點傷害；GM 說這是守墓人留下的"
          className="w-full px-2 py-1.5 rounded border border-[#e8dcc4] bg-[#fffdf9] text-xs text-[#3c2415] outline-none focus:border-[#3c2415]"
        />
      </div>

      {/* 履歷會記成什麼——與書上的裝備同一個模板，只差內容 */}
      <div
        className="rounded border bg-[#fbf7ee] px-2.5 py-1.5 space-y-0.5"
        style={{ borderColor: theme.border }}
      >
        <span className="text-t10 text-[#6b5a4b] block">履歷會記成</span>
        <span data-testid="weapon-template-record-title" className="block font-bold text-[#3c2415]">
          {record.title || '（填完名稱與價格後顯示）'}
        </span>
        {record.note && (
          <span data-testid="weapon-template-record-note" className="block text-t10 text-[#6b5a4b]">
            {record.note}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span data-testid="weapon-template-blocked-reason" className="text-t11 text-[#8c3235]">
          {blockedReason}
        </span>
        <JRPGButton
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          className={canSubmit ? '' : `${GATED_SHELL_CLASS} border-[#d6c7ab] bg-[#e8dcc4] text-[#6b5a4b] hover:bg-[#e8dcc4]`}
          {...(canSubmit ? {} : { 'aria-disabled': 'true', 'data-blocked': 'true', title: blockedReason })}
        >
          <span data-testid="weapon-template-submit" className={canSubmit ? '' : GATED_LABEL_CLASS}>
            {submitLabel}{item.cost > 0 ? ` ${formatZenit(item.cost)}` : ''}
          </span>
        </JRPGButton>
      </div>
    </div>
  );
}

export default WeaponTemplateFields;
