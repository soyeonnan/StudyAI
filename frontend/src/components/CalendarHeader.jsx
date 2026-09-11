import './CalendarHeader.css'

const MONTH_LABELS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]

/**
 * 캘린더 상단 네비게이션: 연도 드롭다운 + 월 선택 + 이전/다음 + 오늘.
 * 일정 캘린더와 공부 캘린더에서 공용으로 사용한다.
 *
 * props: year, month, setYear, setMonth, prevMonth, nextMonth, goToday
 */
export default function CalendarHeader({ year, month, setYear, setMonth, prevMonth, nextMonth, goToday }) {
  // 현재 연도 기준 앞뒤 몇 년을 드롭다운에 제공한다.
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear - 5; y <= currentYear + 5; y += 1) {
    years.push(y)
  }

  return (
    <div className="calendar-nav">
      <button className="btn calendar-nav-arrow" onClick={prevMonth} aria-label="이전 달">‹</button>

      <div className="calendar-nav-selects">
        <select
          className="field calendar-nav-select"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select
          className="field calendar-nav-select"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_LABELS.map((label, idx) => (
            <option key={idx} value={idx}>{label}</option>
          ))}
        </select>
      </div>

      <button className="btn calendar-nav-arrow" onClick={nextMonth} aria-label="다음 달">›</button>
      <button className="btn calendar-nav-today" onClick={goToday}>오늘</button>
    </div>
  )
}
