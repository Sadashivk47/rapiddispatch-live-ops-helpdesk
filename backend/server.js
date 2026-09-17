const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// CORS configuration
const rawOrigin = process.env.CLIENT_ORIGIN || '*';
const allowedOrigins = rawOrigin.split(',').map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || rawOrigin === '*' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

// In-memory ticket storage
let tickets = [
  { id: 1, title: 'Truck #204 breakdown - I-35', status: 'open', resolution: '' },
  { id: 2, title: 'Duplicate billing - Order #88213', status: 'open', resolution: '' },
  { id: 3, title: 'Missed delivery window - Customer #501', status: 'open', resolution: '' },
];
let nextTicketId = 4;

// Active ticket locks: Map<ticketId, { socketId, agentName }>
const ticketLocks = new Map();

function lockStateArray() {
  return Array.from(ticketLocks.entries()).map(([ticketId, info]) => ({
    ticketId,
    agentName: info.agentName,
  }));
}

// REST Endpoints
app.get('/api/tickets', (req, res) => {
  res.json(tickets);
});

app.post('/api/tickets', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const ticket = { id: nextTicketId++, title, status: 'open', resolution: '' };
  tickets.push(ticket);

  io.emit('ticket_created', ticket);
  res.status(201).json(ticket);
});

// Socket.io Handlers
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Send lock state on join
  socket.on('join_dashboard', () => {
    socket.join('dashboard');
    socket.emit('lock_state_sync', lockStateArray());
  });

  // Acquire lock
  socket.on('lock_ticket', ({ ticketId, agentName }, ack) => {
    const existing = ticketLocks.get(ticketId);

    if (existing && existing.socketId !== socket.id) {
      if (typeof ack === 'function') {
        ack({ success: false, reason: 'already_locked', lockedBy: existing.agentName });
      }
      return;
    }

    ticketLocks.set(ticketId, { socketId: socket.id, agentName });
    if (typeof ack === 'function') ack({ success: true });

    io.emit('ticket_locked', { ticketId, agentName });
  });

  // Release lock
  socket.on('unlock_ticket', ({ ticketId }) => {
    const existing = ticketLocks.get(ticketId);

    if (existing && existing.socketId === socket.id) {
      ticketLocks.delete(ticketId);
      io.emit('ticket_unlocked', { ticketId });
    }
  });

  // Save ticket resolution & release lock
  socket.on('save_ticket', ({ ticketId, resolution }) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket) {
      ticket.resolution = resolution;
      ticket.status = 'resolved';
    }

    const existing = ticketLocks.get(ticketId);
    if (existing && existing.socketId === socket.id) {
      ticketLocks.delete(ticketId);
    }

    io.emit('ticket_updated', ticket);
    io.emit('ticket_unlocked', { ticketId });
  });

  // Handle disconnect & release acquired locks
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);

    const releasedTicketIds = [];

    for (const [ticketId, info] of ticketLocks.entries()) {
      if (info.socketId === socket.id) {
        ticketLocks.delete(ticketId);
        releasedTicketIds.push(ticketId);
      }
    }

    releasedTicketIds.forEach((ticketId) => {
      io.emit('ticket_unlocked', { ticketId });
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`RapidDispatch Live Ops server running on port ${PORT}`);
});

