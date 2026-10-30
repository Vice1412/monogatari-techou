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
 *
 * ## 條件後半段：能判的自己判，判不出來的才問玩家（F-030，P31）
 *
 * 34 條技能的前提後面還有一段（「且習得招架反擊技能」「【魔法卡組】達到技能等級 3」）。
 * 原本的作法是「一律不解析、全部交給玩家勾」——GM 問了一句「不能自己檢查嗎」，
 * 量完發現**28 條判得出來**（技能名都在名冊裡），只有 6 條判不出來
 * （要嘛「有技能≠有那個物種」，要嘛資料沒有「這條咒語算不算攻擊性」這種分類）。
 * 所以：判得出來的直接把缺的那一招寫在條件欄；判不出來的才長勾選框。
 * 勾選是**那一次選擇**的宣告，選完立刻清掉，不會變成永久放行。
 * 只有等級前提的（雙重詠唱、偉大召喚）不長勾選框：那個引擎已經在算了。
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
import { resolveCreationRules } from '../data/creationRules';
import { modeRestrictsEquipment } from '../data/technospheres';
import { TERMS } from '../data/glossary';
import { renderTextWithTerms } from '../../../components/ui/termText';

/**
 * 英雄技能效果欄要標註的術語（F-031）。
 *
 * 為什麼只有這四個：115 條效果裡出現的縮寫共 6 種，其中「（o）」與「10×T」
 * 不是名詞而是**圖示與公式**（原書是攻擊性咒語的圖示），已在資料層改寫成文字，
 * 不需要 tooltip；剩下這四個才是「查得到定義就能讀懂」的名詞。
 *
 * **匯出是刻意的**：`tests/heroicText.test.mjs` 要能斷言「這四個一個都沒被漏掉」。
 * 清單只寫在這個檔案裡的話，有人刪掉一條時測試不會知道——它會繼續綠。
 */
export const HEROIC_TERM_LIST = [TERMS.hr, TERMS.fabulaPoint, TERMS.ip, TERMS.tradePoint].filter(Boolean);

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
  /**
   * 已經勾了「我符合這個前提」的技能名（F-030）。
   *
   * 為什麼是元件 state 而不是存進角色卡：這是**那一次選擇**的宣告，不是角色屬性。
   * 存進角色卡的話，勾一次就永久放行；而彈窗關掉時 `JRPGModal` 會 `return null`，
   * 整個 Body 卸載，state 自然歸零——「下次開還是要重新確認」是免費得到的。
   */
  const [confirmed, setConfirmed] = useState(() => new Set());

  const toggleConfirm = (name, on) => setConfirmed((prev) => {
    const next = new Set(prev);
    if (on) next.add(name); else next.delete(name);
    return next;
  });

  const myClasses = (character?.classes || []).map((c) => c.className);
  const masteredClasses = stats?.masteredClasses || [];
  const level = character?.level;
  const atCreation = Boolean(rules?.startingHeroicSkill);
  /**
   * 這張卡「學過什麼」——額外前提（「且習得招架反擊技能」）要靠它才判得出來（P31）。
   *
   * `classes[].skills` 是 `[{ name, sl }]`，連技能等級都存著，
   * 所以「【魔法卡組】達到技能等級 3」也判得出來。
   */
  const learnedSkills = useMemo(
    () => (character?.classes || []).flatMap((c) => c.skills || []),
    [JSON.stringify((character?.classes || []).map((c) => c.skills || []))] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // 咒語：三學派（存名字）＋ 嵌合師自己記下的（存物件，帶 `isOffensive`）。
  // 【奧法戰士】要數「攻擊性咒語」，漏掉嵌合師那一半會把合法角色擋掉。
  const learnedSpells = useMemo(
    () => [
      ...(character?.spells || []).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean),
      ...(character?.chimeristData?.spells || [])
    ],
    [JSON.stringify((character?.spells || []).map((s) => (typeof s === 'string' ? s : s?.name))),
      JSON.stringify(character?.chimeristData?.spells || [])] // eslint-disable-line react-hooks/exhaustive-deps
  );
  /** 忠實夥伴的物種（【這東西是活著的】＝構裝體、【根源共生】＝植物）。沒設計過就是 null。 */
  const companionSpecies = character?.wayfarerData?.companion?.species || null;
  /** 小工具三條軌點到第幾檔（【藥水霧化】【量子魔加農】【大鍋秘方】【爆裂藝術家】）。 */
  const gadgets = character?.tinkererData?.gadgets || null;
  /**
   * 魔晶石制把魔導科技那一軌改寫了（魔加農火器移除、魔法球原型降檔），
   * 同一個「高級」指的不是同一個節點 → 那一條交回玩家，不猜。
   */
  const technoRestrictsEquipment = modeRestrictsEquipment(
    resolveCreationRules(character?.creationRules).technospheres
  );

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
          masteredClasses, classes: myClasses, level, atCreation,
          learnedSkills, learnedSpells, companionSpecies, gadgets, technoRestrictsEquipment
        });
        const already = owned >= max;
        // 只能靠開局名額取得（精通條件還沒到）
        const needsSlot = !verdict.ok && atCreation
          && checkHeroicSkillRequirement(h, {
            classes: myClasses, level, atCreation: true,
            learnedSkills, learnedSpells, companionSpecies, gadgets, technoRestrictsEquipment
          }).ok;
        const blocked = already || (needsSlot && slotBlocked);
        const reason = already
          ? (max > 1 ? `已取滿 ${owned}/${max}` : '已習得')
          : (!verdict.ok ? verdict.reason : (needsSlot && slotBlocked ? '開局名額已用完' : ''));
        // 引擎**判不出來**的前提才問玩家（P31）：能算的已經在 `verdict` 裡算過了，
        // 算不過會直接變成上面那句 reason。已經持有的列不必再問——那一列本來就按不下去。
        const extra = verdict.extraText || '';
        const needsConfirm = Boolean(verdict.needsPlayerConfirm) && verdict.ok && !blocked;
        return { h, owned, max, verdict, already, blocked, reason, extra, needsConfirm, ok: verdict.ok };
      });
  }, [query, onlyMyClasses, sourceFilter, mine, character, masteredClasses.join('|'), // eslint-disable-line react-hooks/exhaustive-deps
    level, atCreation, slotBlocked, learnedSkills, learnedSpells, companionSpecies,
    gadgets, technoRestrictsEquipment]);

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
              className="w-full pl-8 pr-3 py-1.5 rounded border text-t12 outline-none"
              style={inputStyle}
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="py-1.5 px-2 rounded border text-t12 outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="all">全部出處</option>
            {sources.map((s) => (
              <option key={s} value={s}>{HEROIC_SKILL_SOURCE_LABELS[s] || s}</option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 cursor-pointer text-t12" style={{ color: theme.textDark }}>
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
          className="flex items-center justify-between gap-2 flex-wrap text-t12"
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
        <table className="w-full text-t12 border-collapse">
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
            {rows.map(({ h, owned, max, reason, extra, needsConfirm, ok, blocked }) => {
              // 勾選狀態在 render 期才算，不進 useMemo——不然每勾一次整張表都要重算。
              const isConfirmed = confirmed.has(h.name);
              const canPick = ok && !blocked && (!needsConfirm || isConfirmed);
              const pendingConfirm = needsConfirm && !isConfirmed;
              return (
              <tr key={h.name} className="align-top" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td className="px-3 py-2 text-t14 font-bold" style={{ color: theme.textDark }}>
                  {h.name}
                  {owned > 0 && (
                    <span className="ml-1.5 text-t12 font-normal" style={{ color: theme.accent }}>
                      已持有 {owned}{max > 1 ? `/${max}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2" style={{ color: theme.textMuted }}>
                  {HEROIC_SKILL_SOURCE_LABELS[h.source] || h.source}
                </td>
                <td className="px-3 py-2" style={{ color: theme.textMuted }}>
                  {h.requirement}
                  {needsConfirm && (
                    /* 勾選框放在「條件」欄而不是「選用」欄：它確認的是條件，不是按鈕；
                       而且 10% 寬的按鈕欄塞不下「我符合這個前提」這幾個字。 */
                    <label
                      className="mt-1.5 flex items-start gap-1.5 cursor-pointer text-t12 leading-snug rounded px-1.5 py-1"
                      style={{
                        color: theme.textDark,
                        border: `1px dashed ${theme.border}`,
                        backgroundColor: isConfirmed ? 'transparent' : theme.subpanelBg
                      }}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0 cursor-pointer"
                        checked={isConfirmed}
                        onChange={(e) => toggleConfirm(h.name, e.target.checked)}
                        data-testid={`heroic-confirm-${h.name}`}
                      />
                      <span>
                        我符合這個前提
                        <span className="block" style={{ color: theme.textMuted }}>
                          （「{extra}」App 不會自動檢查，請自己確認）
                        </span>
                      </span>
                    </label>
                  )}
                </td>
                <td
                  className="px-3 py-2 text-t14 leading-relaxed whitespace-pre-line"
                  style={{ color: theme.textDark }}
                  data-testid={`heroic-effect-${h.name}`}
                >
                  {/* 資料層保持純文字，只在渲染時把術語包成 tooltip（F-031）。 */}
                  {renderTextWithTerms(resolveHeroicSkillEffect(h.name, h.effect, character), HEROIC_TERM_LIST)}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    disabled={!canPick}
                    data-testid={`heroic-pick-${h.name}`}
                    onClick={() => {
                      // 勾選是「這一次選擇」的宣告：選完就清掉，連按兩次要勾兩次。
                      if (needsConfirm) toggleConfirm(h.name, false);
                      onPick(h);
                    }}
                    className="text-t12 font-bold px-2.5 py-1.5 rounded border transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1"
                    style={{
                      backgroundColor: canPick ? (theme.accent) : (theme.cardBg),
                      borderColor: theme.border,
                      color: canPick ? '#fff' : (theme.textDark)
                    }}
                  >
                    {canPick ? <><GiCheckMark className="w-3 h-3" />選用</> : (pendingConfirm ? '先確認' : '不可選')}
                  </button>
                  {(reason || pendingConfirm) && (
                    <div className="text-t12 mt-1 leading-snug" style={{ color: theme.textMuted }}>
                      {reason || '請先勾選左邊的「我符合這個前提」'}
                    </div>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 pt-2">
        <div className="text-t12 leading-snug min-w-0" style={{ color: theme.textMuted }}>
          <div className="flex items-center gap-1.5">
            <GiLaurelCrown className="w-3.5 h-3.5 shrink-0" />
            出處與條件以官方規則書／Playtest 為準；繁中譯名取自角色卡 Excel V2.17。
          </div>
          {/* 這一句是給「為什麼那幾列要打勾」用的：不打勾的人會以為 App 壞了。
              P31 之後只剩少數幾條要打勾（引擎判得出「學會某技能」，判不出「選了哪個物種」），
              所以不能沿用舊說法「後半段一律不解析」——那是改動前的行為。 */}
          <div className="mt-0.5">
            條件缺哪一招，App 會直接寫出來。只有「選了哪個物種／哪個增益」這類判不出來的，
            才會出現勾選框請你自己確認。
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-t12 font-bold px-3 py-1.5 rounded border cursor-pointer"
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
