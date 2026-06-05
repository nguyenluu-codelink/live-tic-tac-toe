# Live Tic-Tac-Toe — Design Spec

**Date:** 2026-06-04
**Purpose:** Demo project for a tech talk on *"Live video and data exchange with WebSocket and WebRTC."* A mobile-first 3×3 tic-tac-toe web game where two players in a room play each other while seeing each other's live camera feed.

---

## 1. Goals & Non-Goals

### Goals
- Demonstrate a clean split of responsibilities between **WebSocket** (data exchange) and **WebRTC** (live video).
- Two players join one room, play tic-tac-toe, and see each other's live camera.
- Mobile-first UI matching the provided sketch.
- Run the whole stack (web, signaling server, TURN server) via `docker compose up`.

### Non-Goals (YAGNI)
- No user accounts, persistence, or database. All state is in-memory and session-scoped.
- No WebRTC DataChannel — game data flows over WebSocket, not P2P.
- No reconnect/resume: a disconnect ends the game (forfeit).
- No UI or end-to-end tests; only core server logic is tested.
- No spectators, chat, matchmaking, or more than 2 players per room.

---

## 2. Architecture

```
┌─────────────┐   WebSocket (Socket.IO)     ┌────────────────────┐
│  Web Client │◄───────────────────────────►│  NestJS Signaling   │
│ (P1, React) │   • lobby / room list       │  + Game Server      │
└──────┬──────┘   • WebRTC signaling relay   │  (authoritative)    │
       │          • game moves + state       └────────────────────┘
       │                                               ▲
       │  WebRTC (video only, P2P)                     │ WebSocket
       │  ┌────────────────────────┐                   ▼
       └─►│   coturn (STUN + TURN)  │◄───────────┌─────────────┐
          └────────────────────────┘             │  Web Client │
                  relay fallback                  │ (P2, React) │
                                                  └─────────────┘
```

### Transport responsibilities (the talk's thesis)
- **WebSocket (Socket.IO):**
  - Lobby and live room list.
  - WebRTC signaling relay (offer / answer / ICE candidates).
  - Game moves and authoritative board state.
- **WebRTC:** Live camera video only, peer-to-peer.
  - **coturn** provides STUN + TURN. ICE policy is normal: direct connection first, relay fallback only when needed.

### Game authority
The NestJS server is the single source of truth:
- Holds the board state.
- Validates every move (correct player, correct turn, target cell empty).
- Detects win and draw.
- Broadcasts the resulting state. Clients only render.

Roles: room creator = **Player 1 (X, moves first)**; joiner = **Player 2 (O)**.

---

## 3. Components & Repository Structure

```
live-tic-tac-toe/
├── docker-compose.yml          # orchestrates all 3 services
├── web/                        # React + Vite + Tailwind + ShadCN
│   ├── Dockerfile
│   └── src/
│       ├── stores/             # Zustand: socketStore, gameStore, mediaStore
│       ├── services/           # socket.ts (Socket.IO client), webrtc.ts (RTCPeerConnection)
│       ├── components/         # ShadCN-based UI + game board + video feeds
│       ├── screens/            # NameEntry, Lobby, Room/Game, Result
│       └── types/              # shared event/payload types (const-as-enum)
├── server/                     # NestJS + Socket.IO
│   ├── Dockerfile
│   └── src/
│       ├── lobby/              # room list management (in-memory Map)
│       ├── game/               # board state machine, win/draw logic (TDD'd)
│       ├── signaling/          # relays offer/answer/ICE within a room
│       └── gateway/            # single Socket.IO gateway wiring it together
└── coturn/
    └── turnserver.conf         # STUN + TURN config, static credentials
```

### Frontend state — Zustand
Three small stores keep concerns separated:
- `socketStore`: connection status, current screen, lobby room list.
- `gameStore`: board state, whose turn, result.
- `mediaStore`: local/remote media streams, camera permission status.

---

## 4. Data Flow & User Journey

1. **Connect & name.** Client loads, prompts for a display name (session-only), connects Socket.IO.
2. **Lobby.** Server sends the current room list. `room:created` / `room:removed` events broadcast to everyone in the lobby so lists stay live.
3. **Create / Join.** Player 1 creates a named room (becomes X). Player 2 joins (becomes O); the room leaves the available list.
4. **WebRTC handshake.** On join, the server tells both peers to begin. They exchange offer / answer / ICE candidates through Socket.IO; coturn supplies STUN/TURN; camera video flows peer-to-peer.
5. **Play.** A tapped cell sends `game:move { cell }`. Server validates, updates the board, and broadcasts `game:state`. Turn indicator updates ("Your Turn" / "Waiting").
6. **End.** Server detects win, draw, or forfeit (on disconnect) and broadcasts `game:over { result }`. Each client shows win / lose / draw, runs a 10-second countdown, then the room is destroyed and both players return to the lobby.

### Socket event sketch (illustrative, not final)
- Client → server: `lobby:list`, `room:create { name }`, `room:join { roomId }`, `room:leave`, `game:move { cell }`, `rtc:offer`, `rtc:answer`, `rtc:ice`.
- Server → client: `room:created`, `room:removed`, `room:joined { role, opponent }`, `game:state { board, turn }`, `game:over { result }`, `rtc:offer`, `rtc:answer`, `rtc:ice`, `error { code, message }`.

---

## 5. UI (mobile-first, per sketch)

- **Top bar:** hamburger menu + avatar.
- **Header:** "Online Tic-Tac-Toe" title; two player status rows (name, symbol, turn state).
- **75% — board:** 3×3 grid; tappable cells render X/O; disabled when it is not your turn.
- **25% — video feeds:** two side-by-side tiles (you + opponent) with a "Live" badge.
- **ShadCN components:** `Button`, `Dialog` + `Input` (name entry / create room), `Card` (room list rows).

---

## 6. Error Handling

- **Invalid move:** server rejects; no state change; client may show a brief hint.
- **Join a full or stale room:** server returns an `error`; client shows a friendly toast and refreshes the list.
- **Camera permission denied (`getUserMedia`):** game remains fully playable; the video tile shows a placeholder.
- **ICE / connection failure:** video tile shows a status message; the game (WebSocket) is unaffected.
- **Disconnect mid-game:** server declares the remaining player the winner, broadcasts `game:over`, runs the 10s countdown, destroys the room.

---

## 7. Testing (core logic only, TDD)

Tested on the server with TDD:
- **Game state machine:** move validation (correct player, correct turn, empty cell), win detection across all 8 lines, draw detection, turn enforcement.
- **Room lifecycle:** create, join, full-room rejection, forfeit-on-disconnect, cleanup.

Not tested: UI components, signaling relay wiring, end-to-end flows (verified manually).

---

## 8. Deployment

- `docker compose up` starts three services: `web` (Vite preview/static), `server` (NestJS), `coturn`.
- coturn exposes STUN/TURN ports with static credentials configured in `coturn/turnserver.conf`.
- The web client reads the signaling server URL and ICE server config from environment variables.
