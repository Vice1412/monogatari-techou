import React, { useState } from 'react';
import {
  GiSpellBook,
  GiGears,
  GiRoundBottomFlask,
  GiBroadsword,
  GiSparkles,
  GiCheckMark
} from 'react-icons/gi';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import { getMagitechBranch, magitechMaxTier } from '../../data/gadgetBranches';

/**
 * 跑團卡【小工具】技能即時戰鬥效果速查組件 (TinkererGadgetsQuickRef)
 * 供玩家在跑團過程中直接查閱當前解鎖的灌注術、魔科技與煉金術規格，並支援一鍵呼叫官方規則典籍。
 *
 * `variantId` 是【小工具】選用的公測變體：官方 p.38 把魔導科技拆成
 * 【魔導武裝】與【魔法球】兩條互斥分支，兩者的第三軌節點與核心完全不同——
 * 選了分支卻還顯示核心的【魔科技篡奪／魔加農／魔法球原型】就是顯示錯誤資訊。
 *
 * `technoRestrictsEquipment` 是魔晶石制的裝備受限模式（科技奇幻手冊 p.133）：
 * 魔導科技只剩兩個益處，魔加農整檔不存在、魔法球原型降為進階。
 */
export default function TinkererGadgetsQuickRef({
  gadgetsData = {},
  sl = 1,
  onOpenCodex = () => {},
  onOpenWorkshop = null,
  characterLevel = 5,
  variantId = null,
  technoRestrictsEquipment = false,
  /**
   * 收合狀態的初值。**生產端永不傳入**——存在的唯一理由是讓 SSR 能覆蓋「收合摘要標籤」
   * 那個分支（它預設 `false`，而收合視圖才是跑團桌上最常看到的那一面）。
   * 不傳時行為與過去逐字相同。
   */
  initialCollapsed = false
}) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const branch = getMagitechBranch(variantId);
  /**
   * 魔導科技這一軌的最高檔。
   * Playtest 分支變體（p.38）本身就是三節點結構，不受 p.133 的兩檔改寫影響；
   * 只有「核心三檔 ＋ 魔晶石制」才降到 2。
   */
  const magitechCeiling = branch ? 3 : magitechMaxTier(technoRestrictsEquipment);

  const alchemy = gadgetsData?.alchemy || 0;
  const infusion = gadgetsData?.infusion || 0;
  // 魔晶石制只剩兩檔：存檔裡若有 3 點（開魔晶石之前投的），顯示時就夾回 2，
  // 否則收合標籤會出現一個不存在的節點。與彈窗的夾值同一個理由（§BX6）。
  const magitech = Math.min(gadgetsData?.magitech || 0, magitechCeiling);
  const totalAllocated = alchemy + infusion + magitech;

  /** 第三軌的名字：核心叫「魔科技」，分支就叫分支名。 */
  const magitechLabel = branch?.name || '魔科技';
  /** 分支的已解鎖節點（給展開視圖與收合標籤共用）。 */
  const branchNodes = branch ? branch.nodes.filter((n) => n.tier <= magitech) : [];
  /** 【魔法球原型】的檔位：核心在最高檔，魔晶石制降到進階。 */
  const magisphereTier = technoRestrictsEquipment ? 2 : 3;

  const dmg = characterLevel >= 40 ? 40 : characterLevel >= 20 ? 30 : 20;

  const getTierBadge = (name, tier) => {
    const tierLabels = ['未研發', '基礎', '高級', '最高'];
    const isUnlocked = tier > 0;
    return (
      <span
        key={name}
        className={`px-2 py-0.5 rounded-md font-bold text-[11px] border flex items-center gap-1 ${
          isUnlocked
            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
            : 'bg-stone-100 dark:bg-slate-800 text-stone-400 dark:text-stone-500 border-stone-200 dark:border-slate-700'
        }`}
      >
        <span>{name}</span>
        <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10">
          {tierLabels[tier] || `Tier ${tier}`}
        </span>
      </span>
    );
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-amber-200/80 dark:border-slate-700 space-y-2.5 text-xs text-stone-800 dark:text-stone-100 font-sans">
      {/* 標題與操作控制列 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200">
          <GiGears className="text-amber-600 dark:text-amber-400 text-sm" />
          <span>已掌握小工具戰鬥速查</span>
          {totalAllocated > 0 && (
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800">
              {totalAllocated} / {sl} 節點
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenCodex}
            className="px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
            title="開啟小工具官方手冊完整速查大表 (手冊 p.212~216)"
          >
            <GiSpellBook className="text-amber-600 dark:text-amber-400 text-xs" />
            <span>規則概念速查</span>
          </button>

          {totalAllocated > 0 && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-600 dark:text-stone-300 font-medium transition-colors cursor-pointer flex items-center gap-0.5"
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>展開效果</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>收合為標籤</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 科技樹配置狀態標籤列 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {getTierBadge('煉金術', alchemy)}
        {getTierBadge('灌注術', infusion)}
        {getTierBadge(magitechLabel, magitech)}
      </div>

      {/* 未配置節點之提示 */}
      {totalAllocated === 0 ? (
        <div className="p-3 rounded-xl border border-dashed border-amber-300 dark:border-slate-700 bg-amber-50/50 dark:bg-slate-800/40 text-center space-y-1">
          <p className="font-bold text-amber-950 dark:text-amber-200 text-xs">
            尚未配置小工具科技樹節點（可分配 {sl} 點）
          </p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            請在角色卡技能設定中點擊「配置科技樹」解鎖煉金術、灌注術或魔科技節點。
          </p>
        </div>
      ) : isCollapsed ? (
        /* 收合為摘要標籤視圖 */
        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
          {infusion >= 1 && (
            <>
              <span className="px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 font-medium">
                低溫【冰】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 font-medium">
                焦火【火】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-medium">
                電壓【電】
              </span>
            </>
          )}
          {infusion >= 2 && (
            <>
              <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200 font-medium">
                疾風【風】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200 font-medium">
                驅邪【光】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-medium">
                地震【土】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-medium">
                暗影【暗】
              </span>
            </>
          )}
          {infusion >= 3 && (
            <>
              <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-medium">
                吸血【汲取】
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium">
                毒液【毒】
              </span>
            </>
          )}
          {branch ? (
            branchNodes.map((n) => (
              <span
                key={n.tier}
                className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-medium"
              >
                {n.name} ({n.cost})
              </span>
            ))
          ) : (
            <>
              {magitech >= 1 && (
                <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-medium">
                  魔科技篡奪 (10 MP)
                </span>
              )}
              {magitech >= 2 && !technoRestrictsEquipment && (
                <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200 font-medium">
                  魔加農【HR + 10】
                </span>
              )}
              {magitech >= magisphereTier && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-medium">
                  魔法球原型 (2 IP)
                </span>
              )}
            </>
          )}
          {alchemy >= 1 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-medium">
              {alchemy === 1 ? '基礎混合 (2d20 · 3 IP)' : alchemy === 2 ? '進階混合 (3d20 · 4 IP)' : '最高混合 (4d20 · 5 IP)'}
            </span>
          )}
        </div>
      ) : (
        /* 展開效果卡片清單 */
        <div className="space-y-2.5 pt-1">
          {/* ① 灌注術效果速查 */}
          {infusion > 0 && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-50/80 via-white to-blue-50/60 dark:from-slate-800 dark:via-slate-800/90 dark:to-cyan-950/30 border border-cyan-200 dark:border-cyan-800/70 space-y-2">
              <div className="flex items-center justify-between border-b border-cyan-100 dark:border-slate-700 pb-1.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-cyan-950 dark:text-cyan-200 font-bold text-xs">
                  <GiBroadsword className="text-cyan-600 dark:text-cyan-400" />
                  <span>灌注術工藝</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300">
                    Tier {infusion}
                  </span>
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  武器攻擊命中後花費 <strong>2 道具點</strong> 注入特殊效果
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {/* 基礎灌注 */}
                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-cyan-200/70 dark:border-slate-700 space-y-0.5">
                  <div className="font-bold text-cyan-950 dark:text-cyan-200 flex items-center justify-between">
                    <span>低溫</span>
                    <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 font-bold">2 IP</span>
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【冰】屬性。')}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-cyan-200/70 dark:border-slate-700 space-y-0.5">
                  <div className="font-bold text-cyan-950 dark:text-cyan-200 flex items-center justify-between">
                    <span>焦火</span>
                    <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 font-bold">2 IP</span>
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【火】屬性。')}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-cyan-200/70 dark:border-slate-700 space-y-0.5">
                  <div className="font-bold text-cyan-950 dark:text-cyan-200 flex items-center justify-between">
                    <span>電壓</span>
                    <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 font-bold">2 IP</span>
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【電】屬性。')}
                  </div>
                </div>

                {/* 高級灌注 (Tier 2+) */}
                {infusion >= 2 && (
                  <>
                    <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-teal-200/70 dark:border-slate-700 space-y-0.5">
                      <div className="font-bold text-teal-950 dark:text-teal-200 flex items-center justify-between">
                        <span>疾風</span>
                        <span className="text-[10px] font-mono text-teal-700 dark:text-teal-400 font-bold">2 IP</span>
                      </div>
                      <div className="text-[11px] leading-relaxed">
                        {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【風】屬性。')}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-yellow-200/70 dark:border-slate-700 space-y-0.5">
                      <div className="font-bold text-yellow-950 dark:text-yellow-200 flex items-center justify-between">
                        <span>驅邪</span>
                        <span className="text-[10px] font-mono text-yellow-700 dark:text-yellow-400 font-bold">2 IP</span>
                      </div>
                      <div className="text-[11px] leading-relaxed">
                        {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【光】屬性。')}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-amber-200/70 dark:border-slate-700 space-y-0.5">
                      <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between">
                        <span>地震</span>
                        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold">2 IP</span>
                      </div>
                      <div className="text-[11px] leading-relaxed">
                        {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【土】屬性。')}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-purple-200/70 dark:border-slate-700 space-y-0.5">
                      <div className="font-bold text-purple-950 dark:text-purple-200 flex items-center justify-between">
                        <span>暗影</span>
                        <span className="text-[10px] font-mono text-purple-700 dark:text-purple-400 font-bold">2 IP</span>
                      </div>
                      <div className="text-[11px] leading-relaxed">
                        {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【暗】屬性。')}
                      </div>
                    </div>
                  </>
                )}

                {/* 最高灌注 (Tier 3) */}
                {infusion >= 3 && (
                  <>
                    <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-rose-200/70 dark:border-slate-700 space-y-0.5">
                      <div className="font-bold text-rose-950 dark:text-rose-200 flex items-center justify-between">
                        <span>吸血（限單一目標）</span>
                        <span className="text-[10px] font-mono text-rose-700 dark:text-rose-400 font-bold">2 IP</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-stone-700 dark:text-stone-300">
                        恢復相當於目標所受傷害總量一半的 HP 或 MP。
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-emerald-200/70 dark:border-slate-700 space-y-0.5">
                      <div className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center justify-between">
                        <span>毒液</span>
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">2 IP</span>
                      </div>
                      <div className="text-[11px] leading-relaxed">
                        {renderTextWithAffinities('額外造成 5 點傷害，傷害類型轉為【毒】屬性，且目標陷入中毒狀態。')}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ② 魔導科技效果速查 */}
          {magitech > 0 && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/60 dark:from-slate-800 dark:via-slate-800/90 dark:to-purple-950/30 border border-purple-200 dark:border-purple-800/70 space-y-2">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-slate-700 pb-1.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-purple-950 dark:text-purple-200 font-bold text-xs">
                  <GiGears className="text-purple-600 dark:text-purple-400" />
                  <span>{branch ? `${branch.name}工藝` : '魔導科技工藝'}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                    {technoRestrictsEquipment ? `Tier ${magitech}/${magitechCeiling}` : `Tier ${magitech}`}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* 公測分支（p.38）：第三軌的節點與核心完全不同，選了分支就不再顯示核心三節點 */}
                {branch && branchNodes.map((n) => (
                  <div key={n.tier} className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-purple-200/70 dark:border-slate-700 space-y-0.5">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-purple-950 dark:text-purple-200">
                        {n.tierName.replace('益處', '')}【{n.name}】
                      </span>
                      <span className="font-mono text-purple-700 dark:text-purple-400 font-bold text-[10px]">
                        {n.cost}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                      {renderTextWithAffinities(n.summary)}
                    </p>
                  </div>
                ))}

                {!branch && (
                  <>
                {/* 基礎：魔科技篡奪 */}
                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-purple-200/70 dark:border-slate-700 space-y-0.5">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-purple-950 dark:text-purple-200">基礎【魔科技篡奪】</span>
                    <span className="font-mono text-purple-700 dark:text-purple-400 font-bold text-[10px]">10 MP</span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                    花費 10 MP 選擇一名處於狀態效果下的構裝體或元素體敵人，解除其所有異常狀態，揭露其完整數據，並強制其作為盟友立即執行一項自選動作。
                  </p>
                </div>

                {/* 高級：魔加農 —— 魔晶石制下整檔不存在（p.133 removing the magicannon completely） */}
                {magitech >= 2 && !technoRestrictsEquipment && (
                  <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-teal-200/70 dark:border-slate-700 space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-teal-950 dark:text-teal-200">高級【魔加農】</span>
                      <span className="font-mono text-teal-700 dark:text-teal-400 font-bold text-[10px]">2 IP</span>
                    </div>
                    <div className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                      {renderTextWithAffinities('花費 2 IP 製造一把魔加農火器。若兩手為空，可立即裝備並進行一次自由攻擊。命中【DEX + INS】+1，傷害【HR + 10】自選屬性傷害。')}
                    </div>
                  </div>
                )}

                {/* 魔法球原型：核心在最高檔；魔晶石制下往下兼容成進階檔（p.133） */}
                {magitech >= magisphereTier && (
                  <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-indigo-200/70 dark:border-slate-700 space-y-0.5">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-indigo-950 dark:text-indigo-200">
                        {technoRestrictsEquipment ? '高級【魔法球原型】' : '最高【魔法球原型】'}
                      </span>
                      <span className="font-mono text-indigo-700 dark:text-indigo-400 font-bold text-[10px]">2 IP</span>
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                      花費 2 點 IP 免費執行咒語動作，施展已開發出原型的元素、熵系或靈魂學派咒語（遵循正常 MP 與檢定，使用後摧毀）。
                    </p>
                    {technoRestrictsEquipment && (
                      <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                        魔晶石制：本檔已上移填補魔加農的位置，魔導科技只有兩檔（p.133）。
                      </p>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ③ 煉金術規格速查 */}
          {alchemy > 0 && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50/80 via-white to-orange-50/60 dark:from-slate-800 dark:via-slate-800/90 dark:to-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-2">
              <div className="flex items-center justify-between border-b border-amber-100 dark:border-slate-700 pb-1.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-amber-950 dark:text-amber-200 font-bold text-xs">
                  <GiRoundBottomFlask className="text-amber-600 dark:text-amber-400" />
                  <span>即席煉金術</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Tier {alchemy}
                  </span>
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  {alchemy === 1 ? '基礎混合：擲 2d20 · 消耗 3 IP' : alchemy === 2 ? '高級混合：擲 3d20 · 消耗 4 IP' : '最高混合：擲 4d20 · 消耗 5 IP'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-amber-200/70 dark:border-slate-700 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 dark:text-amber-200">
                  <span>常駐任意保底選項（任何出目皆可選）：</span>
                  <span className="text-stone-500 font-normal">手冊 p.213</span>
                </div>
                <div className="text-[11px] leading-relaxed text-stone-700 dark:text-stone-300 space-y-0.5">
                  <div>• {renderTextWithAffinities(`受到 ${dmg} 點毒屬性傷害`)}</div>
                  <div>• 恢復 30 點 HP</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
