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
import { useConfirm } from '../components/ConfirmProvider'
import SubjectTreePicker from '../features/subjects/SubjectTreePicker'
import './GoalsPage.css'

const IMPORTANCE_LABELS = ['', '아주 낮음', '낮음', '보통', '높음', '아주 높음']

// 분을 "3시간 30분" 형태로 (목표 시간 표시용)
function formatMinutesLabel(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h}시간 ${m}분`
  if (h > 0) return `${h}시간`
  return `${m}분`
}

// 상세(단계형) 목표 생성 폼 초기값. 하위 단계를 최소 1개 입력해야 한다.
const EMPTY_DETAIL = {
  title: '',
  description: '',
  subjectId: null,
  dueDate: '',
  importance: 3,
  steps: [''], // 최소 1개 단계 강제
}

// 간단 시간목표 폼 초기값.
const EMPTY_SIMPLE = {
  title: '',
  subjectId: null,
  hours: 1,
  minutes: 0,
  dueDate: '',
  importance: 3,
}

export default function GoalsPage() {
  const confirm = useConfirm()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  // 생성 폼: null(닫힘) | 'simple' | 'detail'
  const [formMode, setFormMode] = useState(null)
  const [detail, setDetail] = useState(EMPTY_DETAIL)
  const [simple, setSimple] = useState(EMPTY_SIMPLE)

  // 카드별 상태
  const [stepInputs, setStepInputs] = useState({}) // { [goalId]: title }
  const [openActions, setOpenActions] = useState(null) // 액션 토글이 열린 goalId
  const [editingId, setEditingId] = useState(null) // 수정 중인 goalId
  const [editForm, setEditForm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchGoals()
    setGoals(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function closeForms() {
    setFormMode(null)
    setDetail(EMPTY_DETAIL)
    setSimple(EMPTY_SIMPLE)
  }

  // ---- 생성: 간단 시간목표 ----
  async function handleCreateSimple(e) {
    e.preventDefault()
    const title = simple.title.trim()
    const totalMinutes = Number(simple.hours) * 60 + Number(simple.minutes)
    if (!title) return
    if (totalMinutes <= 0) {
      await confirm({ title: '목표 시간 확인', message: '목표 시간을 0보다 크게 입력해 주세요.', confirmText: '알겠어요', cancelText: '닫기' })
      return
    }
    await createGoal({
      title,
      subjectId: simple.subjectId,
      targetType: 'minutes',
      targetMinutes: totalMinutes,
      dueDate: simple.dueDate || null,
      importance: Number(simple.importance),
    })
    closeForms()
    load()
  }

  // ---- 생성: 상세(단계형) 목표. 하위 단계 최소 1개 강제 ----
  async function handleCreateDetail(e) {
    e.preventDefault()
    const title = detail.title.trim()
    const steps = detail.steps.map((s) => s.trim()).filter(Boolean)
    if (!title) return
    if (steps.length === 0) {
      await confirm({ title: '단계 필요', message: '단계형 목표는 하위 단계를 최소 1개 입력해야 해요.', confirmText: '알겠어요', cancelText: '닫기' })
      return
    }
    const goal = await createGoal({
      title,
      description: detail.description.trim() || null,
      subjectId: detail.subjectId,
      targetType: 'steps',
      dueDate: detail.dueDate || null,
      importance: Number(detail.importance),
    })
    // 목표 생성 직후 하위 단계를 함께 만든다(규칙이 바로 동작하도록).
    for (let i = 0; i < steps.length; i++) {
      await createStep(goal.id, { title: steps[i], orderIndex: i })
    }
    closeForms()
    load()
  }

  // ---- 목표 수정 ----
  function startEdit(goal) {
    setEditingId(goal.id)
    setOpenActions(null)
    setEditForm({
      title: goal.title,
      description: goal.description || '',
      dueDate: goal.due_date || '',
      importance: goal.importance,
      targetMinutes: goal.target_minutes,
      targetType: goal.target_type,
    })
  }

  async function handleSaveEdit(goalId) {
    const title = editForm.title.trim()
    if (!title) return
    await updateGoal(goalId, {
      title,
      description: editForm.description.trim() || null,
      dueDate: editForm.dueDate || null,
      importance: Number(editForm.importance),
      ...(editForm.targetType === 'minutes'
        ? { targetMinutes: Number(editForm.targetMinutes) || 0 }
        : {}),
    })
    setEditingId(null)
    setEditForm(null)
    load()
  }

  async function handleToggleComplete(goal) {
    const ok = await confirm({
      title: goal.is_completed ? '완료 해제' : '목표 완료',
      message: goal.is_completed ? '이 목표를 다시 진행 중으로 되돌릴까요?' : '이 목표를 완료 처리할까요?',
      confirmText: goal.is_completed ? '해제' : '완료',
    })
    if (!ok) return
    await updateGoal(goal.id, { isCompleted: !goal.is_completed })
    setOpenActions(null)
    load()
  }

  async function handleDeleteGoal(goal) {
    const ok = await confirm({
      title: '목표 삭제',
      message: `"${goal.title}" 목표와 하위 단계가 모두 삭제됩니다. 계속할까요?`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteGoal(goal.id)
    setOpenActions(null)
    load()
  }

  // ---- 단계 ----
  async function handleAddStep(goal) {
    const title = (stepInputs[goal.id] || '').trim()
    if (!title) return
    await createStep(goal.id, { title, orderIndex: goal.total_steps })
    setStepInputs((prev) => ({ ...prev, [goal.id]: '' }))
    load()
  }

  async function handleToggleStep(goalId, step) {
    await updateStep(goalId, step.id, { isDone: !step.is_done })
    load()
  }

  async function handleDeleteStep(goalId, step) {
    const ok = await confirm({
      title: '단계 삭제',
      message: `"${step.title}" 단계를 삭제할까요?`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteStep(goalId, step.id)
    load()
  }

  // 상세 폼 단계 입력 헬퍼
  function setDetailStep(idx, value) {
    setDetail((prev) => {
      const steps = [...prev.steps]
      steps[idx] = value
      return { ...prev, steps }
    })
  }
  function addDetailStep() {
    setDetail((prev) => ({ ...prev, steps: [...prev.steps, ''] }))
  }
  function removeDetailStep(idx) {
    setDetail((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="goals-page">
      <div className="goals-header">
        <h2 className="goals-title">공부 목표</h2>
        <div className="goals-add-btns">
          <button
            className={`btn ${formMode === 'simple' ? 'btn-primary' : ''}`}
            onClick={() => setFormMode(formMode === 'simple' ? null : 'simple')}
          >
            + 간단 시간목표
          </button>
          <button
            className={`btn ${formMode === 'detail' ? 'btn-primary' : ''}`}
            onClick={() => setFormMode(formMode === 'detail' ? null : 'detail')}
          >
            + 상세 목표(단계)
          </button>
        </div>
      </div>

      {/* 간단 시간목표 폼 */}
      {formMode === 'simple' && (
        <form className="goal-form card" onSubmit={handleCreateSimple}>
          <p className="goal-form-hint">공부처럼 &quot;완벽한 이해&quot;를 단계로 나누기 애매할 때, 시간만 정해 간단히 만들어요.</p>
          <input
            className="field"
            placeholder="목표 제목 (예: 알고리즘 감각 유지)"
            value={simple.title}
            onChange={(e) => setSimple({ ...simple, title: e.target.value })}
          />
          <div className="goal-form-row">
            <label className="goal-form-label">과목</label>
            <SubjectTreePicker value={simple.subjectId} onChange={(id) => setSimple({ ...simple, subjectId: id })} allowEmpty />
          </div>
          <div className="goal-form-row">
            <label className="goal-form-label">목표 시간</label>
            <div className="goal-time-inputs">
              <input className="field" type="number" min="0" value={simple.hours} onChange={(e) => setSimple({ ...simple, hours: e.target.value })} />
              <span>시간</span>
              <input className="field" type="number" min="0" max="59" value={simple.minutes} onChange={(e) => setSimple({ ...simple, minutes: e.target.value })} />
              <span>분</span>
            </div>
          </div>
          <div className="goal-form-row">
            <label className="goal-form-label">마감일</label>
            <input className="field" type="date" value={simple.dueDate} onChange={(e) => setSimple({ ...simple, dueDate: e.target.value })} />
          </div>
          <div className="goal-form-row">
            <label className="goal-form-label">중요도</label>
            <select className="field" value={simple.importance} onChange={(e) => setSimple({ ...simple, importance: e.target.value })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{IMPORTANCE_LABELS[n]}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">시간목표 만들기</button>
        </form>
      )}

      {/* 상세(단계형) 목표 폼 */}
      {formMode === 'detail' && (
        <form className="goal-form card" onSubmit={handleCreateDetail}>
          <p className="goal-form-hint">자격증처럼 단계로 나눌 수 있는 목표예요. 하위 단계를 최소 1개 만들어야 합니다.</p>
          <input
            className="field"
            placeholder="목표 제목 (예: 정보처리기사 필기 합격)"
            value={detail.title}
            onChange={(e) => setDetail({ ...detail, title: e.target.value })}
          />
          <textarea className="field goal-form-desc" placeholder="설명 (선택)" value={detail.description} onChange={(e) => setDetail({ ...detail, description: e.target.value })} />
          <div className="goal-form-row">
            <label className="goal-form-label">과목</label>
            <SubjectTreePicker value={detail.subjectId} onChange={(id) => setDetail({ ...detail, subjectId: id })} allowEmpty />
          </div>
          <div className="goal-form-row">
            <label className="goal-form-label">마감일</label>
            <input className="field" type="date" value={detail.dueDate} onChange={(e) => setDetail({ ...detail, dueDate: e.target.value })} />
          </div>
          <div className="goal-form-row">
            <label className="goal-form-label">중요도</label>
            <select className="field" value={detail.importance} onChange={(e) => setDetail({ ...detail, importance: e.target.value })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{IMPORTANCE_LABELS[n]}</option>
              ))}
            </select>
          </div>

          <div className="goal-form-steps">
            <label className="goal-form-label">하위 단계 (필수)</label>
            {detail.steps.map((s, idx) => (
              <div className="goal-form-step-row" key={idx}>
                <input
                  className="field"
                  placeholder={`단계 ${idx + 1} (예: 1과목 개념 정리)`}
                  value={s}
                  onChange={(e) => setDetailStep(idx, e.target.value)}
                />
                {detail.steps.length > 1 && (
                  <button type="button" className="btn goal-step-del" onClick={() => removeDetailStep(idx)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn goal-add-step-btn" onClick={addDetailStep}>+ 단계 더 추가</button>
          </div>

          <button type="submit" className="btn btn-primary">목표 만들기</button>
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
            const isEditing = editingId === goal.id
            return (
              <li key={goal.id} className={`goal-card card ${goal.is_completed ? 'goal-completed' : ''}`}>
                {isEditing ? (
                  <div className="goal-edit">
                    <input className="field" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                    <textarea className="field goal-form-desc" placeholder="설명" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    <div className="goal-form-row">
                      <label className="goal-form-label">마감일</label>
                      <input className="field" type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
                    </div>
                    <div className="goal-form-row">
                      <label className="goal-form-label">중요도</label>
                      <select className="field" value={editForm.importance} onChange={(e) => setEditForm({ ...editForm, importance: e.target.value })}>
                        {[1, 2, 3, 4, 5].map((n) => (<option key={n} value={n}>{IMPORTANCE_LABELS[n]}</option>))}
                      </select>
                    </div>
                    {editForm.targetType === 'minutes' && (
                      <div className="goal-form-row">
                        <label className="goal-form-label">목표 시간(분)</label>
                        <input className="field" type="number" min="0" value={editForm.targetMinutes} onChange={(e) => setEditForm({ ...editForm, targetMinutes: e.target.value })} />
                      </div>
                    )}
                    <div className="goal-edit-actions">
                      <button className="btn" onClick={() => { setEditingId(null); setEditForm(null) }}>취소</button>
                      <button className="btn btn-primary" onClick={() => handleSaveEdit(goal.id)}>저장</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="goal-card-head">
                      <div>
                        <h3 className="goal-card-title">{goal.title}</h3>
                        <div className="goal-card-meta">
                          {goal.subject_path && <span className="goal-tag">{goal.subject_path}</span>}
                          <span className="goal-tag">중요도 {IMPORTANCE_LABELS[goal.importance]}</span>
                          {goal.due_date && <span className="goal-tag">~{goal.due_date}</span>}
                          {goal.target_type === 'minutes' ? (
                            <span className="goal-tag goal-tag-target">목표 {formatMinutesLabel(goal.target_minutes)}</span>
                          ) : (
                            <span className="goal-tag goal-tag-target">단계 {goal.done_steps}/{goal.total_steps}</span>
                          )}
                        </div>
                      </div>
                      {/* 액션 토글 */}
                      <div className="goal-actions-wrap">
                        <button className="goal-actions-toggle" onClick={() => setOpenActions(openActions === goal.id ? null : goal.id)}>⋯</button>
                        {openActions === goal.id && (
                          <div className="goal-actions-menu">
                            <button onClick={() => startEdit(goal)}>수정</button>
                            <button onClick={() => handleToggleComplete(goal)}>{goal.is_completed ? '완료 해제' : '완료 처리'}</button>
                            <button className="goal-actions-danger" onClick={() => handleDeleteGoal(goal)}>삭제</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {goal.description && <p className="goal-card-desc">{goal.description}</p>}

                    <ProgressBar
                      percent={percent}
                      done={goal.target_type === 'steps' ? goal.done_steps : undefined}
                      total={goal.target_type === 'steps' ? goal.total_steps : undefined}
                      label={goal.target_type === 'minutes' ? `목표 시간 ${formatMinutesLabel(goal.target_minutes)} 중 달성` : '로드맵 진행'}
                    />

                    {/* 단계형만 로드맵 표시 */}
                    {goal.target_type === 'steps' && (
                      <div className="goal-steps">
                        <ul className="goal-step-list">
                          {goal.steps.map((step) => (
                            <li key={step.id} className={`goal-step ${step.is_done ? 'goal-step-done' : ''}`}>
                              <label className="goal-step-check">
                                <input type="checkbox" checked={step.is_done} onChange={() => handleToggleStep(goal.id, step)} />
                                <span>{step.title}</span>
                              </label>
                              <button className="btn goal-step-del" onClick={() => handleDeleteStep(goal.id, step)}>✕</button>
                            </li>
                          ))}
                        </ul>
                        <div className="goal-step-add">
                          <input
                            className="field"
                            placeholder="단계 추가"
                            value={stepInputs[goal.id] || ''}
                            onChange={(e) => setStepInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(goal) } }}
                          />
                          <button className="btn btn-primary" onClick={() => handleAddStep(goal)}>추가</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
