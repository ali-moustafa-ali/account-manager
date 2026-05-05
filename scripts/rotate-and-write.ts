import postgres from "postgres";
import { writeFileSync, readFileSync } from "node:fs";

const PROJECT = "dpgknkuuylkuskbjkuue";
const REGION = "eu-west-1";
const SBP_TOKEN = process.env.SBP_TOKEN;
const ENV_PATH = process.env.ENV_PATH ?? "/Users/alimoustafa/Downloads/account/.env.local";

if (!SBP_TOKEN) {
  console.error("Set SBP_TOKEN env var");
  process.exit(1);
}

function hex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const newPassword = hex(24); // 48 hex chars, alphanumeric

  // 1) Rotate via Management API (in-memory only, no logging)
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT}/database/password`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SBP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: newPassword }),
    },
  );
  if (!res.ok) {
    console.error("✗ API rotation failed, status", res.status);
    process.exit(1);
  }
  console.log("✓ Password rotated via Management API");

  // 2) Wait for pooler propagation (retry with backoff, up to 90s total)
  const url = `postgresql://postgres.${PROJECT}:${newPassword}@aws-0-${REGION}.pooler.supabase.com:6543/postgres`;
  let connected = false;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const wait = attempt * 5_000; // 5, 10, 15, 20, 25, 30s — total ~105s
    console.log(`  attempt ${attempt}/6 — waiting ${wait / 1000}s for pooler propagation…`);
    await new Promise((r) => setTimeout(r, wait));
    const sql = postgres(url, { prepare: false, ssl: "require", max: 1, connect_timeout: 10 });
    try {
      const rows = await sql`SELECT count(*)::int AS n FROM clients`;
      console.log(`✓ Connection verified — ${rows[0]?.n} clients in database`);
      connected = true;
      await sql.end();
      break;
    } catch (err) {
      lastErr = err;
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }
  if (!connected) {
    console.error("✗ Connection failed after 6 attempts. Last error:", (lastErr as Error)?.message);
    process.exit(1);
  }

  // 4) Update .env.local in place (replace DATABASE_URL line)
  const env = readFileSync(ENV_PATH, "utf-8");
  const replaced = env.replace(
    /^DATABASE_URL=.*$/m,
    `DATABASE_URL=${url}`,
  );
  writeFileSync(ENV_PATH, replaced, { mode: 0o600 });
  console.log("✓ .env.local updated (file mode set to 600)");

  console.log("\n✓ Done. Restart dev server: pkill -f 'next dev' && npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
