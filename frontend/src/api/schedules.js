import { apiClient } from './client'

export async function fetchSchedules({ start, end } = {}) {
  const params = {}
  if (start) params.start = start
  if (end) params.end = end
  const { data } = await apiClient.get('/schedules', { params })
  return data
}

export async function createSchedule({ title, description, scheduledDate }) {
  const { data } = await apiClient.post('/schedules', {
    title,
    description,
    scheduled_date: scheduledDate,
  })
  return data
}

export async function updateSchedule(itemId, patch) {
  // patch 예: { is_done: true } 또는 { title, description, scheduled_date }
  const { data } = await apiClient.patch(`/schedules/${itemId}`, patch)
  return data
}

export async function deleteSchedule(itemId) {
  await apiClient.delete(`/schedules/${itemId}`)
}
