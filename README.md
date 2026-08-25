# Wealth Vault

> **Zero-knowledge portfolio tracker** — AES-256-GCM encrypted, client-side passphrase, zero analytics.

Track every rupee across stocks, mutual funds, crypto, FDs, NPS, and more — all secured with a passphrase only you know.

---

## Monorepo Structure

```
secure-wealth-vault/
├── frontend/          # Next.js 14 app → deploys to Vercel
│   ├── src/
│   │   ├── app/       # Pages + API routes (App Router)
│   │   ├── components/
│   │   ├── lib/
│   │   └── context/
│   ├── prisma/        # Prisma schema + migrations
│   ├── vercel.json
│   └── package.json
├── backend/           # Node.js migration service → deploys to Railway
│   ├── server.js      # Express health-check + Prisma migrate on startup
│   ├── prisma/        # Schema copy for Railway migrations
│   ├── railway.json
│   ├── Procfile
│   └── package.json
├── .gitignore
└── README.md
```

---

## Deployment

### Frontend → Vercel

1. Import this repo in [Vercel](https://vercel.com/new)
2. Set **Root Directory** to `frontend`
3. Add environment variables (see `frontend/.env.example`):
   - `DATABASE_URL` — from Railway PostgreSQL
   - `SESSION_SECRET` — `openssl rand -hex 32`
   - `ENCRYPTION_SALT` — any random string
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`

The `vercel.json` build command automatically runs `prisma generate` + `prisma migrate deploy` before building.

### Backend (DB migrations) → Railway

1. Create a new project in [Railway](https://railway.app)
2. Add a **PostgreSQL** plugin — Railway sets `DATABASE_URL` automatically
3. Deploy from this repo, set **Root Directory** to `backend`
4. The service runs migrations at startup and exposes `GET /api/health`

### Google OAuth setup

In [Google Cloud Console](https://console.cloud.google.com):
- Enable the **Google+ API** / **Google Identity**
- Create OAuth 2.0 credentials
- Add authorised redirect URI: `https://your-app.vercel.app/api/auth/google/callback`

---

## Local Development

```bash
# 1. Clone and enter frontend
cd frontend
npm install

# 2. Copy and fill env
cp .env.example .env
# Edit .env with your DATABASE_URL, SESSION_SECRET, etc.

# 3. Run migrations
npx prisma migrate dev

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Auth | Google OAuth 2.0 (custom native fetch) |
| Session | iron-session v8 |
| Database | PostgreSQL (Railway) via Prisma ORM |
| Encryption | AES-256-GCM + scrypt (client-side passphrase) |
| Deployment | Vercel (frontend) + Railway (database + migrations) |

---

*Built with privacy in mind. Zero analytics · Zero ads · Zero data sharing.*
