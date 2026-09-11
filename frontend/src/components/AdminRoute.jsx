import { Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

// 관리자(role='admin')만 접근을 허용한다. 아니면 메인으로 돌려보낸다.
export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>불러오는 중...</div>
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
