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

// 일정 색상 팔레트
const SCHEDULE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

export default function SchedulePage() {
  const nav = useMonthNavigation()
  const { year, month, range, goToMonthOf } = nav
  const confirm = useConfirm()

  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [activeTab, setActiveTab] = useState('single') // 'single'(개별) | 'routine'(루틴)

  const [items, setItems] = useState([]) // 개별 일정(월 범위)
  const [routines, setRoutines] = useState([]) // 선택 날짜의 루틴

  const [newTitle, setNewTitle] = useState('')
  const [newColor, setNewColor] = useState(SCHEDULE_COLORS[0])
  const [newRoutineTitle, setNewRoutineTitle] = useState('')

  // 날짜 선택: 다른 달 칸을 누르면 그 달로 이동한다.
  function handleSelectDate(dateStr) {
    setSelectedDate(dateStr)
    const clickedMonth = Number(dateStr.split('-')[1]) - 1
    if (clickedMonth !== month) goToMonthOf(dateStr)
  }

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

  // ---- 선택 날짜 데이터 ----
  const itemsForSelected = items.filter((it) => it.scheduled_date === selectedDate)
  const scheduleDone = itemsForSelected.filter((it) => it.is_done).length
  const routineDone = routines.filter((r) => r.is_done).length
  const routineTotal = routines.length

  // 개별 일정 + 루틴을 합친 통합 완료율
  const totalCount = itemsForSelected.length + routineTotal
  const totalDone = scheduleDone + routineDone
  const totalPercent = toPercent(totalDone, totalCount)

  // ---- 개별 일정 ----
  async function handleAdd(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    await createSchedule({ title, scheduledDate: selectedDate, color: newColor })
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

  // 날짜 칸 배지: 그날 일정 개수만큼 색상 점을 찍는다(완료된 건 흐리게).
  function renderBadge(dateStr) {
    const dayItems = items.filter((it) => it.scheduled_date === dateStr)
    if (dayItems.length === 0) return null
    // 최대 4개까지 점으로, 그 이상은 +N
    const shown = dayItems.slice(0, 4)
    const extra = dayItems.length - shown.length
    return (
      <>
        {shown.map((it) => (
          <span
            key={it.id}
            className={`badge-dot ${it.is_done ? 'badge-dot-faded' : ''}`}
            style={{ background: it.color }}
            title={`${it.title}${it.is_done ? ' (완료)' : ''}`}
          />
        ))}
        {extra > 0 && <span className="badge-more">+{extra}</span>}
      </>
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
          onSelectDate={handleSelectDate}
          renderBadge={renderBadge}
        />
        <div className="calendar-legend">
          <span>일정마다 지정한 색으로 표시돼요. 완료한 일정은 흐리게 보여요.</span>
        </div>
      </div>

      <div className="calendar-side card">
        <h3 className="side-title">{selectedDate}</h3>

        {/* 개별 + 루틴 통합 완료율 */}
        {totalCount > 0 && (
          <div className="schedule-progress-bar">
            <ProgressBar
              percent={totalPercent}
              done={totalDone}
              total={totalCount}
              label="오늘 완료 (일정+루틴)"
            />
          </div>
        )}

        {/* 개별 일정 / 루틴 탭 */}
        <div className="study-tabs">
          <button
            className={`study-tab ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            개별 일정 {itemsForSelected.length > 0 && `(${scheduleDone}/${itemsForSelected.length})`}
          </button>
          <button
            className={`study-tab ${activeTab === 'routine' ? 'active' : ''}`}
            onClick={() => setActiveTab('routine')}
          >
            루틴 {routineTotal > 0 && `(${routineDone}/${routineTotal})`}
          </button>
        </div>

        {/* 개별 일정 탭 */}
        {activeTab === 'single' && (
          <div className="study-section">
            <form className="schedule-add-form" onSubmit={handleAdd}>
              <div className="side-add">
                <input
                  className="field"
                  placeholder="이 날의 일정 (예: 병원 예약)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">추가</button>
              </div>
              {/* 색상 선택 */}
              <div className="color-picker">
                {SCHEDULE_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`color-swatch ${newColor === c ? 'color-swatch-active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewColor(c)}
                    title="일정 색상"
                  />
                ))}
              </div>
            </form>

            <ul className="todo-list">
              {itemsForSelected.length === 0 && <li className="todo-empty">이 날의 개별 일정이 없어요.</li>}
              {itemsForSelected.map((item) => (
                <li key={item.id} className={`todo-item ${item.is_done ? 'todo-done' : ''}`}>
                  <label className="todo-check">
                    <input type="checkbox" checked={item.is_done} onChange={() => handleToggle(item)} />
                    <span className="schedule-color-tag" style={{ background: item.color }} />
                    <span className="todo-title">{item.title}</span>
                  </label>
                  <button className="btn btn-danger" onClick={() => handleDelete(item)}>삭제</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 루틴 탭 */}
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
