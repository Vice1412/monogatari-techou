import React, { useState } from 'react';
import { GiSparkles, GiCancel, GiCheckMark, GiBroadsword, GiFlame } from 'react-icons/gi';
import { Plus } from 'lucide-react';
import { RULE_CODEX } from '../../data/ruleCodexData';
import { VARIANT_ARCANIST_CLASS_NAME } from '../../data/sourcebookConfig';
import { getCharacterLevel } from '../../utils/characterEngine';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';

export default function ArcanistManager({
  character,
  onChange,
  onOpenDice = null,
  showToast = () => {}
}) {
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDomains, setCustomDomains] = useState('');
  const [customMerge, setCustomMerge] = useState('');
  const [customPulse, setCustomPulse] = useState('');
  const [customDismiss, setCustomDismiss] = useState('');

  /**
   * 這個角色用的是不是「變體秘儀師」（§BF）。
   *
   * 核心版與變體版是**兩套規則**，差在三處：召喚費 40／30、等級傷害 +10·+20／+5·+10、
   * 以及變體版多一層【脈衝】。判定只認職業名，不認 `allowPlaytest`——
   * 開關決定「能不能選這個職業」，選了之後面板要反映的則是**這個角色實際拿到的規則**。
   */
  const usesVariantArcanist = (character.classes || [])
    .some((cl) => cl?.className === VARIANT_ARCANIST_CLASS_NAME);

  // 取得角色專屬 arcanistData
  const arcanistData = character.arcanistData || {
    boundArcana: ['sword'], // 預設綁定劍之阿爾卡納
    customArcana: [],
    activeSummonId: null
  };

  // 核心版 9 個阿爾卡納永遠可用（變體版只是多一層脈衝，不是換掉整份清單）；
  // 變體角色再多出官方新給的 11 個範例阿爾卡納（id 不重疊，可直接串接）。
  const officialCatalog = usesVariantArcanist
    ? [...RULE_CODEX.arcana.catalog, ...RULE_CODEX.arcanaVariant.catalog]
    : RULE_CODEX.arcana.catalog;
  const allArcana = [...officialCatalog, ...(arcanistData.customArcana || [])];

  const activeArcana = allArcana.find(a => a.id === arcanistData.activeSummonId);

  const updateArcanistData = (newData) => {
    onChange({
      ...character,
      arcanistData: {
        ...arcanistData,
        ...newData
      },
      updatedAt: new Date().toISOString()
    });
  };

  const handleToggleBound = (arcanaId) => {
    const current = arcanistData.boundArcana || [];
    let next;
    if (current.includes(arcanaId)) {
      next = current.filter(id => id !== arcanaId);
      if (arcanistData.activeSummonId === arcanaId) {
        updateArcanistData({ boundArcana: next, activeSummonId: null });
        return;
      }
    } else {
      next = [...current, arcanaId];
    }
    updateArcanistData({ boundArcana: next });
  };

  const handleSummon = (arcanaId) => {
    if (arcanistData.activeSummonId === arcanaId) {
      showToast('此阿爾卡納已在召喚中！', 'info');
      return;
    }
    updateArcanistData({ activeSummonId: arcanaId });
    const target = allArcana.find(a => a.id === arcanaId);
    showToast(`召喚【${target?.name || '阿爾卡納'}】降臨！獲得其連攜增益！`, 'success');
  };

  const handleDismiss = () => {
    if (!activeArcana) return;
    setIsDismissModalOpen(true);
  };

  const confirmDismiss = () => {
    updateArcanistData({ activeSummonId: null });
    setIsDismissModalOpen(false);
    showToast(`已自願解除【${activeArcana?.name}】並結算解除效果！`, 'success');
  };

  const handleAddCustomArcana = (e) => {
    e.preventDefault();
    if (!customName.trim()) {
      showToast('請輸入阿爾卡納名稱', 'warning');
      return;
    }
    const newArcana = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      domains: customDomains.trim() || '自訂領域',
      merge: customMerge.trim() || '自訂連攜效果',
      dismiss: customDismiss.trim() || '自訂解除效果',
      // 只有變體版才有脈衝；空字串＝不寫入，讓 `arcana.pulse` 維持 undefined，
      // 面板才會顯示「此阿爾卡納為核心版，沒有脈衝效果」而不是一個空括號。
      ...(usesVariantArcanist && customPulse.trim() ? { pulse: customPulse.trim() } : {}),
      isCustom: true
    };
    const nextCustom = [...(arcanistData.customArcana || []), newArcana];
    const nextBound = [...(arcanistData.boundArcana || []), newArcana.id];
    updateArcanistData({ customArcana: nextCustom, boundArcana: nextBound });
    setCustomName('');
    setCustomDomains('');
    setCustomMerge('');
    setCustomPulse('');
    setCustomDismiss('');
    setIsCustomModalOpen(false);
    showToast(`成功建立並綁定自訂阿爾卡納【${newArcana.name}】！`, 'success');
  };

  const handleDeleteCustomArcana = (id) => {
    const nextCustom = (arcanistData.customArcana || []).filter(a => a.id !== id);
    const nextBound = (arcanistData.boundArcana || []).filter(aid => aid !== id);
    updateArcanistData({
      customArcana: nextCustom,
      boundArcana: nextBound,
      activeSummonId: arcanistData.activeSummonId === id ? null : arcanistData.activeSummonId
    });
    showToast('已刪除自訂阿爾卡納');
  };

  const charLevel = getCharacterLevel(character);
  // 核心版：20 級 +10／40 級 +20。變體版：20 級 +5／40 級 +10（原文 p.25）。
  const levelDamageBonus = usesVariantArcanist
    ? (charLevel >= 40 ? 10 : charLevel >= 20 ? 5 : 0)
    : (charLevel >= 40 ? 20 : charLevel >= 20 ? 10 : 0);

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/80 via-white to-orange-50/60 dark:from-slate-900 dark:via-slate-800 dark:to-amber-950/20 border border-amber-300/80 dark:border-amber-700/60 shadow-sm space-y-4">
      {/* 標題與當前召喚狀態 */}
      <div className="flex items-center justify-between border-b border-amber-200 dark:border-slate-700 pb-2 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <GiSparkles className="text-xl text-amber-600 dark:text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span>阿爾卡納契約法典與召喚面板</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                已契約: {(arcanistData.boundArcana || []).length} 種
              </span>
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCustomModalOpen(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>自訂阿爾卡納</span>
        </button>
      </div>

      {/* 當前召喚中狀態卡片 */}
      {activeArcana ? (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white shadow-md border border-blue-400/40 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold text-sm tracking-wide text-cyan-200">
                當前召喚中：{activeArcana.name}
              </span>
              <span className="text-[11px] text-blue-200/80 font-mono">
                領域：{activeArcana.domains}
              </span>
              <span className="text-[11px] text-blue-200/80 font-mono">
                召喚費 {usesVariantArcanist ? 30 : 40} 點 MP
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
            >
              <span>自願解除</span>
            </button>
          </div>

          <div className="text-xs space-y-1 bg-black/30 p-2.5 rounded-lg border border-white/10">
            <div>
              <span className="text-cyan-300 font-bold">連攜常駐增益：</span>
              <span className="text-blue-100">{renderTextWithAffinities(activeArcana.merge)}</span>
            </div>
            {usesVariantArcanist && (
              <div>
                <span className="text-sky-300 font-bold">脈衝（技能動作 · 僅衝突場景）：</span>
                <span className="text-blue-100">
                  {activeArcana.pulse
                    ? renderTextWithAffinities(activeArcana.pulse)
                    : '此阿爾卡納為核心版，沒有脈衝效果。'}
                </span>
                {activeArcana.pulse && levelDamageBonus > 0 && (
                  <span className="text-emerald-300 ml-1 font-mono font-bold">
                    (等級 {charLevel} 傷害 +{levelDamageBonus})
                  </span>
                )}
              </div>
            )}
            <div>
              <span className="text-amber-300 font-bold">解除爆發效果：</span>
              <span className="text-stone-200">{renderTextWithAffinities(activeArcana.dismiss)}</span>
              {levelDamageBonus > 0 && (
                <span className="text-emerald-300 ml-1 font-mono font-bold">
                  (等級 {charLevel} 傷害 +{levelDamageBonus})
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-slate-900/60 border border-dashed border-amber-300 dark:border-amber-800 text-center text-xs text-amber-900/80 dark:text-amber-200/80">
          尚未召喚阿爾卡納。點擊下方已契約阿爾卡納進行「召喚」！
        </div>
      )}

      {/* 已契約阿爾卡納選擇與切換列表 */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
          已契約阿爾卡納清單
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {allArcana.map((arcana) => {
            const isBound = (arcanistData.boundArcana || []).includes(arcana.id);
            const isActive = arcanistData.activeSummonId === arcana.id;

            return (
              <div
                key={arcana.id}
                className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                  isActive
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 shadow-xs'
                    : isBound
                    ? 'bg-white dark:bg-slate-800 border-amber-300 dark:border-slate-700 shadow-2xs'
                    : 'bg-stone-50/60 dark:bg-slate-900/40 border-stone-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isBound}
                      onChange={() => handleToggleBound(arcana.id)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      title={isBound ? '已契約（點擊取消）' : '未契約（點擊綁定）'}
                    />
                    <strong className="text-stone-900 dark:text-stone-100 font-bold">
                      {arcana.name}
                    </strong>
                    {arcana.isCustom && (
                      <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1 rounded">
                        自訂
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isBound && (
                      <button
                        type="button"
                        onClick={() => handleSummon(arcana.id)}
                        disabled={isActive}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white cursor-default'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:hover:bg-amber-800 dark:text-amber-200'
                        }`}
                      >
                        {isActive ? '召喚中' : '召喚'}
                      </button>
                    )}
                    {arcana.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomArcana(arcana.id)}
                        className="text-stone-400 hover:text-red-600 p-0.5"
                        title="刪除自訂阿爾卡納"
                      >
                        <GiCancel className="text-xs" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-stone-500">
                  領域：{arcana.domains}
                  {arcana.pulse && (
                    <span className="ml-1 text-sky-700 dark:text-sky-400 font-bold">· 有脈衝</span>
                  )}
                </div>
                <div className="text-[11px] text-stone-700 dark:text-stone-300 line-clamp-2">
                  <span className="font-bold text-blue-700 dark:text-blue-300">連攜：</span>
                  {renderTextWithAffinities(arcana.merge)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 自訂阿爾卡納 Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fdfbf7] dark:bg-slate-900 border border-amber-400 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                <GiSparkles className="text-amber-600" />
                <span>創造自訂阿爾卡納</span>
              </h3>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <GiCancel className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleAddCustomArcana} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  阿爾卡納名稱
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="例如：日輪之阿爾卡納、海潮之阿爾卡納..."
                  className="w-full p-2 rounded-lg border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  領域
                </label>
                <input
                  type="text"
                  value={customDomains}
                  onChange={e => setCustomDomains(e.target.value)}
                  placeholder="例如：太陽、光明、生命、耀斑..."
                  className="w-full p-2 rounded-lg border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  連攜常駐增益
                </label>
                <textarea
                  rows={2}
                  value={customMerge}
                  onChange={e => setCustomMerge(e.target.value)}
                  placeholder="例如：對光屬性傷害擁有抗性。物防與魔防各獲得 +1 加值..."
                  className="w-full p-2 rounded-lg border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-500"
                />
              </div>

              {/* 脈衝是變體版獨有的第三層（原文 p.25）。核心版沒有這欄，
                  填了也沒地方顯示，所以只在變體角色上出現。 */}
              {usesVariantArcanist && (
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    脈衝效果（選填）
                  </label>
                  <textarea
                    rows={2}
                    value={customPulse}
                    onChange={e => setCustomPulse(e.target.value)}
                    placeholder="例如：【日輪灼燒】對一個可見敵人造成 15 點光屬性傷害..."
                    className="w-full p-2 rounded-lg border border-sky-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none focus:border-sky-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  自願解除效果
                </label>
                <textarea
                  rows={2}
                  value={customDismiss}
                  onChange={e => setCustomDismiss(e.target.value)}
                  placeholder="例如：【日耀天頂】對所有可見敵對生物造成 30 點光屬性傷害（無視抗性）..."
                  className="w-full p-2 rounded-lg border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-500"
                />
              </div>


              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 text-stone-600 dark:text-stone-400 font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm"
                >
                  完成並綁定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 解除結算確認 Modal */}
      {isDismissModalOpen && activeArcana && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fdfbf7] dark:bg-slate-900 border border-red-400 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-red-200 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <GiFlame className="text-red-600" />
                <span>自願解除結算：{activeArcana.name}</span>
              </h3>
              <button
                onClick={() => setIsDismissModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <GiCancel className="text-lg" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-stone-700 dark:text-stone-300">
                你即將在衝突中自願解除與【{activeArcana.name}】的連攜。此舉將釋放其爆發威力：
              </p>

              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-950 dark:text-red-200 space-y-1">
                <div className="font-bold">解除效果：</div>
                <div>{renderTextWithAffinities(activeArcana.dismiss)}</div>
                {levelDamageBonus > 0 && (
                  <div className="text-emerald-700 dark:text-emerald-400 font-bold pt-1 border-t border-red-200/60 dark:border-red-800/60">
                    ★ 角色等級為 {charLevel} 級，解除傷害額外獲得 +{levelDamageBonus} 點加值！
                  </div>
                )}
              </div>

              {/* 變體版沒有《阿爾卡納圓環》這個特技（它的技能表是另一份），
                  所以那條提示在變體角色身上是錯的，必須換成變體版自己的重點。 */}
              {usesVariantArcanist ? (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200">
                  變體版規則：解除效果只在「自願解除」時觸發。場景結束、昏迷或死亡、離開場景造成的自動解除，一律不會觸發解除效果。
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200">
                  若你擁有《阿爾卡納圓環》特技且裝備奧術武器，你在同一回合解除時可立即免費執行咒語動作！
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDismissModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 text-stone-600 dark:text-stone-400 font-bold text-xs"
              >
                保留召喚
              </button>
              <button
                type="button"
                onClick={confirmDismiss}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm"
              >
                確認解除並發動
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
