import React, { useState, useMemo } from 'react';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import { JRPGInput, JRPGSelect } from '../../../components/ui/JRPGInput';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import { exportNpcToCombatant } from '../../npc-workshop/utils/npcEngine';
import { exportCharacterToCombatant } from '../../character-sheet/utils/characterEngine';
import {
  Search,
  Plus,
  Shield,
  Folder,
  Tag,
} from 'lucide-react';
import {
  GiDragonHead,
  GiVisoredHelm,
} from 'react-icons/gi';
import { withEn } from '../../../utils/properNouns';

export default function AddCombatantModal({
  isOpen,
  onClose,
  npcLibrary = [],
  characterRoster = [],
  onAddCombatant
}) {
  const [tab, setTab] = useState('npc'); // 'npc' | 'character' | 'quick'
  const [search, setSearch] = useState('');
  const [selectedFaction, setSelectedFaction] = useState('ALL');

  // Quick summon / minion form state
  const [quickName, setQuickName] = useState('支援小兵');
  const [quickLevel, setQuickLevel] = useState(5);
  const [quickFaction, setQuickFaction] = useState('敵方');
  const [quickHp, setQuickHp] = useState(40);
  const [quickMp, setQuickMp] = useState(20);
  const [quickDef, setQuickDef] = useState(8);
  const [quickMDef, setQuickMDef] = useState(8);
  const [quickInit, setQuickInit] = useState(0);

  // Factions list in npc library
  const factions = useMemo(() => {
    const s = new Set(['未分類']);
    npcLibrary.forEach(n => {
      if (n.faction && n.faction.trim()) s.add(n.faction.trim());
    });
    return Array.from(s);
  }, [npcLibrary]);

  const filteredNpcs = useMemo(() => {
    return npcLibrary.filter(n => {
      if (selectedFaction !== 'ALL' && (n.faction || '未分類') !== selectedFaction) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const mName = (n.name || '').toLowerCase().includes(q);
        const mRole = (n.role || '').toLowerCase().includes(q);
        const mTags = (n.tags || []).some(t => t.toLowerCase().includes(q));
        if (!mName && !mRole && !mTags) return false;
      }
      return true;
    });
  }, [npcLibrary, selectedFaction, search]);

  const filteredChars = useMemo(() => {
    if (!search.trim()) return characterRoster;
    const q = search.toLowerCase();
    return characterRoster.filter(c => (c.name || '').toLowerCase().includes(q) || (c.identity || '').toLowerCase().includes(q));
  }, [characterRoster, search]);

  const handleAddNpc = (npc) => {
    const combatant = exportNpcToCombatant(npc);
    onAddCombatant(combatant);
    onClose();
  };

  const handleAddChar = (char) => {
    const combatant = exportCharacterToCombatant(char);
    onAddCombatant(combatant);
    onClose();
  };

  const handleAddQuick = (e) => {
    e.preventDefault();
    const combatant = {
      instanceId: `comb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId: `quick_${Date.now()}`,
      sourceType: 'quick',
      name: quickName || '小兵',
      avatar: null,
      faction: quickFaction,
      level: parseInt(quickLevel, 10) || 5,
      rank: '士兵',
      role: '小兵',
      species: '臨時',
      hp: {
        current: parseInt(quickHp, 10) || 40,
        max: parseInt(quickHp, 10) || 40,
        crisisThreshold: Math.floor((parseInt(quickHp, 10) || 40) / 2)
      },
      mp: {
        current: parseInt(quickMp, 10) || 20,
        max: parseInt(quickMp, 10) || 20
      },
      attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
      defense: parseInt(quickDef, 10) || 8,
      magicDefense: parseInt(quickMDef, 10) || 8,
      initiative: parseInt(quickInit, 10) || 0,
      hasActed: false,
      statusEffects: { slow: false, dazed: false, weak: false, shaken: false, enraged: false, poisoned: false },
      skills: []
    };
    onAddCombatant(combatant);
    onClose();
  };

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title="加入參戰者"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Source Tabs */}
        <div className="flex items-center gap-2 border-b border-[#d6c7ab]/80 pb-2">
          <button
            onClick={() => setTab('npc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              tab === 'npc' ? 'bg-[#a63d40] text-[#fffdf9]' : 'bg-[#eee6d3] text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#ebdcc4] border border-[#d6c7ab]'
            }`}
          >
            <GiDragonHead className="w-3.5 h-3.5" /> 怪物庫選取 ({npcLibrary.length})
          </button>
          <button
            onClick={() => setTab('character')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              tab === 'character' ? 'bg-[#a63d40] text-[#fffdf9]' : 'bg-[#eee6d3] text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#ebdcc4] border border-[#d6c7ab]'
            }`}
          >
            <GiVisoredHelm className="w-3.5 h-3.5" /> 玩家名冊選取 ({characterRoster.length})
          </button>
          <button
            onClick={() => setTab('quick')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              tab === 'quick' ? 'bg-[#a63d40] text-[#fffdf9]' : 'bg-[#eee6d3] text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#ebdcc4] border border-[#d6c7ab]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>快速自訂小兵/召喚物</span>
          </button>
        </div>

        {/* Tab 1: NPC Library */}
        {tab === 'npc' && (
          <div className="space-y-3">
            {/* Search & Faction Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#7c6a58] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜尋怪物名稱、定位或標籤..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#2c221e] outline-none focus:border-[#3c2415]"
                />
              </div>

              {/* Faction selector */}
              <select
                value={selectedFaction}
                onChange={e => setSelectedFaction(e.target.value)}
                className="bg-[#fffdf9] border border-[#d6c7ab] rounded-lg px-2.5 py-1.5 text-xs text-[#2c221e] outline-none font-medium"
              >
                <option value="ALL">全部陣營 ({npcLibrary.length})</option>
                {factions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {filteredNpcs.length === 0 ? (
                <div className="text-center py-8 text-[#7c6a58] text-xs font-mono">
                  沒有符合條件的怪物
                </div>
              ) : (
                filteredNpcs.map(npc => (
                  <div
                    key={npc.id}
                    className="p-3 rounded-lg bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#3c2415] flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#f5efdf] border border-[#d6c7ab] flex items-center justify-center font-bold text-[#3c2415] text-sm shrink-0">
                        {npc.name?.[0] || '魔'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[#2c221e] truncate">{npc.name}</span>
                          <JRPGBadge variant="gold" size="xs">Lv {npc.level}</JRPGBadge>
                          <JRPGBadge variant="slate" size="xs">{npc.rank}</JRPGBadge>
                        </div>
                        <div className="text-[11px] text-[#6b5a4b] font-mono mt-0.5">
                          <span>{withEn(npc.role)}</span>
                          {npc.faction && (
                            <span className="ml-2 text-[#3c2415] font-sans font-bold inline-flex items-center gap-0.5">
                              <Tag className="w-2.5 h-2.5" />
                              {npc.faction}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <JRPGButton
                      variant="primary"
                      size="xs"
                      onClick={() => handleAddNpc(npc)}
                    >
                      + 加入戰鬥
                    </JRPGButton>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Character Roster */}
        {tab === 'character' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7c6a58] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋角色姓名或身份..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#fffdf9] border border-[#d6c7ab] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#2c221e] outline-none focus:border-[#3c2415]"
              />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {filteredChars.map(char => (
                <div
                  key={char.id}
                  className="p-3 rounded-lg bg-[#fffdf9] border border-[#d6c7ab] hover:border-[#a63d40] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab] flex items-center justify-center font-bold text-[#3c2415] text-sm shrink-0">
                      {char.name?.[0] || '勇'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#2c221e] truncate">{char.name}</span>
                        <JRPGBadge variant="zinc" size="xs">Lv {char.level || 5}</JRPGBadge>
                      </div>
                      <div className="text-[11px] text-[#6b5a4b] truncate mt-0.5">
                        {char.identity}
                      </div>
                    </div>
                  </div>

                  <JRPGButton
                    variant="primary"
                    size="xs"
                    onClick={() => handleAddChar(char)}
                  >
                    + 加入隊伍
                  </JRPGButton>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Quick Minion */}
        {tab === 'quick' && (
          <form onSubmit={handleAddQuick} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <JRPGInput
                label="名稱"
                value={quickName}
                onChange={e => setQuickName(e.target.value)}
              />
              <JRPGSelect
                label="歸屬陣營"
                value={quickFaction}
                onChange={e => setQuickFaction(e.target.value)}
                options={[
                  { value: '敵方', label: '敵方怪物 / NPC' },
                  { value: '玩家隊伍', label: '玩家小隊 / 友方召喚物' },
                  { value: '中立', label: '中立第三勢力' }
                ]}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <JRPGInput
                label="最大 HP"
                type="number"
                value={quickHp}
                onChange={e => setQuickHp(e.target.value)}
              />
              <JRPGInput
                label="最大 MP"
                type="number"
                value={quickMp}
                onChange={e => setQuickMp(e.target.value)}
              />
              <JRPGInput
                label="等級"
                type="number"
                value={quickLevel}
                onChange={e => setQuickLevel(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <JRPGInput
                label="物理防禦"
                type="number"
                value={quickDef}
                onChange={e => setQuickDef(e.target.value)}
              />
              <JRPGInput
                label="魔法防禦"
                type="number"
                value={quickMDef}
                onChange={e => setQuickMDef(e.target.value)}
              />
              <JRPGInput
                label="先攻修正"
                type="number"
                value={quickInit}
                onChange={e => setQuickInit(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <JRPGButton type="submit" variant="primary" size="sm">
                + 確認快速建立並加入
              </JRPGButton>
            </div>
          </form>
        )}
      </div>
    </JRPGModal>
  );
}
