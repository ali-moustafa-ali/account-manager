import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import { clients, payments } from "../lib/db/schema";
import { todayInCairo } from "../lib/time/cairo";
import { currentPeriodKey } from "../lib/domain/period";

interface SeedClient {
  name: string;
  packageCost: number;
  targetCost: number;
  totalAdsAmount: number;
  billingCycle: "split-month" | "anchor-day";
  anchorDay: number | null;
  paidThisPeriod: number;
}

const SEED_DATA: SeedClient[] = [
  // Cleared clients (3)
  { name: "Acme Co", packageCost: 60000, targetCost: 5000, totalAdsAmount: 30000, billingCycle: "split-month", anchorDay: null, paidThisPeriod: 5000 },
  { name: "India Industries", packageCost: 108000, targetCost: 9000, totalAdsAmount: 27000, billingCycle: "split-month", anchorDay: null, paidThisPeriod: 9000 },
  { name: "Foxtrot Media", packageCost: 48000, targetCost: 4000, totalAdsAmount: 8000, billingCycle: "anchor-day", anchorDay: 15, paidThisPeriod: 4000 },

  // Partial clients (2)
  { name: "Beta Corp", packageCost: 96000, targetCost: 8000, totalAdsAmount: 12000, billingCycle: "split-month", anchorDay: null, paidThisPeriod: 4000 },
  { name: "Golf Group", packageCost: 84000, targetCost: 7000, totalAdsAmount: 21000, billingCycle: "split-month", anchorDay: null, paidThisPeriod: 3500 },

  // Pending clients (1) — anchor-day where today == anchor
  { name: "Echo Studios", packageCost: 120000, targetCost: 10000, totalAdsAmount: 0, billingCycle: "anchor-day", anchorDay: 5, paidThisPeriod: 0 },

  // Overdue clients (4)
  { name: "Gamma LLC", packageCost: 36000, targetCost: 3000, totalAdsAmount: 5000, billingCycle: "split-month", anchorDay: null, paidThisPeriod: 0 },
  { name: "Delta Inc", packageCost: 72000, targetCost: 6000, totalAdsAmount: 18000, billingCycle: "split-month", anchorDay: null, paidThisPeriod: 1000 },
  { name: "Hotel Holdings", packageCost: 30000, targetCost: 2500, totalAdsAmount: 0, billingCycle: "anchor-day", anchorDay: 10, paidThisPeriod: 0 },

  // RTL Arabic-name client
  { name: "أحمد للتجارة", packageCost: 45000, targetCost: 4500, totalAdsAmount: 9000, billingCycle: "split-month", anchorDay: null, paidThisPeriod: 0 },
];

async function reset() {
  console.log("Truncating tables…");
  await db.execute(sql`
    TRUNCATE payments, credits, installments, periods, special_services, notification_read_state, clients
    RESTART IDENTITY CASCADE
  `);
}

async function seed() {
  await reset();

  const today = todayInCairo();
  console.log(`Today in Cairo: ${today}`);

  const inserted = await db.insert(clients).values(
    SEED_DATA.map((d) => ({
      name: d.name,
      packageCost: d.packageCost,
      targetCost: d.targetCost,
      totalAdsAmount: d.totalAdsAmount,
      billingCycle: d.billingCycle,
      anchorDay: d.anchorDay,
    })),
  ).returning();

  console.log(`Inserted ${inserted.length} clients`);

  for (let i = 0; i < SEED_DATA.length; i++) {
    const seedRow = SEED_DATA[i]!;
    const client = inserted[i]!;
    if (seedRow.paidThisPeriod === 0) continue;

    const periodKey = currentPeriodKey(
      { billingCycle: seedRow.billingCycle, anchorDay: seedRow.anchorDay },
      today,
    );

    await db.insert(payments).values({
      clientId: client.id,
      targetYear: periodKey.year,
      targetMonth: periodKey.month,
      slot: 1,
      amount: seedRow.paidThisPeriod,
      receivedOn: today,
      note: "Seed data",
    });

    console.log(
      `  + Payment ${seedRow.paidThisPeriod} EGP for ${seedRow.name} (period ${periodKey.year}-${String(periodKey.month).padStart(2, "0")})`,
    );
  }

  console.log("\n✓ Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
