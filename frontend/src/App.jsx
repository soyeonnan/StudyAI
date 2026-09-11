import { Navigate, Route, Routes } from 'react-router-dom'

import AdminRoute from './components/AdminRoute.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import GuidesPage from './pages/GuidesPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import TimerPage from './pages/TimerPage.jsx'
import SchedulePage from './pages/SchedulePage.jsx'
import StudyPage from './pages/StudyPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/timer" element={<TimerPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/study" element={<StudyPage />} />
        <Route
          path="/guides"
          element={
            <AdminRoute>
              <GuidesPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
