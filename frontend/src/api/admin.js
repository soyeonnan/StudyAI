import { apiClient } from './client'

// 관리자 전용 학습 가이드 목록 (role='admin'만 접근 가능)
export async function fetchGuides() {
  const { data } = await apiClient.get('/admin/guides')
  return data
}
