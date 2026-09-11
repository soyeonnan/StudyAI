import { useCallback, useEffect, useState } from 'react'

import CalendarGrid from '../components/CalendarGrid'
import CalendarHeader from '../components/CalendarHeader'
import { createSession, deleteSession, fetchSessions, updateSession } from '../api/sessions'
import { fetchSubjects } from '../api/subjects'
import {
  createRoutine,
  deleteRoutine,
  fetchRoutinesForDate,
  toggleRoutine,
} from '../api/routines'
import ProgressBar from '../components/ProgressBar'
import StudyRecordForm from '../features/study/StudyRecordForm'
import SubjectSelect from '../features/subjects/SubjectSelect'
import { toPercent } from '../lib/progress'
import { formatDuration, toDateString } from '../lib/time'
import { useMonthNavigation } from '../lib/useMonthNavigation'
import './CalendarPage.css'

const FOCUS_LABELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음']

export default function StudyPage() {
  const nav = useMonthNavigation()
  const { year, month, range } = nav
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [activeTab, setActiveTab] = useState('routine') // 'routine' | 'record'

  const [sessions, setSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [routines, setRoutines] = useState([])

  // 루틴 추가 입력
  const [newRoutineTitle, setNewRoutineTitle] = useState('')
  const [newRoutineSubject, setNewRoutineSubject] = useState(null)

  // 기록 추가/편집 상태
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState(null)

  const loadMonth = useCallback(async () => {
    const [sessionData, subjectData] = await Promise.all([
      fetchSessions({ start: range.start, end: range.end }),
      fetchSubjects(),
    ])
    setSessions(sessionData)
    setSubjects(subjectData)
  }, [range.start, range.end])

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
  }

  async function handleDeleteRoutine(definitionId) {
    await deleteRoutine(definitionId)
    loadRoutines()
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
    await deleteSession(recordId)
    loadMonth()
  }

  // 날짜 칸 배지: 공부 기록(초록) + 루틴 완료(보라) 표시
  function renderBadge(dateStr) {
    const hasRecord = sessions.some((s) => toDateString(new Date(s.started_at)) === dateStr)
    if (!hasRecord) return null
    return <span className="badge-dot badge-dot-record" title="공부 기록 있음" />
  }

  return (
    <div className="calendar-page">
      <div className="calendar-panel card">
        <CalendarHeader {...nav} />
        <CalendarGrid
          year={year}
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
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
              <SubjectSelect value={newRoutineSubject} onChange={setNewRoutineSubject} allowEmpty />
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
                      {routine.subject_name && (
                        <span className="routine-subject">· {routine.subject_name}</span>
                      )}
                    </span>
                  </label>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteRoutine(routine.definition_id)}
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
                        {subjectMap[record.subject_id]?.name || '과목'}
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
