import React, { useState, useMemo, useEffect } from 'react';
import {
  GiSparkles,
  GiCheckMark,
  GiHazardSign,
  GiTrashCan,
  GiMagnifyingGlass,
  GiMusicalNotes,
  GiBookCover,
  GiDna2,
  GiShield
} from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import JRPGButton from '../../../components/ui/JRPGButton';
import FUIcon, { renderTextWithAffinities } from '../../../components/ui/FUIcon';
import {
  getSkillSuboptionConfig,
  calculateSkillSuboptionMax,
  CHANTER_DATA
} from '../data/skillSuboptionsData';
import { findCodexRule } from '../data/ruleCodexData';
import {
  getTheriomorphosisRules,
  describeTheriomorphosis,
  isTheriomorphosisVariant
} from '../data/theriomorphosisVariant';
import { openRuleCodex } from '../utils/skillFormulaEvaluator';
import rulesData from '../data/rulesData.json';

/**
 * 技能子項目構築挑選器 (SkillSuboptionModal)
 * 支援 9 大職業技能（三大咒語學派、舞步、魔奏音調曲風、心靈天賦、混合形態、魔法種子、徽記全庫）。
 * 嚴格遵循：
 * 1. 雙軌圖示（FUIcon 屬性相 + Gi 圖示），零 Unicode Emoji
 * 2. 純中文顯示（零括號英文）
 * 3. 即時配額徽章與防呆校驗
 */
export default function SkillSuboptionModal({
  isOpen,
  onClose,
  className,
  skillName,
  sl = 1,
  selectedOptions = [],
  onSave,
  theme,
  variantId = null,
  hasGreaterTheriomorphosis = false
}) {
  const config = getSkillSuboptionConfig(className, skillName);
  const maxQuota = calculateSkillSuboptionMax(className, skillName, sl);

  // 混合變形（公測 p.40 變體）：形態庫與配額不變，變的是「怎麼用」——
  // 消耗 20 點 HP（原版是當前 HP 三分之一）、顯現至多兩個、之後可自由攻擊一次。
  // 這些差異原本只寫在變體卡裡，挑選形態時看不到；寫在這裡，玩家在配額旁邊就看得到代價。
  const isMutantForms = config?.type === 'mutant_forms';
  const therioRules = isMutantForms ? getTheriomorphosisRules(variantId) : null;
  const therioLines = isMutantForms
    ? describeTheriomorphosis(therioRules, { hasGreater: hasGreaterTheriomorphosis })
    : [];

  // 本技能有沒有對應的規則速查頁（用技能名當關鍵字查，例：植生術 → 花園與魔法種子）。
  // 有才顯示「規則速查」按鈕——沒有的技能不該多一顆按不出東西的按鈕。
  const codexRule = findCodexRule(skillName);

  // 搜尋與篩選狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // 本地勾選項集合
  const [draftSelected, setDraftSelected] = useState([]);

  // 當彈窗開啟時，初始化選取項
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setActiveCategory('all');
      if (Array.isArray(selectedOptions)) {
        setDraftSelected([...selectedOptions]);
      } else if (selectedOptions && typeof selectedOptions === 'object') {
        // 若為魔奏者的 { keys: [], tones: [] } 格式，平鋪為陣列
        const combined = [
          ...(selectedOptions.keys || []),
          ...(selectedOptions.tones || [])
        ];
        setDraftSelected(combined);
      } else {
        setDraftSelected([]);
      }
    }
  }, [isOpen, selectedOptions]);

  // 取得候選資料集
  const rawItems = useMemo(() => {
    if (!config) return [];

    if (config.type === 'spells') {
      // 從 rulesData.json 中取得對應學派的咒語
      const allSpells = rulesData.spells || [];
      return allSpells
        .filter(sp => sp.school === config.school)
        .map(sp => ({
          id: sp.name,
          name: sp.name,
          school: sp.school,
          mp: sp.mp,
          target: sp.target,
          duration: sp.duration,
          isOffensive: sp.isOffensive,
          effect: sp.effect,
          damageType: sp.damageType
        }));
    }

    if (config.type === 'chanter') {
      // 魔奏者包含音調與曲風
      const keys = (config.data?.keys || []).map(k => ({
        ...k,
        itemType: 'key',
        typeLabel: '音調'
      }));
      const tones = (config.data?.tones || []).map(t => ({
        ...t,
        itemType: 'tone',
        typeLabel: '曲風'
      }));
      return [...keys, ...tones];
    }

    // 其餘標準陣列
    return config.data || [];
  }, [config]);

  // 過濾後的項目
  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      // 關鍵字搜尋
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.effect && item.effect.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.event && item.event.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.effects && item.effects.some(e => e.text.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      // 魔奏者分類標籤
      if (config?.type === 'chanter') {
        if (activeCategory === 'keys' && item.itemType !== 'key') return false;
        if (activeCategory === 'tones' && item.itemType !== 'tone') return false;
      }

      return true;
    });
  }, [rawItems, searchQuery, activeCategory, config]);

  // 切換勾選項目
  const handleToggleOption = (itemName) => {
    setDraftSelected(prev => {
      const exists = prev.includes(itemName);
      if (exists) {
        return prev.filter(n => n !== itemName);
      } else {
        // 若已達上限，禁止加入
        if (prev.length >= maxQuota) {
          return prev;
        }
        return [...prev, itemName];
      }
    });
  };

  // 清空已選項目
  const handleClear = () => {
    setDraftSelected([]);
  };

  // 儲存配置
  const handleConfirm = () => {
    if (config?.type === 'chanter') {
      // 魔奏者整理為 { keys: [], tones: [] } 格式返回
      const keysList = (CHANTER_DATA.keys || []).map(k => k.name);
      const tonesList = (CHANTER_DATA.tones || []).map(t => t.name);
      const keys = draftSelected.filter(n => keysList.includes(n));
      const tones = draftSelected.filter(n => tonesList.includes(n));
      onSave({ keys, tones, raw: draftSelected });
    } else {
      onSave(draftSelected);
    }
    onClose();
  };

  if (!config) return null;

  // 計算配額狀態
  const currentCount = draftSelected.length;
  const remainingCount = maxQuota - currentCount;
  const isOver = currentCount > maxQuota;
  const isComplete = currentCount === maxQuota;
  const isUnder = currentCount < maxQuota;

  // 魔奏者專屬規則驗證（至少各選 1 項音調與 1 項曲風）
  const chanterValidation = useMemo(() => {
    if (config.type !== 'chanter' || currentCount === 0) return { valid: true };
    const keysList = (CHANTER_DATA.keys || []).map(k => k.name);
    const tonesList = (CHANTER_DATA.tones || []).map(t => t.name);
    const hasKey = draftSelected.some(n => keysList.includes(n));
    const hasTone = draftSelected.some(n => tonesList.includes(n));
    if (!hasKey) return { valid: false, message: '請至少選擇 1 項音調' };
    if (!hasTone) return { valid: false, message: '請至少選擇 1 項曲風' };
    return { valid: true };
  }, [config, draftSelected, currentCount]);

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title={`【${skillName}】子項目構築`}
      maxWidth="max-w-4xl"
      theme={theme}
      actionButtons={
        <div className="flex items-center justify-between w-full flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[#6b5a4b] hover:text-[#76252d] hover:bg-[#f9f5eb] border border-[#d6c7ab] transition-colors cursor-pointer"
          >
            <GiTrashCan className="w-4 h-4" />
            <span>清空已選項目</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded border border-[#d6c7ab] text-[#6b5a4b] hover:bg-[#f4ebd9] font-medium transition-colors cursor-pointer"
            >
              取消返回
            </button>
            <JRPGButton
              variant="primary"
              size="sm"
              icon={GiCheckMark}
              onClick={handleConfirm}
              disabled={isOver || !chanterValidation.valid}
            >
              確認並儲存配置
            </JRPGButton>
          </div>
        </div>
      }
    >
      <div className="p-4 sm:p-5 space-y-4 max-h-[72vh] overflow-y-auto">
        {/* ================= 頂部狀態與配額指示列 ================= */}
        <div className="p-3 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white" style={{ borderColor: theme?.border }}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#2c221e]">
                {className} · {skillName}
              </span>
              <JRPGBadge variant={theme?.badgeVariant || 'ink'} size="xs">
                SL {sl}
              </JRPGBadge>
              <span className="text-xs text-[#6b5a4b] font-mono">
                {config.quotaHint ? config.quotaHint(sl) : `上限 ${maxQuota} 個`}
              </span>

              {/* 規則速查入口 —— 只在這個技能有對應速查頁時出現。
                  為什麼要給按鈕，而不是只靠技能文字裡的可點關鍵詞：技能文字寫的是
                  「見【園藝表】」這種漢化留下來的表名，字體上只是一條細細的虛線，
                  萌新不容易發現它是可以點的。 */}
              {codexRule && (
                <button
                  type="button"
                  onClick={() => openRuleCodex(skillName)}
                  title={`開啟規則速查「${codexRule.title}」（${codexRule.page}）`}
                  className="text-t11 font-bold px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#f9f5eb] text-[#3c2415] hover:bg-[#f4ebd9] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <GiBookCover className="w-3.5 h-3.5" />
                  <span>規則速查：{codexRule.title}</span>
                </button>
              )}
            </div>
            <p className="text-t12 text-[#6b5a4b] mt-0.5">
              本清單共 {rawItems.length} 項；技能等級決定你能掌握幾項
              （目前 SL {sl} → 上限 {maxQuota} 項，不是全部都能拿）。
              {codexRule && `完整機制（含運作方式與出處頁碼）見「規則速查：${codexRule.title}」。`}
            </p>
          </div>

          {/* 配額指示徽章 */}
          <div className="flex items-center gap-2">
            {isOver && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36]/50 font-bold text-xs">
                <GiHazardSign className="w-3.5 h-3.5 shrink-0" />
                <span>已掌握 {currentCount} / {maxQuota}（超出 {currentCount - maxQuota} 個，請刪減）</span>
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] font-bold text-xs">
                <GiCheckMark className="w-3.5 h-3.5 shrink-0" />
                <span>已掌握 {currentCount} / {maxQuota}（已完成構築）</span>
              </div>
            )}
            {isUnder && currentCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] font-bold text-xs">
                <GiSparkles className="w-3.5 h-3.5 shrink-0" />
                <span>已掌握 {currentCount} / {maxQuota}（尚餘 {remainingCount} 個名額）</span>
              </div>
            )}
            {currentCount === 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ebd9] text-[#6b5a4b] border border-dashed border-[#d6c7ab] font-bold text-xs">
                <span>尚未配置任何項目（尚餘 {maxQuota} 個名額）</span>
              </div>
            )}
          </div>
        </div>

        {/* 魔奏者專屬規則提醒（至少 1 音調 + 1 曲風） */}
        {!chanterValidation.valid && (
          <div className="p-2.5 rounded bg-[#f9f5eb] border border-[#d6c7ab] text-[#3c2415] text-xs flex items-center gap-2">
            <GiHazardSign className="w-4 h-4 shrink-0 text-[#6b5a4b]" />
            <span>{chanterValidation.message}</span>
          </div>
        )}

        {/* 魔奏者音量全掌握說明條 */}
        {config.type === 'chanter' && (
          <div className="p-3 rounded bg-[#f9f5eb] border border-[#d6c7ab] text-[#3c2415] text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-[#3c2415]">
              <GiMusicalNotes className="w-4 h-4" />
              <span>音量體系（習得本技能自動全數掌握，無須消耗配額）：</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-t11">
              {CHANTER_DATA.volumes.map(vol => (
                <div key={vol.id} className="p-2 bg-white rounded border border-[#e8dcc4]">
                  <div className="font-bold text-[#3c2415] flex items-center justify-between">
                    <span>{vol.name}</span>
                    <span className="font-mono text-[#6b5a4b]">{vol.mp} MP</span>
                  </div>
                  <div className="text-[#6b5a4b] mt-0.5">{vol.target}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 混合變形：原版與公測變體的使用規則（形態庫與配額不變，變的是代價與後續動作） */}
        {isMutantForms && (
          <div
            data-testid="therioform-rules"
            className="p-3 rounded bg-[#f9f5eb] border border-[#8c2d36]/30 text-xs space-y-1"
          >
            <div className="font-bold flex items-center gap-1.5 flex-wrap text-[#8c2d36]">
              <GiDna2 className="w-4 h-4" />
              <span>{therioRules.label}：使用方式</span>
              {isTheriomorphosisVariant(variantId) && (
                <span className="text-t12 px-1.5 py-0.5 rounded border border-[#8c2d36]/50 bg-white font-bold">
                  【公測】變體
                </span>
              )}
            </div>
            {therioLines.map((line) => (
              <div key={line} className="text-t11 leading-relaxed text-[#3c2415]">
                {line}
              </div>
            ))}
            <div className="text-t11 leading-relaxed text-[#6b5a4b]">
              形態庫與配額不受變體影響：每取得一級學一個形態（目前 SL {sl} → 上限 {maxQuota} 個）。
            </div>
          </div>
        )}

        {/* ================= 搜尋與篩選標籤列 ================= */}
        <div className="flex flex-col sm:flex-row items-center gap-2 justify-between">
          {/* 搜尋輸入框 */}
          <div className="relative w-full sm:w-72">
            <GiMagnifyingGlass className="absolute left-3 top-2.5 w-4 h-4 text-[#6b5a4b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋項目名稱或效果描述..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#d6c7ab] rounded text-xs placeholder:text-[#6b5a4b] focus:outline-none focus:ring-1 focus:ring-[#3c2415]"
            />
          </div>

          {/* 魔奏者分類切換 */}
          {config.type === 'chanter' && (
            <div className="flex items-center gap-1 bg-[#f4ebd9] p-1 rounded border border-[#d6c7ab] text-xs">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeCategory === 'all' ? 'bg-white shadow-2xs text-[#2c221e] font-bold' : 'text-[#6b5a4b] hover:text-[#2c221e]'
                }`}
              >
                全部項目
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('keys')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeCategory === 'keys' ? 'bg-white shadow-2xs text-[#3c2415] font-bold' : 'text-[#6b5a4b] hover:text-[#2c221e]'
                }`}
              >
                音調（8 種）
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('tones')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeCategory === 'tones' ? 'bg-white shadow-2xs text-[#2c221e] font-bold' : 'text-[#6b5a4b] hover:text-[#2c221e]'
                }`}
              >
                曲風（7 種）
              </button>
            </div>
          )}
        </div>

        {/* ================= 項目卡片清單網格 ================= */}
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-[#fbf7ee] rounded border border-dashed border-[#d6c7ab] text-[#6b5a4b] text-xs">
            查無符合關鍵字「{searchQuery}」的項目。請嘗試其他搜尋詞。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredItems.map(item => {
              const isSelected = draftSelected.includes(item.name);
              const isDisabled = !isSelected && draftSelected.length >= maxQuota;

              return (
                <div
                  key={item.id || item.name}
                  onClick={() => !isDisabled && handleToggleOption(item.name)}
                  className={`p-3 rounded border text-xs space-y-1.5 transition-all select-none cursor-pointer ${
                    isSelected
                      ? 'bg-[#f9f5eb] border-[#d6c7ab] ring-1 ring-[#3c2415]/40'
                      : isDisabled
                      ? 'bg-[#fbf7ee]/60 border-[#d6c7ab] opacity-40 cursor-not-allowed'
                      : 'bg-white border-[#d6c7ab] hover:border-[#a63d40] hover:'
                  }`}
                >
                  {/* 標題與勾選標籤列 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[#a63d40] border-[#3c2415] text-[#fffdf9]'
                            : 'border-[#d6c7ab] bg-white'
                        }`}
                      >
                        {isSelected && <GiCheckMark className="w-3 h-3" />}
                      </div>

                      <span className={`font-bold tracking-wide text-sm flex items-center gap-1.5 ${isSelected ? 'text-[#2c221e] font-serif' : 'text-[#3c2415]'}`}>
                        {item.isOffensive && (
                          <span className="fu-icon text-[#8c2d36] font-bold" title="攻擊性咒語">
                            o
                          </span>
                        )}
                        <span>{item.name}</span>
                      </span>

                      {/* 類型標籤 */}
                      {item.typeLabel && (
                        <span className="text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] font-bold border border-[#d6c7ab]">
                          {item.typeLabel}
                        </span>
                      )}

                      {/* 屬性傷害圖示 (舞步與魔奏演奏已由文本內聯符號呈現，在此隱藏小標誌) */}
                      {!['dances', 'chanter'].includes(config.type) && (
                        <>
                          {item.affinity && (
                            <span className="flex items-center gap-0.5 text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab]">
                              <FUIcon name={item.affinity} className="text-xs" />
                              <span>{item.affinity}</span>
                            </span>
                          )}

                          {item.affinities && item.affinities.map(aff => (
                            <span key={aff} className="flex items-center gap-0.5 text-t10 px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab]">
                              <FUIcon name={aff} className="text-xs" />
                              <span>{aff}</span>
                            </span>
                          ))}

                          {item.damageType && (
                            <span className="flex items-center gap-0.5 text-t10 px-1.5 py-0.5 rounded bg-[#f9f5eb] text-[#8c2d36] border border-[#8c2d36]/30">
                              <FUIcon name={item.damageType} className="text-xs" />
                              <span>{item.damageType}</span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* 右側附加數據 (MP, 持續時間等) */}
                    <div className="flex items-center gap-1.5 shrink-0 text-t11 font-mono">
                      {item.mp && (
                        <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b] font-bold border border-[#d6c7ab]">
                          {item.mp} MP
                        </span>
                      )}
                      {item.duration && (
                        <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#6b5a4b]">
                          {item.duration}
                        </span>
                      )}
                      {item.event && (
                        <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#3c2415] text-t10">
                          {item.event}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 寓意 / 範例 */}
                  {item.quote && (
                    <div className="text-t11 text-[#3c2415] italic">
                      「{item.quote}」
                    </div>
                  )}
                  {item.examples && (
                    <div className="text-t11 text-[#6b5a4b]">
                      象徵範例：{item.examples}
                    </div>
                  )}

                  {/* 核心效果描述 */}
                  {item.effect && (
                    <p className="text-t11 text-[#3c2415] leading-relaxed">
                      {renderTextWithAffinities(item.effect)}
                    </p>
                  )}
                  {item.desc && (
                    <p className="text-t11 text-[#3c2415] leading-relaxed">
                      {renderTextWithAffinities(item.desc)}
                    </p>
                  )}

                  {/* 植物學家多階刻度效果 */}
                  {item.effects && (
                    <div className="space-y-1 pt-1 border-t border-[#e8dcc4]">
                      {item.effects.map((eff, eIdx) => (
                        <div key={eIdx} className="text-t11 flex items-start gap-1.5">
                          <span className="font-mono font-bold text-[#2c221e] bg-[#f4ebd9] px-1 py-0.2 rounded text-t10 shrink-0">
                            {eff.clock}
                          </span>
                          <span className="text-[#3c2415] leading-relaxed">{renderTextWithAffinities(eff.text)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </JRPGModal>
  );
}
