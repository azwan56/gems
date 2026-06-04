import React from 'react';

interface VixSparklineProps {
  data: number[];
  trend: 'SPIKING' | 'SUPPRESSED' | 'NORMAL' | 'UNKNOWN';
}

export function VixSparkline({ data, trend }: VixSparklineProps) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  // Padding to ensure lines don't hit the exact edges
  const padding = 4;
  const width = 100;
  const height = 40;
  
  // Create points for SVG polyline
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    // Invert y so higher values are at the top
    const y = range === 0 
      ? height / 2 
      : height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  // Determine color based on trend
  let strokeColor = '#3b82f6'; // default blue
  let glowColor = 'rgba(59, 130, 246, 0.3)';
  
  if (trend === 'SPIKING') {
    strokeColor = '#ef4444'; // red-500
    glowColor = 'rgba(239, 68, 68, 0.3)';
  } else if (trend === 'SUPPRESSED') {
    strokeColor = '#f59e0b'; // amber-500
    glowColor = 'rgba(245, 158, 11, 0.3)';
  } else if (trend === 'NORMAL') {
    strokeColor = '#10b981'; // emerald-500
    glowColor = 'rgba(16, 185, 129, 0.3)';
  }

  return (
    <div className="flex flex-col items-end">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        {/* Render dots for each point */}
        {data.map((val, i) => {
          const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
          const y = range === 0 
            ? height / 2 
            : height - padding - ((val - min) / range) * (height - padding * 2);
          
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2"
              fill={i === data.length - 1 ? strokeColor : 'transparent'}
            />
          );
        })}
      </svg>
      <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">7-Day Trend</span>
    </div>
  );
}
