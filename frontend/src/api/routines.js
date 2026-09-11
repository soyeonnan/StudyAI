import { apiClient } from './client'

// 현재 유효한 루틴 목록 (각 항목은 definition_id + 현재 버전 정보)
export async function fetchRoutines() {
  const { data } = await apiClient.get('/routines')
  return data
}

// 특정 날짜에 유효했던 루틴 + 완료 여부 (버전 관리 반영)
export async function fetchRoutinesForDate(targetDate) {
  const { data } = await apiClient.get(`/routines/on/${targetDate}`)
  return data
}

// 루틴의 전체 버전 이력 (변경 추적용)
export async function fetchRoutineHistory(definitionId) {
  const { data } = await apiClient.get(`/routines/${definitionId}/history`)
  return data
}

// 루틴 생성. effectiveFrom 미지정 시 오늘부터 유효.
export async function createRoutine({ title, weekdayMask = 127, subjectId = null, effectiveFrom = null }) {
  const { data } = await apiClient.post('/routines', {
    title,
    weekday_mask: weekdayMask,
    subject_id: subjectId,
    effective_from: effectiveFrom,
  })
  return data
}

// 루틴 수정. 지정일(기본 오늘)부터 새 버전이 적용되고 과거는 보존된다.
export async function updateRoutine(definitionId, { title, weekdayMask, subjectId, effectiveFrom } = {}) {
  const payload = {}
  if (title !== undefined) payload.title = title
  if (weekdayMask !== undefined) payload.weekday_mask = weekdayMask
  if (subjectId !== undefined) payload.subject_id = subjectId
  if (effectiveFrom !== undefined) payload.effective_from = effectiveFrom
  const { data } = await apiClient.patch(`/routines/${definitionId}`, payload)
  return data
}

export async function deleteRoutine(definitionId) {
  await apiClient.delete(`/routines/${definitionId}`)
}

export async function toggleRoutine(definitionId, { completedDate, done }) {
  await apiClient.post(`/routines/${definitionId}/toggle`, {
    completed_date: completedDate,
    done,
  })
}
