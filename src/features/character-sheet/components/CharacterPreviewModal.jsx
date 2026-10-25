import React, { useState } from 'react';
import { Play } from 'lucide-react';
import JRPGModal from '../../../components/ui/JRPGModal';
import JRPGButton from '../../../components/ui/JRPGButton';
import CharacterCard from './CharacterCard';
import CharacterSheetExportBody from './CharacterSheetExport';

/**
 * 角色卡預覽彈窗（兩個分頁：本專案卡片 ／ 官方三頁表格）。
 *
 * 為什麼要抽成獨立元件：**同一個彈窗要從兩個地方開**
 * ——「構築與成長」與「跑團面板」。原本它寫在 `CharacterEditor` 裡面，
 * 於是跑團時想匯出就得先繞回編輯器，很彆扭。
 *
 * 兩邊的差別只有「關閉時回到哪裡」與「有沒有一顆前往跑團的按鈕」，
 * 所以用 `closeLabel` 與 `secondaryAction` 兩個 prop 表達，其餘完全共用。
 */
export default function CharacterPreviewModal({
  isOpen,
  onClose,
  character,
  stats = null,
  theme = null,
  themeId = 'amber',
  showToast = null,
  closeLabel = '返回編輯',
  secondaryAction = null,
  onAvatarClick = null
}) {
  const [tab, setTab] = useState('card');

  if (!isOpen) return null;

  const tabs = [
    ['card', '卡片檢視'],
    ['sheet', '三頁表格（可匯出 PNG／PDF）']
  ];

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title="冒險者角色卡檢視"
      maxWidth="max-w-5xl"
      theme={theme}
      actionButtons={
        <div className="flex items-center gap-2">
          {secondaryAction && (
            <JRPGButton
              variant="primary"
              size="sm"
              icon={Play}
              onClick={() => {
                onClose();
                secondaryAction.onClick();
              }}
            >
              {secondaryAction.label}
            </JRPGButton>
          )}
          <JRPGButton variant="ghost" size="sm" onClick={onClose}>
            {closeLabel}
          </JRPGButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {tabs.map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="text-t11 font-bold px-2.5 py-1 rounded border transition-all cursor-pointer"
                style={{
                  backgroundColor: active ? theme?.accent : theme?.panelBg,
                  borderColor: theme?.border,
                  color: active ? '#fffdf9' : theme?.textDark
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === 'sheet' ? (
          <CharacterSheetExportBody
            character={character}
            stats={stats}
            theme={theme}
            showToast={showToast}
          />
        ) : (
          <>
            <div className="text-xs text-[#6b5a4b] flex items-center justify-between px-1 flex-wrap gap-1">
              <span>隨時檢視角色卡排版與構築進度</span>
              <span className="font-mono text-t11" style={{ color: theme?.accent }}>
                （填寫中未完成欄位均以空格標註）
              </span>
            </div>

            <CharacterCard
              character={character}
              themeId={character?.themeColor || themeId}
              onAvatarClick={onAvatarClick}
            />
          </>
        )}
      </div>
    </JRPGModal>
  );
}
