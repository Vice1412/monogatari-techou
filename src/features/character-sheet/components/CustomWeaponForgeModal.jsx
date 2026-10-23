import React, { useEffect, useMemo, useState } from 'react';
import GameIcon from '../../../components/ui/GameIcon';
import JRPGButton from '../../../components/ui/JRPGButton';
import JRPGModal from '../../../components/ui/JRPGModal';
import { CATEGORY_ICON } from '../utils/equipmentRules';
import {
  CUSTOMIZATION_MAP,
  CUSTOMIZATIONS,
  CUSTOM_WEAPON_ACCURACIES,
  CUSTOM_WEAPON_BASE,
  CUSTOM_WEAPON_CATEGORIES,
  CUSTOM_WEAPON_ELEMENTS,
  CUSTOM_WEAPON_RANGES,
  CUSTOM_WEAPON_SLOTS,
  buildCustomWeaponEntry,
  createCustomWeaponSpec,
  remainingSlots,
  usedSlots,
  validateCustomWeapon
} from '../data/customWeapons';

/**
 * 【定制武器】鍛造台（高度奇幻手冊 p.106 的選用規則）。
 *
 * 面板順序照**使用者自製的 Excel 鍛造台**：類別 → 名稱 → 攻擊類型 → 命中檢定 →
 * 三個訂製能力（可變形時再展開第二型態）。那個順序就是玩家思考的順序，不要重排。
 *
 * 這一版刻意只做**規則允許的事**：起始規格（300z／雙手／HR+5／近戰或遠程自選）
 * 不給玩家改，因為原書把它寫成固定值。玩家能做的是選類別、命名、選命中檢定、挑三個訂製能力。
 */
export default function CustomWeaponForgeModal({
  isOpen,
  onClose,
  theme,
  character,
  onSave,
  editingId = ''
}) {
  const existing = character?.customWeapons || [];
  const [specs, setSpecs] = useState([createCustomWeaponSpec()]);
  const [active, setActive] = useState(0);

  // 開啟時載入要編輯的那一把（含它的第二型態），否則開一把全新的
  useEffect(() => {
    if (!isOpen) return;
    if (editingId) {
      const target = existing.find((s) => s.id === editingId);
      if (target) {
        const sibling = existing.find((s) => s.id === target.transformingId);
        setSpecs(sibling ? [target, sibling] : [target]);
        setActive(0);
        return;
      }
    }
    setSpecs([createCustomWeaponSpec()]);
    setActive(0);
    // existing 由 character 衍生；只在開啟或換目標時重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  const spec = specs[active] || specs[0];
  const entry = useMemo(() => buildCustomWeaponEntry(spec), [spec]);
  const { ok, issues } = useMemo(
    () => validateCustomWeapon(spec, { siblings: specs }),
    [spec, specs]
  );
  const issueFor = (field) => issues.find((i) => i.field === field)?.message || '';
  const has = (key) => (spec?.customizations || []).includes(key);

  const patch = (changes) => {
    setSpecs((prev) => prev.map((s, i) => (i === active ? { ...s, ...changes } : s)));
  };

  /** 切換一個訂製能力（含名額與互斥的即時判定） */
  const toggleCustomization = (key) => {
    const def = CUSTOMIZATION_MAP[key];
    if (!def) return;
    const picks = spec.customizations || [];
    if (picks.includes(key)) {
      const next = picks.filter((k) => k !== key);
      // 關掉可變形 → 連第二型態一起收掉（原書要求兩者成對）
      if (key === 'transforming') {
        const other = specs.find((s) => s.id === spec.transformingId);
        setSpecs((prev) => prev
          .filter((s) => !other || s.id !== other.id)
          .map((s) => (s.id === spec.id ? { ...s, customizations: next, transformingId: '' } : s)));
        return;
      }
      const cleared = key === 'elemental' ? { element: '' } : {};
      patch({ customizations: next, ...cleared });
      return;
    }
    // 名額不夠就不給選（畫面上該項本來就會被標成不可選，這裡是第二道）
    if (def.slots > remainingSlots(spec)) return;
    // 強力的兩個限制
    if (def.forbiddenCategories?.includes(spec.category)) return;
    if (def.conflictsWith?.some((k) => picks.includes(k))) return;

    const next = [...picks, key];
    if (key === 'transforming') {
      const second = createCustomWeaponSpec({
        name: `${spec.name || CUSTOM_WEAPON_BASE.label}（第二型態）`,
        customizations: ['transforming']
      });
      const linked = { ...spec, customizations: next, transformingId: second.id };
      setSpecs((prev) => prev.map((s) => (s.id === spec.id ? linked : s)).concat({
        ...second,
        transformingId: spec.id
      }));
      return;
    }
    patch({ customizations: next });
  };

  /** 切類別時，若【強力】已選但它在新類別不合法，就順手拿掉（否則會留下一個無效狀態） */
  const changeCategory = (category) => {
    const picks = spec.customizations || [];
    const next = CUSTOMIZATION_MAP.powerful.forbiddenCategories.includes(category)
      ? picks.filter((k) => k !== 'powerful')
      : picks;
    patch({ category, customizations: next });
  };

  const save = () => {
    if (!ok) return;
    // 只把這一組（含第二型態）交出去；同 id 的舊資料由呼叫端覆蓋
    onSave(specs);
  };

  const label = (text, extra = null) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-bold" style={{ color: theme.textDark }}>{text}</span>
      {extra}
    </div>
  );

  const chipClass = 'px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer';

  const renderCustomizationRow = (def) => {
    const picked = has(def.key);
    const blockedBySlots = !picked && def.slots > remainingSlots(spec);
    const blockedByCategory = def.forbiddenCategories?.includes(spec.category);
    const blockedByConflict = def.conflictsWith?.some((k) => has(k));
    const blocked = blockedBySlots || blockedByCategory || blockedByConflict;
    const reason = blockedByCategory
      ? `不適用於${spec.category}類別`
      : blockedBySlots
        ? '名額不足'
        : blockedByConflict
          ? '與已選的能力互斥'
          : '';
    return (
      <button
        key={def.key}
        type="button"
        onClick={() => toggleCustomization(def.key)}
        disabled={blocked && !picked}
        className={`w-full text-left p-2.5 rounded-lg border transition-all ${blocked && !picked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          backgroundColor: picked ? theme.subpanelBg : theme.cardBg,
          borderColor: picked ? theme.accent : theme.border
        }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold" style={{ color: theme.textDark }}>{def.name}</span>
          {def.martial && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.accent }}>
              職業武器
            </span>
          )}
          {def.slots === 2 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.textDark }}>
              佔 2 個名額
            </span>
          )}
          {def.costDelta > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.textDark }}>
              +{def.costDelta}z
            </span>
          )}
          {picked && (
            <span className="text-[10px] font-bold ml-auto" style={{ color: theme.accent }}>已選</span>
          )}
        </div>
        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: theme.textDark }}>
          {def.effect}
        </p>
        {reason && (
          <p className="text-[10px] mt-0.5 text-amber-800">{reason}</p>
        )}
      </button>
    );
  };

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title={`鍛造【${CUSTOM_WEAPON_BASE.label}】`}
      maxWidth="max-w-4xl"
      theme={theme}
      actionButtons={
        <div className="flex items-center gap-2">
          <JRPGButton
            variant={theme.buttonVariant || 'primary'}
            size="sm"
            onClick={save}
            disabled={!ok}
          >
            完成鍛造
          </JRPGButton>
          <JRPGButton variant="ghost" size="sm" onClick={onClose}>取消</JRPGButton>
        </div>
      }
    >
      <div className="space-y-3">
        {/* 起始規格（原書固定值，不給改） */}
        <div className="p-3 rounded-lg border text-xs space-y-1" style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }}>
          <p className="font-bold" style={{ color: theme.textDark }}>
            起始規格（原書 p.106 固定值）
          </p>
          <p style={{ color: theme.textDark }}>
            成本 {CUSTOM_WEAPON_BASE.cost}z（可變形 +{CUSTOM_WEAPON_BASE.transformingCost}z）、
            雙手武器（永遠佔滿兩個手部欄位，不能配【靈猴握】英雄技能）、
            傷害【HR + {CUSTOM_WEAPON_BASE.damageBonus}】物理、
            命中檢定與遠近類型自選、類別自選。
          </p>
          <p className="text-t12 text-[#6b5a4b]">
            另外獲得 {CUSTOM_WEAPON_SLOTS} 個訂製能力（【迅捷】佔 2 個）。每個能力只能選一次；
            選到標「職業武器」的能力，這把武器就需要對應職業才能裝備。
          </p>
        </div>

        {/* 可變形時切換型態 */}
        {specs.length > 1 && (
          <div className="flex items-center gap-1.5">
            {specs.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={chipClass}
                style={{
                  backgroundColor: i === active ? theme.accent : theme.cardBg,
                  borderColor: theme.border,
                  color: i === active ? '#fffdf9' : theme.textDark
                }}
              >
                {i === 0 ? '形態一' : `形態二：${s.name || '未命名'}`}
              </button>
            ))}
          </div>
        )}

        {/* 類別 */}
        {label('武器類別', <span className="text-[11px] text-[#6b5a4b]">十選一（Core p.129）</span>)}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CUSTOM_WEAPON_CATEGORIES.map((cat) => {
            const on = spec.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => changeCategory(cat)}
                className={`${chipClass} flex items-center gap-1`}
                style={{
                  backgroundColor: on ? theme.accent : theme.cardBg,
                  borderColor: theme.border,
                  color: on ? '#fffdf9' : theme.textDark
                }}
              >
                <GameIcon name={CATEGORY_ICON[cat]} size={13} />
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* 名稱 */}
        {label('自定義名字', issueFor('name') ? <span className="text-[11px] text-amber-800">{issueFor('name')}</span> : null)}
        <input
          type="text"
          value={spec.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="例：戰車、魔警巨劍、狂風提琴"
          className="w-full border rounded-lg px-3 py-2 text-xs outline-none shadow-sm"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
        />

        {/* 攻擊類型與命中檢定 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            {label('攻擊類型', <span className="text-[11px] text-[#6b5a4b]">與類別無關</span>)}
            <div className="flex items-center gap-1.5">
              {CUSTOM_WEAPON_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => patch({ range: r })}
                  className={chipClass}
                  style={{
                    backgroundColor: spec.range === r ? theme.accent : theme.cardBg,
                    borderColor: theme.border,
                    color: spec.range === r ? '#fffdf9' : theme.textDark
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            {label('命中檢定')}
            <div className="flex items-center gap-1.5">
              {CUSTOM_WEAPON_ACCURACIES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => patch({ accuracy: a })}
                  className={`${chipClass} font-mono`}
                  style={{
                    backgroundColor: spec.accuracy === a ? theme.accent : theme.cardBg,
                    borderColor: theme.border,
                    color: spec.accuracy === a ? '#fffdf9' : theme.textDark
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 訂製能力 */}
        {label('訂製能力', (
          <span className="text-[11px] font-bold" style={{ color: remainingSlots(spec) === 0 ? theme.accent : '#b45309' }}>
            已用 {usedSlots(spec)} / {CUSTOM_WEAPON_SLOTS} 個名額
          </span>
        ))}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CUSTOMIZATIONS.map(renderCustomizationRow)}
        </div>
        {issueFor('customizations') && (
          <p className="text-[11px] text-amber-800">{issueFor('customizations')}</p>
        )}

        {/* 元素屬性 */}
        {has('elemental') && (
          <div className="space-y-1.5">
            {label('元素屬性', <span className="text-[11px] text-[#6b5a4b]">八選一</span>)}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CUSTOM_WEAPON_ELEMENTS.map((el) => (
                <button
                  key={el}
                  type="button"
                  onClick={() => patch({ element: el })}
                  className={chipClass}
                  style={{
                    backgroundColor: spec.element === el ? theme.accent : theme.cardBg,
                    borderColor: theme.border,
                    color: spec.element === el ? '#fffdf9' : theme.textDark
                  }}
                >
                  {el}
                </button>
              ))}
            </div>
            {issueFor('element') && <p className="text-[11px] text-amber-800">{issueFor('element')}</p>}
          </div>
        )}

        {/* 即時預覽：玩家當下看到的就是裝備表會收到的東西 */}
        <div className="p-3 rounded-lg border space-y-1.5" style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }}>
          <div className="flex items-center gap-2">
            <GameIcon name={CATEGORY_ICON[spec.category]} size={18} />
            <span className="text-sm font-bold" style={{ color: theme.textDark }}>
              {spec.name || '（尚未命名）'}
            </span>
            {entry.martial && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.accent }}>
                職業武器
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono" style={{ color: theme.textDark }}>
            <span>命中 {entry.attr}</span>
            <span>{entry.damage}</span>
            <span>{entry.range}</span>
            <span>{entry.cost}z</span>
          </div>
          <p className="text-[11px]" style={{ color: theme.textDark }}>{entry.note}</p>
        </div>

        {!ok && (
          <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs space-y-1">
            {issues.map((i) => <div key={i.message}>{i.message}</div>)}
          </div>
        )}
      </div>
    </JRPGModal>
  );
}
