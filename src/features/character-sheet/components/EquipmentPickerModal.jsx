import React, { useMemo, useState, useEffect } from 'react';
import {
  GiMagnifyingGlass,
  GiCheckMark,
  GiHazardSign,
  GiCoins,
  GiSparkles,
  GiRoundShield,
  GiCrossedSwords
} from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import GameIcon from '../../../components/ui/GameIcon';
import rulesData from '../data/rulesData.json';
import { DEFAULT_CREATION_RULES, resolveCreationRules } from '../data/creationRules';
import { modeRestrictsEquipment } from '../data/technospheres';
import {
  WEAPON_CATEGORIES,
  CATEGORY_ICON,
  EQUIPMENT_SLOTS,
  SORT_OPTIONS,
  diceFromStats,
  evaluateWeapon,
  computeArmorOutcome,
  computeShieldOutcome,
  checkEquippable,
  filterWeapons,
  sortWeapons,
  isTwoHanded,
  getEquipmentIcon,
  getDualShieldState
} from '../utils/equipmentRules';
import { isInitiativeVariant, resolveArmorDesc } from '../data/initiativeVariant';

/**
 * 裝備選擇彈窗 (EquipmentPickerModal)
 *
 * 呈現原則（這是本元件存在的理由）：
 * 1. **顯示後果，不顯示規格。** 命中檢定直接寫成該角色的骰（`DEX d8 + INS d6`），
 *    而不是書上的代號（`DEX + INS`）。不寫期望值——那是統計量，不是規則書上的數字。
 * 2. **不能選的原因要在選之前看見**，而且**預設就不列出來**：目前職業組合裝備不了的
 *    一律隱藏，要看得自己勾「顯示目前無法裝備的」。
 * 3. **比較要對齊欄位。** 所以是表格而不是卡片牆——卡片好看，但看不出誰的傷害高。
 * 4. **雙重盾牌（守護者）**：學會後主手可裝備盾牌；兩手皆盾時合併為「雙盾」，
 *    命中／傷害改套用該技能的公式，而不是任何一件盾牌自己的數值（盾牌沒有攻擊資料）。
 *
 * 內容本體 `EquipmentPickerBody` 與彈窗外殼分離，前者可獨立做 SSR 煙霧測試
 * （`JRPGModal` 以掛載後的 effect 為閘門，SSR 時不渲染 children）。
 */

const FILTER_ALL = '全部';

export function EquipmentPickerBody({
  slot = 'mainHand',
  theme,
  character,
  stats,
  remainingBudget = DEFAULT_CREATION_RULES.startingZenit,
  onSelect,
  onClose
}) {
  const slotDef = EQUIPMENT_SLOTS[slot] || EQUIPMENT_SLOTS.mainHand;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(FILTER_ALL);
  const [range, setRange] = useState(FILTER_ALL);
  const [hands, setHands] = useState(FILTER_ALL);
  const [showAll, setShowAll] = useState(false);
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [sortKey, setSortKey] = useState('damageBonus');
  const [sortDir, setSortDir] = useState('desc');
  // 副手欄位需要切換「盾牌 / 單手武器」兩種完全不同的比較基準
  const [offHandMode, setOffHandMode] = useState('shield');

  // 彈窗關閉時 `JRPGModal` 不渲染 children，因此本體每次開啟都是重新掛載；
  // 這裡只需在欄位改變時歸零篩選，不必再監看 isOpen。
  useEffect(() => {
    setQuery('');
    setCategory(FILTER_ALL);
    setRange(FILTER_ALL);
    setHands(FILTER_ALL);
    setShowAll(false);
    setAffordableOnly(false);
    setSortKey(slot === 'mainHand' || slot === 'offHand' ? 'damageBonus' : 'cost');
    setSortDir(slot === 'armor' || slot === 'accessory' ? 'asc' : 'desc');
    setOffHandMode('shield');
  }, [slot]);

  const dice = useMemo(() => diceFromStats(stats), [stats]);
  const profs = stats?.profs || {};
  const currentValue = character?.equipment?.[slot] || '';
  // 先攻變體（公測 p.34）：防具表的側寫、先攻欄與說明文字都跟著這個旗標走。
  const initiativeVariant = isInitiativeVariant(character);

  // 魔晶石（科技奇幻手冊 p.133）：官方武器表與盾牌整份**不存在**，
  // 「Any other equipment simply cannot exist」——所以不是「比較不推薦」，是根本不能選。
  // 防具與飾品仍然可用（同句的白名單裡有 armor 與 accessories），所以只有這兩張表要空掉。
  const technoRestrictsEquipment = modeRestrictsEquipment(
    resolveCreationRules(character?.creationRules).technospheres
  );

  const offIsShield = useMemo(
    () => rulesData.equipment.shields.some((s) => s.name === character?.equipment?.offHand),
    [character]
  );
  const mainIsShield = useMemo(
    () => rulesData.equipment.shields.some((s) => s.name === character?.equipment?.mainHand),
    [character]
  );
  const dualShield = useMemo(
    () => getDualShieldState(character, {
      mainIsShield,
      offIsShield,
      // 魔晶石制下【雙重盾牌】失效（p.133）→ 主手清單不該再出現盾牌。
      technosphereMode: resolveCreationRules(character?.creationRules).technospheres
    }),
    [character, mainIsShield, offIsShield]
  );

  // ── 武器列（主手：全部武器，學會雙重盾牌時再加上盾牌；副手：僅單手武器）
  const weaponRows = useMemo(() => {
    // 魔晶石制：官方武器表不存在，主手／副手只剩「定制武器」那一條路。
    if (technoRestrictsEquipment) return [];
    const source = slot === 'mainHand'
      ? rulesData.equipment.weapons
      : rulesData.equipment.weapons.filter((w) => Number(w.hands) === 1);

    const rows = source.map((weapon) => ({
      weapon,
      eval: evaluateWeapon(weapon, dice),
      equippable: slot === 'offHand' && isTwoHanded(weapon)
        ? { ok: false, reason: '雙手武器無法裝備於副手' }
        : checkEquippable(weapon, slot, profs),
      isShieldRow: false,
      remainingBudget
    }));

    // 雙重盾牌：主手可裝備盾牌，且兩手皆盾時攻擊改用「雙盾」公式
    if (slot === 'mainHand' && dualShield.learned) {
      rulesData.equipment.shields.forEach((shield) => {
        rows.push({
          weapon: {
            ...shield,
            category: '盾牌',
            hands: 1,
            range: '近戰',
            attr: dualShield.weapon.attr,
            damage: dualShield.weapon.damage
          },
          eval: evaluateWeapon(dualShield.weapon, dice),
          equippable: checkEquippable(shield, 'mainHand', profs, { isShield: true }),
          isShieldRow: true,
          remainingBudget
        });
      });
    }
    return rows;
  }, [slot, profs, dice, remainingBudget, dualShield, technoRestrictsEquipment]);

  const filteredWeaponRows = useMemo(() => {
    const filtered = filterWeapons(weaponRows, {
      category,
      range,
      hands,
      showAll,
      affordableOnly,
      query
    });
    return sortWeapons(filtered, sortKey, sortDir);
  }, [weaponRows, category, range, hands, showAll, affordableOnly, query, sortKey, sortDir]);

  const hiddenCount = useMemo(
    () => weaponRows.filter((r) => !r.equippable.ok).length,
    [weaponRows]
  );

  // ── 盾牌列：直接顯示「穿上後合計物防／魔防」，而非盾牌自己的加值
  const currentArmor = useMemo(
    () => rulesData.equipment.armors.find((a) => a.name === character?.equipment?.armor) || null,
    [character]
  );
  const armorOutcome = useMemo(
    () => computeArmorOutcome(currentArmor, dice, { initiativeVariant }),
    [currentArmor, dice, initiativeVariant]
  );

  const shieldRows = useMemo(() => {
    // 魔晶石制：盾牌同樣不存在（原書另外還要求忽略守護者的【雙重盾牌】）。
    if (technoRestrictsEquipment) return [];
    return rulesData.equipment.shields.map((shield) => {
      const equipped = checkEquippable(shield, 'offHand', profs, { isShield: true });
      const outcome = computeShieldOutcome(shield);
      return {
        shield,
        outcome,
        equippable: equipped,
        totalDef: armorOutcome.def + outcome.defBonus,
        totalMdef: armorOutcome.mdef + outcome.mdefBonus,
        remainingBudget
      };
    });
  }, [profs, armorOutcome, remainingBudget, technoRestrictsEquipment]);

  const filteredShieldRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shieldRows
      .filter((row) => {
        if (!showAll && !row.equippable.ok) return false;
        if (affordableOnly && row.shield.cost > row.remainingBudget) return false;
        if (q && !`${row.shield.name} ${row.shield.desc || ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'cost') return (a.shield.cost - b.shield.cost) * dir;
        if (sortKey === 'name') return a.shield.name.localeCompare(b.shield.name, 'zh-Hant') * dir;
        return (b.totalDef - a.totalDef) * dir;
      });
  }, [shieldRows, query, showAll, affordableOnly, sortKey, sortDir]);

  // ── 防具列
  const armorRows = useMemo(() => rulesData.equipment.armors.map((armor) => {
    const outcome = computeArmorOutcome(armor, dice, { initiativeVariant });
    return {
      armor,
      outcome,
      desc: resolveArmorDesc(armor, initiativeVariant),
      equippable: checkEquippable(armor, 'armor', profs),
      deltaDef: outcome.def - armorOutcome.def,
      deltaMdef: outcome.mdef - armorOutcome.mdef,
      remainingBudget
    };
  }), [dice, profs, armorOutcome, remainingBudget, initiativeVariant]);

  const filteredArmorRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return armorRows
      .filter((row) => {
        if (!showAll && !row.equippable.ok) return false;
        if (affordableOnly && row.armor.cost > row.remainingBudget) return false;
        if (q && !`${row.armor.name} ${row.armor.desc || ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'name') return a.armor.name.localeCompare(b.armor.name, 'zh-Hant') * dir;
        if (sortKey === 'damageBonus') return (b.outcome.def - a.outcome.def) * dir;
        return (a.armor.cost - b.armor.cost) * dir;
      });
  }, [armorRows, query, showAll, affordableOnly, sortKey, sortDir]);

  const accessoryRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rulesData.equipment.accessories
      .filter((acc) => !q || `${acc.name} ${acc.desc || ''}`.toLowerCase().includes(q));
  }, [query]);

  const commit = (name) => {
    if (onSelect) onSelect(name);
    if (onClose) onClose();
  };

  const chip = (active, label, onClick, icon = null) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className="text-[11px] px-2 py-1 rounded-lg border font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
      style={
        active
          ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#ffffff' }
          : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
      }
    >
      {icon ? <GameIcon name={icon} size={12} /> : null}
      <span>{label}</span>
    </button>
  );

  const cellText = 'px-2 py-1.5 align-middle';
  const headText = 'px-2 py-1.5 text-[10px] font-bold tracking-wide text-left whitespace-nowrap';

  const renderWeaponTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs min-w-[680px]">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: theme.panelBg }}>
          <tr style={{ color: theme.textMuted }}>
            <th className={headText}>名稱</th>
            <th className={headText}>類別</th>
            <th className={headText}>價格</th>
            <th className={headText}>命中檢定</th>
            <th className={headText}>傷害</th>
            <th className={headText}>持握</th>
          </tr>
        </thead>
        <tbody>
          {filteredWeaponRows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-6 text-center text-[#7c6a58]">
                {technoRestrictsEquipment
                  ? '魔晶石制沒有官方武器表——主手與副手一律到「定制武器」分頁鍛造（科技奇幻手冊 p.133）。'
                  : '沒有符合條件的武器，請放寬篩選。'}
              </td>
            </tr>
          )}
          {filteredWeaponRows.map((row) => {
            const w = row.weapon;
            const isCurrent = currentValue === w.name;
            const overBudget = w.cost > row.remainingBudget;
            const blocked = !row.equippable.ok;

            return (
              <tr
                key={w.name}
                onClick={() => commit(w.name)}
                title={blocked ? row.equippable.reason : `選擇 ${w.name}`}
                className="cursor-pointer border-t transition-colors"
                style={{
                  borderColor: theme.border,
                  backgroundColor: isCurrent ? theme.subpanelBg : theme.cardBg,
                  opacity: blocked ? 0.55 : 1
                }}
              >
                <td className={cellText}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <GameIcon
                      name={getEquipmentIcon(w.name, CATEGORY_ICON[w.category] || 'cat_sword')}
                      size={15}
                      style={{ color: theme.accent }}
                    />
                    <span className="font-bold" style={{ color: theme.textDark }}>{w.name}</span>
                    {row.isShieldRow ? <JRPGBadge variant="cyan" size="xs">盾牌</JRPGBadge> : null}
                    {w.martial ? <JRPGBadge variant="rose" size="xs">職業</JRPGBadge> : null}
                    {isCurrent ? <JRPGBadge variant={theme.badgeVariant} size="xs">已裝備</JRPGBadge> : null}
                  </div>
                  {blocked ? (
                    <div className="flex items-center gap-1 text-[10px] text-rose-700 font-bold mt-0.5">
                      <GiHazardSign size={11} />
                      {row.equippable.reason}
                    </div>
                  ) : null}
                  {row.isShieldRow ? (
                    <div className="text-[10px] text-[#7b4720] mt-0.5">
                      兩手皆盾時合併為「雙盾」：命中【MIG + MIG】、傷害【HR + 5】物理
                      {dualShield.defenseMasterySL > 0 ? `，額外 +${dualShield.defenseMasterySL}（防守掌握 SL）` : ''}
                    </div>
                  ) : null}
                  {w.note ? (
                    <div className="text-[10px] text-[#7c6a58] mt-0.5">{w.note}</div>
                  ) : null}
                </td>
                <td className={cellText}>
                  <span className="text-[11px] text-[#5b4a3a]">{w.category}</span>
                </td>
                <td className={cellText}>
                  <span className={`font-mono font-bold ${overBudget ? 'text-rose-700' : ''}`}>
                    {w.cost}z
                  </span>
                  {overBudget ? (
                    <div className="text-[10px] text-rose-600">超出預算</div>
                  ) : null}
                </td>
                <td className={cellText}>
                  <div className="font-mono text-[11px]">{row.eval.accuracyLabel}</div>
                  <div className="text-[10px] text-[#7c6a58]">{row.eval.accuracyFormula}</div>
                </td>
                <td className={cellText}>
                  <div className="font-mono text-[11px]">{row.eval.damageFormula}</div>
                  <div className="text-[10px] text-[#7c6a58]">{row.eval.damageType}</div>
                </td>
                <td className={cellText}>
                  <div className="text-[11px] whitespace-nowrap">
                    {row.isShieldRow ? '盾牌' : (w.hands === 2 ? '雙手' : '單手')} · {w.range}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderShieldTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs min-w-[640px]">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: theme.panelBg }}>
          <tr style={{ color: theme.textMuted }}>
            <th className={headText}>名稱</th>
            <th className={headText}>價格</th>
            <th className={headText}>合計物防</th>
            <th className={headText}>合計魔防</th>
            <th className={headText}>先攻</th>
            <th className={headText}>效果</th>
          </tr>
        </thead>
        <tbody>
          {filteredShieldRows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-6 text-center text-[#7c6a58]">
                {technoRestrictsEquipment
                  ? '魔晶石制沒有盾牌——原書要求直接忽略守護者的【雙重盾牌】，副手改裝定制武器（p.133）。'
                  : '沒有符合條件的盾牌，請放寬篩選。'}
              </td>
            </tr>
          )}
          {filteredShieldRows.map((row) => {
            const isCurrent = currentValue === row.shield.name;
            const overBudget = row.shield.cost > row.remainingBudget;
            const blocked = !row.equippable.ok;
            return (
              <tr
                key={row.shield.name}
                onClick={() => commit(row.shield.name)}
                title={blocked ? row.equippable.reason : `選擇 ${row.shield.name}`}
                className="cursor-pointer border-t transition-colors"
                style={{
                  borderColor: theme.border,
                  backgroundColor: isCurrent ? theme.subpanelBg : theme.cardBg,
                  opacity: blocked ? 0.55 : 1
                }}
              >
                <td className={cellText}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <GameIcon
                      name={getEquipmentIcon(row.shield.name, 'slot_offhand')}
                      size={15}
                      style={{ color: theme.accent }}
                    />
                    <span className="font-bold" style={{ color: theme.textDark }}>{row.shield.name}</span>
                    {row.shield.martial ? <JRPGBadge variant="rose" size="xs">職業</JRPGBadge> : null}
                    {isCurrent ? <JRPGBadge variant={theme.badgeVariant} size="xs">已裝備</JRPGBadge> : null}
                  </div>
                  {blocked ? (
                    <div className="flex items-center gap-1 text-[10px] text-rose-700 font-bold mt-0.5">
                      <GiHazardSign size={11} />
                      {row.equippable.reason}
                    </div>
                  ) : null}
                </td>
                <td className={cellText}>
                  <span className={`font-mono font-bold ${overBudget ? 'text-rose-700' : ''}`}>{row.shield.cost}z</span>
                </td>
                <td className={cellText}>
                  <span className="font-mono font-black text-sm" style={{ color: theme.accent }}>{row.totalDef}</span>
                  <span className="text-[10px] text-[#7c6a58] ml-1">（盾 +{row.outcome.defBonus}）</span>
                </td>
                <td className={cellText}>
                  <span className="font-mono font-black text-sm" style={{ color: theme.accent }}>{row.totalMdef}</span>
                  <span className="text-[10px] text-[#7c6a58] ml-1">（盾 +{row.outcome.mdefBonus}）</span>
                </td>
                <td className={cellText}>
                  <span className="font-mono text-[11px]">{row.outcome.initMod === 0 ? '±0' : row.outcome.initMod}</span>
                </td>
                <td className={cellText}>
                  <span className="text-[11px] text-[#5b4a3a]">{row.shield.desc || '—'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderArmorTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs min-w-[680px]">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: theme.panelBg }}>
          <tr style={{ color: theme.textMuted }}>
            <th className={headText}>名稱</th>
            <th className={headText}>價格</th>
            <th className={headText}>物防</th>
            <th className={headText}>魔防</th>
            <th className={headText}>先攻</th>
            <th className={headText}>說明</th>
          </tr>
        </thead>
        <tbody>
          {filteredArmorRows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-6 text-center text-[#7c6a58]">
                沒有符合條件的防具，請放寬篩選。
              </td>
            </tr>
          )}
          {filteredArmorRows.map((row) => {
            const isCurrent = currentValue === row.armor.name;
            const overBudget = row.armor.cost > row.remainingBudget;
            const blocked = !row.equippable.ok;
            return (
              <tr
                key={row.armor.name}
                onClick={() => commit(row.armor.name)}
                title={blocked ? row.equippable.reason : `選擇 ${row.armor.name}`}
                className="cursor-pointer border-t transition-colors"
                style={{
                  borderColor: theme.border,
                  backgroundColor: isCurrent ? theme.subpanelBg : theme.cardBg,
                  opacity: blocked ? 0.55 : 1
                }}
              >
                <td className={cellText}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <GameIcon
                      name={getEquipmentIcon(row.armor.name, 'slot_armor')}
                      size={15}
                      style={{ color: theme.accent }}
                    />
                    <span className="font-bold" style={{ color: theme.textDark }}>{row.armor.name}</span>
                    {row.armor.martial ? <JRPGBadge variant="rose" size="xs">職業</JRPGBadge> : null}
                    {isCurrent ? <JRPGBadge variant={theme.badgeVariant} size="xs">已裝備</JRPGBadge> : null}
                  </div>
                  {blocked ? (
                    <div className="flex items-center gap-1 text-[10px] text-rose-700 font-bold mt-0.5">
                      <GiHazardSign size={11} />
                      {row.equippable.reason}
                    </div>
                  ) : null}
                </td>
                <td className={cellText}>
                  <span className={`font-mono font-bold ${overBudget ? 'text-rose-700' : ''}`}>{row.armor.cost}z</span>
                </td>
                <td className={cellText}>
                  <span className="font-mono font-black text-sm" style={{ color: theme.accent }}>{row.outcome.def}</span>
                  {row.deltaDef !== 0 ? (
                    <span className={`text-[10px] ml-1 font-mono ${row.deltaDef > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {row.deltaDef > 0 ? `+${row.deltaDef}` : row.deltaDef}
                    </span>
                  ) : null}
                </td>
                <td className={cellText}>
                  <span className="font-mono font-black text-sm" style={{ color: theme.accent }}>{row.outcome.mdef}</span>
                  {row.deltaMdef !== 0 ? (
                    <span className={`text-[10px] ml-1 font-mono ${row.deltaMdef > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {row.deltaMdef > 0 ? `+${row.deltaMdef}` : row.deltaMdef}
                    </span>
                  ) : null}
                </td>
                <td className={cellText}>
                  <span className="font-mono text-[11px]">
                    {initiativeVariant ? '不計' : (row.outcome.initMod === 0 ? '±0' : row.outcome.initMod)}
                  </span>
                </td>
                <td className={cellText}>
                  <span className="text-[11px] text-[#5b4a3a]">{row.desc || '—'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderAccessoryList = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {accessoryRows.length === 0 && (
        <p className="text-xs text-[#7c6a58] py-4">沒有符合條件的飾品。</p>
      )}
      {accessoryRows.map((acc) => {
        const isCurrent = currentValue === acc.name;
        return (
          <button
            key={acc.name}
            type="button"
            onClick={() => commit(acc.name)}
            className="text-left p-2.5 rounded-xl border transition-all cursor-pointer active:scale-98"
            style={{
              backgroundColor: isCurrent ? theme.subpanelBg : theme.cardBg,
              borderColor: isCurrent ? theme.accent : theme.border
            }}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <GameIcon name="slot_accessory" size={14} style={{ color: theme.accent }} />
              <span className="font-bold text-xs" style={{ color: theme.textDark }}>{acc.name}</span>
              {isCurrent ? <JRPGBadge variant={theme.badgeVariant} size="xs">已裝備</JRPGBadge> : null}
            </div>
            <p className="text-[11px] text-[#5b4a3a] mt-1 leading-relaxed">{acc.desc}</p>
          </button>
        );
      })}
    </div>
  );

  // ─────────────────────────────────────────────── 篩選列
  const showWeaponFilters = slot === 'mainHand' || (slot === 'offHand' && offHandMode === 'weapon');
  const showShieldFilters = slot === 'offHand' && offHandMode === 'shield';

  const sortOptions = (slot === 'armor' || slot === 'accessory')
    ? SORT_OPTIONS.filter((o) => o.key === 'cost' || o.key === 'name' || o.key === 'damageBonus')
    : SORT_OPTIONS;

  return (
    <div className="flex flex-col h-[82vh] md:h-[76vh] max-h-[760px] overflow-hidden -m-1">
      {/* 副手：盾牌 / 單手武器 兩種完全不同的比較基準，先分開 */}
      {slot === 'offHand' && (
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setOffHandMode('shield')}
            className="text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            style={offHandMode === 'shield'
              ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#ffffff' }
              : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
          >
            <GiRoundShield size={14} />
            盾牌
          </button>
          <button
            type="button"
            onClick={() => setOffHandMode('weapon')}
            className="text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            style={offHandMode === 'weapon'
              ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#ffffff' }
              : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
          >
            <GiCrossedSwords size={14} />
            單手武器
          </button>
        </div>
      )}

      {/* 雙重盾牌狀態提示（只有學會該技能時才出現） */}
      {slot === 'mainHand' && dualShield.learned && (
        <div
          className="px-3 py-2 rounded-xl border mb-2 shrink-0 text-[11px] leading-relaxed"
          style={{ backgroundColor: theme.subpanelBg, borderColor: theme.accent, color: theme.textDark }}
        >
          <span className="font-bold">守護者【雙重盾牌】已習得</span>
          ：主手可裝備盾牌。兩手皆盾時合併視為格鬥類別雙手近戰武器「雙盾」——
          命中【MIG + MIG】、傷害【HR + 5】物理
          {dualShield.defenseMasterySL > 0 ? `，額外造成 ${dualShield.defenseMasterySL} 點傷害（防守掌握 SL ${dualShield.defenseMasterySL}）` : ''}。
        </div>
      )}

      {/* 篩選與搜尋 */}
      <div
        className="px-3 py-2 rounded-xl border space-y-2 mb-2.5 shrink-0"
        style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <GiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7c6a58]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`搜尋${slotDef.label}名稱或說明...`}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
            />
          </div>

          <label className="text-[11px] flex items-center gap-1.5 cursor-pointer font-bold" style={{ color: theme.textDark }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            顯示目前無法裝備的
            {hiddenCount > 0 ? <span className="font-mono text-[10px] text-[#7c6a58]">（隱藏 {hiddenCount} 項）</span> : null}
          </label>

          {slot !== 'accessory' && (
            <label className="text-[11px] flex items-center gap-1.5 cursor-pointer font-bold" style={{ color: theme.textDark }}>
              <input type="checkbox" checked={affordableOnly} onChange={(e) => setAffordableOnly(e.target.checked)} />
              只看買得起的
            </label>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] font-bold" style={{ color: theme.textMuted }}>排序</span>
            <select
              value={sortKey}
              onChange={(e) => {
                const next = sortOptions.find((o) => o.key === e.target.value);
                setSortKey(e.target.value);
                setSortDir(next?.direction || 'desc');
              }}
              className="text-[11px] px-2 py-1 rounded-lg border font-bold outline-none cursor-pointer"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
            >
              {sortOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              className="text-[11px] px-2 py-1 rounded-lg border font-bold cursor-pointer"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
              title={sortDir === 'asc' ? '目前遞增，點擊改為遞減' : '目前遞減，點擊改為遞增'}
            >
              {sortDir === 'asc' ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {showWeaponFilters && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold w-8" style={{ color: theme.textMuted }}>類別</span>
              {chip(category === FILTER_ALL, '全部', () => setCategory(FILTER_ALL))}
              {WEAPON_CATEGORIES.map((c) => chip(category === c.key, c.key, () => setCategory(c.key), c.icon))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold w-8" style={{ color: theme.textMuted }}>距離</span>
              {['全部', '近戰', '遠程'].map((r) => chip(range === r, r, () => setRange(r)))}
              <span className="text-[11px] font-bold ml-2" style={{ color: theme.textMuted }}>持握</span>
              {['全部', '1', '2'].map((h) => chip(hands === h, h === '1' ? '單手' : h === '2' ? '雙手' : '全部', () => setHands(h)))}
            </div>
          </div>
        )}

        {showShieldFilters && (
          <p className="text-t12" style={{ color: theme.textMuted }}>
            盾牌加值與目前防具疊加；表上直接顯示穿好之後的合計物防／魔防。
          </p>
        )}

        {slot === 'accessory' && (
          <p className="text-t12" style={{ color: theme.textMuted }}>
            飾品在原書中一律屬稀有物品，不列入起始 500z 裝備預算。
          </p>
        )}
      </div>

      {/* 比較表 */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
        {showWeaponFilters && renderWeaponTable()}
        {showShieldFilters && renderShieldTable()}
        {slot === 'armor' && renderArmorTable()}
        {slot === 'accessory' && renderAccessoryList()}
      </div>

      {/* 底部操作 */}
      <div
        className="pt-2.5 mt-2 border-t flex items-center justify-between gap-2 shrink-0 flex-wrap"
        style={{ borderColor: theme.border }}
      >
        <div className="text-[11px] flex items-center gap-1.5" style={{ color: theme.textMuted }}>
          {showWeaponFilters ? (
            <>
              <GiSparkles size={13} />
              命中檢定與傷害式已換成目前的四維骰（HR 為命中檢定兩顆骰中較高者）。
            </>
          ) : (
            <>
              <GiCoins size={13} />
              剩餘預算 {remainingBudget}z
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <JRPGButton
            variant={theme.outlineButtonVariant || 'outline'}
            size="sm"
            icon={GiCheckMark}
            onClick={() => commit(slotDef.emptyValue)}
          >
            {slotDef.emptyLabel}
          </JRPGButton>
          <JRPGButton variant={theme.buttonVariant || 'primary'} size="sm" onClick={onClose}>
            關閉
          </JRPGButton>
        </div>
      </div>
    </div>
  );
}

/** 彈窗外殼：只負責標題與轉發 props；內容本體為 `EquipmentPickerBody`（可獨立 SSR 測試）。 */
export default function EquipmentPickerModal({
  isOpen,
  onClose,
  slot = 'mainHand',
  theme,
  character,
  stats,
  remainingBudget = DEFAULT_CREATION_RULES.startingZenit,
  onSelect
}) {
  const slotDef = EQUIPMENT_SLOTS[slot] || EQUIPMENT_SLOTS.mainHand;

  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title={`選擇${slotDef.label}`} maxWidth="max-w-5xl" theme={theme}>
      <EquipmentPickerBody
        slot={slot}
        theme={theme}
        character={character}
        stats={stats}
        remainingBudget={remainingBudget}
        onSelect={onSelect}
        onClose={onClose}
      />
    </JRPGModal>
  );
}
