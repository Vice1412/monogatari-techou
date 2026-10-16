import React, { useState, useMemo, useEffect } from 'react';
import {
  GiSparkles,
  GiCheckMark,
  GiHazardSign,
  GiTrashCan,
  GiMagnifyingGlass,
  GiMusicalNotes,
  GiBookCover,
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
  theme
}) {
  const config = getSkillSuboptionConfig(className, skillName);
  const maxQuota = calculateSkillSuboptionMax(className, skillName, sl);

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
          >
            <GiTrashCan className="w-4 h-4" />
            <span>清空已選項目</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
            >
              取消返回
            </button>
            <JRPGButton
              variant={theme?.buttonVariant || 'primary'}
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
        <div className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white shadow-2xs" style={{ borderColor: theme?.border || '#e2e8f0' }}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900">
                {className} · {skillName}
              </span>
              <JRPGBadge variant={theme?.badgeVariant || 'gold'} size="xs">
                SL {sl}
              </JRPGBadge>
              <span className="text-xs text-slate-500 font-mono">
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
                  className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <GiBookCover className="w-3.5 h-3.5" />
                  <span>規則速查：{codexRule.title}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              依據官方規則，技能等級為你解鎖相應數量的專屬項目。
              {codexRule && `完整機制（含運作方式與出處頁碼）見「規則速查：${codexRule.title}」。`}
            </p>
          </div>

          {/* 配額指示徽章 */}
          <div className="flex items-center gap-2">
            {isOver && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs">
                <GiHazardSign className="w-3.5 h-3.5 shrink-0" />
                <span>已掌握 {currentCount} / {maxQuota}（超出 {currentCount - maxQuota} 個，請刪減）</span>
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs">
                <GiCheckMark className="w-3.5 h-3.5 shrink-0" />
                <span>已掌握 {currentCount} / {maxQuota}（已完成構築）</span>
              </div>
            )}
            {isUnder && currentCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                <GiSparkles className="w-3.5 h-3.5 shrink-0" />
                <span>已掌握 {currentCount} / {maxQuota}（尚餘 {remainingCount} 個名額）</span>
              </div>
            )}
            {currentCount === 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-dashed border-slate-300 font-bold text-xs">
                <span>尚未配置任何項目（尚餘 {maxQuota} 個名額）</span>
              </div>
            )}
          </div>
        </div>

        {/* 魔奏者專屬規則提醒（至少 1 音調 + 1 曲風） */}
        {!chanterValidation.valid && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
            <GiHazardSign className="w-4 h-4 shrink-0 text-amber-700" />
            <span>{chanterValidation.message}</span>
          </div>
        )}

        {/* 魔奏者音量全掌握說明條 */}
        {config.type === 'chanter' && (
          <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-950 text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-purple-900">
              <GiMusicalNotes className="w-4 h-4" />
              <span>音量體系（習得本技能自動全數掌握，無須消耗配額）：</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              {CHANTER_DATA.volumes.map(vol => (
                <div key={vol.id} className="p-2 bg-white rounded-lg border border-purple-100 shadow-2xs">
                  <div className="font-bold text-purple-950 flex items-center justify-between">
                    <span>{vol.name}</span>
                    <span className="font-mono text-purple-700">{vol.mp} MP</span>
                  </div>
                  <div className="text-slate-600 mt-0.5">{vol.target}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= 搜尋與篩選標籤列 ================= */}
        <div className="flex flex-col sm:flex-row items-center gap-2 justify-between">
          {/* 搜尋輸入框 */}
          <div className="relative w-full sm:w-72">
            <GiMagnifyingGlass className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋項目名稱或效果描述..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
            />
          </div>

          {/* 魔奏者分類切換 */}
          {config.type === 'chanter' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeCategory === 'all' ? 'bg-white shadow-2xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全部項目
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('keys')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeCategory === 'keys' ? 'bg-white shadow-2xs text-amber-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                音調（8 種）
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('tones')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeCategory === 'tones' ? 'bg-white shadow-2xs text-purple-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                曲風（7 種）
              </button>
            </div>
          )}
        </div>

        {/* ================= 項目卡片清單網格 ================= */}
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
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
                  className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all select-none cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/90 border-amber-400 shadow-xs ring-1 ring-amber-400/50'
                      : isDisabled
                      ? 'bg-slate-50/60 border-slate-200 opacity-40 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  {/* 標題與勾選標籤列 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <GiCheckMark className="w-3 h-3" />}
                      </div>

                      <span className={`font-bold tracking-wide text-sm flex items-center gap-1.5 ${isSelected ? 'text-amber-950 font-serif' : 'text-slate-800'}`}>
                        {item.isOffensive && (
                          <span className="fu-icon text-red-600 font-bold" title="攻擊性咒語">
                            o
                          </span>
                        )}
                        <span>{item.name}</span>
                      </span>

                      {/* 類型標籤 */}
                      {item.typeLabel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200">
                          {item.typeLabel}
                        </span>
                      )}

                      {/* 屬性傷害圖示 (舞步與魔奏演奏已由文本內聯符號呈現，在此隱藏小標誌) */}
                      {!['dances', 'chanter'].includes(config.type) && (
                        <>
                          {item.affinity && (
                            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                              <FUIcon name={item.affinity} className="text-xs" />
                              <span>{item.affinity}</span>
                            </span>
                          )}

                          {item.affinities && item.affinities.map(aff => (
                            <span key={aff} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                              <FUIcon name={aff} className="text-xs" />
                              <span>{aff}</span>
                            </span>
                          ))}

                          {item.damageType && (
                            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-900 border border-red-200">
                              <FUIcon name={item.damageType} className="text-xs" />
                              <span>{item.damageType}</span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* 右側附加數據 (MP, 持續時間等) */}
                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
                      {item.mp && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold border border-indigo-200">
                          {item.mp} MP
                        </span>
                      )}
                      {item.duration && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.duration}
                        </span>
                      )}
                      {item.event && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-900 text-[10px]">
                          {item.event}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 寓意 / 範例 */}
                  {item.quote && (
                    <div className="text-[11px] text-emerald-800 italic">
                      「{item.quote}」
                    </div>
                  )}
                  {item.examples && (
                    <div className="text-[11px] text-slate-500">
                      象徵範例：{item.examples}
                    </div>
                  )}

                  {/* 核心效果描述 */}
                  {item.effect && (
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {renderTextWithAffinities(item.effect)}
                    </p>
                  )}
                  {item.desc && (
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {renderTextWithAffinities(item.desc)}
                    </p>
                  )}

                  {/* 植物學家多階刻度效果 */}
                  {item.effects && (
                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      {item.effects.map((eff, eIdx) => (
                        <div key={eIdx} className="text-[11px] flex items-start gap-1.5">
                          <span className="font-mono font-bold text-emerald-900 bg-emerald-100 px-1 py-0.2 rounded text-[10px] shrink-0">
                            {eff.clock}
                          </span>
                          <span className="text-slate-700 leading-relaxed">{renderTextWithAffinities(eff.text)}</span>
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
