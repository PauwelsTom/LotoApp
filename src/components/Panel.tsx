import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  subtitle?: string
  closeLabel?: string
  onClose: () => void
  action?: ReactNode
  children: ReactNode
}

export function Panel({ title, subtitle, closeLabel = 'Fermer', onClose, action, children }: PanelProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div className="panel-title">
          <h2>{title}</h2>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {action}
        <button className="btn" onClick={onClose}>
          {closeLabel}
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}
