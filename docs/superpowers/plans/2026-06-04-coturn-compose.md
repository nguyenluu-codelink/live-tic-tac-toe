# coturn + docker-compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coturn STUN/TURN server and a root `docker-compose.yml` that builds and runs all three services (web, signaling server, coturn) with a single `docker compose up`.

**Architecture:** A root `.env` is the single source of truth for host-facing config (public host, ports, TURN credentials, coturn's external IP). `docker-compose.yml` injects those values into the **web** image as Vite build args (Vite inlines `VITE_*` at build time), into the **server** as runtime env, and into **coturn** via command-line overrides on top of a static `coturn/turnserver.conf`. Only browsers talk to coturn — the server and web never do — so coturn just needs published ports reachable from the clients.

**Tech Stack:** Docker, docker-compose v2, coturn (`coturn/coturn` image), nginx (existing web image), Node 20 (existing server image).

---

## Context the engineer needs (pinned)

This plan glues together two already-built, verified subsystems. **Do not modify `web/` or `server/` source.** Only the existing Dockerfiles are relied upon (they already exist and build).

**What the web client expects (build-time env — already wired in `web/Dockerfile` as ARG+ENV):**
- `VITE_SOCKET_URL` — Socket.IO server URL the browser connects to. Default in code: `http://localhost:3001`.
- `VITE_STUN_URL` — added to ICE servers when set (e.g. `stun:HOST:3478`).
- `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` — TURN relay; added to ICE servers **only when all three are set** (see `web/src/lib/env.ts`).
- These are inlined at **build** time. Changing them requires a **rebuild** (`docker compose build web`), not just a restart.

**What the server expects (runtime env — see `server/src/main.ts`):**
- `PORT` — listen port, defaults to `3001`. Gateway CORS is already `origin: '*'`.

**Existing Dockerfiles (do not change):**
- `web/Dockerfile`: multi-stage; declares `ARG VITE_SOCKET_URL VITE_STUN_URL VITE_TURN_URL VITE_TURN_USERNAME VITE_TURN_CREDENTIAL`, builds, serves static bundle via nginx on port **80**.
- `server/Dockerfile`: multi-stage; runs `node dist/main.js`, exposes **3001**.

**Single-source-of-truth decision (note vs. spec wording):** The spec §8 says "static credentials configured in `coturn/turnserver.conf`." Because the conf file cannot read environment variables and the **same** credentials must also be baked into the web build, putting them in the conf would force duplication. Instead the credentials live once in the root `.env` and compose injects them into both coturn (via `--user=`) and the web build (via build args). `turnserver.conf` holds only non-secret static **policy**. This is a deliberate DRY choice; it keeps the credentials static, just defined in one place.

**Known browser constraint (must be surfaced, not worked around):** `getUserMedia` (camera) only works in a **secure context** — that means HTTPS **or** `localhost`. The default localhost demo (two browser tabs on the presenter's machine) works because both origins are `localhost`. If `PUBLIC_HOST` is set to a LAN IP so phones can connect over plain `http://`, browsers will **block the camera** on those non-localhost origins. Serving over HTTPS is out of scope for this plan (YAGNI per spec); the localhost path is the supported demo. This caveat is documented in `.env.example` so the demo does not fail silently.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `.env.example` (root, **create**) | Documented template of every compose-level variable, with localhost-safe defaults. Copied to `.env` by the operator. |
| `coturn/turnserver.conf` (**create**) | Static, non-secret STUN/TURN **policy**: listening port, relay port range, credential mechanism, realm, logging. No secrets, no IP. |
| `docker-compose.yml` (root, **create**) | Orchestrates the three services; wires `.env` values into each as build args / runtime env / command overrides; publishes ports. |

No source files in `web/` or `server/` are created or modified.

---

### Task 1: Root `.env.example` (single source of truth)

**Files:**
- Create: `.env.example` (repo root)

- [ ] **Step 1: Write the env template**

Create `.env.example`:

```dotenv
# Host or IP that BROWSERS use to reach the stack.
# - "localhost" works for a same-machine demo (two browser tabs) — camera works.
# - For phones on the LAN, set this to the host's LAN IP (e.g. 192.168.1.50).
#   WARNING: browsers block camera access (getUserMedia) over plain http on
#   non-localhost origins, so video will not work over a LAN IP without HTTPS.
PUBLIC_HOST=localhost

# Port the web client is published on. Browse to http://${PUBLIC_HOST}:${WEB_PORT}
WEB_PORT=8080

# Static TURN credentials. Injected into BOTH coturn and the web build from here,
# so this file is the single source of truth — do not also hardcode them elsewhere.
TURN_USERNAME=demo
TURN_PASSWORD=demo-secret

# Public IP that coturn advertises for relayed (TURN) candidates.
# - 127.0.0.1 for a localhost demo.
# - Set to the host's LAN/public IP for cross-network relay.
COTURN_EXTERNAL_IP=127.0.0.1
```

- [ ] **Step 2: Verify the file is complete and parseable**

Run: `set -a && . ./.env.example && set +a && echo "$PUBLIC_HOST $WEB_PORT $TURN_USERNAME $TURN_PASSWORD $COTURN_EXTERNAL_IP"`
Expected output: `localhost 8080 demo demo-secret 127.0.0.1`

---

### Task 2: `coturn/turnserver.conf` (static policy)

**Files:**
- Create: `coturn/turnserver.conf`

- [ ] **Step 1: Write the coturn config**

Create `coturn/turnserver.conf`:

```conf
# turnserver.conf — STUN + TURN policy for the live tic-tac-toe demo.
# Non-secret, static policy only. Credentials and external IP are supplied at
# runtime by docker-compose (from the root .env) via command-line overrides.

# Standard STUN/TURN listening port (served on both UDP and TCP)
listening-port=3478

# Relay port range — kept small so docker-compose can publish it explicitly
min-port=49160
max-port=49200

# Long-term credential mechanism; the actual user is injected via --user
lt-cred-mech
realm=live-ttt

# Browser WebRTC stacks expect message fingerprints
fingerprint

# No TLS/DTLS for the demo (plain STUN/TURN); add certificates for production
no-tls
no-dtls

# Disable the admin CLI and log to stdout so `docker compose logs coturn` shows activity
no-cli
log-file=stdout
verbose
```

- [ ] **Step 2: Verify coturn accepts the config**

Run (this starts coturn in the foreground with the config; watch the first lines, then stop with Ctrl-C):
`docker run --rm -v "$(pwd)/coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro" coturn/coturn:4.6 -c /etc/coturn/turnserver.conf --external-ip=127.0.0.1 --user=demo:demo-secret -v`

Expected: log lines containing `Config file found: /etc/coturn/turnserver.conf`, a `realm: live-ttt` line, `Relay ... port range: 49160 ... 49200`, and listener lines for UDP/TCP on `3478`. No `CONFIG ERROR`. Stop with Ctrl-C.

If the image tag `coturn/coturn:4.6` cannot be pulled, retry with `coturn/coturn:latest` and use the same tag in Task 3.

---

### Task 3: `docker-compose.yml` (orchestration)

**Files:**
- Create: `docker-compose.yml` (repo root)

- [ ] **Step 1: Write the compose file**

Create `docker-compose.yml`:

```yaml
# docker-compose.yml — orchestrates the web client, signaling server, and TURN server.
# Configure by copying .env.example to .env. Defaults target a localhost demo.

services:
  # NestJS + Socket.IO signaling and authoritative game server
  server:
    build:
      context: ./server
    image: live-ttt-server
    environment:
      PORT: "3001"
    ports:
      - "3001:3001"
    restart: unless-stopped

  # React/Vite static client served by nginx; VITE_* are inlined at build time
  web:
    build:
      context: ./web
      args:
        VITE_SOCKET_URL: "http://${PUBLIC_HOST}:3001"
        VITE_STUN_URL: "stun:${PUBLIC_HOST}:3478"
        VITE_TURN_URL: "turn:${PUBLIC_HOST}:3478"
        VITE_TURN_USERNAME: "${TURN_USERNAME}"
        VITE_TURN_CREDENTIAL: "${TURN_PASSWORD}"
    image: live-ttt-web
    ports:
      - "${WEB_PORT}:80"
    depends_on:
      - server
    restart: unless-stopped

  # coturn STUN/TURN; credentials and external IP injected from .env at runtime
  coturn:
    image: coturn/coturn:4.6
    command:
      - "-c"
      - "/etc/coturn/turnserver.conf"
      - "--external-ip=${COTURN_EXTERNAL_IP}"
      - "--user=${TURN_USERNAME}:${TURN_PASSWORD}"
      - "-v"
    volumes:
      - "./coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro"
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
      - "49160-49200:49160-49200/udp"
    restart: unless-stopped
```

- [ ] **Step 2: Prepare the env file**

Run: `cp -n .env.example .env`
Expected: a `.env` exists at the repo root (no output on success; `-n` won't clobber an existing one).

- [ ] **Step 3: Verify compose parses and interpolates correctly**

Run: `docker compose config`
Expected: exit code 0 and resolved output showing the interpolated values — e.g. under `web.build.args`: `VITE_SOCKET_URL: http://localhost:3001`, `VITE_STUN_URL: stun:localhost:3478`, `VITE_TURN_URL: turn:localhost:3478`, `VITE_TURN_USERNAME: demo`, `VITE_TURN_CREDENTIAL: demo-secret`; the `coturn` command list containing `--external-ip=127.0.0.1` and `--user=demo:demo-secret`; the `web` port mapping `8080:80`. No `variable is not set` warnings.

- [ ] **Step 4: Verify the images build**

Run: `docker compose build`
Expected: `server` and `web` images build successfully (the web build logs show `npm run build` / `vite build` completing). coturn is a pulled image, not built. Exit code 0.

---

### Task 4: Full-stack manual smoke test

This is the integration verification. No automated tests exist for infra (consistent with spec §7: core server logic only). Run these checks and record the result.

- [ ] **Step 1: Bring the stack up**

Run: `docker compose up -d`
Expected: `server`, `web`, and `coturn` containers reach a running state. Check with `docker compose ps` (all `running`/`Up`).

- [ ] **Step 2: Verify coturn is listening**

Run: `docker compose logs coturn | grep -iE "listener|relay|realm"`
Expected: listener lines for UDP/TCP `3478`, the `49160..49200` relay range, and `realm: live-ttt`. No `CONFIG ERROR`.

- [ ] **Step 3: Verify the web client and game sync (two tabs)**

- Open `http://localhost:8080` in two browser tabs (both are `localhost`, so the camera is allowed).
- Tab A: enter a name → should land in the lobby (connected).
- Tab A: create a room → it appears in the lobby.
- Tab B: enter a name → see the room → join it.
- Both tabs land on the game screen; the camera permission prompt appears (allow it).
- Play a few moves: the board state stays in sync across both tabs (server-authoritative), and turn indicators alternate correctly.
- Expected: synced board, working turn gating, both local camera tiles show video. (On localhost both peers connect via host candidates; coturn is wired and reachable but is not the active path for a same-host demo — that is expected.)

- [ ] **Step 4: Verify game-over flow**

- Win, lose, or draw the game (or close one tab to trigger a forfeit).
- Expected: the result overlay shows on both clients with a 10-second countdown, then both return to the lobby.

- [ ] **Step 5: Tear down**

Run: `docker compose down`
Expected: all three containers stop and are removed.

- [ ] **Step 6: Record the smoke-test result**

Note the outcome (pass/fail per step). If any step fails, that is a real defect to fix before considering the plan complete — do not mark complete on a failing smoke test.

---

## Self-Review

**1. Spec coverage (§8 Deployment):**
- "`docker compose up` starts three services (web, server, coturn)" → Task 3 + Task 4. ✅
- "coturn exposes STUN/TURN ports with static credentials" → Task 2 (ports/policy) + Task 1/3 (static credentials via `.env` → `--user`). ✅ (Deviation from "in turnserver.conf" is documented and deliberate for DRY.)
- "web client reads signaling URL and ICE config from environment variables" → Task 3 build args map to the exact `VITE_*` names the code reads (verified against `web/src/lib/env.ts` and `web/Dockerfile`). ✅
- Architecture §2 (coturn = STUN + TURN, relay fallback) → coturn config provides both; ICE policy left at browser default (direct first, relay fallback). ✅

**2. Placeholder scan:** No TBD/TODO/"handle later". Every file has complete content; every verify step has a concrete command and expected output. ✅

**3. Consistency check:**
- Credential names line up everywhere: `.env` `TURN_USERNAME`/`TURN_PASSWORD` → compose `--user=${TURN_USERNAME}:${TURN_PASSWORD}` and `VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL` build args → `web/src/lib/env.ts` reads `VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL`. ✅
- Ports consistent: server `3001` (matches `main.ts` default and `server/Dockerfile` EXPOSE); web container `80` (matches `web/Dockerfile`) published on `WEB_PORT`; coturn `3478` + relay `49160-49200` consistent between `turnserver.conf` and compose port maps. ✅
- `VITE_*` arg names match `web/Dockerfile`'s declared `ARG`s exactly. ✅

---

## Notes for the executor

- **No git/commit steps** are included in this plan. Do not run any git commands.
- **Do not edit `web/` or `server/` source** — this plan is pure orchestration/config.
- If `docker compose config` reports unset variables, the `.env` was not created (Task 3 Step 2) — create it before building.
