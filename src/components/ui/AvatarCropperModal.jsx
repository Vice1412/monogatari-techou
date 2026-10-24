import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  X,
  Move,
  ZoomIn,
  RefreshCw,
  Check
} from 'lucide-react';

/**
 * AvatarCropperModal - 角色肖像與頭像裁切調整彈窗
 * 提供 1:1 正方形裁切視窗，支援滑鼠/觸控拖曳平移、滾輪縮放、拉桿縮放與快速倍率設定。
 */
export default function AvatarCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onConfirm,
  theme = null
}) {
  const [zoom, setZoom] = useState(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const imgRef = useRef(null);

  const VIEWPORT_SIZE = 280;

  useEffect(() => {
    if (imageSrc && isOpen) {
      setZoom(1.0);
      setOffset({ x: 0, y: 0 });
      const img = new Image();
      img.onload = () => {
        setNaturalSize({
          w: img.naturalWidth || img.width,
          h: img.naturalHeight || img.height
        });
      };
      img.src = imageSrc;
    }
  }, [imageSrc, isOpen]);

  // 按下 Escape 鍵快速關閉裁切視窗
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  const baseScale = naturalSize.w && naturalSize.h
    ? Math.max(VIEWPORT_SIZE / naturalSize.w, VIEWPORT_SIZE / naturalSize.h)
    : 1;

  const currentScale = baseScale * zoom;
  const renderedW = (naturalSize.w || VIEWPORT_SIZE) * currentScale;
  const renderedH = (naturalSize.h || VIEWPORT_SIZE) * currentScale;

  const left = VIEWPORT_SIZE / 2 + offset.x - renderedW / 2;
  const top = VIEWPORT_SIZE / 2 + offset.y - renderedH / 2;

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: offset.x,
      startY: offset.y
    };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: Math.round(dragStartRef.current.startX + dx),
      y: Math.round(dragStartRef.current.startY + dy)
    });
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      setIsDragging(false);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const step = -e.deltaY * 0.002;
    setZoom(prev => Math.min(5.0, Math.max(0.2, Math.round((prev + step) * 100) / 100)));
  };

  const handleApply = () => {
    if (!imgRef.current) return;
    try {
      const OUTPUT_SIZE = 500;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      const ratio = OUTPUT_SIZE / VIEWPORT_SIZE;
      const drawX = left * ratio;
      const drawY = top * ratio;
      const drawW = renderedW * ratio;
      const drawH = renderedH * ratio;

      ctx.drawImage(imgRef.current, drawX, drawY, drawW, drawH);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onConfirm(croppedDataUrl);
    } catch (err) {
      console.warn("Canvas crop export failed (likely CORS tainted), using raw image source directly:", err);
      onConfirm(imageSrc);
    }
  };

  const accentColor = theme?.accent || '#a63d40';

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#fbf7ee] border border-[#d6c7ab] rounded-2xl shadow-e3 max-w-md w-full p-4 sm:p-5 space-y-3.5 sm:space-y-4 text-[#2c221e] max-h-[92vh] overflow-y-auto">
        {/* 標題欄 */}
        <div className="flex items-center justify-between pb-2 border-b border-[#d6c7ab]">
          <div>
            <h3 className="font-bold text-base text-[#3c2415] flex items-center gap-2">
              <ImageIcon size={18} style={{ color: accentColor }} />
              調整頭像肖像大小與位置
            </h3>
            <p className="text-xs text-[#6b5a4b] mt-0.5">
              按住圖片可自由拖曳平移位置，滑動拉桿或滾動滑鼠滾輪可放大縮小
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#6b5a4b] hover:text-[#2c221e] rounded-lg hover:bg-[#f4ebd9] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 裁切預覽視窗 */}
        <div className="flex justify-center py-1">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            className={`relative rounded-xl overflow-hidden border-2 bg-[#f4ebd9] shadow-md select-none touch-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            title="按住滑鼠拖曳移動，滾動滑鼠滾輪縮放"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              crossOrigin="anonymous"
              alt="Crop Target"
              draggable={false}
              className="absolute max-w-none select-none pointer-events-none"
              style={{
                width: `${renderedW}px`,
                height: `${renderedH}px`,
                left: `${left}px`,
                top: `${top}px`
              }}
            />

            {/* 九宮格輔助構圖線 */}
            <div className="absolute inset-0 pointer-events-none border border-black/10 grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div className="border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div className="border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div></div>
            </div>

            {/* 提示徽章 */}
            <div className="absolute top-2 left-2 bg-[#fffdf9]/90 backdrop-blur-sm border border-[#d6c7ab] rounded px-2 py-0.5 text-t10 text-[#3c2415] font-bold flex items-center gap-1 pointer-events-none">
              <Move size={11} /> 拖曳移動
            </div>
          </div>
        </div>

        {/* 縮放拉桿與倍率按鈕 */}
        <div className="space-y-3 bg-[#fffdf9] border border-[#d6c7ab] p-3 rounded-xl">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#3c2415] font-bold">
              <ZoomIn size={15} style={{ color: accentColor }} />
              <span>縮放大小：</span>
              <span className="font-mono text-sm" style={{ color: accentColor }}>
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setZoom(1.0); setOffset({ x: 0, y: 0 }); }}
              className="text-t11 text-[#6b5a4b] hover:text-[#2c221e] flex items-center gap-1 transition font-bold"
            >
              <RefreshCw size={12} /> 居中重設
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-t10 text-[#7c6a58] font-mono">20%</span>
            <input
              type="range"
              min="0.2"
              max="5.0"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-[#d6c7ab] rounded-lg appearance-none cursor-pointer"
              style={{ accentColor }}
            />
            <span className="text-t10 text-[#7c6a58] font-mono">500%</span>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1">
            <span className="text-t10 text-[#7c6a58] font-bold">快速倍率：</span>
            <div className="flex gap-1 flex-wrap">
              {[0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0].map((sVal) => {
                const isActive = Math.abs(zoom - sVal) < 0.05;
                return (
                  <button
                    key={sVal}
                    type="button"
                    onClick={() => setZoom(sVal)}
                    className={`px-2 py-0.5 rounded text-t11 font-mono transition ${
                      isActive
                        ? 'text-white font-bold shadow-xs'
                        : 'bg-[#f4ebd9] text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#e8dcc4]'
                    }`}
                    style={isActive ? { backgroundColor: accentColor } : {}}
                  >
                    {Math.round(sVal * 100)}%
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部操作按鈕 */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d6c7ab]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#f4ebd9] hover:bg-[#e8dcc4] text-[#3c2415] rounded-lg text-xs font-bold transition border border-[#d6c7ab]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 hover:opacity-90 active:scale-98"
            style={{ backgroundColor: accentColor }}
          >
            <Check size={14} /> 完成裁切並套用
          </button>
        </div>
      </div>
    </div>
  );
}
