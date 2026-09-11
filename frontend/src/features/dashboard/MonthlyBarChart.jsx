import './MonthlyBarChart.css'

/**
 * 월별 일별 공부량 막대그래프 (외부 라이브러리 없이 CSS로 구현).
 *
 * props:
 * - data: [{ day, study_seconds }]
 */
export default function MonthlyBarChart({ data }) {
  const maxSeconds = Math.max(1, ...data.map((d) => d.study_seconds))

  return (
    <div className="bar-chart">
      <div className="bar-chart-bars">
        {data.map((d) => {
          const heightPercent = Math.round((d.study_seconds / maxSeconds) * 100)
          const minutes = Math.round(d.study_seconds / 60)
          return (
            <div className="bar-col" key={d.day} title={`${d.day}일 · ${minutes}분`}>
              <div className="bar-track">
                <div
                  className={`bar-fill ${d.study_seconds > 0 ? '' : 'bar-empty'}`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              {/* 5일 간격 + 1일만 라벨 표시해 가독성 유지 */}
              {(d.day === 1 || d.day % 5 === 0) && <span className="bar-label">{d.day}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
