import { apiClient } from './client'

// 특정 날짜(오늘) 요약 통계
export async function fetchDailyStats(dateStr) {
  const { data } = await apiClient.get('/stats/daily', { params: { date: dateStr } })
  return data
}

// 특정 월 요약 + 그래프 데이터
export async function fetchMonthlyStats(year, month) {
  const { data } = await apiClient.get('/stats/monthly', { params: { year, month } })
  return data
}
