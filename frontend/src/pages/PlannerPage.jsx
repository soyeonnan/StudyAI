import { useState } from 'react'

import { fetchTodayPlan } from '../api/planner'
import './PlannerPage.css'

// 분을 "1시간 20분" 형태로 표시
function formatMinutes(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h}시간 ${m}분`
  if (h > 0) return `${h}시간`
  return `${m}분`
}

export default function PlannerPage() {
  const [availableMinutes, setAvailableMinutes] = useState(120)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [requested, setRequested] = useState(false)
  const [showRules, setShowRules] = useState(false)

  async function handleGenerate(e) {
    e.preventDefault()
    setLoading(true)
    const data = await fetchTodayPlan({ availableMinutes: Number(availableMinutes) || 0 })
    setPlan(data)
    setRequested(true)
    setLoading(false)
  }

  return (
    <div className="planner-page">
      <div className="planner-header">
        <h2 className="planner-title">오늘 플래너</h2>
        <p className="planner-desc">
          가용 시간을 입력하면 마감·중요도·진도를 계산해 오늘 할 일을 추천해요. (규칙 기반)
        </p>
        <button type="button" className="planner-rules-toggle" onClick={() => setShowRules((v) => !v)}>
          {showRules ? '추천 규칙 접기 ▲' : '추천이 안 나오나요? 규칙 보기 ▼'}
        </button>
        {showRules && (
          <div className="planner-rules card">
            <p><strong>추천 대상</strong> — ① 상세 목표의 미완료 단계, ② 간단 시간목표(시간 남을 때 채움).</p>
            <p><strong>점수</strong> = 중요도(1~5) + 마감 임박도(오늘=5 … 마감없음=1) + 남은 진도(0~2). 높을수록 먼저.</p>
            <p><strong>추천이 안 나올 때</strong> — 단계형인데 단계가 없거나 모두 완료됨 / 목표를 완료 처리함 / 가용 시간이 너무 작아 예상 시간을 못 넘김.</p>
            <p className="planner-rules-note">자세한 규칙은 docs/플래너-추천-규칙.md 참고.</p>
          </div>
        )}
      </div>

      <form className="planner-form card" onSubmit={handleGenerate}>
        <label className="planner-form-label">오늘 공부할 수 있는 시간(분)</label>
        <div className="planner-form-row">
          <input
            className="field"
            type="number"
            min="0"
            max="1440"
            value={availableMinutes}
            onChange={(e) => setAvailableMinutes(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '계산 중...' : '오늘 할 일 추천'}
          </button>
        </div>
      </form>

      {requested && plan && (
        <>
          <div className="planner-summary card">
            <span>
              추천 {plan.items.length}개 · 예상 {formatMinutes(plan.planned_minutes)} / 가용{' '}
              {formatMinutes(plan.available_minutes)}
            </span>
          </div>

          <section className="planner-section">
            <h3 className="planner-section-title">추천 할 일</h3>
            {plan.items.length === 0 ? (
              <p className="planner-empty">
                추천할 미완료 단계가 없어요. 공부 목표에서 로드맵 단계를 추가해 보세요.
              </p>
            ) : (
              <ul className="plan-list">
                {plan.items.map((item) => (
                  <li key={item.step_id} className="plan-item card">
                    <div className="plan-item-main">
                      <span className="plan-badge">{item.score}점</span>
                      <div>
                        <div className="plan-step-title">{item.step_title}</div>
                        <div className="plan-goal-title">
                          {item.subject_path ? `${item.subject_path} · ` : ''}
                          {item.goal_title}
                        </div>
                        <div className="plan-reason">{item.reason}</div>
                      </div>
                    </div>
                    <span className="plan-est">{formatMinutes(item.estimated_minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {plan.overflow.length > 0 && (
            <section className="planner-section">
              <h3 className="planner-section-title">시간이 부족해 미룬 항목</h3>
              <ul className="plan-list">
                {plan.overflow.map((item) => (
                  <li key={item.step_id} className="plan-item plan-item-dim card">
                    <div className="plan-item-main">
                      <span className="plan-badge">{item.score}점</span>
                      <div>
                        <div className="plan-step-title">{item.step_title}</div>
                        <div className="plan-goal-title">{item.goal_title}</div>
                      </div>
                    </div>
                    <span className="plan-est">{formatMinutes(item.estimated_minutes)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.rebalance.length > 0 && (
            <section className="planner-section">
              <h3 className="planner-section-title">목표별 하루 권장량 (밀리지 않으려면)</h3>
              <ul className="rebalance-list">
                {plan.rebalance.map((r) => (
                  <li key={r.goal_id} className="rebalance-item card">
                    <div className="rebalance-goal">{r.goal_title}</div>
                    <div className="rebalance-detail">
                      마감 {r.days_left}일 · 남은 단계 {r.remaining_steps}개 · 하루{' '}
                      <strong>{r.per_day_steps}</strong>단계
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
