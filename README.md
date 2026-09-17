# RapidDispatch Live Ops Helpdesk — Sprint 19

**Client Delivery Phase II (Concurrency, WebSockets & Race Conditions)**  
**Client:** RapidDispatch Freight & Logistics (Dallas, TX)  
**Objective:** Solve support ticket race conditions by building a real-time collaborative helpdesk with bidirectional WebSocket locking, presence tracking, and ghost disconnect handling.

---

## Technical Stack
- **Frontend (Track A):** React, Vite, Socket.io-client, CSS3
- **Backend (Track B):** Node.js, Express, Socket.io (In-memory concurrency control)

---

## 📡 API Reference & Sprint Requirements Mapping

### 1. REST APIs (HTTP / Express)

| Endpoint | Method | Payload / Params | Purpose & Sprint Requirement |
| :--- | :--- | :--- | :--- |
| `/api/tickets` | `GET` | *None* | **Initial Dashboard Hydration**: Fetches the initial list of active support tickets when the dashboard mounts. Prevents `setInterval` database polling per Requirement 1. |
| `/api/tickets` | `POST` | `{ title: string }` | **Ticket Dispatch**: Creates a new support ticket. Upon creation, the server immediately triggers an `io.emit('ticket_created', ticket)` broadcast so the new ticket slides into all connected clients' dashboards instantly. |

---

### 2. WebSocket Event APIs (Socket.io)

All real-time concurrency and locking operations bypass the database and operate via WebSocket events.

#### Client → Server Events

| Event Name | Payload | Callback / Ack | Purpose & Sprint Requirement |
| :--- | :--- | :--- | :--- |
| `join_dashboard` | *None* | *None* | Registers client on the dashboard room. Triggers server to emit `lock_state_sync` snapshot so newly connected or reconnected agents instantly get current lock states. |
| `lock_ticket` | `{ ticketId: number, agentName: string }` | `ack({ success: boolean, lockedBy?: string })` | **Requirement 2 (Presence & Locking UI)**: Requests a lock on a ticket. Server checks its in-memory `Map`. If already locked by another socket, returns `ack({ success: false, lockedBy })`. If free, assigns lock and broadcasts `ticket_locked` to all connected clients. |
| `unlock_ticket` | `{ ticketId: number }` | *None* | **Requirement 3 (Release Protocol)**: Emitted when an editing agent clicks "Close" or "Cancel". Releases lock from server `Map` and broadcasts `ticket_unlocked` to all clients. |
| `save_ticket` | `{ ticketId: number, resolution: string }` | *None* | **Requirement 3 (Save Resolution)**: Saves ticket resolution, sets status to `resolved`, releases lock, and broadcasts `ticket_updated` and `ticket_unlocked`. |

#### Server → Client Events

| Event Name | Payload | Trigger Condition | UI Behavior |
| :--- | :--- | :--- | :--- |
| `lock_state_sync` | `[{ ticketId, agentName }]` | On `join_dashboard` emission | Hydrates all currently active locks for new browser sessions. |
| `ticket_locked` | `{ ticketId, agentName }` | Successful lock acquisition | **Locked UI**: Row turns gray, 🔒 padlock icon appears with `"Locked by [Agent Name]"`, Edit button strictly disabled for all other agents. |
| `ticket_unlocked` | `{ ticketId }` | Explicit unlock, save, or ghost disconnect | Re-enables row and Edit button for all connected agents. |
| `ticket_created` | `ticket` object | New ticket created via POST endpoint | Ticket instantly slides into all active dashboards without page refresh. |
| `ticket_updated` | `ticket` object | Resolution saved for ticket | Table row updates with resolution and status badge. |

---

### 3. The "Ghost" Disconnect Handler (Server-Side Concurrency)

* **Trigger**: `socket.on('disconnect')` event.
* **Mechanism**: When an agent closes their tab, loses Wi-Fi, or shuts their laptop lid without explicitly unlocking a ticket, the server automatically iterates through the in-memory `ticketLocks` `Map`. It removes all locks bound to that socket ID and emits `ticket_unlocked` for each released ticket.
* **User Impact**: Locked tickets automatically free up within ~1 second for all other agents in the building.

---

### 4. Graceful Degradation & Network Disconnects

* **Client Reconnection Warning**: Implemented in `ConnectionBanner.jsx`. Listens directly to native socket `connect` and `disconnect` events.
* **UI Behavior**: Displays a persistent red warning banner (`⚠️ Connection Lost: Reconnecting...`) when Wi-Fi or server connection drops, warning agents that edits will not be saved.

---

## 🛠️ Environment Configuration & Setup

### Environment Variables

#### Backend (`/backend/.env`):
```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```
*Note: In production (Render), set `CLIENT_ORIGIN` to your deployed Vercel URL (e.g. `https://your-app.vercel.app`). Multi-origin arrays supported.*

#### Frontend (`/frontend/.env`):
```env
VITE_BACKEND_URL=http://localhost:4000
```
*Note: In production (Vercel), set `VITE_BACKEND_URL` to your deployed Render URL (e.g. `https://your-app.onrender.com`).*

---

## 🚀 Running Locally

1. **Start the Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```
   *(Backend running on `http://localhost:4000`)*

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *(Frontend running on `http://localhost:5173`)*

3. **Dual-Window Verification**:
   - Open `http://localhost:5173` in Window 1 (Agent A).
   - Open `http://localhost:5173` in Incognito Window 2 (Agent B).
   - Click **Edit** in Window 1 → Notice Window 2 grays out, shows 🔒 `Locked by Agent A`, and disables Edit button.
   - Close Window 1's tab → Notice Window 2 unlocks the ticket within ~1 second.
