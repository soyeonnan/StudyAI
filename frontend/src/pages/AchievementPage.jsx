import { useCallback, useEffect, useState } from 'react'

import { fetchAchievementStats } from '../api/analytics'
import ProgressBar from '../components/ProgressBar'
import WeeklyTrendChart from '../features/dashboard/WeeklyTrendChart'
import './AchievementPage.css'

const IMPORTANCE_LABELS = ['', '아주 낮음', '낮음', '보통', '높음', '아주 높음']

// 기간 프리셋: 라벨 + 주 수
const PERIOD_OPTIONS = [
  { label: '최근 4주', weeks: 4 },
  { label: '최근 8주', weeks: 8 },
  { label: '최근 12주', weeks: 12 },
  { label: '최근 26주', weeks: 26 },
]

export default function AchievementPage() {
  const [weeks, setWeeks] = useState(8)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchAchievementStats({ weeks })
    setStats(data)
    setLoading(false)
  }, [weeks])

  useEffect(() => {
    load()
  }, [load])

  const completionRate =
    stats && stats.total_goals > 0
      ? Math.round((stats.completed_goals / stats.total_goals) * 100)
      : 0

  return (
    <div className="achievement-page">
      <div className="achievement-header">
        <h2 className="achievement-title">달성률</h2>
        <div className="achievement-weeks">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.weeks}
              className={`btn achievement-week-btn ${weeks === opt.weeks ? 'active' : ''}`}
              onClick={() => setWeeks(opt.weeks)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <p className="achievement-empty">불러오는 중...</p>
      ) : (
        <>
          <section className="achievement-section card">
            <h3 className="achievement-section-title">기간별 추이</h3>
            <WeeklyTrendChart data={stats.weeks} />
          </section>

          <section className="achievement-section card">
            <h3 className="achievement-section-title">목표 달성 요약</h3>
            <div className="goal-summary">
              <div className="goal-summary-stat">
                <span className="goal-summary-num">{stats.total_goals}</span>
                <span className="goal-summary-label">전체 목표</span>
              </div>
              <div className="goal-summary-stat">
                <span className="goal-summary-num">{stats.completed_goals}</span>
                <span className="goal-summary-label">완료</span>
              </div>
              <div className="goal-summary-stat">
                <span className="goal-summary-num">{stats.active_goals}</span>
                <span className="goal-summary-label">진행 중</span>
              </div>
            </div>
            {stats.total_goals > 0 && (
              <ProgressBar
                percent={completionRate}
                done={stats.completed_goals}
                total={stats.total_goals}
                label="목표 완료율"
              />
            )}
          </section>

          <section className="achievement-section card">
            <h3 className="achievement-section-title">목표별 진도</h3>
            <p className="achievement-hint">
              시간으로 정한 목표를 먼저, 그다음 중요도가 높은 순으로 보여줘요.
            </p>
            {stats.goals.length === 0 ? (
              <p className="achievement-empty">등록된 목표가 없어요.</p>
            ) : (
              <ul className="goal-progress-list">
                {stats.goals.map((g) => (
                  <li
                    key={g.goal_id}
                    className={`goal-progress-item ${g.target_type === 'minutes' && !g.is_completed ? 'goal-progress-priority' : ''}`}
                  >
                    <div className="goal-progress-head">
                      <span className={g.is_completed ? 'goal-progress-done' : ''}>{g.title}</span>
                      <div className="goal-progress-badges">
                        {g.target_type === 'minutes' && (
                          <span className="goal-progress-badge badge-time">시간목표</span>
                        )}
                        <span className={`goal-progress-badge badge-imp badge-imp-${g.importance}`}>
                          중요도 {IMPORTANCE_LABELS[g.importance]}
                        </span>
                        {g.is_completed && <span className="goal-progress-badge badge-done">완료</span>}
                      </div>
                    </div>
                    <ProgressBar
                      percent={Math.round(g.progress * 100)}
                      showText={g.target_type !== 'minutes'}
                    />
                    {g.target_type === 'minutes' && (
                      <p className="goal-progress-note">
                        목표 {Math.floor(g.target_minutes / 60)}시간 {g.target_minutes % 60}분 · 공부 시간은 추이 그래프에서 확인
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
