import { apiClient } from './client'

// 내 공부 목표 목록 (각 항목은 진도/단계 정보 포함)
export async function fetchGoals() {
  const { data } = await apiClient.get('/goals')
  return data
}

// 목표 단건
export async function fetchGoal(goalId) {
  const { data } = await apiClient.get(`/goals/${goalId}`)
  return data
}

// 목표 생성. startDate 미지정 시 오늘부터.
export async function createGoal({
  title,
  description = null,
  subjectId = null,
  targetType = 'steps',
  targetMinutes = 0,
  startDate = null,
  dueDate = null,
  importance = 3,
}) {
  const { data } = await apiClient.post('/goals', {
    title,
    description,
    subject_id: subjectId,
    target_type: targetType,
    target_minutes: targetMinutes,
    start_date: startDate,
    due_date: dueDate,
    importance,
  })
  return data
}

// 목표 수정. 전달한 필드만 반영. isCompleted로 수동 완료/해제.
export async function updateGoal(goalId, {
  title,
  description,
  subjectId,
  targetType,
  targetMinutes,
  startDate,
  dueDate,
  importance,
  isCompleted,
} = {}) {
  const payload = {}
  if (title !== undefined) payload.title = title
  if (description !== undefined) payload.description = description
  if (subjectId !== undefined) payload.subject_id = subjectId
  if (targetType !== undefined) payload.target_type = targetType
  if (targetMinutes !== undefined) payload.target_minutes = targetMinutes
  if (startDate !== undefined) payload.start_date = startDate
  if (dueDate !== undefined) payload.due_date = dueDate
  if (importance !== undefined) payload.importance = importance
  if (isCompleted !== undefined) payload.is_completed = isCompleted
  const { data } = await apiClient.patch(`/goals/${goalId}`, payload)
  return data
}

export async function deleteGoal(goalId) {
  await apiClient.delete(`/goals/${goalId}`)
}

// 로드맵 단계 추가
export async function createStep(goalId, { title, orderIndex = 0, estimatedMinutes = 0 }) {
  const { data } = await apiClient.post(`/goals/${goalId}/steps`, {
    title,
    order_index: orderIndex,
    estimated_minutes: estimatedMinutes,
  })
  return data
}

// 로드맵 단계 수정 (완료 토글 포함)
export async function updateStep(goalId, stepId, { title, orderIndex, estimatedMinutes, isDone } = {}) {
  const payload = {}
  if (title !== undefined) payload.title = title
  if (orderIndex !== undefined) payload.order_index = orderIndex
  if (estimatedMinutes !== undefined) payload.estimated_minutes = estimatedMinutes
  if (isDone !== undefined) payload.is_done = isDone
  const { data } = await apiClient.patch(`/goals/${goalId}/steps/${stepId}`, payload)
  return data
}

export async function deleteStep(goalId, stepId) {
  await apiClient.delete(`/goals/${goalId}/steps/${stepId}`)
}
