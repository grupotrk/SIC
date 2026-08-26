'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'

type NavItem = { label: string; href: string; icon: 'home' | 'box' | 'users' | 'card' | 'settings' | 'cash' }

type Props = {
  title: string
  subtitle?: string
  badge?: string
  navItems: NavItem[]
  onLogout: () => void
  loggingOut?: boolean
  onCash?: () => void
  children: ReactNode
}

function Icon({ name }: { name: NavItem['icon'] }) {
  const common = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }
  if (name === 'home') return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>
  if (name === 'box') return <svg {...common}><path d="M4 7h16v13H4zM7 4h10l3 3H4l3-3Z"/><path d="M9 11h6"/></svg>
  if (name === 'users') return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.7-7 6-7s6 3 6 7"/><path d="M16 5.5a3 3 0 0 1 0 5.5M17 13c2.4.6 4 3 4 6"/></svg>
  if (name === 'cash') return <svg {...common}><path d="M3 6h18v12H3z"/><path d="M7 10h4M7 14h2M16 10v4M14 12h4"/></svg>
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>
  return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>
}

export default function AppShell({ title, subtitle, badge, navItems, onLogout, loggingOut, onCash, children }: Props) {
  const [activeHref, setActiveHref] = useState(navItems[0]?.href ?? '')

  useEffect(() => {
    const updateFromHash = () => setActiveHref(window.location.hash || navItems[0]?.href || '')
    updateFromHash()
    window.addEventListener('hashchange', updateFromHash)
    return () => window.removeEventListener('hashchange', updateFromHash)
  }, [navItems])

  return (
    <div className="sic-app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <img src="/sidea-logo.png" alt="SIDEA Ingeniería" className="app-brand-logo" />
          <div className="app-brand-copy"><strong>SIC</strong><small>Sistema interno de control</small></div>
        </div>

        <div className="app-nav-label">Navegación</div>
        <nav className="app-nav" aria-label="Navegación principal">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={activeHref === item.href ? 'active' : ''}
              onClick={() => setActiveHref(item.href)}
            >
              <Icon name={item.icon}/><span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <span className="status-dot"/>
          <div><strong>Sistema operativo</strong><small>Sesión protegida</small></div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div className="app-title-wrap">
            <div className="app-title-line"><h1>{title}</h1>{badge && <span className="app-badge">{badge}</span>}</div>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="app-actions">
            <ThemeToggle />
            {onCash && <button className="app-button app-button-primary" onClick={onCash}><Icon name="cash"/><span>Ir a caja</span></button>}
            <button className="app-button app-button-quiet" onClick={onLogout} disabled={loggingOut}>{loggingOut ? 'Saliendo…' : 'Cerrar sesión'}</button>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}
