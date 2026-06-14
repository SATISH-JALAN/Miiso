<p align="center">
  <img src="frontend/public/Miiso.png" alt="Miiso" width="120" />
</p>

<h1 align="center">Miiso</h1>

<p align="center">
  <strong>Autonomous on-chain DeFi security — detect threats in seconds, revoke approvals before attackers act.</strong>
</p>

<p align="center">
  <a href="https://miiso-ai.vercel.app/"><img src="https://img.shields.io/badge/demo-live-19C978?style=for-the-badge" alt="Live Demo" /></a>
  <a href="https://miiso.onrender.com/api/health"><img src="https://img.shields.io/badge/api-online-19C978?style=for-the-badge" alt="API Online" /></a>
  <img src="https://img.shields.io/badge/chain-Base%20Sepolia-0052FF?style=for-the-badge" alt="Base Sepolia" />
</p>

<p align="center">
  <a href="https://miiso-ai.vercel.app/">Frontend</a> ·
  <a href="https://miiso.onrender.com/api/health">Backend</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#deployment">Deployment</a>
</p>

---

## Overview

**Miiso** is a 24/7 autonomous security agent for DeFi wallets on **Base Sepolia**. It watches every new contract deployment in real time, decompiles bytecode, runs AI-powered threat analysis, and — when confidence is high enough — automatically revokes dangerous token approvals on your behalf.

You grant Miiso a single scoped permission: **reset a token approval to zero**. Nothing else. No transfers. No swaps. Enforced on-chain via MetaMask Smart Accounts and ERC-7710 caveats.

```
Deploy → Detect → Decompile → Analyze → Route → Revoke → Confirm
         └────────────── under 10 seconds end-to-end ──────────────┘
```

| | |
|---|---|
| **Problem** | $1.49B lost to DeFi exploits in 2024. Most attacks exploit forgotten unlimited approvals — not broken cryptography. |
| **Solution** | Miiso monitors Base blocks, flags malicious contracts with Venice AI, and fires `approve(spender, 0)` via the 1Shot relayer — paid in USDC, no ETH required. |
| **User cost** | ~$0.01 USDC per relay + 1.5% success fee on protected value |

---

## Live

| Service | URL |
|---------|-----|
| **Frontend** | [miiso-ai.vercel.app](https://miiso-ai.vercel.app/) |
| **Backend API** | [miiso.onrender.com](https://miiso.onrender.com) |
| **Health check** | [GET /api/health](https://miiso.onrender.com/api/health) |

---

## Architecture

### System overview

```mermaid
flowchart TB
    subgraph User["👤 User"]
        MM[MetaMask Wallet]
        UI[Miiso Dashboard]
    end

    subgraph Frontend["Vercel — React + Vite"]
        WAGMI[wagmi / viem]
        SSE_CLIENT[SSE EventSource]
        API_CLIENT[REST Client]
    end

    subgraph Backend["Render — Fastify Node.js"]
        API[REST API]
        SSE[SSE Manager]
        BW[Block Watcher]
        WP[Heimdall Worker Pool]
        ORCH[Agent Orchestrator]
        ROUTER[Confidence Router]
        EXEC[Revocation Executor]
        WH[1Shot Webhook Handler]
    end

    subgraph External["External Services"]
        RPC[Alchemy / QuickNode WSS]
        VENICE[Venice AI]
        RELAY[1Shot Relayer]
        NEON[(Neon Postgres)]
    end

    subgraph Chain["Base Sepolia"]
        BLOCKS[New Blocks]
        CONTRACTS[Smart Contracts]
    end

    MM <--> WAGMI
    UI --> API_CLIENT
    UI --> SSE_CLIENT
    API_CLIENT --> API
    SSE_CLIENT --> SSE

    BW -->|watchBlocks| RPC
    RPC --> BLOCKS
    BLOCKS --> BW
    BW --> WP
    BW --> ORCH
    ORCH --> VENICE
    ORCH --> ROUTER
    ROUTER --> EXEC
    EXEC --> RELAY
    RELAY --> CONTRACTS
    RELAY -->|Ed25519 webhook| WH
    WH --> SSE

    API --> NEON
    SSE -->|LISTEN/NOTIFY| NEON
    BW --> NEON
    ROUTER --> NEON
```

### Threat detection pipeline

Every contract creation transaction (`tx.to === null`) enters the pipeline within milliseconds of block inclusion.

```mermaid
sequenceDiagram
    participant Base as Base Sepolia
    participant BW as Block Watcher
    participant Proxy as Proxy Resolver
    participant HD as Heimdall Worker
    participant Orch as Orchestrator
    participant Venice as Venice AI
    participant DB as Neon Postgres
    participant Router as Confidence Router
    participant SSE as SSE Manager

    Base->>BW: New block (contract deploy)
    BW->>BW: Whitelist check
    BW->>SSE: CLEAN_SCAN (scanning)
    BW->>Proxy: EIP-1967 proxy slot lookup
    BW->>BW: Fetch bytecode (retry ×4, 250ms backoff)
    BW->>HD: Decompile bytecode
    HD-->>BW: Pseudo-Solidity
    BW->>Orch: Run agents (parallel)
    Orch->>Venice: SIWE-authenticated analysis
    Venice-->>Orch: Confidence + verdict
    Orch-->>BW: Tier + combined confidence
    BW->>DB: Log scan result
    alt Vulnerable
        BW->>Router: routeThreatConfidence()
        Router->>DB: Find affected approvals
        Router->>Router: Tier 1 / 2 / 3 routing
    else Safe
        BW->>SSE: CLEAN_SCAN (complete)
    end
```

### Confidence routing

Miiso never acts blindly. Every threat is scored and routed through three tiers based on combined confidence (Venice AI + static analysis).

```mermaid
flowchart LR
    THREAT[Threat Detected] --> SCORE{Combined Confidence}

    SCORE -->|≥ 85%| T1[Tier 1 — Instant Revoke]
    SCORE -->|70–84%| T2[Tier 2 — 60s Veto Window]
    SCORE -->|< 70%| T3[Tier 3 — Dashboard Alert Only]

    T1 --> RELAY[1Shot Relayer]
    T2 --> TIMER[60s Countdown]
    TIMER -->|No veto| RELAY
    TIMER -->|User vetoes| CANCEL[Cancelled]
    T3 --> LOG[Log to Dashboard]

    RELAY --> WEBHOOK[Ed25519 Webhook]
    WEBHOOK --> SSE_OUT[SSE → Dashboard Update]
```

| Tier | Threshold | Action | User control |
|------|-----------|--------|--------------|
| **Tier 1** | ≥ 85% | Immediate `approve(0)` via 1Shot | None — autonomous |
| **Tier 2** | 70–84% | 60-second veto countdown, then revoke | Cancel within window |
| **Tier 3** | < 70% | Informational alert only | Manual revoke from dashboard |

Security profiles (`safe` · `balanced` · `manual`) adjust tier behavior per user.

### Permission & setup flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Miiso Setup
    participant MM as MetaMask
    participant API as Backend API
    participant Relay as 1Shot Relayer

    User->>UI: Connect wallet
    UI->>MM: EIP-7702 smart account upgrade
    MM-->>Relay: authorizationList + USDC fee
    User->>MM: Grant ERC-7715 permission
    Note over MM: Scope: approve(token, 0) only<br/>Enforcer: ApprovalRevocationEnforcer
    MM-->>API: POST /api/permissions
    User->>MM: Approve SuccessFeeHook (USDC)
    API-->>UI: Protection active
    UI->>API: SSE /api/events/:address
```

---

## Tech stack

### Frontend
| | |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 + Framer Motion |
| Wallet | wagmi 2 + viem + MetaMask Smart Accounts Kit |
| State | Zustand + TanStack Query |
| Hosting | [Vercel](https://vercel.com) |

### Backend
| | |
|---|---|
| Runtime | Node.js + Fastify |
| Blockchain | viem (WSS block watcher, Base Sepolia) |
| AI | Venice AI (SIWE x402 auth) |
| Decompiler | Heimdall-rs (worker thread pool, 30s timeout) |
| Relay | 1Shot API (USDC gas, EIP-7702) |
| Database | Neon Postgres + Drizzle ORM + pgvector |
| Real-time | PostgreSQL LISTEN/NOTIFY → SSE |
| Hosting | [Render](https://render.com) |

### Smart contracts (Base Sepolia)
| Contract | Purpose |
|----------|---------|
| `ApprovalRevocationEnforcer` | On-chain caveat — only `approve(spender, 0)` allowed |
| `MiisoSuccessFeeHook` | Pulls 1.5% success fee in USDC after protection |
| `HoneypotDrainer` | Test contract for end-to-end pipeline demos |

---

## Project structure

```
Miiso/
├── frontend/               # React SPA (Vercel)
│   ├── src/
│   │   ├── lib/            # API client, MetaMask integration
│   │   ├── hooks/          # SSE, dashboard, permissions
│   │   ├── components/     # Dashboard panels, veto timer
│   │   └── store/          # Zustand global state
│   └── public/
│       └── miiso-fevicon.png
│
├── backend/                # Fastify sentinel (Render)
│   ├── src/
│   │   ├── daemon/         # Block watcher, Venice, confidence router
│   │   ├── agents/         # Research, data, analysis, executor agents
│   │   ├── server/         # REST routes + SSE manager
│   │   ├── blockchain/     # viem clients, 1Shot relay, approval scanner
│   │   ├── db/             # Drizzle schema + queries
│   │   └── security/       # Ed25519 webhook verify, whitelist
│   └── workers/            # Heimdall decompiler worker threads
│
└── contracts/              # Hardhat — Solidity enforcers + honeypot
    ├── src/
    └── scripts/
```

---

## Getting started

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **MetaMask** with Base Sepolia network
- **Neon** Postgres database
- API keys: Alchemy (WSS), Venice AI, 1Shot relayer

### Install

```bash
git clone https://github.com/SATISH-JALAN/Miiso.git
cd Miiso
pnpm install
```

### Database setup

```bash
cd backend
cp .env.example .env        # fill in your values
node scripts/enable-pgvector.js
npx drizzle-kit push
```

### Run locally

```bash
# Terminal 1 — backend (port 3001)
pnpm dev:backend

# Terminal 2 — frontend (port 3000)
pnpm dev:frontend
```

Open [http://localhost:3000](http://localhost:3000), connect MetaMask on **Base Sepolia**, and complete the setup wizard.

### Verify pipeline

```bash
pnpm sprint1:verify          # static checklist
pnpm sprint1:e2e             # end-to-end (backend must be running)
pnpm deploy:honeypot         # deploy test drainer to Base Sepolia
```

---

## Environment variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://...@ep-xxx.neon.tech/miiso?sslmode=require

# Blockchain — Base Sepolia
ALCHEMY_WSS_URL=wss://base-sepolia.g.alchemy.com/v2/YOUR_KEY
HTTP_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Agent session key (fund with USDC on Base Sepolia)
AGENT_PRIVATE_KEY=0x...
AGENT_ADDRESS=0x...

# Venice AI
VENICE_API_KEY=your_key
VENICE_API_URL=https://api.venice.ai/api/v1

# 1Shot Relayer
ONESHOT_RELAYER_URL=https://relayer.1shotapi.dev/relayers
ONESHOT_WEBHOOK_PUBLIC_KEY=your_ed25519_public_key
PUBLIC_WEBHOOK_URL=https://your-backend.onrender.com/api/webhooks/1shot

# MetaMask Smart Accounts — Base Sepolia
DELEGATION_MANAGER_ADDRESS=0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3
APPROVAL_REVOCATION_ENFORCER=0x0a1BE1E7c3838e9B3D803Be3C946c6E5abC6B6DA
SUCCESS_FEE_HOOK=0xc0C360C4B1DF47CE001DDDEBa857e23aEBF40A33

# Server
NODE_ENV=production
PORT=3001
DEMO_MODE=false
```

### Frontend (`frontend/.env`)

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
VITE_ONESHOT_RELAYER_URL=https://relayer.1shotapi.dev/relayers
VITE_SUCCESS_FEE_HOOK=0xc0C360C4B1DF47CE001DDDEBa857e23aEBF40A33
VITE_DELEGATION_MANAGER_ADDRESS=0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health + chain ID |
| `POST` | `/api/permissions` | Register ERC-7715 permission |
| `GET` | `/api/permissions/:address` | Get permission status |
| `DELETE` | `/api/permissions/:address` | Revoke delegation |
| `GET` | `/api/dashboard/:address` | Protection stats |
| `GET` | `/api/approvals/:address` | Cached token approvals |
| `GET` | `/api/history/:address` | Protection event history |
| `GET` | `/api/events/:address` | SSE live event stream |
| `POST` | `/api/veto/:eventId` | Cancel Tier 2 revocation |
| `POST` | `/api/analyze` | On-demand contract analysis |
| `POST` | `/api/webhooks/1shot` | 1Shot relay confirmation (Ed25519) |
| `GET` | `/api/relay/capabilities` | 1Shot fee + relayer info |

---

## Deployment

```mermaid
flowchart LR
    GH[GitHub Repo] --> VERCEL[Vercel<br/>frontend/]
    GH --> RENDER[Render<br/>backend/]
    VERCEL -->|VITE_BACKEND_URL| RENDER
    RENDER --> NEON[(Neon Postgres)]
    RENDER --> RPC[Alchemy WSS]
    ONESHOT[1Shot] -->|webhook| RENDER
```

| | Vercel (Frontend) | Render (Backend) |
|---|---|---|
| **Root directory** | `frontend` | `backend` |
| **Build** | `pnpm install && pnpm build` | `pnpm install && pnpm run build` |
| **Start** | — (static) | `pnpm start` |
| **Output** | `dist/` | `dist/src/index.js` |
| **Key env** | `VITE_BACKEND_URL` | `DATABASE_URL`, `PUBLIC_WEBHOOK_URL`, `AGENT_PRIVATE_KEY` |

> **Tip:** Set `NODE_ENV=production` on Render to suppress debug logs. Use a **Starter** instance or higher — the block watcher must stay always-on.

---

## Security

- **Least privilege** — Agent can only call `approve(spender, 0)`. Enforced by `ApprovalRevocationEnforcer` on-chain.
- **Webhook verification** — 1Shot callbacks verified via native Node.js `crypto.verify` (Ed25519). No third-party crypto libs.
- **SIWE auth** — Venice AI requests authenticated with EIP-191 signed SIWE messages. Single-use nonces.
- **No key exposure** — Agent private key lives in server env only. Never logged or sent to clients.
- **Whitelist layers** — Global protocol whitelist + per-user spender whitelist before any revocation.
- **Rate limiting** — 100 requests/minute per IP on all API routes.

---

## Built with

<p align="center">
  <img src="https://img.shields.io/badge/MetaMask_Smart_Accounts-ERC--7715-F6851B?style=flat-square" alt="MetaMask Smart Accounts" />
  <img src="https://img.shields.io/badge/1Shot_API-Relayer-19C978?style=flat-square" alt="1Shot API" />
  <img src="https://img.shields.io/badge/Venice_AI-Threat_Intel-8B5CF6?style=flat-square" alt="Venice AI" />
  <img src="https://img.shields.io/badge/Base_Sepolia-Chain_84532-0052FF?style=flat-square" alt="Base Sepolia" />
  <img src="https://img.shields.io/badge/Heimdall--rs-Decompiler-F59E0B?style=flat-square" alt="Heimdall-rs" />
</p>

> Built for: **MetaMask Smart Accounts Kit** × **1Shot API** × **Venice AI** on **Base**

---

<p align="center">
  <img src="frontend/public/miiso-fevicon.png" alt="Miiso" width="48" />
  <br />
  <sub>Fermented protection for your digital assets.</sub>
</p>
