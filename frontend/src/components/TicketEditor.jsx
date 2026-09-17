import { useState } from 'react';

export default function TicketEditor({ ticket, onSave, onCancel }) {
  const [resolution, setResolution] = useState(ticket.resolution || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    onSave(ticket.id, resolution);
  };

  const handleCancel = () => {
    onCancel(ticket.id);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="ticket-id-tag">Ticket #{ticket.id}</span>
            <h2 id="modal-title" className="modal-title">{ticket.title}</h2>
          </div>
          <button
            type="button"
            className="btn-icon-close"
            onClick={handleCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label htmlFor="ticket-resolution" className="field-label">
              Resolution Notes
            </label>
            <textarea
              id="ticket-resolution"
              className="field-textarea"
              rows={6}
              placeholder="Enter resolution notes, dispatch actions, or order corrections..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              autoFocus
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel (Release Lock)
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save & Release Lock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
