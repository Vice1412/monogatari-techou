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
  { key: 'zeroPowers', label: '開放底力技', hint: '高度奇幻手冊 p.124–131；開啟後角色獲得底力命刻與底力效果' }
];

export default function CreationRulesPanel({ rules, diff = {}, onChange, theme = {}, disabled = false }) {
  // 官方標準時收合（開卡的人不需要一直看到它）；**自訂時自動展開**——
  // 否則你只會看到一張「跟別人不一樣」的卡，卻不知道是哪條規則造成的。
  const [open, setOpen] = useState(() => !isDefaultCreationRules(rules));
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const isDefault = isDefaultCreationRules(rules);

  const setField = (key, value) => {
    const next = { ...(diff || {}), [key]: value };
    onChange(next);
  };

  const toggleInArray = (key, item, list) => {
    const cur = list || [];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    setField(key, next);
  };

  const inputClass = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border font-mono font-bold';
  const inputStyle = { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark };

  return (
    <div
      className="rounded-xl border shadow-xs overflow-hidden"
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
            className="text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0"
            style={{
              backgroundColor: isDefault ? theme.cardBg : theme.subpanelBg,
              borderColor: theme.border,
              color: isDefault ? theme.textMuted : theme.accent
            }}
          >
            {isDefault ? '官方標準' : '自訂'}
          </span>
        </span>
        <span className="text-[11px] shrink-0" style={{ color: theme.textMuted }}>
          {open ? '收起' : '展開'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t" style={{ borderColor: theme.border }}>
          <p className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
            GM 列出的開卡需求。這是<strong>這一張卡</strong>的規則——改它不會影響名冊裡的其他角色，
            其他角色之後的改動也不會影響這一張。官方標準以外的手冊、金手指、公測修訂與開局英雄技能都在這裡開。
          </p>

          {/* 開關 */}
          <div className="space-y-1.5">
            {TOGGLE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(rules[f.key])}
                  disabled={disabled}
                  onChange={(e) => setField(f.key, e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <span className="text-xs" style={{ color: theme.textDark }}>
                  {f.label}
                  <span className="text-[10px] ml-1.5" style={{ color: theme.textMuted }}>
                    {f.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {/* 數字 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {NUMBER_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-[11px] font-bold block" style={{ color: theme.textDark }}>
                  {f.label}
                  <span className="text-[10px] font-normal ml-1" style={{ color: theme.textMuted }}>
                    {f.hint}
                  </span>
                </label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  disabled={disabled}
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
            <span className="text-[11px] font-bold block" style={{ color: theme.textDark }}>
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
              <span className="text-[11px] font-bold" style={{ color: theme.textDark }}>
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
                className="text-[11px] font-bold px-2 py-1 rounded border cursor-pointer"
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
              >
                {classPickerOpen ? '收起' : '指定'}
              </button>
            </div>
            {classPickerOpen && (
              <div
                className="max-h-40 overflow-y-auto rounded-lg border p-2 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1"
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
                    <span className="text-[11px] truncate" style={{ color: theme.textDark }}>{name}</span>
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
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
            >
              重設為官方標準
            </button>
            <span className="text-[10px]" style={{ color: theme.textMuted }}>
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
