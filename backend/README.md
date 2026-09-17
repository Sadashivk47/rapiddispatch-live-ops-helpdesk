# RapidDispatch Live Ops — Backend (Track B)

Real-time ticket locking server built with **Node.js**, **Express**, and **Socket.io**.

---

## 📡 Backend APIs & Event Reference

### 1. REST Endpoints (HTTP / Express)

* **`GET /api/tickets`**
  * **Description**: Returns initial ticket list.
  * **Response**: `[ { id: number, title: string, status: string, resolution: string } ]`
  * **Usage**: Called once by client on mount to populate the board without periodic polling.

* **`POST /api/tickets`**
  * **Description**: Creates a new ticket.
  * **Request Body**: `{ "title": "Truck #204 breakdown - I-35" }`
  * **Response**: `{ id: 4, title: "...", status: "open", resolution: "" }`
  * **Side Effect**: Broadcasts `ticket_created` event over Socket.io to all connected clients.

---

### 2. Socket.io Event APIs

| Event Name | Direction | Payload | Description & Concurrency Logic |
| :--- | :--- | :--- | :--- |
| `join_dashboard` | Client → Server | *None* | Subscribes socket to `dashboard` room and returns `lock_state_sync` with active locks. |
| `lock_ticket` | Client → Server | `{ ticketId, agentName }` | Checks in-memory `ticketLocks` Map. Returns `ack({ success: false, lockedBy })` if locked by another socket; locks & emits `ticket_locked` if free. |
| `unlock_ticket` | Client → Server | `{ ticketId }` | Releases ticket lock from Map (if held by caller) and emits `ticket_unlocked`. |
| `save_ticket` | Client → Server | `{ ticketId, resolution }` | Updates ticket status/resolution, releases lock, and emits `ticket_updated` and `ticket_unlocked`. |
| `disconnect` | Internal Event | *None* | **Ghost Disconnect Handler**: Scans `ticketLocks` Map, unlocks any tickets held by `socket.id`, and emits `ticket_unlocked` for each. |

---

## 🔒 In-Memory State & Concurrency Control

Ticket locking state is tracked in Node.js memory via a JavaScript `Map`:
```js
const ticketLocks = new Map(); // Map<ticketId, { socketId, agentName }>
```
Since locking does not touch a database, lock acquisition latency is under **1ms**, eliminating race condition windows.

---

## ⚙️ Environment Variables & CORS

Create a `.env` file in the `backend` folder:
```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

- `PORT`: HTTP and WebSocket server port (defaults to 4000).
- `CLIENT_ORIGIN`: Permitted client domain(s) for CORS. Can be set to a single URL, comma-separated URLs, or `*`.

---

## 🚀 Running Locally
```bash
npm install
npm start
```
Server will start listening at `http://localhost:4000`.
