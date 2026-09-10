import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

const tabs = [
  { to: '/savings', label: '储蓄', icon: '💰' },
  { to: '/exercise', label: '锻炼', icon: '🏃' },
  { to: '/status', label: '元气球', icon: '🎈' },
  { to: '/skills', label: '技能', icon: '🎯' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export function BottomNav() {
  return (
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
  )
}
