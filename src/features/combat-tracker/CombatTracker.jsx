import React, { useState, useEffect } from 'react';
import {
  Plus,
  RotateCcw,
  Wifi,
  WifiOff,
  Users,
  Trash2,
  Share2,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  GiCheckedShield,
  GiCrossedSwords,
  GiPocketWatch,
  GiSpikedDragonHead,
} from 'react-icons/gi';
import JRPGButton from '../../components/ui/JRPGButton';
import EmptyState from '../../components/ui/EmptyState';
import JRPGBadge from '../../components/ui/JRPGBadge';
import CombatantCard from './components/CombatantCard';
import AddCombatantModal from './components/AddCombatantModal';
import CharacterDrawer from './components/CharacterDrawer';
import ClockTracker from '../../components/ui/ClockTracker';
import { peerSync } from './utils/peerSync';
import { migrateNpcState } from '../npc-workshop/utils/npcEngine';
import { STORAGE_KEYS } from '../../data/keys';
import { readJSON, writeJSON } from '../../data/store';

const COMBAT_STORAGE_KEY = STORAGE_KEYS.activeCombat;

export default function CombatTracker() {
  const [round, setRound] = useState(1);
  const [combatants, setCombatants] = useState(() => {
    const parsed = readJSON(COMBAT_STORAGE_KEY, null);
    if (parsed && Array.isArray(parsed.combatants)) return parsed.combatants;
    return [];
  });

  const [sceneClocks, setSceneClocks] = useState(() => {
    const parsed = readJSON(COMBAT_STORAGE_KEY, null);
    if (parsed && Array.isArray(parsed.sceneClocks)) return parsed.sceneClocks;
    return [
      { id: 'sc_1', title: '主要威脅 / 戰場倒數', totalSegments: 6, filledSegments: 0, theme: 'red', type: 'circle' }
    ];
  });

  // Modal & Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [drawerCombatant, setDrawerCombatant] = useState(null);

  // Online Room State
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [connectedPeersCount, setConnectedPeersCount] = useState(0);

  // Load NPC library & character roster
  const [npcLibrary, setNpcLibrary] = useState([]);
  const [characterRoster, setCharacterRoster] = useState([]);

  useEffect(() => {
    // NPC 檔案庫改讀權威鍵。歷史上這裡讀 `fu_companion_npc_library`，
    // 而 NPC 工坊寫的是 `fabula-npc-library-v2` —— 兩者不同，所以永遠是空的。
    // 2026-10-16 起權威鍵為 `monogatari_techou_npc_library`，舊鍵由
    // store.migrateLegacyStorage() 在啟動時搬移（見 main.jsx 與 src/data/keys.js）。
    const savedNpcs = readJSON(STORAGE_KEYS.npcLibrary, []);
    setNpcLibrary(Array.isArray(savedNpcs) ? savedNpcs.map(migrateNpcState) : []);

    const savedChars = readJSON(STORAGE_KEYS.characterRoster, []);
    setCharacterRoster(Array.isArray(savedChars) ? savedChars : []);
  }, [isAddModalOpen]);

  // Persist combat state
  useEffect(() => {
    writeJSON(COMBAT_STORAGE_KEY, {
      round,
      combatants,
      sceneClocks
    });

    // If hosting, broadcast state to all connected players
    if (isHost && isConnected) {
      peerSync.broadcast('STATE_UPDATE', { round, combatants, sceneClocks });
    }
  }, [round, combatants, sceneClocks, isHost, isConnected]);

  // Setup PeerJS listeners
  useEffect(() => {
    peerSync.onStateReceived = (packet) => {
      if (packet.type === 'STATE_UPDATE' && packet.payload) {
        setRound(packet.payload.round || 1);
        setCombatants(packet.payload.combatants || []);
        setSceneClocks(packet.payload.sceneClocks || []);
      } else if (packet.type === 'PUSH_CHARACTER' && isHost) {
        // Player pushed their character into the room
        setCombatants(prev => [...prev, packet.payload]);
      }
    };

    peerSync.onPeerConnected = () => {
      setConnectedPeersCount(prev => prev + 1);
    };

    peerSync.onPeerDisconnected = () => {
      setConnectedPeersCount(prev => Math.max(0, prev - 1));
    };

    return () => {
      peerSync.destroy();
    };
  }, [isHost]);

  // Combatant actions
  const handleAddCombatant = (newCombatant) => {
    setCombatants(prev => [...prev, newCombatant]);
  };

  const handleUpdateCombatant = (updated) => {
    setCombatants(prev => prev.map(c => c.instanceId === updated.instanceId ? updated : c));
  };

  const handleRemoveCombatant = (instanceId) => {
    setCombatants(prev => prev.filter(c => c.instanceId !== instanceId));
  };

  const handleNextRound = () => {
    setRound(prev => prev + 1);
    // Reset hasActed for everyone
    setCombatants(prev => prev.map(c => ({ ...c, hasActed: false })));
  };

  const handleResetCombat = () => {
    if (window.confirm('確定要清空戰場並重置為第 1 輪嗎？')) {
      setRound(1);
      setCombatants([]);
    }
  };

  // Scene Clocks
  const handleAddSceneClock = () => {
    const newClock = {
      id: `sc_${Date.now()}`,
      title: '新場景危機',
      totalSegments: 6,
      filledSegments: 0,
      theme: 'red',
      type: 'circle'
    };
    setSceneClocks(prev => [...prev, newClock]);
  };

  const handleUpdateSceneClock = (clkId, newVal) => {
    setSceneClocks(prev => prev.map(c => c.id === clkId ? { ...c, filledSegments: newVal } : c));
  };

  const handleRemoveSceneClock = (clkId) => {
    setSceneClocks(prev => prev.filter(c => c.id !== clkId));
  };

  // Room Actions
  const handleCreateRoom = () => {
    const code = `FU-${Math.floor(1000 + Math.random() * 9000)}`;
    setRoomCode(code);
    setIsHost(true);
    setIsConnected(true);
    peerSync.createRoom(code, () => {
      // Room opened
    });
  };

  const handleJoinRoom = () => {
    if (!inputRoomCode.trim()) return;
    setIsHost(false);
    setIsConnected(true);
    setRoomCode(inputRoomCode.trim());
    peerSync.joinRoom(inputRoomCode.trim(), () => {
      // Joined
    });
  };

  // Group combatants into Player Team & Enemy/Other
  const playerCombatants = combatants.filter(c => c.sourceType === 'character' || c.faction === '玩家隊伍');
  const enemyCombatants = combatants.filter(c => c.sourceType !== 'character' && c.faction !== '玩家隊伍');

  const playerUnactedCount = playerCombatants.filter(c => !c.hasActed).length;
  const enemyUnactedCount = enemyCombatants.filter(c => !c.hasActed).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Round Controller */}
      <div className="bg-[#fffdf9] rounded-xl border border-[#d6c7ab] p-5 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#a63d40]" />

        {/* Round Counter */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#f4ebd9] border border-[#d6c7ab] flex flex-col items-center justify-center font-mono shadow-inner">
            <span className="text-t10 text-[#7c6a58] uppercase tracking-widest font-bold">ROUND</span>
            <span className="text-2xl font-bold text-[#3c2415] leading-none">{round}</span>
          </div>

          <div>
            <h2 className="font-serif font-black text-xl text-[#2c221e] flex items-center gap-2">
              <GiCrossedSwords className="w-5 h-5 text-[#6b5a4b]" /> 戰鬥與輪次管理中樞
            </h2>
            <div className="flex items-center gap-3 text-xs font-mono mt-1">
              <span className="text-[#2c221e] font-bold">
                玩家隊待行動: {playerUnactedCount} / {playerCombatants.length}
              </span>
              <span className="text-[#d6c7ab]">|</span>
              <span className="text-[#a63d40] font-bold">
                敵方待行動: {enemyUnactedCount} / {enemyCombatants.length}
              </span>
            </div>
          </div>
        </div>

        {/* Next Round & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <JRPGButton
            variant="primary"
            size="md"
            icon={ChevronRight}
            onClick={handleNextRound}
          >
            推進至下一輪
          </JRPGButton>

          <JRPGButton
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() => setIsAddModalOpen(true)}
          >
            調度參戰者
          </JRPGButton>

          <button
            onClick={handleResetCombat}
            className="p-2 text-[#6b5a4b] hover:text-[#76252d] hover:bg-[#f4ebd9] rounded-lg transition-colors border border-transparent hover:border-[#d6c7ab]"
            title="清空重置戰場"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Online Room Sync Bar (P2P WebRTC) */}
      <div className="bg-[#f4ebd9] rounded-xl border border-[#d6c7ab] p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          {isConnected ? (
            <div className="flex items-center gap-2 text-[#3c2415] font-mono font-bold">
              <Wifi className="w-4 h-4 text-[#6b5a4b]" />
              <span>
                {isHost ? 'GM 房間建立完成' : '已連線房間'}: <strong className="text-[#3c2415] bg-[#f4ebd9] px-1.5 py-0.5 rounded border border-[#d6c7ab]">{roomCode}</strong>
              </span>
              {isHost && (
                <span className="text-t11 text-[#6b5a4b] font-normal">
                  ({connectedPeersCount} 人同步中)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#6b5a4b] font-mono">
              <WifiOff className="w-4 h-4 text-[#7c6a58]" />
              <span>當前為本地單機模式（支援無網運行）</span>
            </div>
          )}
        </div>

        {/* Room Connect Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {!isConnected ? (
            <>
              <button
                onClick={handleCreateRoom}
                className="px-3 py-1.5 rounded-lg bg-[#a63d40] text-[#fffdf9] font-bold hover:bg-[#76252d] transition-colors shadow-sm"
              >
                + 開創連線房間
              </button>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="輸入房間碼 (如 FU-8821)"
                  value={inputRoomCode}
                  onChange={e => setInputRoomCode(e.target.value)}
                  className="bg-[#fffdf9] border border-[#d6c7ab] rounded-lg px-2.5 py-1 text-xs text-[#2c221e] uppercase font-mono w-36 focus:border-[#3c2415] outline-none"
                />
                <button
                  onClick={handleJoinRoom}
                  className="px-2.5 py-1 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab] hover:bg-[#e8dcc4] text-[#2c221e] font-bold transition-colors"
                >
                  加入
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                peerSync.destroy();
                setIsConnected(false);
                setRoomCode('');
              }}
              className="px-2.5 py-1 rounded-lg bg-[#fffdf9] border border-[#d6c7ab] text-[#6b5a4b] hover:text-[#76252d] hover:bg-[#f9f5eb] font-medium transition-colors"
            >
              斷開連線
            </button>
          )}
        </div>
      </div>

      {/* Scene Clocks (場景命刻) Bar */}
      <div className="bg-[#fffdf9] rounded-xl border border-[#d6c7ab] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#d6c7ab]/80 pb-2">
          <div className="flex items-center gap-2">
            <GiPocketWatch className="w-4 h-4 text-[#8c2d36]" />
            <h3 className="font-serif font-bold text-sm text-[#2c221e]">
              戰鬥場景命刻 (Scene Clocks - 危機倒數與環境進度)
            </h3>
          </div>
          <JRPGButton
            variant="ghost"
            size="xs"
            icon={Plus}
            onClick={handleAddSceneClock}
          >
            新增場景命刻
          </JRPGButton>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {sceneClocks.map(clk => (
            <div key={clk.id} className="relative group bg-[#fbf7ee] p-2.5 rounded-lg border border-[#d6c7ab]/80">
              <ClockTracker
                title={clk.title}
                totalSegments={clk.totalSegments || 6}
                filledSegments={clk.filledSegments || 0}
                theme={clk.theme || 'red'}
                type={clk.type || 'circle'}
                size={95}
                onChange={newVal => handleUpdateSceneClock(clk.id, newVal)}
              />
              <button
                type="button"
                onClick={() => handleRemoveSceneClock(clk.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[#7c6a58] hover:text-[#76252d] p-1 transition-opacity"
                title="刪除此命刻"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Combatants Grid: Left = Player Team, Right = Enemy Force */}
      <div className="space-y-6">
        {/* Player Party Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#d6c7ab] pb-2">
            <div className="flex items-center gap-2">
              <GiCheckedShield className="w-4 h-4 text-[#6b5a4b]" />
              <h3 className="font-serif font-bold text-base text-[#2c221e]">
                玩家小隊
              </h3>
              <JRPGBadge variant="slate" size="xs">
                {playerCombatants.length} 人
              </JRPGBadge>
            </div>
          </div>

          {playerCombatants.length === 0 ? (
            <EmptyState
              kind="combat-players"
              icon={GiCrossedSwords}
              title="還沒有人上場"
              teach="點上方「調度參戰者」從角色名冊載入參戰者；同一顆按鈕的「怪物庫」分頁負責敵方。"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {playerCombatants.map(c => (
                <CombatantCard
                  key={c.instanceId}
                  combatant={c}
                  onUpdate={handleUpdateCombatant}
                  onRemove={handleRemoveCombatant}
                  onOpenDrawer={setDrawerCombatant}
                />
              ))}
            </div>
          )}
        </div>

        {/* Enemy / Monster Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#a63d40]/40 pb-2">
            <div className="flex items-center gap-2">
              <GiCrossedSwords className="w-4 h-4 text-[#a63d40]" />
              <h3 className="font-serif font-bold text-base text-[#a63d40]">
                敵方怪物與 Boss
              </h3>
              <JRPGBadge variant="slate" size="xs">
                {enemyCombatants.length} 隻
              </JRPGBadge>
            </div>
          </div>

          {enemyCombatants.length === 0 ? (
            <EmptyState
              kind="combat-enemies"
              icon={GiSpikedDragonHead}
              title="戰場上還沒有敵方"
              teach="點「調度參戰者」→「怪物庫」派兵；反派 NPC 也可以從 NPC 工坊直接送上場。"
              tone="inset"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {enemyCombatants.map(c => (
                <CombatantCard
                  key={c.instanceId}
                  combatant={c}
                  onUpdate={handleUpdateCombatant}
                  onRemove={handleRemoveCombatant}
                  onOpenDrawer={setDrawerCombatant}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Combatant Modal */}
      <AddCombatantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        npcLibrary={npcLibrary}
        characterRoster={characterRoster}
        onAddCombatant={handleAddCombatant}
      />

      {/* Full Sheet Preview Drawer */}
      <CharacterDrawer
        isOpen={!!drawerCombatant}
        onClose={() => setDrawerCombatant(null)}
        combatant={drawerCombatant}
      />
    </div>
  );
}
