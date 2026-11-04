import React from 'react';

/**
 * ScoreRing component renders an SVG radial score indicator with color-coded confidence levels.
 */
export default function ScoreRing({ score = 0, size = 96, strokeWidth = 8, showLabel = true }) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;

  const getColorConfig = (val) => {
    if (val >= 80) {
      return {
        stroke: '#dc2626', // red-600
        trail: '#fee2e2',  // red-100
        text: 'text-red-700',
        badge: 'bg-red-50 text-red-700 border-red-200',
        label: 'High Probability',
      };
    }
    if (val >= 60) {
      return {
        stroke: '#d97706', // amber-600
        trail: '#fef3c7',  // amber-100
        text: 'text-amber-700',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        label: 'Possible Duplicate',
      };
    }
    return {
      stroke: '#2563eb', // blue-600
      trail: '#dbeafe',  // blue-100
      text: 'text-blue-700',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      label: 'Low Match',
    };
  };

  const colors = getColorConfig(normalizedScore);

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 select-none">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg] transform"
          aria-label={`Match score ring: ${normalizedScore}%`}
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.trail}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated score circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Centered Percentage Score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-xl font-black tracking-tight ${colors.text} leading-none`}>
            {normalizedScore}
            <span className="text-xs font-bold opacity-80">%</span>
          </span>
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
            Match
          </span>
        </div>
      </div>

      {showLabel && (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${colors.badge}`}
        >
          {colors.label}
        </span>
      )}
    </div>
  );
}
