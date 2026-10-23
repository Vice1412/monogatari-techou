import React from 'react';
import JRPGModal from '../../../components/ui/JRPGModal';
import NPCCardPreview from '../../npc-workshop/components/NPCCardPreview';
import CharacterCard from '../../character-sheet/components/CharacterCard';

export default function CharacterDrawer({
  isOpen,
  onClose,
  combatant
}) {
  if (!isOpen || !combatant) return null;

  const isPlayer = combatant.sourceType === 'character' || combatant.faction === '玩家隊伍';

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${combatant.name} - 參戰者詳細檔案`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {isPlayer && combatant.rawCharData ? (
          <CharacterCard character={combatant.rawCharData} />
        ) : combatant.rawNpcData ? (
          <NPCCardPreview npc={combatant.rawNpcData} />
        ) : (
          <div className="p-4 bg-[#fffdf9] rounded-xl border border-[#d6c7ab] space-y-2 text-xs">
            <h4 className="font-serif font-bold text-base text-[#2c221e]">{combatant.name}</h4>
            <div className="grid grid-cols-2 gap-2 text-[#6b5a4b] font-mono">
              <div>生命: {combatant.hp?.current} / {combatant.hp?.max}</div>
              <div>魔力: {combatant.mp?.current} / {combatant.mp?.max}</div>
              <div>物理防禦: {combatant.defense}</div>
              <div>魔法防禦: {combatant.magicDefense}</div>
              <div>先攻加值: +{combatant.initiative}</div>
              <div>階級: {combatant.rank}</div>
            </div>
          </div>
        )}
      </div>
    </JRPGModal>
  );
}
