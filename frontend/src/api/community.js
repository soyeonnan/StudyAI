import { apiClient } from './client'

// 인증글 목록 (최신순, 댓글 본문 제외)
export async function fetchPosts() {
  const { data } = await apiClient.get('/community/posts')
  return data
}

// 인증글 상세 (댓글 포함)
export async function fetchPost(postId) {
  const { data } = await apiClient.get(`/community/posts/${postId}`)
  return data
}

// 인증글 작성. sessionId로 공부기록 연결(선택).
export async function createPost({ content, sessionId = null }) {
  const { data } = await apiClient.post('/community/posts', {
    content,
    session_id: sessionId,
  })
  return data
}

export async function deletePost(postId) {
  await apiClient.delete(`/community/posts/${postId}`)
}

// 좋아요 토글 (갱신된 글 반환)
export async function toggleLike(postId) {
  const { data } = await apiClient.post(`/community/posts/${postId}/like`)
  return data
}

// 댓글 작성 (갱신된 글 반환)
export async function createComment(postId, content) {
  const { data } = await apiClient.post(`/community/posts/${postId}/comments`, { content })
  return data
}

export async function deleteComment(postId, commentId) {
  await apiClient.delete(`/community/posts/${postId}/comments/${commentId}`)
}
