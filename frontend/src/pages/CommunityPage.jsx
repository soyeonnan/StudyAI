import { useCallback, useEffect, useState } from 'react'

import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  fetchNickname,
  fetchPost,
  fetchPosts,
  setNickname,
  toggleLike,
} from '../api/community'
import { useAuth } from '../auth/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import './CommunityPage.css'

// ISO 시각을 "9/12 14:30" 형태로
function formatDateTime(iso) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

// 서버 에러 메시지(detail)를 추출한다.
function errorDetail(err, fallback) {
  return err?.response?.data?.detail || fallback
}

export default function CommunityPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newContent, setNewContent] = useState('')

  // 닉네임 상태
  const [effectiveName, setEffectiveName] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [editingNick, setEditingNick] = useState(false)

  // 펼쳐진 글 상세 { [postId]: postDetail }
  const [details, setDetails] = useState({})
  const [commentInputs, setCommentInputs] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchPosts()
    setPosts(data)
    setLoading(false)
  }, [])

  const loadNickname = useCallback(async () => {
    const data = await fetchNickname()
    setEffectiveName(data.effective_name)
    setNicknameInput(data.nickname)
  }, [])

  useEffect(() => {
    load()
    loadNickname()
  }, [load, loadNickname])

  // 서버 검증 실패(욕설 등)를 알림으로 안내한다.
  async function notifyError(err, fallback) {
    await confirm({
      title: '작성할 수 없어요',
      message: errorDetail(err, fallback),
      confirmText: '알겠어요',
      cancelText: '닫기',
    })
  }

  // ---- 닉네임 ----
  async function handleSaveNickname() {
    try {
      const data = await setNickname(nicknameInput.trim())
      setEffectiveName(data.effective_name)
      setEditingNick(false)
    } catch (err) {
      await notifyError(err, '닉네임을 저장할 수 없어요.')
    }
  }

  // ---- 글 ----
  async function handleCreatePost(e) {
    e.preventDefault()
    const content = newContent.trim()
    if (!content) return
    try {
      await createPost({ content })
      setNewContent('')
      load()
    } catch (err) {
      await notifyError(err, '글을 작성할 수 없어요.')
    }
  }

  async function handleDeletePost(postId) {
    const ok = await confirm({
      title: '글 삭제',
      message: '이 인증글과 달린 댓글이 모두 삭제됩니다. 계속할까요?',
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deletePost(postId)
    setDetails((prev) => {
      const next = { ...prev }
      delete next[postId]
      return next
    })
    load()
  }

  async function handleToggleLike(postId) {
    const updated = await toggleLike(postId)
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, like_count: updated.like_count, liked_by_me: updated.liked_by_me }
          : p,
      ),
    )
  }

  async function toggleDetail(postId) {
    if (details[postId]) {
      setDetails((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      return
    }
    const detail = await fetchPost(postId)
    setDetails((prev) => ({ ...prev, [postId]: detail }))
  }

  async function handleAddComment(postId) {
    const content = (commentInputs[postId] || '').trim()
    if (!content) return
    try {
      const detail = await createComment(postId, content)
      setDetails((prev) => ({ ...prev, [postId]: detail }))
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comment_count: detail.comment_count } : p)),
      )
    } catch (err) {
      await notifyError(err, '댓글을 작성할 수 없어요.')
    }
  }

  async function handleDeleteComment(postId, commentId) {
    const ok = await confirm({
      title: '댓글 삭제',
      message: '이 댓글을 삭제할까요?',
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteComment(postId, commentId)
    const detail = await fetchPost(postId)
    setDetails((prev) => ({ ...prev, [postId]: detail }))
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: detail.comment_count } : p)),
    )
  }

  return (
    <div className="community-page">
      <div className="community-header">
        <h2 className="community-title">공부 인증 커뮤니티</h2>
        <p className="community-desc">오늘 공부한 내용을 인증하고 서로 응원해요.</p>
      </div>

      {/* 닉네임 설정 */}
      <div className="nickname-bar card">
        {editingNick ? (
          <div className="nickname-edit">
            <input
              className="field"
              placeholder="커뮤니티에서 쓸 닉네임 (비우면 이름 사용)"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={50}
            />
            <button className="btn btn-primary" onClick={handleSaveNickname}>저장</button>
            <button className="btn" onClick={() => setEditingNick(false)}>취소</button>
          </div>
        ) : (
          <div className="nickname-view">
            <span>내 닉네임: <strong>{effectiveName}</strong></span>
            <button className="btn nickname-edit-btn" onClick={() => setEditingNick(true)}>닉네임 변경</button>
          </div>
        )}
      </div>

      <form className="post-form card" onSubmit={handleCreatePost}>
        <textarea
          className="field post-form-input"
          placeholder="오늘의 공부를 인증해 보세요. (비속어는 작성할 수 없어요)"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={2000}
        />
        <button type="submit" className="btn btn-primary">
          인증하기
        </button>
      </form>

      {loading ? (
        <p className="community-empty">불러오는 중...</p>
      ) : posts.length === 0 ? (
        <p className="community-empty">아직 인증글이 없어요. 첫 인증을 남겨보세요.</p>
      ) : (
        <ul className="post-list">
          {posts.map((post) => {
            const detail = details[post.id]
            return (
              <li key={post.id} className="post-card card">
                <div className="post-head">
                  <span className="post-author">{post.author_name}</span>
                  <span className="post-time">{formatDateTime(post.created_at)}</span>
                </div>
                <p className="post-content">{post.content}</p>

                <div className="post-actions">
                  <button
                    className={`post-like ${post.liked_by_me ? 'post-liked' : ''}`}
                    onClick={() => handleToggleLike(post.id)}
                  >
                    {post.liked_by_me ? '♥' : '♡'} {post.like_count}
                  </button>
                  <button className="post-comment-toggle" onClick={() => toggleDetail(post.id)}>
                    💬 {post.comment_count}
                  </button>
                  {post.user_id === user?.id && (
                    <button className="btn btn-danger post-del" onClick={() => handleDeletePost(post.id)}>
                      삭제
                    </button>
                  )}
                </div>

                {/* 댓글 영역 (펼쳤을 때) */}
                {detail && (
                  <div className="post-comments">
                    <ul className="comment-list">
                      {detail.comments.length === 0 && (
                        <li className="comment-empty">첫 댓글을 남겨보세요.</li>
                      )}
                      {detail.comments.map((c) => (
                        <li key={c.id} className="comment-item">
                          <div className="comment-main">
                            <span className="comment-author">{c.author_name}</span>
                            <span className="comment-content">{c.content}</span>
                          </div>
                          {c.user_id === user?.id && (
                            <button
                              className="comment-del"
                              onClick={() => handleDeleteComment(post.id, c.id)}
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="comment-add">
                      <input
                        className="field"
                        placeholder="댓글 달기"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddComment(post.id)
                          }
                        }}
                      />
                      <button className="btn btn-primary" onClick={() => handleAddComment(post.id)}>
                        등록
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
