import postgres from "postgres";

const PROJECT = "dpgknkuuylkuskbjkuue";
const PASSWORD = process.env.DB_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set DB_PASSWORD env var first");
  process.exit(1);
}

const REGIONS = [
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "us-east-1",
  "us-west-1",
  "ap-southeast-1",
  "ap-south-1",
  "ap-northeast-1",
  "sa-east-1",
];

async function tryRegion(region: string): Promise<boolean> {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const url = `postgresql://postgres.${PROJECT}:${encodeURIComponent(PASSWORD)}@${host}:6543/postgres`;
  const sql = postgres(url, {
    prepare: false,
    ssl: "require",
    connect_timeout: 5,
    max: 1,
    idle_timeout: 1,
  });
  try {
    const rows = await sql`SELECT 1 as ok`;
    if (rows[0]?.ok === 1) {
      console.log(`✓ ${region} — connection works`);
      await sql.end();
      return true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✗ ${region} — ${msg.split("\n")[0]}`);
  }
  await sql.end({ timeout: 1 }).catch(() => {});
  return false;
}

async function main() {
  for (const region of REGIONS) {
    const ok = await tryRegion(region);
    if (ok) {
      console.log(`\n→ Use this in .env.local:`);
      console.log(
        `DATABASE_URL=postgresql://postgres.${PROJECT}:<URL_ENCODED_PASSWORD>@aws-0-${region}.pooler.supabase.com:6543/postgres`,
      );
      process.exit(0);
    }
  }
  console.log("\n✗ No region worked. Project may be in a less common region.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
