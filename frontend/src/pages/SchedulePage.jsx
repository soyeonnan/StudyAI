import { useCallback, useEffect, useState } from 'react'

import CalendarGrid from '../components/CalendarGrid'
import CalendarHeader from '../components/CalendarHeader'
import ProgressBar from '../components/ProgressBar'
import { useConfirm } from '../components/ConfirmProvider'
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  updateSchedule,
} from '../api/schedules'
import {
  createRoutine,
  deleteRoutine,
  fetchRoutinesForDate,
  toggleRoutine,
} from '../api/routines'
import { toPercent } from '../lib/progress'
import { toDateString } from '../lib/time'
import { useMonthNavigation } from '../lib/useMonthNavigation'
import './CalendarPage.css'

export default function SchedulePage() {
  const nav = useMonthNavigation()
  const { year, month, range } = nav
  const confirm = useConfirm()

  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [activeTab, setActiveTab] = useState('single') // 'single'(개별) | 'routine'(루틴)

  const [items, setItems] = useState([]) // 개별 일정(월 범위)
  const [routines, setRoutines] = useState([]) // 선택 날짜의 루틴

  const [newTitle, setNewTitle] = useState('')
  const [newRoutineTitle, setNewRoutineTitle] = useState('')

  const loadItems = useCallback(async () => {
    const data = await fetchSchedules({ start: range.start, end: range.end })
    setItems(data)
  }, [range.start, range.end])

  const loadRoutines = useCallback(async () => {
    const data = await fetchRoutinesForDate(selectedDate)
    setRoutines(data)
  }, [selectedDate])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    loadRoutines()
  }, [loadRoutines])

  // ---- 개별 일정 ----
  const itemsForSelected = items.filter((it) => it.scheduled_date === selectedDate)
  const doneCount = itemsForSelected.filter((it) => it.is_done).length
  const donePercent = toPercent(doneCount, itemsForSelected.length)

  async function handleAdd(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    await createSchedule({ title, scheduledDate: selectedDate })
    setNewTitle('')
    loadItems()
  }

  async function handleToggle(item) {
    await updateSchedule(item.id, { is_done: !item.is_done })
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, is_done: !it.is_done } : it)))
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: '일정 삭제',
      message: `"${item.title}" 일정을 삭제할까요?`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteSchedule(item.id)
    setItems((prev) => prev.filter((it) => it.id !== item.id))
  }

  // ---- 루틴 (반복되어 다른 날에도 따라옴) ----
  const routineDone = routines.filter((r) => r.is_done).length
  const routineTotal = routines.length
  const routinePercent = toPercent(routineDone, routineTotal)

  async function handleAddRoutine(e) {
    e.preventDefault()
    const title = newRoutineTitle.trim()
    if (!title) return
    await createRoutine({ title, weekdayMask: 127 })
    setNewRoutineTitle('')
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

  async function handleDeleteRoutine(routine) {
    const ok = await confirm({
      title: '루틴 삭제',
      message: `"${routine.title}" 루틴을 삭제할까요? 오늘부터 더 이상 나타나지 않지만 지난 기록은 보존됩니다.`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteRoutine(routine.definition_id)
    loadRoutines()
  }

  // 날짜 칸 배지: 개별 일정 유무 + 모두 완료 여부로 색상 구분
  function renderBadge(dateStr) {
    const dayItems = items.filter((it) => it.scheduled_date === dateStr)
    if (dayItems.length === 0) return null
    const allDone = dayItems.every((it) => it.is_done)
    // 모두 완료면 초록, 아니면 파랑 점
    return (
      <span
        className={`badge-dot ${allDone ? 'badge-dot-done' : 'badge-dot-schedule'}`}
        title={allDone ? `일정 ${dayItems.length}개 모두 완료` : `일정 ${dayItems.length}개`}
      />
    )
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
        <div className="calendar-legend">
          <span><span className="badge-dot badge-dot-schedule" /> 진행 중</span>
          <span><span className="badge-dot badge-dot-done" /> 모두 완료</span>
        </div>
      </div>

      <div className="calendar-side card">
        <h3 className="side-title">{selectedDate}</h3>

        {/* 개별 일정 / 루틴 탭 */}
        <div className="study-tabs">
          <button
            className={`study-tab ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            개별 일정
          </button>
          <button
            className={`study-tab ${activeTab === 'routine' ? 'active' : ''}`}
            onClick={() => setActiveTab('routine')}
          >
            루틴
          </button>
        </div>

        {/* 개별 일정 탭: 그날 하루만의 일정 */}
        {activeTab === 'single' && (
          <div className="study-section">
            <form className="side-add" onSubmit={handleAdd}>
              <input
                className="field"
                placeholder="이 날의 일정 (예: 병원 예약)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">추가</button>
            </form>

            {itemsForSelected.length > 0 && (
              <div className="schedule-progress-bar">
                <ProgressBar percent={donePercent} done={doneCount} total={itemsForSelected.length} label="완료한 일정" />
              </div>
            )}

            <ul className="todo-list">
              {itemsForSelected.length === 0 && <li className="todo-empty">이 날의 개별 일정이 없어요.</li>}
              {itemsForSelected.map((item) => (
                <li key={item.id} className={`todo-item ${item.is_done ? 'todo-done' : ''}`}>
                  <label className="todo-check">
                    <input type="checkbox" checked={item.is_done} onChange={() => handleToggle(item)} />
                    <span className="todo-title">{item.title}</span>
                  </label>
                  <button className="btn btn-danger" onClick={() => handleDelete(item)}>삭제</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 루틴 탭: 만들어두면 다른 날에도 반복되어 따라옴 */}
        {activeTab === 'routine' && (
          <div className="study-section">
            <p className="routine-hint">
              루틴은 한 번 만들면 매일 따라오는 반복 할 일이에요. (예: 아침 / 점심 / 저녁)
            </p>
            <form className="side-add" onSubmit={handleAddRoutine}>
              <input
                className="field"
                placeholder="반복할 루틴 (예: 아침 스트레칭)"
                value={newRoutineTitle}
                onChange={(e) => setNewRoutineTitle(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">루틴 추가</button>
            </form>

            {routineTotal > 0 && (
              <div className="routine-progress-bar">
                <ProgressBar percent={routinePercent} done={routineDone} total={routineTotal} label="이 날의 루틴" />
              </div>
            )}

            <ul className="todo-list">
              {routines.length === 0 && <li className="todo-empty">이 날짜에 예정된 루틴이 없어요.</li>}
              {routines.map((routine) => (
                <li key={routine.definition_id} className={`routine-item ${routine.is_done ? 'routine-done' : ''}`}>
                  <label className="todo-check">
                    <input type="checkbox" checked={routine.is_done} onChange={() => handleToggleRoutine(routine)} />
                    <span className="todo-title">
                      {routine.title}
                      {routine.subject_path && <span className="routine-subject">· {routine.subject_path}</span>}
                    </span>
                  </label>
                  <button className="btn btn-danger" onClick={() => handleDeleteRoutine(routine)}>삭제</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
