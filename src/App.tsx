import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { useTheme } from './hooks/useTheme'
import { SavingsPage } from './pages/savings/SavingsPage'
import { ExercisePage } from './pages/exercise/ExercisePage'
import { SkillsPage } from './pages/skills/SkillsPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { StatusPage } from './pages/status/StatusPage'
import { ensureDefaults } from './utils/seed'

export default function App() {
  useTheme()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void ensureDefaults().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>加载中…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/savings" replace />} />
          <Route path="/savings" element={<SavingsPage />} />
          <Route path="/exercise" element={<ExercisePage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/savings" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
