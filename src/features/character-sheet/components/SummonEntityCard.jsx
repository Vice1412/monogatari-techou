import React, { useState } from 'react';
import {
  GiSparkles,
  GiBroadsword,
  GiBowman,
  GiShield,
  GiCheckMark
} from 'react-icons/gi';
import {
  calculateAvatarMaxHp,
  createDefaultAvatarDraft,
  validateAvatarChoices,
  calculateAvatarAttackRange,
  calculateAvatarDamageFormula,
  calculateAvatarDamageType,
  AVATAR_DAMAGE_TYPES,
  AVATAR_ELEMENTAL_TYPES,
  AVATAR_ATTRIBUTES,
  AVATAR_FEATURE_OPTIONS
} from '../utils/summonAvatar';
import { getCharacterLevel } from '../utils/characterEngine';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';

export default function SummonEntityCard({
  character,
  itemId = 'heroic:偉大召喚',
  isVariant = false,
  theme,
  onChange = () => {},
  showToast = () => {}
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  // 顯現體清單存放在 flowState[itemId].list
  const heroicState = character?.flowState?.[itemId] || {};
  const avatarList = Array.isArray(heroicState.list) ? heroicState.list : [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeAvatar = avatarList[selectedIndex] || null;
  const charLevel = getCharacterLevel(character);
  const calculatedMaxHp = calculateAvatarMaxHp(character);

  const updateAvatarList = (newList) => {
    const nextFlowState = {
      ...(character.flowState || {}),
      [itemId]: {
        ...heroicState,
        list: newList
      }
    };
    onChange({
      ...character,
      flowState: nextFlowState,
      updatedAt: new Date().toISOString()
    });
  };

  const handleStartCreate = () => {
    const bound = character?.arcanistData?.boundArcana || [];
    const firstBound = bound.length > 0 ? bound[0] : '';
    setDraft(createDefaultAvatarDraft(firstBound));
    setIsEditing(true);
  };

  const handleSaveDraft = () => {
    const check = validateAvatarChoices(draft);
    if (!check.ok) {
      showToast(check.reason || '設定尚未填齊', 'warning');
      return;
    }
    const newAvatar = {
      id: `avatar_${Date.now()}`,
      arcanumName: draft.arcanumName.trim(),
      choices: { ...draft },
      active: false,
      currentHp: calculatedMaxHp,
      maxHp: calculatedMaxHp,
      note: draft.note || ''
    };
    const nextList = [...avatarList, newAvatar];
    updateAvatarList(nextList);
    setSelectedIndex(nextList.length - 1);
    setIsEditing(false);
    setDraft(null);
    showToast(`已建立【${newAvatar.arcanumName}】顯現體設定`, 'success');
  };

  const handleSummon = (avatar, idx) => {
    if (!avatar) return;
    const curHp = Number(character.currentHp ?? character.maxHp ?? 40);
    const hpCost = Math.floor(curHp / 2);
    const curFp = Number(character.fabulaPoints ?? 1);

    if (curFp < 1) {
      showToast('物語點不足（需要 1 點）', 'warning');
      return;
    }

    const nextFp = Math.max(0, curFp - 1);
    const nextCharHp = Math.max(1, curHp - hpCost);

    const updatedList = avatarList.map((a, i) =>
      i === idx ? { ...a, active: true, currentHp: a.maxHp || calculatedMaxHp } : a
    );

    const nextFlowState = {
      ...(character.flowState || {}),
      [itemId]: {
        ...heroicState,
        list: updatedList
      }
    };

    onChange({
      ...character,
      fabulaPoints: nextFp,
      currentHp: nextCharHp,
      flowState: nextFlowState,
      updatedAt: new Date().toISOString()
    });

    showToast(`成功召喚【${avatar.arcanumName}】顯現體！消耗 1 物語點與 ${hpCost} HP`, 'success');
  };

  const handleDismiss = (idx) => {
    const updatedList = avatarList.map((a, i) =>
      i === idx ? { ...a, active: false } : a
    );
    updateAvatarList(updatedList);
    showToast('顯現體已解除召喚', 'info');
  };

  const handleDelete = (idx) => {
    const nextList = avatarList.filter((_, i) => i !== idx);
    updateAvatarList(nextList);
    setSelectedIndex(0);
    showToast('已刪除該顯現體記錄', 'info');
  };

  const handleAdjustAvatarHp = (idx, delta) => {
    const updatedList = avatarList.map((a, i) => {
      if (i !== idx) return a;
      const max = a.maxHp || calculatedMaxHp;
      const nextHp = Math.max(0, Math.min(max, (a.currentHp ?? max) + delta));
      return { ...a, currentHp: nextHp };
    });
    updateAvatarList(updatedList);
  };

  // ── 編輯模式 ───────────────────────────────────────────────
  if (isEditing && draft) {
    const check = validateAvatarChoices(draft);
    return (
      <div data-testid="avatar-editor" className="p-3 rounded border bg-white space-y-3 border-[#d6c7ab]">
        <div className="flex items-center justify-between border-b border-[#e8dcc4] pb-2">
          <span className="text-t12 font-bold text-[#3c2415]">
            首次召喚設定：顯現體五組自選（永久固定）
          </span>
          <button
            type="button"
            data-testid="avatar-editor-cancel"
            onClick={() => { setIsEditing(false); setDraft(null); }}
            className="text-t11 text-[#6b5a4b] hover:text-[#3c2415]"
          >
            ✕ 取消
          </button>
        </div>

        {/* 阿爾卡納名稱 */}
        <label className="block text-t11 font-bold text-[#3c2415] space-y-1">
          <span>對應阿爾卡納名稱</span>
          <input
            type="text"
            data-testid="avatar-field-arcanum"
            value={draft.arcanumName}
            onChange={(e) => setDraft({ ...draft, arcanumName: e.target.value })}
            placeholder="例：劍、鍛造、雷霆..."
            className="w-full px-2 py-1 rounded border border-[#d6c7ab] text-t12"
          />
        </label>

        {/* 1. 屬性分配：指派一個 d10 */}
        <div className="space-y-1">
          <span className="text-t11 font-bold text-[#3c2415]">
            ① 屬性分配（指派 1 個 d10，其餘 3 項為 d8）
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {AVATAR_ATTRIBUTES.map((attr) => (
              <label
                key={attr.key}
                data-testid={`avatar-attr-${attr.key}`}
                className={`flex items-center gap-1.5 p-1.5 rounded border text-t11 font-bold cursor-pointer transition-colors ${
                  draft.attrD10 === attr.key
                    ? 'bg-[#f4ebd9] border-[#3c2415] text-[#3c2415]'
                    : 'bg-white border-[#d6c7ab] text-[#6b5a4b]'
                }`}
              >
                <input
                  type="radio"
                  name="avatarAttrD10"
                  checked={draft.attrD10 === attr.key}
                  onChange={() => setDraft({ ...draft, attrD10: attr.key })}
                  className="sr-only"
                />
                <span>{attr.label}</span>
                {draft.attrD10 === attr.key && <span className="text-[#a63d40]">d10</span>}
              </label>
            ))}
          </div>
        </div>

        {/* 2. 傷害抗性：選 2 項 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-t11 font-bold text-[#3c2415]">
            <span>② 傷害抗性（自選 2 項抗性）</span>
            <span className="text-[#6b5a4b] text-t10">已選 {draft.resistances.length} / 2</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {AVATAR_DAMAGE_TYPES.map((type) => {
              const checked = draft.resistances.includes(type);
              const disabled = !checked && draft.resistances.length >= 2;
              return (
                <button
                  key={type}
                  type="button"
                  data-testid={`avatar-res-${type}`}
                  disabled={disabled}
                  onClick={() => {
                    const next = checked
                      ? draft.resistances.filter((r) => r !== type)
                      : [...draft.resistances, type];
                    setDraft({ ...draft, resistances: next });
                  }}
                  className={`px-1.5 py-1 rounded border text-t11 font-bold transition-colors ${
                    checked
                      ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                      : disabled
                        ? 'bg-[#f4ebd9] text-[#7c6a58] border-[#e8dcc4] cursor-not-allowed'
                        : 'bg-white text-[#3c2415] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 四選二選項 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-t11 font-bold text-[#3c2415]">
            <span>③ 攻擊選項（4 選 2 項）</span>
            <span className="text-[#6b5a4b] text-t10">已選 {draft.features.length} / 2</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {AVATAR_FEATURE_OPTIONS.map((feat) => {
              const checked = draft.features.includes(feat.id);
              const disabled = !checked && draft.features.length >= 2;
              return (
                <button
                  key={feat.id}
                  type="button"
                  data-testid={`avatar-feat-${feat.id}`}
                  disabled={disabled}
                  onClick={() => {
                    const next = checked
                      ? draft.features.filter((f) => f !== feat.id)
                      : [...draft.features, feat.id];
                    setDraft({ ...draft, features: next });
                  }}
                  className={`p-1.5 rounded border text-t11 text-left font-bold transition-colors ${
                    checked
                      ? 'bg-[#f4ebd9] text-[#3c2415] border-[#3c2415]'
                      : disabled
                        ? 'bg-[#f4ebd9] text-[#7c6a58] border-[#e8dcc4] cursor-not-allowed'
                        : 'bg-white text-[#3c2415] border-[#d6c7ab] hover:bg-[#f4ebd9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{feat.label}</span>
                    {checked && <GiCheckMark className="w-3 h-3 text-[#3c2415]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 若選了選項③：自選元素傷害類型 */}
        {draft.features.includes('custom_type') && (
          <label className="block text-t11 font-bold text-[#3c2415] space-y-1">
            <span>自選傷害類型（非物理 8 相之一）</span>
            <select
              data-testid="avatar-field-damagetype"
              value={draft.damageType}
              onChange={(e) => setDraft({ ...draft, damageType: e.target.value })}
              className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white text-t12"
            >
              {AVATAR_ELEMENTAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}屬性</option>
              ))}
            </select>
          </label>
        )}

        {/* 檢定屬性選擇 */}
        <div className="space-y-1">
          <span className="text-t11 font-bold text-[#3c2415]">
            ④ 命中檢定屬性 {draft.features.includes('single_attr') ? '（單一屬性）' : '（兩項不同屬性）'}
          </span>
          {draft.features.includes('single_attr') ? (
            <select
              data-testid="avatar-check-single"
              value={draft.checkAttrs[0] || 'mig'}
              onChange={(e) => setDraft({ ...draft, checkAttrs: [e.target.value] })}
              className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white text-t12"
            >
              {AVATAR_ATTRIBUTES.map((a) => (
                <option key={a.key} value={a.key}>{a.label} + {a.label}</option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <select
                data-testid="avatar-check-attr1"
                value={draft.checkAttrs[0] || 'mig'}
                onChange={(e) => setDraft({ ...draft, checkAttrs: [e.target.value, draft.checkAttrs[1] || 'wlp'] })}
                className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white text-t12"
              >
                {AVATAR_ATTRIBUTES.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
              <select
                data-testid="avatar-check-attr2"
                value={draft.checkAttrs[1] || 'wlp'}
                onChange={(e) => setDraft({ ...draft, checkAttrs: [draft.checkAttrs[0] || 'mig', e.target.value] })}
                className="w-full px-2 py-1 rounded border border-[#d6c7ab] bg-white text-t12"
              >
                {AVATAR_ATTRIBUTES.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 驗證未通過提示 */}
        {!check.ok && (
          <p data-testid="avatar-validation-reason" className="text-t11 text-[#a63d40] font-bold">
            ※ {check.reason}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8dcc4]">
          <button
            type="button"
            data-testid="avatar-save-btn"
            disabled={!check.ok}
            onClick={handleSaveDraft}
            className="px-3 py-1.5 rounded bg-[#3c2415] disabled:bg-[#7c6a58] text-[#fffdf9] font-bold text-t12 cursor-pointer disabled:cursor-not-allowed"
          >
            確定並鎖定選擇
          </button>
        </div>
      </div>
    );
  }

  // ── 瀏覽 / 跑團模式 ─────────────────────────────────────────
  return (
    <div data-testid="summon-avatar-card" className="p-2.5 rounded border bg-[#fbf7ee] border-[#d6c7ab] space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <GiSparkles className="w-4 h-4 text-[#a63d40]" />
          <span className="text-t12 font-bold text-[#3c2415]">
            {isVariant ? '偉大召喚【變體】顯現體' : '偉大召喚顯現體'}
          </span>
          <span className="text-t10 text-[#6b5a4b]">（等級 {charLevel}）</span>
        </div>
        <button
          type="button"
          data-testid="avatar-create-btn"
          onClick={handleStartCreate}
          className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-white hover:bg-[#f4ebd9] text-t11 font-bold text-[#3c2415] cursor-pointer"
        >
          ＋ 設定新顯現體
        </button>
      </div>

      {avatarList.length === 0 ? (
        <div data-testid="avatar-empty-hint" className="p-3 text-center rounded border border-dashed border-[#d6c7ab] bg-white text-t11 text-[#6b5a4b] space-y-1">
          <p>尚未記錄任何阿爾卡納顯現體。</p>
          <p className="text-t12">原文鐵律：任何選擇都必須在首次召喚時做出並記錄。未填齊時不可召喚。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* 切換不同阿爾卡納顯現體 */}
          {avatarList.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {avatarList.map((a, i) => (
                <button
                  key={a.id || i}
                  type="button"
                  data-testid={`avatar-tab-${i}`}
                  onClick={() => setSelectedIndex(i)}
                  className={`px-2 py-0.5 rounded border text-t11 font-bold ${
                    selectedIndex === i
                      ? 'bg-[#3c2415] text-[#fffdf9] border-[#3c2415]'
                      : 'bg-white text-[#3c2415] border-[#d6c7ab]'
                  }`}
                >
                  【{a.arcanumName}】{a.active ? '（顯現中）' : ''}
                </button>
              ))}
            </div>
          )}

          {activeAvatar && (
            <div data-testid="avatar-display" className="p-2.5 rounded border bg-white border-[#d6c7ab] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-t14 text-[#3c2415]">
                    【{activeAvatar.arcanumName}】顯現體
                  </span>
                  <span className={`text-t10 font-bold px-1.5 py-0.5 rounded ${activeAvatar.active ? 'bg-[#3c2415] text-[#fffdf9]' : 'bg-[#f4ebd9] text-[#6b5a4b]'}`}>
                    {activeAvatar.active ? '顯現中' : '未召喚'}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="avatar-delete-btn"
                  onClick={() => handleDelete(selectedIndex)}
                  className="text-t11 text-[#a63d40] hover:underline"
                >
                  刪除此記錄
                </button>
              </div>

              {/* 數值面板：HP、屬性與抗性 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-t11 bg-[#fbf7ee] p-2 rounded border border-[#e8dcc4]">
                <div>
                  <span className="text-[#6b5a4b] block">最大 HP：</span>
                  <span className="font-bold text-[#3c2415]">{calculatedMaxHp}</span>
                </div>
                <div>
                  <span className="text-[#6b5a4b] block">當前 HP：</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span data-testid="avatar-hp-val" className="text-[#a63d40]">{activeAvatar.currentHp ?? calculatedMaxHp}</span>
                    <button
                      type="button"
                      data-testid="avatar-hp-minus"
                      onClick={() => handleAdjustAvatarHp(selectedIndex, -1)}
                      className="px-1 bg-white border rounded text-t10 border-[#d6c7ab]"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      data-testid="avatar-hp-plus"
                      onClick={() => handleAdjustAvatarHp(selectedIndex, 1)}
                      className="px-1 bg-white border rounded text-t10 border-[#d6c7ab]"
                    >
                      ＋
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-[#6b5a4b] block">屬性骰：</span>
                  <span className="text-t10 font-bold">
                    DEX: d{activeAvatar.choices.attrD10 === 'dex' ? '10' : '8'} | INS: d{activeAvatar.choices.attrD10 === 'ins' ? '10' : '8'} | MIG: d{activeAvatar.choices.attrD10 === 'mig' ? '10' : '8'} | WLP: d{activeAvatar.choices.attrD10 === 'wlp' ? '10' : '8'}
                  </span>
                </div>
              </div>

              {/* 抗性與攻擊 */}
              <div className="space-y-1 text-t11">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[#6b5a4b] font-bold">抗性：</span>
                  {activeAvatar.choices.resistances.map((r) => (
                    <span key={r} className="px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-t10 font-bold text-[#3c2415]">
                      {renderTextWithAffinities(r)}抗性
                    </span>
                  ))}
                </div>
                <div>
                  <span className="text-[#6b5a4b] font-bold">基礎攻擊：</span>
                  <span className="font-bold text-[#3c2415]">
                    【{calculateAvatarAttackRange(activeAvatar.choices)}】
                    【{(activeAvatar.choices.checkAttrs || []).map(a => a.toUpperCase()).join(' + ')}】
                    {calculateAvatarDamageFormula(activeAvatar.choices)}
                    {renderTextWithAffinities(calculateAvatarDamageType(activeAvatar.choices))}傷害
                  </span>
                </div>
              </div>

              {/* 變體版脈衝註記 */}
              {isVariant && (
                <div className="p-1.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-t10 text-[#3c2415]">
                  <span className="font-bold text-[#a63d40]">❖ 脈衝授權：</span>
                  顯現體可代你執行該阿爾卡納的脈衝；若使用【快速召喚】則不可使用本技能。
                </div>
              )}

              {/* 召喚按鈕 */}
              <div className="pt-1">
                {activeAvatar.active ? (
                  <button
                    type="button"
                    data-testid="avatar-dismiss-btn"
                    onClick={() => handleDismiss(selectedIndex)}
                    className="w-full py-1.5 rounded border border-[#d6c7ab] bg-white hover:bg-[#f4ebd9] text-[#3c2415] text-t12 font-bold cursor-pointer"
                  >
                    解除顯現
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="avatar-summon-btn"
                    onClick={() => handleSummon(activeAvatar, selectedIndex)}
                    className="w-full py-1.5 rounded bg-[#3c2415] hover:opacity-90 text-[#fffdf9] text-t12 font-bold cursor-pointer shadow-sm"
                  >
                    召喚顯現（花費 1 物語點 ＋ 當前 HP 一半）
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

