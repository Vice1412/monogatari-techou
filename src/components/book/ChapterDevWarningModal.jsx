import React from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  GiHazardSign,
  GiCheckMark,
  GiVisoredHelm,
  GiSwordClash,
  GiPocketWatch,
  GiSpellBook
} from 'react-icons/gi';
import JRPGModal from '../ui/JRPGModal';
import JRPGButton from '../ui/JRPGButton';

/**
 * ChapterDevWarningModal - 章節開發中提醒視窗
 * 用途：針對尚未完全完工的章節（角色卡助手、戰鬥輪次、命刻記錄），
 * 於使用者點擊進入時彈出提醒，說明此功能仍在開發中、未完善使用，
 * 須點擊「確定進入」後方可開啟瀏覽章節內容。
 */
export default function ChapterDevWarningModal({
  isOpen,
  chapter,
  onConfirm,
  onClose
}) {
  if (!chapter) return null;

  const ChapterIcon = chapter.icon || GiSpellBook;

  /* 2026-10-23（第八輪）：章節色已收斂，這裡不再分章。
     原本四個章節各有 accent／按鈕變體／徽章底色，而工坊落到預設值——
     那其實是**第五套色表**，而且它出現在「你正要進去的門口」。
     章節身份由章節圖示與標題承擔，警告框只管「這件事還沒做完」。 */
  const currentTheme = {
    buttonVariant: 'primary',
    bgBadge: 'bg-[#f4ebd9] text-[#3c2415] border-[#d6c7ab]',
  };

  const actionButtons = (
    <>
      <JRPGButton
        variant="secondary"
        size="sm"
        onClick={onClose}
        icon={ArrowLeft}
        className="cursor-pointer"
      >
        返回封面目錄
      </JRPGButton>
      <JRPGButton
        variant={currentTheme.buttonVariant}
        size="sm"
        onClick={onConfirm}
        icon={GiCheckMark}
        className="cursor-pointer font-bold shadow-md"
      >
        確定進入
      </JRPGButton>
    </>
  );

  return (
    <JRPGModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${chapter.title} · 開發中提醒`}
      maxWidth="max-w-lg"
      actionButtons={actionButtons}
    >
      <div className="space-y-4 text-[#2c221e]">
        {/* 警告標題徽章橫條 */}
        <div className="p-3.5 rounded border border-[#d6c7ab] bg-[#f9f5eb] flex items-start gap-3">
          <div className="p-2 rounded bg-[#f4ebd9] border border-[#d6c7ab] text-[#3c2415] shrink-0 mt-0.5">
            <GiHazardSign className="w-5 h-5 text-[#6b5a4b]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-serif font-black text-sm text-[#2c221e]">
                本章節功能仍在開發與完善中
              </h4>
              <span className="text-t10 font-mono font-bold px-1.5 py-0.5 rounded bg-[#e8dcc4] text-[#3c2415] border border-[#d6c7ab]">
                WIP 預覽版
              </span>
            </div>
            <p className="text-xs text-[#3c2415] leading-relaxed">
              此功能尚未完全成熟，部分機制、數值計算或儲存架構仍未完善使用。
            </p>
          </div>
        </div>

        {/* 章節資訊卡片 */}
        <div className="p-4 rounded border border-[#d6c7ab] bg-[#fffdf9] space-y-2.5">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded border flex items-center justify-center shadow-xs shrink-0 ${currentTheme.bgBadge}`}
            >
              <ChapterIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base text-[#3c2415]">
                  {chapter.title}
                </span>
                <span className="text-t10 px-2 py-0.5 rounded-full font-bold bg-[#f4ebd9] text-[#3c2415] border border-[#d6c7ab]">
                  未完善使用
                </span>
              </div>
              <p className="text-xs text-[#6b5a4b] mt-0.5">
                {chapter.subtitle || '章節內容與機制持續構建中'}
              </p>
            </div>
          </div>

          {/* 說明細節 */}
          <div className="text-xs text-[#5c4a3b] leading-relaxed pt-2 border-t border-[#d6c7ab]/60 space-y-1.5">
            <p>
              • <strong>現狀說明</strong>：目前本典籍專案中，<strong>僅【NPC工坊】功能已完全完整穩定</strong>，其餘章節仍在進行數值對齊與功能修繕。
            </p>
            <p>
              • <strong>體驗指引</strong>：若您希望進入查看現階段的開發成果、介面樣式或預先體驗雛形功能，請點擊下方<strong>「確定進入」</strong>鍵。
            </p>
          </div>
        </div>
      </div>
    </JRPGModal>
  );
}
