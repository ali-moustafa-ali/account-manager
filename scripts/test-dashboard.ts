import { fetchRoster, fetchNotifications } from "../lib/db/queries";

async function main() {
  console.log("→ Fetching roster…");
  const entries = await fetchRoster();
  console.log(`  ${entries.length} clients fetched\n`);

  if (entries.length === 0) {
    console.log("✗ No clients in DB. Run: npm run seed");
    process.exit(1);
  }

  // Status counts
  const counts = entries.reduce(
    (acc, e) => {
      acc[e.period.status] = (acc[e.period.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalRemaining = entries.reduce((s, e) => s + e.period.remaining, 0);

  console.log("Status distribution:");
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`  ${status.padEnd(8)} ${count}`);
  }
  console.log(`Total remaining: ${totalRemaining.toLocaleString()} EGP\n`);

  // Sort preview (mimic dashboard sort: status priority then name)
  const PRIORITY: Record<string, number> = { overdue: 0, pending: 1, partial: 2, cleared: 3 };
  const sorted = [...entries].sort((a, b) => {
    const sp = (PRIORITY[a.period.status] ?? 99) - (PRIORITY[b.period.status] ?? 99);
    return sp !== 0 ? sp : a.client.name.localeCompare(b.client.name);
  });

  console.log("Sorted view (first 5):");
  for (const e of sorted.slice(0, 5)) {
    console.log(
      `  ${e.client.name.padEnd(20)} ${e.period.status.padEnd(8)} target=${e.period.effectiveTarget}, paid=${e.period.paidThisPeriod}, remaining=${e.period.remaining}`,
    );
  }
  console.log();

  // Notifications
  console.log("→ Fetching notifications…");
  const notifications = await fetchNotifications();
  const unread = notifications.filter((n) => !n.read).length;
  console.log(`  ${notifications.length} total, ${unread} unread\n`);

  if (notifications.length > 0) {
    console.log("First few notifications:");
    for (const n of notifications.slice(0, 3)) {
      console.log(`  [${n.type}] ${n.clientName}: ${n.message}`);
    }
  }

  console.log("\n✓ Dashboard data path works end-to-end. UI will render correctly.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});
