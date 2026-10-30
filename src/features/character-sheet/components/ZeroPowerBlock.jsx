/**
 * 底力技區塊（ZERO POWERS）—— 高度奇幻手冊 p.124–131 的選用規則。
 *
 * ## 兩種模式，同一份資料
 *
 * - `mode="edit"`：建角第 5 步。選觸發、選效果、做效果的必要選擇、取名。
 * - `mode="play"`：跑團面板的命刻分頁。推進命刻、施展、清空。
 *
 * 兩者共用 `character.zeroPower` 與 `utils/zeroPower.js` 的純函式。
 * **刻意不做成兩個元件**：它們讀寫同一份資料，拆開之後「編輯端能選的組合」
 * 與「跑團端認得的組合」遲早會分歧——那正是本專案已經吃過幾次的虧
 * （見 AGENTS.md §AW「測試與生產分歧」）。
 *
 * ## 為什麼選項用按鈕而不是下拉
 *
 * 七個觸發、十一個效果，每個都要看得到**填充數量**。一個 `<select>` 只能顯示名字，
 * 玩家選完才知道那個觸發填幾格，還得再改一次。
 *
 * ## 團隊約束已移除（2026-10-21 使用者裁定）
 *
 * 「團隊約束不需要，這個工作交給 GM 來審卡，而非開卡時的硬性規定。」
 * 所以這裡**不再**把隊友已選的觸發／效果灰掉——那會讓兩個獨立建角的玩家互相卡住，
 * 而且原文的「不得重複」本來就是桌上約定，不是角色卡驗證能代替的判斷。
 *
 * ## 兩個「看不懂規則」的補救（2026-10-21 續）
 *
 * ① 觸發的名字幾乎不帶資訊（【連續】【戰略】【協同】聽起來都像「打得順」），
 *    所以觸發與效果的標題列各有一顆「看敘述」按鈕 → `ZeroPowerGlossaryModal`。
 *    **不是**在 chip 上放 tooltip：手機沒有 hover，而且一次只能看一個。
 * ② 選齊之後，最下面出現 `ShowcaseCard`——把名稱、觸發、效果全文、施展條件
 *    收成一張「一看就知道是大招」的卡。在那之前這裡只有幾個長得一樣的淡框，
 *    讀起來像「又一個填完的欄位」，而不是「衝突中只能開一次的東西」。
 */
import React, { useState } from 'react';
import { GiSparkles, GiPocketWatch, GiRollingDices, GiScrollUnfurled, GiSpellBook } from 'react-icons/gi';
import JRPGButton from '../../../components/ui/JRPGButton';
import { JRPGInput } from '../../../components/ui/JRPGInput';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';
import {
  ZERO_TRIGGERS,
  ZERO_EFFECTS,
  ZERO_DAMAGE_TYPES,
  ZERO_STATUS_EFFECTS,
  ZERO_VARIANTS,
  ZERO_POWER_SOURCE,
  zeroEffectById,
  zeroTriggerById,
  rollZeroPowerName
} from '../data/zeroPowers';
import ZeroPowerNameTablesModal from './ZeroPowerNameTablesModal';
import ZeroPowerGlossaryModal, { GLOSSARY_TAB_TRIGGER, GLOSSARY_TAB_EFFECT } from './ZeroPowerGlossaryModal';
import {
  normalizeZeroPower,
  zeroClockMax,
  fillZeroClock,
  clearZeroClock,
  isZeroClockFull,
  canUnleashZeroPower,
  unleashZeroPower,
  awakenZeroPower,
  zeroActiveEffectId,
  describeZeroTrigger,
  describeZeroEffect,
  isZeroChoiceComplete
} from '../utils/zeroPower';

/** 小圓角標籤按鈕（觸發與效果共用）。 */
function ChoiceChip({ active, title, subtitle, onClick, theme }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="text-left rounded border px-2.5 py-1.5 transition-all cursor-pointer"
      style={{
        backgroundColor: active ? theme.subpanelBg : theme.cardBg,
        borderColor: active ? theme.accent : theme.border,
        color: theme.textDark
      }}
    >
      <span className="block font-serif font-black text-t14">{title}</span>
      {subtitle ? (
        <span className="block text-t12 leading-snug" style={{ color: theme.textMuted }}>
          {subtitle}
        </span>
      ) : null}
    </button>
  );
}

/**
 * 底力技「完整卡片」—— 選齊觸發與效果之後，這一招長什麼樣。
 *
 * ## 為什麼要有這張卡
 *
 * 使用者原話：「選擇完觸發和效果之後，最下面要有一個完整的底力技效果，
 * 框起來要比較特別點的觀感讓人一看就知道『哇這個是大招』。」
 *
 * 在那之前，選完之後畫面上只有兩塊跟其他欄位長得一模一樣的淡框文字，
 * 讀起來像「又一個填完的欄位」。但底力技是**整場衝突只能開一次的技能動作**，
 * 它值得在視覺上跟一般欄位分開——所以這裡刻意做重：漸層描邊外框、四角 `❖`、
 * 徑向淡光底、襯線大字的名稱。**這是全站唯一這樣畫的區塊**，刻意的。
 *
 * 資訊層級也照「大招」排：名稱最大（那是玩家自己取的名字），
 * 效果名與觸發名一行（那是規則），效果全文（那是判給桌上聽的），
 * 施展條件最小（那是提醒，不是重點）。
 */
function ShowcaseCard({ theme, name, trigger, effect, triggerText = '', effectText = '', label = '', max, combined = false }) {
  /**
   * 呼叫端已經先判斷過 `showcaseReady`，這裡仍然擋一次：
   * 卡片讀 `effect.name`／`trigger.name`，少一個就是整頁白畫面。
   * 寧可少畫一張卡，也不要讓角色卡在渲染期丟例外。
   */
  if (!effect || !trigger) return null;

  const accent = theme.accent;
  const accentDark = theme.accentDark;
  const accentLight = theme.accentLight;
  const border = theme.border;
  const cardBg = theme.cardBg;
  const textDark = theme.textDark;
  const textMuted = theme.textMuted;

  /* 第三十七輪（§CI45）：「特別的框」不再由金屬漸層與彩色光暈承擔。
   *
   * 這張卡原本是 3px 的**對角線性漸層**描邊（兩端暗、中間亮、135°），
   * 外面再壓一層彩色投影（`0 18px 40px -22px` 的 accent），內層還疊了兩圈放射光暈。
   * 那組參數的形狀就是**金箔框**：v4 的「金銀青絲」把金色換成角色的 accent 之後，
   * 就通過了「沒有金色」的字面檢查——卻同時踩到 v5 的三條禁令：
   * 漸層、裝飾性光暈、用 box-shadow 造浮起。
   *
   * 「這張卡要跟別人不一樣」仍然成立，只是換人承擔：四角 ❖ 角標、襯線大字卡名、
   * 浮在邊框上的徽章、進場動畫、以及**實心 accent 的 3px 外框**。
   * 判準回到第九輪那句：一個元素只需要一種方式說「我是一塊」。
   */
  return (
    <div
      className="relative rounded animate-fade-in"
      data-testid="zero-power-showcase"
      style={{ padding: '3px', background: accent }}
    >
      <div className="relative rounded px-4 py-5 space-y-3" style={{ background: cardBg }}>
        {/*
          頂端徽章：它浮在邊框上，所以整塊讀起來像「被蓋章的一張卡」而不是另一個欄位。
          刻意不帶四角角標那組定位字串——護欄用那組字數「四角各一個」，這裡多一個就多數一個。
        */}
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-t10 font-bold whitespace-nowrap"
          style={{
            backgroundColor: accent,
            color: cardBg,
            letterSpacing: '0.22em'
          }}
        >
          底力技
        </span>

        <span className="pointer-events-none absolute top-1.5 left-2.5 text-sm" style={{ color: accent }}>❖</span>
        <span className="pointer-events-none absolute top-1.5 right-2.5 text-sm" style={{ color: accent }}>❖</span>
        <span className="pointer-events-none absolute bottom-1.5 left-2.5 text-sm" style={{ color: accent }}>❖</span>
        <span className="pointer-events-none absolute bottom-1.5 right-2.5 text-sm" style={{ color: accent }}>❖</span>

        {/* 右邊留給角標——用 inline style 而不是 pr-*，這是避讓契約不是樣式偏好 */}
        <div className="flex items-center justify-end gap-2" style={{ paddingRight: '2.5rem' }}>
          <span className="text-t10" style={{ color: textMuted }}>{ZERO_POWER_SOURCE}</span>
        </div>

        <div className="text-center space-y-1.5">
          <div
            className="font-serif font-black text-2xl sm:text-3xl leading-tight"
            style={{ color: accentDark, letterSpacing: '0.08em' }}
          >
            {name || '（尚未命名）'}
          </div>
          <div className="text-t14 font-bold" style={{ color: textMuted }}>
            【{effect.name}】· 觸發【{trigger.name}】
          </div>
          {label ? (
            <div className="text-t10" style={{ color: textMuted }}>{label}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="flex-1 h-px" style={{ backgroundColor: border }} />
          <span className="text-xs" style={{ color: accent }}>✦</span>
          <span className="flex-1 h-px" style={{ backgroundColor: border }} />
        </div>

        {/*
          觸發與效果都寫全文——只寫名字等於沒寫：桌上要唸的是「什麼時候開」和「開了會怎樣」。
          觸發用淡底框起來（它是條件，不是內容），效果是卡片主體、字大一級。
          `triggerText`／`effectText` 由呼叫端算好傳進來（純函式在 utils/zeroPower.js）：
          【愛】要換成綁定對象的名字、【零之元素】／【零之天災】要把已選的類型寫進去。
        */}
        <div
          className="rounded px-3 py-2 text-center space-y-0.5"
          style={{ backgroundColor: accentLight, border: `1px solid ${border}` }}
        >
          <span className="block text-t10 font-bold" style={{ color: accent, letterSpacing: '0.2em' }}>觸發</span>
          <p className="text-t14 leading-7" style={{ color: textMuted }}>
            {renderTextWithAffinities(triggerText || trigger.desc)}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="block text-center text-t10 font-bold" style={{ color: accent, letterSpacing: '0.2em' }}>效果</span>
          <p className="text-t16 leading-7 text-center" style={{ color: textDark }}>
            {renderTextWithAffinities(effectText || effect.desc)}
          </p>
        </div>

        <div
          className="flex items-center justify-center gap-1.5 flex-wrap text-t10 font-bold rounded px-2 py-1.5"
          style={{ color: textMuted, backgroundColor: accentLight, border: `1px solid ${border}` }}
        >
          <GiPocketWatch className="w-3 h-3" style={{ color: accent }} />
          <span>{`施展：命刻全滿（${max}／${max}）`}</span>
          <span style={{ color: border }}>｜</span>
          <span>每回合一次</span>
          <span style={{ color: border }}>｜</span>
          <span>衝突場景中</span>
          {combined ? (
            <>
              <span style={{ color: border }}>｜</span>
              <span>雙方命刻皆滿</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 還沒選齊時的佔位——位置固定在最下面，避免選齊那一刻版面突然長出一塊。 */
function ShowcasePlaceholder({ theme, missing, note }) {
  const border = theme.border;
  const panelBg = theme.panelBg;
  const textMuted = theme.textMuted;

  return (
    <div
      className="rounded border-2 border-dashed px-4 py-4 text-center space-y-1"
      style={{ borderColor: border, backgroundColor: panelBg }}
      data-testid="zero-power-showcase-placeholder"
    >
      <span className="block text-t14 font-bold" style={{ color: textMuted }}>
        {note || '選好觸發與效果後，這裡會出現這一招的完整卡片'}
      </span>
      {/* F-022：`missing` 可能是空字串（覺醒之力在覺醒前只缺「觸發」，而那是**還沒輪到**，
          不是漏填）。空字串時整行不印——否則會出現一行光禿禿的「還缺：」。 */}
      {missing ? <p className="text-t12" style={{ color: textMuted }}>{`還缺：${missing}`}</p> : null}
    </div>
  );
}

/** 命刻刻度（跑團用；可點擊設定已填充數）。 */
function ClockStrip({ filled, max, onSet, theme, readonly = false }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => {
        const on = i < filled;
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            title={`${i + 1} 格`}
            onClick={() => onSet(on ? i : i + 1)}
            className="w-6 h-6 rounded-full border transition-all cursor-pointer disabled:cursor-default"
            style={{
              backgroundColor: on ? theme.accent : 'transparent',
              borderColor: theme.accent
            }}
          />
        );
      })}
      <span className="text-t11 font-mono font-bold ml-1" style={{ color: theme.textMuted }}>
        {filled}／{max}
      </span>
    </div>
  );
}

export default function ZeroPowerBlock({
  character,
  theme = {},
  mode = 'edit',
  roster = [],
  onChange,
  onPartnerCleared = null,
  onRecoverHp = null,
  showToast = null
}) {
  const state = normalizeZeroPower(character && character.zeroPower);
  /** 命名表彈窗（`ZeroPowerNameTablesModal`）——與身份表同一個入口形狀：按鈕開表。 */
  const [nameTablesOpen, setNameTablesOpen] = useState(false);
  /**
   * 名詞說明彈窗（`ZeroPowerGlossaryModal`）。
   * `glossaryTab` 由**開啟的那顆按鈕**決定，不讓彈窗自己記住上一次看哪一頁。
   */
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryTab, setGlossaryTab] = useState(GLOSSARY_TAB_TRIGGER);
  const openGlossary = (tab) => {
    setGlossaryTab(tab);
    setGlossaryOpen(true);
  };
  /** 【合體之力】跑團時「這一回合要施展哪一組配對」——只存在於畫面狀態，不進存檔。 */
  const [partnerId, setPartnerId] = useState('');
  /** 【覺醒之力】覺醒當下要選的觸發（原文 p.130：覺醒時才選）。 */
  const [awakenTriggerId, setAwakenTriggerId] = useState('');
  /** 覺醒是否發生在衝突中（衝突中覺醒 → 命刻立即填滿）。瀕死覺醒必然在衝突中，故預設 true。 */
  const [awakenInConflict, setAwakenInConflict] = useState(true);

  const patch = (partial) => {
    if (typeof onChange === 'function') onChange({ ...state, ...partial });
  };

  /** 【合體之力】配對清單的三個操作（新增／改一組／移除）。 */
  const setPairs = (combinedPairs) => patch({ combinedPairs });
  const updatePair = (index, partial) =>
    setPairs(state.combinedPairs.map((p, i) => (i === index ? { ...p, ...partial } : p)));
  const removePair = (index) => setPairs(state.combinedPairs.filter((_, i) => i !== index));
  const addPair = () => setPairs([...state.combinedPairs, { partnerId: '', effectId: '', nickname: '' }]);

  const max = zeroClockMax(state);
  const full = isZeroClockFull(state);
  const combined = state.variant === 'combined';
  const trigger = zeroTriggerById(state.triggerId);
  const activeEffectId = zeroActiveEffectId(state, partnerId);
  const effect = zeroEffectById(activeEffectId);
  const partnerChar = combined && partnerId ? roster.find((c) => c && c.id === partnerId) || null : null;
  const partnerState = partnerChar ? normalizeZeroPower(partnerChar.zeroPower) : null;
  const partnerClockFull = partnerState ? isZeroClockFull(partnerState) : undefined;

  const inputClass = 'w-full rounded px-2.5 py-1.5 text-xs outline-none border font-mono font-bold';
  const inputStyle = { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark };

  /** 覺醒：一次做完「回復 HP、選定觸發、（衝突中）填滿命刻」。 */
  const doAwaken = () => {
    const result = awakenZeroPower(state, { triggerId: awakenTriggerId, inConflict: awakenInConflict });
    if (!result.ok) {
      if (typeof showToast === 'function') showToast(result.message);
      return;
    }
    if (typeof onChange === 'function') onChange(result.state);
    if (result.hpRecoveryFactor > 0 && typeof onRecoverHp === 'function') onRecoverHp(result.hpRecoveryFactor);
    if (typeof showToast === 'function') showToast(result.message);
  };

  const awakenArea = () => {
    if (state.variant !== 'awakened' || state.awakened) return null;
    return (
      <div className="rounded border p-2.5 space-y-1.5" style={{ borderColor: theme.accent, backgroundColor: theme.cardBg }}>
        <span className="block text-t14 font-bold" style={{ color: theme.textDark }}>
          覺醒之力：尚未覺醒
        </span>
        <p className="text-t14 leading-relaxed" style={{ color: theme.textMuted }}>
          角色在衝突中 HP 歸零（取代投降或犧牲），或面對重大轉折時覺醒。覺醒時回復等同危機值的 HP，並當場選定一個與事件相符的觸發。
          {mode === 'edit' ? '（HP 回復由跑團面板自動計算；在這裡覺醒只記錄狀態。）' : ''}
        </p>
        <div className="flex flex-wrap gap-1">
          {ZERO_TRIGGERS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.desc}
              onClick={() => setAwakenTriggerId(awakenTriggerId === t.id ? '' : t.id)}
              className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
              style={{
                backgroundColor: awakenTriggerId === t.id ? theme.subpanelBg : theme.cardBg,
                borderColor: awakenTriggerId === t.id ? theme.accent : theme.border,
                color: theme.textDark
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-t10" style={{ color: theme.textDark }}>
          <input
            type="checkbox"
            checked={awakenInConflict}
            onChange={(e) => setAwakenInConflict(e.target.checked)}
          />
          在衝突中覺醒（命刻立即填滿）
        </label>
        <JRPGButton
          variant="primary"
          size="xs"
          icon={GiSparkles}
          onClick={doAwaken}
          disabled={!awakenTriggerId}
        >
          覺醒
        </JRPGButton>
      </div>
    );
  };

  // ───────────────────────────────────────────── 跑團模式
  if (mode === 'play') {
    const gate = canUnleashZeroPower(state, { partnerId, partnerClockFull });
    const doUnleash = () => {
      const result = unleashZeroPower(state, { partnerId, partnerClockFull });
      if (result.ok) {
        if (typeof onChange === 'function') onChange(result.state);
        if (result.partnerCleared && typeof onPartnerCleared === 'function') onPartnerCleared(partnerId);
        if (typeof showToast === 'function') showToast(result.message);
      } else if (typeof showToast === 'function') {
        showToast(result.message);
      }
    };
    return (
      <div className="rounded border p-3 space-y-2.5" style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }} data-testid="zero-power-play">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="font-serif font-black text-t16 flex items-center gap-1.5" style={{ color: theme.textDark }}>
            <GiPocketWatch className="w-4 h-4" style={{ color: theme.accent }} />
            底力命刻
          </span>
          <span className="text-t10" style={{ color: theme.textMuted }}>{ZERO_POWER_SOURCE}</span>
        </div>

        <ClockStrip
          filled={state.clock}
          max={max}
          theme={theme}
          onSet={(n) => patch({ clock: n })}
        />

        <p className="text-t14 leading-relaxed" style={{ color: theme.textDark }}>
          {state.triggerId || activeEffectId || combined
            ? `${trigger ? trigger.name : '未選觸發'}・${effect ? effect.name : combined ? '未選配對效果' : '未選效果'}`
            : '尚未設定底力技——請在角色編輯第 5 步設定'}
        </p>

        {awakenArea()}

        {combined ? (
          <div className="space-y-1">
            <label className="text-t14 font-bold" style={{ color: theme.textDark }}>要施展哪一組配對</label>
            <select
              className={inputClass}
              style={inputStyle}
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">尚未選擇</option>
              {state.combinedPairs.map((p) => {
                const pe = zeroEffectById(p.effectId);
                const partner = roster.find((c) => c && c.id === p.partnerId);
                return (
                  <option key={p.partnerId} value={p.partnerId}>
                    {`${p.nickname || (pe ? pe.name : '未選效果')}（與 ${partner ? partner.name : p.partnerId} 共用）`}
                  </option>
                );
              })}
            </select>
            {partnerState ? (
              <p className="text-t12" style={{ color: isZeroClockFull(partnerState) ? theme.accent : theme.textMuted }}>
                {`對方的底力命刻：${partnerState.clock}／${zeroClockMax(partnerState)}`}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 flex-wrap">
          <JRPGButton
            variant="outline"
            size="xs"
            icon={GiSparkles}
            onClick={() => patch(fillZeroClock(state, 1))}
            disabled={full}
          >
            填充 1 格
          </JRPGButton>
          <JRPGButton
            variant="outline"
            size="xs"
            icon={GiPocketWatch}
            onClick={() => patch(clearZeroClock(state))}
            disabled={state.clock === 0}
          >
            清空
          </JRPGButton>
          <JRPGButton
            variant="primary"
            size="xs"
            icon={GiSparkles}
            onClick={doUnleash}
            disabled={!gate.ok}
          >
            施展
          </JRPGButton>
        </div>

        <p className="text-t14 leading-relaxed" style={{ color: gate.ok ? theme.accent : theme.textMuted }}>
          {gate.ok ? '命刻全滿，可執行技能動作施展底力效果（每回合一次）。' : gate.reason}
        </p>
      </div>
    );
  }

  // ───────────────────────────────────────────── 建角模式

  /**
   * 完整卡片要顯示哪幾招。
   *
   * 標準模式只有一招（`effect`）；合體之力的效果掛在**配對**上，
   * 所以一個角色可能同時有三組（四人團），每組各一張卡。
   * 這裡刻意用 `zeroEffectById(pair.effectId)` 重算，不依賴 `effect`
   * ——建角時 `partnerId` 恆為空，`zeroActiveEffectId` 取不到東西。
   */
  const showcasePairs = combined
    ? state.combinedPairs
        .map((pair) => ({
          pair,
          effect: zeroEffectById(pair.effectId),
          partner: roster.find((c) => c && c.id === pair.partnerId) || null
        }))
        .filter((row) => row.effect)
    : [];
  /**
   * 【愛】綁定了嗎：`loveTargetId` 指向名冊裡的某個角色才算。
   *
   * 沒綁定就不畫完整卡片——卡片上會出現「當【】失去 HP」這種半句話，
   * 而「選擇這個觸發時，將它綁定到…」那句說明是給還在選的人看的，不該出現在成品上。
   */
  const loveBound =
    state.triggerId !== 'love' || roster.some((c) => c && c.id === state.loveTargetId);
  /** 元素／天災的傷害類型還沒選完 → 卡片上的效果會讀成「還沒選」，所以先不畫。 */
  const choiceReady = combined || isZeroChoiceComplete(state);
  const showcaseReady =
    Boolean(trigger) &&
    loveBound &&
    choiceReady &&
    (combined ? showcasePairs.length > 0 : Boolean(effect));
  const showcaseTriggerText = describeZeroTrigger(state, { roster });
  /* F-022（2026-10-27）：覺醒之力建角時**本來就不選觸發**（原書：觸發在覺醒當下才選定）。
     上面那段說明已經寫了「留白是正確狀態」，這裡卻又把它列進「還缺」——
     同一個區塊兩句話互相矛盾，玩家會回頭去補一個不該補的欄位。
     判準：**「還沒輪到」不是「缺」**，所以不列進 missing，改由下面的 note 說明。 */
  const awakeningPending = state.variant === 'awakened' && !state.awakened;
  const showcaseMissing = [
    trigger || awakeningPending ? null : '觸發',
    state.triggerId === 'love' && !loveBound ? '愛的對象' : null,
    combined ? (showcasePairs.length > 0 ? null : '配對效果') : effect ? null : '效果',
    combined || choiceReady ? null : '效果的必要選擇'
  ].filter(Boolean);

  return (
    <div className="space-y-3" data-testid="zero-power-block">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <label className="text-t14 font-bold" style={{ color: theme.textDark }}>
          底力技
        </label>
        <span className="text-t10" style={{ color: theme.textMuted }}>
          {ZERO_POWER_SOURCE}　選用規則
        </span>
      </div>

      <p className="text-t14 leading-relaxed" style={{ color: theme.textMuted }}>
        從七個觸發與十一個效果中各選一個。原文建議整團不要重複（p.124），但那是 GM 審卡時的裁定，這裡不阻止你選隊友已經選過的那一項。
      </p>

      {/* 名字（p.128–129 命名表） */}
      <div className="space-y-1.5">
        <JRPGInput
          label="底力技名稱"
          value={state.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="例：王家之刃"
          theme={theme}
        />
        {/* 兩顆按鈕都擺在外面：看表與隨機都不該先點進彈窗（同身份欄位的做法） */}
        <div className="flex items-center justify-end gap-1.5">
          <JRPGButton
            variant="outline"
            size="xs"
            icon={GiSpellBook}
            onClick={() => setNameTablesOpen(true)}
          >
            命名表
          </JRPGButton>
          <JRPGButton
            variant="outline"
            size="xs"
            icon={GiRollingDices}
            onClick={() => patch({ name: rollZeroPowerName().name })}
          >
            隨機
          </JRPGButton>
        </div>
        <ZeroPowerNameTablesModal
          isOpen={nameTablesOpen}
          onClose={() => setNameTablesOpen(false)}
          onSelectName={(name) => patch({ name })}
          currentName={state.name}
          theme={theme}
        />
      </div>

      {/* 觸發 */}
      {state.variant === 'awakened' && !state.awakened ? (
        <div className="rounded border px-2.5 py-2 space-y-1" style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}>
          <span className="block text-t14 font-bold" style={{ color: theme.textDark }}>觸發</span>
          <p className="text-t14 leading-relaxed" style={{ color: theme.textMuted }}>
            覺醒之力建角時不選觸發——觸發在覺醒當下才選定，所以這裡留白是正確狀態，不是漏填。
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-t14 font-bold" style={{ color: theme.textDark }}>觸發</span>
            <JRPGButton
              variant="outline"
              size="xs"
              icon={GiScrollUnfurled}
              onClick={() => openGlossary(GLOSSARY_TAB_TRIGGER)}
            >
              觸發敘述
            </JRPGButton>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ZERO_TRIGGERS.map((t) => (
              <ChoiceChip
                key={t.id}
                theme={theme}
                active={state.triggerId === t.id}
                title={t.name}
                subtitle={t.fill === 'varies' ? '變動格數' : `每次 ${t.fill} 格`}
                onClick={() => patch({ triggerId: state.triggerId === t.id ? '' : t.id })}
              />
            ))}
          </div>
          {trigger ? (
            <p className="text-t14 leading-relaxed rounded border px-2.5 py-2" style={{ color: theme.textDark, borderColor: theme.border, backgroundColor: theme.cardBg }}>
              {renderTextWithAffinities(trigger.desc)}
            </p>
          ) : null}
        </div>
      )}

      {/* 觸發．愛的綁定 */}
      {state.triggerId === 'love' ? (
        <div className="space-y-1">
          <label className="text-t14 font-bold" style={{ color: theme.textDark }}>你所愛的玩家角色</label>
          <select
            className={inputClass}
            style={inputStyle}
            value={state.loveTargetId}
            onChange={(e) => patch({ loveTargetId: e.target.value })}
          >
            <option value="">尚未選擇</option>
            {roster
              .filter((c) => c && c.id && c.id !== (character && character.id))
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
          </select>
        </div>
      ) : null}

      {/* 效果（合體之力：效果在配對上，不在角色上） */}
      {combined ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-t14 font-bold" style={{ color: theme.textDark }}>
              合體配對（每個其他玩家角色各一組）
            </span>
            <JRPGButton
              variant="outline"
              size="xs"
              icon={GiScrollUnfurled}
              onClick={() => openGlossary(GLOSSARY_TAB_EFFECT)}
            >
              效果敘述
            </JRPGButton>
          </div>
          {state.combinedPairs.map((pair, index) => (
            <div key={`pair-${index}`} className="flex items-center gap-1.5 flex-wrap">
              <select
                className={inputClass}
                style={inputStyle}
                value={pair.partnerId}
                onChange={(e) => updatePair(index, { partnerId: e.target.value })}
              >
                <option value="">選擇伙伴</option>
                {roster
                  .filter((c) => c && c.id && c.id !== (character && character.id))
                  .filter((c) => !state.combinedPairs.some((q, j) => j !== index && q.partnerId === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.id}</option>
                  ))}
              </select>
              <select
                className={inputClass}
                style={inputStyle}
                value={pair.effectId}
                onChange={(e) => updatePair(index, { effectId: e.target.value })}
              >
                <option value="">選擇效果</option>
                {ZERO_EFFECTS.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                style={inputStyle}
                value={pair.nickname}
                placeholder="這一招的別稱"
                onChange={(e) => updatePair(index, { nickname: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removePair(index)}
                className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
                style={{ borderColor: theme.border, color: theme.textMuted, backgroundColor: theme.cardBg }}
              >
                移除
              </button>
            </div>
          ))}
          <JRPGButton
            variant="outline"
            size="xs"
            icon={GiSparkles}
            onClick={addPair}
            disabled={state.combinedPairs.length >= Math.max(1, roster.length - 1)}
          >
            新增配對
          </JRPGButton>
          <p className="text-t14 leading-relaxed" style={{ color: theme.textMuted }}>
            四人團＝每人三組配對、全團共六個效果；效果允許重複，觸發仍應盡量不同。
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-t14 font-bold" style={{ color: theme.textDark }}>效果</span>
            <JRPGButton
              variant="outline"
              size="xs"
              icon={GiScrollUnfurled}
              onClick={() => openGlossary(GLOSSARY_TAB_EFFECT)}
            >
              效果敘述
            </JRPGButton>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ZERO_EFFECTS.map((e) => (
              <ChoiceChip
                key={e.id}
                theme={theme}
                active={state.effectId === e.id}
                title={e.name}
                subtitle="底力效果"
                onClick={() => patch({ effectId: state.effectId === e.id ? '' : e.id })}
              />
            ))}
          </div>
        </div>
      )}

      {/* 效果的必要選擇（合體之力的選擇在施展當下確認，故不在此列） */}
      {!combined && state.effectId === 'elements' ? (
        <div className="space-y-1">
          <span className="text-t14 font-bold" style={{ color: theme.textDark }}>
            選定兩種傷害類型（施展時再從這兩種中選一種）
          </span>
          <div className="flex flex-wrap gap-1">
            {ZERO_DAMAGE_TYPES.map((type) => {
              const picked = state.choices.damagePair.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const cur = state.choices.damagePair;
                    const next = picked ? cur.filter((x) => x !== type) : [...cur, type].slice(-2);
                    patch({ choices: { ...state.choices, damagePair: next } });
                  }}
                  className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
                  style={{
                    backgroundColor: picked ? theme.subpanelBg : theme.cardBg,
                    borderColor: picked ? theme.accent : theme.border,
                    color: theme.textDark
                  }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!combined && state.effectId === 'scourge' ? (
        <div className="space-y-1.5">
          <div className="space-y-1">
            <span className="text-t14 font-bold" style={{ color: theme.textDark }}>選定一種傷害類型</span>
            <div className="flex flex-wrap gap-1">
              {ZERO_DAMAGE_TYPES.map((type) => {
                const picked = state.choices.damageType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => patch({ choices: { ...state.choices, damageType: picked ? '' : type } })}
                    className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
                    style={{
                      backgroundColor: picked ? theme.subpanelBg : theme.cardBg,
                      borderColor: picked ? theme.accent : theme.border,
                      color: theme.textDark
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-t14 font-bold" style={{ color: theme.textDark }}>選定兩種狀態效果</span>
            <div className="flex flex-wrap gap-1">
              {ZERO_STATUS_EFFECTS.map((status) => {
                const picked = state.choices.statuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      const cur = state.choices.statuses;
                      const next = picked ? cur.filter((x) => x !== status) : [...cur, status].slice(-2);
                      patch({ choices: { ...state.choices, statuses: next } });
                    }}
                    className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
                    style={{
                      backgroundColor: picked ? theme.subpanelBg : theme.cardBg,
                      borderColor: picked ? theme.accent : theme.border,
                      color: theme.textDark
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {effect ? (
        <p className="text-t14 leading-relaxed rounded border px-2.5 py-2" style={{ color: theme.textDark, borderColor: theme.border, backgroundColor: theme.cardBg }}>
          {renderTextWithAffinities(effect.desc)}
        </p>
      ) : null}

      {/* 變體規則 */}
      <div className="space-y-1.5">
        <span className="text-t14 font-bold" style={{ color: theme.textDark }}>變體規則</span>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => patch({ variant: '', awakened: false, combinedPairs: [] })}
            className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
            style={{
              backgroundColor: state.variant === '' ? theme.subpanelBg : theme.cardBg,
              borderColor: state.variant === '' ? theme.accent : theme.border,
              color: theme.textDark
            }}
          >
            不使用
          </button>
          {ZERO_VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => patch({ variant: v.id })}
              className="text-t12 px-2 py-0.5 rounded border cursor-pointer"
              style={{
                backgroundColor: state.variant === v.id ? theme.subpanelBg : theme.cardBg,
                borderColor: state.variant === v.id ? theme.accent : theme.border,
                color: theme.textDark
              }}
            >
              {v.name}
            </button>
          ))}
        </div>
        {state.variant ? (
          <p className="text-t14 leading-relaxed" style={{ color: theme.textMuted }}>
            {ZERO_VARIANTS.find((v) => v.id === state.variant)?.desc}
          </p>
        ) : null}
        {state.variant === 'awakened' ? (
          state.awakened ? (
            <p className="text-t14 leading-relaxed" style={{ color: theme.textDark }}>
              已覺醒（每次戰役一次）：觸發已選定，可正常累積與施展。
            </p>
          ) : awakenArea()
        ) : null}
        {state.variant === 'combined' ? (
          <div className="space-y-1">
            <p className="text-t12" style={{ color: theme.textMuted }}>
              合體之力下命刻只有 {max} 格；效果由配對共用，雙方命刻皆滿才能施展，施展後兩邊一起清空。
              {state.combinedPairs.length > 0 ? `目前已設定 ${state.combinedPairs.length} 組配對。` : ''}
            </p>
          </div>
        ) : null}
      </div>

      {/* 完整卡片 —— 刻意放在最下面：選完之後往下看，看到的就是「這一招」 */}
      {showcaseReady ? (
        combined ? (
          <div className="space-y-2">
            {showcasePairs.map((row, index) => (
              <ShowcaseCard
                key={`showcase-${index}`}
                theme={theme}
                name={row.pair.nickname || state.name}
                trigger={trigger}
                effect={row.effect}
                triggerText={showcaseTriggerText}
                effectText={describeZeroEffect(state, row.effect.id)}
                label={`與 ${row.partner ? row.partner.name || row.partner.id : row.pair.partnerId || '未指定伙伴'} 共用`}
                max={max}
                combined
              />
            ))}
          </div>
        ) : (
          <ShowcaseCard
            theme={theme}
            name={state.name}
            trigger={trigger}
            effect={effect}
            triggerText={showcaseTriggerText}
            effectText={describeZeroEffect(state)}
            max={max}
          />
        )
      ) : (
        <ShowcasePlaceholder
          theme={theme}
          missing={showcaseMissing.join('、')}
          note={awakeningPending
            ? '覺醒之力的觸發要等覺醒當下才選。先選好效果，覺醒後補上觸發就會出現完整卡片。'
            : undefined}
        />
      )}

      <ZeroPowerGlossaryModal
        isOpen={glossaryOpen}
        onClose={() => setGlossaryOpen(false)}
        theme={theme}
        initialTab={glossaryTab}
        selectedTriggerId={state.triggerId}
        selectedEffectId={state.effectId}
        onPickTrigger={(id) => patch({ triggerId: state.triggerId === id ? '' : id })}
        onPickEffect={
          combined ? null : (id) => patch({ effectId: state.effectId === id ? '' : id })
        }
      />
    </div>
  );
}
