interface ConfirmProps {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function Confirm({ message, confirmLabel, onConfirm, onCancel }: ConfirmProps) {
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-label={message}>
      <div className="dialog">
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel} autoFocus>
            Annuler
          </button>
          <button className="btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
