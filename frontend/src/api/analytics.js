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

// 달성률 확장: 최근 N주 추이 + 목표 달성 요약
export async function fetchAchievementStats({ date = null, weeks = 8 } = {}) {
  const params = { weeks }
  if (date) params.date = date
  const { data } = await apiClient.get('/stats/achievement', { params })
  return data
}
