/**
 * 營地活動區塊（CAMP ACTIVITIES）—— 自然奇幻手冊 p.130–133 的選用規則。
 *
 * ## 兩種模式，同一份資料
 *
 * - `mode="edit"`：建角第 5 步。從 15 種裡選 2 種（金手指【老大哥／歐尼醬】是 3 種）。
 * - `mode="play"`：跑團面板的休息區塊。標記「本次休息已使用」，休息時整批回充。
 *
 * 兩者共用 `character.campActivities` 與 `data/campActivities.js` 的純函式。
 * **刻意不做成兩個元件**：它們讀寫同一份資料，拆開之後「編輯端能選的」與
 * 「跑團端認得的」遲早會分歧（同 `ZeroPowerBlock` 檔頭的理由）。
 *
 * ## 為什麼 15 種全部攤開，而不是下拉
 *
 * 活動名稱幾乎不帶資訊（【探索】與【採集】聽起來都是「找東西」），而**目標**是選的時候
 * 就必須知道的東西（自身／一個盟友／擁有美食家職業的角色）。一個 `<select>` 只能顯示名字，
 * 玩家選完才知道目標是誰——那等於選錯一次再改一次。所以是 15 張小卡：名稱＋目標＋
 * 一句話摘要，選中之後下面再展開規則全文與 1d6 表格。
 *
 * ## 上限滿了要**說出來**，不是安靜不理
 *
 * `toggleCampActivity` 在已達上限時原樣回傳（純函式不彈窗），這裡比對「選取數沒變」
 * 就知道是「滿了」，於是給一次 toast。安靜不理會讓玩家以為按壞了。
 */
import React from 'react';
import { GiCampfire } from 'react-icons/gi';
import {
  CAMP_ACTIVITIES,
  CAMP_ACTIVITY_BASE_COUNT,
  CAMP_ACTIVITY_SOURCE,
  campActivityById,
  campActivityTargetLabel,
  normalizeCampActivities,
  resetCampActivityUses,
  setCampActivityUsed,
  toggleCampActivity
} from '../data/campActivities';

/** 一張可選的活動卡（名稱＋目標＋一句話）。 */
function ActivityChip({ activity, active, theme, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-left rounded border px-2.5 py-1.5 transition-all cursor-pointer"
      style={{
        backgroundColor: active ? (theme.accentSoft || theme.subpanelBg) : theme.cardBg,
        borderColor: active ? theme.accent : theme.border,
        color: theme.textDark
      }}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-serif font-black text-xs">
          {active ? '✓ ' : ''}{activity.name}
        </span>
        <span className="text-t10 shrink-0" style={{ color: theme.textMuted }}>
          {campActivityTargetLabel(activity)}
        </span>
      </span>
      <span className="block text-t10 leading-tight" style={{ color: theme.textMuted }}>
        {activity.summary}
      </span>
    </button>
  );
}

/** 規則全文（含 1d6 表格）。 */
function ActivityDetail({ activity, theme, onRemove, used, onToggleUsed, showUsage = false }) {
  return (
    <div
      className="rounded border p-3 space-y-1.5"
      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="font-serif font-black text-sm" style={{ color: theme.textDark }}>
            {activity.name}
          </span>
          <span className="text-t10 ml-1.5" style={{ color: theme.textMuted }}>
            {campActivityTargetLabel(activity)}・{activity.page}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {showUsage && activity.once ? (
            <button
              type="button"
              onClick={onToggleUsed}
              className="text-t11 px-2 py-0.5 rounded border cursor-pointer"
              style={{
                backgroundColor: used ? (theme.accentSoft || theme.cardBg) : theme.cardBg,
                borderColor: used ? theme.accent : theme.border,
                color: used ? theme.accent : theme.textMuted
              }}
            >
              {used ? '本次休息已使用' : '標記使用'}
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="text-t11 cursor-pointer"
              style={{ color: theme.textMuted }}
            >
              移除
            </button>
          ) : null}
        </span>
      </div>

      <p className="text-t11 leading-relaxed" style={{ color: theme.textDark }}>
        {activity.desc}
      </p>

      {activity.table ? (
        <div className="space-y-0.5">
          {activity.table.map((row) => (
            <div key={row.roll} className="flex items-start gap-1.5">
              <span
                className="text-t10 font-mono font-bold shrink-0 px-1 rounded border"
                style={{ borderColor: theme.border, color: theme.textMuted, backgroundColor: theme.cardBg }}
              >
                {row.roll}
              </span>
              <span className="text-t11 leading-relaxed" style={{ color: theme.textDark }}>
                {row.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {activity.once ? (
        <p className="text-t12" style={{ color: theme.textMuted }}>
          直到下一次休息前限一次。
        </p>
      ) : null}
    </div>
  );
}

export default function CampActivitiesBlock({
  character,
  theme = {},
  mode = 'edit',
  allowance = CAMP_ACTIVITY_BASE_COUNT,
  quirkGrant = false,
  onChange,
  showToast
}) {
  const state = normalizeCampActivities(character && character.campActivities);
  const picked = state.picked.map((id) => campActivityById(id)).filter(Boolean);

  const commit = (next) => {
    if (typeof onChange === 'function') onChange(next);
  };

  const toggle = (id) => {
    const next = toggleCampActivity(state, id, allowance);
    // 已達上限時 `toggleCampActivity` 原樣回傳 → 選取數不變且不是「取消選取」。
    if (!state.picked.includes(id) && next.picked.length === state.picked.length) {
      if (typeof showToast === 'function') showToast(`最多只能選 ${allowance} 種營地活動`);
      return;
    }
    commit(next);
  };

  // ───────────────────────────────────────────── 跑團模式
  if (mode === 'play') {
    return (
      <div
        className="rounded border p-3 space-y-2.5"
        style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }}
        data-testid="camp-activities-play"
      >
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="font-serif font-black text-sm flex items-center gap-1.5" style={{ color: theme.textDark }}>
            <GiCampfire className="w-4 h-4" style={{ color: theme.accent }} />
            營地活動
          </span>
          <span className="text-t10" style={{ color: theme.textMuted }}>{CAMP_ACTIVITY_SOURCE}</span>
        </div>

        {picked.length === 0 ? (
          <p className="text-t12" style={{ color: theme.textMuted }}>
            尚未在創角時選擇營地活動——請在角色編輯第 5 步選 {allowance} 種。
          </p>
        ) : (
          <>
            <p className="text-t12 leading-relaxed" style={{ color: theme.textDark }}>
              休息場景中，你可以進行其中一種，並把效益套用到該活動的目標上。沒有進行活動也照樣可以調整羈絆。
            </p>
            <div className="space-y-2">
              {picked.map((activity) => (
                <ActivityDetail
                  key={activity.id}
                  activity={activity}
                  theme={theme}
                  showUsage
                  used={state.used.includes(activity.id)}
                  onToggleUsed={() => commit(setCampActivityUsed(state, activity.id, !state.used.includes(activity.id)))}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => commit(resetCampActivityUses(state))}
              disabled={state.used.length === 0}
              className="text-t11 px-2.5 py-1 rounded border cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
            >
              下一次休息（清空已使用）
            </button>
          </>
        )}
      </div>
    );
  }

  // ───────────────────────────────────────────── 建角模式
  return (
    <div className="space-y-2" data-testid="camp-activities-block">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.textDark }}>
          <GiCampfire className="w-4 h-4" style={{ color: theme.accent }} />
          營地活動
        </label>
        <span className="text-t10" style={{ color: theme.textMuted }}>
          已選 {state.picked.length}／{allowance} 種・{CAMP_ACTIVITY_SOURCE}
        </span>
      </div>

      <p className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
        原書 p.130：使用這條選用規則時，每個玩家角色在創角時選 {CAMP_ACTIVITY_BASE_COUNT} 種不同的營地活動，
        之後每次休息場景可以進行其中一種。
        {quirkGrant ? '金手指【老大哥／歐尼醬】讓你多選一種。' : ''}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {CAMP_ACTIVITIES.map((activity) => (
          <ActivityChip
            key={activity.id}
            activity={activity}
            active={state.picked.includes(activity.id)}
            theme={theme}
            onClick={() => toggle(activity.id)}
          />
        ))}
      </div>

      {picked.length > 0 ? (
        <div className="space-y-2">
          {picked.map((activity) => (
            <ActivityDetail
              key={activity.id}
              activity={activity}
              theme={theme}
              onRemove={() => commit(toggleCampActivity(state, activity.id, allowance))}
            />
          ))}
        </div>
      ) : (
        <p className="text-t12" style={{ color: theme.textMuted }}>
          尚未選擇。上面的 15 張卡片點一下就會選取，選滿 {allowance} 種為止。
        </p>
      )}
    </div>
  );
}
