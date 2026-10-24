import React, { useState, useMemo } from 'react';
import {
  GiCancel,
  GiCheckMark,
  GiPotionBall,
  GiBroadsword,
  GiGears,
  GiSparkles,
  GiCog,
  GiHazardSign,
  GiSpellBook,
  GiRoundBottomFlask,
  GiCrystalBall
} from 'react-icons/gi';
import JRPGButton from '../../../../components/ui/JRPGButton';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import rulesData from '../../data/rulesData.json';
import { SPELLS_DATA as NPC_SPELLS_DATA } from '../../../npc-workshop/data/spells';
import {
  getMagitechBranch,
  getMagispherePool,
  getMagisphereSlotCount,
  getMagisphereOffensiveBonus,
  MAGISPHERE_MAGIC_CHECK,
  MAGITECH_CORE_NODES,
  magitechMaxTier,
  resolveMagitechNodes
} from '../../data/gadgetBranches';

/**
 * 修補匠【小工具】三大派系規則與節點元數據
 */
export const GADGET_TRACKS = [
  {
    id: 'alchemy',
    name: '煉金術',
    subtitle: '調配強效但隨機的即席混合藥劑',
    icon: GiRoundBottomFlask,
    themeColor: 'amber',
    nodes: [
      {
        tier: 1,
        tierName: '基礎益處',
        name: '基礎混合藥劑',
        cost: '3 IP',
        dice: '2d20',
        summary: '消耗 3 IP 擲 2 個 d20：一顆指派為目標，一顆指派為效果。',
        desc: '你可以執行使用庫存動作快速製作藥劑。花費 3 點 IP 擲 2 個 d20，將其中一個骰子指派給目標表，另一個骰子指派給效果表。'
      },
      {
        tier: 2,
        tierName: '進階益處',
        name: '進階混合藥劑',
        cost: '4 IP',
        dice: '3d20',
        summary: '消耗 4 IP 擲 3 個 d20：擇二指派為目標與效果（捨棄其餘 1 顆）。',
        desc: '花費 4 點 IP 擲 3 個 d20，將其中一個骰子指派給目標表，另一個骰子指派給效果表，並捨棄未分配的第 3 顆骰子。'
      },
      {
        tier: 3,
        tierName: '最高益處',
        name: '最高混合藥劑',
        cost: '5 IP',
        dice: '4d20',
        summary: '消耗 5 IP 擲 4 個 d20：擇二指派為目標與效果（捨棄其餘 2 顆）。',
        desc: '花費 5 點 IP 擲 4 個 d20，將其中一個骰子指派給目標表，另一個骰子指派給效果表，並捨棄未分配的其餘 2 顆骰子。'
      }
    ]
  },
  {
    id: 'infusion',
    name: '灌注術',
    subtitle: '為武器攻擊賦予屬性傷害與特殊異常',
    icon: GiBroadsword,
    themeColor: 'cyan',
    nodes: [
      {
        tier: 1,
        tierName: '基礎益處',
        name: '基礎灌注',
        cost: '2 IP',
        dice: '無檢定',
        summary: '解鎖低溫、焦火、電壓三種灌注，傷害額外 +5 且轉變為【冰】、【火】或【電】屬性。',
        desc: '攻擊命中後花費 2 IP 注入元素能量：攻擊傷害額外 +5 點，且傷害類型轉為【冰】、【火】或【電】屬性。'
      },
      {
        tier: 2,
        tierName: '進階益處',
        name: '進階灌注',
        cost: '2 IP',
        dice: '無檢定',
        summary: '追加解鎖疾風、驅邪、地震、暗影，傷害額外 +5 且轉為【風】、【光】、【土】或【暗】屬性。',
        desc: '攻擊命中後花費 2 IP：攻擊傷害額外 +5 點，且傷害類型轉為【風】、【光】、【土】或【暗】屬性。'
      },
      {
        tier: 3,
        tierName: '最高益處',
        name: '最高灌注',
        cost: '2 IP',
        dice: '無檢定',
        summary: '追加解鎖吸血（限單體恢復所失半數 HP 或 MP）與毒液（【毒】屬性 +5 傷害並使目標中毒）。',
        desc: '攻擊命中後花費 2 IP：【吸血】吸取目標所受傷害半數之 HP 或 MP（限單體目標）；【毒液】額外造成 5 點傷害，類型轉為【毒】且令目標陷入中毒狀態。'
      }
    ]
  },
  {
    id: 'magitech',
    name: '魔導科技',
    subtitle: '篡奪構裝體、製造魔加農與開發魔法球原型',
    icon: GiGears,
    themeColor: 'purple',
    /**
     * 節點本體在 `data/gadgetBranches.js` 的 `MAGITECH_CORE_NODES`——
     * 魔晶石制要改寫這一軌（刪魔加農、魔法球降檔），改寫規則必須與節點資料同住。
     * 這裡只留引用，不要就地展開成字面量。
     */
    nodes: MAGITECH_CORE_NODES
  }
];

export function calculateMaxMagitechSpells(characterLevel = 5) {
  if (characterLevel >= 40) return 7;
  if (characterLevel >= 20) return 5;
  return 3;
}

export default function TinkererGadgetsModal({
  isOpen,
  onClose,
  gadgetsData = {},
  tinkererSL = 1,
  characterLevel = 5,
  /**
   * 【小工具】選用的變體 id：`magitechArmament`／`magispheres`／null（核心）。
   * 官方 p.38 把魔導科技拆成兩條互斥分支，**只換第三軌**——
   * 煉金術與灌注術照舊，所以這裡只替換 `magitech` 那條軌道。
   */
  variantId = null,
  /**
   * 魔晶石是否處於「裝備受限」的模式（`modeRestrictsEquipment`）。
   * 為 true 時魔導科技**只剩兩個益處**：魔加農整檔刪除，魔法球原型降為進階
   * （科技奇幻手冊 p.133；規則與理由見 `data/gadgetBranches.js` 的 `resolveMagitechNodes`）。
   * 不傳＝false＝逐字照核心書三檔，行為與過去完全相同。
   */
  technoRestrictsEquipment = false,
  onSave
}) {
  if (!isOpen) return null;

  const branch = getMagitechBranch(variantId);
  const isMagispheres = branch?.id === 'magispheres';
  const maxMagitechTier = branch ? 3 : magitechMaxTier(technoRestrictsEquipment);

  // 當前分配狀態 (alchemy: 0~3, infusion: 0~3, magitech: 0~3／魔晶石制 0~2)
  const [alchemyTier, setAlchemyTier] = useState(gadgetsData?.alchemy || 0);
  const [infusionTier, setInfusionTier] = useState(gadgetsData?.infusion || 0);
  // 魔晶石制只有兩檔：存檔裡若有 3 點（開魔晶石之前投的），進場就夾回 2，
  // 否則畫面上會出現一個「已解鎖但不存在」的節點。夾值在按下儲存時才落盤。
  const [magitechTier, setMagitechTier] = useState(
    Math.min(gadgetsData?.magitech || 0, maxMagitechTier)
  );
  const [selectedSpells, setSelectedSpells] = useState(gadgetsData?.magitechSpells || []);
  const [spellSchoolFilter, setSpellSchoolFilter] = useState('全部');

  // 總分配點數
  const allocatedPoints = alchemyTier + infusionTier + magitechTier;
  const remainingPoints = tinkererSL - allocatedPoints;

  /**
   * 魔法球的咒語是「每個節點各挑 2 顆」（基礎 2／進階 4／上級 6）；
   * 核心【魔法球原型】才是「最高益處一次挑 3～7 顆」——魔晶石制下它降到進階，
   * 所以解鎖門檻跟著該軌的最高檔走，不寫死 3。
   */
  const spellPickerUnlocked = isMagispheres ? magitechTier >= 1 : magitechTier >= maxMagitechTier;
  const maxSpells = isMagispheres
    ? getMagisphereSlotCount(magitechTier)
    : calculateMaxMagitechSpells(characterLevel);
  const offensiveBonus = isMagispheres ? getMagisphereOffensiveBonus(magitechTier) : 0;

  // 38 門核心法術（自元素、熵系、靈魂三大學派）
  const coreSpellPool = useMemo(() => {
    return (rulesData.spells || []).filter(s => ['元素', '熵系', '靈魂'].includes(s.school));
  }, []);

  // 魔法球分支：依當前節點數組出可挑的咒語池（基礎＝至多三個生物、進階＝NPC 咒語、上級＝全部）
  const magispherePool = useMemo(() => (
    isMagispheres
      ? getMagispherePool(magitechTier, { coreSpells: rulesData.spells, npcSpells: NPC_SPELLS_DATA })
      : []
  ), [isMagispheres, magitechTier]);

  const spellPool = isMagispheres ? magispherePool : coreSpellPool;

  const schoolFilterOptions = useMemo(() => {
    if (!isMagispheres) return ['全部', '元素', '熵系', '靈魂'];
    const seen = [];
    for (const sp of magispherePool) {
      if (!seen.includes(sp.school)) seen.push(sp.school);
    }
    return ['全部', ...seen];
  }, [isMagispheres, magispherePool]);

  const filteredSpells = useMemo(() => {
    if (spellSchoolFilter === '全部') return spellPool;
    const hit = spellPool.filter(s => s.school === spellSchoolFilter);
    // 降階後篩選值可能已不存在（例如進階時選了「元素」）→ 退回全部，不要顯示空清單
    return hit.length > 0 ? hit : spellPool;
  }, [spellPool, spellSchoolFilter]);

  /** 第三軌：核心（魔晶石制只有兩檔），或變體分支的三節點。 */
  const tracks = useMemo(() => GADGET_TRACKS.map((track) => {
    if (track.id !== 'magitech') return track;
    if (branch) {
      return {
        ...track,
        name: branch.name,
        subtitle: branch.subtitle,
        icon: branch.id === 'magispheres' ? GiCrystalBall : track.icon,
        nodes: branch.nodes
      };
    }
    return {
      ...track,
      subtitle: technoRestrictsEquipment ? '篡奪構裝體與開發魔法球原型' : track.subtitle,
      nodes: resolveMagitechNodes(technoRestrictsEquipment)
    };
  }), [branch, technoRestrictsEquipment]);

  // 點擊節點處理函式
  const handleNodeClick = (trackId, clickedTier) => {
    let currentTier = 0;
    if (trackId === 'alchemy') currentTier = alchemyTier;
    if (trackId === 'infusion') currentTier = infusionTier;
    if (trackId === 'magitech') currentTier = magitechTier;

    // 情況 A：點擊當前最高已解鎖節點 -> 降級一階（取消分配）
    if (clickedTier === currentTier) {
      const nextTier = currentTier - 1;
      if (trackId === 'alchemy') setAlchemyTier(nextTier);
      if (trackId === 'infusion') setInfusionTier(nextTier);
      if (trackId === 'magitech') setMagitechTier(nextTier);
      return;
    }

    // 情況 B：點擊下一階節點（必須符合升級條件：clickedTier === currentTier + 1 且尚有點數）
    if (clickedTier === currentTier + 1 && remainingPoints > 0) {
      if (trackId === 'alchemy') setAlchemyTier(clickedTier);
      if (trackId === 'infusion') setInfusionTier(clickedTier);
      if (trackId === 'magitech') setMagitechTier(clickedTier);
      return;
    }

    // 其他情況皆為不可點擊（由 UI 反灰呈現）
  };

  // 切換原型咒語勾選
  const handleToggleSpell = (spellName) => {
    if (selectedSpells.includes(spellName)) {
      setSelectedSpells(selectedSpells.filter(s => s !== spellName));
    } else {
      if (selectedSpells.length >= maxSpells) return;
      setSelectedSpells([...selectedSpells, spellName]);
    }
  };

  const handleSave = () => {
    // 咒語只在「這條分支真的有咒語欄位」時寫入；降階後掉出咒語池的選擇一併丟棄
    // （與核心版「降階即清空」的既有語意一致）。
    const keptSpells = spellPickerUnlocked
      ? selectedSpells.filter(name => spellPool.some(sp => sp.name === name))
      : [];
    onSave({
      alchemy: alchemyTier,
      infusion: infusionTier,
      magitech: Math.min(magitechTier, maxMagitechTier),
      magitechSpells: keptSpells
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded shadow-e3 border border-[#d6c7ab] overflow-hidden font-sans text-[#3c2415]">
        
        {/* 頂部標題列 */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#3c2415] text-[#f7f3e8]">
          <div className="flex items-center gap-2.5">
            <GiCog className="w-6 h-6 animate-spin-slow text-[#e8dcc4]" />
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                <span>{branch ? `修補匠【${branch.name}】科技樹配置` : '修補匠【小工具】科技樹配置'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-mono font-normal">
                  技能等級 SL {tinkererSL}
                </span>
                {branch && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/25 font-bold">
                    【公測】分支
                  </span>
                )}
              </h2>
              <p className="text-t12 text-[#e8dcc4] opacity-90">
                {branch
                  ? `魔導科技已拆為兩條互斥分支（p.38）：煉金術與灌注術照舊，第三軌改用【${branch.name}】的三個節點`
                  : technoRestrictsEquipment
                    ? '魔晶石制（p.133）：魔導科技只有兩個益處——魔加農整檔不存在，魔法球原型降為進階'
                    : '三橫線進度節點樹 · 總解鎖節點數不可超過當前特技等級 (上限 5 點)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
            title="關閉"
          >
            <GiCancel className="w-5 h-5" />
          </button>
        </div>

        {/* 點數配置進度提示條 */}
        <div className="px-5 py-2.5 bg-[#f9f5eb] border-b border-[#e8dcc4] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#3c2415] flex items-center gap-1">
              <GiSparkles className="w-4 h-4 text-[#6b5a4b]" />
              <span>節點配置進度：</span>
            </span>
            <span className="font-mono text-sm font-bold text-[#3c2415]">
              {allocatedPoints} / {tinkererSL}
            </span>
            <span className={`px-2 py-0.5 rounded font-bold text-t11 ${ remainingPoints === 0 ? 'bg-[#fffdf9] text-[#3c2415] border border-[#3c2415] ' : 'bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab] ' }`}>
              {remainingPoints === 0 ? '✓ 點數已滿額' : `尚有 ${remainingPoints} 點可分配`}
            </span>
          </div>

          <span className="text-[#6b5a4b] text-t11">
            點擊可解鎖節點，點擊最末端的已解鎖節點可取消
          </span>
        </div>

        {/* 科技樹主體內容區 (可滾動) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* 三大派系科技橫線 */}
          <div className="space-y-5">
            {tracks.map((track) => {
              const TrackIcon = track.icon;
              let currentTier = 0;
              if (track.id === 'alchemy') currentTier = alchemyTier;
              if (track.id === 'infusion') currentTier = infusionTier;
              if (track.id === 'magitech') currentTier = magitechTier;

              return (
                <div
                  key={track.id}
                  className="p-4 rounded border border-[#d6c7ab] bg-[#fbf7ee]/50 space-y-3.5"
                >
                  {/* 分支標頭 */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab]">
                        <TrackIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#3c2415] font-serif">
                            {track.name}
                          </span>
                          <span className="text-t11 font-mono px-2 py-0.5 rounded bg-[#e8dcc4] text-[#3c2415] font-bold">
                            {currentTier === 0 ? '未研發' : currentTier === 1 ? '基礎益處' : currentTier === 2 ? '進階益處' : '最高益處'}
                          </span>
                        </div>
                        <p className="text-t11 text-[#6b5a4b]">
                          {track.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-t11 font-mono text-[#6b5a4b]">
                      當前階級：<strong className="text-[#6b5a4b] text-xs">Tier {currentTier} / 3</strong>
                    </div>
                  </div>

                  {/* 三節點橫向進度線 (三條橫線核心設計) */}
                  <div className="relative pt-2 pb-1">
                    {/* 底層水平連接軌道 */}
                    <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-[#e8dcc4] z-0 rounded-full" />
                    
                    {/* 解鎖進度軌道 */}
                    <div
                      className="absolute top-1/2 left-8 -translate-y-1/2 h-1 bg-[#a63d40] z-0 rounded-full transition-all duration-300"
                      style={{
                        width: currentTier === 0 ? '0%' : currentTier === 1 ? '25%' : currentTier === 2 ? '65%' : 'calc(100% - 4rem)'
                      }}
                    />

                    {/* 三個節點橫向排列 */}
                    <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-4">
                      {track.nodes.map((node) => {
                        const isUnlocked = node.tier <= currentTier;
                        const canUnlock = node.tier === currentTier + 1 && remainingPoints > 0;
                        const canRevoke = node.tier === currentTier;
                        const isInteractive = canUnlock || canRevoke;
                        const isGrayedOut = !isUnlocked && !canUnlock;

                        return (
                          <div
                            key={node.tier}
                            onClick={() => isInteractive && handleNodeClick(track.id, node.tier)}
                            className={`p-3 rounded border transition-all duration-200 flex flex-col justify-between select-none ${ isGrayedOut ? 'opacity-35 grayscale cursor-not-allowed bg-[#f4ebd9] border-[#e8dcc4] text-[#7c6a58] shadow-none' : isUnlocked ? 'bg-[#f9f5eb] border-[#d6c7ab] ring-1 ring-[#3c2415]/40 cursor-pointer' : 'bg-white border-[#d6c7ab] hover:border-[#3c2415] hover:scale-[1.02] cursor-pointer ring-2 ring-[#3c2415]/25' }`}
                          >
                            {/* 節點頂部狀態 */}
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="text-t10 font-bold uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-[#e8dcc4]/80 text-[#3c2415]">
                                {node.tierName}
                              </span>

                              <div className="flex items-center gap-1">
                                {isUnlocked ? (
                                  <span className="w-5 h-5 rounded-full bg-[#a63d40] text-[#fffdf9] flex items-center justify-center text-xs shadow-xs">
                                    <GiCheckMark className="w-3 h-3" />
                                  </span>
                                ) : canUnlock ? (
                                  <span className="text-t10 font-bold text-[#6b5a4b] bg-[#f4ebd9] px-1.5 py-0.5 rounded">
                                    可點擊解鎖
                                  </span>
                                ) : (
                                  <span className="text-t10 text-[#6b5a4b]">
                                    未滿足前置
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 節點名稱與消耗 */}
                            <div className="space-y-1 mb-2">
                              <div className="font-bold text-xs sm:text-sm text-[#2c221e] flex items-center justify-between">
                                <span>{node.name}</span>
                                <span className="font-mono text-t11 text-[#6b5a4b] font-semibold">
                                  {node.cost}
                                </span>
                              </div>
                              <p className="text-t11 text-[#6b5a4b] leading-relaxed">
                                {renderTextWithAffinities(node.summary)}
                              </p>
                            </div>

                            {/* 操作指示標籤 */}
                            <div className="pt-2 border-t border-[#d6c7ab]/60 flex items-center justify-between text-t10 font-bold">
                              <span className="text-[#6b5a4b] font-mono">
                                檢定: {node.dice}
                              </span>
                              {canRevoke && (
                                <span className="text-[#8c2d36] hover:underline">
                                  點擊取消分配
                                </span>
                              )}
                              {canUnlock && (
                                <span className="text-[#6b5a4b]">
                                  投入 1 點解鎖
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 咒語自選區：核心是最高益處的「魔法球原型」，變體魔法球則是每個節點各 2 顆 */}
          {spellPickerUnlocked && (
            <div className="p-4 rounded border border-[#d6c7ab] bg-[#f9f5eb] space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#e8dcc4] pb-2.5">
                <div className="flex items-center gap-2">
                  <GiCrystalBall className="w-5 h-5 text-[#3c2415]" />
                  <div>
                    <h3 className="font-bold text-[#3c2415] text-sm flex items-center gap-2">
                      <span>{isMagispheres ? '魔法球研發' : '魔法球原型咒語研發'}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#f4ebd9] text-[#6b5a4b] border border-[#d6c7ab] font-bold">
                        已配置 {selectedSpells.length} / {maxSpells} {isMagispheres ? '顆' : '門'}
                      </span>
                    </h3>
                    <p className="text-t12 text-[#6b5a4b]">
                      {isMagispheres
                        ? `每個節點各 2 顆 · 施法檢定一律 ${MAGISPHERE_MAGIC_CHECK}`
                          + `${offensiveBonus ? ` · 攻擊性咒語 +${offensiveBonus}` : ''}`
                          + ' · 不可選【毀盪】'
                        : '自元素、靈魂、熵系學派中任意挑選（5級 3門 · 20級 5門 · 40級 7門），日後戰鬥中可花費 2 IP 快捷施放'}
                    </p>
                  </div>
                </div>

                {/* 學派篩選器 */}
                <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#d6c7ab]">
                  {schoolFilterOptions.map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setSpellSchoolFilter(sc)}
                      className={`px-2.5 py-1 rounded text-t11 font-bold transition-all cursor-pointer ${ spellSchoolFilter === sc ? 'bg-[#3c2415] text-[#fffdf9] shadow-2xs' : 'text-[#6b5a4b] hover:bg-[#f4ebd9] ' }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>

              {/* 咒語網格列表 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredSpells.map((sp) => {
                  const isChecked = selectedSpells.includes(sp.name);
                  const isFull = selectedSpells.length >= maxSpells && !isChecked;

                  return (
                    <div
                      key={sp.name}
                      onClick={() => !isFull && handleToggleSpell(sp.name)}
                      className={`p-2.5 rounded border transition-all text-xs flex flex-col justify-between ${ isChecked ? 'bg-[#f4ebd9] border-[#3c2415] ring-1 ring-[#3c2415]/40' : isFull ? 'opacity-40 grayscale cursor-not-allowed bg-[#fbf7ee] border-[#d6c7ab] ' : 'bg-white border-[#d6c7ab] hover:border-[#7c6a58] cursor-pointer' }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-[#3c2415] flex items-center gap-1.5">
                            <span className="font-normal text-[#7c6a58]">{sp.school}</span>
                            {sp.name}
                          </span>
                          <span className="font-mono text-t10 text-[#6b5a4b] font-bold bg-[#f4ebd9] border border-[#d6c7ab] px-1.5 py-0.5 rounded">
                            {sp.mp} MP
                          </span>
                        </div>
                        <p className="text-t11 text-[#6b5a4b] line-clamp-2 leading-relaxed">
                          {renderTextWithAffinities(sp.effect || sp.desc)}
                        </p>
                      </div>

                      <div className="pt-2 mt-2 border-t border-[#d6c7ab]/60 flex items-center justify-between text-t10 text-[#6b5a4b]">
                        <span>
                          {sp.source === 'npc'
                            ? `NPC 咒語 · 需自訂化${sp.isOffensive && offensiveBonus ? ` · 攻擊性 +${offensiveBonus}` : ''}`
                            : `${sp.school}魔法 · ${sp.duration || '瞬發'}`}
                        </span>
                        <span className={`font-bold ${isChecked ? 'text-[#2c221e] ' : 'text-[#6b5a4b]'}`}>
                          {isChecked ? (isMagispheres ? '已開發魔法球' : '已收錄原型') : '點擊選取'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* 底部按鈕列 */}
        <div className="px-5 py-3.5 bg-[#fbf7ee] border-t border-[#d6c7ab] flex items-center justify-between gap-3">
          <div className="text-t11 text-[#6b5a4b]">
            {allocatedPoints < tinkererSL ? (
              <span className="text-[#6b5a4b] flex items-center gap-1">
                <GiHazardSign className="w-3.5 h-3.5" />
                尚有未分配的特技點數，您亦可先儲存日後再分配。
              </span>
            ) : (
              <span className="text-[#6b5a4b] flex items-center gap-1 font-bold">
                <GiCheckMark className="w-3.5 h-3.5" />
                科技樹節點配置符合目前特技等級！
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded border border-[#d6c7ab] text-xs text-[#6b5a4b] hover:text-[#2c221e] font-medium cursor-pointer"
            >
              取消
            </button>

            <JRPGButton
              variant="primary"
              size="sm"
              icon={GiCheckMark}
              onClick={handleSave}
            >
              儲存科技樹配置
            </JRPGButton>
          </div>
        </div>

      </div>
    </div>
  );
}
