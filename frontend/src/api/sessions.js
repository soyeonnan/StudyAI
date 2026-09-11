import { apiClient } from './client'

export async function fetchSessions({ start, end } = {}) {
  const params = {}
  if (start) params.start = start
  if (end) params.end = end
  const { data } = await apiClient.get('/sessions', { params })
  return data
}

export async function createSession(payload) {
  // payload: { subject_id, started_at, ended_at, study_seconds, break_seconds, focus_level, memo }
  const { data } = await apiClient.post('/sessions', payload)
  return data
}

export async function updateSession(sessionId, patch) {
  // patch 예: { focus_level, memo, study_seconds, break_seconds, subject_id }
  const { data } = await apiClient.patch(`/sessions/${sessionId}`, patch)
  return data
}

export async function deleteSession(sessionId) {
  await apiClient.delete(`/sessions/${sessionId}`)
}
