interface Props {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon = '📭', title, description, action }: Props) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && (
        <button type="button" className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
