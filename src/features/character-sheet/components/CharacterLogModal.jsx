import React, { useMemo, useState } from 'react';
import { GiQuillInk, GiHazardSign, GiScrollUnfurled, GiLaurelCrown } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import EmptyState from '../../../components/ui/EmptyState';
import JRPGButton from '../../../components/ui/JRPGButton';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import GameIcon from '../../../components/ui/GameIcon';
import {
  LOG_KINDS,
  getLog,
  appendLog,
  createLogEntry,
  filterLog,
  sortLogDesc,
  summarizeLog,
  groupLogBySession,
  formatChange,
  formatLogTime,
  formatLogDate
} from '../utils/characterLog';
import { deriveMilestones, milestoneCountText } from '../utils/milestones';

/**
 * 成長履歷 (Character Log)
 *
 * 呈現原則：
 * 1. **前後值才是重點。** 只寫「HP 變成 8」沒有用；每一列都列出 `HP 12 → 8`。
 * 2. **時間正序儲存、倒序顯示。** 儲存是帳本（可查「某段期間發生什麼」），
 *    顯示是「最近發生了什麼」。
 * 3. **摘要由 changes 推導，不另存統計欄位。** 兩份事實一定會走鐘。
 * 4. **玩家可以自己補一筆。** App 不知道的事（場外協議、劇情里程碑）也要能記進來——
 *    所以「新增記錄」是自由文本加可調日期，而不是只有系統事件。
 * 5. **有場次就分章。**（2026-10-30）一條沒有分段的長河回答不了
 *    「上次那場做了什麼」。分組只在顯示層做，儲存層仍是同一條 append-only 陣列；
 *    只有一組（或全部未分場）時退回平坦清單，舊存檔的畫面逐字不變。
 *
 * 內容本體 `CharacterLogBody` 與彈窗外殼分離，前者可獨立做 SSR 煙霧測試
 * （`JRPGModal` 以掛載後的 effect 為閘門，SSR 時不渲染 children）。
 */

const FILTER_ALL = '全部';

/** 把 Date 轉成 <input type="datetime-local"> 需要的字串（在地時區） */
const toLocalInput = (date) => {
  const d = date instanceof Date ? date : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function CharacterLogBody({ theme, character, onChange, showToast }) {
  const [kindFilter, setKindFilter] = useState(FILTER_ALL);
  const [draftText, setDraftText] = useState('');
  const [draftAt, setDraftAt] = useState(() => toLocalInput(new Date()));

  const entries = useMemo(() => getLog(character), [character]);
  const summary = useMemo(() => summarizeLog(entries), [entries]);
  // 里程碑與履歷吃同一份資料，但**不共用 `summary`**：那兩個數字是不同問題
  // （履歷問「記了幾筆」，里程碑問「走到哪了」），共用一份遲早會有一邊被改歪。
  const milestones = useMemo(() => deriveMilestones(character), [character]);

  // 只列出實際出現過的種類，避免一整排永遠是 0 的篩選鈕
  const presentKinds = useMemo(() => {
    const seen = new Set(entries.map((e) => e.kind));
    return Object.keys(LOG_KINDS).filter((k) => seen.has(k));
  }, [entries]);

  const visible = useMemo(() => {
    const filtered = kindFilter === FILTER_ALL ? entries : filterLog(entries, [kindFilter]);
    return sortLogDesc(filtered);
  }, [entries, kindFilter]);

  // 場次分組：只有一組時不畫標頭（舊存檔與「從沒開過場」的卡看起來跟以前一樣）
  const groups = useMemo(() => groupLogBySession(visible), [visible]);
  const showSessionHeaders = groups.length > 1;
  const sessionTotal = useMemo(
    () => new Set(entries.map((e) => e.session).filter((n) => Number.isInteger(n))).size,
    [entries]
  );

  const handleAddNote = () => {
    const text = draftText.trim();
    if (!text) {
      if (showToast) showToast('請先寫下要記錄的內容');
      return;
    }
    const at = draftAt ? new Date(draftAt) : new Date();
    const entry = createLogEntry({ kind: 'note', title: text, at });
    if (!entry) {
      if (showToast) showToast('這一筆記錄無法寫入');
      return;
    }
    onChange(appendLog(character, entry));
    setDraftText('');
    setDraftAt(toLocalInput(new Date()));
    if (showToast) showToast('已寫入成長履歷');
  };

  const tile = (label, value) => (
    <div
      key={label}
      className="rounded border px-2 py-1.5 flex flex-col items-center justify-center min-w-[72px]"
      style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
    >
      <span className="text-t12 leading-tight" style={{ color: theme.textMuted }}>{label}</span>
      <span className="font-mono font-black text-xs mt-0.5" style={{ color: theme.textDark }}>{value}</span>
    </div>
  );

  const renderEntry = (entry) => {
    const meta = LOG_KINDS[entry.kind] || { label: entry.kind, icon: 'GiQuillInk' };
    return (
      <div
        key={entry.id}
        className="rounded border p-2.5 flex gap-2.5"
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
      >
        <span
          className="w-7 h-7 rounded border flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.accent }}
        >
          <GameIcon name={meta.icon} size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <JRPGBadge variant={theme.badgeVariant} size="xs">{meta.label}</JRPGBadge>
            <span className="text-xs font-bold break-words" style={{ color: theme.textDark }}>
              {entry.title}
            </span>
          </div>
          {entry.changes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {entry.changes.map((c) => (
                <span
                  key={c.field}
                  className="text-t10 font-mono px-1.5 py-0.5 rounded border"
                  style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
                >
                  {formatChange(c)}
                </span>
              ))}
            </div>
          )}
          {entry.note && (
            <p className="text-t10 mt-1 leading-relaxed" style={{ color: theme.textMuted }}>
              {entry.note}
            </p>
          )}
        </div>
        <span className="text-t10 font-mono shrink-0 mt-0.5" style={{ color: theme.textMuted }}>
          {formatLogTime(entry.at)}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 摘要：全部由 changes 推導，不另存統計欄位 */}
      <div className="flex flex-wrap gap-1.5">
        {tile('條目', summary.count)}
        {sessionTotal > 0 && tile('已分場', sessionTotal)}
        {tile('累計 EXP', summary.expGained >= 0 ? `+${summary.expGained}` : summary.expGained)}
        {tile('資金增減', summary.zenitDelta >= 0 ? `+${summary.zenitDelta}z` : `${summary.zenitDelta}z`)}
        {tile('升級次數', summary.levelUpCount)}
        {tile('換裝次數', summary.equipmentCount)}
      </div>

      {/* 這張卡走了多遠（P4，2026-10-30）：全部由既有資料推導，玩家不用填任何東西。
          只畫已達成的——未達成的排成一列就會變成待辦清單，而那是另一種東西。 */}
      <div
        className="rounded border px-2.5 py-2 flex flex-col gap-1.5"
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        data-testid="log-milestones"
      >
        <div className="flex items-center gap-2">
          <GiLaurelCrown className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
          <span className="text-t11 font-bold" style={{ color: theme.textDark }}>這張卡走了多遠</span>
          <span className="text-t10 font-mono" style={{ color: theme.accent }}>{milestoneCountText(milestones)}</span>
          <span className="flex-1 border-t" style={{ borderColor: theme.border }} />
        </div>
        {milestones.achieved.length === 0 ? (
          <p className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
            還沒有任何里程碑。第一條羈絆、第一個完成的命刻、走過第一場——任何一個都會點亮第一顆；
            這裡只記錄，不影響任何數值。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {milestones.achieved.map((m) => (
              <span
                key={m.id}
                title={m.hint}
                className="text-t10 font-bold px-1.5 py-0.5 rounded border"
                style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 玩家自己補一筆 */}
      <div
        className="rounded border p-2.5 flex flex-col sm:flex-row gap-2"
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
      >
        <input
          type="text"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
          placeholder="寫下一筆記錄（場外協議、劇情里程碑、GM 發放的獎勵…）"
          className="flex-1 min-w-0 rounded px-2.5 py-2 text-xs outline-none border"
          style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textDark }}
        />
        <div className="flex gap-2 items-center">
          <input
            type="datetime-local"
            value={draftAt}
            onChange={(e) => setDraftAt(e.target.value)}
            className="rounded px-2 py-2 text-t11 outline-none border font-mono"
            style={{ backgroundColor: theme.panelBg, borderColor: theme.border, color: theme.textMuted }}
          />
          <JRPGButton
            variant="primary"
            size="sm"
            icon={GiQuillInk}
            onClick={handleAddNote}
            className="shrink-0 min-h-[36px]"
          >
            新增記錄
          </JRPGButton>
        </div>
      </div>

      {/* 種類篩選（只列出實際出現過的） */}
      {presentKinds.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {[FILTER_ALL, ...presentKinds].map((k) => {
            const active = kindFilter === k;
            const meta = LOG_KINDS[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className="text-t11 px-2 py-1 rounded border font-bold cursor-pointer transition-all"
                style={{
                  backgroundColor: active ? theme.accent : theme.panelBg,
                  borderColor: theme.border,
                  color: active ? '#fffdf9' : theme.textDark
                }}
              >
                {meta ? meta.label : k}
              </button>
            );
          })}
        </div>
      )}

      {/* 履歷本體 */}
      {visible.length === 0 ? (
        <EmptyState
          kind="character-log"
          icon={GiQuillInk}
          title="這名角色還沒有任何記錄"
          teach="跑團時 HP／MP／IP／物語點／EXP／資金的變動、升級與換裝都會自動寫進來；第一次變動之後這裡就會有內容。"
        />
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[52vh] overflow-y-auto pr-0.5">
          {showSessionHeaders ? (
            groups.map((group) => (
              <div key={group.number === null ? 'unfiled' : `s${group.number}`} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 pt-1.5 first:pt-0">
                  <GiScrollUnfurled
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: group.number === null ? theme.textMuted : theme.accent }}
                  />
                  <span className="text-t11 font-bold shrink-0" style={{ color: theme.textDark }}>
                    {group.number === null ? '未分場' : `第 ${group.number} 場`}
                  </span>
                  <span className="text-t10 shrink-0" style={{ color: theme.textMuted }}>
                    {group.firstAt ? formatLogDate(group.firstAt) : ''}
                    {group.lastAt && formatLogDate(group.lastAt) !== formatLogDate(group.firstAt)
                      ? ` ～ ${formatLogDate(group.lastAt)}`
                      : ''}
                  </span>
                  <span className="text-t10 shrink-0" style={{ color: theme.textMuted }}>
                    {group.entries.length} 筆
                  </span>
                  <span className="flex-1 border-t" style={{ borderColor: theme.border }} />
                </div>
                {group.entries.map(renderEntry)}
              </div>
            ))
          ) : (
            visible.map(renderEntry)
          )}
        </div>
      )}

      {summary.count > 0 && (
        <p className="text-t12 flex items-center gap-1.5" style={{ color: theme.textMuted }}>
          <GiHazardSign size={11} className="shrink-0" />
          記錄只增不改；同一欄位的連續變動在時窗內會合併成一筆，避免跑團時留下大量碎記錄。
        </p>
      )}
    </div>
  );
}

export default function CharacterLogModal({ isOpen, onClose, theme, character, onChange, showToast = null }) {
  if (!character) return null;
  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title={`成長履歷 · ${character.name || '冒險者'}`}
      maxWidth="max-w-3xl"
      theme={theme}
    >
      <CharacterLogBody
        theme={theme}
        character={character}
        onChange={onChange}
        showToast={showToast}
      />
    </JRPGModal>
  );
}
