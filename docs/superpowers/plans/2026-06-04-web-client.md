# Web Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile-first React web client that connects to the NestJS signaling server over Socket.IO, plays server-authoritative tic-tac-toe, and shows a live peer-to-peer camera feed via WebRTC.

**Architecture:** A single-page, state-driven app (no router). Three Zustand stores (`socketStore`, `gameStore`, `mediaStore`) hold all state. Two service modules own side effects: `socket.ts` (Socket.IO connection + event handlers + emit helpers) and `webrtc.ts` (RTCPeerConnection lifecycle + getUserMedia). Screens are selected by a `screen` value in `socketStore`; the result is an overlay inside the game screen. Only pure view-logic is unit-tested (per the design spec's core-logic-only testing decision); UI is verified by build + manual check.

**Tech Stack:** React 18, Vite 5, TypeScript, Tailwind CSS v3, ShadCN UI components (Button, Input, Card, Dialog) + sonner toasts, Zustand, socket.io-client, native WebRTC APIs. Vitest for the pure-logic tests.

---

## Server Contract (source of truth — do not change the server)

The server is already built and tested. The client MUST match these event names and payloads exactly.

**Event names** (`web/src/types/events.ts` mirrors the server's `EVENT` map):

| Constant | String | Direction | Payload |
|---|---|---|---|
| `LOBBY_LIST` | `lobby:list` | C→S request / S→C reply | request: none · reply: `RoomSummary[]` |
| `ROOM_CREATE` | `room:create` | C→S | `{ name: string; playerName: string }` |
| `ROOM_JOIN` | `room:join` | C→S | `{ roomId: string; playerName: string }` |
| `ROOM_LEAVE` | `room:leave` | C→S | none |
| `ROOM_CREATED` | `room:created` | S→C (broadcast) | `{ id: string; name: string; hostName: string }` |
| `ROOM_REMOVED` | `room:removed` | S→C (broadcast) | `{ id: string }` |
| `ROOM_JOINED` | `room:joined` | S→C (to that client) | `{ roomId: string; symbol: 'X' \| 'O' }` |
| `ROOM_CLOSED` | `room:closed` | S→C | `{ id: string }` |
| `GAME_MOVE` | `game:move` | C→S | `{ cell: number }` |
| `GAME_STATE` | `game:state` | S→C | `{ board: (('X'\|'O')\|null)[]; turn: 'X'\|'O'; result: GameResult }` |
| `GAME_OVER` | `game:over` | S→C | `{ result: GameResult }` |
| `RTC_START` | `rtc:start` | S→C | `{ initiator: boolean; opponentName: string }` |
| `RTC_OFFER` | `rtc:offer` | both (opaque relay) | `RTCSessionDescriptionInit` |
| `RTC_ANSWER` | `rtc:answer` | both (opaque relay) | `RTCSessionDescriptionInit` |
| `RTC_ICE` | `rtc:ice` | both (opaque relay) | `RTCIceCandidateInit` |
| `ERROR` | `error` | S→C | `{ code: string }` |

**`GameResult`** ∈ `IN_PROGRESS | X_WINS | O_WINS | DRAW | OPPONENT_LEFT`.

**Critical contract notes (carried from the server's final review):**
- `room:joined` carries **no opponent name**. The opponent name arrives in `rtc:start`.
- Gate moves on `result === IN_PROGRESS`, **not** on `turn` — in terminal states `turn` holds the last mover.
- `room:created` broadcasts to ALL clients, **including the creator**. The creator transitions to the room via `room:joined`; the broadcast only matters to other clients still in the lobby.
- `room:closed` may arrive more than once — handle it **idempotently**.
- The player who clicks Leave (`room:leave`) does **not** receive `room:closed`; that client must navigate back to the lobby proactively.
- Exactly one peer gets `initiator: true`; that peer creates the WebRTC offer. No glare handling needed.
- Server default port is **3001**.

---

## File Structure

```
web/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── components.json
├── eslint.config.js
├── .gitignore
├── .dockerignore
├── .env.example
├── Dockerfile
├── nginx.conf
└── src/
    ├── main.tsx                 # React entry, mounts App + Toaster
    ├── App.tsx                  # screen switch (NAME / LOBBY / GAME)
    ├── index.css                # Tailwind layers + ShadCN theme vars
    ├── vite-env.d.ts
    ├── types/
    │   └── events.ts            # EVENT map + payload types (mirror server)
    ├── lib/
    │   ├── utils.ts             # cn() class-merge helper (ShadCN)
    │   ├── env.ts               # VITE_ env reads + ICE server config
    │   ├── game-view.ts         # PURE view logic (TDD'd)
    │   └── game-view.test.ts
    ├── stores/
    │   ├── socketStore.ts       # socket instance, screen, identity, lobby, error
    │   ├── gameStore.ts         # board, turn, result
    │   └── mediaStore.ts        # local/remote streams, camera + rtc status
    ├── services/
    │   ├── socket.ts            # connect, event handlers, emit helpers
    │   └── webrtc.ts            # RTCPeerConnection lifecycle + getUserMedia
    ├── components/
    │   ├── ui/                  # ShadCN primitives (button, input, card, dialog)
    │   │   ├── button.tsx
    │   │   ├── input.tsx
    │   │   ├── card.tsx
    │   │   └── dialog.tsx
    │   ├── TopBar.tsx
    │   ├── PlayerStatus.tsx
    │   ├── GameBoard.tsx
    │   ├── VideoFeeds.tsx
    │   └── ResultOverlay.tsx
    └── screens/
        ├── NameEntryScreen.tsx
        ├── LobbyScreen.tsx
        └── GameScreen.tsx
```

> **Comment rules (from CLAUDE.md) apply to all generated code:** every function gets `/** {do something} for {reason} */`; every type/component gets `/** {definition}, {do something} for {reason} */`; non-trivial code blocks get `// {do something} for {reason}`. Use `type` not `interface`, `const` by default, arrow functions, and const-as-enum. Do not disable any eslint rule.

---

### Task 1: Project scaffold, dependencies, and build configs

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.node.json`
- Create: `web/eslint.config.js`
- Create: `web/index.html`
- Create: `web/.gitignore`
- Create: `web/.dockerignore`
- Create: `web/.env.example`
- Create: `web/src/vite-env.d.ts`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "live-tic-tac-toe-web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.7.5",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.5.4",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "@types/node": "^20.16.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.13.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.14",
    "globals": "^15.11.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.11.0",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `web/vite.config.ts`**

```ts
// Configure Vite with React + the "@" alias for ShadCN-style imports
// Import defineConfig from vitest/config so the `test` field is typed
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Vite + Vitest config, wiring the @ alias and the node test environment for pure-logic tests */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Map "@" to src so imports match ShadCN conventions
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // Use the node environment because only pure logic is tested (no DOM)
    environment: 'node',
  },
});
```

- [ ] **Step 3: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "composite": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `web/eslint.config.js`**

```js
// Flat ESLint config for the React + TS client (no rules disabled)
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/** Standard Vite React-TS lint setup, for catching errors without disabling rules */
export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
```

- [ ] **Step 6: Create `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- Mobile-first viewport for the phone-sized layout -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Online Tic-Tac-Toe</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 8: Create `web/.gitignore`**

```
node_modules
dist
.env
*.local
```

- [ ] **Step 9: Create `web/.dockerignore`**

```
node_modules
dist
.env
```

- [ ] **Step 10: Create `web/.env.example`**

```
# Signaling server URL (Socket.IO)
VITE_SOCKET_URL=http://localhost:3001
# STUN server for WebRTC NAT discovery
VITE_STUN_URL=stun:stun.l.google.com:19302
# TURN relay (filled in by Plan 3 / docker-compose; leave blank for LAN dev)
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

- [ ] **Step 11: Install dependencies and verify the toolchain**

Run: `cd web && npm install`
Expected: dependencies install with no error.

Run: `cd web && npx tsc -b`
Expected: completes with no output (no source files yet to fail).

---

### Task 2: Tailwind, global theme, and the `cn` utility

**Files:**
- Create: `web/tailwind.config.js`
- Create: `web/postcss.config.js`
- Create: `web/components.json`
- Create: `web/src/index.css`
- Create: `web/src/lib/utils.ts`

- [ ] **Step 1: Create `web/tailwind.config.js`**

```js
// Tailwind v3 config with the ShadCN design tokens, for consistent theming
// Import the animate plugin (require is unavailable in this ESM config under "type":"module")
import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
```

- [ ] **Step 2: Create `web/postcss.config.js`**

```js
// PostCSS pipeline running Tailwind + autoprefixer, for browser-ready CSS
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Create `web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 4: Create `web/src/index.css`**

```css
/* Tailwind layers plus ShadCN slate theme tokens, for the app's base styling */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    /* Lock the app to the viewport height for a mobile app feel */
    @apply h-screen overflow-hidden;
  }

  #root {
    @apply h-full;
  }
}
```

- [ ] **Step 5: Create `web/src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names while de-duplicating Tailwind classes, for clean component styling */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
```

- [ ] **Step 6: Verify build still compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 3: ShadCN UI primitives

**Files:**
- Create: `web/src/components/ui/button.tsx`
- Create: `web/src/components/ui/input.tsx`
- Create: `web/src/components/ui/card.tsx`
- Create: `web/src/components/ui/dialog.tsx`

> These are the standard ShadCN component sources (we own the code, per ShadCN's copy-in philosophy), trimmed to what this app uses.

- [ ] **Step 1: Create `web/src/components/ui/button.tsx`**

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Button style variants, centralizing look-and-feel for reuse */
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

/** Button props, extending the native button with variant options + an asChild escape hatch */
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

/** Styled button, for all clickable actions in the app */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Render as a Slot when composing with another element (e.g. a link)
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 2: Create `web/src/components/ui/input.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Styled text input, for name and room-name entry */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
```

- [ ] **Step 3: Create `web/src/components/ui/card.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Card container, for lobby room rows */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-xl border bg-card text-card-foreground shadow', className)} {...props} />
  ),
);
Card.displayName = 'Card';

/** Card content region, for padding the inner body */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-4', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

export { Card, CardContent };
```

- [ ] **Step 4: Create `web/src/components/ui/dialog.tsx`**

```tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Re-export the Radix primitives the app composes with
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

/** Dim overlay behind the dialog, for focus on the modal */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** Centered modal content with a close button, for name/create-room prompts */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 sm:max-w-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Header wrapper, for stacking title + description */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

/** Dialog title text, for the prompt heading */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle };
```

- [ ] **Step 5: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 4: Event types mirroring the server contract

**Files:**
- Create: `web/src/types/events.ts`

- [ ] **Step 1: Create `web/src/types/events.ts`**

```ts
/** Socket.IO event names, mirroring the server's EVENT map so the contract stays in sync */
export const EVENT = {
  LOBBY_LIST: 'lobby:list',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_CREATED: 'room:created',
  ROOM_REMOVED: 'room:removed',
  ROOM_JOINED: 'room:joined',
  ROOM_CLOSED: 'room:closed',
  GAME_MOVE: 'game:move',
  GAME_STATE: 'game:state',
  GAME_OVER: 'game:over',
  RTC_START: 'rtc:start',
  RTC_OFFER: 'rtc:offer',
  RTC_ANSWER: 'rtc:answer',
  RTC_ICE: 'rtc:ice',
  ERROR: 'error',
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

/** Player symbols, matching the server SYMBOL map */
export const SYMBOL = { X: 'X', O: 'O' } as const;

export type PlayerSymbol = (typeof SYMBOL)[keyof typeof SYMBOL];

/** Game outcomes, matching the server RESULT map for rendering end states */
export const RESULT = {
  IN_PROGRESS: 'IN_PROGRESS',
  X_WINS: 'X_WINS',
  O_WINS: 'O_WINS',
  DRAW: 'DRAW',
  OPPONENT_LEFT: 'OPPONENT_LEFT',
} as const;

export type GameResult = (typeof RESULT)[keyof typeof RESULT];

/** A single rendered cell, an X/O symbol or empty */
export type Cell = PlayerSymbol | null;

/** Authoritative board snapshot from the server, the only thing the client renders */
export type GameStatePayload = {
  board: Cell[];
  turn: PlayerSymbol;
  result: GameResult;
};

/** A lobby room summary, matching the server RoomSummary for the room list */
export type RoomSummary = {
  id: string;
  name: string;
  hostName: string;
};

/** room:joined payload, telling this client its room id and assigned symbol */
export type RoomJoinedPayload = { roomId: string; symbol: PlayerSymbol };

/** rtc:start payload, telling the client whether to offer and who the opponent is */
export type RtcStartPayload = { initiator: boolean; opponentName: string };

/** game:over payload, the trigger for the result overlay */
export type GameOverPayload = { result: GameResult };

/** error payload, carrying a typed error code for toasts */
export type ErrorPayload = { code: string };
```

- [ ] **Step 2: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 5: Environment + ICE server configuration

**Files:**
- Create: `web/src/lib/env.ts`

- [ ] **Step 1: Create `web/src/lib/env.ts`**

```ts
/** Signaling server URL, read from env with a localhost default for dev */
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

/** Build the WebRTC ICE server list from env, for NAT traversal (STUN always, TURN when configured) */
export const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [];

  // Always include a STUN server so peers can discover their public address
  const stunUrl = import.meta.env.VITE_STUN_URL;
  if (stunUrl) {
    servers.push({ urls: stunUrl });
  }

  // Include TURN only when fully configured, so relay fallback works behind strict NATs
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }

  return servers;
};
```

- [ ] **Step 2: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 6: Pure view logic (TDD)

**Files:**
- Create: `web/src/lib/game-view.ts`
- Test: `web/src/lib/game-view.test.ts`

> This is the one piece of client logic with real branching (perspective mapping + turn gating), so it gets test coverage per the spec's core-logic-only testing decision.

- [ ] **Step 1: Write the failing test — `web/src/lib/game-view.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { RESULT, SYMBOL, type GameStatePayload } from '@/types/events';
import { isMyTurn, OUTCOME, resolveOutcome } from './game-view';

/** A small helper, for building a game-state fixture without repeating fields */
const stateOf = (turn: GameStatePayload['turn'], result: GameStatePayload['result']): GameStatePayload => ({
  board: Array(9).fill(null),
  turn,
  result,
});

describe('resolveOutcome', () => {
  it('returns WIN for the player whose symbol won', () => {
    expect(resolveOutcome(RESULT.X_WINS, SYMBOL.X)).toBe(OUTCOME.WIN);
    expect(resolveOutcome(RESULT.O_WINS, SYMBOL.O)).toBe(OUTCOME.WIN);
  });

  it('returns LOSE for the player whose symbol lost', () => {
    expect(resolveOutcome(RESULT.X_WINS, SYMBOL.O)).toBe(OUTCOME.LOSE);
    expect(resolveOutcome(RESULT.O_WINS, SYMBOL.X)).toBe(OUTCOME.LOSE);
  });

  it('returns DRAW for a drawn game regardless of symbol', () => {
    expect(resolveOutcome(RESULT.DRAW, SYMBOL.X)).toBe(OUTCOME.DRAW);
    expect(resolveOutcome(RESULT.DRAW, SYMBOL.O)).toBe(OUTCOME.DRAW);
  });

  it('returns WIN on forfeit, since the remaining player wins', () => {
    expect(resolveOutcome(RESULT.OPPONENT_LEFT, SYMBOL.X)).toBe(OUTCOME.WIN);
    expect(resolveOutcome(RESULT.OPPONENT_LEFT, SYMBOL.O)).toBe(OUTCOME.WIN);
  });
});

describe('isMyTurn', () => {
  it('is true only when the game is in progress and the turn matches my symbol', () => {
    expect(isMyTurn(stateOf(SYMBOL.X, RESULT.IN_PROGRESS), SYMBOL.X)).toBe(true);
    expect(isMyTurn(stateOf(SYMBOL.O, RESULT.IN_PROGRESS), SYMBOL.X)).toBe(false);
  });

  it('is false in a terminal state even when turn matches my symbol', () => {
    // turn holds the last mover in terminal states, so it must never enable input
    expect(isMyTurn(stateOf(SYMBOL.X, RESULT.X_WINS), SYMBOL.X)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/game-view.test.ts`
Expected: FAIL — cannot resolve `./game-view` (module not yet created).

- [ ] **Step 3: Implement `web/src/lib/game-view.ts`**

```ts
import { RESULT, SYMBOL, type GameResult, type GameStatePayload, type PlayerSymbol } from '@/types/events';

/** Player-perspective outcomes, for choosing the result-screen message */
export const OUTCOME = {
  WIN: 'WIN',
  LOSE: 'LOSE',
  DRAW: 'DRAW',
} as const;

export type Outcome = (typeof OUTCOME)[keyof typeof OUTCOME];

/** Map a server result to this player's perspective, for showing win/lose/draw */
export const resolveOutcome = (result: GameResult, mySymbol: PlayerSymbol): Outcome => {
  // A forfeit always means the remaining (this) player wins
  if (result === RESULT.OPPONENT_LEFT) {
    return OUTCOME.WIN;
  }
  if (result === RESULT.DRAW) {
    return OUTCOME.DRAW;
  }
  // Compare the winning symbol against mine to decide win vs lose
  const winningSymbol = result === RESULT.X_WINS ? SYMBOL.X : SYMBOL.O;
  return winningSymbol === mySymbol ? OUTCOME.WIN : OUTCOME.LOSE;
};

/** Decide if it is this player's turn, gating on IN_PROGRESS so terminal turn values never enable input */
export const isMyTurn = (state: GameStatePayload, mySymbol: PlayerSymbol): boolean =>
  state.result === RESULT.IN_PROGRESS && state.turn === mySymbol;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/lib/game-view.test.ts`
Expected: PASS — all assertions green.

---

### Task 7: Zustand stores

**Files:**
- Create: `web/src/stores/socketStore.ts`
- Create: `web/src/stores/gameStore.ts`
- Create: `web/src/stores/mediaStore.ts`

- [ ] **Step 1: Create `web/src/stores/socketStore.ts`**

```ts
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { PlayerSymbol, RoomSummary } from '@/types/events';

/** App screens, the single source of truth for top-level navigation */
export const SCREEN = {
  NAME: 'NAME',
  LOBBY: 'LOBBY',
  GAME: 'GAME',
} as const;

export type Screen = (typeof SCREEN)[keyof typeof SCREEN];

/** Connection, identity, lobby and room state, holding everything the socket layer drives */
type SocketState = {
  socket: Socket | null;
  screen: Screen;
  connected: boolean;
  playerName: string;
  roomId: string | null;
  mySymbol: PlayerSymbol | null;
  opponentName: string | null;
  rooms: RoomSummary[];
  setSocket: (socket: Socket) => void;
  setScreen: (screen: Screen) => void;
  setConnected: (connected: boolean) => void;
  setPlayerName: (name: string) => void;
  enterRoom: (roomId: string, symbol: PlayerSymbol) => void;
  setOpponentName: (name: string) => void;
  setRooms: (rooms: RoomSummary[]) => void;
  addRoom: (room: RoomSummary) => void;
  removeRoom: (id: string) => void;
  resetRoom: () => void;
};

/** Socket store, for connection status, identity, lobby list and current-room info */
export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  screen: SCREEN.NAME,
  connected: false,
  playerName: '',
  roomId: null,
  mySymbol: null,
  opponentName: null,
  rooms: [],
  setSocket: (socket) => set({ socket }),
  setScreen: (screen) => set({ screen }),
  setConnected: (connected) => set({ connected }),
  setPlayerName: (playerName) => set({ playerName }),
  // Enter the game screen with the assigned room id and symbol
  enterRoom: (roomId, mySymbol) => set({ roomId, mySymbol, screen: SCREEN.GAME }),
  setOpponentName: (opponentName) => set({ opponentName }),
  setRooms: (rooms) => set({ rooms }),
  // Append a room, de-duplicating by id so repeated broadcasts do not stack
  addRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.some((r) => r.id === room.id) ? state.rooms : [...state.rooms, room],
    })),
  removeRoom: (id) => set((state) => ({ rooms: state.rooms.filter((r) => r.id !== id) })),
  // Clear room-scoped state when returning to the lobby
  resetRoom: () => set({ roomId: null, mySymbol: null, opponentName: null }),
}));
```

- [ ] **Step 2: Create `web/src/stores/gameStore.ts`**

```ts
import { create } from 'zustand';
import type { GameStatePayload } from '@/types/events';

/** Authoritative game snapshot, holding only what the board + result overlay render */
type GameState = {
  state: GameStatePayload | null;
  setState: (state: GameStatePayload) => void;
  reset: () => void;
};

/** Game store, for the server-authoritative board/turn/result snapshot */
export const useGameStore = create<GameState>((set) => ({
  state: null,
  setState: (state) => set({ state }),
  reset: () => set({ state: null }),
}));
```

- [ ] **Step 3: Create `web/src/stores/mediaStore.ts`**

```ts
import { create } from 'zustand';

/** Camera permission / connection phases, for showing the right video placeholder */
export const MEDIA_STATUS = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DENIED: 'DENIED',
  FAILED: 'FAILED',
} as const;

export type MediaStatus = (typeof MEDIA_STATUS)[keyof typeof MEDIA_STATUS];

/** Local + remote media streams and connection status, for the live video tiles */
type MediaState = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  status: MediaStatus;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setStatus: (status: MediaStatus) => void;
  reset: () => void;
};

/** Media store, for local/remote camera streams and their connection status */
export const useMediaStore = create<MediaState>((set) => ({
  localStream: null,
  remoteStream: null,
  status: MEDIA_STATUS.IDLE,
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setStatus: (status) => set({ status }),
  reset: () => set({ localStream: null, remoteStream: null, status: MEDIA_STATUS.IDLE }),
}));
```

- [ ] **Step 4: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 8: Socket service

**Files:**
- Create: `web/src/services/socket.ts`

> Depends on Task 9's `webrtc.ts` for the `rtc:*` handlers. Implement this file referencing the webrtc functions by name; if executing Task 8 before Task 9, the build will fail on the missing import — run the `tsc` verification only after Task 9 is also in place, or implement Task 9 first. (The recommended order is 9 then 8; this plan lists 8 first for narrative flow, but they are a pair.)

- [ ] **Step 1: Create `web/src/services/socket.ts`**

```ts
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/env';
import { SCREEN, useSocketStore } from '@/stores/socketStore';
import { useGameStore } from '@/stores/gameStore';
import { MEDIA_STATUS, useMediaStore } from '@/stores/mediaStore';
import {
  EVENT,
  type ErrorPayload,
  type GameStatePayload,
  type RoomJoinedPayload,
  type RoomSummary,
  type RtcStartPayload,
} from '@/types/events';
import { closePeer, handleRemoteAnswer, handleRemoteIce, handleRemoteOffer, startPeer } from './webrtc';

/** Tear down the WebRTC peer and reset room/game/media state, for returning cleanly to the lobby */
const leaveToLobby = (): void => {
  closePeer();
  useMediaStore.getState().reset();
  useGameStore.getState().reset();
  useSocketStore.getState().resetRoom();
  useSocketStore.getState().setScreen(SCREEN.LOBBY);
  // Refresh the lobby list since we left the room context
  requestLobby();
};

/** Connect to the signaling server and wire every server event into the stores, for the whole app lifecycle */
export const connectSocket = (playerName: string): void => {
  const store = useSocketStore.getState();
  // Reuse an existing socket if already connected, to avoid duplicate connections
  if (store.socket) {
    return;
  }

  const socket = io(SOCKET_URL, { transports: ['websocket'] });
  store.setSocket(socket);
  store.setPlayerName(playerName);

  socket.on('connect', () => {
    useSocketStore.getState().setConnected(true);
    // Move to the lobby once connected, so the user leaves the name-entry screen
    useSocketStore.getState().setScreen(SCREEN.LOBBY);
    // Ask for the current lobby list as soon as we are connected
    requestLobby();
  });

  socket.on('disconnect', () => useSocketStore.getState().setConnected(false));

  // Lobby list: replace the whole list with the server's snapshot
  socket.on(EVENT.LOBBY_LIST, (rooms: RoomSummary[]) => useSocketStore.getState().setRooms(rooms));

  // A new room appeared: add it for any client viewing the lobby
  socket.on(EVENT.ROOM_CREATED, (room: RoomSummary) => useSocketStore.getState().addRoom(room));

  // A room is no longer joinable: drop it from the list
  socket.on(EVENT.ROOM_REMOVED, ({ id }: { id: string }) => useSocketStore.getState().removeRoom(id));

  // We joined (or created) a room: store our symbol and switch to the game screen
  socket.on(EVENT.ROOM_JOINED, ({ roomId, symbol }: RoomJoinedPayload) =>
    useSocketStore.getState().enterRoom(roomId, symbol),
  );

  // Pairing starts: record the opponent name and begin the WebRTC handshake
  socket.on(EVENT.RTC_START, ({ initiator, opponentName }: RtcStartPayload) => {
    useSocketStore.getState().setOpponentName(opponentName);
    useMediaStore.getState().setStatus(MEDIA_STATUS.CONNECTING);
    void startPeer(initiator);
  });

  // Relay handlers feed remote signaling into the peer connection
  socket.on(EVENT.RTC_OFFER, (offer: RTCSessionDescriptionInit) => void handleRemoteOffer(offer));
  socket.on(EVENT.RTC_ANSWER, (answer: RTCSessionDescriptionInit) => void handleRemoteAnswer(answer));
  socket.on(EVENT.RTC_ICE, (candidate: RTCIceCandidateInit) => void handleRemoteIce(candidate));

  // Authoritative game state: just store it; components derive turn/render from it
  socket.on(EVENT.GAME_STATE, (state: GameStatePayload) => useGameStore.getState().setState(state));

  // Game over: the GAME_STATE already carries the terminal result, so the overlay reacts to that.
  // The 10s countdown + navigation is driven by ROOM_CLOSED below.
  socket.on(EVENT.GAME_OVER, () => {
    /* no-op: terminal result arrives via GAME_STATE; overlay reads it */
  });

  // Room closed (after the result window, or immediately for the forfeit survivor): go back to lobby idempotently
  socket.on(EVENT.ROOM_CLOSED, () => {
    if (useSocketStore.getState().roomId !== null) {
      leaveToLobby();
    }
  });

  // Typed error: surface it as a toast via a CustomEvent the UI listens for
  socket.on(EVENT.ERROR, ({ code }: ErrorPayload) =>
    window.dispatchEvent(new CustomEvent('app-error', { detail: code })),
  );
};

/** Request the current open-room list, for populating the lobby */
export const requestLobby = (): void => {
  useSocketStore.getState().socket?.emit(EVENT.LOBBY_LIST);
};

/** Create a named room as host, for starting a new match */
export const createRoom = (name: string): void => {
  const { socket, playerName } = useSocketStore.getState();
  socket?.emit(EVENT.ROOM_CREATE, { name, playerName });
};

/** Join an existing room as the second player, for pairing */
export const joinRoom = (roomId: string): void => {
  const { socket, playerName } = useSocketStore.getState();
  socket?.emit(EVENT.ROOM_JOIN, { roomId, playerName });
};

/** Send a tapped cell to the server, which validates and broadcasts the new state */
export const sendMove = (cell: number): void => {
  useSocketStore.getState().socket?.emit(EVENT.GAME_MOVE, { cell });
};

/** Leave the current room and return to the lobby, for an explicit forfeit (no room:closed comes back to us) */
export const leaveRoom = (): void => {
  useSocketStore.getState().socket?.emit(EVENT.ROOM_LEAVE);
  leaveToLobby();
};
```

- [ ] **Step 2: Defer verification until Task 9 is implemented** (this file imports `./webrtc`).

---

### Task 9: WebRTC service

**Files:**
- Create: `web/src/services/webrtc.ts`

- [ ] **Step 1: Create `web/src/services/webrtc.ts`**

```ts
import { buildIceServers } from '@/lib/env';
import { EVENT } from '@/types/events';
import { useSocketStore } from '@/stores/socketStore';
import { MEDIA_STATUS, useMediaStore } from '@/stores/mediaStore';

// Module-level peer connection + queue, holding the single active WebRTC session
let peer: RTCPeerConnection | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];

/** Emit a signaling payload to the peer via the relay server, for the offer/answer/ICE exchange */
const emitSignal = (event: string, payload: unknown): void => {
  useSocketStore.getState().socket?.emit(event, payload);
};

/** Drain ICE candidates buffered before the remote description was set, to avoid dropping them */
const flushPendingCandidates = async (): Promise<void> => {
  if (peer === null) {
    return;
  }
  for (const candidate of pendingCandidates) {
    await peer.addIceCandidate(candidate);
  }
  pendingCandidates = [];
};

/** Acquire the local camera, tolerating denial so the game stays playable without video */
const acquireLocalStream = async (): Promise<MediaStream | null> => {
  try {
    // Video only (audio off) to avoid echo when both peers run on one machine during demos
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    useMediaStore.getState().setLocalStream(stream);
    return stream;
  } catch {
    // Permission denied or no camera: continue without a local track
    useMediaStore.getState().setStatus(MEDIA_STATUS.DENIED);
    return null;
  }
};

/** Start the WebRTC session, creating the peer and (if initiator) sending the offer, for live video pairing */
export const startPeer = async (initiator: boolean): Promise<void> => {
  // Reset any stale session before starting a fresh one
  closePeer();
  pendingCandidates = [];

  peer = new RTCPeerConnection({ iceServers: buildIceServers() });

  // Forward our local ICE candidates to the other peer through the relay
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      emitSignal(EVENT.RTC_ICE, event.candidate.toJSON());
    }
  };

  // Surface the remote stream to the video tile when tracks arrive
  peer.ontrack = (event) => {
    useMediaStore.getState().setRemoteStream(event.streams[0]);
    useMediaStore.getState().setStatus(MEDIA_STATUS.CONNECTED);
  };

  // Reflect failed/disconnected transport in the media status for the placeholder
  peer.oniceconnectionstatechange = () => {
    const iceState = peer?.iceConnectionState;
    if (iceState === 'failed' || iceState === 'disconnected') {
      useMediaStore.getState().setStatus(MEDIA_STATUS.FAILED);
    }
  };

  // Attach local tracks (if the camera was granted) so the peer can render us
  const localStream = await acquireLocalStream();
  if (localStream) {
    for (const track of localStream.getTracks()) {
      peer.addTrack(track, localStream);
    }
  }

  // The designated initiator creates and sends the offer
  if (initiator) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    emitSignal(EVENT.RTC_OFFER, offer);
  }
};

/** Handle a remote offer by answering, for the non-initiator side of the handshake */
export const handleRemoteOffer = async (offer: RTCSessionDescriptionInit): Promise<void> => {
  if (peer === null) {
    return;
  }
  await peer.setRemoteDescription(offer);
  await flushPendingCandidates();
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  emitSignal(EVENT.RTC_ANSWER, answer);
};

/** Handle a remote answer, completing the handshake on the initiator side */
export const handleRemoteAnswer = async (answer: RTCSessionDescriptionInit): Promise<void> => {
  if (peer === null) {
    return;
  }
  await peer.setRemoteDescription(answer);
  await flushPendingCandidates();
};

/** Handle a remote ICE candidate, queuing it if the remote description is not set yet */
export const handleRemoteIce = async (candidate: RTCIceCandidateInit): Promise<void> => {
  if (peer === null) {
    return;
  }
  // Buffer candidates until the remote description exists, to avoid InvalidStateError
  if (peer.remoteDescription === null) {
    pendingCandidates.push(candidate);
    return;
  }
  await peer.addIceCandidate(candidate);
};

/** Close the peer and stop local tracks, for releasing the camera when a match ends */
export const closePeer = (): void => {
  if (peer !== null) {
    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.oniceconnectionstatechange = null;
    peer.close();
    peer = null;
  }
  // Stop local camera tracks so the device light turns off
  const localStream = useMediaStore.getState().localStream;
  localStream?.getTracks().forEach((track) => track.stop());
  pendingCandidates = [];
};
```

- [ ] **Step 2: Verify the socket + webrtc pair compiles**

Run: `cd web && npx tsc -b`
Expected: no errors (both `services/socket.ts` and `services/webrtc.ts` now resolve).

---

### Task 10: Name entry screen

**Files:**
- Create: `web/src/screens/NameEntryScreen.tsx`

- [ ] **Step 1: Create `web/src/screens/NameEntryScreen.tsx`**

```tsx
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { connectSocket } from '@/services/socket';

/** Name entry screen, prompting for a session-only display name before connecting for lobby access */
export const NameEntryScreen = () => {
  const [name, setName] = useState('');

  /** Connect with the trimmed name on submit, for entering the lobby */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    connectSocket(trimmed);
  };

  return (
    // A non-dismissable dialog blocks the app until a name is chosen
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter your name</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            autoFocus
            placeholder="Your display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={name.trim().length === 0}>
            Join Lobby
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 2: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 11: Lobby screen

**Files:**
- Create: `web/src/screens/LobbyScreen.tsx`

- [ ] **Step 1: Create `web/src/screens/LobbyScreen.tsx`**

```tsx
import { type FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createRoom, joinRoom } from '@/services/socket';
import { useSocketStore } from '@/stores/socketStore';

/** Lobby screen, listing open rooms and offering room creation for starting/joining a match */
export const LobbyScreen = () => {
  const rooms = useSocketStore((state) => state.rooms);
  const playerName = useSocketStore((state) => state.playerName);
  const [roomName, setRoomName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  /** Create the room and close the dialog on submit, for hosting */
  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = roomName.trim();
    if (trimmed.length === 0) {
      return;
    }
    createRoom(trimmed);
    setRoomName('');
    setDialogOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header greets the player and anchors the lobby */}
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-lg font-semibold">Online Tic-Tac-Toe</h1>
        <span className="text-sm text-muted-foreground">Hi, {playerName}</span>
      </header>

      {/* Scrollable room list fills the available space */}
      <main className="flex-1 space-y-3 overflow-y-auto p-4">
        {rooms.length === 0 ? (
          <p className="pt-10 text-center text-muted-foreground">No open rooms yet. Create one!</p>
        ) : (
          rooms.map((room) => (
            <Card key={room.id}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{room.name}</p>
                  <p className="text-sm text-muted-foreground">Host: {room.hostName}</p>
                </div>
                <Button size="sm" onClick={() => joinRoom(room.id)}>
                  Join
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </main>

      {/* Create-room action pinned to the bottom for thumb reach */}
      <footer className="border-t p-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Create Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a room</DialogTitle>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <Input
                autoFocus
                placeholder="Room name"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
              />
              <Button type="submit" disabled={roomName.trim().length === 0}>
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </footer>
    </div>
  );
};
```

- [ ] **Step 2: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 12: Game UI components

**Files:**
- Create: `web/src/components/TopBar.tsx`
- Create: `web/src/components/PlayerStatus.tsx`
- Create: `web/src/components/GameBoard.tsx`
- Create: `web/src/components/VideoFeeds.tsx`
- Create: `web/src/components/ResultOverlay.tsx`

- [ ] **Step 1: Create `web/src/components/TopBar.tsx`**

```tsx
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leaveRoom } from '@/services/socket';
import { useSocketStore } from '@/stores/socketStore';

/** Top bar, showing the menu (leave) action and the player avatar per the sketch layout */
export const TopBar = () => {
  const playerName = useSocketStore((state) => state.playerName);
  // First letter of the name as a simple avatar, to avoid asset dependencies
  const initial = playerName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center justify-between border-b p-3">
      {/* Hamburger doubles as a leave-room action for this minimal demo */}
      <Button variant="ghost" size="icon" aria-label="Leave room" onClick={leaveRoom}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
        {initial}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `web/src/components/PlayerStatus.tsx`**

```tsx
import { cn } from '@/lib/utils';
import type { PlayerSymbol } from '@/types/events';

/** PlayerStatus props, describing one player row's name/symbol/turn state for the header */
type PlayerStatusProps = {
  name: string;
  symbol: PlayerSymbol;
  isActive: boolean;
  isYou: boolean;
};

/** A single player status row, showing whose turn it is for clear game feedback */
export const PlayerStatus = ({ name, symbol, isActive, isYou }: PlayerStatusProps) => (
  <div
    className={cn(
      'flex items-center justify-between rounded-md px-3 py-2',
      // Highlight the active player's row so turn ownership is obvious
      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted',
    )}
  >
    <span className="font-medium">
      {name} {isYou && '(You)'}
    </span>
    <span className="flex items-center gap-2 text-sm">
      <span className="font-bold">{symbol}</span>
      {isActive && <span>• Your turn</span>}
    </span>
  </div>
);
```

- [ ] **Step 3: Create `web/src/components/GameBoard.tsx`**

```tsx
import { cn } from '@/lib/utils';
import { isMyTurn } from '@/lib/game-view';
import { sendMove } from '@/services/socket';
import { useGameStore } from '@/stores/gameStore';
import { useSocketStore } from '@/stores/socketStore';

/** Game board, rendering the 3x3 grid and sending taps when it is the player's turn */
export const GameBoard = () => {
  const state = useGameStore((s) => s.state);
  const mySymbol = useSocketStore((s) => s.mySymbol);

  // Without a state snapshot or symbol there is nothing to render yet
  if (state === null || mySymbol === null) {
    return null;
  }

  const myTurn = isMyTurn(state, mySymbol);

  /** Send a move for an empty cell only on the player's turn, enforcing the client-side gate */
  const handleCellClick = (index: number) => {
    if (!myTurn || state.board[index] !== null) {
      return;
    }
    sendMove(index);
  };

  return (
    <div className="grid aspect-square w-full max-w-md grid-cols-3 gap-2">
      {state.board.map((cell, index) => (
        <button
          key={index}
          // Disable cells that are filled or not the player's to play
          disabled={!myTurn || cell !== null}
          onClick={() => handleCellClick(index)}
          className={cn(
            'flex items-center justify-center rounded-lg border-2 text-5xl font-bold transition-colors',
            cell === null && myTurn ? 'hover:bg-accent' : '',
            'disabled:cursor-default',
          )}
        >
          {cell}
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 4: Create `web/src/components/VideoFeeds.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { MEDIA_STATUS, useMediaStore } from '@/stores/mediaStore';

/** VideoTile props, describing one camera tile's stream, label and mute state */
type VideoTileProps = {
  stream: MediaStream | null;
  label: string;
  muted: boolean;
  placeholder: string;
};

/** A single video tile, binding a MediaStream to a video element for live display */
const VideoTile = ({ stream, label, muted, placeholder }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach the stream to the element whenever it changes, since srcObject is not a prop
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg bg-black">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        // Placeholder keeps the layout stable before the stream connects
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{placeholder}</div>
      )}
      {/* Live badge marks the streaming tiles, matching the sketch */}
      <span className="absolute left-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {label}
      </span>
    </div>
  );
};

/** Video feeds row, showing the local + remote camera tiles for the live-video half of the demo */
export const VideoFeeds = () => {
  const localStream = useMediaStore((s) => s.localStream);
  const remoteStream = useMediaStore((s) => s.remoteStream);
  const status = useMediaStore((s) => s.status);

  // Choose a remote placeholder message that reflects the connection phase
  const remotePlaceholder = status === MEDIA_STATUS.FAILED ? 'Video unavailable' : 'Connecting…';

  return (
    <div className="flex h-full gap-2">
      <VideoTile stream={localStream} label="You • Live" muted placeholder="Camera off" />
      <VideoTile stream={remoteStream} label="Opponent • Live" muted={false} placeholder={remotePlaceholder} />
    </div>
  );
};
```

- [ ] **Step 5: Create `web/src/components/ResultOverlay.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { OUTCOME, resolveOutcome } from '@/lib/game-view';
import { RESULT } from '@/types/events';
import { useGameStore } from '@/stores/gameStore';
import { useSocketStore } from '@/stores/socketStore';

/** Countdown seconds before the room closes, matching the server's 10s cleanup window */
const COUNTDOWN_SECONDS = 10;

/** Display copy per outcome, for the result headline */
const OUTCOME_TEXT = {
  [OUTCOME.WIN]: 'You Win! 🎉',
  [OUTCOME.LOSE]: 'You Lose',
  [OUTCOME.DRAW]: "It's a Draw",
} as const;

/** Result overlay, shown on a terminal game state with a countdown back to the lobby */
export const ResultOverlay = () => {
  const state = useGameStore((s) => s.state);
  const mySymbol = useSocketStore((s) => s.mySymbol);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  const isTerminal = state !== null && state.result !== RESULT.IN_PROGRESS;

  // Tick a cosmetic countdown while terminal; the server's room:closed does the actual navigation
  useEffect(() => {
    if (!isTerminal) {
      setSeconds(COUNTDOWN_SECONDS);
      return;
    }
    const timer = setInterval(() => setSeconds((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [isTerminal]);

  // Render nothing until the game actually ends
  if (!isTerminal || mySymbol === null || state === null) {
    return null;
  }

  const outcome = resolveOutcome(state.result, mySymbol);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
      <h2 className="text-3xl font-bold">{OUTCOME_TEXT[outcome]}</h2>
      <p className="text-sm text-white/80">Returning to lobby in {seconds}s…</p>
    </div>
  );
};
```

- [ ] **Step 6: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 13: Game screen composition

**Files:**
- Create: `web/src/screens/GameScreen.tsx`

- [ ] **Step 1: Create `web/src/screens/GameScreen.tsx`**

```tsx
import { GameBoard } from '@/components/GameBoard';
import { PlayerStatus } from '@/components/PlayerStatus';
import { ResultOverlay } from '@/components/ResultOverlay';
import { TopBar } from '@/components/TopBar';
import { VideoFeeds } from '@/components/VideoFeeds';
import { SYMBOL } from '@/types/events';
import { useGameStore } from '@/stores/gameStore';
import { useSocketStore } from '@/stores/socketStore';

/** Game screen, composing the sketch layout: top bar, player rows, 75% board, 25% video */
export const GameScreen = () => {
  const state = useGameStore((s) => s.state);
  const mySymbol = useSocketStore((s) => s.mySymbol);
  const playerName = useSocketStore((s) => s.playerName);
  const opponentName = useSocketStore((s) => s.opponentName);

  // Identify which symbol is mine vs the opponent's for the status rows
  const opponentSymbol = mySymbol === SYMBOL.X ? SYMBOL.O : SYMBOL.X;
  const activeSymbol = state?.turn ?? null;

  return (
    // Relative container so the result overlay can cover the whole screen
    <div className="relative flex h-full flex-col">
      <TopBar />

      {/* Player status rows show names, symbols and the active turn */}
      <div className="space-y-2 p-3">
        <PlayerStatus
          name={playerName}
          symbol={mySymbol ?? SYMBOL.X}
          isActive={activeSymbol === mySymbol}
          isYou
        />
        <PlayerStatus
          name={opponentName ?? 'Waiting…'}
          symbol={opponentSymbol}
          isActive={activeSymbol === opponentSymbol}
          isYou={false}
        />
      </div>

      {/* Board takes ~75% of the remaining height */}
      <div className="flex flex-[3] items-center justify-center p-3">
        <GameBoard />
      </div>

      {/* Video feeds take ~25% of the remaining height */}
      <div className="flex-1 p-3 pt-0">
        <VideoFeeds />
      </div>

      <ResultOverlay />
    </div>
  );
};
```

- [ ] **Step 2: Verify build compiles**

Run: `cd web && npx tsc -b`
Expected: no errors.

---

### Task 14: App shell, entry point, and error toasts

**Files:**
- Create: `web/src/App.tsx`
- Create: `web/src/main.tsx`

- [ ] **Step 1: Create `web/src/App.tsx`**

```tsx
import { useEffect } from 'react';
import { toast } from 'sonner';
import { GameScreen } from '@/screens/GameScreen';
import { LobbyScreen } from '@/screens/LobbyScreen';
import { NameEntryScreen } from '@/screens/NameEntryScreen';
import { SCREEN, useSocketStore } from '@/stores/socketStore';

/** Human-readable messages per server error code, for friendly toasts */
const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: 'That room no longer exists.',
  ROOM_FULL: 'That room is already full.',
  ALREADY_IN_ROOM: 'You are already in that room.',
  NAME_REQUIRED: 'A name is required.',
  CELL_OUT_OF_RANGE: 'Invalid move.',
  NOT_YOUR_TURN: "It's not your turn.",
  CELL_TAKEN: 'That cell is already taken.',
  GAME_OVER: 'The game is already over.',
};

/** Root app, selecting the active screen and surfacing server errors as toasts */
const App = () => {
  const screen = useSocketStore((state) => state.screen);

  // Listen for the socket layer's error CustomEvent and show a toast, decoupling UI from the service
  useEffect(() => {
    const handler = (event: Event) => {
      const code = (event as CustomEvent<string>).detail;
      toast.error(ERROR_MESSAGES[code] ?? 'Something went wrong.');
    };
    window.addEventListener('app-error', handler);
    return () => window.removeEventListener('app-error', handler);
  }, []);

  // Map the current screen to its component
  if (screen === SCREEN.GAME) {
    return <GameScreen />;
  }
  if (screen === SCREEN.LOBBY) {
    return <LobbyScreen />;
  }
  return <NameEntryScreen />;
};

export default App;
```

- [ ] **Step 2: Create `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

// Mount the app with the toast portal, for the whole UI
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="top-center" />
  </StrictMode>,
);
```

- [ ] **Step 3: Verify the full build + lint + tests**

Run: `cd web && npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...` with a `dist/` output.

Run: `cd web && npm run lint`
Expected: no errors (warnings from `react-refresh/only-export-components` are acceptable; no rule is disabled).

Run: `cd web && npm run test`
Expected: the `game-view` test suite passes.

---

### Task 15: Containerization (web image)

**Files:**
- Create: `web/Dockerfile`
- Create: `web/nginx.conf`

> Vite bakes `VITE_*` env at build time. The Dockerfile accepts them as build args so Plan 3's docker-compose can inject the signaling URL and TURN credentials at image build.

- [ ] **Step 1: Create `web/nginx.conf`**

```nginx
# Serve the SPA and fall back to index.html, for client-side screen switching
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri /index.html;
  }
}
```

- [ ] **Step 2: Create `web/Dockerfile`**

```dockerfile
# Build stage compiles the Vite app with env baked in, for a static bundle
FROM node:20-alpine AS build
WORKDIR /app

# Build-time public config (Vite inlines VITE_* at build)
ARG VITE_SOCKET_URL
ARG VITE_STUN_URL
ARG VITE_TURN_URL
ARG VITE_TURN_USERNAME
ARG VITE_TURN_CREDENTIAL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_STUN_URL=$VITE_STUN_URL \
    VITE_TURN_URL=$VITE_TURN_URL \
    VITE_TURN_USERNAME=$VITE_TURN_USERNAME \
    VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runtime stage serves the static bundle via nginx, for a small production image
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Verify the image builds**

Run: `cd web && docker build --build-arg VITE_SOCKET_URL=http://localhost:3001 -t live-ttt-web .`
Expected: build completes; final image tagged `live-ttt-web`.

(If Docker is unavailable in the execution environment, skip this step and note it; the compose wiring is validated in Plan 3.)

---

## Final Verification (whole plan)

After all tasks:

- [ ] `cd web && npm run build` → passes
- [ ] `cd web && npm run lint` → no errors
- [ ] `cd web && npm run test` → `game-view` suite green
- [ ] **Manual smoke (requires the server running on :3001):**
  - `cd server && npm run start` in one terminal, `cd web && npm run dev` in another.
  - Open two browser windows. Enter a name in each.
  - Window A creates a room → it appears in Window B's lobby.
  - Window B joins → both switch to the game screen, exchange `rtc:start`, request camera, and (on grant) show the two live tiles.
  - Players alternate taps; only the active player's cells are enabled; the board syncs in both windows.
  - On a win/draw, both see the result overlay with a 10s countdown, then return to the lobby.
  - One player closing the tab mid-game → the other sees "You Win!" (OPPONENT_LEFT) and returns to the lobby.

---

## Notes for the implementer

- **Tasks 8 and 9 are a pair.** `socket.ts` imports `webrtc.ts`. Implement Task 9 first (or both before running `tsc`). The plan lists 8 first only for narrative flow.
- **No UI unit tests** by design (spec §7). The only test file is `lib/game-view.test.ts`. Do not add component/E2E tests.
- **Do not modify the server.** The client conforms to the existing contract; if something seems off, re-read the Server Contract section above rather than changing the server.
- **Comment rules from CLAUDE.md are mandatory** in every file (function/type/block comments, `type` over `interface`, const-as-enum, arrow functions, no disabled eslint rules).
- **Audio is intentionally off** in `getUserMedia` to avoid echo during single-machine demos; this is a deliberate decision, not an omission.
