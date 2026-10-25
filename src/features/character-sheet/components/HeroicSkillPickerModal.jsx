/**
 * 英雄技能選擇器（HeroicSkillPickerModal）
 *
 * 使用者要求：「選擇開局英雄界面做得太簡陋了，應該要像裝備那樣獨立成表的，
 * 然後列出每一條的條件和規則，並提供過濾功能，預設只會出現跟開卡職業有關的英雄技能，
 * 可以勾選或過濾其他職業。」
 *
 * 所以這裡是**表格式**的選擇器，每一列都有：名稱／出處／條件／效果全文／能不能選。
 * 舊版是編輯器第 5 步裡的一個 `<select>` ＋「添加」鈕——條件與效果都看不到，
 * 而且 158 筆擠在一個下拉裡沒辦法過濾。
 *
 * ## 為什麼拆成 Body ＋ Modal
 *
 * `JRPGModal` 用 portal ＋ `useEffect` 掛載（SSR 時輸出空字串），所以測試截不到內容。
 * 表格本體抽成 `HeroicSkillPickerBody` 之後就能直接 SSR 斷言——
 * 與 `CharacterSheetExportBody`（§AC）同一個理由。**彈窗只負責包殼。**
 *
 * ## 預設過濾
 *
 * 預設只列「與這張卡的職業有關」的技能（`heroicSkillsForClass` 的判定，
 * 與 `checkHeroicSkillRequirement` 共用同一條規則）。取消勾選就看全部。
 * 另有搜尋框（名稱／條件／效果）與出處篩選。
 *
 * ## 「不能選」的原因要在選之前看見（§U 的原則）
 *
 * 每一列都會跑一次 `checkHeroicSkillRequirement`（開局模式或精通模式，取規則決定），
 * 不合格的列**照樣列出**、按鈕停用、並把原因寫在旁邊——不是直接藏起來。
 * 藏起來的話玩家只會覺得「怎麼找不到」。
 */
import React, { useMemo, useState } from 'react';
import { GiLaurelCrown, GiMagnifyingGlass, GiCheckMark } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import {
  HEROIC_SKILLS,
  HEROIC_SKILL_SOURCE_LABELS,
  checkHeroicSkillRequirement,
  heroicSkillMaxAcquisitions,
  heroicSkillsForClass
} from '../utils/characterEngine';
import { resolveHeroicSkillEffect } from '../data/theriomorphosisVariant';

/** 表格本體（可獨立 SSR 測試） */
export function HeroicSkillPickerBody({
  character,
  rules,
  stats,
  onPick,
  theme = {},
  slotBlocked = false,
  onClose = null
}) {
  const [query, setQuery] = useState('');
  const [onlyMyClasses, setOnlyMyClasses] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');

  const myClasses = (character?.classes || []).map((c) => c.className);
  const masteredClasses = stats?.masteredClasses || [];
  const level = character?.level;
  const atCreation = Boolean(rules?.startingHeroicSkill);

  // 這一張卡「自己的職業會解鎖哪些」——用來當預設過濾
  const mine = useMemo(
    () => new Set(myClasses.flatMap((name) => heroicSkillsForClass(name).map((h) => h.name))),
    [myClasses.join('|')] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HEROIC_SKILLS
      .filter((h) => (onlyMyClasses ? mine.has(h.name) : true))
      .filter((h) => (sourceFilter === 'all' ? true : h.source === sourceFilter))
      .filter((h) => {
        if (!q) return true;
        return h.name.toLowerCase().includes(q)
          || h.requirement.toLowerCase().includes(q)
          || h.effect.toLowerCase().includes(q);
      })
      .map((h) => {
        const owned = (character?.heroicSkills || [])
          .filter((x) => (x?.name || x) === h.name).length;
        const max = heroicSkillMaxAcquisitions(h);
        const verdict = checkHeroicSkillRequirement(h, {
          masteredClasses, classes: myClasses, level, atCreation
        });
        const already = owned >= max;
        // 只能靠開局名額取得（精通條件還沒到）
        const needsSlot = !verdict.ok && atCreation
          && checkHeroicSkillRequirement(h, { classes: myClasses, level, atCreation: true }).ok;
        const blocked = already || (needsSlot && slotBlocked);
        const reason = already
          ? (max > 1 ? `已取滿 ${owned}/${max}` : '已習得')
          : (!verdict.ok ? verdict.reason : (needsSlot && slotBlocked ? '開局名額已用完' : ''));
        return { h, owned, max, verdict, already, blocked, reason, canPick: verdict.ok && !blocked };
      });
  }, [query, onlyMyClasses, sourceFilter, mine, character, masteredClasses.join('|'), // eslint-disable-line react-hooks/exhaustive-deps
    level, atCreation, slotBlocked]);

  const sources = useMemo(() => [...new Set(HEROIC_SKILLS.map((h) => h.source))], []);

  const inputStyle = {
    backgroundColor: theme.cardBg,
    borderColor: theme.border,
    color: theme.textDark
  };

  return (
    <div className="flex flex-col h-[82vh] md:h-[76vh] max-h-[760px] overflow-hidden -m-1">
      {/* ==================== 過濾列 ==================== */}
      <div
        className="shrink-0 rounded border p-3 mb-2 space-y-2"
        style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <GiMagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋名稱、條件或效果…"
              className="w-full pl-8 pr-3 py-1.5 rounded border text-xs outline-none"
              style={inputStyle}
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="py-1.5 px-2 rounded border text-xs outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="all">全部出處</option>
            {sources.map((s) => (
              <option key={s} value={s}>{HEROIC_SKILL_SOURCE_LABELS[s] || s}</option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 cursor-pointer text-xs" style={{ color: theme.textDark }}>
            <input
              type="checkbox"
              checked={onlyMyClasses}
              onChange={(e) => setOnlyMyClasses(e.target.checked)}
              className="cursor-pointer"
            />
            只顯示與我的職業有關的
          </label>
        </div>

        <div
          className="flex items-center justify-between gap-2 flex-wrap text-t11"
          style={{ color: theme.textMuted }}
        >
          <span>
            顯示 <strong style={{ color: theme.textDark }}>{rows.length}</strong> / 共 {HEROIC_SKILLS.length} 筆
            {onlyMyClasses && myClasses.length > 0 && `（依你的職業：${myClasses.join('、')}）`}
          </span>
          <span>
            {atCreation
              ? '這一團開了「開局贈送一個英雄技能」：職業條件改成「擁有該職業其中之一」，其他條件不變'
              : '需先把一個職業練到 10 級（精通）才能取得英雄技能（原書 p.232）'}
          </span>
        </div>
      </div>

      {/* ==================== 表格 ==================== */}
      <div className="flex-1 overflow-y-auto min-h-0 rounded border" style={{ borderColor: theme.border }}>
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: theme.subpanelBg }}>
            <tr style={{ color: theme.textDark }}>
              <th className="text-left font-bold px-3 py-2 border-b w-[15%]" style={{ borderColor: theme.border }}>名稱</th>
              <th className="text-left font-bold px-3 py-2 border-b w-[8%]" style={{ borderColor: theme.border }}>出處</th>
              <th className="text-left font-bold px-3 py-2 border-b w-[22%]" style={{ borderColor: theme.border }}>條件</th>
              <th className="text-left font-bold px-3 py-2 border-b" style={{ borderColor: theme.border }}>效果</th>
              <th className="text-center font-bold px-3 py-2 border-b w-[10%]" style={{ borderColor: theme.border }}>選用</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center" style={{ color: theme.textMuted }}>
                  沒有符合條件的英雄技能。取消勾選「只顯示與我的職業有關的」看全部。
                </td>
              </tr>
            )}
            {rows.map(({ h, owned, max, reason, canPick }) => (
              <tr key={h.name} className="align-top" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td className="px-3 py-2 font-bold" style={{ color: theme.textDark }}>
                  {h.name}
                  {owned > 0 && (
                    <span className="ml-1.5 text-t10 font-normal" style={{ color: theme.accent }}>
                      已持有 {owned}{max > 1 ? `/${max}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2" style={{ color: theme.textMuted }}>
                  {HEROIC_SKILL_SOURCE_LABELS[h.source] || h.source}
                </td>
                <td className="px-3 py-2" style={{ color: theme.textMuted }}>
                  {h.requirement}
                </td>
                <td
                  className="px-3 py-2 leading-relaxed whitespace-pre-line"
                  style={{ color: theme.textDark }}
                >
                  {resolveHeroicSkillEffect(h.name, h.effect, character)}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    disabled={!canPick}
                    onClick={() => onPick(h)}
                    className="text-t11 font-bold px-2.5 py-1.5 rounded border transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1"
                    style={{
                      backgroundColor: canPick ? (theme.accent) : (theme.cardBg),
                      borderColor: theme.border,
                      color: canPick ? '#fff' : (theme.textDark)
                    }}
                  >
                    {canPick ? <><GiCheckMark className="w-3 h-3" />選用</> : '不可選'}
                  </button>
                  {reason && (
                    <div className="text-t10 mt-1 leading-snug" style={{ color: theme.textMuted }}>
                      {reason}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 pt-2">
        <span className="text-t11 flex items-center gap-1.5" style={{ color: theme.textMuted }}>
          <GiLaurelCrown className="w-3.5 h-3.5" />
          出處與條件以官方規則書／Playtest 為準；繁中譯名取自角色卡 Excel V2.17。
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold px-3 py-1.5 rounded border cursor-pointer"
            style={inputStyle}
          >
            關閉
          </button>
        )}
      </div>
    </div>
  );
}

export default function HeroicSkillPickerModal({ isOpen, onClose, ...bodyProps }) {
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title="選擇英雄技能" maxWidth="max-w-6xl">
      <HeroicSkillPickerBody {...bodyProps} onClose={onClose} />
    </JRPGModal>
  );
}
