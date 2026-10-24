import React from 'react';
import { GiSparkles } from 'react-icons/gi';
import { RULE_CODEX } from '../data/ruleCodexData';
import {
  getArcanistSkillLevel,
  getStartingArcanaQuota,
  usesVariantArcanist,
  getBoundArcanaIds,
  buildArcanaEffectSections,
  ARCANIST_BINDING_SKILL
} from '../utils/arcanist';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';

/**
 * 創角第 2 步的「開局自選阿爾卡納」。
 *
 * 為什麼要在創角流程裡就出現：【綁定和召喚】的效果文寫著「如果你在角色創建時獲得
 * 這個技能，你可以在開始遊戲前自選一個阿爾卡納作為已經綁定的阿爾卡納」。
 * 2026-10-19 實測時，整個創角六步**沒有任何一處**能完成這件事——玩家只能等定稿、
 * 進跑團面板才選，而那時角色已經「開始遊戲」了。這裡把規則要求的選擇放回它該在的位置。
 *
 * 與跑團面板的關係：面板可以綁更多（探索與故事推進取得的），這裡只給**開局那一個**。
 *
 * 2026-10-20 追加（使用者回報「看不到效果很不方便選擇」）：
 * 卡片原本只印「名稱＋領域」，等於要人憑名字下注。現在每張卡都印出連攜（變體為「連結」）
 * 的前三行，選定後下方再顯示**完整**的連攜／脈衝／解除三段。
 * 判斷邏輯抽在 `buildArcanaEffectSections`（純函式，SSR 可測）。
 */
export default function ArcanistStarterBinding({ character, onChange, locked = false }) {
  const bindingSL = getArcanistSkillLevel(character, ARCANIST_BINDING_SKILL);
  const quota = getStartingArcanaQuota(character);
  if (bindingSL <= 0 || quota <= 0) return null;

  const variant = usesVariantArcanist(character);
  const catalog = variant
    ? [...RULE_CODEX.arcana.catalog, ...RULE_CODEX.arcanaVariant.catalog]
    : RULE_CODEX.arcana.catalog;
  const boundIds = getBoundArcanaIds(character);
  const selectedId = boundIds[0] || '';
  const selectedArcana = catalog.find((arcana) => arcana.id === selectedId) || null;
  const mergeLabel = variant ? '連結' : '連攜';

  const writeBound = (arcanaId) => {
    if (locked) return;
    onChange({
      ...character,
      arcanistData: {
        ...(character.arcanistData || {}),
        boundArcana: arcanaId ? [arcanaId] : [],
        customArcana: character.arcanistData?.customArcana || [],
        activeSummonId: character.arcanistData?.activeSummonId || null
      },
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="p-4 rounded-xl border-2 border-[#d6c7ab] bg-[#f9f5eb] space-y-3" data-testid="arcanist-starter-binding">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-bold text-[#3c2415] flex items-center gap-2">
          <GiSparkles className="text-[#6b5a4b]" />
          <span>開局自選阿爾卡納</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415]">
            已選 {boundIds.length} / {quota}
          </span>
        </h4>
        {selectedId && (
          <button
            type="button"
            onClick={() => writeBound('')}
            disabled={locked}
            className={`text-[11px] px-2 py-0.5 rounded border border-[#d6c7ab] text-[#3c2415] hover:bg-[#f4ebd9] ${
              locked ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            清除選擇
          </button>
        )}
      </div>

      <p className="text-t12 leading-relaxed text-[#3c2415]">
        【{ARCANIST_BINDING_SKILL}】讓你在開始遊戲前自選 {quota} 個阿爾卡納作為已綁定的契約
        {variant ? '（變體版同樣是開局一個，可從範例清單挑選或與隊友共創）' : ''}。
        除此之外，新的阿爾卡納只能透過探索與故事推進取得。
        <span className="block mt-1 text-[#6b5a4b]">
          每張卡都附上{mergeLabel}的前三行；點一下即選定，下方會展開完整效果供你比對。
        </span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {catalog.map((arcana) => {
          const checked = selectedId === arcana.id;
          const preview = buildArcanaEffectSections(arcana, { variant })[0];
          return (
            <div
              key={arcana.id}
              className={`p-2 rounded-lg border transition-colors ${
                checked
                  ? 'bg-white border-[#3c2415]'
                  : 'bg-white/60 border-[#e8dcc4] hover:border-[#7c6a58]'
              } ${locked ? 'opacity-70' : ''}`}
            >
              <label
                className={`flex items-start gap-2 text-[11px] ${
                  locked ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="starting-arcana"
                  checked={checked}
                  disabled={locked}
                  onChange={() => writeBound(arcana.id)}
                  className="mt-0.5 accent-[#a63d40]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[#2c221e]">{arcana.name}</span>
                    {arcana.pulse && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415]">
                        脈衝
                      </span>
                    )}
                  </span>
                  <span className="block text-[#6b5a4b]">領域：{arcana.domains}</span>
                </span>
              </label>

              {preview && (
                <p className="mt-1 pl-6 text-[11px] leading-relaxed text-[#3c2415] line-clamp-3">
                  <span className="font-bold text-[#3c2415]">{preview.label}：</span>
                  {renderTextWithAffinities(preview.text)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectedArcana && (
        <div
          className="rounded-lg border border-[#d6c7ab] bg-white p-3 space-y-1"
          data-testid="arcanist-starter-detail"
        >
          <div className="text-[11px] font-bold text-[#3c2415] flex items-center gap-2 flex-wrap">
            <span>已選：{selectedArcana.name}</span>
            <span className="text-[10px] font-normal text-[#6b5a4b]">領域：{selectedArcana.domains}</span>
          </div>
          {buildArcanaEffectSections(selectedArcana, { variant }).map((section) => (
            <p key={section.key} className="text-[11px] leading-relaxed text-[#3c2415]">
              <span className="font-bold text-[#3c2415]">{section.label}：</span>
              {renderTextWithAffinities(section.text)}
            </p>
          ))}
        </div>
      )}

      {!selectedId && (
        <p className="text-t12 text-[#6b5a4b]">
          尚未選擇——這一格空著不算完成創角，規則自檢會提醒。
        </p>
      )}
    </div>
  );
}
