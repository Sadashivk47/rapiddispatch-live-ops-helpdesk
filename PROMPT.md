# Sprint 19 — AI Transparency & Engineering Reflection (`PROMPT.md`)

**Project:** RapidDispatch Live Ops Helpdesk  
**Focus:** Concurrency, WebSockets, In-Memory Locking & Race Conditions  
**Author / Engineer:** Fullstack Engineering Team  

---

## 🎯 Engineering Approach & Strategy

Transitioning from traditional HTTP REST architectures to real-time WebSocket communication requires a total shift in state management mindset. Rather than having clients periodically "poll" the database (`setInterval`), we established a persistent **Socket.io** connection where state updates are pushed instantly to all connected clients.

### Architectural Core:
1. **Initial Hydration via REST**: A single `GET /api/tickets` request fetches the ticket board when the dashboard mounts.
2. **Real-Time Concurrency Control via Sockets**: All lock acquisitions, releases, and ticket creations bypass database queries and execute in-memory on the Node server.
3. **Presence & Mutual Exclusion**: A centralized `Map` tracks lock ownership (`ticketId => { socketId, agentName }`), guaranteeing that only one agent can edit a ticket at any given second.

---

## 🧠 What I Learned During This Sprint

### 1. In-Memory Data Structures for Low-Latency Locking
- **The Insight**: Hitting a database (PostgreSQL/MongoDB) every time an agent clicks a ticket introduces network overhead (50ms–200ms), leaving a window open for race conditions where two agents click simultaneously.
- **What I Learned**: Using a JavaScript `Map()` on the Node server provides sub-millisecond lookup and mutation time. Concurrency validation happens in memory before any response or broadcast is dispatched.

### 2. Socket Lifecycle & React 18 Strict Mode
- **The Challenge**: In React 18 Strict Mode, components mount, unmount, and remount automatically in development. This caused socket event listeners (`ticket_locked`, `ticket_unlocked`) to trigger multiple times for a single event.
- **The Fix**: Learned the importance of returning a clean-up function inside `useEffect()` that explicitly unbinds listeners using `socket.off(eventName, handler)`.

### 3. The "Ghost Disconnect" Problem
- **The Challenge**: If Agent A locks Ticket #105 and then closes their laptop lid or shuts the browser tab, the client *never* sends an explicit `unlock_ticket` event. Without special handling, Ticket #105 remains locked forever.
- **The Solution**: Implemented an automated cleanup routine inside the server's `socket.on('disconnect')` listener. The server scans `ticketLocks`, removes all entries matching `socket.id`, and broadcasts `ticket_unlocked` to all remaining clients within ~1 second.

### 4. Separate CORS Configuration for WebSockets
- **The Gotcha**: Express middleware (`app.use(cors())`) only covers standard HTTP requests. The WebSocket HTTP handshake initiated by Socket.io requires its own explicit `cors` configuration on the `Server` instance.
- **Production Setup**: Ensured `CLIENT_ORIGIN` env variable is passed to both Express and Socket.io CORS handlers so Vercel (`https://`) can establish secure WebSocket connections (`wss://`) with Render.

---

## 🚨 Challenges Faced & AI Prompting Logs

Below is a breakdown of key challenges encountered during development, along with the prompt strategies used to solve them:

### Challenge 1: Preventing Optimistic Lock Glitches
* **Problem**: Initially, the UI opened the edit modal immediately upon clicking "Edit" before server confirmation. If another agent had locked it a millisecond earlier, the UI would flicker and crash.
* **AI Collaboration Prompt**:
  > *"How do I implement Socket.io acknowledgment callbacks (`ack`) in React so the client waits for server verification before opening the ticket editor?"*
* **Resolution**: Implemented `socket.emit('lock_ticket', payload, (ack) => { if (ack.success) openEditor(); })`. The UI strictly branches on the server's acknowledgment callback response.

### Challenge 2: Handling Ghost Disconnects Without Stale State
* **Problem**: Tracking which socket owned which lock when multiple tickets were locked across sessions.
* **AI Collaboration Prompt**:
  > *"What is the best Node.js in-memory data structure to map socket IDs to locked resources, and how do I efficiently clean them up inside `socket.on('disconnect')`?"*
* **Resolution**: Used `Map<ticketId, { socketId, agentName }>` and iterated `.entries()` during `disconnect` to release orphaned tickets and emit `ticket_unlocked` for each.

### Challenge 3: Socket Disconnection UI Warning
* **Problem**: Warning agents when their Wi-Fi drops so they don't lose work.
* **AI Collaboration Prompt**:
  > *"How can I build a standalone React banner component that listens directly to socket `connect` and `disconnect` events without causing re-render loops?"*
* **Resolution**: Built `ConnectionBanner.jsx` using `socket.connected` state and socket event listeners to display a red persistent warning bar during connection drops.

---

## 🎓 Key Takeaway

Building real-time concurrent applications requires designing for failure modes—ghost disconnects, race condition windows, and network drops. By pairing an in-memory server Map with WebSocket event synchronization and acknowledgment callbacks, we achieved a seamless real-time helpdesk that completely prevents agent collision.
