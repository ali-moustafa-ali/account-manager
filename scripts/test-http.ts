import { createHmac } from "node:crypto";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  console.error("SESSION_SECRET not set");
  process.exit(1);
}

// Mint a session cookie using the same logic as lib/auth/session.ts
const now = Date.now();
const payload = { iat: now, exp: now + 30 * 24 * 60 * 60 * 1000 };
const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
const token = `${data}.${sig}`;

async function main() {
  console.log("→ GET / with minted session cookie…");
  const res = await fetch("http://localhost:3000/", {
    headers: { Cookie: `manager_session=${token}` },
    redirect: "manual",
  });
  console.log(`  Status: ${res.status}`);

  if (res.status === 200) {
    const html = await res.text();
    const hasClients = html.includes("Acme Co") || html.includes("clients");
    const hasArabic = html.includes("أحمد");
    const hasOverduePill = html.toLowerCase().includes("overdue");
    const hasSummaryStrip = html.includes("Outstanding") || html.includes("Clients");

    console.log("  Contains client names:", hasClients ? "✓" : "✗");
    console.log("  Contains Arabic name:", hasArabic ? "✓" : "✗");
    console.log("  Contains Overdue pill:", hasOverduePill ? "✓" : "✗");
    console.log("  Contains summary strip:", hasSummaryStrip ? "✓" : "✗");

    if (hasClients && hasArabic && hasOverduePill && hasSummaryStrip) {
      console.log("\n✓ Dashboard fully rendered via HTTP. End-to-end verified.");
      process.exit(0);
    } else {
      console.log("\n✗ Some content missing");
      process.exit(1);
    }
  } else if (res.status === 307 || res.status === 302) {
    console.log("  Redirected to:", res.headers.get("location"));
    console.log("  → Auth check failed, cookie not accepted");
    process.exit(1);
  } else {
    console.log("  Unexpected status");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
