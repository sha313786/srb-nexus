# SRB NEXUS — Central Infrastructure & Security System

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.27.0-blue.svg)](https://discord.js.org/)
[![Fastify](https://img.shields.io/badge/fastify-v5.11.3-black.svg)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)

**SRB NEXUS** is an enterprise-grade Discord infrastructure and security application combining a high-performance Fastify REST API, a reactive web dashboard, and automated server defense systems (Anti-Spam, Anti-Scam, Anti-Raid, and dynamic Canvas-rendered welcome banners).

---

## ⚡ Key Features

- **Automated Security & Moderation**:
  - **Anti-Spam**: Message frequency analysis and duplicate spam detection with automated punitive actions.
  - **Anti-Scam / Phishing**: RegEx-based detection targeting malicious links, Discord Nitro scams, and crypto airdrop bots.
  - **Anti-Raid**: Rapid join velocity monitor that halts mass-bot raids in real time.
  - **Exemptions & Whitelisting**: Role, user, bot, and channel-based security exemptions.
  - **Audit Logging**: Structured moderation and security audit records stored in PostgreSQL with rich Discord embed dispatches.
- **Dynamic Canvas Welcome Banners**:
  - High-performance server welcome banners generated via `@napi-rs/canvas`.
  - Supports custom server background URLs configured directly from the web dashboard.
- **REST API & Management Dashboard**:
  - Built with Fastify, JWT cookie sessions, and Discord OAuth2.
  - Web UI for managing server settings, channels, auto-roles, and security policies.
- **Production-Ready Containerization**:
  - Multi-stage Docker build with non-root security user and automated health checks.
  - Docker Compose setup with pre-configured PostgreSQL 16 and automated DDL bootstrapping.

---

## 🏗️ Project Architecture

```
srb-nexus/
├── public/                 # Static web dashboard assets (HTML, CSS, JS)
│   ├── index.html          # Server selector & login view
│   └── dashboard.html      # Server configuration control panel
├── src/
│   ├── api/                # Fastify REST API routes & controllers
│   │   ├── routes/auth.ts  # Discord OAuth2 and JWT session handling
│   │   └── routes/guilds.ts# Guild configuration and data endpoints
│   ├── core/               # Database client, logger, and config
│   │   ├── database.ts     # PostgreSQL connection pool with adaptive SSL
│   │   └── logger.ts       # Structured Pino logger
│   ├── database/
│   │   └── schema.sql      # Database DDL schemas and indexes
│   ├── discord/
│   │   ├── commands/       # Discord slash commands (ban, kick, modlogs, etc.)
│   │   └── events/         # Discord interaction and message event handlers
│   ├── moderation/         # Moderation audit logging service
│   ├── security/           # Anti-spam, anti-scam, anti-raid, and whitelist engines
│   └── index.ts            # Application bootstrap & entry point
├── Dockerfile              # Multi-stage production container definition
├── docker-compose.yml      # Service orchestration (App + PostgreSQL)
└── tsconfig.json           # TypeScript configuration
```

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v15.x` or higher
- **Discord Bot Application**: Create one in the [Discord Developer Portal](https://discord.com/developers/applications) with:
  - Required Gateway Intents: `Server Members Intent`, `Message Content Intent`

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/sha313786/srb-nexus.git
cd srb-nexus

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

### 3. Build & Run
```bash
# Compile TypeScript and copy public assets to dist/
npm run build

# Start production server
npm start

# Or run in development mode with hot reload
npm run dev
```

---

## 🐳 Docker Deployment

To launch SRB NEXUS and a local PostgreSQL instance with automated schema bootstrapping:

```bash
# 1. Provide your Discord bot credentials in .env
DISCORD_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id_here
JWT_SECRET=your_jwt_secret_here

# 2. Start services
docker compose up -d --build
```

Access the web dashboard at: `http://localhost:3000`

---

## ⚙️ Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP port for Fastify server | `3000` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://nexus:nexuspassword@postgres:5432/srb_nexus` |
| `DB_SSL` | Force SSL connection for cloud databases (`true` / `false`) | `false` |
| `DISCORD_TOKEN` | Discord Bot authentication token | *Required* |
| `DISCORD_CLIENT_ID`| Discord Application Client ID | *Required* |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 Client Secret | *Optional (for Web Login)* |
| `DISCORD_REDIRECT_URI` | OAuth2 callback redirect URL | `http://localhost:3000/api/auth/discord/callback` |
| `JWT_SECRET` | Secret key for signing dashboard session cookies | *Required* |
| `LOG_LEVEL` | Logging verbosity (`info`, `debug`, `warn`, `error`) | `info` |

---

## 🛡️ Discord Slash Commands (33 Built-in Commands)

### 📌 Core & Server Information
- `/nexus-ping` — Real-time bot latency and Discord API heartbeat.
- `/nexus-help [command]` — Interactive categorized directory of commands and descriptions.
- `/nexus-serverinfo` — Comprehensive guild statistics, verification level, and tier data.
- `/nexus-userinfo [user]` — Detailed account identity, join timestamp, and roles.
- `/nexus-avatar [user]` — High-resolution avatar viewer with direct CDN download link.
- `/nexus-poll <question> <option1> <option2> ...` — Interactive community poll with emoji voting.
- `/nexus-embed <title> <description> [channel] [color]` — Broadcast customized rich announcements.
- `/nexus-remind <duration> <note>` — Set an automated timed reminder with channel/DM notification.
- `/nexus-afk [reason]` — Set status to AFK; notifies mentioners and welcomes you back on return.

### 🔨 Enterprise Moderation & Warnings
- `/nexus-ban <user> [reason] [delete_days]` — Ban an offender with PostgreSQL audit logging.
- `/nexus-kick <user> [reason]` — Kick a member from the guild.
- `/nexus-timeout <user> <duration> [reason]` — Temporarily isolate/mute a user.
- `/nexus-purge <amount>` — Bulk delete up to 100 channel messages.
- `/nexus-slowmode <seconds>` — Adjust or disable message rate limiting in a channel.
- `/nexus-lockdown [status]` — Restrict channel write permissions during security incidents.
- `/nexus-warn <user> <reason>` — Issue a formal infraction saved to persistent storage.
- `/nexus-warnings <user>` — Inspect infraction history and warning counts.
- `/nexus-clearwarn <user>` — Reset or purge infraction records.
- `/nexus-modlogs <target>` — Display complete moderation audit records.

### 📈 Leveling & Experience System
- `/nexus-rank [user]` — View Level, accumulated XP, and progress toward next rank.
- `/nexus-leaderboard [page]` — Top server members ranked by activity and XP.
*(Includes automated 60-second XP accumulation cooldown and level-up announcements)*

### 💰 Virtual Economy & Casino Games
- `/nexus-balance [user]` — Check wallet balance, bank savings, and net worth.
- `/nexus-daily` — Claim 24-hour reward with streak bonus (500–1,000 coins).
- `/nexus-work` — Undertake jobs for hourly wages (100–300 coins).
- `/nexus-coinflip <bet> <side>` — High-stakes double-or-nothing coin toss gamble.
- `/nexus-slots <bet>` — Casino slot machine mini-game (win up to 10x your bet!).
- `/nexus-rob <target>` — High-stakes user robbery heist with risk of police fine.
- `/nexus-pay <recipient> <amount>` — Secure user-to-user currency transfers.

### 🎫 Support Tickets, Reaction Roles & Giveaways
- `/nexus-ticket [subject]` — Instantly spawn a private ticket channel with staff permissions.
- `/nexus-ticketsetup <channel>` — Deploy persistent ticket launcher panel with one-click creation.
- `/nexus-reactionrole <channel> <role> <label> [emoji]` — Deploy interactive self-assignable button roles.
- `/nexus-giveaway <prize> <duration> [winners] [channel]` — Launch interactive countdown giveaways with automated winner selection.
- `/nexus-giveaway-reroll <message_id>` — Re-roll winners for concluded giveaways.

---

## 📄 License
ISC
