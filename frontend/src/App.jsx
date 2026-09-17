import { useState, useEffect } from 'react';
import { socket } from './socket';
import TicketBoard from './components/TicketBoard';
import TicketEditor from './components/TicketEditor';
import ConnectionBanner from './components/ConnectionBanner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [locks, setLocks] = useState({}); // { [ticketId]: agentName }
  const [backendError, setBackendError] = useState(null);
  const [myAgentName, setMyAgentName] = useState(() => {
    return localStorage.getItem('rapiddispatch_agent_name') || '';
  });
  const [myLockedTicketIds, setMyLockedTicketIds] = useState([]);
  const [editingTicket, setEditingTicket] = useState(null);
  const [lockAlertMessage, setLockAlertMessage] = useState(null);
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isPromptingNameForTicket, setIsPromptingNameForTicket] = useState(null);
  const [tempAgentNameInput, setTempAgentNameInput] = useState('');

  // Fetch initial tickets via REST
  useEffect(() => {
    let isMounted = true;

    async function loadTickets() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/tickets`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        if (isMounted) {
          setTickets(Array.isArray(data) ? data : []);
          setBackendError(null);
        }
      } catch (err) {
        console.warn('[REST Notice] Unable to load initial tickets:', err);
        if (isMounted) {
          setBackendError('Backend service connecting... If running locally or on Render, ensure backend is active.');
        }
      }
    }

    loadTickets();

    return () => {
      isMounted = false;
    };
  }, []);

  // Socket event listeners & join_dashboard
  useEffect(() => {
    function emitJoin() {
      socket.emit('join_dashboard');
    }

    function handleLockStateSync(initialLocks) {
      const lockMap = {};
      if (Array.isArray(initialLocks)) {
        initialLocks.forEach(({ ticketId, agentName }) => {
          lockMap[ticketId] = agentName;
        });
      }
      setLocks(lockMap);
    }

    function handleTicketCreated(newTicket) {
      setTickets((prev) => {
        if (prev.some((t) => t.id === newTicket.id)) {
          return prev;
        }
        return [...prev, newTicket];
      });
    }

    function handleTicketLocked({ ticketId, agentName }) {
      setLocks((prev) => ({
        ...prev,
        [ticketId]: agentName,
      }));
    }

    function handleTicketUnlocked({ ticketId }) {
      setLocks((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });

      // Clear local lock
      setMyLockedTicketIds((prev) => prev.filter((id) => id !== ticketId));

      setEditingTicket((current) => {
        if (current && current.id === ticketId) {
          return null;
        }
        return current;
      });
    }

    function handleTicketUpdated(updatedTicket) {
      setTickets((prev) =>
        prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
      );
    }

    function handleConnect() {
      emitJoin();
    }

    // Bind socket listeners
    socket.on('connect', handleConnect);
    socket.on('lock_state_sync', handleLockStateSync);
    socket.on('ticket_created', handleTicketCreated);
    socket.on('ticket_locked', handleTicketLocked);
    socket.on('ticket_unlocked', handleTicketUnlocked);
    socket.on('ticket_updated', handleTicketUpdated);

    if (socket.connected) {
      emitJoin();
    }

    // Cleanup listeners
    return () => {
      socket.off('connect', handleConnect);
      socket.off('lock_state_sync', handleLockStateSync);
      socket.off('ticket_created', handleTicketCreated);
      socket.off('ticket_locked', handleTicketLocked);
      socket.off('ticket_unlocked', handleTicketUnlocked);
      socket.off('ticket_updated', handleTicketUpdated);
    };
  }, []);

  // Save agent name to localStorage
  const handleSaveAgentName = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMyAgentName(trimmed);
    localStorage.setItem('rapiddispatch_agent_name', trimmed);
  };

  // Acquire ticket lock
  const executeLockTicket = (ticket, agentName) => {
    setLockAlertMessage(null);

    socket.emit(
      'lock_ticket',
      { ticketId: ticket.id, agentName },
      (ack) => {
        if (ack && ack.success) {
          setMyLockedTicketIds((prev) =>
            prev.includes(ticket.id) ? prev : [...prev, ticket.id]
          );
          setEditingTicket(ticket);
        } else {
          const holder = (ack && ack.lockedBy) || locks[ticket.id] || 'another agent';
          setLockAlertMessage(`Locked by ${holder}`);
          setEditingTicket(null);
        }
      }
    );
  };

  // Handle edit ticket
  const handleEditTicket = (ticket) => {
    const currentHolder = locks[ticket.id];
    if (currentHolder && !myLockedTicketIds.includes(ticket.id) && currentHolder !== myAgentName) {
      setLockAlertMessage(`Locked by ${currentHolder}`);
      return;
    }

    if (!myAgentName.trim()) {
      setIsPromptingNameForTicket(ticket);
      setTempAgentNameInput('');
      return;
    }

    if (myLockedTicketIds.includes(ticket.id)) {
      setEditingTicket(ticket);
      return;
    }

    executeLockTicket(ticket, myAgentName);
  };

  const handleConfirmPromptedName = (e) => {
    e.preventDefault();
    const trimmed = tempAgentNameInput.trim();
    if (!trimmed) return;

    handleSaveAgentName(trimmed);
    const targetTicket = isPromptingNameForTicket;
    setIsPromptingNameForTicket(null);

    if (targetTicket) {
      executeLockTicket(targetTicket, trimmed);
    }
  };

  // Save resolution & release lock
  const handleSaveTicket = (ticketId, resolution) => {
    socket.emit('save_ticket', { ticketId, resolution });
    setEditingTicket(null);
    setMyLockedTicketIds((prev) => prev.filter((id) => id !== ticketId));
  };

  // Cancel edit & release lock
  const handleCancelEdit = (ticketId) => {
    socket.emit('unlock_ticket', { ticketId });
    setEditingTicket(null);
    setMyLockedTicketIds((prev) => prev.filter((id) => id !== ticketId));
  };

  // Create ticket via REST
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const title = newTicketTitle.trim();
    if (!title || isCreatingTicket) return;

    setIsCreatingTicket(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setNewTicketTitle('');
      } else {
        console.error('Failed to create ticket:', res.statusText);
      }
    } catch (err) {
      console.error('Error creating ticket:', err);
    } finally {
      setIsCreatingTicket(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Red persistent banner on disconnect */}
      <ConnectionBanner />

      {/* App Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-group">
            <div className="brand-logo" aria-hidden="true">⚡</div>
            <div>
              <h1 className="brand-title">RapidDispatch Live Ops</h1>
              <p className="brand-subtitle">Real-time Concurrency & Ticket Locking</p>
            </div>
          </div>

          <div className="header-agent-bar">
            <div className="agent-badge">
              <span className="agent-label">Agent Session:</span>
              <input
                type="text"
                className="agent-input"
                placeholder="Enter your name..."
                value={myAgentName}
                onChange={(e) => handleSaveAgentName(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Lock collision alert message */}
      {lockAlertMessage && (
        <div className="alert-bar" role="alert">
          <span className="alert-icon">🔒</span>
          <span className="alert-text">{lockAlertMessage}</span>
          <button
            type="button"
            className="alert-dismiss"
            onClick={() => setLockAlertMessage(null)}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        <section className="controls-panel">
          <form onSubmit={handleCreateTicket} className="create-ticket-form">
            <input
              type="text"
              className="create-ticket-input"
              placeholder="Quick create ticket: e.g. Highway 80 refrigeration alert..."
              value={newTicketTitle}
              onChange={(e) => setNewTicketTitle(e.target.value)}
              disabled={isCreatingTicket}
            />
            <button
              type="submit"
              className="btn-create"
              disabled={isCreatingTicket || !newTicketTitle.trim()}
            >
              {isCreatingTicket ? 'Dispatching...' : '+ New Ticket'}
            </button>
          </form>

          <div className="stats-indicator">
            <span><strong>{tickets.length}</strong> Total Tickets</span>
            <span className="stat-separator">•</span>
            <span className="stat-locked">
              <strong>{Object.keys(locks).length}</strong> Active Locks
            </span>
          </div>
        </section>

        {/* Live Ticket Board */}
        <TicketBoard
          tickets={tickets}
          locks={locks}
          myAgentName={myAgentName}
          myLockedTicketIds={myLockedTicketIds}
          onEditTicket={handleEditTicket}
        />
      </main>

      {/* Prompt for Agent Name modal if clicking edit with empty name */}
      {isPromptingNameForTicket && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container modal-prompt">
            <div className="modal-header">
              <h3 className="modal-title">Identify Your Agent Session</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsPromptingNameForTicket(null)}
              >
                ✕
              </button>
            </div>
            <p className="modal-description">
              Please enter your name or callsign before locking Ticket #{isPromptingNameForTicket.id}.
              Other agents will see this live.
            </p>
            <form onSubmit={handleConfirmPromptedName} className="modal-form">
              <div className="form-field">
                <input
                  type="text"
                  className="field-input"
                  placeholder="e.g. Marcus Thorne, Dispatch #12"
                  value={tempAgentNameInput}
                  onChange={(e) => setTempAgentNameInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsPromptingNameForTicket(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={!tempAgentNameInput.trim()}
                >
                  Lock & Edit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Editor modal when active */}
      {editingTicket && (
        <TicketEditor
          ticket={editingTicket}
          onSave={handleSaveTicket}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}
