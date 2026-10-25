/**
 * 「這個職業精通之後能解鎖哪些英雄技能」——附條件與效果全文。
 *
 * 使用者對這一塊的定調（2026-10-06）：
 *
 * 1. **它是「選職業的參考」，不是常駐面板。** 所以它放在 `ClassPickerModal`（挑職業的彈窗）
 *    的職業技能下面，**預設收合**，按「顯示英雄技能」才展開。
 *    原本它掛在編輯器第 2 步的職業卡下面而且預設展開——使用者說「太滿了」。
 * 2. **純瀏覽。** 這裡沒有「選用」按鈕——選用一律回第 5 步的 `HeroicSkillPickerModal`。
 *    同一件事只有一個入口，之後改資格判定不必同步兩處。
 * 3. **定稿後整塊收起來**（`locked`）。目錄是創角輔助，角色定稿之後就不需要了。
 *    注意：**自己已經拿到的**技能效果照常顯示（角色卡／跑團面板／第 5 步的已選清單），
 *    收掉的只有這個目錄。
 *
 * 條件與效果的來源見 `heroicSkillsForClass`（與 `checkHeroicSkillRequirement` 共用判定）。
 */
import React, { useState } from 'react';
import { GiLaurelCrown } from 'react-icons/gi';
import { heroicSkillsForClass, HEROIC_SKILL_SOURCE_LABELS } from '../utils/characterEngine';

export default function ClassHeroicSkillsBlock({ className, theme = {}, locked = false }) {
  const [open, setOpen] = useState(false);
  const list = heroicSkillsForClass(className);
  // 定稿後收掉整個瀏覽入口（使用者裁定：目錄是創角輔助）
  if (list.length === 0 || locked) return null;

  return (
    <div
      className="rounded border shadow-2xs overflow-hidden"
      style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer hover:bg-black/[0.02] transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <GiLaurelCrown className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
          <span className="text-xs font-bold truncate" style={{ color: theme.textDark }}>
            {open ? '收起英雄技能' : '顯示英雄技能'}
          </span>
          <span
            className="text-t10 px-1.5 py-0.5 rounded border font-mono font-bold shrink-0"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
              color: theme.textMuted
            }}
          >
            {list.length}
          </span>
        </span>
        <span className="text-t11 shrink-0" style={{ color: theme.textMuted }}>
          {open ? '收起' : '展開'}
        </span>
      </button>

      {open && (
        <div className="border-t divide-y" style={{ borderColor: theme.border }}>
          <p className="px-3 py-1.5 text-t12 leading-snug" style={{ color: theme.textMuted }}>
            把這個職業練到 10 級（精通）可獲得一個英雄技能（原書 p.232）。以下每一條都必須先精通
            {className}，其他條件列在各自的「條件」欄。實際選用在第 5 步「掌握之英雄技能」。
          </p>
          {list.map((h) => (
            <div key={h.name} className="px-3 py-2 space-y-1" style={{ borderColor: theme.border }}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-bold" style={{ color: theme.textDark }}>
                  {h.name}
                </span>
                <span
                  className="text-t10 px-1.5 py-0.5 rounded border font-bold"
                  style={{
                    backgroundColor: theme.subpanelBg,
                    borderColor: theme.border,
                    color: theme.textMuted
                  }}
                >
                  {HEROIC_SKILL_SOURCE_LABELS[h.source] || h.source}
                </span>
              </div>
              <p className="text-t12 leading-snug" style={{ color: theme.textMuted }}>
                <strong>條件：</strong>{h.requirement}
              </p>
              <p className="text-t11 leading-relaxed whitespace-pre-line" style={{ color: theme.textDark }}>
                {h.effect}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
