import { useCallback, useEffect, useState } from 'react'

import CalendarGrid from '../components/CalendarGrid'
import CalendarHeader from '../components/CalendarHeader'
import { useConfirm } from '../components/ConfirmProvider'
import { createSession, deleteSession, fetchSessions, updateSession } from '../api/sessions'
import { fetchSubjects } from '../api/subjects'
import {
  createRoutine,
  deleteRoutine,
  fetchRoutineMonthSummary,
  fetchRoutinesForDate,
  toggleRoutine,
} from '../api/routines'
import ProgressBar from '../components/ProgressBar'
import StudyRecordForm from '../features/study/StudyRecordForm'
import SubjectTreePicker from '../features/subjects/SubjectTreePicker'
import { progressColor, toPercent } from '../lib/progress'
import { formatDuration, toDateString } from '../lib/time'
import { useMonthNavigation } from '../lib/useMonthNavigation'
import './CalendarPage.css'

const FOCUS_LABELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음']

export default function StudyPage() {
  const nav = useMonthNavigation()
  const { year, month, range, goToMonthOf } = nav
  const confirm = useConfirm()
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))

  // 날짜 선택: 다른 달 칸을 누르면 그 달로 이동한다.
  function handleSelectDate(dateStr) {
    setSelectedDate(dateStr)
    const clickedMonth = Number(dateStr.split('-')[1]) - 1
    if (clickedMonth !== month) goToMonthOf(dateStr)
  }
  const [activeTab, setActiveTab] = useState('routine') // 'routine' | 'record'

  const [sessions, setSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [routines, setRoutines] = useState([])
  // 날짜별 루틴 진행 요약 { 'YYYY-MM-DD': { done, total, todo } }
  const [routineSummary, setRoutineSummary] = useState({})

  // 루틴 추가 입력
  const [newRoutineTitle, setNewRoutineTitle] = useState('')
  const [newRoutineSubject, setNewRoutineSubject] = useState(null)

  // 기록 추가/편집 상태
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState(null)

  const loadMonth = useCallback(async () => {
    const [sessionData, subjectData, summaryData] = await Promise.all([
      fetchSessions({ start: range.start, end: range.end }),
      fetchSubjects(),
      fetchRoutineMonthSummary(year, month + 1), // month는 0-based → +1
    ])
    setSessions(sessionData)
    setSubjects(subjectData)
    setRoutineSummary(Object.fromEntries(summaryData.map((s) => [s.date, s])))
  }, [range.start, range.end, year, month])

  const loadRoutines = useCallback(async () => {
    const data = await fetchRoutinesForDate(selectedDate)
    setRoutines(data)
  }, [selectedDate])

  useEffect(() => {
    loadMonth()
  }, [loadMonth])

  useEffect(() => {
    loadRoutines()
    setShowRecordForm(false)
    setEditingRecordId(null)
  }, [loadRoutines])

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]))
  const recordsForSelected = sessions.filter(
    (s) => toDateString(new Date(s.started_at)) === selectedDate,
  )

  // 진행률: 그 날짜 루틴 중 완료 비율
  const routineDone = routines.filter((r) => r.is_done).length
  const routineTotal = routines.length
  const routinePercent = toPercent(routineDone, routineTotal)

  // ---- 루틴 ----
  async function handleAddRoutine(e) {
    e.preventDefault()
    const title = newRoutineTitle.trim()
    if (!title) return
    await createRoutine({ title, weekdayMask: 127, subjectId: newRoutineSubject })
    setNewRoutineTitle('')
    setNewRoutineSubject(null)
    loadRoutines()
    loadMonth() // 달력 요약 갱신
  }

  async function handleToggleRoutine(routine) {
    await toggleRoutine(routine.definition_id, {
      completedDate: selectedDate,
      done: !routine.is_done,
    })
    setRoutines((prev) =>
      prev.map((r) =>
        r.definition_id === routine.definition_id ? { ...r, is_done: !r.is_done } : r,
      ),
    )
    loadMonth() // 달력 요약 갱신
  }

  async function handleDeleteRoutine(routine) {
    const ok = await confirm({
      title: '루틴 삭제',
      message: `"${routine.title}" 루틴을 삭제할까요? 오늘부터 나타나지 않지만 지난 기록은 보존됩니다.`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteRoutine(routine.definition_id)
    loadRoutines()
    loadMonth() // 달력 요약 갱신
  }

  // ---- 공부 기록 ----
  function buildTimes(dateStr) {
    // 수동 기록의 시작/종료 시각은 해당 날짜 정오 기준으로 둔다 (날짜 집계용).
    const start = new Date(`${dateStr}T12:00:00`)
    return start
  }

  async function handleCreateRecord({ subjectId, studySeconds, breakSeconds, focusLevel, memo }) {
    const start = buildTimes(selectedDate)
    const end = new Date(start.getTime() + studySeconds * 1000)
    await createSession({
      subject_id: subjectId,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      study_seconds: studySeconds,
      break_seconds: breakSeconds,
      focus_level: focusLevel,
      memo: memo || null,
    })
    setShowRecordForm(false)
    loadMonth()
  }

  async function handleUpdateRecord(recordId, { subjectId, studySeconds, breakSeconds, focusLevel, memo }) {
    await updateSession(recordId, {
      subject_id: subjectId,
      study_seconds: studySeconds,
      break_seconds: breakSeconds,
      focus_level: focusLevel,
      memo: memo || null,
    })
    setEditingRecordId(null)
    loadMonth()
  }

  async function handleDeleteRecord(recordId) {
    const ok = await confirm({
      title: '기록 삭제',
      message: '이 공부 기록을 삭제할까요?',
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteSession(recordId)
    loadMonth()
  }

  // 날짜 칸 배지: 루틴 진행 단계를 완료율 색상 막대로, 공부 기록은 초록 점으로 표시.
  function renderBadge(dateStr) {
    const hasRecord = sessions.some((s) => toDateString(new Date(s.started_at)) === dateStr)
    const summary = routineSummary[dateStr]

    const parts = []

    if (summary && summary.total > 0) {
      const percent = toPercent(summary.done, summary.total)
      const color = progressColor(percent)
      parts.push(
        <span
          key="routine"
          className="routine-progress-mini"
          title={`루틴 ${summary.done}/${summary.total}${summary.todo?.length ? ` · 할 일: ${summary.todo.join(', ')}` : ''}`}
        >
          <span className="routine-progress-mini-fill" style={{ width: `${percent}%`, background: color }} />
        </span>,
      )
    }
    if (hasRecord) {
      parts.push(<span key="record" className="badge-dot badge-dot-record" title="공부 기록 있음" />)
    }

    return parts.length > 0 ? <>{parts}</> : null
  }

  return (
    <div className="calendar-page">
      <div className="calendar-panel card">
        <CalendarHeader {...nav} />
        <CalendarGrid
          year={year}
          month={month}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          renderBadge={renderBadge}
        />
      </div>

      <div className="calendar-side card">
        <h3 className="side-title">{selectedDate}</h3>

        {/* 탭 전환 */}
        <div className="study-tabs">
          <button
            className={`study-tab ${activeTab === 'routine' ? 'active' : ''}`}
            onClick={() => setActiveTab('routine')}
          >
            공부 루틴
          </button>
          <button
            className={`study-tab ${activeTab === 'record' ? 'active' : ''}`}
            onClick={() => setActiveTab('record')}
          >
            공부 기록
          </button>
        </div>

        {/* 루틴 탭 */}
        {activeTab === 'routine' && (
          <div className="study-section">
            {routineTotal > 0 && (
              <div className="routine-progress-bar">
                <ProgressBar
                  percent={routinePercent}
                  done={routineDone}
                  total={routineTotal}
                  label="이 날의 루틴"
                />
              </div>
            )}

            <form className="routine-add" onSubmit={handleAddRoutine}>
              <input
                className="field"
                placeholder="반복할 루틴 (예: 영어 단어 30개)"
                value={newRoutineTitle}
                onChange={(e) => setNewRoutineTitle(e.target.value)}
              />
              <SubjectTreePicker value={newRoutineSubject} onChange={setNewRoutineSubject} allowEmpty />
              <button type="submit" className="btn btn-primary">루틴 추가</button>
            </form>

            <ul className="todo-list">
              {routines.length === 0 && <li className="todo-empty">이 날짜에 예정된 루틴이 없어요.</li>}
              {routines.map((routine) => (
                <li
                  key={routine.definition_id}
                  className={`routine-item ${routine.is_done ? 'routine-done' : ''}`}
                >
                  <label className="todo-check">
                    <input
                      type="checkbox"
                      checked={routine.is_done}
                      onChange={() => handleToggleRoutine(routine)}
                    />
                    <span className="todo-title">
                      {routine.title}
                      {routine.subject_path && (
                        <span className="routine-subject">· {routine.subject_path}</span>
                      )}
                    </span>
                  </label>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteRoutine(routine)}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 기록 탭 */}
        {activeTab === 'record' && (
          <div className="study-section">
            <ul className="todo-list">
              {recordsForSelected.length === 0 && !showRecordForm && (
                <li className="todo-empty">이 날의 공부 기록이 없어요.</li>
              )}
              {recordsForSelected.map((record) =>
                editingRecordId === record.id ? (
                  <li key={record.id}>
                    <StudyRecordForm
                      mode="edit"
                      initial={{
                        subject_id: record.subject_id,
                        study_minutes: Math.round(record.study_seconds / 60),
                        break_minutes: Math.round(record.break_seconds / 60),
                        focus_level: record.focus_level,
                        memo: record.memo || '',
                      }}
                      onSubmit={(payload) => handleUpdateRecord(record.id, payload)}
                      onCancel={() => setEditingRecordId(null)}
                    />
                  </li>
                ) : (
                  <li key={record.id} className="record-item">
                    <div className="record-head">
                      <span className="record-subject">
                        {record.subject_path || subjectMap[record.subject_id]?.name || '과목'}
                      </span>
                      <span className="record-focus">
                        집중도: {FOCUS_LABELS[record.focus_level - 1]}
                      </span>
                    </div>
                    <div className="record-times">
                      공부 {formatDuration(record.study_seconds)} · 휴식{' '}
                      {formatDuration(record.break_seconds)}
                    </div>
                    {record.memo && <div className="record-memo">{record.memo}</div>}
                    <div className="record-actions">
                      <button className="btn record-mini" onClick={() => setEditingRecordId(record.id)}>
                        수정
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDeleteRecord(record.id)}>
                        삭제
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>

            {showRecordForm ? (
              <StudyRecordForm
                mode="create"
                date={selectedDate}
                onSubmit={handleCreateRecord}
                onCancel={() => setShowRecordForm(false)}
              />
            ) : (
              <button className="btn btn-primary record-add-btn" onClick={() => setShowRecordForm(true)}>
                + 기록 직접 추가
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
