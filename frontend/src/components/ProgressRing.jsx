import { progressColor } from '../lib/progress'

/**
 * 원형 진행률(도넛). 대시보드 등에서 한눈에 보여줄 때 사용한다.
 *
 * props:
 * - percent: 0~100
 * - size: 지름(px), 기본 96
 * - stroke: 링 두께(px), 기본 10
 * - caption: 링 아래(또는 안쪽) 보조 텍스트
 */
export default function ProgressRing({ percent, size = 96, stroke = 10, caption }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference
  const color = progressColor(percent)

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={size * 0.24}
          fontWeight="800"
          fill="var(--text)"
        >
          {percent}%
        </text>
      </svg>
      {caption && (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{caption}</span>
      )}
    </div>
  )
}
