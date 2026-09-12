import { useCallback, useEffect, useState } from 'react'

import { fetchAchievementStats } from '../api/analytics'
import ProgressBar from '../components/ProgressBar'
import WeeklyTrendChart from '../features/dashboard/WeeklyTrendChart'
import './AchievementPage.css'

const WEEK_OPTIONS = [4, 8, 12]

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
          {WEEK_OPTIONS.map((w) => (
            <button
              key={w}
              className={`btn achievement-week-btn ${weeks === w ? 'active' : ''}`}
              onClick={() => setWeeks(w)}
            >
              최근 {w}주
            </button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <p className="achievement-empty">불러오는 중...</p>
      ) : (
        <>
          <section className="achievement-section card">
            <h3 className="achievement-section-title">주간 추이</h3>
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
            {stats.goals.length === 0 ? (
              <p className="achievement-empty">등록된 목표가 없어요.</p>
            ) : (
              <ul className="goal-progress-list">
                {stats.goals.map((g) => (
                  <li key={g.goal_id} className="goal-progress-item">
                    <div className="goal-progress-head">
                      <span className={g.is_completed ? 'goal-progress-done' : ''}>{g.title}</span>
                      {g.is_completed && <span className="goal-progress-badge">완료</span>}
                    </div>
                    <ProgressBar percent={Math.round(g.progress * 100)} showText={false} />
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
