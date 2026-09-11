import { Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

// 인증된 사용자만 접근을 허용한다. 로딩 중에는 잠시 대기 화면을 보여준다.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>불러오는 중...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
