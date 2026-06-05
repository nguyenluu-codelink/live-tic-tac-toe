# Live Tic-Tac-Toe

A mobile-first **3×3 tic-tac-toe** game where two players in the same room play head-to-head **with live camera between them**. Built as a demo for the tech talk _"Live video and data exchange with WebSocket and WebRTC."_

The whole point of the demo is to show the division of labour between the two technologies:

- **WebSocket (Socket.IO)** carries everything that needs a server: the lobby/room list, the WebRTC signaling relay (offer/answer/ICE), and the authoritative game state (moves + win/draw).
- **WebRTC** carries the **live video** directly peer-to-peer between the two players — it never touches the server.

## Architecture

```
                  ┌──────────────────────────┐
   Player 1  ◄───►│  Signaling + Game server │◄───►  Player 2
   (browser)      │   NestJS + Socket.IO      │      (browser)
       ▲          └──────────────────────────┘          ▲
       │            WebSocket: lobby, signaling,         │
       │            authoritative game state             │
       │                                                 │
       └───────────────  WebRTC (video, P2P)  ───────────┘
                                │
                        ┌───────────────┐
                        │    coturn      │  STUN/TURN for NAT traversal
                        │  STUN + TURN   │  (relay fallback)
                        └───────────────┘
```

Three pieces, wired together by `docker-compose.yml`:

| Piece | Stack | Role |
|-------|-------|------|
| `web/` | React + Vite + Tailwind + shadcn/ui | The game client (served by nginx in production) |
| `server/` | NestJS + Socket.IO | Signaling WebSocket + authoritative game logic |
| `coturn/` | coturn 4.6 | STUN/TURN server for WebRTC NAT traversal |

## How a match flows

1. Player 1 opens the web app, enters a name, and lands on the lobby (an empty room list) with a "create room" button.
2. Player 2 opens the web app and sees Player 1's room in the list. They click to join.
3. On join, the server pairs the two players and emits `rtc:start`; the browsers run the WebRTC offer/answer/ICE handshake (relayed over the socket) to establish the P2P video link.
4. The players play. Every move goes to the server, which validates it and broadcasts the authoritative board state to both clients.
5. On win/draw the result overlay shows, then the room closes and both players return to the lobby after ~10s.

The local camera self-preview starts the moment you enter a room — before the opponent arrives — so you can confirm your camera works while you wait.

## Tech stack

- **Client:** React 18, Vite 5, TypeScript, Tailwind CSS 3, shadcn/ui (Radix), Zustand (state), `socket.io-client`, Sonner (toasts)
- **Server:** NestJS 10, `@nestjs/websockets` + `@nestjs/platform-socket.io`, Socket.IO 4
- **Media infra:** coturn 4.6 (STUN + long-term-credential TURN)
- **Orchestration:** Docker + Docker Compose; nginx serves the built client and reverse-proxies `/socket.io/`

## Project structure

```
.
├── docker-compose.yml      # Orchestrates web + server + coturn
├── .env.example            # Config template — copy to .env
├── coturn/
│   └── turnserver.conf      # Static STUN/TURN policy (creds/IP injected at runtime)
├── server/                 # NestJS signaling + game server
│   └── src/
│       ├── gateway/         # Socket.IO gateway + event-name contract
│       ├── game/            # Pure game logic (tested) + types
│       └── room/            # Room/lobby service (tested) + types
└── web/                    # React client
    ├── nginx.conf           # SPA serving + /socket.io reverse proxy
    └── src/
        ├── screens/         # NameEntry, Lobby, Game
        ├── components/      # Board, VideoFeeds, overlays, ui/ (shadcn)
        ├── services/        # socket.ts (signaling) + webrtc.ts (peer/media)
        ├── stores/          # Zustand: socket, game, media
        └── lib/             # env.ts (config) + helpers
```

## Prerequisites

- Docker + Docker Compose
- (For local dev only) Node.js 20+

## Quick start (localhost, two browser tabs)

```bash
# 1. Create your config from the template
cp .env.example .env

# 2. Build and start all three services
docker compose up -d --build

# 3. Open the app in TWO tabs and play yourself
#    http://localhost:8080
```

On `localhost` the browser treats the page as a secure context, so the camera works in both tabs. Create a room in one tab, join it from the other.

## Configuration

The root **`.env`** is the single source of truth for everything that varies by deployment. `.env.example` is the committed template; copy it to `.env`. Docker Compose reads `.env` and fans each value out to the service that needs it.

| `.env` key | Default | Used for |
|------------|---------|----------|
| `PUBLIC_HOST` | `localhost` | Host/IP browsers use for STUN/TURN (set to your LAN IP for phones) |
| `WEB_PORT` | `8080` | Port the web client is published on |
| `TURN_USERNAME` | `demo` | TURN credential — injected into **both** coturn and the web build |
| `TURN_PASSWORD` | `demo-secret` | TURN credential (same) |
| `COTURN_EXTERNAL_IP` | `127.0.0.1` | IP coturn advertises for relayed candidates (must be the IP form of `PUBLIC_HOST`) |

> **`VITE_*` are baked at build time.** Vite inlines env vars when the image is built, so after changing `.env` you must rebuild the client: `docker compose build web && docker compose up -d`.

Two config values intentionally do **not** live in `.env`, because they are structural, not per-deployment:

- **`VITE_SOCKET_URL`** is hardcoded to `""` (empty) in `docker-compose.yml`. Empty means **same-origin**: nginx reverse-proxies `/socket.io/` to the server, so the client connects to the socket on whatever origin served the page. This avoids mixed-content errors (an HTTPS page cannot open `ws://`) and means a tunnel URL never has to be baked into the build.
- **Internal ports** — the server's `3001`, coturn's `3478`, and the relay range `49160-49200` — are fixed in `docker-compose.yml` / `coturn/turnserver.conf`.

## Running on two phones over the same Wi-Fi (LAN)

1. Find your laptop's LAN IP (e.g. `192.168.1.63`) and set **both** of these in `.env`:
   ```bash
   PUBLIC_HOST=192.168.1.63
   COTURN_EXTERNAL_IP=192.168.1.63
   ```
2. Rebuild and start:
   ```bash
   docker compose up -d --build
   ```
3. On each phone (same Wi-Fi), browse to `http://192.168.1.63:8080`.

> ⚠️ **Camera caveat:** Mobile Safari/Chrome **block `getUserMedia` on a plain-http, non-localhost origin.** Over a LAN IP without HTTPS the game still works (lobby, moves, signaling), but the camera will show "Camera blocked." To get the camera on phones you need a secure context — see the tunnel section below.

## Running across networks / on phones with camera (HTTPS via tunnel)

Because the camera needs HTTPS off `localhost`, the simplest way to demo on real phones is to expose the app through an HTTPS tunnel (ngrok, Cloudflare Tunnel, …). Thanks to the same-origin design you only need **one** tunnel and **no rebuild** when the URL changes.

```bash
# With the stack already running on :8080
ngrok http 8080
```

Open the printed `https://<random>.ngrok-free.app` URL on both phones. The page + signaling ride the HTTPS tunnel (so the camera is unlocked); if both phones are on the same Wi-Fi as the laptop, the WebRTC **video still flows directly P2P over the LAN** — a nice illustration of the WebSocket-vs-WebRTC split.

For two phones on genuinely different networks, you also need a publicly reachable STUN/TURN server (point `PUBLIC_HOST`/`COTURN_EXTERNAL_IP` at a public IP, or swap in a hosted TURN provider). Note that any TURN credential baked into the web build is readable by anyone with the site URL, so use short-lived or capped credentials in that case.

## Local development (without Docker)

Run the two apps directly for fast iteration:

```bash
# Terminal 1 — signaling/game server (http://localhost:3001)
cd server && npm install && npm run start:dev

# Terminal 2 — web client (http://localhost:5173)
cd web && npm install && npm run dev
```

In dev the client defaults to `http://localhost:3001` for the socket. STUN/TURN come from the Vite env (unset = no ICE servers, which is fine for same-machine testing).

## Tests, build & lint

```bash
# Server unit tests (game logic + room service)
cd server && npm test

# Client
cd web && npm test       # vitest
cd web && npm run build  # type-check + production build
cd web && npm run lint   # eslint
```

## Socket event contract

Event names are defined once on the server in `server/src/gateway/events.constants.ts` and mirrored on the client. Summary:

| Group | Events |
|-------|--------|
| Lobby / rooms | `lobby:list`, `room:create`, `room:join`, `room:leave`, `room:created`, `room:removed`, `room:joined`, `room:closed` |
| Game | `game:move`, `game:state`, `game:over` |
| WebRTC signaling | `rtc:start`, `rtc:offer`, `rtc:answer`, `rtc:ice` |
| Errors | `error` |

## Known limitations (by design / demo scope)

- **HTTPS is out of scope** in the stack itself — secure context for phones is provided externally via a tunnel.
- **Video only** — no audio track (avoids echo when both peers run on one machine during a demo).
- **In-memory rooms** — the server keeps room/game state in memory; restarting it clears all rooms.
- **One match per room**, two players; the room closes after the result.
