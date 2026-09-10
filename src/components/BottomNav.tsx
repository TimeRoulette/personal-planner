import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { EmotionBallView } from './EmotionBallView'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { db } from '../db/database'
import { useSettings } from '../hooks/useSettings'
import { DEFAULT_DAILY_KCAL_BUDGET } from '../utils/defaults'
import { buildEnergySnapshot } from '../utils/energyEmotion'
import { todayStr } from '../utils/id'
import styles from './BottomNav.module.css'

const tabs = [
  { to: '/savings', label: '储蓄', icon: '💰' },
  { to: '/exercise', label: '锻炼', icon: '🏃' },
  { to: '/skills', label: '技能', icon: '🎯' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

/** 迷你球粗略情绪：跟今日能量走 */
function useMiniEmotionId(): string {
  const { settings } = useSettings()
  const today = todayStr()
  const foodLogs = useLiveQuery(() => db.foodLogs.where('date').equals(today).toArray(), [today], []) ?? []
  const workouts = useLiveQuery(() => db.workouts.where('date').equals(today).toArray(), [today], []) ?? []
  const budget = settings.dailyKcalBudget > 0 ? settings.dailyKcalBudget : DEFAULT_DAILY_KCAL_BUDGET
  const intake = foodLogs.reduce((s, f) => s + (f.kcal || 0), 0)
  const burn = workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0)
  const hadGoodWorkout = workouts.some((w) => (w.caloriesBurned ?? 0) >= 200 || w.duration >= 30)
  return buildEnergySnapshot({ intake, burn, budget, hadGoodWorkout }).emotionId
}

export function BottomNav() {
  const navigate = useNavigate()
  const loc = useLocation()
  const onStatus = loc.pathname.startsWith('/status')
  const emotionId = useMiniEmotionId()

  function openStatus() {
    if (!onStatus) navigate('/status')
  }

  return (
    <>
      <div
        className={`${styles.fabBall} ${onStatus ? styles.fabBallActive : ''}`}
        role="button"
        tabIndex={0}
        aria-label="打开元气球"
        title="元气球"
        onClick={openStatus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openStatus()
          }
        }}
      >
        <EmotionBallView
          emotionId={emotionId}
          size={52}
          lite
          interactive={!onStatus}
          playful
          label="元气球入口"
          onInteract={() => {
            /* 迷你球先甩一下彩带，再进页；已在 status 则只互动 */
            if (!onStatus) window.setTimeout(openStatus, 180)
          }}
        />
        <span className={styles.fabHint}>元气球</span>
      </div>

      <nav className={styles.nav} aria-label="主导航">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.icon} aria-hidden>
              {t.icon}
            </span>
            <span className={styles.label}>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
