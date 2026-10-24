import React, { useState } from 'react';
import { GiMagnifyingGlass, GiLaurelCrown } from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import JRPGModal from '../../../components/ui/JRPGModal';
import { SOURCEBOOKS } from '../data/sourcebookConfig';
import { PLAYTEST_SOURCEBOOK_KEY } from '../data/creationRules';
import { describeCustomWeapon } from '../data/customWeapons';
import { ALL_STARTER_PRESETS } from '../data/starterPresets';
import { ALL_BOOKS, buildPresetSections } from '../utils/presetFilters';

/**
 * 官方經典職業搭配 —— 面板內容。
 *
 * 與 `JRPGModal` 分離的理由：`JRPGModal` 只在掛載後（`useEffect`）才渲染內容，
 * 因此面板必須能獨立渲染，才能在 Node 下做 SSR 煙霧測試。
 *
 * @param {object[]} presets 全部經典搭配（預設為官方五本手冊共 81 組）
 * @param {object} theme 角色卡主題
 * @param {(preset: object) => void} onApply 套用回呼
 */
/** 各書的官方頁碼範圍（書上的事實，不隨資料變動）。組數則由 presets 現算，避免寫死後對不上。 */
const SOURCEBOOK_PAGES = {
  core: 'p.172-175',
  highFantasy: 'p.132-135',
  naturalFantasy: 'p.134-137',
  technoFantasy: 'p.146-149',
  bonus: 'p.11、p.24-25'
};

export function StarterPresetsPanel({
  presets = ALL_STARTER_PRESETS,
  theme,
  onApply,
  /** 一開始就展開的搭配 id。預設全部收合；留這個入口是為了「從別處直接打開某一組」，
   *  以及讓測試能 SSR 到展開後的內容（SSR 沒辦法「點開」）。 */
  initialExpandedIds = []
}) {
  const [search, setSearch] = useState('');
  const [sourcebook, setSourcebook] = useState(ALL_BOOKS);
  /**
   * 已展開的搭配 id。
   *
   * 使用者：「現在全部配置太多了，讓用戶要選到有眼緣的搭配不容易。
   * 要求讓它們更容易掃過這些搭配的名字」——所以**預設全部收合**，只顯示名字與來源。
   * 用 Set 而不是單一 id：可以同時展開好幾組來比較（那是選搭配時真正會做的事）。
   */
  const [expanded, setExpanded] = useState(() => new Set(initialExpandedIds));
  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections = buildPresetSections(presets, { search, sourcebook });
  const count = sections.reduce((sum, s) => sum + s.items.length, 0);

  const bookFilters = [
    { id: ALL_BOOKS, shortName: '全部' },
    // 公測修訂不是手冊、也沒有起始範本——列出來只會是「0 組」的噪音（§BE）
    ...Object.keys(SOURCEBOOKS)
      .filter((key) => key !== PLAYTEST_SOURCEBOOK_KEY)
      .map((key) => ({ id: key, shortName: SOURCEBOOKS[key].shortName }))
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#6b5a4b] leading-relaxed -mt-1">
        嚴格遵循官方五本手冊實裝，共 <strong>{presets.length}</strong> 組經典職業搭配：
        {/* 只列「真的有搭配」的手冊——沒有的會變成「公測修訂 0 組（）」這種噪音。 */}
        {Object.keys(SOURCEBOOKS)
          .map((key) => ({
            key,
            shortName: SOURCEBOOKS[key].shortName,
            count: presets.filter((p) => (p.sourcebook || 'core') === key).length
          }))
          .filter((b) => b.count > 0)
          .map((b, i) => (
            <React.Fragment key={b.key}>
              {i > 0 && '、'}
              {b.shortName} <strong>{b.count}</strong> 組（{SOURCEBOOK_PAGES[b.key]}）
            </React.Fragment>
          ))}
        。含特技分配、起始裝備與資金。
      </p>

      {/* 手冊篩選 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {bookFilters.map((sb) => {
          const isActive = sourcebook === sb.id;
          return (
            <button
              key={sb.id}
              type="button"
              onClick={() => setSourcebook(sb.id)}
              className="text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              style={
                isActive
                  ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#fffdf9' }
                  : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
              }
            >
              {sb.shortName}
            </button>
          );
        })}
        <span className="text-[10px] text-[#6b5a4b] font-mono ml-auto">{count} 組</span>
      </div>

      {/* 關鍵字搜尋 */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋經典搭配名稱、職業或特技（例如：黑騎士、舞者、植物學家、混合變形）..."
 className="w-full px-3.5 py-2 pl-9 text-xs rounded-xl bg-white border text-[#2c221e] placeholder-[#7c6a58] focus:outline-none focus:ring-2 "
          style={{ borderColor: theme.border }}
        />
        <GiMagnifyingGlass className="w-4 h-4 text-[#6b5a4b] absolute left-3 top-2.5" />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-2 text-xs text-[#6b5a4b] hover:text-[#3c2415] cursor-pointer"
          >
            清除
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
        {sections.map((section) => (
          <React.Fragment key={section.gid || `solo_${section.items[0].id}`}>
            {section.title && (
              <div
                className="md:col-span-2 flex items-center gap-2 pt-1 pb-0.5 border-b"
                style={{ borderColor: theme.border }}
              >
                <GiLaurelCrown className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
                <span className="font-serif font-black text-sm" style={{ color: theme.textDark }}>
                  {section.title}
                </span>
                <span className="text-[10px] text-[#6b5a4b] font-mono">{section.items.length} 名成員</span>
              </div>
            )}
            {section.items.map((preset) => {
              const isOpen = expanded.has(preset.id);
              return (
              <div
                key={preset.id}
                className="rounded-xl border transition-all shadow-xs hover:shadow-md overflow-hidden"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
              >
                {/* 標頭：**永遠可見**，只放名字與來源。
                    使用者：「現在全部配置太多了，讓用戶要選到有眼緣的搭配不容易。
                    要求讓它們更容易掃過這些搭配的名字」——所以預設只留最少的資訊，
                    配置全部收進展開區。 */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(preset.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-2 p-3 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="font-serif font-black text-base truncate"
                      style={{ color: theme.textDark }}
                    >
                      {preset.title}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-2xs shrink-0"
                      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.accent }}
                    >
                      {SOURCEBOOKS[preset.sourcebook || 'core'].shortName}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono" style={{ color: theme.textMuted }}>
                      {preset.zenit}z
                    </span>
                    {/* 折疊指示：規則一允許的封閉詞彙（△ ▽ ▼ ◆ 那一組） */}
                    <span className="text-xs" style={{ color: theme.textMuted }}>
                      {isOpen ? '▼' : '▽'}
                    </span>
                  </span>
                </button>

                {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {/* 職業徽章與四維陣列 */}
                  <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                    {preset.classes.map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded border font-bold flex items-center gap-1"
                        style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textDark }}
                      >
                        <GameIcon name={c.className} size={12} style={{ color: theme.accent }} />
                        {c.className} Lv{c.level}
                      </span>
                    ))}
                    <span className="text-[#6b5a4b] text-[10px]">
                      [DEX d{preset.attributes.dex}, INS d{preset.attributes.ins}, MIG d{preset.attributes.mig}, WLP d{preset.attributes.wlp}]
                    </span>
                  </div>

                  {/* 習得技能 */}
                  <div
 className="text-[11px] text-[#3c2415] bg-white/90 rounded-lg p-2.5 border space-y-1 "
                    style={{ borderColor: theme.border }}
                  >
                    <div className="font-bold text-[10px] uppercase tracking-wider" style={{ color: theme.accent }}>
                      習得技能
                    </div>
                    {preset.classes.map((c, i) => (
                      <div key={i} className="text-[11px] leading-tight">
                        <span className="font-bold" style={{ color: theme.textDark }}>{c.className}:</span>{' '}
                        {c.skills.map((s) => `${s.name}${s.sl > 1 ? ` SL${s.sl}` : ''}`).join('、')}
                      </div>
                    ))}
                  </div>

                  {/* 起始裝備 */}
                  <div
 className="text-[11px] text-[#6b5a4b] bg-white/70 rounded-lg px-2.5 py-1.5 border flex items-center gap-1.5 "
                    style={{ borderColor: theme.border }}
                  >
                    <span className="font-bold text-[#3c2415]">裝備:</span>{' '}
                    {[
                      preset.equipment.mainHand,
                      preset.equipment.offHand && preset.equipment.offHand !== '無盾牌' ? preset.equipment.offHand : null,
                      preset.equipment.armor
                    ].filter(Boolean).join('、')}
                  </div>

                  {/* 定制武器／魔晶石／金手指註記（僅該配置有此欄位時顯示）
                      有結構化規格時由規格推導（單一來源）；只有出處的（如科技奇幻樣本）才印原文。 */}
                  {(preset.customWeapons?.length > 0 || preset.customWeapon) && (
                    <div
 className="text-[11px] text-[#6b5a4b] bg-white/70 rounded-lg px-2.5 py-1.5 border leading-relaxed "
                      style={{ borderColor: theme.border }}
                    >
                      <span className="font-bold text-[#3c2415]">定制武器:</span>{' '}
                      {preset.customWeapons?.length > 0
                        ? preset.customWeapons.map((w) => `${w.name}（${describeCustomWeapon(w)}）`).join(' ／ ')
                        : preset.customWeapon}
                    </div>
                  )}
                  {preset.mnemosphere && (
                    <div
 className="text-[11px] text-[#6b5a4b] bg-white/70 rounded-lg px-2.5 py-1.5 border leading-relaxed "
                      style={{ borderColor: theme.border }}
                    >
                      {/* 結構化欄位（§CF）：`{ className, level, label }`。
                          以前這裡直接印字串，現在要自己組回「魔晶石名（視同某職業 N 級）」。 */}
                      <span className="font-bold text-[#3c2415]">魔晶石:</span>{' '}
                      {preset.mnemosphere.label}（視同{preset.mnemosphere.className} {preset.mnemosphere.level} 級）
                    </div>
                  )}
                  {preset.quirk && (
                    <div
 className="text-[11px] text-[#6b5a4b] bg-white/70 rounded-lg px-2.5 py-1.5 border leading-relaxed "
                      style={{ borderColor: theme.border }}
                    >
                      <span className="font-bold text-[#3c2415]">金手指:</span> {preset.quirk}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onApply(preset)}
                    className="w-full py-2 rounded-lg text-white font-bold text-xs shadow-xs transition-all hover:opacity-90 active:scale-98 cursor-pointer"
                    style={{ backgroundColor: theme.accent }}
                  >
                    套用此經典配置
                  </button>
                </div>
                )}
              </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * 官方經典職業搭配 Modal。
 */
export default function StarterPresetsModal({ isOpen, onClose, theme, onApply }) {
  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title="官方經典職業搭配"
      maxWidth="max-w-4xl"
      theme={theme}
    >
      <StarterPresetsPanel theme={theme} onApply={onApply} />
    </JRPGModal>
  );
}
