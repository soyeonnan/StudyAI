import { apiClient } from './client'

// 평면 목록 (대분류 + 소분류 모두)
export async function fetchSubjects() {
  const { data } = await apiClient.get('/subjects')
  return data
}

// 트리 형태 (대분류별로 소분류를 묶어서 반환)
export async function fetchSubjectTree() {
  const { data } = await apiClient.get('/subjects/tree')
  return data
}

// parentId가 있으면 소분류로 생성된다.
export async function createSubject({ name, color = '#3b82f6', parentId = null }) {
  const { data } = await apiClient.post('/subjects', {
    name,
    color,
    parent_id: parentId,
  })
  return data
}

export async function deleteSubject(subjectId) {
  await apiClient.delete(`/subjects/${subjectId}`)
}
