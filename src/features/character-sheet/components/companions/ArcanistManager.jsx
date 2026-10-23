import React, { useState } from 'react';
import { GiSparkles, GiCancel, GiCheckMark, GiBroadsword, GiFlame } from 'react-icons/gi';
import { Plus } from 'lucide-react';
import { RULE_CODEX } from '../../data/ruleCodexData';
import { getCharacterLevel, calculateCharacterStats } from '../../utils/characterEngine';
import {
  usesVariantArcanist as detectVariantArcanist,
  getArcanistSummonCost,
  getArcanistSummonHeal,
  getArcanistDismissHeal,
  getArcanistSkillLevel,
  getBoundArcanaIds,
  getStartingArcanaQuota
} from '../../utils/arcanist';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';

export default function ArcanistManager({
  character,
  onChange,
  onOpenDice = null,
  showToast = () => {}
}) {
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false);
  const [quickSummon, setQuickSummon] = useState(false);
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
   * 判定本體在 `utils/arcanist.js`（與跑團面板的顯示條件共用同一份）。
   */
  const usesVariantArcanist = detectVariantArcanist(character);

  /**
   * 角色專屬 arcanistData。
   *
   * 這裡**刻意不預設任何綁定**：舊版預設把 `sword`（劍之阿爾卡納）塞進 boundArcana，於是新角色
   * 一打開面板就顯示「已契約 1 種」並掛著劍之阿爾卡納的連攜（+5 傷害、傷害視為無屬性）——
   * 玩家從沒選過，卻已經吃到數值。開局那一個阿爾卡納依規則是**自選**（Core p.133）。
   */
  const arcanistData = character.arcanistData || {
    boundArcana: [],
    customArcana: [],
    activeSummonId: null
  };

  const boundArcanaIds = getBoundArcanaIds(character);
  const startingQuota = getStartingArcanaQuota(character);


  // 核心版 9 個阿爾卡納永遠可用（變體版只是多一層脈衝，不是換掉整份清單）；
  // 變體角色再多出官方新給的 11 個範例阿爾卡納（id 不重疊，可直接串接）。
  const officialCatalog = usesVariantArcanist
    ? [...RULE_CODEX.arcana.catalog, ...RULE_CODEX.arcanaVariant.catalog]
    : RULE_CODEX.arcana.catalog;
  const allArcana = [...officialCatalog, ...(arcanistData.customArcana || [])];

  const activeArcana = allArcana.find(a => a.id === arcanistData.activeSummonId);

  /**
   * 召喚費明細。
   *
   * 舊版面只在「召喚中」那張卡上寫「召喚費 40／30 點 MP」——那句話不影響任何東西：
   * 按鈕照按、MP 一格沒扣、MP 不夠也照樣召喚。玩家實際玩過一輪的結論是
   * 「這塊是備忘錄，不是工具」，所以這裡把費用算出來、擋掉付不起的召喚、
   * 並且真的從 `currentMp` 扣。
   */
  const costInfo = getArcanistSummonCost(character, { quickSummon });
  const summonHeal = getArcanistSummonHeal(character);
  const dismissHeal = getArcanistDismissHeal(character);
  const quickSummonSL = usesVariantArcanist ? getArcanistSkillLevel(character, '快速召喚') : 0;
  const emergencySL = usesVariantArcanist ? 0 : getArcanistSkillLevel(character, '緊急秘儀');
  const stats = calculateCharacterStats(character) || {};
  const maxHp = Number(stats.maxHp) || 0;

  const clampHp = (value) => (maxHp > 0 ? Math.min(maxHp, value) : value);

  const handleSummon = (arcanaId) => {
    if (arcanistData.activeSummonId === arcanaId) {
      showToast('此阿爾卡納已在召喚中！', 'info');
      return;
    }
    const target = allArcana.find(a => a.id === arcanaId);
    if (!costInfo.affordable) {
      showToast(
        `MP 不足：召喚【${target?.name || '阿爾卡納'}】需要 ${costInfo.cost} 點 MP，目前只有 ${costInfo.curMp} 點。`,
        'warning'
      );
      return;
    }
    const nextMp = Math.max(0, costInfo.curMp - costInfo.cost);
    const curHp = character.currentHp === null || character.currentHp === undefined
      ? maxHp
      : Number(character.currentHp);
    const healedHp = summonHeal > 0 ? clampHp((Number.isFinite(curHp) ? curHp : maxHp) + summonHeal) : curHp;
    onChange({
      ...character,
      currentMp: nextMp,
      ...(summonHeal > 0 ? { currentHp: healedHp } : {}),
      arcanistData: {
        ...arcanistData,
        activeSummonId: arcanaId,
        // 快速召喚選項②「執行其脈衝」與「本回合不得自願解除」都只在召喚當下成立，
        // 這裡記一筆，讓介面能顯示限制而不是靠玩家記。
        summonLockedTurn: quickSummon && quickSummonSL > 0
          ? { at: new Date().toISOString(), quickSummon: true }
          : null
      },
      updatedAt: new Date().toISOString()
    });
    const parts = [`召喚【${target?.name || '阿爾卡納'}】降臨！消耗 ${costInfo.cost} 點 MP（剩餘 ${nextMp}）`];
    if (summonHeal > 0) parts.push(`【阿爾卡納再生】恢復 ${summonHeal} 點 HP`);
    if (quickSummon && quickSummonSL > 0) parts.push('【快速召喚】：本回合結束前不能自願解除此阿爾卡納');
    showToast(parts.join('；'), 'success');
  };


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

  const handleDismiss = () => {
    if (!activeArcana) return;
    setIsDismissModalOpen(true);
  };

  const confirmDismiss = () => {
    const curHp = character.currentHp === null || character.currentHp === undefined
      ? maxHp
      : Number(character.currentHp);
    const healedHp = dismissHeal > 0
      ? clampHp((Number.isFinite(curHp) ? curHp : maxHp) + dismissHeal)
      : curHp;
    onChange({
      ...character,
      ...(dismissHeal > 0 ? { currentHp: healedHp } : {}),
      arcanistData: { ...arcanistData, activeSummonId: null, summonLockedTurn: null },
      updatedAt: new Date().toISOString()
    });
    setIsDismissModalOpen(false);
    const note = dismissHeal > 0
      ? `；【秘術再生】你與場景內所有盟友恢復 ${dismissHeal} 點 HP`
      : '';
    showToast(`已自願解除【${activeArcana?.name}】並結算解除效果${note}！`, 'success');
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
    <div className="p-4 rounded-xl bg-[#fffdf9] border border-[#d6c7ab] space-y-4">
      {/* 標題與當前召喚狀態 */}
      <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <GiSparkles className="text-xl text-[#9c4d16]" />
          <div>
            <h3 className="text-sm font-bold text-[#9c4d16] flex items-center gap-2">
              <span>阿爾卡納契約法典與召喚面板</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f4ebd9] text-[#9c4d16] border border-[#9c4d16]">
                已契約: {boundArcanaIds.length} 種
              </span>
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCustomModalOpen(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#9c4d16] hover:bg-[#833f12] text-white shadow-2xs flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>自訂阿爾卡納</span>
        </button>
      </div>

      {/* 召喚費明細：把規則算給玩家看，而不是只在召喚中的卡片上寫一句「40 點」 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] px-1">
        <span className="font-mono font-bold text-[#27527a]">
          本次召喚消耗 {costInfo.cost} 點 MP
        </span>
        <span className="text-[#6b5a4b] font-mono">
          （基礎 {costInfo.base}
          {costInfo.emergencyDiscount > 0 ? ` − 緊急秘儀 ${costInfo.emergencyDiscount}` : ''}
          {costInfo.quickDiscount > 0 ? ` − 快速召喚 ${costInfo.quickDiscount}` : ''}
          ／目前 {costInfo.curMp} 點）
        </span>
        {costInfo.crisis && (
          <span className="px-1.5 py-0.5 rounded bg-[#f4ebd9] text-[#8c2d36] border border-[#8c2d36] font-bold">
            危機狀態
          </span>
        )}
        {emergencySL > 0 && !costInfo.crisis && (
          <span className="text-[#6b5a4b]">
            【緊急秘儀】只在危機狀態生效
          </span>
        )}
        {quickSummonSL > 0 && (
          <label className="flex items-center gap-1 cursor-pointer text-[#3c2415]">
            <input
              type="checkbox"
              checked={quickSummon}
              onChange={(e) => setQuickSummon(e.target.checked)}
              className="rounded border-[#9c4d16] text-[#9c4d16] focus:ring-[#9c4d16]"
            />
            <span>
              使用【快速召喚】①（MP −{quickSummonSL * 5}；本回合不得自願解除）
            </span>
          </label>
        )}
      </div>

      {/* 開局自選的額度提示：綁定和召喚在創角時就該選好一個（Core p.133） */}
      {boundArcanaIds.length === 0 && startingQuota > 0 && (
        <div className="p-2.5 rounded-lg bg-[#f4ebd9]/70 border border-[#9c4d16] text-[11px] text-[#9c4d16]">
          尚未綁定任何阿爾卡納。【綁定和召喚】讓你在開始遊戲前自選 {startingQuota} 個——
          勾選下方清單中的一項即可完成開局綁定，之後只能透過探索與故事推進取得新的阿爾卡納。
        </div>
      )}

      {/* 當前召喚中狀態卡片。
          v5：全程淺色。這張卡片說的是「狀態」（召喚中），所以用資訊色
          `#27527a` 承擔身份，面與字全部回到登記色；內凹槽只放二級墨。 */}
      {activeArcana ? (
        <div className="p-3.5 rounded-xl bg-[#fffdf9] border border-[#27527a] space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#27527a]" />
              <span className="font-bold text-sm tracking-wide text-[#27527a]">
                當前召喚中：{activeArcana.name}
              </span>
              <span className="text-[11px] text-[#6b5a4b] font-mono">
                領域：{activeArcana.domains}
              </span>
              <span className="text-[11px] text-[#6b5a4b] font-mono">
                召喚費 {costInfo.base} 點 MP
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1 bg-[#8c2d36] hover:bg-[#76252d] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
            >
              <span>自願解除</span>
            </button>
          </div>

          <div className="text-xs space-y-1 bg-[#f4ebd9] p-2.5 rounded-lg border border-[#e8dcc4]">
            <div>
              <span className="text-[#3c2415] font-bold">連攜常駐增益：</span>
              <span className="text-[#3c2415]">{renderTextWithAffinities(activeArcana.merge)}</span>
            </div>
            {usesVariantArcanist && (
              <div>
                <span className="text-[#27527a] font-bold">脈衝（技能動作 · 僅衝突場景）：</span>
                <span className="text-[#3c2415]">
                  {activeArcana.pulse
                    ? renderTextWithAffinities(activeArcana.pulse)
                    : '此阿爾卡納為核心版，沒有脈衝效果。'}
                </span>
                {activeArcana.pulse && levelDamageBonus > 0 && (
                  <span className="text-[#245c45] ml-1 font-mono font-bold">
                    (等級 {charLevel} 傷害 +{levelDamageBonus})
                  </span>
                )}
              </div>
            )}
            <div>
              <span className="text-[#3c2415] font-bold">解除爆發效果：</span>
              <span className="text-[#3c2415]">{renderTextWithAffinities(activeArcana.dismiss)}</span>
              {levelDamageBonus > 0 && (
                <span className="text-[#245c45] ml-1 font-mono font-bold">
                  (等級 {charLevel} 傷害 +{levelDamageBonus})
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-[#f4ebd9]/60 border border-dashed border-[#9c4d16] text-center text-xs text-[#9c4d16]/80">
          尚未召喚阿爾卡納。點擊下方已契約阿爾卡納進行「召喚」！
        </div>
      )}

      {/* 已契約阿爾卡納選擇與切換列表 */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[#6b5a4b] uppercase tracking-wider">
          已契約阿爾卡納清單
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {allArcana.map((arcana) => {
            const isBound = (arcanistData.boundArcana || []).includes(arcana.id);
            const isActive = arcanistData.activeSummonId === arcana.id;

            return (
              <div
                key={arcana.id}
                className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${ isActive ? 'bg-[#f4ebd9]/80 border-[#27527a]' : isBound ? 'bg-white border-[#9c4d16] ' : 'bg-[#fbf7ee]/60 border-[#d6c7ab] opacity-60' }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isBound}
                      onChange={() => handleToggleBound(arcana.id)}
                      className="rounded border-[#9c4d16] text-[#9c4d16] focus:ring-[#9c4d16] cursor-pointer"
                      title={isBound ? '已契約（點擊取消）' : '未契約（點擊綁定）'}
                    />
                    <strong className="text-[#2c221e] font-bold">
                      {arcana.name}
                    </strong>
                    {arcana.isCustom && (
                      <span className="text-[10px] bg-[#f4ebd9] text-[#5e387c] px-1 rounded">
                        自訂
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isBound && (
                      <button
                        type="button"
                        onClick={() => handleSummon(arcana.id)}
                        disabled={isActive || !costInfo.affordable}
                        title={!costInfo.affordable
                          ? `MP 不足：需要 ${costInfo.cost} 點，目前 ${costInfo.curMp} 點`
                          : `消耗 ${costInfo.cost} 點 MP`}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${ isActive ? 'bg-[#27527a] text-white cursor-default' : !costInfo.affordable ? 'bg-[#e8dcc4] text-[#6b5a4b] cursor-not-allowed' : 'bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#9c4d16] ' }`}
                      >
                        {isActive ? '召喚中' : `召喚（${costInfo.cost} MP）`}
                      </button>
                    )}
                    {arcana.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomArcana(arcana.id)}
                        className="text-[#7c6a58] hover:text-[#8c2d36] p-0.5"
                        title="刪除自訂阿爾卡納"
                      >
                        <GiCancel className="text-xs" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-[#6b5a4b]">
                  領域：{arcana.domains}
                  {arcana.pulse && (
                    <span className="ml-1 text-[#27527a] font-bold">· 有脈衝</span>
                  )}
                </div>
                <div className="text-[11px] text-[#3c2415] line-clamp-2">
                  <span className="font-bold text-[#27527a]">連攜：</span>
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
          <div className="bg-[#fffdf9] border border-[#9c4d16] rounded-2xl p-5 w-full max-w-md shadow-e3 space-y-4">
            <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2">
              <h3 className="text-sm font-bold text-[#9c4d16] flex items-center gap-2">
                <GiSparkles className="text-[#9c4d16]" />
                <span>創造自訂阿爾卡納</span>
              </h3>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="text-[#7c6a58] hover:text-[#6b5a4b]"
              >
                <GiCancel className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleAddCustomArcana} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#3c2415] mb-1">
                  阿爾卡納名稱
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="例如：日輪之阿爾卡納、海潮之阿爾卡納..."
                  className="w-full p-2 rounded-lg border border-[#9c4d16] bg-white text-[#2c221e] outline-none focus:border-[#9c4d16]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3c2415] mb-1">
                  領域
                </label>
                <input
                  type="text"
                  value={customDomains}
                  onChange={e => setCustomDomains(e.target.value)}
                  placeholder="例如：太陽、光明、生命、耀斑..."
                  className="w-full p-2 rounded-lg border border-[#9c4d16] bg-white text-[#2c221e] outline-none focus:border-[#9c4d16]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3c2415] mb-1">
                  連攜常駐增益
                </label>
                <textarea
                  rows={2}
                  value={customMerge}
                  onChange={e => setCustomMerge(e.target.value)}
                  placeholder="例如：對光屬性傷害擁有抗性。物防與魔防各獲得 +1 加值..."
                  className="w-full p-2 rounded-lg border border-[#9c4d16] bg-white text-[#2c221e] outline-none focus:border-[#9c4d16]"
                />
              </div>

              {/* 脈衝是變體版獨有的第三層（原文 p.25）。核心版沒有這欄，
                  填了也沒地方顯示，所以只在變體角色上出現。 */}
              {usesVariantArcanist && (
                <div>
                  <label className="block font-bold text-[#3c2415] mb-1">
                    脈衝效果（選填）
                  </label>
                  <textarea
                    rows={2}
                    value={customPulse}
                    onChange={e => setCustomPulse(e.target.value)}
                    placeholder="例如：【日輪灼燒】對一個可見敵人造成 15 點光屬性傷害..."
                    className="w-full p-2 rounded-lg border border-[#27527a] bg-white text-[#2c221e] outline-none focus:border-[#27527a]"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-[#3c2415] mb-1">
                  自願解除效果
                </label>
                <textarea
                  rows={2}
                  value={customDismiss}
                  onChange={e => setCustomDismiss(e.target.value)}
                  placeholder="例如：【日耀天頂】對所有可見敵對生物造成 30 點光屬性傷害（無視抗性）..."
                  className="w-full p-2 rounded-lg border border-[#9c4d16] bg-white text-[#2c221e] outline-none focus:border-[#9c4d16]"
                />
              </div>


              <div className="flex justify-end gap-2 pt-2 border-t border-[#d6c7ab]">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#d6c7ab] text-[#6b5a4b] font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#9c4d16] hover:bg-[#833f12] text-white font-bold shadow-sm"
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
          <div className="bg-[#fffdf9] border border-[#8c2d36] rounded-2xl p-5 w-full max-w-md shadow-e3 space-y-4">
            <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2">
              <h3 className="text-sm font-bold text-[#8c2d36] flex items-center gap-2">
                <GiFlame className="text-[#8c2d36]" />
                <span>自願解除結算：{activeArcana.name}</span>
              </h3>
              <button
                onClick={() => setIsDismissModalOpen(false)}
                className="text-[#7c6a58] hover:text-[#6b5a4b]"
              >
                <GiCancel className="text-lg" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#3c2415]">
                你即將在衝突中自願解除與【{activeArcana.name}】的連攜。此舉將釋放其爆發威力：
              </p>

              <div className="p-3 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab] text-[#8c2d36] space-y-1">
                <div className="font-bold">解除效果：</div>
                <div>{renderTextWithAffinities(activeArcana.dismiss)}</div>
                {levelDamageBonus > 0 && (
                  <div className="text-[#245c45] font-bold pt-1 border-t border-[#d6c7ab]/60">
                    ★ 角色等級為 {charLevel} 級，解除傷害額外獲得 +{levelDamageBonus} 點加值！
                  </div>
                )}
              </div>

              {/* 變體版沒有《阿爾卡納圓環》這個特技（它的技能表是另一份），
                  所以那條提示在變體角色身上是錯的，必須換成變體版自己的重點。 */}
              {usesVariantArcanist ? (
                <div className="p-2.5 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab] text-[11px] text-[#9c4d16]">
                  變體版規則：解除效果只在「自願解除」時觸發。場景結束、昏迷或死亡、離開場景造成的自動解除，一律不會觸發解除效果。
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab] text-[11px] text-[#9c4d16]">
                  若你擁有《阿爾卡納圓環》特技且裝備奧術武器，你在同一回合解除時可立即免費執行咒語動作！
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#d6c7ab]">
              <button
                type="button"
                onClick={() => setIsDismissModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#d6c7ab] text-[#6b5a4b] font-bold text-xs"
              >
                保留召喚
              </button>
              <button
                type="button"
                onClick={confirmDismiss}
                className="px-4 py-1.5 rounded-lg bg-[#8c2d36] hover:bg-[#76252d] text-white font-bold text-xs shadow-sm"
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
