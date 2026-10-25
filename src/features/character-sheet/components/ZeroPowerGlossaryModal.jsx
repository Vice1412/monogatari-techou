/**
 * 底力技名詞說明彈窗 —— 七個觸發與十一個效果的全文。
 *
 * ## 為什麼需要這個彈窗
 *
 * 使用者原話：「光看文字是不知道那些憐憫、愛到底什麼鬼，你要加個備註點擊查看敘述之類的。
 * 不然新人一臉懵。」
 *
 * 觸發的名字本身幾乎不帶資訊——【連續】【戰略】【協同】聽起來都像「打得順」，
 * 而它們的實際差別是**命刻什麼時候填、填幾格**；【憐憫】更是完全猜不到它綁的是
 * 「恢復盟友 HP／MP」。原文的敘述原本只放在 `title`（滑鼠移上去才看得到），
 * 行動裝置等於沒有，而且一次只能看一個。
 *
 * ## 與命名表彈窗同一個形狀
 *
 * 兩者都是「把資料層的表攤開給人看」，所以沿用同一套版面語言（說明卡／分頁／
 * 卡片網格／底部按鈕），見 §BM9 的「同一個機制不該長兩個樣子」。
 * 差別只在：命名表是**生成**（骰出名字），這裡是**查閱**（順便可以直接選）。
 *
 * ## 內容抽成 `ZeroPowerGlossaryBody`
 *
 * 理由與命名表完全相同：`JRPGModal` 在 SSR 下必定回 `null`（`mounted` 只由
 * `useEffect` 設起來），護欄測不到彈窗內容。抽成純展示元件後，護欄可以直接
 * 餵兩種分頁與「已選／未選」兩態。注入點的鐵律照舊：**不傳 props 時行為完整**。
 */
import React, { useEffect, useState } from 'react';
import { GiScrollUnfurled } from 'react-icons/gi';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import { renderTextWithAffinities } from '../../../components/ui/FUIcon';
import { ZERO_TRIGGERS, ZERO_EFFECTS, ZERO_POWER_SOURCE } from '../data/zeroPowers';
import { getCharacterTheme } from '../utils/characterThemes';

export const GLOSSARY_TAB_TRIGGER = 'trigger';
export const GLOSSARY_TAB_EFFECT = 'effect';

/** 觸發的填充格數說明（`'varies'` 依情境計算，見【協同】）。 */
export function zeroTriggerFillLabel(trigger) {
  if (!trigger) return '';
  return trigger.fill === 'varies' ? '變動格數' : `每次 ${trigger.fill} 格`;
}

export function ZeroPowerGlossaryBody({
  theme,
  activeTab = GLOSSARY_TAB_TRIGGER,
  onTabChange = () => {},
  onPickTrigger = null,
  onPickEffect = null,
  selectedTriggerId = '',
  selectedEffectId = ''
}) {
  /* 第三十八輪（§CI46）：這八行原本是 `(theme && theme.accent) || '#9c4d16'`。
     第三十七輪的 H35 說「全站零 hex 回退」，但它只認 `theme.accent || '#hex'`
     這種**單一屬性鏈**——`(theme && theme.accent)` 是複合運算式，整批逃掉了。
     （同一種盲區的第三次：護欄只認得自己寫的那一種寫法。）

     這裡的 `theme` 預設是 `{}`（不是 null），所以 `theme.accent` 會是 undefined，
     回退**真的會執行**。修法照第三十七輪的結論：換成具名來源，不是刪掉保險。
     順帶修掉一個不一致：`textDark` 的保險是 `#3c2415`，而主題真正的
     `textDark` 是 `#2c221e`——「有主題」和「沒主題」的墨是兩個顏色。 */
  const t = theme || getCharacterTheme(null);
  const accent = t.accent;
  const accentDark = t.accentDark;
  const accentLight = t.accentLight;
  const border = t.border;
  const cardBg = t.cardBg;
  const panelBg = t.panelBg;
  const textDark = t.textDark;
  const textMuted = t.textMuted;

  const showTriggers = activeTab === GLOSSARY_TAB_TRIGGER;
  const list = showTriggers ? ZERO_TRIGGERS : ZERO_EFFECTS;
  const selectedId = showTriggers ? selectedTriggerId : selectedEffectId;
  const onPick = showTriggers ? onPickTrigger : onPickEffect;

  const tabs = [
    { id: GLOSSARY_TAB_TRIGGER, label: `觸發（${ZERO_TRIGGERS.length}）` },
    { id: GLOSSARY_TAB_EFFECT, label: `效果（${ZERO_EFFECTS.length}）` }
  ];

  return (
    <div className="space-y-3" data-testid="zero-power-glossary">
      {/* 說明卡 */}
      <div className="rounded border p-2.5" style={{ borderColor: border, backgroundColor: panelBg }}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <span
              className="font-serif font-black text-xs flex items-center gap-1.5"
              style={{ color: textDark }}
            >
              <GiScrollUnfurled className="w-3.5 h-3.5" style={{ color: accent }} />
              觸發決定命刻什麼時候填，效果決定施展時發生什麼事
            </span>
            <p className="text-t12 leading-relaxed" style={{ color: textMuted }}>
              建角時各選一個。命刻填滿後，在衝突場景中執行技能動作施展，施展完命刻清空。
            </p>
          </div>
          <span className="text-t10 whitespace-nowrap" style={{ color: textMuted }}>
            {ZERO_POWER_SOURCE}
          </span>
        </div>
      </div>

      {/* 分頁 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="px-3 py-1 rounded text-xs font-bold transition-all whitespace-nowrap border cursor-pointer"
              style={
                isActive
                  ? { backgroundColor: accent, borderColor: accentDark, color: '#fffdf9' }
                  : { backgroundColor: cardBg, borderColor: border, color: textDark }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 卡片 */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {list.map((item) => {
          const isPicked = selectedId === item.id;
          return (
            <div
              key={item.id}
              className="rounded border p-2.5 space-y-1.5 transition-all"
              style={{
                borderColor: isPicked ? accent : border,
                backgroundColor: isPicked ? accentLight : cardBg
              }}
            >
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="font-serif font-black text-sm" style={{ color: textDark }}>
                  {item.name}
                </span>
                <span
                  className="text-t10 px-1.5 py-0.5 rounded-full border font-bold"
                  style={{ borderColor: border, color: textMuted, backgroundColor: panelBg }}
                >
                  {showTriggers ? zeroTriggerFillLabel(item) : '底力效果'}
                </span>
              </div>
              <p className="text-t11 leading-relaxed" style={{ color: textMuted }}>
                {renderTextWithAffinities(item.desc)}
              </p>
              {typeof onPick === 'function' ? (
                <button
                  type="button"
                  onClick={() => onPick(item.id)}
                  className="text-t11 px-2 py-0.5 rounded border cursor-pointer font-bold"
                  style={{
                    borderColor: isPicked ? accent : border,
                    backgroundColor: isPicked ? accent : cardBg,
                    color: isPicked ? '#fffdf9' : textDark
                  }}
                >
                  {isPicked ? '✓ 已選' : '選擇'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ZeroPowerGlossaryModal({
  isOpen,
  onClose,
  theme = null,
  initialTab = GLOSSARY_TAB_TRIGGER,
  selectedTriggerId = '',
  selectedEffectId = '',
  onPickTrigger = null,
  onPickEffect = null
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  /**
   * 每次開啟都回到呼叫端指定的分頁——從「觸發」旁邊的按鈕進來就該看到觸發，
   * 不該記住上一次看的是哪一頁。`isOpen` 進依賴是關鍵：只依賴 `initialTab`
   * 的話，第二次點同一顆按鈕不會重設。
   */
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  const handlePick = (id) => {
    const pick = activeTab === GLOSSARY_TAB_TRIGGER ? onPickTrigger : onPickEffect;
    if (typeof pick === 'function') pick(id);
  };

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title="底力技：觸發與效果"
      maxWidth="max-w-3xl"
      theme={theme}
      actionButtons={
        <div className="flex items-center justify-end w-full">
          <JRPGButton variant="secondary" size="sm" onClick={onClose}>
            關閉
          </JRPGButton>
        </div>
      }
    >
      <ZeroPowerGlossaryBody
        theme={theme}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onPickTrigger={onPickTrigger}
        onPickEffect={onPickEffect}
        selectedTriggerId={selectedTriggerId}
        selectedEffectId={selectedEffectId}
      />
    </JRPGModal>
  );
}
