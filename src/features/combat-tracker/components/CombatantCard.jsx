import React from 'react';
import {
  Shield,
  Zap,
  Swords,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  GiHealthNormal,
  GiLightningTear,
} from 'react-icons/gi';
import JRPGBadge from '../../../components/ui/JRPGBadge';
import GameIcon from '../../../components/ui/GameIcon';

/**
 * 狀態異常定義。
 *
 * ## 顏色（第三十八輪 §CI46 逐項裁決）
 *
 * 六個狀態是**標記**，不是身份——它們跟九相、四屬性那種「封閉的、玩家要一眼
 * 認出是哪一個」的東西不同：狀態是暫時的、可疊加的、同一時間可能掛三個。
 * 所以它們**不該長出自己的色相家族**。
 *
 * 這一條原本沒有寫下來，於是表裡混了三種寫法：
 *
 * | 寫法 | 狀態 | 問題 |
 * |---|---|---|
 * | `border-signal-*` ＋ 登記墨色 | 遲緩・眩暈・虛弱・中毒 | ✓ 正確 |
 * | 手寫兩個 hex（邊界＋文字） | 動搖・憤怒 | 四個從未量測過的顏色 |
 *
 * 動搖與憤怒之所以手寫，不是設計裁決，是 **signal 只有四個令牌、狀態有六個**。
 * 於是作者各挑了一對顏色填補——而那兩對（`#7a6a9c`/`#4a4068`、`#c0603f`/`#8a3f26`）
 * 在檔案裡沒有任何一句「為什麼是這個值」，也沒有量過對比。
 * 依本輪的判準，**沒有裁決記錄的顏色就是漂移**，不是身份。
 *
 * 收斂後：邊界六色兩兩相異（ip 金／mp 藍／hp 紅／紫／硃砂／ok 綠），
 * 文字六色全部是登記色，最低對比 5.59:1（遲緩在紙上）。
 * 動搖借身份紫、憤怒借硃砂紅——這是刻意的：狀態與身份**在同一個畫面不會同時
 * 承擔「這是哪一個」的責任**（狀態是徽章，身份是頭像環與頁籤）。
 */
const STATUS_EFFECTS = [
  { key: 'slow', name: '遲緩', en: 'Slow', desc: '靈巧降階', color: 'border-signal-ip text-[#833f12] bg-signal-ip/10' },
  { key: 'dazed', name: '眩暈', en: 'Dazed', desc: '洞察降階', color: 'border-signal-mp text-[#27527a] bg-signal-mp/10' },
  { key: 'weak', name: '虛弱', en: 'Weak', desc: '力量降階', color: 'border-signal-hp text-[#8c3235] bg-signal-hp/10' },
  { key: 'shaken', name: '動搖', en: 'Shaken', desc: '意志降階', color: 'border-[#5e387c] text-[#4f2e67] bg-[#5e387c]/10' },
  { key: 'enraged', name: '憤怒', en: 'Enraged', desc: '靈巧·洞察降階·限普攻', color: 'border-[#8c2d36] text-[#76252d] bg-[#8c2d36]/10' },
  { key: 'poisoned', name: '中毒', en: 'Poison', desc: '回合結束受到5毒傷', color: 'border-signal-ok text-[#1e4b39] bg-signal-ok/10' }
];

export default function CombatantCard({
  combatant,
  onUpdate,
  onRemove,
  onOpenDrawer
}) {
  if (!combatant) return null;

  const isPlayer = combatant.sourceType === 'character' || combatant.faction === '玩家隊伍';
  const curHp = combatant.hp?.current ?? 50;
  const maxHp = combatant.hp?.max ?? 50;
  const crisisThreshold = combatant.hp?.crisisThreshold ?? Math.floor(maxHp / 2);
  const isCrisis = curHp <= crisisThreshold;
  const hpPercent = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));

  const curMp = combatant.mp?.current ?? 30;
  const maxMp = combatant.mp?.max ?? 30;
  const mpPercent = Math.max(0, Math.min(100, Math.round((curMp / maxMp) * 100)));

  const handleAdjustHp = (delta) => {
    const next = Math.max(0, Math.min(maxHp, curHp + delta));
    onUpdate({
      ...combatant,
      hp: { ...combatant.hp, current: next }
    });
  };

  const handleAdjustMp = (delta) => {
    const next = Math.max(0, Math.min(maxMp, curMp + delta));
    onUpdate({
      ...combatant,
      mp: { ...combatant.mp, current: next }
    });
  };

  const handleToggleActed = () => {
    onUpdate({
      ...combatant,
      hasActed: !combatant.hasActed
    });
  };

  const handleToggleStatus = (statusKey) => {
    const currentStatuses = combatant.statusEffects || {};
    onUpdate({
      ...combatant,
      statusEffects: {
        ...currentStatuses,
        [statusKey]: !currentStatuses[statusKey]
      }
    });
  };

  const handleToggleRevealSkill = (skillId) => {
    const updatedSkills = (combatant.skills || []).map(sk =>
      sk.id === skillId ? { ...sk, isRevealed: !sk.isRevealed } : sk
    );
    onUpdate({
      ...combatant,
      skills: updatedSkills
    });
  };

  /**
   * v5 卡片外框狀態。
   *
   * 舊版（v1）用 `opacity-60` 表示「已行動」，那在深底上是合理的，
   * 但本卡是淺底：壓暗會連帶把文字對比壓掉。v5 改為**去飽和**——
   * 卡片「褪色」但文字仍清晰可讀，這是 v5 最重要的狀態語言之一。
   *
   * 危機狀態刻意保留一個低強度脈動：它是**警示**，需要抓注意力，
   * 與「裝飾性光暈」不同。振幅已從 20px blur 降到 10px。
   */
  const cardState = combatant.hasActed
    ? 'sat-hiber'
    : isCrisis
      ? 'crisis-pulse-active border-signal-hp bg-signal-hp/5'
      : isPlayer
        ? 'border-signal-mp/45 hover:border-signal-mp'
        : 'border-warm-line hover:border-ink-3';

  return (
    <div
      className={`bg-warm-0 rounded border transition-all duration-160 overflow-hidden flex flex-col relative ${cardState}`}
    >
      {/* 頂部識別條：玩家隊＝藍、敵方＝暖紅。v5 改為實色，不用漸層。 */}
      <div className={`h-1 w-full ${isPlayer ? 'bg-signal-mp' : 'bg-signal-accent'}`} />

      {/* 頭像與身分 */}
      <div className="p-3.5 border-b border-warm-line/70 bg-warm-1/60 flex items-start gap-3">
        <div className="w-11 h-11 rounded bg-cool-1 border border-warm-line overflow-hidden shrink-0 flex items-center justify-center font-serif text-base text-ink font-bold">
          {combatant.avatar ? (
            combatant.avatar.startsWith('http') || combatant.avatar.startsWith('data:') ? (
              <img src={combatant.avatar} alt={combatant.name} className="w-full h-full object-cover" />
            ) : (
              <GameIcon name={combatant.avatar} size={24} className="text-ink" />
            )
          ) : (
            combatant.name?.[0] || '戰'
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-serif font-bold text-base text-ink truncate">
              {combatant.name}
            </h4>
            <JRPGBadge variant={isPlayer ? 'zinc' : 'ink'} size="xs">
              Lv {combatant.level}
            </JRPGBadge>
            {combatant.rank && (
              <JRPGBadge variant={combatant.rank === '冠位' ? 'rank-top' : combatant.rank === '精英' ? 'rank-mid' : 'slate'} size="xs">
                {combatant.rank}
              </JRPGBadge>
            )}
          </div>

          <div className="flex items-center gap-2 text-t11 text-ink-2 mt-0.5 font-mono">
            <span>{combatant.species || combatant.role}</span>
            <span className="text-ink-3">·</span>
            <span>物防 {combatant.defense}</span>
            <span className="text-ink-3">·</span>
            <span>魔防 {combatant.magicDefense}</span>
            <span className="text-ink-3">·</span>
            <span>先攻 +{combatant.initiative}</span>
          </div>
        </div>

        {/* 行動狀態切換。
            待行動時舊版會 `animate-pulse` 無限循環——那是「裝飾性動態」，
            v5 禁用。改為靜態實色，靠色塊本身抓注意力即可。 */}
        <button
          onClick={handleToggleActed}
          className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold transition-colors duration-160 flex items-center gap-1.5 shrink-0 border ${
            combatant.hasActed
              ? 'bg-warm-2 text-ink-2 border-warm-line'
              : 'bg-signal-hp text-white border-transparent hover:bg-[#8c3235]'
          }`}
          title="切換本輪是否已行動"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {combatant.hasActed ? '已行動' : '待行動'}
        </button>
      </div>

      {/* HP */}
      <div className="px-3.5 py-2.5 border-b border-warm-line/70 bg-warm-0 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 font-bold text-signal-hp font-sans">
            <GiHealthNormal className="w-3.5 h-3.5" />
            <span>HP</span>
            {isCrisis && (
              <span className="text-t10 text-signal-hp font-sans font-bold flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> 危機
              </span>
            )}
          </div>
          <div className="text-ink">
            <strong className="text-sm text-signal-hp font-bold">{curHp}</strong>
            <span className="text-ink-3"> / {maxHp}</span>
          </div>
        </div>

        {/* 進度條。v5 移除漸層（漸層是 v2 黑金的病灶之一），改單色實心。 */}
        <div className="w-full h-2 rounded-full bg-cool-2 overflow-hidden">
          <div
            className="h-full bg-signal-hp transition-all duration-200"
            style={{ width: `${hpPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="flex items-center gap-1">
            {[-5, -1].map(d => (
              <button
                key={d}
                onClick={() => handleAdjustHp(d)}
                className="px-2 py-0.5 rounded bg-warm-0 border border-warm-line hover:border-signal-hp text-t11 font-mono text-ink hover:text-signal-hp transition-colors duration-120"
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[1, 5].map(d => (
              <button
                key={d}
                onClick={() => handleAdjustHp(d)}
                className="px-2 py-0.5 rounded bg-warm-0 border border-warm-line hover:border-signal-ok text-t11 font-mono text-ink hover:text-signal-ok transition-colors duration-120"
              >
                +{d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MP */}
      <div className="px-3.5 py-2.5 border-b border-warm-line/70 bg-warm-1/40 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 font-bold text-signal-mp font-sans">
            <GiLightningTear className="w-3.5 h-3.5" />
            <span>MP</span>
          </div>
          <div className="text-ink">
            <strong className="text-sm text-signal-mp font-bold">{curMp}</strong>
            <span className="text-ink-3"> / {maxMp}</span>
          </div>
        </div>

        <div className="w-full h-1.5 rounded-full bg-cool-2 overflow-hidden">
          <div
            className="h-full bg-signal-mp transition-all duration-200"
            style={{ width: `${mpPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-1">
            {[-5, -1].map(d => (
              <button
                key={d}
                onClick={() => handleAdjustMp(d)}
                className="px-2 py-0.5 rounded bg-warm-0 border border-warm-line hover:border-signal-mp text-t11 font-mono text-ink hover:text-signal-mp transition-colors duration-120"
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[1, 5].map(d => (
              <button
                key={d}
                onClick={() => handleAdjustMp(d)}
                className="px-2 py-0.5 rounded bg-warm-0 border border-warm-line hover:border-signal-mp text-t11 font-mono text-ink hover:text-signal-mp transition-colors duration-120"
              >
                +{d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 狀態異常 */}
      <div className="p-3 border-b border-warm-line/70 bg-warm-1/30">
        <div className="text-t10 font-mono text-ink-3 uppercase tracking-wider mb-1.5 font-bold">
          狀態異常
        </div>
        <div className="grid grid-cols-3 gap-1">
          {STATUS_EFFECTS.map(st => {
            const isActive = combatant.statusEffects?.[st.key] || false;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => handleToggleStatus(st.key)}
                className={`px-1.5 py-1 rounded text-t12 font-mono border transition-colors duration-120 text-center flex flex-col items-center ${
                  isActive
                    ? `${st.color} font-bold`
                    : 'border-warm-line bg-warm-0 text-ink-2 hover:border-ink-3'
                }`}
                title={st.desc}
              >
                <span className="font-bold">{st.name}</span>
                <span className="text-t12 opacity-80">{st.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 技能逐格揭露（僅 NPC） */}
      {!isPlayer && combatant.skills && combatant.skills.length > 0 && (
        <div className="p-3 border-b border-warm-line/70 bg-warm-1/50 space-y-1.5">
          <div className="text-t10 font-mono text-ink-2 flex items-center justify-between font-bold">
            <span className="inline-flex items-center gap-1">
              技能組（點擊 <Eye className="w-3 h-3 text-ink-2" /> 向全員揭露）
            </span>
            <span className="text-signal-ip text-t10">
              已揭露: {combatant.skills.filter(s => s.isRevealed).length} / {combatant.skills.length}
            </span>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {combatant.skills.map(sk => (
              <div
                key={sk.id}
                className={`p-1.5 rounded border text-xs flex items-center justify-between gap-2 transition-colors duration-120 ${
                  sk.isRevealed
                    ? 'border-signal-ip/60 bg-signal-ip/8 text-ink'
                    : 'border-warm-line bg-warm-0 text-ink-3'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold flex items-center gap-1.5 truncate">
                    <span>{sk.name}</span>
                    {!sk.isRevealed && <span className="text-t10 text-ink-3 font-mono">(未公開)</span>}
                  </div>
                  {sk.desc && sk.isRevealed && (
                    <p className="text-t10 text-ink-2 font-sans line-clamp-1 mt-0.5">{sk.desc}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleRevealSkill(sk.id)}
                  className={`p-1 rounded transition-colors duration-120 ${
                    sk.isRevealed
                      ? 'text-signal-ip hover:text-[#833f12]'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                  title={sk.isRevealed ? "收回隱藏" : "向所有人公開此技能"}
                >
                  {sk.isRevealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 卡片底部動作 */}
      <div className="p-2.5 bg-warm-1/50 flex items-center justify-between gap-2 mt-auto border-t border-warm-line/70">
        <button
          type="button"
          onClick={() => onOpenDrawer(combatant)}
          className="text-xs text-signal-accent hover:text-[#8c3235] flex items-center gap-1 font-bold transition-colors duration-120"
        >
          <FileText className="w-3.5 h-3.5" /> 查看完整資訊
        </button>

        <button
          type="button"
          onClick={() => onRemove(combatant.instanceId)}
          className="text-ink-3 hover:text-signal-hp p-1 transition-colors duration-120"
          title="從戰鬥移除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
