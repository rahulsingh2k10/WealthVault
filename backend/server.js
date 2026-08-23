/**
 * Cypher Folio — Backend service (Railway)
 *
 * Responsibilities:
 *  1. Run Prisma migrations on startup (so the DB schema is always up to date)
 *  2. Expose /api/health for Railway's health-check probe
 *
 * The actual API endpoints live inside the Next.js app (frontend/) and are
 * deployed to Vercel as serverless functions. This service owns the database
 * lifecycle only.
 */

const express = require("express");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 8001;

app.use(express.json());

/* ── Run migrations at startup ──────────────────────────────────────────── */
function runMigrations() {
  try {
    console.log("[migration] Running prisma migrate deploy…");
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log("[migration] Migrations applied successfully.");
  } catch (err) {
    console.error("[migration] Migration failed:", err.message);
    // Don't crash the process — the DB might already be up to date
  }
}

runMigrations();

/* ── Routes ─────────────────────────────────────────────────────────────── */
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cypher-folio-backend",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

app.get("/", (_req, res) => {
  res.json({
    name: "Cypher Folio Backend",
    description: "Database migration service — API is served by the Next.js frontend on Vercel.",
    health: "/api/health",
  });
});

/* ── Start ──────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`[server] Cypher Folio backend running on port ${PORT}`);
});
