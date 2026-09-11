import { formatDuration } from '../../lib/time'
import './SubjectBreakdown.css'

// 과목별 색상 팔레트 (순서대로 배정)
const PALETTE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

/**
 * 과목별 공부 시간 비중을 가로 막대로 표시한다.
 * props: subjects [{ subject_id, subject_name, study_seconds }]
 */
export default function SubjectBreakdown({ subjects }) {
  const total = subjects.reduce((sum, s) => sum + s.study_seconds, 0)

  if (total === 0) {
    return <p className="breakdown-empty">이번 달 공부 기록이 없어요.</p>
  }

  return (
    <div className="breakdown">
      {subjects.map((s, idx) => {
        const percent = Math.round((s.study_seconds / total) * 100)
        const color = PALETTE[idx % PALETTE.length]
        return (
          <div className="breakdown-row" key={s.subject_id}>
            <div className="breakdown-info">
              <span className="breakdown-dot" style={{ background: color }} />
              <span className="breakdown-name">{s.subject_name}</span>
              <span className="breakdown-value">{formatDuration(s.study_seconds)} · {percent}%</span>
            </div>
            <div className="breakdown-track">
              <div className="breakdown-fill" style={{ width: `${percent}%`, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
