export default function TicketRow({ ticket, lockedBy, isLockedByMe, onEdit }) {
  // Driven strictly from the same locks state
  const isLocked = Boolean(lockedBy);
  const canEdit = !isLocked || isLockedByMe;

  return (
    <tr className={`ticket-row ${isLocked ? 'ticket-row-locked' : ''}`}>
      <td className="col-id">#{ticket.id}</td>
      <td className="col-title">
        <div className="title-text">{ticket.title}</div>
        {ticket.resolution && (
          <div className="resolution-preview">
            <span className="resolution-label">Resolution:</span> {ticket.resolution}
          </div>
        )}
      </td>
      <td className="col-status">
        <span className={`status-badge status-${ticket.status}`}>
          {ticket.status}
        </span>
      </td>
      <td className="col-lock">
        {isLocked ? (
          <span className={`lock-badge ${isLockedByMe ? 'lock-badge-mine' : 'lock-badge-other'}`}>
            <span className="lock-icon" aria-hidden="true">🔒</span>
            <span className="lock-text">
              {isLockedByMe ? `Locked by you (${lockedBy})` : `Locked by ${lockedBy}`}
            </span>
          </span>
        ) : (
          <span className="status-available">Available</span>
        )}
      </td>
      <td className="col-actions">
        <button
          type="button"
          className={`btn-action-edit ${isLockedByMe ? 'btn-edit-active' : ''}`}
          disabled={!canEdit}
          onClick={() => onEdit(ticket)}
          title={!canEdit ? `Locked by ${lockedBy}` : 'Edit ticket'}
        >
          {isLockedByMe ? 'Editing' : 'Edit'}
        </button>
      </td>
    </tr>
  );
}
