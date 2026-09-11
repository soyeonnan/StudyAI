import { progressColor, progressLabel } from '../lib/progress'
import './ProgressBar.css'

/**
 * 진행률 막대. 숫자(%)와 진행도별 색상을 함께 표시한다.
 *
 * props:
 * - percent: 0~100
 * - done, total: 표시용 (예: "3/10")
 * - label: 좌측 라벨 텍스트
 * - showText: 라벨/개수 표시 여부 (기본 true)
 */
export default function ProgressBar({ percent, done, total, label, showText = true }) {
  const color = progressColor(percent)

  return (
    <div className="progress">
      {showText && (
        <div className="progress-head">
          <span className="progress-label">
            {label || progressLabel(percent)}
            {done !== undefined && total !== undefined && (
              <span className="progress-count"> {done}/{total}</span>
            )}
          </span>
          <span className="progress-percent" style={{ color }}>{percent}%</span>
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%`, background: color }} />
      </div>
    </div>
  )
}
