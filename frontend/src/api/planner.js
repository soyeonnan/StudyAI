import { apiClient } from './client'

// 오늘 할 일 자동 추천 + 목표별 하루 권장량(재조정).
// availableMinutes: 오늘 가용 시간(분), targetDate: 기준 날짜(미지정 시 오늘)
export async function fetchTodayPlan({ availableMinutes = 120, targetDate = null, includeSubjects = true } = {}) {
  const params = { available_minutes: availableMinutes, include_subjects: includeSubjects }
  if (targetDate) params.target_date = targetDate
  const { data } = await apiClient.get('/planner/today', { params })
  return data
}
