/**
 * 此團開卡規則（Creation Rules Panel）
 *
 * ## 為什麼在編輯器而不是名冊頁
 *
 * 這份規則是 **GM 列出的開卡需求**（起始等級、起始資金、職業數上下限、開放哪些手冊、
 * 能不能用金手指、有沒有開局英雄技能……）。使用者指出的流程是：
 *
 *   ① GM 開團，列出開卡需求
 *   ② 玩家自發去角色卡助手，照著那份需求建角色
 *   ③ 建好給 GM 審查
 *
 * 所以「照著需求建」的動作發生在**開卡界面**。舊版把唯一的開關掛在名冊頁，會一次改掉
 * 名冊裡**所有**角色（包括別的團的），與這個流程不符。
 *
 * 現在規則**存在角色身上**（`char.creationRules`，存的是與官方預設不同的欄位 diff）：
 * 每張卡帶著它被創建時的那份需求，後來的規則改動不會追溯影響它。
 *
 * ## 面板本身
 *
 * 預設收合——平常開卡的人不需要一直看到它；展開後才是 GM 需求的那幾格。
 * 這是**團務需求**，不是玩家的角色選擇，所以標題寫「此團」而不是「我的」。
 */
import React, { useState } from 'react';
import { GiScrollQuill } from 'react-icons/gi';
import { SOURCEBOOKS } from '../data/sourcebookConfig';
import { isDefaultCreationRules, DEFAULT_CREATION_RULES, PLAYTEST_SOURCEBOOK_KEY } from '../data/creationRules';
import {
  TECHNOSPHERE_MODE_OPTIONS,
  getIntegratedMnemosphereCap,
  isTechnosphereEnabled,
  modeRestrictsEquipment
} from '../data/technospheres';
import rulesData from '../data/rulesData.json';

const ALL_CLASS_NAMES = Object.freeze(Object.keys(rulesData.classes));

/**
 * 「開放的手冊」只列**真正的手冊**。
 * 公測修訂是選用規則開關（`allowPlaytest`），不是一本書——見 `PLAYTEST_SOURCEBOOK_KEY` 的說明。
 */
const SOURCEBOOK_ENTRIES = Object.entries(SOURCEBOOKS)
  .filter(([key]) => key !== PLAYTEST_SOURCEBOOK_KEY);

/** 面板上會顯示的欄位（`defaultSourcebooks` 不列——那是新角色的起始勾選，由角色的拓展開關決定） */
const NUMBER_FIELDS = [
  { key: 'startingLevel', label: '起始等級', min: 1, max: 50, hint: '官方 5 級' },
  { key: 'classCountMin', label: '職業數下限', min: 1, max: 10, hint: '官方 2' },
  { key: 'classCountMax', label: '職業數上限', min: 1, max: 10, hint: '官方 3' },
  { key: 'startingZenit', label: '起始資金', min: 0, max: 99999, hint: '官方 500z' },
  { key: 'skillPointBudget', label: '技能點數', min: 1, max: 50, hint: '官方＝起始等級' }
];

const TOGGLE_FIELDS = [
  // 金手指是三大奇幻手冊才推出的選用制度——官方核心規則**沒有**這個東西，
  // 所以預設是關的（`DEFAULT_CREATION_RULES.allowQuirk === false`），不是開的。
  { key: 'allowQuirk', label: '開放金手指', hint: '官方核心規則沒有；三大奇幻手冊選用' },
  // 定制武器同理（高度奇幻手冊 p.106），但**不綁高度奇幻手冊**——
  // 原書說它「簡單、沒有深遠的遊戲影響，可以永遠開給任何有興趣的人」。
  { key: 'allowCustomWeapon', label: '開放【定制武器】', hint: '高度奇幻手冊 p.106 選用規則；任何團都能單獨開' },
  { key: 'startingHeroicSkill', label: '開局贈送一個英雄技能', hint: 'Playtest 選用規則' },
  // 使用者裁定（2026-10-19）：公測修訂不是「一本手冊」，是像上面兩條一樣的選用規則開關。
  // 開啟後才會出現核心書技能的【公測】變體，並讓秘儀師【變體】可選。
  { key: 'allowPlaytest', label: '開放公測修訂內容', hint: '官方公測材料；核心技能變體與秘儀師變體' },
  // 這格與上面幾格不同：上面是「開放某批選項」，這格是**把一條既有規則換掉**。
  // 官方原文要求變體規則整團共同採用，所以它住這裡（整團一層），不是每個角色各自勾。
  { key: 'initiativeVariant', label: '先攻變體', hint: '公測 p.34；防具無先攻減值、戰鬥輕甲改物防 +2／魔防 +0、不使用先攻值' },
  // 底力技同樣是整團一層：原書要求整團先討論過再決定是否使用（「會讓主角們強得過分」），
  // 而且「同一團隊不得有兩名以上角色擁有相同的觸發或效果」——那是團隊級的約束。
  { key: 'zeroPowers', label: '開放底力技', hint: '高度奇幻手冊 p.124–131；開啟後角色獲得底力命刻與底力效果' },
  // 營地活動（自然奇幻手冊 p.130–133）也是整團一層：原書 p.130 把它列為選用規則，
  // 而且要求「同一團不要選到重複的活動」——那是團隊級約束（由 GM 審卡，不進程式）。
  // 它動到的是**開卡流程**：第 5 步多一個必選欄位（15 選 2）。
  { key: 'campActivities', label: '開放營地活動', hint: '自然奇幻手冊 p.130–133；建角時選 2 種，休息場景使用' }
];

/**
 * 魔晶石（科技奇幻手冊 p.132–145）——這是**五態枚舉**，不是勾選框。
 *
 * 原書除了完整規則之外還給了三個「只採用一部分」的變體，而三者拿走的東西不同：
 * 有的拿走武器熟練、有的拿走 +5 HP/MP、有的拿走 δ 品級。用一個核取方塊表達不了
 * 「要哪一種取捨」，所以面板上是一份下拉選單。
 */
const TECHNOSPHERE_FIELD = {
  key: 'technospheres',
  label: '魔晶石',
  hint: '科技奇幻手冊 p.132–145；開啟後職業固定三個且不得新增'
};

export default function CreationRulesPanel({ rules, diff = {}, onChange, theme = {}, disabled = false }) {
  // 官方標準時收合（開卡的人不需要一直看到它）；**自訂時自動展開**——
  // 否則你只會看到一張「跟別人不一樣」的卡，卻不知道是哪條規則造成的。
  const [open, setOpen] = useState(() => !isDefaultCreationRules(rules));
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const isDefault = isDefaultCreationRules(rules);

  // 魔晶石開啟時，職業數是**派生值**（原書 p.134 的「恰好三個」），不是 GM 可調的欄位。
  // 所以這裡把兩個數字框鎖住——讓它們看起來可以改，等於讓一條規則自己打自己。
  const techOn = isTechnosphereEnabled(rules.technospheres);
  const derivedClassCount = (key) => techOn && (key === 'classCountMin' || key === 'classCountMax');

  // 定制武器同理，但理由不同：不是「數量被規則固定」，是**裝備白名單裡只剩它**。
  // p.133 的原文是「the only types of equipment available in the game are…
  // custom weapons, armor, and accessories, plus… modules for the Pilot Class」，
  // 下一句是「Any other equipment simply cannot exist」——官方武器表整份不存在。
  // 所以這一格在魔晶石開啟時鎖成勾選，不讓 GM 關掉（關掉等於讓玩家沒有武器可選）。
  // 「僅職業魔石」變體把官方裝備放回來（p.138），那一態不鎖。
  const forcedCustomWeapon = modeRestrictsEquipment(rules.technospheres);
  const derivedToggle = (key) => forcedCustomWeapon && key === 'allowCustomWeapon';

  const setField = (key, value) => {
    const next = { ...(diff || {}), [key]: value };
    onChange(next);
  };

  const toggleInArray = (key, item, list) => {
    const cur = list || [];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    setField(key, next);
  };

  const inputClass = 'w-full rounded px-2.5 py-1.5 text-xs outline-none border font-mono font-bold';
  const inputStyle = { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark };

  return (
    <div
      className="rounded border shadow-e1 overflow-hidden"
      style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left cursor-pointer hover:bg-black/[0.02] transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <GiScrollQuill className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
          <span className="text-xs font-bold truncate" style={{ color: theme.textDark }}>
            此團開卡規則
          </span>
          <span
            className="text-t10 px-1.5 py-0.5 rounded border font-bold shrink-0"
            style={{
              backgroundColor: isDefault ? theme.cardBg : theme.subpanelBg,
              borderColor: theme.border,
              color: isDefault ? theme.textMuted : theme.accent
            }}
          >
            {isDefault ? '官方標準' : '自訂'}
          </span>
        </span>
        <span className="text-t11 shrink-0" style={{ color: theme.textMuted }}>
          {open ? '收起' : '展開'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t" style={{ borderColor: theme.border }}>
          <p className="text-t12 leading-relaxed" style={{ color: theme.textMuted }}>
            GM 列出的開卡需求。這是<strong>這一張卡</strong>的規則——改它不會影響名冊裡的其他角色，
            其他角色之後的改動也不會影響這一張。官方標準以外的手冊、金手指、公測修訂與開局英雄技能都在這裡開。
          </p>

          {/* 開關 */}
          <div className="space-y-1.5">
            {TOGGLE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={derivedToggle(f.key) || Boolean(rules[f.key])}
                  disabled={disabled || derivedToggle(f.key)}
                  onChange={(e) => setField(f.key, e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <span className="text-xs" style={{ color: theme.textDark }}>
                  {f.label}
                  <span className="text-t10 ml-1.5" style={{ color: theme.textMuted }}>
                    {derivedToggle(f.key)
                      ? '魔晶石制強制開啟——官方武器表整份不存在（p.133）'
                      : f.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {/* 魔晶石：五態下拉（完整規則 ＋ 三個變體） */}
          <div className="space-y-1.5">
            <label className="text-t11 font-bold block" style={{ color: theme.textDark }}>
              {TECHNOSPHERE_FIELD.label}
              <span className="text-t10 font-normal ml-1" style={{ color: theme.textMuted }}>
                {TECHNOSPHERE_FIELD.hint}
              </span>
            </label>
            <select
              value={rules.technospheres || 'off'}
              disabled={disabled}
              onChange={(e) => setField(TECHNOSPHERE_FIELD.key, e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              {TECHNOSPHERE_MODE_OPTIONS.map((mode) => (
                <option key={mode.key} value={mode.key}>
                  {mode.label}　{mode.short}
                </option>
              ))}
            </select>
            <p className="text-t10 leading-relaxed" style={{ color: theme.textMuted }}>
              {(TECHNOSPHERE_MODE_OPTIONS.find((m) => m.key === (rules.technospheres || 'off')) || {}).desc}
            </p>
            {techOn && (
              <p className="text-t12 leading-relaxed font-bold" style={{ color: theme.accent }}>
                職業數固定為 3 個固有職業（上方兩個數字框已鎖定）。
                {rules.technospheres === 'integrated'
                  ? `內嵌裝置可容納 ${getIntegratedMnemosphereCap(rules.startingLevel)} 顆職業魔石。`
                  : null}
                {forcedCustomWeapon
                  ? '裝備只剩定制武器／防具／飾品／機師模組，所以【定制武器】已一併鎖為開啟。'
                  : '此變體把官方裝備整份放回來，所以【定制武器】不受影響。'}
              </p>
            )}
          </div>

          {/* 數字 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {NUMBER_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-t11 font-bold block" style={{ color: theme.textDark }}>
                  {f.label}
                  <span className="text-t10 font-normal ml-1" style={{ color: theme.textMuted }}>
                    {derivedClassCount(f.key) ? '魔晶石制固定 3' : f.hint}
                  </span>
                </label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  disabled={disabled || derivedClassCount(f.key)}
                  value={rules[f.key]}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n)) setField(f.key, n);
                  }}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {/* 開放的手冊（公測修訂不在這裡——它是上面的選用規則開關） */}
          <div className="space-y-1.5">
            <span className="text-t11 font-bold block" style={{ color: theme.textDark }}>
              開放的手冊
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {SOURCEBOOK_ENTRIES.map(([key, book]) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(rules.allowedSourcebooks || []).includes(key)}
                    disabled={disabled}
                    onChange={() => toggleInArray('allowedSourcebooks', key, rules.allowedSourcebooks)}
                    className="cursor-pointer"
                  />
                  <span className="text-xs" style={{ color: theme.textDark }}>{book.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 必修職業 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-t11 font-bold" style={{ color: theme.textDark }}>
                必修職業
                {rules.requiredClasses?.length > 0 && (
                  <span className="ml-1.5 font-normal" style={{ color: theme.accent }}>
                    已指定 {rules.requiredClasses.length} 個
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setClassPickerOpen((v) => !v)}
                className="text-t11 font-bold px-2 py-1 rounded border cursor-pointer"
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
              >
                {classPickerOpen ? '收起' : '指定'}
              </button>
            </div>
            {classPickerOpen && (
              <div
                className="max-h-40 overflow-y-auto rounded border p-2 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1"
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
              >
                {ALL_CLASS_NAMES.map((name) => (
                  <label key={name} className="flex items-center gap-1.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={(rules.requiredClasses || []).includes(name)}
                      disabled={disabled}
                      onChange={() => toggleInArray('requiredClasses', name, rules.requiredClasses)}
                      className="cursor-pointer shrink-0"
                    />
                    <span className="text-t11 truncate" style={{ color: theme.textDark }}>{name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 重設 */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={disabled || isDefault}
              onClick={() => onChange({})}
              className="text-t11 font-bold px-2.5 py-1.5 rounded border transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
            >
              重設為官方標準
            </button>
            <span className="text-t10" style={{ color: theme.textMuted }}>
              官方標準：{DEFAULT_CREATION_RULES.startingLevel} 級、
              {DEFAULT_CREATION_RULES.classCountMin}~{DEFAULT_CREATION_RULES.classCountMax} 職業、
              {DEFAULT_CREATION_RULES.startingZenit}z
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
