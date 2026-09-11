// 시간·날짜 관련 유틸 함수 모음.

// 초를 "1시간 23분 45초" 형태로 변환한다.
export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts = []
  if (h > 0) parts.push(`${h}시간`)
  if (m > 0) parts.push(`${m}분`)
  parts.push(`${s}초`)
  return parts.join(' ')
}

// 초를 "01:23:45" 형태(타이머 표시용)로 변환한다.
export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// Date 객체를 'YYYY-MM-DD' 로컬 날짜 문자열로 변환한다.
export function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 특정 연/월의 달력 그리드(6주 x 7일)를 만든다. 각 칸은 Date.
export function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay() // 0=일요일
  const gridStart = new Date(year, month, 1 - startOffset)

  const days = []
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  }
  return days
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
