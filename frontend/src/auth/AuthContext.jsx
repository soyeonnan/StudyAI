import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import * as authApi from '../api/auth'
import { tokenStorage } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 앱 시작 시 저장된 토큰으로 사용자 정보를 복구한다.
  useEffect(() => {
    async function restore() {
      if (!tokenStorage.get()) {
        setLoading(false)
        return
      }
      try {
        const me = await authApi.fetchMe()
        setUser(me)
      } catch {
        tokenStorage.clear()
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const { access_token } = await authApi.login({ email, password })
    tokenStorage.set(access_token)
    const me = await authApi.fetchMe()
    setUser(me)
  }, [])

  const register = useCallback(async ({ email, password, displayName }) => {
    await authApi.register({ email, password, displayName })
    // 회원가입 후 바로 로그인 처리한다.
    await login({ email, password })
  }, [login])

  const logout = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, isAuthenticated: !!user }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  }
  return ctx
}
