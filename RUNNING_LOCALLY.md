# Running Secure Wealth Vault Locally

---

## ⚡ Quick Start — Everything Is Already Set Up

Use this every time you want to run the app. No database steps, no config changes.

### 1 — Navigate to the frontend folder

```bash
cd /Users/rahulsingh/Documents/Documents/CreativeAppz/Github/Finance/portfolio-dashboard/frontend
```

### 2 — Kill anything already running on port 3000

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null; echo "Port 3000 is free"
```

> This finds every process listening on port 3000 and force-kills it in one shot.  
> If nothing was running, the command still exits cleanly — `echo` confirms it.

### 3 — Clear Safari cache for localhost (do this before starting the server)

This ensures Safari loads the latest icons, styles, and JS — not a stale version from disk.

**Step A — Enable the Develop menu** *(one-time setup, skip if already done)*

1. Open Safari → **Settings** (`⌘ ,`)
2. Go to the **Advanced** tab
3. Check **"Show features for web developers"** (macOS Sonoma or later)  
   — or **"Show Develop menu in menu bar"** on older macOS

**Step B — Clear all caches**

In the menu bar: **Develop → Empty Caches** — or press **`⌘ ⌥ E`**

> This wipes Safari's entire disk cache in one keystroke. Do this every time you restart the local server when working on icons or styles.

**Step C — Clear localhost site data** *(only needed when icons are still stale after Step B)*

1. Safari → **Settings** (`⌘ ,`) → **Privacy** tab
2. Click **"Manage Website Data…"**
3. In the search box type **`localhost`**
4. Select the `localhost` entry → click **"Remove"** → **"Done"**

> This removes cookies, localStorage, and cached files specific to `localhost`. You will need to sign in again after this.

### 4 — Start the dev server

```bash
npm run dev
```

Wait for:
```
▲ Next.js 14.1.0
- Local: http://localhost:3000
✓ Ready in ~3s
```

### 5 — Open the app

**[http://localhost:3000](http://localhost:3000)**

---

## 🔄 Stopping & Restarting

| Action | Command |
|--------|---------|
| Stop the server | `Ctrl + C` in the Terminal running `npm run dev` |
| Kill port 3000 from any Terminal | `lsof -ti :3000 \| xargs kill -9 2>/dev/null` |
| Restart cleanly | Kill port 3000 (above), then `npm run dev` |
| Check what's on port 3000 | `lsof -i :3000` |

**Full clean-restart one-liner** (copy-paste this anytime):

```bash
cd /Users/rahulsingh/Documents/Documents/CreativeAppz/Github/Finance/portfolio-dashboard/frontend && lsof -ti :3000 | xargs kill -9 2>/dev/null; npm run dev
```

---

## 🧹 Clearing Safari Caches (icons / images look stale)

Two independent caches can serve outdated assets — **Safari's browser cache** and the **Next.js `.next/` build cache**. Work through the levels below in order.

---

### Prerequisites — Enable the Safari Develop menu *(one-time)*

All cache tools below live in the Develop menu. If you don't see it in your menu bar:

1. Safari → **Settings** (`⌘ ,`) → **Advanced** tab
2. Check **"Show features for web developers"** (macOS Sonoma+)  
   — or **"Show Develop menu in menu bar"** on older macOS

---

### Level 1 — Empty Safari's entire cache `⌘ ⌥ E`

**Develop → Empty Caches** (or press `⌘ ⌥ E`)

Wipes every cached resource Safari holds on disk. The next page load fetches everything fresh from the server. **Do this before starting the server** whenever you've changed icons, images, or fonts.

---

### Level 2 — Reload without cache `⌘ ⌥ R`

In any Safari window showing `localhost:3000`, press **`⌘ ⌥ R`** (or hold `⌥` while clicking the reload button).

This forces a single-page reload that ignores the cache — handy after you've already started the server and want to check a quick CSS or image change without emptying the full cache.

---

### Level 3 — Disable caches in Web Inspector *(per session)*

Use while actively iterating so Safari never caches anything while the site is open:

1. **Develop → Web Inspector** (or `⌘ ⌥ I`)
2. Go to the **Network** tab
3. Click the **"Disable Caches"** button (circle with a line through it) in the toolbar

> Stays active as long as Web Inspector is open. Close it and caching resumes.

---

### Level 4 — Wipe the Next.js build cache + restart

If Safari-level fixes don't help, the stale file is inside Next.js's `.next/` folder:

```bash
cd /Users/rahulsingh/Documents/Documents/CreativeAppz/Github/Finance/portfolio-dashboard/frontend
lsof -ti :3000 | xargs kill -9 2>/dev/null
rm -rf .next
npm run dev
```

Then press **`⌘ ⌥ E`** in Safari and reload.

**One-liner:**
```bash
cd /Users/rahulsingh/Documents/Documents/CreativeAppz/Github/Finance/portfolio-dashboard/frontend && lsof -ti :3000 | xargs kill -9 2>/dev/null; rm -rf .next && npm run dev
```

---

### Level 5 — Remove localhost site data *(scorched earth)*

Still wrong after all of the above? Safari is holding on to stored data for `localhost`:

1. Safari → **Settings** (`⌘ ,`) → **Privacy** tab
2. Click **"Manage Website Data…"**
3. Search for **`localhost`**
4. Select it → **"Remove"** → **"Done"**

This wipes cookies, localStorage, session storage, and cached files for `localhost`. You will need to sign in again.

---

### Quick reference

| Symptom | Fix |
|---------|-----|
| Icon / image looks like the old version | `⌘ ⌥ E` → Empty Caches, then reload |
| Single page still stale after cache empty | `⌘ ⌥ R` → Reload without cache |
| Constantly stale while iterating | Web Inspector → Network → Disable Caches |
| Stale after code changes / new files added | `rm -rf .next && npm run dev`, then `⌘ ⌥ E` |
| Wrong state / sign-in broken / layout corrupt | Settings → Privacy → Manage Website Data → remove `localhost` |

---

## 🛠 Troubleshooting

**"Port 3000 is already in use"**
```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null
```
Then run `npm run dev` again.

**"Module not found" / dependency errors**
```bash
npm install
```
Run this from inside the `frontend/` folder, then retry `npm run dev`.

**".next build errors" after pulling new code**
```bash
rm -rf .next && npm run dev
```
Deletes the build cache and rebuilds from scratch.

**Google sign-in redirects back with an error**
→ Make sure `http://localhost:3000/api/auth/google/callback` is listed as an **Authorised redirect URI** in your [Google Cloud Console](https://console.cloud.google.com) project → APIs & Services → Credentials.

**App loads but shows a blank/error page**
→ Check your `.env` file is present inside `frontend/` (not the root folder) and has all values filled in:
```bash
cat .env | grep -v "^#" | grep -v "^$"
```

---

## 📁 Folder Reference

```
portfolio-dashboard/
├── RUNNING_LOCALLY.md        ← you are here
├── frontend/                 ← the app lives here — always cd here first
│   ├── .env                  ← your local secrets (never commit this)
│   ├── .env.example          ← reference for what keys are needed
│   ├── src/
│   │   ├── app/              ← Next.js pages & API routes
│   │   ├── components/       ← UI components
│   │   └── lib/              ← session, encryption, prisma client
│   └── prisma/schema.prisma  ← database schema (read-only for local dev)
└── backend/                  ← Railway migration service (not needed locally)
```

---

## 🔧 First-Time Setup (only needed once, already done)

<details>
<summary>Expand if setting up on a brand-new machine</summary>

### Prerequisites

| Tool | Check | Install |
|------|-------|---------|
| Node.js 18+ | `node --version` | [nodejs.org](https://nodejs.org) → LTS |
| npm | `npm --version` | Included with Node.js |

### Steps

```bash
# 1. Go to the frontend folder
cd .../portfolio-dashboard/frontend

# 2. Install dependencies
npm install

# 3. Copy the env template and fill in values
cp .env.example .env
# Open .env and fill in DATABASE_URL, SESSION_SECRET, GOOGLE_CLIENT_ID, etc.

# 4. Generate a SESSION_SECRET (run this and paste output into .env)
openssl rand -hex 32

# 5. Confirm database tables exist
npx prisma db pull

# 6. Start the app
npm run dev
```

The Railway PostgreSQL database and all 12 Prisma models are already provisioned — no `prisma migrate` needed on subsequent machines, just `db pull` to verify.

</details>
