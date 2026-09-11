import { useEffect, useState } from 'react'

import { fetchDailyStats, fetchMonthlyStats } from '../api/analytics'
import ProgressRing from '../components/ProgressRing'
import MonthlyBarChart from '../features/dashboard/MonthlyBarChart'
import SubjectBreakdown from '../features/dashboard/SubjectBreakdown'
import { useAuth } from '../auth/AuthContext'
import { toPercent } from '../lib/progress'
import { formatDuration, toDateString } from '../lib/time'
import './DashboardPage.css'

const MONTH_LABELS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]

export default function DashboardPage() {
  const { user } = useAuth()
  const [daily, setDaily] = useState(null)
  const [monthly, setMonthly] = useState(null)

  const now = new Date()
  const todayStr = toDateString(now)

  useEffect(() => {
    fetchDailyStats(todayStr).then(setDaily)
    fetchMonthlyStats(now.getFullYear(), now.getMonth() + 1).then(setMonthly)
    // 최초 1회만 로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const routinePercentToday = daily ? toPercent(daily.routine_done, daily.routine_total) : 0
  const schedulePercentToday = daily ? toPercent(daily.schedule_done, daily.schedule_total) : 0
  const monthlyRoutinePercent = monthly ? toPercent(monthly.routine_done, monthly.routine_total) : 0

  return (
    <div className="dashboard">
      <h2 className="dashboard-greeting">
        {user?.display_name}님, 오늘도 공부해볼까요?
      </h2>

      {/* Today */}
      <section className="dashboard-section">
        <h3 className="dashboard-section-title">Today · {todayStr}</h3>
        {daily && (
          <div className="today-grid">
            <div className="stat-box">
              <span className="stat-box-label">오늘 공부 시간</span>
              <strong className="stat-box-value">{formatDuration(daily.total_study_seconds)}</strong>
              <span className="stat-box-sub">{daily.session_count}개 기록</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-label">평균 집중도</span>
              <strong className="stat-box-value">
                {daily.avg_focus > 0 ? `${daily.avg_focus} / 5` : '-'}
              </strong>
              <span className="stat-box-sub">휴식 {formatDuration(daily.total_break_seconds)}</span>
            </div>
            <div className="ring-box">
              <ProgressRing percent={routinePercentToday} caption={`루틴 ${daily.routine_done}/${daily.routine_total}`} />
            </div>
            <div className="ring-box">
              <ProgressRing percent={schedulePercentToday} caption={`일정 ${daily.schedule_done}/${daily.schedule_total}`} />
            </div>
          </div>
        )}
      </section>

      {/* This Month */}
      <section className="dashboard-section">
        <h3 className="dashboard-section-title">
          This Month · {monthly ? `${monthly.year}년 ${MONTH_LABELS[monthly.month - 1]}` : ''}
        </h3>
        {monthly && (
          <>
            <div className="month-summary">
              <div className="stat-box">
                <span className="stat-box-label">총 공부 시간</span>
                <strong className="stat-box-value">{formatDuration(monthly.total_study_seconds)}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-box-label">평균 집중도</span>
                <strong className="stat-box-value">
                  {monthly.avg_focus > 0 ? `${monthly.avg_focus} / 5` : '-'}
                </strong>
              </div>
              <div className="stat-box">
                <span className="stat-box-label">공부한 날</span>
                <strong className="stat-box-value">{monthly.study_days}일</strong>
              </div>
              <div className="stat-box">
                <span className="stat-box-label">루틴 달성률</span>
                <strong className="stat-box-value">{monthlyRoutinePercent}%</strong>
                <span className="stat-box-sub">{monthly.routine_done}/{monthly.routine_total}</span>
              </div>
            </div>

            <div className="month-chart-block">
              <h4 className="month-block-title">일별 공부량</h4>
              <MonthlyBarChart data={monthly.daily} />
            </div>

            <div className="month-chart-block">
              <h4 className="month-block-title">과목별 비중</h4>
              <SubjectBreakdown subjects={monthly.subjects} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
