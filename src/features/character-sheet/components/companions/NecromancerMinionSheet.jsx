import React, { useState } from 'react';
import {
  GiDeathSkull,
  GiHeartMinus,
  GiHeartPlus,
  GiHazardSign,
  GiSparkles,
  GiCrossedSwords,
  GiDeathJuice
} from 'react-icons/gi';
import { Trash2, Plus } from 'lucide-react';
import JRPGButton from '../../../../components/ui/JRPGButton';
import EmptyState from '../../../../components/ui/EmptyState';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { getCharacterLevel } from '../../utils/characterEngine';
import {
  createDefaultMinion,
  MINION_SPECIES,
  MINION_RANK,
  CONVERTIBLE_SPECIES,
  MINION_AFFINITIES,
  MINION_LEASH_DAYS
} from '../../data/necroMinionData';

/**
 * 死靈術士【殘酷的誕生】的僕從卡 (NecromancerMinionSheet)
 *
 * ## 為什麼需要這個元件
 *
 * 它是 `docs/skill-coverage.md` 第六節分析裡**唯一需要新元件**的一筆。
 * 其餘七筆（勇氣／氣勢／霧化點／疲勞值／不穩定值／顛覆點／異常值）都是單純的計數器，
 * 擴充 `classResources.js` 就夠；但僕從是**會被反覆引用的子實體**——
 * 自己的 HP/MP、自己的裝備、衝突中自己一個回合——跟旅人【忠實夥伴】同性質。
 *
 * ## 兩件由 App 算、不靠玩家記的事
 *
 * 1. **你的 HP/MP 上限懲罰**＝該 NPC 的等級。已接進 `characterEngine`，
 *    僕從被摧毀時會自動恢復（官方：「如果你的僕從被摧毀，你的 HP 和 MP 上限會恢復正常」）。
 * 2. **摧毀的觸發條件**——HP 歸零 ＋ 距離超過 1 個旅行日、或你死亡／昏迷。
 *    這一格會把「HP 已歸零」標紅，提醒玩家去確認距離。
 */
export default function NecromancerMinionSheet({ character, onChange, showToast = () => {} }) {
  const [draft, setDraft] = useState(null);

  const minion = character.necroData?.minion || createDefaultMinion();
  const charLevel = getCharacterLevel(character);

  const update = (updates) => {
    onChange({
      ...character,
      necroData: { ...(character.necroData || {}), minion: { ...minion, ...updates } }
    });
  };

  const hp = minion.currentHp === null || minion.currentHp === undefined ? 0 : minion.currentHp;
  const mp = minion.currentMp === null || minion.currentMp === undefined ? 0 : minion.currentMp;
  const cost = Math.max(0, Math.floor(Number(minion.npcLevel) || 0));
  const hpZero = minion.active && hp <= 0;

  const createMinion = () => {
    const d = draft || createDefaultMinion();
    if (!d.name.trim()) {
      showToast('請先給僕從取個名字', 'warning');
      return;
    }
    update({
      ...d,
      active: true,
      currentHp: d.currentHp === null ? null : d.currentHp,
      currentMp: d.currentMp === null ? null : d.currentMp
    });
    setDraft(null);
    showToast(`僕從「${d.name}」已成形（HP/MP 上限各 −${Math.max(0, Math.floor(Number(d.npcLevel) || 0))}）`, 'success');
  };

  // ── 還沒有僕從 ──────────────────────────────────────────────
  if (!minion.active) {
    const d = draft || createDefaultMinion();
    const set = (k, v) => setDraft({ ...d, [k]: v });
    return (
      <div className="rounded-xl border border-[#d6c7ab] bg-[#f4ebd9] p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#3c2415] flex items-center gap-1.5">
            <GiDeathSkull className="w-4 h-4 text-[#5e387c]" />
            殘酷的誕生：僕從
          </span>
          {!draft && (
            <JRPGButton variant="outline" size="xs" icon={Plus} onClick={() => setDraft(createDefaultMinion())}>
              創造僕從
            </JRPGButton>
          )}
        </div>

        {!draft ? (
          <EmptyState
            kind="necromancer-minion"
            icon={GiDeathSkull}
            tone="inset"
            title="還沒有僕從"
            teach={
              <>
                當一個你能看見的野獸／類人／怪物／植物物種<strong>非反派</strong> NPC 死亡時，你可以花{' '}
                <strong>2 個墳墓點</strong>把屍體變成僕從——代價是 HP 與 MP 上限各減去
                <strong>該 NPC 的等級</strong>。
              </>
            }
          />
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-bold text-[#6b5a4b]">僕從的名字</span>
                <input
                  type="text" value={d.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="例：白骨侍從"
                  className="w-full mt-0.5 rounded-lg border border-[#d6c7ab] bg-white px-2 py-1 text-xs outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-[#6b5a4b]">原生物（從誰變來的）</span>
                <input
                  type="text" value={d.originName} onChange={(e) => set('originName', e.target.value)}
                  placeholder="例：峽谷巨狼"
                  className="w-full mt-0.5 rounded-lg border border-[#d6c7ab] bg-white px-2 py-1 text-xs outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-[#6b5a4b]">原生物物種（官方限定四種）</span>
                <select
                  value={d.originSpecies} onChange={(e) => set('originSpecies', e.target.value)}
                  className="w-full mt-0.5 rounded-lg border border-[#d6c7ab] bg-white px-2 py-1 text-xs outline-none cursor-pointer"
                >
                  <option value="">—</option>
                  {CONVERTIBLE_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-[#6b5a4b]">原生物定位</span>
                <select
                  value={d.originRank} onChange={(e) => set('originRank', e.target.value)}
                  className="w-full mt-0.5 rounded-lg border border-[#d6c7ab] bg-white px-2 py-1 text-xs outline-none cursor-pointer"
                >
                  {['士兵', '菁英', '冠名'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-[#6b5a4b]">
                  原生物等級（＝你的 HP/MP 上限懲罰）
                </span>
                <input
                  type="number" min={0} max={50} value={d.npcLevel}
                  onChange={(e) => set('npcLevel', Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full mt-0.5 rounded-lg border border-[#d6c7ab] bg-white px-2 py-1 text-xs outline-none font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-[#6b5a4b]">保留的裝備</span>
                <input
                  type="text" value={d.equipment} onChange={(e) => set('equipment', e.target.value)}
                  placeholder="原生物的所有裝備"
                  className="w-full mt-0.5 rounded-lg border border-[#d6c7ab] bg-white px-2 py-1 text-xs outline-none"
                />
              </label>
            </div>
            {d.originRank !== '士兵' && (
              <p className="text-t12 text-[#9c4d16] leading-relaxed">
                ※ 原本是{ d.originRank }——官方說「GM 必須相應地減少僕從的 HP 和 MP（技能保持不變）」，
                沒有給公式，請與 GM 確認數值。
              </p>
            )}
            <div className="flex items-center gap-2">
              <JRPGButton variant="primary" size="xs" icon={GiSparkles} onClick={createMinion}>
                確認成形（花 2 墳墓點）
              </JRPGButton>
              <button
                type="button" onClick={() => setDraft(null)}
                className="text-[11px] text-[#6b5a4b] hover:text-[#3c2415] px-2 py-1 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 已經有僕從 ──────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-[#5e387c] bg-[#f4ebd9] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-[#3c2415] flex items-center gap-1.5">
          <GiDeathSkull className="w-4 h-4 text-[#5e387c]" />
          {minion.name || '（未命名）'}
          <span className="text-[10px] font-mono text-[#6b5a4b]">
            {MINION_SPECIES}／{MINION_RANK}（{charLevel} 級持有者）
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            update({ active: false });
            showToast('僕從已摧毀——你的 HP／MP 上限已恢復正常', 'info');
          }}
          className="text-[11px] text-[#6b5a4b] hover:text-[#8c2d36] flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          摧毀僕從
        </button>
      </div>

      {/* 上限懲罰：這一條由 characterEngine 自動套用，不是只寫在這裡 */}
      {cost > 0 && (
        <div className="rounded-lg border border-[#8c2d36] bg-[#f4ebd9] px-2.5 py-1.5 flex items-center gap-2">
          <GiHazardSign className="w-3.5 h-3.5 text-[#8c2d36] shrink-0" />
          <span className="text-[11px] font-bold text-[#8c2d36]">
            你的 HP／MP 上限各 −{cost}（原生物 {cost} 級）——已自動計入角色數值，
            摧毀僕從時會恢復。
          </span>
        </div>
      )}

      {/* HP / MP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          { key: 'currentHp', label: 'HP', value: hp, set: (v) => update({ currentHp: Math.max(0, v) }) },
          { key: 'currentMp', label: 'MP', value: mp, set: (v) => update({ currentMp: Math.max(0, v) }) }
        ].map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-2 rounded-lg border border-[#d6c7ab] bg-white px-2.5 py-1.5">
            <span className="text-[11px] font-bold text-[#3c2415]">{row.label}</span>
            <div className="flex items-center gap-1 font-mono">
              <button
                type="button" disabled={row.value <= 0}
                onClick={() => row.set(row.value - 1)}
                className="w-6 h-6 rounded border border-[#d6c7ab] flex items-center justify-center disabled:opacity-20 cursor-pointer"
              >
                <GiHeartMinus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number" min={0} value={row.value}
                onChange={(e) => row.set(parseInt(e.target.value, 10) || 0)}
                className="w-14 text-center font-black text-sm outline-none border-b border-dashed border-[#d6c7ab]"
              />
              <button
                type="button"
                onClick={() => row.set(row.value + 1)}
                className="w-6 h-6 rounded border border-[#d6c7ab] flex items-center justify-center cursor-pointer"
              >
                <GiHeartPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {hpZero && (
        <div className="rounded-lg border border-[#8c2d36] bg-[#f4ebd9] px-2.5 py-1.5 text-[11px] text-[#8c2d36] leading-relaxed">
          <strong>HP 已歸零。</strong>若你距離牠超過 <strong>{MINION_LEASH_DAYS} 個旅行日</strong>，
          或者你死亡／失去知覺，牠會<strong>立即被摧毀</strong>。請確認距離後再決定。
        </div>
      )}

      {/* 官方規則要點 */}
      <div className="text-[10px] text-[#6b5a4b] leading-relaxed space-y-0.5">
        <div className="flex items-start gap-1">
          <GiSparkles className="w-3 h-3 mt-0.5 shrink-0 text-[#5e387c]" />
          <span>
            親和力：獲得
            {MINION_AFFINITIES.map((a) => (
              <span key={a} className="mx-0.5">{renderTextWithAffinities(a)}</span>
            ))}
            的新親和力，失去原先具備的；原物種的其他規則保持不變。
          </span>
        </div>
        <div className="flex items-start gap-1">
          <GiCrossedSwords className="w-3 h-3 mt-0.5 shrink-0 text-[#5e387c]" />
          <span>衝突中你和牠<strong>各有自己的回合</strong>，GM 設計衝突時要把牠算作一個額外的玩家角色。</span>
        </div>
        <div className="flex items-start gap-1">
          <GiDeathJuice className="w-3 h-3 mt-0.5 shrink-0 text-[#5e387c]" />
          <span>休息時牠也獲得全部好處；牠保留原生物的所有裝備。</span>
        </div>
      </div>

      {(minion.equipment || minion.notes) && (
        <div className="rounded-lg border border-[#d6c7ab] bg-white px-2.5 py-1.5 text-[11px] text-[#3c2415] space-y-0.5">
          {minion.equipment && <div>裝備：{minion.equipment}</div>}
          {minion.notes && <div>備註：{minion.notes}</div>}
        </div>
      )}

      <label className="block">
        <span className="text-[10px] font-bold text-[#6b5a4b]">備註（心靈感應命令之類）</span>
        <input
          type="text" value={minion.notes} onChange={(e) => update({ notes: e.target.value })}
          className="w-full mt-0.5 rounded-lg border border-[#d6c7ab] bg-white px-2 py-1 text-xs outline-none"
        />
      </label>
    </div>
  );
}
