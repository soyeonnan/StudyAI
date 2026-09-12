import { useCallback, useEffect, useState } from 'react'

import {
  createGoal,
  createStep,
  deleteGoal,
  deleteStep,
  fetchGoals,
  updateGoal,
  updateStep,
} from '../api/goals'
import ProgressBar from '../components/ProgressBar'
import SubjectTreePicker from '../features/subjects/SubjectTreePicker'
import './GoalsPage.css'

const IMPORTANCE_LABELS = ['', '아주 낮음', '낮음', '보통', '높음', '아주 높음']

// 목표 생성 폼 초기값
const EMPTY_FORM = {
  title: '',
  description: '',
  subjectId: null,
  targetType: 'steps',
  targetMinutes: 0,
  dueDate: '',
  importance: 3,
}

export default function GoalsPage() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  // 목표별 단계 입력 상태 { [goalId]: title }
  const [stepInputs, setStepInputs] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchGoals()
    setGoals(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ---- 목표 ----
  async function handleCreateGoal(e) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) return
    await createGoal({
      title,
      description: form.description.trim() || null,
      subjectId: form.subjectId,
      targetType: form.targetType,
      targetMinutes: form.targetType === 'minutes' ? Number(form.targetMinutes) || 0 : 0,
      dueDate: form.dueDate || null,
      importance: Number(form.importance),
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
    load()
  }

  async function handleToggleComplete(goal) {
    await updateGoal(goal.id, { isCompleted: !goal.is_completed })
    load()
  }

  async function handleDeleteGoal(goalId) {
    await deleteGoal(goalId)
    load()
  }

  // ---- 로드맵 단계 ----
  async function handleAddStep(goal) {
    const title = (stepInputs[goal.id] || '').trim()
    if (!title) return
    // 새 단계는 맨 뒤 순서로 둔다.
    await createStep(goal.id, { title, orderIndex: goal.total_steps })
    setStepInputs((prev) => ({ ...prev, [goal.id]: '' }))
    load()
  }

  async function handleToggleStep(goalId, step) {
    await updateStep(goalId, step.id, { isDone: !step.is_done })
    load()
  }

  async function handleDeleteStep(goalId, stepId) {
    await deleteStep(goalId, stepId)
    load()
  }

  return (
    <div className="goals-page">
      <div className="goals-header">
        <h2 className="goals-title">공부 목표</h2>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '취소' : '+ 목표 추가'}
        </button>
      </div>

      {showForm && (
        <form className="goal-form card" onSubmit={handleCreateGoal}>
          <input
            className="field"
            placeholder="목표 제목 (예: 정보처리기사 필기 합격)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="field goal-form-desc"
            placeholder="설명 (선택)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="goal-form-row">
            <label className="goal-form-label">과목</label>
            <SubjectTreePicker
              value={form.subjectId}
              onChange={(id) => setForm({ ...form, subjectId: id })}
              allowEmpty
            />
          </div>

          <div className="goal-form-row">
            <label className="goal-form-label">목표 방식</label>
            <select
              className="field"
              value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value })}
            >
              <option value="steps">단계 완료 기준</option>
              <option value="minutes">공부 시간 기준</option>
            </select>
          </div>

          {form.targetType === 'minutes' && (
            <div className="goal-form-row">
              <label className="goal-form-label">목표 시간(분)</label>
              <input
                className="field"
                type="number"
                min="0"
                value={form.targetMinutes}
                onChange={(e) => setForm({ ...form, targetMinutes: e.target.value })}
              />
            </div>
          )}

          <div className="goal-form-row">
            <label className="goal-form-label">마감일</label>
            <input
              className="field"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>

          <div className="goal-form-row">
            <label className="goal-form-label">중요도</label>
            <select
              className="field"
              value={form.importance}
              onChange={(e) => setForm({ ...form, importance: e.target.value })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {IMPORTANCE_LABELS[n]}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary">
            목표 만들기
          </button>
        </form>
      )}

      {loading ? (
        <p className="goals-empty">불러오는 중...</p>
      ) : goals.length === 0 ? (
        <p className="goals-empty">아직 등록한 목표가 없어요. 첫 목표를 추가해 보세요.</p>
      ) : (
        <ul className="goal-list">
          {goals.map((goal) => {
            const percent = Math.round(goal.progress * 100)
            return (
              <li key={goal.id} className={`goal-card card ${goal.is_completed ? 'goal-completed' : ''}`}>
                <div className="goal-card-head">
                  <div>
                    <h3 className="goal-card-title">{goal.title}</h3>
                    <div className="goal-card-meta">
                      {goal.subject_path && <span className="goal-tag">{goal.subject_path}</span>}
                      <span className="goal-tag">중요도 {IMPORTANCE_LABELS[goal.importance]}</span>
                      {goal.due_date && <span className="goal-tag">~{goal.due_date}</span>}
                      <span className="goal-tag">
                        {goal.target_type === 'minutes' ? '시간 기준' : '단계 기준'}
                      </span>
                    </div>
                  </div>
                  <div className="goal-card-actions">
                    <button className="btn goal-mini" onClick={() => handleToggleComplete(goal)}>
                      {goal.is_completed ? '완료 해제' : '완료 처리'}
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDeleteGoal(goal.id)}>
                      삭제
                    </button>
                  </div>
                </div>

                {goal.description && <p className="goal-card-desc">{goal.description}</p>}

                <ProgressBar
                  percent={percent}
                  done={goal.done_steps}
                  total={goal.total_steps}
                  label={goal.target_type === 'minutes' ? '목표 시간 달성' : '로드맵 진행'}
                />

                {/* 로드맵 단계 */}
                <div className="goal-steps">
                  <ul className="goal-step-list">
                    {goal.steps.length === 0 && (
                      <li className="goal-step-empty">단계를 추가해 목표를 쪼개 보세요.</li>
                    )}
                    {goal.steps.map((step) => (
                      <li key={step.id} className={`goal-step ${step.is_done ? 'goal-step-done' : ''}`}>
                        <label className="goal-step-check">
                          <input
                            type="checkbox"
                            checked={step.is_done}
                            onChange={() => handleToggleStep(goal.id, step)}
                          />
                          <span>{step.title}</span>
                        </label>
                        <button
                          className="btn goal-step-del"
                          onClick={() => handleDeleteStep(goal.id, step.id)}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="goal-step-add">
                    <input
                      className="field"
                      placeholder="단계 추가 (예: 1과목 개념 정리)"
                      value={stepInputs[goal.id] || ''}
                      onChange={(e) =>
                        setStepInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddStep(goal)
                        }
                      }}
                    />
                    <button className="btn btn-primary" onClick={() => handleAddStep(goal)}>
                      추가
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
