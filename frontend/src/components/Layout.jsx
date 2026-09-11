import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/timer', label: '타이머' },
  { to: '/subjects', label: '과목 관리' },
  { to: '/schedule', label: '일정 캘린더' },
  { to: '/study', label: '공부 캘린더' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-inner">
          <Link to="/" className="layout-brand">Study</Link>
          <nav className="layout-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            ))}
            {/* 관리자에게만 학습 가이드 메뉴를 노출한다. */}
            {user?.role === 'admin' && (
              <NavLink
                to="/guides"
                className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
              >
                학습 가이드
              </NavLink>
            )}
          </nav>
          <div className="layout-user">
            <span className="layout-username">{user?.display_name}님</span>
            <button className="btn btn-danger" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
