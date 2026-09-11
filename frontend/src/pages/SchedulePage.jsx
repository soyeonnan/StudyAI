import { useCallback, useEffect, useState } from 'react'

import CalendarGrid from '../components/CalendarGrid'
import CalendarHeader from '../components/CalendarHeader'
import ProgressBar from '../components/ProgressBar'
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  updateSchedule,
} from '../api/schedules'
import { toPercent } from '../lib/progress'
import { toDateString } from '../lib/time'
import { useMonthNavigation } from '../lib/useMonthNavigation'
import './CalendarPage.css'

export default function SchedulePage() {
  const nav = useMonthNavigation()
  const { year, month, range } = nav
  const [items, setItems] = useState([])
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [newTitle, setNewTitle] = useState('')

  const loadItems = useCallback(async () => {
    const data = await fetchSchedules({ start: range.start, end: range.end })
    setItems(data)
  }, [range.start, range.end])

  useEffect(() => {
    loadItems()
  }, [loadItems])

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

  async function handleDelete(itemId) {
    await deleteSchedule(itemId)
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  // 날짜 칸에 일정 개수를 점으로 표시한다.
  function renderBadge(dateStr) {
    const count = items.filter((it) => it.scheduled_date === dateStr).length
    if (count === 0) return null
    return <span className="badge-dot badge-dot-schedule" title={`일정 ${count}개`} />
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
        <h3 className="side-title">{selectedDate} 일정</h3>

        <form className="side-add" onSubmit={handleAdd}>
          <input
            className="field"
            placeholder="일정을 입력하세요"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">추가</button>
        </form>

        {itemsForSelected.length > 0 && (
          <div className="schedule-progress-bar">
            <ProgressBar
              percent={donePercent}
              done={doneCount}
              total={itemsForSelected.length}
              label="완료한 일정"
            />
          </div>
        )}

        <ul className="todo-list">
          {itemsForSelected.length === 0 && <li className="todo-empty">등록된 일정이 없어요.</li>}
          {itemsForSelected.map((item) => (
            <li key={item.id} className={`todo-item ${item.is_done ? 'todo-done' : ''}`}>
              <label className="todo-check">
                <input
                  type="checkbox"
                  checked={item.is_done}
                  onChange={() => handleToggle(item)}
                />
                <span className="todo-title">{item.title}</span>
              </label>
              <button className="btn btn-danger" onClick={() => handleDelete(item.id)}>삭제</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
