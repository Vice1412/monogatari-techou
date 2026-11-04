/**
 * 效果流程的操作控件（跑團卡上用）—— `IMPL-SPEC.md` §3。
 * ────────────────────────────────────────────────────────────────
 * 這裡只做**呈現**：資料從 `item.control` 讀，狀態從 `state` 讀，
 * 使用者的動作原封不動往上丟（`onAdjust`／`onReset`／`onToggle`／`onAct`）。
 * 不 import 任何讀寫 localStorage 的東西——跑團卡最怕的就是「點一下畫面就偷偷存檔」，
 * 存檔時機應該只有 Lead 的 HUD 一處（單一寫入點）。
 *
 * ## 為什麼上限算式要 import `evaluateControlValue`，不在這裡自己 `eval`
 *
 * `control.max` 在 373 筆裡長成 `"SL + 1"`、`"等級/2 + 鷹眼SL × 5"`、`"無上限（每次傷害 +1）"` 等
 * 各種形狀。算式的**唯一事實來源**必須是 `utils/effectFlow.js`——若這裡另寫一份，
 * 玩家看到的「上限」與引擎實際夾住的「上限」遲早會不一致，而那種 bug 只有玩家數到第 N 次
 * 才發現（引擎說滿了、畫面還讓他按）。同一個算式只能有一份實作。
 *
 * ## 為什麼「達上限」是 disabled ＋寫著原因，而不是「按了沒反應」
 *
 * 安靜不理會讓玩家以為**按鈕壞了**或**自己點歪了**；顏色變淡只有滑鼠看得到，
 * 觸控與鍵盤使用者完全收不到訊息。所以：`disabled` 給輔助技術、`title` 給滑鼠、
 * 另外再寫一行可見的小字給所有人（見 `button` 的成本不足）。
 *
 * ## 顏色
 *
 * 一律從 `theme` 取（`textDark`／`textMuted`／`accent`／`border`／`cardBg`／`subpanelBg`），
 * 缺欄才退回羊皮紙票色——`theme` 是執行期物件，Tailwind 掃不到 `text-[${hex}]` 這種模板字串，
 * 所以顏色走 `style`，結構與字級走 `className`（字級只能用 `text-t10`…`text-t39`）。
 */
import React from 'react';
import { evaluateControlValue } from '../utils/effectFlow';

/** 主題缺欄時的票色退回（與 ClassResourceStrip／HudWindow 同一組羊皮紙階）。 */
const FALLBACK = {
  textDark: '#3c2415',
  textMuted: '#6b5a4b',
  accent: '#a63d40',
  border: '#d6c7ab',
  cardBg: '#fff',
  // `subpanelBg` 是計數器的凹槽底色：退回純白會與卡片底同色，
  // 分層直接消失（Engraved 就變成 Flat），所以退回既有票色 `#f4ebd9`。
  subpanelBg: '#f4ebd9'
};

/**
 * 重置時機 → 中文按鈕文案。
 *
 * 規格只列了 `scene`／`round`／`rest`／`hpZero`／`none`，但實際資料**多出兩種**
 * （`class:靈能者:認知焦點` 是 `turn`、`heroic:卡片先導者` 與 `heroic:收割行者` 是 `conflict`），
 * 而且很多 `button`／`toggle` 根本沒有 `reset` 欄。少了對照表會把英文原字印在畫面上
 * （違反純中文鐵律），所以這裡補齊並給一個安全的中文退回值。
 */
const RESET_LABELS = {
  scene: '場景結束',
  round: '回合結束',
  turn: '回合結束',
  conflict: '衝突結束',
  rest: '休息',
  hpZero: 'HP 歸零',
  // 【偷來的載具】【老載具】的額度是「每個章節限一次」（原書 once per chapter，
  // 通常指一次四小時的聚會）。章節既不是場景也不是休息——借用任何一個，
  // 玩家都會在一場聚會裡被重置兩次（而且不會有人發現）。
  chapter: '章節結束'
};

const pickTheme = (theme) => {
  const src = theme || {};
  return {
    textDark: src.textDark || FALLBACK.textDark,
    textMuted: src.textMuted || FALLBACK.textMuted,
    accent: src.accent || FALLBACK.accent,
    border: src.border || FALLBACK.border,
    cardBg: src.cardBg || FALLBACK.cardBg,
    subpanelBg: src.subpanelBg || FALLBACK.subpanelBg
  };
};

const noop = () => {};

/** 重置鈕該不該出現、要寫什麼。`none`／沒有這個欄位 → 不畫。 */
const resetLabelOf = (control) => {
  const key = control && control.reset;
  if (!key || key === 'none') return '';
  return RESET_LABELS[key] || '重置';
};

/** `−` `值 / 上限` `+` ＋（有 reset 時）重置鈕。 */
function CounterControl({ control, item, sl, level, vars, state, theme, testId, onAdjust, onReset }) {
  const n = Number.isFinite(state.n) ? state.n : 0;
  // 算式不合法／除不盡時 `evaluateControlValue` 回 `null`——那是「沒有上限」，不是「上限 0」。
  // 當成 0 會讓整顆 `+` 永遠 disabled，玩家連第一次都用不了。
  const max = control.max ? evaluateControlValue(control.max, { sl, level, vars }) : null;
  const hasMax = typeof max === 'number' && Number.isFinite(max);
  const atMax = hasMax && n >= max;
  const atMin = n <= 0;
  const resetLabel = resetLabelOf(control);
  const name = item.name || control.label || '';

  const btnBase =
    'w-6 h-6 rounded border text-t14 leading-none font-bold transition-colors duration-120';

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-2 flex-wrap p-2 rounded border"
      style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }}
      title={control.max ? `上限：${control.max}${hasMax ? `（目前 SL ${sl}／等級 ${level} → ${max}）` : ''}` : undefined}
    >
      {control.label ? (
        <span className="text-t12 font-bold min-w-[5.5rem]" style={{ color: theme.textDark }}>
          {control.label}
        </span>
      ) : null}

      <button
        type="button"
        data-testid={`${testId}-minus`}
        disabled={atMin}
        // 減到 0 還按得下去只是白按；講清楚「已經 0」才不會被當成壞掉。
        title={atMin ? `${name}已是最低（0）` : `減少 1 點【${name}】`}
        onClick={() => onAdjust(-1)}
        className={btnBase}
        style={
          atMin
            ? { borderColor: theme.border, color: theme.border, cursor: 'not-allowed' }
            : { borderColor: theme.border, color: theme.textDark, backgroundColor: theme.cardBg, cursor: 'pointer' }
        }
      >
        −
      </button>

      {/* `font-mono` 是設計系統的全域預算項（它給數值與程式碼用），這裡不加一筆預算：
          等寬數字靠 `tabular-nums`，加減時數字不會左右跳。 */}
      <span
        data-testid={`${testId}-value`}
        className="text-t14 font-black min-w-[3rem] text-center tabular-nums"
        style={{ color: theme.textDark }}
      >
        {n}
        {hasMax ? (
          <span className="text-t11 font-bold" style={{ color: theme.textMuted }}> / {max}</span>
        ) : null}
      </span>

      <button
        type="button"
        data-testid={`${testId}-plus`}
        disabled={atMax}
        // 達上限的 disabled 一定要說原因：不然玩家只看到一顆灰掉的 `+`，
        // 會以為是自己點壞了，而不是「這一場景的額度用完了」。
        title={
          atMax
            ? `${name}已達上限 ${max}${resetLabel ? `，要等「${resetLabel}」才回充` : ''}`
            : `增加 1 點【${name}】`
        }
        onClick={() => onAdjust(1)}
        className={btnBase}
        style={
          atMax
            ? { borderColor: theme.border, color: theme.border, cursor: 'not-allowed' }
            : { borderColor: theme.border, color: theme.textDark, backgroundColor: theme.cardBg, cursor: 'pointer' }
        }
      >
        +
      </button>

      {/* 重置：規則沒有重置時機時不畫——多一顆「沒意義的歸零」等於給玩家一個可以作弊的按鈕。 */}
      {resetLabel ? (
        <button
          type="button"
          data-testid={`${testId}-reset`}
          onClick={() => onReset()}
          title={`${resetLabel}：把【${name}】的計數歸零`}
          className="px-2 py-1 rounded border text-t11 font-bold transition-colors duration-120 cursor-pointer"
          style={{ borderColor: theme.border, color: theme.textMuted, backgroundColor: theme.cardBg }}
        >
          {resetLabel}
        </button>
      ) : null}

      {atMax ? (
        <span className="text-t10 ml-auto" style={{ color: theme.accent }}>已滿</span>
      ) : null}
    </div>
  );
}

/** 一顆 `aria-pressed` 的開關。 */
function ToggleControl({ control, item, state, theme, testId, onToggle }) {
  const on = Boolean(state.on);
  // 文案寫「開著代表什麼」，而不是「開關」——跑團卡上玩家要看的是狀態，不是控件名稱。
  // 少數條目（如 class:守護者:雙重盾牌）label 是空的，退回技能名，否則會出現一顆沒有字的按鈕。
  const text = control.label || item.name || '啟用';
  const resetLabel = resetLabelOf(control);

  return (
    <div data-testid={testId} className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-pressed={on}
        onClick={() => onToggle()}
        // 什麼時候會自己關掉，用 title 說明：規格要求 toggle 只畫一顆開關，
        // 但玩家需要知道這狀態會不會自動清（`reset: scene` 佔最多）。
        title={resetLabel ? `${resetLabel}後自動關閉` : undefined}
        className="rounded border px-2.5 py-1.5 text-left transition-colors duration-120 cursor-pointer"
        style={{
          backgroundColor: on ? theme.subpanelBg : theme.cardBg,
          borderColor: on ? theme.accent : theme.border,
          color: on ? theme.textDark : theme.textMuted
        }}
      >
        {/* 狀態圓點 `●` 取自專案封閉符號詞彙表（GEMINI.md 軌道 3 附錄）——開啟／關閉
            不能只靠底色深淺分辨，那只對看得到顏色的人是消息。固定寬度讓文字不會左右跳。 */}
        <span
          aria-hidden="true"
          className="inline-block w-3 text-center text-t10 font-black"
          style={{ color: on ? theme.accent : theme.border }}
        >
          {on ? '●' : ''}
        </span>
        <span className="text-t12 font-bold">{text}</span>
      </button>
    </div>
  );
}

/** 一顆「選一個」的下拉（第三期：`select`）。 */
function SelectControl({ control, item, state, theme, testId, onChoice }) {
  const options = Array.isArray(control.options) ? control.options : [];
  const value = typeof state.choice === 'string' ? state.choice : '';
  return (
    <div data-testid={testId} className="space-y-1">
      <label className="flex items-center gap-2 flex-wrap">
        <span className="text-t12 font-bold" style={{ color: theme.textDark }}>
          {control.label || item.name || '選擇一項'}
        </span>
        <select
          data-testid={`${testId}-choice`}
          value={value}
          onChange={(e) => onChoice(e.target.value)}
          className="text-t12 rounded border px-2 py-1 outline-none"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
        >
          {/* 空選項不是裝飾：它是「還沒選」。預設選第一個會替玩家做決定，
              而【類別訓練】的選擇是永久的（選錯要重開卡）。 */}
          <option value="">（尚未選擇）</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {!value ? (
        <p className="text-t12 leading-relaxed" style={{ color: theme.accent }}>
          還沒選——選了之後，其他分頁（例如熟練度）才會跟著更新。
        </p>
      ) : null}
    </div>
  );
}

/** 一顆主按鈕 ＋ 一行「按了會怎樣」。 */
function ButtonControl({ control, item, theme, testId, costBlocked, onAct }) {  const blocked = Boolean(costBlocked && costBlocked.blocked);
  const reason = (costBlocked && costBlocked.reason) || '';
  const text = control.label || item.name || '執行';
  const outcome = control.outcome || '';

  return (
    <div data-testid={testId} className="space-y-1">
      <button
        type="button"
        data-testid={`${testId}-act`}
        disabled={blocked}
        // 成本不足：disabled 讓鍵盤與輔助技術都收得到，title 讓滑鼠看得到原因。
        // 只改顏色的差別「只有滑鼠看得到」——而且滑過去才知道為什麼不能按。
        title={blocked ? reason || '成本不足' : outcome || text}
        onClick={() => onAct()}
        className="w-full text-left rounded border px-2.5 py-1.5 font-bold text-t12 transition-colors duration-120"
        style={
          blocked
            ? { borderColor: theme.border, color: theme.textMuted, backgroundColor: theme.subpanelBg, cursor: 'not-allowed' }
            : { borderColor: theme.accent, color: theme.cardBg, backgroundColor: theme.accent, cursor: 'pointer' }
        }
      >
        {text}
      </button>

      {/* 成本不足的原因也要「看得見」，不是只有 hover 才有——所以除了 title 再寫一行。 */}
      {blocked ? (
        <p className="text-t12 leading-relaxed" style={{ color: theme.accent }}>{reason || '成本不足，現在不能使用。'}</p>
      ) : null}

      {outcome ? (
        <p data-testid={`${testId}-outcome`} className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
          {outcome}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 三種控件的入口。`kind === 'none'` 回 `null`——不畫空框：
 * 373 筆裡有 116 筆是純敘事條目，畫框會讓「有東西可以按」與「只是說明」長得一樣。
 */
export default function SkillFlowControls({
  item,
  sl = 0,
  level = 1,
  // 額外的算式變數（其他技能的 SL）。不傳＝沿用第一期：含未登記變數的上限算式算不出來，
  // 元件就把上限那一格留空並保留原式（不假裝是「無上限」）。
  vars = null,
  theme,
  state,
  costBlocked,
  onAdjust = noop,
  onReset = noop,
  onToggle = noop,
  onAct = noop,
  onChoice = noop,
  testId
}) {
  if (!item || !item.control) return null;
  const control = item.control;
  if (control.kind === 'none') return null;

  const pal = pickTheme(theme);
  const safeState = {
    n: Number.isFinite(state && state.n) ? state.n : 0,
    on: Boolean(state && state.on)
  };
  // `testId` 是必填（規格），但呼叫端漏傳時用 item.id 撐住，至少不會渲染出 `undefined-plus` 這種 testid。
  const id = testId || `flow-${item.id || 'unknown'}`;

  if (control.kind === 'counter') {
    return (
      <CounterControl
        control={control}
        item={item}
        sl={sl}
        level={level}
        vars={vars}
        state={safeState}
        theme={pal}
        testId={id}
        onAdjust={onAdjust}
        onReset={onReset}
      />
    );
  }

  if (control.kind === 'toggle') {
    return <ToggleControl control={control} item={item} state={safeState} theme={pal} testId={id} onToggle={onToggle} />;
  }

  if (control.kind === 'select') {
    return (
      <SelectControl
        control={control}
        item={item}
        state={safeState}
        theme={pal}
        testId={id}
        onChoice={onChoice}
      />
    );
  }

  if (control.kind === 'button') {
    return (
      <ButtonControl
        control={control}
        item={item}
        theme={pal}
        testId={id}
        costBlocked={costBlocked}
        onAct={onAct}
      />
    );
  }

  // 封閉詞彙以外（資料寫壞）→ 不畫，也不丟例外：跑團卡上一顆壞掉的控件不該讓整張卡當掉。
  return null;
}
