import { useMemo, useState } from 'react'

import { toDateString } from './time'

// 현재 보고 있는 연/월과 이동 함수, 그리고 월 범위(start/end)를 제공한다.
export function useMonthNavigation() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  function prevMonth() {
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }

  function nextMonth() {
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  function goToday() {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const range = useMemo(() => {
    const start = toDateString(new Date(year, month, 1))
    const end = toDateString(new Date(year, month + 1, 0))
    return { start, end }
  }, [year, month])

  return { year, month, setYear, setMonth, prevMonth, nextMonth, goToday, range }
}
