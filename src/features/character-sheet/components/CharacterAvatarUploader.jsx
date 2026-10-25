import React, { useState, useRef } from 'react';
import {
  Upload,
  Crop,
  Trash2,
  Image as ImageIcon,
  Link as LinkIcon,
  RefreshCw
} from 'lucide-react';
import {
  GiSparkles,
  GiCheckMark,
  GiHazardSign
} from 'react-icons/gi';
import GameIcon from '../../../components/ui/GameIcon';
import AvatarCropperModal from '../../../components/ui/AvatarCropperModal';
import { CLASS_METADATA } from '../data/sourcebookConfig';

/**
 * CharacterAvatarUploader - 角色肖像與頭像上傳管理面板
 * 參照 NPC 工坊規格實作：
 * 1. 本地照片上傳 (自動高解析度壓縮至最大 1200px)
 * 2. 檔案拖曳與網頁圖片連結拖曳
 * 3. 圖片網址載入與 CORS Proxy 自動重試機制
 * 4. 1:1 彈窗裁切、平移與縮放微調
 * 5. 支援二次調整大小 (保留原始未裁切 rawBase64)
 * 6. 支援清除照片與經典職業圖標快速選用
 */
export default function CharacterAvatarUploader({
  character,
  onChange,
  theme,
  onToast = null
}) {
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSource, setCropImageSource] = useState(null);
  const [pendingRawSource, setPendingRawSource] = useState(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showClassIconPicker, setShowClassIconPicker] = useState(false);

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const showFeedback = (msg, type = 'info') => {
    if (onToast) {
      onToast(msg, type);
    }
  };

  // 1. 處理本地檔案選取
  const processImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showFeedback('請選擇有效的圖片檔案 (支援 JPG, PNG, GIF, WebP)', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target.result;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1200;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          } else {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setCropImageSource(compressedDataUrl);
          setPendingRawSource(compressedDataUrl);
        } else {
          setCropImageSource(rawDataUrl);
          setPendingRawSource(rawDataUrl);
        }
        setIsCropModalOpen(true);
      };

      img.onerror = () => {
        setCropImageSource(rawDataUrl);
        setPendingRawSource(rawDataUrl);
        setIsCropModalOpen(true);
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      showFeedback('讀取檔案失敗，請再試一次', 'error');
    };

    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = '';
  };

  // 2. 處理圖片網址讀取 (含 CORS Proxy fallback)
  const handleLoadImageUrl = (urlToLoad) => {
    const url = (urlToLoad || imageUrlInput || '').trim();
    if (!url) {
      showFeedback('請輸入有效的圖片網址', 'warning');
      return;
    }

    setIsUrlLoading(true);
    showFeedback('正在讀取網路圖片...', 'info');

    if (url.startsWith('data:image/')) {
      setCropImageSource(url);
      setPendingRawSource(url);
      setImageUrlInput('');
      setIsUrlLoading(false);
      setIsCropModalOpen(true);
      return;
    }

    const tryLoadImage = (targetUrl, isProxy = false) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const MAX_DIM = 1200;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setCropImageSource(dataUrl);
          setPendingRawSource(dataUrl);
        } catch (canvasErr) {
          setCropImageSource(targetUrl);
          setPendingRawSource(targetUrl);
        }
        setImageUrlInput('');
        setIsUrlLoading(false);
        setIsCropModalOpen(true);
      };

      img.onerror = () => {
        if (!isProxy && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
          // Retry using CORS proxy fallback
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
          tryLoadImage(proxyUrl, true);
        } else {
          setIsUrlLoading(false);
          showFeedback('無法載入該網址的圖片，請確認連結正確或下載後拖曳上傳', 'error');
        }
      };

      img.src = targetUrl;
    };

    tryLoadImage(url, false);
  };

  // 3. 拖曳事件處理
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processImageFile(file);
      } else {
        showFeedback('請拖曳圖片檔案 (JPG, PNG, GIF, WebP)', 'warning');
      }
      return;
    }

    const draggedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (draggedUrl && (draggedUrl.startsWith('http://') || draggedUrl.startsWith('https://') || draggedUrl.startsWith('data:image/'))) {
      handleLoadImageUrl(draggedUrl);
    }
  };

  // 4. 重新調整大小 (Re-crop)
  const handleReCrop = () => {
    const src = character?.avatarRaw || character?.avatar;
    if (!src) return;
    setCropImageSource(src);
    setPendingRawSource(src);
    setIsCropModalOpen(true);
  };

  // 5. 確認裁切並套用
  const handleConfirmCrop = (croppedDataUrl) => {
    onChange({
      ...character,
      avatar: croppedDataUrl,
      avatarRaw: pendingRawSource || character?.avatarRaw || croppedDataUrl,
      updatedAt: new Date().toISOString()
    });
    setIsCropModalOpen(false);
    showFeedback('頭像肖像已裁切並套用！', 'info');
  };

  // 6. 清除頭像照片
  const handleClearAvatar = () => {
    onChange({
      ...character,
      avatar: null,
      avatarRaw: null,
      updatedAt: new Date().toISOString()
    });
    showFeedback('已移除自訂肖像照片', 'info');
  };

  // 7. 選用經典職業圖標
  const handleSelectClassIcon = (iconName) => {
    onChange({
      ...character,
      avatar: iconName,
      avatarRaw: null,
      updatedAt: new Date().toISOString()
    });
    setShowClassIconPicker(false);
    showFeedback(`已更換為職業符號：${iconName}`, 'info');
  };

  const isCustomPhoto = character?.avatar && (character.avatar.startsWith('http') || character.avatar.startsWith('data:'));
  const currentClassName = character?.classes?.[0]?.className || 'sword';

  return (
    <div className="space-y-2">
      {/* 裁切彈窗 */}
      <AvatarCropperModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSource}
        onClose={() => setIsCropModalOpen(false)}
        onConfirm={handleConfirmCrop}
        theme={theme}
      />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.textDark }}>
          <ImageIcon size={15} style={{ color: theme.accent }} />
          <span>角色肖像與頭像</span>
        </label>
        <div className="flex items-center gap-2">
          {isCustomPhoto && (
            <button
              type="button"
              onClick={handleClearAvatar}
              className="text-t11 text-[#8c2d36] hover:text-[#76252d] flex items-center gap-1 font-bold transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              <span>移除照片</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowClassIconPicker(!showClassIconPicker)}
            className="text-t11 px-2 py-0.5 rounded border font-bold transition-colors flex items-center gap-1 cursor-pointer"
            style={{
              backgroundColor: theme.subpanelBg,
              borderColor: theme.border,
              color: theme.textDark
            }}
          >
            <GiSparkles size={12} style={{ color: theme.accent }} />
            <span>{showClassIconPicker ? '隱藏符號庫' : '選用職業符號'}</span>
          </button>
        </div>
      </div>

      {/* 拖曳上傳與配置面板 */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative transition-all duration-200 border-2 rounded p-3.5 ${
          isDraggingOver
            ? 'shadow-md ring-2'
            : 'hover:border-[#3c2415]'
        }`}
        style={{
          backgroundColor: isDraggingOver ? '#f9f5eb' : '#fffdf9',
          borderColor: isDraggingOver ? theme.accent : theme.border
        }}
      >
        {/* 拖曳覆蓋層動畫 */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#fffdf9]/95 backdrop-blur-xs rounded border-2 border-dashed border-[#3c2415] text-[#2c221e] pointer-events-none animate-in fade-in duration-150">
            <Upload size={32} className="mb-1 text-[#6b5a4b]" />
            <span className="font-bold text-xs">釋放滑鼠以上傳照片或網址</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          {/* 左側：方形預覽框 (點擊或拖曳即可上傳) */}
          <div
            onClick={() => {
              if (isCustomPhoto) {
                handleReCrop();
              } else if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded border-2 bg-[#f4ebd9] shrink-0 overflow-hidden flex items-center justify-center shadow-inner group select-none cursor-pointer transition-all"
            style={{ borderColor: theme.border }}
            title={isCustomPhoto ? "點擊重新裁切調整大小" : "點擊上傳本地照片"}
          >
            {isCustomPhoto ? (
              <>
                <img
                  src={character.avatar}
                  alt={character.name || "Avatar"}
                  draggable={false}
                  className="w-full h-full object-cover select-none"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white p-1 backdrop-blur-xs">
                  <Crop size={14} />
                  <span className="text-t10 font-bold">調整大小</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-[#6b5a4b] gap-1 p-2 text-center w-full h-full group-hover:bg-[#e8dcc4] transition-colors">
                {character?.avatar ? (
                  <GameIcon name={character.avatar} size={36} style={{ color: theme.accent }} />
                ) : (
                  <GameIcon name={currentClassName} size={36} style={{ color: theme.accent }} />
                )}
                <span className="text-t12 font-bold text-[#6b5a4b]">點擊上傳照片</span>
              </div>
            )}
          </div>

          {/* 右側：按鈕控制與網址輸入 */}
          <div className="flex-1 space-y-2.5 w-full min-w-0">
            {/* 按鈕組 */}
            <div className="flex flex-wrap items-center gap-2">
              <label
                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded transition-all shadow-2xs hover:opacity-90"
                style={{ backgroundColor: theme.accent }}
              >
                <Upload size={13} />
                <span>{isCustomPhoto ? '更換本地檔案' : '上傳本地照片'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </label>

              {isCustomPhoto && (
                <>
                  <button
                    type="button"
                    onClick={handleReCrop}
                    className="px-2.5 py-1.5 rounded border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: theme.subpanelBg,
                      borderColor: theme.border,
                      color: theme.textDark
                    }}
                  >
                    <Crop size={13} />
                    <span>重新調整大小</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAvatar}
                    className="px-2.5 py-1.5 rounded border border-[#8c2d36]/30 bg-[#f9f5eb] hover:bg-[#f4ebd9] text-[#8c2d36] text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    <span>清除</span>
                  </button>
                </>
              )}

              <span className="text-t11 text-[#6b5a4b] hidden lg:inline font-bold">
                或直接拖曳圖片至此
              </span>
            </div>

            {/* 網址輸入 */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type="url"
                  placeholder="或輸入圖片網址... 例如: https://.../portrait.png"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLoadImageUrl();
                    }
                  }}
                  className="w-full rounded px-2.5 py-1.5 text-xs outline-none border transition-colors font-medium shadow-2xs"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    color: theme.textDark
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleLoadImageUrl()}
                disabled={isUrlLoading}
                className="px-3 py-1.5 rounded border text-xs font-bold transition-all disabled:opacity-50 shadow-2xs shrink-0 cursor-pointer flex items-center gap-1"
                style={{
                  backgroundColor: theme.subpanelBg,
                  borderColor: theme.border,
                  color: theme.textDark
                }}
              >
                <LinkIcon size={12} />
                <span>{isUrlLoading ? '讀取中...' : '載入網址'}</span>
              </button>
            </div>

            <p className="text-t12 text-[#6b5a4b] leading-tight">
              支援 JPG, PNG, GIF, WebP 檔案或網址，可自由縮放與移動裁切。將同步顯示於角色卡、跑團面板與名冊大廳。
            </p>
          </div>
        </div>

        {/* 快速選用經典職業圖標庫面板 */}
        {showClassIconPicker && (
          <div className="mt-3 pt-3 border-t space-y-2 animate-in fade-in duration-150" style={{ borderColor: theme.border }}>
            <div className="text-t11 font-bold text-[#6b5a4b] flex items-center justify-between">
              <span>經典職業符號（無照片時可作為卡面標誌）：</span>
              <button
                type="button"
                onClick={() => setShowClassIconPicker(false)}
                className="text-t10 text-[#6b5a4b] hover:text-[#3c2415] cursor-pointer"
              >
                收起
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-[#fbf7ee]/80 rounded border" style={{ borderColor: theme.border }}>
              {Object.values(CLASS_METADATA)
                .filter((cls) => cls.source !== 'playtest')
                .map((cls) => {
                  const isSelected = character?.avatar === cls.name;
                  return (
                    <button
                      key={cls.name}
                      type="button"
                      onClick={() => handleSelectClassIcon(cls.name)}
                      className={`px-2 py-1 rounded text-t11 font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                        isSelected
                          ? 'text-white shadow-xs'
                          : 'bg-white hover:bg-[#f4ebd9] text-[#3c2415]'
                      }`}
                      style={isSelected ? { backgroundColor: theme.accent, borderColor: theme.accent } : { borderColor: theme.border }}
                      title={`${cls.name} / ${cls.en}：${cls.tagline}`}
                    >
                      <GameIcon name={cls.name} size={14} style={{ color: isSelected ? '#fffdf9' : theme.accent }} />
                      <span>{cls.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
