import React, { useState } from 'react';
import { GiSpellBook, GiCancel, GiRollingDices, GiBiohazard } from 'react-icons/gi';
import { Plus, ClipboardPaste } from 'lucide-react';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { calculateCharacterStats } from '../../utils/characterEngine';
import { hasLegacyOffensiveSentinel } from '../../../npc-workshop/data/spells';

export default function ChimeristManager({
  character,
  onChange,
  onOpenDice = null,
  showToast = () => {}
}) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // 取得嵌合師相關特技 SL
  const chimeristClass = (character.classes || []).find(c => c.className === '嵌合師');
  const mimicSkill = (chimeristClass?.skills || []).find(s => s.name === '咒語模仿');
  const mimicSL = mimicSkill?.sl || 1;
  const maxSlots = mimicSL + 2;

  const cycleSkill = (chimeristClass?.skills || []).find(s => s.name === '惡性循環');
  const hasViciousCycle = (cycleSkill?.sl || 0) >= 1;

  // 取得角色專屬 chimeristData
  const chimeristData = character.chimeristData || {
    spellFormula: 'INS + WLP', // 預設或自選公式
    spells: []
  };

  const currentFormula = chimeristData.spellFormula || 'INS + WLP';
  const spells = chimeristData.spells || [];

  const updateChimeristData = (newData) => {
    onChange({
      ...character,
      chimeristData: {
        ...chimeristData,
        ...newData
      },
      updatedAt: new Date().toISOString()
    });
  };

  // 手動新增咒語表單 State
  const [newSpellName, setNewSpellName] = useState('');
  const [newSpecies, setNewSpecies] = useState('魔獸');
  const [newMp, setNewMp] = useState('10');
  const [newTarget, setNewTarget] = useState('一個生物');
  const [newDuration, setNewDuration] = useState('瞬發');
  const [newIsOffensive, setNewIsOffensive] = useState(true);
  const [newEffect, setNewEffect] = useState('');

  const handleSelectFormula = (formula) => {
    updateChimeristData({ spellFormula: formula });
    showToast(`攻擊性嵌合咒語施法公式已設定為【${formula}】！`, 'success');
  };

  const handleAddSpell = (e) => {
    e?.preventDefault();
    if (!newSpellName.trim()) {
      showToast('請輸入咒語名稱', 'warning');
      return;
    }
    if (spells.length >= maxSlots) {
      showToast(`記憶槽位已滿（上限 ${maxSlots} 個），請先遺忘舊咒語！`, 'warning');
      return;
    }

    const created = {
      id: `chim_${Date.now()}`,
      name: newSpellName.trim(),
      species: newSpecies,
      mp: newMp.trim() || '10',
      target: newTarget.trim() || '一個生物',
      duration: newDuration.trim() || '瞬發',
      isOffensive: newIsOffensive,
      effect: newEffect.trim() || '無詳細效果說明'
    };

    updateChimeristData({ spells: [...spells, created] });
    resetForm();
    setIsAddModalOpen(false);
    showToast(`成功記錄嵌合師咒語【${created.name}】（源頭：${created.species}）！`, 'success');
  };

  const resetForm = () => {
    setNewSpellName('');
    setNewSpecies('魔獸');
    setNewMp('10');
    setNewTarget('一個生物');
    setNewDuration('瞬發');
    setNewIsOffensive(true);
    setNewEffect('');
  };

  const handleDeleteSpell = (id) => {
    const next = spells.filter(s => s.id !== id);
    updateChimeristData({ spells: next });
    showToast('已遺忘該嵌合師咒語');
  };

  // 一鍵解析 NPC 工坊複製文本
  const handleParsePastedText = () => {
    if (!pasteContent.trim()) {
      showToast('請先貼入 NPC 工坊文字', 'warning');
      return;
    }

    // 範例格式：
    // > **[攻擊性標記] 劇毒吐息** (MP: 10 | 目標: 一個生物 | 持續: 瞬發)
    // > 對目標造成【HR + 15】毒屬性傷害。
    const text = pasteContent.trim();
    let name = '';
    let isOffensive = hasLegacyOffensiveSentinel(text) || text.includes('（o）') || text.includes('(o)');
    let mp = '10';
    let target = '一個生物';
    let duration = '瞬發';
    let effect = '';
    let detectedSpecies = '魔獸';

    // 嘗試辨識物種
    if (text.includes('野獸') || text.toLowerCase().includes('beast')) detectedSpecies = '野獸';
    else if (text.includes('植物') || text.toLowerCase().includes('plant')) detectedSpecies = '植物';
    else if (text.includes('魔獸') || text.toLowerCase().includes('monster')) detectedSpecies = '魔獸';

    // 匹配咒語名稱：如 **〔攻擊性標記〕劇毒吐息** 或 **劇毒吐息**
    // 註：`\u26A1`（攻擊性）與 `\u2728`（非攻擊性）為舊版 NPC 匯出文字的前綴標記，
    //     僅供解析相容，永不渲染；以跳脫序列表示，避免原始碼出現 Emoji 字面量。
    const nameMatch = text.match(/\*\*([^*]+)\*\*/);
    if (nameMatch) {
      name = nameMatch[1].replace(/[\u26A1\u2728(o)（o）]/g, '').trim();
    }

    // 匹配 MP、目標、持續
    const mpMatch = text.match(/MP:\s*([^|\n)]+)/i);
    if (mpMatch) mp = mpMatch[1].trim();

    const targetMatch = text.match(/目標:\s*([^|\n)]+)/i);
    if (targetMatch) target = targetMatch[1].trim();

    const durMatch = text.match(/持續:\s*([^|\n)]+)/i);
    if (durMatch) duration = durMatch[1].trim();

    // 提取效果（通常在第二行或去除標題後）
    const lines = text.split('\n').map(l => l.replace(/^>\s*/, '').trim()).filter(Boolean);
    if (lines.length > 1) {
      effect = lines.slice(1).join('\n');
    } else {
      effect = text;
    }

    setNewSpellName(name || '未命名怪物咒語');
    setNewSpecies(detectedSpecies);
    setNewMp(mp);
    setNewTarget(target);
    setNewDuration(duration);
    setNewIsOffensive(isOffensive);
    setNewEffect(effect);

    setIsPasteModalOpen(false);
    setIsAddModalOpen(true);
    setPasteContent('');
    showToast('已自動解析文本！請確認各欄位後點擊儲存', 'success');
  };

  const handleCastSpell = (spell) => {
    // 扣除 MP
    const mpCost = parseInt(spell.mp.replace(/\D/g, ''), 10) || 0;
    if (mpCost > 0) {
      const stats = calculateCharacterStats(character);
      const currentMp = character.currentMp !== null && character.currentMp !== undefined ? character.currentMp : (stats.maxMp || 40);
      if (currentMp < mpCost) {
        showToast(`目前 MP (${currentMp}) 不足以支付該咒語 (${mpCost} MP)！`, 'warning');
        return;
      }
      const nextMp = Math.max(0, currentMp - mpCost);
      onChange({
        ...character,
        currentMp: nextMp,
        updatedAt: new Date().toISOString()
      });
    }

    if (spell.isOffensive && onOpenDice) {
      const isInsWlp = currentFormula.includes('INS');
      const attr1 = isInsWlp ? 'INS' : 'MIG';
      const attr2 = 'WLP';
      const die1 = character.attributes?.[attr1.toLowerCase()] || 8;
      const die2 = character.attributes?.[attr2.toLowerCase()] || 8;

      onOpenDice({
        die1,
        die2,
        modifier: 0,
        label: `施放嵌合師咒語【${spell.name}】[${attr1} + ${attr2}]`
      });
    }

    showToast(`施放【${spell.name}】！消耗 ${mpCost} MP`, 'success');
  };

  return (
    <div className="p-4 rounded-xl bg-[#fffdf9] border border-[#d6c7ab] space-y-4">
      {/* 頂部標題與施法公式設定 */}
      <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <GiSpellBook className="text-xl text-[#6b5a4b]" />
          <div>
            <h3 className="text-sm font-bold text-[#2c221e] flex items-center gap-2">
              <span>嵌合魔典與怪物咒語記憶本</span>
              <span className={`text-t10 font-mono px-2 py-0.5 rounded border ${ spells.length >= maxSlots ? 'bg-[#f4ebd9] text-[#8c2d36] border-[#8c2d36]/50' : 'bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab] ' }`}>
                記憶容量: {spells.length} / {maxSlots} 格
              </span>
            </h3>
          </div>
        </div>

        {/* 施法公式切換器 */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#6b5a4b] font-bold">施法檢定:</span>
          <button
            type="button"
            onClick={() => handleSelectFormula('INS + WLP')}
            className={`px-2 py-0.5 rounded font-mono font-bold transition-all ${ currentFormula === 'INS + WLP' ? 'bg-[#3c2415] text-[#fffdf9] shadow-xs' : 'bg-[#f4ebd9] text-[#6b5a4b] hover:bg-[#fffdf9]' }`}
          >
            【INS + WLP】
          </button>
          <button
            type="button"
            onClick={() => handleSelectFormula('MIG + WLP')}
            className={`px-2 py-0.5 rounded font-mono font-bold transition-all ${ currentFormula === 'MIG + WLP' ? 'bg-[#3c2415] text-[#fffdf9] shadow-xs' : 'bg-[#f4ebd9] text-[#6b5a4b] hover:bg-[#fffdf9]' }`}
          >
            【MIG + WLP】
          </button>
        </div>
      </div>

      {/* 惡性循環連攜提示 */}
      {hasViciousCycle && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab] text-xs text-[#2c221e]">
          <GiBiohazard className="text-base text-[#6b5a4b] shrink-0" />
          <span>已學習《惡性循環》特技：當你的咒語對同源物種生物造成傷害時，將必定使其陷入中毒狀態！</span>
        </div>
      )}

      {/* 動作按鈕：貼上導入 / 手動新增 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-[#6b5a4b]">已記憶怪物咒語清單</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] shadow-2xs flex items-center gap-1 transition-colors"
            title="貼上從 NPC 工坊複製的文字一鍵導入"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>NPC工坊文本導入</span>
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            disabled={spells.length >= maxSlots}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
              spells.length >= maxSlots
                ? 'bg-[#d6c7ab] text-[#6b5a4b] cursor-not-allowed'
                : 'bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] shadow-2xs'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>手動記錄咒語</span>
          </button>
        </div>
      </div>

      {/* 咒語列表 */}
      <div className="space-y-2.5">
        {spells.map((sp) => (
          <div
            key={sp.id}
            className="p-3.5 rounded-xl bg-white border border-[#e8dcc4] space-y-2"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#d6c7ab] pb-1.5">
              <div className="flex items-center gap-2">
                {sp.isOffensive ? (
                  <span className="fu-icon text-[#8c2d36] font-bold" title="攻擊性咒語">
                    o
                  </span>
                ) : (
                  <span className="text-[#6b5a4b] font-bold">✦</span>
                )}
                <strong className="text-sm text-[#2c221e]">{sp.name}</strong>
                <span className="text-t10 font-bold px-2 py-0.5 rounded bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]">
                  源頭: {sp.species}
                </span>
                <span className="text-xs font-mono font-bold text-[#3c2415]">
                  MP: {sp.mp}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCastSpell(sp)}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] shadow-sm flex items-center gap-1 transition-transform hover:scale-105"
                >
                  <GiRollingDices className="text-sm" />
                  <span>施放</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSpell(sp.id)}
                  className="p-1 rounded text-[#7c6a58] hover:text-[#76252d] transition-colors"
                  title="遺忘咒語"
                >
                  <GiCancel className="text-sm" />
                </button>
              </div>
            </div>

            <div className="text-t11 text-[#6b5a4b] font-mono flex items-center gap-3">
              <span>目標: {sp.target}</span>
              <span>持續: {sp.duration}</span>
              {sp.isOffensive && <span>檢定公式: 【{currentFormula}】</span>}
            </div>

            <div className="text-xs text-[#3c2415] leading-relaxed bg-[#fffdf9] p-2 rounded border border-[#d6c7ab]">
              <p>{renderTextWithAffinities(sp.effect)}</p>
              {hasViciousCycle && (
                <p className="mt-1 font-bold text-[#3c2415] text-t12 flex items-center gap-1 border-t border-[#d6c7ab] pt-1">
                  <GiBiohazard className="text-xs" />
                  <span>若目標是**{sp.species}**，目標同時陷入**中毒**狀態。</span>
                </p>
              )}
            </div>
          </div>
        ))}

        {spells.length === 0 && (
          <div className="p-6 text-center bg-white/60 rounded-xl border border-dashed border-[#d6c7ab] text-[#7c6a58] text-xs space-y-1">
            <GiSpellBook className="w-8 h-8 mx-auto text-[#7c6a58]" />
            <p className="font-bold text-[#6b5a4b]">尚未記錄任何嵌合師咒語</p>
            <p className="text-t12">可貼上 GM 或 NPC 工坊複製之文字一鍵匯入，或點擊「手動記錄咒語」！</p>
          </div>
        )}
      </div>

      {/* 貼上 NPC 工坊文本 Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fffdf9] border border-[#d6c7ab] rounded-2xl p-5 w-full max-w-lg shadow-e3 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e8dcc4] pb-2">
              <h3 className="text-sm font-bold text-[#2c221e] flex items-center gap-2">
                <GiClipboard className="text-[#6b5a4b]" />
                <span>NPC工坊文本一鍵導入</span>
              </h3>
              <button onClick={() => setIsPasteModalOpen(false)} className="text-[#7c6a58] hover:text-[#6b5a4b]">
                <GiCancel className="text-lg" />
              </button>
            </div>

            <p className="text-xs text-[#6b5a4b]">
              請直接在此貼上從 NPC 工坊導出的咒語區段文字或整份 NPC 卡片，系統將自動解析出名稱、MP、目標與效果：
            </p>

            <textarea
              rows={6}
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="例如：&#10;> **劇毒吐息** (MP: 10 | 目標: 一個生物 | 持續: 瞬發)&#10;> 對目標造成【HR + 15】毒屬性傷害，並使其陷入中毒狀態。"
              className="w-full p-2.5 rounded-lg border border-[#d6c7ab] bg-white text-[#2c221e] text-xs font-mono outline-none focus:border-[#a63d40]"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e8dcc4]">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#d6c7ab] text-[#6b5a4b] text-xs font-bold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleParsePastedText}
                className="px-4 py-1.5 rounded-lg bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold text-xs shadow-sm"
              >
                自動解析並導入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手動新增/確認咒語 Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fffdf9] border border-[#d6c7ab] rounded-2xl p-5 w-full max-w-md shadow-e3 space-y-4">
            <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2">
              <h3 className="text-sm font-bold text-[#2c221e] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#6b5a4b]" />
                <span>記錄嵌合師咒語</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#7c6a58] hover:text-[#6b5a4b]">
                <GiCancel className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleAddSpell} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#3c2415] mb-1">咒語名稱</label>
                <input
                  type="text"
                  value={newSpellName}
                  onChange={e => setNewSpellName(e.target.value)}
                  placeholder="例如：劇毒吐息、音波咆哮..."
                  className="w-full p-2 rounded-lg border border-[#d6c7ab] bg-white text-[#2c221e] outline-none focus:border-[#3c2415]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#3c2415] mb-1">源頭物種</label>
                  <select
                    value={newSpecies}
                    onChange={e => setNewSpecies(e.target.value)}
                    className="w-full p-2 rounded-lg border border-[#d6c7ab] bg-white text-[#2c221e] outline-none focus:border-[#3c2415]"
                  >
                    <option value="野獸">野獸 · BEAST</option>
                    <option value="魔獸">魔獸 · MONSTER</option>
                    <option value="植物">植物 · PLANT</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#3c2415] mb-1">MP 消耗</label>
                  <input
                    type="text"
                    value={newMp}
                    onChange={e => setNewMp(e.target.value)}
                    placeholder="10 或 10 × T"
                    className="w-full p-2 rounded-lg border border-[#d6c7ab] bg-white text-[#2c221e] outline-none focus:border-[#3c2415]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#3c2415] mb-1">目標</label>
                  <input
                    type="text"
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    placeholder="一個生物 / 至多 3 個生物"
                    className="w-full p-2 rounded-lg border border-[#d6c7ab] bg-white text-[#2c221e] outline-none focus:border-[#3c2415]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3c2415] mb-1">持續時間</label>
                  <input
                    type="text"
                    value={newDuration}
                    onChange={e => setNewDuration(e.target.value)}
                    placeholder="瞬發 / 場景"
                    className="w-full p-2 rounded-lg border border-[#d6c7ab] bg-white text-[#2c221e] outline-none focus:border-[#3c2415]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-offensive"
                  checked={newIsOffensive}
                  onChange={e => setNewIsOffensive(e.target.checked)}
                  className="rounded border-[#3c2415] text-[#6b5a4b] focus:ring-[#3c2415] cursor-pointer"
                />
                <label htmlFor="chk-offensive" className="font-bold text-[#3c2415] cursor-pointer flex items-center gap-1">
                  <span>這是一個攻擊性咒語（o）</span>
                  <span className="text-t11 text-[#7c6a58] font-normal">（將使用【{currentFormula}】檢定）</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-[#3c2415] mb-1">效果說明</label>
                <textarea
                  rows={3}
                  value={newEffect}
                  onChange={e => setNewEffect(e.target.value)}
                  placeholder="詳細效果說明..."
                  className="w-full p-2 rounded-lg border border-[#d6c7ab] bg-white text-[#2c221e] outline-none focus:border-[#3c2415]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#d6c7ab]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#d6c7ab] text-[#6b5a4b] font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] font-bold shadow-sm"
                >
                  記錄並保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
