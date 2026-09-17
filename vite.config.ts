import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { Server as SocketIOServer } from 'socket.io';

function rapidDispatchBackendPlugin(): Plugin {
  let tickets = [
    { id: 1, title: 'Truck #204 breakdown - I-35', status: 'open', resolution: '' },
    { id: 2, title: 'Duplicate billing - Order #88213', status: 'open', resolution: '' },
    { id: 3, title: 'Missed delivery window - Customer #501', status: 'open', resolution: '' },
  ];
  let nextTicketId = 4;
  const ticketLocks = new Map<number, { socketId: string; agentName: string }>();

  function lockStateArray() {
    return Array.from(ticketLocks.entries()).map(([ticketId, info]) => ({
      ticketId,
      agentName: info.agentName,
    }));
  }

  let io: SocketIOServer | null = null;

  return {
    name: 'rapiddispatch-backend',
    configureServer(server) {
      // REST API middleware
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';

        if (url === '/api/tickets') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(tickets));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                if (!parsed.title) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'title is required' }));
                  return;
                }
                const ticket = {
                  id: nextTicketId++,
                  title: parsed.title,
                  status: 'open',
                  resolution: '',
                };
                tickets.push(ticket);

                io?.emit('ticket_created', ticket);

                res.statusCode = 201;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(ticket));
              } catch {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              }
            });
            return;
          }
        }
        next();
      });

      // Attach Socket.io server
      if (server.httpServer) {
        io = new SocketIOServer(server.httpServer, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST'],
          },
        });

        io.on('connection', (socket) => {
          socket.on('join_dashboard', () => {
            socket.join('dashboard');
            socket.emit('lock_state_sync', lockStateArray());
          });

          socket.on('lock_ticket', ({ ticketId, agentName }, ack) => {
            const idNum = Number(ticketId);
            const existing = ticketLocks.get(idNum);

            if (existing && existing.socketId !== socket.id) {
              if (typeof ack === 'function') {
                ack({ success: false, reason: 'already_locked', lockedBy: existing.agentName });
              }
              return;
            }

            ticketLocks.set(idNum, { socketId: socket.id, agentName });
            if (typeof ack === 'function') ack({ success: true });
            io?.emit('ticket_locked', { ticketId: idNum, agentName });
          });

          socket.on('unlock_ticket', ({ ticketId }) => {
            const idNum = Number(ticketId);
            const existing = ticketLocks.get(idNum);

            if (existing && existing.socketId === socket.id) {
              ticketLocks.delete(idNum);
              io?.emit('ticket_unlocked', { ticketId: idNum });
            }
          });

          socket.on('save_ticket', ({ ticketId, resolution }) => {
            const idNum = Number(ticketId);
            const ticket = tickets.find((t) => t.id === idNum);
            if (ticket) {
              ticket.resolution = resolution;
              ticket.status = 'resolved';
            }

            const existing = ticketLocks.get(idNum);
            if (existing && existing.socketId === socket.id) {
              ticketLocks.delete(idNum);
            }

            io?.emit('ticket_updated', ticket);
            io?.emit('ticket_unlocked', { ticketId: idNum });
          });

          socket.on('disconnect', () => {
            const releasedTicketIds: number[] = [];

            for (const [ticketId, info] of ticketLocks.entries()) {
              if (info.socketId === socket.id) {
                ticketLocks.delete(ticketId);
                releasedTicketIds.push(ticketId);
              }
            }

            releasedTicketIds.forEach((ticketId) => {
              io?.emit('ticket_unlocked', { ticketId });
            });
          });
        });
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), rapidDispatchBackendPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
    },
  };
});
