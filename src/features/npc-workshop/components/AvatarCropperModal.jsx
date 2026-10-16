/**
 * 由 `NPCWorkshop.jsx` 抽出的獨立元件（2026-10-16 拆檔第一批）。
 *
 * 抽出原則：這些元件本來就只透過 props 與外界溝通，不讀元件外的可變狀態。
 * 因此「搬到別的檔案」在行為上應完全等價——護欄見 `tests/npcWorkshopUi.test.mjs`。
 *
 * ※ 下方 import 由腳本依「區塊實際用到的識別字」自動產生，未使用的都已剔除。
 */
import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Image as ImageIcon, X, Target, Check, ZoomIn, Move, Crop } from 'lucide-react';

export default function AvatarCropperModal({ isOpen, imageSrc, onClose, onConfirm }) {
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
        setNaturalSize({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      };
      img.src = imageSrc;
    }
  }, [imageSrc, isOpen]);

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
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
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

  return (
    <div className="fixed inset-0 z-[120] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#fbf7ee] border border-[#d6c7ab] rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 text-[#2c221e]">
        <div className="flex items-center justify-between pb-2 border-b border-[#d6c7ab]">
          <div>
            <h3 className="font-bold text-base text-[#3c2415] flex items-center gap-2">
              <ImageIcon size={18} className="text-amber-700" /> 調整頭像大小與位置
            </h3>
            <p className="text-xs text-[#6b5a4b] mt-0.5">
              按住圖片可自由拖曳位置，滑動滑桿或滾動滾輪可放大縮小
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#6b5a4b] hover:text-[#2c221e] rounded-lg hover:bg-[#eee6d3] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-center py-1">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            className={`relative rounded-xl overflow-hidden border-2 border-amber-600/80 bg-[#f5efdf] shadow-md select-none touch-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            title="按住滑鼠拖曳移動，滾動滑鼠滾輪縮放"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop Target"
              draggable={false}
              className="absolute max-w-none select-none pointer-events-none pixelated"
              style={{
                width: `${renderedW}px`,
                height: `${renderedH}px`,
                left: `${left}px`,
                top: `${top}px`,
                imageRendering: 'pixelated'
              }}
            />

            <div className="absolute inset-0 pointer-events-none border border-amber-600/20 grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div className="border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div className="border-r border-b border-black/10"></div>
              <div className="border-b border-black/10"></div>
              <div className="border-r border-black/10"></div>
              <div className="border-r border-black/10"></div>
              <div></div>
            </div>

            <div className="absolute top-2 left-2 bg-[#fffdf9]/90 backdrop-blur-sm border border-[#d6c7ab] rounded px-2 py-0.5 text-[10px] text-amber-900 font-bold flex items-center gap-1 pointer-events-none">
              <Move size={11} /> 拖曳移動
            </div>
          </div>
        </div>

        <div className="space-y-3 bg-[#fffdf9] border border-[#d6c7ab] p-3 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#3c2f21] font-bold">
              <ZoomIn size={15} className="text-amber-700" />
              <span>縮放大小：</span>
              <span className="text-amber-800 font-mono text-sm">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setZoom(1.0); setOffset({ x: 0, y: 0 }); }}
              className="text-[11px] text-[#6b5a4b] hover:text-[#2c221e] flex items-center gap-1 transition"
            >
              <RefreshCw size={12} /> 居中重設
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#8c7b6c] font-mono">20%</span>
            <input
              type="range"
              min="0.2"
              max="5.0"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-[#d6c7ab] rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
            <span className="text-[10px] text-[#8c7b6c] font-mono">500%</span>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1">
            <span className="text-[10px] text-[#8c7b6c]">快速倍率：</span>
            <div className="flex gap-1 flex-wrap">
              {[0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0].map((sVal) => (
                <button
                  key={sVal}
                  type="button"
                  onClick={() => setZoom(sVal)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                    Math.abs(zoom - sVal) < 0.05
                      ? 'bg-amber-700 text-white font-bold'
                      : 'bg-[#eee6d3] text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#e4d9c0]'
                  }`}
                >
                  {Math.round(sVal * 100)}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d6c7ab]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#eee6d3] hover:bg-[#e4d9c0] text-[#3c2f21] rounded-lg text-xs font-bold transition border border-[#d6c7ab]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow flex items-center gap-1.5"
          >
            <Check size={14} /> 完成裁切並套用
          </button>
        </div>
      </div>
    </div>
  );
}
