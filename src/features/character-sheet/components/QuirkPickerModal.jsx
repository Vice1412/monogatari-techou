import React, { useMemo, useState } from 'react';
import { GiMagnifyingGlass, GiCheckMark, GiSparkles, GiHazardSign } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import JRPGButton from '../../../components/ui/JRPGButton';
import SkillDescription from '../utils/skillFormulaEvaluator';
import { splitParagraphs } from '../utils/paragraphs';
import rulesData from '../data/rulesData.json';

/**
 * 金手指（Quirk）選擇器。
 *
 * ## 為什麼是「只列題目」而不是英雄技能那種大表
 *
 * 使用者的原話：
 *
 * > 我要把它做成彈出的視窗顯示表，像英雄技能的處理一樣。但畢竟金手指沒有先決條件，
 * > 所以不必做成這麼麻煩的表。我的提議是全部都寫題目而已，玩家有感興趣的才點進去看
 * > 金手指的詳細效果內容，確定了就選擇。
 *
 * 英雄技能那張表之所以要四欄（名稱／出處／條件／效果），是因為**條件**要能一眼掃過去；
 * 金手指沒有任何先決條件，所以只需要「名稱清單 ＋ 點開看細節」。
 *
 * ## 為什麼不顯示出處
 *
 * 使用者的原話：
 *
 * > 檢查一下三大擴展的金手指是否有重複，如果沒有就把金手指的出處也列出來；
 * > 有的話就不列，直接寫出所有的金手指就可以。
 *
 * 實測**有重複**——`FLIGHT` 與 `CURSED` 同時收錄於高度奇幻與自然奇幻手冊，
 * `ROBOT` 同時收錄於高度奇幻與科技奇幻手冊——所以依裁定**不列出處**。
 *
 * ## 兩個導出
 *
 * - `QuirkPickerBody`：純內容，SSR 測得到（`JRPGModal` 用 portal，SSR 會渲染成空的）。
 * - 預設 `QuirkPickerModal`：把 body 包進 `JRPGModal`。
 */
export function QuirkPickerBody({
  theme,
  selectedName = '',
  selectedChoice = '',
  onPick,
  onClear,
  onClose
}) {
  const [search, setSearch] = useState('');
  const [openName, setOpenName] = useState(selectedName || null);
  // 金手指「選項」（§CF）。11 個金手指寫著「選擇一個選項」——
  // 其中只有兩個會改數值（倖存者③ IP +2、墮落天使③ 最大 MP +10），
  // 但**每一個都要選**：原書寫的是「選擇一個選項」，不是「可以選」。
  const [choice, setChoice] = useState(selectedChoice || '');

  const quirks = useMemo(() => rulesData.quirks || [], []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quirks;
    return quirks.filter((x) => x.name.toLowerCase().includes(q));
  }, [quirks, search]);

  const opened = useMemo(
    () => quirks.find((x) => x.name === openName) || null,
    [quirks, openName]
  );

  // 選項一律包成「組」再渲染（§CG）：
  // ・單組的金手指在資料層是 `options`（倖存者、墮落天使……）
  // ・要選**兩件事**的在資料層是 `optionGroups`（草木成精：一個免疫狀態＋一個易傷屬性）
  // 包成同一種形狀之後，介面只有一套邏輯，不必為多組另開分支。
  const quirkOptionGroups = Array.isArray(opened?.optionGroups) && opened.optionGroups.length > 0
    ? opened.optionGroups
    : (Array.isArray(opened?.options) && opened.options.length > 0
      ? [{ id: 'default', label: '', options: opened.options }]
      : []);
  const isMultiGroup = quirkOptionGroups.length > 1;
  const choiceFor = (groupId) => {
    if (isMultiGroup) return choice && typeof choice === 'object' ? choice[groupId] : undefined;
    return typeof choice === 'string' ? choice : undefined;
  };
  const pickOption = (groupId, optId) => {
    if (!isMultiGroup) { setChoice(optId); return; }
    setChoice((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [groupId]: optId }));
  };
  // 每一組都選了才准確定——只選一半的存檔在引擎裡只會生效一半，不如擋在門口。
  const groupsComplete = quirkOptionGroups.length > 0
    && quirkOptionGroups.every((group) => Boolean(choiceFor(group.id)));

  // 一個選項的 id 若已被**別組**選走，就不能再選（§CH）。
  //
  // 原書兩處明文：元素之魂第二組寫「不可與上面相同」；通智幽魂寫「選擇 2 種傷害類型」
  // 與「第 3 種易傷」——三種都必須不同。以前介面不擋，玩家選了同一個屬性之後，
  // 引擎會把重複的抗性去重成一筆，**少掉的那一個抗性不會有任何提示**。
  //
  // 判準用「id 是否已被別組選走」而不是逐個金手指寫例外：草木成精的兩組 id
  // 分屬「免疫狀態」與「易傷傷害類型」，本來就不會撞，所以自動不受影響。
  const pickedElsewhere = (groupId, optId) => quirkOptionGroups.some(
    (g) => g.id !== groupId && choiceFor(g.id) === optId
  );

  return (
    <div className="flex flex-col h-[80vh] md:h-[72vh] max-h-[700px] overflow-hidden -m-1">
      {/* 搜尋列 */}
      <div className="relative mb-3 shrink-0">
        <GiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b5a4b] w-4 h-4" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`搜尋金手指名稱（共 ${quirks.length} 個）...`}
          className="w-full pl-9 pr-3 py-2 rounded text-xs border outline-none font-sans shadow-inner"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 flex-1 min-h-0 overflow-hidden">
        {/* 左：全部金手指的**題目**。沒有先決條件，所以不需要任何額外欄位。 */}
        <div
          className="w-full md:w-64 lg:w-72 shrink-0 flex flex-col border-b md:border-b-0 md:border-r pb-2 md:pb-0 md:pr-3 overflow-hidden"
          style={{ borderColor: theme.border }}
        >
          <span className="text-t11 font-bold mb-2 shrink-0" style={{ color: theme.textMuted }}>
            點名稱看詳細內容（{filtered.length} 個）
          </span>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
            {filtered.length === 0 ? (
              <p className="text-t12 py-4 text-center" style={{ color: theme.textMuted }}>
                沒有符合「{search}」的金手指
              </p>
            ) : (
              filtered.map((q) => {
                const isOpen = openName === q.name;
                const isPicked = selectedName === q.name;
                return (
                  <button
                    key={q.name}
                    type="button"
                    onClick={() => {
                      setOpenName(q.name);
                      // 換一個金手指就把選項清掉——否則會把上一個的 `id` 帶到新的上面。
                      // 點回**目前已經選定**的那一個時，還原已存的選擇。
                      setChoice(q.name === selectedName ? (selectedChoice || '') : '');
                    }}
                    className="w-full text-left px-2.5 py-2 rounded border text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-1.5"
                    style={
                      isOpen
                        ? { backgroundColor: theme.accent, borderColor: theme.accentDark, color: '#fffdf9' }
                        : isPicked
                          ? { backgroundColor: theme.subpanelBg, borderColor: theme.accent, color: theme.textDark }
                          : { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textDark }
                    }
                  >
                    <span className="truncate">{q.name}</span>
                    {isPicked ? <GiCheckMark className="w-3 h-3 shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右：詳細內容。沒點任何一個之前是空狀態。 */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {opened ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 min-h-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <GiSparkles className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
                  <h3 className="font-serif font-black text-base" style={{ color: theme.textDark }}>
                    {opened.name}
                  </h3>
                  {selectedName === opened.name && (
                    <JRPGBadge variant="selected" size="xs">目前已選</JRPGBadge>
                  )}
                </div>

                {/* 風味文（原書用一串提問帶出角色的處境）與效果分開呈現——
                    使用者要求「適當的情況下，讓效果內容分段方便閱讀」。 */}
                {opened.flavor && (
                  <p
                    className="text-t11 italic leading-relaxed p-2.5 rounded border"
                    style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border, color: theme.textMuted }}
                  >
                    <SkillDescription desc={opened.flavor} linkCodex={false} />
                  </p>
                )}
                <div className="text-xs sm:text-t12 leading-relaxed space-y-2.5" style={{ color: theme.textDark }}>
                  {/* 兩層分段：空行＝段落、單一換行＝同一段內的行（清單項目）。
                      見 utils/paragraphs.js 的說明。 */}
                  {splitParagraphs(opened.desc).map((block, bi) => (
                    <div key={bi} className="space-y-1">
                      {block.map((line, li) => (
                        <p key={li}><SkillDescription desc={line} linkCodex={false} /></p>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 選項（§CF／§CG）：原書寫「選擇一個選項」的金手指，把選項列成單選。
                    多組的金手指（草木成精要選免疫狀態＋易傷屬性）每一組各一組單選。
                    只有帶 `effects` 的那幾項會改數值，其餘是敘事選項——但都要選，
                    所以這裡不區分「重要／不重要」，一律同一個介面。 */}
                {quirkOptionGroups.length > 0 && (
                  <div
                    className="rounded border p-2.5 space-y-2"
                    style={{ backgroundColor: theme.subpanelBg, borderColor: theme.border }}
                    data-testid="quirk-options"
                  >
                    <span className="text-t11 font-bold" style={{ color: theme.textMuted }}>
                      {isMultiGroup
                        ? `這個金手指要選 ${quirkOptionGroups.length} 件事（原書：選擇選項）`
                        : '這個金手指要選一個選項（原書：選擇一個選項）'}
                    </span>
                    {quirkOptionGroups.map((group) => (
                      <div key={group.id} className="space-y-1.5" data-testid={`quirk-group-${group.id}`}>
                        {isMultiGroup && group.label && (
                          <span className="block text-t10 font-semibold" style={{ color: theme.textMuted }}>
                            {group.label}
                          </span>
                        )}
                        {group.options.map((opt) => (
                          <label
                            key={opt.id}
                            className="flex items-start gap-2 text-xs cursor-pointer"
                            style={{ color: theme.textDark }}
                          >
                            <input
                              type="radio"
                              name={`quirk-option-${opened.name}-${group.id}`}
                              checked={choiceFor(group.id) === opt.id}
                              disabled={pickedElsewhere(group.id, opt.id)}
                              onChange={() => pickOption(group.id, opt.id)}
                              className="mt-0.5 shrink-0"
                            />
                            <span>
                              {opt.label}
                              {opt.effects && (
                                <span className="text-t10 ml-1" style={{ color: theme.textMuted }}>
                                  （會寫進角色數值）
                                </span>
                              )}
                              {pickedElsewhere(group.id, opt.id) && (
                                <span className="text-t10 ml-1" style={{ color: theme.textMuted }}>
                                  （上面已經選了，不能重複）
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 底部：確定選擇 */}
              <div
                className="pt-3 mt-3 border-t flex items-center justify-between gap-3 shrink-0"
                style={{ borderColor: theme.border }}
              >
                <span className="text-t11" style={{ color: theme.textMuted }}>
                  一個角色只能擁有一個金手指；同一團不得有兩人選同一個。
                </span>
                <div className="flex items-center gap-2">
                  {selectedName && (
                    <button
                      type="button"
                      onClick={() => { onClear && onClear(); onClose && onClose(); }}
                      className="text-t11 text-[#6b5a4b] hover:text-[#76252d] px-2 py-1 cursor-pointer"
                    >
                      移除目前的金手指
                    </button>
                  )}
                  <JRPGButton
                    variant="primary"
                    size="sm"
                    icon={GiCheckMark}
                    disabled={quirkOptionGroups.length > 0 && !groupsComplete}
                    onClick={() => { onPick && onPick(opened, choice || ''); onClose && onClose(); }}
                  >
                    {selectedName === opened.name ? '維持這個' : '選擇這個金手指'}
                  </JRPGButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2" style={{ color: theme.textMuted }}>
              <GiHazardSign className="w-8 h-8 opacity-40" />
              <p className="text-xs">從左邊點一個金手指，這裡會顯示它的完整內容。</p>
              <p className="text-t12 opacity-80">
                金手指是**選用規則**——原書只建議「想玩就用、而且開局一人一個」，不強制。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuirkPickerModal({
  isOpen,
  onClose,
  theme,
  selectedName = '',
  selectedChoice = '',
  onPick,
  onClear
}) {
  return (
    <JRPGModal isOpen={isOpen} onClose={onClose} title="選擇金手指" maxWidth="max-w-4xl">
      <QuirkPickerBody
        theme={theme}
        selectedName={selectedName}
        selectedChoice={selectedChoice}
        onPick={onPick}
        onClear={onClear}
        onClose={onClose}
      />
    </JRPGModal>
  );
}
