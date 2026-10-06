import { useState } from 'react';

/**
 * Gráfico de barras de una sola serie (SVG) con etiqueta de valor y tooltip.
 * data: [{ label, value }]   format: (v) => string   short: (v) => string (etiqueta sobre la barra)
 */
export default function BarChart({ data, format, short = format, height = 240 }) {
  const [hover, setHover] = useState(null);
  const W = 1000;
  const H = height;
  const pad = { top: 26, right: 8, bottom: 30, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.min(44, step * 0.55);
  const base = pad.top + innerH;
  const showAll = data.length <= 12;
  const maxIdx = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);

  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de barras" preserveAspectRatio="none" className="chart-svg">
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = pad.left + i * step + (step - barW) / 2;
          const r = Math.min(4, barW / 2, h);
          const label = showAll || i === maxIdx || i === hover;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + i * step} y={pad.top} width={step} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`}
                  className="bar"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {label && d.value > 0 && (
                <text x={x + barW / 2} y={base - h - 8} textAnchor="middle" className="bar-value">{short(d.value)}</text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={base} y2={base} className="chart-base" />
      </svg>
      <div className="chart-x" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((d) => <span key={d.label}>{d.label}</span>)}
      </div>
      {hover !== null && data[hover] && (
        <div className="chart-tip" style={{ left: `${((pad.left + (hover + 0.5) * step) / W) * 100}%` }}>
          <strong>{data[hover].label}</strong> {format(data[hover].value)}
        </div>
      )}
    </div>
  );
}
