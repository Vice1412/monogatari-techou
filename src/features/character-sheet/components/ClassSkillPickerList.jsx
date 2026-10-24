import React from 'react';
import SkillStarPips from './SkillStarPips';
import SkillDescription from '../utils/skillFormulaEvaluator';

/**
 * 一個職業（或一顆職業魔石）的**完整技能表**——每一列都帶說明，可點星星投 SL。
 *
 * ## 為什麼要抽出來
 *
 * `ClassSkillCard` 的「模式 B（展開點選）」做的是同一件事，但它同時綁了公測變體、
 * 技能子選項彈窗、載具／夥伴／小工具三種專屬 bar、植物學家花園預覽——職業魔石
 * 一樣都不需要。2026-10-22 之前，職業魔石的技能分配是一個只有技能名的 `<select>`，
 * 玩家看不到任何說明就得決定點數要投哪裡。
 *
 * 抽成獨立元件後，兩邊的**互動語彙**（點星星加點、點已亮的星星降級）共用一份實作，
 * 但 `ClassSkillCard` 沒有被改動——它有太多魔石不需要的分支，硬接會變成
 * 「一個元件兩種模式」的老問題（見 `docs/decisions.md` §BY）。
 *
 * ## 預算模型
 *
 * 點數是**共用的一個池子**（`budget`），不是每個技能各自一份。所以某個技能此刻
 * 能點到的上限是：
 *
 * ```
 * min(技能自己的 maxSL, 這個技能目前的 SL ＋ 還沒花掉的點數)
 * ```
 *
 * 少了後面那一項，玩家可以先把 A 點滿、再看見 B 的星星亮著卻點不動——星星會說謊。
 * 星星本身也只畫到那個上限，不畫到技能上限。
 *
 * ## 存檔裡有技能表查不到的技能名時
 *
 * 這種點數**不能靜默丟掉**。職業表會改版（`docs/decisions.md` §BF 就改過一次職業名），
 * 而玩家的存檔留著舊名字；若這裡把它濾掉，「已分配 2 點」會變成「已分配 0 點」，
 * 那 2 點憑空消失、玩家也看不出來。所以照樣列出來、標上「技能表查無此技能」，
 * 讓玩家自己決定要不要收回去。
 *
 * ## 純函式邊界
 *
 * 元件不自己保管 SL，全部走 `onChange(nextValue)` 往上拋。理由與 `AGENTS.md`
 * §1 的「`onClick` 內的邏輯 SSR 測不到」同一條：算 SL 的規則要能被測試直接呼叫。
 */

/**
 * 把 `[{ name, sl }]` 正規化成「照 `skills` 順序、去掉 sl<=0、查不到的排最後」。
 *
 * 順序固定很重要——`validateTechnosphereState` 與跑團卡都按陣列順序顯示，
 * 若這裡讓 Map 的插入順序決定，同一份點數會因為「先點哪個」而排出不同的卡片。
 */
const normalizeSkillValue = (skills, value) => {
  const map = new Map();
  (value || []).forEach((entry) => {
    if (!entry || !entry.name) return;
    const sl = Math.max(0, Math.floor(Number(entry.sl) || 0));
    if (sl > 0) map.set(entry.name, sl);
  });
  const known = (skills || [])
    .filter((sk) => map.has(sk.name))
    .map((sk) => ({ name: sk.name, sl: map.get(sk.name) }));
  const orphan = [...map.keys()]
    .filter((name) => !(skills || []).some((sk) => sk.name === name))
    .map((name) => ({ name, sl: map.get(name) }));
  return known.concat(orphan);
};

export default function ClassSkillPickerList({
  skills = [],
  value = [],
  budget = 0,
  disabled = false,
  theme = {},
  onChange = () => {},
  testIdPrefix = 'skill-picker',
  maxSLCap = 5,
  emptyHint = ''
}) {
  const normalized = normalizeSkillValue(skills, value);
  const slOf = (name) => normalized.find((s) => s.name === name)?.sl || 0;
  const spent = normalized.reduce((sum, s) => sum + s.sl, 0);
  const remaining = Math.max(0, budget - spent);

  // 渲染列 ＝ **整張技能表**（未學的也要列，否則玩家看不到自己還有什麼可選）
  // ＋ 存檔裡查得到名字但技能表已沒有的（orphan，排最後）。
  const rows = (skills || [])
    .map((sk) => ({ name: sk.name, maxSL: sk.maxSL, desc: sk.desc, orphan: false }))
    .concat(normalized
      .filter((entry) => !(skills || []).some((sk) => sk.name === entry.name))
      .map((entry) => ({ name: entry.name, maxSL: undefined, desc: undefined, orphan: true })));

  const capOf = (row) => Math.min(maxSLCap, Math.max(1, Number(row?.maxSL) || maxSLCap));

  const setSL = (name, nextSL) => {
    if (disabled) return;
    const current = slOf(name);
    const row = rows.find((r) => r.name === name);
    const cap = capOf(row);
    // 這個技能此刻真正的天花板：自己的上限，或「現有 ＋ 還沒花的」，取小。
    const ceiling = Math.min(cap, current + remaining);
    const target = Math.max(0, Math.min(Math.floor(Number(nextSL) || 0), ceiling));
    if (target === current) return;

    const next = normalized
      .filter((s) => s.name !== name)
      .concat(target > 0 ? [{ name, sl: target }] : []);
    onChange(normalizeSkillValue(skills, next));
  };

  if (rows.length === 0) {
    return (
      <p className="text-t12 italic" style={{ color: theme.textMuted }}>
        {emptyHint || '這個職業沒有技能表'}
      </p>
    );
  }

  return (
    <div className="space-y-1.5" data-testid={testIdPrefix}>
      {rows.map((row) => {
        const currentSL = slOf(row.name);
        const isLearned = currentSL > 0;
        const cap = capOf(row);
        // 星星要畫幾顆：畫到「這個技能此刻點得到的最高」，不是畫到技能上限。
        // 畫滿 5 顆卻只點得動 2 顆，等於讓星星說謊。
        const visibleMax = Math.min(cap, currentSL + remaining);

        return (
          <div
            key={row.name}
            className="p-2 rounded-lg border text-xs space-y-1"
            style={{
              backgroundColor: isLearned ? theme.subpanelBg : theme.cardBg,
              borderColor: isLearned ? theme.accent : theme.border,
              borderWidth: isLearned ? 2 : 1
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
              <span
                className="font-bold flex items-center gap-1.5 text-t11 flex-wrap"
                style={{ color: theme.textDark }}
              >
                <span style={{ color: theme.accent }}>✦</span>
                {row.name}
                {isLearned && !row.orphan && (
                  <span
                    className="text-t12 font-bold px-1 py-0.5 rounded border"
                    style={{ borderColor: theme.border, color: theme.textMuted }}
                  >
                    已學習
                  </span>
                )}
                {row.orphan && (
                  <span
                    className="text-t12 font-bold px-1 py-0.5 rounded border"
                    style={{ borderColor: '#8c2d36', color: '#8c2d36' }}
                    title="這個技能名不在目前的職業技能表裡——可能是舊存檔留下的，點星星可以收回點數"
                  >
                    技能表查無此技能
                  </span>
                )}
              </span>
              {/* 星星畫**技能自己的上限**（`cap`），不是「這次點得到的」（`visibleMax`）。
                  畫 `visibleMax` 會讓 `SL 0/1` 看起來像「這技能只到 1 級」——那是假的，
                  上限是 5 級，只是這顆魔石只剩 1 點可投。點超過的那一下由 `setSL`
                  夾回 `visibleMax`，等於「我只剩 1 點，就投 1 點」。
                  每行不另外標「本次最多 N」——`remaining` 是全域的，每行印的都是同一個
                  數字，只會變成噪音；底部那行已經寫了可分配幾點。 */}
              <span
                className="flex items-center shrink-0"
                title={visibleMax < cap
                  ? `這個技能上限 ${cap} 級；這顆魔石剩下的點數只夠投到 ${visibleMax} 級`
                  : undefined}
              >
                <SkillStarPips
                  maxSL={Math.max(1, cap)}
                  currentSL={currentSL}
                  disabled={disabled}
                  size={14}
                  onChange={(next) => setSL(row.name, next)}
                />
              </span>
            </div>
            <div
              className="text-t10 leading-relaxed font-sans"
              style={{ color: theme.textDark }}
            >
              {row.orphan
                ? '（這個名稱不在目前的技能表裡，沒有說明可顯示）'
                : <SkillDescription desc={row.desc} sl={currentSL} />}
            </div>
          </div>
        );
      })}
      <p className="text-t12 font-mono pt-0.5" style={{ color: remaining === 0 ? '#8c2d36' : theme.textMuted }}>
        可分配 {remaining} 點（已用 {spent} / {budget}）
      </p>
    </div>
  );
}
