import postgres from "postgres";

const PROJECT = "dpgknkuuylkuskbjkuue";
const REGION = "eu-west-1";
const OLD = process.env.OLD_DB_PASSWORD;
const NEW = process.env.NEW_DB_PASSWORD;

if (!OLD || !NEW) {
  console.error("Set OLD_DB_PASSWORD and NEW_DB_PASSWORD env vars");
  process.exit(1);
}

if (!/^[A-Za-z0-9]+$/.test(NEW) || NEW.length < 16) {
  console.error("NEW_DB_PASSWORD must be alphanumeric, ≥16 chars");
  process.exit(1);
}

const url = `postgresql://postgres.${PROJECT}:${encodeURIComponent(OLD)}@aws-0-${REGION}.pooler.supabase.com:6543/postgres`;
const sql = postgres(url, {
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
  max: 1,
});

async function main() {
  // sql.unsafe is required because ALTER USER doesn't support parameter binding
  // Newpassword is validated above to be alphanumeric only — no SQL injection risk.
  await sql.unsafe(`ALTER USER postgres WITH PASSWORD '${NEW}'`);
  console.log("✓ Password changed via ALTER USER postgres");
  await sql.end();
}

main().catch(async (err) => {
  console.error("Failed:", err.message);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
