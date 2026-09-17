import TicketRow from './TicketRow';

export default function TicketBoard({
  tickets,
  locks,
  myAgentName,
  myLockedTicketIds,
  onEditTicket,
}) {
  return (
    <div className="ticket-board">
      <div className="table-responsive">
        <table className="ticket-table">
          <thead>
            <tr>
              <th className="th-id">ID</th>
              <th className="th-title">Ticket Summary</th>
              <th className="th-status">Status</th>
              <th className="th-lock">Lock Status</th>
              <th className="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No tickets found. Create a new support ticket to begin.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const lockedBy = locks[ticket.id];
                const isLockedByMe =
                  Boolean(lockedBy) &&
                  (myLockedTicketIds.includes(ticket.id) ||
                    (myAgentName && lockedBy.trim().toLowerCase() === myAgentName.trim().toLowerCase()));

                return (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    lockedBy={lockedBy}
                    isLockedByMe={isLockedByMe}
                    onEdit={onEditTicket}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
