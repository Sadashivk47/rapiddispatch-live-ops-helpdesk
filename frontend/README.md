# RapidDispatch Live Ops Helpdesk — Frontend (Track A)

Real-time reactive ticket dashboard built with **React**, **Vite**, and **Socket.io-client**.

---

## 📡 Frontend Data Flow & Socket Event Integration

The frontend operates with zero database polling, relying on Socket.io event-driven synchronization:

1. **Initial Hydration**: Performs a single `GET /api/tickets` REST fetch when mounted.
2. **Dashboard Room Join**: Emits `join_dashboard` over Socket.io upon connection to sync active lock states.
3. **Lock Ticket**: Emits `lock_ticket` with acknowledgment callback `ack({ success, lockedBy })`.
   - UI strictly waits for `ack.success` before displaying the modal editor.
4. **Presence & Locked UI (Requirement 2)**:
   - When another agent locks a ticket, row background updates, a 🔒 padlock icon appears with `"Locked by [Agent Name]"`, and the Edit button becomes disabled.
5. **Unlock / Save Ticket (Requirement 3)**:
   - Emits `unlock_ticket` when closing editor without saving.
   - Emits `save_ticket` when saving resolution.
6. **Graceful Disconnect Banner**:
   - `ConnectionBanner.jsx` monitors socket connection status (`connect` and `disconnect` events) to display a persistent red warning bar (`⚠️ Connection Lost: Reconnecting...`) when Wi-Fi or server connection drops.

---

## ⚙️ Environment Variables

Create `.env` in the `frontend` root:
```env
VITE_BACKEND_URL=http://localhost:4000
```

- For local development: `VITE_BACKEND_URL=http://localhost:4000`
- For production: Set `VITE_BACKEND_URL` in Vercel to your deployed Render URL (e.g. `https://rapiddispatch-backend.onrender.com`).

---

## 🚀 Running Locally

```bash
npm install
npm run dev
```

The application will start at `http://localhost:5173`.
