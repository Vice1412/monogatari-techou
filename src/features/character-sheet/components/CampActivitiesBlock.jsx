/**
 * 營地活動區塊（CAMP ACTIVITIES）—— 自然奇幻手冊 p.130–133 的選用規則。
 *
 * ## 兩種模式，同一份資料
 *
 * - `mode="edit"`：建角第 5 步。從 15 種裡選 2 種（金手指【老大哥／歐尼醬】是 3 種）。
 * - `mode="play"`：跑團面板的休息區塊。標記「本次休息已使用」，休息時整批回充；
 *   2026-11-03 起再加上「擲 d6 → 套用」（`IMPL-SPEC.md` §4）。
 *
 * ## 跑團模式為什麼是「回呼出去」而不是自己寫
 *
 * 這一塊拿得到 `character`，但它**不寫** `character`：
 * 套用會動到 IP／資金／食材／造物專案／履歷，那是跑團面板（`CharacterPlayHUD`）的職權
 * ——它才有 `adjustIp`、`updateField`、`applyMoneyFlow` 那一套單一寫入出口。
 * 所以這裡只算 plan，交給 `onApply(plan)`；沒接線時明確顯示「套用入口尚未接上」，
 * 而不是畫一顆按了沒反應的按鈕（那種按鈕會被當成 bug 回報，卻查不到東西）。
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
  campActivityModeNote,
  campActivityTargetLabel,
  normalizeCampActivities,
  resetCampActivityUses,
  setCampActivityUsed,
  toggleCampActivity
} from '../data/campActivities';
import { resolveCreationRules } from '../data/creationRules';
import { TASTE_ROLL } from '../data/gourmetData';
import CopyTextButton from '../../../components/ui/CopyTextButton';
import { formatCampActivityCopyText } from '../utils/playCopyFormat';
import {
  campActivityRollLabel,
  describeCampOutcome,
  planCampActivity,
  rollCampResult
} from '../utils/campOutcome';

/** 一張可選的活動卡（名稱＋目標＋一句話）。 */
function ActivityChip({ activity, active, theme, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-left rounded border px-2.5 py-1.5 transition-all cursor-pointer"
      style={{
        backgroundColor: active ? (theme.subpanelBg) : theme.cardBg,
        borderColor: active ? theme.accent : theme.border,
        color: theme.textDark
      }}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-serif font-black text-t14">
          {active ? '✓ ' : ''}{activity.name}
        </span>
        <span className="text-t11 shrink-0" style={{ color: theme.textMuted }}>
          {campActivityTargetLabel(activity)}
        </span>
      </span>
      <span className="block text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
        {activity.summary}
      </span>
    </button>
  );
}

/** 規則全文（含 1d6 表格）。 */
function ActivityDetail({ activity, theme, onRemove, used, onToggleUsed, showUsage = false, modeNote = '', characterName = '', showToast = null, action = null }) {
  return (
    <div
      className="rounded border p-3 space-y-1.5"
      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="font-serif font-black text-t16" style={{ color: theme.textDark }}>
            {activity.name}
          </span>
          <span className="text-t11 ml-1.5" style={{ color: theme.textMuted }}>
            {campActivityTargetLabel(activity)}・{activity.page}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {showUsage && activity.once ? (
            <button
              type="button"
              onClick={onToggleUsed}
              className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
              style={{
                backgroundColor: theme.cardBg,
                borderColor: used ? theme.accent : theme.border,
                color: used ? theme.accent : theme.textMuted
              }}
            >
              {used ? '本次休息已使用' : '標記使用'}
            </button>
          ) : null}
          <CopyTextButton
            getText={() =>
              formatCampActivityCopyText({
                name: activity.name,
                targetLabel: campActivityTargetLabel(activity),
                page: activity.page,
                desc: activity.desc,
                table: activity.table,
                once: activity.once,
                used: Boolean(used),
                characterName
              })
            }
            toastLabel={`營地活動【${activity.name}】`}
            showToast={showToast}
            testId={`copy-camp-${activity.id}`}
          />
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="text-t12 cursor-pointer"
              style={{ color: theme.textMuted }}
            >
              移除
            </button>
          ) : null}
        </span>
      </div>

      <p className="text-t14 leading-relaxed" style={{ color: theme.textDark }}>
        {activity.desc}
      </p>

      {/* F-014（2026-10-27）：兩份官方文件同時開啟時的碰撞，要在**選這個活動的當下**就講，
          而不是等到露營時 GM 說「這團沒有武器表」。 */}
      {modeNote ? (
        <p
          data-testid={`camp-mode-note-${activity.id}`}
          className="text-t12 leading-relaxed rounded border-l-2 pl-2 py-1"
          style={{ color: theme.textDark, borderColor: theme.accent, backgroundColor: theme.cardBg }}
        >
          {modeNote}
        </p>
      ) : null}

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
              <span className="text-t14 leading-relaxed" style={{ color: theme.textDark }}>
                {row.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {activity.once ? (
        <p className="text-t14" style={{ color: theme.textMuted }}>
          直到下一次休息前限一次。
        </p>
      ) : null}

      {/* 跑團模式的「擲 d6 → 套用」。建角模式不傳 `action`，所以那裡逐字不變
          （建角流程有護欄在測它：`tests/campActivities.test.mjs` 的 I 段）。 */}
      {action}
    </div>
  );
}

/**
 * 跑團模式的操作列：擲 d6 → 看結果 → 套用。
 *
 * 三條原則：
 * 1. **不在這裡寫角色**。這一支只把 `planCampActivity` 算出來的 plan 交給 `onApply`；
 *    寫入與履歷是跑團面板的事（同一份資料在建角流程也用到，兩邊各寫一次遲早會分歧）。
 * 2. **算不出來的東西要看得到**：`plan.manual` 逐條列在按鈕下方。
 *    只給一句 toast 的話，玩家按完就忘了「+4 要自己加」——而那正是這一期的重點。
 * 3. 骰子用 `Math.floor(Math.random() * 6) + 1`（與 `GourmetCookbook` 擲口味同一個寫法）。
 *    **刻意不開擲骰器 modal**：那是跑團面板的 `onOpenDice`，不在這一塊的職權內；
 *    而且這裡的 d6 只有一個用途（查表），開了反而多一層。
 */
function CampActivityAction({ activity, character, stats, theme, onApply, showToast }) {
  const [rolled, setRolled] = React.useState(null);
  const [tasteRolls, setTasteRolls] = React.useState(null);
  const [projectId, setProjectId] = React.useState('');
  const [plan, setPlan] = React.useState(null);

  const hasTable = Array.isArray(activity.table);
  const wired = typeof onApply === 'function';

  // 還沒有骰值時（且沒有 table）就先看唯一那一筆後果，才知道要不要顯示口味／專案的選擇器。
  const effects = hasTable
    ? ((rolled && rolled.result && rolled.result.effects) || {})
    : ((Array.isArray(activity.outcomes) && activity.outcomes[0] && activity.outcomes[0].effects) || {});

  const tasteCount = Math.max(0, Math.trunc(Number(effects.ingredients && effects.ingredients.count) || 0));
  const needsTaste = tasteCount > 0 && (effects.ingredients.flavor !== 'choose');
  const needsProject = Boolean(effects.projectProgress);
  const openProjects = (Array.isArray(character && character.tinkererData && character.tinkererData.projects)
    ? character.tinkererData.projects
    : []).filter((project) => project && !project.completed);

  const toast = (message, type) => {
    if (typeof showToast === 'function' && message) showToast(message, type);
  };

  const rollDie = () => {
    const d6 = Math.floor(Math.random() * 6) + 1;
    setRolled({ d6, result: rollCampResult(activity, d6) });
    // 骰值換了，口味與上一次的結果都作廢——留著會讓「骰 6 卻套用了骰 2 的口味」。
    setTasteRolls(null);
    setPlan(null);
  };

  const rollTastes = () => {
    setTasteRolls(Array.from({ length: tasteCount }, () => Math.floor(Math.random() * 6) + 1));
    setPlan(null);
  };

  const apply = () => {
    const options = { stats };
    if (hasTable) options.d6 = rolled ? rolled.d6 : null;
    if (Array.isArray(tasteRolls)) options.tasteRolls = tasteRolls;
    if (needsProject && projectId) options.target = projectId;

    const next = planCampActivity(character, activity, options);
    setPlan(next);
    if (!next.ok) {
      toast(next.toast || next.reason, 'warning');
      return;
    }
    onApply(next);
    toast(describeCampOutcome(next), 'success');
  };

  // 沒有接 `onApply` 時不要畫出一顆按了沒反應的按鈕——那比不畫更糟。
  if (!wired) {
    return (
      <p data-testid={`camp-apply-unwired-${activity.id}`} className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
        套用入口尚未接上（跑團面板要傳入 onApply）。
      </p>
    );
  }

  return (
    <div className="space-y-1.5" data-testid={`camp-action-${activity.id}`}>
      {hasTable ? (
        <div className="flex items-start gap-2 flex-wrap">
          <button
            type="button"
            onClick={rollDie}
            data-testid={`camp-roll-${activity.id}`}
            className="text-t12 px-2.5 py-0.5 rounded border cursor-pointer shrink-0"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
          >
            {rolled ? '再骰一次 d6' : '擲 d6'}
          </button>
          {rolled && rolled.result ? (
            <span
              data-testid={`camp-roll-result-${activity.id}`}
              className="text-t12 leading-relaxed"
              style={{ color: theme.textDark }}
            >
              <span className="font-bold">{campActivityRollLabel(activity, { ...rolled.result, d6: rolled.d6 })}</span>
              <span className="block" style={{ color: theme.textMuted }}>{rolled.result.text}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 採集：口味是「各再骰 d6」。骰到 6 代表由玩家決定，一律不代填（→ manual）。 */}
      {hasTable && rolled && needsTaste ? (
        <div className="flex items-start gap-2 flex-wrap">
          <button
            type="button"
            onClick={rollTastes}
            data-testid={`camp-taste-${activity.id}`}
            className="text-t12 px-2.5 py-0.5 rounded border cursor-pointer shrink-0"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
          >
            骰 {tasteCount} 份口味
          </button>
          {Array.isArray(tasteRolls) ? (
            <span
              data-testid={`camp-taste-result-${activity.id}`}
              className="text-t12 leading-relaxed"
              style={{ color: theme.textDark }}
            >
              {tasteRolls.map((roll, index) => `${index + 1}. ${TASTE_ROLL[roll] || '由你決定'}`).join('　')}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 抱佛腳：3 點進度要指定一個專案才算得出來（否則只能列清單請玩家自己做）。 */}
      {needsProject && openProjects.length > 0 ? (
        <label className="flex items-center gap-1.5 text-t12" style={{ color: theme.textDark }}>
          <span className="shrink-0">造物專案</span>
          <select
            value={projectId}
            onChange={(event) => { setProjectId(event.target.value); setPlan(null); }}
            data-testid={`camp-project-${activity.id}`}
            className="text-t12 rounded border px-1.5 py-0.5"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
          >
            <option value="">（請選擇）</option>
            {openProjects.map((project) => (
              <option key={project.id} value={project.id}>{project.name || project.id}</option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="button"
        onClick={apply}
        data-testid={`camp-apply-${activity.id}`}
        disabled={hasTable && !rolled}
        className="text-t12 px-2.5 py-1 rounded border cursor-pointer font-bold disabled:opacity-40 disabled:pointer-events-none"
        style={{ backgroundColor: theme.cardBg, borderColor: theme.accent, color: theme.accent }}
      >
        {hasTable ? '套用' : (activity.once ? '使用（本次休息一次）' : '使用')}
      </button>

      {plan && plan.ok ? (
        <div className="space-y-1">
          {plan.applied.length > 0 ? (
            <p className="text-t12 leading-relaxed" style={{ color: theme.textDark }} data-testid={`camp-applied-${activity.id}`}>
              {plan.applied.map((item) => item.text).join('；')}
            </p>
          ) : null}
          {plan.manual.length > 0 ? (
            <ul className="space-y-0.5" data-testid={`camp-manual-${activity.id}`}>
              {plan.manual.map((line, index) => (
                <li key={`${index}-${line.slice(0, 8)}`} className="text-t12 leading-relaxed" style={{ color: theme.textDark }}>
                  <span style={{ color: theme.accent }}>△ </span>
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {plan.applied.length === 0 && plan.manual.length === 0 ? (
            <p className="text-t12" style={{ color: theme.textMuted }}>已記錄在履歷。</p>
          ) : null}
        </div>
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
  showToast,
  // 跑團模式新增（2026-11-03）：`onApply(plan)` 由跑團面板接線，`stats` 用來算 IP 上限。
  // 建角模式不傳這兩個屬性，行為逐字不變。
  onApply = null,
  stats = null
}) {
  const state = normalizeCampActivities(character && character.campActivities);
  const picked = state.picked.map((id) => campActivityById(id)).filter(Boolean);
  // 這團的魔晶石模式——「營地打造」的「基礎武器／盾牌」在裝備受限的模式下不存在（F-014）。
  const techMode = resolveCreationRules(character && character.creationRules).technospheres;

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
          <span className="font-serif font-black text-t16 flex items-center gap-1.5" style={{ color: theme.textDark }}>
            <GiCampfire className="w-4 h-4" style={{ color: theme.accent }} />
            營地活動
          </span>
          <span className="text-t10" style={{ color: theme.textMuted }}>{CAMP_ACTIVITY_SOURCE}</span>
        </div>

        {picked.length === 0 ? (
          <p className="text-t14" style={{ color: theme.textMuted }}>
            尚未在創角時選擇營地活動——請在角色編輯第 5 步選 {allowance} 種。
          </p>
        ) : (
          <>
            <p className="text-t14 leading-relaxed" style={{ color: theme.textDark }}>
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
                  modeNote={campActivityModeNote(activity.id, techMode)}
                  characterName={character && character.name}
                  showToast={showToast}
                  action={(
                    <CampActivityAction
                      activity={activity}
                      character={character}
                      stats={stats}
                      theme={theme}
                      onApply={onApply}
                      showToast={showToast}
                    />
                  )}
                  onToggleUsed={() => commit(setCampActivityUsed(state, activity.id, !state.used.includes(activity.id)))}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => commit(resetCampActivityUses(state))}
              disabled={state.used.length === 0}
              className="text-t12 px-2.5 py-1 rounded border cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
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
        <label className="text-t14 font-bold flex items-center gap-1.5" style={{ color: theme.textDark }}>
          <GiCampfire className="w-4 h-4" style={{ color: theme.accent }} />
          營地活動
        </label>
        <span className="text-t10" style={{ color: theme.textMuted }}>
          已選 {state.picked.length}／{allowance} 種・{CAMP_ACTIVITY_SOURCE}
        </span>
      </div>

      <p className="text-t14 leading-relaxed" style={{ color: theme.textMuted }}>
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
              modeNote={campActivityModeNote(activity.id, techMode)}
              characterName={character && character.name}
              showToast={showToast}
              onRemove={() => commit(toggleCampActivity(state, activity.id, allowance))}
            />
          ))}
        </div>
      ) : (
        <p className="text-t14" style={{ color: theme.textMuted }}>
          尚未選擇。上面的 15 張卡片點一下就會選取，選滿 {allowance} 種為止。
        </p>
      )}
    </div>
  );
}
