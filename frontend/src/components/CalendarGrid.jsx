import { buildMonthGrid, toDateString, WEEKDAY_LABELS } from '../lib/time'
import './CalendarGrid.css'

/**
 * 월간 캘린더 그리드.
 * - year, month: 표시할 연/월 (month는 0부터)
 * - selectedDate: 선택된 날짜 문자열('YYYY-MM-DD')
 * - onSelectDate: 날짜 클릭 콜백
 * - renderBadge: (dateStr) => ReactNode. 각 날짜 칸에 표시할 배지(옵션)
 */
export default function CalendarGrid({ year, month, selectedDate, onSelectDate, renderBadge }) {
  const days = buildMonthGrid(year, month)
  const today = toDateString(new Date())

  return (
    <div className="calendar-grid">
      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div key={label} className={`weekday ${idx === 0 ? 'weekday-sun' : ''} ${idx === 6 ? 'weekday-sat' : ''}`}>
            {label}
          </div>
        ))}
      </div>
      <div className="calendar-days">
        {days.map((day) => {
          const dateStr = toDateString(day)
          const isCurrentMonth = day.getMonth() === month
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate
          return (
            <button
              key={dateStr}
              type="button"
              className={[
                'calendar-day',
                isCurrentMonth ? '' : 'calendar-day-muted',
                isToday ? 'calendar-day-today' : '',
                isSelected ? 'calendar-day-selected' : '',
              ].join(' ')}
              onClick={() => onSelectDate(dateStr)}
            >
              <span className="calendar-day-num">{day.getDate()}</span>
              {renderBadge && <span className="calendar-day-badge">{renderBadge(dateStr)}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
