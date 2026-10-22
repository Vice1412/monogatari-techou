/**
 * 魔石珠子（Technosphere Bead）
 *
 * 一顆魔晶石的視覺單位。做成一顆**嵌在金屬座裡的珠子**：
 * 外圈是等級環（5 段弧，亮幾段＝幾級），內圈是帶高光的球體，
 * 中央是識別圖示。插槽則是「一排珠座」，空位是虛線凹槽。
 *
 * ## 為什麼不是徽章
 *
 * 這一套規則的動詞是**鑲嵌**（socket、embed、slot in）——原書講的是把珠子
 * 塞進武器與防具的凹槽裡。用方形標籤排版會讓它讀起來像「標籤清單」，
 * 看不出「這件武器現在裝了什麼」。所以插槽內容一律用圓形珠子呈現。
 *
 * ## 全部用內聯樣式（沒有 Tailwind 類）
 *
 * 珠子的每一層都是**絕對定位疊出來的**，而 `absolute`／`relative` 若寫成 Tailwind
 * 類，外觀就悄悄依賴建置管線——把這個檔案單獨 SSR 出來看（`scratch/previewBeads.mjs`）
 * 會只剩等級環飄在空白處，珠子本體完全不見（`inset` 對靜態定位的 span 無效，
 * 尺寸塌成 0）。定位一律內聯，元件才自足：**預覽即所見**。
 *
 * ## 等級環的資料從哪來
 *
 * `beadRingSegments`（`data/technospheres.js`）回傳純角度，這裡只負責轉成
 * SVG path。切幾段、亮幾段是**資料層的事**，測試釘在那裡，不必比對截圖。
 *
 * ## 顏色不是識別方式
 *
 * 珠色（`getMnemosphereBeadTint` / `getHoplosphereBeadTint`）只是輔助：
 * 18px 的 gi 剪影在縮小後很難分辨（守護者的盾與武器大師的雙劍幾乎同形）。
 * 主要識別仍是圖示本身。
 */
import React from 'react';
import GameIcon from '../../../components/ui/GameIcon';
import { beadRingSegments, MNEMOSPHERE_MAX_LEVEL } from '../data/technospheres';

/** 角度 → 圓上的點（0° 在 12 點鐘、順時針） */
const polar = (deg, radius, center = 20) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [center + radius * Math.cos(rad), center + radius * Math.sin(rad)];
};

/**
 * 一段弧的 SVG path。
 * `sweepDeg` 一律小於 180（五段環每段 72°），所以 `largeArc` 恆為 0——
 * 但仍保留參數，免得日後改成三段環時默默畫錯。
 *
 * 半徑 17（viewBox 40）是**貼著珠子外緣**的位置：環內緣離珠體只剩約 2px，
 * 再小就會被珠體整圈蓋掉（等級環等於不存在），再大則會離珠體太遠、
 * 看起來像兩個分開的圖形。
 */
export const beadArcPath = (startDeg, endDeg, radius = 17, center = 20) => {
  const [x1, y1] = polar(startDeg, radius, center);
  const [x2, y2] = polar(endDeg, radius, center);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/**
 * 一顆珠子。
 *
 * @param {object} props
 * @param {string} [props.iconName] 交給 `GameIcon` 查表的名字（職業魔石傳職業名）
 * @param {React.ComponentType} [props.iconComponent] 直接指定圖示（附魔魔石傳泛指圖示）
 * @param {string} [props.tint] 珠色
 * @param {number} [props.level] 已達等級（畫亮幾段環）
 * @param {number} [props.maxLevel] 等級環段數
 * @param {number} [props.size] 直徑（px）
 * @param {boolean} [props.dim] 未裝備／未生效 → 去飽和
 * @param {string} [props.badge] 珠座右上角的小徽記（例如佔用格數）
 * @param {string} [props.title] 滑鼠停留提示
 * @param {string} [props.testId]
 */
export default function TechnosphereBead({
  iconName,
  iconComponent: IconComponent = null,
  tint = '#8a7a63',
  level = 0,
  maxLevel = MNEMOSPHERE_MAX_LEVEL,
  size = 34,
  dim = false,
  badge = null,
  title,
  testId
}) {
  const segments = beadRingSegments(level, maxLevel);
  const iconSize = Math.round(size * 0.44);

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        verticalAlign: 'middle'
      }}
      title={title}
      data-testid={testId}
    >
      {/* 珠座：一圈淺淺的內凹陰影，讓珠子看起來是「陷進去的」 */}
      <span
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: '50%',
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 45%, rgba(60,36,21,0.10) 55%, rgba(60,36,21,0.22) 100%)',
          boxShadow: 'inset 0 1px 2px rgba(60,36,21,0.35)'
        }}
      />

      {/* 等級環 */}
      <svg
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        width={size}
        height={size}
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        {segments.map((seg) => (
          <path
            key={seg.index}
            d={beadArcPath(seg.startDeg, seg.endDeg)}
            fill="none"
            stroke={tint}
            strokeOpacity={seg.active ? 1 : 0.30}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* 珠體：底色 → 上緣高光 → 下緣暗部，三層疊出球面 */}
      <span
        style={{
          position: 'absolute',
          inset: Math.max(4, Math.round(size * 0.20)),
          borderRadius: '50%',
          pointerEvents: 'none',
          backgroundColor: tint,
          backgroundImage: [
            'radial-gradient(circle at 34% 26%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.30) 22%, rgba(255,255,255,0) 52%)',
            'linear-gradient(to bottom, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.34) 100%)'
          ].join(', '),
          boxShadow: [
            'inset 0 1px 1px rgba(255,255,255,0.65)',
            'inset 0 -2px 3px rgba(0,0,0,0.32)',
            '0 1px 2px rgba(60,36,21,0.35)'
          ].join(', '),
          opacity: dim ? 0.5 : 1,
          filter: dim ? 'saturate(0.35)' : 'none'
        }}
      />

      {/* 中央圖示 */}
      <span
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.55))',
          opacity: dim ? 0.6 : 1
        }}
      >
        {IconComponent
          ? <IconComponent size={iconSize} />
          : <GameIcon name={iconName} size={iconSize} />}
      </span>

      {badge ? (
        <span
          style={{
            position: 'absolute',
            top: -5,
            right: -5,
            padding: '0 3px',
            borderRadius: 999,
            fontSize: 8,
            fontWeight: 700,
            lineHeight: 1.25,
            pointerEvents: 'none',
            backgroundColor: '#fbf7ee',
            border: '1px solid rgba(60,36,21,0.35)',
            color: '#3c2415'
          }}
        >
          {badge}
        </span>
      ) : null}
    </span>
  );
}

/**
 * 空珠座：插槽裡「還沒鑲東西」的凹槽。
 * 刻意用虛線圓而不是灰底方塊——它要讀起來像一個**等著被填的洞**。
 */
export function EmptyBeadSocket({ size = 34, label = null }) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px dashed rgba(60,36,21,0.30)',
        backgroundColor: 'rgba(60,36,21,0.045)',
        boxShadow: 'inset 0 1px 2px rgba(60,36,21,0.12)',
        color: 'rgba(60,36,21,0.40)',
        fontSize: Math.max(8, Math.round(size * 0.28)),
        fontWeight: 700,
        lineHeight: 1,
        verticalAlign: 'middle'
      }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
