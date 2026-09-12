import { progressColor } from '../../lib/progress'
import './WeeklyTrendChart.css'

// "9/8" 형태의 짧은 월/일 라벨
function shortLabel(isoDate) {
  const d = new Date(isoDate)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 주간 추이 차트 (외부 라이브러리 없이 CSS로 구현).
 * 막대 = 주별 공부시간, 막대 색 = 그 주 루틴 달성률.
 *
 * props:
 * - data: [{ week_start, study_seconds, routine_done, routine_total }]
 */
export default function WeeklyTrendChart({ data }) {
  const maxSeconds = Math.max(1, ...data.map((d) => d.study_seconds))

  return (
    <div className="weekly-chart">
      <div className="weekly-bars">
        {data.map((d) => {
          const heightPercent = Math.round((d.study_seconds / maxSeconds) * 100)
          const minutes = Math.round(d.study_seconds / 60)
          const rate = d.routine_total > 0 ? Math.round((d.routine_done / d.routine_total) * 100) : 0
          const color = d.routine_total > 0 ? progressColor(rate) : '#cbd5e1'
          const title = `${shortLabel(d.week_start)} 주 · ${minutes}분 · 루틴 ${d.routine_done}/${d.routine_total}`
          return (
            <div className="weekly-col" key={d.week_start} title={title}>
              <div className="weekly-track">
                <div
                  className={`weekly-fill ${d.study_seconds > 0 ? '' : 'weekly-empty'}`}
                  style={{ height: `${heightPercent}%`, background: color }}
                />
              </div>
              <span className="weekly-label">{shortLabel(d.week_start)}</span>
            </div>
          )
        })}
      </div>
      <div className="weekly-legend">
        막대 높이 = 주간 공부시간, 색상 = 그 주 루틴 달성률
      </div>
    </div>
  )
}
